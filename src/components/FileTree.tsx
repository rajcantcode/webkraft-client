import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  editorSupportedLanguages,
  FileContentObj,
  TreeFileNode,
  TreeFolderNode,
  FlattenedTreeFileNode,
  FlattenedTree,
  InputNode,
  FileContent,
  tempInputInfo,
  tempNodeStore,
  tempOverwriteNodeStore,
  tempFileContentStore,
} from "../constants.js";
import TreeFolder from "./TreeFolder.js";
import TreeFile from "./TreeFile.js";
import LoadingNode from "./LoadingNode.js";
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
import { cn } from "../lib/utils.js";
import { LoadingNode as LoadingNodeType } from "../constants.js";
import debounce from "lodash.debounce";
import { DeleteInfo, ModalInfo, OverwriteInfo } from "../types/modal.js";
import ConfirmationModal from "./ConfirmationModal.js";
import { RiDeleteBin6Line, RiFileCopyLine } from "react-icons/ri";
import { FaArrowsRotate } from "react-icons/fa6";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/ContextMenu.js";
import {
  AiOutlineDelete,
  AiOutlineEdit,
  AiOutlineFileAdd,
  AiOutlineFolderAdd,
} from "react-icons/ai";
import { FiClipboard } from "react-icons/fi";
import { FaFileDownload } from "react-icons/fa";
import { BsTerminal } from "react-icons/bs";

