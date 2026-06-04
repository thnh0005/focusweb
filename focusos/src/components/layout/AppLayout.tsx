"use client";

import * as React from "react";
import {
  Sidebar,
  MobileSidebar,
  CommandPalette,
  UserMenu,
  NotificationCenter,
  type Notification,
} from "@/components/navigation";

const demoNotificationDates = {
  recent: new Date("2026-01-01T11:55:00.000Z"),
  earlier: new Date("2026-01-01T10:00:00.000Z"),
  yesterday: new Date("2025-12-31T12:00:00.000Z"),
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AppLayoutProps {
  children: React.ReactNode;
}

// ─── Global ⌘K shortcut listener ─────────────────────────────────────────────

function useCommandPaletteShortcut(open: () => void) {
  React.useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open]);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AppLayout({ children }: AppLayoutProps) {
  // Panel states
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);

  // Demo notification state (replace with real store in production)
  const [notifications, setNotifications] = React.useState<Notification[]>([
    {
      id: "n1",
      type: "deep_work_suggestion",
      title: "Your peak focus window is now",
      body: "You typically focus best between 20:00–22:00. Now's a great time to start a Deep Work session.",
      href: "/session",
      isRead: false,
      createdAt: demoNotificationDates.recent,
    },
    {
      id: "n2",
      type: "weekly_summary",
      title: "Weekly Report Ready",
      body: "Your Focus Score improved 12% this week. View your full breakdown.",
      href: "/analytics",
      isRead: false,
      createdAt: demoNotificationDates.earlier,
    },
    {
      id: "n3",
      type: "ai_insight",
      title: "AI Coach Observation",
      body: "You've been starting sessions after 9 PM three days in a row. Consider an earlier slot for deeper focus.",
      isRead: true,
      createdAt: demoNotificationDates.yesterday,
    },
  ]);

  // Handlers
  const openCommandPalette = React.useCallback(() => {
    setUserMenuOpen(false);
    setNotificationsOpen(false);
    setCommandPaletteOpen(true);
  }, []);

  const openUserMenu = React.useCallback(() => {
    setNotificationsOpen(false);
    setCommandPaletteOpen(false);
    setUserMenuOpen((v) => !v);
  }, []);

  const markAllRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const markRead = React.useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const dismissNotification = React.useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Keyboard shortcut for command palette
  useCommandPaletteShortcut(openCommandPalette);

  return (
    <div className="min-h-[100dvh] flex bg-bg-void text-text-primary overflow-x-hidden relative">

      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <Sidebar
        extensionStatus="connected"
        streakCount={7}
        userName="Minh"
        onAvatarClick={openUserMenu}
      />

      {/* ── Mobile Sidebar ──────────────────────────────────────────── */}
      <MobileSidebar
        streakCount={7}
        userName="Minh"
        onStartSession={() => {
          // Navigate to /session — typically via router in real usage
          window.location.href = "/session";
        }}
        onAvatarClick={openUserMenu}
      />

      {/* ── Main Content Area ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-[100dvh] relative z-10 w-full md:pl-16">
        {children}
      </div>

      {/* ── Global Overlays ─────────────────────────────────────────── */}

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* User Menu — relative-positioned anchor wrapper */}
      <div className="fixed top-3 right-4 z-[60]" aria-hidden={!userMenuOpen}>
        <UserMenu
          isOpen={userMenuOpen}
          onClose={() => setUserMenuOpen(false)}
          userName="Minh Nguyen"
          userEmail="minh@example.com"
          streakCount={7}
          totalSessions={42}
          onLogout={() => {
            // Handled by auth layer in production
            console.log("Logout requested");
          }}
        />
      </div>

      {/* Notification Center — relative-positioned anchor wrapper */}
      <div className="fixed top-3 right-16 z-[60]" aria-hidden={!notificationsOpen}>
        <NotificationCenter
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          notifications={notifications}
          onMarkAllRead={markAllRead}
          onMarkRead={markRead}
          onDismiss={dismissNotification}
        />
      </div>
    </div>
  );
}
