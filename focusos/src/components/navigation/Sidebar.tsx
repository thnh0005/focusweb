"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  BarChart3,
  BookOpen,
  Settings2,
  Flame,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExtensionStatus = "connected" | "disconnected" | "error";

export interface SidebarProps {
  /** Extension connectivity status — shown as coloured dot at rail bottom */
  extensionStatus?: ExtensionStatus;
  /** Consecutive days with at least one completed session */
  streakCount?: number;
  /** User display name for avatar fallback */
  userName?: string;
  /** User avatar image URL */
  avatarUrl?: string;
  /** Triggered when user opens the UserMenu from the avatar */
  onAvatarClick?: () => void;
  /** Controlled expanded state — leave undefined for self-managed hover */
  isExpanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  className?: string;
}

// ─── Nav Items ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    labelKey: "nav.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    matchPrefix: true,
  },
  {
    labelKey: "nav.analytics",
    href: "/analytics",
    icon: BarChart3,
    matchPrefix: true,
  },
  {
    labelKey: "nav.aiDocs",
    href: "/study-tools",
    icon: BookOpen,
    matchPrefix: true,
  },
  {
    labelKey: "nav.settings",
    href: "/settings",
    icon: Settings2,
    matchPrefix: true,
  },
] as const;

// ─── Extension status helpers ─────────────────────────────────────────────────

const EXT_STATUS_LABEL: Record<ExtensionStatus, string> = {
  connected: "Extension active — tracking paused until session starts",
  disconnected: "Extension disconnected — click to reconnect",
  error: "Extension error — check settings",
};

const EXT_STATUS_COLOR: Record<ExtensionStatus, string> = {
  connected: "bg-focus-green",
  disconnected: "bg-urgency-amber",
  error: "bg-urgency-coral",
};

// ─── Rail Icon Button ─────────────────────────────────────────────────────────

function RailNavButton({
  item,
  isActive,
}: {
  item: (typeof NAV_ITEMS)[number];
  isActive: boolean;
}) {
  const { t } = useTranslation("common");
  const Icon = item.icon;
  const label = t(item.labelKey);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          aria-label={label}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-xl",
            "transition-all duration-[120ms] cubic-bezier(0.16,1,0.3,1)",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "active:scale-[0.96]",
            isActive
              ? "bg-focus-purple/10 text-focus-purple border border-focus-purple/20 shadow-[0_0_12px_rgba(124,58,237,0.15)]"
              : "text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
          )}
        >
          <Icon
            aria-hidden="true"
            className={cn(
              "h-[18px] w-[18px] transition-all duration-[120ms]",
              isActive ? "stroke-[1.75]" : "stroke-[1.5]"
            )}
          />
          {/* Active indicator dot */}
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 h-[5px] w-[5px] rounded-full bg-focus-purple"
            />
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={14}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Expanded Nav Item ────────────────────────────────────────────────────────

