import React, { useState } from "react";
import { InputNode } from "../constants";
import { Input } from "./ui/Input";
import { IoMdSend } from "react-icons/io";
import { checkIfNameIsValid } from "../lib/utils";
import { createPortal } from "react-dom";

type CheckIfNameIsUnique = (
  pni: number,
  depth: number,
  newName: string,
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
  checkIfNameIsUnique: CheckIfNameIsUnique;
  handleAddFile: HandleAddFile;
  removeInputNode: RemoveInputNode;
  deleteNamesSet: DeleteNamesSet;
  handleAddFolder: HandleAddFolder;
  scrollRef: React.RefObject<HTMLDivElement>;
}) => {
  const [error, setError] = useState("");
  const [value, setValue] = useState(node.value);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // debugger;
    const isNameValid = checkIfNameIsValid(e.target.value);
    if (!isNameValid) {
      setError(
        `The name ${e.target.value} is not valid. Please choose a different name.`,
      );
      setValue(e.target.value);
      return;
    }
    const isNameUnique = checkIfNameIsUnique(
      node.pni,
      node.depth,
      e.target.value,
    );
    if (!isNameUnique) {
      setError(
        `A file or folder ${e.target.value} already exists at this location. Please choose a different name.`,
      );
      setValue(e.target.value);
      return;
    }
    setValue(e.target.value);
    setError("");
  };

  const handleInputSubmit = (
    e:
      | React.FormEvent<HTMLFormElement>
      | React.FocusEvent<HTMLInputElement, Element>,
  ) => {
    e.stopPropagation();
    e.preventDefault();

    // Determine if e is focus event or form event
    // debugger;
    if (error && e.type === "submit") return;
    if (error) {
      removeInputNode(node.pni);
      deleteNamesSet(node.pni);
      return;
    }
    if (!value && e.type === "submit") {
      setError("A file or folder name must be provided.");
      return;
    }
    if (!value) {
      removeInputNode(node.pni);
      deleteNamesSet(node.pni);
      return;
    }

    node.value = value;
    if (node.operation === "add-file") {
      handleAddFile(node.pni, node.depth, value);
    }
    if (node.operation === "add-folder") {
      handleAddFolder(node.pni, node.depth, value);
    }
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
                className="err-container absolute"
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
              scrollRef.current,
            )
          : null}
      </form>
    </div>
  );
};

export default TreeInput;
