"use client";

import * as React from "react";
import { ImagePlus, Moon, Palette, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { userApi } from "@/services/user.api";
import { THEME_OPTIONS, getThemeOption, getThemeSwatches } from "@/constants/theme-options";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  clearWorkspaceBackground,
  MAX_WORKSPACE_BACKGROUND_BYTES,
  readWorkspaceBackground,
  saveWorkspaceBackground,
} from "@/lib/preferences/background";
import type { AppTheme } from "@/types/user.types";

const ACCENT_COLORS = [
  { id: "moss", bg: "bg-primary" },
  { id: "rain", bg: "bg-ambient-cyan" },
  { id: "ember", bg: "bg-urgency-amber" },
];

export default function ThemeSettingsPage() {
  const { t } = useTranslation("settings");
  const tRef = React.useRef(t);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [theme, setTheme] = React.useState<AppTheme>("forest");
  const [accentColor, setAccentColor] = React.useState("moss");
  const [backgroundImage, setBackgroundImage] = React.useState(() => readWorkspaceBackground());
  const [backgroundError, setBackgroundError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    tRef.current = t;
  }, [t]);

  React.useEffect(() => {
    let isMounted = true;

    async function loadThemePreferences() {
      setIsLoading(true);
      setError("");
      try {
        const currentTheme = await userApi.getThemePreferences();
        if (!isMounted) return;
        setTheme(getThemeOption(currentTheme.theme).id);
        setAccentColor(currentTheme.themeAccent || "moss");

        if (currentTheme.workspaceBackgroundUrl) {
          saveWorkspaceBackground(currentTheme.workspaceBackgroundUrl);
          setBackgroundImage(currentTheme.workspaceBackgroundUrl);
        } else {
          setBackgroundImage(readWorkspaceBackground());
        }
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, tRef.current("themePage.errors.load")));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadThemePreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleBackgroundUpload = (file: File | undefined) => {
    setBackgroundError("");
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setBackgroundError(t("themePage.errors.imageType"));
      return;
    }

    if (file.size > MAX_WORKSPACE_BACKGROUND_BYTES) {
      setBackgroundError(t("themePage.errors.imageSize"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        setBackgroundError(t("themePage.errors.imageRead"));
        return;
      }
      try {
        saveWorkspaceBackground(result);
        setBackgroundImage(result);
      } catch {
        setBackgroundError(t("themePage.errors.browserStorage"));
      }
    };
    reader.onerror = () => setBackgroundError(t("themePage.errors.imageRead"));
    reader.readAsDataURL(file);
  };

  const handleClearBackground = () => {
    clearWorkspaceBackground();
    setBackgroundImage("");
    setBackgroundError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError("");

    try {
      await userApi.updateThemePreferences({
        theme,
        themeAccent: accentColor,
        workspaceBackgroundUrl: isHttpUrl(backgroundImage) ? backgroundImage : "",
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (saveError) {
      setError(getErrorMessage(saveError, t("themePage.errors.save")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <p className="text-sm text-text-muted">{t("themePage.eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-light text-text-primary">{t("themePage.title")}</h1>
        <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-text-secondary">
          {t("themePage.description")}
        </p>
      </header>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <Moon className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-light text-text-primary">{t("themePage.previews")}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              disabled={isLoading || isSaving}
              className={`rounded-3xl border p-4 text-left transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                theme === option.id
                  ? "border-primary/45 bg-primary/10"
                  : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
              }`}
              aria-pressed={theme === option.id}
            >
              <div className="mb-4 flex h-24 overflow-hidden rounded-2xl border border-white/10">
                {getThemeSwatches(option, "dark").map((swatch) => (
                  <span key={swatch} className="flex-1" style={{ backgroundColor: swatch }} />
                ))}
              </div>
              <p className="font-medium text-text-primary">{t(`themePage.themes.${option.id}.label`)}</p>
              <p className="mt-1 text-sm font-light text-text-secondary">
                {t(`themePage.themes.${option.id}.description`)}
              </p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-light text-text-primary">{t("themePage.accent")}</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ACCENT_COLORS.map((accent) => (
            <button
              key={accent.id}
              type="button"
              onClick={() => setAccentColor(accent.id)}
              disabled={isLoading || isSaving}
              className={`rounded-2xl border p-4 transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                accentColor === accent.id
                  ? "border-text-primary bg-white/[0.06]"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.055]"
              }`}
              aria-pressed={accentColor === accent.id}
            >
              <div className={`h-9 w-full rounded-xl ${accent.bg}`} />
              <p className="mt-2 text-center text-xs font-light text-text-secondary">
                {t(`themePage.accents.${accent.id}`)}
              </p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <ImagePlus className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-xl font-light text-text-primary">{t("themePage.background")}</h2>
            <p className="mt-1 text-sm font-light text-text-secondary">
              {t("themePage.backgroundDescription")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-stretch">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving}
            className="flex min-h-40 flex-col items-center justify-center rounded-3xl border border-dashed border-white/14 bg-white/[0.035] p-6 text-center transition-all duration-fast hover:border-primary/40 hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => handleBackgroundUpload(event.target.files?.[0])}
            />
            <ImagePlus className="h-9 w-9 text-primary" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium text-text-primary">{t("themePage.chooseImage")}</p>
            <p className="mt-1 text-xs font-light text-text-muted">{t("themePage.imageHelp")}</p>
          </button>

          <div className="relative min-h-40 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
            {backgroundImage ? (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${backgroundImage})` }}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(168,192,146,0.22),transparent_8rem),linear-gradient(180deg,#0d110d,#050605)]" />
            )}
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <span className="rounded-full bg-black/35 px-3 py-1 text-xs text-text-secondary backdrop-blur-md">
                {backgroundImage ? t("themePage.customImage") : t("themePage.defaultAmbient")}
              </span>
              {backgroundImage && (
                <button
                  type="button"
                  onClick={handleClearBackground}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/35 text-text-secondary backdrop-blur-md transition-colors hover:bg-white/[0.1] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("themePage.removeBackground")}
                >
                  <Trash2 className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        {backgroundError && (
          <div role="alert" className="mt-4 rounded-2xl border border-urgency-amber/25 bg-urgency-amber/10 p-3">
            <p className="text-sm text-urgency-amber">{backgroundError}</p>
          </div>
        )}
      </Card>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <h2 className="text-xl font-light text-text-primary">{t("themePage.display")}</h2>
        <p className="mt-2 text-sm font-light text-text-secondary">
          {t("themePage.displayDescription")}
        </p>
        <div className="mt-4 space-y-3 text-sm">
          <StaticToggle label={t("themePage.reduceMotion")} comingSoon={t("themePage.comingSoon")} />
          <StaticToggle label={t("themePage.compactMode")} comingSoon={t("themePage.comingSoon")} />
        </div>
      </Card>

      {saveSuccess && (
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3">
          <p className="text-sm font-light text-primary">{t("themePage.saved")}</p>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3">
          <p className="text-sm font-light text-urgency-coral">{error}</p>
        </div>
      )}

      <Button type="button" onClick={handleSave} disabled={isLoading || isSaving} variant="session" className="rounded-full px-6">
        {isLoading ? t("themePage.loading") : isSaving ? t("themePage.saving") : t("themePage.save")}
      </Button>
    </div>
  );
}

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function StaticToggle({ label, comingSoon }: { label: string; comingSoon: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className="ml-auto mr-3 text-xs font-light text-text-muted">{comingSoon}</span>
      <span
        role="switch"
        aria-checked={false}
        aria-disabled={true}
        aria-label={label}
        className="inline-flex h-7 w-12 items-center rounded-full border border-white/10 bg-white/[0.055]"
      >
        <span className="ml-1 inline-block h-5 w-5 rounded-full bg-white" />
      </span>
    </div>
  );
}
