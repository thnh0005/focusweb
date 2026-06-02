"use client";

import * as React from "react";
import { Music2, X } from "lucide-react";

const SOUNDS = ["Rain", "Lo-fi", "Forest", "Cafe"];

export interface CompactSoundscapeWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompactSoundscapeWidget({
  isOpen,
  onClose,
}: CompactSoundscapeWidgetProps) {
  if (!isOpen) return null;

  return (
    <aside className="fixed bottom-28 left-1/2 z-30 w-[min(92vw,360px)] -translate-x-1/2 rounded-[1.75rem] border border-white/10 bg-[rgb(10_13_10/0.64)] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl md:left-auto md:right-6 md:translate-x-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-primary">
            <Music2 className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-text-primary">Soundscape</p>
            <p className="text-xs text-text-muted">Choose a room tone</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close soundscape"
        >
          <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {SOUNDS.map((sound) => (
          <button
            key={sound}
            type="button"
            className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sound}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-text-muted">
        Audio controls appear when a track is available.
      </p>
    </aside>
  );
}
