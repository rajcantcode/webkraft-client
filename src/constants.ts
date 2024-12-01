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

export type FolderNode = Extract<TreeNode, { type: "folder" }>;
export type TreeFileNode = {
  name: string;
  path: string;
  type: "file";
};
export type TreeFolderNode = {
  name: string;
  path: string;
  type: "folder";
  children: Array<TreeFolderNode | TreeFileNode>;
};
export type FileContent = {
  name: string;
  language: string;
  content: string;
};

export type FileContentObj = {
  [key: string]: FileContent;
};

export const editorSupportedLanguages: { [key: string]: string } = {
  ts: "typescript",
  js: "javascript",
  tsx: "typescript",
  jsx: "javascript",
  py: "python",
  java: "java",
  md: "markdown",
  html: "html",
  css: "css",
  json: "json",
  xml: "xml",
  sql: "sql",
  sh: "shell",
  yml: "yaml",
  dockerfile: "dockerfile",
  c: "c",
  cpp: "cpp",
};
