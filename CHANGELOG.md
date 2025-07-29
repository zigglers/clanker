# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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