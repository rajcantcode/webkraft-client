import React, { RefObject } from "react";
import { RiDeleteBin6Line } from "react-icons/ri";
import { RxCross2 } from "react-icons/rx";

interface DeleteConfirmationModalProps {
  type: "file" | "folder";
  name: string;
  modalRef: RefObject<HTMLDialogElement>;
  path: string;
  handleDelete: (path: string, type: "file" | "folder") => void;
}
const DeleteConfirmationModal = ({
  type,
  name,
  modalRef,
  path,
  handleDelete,
}: DeleteConfirmationModalProps) => {
  const closeModal = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();
    modalRef.current?.close();
  };
  return (
    <div className="w-full bg-[#1C2333] relative p-4">
      <p className="text-2xl font-bold">Delete {type}?</p>
      <p className="mt-7">
        Are you sure you want to delete {name}? This cannot be undone.
      </p>
      <div className="flex items-center justify-end gap-3 mt-7 btn-container">
        <button
          className="p-2 rounded-md cursor-pointer bg-[#2B3245] hover:bg-[#3C445C]"
          onClick={closeModal}
        >
          Cancel
        </button>
        <button
          className="p-2 hover:bg-[#E52222] bg-[#A60808] cursor-pointer rounded-md flex items-center gap-2"
          onClick={(e) => {
            handleDelete(path, type);
            closeModal(e);
          }}
        >
          <RiDeleteBin6Line />
          Yes, delete {type}
        </button>
      </div>
      <button
        className="flex items-center justify-center p-2 rounded-md close-modal bg-transparent hover:bg-[#4E5569] absolute top-3 right-2 cursor-pointer"
        onClick={closeModal}
      >
        <RxCross2 />
      </button>
    </div>
  );
};

export default DeleteConfirmationModal;
