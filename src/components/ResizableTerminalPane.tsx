import React, { useCallback, useEffect, useState } from "react";
import { Pane } from "../types/terminal";
import { ResizableHandle, ResizablePanel } from "./ui/Resizable";
import { Socket } from "socket.io-client";
import debounce from "lodash.debounce";
import Terminal from "./Terminal";

const ResizableTerminalPane = ({
  size,
  pane,
  activePid,
  setActivePid,
  setHandle,
  socket,
  order,
  terminalContainerSize,
}: {
  size: number;
  pane: Pane;
  activePid: string;
  setActivePid: (value: React.SetStateAction<string>) => void;
  setHandle: boolean;
  socket: Socket | null;
  order?: number;
  terminalContainerSize: number;
}) => {
  const [terminalSize, setTerminalSize] = useState(terminalContainerSize);

  const request = debounce((terminalSize: number) => {
    setTerminalSize(terminalSize);
  }, 200);
  const handleTerminalResize = useCallback(
    (terminalSize: number) => {
      request(terminalSize);
    },
    [request],
  );

  useEffect(() => {
    console.log(
      "received new terminalContainerSize in ResizableTerminalPane - ",
      terminalContainerSize,
    );

    setTerminalSize(terminalContainerSize);
  }, [terminalContainerSize]);
  return (
    <>
      <ResizablePanel
        // key={pane.id}
        id={pane.id}
        order={order}
        defaultSize={size}
        minSize={10}
        // maxSize={80}
        collapsible={false}
        className="bg-green-300 h-full"
        onResize={handleTerminalResize}
        onClick={(
          e: React.MouseEvent<keyof HTMLElementTagNameMap, MouseEvent>,
        ) => {
          e.stopPropagation();
          e.preventDefault();
          setActivePid(pane.pid);
        }}
      >
        <Terminal
          // key={pane.pid}
          socket={socket}
          size={terminalSize}
          pid={pane.pid}
          activePid={activePid}
        />
      </ResizablePanel>
      {setHandle ? <ResizableHandle /> : null}
    </>
  );
};

export default ResizableTerminalPane;
