import { TreeNode } from "../constants";
import TreeFile from "./TreeFile";
import {
  AiOutlineFolderAdd,
  AiOutlineFileAdd,
  AiOutlineDelete,
  AiOutlineEdit,
} from "react-icons/ai";
import { IoMdSend } from "react-icons/io";
import {
  checkIfNameIsUnique,
  checkIfNameIsValid,
  getFolderIcon,
  moveNodes,
} from "../lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "./ui/Input";
import DeleteFolderModal from "./DeleteConfirmationModal";
import { loadFilesOfFolder, loadFilesOfNodeModulesFolder } from "../helpers";

type HandleRename = (
  node: TreeNode,
  newName: string,
  type: "file" | "folder"
) => void;
type HandleMoveNodes = (sourcePath: string, destinationPath: string) => void;
type HandleDelete = (path: string, type: "file" | "folder") => void;
type HandleAddFile = (node: TreeNode, fileName: string) => void;
type HandleAddFolder = (node: TreeNode, folderName: string) => void;
type CheckRenameValueIsUnique = (renameValue: string) => boolean;
type InputState = {
  operation: "rename" | "add-file" | "add-folder";
  value: string;
  show: boolean;
  error: string;
};

const TreeFolder = ({
  node,
  padLeft,
  open = false,
  handleRename,
  handleDelete,
  handleAddFile,
  handleAddFolder,
  handleMoveNodes,
  checkRenameValueIsUnique,
  fileFetchStatus,
  socketLink,
}: {
  node: TreeNode;
  padLeft: Number;
  open: boolean;
  handleRename: HandleRename;
  handleDelete: HandleDelete;
  handleAddFile: HandleAddFile;
  handleAddFolder: HandleAddFolder;
  handleMoveNodes: HandleMoveNodes;
  checkRenameValueIsUnique: CheckRenameValueIsUnique;
  fileFetchStatus: { [key: string]: boolean };
  socketLink: string;
}) => {
  const [isOpen, setIsOpen] = useState(open);
  const [inputState, setInputState] = useState<InputState>({
    operation: "rename",
    value: "",
    show: false,
    error: "",
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<{
    dragCounter: number;
    set: boolean;
    id: NodeJS.Timeout | null;
  }>({
    dragCounter: 0,
    set: false,
    id: null,
  });
  const deleteFolderModalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (inputState.show && inputRef.current) {
      inputRef.current.select();
    }
  }, [inputState.show]);

  if (node.type === "file") {
    return "Not a folder";
  }

  // This function will not be used in the component itself, but will be used by the child component.
  // This is because, when the user is typing the new name, we need to check on each new character if the name is unique, and to check directly in that component would require to find the parent node, to find parent node on each character change is not efficient. So, we will pass this function to the child component and this function will have the parent node already.
  const checkRenameNodeIsUnique = useCallback(
    (renameValue: string) => {
      return checkIfNameIsUnique(node, renameValue);
    },
    [node]
  );

  const handleFolderClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    e.stopPropagation();

    const actionSelected = (e.target as Element)
      .closest(".action-icon")
      ?.getAttribute("data-action");
    if (actionSelected) {
      if (
        !isOpen &&
        actionSelected !== "del-folder" &&
        actionSelected !== "rename"
      ) {
        setIsOpen(true);
      }
      switch (actionSelected) {
        case "rename":
          setInputState({
            operation: "rename",
            value: node.name,
            show: true,
            error: "",
          });
          // handleRename();
          return;
        case "add-file":
          setInputState({
            operation: "add-file",
            value: "",
            show: true,
            error: "",
          });
          // handleAddFile();
          return;
        case "add-folder":
          setInputState({
            operation: "add-folder",
            value: "",
            show: true,
            error: "",
          });
          // handleAddFolder();
          return;
        case "del-folder":
          deleteFolderModalRef.current?.showModal();
          return;
        default:
          return;
      }
    } else {
      if (inputState.show) return;
      if (!isOpen && node.children.length > 0) {
        if (node.path.includes("node_modules")) {
          loadFilesOfNodeModulesFolder(node, fileFetchStatus, socketLink);
        } else {
          loadFilesOfFolder(node, fileFetchStatus);
        }
      }
      setIsOpen(!isOpen);
      return;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const isNameValid = checkIfNameIsValid(e.target.value);
    if (!isNameValid) {
      setInputState((prev) => ({
        ...prev,
        value: e.target.value,
        error: `The name ${e.target.value} is not valid. Please choose a different name.`,
      }));
      return;
    }
    if (
      inputState.operation === "add-file" ||
      inputState.operation === "add-folder"
    ) {
      const isNameUnique = checkIfNameIsUnique(node, e.target.value);
      if (!isNameUnique) {
        setInputState((prev) => ({
          ...prev,
          value: e.target.value,
          error: `A file or folder ${e.target.value} already exists at this location. Please choose a different name.`,
        }));
        return;
      }
    } else {
      const isNameUnique = checkRenameValueIsUnique(e.target.value);
      if (!isNameUnique) {
        setInputState((prev) => ({
          ...prev,
          value: e.target.value,
          error: `A file or folder ${e.target.value} already exists at this location. Please choose a different name.`,
        }));
        return;
      }
    }
    setInputState((prev) => ({ ...prev, value: e.target.value, error: "" }));
  };

  const handleInputSubmit = useCallback(
    (
      operation: "rename" | "add-file" | "add-folder",
      value: string,
      e?: React.FormEvent<HTMLFormElement>
    ) => {
      e?.stopPropagation();
      e?.preventDefault();
      try {
        if (operation === "rename") {
          handleRename(node, value, node.type);
        }
        if (operation === "add-file") {
          handleAddFile(node, value);
        }
        if (operation === "add-folder") {
          handleAddFolder(node, value);
        }
        setInputState({
          operation: "rename",
          value: "",
          show: false,
          error: "",
        });
      } catch (error: unknown) {
        // If we don't have e that means user has clicked outside the input, which invoked handleInputSubmit, but we don't want to show error in that case, and also hide the input
        if (!e) {
          setInputState({
            operation: "rename",
            value: "",
            show: false,
            error: "",
          });
        }
        setInputState((prev) => ({
          ...prev,
          error: (error as Error).message,
        }));
        console.error((error as Error).message);
      }
    },
    [node]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      // Clear the timeout on drop event
      if (timer.current.set && timer.current.id) {
        clearTimeout(timer.current.id);
        timer.current.id = null;
        timer.current.set = false;
      }
      console.log("Drop event received");
      const path = e.dataTransfer.getData("text/plain");
      const pathExcludingName = path.split("/").slice(0, -1).join("/");
      if (pathExcludingName === node.path) {
        console.log("Cannot move the file/folder to the same location");
        return;
      }

      const name = path.split("/").pop();
      if (!name) return;
      const isNameUnique = checkIfNameIsUnique(node, name);
      if (!isNameUnique) {
        // ToDo -> Dislay a modal which will ask user to replace the file/folder with the same name, i.e overwrite
        return;
      }
      const isNameValid = checkIfNameIsValid(name);
      if (!isNameValid) {
        // ToDo -> Display error message
        return;
      }
      handleMoveNodes(path, node.path);
    },
    [node]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      timer.current.dragCounter += 1;
      if (timer.current.dragCounter === 1) {
        if (!isOpen && !timer.current.set) {
          timer.current.set = true;
          timer.current.id = setTimeout(() => {
            setIsOpen(true);
          }, 400);
        }
      }
    },
    [isOpen, setIsOpen]
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    timer.current.dragCounter -= 1;
    if (timer.current.dragCounter === 0) {
      if (timer.current.set && timer.current.id) {
        clearTimeout(timer.current.id);
        timer.current.set = false;
        timer.current.id = null;
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("text/plain", node.path);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const { icon, openIcon } = getFolderIcon(node.name);
  return (
    <div
      className="w-full folder-container"
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div
        className="flex items-center justify-between py-[1px] pr-1 folder-details group min-h-[32px] sm:min-h-[24px] text-sm hover:bg-[#1C2333] focus:bg-[#1C2333] focus:shadow-[0_0_0_2px_#0079F2] rounded-md px-1 w-[99%] mt-1.5"
        onClick={handleFolderClick}
        draggable={!inputState.show}
        onDragStart={handleDragStart}
        tabIndex={0}
      >
        {inputState.show && inputState.operation === "rename" ? (
          <form
            onSubmit={(e) => handleInputSubmit("rename", inputState.value, e)}
            className="relative z-10 w-full"
          >
            <div className="flex items-center w-full gap-2">
              <Input
                type="text"
                value={inputState.value}
                onChange={handleInputChange}
                onBlur={() => handleInputSubmit("rename", inputState.value)}
                autoFocus={true}
                ref={inputRef}
                className="w-full"
              />
              <button type="submit" className="p-1 border-none sm:hidden">
                <IoMdSend />
              </button>
            </div>
            {inputState.error ? (
              <p className="absolute left-0 text-xs text-white bg-[#5A1D1D] top-[calc(100%+5px)] rounded-md border border-[#BE1000] p-1 z-50">
                {inputState.error}
              </p>
            ) : null}
          </form>
        ) : (
          <>
            <div className="flex items-center gap-2 name w-[calc(100%-80px)] sm:w-full sm:group-hover:w-[calc(100%-80px)]">
              <img src={isOpen ? openIcon : icon} alt="" className="w-4 h-4" />
              <p className="overflow-hidden text-ellipsis whitespace-nowrap">
                {node.name}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:transition-opacity duration-200 sm:opacity-0 actions-container sm:group-hover:opacity-100 sm:max-w-0 sm:group-hover:max-w-[80px] flex-nowrap max-w-[80px]">
              <AiOutlineEdit
                data-action="rename"
                className="transition-transform hover:scale-[1.1] scale-100 action-icon"
              />
              <AiOutlineFileAdd
                data-action="add-file"
                className="transition-transform hover:scale-[1.1] scale-100 action-icon"
              />
              <AiOutlineFolderAdd
                data-action="add-folder"
                className="transition-transform hover:scale-[1.1] scale-100 action-icon"
              />
              <AiOutlineDelete
                data-action="del-folder"
                className="transition-transform hover:scale-[1.1] scale-100 action-icon"
              />
            </div>
          </>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <div
          className={`children border-l border-[#2A3244] overflow-y-hidden overflow-x-hidden`}
          style={{
            paddingLeft: `${padLeft}px`,
            paddingBottom: isOpen ? "5px" : "0px",
            maxHeight: isOpen ? "10000px" : "0px",
            transition: "max-height 0.75s ease",
          }}
        >
          {node.children.map((child) => {
            if (child.type === "folder") {
              return (
                <TreeFolder
                  node={child}
                  padLeft={padLeft}
                  open={false}
                  key={child.name}
                  handleRename={handleRename}
                  handleDelete={handleDelete}
                  handleAddFile={handleAddFile}
                  handleAddFolder={handleAddFolder}
                  handleMoveNodes={handleMoveNodes}
                  checkRenameValueIsUnique={checkRenameNodeIsUnique}
                  fileFetchStatus={fileFetchStatus}
                  socketLink={socketLink}
                />
              );
            }
            if (child.type === "file") {
              return (
                <TreeFile
                  node={child}
                  key={child.name}
                  handleRename={handleRename}
                  handleDelete={handleDelete}
                  checkRenameValueIsUnique={checkRenameNodeIsUnique}
                />
              );
            }
          })}
        </div>
      )}
      {inputState.show &&
      (inputState.operation === "add-file" ||
        inputState.operation === "add-folder") ? (
        <form
          onSubmit={() =>
            handleInputSubmit(inputState.operation, inputState.value)
          }
          className="relative w-full"
        >
          <div className="flex items-center w-full gap-2">
            <Input
              type="text"
              value={inputState.value}
              onChange={handleInputChange}
              onBlur={() =>
                handleInputSubmit(inputState.operation, inputState.value)
              }
              autoFocus={true}
              className="w-full"
            />
            <button type="submit" className="p-1 border-none sm:hidden">
              <IoMdSend />
            </button>
          </div>
          {inputState.error ? (
            <p className="absolute left-0 text-xs text-white bg-[#5A1D1D] top-[calc(100%+5px)] rounded-md border border-[#BE1000] p-1 z-10">
              {inputState.error}
            </p>
          ) : null}
        </form>
      ) : null}
      <dialog
        ref={deleteFolderModalRef}
        className="border shadow-[0px_8px_16px_0px_rgba(2, 2, 3, 0.32)] border-[#3C445C] rounded-md"
      >
        <DeleteFolderModal
          type={node.type}
          name={node.name}
          modalRef={deleteFolderModalRef}
          path={node.path}
          handleDelete={handleDelete}
        />
      </dialog>
    </div>
  );
};

export default TreeFolder;
