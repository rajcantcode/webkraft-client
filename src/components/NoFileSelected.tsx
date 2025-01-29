import logo from "../icons/logo.svg";

const shortcut = "shortcut flex items-center w-full justify-between my-2";
const shortcutTitle = "title text-sm text-right w-[calc(100%-75px)] mr-4";
const shortCutKeys = "keys flex items-center gap-1 justify-start min-w-[75px]";
const shortcutKey =
  "key bg-[#3534342b] border border-[#44444499] shadow-[inset_0_-1px_0_#0000005c] px-1 py-0.5 text-xs rounded-sm min-w-[22px] max-w-[22px] text-center";

const NoFileSelected = () => {
  return (
    <div className="flex items-center justify-center w-full h-full bg-[#1B2333]">
      <div className="content max-w-[70%] flex flex-col items-center">
        <div className="flex items-center justify-center w-full logo">
          <img src={logo} alt="" className="w-1/2 h-1/2" />
        </div>
        <div className="flex flex-col shortcuts-info">
          <div className={shortcut}>
            <p className={shortcutTitle}>Show All Commands</p>
            <span className={shortCutKeys}>
              <span className={shortcutKey}>⇧</span>
              <span className={shortcutKey}>⌘</span>
              <span className={shortcutKey}>P</span>
            </span>
          </div>
          <div className={shortcut}>
            <p className={shortcutTitle}>Go to File</p>
            <span className={shortCutKeys}>
              <span className={shortcutKey}>⌘</span>
              <span className={shortcutKey}>P</span>
            </span>
          </div>
          <div className={shortcut}>
            <p className={shortcutTitle}>Find in files</p>
            <span className={shortCutKeys}>
              <span className={shortcutKey}>⇧</span>
              <span className={shortcutKey}>⌘</span>
              <span className={shortcutKey}>F</span>
            </span>
          </div>
          <div className={shortcut}>
            <p className={shortcutTitle}>Toggle Terminal</p>
            <span className={shortCutKeys}>
              <span className={shortcutKey}>⌃</span>
              <span className={shortcutKey}>`</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoFileSelected;
