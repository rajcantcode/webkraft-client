import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  editorSupportedLanguages,
  FileContentObj,
  TreeFileNode,
  TreeFolderNode,
  FlattenedTreeFileNode,
  FlattenedTree,
  InputNode,
  FileContent,
} from "../constants.js";
import TreeFolder from "./TreeFolder.js";
import TreeFile from "./TreeFile.js";
import { RenamePathObj, useWorkspaceStore } from "../store.js";
import "../styles/template-search-modal.css";
import {
  addChildrenPathsToDeleteArr,
  checkIfNameIsValid,
  deleteFilePathsInFileTabBar,
  findNode,
  moveNodes,
  updateFilePathsInFileTabBar,
  updatePath,
} from "../lib/utils.js";
import { ScrollArea } from "./ui/ScrollArea.js";
import { Socket } from "socket.io-client";
import {
  loadFilesOfFolder,
  loadFilesOfNodeModulesFolder,
  sortNodeChildren,
} from "../helpers.js";
import { useVirtualizer } from "@tanstack/react-virtual";
import TreeInput from "./TreeInput.js";
import { createPortal } from "react-dom";

type ExpandedChildrenLength = { path: string; length: number };
type DepthAndStartInfo = {
  depth: number;
  start: number;
  childCount: number;
};
type ExpandedNode = { [path: string]: DepthAndStartInfo };
type NodeExpandedState = {
  [path: string]: boolean;
};

const flattenTree = (
  nodes: Array<TreeFileNode | TreeFolderNode>,
  nodeExpandedState: NodeExpandedState,
  startPath: string = "",
  useStartPath: boolean = false,
  depthToSubtractRef: React.MutableRefObject<number> = { current: 0 },
  parentIndex: number = -1,
  flattenedNodes: FlattenedTree = [],
  expandedChildrenLength: ExpandedChildrenLength[] = [],
  expandedNodes: ExpandedNode = {},
): {
  flattenedTree: FlattenedTree;
  nodeExpandedState: NodeExpandedState;
  expandedChildrenLength: ExpandedChildrenLength[];
  expandedNodes: ExpandedNode;
} => {
  if (startPath && useStartPath) {
    const newNodes = findNode(nodes, startPath);

    if (newNodes && newNodes.type === "folder") {
      nodes = newNodes.children;
      depthToSubtractRef.current = newNodes.depth + 1;
    }
  }
  for (const node of nodes) {
    // Current node's index in the flattened array
    const currentIndex = flattenedNodes.length;

    // Destructure to exclude 'children' and include other properties
    // @ts-expect-error
    const { children, ...flatNode } =
      node.type === "folder"
        ? {
            ...node,
            pni: parentIndex,
            index: currentIndex,
            isExpanded: nodeExpandedState[node.path] || false,
          }
        : ({ ...node, pni: parentIndex } as FlattenedTreeFileNode);

    const parentPath = node.path.split("/").slice(0, -1).join("/");
    if (node.type === "folder" && nodeExpandedState[node.path]) {
      expandedNodes[node.path] = {
        depth: node.depth,
        start: 0,
        childCount: node.children.length,
      };
      if (parentPath) {
        expandedChildrenLength.push({
          path: node.path,
          length: node.children.length,
        });
      }
    }

    // Add the flat node to the flattened array
    flattenedNodes.push(flatNode);

    // If the node is a folder and is expanded, process its children
    if (
      node.type === "folder" &&
      nodeExpandedState[node.path] &&
      node.children &&
      node.children.length > 0
    ) {
      flattenTree(
        node.children,
        nodeExpandedState,
        startPath,
        false,
        depthToSubtractRef,
        currentIndex,
        flattenedNodes,
        expandedChildrenLength,
        expandedNodes,
      );
    }
  }

  return {
    flattenedTree: flattenedNodes,
    nodeExpandedState,
    expandedChildrenLength,
    expandedNodes,
  };
};

const itemSize = window.innerWidth > 768 ? 24 : 32;

