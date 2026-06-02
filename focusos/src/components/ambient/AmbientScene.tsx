import * as React from "react";
import { cn } from "@/lib/utils/cn";
import {
  AuroraBackground,
  type AuroraBackgroundIntensity,
  type AuroraBackgroundVariant,
} from "./AuroraBackground";
import { NoiseOverlay } from "./NoiseOverlay";

export interface AmbientSceneProps extends React.HTMLAttributes<HTMLElement> {
  variant?: AuroraBackgroundVariant;
  intensity?: AuroraBackgroundIntensity;
}

export function AmbientScene({
  children,
  variant = "aurora",
  intensity = "medium",
  className,
  ...props
}: AmbientSceneProps) {
  return (
    <section
      data-variant={variant}
      data-intensity={intensity}
      className={cn("ambient-page", className)}
      {...props}
    >
      <div
        aria-hidden="true"
        data-variant={variant}
        data-intensity={intensity}
        className="ambient-scene"
      >
        <AuroraBackground variant={variant} intensity={intensity} />
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>
      <NoiseOverlay />
      <div className="relative z-[2]">{children}</div>
    </section>
  );
}
