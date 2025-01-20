import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Symbol } from "../types/symbol";
import FileTree from "./FileTree";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "./ui/Breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";
import {
  ConstSVG,
  ClassSVG,
  EnumSVG,
  FuncSVG,
  InterfaceSVG,
  LetSVG,
  PropertySVG,
} from "./BreadcrumbIconsSvg";
import { Socket } from "socket.io-client";
import { getBreadcrumbIcon } from "../lib/utils";
import { ScrollArea, ScrollBar } from "./ui/ScrollArea";

type SymbolsToDisplay = {
  [depth: number]: Symbol[];
};
type HighlightedSymbol = {
  [depth: number]: Symbol;
};

const BreadCrumbWrapper = React.memo(
  ({
    fileFetchStatus,
    socket,
    cursorPos,
    filePath,
    moveToOffset,
    breadcrumbTree,
  }: {
    fileFetchStatus: { [key: string]: boolean };
    socket: Socket | null;
    cursorPos: number;
    filePath: string;
    moveToOffset: (offset: number) => void;
    breadcrumbTree: Symbol | null;
  }) => {
    const [symbolsToDisplay, setSymbolsToDisplay] = useState<SymbolsToDisplay>(
      {},
    );
    const [openedDropDown, setOpenedDropDown] = useState<string>("");
    const [highlightedSymbol, setHighlightedSymbol] =
      useState<HighlightedSymbol>({});

    const getSymbolsToDisplay = useCallback(
      (
        breadcrumbTree: Symbol,
        symbolsToDisplay: SymbolsToDisplay,
        highlightedSymbol: HighlightedSymbol,
        cursorPos: number,
        depth = 1,
      ) => {
        symbolsToDisplay[depth] = breadcrumbTree.childItems;
        for (const child of breadcrumbTree.childItems) {
          if (child.startOffset <= cursorPos && child.endOffset >= cursorPos) {
            highlightedSymbol[depth] = child;
            getSymbolsToDisplay(
              child,
              symbolsToDisplay,
              highlightedSymbol,
              cursorPos,
              depth + 1,
            );
            // break the loop, cause any other symbol will be inside this symbol
            break;
          }
        }
      },
      [],
    );
    useEffect(() => {
      if (!breadcrumbTree) {
        setSymbolsToDisplay({});
        setHighlightedSymbol({});
        return;
      }
      const symbols: SymbolsToDisplay = {};
      const highlighted: HighlightedSymbol = {};
      getSymbolsToDisplay(breadcrumbTree, symbols, highlighted, cursorPos);
      setSymbolsToDisplay(symbols);
      setHighlightedSymbol(highlighted);
    }, [cursorPos, breadcrumbTree, getSymbolsToDisplay]);

    const symbolsToDisplayKeys = useMemo(
      () => Object.keys(symbolsToDisplay),
      [symbolsToDisplay],
    );

    return (
      <ScrollArea className="w-full h-full">
        <div className="w-full h-full bg-[#1B2333] flex items-center px-0.5 group overflow-auto flex-nowrap">
          <Breadcrumb>
            <BreadcrumbList className="gap-1 sm:gap-1 flex-nowrap">
              {filePath
                .split("/")
                .map((fileOrFolderName, index, filePathArr) => {
                  if (index === 0) return null;
                  let path = "";
                  for (let i = 0; i < index; i++) {
                    path +=
                      i === 0 ? `${filePathArr[i]}` : `/${filePathArr[i]}`;
                  }
                  return (
                    <React.Fragment key={fileOrFolderName}>
                      <BreadcrumbItem className="hover:bg-[#3C445C] rounded-md p-1">
                        <DropdownMenu
                          onOpenChange={(open) => {
                            if (open) setOpenedDropDown(fileOrFolderName);
                            else setOpenedDropDown("");
                          }}
                        >
                          <DropdownMenuTrigger className="flex items-center gap-1 w-max">
                            <img
                              src={getBreadcrumbIcon(fileOrFolderName)}
                              alt=""
                              className="w-3 h-3"
                            />
                            <span
                              className={`text-xs ${
                                fileOrFolderName === openedDropDown
                                  ? "text-[#f5f9fc]"
                                  : "text-[#c2c8cc]"
                              } group-hover:text-[#f5f9fc]`}
                            >
                              {fileOrFolderName}
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="max-h-[400px] min-w-[165px] max-w-[300px] border-[#4E5569] px-0 rounded-md bg-[#0E1525] overflow-auto"
                          >
                            <DropdownMenuItem className="flex p-0 overflow-hidden">
                              <FileTree
                                fileFetchStatus={fileFetchStatus}
                                socket={socket}
                                startPath={path}
                                padLeft={8}
                              />
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </BreadcrumbItem>

                      {index + 1 !== filePathArr.length ||
                      (symbolsToDisplayKeys.length !== 0 &&
                        symbolsToDisplay[Number(symbolsToDisplayKeys[0])]
                          ?.length !== 0) ? (
                        <BreadcrumbSeparator className="text-[#c2c8cc]" />
                      ) : null}
                    </React.Fragment>
                  );
                })}
              {symbolsToDisplayKeys.map((depth, i) => {
                const symbolsArray = symbolsToDisplay[Number(depth)];
                if (symbolsArray.length === 0) return null;
                const highlightSymbol = highlightedSymbol[Number(depth)];
                const highlightKind = highlightSymbol?.kind;

                return (
                  <React.Fragment key={depth}>
                    <BreadcrumbItem className="hover:bg-[#3c445c] rounded-md p-1">
                      <DropdownMenu
                        onOpenChange={(open) => {
                          if (open) setOpenedDropDown(depth);
                          else setOpenedDropDown("");
                        }}
                      >
                        <DropdownMenuTrigger className="w-max">
                          {highlightSymbol ? (
                            <div className="flex items-center gap-1">
                              {highlightKind === "const" ? (
                                <ConstSVG size={12} />
                              ) : highlightKind === "let" ||
                                highlightKind === "var" ||
                                highlightKind === "type" ? (
                                <LetSVG size={12} />
                              ) : highlightKind === "function" ? (
                                <FuncSVG size={12} />
                              ) : highlightKind === "class" ? (
                                <ClassSVG size={12} />
                              ) : highlightKind === "interface" ? (
                                <InterfaceSVG size={12} />
                              ) : highlightKind === "property" ? (
                                <PropertySVG size={12} />
                              ) : highlightKind === "enum" ? (
                                <EnumSVG size={12} />
                              ) : (
                                <PropertySVG size={12} />
                              )}
                              <span
                                className={`text-xs ${
                                  depth === openedDropDown
                                    ? "text-[#f5f9fc]"
                                    : "text-[#c2c8cc]"
                                } group-hover:text-[#f5f9fc]`}
                              >
                                {highlightSymbol.text}
                              </span>
                            </div>
                          ) : (
                            <span>...</span>
                          )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="max-h-[400px] overflow-y-auto min-w-[165px] border-[#4E5569] rounded-md bg-[#2b3245] cursor-pointer"
                        >
                          {symbolsArray.map((symbol) => {
                            const kind = symbol.kind;
                            return (
                              <DropdownMenuItem
                                key={symbol.startOffset}
                                className="hover:bg-[#3c445c] cursor-pointer rounded-md h-8 sm:h-6"
                                onClick={() => moveToOffset(symbol.startOffset)}
                              >
                                <div className="flex items-center gap-1">
                                  {kind === "const" ? (
                                    <ConstSVG />
                                  ) : kind === "let" ||
                                    kind === "var" ||
                                    kind === "type" ? (
                                    <LetSVG />
                                  ) : kind === "function" ? (
                                    <FuncSVG />
                                  ) : kind === "class" ? (
                                    <ClassSVG />
                                  ) : kind === "interface" ? (
                                    <InterfaceSVG />
                                  ) : kind === "property" ? (
                                    <PropertySVG />
                                  ) : kind === "enum" ? (
                                    <EnumSVG />
                                  ) : (
                                    <PropertySVG />
                                  )}
                                  <span>{symbol.text}</span>
                                </div>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </BreadcrumbItem>
                    {highlightSymbol &&
                    symbolsToDisplay[Number(depth) + 1]?.length !== 0 ? (
                      <BreadcrumbSeparator className="text-[#c2c8cc]" />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  },
);

BreadCrumbWrapper.displayName = "BreadCrumbWrapper";
export default BreadCrumbWrapper;
