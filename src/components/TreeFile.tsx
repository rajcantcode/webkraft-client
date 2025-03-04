import { AiOutlineDelete, AiOutlineEdit } from "react-icons/ai";
import { checkIfNameIsValid, getFileIcon } from "../lib/utils";
import { FlattenedTreeFileNode } from "../constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "./ui/Input";
import DeleteFileModal from "./DeleteConfirmationModal";
import { IoMdSend } from "react-icons/io";
import { useWorkspaceStore } from "../store";
import { createPortal } from "react-dom";
import { nanoid } from "nanoid";
import { TooltipWrapper } from "./ui/ToolTip";

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
type DeleteNamesSet = (parentIndex: number) => void;
type HandleMoveNodes = (sourcePath: string, destinationPath: string) => void;

const itemSize = window.innerWidth > 768 ? 24 : 32;

const TreeFile = ({
  node,
  padLeft,
  height,
  start,
  checkIfNameIsUnique,
  handleRename,
  handleDelete,
  handleMoveNodes,
  deleteNamesSet,
  showEditOptions,
  scrollRef,
  workspaceRef,
}: {
  node: FlattenedTreeFileNode;
  padLeft: number;
  height: number;
  start: number;
  checkIfNameIsUnique: CheckIfNameIsUnique;
  handleRename: HandleRename;
  handleDelete: HandleDelete;
  handleMoveNodes: HandleMoveNodes;
  deleteNamesSet: DeleteNamesSet;
  showEditOptions: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  workspaceRef: React.RefObject<HTMLDivElement> | null;
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
  const activeEditorId = useWorkspaceStore((state) => state.activeEditorId);
  const setActiveEditorId = useWorkspaceStore(
    (state) => state.setActiveEditorId
  );
  const setEditorIds = useWorkspaceStore((state) => state.setEditorIds);
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
        if (activeEditorId) {
          setSelectedFilePath((prev) => ({
            ...prev,
            [activeEditorId]: node.path,
          }));
        } else {
          const newEditorId = nanoid(4);
          setActiveEditorId(newEditorId);
          setEditorIds((prev) => [...prev, newEditorId]);
          setSelectedFilePath((prev) => ({
            ...prev,
            [newEditorId]: node.path,
          }));
          // setFileTabs((prev) => ({
          //   ...prev,
          //   [newEditorId]: [],
          // }));
          // setLastSelectedFilePaths((prev) => ({ ...prev, [newEditorId]: [] }));
        }
        // setSelectedFilePath(node.path);
      }
    },
    [node, activeEditorId, setActiveEditorId, setEditorIds, setSelectedFilePath]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.currentTarget.style.boxShadow = "none";
      e.dataTransfer.setData("text/plain", node.path);
      e.currentTarget.style.opacity = "0.3";
      e.dataTransfer.effectAllowed = "copyMove";
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
        className={`pl-[${padLeft}px] flex items-center w-[98%] file-details group justify-between text-sm transition-opacity duration-200 ${
          selectedFilePath[activeEditorId] === node.path ? "bg-[#2B3245]" : ""
        } rounded-md hover:bg-[#1C2333] focus:shadow-[0_0_0_2px_#0079F2] px-1 ml-0.5 h-[90%]`}
        onClick={handleFileClick}
        tabIndex={0}
        draggable={!inputState.show}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {inputState.show ? (
          <form
            className="z-10 w-full h-full bg-transparent"
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
            {inputState.error &&
              scrollRef.current &&
              createPortal(
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
              )}
          </form>
        ) : (
          <>
            <div
              className={`flex items-center sm:w-full gap-2 name ${
                showEditOptions ? "sm:group-hover:w-[calc(100%-80px)]" : ""
              } w-[calc(100%-40px)]`}
            >
              <img src={icon} alt="" className="w-4 h-4" />
              <p className="overflow-hidden text-ellipsis whitespace-nowrap">
                {node.name}
              </p>
            </div>
            {showEditOptions ? (
              <div className="flex items-center gap-2 actions-container sm:hidden sm:group-hover:flex flex-nowrap max-w-[40px] edit-options">
                <TooltipWrapper title="Rename" containerRef={workspaceRef}>
                  <div
                    data-action="rename"
                    className="transition-transform hover:scale-[1.1] scale-100 action-icon"
                  >
                    <AiOutlineEdit />
                  </div>
                </TooltipWrapper>

                <TooltipWrapper title="Delete file" containerRef={workspaceRef}>
                  <div
                    data-action="del-file"
                    className="transition-transform hover:scale-[1.1] scale-100 action-icon"
                  >
                    <AiOutlineDelete />
                  </div>
                </TooltipWrapper>
              </div>
            ) : null}
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

// AiOutlineEdit
{
  /* <div
  data-radix-popper-content-wrapper=""
  style="position: fixed; left: 0px; top: 0px; transform: translate(0px, -200%); min-width: max-content; will-change: transform; z-index: 50;"
>
  <div
    data-side="bottom"
    data-align="center"
    data-state="delayed-open"
    class="z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
    style="--radix-tooltip-content-transform-origin: var(--radix-popper-transform-origin); --radix-tooltip-content-available-width: var(--radix-popper-available-width); --radix-tooltip-content-available-height: var(--radix-popper-available-height); --radix-tooltip-trigger-width: var(--radix-popper-anchor-width); --radix-tooltip-trigger-height: var(--radix-popper-anchor-height); animation: auto ease 0s 1 normal none running none;"
  >
    <p class="p-1 rounded-md bg-[#3D445C]">Rename</p>
    <span
      id="radix-:r27:"
      role="tooltip"
      style="position: absolute; border: 0px; width: 1px; height: 1px; padding: 0px; margin: -1px; overflow: hidden; clip: rect(0px, 0px, 0px, 0px); white-space: nowrap; overflow-wrap: normal;"
    >
      <p class="p-1 rounded-md bg-[#3D445C]">Rename</p>
    </span>
  </div>
</div>; */
}

// Codicon
//
