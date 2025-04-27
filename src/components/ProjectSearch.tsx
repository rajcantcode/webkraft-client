import { cn } from "../lib/utils";
import { Input } from "./ui/Input";
import TextareaAutosize from "react-textarea-autosize";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TooltipWrapper } from "./ui/ToolTip";
import { OS } from "../constants";
import { useHotkeys } from "react-hotkeys-hook";
import { Socket } from "socket.io-client";
import { useWorkspaceStore } from "../store";
import debounce from "lodash.debounce";
import { SearchOptions, SearchResults, CollapseState } from "../types/search";
import Results from "./Results";

interface SearchInputState {
  searchPattern: string;
  include: string;
  exclude: string;
  addToHistory: boolean;
}

interface SearchHistory {
  searchPattern: string[];
  include: string[];
  exclude: string[];
}

interface HistoryPointer {
  searchPattern: number;
  include: number;
  exclude: number;
}

export const ProjectSearch = ({
  className,
  isVisible,
  socket,
}: {
  className: string;
  isVisible: boolean;
  socket: Socket | null;
}) => {
  const searchPatternContainerRef = useRef<HTMLDivElement | null>(null);
  const inclueWrapperRef = useRef<HTMLDivElement | null>(null);
  const searchOptionsRef = useRef({
    mc: false,
    mww: false,
    useRegex: false,
  });
  const searchOnlyInOpenEditors = useRef(false);
  const requestId = useRef(0);
  const searchHistory = useRef<SearchHistory>({
    searchPattern: [],
    include: [],
    exclude: [],
  });
  const historyPointer = useRef<HistoryPointer>({
    searchPattern: 0,
    include: 0,
    exclude: 0,
  });

  const [inputState, setInputState] = useState<SearchInputState>({
    searchPattern: "",
    include: "",
    exclude: "",
    addToHistory: false,
  });
  const fileTabs = useWorkspaceStore((state) => state.fileTabs);
  const filesContent = useWorkspaceStore((state) => state.filesContent);
  const inputStateRef = useRef(inputState);

  const [error, setError] = useState<string | null>(null);
  const [showQueryDetails, setShowQueryDetails] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [collapseState, setCollapseState] = useState<CollapseState>({});
  const [showCollapseAll, setShowCollapseAll] = useState(true);

  useEffect(() => {
    if (showQueryDetails && inclueWrapperRef.current) {
      inclueWrapperRef.current.querySelector("input")?.focus();
      inclueWrapperRef.current.querySelector("input")?.select();
    } else {
      searchPatternContainerRef.current?.querySelector("textarea")?.focus();
      searchPatternContainerRef.current?.querySelector("textarea")?.select();
    }
  }, [showQueryDetails]);

  useEffect(() => {
    const keys = Object.keys(collapseState);
    if (keys.length === 0) {
      setShowCollapseAll(true);
      return;
    }
    // Check if any result is collapsed
    const hasCollapsedResults = keys.some(
      (filePath) => collapseState[filePath]
    );
    setShowCollapseAll(!hasCollapsedResults);
  }, [collapseState]);

  useEffect(() => {
    if (isVisible && searchPatternContainerRef.current) {
      searchPatternContainerRef.current.querySelector("textarea")?.focus();
      searchPatternContainerRef.current.querySelector("textarea")?.select();
    }
  }, [isVisible]);

  useEffect(() => {
    if (
      searchOnlyInOpenEditors.current &&
      inputStateRef.current.searchPattern
    ) {
      getSearchResults(false);
    }
  }, [fileTabs]);

  useEffect(() => {
    if (inputStateRef.current.searchPattern) {
      getSearchResults(false);
    }
  }, [filesContent]);

  const toggleOutline = useCallback(
    (
      ref: React.MutableRefObject<HTMLDivElement | null>,
      state: "blur" | "focus"
    ) => {
      if (!ref.current || error) return;
      ref.current.style.setProperty(
        "outline",
        state === "focus" ? "1px solid #3b8eea" : "none"
      );
    },
    [error]
  );

  useEffect(() => {
    inputStateRef.current = inputState;
    debouncedGetSearchResults(inputStateRef.current.addToHistory);
  }, [inputState]);

  const getSearchResults = useCallback(
    (addToHistory: boolean) => {
      const inputState = inputStateRef.current;
      if (!socket || !inputState.searchPattern) {
        setSearchResults(null);
        setError(null);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      let filesToInclude: string[] = [];
      if (searchOnlyInOpenEditors.current) {
        const currFileTabs = useWorkspaceStore.getState().fileTabs;
        const tempSet = new Set<string>();
        Object.keys(currFileTabs).forEach((editorId) => {
          currFileTabs[editorId].forEach((filePath) => {
            const splitPath = filePath.split("/");
            splitPath.shift();
            const relativePath = splitPath.join("/");
            if (relativePath) tempSet.add(relativePath);
          });
        });
        filesToInclude = Array.from(tempSet);
      } else {
        filesToInclude =
          inputState.include.length > 0
            ? inputState.include.split(",").map((file) => file.trim())
            : [];
      }
      const filesToExclude =
        inputState.exclude.length > 0
          ? inputState.exclude.split(",").map((file) => file.trim())
          : [];
      if (searchOptionsRef.current.useRegex) {
        try {
          const temp = new RegExp(inputState.searchPattern, "u");
        } catch (error) {
          // Invalid regex show error
          setError((error as Error).message);
          setIsSearching(false);
          return;
        }
      }
      setError(null);
      const reqId = ++requestId.current;
      if (addToHistory) {
        if (
          inputState.searchPattern !==
          searchHistory.current.searchPattern[
            searchHistory.current.searchPattern.length - 1
          ]
        ) {
          searchHistory.current.searchPattern.push(inputState.searchPattern);
          historyPointer.current.searchPattern =
            searchHistory.current.searchPattern.length - 1;
        }
        if (
          inputState.include &&
          inputState.include !==
            searchHistory.current.include[
              searchHistory.current.include.length - 1
            ]
        ) {
          searchHistory.current.include.push(inputState.include);
          historyPointer.current.include =
            searchHistory.current.include.length - 1;
        }
        if (
          inputState.exclude &&
          inputState.exclude !==
            searchHistory.current.exclude[
              searchHistory.current.exclude.length - 1
            ]
        ) {
          searchHistory.current.exclude.push(inputState.exclude);
          historyPointer.current.exclude =
            searchHistory.current.exclude.length - 1;
        }
      }
      socket.emit(
        "file:search",
        {
          pattern: inputState.searchPattern,
          options: {
            mc: searchOptionsRef.current.mc,
            mww: searchOptionsRef.current.mww,
            useRegex: searchOptionsRef.current.useRegex,
            filesToInclude: filesToInclude,
            filesToExclude: filesToExclude,
          } as SearchOptions,
        },
        (error: Error | null, results: SearchResults | null) => {
          if (reqId !== requestId.current) return;
          if (error) {
            console.log("error getting search results");
            setSearchResults(null);
            setCollapseState({});
            setIsSearching(false);
            console.log(error);
            return;
          }
          setSearchResults(results);
          if (results) {
            const newCollapseState: CollapseState = {};
            Object.keys(results).forEach((filePath) => {
              newCollapseState[filePath] = false;
            });
            setCollapseState(newCollapseState);
          } else {
            setCollapseState({});
          }
          setIsSearching(false);
        }
      );
    },
    [socket]
  );

  const debouncedGetSearchResults = useMemo(
    () => debounce(getSearchResults, 500),
    [getSearchResults]
  );

  const toggleSearchOptions = useCallback(
    (option: "mc" | "mww" | "useRegex", focus: boolean) => {
      searchOptionsRef.current[option] = !searchOptionsRef.current[option];
      if (focus) {
        searchPatternContainerRef.current?.querySelector("textarea")?.focus();
      }
      if (searchOptionsRef.current[option]) {
        // Change text color to #3b8eea
        const elem = searchPatternContainerRef.current?.querySelector(
          `.${option}`
        ) as HTMLElement | null;
        if (elem) {
          elem.style.outline = "1px solid #3b8eea";
          elem.style.backgroundColor = "#2B3245";
          elem.style.color = "#FFFFFF";
        }
      } else {
        // Change text color to default
        const elem = searchPatternContainerRef.current?.querySelector(
          `.${option}`
        ) as HTMLElement | null;
        if (elem) {
          elem.style.outline = "none";
          elem.style.backgroundColor = "";
          elem.style.color = "#C5C5C3";
        }
      }
      getSearchResults(false);
    },
    [getSearchResults]
  );

  const toggleSearchOnlyInOpenEditors = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      searchOnlyInOpenEditors.current = !searchOnlyInOpenEditors.current;
      if (searchOnlyInOpenEditors.current) {
        e.currentTarget.style.outline = "1px solid #3b8eea";
        e.currentTarget.style.backgroundColor = "#2B3245";
        e.currentTarget.style.color = "#FFFFFF";
      } else {
        e.currentTarget.style.outline = "none";
        e.currentTarget.style.backgroundColor = "";
        e.currentTarget.style.color = "#C5C5C3";
      }
      getSearchResults(false);
    },
    [getSearchResults]
  );

  const handleRefresh = useCallback(() => {
    if (!inputStateRef.current.searchPattern) return;
    getSearchResults(false);
  }, [getSearchResults]);

  const clearSearchResults = useCallback(() => {
    if (!inputStateRef.current.searchPattern) return;
    setSearchResults(null);
    setCollapseState({});
    setInputState({
      searchPattern: "",
      include: "",
      exclude: "",
      addToHistory: false,
    });
  }, []);

  const collapseSearchResults = useCallback(() => {
    if (!inputStateRef.current.searchPattern) return;
    setCollapseState((prev) => {
      const newState: CollapseState = {};
      Object.keys(prev).forEach((filePath) => {
        newState[filePath] = true;
      });
      return newState;
    });
  }, []);

  const expandSearchResults = useCallback(() => {
    if (!inputStateRef.current.searchPattern) return;
    setCollapseState((prev) => {
      const newState: CollapseState = {};
      Object.keys(prev).forEach((filePath) => {
        newState[filePath] = false;
      });
      return newState;
    });
  }, []);

  const hotKeyOptions = useMemo(
    () => ({
      enabled: isVisible,
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }),
    [isVisible]
  );
  const toggleMatchCase = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSearchOptions("mc", false);
    },
    [toggleSearchOptions]
  );
  const toggleMatchWholeWord = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSearchOptions("mww", false);
    },
    [toggleSearchOptions]
  );
  const toggleUseRegex = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSearchOptions("useRegex", false);
    },
    [toggleSearchOptions]
  );

  useHotkeys(
    `${OS === "mac" ? "alt+meta+c" : "alt+c"}`,
    toggleMatchCase,
    hotKeyOptions
  );

  useHotkeys(
    `${OS === "mac" ? "alt+meta+w" : "alt+w"}`,
    toggleMatchWholeWord,
    hotKeyOptions
  );
  useHotkeys(
    `${OS === "mac" ? "alt+meta+r" : "alt+r"}`,
    toggleUseRegex,
    hotKeyOptions
  );

  const handleOnInput = useCallback(
    (value: string, type: "searchPattern" | "include" | "exclude") => {
      setInputState((prev) => ({
        ...prev,
        [type]: value,
        addToHistory: true,
      }));
    },
    []
  );

  const navigateHistory = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // On arrow up/down navigate history and display results based upon input, but don't add those entries to history
      // If user types by themselves, add that to history, and shift pointer to last element
      // Determine on which input the keydown event was triggered
      const target = e.target as HTMLElement;
      if (target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
        return;
      }
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const parent = target.closest(".file-types");
      // if(parent && (parent.classList.contains("includes") || parent.classList.contains("excludes"))) {
      //   // Handle includes/excludes input keys
      // }
      if (parent && parent.classList.contains("includes")) {
        // Handle includes input keys
        if (e.key === "ArrowUp") {
          // Navigate history
          if (searchHistory.current.include.length === 0) return;
          if (historyPointer.current.include > 0) {
            historyPointer.current.include--;
          }
          setInputState((prev) => ({
            ...prev,
            include:
              searchHistory.current.include[historyPointer.current.include],
            addToHistory: false,
          }));
        }
        if (e.key === "ArrowDown") {
          // Navigate history
          if (searchHistory.current.include.length === 0) return;
          let pointerShifted = false;
          let pointer = historyPointer.current.include;
          if (
            historyPointer.current.include <
            searchHistory.current.include.length - 1
          ) {
            historyPointer.current.include++;
            pointerShifted = true;
            pointer++;
            if (
              historyPointer.current.include ===
              searchHistory.current.include.length - 1
            ) {
              // Increment one more time, so when user presses arrow up, it should go to last element, if we don't do this it will go to second last element
              historyPointer.current.include++;
            }
          }
          setInputState((prev) => ({
            ...prev,
            include: pointerShifted
              ? searchHistory.current.include[pointer]
              : "",
            addToHistory: false,
          }));
        }
      } else if (parent && parent.classList.contains("excludes")) {
        // Handle excludes input keys
        if (e.key === "ArrowUp") {
          // Navigate history
          if (searchHistory.current.exclude.length === 0) return;
          if (historyPointer.current.exclude > 0) {
            historyPointer.current.exclude--;
          }
          setInputState((prev) => ({
            ...prev,
            exclude:
              searchHistory.current.exclude[historyPointer.current.exclude],
            addToHistory: false,
          }));
        }
        if (e.key === "ArrowDown") {
          // Navigate history
          if (searchHistory.current.exclude.length === 0) return;
          let pointerShifted = false;
          let pointer = historyPointer.current.exclude;
          if (
            historyPointer.current.exclude <
            searchHistory.current.exclude.length - 1
          ) {
            historyPointer.current.exclude++;
            pointer++;
            pointerShifted = true;
            if (
              historyPointer.current.exclude ===
              searchHistory.current.exclude.length - 1
            ) {
              // Increment one more time, so when user presses arrow up, it should go to last element, if we don't do this it will go to second last element
              historyPointer.current.exclude++;
            }
          }
          setInputState((prev) => ({
            ...prev,
            exclude: pointerShifted
              ? searchHistory.current.exclude[pointer]
              : "",
            addToHistory: false,
          }));
        }
      } else {
        // Handle search input keys
        if (e.key === "ArrowUp") {
          // Navigate history
          if (searchHistory.current.searchPattern.length === 0) return;
          if (historyPointer.current.searchPattern > 0) {
            historyPointer.current.searchPattern--;
          }
          setInputState((prev) => ({
            ...prev,
            searchPattern:
              searchHistory.current.searchPattern[
                historyPointer.current.searchPattern
              ],
            addToHistory: false,
          }));
        }
        if (e.key === "ArrowDown") {
          // Navigate history
          if (searchHistory.current.searchPattern.length === 0) return;
          let pointerShifted = false;
          let pointer = historyPointer.current.searchPattern;
          if (
            historyPointer.current.searchPattern <
            searchHistory.current.searchPattern.length - 1
          ) {
            historyPointer.current.searchPattern++;
            pointer++;
            pointerShifted = true;
            if (
              historyPointer.current.searchPattern ===
              searchHistory.current.searchPattern.length - 1
            ) {
              // Increment one more time, so when user presses arrow up, it should go to last element, if we don't do this it will go to second last element

              historyPointer.current.searchPattern++;
            }
          }

          setInputState((prev) => ({
            ...prev,
            searchPattern: pointerShifted
              ? searchHistory.current.searchPattern[pointer]
              : "",
            addToHistory: false,
          }));
        }
      }
    },
    []
  );

  const toggleQueryDetails = useCallback(() => {
    setShowQueryDetails((prev) => !prev);
  }, []);

  return (
    <div className={cn("h-full w-full flex flex-col p-1.5 gap-3", className)}>
      <div
        className={`flex items-center justify-between header before:content-[''] before:absolute before:bottom-0 before:left-0 before:h-[2px] before:bg-[#0179F2] before:w-3 before:rounded-md relative ${
          isSearching ? "before:animate-moveX before:block" : "before:hidden"
        }`}
      >
        <p className="text-sm title">SEARCH</p>
        <div className="flex items-center gap-1 controls">
          <TooltipWrapper title="Refresh">
            <div
              className={`codicon codicon-refresh p-1 rounded-md ${
                inputState.searchPattern
                  ? "hover:bg-[#2B3245] cursor-pointer"
                  : "hover:bg-none text-[#cccccc80] cursor-default"
              }`}
              onClick={handleRefresh}
            ></div>
          </TooltipWrapper>
          <TooltipWrapper title="Clear Search Results">
            <div
              className={`codicon codicon-clear-all p-1 rounded-md ${
                inputState.searchPattern
                  ? "hover:bg-[#2B3245] cursor-pointer"
                  : "text-[#cccccc80] cursor-default hover:bg-none"
              }`}
              onClick={clearSearchResults}
            ></div>
          </TooltipWrapper>
          {showCollapseAll ? (
            <TooltipWrapper title="Collapse All">
              <div
                className={`codicon codicon-collapse-all p-1 rounded-md ${
                  inputState.searchPattern
                    ? "hover:bg-[#2B3245] cursor-pointer"
                    : "text-[#cccccc80] cursor-default hover:bg-none"
                }`}
                onClick={collapseSearchResults}
              ></div>
            </TooltipWrapper>
          ) : (
            <TooltipWrapper title="Expand All">
              <div
                className={`codicon codicon-expand-all p-1 rounded-md ${
                  inputState.searchPattern
                    ? "hover:bg-[#2B3245] cursor-pointer"
                    : "text-[#cccccc80] cursor-default hover:bg-none"
                }`}
                onClick={expandSearchResults}
              ></div>
            </TooltipWrapper>
          )}
        </div>
      </div>
      <div
        className="flex flex-col gap-2 search-inputs"
        onKeyDownCapture={navigateHistory}
      >
        <div
          className={`relative search-pattern-container bg-[#1B2333] rounded-sm `}
          style={{
            outline: error ? "1px solid #BE1000" : "",
          }}
          ref={searchPatternContainerRef}
        >
          <TextareaAutosize
            rows={1}
            maxRows={5}
            className="py-1 pl-2 pr-0 rounded-none w-[calc(100%-70px)] border-none resize-none bg-transparent outline-none text-sm"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            style={{
              scrollbarWidth: "none",
            }}
            autoFocus={true}
            value={inputState.searchPattern}
            onInput={(e) =>
              handleOnInput(e.currentTarget.value, "searchPattern")
            }
            onFocus={(e) => {
              e.currentTarget.placeholder = "Search (⇅ for history)";
              toggleOutline(searchPatternContainerRef, "focus");
            }}
            onBlur={(e) => {
              e.currentTarget.placeholder = "Search";
              toggleOutline(searchPatternContainerRef, "blur");
            }}
            // onKeyDown={}
            // onKeyDownCapture={}
            placeholder="Search"
          />
          <div className="absolute top-1 right-[2px] flex items-center gap-1 options">
            {/* mc = match case, mwww = match whole word */}
            <TooltipWrapper
              title={`Match Case (${OS === "mac" ? "⌥⌘C" : "alt+C"})`}
            >
              <div
                className="mc codicon codicon-case-sensitive cursor-pointer hover:bg-[#2B3245] p-0.5 rounded-sm text-[#C5C5C3]"
                onClick={() => toggleSearchOptions("mc", true)}
              ></div>
            </TooltipWrapper>
            <TooltipWrapper
              title={`Match Whole Word (${OS === "mac" ? "⌥⌘W" : "alt+W"})`}
            >
              <div
                className="mww codicon codicon-whole-word cursor-pointer hover:bg-[#2B3245] p-0.5 rounded-sm text-[#C5C5C3]"
                onClick={() => toggleSearchOptions("mww", true)}
              ></div>
            </TooltipWrapper>
            <TooltipWrapper
              title={`Use regex (${OS === "mac" ? "⌥⌘R" : "alt+R"})`}
            >
              <div
                className="useRegex codicon codicon-regex cursor-pointer hover:bg-[#2B3245] p-0.5 rounded-sm text-[#C5C5C3]"
                onClick={() => toggleSearchOptions("useRegex", true)}
              ></div>
            </TooltipWrapper>
          </div>
          <div
            className="absolute bottom-[-20px] right-[2px] more codicon codicon-ellipsis cursor-pointer hover:bg-[#2B3245] rounded-md z-50"
            onClick={toggleQueryDetails}
          ></div>
          {error ? (
            <p
              className={`text-xs text-white bg-[#5A1D1D] outline outline-[#BE1000] p-1 rounded-sm absolute w-full top-full z-50`}
            >
              {error}
            </p>
          ) : null}
        </div>
        {showQueryDetails ? (
          <div className="relative flex flex-col gap-1 query-details">
            <div className="file-types includes">
              <p className="text-xs">files to include</p>
              <div
                className="relative input-wrapper bg-[#1B2333] rounded-sm"
                ref={inclueWrapperRef}
              >
                <Input
                  type="text"
                  className="py-1 px-2 border-none bg-transparent rounded-none outline-none w-[calc(100%-25px)] focus-visible:ring-0"
                  onFocus={(e) => {
                    e.currentTarget.placeholder =
                      "e.g. *.ts, src/**/include (⇅ for history)";
                    toggleOutline(inclueWrapperRef, "focus");
                  }}
                  onBlur={(e) => {
                    e.currentTarget.placeholder = "e.g. *.ts, src/**/include";
                    toggleOutline(inclueWrapperRef, "blur");
                  }}
                  autoFocus={true}
                  value={inputState.include}
                  onInput={(e) =>
                    handleOnInput(e.currentTarget.value, "include")
                  }
                  placeholder="e.g. *.ts, src/**/include (⇅ for history)"
                />
                <TooltipWrapper title="Search only in open editors">
                  <div
                    className="absolute top-[50%] right-[2px] codicon codicon-book cursor-pointer hover:bg-[#2B3245] p-1 rounded-sm -translate-y-2/4 text-[#C5C5C3]"
                    onClick={toggleSearchOnlyInOpenEditors}
                  ></div>
                </TooltipWrapper>
              </div>
            </div>
            <div className="file-types excludes">
              <p className="text-xs">files to exclude</p>
              <div className="relative input-wrapper bg-[#1B2333]">
                <Input
                  type="text"
                  className="px-2 py-1 bg-transparent border-none rounded-sm focus-visible:ring-0 focus-visible:outline-[#3B8EEA] focus-visible:outline"
                  autoFocus={true}
                  value={inputState.exclude}
                  onInput={(e) =>
                    handleOnInput(e.currentTarget.value, "exclude")
                  }
                  onFocus={(e) => {
                    e.currentTarget.placeholder =
                      "e.g. node_modules, .git, build (⇅ for history)";
                  }}
                  onBlur={(e) =>
                    (e.currentTarget.placeholder =
                      "e.g. node_modules, .git, build")
                  }
                  placeholder="e.g. node_modules, .git, build"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex-1 overflow-auto search-results">
        {searchResults ? (
          <Results
            searchTerm={inputStateRef.current.searchPattern}
            searchResults={searchResults}
            collapseState={collapseState}
            setCollapseState={setCollapseState}
          />
        ) : null}
      </div>
    </div>
  );
};
