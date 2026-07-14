"use client";

import * as React from "react";
import {
  Sidebar,
  MobileSidebar,
  CommandPalette,
  UserMenu,
  NotificationCenter,
} from "@/components/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useNotificationStore } from "@/stores/notification.store";

export interface AppLayoutProps {
  children: React.ReactNode;
}

type LayoutChildProps = Partial<{
  onCommandPalette: () => void;
  onNotifications: () => void;
  onUserMenu: () => void;
  notificationCount: number;
  userName: string;
  avatarUrl: string;
}>;

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

export function AppLayout({ children }: AppLayoutProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllRead = useNotificationStore((state) => state.markAllNotificationsRead);
  const markRead = useNotificationStore((state) => state.markNotificationRead);
  const dismissNotification = useNotificationStore((state) => state.dismissNotification);

  const displayName = user?.displayName || user?.email || "User";
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const openCommandPalette = React.useCallback(() => {
    setUserMenuOpen(false);
    setNotificationsOpen(false);
    setCommandPaletteOpen(true);
  }, []);

  const openUserMenu = React.useCallback(() => {
    setNotificationsOpen(false);
    setCommandPaletteOpen(false);
    setUserMenuOpen((value) => !value);
  }, []);

  const openNotifications = React.useCallback(() => {
    setUserMenuOpen(false);
    setCommandPaletteOpen(false);
    setNotificationsOpen((value) => !value);
  }, []);

  useCommandPaletteShortcut(openCommandPalette);

  const enhancedChildren = React.isValidElement<LayoutChildProps>(children)
    ? React.cloneElement(children, {
        onCommandPalette: openCommandPalette,
        onNotifications: openNotifications,
        onUserMenu: openUserMenu,
        notificationCount: unreadCount,
        userName: displayName,
        avatarUrl: user?.avatarUrl,
      })
    : children;

  return (
    <div className="relative flex min-h-[100dvh] overflow-x-hidden bg-bg-void text-text-primary">
      <Sidebar
        extensionStatus="connected"
        streakCount={7}
        userName={displayName}
        onAvatarClick={openUserMenu}
      />

      <MobileSidebar
        streakCount={7}
        userName={displayName}
        onAvatarClick={openUserMenu}
      />

      <div className="relative z-10 flex min-h-[100dvh] w-full flex-1 flex-col md:pl-16">
        {enhancedChildren}
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <div className="fixed right-4 top-3 z-[60]" aria-hidden={!userMenuOpen}>
        <UserMenu
          isOpen={userMenuOpen}
          onClose={() => setUserMenuOpen(false)}
          userName={displayName}
          userEmail={user?.email ?? ""}
          streakCount={7}
          totalSessions={0}
          onLogout={() => void logout()}
        />
      </div>

      <div className="fixed right-16 top-3 z-[60]" aria-hidden={!notificationsOpen}>
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
