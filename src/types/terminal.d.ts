interface Terminal {
  id: string;
  pid: string;
}

interface SplitPane {
  id: string;
  panes: Pane[];
}

export type TerminalPane = {
  id: string;
  terminals: Terminal[];
};
