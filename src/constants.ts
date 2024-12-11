export const baseUrl = import.meta.env.VITE_SERVER_URL;

export type TreeFileNode = {
  name: string;
  path: string;
  type: "file";
  depth: number;
};

export type TreeFolderNode = {
  name: string;
  path: string;
  type: "folder";
  children: Array<TreeFolderNode | TreeFileNode>;
  isExpanded: boolean;
  depth: number;
};

// pni: parent node index
export type FlattenedTreeFileNode = TreeFileNode & {
  pni: number;
};
// index: index of the folder node in the flattened tree
export type FlattenedTreeFolderNode = Omit<TreeFolderNode, "children"> & {
  isExpanded: boolean;
  depth: number;
  pni: number;
  index: number;
};

export type InputNode = {
  type: "input";
  operation: "add-file" | "add-folder";
  path: string;
  pni: number;
  value: string;
  depth: number;
  error: string;
};

export type FlattenedTree = Array<
  FlattenedTreeFolderNode | FlattenedTreeFileNode | InputNode
>;

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
