"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useMusicStore } from "@/stores/music.store";
import { cn } from "@/lib/utils/cn";
import { Card } from "@/components/ui/Card";

export function MusicPlayer() {
  const { currentTrack, playing, volume } = useMusicStore();

  if (!currentTrack) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="p-4 space-y-3 bg-surface-deep/80 backdrop-blur-sm border-subtle-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted font-mono uppercase">
              Now Playing
            </p>
            <p className="text-sm font-medium text-text-primary mt-1">
              {currentTrack.label}
            </p>
          </div>
          <div
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              playing ? "bg-green-500 animate-pulse" : "bg-text-muted"
            )}
          />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] text-text-muted">Volume: {volume}%</p>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-focus-purple transition-all"
              style={{ width: `${volume}%` }}
            />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
