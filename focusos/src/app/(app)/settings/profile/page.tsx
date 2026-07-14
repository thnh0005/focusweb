"use client";

import * as React from "react";
import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { userApi } from "@/services/user.api";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { formatDateForLanguage } from "@/i18n/format";
import type { UserProfile } from "@/types/user.types";

export default function ProfileSettingsPage() {
  const { t } = useTranslation("settings");
  const tRef = React.useRef(t);
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = React.useState(user?.displayName || "");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    tRef.current = t;
  }, [t]);

  React.useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setErrors({});
      try {
        const currentProfile = await userApi.getProfile();
        if (!isMounted) return;
        setProfile(currentProfile);
        setDisplayName(currentProfile.displayName || "");
      } catch (error) {
        if (!isMounted) return;
        setErrors({ general: getErrorMessage(error, tRef.current("profile.errors.load")) });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!displayName.trim()) {
      newErrors.displayName = t("profile.errors.required");
    } else if (displayName.length < 2) {
      newErrors.displayName = t("profile.errors.min");
    } else if (displayName.length > 50) {
      newErrors.displayName = t("profile.errors.max");
    }

    return newErrors;
  };

  const handleSave = async () => {
    const newErrors = validateForm();
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setErrors({});

    try {
      const updatedProfile = await userApi.updateProfile({
        displayName: displayName.trim(),
      });
      setProfile(updatedProfile);
      setDisplayName(updatedProfile.displayName || "");
      if (user) {
        useAuthStore.setState({
          user: {
            ...user,
            displayName: updatedProfile.displayName,
            avatarUrl: updatedProfile.avatarUrl,
          },
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setErrors({ general: getErrorMessage(error, t("profile.errors.save")) });
    } finally {
      setIsSaving(false);
    }
  };

  const email = profile?.email ?? user?.email;
  const createdAt = profile?.createdAt ?? user?.createdAt;
  const savedDisplayName = profile?.displayName ?? user?.displayName ?? "";

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-text-muted">{t("profile.eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-light text-text-primary">{t("profile.title")}</h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          {t("profile.description")}
        </p>
      </header>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="mb-6 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.045] text-primary">
            <UserRound className="h-6 w-6 stroke-[1.6]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-light text-text-primary">{t("profile.card")}</h2>
            <p className="text-sm text-text-muted">{t("profile.emailManaged")}</p>
          </div>
        </div>

        <div className="grid gap-6">
          <div>
            <label className="text-sm font-medium text-text-primary">{t("profile.emailAddress")}</label>
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm font-light text-text-secondary">
              {isLoading ? t("profile.loading") : email || t("profile.notAvailable")}
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {t("profile.emailHelp")}
            </p>
          </div>

          <div>
            <label htmlFor="displayName" className="text-sm font-medium text-text-primary">
              {t("profile.displayName")}
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
              placeholder={t("profile.displayNamePlaceholder")}
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
            <p className="text-sm font-light text-primary">{t("profile.saved")}</p>
          </div>
        )}

        <Button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving || displayName.trim() === savedDisplayName}
          variant="session"
          className="mt-6 rounded-full px-6 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? t("profile.saving") : t("profile.saveChanges")}
        </Button>
      </Card>

      <LanguageSelector />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-light text-text-primary">{t("profile.accountStatus")}</h2>
          </div>
          <div className="mt-5 space-y-3 text-sm text-text-secondary">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span>{t("profile.memberSince")}</span>
              <span className="font-medium text-text-primary">
                {createdAt ? formatDateForLanguage(createdAt, { dateStyle: "medium" }) : t("profile.notAvailable")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("profile.status")}</span>
              <span className="font-medium text-primary">{t("profile.active")}</span>
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl border-urgency-coral/20 bg-urgency-coral/5 p-6">
          <div className="flex items-center gap-3">
            <LogOut className="h-5 w-5 text-urgency-coral" aria-hidden="true" />
            <h2 className="text-lg font-light text-text-primary">{t("profile.signOut")}</h2>
          </div>
          <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
            {t("profile.signOutDescription")}
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
            {t("profile.logout")}
          </Button>
        </Card>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
