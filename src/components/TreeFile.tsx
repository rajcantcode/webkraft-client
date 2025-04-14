import { AiOutlineDelete, AiOutlineEdit } from "react-icons/ai";
import { checkIfNameIsValid, getFileIcon } from "../lib/utils";
import { FlattenedTreeFileNode } from "../constants";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Input } from "./ui/Input";
import { IoMdSend } from "react-icons/io";
import { useWorkspaceStore } from "../store";
import { createPortal } from "react-dom";
import { nanoid } from "nanoid";
import { TooltipWrapper } from "./ui/ToolTip";
import { DeleteInfo, OverwriteInfo } from "../types/modal";

type HandleRename = (
  pni: number,
  depth: number,
  path: string,
  newName: string,
  type: "file" | "folder"
) => void;
type CheckIfNameIsUnique = (
  pni: number,
  depth: number,
  newName: string
) => boolean;
type DeleteNamesSet = (parentIndex: number) => void;
const itemSize = window.innerWidth > 768 ? 24 : 32;

const TreeFile = React.memo(
  ({
    node,
    padLeft,
    height,
    start,
    checkIfNameIsUnique,
    handleRename,
    deleteNamesSet,
    showEditOptions,
    scrollRef,
    workspaceRef,
    stopScroll,
    curDraggedOverPath,
    showModal,
  }: {
    node: FlattenedTreeFileNode;
    padLeft: number;
    height: number;
    start: number;
    checkIfNameIsUnique: CheckIfNameIsUnique;
    handleRename: HandleRename;
    deleteNamesSet: DeleteNamesSet;
    showEditOptions: boolean;
    scrollRef: React.RefObject<HTMLDivElement>;
    workspaceRef: React.RefObject<HTMLDivElement> | null;
    stopScroll: () => void;
    curDraggedOverPath: React.MutableRefObject<{
      path: string | null;
      basePath: string | null;
    }>;
    showModal: (info: DeleteInfo | OverwriteInfo) => void;
  }) => {
    const [inputState, setInputState] = useState({
      show: false,
      value: "",
      error: "",
    });
    const selectedFilePath = useWorkspaceStore(
      (state) => state.selectedFilePath
    );
    const setSelectedFilePath = useWorkspaceStore(
      (state) => state.setSelectedFilePath
    );
    const activeEditorId = useWorkspaceStore((state) => state.activeEditorId);
    const setActiveEditorId = useWorkspaceStore(
      (state) => state.setActiveEditorId
    );
    const setEditorIds = useWorkspaceStore((state) => state.setEditorIds);
    const inputRef = useRef<HTMLInputElement>(null);
    const parentPath = useMemo(
      () => node.path.split("/").slice(0, -1).join("/"),
      [node.path]
    );

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
              // deleteFileModalRef.current?.showModal();
              showModal({
                opType: "delete",
                path: node.path,
                pni: node.pni,
                nodeType: node.type,
                name: node.name,
              });
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
      [
        node,
        activeEditorId,
        setActiveEditorId,
        setEditorIds,
        setSelectedFilePath,
      ]
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
        curDraggedOverPath.current.path = node.path;
        curDraggedOverPath.current.basePath = parentPath;
      },
      [node.path, parentPath, curDraggedOverPath]
    );

    const handleDragEnd = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.removeProperty("box-shadow");
        e.currentTarget.style.opacity = "1";
        stopScroll();

        (
          e.currentTarget.querySelector(".edit-options") as HTMLElement
        )?.style.removeProperty("display");
        curDraggedOverPath.current.path = null;
        curDraggedOverPath.current.basePath = null;
      },
      [stopScroll, curDraggedOverPath]
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

    const icon = getFileIcon(node.name);

    return (
      <div
        className={`file-container absolute top-0 left-0 tree-node`}
        data-path={node.path}
        data-depth={node.depth}
        data-pni={node.pni}
        data-type={node.type}
        style={{
          height: `${height}px`,
          transform: `translateY(${start}px)`,
          width: `calc(100% - ${padLeft}px)`,
          marginLeft: `${padLeft}px`,
        }}
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
                draggable={false}
              >
                <img src={icon} alt="" className="w-4 h-4" draggable={false} />
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

                  <TooltipWrapper
                    title="Delete file"
                    containerRef={workspaceRef}
                  >
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
        </div>
      </div>
    );
  }
);

export default TreeFile;
