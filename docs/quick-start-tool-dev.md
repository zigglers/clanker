# Quick Start: Tool Development

This guide will walk you through creating your first Clanker tool in 5 minutes.

## 1. Create Your Tool Project

```bash
npx create-clanker-tool
```

Answer the prompts:
- Tool name: `hello-world`
- Organization: `myorg` (or your username)
- Description: `A simple hello world tool`
- Author: Your name
- TypeScript: Yes (recommended)

## 2. Navigate to Your Project

```bash
cd hello-world
npm install
```

## 3. Edit Your Tool

Open `src/index.ts` and modify it using the modern builder pattern:

```typescript
import { createTool, ToolCategory, ToolCapability } from '@ziggler/clanker';

export default createTool()
  .id('hello_world')
  .name('Hello World')
  .description('A simple hello world tool')
  .category(ToolCategory.Utility)
  .tags('hello', 'greeting', 'example')
  
  // Define arguments
  .stringArg('name', 'Name to greet', {
    required: false,
    default: 'World'
  })
  
  // Implement execution logic
  .execute(async (args, context) => {
    const { name } = args;
    const greeting = `Hello, ${name}! 👋`;
    
    context.logger?.info(`Greeting ${name}`);
    
    return {
      success: true,
      output: greeting,
      data: {
        name,
        timestamp: new Date().toISOString()
      }
    };
  })
  
  // Add examples for documentation
  .examples([
    {
      description: 'Greet the world',
      arguments: {},
      result: 'Hello, World! 👋'
    },
    {
      description: 'Greet a specific person',
      arguments: { name: 'Alice' },
      result: 'Hello, Alice! 👋'
    }
  ])
  
  .build();
```

## 4. Build and Test Locally

```bash
# Build TypeScript
npm run build

# Bundle for distribution
npm run bundle

# Install locally for testing
npm run install:local
```

## 5. Test with Clanker

```bash
# List tools to verify it's loaded
clanker --list-tools | grep hello_world

# Test the tool
clanker --prompt "Use hello_world to greet Alice"
```

Expected output:
```
Hello, Alice! 👋
```

## 6. Development with Hot Reload

For rapid development:

```bash
# Terminal 1: Watch and rebuild
npm run dev:watch

# Terminal 2: Test your changes
clanker --prompt "Use hello_world tool"
```

## 7. Publish Your Tool

When ready to share:

```bash
npm run publish:tool
```

This will:
1. Bundle your tool
2. Generate a manifest
3. Create a PR template
4. Guide you through submission

## Important Configuration Notes

### Package.json Configuration
Your `package.json` must include:
- `"type": "module"` for ES module support
- `"main": "src/index.ts"` pointing to TypeScript source
- Modern `@ziggler/clanker` dependency (^0.2.6 or higher)
- Peer dependencies for `ink` and `react`

### TypeScript Configuration
Your `tsconfig.json` should have:
- `"module": "ES2020"` or higher
- Paths mapping: `"@ziggler/clanker": ["./node_modules/@ziggler/clanker/dist/exports"]`
- Enable `esModuleInterop` and `skipLibCheck`

## What's Next?

- Read the full [Tool Development Guide](tools.md)
- Explore the [Package Manager](package-manager.md)
- Browse [existing tools](https://github.com/ziggle-dev/clanker-tools)
- Join the [community](https://github.com/ziggle-dev/clanker/discussions)

## Example: Weather Tool

Here's a slightly more complex example using the builder pattern:

```typescript
import { createTool, ToolCategory, ToolCapability } from '@ziggler/clanker';

export default createTool()
  .id('weather')
  .name('Weather Checker')
  .description('Check weather for any location')
  .category(ToolCategory.Utility)
  .capabilities(ToolCapability.NetworkAccess)
  .tags('weather', 'forecast', 'temperature')
  
  // Arguments
  .stringArg('location', 'City name', { required: true })
  .stringArg('units', 'Temperature units', {
    required: false,
    default: 'celsius',
    enum: ['celsius', 'fahrenheit']
  })
  
  // Execute
  .execute(async (args, context) => {
    const { location, units } = args;
    
    // In a real tool, you'd call a weather API
    const temp = Math.floor(Math.random() * 30) + 10;
    const conditions = ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)];
    
    const unitSymbol = units === 'celsius' ? '°C' : '°F';
    
    context.logger?.info(`Checking weather for ${location}`);
    
    return {
      success: true,
      output: `Weather in ${location}: ${conditions}, ${temp}${unitSymbol}`,
      data: {
        location,
        temperature: temp,
        units,
        conditions
      }
    };
  })
  
  // Examples
  .examples([
    {
      description: 'Check weather in London',
      arguments: { location: 'London' },
      result: 'Weather in London: cloudy, 18°C'
    },
    {
      description: 'Check weather in Fahrenheit',
      arguments: { location: 'New York', units: 'fahrenheit' },
      result: 'Weather in New York: sunny, 72°F'
    }
  ])
  
  .build();
```

## Tips

1. **Start Simple**: Get a basic version working first
2. **Test Locally**: Use `npm run install:local` frequently
3. **Handle Errors**: Always return `{ success: false, error: '...' }` on failure
4. **Document Well**: Clear descriptions help the AI use your tool correctly
5. **Version Properly**: Use semantic versioning (1.0.0, 1.1.0, 2.0.0)

Happy tool building! 🛠️