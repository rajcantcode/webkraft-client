import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/Resizable";
import { TerminalPane } from "../types/terminal";
import { nanoid } from "nanoid";
import { Socket } from "socket.io-client";
import { BsTerminal, BsLayoutSplit } from "react-icons/bs";
import { RiDeleteBin6Line } from "react-icons/ri";
import { FaPlus, FaEraser } from "react-icons/fa6";
import { RxCross2 } from "react-icons/rx";
import ResizableTerminalPane from "./ResizableTerminalPane";
import debounce from "lodash.debounce";
import { TooltipWrapper } from "./ui/ToolTip";
const TerminalContainer = ({
  defaultPid,
  socket,
  defaultTerminalContainerSize,
}: {
  defaultPid: string;
  socket: Socket | null;
  defaultTerminalContainerSize: number;
}) => {
  const [terminalPanes, setTerminalPanes] = useState<TerminalPane[]>([
    { id: "default-1", terminals: [{ id: nanoid(4), pid: defaultPid }] },
  ]);
  const [activePaneId, setActivePaneId] = useState<string>("default-1");
  const [activePid, setActivePid] = useState<string>(defaultPid);
  const [terminalContainerSize, setTerminalContainerSize] = useState<number>(
    defaultTerminalContainerSize
  );

  const request = useMemo(
    () =>
      debounce((size: number) => {
        setTerminalContainerSize(size);
      }, 200),
    []
  );

  const handleTerminalResize = useCallback(
    (size: number) => {
      request(size);
    },
    [request]
  );

  useEffect(() => {
    setTerminalContainerSize(defaultTerminalContainerSize);
  }, [defaultTerminalContainerSize]);

  useEffect(() => {
    const handleWindowResize = () => {
      handleTerminalResize(window.innerHeight);
    };
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [handleTerminalResize]);
  const splitTerminal = useCallback(
    (terminalId: string, parentPaneId: string) => {
      if (!socket) return;
      const terminalPanesCopy = [...terminalPanes];
      const parentPaneIndex = terminalPanesCopy.findIndex(
        (pane) => pane.id === parentPaneId
      );
      if (parentPaneIndex === -1) {
        console.log("Parent pane not found");
        return;
      }
      const parentPane = terminalPanesCopy[parentPaneIndex];
      const terminalIndex = parentPane.terminals.findIndex(
        (terminal) => terminal.id === terminalId
      );
      if (terminalIndex === -1) {
        console.log("Terminal not found");
        return;
      }

      socket.emit("term:new", (error: Error | null, pid: string) => {
        if (error) {
          console.log(error);
          return;
        }
        const newTerminalId = nanoid(4);
        parentPane.terminals.splice(terminalIndex + 1, 0, {
          id: newTerminalId,
          pid,
        });
        setTerminalPanes(terminalPanesCopy);
        setActivePaneId(parentPaneId);
        setActivePid(pid);
      });
    },
    [terminalPanes, setTerminalPanes, socket, setActivePaneId]
  );

  const killTerminal = useCallback(
    (terminalId: string, parentPaneId: string) => {
      if (!socket) return;
      const terminalPanesCopy = [...terminalPanes];
      const parentPaneIndex = terminalPanesCopy.findIndex(
        (pane) => pane.id === parentPaneId
      );
      if (parentPaneIndex === -1) {
        console.log("Parent pane not found");
        return;
      }
      const parentPane = terminalPanesCopy[parentPaneIndex];
      const terminalIndex = parentPane.terminals.findIndex(
        (terminal) => terminal.id === terminalId
      );
      if (terminalIndex === -1) {
        console.log("Terminal not found");
        return;
      }
      const terminalToKill = parentPane.terminals[terminalIndex];
      socket.emit("term:kill", terminalToKill.pid, (error: Error | null) => {
        if (error) {
          console.log(error);
          return;
        }
        parentPane.terminals.splice(terminalIndex, 1);
        if (parentPane.terminals.length > 0) {
          const indexToSet = terminalIndex === 0 ? 0 : terminalIndex - 1;
          setActivePaneId(parentPane.id);
          setActivePid(parentPane.terminals[indexToSet].pid);
        } else {
          terminalPanesCopy.splice(parentPaneIndex, 1);
          if (terminalPanesCopy.length > 0) {
            const indexToSet = parentPaneIndex === 0 ? 0 : parentPaneIndex - 1;
            setActivePaneId(terminalPanesCopy[indexToSet].id);
            setActivePid(terminalPanesCopy[indexToSet].terminals[0].pid);
          } else {
            setActivePaneId("");
            setActivePid("");
          }
        }
        setTerminalPanes(terminalPanesCopy);
      });
    },
    [terminalPanes, setTerminalPanes, socket, setActivePaneId]
  );

  const addTerminal = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!socket) return;
    socket.emit("term:new", (error: Error | null, pid: string) => {
      if (error) {
        console.log(error);
        return;
      }
      const newPaneId = nanoid(4);
      const newTerminalId = nanoid(4);
      setTerminalPanes([
        ...terminalPanes,
        { id: newPaneId, terminals: [{ id: newTerminalId, pid }] },
      ]);
      setActivePaneId(newPaneId);
      setActivePid(pid);
    });
  };

  const clearTerminal = () => {
    if (!socket) return;
    socket.emit("term:clear", activePid, (error: Error | null) => {
      if (error) {
        console.log(error);
        return;
      }
    });
  };

  const handlePaneClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    terminalId: string,
    terminalPid: string,
    parentPaneId: string
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const actionSelected = (e.target as HTMLElement)
      .closest(".action-icon")
      ?.getAttribute("data-action");
    if (actionSelected) {
      switch (actionSelected) {
        case "split":
          splitTerminal(terminalId, parentPaneId);
          break;
        case "kill":
          killTerminal(terminalId, parentPaneId);
          break;
      }
    } else {
      setActivePaneId(parentPaneId);
      setActivePid(terminalPid);
    }
  };
  return (
    <div className="w-full h-full term-container">
      <div className="w-full heading flex items-center justify-end p-1 bg-[#171D2D]">
        <div className="flex items-center gap-1 right-panel w-fit">
          <TooltipWrapper title="New Terminal">
            <button
              onClick={addTerminal}
              className="rounded-md p-1 hover:bg-[#313847]"
            >
              <FaPlus className="text-sm" />
            </button>
          </TooltipWrapper>

          <TooltipWrapper title="Clear Terminal">
            <button
              onClick={clearTerminal}
              className="rounded-md p-1 hover:bg-[#313847]"
            >
              <FaEraser className="text-sm" />
            </button>
          </TooltipWrapper>

          <TooltipWrapper title="Close pane">
            <button className="rounded-md p-1 hover:bg-[#313847]">
              <RxCross2 className="text-sm" />
            </button>
          </TooltipWrapper>
        </div>
      </div>
      {terminalPanes.length === 0 ? (
        <div className="flex items-center justify-center">
          <p>Open a new terminal pane to interact with the shell</p>
        </div>
      ) : (
        <div className="w-full h-[calc(100%-30px)]">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel
              defaultSize={80}
              minSize={50}
              maxSize={80}
              collapsible={false}
              order={1}
              onResize={handleTerminalResize}
              className="h-full"
            >
              {terminalPanes.map((pane) => {
                const totalTerminals = pane.terminals.length;
                const size = 100 / totalTerminals;

                return (
                  <div
                    className={`h-full ${
                      activePaneId === pane.id ? "block w-full" : "hidden"
                    }`}
                    key={pane.id}
                  >
                    <ResizablePanelGroup
                      direction="horizontal"
                      className="h-full"
                    >
                      {pane.terminals.map((terminal, i) => (
                        <ResizableTerminalPane
                          terminal={terminal}
                          activePid={activePid}
                          setActivePid={setActivePid}
                          paneId={pane.id}
                          activePaneId={activePaneId}
                          setHandle={totalTerminals > 1}
                          size={size}
                          socket={socket}
                          key={terminal.id}
                          order={i + 1}
                          terminalContainerSize={terminalContainerSize}
                        />
                      ))}
                    </ResizablePanelGroup>
                  </div>
                );
              })}
            </ResizablePanel>
            <ResizableHandle withHandle={true} direction="horizontal" />
            <ResizablePanel
              defaultSize={20}
              minSize={10}
              maxSize={50}
              collapsible={false}
              order={2}
              className="h-full"
            >
              <div className="w-full h-full overflow-y-auto bg-gray-900 cursor-pointer sidebar">
                {terminalPanes.map((pane) => {
                  const parentPaneid = pane.id;
                  const totalPanes = pane.terminals.length - 1;
                  return (
                    <div
                      className={`sidebar-pane-container ${
                        pane.terminals.length > 1 ? "pl-1" : ""
                      }`}
                      key={pane.id}
                    >
                      {pane.terminals.map((terminal, index) => {
                        return (
                          <div
                            className={`${
                              activePid === terminal.pid
                                ? "bg-gray-800 before:content-[''] before:absolute before:top-0 before:left-0 before:h-full before:w-[2px] before:bg-[#0179F2]"
                                : "bg-gray-900"
                            } flex items-center justify-between px-2 relative`}
                            key={terminal.id}
                            onClick={(e) =>
                              handlePaneClick(
                                e,
                                terminal.id,
                                terminal.pid,
                                parentPaneid
                              )
                            }
                          >
                            <div className="flex items-center gap-2 lhs">
                              <span className="flex items-center">
                                {pane.terminals.length > 1 && (
                                  <span className="decoration">
                                    {index === 0
                                      ? "┌ "
                                      : index === totalPanes
                                      ? "└ "
                                      : "├ "}
                                  </span>
                                )}
                                <BsTerminal className="text-sm" />
                              </span>
                              <span className="text-sm">bash</span>
                            </div>
                            <div className="flex items-center gap-2 rhs">
                              <TooltipWrapper title="split">
                                <button>
                                  <BsLayoutSplit
                                    data-action="split"
                                    className="text-sm action-icon"
                                  />
                                </button>
                              </TooltipWrapper>

                              <TooltipWrapper title="delete">
                                <button>
                                  <RiDeleteBin6Line
                                    data-action="kill"
                                    className="text-sm action-icon"
                                  />
                                </button>
                              </TooltipWrapper>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  );
};

export default TerminalContainer;
