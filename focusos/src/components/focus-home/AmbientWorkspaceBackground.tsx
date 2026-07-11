"use client";

import * as React from "react";
import { getFocusScene } from "@/constants/focus-scenes";
import {
  readWorkspaceBackground,
  WORKSPACE_BACKGROUND_UPDATED_EVENT,
} from "@/lib/preferences/background";
import { useMusicStore } from "@/stores/music.store";
import { AnimatedSceneBackground } from "./AnimatedSceneBackground";

export interface AmbientWorkspaceBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export function AmbientWorkspaceBackground({
  children,
  className,
}: AmbientWorkspaceBackgroundProps) {
  const [backgroundImage, setBackgroundImage] = React.useState("");
  const currentSceneId = useMusicStore((state) => state.currentSceneId);
  const scene = getFocusScene(currentSceneId);
  const resolvedBackground = backgroundImage || scene.image;

  React.useEffect(() => {
    const updateBackground = () => setBackgroundImage(readWorkspaceBackground());

    updateBackground();
    window.addEventListener(WORKSPACE_BACKGROUND_UPDATED_EVENT, updateBackground);
    window.addEventListener("storage", updateBackground);

    return () => {
      window.removeEventListener(WORKSPACE_BACKGROUND_UPDATED_EVENT, updateBackground);
      window.removeEventListener("storage", updateBackground);
    };
  }, []);

  return (
    <AnimatedSceneBackground
      scene={scene}
      image={resolvedBackground}
      layout="relative"
      className={className}
    >
      {children}
    </AnimatedSceneBackground>
  );
}
