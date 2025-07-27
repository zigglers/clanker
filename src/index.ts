#!/usr/bin/env node

// React imports removed - not needed for registry version
import {program} from "commander";
import * as dotenv from "dotenv";
import {GrokAgent} from "./clanker/agent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {ConfirmationService} from "./utils/confirmation-service";
import {setDebugMode, debug} from "./utils/debug-logger";
import {PackageManager} from "./package-manager";
import {store} from "./store";
import {EventEmitter} from 'events';
// Display functions no longer needed - using React components instead

// Load environment variables
dotenv.config({quiet: true});

// Increase max event listeners to prevent warnings
// This is needed because we use multiple event listeners in our UI components
EventEmitter.defaultMaxListeners = 20;

// Display functions are now handled by React components

// Load API key from user settings if not in environment
function loadApiKey(): string | undefined {
    // First check environment variables - check both for backward compatibility
    let apiKey = process.env.CLANKER_API_KEY || process.env.GROK_API_KEY;

    if (!apiKey) {
        // Try to load from user settings file
        try {
            const homeDir = os.homedir();
            // Try user-settings.json first (legacy), then settings.json
            let settingsFile = path.join(homeDir, ".clanker", "user-settings.json");
            
            if (!fs.existsSync(settingsFile)) {
                settingsFile = path.join(homeDir, ".clanker", "settings.json");
            }

            if (fs.existsSync(settingsFile)) {
                const settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
                apiKey = settings.apiKey;
            }
        } catch {
            // Ignore errors, apiKey will remain undefined
        }
    }

    return apiKey;
}

// Load base URL from user settings if not in environment
function loadBaseURL(): string | undefined {
    // First check environment variables - check both for backward compatibility
    let baseURL = process.env.CLANKER_BASE_URL || process.env.GROK_BASE_URL;

    if (!baseURL) {
        // Try to load from user settings file
        try {
            const homeDir = os.homedir();
            const settingsFile = path.join(homeDir, ".clanker", "settings.json");

            if (fs.existsSync(settingsFile)) {
                const settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
                // Support both old baseURL and new provider system
                if (settings.provider) {
                    // We'll handle provider lookup when we have the full module loaded
                    if (settings.provider === 'custom') {
                        baseURL = settings.customBaseURL;
                    } else {
                        // For now, just use a default for grok
                        baseURL = 'https://api.x.ai/v1';
                    }
                } else {
                    // Fall back to old baseURL if provider not set
                    baseURL = settings.baseURL;
                }
            }
        } catch {
            // Ignore errors, baseURL will remain undefined
        }
    }

    return baseURL;
}

