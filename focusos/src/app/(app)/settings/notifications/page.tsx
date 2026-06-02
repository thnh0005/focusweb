"use client";

import * as React from "react";
import { Bell, Mail, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type NotificationSettings = {
  sessionReminders: boolean;
  distractionWarnings: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  achievements: boolean;
  productUpdates: boolean;
};

export default function NotificationsSettingsPage() {
  const [notifications, setNotifications] = React.useState<NotificationSettings>({
    sessionReminders: true,
    distractionWarnings: true,
    dailyDigest: true,
    weeklyReport: true,
    achievements: true,
    productUpdates: false,
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
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
        <SettingRow label="Session reminders" description="Reminders to start your daily focus session." checked={notifications.sessionReminders} onToggle={() => toggleNotification("sessionReminders")} />
        <SettingRow label="Distraction warnings" description="Alerts when you start browsing distracting sites." checked={notifications.distractionWarnings} onToggle={() => toggleNotification("distractionWarnings")} />
      </NotificationPanel>

      <NotificationPanel icon={Bell} title="Reflection">
        <SettingRow label="Daily digest" description="Summary of your daily focus statistics." checked={notifications.dailyDigest} onToggle={() => toggleNotification("dailyDigest")} />
        <SettingRow label="Weekly report" description="Analysis of your weekly focus patterns." checked={notifications.weeklyReport} onToggle={() => toggleNotification("weeklyReport")} />
        <SettingRow label="Achievements" description="Notifications when you unlock milestones." checked={notifications.achievements} onToggle={() => toggleNotification("achievements")} />
      </NotificationPanel>

      <NotificationPanel icon={Mail} title="Communication">
        <SettingRow label="Product updates" description="Emails about new features and improvements." checked={notifications.productUpdates} onToggle={() => toggleNotification("productUpdates")} />
      </NotificationPanel>

      {saveSuccess && (
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3">
          <p className="text-sm font-light text-primary">Notification settings saved successfully</p>
        </div>
      )}

      <Button type="button" onClick={handleSave} disabled={isSaving} variant="session" className="rounded-full px-6">
        {isSaving ? "Saving" : "Save notifications"}
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
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
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
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? "border-primary/30 bg-primary/70" : "border-white/10 bg-white/[0.055]"
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
