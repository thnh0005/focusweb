"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Bell, X } from "lucide-react";
import { useExtensionBridge } from "@/hooks/useExtensionBridge";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import {
  handleFlashcardsGenerationStatus,
  handleSummaryGenerationStatus,
} from "@/lib/documents/generationNotifications";
import { useNotificationStore } from "@/stores/notification.store";
import { useDocumentGenerationStore } from "@/stores/document-generation.store";
import { documentsApi } from "@/services/documents.api";
import { NotificationCenter } from "@/components/navigation";
import { cn } from "@/lib/utils/cn";

const DOCUMENT_JOB_POLL_INTERVAL_MS = 5000;

function isImmersiveAppRoute(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/session") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/study-tools")
  );
}

function ToastViewport() {
  const toasts = useNotificationStore((state) => state.toasts);
  const removeToast = useNotificationStore((state) => state.removeToast);

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      className="fixed right-4 top-16 z-[80] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <section
          key={toast.id}
          role={toast.type === "error" || toast.type === "warning" ? "alert" : "status"}
          className={cn(
            "rounded-2xl border bg-[rgb(10_13_10/0.88)] p-3 shadow-[0_18px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl",
            toast.type === "warning" && "border-urgency-amber/35",
            toast.type === "error" && "border-urgency-coral/35",
            toast.type === "success" && "border-primary/30",
            toast.type === "info" && "border-white/10"
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1 h-2 w-2 shrink-0 rounded-full",
                toast.type === "warning" && "bg-urgency-amber",
                toast.type === "error" && "bg-urgency-coral",
                toast.type === "success" && "bg-primary",
                toast.type === "info" && "bg-text-muted"
              )}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">{toast.title}</p>
              {toast.message && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5 stroke-[1.6]" aria-hidden="true" />
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

function ImmersiveNotificationLayer() {
  const pathname = usePathname();
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllRead = useNotificationStore((state) => state.markAllNotificationsRead);
  const markRead = useNotificationStore((state) => state.markNotificationRead);
  const dismissNotification = useNotificationStore((state) => state.dismissNotification);
  const [isOpen, setIsOpen] = React.useState(false);

  if (!isImmersiveAppRoute(pathname)) return null;

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="fixed right-16 top-4 z-[70]">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/15 text-text-secondary backdrop-blur-xl transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={unreadCount ? `${unreadCount} thông báo chưa đọc` : "Thông báo"}
      >
        <Bell className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-urgency-amber"
            aria-hidden="true"
          />
        )}
      </button>
      <NotificationCenter
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        notifications={notifications}
        onMarkAllRead={markAllRead}
        onMarkRead={markRead}
        onDismiss={dismissNotification}
      />
    </div>
  );
}

function DocumentGenerationMonitor() {
  const jobs = useDocumentGenerationStore((state) => state.jobs);
  const removeJob = useDocumentGenerationStore((state) => state.removeJob);
  const jobsRef = React.useRef(jobs);

  React.useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  React.useEffect(() => {
    if (!jobs.length) return;
    let cancelled = false;

    async function pollJobs() {
      const currentJobs = jobsRef.current;
      await Promise.allSettled(
        currentJobs.map(async (job) => {
          try {
            if (job.kind === "summary") {
              const summary = await documentsApi.getDocumentSummary(
                job.documentId,
                job.mode ?? "detailed"
              );
              if (!cancelled) {
                handleSummaryGenerationStatus(
                  summary,
                  {
                    id: job.documentId,
                    originalName: job.documentName,
                    filename: job.documentName,
                  },
                  job.mode ?? "detailed"
                );
              }
              return;
            }

            const deck = await documentsApi.getFlashcardDeck(job.documentId);
            if (!cancelled) {
              handleFlashcardsGenerationStatus(deck, {
                id: job.documentId,
                originalName: job.documentName,
                filename: job.documentName,
              });
            }
          } catch {
            if (Date.now() - job.createdAt > 10 * 60 * 1000) {
              removeJob(job.id);
            }
          }
        })
      );
    }

    void pollJobs();
    const intervalId = window.setInterval(() => {
      void pollJobs();
    }, DOCUMENT_JOB_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [jobs.length, removeJob]);

  return null;
}

export function ExtensionBridgeProvider({ children }: { children: React.ReactNode }) {
  useExtensionBridge();
  useHeartbeat();

  return (
    <>
      {children}
      <DocumentGenerationMonitor />
      <ImmersiveNotificationLayer />
      <ToastViewport />
    </>
  );
}
