"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ShieldAlert, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface AutoPauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onEnd: () => void;
  isLoading?: boolean;
}

export function AutoPauseModal({
  isOpen,
  onResume,
  onEnd,
  isLoading = false,
}: AutoPauseModalProps) {
  const prefersReduced = useReducedMotion();

  // Trap focus inside modal when open
  const resumeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => resumeRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Keyboard handler
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (document.activeElement !== resumeRef.current) return;
        onResume();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onResume]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[95] bg-[#09090B]/80 backdrop-blur-sm"
            initial={prefersReduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? {} : { opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.6, 1] }}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auto-pause-title"
            aria-describedby="auto-pause-description"
            className="fixed inset-0 z-[96] flex items-center justify-center px-6"
            initial={prefersReduced ? {} : { opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReduced ? {} : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Outer bezel shell */}
            <div className="w-full max-w-md rounded-[2rem] p-[1px] bg-gradient-to-b from-white/10 to-white/4">
              {/* Inner card */}
              <div className="glass-widget rounded-[calc(2rem-1px)] p-8 flex flex-col items-center text-center gap-6">

                {/* Icon */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: "radial-gradient(circle, rgba(255,107,107,0.15) 0%, transparent 70%)" }}
                    aria-hidden="true"
                  />
                  <div className="relative w-12 h-12 rounded-full bg-urgency-coral/10 border border-urgency-coral/20 flex items-center justify-center">
                    <ShieldAlert className="h-5 w-5 text-urgency-coral stroke-[1.5]" aria-hidden="true" />
                  </div>
                </div>

                {/* Copy */}
                <div className="flex flex-col gap-2">
                  <p
                    className="text-[10px] font-mono uppercase tracking-[0.22em] text-urgency-coral"
                    aria-hidden="true"
                  >
                    Session paused
                  </p>
                  <h2
                    id="auto-pause-title"
                    className="text-xl font-light text-text-primary leading-snug"
                  >
                    Prolonged distraction detected
                  </h2>
                  <p
                    id="auto-pause-description"
                    className="text-sm text-text-secondary leading-relaxed font-light max-w-[280px]"
                  >
                    Your timer was paused after three distraction warnings. Take a breath, then
                    return to your goal when you&apos;re ready.
                  </p>
                </div>

                {/* Actions */}
                <div className="w-full flex flex-col gap-3 mt-2">
                  {/* Resume — primary */}
                  <button
                    ref={resumeRef}
                    onClick={onResume}
                    disabled={isLoading}
                    className={cn(
                      "w-full flex items-center justify-center gap-2.5 py-3.5 rounded-full",
                      "bg-focus-purple/20 border border-focus-purple/30",
                      "text-text-primary text-sm font-light tracking-wide",
                      "hover:bg-focus-purple/30 hover:border-focus-purple/50",
                      "transition-all duration-fast active:scale-[0.98]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-purple focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                    aria-label="Resume session"
                  >
                    <Play className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                    Resume Session
                  </button>

                  {/* End session — ghost */}
                  <button
                    onClick={onEnd}
                    disabled={isLoading}
                    className={cn(
                      "w-full py-2.5 rounded-full",
                      "text-xs font-mono uppercase tracking-[0.18em] text-urgency-coral/60",
                      "border border-transparent hover:border-urgency-coral/20 hover:text-urgency-coral hover:bg-urgency-coral/5",
                      "transition-all duration-fast active:scale-[0.98]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgency-coral/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                    aria-label="End session early"
                  >
                    End Session
                  </button>
                </div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
