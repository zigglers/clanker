/**
 * GrokAgent implementation with dynamic tool registry
 */

import {GrokClient, GrokTool, GrokMessage, GrokToolCall} from './client';
import {ToolResult} from '../types';
import {
    ToolRegistry,
    createToolRegistry,
    ToolLoader,
    createToolLoader,
    generateGrokTools
} from '../registry';
import { createToolExecutorWithRetry } from '../registry/retry-executor';
import {EventEmitter} from 'events';
// import {TokenCounter, createTokenCounter} from '../utils/token-counter';
import {debug} from '../utils/debug-logger';
import * as path from 'path';
import { HookManager } from '../hooks/hook-manager';
import { SessionManager } from '../session/session-manager';
import { HookEvent, PreToolUseOutput, EnhancedHookOutput } from '../hooks/types';
import { fixMalformedArguments, ArgumentFixResult } from '../utils/argument-fixer';
import { preprocessPrompt, enhanceSystemPrompt } from '../utils/prompt-preprocessor';


interface GrokAgentOptions {
    apiKey: string;
    baseURL?: string;
    model?: string;
    maxToolRounds?: number;
    systemPrompt?: string;
    loadDynamicTools?: boolean;
    dynamicToolsPath?: string;
    watchTools?: boolean;
    sessionId?: string; // Resume existing session
    sessionTitle?: string; // Title for new session
}

export interface StreamingChunk {
    type: 'content' | 'tool_calls' | 'tool_result' | 'done' | 'token_count';
    content?: string;
    toolCalls?: GrokToolCall[];
    toolCall?: GrokToolCall;
    toolResult?: ToolResult;
    tokenCount?: number;
}

export class GrokAgent extends EventEmitter {
    private client: GrokClient;
    private model: string;
    private maxToolRounds: number;
    private registry: ToolRegistry;
    private toolLoader?: ToolLoader;
    private executeToolWithRegistry: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
    private hookManager: HookManager;
    private sessionManager: SessionManager;
    private sessionId?: string;
    private initialized: boolean = false;
    // private tokenCounter: TokenCounter;

    constructor(options: GrokAgentOptions) {
        super();
        this.client = new GrokClient(
            options.apiKey,
            options.model,
            options.baseURL
        );
        this.model = options.model || 'grok-3-latest';
        this.maxToolRounds = options.maxToolRounds || 30;
        // this.tokenCounter = createTokenCounter(this.model);

        // Create registry
        this.registry = createToolRegistry();
        
        // Create hook manager
        this.hookManager = HookManager.getInstance(this.registry);
        
        // Set hook manager in registry
        if (this.registry.setHookManager) {
            this.registry.setHookManager(this.hookManager);
        }
        
        // Initialize session synchronously - actual loading happens in initialize()
        this.sessionManager = new SessionManager(this.hookManager, {
            title: options.sessionTitle
        });
        
        // Store options for async initialization
        this.sessionId = options.sessionId;

        // Create tool executor with retry logic
        this.executeToolWithRegistry = createToolExecutorWithRetry(this.registry);

        // Create tool loader with appropriate directories
        const directories: string[] = [];

        // Always include ~/.clanker
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        if (homeDir) {
            directories.push(path.join(homeDir, '.clanker'));
        }

        // Add custom path if specified
        if (options.dynamicToolsPath) {
            directories.push(options.dynamicToolsPath);
        }

        // Add current directory if dynamic tools enabled
        if (options.loadDynamicTools) {
            directories.push(process.cwd());
        }

        // Create loader
        this.toolLoader = createToolLoader(this.registry, {
            directories: directories.length > 0 ? directories : undefined,
            recursive: true,
            watch: options.watchTools ?? false,
            loadBuiltins: true  // Load builtin tools from manifest
        });

        // Tools will be loaded when needed via waitForToolsToLoad()
    }
    
    /**
     * Initialize agent (must be called before using the agent)
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // Load tools
        await this.waitForToolsToLoad();
        
        // Initialize session if needed
        if (this.sessionId) {
            // Load existing session
            try {
                const loadedSession = await SessionManager.load(this.sessionId, this.hookManager);
                this.sessionManager = loadedSession;
            } catch (error) {
                debug.error('[GrokAgent] Failed to load session, using new one:', error);
                // Session manager already created in constructor
            }
        } else {
            // Execute SessionStart hooks for new session
            const sessionStartInput = {
                session_id: this.sessionManager.getId(),
                transcript_path: '',
                cwd: process.cwd(),
                source: 'startup' as const
            };
            await this.hookManager.execute(HookEvent.SessionStart, sessionStartInput);
        }
        
        this.initialized = true;
    }
    
    /**
     * Get current session ID
     */
    getSessionId(): string {
        return this.sessionManager.getId();
    }
    
