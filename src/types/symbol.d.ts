import * as ts from "typescript";
export type Symbol = {
  text: string;
  kind: ts.ScriptElementKind;
  kindModifiers: string;
  startOffset: number;
  endOffset: number;
  childItems: Symbol[];
};
