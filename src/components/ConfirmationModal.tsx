import React, { useCallback } from "react";
import { RxCross2 } from "react-icons/rx";
import { DeleteInfo, OverwriteInfo } from "../types/modal";
const ConfirmationModal = ({
  title,
  modalRef,
  info,
  acceptTitle,
  acceptCb,
}: {
  title: string | React.ReactNode;
  modalRef: React.RefObject<HTMLDialogElement>;
  acceptTitle: string | React.ReactNode;
  info: DeleteInfo | OverwriteInfo;
  acceptCb:
    | ((path: string, pni: number, type: "file" | "folder") => void)
    | ((sourcePath: string, destPath: string, overwrite?: boolean) => void);
}) => {
  const closeModal = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.stopPropagation();
      modalRef.current?.close();
    },
    [modalRef]
  );
  return (
    <div className="w-full bg-[#1C2333] relative p-4">
      {title}
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
            if (info.opType === "delete")
              // @ts-expect-error thu
              acceptCb(info.path, info.pni, info.nodeType);
            // @ts-expect-error thu
            else acceptCb(info.sourcePath, info.destBasePath, true);
            closeModal(e);
          }}
        >
          {acceptTitle}
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

export default ConfirmationModal;