    /**
     * Save current session
     */
    async saveSession(): Promise<void> {
        await this.sessionManager.save();
    }


    async chat(
        messages: GrokMessage[],
        systemPrompt?: string,
        stream: boolean = false
    ): Promise<string | AsyncGenerator<StreamingChunk, void, unknown>> {
        // Ensure agent is initialized
        if (!this.initialized) {
            await this.initialize();
        }
        
        debug.log('[GrokAgent] chat called with', messages.length, 'messages, stream:', stream);
        
        // Preprocess user messages to avoid multi-tool call issues
        const processedMessages = messages.map(msg => {
            if (msg.role === 'user') {
                const preprocessResult = preprocessPrompt(msg.content);
                if (preprocessResult.modified) {
                    debug.log('[GrokAgent] Preprocessed user prompt to avoid multi-tool calls');
                    return { ...msg, content: preprocessResult.prompt };
                }
            }
            return msg;
        });
        
        // Add messages to session
        for (const message of processedMessages) {
            await this.sessionManager.addMessage(message);
        }
        
        // Get all messages from session (includes history)
        const sessionMessages = this.sessionManager.getMessages();
        const allMessages: GrokMessage[] = [];

        // Check if we need to enhance system prompt based on user messages
        const lastUserMessage = messages.find(m => m.role === 'user');
        const enhancedSystemPrompt = lastUserMessage 
            ? enhanceSystemPrompt(systemPrompt || '', lastUserMessage.content)
            : systemPrompt;

        // Add system prompt if provided
        if (enhancedSystemPrompt) {
            allMessages.push({role: 'system', content: enhancedSystemPrompt});
        }

        // Add session messages
        allMessages.push(...sessionMessages.map(m => {
            const baseMessage = {
                role: m.role as 'user' | 'assistant' | 'system' | 'tool',
                content: m.content
            };
            
            // Only add tool_calls for assistant messages
            if (m.role === 'assistant' && m.tool_calls) {
                return {
                    ...baseMessage,
                    tool_calls: m.tool_calls
                };
            }
            
            // For tool messages, we need tool_call_id
            if (m.role === 'tool' && m.tool_call_id) {
                return {
                    ...baseMessage,
                    tool_call_id: m.tool_call_id
                };
            }
            
            return baseMessage;
        }) as GrokMessage[]);

        // Get tool definitions from registry
        const tools = generateGrokTools(this.registry);

        if (stream) {
            return this.streamChat(allMessages, tools);
        } else {
            return this.nonStreamChat(allMessages, tools);
        }
    }

