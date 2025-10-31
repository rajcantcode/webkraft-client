import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { MdOutlineReportGmailerrorred } from "react-icons/md";
import { MdCheckCircleOutline } from "react-icons/md";

import Editor from "../components/Editor";
import NoFileSelected from "../components/NoFileSelected";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/Resizable";
import { useUserStore, useWorkspaceStore } from "../store";
import {
  loadFilesOfFolder,
  loadWorkspace,
  stopWorkspace,
  verifyUser,
} from "../helpers";
import { baseUrl } from "../constants";
import debounce from "lodash.debounce";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { io, ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import { TreeFolderNode } from "../constants";
import TerminalContainer from "../components/TerminalContainer";
import { SidebarNav } from "../components/SidebarNav";
import { SideBar } from "../types/sidebar";
import { ProjectSearch } from "../components/ProjectSearch";
import { Vcs } from "../components/Vcs";
import { WorkspaceSettings } from "../components/WorkspaceSettings";
import { ImperativePanelHandle } from "react-resizable-panels";
import FileTreeWrapper from "../components/FileTree";
import LoadingSpinner from "../components/ui/LoadingSpinner";

function useSocketConnection(
  socketLink: string | null,
  options: Partial<ManagerOptions & SocketOptions>
) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!socketLink) return;

    const newSocket = io(socketLink, options);
    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [socketLink]);

  return socket;
}

