import { create } from "zustand";
import { TreeNode } from "./constants";
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
  fileStructure: [TreeNode] | null;
  selectedFilePath: string;
  filesContent: FileContentObj;
  // fileTabs: string[];
  // lastSelectedFilePaths: string[];
  renamedPaths: RenamePathObj[];
  deletedPaths: string[];
  setWorkspaceData: (
    name: string,
    link: string,
    baseLink: string,
    policy: string,
    fileStructure: [TreeNode] | null
  ) => void;
  setFileStructure: (fileStructure: [TreeNode]) => void;
  setSelectedFilePath: (path: string) => void;
  setFilesContent: (
    filesContent: FileContentObj | ((prev: FileContentObj) => FileContentObj)
  ) => void;
  setRenamedPaths: (renamedPaths: RenamePathObj[]) => void;
  setDeletedPaths: (deletedPaths: string[]) => void;
  clearWorkspaceData: () => void;
};

export const useUserStore = create<UserStore>((set) => ({
  email: "",
  username: "",
  setUserData: (email, username) => set({ email, username }),
}));

// export const useWorkspaceStore = create<WorkspaceStore>(
//   // @ts-ignore
//   zukeeper((set) => ({
//     name: "",
//     link: "",
//     baseLink: "",
//     policy: "",
//     fileStructure: null,
//     selectedFilePath: "",
//     filesContent: {},
//     setWorkspaceData: (name, link, baseLink, policy, fileStructure) =>
//       set({ name, link, baseLink, policy, fileStructure }),
//     setSelectedFilePath: (path) => set({ selectedFilePath: path }),
//     setFilesContent: (filesContent: FileContentObj) => set({ filesContent }),
//     clearWorkspaceData: () => {
//       set({
//         name: "",
//         link: "",
//         baseLink: "",
//         policy: "",
//         fileStructure: null,
//         selectedFilePath: "",
//         filesContent: {},
//       });
//     },
//   }))
// );
// @ts-ignore
// window.store = useWorkspaceStore;

export const useWorkspaceStore = create<WorkspaceStore>(
  devtools(
    (set) => ({
      name: "",
      link: "",
      baseLink: "",
      policy: "",
      fileStructure: null,
      selectedFilePath: "",
      filesContent: {},
      // fileTabs: [],
      // lastSelectedFilePaths: [],
      renamedPaths: [],
      deletedPaths: [],
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
      // setFilesContent: (filesContent: FileContentObj) => set({ filesContent }),
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
      setRenamedPaths: (renamedPaths) =>
        set({ renamedPaths }, undefined, "setRenamedPaths"),
      setDeletedPaths: (deletedPaths) =>
        set({ deletedPaths }, undefined, "setDeletedPaths"),
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
            renamedPaths: [],
            deletedPaths: [],
          },
          undefined,
          "clearWorkspaceData"
        );
      },
    }),
    { trace: true }
  )
);
