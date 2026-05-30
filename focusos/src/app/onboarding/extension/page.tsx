"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function OnboardingExtensionPage() {
  const router = useRouter();

  const handleContinue = () => {
    router.push("/dashboard");
  };

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="space-y-2">
        <p className="text-xs text-text-muted font-light">Step 3 of 3</p>
        <div className="h-1 bg-surface-deep rounded-full overflow-hidden">
          <div className="h-full w-full bg-focus-purple transition-all duration-300" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extralight text-text-primary mb-2">
            Install our browser extension
          </h1>
          <p className="text-sm text-text-secondary font-light">
            To track your focus sessions and provide real-time distraction detection, we need a lightweight browser extension.
          </p>
        </div>

        {/* Extension Info */}
        <div className="p-4 rounded-lg bg-surface-deep border border-subtle-border space-y-3">
          <p className="text-sm font-medium text-text-primary">What it does:</p>
          <ul className="text-sm text-text-secondary font-light space-y-2">
            <li>✓ Tracks which websites you visit during focus sessions</li>
            <li>✓ Analyzes content relevance to your session goal</li>
            <li>✓ Sends real-time warnings for distracted browsing</li>
            <li>✓ Never stores sensitive data or passwords</li>
          </ul>
        </div>

        {/* CTA */}
        <a
          href="https://chromewebstore.google.com/detail/focusos-browser-extension"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button
            className="w-full bg-focus-purple hover:bg-focus-purple/90 text-white"
          >
            Install from Chrome Web Store
          </Button>
        </a>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          className="flex-1 border-subtle-border"
          onClick={handleContinue}
        >
          Skip for Now
        </Button>
        <Button
          onClick={handleContinue}
          className="flex-1 bg-focus-purple hover:bg-focus-purple/90 text-white"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
