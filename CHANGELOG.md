# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.8] - 2025-08-31

### Added
- Added support for grok-code-fast-1 model across all configurations
- Set grok-code-fast-1 as the default model for improved code performance
- Updated model selection dropdowns in settings and commands
- Maintained backward compatibility with all existing models

## [0.5.7] - 2025-08-25

### Added
- Support for multi-file tool installations
- Package manager now downloads additional files (package.json, manifest.yml) along with index.js
- Automatic npm dependency installation for tools with package.json
- Tools with npm dependencies now work seamlessly out of the box

### Fixed
- Fixed tools with npm dependencies failing to load
- Fixed package.json files not being downloaded from registry
- Improved dependency installation process with better error handling
## [0.5.6] - 2025-08-25

### Fixed
- Fixed upgrade command failing with npm bin -g error on npm v9+
- Updated to use npm prefix -g for compatibility with newer npm versions
- Improved error handling during npm migration process

## [0.5.5] - 2025-08-25

### Added
- Added automatic npm dependency installation for tools at runtime
- Tools with package.json dependencies are now automatically installed on first load
- Improved tool loading resilience with non-blocking dependency installation

## [0.5.4] - 2025-08-25

### Fixed
- Fixed upgrade command failing with ENOTEMPTY error when target directory exists
- Improved migration handling from npm to GitHub-based installation
- Added proper cleanup of existing directories during upgrade

## [0.5.3] - 2025-08-25

### Added
- Added automatic npm dependency installation for tools during installation
- Support for extracting full tar.gz archives (not just index.js) 
- Detection and installation of npm dependencies from package.json
- Improved tool extraction logic for complex tool packages

## [0.5.1] - 2025-08-25

### Added
- Added arrow key navigation for cursor movement in input box
- Added Cmd+Left/Right (Mac) and Home/End shortcuts to jump to start/end of line
- Added Ctrl+Left/Right shortcuts to jump by word boundaries
- Improved cursor display with inverse character highlighting
- Fixed backspace to delete at cursor position instead of always at end

## [0.5.0] - 2025-08-25

### Added
- Added interactive configuration wizard for first-time setup
- Implemented provider-specific API key validation
- Added smart tool recommendation system based on user preferences
- Improved onboarding experience with step-by-step guidance

## [0.4.0] - 2025-08-06

### Added
- **GitHub-Based Self-Updates**: Replaced npm updates with direct GitHub source builds
  - `clanker upgrade` now downloads from GitHub releases instead of npm
  - Builds and installs locally to `~/.clanker/cli`
  - Support for `--force` flag to force updates
  - Support for `--source` flag to install from local development
  - Automatic migration from npm-installed versions

- **Private Repository Support**: Full GitHub CLI authentication for private registries
  - New `github-auth.ts` module for GitHub CLI integration
  - Automatic detection and use of `gh` CLI for authentication
  - Support for private tool registries
  - Fallback mechanisms for public repositories
  - Token retrieval from GitHub CLI or environment variables

- **Multiple Upstream Registries**: Enhanced repository management
  - Waterfall/cascade resolution for tool discovery
  - Priority ordering (first matching tool wins)
  - Commands: `add-repo`, `remove-repo`, `list-repos`
  - Support for both public and private repositories

### Changed
- **Repository Organization**: Moved infrastructure to zigglers organization
  - Clanker core moved to https://github.com/zigglers/clanker
  - Template repository at https://github.com/zigglers/clanker-registry-template
  - Tools remain under ziggle-dev namespace

- **Upgrade Command**: Complete overhaul of self-update mechanism
  - No longer depends on npm registry
  - Downloads directly from GitHub releases
  - Builds from source locally
  - Installs to `~/.clanker/cli` instead of npm global

### Fixed
- Registry client now properly authenticates with private repositories
- Tool installation from private registries works seamlessly
- Cache clearing properly removes registry cache

### Developer Notes
- This is a major architectural change moving away from npm distribution
- Users can now host completely private tool ecosystems
- GitHub CLI (`gh`) is now recommended for private repository access
- The template repository enables decentralized tool management

## [0.3.64] - 2025-07-31

### Added
- **Shared State API Key**: Tools can now access Clanker's API key through shared state
  - API key is automatically shared when GrokAgent is initialized
  - Tools can access via `context.sharedState.get('clanker:apiKey')`
  - Provider and base URL are also shared for tool compatibility
  - Enables seamless integration for tools that need the same API access

### Developer Notes
- This change allows tools like web-search to use the same X AI API key without requiring duplicate configuration
- Maintains security by only sharing with tools that have explicit access to the context
- Part of the philosophy to make tools work seamlessly within the Clanker ecosystem

## [0.3.61] - 2025-07-30

### Added
- **Prompt Preprocessor**: Smart detection and mitigation for multi-tool call scenarios
  - Detects patterns that would trigger multiple TTS tool calls
  - Automatically modifies prompts to encourage sequential single calls
  - Prevents Grok API "trailing characters" JSON validation errors
  - Pattern detection for conversations, multiple voices, and sequential actions

