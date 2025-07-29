/**
 * Session management types
 */

import { GrokMessage, GrokToolCall } from '../clanker/client';
import { ToolResult } from '../types';

/**
 * Session metadata
 */
export interface SessionMetadata {
    id: string;
    created: Date;
    updated: Date;
    title?: string;
    description?: string;
    tags?: string[];
    projectPath?: string;
    model?: string;
    provider?: string;
}

/**
 * Session message with additional metadata
 */
export interface SessionMessage {
    id: string;
    timestamp: Date;
    role: string;
    content?: string;
    tool_calls?: GrokToolCall[];
    tool_call_id?: string;
    tokenCount?: number;
    metadata?: Record<string, any>;
    hookResults?: any[]; // Results from hooks that ran on this message
}

/**
 * Session state
 */
export interface SessionState {
    metadata: SessionMetadata;
    messages: SessionMessage[];
    toolCalls: Map<string, GrokToolCall>;
    toolResults: Map<string, ToolResult>;
    context: Record<string, any>; // Session-specific context
    hookData: Record<string, any>; // Hook-specific session data
}

/**
 * Session persistence format
 */
export interface SessionData {
    version: string;
    metadata: SessionMetadata;
    messages: SessionMessage[];
    toolCalls: Array<[string, GrokToolCall]>;
    toolResults: Array<[string, ToolResult]>;
    context: Record<string, any>;
    hookData: Record<string, any>;
}

/**
 * Session events
 */
export enum SessionEvent {
    Created = 'created',
    Loaded = 'loaded',
    Saved = 'saved',
    MessageAdded = 'messageAdded',
    ToolExecuted = 'toolExecuted',
    HookExecuted = 'hookExecuted',
    ContextUpdated = 'contextUpdated',
    Closed = 'closed',
}

/**
 * Session options
 */
export interface SessionOptions {
    id?: string;
    title?: string;
    autoSave?: boolean;
    autoSaveInterval?: number; // ms
    maxMessages?: number;
    compactThreshold?: number; // Compact when this many messages
}