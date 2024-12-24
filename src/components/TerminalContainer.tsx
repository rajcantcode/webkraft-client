import React, { useCallback, useEffect, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/Resizable";
import { Pane, SplitPane, TerminalPane } from "../types/terminal";
import { nanoid } from "nanoid";
import { Socket } from "socket.io-client";
import { BsTerminal, BsLayoutSplit } from "react-icons/bs";
import { RiDeleteBin6Line } from "react-icons/ri";
import { FaPlus, FaEraser } from "react-icons/fa6";
import { RxCross2 } from "react-icons/rx";
import ResizableTerminalPane from "./ResizableTerminalPane";
import debounce from "lodash.debounce";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/ToolTip";
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
    { id: "default-1", pid: defaultPid },
  ]);
  const [activePaneId, setActivePaneId] = useState<string>("default-1");
  const [activePid, setActivePid] = useState<string>(defaultPid);
  const [terminalContainerSize, setTerminalContainerSize] = useState<number>(
    defaultTerminalContainerSize,
  );

  const request = debounce((size: number) => {
    setTerminalContainerSize(size);
  }, 200);

  const handleTerminalResize = useCallback(
    (size: number) => {
      request(size);
    },
    [request],
  );

  useEffect(() => {
    console.log(
      `received new size in useEffect - ${defaultTerminalContainerSize}`,
    );
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
    (paneId: string, parentPaneId?: string) => {
      if (!socket) return;
      if (parentPaneId) {
        const splitPaneIndex = terminalPanes.findIndex(
          (pane) => pane.id === parentPaneId,
        );
        if (splitPaneIndex === -1) {
          console.log("Parent pane not found");
          return;
        }
        const splitPane = terminalPanes[splitPaneIndex] as SplitPane;
        const clickedPaneIndex = splitPane.panes.findIndex(
          (pane) => pane.id === paneId,
        );
        if (clickedPaneIndex === -1) {
          console.log("Pane not found");
          return;
        }
        socket.emit("term:new", (error: Error | null, pid: string) => {
          if (error) {
            console.log(error);
            return;
          }
          const panesCopy = [...terminalPanes];
          const splitPane = panesCopy[splitPaneIndex] as SplitPane;
          splitPane.panes.splice(clickedPaneIndex, 0, { id: nanoid(4), pid });
          setTerminalPanes(panesCopy);
          setActivePaneId(splitPane.id);
          setActivePid(pid);
        });
      } else {
        // socket.emit("new:term", newPaneId, (pid: string) => {});
        const oldPaneIndex = terminalPanes.findIndex(
          (pane) => pane.id === paneId,
        );
        if (oldPaneIndex === -1) {
          console.log("Pane not found");
          return;
        }
        const oldPane = terminalPanes[oldPaneIndex] as Pane;
        socket.emit("term:new", (error: Error | null, pid: string) => {
          if (error) {
            console.log(error);
            return;
          }
          const newSplitPaneId = oldPane.id;
          const newPaneId = nanoid(4);
          const newSplitPane: SplitPane = {
            id: newSplitPaneId,
            panes: [oldPane, { id: newPaneId, pid }],
          };
          const panesCopy = [...terminalPanes];
          panesCopy.splice(oldPaneIndex, 1, newSplitPane);
          setTerminalPanes(panesCopy);
          // return panesCopy;
          setActivePaneId(newSplitPaneId);
          setActivePid(pid);
        });
      }
    },
    [terminalPanes, setTerminalPanes, socket, setActivePaneId],
  );

  const killTerminal = useCallback(
    (paneId: string, parentPaneId?: string) => {
      if (!socket) return;
      if (parentPaneId) {
        const splitPaneIndex = terminalPanes.findIndex(
          (pane) => pane.id === parentPaneId,
        );
        if (splitPaneIndex === -1) {
          console.log("Parent pane not found");
          return;
        }
        const splitPane = terminalPanes[splitPaneIndex] as SplitPane;

        const clickedPaneIndex = splitPane.panes.findIndex(
          (pane) => pane.id === paneId,
        );
        if (clickedPaneIndex === -1) {
          console.log("Pane not found");
          return;
        }
        const clickedPane = splitPane.panes[clickedPaneIndex];
        if ("panes" in clickedPane) {
          console.log("Cannot kill split pane");
          return;
        }
        socket.emit("term:kill", clickedPane.pid, (error: Error | null) => {
          if (error) {
            console.log(error);
            return;
          }
          const panesCopy = [...terminalPanes];

          if (splitPane.panes.length === 2) {
            const newPaneIndex = clickedPaneIndex === 0 ? 1 : 0;
            const newPanePid = splitPane.panes[newPaneIndex].pid;
            const newPaneId = splitPane.id;
            panesCopy.splice(splitPaneIndex, 1, {
              id: newPaneId,
              pid: newPanePid,
            });
            setActivePaneId(newPaneId);
            setActivePid(newPanePid);
            setTerminalPanes(panesCopy);
            return;
          }
          splitPane.panes.splice(clickedPaneIndex, 1);
          const paneToSet = splitPane.panes[clickedPaneIndex - 1];
          // setActivePaneId(paneToSet.id);
          setActivePid(paneToSet.pid);
          // return panesCopy;
          setTerminalPanes(panesCopy);
        });
      } else {
        const paneIndex = terminalPanes.findIndex((pane) => pane.id === paneId);
        if (paneIndex === -1) {
          console.log("Pane not found");
          return;
        }
        const pane = terminalPanes[paneIndex];
        if ("panes" in pane) {
          console.log("Cannot kill split pane");
          return;
        }
        socket.emit("term:kill", pane.pid, (error: Error | null) => {
          if (error) {
            console.log(error);
            return;
          }

          const panesCopy = [...terminalPanes];
          panesCopy.splice(paneIndex, 1);
          if (panesCopy.length === 0) {
            setActivePaneId("");
            setActivePid("");
          } else if (paneIndex === 0) {
            const paneToSet = panesCopy[0];
            setActivePaneId(paneToSet.id);
            setActivePid(
              "pid" in paneToSet ? paneToSet.pid : paneToSet.panes[0].pid,
            );
          } else {
            const paneToSet = panesCopy[paneIndex - 1];
            setActivePaneId(paneToSet.id);
            setActivePid(
              "pid" in paneToSet ? paneToSet.pid : paneToSet.panes[0].pid,
            );
          }
          // if (pane.id === activePaneId) {
          //   if (panesCopy.length === 0) {
          //     setActivePaneId("");
          //     setActivePid("");
          //   } else if (paneIndex === 0) {
          //     const paneToSet = panesCopy[paneIndex + 1];
          //     setActivePaneId(paneToSet.id);
          //     setActivePid(
          //       "pid" in paneToSet ? paneToSet.pid : paneToSet.panes[0].pid,
          //     );
          //   } else {
          //     const paneToSet = panesCopy[paneIndex - 1];
          //     setActivePaneId(paneToSet.id);
          //     setActivePid(
          //       "pid" in paneToSet ? paneToSet.pid : paneToSet.panes[0].pid,
          //     );
          //   }
          // }
          setTerminalPanes(panesCopy);
        });
      }
    },
    [terminalPanes, setTerminalPanes, socket, activePaneId, setActivePaneId],
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
      setTerminalPanes([...terminalPanes, { id: newPaneId, pid }]);
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
    paneId: string,
    pid: string,
    parentPaneId?: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const actionSelected = (e.target as HTMLElement)
      .closest(".action-icon")
      ?.getAttribute("data-action");
    if (actionSelected) {
      switch (actionSelected) {
        case "split":
          splitTerminal(paneId, parentPaneId);
          break;
        case "kill":
          killTerminal(paneId, parentPaneId);
          break;
      }
    } else {
      setActivePaneId(parentPaneId ? parentPaneId : paneId);
      setActivePid(pid);
    }
  };
  return (
    <div className="w-full h-full term-container">
      <div className="w-full heading flex items-center justify-end p-1 bg-[#171D2D]">
        <div className="flex items-center right-panel w-fit gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={addTerminal}
                  className="rounded-md p-1 hover:bg-[#313847]"
                >
                  <FaPlus className="text-sm" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="p-1 rounded-md bg-[#3D445C]">New Terminal</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={clearTerminal}
                  className="rounded-md p-1 hover:bg-[#313847]"
                >
                  <FaEraser className="text-sm" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="p-1 rounded-md bg-[#3D445C]">Clear Terminal</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="rounded-md p-1 hover:bg-[#313847]">
                  <RxCross2 className="text-sm" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="p-1 rounded-md bg-[#3D445C]">Close pane</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {terminalPanes.length === 0 ? (
        <div className="flex items-center justify-center">
          <p>Open a new terminal pane to interact with the shell</p>
        </div>
      ) : (
        <div className="w-full h-[calc(100%-24px)]">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel
              defaultSize={80}
              minSize={50}
              maxSize={75}
              collapsible={false}
              order={1}
              onResize={handleTerminalResize}
              className="h-full"
            >
              {terminalPanes.map((pane) => {
                const totalPanes = "panes" in pane ? pane.panes.length : 1;

                return (
                  <div
                    className={`h-full ${activePaneId === pane.id ? "block w-full" : "hidden"}`}
                    key={pane.id}
                  >
                    <ResizablePanelGroup
                      direction="horizontal"
                      className="h-full"
                    >
                      {"panes" in pane ? (
                        pane.panes.map((pane, i) => {
                          const size = 100 / totalPanes;
                          return (
                            // <>
                            <ResizableTerminalPane
                              pane={pane}
                              activePid={activePid}
                              setActivePid={setActivePid}
                              setHandle={true}
                              size={size}
                              socket={socket}
                              key={pane.id}
                              order={i + 1}
                              terminalContainerSize={terminalContainerSize}
                            />
                            // </>
                          );
                        })
                      ) : (
                        <ResizableTerminalPane
                          pane={pane}
                          activePid={activePid}
                          setActivePid={setActivePid}
                          setHandle={false}
                          size={100}
                          socket={socket}
                          key={pane.id}
                          terminalContainerSize={terminalContainerSize}
                        />
                      )}
                    </ResizablePanelGroup>
                  </div>
                );
              })}
            </ResizablePanel>
            <ResizableHandle withHandle={true} />
            <ResizablePanel
              defaultSize={20}
              minSize={10}
              maxSize={50}
              collapsible={false}
              order={2}
            >
              <div className="w-full h-full overflow-y-auto sidebar cursor-pointer bg-gray-900">
                {terminalPanes.map((pane) => {
                  if ("panes" in pane) {
                    const parentPaneid = pane.id;
                    const totalPanes = pane.panes.length - 1;
                    // return (
                    // <div className="pl-1" key={parentPaneid}>

                    return pane.panes.map((pane, index) => {
                      return (
                        <div
                          className={`${
                            activePid === pane.pid
                              ? "bg-gray-800 before:content-[''] before:absolute before:top-0 before:left-0 before:h-full before:w-[2px] before:bg-[#0179F2]"
                              : "bg-gray-900"
                          } flex items-center justify-between px-2 relative`}
                          key={pane.id}
                          onClick={(e) =>
                            handlePaneClick(e, pane.id, pane.pid, parentPaneid)
                          }
                        >
                          <div className="flex items-center lhs gap-2">
                            <span className="flex items-center">
                              <span className="decoration">
                                {index === 0
                                  ? "┌ "
                                  : index === totalPanes
                                    ? "└ "
                                    : "├ "}
                              </span>
                              <BsTerminal className="text-sm" />
                            </span>
                            <span className="text-sm">bash</span>
                          </div>
                          <div className="flex items-center rhs gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button>
                                    <BsLayoutSplit
                                      data-action="split"
                                      className="action-icon text-sm"
                                    />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <p className="p-1 rounded-md bg-[#3D445C]">
                                    split
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button>
                                    <RiDeleteBin6Line
                                      data-action="kill"
                                      className="action-icon text-sm"
                                    />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <p className="p-1 rounded-md bg-[#3D445C]">
                                    delete
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      );
                    });

                    // </div>
                    // );
                  } else {
                    return (
                      <div
                        className={`${
                          activePaneId === pane.id
                            ? "bg-gray-800 before:content-[''] before:absolute before:top-0 before:left-0 before:h-full before:w-[2px] before:bg-[#0179F2]"
                            : "bg-gray-900"
                        } flex items-center justify-between px-2 relative`}
                        key={pane.id}
                        onClick={(e) => {
                          handlePaneClick(e, pane.id, pane.pid);
                        }}
                      >
                        <div className="flex items-center lhs gap-2">
                          <BsTerminal className="text-sm" />
                          <span className="text-sm">bash</span>
                        </div>
                        <div className="flex items-center rhs gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button>
                                  <BsLayoutSplit
                                    data-action="split"
                                    className="action-icon text-sm"
                                  />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <p className="p-1 rounded-md bg-[#3D445C]">
                                  split
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button>
                                  <RiDeleteBin6Line
                                    data-action="kill"
                                    className="action-icon text-sm"
                                  />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <p className="p-1 rounded-md bg-[#3D445C]">
                                  delete
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    );
                  }
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