### Improved
- **Multi-Voice Conversations**: Now work reliably with TTS tools
  - Conversations between multiple voices (Clanker, Rachael, Adam) execute successfully
  - Each voice speaks sequentially without JSON parsing errors
  - Enhanced system prompts guide the model to avoid problematic patterns

### Developer Notes
- The prompt preprocessor helps work around Grok API's strict JSON validation
- Multi-tool calls now execute sequentially (with pauses) rather than failing
- This is a workaround for server-side validation that rejects concatenated JSON

## [0.3.6] - 2025-07-30

### Added
- **Infinite Retry Logic**: Enhanced argument fixer with "never give up" mode
  - Added `maxRetries` parameter to `fixMalformedArguments()` function
  - Support for `-1` as sentinel value for infinite retries
  - Automatic rotation through different format preferences (JSON → YAML → XML)
  - Agent now uses infinite retries by default for maximum resilience

### Fixed
- **Argument Fixing**: Improved handling of malformed tool arguments
  - Better recovery from concatenated JSON objects
  - Enhanced format detection and conversion
  - More robust error messages with helpful context

### Developer Notes
- The argument fixer now supports infinite retries to handle persistent AI formatting issues
- Note: Some errors occur at the API level before reaching our code (e.g., Grok API server-side validation)

## [0.3.4] - 2025-07-30

### Added
- **Package Manager Improvements**:
  - Better error handling for tool updates
  - Improved logging during update operations
  
### Fixed
- **Hook System**: 
  - Fixed hook persistence limitations documentation
  - Improved hook registration error messages
  
### Developer Notes
- Hook system currently requires hooks with function handlers to be re-registered each session
- Use `persistHook()` for module-based hooks that should survive restarts
- Tools using inline function handlers should document this limitation

## [0.3.3] - 2025-07-29

### Added
- **Hook System Improvements**: 
  - Hook `register()` now returns the hook ID for manual management
  - Auto-generate hook IDs if not provided
  - New `persistHook()` method for saving hooks to settings (module paths only)
  - Made hook ID optional in `HookRegistrationOptions`

### Fixed
- Export `ToolContext` and `ToolArguments` types properly for tool developers

## [0.3.2] - 2025-07-29

### Fixed
- Fixed "registry.getTool is not a function" error in update all command
- Moved update all logic to PackageManager class for better encapsulation

## [0.3.1] - 2025-07-29

### Added
- **Update All Tools**: New `--update` command with no parameters
  - Updates all installed tools to their latest versions
  - Shows detailed progress and summary
  - Identifies tools that are already up-to-date

- **Self-Update Command**: New `--upgrade` / `-U` flag and `upgrade` command
  - Updates clanker itself to the latest version from npm
  - Checks current vs latest version before updating
  - Provides manual update instructions on failure

## [0.3.0] - 2025-07-29

### Added
- **Hook System**: Comprehensive event-driven hook system for extending Clanker functionality
  - Support for command, function, and tool hooks
  - Pre/Post tool execution hooks
  - Message lifecycle hooks
  - Session management hooks
  - AI-interpretable structured data in hook outputs
  - Dynamic hook registration API for tools
  - Hook configuration via settings.json files
  - Tool chaining and context modification capabilities
  
- **Session Management**: Full session persistence and lifecycle management
  - Automatic session saving and loading
  - Message history tracking
  - Tool execution history
  - Session-specific context and metadata
  - Auto-save functionality with configurable intervals
  - Session event system
  - JSONL transcript export

- **Local Tool Installation**: `--local` flag for installing tools from local directories
  - `clanker install --local /path/to/tool` for development workflow
  - Automatic dependency resolution for local tools
  - Version management for local installations

- **Tool Context Enhancements**: Extended tool context with new capabilities
  - Access to hook manager via `context.hooks`
  - Access to tool registry via `context.tools` 
  - Programmatic tool execution from within tools
  - Settings management API

### Changed
- Tools can now declare dependencies in package.json under `clanker.dependencies`
- Tool initialization now supports async operations via agent.initialize()
- Improved TypeScript types throughout the codebase
- Enhanced error handling and debugging output

### Fixed
- Session message type compatibility with GrokMessage interface
- Async initialization race conditions in agent startup
- Tool dependency installation handling

## [0.2.81] - 2025-07-27

### Fixed
- Fixed tsup build configuration trying to build deleted dynamic tools folder
- Added Windows diagnostic script to help debug PATH issues
- Ensured shebang is preserved in built files for proper command execution

## [0.2.8] - 2025-07-27

### Changed
- Renamed clanker-tools repository to rachet
- Updated all repository references from ziggle-dev to zigglers organization
- Changed default registry URL from github.com/ziggle-dev/clanker-tools to github.com/zigglers/rachet
- Removed core-tools repository as it's no longer needed
- All @ziggler/clanker dependencies now use "*" to always get latest version
- Removed old dynamic tools system in favor of new package manager

