# 🤖 Clanker

<div align="center">
  <h3>AI agents that actually <em>do</em> things</h3>
  <p>Not just suggestions—real actions, real changes, real time.</p>
  
  <p>
    <img alt="npm version" src="https://img.shields.io/npm/v/@ziggler/clanker?style=flat-square&color=00D9FF">
    <img alt="license" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
    <img alt="node version" src="https://img.shields.io/node/v/@ziggler/clanker?style=flat-square&color=43B02A">
    <img alt="downloads" src="https://img.shields.io/npm/dm/@ziggler/clanker?style=flat-square&color=FF6B6B">
    <img alt="build status" src="https://img.shields.io/github/actions/workflow/status/zigglers/clanker/clanker-release.yml?style=flat-square">
  </p>
</div>

---

## 🚀 Quick Start

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

## 📺 Demo

### Works in Any Terminal (Including Cursor!)

https://github.com/user-attachments/assets/6f0bce3f-13dd-483d-ba99-4017f953f9a4

### Standard TTY/Kitty Terminal

https://github.com/user-attachments/assets/2465c9b7-8f13-4a39-9486-f7ca032dadc4

## 🎯 What Can It Do?

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

## ✨ Key Features

### 🧠 **Intelligent File Editing**
Advanced order-invariant diff algorithm for reliable file editing. Multiple edit strategies ensure changes are applied correctly even in complex scenarios.

### 🛠️ **Extensible Tool System**
Modular architecture where every action is performed by a tool. Tools are distributed through our package registry and can be easily installed, updated, or removed.

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

### 🔄 **Self-Updating**
Clanker can update itself directly from GitHub releases:
```bash
clanker upgrade  # or clanker -U
```

## 📦 Tool Ecosystem

### Package Manager Commands

```bash
# List all available tools in the registry
clanker -A              # or clanker --list-available
clanker -A 2           # Show page 2 of available tools

# Search for specific tools
clanker -S bash        # or clanker --search bash
clanker -S "todo"      # Search for todo-related tools

# Install tools from the registry
clanker -I ziggle-dev/bash              # or clanker --install
clanker -I ziggle-dev/bash@1.0.0        # Install specific version

# List installed tools
clanker -L              # or clanker --list

# Uninstall tools
clanker --uninstall ziggle-dev/bash

# Update tools to latest version
clanker --update ziggle-dev/bash        # Update specific tool
clanker --update                        # Update all installed tools

# Upgrade clanker itself
clanker -U                              # or clanker upgrade
clanker self-update                     # Alternative command

# Clear package cache
clanker --clear-cache
```

### Essential Tools

**Core Tools:**
- `ziggle-dev/bash` - Execute shell commands safely
- `ziggle-dev/view-file` - Read and analyze files
- `ziggle-dev/write-to-file` - Create or overwrite files
- `ziggle-dev/multi-edit` - Advanced file editing with conflict resolution
- `ziggle-dev/search` - Fast code search with ripgrep

**File Management:**
- `ziggle-dev/list` - Browse directory contents
- `ziggle-dev/pwd` - Show current directory
- `ziggle-dev/remove` - Delete files and directories

**Task Management:**
- `ziggle-dev/create-todo-list` - Create task lists
- `ziggle-dev/update-todo-list` - Update task status

**Utilities:**
- `ziggle-dev/input` - Get user input during operations
- `ziggle-dev/summarize` - Summarize long content
- `ziggle-dev/elevenlabs-tts` - Text-to-speech generation
- `ziggle-dev/web-search` - Search the web for information

