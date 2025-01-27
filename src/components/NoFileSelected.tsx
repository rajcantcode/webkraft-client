import logo from "../icons/logo.svg";

const NoFileSelected = () => {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="content max-w-[70%] flex flex-col items-center">
        <div className="logo w-full flex items-center justify-center">
          <img src={logo} alt="" className="w-1/2 h-1/2" />
        </div>
        <div className="shortcuts-info flex flex-col w-full">
          <div className="shortcut w-full flex items-center gap-2">
            <span className="title text-right text-sm">Show All Commands</span>
            <span className="keys flex items-center gap-1 justify-start">
              <span className="key bg-[#8080802b] border border-b-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm">
                ⇧
              </span>
              <span className="key bg-[#8080802b] border border-b-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm">
                ⌘
              </span>
              <span className="key bg-[#8080802b] border border-b-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm">
                P
              </span>
            </span>
          </div>
          <div className="shortcut w-full flex items-center gap-2">
            <span className="title text-right text-sm">Go to File</span>
            <span className="keys flex items-center gap-1">
              <span className="key bg-[#8080802b] border border-b-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm">
                ⌘
              </span>
              <span className="key bg-[#8080802b] border border-b-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm">
                P
              </span>
            </span>
          </div>
          <div className="shortcut w-full flex items-center gap-2">
            <span className="title text-right text-sm">Find in files</span>
            <span className="keys flex items-center gap-1">
              <span className="key bg-[#8080802b] border border-b-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm">
                ⇧
              </span>
              <span className="key bg-[#8080802b] border border-b-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm">
                ⌘
              </span>
              <span className="key bg-[#8080802b] border border-b-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm">
                F
              </span>
            </span>
          </div>
          <div className="shortcut w-full flex items-center gap-2">
            <span className="title text-right text-sm">Toggle Terminal</span>
            <span className="keys flex items-center gap-1">
              <span className="key bg-[#8080802b] border border-b-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm">
                ⌃
              </span>
              <span className="key bg-[#8080802b] border border-b-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm">
                `
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoFileSelected;
