"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SessionControlsProps {
  isActive: boolean;
  isPaused: boolean;
  isAutoPaused: boolean;
  isLoading?: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  className?: string;
}

export function SessionControls({
  isActive,
  isPaused,
  isAutoPaused,
  isLoading = false,
  onPause,
  onResume,
  onEnd,
  className,
}: SessionControlsProps) {
  const prefersReduced = useReducedMotion();

  const showPause = isActive && !isPaused && !isAutoPaused;
  const showResume = isPaused || isAutoPaused;

  return (
    <motion.div
      className={cn("flex items-center justify-center gap-4", className)}
      initial={prefersReduced ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Primary action — Pause / Resume */}
      {showPause && (
        <PrimaryButton
          onClick={onPause}
          disabled={isLoading}
          aria-label="Pause session (Space)"
          title="Pause (Space)"
        >
          <Pause className="h-5 w-5 stroke-[1.5]" aria-hidden="true" />
          <span className="text-sm font-light tracking-wide">Pause</span>
        </PrimaryButton>
      )}

      {showResume && (
        <PrimaryButton
          onClick={onResume}
          disabled={isLoading}
          aria-label="Resume session (Space)"
          title="Resume (Space)"
          variant="resume"
        >
          <Play className="h-5 w-5 stroke-[1.5]" aria-hidden="true" />
          <span className="text-sm font-light tracking-wide">Resume</span>
        </PrimaryButton>
      )}

      {/* End session — always visible but subtle */}
      <EndButton
        onClick={onEnd}
        disabled={isLoading}
        aria-label="End session"
      >
        <Square className="h-3.5 w-3.5 stroke-[1.5]" aria-hidden="true" />
        <span className="text-xs font-mono uppercase tracking-[0.18em]">End</span>
      </EndButton>
    </motion.div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "resume";
  children: React.ReactNode;
}

function PrimaryButton({ variant = "primary", className, children, ...props }: ButtonProps) {
  const baseClasses =
    "relative flex items-center gap-2.5 px-7 py-3 rounded-full text-text-primary " +
    "transition-all duration-fast active:scale-[0.97] focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-focus-purple focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed " +
    "select-none";

  const variantClasses =
    variant === "resume"
      ? "bg-focus-purple/20 border border-focus-purple/30 hover:bg-focus-purple/30 hover:border-focus-purple/50"
      : "bg-white/8 border border-white/12 hover:bg-white/12 hover:border-white/20";

  return (
    <button
      className={cn(baseClasses, variantClasses, className)}
      {...props}
    >
      {children}
    </button>
  );
}

function EndButton({ className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-full text-urgency-coral/60 " +
          "border border-transparent hover:border-urgency-coral/20 hover:text-urgency-coral " +
          "hover:bg-urgency-coral/5 transition-all duration-fast active:scale-[0.97] " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgency-coral/60 " +
          "focus-visible:ring-offset-2 focus-visible:ring-offset-transparent " +
          "disabled:opacity-50 disabled:cursor-not-allowed select-none",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
