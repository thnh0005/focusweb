import { IGNORED_URL_PREFIXES } from "../shared/constants";

export function normalizeDomain(value?: string): string {
  const rawValue = String(value ?? "").trim().toLowerCase();
  if (!rawValue) return "";

  try {
    const parsed = new URL(
      rawValue.includes("://") ? rawValue : `https://${rawValue}`
    );
    return (parsed.hostname || "").replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return rawValue
      .split("/")[0]
      .replace(/^www\./, "")
      .replace(/\.$/, "");
  }
}

export function getDomainFromUrl(url?: string): string {
  if (!url) return "";
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return "";
  }
}

export function isTrackableUrl(url?: string): boolean {
  if (!url) return false;
  const normalized = url.trim().toLowerCase();
  if (!normalized) return false;
  if (IGNORED_URL_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  return normalized.startsWith("http://") || normalized.startsWith("https://");
}

export function domainsMatch(candidate?: string, protectedDomain?: string): boolean {
  const candidateDomain = normalizeDomain(candidate);
  const protectedValue = normalizeDomain(protectedDomain);
  if (!candidateDomain || !protectedValue) return false;
  return (
    candidateDomain === protectedValue ||
    candidateDomain.endsWith(`.${protectedValue}`)
  );
}

export function sanitizeTitle(title?: string): string | undefined {
  const cleaned = String(title ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return undefined;
  return cleaned.slice(0, 500);
}
