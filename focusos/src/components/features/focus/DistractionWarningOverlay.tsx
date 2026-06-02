"use client";

import * as React from "react";
import { AlertTriangle, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface DistractionWarningOverlayProps {
  warningLevel: 1 | 2 | 3 | null;
  onDismiss: () => void;
}

const WARNING_CONFIG = {
  1: {
    title: "Return to the room",
    body: "Your attention has started to drift. Come back to the session goal.",
    tone: "text-urgency-amber",
    border: "border-urgency-amber/30",
    surface: "bg-urgency-amber/10",
    backdrop: "bg-transparent",
    placement: "items-start pt-[12dvh]",
    size: "max-w-md",
  },
  2: {
    title: "Distraction detected",
    body: "You have been away from the focus path for a little while. Refocus before the timer pauses.",
    tone: "text-orange-300",
    border: "border-orange-300/35",
    surface: "bg-orange-300/[0.12]",
    backdrop: "bg-bg-void/45",
    placement: "items-start pt-[16dvh]",
    size: "max-w-lg",
  },
  3: {
    title: "Final refocus check",
    body: "This session is about to pause. Return to your goal now or take the pause and restart calmly.",
    tone: "text-urgency-coral",
    border: "border-urgency-coral/40",
    surface: "bg-urgency-coral/[0.12]",
    backdrop: "bg-bg-void/78",
    placement: "items-center",
    size: "max-w-xl",
  },
} as const;

export function DistractionWarningOverlay({
  warningLevel,
  onDismiss,
}: DistractionWarningOverlayProps) {
  const prefersReduced = useReducedMotion();
  const config = warningLevel ? WARNING_CONFIG[warningLevel] : null;

  return (
    <AnimatePresence>
      {warningLevel && config && (
        <motion.div
          className={cn(
            "fixed inset-0 z-[90] flex justify-center px-4 py-6",
            config.placement
          )}
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReduced ? {} : { opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          role={warningLevel === 3 ? "alertdialog" : "alert"}
          aria-modal={warningLevel === 3 ? true : undefined}
          aria-labelledby="distraction-warning-title"
          aria-describedby="distraction-warning-body"
          aria-live="assertive"
        >
          <div
            className={cn("absolute inset-0 backdrop-blur-sm", config.backdrop)}
            aria-hidden="true"
          />

          <motion.div
            className={cn("relative w-full pointer-events-auto", config.size)}
            initial={prefersReduced ? false : { y: warningLevel === 3 ? 18 : -18, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={prefersReduced ? {} : { y: warningLevel === 3 ? 12 : -12, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className={cn(
                "glass-widget rounded-3xl border p-4 shadow-glass sm:p-5",
                warningLevel === 3 && "p-6 text-center sm:p-8",
                config.border
              )}
            >
              <div className={cn("flex gap-4", warningLevel === 3 ? "flex-col items-center" : "items-start")}>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
                    config.border,
                    config.surface,
                    config.tone
                  )}
                  aria-hidden="true"
                >
                  <AlertTriangle className="h-5 w-5 stroke-[1.6]" />
                </div>

                <div className={cn("min-w-0 flex-1", warningLevel === 3 && "flex flex-col items-center")}>
                  <p className={cn("text-[11px] font-mono", config.tone)}>
                    Warning {warningLevel}/3
                  </p>
                  <h2
                    id="distraction-warning-title"
                    className="mt-1 text-lg font-light leading-tight text-text-primary sm:text-xl"
                  >
                    {config.title}
                  </h2>
                  <p
                    id="distraction-warning-body"
                    className="mt-2 max-w-[34rem] text-sm font-light leading-relaxed text-text-secondary"
                  >
                    {config.body}
                  </p>

                  <CountdownLine
                    key={warningLevel}
                    barClassName={config.surface}
                    textClassName={config.tone}
                  />
                </div>

                {warningLevel !== 3 && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Dismiss warning"
                  >
                    <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onDismiss}
                className={cn(
                  "mt-5 w-full rounded-full border px-4 py-3 text-sm font-medium transition-all duration-fast active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  config.border,
                  config.surface,
                  config.tone
                )}
              >
                I&apos;m back, continue session
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CountdownLine({
  barClassName,
  textClassName,
}: {
  barClassName: string;
  textClassName: string;
}) {
  const [countdown, setCountdown] = React.useState(5);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="mt-4 flex w-full items-center gap-3">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          className={cn("h-full rounded-full", barClassName)}
          initial={{ width: "100%" }}
          animate={{ width: `${(countdown / 5) * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
      <span className={cn("w-8 text-right text-[11px] font-mono tabular-nums", textClassName)}>
        {countdown}s
      </span>
    </div>
  );
}
