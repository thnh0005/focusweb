"use client";

import * as React from "react";
import type { FocusScene, SceneMotionType } from "@/constants/focus-scenes";
import { cn } from "@/lib/utils/cn";

export interface AnimatedSceneBackgroundProps {
  scene: FocusScene;
  image?: string;
  children?: React.ReactNode;
  className?: string;
  layout?: "fixed" | "relative";
}

export function AnimatedSceneBackground({
  scene,
  image,
  children,
  className,
  layout = "fixed",
}: AnimatedSceneBackgroundProps) {
  const resolvedImage = image || scene.image;

  return (
    <section
      className={cn(
        "animated-scene-root",
        layout === "relative" && "animated-scene-root--relative",
        className
      )}
      style={{ backgroundColor: scene.palette.base }}
    >
      <div
        key={`${scene.id}-${resolvedImage}`}
        className="animated-scene-image"
        style={{
          backgroundColor: scene.palette.base,
          backgroundImage: `linear-gradient(180deg, rgba(3,6,18,0.18), rgba(3,6,18,0.28)), url(${resolvedImage})`,
        }}
        aria-hidden="true"
      />
      <div className="animated-scene-overlay" aria-hidden="true" />
      <div className="animated-scene-vignette" aria-hidden="true" />
      {renderMotionLayers(scene.motionType)}
      <div className="noise-overlay" aria-hidden="true" />
      <div className="animated-scene-content">{children}</div>
    </section>
  );
}

function renderMotionLayers(motionType: SceneMotionType) {
  switch (motionType) {
    case "rain":
      return (
        <>
          <div className="scene-rain-layer" aria-hidden="true" />
          <div className="scene-window-rain" aria-hidden="true" />
        </>
      );
    case "fireplace":
      return (
        <>
          <div className="scene-fire-glow" aria-hidden="true" />
          <div className="scene-ember-layer" aria-hidden="true" />
        </>
      );
    case "forestNight":
      return (
        <>
          <div className="scene-mist-layer" aria-hidden="true" />
          <div className="scene-firefly-layer" aria-hidden="true" />
        </>
      );
    case "cityNight":
      return (
        <>
          <div className="scene-city-glow" aria-hidden="true" />
          <div className="scene-star-layer" aria-hidden="true" />
        </>
      );
    case "trainWindow":
      return (
        <>
          <div className="scene-train-parallax" aria-hidden="true" />
          <div className="scene-window-glare" aria-hidden="true" />
        </>
      );
    case "mountainMist":
      return (
        <>
          <div className="scene-mist-layer" aria-hidden="true" />
          <div className="scene-cloud-layer" aria-hidden="true" />
        </>
      );
    default:
      return null;
  }
}
