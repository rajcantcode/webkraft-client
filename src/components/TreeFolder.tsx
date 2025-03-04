import { FlattenedTreeFolderNode } from "../constants";
import {
  AiOutlineFolderAdd,
  AiOutlineFileAdd,
  AiOutlineDelete,
  AiOutlineEdit,
} from "react-icons/ai";
import { IoMdSend } from "react-icons/io";
import { checkIfNameIsValid, getFolderIcon } from "../lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "./ui/Input";
import DeleteFolderModal from "./DeleteConfirmationModal";
import { createPortal } from "react-dom";
import { TooltipWrapper } from "./ui/ToolTip";
import { useWorkspaceStore } from "../store";

type HandleRename = (
  pni: number,
  depth: number,
  path: string,
  newName: string,
  type: "file" | "folder"
) => void;
type HandleMoveNodes = (sourcePath: string, destinationPath: string) => void;
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
type InputState = {
  value: string;
  show: boolean;
  error: string;
};
type GetChildren = (path: string, depth: number) => void;
type InsertInputNode = (
  index: number,
  operation: "add-file" | "add-folder",
  depth: number
) => void;
type DeleteNamesSet = (parentIndex: number) => void;
type ExpandNode = (path: string) => void;
type CloseNode = (path: string) => void;

const itemSize = window.innerWidth > 768 ? 24 : 32;

