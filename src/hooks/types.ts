/**
 * Hook system types and interfaces
 */

import { ToolArguments } from '../registry/types';
import { ToolResult } from '../types';

/**
 * Hook event types
 */
export enum HookEvent {
    // Tool lifecycle hooks
    PreToolUse = 'PreToolUse',
    PostToolUse = 'PostToolUse',
    
    // Message lifecycle hooks  
    PreMessage = 'PreMessage',
    PostMessage = 'PostMessage',
    
    // User interaction hooks
    UserPromptSubmit = 'UserPromptSubmit',
    Notification = 'Notification',
    
    // Session lifecycle hooks
    SessionStart = 'SessionStart',
    Stop = 'Stop',
    SubagentStop = 'SubagentStop',
    
    // Utility hooks
    PreCompact = 'PreCompact',
}

/**
 * Hook types - supports both commands and TypeScript functions
 */
export enum HookType {
    Command = 'command',
    Function = 'function',
    Tool = 'tool', // Special type for calling clanker tools
}

/**
 * Base hook configuration
 */
export interface HookConfig {
    type: HookType;
    timeout?: number; // Timeout in seconds
}

/**
 * Command hook configuration
 */
export interface CommandHookConfig extends HookConfig {
    type: HookType.Command;
    command: string;
}

/**
 * Function hook configuration
 */
export interface FunctionHookConfig extends HookConfig {
    type: HookType.Function;
    function: string | HookFunction; // Module path or direct function
}

/**
 * Tool hook configuration - allows tools to be called as hooks
 */
export interface ToolHookConfig extends HookConfig {
    type: HookType.Tool;
    toolId: string;
    args?: ToolArguments;
}

/**
 * Union of all hook configs
 */
export type AnyHookConfig = CommandHookConfig | FunctionHookConfig | ToolHookConfig;

/**
 * Hook matcher configuration
 */
export interface HookMatcher {
    matcher?: string; // Pattern to match (regex supported), '*' for all
    hooks: AnyHookConfig[];
}

/**
 * Hook configuration by event
 */
export type HookConfiguration = {
    [K in HookEvent]?: HookMatcher[];
};

/**
 * Common hook input data
 */
export interface HookInputBase {
    session_id: string;
    transcript_path: string;
    cwd: string;
    hook_event_name: HookEvent;
}

/**
 * PreToolUse hook input
 */
export interface PreToolUseInput extends HookInputBase {
    hook_event_name: HookEvent.PreToolUse;
    tool_name: string;
    tool_input: ToolArguments;
}

/**
 * PostToolUse hook input
 */
export interface PostToolUseInput extends HookInputBase {
    hook_event_name: HookEvent.PostToolUse;
    tool_name: string;
    tool_input: ToolArguments;
    tool_response: ToolResult;
}

/**
 * PreMessage hook input
 */
export interface PreMessageInput extends HookInputBase {
    hook_event_name: HookEvent.PreMessage;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * PostMessage hook input
 */
export interface PostMessageInput extends HookInputBase {
    hook_event_name: HookEvent.PostMessage;
    role: 'user' | 'assistant' | 'system';
    content: string;
    messageId: string;
}

/**
 * UserPromptSubmit hook input
 */
export interface UserPromptSubmitInput extends HookInputBase {
    hook_event_name: HookEvent.UserPromptSubmit;
    prompt: string;
}

/**
 * Notification hook input
 */
export interface NotificationInput extends HookInputBase {
    hook_event_name: HookEvent.Notification;
    message: string;
}

/**
 * Stop hook input
 */
export interface StopInput extends HookInputBase {
    hook_event_name: HookEvent.Stop | HookEvent.SubagentStop;
    stop_hook_active: boolean;
}

/**
 * PreCompact hook input
 */
export interface PreCompactInput extends HookInputBase {
    hook_event_name: HookEvent.PreCompact;
    trigger: 'manual' | 'auto';
    custom_instructions?: string;
}

/**
 * SessionStart hook input
 */
export interface SessionStartInput extends HookInputBase {
    hook_event_name: HookEvent.SessionStart;
    source: 'startup' | 'resume' | 'clear';
}

/**
 * Union of all hook inputs
 */
export type HookInput = 
    | PreToolUseInput 
    | PostToolUseInput 
    | PreMessageInput
    | PostMessageInput
    | UserPromptSubmitInput
    | NotificationInput
    | StopInput
    | PreCompactInput
    | SessionStartInput;

/**
 * Hook decision types
 */
export type PermissionDecision = 'allow' | 'deny' | 'ask';
export type BlockDecision = 'block' | undefined;

/**
 * Base hook output
 */
export interface HookOutputBase {
    continue?: boolean;
    stopReason?: string;
    suppressOutput?: boolean;
}

/**
 * PreToolUse specific output
 */
export interface PreToolUseOutput extends HookOutputBase {
    hookSpecificOutput?: {
        hookEventName: HookEvent.PreToolUse;
        permissionDecision?: PermissionDecision;
        permissionDecisionReason?: string;
    };
    // Deprecated but supported
    decision?: 'approve' | 'block';
    reason?: string;
}

/**
 * PostToolUse specific output
 */
export interface PostToolUseOutput extends HookOutputBase {
    decision?: BlockDecision;
    reason?: string;
}

/**
 * UserPromptSubmit specific output
 */
export interface UserPromptSubmitOutput extends HookOutputBase {
    decision?: BlockDecision;
    reason?: string;
    hookSpecificOutput?: {
        hookEventName: HookEvent.UserPromptSubmit;
        additionalContext?: string;
    };
}

/**
 * Stop specific output
 */
export interface StopOutput extends HookOutputBase {
    decision?: BlockDecision;
    reason?: string;
}

/**
 * SessionStart specific output
 */
export interface SessionStartOutput extends HookOutputBase {
    hookSpecificOutput?: {
        hookEventName: HookEvent.SessionStart;
        additionalContext?: string;
    };
}

/**
 * Enhanced hook output with AI-interpretable data
 */
export interface EnhancedHookOutput extends HookOutputBase {
    // AI-interpretable structured data that can influence behavior
    data?: any;
    
