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

type WorkspaceStore = {
  name: string;
  link: string;
  baseLink: string;
  policy: string;
  fileStructure: Array<TreeFileNode | TreeFolderNode> | null;
  selectedFilePath: string;
  filesContent: FileContentObj;
  fileTabs: string[];
  lastSelectedFilePaths: string[];
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
  setSelectedFilePath: (path: string) => void;
  setFilesContent: (
    filesContent: FileContentObj | ((prev: FileContentObj) => FileContentObj)
  ) => void;
  setFileTabs: (fileTabs: string[]) => void;
  setLastSelectedFilePaths: (
    lastSelectedFilePaths: string[] | ((prev: string[]) => string[])
  ) => void;
  clearWorkspaceData: () => void;
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
      selectedFilePath: "",
      filesContent: {},
      fileTabs: [],
      lastSelectedFilePaths: [],
      setWorkspaceData: (name, link, baseLink, policy, fileStructure) =>
        set(
          { name, link, baseLink, policy, fileStructure },
          undefined,
          "setWorkspaceData"
        ),
      setFileStructure: (fileStructure) =>
        set({ fileStructure }, undefined, "setFileStructure"),
      setSelectedFilePath: (path) =>
        set({ selectedFilePath: path }, undefined, "setSelectedFilePath"),
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
      setFileTabs: (fileTabs) => set({ fileTabs }, undefined, "setFileTabs"),
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
      clearWorkspaceData: () => {
        set(
          {
            name: "",
            link: "",
            baseLink: "",
            policy: "",
            fileStructure: null,
            selectedFilePath: "",
            filesContent: {},
            fileTabs: [],
            lastSelectedFilePaths: [],
          },
          undefined,
          "clearWorkspaceData"
        );
      },
    }),
    { trace: true }
  )
);
