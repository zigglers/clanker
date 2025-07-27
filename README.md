# Clanker
> Demistifying the agentic workflow

<div align="center">
  <p>
    <img alt="npm version" src="https://img.shields.io/npm/v/@ziggler/clanker?style=flat-square&color=00D9FF">
    <img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square">
    <img alt="node version" src="https://img.shields.io/node/v/@ziggler/clanker?style=flat-square&color=43B02A">
    <img alt="downloads" src="https://img.shields.io/npm/dm/@ziggler/clanker?style=flat-square&color=FF6B6B">
  </p>
  <h3>AI agents that actually <em>do</em> things</h3>
  <p>Not just suggestions—real actions, real changes, real time.</p>
</div>

## Demo

https://github.com/user-attachments/assets/2465c9b7-8f13-4a39-9486-f7ca032dadc4

## Quick Start

```bash
# Install Clanker globally
npm install -g @ziggler/clanker

# Install essential tools
clanker -I ziggle-dev/bash
clanker -I ziggle-dev/view-file
clanker -I ziggle-dev/write-to-file
clanker -I ziggle-dev/multi-edit
clanker -I ziggle-dev/search

# Start using Clanker
clanker
```

Clanker will guide you through API key setup on first run.

## What's New in v0.2.0

- 🚀 **Improved Performance**: First message no longer has 40-second delay
- 🐛 **Fixed Chat Issues**: Messages now display correctly in the UI
- 🎨 **Better Error Handling**: System messages render properly
- 🔧 **Cleaner Output**: Suppressed module warning messages

## What Can It Do?

```bash
# Refactor code intelligently
> "Replace all console.log with our logger utility"
✓ Found 47 instances across 12 files
✓ Applied context-aware replacements
✓ All tests still passing

# Understand and modify complex codebases  
> "Add error handling to all async functions"
✓ Analyzed 23 async functions
✓ Added try-catch with appropriate error handling
✓ Preserved existing logic flow

# Execute multi-step workflows
> "Set up a new React component with tests"
✓ Created Button.tsx with TypeScript props
✓ Added Button.test.tsx with coverage
✓ Updated component index exports

# Work with files and directories
> "Show me the structure of the src folder"
✓ Listed all files and directories
✓ Highlighted important configuration files

# Search and analyze code
> "Find all TODO comments in the codebase"
✓ Searched across 156 files
✓ Found 23 TODO comments
✓ Grouped by priority and file location
```

## Key Features

### 🧠 **Intelligent File Editing**
Advanced order-invariant diff algorithm for reliable file editing. Multiple edit strategies ensure changes are applied correctly even in complex scenarios.

### 🛠️ **Extensible Tool System**
Clanker uses a modular tool system where every action is performed by a tool. Tools are distributed through the package registry and can be easily installed.

### 🎨 **Beautiful Terminal UI**
React-powered terminal interface with:
- Syntax highlighting for code
- Real-time streaming responses
- Progress indicators for long operations
- Keyboard shortcuts for efficiency

### 🔐 **Safety First**
- Confirmation prompts for file modifications
- Dry-run mode for testing changes
- Full operation history
- Built-in safeguards against destructive operations

## Tool Ecosystem

### Package Manager Commands

```bash
# List all available tools in the registry
clanker -A              # or clanker --list-available
clanker -A 2           # Show page 2 of available tools

# Search for specific tools
clanker -S bash         # or clanker --search bash
clanker -S "todo"      # Search for todo-related tools

# Install tools from the registry
clanker -I ziggle-dev/bash              # or clanker --install ziggle-dev/bash
clanker -I ziggle-dev/bash@1.0.0        # Install specific version

# List installed tools
clanker -L              # or clanker --list

# Uninstall tools
clanker -U ziggle-dev/bash              # or clanker --uninstall ziggle-dev/bash

# Update tools to latest version
clanker --update ziggle-dev/bash

# Clear package cache
clanker --clear-cache
```

### Available Tools

Clanker uses an opt-in tool system. Install only the tools you need:

**Essential Tools:**
- **ziggle-dev/bash** - Execute shell commands safely
- **ziggle-dev/view-file** - Read and analyze files
- **ziggle-dev/write-to-file** - Create or overwrite files
- **ziggle-dev/multi-edit** - Advanced file editing with conflict resolution
- **ziggle-dev/search** - Fast code search with ripgrep

**File Management:**
- **ziggle-dev/list** - Browse directory contents
- **ziggle-dev/pwd** - Show current directory
- **ziggle-dev/remove** - Delete files and directories

**Task Management:**
- **ziggle-dev/create-todo-list** - Create task lists
- **ziggle-dev/update-todo-list** - Update task status

**Utilities:**
- **ziggle-dev/input** - Get user input during operations
- **ziggle-dev/summarize** - Summarize long content (coming soon)

View all available tools with `clanker -A` or `clanker --list-available`

### Creating Your Own Tools

Create and share your own tools with the community:

