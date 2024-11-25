import { useCallback, useEffect, useRef, useState } from "react";
import Console from "../components/Console";
import Editor from "../components/Editor";
import FileTree from "../components/FileTree";
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
import { useLifecycles } from "react-use";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { TreeNode } from "../constants";
import { io, ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import { link } from "fs";

let init = true;

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
  const setFileStructure = useWorkspaceStore((state) => state.setFileStructure);
  const [fileStructureReceived, setFileStructureReceived] = useState(false);
  const [consoleSize, setConsoleSize] = useState(25);
  // const socketRef = useRef<Socket | null>(null);
  const [socketLink, setSocketLink] = useState<string | null>(null);
  const socket = useSocketConnection(socketLink, {
    withCredentials: true,
    // @ts-ignore
    host: socketLink,
  });

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

  const request = debounce((size: number) => {
    setConsoleSize(size);
  }, 200);

  const handleConsoleResize = useCallback(
    (size: number) => {
      request(size);
    },
    [setConsoleSize]
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
      let fileTreeCopy: TreeNode;
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
    if (!socket) return;

    const handleReady = async (data: { fileStructure: TreeNode }) => {
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
    return (
      <div className="h-full bg-orange-400">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel
            defaultSize={20}
            minSize={15}
            maxSize={50}
            collapsible={true}
            order={1}
          >
            <FileTree
              padLeft={8}
              fileFetchStatus={fileFetchStatus.current}
              socket={socket}
            />
          </ResizablePanel>
          <ResizableHandle withHandle={true} />
          <ResizablePanel defaultSize={80} order={2}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={75} order={1}>
                <Editor
                  fileFetchStatus={fileFetchStatus.current}
                  socket={socket}
                />
              </ResizablePanel>
              <ResizableHandle withHandle={true} />
              <ResizablePanel
                defaultSize={25}
                order={2}
                onResize={handleConsoleResize}
              >
                <Console socket={socket} size={consoleSize} />
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
