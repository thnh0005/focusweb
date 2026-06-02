"use client";

import * as React from "react";
import { Plus, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function BlacklistSettingsPage() {
  const [domains, setDomains] = React.useState<string[]>([
    "youtube.com",
    "reddit.com",
    "twitter.com",
    "instagram.com",
  ]);
  const [newDomain, setNewDomain] = React.useState("");

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase();
    if (domain && !domains.includes(domain)) {
      setDomains([...domains, domain]);
      setNewDomain("");
    }
  };

  const handleRemoveDomain = (domain: string) => {
    setDomains(domains.filter((d) => d !== domain));
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
          />
          <Button type="button" onClick={handleAddDomain} variant="session" className="h-12 rounded-full px-6">
            <Plus className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            Add
          </Button>
        </div>
      </Card>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-light text-text-primary">Protected attention</h2>
          <span className="text-xs font-mono text-text-muted">{domains.length} domains</span>
        </div>
        <div className="space-y-2">
          {domains.map((domain) => (
            <div
              key={domain}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{domain}</p>
                <p className="mt-1 text-xs text-text-muted">Warning boundary during focus</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveDomain(domain)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-all hover:bg-urgency-coral/10 hover:text-urgency-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove ${domain}`}
              >
                <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
