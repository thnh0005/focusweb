import type {
  BlacklistPayload,
  BlacklistRiskLevel,
  BlacklistWarning,
  WarningLevel,
} from "./types";
import { domainsMatch, normalizeDomain } from "./domain";

export function normalizeBlacklist(entries: BlacklistPayload[] = []): BlacklistPayload[] {
  const seen = new Set<string>();
  const normalized: BlacklistPayload[] = [];

  for (const entry of entries) {
    const domain = normalizeDomain(entry.domain);
    if (!domain || seen.has(domain)) continue;

    seen.add(domain);
    const severity = normalizeSeverity(entry.severity);
    normalized.push({
      domain,
      severity,
      enabled: entry.enabled !== false,
      source: entry.source,
      updatedAt: entry.updatedAt,
    });
  }

  return normalized;
}

export function normalizeSeverity(value?: string): "high" | "medium" | "low" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

export function riskLevelForSeverity(severity: string): BlacklistRiskLevel {
  const normalized = normalizeSeverity(severity);
  if (normalized === "high") return "HIGH";
  if (normalized === "low") return "LOW";
  return "MEDIUM";
}

export function levelForSeverity(severity: string): WarningLevel {
  return severity === "high" ? 3 : 2;
}

export function findBlacklistWarning(
  sessionId: string,
  domain: string,
  entries: BlacklistPayload[]
): BlacklistWarning | null {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return null;

  const match = entries.find(
    (entry) => entry.enabled !== false && domainsMatch(normalizedDomain, entry.domain)
  );
  if (!match) return null;
  const riskLevel = riskLevelForSeverity(match.severity);

  return {
    sessionId,
    domain: normalizedDomain,
    matchedDomain: match.domain,
    severity: match.severity,
    riskLevel,
    level: levelForSeverity(match.severity),
    occurredAt: new Date().toISOString(),
  };
}
