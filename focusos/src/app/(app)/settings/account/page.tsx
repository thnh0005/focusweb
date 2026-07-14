"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { userApi } from "@/services/user.api";
import { useAuthStore } from "@/stores/auth.store";
import type { AccountDeletionReceipt, AccountExportJob } from "@/types/user.types";

export default function AccountSettingsPage() {
  const { t } = useTranslation("settings");
  const router = useRouter();
  const [exportJob, setExportJob] = React.useState<AccountExportJob | null>(null);
  const [isRequestingExport, setIsRequestingExport] = React.useState(false);
  const [isRefreshingExport, setIsRefreshingExport] = React.useState(false);
  const [exportMessage, setExportMessage] = React.useState("");
  const [exportError, setExportError] = React.useState("");

  const [password, setPassword] = React.useState("");
  const [confirmText, setConfirmText] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");
  const [deletionReceipt, setDeletionReceipt] = React.useState<AccountDeletionReceipt | null>(null);

  const requestExport = async () => {
    setIsRequestingExport(true);
    setExportError("");
    setExportMessage("");

    try {
      const job = await userApi.requestAccountExport();
      setExportJob(job);
      setExportMessage(accountExportMessage(job, t));
    } catch (error) {
      setExportError(getErrorMessage(error, t("account.errors.exportRequest")));
    } finally {
      setIsRequestingExport(false);
    }
  };

  const refreshExport = async () => {
    if (!exportJob) return;
    setIsRefreshingExport(true);
    setExportError("");

    try {
      const job = await userApi.getAccountExportJob(exportJob.jobId);
      setExportJob(job);
      setExportMessage(accountExportMessage(job, t));
    } catch (error) {
      setExportError(getErrorMessage(error, t("account.errors.exportRefresh")));
    } finally {
      setIsRefreshingExport(false);
    }
  };

  const deleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError("");

    try {
      const receipt = await userApi.deleteAccount(password);
      userApi.saveAccountDeletionReceipt(receipt);
      setDeletionReceipt(receipt);
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        onboardingComplete: false,
        isLoading: false,
      });
      router.replace("/login");
    } catch (error) {
      setDeleteError(getErrorMessage(error, t("account.errors.delete")));
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = password.length > 0 && confirmText === "DELETE" && !isDeleting;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <p className="text-sm text-text-muted">{t("account.eyebrow")}</p>
        <h1 className="mt-2 text-4xl font-light text-text-primary">{t("account.title")}</h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          {t("account.description")}
        </p>
      </header>

      <Card className="rounded-[2rem] p-6 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-xl font-light text-text-primary">{t("account.exportTitle")}</h2>
            </div>
            <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
              {t("account.exportDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="session"
            onClick={requestExport}
            disabled={isRequestingExport}
            className="rounded-full px-6"
          >
            {isRequestingExport ? t("account.requesting") : t("account.requestExport")}
          </Button>
        </div>

        {exportJob && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-text-primary">{t("account.job", { id: exportJob.jobId })}</p>
                <p className="mt-1 text-xs font-mono uppercase tracking-[0.16em] text-text-muted">
                  {exportJob.status} · {exportJob.progress}%
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={refreshExport}
                  disabled={isRefreshingExport}
                  className="rounded-full px-4"
                >
                  <RefreshCw className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  {isRefreshingExport ? t("account.checking") : t("account.checkStatus")}
                </Button>
                {exportJob.downloadReady && exportJob.downloadUrl && (
                  <Button
                    type="button"
                    variant="session"
                    onClick={() =>
                      window.open(
                        resolveDownloadUrl(exportJob.downloadUrl),
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="rounded-full px-4"
                  >
                    {t("account.downloadZip")}
                  </Button>
                )}
              </div>
            </div>
            {exportJob.errorMessage && (
              <p className="mt-3 text-sm text-urgency-coral">{exportJob.errorMessage}</p>
            )}
          </div>
        )}

        {exportMessage && <p className="mt-3 text-sm font-light text-primary">{exportMessage}</p>}
        {exportError && (
          <p role="alert" className="mt-3 text-sm font-light text-urgency-coral">
            {exportError}
          </p>
        )}
      </Card>

      <Card className="rounded-[2rem] border-urgency-coral/25 p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-urgency-coral" aria-hidden="true" />
          <h2 className="text-xl font-light text-text-primary">{t("account.deleteTitle")}</h2>
        </div>
        <p className="mt-3 text-sm font-light leading-relaxed text-text-secondary">
          {t("account.deleteDescription")}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Input
            type="password"
            label={t("account.currentPassword")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isDeleting}
            autoComplete="current-password"
          />
          <Input
            label={t("account.typeDelete")}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            disabled={isDeleting}
          />
        </div>

        {deleteError && (
          <p role="alert" className="mt-3 text-sm font-light text-urgency-coral">
            {deleteError}
          </p>
        )}
        {deletionReceipt && (
          <p className="mt-3 text-sm font-light text-primary">
            {t("account.deletionQueued", { id: deletionReceipt.jobId })}
          </p>
        )}

        <Button
          type="button"
          variant="danger"
          onClick={deleteAccount}
          disabled={!canDelete}
          className="mt-5 rounded-full px-6"
        >
          <Trash2 className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          {isDeleting ? t("account.deleting") : t("account.deleteTitle")}
        </Button>
      </Card>
    </div>
  );
}

function accountExportMessage(job: AccountExportJob, t: (key: string) => string) {
  if (job.status === "pending" || job.status === "processing") {
    return t("account.messages.exportPending");
  }
  if (job.status === "completed" && job.downloadReady) {
    return t("account.messages.exportReady");
  }
  if (job.status === "failed") {
    return "";
  }
  if (job.status === "expired") {
    return t("account.messages.exportExpired");
  }
  return t("account.messages.exportCreated");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function resolveDownloadUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").toString();
}
