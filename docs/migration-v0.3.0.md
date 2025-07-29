# Migration Guide: Clanker v0.3.0

This guide helps tool developers migrate their tools to take advantage of Clanker v0.3.0's new features: the Hook System and Session Management.

## Overview of Changes

### New Features in v0.3.0
1. **Hook System**: Event-driven architecture for extending Clanker
2. **Session Management**: Persistent conversation and context tracking
3. **Enhanced Tool Context**: New properties and capabilities
4. **Local Tool Installation**: `--local` flag for development
5. **Tool Dependencies**: Automatic dependency resolution

### Breaking Changes
- None! v0.3.0 is fully backward compatible

## Tool Context Enhancements

### Old Context (v0.2.x)
```typescript
interface ToolContext {
  logger?: Logger;
  store: MessageStore;
  registry: ToolRegistry;
}
```

### New Context (v0.3.0)
```typescript
interface ToolContext {
  logger?: Logger;
  store: MessageStore;
  registry: ToolRegistry;
  hooks: HookAPI;        // NEW: Hook system access
  tools: ToolRegistry;   // NEW: Alias for registry
  session: SessionManager; // NEW: Session management
}
```

## Migration Patterns

### 1. Migrating from File Watchers to Hooks

**Before (v0.2.x):**
```typescript
// Old approach using file watchers
export default async function(args, context) {
  const watcher = fs.watch('.', (event, filename) => {
    if (filename.endsWith('.js')) {
      console.log(`File changed: ${filename}`);
    }
  });
  
  // Tool logic...
  
  watcher.close();
  return { success: true };
}
```

**After (v0.3.0):**
```typescript
// New approach using hooks
export default async function(args, context) {
  // Register a hook to monitor file changes
  context.hooks.register({
    id: 'file-monitor',
    name: 'File Change Monitor',
    event: HookEvent.PostToolUse,
    matcher: 'write-to-file|multi-edit',
    handler: async (input, hookContext) => {
      if (input.tool_input.file_path?.endsWith('.js')) {
        console.log(`File changed: ${input.tool_input.file_path}`);
      }
      return { continue: true };
    }
  });
  
  // Tool logic...
  
  return { success: true };
}
```

### 2. Migrating from Global State to Session Data

**Before (v0.2.x):**
```typescript
// Old approach using global variables
let toolExecutionCount = 0;

export default async function(args, context) {
  toolExecutionCount++;
  
  return {
    success: true,
    data: { count: toolExecutionCount }
  };
}
```

**After (v0.3.0):**
```typescript
// New approach using session data
export default async function(args, context) {
  // Get session data
  const count = context.session.getContext('toolExecutionCount') || 0;
  const newCount = count + 1;
  
  // Update session data
  context.session.updateContext('toolExecutionCount', newCount);
  
  return {
    success: true,
    data: { count: newCount }
  };
}
```

### 3. Migrating from Manual Tool Calls to Hook Chaining

**Before (v0.2.x):**
```typescript
// Old approach with manual tool execution
export default async function(args, context) {
  // Write file
  const result = await context.registry.execute('write-to-file', {
    file_path: 'output.txt',
    content: 'Hello World'
  });
  
  if (result.success) {
    // Format the file
    await context.registry.execute('bash', {
      command: 'prettier --write output.txt'
    });
  }
  
  return result;
}
```

**After (v0.3.0):**
```typescript
// New approach with hook chaining
export default async function(args, context) {
  // Write file with automatic formatting via hooks
  const result = await context.tools.execute('write-to-file', {
    file_path: 'output.txt',
    content: 'Hello World'
  });
  
  // Hook automatically chains prettier command
  return {
    ...result,
    chainTools: [{
      toolId: 'bash',
      args: { command: 'prettier --write output.txt' }
    }]
  };
}
```

### 4. Migrating API Key Storage

**Before (v0.2.x):**
```typescript
// Old approach with hardcoded or env vars
const API_KEY = process.env.MY_TOOL_API_KEY || 'hardcoded-key';

export default async function(args, context) {
  if (!API_KEY) {
    return { success: false, error: 'API key not set' };
  }
  
  // Use API key...
}
```

