import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  // const {
  //   selectedFilePath,
  //   setSelectedFilePath,
  //   fileTabs,
  //   setFileTabs,
  //   lastSelectedFilePaths,
  //   setLastSelectedFilePaths,
  // } = useWorkspaceStore((state) => ({
  //   selectedFilePath: state.selectedFilePath,
  //   setSelectedFilePath: state.setSelectedFilePath,
  //   fileTabs: state.fileTabs,
  //   setFileTabs: state.setFileTabs,
  //   lastSelectedFilePaths: state.lastSelectedFilePaths,
  //   setLastSelectedFilePaths: state.setLastSelectedFilePaths,
  // }));
  const selectedFilePath = useWorkspaceStore((state) => state.selectedFilePath);
  const setSelectedFilePath = useWorkspaceStore(
    (state) => state.setSelectedFilePath
  );
  const setRenamedPaths = useWorkspaceStore((state) => state.setRenamedPaths);
  const renamedPaths = useWorkspaceStore((state) => state.renamedPaths);
  const deletedPaths = useWorkspaceStore((state) => state.deletedPaths);

  const [fileTabs, setFileTabs] = useState<string[]>([]);
  const lastSelectedFilePaths = useRef<string[]>([]);

  useEffect(() => {
    if (!selectedFilePath) return;
    lastSelectedFilePaths.current.push(selectedFilePath);
    // if (!fileTabs.includes(selectedFilePath)) {
    //   console.log("setting file tabs in useEffect -> ", selectedFilePath);
    //   console.log(fileTabs);
    //   setFileTabs((prev) => [...prev, selectedFilePath]);
    // }
    // setLastSelectedFilePaths((prev) => [...prev, selectedFilePath]);
  }, [selectedFilePath]);

  useEffect(() => {
    console.log(`received renamedPaths in useEffect ->`, renamedPaths);
    if (renamedPaths.length > 0) {
      renameFileTabPaths(renamedPaths);
    }
  }, [renamedPaths]);

  useEffect(() => {
    if (deletedPaths.length > 0) {
      removeDeletedFileTabPaths(deletedPaths);
    }
  }, [deletedPaths]);

  useEffect(() => {
    if (selectedFilePath && !fileTabs.includes(selectedFilePath)) {
      console.log(
        `👹👹 In top level if of FileTabBar, setting file tabs to ->,`
      );
      // debugger;
      console.log(`fileTabs before -> ${fileTabs}`);
      console.log(`selectedFilePath -> ${selectedFilePath}`);
      setFileTabs([...fileTabs, selectedFilePath]);
      // setFileTabs((prev) => [...prev, selectedFilePath]);
    }
  }, [selectedFilePath, fileTabs, setFileTabs]);
  const renameFileTabPaths = useCallback(
    (renameValues: RenamePathObj[]) => {
      // debugger;
      console.log(`In renameFileTabPaths, initially ->`);
      console.log("fileTabs ->", fileTabs);
      console.log(
        "lastSelectedFilePaths.current ->",
        lastSelectedFilePaths.current
      );
      // Create copies of the arrays to avoid mutating the originals
      let updatedFileTabs: string[] = [...fileTabs];
      let updatedLastSelectedFileTabs: string[] = [
        ...lastSelectedFilePaths.current,
      ];
      let newSelectedFilePath: string;

      // Process each rename operation
      renameValues.forEach(({ oldPath, newPath }: RenamePathObj) => {
        if (selectedFilePath === oldPath) {
          newSelectedFilePath = newPath;
        }
        // Update fileTabs
        updatedFileTabs = updatedFileTabs.map((tab: string) =>
          tab === oldPath ? newPath : tab
        );

        // Update lastSelectedFileTabs
        updatedLastSelectedFileTabs = updatedLastSelectedFileTabs.map(
          (tab: string) => (tab === oldPath ? newPath : tab)
        );
      });

      console.log("updatedFileTabs ->", updatedFileTabs);
      console.log(
        "updatedLastSelectedFileTabs ->",
        updatedLastSelectedFileTabs
      );
      setFileTabs(updatedFileTabs);
      setRenamedPaths([]);
      if (newSelectedFilePath) {
        console.log("setting selected file path ->", newSelectedFilePath);
        setSelectedFilePath(newSelectedFilePath);
      }
      lastSelectedFilePaths.current = updatedLastSelectedFileTabs;
    },
    [fileTabs, setFileTabs, selectedFilePath, setSelectedFilePath]
  );
  const removeDeletedFileTabPaths = useCallback(
    (deletedPaths: string[]) => {
      // Create copies of the arrays to avoid mutating the originals
      let updatedFileTabs: string[] = [...fileTabs];
      let updatedLastSelectedFileTabs: string[] = [
        ...lastSelectedFilePaths.current,
      ];

      // Create a Set for faster lookups
      const deletedPathsSet: Set<string> = new Set(deletedPaths);

      // Remove deleted paths from fileTabs
      updatedFileTabs = updatedFileTabs.filter(
        (tab: string) => !deletedPathsSet.has(tab)
      );

      // Remove deleted paths from lastSelectedFileTabs
      updatedLastSelectedFileTabs = updatedLastSelectedFileTabs.filter(
        (tab: string) => !deletedPathsSet.has(tab)
      );

      console.log("updatedFileTabs ->", updatedFileTabs);
      console.log(
        "updatedLastSelectedFileTabs ->",
        updatedLastSelectedFileTabs
      );
      setFileTabs(updatedFileTabs);
      lastSelectedFilePaths.current = updatedLastSelectedFileTabs;
      console.log(
        "lastSelectedFilePaths.current ->",
        lastSelectedFilePaths.current
      );
    },
    [fileTabs, setFileTabs]
  );

  // if (selectedFilePath && !fileTabs.includes(selectedFilePath)) {
  //   console.log(`👹👹 In top level if of FileTabBar, setting file tabs to ->,`);
  //   debugger;
  //   console.log(`fileTabs before -> ${fileTabs}`);
  //   console.log(`selectedFilePath -> ${selectedFilePath}`);
  //   setFileTabs([...fileTabs, selectedFilePath]);
  //   // setFileTabs((prev) => [...prev, selectedFilePath]);
  // }

  const removeTab = (path: string) => {
    console.log("removeTab called");
    const newTabs = fileTabs.filter((tab) => tab !== path);
    lastSelectedFilePaths.current = lastSelectedFilePaths.current.filter(
      (prevPath) => prevPath !== path
    );
    // setLastSelectedFilePaths((prev) =>
    //   prev.filter((prevPath) => prevPath !== path)
    // );
    // Remove path from lastSelectedFilePaths which has been closed
    // let lastSelectedFilteredPaths = lastSelectedFilePaths.filter(
    //   (prevPath) => prevPath !== path
    // );
    console.log(`👹👹 In removeTab, setting file tabs to -> ${newTabs}`);
    setFileTabs(newTabs);
    if (path === selectedFilePath) {
      if (newTabs.length > 0) {
        console.log(
          "setting selected file path ->",
          lastSelectedFilePaths.current[
            lastSelectedFilePaths.current.length - 1
          ]
        );
        setSelectedFilePath(lastSelectedFilePaths.current.pop() || "");
        // setSelectedFilePath(lastSelectedFilteredPaths.pop() || "");
      } else {
        console.log("setting selected file path -> ''");
        lastSelectedFilePaths.current = [];
        // lastSelectedFilteredPaths = [];
        setSelectedFilePath("");
      }
    }
    // setLastSelectedFilePaths(lastSelectedFilteredPaths);
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
      console.log("setting selected file path ->", path);
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
      console.log("setting selected file path ->", path);
      setSelectedFilePath(path);
    } else {
      console.log(
        `👹👹 In handleDrop, setting file tabs to -> ${[...fileTabs, path]}`
      );
      setFileTabs([...fileTabs, path]);
      console.log("setting selected file path ->", path);
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
