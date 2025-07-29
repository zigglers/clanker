# Clanker Session Management

Clanker's Session Management system (introduced in v0.3.0) provides persistent conversation tracking, automatic saving, and comprehensive session lifecycle management. Sessions ensure your conversations, context, and tool execution history are preserved across Clanker restarts.

## Overview

Sessions automatically:
- Track all messages and tool executions
- Save conversation history periodically
- Preserve context between Clanker runs
- Export transcripts for analysis
- Integrate with the hook system

## Session Lifecycle

### 1. Session Creation
When you start Clanker, it automatically:
- Checks for existing sessions
- Creates a new session with a unique ID
- Fires the `SessionStart` hook
- Begins tracking messages and tool executions

### 2. Session Persistence
Sessions are automatically saved:
- Every 30 seconds (configurable)
- When tool executions complete
- On graceful shutdown
- When explicitly requested

### 3. Session Resume
When restarting Clanker:
- The last active session is automatically resumed
- Full conversation history is restored
- Context and metadata are preserved
- Work continues seamlessly

## Session Data Structure

### Session State
```typescript
interface SessionState {
  metadata: SessionMetadata;
  messages: SessionMessage[];
  toolCalls: Map<string, GrokToolCall>;
  toolResults: Map<string, ToolResult>;
  context: Record<string, any>;
  hookData: Record<string, any>;
}
```

### Session Metadata
```typescript
interface SessionMetadata {
  id: string;              // Unique session identifier
  created: Date;           // Session creation timestamp
  updated: Date;           // Last update timestamp
  title?: string;          // Optional session title
  description?: string;    // Optional description
  tags?: string[];         // Optional tags for organization
  projectPath?: string;    // Associated project directory
  model?: string;          // AI model used
  provider?: string;       // AI provider
}
```

### Session Messages
```typescript
interface SessionMessage {
  id: string;                      // Unique message ID
  timestamp: Date;                 // Message timestamp
  role: string;                    // user/assistant/system/tool
  content?: string;                // Message content
  tool_calls?: GrokToolCall[];     // Tool invocations
  tool_call_id?: string;           // Tool response ID
  tokenCount?: number;             // Token usage
  metadata?: Record<string, any>;  // Custom metadata
  hookResults?: any[];             // Hook execution results
}
```

## Configuration

### Session Settings
Configure sessions in `~/.clanker/settings.json`:

```json
{
  "session": {
    "autoSave": true,           // Enable auto-save (default: true)
    "autoSaveInterval": 30000,  // Auto-save interval in ms (default: 30000)
    "maxMessages": 1000,        // Max messages before compaction (default: 1000)
    "compactThreshold": 500     // Compact when this many messages (default: 500)
  }
}
```

### Storage Location
Sessions are stored in:
- `~/.clanker/sessions/` - Session data files
- `~/.clanker/sessions/transcripts/` - Exported transcripts

## Session Commands

While sessions are managed automatically, you can interact with them:

### In-Chat Commands
```bash
# View current session info
> /session

# Export current session
> /export

# Clear and start new session
> /clear
```

### CLI Options
```bash
# Resume specific session
clanker --session <session-id>

# Start new session with title
clanker --new-session "Project refactoring"
```

## Session Features

### 1. Message History
All messages are preserved with:
- Timestamps
- Role identification
- Token counts
- Hook results
- Custom metadata

### 2. Tool Execution Tracking
Every tool execution is recorded:
- Tool name and arguments
- Execution results
- Timing information
- Error states

### 3. Context Preservation
Session context includes:
- Working directory
- Environment variables
- Custom key-value pairs
- Hook-injected data

### 4. Hook Integration
Sessions integrate seamlessly with hooks:
- Hook data is persisted
- Hook results are tracked
- Session events trigger hooks
- Hooks can modify session data

## Working with Sessions Programmatically

### In Tools
Tools can access and modify session data:

```typescript
export default async function(args: ToolArguments, context: ToolContext) {
  // Get current session ID
  const sessionId = context.session.getId();
  
  // Add custom context
  context.session.updateContext('toolData', {
    lastRun: new Date(),
    customField: 'value'
  });
  
  // Get session metadata
  const metadata = context.session.getMetadata();
  console.log(`Working in session: ${metadata.title || sessionId}`);
  
  // Access message history
  const messages = context.session.getMessages();
  const lastUserMessage = context.session.getLastMessage('user');
  
  return {
    success: true,
    data: { sessionInfo: metadata }
  };
}
```

### In Hooks
Hooks can interact with sessions:

