# Clanker Hook System

The Clanker Hook System (introduced in v0.3.0) provides a powerful event-driven architecture for extending and customizing Clanker's behavior. Hooks allow tools, users, and integrations to react to various events during Clanker's execution lifecycle.

## Overview

Hooks are event handlers that can:
- Monitor and audit tool execution
- Modify tool arguments before execution
- Block certain operations based on custom logic
- Transform messages before they're processed
- Chain multiple tools together
- Add custom context to sessions
- Integrate with external systems

## Hook Events

### Tool Lifecycle Events

#### PreToolUse
Fired before any tool is executed. Can inspect, modify, or block tool execution.

```typescript
interface PreToolUseInput {
  session_id: string;
  tool_name: string;
  tool_input: ToolArguments;
}
```

Use cases:
- Security auditing
- Input validation
- Rate limiting
- Argument transformation

#### PostToolUse
Fired after a tool completes execution. Can process or transform results.

```typescript
interface PostToolUseInput {
  session_id: string;
  tool_name: string;
  tool_input: ToolArguments;
  tool_response: ToolResult;
}
```

Use cases:
- Result caching
- Error tracking
- Performance monitoring
- Result enhancement

### Message Lifecycle Events

#### PreMessage
Fired before messages are added to the conversation history.

```typescript
interface PreMessageInput {
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

Use cases:
- Content filtering
- Message transformation
- Context injection

#### PostMessage
Fired after messages are processed and stored.

```typescript
interface PostMessageInput {
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageId: string;
}
```

Use cases:
- Message logging
- Analytics
- Notifications

### Session Events

#### SessionStart
Fired when a new session begins or an existing session is resumed.

```typescript
interface SessionStartInput {
  session_id: string;
  source: 'startup' | 'resume' | 'clear';
}
```

Use cases:
- Session initialization
- Context restoration
- Welcome messages

#### UserPromptSubmit
Fired when the user submits a prompt.

```typescript
interface UserPromptSubmitInput {
  session_id: string;
  prompt: string;
}
```

Use cases:
- Prompt enhancement
- Command interception
- Usage tracking

## Hook Types

### 1. Command Hooks
Execute shell commands in response to events.

```json
{
  "type": "command",
  "command": "echo 'Tool ${TOOL_NAME} executed' >> audit.log",
  "timeout": 30
}
```

Environment variables available:
- `CLAUDE_PROJECT_DIR`: Current working directory
- All hook input fields as environment variables

### 2. Function Hooks
Execute TypeScript/JavaScript functions.

```json
{
  "type": "function",
  "function": "./hooks/my-hook.js",
  "timeout": 60
}
```

Function signature:
```typescript
export default async function(
  input: HookInput, 
  context: HookContext
): Promise<HookOutput> {
  // Hook implementation
  return { continue: true };
}
```

### 3. Tool Hooks
Execute other Clanker tools as hooks.

```json
{
  "type": "tool",
  "toolId": "ziggle-dev/logger",
  "args": {
    "level": "info"
  }
}
```

## Hook Configuration

### Configuration Files
Hooks can be configured in multiple locations (in order of precedence):

1. `.clanker/settings.local.json` - Local project overrides (gitignored)
2. `.clanker/settings.json` - Project-specific hooks
3. `~/.clanker/settings.json` - User global hooks

### Configuration Format

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "bash|exec",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Executing ${TOOL_NAME}' >> ~/.clanker/audit.log"
          }
        ]
      }
    ],
    "PostMessage": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "function",
            "function": "~/.clanker/hooks/message-logger.js"
          }
        ]
      }
    ]
  }
}
```

### Matcher Patterns
- `"*"` - Match all events
- `"bash"` - Exact match
- `"bash|exec|shell"` - Match any of these
- `"^test-.*"` - Regex pattern

## Dynamic Hook Registration

Tools can register hooks programmatically at runtime:

```typescript
// In your tool implementation
export default async function(args: ToolArguments, context: ToolContext) {
  // Register a hook dynamically
  context.hooks.register({
    id: 'my-dynamic-hook',
    name: 'My Dynamic Hook',
    description: 'Monitors file changes',
    event: HookEvent.PostToolUse,
    matcher: 'write-to-file|multi-edit',
    handler: async (input, context) => {
      // Log file modifications
      if (input.tool_name === 'write-to-file') {
        await context.callTool('logger', {
          message: `File written: ${input.tool_input.file_path}`
        });
      }
      return { continue: true };
    }
  });
  
  // Your tool logic...
}
```

## Hook Output Format

### Basic Output
```typescript
interface HookOutput {
  continue?: boolean;        // Whether to continue execution (default: true)
  stopReason?: string;      // Reason for stopping
  suppressOutput?: boolean; // Suppress hook output from logs
}
```

