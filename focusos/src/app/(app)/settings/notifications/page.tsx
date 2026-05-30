"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // TODO: Call API to save notification preferences
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-extralight text-text-primary">
          Notifications
        </h1>
        <p className="text-sm text-text-secondary font-light">
          Control when and how you receive notifications.
        </p>
      </div>

      {/* Session Notifications */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium text-text-primary">Session</h2>
        {[
          {
            key: "sessionReminders" as const,
            title: "Session Reminders",
            description: "Reminders to start your daily focus session",
          },
          {
            key: "distractionWarnings" as const,
            title: "Distraction Warnings",
            description: "Alerts when you start browsing distracting sites",
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
              onClick={() => toggleNotification(setting.key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                notifications[setting.key]
                  ? "bg-focus-purple"
                  : "bg-surface-deep border border-subtle-border"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications[setting.key] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </Card>

      {/* Analytics & Reports */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium text-text-primary">Analytics</h2>
        {[
          {
            key: "dailyDigest" as const,
            title: "Daily Digest",
            description: "Summary of your daily focus statistics",
          },
          {
            key: "weeklyReport" as const,
            title: "Weekly Report",
            description: "In-depth analysis of your weekly focus patterns",
          },
          {
            key: "achievements" as const,
            title: "Achievements",
            description: "Notifications when you unlock new milestones",
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
              onClick={() => toggleNotification(setting.key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                notifications[setting.key]
                  ? "bg-focus-purple"
                  : "bg-surface-deep border border-subtle-border"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications[setting.key] ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </Card>

      {/* Marketing */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium text-text-primary">Communication</h2>
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="font-medium text-text-primary">Product Updates</p>
            <p className="text-sm text-text-secondary font-light mt-1">
              Emails about new features and improvements
            </p>
          </div>
          <button
            onClick={() => toggleNotification("productUpdates")}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
              notifications.productUpdates
                ? "bg-focus-purple"
                : "bg-surface-deep border border-subtle-border"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notifications.productUpdates ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </Card>

      {/* Success Message */}
      {saveSuccess && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-300 font-light">
            Notification settings saved successfully
          </p>
        </div>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="bg-focus-purple hover:bg-focus-purple/90 text-white disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Notifications"}
      </Button>
    </div>
  );
}
