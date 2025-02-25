import { create } from "zustand";
import { TreeFileNode, TreeFolderNode } from "./constants";
import zukeeper from "zukeeper";
import { devtools } from "zustand/middleware";

type UserStore = {
  email: string;
  username: string;
  setUserData: (email: string, username: string) => void;
};

type FileContent = {
  name: string;
  content: string;
  language: string;
};

export type FileContentObj = {
  [key: string]: FileContent;
};

type FileFetchStatus = {
  [key: string]: boolean;
};

export type RenamePathObj = {
  oldPath: string;
  newPath: string;
};

export type FileTabs = {
  [editorId: string]: string[];
};

export type LastSelectedFilePaths = {
  [editorId: string]: string[];
};

export type SelectedFilePath = {
  [editorId: string]: string;
};

type WorkspaceStore = {
  name: string;
  link: string;
  baseLink: string;
  policy: string;
  fileStructure: Array<TreeFileNode | TreeFolderNode> | null;
  selectedFilePath: SelectedFilePath;
  filesContent: FileContentObj;
  fileTabs: FileTabs;
  lastSelectedFilePaths: LastSelectedFilePaths;
  editorIds: string[];
  lastSelectedEditorIds: string[];
  activeEditorId: string;
  lastPathBeforeClosingEditor: string;
  // Used when a search result is clicked and we need to scroll to the position
  searchPosition: {
    lineNumber: number;
    column: number;
    matchIndex: number;
  } | null;
  setLastPathBeforeClosingEditor: (path: string) => void;
  setWorkspaceData: (
    name: string,
    link: string,
    baseLink: string,
    policy: string,
    fileStructure: Array<TreeFileNode | TreeFolderNode> | null
  ) => void;
  setFileStructure: (
    fileStructure: Array<TreeFileNode | TreeFolderNode>
  ) => void;
  setSelectedFilePath: (
    path: SelectedFilePath | ((path: SelectedFilePath) => SelectedFilePath)
  ) => void;
  setFilesContent: (
    filesContent: FileContentObj | ((prev: FileContentObj) => FileContentObj)
  ) => void;
  setFileTabs: (
    fileTabs: FileTabs | ((fileTabs: FileTabs) => FileTabs)
  ) => void;
  setLastSelectedFilePaths: (
    lastSelectedFilePaths:
      | LastSelectedFilePaths
      | ((prev: LastSelectedFilePaths) => LastSelectedFilePaths)
  ) => void;
  setLastSelectedEditorIds: (
    lastSelectedEditorIds:
      | string[]
      | ((lastSelectedEditorIds: string[]) => string[])
  ) => void;
  clearWorkspaceData: () => void;
  setEditorIds: (editorIds: string[] | ((prev: string[]) => string[])) => void;
  setActiveEditorId: (editorId: string) => void;
  setSearchPosition: (
    position: {
      lineNumber: number;
      column: number;
      matchIndex: number;
    } | null
  ) => void;
};

export const useUserStore = create<UserStore>((set) => ({
  email: "",
  username: "",
  setUserData: (email, username) => set({ email, username }),
}));

export const useWorkspaceStore = create<WorkspaceStore>(
  // @ts-ignore
  devtools(
    (set) => ({
      name: "",
      link: "",
      baseLink: "",
      policy: "",
      fileStructure: null,
      selectedFilePath: {},
      filesContent: {},
      fileTabs: {},
      lastSelectedFilePaths: {},
      editorIds: [],
      lastSelectedEditorIds: [],
      activeEditorId: "",
      lastPathBeforeClosingEditor: "",
      searchPosition: null,
      setWorkspaceData: (name, link, baseLink, policy, fileStructure) =>
        set(
          { name, link, baseLink, policy, fileStructure },
          undefined,
          "setWorkspaceData"
        ),
      setFileStructure: (fileStructure) =>
        set({ fileStructure }, undefined, "setFileStructure"),
      setSelectedFilePath: (path) => {
        set(
          (state) => ({
            selectedFilePath:
              typeof path === "function" ? path(state.selectedFilePath) : path,
          }),
          undefined,
          "setSelectedFilePath"
        );
      },
      setFilesContent: (filesContent) => {
        set(
          (state) => ({
            filesContent:
              typeof filesContent === "function"
                ? filesContent(state.filesContent)
                : filesContent,
          }),
          undefined,
          "setFilesContent"
        );
      },
      setFileTabs: (fileTabs) => {
        set(
          (state) => ({
            fileTabs:
              typeof fileTabs === "function"
                ? fileTabs(state.fileTabs)
                : fileTabs,
          }),
          undefined,
          "setFileTabs"
        );
      },
      setLastSelectedFilePaths: (lastSelectedFilePaths) => {
        set(
          (state) => ({
            lastSelectedFilePaths:
              typeof lastSelectedFilePaths === "function"
                ? lastSelectedFilePaths(state.lastSelectedFilePaths)
                : lastSelectedFilePaths,
          }),
          undefined,
          "setLastSelectedFilePaths"
        );
      },
      setLastSelectedEditorIds: (lastSelectedEditorIds) => {
        set(
          (state) => ({
            lastSelectedEditorIds:
              typeof lastSelectedEditorIds === "function"
                ? lastSelectedEditorIds(state.lastSelectedEditorIds)
                : lastSelectedEditorIds,
          }),
          undefined,
          "setLastSelectedEditorIds"
        );
      },
      setLastPathBeforeClosingEditor: (path) => {
        set(
          { lastPathBeforeClosingEditor: path },
          undefined,
          "setLastPathBeforeClosingEditor"
        );
      },
      clearWorkspaceData: () => {
        set(
          {
            name: "",
            link: "",
            baseLink: "",
            policy: "",
            fileStructure: null,
            selectedFilePath: {},
            filesContent: {},
            fileTabs: {},
            lastSelectedFilePaths: {},
          },
          undefined,
          "clearWorkspaceData"
        );
      },
      setEditorIds: (editorIds) => {
        set(
          (state) => ({
            editorIds:
              typeof editorIds === "function"
                ? editorIds(state.editorIds)
                : editorIds,
          }),
          undefined,
          "setEditorIds"
        );
      },
      setActiveEditorId: (editorId) =>
        set({ activeEditorId: editorId }, undefined, "setActiveEditorId"),
      setSearchPosition: (position) =>
        set({ searchPosition: position }, undefined, "setSearchPosition"),
    }),
    { trace: true }
  )
);