```bash
# Use the tool creation wizard
npx create-clanker-tool my-awesome-tool

# Or start from template
git clone https://github.com/zigglers/rachet-tool my-tool
cd my-tool

# Install dependencies
npm install

# Test locally
npm run build
clanker -I ./  # Install from current directory

# Publish to registry
npm run publish
```

Visit the [Tool Development Guide](https://github.com/zigglers/clanker/wiki/Tool-Development) for detailed instructions.

## Common Tasks

### Getting Started
```bash
# Start a conversation with Clanker
clanker

# Ask Clanker to help with a specific task
> "Help me refactor this function to use async/await"
> "Find all TODO comments in the project"
> "Create a new React component with TypeScript"
```

### Working with Files
```bash
# View file contents
> "Show me the package.json file"

# Edit files
> "Add error handling to the login function"

# Create new files
> "Create a new test file for UserService"

# Search code
> "Find all instances of console.log"
```

### Running Commands
```bash
# Execute shell commands (requires bash tool)
> "Run npm test"
> "Show me the git status"
> "Install the lodash package"
```

## Configuration

Clanker stores configuration in `~/.clanker/`:

```
~/.clanker/
├── settings.json      # API keys and preferences
├── tools/             # Installed tools
└── history/           # Command history
```

### Supported AI Providers

- **xAI Grok** (default) - Fast and capable
- **OpenAI** - GPT-4 and other models
- **Anthropic** - Claude models
- **Custom** - Any OpenAI-compatible endpoint

### Setting Up Your API Key

On first run, Clanker will prompt you for an API key. You can also configure it manually:

```bash
# During first run
clanker
# Follow the prompts to enter your API key

# Or set environment variable
export CLANKER_API_KEY="your-api-key-here"

# Or add to ~/.clanker/settings.json
{
  "apiKey": "your-api-key-here",
  "provider": "grok"
}
```

## Advanced Workflows

### Refactoring a Codebase
```bash
> "Update all imports from 'lib/' to '@/lib/'"
> "Convert all class components to functional components"
> "Add TypeScript types to all exported functions"
```

### Setting Up a New Project
```bash
> "Create a new Express API with TypeScript"
> "Set up ESLint and Prettier with sensible defaults"
> "Create a GitHub Actions workflow for CI/CD"
```

### Debugging Issues
```bash
> "Find all console.error calls and add stack traces"
> "Add debug logging to the authentication flow"
> "Check for potential race conditions in async code"
```

### Managing Tasks
```bash
# Create a todo list (requires todo tools)
> "Create a todo list for implementing user authentication"
> "Update task 3 to completed"
> "Show me all pending tasks"
```

## Philosophy

Traditional AI assistants are suggestion engines. Clanker is different—it's an **action engine**.

Instead of:
> "Here's how you could refactor this code..."

Clanker says:
> "I'll refactor this code. Here's what I'm changing... Approve? [Y/n]"

This shift from passive suggestions to active assistance means you spend less time copying code and more time reviewing and shipping changes.

## Documentation

- 🚀 **[Getting Started](https://github.com/zigglers/clanker/wiki/Getting-Started)** - Installation and first steps
- 🛠️ **[Tool Development](https://github.com/zigglers/clanker/wiki/Tool-Development)** - Create custom tools
- 📦 **[Tool Registry](https://github.com/zigglers/rachet)** - Browse available tools
- 🏗️ **[Architecture](https://github.com/zigglers/clanker/wiki/Architecture)** - How Clanker works
- 📚 **[API Reference](https://github.com/zigglers/clanker/wiki/API-Reference)** - Complete API docs

## Contributing

We welcome contributions! Here's how to get involved:

- 🐛 [Report bugs](https://github.com/zigglers/clanker/issues/new?template=bug_report.md)
- 💡 [Request features](https://github.com/zigglers/clanker/issues/new?template=feature_request.md)  
- 🛠️ [Submit tools](https://github.com/zigglers/rachet/issues/new?template=tool_submission.md)
- 📖 [Improve docs](https://github.com/zigglers/clanker/wiki)

### Development Setup

```bash
# Clone the repo
git clone https://github.com/zigglers/clanker.git
cd clanker

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Community

- 💬 [GitHub Discussions](https://github.com/zigglers/clanker/discussions) - Ask questions, share ideas
- 🌟 [Show & Tell](https://github.com/zigglers/clanker/discussions/categories/show-and-tell) - Share your tools and workflows
- 🐛 [Issue Tracker](https://github.com/zigglers/clanker/issues) - Report bugs and request features

## License

MIT © [Ziggler](https://github.com/zigglers)

---

<div align="center">
  <p><strong>Stop copying suggestions. Start shipping changes.</strong></p>
  <p>
    <a href="https://github.com/zigglers/clanker">⭐ Star on GitHub</a> • 
    <a href="https://github.com/zigglers/clanker/wiki/Getting-Started">📚 Get Started</a> • 
    <a href="https://twitter.com/intent/tweet?text=Check%20out%20Clanker%20-%20AI%20agents%20that%20actually%20DO%20things!&url=https://github.com/zigglers/clanker">🐦 Share</a>
  </p>
</div>
