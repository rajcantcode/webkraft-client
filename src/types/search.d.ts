export interface SearchOptions {
  //   mc = "match case",
  //   mww = "match whole word",
  mc: boolean;
  mww: boolean;
  useRegex: boolean;
  filesToInclude: string[];
  filesToExclude: string[];
}

export interface CollapseState {
  [filePath: string]: boolean;
}

export interface MatchResult {
  lineNumber: number;
  content: string;
  matchIndex: number;
}

export interface SearchResults {
  [filePath: string]: MatchResult[];
}

export type FlattenedResult = (
  | {
      filePath: string;
    }
  | MatchResult
)[];