### Enhanced Output (AI-Interpretable)
```typescript
interface EnhancedHookOutput extends HookOutput {
  // Structured data for AI interpretation
  data?: any;
  
  // Suggestions for the AI
  suggestions?: string[];
  
  // Modified tool arguments (PreToolUse only)
  modifiedArgs?: ToolArguments;
  
  // Chain additional tools
  chainTools?: Array<{
    toolId: string;
    args: ToolArguments;
    condition?: string; // AI-evaluable condition
  }>;
  
  // Context updates
  contextUpdates?: {
    add?: Record<string, any>;
    remove?: string[];
    modify?: Record<string, any>;
  };
  
  // Message transformation (message hooks only)
  transformedContent?: string;
  
  // Priority for AI consideration (0-100)
  priority?: number;
  
  // Natural language instructions for AI
  aiInstructions?: string;
}
```

## Hook Context

Hooks receive a context object with utilities:

```typescript
interface HookContext {
  // Tool execution
  callTool: (toolId: string, args: ToolArguments) => Promise<ToolResult>;
  
  // Session data
  getSessionData: (key: string) => any;
  setSessionData: (key: string, value: any) => void;
  
  // Message access
  getAllMessages: () => Message[];
  getLastMessage: (role?: string) => Message;
  
  // File system
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  
  // Environment
  env: {
    projectDir: string;
    cwd: string;
    platform: string;
    sessionId: string;
  };
}
```

## Examples

### Security Auditing Hook

```javascript
// ~/.clanker/hooks/security-audit.js
export default async function(input, context) {
  const dangerousCommands = ['rm', 'delete', 'drop'];
  const tool = input.tool_name;
  
  if (tool === 'bash') {
    const command = input.tool_input.command;
    
    // Check for dangerous commands
    for (const dangerous of dangerousCommands) {
      if (command.includes(dangerous)) {
        await context.writeFile(
          `${context.env.projectDir}/.clanker/security.log`,
          `BLOCKED: Dangerous command attempted: ${command}\n`,
          { flag: 'a' }
        );
        
        return {
          continue: false,
          stopReason: `Command contains dangerous operation: ${dangerous}`,
          aiInstructions: 'Please use a safer alternative or ask for confirmation.'
        };
      }
    }
  }
  
  return { continue: true };
}
```

### Tool Chaining Hook

```javascript
// Automatically format code after file edits
export default async function(input, context) {
  if (input.tool_name === 'write-to-file' || input.tool_name === 'multi-edit') {
    const filePath = input.tool_input.file_path;
    
    if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
      return {
        continue: true,
        chainTools: [{
          toolId: 'bash',
          args: {
            command: `prettier --write "${filePath}"`
          }
        }],
        aiInstructions: 'Code has been automatically formatted with Prettier.'
      };
    }
  }
  
  return { continue: true };
}
```

### Message Enhancement Hook

```javascript
// Add context to user messages
export default async function(input, context) {
  if (input.role === 'user') {
    const lastTool = context.getSessionData('lastToolUsed');
    
    if (lastTool) {
      return {
        continue: true,
        transformedContent: `${input.content}\n\n[Context: Last tool used was ${lastTool}]`,
        contextUpdates: {
          add: {
            messageEnhanced: true,
            enhancementTime: new Date().toISOString()
          }
        }
      };
    }
  }
  
  return { continue: true };
}
```

## Best Practices

1. **Performance**: Keep hooks lightweight and fast
2. **Error Handling**: Always handle errors gracefully
3. **Timeouts**: Set reasonable timeouts (default: 60s)
4. **Side Effects**: Minimize side effects in hooks
5. **Documentation**: Document your hooks clearly
6. **Testing**: Test hooks in isolation before deployment

## Tool Integration

Tools can leverage the hook system for extended functionality:

```typescript
// Tool that monitors all file changes
export default async function(args: ToolArguments, context: ToolContext) {
  // Register a monitoring hook
  context.hooks.register({
    id: 'file-monitor',
    name: 'File Change Monitor',
    event: HookEvent.PostToolUse,
    matcher: 'write-to-file|multi-edit|remove',
    handler: async (input, hookContext) => {
      // Store file change history
      const history = hookContext.getSessionData('fileHistory') || [];
      history.push({
        tool: input.tool_name,
        file: input.tool_input.file_path,
        timestamp: new Date().toISOString()
      });
      hookContext.setSessionData('fileHistory', history);
      
      return { continue: true };
    }
  });
  
  // Tool can now access file history
  const history = context.hooks.getSessionData('fileHistory') || [];
  return {
    success: true,
    data: { 
      message: `Monitoring ${history.length} file changes this session`
    }
  };
}
```

## Migration Guide

For tool developers migrating to use the hook system:

1. Replace file watchers with PostToolUse hooks
2. Replace input validation with PreToolUse hooks
3. Use session data instead of global variables
4. Leverage hook chaining instead of manual tool calls
5. Use contextUpdates for state management

## Security Considerations

1. Command hooks run with user privileges
2. Function hooks can access the file system
3. Tool hooks can execute any installed tool
4. Always validate and sanitize hook inputs
5. Use matcher patterns to limit hook scope
6. Consider using read-only hooks for monitoring

## Future Enhancements

Planned improvements to the hook system:
- Hook marketplace for sharing hooks
- Visual hook editor
- Hook debugging tools
- Performance profiling
- Hook versioning and dependencies