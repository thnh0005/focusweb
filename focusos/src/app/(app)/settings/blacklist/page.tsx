"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, ShieldAlert, X } from "lucide-react";
import { blacklistApi } from "@/services/blacklist.api";
import { syncBlacklistToExtension } from "@/lib/extension/bridge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { BlacklistEntry, BlacklistSeverity } from "@/types/user.types";

export default function BlacklistSettingsPage() {
  const { t } = useTranslation("settings");
  const [entries, setEntries] = React.useState<BlacklistEntry[]>([]);
  const [newDomain, setNewDomain] = React.useState("");
  const [newSeverity, setNewSeverity] = React.useState<BlacklistSeverity>("medium");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAdding, setIsAdding] = React.useState(false);
  const [mutatingEntryId, setMutatingEntryId] = React.useState<string | null>(null);
  const [domainDrafts, setDomainDrafts] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;

    blacklistApi
      .getBlacklist()
      .then((currentEntries) => {
        if (isMounted) {
          setEntries(currentEntries);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(getErrorMessage(loadError, t("blacklist.errors.load")));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const syncEntries = React.useCallback((nextEntries: BlacklistEntry[]) => {
    void syncBlacklistToExtension(
      nextEntries
        .filter((entry) => entry.enabled)
        .map((entry) => ({
          domain: entry.domain,
          severity: entry.severity,
          enabled: entry.enabled,
          source: entry.source,
          updatedAt: entry.updatedAt,
        }))
    );
  }, []);

  const handleAddDomain = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;

    setIsAdding(true);
    setError("");
    setSuccessMessage("");
    try {
      const createdEntry = await blacklistApi.addBlacklistEntry({
        domain,
        severity: newSeverity,
      });
      setEntries((currentEntries) => {
        const nextEntries = [...currentEntries, createdEntry];
        syncEntries(nextEntries);
        return nextEntries;
      });
      setNewDomain("");
      setNewSeverity("medium");
      setSuccessMessage(t("blacklist.successAdded"));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (addError) {
      setError(getErrorMessage(addError, t("blacklist.errors.add")));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveDomain = async (entry: BlacklistEntry) => {
    setMutatingEntryId(entry.id);
    setError("");
    setSuccessMessage("");
    try {
      await blacklistApi.removeBlacklistEntry(entry.id);
      setEntries((currentEntries) => {
        const nextEntries = currentEntries.filter((currentEntry) => currentEntry.id !== entry.id);
        syncEntries(nextEntries);
        return nextEntries;
      });
      setSuccessMessage(t("blacklist.successRemoved"));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (removeError) {
      setError(getErrorMessage(removeError, t("blacklist.errors.remove")));
    } finally {
      setMutatingEntryId(null);
    }
  };

  const handleSeverityChange = async (
    entry: BlacklistEntry,
    severity: BlacklistSeverity
  ) => {
    if (entry.severity === severity) return;

    setMutatingEntryId(entry.id);
    setError("");
    setSuccessMessage("");
    try {
      const updatedEntry = await blacklistApi.changeSeverity(entry.id, severity);
      setEntries((currentEntries) => {
        const nextEntries = currentEntries.map((currentEntry) =>
          currentEntry.id === updatedEntry.id ? updatedEntry : currentEntry
        );
        syncEntries(nextEntries);
        return nextEntries;
      });
      setSuccessMessage(t("blacklist.successSeverity"));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (updateError) {
      setError(getErrorMessage(updateError, t("blacklist.errors.severity")));
    } finally {
      setMutatingEntryId(null);
    }
  };

  const handleToggleEnabled = async (entry: BlacklistEntry) => {
    setMutatingEntryId(entry.id);
    setError("");
    setSuccessMessage("");
    try {
      const updatedEntry = await blacklistApi.updateBlacklistEntry(entry.id, {
        enabled: !entry.enabled,
      });
      setEntries((currentEntries) => {
        const nextEntries = currentEntries.map((currentEntry) =>
          currentEntry.id === updatedEntry.id ? updatedEntry : currentEntry
        );
        syncEntries(nextEntries);
        return nextEntries;
      });
      setSuccessMessage(updatedEntry.enabled ? t("blacklist.successEnabled") : t("blacklist.successDisabled"));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (updateError) {
      setError(getErrorMessage(updateError, t("blacklist.errors.boundary")));
    } finally {
      setMutatingEntryId(null);
    }
  };

  const handleDomainDraftChange = (entryId: string, domain: string) => {
    setDomainDrafts((currentDrafts) => ({ ...currentDrafts, [entryId]: domain }));
  };

  const handleDomainSave = async (entry: BlacklistEntry) => {
    const domain = (domainDrafts[entry.id] ?? entry.domain).trim().toLowerCase();
    if (!domain) {
      setDomainDrafts((currentDrafts) => ({ ...currentDrafts, [entry.id]: entry.domain }));
      return;
    }
    if (domain === entry.domain) return;

    setMutatingEntryId(entry.id);
    setError("");
    setSuccessMessage("");
    try {
      const updatedEntry = await blacklistApi.updateBlacklistEntry(entry.id, { domain });
      setEntries((currentEntries) => {
        const nextEntries = currentEntries.map((currentEntry) =>
          currentEntry.id === updatedEntry.id ? updatedEntry : currentEntry
        );
        syncEntries(nextEntries);
        return nextEntries;
      });
      setDomainDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[entry.id];
        return nextDrafts;
      });
      setSuccessMessage(t("blacklist.successDomain"));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (updateError) {
      setError(getErrorMessage(updateError, t("blacklist.errors.domain")));
      setDomainDrafts((currentDrafts) => ({ ...currentDrafts, [entry.id]: entry.domain }));
    } finally {
      setMutatingEntryId(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-text-muted">{t("blacklist.eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-light text-text-primary">{t("blacklist.title")}</h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          {t("blacklist.description")}
        </p>
      </header>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-light text-text-primary">{t("blacklist.addTitle")}</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={newDomain}
            onChange={(event) => setNewDomain(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAddDomain();
            }}
            placeholder={t("blacklist.domainPlaceholder")}
            className="h-12 rounded-2xl bg-white/[0.04]"
            aria-label={t("blacklist.domainAria")}
            disabled={isLoading || isAdding}
          />
          <select
            value={newSeverity}
            onChange={(event) => setNewSeverity(event.target.value as BlacklistSeverity)}
            disabled={isLoading || isAdding}
            className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t("blacklist.severityAria")}
          >
            <option value="medium">{t("blacklist.mediumRisk")}</option>
            <option value="high">{t("blacklist.highRisk")}</option>
            <option value="low">{t("blacklist.lowRisk")}</option>
          </select>
          <Button type="button" onClick={handleAddDomain} disabled={isLoading || isAdding} variant="session" className="h-12 rounded-full px-6">
            <Plus className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            {isAdding ? t("blacklist.adding") : t("blacklist.add")}
          </Button>
        </div>
      </Card>

      {error && (
        <div role="alert" className="rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3">
          <p className="text-sm font-light text-urgency-coral">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3">
          <p className="text-sm font-light text-primary">{successMessage}</p>
        </div>
      )}

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-light text-text-primary">{t("blacklist.protectedTitle")}</h2>
          <span className="text-xs font-mono text-text-muted">{t("blacklist.domainCount", { count: entries.length })}</span>
        </div>
        <div className="space-y-2">
          {isLoading && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-sm font-light text-text-secondary">{t("blacklist.loading")}</p>
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-sm font-light text-text-secondary">{t("blacklist.empty")}</p>
            </div>
          )}

          {!isLoading && entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
            >
              <div className="min-w-0 flex-1">
                <input
                  value={domainDrafts[entry.id] ?? entry.domain}
                  onChange={(event) => handleDomainDraftChange(entry.id, event.target.value)}
                  onBlur={() => handleDomainSave(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      setDomainDrafts((currentDrafts) => ({
                        ...currentDrafts,
                        [entry.id]: entry.domain,
                      }));
                      event.currentTarget.blur();
                    }
                  }}
                  disabled={mutatingEntryId === entry.id}
                  className="w-full bg-transparent text-sm font-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t("blacklist.domainAriaFor", { domain: entry.domain })}
                />
                <p className="mt-1 text-xs text-text-muted">
                  {entry.isDefault ? t("blacklist.defaultBoundary") : t("blacklist.customBoundary")} / {entry.enabled ? t("blacklist.enabled") : t("blacklist.disabled")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={entry.severity}
                  onChange={(event) =>
                    handleSeverityChange(entry, event.target.value as BlacklistSeverity)
                  }
                  disabled={mutatingEntryId === entry.id}
                  className="h-9 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={t("blacklist.severityAriaFor", { domain: entry.domain })}
                >
                  <option value="medium">{t("blacklist.mediumRisk")}</option>
                  <option value="high">{t("blacklist.highRisk")}</option>
                  <option value="low">{t("blacklist.lowRisk")}</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleToggleEnabled(entry)}
                  disabled={mutatingEntryId === entry.id}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {entry.enabled ? t("blacklist.disable") : t("blacklist.enable")}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveDomain(entry)}
                  disabled={mutatingEntryId === entry.id}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-all hover:bg-urgency-coral/10 hover:text-urgency-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted"
                  aria-label={t("blacklist.removeAria", { domain: entry.domain })}
                >
                  <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
