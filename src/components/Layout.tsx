import Header from "./Header";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <div className="flex flex-col min-h-[100vh]">
      <Header />
      <main className="h-[calc(100vh-47px)]">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
