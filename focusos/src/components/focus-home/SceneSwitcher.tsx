"use client";

import * as React from "react";
import {
  Check,
  CloudRain,
  Droplets,
  Flame,
  Library,
  Moon,
  TrainFront,
  Trees,
} from "lucide-react";
import { FOCUS_SCENES, type FocusScene } from "@/constants/focus-scenes";
import { cn } from "@/lib/utils/cn";
import { useMusicStore } from "@/stores/music.store";

const sceneIcons: Record<FocusScene["id"], React.ComponentType<{ className?: string }>> = {
  "rainy-cafe": CloudRain,
  "forest-cabin": Trees,
  "night-study": Moon,
  "hobbit-library": Library,
  "train-window": TrainFront,
  "da-lat-mist": Droplets,
};

export interface SceneSwitcherProps {
  className?: string;
  mode?: "fixed" | "inline";
}

export function SceneSwitcher({ className, mode = "fixed" }: SceneSwitcherProps) {
  const currentSceneId = useMusicStore((state) => state.currentSceneId);
  const setCurrentSceneId = useMusicStore((state) => state.setCurrentSceneId);

  return (
    <aside
      className={cn(
        "rounded-[1.6rem] border border-white/[0.14] bg-black/35 p-3 text-text-primary shadow-glass backdrop-blur-2xl",
        mode === "fixed" &&
          "fixed right-4 top-24 z-30 hidden max-h-[calc(100dvh-7rem)] w-[20rem] overflow-y-auto xl:block 2xl:right-8",
        mode === "inline" && "w-full",
        className
      )}
      aria-label="Choose focus scene"
    >
      <div className="mb-3 px-1">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-text-muted">
          Study room
        </p>
        <h2 className="mt-1 text-lg font-light text-text-primary">Choose your scene</h2>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Switch scene instantly. Music and ambient mix follow the selected room.
        </p>
      </div>

      <div className="grid gap-2.5">
        {FOCUS_SCENES.map((scene) => {
          const isActive = scene.id === currentSceneId;
          const Icon = sceneIcons[scene.id] ?? Flame;

          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => setCurrentSceneId(scene.id)}
              className={cn(
                "group relative min-h-[6.1rem] overflow-hidden rounded-3xl border p-3 text-left transition-all duration-300 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "hover:-translate-y-0.5 hover:border-white/[0.24]",
                isActive
                  ? "border-white/[0.34] bg-white/[0.12] shadow-focus-purple"
                  : "border-white/10 bg-white/[0.045] hover:bg-white/[0.08]"
              )}
              aria-pressed={isActive}
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-70 transition-transform duration-700 group-hover:scale-105"
                style={{
                  backgroundColor: scene.palette.base,
                  backgroundImage: `linear-gradient(90deg, ${scene.palette.overlay} 0%, rgba(0,0,0,0.28) 100%), url(${scene.image})`,
                }}
                aria-hidden="true"
              />
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(circle at 18% 20%, ${scene.palette.glow}, transparent 58%)`,
                }}
                aria-hidden="true"
              />

              <div className="relative flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/30 text-text-primary backdrop-blur-md">
                  <Icon className="h-4.5 w-4.5 stroke-[1.6]" aria-hidden="true" />
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-text-muted backdrop-blur-md">
                  {scene.ambientLabel}
                </span>
              </div>

              <div className="relative mt-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">{scene.name}</p>
                  {isActive && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-text-primary backdrop-blur-md">
                      <Check className="h-3 w-3 stroke-[1.8]" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-secondary">
                  {scene.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
