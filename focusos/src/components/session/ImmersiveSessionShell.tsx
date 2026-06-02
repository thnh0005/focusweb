"use client";

import * as React from "react";
import { AmbientScene } from "@/components/ambient/AmbientScene";
import { cn } from "@/lib/utils/cn";

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
  return (
    <AmbientScene
      variant="forest"
      intensity="medium"
      className={cn("min-h-[100dvh] overflow-hidden", className)}
    >
      <main className="relative flex min-h-[100dvh] flex-col px-4 py-5 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-bg-void/70 to-transparent" />

        <div className="relative z-10 flex min-h-[calc(100dvh-2.5rem)] flex-col">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 pb-28 pt-8 text-center sm:gap-8 sm:pb-32 md:pb-36">
            {goalHeader}
            <div className="w-full">{timer}</div>
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
    </AmbientScene>
  );
}
