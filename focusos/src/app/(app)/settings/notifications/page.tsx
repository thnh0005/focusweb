"use client";

import * as React from "react";
import { Bell, Mail, Timer } from "lucide-react";
import { userApi } from "@/services/user.api";
import { notificationsApi } from "@/services/notifications.api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type NotificationSettingsState = {
  notificationsEnabled: boolean;
  sessionReminders: boolean;
  weeklyReport: boolean;
  deepWorkSuggestions: boolean;
};

export default function NotificationsSettingsPage() {
  const [notifications, setNotifications] = React.useState<NotificationSettingsState>({
    notificationsEnabled: true,
    sessionReminders: true,
    weeklyReport: true,
    deepWorkSuggestions: true,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [testMessage, setTestMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let isMounted = true;

    async function loadNotificationSettings() {
      setIsLoading(true);
      setError("");
      try {
        const currentSettings = await userApi.getNotificationSettings();
        if (!isMounted) return;
        setNotifications({
          notificationsEnabled: currentSettings.notificationsEnabled,
          sessionReminders: currentSettings.sessionReminderEnabled,
          weeklyReport: currentSettings.weeklySummaryEnabled,
          deepWorkSuggestions: currentSettings.deepWorkSuggestionEnabled,
        });
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, "Failed to load notification settings"));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadNotificationSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleNotification = (key: keyof NotificationSettingsState) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError("");

    try {
      await userApi.updateNotificationSettings({
        notificationsEnabled: notifications.notificationsEnabled,
        sessionReminderEnabled: notifications.sessionReminders,
        weeklySummaryEnabled: notifications.weeklyReport,
        deepWorkSuggestionEnabled: notifications.deepWorkSuggestions,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save notification settings"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    setTestMessage("");
    setError("");

    try {
      const response = await notificationsApi.createTestNotification("generic");
      setTestMessage(`Test notification created: ${response.notification.title}`);
    } catch (testError) {
      setError(getErrorMessage(testError, "Failed to create test notification"));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-text-muted">Notifications</p>
        <h1 className="mt-2 text-4xl font-light text-text-primary">Calm reminders</h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          Choose which cues should interrupt you and which can wait.
        </p>
      </header>

      <NotificationPanel icon={Timer} title="Session">
        <SettingRow label="Notifications" description="Allow FocusOS notification cues." checked={notifications.notificationsEnabled} onToggle={() => toggleNotification("notificationsEnabled")} disabled={isLoading || isSaving} />
        <SettingRow label="Session reminders" description="Reminders to start your daily focus session." checked={notifications.sessionReminders} onToggle={() => toggleNotification("sessionReminders")} disabled={isLoading || isSaving} />
        <SettingRow label="Distraction warnings" description="Managed by extension focus boundaries." checked={false} onToggle={() => undefined} disabled />
      </NotificationPanel>

      <NotificationPanel icon={Bell} title="Reflection">
        <SettingRow label="Weekly report" description="Analysis of your weekly focus patterns." checked={notifications.weeklyReport} onToggle={() => toggleNotification("weeklyReport")} disabled={isLoading || isSaving} />
        <SettingRow label="Deep work suggestions" description="Ideas for when to schedule deeper work." checked={notifications.deepWorkSuggestions} onToggle={() => toggleNotification("deepWorkSuggestions")} disabled={isLoading || isSaving} />
        <SettingRow label="Daily digest" description="No backend endpoint yet." checked={false} onToggle={() => undefined} disabled />
        <SettingRow label="Achievements" description="No backend endpoint yet." checked={false} onToggle={() => undefined} disabled />
      </NotificationPanel>

      <NotificationPanel icon={Mail} title="Communication">
        <SettingRow label="Product updates" description="No backend endpoint yet." checked={false} onToggle={() => undefined} disabled />
      </NotificationPanel>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <h2 className="text-xl font-light text-text-primary">Notification center</h2>
        <p className="mt-2 text-sm font-light leading-relaxed text-text-secondary">
          Backend currently supports notification settings and test notification creation, but does not expose a notification list or mark-as-read endpoint yet.
        </p>
        <Button
          type="button"
          onClick={handleTestNotification}
          disabled={isTesting}
          variant="outline"
          className="mt-5 rounded-full px-6"
        >
          {isTesting ? "Creating test" : "Create test notification"}
        </Button>
        {testMessage && (
          <p className="mt-3 text-sm font-light text-primary">{testMessage}</p>
        )}
      </Card>

      {error && (
        <div role="alert" className="rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3">
          <p className="text-sm font-light text-urgency-coral">{error}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3">
          <p className="text-sm font-light text-primary">Notification settings saved successfully</p>
        </div>
      )}

      <Button type="button" onClick={handleSave} disabled={isLoading || isSaving} variant="session" className="rounded-full px-6">
        {isLoading ? "Loading" : isSaving ? "Saving" : "Save notifications"}
      </Button>
    </div>
  );
}

type PanelIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function NotificationPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: PanelIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-[2rem] p-6 sm:p-7">
      <div className="mb-2 flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="text-xl font-light text-text-primary">{title}</h2>
      </div>
      {children}
    </Card>
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
