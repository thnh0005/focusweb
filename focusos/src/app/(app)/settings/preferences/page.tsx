"use client";

import * as React from "react";
import { Music2, Timer, Volume2 } from "lucide-react";
import { userApi } from "@/services/user.api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {
      setIsLoading(true);
      setError("");
      try {
        const currentPreferences = await userApi.getPreferences();
        if (!isMounted) return;
        setPreferences({
          defaultDuration: String(currentPreferences.defaultDurationMinutes),
          notificationsEnabled: currentPreferences.notificationsEnabled,
          soundEnabled: currentPreferences.soundEnabled,
          ambientMusicEnabled: currentPreferences.musicEnabled,
          autoResumeSession: currentPreferences.autoResumeSession,
        });
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, "Failed to load preferences"));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError("");

    try {
      await userApi.updatePreferences({
        defaultDurationMinutes: Number(preferences.defaultDuration),
        notificationsEnabled: preferences.notificationsEnabled,
        soundEnabled: preferences.soundEnabled,
        musicEnabled: preferences.ambientMusicEnabled,
        autoResumeSession: preferences.autoResumeSession,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save preferences"));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (key: keyof PreferencesState) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateDuration = (value: string) => {
    setPreferences((prev) => ({ ...prev, defaultDuration: value }));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-text-muted">Preferences</p>
        <h1 className="mt-2 text-4xl font-light text-text-primary">Focus defaults</h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          Tune the defaults that shape new sessions and ambient feedback.
        </p>
      </header>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <Timer className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-light text-text-primary">Session defaults</h2>
        </div>
        <p className="text-sm text-text-muted">Default time for new focus sessions</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {["25", "50", "90"].map((duration) => (
            <button
              key={duration}
              type="button"
              onClick={() => updateDuration(duration)}
              disabled={isLoading || isSaving}
              className={`rounded-2xl border p-4 text-left transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                preferences.defaultDuration === duration
                  ? "border-primary/45 bg-primary/[0.12] text-text-primary"
                  : "border-white/10 bg-white/[0.035] text-text-secondary hover:bg-white/[0.06]"
              }`}
              aria-pressed={preferences.defaultDuration === duration}
            >
              <span className="block text-2xl font-light">{duration}m</span>
              <span className="mt-1 block text-xs text-text-muted">
                {duration === "25" ? "Reset" : duration === "50" ? "Default" : "Deep block"}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-2 flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-light text-text-primary">Session feedback</h2>
        </div>
        <SettingRow
          label="Session alerts"
          description="Notify when a session ends or pauses."
          checked={preferences.notificationsEnabled}
          onToggle={() => togglePreference("notificationsEnabled")}
          disabled={isLoading || isSaving}
        />
        <SettingRow
          label="Sound effects"
          description="Play audio feedback during sessions and alerts."
          checked={preferences.soundEnabled}
          onToggle={() => togglePreference("soundEnabled")}
          disabled={isLoading || isSaving}
        />
      </Card>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-2 flex items-center gap-3">
          <Music2 className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-light text-text-primary">Room behavior</h2>
        </div>
        <SettingRow
          label="Ambient music"
          description="Play background music during focus sessions."
          checked={preferences.ambientMusicEnabled}
          onToggle={() => togglePreference("ambientMusicEnabled")}
          disabled={isLoading || isSaving}
        />
        <SettingRow
          label="Auto-resume sessions"
          description="Automatically resume paused sessions after 5 minutes."
          checked={preferences.autoResumeSession}
          onToggle={() => togglePreference("autoResumeSession")}
          disabled={isLoading || isSaving}
        />
      </Card>

      {error && (
        <div role="alert" className="rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3">
          <p className="text-sm font-light text-urgency-coral">{error}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3">
          <p className="text-sm font-light text-primary">Preferences saved successfully</p>
        </div>
      )}

      <Button type="button" onClick={handleSave} disabled={isLoading || isSaving} variant="session" className="rounded-full px-6">
        {isLoading ? "Loading" : isSaving ? "Saving" : "Save preferences"}
      </Button>
    </div>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onToggle,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-4 last:border-0">
      <div>
        <p className="font-medium text-text-primary">{label}</p>
        <p className="mt-1 text-sm font-light text-text-secondary">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? "border-primary/30 bg-primary/70" : "border-white/10 bg-white/[0.055]"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
