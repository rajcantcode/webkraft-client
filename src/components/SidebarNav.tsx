import React from "react";
import { SideBar } from "../types/sidebar";
import { LuFiles } from "react-icons/lu";
import { FaSearch } from "react-icons/fa";
import { IoMdGitBranch } from "react-icons/io";
import { IoMdSettings } from "react-icons/io";
import { TooltipWrapper } from "./ui/ToolTip";
import { OS } from "../constants";
import { useHotkeys } from "react-hotkeys-hook";
export const SidebarNav = ({
  sidebarNavState,
  setSidebarNavState,
  showSidebar,
  setShowSidebar,
}: {
  sidebarNavState: SideBar;
  setSidebarNavState: React.Dispatch<React.SetStateAction<SideBar>>;
  showSidebar: boolean;
  setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const handleIconClick = (icon: "files" | "search" | "vcs" | "settings") => {
    if (showSidebar) {
      if (sidebarNavState[icon]) {
        setShowSidebar(false);
      } else {
        setSidebarNavState({
          files: false,
          search: false,
          vcs: false,
          settings: false,
          [icon]: true,
        });
      }
    } else {
      setSidebarNavState({
        files: false,
        search: false,
        vcs: false,
        settings: false,
        [icon]: true,
      });
      setShowSidebar(true);
    }
  };

  useHotkeys(
    `${OS === "mac" ? "shift+meta+e" : "ctrl+shift+e"}`,
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleIconClick("files");
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
  );
  useHotkeys(
    `${OS === "mac" ? "shift+meta+f" : "ctrl+shift+f"}`,
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleIconClick("search");
    },
    {
      enabled: true,
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
  );
  useHotkeys(
    `${OS === "mac" ? "ctrl+meta+g" : "ctrl+shift+g"}`,
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleIconClick("vcs");
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
  );
  useHotkeys(
    `${OS === "mac" ? "meta+comma" : "ctrl+comma"}`,
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleIconClick("settings");
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
  );

  return (
    <div className="w-12 h-full sidebar flex flex-col items-center gap-3 bg-[#0E1525] py-1">
      <TooltipWrapper
        title={`Explorer (${OS === "mac" ? "⇧⌘E" : "ctrl+shift+E"})`}
        side="right"
      >
        <div
          className={`files cursor-pointer hover:text-[#F5F9FC] hover:bg-[#1C2333] p-2 rounded-md ${
            showSidebar && sidebarNavState.files
              ? "bg-[#171D2D] text-[#F5F9FC]"
              : "text-[#959a9e]"
          }`}
          onClick={() => handleIconClick("files")}
        >
          <LuFiles />
        </div>
      </TooltipWrapper>

      <TooltipWrapper
        title={`Search (${OS === "mac" ? "⇧⌘F" : "ctrl+shift+F"})`}
        side="right"
      >
        <div
          className={`files cursor-pointer hover:text-[#F5F9FC] hover:bg-[#1C2333] p-2 rounded-md ${
            showSidebar && sidebarNavState.search
              ? "bg-[#171D2D] text-[#F5F9FC]"
              : "text-[#959a9e]"
          }`}
          onClick={() => handleIconClick("search")}
        >
          <FaSearch />
        </div>
      </TooltipWrapper>
      <TooltipWrapper
        title={`Source Control (${OS === "mac" ? "⌃⌘G" : "ctrl+shift+G"})`}
        side="right"
      >
        <div
          className={`file cursor-pointer hover:text-[#F5F9FC] hover:bg-[#1C2333] p-2 rounded-md ${
            showSidebar && sidebarNavState.vcs
              ? "bg-[#171D2D] text-[#F5F9FC]"
              : "text-[#959a9e]"
          }`}
          onClick={() => handleIconClick("vcs")}
        >
          <IoMdGitBranch />
        </div>
      </TooltipWrapper>
      <TooltipWrapper
        title={`Settings (${OS === "mac" ? "⌘," : "ctrl+,"})`}
        side="right"
      >
        <div
          className={`files cursor-pointer hover:text-[#F5F9FC] hover:bg-[#1C2333] p-2 rounded-md ${
            showSidebar && sidebarNavState.settings
              ? "bg-[#171D2D] text-[#F5F9FC]"
              : "text-[#959a9e]"
          }`}
          onClick={() => handleIconClick("settings")}
        >
          <IoMdSettings />
        </div>
      </TooltipWrapper>
    </div>
  );
};
