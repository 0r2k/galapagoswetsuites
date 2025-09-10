"use client";
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

type Props = React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
  container?: HTMLElement | null;
};

export function SheetPopoverContent({ container, className, ...props }: Props) {
  return (
    <PopoverPrimitive.Portal container={container ?? undefined}>
      <PopoverPrimitive.Content
        align="start"
        sideOffset={8}
        // 🔑: permitir scroll interno aunque el body esté bloqueado por el Drawer
        data-scroll-lock-scrollable=""
        // 🔑: scroll con inercia en iOS
        style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        className={cn(
          "z-50 rounded-md border bg-popover p-0 shadow-md outline-none max-h-[75vh] overflow-y-auto touch-pan-y",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