const FileTree = ({
  padLeft,
  fileFetchStatus,
  socket,
  // path from which to start the flattened tree, is only passed when used in breadcrumbs
  startPath = "",
}: {
  padLeft: number;
  fileFetchStatus: { [key: string]: boolean };
  socket: Socket | null;
  startPath?: string;
}) => {
  const fileTree = useWorkspaceStore((state) => state.fileStructure);
  const setFileTree = useWorkspaceStore((state) => state.setFileStructure);
  const setFilesContent = useWorkspaceStore((state) => state.setFilesContent);
  const selectedFilePath = useWorkspaceStore((state) => state.selectedFilePath);
  const activeEditorId = useWorkspaceStore((state) => state.activeEditorId);
  const [currSelectedFilePath, setCurrSelectedFilePath] = useState<string>(
    selectedFilePath[activeEditorId],
  );
  const isNodeModulesChildrenReceived = useRef<{ [path: string]: boolean }>({});
  const [nodeExpandedState, setNodeExpandedState] = useState<NodeExpandedState>(
    () => (startPath ? {} : fileTree ? { [fileTree[0].path]: true } : {}),
  );

  const expandedChildrenLengthRef = useRef<ExpandedChildrenLength[]>([]);
  // Used when filetree is used in breadcrumbs
  const depthToSubtractRef = useRef<number>(0);
  const expandedNodesRef = useRef<ExpandedNode>({});
  const [flattenedTree, setFlattenedTree] = useState(() => {
    if (fileTree) {
      const { flattenedTree, expandedChildrenLength, expandedNodes } = startPath
        ? flattenTree(
            fileTree,
            nodeExpandedState,
            startPath,
            true,
            depthToSubtractRef,
          )
        : flattenTree(fileTree, nodeExpandedState);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
      return flattenedTree;
    } else {
      return null;
    }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathToFirstLevelChildrenNames = useRef<{ [path: string]: Set<string> }>(
    {},
  );
  const visibleNodesRef = useRef<Set<string>>(new Set<string>());
  const [pathToScroll, setPathToScroll] = useState<string | null>(null);

  useEffect(() => {
    setCurrSelectedFilePath(selectedFilePath[activeEditorId]);
  }, [selectedFilePath, activeEditorId, setCurrSelectedFilePath]);

  const virtualizer = useVirtualizer({
    count: flattenedTree ? flattenedTree.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemSize,
    overscan: 5,
  });

  const scrollToPath = useCallback(
    (path: string) => {
      const index = flattenedTree?.findIndex((node) => node.path === path);
      if (index && index !== -1) {
        virtualizer.scrollToIndex(index, {
          align: "center",
          behavior: "smooth",
        });
      }
    },
    [flattenedTree, virtualizer],
  );

  useEffect(() => {
    if (pathToScroll) {
      scrollToPath(pathToScroll);
      setPathToScroll(null);
    }
  }, [pathToScroll]);
  useEffect(() => {
    // This effect here is to expand the nodes which are not expanded when the selectedFilePath changes, and to scroll to that path in the fileTree if it is not visible
    if (!currSelectedFilePath || startPath) return;
    const splitPaths = currSelectedFilePath.split("/");
    const pathsArray: string[] = [];
    if (!expandedNodesRef.current[splitPaths[0]]) {
      pathsArray.push(splitPaths[0]);
    }
    let pathToCheck = splitPaths[0];
    for (let i = 1; i < splitPaths.length - 1; i++) {
      pathToCheck += "/" + splitPaths[i];
      if (!expandedNodesRef.current[pathToCheck]) {
        pathsArray.push(pathToCheck);
      }
    }
    if (pathsArray.length !== 0) {
      expandNode(pathsArray);
      setPathToScroll(currSelectedFilePath);
    } else {
      if (!visibleNodesRef.current.has(currSelectedFilePath)) {
        scrollToPath(currSelectedFilePath);
      }
    }
  }, [currSelectedFilePath, startPath]);

  useEffect(() => {
    if (!socket) return;
    const handleFileAdd = (data: { path: string }) => {
      if (!fileTree) {
        return;
      }
      const { path } = data;
      const parentPath = path.split("/").slice(0, -1).join("/");
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = [...fileTree];
      const parentNode = findNode(fileTreeCopy, parentPath);

      if (!parentNode || parentNode.type === "file") return;
      const fileName = path.split("/").pop();
      parentNode.children.push({
        type: "file",
        name: fileName!,
        path,
        depth: parentNode.depth + 1,
      });
      sortNodeChildren(parentNode);
      setFileTree(fileTreeCopy);
      const { flattenedTree, expandedChildrenLength, expandedNodes } = startPath
        ? flattenTree(fileTree, nodeExpandedState, startPath, true)
        : flattenTree(fileTree, nodeExpandedState);
      setFlattenedTree(flattenedTree);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
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
      const fileTreeCopy = [...fileTree];
      const { path } = data;
      const parentPath = path.split("/").slice(0, -1).join("/");
      const parentNode = findNode(fileTreeCopy, parentPath);
      if (!parentNode || parentNode.type === "file") return;
      parentNode.children = parentNode.children.filter(
        (node) => node.path !== path,
      );
      setFileTree(fileTreeCopy);
      const { flattenedTree, expandedChildrenLength, expandedNodes } = startPath
        ? flattenTree(fileTree, nodeExpandedState, startPath, true)
        : flattenTree(fileTree, nodeExpandedState);
      setFlattenedTree(flattenedTree);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
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
      const fileTreeCopy = [...fileTree];
      const parentNode = findNode(fileTreeCopy, parentPath);
      if (!parentNode || parentNode.type === "file") return;
      const folderName = path.split("/").pop();
      parentNode.children.push({
        type: "folder",
        name: folderName!,
        path,
        children: [],
        depth: parentNode.depth + 1,
      });
      sortNodeChildren(parentNode);
      setFileTree(fileTreeCopy);
      const { flattenedTree, expandedChildrenLength, expandedNodes } = startPath
        ? flattenTree(fileTree, nodeExpandedState, startPath, true)
        : flattenTree(fileTree, nodeExpandedState);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
      setFlattenedTree(flattenedTree);
    };

    const handleFolderUnlink = (data: { path: string }) => {
      if (!fileTree) {
        return;
      }
      const { path } = data;
      const parentPath = path.split("/").slice(0, -1).join("/");
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = [...fileTree];
      const parentNode = findNode(fileTreeCopy, parentPath);
      if (!parentNode || parentNode.type === "file") return;
      const nodeToBeDeleted = parentNode.children.find(
        (node) => node.path === path,
      );
      parentNode.children = parentNode.children.filter(
        (node) => node.path !== path,
      );
      setFileTree(fileTreeCopy);
      const { flattenedTree, expandedChildrenLength, expandedNodes } = startPath
        ? flattenTree(fileTree, nodeExpandedState, startPath, true)
        : flattenTree(fileTree, nodeExpandedState);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
      setFlattenedTree(flattenedTree);

      if (nodeToBeDeleted?.type !== "folder") return;
      const deletedPaths: string[] = [];
      const filesContent = useWorkspaceStore.getState().filesContent;
      addChildrenPathsToDeleteArr(
        nodeToBeDeleted!,
        deletedPaths,
        filesContent,
        null,
      );
      setFilesContent({ ...filesContent });
      deleteFilePathsInFileTabBar(undefined, deletedPaths);
    };

    const handleAddFolderBulk = (folderPaths: string[]) => {
      if (!fileTree) return;
      const fileTreeCopy = [...fileTree];
      const parentNodes: { [path: string]: TreeFolderNode } = {};
      folderPaths.forEach((path) => {
        const parentPath = path.split("/").slice(0, -1).join("/");
        if (!parentNodes[parentPath]) {
          const parentNode = findNode(fileTreeCopy, parentPath);
          if (!parentNode || parentNode.type === "file") return;
          parentNodes[parentPath] = parentNode;
        }
        const folderName = path.split("/").pop();
        parentNodes[parentPath].children.push({
          type: "folder",
          name: folderName!,
          path,
          children: [],
          depth: parentNodes[parentPath].depth + 1,
        });
      });
      Object.keys(parentNodes).forEach((path) => {
        sortNodeChildren(parentNodes[path]);
      });
      setFileTree(fileTreeCopy);
      const { flattenedTree, expandedChildrenLength, expandedNodes } = startPath
        ? flattenTree(fileTree, nodeExpandedState, startPath, true)
        : flattenTree(fileTree, nodeExpandedState);
      setFlattenedTree(flattenedTree);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
    };

    const handleDelFolderBulk = (folderPaths: string[]) => {
      if (!fileTree) return;
      const fileTreeCopy = [...fileTree];
      const parentNodes: { [path: string]: TreeFolderNode } = {};
      const {
        filesContent,
        setFilesContent,
        fileTabs,
        setFileTabs,
        lastSelectedFilePaths,
        setLastSelectedFilePaths,
      } = useWorkspaceStore.getState();
      const fileTabsCopy = [...fileTabs[activeEditorId]];
      let lastSelectedFilePathsCopy = [
        ...lastSelectedFilePaths[activeEditorId],
      ];
      folderPaths.forEach((path) => {
        const parentPath = path.split("/").slice(0, -1).join("/");
        if (!parentNodes[parentPath]) {
          const parentNode = findNode(fileTreeCopy, parentPath);
          if (!parentNode || parentNode.type === "file") return;
          parentNodes[parentPath] = parentNode;
        }
        const filteredChildren: Array<TreeFileNode | TreeFolderNode> = [];
        let deletedNode = null as TreeFileNode | TreeFolderNode | null;
        parentNodes[parentPath].children.forEach((node) => {
          if (node.path === path) {
            deletedNode = node;
          } else {
            filteredChildren.push(node);
          }
        });
        parentNodes[parentPath].children = filteredChildren;
        if (
          deletedNode &&
          deletedNode.type === "folder" &&
          deletedNode.children.length > 0
        ) {
          deletedNode.children.forEach((node) => {
            if (node.type === "file") {
              delete filesContent[node.path];
              fileTabsCopy.splice(
                fileTabs[activeEditorId].indexOf(node.path),
                1,
              );
              lastSelectedFilePathsCopy = lastSelectedFilePathsCopy.filter(
                (path) => path !== node.path,
              );
            }
          });
        }
      });
      Object.keys(parentNodes).forEach((path) => {
        sortNodeChildren(parentNodes[path]);
      });
      setFileTree(fileTreeCopy);
      const { flattenedTree, expandedChildrenLength, expandedNodes } = startPath
        ? flattenTree(fileTree, nodeExpandedState, startPath, true)
        : flattenTree(fileTree, nodeExpandedState);
      setFlattenedTree(flattenedTree);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
      setFilesContent({ ...filesContent });
      setFileTabs((prev) => ({ ...prev, [activeEditorId]: fileTabsCopy }));
      setLastSelectedFilePaths((prev) => ({
        ...prev,
        [activeEditorId]: lastSelectedFilePathsCopy,
      }));
    };

    socket.on("file:add", handleFileAdd);
    socket.on("file:change", handleFileChange);
    socket.on("file:unlink", handleFileUnlink);
    socket.on("folder:add", handleFolderAdd);
    socket.on("folder:unlink", handleFolderUnlink);
    socket.on("folder:add:bulk", handleAddFolderBulk);
    socket.on("folder:del:bulk", handleDelFolderBulk);
    return () => {
      socket.off("file:add", handleFileAdd);
      socket.off("file:change", handleFileChange);
      socket.off("file:unlink", handleFileUnlink);
      socket.off("folder:add", handleFolderAdd);
      socket.off("folder:unlink", handleFolderUnlink);
      socket.off("folder:add:bulk", handleAddFolderBulk);
      socket.off("folder:del:bulk", handleDelFolderBulk);
    };
  }, [
    socket,
    fileTree,
    flattenedTree,
    setFileTree,
    setFilesContent,
    setFlattenedTree,
    nodeExpandedState,
    startPath,
    activeEditorId,
  ]);

  // This function is a bit confusing.
  // It is used for chrcking if the file/folder being added has unique name for the folder in which it is being added.
  // When file/folder is added using the input, the input element is assigned a pni(parent node index), which tells the index of the parent node for that input element in the flattened tree. So it just starts checking from pni+1 for any repeating names.
  // But when a file/folder is dropped on to a folder, we don't know the index of the folder on which it is dropped, because each node is assigned it's pni but not it's own index. So I search from the beginning and look for items with depth=depth+1
  const checkIfNameIsUnique = useCallback(
    (pni: number, depth: number, newName: string) => {
      if (!flattenedTree) return false;

      if (pni === -1 && !startPath) return false;

      const pathToCheck = flattenedTree[pni].path;
      if (!pathToFirstLevelChildrenNames.current[pathToCheck]) {
        const nameSet = new Set<string>();
        let i = pni + 1;
        const depthCopy = depth;
        while (i < flattenedTree.length && depth >= depthCopy) {
          const currNode = flattenedTree[i];
          if (
            currNode.type !== "input" &&
            currNode.pni === pni &&
            currNode.depth === depthCopy
          ) {
            nameSet.add(currNode.name.toLowerCase());
          }
          i++;
          if (i >= flattenedTree.length) {
            break;
          }
          depth = flattenedTree[i].depth;
        }
        pathToFirstLevelChildrenNames.current[pathToCheck] = nameSet;
      }
      // debugger;
      const lowerCaseNewName = newName.toLowerCase();
      const nameSet = pathToFirstLevelChildrenNames.current[pathToCheck];
      if (nameSet.has(lowerCaseNewName)) {
        return false;
      }
      return true;
    },
    [flattenedTree, startPath],
  );

  const deleteNamesSet = useCallback(
    (parentIndex: number) => {
      if (!flattenedTree) return;
      delete pathToFirstLevelChildrenNames.current[
        flattenedTree[parentIndex].path
      ];
    },
    [flattenedTree],
  );

  const insertInputNode = useCallback(
    (index: number, operation: "add-file" | "add-folder", depth: number) => {
      if (!flattenedTree) return;
      const inputNode: InputNode = {
        type: "input",
        operation,
        pni: index,
        value: "",
        depth: depth + 1,
        error: "",
        path: `${flattenedTree[index].path}/input`,
      };
      expandedNodesRef.current[flattenedTree[index].path].childCount++;
      const flattenedTreeCopy = [...flattenedTree];
      flattenedTreeCopy.splice(index + 1, 0, inputNode);
      setFlattenedTree(flattenedTreeCopy);
    },
    [flattenedTree, setFlattenedTree],
  );

  const removeInputNode = useCallback(
    (pni: number) => {
      if (!flattenedTree) return;
      // remove element at index pni + 1, from flattenedTree
      expandedNodesRef.current[flattenedTree[pni].path].childCount--;
      const flattenedTreeCopy = [...flattenedTree];
      flattenedTreeCopy.splice(pni + 1, 1);
      setFlattenedTree(flattenedTreeCopy);
    },
    [flattenedTree, setFlattenedTree],
  );

  const expandNode = useCallback(
    async (...paths: (string | string[])[]) => {
      if (!fileTree) return;

      const fileTreeCopy = [...fileTree];
      const inputPaths = paths.flat();
      for (const path of inputPaths) {
        const node = findNode(fileTreeCopy, path);
        if (!node || node.type === "file") return;
        if (node.children.length > 0) {
          try {
            if (node.path.includes("node_modules")) {
              await loadFilesOfNodeModulesFolder(
                node,
                fileFetchStatus,
                socket?.io.opts.host!,
              );
            } else {
              await loadFilesOfFolder(node, fileFetchStatus);
            }
          } catch (error) {
            console.error(`Error fetching files of folder ${node.path}`, error);
          }
        }
      }
      const nodeExpandedStateCopy = { ...nodeExpandedState };
      for (const path of inputPaths) {
        nodeExpandedStateCopy[path] = true;
      }
      setFileTree(fileTreeCopy);
      const {
        flattenedTree,
        nodeExpandedState: newNodeExpandedState,
        expandedChildrenLength,
        expandedNodes,
      } = startPath
        ? flattenTree(fileTreeCopy, nodeExpandedStateCopy, startPath, true)
        : flattenTree(fileTreeCopy, nodeExpandedStateCopy);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
      setFlattenedTree(flattenedTree);
      setNodeExpandedState(newNodeExpandedState);
    },
    [
      setFlattenedTree,
      setFileTree,
      fileTree,
      nodeExpandedState,
      socket,
      fileFetchStatus,
      startPath,
    ],
  );

  const closeNode = useCallback(
    (path: string) => {
      if (!fileTree) return;
      const fileTreeCopy = [...fileTree];
      const node = findNode(fileTreeCopy, path);
      if (!node || node.type === "file") return;
      // node.isExpanded = false;
      const nodeExpandedStateCopy = { ...nodeExpandedState };
      nodeExpandedStateCopy[path] = false;
      setFileTree(fileTreeCopy);
      const {
        flattenedTree,
        nodeExpandedState: newNodeExpandedState,
        expandedChildrenLength,
        expandedNodes,
      } = startPath
        ? flattenTree(fileTreeCopy, nodeExpandedStateCopy, startPath, true)
        : flattenTree(fileTreeCopy, nodeExpandedStateCopy);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
      setFlattenedTree(flattenedTree);
      setNodeExpandedState(newNodeExpandedState);
    },
    [fileTree, setFileTree, setFlattenedTree, nodeExpandedState, startPath],
  );

  const handleRename = (
    pni: number,
    depth: number,
    path: string,
    newName: string,
    type: "file" | "folder",
  ) => {
    if (!fileTree || !flattenedTree) {
      return;
    }
    // const parentPath = node.path.split("/").slice(0, -1).join("/");
    const isNameValid = checkIfNameIsValid(newName);
    if (!isNameValid) {
      deleteNamesSet(pni);
      throw new Error(
        `The name ${newName} is not valid. Please choose a different name.`,
        { cause: "invalid-name" },
      );
    }
    const isNameUnique = checkIfNameIsUnique(pni, depth, newName);
    if (!isNameUnique) {
      deleteNamesSet(pni);
      throw new Error(
        `A file or folder ${newName} already exists at this location. Please choose a different name.`,
        { cause: "duplicate-name" },
      );
    }
    deleteNamesSet(pni);

    const parentPath = flattenedTree[pni].path;
    const parentNode = findNode(fileTree, parentPath);
    if (!parentNode || parentNode.type !== "folder")
      throw new Error("No node found");
    const node = parentNode.children.find((node) => node.path === path);
    if (!node) throw new Error("No node found");
    const fileExtension = newName.split(".").pop();
    node.name = newName;
    const oldPath = node.path;
    node.path = parentPath + "/" + newName;
    sortNodeChildren(parentNode);
    let oldFileContent: FileContent;
    if (node.type === "file") {
      setFilesContent((prev) => {
        oldFileContent = prev[oldPath];
        const newFilesContent = {
          ...prev,
          [node.path]: {
            name: node.name,
            language: fileExtension
              ? editorSupportedLanguages[fileExtension] || "text"
              : "text",
            content: prev[oldPath].content,
          },
        };
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
    const fileTreeCopy = [...fileTree];
    setFileTree(fileTreeCopy);
    const {
      flattenedTree: newFlattenedTree,
      expandedChildrenLength,
      expandedNodes,
    } = startPath
      ? flattenTree(fileTree, nodeExpandedState, startPath, true)
      : flattenTree(fileTree, nodeExpandedState);
    expandedChildrenLengthRef.current = expandedChildrenLength;
    expandedNodesRef.current = expandedNodes;
    setFlattenedTree(newFlattenedTree);

    const action = type === "file" ? "file:rename" : "folder:rename";
    socket?.emit(
      action,
      { path: oldPath, newPath: node.path },
      (
        error: Error | null,
        data: { success: boolean; oldPath: string; newPath: string },
      ) => {
        const { oldPath, newPath } = data;
        if (error) {
          // Revert the changes
          if (node.type === "file") {
            setFilesContent((prev) => {
              const newFilesContent = {
                ...prev,
                [oldPath]: oldFileContent,
              };
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
          const fileTreeCopy = [...fileTree];
          setFileTree(fileTreeCopy);
          const { flattenedTree, expandedChildrenLength, expandedNodes } =
            startPath
              ? flattenTree(fileTree, nodeExpandedState, startPath, true)
              : flattenTree(fileTree, nodeExpandedState);
          expandedChildrenLengthRef.current = expandedChildrenLength;
          expandedNodesRef.current = expandedNodes;
          setFlattenedTree(flattenedTree);

          console.error("Error renaming file/folder", error);
          // ToDo -> Display a toast message
        }
      },
    );
  };

  const getChildren = useCallback(
    (path: string, depth: number) => {
      if (isNodeModulesChildrenReceived.current[path]) {
        expandNode(path);
        return;
      }
      socket?.emit(
        "get:children",
        { path, depth: ++depth },
        (error: Error | null, data: Array<TreeFileNode | TreeFolderNode>) => {
          if (error) {
            isNodeModulesChildrenReceived.current[path] = false;
            console.error("Error getting children", error);
            return;
          }
          isNodeModulesChildrenReceived.current[path] = true;
          const fileTreeCopy = [...fileTree!];
          const parentNode = findNode(fileTreeCopy!, path);
          if (!parentNode || parentNode.type === "file") return;
          parentNode.children = data;
          // parentNode.isExpanded = true;
          const nodeExpandedStateCopy = { ...nodeExpandedState };
          nodeExpandedStateCopy[parentNode.path] = true;
          loadFilesOfNodeModulesFolder(
            parentNode,
            fileFetchStatus,
            socket?.io.opts.host!,
          );
          setFileTree(fileTreeCopy);
          const {
            flattenedTree,
            nodeExpandedState: newNodeExpandedState,
            expandedChildrenLength,
            expandedNodes,
          } = startPath
            ? flattenTree(fileTreeCopy, nodeExpandedStateCopy, startPath, true)
            : flattenTree(fileTreeCopy, nodeExpandedStateCopy);
          expandedChildrenLengthRef.current = expandedChildrenLength;
          expandedNodesRef.current = expandedNodes;
          setFlattenedTree(flattenedTree);
          setNodeExpandedState(newNodeExpandedState);
        },
      );
    },
    [socket, fileTree, nodeExpandedState, startPath],
  );
  const handleDelete = useCallback(
    (path: string, pni: number, type: "file" | "folder") => {
      if (!fileTree || !flattenedTree) {
        return;
      }
      // const fileTreeCopy = structuredClone(fileTree);
      const fileTreeCopy = [...fileTree];
      // const parentPath = path.split("/").slice(0, -1).join("/");
      const parentPath = flattenedTree[pni].path;

      const parentNode = findNode(fileTreeCopy, parentPath);
      if (!parentNode || parentNode.type === "file") return;
      const nodeToBeDeleted = parentNode.children.find(
        (node) => node.path === path,
      );

      const { filesContent } = useWorkspaceStore.getState();
      const deletedFileContent: FileContentObj = {};
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
          deletedFileContent,
        );
        // setDeletedPaths(deletedPaths);
        setFilesContent({ ...filesContent });
        deleteFilePathsInFileTabBar(undefined, deletedPaths);
      }

      // filter out the node to be deleted
      parentNode.children = parentNode.children.filter(
        (node) => node.path !== path,
      );

      setFileTree(fileTreeCopy);
      const {
        flattenedTree: newFlattenedTree,
        expandedChildrenLength,
        expandedNodes,
      } = startPath
        ? flattenTree(fileTree, nodeExpandedState, startPath, true)
        : flattenTree(fileTree, nodeExpandedState);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
      setFlattenedTree(newFlattenedTree);

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
            const fileTreeCopy = [...fileTree];
            setFileTree(fileTreeCopy);
            const { flattenedTree, expandedChildrenLength, expandedNodes } =
              startPath
                ? flattenTree(fileTree, nodeExpandedState, startPath, true)
                : flattenTree(fileTree, nodeExpandedState);
            expandedChildrenLengthRef.current = expandedChildrenLength;
            expandedNodesRef.current = expandedNodes;
            setFlattenedTree(flattenedTree);
            setFilesContent((prev) => ({
              ...prev,
              ...deletedFileContent,
            }));
            console.error("Error deleting file/folder", error);

            // ToDo -> Display a toast message
          }
        },
      );
    },
    [fileTree, nodeExpandedState, flattenedTree],
  );

  const handleAddFile = useCallback(
    (pni: number, depth: number, fileName: string) => {
      if (!fileTree || !flattenedTree) {
        return;
      }
      const isNameUnique = checkIfNameIsUnique(pni, depth, fileName);
      const isNameValid = checkIfNameIsValid(fileName);
      if (!isNameValid) {
        removeInputNode(pni);
        deleteNamesSet(pni);
        throw new Error(
          `The name ${fileName} is not valid. Please choose a different name.`,
        );
      }
      if (!isNameUnique) {
        removeInputNode(pni);
        deleteNamesSet(pni);
        throw new Error(
          `A file or folder ${fileName} already exists at this location. Please choose a different name.`,
        );
      }
      deleteNamesSet(pni);
      const fileExtension = fileName.split(".").pop();
      const fileTreeCopy = [...fileTree];
      const parentNode = findNode(fileTreeCopy, flattenedTree[pni].path);
      if (!parentNode || parentNode.type === "file") return;
      const pathToAdd = `${parentNode.path}/${fileName}`;
      parentNode.children.push({
        type: "file",
        name: fileName,
        path: pathToAdd,
        depth: parentNode.depth + 1,
      });
      // ToDo -> Also sort the children array
      sortNodeChildren(parentNode);
      setFileTree(fileTreeCopy);
      setFilesContent((prev) => ({
        ...prev,
        [pathToAdd]: {
          name: fileName,
          content: "",
          language: fileExtension
            ? editorSupportedLanguages[fileExtension] || "text"
            : "text",
        },
      }));
      const {
        flattenedTree: newFlattenedTree,
        expandedChildrenLength,
        expandedNodes,
      } = startPath
        ? flattenTree(fileTree, nodeExpandedState, startPath, true)
        : flattenTree(fileTree, nodeExpandedState);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
      setFlattenedTree(newFlattenedTree);

      socket?.emit(
        "file:create",
        { path: pathToAdd },
        (error: Error | null, data: { success: boolean; path: string }) => {
          if (error) {
            // Revert the changes
            const pathToDelete = `${parentNode.path}/${fileName}`;
            parentNode.children = parentNode.children.filter(
              (node) => node.path !== pathToDelete,
            );
            // const fileTreeCopy = structuredClone(fileTree);
            const fileTreeCopy = [...fileTree];
            setFileTree(fileTreeCopy);
            setFilesContent((prev) => {
              const newFilesContent = { ...prev };
              delete newFilesContent[pathToDelete];
              return newFilesContent;
            });
            const { flattenedTree, expandedChildrenLength, expandedNodes } =
              startPath
                ? flattenTree(fileTree, nodeExpandedState, startPath, true)
                : flattenTree(fileTree, nodeExpandedState);
            expandedChildrenLengthRef.current = expandedChildrenLength;
            expandedNodesRef.current = expandedNodes;
            setFlattenedTree(flattenedTree);
            console.error("Error adding file", error);
            // ToDo -> Display a toast message
          }
        },
      );
    },
    [fileTree, nodeExpandedState, startPath],
  );

  const handleAddFolder = useCallback(
    (pni: number, depth: number, folderName: string) => {
      if (!fileTree || !flattenedTree) {
        return;
      }

      const isNameValid = checkIfNameIsValid(folderName);
      if (!isNameValid) {
        throw new Error(
          `The name ${folderName} is not valid. Please choose a different name.`,
        );
      }

      const isNameUnique = checkIfNameIsUnique(pni, depth, folderName);
      if (!isNameUnique) {
        throw new Error(
          `A file or folder ${folderName} already exists at this location. Please choose a different name.`,
        );
      }
      deleteNamesSet(pni);

      const fileTreeCopy = [...fileTree];
      const parentNode = findNode(fileTreeCopy, flattenedTree[pni].path);
      if (!parentNode || parentNode.type === "file") return;
      const pathToAdd = `${parentNode.path}/${folderName}`;
      parentNode.children.push({
        type: "folder",
        name: folderName,
        path: pathToAdd,
        children: [],
        depth: parentNode.depth + 1,
      });
      // Also sort the children array
      sortNodeChildren(parentNode);
      setFileTree(fileTreeCopy);
      const {
        flattenedTree: newFlattenedTree,
        expandedChildrenLength,
        expandedNodes,
      } = startPath
        ? flattenTree(fileTree, nodeExpandedState, startPath, true)
        : flattenTree(fileTree, nodeExpandedState);
      expandedChildrenLengthRef.current = expandedChildrenLength;
      expandedNodesRef.current = expandedNodes;
      setFlattenedTree(newFlattenedTree);

      socket?.emit(
        "folder:create",
        { path: pathToAdd },
        (error: Error | null, data: { success: boolean; path: string }) => {
          if (error) {
            // Revert the changes
            const pathToDelete = pathToAdd;
            parentNode.children = parentNode.children.filter(
              (node) => node.path !== pathToDelete,
            );
            // const fileTreeCopy = structuredClone(fileTree);
            const fileTreeCopy = [...fileTree];
            setFileTree(fileTreeCopy);
            const {
              flattenedTree: newFlattenedTree,
              expandedChildrenLength,
              expandedNodes,
            } = startPath
              ? flattenTree(fileTree, nodeExpandedState, startPath, true)
              : flattenTree(fileTree, nodeExpandedState);
            expandedChildrenLengthRef.current = expandedChildrenLength;
            expandedNodesRef.current = expandedNodes;
            setFlattenedTree(newFlattenedTree);
            console.error("Error adding folder", error);
            // ToDo -> Display a toast message
          }
        },
      );
    },
    [fileTree, nodeExpandedState, flattenedTree, socket, startPath],
  );

  const handleMoveNodes = useCallback(
    (sourcePath: string, destPath: string) => {
      try {
        const newFileStructure = moveNodes(sourcePath, destPath);
        if (!newFileStructure) return;
        setFileTree(newFileStructure);
        const {
          flattenedTree: newFlattenedTree,
          expandedChildrenLength,
          expandedNodes,
        } = startPath
          ? flattenTree(newFileStructure, nodeExpandedState, startPath, true)
          : flattenTree(newFileStructure, nodeExpandedState);
        expandedChildrenLengthRef.current = expandedChildrenLength;
        expandedNodesRef.current = expandedNodes;
        setFlattenedTree(newFlattenedTree);
      } catch (error) {
        throw error;
      }
      const sourceFileName = sourcePath.split("/").pop();
      socket?.emit(
        "file:move",
        { sourcePath, destPath },
        (
          error: Error | null,
          data: { success: boolean; sourcePath: string; destPath: string },
        ) => {
          if (error) {
            console.error("Error moving files");
            const newFileStructure = moveNodes(
              destPath + "/" + sourceFileName,
              sourcePath.split("/").slice(0, -1).join("/"),
            );
            if (!newFileStructure) return;
            setFileTree(newFileStructure);
            const {
              flattenedTree: newFlattenedTree,
              expandedChildrenLength,
              expandedNodes,
            } = startPath
              ? flattenTree(
                  newFileStructure,
                  nodeExpandedState,
                  startPath,
                  true,
                )
              : flattenTree(newFileStructure, nodeExpandedState);
            expandedChildrenLengthRef.current = expandedChildrenLength;
            expandedNodesRef.current = expandedNodes;
            setFlattenedTree(newFlattenedTree);
          }
        },
      );
    },
    [nodeExpandedState],
  );

  const getButtonHeight = useCallback((path: string, childCount: number) => {
    let totalChildrenToCover = 0;
    expandedChildrenLengthRef.current.forEach((node) => {
      if (node.path.startsWith(path) && node.path !== path) {
        totalChildrenToCover += node.length;
      }
    });
    // need to change based on screen size
    return (totalChildrenToCover + childCount) * itemSize;
  }, []);

  const handleRightClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // e.stopPropagation();
    // console.log(e.target.closest());
    // console.log(e.currentTarget);
  };

  const getFolderPath = useCallback((filePath: string) => {
    const lastSlashIndex = filePath.lastIndexOf("/");
    return lastSlashIndex === -1 ? filePath : filePath.slice(0, lastSlashIndex);
  }, []);

  if (!fileTree || !flattenedTree) {
    return null;
  }
  return (
    <ScrollArea
      className="w-full h-full overflow-auto bg-[#171D2D] root-scroll"
      ref={scrollRef}
    >
      <div
        className={`w-full cursor-pointer tree-container bg-[#171D2D] relative`}
        onContextMenu={handleRightClick}
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow, i) => {
          if (i === 0) visibleNodesRef.current.clear();
          const node = flattenedTree[virtualRow.index];

          const isInOverscan =
            virtualRow.start < scrollRef.current!.scrollTop ||
            virtualRow.end >
              scrollRef.current!.scrollTop + scrollRef.current!.clientHeight;
          if (!isInOverscan) {
            visibleNodesRef.current.add(node.path);
          }

          if (node.type === "folder") {
            const { depth, isExpanded, path } = node;
            const start = virtualRow.start;

            if (isExpanded) {
              expandedNodesRef.current[path].start = start;
            }

            return (
              <TreeFolder
                node={node}
                padLeft={(depth - depthToSubtractRef.current) * padLeft}
                key={virtualRow.index}
                height={virtualRow.size}
                start={virtualRow.start}
                handleRename={handleRename}
                handleDelete={handleDelete}
                handleMoveNodes={handleMoveNodes}
                checkIfNameIsUnique={checkIfNameIsUnique}
                expandNode={expandNode}
                deleteNamesSet={deleteNamesSet}
                closeNode={closeNode}
                getChildren={getChildren}
                insertInputNode={insertInputNode}
                isNodeModulesChildrenReceived={isNodeModulesChildrenReceived}
                showEditOptions={startPath ? false : true}
                scrollRef={scrollRef}
              />
            );
          } else if (node.type === "file") {
            return (
              <TreeFile
                node={node}
                padLeft={(node.depth - depthToSubtractRef.current) * padLeft}
                key={virtualRow.index}
                height={virtualRow.size}
                start={virtualRow.start}
                handleRename={handleRename}
                handleDelete={handleDelete}
                handleMoveNodes={handleMoveNodes}
                deleteNamesSet={deleteNamesSet}
                checkIfNameIsUnique={checkIfNameIsUnique}
                showEditOptions={startPath ? false : true}
                scrollRef={scrollRef}
              />
            );
          } else if (node.type === "input") {
            return (
              <TreeInput
                node={node}
                key={virtualRow.index}
                height={virtualRow.size}
                start={virtualRow.start}
                padLeft={node.depth * padLeft}
                checkIfNameIsUnique={checkIfNameIsUnique}
                handleAddFile={handleAddFile}
                handleAddFolder={handleAddFolder}
                removeInputNode={removeInputNode}
                deleteNamesSet={deleteNamesSet}
                scrollRef={scrollRef}
              />
            );
          } else {
            return null;
          }
        })}
        {Object.keys(expandedNodesRef.current).map((path) => {
          const { start, depth, childCount } = expandedNodesRef.current[path];

          if (
            start === 0 &&
            currSelectedFilePath &&
            path === getFolderPath(currSelectedFilePath) &&
            flattenedTree[0].path !== path
          ) {
            return null;
          }
          const padding = (depth - depthToSubtractRef.current) * padLeft;
          const buttonHeight = getButtonHeight(path, childCount);
          return (
            <button
              className={`absolute top-0 left-0 w-[3px] group ${path}`}
              key={path}
              style={{
                height: `${buttonHeight}px`,
                transform: `translate(${padding + 5}px, ${start + itemSize}px)`,
              }}
              onClick={() => closeNode(path)}
            >
              <div className="w-[1px] h-full group-hover:bg-[#0079f2] bg-[#9da2a6]"></div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
};

const memoizedFileTree = React.memo(FileTree);
memoizedFileTree.displayName = "FileTree";
export default memoizedFileTree;
