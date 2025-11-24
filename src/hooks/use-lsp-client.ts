import { useEffect, useRef } from "react";
import { getLSPClientManager } from "../lib/lsp-client";

/**
 * Hook to initialize LSP support for Monaco Editor
 * Configures TypeScript defaults and optionally connects to external LSP servers
 */
export function useLSPClient(
  monacoInstance: any | null, // Monaco instance from @monaco-editor/react OnMount
  languageId: string,
  lspServerUrl?: string,
  documentUri?: string
) {
  const lspManagerRef = useRef(getLSPClientManager());
  const isConfiguredRef = useRef(false);

  useEffect(() => {
    // Skip if monaco is not available
    if (!monacoInstance) {
      return;
    }

    const manager = lspManagerRef.current;

    // Configure TypeScript/JavaScript defaults (only once)
    if (!isConfiguredRef.current && monacoInstance.languages) {
      manager.configureTypeScriptDefaults(monacoInstance);
      isConfiguredRef.current = true;
    }

    // If LSP server URL is provided, try to connect to external language server
    if (lspServerUrl && documentUri && languageId) {
      const initializeClient = async () => {
        try {
          // Check if client already exists
          if (!manager.hasClient(languageId)) {
            console.log(`Initializing external LSP client for ${languageId}`);
            await manager.createLanguageClient({
              languageId,
              lspServerUrl,
              documentUri,
            });
          }
        } catch (error) {
          // LSP connection failed, but Monaco will still work with built-in services
          console.warn(
            `External LSP server not available for ${languageId}, using built-in Monaco language services`
          );
        }
      };

      initializeClient();
    }

    // No cleanup needed - clients persist across file changes
  }, [monacoInstance, languageId, lspServerUrl, documentUri]);

  // Return the manager in case components need access to it
  return lspManagerRef.current;
}
