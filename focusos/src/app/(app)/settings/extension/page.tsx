"use client";

import * as React from "react";
import { ExternalLink, Puzzle, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useExtensionStore } from "@/stores/extension.store";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function ExtensionSettingsPage() {
  const { t } = useTranslation("settings");
  const { connected, version } = useExtensionStore();

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-text-muted">{t("extensionPage.eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-light text-text-primary">{t("extensionPage.title")}</h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          {t("extensionPage.description")}
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
                {connected ? t("extensionPage.connected") : t("extensionPage.notDetected")}
              </h2>
              <p className="mt-2 text-sm font-light text-text-secondary">
                {connected
                  ? t("extensionPage.connectedDescription")
                  : t("extensionPage.notDetectedDescription")}
              </p>
              {version && <p className="mt-2 text-xs font-mono text-text-muted">{t("extensionPage.version", { version })}</p>}
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs ${
            connected ? "border-primary/25 bg-primary/10 text-primary" : "border-urgency-amber/25 bg-urgency-amber/10 text-urgency-amber"
          }`}>
            {connected ? t("extensionPage.ready") : t("extensionPage.needsSetup")}
          </span>
        </div>
      </Card>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <h2 className="text-xl font-light text-text-primary">{t("extensionPage.installTitle")}</h2>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          {t("extensionPage.installDescription")}
        </p>
        <a
          href="https://chromewebstore.google.com/detail/focusos-browser-extension"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex"
        >
          <Button type="button" variant="session" className="rounded-full px-6">
            {t("extensionPage.install")}
            <ExternalLink className="ml-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </Button>
        </a>
      </Card>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-light text-text-primary">{t("extensionPage.needsTitle")}</h2>
        </div>
        <ul className="space-y-3 text-sm font-light text-text-secondary">
          <li>{t("extensionPage.needs.tabs")}</li>
          <li>{t("extensionPage.needs.warnings")}</li>
          <li>{t("extensionPage.needs.metadata")}</li>
          <li>{t("extensionPage.needs.https")}</li>
        </ul>
      </Card>
    </div>
  );
}
