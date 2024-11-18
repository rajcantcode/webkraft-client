import { Terminal as XTerminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
const Console = () => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const terminal = new XTerminal({ convertEol: true });
    terminal.open(terminalRef.current as HTMLDivElement);
    terminal.writeln("Hello from sandy.js");
    let inputBuffer = "";
    // terminal.onData((data) => {
    //   if (data === "\r" || data === "\n") {
    //     console.log(data);
    //     terminal.write(data);
    //     inputBuffer = "";
    //   } else {
    //     terminal.writeln("");
    //     inputBuffer += data;
    //   }
    // });
    terminal.onData((data) => {
      inputBuffer += data;
      terminal.write(data);
      console.log(inputBuffer);
    });
    terminal.onKey((e) => {
      console.log(e);
      if (e.key === "/r") {
        terminal.writeln("\r\n");
        console.log(inputBuffer);
        inputBuffer = "";
      }
    });
    return () => {
      terminal.dispose();
      inputBuffer = "";
    };
  }, []);

  return (
    <div className="h-full bg-purple-400" id="terminal" ref={terminalRef}></div>
  );
};

export default Console;
