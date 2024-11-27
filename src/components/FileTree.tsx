//@ts-ignore
import React, {
  useEffect,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";
import {
  editorSupportedLanguages,
  FileContentObj,
  TreeNode,
} from "../constants.js";
import TreeFolder from "./TreeFolder.js";
import TreeFile from "./TreeFile.js";
import { RenamePathObj, useWorkspaceStore } from "../store.js";
import "../styles/template-search-modal.css";
import {
  addChildrenPathsToDeleteArr,
  checkIfNameIsUnique,
  checkIfNameIsValid,
  deleteFilePathsInFileTabBar,
  deletePathsFromFilesContentObj,
  findNode,
  moveNodes,
  updateFilePathsInFileTabBar,
  updatePath,
} from "../lib/utils.js";
import { ScrollArea } from "./ui/ScrollArea.js";
import { Socket } from "socket.io-client";
import { sortNodeChildren } from "../helpers.js";

const FileTree = ({
  padLeft,
  fileFetchStatus,
  socket,
}: {
  padLeft: Number;
  fileFetchStatus: { [key: string]: boolean };
  socket: Socket | null;
}) => {
  const fileTree = useWorkspaceStore((state) => state.fileStructure);
  const setFileTree = useWorkspaceStore((state) => state.setFileStructure);
  const setFilesContent = useWorkspaceStore((state) => state.setFilesContent);

  const checkRenameNodeIsUnique = useCallback(
    (node: TreeNode, renameValue: string) => {
      return checkIfNameIsUnique(node, renameValue);
    },
    []
  );

  const handleRename = useCallback(
    (node: TreeNode, newName: string, type: "file" | "folder") => {
      if (!fileTree) {
        return;
      }
      const parentPath = node.path.split("/").slice(0, -1).join("/");
      const parentNode = findNode(fileTree, parentPath);
      if (!parentNode) throw new Error("No node found");
      const isNameUnique = checkIfNameIsUnique(parentNode, newName);
      if (!isNameUnique)
        throw new Error(
          `A file or folder ${newName} already exists at this location. Please choose a different name.`
        );
      const isNameValid = checkIfNameIsValid(newName);
      if (!isNameValid)
        throw new Error(
          `The name ${newName} is not valid. Please choose a different name.`
        );
      node.name = newName;
      const oldPath = node.path;
      node.path = parentPath + "/" + newName;
      sortNodeChildren(parentNode);
      if (node.type === "file") {
        setFilesContent((prev) => {
          const newFilesContent = { ...prev, [node.path]: prev[oldPath] };
          delete newFilesContent[oldPath];
          return newFilesContent;
        });
        updateFilePathsInFileTabBar({ oldPath, newPath: node.path }, undefined);
      }
      if (node.type === "folder") {
        const renamedPaths: RenamePathObj[] = [];
        const { filesContent } = useWorkspaceStore.getState();
        updatePath(node, node.path, renamedPaths, filesContent);
        updateFilePathsInFileTabBar(undefined, renamedPaths);
        setFilesContent({ ...filesContent });
      }
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = { ...fileTree };
      setFileTree(fileTreeCopy);
      const action = type === "file" ? "file:rename" : "folder:rename";
      socket?.emit(
        action,
        { path: oldPath, newPath: node.path },
        (
          error: Error | null,
          data: { success: boolean; oldPath: string; newPath: string }
        ) => {
          const { oldPath, newPath } = data;
          if (error) {
            // Revert the changes
            if (node.type === "file") {
              setFilesContent((prev) => {
                const newFilesContent = { ...prev, [oldPath]: prev[newPath] };
                delete newFilesContent[newPath];
                return newFilesContent;
              });
              updateFilePathsInFileTabBar({ oldPath, newPath }, undefined);
            }
            node.name = oldPath.split("/").pop()!;
            node.path = oldPath;
            if (node.type === "folder") {
              const renamedPaths: RenamePathObj[] = [];
              const { filesContent } = useWorkspaceStore.getState();
              updatePath(node, node.path, renamedPaths, filesContent);
              // setRenamedPaths(renamedPaths);
              setFilesContent({ ...filesContent });
              updateFilePathsInFileTabBar(undefined, renamedPaths);
            }
            // const fileTreeCopy = structuredClone(fileTree);
            const fileTreeCopy = { ...fileTree };
            setFileTree(fileTreeCopy);

            console.error("Error renaming file/folder", error);
            // ToDo -> Display a toast message
          }
        }
      );
    },
    [fileTree]
  );

  const handleDelete = useCallback(
    (path: string, type: "file" | "folder") => {
      if (!fileTree) {
        return;
      }
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = { ...fileTree };
      const parentPath = path.split("/").slice(0, -1).join("/");
      const parentNode = findNode(fileTreeCopy, parentPath);
      if (!parentNode || parentNode.type === "file") return;
      const nodeToBeDeleted = parentNode.children.find(
        (node) => node.path === path
      );

      const { filesContent } = useWorkspaceStore.getState();
      let deletedFileContent: FileContentObj = {};
      // Set deleted paths so they can be removed from the file tabs
      if (nodeToBeDeleted?.type === "file") {
        // setDeletedPaths([path]);
        deletedFileContent[path] = filesContent[path];
        setFilesContent((prev) => {
          const newFilesContent = { ...prev };
          delete newFilesContent[path];
          return newFilesContent;
        });
        deleteFilePathsInFileTabBar(path, undefined);
      } else {
        // Recursively add all the children paths to the deletedPaths array
        // Delete all the paths of children which are files, from the filesContent object
        const deletedPaths: string[] = [];
        addChildrenPathsToDeleteArr(
          nodeToBeDeleted!,
          deletedPaths,
          filesContent,
          deletedFileContent
        );
        // setDeletedPaths(deletedPaths);
        setFilesContent({ ...filesContent });
        deleteFilePathsInFileTabBar(undefined, deletedPaths);
      }

      // filter out the node to be deleted
      parentNode.children = parentNode.children.filter(
        (node) => node.path !== path
      );

      setFileTree(fileTreeCopy);

      const action = type === "file" ? "file:delete" : "folder:delete";
      socket?.emit(
        action,
        { path },
        (error: Error | null, data: { success: boolean; path: string }) => {
          if (error) {
            // Revert the changes
            parentNode.children.push(nodeToBeDeleted!);
            // ToDo -> Sort the children array
            sortNodeChildren(parentNode);
            // const fileTreeCopy = structuredClone(fileTree);
            const fileTreeCopy = { ...fileTree };
            setFileTree(fileTreeCopy);
            setFilesContent((prev) => ({
              ...prev,
              ...deletedFileContent,
            }));
            console.error("Error deleting file/folder", error);

            // ToDo -> Display a toast message
          }
        }
      );
    },
    [fileTree]
  );

  const handleAddFile = useCallback(
    (node: TreeNode, fileName: string) => {
      if (!fileTree) {
        return;
      }
      if (node.type === "file") throw new Error("Not a folder");
      const isNameUnique = checkIfNameIsUnique(node, fileName);
      if (!isNameUnique)
        throw new Error(
          `A file or folder ${fileName} already exists at this location. Please choose a different name.`
        );
      const isNameValid = checkIfNameIsValid(fileName);
      if (!isNameValid)
        throw new Error(
          `The name ${fileName} is not valid. Please choose a different name.`
        );
      const fileExtension = fileName.split(".").pop();
      node.children.push({
        type: "file",
        name: fileName,
        path: `${node.path}/${fileName}`,
      });
      // ToDo -> Also sort the children array
      sortNodeChildren(node);
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = { ...fileTree };
      setFileTree(fileTreeCopy);
      setFilesContent((prev) => ({
        ...prev,
        [`${node.path}/${fileName}`]: {
          name: fileName,
          content: "",
          language: fileExtension
            ? editorSupportedLanguages[fileExtension] || "text"
            : "text",
        },
      }));
      socket?.emit(
        "file:create",
        { path: `${node.path}/${fileName}` },
        (error: Error | null, data: { success: boolean; path: string }) => {
          if (error) {
            // Revert the changes
            node.children = node.children.filter(
              (node) => node.path !== `${node.path}/${fileName}`
            );
            // const fileTreeCopy = structuredClone(fileTree);
            const fileTreeCopy = { ...fileTree };
            setFileTree(fileTreeCopy);
            setFilesContent((prev) => {
              const newFilesContent = { ...prev };
              delete newFilesContent[`${node.path}/${fileName}`];
              return newFilesContent;
            });
            console.error("Error adding file", error);
            // ToDo -> Display a toast message
          }
        }
      );
    },
    [fileTree]
  );

  const handleAddFolder = useCallback(
    (node: TreeNode, folderName: string) => {
      if (!fileTree) {
        return;
      }
      if (node.type === "file") {
        throw new Error("Not a folder");
      }
      const isNameUnique = checkIfNameIsUnique(node, folderName);
      if (!isNameUnique) {
        throw new Error(
          `A file or folder ${folderName} already exists at this location. Please choose a different name.`
        );
      }
      const isNameValid = checkIfNameIsValid(folderName);
      if (!isNameValid) {
        throw new Error(
          `The name ${folderName} is not valid. Please choose a different name.`
        );
      }
      node.children.push({
        type: "folder",
        name: folderName,
        path: `${node.path}/${folderName}`,
        children: [],
      });
      // Also sort the children array
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = { ...fileTree };
      setFileTree(fileTreeCopy);

      socket?.emit(
        "folder:create",
        { path: `${node.path}/${folderName}` },
        (error: Error | null, data: { success: boolean; path: string }) => {
          if (error) {
            // Revert the changes
            node.children = node.children.filter(
              (node) => node.path !== `${node.path}/${folderName}`
            );
            // const fileTreeCopy = structuredClone(fileTree);
            const fileTreeCopy = { ...fileTree };
            setFileTree(fileTreeCopy);
            console.error("Error adding folder", error);
            // ToDo -> Display a toast message
          }
        }
      );
    },
    [fileTree]
  );

  const handleMoveNodes = useCallback(
    (sourcePath: string, destPath: string) => {
      moveNodes(sourcePath, destPath);
      const sourceFileName = sourcePath.split("/").pop();
      socket?.emit(
        "file:move",
        { sourcePath, destPath },
        (
          error: Error | null,
          data: { success: boolean; sourcePath: string; destPath: string }
        ) => {
          if (error) {
            console.error("Error moving files");
            moveNodes(
              destPath + "/" + sourceFileName,
              sourcePath.split("/").slice(0, -1).join("/")
            );
          }
        }
      );
    },
    []
  );

  useEffect(() => {
    if (!socket) return;
    const handleFileAdd = (data: { path: string }) => {
      if (!fileTree) {
        return;
      }
      const { path } = data;
      const parentPath = path.split("/").slice(0, -1).join("/");
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = { ...fileTree };
      const parentNode = findNode(fileTreeCopy, parentPath);

      if (!parentNode || parentNode.type === "file") return;
      const fileName = path.split("/").pop();
      parentNode.children.push({
        type: "file",
        name: fileName!,
        path,
      });
      sortNodeChildren(parentNode);
      setFileTree(fileTreeCopy);
      const fileExtension = fileName!.split(".").pop();
      if (!path.includes("node_modules")) {
        setFilesContent((prev) => ({
          ...prev,
          [path]: {
            name: fileName!,
            content: "",
            language: fileExtension
              ? editorSupportedLanguages[fileExtension] || "text"
              : "text",
          },
        }));
      }
    };

    const handleFileChange = (data: { path: string; content: string }) => {
      const { path, content } = data;
      setFilesContent((prev) => ({
        ...prev,
        [path]: { ...prev[path], content },
      }));
    };

    const handleFileUnlink = (data: { path: string }) => {
      if (!fileTree) {
        return;
      }
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = { ...fileTree };
      const { path } = data;
      const parentPath = path.split("/").slice(0, -1).join("/");
      const parentNode = findNode(fileTreeCopy, parentPath);
      if (!parentNode || parentNode.type === "file") return;
      parentNode.children = parentNode.children.filter(
        (node) => node.path !== path
      );
      setFileTree(fileTreeCopy);
      setFilesContent((prev) => {
        const newFilesContent = { ...prev };
        delete newFilesContent[path];
        return newFilesContent;
      });
      deleteFilePathsInFileTabBar(path, undefined);
    };

    const handleFolderAdd = (data: { path: string }) => {
      if (!fileTree) {
        return;
      }
      const { path } = data;
      const parentPath = path.split("/").slice(0, -1).join("/");
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = { ...fileTree };
      const parentNode = findNode(fileTreeCopy, parentPath);
      if (!parentNode || parentNode.type === "file") return;
      const folderName = path.split("/").pop();
      parentNode.children.push({
        type: "folder",
        name: folderName!,
        path,
        children: [],
      });
      sortNodeChildren(parentNode);
      setFileTree(fileTreeCopy);
    };

    const handleFolderUnlink = (data: { path: string }) => {
      if (!fileTree) {
        return;
      }
      const { path } = data;
      const parentPath = path.split("/").slice(0, -1).join("/");
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = { ...fileTree };
      const parentNode = findNode(fileTreeCopy, parentPath);
      if (!parentNode || parentNode.type === "file") return;
      const nodeToBeDeleted = parentNode.children.find(
        (node) => node.path === path
      );
      parentNode.children = parentNode.children.filter(
        (node) => node.path !== path
      );
      setFileTree(fileTreeCopy);

      const deletedPaths: string[] = [];
      const filesContent = useWorkspaceStore.getState().filesContent;
      addChildrenPathsToDeleteArr(
        nodeToBeDeleted!,
        deletedPaths,
        filesContent,
        null
      );
      setFilesContent({ ...filesContent });
      deleteFilePathsInFileTabBar(undefined, deletedPaths);
    };

    socket.on("file:add", handleFileAdd);
    socket.on("file:change", handleFileChange);
    socket.on("file:unlink", handleFileUnlink);
    socket.on("folder:add", handleFolderAdd);
    socket.on("folder:unlink", handleFolderUnlink);
    return () => {
      socket.off("file:add", handleFileAdd);
      socket.off("file:change", handleFileChange);
      socket.off("file:unlink", handleFileUnlink);
      socket.off("folder:add", handleFolderAdd);
      socket.off("folder:unlink", handleFolderUnlink);
    };
  }, [socket, fileTree, setFileTree, setFilesContent]);

  const handleRightClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // e.stopPropagation();
    // console.log(e.target.closest());
    // console.log(e.currentTarget);
  };
  if (!fileTree) {
    return null;
  }
  return (
    <ScrollArea className="w-full h-full">
      <div
        className="w-full h-full cursor-pointer tree-container bg-[#0E1525] p-2"
        onContextMenu={handleRightClick}
      >
        {fileTree.map((node) => {
          if (node.type === "folder") {
            return (
              <TreeFolder
                node={node}
                padLeft={padLeft}
                open={true}
                key={node.name}
                handleRename={handleRename}
                handleDelete={handleDelete}
                handleAddFile={handleAddFile}
                handleAddFolder={handleAddFolder}
                handleMoveNodes={handleMoveNodes}
                checkRenameValueIsUnique={(renameValue: string) =>
                  checkRenameNodeIsUnique(node, renameValue)
                }
                fileFetchStatus={fileFetchStatus}
                socketLink={socket?.io.opts.host!}
              />
            );
          }
          if (node.type === "file") {
            return (
              <TreeFile
                node={node}
                key={node.name}
                handleRename={handleRename}
                handleDelete={handleDelete}
                checkRenameValueIsUnique={(renameValue: string) =>
                  checkRenameNodeIsUnique(node, renameValue)
                }
              />
            );
          }
        })}
      </div>
    </ScrollArea>
  );
};

export default React.memo(FileTree);
