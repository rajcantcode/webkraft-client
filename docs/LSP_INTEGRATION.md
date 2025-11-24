# LSP Integration for Monaco Editor

This document describes the Language Server Protocol (LSP) integration added to the Monaco Editor in this project.

## Overview

The LSP integration enhances the Monaco Editor with improved language intelligence and provides a foundation for connecting to external language servers. The implementation consists of:

1. **LSP Client Manager** (`src/lib/lsp-client.ts`) - Core service for managing LSP connections
2. **LSP Client Hook** (`src/hooks/use-lsp-client.ts`) - React hook for easy integration
3. **Enhanced TypeScript/JavaScript support** - Improved IntelliSense configuration

## Features

### Built-in Enhancements

The integration immediately provides:

- **Enhanced TypeScript/JavaScript IntelliSense** with optimized compiler options
- **Better diagnostics** for syntax and semantic validation
- **React/JSX support** out of the box
- **ES2020 target** with modern JavaScript features

### External LSP Server Support

The architecture supports connecting to external language servers via WebSocket for:

- Advanced code completion
- Real-time diagnostics
- Code navigation (go to definition, find references)
- Code actions and refactoring
- Support for additional languages (Python, Java, Go, etc.)

## Usage

### Basic Usage (Built-in Support)

The LSP integration is automatically enabled in the Editor component. No additional configuration is required for basic TypeScript/JavaScript features.

```typescript
// In Editor.tsx
import { useLSPClient } from "../hooks/use-lsp-client";

// Initialize LSP support
useLSPClient(
  monacoRef.current,  // Monaco instance from OnMount
  currentLanguage,     // e.g., "typescript", "javascript"
  undefined,           // No external LSP server
  currSelectedFilePath.path
);
```

### With External LSP Server

To connect to an external language server:

```typescript
useLSPClient(
  monacoRef.current,
  currentLanguage,
  "ws://localhost:3001/lsp/typescript",  // LSP server WebSocket URL
  currSelectedFilePath.path
);
```

## Configuration

### TypeScript/JavaScript Compiler Options

The following compiler options are automatically configured:

```typescript
{
  target: ScriptTarget.ES2020,
  allowNonTsExtensions: true,
  moduleResolution: ModuleResolutionKind.NodeJs,
  module: ModuleKind.CommonJS,
  noEmit: true,
  esModuleInterop: true,
  jsx: JsxEmit.React,
  reactNamespace: "React",
  allowJs: true,
  typeRoots: ["node_modules/@types"]
}
```

### Diagnostics

Both semantic and syntax validation are enabled for better error detection:

```typescript
{
  noSemanticValidation: false,
  noSyntaxValidation: false
}
```

## Architecture

### LSPClientManager

The `LSPClientManager` class provides:

- **Singleton pattern** for managing LSP clients across the application
- **Client lifecycle management** (create, start, stop)
- **TypeScript configuration** for built-in language services
- **WebSocket-based communication** with external language servers

Methods:
- `configureTypeScriptDefaults(monaco)` - Configures built-in TS/JS support
- `createLanguageClient(config)` - Creates and starts an LSP client
- `stopLanguageClient(languageId)` - Stops a specific language client
- `getClient(languageId)` - Retrieves an existing client
- `hasClient(languageId)` - Checks if a client exists

### useLSPClient Hook

React hook that:
- Initializes the LSP manager
- Configures TypeScript/JavaScript defaults (once per session)
- Optionally connects to external LSP servers
- Handles graceful fallback if LSP server is unavailable

## Dependencies

The following packages are required:

```json
{
  "monaco-languageclient": "^10.3.0",
  "vscode-languageclient": "^9.0.1",
  "vscode-languageserver-protocol": "^3.17.5",
  "vscode-jsonrpc": "^8.2.1"
}
```

## Backend Requirements

To use external LSP servers, your backend needs to:

1. **Expose a WebSocket endpoint** for each language (e.g., `/lsp/typescript`)
2. **Run a language server** process (e.g., TypeScript Language Server, Pyright for Python)
3. **Bridge WebSocket messages** to the language server using LSP protocol

Example endpoint structure:
```
ws://your-server.com/lsp/typescript
ws://your-server.com/lsp/python
ws://your-server.com/lsp/java
```

## Extending for More Languages

To add support for additional languages:

1. Ensure a language server is available for that language
2. Configure the backend to expose a WebSocket endpoint
3. Call `useLSPClient` with the appropriate language ID and server URL

Example for Python:
```typescript
useLSPClient(
  monacoRef.current,
  "python",
  "ws://localhost:3001/lsp/python",
  currentFilePath
);
```

## Troubleshooting

### LSP Client Fails to Connect

If the external LSP server connection fails, the application will:
- Log a warning to the console
- Fall back to Monaco's built-in language services
- Continue to function normally

Check:
1. Backend LSP endpoint is running and accessible
2. WebSocket URL is correct
3. CORS/security policies allow WebSocket connections
4. Language server is properly configured on the backend

### TypeScript Configuration Not Applied

Verify:
1. Monaco instance is properly passed to the hook
2. Hook is called after Monaco is initialized (in the `onMount` callback)
3. Console shows "TypeScript defaults configured" message

## Future Enhancements

Potential improvements:

1. **Complete WebSocket message transport** - Implement full LSP message reader/writer
2. **Multi-file analysis** - Support for understanding imports and dependencies
3. **Workspace features** - Project-wide refactoring and navigation
4. **Additional language servers** - Python (Pyright), Java (Eclipse JDT), Go (gopls), etc.
5. **LSP server health monitoring** - Automatic reconnection and status indicators
6. **Performance optimization** - Caching, debouncing, and lazy loading

## References

- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [monaco-languageclient](https://github.com/TypeFox/monaco-languageclient)
- [VS Code Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
