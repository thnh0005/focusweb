"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type PreferencesState = {
  defaultDuration: string;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  ambientMusicEnabled: boolean;
  autoResumeSession: boolean;
};

export default function PreferencesSettingsPage() {
  const [preferences, setPreferences] = React.useState<PreferencesState>({
    defaultDuration: "50",
    notificationsEnabled: true,
    soundEnabled: true,
    ambientMusicEnabled: true,
    autoResumeSession: false,
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // TODO: Call API to save preferences
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (key: keyof PreferencesState) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const updateDuration = (value: string) => {
    setPreferences((prev) => ({
      ...prev,
      defaultDuration: value,
    }));
  };

  const ToggleSwitch = ({ checked }: { checked: boolean }) => (
    <div
      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
        checked ? "bg-focus-purple" : "bg-subtle-border"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </div>
  );

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-extralight text-text-primary">
          Preferences
        </h1>
        <p className="text-sm text-text-secondary font-light">
          Customize your FocusOS experience to match your workflow.
        </p>
      </div>

      {/* Session Preferences */}
      <Card className="p-6 space-y-6">
        <h2 className="text-lg font-medium text-text-primary">Session Settings</h2>

        {/* Default Duration */}
        <div>
          <label className="text-sm font-medium text-text-primary">
            Default Session Duration
          </label>
          <p className="text-xs text-text-muted mt-1 mb-3">
            Default time for new focus sessions
          </p>
          <div className="flex gap-3">
            {["25", "50", "90"].map((duration) => (
              <button
                key={duration}
                onClick={() => updateDuration(duration)}
                className={`px-4 py-2 rounded-lg font-light transition-all ${
                  preferences.defaultDuration === duration
                    ? "bg-focus-purple/20 border border-focus-purple/50 text-focus-purple"
                    : "bg-surface-deep border border-subtle-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {duration}m
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Notification Preferences */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium text-text-primary">Notifications</h2>

        {[
          {
            key: "notificationsEnabled" as const,
            title: "Session Alerts",
            description: "Get notified when your session ends or pauses",
          },
          {
            key: "soundEnabled" as const,
            title: "Sound Effects",
            description: "Play audio feedback during sessions and alerts",
          },
        ].map((setting) => (
          <div
            key={setting.key}
            className="flex items-center justify-between py-4 border-b border-subtle-border last:border-0"
          >
            <div>
              <p className="font-medium text-text-primary">{setting.title}</p>
              <p className="text-sm text-text-secondary font-light mt-1">
                {setting.description}
              </p>
            </div>
            <button
              onClick={() => togglePreference(setting.key)}
              className="ml-4 flex-shrink-0 focus:outline-none"
            >
              <ToggleSwitch checked={preferences[setting.key] as boolean} />
            </button>
          </div>
        ))}
      </Card>

      {/* Experience Preferences */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium text-text-primary">Experience</h2>

        {[
          {
            key: "ambientMusicEnabled" as const,
            title: "Ambient Music",
            description: "Play background music during focus sessions",
          },
          {
            key: "autoResumeSession" as const,
            title: "Auto-Resume Sessions",
            description: "Automatically resume paused sessions after 5 minutes",
          },
        ].map((setting) => (
          <div
            key={setting.key}
            className="flex items-center justify-between py-4 border-b border-subtle-border last:border-0"
          >
            <div>
              <p className="font-medium text-text-primary">{setting.title}</p>
              <p className="text-sm text-text-secondary font-light mt-1">
                {setting.description}
              </p>
            </div>
            <button
              onClick={() => togglePreference(setting.key)}
              className="ml-4 flex-shrink-0 focus:outline-none"
            >
              <ToggleSwitch checked={preferences[setting.key] as boolean} />
            </button>
          </div>
        ))}
      </Card>

      {/* Success Message */}
      {saveSuccess && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-300 font-light">
            Preferences saved successfully
          </p>
        </div>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="bg-focus-purple hover:bg-focus-purple/90 text-white disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Preferences"}
      </Button>
    </div>
  );
}
