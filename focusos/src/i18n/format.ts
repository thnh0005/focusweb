import { getIntlLocale, normalizeLanguage, type SupportedLanguage } from "./language";

export function getCurrentLanguage(): SupportedLanguage {
  if (typeof document === "undefined") return "vi";
  return normalizeLanguage(document.documentElement.lang);
}

export function formatNumberForLanguage(value: number, language = getCurrentLanguage()) {
  return new Intl.NumberFormat(getIntlLocale(language)).format(value);
}

export function formatDateForLanguage(
  date: Date | string,
  options: Intl.DateTimeFormatOptions,
  language = getCurrentLanguage()
) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(getIntlLocale(language), options).format(value);
}

export function formatRelativeTimeForLanguage(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  language = getCurrentLanguage()
) {
  return new Intl.RelativeTimeFormat(getIntlLocale(language), { numeric: "auto" }).format(
    value,
    unit
  );
}
