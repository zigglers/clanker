/**
 * Session Manager - Handles chat session persistence and lifecycle
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    SessionState,
    SessionData,
    SessionMetadata,
    SessionMessage,
    SessionOptions,
    SessionEvent
} from './types';
import { GrokMessage, GrokToolCall } from '../clanker/client';
import { ToolResult } from '../types';
import { HookManager } from '../hooks/hook-manager';
import { HookEvent, PreMessageInput, PostMessageInput, SessionStartInput, PreCompactInput } from '../hooks/types';
import {debug} from '../utils/debug-logger';

export class SessionManager extends EventEmitter {
    private state: SessionState;
    private options: SessionOptions;
    private sessionsDir: string;
    private autoSaveTimer?: NodeJS.Timeout;
    private hookManager: HookManager;
    private isDirty: boolean = false;

    constructor(hookManager: HookManager, options: SessionOptions = {}) {
        super();
        this.hookManager = hookManager;
        this.options = {
            autoSave: true,
            autoSaveInterval: 30000, // 30 seconds
            maxMessages: 1000,
            compactThreshold: 500,
            ...options
        };

        // Initialize session directory
        this.sessionsDir = path.join(os.homedir(), '.clanker', 'sessions');
        
        // Initialize session state
        const sessionId = options.id || uuidv4();
        this.state = {
            metadata: {
                id: sessionId,
                created: new Date(),
                updated: new Date(),
                title: options.title,
                projectPath: process.cwd()
            },
            messages: [],
            toolCalls: new Map(),
            toolResults: new Map(),
            context: {},
            hookData: {}
        };

        this.setupAutoSave();
        this.emit(SessionEvent.Created, this.state.metadata);
    }

    /**
     * Get session ID
     */
    getId(): string {
        return this.state.metadata.id;
    }

    /**
     * Get session metadata
     */
    getMetadata(): SessionMetadata {
        return { ...this.state.metadata };
    }

    /**
     * Update session metadata
     */
    updateMetadata(updates: Partial<SessionMetadata>): void {
        this.state.metadata = {
            ...this.state.metadata,
            ...updates,
            updated: new Date()
        };
        this.markDirty();
    }

    /**
     * Add a message to the session
     */
    async addMessage(message: GrokMessage, metadata?: Record<string, any>): Promise<SessionMessage> {
        const sessionMessage: SessionMessage = {
            id: uuidv4(),
            timestamp: new Date(),
            role: message.role,
            content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
            tool_calls: 'tool_calls' in message ? message.tool_calls : undefined,
            tool_call_id: 'tool_call_id' in message ? message.tool_call_id : undefined,
            metadata
        };

        // Execute PreMessage hooks
        const preMessageInput: Omit<PreMessageInput, 'hook_event_name'> = {
            session_id: this.state.metadata.id,
            transcript_path: '',
            cwd: process.cwd(),
            role: message.role as any,
            content: sessionMessage.content || ''
        };
        const hookResults = await this.hookManager.execute(HookEvent.PreMessage, preMessageInput);

        // Process hook results
        for (const result of hookResults) {
            if (result.output && 'transformedContent' in result.output) {
                sessionMessage.content = result.output.transformedContent || sessionMessage.content;
            }
            if (result.output && 'data' in result.output) {
                sessionMessage.hookResults = sessionMessage.hookResults || [];
                sessionMessage.hookResults.push(result.output.data);
            }
        }

        // Add to messages
        this.state.messages.push(sessionMessage);
        this.markDirty();

        // Check if compaction needed
        if (this.state.messages.length >= this.options.compactThreshold!) {
            await this.compact();
        }

        // Execute PostMessage hooks
        const postMessageInput: Omit<PostMessageInput, 'hook_event_name'> = {
            session_id: this.state.metadata.id,
            transcript_path: '',
            cwd: process.cwd(),
            role: message.role as any,
            content: sessionMessage.content || '',
            messageId: sessionMessage.id
        };
        await this.hookManager.execute(HookEvent.PostMessage, postMessageInput);

        this.emit(SessionEvent.MessageAdded, sessionMessage);
        return sessionMessage;
    }

    /**
     * Add tool call and result
     */
    async addToolExecution(toolCall: GrokToolCall, result: ToolResult): Promise<void> {
        this.state.toolCalls.set(toolCall.id, toolCall);
        this.state.toolResults.set(toolCall.id, result);
        this.markDirty();
        this.emit(SessionEvent.ToolExecuted, { toolCall, result });
    }

    /**
     * Get all messages
     */
    getMessages(): SessionMessage[] {
        return [...this.state.messages];
    }

    /**
     * Get messages by role
     */
    getMessagesByRole(role: string): SessionMessage[] {
        return this.state.messages.filter(m => m.role === role);
    }

    /**
     * Get last N messages
     */
    getLastMessages(n: number): SessionMessage[] {
        return this.state.messages.slice(-n);
    }

    /**
     * Update session context
     */
    updateContext(key: string, value: any): void {
        this.state.context[key] = value;
        this.markDirty();
        this.emit(SessionEvent.ContextUpdated, { key, value });
    }

    /**
     * Get session context
     */
    getContext(key?: string): any {
        return key ? this.state.context[key] : { ...this.state.context };
    }

    /**
     * Update hook data
     */
    updateHookData(hookId: string, data: any): void {
        this.state.hookData[hookId] = data;
        this.markDirty();
    }

    /**
     * Get hook data
     */
    getHookData(hookId?: string): any {
        return hookId ? this.state.hookData[hookId] : { ...this.state.hookData };
    }

    /**
     * Save session to disk
     */
    async save(): Promise<void> {
        const sessionData: SessionData = {
            version: '1.0',
            metadata: this.state.metadata,
            messages: this.state.messages,
            toolCalls: Array.from(this.state.toolCalls.entries()),
            toolResults: Array.from(this.state.toolResults.entries()),
            context: this.state.context,
            hookData: this.state.hookData
        };

        const sessionPath = path.join(this.sessionsDir, `${this.state.metadata.id}.json`);
        await fs.mkdir(this.sessionsDir, { recursive: true });
        await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
        
        this.isDirty = false;
        this.emit(SessionEvent.Saved, sessionPath);
        debug.log(`[SessionManager] Saved session to ${sessionPath}`);
    }

    /**
     * Load session from disk
     */
    static async load(sessionId: string, hookManager: HookManager): Promise<SessionManager> {
        const sessionsDir = path.join(os.homedir(), '.clanker', 'sessions');
        const sessionPath = path.join(sessionsDir, `${sessionId}.json`);
        
        const data = await fs.readFile(sessionPath, 'utf-8');
        const sessionData: SessionData = JSON.parse(data);

        const manager = new SessionManager(hookManager, {
            id: sessionData.metadata.id,
            title: sessionData.metadata.title
        });

        // Restore state
        manager.state = {
            metadata: sessionData.metadata,
            messages: sessionData.messages,
            toolCalls: new Map(sessionData.toolCalls),
            toolResults: new Map(sessionData.toolResults),
            context: sessionData.context,
            hookData: sessionData.hookData
        };

        // Execute SessionStart hooks
        const sessionStartInput: Omit<SessionStartInput, 'hook_event_name'> = {
            session_id: sessionData.metadata.id,
            transcript_path: '',
            cwd: process.cwd(),
            source: 'resume' as const
        };
        await hookManager.execute(HookEvent.SessionStart, sessionStartInput);

        manager.emit(SessionEvent.Loaded, sessionData.metadata);
        debug.log(`[SessionManager] Loaded session from ${sessionPath}`);
        
        return manager;
    }

    /**
     * List available sessions
     */
    static async listSessions(): Promise<SessionMetadata[]> {
        const sessionsDir = path.join(os.homedir(), '.clanker', 'sessions');
        
        try {
            await fs.mkdir(sessionsDir, { recursive: true });
            const files = await fs.readdir(sessionsDir);
            const sessions: SessionMetadata[] = [];

            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const data = await fs.readFile(path.join(sessionsDir, file), 'utf-8');
                        const sessionData: SessionData = JSON.parse(data);
                        sessions.push(sessionData.metadata);
                    } catch (error) {
                        debug.error(`[SessionManager] Failed to load session ${file}:`, error);
                    }
                }
            }

            return sessions.sort((a, b) => 
                new Date(b.updated).getTime() - new Date(a.updated).getTime()
            );
        } catch (error) {
            debug.error('[SessionManager] Failed to list sessions:', error);
            return [];
        }
    }

    /**
     * Export session as JSONL transcript
     */
    async exportTranscript(outputPath?: string): Promise<string> {
        const transcriptPath = outputPath || path.join(
            this.sessionsDir, 
            'transcripts',
            `${this.state.metadata.id}.jsonl`
        );

        await fs.mkdir(path.dirname(transcriptPath), { recursive: true });

        const lines = this.state.messages.map(msg => 
            JSON.stringify({
                timestamp: msg.timestamp,
                role: msg.role,
                content: msg.content,
                tool_calls: msg.tool_calls,
                metadata: msg.metadata,
                hookResults: msg.hookResults
            })
        );

        await fs.writeFile(transcriptPath, lines.join('\n'));
        return transcriptPath;
    }

    /**
     * Compact session by summarizing old messages
     */
    private async compact(): Promise<void> {
        // Execute PreCompact hooks
        const preCompactInput: Omit<PreCompactInput, 'hook_event_name'> = {
            session_id: this.state.metadata.id,
            transcript_path: '',
            cwd: process.cwd(),
            trigger: 'auto' as const,
            custom_instructions: ''
        };
        const hookResults = await this.hookManager.execute(HookEvent.PreCompact, preCompactInput);

        // Check if any hook blocked compaction
        const shouldContinue = hookResults.every(r => 
            !r.output || r.output.continue !== false
        );

        if (!shouldContinue) {
            debug.log('[SessionManager] Compaction blocked by hook');
            return;
        }

        // TODO: Implement actual compaction logic
        // For now, just keep the last N messages
        const keepMessages = Math.floor(this.options.maxMessages! * 0.8);
        if (this.state.messages.length > keepMessages) {
            this.state.messages = this.state.messages.slice(-keepMessages);
            this.markDirty();
        }
    }

    /**
     * Mark session as dirty (needs saving)
     */
    private markDirty(): void {
        this.isDirty = true;
        this.state.metadata.updated = new Date();
    }

    /**
     * Setup auto-save
     */
    private setupAutoSave(): void {
        if (this.options.autoSave) {
            this.autoSaveTimer = setInterval(async () => {
                if (this.isDirty) {
                    try {
                        await this.save();
                    } catch (error) {
                        debug.error('[SessionManager] Auto-save failed:', error);
                    }
                }
            }, this.options.autoSaveInterval);
        }
    }

    /**
     * Close session
     */
    async close(): Promise<void> {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        if (this.isDirty) {
            await this.save();
        }

        this.emit(SessionEvent.Closed, this.state.metadata);
    }
}