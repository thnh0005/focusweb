"use client";

import * as React from "react";
import { Volume2, Play, Pause, SkipForward, Music } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/Tooltip";
import { cn } from "@/lib/utils/cn";

export interface FocusLayoutProps {
  children: React.ReactNode;
  phase?: "focus" | "short-break" | "long-break";
  onEndSession?: () => void;
}

export function FocusLayout({
  children,
  phase = "focus",
  onEndSession,
}: FocusLayoutProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [volume, setVolume] = React.useState(70);
  const [trackName, setTrackName] = React.useState("Stoic Echoes (Lofi)");

  // Translate phase to micro-copy message (design1.md spec)
  const getMicroCopy = () => {
    switch (phase) {
      case "short-break":
        return "Rest your eyes";
      case "long-break":
        return "Step away, breathe";
      case "focus":
      default:
        return "Stay in the zone";
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-[100dvh] bg-background text-text-primary overflow-hidden relative flex flex-col justify-between p-6 select-none">
        
        {/* Layer 2: Animated Ambient Background Orbs */}
        <div className="ambient-orbs phase-transition" data-phase={phase}>
          <div className="ambient-orb ambient-orb-1" />
          <div className="ambient-orb ambient-orb-2" />
          <div className="ambient-orb ambient-orb-3" />
        </div>

        {/* Top Header - Micro Ambient Message (Stoic quote vibe) */}
        <header className="w-full flex justify-between items-center z-10 p-2">
          <div className="flex items-center space-x-2">
            <div className="h-3 w-3 rounded-full bg-focus-purple-muted flex items-center justify-center">
              <span className="h-1 w-1 rounded-full bg-focus-purple" />
            </div>
            <span className="text-[11px] font-mono tracking-[0.22em] text-text-muted uppercase">
              Sanctuary Mode
            </span>
          </div>

          <div className="text-xs italic text-text-secondary transition-all duration-800 tracking-wide font-light">
            &ldquo;{getMicroCopy()}&rdquo;
          </div>
        </header>

        {/* Core Timer Center Stage */}
        <div className="flex-1 flex items-center justify-center z-10 py-12">
          <div className="w-full max-w-lg flex flex-col items-center">
            {children}
          </div>
        </div>

        {/* Bottom Panel Wrapper */}
        <footer className="w-full flex flex-col md:flex-row items-center justify-between gap-6 z-10 p-2">
          {/* spacer */}
          <div className="hidden md:block w-32" />

          {/* Floating Music HUD Controls (Bottom Center - design1.md spec) */}
          <div className="control-dock glass-action text-text-primary flex items-center justify-between w-max gap-5">
            <div className="flex items-center space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-full"
                    onClick={() => setIsPlaying(!isPlaying)}
                    aria-label={isPlaying ? "Pause music" : "Play music"}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4 stroke-[1.5]" />
                    ) : (
                      <Play className="h-4 w-4 stroke-[1.5]" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isPlaying ? "Pause" : "Play"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-full"
                    aria-label="Next track"
                  >
                    <SkipForward className="h-4 w-4 stroke-[1.5]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Next Track</TooltipContent>
              </Tooltip>
            </div>

            <div className="h-5 w-px bg-white/10" />

            {/* Track Info */}
            <div className="flex items-center space-x-2 px-1 max-w-[140px] md:max-w-[200px]">
              <Music className="h-3.5 w-3.5 text-text-muted shrink-0" />
              <span className="text-[10px] font-mono tracking-wide truncate text-text-secondary">
                {trackName}
              </span>
            </div>

            <div className="h-5 w-px bg-white/10" />

            {/* Volume Control */}
            <div className="flex items-center space-x-2 pr-1">
              <Volume2 className="h-4 w-4 text-text-secondary shrink-0" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-focus-purple"
                aria-label="Volume slider"
              />
            </div>
          </div>

          {/* End Session Pill (Bottom Right - design1.md spec) */}
          <div className="w-full md:w-auto flex justify-center md:justify-end">
            <Button
              variant="ghost"
              className="text-xs text-urgency-coral hover:text-urgency-coral/80 font-mono tracking-wider uppercase border border-transparent hover:border-urgency-coral/10 hover:bg-urgency-coral/5 rounded-full px-4 h-9 active:scale-[0.98]"
              onClick={onEndSession}
            >
              ⏸ End Session
            </Button>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