    private async* streamChat(
        messages: GrokMessage[],
        tools: GrokTool[]
    ): AsyncGenerator<StreamingChunk, void, unknown> {
        debug.log('[GrokAgent] streamChat called');
        let rounds = 0;
        let currentMessages = [...messages];
        let totalTokens = 0; // this.tokenCounter.countMessageTokens(currentMessages as never); // Start with initial message tokens

        while (rounds < this.maxToolRounds) {
            // Use real streaming from Grok API
            const stream = this.client.chatStream(
                currentMessages,
                tools.length > 0 ? tools : undefined,
                this.model
            );

            let accumulatedContent = '';
            const accumulatedToolCalls: GrokToolCall[] = [];
            let currentToolCall: Partial<GrokToolCall> | null = null;
            let lastFinishReason: string | null = null;

            // Process the stream
            debug.log('[GrokAgent] Starting to process stream');
            for await (const chunk of stream) {
                debug.log('[GrokAgent] Processing chunk');
                // Skip chunks without choices or delta
                if (!chunk.choices || chunk.choices.length === 0 || !chunk.choices[0].delta) {
                    continue;
                }

                // Handle tool calls
                if (chunk.choices[0].delta.tool_calls) {
                    for (const toolCallDelta of chunk.choices[0].delta.tool_calls) {
                        if (toolCallDelta.index === 0 && !currentToolCall) {
                            currentToolCall = {
                                id: toolCallDelta.id,
                                type: 'function' as const,
                                function: {
                                    name: toolCallDelta.function?.name || '',
                                    arguments: toolCallDelta.function?.arguments || ''
                                }
                            };
                        } else if (currentToolCall && toolCallDelta.function?.arguments) {
                            currentToolCall.function!.arguments += toolCallDelta.function.arguments;
                        }
                    }
                }

                // Handle content streaming
                if (chunk.choices[0].delta.content !== undefined && chunk.choices[0].delta.content !== null) {
                    const content = chunk.choices[0].delta.content;
                    accumulatedContent += content;

                    yield {
                        type: 'content',
                        content
                    };

                    // Update token count in real-time
                    const currentOutputTokens = 0; // this.tokenCounter.estimateStreamingTokens(accumulatedContent) +
                        // (accumulatedToolCalls.length > 0 ? this.tokenCounter.countTokens(JSON.stringify(accumulatedToolCalls)) : 0);

                    yield {
                        type: 'token_count',
                        tokenCount: totalTokens + currentOutputTokens
                    };
                }

                // Check for finish reason
                if (chunk.choices[0].finish_reason) {
                    lastFinishReason = chunk.choices[0].finish_reason;
                    if (currentToolCall) {
                        accumulatedToolCalls.push(currentToolCall as GrokToolCall);
                    }
                    break;
                }
            }

            // Process accumulated results
            if (accumulatedToolCalls.length > 0) {
                // Emit tool calls
                yield {
                    type: 'tool_calls',
                    toolCalls: accumulatedToolCalls
                };

                // Execute tool calls
                const toolResults = await this.executeToolCalls(accumulatedToolCalls);

                // Add assistant message to session
                const assistantMessage = {
                    role: 'assistant',
                    content: accumulatedContent || '',
                    tool_calls: accumulatedToolCalls
                } as GrokMessage;
                
                await this.sessionManager.addMessage(assistantMessage);
                currentMessages.push(assistantMessage);

                // Update total tokens to include the assistant message
                totalTokens = 0; // this.tokenCounter.countMessageTokens(currentMessages as never);

                // Add tool results and emit them
                for (let i = 0; i < toolResults.length; i++) {
                    const toolResult = toolResults[i];

                    yield {
                        type: 'tool_result',
                        toolCall: accumulatedToolCalls[i],
                        toolResult
                    };

                    const toolMessage = {
                        role: 'tool',
                        content: this.formatToolResult(toolResult),
                        tool_call_id: accumulatedToolCalls[i].id
                    } as GrokMessage;
                    currentMessages.push(toolMessage);

                    // Update total tokens after each tool result
                    totalTokens = 0; // this.tokenCounter.countMessageTokens(currentMessages as never);

                    // Emit updated token count
                    yield {
                        type: 'token_count',
                        tokenCount: totalTokens
                    };
                }

                rounds++;
                currentToolCall = null;
                debug.log(`[Agent] Tool execution complete, continuing to round ${rounds}`);
                // Continue the loop to get assistant's response about the tool results
            } else if (accumulatedContent) {
                // No tool calls but we have content, we're done
                yield {
                    type: 'done'
                };
                return;
            } else if (lastFinishReason === 'tool_calls') {
                // Grok API quirk: finish_reason is tool_calls but no actual tool calls
                // This seems to happen on the first round, continue to get actual response
                rounds++;
            } else {
                // No tool calls and no content, we're done
                yield {
                    type: 'done'
                };
                return;
            }
        }

        throw new Error(`Maximum tool rounds (${this.maxToolRounds}) exceeded`);
    }

