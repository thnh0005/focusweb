"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Topbar } from "@/components/navigation";
import { cn } from "@/lib/utils/cn";

export interface DashboardLayoutProps {
  children: React.ReactNode;
  /** Passed from AppLayout context to open command palette */
  onCommandPalette?: () => void;
  /** Passed from AppLayout context to open notifications */
  onNotifications?: () => void;
  /** Passed from AppLayout context to open user menu */
  onUserMenu?: () => void;
  /** Unread notification count */
  notificationCount?: number;
  /** User display name */
  userName?: string;
  /** User avatar URL */
  avatarUrl?: string;
  /** Streak count */
  streakCount?: number;
}

export function DashboardLayout({
  children,
  onCommandPalette,
  onNotifications,
  onUserMenu,
  notificationCount = 0,
  userName,
  avatarUrl,
  streakCount,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Topbar
        streakCount={streakCount}
        userName={userName}
        avatarUrl={avatarUrl}
        notificationCount={notificationCount}
        onCommandPalette={onCommandPalette}
        onNotifications={onNotifications}
        onUserMenu={onUserMenu}
        className={isDashboard ? "border-white/[0.04] bg-bg-void/55" : undefined}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "relative z-10 mx-auto w-full flex-1 px-4 pb-20 pt-8 outline-none animate-fade-in md:px-6 md:py-10 lg:px-8",
          isDashboard ? "max-w-none md:pt-8 lg:px-6" : "max-w-screen-xl"
        )}
      >
        <div className="space-y-8">{children}</div>
      </main>
    </div>
  );
}
