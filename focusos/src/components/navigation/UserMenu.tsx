"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  User,
  LogOut,
  Bell,
  Moon,
  Shield,
  ExternalLink,
  ChevronRight,
  Flame,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  /** User display name */
  userName?: string;
  /** User email */
  userEmail?: string;
  /** User avatar URL */
  avatarUrl?: string;
  /** Consecutive day streak */
  streakCount?: number;
  /** Total focus sessions ever */
  totalSessions?: number;
  /** Callback for logout action */
  onLogout?: () => void;
  /** Positioning — defaults to topbar avatar drop-down */
  align?: "right" | "left";
  className?: string;
}

// ─── Menu items definition ────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  labelKey: string;
  descriptionKey?: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "danger";
  external?: boolean;
  separator?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UserMenu({
  isOpen,
  onClose,
  userName = "User",
  userEmail = "",
  avatarUrl,
  streakCount = 0,
  totalSessions = 0,
  onLogout,
  align = "right",
  className,
}: UserMenuProps) {
  const { t } = useTranslation("common");
  const menuRef = React.useRef<HTMLDivElement>(null);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, onClose]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Menu items
  const menuItems: MenuItem[] = [
    {
      id: "profile",
      labelKey: "userMenu.profile",
      descriptionKey: "userMenu.profileDescription",
      icon: <User className="h-4 w-4 stroke-[1.5]" />,
      href: "/settings/profile",
    },
    {
      id: "notifications",
      labelKey: "userMenu.notifications",
      descriptionKey: "userMenu.notificationsDescription",
      icon: <Bell className="h-4 w-4 stroke-[1.5]" />,
      href: "/settings/notifications",
    },
    {
      id: "theme",
      labelKey: "userMenu.theme",
      descriptionKey: "userMenu.themeDescription",
      icon: <Moon className="h-4 w-4 stroke-[1.5]" />,
      href: "/dashboard?panel=theme",
      separator: true,
    },
    {
      id: "extension",
      labelKey: "userMenu.extension",
      descriptionKey: "userMenu.extensionDescription",
      icon: <Shield className="h-4 w-4 stroke-[1.5]" />,
      href: "/settings/extension",
      external: false,
    },
    {
      id: "logout",
      labelKey: "userMenu.logout",
      icon: <LogOut className="h-4 w-4 stroke-[1.5]" />,
      onClick: () => { onLogout?.(); onClose(); },
      variant: "danger",
      separator: true,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          key="user-menu"
          role="menu"
          aria-label={t("userMenu.ariaLabel")}
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "absolute top-full mt-2 z-50 w-[260px]",
            align === "right" ? "right-0" : "left-0",
            "rounded-2xl overflow-hidden",
            "bg-card-container/95 border border-white/[0.09]",
            "shadow-[0_16px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.07)]",
            "backdrop-blur-[32px] backdrop-saturate-[200%]",
            className
          )}
        >
          {/* ── User Identity Header ──────────────────────────────── */}
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-focus-purple/[0.20] shadow-[0_0_12px_rgba(124,58,237,0.12)]">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
                <AvatarFallback className="text-sm font-medium">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-light text-text-primary truncate">{userName}</p>
                {userEmail && (
                  <p className="text-[11px] text-text-muted font-mono truncate">{userEmail}</p>
                )}
              </div>
            </div>

            {/* Stats pills */}
            <div className="flex items-center gap-2 mt-3">
              {streakCount > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-urgency-amber/[0.08] border border-urgency-amber/[0.12]">
                  <Flame aria-hidden="true" className="h-3 w-3 text-urgency-amber stroke-[1.5]" />
                  <span className="text-[10px] font-mono text-urgency-amber">{t("userMenu.dayStreak", { count: streakCount })}</span>
                </div>
              )}
              {totalSessions > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-focus-purple/[0.08] border border-focus-purple/[0.12]">
                  <Zap aria-hidden="true" className="h-3 w-3 text-focus-purple stroke-[1.75]" />
                  <span className="text-[10px] font-mono text-focus-purple">{t("userMenu.sessions", { count: totalSessions })}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Menu Items ─────────────────────────────────────────── */}
          <div className="py-1.5">
            {menuItems.map((item, idx) => {
              const isDanger = item.variant === "danger";

              const itemContent = (
                <span
                  className={cn(
                    "group flex w-full items-center gap-3 px-3 py-2.5",
                    "transition-colors duration-[100ms]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isDanger
                      ? "text-urgency-coral hover:bg-urgency-coral/[0.06]"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
                  )}
                >
                  {/* Icon */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      isDanger ? "bg-urgency-coral/[0.08]" : "bg-white/[0.03]",
                      "group-hover:bg-white/[0.05] transition-colors duration-[100ms]"
                    )}
                  >
                    {item.icon}
                  </span>

                  {/* Text */}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-light leading-none mb-0.5">{t(item.labelKey)}</span>
                    {item.descriptionKey && (
                      <span className="block text-[10px] text-text-muted font-light truncate">
                        {t(item.descriptionKey)}
                      </span>
                    )}
                  </span>

                  {/* Trailing */}
                  {item.external ? (
                    <ExternalLink aria-hidden="true" className="h-3 w-3 text-text-muted stroke-[1.5] opacity-50" />
                  ) : (
                    <ChevronRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5 text-text-muted stroke-[1.5] opacity-0 group-hover:opacity-40 transition-opacity"
                    />
                  )}
                </span>
              );

              return (
                <React.Fragment key={item.id}>
                  {item.separator && idx > 0 && (
                    <div
                      role="separator"
                      aria-hidden="true"
                      className="my-1 h-px bg-white/[0.04] mx-3"
                    />
                  )}
                  {item.href ? (
                    <Link
                      href={item.href}
                      role="menuitem"
                      onClick={onClose}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      className="block"
                    >
                      {itemContent}
                    </Link>
                  ) : (
                    <button
                      role="menuitem"
                      onClick={item.onClick}
                      className="w-full text-left"
                    >
                      {itemContent}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
