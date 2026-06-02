"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Flame, Bell } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Breadcrumb } from "./Breadcrumb";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";

// ─── Stoic / Mindfulness Quote Pool (design1.md spec: 50+ curated, no API) ──

const QUOTES: readonly { text: string; author: string }[] = [
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "You have power over your mind — not outside events. Realise this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "If you are distressed by anything external, the pain is not due to the thing itself, but to your estimate of it.", author: "Marcus Aurelius" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus" },
  { text: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus" },
  { text: "Make the best use of what is in your power, and take the rest as it happens.", author: "Epictetus" },
  { text: "It is not what happens to you, but how you react to it that matters.", author: "Epictetus" },
  { text: "He who is not courageous enough to take risks will accomplish nothing in life.", author: "Muhammad Ali" },
  { text: "Do not dwell in the past, do not dream of the future. Concentrate the mind on the present moment.", author: "Buddha" },
  { text: "Deep work is the ability to focus without distraction on a cognitively demanding task.", author: "Cal Newport" },
  { text: "Clarity about what matters provides clarity about what does not.", author: "Cal Newport" },
  { text: "Who looks outside, dreams; who looks inside, awakes.", author: "Carl Jung" },
  { text: "An unexamined life is not worth living.", author: "Socrates" },
  { text: "Man suffers most from the suffering he fears, but never appears.", author: "Seneca" },
  { text: "Begin at once to live and count each separate day as a separate life.", author: "Seneca" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { text: "Every moment is a fresh beginning.", author: "T.S. Eliot" },
  { text: "We are what we repeatedly do. Excellence is not an act, but a habit.", author: "Aristotle" },
  { text: "Concentration is the root of all the higher abilities in man.", author: "Bruce Lee" },
  { text: "Your focus determines your reality.", author: "Qui-Gon Jinn" },
];

// Pick a stable quote per session-start (not on reload — persisted in sessionStorage)
function getSessionQuote(): { text: string; author: string } {
  if (typeof window === "undefined") return QUOTES[0];
  const stored = sessionStorage.getItem("focusos_quote_idx");
  if (stored !== null) {
    return QUOTES[parseInt(stored, 10) % QUOTES.length];
  }
  const idx = Math.floor(Math.random() * QUOTES.length);
  sessionStorage.setItem("focusos_quote_idx", String(idx));
  return QUOTES[idx];
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TopbarProps {
  /** Days on streak */
  streakCount?: number;
  /** User display name */
  userName?: string;
  /** User avatar URL */
  avatarUrl?: string;
  /** Unread notification count */
  notificationCount?: number;
  /** Open command palette */
  onCommandPalette?: () => void;
  /** Open notification center */
  onNotifications?: () => void;
  /** Open user menu */
  onUserMenu?: () => void;
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Topbar({
  streakCount = 0,
  userName = "User",
  avatarUrl,
  notificationCount = 0,
  onCommandPalette,
  onNotifications,
  onUserMenu,
  className,
}: TopbarProps) {
  const pathname = usePathname();
  const [quote] = React.useState(() => getSessionQuote());

  // Detect modifier key for command hint (⌘ on Mac, Ctrl on Windows/Linux)
  const isMac = React.useMemo(() => {
    if (typeof navigator === "undefined") return true;
    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
  }, []);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const hasNotifications = notificationCount > 0;

  return (
    <header
      role="banner"
      className={cn(
        "sticky top-0 z-20 h-14 flex items-center justify-between",
        "px-4 md:px-6 lg:px-8",
        "bg-bg-void border-b border-white/[0.06]",
        "backdrop-blur-[18px] backdrop-saturate-[180%]",
        "select-none",
        className
      )}
    >
      {/* ── Left: Breadcrumb ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        <Breadcrumb pathname={pathname} />
      </div>

      {/* ── Center: Quote (lg+) ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex flex-1 items-center justify-center px-8 max-w-[480px] mx-auto pointer-events-none"
        aria-hidden="true"
      >
        <p className="quote-ambient text-center line-clamp-1 text-[12px]">
          {quote.text} — {quote.author}
        </p>
      </motion.div>

      {/* ── Right: Actions ────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Streak pill (md+) */}
        {streakCount > 0 && (
          <div
            aria-label={`${streakCount} day streak`}
            className={cn(
              "hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full",
              "bg-white/[0.03] border border-white/[0.05]",
              "text-urgency-amber"
            )}
          >
            <Flame aria-hidden="true" className="h-3.5 w-3.5 fill-urgency-amber/[0.15] stroke-[1.5]" />
            <span className="text-[11px] font-mono tracking-wide">{streakCount}d</span>
          </div>
        )}

        {/* Command Palette trigger */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={`Open command palette (${isMac ? "⌘" : "Ctrl"}K)`}
              onClick={onCommandPalette}
              className={cn(
                "hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg h-8",
                "bg-white/[0.03] border border-white/[0.05]",
                "text-text-muted hover:text-text-secondary hover:bg-white/[0.05] hover:border-white/[0.08]",
                "transition-all duration-[120ms]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <Search aria-hidden="true" className="h-3.5 w-3.5 stroke-[1.5]" />
              <span className="text-[11px] font-mono tracking-wide whitespace-nowrap">
                {isMac ? "⌘K" : "Ctrl K"}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Command palette</TooltipContent>
        </Tooltip>

        {/* Notification bell */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={
                hasNotifications
                  ? `${notificationCount} unread notification${notificationCount > 1 ? "s" : ""}`
                  : "Notifications"
              }
              onClick={onNotifications}
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-lg",
                "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]",
                "transition-all duration-[120ms]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "active:scale-[0.96]"
              )}
            >
              <Bell aria-hidden="true" className="h-4 w-4 stroke-[1.5]" />
              {hasNotifications && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 flex h-[7px] w-[7px] items-center justify-center rounded-full bg-focus-purple"
                />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {hasNotifications
              ? `${notificationCount} notification${notificationCount > 1 ? "s" : ""}`
              : "Notifications"}
          </TooltipContent>
        </Tooltip>

        {/* User avatar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Open user menu"
              aria-haspopup="menu"
              onClick={onUserMenu}
              className={cn(
                "flex items-center gap-2 rounded-full",
                "transition-all duration-[120ms] hover:scale-[1.03] active:scale-[0.97]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <Avatar className="h-7 w-7 border border-white/[0.10] hover:border-focus-purple/[0.35] transition-colors">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
                <AvatarFallback className="text-[10px] font-medium">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Account</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