const TreeFolder = ({
  node,
  padLeft,
  height,
  start,
  handleRename,
  handleDelete,
  handleMoveNodes,
  checkIfNameIsUnique,
  getChildren,
  insertInputNode,
  expandNode,
  closeNode,
  deleteNamesSet,
  isNodeModulesChildrenReceived,
  showEditOptions,
  scrollRef,
  workspaceRef,
}: {
  node: FlattenedTreeFolderNode;
  padLeft: number;
  height: number;
  start: number;
  handleRename: HandleRename;
  handleDelete: HandleDelete;
  handleMoveNodes: HandleMoveNodes;
  checkIfNameIsUnique: CheckIfNameIsUnique;
  getChildren: GetChildren;
  insertInputNode: InsertInputNode;
  expandNode: ExpandNode;
  closeNode: CloseNode;
  deleteNamesSet: DeleteNamesSet;
  isNodeModulesChildrenReceived: React.MutableRefObject<{
    [path: string]: boolean;
  }>;
  showEditOptions: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  workspaceRef: React.RefObject<HTMLDivElement> | null;
}) => {
  const { isExpanded: isOpen } = node;
  const [inputState, setInputState] = useState<InputState>({
    value: "",
    show: false,
    error: "",
  });
  const workspaceName = useWorkspaceStore((state) => state.name);
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
        console.log("Node is not expanded, expanding the node");
        expandNode(node.path);
        // if (actionSelected === "add-file") {
        //   insertInputNode(node.index, "add-file", node.depth);
        // } else if (actionSelected === "add-folder") {
        //   insertInputNode(node.index, "add-folder", node.depth);
        // }
      }
      switch (actionSelected) {
        case "rename":
          setInputState({
            value: node.name,
            show: true,
            error: "",
          });
          // handleRename();
          return;
        case "add-file":
          insertInputNode(node.index, "add-file", node.depth);
          // handleAddFile();
          return;
        case "add-folder":
          insertInputNode(node.index, "add-folder", node.depth);
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
      if (!isOpen) {
        if (
          node.path.includes("node_modules") &&
          !isNodeModulesChildrenReceived.current[node.path]
        ) {
          // This function will fetch children structure, then set isExpanded to true,set isNodeModulesChildrenReceived to true, expand the node
          getChildren(node.path, node.depth);
          return;
        }
        expandNode(node.path);
      } else {
        closeNode(node.path);
        return;
      }
    }
  };

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const isNameUnique = checkIfNameIsUnique(
        node.pni,
        node.depth,
        e.target.value
      );
      if (!isNameUnique) {
        setInputState((prev) => ({
          ...prev,
          value: e.target.value,
          error: `A file or folder ${e.target.value} already exists at this location. Please choose a different name.`,
        }));
        return;
      }
      setInputState((prev) => ({ ...prev, value: e.target.value, error: "" }));
    },
    [node, setInputState]
  );

  const handleInputSubmit = useCallback(
    (
      e:
        | React.FormEvent<HTMLFormElement>
        | React.FocusEvent<HTMLInputElement, Element>
    ) => {
      e?.stopPropagation();
      e?.preventDefault();

      if (inputState.error && e.type === "submit") return;
      if (inputState.error) {
        setInputState({
          value: "",
          show: false,
          error: "",
        });
        deleteNamesSet(node.pni);
        return;
      }
      try {
        handleRename(
          node.pni,
          node.depth,
          node.path,
          inputState.value,
          node.type
        );
        setInputState({
          value: "",
          show: false,
          error: "",
        });
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
    },
    [node, inputState, setInputState]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      // debugger;
      // Clear the timeout on drop event
      if (timer.current.set && timer.current.id) {
        clearTimeout(timer.current.id);
        timer.current.id = null;
        timer.current.set = false;
        timer.current.dragCounter = 0;
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
      const isNameValid = checkIfNameIsValid(name);
      if (!isNameValid) {
        // ToDo -> Display error message
        console.error("The name is not valid");
        return;
      }
      try {
        handleMoveNodes(path, node.path);
      } catch (error) {
        console.error(error);
      }
    },
    [node.path]
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
            if (!isOpen) {
              if (
                node.path.includes("node_modules") &&
                !isNodeModulesChildrenReceived.current[node.path]
              ) {
                getChildren(node.path, node.depth);
                return;
              }
              expandNode(node.path);
            }
          }, 400);
        }
      }
    },
    [node, isOpen]
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

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.currentTarget.style.boxShadow = "none";
      e.dataTransfer.setData("text/plain", node.path);
      e.currentTarget.style.opacity = "0.3";
      e.dataTransfer.effectAllowed = "move";
      (
        e.currentTarget.querySelector(".edit-options") as HTMLElement
      )?.style.setProperty("display", "none");
    },
    [node]
  );

  const handleDragEnd = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.removeProperty("box-shadow");
    console.log("drag end");
    e.currentTarget.style.opacity = "1";
    (
      e.currentTarget.querySelector(".edit-options") as HTMLElement
    )?.style.removeProperty("display");
  }, []);

  const { icon, openIcon } = getFolderIcon(node.name);
  return (
    <>
      <div
        className={`absolute top-0 left-0 folder-container p-[${padLeft}px] pr-1`}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          transform: `translateY(${start}px)`,
          height: `${height}px`,
          width: `calc(100% - ${padLeft}px)`,
          marginLeft: `${padLeft}px`,
        }}
      >
        <div
          className="flex items-center justify-between folder-details group text-sm hover:bg-[#1C2333] focus:bg-[#1C2333] focus:shadow-[0_0_0_2px_#0079F2] rounded-md w-[99%] px-1 ml-0.5 h-[90%]"
          onClick={handleFolderClick}
          draggable={workspaceName !== node.name && !inputState.show}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          tabIndex={0}
        >
          {inputState.show ? (
            <form
              onSubmit={handleInputSubmit}
              className="relative z-10 w-full h-full"
            >
              <div className="flex items-center w-full h-full gap-2">
                <Input
                  type="text"
                  value={inputState.value}
                  onChange={handleInputChange}
                  onBlur={handleInputSubmit}
                  autoFocus={true}
                  ref={inputRef}
                  className="w-full h-full p-2"
                />
                <button type="submit" className="p-1 border-none sm:hidden">
                  <IoMdSend />
                </button>
              </div>
              {inputState.error && scrollRef.current
                ? createPortal(
                    <div
                      className="absolute err-container"
                      style={{
                        transform: `translateY(${start + itemSize}px)`,
                        width: `calc(100% - ${padLeft}px)`,
                        marginLeft: `${padLeft}px`,
                      }}
                    >
                      <div
                        className={`pl-[${padLeft}px] flex items-center w-[98%] justify-between text-sm rounded-md px-1 ml-0.5 h-[90%]`}
                      >
                        <p
                          className={`text-xs text-white bg-[#5A1D1D] border border-[#BE1000] p-1 rounded-md w-full h-full `}
                        >
                          {inputState.error}
                        </p>
                      </div>
                    </div>,
                    scrollRef.current
                  )
                : null}
            </form>
          ) : (
            <>
              <div
                className={`flex items-center gap-2 name w-[calc(100%-80px)] sm:w-full ${
                  showEditOptions ? "sm:group-hover:w-[calc(100%-80px)]" : ""
                }`}
              >
                <img
                  src={isOpen ? openIcon : icon}
                  alt=""
                  className="w-4 h-4"
                />
                <p className="overflow-hidden text-ellipsis whitespace-nowrap">
                  {node.name}
                </p>
              </div>
              {showEditOptions ? (
                <div className="flex items-center gap-2 actions-container sm:group-hover:flex sm:hidden flex-nowrap max-w-[80px] edit-options">
                  <TooltipWrapper title="Rename" containerRef={workspaceRef}>
                    <div
                      data-action="rename"
                      className="transition-transform hover:scale-[1.1] scale-100 action-icon"
                    >
                      <AiOutlineEdit />
                    </div>
                  </TooltipWrapper>

                  <TooltipWrapper title="Add file" containerRef={workspaceRef}>
                    <div
                      data-action="add-file"
                      className="transition-transform hover:scale-[1.1] scale-100 action-icon"
                    >
                      <AiOutlineFileAdd />
                    </div>
                  </TooltipWrapper>

                  <TooltipWrapper
                    title="Add folder"
                    containerRef={workspaceRef}
                  >
                    <div
                      data-action="add-folder"
                      className="transition-transform hover:scale-[1.1] scale-100 action-icon"
                    >
                      <AiOutlineFolderAdd />
                    </div>
                  </TooltipWrapper>

                  <TooltipWrapper
                    title="Delete folder"
                    containerRef={workspaceRef}
                  >
                    <div
                      data-action="del-folder"
                      className="transition-transform hover:scale-[1.1] scale-100 action-icon"
                    >
                      <AiOutlineDelete />
                    </div>
                  </TooltipWrapper>
                </div>
              ) : null}
            </>
          )}
        </div>
        <dialog
          ref={deleteFolderModalRef}
          className="border shadow-[0px_8px_16px_0px_rgba(2, 2, 3, 0.32)] border-[#3C445C] rounded-md"
        >
          <DeleteFolderModal
            type={node.type}
            name={node.name}
            pni={node.pni}
            modalRef={deleteFolderModalRef}
            path={node.path}
            handleDelete={handleDelete}
          />
        </dialog>
      </div>
    </>
  );
};

export default TreeFolder;
