"use client";

import * as React from "react";
import { Clock, GripHorizontal, X } from "lucide-react";
import { useDraggablePopup } from "@/hooks";
import { cn } from "@/lib/utils/cn";
import type { Session } from "@/types/session.types";

export interface HistoryBottomSheetProps {
  sessions: Session[];
  isOpen: boolean;
  onClose: () => void;
  onStart: () => void;
}

export function HistoryBottomSheet({
  sessions,
  isOpen,
  onClose,
  onStart,
}: HistoryBottomSheetProps) {
  const { popupRef, dragHandleProps, dragStyle, isDragging } =
    useDraggablePopup<HTMLElement>();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
      <section
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-label="Recent focus history"
        className={cn(
          "w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[rgb(10_13_10/0.76)] p-5 shadow-[0_-20px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl",
          isDragging && "cursor-grabbing"
        )}
        style={dragStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <div
            {...dragHandleProps}
            className="flex min-w-0 flex-1 touch-none cursor-grab items-center gap-2 active:cursor-grabbing"
            title="Drag popup"
          >
            <GripHorizontal className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
            <h2 className="text-lg font-light text-text-primary">Recent rhythm</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close history"
          >
            <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 space-y-2">
          {sessions.length > 0 ? (
            sessions.slice(0, 5).map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.055] p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-primary">
                    {session.goal || (session.mode === "deep-work" ? "Deep work" : "Focus session")}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{session.mode === "deep-work" ? "Deep Work" : "Focus"}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {Math.round(session.actualDurationSeconds / 60)}m
                </div>
              </div>
            ))
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="w-full rounded-2xl bg-white/[0.055] p-5 text-center text-sm text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Start a focus session to build history.
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
