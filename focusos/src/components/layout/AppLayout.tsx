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
      createdAt: new Date(Date.now() - 5 * 60_000),
    },
    {
      id: "n2",
      type: "weekly_summary",
      title: "Weekly Report Ready",
      body: "Your Focus Score improved 12% this week. View your full breakdown.",
      href: "/analytics",
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60_000),
    },
    {
      id: "n3",
      type: "ai_insight",
      title: "AI Coach Observation",
      body: "You've been starting sessions after 9 PM three days in a row. Consider an earlier slot for deeper focus.",
      isRead: true,
      createdAt: new Date(Date.now() - 24 * 60 * 60_000),
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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

  const openNotifications = React.useCallback(() => {
    setUserMenuOpen(false);
    setCommandPaletteOpen(false);
    setNotificationsOpen((v) => !v);
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
    <div className="min-h-[100dvh] flex bg-background text-text-primary overflow-x-hidden relative">
      {/* ── 4-Layer Ambient Background System (design1.md) ─────────── */}
      <div className="ambient-orbs" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
      </div>
      <div className="grain-overlay" aria-hidden="true" />

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
