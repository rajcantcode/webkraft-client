import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SelectedFilePath, useGitStore, useWorkspaceStore } from "../store";
import { getFileLanguage, loadFile, loadNodeModulesFile } from "../helpers";
import {
  Editor as MonacoEditor,
  OnMount,
  DiffEditor,
  MonacoDiffEditor,
  EditorProps,
} from "@monaco-editor/react";
import { Symbol } from "../types/symbol";
import githubDarkTheme from "../lib/github-dark-theme";
import debounce from "lodash.debounce";
import * as ts from "typescript";
// @ts-expect-error - DiffMatchPatch doesn't have TypeScript definitions
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
import { parsePatch, reversePatch, applyPatch, createPatch } from "diff";
import { useLSPClient } from "../hooks/use-lsp-client";

// separate editor and monaco type from OnMount
type IStandaloneCodeEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];
type ITextModel = Exclude<ReturnType<IStandaloneCodeEditor["getModel"]>, null>;
type IDiffEditorModel = Exclude<ReturnType<MonacoDiffEditor["getModel"]>, null>;
type ICursorPositionChangedEvent = Parameters<
  Parameters<IStandaloneCodeEditor["onDidChangeCursorPosition"]>[0]
>[0];
type onchangeEvent = Parameters<EditorProps["onChange"]>[1];

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
  const repoInfo = useGitStore((state) => state.repoInfo);
  const setRepoInfo = useGitStore((state) => state.setRepoInfo);
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
  const currSelectedFilePathRef = useRef(currSelectedFilePath);
  const [cursorPos, setCursorPos] = useState<number>(1);

  const editorRef = useRef<IStandaloneCodeEditor | MonacoDiffEditor | null>(
    null
  );
  const monacoRef = useRef<Monaco | null>(null);
  const symbolsRef = useRef<{ [path: string]: Symbol }>({});
  const modelRef = useRef<ITextModel | IDiffEditorModel | null>(null);
  const editorMountStateRef = useRef<{ diff: boolean; regular: boolean }>({
    diff: false,
    regular: false,
  });
  const committedContentRef = useRef<{ [path: string]: string }>({});

  // Initialize LSP support for enhanced language features
  // This configures TypeScript/JavaScript built-in services and provides
  // foundation for connecting to external language servers if available
  const currentLanguage = useMemo(() => {
    if (!currSelectedFilePath.path || !filesContent[currSelectedFilePath.path]) {
      return "";
    }
    return filesContent[currSelectedFilePath.path].language;
  }, [currSelectedFilePath.path, filesContent]);

  useLSPClient(
    monacoRef.current,
    currentLanguage,
    undefined, // LSP server URL can be configured here if backend supports it
    currSelectedFilePath.path
  );

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
    const scrollOffset =
      "getModifiedEditor" in editor
        ? editor.getModifiedEditor().getScrollTop()
        : editor.getScrollTop();
    return { cursorPos, scrollOffset };
  }, []);

  const currSelectedChange = useMemo(() => {
    if (currSelectedFilePath.type === "file" || !repoInfo) return null;
    if (currSelectedFilePath.changeType === "staged") {
      return (
        repoInfo.changes.staged.find(
          (change) => change.path === currSelectedFilePath.path
        ) || null
      );
    } else if (currSelectedFilePath.changeType === "unstaged") {
      return (
        repoInfo.changes.unstaged.find(
          (change) => change.path === currSelectedFilePath.path
        ) || null
      );
    }
    return null;
  }, [currSelectedFilePath, repoInfo]);

  const handleEditorDidMount = useCallback(
    async (
      editor: IStandaloneCodeEditor,
      monaco: Monaco,
      selectedFilePath: string,
      firstTime = false
    ) => {
      try {
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
            setSelectedFilePath((prev) => ({
              ...prev,
              [editorId]: { path, type: "file" },
            }));
          });
        }
        let model = editor.getModel();
        const modelUri =
          currSelectedFilePath.type === "change" &&
          (currSelectedFilePath.changeType === "staged" ||
            currSelectedFilePath.index === "D")
            ? `st:${selectedFilePath}`
            : selectedFilePath;

        // let model = monaco.editor.getModel(monaco.Uri.parse(modelUri));

        if (!model || model.isDisposed()) {
          const newModel = monaco.editor.createModel(
            filesContent[selectedFilePath].content,
            filesContent[selectedFilePath].language,
            monaco.Uri.parse(modelUri)
          );
          if (!newModel) return;

          editor.setModel(newModel);

          modelRef.current = newModel;
          model = newModel;
          // const key = currSelectedFilePathRef.current.type === "change" ? : editorId + selectedFilePath;
          const key =
            currSelectedFilePathRef.current.type === "change"
              ? (currSelectedFilePathRef.current.changeType === "staged"
                  ? editorId + "st"
                  : editorId + "ust") + selectedFilePath
              : editorId + selectedFilePath;
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
            if (modelRef.current && !("modified" in modelRef.current)) {
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
              const key =
                currSelectedFilePathRef.current.type === "change"
                  ? (currSelectedFilePathRef.current.changeType === "staged"
                      ? editorId + "st"
                      : editorId + "ust") + currSelectedFilePathRef.current.path
                  : editorId + currSelectedFilePathRef.current.path;
              edIdToPathToScrollOffsetAndCursorPos[key] = temp;
            }
          });
        }

        if (
          symbolsRef.current[selectedFilePath] ||
          currSelectedChange?.index === "D"
        )
          return;

        const language = filesContent[selectedFilePath].language;

        if (language === "javascript" || language === "typescript") {
          const symbol = await getSymbolInfo(
            monaco,
            modelRef.current!,
            language
          );
          if (!symbol) {
            console.error("No navigation tree returned");
            return;
          }
          symbolsRef.current[selectedFilePath] = symbol;
        }
      } catch (err) {
        console.error("Error in handleEditorDidMount - ", err);
      }
    },
    [
      currSelectedFilePath,
      setSelectedFilePath,
      filesContent,
      getSymbolInfo,
      setActiveEditorId,
      editorId,
      setLastSelectedEditorIds,
      getScrollOffsetAndCursorPos,
      currSelectedChange,
    ]
  );

  const getCommittedContentFromDiff = useCallback(
    (diff: string, currentContent: string) => {
      // debugger;
      const patch = parsePatch(diff);
      const reversedPatch = reversePatch(patch);
      // @ts-ignore
      const committedContent = applyPatch(currentContent, reversedPatch);
      if (
        committedContent &&
        currSelectedFilePathRef.current.type === "change" &&
        currSelectedFilePathRef.current.changeType === "unstaged"
      ) {
        committedContentRef.current[currSelectedFilePathRef.current.path] =
          committedContent;
      }
      // return committedContent || undefined;
      if (!committedContent) {
        console.log("Unable to apply patch");
        console.log(diff);
        console.log(currentContent);
        return undefined;
      }
      return committedContent;
    },
    []
  );

  const getDiff = useCallback(
    (fileName: string, originalValue: string, modifiedValue: string) => {
      return createPatch(fileName, originalValue, modifiedValue);
    },
    []
  );

  const handleDiffEditorDidMount = useCallback(
    async (
      editor: MonacoDiffEditor,
      monaco: Monaco,
      selectedFilePath: string,
      firstTime = false
    ) => {
      try {
        console.log(
          "handleDiffEditorDidMount called for firsttime - ",
          firstTime
        );
        editor.focus();
        console.log("called focus from handleDiffEditorDidMount");

        const editorDomNode = editor.getContainerDomNode();

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
            setSelectedFilePath((prev) => ({
              ...prev,
              [editorId]: { path, type: "file" },
            }));
          });
        }
        const model = editor.getModel();
        let modifiedModel = model?.modified;
        let originalModel = model?.original;
        if (!modifiedModel || modifiedModel.isDisposed()) {
          modifiedModel = monaco.editor.createModel(
            filesContent[selectedFilePath].content,
            filesContent[selectedFilePath].language,
            monaco.Uri.parse(
              currSelectedFilePathRef.current.type === "change" &&
                (currSelectedFilePathRef.current.changeType === "staged" ||
                  currSelectedFilePathRef.current.index === "D")
                ? `st:${selectedFilePath}`
                : selectedFilePath
            )
          );
        }
        if (
          !originalModel ||
          (originalModel.isDisposed() &&
            currSelectedChange &&
            "diff" in currSelectedChange)
        ) {
          originalModel = monaco.editor.createModel(
            getCommittedContentFromDiff(
              currSelectedChange.diff,
              filesContent[selectedFilePath].content
            )!,
            filesContent[selectedFilePath].language
          );
        }

        if (
          !model ||
          model.modified.isDisposed() ||
          model.original.isDisposed()
        ) {
          editor.setModel({ original: originalModel, modified: modifiedModel });

          const key =
            currSelectedFilePathRef.current.type === "change"
              ? (currSelectedFilePathRef.current.changeType === "staged"
                  ? editorId + "st"
                  : editorId + "ust") + selectedFilePath
              : editorId + selectedFilePath;
          const temp = edIdToPathToScrollOffsetAndCursorPos[key];
          if (temp) {
            editor.setPosition(temp.cursorPos);
            editor.getOriginalEditor().setScrollTop(temp.scrollOffset);
            editor.getModifiedEditor().setScrollTop(temp.scrollOffset);
            delete edIdToPathToScrollOffsetAndCursorPos[key];
          }
        }
        modelRef.current = { modified: modifiedModel, original: originalModel };

        if (firstTime) {
          editor.getModifiedEditor().onDidChangeCursorPosition((e) => {
            if (modelRef.current && "modified" in modelRef.current) {
              setCursorPos(modelRef.current.modified.getOffsetAt(e.position));
            }
          });
          editor.getModifiedEditor().onDidFocusEditorText(() => {
            setActiveEditorId(editorId);
            setLastSelectedEditorIds((prev) => {
              if (prev[prev.length - 1] === editorId) return prev;
              return [...prev, editorId];
            });
          });
          editor.getModifiedEditor().onDidBlurEditorText(() => {
            const temp = getScrollOffsetAndCursorPos();

            if (temp) {
              const key =
                currSelectedFilePathRef.current.type === "change"
                  ? (currSelectedFilePathRef.current.changeType === "staged"
                      ? editorId + "st"
                      : editorId + "ust") + currSelectedFilePathRef.current.path
                  : editorId + currSelectedFilePathRef.current.path;
              edIdToPathToScrollOffsetAndCursorPos[key] = temp;
            }
          });
        }

        if (
          symbolsRef.current[selectedFilePath] ||
          currSelectedChange?.index === "D"
        )
          return;

        const language = filesContent[selectedFilePath].language;

        if (
          language === "javascript" ||
          (language === "typescript" && "modified" in modelRef.current)
        ) {
          const symbol = await getSymbolInfo(
            monaco,
            modelRef.current!.modified,
            language
          );
          if (!symbol) {
            console.error("No navigation tree returned");
            return;
          }
          symbolsRef.current[selectedFilePath] = symbol;
        }
      } catch (error) {
        console.error(error);
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
      currSelectedChange,
      getCommittedContentFromDiff,
    ]
  );

  // useEffect(() => {
  //   try {
  //     if (editorRef.current && monacoRef.current) {
  //       const uri = monacoRef.current.Uri.parse(currSelectedFilePath.path);
  //       const model = monacoRef.current.editor.getModel(uri);

  //       if (model) {
  //         const ediModel = editorRef.current.getModel();

  //         if (!ediModel || ediModel.isDisposed()) {
  //           editorRef.current.setModel(model);
  //           modelRef.current = model;
  //           const key =
  //             currSelectedFilePath.type === "change"
  //               ? (currSelectedFilePath.changeType === "staged"
  //                   ? editorId + "st"
  //                   : editorId + "ust") + currSelectedFilePath.path
  //               : editorId + currSelectedFilePath.path;
  //           const temp = edIdToPathToScrollOffsetAndCursorPos[key];
  //           if (temp) {
  //             editorRef.current.setPosition(temp.cursorPos);
  //             editorRef.current.setScrollTop(temp.scrollOffset);
  //             delete edIdToPathToScrollOffsetAndCursorPos[key];
  //           }
  //         }
  //       }
  //       if (!model || model.isDisposed()) {
  //         const newModel = monacoRef.current.editor.createModel(
  //           filesContent[currSelectedFilePath.path].content,
  //           filesContent[currSelectedFilePath.path].language,
  //           monacoRef.current.Uri.parse(currSelectedFilePath.path)
  //         );
  //         if (!newModel) return;

  //         editorRef.current.setModel(newModel);

  //         modelRef.current = newModel;
  //         // const key = editorId + currSelectedFilePath.path;
  //         const key =
  //           currSelectedFilePath.type === "change"
  //             ? (currSelectedFilePath.changeType === "staged"
  //                 ? editorId + "st"
  //                 : editorId + "ust") + currSelectedFilePath.path
  //             : editorId + currSelectedFilePath.path;
  //         const temp = edIdToPathToScrollOffsetAndCursorPos[key];
  //         if (temp) {
  //           editorRef.current.setPosition(temp.cursorPos);
  //           editorRef.current.setScrollTop(temp.scrollOffset);
  //           delete edIdToPathToScrollOffsetAndCursorPos[key];
  //         }
  //       }
  //     }

  //     if (editorId === activeEditorId) {
  //       editorRef.current?.focus();
  //     }
  //   } catch (err) {
  //     console.error("Error in useEffect for changing selectedFilePath - ", err);
  //   }
  // }, [editorId, editorIds]);

  useEffect(() => {
    try {
      if (editorRef.current && monacoRef.current) {
        const uri = monacoRef.current.Uri.parse(
          currSelectedFilePath.type === "change" &&
            (currSelectedFilePath.changeType === "staged" ||
              currSelectedFilePath.index === "D")
            ? `st:${currSelectedFilePath.path}`
            : currSelectedFilePath.path
        );
        const model = monacoRef.current.editor.getModel(uri);

        // Handle DiffEditor (has getModifiedEditor)
        if ("getModifiedEditor" in editorRef.current) {
          const diffEditor = editorRef.current as MonacoDiffEditor;
          const diffModel = diffEditor.getModel();

          // If model is missing or disposed, create new models
          if (
            !diffModel ||
            diffModel.modified.isDisposed() ||
            diffModel.original.isDisposed()
          ) {
            // Modified model (current content)
            const modifiedModel =
              model && !model.isDisposed()
                ? model
                : monacoRef.current.editor.createModel(
                    filesContent[currSelectedFilePath.path].content,
                    filesContent[currSelectedFilePath.path].language,
                    uri
                  );
            // Original model (committed content or fallback)
            const originalContent =
              currSelectedChange && "diff" in currSelectedChange
                ? getCommittedContentFromDiff(
                    currSelectedChange.diff,
                    filesContent[currSelectedFilePath.path].content
                  ) || filesContent[currSelectedFilePath.path].content
                : filesContent[currSelectedFilePath.path].content;
            const originalModel =
              diffModel && !diffModel.original.isDisposed()
                ? diffModel.original
                : monacoRef.current.editor.createModel(
                    originalContent,
                    filesContent[currSelectedFilePath.path].language
                  );

            diffEditor.setModel({
              original: originalModel,
              modified: modifiedModel,
            });
            modelRef.current = {
              original: originalModel,
              modified: modifiedModel,
            };

            // Restore scroll/cursor position if available
            const key =
              currSelectedFilePath.type === "change"
                ? (currSelectedFilePath.changeType === "staged"
                    ? editorId + "st"
                    : editorId + "ust") + currSelectedFilePath.path
                : editorId + currSelectedFilePath.path;
            const temp = edIdToPathToScrollOffsetAndCursorPos[key];
            if (temp) {
              diffEditor.setPosition(temp.cursorPos);
              diffEditor.getOriginalEditor().setScrollTop(temp.scrollOffset);
              diffEditor.getModifiedEditor().setScrollTop(temp.scrollOffset);
              delete edIdToPathToScrollOffsetAndCursorPos[key];
            }
          }
        }
        // Handle MonacoEditor (single file)
        else {
          const singleEditor = editorRef.current as IStandaloneCodeEditor;
          const ediModel = singleEditor.getModel();

          if (!ediModel || ediModel.isDisposed()) {
            const newModel =
              model && !model.isDisposed()
                ? model
                : monacoRef.current.editor.createModel(
                    filesContent[currSelectedFilePath.path].content,
                    filesContent[currSelectedFilePath.path].language,
                    uri
                  );
            singleEditor.setModel(newModel);
            modelRef.current = newModel;

            const key =
              currSelectedFilePath.type === "change"
                ? (currSelectedFilePath.changeType === "staged"
                    ? editorId + "st"
                    : editorId + "ust") + currSelectedFilePath.path
                : editorId + currSelectedFilePath.path;
            const temp = edIdToPathToScrollOffsetAndCursorPos[key];
            if (temp) {
              singleEditor.setPosition(temp.cursorPos);
              singleEditor.setScrollTop(temp.scrollOffset);
              delete edIdToPathToScrollOffsetAndCursorPos[key];
            }
          }
        }
      }

      if (editorId === activeEditorId) {
        editorRef.current?.focus();
      }
    } catch (err) {
      console.error("Error in useEffect for changing selectedFilePath - ", err);
    }
  }, [editorId, editorIds]);

  useEffect(() => {
    return () => {
      clearEditorEntries(editorId);
    };
  }, [editorId]);

  useEffect(() => {
    if (editorId === activeEditorId) {
      editorRef.current?.focus();
    }
  }, [editorId, activeEditorId]);

  // useEffect(() => {
  //   if (editorId === activeEditorId) {
  //     editorRef.current?.focus();
  //   }
  // }, [editorId, activeEditorId]);

  useEffect(() => {
    currSelectedFilePathRef.current = currSelectedFilePath;

    if (currSelectedFilePath.type === "file") {
      if (
        editorMountStateRef.current.regular &&
        editorRef.current &&
        monacoRef.current &&
        "onDidChangeCursorPosition" in editorRef.current
      ) {
        handleEditorDidMount(
          editorRef.current,
          monacoRef.current,
          currSelectedFilePath.path
        );
      }
    } else {
      if (!currSelectedChange) return;
      if (
        currSelectedChange.index === "M" &&
        editorMountStateRef.current.diff &&
        editorRef.current &&
        monacoRef.current &&
        "getModifiedEditor" in editorRef.current
      ) {
        handleDiffEditorDidMount(
          editorRef.current,
          monacoRef.current,
          currSelectedFilePath.path
        );
      }
      if (
        currSelectedChange.index !== "M" &&
        editorMountStateRef.current.regular &&
        editorRef.current &&
        monacoRef.current &&
        "onDidChangeCursorPosition" in editorRef.current
      ) {
        handleEditorDidMount(
          editorRef.current,
          monacoRef.current,
          currSelectedFilePath.path
        );
      }
    }
    // if (
    //   currSelectedChange?.index === "M" &&
    //   editorMountStateRef.current.diff &&
    //   editorRef.current &&
    //   monacoRef.current
    // ) {
    //   handleEditorDidMount(
    //     editorRef.current,
    //     monacoRef.current,
    //     currSelectedFilePath.path
    //   );
    // }
    // if (currSelectedChange) {
    //   if (
    //     currSelectedChange.index !== "M" &&
    //     editorMountStateRef.current.regular &&
    //     editorRef.current &&
    //     monacoRef.current
    //   ) {
    //     handleEditorDidMount(
    //       editorRef.current,
    //       monacoRef.current,
    //       currSelectedFilePath.path
    //     );
    //   }
    // }
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
    const position =
      "modified" in modelRef.current
        ? modelRef.current.modified.getPositionAt(offset)
        : modelRef.current.getPositionAt(offset);
    editorRef.current.setPosition(position);
    editorRef.current.revealPositionInCenter(position, 0);
    setTimeout(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
    }, 10);
  }, []);

  const handleFileEdit = useCallback(
    async (
      value: string | undefined,
      ev?: onchangeEvent,
      type: "diff" | "regular" = "regular"
    ) => {
      // debugger;
      if (!value || editorId !== activeEditorId) return;
      // if (
      //   currSelectedChange &&
      //   (currSelectedChange.type === "staged" ||
      //     currSelectedChange.index === "D")
      // ) {
      //   return;
      // }
      if (
        currSelectedFilePathRef.current.type === "change" &&
        (currSelectedFilePathRef.current.changeType === "staged" ||
          currSelectedFilePathRef.current.index === "D")
      ) {
        return;
      }
      const dmp = dmpRef.current;
      const prevValue = filesContent[currSelectedFilePath.path].content;

      const diffs = dmp.diff_main(prevValue, value);
      dmp.diff_cleanupSemantic(diffs);
      const patch = dmp.patch_toText(dmp.patch_make(prevValue, diffs));

      let prevDiff = "";
      const repoInfo = useGitStore.getState().repoInfo;
      if (
        type === "diff" &&
        repoInfo &&
        currSelectedFilePathRef.current.type === "change" &&
        currSelectedFilePathRef.current.changeType === "unstaged"
      ) {
        const committedContent =
          committedContentRef.current[currSelectedFilePathRef.current.path];
        if (committedContent) {
          const diff = getDiff(
            currSelectedFilePath.path.split("/").pop() || "",
            committedContent,
            value
          );
          const repoInfoCopy = { ...repoInfo };
          if (
            repoInfoCopy &&
            currSelectedFilePathRef.current.type === "change" &&
            currSelectedFilePathRef.current.changeType === "unstaged"
          ) {
            repoInfoCopy.changes.unstaged.forEach((change) => {
              if (
                change.path === currSelectedFilePath.path &&
                "diff" in change
              ) {
                prevDiff = change.diff;
                change.diff = diff;
              }
            });
          }
          setRepoInfo(repoInfoCopy);
        }
      }

      setFilesContent((prev) => ({
        ...prev,
        [currSelectedFilePath.path]: {
          ...prev[currSelectedFilePath.path],
          content: value,
        },
      }));

      let errorOccured = false;
      const prevNavigationTree = symbolsRef.current[currSelectedFilePath.path];
      socket?.emit(
        "file:edit",
        { path: currSelectedFilePath.path, patch },
        (error: Error | null, data: { success: boolean; path: string }) => {
          if (error) {
            console.log("socket error in fileEdit");
            console.error(error);
            errorOccured = true;
            setFilesContent((prev) => ({
              ...prev,
              [currSelectedFilePath.path]: {
                ...prev[currSelectedFilePath.path],
                content: prevValue,
              },
            }));
            symbolsRef.current[currSelectedFilePath.path] = prevNavigationTree;
            console.error(error);
            // ToDo -> show toast message
            if (type === "diff" && repoInfo) {
              const repoInfoCopy = { ...repoInfo };

              if (
                repoInfoCopy &&
                currSelectedFilePathRef.current.type === "change" &&
                currSelectedFilePathRef.current.changeType === "unstaged"
              ) {
                repoInfoCopy.changes.unstaged.forEach((change) => {
                  if (
                    change.path === currSelectedFilePath.path &&
                    "diff" in change
                  ) {
                    change.diff = prevDiff;
                  }
                });
              }
              setRepoInfo(repoInfoCopy);
            }
          }
        }
      );

      if (!monacoRef.current || !editorRef.current) {
        console.error("No monaco or editor instance in ref");
        return;
      }
      const language = filesContent[currSelectedFilePath.path].language;
      if (language === "javascript" || language === "typescript") {
        const symbol = await getSymbolInfo(
          monacoRef.current,
          "modified" in modelRef.current!
            ? modelRef.current.modified!
            : modelRef.current!,
          language
        );
        if (!symbol) {
          console.error("No navigation tree returned");
          return;
        }
        if (!errorOccured) {
          symbolsRef.current[currSelectedFilePath.path] = symbol;
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
      // repoInfo,
      // currSelectedChange,
      getDiff,
      setRepoInfo,
    ]
  );

  // const debouncedFileEditRef = useRef(debounce(handleFileEdit, 500));
  // useEffect(() => {
  //   debouncedFileEditRef.current = debounce(handleFileEdit, 500);
  // }, [handleFileEdit]);
  const debouncedFileEdit = useMemo(
    () => debounce(handleFileEdit, 500),
    [handleFileEdit]
  );
  // Used in onChange event in DiffEditor as it seems to form a closure with stale debouncedFileEdit
  const debouncedFileEditRef = useRef(debouncedFileEdit);
  useEffect(() => {
    debouncedFileEditRef.current = debouncedFileEdit;
  }, [debouncedFileEdit]);

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
      (tab) =>
        !(
          tab.path === currSelectedFilePath.path &&
          tab.type === currSelectedFilePath.type
        )
    );
    const filteredLastSelectedFilePaths = [
      ...lastSelectedFilePaths[editorId],
    ].filter(
      (prevPath) =>
        !(
          prevPath.path === currSelectedFilePath.path &&
          prevPath.type === currSelectedFilePath.type
        )
    );
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
        [editorId]: filteredLastSelectedFilePaths.pop()!,
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
      setLastPathBeforeClosingEditor(currSelectedFilePath.path);
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

  // const isDeletedChange = useMemo(() => {
  //   if (!repoInfo) return false;
  //   if (currSelectedFilePath.type === "change") {
  //     if (currSelectedFilePath.changeType === "staged") {
  //       const isDeleted = repoInfo.changes.staged.find(
  //         (change) =>
  //           change.path === currSelectedFilePath.path && change.index === "D"
  //       );
  //       return isDeleted ? true : false;
  //     } else if (currSelectedFilePath.changeType === "unstaged") {
  //       const isDeleted = repoInfo.changes.unstaged.find(
  //         (change) =>
  //           change.path === currSelectedFilePath.path && change.index === "D"
  //       );
  //       return isDeleted ? true : false;
  //     }
  //   }
  //   return false;
  // }, [currSelectedFilePath, repoInfo]);

  if (currSelectedFilePath.path === "") {
    return <div className="h-full bg-emerald-400">Please select a file</div>;
  }

  // If currSelectedFilePath.type === "file":
  // → Always load the file (ignore isDeletedChange).
  // If currSelectedFilePath.type === "change":
  // → Only load the file if isDeletedChange is false.
  if (
    filesContent[currSelectedFilePath.path] === undefined &&
    !fileFetchStatus[currSelectedFilePath.path] &&
    (currSelectedFilePath.type === "file" ||
      (currSelectedFilePath.type === "change" &&
        currSelectedChange?.index !== "D"))
  ) {
    if (currSelectedFilePath.path.includes("node_modules")) {
      loadNodeModulesFile(
        currSelectedFilePath.path,
        currSelectedFilePath.path.slice(
          currSelectedFilePath.path.lastIndexOf("/") + 1
        ),
        fileFetchStatus,
        socket!
      );
    } else {
      loadFile(
        currSelectedFilePath.path,
        currSelectedFilePath.path.slice(
          currSelectedFilePath.path.lastIndexOf("/") + 1
        ), // filename
        fileFetchStatus
      );
    }
    // Load file content
    return <div className="h-full bg-emerald-400">Loading...</div>;
  }

  if (fileFetchStatus[currSelectedFilePath.path]) {
    return <div className="h-full bg-emerald-400">Loading...</div>;
  }

  // if (currSelectedFilePath.type === "change") {
  //   if()
  // }
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
          filePath={currSelectedFilePath.path}
          moveToOffset={moveToOffset}
          breadcrumbTree={symbolsRef.current[currSelectedFilePath.path]}
        />
        {currSelectedFilePath.type === "file" ? (
          <button
            onClick={() => {
              const editor = editorRef.current;
              // Type guard: check if 'modified' exists and has 'getAction'
              if (
                editor &&
                "modified" in editor &&
                typeof (editor as any).modified?.getAction === "function"
              ) {
                (editor as any).modified
                  .getAction("editor.action.formatDocument")
                  ?.run();
              } else if (
                editor &&
                typeof (editor as any).getAction === "function"
              ) {
                (editor as any)
                  .getAction("editor.action.formatDocument")
                  ?.run();
              }
            }}
            className="text-[#868C96] hover:text-[#F5F9FC] flex items-center gap-1 group bg-[#1B2333] text-xs h-[98%] p-1 hover:bg-[#3C445C] rounded-md"
          >
            <FormatSVG className="group-hover:fill-[#F5F9FC]" />
            <span className="">Format</span>
          </button>
        ) : null}
      </div>

      {currSelectedChange && currSelectedChange.index === "M" ? (
        <DiffEditor
          language={filesContent[currSelectedFilePath.path].language}
          original={getCommittedContentFromDiff(
            currSelectedChange.diff,
            currSelectedChange.type === "staged"
              ? currSelectedChange.content
              : filesContent[currSelectedFilePath.path].content
          )}
          keepCurrentModifiedModel={true}
          modified={
            currSelectedChange.type === "staged"
              ? currSelectedChange.content
              : filesContent[currSelectedFilePath.path].content
          }
          modifiedModelPath={
            currSelectedChange.type === "staged"
              ? `st:${currSelectedFilePath.path}`
              : currSelectedFilePath.path
          }
          theme="vs-dark"
          options={{
            fontSize: 14,
            smoothScrolling: true,
            renderSideBySide: editorIds.length === 1,
            readOnly: currSelectedChange.type === "staged",
          }}
          className="h-[calc(100%-30px)]"
          onMount={(editor, monaco) => {
            console.log("on mount called in DiffEditor");
            console.log(monaco);
            editorMountStateRef.current.diff = true;
            editorRef.current = editor;
            monacoRef.current = monaco;
            // monaco.editor.
            const key =
              currSelectedChange.type === "staged"
                ? "st" + currSelectedFilePath.path
                : "ust" + currSelectedFilePath.path;
            if (scrollOffsetAndCursorPos[key]) {
              const { cursorPos, scrollOffset } = scrollOffsetAndCursorPos[key];
              editor.setPosition(cursorPos);
              // editor.setScrollTop(scrollOffset);
              editor.getModifiedEditor().setScrollTop(scrollOffset);
              editor.getOriginalEditor().setScrollTop(scrollOffset);
              delete scrollOffsetAndCursorPos[key];
            }

            editor.onDidDispose(() => {
              editorMountStateRef.current.diff = false;
              editorRef.current = null;
              monacoRef.current = null;
              console.log(
                "editor was disposed for - ",
                currSelectedFilePathRef.current.path,
                "and type is - ",
                currSelectedFilePathRef.current.type
              );
              // clearEditorEntries(editorId);
            });

            const modifiedModel = editor.getModel()?.modified;
            if (modifiedModel) {
              modifiedModel.onDidChangeContent(() => {
                debouncedFileEditRef.current(
                  modifiedModel.getValue(),
                  undefined,
                  "diff"
                );
              });
            }

            handleDiffEditorDidMount(
              editor,
              monaco,
              currSelectedFilePath.path,
              true
            );

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
        />
      ) : (
        <MonacoEditor
          language={
            currSelectedFilePath.type === "change" &&
            currSelectedChange?.index === "D"
              ? getFileLanguage(currSelectedChange.name.split("/").pop()!)
              : filesContent[currSelectedFilePath.path].language
          }
          value={
            currSelectedFilePath.type === "change" &&
            (currSelectedChange?.index === "D" ||
              (currSelectedChange?.index === "A" &&
                currSelectedChange.content !== undefined))
              ? currSelectedChange.content
              : filesContent[currSelectedFilePath.path].content
          }
          path={
            currSelectedFilePath.type === "change" &&
            (currSelectedFilePath.changeType === "staged" ||
              currSelectedFilePath.index === "D")
              ? `st:${currSelectedFilePath.path}`
              : currSelectedFilePath.path
          }
          theme="vs-dark"
          onChange={(value, ev) => {
            debouncedFileEditRef.current(value, ev, "regular");
          }}
          // onChange={debouncedFileEdit}
          options={{
            fontSize: 14,
            smoothScrolling: true,
            readOnly:
              currSelectedChange?.type === "staged" ||
              currSelectedChange?.index === "D",
          }}
          keepCurrentModel={true}
          // overrideServices={{}}
          className="h-[calc(100%-30px)]"
          onMount={(editor, monaco) => {
            editorMountStateRef.current.regular = true;
            // onMount is triggered only the first time the editor is mounted
            editorRef.current = editor;
            monacoRef.current = monaco;
            if (scrollOffsetAndCursorPos[currSelectedFilePath.path]) {
              const { cursorPos, scrollOffset } =
                scrollOffsetAndCursorPos[currSelectedFilePath.path];
              editor.setPosition(cursorPos);
              editor.setScrollTop(scrollOffset);
              delete scrollOffsetAndCursorPos[currSelectedFilePath.path];
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
              editorMountStateRef.current.regular = false;
              editorRef.current = null;
              monacoRef.current = null;
              // clearEditorEntries(editorId);
            });

            handleEditorDidMount(
              editor,
              monaco,
              currSelectedFilePath.path,
              true
            );

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
      )}
    </div>
  );
};
const memoizedEditor = React.memo(Editor);
memoizedEditor.displayName = "Editor";
export default memoizedEditor;