function ExpandedNavItem({
  item,
  isActive,
  onClose,
  index,
}: {
  item: (typeof NAV_ITEMS)[number];
  isActive: boolean;
  onClose: () => void;
  index: number;
}) {
  const { t } = useTranslation("common");
  const Icon = item.icon;
  const label = t(item.labelKey);
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.28,
        delay: index * 0.035,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Link
        href={item.href}
        onClick={onClose}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
          "transition-all duration-[120ms] cubic-bezier(0.16,1,0.3,1)",
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
            "h-4 w-4 shrink-0 transition-all duration-[120ms]",
            isActive ? "text-focus-purple stroke-[1.75]" : "stroke-[1.5] group-hover:scale-105"
          )}
        />
        <span className="flex-1 font-light tracking-[0.01em] leading-none">
          {label}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity duration-[120ms] ml-auto"
        />
      </Link>
    </motion.div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar({
  extensionStatus = "connected",
  streakCount = 0,
  userName = "User",
  avatarUrl,
  onAvatarClick,
  isExpanded: controlledExpanded,
  onExpandedChange,
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation("common");
  const [internalExpanded, setInternalExpanded] = React.useState(false);

  // Support both controlled and uncontrolled expansion
  const isExpanded = controlledExpanded ?? internalExpanded;
  const setExpanded = React.useCallback(
    (val: boolean) => {
      setInternalExpanded(val);
      onExpandedChange?.(val);
    },
    [onExpandedChange]
  );

  // Keyboard: Escape collapses the expanded panel
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isExpanded) setExpanded(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, setExpanded]);

  // Avatar fallback initials
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* ── Icon Rail (64px, always visible on md+) ──────────────────── */}
      <aside
        role="navigation"
        aria-label={t("nav.home")}
        className={cn(
          "hidden md:flex fixed left-0 top-0 h-[100dvh] w-16 z-40 flex-col",
          "items-center py-5 justify-between select-none",
          "bg-bg-void border-r border-white/[0.06]",
          "backdrop-blur-[18px] backdrop-saturate-[180%]",
          className
        )}
        onMouseEnter={() => setExpanded(true)}
      >
        {/* Top: Logo + Nav */}
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Logo mark */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/dashboard"
                aria-label={`${t("appName")} - ${t("nav.dashboard")}`}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  "bg-focus-purple/[0.12] border border-focus-purple/[0.25]",
                  "text-focus-purple font-mono font-bold text-base",
                  "transition-all duration-[120ms] ease-out",
                  "hover:scale-105 hover:bg-focus-purple/[0.18] hover:border-focus-purple/[0.4]",
                  "active:scale-[0.96]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                ✦
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={14}>
              FocusOS
            </TooltipContent>
          </Tooltip>

          {/* Nav items */}
          <nav aria-label={t("nav.home")} className="flex flex-col gap-2 w-full items-center">
            {NAV_ITEMS.map((item) => {
              const isActive = item.matchPrefix
                ? pathname.startsWith(item.href)
                : pathname === item.href;
              return (
                <RailNavButton key={item.labelKey} item={item} isActive={isActive} />
              );
            })}
          </nav>
        </div>

        {/* Bottom: Streak + Extension dot + Avatar */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Streak badge */}
          {streakCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  aria-label={t("time.dayStreak", { count: streakCount })}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl cursor-default",
                    "bg-white/[0.03] border border-white/[0.06]",
                    "hover:border-white/[0.12] transition-colors duration-[120ms]"
                  )}
                >
                  <Flame
                    aria-hidden="true"
                    className="h-[18px] w-[18px] text-urgency-amber fill-urgency-amber/[0.15] stroke-[1.5]"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={14}>
                {t("time.dayStreak", { count: streakCount })}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Extension status dot */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label={`Extension status: ${extensionStatus}`}
                className={cn(
                  "relative flex h-6 w-6 items-center justify-center rounded-full",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 w-2 rounded-full animate-pulse-glow",
                    EXT_STATUS_COLOR[extensionStatus]
                  )}
                  style={{ animationDuration: "3s" }}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={14} className="max-w-[200px]">
              {EXT_STATUS_LABEL[extensionStatus]}
            </TooltipContent>
          </Tooltip>

          {/* User Avatar */}
          <button
            aria-label="Open user menu"
            onClick={onAvatarClick}
            className={cn(
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "rounded-full transition-all duration-[120ms] hover:scale-105 active:scale-[0.96]"
            )}
          >
            <Avatar className="h-8 w-8 border border-white/[0.10] hover:border-focus-purple/[0.40] transition-colors">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
              <AvatarFallback className="text-[11px] font-medium">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </div>
      </aside>

      {/* ── Expanded Panel (240px, slides in from rail) ──────────────── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.aside
            key="sidebar-expanded"
            initial={{ x: -8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -8, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            role="navigation"
            aria-label={t("nav.home")}
            className={cn(
              "hidden md:flex fixed left-16 top-0 h-[100dvh] w-48 z-30 flex-col",
              "pt-[72px] pb-6 px-3",
              "bg-bg-surface border-r border-white/[0.06]",
              "backdrop-blur-[18px] backdrop-saturate-[180%]",
              "shadow-[4px_0_32px_rgba(0,0,0,0.4)]",
              "select-none"
            )}
            onMouseLeave={() => setExpanded(false)}
          >
            {/* Section label */}
            <p
              aria-hidden="true"
              className="px-3 mb-3 text-[10px] font-mono tracking-[0.22em] text-text-muted uppercase"
            >
              Sanctuary
            </p>

            {/* Nav items with stagger */}
            <nav aria-label={t("nav.home")} className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item, idx) => {
                const isActive = item.matchPrefix
                  ? pathname.startsWith(item.href)
                  : pathname === item.href;
                return (
                  <ExpandedNavItem
                    key={item.labelKey}
                    item={item}
                    isActive={isActive}
                    onClose={() => setExpanded(false)}
                    index={idx}
                  />
                );
              })}
            </nav>

            {/* Bottom section with version */}
            <div className="mt-auto px-3">
              <div className="flex items-center gap-2 py-2 border-t border-white/[0.04]">
                <Zap aria-hidden="true" className="h-3 w-3 text-text-muted stroke-[1.5]" />
                <span className="text-[10px] font-mono text-text-muted tracking-wider">
                  FocusOS v1.0
                </span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
