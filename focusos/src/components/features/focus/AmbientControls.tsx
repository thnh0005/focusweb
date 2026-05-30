"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Volume2, VolumeX, Play, Pause, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useMusicStore } from "@/stores/music.store";
import type { AmbientTrack } from "@/types/session.types";

// ─── Built-in ambient tracks ──────────────────────────────────────────────────
// Audio URLs use royalty-free placeholders; swap with real CDN URLs in production

const AMBIENT_TRACKS: AmbientTrack[] = [
  {
    id: "lofi",
    label: "Lo-fi",
    category: "lofi",
    icon: "🎵",
  },
  {
    id: "rain",
    label: "Rain",
    category: "rain",
    icon: "🌧",
  },
  {
    id: "nature",
    label: "Forest",
    category: "nature",
    icon: "🌿",
  },
  {
    id: "cafe",
    label: "Café",
    category: "cafe",
    icon: "☕",
  },
  {
    id: "whitenoise",
    label: "White Noise",
    category: "whitenoise",
    icon: "〰",
  },
];

export interface AmbientControlsProps {
  className?: string;
}

export function AmbientControls({ className }: AmbientControlsProps) {
  const prefersReduced = useReducedMotion();
  const { currentTrack, playing, volume, selectTrack, togglePlay, setVolume } =
    useMusicStore();

  const [expanded, setExpanded] = React.useState(false);

  const handleTrackSelect = (track: AmbientTrack) => {
    selectTrack(track);
    // Auto-play on first selection
    if (!playing) {
      setTimeout(() => useMusicStore.getState().togglePlay(), 50);
    }
  };

  return (
    <div className={cn("flex items-center gap-0", className)}>
      {/* Track selector pill — expands on hover/click */}
      <div className="relative">
        <AnimatePresence>
          {expanded && (
            <motion.div
              className="absolute bottom-full left-1/2 mb-3 flex gap-2"
              style={{ transform: "translateX(-50%)" }}
              initial={prefersReduced ? {} : { opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReduced ? {} : { opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              role="listbox"
              aria-label="Choose ambient track"
            >
              {AMBIENT_TRACKS.map((track) => (
                <button
                  key={track.id}
                  role="option"
                  aria-selected={currentTrack?.id === track.id}
                  onClick={() => {
                    handleTrackSelect(track);
                    setExpanded(false);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl transition-all duration-fast",
                    "glass-widget hover:bg-white/10 active:scale-[0.96]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-purple",
                    currentTrack?.id === track.id
                      ? "bg-focus-purple/15 border-focus-purple/30"
                      : ""
                  )}
                  aria-label={`Play ${track.label}`}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {track.icon}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-mono uppercase tracking-wider whitespace-nowrap",
                      currentTrack?.id === track.id
                        ? "text-focus-purple"
                        : "text-text-muted"
                    )}
                  >
                    {track.label}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Music toggle button */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center transition-all duration-fast",
            "hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-purple",
            expanded ? "text-text-primary bg-white/8" : "text-text-secondary"
          )}
          aria-label="Choose ambient track"
          aria-expanded={expanded}
        >
          <span className="text-sm leading-none" aria-hidden="true">
            {currentTrack ? currentTrack.icon : "🎵"}
          </span>
        </button>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-white/10 mx-1" aria-hidden="true" />

      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        disabled={!currentTrack}
        className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center transition-all duration-fast",
          "hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-purple",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          playing ? "text-text-primary" : "text-text-secondary"
        )}
        aria-label={playing ? "Pause ambient music" : "Play ambient music"}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5 stroke-[1.5]" aria-hidden="true" />
        ) : (
          <Play className="h-3.5 w-3.5 stroke-[1.5]" aria-hidden="true" />
        )}
      </button>

      {/* Current track label */}
      {currentTrack && (
        <span className="text-[10px] font-mono text-text-muted tracking-wide hidden md:block px-2 max-w-[80px] truncate">
          {currentTrack.label}
        </span>
      )}

      {/* Divider */}
      <div className="h-4 w-px bg-white/10 mx-1" aria-hidden="true" />

      {/* Volume */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVolume(volume > 0 ? 0 : 60)}
          className="h-9 w-9 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/8 transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-purple"
          aria-label={volume === 0 ? "Unmute" : "Mute"}
        >
          {volume === 0 ? (
            <VolumeX className="h-3.5 w-3.5 stroke-[1.5]" aria-hidden="true" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 stroke-[1.5]" aria-hidden="true" />
          )}
        </button>

        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-16 h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-focus-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-purple focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          aria-label={`Volume: ${volume}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={volume}
        />
      </div>
    </div>
  );
}
