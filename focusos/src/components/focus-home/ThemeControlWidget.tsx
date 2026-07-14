"use client";

import * as React from "react";
import { AlertCircle, Check, ImagePlus, Loader2, Moon, Palette, Sun, Trash2 } from "lucide-react";
import {
  THEME_OPTIONS,
  getThemeImage,
  getThemeOption,
  getThemeSwatches,
  type ThemeAppearance,
  type ThemeOption,
} from "@/constants/theme-options";
import { useTranslation } from "react-i18next";
import { userApi } from "@/services/user.api";
import { useMusicStore } from "@/stores/music.store";
import { useUserStore } from "@/stores/user.store";
import {
  clearWorkspaceBackground,
  MAX_WORKSPACE_BACKGROUND_BYTES,
  readWorkspaceBackground,
  readWorkspaceThemeAppearance,
  saveWorkspaceBackground,
  saveWorkspaceThemeAppearance,
} from "@/lib/preferences/background";
import { cn } from "@/lib/utils/cn";
import type { AppTheme } from "@/types/user.types";
import { DashboardControlPopover } from "./DashboardControlPopover";

export interface ThemeControlWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeControlWidget({ isOpen, onClose }: ThemeControlWidgetProps) {
  const { t } = useTranslation("dashboard");
  const tRef = React.useRef(t);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const setCurrentSceneId = useMusicStore((state) => state.setCurrentSceneId);
  const preferences = useUserStore((state) => state.preferences);
  const [selectedTheme, setSelectedTheme] = React.useState<AppTheme>(
    getThemeOption(preferences?.theme).id
  );
  const [themeAccent, setThemeAccent] = React.useState(preferences?.themeAccent ?? "moss");
  const [appearance, setAppearance] = React.useState<ThemeAppearance>(() =>
    readWorkspaceThemeAppearance()
  );
  const [customBackground, setCustomBackground] = React.useState(() =>
    getCustomBackground(readWorkspaceBackground())
  );
  const [customThemeError, setCustomThemeError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [savingTheme, setSavingTheme] = React.useState<AppTheme | null>(null);
  const [error, setError] = React.useState("");
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  React.useEffect(() => {
    tRef.current = t;
  }, [t]);

  React.useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function loadThemePreferences() {
      setAppearance(readWorkspaceThemeAppearance());
      setCustomBackground(getCustomBackground(readWorkspaceBackground()));
      setCustomThemeError("");
      setIsLoading(true);
      setError("");
      try {
        const themePreferences = await userApi.getThemePreferences();
        if (!isMounted) return;
        setSelectedTheme(getThemeOption(themePreferences.theme).id);
        setThemeAccent(themePreferences.themeAccent || "moss");
        useUserStore.setState((state) => ({
          preferences: state.preferences
            ? {
                ...state.preferences,
                theme: themePreferences.theme,
                themeAccent: themePreferences.themeAccent,
                workspaceBackgroundUrl: themePreferences.workspaceBackgroundUrl,
              }
            : state.preferences,
        }));
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, tRef.current("focusHome.theme.errors.load")));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadThemePreferences();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleSelectTheme = React.useCallback(
    async (option: ThemeOption) => {
      setSelectedTheme(option.id);
      setCurrentSceneId(option.sceneId);
      saveWorkspaceBackground(getThemeImage(option, appearance));
      setCustomBackground("");
      setSavingTheme(option.id);
      setSaveSuccess(false);
      setError("");

      try {
        const nextTheme = await userApi.updateThemePreferences({
          theme: option.id,
          themeAccent,
        });
        setThemeAccent(nextTheme.themeAccent || themeAccent);
        useUserStore.setState((state) => ({
          preferences: state.preferences
            ? {
                ...state.preferences,
                theme: nextTheme.theme,
                themeAccent: nextTheme.themeAccent,
                workspaceBackgroundUrl: nextTheme.workspaceBackgroundUrl,
              }
            : state.preferences,
        }));
        setSaveSuccess(true);
        window.setTimeout(() => setSaveSuccess(false), 1800);
      } catch (saveError) {
        setError(getErrorMessage(saveError, tRef.current("focusHome.theme.errors.save")));
      } finally {
        setSavingTheme(null);
      }
    },
    [appearance, setCurrentSceneId, themeAccent]
  );

  const handleAppearanceChange = React.useCallback(
    (nextAppearance: ThemeAppearance) => {
      const option = getThemeOption(selectedTheme);
      setAppearance(nextAppearance);
      saveWorkspaceThemeAppearance(nextAppearance);
      if (!customBackground) {
        saveWorkspaceBackground(getThemeImage(option, nextAppearance));
      }
    },
    [customBackground, selectedTheme]
  );

  const handleThemeGridKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-theme-option]")
    );
    const currentIndex = buttons.findIndex((button) => button === document.activeElement);
    if (currentIndex < 0) return;

    event.preventDefault();
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  }, []);

  const handleCustomThemeUpload = React.useCallback((file: File | undefined) => {
    setCustomThemeError("");
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setCustomThemeError(t("focusHome.theme.errors.imageType"));
      return;
    }

    if (file.size > MAX_WORKSPACE_BACKGROUND_BYTES) {
      setCustomThemeError(t("focusHome.theme.errors.imageSize"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        setCustomThemeError(t("focusHome.theme.errors.imageRead"));
        return;
      }
      try {
        saveWorkspaceBackground(result);
        setCustomBackground(result);
        setSaveSuccess(true);
        window.setTimeout(() => setSaveSuccess(false), 1800);
      } catch {
        setCustomThemeError(t("focusHome.theme.errors.browserStorage"));
      }
    };
    reader.onerror = () => setCustomThemeError(t("focusHome.theme.errors.imageRead"));
    reader.readAsDataURL(file);
  }, [t]);

  const handleClearCustomTheme = React.useCallback(() => {
    const option = getThemeOption(selectedTheme);
    clearWorkspaceBackground();
    saveWorkspaceBackground(getThemeImage(option, appearance));
    setCustomBackground("");
    setCustomThemeError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [appearance, selectedTheme]);

  if (!isOpen) return null;

  const selectedOption = getThemeOption(selectedTheme);
  const selectedPreviewImage = getThemeImage(selectedOption, appearance);

  return (
    <DashboardControlPopover
      id="dashboard-theme-popover"
      title={t("focusHome.theme.title")}
      description={t("focusHome.theme.description")}
      icon={<Palette className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />}
      onClose={onClose}
      className="md:w-[min(92vw,430px)]"
    >
      <div className="mt-4 space-y-3">
        <div
          className="relative h-28 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
          aria-hidden="true"
        >
          <div
            key={`${selectedOption.id}-${appearance}`}
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.44), rgba(0,0,0,0.08)), url(${selectedPreviewImage})`,
            }}
          />
          <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-text-secondary backdrop-blur-md">
            {t(`focusHome.theme.options.${selectedOption.id}.label`)}
          </div>
        </div>

        <div
          className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1"
          role="group"
          aria-label={t("focusHome.theme.brightness")}
        >
          <BrightnessButton
            label={t("focusHome.theme.light")}
            icon={Sun}
            active={appearance === "light"}
            onClick={() => handleAppearanceChange("light")}
          />
          <BrightnessButton
            label={t("focusHome.theme.dark")}
            icon={Moon}
            active={appearance === "dark"}
            onClick={() => handleAppearanceChange("dark")}
          />
        </div>

        <div
          className="grid max-h-[46dvh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
          role="listbox"
          aria-label={t("focusHome.theme.choices")}
          aria-busy={isLoading}
          onKeyDown={handleThemeGridKeyDown}
        >
          {THEME_OPTIONS.map((option) => {
            const isSelected = selectedTheme === option.id;
            const isSavingThisTheme = savingTheme === option.id;

            return (
              <button
                key={option.id}
                type="button"
                data-theme-option
                role="option"
                aria-selected={isSelected}
                disabled={isLoading || savingTheme !== null}
                onClick={() => void handleSelectTheme(option)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border p-2.5 text-left transition-all duration-fast active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary/[0.45] bg-primary/15 text-text-primary"
                    : "border-white/10 bg-white/[0.045] text-text-secondary hover:bg-white/[0.075] hover:text-text-primary",
                  (isLoading || savingTheme !== null) && "cursor-wait opacity-75"
                )}
              >
                <div className="mb-2 flex h-14 overflow-hidden rounded-xl border border-white/10">
                  {getThemeSwatches(option, appearance).map((swatch) => (
                    <span key={swatch} className="flex-1" style={{ backgroundColor: swatch }} />
                  ))}
                </div>
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {t(`focusHome.theme.options.${option.id}.label`)}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-[10px] leading-4 text-text-muted">
                      {t(`focusHome.theme.options.${option.id}.description`)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      isSelected ? "bg-primary/20 text-primary" : "bg-white/[0.06] text-text-muted"
                    )}
                  >
                    {isSavingThisTheme ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : isSelected ? (
                      <Check className="h-3.5 w-3.5 stroke-[1.8]" aria-hidden="true" />
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-text-primary">{t("focusHome.theme.customTitle")}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-text-muted">
                {t("focusHome.theme.customDescription")}
              </p>
            </div>
            {customBackground && (
              <button
                type="button"
                onClick={handleClearCustomTheme}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("focusHome.theme.removeCustom")}
              >
                <Trash2 className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-white/14 bg-black/15 px-4 py-3 text-center transition-all hover:border-primary/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => handleCustomThemeUpload(event.target.files?.[0])}
              />
              <ImagePlus className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="mt-2 text-xs font-medium text-text-primary">
                {t("focusHome.theme.addImage")}
              </span>
              <span className="mt-0.5 text-[10px] text-text-muted">
                {t("focusHome.theme.imageTypes")}
              </span>
            </button>

            <div className="relative min-h-24 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
              {customBackground ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${customBackground})` }}
                />
              ) : (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-80"
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.18), rgba(0,0,0,0.03)), url(${selectedPreviewImage})`,
                  }}
                />
              )}
              <div className="absolute bottom-2 left-2 rounded-full bg-black/30 px-2 py-1 text-[10px] text-text-secondary backdrop-blur-md">
                {customBackground ? t("focusHome.theme.customBadge") : t("focusHome.theme.previewBadge")}
              </div>
            </div>
          </div>

          {customThemeError && (
            <p role="alert" className="mt-3 text-xs leading-5 text-urgency-coral">
              {customThemeError}
            </p>
          )}
        </section>

        {saveSuccess && (
          <p className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
            {t("focusHome.theme.saved")}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="flex gap-2 rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 px-3 py-2 text-xs leading-5 text-urgency-coral"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </DashboardControlPopover>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getCustomBackground(background: string) {
  return background.startsWith("data:") ? background : "";
}

type BrightnessIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function BrightnessButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: BrightnessIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 items-center justify-center gap-2 rounded-xl text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-white/[0.14] text-text-primary"
          : "text-text-muted hover:bg-white/[0.07] hover:text-text-primary"
      )}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5 stroke-[1.7]" aria-hidden />
      <span>{label}</span>
    </button>
  );
}
