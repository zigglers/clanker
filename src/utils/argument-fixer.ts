/**
 * Argument Fixer Module
 * 
 * Handles malformed tool call arguments in various formats:
 * - JSON (with concatenation handling)
 * - YAML (more forgiving format)
 * - XML (structured alternative)
 * 
 * Recovery strategies:
 * 1. Try standard parsing for each format
 * 2. Split concatenated objects
 * 3. Fix common syntax errors
 * 4. Use AI assistance for complex cases
 */

import { debug } from './debug-logger';
import * as yaml from 'js-yaml';
import * as xml2js from 'xml2js';
import { GrokClient } from '../clanker/client';

export interface ArgumentFixResult {
    fixed: boolean;
    calls: ToolCallArgument[];
    originalError?: string;
    fixMethod?: 'none' | 'split' | 'syntax' | 'format-conversion' | 'ai';
    format?: 'json' | 'yaml' | 'xml';
}

export interface ToolCallArgument {
    args: Record<string, any>;
    metadata?: {
        originalFormat?: string;
        fixApplied?: string;
    };
}

/**
 * Main entry point for fixing malformed arguments
 */
export async function fixMalformedArguments(
    argString: string, 
    client?: GrokClient,
    preferredFormat?: 'json' | 'yaml' | 'xml'
): Promise<ArgumentFixResult> {
    debug.log('[ArgumentFixer] Attempting to fix malformed arguments');
    
    // Detect format if not specified
    const detectedFormat = preferredFormat || detectFormat(argString);
    debug.log(`[ArgumentFixer] Using format: ${detectedFormat}`);
    
    // Try parsing in the detected/preferred format first
    const initialResult = tryParseFormat(argString, detectedFormat);
    if (initialResult.fixed) {
        return initialResult;
    }
    
    // Try other formats
    const formats: Array<'json' | 'yaml' | 'xml'> = ['json', 'yaml', 'xml'];
    for (const format of formats) {
        if (format !== detectedFormat) {
            const result = tryParseFormat(argString, format);
            if (result.fixed) {
                return result;
            }
        }
    }
    
    // Try fixing concatenated objects (mainly for JSON)
    if (detectedFormat === 'json') {
        const concatenatedResult = tryFixConcatenatedJson(argString);
        if (concatenatedResult && concatenatedResult.fixed) {
            return concatenatedResult;
        }
    }
    
    // Try AI-assisted fixing
    if (client) {
        const aiResult = await tryAiFix(argString, client, initialResult.originalError || 'Unknown error', preferredFormat);
        if (aiResult && aiResult.fixed) {
            return aiResult;
        }
    }
    
    // All strategies failed
    return {
        fixed: false,
        calls: [],
        originalError: initialResult.originalError || 'Failed to parse arguments'
    };
}

/**
 * Detect the format of the argument string
 */
function detectFormat(argString: string): 'json' | 'yaml' | 'xml' {
    const trimmed = argString.trim();
    
    // Check for XML
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
        return 'xml';
    }
    
    // Check for JSON (starts with { or [)
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return 'json';
    }
    
    // Default to YAML (most forgiving)
    return 'yaml';
}

/**
 * Try parsing in a specific format
 */
function tryParseFormat(argString: string, format: 'json' | 'yaml' | 'xml'): ArgumentFixResult {
    switch (format) {
        case 'json':
            return tryParseJson(argString);
        case 'yaml':
            return tryParseYaml(argString);
        case 'xml':
            return tryParseXml(argString);
        default:
            return { fixed: false, calls: [] };
    }
}

/**
 * Try parsing as JSON
 */
function tryParseJson(jsonString: string): ArgumentFixResult {
    try {
        const parsed = JSON.parse(jsonString);
        const calls = Array.isArray(parsed) 
            ? parsed.map(obj => ({ args: obj }))
            : [{ args: parsed }];
            
        return {
            fixed: true,
            calls,
            fixMethod: 'none',
            format: 'json'
        };
    } catch (error) {
        return {
            fixed: false,
            calls: [],
            originalError: (error as Error).message
        };
    }
}

/**
 * Try parsing as YAML
 */
function tryParseYaml(yamlString: string): ArgumentFixResult {
    try {
        const parsed = yaml.loadAll(yamlString);
        const calls = parsed
            .filter(doc => doc != null)
            .map(doc => ({ 
                args: typeof doc === 'object' ? doc : { value: doc },
                metadata: { originalFormat: 'yaml' }
            }));
            
        if (calls.length > 0) {
            return {
                fixed: true,
                calls,
                fixMethod: 'format-conversion',
                format: 'yaml'
            };
        }
    } catch (error) {
        debug.log('[ArgumentFixer] YAML parsing failed:', error);
    }
    
    return {
        fixed: false,
        calls: [],
        originalError: 'Failed to parse as YAML'
    };
}

/**
 * Try parsing as XML
 */
function tryParseXml(xmlString: string): ArgumentFixResult {
    try {
        const parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true,
            explicitRoot: false
        });
        
        let parsed: Record<string, unknown>;
        parser.parseString(xmlString, (err, result) => {
            if (err) throw err;
            parsed = result;
        });
        
        if (parsed) {
            // Handle different XML structures
            let calls: ToolCallArgument[];
            
            if (parsed.calls && Array.isArray(parsed.calls)) {
                // Multiple calls: <calls><call>...</call><call>...</call></calls>
                calls = parsed.calls.map((call: Record<string, unknown>) => ({ 
                    args: call,
                    metadata: { originalFormat: 'xml' }
                }));
            } else if (parsed.call) {
                // Single call: <call>...</call>
                calls = [{ 
                    args: parsed.call,
                    metadata: { originalFormat: 'xml' }
                }];
            } else {
                // Direct arguments
                calls = [{ 
                    args: parsed,
                    metadata: { originalFormat: 'xml' }
                }];
            }
            
            return {
                fixed: true,
                calls,
                fixMethod: 'format-conversion',
                format: 'xml'
            };
        }
    } catch (error) {
        debug.log('[ArgumentFixer] XML parsing failed:', error);
    }
    
    return {
        fixed: false,
        calls: [],
        originalError: 'Failed to parse as XML'
    };
}

