import { MonacoLanguageClient } from "monaco-languageclient";
import {
  CloseAction,
  ErrorAction,
  MessageTransports,
} from "vscode-languageclient/browser";

// Interface for LSP configuration
export interface LSPConfig {
  languageId: string;
  lspServerUrl: string;
  documentUri: string;
}

// Class to manage LSP client lifecycle
export class LSPClientManager {
  private clients: Map<string, MonacoLanguageClient> = new Map();

  /**
   * Configure TypeScript compiler options for better IntelliSense
   * Accepts monaco instance from @monaco-editor/react
   */
  configureTypeScriptDefaults(monacoInstance: unknown) {
    // Type guard to check if monacoInstance has the expected structure
    if (
      !monacoInstance ||
      typeof monacoInstance !== "object" ||
      !("languages" in monacoInstance)
    ) {
      console.error("Invalid monaco instance provided");
      return;
    }

    const monaco = monacoInstance as {
      languages: {
        typescript: {
          javascriptDefaults: {
            setCompilerOptions: (options: Record<string, unknown>) => void;
            setDiagnosticsOptions: (options: Record<string, boolean>) => void;
          };
          typescriptDefaults: {
            setCompilerOptions: (options: Record<string, unknown>) => void;
            setDiagnosticsOptions: (options: Record<string, boolean>) => void;
          };
          ScriptTarget: Record<string, number>;
          ModuleResolutionKind: Record<string, number>;
          ModuleKind: Record<string, number>;
          JsxEmit: Record<string, number>;
        };
      };
    };

    // Configure JavaScript defaults
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution:
        monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: "React",
      allowJs: true,
      typeRoots: ["node_modules/@types"],
    });

    // Configure TypeScript defaults
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution:
        monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: "React",
      typeRoots: ["node_modules/@types"],
    });

    // Enable diagnostics
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    console.log("TypeScript defaults configured");
  }

  /**
   * Create and start an LSP client for a specific language
   * This connects to a language server via WebSocket for advanced language features
   * Note: Currently a stub implementation - requires proper message transport implementation
   */
  async createLanguageClient(config: LSPConfig): Promise<MonacoLanguageClient> {
    const { languageId, lspServerUrl, documentUri } = config;

    // Check if client already exists for this language
    if (this.clients.has(languageId)) {
      return this.clients.get(languageId)!;
    }

    try {
      // Create a WebSocket connection for LSP communication
      const webSocket = new WebSocket(lspServerUrl);

      await new Promise<void>((resolve, reject) => {
        webSocket.addEventListener("open", () => resolve());
        webSocket.addEventListener("error", (error) => reject(error));
      });

      // IMPORTANT: This is a stub implementation
      // For production use, you need to implement proper WebSocket message reader/writer
      // using a library like 'vscode-ws-jsonrpc' or similar
      
      // Validate that this is not being used in production without proper implementation
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "LSP client transport is not fully implemented. " +
          "Please implement proper WebSocket message reader/writer before using in production."
        );
      }

      // Stub message transports - DO NOT USE IN PRODUCTION
      const messageTransports: MessageTransports = {
        reader: {
          // Simplified reader - in production, use proper implementation
          listen: () => {
            console.warn("LSP reader.listen() called but not implemented");
          },
          onError: () => {
            console.warn("LSP reader.onError() called but not implemented");
          },
          onClose: () => {
            console.warn("LSP reader.onClose() called but not implemented");
          },
          onPartialMessage: () => {
            console.warn("LSP reader.onPartialMessage() called but not implemented");
          },
          dispose: () => {
            console.warn("LSP reader.dispose() called but not implemented");
          },
        } as unknown as MessageTransports["reader"],
        writer: {
          // Simplified writer - in production, use proper implementation
          write: () => {
            console.warn("LSP writer.write() called but not implemented");
            return Promise.resolve();
          },
          end: () => {
            console.warn("LSP writer.end() called but not implemented");
          },
          onError: () => {
            console.warn("LSP writer.onError() called but not implemented");
          },
          onClose: () => {
            console.warn("LSP writer.onClose() called but not implemented");
          },
          dispose: () => {
            console.warn("LSP writer.dispose() called but not implemented");
          },
        } as unknown as MessageTransports["writer"],
      };

      // Create the language client
      const client = new MonacoLanguageClient({
        name: `${languageId} Language Client`,
        clientOptions: {
          documentSelector: [{ language: languageId }],
          errorHandler: {
            error: () => ({ action: ErrorAction.Continue }),
            closed: () => ({ action: CloseAction.DoNotRestart }),
          },
          workspaceFolder: {
            uri: documentUri,
            name: "workspace",
            index: 0,
          },
        },
        messageTransports,
      });

      // Start the client
      await client.start();

      // Store the client
      this.clients.set(languageId, client);

      console.log(`LSP client started for ${languageId}`);
      return client;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to create LSP client for ${languageId}: ${errorMessage}`);
      
      // Wrap in a more user-friendly error
      throw new Error(
        `Unable to connect to language server for ${languageId}. ` +
        `Please ensure the language server is running and accessible at ${lspServerUrl}. ` +
        `Details: ${errorMessage}`
      );
    }
  }

  /**
   * Stop a specific language client
   */
  async stopLanguageClient(languageId: string): Promise<void> {
    const client = this.clients.get(languageId);
    if (client) {
      await client.stop();
      this.clients.delete(languageId);
      console.log(`LSP client stopped for ${languageId}`);
    }
  }

  /**
   * Stop all language clients
   */
  async stopAll(): Promise<void> {
    const promises = Array.from(this.clients.keys()).map((languageId) =>
      this.stopLanguageClient(languageId)
    );
    await Promise.all(promises);
  }

  /**
   * Get a specific language client
   */
  getClient(languageId: string): MonacoLanguageClient | undefined {
    return this.clients.get(languageId);
  }

  /**
   * Check if a client exists for a language
   */
  hasClient(languageId: string): boolean {
    return this.clients.has(languageId);
  }
}

// Singleton instance
let lspClientManager: LSPClientManager | null = null;

/**
 * Get or create the LSP client manager singleton
 */
export function getLSPClientManager(): LSPClientManager {
  if (!lspClientManager) {
    lspClientManager = new LSPClientManager();
  }
  return lspClientManager;
}
