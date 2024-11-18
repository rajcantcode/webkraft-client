import { AiOutlineDelete, AiOutlineEdit } from "react-icons/ai";
import { checkIfNameIsValid, getFileIcon } from "../lib/utils";
import { TreeNode } from "../constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "./ui/Input";
import DeleteFileModal from "./DeleteConfirmationModal";
import { IoMdSend } from "react-icons/io";
import { useWorkspaceStore } from "../store";

type HandleRename = (
  node: TreeNode,
  newName: string,
  type: "file" | "folder"
) => void;
type HandleDelete = (path: string, type: "file" | "folder") => void;
type CheckRenameValueIsUnique = (renameValue: string) => boolean;
const TreeFile = ({
  node,
  handleRename,
  handleDelete,
  checkRenameValueIsUnique,
}: {
  node: TreeNode;
  handleRename: HandleRename;
  handleDelete: HandleDelete;
  checkRenameValueIsUnique: CheckRenameValueIsUnique;
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
      console.log("file clicked ->", node);
      console.log(e);
      e.stopPropagation();
      const actionSelected = (e.target as Element)
        .closest(".action-icon")
        ?.getAttribute("data-action");
      if (actionSelected) {
        switch (actionSelected) {
          case "rename":
            setInputState({ show: true, value: node.name, error: "" });
            console.log("rename");
            return;
          case "del-file":
            deleteFileModalRef.current?.showModal();
            console.log("delete");
            return;
        }
      } else {
        console.log("setting selected file path ->", node.path);
        setSelectedFilePath(node.path);
      }
    },
    [node]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("text/plain", node.path);
      e.dataTransfer.effectAllowed = "copy";
    },
    [node]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (!checkRenameValueIsUnique(e.target.value)) {
        setInputState((prev) => ({
          ...prev,
          value: e.target.value,
          error: `A file or folder ${e.target.value} already exists at this location. Please choose a different name.`,
        }));
        return;
      }
      if (!checkIfNameIsValid(e.target.value)) {
        setInputState((prev) => ({
          ...prev,
          value: e.target.value,
          error: `The name ${e.target.value} is not valid. Please choose a different name.`,
        }));
        return;
      }
      setInputState((prev) => ({ ...prev, value: e.target.value, error: "" }));
    },
    [checkRenameValueIsUnique]
  );

  const handleInputSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    // debugger;
    e?.preventDefault();
    console.log(e?.currentTarget);
    try {
      handleRename(node, inputState.value, node.type);
      setInputState({ show: false, value: "", error: "" });
    } catch (error) {
      // If we don't have e that means user has clicked outside the input, which invoked handleInputSubmit, but we don't want to show error in that case, and also hide the input
      if (!e) {
        setInputState({ show: false, value: "", error: "" });
      }
      console.log("printing error from submit");
      console.error(error);
    }
  };

  const icon = getFileIcon(node.name);

  return (
    <div
      className={`py-[1px] px-1 flex items-center w-[99%] file-details group justify-between min-h-[32px] sm:min-h-[24px] text-sm mt-1.5 ${
        selectedFilePath === node.path ? "bg-[#2B3245]" : ""
      } rounded-md hover:bg-[#1C2333] focus:shadow-[0_0_0_2px_#0079F2]`}
      onClick={handleFileClick}
      tabIndex={0}
      draggable={!inputState.show}
      onDragStart={handleDragStart}
    >
      {inputState.show ? (
        <form
          className="relative w-full bg-transparent"
          onSubmit={handleInputSubmit}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center w-full gap-2">
            <Input
              type="text"
              value={inputState.value}
              onChange={handleInputChange}
              onBlur={() => handleInputSubmit()}
              ref={inputRef}
              autoFocus={true}
            />
            <button type="submit" className="border-none sm:hidden">
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
          handleDelete={handleDelete}
        />
      </dialog>
    </div>
  );
};

export default TreeFile;
