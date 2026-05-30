"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, Library, Settings, Flame } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "../ui/Button";
import { Avatar, AvatarFallback } from "../ui/Avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/Tooltip";

export interface SidebarRailProps {
  onHoverStart: () => void;
  extensionStatus?: "connected" | "disconnected" | "error";
  streakCount?: number;
}

export function SidebarRail({
  onHoverStart,
  extensionStatus = "connected",
  streakCount = 7,
}: SidebarRailProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", icon: <Home className="h-5 w-5 stroke-[1.5]" />, href: "/dashboard" },
    { label: "Analytics", icon: <BarChart2 className="h-5 w-5 stroke-[1.5]" />, href: "/analytics" },
    { label: "Study Tools", icon: <Library className="h-5 w-5 stroke-[1.5]" />, href: "/study-tools" },
    { label: "Settings", icon: <Settings className="h-5 w-5 stroke-[1.5]" />, href: "/settings" },
  ];

  return (
    <aside
      className="fixed left-0 top-0 h-full w-16 bg-[#09090B] border-r border-white/5 flex flex-col items-center py-6 justify-between z-40 select-none"
      onMouseEnter={onHoverStart}
      aria-label="Sidebar Rail"
    >
      <div className="flex flex-col items-center space-y-8 w-full">
        {/* Main Logo icon */}
        <Link
          href="/dashboard"
          className="h-9 w-9 rounded-xl bg-focus-purple/20 border border-focus-purple/35 flex items-center justify-center text-focus-purple font-mono font-bold text-base transition-transform duration-120 hover:scale-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="FocusOS Dashboard"
        >
          ✦
        </Link>

        {/* Navigation Items */}
        <nav className="flex flex-col space-y-4 w-full items-center" aria-label="Rail Navigation">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <Link href={item.href} tabIndex={-1}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-10 w-10 rounded-xl transition-all duration-120 active:scale-[0.98]",
                        isActive
                          ? "bg-focus-purple/10 text-focus-purple border border-focus-purple/20"
                          : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                      )}
                      aria-label={item.label}
                    >
                      {item.icon}
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col items-center space-y-5 w-full">
        {/* Streak Counter */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 text-urgency-amber cursor-default">
              <Flame className="h-5 w-5 fill-urgency-amber/15 stroke-[1.5]" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {streakCount} Day Streak
          </TooltipContent>
        </Tooltip>

        {/* Extension Status Connectivity Dot */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="relative h-6 w-6 flex items-center justify-center focus-visible:outline-none"
              aria-label={`Extension connectivity: ${extensionStatus}`}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  extensionStatus === "connected" && "bg-focus-green animate-pulse-glow",
                  extensionStatus === "disconnected" && "bg-urgency-amber animate-pulse-glow",
                  extensionStatus === "error" && "bg-urgency-coral"
                )}
                style={{ animationDuration: "3s" }}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {extensionStatus === "connected"
              ? "Extension connected"
              : "Extension disconnected"}
          </TooltipContent>
        </Tooltip>

        {/* User profile avatar link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/settings" tabIndex={-1} aria-label="Account Settings">
              <Avatar className="h-8 w-8 border border-white/10 hover:border-focus-purple/50 transition-colors cursor-pointer select-none">
                <AvatarFallback className="text-xs">M</AvatarFallback>
              </Avatar>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
