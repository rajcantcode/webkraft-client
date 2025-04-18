import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import debounce from "lodash.debounce";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
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
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const socket = useSocketConnection(socketLink, {
    withCredentials: true,
    // @ts-ignore
    host: socketLink,
  });

  const workspaceContainerRef = useRef<HTMLDivElement | null>(null);

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
    mutationFn: stopWorkspace,
    onError: (error) => {
      console.error(error);
    },
  });

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
      stopWorkspaceRequest(useWorkspaceStore.getState().name);
      controller.abort();
      // stopWorkspaceRequest(workspaceName);
      // clear all state of workspace
      clearWorkspaceData();
      // console.log("disconnecting socket");
      // console.log(socketRef.current);
      // socketRef.current?.disconnect();
    };
  }, [username, email]);

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
    );
  }
  return null;
};

export default Workspace;