/**
 * Detect and split concatenated JSON objects
 */
function tryFixConcatenatedJson(jsonString: string): ArgumentFixResult | null {
    debug.log('[ArgumentFixer] Trying to fix concatenated JSON');
    
    // Pattern to match JSON objects
    const jsonObjectPattern = /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g;
    const matches = jsonString.match(jsonObjectPattern);
    
    if (!matches || matches.length === 0) {
        return null;
    }
    
    const calls: ToolCallArgument[] = [];
    for (const match of matches) {
        try {
            const parsed = JSON.parse(match);
            calls.push({ 
                args: parsed,
                metadata: { 
                    originalFormat: 'json',
                    fixApplied: 'split-concatenated'
                }
            });
        } catch {
            // Try fixing individual object
            const fixed = tryFixJsonSyntax(match);
            if (fixed) {
                try {
                    const parsed = JSON.parse(fixed);
                    calls.push({ 
                        args: parsed,
                        metadata: { 
                            originalFormat: 'json',
                            fixApplied: 'split-and-syntax-fix'
                        }
                    });
                } catch {
                    debug.warn('[ArgumentFixer] Skipping malformed object:', match);
                }
            }
        }
    }
    
    if (calls.length > 0) {
        debug.log(`[ArgumentFixer] Successfully split ${calls.length} concatenated objects`);
        return {
            fixed: true,
            calls,
            fixMethod: 'split',
            format: 'json'
        };
    }
    
    return null;
}

/**
 * Fix common JSON syntax errors
 */
function tryFixJsonSyntax(jsonString: string): string | null {
    let fixed = jsonString;
    
    // Fix trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix single quotes to double quotes
    fixed = fixed.replace(/'/g, '"');
    
    // Fix unquoted keys
    fixed = fixed.replace(/(\{|,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
    
    // Remove trailing content after last }
    const lastBrace = fixed.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < fixed.length - 1) {
        fixed = fixed.substring(0, lastBrace + 1);
    }
    
    // Remove comments
    fixed = fixed.replace(/\/\/.*$/gm, '');
    fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
    
    return fixed;
}

/**
 * Use AI to fix complex argument errors
 */
async function tryAiFix(
    argString: string, 
    client: GrokClient,
    originalError: string,
    preferredFormat?: 'json' | 'yaml' | 'xml'
): Promise<ArgumentFixResult | null> {
    debug.log('[ArgumentFixer] Trying AI-assisted fix');
    
    const formatInstructions = {
        json: 'Return as a JSON array if multiple calls, or a single JSON object',
        yaml: 'Return as YAML with --- separators for multiple documents',
        xml: 'Return as XML with <calls><call>...</call></calls> for multiple calls'
    };
    
    const format = preferredFormat || 'yaml'; // Default to YAML for AI
    
    const prompt = `Fix these malformed tool call arguments. The original error was: "${originalError}"

Malformed arguments:
${argString}

Instructions:
1. Parse the intended tool call arguments
2. If there are multiple tool calls, handle them appropriately
3. Fix any syntax errors
4. ${formatInstructions[format]}
5. Return ONLY the fixed arguments in ${format.toUpperCase()} format, no explanations`;

    try {
        const response = await client.chat([
            { role: 'system', content: `You are an argument repair assistant. Return only valid ${format.toUpperCase()}.` },
            { role: 'user', content: prompt }
        ]);
        
        const content = response.choices[0]?.message?.content?.trim();
        if (!content) {
            return null;
        }
        
        // Try to parse the AI's response
        const result = tryParseFormat(content, format);
        if (result.fixed) {
            return {
                ...result,
                fixMethod: 'ai'
            };
        }
        
        debug.warn(`[ArgumentFixer] AI returned invalid ${format}:`, content);
        return null;
    } catch (err) {
        debug.error('[ArgumentFixer] AI fix failed:', err);
        return null;
    }
}

/**
 * Convert arguments to a specific format for consistent handling
 */
export function convertToFormat(args: Record<string, any>, format: 'json' | 'yaml' | 'xml'): string {
    switch (format) {
        case 'json':
            return JSON.stringify(args, null, 2);
            
        case 'yaml':
            return yaml.dump(args);
            
        case 'xml': {
            const builder = new xml2js.Builder({
                rootName: 'args',
                renderOpts: { pretty: true, indent: '  ' }
            });
            return builder.buildObject(args);
        }
            
        default:
            return JSON.stringify(args);
    }
}

export interface ToolArgInfo {
    name: string;
    type: string;
    required: boolean;
}

/**
 * Extract tool info from error message
 */
export function extractToolInfo(error: string): { toolName?: string; expectedArgs?: ToolArgInfo[] } {
    const toolNameMatch = error.match(/Tool "([^"]+)" expects:/);
    const toolName = toolNameMatch ? toolNameMatch[1] : undefined;
    
    const argsMatches = [...error.matchAll(/- ([^:]+): ([^(]+)(?:\(([^)]+)\))?/g)];
    const expectedArgs = argsMatches.map(match => ({
        name: match[1].trim(),
        type: match[2].trim(),
        required: match[3]?.includes('required') ?? false
    }));
    
    return { toolName, expectedArgs: expectedArgs.length > 0 ? expectedArgs : undefined };
}