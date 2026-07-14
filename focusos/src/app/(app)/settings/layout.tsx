"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Bell,
  Languages,
  ListX,
  Puzzle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AmbientWorkspaceBackground } from "@/components/focus-home";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils/cn";

const SETTINGS_SECTIONS = [
  {
    categoryKey: "layout.categories.account",
    items: [
      { labelKey: "layout.items.profile", href: "/settings/profile", icon: UserRound, hintKey: "layout.items.profileHint" },
      { labelKey: "layout.items.account", href: "/settings/account", icon: ShieldCheck, hintKey: "layout.items.accountHint" },
    ],
  },
  {
    categoryKey: "layout.categories.experience",
    items: [
      { labelKey: "layout.items.notifications", href: "/settings/notifications", icon: Bell, hintKey: "layout.items.notificationsHint" },
    ],
  },
  {
    categoryKey: "layout.categories.tools",
    items: [
      { labelKey: "layout.items.extension", href: "/settings/extension", icon: Puzzle, hintKey: "layout.items.extensionHint" },
      { labelKey: "layout.items.boundaries", href: "/settings/blacklist", icon: ListX, hintKey: "layout.items.boundariesHint" },
    ],
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useTranslation("settings");
  const { language, setLanguage, isSaving } = useLanguage();
  const nextLanguage = language === "vi" ? "en" : "vi";
  const nextLanguageLabel = t(`language.${nextLanguage}`);

  return (
    <AmbientWorkspaceBackground className="bg-[#070907]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 text-sm text-text-secondary backdrop-blur-xl transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            {t("layout.backDashboard")}
          </Link>
          <div className="flex items-center gap-2">
            <p className="hidden rounded-full bg-black/25 px-4 py-2 text-xs text-text-muted backdrop-blur-md sm:block">
              {t("layout.eyebrow")}
            </p>
            <button
              type="button"
              onClick={() => void setLanguage(nextLanguage)}
              disabled={isSaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-[rgb(9_12_9/0.78)] px-3 text-xs font-medium text-text-secondary shadow-[0_12px_34px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-colors hover:bg-white/[0.09] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={t("language.switchTo", { language: nextLanguageLabel })}
              title={t("language.switchTo", { language: nextLanguageLabel })}
            >
              <Languages className="h-3.5 w-3.5 stroke-[1.7]" aria-hidden="true" />
              {nextLanguage.toUpperCase()}
            </button>
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10 lg:py-10">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-[1.75rem] border border-white/10 bg-[rgb(10_13_10/0.58)] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
              <div className="px-3 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{t("layout.eyebrow")}</p>
                <h1 className="mt-3 text-3xl font-light leading-tight text-text-primary">
                  {t("layout.title")}
                </h1>
                <p className="mt-3 max-w-[24ch] text-sm leading-6 text-text-secondary">
                  {t("layout.description")}
                </p>
              </div>

              <nav className="mt-3 space-y-5" aria-label={t("layout.sectionsLabel")}>
                {SETTINGS_SECTIONS.map((section) => (
                  <div key={section.categoryKey} className="space-y-2">
                    <p className="px-3 text-[11px] text-text-muted">{t(section.categoryKey)}</p>
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
                              <span className="block">{t(item.labelKey)}</span>
                              <span className="mt-0.5 block text-xs text-text-muted">{t(item.hintKey)}</span>
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
