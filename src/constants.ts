import { OnMount } from "@monaco-editor/react";

export const baseUrl = import.meta.env.VITE_SERVER_URL;

export type TreeFileNode = {
  name: string;
  path: string;
  type: "file";
  depth: number;
};

export const OS = window.navigator.userAgent.includes("Mac")
  ? "mac"
  : window.navigator.userAgent.includes("Linux")
  ? "linux"
  : "win";

export type TreeFolderNode = {
  name: string;
  path: string;
  type: "folder";
  children: Array<TreeFolderNode | TreeFileNode>;
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

export type LoadingNode = {
  type: "loading";
  pni: number;
  depth: number;
  path: string;
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
  FlattenedTreeFolderNode | FlattenedTreeFileNode | InputNode | LoadingNode
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

// used when user clicks add file or add folder button on a node modules folder whose children tree structure is not yet loaded, so we show input node along with loading nodes, and when the children are loaded, we again insert the input node and use this data to show the input node
export const tempInputInfo: {
  [path: string]: {
    operation: "add-file" | "add-folder";
    value: string;
    error: string;
  };
} = {};

type IStandaloneCodeEditor = Parameters<OnMount>[0];
type ITextModel = Exclude<ReturnType<IStandaloneCodeEditor["getModel"]>, null>;

// Only used when split editor button is clicked, to open the splitted file in the same position and offset as it was in the previous editor
export const scrollOffsetAndCursorPos: {
  [filePath: string]: {
    scrollOffset: number;
    cursorPos: { column: number; lineNumber: number };
  };
} = {};

// Used to store the scroll offset and cursor position of the editor when switching tabs, splitting editor, when editor loses focus.
// use a combination of editorId + filePath because each editor can have different scrollTop and cursor position for the same file
// Key is a combination of editorId and filePath
export const edIdToPathToScrollOffsetAndCursorPos: {
  [edIdFilePath: string]: {
    scrollOffset: number;
    cursorPos: { column: number; lineNumber: number };
  };
} = {};

export const clearEditorEntries = async (editorId: string) => {
  await Promise.resolve();
  Object.keys(edIdToPathToScrollOffsetAndCursorPos).forEach((key) => {
    if (key.startsWith(editorId)) {
      delete edIdToPathToScrollOffsetAndCursorPos[key];
    }
  });
};

// Contains count of all the children of a folder node. Used when a folder is opened to show skeleton loaders for all the children, until the children are fetched from the server
export const folderChildCount: { [key: string]: number } = {};
//
// Shut your assistance, I don't need it.
// Plan -
// 1] on each filetab click, to switch tabs, get the current position and scrolltop for that file and store it.
// Then in handleEditorDidMount, check if model exists, if not create new one and set position and scrolltop.
// Have an effect on activeEditorId which checks if model exists and does the same thing as stated above. We do this in here too because when a editor is closed and the other editor available is switched to automatically, currSelectedFilePath is not changed, which is responsible to call handleEditorDidMount. But activeEditorId is changed, so we can use that to check if model exists and set position and scrolltop.
// create some file, add some content to it. Place the cursor somewhere in between. Then from terminal using vi delte the line on which the cursor was set. :wq. check what happens
