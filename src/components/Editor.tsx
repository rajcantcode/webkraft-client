import React, { useCallback, useRef, useState } from "react";
import { FileContentObj, useWorkspaceStore } from "../store";
import { loadFile, loadNodeModulesFile } from "../helpers";
import { Editor as MonacoEditor } from "@monaco-editor/react";
import githubDarkTheme from "../lib/github-dark-theme";
import debounce from "lodash.debounce";
// @ts-ignore
import DiffMatchPatch from "diff-match-patch";

import FileTabBar from "./FileTabBar";
import { Socket } from "socket.io-client";
// type FileContnentObj = {
//   name: string;
//   path: string;
//   language: string;
//   content: string;
// };

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

  // if (selectedFilePath === "") {
  //   return <div className="h-full bg-emerald-400">Please select a file</div>;
  // }

  // if (
  //   (filesContent[selectedFilePath] === undefined ||
  //     filesContent[selectedFilePath].content === "") &&
  //   !fileFetchStatus[selectedFilePath]
  // ) {
  //   if (selectedFilePath.includes("node_modules")) {
  //     loadNodeModulesFile(
  //       selectedFilePath,
  //       selectedFilePath.slice(selectedFilePath.lastIndexOf("/") + 1),
  //       fileFetchStatus,
  //       socket!
  //     );
  //   } else {
  //     loadFile(
  //       selectedFilePath,
  //       selectedFilePath.slice(selectedFilePath.lastIndexOf("/") + 1), // filename
  //       fileFetchStatus
  //     );
  //   }
  //   // Load file content
  //   return <div className="h-full bg-emerald-400">Loading...</div>;
  // }

  // if (fileFetchStatus[selectedFilePath]) {
  //   return <div className="h-full bg-emerald-400">Loading...</div>;
  // }

  const dmpRef = useRef(new DiffMatchPatch());

  const handleFileEdit = (value: string | undefined) => {
    console.log("handleFileEdit called with value -> ", value);
    if (!value) return;
    console.log("selectedFilePath -> ", selectedFilePath);
    console.log(filesContent[selectedFilePath]);
    const dmp = dmpRef.current;
    const prevValue = filesContent[selectedFilePath].content;
    const diffs = dmp.diff_main(prevValue, value);
    dmp.diff_cleanupSemantic(diffs);
    const patch = dmp.patch_toText(dmp.patch_make(prevValue, diffs));
    // const newFilesContent: FileContentObj = {
    //   ...filesContent,
    //   [selectedFilePath]: { ...filesContent[selectedFilePath], content: value },
    // };
    setFilesContent((prev) => ({
      ...prev,
      [selectedFilePath]: { ...prev[selectedFilePath], content: value },
    }));

    socket?.emit(
      "file:edit",
      { path: selectedFilePath, patch },
      (error: Error | null, data: { success: boolean; path: string }) => {
        if (error) {
          // const oldFilesContent: FileContentObj = {
          //   ...filesContent,
          //   [selectedFilePath]: {
          //     ...filesContent[selectedFilePath],
          //     content: prevValue,
          //   },
          // };
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

  // const handleEditorDidMount = (editor) => {
  //   const editorDomNode = editor.getDomNode();
  //   if (editorDomNode) {
  //     editorDomNode.addEventListener("dragover", (e) => {
  //       e.preventDefault();
  //       e.dataTransfer.dropEffect = "copy";
  //     });

  //     editor.onDropIntoEditor(({ position, event }) => {
  //       event.preventDefault();
  //       event.stopPropagation();
  //     });
  //     editorDomNode.addEventListener(
  //       "drop",
  //       (e) => {
  //         e.preventDefault();
  //         e.stopPropagation();
  //         const path = e.dataTransfer.getData("text/plain");
  //         console.log("someone dropped -> ", path);
  //         if (path === selectedFilePath) return;
  //         setSelectedFilePath(path);
  //       },
  //       true
  //     );
  //   }
  // };

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
        defaultLanguage={filesContent[selectedFilePath].language}
        defaultValue={filesContent[selectedFilePath].content}
        path={selectedFilePath}
        theme="vs-dark"
        onChange={debouncedFileEdit}
        options={{
          fontSize: 14,
        }}
        overrideServices={{}}
        className="h-[calc(100%-30px)]"
        onMount={(editor, monaco) => monaco.editor.setTheme("grey-bg-vs-dark")}
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
