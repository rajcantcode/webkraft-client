import { DragHandleDots2Icon } from "@radix-ui/react-icons";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "../../lib/utils";
import { useRef, useState } from "react";

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className,
    )}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  direction,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
  direction: "vertical" | "horizontal";
}) => {
  const [isHolding, setIsHolding] = useState<boolean>(false);

  return (
    <ResizablePrimitive.PanelResizeHandle
      onDragging={(e) => {
        // e is a boolean value
        if (e) {
          setIsHolding(true);
        } else {
          if (isHolding) {
            setIsHolding(false);
          }
        }
      }}
      className={cn(
        `relative flex items-center justify-center bg-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 bg-[#0E1525] group`,
        // Base dimensions based on direction
        "data-[panel-group-direction=vertical]:h-2 data-[panel-group-direction=vertical]:w-full",
        "data-[panel-group-direction=horizontal]:w-2 data-[panel-group-direction=horizontal]:h-full",
        // After pseudo-element styles
        "after:absolute after:bg-border",
        // After pseudo-element dimensions for vertical
        "data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:top-1/2 data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:h-1/2 data-[panel-group-direction=vertical]:after:w-full",
        // After pseudo-element dimensions for horizontal
        "data-[panel-group-direction=horizontal]:after:top-0 data-[panel-group-direction=horizontal]:after:left-1/2 data-[panel-group-direction=horizontal]:after:-translate-x-1/2 data-[panel-group-direction=horizontal]:after:h-full data-[panel-group-direction=horizontal]:after:w-1/2",
        // Handle rotation for vertical direction
        // "[&[data-panel-group-direction=vertical]>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div
          className={cn(
            "transition-colors rounded-md, bg-[#2b3245]",
            direction === "vertical"
              ? isHolding
                ? "w-full h-0.5"
                : "w-6 h-0.5"
              : isHolding
                ? "w-0.5 h-full"
                : "w-0.5 h-6",

            "group-hover:bg-[#f5f9fc]",
          )}
          style={
            isHolding
              ? {
                  background:
                    "radial-gradient(circle, #0079F2 calc(100% - 48px), transparent)",
                }
              : {}
          }
        />
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
};

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
