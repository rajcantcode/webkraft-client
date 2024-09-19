import axios from "axios";
import { baseUrl } from "./constants";
import { TreeNode } from "./constants";

interface Data {
  email: string;
  username: string;
}

interface LaodWorkspaceResponse {
  workspaceLink?: string;
  fileTree: TreeNode;
}

export const verifyUser = async () => {
  const { data } = await axios.get(`${baseUrl}/auth`, {
    withCredentials: true,
  });
  return data as Data;
};

export const loadWorkspace = async (params: {
  creator: string;
  workspaceName: string;
  workspaceLink?: string;
}) => {
  const { creator, workspaceName, workspaceLink } = params;
  const body = workspaceLink
    ? { creator, workspaceName, workspaceLink }
    : { creator, workspaceName };
  const { data } = await axios.post(`${baseUrl}/workspace/load`, body, {
    withCredentials: true,
  });
  return data as LaodWorkspaceResponse;
};
