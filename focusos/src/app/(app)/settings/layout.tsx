"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Brush,
  FileText,
  ListX,
  Puzzle,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { AmbientWorkspaceBackground } from "@/components/focus-home";
import { cn } from "@/lib/utils/cn";

const SETTINGS_SECTIONS = [
  {
    category: "Account",
    items: [
      { label: "Profile", href: "/settings/profile", icon: UserRound, hint: "Identity" },
      { label: "Preferences", href: "/settings/preferences", icon: SlidersHorizontal, hint: "Defaults" },
    ],
  },
  {
    category: "Experience",
    items: [
      { label: "Theme", href: "/settings/theme", icon: Brush, hint: "Atmosphere" },
      { label: "Notifications", href: "/settings/notifications", icon: Bell, hint: "Reminders" },
    ],
  },
  {
    category: "Tools",
    items: [
      { label: "Extension", href: "/settings/extension", icon: Puzzle, hint: "Browser" },
      { label: "Boundaries", href: "/settings/blacklist", icon: ListX, hint: "Distractions" },
    ],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AmbientWorkspaceBackground className="bg-[#070907]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 text-sm text-text-secondary backdrop-blur-xl transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              Dashboard
            </Link>
            <Link
              href="/study-tools"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 text-sm text-text-secondary backdrop-blur-xl transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FileText className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              AI Docs
            </Link>
          </div>
          <p className="hidden rounded-full bg-black/10 px-4 py-2 text-xs text-text-muted backdrop-blur-md sm:block">
            FocusOS settings
          </p>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 lg:py-10">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-[1.75rem] border border-white/10 bg-[rgb(10_13_10/0.58)] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
              <div className="px-3 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Settings</p>
                <h1 className="mt-3 text-3xl font-light leading-tight text-text-primary">
                  Tune the room
                </h1>
                <p className="mt-3 max-w-[24ch] text-sm leading-6 text-text-secondary">
                  Keep the focus space quiet, personal, and ready.
                </p>
              </div>

              <nav className="mt-3 space-y-5" aria-label="Settings sections">
                {SETTINGS_SECTIONS.map((section) => (
                  <div key={section.category} className="space-y-2">
                    <p className="px-3 text-[11px] text-text-muted">{section.category}</p>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isActive
                                ? "bg-white/[0.12] text-text-primary shadow-[0_14px_38px_rgba(0,0,0,0.2)]"
                                : "text-text-secondary hover:bg-white/[0.065] hover:text-text-primary"
                            )}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <span
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                                isActive
                                  ? "border-primary/30 bg-primary/15 text-primary"
                                  : "border-white/10 bg-white/[0.045] text-text-muted group-hover:text-text-primary"
                              )}
                            >
                              <Icon className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className="block">{item.label}</span>
                              <span className="mt-0.5 block text-xs text-text-muted">{item.hint}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          <main className="min-w-0">
            {children}
          </main>
        </div>
      </div>
    </AmbientWorkspaceBackground>
  );
}