### Fixed
- Updated all documentation to reflect new repository structure
- Fixed all GitHub URLs to point to zigglers organization
- Updated CI/CD workflows for new repository names
- Fixed Windows compatibility issues in package manager:
  - Replaced process.env.HOME with os.homedir() for cross-platform compatibility
  - Use version pointer files instead of symlinks on Windows to avoid permission issues
  - Updated tool loader to handle both Unix symlinks and Windows pointer files

## [0.2.3] - 2025-07-27

### Added
- Auto-cache update mechanism that refreshes registry cache on any command if older than configured timeout
- `cacheTimeoutMinutes` setting in settings.json (default: 5 minutes)
- Built-in tools now properly load from manifest

### Fixed
- `/tools` command now correctly shows currently loaded tools
- Registry client now always fetches from main branch instead of GitHub releases
- Fixed agent not being passed to command handlers after useAgent hook refactor
- Package manager now shows all 5 tools (bash, create-todo-list, list, pwd, update-todo-list)

### Changed
- Removed GitHub releases check in favor of direct registry.json fetching
- Cache timeout is now configurable via settings

## [0.2.2] - 2025-07-27

### Fixed
- Fixed `/tools` command by getting agent from store at execution time
- Re-enabled built-in tools loading by setting `loadBuiltins: true`

## [0.2.1] - 2025-07-27

### Added
- NODE_TYPELESS_PACKAGE_JSON warning suppression in npm scripts

### Fixed
- Chat functionality completely broken - Enter key not working
- Messages not displaying in UI despite being in store
- OpenAI SDK "Cannot read private member" error with Valtio proxy
- 40-second delay on first message due to token counter initialization
- TypeScript type errors with OpenAI SDK tool_choice parameter
- React closure issues with stale agent values

### Changed
- Using Valtio's `ref()` to prevent agent from being wrapped in Proxy
- Removed token counting to improve performance
- Updated all components to use `useAgent` hook instead of props
- System messages now render with warning icon

### Removed
- All debug logging and test files

## [0.2.0] - 2025-07-27

### Changed
- **BREAKING**: Removed all builtin/core tools - all tools now come from the registry
- Redesigned startup logo to show current working directory and loaded tools in a grid
- Logo now displays tool count and names, truncating long lists with "... and X more"
- Disabled loadBuiltins in tool loader - only registry-installed tools are loaded

### Removed
- Core tools manager and automatic core tools installation
- Builtin tools from the package (pending removal of tools/dynamic folder)

### Fixed
- Tool count now properly updates in the logo after tools are loaded

## [0.1.35] - 2025-07-27

### Added
- Support for new rachet registry architecture with `registry.json` at repository root
- Enhanced registry client to fetch detailed metadata from `tools/{org}/{name}/metadata.json`
- Improved debug logging for registry operations
- Support for new versioned tool directory structure

### Changed
- Registry client now properly handles the new tool submission pipeline format
- Better error handling when fetching from multiple repositories
- Updated tool download paths to support new directory structure

### Fixed
- Registry search now correctly displays results
- Tool installation works with new registry format
- Backward compatibility maintained for legacy tool locations

## [0.1.33] - 2025-07-26

### Fixed
- Tool loading regression - tools now properly load before chat initialization
- Streaming chat responses - removed buffering delay for immediate updates
- ReferenceError in message input handling
- Tool output rendering with custom renderResult functions

### Changed
- Improved streaming performance with direct updates instead of 100ms throttle
- Cleaned up root directory structure

## [0.1.32] - 2025-07-26

### Fixed
- Auto-restart after initial settings setup
- Dynamic version display from package.json for --version command

### Added
- Core tools refactor
- Clanker-tools submission format and setup documentation

## [0.1.1] - 2024-07-25

### Added
- GitHub releases support for package manager
- Tar.gz extraction capability for tool packages
- Order-invariant diff algorithm for improved file editing (89% success rate)
- Dynamic tool loading from standalone JavaScript files
- Hot reload support with `--watch-tools` flag
- Tool manifest generation for built-in tools
- Support for multiple tool repositories
- Fallback to registry.json when releases not available

### Fixed
- Package manager now correctly fetches tools from GitHub releases
- Tool installation from tar.gz archives
- Registry caching mechanism
- Tool metadata conversion between registry formats

### Changed
- Registry now prioritizes GitHub releases over raw content
- Improved error handling for missing releases
- Better debug logging throughout the package manager

## [0.1.0] - 2024-07-20

### Added
- Initial release
- Core agent functionality with OpenAI-compatible API support
- Built-in tools: bash, file operations, search, todo management
- React-based terminal UI with Ink
- Package manager for tool discovery and installation
- Tool development framework
- Confirmation system for dangerous operations
- Debug logging and error tracking
