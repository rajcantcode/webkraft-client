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
import {
  GetObjectCommand,
  S3Client,
  SessionCredentials,
} from "@aws-sdk/client-s3";
interface Data {
  email: string;
  username: string;
}

interface LaodWorkspaceResponse {
  s3Creds: SessionCredentials | null | undefined;
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
  isS3Creds: boolean;
}) => {
  try {
    const { creator, workspaceName, isS3Creds, signal } = params;
    const body = { creator, workspaceName, isS3Creds };

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

export const getS3Creds = async () => {
  try {
    const workspaceName = useWorkspaceStore.getState().name;
    const { data } = await axios.get(
      `${baseUrl}/workspace/s3creds/${workspaceName}`,
      {
        withCredentials: true,
      }
    );
    return data as SessionCredentials;
  } catch (error) {
    console.error(error);
  }
};
export const loadFilesOfFolder = async (
  folder: TreeFolderNode,
  fileFetchStatus: { [key: string]: boolean },
  s3Creds?: SessionCredentials | null
) => {
  const fileContentObj: FileContentObj = {};
  const {
    setFilesContent,
    filesContent: currentFilesContent,
    s3Creds: s3CredsFromStore,
    setS3Creds,
  } = useWorkspaceStore.getState();
  const username = useUserStore.getState().username;
  s3Creds = s3Creds || s3CredsFromStore;
  if (
    !s3Creds ||
    !s3Creds.AccessKeyId ||
    !s3Creds.SecretAccessKey ||
    !s3Creds.SessionToken
  )
    return;

  const files = folder.children.filter(
    (child) =>
      child.type === "file" && currentFilesContent[child.path] === undefined
  );
  try {
    const s3Client = new S3Client({
      region: import.meta.env.VITE_S3_REGION!,
      credentials: {
        accessKeyId: s3Creds.AccessKeyId,
        secretAccessKey: s3Creds.SecretAccessKey,
        sessionToken: s3Creds.SessionToken,
      },
    });

    const getCommands = files.map((file) => {
      fileFetchStatus[file.path] = true;
      const command = new GetObjectCommand({
        Bucket: import.meta.env.VITE_BUCKET!,
        Key: `users/${username}/${file.path}`,
      });
      return s3Client.send(command).then(async (response) => {
        const data = await response.Body?.transformToString();
        if (data) {
          const fileExtension = file.name.split(".").pop();
          fileContentObj[file.path] = {
            name: file.name,
            content: data,
            language: fileExtension
              ? editorSupportedLanguages[fileExtension] || "text"
              : "text",
          };
        }
        fileFetchStatus[file.path] = false;
      });
    });
    await Promise.all(getCommands);
    setFilesContent({ ...currentFilesContent, ...fileContentObj });
    // const putCommands = ;
  } catch (error) {
    files.forEach((file) => {
      fileFetchStatus[file.path] = false;
    });
    if (error.name === "ExpiredToken") {
      console.log("S3 credentials expired");
      const newS3Creds = await getS3Creds();
      if (newS3Creds) {
        setS3Creds(newS3Creds);
        await loadFilesOfFolder(folder, fileFetchStatus, newS3Creds);
      }
    }
    console.error(error);
    throw error;
  }
};

export const getFileLanguage = (fileName: string): string => {
  const fileExtension = fileName.split(".").pop();
  return fileExtension
    ? editorSupportedLanguages[fileExtension] || "text"
    : "text";
};
export const loadFilesOfNodeModulesFolder = async (
  folder: TreeFolderNode,
  fileFetchStatus: { [key: string]: boolean },
  socket: Socket | null
) => {
  if (!socket) return;
  const fileContentObj: FileContentObj = {};
  const { setFilesContent, filesContent: currentFilesContent } =
    useWorkspaceStore.getState();
  const files = folder.children.filter(
    (child) =>
      child.type === "file" && currentFilesContent[child.path] === undefined
  );
  files.forEach((file, index) => {
    fileFetchStatus[file.path] = true;
    socket.emit(
      "get:files",
      { path: file.path },
      (
        error: { msg: string } | null,
        data: { content: string; end: boolean; stream: boolean } | null
      ) => {
        if (error) {
          console.error(error.msg);
          return;
        }
        if (data && data.content && data.end && !data.stream) {
          const fileExtension = file.name.split(".").pop();
          fileContentObj[file.path] = {
            name: file.name,
            content: data.content,
            language: fileExtension
              ? editorSupportedLanguages[fileExtension] || "text"
              : "text",
          };
          fileFetchStatus[file.path] = false;
        }
        if (index === files.length - 1) {
          setFilesContent({ ...currentFilesContent, ...fileContentObj });
        }
      }
    );
  });
};
export const loadFilesOfNodeModulesFolder2 = async (
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
    console.error(error);
    throw error;
  }
};

export const loadFile = async (
  path: string,
  name: string,
  fileFetchStatus: { [key: string]: boolean }
) => {
  const { setFilesContent, filesContent, s3Creds, setS3Creds } =
    useWorkspaceStore.getState();
  const username = useUserStore.getState().username;
  if (
    !s3Creds ||
    !s3Creds.AccessKeyId ||
    !s3Creds.SecretAccessKey ||
    !s3Creds.SessionToken
  )
    return;
  try {
    fileFetchStatus[path] = true;
    const s3Client = new S3Client({
      region: import.meta.env.VITE_S3_REGION!,
      credentials: {
        accessKeyId: s3Creds.AccessKeyId,
        secretAccessKey: s3Creds.SecretAccessKey,
        sessionToken: s3Creds.SessionToken,
      },
    });
    const command = new GetObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET!,
      Key: `users/${username}/${path}`,
    });
    const response = await s3Client.send(command);
    const data = await response.Body?.transformToString();
    if (data) {
      const fileExtension = name.split(".").pop();
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
      });
    }
    fileFetchStatus[path] = false;
  } catch (error) {
    fileFetchStatus[path] = false;
    if (error.name === "ExpiredToken") {
      console.log("S3 credentials expired");
      const newS3Creds = await getS3Creds();
      if (newS3Creds) {
        setS3Creds(newS3Creds);
        await loadFile(path, name, fileFetchStatus);
      }
    }
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
