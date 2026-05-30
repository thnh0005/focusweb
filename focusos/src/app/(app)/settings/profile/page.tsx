"use client";

import * as React from "react";
import { useAuthStore } from "@/stores/auth.store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ProfileSettingsPage() {
  const { user, logout } = useAuthStore();
  const [displayName, setDisplayName] = React.useState(
    user?.displayName || ""
  );
  const [email, setEmail] = React.useState(user?.email || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!displayName.trim()) {
      newErrors.displayName = "Display name is required";
    } else if (displayName.length < 2) {
      newErrors.displayName = "Display name must be at least 2 characters";
    } else if (displayName.length > 50) {
      newErrors.displayName = "Display name must be less than 50 characters";
    }

    return newErrors;
  };

  const handleSave = async () => {
    const newErrors = validateForm();
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // TODO: Call API to update profile
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setErrors({ general: "Failed to save profile" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-extralight text-text-primary">Profile</h1>
        <p className="text-sm text-text-secondary font-light">
          Manage your account information.
        </p>
      </div>

      {/* Account Info Card */}
      <Card className="p-6 space-y-6">
        <div className="grid gap-6">
          {/* Email (Read-only) */}
          <div>
            <label className="text-sm font-medium text-text-primary">
              Email Address
            </label>
            <div className="mt-2 p-3 bg-surface-deep rounded-lg text-text-secondary text-sm font-light">
              {user?.email || "—"}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Email cannot be changed. Contact support if you need to update it.
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="displayName" className="text-sm font-medium text-text-primary">
              Display Name
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (errors.displayName) {
                  setErrors({ ...errors, displayName: "" });
                }
              }}
              placeholder="Enter your display name"
              className={`mt-2 bg-surface-deep border-subtle-border ${
                errors.displayName ? "border-red-500/50" : ""
              }`}
            />
            {errors.displayName && (
              <p className="mt-1.5 text-xs text-red-400 font-light">
                {errors.displayName}
              </p>
            )}
          </div>
        </div>

        {/* General Error */}
        {errors.general && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-300 font-light">{errors.general}</p>
          </div>
        )}

        {/* Success Message */}
        {saveSuccess && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-300 font-light">
              Profile updated successfully
            </p>
          </div>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving || displayName === user?.displayName}
          className="bg-focus-purple hover:bg-focus-purple/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </Card>

      {/* Account Settings Card */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium text-text-primary">Account Settings</h2>
        <div className="space-y-3 text-sm text-text-secondary font-light">
          <div className="flex justify-between items-center py-3 border-b border-subtle-border">
            <span>Member Since</span>
            <span className="text-text-primary font-medium">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span>Account Status</span>
            <span className="text-green-400 font-medium">Active</span>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-red-500/20 space-y-4 bg-red-500/5">
        <h2 className="text-lg font-medium text-red-300">Danger Zone</h2>
        <p className="text-sm text-text-secondary font-light">
          Logging out will end your current session across all devices.
        </p>
        <Button
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
          className="w-full bg-red-600 hover:bg-red-700 text-white"
        >
          Logout
        </Button>
      </Card>
    </div>
  );
}
