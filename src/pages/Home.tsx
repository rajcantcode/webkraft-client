import { useEffect, useRef, useState } from "react";
import exitIcon from "../icons/exit.svg";
// import { ComboboxDemo } from "../components/ui/Combobox";
// import TemplateSearch from "../components/ui/TemplateSearch";
import TemplateSearchModal from "../components/TemplateSearchModal";
import { verifyUser } from "../helpers";
import { useUserStore } from "../store";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

const Home = () => {
  const { email, username } = useUserStore((state) => state);
  const modalRef = useRef<HTMLDialogElement>(null);
  const [templateFieldSelected, setTemplateFieldSelected] = useState(true);
  const navigate = useNavigate();

  const { isFetching: verificationPending, error } = useQuery({
    queryKey: ["auth"],
    queryFn: verifyUser,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: !username || !email,
    retry: false,
  });

  useEffect(() => {
    if (error) {
      navigate("/");
    }
  }, [error]);

  // useEffect(() => {
  //   if (data) {
  //     setUserData(data.email, data.username);
  //   }
  // }, [data]);

  const showModal = () => {
    modalRef.current?.showModal();
  };

  if (verificationPending) {
    console.log(verificationPending);
    return <div>Verifying user, please wait</div>;
  }

  if (error) {
    return <div>Error verifying user</div>;
  }

  if (email && username) {
    return (
      <div className="relative h-full bg-transparent home-container">
        <div className="absolute w-[90%] -translate-x-1/2 -translate-y-1/2  top-1/2 left-1/2 sm:w-3/4">
          <h1 className="font-bold text-[2em] mb-5">Home</h1>

          <button
            className="text-xl bg-[#0053A6] p-1 rounded-md mb-8 hover:bg-[#0079F2]"
            onClick={showModal}
          >
            + Create workspace
          </button>

          <div className="workspaces">
            <p className="text-2xl font-bold">Your workspaces</p>
          </div>

          <dialog
            className="w-full sm:w-[55%] rounded-md bg-[#1B2333]"
            ref={modalRef}
          >
            <div className="flex items-center modal-header border-b border-[#2A3244] justify-between">
              <div className="flex items-center items">
                <div
                  className="p-3 cursor-pointer hover:bg-[#4E5569] border-r border-[#2A3244]"
                  onClick={() => setTemplateFieldSelected(true)}
                >
                  <span>Choose a template</span>
                </div>
                <div
                  className="p-3 cursor-pointer hover:bg-[#4E5569]"
                  onClick={() => setTemplateFieldSelected(false)}
                >
                  <span>Import from Github</span>
                </div>
              </div>
              <div className="flex items-center p-3 btn-container">
                <button
                  className="hover:bg-[#4E5569] p-1 flex items-center rounded-sm"
                  onClick={() => modalRef.current?.close()}
                >
                  <img src={exitIcon} alt="" className="w-[20px] h-[20px]" />
                </button>
              </div>
            </div>
            {templateFieldSelected ? (
              <TemplateSearchModal />
            ) : (
              <div>Github seklecered</div>
            )}
          </dialog>
        </div>
      </div>
    );
  }
  return null;
};

export default Home;
