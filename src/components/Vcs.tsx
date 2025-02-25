import { cn } from "../lib/utils";

export const Vcs = ({ className }: { className: string }) => {
  return (
    <div className={cn("w-full h-full flex-col", className)}>
      <div className="SC_Repos">to vcs</div>
      <div></div>
      <div></div>
    </div>
  );
};
