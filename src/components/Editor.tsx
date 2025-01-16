import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileContentObj, useWorkspaceStore } from "../store";
import { loadFile, loadNodeModulesFile } from "../helpers";
import { Editor as MonacoEditor, OnMount } from "@monaco-editor/react";
import { Symbol } from "../types/symbol";
import githubDarkTheme from "../lib/github-dark-theme";
import debounce from "lodash.debounce";
import * as ts from "typescript";
// @ts-ignore
import DiffMatchPatch from "diff-match-patch";

import FileTabBar from "./FileTabBar";
import { Socket } from "socket.io-client";
import BreadCrumbWrapper from "./BreadcrumbWrapper";
import { FormatSVG } from "./BreadcrumbIconsSvg";

// separate editor and monaco type from OnMount
type IStandaloneCodeEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];
type ITextModel = Exclude<ReturnType<IStandaloneCodeEditor["getModel"]>, null>;
type ICursorPositionChangedEvent = Parameters<
  Parameters<IStandaloneCodeEditor["onDidChangeCursorPosition"]>[0]
>[0];

const Editor = ({
  fileFetchStatus,
  socket,
}: {
  fileFetchStatus: { [key: string]: boolean };
  socket: Socket | null;
}) => {
  const selectedFilePath = useWorkspaceStore((state) => state.selectedFilePath);
  const filesContent = useWorkspaceStore((state) => state.filesContent);
  const setSelectedFilePath = useWorkspaceStore(
    (state) => state.setSelectedFilePath,
  );
  const setFilesContent = useWorkspaceStore((state) => state.setFilesContent);
  const [cursorPos, setCursorPos] = useState<number>(1);

  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const symbolsRef = useRef<{ [path: string]: Symbol }>({});
  const modelRef = useRef<ITextModel | null>(null);

  // Only extract the necessary information from the navigation tree
  const getSimplifiedSymbolInfo = useCallback(
    (navigationTree: ts.NavigationTree, model: ITextModel): Symbol => {
      const { childItems, spans, nameSpan, ...rest } = navigationTree;
      const startRow = model.getPositionAt(spans[0].start).lineNumber;
      const startColumn = model.getPositionAt(spans[0].start).column;
      const endRow = model.getPositionAt(
        spans[0].start + spans[0].length,
      ).lineNumber;
      const endColumn = model.getPositionAt(
        spans[0].start + spans[0].length,
      ).column;
      const symbol: Symbol = {
        ...rest,
        startOffset: model.getOffsetAt({
          column: startColumn,
          lineNumber: startRow,
        }),
        endOffset: model.getOffsetAt({ column: endColumn, lineNumber: endRow }),
        childItems: [],
      };

      if (navigationTree.childItems) {
        navigationTree.childItems.forEach((childItem) => {
          symbol.childItems.push(getSimplifiedSymbolInfo(childItem, model));
        });
      }
      // kind, kindModifiers, text, spans: start, length
      return symbol;
    },
    [],
  );

  const getSymbolInfo = useCallback(
    async (
      monaco: Monaco,
      model: ITextModel,
      language: "javascript" | "typescript",
    ) => {
      const getWorker =
        language === "javascript"
          ? await monaco.languages.typescript.getJavaScriptWorker()
          : await monaco.languages.typescript.getTypeScriptWorker();

      const worker = await getWorker(model.uri);

      const navigationTree = (await worker.getNavigationTree(
        model.uri.toString(),
      )) as ts.NavigationTree | undefined;
      if (!navigationTree) {
        console.error("No navigationTree generated");
        return;
      }
      // Filter items which are of kind "alias"
      if (navigationTree.childItems) {
        navigationTree.childItems = navigationTree.childItems.filter(
          (child) => child.kind !== "alias",
        );
      }

      const symbolInfo = getSimplifiedSymbolInfo(navigationTree, model);

      return symbolInfo;
    },
    [getSimplifiedSymbolInfo],
  );

  const handleEditorDidMount = useCallback(
    async (
      editor: IStandaloneCodeEditor,
      monaco: Monaco,
      selectedFilePath: string,
      firstTime = false,
    ) => {
      editor.focus();

      const editorDomNode = editor.getDomNode();

      if (editorDomNode) {
        editorDomNode.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        });

        editorDomNode.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const path = e.dataTransfer.getData("text/plain");
          if (path === selectedFilePath) return;
          setSelectedFilePath(path);
        });
      }
      const model = editor.getModel();
      modelRef.current = model;
      if (firstTime) {
        editor.onDidChangeCursorPosition((e) => {
          if (modelRef.current) {
            setCursorPos(modelRef.current.getOffsetAt(e.position));
          }
        });
      }

      if (symbolsRef.current[selectedFilePath]) return;

      const language = filesContent[selectedFilePath].language;

      if (language === "javascript" || language === "typescript") {
        const symbol = await getSymbolInfo(monaco, modelRef.current!, language);
        if (!symbol) {
          console.error("No navigation tree returned");
          return;
        }
        symbolsRef.current[selectedFilePath] = symbol;
      }
    },
    [setSelectedFilePath, filesContent, getSymbolInfo],
  );

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      handleEditorDidMount(
        editorRef.current,
        monacoRef.current,
        selectedFilePath,
      );
    }
  }, [selectedFilePath, handleEditorDidMount]);

  const dmpRef = useRef(new DiffMatchPatch());

  const moveToOffset = useCallback((offset: number) => {
    if (!editorRef.current || !modelRef.current) {
      console.error("No editor or model instance in ref");
      return;
    }
    const position = modelRef.current.getPositionAt(offset);
    editorRef.current.setPosition(position);
    editorRef.current.revealPositionInCenter(position);
    setTimeout(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
    }, 10);
  }, []);

  const handleFileEdit = useCallback(
    async (value: string | undefined) => {
      if (!value) return;
      const dmp = dmpRef.current;
      const prevValue = filesContent[selectedFilePath].content;

      const diffs = dmp.diff_main(prevValue, value);
      dmp.diff_cleanupSemantic(diffs);
      const patch = dmp.patch_toText(dmp.patch_make(prevValue, diffs));
      setFilesContent((prev) => ({
        ...prev,
        [selectedFilePath]: { ...prev[selectedFilePath], content: value },
      }));

      let errorOccured = false;
      const prevNavigationTree = symbolsRef.current[selectedFilePath];
      socket?.emit(
        "file:edit",
        { path: selectedFilePath, patch },
        (error: Error | null, data: { success: boolean; path: string }) => {
          if (error) {
            errorOccured = true;
            setFilesContent((prev) => ({
              ...prev,
              [selectedFilePath]: {
                ...prev[selectedFilePath],
                content: prevValue,
              },
            }));
            symbolsRef.current[selectedFilePath] = prevNavigationTree;
            console.error(error);
            // ToDo -> show toast message
          }
        },
      );

      if (!monacoRef.current || !editorRef.current) {
        console.error("No monaco or editor instance in ref");
        return;
      }
      const language = filesContent[selectedFilePath].language;
      if (language === "javascript" || language === "typescript") {
        const symbol = await getSymbolInfo(
          monacoRef.current,
          modelRef.current!,
          language,
        );
        if (!symbol) {
          console.error("No navigation tree returned");
          return;
        }
        if (!errorOccured) {
          symbolsRef.current[selectedFilePath] = symbol;
        }
      }
    },
    [filesContent, getSymbolInfo, selectedFilePath, setFilesContent, socket],
  );

  // const debouncedFileEdit = useCallback(debounce(handleFileEdit, 500), [
  //   handleFileEdit,
  // ]);

  // const debouncedFileEdit = useCallback(
  //   (value: string | undefined) => {
  //     debounce(handleFileEdit, 500)(value);
  //   },
  //   [handleFileEdit],
  // );
  const debouncedFileEdit = useMemo(
    () => debounce(handleFileEdit, 500),
    [handleFileEdit],
  );

  // const request = debounce(async (value: string | undefined) => {
  //   handleFileEdit(value);
  // }, 800);

  // const debouncedFileEdit = useCallback((value: string | undefined) => {
  //   request(value);
  // }, []);

  if (selectedFilePath === "") {
    return <div className="h-full bg-emerald-400">Please select a file</div>;
  }

  if (
    filesContent[selectedFilePath] === undefined &&
    !fileFetchStatus[selectedFilePath]
  ) {
    if (selectedFilePath.includes("node_modules")) {
      loadNodeModulesFile(
        selectedFilePath,
        selectedFilePath.slice(selectedFilePath.lastIndexOf("/") + 1),
        fileFetchStatus,
        socket!,
      );
    } else {
      loadFile(
        selectedFilePath,
        selectedFilePath.slice(selectedFilePath.lastIndexOf("/") + 1), // filename
        fileFetchStatus,
      );
    }
    // Load file content
    return <div className="h-full bg-emerald-400">Loading...</div>;
  }

  if (fileFetchStatus[selectedFilePath]) {
    return <div className="h-full bg-emerald-400">Loading...</div>;
  }
  return (
    <div className="h-full bg-[#1B2333]">
      <FileTabBar />
      <div className="breadcrum_and_format_wrapper w-full h-7 flex items-center justify-between border-b border-[#2B3245]">
        <BreadCrumbWrapper
          fileFetchStatus={fileFetchStatus}
          socket={socket}
          cursorPos={cursorPos}
          filePath={selectedFilePath}
          moveToOffset={moveToOffset}
          breadcrumbTree={symbolsRef.current[selectedFilePath]}
        />
        <button
          onClick={() =>
            editorRef?.current?.getAction("editor.action.formatDocument")?.run()
          }
          className="text-[#868C96] hover:text-[#F5F9FC] flex items-center gap-1 group bg-[#1B2333] text-xs h-[98%] p-1 hover:bg-[#3C445C] rounded-md"
        >
          <FormatSVG className="group-hover:fill-[#F5F9FC]" />
          <span className="">Format</span>
        </button>
      </div>
      <MonacoEditor
        language={filesContent[selectedFilePath].language}
        value={filesContent[selectedFilePath].content}
        path={selectedFilePath}
        theme="vs-dark"
        onChange={debouncedFileEdit}
        options={{
          fontSize: 14,
        }}
        // overrideServices={{}}
        className="h-[calc(100%-30px)]"
        onMount={(editor, monaco) => {
          editorRef.current = editor;
          monacoRef.current = monaco;
          handleEditorDidMount(editor, monaco, selectedFilePath, true);

          monaco.editor.setTheme("grey-bg-vs-dark");
        }}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme("grey-bg-vs-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [],
            colors: { "editor.background": "#1B2333" },
          });
        }}
      ></MonacoEditor>
    </div>
  );
};
const memoizedEditor = React.memo(Editor);
memoizedEditor.displayName = "Editor";
export default memoizedEditor;