    private async nonStreamChat(
        messages: GrokMessage[],
        tools: GrokTool[]
    ): Promise<string> {
        let rounds = 0;
        let currentMessages = [...messages];

        while (rounds < this.maxToolRounds) {
            const response = await this.client.chat(
                currentMessages,
                tools.length > 0 ? tools : undefined,
                this.model
            );

            const message = response.choices[0]?.message;
            if (!message) {
                throw new Error('No response from API');
            }

            if (message.tool_calls && message.tool_calls.length > 0) {
                // Execute tool calls
                const toolResults = await this.executeToolCalls(message.tool_calls);

                // Add assistant message
                currentMessages.push({
                    role: 'assistant',
                    content: message.content,
                    tool_calls: message.tool_calls
                } as GrokMessage);

                // Add tool results
                for (let i = 0; i < toolResults.length; i++) {
                    const toolMessage = {
                        role: 'tool',
                        content: this.formatToolResult(toolResults[i]),
                        tool_call_id: message.tool_calls[i].id
                    } as GrokMessage;
                    
                    await this.sessionManager.addMessage(toolMessage);
                    currentMessages.push(toolMessage);
                }

                rounds++;
            } else {
                // No tool calls, return the content
                return message.content || '';
            }
        }

        throw new Error(`Maximum tool rounds (${this.maxToolRounds}) exceeded`);
    }

