import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWorkspaceStore } from "../store";
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
import {
  clearEditorEntries,
  edIdToPathToScrollOffsetAndCursorPos,
  OS,
  scrollOffsetAndCursorPos,
} from "../constants";
import { useHotkeys } from "react-hotkeys-hook";

// separate editor and monaco type from OnMount
type IStandaloneCodeEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];
type ITextModel = Exclude<ReturnType<IStandaloneCodeEditor["getModel"]>, null>;
type ICursorPositionChangedEvent = Parameters<
  Parameters<IStandaloneCodeEditor["onDidChangeCursorPosition"]>[0]
>[0];

// Notes
// During split editors, for some reason when a editor is disposed, the model of the last opened file in that editor is disposed as well. Then the other editors which were using that model also display nothing, and we get an error the model is disposed.
// To overcome this, we create a new model everytime, if the model is not present for that specific file path.
// Then after creating the model, we set the position and scrolltop of the editor to the last known position and scrolltop of that file.
const Editor = ({
  fileFetchStatus,
  socket,
  editorId,
}: {
  fileFetchStatus: { [key: string]: boolean };
  socket: Socket | null;
  editorId: string;
}) => {
  const selectedFilePath = useWorkspaceStore((state) => state.selectedFilePath);
  const filesContent = useWorkspaceStore((state) => state.filesContent);
  const setSelectedFilePath = useWorkspaceStore(
    (state) => state.setSelectedFilePath
  );
  const setFilesContent = useWorkspaceStore((state) => state.setFilesContent);
  const setActiveEditorId = useWorkspaceStore(
    (state) => state.setActiveEditorId
  );
  const editorIds = useWorkspaceStore((state) => state.editorIds);
  const activeEditorId = useWorkspaceStore((state) => state.activeEditorId);
  const setLastSelectedEditorIds = useWorkspaceStore(
    (state) => state.setLastSelectedEditorIds
  );
  const searchPosition = useWorkspaceStore((state) => state.searchPosition);
  const setSearchPosition = useWorkspaceStore(
    (state) => state.setSearchPosition
  );
  // const [currSelectedFilePath, setCurrSelectedFilePath] = useState(
  //   selectedFilePath[editorId]
  // );

  const currSelectedFilePath = useMemo(
    () => selectedFilePath[editorId],
    [editorId, selectedFilePath]
  );

  // This ref is just used in the callback of onDidBlurEditorText event listener to get the current selected file path.
  const currSelectedFilePathRef = useRef<string>(currSelectedFilePath);
  const [cursorPos, setCursorPos] = useState<number>(1);

  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const symbolsRef = useRef<{ [path: string]: Symbol }>({});
  const modelRef = useRef<ITextModel | null>(null);

  // useEffect(() => {
  //   setCurrSelectedFilePath(selectedFilePath[editorId]);
  // }, [editorId, setCurrSelectedFilePath, selectedFilePath]);

  // Only extract the necessary information from the navigation tree
  const getSimplifiedSymbolInfo = useCallback(
    (navigationTree: ts.NavigationTree, model: ITextModel): Symbol => {
      const { childItems, spans, nameSpan, ...rest } = navigationTree;
      const startRow = model.getPositionAt(spans[0].start).lineNumber;
      const startColumn = model.getPositionAt(spans[0].start).column;
      const endRow = model.getPositionAt(
        spans[0].start + spans[0].length
      ).lineNumber;
      const endColumn = model.getPositionAt(
        spans[0].start + spans[0].length
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
    []
  );

  const getSymbolInfo = useCallback(
    async (
      monaco: Monaco,
      model: ITextModel,
      language: "javascript" | "typescript"
    ) => {
      const getWorker =
        language === "javascript"
          ? await monaco.languages.typescript.getJavaScriptWorker()
          : await monaco.languages.typescript.getTypeScriptWorker();

      const worker = await getWorker(model.uri);

      const navigationTree = (await worker.getNavigationTree(
        model.uri.toString()
      )) as ts.NavigationTree | undefined;
      if (!navigationTree) {
        console.error("No navigationTree generated");
        return;
      }
      // Filter items which are of kind "alias"
      if (navigationTree.childItems) {
        navigationTree.childItems = navigationTree.childItems.filter(
          (child) => child.kind !== "alias"
        );
      }

      const symbolInfo = getSimplifiedSymbolInfo(navigationTree, model);

      return symbolInfo;
    },
    [getSimplifiedSymbolInfo]
  );

  const getScrollOffsetAndCursorPos = useCallback(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const cursorPos = editor.getPosition();
    if (!cursorPos) return;
    const scrollOffset = editor.getScrollTop();
    return { cursorPos, scrollOffset };
  }, []);

  const handleEditorDidMount = useCallback(
    async (
      editor: IStandaloneCodeEditor,
      monaco: Monaco,
      selectedFilePath: string,
      firstTime = false
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
          setSelectedFilePath((prev) => ({ ...prev, [editorId]: path }));
        });
      }
      let model = editor.getModel();
      if (!model || model.isDisposed()) {
        const newModel = monaco.editor.createModel(
          filesContent[selectedFilePath].content,
          filesContent[selectedFilePath].language,
          monaco.Uri.parse(selectedFilePath)
        );
        if (!newModel) return;

        editor.setModel(newModel);

        modelRef.current = newModel;
        model = newModel;
        const key = editorId + selectedFilePath;
        const temp = edIdToPathToScrollOffsetAndCursorPos[key];
        if (temp) {
          editor.setPosition(temp.cursorPos);
          editor.setScrollTop(temp.scrollOffset);
          delete edIdToPathToScrollOffsetAndCursorPos[key];
        }
      }
      modelRef.current = model;

      if (firstTime) {
        editor.onDidChangeCursorPosition((e) => {
          if (modelRef.current) {
            setCursorPos(modelRef.current.getOffsetAt(e.position));
          }
        });
        editor.onDidFocusEditorText(() => {
          setActiveEditorId(editorId);
          setLastSelectedEditorIds((prev) => {
            if (prev[prev.length - 1] === editorId) return prev;
            return [...prev, editorId];
          });
        });
        editor.onDidBlurEditorText(() => {
          const temp = getScrollOffsetAndCursorPos();

          if (temp) {
            edIdToPathToScrollOffsetAndCursorPos[
              editorId + currSelectedFilePathRef.current
            ] = temp;
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
    [
      setSelectedFilePath,
      filesContent,
      getSymbolInfo,
      setActiveEditorId,
      editorId,
      setLastSelectedEditorIds,
      getScrollOffsetAndCursorPos,
    ]
  );

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const uri = monacoRef.current.Uri.parse(currSelectedFilePath);
      const model = monacoRef.current.editor.getModel(uri);

      if (model) {
        const ediModel = editorRef.current.getModel();

        if (!ediModel || ediModel.isDisposed()) {
          editorRef.current.setModel(model);
          modelRef.current = model;
          const key = editorId + currSelectedFilePath;
          const temp = edIdToPathToScrollOffsetAndCursorPos[key];
          if (temp) {
            editorRef.current.setPosition(temp.cursorPos);
            editorRef.current.setScrollTop(temp.scrollOffset);
            delete edIdToPathToScrollOffsetAndCursorPos[key];
          }
        }
      }
      if (!model || model.isDisposed()) {
        const newModel = monacoRef.current.editor.createModel(
          filesContent[currSelectedFilePath].content,
          filesContent[currSelectedFilePath].language,
          monacoRef.current.Uri.parse(currSelectedFilePath)
        );
        if (!newModel) return;

        editorRef.current.setModel(newModel);

        modelRef.current = newModel;
        const key = editorId + currSelectedFilePath;
        const temp = edIdToPathToScrollOffsetAndCursorPos[key];
        if (temp) {
          editorRef.current.setPosition(temp.cursorPos);
          editorRef.current.setScrollTop(temp.scrollOffset);
          delete edIdToPathToScrollOffsetAndCursorPos[key];
        }
      }
    }

    if (editorId === activeEditorId) {
      editorRef.current?.focus();
    }
  }, [editorId, editorIds]);

  useEffect(() => {
    if (editorId === activeEditorId) {
      editorRef.current?.focus();
    }
  }, [editorId, activeEditorId]);

  useEffect(() => {
    if (editorId === activeEditorId) {
      editorRef.current?.focus();
    }
  }, [activeEditorId, editorId]);

  useEffect(() => {
    currSelectedFilePathRef.current = currSelectedFilePath;
    if (editorRef.current && monacoRef.current) {
      handleEditorDidMount(
        editorRef.current,
        monacoRef.current,
        currSelectedFilePath
      );
    }
  }, [currSelectedFilePath]);

  useEffect(() => {
    if (searchPosition && editorRef.current && editorId === activeEditorId) {
      setTimeout(() => {
        if (!editorRef.current) return;
        console.log("setted searchPosition in useEffect - ", searchPosition);
        const position = {
          lineNumber: searchPosition.lineNumber,
          column: searchPosition.column,
        };
        editorRef.current.setPosition(position);
        editorRef.current.revealPositionInCenter(position, 0);
        editorRef.current.setSelection({
          startLineNumber: searchPosition.lineNumber,
          startColumn: searchPosition.matchIndex,
          endLineNumber: searchPosition.lineNumber,
          endColumn: searchPosition.column,
        });
        editorRef.current.focus();
        setSearchPosition(null);
      }, 10);
    }
  }, [searchPosition, setSearchPosition]);

  const dmpRef = useRef(new DiffMatchPatch());

  const moveToOffset = useCallback((offset: number) => {
    if (!editorRef.current || !modelRef.current) {
      console.error("No editor or model instance in ref");
      return;
    }
    const position = modelRef.current.getPositionAt(offset);
    editorRef.current.setPosition(position);
    editorRef.current.revealPositionInCenter(position, 0);
    setTimeout(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
    }, 10);
  }, []);

  const handleFileEdit = useCallback(
    async (value: string | undefined) => {
      if (!value || editorId !== activeEditorId) return;
      const dmp = dmpRef.current;
      const prevValue = filesContent[currSelectedFilePath].content;

      const diffs = dmp.diff_main(prevValue, value);
      dmp.diff_cleanupSemantic(diffs);
      const patch = dmp.patch_toText(dmp.patch_make(prevValue, diffs));
      setFilesContent((prev) => ({
        ...prev,
        [currSelectedFilePath]: {
          ...prev[currSelectedFilePath],
          content: value,
        },
      }));

      let errorOccured = false;
      const prevNavigationTree = symbolsRef.current[currSelectedFilePath];
      socket?.emit(
        "file:edit",
        { path: currSelectedFilePath, patch },
        (error: Error | null, data: { success: boolean; path: string }) => {
          if (error) {
            errorOccured = true;
            setFilesContent((prev) => ({
              ...prev,
              [currSelectedFilePath]: {
                ...prev[currSelectedFilePath],
                content: prevValue,
              },
            }));
            symbolsRef.current[currSelectedFilePath] = prevNavigationTree;
            console.error(error);
            // ToDo -> show toast message
          }
        }
      );

      if (!monacoRef.current || !editorRef.current) {
        console.error("No monaco or editor instance in ref");
        return;
      }
      const language = filesContent[currSelectedFilePath].language;
      if (language === "javascript" || language === "typescript") {
        const symbol = await getSymbolInfo(
          monacoRef.current,
          modelRef.current!,
          language
        );
        if (!symbol) {
          console.error("No navigation tree returned");
          return;
        }
        if (!errorOccured) {
          symbolsRef.current[currSelectedFilePath] = symbol;
        }
      }
    },
    [
      filesContent,
      getSymbolInfo,
      setFilesContent,
      socket,
      currSelectedFilePath,
      activeEditorId,
      editorId,
    ]
  );

  const debouncedFileEdit = useMemo(
    () => debounce(handleFileEdit, 500),
    [handleFileEdit]
  );

  const closeCurrentFile = useCallback(() => {
    const {
      fileTabs,
      lastSelectedFilePaths,
      lastSelectedEditorIds,
      setLastPathBeforeClosingEditor,
      setFileTabs,
      setLastSelectedFilePaths,
      setEditorIds,
    } = useWorkspaceStore.getState();
    const newTabs = fileTabs[editorId].filter(
      (tab) => tab !== currSelectedFilePath
    );
    const filteredLastSelectedFilePaths = [
      ...lastSelectedFilePaths[editorId],
    ].filter((prevPath) => prevPath !== currSelectedFilePath);
    setFileTabs((prev) => {
      if (!(newTabs.length > 0)) {
        delete prev[editorId];
        return { ...prev };
      } else {
        return { ...prev, [editorId]: newTabs };
      }
    });
    if (newTabs.length > 0) {
      setSelectedFilePath((prev) => ({
        ...prev,
        [editorId]: filteredLastSelectedFilePaths.pop() || "",
      }));
      setLastSelectedFilePaths((prev) => ({
        ...prev,
        [editorId]: filteredLastSelectedFilePaths,
      }));
    } else {
      setLastSelectedFilePaths((prev) => {
        delete prev[editorId];
        return { ...prev };
      });
      setSelectedFilePath((prev) => {
        delete prev[editorId];
        return { ...prev };
      });
      setEditorIds((prev) => prev.filter((id) => id !== editorId));
      const filteredLastSelectedEditorIds = lastSelectedEditorIds.filter(
        (id) => id !== editorId
      );
      setActiveEditorId(filteredLastSelectedEditorIds.pop() || "");
      setLastSelectedEditorIds(filteredLastSelectedEditorIds);
      setLastPathBeforeClosingEditor(currSelectedFilePath);
    }
  }, [
    currSelectedFilePath,
    editorId,
    setActiveEditorId,
    setLastSelectedEditorIds,
    setSelectedFilePath,
  ]);

  useHotkeys(
    `${OS === "mac" ? "meta+w" : "ctrl+w"}`,
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeCurrentFile();
    },
    {
      enabled: activeEditorId === editorId,
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
  );

  if (currSelectedFilePath === "") {
    return <div className="h-full bg-emerald-400">Please select a file</div>;
  }

  if (
    filesContent[currSelectedFilePath] === undefined &&
    !fileFetchStatus[currSelectedFilePath]
  ) {
    if (currSelectedFilePath.includes("node_modules")) {
      loadNodeModulesFile(
        currSelectedFilePath,
        currSelectedFilePath.slice(currSelectedFilePath.lastIndexOf("/") + 1),
        fileFetchStatus,
        socket!
      );
    } else {
      loadFile(
        currSelectedFilePath,
        currSelectedFilePath.slice(currSelectedFilePath.lastIndexOf("/") + 1), // filename
        fileFetchStatus
      );
    }
    // Load file content
    return <div className="h-full bg-emerald-400">Loading...</div>;
  }

  if (fileFetchStatus[currSelectedFilePath]) {
    return <div className="h-full bg-emerald-400">Loading...</div>;
  }
  return (
    <div className="h-full bg-[#1B2333]">
      <FileTabBar
        editorId={editorId}
        getScrollOffsetAndCursorPos={getScrollOffsetAndCursorPos}
      />
      <div className="breadcrum_and_format_wrapper w-full h-7 flex items-center justify-between border-b border-[#2B3245]">
        <BreadCrumbWrapper
          fileFetchStatus={fileFetchStatus}
          socket={socket}
          cursorPos={cursorPos}
          filePath={currSelectedFilePath}
          moveToOffset={moveToOffset}
          breadcrumbTree={symbolsRef.current[currSelectedFilePath]}
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
        language={filesContent[currSelectedFilePath].language}
        value={filesContent[currSelectedFilePath].content}
        path={currSelectedFilePath}
        theme="vs-dark"
        onChange={debouncedFileEdit}
        options={{
          fontSize: 14,
          smoothScrolling: true,
        }}
        // overrideServices={{}}
        className="h-[calc(100%-30px)]"
        onMount={(editor, monaco) => {
          // onMount is triggered only the first time the editor is mounted
          editorRef.current = editor;
          monacoRef.current = monaco;
          if (scrollOffsetAndCursorPos[currSelectedFilePath]) {
            const { cursorPos, scrollOffset } =
              scrollOffsetAndCursorPos[currSelectedFilePath];
            editor.setPosition(cursorPos);
            editor.setScrollTop(scrollOffset);
            delete scrollOffsetAndCursorPos[currSelectedFilePath];
          }

          if (searchPosition && editorId === activeEditorId) {
            setTimeout(() => {
              if (!editor) return;
              editor.setPosition({
                lineNumber: searchPosition.lineNumber,
                column: searchPosition.column,
              });
              editor.revealPositionInCenter(
                {
                  lineNumber: searchPosition.lineNumber,
                  column: searchPosition.column,
                },
                0
              );
              editor.setSelection({
                startLineNumber: searchPosition.lineNumber,
                startColumn: searchPosition.matchIndex,
                endLineNumber: searchPosition.lineNumber,
                endColumn: searchPosition.column,
              });
              console.log(
                "setted searchPosition in onMount - ",
                searchPosition
              );
              editor.focus();
              setSearchPosition(null);
            }, 10);
          }

          editor.onDidDispose(() => {
            clearEditorEntries(editorId);
          });

          handleEditorDidMount(editor, monaco, currSelectedFilePath, true);

          monaco.editor.setTheme("grey-bg-vs-dark");
        }}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme("grey-bg-vs-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [],
            colors: {
              "editor.background": "#1B2333",
              "editorCursor.foreground": "#0179F2",
            },
          });
        }}
        key={editorId}
      ></MonacoEditor>
    </div>
  );
};
const memoizedEditor = React.memo(Editor);
memoizedEditor.displayName = "Editor";
export default memoizedEditor;
