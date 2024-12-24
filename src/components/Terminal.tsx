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
}: {
  socket: Socket | null;
  size: number;
  pid: string;
  activePid: string;
}) => {
  if (!socket) return null;
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const xTerminal = useRef<XTerminal | null>(null);

  const fitTerminal = useCallback((e?: UIEvent) => {
    console.log("fitTerminal called");

    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
    if (e) {
      console.log(`Fired by resize`);
      // console.log(terminalRef.);
      console.log({
        rows: xTerminal.current?.rows,
        cols: xTerminal.current?.cols,
      });
    } else {
      console.log(`Fired by state change`);
      console.log({
        rows: xTerminal.current?.rows,
        cols: xTerminal.current?.cols,
      });
    }
  }, []);

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

    xTerminal.current = terminal;

    if (terminalRef.current) {
      fitAddonRef.current = new FitAddon();
      const fitAddon = fitAddonRef.current;
      terminal.loadAddon(fitAddon);
      terminal.open(terminalRef.current as HTMLDivElement);
      fitAddon.fit();
      console.log("sending resize event from useEffect directly");

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
        },
      );
      // window.addEventListener("resize", fitTerminal);
    }
    terminal.write(
      `\x1b[38;2;88;171;255m~/${useWorkspaceStore.getState().name}\x1b[0m$ `,
    );

    terminal.onData((data) => socket.emit("term:write", { data, pid }));
    terminal.onResize(({ cols, rows }) => {
      terminalResizeData[pid] = { cols, rows };
      console.log(`🤡sending resize event in Terminal.tsx - ${cols}x${rows}`);
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
        terminal.write(
          `\x1b[38;2;88;171;255m~/${useWorkspaceStore.getState().name}\x1b[0m$ `,
        );
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
      }
    }
  }, [activePid, fitTerminal, pid]);

  useEffect(() => {
    console.log(`received new size in Terminal.tsx - ${size}`);
    fitTerminal();
  }, [size, fitTerminal]);

  return (
    <div className="h-full bg-pink-400 terminal w-full" ref={terminalRef}></div>
  );
};

export default Terminal;
