import { Link } from "react-router-dom";
import logo from "../icons/logo.svg";
import { useUserStore } from "../store";

const Header = () => {
  const username = useUserStore((state) => state.username);
  return (
    <div className="h-[47px] bg-transparent border-b border-[#2A3244] flex items-center px-2 justify-between">
      <div className="flex items-center lhs">
        <Link to="/home" className="flex items-center">
          <img src={logo} alt="" className="w-[30px] h-[30px] mr-2" />
          <p>Kodeit</p>
        </Link>
      </div>
      <div className="flex mr-1">
        <p>{username}</p>
      </div>
    </div>
  );
};

export default Header;
