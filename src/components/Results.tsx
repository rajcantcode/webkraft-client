import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MatchResult,
  SearchResults,
  CollapseState,
  FlattenedResult,
} from "../types/search";
import { useVirtualizer, VirtualItem } from "@tanstack/react-virtual";
import { ScrollArea } from "./ui/ScrollArea";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getFileIcon } from "../lib/utils";
import { useWorkspaceStore } from "../store";
import { nanoid } from "nanoid";
import debounce from "lodash.debounce";

// To Fix - virtualizer not working properly, a) not scrolling to the end of list, b) all elements of the bottom are rendered regardless of the scroll position and overscan value.
const flattenResults = (
  searchResults: SearchResults,
  collapseState: CollapseState
): FlattenedResult => {
  const results: Array<{ filePath: string } | MatchResult> = [];
  Object.keys(searchResults).forEach((filePath) => {
    results.push({ filePath });
    if (!collapseState[filePath]) {
      searchResults[filePath].forEach((matchResult) => {
        results.push(matchResult);
      });
    }
  });
  return results;
};
const Results = ({
  searchTerm,
  searchResults,
  collapseState,
  setCollapseState,
}: {
  searchTerm: string;
  searchResults: SearchResults;
  collapseState: CollapseState;
  setCollapseState: React.Dispatch<React.SetStateAction<CollapseState>>;
}) => {
  // const collapseState = useRef<CollapseState>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  // Stores the top position for each search result file path
  const resultsTopPos = useRef<{ [filePath: string]: number }>({});
  const [flattenedResults, setFlattenedResults] = useState<FlattenedResult>(
    () => {
      return flattenResults(searchResults, collapseState);
    }
  );
  const tempFilePath = useRef<string | null>(null);

  useEffect(() => {
    const flattenedResults = flattenResults(searchResults, collapseState);
    Object.keys(resultsTopPos.current).forEach((filePath) => {
      if (collapseState[filePath]) {
        delete resultsTopPos.current[filePath];
      }
    });
    setFlattenedResults(flattenedResults);
  }, [searchResults, collapseState]);

  const virtualizer = useVirtualizer({
    count: flattenedResults.length,
    estimateSize: () => 22,
    getScrollElement: () => scrollRef.current,
    overscan: 0,
  });

  // Temporary function used for debugging, remove later
  const printItemsToBeRendered = useMemo(() => {
    return debounce(
      (virtualItems: VirtualItem[], flattenedResults: FlattenedResult) => {
        console.log(
          "printing virtual items to be rendered - ",
          virtualItems.length
        );
        virtualItems.forEach((virtualItem, i) => {
          const item = flattenedResults[virtualItem.index];
          if ("filePath" in item) {
            console.log(`result number ${i} - ${item.filePath}`);
          } else {
            console.log(`result number ${i} - ${item.content}`);
          }
        });
      },
      1000
    );
  }, []);

  const setFilePath = useCallback(
    (
      path: string | null,
      lineNumber: number,
      column: number,
      matchIndex: number
    ) => {
      if (!path) return;
      const {
        activeEditorId,
        setSelectedFilePath,
        setActiveEditorId,
        setEditorIds,
        setSearchPosition,
      } = useWorkspaceStore.getState();
      if (activeEditorId) {
        setSelectedFilePath((prev) => ({ ...prev, [activeEditorId]: path }));
      } else {
        const newEditorId = nanoid(4);
        setActiveEditorId(newEditorId);
        setEditorIds((prev) => [...prev, newEditorId]);
        setSelectedFilePath((prev) => ({
          ...prev,
          [newEditorId]: path,
        }));
      }
      setSearchPosition({ lineNumber, column, matchIndex });
    },
    []
  );

  const toggleCollapseState = (filePath: string) => () => {
    // collapseState.current[filePath] = !collapseState.current[filePath];
    // setFlattenedResults(flattenResults(searchResults, collapseState.current));
    const newCollapseState = { ...collapseState };
    newCollapseState[filePath] = !newCollapseState[filePath];
    setCollapseState(newCollapseState);
  };

  return (
    <ScrollArea
      className={"w-full h-full overflow-auto bg-[#171D2D]"}
      ref={scrollRef}
      // style={{
      //   height: `${virtualizer.getTotalSize()}px`,
      // }}
    >
      <div
        className="relative w-full bg-transparent cursor-pointer results-container"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem, i) => {
          const item = flattenedResults[virtualItem.index];
          if (i === 0) {
            printItemsToBeRendered(
              virtualizer.getVirtualItems(),
              flattenedResults
            );
          }
          if ("filePath" in item) {
            const filename = item.filePath.split("/").pop();
            tempFilePath.current = item.filePath;
            if (!collapseState[item.filePath]) {
              resultsTopPos.current[item.filePath] = virtualItem.start;
            }
            return (
              // <React.Fragment key={item.filePath}>
              <div
                className="absolute top-0 left-0 flex items-center justify-between w-full title hover:bg-[#ABB2BF] hover:bg-opacity-10"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                  height: `${virtualItem.size}px`,
                }}
                onClick={toggleCollapseState(item.filePath)}
                key={item.filePath}
              >
                <div className="flex items-center h-full gap-1 lhs">
                  {collapseState[item.filePath] ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  <div className="flex items-center gap-1 name">
                    <img
                      src={getFileIcon(filename!)}
                      alt=""
                      className="w-3 h-3"
                    />
                    <span className="text-xs">{filename}</span>
                  </div>
                </div>
                {searchResults[item.filePath] && (
                  <div className="flex items-center h-full text-xs rhs res-count">
                    <span className="text-inherit">
                      {searchResults[item.filePath].length}
                    </span>
                  </div>
                )}
              </div>
            );
          } else {
            // cbm = content before match, match = matched content, cam = content after match
            const cbm = item.content.substring(0, item.matchIndex).trimStart();
            const match = item.content.substring(
              item.matchIndex,
              item.matchIndex + searchTerm.length
            );
            const cam = item.content
              .substring(item.matchIndex + searchTerm.length)
              .trimEnd();
            const filePath = tempFilePath.current;
            return (
              <div
                className="absolute top-0 left-3 w-[calc(100%-12px)] result hover:bg-[#ABB2BF] flex items-center hover:bg-opacity-10"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                  height: `${virtualItem.size}px`,
                }}
                key={i}
                onClick={() => {
                  setFilePath(
                    filePath,
                    item.lineNumber,
                    item.matchIndex + searchTerm.length + 1,
                    item.matchIndex + 1
                  );
                }}
              >
                <span className="flex items-center w-full overflow-hidden whitespace-pre text-ellipsis">
                  <span className="text-xs">{cbm}</span>
                  <span className="text-xs bg-[#ffffff21]">{match}</span>
                  <span className="overflow-hidden text-xs text-ellipsis">
                    {cam}
                  </span>
                </span>
              </div>
            );
          }
        })}
        {Object.keys(resultsTopPos.current).map((filePath) => {
          const topPos = resultsTopPos.current[filePath];
          return (
            <div
              className="absolute top-0 left-[4.5px] w-[3px] bg-[#9DA2A6] bg-opacity-30 rounded-lg"
              style={{
                transform: `translateY(${topPos + 22}px)`,
                height: `${searchResults[filePath].length * 22}px`,
              }}
              key={filePath}
            ></div>
          );
        })}
      </div>
    </ScrollArea>
  );
};

export default React.memo(Results);
