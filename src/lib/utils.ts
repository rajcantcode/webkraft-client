import { twMerge } from "tailwind-merge";
import { type ClassValue, clsx } from "clsx";

// material-ui file and folder icons
import folder from "material-icon-theme/icons/folder.svg";
import folderOpen from "material-icon-theme/icons/folder-open.svg";
import publicFolder from "material-icon-theme/icons/folder-public.svg";
import publicFolderOpen from "material-icon-theme/icons/folder-public-open.svg";
import src from "material-icon-theme/icons/folder-src.svg";
import srcOpen from "material-icon-theme/icons/folder-src-open.svg";
import node_modules from "material-icon-theme/icons/folder-node.svg";
import node_modulesOpen from "material-icon-theme/icons/folder-node-open.svg";
import components from "material-icon-theme/icons/folder-components.svg";
import componentsOpen from "material-icon-theme/icons/folder-components-open.svg";
import ui from "material-icon-theme/icons/folder-ui.svg";
import uiOpen from "material-icon-theme/icons/folder-ui-open.svg";
import hooks from "material-icon-theme/icons/folder-hook.svg";
import hooksOpen from "material-icon-theme/icons/folder-hook-open.svg";
import lib from "material-icon-theme/icons/folder-lib.svg";
import libOpen from "material-icon-theme/icons/folder-lib-open.svg";
import styles from "material-icon-theme/icons/folder-css.svg";
import stylesOpen from "material-icon-theme/icons/folder-css-open.svg";
import dist from "material-icon-theme/icons/folder-dist.svg";
import distOpen from "material-icon-theme/icons/folder-dist-open.svg";
import prisma from "material-icon-theme/icons/folder-prisma.svg";
import prismaOpen from "material-icon-theme/icons/folder-prisma-open.svg";
import controller from "material-icon-theme/icons/folder-controller.svg";
import controllerOpen from "material-icon-theme/icons/folder-controller-open.svg";
import routes from "material-icon-theme/icons/folder-routes.svg";
import routesOpen from "material-icon-theme/icons/folder-routes-open.svg";
import tests from "material-icon-theme/icons/folder-test.svg";
import testsOpen from "material-icon-theme/icons/folder-test-open.svg";

import file from "material-icon-theme/icons/file.svg";
import txt from "material-icon-theme/icons/document.svg";
import js from "material-icon-theme/icons/javascript.svg";
import jsx from "material-icon-theme/icons/react.svg";
import ts from "material-icon-theme/icons/typescript.svg";
import html from "material-icon-theme/icons/html.svg";
import css from "material-icon-theme/icons/css.svg";
import json from "material-icon-theme/icons/json.svg";
import md from "material-icon-theme/icons/markdown.svg";
import git from "material-icon-theme/icons/git.svg";
import gitignore from "material-icon-theme/icons/git.svg";
import docker from "material-icon-theme/icons/docker.svg";
import npm from "material-icon-theme/icons/npm.svg";
import yarn from "material-icon-theme/icons/yarn.svg";
import env from "material-icon-theme/icons/tune.svg";
import tsx from "material-icon-theme/icons/react_ts.svg";
import c from "material-icon-theme/icons/c.svg";
import cpp from "material-icon-theme/icons/cpp.svg";
import rs from "material-icon-theme/icons/rust.svg";
import java from "material-icon-theme/icons/java.svg";
import py from "material-icon-theme/icons/python.svg";
import package_json from "material-icon-theme/icons/nodejs.svg";
import vite_config_ts from "material-icon-theme/icons/vite.svg";
import test_ts from "material-icon-theme/icons/test-ts.svg";
import test_js from "material-icon-theme/icons/test-js.svg";
import test_tsx from "material-icon-theme/icons/test-jsx.svg";
import test_jsx from "material-icon-theme/icons/test-jsx.svg";
import tsconfig_json from "material-icon-theme/icons/tsconfig.svg";
import http from "material-icon-theme/icons/http.svg";
import tailwindcss from "material-icon-theme/icons/tailwindcss.svg";
import postcss from "material-icon-theme/icons/postcss.svg";
import svg from "material-icon-theme/icons/svg.svg";
import image from "material-icon-theme/icons/image.svg";