**After (v0.3.0):**
```typescript
// New approach with settings management
import { getToolSettings, saveToolSettings } from './settings';

async function getApiKey(context) {
  const settings = await getToolSettings();
  
  if (!settings?.apiKey) {
    // Use input tool to prompt user
    const result = await context.tools.execute('input', {
      prompt: 'Please enter your API key:',
      password: true
    });
    
    if (result.success) {
      await saveToolSettings({ apiKey: result.output });
      return result.output;
    }
  }
  
  return settings.apiKey;
}

export default async function(args, context) {
  const apiKey = await getApiKey(context);
  if (!apiKey) {
    return { success: false, error: 'API key required' };
  }
  
  // Use API key...
}
```

## Declaring Tool Dependencies

Add dependencies to your `package.json`:

```json
{
  "name": "@yourorg/your-tool",
  "version": "1.0.0",
  "clanker": {
    "dependencies": {
      "ziggle-dev/input": ">=1.0.0",
      "ziggle-dev/bash": ">=1.0.0"
    }
  }
}
```

Dependencies are automatically installed when your tool is installed.

## Using the Hook System

### Registering Hooks in Your Tool

```typescript
export default async function(args: ToolArguments, context: ToolContext) {
  // Register a hook to enhance functionality
  context.hooks.register({
    id: `${context.tool.name}-enhancer`,
    name: 'Tool Enhancer',
    event: HookEvent.PreToolUse,
    handler: async (input, hookContext) => {
      // Add context before tool execution
      return {
        continue: true,
        contextUpdates: {
          add: { enhancedBy: context.tool.name }
        }
      };
    }
  });
  
  // Your tool logic...
}
```

### Hook Event Reference

```typescript
enum HookEvent {
  PreToolUse = 'PreToolUse',      // Before tool execution
  PostToolUse = 'PostToolUse',     // After tool execution
  PreMessage = 'PreMessage',       // Before message processing
  PostMessage = 'PostMessage',     // After message processing
  SessionStart = 'SessionStart',   // Session initialization
  UserPromptSubmit = 'UserPromptSubmit' // User input
}
```

## Using Session Management

### Accessing Session Data

```typescript
export default async function(args: ToolArguments, context: ToolContext) {
  // Get session metadata
  const metadata = context.session.getMetadata();
  console.log(`Session: ${metadata.id}, Created: ${metadata.created}`);
  
  // Access message history
  const messages = context.session.getMessages();
  const lastUserMessage = messages
    .filter(m => m.role === 'user')
    .pop();
  
  // Store tool-specific data
  context.session.updateContext('myTool', {
    lastRun: new Date(),
    configuration: args
  });
  
  // Retrieve stored data
  const previousRun = context.session.getContext('myTool');
  
  return {
    success: true,
    data: {
      sessionId: metadata.id,
      messageCount: messages.length,
      previousRun
    }
  };
}
```

### Exporting Session Data

```typescript
// Export current session as transcript
const transcriptPath = await context.session.exportTranscript();
console.log(`Session exported to: ${transcriptPath}`);
```

## Local Development Workflow

### 1. Set Up Your Tool

```bash
# Create tool directory
mkdir my-tool
cd my-tool

# Initialize package.json
npm init

# Install Clanker types
npm install --save-dev @ziggler/clanker
```

### 2. Develop with Hot Reload

```bash
# Install your tool locally
clanker install --local .

# Make changes and reinstall
clanker install --local . --force
```

### 3. Test with Hooks

```typescript
// test-hook.js
export default async function(input, context) {
  console.log(`Hook fired: ${input.hook_event_name}`);
  return { continue: true };
}
```

```json
// .clanker/settings.json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "*",
      "hooks": [{
        "type": "function",
        "function": "./test-hook.js"
      }]
    }]
  }
}
```

## Best Practices

### 1. Hook Registration
- Register hooks early in tool execution
- Use unique hook IDs to avoid conflicts
- Unregister hooks when no longer needed
- Handle hook errors gracefully

### 2. Session Data
- Store only serializable data
- Use meaningful keys for context
- Clean up large data after use
- Document your data structure

### 3. Tool Dependencies
- Declare all required dependencies
- Use version ranges for flexibility
- Test with minimum versions
- Document dependency usage