    // Suggestions for the AI to consider
    suggestions?: string[];
    
    // Modified tool arguments (for PreToolUse hooks)
    modifiedArgs?: ToolArguments;
    
    // Additional tools to execute after this one
    chainTools?: Array<{
        toolId: string;
        args: ToolArguments;
        condition?: string; // AI-evaluable condition
    }>;
    
    // Context modifications
    contextUpdates?: {
        add?: Record<string, any>;
        remove?: string[];
        modify?: Record<string, any>;
    };
    
    // Message transformations (for message hooks)
    transformedContent?: string;
    
    // Metadata to attach to results
    metadata?: Record<string, any>;
    
    // Priority level for AI consideration (0-100)
    priority?: number;
    
    // Natural language instructions for the AI
    aiInstructions?: string;
}

/**
 * Union of all hook outputs
 */
export type HookOutput = 
    | PreToolUseOutput 
    | PostToolUseOutput 
    | UserPromptSubmitOutput 
    | StopOutput 
    | SessionStartOutput
    | EnhancedHookOutput
    | HookOutputBase;

/**
 * Hook function signature
 */
export type HookFunction = (input: HookInput, context: HookContext) => Promise<HookOutput>;

/**
 * Hook execution result
 */
export interface HookExecutionResult {
    success: boolean;
    output?: HookOutput;
    error?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    // Performance metrics
    executionTime?: number;
    memoryUsed?: number;
}

/**
 * Hook context provided to hook functions
 */
export interface HookContext {
    registry: any; // Tool registry for executing tools
    logger: any; // Logger instance
    settings: any; // Settings manager
    store: any; // Access to clanker store
    
    // Hook utilities
    callTool: (toolId: string, args: ToolArguments) => Promise<ToolResult>;
    getSessionData: (key: string) => any;
    setSessionData: (key: string, value: any) => void;
    
    // Message utilities
    getAllMessages: () => any[];
    getLastMessage: (role?: string) => any;
    
    // File system utilities
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    
    // Environment info
    env: {
        projectDir: string;
        cwd: string;
        platform: string;
        sessionId: string;
    };
}

/**
 * Hook registration options
 */
export interface HookRegistrationOptions {
    // Hook metadata
    id?: string; // Optional - will be auto-generated if not provided
    name: string;
    description?: string;
    version?: string;
    
    // Hook behavior
    event: HookEvent;
    matcher?: string | RegExp | ((name: string) => boolean);
    priority?: number; // Execution order priority
    
    // Hook implementation
    handler: HookFunction | string; // Function or module path
    
    // Execution options
    timeout?: number;
    parallel?: boolean; // Can run in parallel with other hooks
    continueOnError?: boolean;
    
    // AI hints
    aiDescription?: string; // Natural language description for AI
    capabilities?: string[]; // What this hook can do
    
    // Dependencies
    requires?: string[]; // Required tools or other hooks
}

/**
 * Dynamic hook API for tools to register hooks at runtime
 */
export interface HookAPI {
    register(options: HookRegistrationOptions): string; // Returns the hook ID
    unregister(id: string): void;
    
    // Execute hooks programmatically
    execute(event: HookEvent, input: Omit<HookInput, 'hook_event_name'>): Promise<HookExecutionResult[]>;
    
    // Query hooks
    getHooks(event?: HookEvent): HookRegistrationOptions[];
    getHook(id: string): HookRegistrationOptions | undefined;
    
    // Enable/disable hooks
    enable(id: string): void;
    disable(id: string): void;
    isEnabled(id: string): boolean;
    
    // Persist hook to settings (for hooks that should survive across sessions)
    persistHook(id: string): Promise<void>;
}