import {
  FileContent,
  FileContentObj,
  tempNodeStore,
  tempOverwriteNodeStore,
  TreeFileNode,
  TreeFolderNode,
} from "../constants";
import {
  FileTabs,
  LastSelectedFilePaths,
  RenamePathObj,
  SelectedFilePath,
  useWorkspaceStore,
} from "../store";
import { sortNodeChildren } from "../helpers";
import debounce from "lodash.debounce";
import { Socket } from "socket.io-client";
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

const FolderIcons: { [key: string]: string } = {
  folder,
  folderOpen,
  public: publicFolder,
  publicOpen: publicFolderOpen,
  src,
  srcOpen,
  node_modules,
  node_modulesOpen,
  components,
  componentsOpen,
  ui,
  uiOpen,
  hooks,
  hooksOpen,
  lib,
  libOpen,
  styles,
  stylesOpen,
  dist,
  distOpen,
  prisma,
  prismaOpen,
  controller,
  controllerOpen,
  routes,
  routesOpen,
  tests,
  testsOpen,
} as const;

const FileIcons: { [key: string]: string } = {
  file,
  svg,
  jpg: image,
  jpeg: image,
  png: image,
  txt,
  js,
  jsx,
  ts,
  tsx,
  html,
  css,
  json,
  md,
  git,
  gitignore,
  docker,
  npm,
  yarn,
  env,
  c,
  cpp,
  rs,
  java,
  py,
  http,
  rest: http,
  "package.json": package_json,
  "package-lock.json": package_json,
  "vite.config.ts": vite_config_ts,
  "test.ts": test_ts,
  "test.js": test_js,
  "test.tsx": test_tsx,
  "test.jsx": test_jsx,
  "tsconfig.json": tsconfig_json,
  "tsconfig.app.json": tsconfig_json,
  "tsconfig.node.json": tsconfig_json,
  "tailwind.config.js": tailwindcss,
  "tailwind.config.ts": tailwindcss,
  "postcss.config.js": postcss,
  "postcss.config.ts": postcss,
} as const;

export const getFileIcon = (name: string) => {
  if (FileIcons[name]) {
    return FileIcons[name];
  }
  const fileSplit = name.split(".");
  if (fileSplit.length > 2) {
    fileSplit.shift();
    return (
      FileIcons[fileSplit.join(".")] ||
      FileIcons[fileSplit.pop()!] ||
      FileIcons["file"]
    );
  } else {
    return FileIcons[fileSplit.pop()!] || FileIcons["file"];
  }
};

export const getFolderIcon = (folderName: string) => {
  if (FolderIcons[folderName]) {
    return {
      icon: FolderIcons[folderName],
      openIcon: FolderIcons[`${folderName}Open`],
    };
  }
  return { icon: FolderIcons["folder"], openIcon: FolderIcons["folderOpen"] };
};

export const getBreadcrumbIcon = (fileOrFolderName: string) => {
  if (FileIcons[fileOrFolderName]) {
    return FileIcons[fileOrFolderName];
  }
  if (FolderIcons[fileOrFolderName]) {
    return FolderIcons[fileOrFolderName];
  }
  const fileSplit = fileOrFolderName.split(".");
  if (fileSplit.length > 2) {
    fileSplit.shift();
    return (
      FileIcons[fileSplit.join(".")] ||
      FileIcons[fileSplit.pop()!] ||
      FileIcons["file"]
    );
  } else {
    return FileIcons[fileSplit.pop()!] || FileIcons["file"];
  }
};