### 4. Error Handling
```typescript
export default async function(args, context) {
  try {
    // Tool logic with new features
    const apiKey = await getApiKey(context);
    
    context.hooks.register({
      id: 'error-handler',
      name: 'Error Handler',
      event: HookEvent.PostToolUse,
      handler: async (input) => {
        if (!input.tool_response.success) {
          // Log errors to session
          context.session.updateContext('errors', [
            ...(context.session.getContext('errors') || []),
            {
              tool: input.tool_name,
              error: input.tool_response.error,
              time: new Date()
            }
          ]);
        }
        return { continue: true };
      }
    });
    
    // Tool implementation...
    
  } catch (error) {
    // Always return proper error structure
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}
```

## Common Migration Scenarios

### Scenario 1: Audio/Visual Tools
Replace file-based hooks with the hook system:

```typescript
// Before: Writing to .clanker/hooks/message
// After: Register PostMessage hook
context.hooks.register({
  id: 'audio-processor',
  event: HookEvent.PostMessage,
  handler: async (input) => {
    if (input.role === 'assistant') {
      await processAudio(input.content);
    }
    return { continue: true };
  }
});
```

### Scenario 2: Monitoring Tools
Use session data for state tracking:

```typescript
// Track all tool executions in session
context.hooks.register({
  id: 'execution-monitor',
  event: HookEvent.PostToolUse,
  handler: async (input, hookContext) => {
    const stats = hookContext.getSessionData('toolStats') || {};
    stats[input.tool_name] = (stats[input.tool_name] || 0) + 1;
    hookContext.setSessionData('toolStats', stats);
    return { continue: true };
  }
});
```

### Scenario 3: Integration Tools
Chain tools together intelligently:

```typescript
// Automatically run related tools
return {
  success: true,
  data: result,
  chainTools: [
    {
      toolId: 'formatter',
      args: { file: outputFile },
      condition: 'if file is code'
    },
    {
      toolId: 'notifier',
      args: { message: 'Task complete' }
    }
  ]
};
```

## Testing Your Migration

### 1. Unit Testing Hooks
```typescript
// test/hooks.test.js
import { HookContext, HookInput } from '@ziggler/clanker';

describe('MyTool Hooks', () => {
  it('should process messages correctly', async () => {
    const mockInput: HookInput = {
      hook_event_name: 'PostMessage',
      session_id: 'test-session',
      role: 'assistant',
      content: 'Test message'
    };
    
    const mockContext: HookContext = {
      // Mock context implementation
    };
    
    const result = await myHook(mockInput, mockContext);
    expect(result.continue).toBe(true);
  });
});
```

### 2. Integration Testing
```bash
# Test with local installation
clanker install --local .

# Run test commands
clanker -p "Test my tool"

# Check session data
clanker -p "Show session info"
```

## Troubleshooting

### Hook Not Firing
1. Check hook registration succeeded
2. Verify matcher pattern matches
3. Ensure correct event type
4. Check for errors in hook handler

### Session Data Lost
1. Verify auto-save is enabled
2. Check write permissions
3. Look for session files in ~/.clanker/sessions/
4. Ensure graceful shutdown

### Tool Dependencies Not Installing
1. Check dependency format in package.json
2. Verify tool names are correct
3. Try manual installation first
4. Check network connectivity

## Support

- **Documentation**: [Clanker Docs](https://github.com/zigglers/clanker/docs)
- **Hook System Guide**: [docs/hooks.md](./hooks.md)
- **Session Guide**: [docs/sessions.md](./sessions.md)
- **Issues**: [GitHub Issues](https://github.com/zigglers/clanker/issues)
- **Community**: [Discussions](https://github.com/zigglers/clanker/discussions)

## Conclusion

Clanker v0.3.0 provides powerful new capabilities while maintaining backward compatibility. The Hook System and Session Management enable new patterns for tool development:

- **Event-driven architecture** replaces polling and watching
- **Persistent state** replaces global variables
- **Tool composition** replaces manual orchestration
- **Secure configuration** replaces hardcoded secrets

Take advantage of these features to build more powerful, maintainable, and user-friendly tools!