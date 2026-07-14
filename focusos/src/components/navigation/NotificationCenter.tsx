"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Zap,
  BarChart3,
  Calendar,
  X,
  CheckCheck,
  Clock,
  BellOff,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationType =
  | "session_reminder"
  | "weekly_summary"
  | "deep_work_suggestion"
  | "ai_insight"
  | "streak_milestone"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  isRead: boolean;
  createdAt: Date | string;
}

export interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: Notification[];
  onMarkAllRead?: () => void;
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  className?: string;
}

// ─── Notification Icon Map ────────────────────────────────────────────────────

const NOTIF_ICON: Record<NotificationType, React.ReactNode> = {
  session_reminder: <Clock className="h-4 w-4 stroke-[1.5] text-urgency-amber" />,
  weekly_summary: <BarChart3 className="h-4 w-4 stroke-[1.5] text-focus-purple" />,
  deep_work_suggestion: <Zap className="h-4 w-4 stroke-[1.5] text-focus-green" />,
  ai_insight: <Zap className="h-4 w-4 stroke-[1.5] text-ambient-cyan" />,
  streak_milestone: <Zap className="h-4 w-4 stroke-[1.5] text-urgency-amber" />,
  system: <Bell className="h-4 w-4 stroke-[1.5] text-text-muted" />,
};

const NOTIF_BG: Record<NotificationType, string> = {
  session_reminder: "bg-urgency-amber/[0.08]",
  weekly_summary: "bg-focus-purple/[0.08]",
  deep_work_suggestion: "bg-focus-green/[0.08]",
  ai_insight: "bg-ambient-cyan/[0.08]",
  streak_milestone: "bg-urgency-amber/[0.08]",
  system: "bg-white/[0.04]",
};

// ─── Relative time helper ─────────────────────────────────────────────────────

function relTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// ─── Unused notification examples ─────────────────────────────────────────────

/*
const DEFAULT_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "deep_work_suggestion",
    title: "Your peak focus window is now",
    body: "You typically focus best between 20:00–22:00. Now's a great time to start a Deep Work session.",
    href: "/dashboard",
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
];
*/

// ─── Single notification item ─────────────────────────────────────────────────

function NotificationItem({
  notification,
  onRead,
  onDismiss,
}: {
  notification: Notification;
  onRead?: () => void;
  onDismiss?: () => void;
}) {
  const icon = NOTIF_ICON[notification.type];
  const bg = NOTIF_BG[notification.type];

  const content = (
    <div
      className={cn(
        "relative group flex items-start gap-3 p-3 rounded-xl w-full text-left",
        "transition-colors duration-[120ms]",
        notification.isRead
          ? "opacity-60 hover:opacity-80"
          : "hover:bg-white/[0.03]"
      )}
    >
      {/* Unread dot */}
      {!notification.isRead && (
        <span
          aria-label="Unread"
          className="absolute top-3.5 left-1.5 h-1.5 w-1.5 rounded-full bg-focus-purple"
        />
      )}

      {/* Icon */}
      <span
        aria-hidden="true"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl mt-0.5",
          bg
        )}
      >
        {icon}
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0 pr-6">
        <p className="text-xs font-light text-text-primary leading-snug mb-0.5">
          {notification.title}
        </p>
        <p className="text-[11px] text-text-muted font-light leading-relaxed line-clamp-2">
          {notification.body}
        </p>
        <p className="text-[10px] font-mono text-text-muted/60 mt-1.5">
          {relTime(notification.createdAt)}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        aria-label={`Dismiss: ${notification.title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss?.();
        }}
        className={cn(
          "absolute top-3 right-3",
          "flex h-5 w-5 items-center justify-center rounded-md",
          "text-text-muted hover:text-text-primary hover:bg-white/[0.06]",
          "opacity-0 group-hover:opacity-100 transition-all duration-[120ms]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <X aria-hidden="true" className="h-3 w-3 stroke-[1.5]" />
      </button>

      {/* Chevron for linked notifications */}
      {notification.href && (
        <ChevronRight
          aria-hidden="true"
          className="absolute bottom-3.5 right-3 h-3 w-3 text-text-muted stroke-[1.5] opacity-0 group-hover:opacity-40 transition-opacity"
        />
      )}
    </div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onClick={onRead}
    >
      {notification.href ? (
        <Link href={notification.href} className="block focus-visible:outline-none">
          {content}
        </Link>
      ) : (
        <div>{content}</div>
      )}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationCenter({
  isOpen,
  onClose,
  notifications = [],
  onMarkAllRead,
  onMarkRead,
  onDismiss,
  className,
}: NotificationCenterProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const hasNotifications = notifications.length > 0;

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          key="notification-center"
          role="dialog"
          aria-label="Notifications"
          aria-modal="false"
          initial={{ opacity: 0, y: -10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "absolute top-full right-0 mt-2 z-50 w-[340px]",
            "rounded-2xl overflow-hidden",
            "bg-card-container/95 border border-white/[0.09]",
            "shadow-[0_16px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.07)]",
            "backdrop-blur-[32px] backdrop-saturate-[200%]",
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Bell aria-hidden="true" className="h-4 w-4 text-text-muted stroke-[1.5]" />
              <h2 className="text-sm font-light text-text-primary">Notifications</h2>
              {unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread`}
                  className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-focus-purple/[0.15] border border-focus-purple/[0.20] px-1.5"
                >
                  <span className="text-[10px] font-mono text-focus-purple">{unreadCount}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  aria-label="Mark all notifications as read"
                  onClick={onMarkAllRead}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono",
                    "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]",
                    "transition-colors duration-[120ms]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <CheckCheck aria-hidden="true" className="h-3 w-3 stroke-[1.5]" />
                  Mark all read
                </button>
              )}
              <button
                aria-label="Close notifications"
                onClick={onClose}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md",
                  "text-text-muted hover:text-text-primary hover:bg-white/[0.04]",
                  "transition-colors duration-[120ms]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5 stroke-[1.5]" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div
            role="list"
            aria-label="Notification items"
            className="max-h-[400px] overflow-y-auto"
          >
            {hasNotifications ? (
              <AnimatePresence initial={false}>
                {notifications.map((n) => (
                  <div key={n.id} role="listitem">
                    <NotificationItem
                      notification={n}
                      onRead={() => onMarkRead?.(n.id)}
                      onDismiss={() => onDismiss?.(n.id)}
                    />
                  </div>
                ))}
              </AnimatePresence>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 py-12 px-6 text-center"
              >
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <BellOff className="h-5 w-5 text-text-muted stroke-[1.5]" />
                </span>
                <p className="text-sm font-light text-text-secondary">
                  You&apos;re all caught up
                </p>
                <p className="text-[11px] text-text-muted font-light">
                  Notification history is not available from the backend yet.
                </p>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          {hasNotifications && (
            <div className="px-4 py-2.5 border-t border-white/[0.05] bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <Link
                  href="/settings/notifications"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] font-mono text-text-muted",
                    "hover:text-text-secondary transition-colors duration-[120ms]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  )}
                >
                  <Calendar aria-hidden="true" className="h-3 w-3 stroke-[1.5]" />
                  Notification settings
                </Link>
                <span className="text-[10px] font-mono text-text-muted/50">
                  {notifications.length} total
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