export const findNode = (
  nodes: Array<TreeFileNode | TreeFolderNode>,
  path: string
): TreeFileNode | TreeFolderNode | null => {
  let foundNode = null;
  for (const node of nodes) {
    if (node.path === path) {
      foundNode = node;
      break;
    }
    if (path.startsWith(node.path)) {
      if (node.type === "folder" && node.children && node.children.length > 0) {
        return findNode(node.children, path);
      }
    }
  }
  return foundNode;
};

// used for updating path and depth of the children of a folder node
export const updatePath = (
  node: TreeFolderNode,
  newPath: string,
  renamedPaths: RenamePathObj[],
  filesContent: FileContentObj,
  parentDepth: number
) => {
  if (node.children.length === 0) {
    node.path = newPath;
    return;
  }

  node.children.forEach((child) => {
    if (child.type === "file") {
      const newFilePath = newPath + "/" + child.name;
      renamedPaths.push({ oldPath: child.path, newPath: newFilePath });
      child.depth = parentDepth + 1;
      filesContent[newFilePath] = filesContent[child.path];
      delete filesContent[child.path];
      child.path = newFilePath;
    } else {
      child.path = newPath + "/" + child.name;
      child.depth = parentDepth + 1;
      updatePath(child, child.path, renamedPaths, filesContent, child.depth);
    }
  });
};

export const checkIfNameIsValid = (name: string) => {
  if (name.length === 0) {
    return false;
  }

  const pattern = /^(?!\.{1,2}$)[^/\0]{1,255}$/;
  if (pattern.test(name)) {
    // Additional checks
    if (name.trim() !== name) {
      // Check for leading/trailing spaces
      return false;
    }
    if ([...name].some((char) => char.charCodeAt(0) < 32)) {
      // Check for control characters
      return false;
    }
    return true;
  }
  return false;
};

export const addChildrenPathsToDeleteArr = (
  node: TreeFolderNode,
  arr: string[],
  filesContent: FileContentObj,
  deletedFileContent: FileContentObj | null
) => {
  node.children.forEach((child) => {
    if (child.type === "file") {
      arr.push(child.path);
      if (deletedFileContent) {
        deletedFileContent[child.path] = filesContent[child.path];
      }
      delete filesContent[child.path];
    } else {
      if (child.children.length > 0) {
        addChildrenPathsToDeleteArr(
          child,
          arr,
          filesContent,
          deletedFileContent
        );
      }
    }
  });
};

export const deletePathsFromFilesContentObj = (
  node: TreeFolderNode,
  filesContent: FileContentObj
) => {
  node.children.forEach((child) => {
    if (child.type === "file") {
      delete filesContent[child.path];
    } else {
      if (child.children.length > 0) {
        deletePathsFromFilesContentObj(child, filesContent);
      }
    }
  });
};

