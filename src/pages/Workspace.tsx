import { useEffect } from "react";
import Console from "../components/Console";
import Editor from "../components/Editor";
import FileTree from "../components/FileTree";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/Resizable";
import { useUserStore, useWorkspaceStore } from "../store";
import { loadWorkspace, verifyUser } from "../helpers";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

// let init = true;
const Workspace = () => {
  const { username, email } = useUserStore((state) => ({
    username: state.username,
    email: state.email,
  }));
  const {
    name: workspaceName,
    link: workspaceLink,
    setWorkspaceData,
  } = useWorkspaceStore((state) => state);
  const { username: creator, workspacename: pathWorkspaceName } = useParams();

  const {
    isFetching: verificationPending,
    data,
    error,
  } = useQuery({
    queryKey: ["auth"],
    queryFn: verifyUser,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: !username || !email,
    retry: false,
  });

  const {
    mutate: loadWorkspaceRequest,
    isPending: workspaceLoading,
    isSuccess: workspaceLoaded,
  } = useMutation({
    mutationFn: loadWorkspace,
    onSuccess: (data) => {
      if (data.workspaceLink) {
        console.log(data.workspaceLink);
        setWorkspaceData(pathWorkspaceName!, data.workspaceLink, data.fileTree);
      } else {
        console.log("Load the workspace files from public cdn");
        console.log(workspaceLink);
      }
    },
    onError: (error) => {
      console.error(error);
    },
  });

  useEffect(() => {
    if (!username || !email) {
      return;
    }
    if (!workspaceLink) {
      console.log("set init to false when workspaceLink is not present");
      console.log(
        "making request to load workspace when workspaceLink is not present"
      );
      loadWorkspaceRequest({
        creator: creator!,
        workspaceName: pathWorkspaceName!,
      });
      // Make post request to the server to load workspace and get signed url
    }
    if (workspaceLink) {
      console.log("set init to false when workspaceLink is present");
      console.log(
        "making request to load workspace when workspaceLink is present"
      );
      loadWorkspaceRequest({
        creator: creator!,
        workspaceName: workspaceName,
        workspaceLink,
      });
      // Make request to the server to load workspace
    }
  }, [username, email]);

  // useEffect(() => {
  //   console.log("init value", init);
  // }, []);

  useEffect(() => {
    if (data) {
      const setUserData = useUserStore.getState().setUserData;
      setUserData(data.email, data.username);
    }
  }, [data]);

  if (verificationPending) {
    return <div>Verifying user, please wait</div>;
  }
  if (workspaceLoading) {
    return <div>Loading workspace, please wait</div>;
  }
  if (error) {
    return <div>Error verifying user</div>;
  }
  if (workspaceLoaded) {
    return (
      <div className="h-full bg-orange-400">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel
            defaultSize={20}
            minSize={15}
            maxSize={50}
            collapsible={true}
          >
            <FileTree padLeft={20} />
          </ResizablePanel>
          <ResizableHandle withHandle={true} />
          <ResizablePanel defaultSize={75}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={75}>
                <Editor />
              </ResizablePanel>
              <ResizableHandle withHandle={true} />
              <ResizablePanel defaultSize={25}>
                <Console />
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
