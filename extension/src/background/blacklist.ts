import type { BlacklistPayload, BlacklistWarning, WarningLevel } from "./types";
import { domainsMatch, normalizeDomain } from "./domain";

export function normalizeBlacklist(entries: BlacklistPayload[] = []): BlacklistPayload[] {
  const seen = new Set<string>();
  const normalized: BlacklistPayload[] = [];

  for (const entry of entries) {
    const domain = normalizeDomain(entry.domain);
    if (!domain || seen.has(domain)) continue;

    seen.add(domain);
    normalized.push({
      domain,
      severity: entry.severity === "high" ? "high" : "medium",
    });
  }

  return normalized;
}

export function levelForSeverity(severity: "high" | "medium"): WarningLevel {
  return severity === "high" ? 3 : 2;
}

export function findBlacklistWarning(
  sessionId: string,
  domain: string,
  entries: BlacklistPayload[]
): BlacklistWarning | null {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return null;

  const match = entries.find((entry) => domainsMatch(normalizedDomain, entry.domain));
  if (!match) return null;

  return {
    sessionId,
    domain: normalizedDomain,
    matchedDomain: match.domain,
    severity: match.severity,
    level: levelForSeverity(match.severity),
    occurredAt: new Date().toISOString(),
  };
}
