"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FileText, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SessionNotepadProps {
  isOpen: boolean;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
}

const MAX_CHARS = 500;

export function SessionNotepad({
  isOpen,
  note,
  onNoteChange,
  onClose,
}: SessionNotepadProps) {
  const prefersReduced = useReducedMotion();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const remaining = MAX_CHARS - note.length;

  // Auto-focus textarea when opened
  React.useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => textareaRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          role="complementary"
          aria-label="Session notepad"
          className={cn(
            "fixed bottom-24 right-6 z-[80] w-72 md:w-80",
            "pointer-events-auto"
          )}
          initial={prefersReduced ? {} : { opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={prefersReduced ? {} : { opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Outer bezel */}
          <div className="rounded-2xl p-[1px] bg-gradient-to-b from-white/10 to-white/4">
            <div className="glass-widget rounded-[calc(1rem-1px)] overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-text-muted stroke-[1.5]" aria-hidden="true" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted">
                    Session Note
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="h-6 w-6 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/8 transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-purple"
                  aria-label="Close notepad"
                >
                  <X className="h-3 w-3 stroke-[1.5]" aria-hidden="true" />
                </button>
              </div>

              {/* Textarea */}
              <div className="p-4">
                <textarea
                  ref={textareaRef}
                  id="session-note"
                  value={note}
                  onChange={(e) => onNoteChange(e.target.value.slice(0, MAX_CHARS))}
                  placeholder="Jot a quick note about what you're working on…"
                  rows={5}
                  className={cn(
                    "w-full bg-transparent resize-none text-sm text-text-primary font-light leading-relaxed",
                    "placeholder:text-text-muted/50 placeholder:text-xs placeholder:font-light",
                    "focus:outline-none"
                  )}
                  aria-label="Session note"
                  aria-describedby="note-char-count"
                />
                <div
                  id="note-char-count"
                  className={cn(
                    "text-right text-[10px] font-mono mt-1 transition-colors duration-fast",
                    remaining < 50 ? "text-urgency-amber" : "text-text-muted"
                  )}
                  aria-live="polite"
                >
                  {remaining} left
                </div>
              </div>

              {/* Hint */}
              <div className="px-4 pb-3">
                <p className="text-[9px] font-mono text-text-muted/60 tracking-wide">
                  Press <kbd className="px-1 py-0.5 rounded bg-white/8 text-text-muted">N</kbd> or <kbd className="px-1 py-0.5 rounded bg-white/8 text-text-muted">Esc</kbd> to close
                </p>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
