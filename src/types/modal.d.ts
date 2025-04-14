export type DeleteInfo = {
  path: string;
  name: string;
  pni: number;
  nodeType: "file" | "folder";
  opType: "delete";
};
export type OverwriteInfo = {
  opType: "overwrite";
  name: string;
  sourcePath: string;
  destBasePath: string;
};

export type ModalInfo = (DeleteInfo | OverwriteInfo) & { show: boolean };
