export type GitRepoInfo = {
  changes: {
    staged: GitStagedChange[];
    unstaged: (GitUnstagedChange | GitUntrackedChange)[];
  };
  repos: string[];
  branches: { [repoPath: string]: { all: string[]; current: string } };
  // curBranch: string;
  curRepo: string;
};

export type GitStagedChange =
  | {
      type: "staged";
      name: string;
      path: string;
      index: "A";
    }
  | {
      type: "staged";
      name: string;
      path: string;
      index: "M";
      diff: string;
    }
  | {
      type: "staged";
      name: string;
      path: string;
      index: "D";
      content: string;
    };

export type GitUnstagedChange =
  | {
      type: "unstaged";
      name: string;
      path: string;
      index: "M";
      diff: string;
    }
  | {
      type: "unstaged";
      name: string;
      path: string;
      index: "D";
      content: string;
    };

export type GitUntrackedChange = {
  type: "untracked";
  name: string;
  path: string;
  index: "U";
};
