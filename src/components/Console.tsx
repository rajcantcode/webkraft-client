import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
const Console = ({ socket, size }: { socket: Socket | null; size: number }) => {
  if (!socket) return null;
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    // const terminal = new XTerminal({ convertEol: true });
    const terminal = new XTerminal({
      // convertEol: true,
      cursorBlink: true,
      cursorStyle: "block",
      // rows: terminalRef.current?.clientHeight
      //   ? Math.floor(terminalRef.current.clientHeight / 18)
      //   : undefined,
      // cols: terminalRef.current?.clientWidth
      //   ? Math.floor(terminalRef.current.clientWidth / 9)
      //   : undefined,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#ffffff",
        // selection: "#264f78",
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
    // terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current as HTMLDivElement);
    // fitAddon.fit();
    terminal.writeln("Hello from sandy.js");
    let inputBuffer = "";
    terminal.onData((data) => {
      inputBuffer += data;
      terminal.write(data);
      // console.log(inputBuffer);
    });
    terminal.onKey((e) => {
      console.log(e);
      if (e.key === "\r") {
        // terminal.writeln("\r\n");
        // terminal.write("\r\n");
        console.log(`Sending data to server -> ${inputBuffer}`);
        socket.emit("term:write", inputBuffer);
        inputBuffer = "";
      }
    });
    socket.on("term:out", (data: string) => {
      // terminal.write("\x1b[G");
      // terminal.write("\x1b[2K\x1b[G");
      // terminal.write("\x1b[2K\r");
      terminal.write(data);
      // terminal.write("\r\n");
    });
    return () => {
      terminal.dispose();
      inputBuffer = "";
    };
  }, [socket]);

  useEffect(() => {
    if (fitAddonRef.current) {
      // fitAddonRef.current.fit();
    }
  }, [size]);

  return (
    <div className="h-full bg-purple-400" id="terminal" ref={terminalRef}></div>
  );
};

export default Console;
