import { AiOutlineDelete, AiOutlineEdit } from "react-icons/ai";
import { checkIfNameIsValid, getFileIcon } from "../lib/utils";
import { FlattenedTreeFileNode } from "../constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "./ui/Input";
import DeleteFileModal from "./DeleteConfirmationModal";
import { IoMdSend } from "react-icons/io";
import { useWorkspaceStore } from "../store";

type HandleRename = (
  pni: number,
  depth: number,
  path: string,
  newName: string,
  type: "file" | "folder"
) => void;
type HandleDelete = (
  path: string,
  pni: number,
  type: "file" | "folder"
) => void;
type CheckIfNameIsUnique = (
  pni: number,
  depth: number,
  newName: string
) => boolean;
type RemoveInputNode = (pni: number) => void;
type DeleteNamesSet = (parentIndex: number) => void;
type HandleMoveNodes = (sourcePath: string, destinationPath: string) => void;

const TreeFile = ({
  node,
  padLeft,
  height,
  start,
  checkIfNameIsUnique,
  handleRename,
  handleDelete,
  handleMoveNodes,
  removeInputNode,
  deleteNamesSet,
}: {
  node: FlattenedTreeFileNode;
  padLeft: number;
  height: number;
  start: number;
  checkIfNameIsUnique: CheckIfNameIsUnique;
  handleRename: HandleRename;
  handleDelete: HandleDelete;
  handleMoveNodes: HandleMoveNodes;
  removeInputNode: RemoveInputNode;
  deleteNamesSet: DeleteNamesSet;
}) => {
  const [inputState, setInputState] = useState({
    show: false,
    value: "",
    error: "",
  });
  const selectedFilePath = useWorkspaceStore((state) => state.selectedFilePath);
  const setSelectedFilePath = useWorkspaceStore(
    (state) => state.setSelectedFilePath
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteFileModalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (inputState.show && inputRef.current) {
      const dotIndex = inputState.value.indexOf(".");
      if (dotIndex !== -1) {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [inputState.show]);

  const handleFileClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation();
      const actionSelected = (e.target as Element)
        .closest(".action-icon")
        ?.getAttribute("data-action");
      if (actionSelected) {
        switch (actionSelected) {
          case "rename":
            setInputState({ show: true, value: node.name, error: "" });
            return;
          case "del-file":
            deleteFileModalRef.current?.showModal();
            return;
        }
      } else {
        setSelectedFilePath(node.path);
      }
    },
    [node]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("text/plain", node.path);
      e.dataTransfer.effectAllowed = "copyMove";
    },
    [node]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (!checkIfNameIsValid(e.target.value)) {
      setInputState((prev) => ({
        ...prev,
        value: e.target.value,
        error: `The name ${e.target.value} is not valid. Please choose a different name.`,
      }));
      return;
    }
    if (!checkIfNameIsUnique(node.pni, node.depth, e.target.value)) {
      setInputState((prev) => ({
        ...prev,
        value: e.target.value,
        error: `A file or folder ${e.target.value} already exists at this location. Please choose a different name.`,
      }));
      return;
    }
    setInputState((prev) => ({ ...prev, value: e.target.value, error: "" }));
  };

  const handleInputSubmit = (
    e:
      | React.FormEvent<HTMLFormElement>
      | React.FocusEvent<HTMLInputElement, Element>
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (inputState.error && e.type === "submit") {
      return;
    }
    if (inputState.error) {
      setInputState({
        show: false,
        value: "",
        error: "",
      });
      deleteNamesSet(node.pni);
      return;
    }
    try {
      handleRename(node.pni, node.depth, node.path, inputState.value, "file");
      setInputState({ show: false, value: "", error: "" });
    } catch (error) {
      if (error && e.type !== "submit") {
        setInputState({
          show: false,
          value: "",
          error: "",
        });
      } else if (
        (error as Error).cause === "invalid-name" ||
        (error as Error).cause === "duplicate-name"
      ) {
        setInputState({
          show: true,
          value: inputState.value,
          error: (error as Error).message,
        });
      } else {
        console.error(error);
      }
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const path = e.dataTransfer.getData("text/plain");
      const pathExcludingName = path.split("/").slice(0, -1).join("/");
      if (pathExcludingName === node.path) {
        console.log("Cannot move the file/folder to the same location");
        return;
      }

      const name = path.split("/").pop();
      if (!name) return;
      const isNameValid = checkIfNameIsValid(name);
      if (!isNameValid) {
        // ToDo -> Display error message
        console.error("The name is not valid");
        return;
      }

      try {
        const parentPath = node.path.split("/").slice(0, -1).join("/");
        if (!parentPath) {
          handleMoveNodes(path, node.path);
        } else {
          handleMoveNodes(path, parentPath);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [node.path]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const icon = getFileIcon(node.name);

  return (
    <div
      className={`file-container absolute top-0 left-0`}
      style={{
        height: `${height}px`,
        transform: `translateY(${start}px)`,
        width: `calc(100% - ${padLeft}px)`,
        marginLeft: `${padLeft}px`,
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div
        className={`pl-[${padLeft}px] flex items-center w-[98%] file-details group justify-between text-sm ${
          selectedFilePath === node.path ? "bg-[#2B3245]" : ""
        } rounded-md hover:bg-[#1C2333] focus:shadow-[0_0_0_2px_#0079F2] px-1 ml-0.5 h-[90%]`}
        onClick={handleFileClick}
        tabIndex={0}
        draggable={!inputState.show}
        onDragStart={handleDragStart}
      >
        {inputState.show ? (
          <form
            className="relative w-full h-full bg-transparent"
            onSubmit={handleInputSubmit}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center w-full h-full gap-2">
              <Input
                type="text"
                value={inputState.value}
                onChange={handleInputChange}
                onBlur={handleInputSubmit}
                ref={inputRef}
                autoFocus={true}
                className="w-full h-full p-2"
              />
              <button type="submit" className="p-1 border-none sm:hidden">
                <IoMdSend />
              </button>
            </div>
            {inputState.error && (
              <p className="absolute left-0 text-xs text-white bg-[#5A1D1D] top-[calc(100%+5px)] rounded-md border border-[#BE1000] p-1 z-10">
                {inputState.error}
              </p>
            )}
          </form>
        ) : (
          <>
            <div className="flex items-center sm:w-full gap-2 name sm:group-hover:w-[calc(100%-40px)] w-[calc(100%-40px)]">
              <img src={icon} alt="" className="w-4 h-4" />
              <p className="overflow-hidden text-ellipsis whitespace-nowrap">
                {node.name}
              </p>
            </div>
            <div className="flex items-center gap-2 transition-opacity duration-200 sm:opacity-0 actions-container sm:group-hover:opacity-100 sm:max-w-0 sm:group-hover:max-w-[40px] flex-nowrap max-w-[40px]">
              <AiOutlineEdit
                data-action="rename"
                className="transition-transform hover:scale-[1.1] scale-100 action-icon"
              />
              <AiOutlineDelete
                data-action="del-file"
                className="transition-transform hover:scale-[1.1] scale-100 action-icon"
              />
            </div>
          </>
        )}
        <dialog
          ref={deleteFileModalRef}
          className="border shadow-[0px_8px_16px_0px_rgba(2, 2, 3, 0.32)] border-[#3C445C] rounded-md"
        >
          <DeleteFileModal
            type={node.type}
            name={node.name}
            modalRef={deleteFileModalRef}
            path={node.path}
            pni={node.pni}
            handleDelete={handleDelete}
          />
        </dialog>
      </div>
    </div>
  );
};

export default TreeFile;
