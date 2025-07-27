# Clanker

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

## Quick Start

```bash
npm install -g @ziggler/clanker
clanker
```

That's it. Clanker will guide you through setup on first run.

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
```

## Key Features

### 🧠 **Intelligent File Editing**
Advanced order-invariant diff algorithm for reliable file editing. Multiple edit strategies ensure changes are applied correctly even in complex scenarios.

### 🛠️ **Extensible Tool System**
Build and share custom tools with the community. Every action is a tool, and creating new ones is simple:

```typescript
import { defineTool } from '@ziggler/clanker';

export default defineTool({
  id: 'pr_ready',
  name: 'PR Ready Check',
  description: 'Check if code is ready for PR',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Project path' }
    },
    required: ['path']
  },
  execute: async ({ path }) => {
    // Run your checks here
    const testsPass = await runTests(path);
    const lintPass = await checkLinting(path);
    const typesOk = await verifyTypes(path);
    
    return { 
      success: testsPass && lintPass && typesOk,
      output: 'All checks passed! Ready for PR.'
    };
  }
});
```

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

### Installing Tools

```bash
# Browse available tools
clanker tools list-available

# Install official tools
clanker tools install bash
clanker tools install multi_edit
clanker tools install search

# Install community tools
clanker tools install community/git-workflow
clanker tools install community/react-refactor
```

### Core Tools Available

- **bash** - Execute shell commands safely
- **multi_edit** - Advanced file editing with conflict resolution
- **search** - Fast code search with ripgrep
- **view_file** - Read and analyze files
- **write_to_file** - Create or overwrite files
- **list** - Browse directory contents
- **pwd** - Show current directory
- **remove** - Delete files and directories
- **create_todo_list** - Task management
- **update_todo_list** - Update task status
- **summarize** - Summarize long content

### Creating Your Own Tools

```bash
# Start with our template
git clone https://github.com/ziggle-dev/clanker-tool-template my-tool
cd my-tool

# Install dependencies
npm install

# Develop with hot reload
npm run dev

# Test locally
npm run build
clanker tools install ./dist

# Submit to registry
npm run submit
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

Configure with:
```bash
clanker config set provider grok
clanker config set api-key YOUR_API_KEY
```

## Common Workflows

### Refactoring a Codebase
```bash
> "Update all imports from 'lib/' to '@/lib/'"
> "Convert all class components to functional components"
> "Add TypeScript types to all exported functions"
```

### Setting Up a New Project
```bash
> "Create a Next.js app with TypeScript and Tailwind"
> "Set up ESLint and Prettier with sensible defaults"
> "Create a GitHub Actions workflow for CI/CD"
```

### Debugging Issues
```bash
> "Find all console.error calls and add stack traces"
> "Add debug logging to the authentication flow"
> "Check for potential race conditions in async code"
```

## Philosophy

Traditional AI assistants are suggestion engines. Clanker is different—it's an **action engine**.

Instead of:
> "Here's how you could refactor this code..."

Clanker says:
> "I'll refactor this code. Here's what I'm changing... Approve? [Y/n]"

This shift from passive suggestions to active assistance means you spend less time copying code and more time reviewing and shipping changes.

## Documentation

- 🚀 **[Getting Started](https://github.com/ziggle-dev/clanker/wiki/Getting-Started)** - Installation and first steps
- 🛠️ **[Tool Development](https://github.com/ziggle-dev/clanker/wiki/Tool-Development)** - Create custom tools
- 📦 **[Tool Registry](https://github.com/ziggle-dev/clanker-tools)** - Browse available tools
- 🏗️ **[Architecture](https://github.com/ziggle-dev/clanker/wiki/Architecture)** - How Clanker works
- 📚 **[API Reference](https://github.com/ziggle-dev/clanker/wiki/API-Reference)** - Complete API docs

## Contributing

We welcome contributions! Here's how to get involved:

- 🐛 [Report bugs](https://github.com/ziggle-dev/clanker/issues/new?template=bug_report.md)
- 💡 [Request features](https://github.com/ziggle-dev/clanker/issues/new?template=feature_request.md)  
- 🛠️ [Submit tools](https://github.com/ziggle-dev/clanker-tools/issues/new?template=tool_submission.md)
- 📖 [Improve docs](https://github.com/ziggle-dev/clanker/wiki)

### Development Setup

```bash
# Clone the repo
git clone https://github.com/ziggle-dev/clanker.git
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

- 💬 [GitHub Discussions](https://github.com/ziggle-dev/clanker/discussions) - Ask questions, share ideas
- 🌟 [Show & Tell](https://github.com/ziggle-dev/clanker/discussions/categories/show-and-tell) - Share your tools and workflows
- 🐛 [Issue Tracker](https://github.com/ziggle-dev/clanker/issues) - Report bugs and request features

## License

MIT © [Ziggler](https://github.com/ziggle-dev)

---

<div align="center">
  <p><strong>Stop copying suggestions. Start shipping changes.</strong></p>
  <p>
    <a href="https://github.com/ziggle-dev/clanker">⭐ Star on GitHub</a> • 
    <a href="https://github.com/ziggle-dev/clanker/wiki/Getting-Started">📚 Get Started</a> • 
    <a href="https://twitter.com/intent/tweet?text=Check%20out%20Clanker%20-%20AI%20agents%20that%20actually%20DO%20things!&url=https://github.com/ziggle-dev/clanker">🐦 Share</a>
  </p>
</div>