"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { SupportedLanguage } from "@/i18n/language";

const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; labelKey: string }> = [
  { value: "vi", labelKey: "language.vi" },
  { value: "en", labelKey: "language.en" },
];

export function LanguageSelector() {
  const { t } = useTranslation("settings");
  const { language, setLanguage, isSaving, syncError } = useLanguage();

  return (
    <Card className="rounded-[2rem] p-6 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-primary">
          <Languages className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-light text-text-primary">{t("language.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {t("language.description")}
          </p>
          <div
            className="mt-4 inline-grid rounded-full border border-white/10 bg-white/[0.035] p-1 sm:grid-cols-2"
            aria-label={t("language.selectLabel")}
          >
            {LANGUAGE_OPTIONS.map((option) => {
              const isActive = language === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void setLanguage(option.value)}
                  aria-pressed={isActive}
                  disabled={isSaving}
                  className={`rounded-full px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive
                      ? "bg-primary/80 text-black"
                      : "text-text-secondary hover:bg-white/[0.08] hover:text-text-primary"
                  }`}
                >
                  {t(option.labelKey)}
                </button>
              );
            })}
          </div>
          {isSaving && <p className="mt-3 text-xs text-text-muted">{t("language.saving")}</p>}
          {syncError && (
            <p role="status" className="mt-3 text-xs text-urgency-amber">
              {syncError}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
