"use client";

import * as React from "react";
import { ExternalLink, Puzzle, ShieldCheck } from "lucide-react";
import { useExtensionStore } from "@/stores/extension.store";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function ExtensionSettingsPage() {
  const { connected, version } = useExtensionStore();

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-text-muted">Extension</p>
        <h1 className="mt-2 text-4xl font-light text-text-primary">Browser bridge</h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          The extension helps FocusOS understand tab context during active sessions.
        </p>
      </header>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className={`flex h-14 w-14 items-center justify-center rounded-3xl border ${
              connected ? "border-primary/25 bg-primary/10 text-primary" : "border-urgency-amber/25 bg-urgency-amber/10 text-urgency-amber"
            }`}>
              <Puzzle className="h-6 w-6 stroke-[1.6]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-light text-text-primary">
                {connected ? "Extension connected" : "Extension not detected"}
              </h2>
              <p className="mt-2 text-sm font-light text-text-secondary">
                {connected
                  ? "Live distraction detection is ready for your next session."
                  : "You can still start sessions, but live tab detection may be limited."}
              </p>
              {version && <p className="mt-2 text-xs font-mono text-text-muted">Version {version}</p>}
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs ${
            connected ? "border-primary/25 bg-primary/10 text-primary" : "border-urgency-amber/25 bg-urgency-amber/10 text-urgency-amber"
          }`}>
            {connected ? "Ready" : "Needs setup"}
          </span>
        </div>
      </Card>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <h2 className="text-xl font-light text-text-primary">Install extension</h2>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          Install the FocusOS browser extension to support real-time distraction detection and focus scoring.
        </p>
        <a
          href="https://chromewebstore.google.com/detail/focusos-browser-extension"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex"
        >
          <Button type="button" variant="session" className="rounded-full px-6">
            Install from Chrome Web Store
            <ExternalLink className="ml-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </Button>
        </a>
      </Card>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-light text-text-primary">What it needs</h2>
        </div>
        <ul className="space-y-3 text-sm font-light text-text-secondary">
          <li>Read tab context during focus sessions.</li>
          <li>Display distraction warnings when boundaries are crossed.</li>
          <li>Use page metadata to support Deep Work relevance scoring.</li>
          <li>Communicate with FocusOS over HTTPS.</li>
        </ul>
      </Card>
    </div>
  );
}