export const moveNodes = (
  sourcePath: string,
  destPath: string,
  overwrite = false,
  errored = false
) => {
  const { fileStructure, filesContent, setFilesContent } =
    useWorkspaceStore.getState();
  if (!fileStructure) {
    return;
  }
  const fileStructureCopy = [...fileStructure];
  const filesContentCopy = { ...filesContent };

  // Find parent of source node and remove source node from parent's children
  const sourceParentPath = sourcePath.split("/").slice(0, -1).join("/");
  const sourceNodeParent = errored
    ? tempNodeStore[sourceParentPath]
    : findNode(fileStructureCopy, sourceParentPath);
  if (!sourceNodeParent || sourceNodeParent.type === "file") {
    return;
  }
  if (!errored) {
    tempNodeStore[sourceNodeParent.path] = sourceNodeParent;
  }
  const { filteredChildren, foundNode: sourceNode } = filterAndFindNode(
    sourceNodeParent,
    sourcePath
  );
  if (!sourceNode) {
    return;
  }

  // Find destination node and check if source node name is unique
  const destNode = errored
    ? tempNodeStore[destPath]
    : findNode(fileStructureCopy, destPath);
  if (!destNode || destNode.type === "file") {
    return;
  }

  if (!errored) {
    tempNodeStore[destNode.path] = destNode;
  }

  const isNameUnique = destNode.children.find(
    (child) => child.name === sourceNode.name
  );
  if (isNameUnique && !overwrite) {
    throw new Error(
      `A file or folder ${sourceNode.name} already exists at this location`
    );
  }

  //Add source node to destination node's children
  sourceNodeParent.children = filteredChildren;
  sourceNode.path = destNode.path + "/" + sourceNode.name;
  sourceNode.depth = destNode.depth + 1;
  // if isNameUnique is true, that means there is a file or folder with the same name in destination path, and we need to overwrite it
  if (isNameUnique && !errored) {
    const {
      filteredChildren: destFilteredChildren,
      foundNode: destNodeToDelete,
    } = filterAndFindNode(destNode, destNode.path + "/" + sourceNode.name);
    if (destNodeToDelete) {
      if (destNodeToDelete.type === "file") {
        tempOverwriteNodeStore[destPath] = {
          overwrittenNode: destNodeToDelete,
          fileContent: filesContentCopy[destNodeToDelete.path],
        };
        delete filesContentCopy[destNodeToDelete.path];
        deleteFilePathsInFileTabBar("file", destNodeToDelete.path, undefined);
      } else {
        const delPaths: string[] = [];
        const deletedFileContent: FileContentObj = {};
        addChildrenPathsToDeleteArr(
          destNodeToDelete,
          delPaths,
          filesContentCopy,
          deletedFileContent
        );
        tempOverwriteNodeStore[destPath] = {
          overwrittenNode: destNodeToDelete,
          fileContent: deletedFileContent,
        };
        // deletePathsFromFilesContentObj(destNodeToDelete, filesContentCopy);
        deleteFilePathsInFileTabBar("file", undefined, delPaths);
      }
    }
    destNode.children = destFilteredChildren;
  }
  destNode.children.push(sourceNode);
  sortNodeChildren(destNode);

  // Update filesContent and fileTabs based upon whether sourceNode is a file or folder
  if (sourceNode.type === "file") {
    // setFilesContent((prev) => {
    //   const newFilesContent = { ...prev, [sourceNode.path]: prev[sourcePath] };
    //   delete newFilesContent[sourcePath];
    //   return newFilesContent;
    // });
    filesContentCopy[sourceNode.path] = filesContent[sourcePath];
    delete filesContentCopy[sourcePath];
    updateFilePathsInFileTabBar(
      { oldPath: sourcePath, newPath: sourceNode.path },
      undefined
    );
  } else {
    const renamedPaths: RenamePathObj[] = [];
    updatePath(
      sourceNode,
      sourceNode.path,
      renamedPaths,
      filesContentCopy,
      sourceNode.depth
    );
    updateFilePathsInFileTabBar(undefined, renamedPaths);
    // setFilesContent(filesContentCopy);
  }

  if (errored && overwrite) {
    const { overwrittenNode, fileContent } =
      tempOverwriteNodeStore[sourceParentPath];
    if (overwrittenNode) {
      if (overwrittenNode.type === "file") {
        filesContentCopy[overwrittenNode.path] = fileContent as FileContent;
        sourceNodeParent.children.push(overwrittenNode);
      } else {
        Object.keys(fileContent).forEach((path) => {
          filesContentCopy[path] = (fileContent as FileContentObj)[path];
        });
        sourceNodeParent.children.push(overwrittenNode);
      }
    }
  }

  setFilesContent(filesContentCopy);

  return fileStructureCopy;
};

export const filterAndFindNode = (
  parentNode: TreeFolderNode,
  nodePathToBeFiltered: string
) => {
  const filteredChildren: Array<TreeFileNode | TreeFolderNode> = [];
  let foundNode: TreeFileNode | TreeFolderNode | null = null as
    | TreeFileNode
    | TreeFolderNode
    | null;

  parentNode.children.forEach((child) => {
    if (child.path !== nodePathToBeFiltered) {
      filteredChildren.push(child);
    } else {
      foundNode = child;
    }
  });

  return { filteredChildren, foundNode };
};

