"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  BarChart3,
  BookOpen,
  Settings2,
  Zap,
  FileText,
  PlusCircle,
  Moon,
  Bell,
  LogOut,
  ChevronRight,
  Command,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  group: string;
  keywords?: string[];
}

// ─── Command Registry ─────────────────────────────────────────────────────────

function useCommandItems(router: ReturnType<typeof useRouter>, onClose: () => void): CommandItem[] {
  return React.useMemo<CommandItem[]>(() => [
    // Navigation
    {
      id: "nav-dashboard",
      label: "Dashboard",
      description: "Go to your overview",
      icon: <LayoutDashboard className="h-4 w-4 stroke-[1.5]" />,
      action: () => { router.push("/dashboard"); onClose(); },
      group: "Navigation",
      keywords: ["home", "overview", "main"],
    },
    {
      id: "nav-analytics",
      label: "Analytics",
      description: "View focus trends and charts",
      icon: <BarChart3 className="h-4 w-4 stroke-[1.5]" />,
      action: () => { router.push("/analytics"); onClose(); },
      group: "Navigation",
      keywords: ["charts", "data", "stats", "reports"],
    },
    {
      id: "nav-study-tools",
      label: "Study Tools",
      description: "AI summaries and flashcards",
      icon: <BookOpen className="h-4 w-4 stroke-[1.5]" />,
      action: () => { router.push("/study-tools"); onClose(); },
      group: "Navigation",
      keywords: ["study", "flashcards", "documents", "pdf"],
    },
    {
      id: "nav-settings",
      label: "Settings",
      description: "Account and preferences",
      icon: <Settings2 className="h-4 w-4 stroke-[1.5]" />,
      action: () => { router.push("/settings"); onClose(); },
      group: "Navigation",
      keywords: ["preferences", "account", "profile"],
    },
    // Actions
    {
      id: "action-start-session",
      label: "Start Focus Session",
      description: "Begin a new Deep Work or Normal session",
      icon: <Zap className="h-4 w-4 stroke-[1.5] text-focus-purple" />,
      shortcut: "S",
      action: () => { router.push("/session"); onClose(); },
      group: "Actions",
      keywords: ["focus", "timer", "work", "pomodoro", "session", "deep work"],
    },
    {
      id: "action-upload-doc",
      label: "Upload Document",
      description: "Add a PDF or DOCX for AI analysis",
      icon: <FileText className="h-4 w-4 stroke-[1.5]" />,
      action: () => { router.push("/study-tools/upload"); onClose(); },
      group: "Actions",
      keywords: ["upload", "document", "pdf", "notes"],
    },
    {
      id: "action-add-blacklist",
      label: "Add Blacklist Site",
      description: "Block a distracting domain",
      icon: <PlusCircle className="h-4 w-4 stroke-[1.5]" />,
      action: () => { router.push("/settings/blacklist"); onClose(); },
      group: "Actions",
      keywords: ["block", "blacklist", "distraction", "website"],
    },
    // Settings
    {
      id: "settings-theme",
      label: "Theme Settings",
      description: "Cyber, Minimal, or Forest",
      icon: <Moon className="h-4 w-4 stroke-[1.5]" />,
      action: () => { router.push("/settings/theme"); onClose(); },
      group: "Settings",
      keywords: ["theme", "dark", "appearance", "color"],
    },
    {
      id: "settings-notifications",
      label: "Notification Settings",
      description: "Reminders and alerts",
      icon: <Bell className="h-4 w-4 stroke-[1.5]" />,
      action: () => { router.push("/settings/notifications"); onClose(); },
      group: "Settings",
      keywords: ["notifications", "reminders", "alerts"],
    },
    {
      id: "action-logout",
      label: "Log Out",
      description: "End your session securely",
      icon: <LogOut className="h-4 w-4 stroke-[1.5] text-urgency-coral" />,
      action: () => { /* Handled by auth layer */ onClose(); },
      group: "Account",
      keywords: ["logout", "sign out", "exit"],
    },
  ], [router, onClose]);
}

// ─── Score a command item against query ──────────────────────────────────────

function scoreItem(item: CommandItem, query: string): number {
  const q = query.toLowerCase();
  if (item.label.toLowerCase().startsWith(q)) return 3;
  if (item.label.toLowerCase().includes(q)) return 2;
  if (item.description?.toLowerCase().includes(q)) return 1.5;
  if (item.keywords?.some((k) => k.includes(q))) return 1;
  return 0;
}

