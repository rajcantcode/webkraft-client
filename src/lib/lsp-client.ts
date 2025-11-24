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

      // Create message transports using WebSocket
      // Note: For a complete implementation, you would need to implement
      // WebSocket message reader/writer or use a library that provides them
      // This is a placeholder that shows the structure
      const messageTransports: MessageTransports = {
        reader: {
          // Simplified reader - in production, use proper implementation
          listen: () => {
            // Implementation required
          },
          onError: () => {
            // Implementation required
          },
          onClose: () => {
            // Implementation required
          },
          onPartialMessage: () => {
            // Implementation required
          },
          dispose: () => {
            // Implementation required
          },
        } as unknown as MessageTransports["reader"],
        writer: {
          // Simplified writer - in production, use proper implementation
          write: () => Promise.resolve(),
          end: () => {
            // Implementation required
          },
          onError: () => {
            // Implementation required
          },
          onClose: () => {
            // Implementation required
          },
          dispose: () => {
            // Implementation required
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
      console.error(`Failed to create LSP client for ${languageId}:`, error);
      throw error;
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
