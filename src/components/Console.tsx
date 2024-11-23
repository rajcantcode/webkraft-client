import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { useWorkspaceStore } from "../store";

const Console = ({ socket, size }: { socket: Socket | null; size: number }) => {
  if (!socket) return null;
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const terminal = new XTerminal({
      cursorBlink: false,
      cursorStyle: "block",
      theme: {
        background: "#1B2333",
        foreground: "#d4d4d4",
        cursor: "#F5F9FC",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
      fontFamily: '"Cascadia Code", Menlo, monospace',
      fontSize: 13,
      fontWeight: "normal",
      fontWeightBold: "bold",
      letterSpacing: 0,
      lineHeight: 1,
    });

    fitAddonRef.current = new FitAddon();
    const fitAddon = fitAddonRef.current;
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current as HTMLDivElement);
    fitAddon.fit();

    terminal.write(
      `\x1b[38;2;88;171;255m~/${useWorkspaceStore.getState().name}\x1b[0m$ `
    );

    terminal.onData((data) => socket.emit("term:write", data));

    // Handle server output
    socket.on("term:out", (data: string) => {
      terminal.write(data);
    });

    return () => {
      terminal.dispose();
    };
  }, [socket]);

  useEffect(() => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [size]);

  return (
    <div className="h-full bg-purple-400" id="terminal" ref={terminalRef}></div>
  );
};

// on width change of the terminal, change number of colums
// on height change of the terminal, change number of rows

export default Console;
