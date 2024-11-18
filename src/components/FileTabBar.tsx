import React, { useEffect } from "react";
import { RenamePathObj, useWorkspaceStore } from "../store";
import { getFileIcon } from "../lib/utils";
import exitIcon from "../icons/exit.svg";
// import * as ScrollArea from "@radix-ui/react-scroll-area";
import { ScrollArea, ScrollBar } from "./ui/ScrollArea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/ToolTip";

const FileTabBar = () => {
  const selectedFilePath = useWorkspaceStore((state) => state.selectedFilePath);
  const setSelectedFilePath = useWorkspaceStore(
    (state) => state.setSelectedFilePath
  );
  const fileTabs = useWorkspaceStore((state) => state.fileTabs);
  const setFileTabs = useWorkspaceStore((state) => state.setFileTabs);
  const lastSelectedFilePaths = useWorkspaceStore(
    (state) => state.lastSelectedFilePaths
  );
  const setLastSelectedFilePaths = useWorkspaceStore(
    (state) => state.setLastSelectedFilePaths
  );

  useEffect(() => {
    if (!selectedFilePath) return;
    setLastSelectedFilePaths((prev) => [...prev, selectedFilePath]);
  }, [selectedFilePath, setLastSelectedFilePaths]);

  useEffect(() => {
    if (selectedFilePath && !fileTabs.includes(selectedFilePath)) {
      setFileTabs([...fileTabs, selectedFilePath]);
    }
  }, [selectedFilePath, fileTabs]);

  const removeTab = (path: string) => {
    const newTabs = fileTabs.filter((tab) => tab !== path);
    const filteredLastSelectedFilePaths = [...lastSelectedFilePaths].filter(
      (prevPath) => prevPath !== path
    );
    setFileTabs(newTabs);
    if (path === selectedFilePath) {
      if (newTabs.length > 0) {
        setSelectedFilePath(filteredLastSelectedFilePaths.pop() || "");
        setLastSelectedFilePaths(filteredLastSelectedFilePaths);
      } else {
        setLastSelectedFilePaths([]);
        setSelectedFilePath("");
      }
    }
  };

  const handleTabClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    path: string
  ) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest(".close-btn")) {
      removeTab(path);
    } else {
      if (selectedFilePath === path) return;
      setSelectedFilePath(path);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const path = e.dataTransfer.getData("text/plain");
    if (fileTabs.includes(path)) {
      setSelectedFilePath(path);
    } else {
      setFileTabs([...fileTabs, path]);
      setSelectedFilePath(path);
    }
  };

  const regex = /(?:[^/]+\/)?([^/]+\/[^/]+)$/;

  return (
    <ScrollArea
      className="h-[30px] w-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="h-[30px] w-full hidden sm:flex items-center flex-nowrap filetab bg-[#171D2D] ">
        {fileTabs.map((tab) => {
          const fileName = tab.slice(tab.lastIndexOf("/") + 1);
          return (
            <div
              className={`flex items-center h-full gap-1 cursor-pointer min-w-fit max-w-60 tab border-r-[1px] border-b-[1px] border-[#2B3245] relative ${
                selectedFilePath === tab
                  ? "bg-[#1B2333] border-0 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[1px] before:bg-[#0179F2]"
                  : ""
              }`}
              key={tab}
              onClick={(e) => handleTabClick(e, tab)}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-1 name-and-logo hover:bg-[#1C2333] h-full">
                      <img
                        src={getFileIcon(fileName)}
                        alt="file icon"
                        className="w-4 h-4"
                      />
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                        {fileName}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="p-1 rounded-md bg-[#3D445C]">
                      {tab.match(regex)![1]}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="h-full px-1 close-btn hover:bg-[#1C2333]">
                      <img src={exitIcon} alt="" className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="p-1 rounded-md bg-[#3D445C]">close</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
export default React.memo(FileTabBar);