type ExpandedChildrenLength = { path: string; length: number };
type DepthAndStartInfo = {
  depth: number;
  childCount: number;
  index: number; // Index of the node in the flattened tree (used to calculate the start(y) position)
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
  expandedNodes: ExpandedNode = {}
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
        childCount: node.children.length,
        index: currentIndex,
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
        expandedNodes
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

const FileTree = React.memo(
  ({
    padLeft,
    fileFetchStatus,
    socket,
    scrollRef,
    // path from which to start the flattened tree, is only passed when used in breadcrumbs
    startPath = "",
    startPathChildCount = 0,
    workspaceRef,
  }: {
    padLeft: number;
    fileFetchStatus: { [key: string]: boolean };
    socket: Socket | null;
    scrollRef: React.RefObject<HTMLDivElement>;
    startPath?: string;
    startPathChildCount?: number;
    workspaceRef: React.RefObject<HTMLDivElement> | null;
  }) => {
    const fileTree = useWorkspaceStore((state) => state.fileStructure);
    const setFileTree = useWorkspaceStore((state) => state.setFileStructure);
    const setFilesContent = useWorkspaceStore((state) => state.setFilesContent);
    const selectedFilePath = useWorkspaceStore(
      (state) => state.selectedFilePath
    );
    const activeEditorId = useWorkspaceStore((state) => state.activeEditorId);
    const setOpenPathAtTerminal = useWorkspaceStore(
      (state) => state.setOpenPathAtTerminal
    );
    const [currSelectedFilePath, setCurrSelectedFilePath] = useState<string>(
      selectedFilePath[activeEditorId]
    );
    const isNodeModulesChildrenReceived = useRef<{ [path: string]: boolean }>(
      {}
    );
    const [nodeExpandedState, setNodeExpandedState] =
      useState<NodeExpandedState>(() =>
        startPath ? {} : fileTree ? { [fileTree[0].path]: true } : {}
      );

    const expandedChildrenLengthRef = useRef<ExpandedChildrenLength[]>([]);
    // Used when filetree is used in breadcrumbs
    const depthToSubtractRef = useRef<number>(0);
    const expandedNodesRef = useRef<ExpandedNode>({});
    const modalRef = useRef<HTMLDialogElement>(null);
    const dragTimerRef = useRef<{
      [path: string]: {
        dragCounter: number;
        set: boolean;
        id: NodeJS.Timeout | null;
      };
    }>({});

    const [flattenedTree, setFlattenedTree] = useState(() => {
      if (fileTree) {
        const { flattenedTree, expandedChildrenLength, expandedNodes } =
          startPath
            ? flattenTree(
                fileTree,
                nodeExpandedState,
                startPath,
                true,
                depthToSubtractRef
              )
            : flattenTree(fileTree, nodeExpandedState);
        expandedChildrenLengthRef.current = expandedChildrenLength;
        expandedNodesRef.current = expandedNodes;
        return flattenedTree;
      } else {
        return null;
      }
    });
    // const scrollRef = useRef<HTMLDivElement>(null);
    const pathToFirstLevelChildrenNames = useRef<{
      [path: string]: Set<string>;
    }>({});
    const visibleNodesRef = useRef<Set<string>>(new Set<string>());
    const dragContainerRef = useRef<HTMLDivElement>(null);
    const [contextInfo, setContextInfo] = useState<HTMLDivElement | null>(null);
    const [pathToScroll, setPathToScroll] = useState<string | null>(null);

    useEffect(() => {
      setCurrSelectedFilePath(selectedFilePath[activeEditorId]);
    }, [selectedFilePath, activeEditorId, setCurrSelectedFilePath]);

    const virtualizer = useVirtualizer({
      count: flattenedTree ? flattenedTree.length : 0,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => itemSize,
      overscan: 20,
      paddingStart: startPath ? 0 : 6,
      paddingEnd: startPath ? 0 : 6,
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
      [flattenedTree, virtualizer]
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
      const handleFileAdd = (data: { path: string; content: string }) => {
        if (!fileTree) {
          return;
        }
        const { path, content } = data;
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
        const { flattenedTree, expandedChildrenLength, expandedNodes } =
          startPath
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
              content,
              language: fileExtension
                ? editorSupportedLanguages[fileExtension] || "text"
                : "text",
            },
          }));
        }
      };

      const handleFileChange = (data: { path: string; content: string }) => {
        const { path, content } = data;
        const fileExtension = path.split(".").pop();
        setFilesContent((prev) => ({
          ...prev,
          [path]: prev[path]
            ? { ...prev[path], content }
            : {
                name: path.slice(path.lastIndexOf("/") + 1),
                content: content,
                language: fileExtension
                  ? editorSupportedLanguages[fileExtension] || "text"
                  : "text",
              },
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
          (node) => node.path !== path
        );
        setFileTree(fileTreeCopy);
        const { flattenedTree, expandedChildrenLength, expandedNodes } =
          startPath
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
        const { flattenedTree, expandedChildrenLength, expandedNodes } =
          startPath
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
          (node) => node.path === path
        );
        parentNode.children = parentNode.children.filter(
          (node) => node.path !== path
        );
        setFileTree(fileTreeCopy);
        const { flattenedTree, expandedChildrenLength, expandedNodes } =
          startPath
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
          null
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
        const { flattenedTree, expandedChildrenLength, expandedNodes } =
          startPath
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
                  1
                );
                lastSelectedFilePathsCopy = lastSelectedFilePathsCopy.filter(
                  (path) => path !== node.path
                );
              }
            });
          }
        });
        Object.keys(parentNodes).forEach((path) => {
          sortNodeChildren(parentNodes[path]);
        });
        setFileTree(fileTreeCopy);
        const { flattenedTree, expandedChildrenLength, expandedNodes } =
          startPath
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

      const handleFileChunk = (data: {
        filepath: string;
        chunk: string;
        end: boolean;
      }) => {
        if (data.end && tempFileContentStore[data.filepath]) {
          const { setFilesContent, filesContent: currentFilesContent } =
            useWorkspaceStore.getState();
          const fileExtension = data.filepath.split(".").pop();
          setFilesContent({
            ...currentFilesContent,
            [data.filepath]: {
              name: data.filepath.slice(data.filepath.lastIndexOf("/") + 1),
              content: tempFileContentStore[data.filepath],
              language: fileExtension
                ? editorSupportedLanguages[fileExtension] || "text"
                : "text",
            },
          });
          delete tempFileContentStore[data.filepath];
          fileFetchStatus[data.filepath] = false;
        } else {
          if (tempFileContentStore[data.filepath]) {
            tempFileContentStore[data.filepath] += data.chunk;
          } else {
            tempFileContentStore[data.filepath] = data.chunk;
          }
        }
      };

      socket.on("file:add", handleFileAdd);
      socket.on("file:change", handleFileChange);
      socket.on("file:unlink", handleFileUnlink);
      socket.on("file:chunk", handleFileChunk);
      socket.on("folder:add", handleFolderAdd);
      socket.on("folder:unlink", handleFolderUnlink);
      socket.on("folder:add:bulk", handleAddFolderBulk);
      socket.on("folder:del:bulk", handleDelFolderBulk);
      return () => {
        socket.off("file:add", handleFileAdd);
        socket.off("file:change", handleFileChange);
        socket.off("file:unlink", handleFileUnlink);
        socket.off("file:chunk", handleFileChunk);
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
      fileFetchStatus,
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
              currNode.type !== "loading" &&
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
        const lowerCaseNewName = newName.toLowerCase();
        const nameSet = pathToFirstLevelChildrenNames.current[pathToCheck];
        if (nameSet.has(lowerCaseNewName)) {
          return false;
        }
        return true;
      },
      [flattenedTree, startPath]
    );

    const deleteNamesSet = useCallback(
      (parentIndex: number) => {
        if (!flattenedTree) return;
        delete pathToFirstLevelChildrenNames.current[
          flattenedTree[parentIndex].path
        ];
      },
      [flattenedTree]
    );

    const insertInputNode = useCallback(
      (
        index: number,
        operation: "add-file" | "add-folder",
        depth: number,
        flatTree = flattenedTree,
        value?: string,
        error?: string
      ) => {
        if (!flatTree) return;
        const inpNodePath = `${flatTree[index].path}/input`;
        const inputNode: InputNode = {
          type: "input",
          operation,
          pni: index,
          value: value || "",
          depth: depth + 1,
          error: error || "",
          path: inpNodePath,
        };
        expandedNodesRef.current[flatTree[index].path].childCount++;
        const temp = expandedChildrenLengthRef.current.find(
          (node) => node.path === flatTree[index].path
        );
        if (temp) temp.length++;
        if (!tempInputInfo[inpNodePath]) {
          tempInputInfo[inpNodePath] = {
            operation,
            value: "",
            error: "",
          };
        }
        const flattenedTreeCopy = [...flatTree];
        flattenedTreeCopy.splice(index + 1, 0, inputNode);
        for (let i = index + 2; i < flattenedTreeCopy.length; i++) {
          const path = flattenedTreeCopy[i].path;
          if (expandedNodesRef.current[path]) {
            expandedNodesRef.current[path].index++;
          }
        }
        setFlattenedTree(flattenedTreeCopy);
      },
      [flattenedTree, setFlattenedTree]
    );

    const removeInputNode = useCallback(
      (pni: number) => {
        if (!flattenedTree) return;
        // remove element at index pni + 1, from flattenedTree
        expandedNodesRef.current[flattenedTree[pni].path].childCount--;
        const temp = expandedChildrenLengthRef.current.find(
          (node) => node.path === flattenedTree[pni].path
        );
        if (temp) temp.length--;
        const flattenedTreeCopy = [...flattenedTree];
        flattenedTreeCopy.splice(pni + 1, 1);
        for (let i = pni + 1; i < flattenedTreeCopy.length; i++) {
          const path = flattenedTreeCopy[i].path;
          if (expandedNodesRef.current[path]) {
            expandedNodesRef.current[path].index--;
          }
        }
        setFlattenedTree(flattenedTreeCopy);
      },
      [flattenedTree, setFlattenedTree]
    );

    const expandNode = useCallback(
      (...paths: (string | string[])[]) => {
        if (!fileTree) return;

        const fileTreeCopy = [...fileTree];
        const inputPaths = paths.flat();
        for (const path of inputPaths) {
          const node = findNode(fileTreeCopy, path);
          if (!node || node.type === "file") return;
          if (node.children.length > 0) {
            // Load content of files
            try {
              if (node.path.includes("node_modules")) {
                loadFilesOfNodeModulesFolder(node, fileFetchStatus, socket);
              } else {
                loadFilesOfFolder(node, fileFetchStatus);
              }
            } catch (error) {
              console.error(
                `Error fetching files of folder ${node.path}`,
                error
              );
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
        console.log("setted expanded state");
        setNodeExpandedState(newNodeExpandedState);
        // Useful when user clicks on add-file or add-folder button, when the node is closed, so we get the latest flattenedTree, and can insert the input node at the desired location
        return flattenedTree;
      },
      [
        setFlattenedTree,
        setFileTree,
        fileTree,
        nodeExpandedState,
        socket,
        fileFetchStatus,
        startPath,
      ]
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
      [fileTree, setFileTree, setFlattenedTree, nodeExpandedState, startPath]
    );

    const handleRename = useCallback(
      (
        pni: number,
        depth: number,
        path: string,
        newName: string,
        type: "file" | "folder"
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
            { cause: "invalid-name" }
          );
        }
        const isNameUnique = checkIfNameIsUnique(pni, depth, newName);
        if (!isNameUnique) {
          deleteNamesSet(pni);
          throw new Error(
            `A file or folder ${newName} already exists at this location. Please choose a different name.`,
            { cause: "duplicate-name" }
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

          updateFilePathsInFileTabBar(
            { oldPath, newPath: node.path },
            undefined
          );
        }
        if (node.type === "folder") {
          const renamedPaths: RenamePathObj[] = [];
          const { filesContent } = useWorkspaceStore.getState();
          updatePath(node, node.path, renamedPaths, filesContent, node.depth);
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
            data: { success: boolean; oldPath: string; newPath: string }
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
                updatePath(
                  node,
                  node.path,
                  renamedPaths,
                  filesContent,
                  node.depth
                );
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
          }
        );
      },
      [
        fileTree,
        flattenedTree,
        deleteNamesSet,
        nodeExpandedState,
        setFileTree,
        setFilesContent,
        socket,
        startPath,
        checkIfNameIsUnique,
      ]
    );

    const insertLoadingNode = useCallback(
      (
        nodeIndex: number,
        flatTree: FlattenedTree,
        inputOp?: "add-file" | "add-folder"
      ) => {
        // Insert 3 loading nodes after the nodeIndex

        const node = flatTree[nodeIndex];
        if (node.type !== "folder") return;
        const inpNodePath = `${node.path}/input`;
        const loadingNodes: Array<LoadingNodeType | InputNode> = inputOp
          ? [
              {
                type: "input",
                operation: inputOp,
                pni: nodeIndex,
                value: "",
                depth: node.depth + 1,
                error: "",
                path: inpNodePath,
              },
              {
                type: "loading",
                depth: node.depth + 1,
                pni: nodeIndex,
                path: `${node.path}/loading1`,
              },
              {
                type: "loading",
                depth: node.depth + 1,
                pni: nodeIndex,
                path: `${node.path}/loading2`,
              },
              {
                type: "loading",
                depth: node.depth + 1,
                pni: nodeIndex,
                path: `${node.path}/loading3`,
              },
            ]
          : [
              {
                type: "loading",
                depth: node.depth + 1,
                pni: nodeIndex,
                path: `${node.path}/loading1`,
              },
              {
                type: "loading",
                depth: node.depth + 1,
                pni: nodeIndex,
                path: `${node.path}/loading2`,
              },
              {
                type: "loading",
                depth: node.depth + 1,
                pni: nodeIndex,
                path: `${node.path}/loading3`,
              },
            ];
        node.isExpanded = true;
        const flattenedTreeCopy = [...flatTree];
        flattenedTreeCopy.splice(nodeIndex + 1, 0, ...loadingNodes);

        if (inputOp && !tempInputInfo[inpNodePath]) {
          tempInputInfo[inpNodePath] = {
            operation: inputOp,
            value: "",
            error: "",
          };
        }

        // Adjust pni and index of nodes after the loading nodes
        const travStart = inputOp ? nodeIndex + 5 : nodeIndex + 4;
        const incr = inputOp ? 4 : 3;
        for (let i = travStart; i < flattenedTreeCopy.length; i++) {
          const node = flattenedTreeCopy[i];
          if (node.type === "folder") {
            // If the pni is greater than nodeIndex, then only increment it by 3
            if (node.pni > nodeIndex) {
              node.pni += incr;
            }
            node.index += incr;
          }
          if (node.type === "file") {
            // If the pni is greater than nodeIndex, then only increment it by 3
            if (node.pni > nodeIndex) {
              node.pni += incr;
            }
          }
        }

        setFlattenedTree(flattenedTreeCopy);
      },
      []
    );

    const getChildren = useCallback(
      (
        path: string,
        depth: number,
        nodeIndex: number,
        inputOp?: "add-file" | "add-folder"
      ) => {
        if (!flattenedTree || !fileTree) {
          return;
        }
        if (isNodeModulesChildrenReceived.current[path]) {
          expandNode(path);
          return;
        }

        // Insert 3 loading nodes after the nodeIndex
        insertLoadingNode(nodeIndex, flattenedTree, inputOp);
        // Expand the node
        // NEC = Node ExpandedState Copy
        const NEC = { ...nodeExpandedState };
        const nodePath = flattenedTree[nodeIndex].path;
        NEC[nodePath] = true;
        setNodeExpandedState(NEC);
        if (expandedNodesRef.current[nodePath]) {
          expandedNodesRef.current[nodePath].childCount += inputOp ? 4 : 3;
        } else {
          expandedNodesRef.current[nodePath] = {
            childCount: inputOp ? 4 : 3,
            depth: flattenedTree[nodeIndex].depth,
            index: nodeIndex,
          };
        }

        const temp = expandedChildrenLengthRef.current.find(
          (node) => node.path === nodePath
        );
        if (temp) temp.length += inputOp ? 4 : 3;
        if (!temp) {
          expandedChildrenLengthRef.current.push({
            path: nodePath,
            length: inputOp ? 4 : 3,
          });
        }

        socket?.emit(
          "get:children",
          { path, depth: ++depth },
          (error: Error | null, data: Array<TreeFileNode | TreeFolderNode>) => {
            if (error) {
              isNodeModulesChildrenReceived.current[path] = false;

              const fileTreeCopy = [...fileTree];
              const nodeExpandedStateCopy = { ...nodeExpandedState };
              nodeExpandedStateCopy[nodePath] = false;
              const {
                flattenedTree: newFlattenedTree,
                nodeExpandedState: newNodeExpandedState,
                expandedChildrenLength,
                expandedNodes,
              } = startPath
                ? flattenTree(
                    fileTreeCopy,
                    nodeExpandedStateCopy,
                    startPath,
                    true
                  )
                : flattenTree(fileTreeCopy, nodeExpandedStateCopy);
              expandedChildrenLengthRef.current = expandedChildrenLength;
              expandedNodesRef.current = expandedNodes;
              setFlattenedTree(newFlattenedTree);
              setNodeExpandedState(newNodeExpandedState);
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

            if (expandedNodesRef.current[nodePath]) {
              // Node should be expanded
              nodeExpandedStateCopy[nodePath] = true;
            } else {
              //Node should not be expanded
              nodeExpandedStateCopy[nodePath] = false;
            }

            loadFilesOfNodeModulesFolder(parentNode, fileFetchStatus, socket);
            setFileTree(fileTreeCopy);
            const {
              flattenedTree: newFlattenedTree,
              nodeExpandedState: newNodeExpandedState,
              expandedChildrenLength,
              expandedNodes,
            } = startPath
              ? flattenTree(
                  fileTreeCopy,
                  nodeExpandedStateCopy,
                  startPath,
                  true
                )
              : flattenTree(fileTreeCopy, nodeExpandedStateCopy);
            expandedChildrenLengthRef.current = expandedChildrenLength;
            expandedNodesRef.current = expandedNodes;

            // If there was an input node before, then we again insert it after the children are received
            const tempInpNode = tempInputInfo[`${nodePath}/input`];
            if (expandedNodesRef.current[nodePath] && inputOp && tempInpNode) {
              // insertInputNode will set the flattenedTree after inserting the input node
              insertInputNode(
                nodeIndex,
                inputOp,
                depth - 1, // decrementing one, because while sending the depth to the server, we incremented it by 1
                newFlattenedTree,
                tempInpNode.value,
                tempInpNode.error
              );
            } else {
              setFlattenedTree(newFlattenedTree);
            }
            setNodeExpandedState(newNodeExpandedState);
          }
        );
      },
      [
        socket,
        fileTree,
        nodeExpandedState,
        startPath,
        flattenedTree,
        expandNode,
        insertLoadingNode,
        fileFetchStatus,
        insertInputNode,
        setFileTree,
      ]
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
          (node) => node.path === path
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
          }
        );
      },
      [
        fileTree,
        nodeExpandedState,
        flattenedTree,
        setFileTree,
        startPath,
        setFilesContent,
        socket,
      ]
    );

    const handleAddFile = useCallback(
      (pni: number, depth: number, fileName: string, content?: string) => {
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
            {
              cause: "invalid-name",
            }
          );
        }
        if (!isNameUnique) {
          removeInputNode(pni);
          deleteNamesSet(pni);
          throw new Error(
            `A file or folder ${fileName} already exists at this location. Please choose a different name.`,
            {
              cause: "duplicate-name",
            }
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
            content: content || "",
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
                (node) => node.path !== pathToDelete
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
          }
        );
      },
      [
        fileTree,
        nodeExpandedState,
        startPath,
        setFilesContent,
        socket,
        checkIfNameIsUnique,
        deleteNamesSet,
        flattenedTree,
        removeInputNode,
        setFileTree,
      ]
    );

    const handleAddFolder = useCallback(
      (pni: number, depth: number, folderName: string) => {
        if (!fileTree || !flattenedTree) {
          return;
        }

        const isNameValid = checkIfNameIsValid(folderName);
        if (!isNameValid) {
          throw new Error(
            `The name ${folderName} is not valid. Please choose a different name.`
          );
        }

        const isNameUnique = checkIfNameIsUnique(pni, depth, folderName);
        if (!isNameUnique) {
          throw new Error(
            `A file or folder ${folderName} already exists at this location. Please choose a different name.`
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
                (node) => node.path !== pathToDelete
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
          }
        );
      },
      [
        fileTree,
        nodeExpandedState,
        flattenedTree,
        socket,
        startPath,
        checkIfNameIsUnique,
        deleteNamesSet,
        setFileTree,
      ]
    );

    const handleMoveNodes = useCallback(
      (sourcePath: string, destPath: string, overwrite = false) => {
        if (!socket) {
          console.log("Socket not connected");
          return;
        }

        const newFileStructure = moveNodes(sourcePath, destPath, overwrite);
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

        const sourceFileName = sourcePath.split("/").pop();
        const sourceParentPath = sourcePath.split("/").slice(0, -1).join("/");
        socket.emit(
          "file:move",
          { sourcePath, destPath },
          (
            error: Error | null,
            data: { success: boolean; sourcePath: string; destPath: string }
          ) => {
            if (error) {
              console.error("Error moving files");
              console.error(error);
              const newFileStructure = moveNodes(
                destPath + "/" + sourceFileName,
                sourceParentPath,
                overwrite,
                true
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
                    true
                  )
                : flattenTree(newFileStructure, nodeExpandedState);
              expandedChildrenLengthRef.current = expandedChildrenLength;
              expandedNodesRef.current = expandedNodes;
              setFlattenedTree(newFlattenedTree);
            }
            delete tempNodeStore[destPath];
            delete tempNodeStore[sourceParentPath];
            delete tempOverwriteNodeStore[destPath];
          }
        );
      },
      [nodeExpandedState, setFileTree, socket, startPath]
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
      const el = (e.target as HTMLDivElement).closest(
        ".tree-node"
      ) as HTMLDivElement;
      if (!el) {
        setContextInfo(null);
        return;
      }
      setContextInfo(el);
    };

    const getFolderPath = useCallback((filePath: string) => {
      const lastSlashIndex = filePath.lastIndexOf("/");
      return lastSlashIndex === -1
        ? filePath
        : filePath.slice(0, lastSlashIndex);
    }, []);

    const startScroll = React.useCallback(
      (direction: "up" | "down") => {
        if (!scrollRef.current) return null;
        console.log("🚨 setting scroll interval");
        return setInterval(() => {
          if (!scrollRef.current) return;

          scrollRef.current.scrollBy({
            top: direction === "up" ? -10 : 10,
            behavior: "auto",
          });
        }, 16);
      },
      [scrollRef]
    );
    const stopScroll = useCallback(() => {
      if (scrollTimeoutId.current) {
        console.log(`🧹 clearing interval of id - ${scrollTimeoutId.current}`);
        clearInterval(scrollTimeoutId.current);
        scrollTimeoutId.current = null;
      }
    }, []);
    const handleDragEnter = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const folderElem = (e.target as HTMLElement).closest(
          ".tree-node"
        ) as HTMLElement;
        if (!folderElem) return;
        const { path, depth, index, type } = folderElem.dataset;

        if (type === "file") return;
        if (!path || !depth || !index || !type) return;

        if (dragTimerRef.current[path]) {
          dragTimerRef.current[path].dragCounter += 1;
        } else {
          dragTimerRef.current[path] = {
            dragCounter: 1,
            set: false,
            id: null,
          };
        }

        if (dragTimerRef.current[path].dragCounter === 1) {
          if (!nodeExpandedState[path] && !dragTimerRef.current[path].set) {
            dragTimerRef.current[path].set = true;
            dragTimerRef.current[path].id = setTimeout(() => {
              if (!nodeExpandedState[path]) {
                if (
                  path.includes("node_modules") &&
                  !isNodeModulesChildrenReceived.current[path]
                ) {
                  getChildren(path, Number(depth), Number(index));
                } else {
                  expandNode(path);
                }
              }
            }, 400);
          }
        }
      },
      [expandNode, getChildren, nodeExpandedState]
    );
    const handleDragLeave = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if ((e.target as HTMLDivElement).classList.contains("tree-container")) {
          stopScroll();
          if (dragContainerRef.current) {
            dragContainerRef.current.style.display = "none";
          }
        }
        const folderElem = (e.target as HTMLElement).closest(
          ".tree-node"
        ) as HTMLElement;
        if (!folderElem) return;
        const { path, type } = folderElem.dataset;

        if (!path || !type || type === "file" || !dragTimerRef.current[path])
          return;

        dragTimerRef.current[path].dragCounter -= 1;
        if (dragTimerRef.current[path].dragCounter === 0) {
          if (dragTimerRef.current[path].set && dragTimerRef.current[path].id) {
            clearTimeout(dragTimerRef.current[path].id);
            dragTimerRef.current[path].set = false;
            dragTimerRef.current[path].id = null;
          }
        }
      },
      [stopScroll]
    );

    const scrollTimeoutId = useRef<NodeJS.Timeout | null>(null);

    const treeRef = useRef<HTMLDivElement | null>(null);
    const curDraggedOverPath = useRef<{
      path: string | null;
      basePath: string | null;
    }>({ path: null, basePath: null });
    const stopScrollDebounce = useMemo(
      () =>
        debounce(() => {
          if (dragContainerRef.current) {
            dragContainerRef.current.style.display = "none";
          }
          console.log("scroll stopped from debounce");
          stopScroll();
        }, 500),
      [stopScroll]
    );
    const handleDragOver = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (!treeRef.current || !scrollRef.current) return;

        const el = (e.target as HTMLDivElement).classList.contains("tree-node")
          ? (e.target as HTMLDivElement)
          : ((e.target as HTMLElement).closest(".tree-node") as HTMLDivElement);

        // debugger;
        if (el) {
          if (
            !dragContainerRef.current ||
            !curDraggedOverPath.current.basePath ||
            !curDraggedOverPath.current.path
          )
            return;
          const { path, depth, index, type, pni } = el.dataset;
          if (type === "folder" && (!path || !depth || !index)) return;
          if (type === "file" && (!path || !depth || !pni)) return;

          stopScrollDebounce();
          const containerPath =
            type === "file" ? path!.split("/").slice(0, -1).join("/") : path!;
          const containerDepth =
            type === "file" ? Number(depth) - 1 : Number(depth);
          let offSetIndex = type === "file" ? Number(pni) : Number(index);
          if (offSetIndex === -1 && startPath && startPath === containerPath) {
            offSetIndex = 0;
          }

          const transformY = startPath
            ? startPath === containerPath
              ? 1
              : offSetIndex * itemSize
            : offSetIndex * itemSize + 6;
          const childCount =
            startPath && startPath === containerPath
              ? startPathChildCount
              : expandedNodesRef.current[containerPath]?.childCount;
          const containerHeight =
            startPath && startPath === containerPath
              ? getButtonHeight(containerPath, childCount ? childCount : 0) - 2
              : getButtonHeight(containerPath, childCount ? childCount : 0) +
                itemSize;
          const containerPadLeft =
            startPath && startPath === containerPath
              ? padLeft
              : (containerDepth - depthToSubtractRef.current) * padLeft;

          dragContainerRef.current.style.transform = `translateY(${transformY}px)`;
          dragContainerRef.current.style.height = `${containerHeight}px`;
          dragContainerRef.current.style.width =
            startPath && startPath === containerPath
              ? `calc(100% - ${containerPadLeft}px)`
              : `calc(100% - ${containerPadLeft + 5}px)`;

          dragContainerRef.current.style.marginLeft =
            startPath && startPath === containerPath
              ? `4px`
              : containerPadLeft === 0
              ? `2px`
              : `${containerPadLeft}px`;
          // dragContainerRef.current.style.marginLeft = `${containerPadLeft}px`;
          dragContainerRef.current.style.outlineColor =
            curDraggedOverPath.current.path === containerPath ||
            curDraggedOverPath.current.basePath === containerPath
              ? "#E52222"
              : "#0079f2";

          dragContainerRef.current.style.display = "block";
        }
        // Current Mouse position relative to the target
        const y = e.clientY - e.currentTarget.getBoundingClientRect().top;

        // Check if being dragged over top bound
        if (y < scrollRef.current.scrollTop + 50) {
          if (scrollTimeoutId.current) return;
          scrollTimeoutId.current = startScroll("up");
          return;
        }

        // Check if being dragged over bottom bound or in center
        if (scrollRef.current.clientHeight > treeRef.current.clientHeight) {
          if (
            y >
            scrollRef.current.scrollTop + treeRef.current.clientHeight - 50
          ) {
            if (scrollTimeoutId.current) return;
            scrollTimeoutId.current = startScroll("down");
          } else {
            if (scrollTimeoutId.current) {
              stopScroll();
            }
          }
          return;
        } else {
          if (
            y >
            scrollRef.current.scrollTop + scrollRef.current.clientHeight - 50
          ) {
            if (scrollTimeoutId.current) return;
            scrollTimeoutId.current = startScroll("down");
          } else {
            if (scrollTimeoutId.current) {
              stopScroll();
            }
          }
          return;
        }
      },
      [
        startScroll,
        stopScroll,
        scrollRef,
        getButtonHeight,
        padLeft,
        stopScrollDebounce,
        startPath,
        startPathChildCount,
      ]
    );

    const showModal = useCallback((info: DeleteInfo | OverwriteInfo) => {
      const modalInfo: ModalInfo = { ...info, show: true };
      setModalInfo(modalInfo);
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        stopScroll();

        if (dragContainerRef.current) {
          dragContainerRef.current.style.display = "none";
        }
        const { path, type, pni, index, depth } = (
          (e.target as HTMLElement).closest(".tree-node") as HTMLElement
        ).dataset;
        if (!type || !path) return;
        if (type === "folder" && (!depth || !index)) return;
        if (type === "file" && (!depth || !pni)) return;
        if (type === "folder") {
          if (
            dragTimerRef.current[path] &&
            dragTimerRef.current[path].set &&
            dragTimerRef.current[path].id
          ) {
            clearTimeout(dragTimerRef.current[path].id);
            delete dragTimerRef.current[path];
          }
        }

        const draggedPath = e.dataTransfer.getData("text/plain");
        const splitDraggedPath = draggedPath.split("/");
        const name = splitDraggedPath.pop();
        if (!name) return;

        const destBasePath = type === "folder" ? path : getFolderPath(path);
        const destPath = `${destBasePath}/${name}`;
        if (draggedPath === destPath || draggedPath === destBasePath) {
          console.log("Cannot move the file/folder to the same location");
          return;
        }

        const isNameValid = checkIfNameIsValid(name);
        if (!isNameValid) {
          console.error("The name is not valid");
          return;
        }

        try {
          handleMoveNodes(draggedPath, destBasePath);
        } catch (error) {
          console.error(error);
          // The error will be always about a file/folder already existing. So only show modal
          showModal({
            opType: "overwrite",
            name,
            sourcePath: draggedPath,
            destBasePath,
          });
        }
      },
      [handleMoveNodes, stopScroll, getFolderPath, showModal]
    );

    const [modalInfo, setModalInfo] = useState<ModalInfo | null>(null);
    useEffect(() => {
      if (modalInfo?.show) {
        modalRef.current?.showModal();
      } else {
        modalRef.current?.close();
      }
    }, [modalInfo?.show]);
    useEffect(() => {
      if (!modalRef.current) return;
      const handleCloseModal = () => {
        console.log("closed modal");
        setModalInfo(null);
      };
      modalRef.current.addEventListener("close", handleCloseModal);
      return () => {
        // if (!modalRef.current) return;
        modalRef.current?.removeEventListener("close", handleCloseModal);
      };
    }, []);

    const downloadFile = useCallback(
      (
        filename: string,
        content: string,
        contentType: string = "text/plain"
      ) => {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      []
    );

    const handleDuplicateFile = useCallback(
      (tryCount: number) => {
        if (!contextInfo) return;
        const { path, pni, depth } = contextInfo.dataset;
        if (!path || !pni || !depth) return;
        const fileName = path.split("/").pop();
        if (!fileName) return;
        const filesContent = useWorkspaceStore.getState().filesContent;
        const dotIndex = fileName.lastIndexOf(".");
        let dupFileName: string;
        if (dotIndex === -1) {
          dupFileName =
            tryCount > 0
              ? `${fileName} (copy) ${tryCount}`
              : `${fileName} (copy)`;
        } else if (dotIndex === 0) {
          dupFileName =
            tryCount > 0
              ? fileName + ` (copy) ${tryCount}`
              : fileName + " (copy)";
        } else {
          dupFileName =
            tryCount > 0
              ? `${fileName.substring(
                  0,
                  dotIndex
                )} (copy)${tryCount}${fileName.substring(dotIndex)}`
              : `${fileName.substring(0, dotIndex)} (copy)${fileName.substring(
                  dotIndex
                )}`;
        }
        try {
          handleAddFile(
            Number(pni),
            Number(depth),
            dupFileName,
            filesContent[path].content
          );
        } catch (error) {
          if ((error as Error).cause === "duplicate-name") {
            handleDuplicateFile(tryCount + 1);
          }
        }
      },
      [contextInfo, handleAddFile]
    );

    const handleSelect = useCallback(
      async (e: Event) => {
        console.log((e.currentTarget as HTMLDivElement).dataset.action);
        const action = (e.currentTarget as HTMLDivElement).dataset.action;
        if (!action || !contextInfo) return;
        switch (action) {
          case "rename":
            setTimeout(() => {
              (
                contextInfo.querySelector(
                  '[data-action="rename"]'
                ) as HTMLDivElement
              ).click();
            }, 10);
            break;
          case "delete":
            setTimeout(() => {
              (
                contextInfo.querySelector(
                  '[data-action="delete"]'
                ) as HTMLDivElement
              )?.click();
            }, 10);
            break;
          case "duplicate":
            handleDuplicateFile(0);
            break;
          case "copy-path": {
            const path = contextInfo.dataset.path;
            if (!path) return;
            const slashInd = path.indexOf("/");
            if (slashInd === -1) return;
            await navigator.clipboard.writeText(path.slice(slashInd + 1));
            // ToDo -> Show a toast message
            break;
          }
          case "download": {
            const path = contextInfo.dataset.path;
            const filesContent = useWorkspaceStore.getState().filesContent;
            if (!path) return;
            downloadFile(path.split("/").pop()!, filesContent[path].content);
            break;
          }
          case "add-file":
            setTimeout(() => {
              (
                contextInfo.querySelector(
                  '[data-action="add-file"]'
                ) as HTMLDivElement
              )?.click();
            }, 10);
            break;
          case "add-folder":
            setTimeout(() => {
              (
                contextInfo.querySelector(
                  '[data-action="add-folder"]'
                ) as HTMLDivElement
              )?.click();
            }, 10);
            break;
          case "open-terminal": {
            const { path, type } = contextInfo.dataset;
            if (!path || !type || type === "file") return;
            // debugger;
            setOpenPathAtTerminal(path);
            break;
          }
          default:
            break;
        }
      },
      [contextInfo, downloadFile, handleDuplicateFile, setOpenPathAtTerminal]
    );

    if (!fileTree || !flattenedTree) {
      return null;
    }
    return (
      <ContextMenu>
        <ContextMenuTrigger disabled={startPath ? true : false}>
          <ContextMenuContent className=" bg-[#1B2333] border-[#4E5569] text-xs p-1 cursor-pointer">
            {contextInfo && contextInfo.dataset.type === "file" ? (
              <>
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="rename"
                >
                  <div className="flex items-center gap-2">
                    <AiOutlineEdit />
                    Rename
                  </div>
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#4E5569] bg-opacity-50 " />
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="delete"
                >
                  <div className="flex items-center gap-2">
                    <AiOutlineDelete />
                    Delete
                  </div>
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#4E5569] bg-opacity-50" />
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="duplicate"
                >
                  <div className="flex items-center gap-2">
                    <RiFileCopyLine />
                    Duplicate file
                  </div>
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#4E5569] bg-opacity-50" />
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="copy-path"
                >
                  <div className="flex items-center gap-2">
                    <FiClipboard />
                    Copy path
                  </div>
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#4E5569] bg-opacity-50" />
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="download"
                >
                  <div className="flex items-center gap-2">
                    <FaFileDownload />
                    Download
                  </div>
                </ContextMenuItem>
              </>
            ) : (
              <>
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="add-file"
                >
                  <div className="flex items-center gap-2">
                    <AiOutlineFileAdd />
                    Add file
                  </div>
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#4E5569] bg-opacity-50" />
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="add-folder"
                >
                  <div className="flex items-center gap-2">
                    <AiOutlineFolderAdd />
                    Add folder
                  </div>
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#4E5569] bg-opacity-50" />
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="rename"
                >
                  <div className="flex items-center gap-2">
                    <AiOutlineEdit />
                    Rename
                  </div>
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#4E5569] bg-opacity-50" />
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="delete"
                >
                  <div className="flex items-center gap-2">
                    <AiOutlineDelete />
                    Delete
                  </div>
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#4E5569] bg-opacity-50" />
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="open-terminal"
                >
                  <div className="flex items-center gap-2">
                    <BsTerminal />
                    Open terminal here
                  </div>
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#4E5569] bg-opacity-50" />
                <ContextMenuItem
                  className="text-xs font-semibold cursor-pointer hover:bg-[#2B3245]"
                  onSelect={handleSelect}
                  data-action="copy-path"
                >
                  <div className="flex items-center gap-2">
                    <FiClipboard />
                    Copy path
                  </div>
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
          <div
            className={`w-full cursor-pointer tree-container bg-[#171D2D] relative`}
            onContextMenu={handleRightClick}
            style={{ height: `${virtualizer.getTotalSize()}px` }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            ref={treeRef}
          >
            {virtualizer.getVirtualItems().map((virtualRow, i) => {
              if (i === 0) visibleNodesRef.current.clear();
              const node = flattenedTree[virtualRow.index];

              // scrollRef.current?.
              const isInOverscan =
                virtualRow.start < scrollRef.current!.scrollTop ||
                virtualRow.end >
                  scrollRef.current!.scrollTop +
                    scrollRef.current!.clientHeight;
              if (!isInOverscan) {
                visibleNodesRef.current.add(node.path);
              }

              if (node.type === "folder") {
                const { depth } = node;

                return (
                  <TreeFolder
                    node={node}
                    padLeft={(depth - depthToSubtractRef.current) * padLeft}
                    key={node.path}
                    height={virtualRow.size}
                    start={virtualRow.start}
                    handleRename={handleRename}
                    checkIfNameIsUnique={checkIfNameIsUnique}
                    expandNode={expandNode}
                    deleteNamesSet={deleteNamesSet}
                    closeNode={closeNode}
                    getChildren={getChildren}
                    insertInputNode={insertInputNode}
                    isNodeModulesChildrenReceived={
                      isNodeModulesChildrenReceived
                    }
                    showEditOptions={startPath ? false : true}
                    scrollRef={scrollRef}
                    workspaceRef={workspaceRef}
                    stopScroll={stopScroll}
                    curDraggedOverPath={curDraggedOverPath}
                    showModal={showModal}
                  />
                );
              } else if (node.type === "file") {
                return (
                  <TreeFile
                    node={node}
                    padLeft={
                      (node.depth - depthToSubtractRef.current) * padLeft
                    }
                    key={node.path}
                    height={virtualRow.size}
                    start={virtualRow.start}
                    handleRename={handleRename}
                    deleteNamesSet={deleteNamesSet}
                    checkIfNameIsUnique={checkIfNameIsUnique}
                    showEditOptions={startPath ? false : true}
                    scrollRef={scrollRef}
                    workspaceRef={workspaceRef}
                    stopScroll={stopScroll}
                    curDraggedOverPath={curDraggedOverPath}
                    showModal={showModal}
                  />
                );
              } else if (node.type === "input") {
                return (
                  <TreeInput
                    node={node}
                    key={node.path}
                    height={virtualRow.size}
                    start={virtualRow.start}
                    padLeft={node.depth * padLeft}
                    checkIfNameIsUnique={checkIfNameIsUnique}
                    isNodeModulesChildrenReceived={
                      isNodeModulesChildrenReceived
                    }
                    handleAddFile={handleAddFile}
                    handleAddFolder={handleAddFolder}
                    removeInputNode={removeInputNode}
                    deleteNamesSet={deleteNamesSet}
                    scrollRef={scrollRef}
                  />
                );
              } else if (node.type === "loading") {
                return (
                  <LoadingNode
                    padLeft={node.depth * padLeft}
                    key={node.path}
                    height={virtualRow.size}
                    start={virtualRow.start}
                  />
                );
              } else {
                return null;
              }
            })}

            {Object.keys(expandedNodesRef.current).map((path, i) => {
              const expandNodeInfo = expandedNodesRef.current[path];
              const { depth, childCount } = expandNodeInfo;
              const start = startPath
                ? expandNodeInfo.index * itemSize
                : expandNodeInfo.index * itemSize + 6;
              const padding = (depth - depthToSubtractRef.current) * padLeft;
              const buttonHeight = getButtonHeight(path, childCount);

              return (
                <button
                  className={`absolute top-0 left-0 w-2 group ${path}`}
                  key={path}
                  style={{
                    height: `${buttonHeight}px`,
                    transform: `translate(${padding + 7}px, ${
                      start + itemSize
                    }px)`,
                  }}
                  onClick={() => closeNode(path)}
                >
                  <div className="w-[1px] h-full group-hover:bg-[#0079f2] bg-[#9DA2A6] bg-opacity-30 group-hover:bg-opacity-100"></div>
                </button>
              );
            })}

            <div
              className="absolute hidden rounded-md pointer-events-none drag-container outline-dashed outline-[#0079f2] transition-all duration-200"
              ref={dragContainerRef}
            ></div>

            <dialog
              ref={modalRef}
              className="border shadow-[0px_8px_16px_0px_rgba(2, 2, 3, 0.32)] border-[#3C445C] rounded-md max-w-[50%]"
            >
              {modalInfo ? (
                modalInfo.opType === "delete" ? (
                  <ConfirmationModal
                    title={
                      <>
                        <p className="text-2xl font-bold">
                          Delete {modalInfo.nodeType}?
                        </p>
                        <p className="mt-7">
                          Are you sure you want to delete {modalInfo.name}? This
                          cannot be undone.
                        </p>
                      </>
                    }
                    modalRef={modalRef}
                    info={modalInfo}
                    acceptTitle={
                      <>
                        <RiDeleteBin6Line />
                        Yes, delete {modalInfo.nodeType}
                      </>
                    }
                    acceptCb={handleDelete}
                  />
                ) : (
                  <ConfirmationModal
                    title={
                      <>
                        <p className="text-2xl font-bold">Overwrite file?</p>
                        <p className="mt-7">
                          {modalInfo.name} already exists in the destination,
                          are you sure you want to overwrite it? This cannot be
                          undone.
                        </p>
                      </>
                    }
                    modalRef={modalRef}
                    info={modalInfo}
                    acceptTitle={
                      <>
                        <FaArrowsRotate />
                        Yes, overwrite this file
                      </>
                    }
                    acceptCb={handleMoveNodes}
                  ></ConfirmationModal>
                )
              ) : null}
            </dialog>
          </div>
        </ContextMenuTrigger>
      </ContextMenu>
    );
  }
);

const FileTreeWrapper = React.memo(
  ({
    padLeft,
    fileFetchStatus,
    socket,
    // path from which to start the flattened tree, is only passed when used in breadcrumbs
    startPath = "",
    startPathChildCount = 0,
    className = "",
    workspaceRef,
  }: {
    padLeft: number;
    fileFetchStatus: { [key: string]: boolean };
    socket: Socket | null;
    startPath?: string;
    startPathChildCount?: number;
    className?: string;
    workspaceRef: React.RefObject<HTMLDivElement> | null;
  }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    return (
      <ScrollArea
        className={cn(
          "w-full h-full overflow-auto bg-[#171D2D] root-scroll relative",
          className
        )}
        ref={scrollRef}
      >
        <FileTree
          padLeft={padLeft}
          fileFetchStatus={fileFetchStatus}
          socket={socket}
          startPath={startPath}
          startPathChildCount={startPathChildCount}
          scrollRef={scrollRef}
          workspaceRef={workspaceRef}
        />
      </ScrollArea>
    );
  }
);

const memoizedFileTree = React.memo(FileTree);
memoizedFileTree.displayName = "FileTree";
export default FileTreeWrapper;
