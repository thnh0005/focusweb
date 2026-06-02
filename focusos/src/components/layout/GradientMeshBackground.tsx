"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export type GradientMeshMode =
  | "focus"
  | "short-break"
  | "long-break"
  | "landing"
  | "onboarding";

const PALETTES: Record<GradientMeshMode, string[]> = {
  focus: ["#6B4FBB", "#3B3AB8", "#C7437A", "#E8625A", "#F0956A"],
  "short-break": ["#1D9E75", "#0EA5E9", "#6B4FBB", "#1D9E75", "#0EA5E9"],
  "long-break": ["#1E3A5F", "#3B3AB8", "#F0956A", "#1E3A5F", "#C7437A"],
  landing: ["#6B4FBB", "#3B3AB8", "#C7437A", "#E8625A", "#F0956A"],
  onboarding: ["#6B4FBB", "#3B3AB8", "#C7437A", "#E8625A", "#F0956A"],
};

const BLOBS = [
  { id: "blob-1", size: "72vw", top: "-20%", left: "-10%", opacity: 0.7, duration: 22 },
  { id: "blob-2", size: "68vw", top: "-25%", right: "-15%", opacity: 0.65, duration: 28 },
  { id: "blob-3", size: "60vw", bottom: "-30%", left: "10%", opacity: 0.6, duration: 18 },
  { id: "blob-4", size: "55vw", bottom: "-20%", right: "5%", opacity: 0.55, duration: 25 },
  { id: "blob-5", size: "50vw", top: "20%", left: "30%", opacity: 0.5, duration: 32 },
];

export interface GradientMeshBackgroundProps {
  mode?: GradientMeshMode;
  className?: string;
}

export function GradientMeshBackground({
  mode = "focus",
  className,
}: GradientMeshBackgroundProps) {
  const reduceMotion = useReducedMotion();
  const palette = PALETTES[mode] ?? PALETTES.focus;

  return (
    <div className={cn("gradient-mesh", className)} aria-hidden="true">
      {BLOBS.map((blob, index) => {
        const color = palette[index % palette.length];
        const style = {
          width: blob.size,
          height: blob.size,
          top: blob.top,
          right: blob.right,
          bottom: blob.bottom,
          left: blob.left,
          opacity: blob.opacity,
          animation: reduceMotion
            ? "none"
            : `mesh-float ${blob.duration}s ease-in-out infinite alternate`,
          "--mesh-color": color,
        } as React.CSSProperties;

        return (
          <motion.div
            key={blob.id}
            className="mesh-blob"
            style={style}
            animate={{ "--mesh-color": color } as Record<string, string>}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
        );
      })}
    </div>
  );
}
