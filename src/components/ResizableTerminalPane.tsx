import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Terminal as TerminalType } from "../types/terminal";
import { ResizableHandle, ResizablePanel } from "./ui/Resizable";
import { Socket } from "socket.io-client";
import debounce from "lodash.debounce";
import Terminal from "./Terminal";

const ResizableTerminalPane = ({
  size,
  terminal,
  activePid,
  setActivePid,
  paneId,
  activePaneId,
  setHandle,
  socket,
  order,
  terminalContainerSize,
}: {
  size: number;
  terminal: TerminalType;
  activePid: string;
  setActivePid: (value: React.SetStateAction<string>) => void;
  paneId: string;
  activePaneId: string;
  setHandle: boolean;
  socket: Socket | null;
  order?: number;
  terminalContainerSize: number;
}) => {
  const [terminalSize, setTerminalSize] = useState(terminalContainerSize);

  const request = useMemo(
    () =>
      debounce((terminalSize: number) => {
        setTerminalSize(terminalSize);
      }, 200),
    []
  );
  const handleTerminalResize = useCallback(
    (terminalSize: number) => {
      request(terminalSize);
    },
    [request]
  );

  useEffect(() => {
    setTerminalSize(terminalContainerSize);
  }, [terminalContainerSize]);
  return (
    <>
      <ResizablePanel
        id={terminal.id}
        order={order}
        defaultSize={size}
        minSize={10}
        // maxSize={80}
        collapsible={false}
        className="h-full bg-green-300"
        onResize={handleTerminalResize}
        onClick={(
          e: React.MouseEvent<keyof HTMLElementTagNameMap, MouseEvent>
        ) => {
          e.stopPropagation();
          e.preventDefault();
          setActivePid(terminal.pid);
        }}
      >
        <Terminal
          socket={socket}
          size={terminalSize}
          pid={terminal.pid}
          activePid={activePid}
          paneId={paneId}
          activePaneId={activePaneId}
        />
      </ResizablePanel>
      {setHandle ? (
        <ResizableHandle direction="horizontal" withHandle={true} />
      ) : null}
    </>
  );
};

export default ResizableTerminalPane;
