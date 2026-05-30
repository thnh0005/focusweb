"use client";

import * as React from "react";
import { Topbar } from "@/components/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardLayoutProps {
  children: React.ReactNode;
  /** Passed from AppLayout context — opens command palette */
  onCommandPalette?: () => void;
  /** Passed from AppLayout context — opens notifications */
  onNotifications?: () => void;
  /** Passed from AppLayout context — opens user menu */
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

// ─── Component ───────────────────────────────────────────────────────────────

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
  return (
    <div className="flex-1 flex flex-col min-h-full">
      {/* Topbar — sticky with breadcrumb + actions */}
      <Topbar
        streakCount={streakCount}
        userName={userName}
        avatarUrl={avatarUrl}
        notificationCount={notificationCount}
        onCommandPalette={onCommandPalette}
        onNotifications={onNotifications}
        onUserMenu={onUserMenu}
      />

      {/* Content wrapper — generous spacing rhythm (Density: 4) */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:px-6 md:py-10 lg:px-8 animate-fade-in relative z-10 outline-none"
      >
        <div className="space-y-8">{children}</div>
      </main>
    </div>
  );
}
