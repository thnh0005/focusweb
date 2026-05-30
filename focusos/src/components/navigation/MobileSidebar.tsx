"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BarChart3,
  BookOpen,
  Settings2,
  Flame,
  X,
  Menu,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MobileSidebarProps {
  /** Consecutive days with at least one completed session */
  streakCount?: number;
  /** User display name */
  userName?: string;
  /** User avatar image URL */
  avatarUrl?: string;
  /** Triggered when user taps the avatar */
  onAvatarClick?: () => void;
  /** Triggered when user taps "Start Session" */
  onStartSession?: () => void;
  className?: string;
}

// ─── Nav Items ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Study Tools", href: "/study-tools", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings2 },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function MobileSidebar({
  streakCount = 0,
  userName = "User",
  avatarUrl,
  onAvatarClick,
  onStartSession,
  className,
}: MobileSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);

  // Close on route change
  React.useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Trap body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={cn("md:hidden", className)}>
      {/* ── Mobile Top Bar ─────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-4",
          "bg-[#09090B]/95 border-b border-white/[0.05]",
          "backdrop-blur-[24px] backdrop-saturate-[200%]"
        )}
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          aria-label="FocusOS"
          className={cn(
            "flex items-center gap-2.5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          )}
        >
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              "bg-focus-purple/[0.12] border border-focus-purple/[0.25]",
              "text-focus-purple font-mono font-bold text-sm"
            )}
            aria-hidden="true"
          >
            ✦
          </span>
          <span className="text-sm font-light tracking-[0.04em] text-text-primary">
            FocusOS
          </span>
        </Link>

        {/* Hamburger toggle */}
        <button
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isOpen}
          aria-controls="mobile-sidebar-panel"
          onClick={() => setIsOpen((v) => !v)}
          className={cn(
            "relative h-9 w-9 flex items-center justify-center rounded-lg",
            "text-text-secondary hover:text-text-primary hover:bg-white/[0.04]",
            "transition-all duration-[120ms]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 45, opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                <X aria-hidden="true" className="h-5 w-5 stroke-[1.5]" />
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial={{ rotate: 45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -45, opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                <Menu aria-hidden="true" className="h-5 w-5 stroke-[1.5]" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* ── Full-Screen Overlay Panel ───────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Dim backdrop */}
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              className="fixed inset-0 z-40 bg-[#09090B]/80 backdrop-blur-sm"
              aria-hidden="true"
              onClick={() => setIsOpen(false)}
            />

            {/* Slide-in panel */}
            <motion.div
              key="mobile-panel"
              id="mobile-sidebar-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "fixed left-0 top-0 h-[100dvh] w-[280px] z-50 flex flex-col",
                "bg-[#0c0c12]/[0.98] border-r border-white/[0.07]",
                "backdrop-blur-[32px] backdrop-saturate-[200%]",
                "shadow-[8px_0_40px_rgba(0,0,0,0.5)]",
                "pt-20 pb-8 px-4"
              )}
            >
              {/* User Profile Row */}
              <button
                aria-label="View profile and account settings"
                onClick={() => {
                  setIsOpen(false);
                  onAvatarClick?.();
                }}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-3 mb-6",
                  "rounded-xl bg-white/[0.03] border border-white/[0.05]",
                  "hover:bg-white/[0.05] hover:border-white/[0.08]",
                  "transition-all duration-[120ms]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <Avatar className="h-9 w-9 border border-focus-purple/[0.25]">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
                  <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-light text-text-primary truncate">{userName}</p>
                  <p className="text-[11px] text-text-muted font-mono">View profile</p>
                </div>
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-text-muted stroke-[1.5]" />
              </button>

              {/* Streak pill */}
              {streakCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-urgency-amber/[0.06] border border-urgency-amber/[0.12]">
                  <Flame aria-hidden="true" className="h-4 w-4 text-urgency-amber fill-urgency-amber/[0.15] stroke-[1.5]" />
                  <span className="text-xs font-mono text-urgency-amber">
                    {streakCount} Day Streak
                  </span>
                </div>
              )}

              {/* Section label */}
              <p aria-hidden="true" className="px-3 mb-2 text-[10px] font-mono tracking-[0.22em] text-text-muted uppercase">
                Navigate
              </p>

              {/* Nav links */}
              <nav aria-label="Mobile primary navigation" className="flex flex-col gap-0.5">
                {NAV_ITEMS.map((item, idx) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.28,
                        delay: 0.08 + idx * 0.04,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 w-full px-3 py-3 rounded-xl",
                          "transition-all duration-[120ms]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          "active:scale-[0.98]",
                          isActive
                            ? "bg-white/[0.05] text-text-primary border border-white/[0.07]"
                            : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
                        )}
                      >
                        <Icon
                          aria-hidden="true"
                          className={cn(
                            "h-5 w-5 shrink-0",
                            isActive
                              ? "text-focus-purple stroke-[1.75]"
                              : "stroke-[1.5]"
                          )}
                        />
                        <span className="text-sm font-light">{item.label}</span>
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="ml-auto h-1.5 w-1.5 rounded-full bg-focus-purple"
                          />
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Start Session CTA */}
              {onStartSession && (
                <motion.div
                  className="mt-6"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <button
                    aria-label="Start a new focus session"
                    onClick={() => {
                      setIsOpen(false);
                      onStartSession();
                    }}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl",
                      "bg-focus-purple text-white text-sm font-light tracking-[0.02em]",
                      "border border-focus-purple/[0.4]",
                      "shadow-[0_0_20px_rgba(124,58,237,0.25)]",
                      "hover:bg-focus-purple/90 hover:shadow-[0_0_28px_rgba(124,58,237,0.35)]",
                      "active:scale-[0.98] transition-all duration-[120ms]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    <Zap aria-hidden="true" className="h-4 w-4 stroke-[1.75]" />
                    Start Session
                  </button>
                </motion.div>
              )}

              {/* Footer version */}
              <div className="mt-auto pt-6 border-t border-white/[0.04] px-3">
                <span className="text-[10px] font-mono text-text-muted tracking-wider">
                  FocusOS v1.0
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
