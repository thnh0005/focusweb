"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ThemeSettingsPage() {
  const [theme, setTheme] = React.useState("dark");
  const [accentColor, setAccentColor] = React.useState("purple");
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // TODO: Call API to save theme preferences
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const THEME_OPTIONS = [
    { id: "dark", label: "Dark Mode", description: "Easy on the eyes with dark backgrounds" },
    { id: "light", label: "Light Mode", description: "Bright and minimalist design" },
    { id: "auto", label: "System", description: "Follows your device settings" },
  ];

  const ACCENT_COLORS = [
    { id: "purple", name: "Purple", bg: "bg-focus-purple" },
    { id: "blue", name: "Blue", bg: "bg-blue-500" },
    { id: "emerald", name: "Emerald", bg: "bg-emerald-500" },
    { id: "cyan", name: "Cyan", bg: "bg-cyan-500" },
    { id: "rose", name: "Rose", bg: "bg-rose-500" },
    { id: "amber", name: "Amber", bg: "bg-amber-500" },
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-extralight text-text-primary">Theme</h1>
        <p className="text-sm text-text-secondary font-light">
          Customize the appearance of FocusOS to your liking.
        </p>
      </div>

      {/* Theme Selection */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium text-text-primary">Color Scheme</h2>
        <div className="space-y-3">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`w-full p-4 rounded-lg text-left transition-all border ${
                theme === t.id
                  ? "border-focus-purple/50 bg-focus-purple/10"
                  : "border-subtle-border hover:border-text-muted/30"
              }`}
            >
              <p className="font-medium text-text-primary">{t.label}</p>
              <p className="text-sm text-text-secondary font-light mt-1">
                {t.description}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* Accent Color */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium text-text-primary">Accent Color</h2>
        <p className="text-sm text-text-secondary font-light mb-4">
          Choose your preferred accent color used throughout the interface.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {ACCENT_COLORS.map((accent) => (
            <button
              key={accent.id}
              onClick={() => setAccentColor(accent.id)}
              className={`group relative p-4 rounded-lg border-2 transition-all ${
                accentColor === accent.id
                  ? "border-text-primary bg-surface-deep"
                  : "border-transparent hover:border-subtle-border"
              }`}
            >
              <div
                className={`h-8 w-full rounded-md ${accent.bg} transition-transform group-hover:scale-105`}
              />
              <p className="text-xs text-text-secondary font-light mt-2 text-center">
                {accent.name}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* Display Preferences */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium text-text-primary">Display</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-3 border-b border-subtle-border">
            <span className="text-text-secondary">Reduce Motion</span>
            <span className="inline-flex h-6 w-10 items-center rounded-full bg-subtle-border">
              <span className="inline-block h-5 w-5 transform rounded-full bg-white translate-x-0.5" />
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-text-secondary">Compact Mode</span>
            <span className="inline-flex h-6 w-10 items-center rounded-full bg-subtle-border">
              <span className="inline-block h-5 w-5 transform rounded-full bg-white translate-x-0.5" />
            </span>
          </div>
        </div>
      </Card>

      {/* Success Message */}
      {saveSuccess && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-300 font-light">
            Theme settings saved successfully
          </p>
        </div>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="bg-focus-purple hover:bg-focus-purple/90 text-white disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Theme"}
      </Button>
    </div>
  );
}
