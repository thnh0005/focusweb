import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type AuroraBackgroundVariant = "aurora" | "minimal" | "forest" | "rain";
export type AuroraBackgroundIntensity = "low" | "medium" | "high";

export interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AuroraBackgroundVariant;
  intensity?: AuroraBackgroundIntensity;
}

export function AuroraBackground({
  variant = "aurora",
  intensity = "medium",
  className,
  ...props
}: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      data-variant={variant}
      data-intensity={intensity}
      className={cn("aurora-background", className)}
      {...props}
    />
  );
}
