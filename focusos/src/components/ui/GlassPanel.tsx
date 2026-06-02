import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type GlassPanelProps = React.HTMLAttributes<HTMLDivElement>;

export function GlassPanel({ className, ...props }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "backdrop-blur-[16px] backdrop-saturate-[180%]",
        "shadow-[0_20px_50px_rgba(0,0,0,0.35)]",
        className
      )}
      {...props}
    />
  );
}
