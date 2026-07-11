"use client";

import * as React from "react";
import { AnimatedSceneBackground } from "@/components/focus-home/AnimatedSceneBackground";
import { getFocusScene } from "@/constants/focus-scenes";
import { cn } from "@/lib/utils/cn";
import { useMusicStore } from "@/stores/music.store";

export interface ImmersiveSessionShellProps {
  goalHeader: React.ReactNode;
  timer: React.ReactNode;
  state: React.ReactNode;
  controls: React.ReactNode;
  utilityDock?: React.ReactNode;
  notePanel?: React.ReactNode;
  overlays?: React.ReactNode;
  diagnostics?: React.ReactNode;
  className?: string;
}

export function ImmersiveSessionShell({
  goalHeader,
  timer,
  state,
  controls,
  utilityDock,
  notePanel,
  overlays,
  diagnostics,
  className,
}: ImmersiveSessionShellProps) {
  const currentSceneId = useMusicStore((state) => state.currentSceneId);
  const scene = getFocusScene(currentSceneId);

  return (
    <AnimatedSceneBackground
      scene={scene}
      className={cn("min-h-[100dvh] overflow-hidden", className)}
    >
      <main className="relative flex min-h-[100dvh] flex-col px-4 py-5 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-bg-void/80 to-transparent" />

        <div className="relative z-10 flex min-h-[calc(100dvh-2.5rem)] flex-col">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 pb-40 pt-8 text-center sm:gap-8 sm:pb-44 md:pb-48">
            {goalHeader}
            <div className="w-full rounded-[2rem] border border-white/[0.08] bg-black/10 px-4 py-7 shadow-glass backdrop-blur-[2px] sm:px-8 sm:py-9">
              {timer}
            </div>
            <div className="flex flex-col items-center gap-5">
              {controls}
              {state}
            </div>
          </div>

          {diagnostics && (
            <div className="pointer-events-none fixed right-4 top-4 z-20 sm:right-6 sm:top-6">
              {diagnostics}
            </div>
          )}

          {utilityDock && (
            <div className="fixed inset-x-4 bottom-4 z-30 flex justify-center sm:bottom-6">
              {utilityDock}
            </div>
          )}

          {notePanel}
        </div>

        {overlays}
      </main>
    </AnimatedSceneBackground>
  );
}
