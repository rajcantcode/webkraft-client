import { create } from "zustand";
import { TreeNode } from "./constants";

type UserStore = {
  email: string;
  username: string;
  setUserData: (email: string, username: string) => void;
};

type WorkspaceStore = {
  name: string;
  link: string;
  fileStructure: TreeNode | null;
  setWorkspaceData: (
    name: string,
    link: string,
    fileStructure: TreeNode
  ) => void;
};

export const useUserStore = create<UserStore>((set) => ({
  email: "",
  username: "",
  setUserData: (email, username) => set({ email, username }),
}));

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  name: "",
  link: "",
  fileStructure: null,
  setWorkspaceData: (name, link, fileStructure) =>
    set({ name, link, fileStructure }),
}));