// Headless mode processing function
async function processPromptHeadless(
    prompt: string,
    apiKey: string,
    baseURL?: string,
    model?: string,
    loadDynamicTools?: boolean,
    dynamicToolsPath?: string,
    watchTools?: boolean
): Promise<void> {
    try {
        const agent = new GrokAgent({
            apiKey,
            baseURL,
            model: model || process.env.GROK_MODEL || "grok-3-latest",
            loadDynamicTools,
            dynamicToolsPath,
            watchTools
        });

        // Wait for tools to load before processing
        await agent.waitForToolsToLoad();

        // Process the prompt
        const confirmationService = new ConfirmationService();
        const chunks: string[] = [];
        
        // Process response with streaming
        const stream = await agent.chat(
            [{role: "user", content: prompt}],
            "",
            true
        ) as AsyncGenerator<any, void, unknown>;

        for await (const chunk of stream) {
            switch (chunk.type) {
                case 'content':
                    if (chunk.content) {
                        process.stdout.write(chunk.content);
                        chunks.push(chunk.content);
                    }
                    break;
                case 'tool_execution_start':
                    console.log(`\n\nExecuting tool: ${chunk.toolName}`);
                    console.log("Arguments:", JSON.stringify(chunk.args, null, 2));
                    // TODO: Handle confirmation if needed
                    break;
                case 'tool_execution_result':
                    console.log(`\nTool result: ${chunk.result.success ? 'Success' : 'Failed'}`);
                    if (chunk.result.output) {
                        console.log(chunk.result.output);
                    }
                    break;
            }
        }

        console.log("\n");
    } catch (error) {
        console.error("❌ Error:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

program
    .version(packageJson.version)
    .description(packageJson.description)
    .option(
        "-k, --api-key <key>",
        "API key for Grok/LLM provider"
    )
    .option(
        "-b, --base-url <url>",
        "Base URL for API (default: https://api.x.ai/v1)"
    )
    .option(
        "-m, --model <model>",
        "Model to use (default: grok-3-latest)"
    )
    .option(
        "-p, --prompt <prompt>",
        "prompt to execute (headless mode)"
    )
    .option(
        "-y, --yes",
        "auto-confirm all operations (dangerous)"
    )
    .option(
        "-d, --debug",
        "enable debug logging"
    )
    .option(
        "--load-dynamic-tools",
        "load dynamic tools from .clanker/tools directory"
    )
    .option(
        "--tools-path <path>",
        "custom path for dynamic tools (default: .clanker/tools)"
    )
    .option(
        "--list-tools",
        "list all available tools and exit"
    )
    .option(
        "-I, --install <tool>",
        "install a tool (format: org/name or org/name@version)"
    )
    .option(
        "-U, --uninstall <tool>",
        "uninstall a tool (format: org/name)"
    )
    .option(
        "-S, --search <query>",
        "search for tools in the registry"
    )
    .option(
        "-L, --list",
        "list installed tools"
    )
    .option(
        "-A, --list-available [page]",
        "list all available tools from registry (optional page number)"
    )
    .option(
        "--page-size <size>",
        "number of tools per page (default: 20)",
        "20"
    )
    .option(
        "--update <tool>",
        "update a tool to the latest version"
    )
    .option(
        "--clear-cache",
        "clear the package manager cache"
    )
    .option(
        "-W, --watch-tools",
        "watch and reload tools from ~/.clanker/tools"
    )
    .option(
        "--publish",
        "publish your tool to the Clanker registry"
    )
    .option(
        "--add-repo <url>",
        "add a tool repository"
    )
    .option(
        "--remove-repo <name>",
        "remove a tool repository"
    )
    .option(
        "--list-repos",
        "list configured repositories"
    )
    .action(async (options) => {
        try {
            // Set debug mode if requested
            if (options.debug) {
                setDebugMode(true);
                debug.log('Debug mode enabled');
            }

            // Auto-update cache for any command (if settings allow)
            try {
                const packageManager = new PackageManager();
                await packageManager.autoUpdateCache();
            } catch (error) {
                // Silently ignore cache update errors
                debug.log('Cache auto-update failed:', error);
            }

            // Handle package manager commands first (these don't need API key)
            const packageManagerCommands = [
                'install', 'uninstall', 'search', 'list', 'listAvailable',
                'update', 'clearCache', 'addRepo', 'removeRepo', 'listRepos'
            ];

            const hasPackageManagerCommand = packageManagerCommands.some(cmd => options[cmd]);

            if (hasPackageManagerCommand) {
                const packageManager = new PackageManager();

                if (options.install) {
                    await packageManager.install(options.install);
                    return;
                }

                if (options.uninstall) {
                    await packageManager.uninstall(options.uninstall);
                    return;
                }

                if (options.search) {
                    await packageManager.search(options.search);
                    return;
                }

                if (options.list) {
                    await packageManager.listInstalled();
                    return;
                }

                if (options.listAvailable !== undefined) {
                    const page = typeof options.listAvailable === 'string' 
                        ? parseInt(options.listAvailable, 10) 
                        : 1;
                    const pageSize = parseInt(options.pageSize, 10);
                    await packageManager.listAvailable({ page, limit: pageSize });
                    return;
                }


                if (options.update) {
                    await packageManager.update(options.update);
                    return;
                }

                if (options.clearCache) {
                    await packageManager.clearCache();
                    return;
                }

                // Handle publish command
                if (options.publish) {
                    const {publishTool} = await import('./package-manager/publisher');
                    await publishTool();
                    return;
                }

                // Handle repository management commands
                if (options.addRepo) {
                    const {RepositoryManager} = await import('./package-manager/repository-manager');
                    const repoManager = new RepositoryManager();
                    await repoManager.addRepository(options.addRepo);
                    return;
                }

                if (options.removeRepo) {
                    const {RepositoryManager} = await import('./package-manager/repository-manager');
                    const repoManager = new RepositoryManager();
                    await repoManager.removeRepository(options.removeRepo);
                    return;
                }

                if (options.listRepos) {
                    const {RepositoryManager} = await import('./package-manager/repository-manager');
                    const repoManager = new RepositoryManager();
                    await repoManager.listRepositories();
                    return;
                }
            }

            // Get API key from options, environment, or user settings
            const apiKey = options.apiKey || loadApiKey();
            const baseURL = options.baseUrl || loadBaseURL();
            const model = options.model;

            // Commands that require API key
            if (options.listTools || options.prompt || !options.publish) {
                if (!apiKey) {
                    console.error(
                        "❌ Error: API key required. Set CLANKER_API_KEY environment variable, use --api-key flag, or save to ~/.clanker/user-settings.json"
                    );
                    process.exit(1);
                }
            }

            // No core tools - all tools come from registry

            // List tools mode
            if (options.listTools) {
                const agent = new GrokAgent({
                    apiKey,
                    baseURL,
                    model,
                    loadDynamicTools: options.loadDynamicTools,
                    dynamicToolsPath: options.toolsPath,
                    watchTools: options.watchTools
                });

                // Wait for tools to load
                await agent.waitForToolsToLoad();

                const registry = agent.getRegistry();
                const tools = registry.list();

                console.log("📦 Available Tools:\n");
                tools.forEach(tool => {
                    console.log(`${tool.id} - ${tool.description}`);
                    if (tool.arguments && tool.arguments.length > 0) {
                        console.log("  Arguments:");
                        tool.arguments.forEach(arg => {
                            const required = arg.required ? " (required)" : "";
                            console.log(`    - ${arg.name}: ${arg.type}${required} - ${arg.description}`);
                        });
                    }
                    console.log();
                });
                return;
            }

            // Handle prompt mode (headless)
            if (options.prompt) {
                // Set confirmation service to auto-confirm if --yes flag is provided
                if (options.yes) {
                    const confirmationService = new ConfirmationService();
                    confirmationService.setAlwaysYes(true);
                }

                await processPromptHeadless(
                    options.prompt,
                    apiKey,
                    baseURL,
                    model,
                    options.loadDynamicTools,
                    options.toolsPath,
                    options.watchTools
                );
                return;
            }

            // Interactive mode - now handled through React UI
            // Import dynamically to avoid loading React in headless mode
            const React = await import("react");
            const {render} = await import("ink");
            const {actions} = await import("./store");

            // Set up global error handler for uncaught errors
            process.on('uncaughtException', (error) => {
                console.error('Uncaught exception:', error);
                process.exit(1);
            });

            // Handle Ctrl+C gracefully
            let exitCount = 0;
            let exitTimer: NodeJS.Timeout | null = null;
            process.on('SIGINT', () => {
                if (exitCount > 0) {
                    // Second Ctrl+C, exit immediately
                    process.exit(0);
                } else {
                    // First Ctrl+C or after timeout
                    // Clear input when Ctrl+C is pressed
                    if (store.inputValue.trim()) {
                        actions.setInputValue("");
                    }
                    actions.setExitConfirmation(true);
                    setTimeout(() => actions.setExitConfirmation(false), 3000);
                }
            });

            // No core tools - all tools come from registry

            // Clear the screen before rendering
            console.clear();
            
            // Always render AppContainer - it will handle showing settings if needed
            const {AppContainer} = await import("./ui/containers/AppContainer");
            const app = render(React.createElement(AppContainer, {}));

            // Ensure we exit cleanly on unmount
            app.waitUntilExit().then(() => {
                process.exit(0);
            });
        } catch (error) {
            console.error("❌ Error initializing Grok CLI:", error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    });

// Parse arguments
program.parse(process.argv);