const Workspace = () => {
  const username = useUserStore((state) => state.username);
  const email = useUserStore((state) => state.email);
  const workspaceName = useWorkspaceStore((state) => state.name);
  const workspaceLink = useWorkspaceStore((state) => state.link);
  const baseLink = useWorkspaceStore((state) => state.baseLink);
  const policy = useWorkspaceStore((state) => state.policy);
  const setWorkspaceData = useWorkspaceStore((state) => state.setWorkspaceData);
  const clearWorkspaceData = useWorkspaceStore(
    (state) => state.clearWorkspaceData
  );
  const editorIds = useWorkspaceStore((state) => state.editorIds);
  const setFileStructure = useWorkspaceStore((state) => state.setFileStructure);
  const shouldBeginExitWorkspaceProcess = useWorkspaceStore(
    (state) => state.shouldBeginExitWorkspaceProcess
  );
  const setShouldBeginExitWorkspaceProcess = useWorkspaceStore(
    (state) => state.setShouldBeginExitWorkspaceProcess
  );
  const [fileStructureReceived, setFileStructureReceived] = useState(false);
  const [terminalContainerSize, setTerminalContainerSize] = useState(25);
  // const socketRef = useRef<Socket | null>(null);
  const [socketLink, setSocketLink] = useState<string | null>(null);
  const [sidebarNavState, setSidebarNavState] = useState<SideBar>({
    files: true,
    search: false,
    vcs: false,
    settings: false,
  });
  const [showSidebar, setShowSidebar] = useState(true);
  const [exitModalMsgs, setExitModalMsgs] = useState<
    { state: "loading" | "error" | "done"; msg: string }[]
  >([
    { state: "loading", msg: "Uploading files to cloud" },
    { state: "loading", msg: "Shutting down workspace resources" },
  ]);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const socket = useSocketConnection(socketLink, {
    withCredentials: true,
    // @ts-ignore
    host: socketLink,
  });
  const isSocketAssignedRef = useRef(socket !== null);
  const navigate = useNavigate();
  const workspaceContainerRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);

  // Doing it this way beacause I don't want the state updates of fileStructure in this component. Just need the data once.
  const { fileStructure } = useWorkspaceStore.getState();
  // useLifecycles(
  //   () => {
  //     console.log("MOUNTED THIS COMPONENT!");
  //     console.log("workspaceLink at the top - ", workspaceLink);
  //     console.log(
  //       "workspaceLink at the top from store directly - ",
  //       useWorkspaceStore.getState().link
  //     );
  //   },
  //   () => console.log("UNMOUNTED THIS COMPONENT!")
  // );
  const { username: creator, workspacename: pathWorkspaceName } = useParams();

  const fileFetchStatus = useRef<{ [key: string]: boolean }>({});

  const { isFetching: verificationPending, error } = useQuery({
    queryKey: ["auth"],
    queryFn: verifyUser,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: !username || !email,
    retry: false,
  });

  const request = useMemo(
    () =>
      debounce((size: number) => {
        setTerminalContainerSize(size);
      }, 200),
    []
  );

  const handleConsoleResize = useCallback(
    (size: number) => {
      request(size);
    },
    [request]
  );

  const {
    mutate: loadWorkspaceRequest,
    isPending: workspaceLoading,
    isSuccess: workspaceLoaded,
  } = useMutation({
    mutationFn: loadWorkspace,
    onSuccess: async (data) => {
      if (!data) return;
      // const { link: workspaceLink } = useWorkspaceStore.getState();
      let workspaceLinkCopy: string;
      // let fileTreeCopy: TreeNode;
      let baseLinkCopy: string;
      let policyCopy: string;
      const socketLink = data.socketLink;
      if (!workspaceLink) {
        const linkSplit = data.workspaceLink!.split("?");
        baseLinkCopy = linkSplit[0]
          .slice(0, -2)
          .split("/")
          .slice(0, -2)
          .join("/");
        policyCopy = linkSplit[1];
        setWorkspaceData(
          pathWorkspaceName!,
          data.workspaceLink!,
          baseLinkCopy,
          policyCopy,
          null
        );
        workspaceLinkCopy = data.workspaceLink!;
        setSocketLink(socketLink);
        // fileTreeCopy = data.fileTree;
      } else {
        workspaceLinkCopy = workspaceLink;
        // fileTreeCopy = fileStructure![0]!;
        baseLinkCopy = baseLink;
        policyCopy = policy;
        setSocketLink(socketLink);
      }
      if (!data.isCreator) {
        // ToDo -> Show only the file structure and editor. No console. No editing of files.
        // Give option to fork the workspace.
      }
      // console.log(
      //   "checking socket in loadWorkspaceRequest - ",
      //   socketRef.current
      // );
      // const socket = io(socketLink, {
      //   withCredentials: true,
      //   host: socketLink,
      // });
      // socketRef.current = socket;
      // socket.on("ready", async (data: { fileStructure: TreeNode }) => {
      //   console.log("Received ready event from server");
      //   console.log(data.fileStructure);
      //   setFileStructure([data.fileStructure]);
      //   setFileStructureReceived(true);
      //   const result = await loadFilesOfFolder(
      //     data.fileStructure,
      //     fileFetchStatus.current,
      //     baseLinkCopy,
      //     policyCopy
      //   );
      // });
    },
    onError: (error) => {
      console.error(error);
    },
  });

  useEffect(() => {
    if (showSidebar) {
      sidebarPanelRef.current?.expand();
    } else {
      sidebarPanelRef.current?.collapse();
    }
  }, [showSidebar]);
  useEffect(() => {
    if (!socket) return;

    isSocketAssignedRef.current = true;

    const handleReady = async (data: { fileStructure: TreeFolderNode }) => {
      setFileStructure([data.fileStructure]);
      setFileStructureReceived(true);
      await loadFilesOfFolder(
        data.fileStructure,
        fileFetchStatus.current,
        baseLink,
        policy
      );
    };

    socket.on("ready", handleReady);

    return () => {
      socket.off("ready", handleReady);
    };
  }, [socket, baseLink, policy, setFileStructure]);

  const { mutate: stopWorkspaceRequest } = useMutation({
    mutationFn: async (workspaceName: string) => {
      setExitModalMsgs((prev) => [
        prev[0],
        { state: "loading", msg: "Shutting down workspace resources" },
      ]);
      const { data } = await axios.post(
        `${baseUrl}/workspace/stop`,
        { workspaceName },
        { withCredentials: true }
      );
      return data as { msg: string };
    },
    onSuccess: (data) => {
      if (data) {
        setExitModalMsgs((prev) => [
          prev[0],
          { state: "done", msg: prev[1].msg + "You will be redirected soon" },
        ]);
        setTimeout(() => {
          modalRef.current?.close();
          navigate("/home");
        }, 500);
        // modalRef.current?.close();
        // navigate("/");
      }
    },
    onError: (error) => {
      setExitModalMsgs((prev) => [
        prev[0],
        {
          state: "error",
          msg: "There was an error while shutting down the workspace, please try again",
        },
      ]);
      console.error(error);
    },
  });

  const emitStopWorkspaceToSocket = useCallback(
    (workspaceName: string, showModal = false) => {
      console.log("emitStopToWorkspace invoked");

      if (!socket) return;
      console.log("Emitting stop event for socket");
      console.log(socket.connected);
      if (showModal) {
        document.body.classList.add("dialog-open");
        setExitModalMsgs((prev) => [
          { state: "loading", msg: "Uploading files to cloud" },
          prev[1],
        ]);
        modalRef.current?.show();
      }

      socket.emit("stop", null, async (error: { msg: string } | null) => {
        if (error) {
          if (error.msg === "oversize") {
            setExitModalMsgs((prev) => [
              {
                state: "error",
                msg: "File size exceeds limit of 20mb. Make sure you don't have any large files and don't change the name of node_modules folder, after doing this, try again",
              },
              prev[1],
            ]);
          } else {
            setExitModalMsgs((prev) => [
              {
                state: "error",
                msg: "There was an error while backing up files, please try again",
              },
              prev[1],
            ]);
            if (modalRef.current) {
              modalRef.current.ariaModal = "open";
            }
            console.log("Try again");
          }
        } else {
          setExitModalMsgs((prev) => [
            {
              state: "done",
              msg: prev[0].msg,
            },
            prev[1],
          ]);
          stopWorkspaceRequest(workspaceName);
        }
      });
    },
    [socket, stopWorkspaceRequest, setExitModalMsgs]
  );

  useEffect(() => {
    if (shouldBeginExitWorkspaceProcess) {
      emitStopWorkspaceToSocket(workspaceName, true);
    }
  }, [
    shouldBeginExitWorkspaceProcess,
    emitStopWorkspaceToSocket,
    workspaceName,
  ]);

  const emitStopWorkspaceToSocketRef = useRef(emitStopWorkspaceToSocket);
  useEffect(() => {
    emitStopWorkspaceToSocketRef.current = emitStopWorkspaceToSocket;
  }, [emitStopWorkspaceToSocket]);

  useEffect(() => {
    if (!username || !email) {
      return;
    }
    const controller = new AbortController();
    const signal = controller.signal;
    const { link: workspaceLink, name: workspaceName } =
      useWorkspaceStore.getState();
    if (!workspaceLink) {
      loadWorkspaceRequest({
        signal,
        creator: creator!,
        workspaceName: pathWorkspaceName!,
      });
    }

    if (workspaceLink) {
      loadWorkspaceRequest({
        signal,
        creator: creator!,
        workspaceName: workspaceName,
        workspaceLink,
      });
    }

    return () => {
      if (!isSocketAssignedRef.current) {
        // if socket is connection is not yet initialized, then we can just directly make stopWorkspace request, as socket connection not being intialized implies that the container orchestration has not yet happened and we don't really need to care about backing up files of the workspace, so we can directly just call stopWorkspaceRequest
        stopWorkspaceRequest(useWorkspaceStore.getState().name);
      } else {
        // emitStopWorkspaceToSocket(useWorkspaceStore.getState().name);
        emitStopWorkspaceToSocketRef.current(useWorkspaceStore.getState().name);
      }

      controller.abort();
      // stopWorkspaceRequest(workspaceName);
      // clear all state of workspace
      clearWorkspaceData();

      // console.log("disconnecting socket");
      // console.log(socketRef.current);
      // socketRef.current?.disconnect();
    };
  }, [username, email]);

  const closeModal = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      console.log("close modal called");

      e.stopPropagation();
      console.log(modalRef.current);
      modalRef.current?.close();
    },
    [modalRef]
  );

  const handleCloseModal = useCallback(() => {
    document.body.classList.remove("dialog-open");
    if (exitModalMsgs[1].state === "error" && socket) {
      socket.emit("reset-upload-files-state");
    }
    setShouldBeginExitWorkspaceProcess(false);
    setExitModalMsgs([
      { state: "loading", msg: "Uploading files to cloud" },
      { state: "loading", msg: "Shutting down workspace resources" },
    ]);
  }, [
    setExitModalMsgs,
    exitModalMsgs,
    socket,
    setShouldBeginExitWorkspaceProcess,
  ]);

  const handleTryAgain = useCallback(() => {
    if (exitModalMsgs[0].state === "error") {
      emitStopWorkspaceToSocket(workspaceName);
      return;
    }
    if (exitModalMsgs[1].state === "error") {
      stopWorkspaceRequest(workspaceName);
      return;
    }
  }, [
    exitModalMsgs,
    emitStopWorkspaceToSocket,
    stopWorkspaceRequest,
    workspaceName,
  ]);

  if (verificationPending) {
    return <div>Verifying user, please wait</div>;
  }
  if (workspaceLoading) {
    return <div>Loading workspace, please wait</div>;
  }
  if (error) {
    return <div>Error verifying user</div>;
  }
  if (workspaceLoaded && fileStructureReceived) {
    const editorSize = 100 / editorIds.length;
    return (
      <>
        <dialog
          ref={modalRef}
          onClose={handleCloseModal}
          className="border shadow-[0px_8px_16px_0px_rgba(2, 2, 3, 0.32)] border-[#3C445C] rounded-md w-[50%] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto z-50 bg-[#1C2333] p-4"
        >
          <div className="flex items-center gap-2 msg-0">
            <div>
              {exitModalMsgs[0].state === "loading" ? (
                <LoadingSpinner />
              ) : exitModalMsgs[0].state === "error" ? (
                <MdOutlineReportGmailerrorred className="text-lg text-[#E52222]" />
              ) : (
                <MdCheckCircleOutline className="text-lg text-green-500" />
              )}
            </div>
            <p>{exitModalMsgs[0].msg}</p>
          </div>
          <div className="flex items-center gap-2 msg-1">
            <div>
              {exitModalMsgs[1].state === "loading" ? (
                <LoadingSpinner />
              ) : exitModalMsgs[1].state === "error" ? (
                <MdOutlineReportGmailerrorred className="text-lg text-[#E52222]" />
              ) : (
                <MdCheckCircleOutline className="text-lg text-green-500" />
              )}
            </div>
            <p color={exitModalMsgs[0].state === "error" ? "grey" : "white"}>
              {exitModalMsgs[1].msg}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 mt-7 btn-container">
            <button
              onClick={handleTryAgain}
              className="p-2 rounded-md cursor-pointer bg-[#0053A6] hover:bg-[#0079F2]"
              disabled={
                exitModalMsgs[0].state !== "error" &&
                exitModalMsgs[1].state !== "error"
              }
              style={{
                opacity:
                  exitModalMsgs[0].state !== "error" &&
                  exitModalMsgs[1].state !== "error"
                    ? "0.5"
                    : "1",
              }}
            >
              Try again
            </button>
            <button
              onClick={closeModal}
              className="p-2 rounded-md cursor-pointer bg-[#2B3245] hover:bg-[#3C445C]"
              disabled={
                exitModalMsgs[0].state !== "error" &&
                exitModalMsgs[1].state !== "error"
              }
              style={{
                opacity:
                  exitModalMsgs[0].state !== "error" &&
                  exitModalMsgs[1].state !== "error"
                    ? "0.5"
                    : "1",
              }}
            >
              Cancel
            </button>
          </div>
        </dialog>
        <div className="flex h-full bg-black" ref={workspaceContainerRef}>
          <SidebarNav
            sidebarNavState={sidebarNavState}
            setSidebarNavState={setSidebarNavState}
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
          />
          <ResizablePanelGroup
            direction="horizontal"
            className="w-[calc(100%-48px)]"
          >
            <ResizablePanel
              defaultSize={20}
              minSize={15}
              maxSize={50}
              collapsible={true}
              order={1}
              className="bg-[#171D2D]"
              ref={sidebarPanelRef}
              onCollapse={() => setShowSidebar(false)}
              onExpand={() => setShowSidebar(true)}
            >
              <FileTreeWrapper
                padLeft={8}
                fileFetchStatus={fileFetchStatus.current}
                socket={socket}
                workspaceRef={workspaceContainerRef}
                className={`${sidebarNavState.files ? "block" : "hidden"}`}
              />
              <ProjectSearch
                className={`${sidebarNavState.search ? "flex" : "hidden"}`}
                isVisible={sidebarNavState.search}
                socket={socket}
              />
              <Vcs className={`${sidebarNavState.vcs ? "flex" : "hidden"}`} />
              <WorkspaceSettings
                className={`${sidebarNavState.settings ? "block" : "hidden"}`}
              />
            </ResizablePanel>
            <ResizableHandle withHandle={true} direction="horizontal" />
            <ResizablePanel defaultSize={80} order={2}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={75} order={1}>
                  {editorIds.length > 0 ? (
                    <ResizablePanelGroup direction="horizontal">
                      {editorIds.map((id, i) => (
                        <React.Fragment key={id}>
                          <ResizablePanel
                            defaultSize={editorSize}
                            minSize={5}
                            order={i + 1}
                            key={id}
                            id={id}
                          >
                            <Editor
                              fileFetchStatus={fileFetchStatus.current}
                              socket={socket}
                              editorId={id}
                            />
                          </ResizablePanel>
                          {i + 1 !== editorIds.length && (
                            <ResizableHandle
                              withHandle={true}
                              direction="horizontal"
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </ResizablePanelGroup>
                  ) : (
                    <NoFileSelected />
                  )}
                </ResizablePanel>
                <ResizableHandle withHandle={true} direction="vertical" />
                <ResizablePanel
                  defaultSize={25}
                  order={2}
                  onResize={handleConsoleResize}
                >
                  <TerminalContainer
                    socket={socket}
                    defaultPid={"default"}
                    defaultTerminalContainerSize={terminalContainerSize}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </>
    );
  }
  return null;
};

export default Workspace;
