"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import type { FocusScoreMetrics } from "@/hooks/useFocusScore";

export interface RealtimeFocusScoreProps {
  metrics: FocusScoreMetrics;
  isActive: boolean;
  className?: string;
}

export function RealtimeFocusScore({
  metrics,
  isActive,
  className,
}: RealtimeFocusScoreProps) {
  const prefersReduced = useReducedMotion();
  const { score, displayLabel, colorClass, glowColor, microcopy } = metrics;

  return (
    <div
      className={cn("flex flex-col items-center gap-2", className)}
      role="status"
      aria-label={
        score === null
          ? `Focus score: ${displayLabel}`
          : `Focus score: ${score} out of 100, ${displayLabel}`
      }
      aria-live="polite"
    >
      {/* Score value with color */}
      <motion.div
        className="flex items-center gap-3"
        animate={prefersReduced ? {} : { opacity: 1 }}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Numeric score */}
        <AnimatePresence mode="wait">
          <motion.span
            key={score}
            className={cn("text-2xl font-light tabular-nums transition-colors duration-slow", colorClass)}
            initial={prefersReduced ? {} : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? {} : { opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          >
            {score === null ? "--" : score}
          </motion.span>
        </AnimatePresence>

        <div className="flex flex-col gap-0.5" aria-hidden="true">
          {/* State label */}
          <AnimatePresence mode="wait">
            <motion.span
              key={displayLabel}
              className={cn("text-[11px] font-mono uppercase tracking-[0.2em] transition-colors duration-slow", colorClass)}
              initial={prefersReduced ? {} : { opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReduced ? {} : { opacity: 0, x: 4 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {displayLabel}
            </motion.span>
          </AnimatePresence>
          <span className="text-[9px] font-mono text-text-muted tracking-wider uppercase">Focus Score</span>
        </div>

        {/* Active pulse dot */}
        {isActive && (
          <div className="relative w-2 h-2">
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ backgroundColor: glowColor, opacity: 0.6 }}
              aria-hidden="true"
            />
            <span
              className="relative block w-2 h-2 rounded-full"
              style={{ backgroundColor: glowColor }}
              aria-hidden="true"
            />
          </div>
        )}
      </motion.div>

      {/* Microcopy */}
      <AnimatePresence mode="wait">
        <motion.p
          key={microcopy}
          className="text-[11px] text-text-muted italic font-light text-center max-w-[200px] leading-relaxed"
          initial={prefersReduced ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReduced ? {} : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          aria-hidden="true"
        >
          {microcopy}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
