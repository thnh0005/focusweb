"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import {
  readWorkspaceBackground,
  WORKSPACE_BACKGROUND_UPDATED_EVENT,
} from "@/lib/preferences/background";

export interface AmbientWorkspaceBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export function AmbientWorkspaceBackground({
  children,
  className,
}: AmbientWorkspaceBackgroundProps) {
  const [backgroundImage, setBackgroundImage] = React.useState("");

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
    <section
      className={cn(
        "relative min-h-[100dvh] overflow-hidden bg-[#070907] text-text-primary",
        className
      )}
    >
      <div className="absolute inset-0" aria-hidden="true">
        {backgroundImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-90"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        )}
        {backgroundImage && (
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,4,3,0.18),rgba(3,4,3,0.46)),radial-gradient(circle_at_50%_28%,transparent_0%,rgba(3,4,3,0.22)_70%,rgba(3,4,3,0.48)_100%)]" />
        )}
        <div
          className={cn(
            "absolute inset-0",
            backgroundImage
              ? "bg-[radial-gradient(circle_at_50%_26%,rgba(168,192,146,0.1),transparent_31rem),radial-gradient(circle_at_18%_68%,rgba(111,155,153,0.08),transparent_27rem),radial-gradient(circle_at_82%_72%,rgba(200,138,101,0.08),transparent_28rem)]"
              : "bg-[radial-gradient(circle_at_50%_26%,rgba(168,192,146,0.22),transparent_31rem),radial-gradient(circle_at_18%_68%,rgba(111,155,153,0.18),transparent_27rem),radial-gradient(circle_at_82%_72%,rgba(200,138,101,0.16),transparent_28rem),linear-gradient(180deg,#0d110d_0%,#070907_54%,#040504_100%)]"
          )}
        />
        <div
          className={cn(
            "absolute inset-x-[-10%] bottom-[-18%] h-[46dvh] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(72,106,80,0.42),rgba(29,45,36,0.28)_42%,transparent_70%)] blur-3xl",
            backgroundImage && "opacity-45"
          )}
        />
        <div
          className={cn(
            "absolute inset-x-[-15%] bottom-[-10%] h-[30dvh]",
            backgroundImage
              ? "bg-[linear-gradient(180deg,transparent,rgba(5,7,5,0.42))]"
              : "bg-[linear-gradient(180deg,transparent,rgba(5,7,5,0.78))]"
          )}
        />
        <div
          className={cn(
            "absolute inset-0",
            backgroundImage
              ? "bg-[radial-gradient(circle_at_center,transparent_0%,rgba(3,4,3,0.2)_72%,rgba(3,4,3,0.46)_100%)]"
              : "bg-[radial-gradient(circle_at_center,transparent_0%,rgba(3,4,3,0.38)_72%,rgba(3,4,3,0.72)_100%)]"
          )}
        />
      </div>
      <div className="noise-overlay" aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </section>
  );
}
