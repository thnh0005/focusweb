"use client";

import * as React from "react";
import { useExtensionStore } from "@/stores/extension.store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ExtensionSettingsPage() {
  const { connected, version } = useExtensionStore();

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-extralight text-text-primary">
          Browser Extension
        </h1>
        <p className="text-sm text-text-secondary font-light">
          Manage your FocusOS browser extension installation.
        </p>
      </div>

      {/* Extension Status */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-text-primary">Connection Status</h2>
            <p className="text-sm text-text-secondary mt-1">
              {connected ? "Extension connected" : "Extension not detected"}
            </p>
          </div>
          <div
            className={`w-3 h-3 rounded-full ${
              connected ? "bg-green-500" : "bg-red-500"
            }`}
          />
        </div>

        {version && (
          <p className="text-xs text-text-muted">
            Version: {version}
          </p>
        )}
      </Card>

      {/* Installation Guide */}
      <Card className="p-6 space-y-4">
        <h2 className="font-medium text-text-primary">Install Extension</h2>
        <p className="text-sm text-text-secondary font-light">
          To enable real-time distraction detection and behavior tracking, install our browser extension.
        </p>
        <a
          href="https://chromewebstore.google.com/detail/focusos-browser-extension"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button className="w-full bg-focus-purple hover:bg-focus-purple/90 text-white">
            Install from Chrome Web Store
          </Button>
        </a>
      </Card>

      {/* Permissions */}
      <Card className="p-6 space-y-4">
        <h2 className="font-medium text-text-primary">Permissions</h2>
        <p className="text-sm text-text-secondary font-light mb-4">
          The extension requires these permissions to work:
        </p>
        <ul className="space-y-2 text-sm text-text-secondary font-light">
          <li>✓ Read your browsing history during focus sessions</li>
          <li>✓ Display notifications for distraction warnings</li>
          <li>✓ Access page titles and metadata for content analysis</li>
          <li>✓ Communicate with our servers (HTTPS only)</li>
        </ul>
      </Card>
    </div>
  );
}
