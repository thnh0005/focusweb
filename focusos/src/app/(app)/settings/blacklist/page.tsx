"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
    if (newDomain && !domains.includes(newDomain)) {
      setDomains([...domains, newDomain]);
      setNewDomain("");
    }
  };

  const handleRemoveDomain = (domain: string) => {
    setDomains(domains.filter((d) => d !== domain));
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-extralight text-text-primary">
          Distraction Blacklist
        </h1>
        <p className="text-sm text-text-secondary font-light">
          Websites that will trigger warnings during Normal Mode sessions.
        </p>
      </div>

      {/* Add Domain Form */}
      <Card className="p-6 space-y-4">
        <h2 className="font-medium text-text-primary">Add Website</h2>
        <div className="flex gap-2">
          <Input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddDomain()}
            placeholder="e.g., facebook.com"
            className="flex-1 bg-surface-deep border-subtle-border"
          />
          <Button
            onClick={handleAddDomain}
            className="bg-focus-purple hover:bg-focus-purple/90 text-white"
          >
            Add
          </Button>
        </div>
      </Card>

      {/* Blacklist */}
      <Card className="p-6 space-y-4">
        <h2 className="font-medium text-text-primary">Blacklisted Domains</h2>
        <div className="space-y-2">
          {domains.map((domain) => (
            <div
              key={domain}
              className="flex items-center justify-between p-3 bg-surface-deep rounded-lg"
            >
              <span className="text-text-secondary text-sm">{domain}</span>
              <button
                onClick={() => handleRemoveDomain(domain)}
                className="text-xs text-red-500 hover:text-red-400 font-medium"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