```javascript
// Session start hook
export default async function(input, context) {
  if (input.hook_event_name === 'SessionStart') {
    // Set session title based on project
    const projectName = path.basename(context.env.projectDir);
    
    context.setSessionData('projectName', projectName);
    
    return {
      continue: true,
      aiInstructions: `You're working on the ${projectName} project.`
    };
  }
  
  return { continue: true };
}
```

## Session Events

Sessions emit events that can be monitored:

### SessionEvent Enum
```typescript
enum SessionEvent {
  Created = 'created',
  Loaded = 'loaded',
  Saved = 'saved',
  MessageAdded = 'messageAdded',
  ToolExecuted = 'toolExecuted',
  ContextUpdated = 'contextUpdated',
  Closed = 'closed'
}
```

### Event Handling
```javascript
// In a hook or tool
context.session.on(SessionEvent.MessageAdded, (message) => {
  console.log(`New message: ${message.role} - ${message.id}`);
});
```

## Transcript Export

Sessions can be exported as JSONL transcripts:

### Export Format
Each line is a JSON object:
```json
{"timestamp":"2025-07-29T10:00:00Z","role":"user","content":"Hello"}
{"timestamp":"2025-07-29T10:00:01Z","role":"assistant","content":"Hi! How can I help?"}
{"timestamp":"2025-07-29T10:00:05Z","role":"tool","content":"Tool output...","tool_calls":[...]}
```

### Export Methods

1. **In-chat export**:
```bash
> /export
# Saves to ~/.clanker/sessions/transcripts/<session-id>.jsonl
```

2. **Programmatic export**:
```typescript
const transcriptPath = await context.session.exportTranscript();
// Or specify custom path
const customPath = await context.session.exportTranscript('./my-transcript.jsonl');
```

## Session Management API

### SessionManager Methods

```typescript
class SessionManager {
  // Get session ID
  getId(): string;
  
  // Get/update metadata
  getMetadata(): SessionMetadata;
  updateMetadata(updates: Partial<SessionMetadata>): void;
  
  // Message operations
  async addMessage(message: GrokMessage, metadata?: any): Promise<SessionMessage>;
  getMessages(): SessionMessage[];
  getMessagesByRole(role: string): SessionMessage[];
  getLastMessages(n: number): SessionMessage[];
  
  // Tool tracking
  async addToolExecution(toolCall: GrokToolCall, result: ToolResult): Promise<void>;
  
  // Context management
  updateContext(key: string, value: any): void;
  getContext(key?: string): any;
  
  // Hook data
  updateHookData(hookId: string, data: any): void;
  getHookData(hookId?: string): any;
  
  // Persistence
  async save(): Promise<void>;
  async exportTranscript(outputPath?: string): Promise<string>;
  async close(): Promise<void>;
  
  // Static methods
  static async load(sessionId: string, hookManager: HookManager): Promise<SessionManager>;
  static async listSessions(): Promise<SessionMetadata[]>;
}
```

## Best Practices

### 1. Session Hygiene
- Let auto-save handle persistence
- Use meaningful session titles
- Tag sessions for organization
- Export important sessions

### 2. Context Management
- Store only serializable data
- Use meaningful context keys
- Clean up temporary context
- Document context structure

### 3. Performance
- Sessions auto-compact at thresholds
- Old messages are summarized
- Large data should be referenced, not stored
- Regular exports reduce session size

### 4. Integration
- Use hooks for session initialization
- Track important events
- Leverage session data in tools
- Export for external analysis

## Examples

### Custom Session Initialization

```javascript
// .clanker/hooks/session-init.js
export default async function(input, context) {
  if (input.source === 'startup') {
    // Set project-specific context
    const packageJson = await context.readFile('./package.json')
      .catch(() => null);
    
    if (packageJson) {
      const pkg = JSON.parse(packageJson);
      context.setSessionData('project', {
        name: pkg.name,
        version: pkg.version,
        type: 'node'
      });
      
      return {
        continue: true,
        aiInstructions: `Working on ${pkg.name} v${pkg.version}`
      };
    }
  }
  
  return { continue: true };
}
```

### Session-Aware Tool

```typescript
// Tool that uses session history
export default async function(args: ToolArguments, context: ToolContext) {
  const messages = context.session.getMessages();
  
  // Count tool usage in this session
  const toolUsage = messages.reduce((acc, msg) => {
    if (msg.tool_calls) {
      msg.tool_calls.forEach(call => {
        const toolName = call.function.name;
        acc[toolName] = (acc[toolName] || 0) + 1;
      });
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Update session context
  context.session.updateContext('toolUsageStats', toolUsage);
  
  return {
    success: true,
    data: {
      sessionId: context.session.getId(),
      messageCount: messages.length,
      toolUsage
    }
  };
}
```

### Session Export Hook

```javascript
// Automatically export sessions with errors
export default async function(input, context) {
  if (input.hook_event_name === 'PostToolUse') {
    if (!input.tool_response.success) {
      // Mark session for export
      const errorCount = context.getSessionData('errorCount') || 0;
      context.setSessionData('errorCount', errorCount + 1);
      
      // Export if too many errors
      if (errorCount >= 5) {
        const transcript = await context.session.exportTranscript();
        console.error(`Session exported due to errors: ${transcript}`);
      }
    }
  }
  
  return { continue: true };
}
```

## Troubleshooting

### Session Not Saving
1. Check auto-save is enabled
2. Verify write permissions to `~/.clanker/sessions/`
3. Check for disk space
4. Look for errors in debug logs

### Session Not Loading
1. Verify session file exists
2. Check file isn't corrupted
3. Ensure proper permissions
4. Try manual load with session ID

### Large Session Files
1. Sessions auto-compact at thresholds
2. Export and archive old sessions
3. Adjust `maxMessages` setting
4. Clear unnecessary context data

## Security Considerations

1. Sessions may contain sensitive data
2. Stored in plain JSON (not encrypted)
3. File permissions should be restricted
4. Don't commit session files to version control
5. Sanitize before sharing transcripts

## Future Enhancements

Planned improvements:
- Session encryption options
- Cloud session backup
- Session branching/merging
- Advanced search across sessions
- Session templates
- Collaborative sessions