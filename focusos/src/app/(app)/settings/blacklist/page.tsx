"use client";

import * as React from "react";
import { Plus, ShieldAlert, X } from "lucide-react";
import { blacklistApi } from "@/services/blacklist.api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { BlacklistEntry, BlacklistSeverity } from "@/types/user.types";

export default function BlacklistSettingsPage() {
  const [entries, setEntries] = React.useState<BlacklistEntry[]>([]);
  const [newDomain, setNewDomain] = React.useState("");
  const [newSeverity, setNewSeverity] = React.useState<BlacklistSeverity>("medium");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAdding, setIsAdding] = React.useState(false);
  const [mutatingEntryId, setMutatingEntryId] = React.useState<string | null>(null);
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
          setError(getErrorMessage(loadError, "Failed to load blacklist"));
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
      setEntries((currentEntries) => [...currentEntries, createdEntry]);
      setNewDomain("");
      setNewSeverity("medium");
      setSuccessMessage("Boundary added successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (addError) {
      setError(getErrorMessage(addError, "Failed to add domain"));
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveDomain = async (entry: BlacklistEntry) => {
    if (entry.isDefault) return;

    setMutatingEntryId(entry.id);
    setError("");
    setSuccessMessage("");
    try {
      await blacklistApi.removeBlacklistEntry(entry.id);
      setEntries((currentEntries) =>
        currentEntries.filter((currentEntry) => currentEntry.id !== entry.id)
      );
      setSuccessMessage("Boundary removed successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (removeError) {
      setError(getErrorMessage(removeError, "Failed to remove domain"));
    } finally {
      setMutatingEntryId(null);
    }
  };

  const handleSeverityChange = async (
    entry: BlacklistEntry,
    severity: BlacklistSeverity
  ) => {
    if (entry.isDefault || entry.severity === severity) return;

    setMutatingEntryId(entry.id);
    setError("");
    setSuccessMessage("");
    try {
      const updatedEntry = await blacklistApi.changeSeverity(entry.id, severity);
      setEntries((currentEntries) =>
        currentEntries.map((currentEntry) =>
          currentEntry.id === updatedEntry.id ? updatedEntry : currentEntry
        )
      );
      setSuccessMessage("Severity updated successfully");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (updateError) {
      setError(getErrorMessage(updateError, "Failed to update severity"));
    } finally {
      setMutatingEntryId(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-text-muted">Boundaries</p>
        <h1 className="mt-2 text-4xl font-light text-text-primary">Distraction boundaries</h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          Choose domains that should gently interrupt Normal Mode sessions.
        </p>
      </header>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-light text-text-primary">Add a boundary</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={newDomain}
            onChange={(event) => setNewDomain(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAddDomain();
            }}
            placeholder="e.g. facebook.com"
            className="h-12 rounded-2xl bg-white/[0.04]"
            aria-label="Domain to add"
            disabled={isLoading || isAdding}
          />
          <select
            value={newSeverity}
            onChange={(event) => setNewSeverity(event.target.value as BlacklistSeverity)}
            disabled={isLoading || isAdding}
            className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Boundary severity"
          >
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <Button type="button" onClick={handleAddDomain} disabled={isLoading || isAdding} variant="session" className="h-12 rounded-full px-6">
            <Plus className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            {isAdding ? "Adding" : "Add"}
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
          <h2 className="text-xl font-light text-text-primary">Protected attention</h2>
          <span className="text-xs font-mono text-text-muted">{entries.length} domains</span>
        </div>
        <div className="space-y-2">
          {isLoading && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-sm font-light text-text-secondary">Loading boundaries...</p>
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-sm font-light text-text-secondary">No boundaries have been added yet.</p>
            </div>
          )}

          {!isLoading && entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{entry.domain}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {entry.isDefault ? "Default boundary" : "Custom boundary"} during focus
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={entry.severity}
                  onChange={(event) =>
                    handleSeverityChange(entry, event.target.value as BlacklistSeverity)
                  }
                  disabled={entry.isDefault || mutatingEntryId === entry.id}
                  className="h-9 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Severity for ${entry.domain}`}
                >
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveDomain(entry)}
                  disabled={entry.isDefault || mutatingEntryId === entry.id}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-all hover:bg-urgency-coral/10 hover:text-urgency-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted"
                  aria-label={`Remove ${entry.domain}`}
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
