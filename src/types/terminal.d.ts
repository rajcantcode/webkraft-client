interface Terminal {
  id: string;
  pid: string;
}

export type TerminalPane = {
  id: string;
  terminals: Terminal[];
};
