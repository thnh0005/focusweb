import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type NoiseOverlayProps = React.HTMLAttributes<HTMLDivElement>;

export function NoiseOverlay({ className, ...props }: NoiseOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("noise-overlay", className)}
      {...props}
    />
  );
}