export const updateFilePathsInFileTabBar = (
  renamePath: RenamePathObj | undefined,
  renamePaths: RenamePathObj[] | undefined
) => {
  const {
    fileTabs,
    setFileTabs,
    selectedFilePath,
    setSelectedFilePath,
    lastSelectedFilePaths,
    setLastSelectedFilePaths,
  } = useWorkspaceStore.getState();

  if (renamePath) {
    const { oldPath, newPath } = renamePath;
    const updatedFileTabs = Object.keys(fileTabs).reduce((acc, editorId) => {
      // acc[tab === oldPath ? newPath : tab] = fileTabs[tab];
      acc[editorId] = fileTabs[editorId].map((path) =>
        path.path === oldPath && path.type === "file"
          ? { path: newPath, type: "file" }
          : { path: path.path, type: "file" }
      );
      return acc;
    }, {} as FileTabs);
    // const updatedFileTabs = [...fileTabs].map((tab) =>
    //   tab === oldPath ? newPath : tab
    // );
    // const updatedLastSelectedFilePaths = [...lastSelectedFilePaths].map(
    //   (path) => (path === oldPath ? newPath : path)
    // );
    const updatedLastSelectedFilePaths = Object.keys(
      lastSelectedFilePaths
    ).reduce((acc, editorId) => {
      acc[editorId] = lastSelectedFilePaths[editorId].map((path) =>
        path.path === oldPath && path.type === "file"
          ? { path: newPath, type: "file" }
          : { path: path.path, type: "file" }
      );
      return acc;
    }, {} as LastSelectedFilePaths);
    setFileTabs(updatedFileTabs);
    setLastSelectedFilePaths(updatedLastSelectedFilePaths);
    // if (selectedFilePath[activeEditorId] === oldPath) {
    //   setSelectedFilePath(newPath);
    // }
    const updatedSelectedFilePath = Object.keys(selectedFilePath).reduce(
      (acc, editorId) => {
        acc[editorId] =
          selectedFilePath[editorId].path === oldPath &&
          selectedFilePath[editorId].type === "file"
            ? { path: newPath, type: "file" }
            : selectedFilePath[editorId];
        return acc;
      },
      {} as SelectedFilePath
    );
    setSelectedFilePath(updatedSelectedFilePath);
  } else if (renamePaths) {
    let updatedFileTabs = { ...fileTabs };
    let updatedLastSelectedFilePaths = { ...lastSelectedFilePaths };
    let updatedSelectedFilePath = { ...selectedFilePath };
    const fileTabKeys = Object.keys(fileTabs);
    const lastSelectedFilePathsKeys = Object.keys(lastSelectedFilePaths);
    const selectedFilePathKeys = Object.keys(selectedFilePath);

    renamePaths.forEach(({ oldPath, newPath }) => {
      updatedFileTabs = fileTabKeys.reduce((acc, editorId) => {
        acc[editorId] = updatedFileTabs[editorId].map((path) =>
          path.path === oldPath && path.type === "file"
            ? { path: newPath, type: "file" }
            : { path: path.path, type: "file" }
        );
        return acc;
      }, {} as FileTabs);

      updatedLastSelectedFilePaths = lastSelectedFilePathsKeys.reduce(
        (acc, editorId) => {
          acc[editorId] = updatedLastSelectedFilePaths[editorId].map((path) =>
            path.path === oldPath && path.type === "file"
              ? { path: newPath, type: "file" }
              : { path: path.path, type: "file" }
          );
          return acc;
        },
        {} as LastSelectedFilePaths
      );

      updatedSelectedFilePath = selectedFilePathKeys.reduce((acc, editorId) => {
        acc[editorId] =
          updatedSelectedFilePath[editorId].path === oldPath &&
          updatedSelectedFilePath[editorId].type === "file"
            ? { path: newPath, type: "file" }
            : updatedSelectedFilePath[editorId];
        return acc;
      }, {} as SelectedFilePath);
    });

    setFileTabs(updatedFileTabs);
    setLastSelectedFilePaths(updatedLastSelectedFilePaths);
    setSelectedFilePath(updatedSelectedFilePath);
  } else {
    return;
  }
};

