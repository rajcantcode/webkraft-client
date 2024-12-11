import axios from "axios";
import {
  baseUrl,
  editorSupportedLanguages,
  FileContent,
  FileContentObj,
  TreeFolderNode,
} from "./constants";
import { useUserStore, useWorkspaceStore } from "./store";
import { Socket } from "socket.io-client";

interface Data {
  email: string;
  username: string;
}

interface LaodWorkspaceResponse {
  workspaceLink?: string;
  socketLink: string;
  isCreator: boolean;
}

export const verifyUser = async () => {
  try {
    const { data } = await axios.get(`${baseUrl}/auth`, {
      withCredentials: true,
    });
    if (data && data.email && data.username) {
      const setUserData = useUserStore.getState().setUserData;
      setUserData(data.email, data.username);
      return data as Data;
    }
  } catch (error) {
    throw error;
  }
};

export const loadWorkspace = async (params: {
  signal: AbortSignal;
  creator: string;
  workspaceName: string;
  workspaceLink?: string;
}) => {
  try {
    const { creator, workspaceName, workspaceLink, signal } = params;
    const body = workspaceLink
      ? { creator, workspaceName, workspaceLink }
      : { creator, workspaceName };
    const { data } = await axios.post(`${baseUrl}/workspace/load`, body, {
      withCredentials: true,
      signal,
    });
    return data as LaodWorkspaceResponse;
  } catch (error) {
    if (axios.isCancel(error)) {
      console.log("Request canceled", error.message);
    } else {
      throw error;
    }
  }
};

export const stopWorkspace = async (workspaceName: string) => {
  try {
    const { data } = await axios.post(
      `${baseUrl}/workspace/stop`,
      { workspaceName },
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    throw error;
  }
};

export const loadFilesOfFolder = async (
  folder: TreeFolderNode,
  fileFetchStatus: { [key: string]: boolean },
  baseUrl?: string,
  policy?: string
) => {
  const fileContentObj: FileContentObj = {};
  const {
    setFilesContent,
    filesContent: currentFilesContent,
    baseLink,
    policy: baseLinkPolicy,
  } = useWorkspaceStore.getState();
  baseUrl = baseUrl || baseLink;
  policy = policy || baseLinkPolicy;
  try {
    const files = folder.children.filter(
      (child) =>
        child.type === "file" && currentFilesContent[child.path] === undefined
    );
    const fetchPromises = files.map(async (file) => {
      fileFetchStatus[file.path] = true;
      return axios.get(`${baseUrl}/${file.path}?${policy}`).then((response) => {
        let data = response.data;
        if (typeof data === "object") {
          data = JSON.stringify(data, null, 2);
        }
        const fileExtension = file.name.split(".").pop();
        fileContentObj[file.path] = {
          name: file.name,
          content: data,
          language: fileExtension
            ? editorSupportedLanguages[fileExtension] || "text"
            : "text",
        };
        fileFetchStatus[file.path] = false;
        return data;
      });
    });
    const filesContent = await Promise.all(fetchPromises);
    setFilesContent({ ...currentFilesContent, ...fileContentObj });
    return filesContent;
  } catch (error) {
    throw error;
  }
};

export const loadFilesOfNodeModulesFolder = async (
  folder: TreeFolderNode,
  fileFetchStatus: { [key: string]: boolean },
  socketLink: string
) => {
  const fileContentObj: FileContentObj = {};
  const { setFilesContent, filesContent: currentFilesContent } =
    useWorkspaceStore.getState();
  try {
    const files = folder.children.filter(
      (child) =>
        child.type === "file" && currentFilesContent[child.path] === undefined
    );
    const fetchPromises = files.map(async (file) => {
      fileFetchStatus[file.path] = true;
      return axios
        .get(`${socketLink}/file`, {
          params: { path: file.path },
          withCredentials: true,
          responseType: "text",
        })
        .then((response) => {
          const fileExtension = file.name.split(".").pop();
          fileContentObj[file.path] = {
            name: file.name,
            content: response.data,
            language: fileExtension
              ? editorSupportedLanguages[fileExtension] || "text"
              : "text",
          };
          fileFetchStatus[file.path] = false;
          return response.data;
        });
    });
    const filesContent = await Promise.all(fetchPromises);
    setFilesContent({ ...currentFilesContent, ...fileContentObj });
    return filesContent;
  } catch (error) {
    throw error;
  }
};

export const loadFile = async (
  path: string,
  name: string,
  fileFetchStatus: { [key: string]: boolean }
) => {
  const { setFilesContent, filesContent, baseLink, policy } =
    useWorkspaceStore.getState();
  try {
    fileFetchStatus[path] = true;
    const response = await axios.get(`${baseLink}/${path}?${policy}`);
    const data =
      typeof response.data === "object"
        ? JSON.stringify(response.data, null, 2)
        : response.data;
    const fileExtension = name.split(".").pop();
    fileFetchStatus[path] = false;
    setFilesContent({
      ...filesContent,
      // ...{
      [path]: {
        name: name,
        content: data,
        language: fileExtension
          ? editorSupportedLanguages[fileExtension] || "text"
          : "text",
      },
      // },
    });
  } catch (error) {
    console.error(error);
  }
};

export const sortNodeChildren = (node: TreeFolderNode) => {
  if (node.children.length === 0) return;
  node.children.sort((a, b) => {
    if (a.type === "folder" && b.type === "file") return -1;
    if (a.type === "file" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });
};

export const loadNodeModulesFile = async (
  path: string,
  name: string,
  fileFetchStatus: { [key: string]: boolean },
  socket: Socket
) => {
  const { setFilesContent, filesContent } = useWorkspaceStore.getState();
  const fileExtension = name.split(".").pop();
  let chunkStream: string = "";
  const handleFileChunk = (data: { chunk: string; filePath: string }) => {
    const { chunk, filePath } = data;
    if (filePath !== path) return;
    chunkStream += chunk;
  };
  socket.on("file:chunk", handleFileChunk);
  try {
    fileFetchStatus[path] = true;
    socket.emit(
      "get:file",
      { path },
      (error: Error | null, data: { content: string | null; end: boolean }) => {
        if (error) {
          throw error;
        }
        const { content, end } = data;
        if (content && end) {
          setFilesContent({
            ...filesContent,
            [path]: {
              name,
              content,
              language: fileExtension
                ? editorSupportedLanguages[fileExtension] || "text"
                : "text",
            },
          });
          return;
        }
        if (!content && end) {
          setFilesContent({
            ...filesContent,
            [path]: {
              name,
              content: chunkStream,
              language: fileExtension
                ? editorSupportedLanguages[fileExtension] || "text"
                : "text",
            },
          });
        }
      }
    );
  } catch (error) {
    console.error(error);
  } finally {
    socket.off("file:chunk", handleFileChunk);
    fileFetchStatus[path] = false;
  }
};
