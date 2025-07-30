/**
 * Prompt Preprocessor
 * 
 * Detects patterns that might cause Grok to generate multiple tool calls
 * and modifies the prompt to avoid server-side JSON validation errors
 */

import { debug } from './debug-logger';

export interface PreprocessResult {
    modified: boolean;
    prompt: string;
    strategy?: 'sequential' | 'single' | 'none';
    metadata?: {
        detectedPattern?: string;
        toolCallCount?: number;
    };
}

/**
 * Patterns that suggest multiple tool calls
 */
const MULTI_TOOL_PATTERNS = [
    // Multiple voices mentioned
    /\b(voice|speak|say).*(and|then|after|followed by|back and forth).*(voice|speak|say)/i,
    // Conversation patterns
    /\b(conversation|discuss|talk|dialogue|back and forth)/i,
    // Multiple named entities with TTS context
    /\b(clanker|rachael|rachel|adam|sarah|bill|george).*(and|with|to).*(clanker|rachael|rachel|adam|sarah|bill|george)/i,
    // Explicit multiple TTS mentions
    /\b(tts|text.?to.?speech|elevenlabs).*(multiple|several|different|various)/i,
    // Sequential action words
    /\b(first|then|next|after that|followed by|finally).*(speak|say|voice)/i,
];

/**
 * Preprocess a prompt to avoid multi-tool call issues
 */
export function preprocessPrompt(originalPrompt: string): PreprocessResult {
    debug.log('[PromptPreprocessor] Analyzing prompt for multi-tool patterns');
    
    // Check if this is likely to trigger multiple tool calls
    let detectedPattern: string | undefined;
    for (const pattern of MULTI_TOOL_PATTERNS) {
        if (pattern.test(originalPrompt)) {
            detectedPattern = pattern.source;
            debug.log(`[PromptPreprocessor] Detected multi-tool pattern: ${pattern.source}`);
            break;
        }
    }
    
    if (!detectedPattern) {
        return {
            modified: false,
            prompt: originalPrompt,
            strategy: 'none'
        };
    }
    
    // Check if TTS/ElevenLabs is mentioned
    const isTTSRelated = /\b(tts|text.?to.?speech|elevenlabs|speak|voice)/i.test(originalPrompt);
    
    if (!isTTSRelated) {
        // Not TTS related, don't modify
        return {
            modified: false,
            prompt: originalPrompt,
            strategy: 'none'
        };
    }
    
    // Modify the prompt to encourage sequential single calls
    const modifiedPrompt = `${originalPrompt}

IMPORTANT: Due to technical constraints, please execute each text-to-speech request as a SINGLE tool call. After each TTS call completes, continue with the next one. Do NOT combine multiple TTS requests into a single response. Each voice/speaker change requires a separate tool call.`;
    
    debug.log('[PromptPreprocessor] Modified prompt to encourage sequential single calls');
    
    return {
        modified: true,
        prompt: modifiedPrompt,
        strategy: 'sequential',
        metadata: {
            detectedPattern,
            toolCallCount: estimateToolCallCount(originalPrompt)
        }
    };
}

/**
 * Estimate how many tool calls might be generated
 */
function estimateToolCallCount(prompt: string): number {
    // Count voice/speaker mentions
    const voiceMatches = prompt.match(/\b(clanker|rachael|rachel|adam|sarah|bill|george|voice|speaker)\b/gi);
    const uniqueVoices = new Set(voiceMatches?.map(v => v.toLowerCase()) || []);
    
    // Count sequential markers
    const sequentialMarkers = prompt.match(/\b(first|then|next|after|followed by|finally)\b/gi);
    
    return Math.max(uniqueVoices.size, sequentialMarkers?.length || 1);
}

/**
 * Post-process a system prompt to add multi-tool guidance
 */
export function enhanceSystemPrompt(systemPrompt: string, userPrompt: string): string {
    const preprocessResult = preprocessPrompt(userPrompt);
    
    if (!preprocessResult.modified) {
        return systemPrompt;
    }
    
    // Add guidance to system prompt
    const enhancement = `

When using text-to-speech tools:
- Make ONE tool call at a time
- Wait for each call to complete before making the next
- Do not generate multiple tool calls in a single response
- Each voice/speaker change requires a separate interaction`;
    
    return systemPrompt + enhancement;
}