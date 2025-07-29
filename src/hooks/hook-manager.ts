/* eslint-disable */
/**
 * Hook Manager - Core implementation of the hook system
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
    HookEvent, 
    HookConfiguration, 
    HookInput, 
    HookOutput,
    HookExecutionResult,
    HookContext,
    HookAPI,
    HookRegistrationOptions,
    AnyHookConfig,
    HookType,
    CommandHookConfig,
    FunctionHookConfig,
    ToolHookConfig,
    HookFunction,
    HookMatcher
} from './types';
import { ToolRegistry } from '../registry';
import { SettingsManager } from '../utils/settings-manager';
import { store } from '../store';
import {debug} from '../utils/debug-logger';
import { v4 as uuidv4 } from 'uuid';

export class HookManager implements HookAPI {
    private static instance: HookManager;
    private hooks: Map<string, HookRegistrationOptions> = new Map();
    private configHooks: HookConfiguration = {};
    private enabledHooks: Set<string> = new Set();
    private registry: ToolRegistry;
    private settings: SettingsManager;
    private sessionData: Map<string, any> = new Map();
    private sessionId: string;

    private constructor(registry: ToolRegistry) {
        this.registry = registry;
        this.settings = SettingsManager.getInstance();
        this.sessionId = uuidv4();
        this.loadHooksFromSettings();
    }

    static getInstance(registry: ToolRegistry): HookManager {
        if (!HookManager.instance) {
            HookManager.instance = new HookManager(registry);
        }
        return HookManager.instance;
    }

    /**
     * Load hooks from settings files
     */
    private loadHooksFromSettings() {
        try {
            // Load from user settings
            const userSettingsPath = path.join(os.homedir(), '.clanker', 'settings.json');
            if (fs.existsSync(userSettingsPath)) {
                const userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf-8'));
                if (userSettings.hooks) {
                    this.mergeHookConfiguration(userSettings.hooks);
                }
            }

            // Load from project settings
            const projectSettingsPath = path.join(process.cwd(), '.clanker', 'settings.json');
            if (fs.existsSync(projectSettingsPath)) {
                const projectSettings = JSON.parse(fs.readFileSync(projectSettingsPath, 'utf-8'));
                if (projectSettings.hooks) {
                    this.mergeHookConfiguration(projectSettings.hooks);
                }
            }

            // Load from local project settings (highest priority)
            const localSettingsPath = path.join(process.cwd(), '.clanker', 'settings.local.json');
            if (fs.existsSync(localSettingsPath)) {
                const localSettings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf-8'));
                if (localSettings.hooks) {
                    this.mergeHookConfiguration(localSettings.hooks);
                }
            }

            debug.log('[HookManager] Loaded hooks from settings files');
        } catch (error) {
            debug.error('[HookManager] Failed to load hooks from settings:', error);
        }
    }

    /**
     * Merge hook configuration from settings
     */
    private mergeHookConfiguration(hooks: HookConfiguration) {
        for (const [event, matchers] of Object.entries(hooks)) {
            if (!this.configHooks[event as HookEvent]) {
                this.configHooks[event as HookEvent] = [];
            }
            this.configHooks[event as HookEvent]!.push(...matchers);
        }
    }

    /**
     * Register a hook dynamically
     */
    register(options: HookRegistrationOptions): string {
        // Generate ID if not provided
        const hookId = options.id || `hook_${options.event}_${uuidv4().substring(0, 8)}`;
        const optionsWithId = { ...options, id: hookId };
        
        this.hooks.set(hookId, optionsWithId);
        this.enabledHooks.add(hookId);
        debug.log(`[HookManager] Registered hook: ${hookId} for event ${options.event}`);
        return hookId;
    }

    /**
     * Unregister a hook
     */
    unregister(id: string): void {
        this.hooks.delete(id);
        this.enabledHooks.delete(id);
        debug.log(`[HookManager] Unregistered hook: ${id}`);
    }

    /**
     * Execute hooks for an event
     */
    async execute(event: HookEvent, input: Omit<HookInput, 'hook_event_name'>): Promise<HookExecutionResult[]> {
        const fullInput: HookInput = {
            ...input,
            hook_event_name: event,
            session_id: this.sessionId,
            transcript_path: this.getTranscriptPath(),
            cwd: process.cwd()
        } as HookInput;

        const results: HookExecutionResult[] = [];

        // Execute configuration-based hooks
        const configMatchers = this.configHooks[event] || [];
        for (const matcher of configMatchers) {
            if (this.matchesPattern(matcher.matcher, input)) {
                const matcherResults = await this.executeHookMatcher(matcher, fullInput);
                results.push(...matcherResults);
            }
        }

        // Execute dynamically registered hooks
        const dynamicHooks = Array.from(this.hooks.values())
            .filter(hook => hook.event === event && this.enabledHooks.has(hook.id))
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        for (const hook of dynamicHooks) {
            if (this.matchesPattern(hook.matcher, input)) {
                const result = await this.executeHook(hook, fullInput);
                results.push(result);
            }
        }

        return results;
    }

    /**
     * Check if input matches hook pattern
     */
    private matchesPattern(pattern: string | RegExp | ((name: string) => boolean) | undefined, input: any): boolean {
        // No pattern means match all
        if (!pattern || pattern === '*' || pattern === '') {
            return true;
        }

        // Extract the name to match against (tool name for tool hooks, etc.)
        const name = input.tool_name || input.role || '';

        if (typeof pattern === 'function') {
            return pattern(name);
        } else if (pattern instanceof RegExp) {
            return pattern.test(name);
        } else if (typeof pattern === 'string') {
            // Support simple regex patterns in strings
            try {
                const regex = new RegExp(pattern);
                return regex.test(name);
            } catch {
                // Fall back to exact match
                return name === pattern;
            }
        }

        return false;
    }

    /**
     * Execute a hook matcher (from configuration)
     */
    private async executeHookMatcher(matcher: HookMatcher, input: HookInput): Promise<HookExecutionResult[]> {
        const results: HookExecutionResult[] = [];
        const parallelHooks = matcher.hooks.filter(h => h.type !== HookType.Function || (h as any).parallel !== false);
        const sequentialHooks = matcher.hooks.filter(h => h.type === HookType.Function && (h as any).parallel === false);

        // Execute parallel hooks
        if (parallelHooks.length > 0) {
            const parallelPromises = parallelHooks.map(hookConfig => this.executeHookConfig(hookConfig, input));
            const parallelResults = await Promise.all(parallelPromises);
            results.push(...parallelResults);
        }

        // Execute sequential hooks
        for (const hookConfig of sequentialHooks) {
            const result = await this.executeHookConfig(hookConfig, input);
            results.push(result);
        }

        return results;
    }

    /**
     * Execute a single hook configuration
     */
    private async executeHookConfig(config: AnyHookConfig, input: HookInput): Promise<HookExecutionResult> {
        const startTime = Date.now();

        try {
            switch (config.type) {
                case HookType.Command:
                    return await this.executeCommandHook(config as CommandHookConfig, input);
                case HookType.Function:
                    return await this.executeFunctionHook(config as FunctionHookConfig, input);
                case HookType.Tool:
                    return await this.executeToolHook(config as ToolHookConfig, input);
                default:
                    return {
                        success: false,
                        error: `Unknown hook type: ${(config as any).type}`
                    };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                executionTime: Date.now() - startTime
            };
        }
    }

    /**
     * Execute a command hook
     */
    private async executeCommandHook(config: CommandHookConfig, input: HookInput): Promise<HookExecutionResult> {
        const timeout = (config.timeout || 60) * 1000;
        const env = {
            ...process.env,
            CLAUDE_PROJECT_DIR: process.cwd()
        };

        try {
            // Create a child process to pipe input to stdin
            const child = exec(config.command, {
                timeout,
                env
            });
            
            // Write input to stdin
            if (child.stdin) {
                child.stdin.write(JSON.stringify(input));
                child.stdin.end();
            }
            
            // Wait for result
            const result = await new Promise<{stdout: string, stderr: string}>((resolve, reject) => {
                let stdout = '';
                let stderr = '';
                
                child.stdout?.on('data', data => stdout += data);
                child.stderr?.on('data', data => stderr += data);
                
                child.on('error', reject);
                child.on('exit', (code) => {
                    if (code === 0) {
                        resolve({ stdout, stderr });
                    } else {
                        const error: any = new Error(`Command exited with code ${code}`);
                        error.code = code;
                        error.stdout = stdout;
                        error.stderr = stderr;
                        reject(error);
                    }
                });
            });

            // Parse output
            const output = this.parseHookOutput(result.stdout, result.stderr, 0);
            
            return {
                success: true,
                output,
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: 0
            };
        } catch (error: any) {
            const exitCode = error.code || 1;
            const output = this.parseHookOutput(error.stdout || '', error.stderr || '', exitCode);
            
            return {
                success: exitCode === 0,
                output,
                stdout: error.stdout,
                stderr: error.stderr,
                exitCode,
                error: error.message
            };
        }
    }

    /**
     * Execute a function hook
     */
    private async executeFunctionHook(config: FunctionHookConfig, input: HookInput): Promise<HookExecutionResult> {
        const context = this.createHookContext();

        try {
            let hookFunction: HookFunction;

            if (typeof config.function === 'string') {
                // Load function from module
                const modulePath = path.resolve(config.function);
                const module = require(modulePath);
                hookFunction = module.default || module;
            } else {
                hookFunction = config.function;
            }

            const timeout = (config.timeout || 60) * 1000;
            const timeoutPromise = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Hook timeout')), timeout)
            );

            const output = await Promise.race([
                hookFunction(input, context),
                timeoutPromise
            ]);

            return {
                success: true,
                output
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Execute a tool hook
     */
    private async executeToolHook(config: ToolHookConfig, input: HookInput): Promise<HookExecutionResult> {
        try {
            // Merge configured args with dynamic args from input
            const args = {
                ...config.args,
                hookInput: input
            };

            const result = await this.registry.execute(config.toolId, args);

            return {
                success: result.success,
                output: {
                    data: result,
                    metadata: {
                        toolId: config.toolId,
                        toolResult: result
                    }
                },
                error: result.error
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Execute a dynamically registered hook
     */
    private async executeHook(hook: HookRegistrationOptions, input: HookInput): Promise<HookExecutionResult> {
        if (typeof hook.handler === 'function') {
            return this.executeFunctionHook({
                type: HookType.Function,
                function: hook.handler,
                timeout: hook.timeout
            }, input);
        } else {
            // Load from module path
            return this.executeFunctionHook({
                type: HookType.Function,
                function: hook.handler,
                timeout: hook.timeout
            }, input);
        }
    }

    /**
     * Parse hook output from stdout/stderr
     */
    private parseHookOutput(stdout: string, stderr: string, exitCode: number): HookOutput {
        // Try to parse JSON output from stdout
        if (stdout) {
            try {
                return JSON.parse(stdout);
            } catch {
                // Not JSON, treat as simple output
            }
        }

        // Handle exit code 2 (blocking error)
        if (exitCode === 2) {
            return {
                continue: false,
                stopReason: stderr || 'Hook blocked execution'
            };
        }

        // Default output
        return {
            continue: exitCode === 0,
            stopReason: exitCode !== 0 ? stderr : undefined
        };
    }

    /**
     * Create hook context
     */
    private createHookContext(): HookContext {
        return {
            registry: this.registry,
            logger: debug,
            settings: this.settings,
            store,
            
            // Utilities
            callTool: async (toolId, args) => this.registry.execute(toolId, args),
            getSessionData: (key) => this.sessionData.get(key),
            setSessionData: (key, value) => this.sessionData.set(key, value),
            
            // Message utilities
            getAllMessages: () => store.messages,
            getLastMessage: (role) => {
                const messages = role 
                    ? store.messages.filter(m => m.role === role)
                    : store.messages;
                return messages[messages.length - 1];
            },
            
            // File utilities
            readFile: async (path) => fs.promises.readFile(path, 'utf-8'),
            writeFile: async (path, content) => fs.promises.writeFile(path, content),
            
            // Environment
            env: {
                projectDir: process.cwd(),
                cwd: process.cwd(),
                platform: os.platform(),
                sessionId: this.sessionId
            }
        };
    }

    /**
     * Get transcript path
     */
    private getTranscriptPath(): string {
        // TODO: Implement actual transcript path logic
        return path.join(os.homedir(), '.clanker', 'transcripts', `${this.sessionId}.jsonl`);
    }

    // API Methods
    getHooks(event?: HookEvent): HookRegistrationOptions[] {
        return Array.from(this.hooks.values())
            .filter(hook => !event || hook.event === event);
    }

    getHook(id: string): HookRegistrationOptions | undefined {
        return this.hooks.get(id);
    }

    enable(id: string): void {
        this.enabledHooks.add(id);
    }

    disable(id: string): void {
        this.enabledHooks.delete(id);
    }

    isEnabled(id: string): boolean {
        return this.enabledHooks.has(id);
    }

    /**
     * Persist a hook to settings so it survives across sessions
     */
    async persistHook(id: string): Promise<void> {
        const hook = this.hooks.get(id);
        if (!hook) {
            throw new Error(`Hook ${id} not found`);
        }

        // Only persist function hooks with string handlers (module paths)
        if (typeof hook.handler !== 'string') {
            throw new Error('Only hooks with module paths can be persisted');
        }

        // Create a hook configuration for settings
        const hookConfig: FunctionHookConfig = {
            type: HookType.Function,
            function: hook.handler,
            timeout: hook.timeout
        };

        // Create a matcher for this hook
        const matcher: HookMatcher = {
            matcher: typeof hook.matcher === 'string' ? hook.matcher : (hook.matcher?.toString() || '*'),
            hooks: [hookConfig]
        };

        // Load current settings
        const userSettingsPath = path.join(os.homedir(), '.clanker', 'settings.json');
        let settings: any = {};
        
        try {
            if (fs.existsSync(userSettingsPath)) {
                settings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf-8'));
            }
        } catch (error) {
            debug.error('[HookManager] Failed to load settings for persistence:', error);
        }

        // Initialize hooks section if needed
        if (!settings.hooks) {
            settings.hooks = {};
        }
        if (!settings.hooks[hook.event]) {
            settings.hooks[hook.event] = [];
        }

        // Add the hook configuration
        settings.hooks[hook.event].push(matcher);

        // Save settings
        try {
            await fs.promises.mkdir(path.dirname(userSettingsPath), { recursive: true });
            await fs.promises.writeFile(userSettingsPath, JSON.stringify(settings, null, 2));
            debug.log(`[HookManager] Persisted hook ${id} to settings`);
        } catch (error) {
            debug.error('[HookManager] Failed to persist hook:', error);
            throw new Error(`Failed to persist hook: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}