// ─── Keyboard shortcut hint ───────────────────────────────────────────────────

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.06] border border-white/[0.10] text-text-muted">
      {children}
    </kbd>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CommandPalette({ isOpen, onClose, className }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const allItems = useCommandItems(router, onClose);

  // Filter + sort items
  const filteredItems = React.useMemo(() => {
    if (!query.trim()) return allItems;
    return allItems
      .map((item) => ({ item, score: scoreItem(item, query.trim()) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [allItems, query]);

  // Group items for display
  const groups = React.useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [filteredItems]);

  // Reset on open
  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 32);
    }
  }, [isOpen]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filteredItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filteredItems[activeIdx]?.action();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, filteredItems, activeIdx, onClose]);

  // Scroll active item into view
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Reset active when query changes
  React.useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Global ⌘K / Ctrl+K trigger (passive listener — actual open is handled by parent)
  React.useEffect(() => {
    function handleGlobal(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", handleGlobal);
    return () => window.removeEventListener("keydown", handleGlobal);
  }, []);

  let flatIdx = 0; // running index across groups for keyboard navigation

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[80] bg-background/70 backdrop-blur-sm"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="cp-panel"
            role="dialog"
            aria-label="Command palette"
            aria-modal="true"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed left-1/2 top-[12vh] -translate-x-1/2 z-[90]",
              "w-full max-w-[580px] mx-4",
              "rounded-2xl overflow-hidden",
              "bg-surface-deep/95 border border-white/[0.09]",
              "shadow-[0_24px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.07)]",
              "backdrop-blur-[32px] backdrop-saturate-[200%]",
              className
            )}
          >
            {/* Search input row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
              <Search aria-hidden="true" className="h-4 w-4 text-text-muted shrink-0 stroke-[1.5]" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="cp-results"
                aria-expanded={filteredItems.length > 0}
                aria-activedescendant={
                  filteredItems[activeIdx] ? `cp-item-${filteredItems[activeIdx].id}` : undefined
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands, pages, actions…"
                className={cn(
                  "flex-1 bg-transparent text-sm font-light text-text-primary",
                  "placeholder:text-text-muted outline-none caret-focus-purple"
                )}
              />
              {/* Close shortcut */}
              <KbdHint>Esc</KbdHint>
            </div>

            {/* Results */}
            <div
              id="cp-results"
              role="listbox"
              aria-label="Command results"
              ref={listRef}
              className="max-h-[360px] overflow-y-auto py-2"
            >
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Hash aria-hidden="true" className="h-6 w-6 text-text-muted/50 stroke-[1.5]" />
                  <p className="text-sm text-text-muted font-light">No results for "{query}"</p>
                </div>
              ) : (
                Array.from(groups.entries()).map(([groupName, items]) => (
                  <div key={groupName}>
                    {/* Group heading */}
                    <p
                      aria-hidden="true"
                      className="px-4 pt-3 pb-1 text-[10px] font-mono tracking-[0.18em] text-text-muted uppercase"
                    >
                      {groupName}
                    </p>

                    {items.map((item) => {
                      const thisIdx = flatIdx++;
                      const isActive = thisIdx === activeIdx;
                      return (
                        <button
                          key={item.id}
                          id={`cp-item-${item.id}`}
                          role="option"
                          aria-selected={isActive}
                          data-idx={thisIdx}
                          onClick={item.action}
                          onMouseEnter={() => setActiveIdx(thisIdx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                            "transition-colors duration-[80ms]",
                            "focus:outline-none",
                            isActive
                              ? "bg-white/[0.05] text-text-primary"
                              : "text-text-secondary hover:text-text-primary"
                          )}
                        >
                          {/* Icon wrapper */}
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                              isActive ? "bg-white/[0.06]" : "bg-white/[0.03]"
                            )}
                          >
                            {item.icon}
                          </span>

                          {/* Label + description */}
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-light leading-none mb-0.5">
                              {item.label}
                            </span>
                            {item.description && (
                              <span className="block text-[11px] text-text-muted font-light truncate">
                                {item.description}
                              </span>
                            )}
                          </span>

                          {/* Shortcut / chevron */}
                          {item.shortcut ? (
                            <KbdHint>{item.shortcut}</KbdHint>
                          ) : (
                            <ChevronRight
                              aria-hidden="true"
                              className={cn(
                                "h-3.5 w-3.5 stroke-[1.5] transition-opacity duration-[80ms]",
                                isActive ? "opacity-40" : "opacity-0"
                              )}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.05] bg-white/[0.01]">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Command aria-hidden="true" className="h-3 w-3 stroke-[1.5]" />
                <span className="text-[10px] font-mono tracking-wide">Command Palette</span>
              </div>
              <div className="flex items-center gap-3 ml-auto text-[10px] font-mono text-text-muted">
                <span className="flex items-center gap-1">
                  <KbdHint>↑↓</KbdHint> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <KbdHint>↵</KbdHint> Select
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
