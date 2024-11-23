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
  updateFilePathsInFileTabBar,
  updatePath,
} from "../lib/utils.js";
import { ScrollArea } from "./ui/ScrollArea.js";
import { Socket } from "socket.io-client";
import { sortNodeChildren } from "../helpers.js";

const sampleTree: TreeNode[] = [
  {
    type: "folder",
    name: "client",
    path: "client",
    children: [
      {
        type: "folder",
        name: "node_modules",
        path: "client/node_modules",
        children: [],
      },
      {
        type: "folder",
        name: "public",
        path: "client/public",
        children: [
          {
            type: "file",
            name: "favicon.ico",
            path: "client/public/favicon.ico",
          },
        ],
      },
      {
        type: "folder",
        name: "src",
        path: "client/src",
        children: [
          {
            type: "folder",
            name: "assets",
            path: "client/src/assets",
            children: [
              {
                type: "file",
                name: "react.svg",
                path: "client/src/assets/react.svg",
              },
            ],
          },
          {
            type: "folder",
            name: "components",
            path: "client/src/components",
            children: [],
          },
          {
            type: "folder",
            name: "hooks",
            path: "client/src/hooks",
            children: [
              {
                type: "file",
                name: "use-on-click-outside.ts",
                path: "client/src/hooks/use-on-click-outside.ts",
              },
            ],
          },
          {
            type: "folder",
            name: "icons",
            path: "client/src/icons",
            children: [
              {
                type: "file",
                name: "exituseonclickoutside.svg",
                path: "client/src/icons/exituseonclickoutside.svg",
              },
              {
                type: "file",
                name: "logo.svg",
                path: "client/src/icons/logo.svg",
              },
              {
                type: "file",
                name: "search-icon.svg",
                path: "client/src/icons/search-icon.svg",
              },
              {
                type: "file",
                name: "searchicon.png",
                path: "client/src/icons/searchicon.png",
              },
            ],
          },
          {
            type: "folder",
            name: "lib",
            path: "client/src/lib",
            children: [
              {
                type: "file",
                name: "utils.ts",
                path: "client/src/lib/utils.ts",
              },
            ],
          },
          {
            type: "folder",
            name: "pages",
            path: "client/src/pages",
            children: [
              {
                type: "file",
                name: "Home.tsx",
                path: "client/src/pages/Home.tsx",
              },
              {
                type: "file",
                name: "Login.tsx",
                path: "client/src/pages/Login.tsx",
              },
              {
                type: "file",
                name: "SignUp.tsx",
                path: "client/src/pages/SignUp.tsx",
              },
              {
                type: "file",
                name: "Welcome.tsx",
                path: "client/src/pages/Welcome.tsx",
              },
              {
                type: "file",
                name: "Workspace.tsx",
                path: "client/src/pages/Workspace.tsx",
              },
            ],
          },
          {
            type: "folder",
            name: "styles",
            path: "client/src/styles",
            children: [
              {
                type: "file",
                name: "global.css",
                path: "client/src/styles/global.css",
              },
            ],
          },
        ],
      },
      {
        type: "file",
        name: "App.css",
        path: "client/App.css",
      },
      {
        type: "file",
        name: "App.tsx",
        path: "client/App.tsx",
      },
      {
        type: "file",
        name: "constants.ts",
        path: "client/constants.ts",
      },
      {
        type: "file",
        name: "filetree.json",
        path: "client/filetree.json",
      },
      {
        type: "file",
        name: "helpers.ts",
        path: "client/helpers.ts",
      },
      {
        type: "file",
        name: "index.css",
        path: "client/index.css",
      },
      {
        type: "file",
        name: "main.tsx",
        path: "client/main.tsx",
      },
      {
        type: "file",
        name: "store.ts",
        path: "client/store.ts",
      },
      {
        type: "file",
        name: "vite-env.d.ts",
        path: "client/vite-env.d.ts",
      },
      {
        type: "file",
        name: ".env",
        path: "client/.env",
      },
      {
        type: "file",
        name: ".gitignore",
        path: "client/.gitignore",
      },
      {
        type: "file",
        name: "eslint.config.js",
        path: "client/eslint.config.js",
      },
      {
        type: "file",
        name: "index.html",
        path: "client/index.html",
      },
      {
        type: "file",
        name: "package-lock.json",
        path: "client/package-lock.json",
      },
      {
        type: "file",
        name: "package.json",
        path: "client/package.json",
      },
      {
        type: "file",
        name: "postcss.config.js",
        path: "client/postcss.config.js",
      },
      {
        type: "file",
        name: "README.md",
        path: "client/README.md",
      },
      {
        type: "file",
        name: "tailwind.config.js",
        path: "client/tailwind.config.js",
      },
      {
        type: "file",
        name: "tsconfig.app.json",
        path: "client/tsconfig.app.json",
      },
      {
        type: "file",
        name: "tsconfig.json",
        path: "client/tsconfig.json",
      },
      {
        type: "file",
        name: "tsconfig.node.json",
        path: "client/tsconfig.node.json",
      },
      {
        type: "file",
        name: "vite.config.ts",
        path: "client/vite.config.ts",
      },
    ],
  },
];

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
      const fileTreeCopy = structuredClone(fileTree);
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
            const fileTreeCopy = structuredClone(fileTree);
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
      const fileTreeCopy = structuredClone(fileTree);
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
            const fileTreeCopy = structuredClone(fileTree);
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
      const fileTreeCopy = structuredClone(fileTree);
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
            const fileTreeCopy = structuredClone(fileTree);
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
      const fileTreeCopy = structuredClone(fileTree);
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
            const fileTreeCopy = structuredClone(fileTree);
            setFileTree(fileTreeCopy);
            console.error("Error adding folder", error);
            // ToDo -> Display a toast message
          }
        }
      );
    },
    [fileTree]
  );

  useEffect(() => {
    if (!socket) return;
    const handleFileAdd = (data: { path: string }) => {
      if (!fileTree) {
        return;
      }
      const { path } = data;
      const parentPath = path.split("/").slice(0, -1).join("/");
      const fileTreeCopy = structuredClone(fileTree);
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
      const fileTreeCopy = structuredClone(fileTree);
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
      const fileTreeCopy = structuredClone(fileTree);
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
      const fileTreeCopy = structuredClone(fileTree);
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
