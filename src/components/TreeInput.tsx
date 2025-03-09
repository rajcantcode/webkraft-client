import React, { useMemo, useState } from "react";
import { InputNode, tempInputInfo } from "../constants";
import { Input } from "./ui/Input";
import { IoMdSend } from "react-icons/io";
import { checkIfNameIsValid } from "../lib/utils";
import { createPortal } from "react-dom";

type CheckIfNameIsUnique = (
  pni: number,
  depth: number,
  newName: string
) => boolean;
type HandleAddFile = (pni: number, depth: number, fileName: string) => void;
type DeleteNamesSet = (parentIndex: number) => void;
type RemoveInputNode = (pni: number) => void;
type HandleAddFolder = (pni: number, depth: number, folderName: string) => void;

const itemSize = window.innerWidth > 768 ? 24 : 32;

const TreeInput = ({
  node,
  padLeft,
  height,
  start,
  isNodeModulesChildrenReceived,
  checkIfNameIsUnique,
  handleAddFile,
  removeInputNode,
  deleteNamesSet,
  handleAddFolder,
  scrollRef,
}: {
  node: InputNode;
  padLeft: number;
  height: number;
  start: number;
  isNodeModulesChildrenReceived: React.MutableRefObject<{
    [path: string]: boolean;
  }>;
  checkIfNameIsUnique: CheckIfNameIsUnique;
  handleAddFile: HandleAddFile;
  removeInputNode: RemoveInputNode;
  deleteNamesSet: DeleteNamesSet;
  handleAddFolder: HandleAddFolder;
  scrollRef: React.RefObject<HTMLDivElement>;
}) => {
  const [error, setError] = useState("");
  const [value, setValue] = useState(node.value);
  const parentPath = useMemo(
    () => node.path.split("/").slice(0, -1).join("/"),
    [node.path]
  );
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // debugger;
    // If user is adding a file or folder in the node_modules path whose children are not yet loaded, we just set value and don't check for name validity or uniqueness
    if (
      node.path.includes("node_modules") &&
      !isNodeModulesChildrenReceived.current[parentPath]
    ) {
      setValue(e.target.value);
      tempInputInfo[node.path].value = e.target.value;
      return;
    }
    const isNameValid = checkIfNameIsValid(e.target.value);
    if (!isNameValid) {
      const errMsg = `The name ${e.target.value} is not valid. Please choose a different name.`;
      setError(errMsg);
      setValue(e.target.value);
      tempInputInfo[node.path].error = errMsg;
      tempInputInfo[node.path].value = e.target.value;
      return;
    }
    const isNameUnique = checkIfNameIsUnique(
      node.pni,
      node.depth,
      e.target.value
    );
    if (!isNameUnique) {
      const errMsg = `A file or folder ${e.target.value} already exists at this location. Please choose a different name.`;
      setError(errMsg);
      setValue(e.target.value);
      tempInputInfo[node.path].error = errMsg;
      tempInputInfo[node.path].value = e.target.value;
      return;
    }
    setValue(e.target.value);
    setError("");
    tempInputInfo[node.path].error = "";
    tempInputInfo[node.path].value = e.target.value;
  };

  const handleInputSubmit = (
    e:
      | React.FormEvent<HTMLFormElement>
      | React.FocusEvent<HTMLInputElement, Element>
  ) => {
    e.stopPropagation();
    e.preventDefault();

    // If user is adding a file or folder in the node_modules path whose children are not yet loaded, we don't do anything and tell user to submit again when all files and folders are loaded
    if (
      node.path.includes("node_modules") &&
      !isNodeModulesChildrenReceived.current[parentPath]
    ) {
      if (e.type === "submit") {
        const errMsg =
          "Please submit again when all files and folders are loaded.";
        setError(errMsg);
        tempInputInfo[node.path].error = errMsg;
      } else {
        removeInputNode(node.pni);
        deleteNamesSet(node.pni);
        // Todo: show popup with the same errMsg as above
        delete tempInputInfo[node.path];
      }

      return;
    }
    // Determine if e is focus event or form event
    // debugger;
    // If there is an error, and user is submitting by pressing enter key, just return, so the error will be shown
    if (error && e.type === "submit") {
      if (
        !node.path.includes("node_modules") &&
        !isNodeModulesChildrenReceived.current[parentPath] &&
        error !== "Please submit again when all files and folders are loaded."
      ) {
        return;
      }
    }

    // After the above check, it is confirmed that handleInputSubmit is called because user clicked outside the input field. In this case, if there is an error, we just remove the input field, return and make no changes to the filetree.
    if (error && e.type !== "submit") {
      removeInputNode(node.pni);
      deleteNamesSet(node.pni);
      delete tempInputInfo[node.path];
      return;
    }

    if (!value && e.type === "submit") {
      const errMsg = "A file or folder name must be provided.";
      setError(errMsg);
      tempInputInfo[node.path].error = errMsg;
      return;
    }
    if (!value) {
      removeInputNode(node.pni);
      deleteNamesSet(node.pni);
      delete tempInputInfo[node.path];
      return;
    }

    node.value = value;
    if (node.operation === "add-file") {
      handleAddFile(node.pni, node.depth, value);
    }
    if (node.operation === "add-folder") {
      handleAddFolder(node.pni, node.depth, value);
    }
    delete tempInputInfo[node.path];
  };
  return (
    <div
      className={`input-container pl-[${padLeft}px] absolute top-0 left-0 translate-y-[${start}px] px-1`}
      style={{
        transform: `translateY(${start}px)`,
        width: `calc(100% - ${padLeft}px)`,
        height: `${height}px`,
        marginLeft: `${padLeft}px`,
      }}
    >
      <form onSubmit={handleInputSubmit} className="w-full h-full">
        <div className="flex items-center w-full h-full gap-2">
          <Input
            type="text"
            value={value}
            onChange={handleInputChange}
            onBlur={handleInputSubmit}
            autoFocus={true}
            className="w-full h-full p-2"
          />
          <button type="submit" className="p-1 border-none sm:hidden">
            <IoMdSend />
          </button>
        </div>
        {error && scrollRef.current
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
                    {error}
                  </p>
                </div>
              </div>,
              scrollRef.current
            )
          : null}
      </form>
    </div>
  );
};

export default TreeInput;