Browse the full registry at [github.com/zigglers/rachet](https://github.com/zigglers/rachet)

## 🔧 Creating Your Own Tools

### Quick Start with Tool Creation Wizard

```bash
# Use the interactive tool creation wizard
npx create-clanker-tool my-awesome-tool

# Test locally
cd my-awesome-tool
npm install
npm run build
clanker -I ./  # Install from current directory

# Submit to registry
# Create an issue at https://github.com/zigglers/rachet
```

### Tool Development

Tools are simple JavaScript/TypeScript modules that export a default function:

```typescript
export default async function(args: ToolArguments, context: ToolContext) {
  // Your tool logic here
  return {
    success: true,
    output: "Tool executed successfully!"
  };
}
```

Visit the [Tool Development Guide](https://github.com/zigglers/clanker/wiki/Tool-Development) for detailed instructions.

## 🪝 Hook System

Extend Clanker's functionality through event-driven programming:

### Available Hook Events

- **PreToolUse**: Before any tool execution (can block or modify)
- **PostToolUse**: After tool execution (can process results)
- **PreMessage**: Before messages are added to the conversation
- **PostMessage**: After messages are processed
- **SessionStart**: When a session begins
- **UserPromptSubmit**: When user submits a prompt

### Configuring Hooks

Add hooks to your settings:

```json
// ~/.clanker/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "bash",
        "hooks": [{
          "type": "command",
          "command": "echo 'Running bash command: $TOOL_INPUT' >> audit.log"
        }]
      }
    ]
  }
}
```

## 💾 Session Management

Clanker automatically saves your conversations:

- Sessions saved to `~/.clanker/sessions/`
- Auto-save every 30 seconds
- Resume previous sessions with context
- Export transcripts as JSONL

### Session Commands

```bash
# In chat, use these commands:
/session    # View session info
/export     # Export current session
/clear      # Clear current session
```

## ⚙️ Configuration

### Supported AI Providers

- **xAI Grok** (default) - Fast and capable
- **OpenAI** - GPT-4 and other models
- **Anthropic** - Claude models
- **Google** - Gemini models
- **Custom** - Any OpenAI-compatible endpoint

### Setting Up Your API Key

```bash
# On first run, Clanker will prompt for setup
clanker

# Or set environment variable
export CLANKER_API_KEY="your-api-key-here"

# Or configure in ~/.clanker/settings.json
{
  "apiKey": "your-api-key-here",
  "provider": "grok"
}
```

## 🤝 Contributing

We welcome contributions! Clanker uses an automated submission system for features, fixes, and maintenance tasks.

### Automated Contribution Process

1. **Browse Issue Templates**: 
   - [🚀 Submit a Feature](https://github.com/zigglers/clanker/issues/new?template=clanker-feature.yml)
   - [🐛 Submit a Fix](https://github.com/zigglers/clanker/issues/new?template=clanker-fix.yml)
   - [🔧 Submit a Chore](https://github.com/zigglers/clanker/issues/new?template=clanker-chore.yml)

2. **Fill Out the Template**: Provide all required information including:
   - Description of changes
   - Changelog entry
   - Semantic version
   - Testing plan

3. **Automatic PR Creation**: Our GitHub Actions will:
   - Validate your submission
   - Create a feature branch
   - Update version and changelog
   - Create a pull request
   - Run CI/CD checks

4. **Review & Release**: Once approved and merged:
   - Automatic GitHub release creation
   - NPM package publishing (if configured)
   - Issue labeled as "released"

### Manual Development

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

### Tool Submissions

To submit a new tool to the registry:

1. Create your tool following the [Tool Development Guide](https://github.com/zigglers/clanker/wiki/Tool-Development)
2. Test it locally with `clanker -I ./`
3. Submit it at [github.com/zigglers/rachet](https://github.com/zigglers/rachet/issues/new?template=tool_submission.yml)

## 📚 Documentation

- 🚀 **[Getting Started](https://github.com/zigglers/clanker/wiki/Getting-Started)** - Installation and first steps
- 🛠️ **[Tool Development](https://github.com/zigglers/clanker/wiki/Tool-Development)** - Create custom tools
- 📦 **[Tool Registry](https://github.com/zigglers/rachet)** - Browse available tools
- 🏗️ **[Architecture](https://github.com/zigglers/clanker/wiki/Architecture)** - How Clanker works
- 📚 **[API Reference](https://github.com/zigglers/clanker/wiki/API-Reference)** - Complete API docs
- 🪝 **[Hook System](https://github.com/zigglers/clanker/wiki/Hooks)** - Event-driven extensions
- 💾 **[Session Management](https://github.com/zigglers/clanker/wiki/Sessions)** - Persistent conversations

## 🌟 Philosophy

Traditional AI assistants are suggestion engines. Clanker is different—it's an **action engine**.

Instead of:
> "Here's how you could refactor this code..."

Clanker says:
> "I'll refactor this code. Here's what I'm changing... Approve? [Y/n]"

This shift from passive suggestions to active assistance means you spend less time copying code and more time reviewing and shipping changes.

## 🏆 What's New

### v0.4.2 (Latest)
- 🤖 **GitHub Automation**: Automated PR creation from issues
- 📦 **Release Management**: Automatic releases on PR merge
- 🔄 **Self-Update**: Update directly from GitHub releases
- 🧹 **Code Cleanup**: Improved repository structure

### v0.3.1
- 🔄 **Update All Tools**: Update all installed tools at once
- 🚀 **Self-Update**: Keep clanker up-to-date

### v0.3.0
- 🪝 **Hook System**: Comprehensive event-driven architecture
- 💾 **Session Management**: Persistent chat sessions with auto-save
- 📦 **Local Tool Installation**: Install tools from local directories
- 🔧 **Enhanced Tool Context**: Tools can execute other tools
- 🔗 **Tool Dependencies**: Automatic dependency installation

## 🐛 Known Issues

- Some terminals may have issues with Unicode characters
- Large file operations may require increased memory limits
- Windows support is experimental

Report issues at [github.com/zigglers/clanker/issues](https://github.com/zigglers/clanker/issues)

## 📄 License

MIT © [Ziggler](https://github.com/zigglers)

---

<div align="center">
  <p><strong>Stop copying suggestions. Start shipping changes.</strong></p>
  <p>
    <a href="https://github.com/zigglers/clanker">⭐ Star on GitHub</a> • 
    <a href="https://github.com/zigglers/clanker/wiki/Getting-Started">📚 Get Started</a> • 
    <a href="https://github.com/zigglers/rachet">🛠️ Browse Tools</a> •
    <a href="https://twitter.com/intent/tweet?text=Check%20out%20Clanker%20-%20AI%20agents%20that%20actually%20DO%20things!&url=https://github.com/zigglers/clanker">🐦 Share</a>
  </p>
  
  <p>
    <sub>Built with ❤️ by the Zigglers team</sub>
  </p>
</div>