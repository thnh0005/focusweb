"use client";

import * as React from "react";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function ProfileSettingsPage() {
  const { user, logout } = useAuthStore();
  const [displayName, setDisplayName] = React.useState(user?.displayName || "");
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
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setErrors({ general: "Failed to save profile" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-text-muted">Account</p>
        <h1 className="mt-2 text-4xl font-light text-text-primary">Profile</h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          The identity shown around your focus workspace.
        </p>
      </header>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-6 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.045] text-primary">
            <UserRound className="h-6 w-6 stroke-[1.6]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-light text-text-primary">Account card</h2>
            <p className="text-sm text-text-muted">Email is managed by authentication.</p>
          </div>
        </div>

        <div className="grid gap-6">
          <div>
            <label className="text-sm font-medium text-text-primary">Email address</label>
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm font-light text-text-secondary">
              {user?.email || "Not available"}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              Contact support if you need to change this email.
            </p>
          </div>

          <div>
            <label htmlFor="displayName" className="text-sm font-medium text-text-primary">
              Display name
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                if (errors.displayName) {
                  setErrors({ ...errors, displayName: "" });
                }
              }}
              placeholder="Enter your display name"
              className={`mt-2 rounded-2xl bg-white/[0.04] ${errors.displayName ? "border-urgency-coral/50" : ""}`}
            />
            {errors.displayName && (
              <p className="mt-1.5 text-xs font-light text-urgency-coral">{errors.displayName}</p>
            )}
          </div>
        </div>

        {errors.general && (
          <div className="mt-5 rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3">
            <p className="text-sm font-light text-urgency-coral">{errors.general}</p>
          </div>
        )}

        {saveSuccess && (
          <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/10 p-3">
            <p className="text-sm font-light text-primary">Profile updated successfully</p>
          </div>
        )}

        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || displayName === user?.displayName}
          variant="session"
          className="mt-6 rounded-full px-6 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving" : "Save changes"}
        </Button>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-light text-text-primary">Account status</h2>
          </div>
          <div className="mt-5 space-y-3 text-sm text-text-secondary">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span>Member since</span>
              <span className="font-medium text-text-primary">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Not available"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="font-medium text-primary">Active</span>
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl border-urgency-coral/20 bg-urgency-coral/5 p-6">
          <div className="flex items-center gap-3">
            <LogOut className="h-5 w-5 text-urgency-coral" aria-hidden="true" />
            <h2 className="text-lg font-light text-text-primary">Sign out</h2>
          </div>
          <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
            Logging out closes this browser session.
          </p>
          <Button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
            variant="danger"
            className="mt-5 w-full rounded-full"
          >
            Logout
          </Button>
        </Card>
      </div>
    </div>
  );
}
