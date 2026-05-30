"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Flame, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface TopBarProps {
  streakCount?: number;
}

export function TopBar({ streakCount = 7 }: TopBarProps) {
  const pathname = usePathname();

  // Simple breadcrumb logic based on pathname
  const getPageTitle = () => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "Sanctuary";
    
    // Capitalize first letter of first path segment
    const mainSegment = parts[0];
    const formatted = mainSegment.charAt(0).toUpperCase() + mainSegment.slice(1);
    
    return formatted.replace("-", " ");
  };

  return (
    <header className="h-16 border-b border-white/5 bg-[#09090B] px-6 md:px-8 flex items-center justify-between z-10 relative select-none">
      {/* Title / Breadcrumbs */}
      <div className="flex items-center space-x-2.5">
        <span className="text-xs font-light text-text-muted hover:text-text-secondary cursor-pointer transition-colors">
          FocusOS
        </span>
        <span className="text-xs text-text-muted select-none">/</span>
        <h1 className="text-sm font-light tracking-tight text-text-primary">
          {getPageTitle()}
        </h1>
      </div>

      {/* User Session Streak HUD */}
      <div className="flex items-center space-x-4">
        {/* Streak Counter Pill */}
        <div className="flex items-center space-x-2 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/5">
          <Flame className="h-4 w-4 text-urgency-amber fill-urgency-amber/15 stroke-[1.5]" />
          <span className="text-xs font-mono tracking-tight text-text-secondary">
            {streakCount}d streak
          </span>
        </div>

        {/* Stoic Mindfulness Quote Badge */}
        <div className="hidden lg:flex items-center space-x-1.5 text-xs text-text-muted font-light italic">
          <Star className="h-3.5 w-3.5 text-focus-purple-muted stroke-[1.5]" />
          <span>Stay in the zone</span>
        </div>
      </div>
    </header>
  );
}