export const deleteFilePathsInFileTabBar = (
  type: "file" | "change",
  deletedPath: string | undefined,
  deletedPaths: string[] | undefined,
  changeType?: "staged" | "unstaged"
) => {
  const {
    fileTabs,
    setFileTabs,
    selectedFilePath,
    setSelectedFilePath,
    setEditorIds,
    activeEditorId,
    setActiveEditorId,
    lastSelectedEditorIds,
    setLastSelectedEditorIds,
    lastSelectedFilePaths,
    setLastSelectedFilePaths,
  } = useWorkspaceStore.getState();
  if (deletedPath) {
    // const updatedFileTabs = [...fileTabs].filter((tab) => tab !== deletedPath);
    const editorsToKeep: string[] = [];
    let updatedLastSelectedEditorIds: string[] = [...lastSelectedEditorIds];
    const updatedFileTabs = Object.keys(fileTabs).reduce((acc, editorId) => {
      const newTabs = fileTabs[editorId].filter(
        (tab) => !(tab.path === deletedPath && tab.type === "file")
      );
      if (newTabs.length > 0) {
        acc[editorId] = newTabs;
        editorsToKeep.push(editorId);
      } else {
        updatedLastSelectedEditorIds = lastSelectedEditorIds.filter(
          (id) => id !== editorId
        );
      }
      return acc;
    }, {} as FileTabs);
    // const updatedLastSelectedFilePaths = [...lastSelectedFilePaths].filter(
    //   (path) => path !== deletedPath
    // );
    const updatedLastSelectedFilePaths = Object.keys(
      lastSelectedFilePaths
    ).reduce((acc, editorId) => {
      // If fileTabs for that editor still exists, then only it makes sense to keep the lastSelectedFilePaths state for that editor
      if (updatedFileTabs[editorId]) {
        acc[editorId] = lastSelectedFilePaths[editorId].filter(
          (path) => !(path.path === deletedPath && path.type === "file")
        );
      }
      return acc;
    }, {} as LastSelectedFilePaths);
    // if (selectedFilePath === deletedPath) {
    //   setSelectedFilePath(updatedLastSelectedFilePaths.pop() || "");
    // }
    const updatedSelectedFilePath = Object.keys(selectedFilePath).reduce(
      (acc, editorId) => {
        // If fileTabs for that editor still exists, then only it makes sense to keep the selectedFilePath state for that editor
        if (updatedFileTabs[editorId]) {
          acc[editorId] =
            selectedFilePath[editorId].path === deletedPath &&
            selectedFilePath[editorId].type === "file"
              ? updatedLastSelectedFilePaths[editorId].pop()!
              : selectedFilePath[editorId];
        }
        return acc;
      },
      {} as SelectedFilePath
    );
    // Object.keys(updatedFileTabs).forEach((editorId) => {});
    const isActiveEditor = editorsToKeep.find((id) => id === activeEditorId);
    if (!isActiveEditor) {
      setActiveEditorId(updatedLastSelectedEditorIds.pop() || "");
    }
    setEditorIds(editorsToKeep);
    setLastSelectedEditorIds(updatedLastSelectedEditorIds);
    setFileTabs(updatedFileTabs);
    setLastSelectedFilePaths(updatedLastSelectedFilePaths);
    setSelectedFilePath(updatedSelectedFilePath);
  } else if (deletedPaths) {
    const deletedPathsSet = new Set(deletedPaths);
    const editorsToKeep: string[] = [];
    let updatedLastSelectedEditorIds: string[] = [...lastSelectedEditorIds];
    // const updatedFileTabs = [...fileTabs].filter(
    //   (tab) => !deletedPathsSet.has(tab)
    // );
    const updatedFileTabs = Object.keys(fileTabs).reduce((acc, editorId) => {
      const newTabs = fileTabs[editorId].filter((tab) => {
        if (type === "file") {
          return !(deletedPathsSet.has(tab.path) && tab.type === type);
        } else {
          if (changeType) {
            return !(
              deletedPathsSet.has(tab.path) &&
              tab.type === type &&
              tab.changeType === changeType
            );
          }
          return true;
        }
      });
      if (newTabs.length > 0) {
        acc[editorId] = newTabs;
        editorsToKeep.push(editorId);
      } else {
        updatedLastSelectedEditorIds = lastSelectedEditorIds.filter(
          (id) => id !== editorId
        );
      }
      return acc;
    }, {} as FileTabs);
    // const updatedLastSelectedFilePaths = [...lastSelectedFilePaths].filter(
    //   (path) => !deletedPathsSet.has(path)
    // );
    const updatedLastSelectedFilePaths = Object.keys(
      lastSelectedFilePaths
    ).reduce((acc, editorId) => {
      if (updatedFileTabs[editorId]) {
        acc[editorId] = lastSelectedFilePaths[editorId].filter((path) => {
          if (type === "file") {
            return !(deletedPathsSet.has(path.path) && path.type === type);
          } else {
            if (changeType) {
              return !(
                deletedPathsSet.has(path.path) &&
                path.type === type &&
                path.changeType === changeType
              );
            }
            return true;
          }
        });
      }
      return acc;
    }, {} as LastSelectedFilePaths);
    // if (deletedPathsSet.has(selectedFilePath)) {
    //   setSelectedFilePath(updatedLastSelectedFilePaths.pop() || "");
    // }
    const updatedSelectedFilePath = Object.keys(selectedFilePath).reduce(
      (acc, editorId) => {
        if (updatedFileTabs[editorId]) {
          // acc[editorId] =
          //   deletedPathsSet.has(selectedFilePath[editorId].path) &&
          //   selectedFilePath[editorId].type === type
          //     ? updatedLastSelectedFilePaths[editorId].pop()!
          //     : selectedFilePath[editorId];
          acc[editorId] =
            type === "file"
              ? deletedPathsSet.has(selectedFilePath[editorId].path) &&
                selectedFilePath[editorId].type === type
                ? updatedLastSelectedFilePaths[editorId].pop()!
                : selectedFilePath[editorId]
              : deletedPathsSet.has(selectedFilePath[editorId].path) &&
                selectedFilePath[editorId].type === type &&
                selectedFilePath[editorId].changeType === changeType
              ? updatedLastSelectedFilePaths[editorId].pop()!
              : selectedFilePath[editorId];
        }
        return acc;
      },
      {} as SelectedFilePath
    );
    const isActiveEditor = editorsToKeep.find((id) => id === activeEditorId);
    if (!isActiveEditor) {
      setActiveEditorId(updatedLastSelectedEditorIds.pop() || "");
    }
    setEditorIds(editorsToKeep);
    setLastSelectedEditorIds(updatedLastSelectedEditorIds);
    setSelectedFilePath(updatedSelectedFilePath);
    setFileTabs(updatedFileTabs);
    setLastSelectedFilePaths(updatedLastSelectedFilePaths);
  } else {
    return;
  }
};

export let terminalResizeData: {
  [pid: string]: { cols: number; rows: number };
} = {};

export const sendResizeEvent = debounce((socket: Socket) => {
  socket.emit("term:resize", terminalResizeData, (error: Error | null) => {
    if (error) {
      console.error(error);
    }
    terminalResizeData = {};
  });
}, 300);

// const config: ManifestConfig = {
//   activeIconPack: "angular",
//   hidesExplorerArrows: true,
//   folders: {
//     theme: "classic",
//     associations: {},
//   },
//   files: {
//     associations: {
//       git: "git",
//       env: "env",
//       zip: "zip",
//     },
//   },
//   languages: {
//     associations: {},
//   },
// };
// const manifest = generateManifest(config);
// console.log(manifest);
