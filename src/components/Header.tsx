import { Link } from "react-router-dom";
import logo from "../icons/logo.svg";
import { IoMdExit } from "react-icons/io";
import { useUserStore, useWorkspaceStore } from "../store";
import { Button } from "./ui/Button";
import { TooltipWrapper } from "./ui/ToolTip";
const Header = () => {
  const username = useUserStore((state) => state.username);
  const setShouldBeginExitWorkspaceProcess =
    useWorkspaceStore.getState().setShouldBeginExitWorkspaceProcess;
  const workspaceName = useWorkspaceStore((state) => state.name);
  return (
    <div className="h-[47px] bg-transparent border-b border-[#2A3244] flex items-center px-2 justify-between">
      <div className="flex items-center lhs">
        <Link to="/home" className="flex items-center">
          <img src={logo} alt="" className="w-[30px] h-[30px] mr-2" />
          <p>WebKraft</p>
        </Link>
      </div>
      <div className="flex items-center gap-2 mr-1">
        {workspaceName ? (
          <TooltipWrapper title="exit workspace">
            <Button
              className="p-1 hover:bg-[#1C2333] bg-transparent group"
              onClick={() => setShouldBeginExitWorkspaceProcess(true)}
            >
              <IoMdExit className="text-lg text-[#C2C8CC] group-hover:text-[#F5F9FC]" />
            </Button>
          </TooltipWrapper>
        ) : null}
        <p>{username}</p>
      </div>
    </div>
  );
};

export default Header;
