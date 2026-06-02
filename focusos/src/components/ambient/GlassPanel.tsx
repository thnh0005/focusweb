import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type GlassPanelVariant = "default" | "strong" | "subtle";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassPanelVariant;
}

export function GlassPanel({
  variant = "default",
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      data-variant={variant}
      className={cn("glass-panel", className)}
      {...props}
    >
      {children}
    </div>
  );
}
