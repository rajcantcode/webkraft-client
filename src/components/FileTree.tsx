//@ts-ignore
import React, { useEffect, useState, useCallback } from "react";
import { TreeNode } from "../constants.js";
import TreeFolder from "./TreeFolder.js";
import TreeFile from "./TreeFile.js";
import { useWorkspaceStore } from "../store.js";
import "../styles/template-search-modal.css";
import {
  checkIfNameIsUnique,
  checkIfNameIsValid,
  findNode,
  updatePath,
} from "../lib/utils.js";

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

const FileTree = ({ padLeft }: { padLeft: Number }) => {
  // const fileStructure = useWorkspaceStore((state) => state.fileStructure);
  const [fileTree, setFileTree] = useState<TreeNode[]>(sampleTree);

  const checkRenameNodeIsUnique = useCallback(
    (node: TreeNode, renameValue: string) => {
      return checkIfNameIsUnique(node, renameValue);
    },
    []
  );

  const handleRename = useCallback(
    (node: TreeNode, newName: string) => {
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
      node.path = parentPath + "/" + newName;
      if (node.type === "folder") {
        updatePath(node, node.path);
      }
      const fileTreeCopy = structuredClone(fileTree);
      setFileTree(fileTreeCopy);
    },
    [fileTree]
  );

  const handleDelete = useCallback(
    (path: string) => {
      const fileTreeCopy = structuredClone(fileTree);
      const parentPath = path.split("/").slice(0, -1).join("/");
      const parentNode = findNode(fileTreeCopy, parentPath);
      if (!parentNode || parentNode.type === "file") return;
      parentNode.children = parentNode.children.filter(
        (node) => node.path !== path
      );
      setFileTree(fileTreeCopy);
    },
    [fileTree]
  );

  const handleAddFile = useCallback(
    (node: TreeNode, fileName: string) => {
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
      node.children.push({
        type: "file",
        name: fileName,
        path: `${node.path}/${fileName}`,
      });
      // Also sort the children array
      const fileTreeCopy = structuredClone(fileTree);
      setFileTree(fileTreeCopy);
    },
    [fileTree]
  );

  const handleAddFolder = useCallback(
    (node: TreeNode, folderName: string) => {
      if (node.type === "file") throw new Error("Not a folder");
      const isNameUnique = checkIfNameIsUnique(node, folderName);
      if (!isNameUnique)
        throw new Error(
          `A file or folder ${folderName} already exists at this location. Please choose a different name.`
        );
      const isNameValid = checkIfNameIsValid(folderName);
      if (!isNameValid)
        throw new Error(
          `The name ${folderName} is not valid. Please choose a different name.`
        );
      node.children.push({
        type: "folder",
        name: folderName,
        path: `${node.path}/${folderName}`,
        children: [],
      });
      // Also sort the children array
      const fileTreeCopy = structuredClone(fileTree);
      setFileTree(fileTreeCopy);
    },
    [fileTree]
  );

  const handleRightClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // e.stopPropagation();
    // console.log(e.target.closest());
    // console.log(e.currentTarget);
  };
  return (
    <div
      className="w-48 h-full overflow-x-hidden overflow-y-auto cursor-pointer tree-container bg-[#0E1525]"
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
  );
};

export default React.memo(FileTree);