    private async executeToolCalls(toolCalls: GrokToolCall[]): Promise<ToolResult[]> {
        const results: ToolResult[] = [];

        for (const toolCall of toolCalls) {
            try {
                const result = await this.executeTool(toolCall);
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    error: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }

        return results;
    }

    async executeTool(toolCall: GrokToolCall): Promise<ToolResult> {
        const toolName = toolCall.function.name;

        // Parse arguments with retry and format support
        let fixResult: ArgumentFixResult;
        let args: Record<string, unknown>;
        
        try {
            // Try standard JSON parsing first
            args = JSON.parse(toolCall.function.arguments);
            fixResult = {
                fixed: true,
                calls: [{ args }],
                fixMethod: 'none',
                format: 'json'
            };
        } catch {
            debug.log(`[Agent] Standard JSON parsing failed for ${toolName}, trying argument fixer`);
            
            // Use argument fixer with retry logic
            fixResult = await fixMalformedArguments(
                toolCall.function.arguments,
                this.client,
                'yaml', // Prefer YAML as it's more AI-friendly
                -1 // Never give up - infinite retries
            );
            
            if (!fixResult.fixed) {
                debug.error(`[Agent] Failed to fix arguments for ${toolName} after all attempts`);
                debug.error(`[Agent] Raw arguments: ${JSON.stringify(toolCall.function.arguments)}`);
                debug.error(`[Agent] Error: ${fixResult.originalError}`);
                
                // Get tool info to provide better error message
                const tool = this.registry.get(toolName);
                
                // Build helpful error message
                let errorMessage = `Failed to parse arguments after ${fixResult.calls.length || 0} attempts: ${fixResult.originalError}`;
                errorMessage += `\n\nThe raw arguments were: ${toolCall.function.arguments}`;
                
                if (tool) {
                    errorMessage += `\n\nTool "${toolName}" expects:`;
                    if (!tool.definition.arguments || tool.definition.arguments.length === 0) {
                        errorMessage += '\n- No arguments required (use empty object: {})';
                    } else {
                        tool.definition.arguments.forEach(arg => {
                            errorMessage += `\n- ${arg.name}: ${arg.type}${arg.required ? ' (required)' : ' (optional)'}`;
                            if (arg.description) {
                                errorMessage += ` - ${arg.description}`;
                            }
                        });
                    }
                }
                
                errorMessage += `\n\nTip: Try using YAML or XML format for tool arguments instead of JSON.`;
                
                return {
                    success: false,
                    error: errorMessage
                };
            }
            
            debug.log(`[Agent] Successfully fixed arguments using ${fixResult.fixMethod} method (${fixResult.format} format)`);
        }
        
        // Handle multiple tool calls if concatenated
        if (fixResult.calls.length > 1) {
            debug.log(`[Agent] Found ${fixResult.calls.length} concatenated tool calls, executing them sequentially`);
            
            const results: ToolResult[] = [];
            for (let i = 0; i < fixResult.calls.length; i++) {
                const call = fixResult.calls[i];
                debug.log(`[Agent] Executing concatenated call ${i + 1}/${fixResult.calls.length}`);
                
                // Create a new tool call with the fixed arguments
                const fixedToolCall: GrokToolCall = {
                    ...toolCall,
                    id: `${toolCall.id}_${i}`,
                    function: {
                        ...toolCall.function,
                        arguments: JSON.stringify(call.args)
                    }
                };
                
                // Execute this individual call
                const result = await this.executeToolInternal(fixedToolCall, call.args);
                results.push(result);
            }
            
            // Combine results
            const allSuccessful = results.every(r => r.success);
            const combinedOutput = results
                .map((r, i) => `[Call ${i + 1}] ${r.success ? r.output || 'Success' : `Error: ${r.error}`}`)
                .join('\n\n');
                
            return {
                success: allSuccessful,
                output: combinedOutput,
                data: { results, fixMethod: fixResult.fixMethod, format: fixResult.format }
            };
        }
        
        // Single tool call
        args = fixResult.calls[0].args;
        return this.executeToolInternal(toolCall, args);
    }
    
    private async executeToolInternal(toolCall: GrokToolCall, args: Record<string, unknown>): Promise<ToolResult> {
        const toolName = toolCall.function.name;

        // Execute PreToolUse hooks
        const preToolUseInput = {
            session_id: this.sessionManager.getId(),
            transcript_path: '',
            cwd: process.cwd(),
            tool_name: toolName,
            tool_input: args
        };
        const preHookResults = await this.hookManager.execute(HookEvent.PreToolUse, preToolUseInput);
        
        // Check if any hook blocked execution
        for (const result of preHookResults) {
            if (result.output && 'permissionDecision' in result.output) {
                const preToolOutput = result.output as PreToolUseOutput;
                const decision = preToolOutput.hookSpecificOutput?.permissionDecision || 
                               preToolOutput.decision;
                
                if (decision === 'deny' || decision === 'block') {
                    const preToolOutput = result.output as PreToolUseOutput;
                    return {
                        success: false,
                        error: preToolOutput.hookSpecificOutput?.permissionDecisionReason ||
                               preToolOutput.reason ||
                               'Tool execution blocked by hook'
                    };
                }
            }
            
            // Check if hook modified arguments
            if (result.output && 'modifiedArgs' in result.output) {
                args = result.output.modifiedArgs as Record<string, unknown>;
            }
        }
        
        // Execute the tool
        const toolResult = await this.executeToolWithRegistry(toolName, args);
        
        // Store tool execution in session
        await this.sessionManager.addToolExecution(toolCall, toolResult);
        
        // Execute PostToolUse hooks
        const postToolUseInput = {
            session_id: this.sessionManager.getId(),
            transcript_path: '',
            cwd: process.cwd(),
            tool_name: toolName,
            tool_input: args,
            tool_response: toolResult
        };
        const postHookResults = await this.hookManager.execute(HookEvent.PostToolUse, postToolUseInput);
        
        // Check if any hook wants to modify the result
        let finalResult = toolResult;
        for (const result of postHookResults) {
            if (result.output && 'data' in result.output) {
                const enhancedOutput = result.output as EnhancedHookOutput;
                if (enhancedOutput.data) {
                    // If hook provided data, merge it into the tool result's data field
                    finalResult = {
                        ...finalResult,
                        data: {
                            ...(typeof finalResult.data === 'object' ? finalResult.data : {}),
                            hookData: enhancedOutput.data
                        }
                    };
                }
            }
        }
        
        return finalResult;
    }

    private formatToolResult(result: ToolResult): string {
        if (result.success) {
            return result.output || JSON.stringify(result.data) || 'Success';
        } else {
            return `Error: ${result.error}`;
        }
    }

    // Public API for registry access
    getRegistry(): ToolRegistry {
        return this.registry;
    }
    
    async waitForToolsToLoad(): Promise<void> {
        if (this.toolLoader) {
            await this.toolLoader.loadTools();
        }
    }

    // Get tool statistics
    getToolStats(): Record<string, { executionCount: number; totalDuration: number }> {
        // Type assertion to access the implementation's getExecutionStats method
        const registryImpl = this.registry as ToolRegistry & {
            getExecutionStats(): Record<string, { executionCount: number; totalDuration: number }>
        };
        return registryImpl.getExecutionStats();
    }

    // Get the underlying Grok client
    getClient(): GrokClient {
        return this.client;
    }

    // Reload dynamic tools
    async reloadDynamicTools(): Promise<void> {
        if (this.toolLoader) {
            await this.toolLoader.reloadAllTools();
        }
    }

    // Clean up resources
    dispose(): void {
        // this.tokenCounter.dispose();
        if (this.toolLoader) {
            this.toolLoader.cleanup();
        }
    }

    setApiKey(apiKey: string) {
        this.client.setApiKey(apiKey);
    }
}