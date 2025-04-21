import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { useWorkspaceStore } from "../store";
import { sendResizeEvent, terminalResizeData } from "../lib/utils";

const Terminal = ({
  socket,
  size,
  pid,
  activePid,
  paneId,
  activePaneId,
}: {
  socket: Socket | null;
  size: number;
  pid: string;
  activePid: string;
  paneId: string;
  activePaneId: string;
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const xTerminal = useRef<XTerminal | null>(null);

  const fitTerminal = useCallback((e?: UIEvent) => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
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

    xTerminal.current = terminal;

    if (terminalRef.current) {
      fitAddonRef.current = new FitAddon();
      const fitAddon = fitAddonRef.current;
      terminal.loadAddon(fitAddon);
      terminal.open(terminalRef.current as HTMLDivElement);
      fitAddon.fit();

      socket.emit(
        "term:resize",
        {
          [pid]: {
            cols: terminal.cols,
            rows: terminal.rows,
          },
        },
        (error: Error | null) => {
          if (error) {
            console.error(error);
          }
        }
      );
      // window.addEventListener("resize", fitTerminal);
    }

    terminal.onData((data) => socket.emit("term:write", { data, pid }));
    terminal.onResize(({ cols, rows }) => {
      terminalResizeData[pid] = { cols, rows };
      sendResizeEvent(socket);
    });

    const handleTerminalOutput = ({
      data,
      pid: resPid,
    }: {
      data: string;
      pid: string;
    }) => {
      if (resPid === pid) {
        terminal.write(data);
      }
    };

    const clearTerminal = (resPid: string) => {
      if (resPid === pid) {
        terminal.clear();
      }
    };

    // Handle server output
    socket.on("term:out", handleTerminalOutput);

    socket.on("term:cleared", clearTerminal);

    return () => {
      terminal.dispose();
      // window.removeEventListener("resize", fitTerminal);
      xTerminal.current = null;
      socket.off("term:out", handleTerminalOutput);
      socket.off("term:cleared", clearTerminal);
    };
  }, [socket, fitTerminal, pid]);

  useEffect(() => {
    if (activePid === pid) {
      if (terminalRef.current) {
        fitTerminal();
        xTerminal.current?.focus();
      }
    }
  }, [activePid, fitTerminal, pid]);

  useEffect(() => {
    if (activePaneId === paneId && pid !== activePid) {
      fitTerminal();
    }
  }, [paneId, activePaneId, pid, activePid, fitTerminal]);

  useEffect(() => {
    // fitTerminal();
    if (activePaneId === paneId) {
      fitTerminal();
    }
  }, [size, fitTerminal, activePaneId, paneId]);

  return (
    <div
      className="h-full bg-[#1B2333] terminal w-full"
      ref={terminalRef}
    ></div>
  );
};

export default Terminal;
