import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RenamePathObj, useGitStore, useWorkspaceStore } from "../store";
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
  const repoInfo = useGitStore((state) => state.repoInfo);
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
    let found = false;
    for (const tab of currFileTabs) {
      if (
        tab.path === currSelectedFilePath.path &&
        tab.type === currSelectedFilePath.type
      ) {
        if ("changeType" in tab && "changeType" in currSelectedFilePath) {
          if (tab.changeType === currSelectedFilePath.changeType) {
            found = true;
            break;
          }
        } else {
          found = true;
          break;
        }
      }
    }
    if (currSelectedFilePath && !found) {
      setFileTabs((prev) => ({
        ...prev,
        [editorId]: currFileTabs
          ? [...currFileTabs, Object.assign({}, currSelectedFilePath)]
          : [Object.assign({}, currSelectedFilePath)],
      }));
    }
  }, [currSelectedFilePath, currFileTabs]);

  const currSelectedChange = useMemo(() => {
    if (currSelectedFilePath.type === "file" || !repoInfo) return null;
    if (currSelectedFilePath.changeType === "staged") {
      return (
        repoInfo.changes.staged.find(
          (change) => change.path === currSelectedFilePath.path
        ) || null
      );
    } else if (currSelectedFilePath.changeType === "unstaged") {
      return (
        repoInfo.changes.unstaged.find(
          (change) => change.path === currSelectedFilePath.path
        ) || null
      );
    }
    return null;
  }, [currSelectedFilePath, repoInfo]);

  const removeTab = (
    path: string,
    type: "file" | "change",
    changeType?: "staged" | "unstaged"
  ) => {
    // True is returned back and false is not
    // const newTabs = currFileTabs.filter(
    //   (tab) => !(tab.path === path && tab.type === type)
    // );
    // debugger;
    const newTabs = currFileTabs.filter((tab) => {
      if (tab.type === "file") {
        return !(tab.path === path && tab.type === type);
      } else {
        if (changeType) {
          return !(
            tab.path === path &&
            tab.type === type &&
            tab.changeType === changeType
          );
        }
        return true;
      }
    });

    // const filteredLastSelectedFilePaths = [
    //   ...lastSelectedFilePaths[editorId],
    // ].filter((prevPath) => !(prevPath.path === path && prevPath.type === type));
    // setFileTabs((prev) => {
    //   if (!(newTabs.length > 0)) {
    //     delete prev[editorId];
    //     return { ...prev };
    //   } else {
    //     return { ...prev, [editorId]: newTabs };
    //   }
    // });

    const filteredLastSelectedFilePaths = [
      ...lastSelectedFilePaths[editorId],
    ].filter((prevPath) => {
      if (prevPath.type === "file") {
        return !(prevPath.path === path && prevPath.type === type);
      } else {
        if (changeType) {
          return !(
            prevPath.path === path &&
            prevPath.type === type &&
            prevPath.changeType === changeType
          );
        }
        return true;
      }
    });
    setFileTabs((prev) => {
      if (!(newTabs.length > 0)) {
        delete prev[editorId];
        return { ...prev };
      } else {
        return { ...prev, [editorId]: newTabs };
      }
    });

    // Check if the tab being removed is the currently selected one
    if (
      path === currSelectedFilePath.path &&
      type === currSelectedFilePath.type &&
      (type === "file" ||
        (type === "change" &&
          currSelectedFilePath.type === "change" &&
          changeType === currSelectedFilePath.changeType))
    ) {
      if (newTabs.length > 0) {
        setSelectedFilePath((prev) => ({
          ...prev,
          [editorId]: filteredLastSelectedFilePaths.pop()!,
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
    path: string,
    type: "file" | "change",
    changeType?: "staged" | "unstaged",
    index?: "A" | "M" | "U" | "D"
  ) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest(".close-btn")) {
      removeTab(path, type, changeType);
    } else {
      const currPosAndOffset = getScrollOffsetAndCursorPos();

      if (currPosAndOffset) {
        const key =
          type === "change"
            ? (changeType === "staged" ? editorId + "st" : editorId + "ust") +
              currSelectedFilePath.path
            : editorId + currSelectedFilePath.path;
        edIdToPathToScrollOffsetAndCursorPos[key] = currPosAndOffset;
      }
      if (type === "change" && changeType && index) {
        setSelectedFilePath((prev) => ({
          ...prev,
          [editorId]: { path, type, changeType, index },
        }));
      } else if (type === "file") {
        setSelectedFilePath((prev) => ({
          ...prev,
          [editorId]: { path, type },
        }));
      }
      // setSelectedFilePath((prev) => ({ ...prev, [editorId]: { path, type } }));
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
    let isTabPresent = false;
    for (const tab of currFileTabs) {
      if (tab.path === path && tab.type === "file") {
        isTabPresent = true;
        break;
      }
    }
    if (isTabPresent) {
      setSelectedFilePath((prev) => ({
        ...prev,
        [editorId]: { path, type: "file" },
      }));
    } else {
      setFileTabs((prev) => ({
        ...prev,
        [editorId]: [...currFileTabs, { path, type: "file" }],
      }));
      setSelectedFilePath((prev) => ({
        ...prev,
        [editorId]: { path, type: "file" },
      }));
    }
  };

  const handleSplitEditor = useCallback(() => {
    const newEditorId = nanoid(4);
    // Get scrollOffset and cursorPos of the current selected file path
    const scrollOffsetAndCursorPosOfCurrSelectedFilePath =
      getScrollOffsetAndCursorPos();
    if (scrollOffsetAndCursorPosOfCurrSelectedFilePath) {
      scrollOffsetAndCursorPos[currSelectedFilePath.path] =
        scrollOffsetAndCursorPosOfCurrSelectedFilePath;
      const key =
        currSelectedFilePath.type === "change"
          ? (currSelectedFilePath.changeType === "staged"
              ? editorId + "st"
              : editorId + "ust") + currSelectedFilePath.path
          : editorId + currSelectedFilePath.path;
      edIdToPathToScrollOffsetAndCursorPos[key] =
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
            const fileName = tab.path.slice(tab.path.lastIndexOf("/") + 1);
            return (
              <div
                className={`flex items-center h-full gap-1 cursor-pointer min-w-fit max-w-60 tab border-r-[1px] border-b-[1px] border-[#2B3245] relative text-sm group ${
                  tab.type === "file"
                    ? currSelectedFilePath.path === tab.path &&
                      currSelectedFilePath.type === tab.type &&
                      activeEditorId === editorId
                      ? "bg-[#1B2333] border-0 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[1px] before:bg-[#0179F2] text-[#f5f9fc]"
                      : "text-[#c2c8cc]"
                    : currSelectedFilePath.path === tab.path &&
                      currSelectedFilePath.type === tab.type &&
                      currSelectedFilePath.changeType === tab.changeType &&
                      activeEditorId === editorId
                    ? "bg-[#1B2333] border-0 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[1px] before:bg-[#0179F2] text-[#f5f9fc]"
                    : "text-[#c2c8cc]"
                }`}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, tab.path)}
                key={
                  tab.type === "change"
                    ? tab.changeType === "staged"
                      ? "st:" + tab.path
                      : "ust:" + tab.path
                    : "file:" + tab.path
                }
                onClick={(e) =>
                  handleTabClick(
                    e,
                    tab.path,
                    tab.type,
                    tab?.changeType,
                    tab?.index
                  )
                }
              >
                <TooltipWrapper
                  title={tab.path.match(regex)![1]}
                  containerRef={containerRef}
                >
                  <div className="flex items-center gap-2 px-1 name-and-logo hover:bg-[#1C2333] h-full">
                    <img
                      src={getFileIcon(fileName)}
                      alt="file icon"
                      className="w-4 h-4"
                    />
                    {tab.type === "file" ? (
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap ">
                        {fileName}
                      </span>
                    ) : (
                      <span
                        className={`overflow-hidden text-ellipsis whitespace-nowrap ${
                          tab.index === "A"
                            ? "text-[#73c991]"
                            : tab.index === "M"
                            ? "text-[#e2c08d]"
                            : tab.index === "D"
                            ? "text-[#c74e39]"
                            : "text-[#73c991]"
                        } ${tab.index === "D" ? "line-through" : ""}`}
                      >
                        {fileName + "  " + tab.index}
                      </span>
                    )}
                  </div>
                </TooltipWrapper>

                <TooltipWrapper
                  title={`close ${
                    currSelectedFilePath.path === tab.path &&
                    currSelectedFilePath.type === tab.type
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
                      currSelectedFilePath.path === tab.path &&
                        currSelectedFilePath.type === tab.type
                        ? "visible"
                        : "invisible"
                    )}
                  >
                    <div
                      className={`w-4 h-4 codicon codicon-close bg-transparent ${
                        currSelectedFilePath.path === tab.path &&
                        currSelectedFilePath.type === tab.type
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
