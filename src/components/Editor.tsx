import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileContentObj, useWorkspaceStore } from "../store";
import { loadFile, loadNodeModulesFile } from "../helpers";
import { Editor as MonacoEditor } from "@monaco-editor/react";
import githubDarkTheme from "../lib/github-dark-theme";
import debounce from "lodash.debounce";
// @ts-ignore
import DiffMatchPatch from "diff-match-patch";

import FileTabBar from "./FileTabBar";
import { Socket } from "socket.io-client";

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
    (state) => state.setSelectedFilePath
  );
  const setFilesContent = useWorkspaceStore((state) => state.setFilesContent);

  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (editorRef.current) {
      handleEditorDidMount(editorRef.current, selectedFilePath);
    }
  }, [selectedFilePath]);

  const dmpRef = useRef(new DiffMatchPatch());

  const handleFileEdit = (value: string | undefined) => {
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

    socket?.emit(
      "file:edit",
      { path: selectedFilePath, patch },
      (error: Error | null, data: { success: boolean; path: string }) => {
        if (error) {
          setFilesContent((prev) => ({
            ...prev,
            [selectedFilePath]: {
              ...prev[selectedFilePath],
              content: prevValue,
            },
          }));
          console.error(error);
          // ToDo -> show toast message
        }
      }
    );
  };

  const request = debounce(async (value: string | undefined) => {
    handleFileEdit(value);
  }, 800);

  const debouncedFileEdit = useCallback(
    (value: string | undefined) => {
      request(value);
    },
    [selectedFilePath, setFilesContent, filesContent]
  );

  const handleEditorDidMount = (editor, selectedFilePath: string) => {
    editor.focus();
    const editorDomNode = editor.getDomNode();
    if (editorDomNode) {
      editorDomNode.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      });

      editor.onDropIntoEditor(({ position, event }) => {
        const path = event.dataTransfer.getData("text/plain");
        event.preventDefault();
        event.stopPropagation();
        if (path === selectedFilePath) return;
        setSelectedFilePath(path);
      });
    }
  };

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
        socket!
      );
    } else {
      loadFile(
        selectedFilePath,
        selectedFilePath.slice(selectedFilePath.lastIndexOf("/") + 1), // filename
        fileFetchStatus
      );
    }
    // Load file content
    return <div className="h-full bg-emerald-400">Loading...</div>;
  }

  if (fileFetchStatus[selectedFilePath]) {
    return <div className="h-full bg-emerald-400">Loading...</div>;
  }
  return (
    <div className="h-full bg-emerald-400">
      <FileTabBar />
      <MonacoEditor
        language={filesContent[selectedFilePath].language}
        value={filesContent[selectedFilePath].content}
        path={selectedFilePath}
        theme="vs-dark"
        onChange={debouncedFileEdit}
        options={{
          fontSize: 14,
        }}
        overrideServices={{}}
        className="h-[calc(100%-30px)]"
        onMount={(editor, monaco) => {
          editorRef.current = editor;
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

export default React.memo(Editor);
