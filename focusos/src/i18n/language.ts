export const SUPPORTED_LANGUAGES = ["vi", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "vi";
export const LANGUAGE_STORAGE_KEY = "focusos.language";

export const localeMap: Record<SupportedLanguage, string> = {
  vi: "vi-VN",
  en: "en-US",
};

export function normalizeLanguage(value?: string | null): SupportedLanguage {
  const normalized = value?.toLowerCase();
  if (normalized?.startsWith("en")) return "en";
  return "vi";
}

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

export function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredLanguage(): SupportedLanguage | null {
  if (!canUseLocalStorage()) return null;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored ? normalizeLanguage(stored) : null;
}

export function persistLanguage(language: SupportedLanguage) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function getBrowserLanguage(): SupportedLanguage {
  if (typeof window === "undefined" || typeof navigator === "undefined") return DEFAULT_LANGUAGE;
  return normalizeLanguage(navigator.language);
}

export function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  return getStoredLanguage() ?? getBrowserLanguage() ?? DEFAULT_LANGUAGE;
}

export function applyDocumentLanguage(language: SupportedLanguage) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

export function getIntlLocale(language: SupportedLanguage) {
  return localeMap[language];
}
