"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DistractionWarningOverlayProps {
  warningLevel: 1 | 2 | 3 | null;
  onDismiss: () => void;
}

const WARNING_CONFIG = {
  1: {
    title: "Stay on track",
    body: "You seem to be drifting away from your goal. Come back and stay focused.",
    color: "amber",
    borderColor: "rgba(251, 146, 60, 0.2)",
    glowColor: "rgba(251, 146, 60, 0.08)",
    textColor: "#FB923C",
    countdown: 5,
  },
  2: {
    title: "Distraction detected",
    body: "You've been off-topic for a while. Refocus before your timer pauses automatically.",
    color: "orange",
    borderColor: "rgba(249, 115, 22, 0.3)",
    glowColor: "rgba(249, 115, 22, 0.10)",
    textColor: "#F97316",
    countdown: 5,
  },
  3: {
    title: "Final warning",
    body: "Your timer is about to pause. Return to your session goal now to continue.",
    color: "coral",
    borderColor: "rgba(255, 107, 107, 0.35)",
    glowColor: "rgba(255, 107, 107, 0.12)",
    textColor: "#FF6B6B",
    countdown: 5,
  },
} as const;

export function DistractionWarningOverlay({
  warningLevel,
  onDismiss,
}: DistractionWarningOverlayProps) {
  const prefersReduced = useReducedMotion();
  const [countdown, setCountdown] = React.useState(5);

  // Reset countdown and start ticking when warningLevel changes
  React.useEffect(() => {
    if (!warningLevel) return;
    setCountdown(5);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [warningLevel]);

  const config = warningLevel ? WARNING_CONFIG[warningLevel] : null;

  return (
    <AnimatePresence>
      {warningLevel && config && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh] px-6 pointer-events-none"
          initial={prefersReduced ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReduced ? {} : { opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          aria-live="assertive"
          aria-atomic="true"
          role="alert"
        >
          {/* Subtle background vignette */}
          <div
            className="absolute inset-0"
            style={{ background: config.glowColor }}
            aria-hidden="true"
          />

          {/* Warning card */}
          <motion.div
            className="relative pointer-events-auto max-w-sm w-full"
            initial={prefersReduced ? {} : { y: -20, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={prefersReduced ? {} : { y: -16, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Outer shell — Double-Bezel per design spec */}
            <div
              className="rounded-[1.5rem] p-[1px]"
              style={{ background: config.borderColor }}
            >
              <div
                className="glass-widget rounded-[calc(1.5rem-1px)] p-5 flex flex-col gap-3"
                style={{
                  boxShadow: `0 0 40px ${config.glowColor}, inset 0 1px 0 rgba(255,255,255,0.10)`,
                }}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle
                      className="h-4 w-4 shrink-0 stroke-[1.5]"
                      style={{ color: config.textColor }}
                      aria-hidden="true"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="text-[10px] font-mono uppercase tracking-[0.2em]"
                        style={{ color: config.textColor }}
                      >
                        Warning {warningLevel} / 3
                      </span>
                      <p className="text-sm font-light text-text-primary leading-snug">
                        {config.title}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onDismiss}
                    className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/8 transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-purple"
                    aria-label="Dismiss warning"
                  >
                    <X className="h-3.5 w-3.5 stroke-[1.5]" aria-hidden="true" />
                  </button>
                </div>

                {/* Body */}
                <p className="text-xs text-text-secondary leading-relaxed font-light">
                  {config.body}
                </p>

                {/* Countdown bar */}
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-0.5 bg-white/8 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: config.textColor }}
                      initial={{ width: "100%" }}
                      animate={{ width: `${(countdown / 5) * 100}%` }}
                      transition={{ duration: 1, ease: "linear" }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-mono tabular-nums"
                    style={{ color: config.textColor }}
                    aria-hidden="true"
                  >
                    {countdown}s
                  </span>
                </div>

                {/* CTA */}
                <button
                  onClick={onDismiss}
                  className="mt-1 w-full py-2.5 rounded-full text-xs font-mono uppercase tracking-[0.18em] transition-all duration-fast active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    color: config.textColor,
                    borderColor: config.borderColor,
                    border: `1px solid ${config.borderColor}`,
                    backgroundColor: `${config.glowColor}`,
                  }}
                  aria-label="Return to focus"
                >
                  I&apos;m back — continue session
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
