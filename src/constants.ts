export const baseUrl = import.meta.env.VITE_SERVER_URL;

export type TreeNode =
  | {
      name: string;
      path: string;
      type: "file";
    }
  | {
      name: string;
      path: string;
      type: "folder";
      children: TreeNode[];
    };
