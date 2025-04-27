import React, { useCallback, useEffect, useRef, useState } from "react";
import { RenamePathObj, useWorkspaceStore } from "../store";
import { BsLayoutSplit } from "react-icons/bs";
import { cn, getFileIcon } from "../lib/utils";
import exitIcon from "../icons/exit.svg";
// import * as ScrollArea from "@radix-ui/react-scroll-area";
import { ScrollArea, ScrollBar } from "./ui/ScrollArea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TooltipWrapper,
} from "./ui/ToolTip";
import { Button } from "./ui/Button";
import { nanoid } from "nanoid";
import {
  edIdToPathToScrollOffsetAndCursorPos,
  scrollOffsetAndCursorPos,
  OS,
} from "../constants";

const regex = /(?:[^/]+\/)?([^/]+\/[^/]+)$/;
const FileTabBar = ({
  editorId,
  getScrollOffsetAndCursorPos,
}: {
  editorId: string;
  getScrollOffsetAndCursorPos: () =>
    | {
        cursorPos: { column: number; lineNumber: number };
        scrollOffset: number;
      }
    | undefined;
}) => {
  const selectedFilePath = useWorkspaceStore((state) => state.selectedFilePath);
  const setSelectedFilePath = useWorkspaceStore(
    (state) => state.setSelectedFilePath
  );
  const setEditorIds = useWorkspaceStore((state) => state.setEditorIds);
  const lastSelectedEditorIds = useWorkspaceStore(
    (state) => state.lastSelectedEditorIds
  );
  const setLastSelectedEditorIds = useWorkspaceStore(
    (state) => state.setLastSelectedEditorIds
  );
  const setLastPathBeforeClosingEditor = useWorkspaceStore(
    (state) => state.setLastPathBeforeClosingEditor
  );
  const activeEditorId = useWorkspaceStore((state) => state.activeEditorId);
  const setActiveEditorId = useWorkspaceStore(
    (state) => state.setActiveEditorId
  );
  const [currSelectedFilePath, setCurrSelectedFilePath] = useState(
    selectedFilePath[editorId]
  );
  const fileTabs = useWorkspaceStore((state) => state.fileTabs);
  const [currFileTabs, setCurrFileTabs] = useState(fileTabs[editorId] || []);
  const setFileTabs = useWorkspaceStore((state) => state.setFileTabs);
  const lastSelectedFilePaths = useWorkspaceStore(
    (state) => state.lastSelectedFilePaths
  );
  const setLastSelectedFilePaths = useWorkspaceStore(
    (state) => state.setLastSelectedFilePaths
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => setCurrSelectedFilePath(selectedFilePath[editorId]),
    [selectedFilePath, editorId, setCurrSelectedFilePath]
  );
  useEffect(
    () => setCurrFileTabs(fileTabs[editorId]),
    [fileTabs, editorId, setCurrFileTabs]
  );
  useEffect(() => {
    if (!currSelectedFilePath) return;
    setLastSelectedFilePaths((prev) => ({
      ...prev,
      [editorId]: prev[editorId]
        ? [...prev[editorId], currSelectedFilePath]
        : [currSelectedFilePath],
    }));
  }, [currSelectedFilePath, setLastSelectedFilePaths]);

  useEffect(() => {
    if (currSelectedFilePath && !currFileTabs.includes(currSelectedFilePath)) {
      setFileTabs((prev) => ({
        ...prev,
        [editorId]: currFileTabs
          ? [...currFileTabs, currSelectedFilePath]
          : [currSelectedFilePath],
      }));
    }
  }, [currSelectedFilePath, currFileTabs]);

  const removeTab = (path: string) => {
    const newTabs = currFileTabs.filter((tab) => tab !== path);
    const filteredLastSelectedFilePaths = [
      ...lastSelectedFilePaths[editorId],
    ].filter((prevPath) => prevPath !== path);
    setFileTabs((prev) => {
      if (!(newTabs.length > 0)) {
        delete prev[editorId];
        return { ...prev };
      } else {
        return { ...prev, [editorId]: newTabs };
      }
    });
    if (path === currSelectedFilePath) {
      if (newTabs.length > 0) {
        setSelectedFilePath((prev) => ({
          ...prev,
          [editorId]: filteredLastSelectedFilePaths.pop() || "",
        }));
        setLastSelectedFilePaths((prev) => ({
          ...prev,
          [editorId]: filteredLastSelectedFilePaths,
        }));
      } else {
        setLastSelectedFilePaths((prev) => {
          delete prev[editorId];
          return { ...prev };
        });
        setSelectedFilePath((prev) => {
          delete prev[editorId];
          return { ...prev };
        });
        setEditorIds((prev) => prev.filter((id) => id !== editorId));
        const filteredLastSelectedEditorIds = lastSelectedEditorIds.filter(
          (id) => id !== editorId
        );
        setActiveEditorId(filteredLastSelectedEditorIds.pop() || "");
        setLastSelectedEditorIds(filteredLastSelectedEditorIds);
        setLastPathBeforeClosingEditor(path);
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
      const currPosAndOffset = getScrollOffsetAndCursorPos();
      if (currPosAndOffset) {
        edIdToPathToScrollOffsetAndCursorPos[editorId + currSelectedFilePath] =
          currPosAndOffset;
      }
      setSelectedFilePath((prev) => ({ ...prev, [editorId]: path }));
      if (editorId !== activeEditorId) setActiveEditorId(editorId);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const path = e.dataTransfer.getData("text/plain");
    if (currFileTabs.includes(path)) {
      setSelectedFilePath((prev) => ({ ...prev, [editorId]: path }));
    } else {
      setFileTabs((prev) => ({ ...prev, [editorId]: [...currFileTabs, path] }));
      setSelectedFilePath((prev) => ({ ...prev, [editorId]: path }));
    }
  };

  const handleSplitEditor = useCallback(() => {
    const newEditorId = nanoid(4);
    // Get scrollOffset and cursorPos of the current selected file path
    const scrollOffsetAndCursorPosOfCurrSelectedFilePath =
      getScrollOffsetAndCursorPos();
    if (scrollOffsetAndCursorPosOfCurrSelectedFilePath) {
      scrollOffsetAndCursorPos[currSelectedFilePath] =
        scrollOffsetAndCursorPosOfCurrSelectedFilePath;
      edIdToPathToScrollOffsetAndCursorPos[editorId + currSelectedFilePath] =
        scrollOffsetAndCursorPosOfCurrSelectedFilePath;
    }
    setActiveEditorId(newEditorId);
    setEditorIds((prev) => {
      const prevCopy = [...prev];
      const index = prevCopy.indexOf(editorId);
      prevCopy.splice(index + 1, 0, newEditorId);
      return prevCopy;
    });
    setSelectedFilePath((prev) => ({
      ...prev,
      [newEditorId]: currSelectedFilePath,
    }));
  }, [
    currSelectedFilePath,
    setActiveEditorId,
    setEditorIds,
    setSelectedFilePath,
    getScrollOffsetAndCursorPos,
    editorId,
  ]);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, path: string) => {
      e.dataTransfer.setData("text/plain", path);
      e.dataTransfer.effectAllowed = "copy";
    },
    []
  );

  return (
    <div
      className="tab-container h-[30px] w-full flex items-center justify-between"
      ref={containerRef}
    >
      <ScrollArea
        className="w-full h-full"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="h-[30px] w-full hidden sm:flex items-center flex-nowrap filetab bg-[#171D2D] ">
          {currFileTabs.map((tab) => {
            const fileName = tab.slice(tab.lastIndexOf("/") + 1);
            return (
              <div
                className={`flex items-center h-full gap-1 cursor-pointer min-w-fit max-w-60 tab border-r-[1px] border-b-[1px] border-[#2B3245] relative text-sm group ${
                  currSelectedFilePath === tab && activeEditorId === editorId
                    ? "bg-[#1B2333] border-0 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[1px] before:bg-[#0179F2] text-[#f5f9fc]"
                    : "text-[#c2c8cc]"
                }`}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, tab)}
                key={tab}
                onClick={(e) => handleTabClick(e, tab)}
              >
                <TooltipWrapper
                  title={tab.match(regex)![1]}
                  containerRef={containerRef}
                >
                  <div className="flex items-center gap-2 px-1 name-and-logo hover:bg-[#1C2333] h-full">
                    <img
                      src={getFileIcon(fileName)}
                      alt="file icon"
                      className="w-4 h-4"
                    />
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap ">
                      {fileName}
                    </span>
                  </div>
                </TooltipWrapper>

                <TooltipWrapper
                  title={`close ${
                    currSelectedFilePath === tab
                      ? OS === "mac"
                        ? "⌘W"
                        : "Ctrl+W"
                      : ""
                  }`}
                  containerRef={containerRef}
                >
                  <button
                    className={cn(
                      "h-full px-1 close-btn group-hover:visible flex items-center hover:bg-[#1C2333]",
                      currSelectedFilePath === tab ? "visible" : "invisible"
                    )}
                  >
                    <div
                      className={`w-4 h-4 codicon codicon-close bg-transparent ${
                        currSelectedFilePath === tab
                          ? "text-[#f5f9fc]"
                          : "text-[#c2c8cc]"
                      } hover:text-[#f5f9fc]`}
                    ></div>
                  </button>
                </TooltipWrapper>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {activeEditorId === editorId ? (
        <TooltipWrapper title="split editor">
          <Button
            onClick={handleSplitEditor}
            className="h-full p-2 group hover:bg-[#1C2333] bg-[#171D2D]"
          >
            <BsLayoutSplit className="text-lg text-[#C2C8CC] group-hover:text-[#F5F9FC]" />
          </Button>
        </TooltipWrapper>
      ) : null}
    </div>
  );
};
const MemoizedFileTabBar = React.memo(FileTabBar);
MemoizedFileTabBar.displayName = "FileTabBar";
export default MemoizedFileTabBar;
