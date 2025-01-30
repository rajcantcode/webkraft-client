import React from "react";
import { SideBar } from "../types/sidebar";
import { LuFiles } from "react-icons/lu";
import { FaSearch } from "react-icons/fa";
import { IoMdGitBranch } from "react-icons/io";
import { IoMdSettings } from "react-icons/io";
export const Sidebar = ({
  sidebarState,
  setSidebarState,
}: {
  sidebarState: SideBar;
  setSidebarState: React.Dispatch<React.SetStateAction<SideBar>>;
}) => {
  const handleIconClick = (icon: "files" | "search" | "vcs" | "settings") => {
    setSidebarState({
      files: false,
      search: false,
      vcs: false,
      settings: false,
      [icon]: true,
    });
  };
  return (
    <div className="w-12 h-full sidebar flex flex-col items-center gap-3 bg-[#0E1525] py-1">
      <div
        className={`files cursor-pointer hover:text-[#F5F9FC] hover:bg-[#1C2333] p-2 rounded-md ${sidebarState.files ? "bg-[#171D2D] text-[#F5F9FC]" : "text-[#959a9e]"}`}
        onClick={() => handleIconClick("files")}
      >
        <LuFiles />
      </div>

      <div
        className={`files cursor-pointer hover:text-[#F5F9FC] hover:bg-[#1C2333] p-2 rounded-md ${sidebarState.search ? "bg-[#171D2D] text-[#F5F9FC]" : "text-[#959a9e]"}`}
        onClick={() => handleIconClick("search")}
      >
        <FaSearch />
      </div>
      <div
        className={`file cursor-pointer hover:text-[#F5F9FC] hover:bg-[#1C2333] p-2 rounded-md ${sidebarState.vcs ? "bg-[#171D2D] text-[#F5F9FC]" : "text-[#959a9e]"}`}
        onClick={() => handleIconClick("vcs")}
      >
        <IoMdGitBranch />
      </div>
      <div
        className={`files cursor-pointer hover:text-[#F5F9FC] hover:bg-[#1C2333] p-2 rounded-md ${sidebarState.settings ? "bg-[#171D2D] text-[#F5F9FC]" : "text-[#959a9e]"}`}
        onClick={() => handleIconClick("settings")}
      >
        <IoMdSettings />
      </div>
    </div>
  );
};
