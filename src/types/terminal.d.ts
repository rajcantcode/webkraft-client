interface Pane {
  id: string;
  pid: string;
}

interface SplitPane {
  id: string;
  panes: Pane[];
}

export type TerminalPane = Pane | SplitPane;
