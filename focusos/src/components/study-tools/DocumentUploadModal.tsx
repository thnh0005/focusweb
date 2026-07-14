"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileUp, GripHorizontal, Loader2, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { documentsApi } from "@/services/documents.api";
import { useDraggablePopup } from "@/hooks";
import { cn } from "@/lib/utils/cn";
import type { StudyDocument } from "@/types/document.types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const POLL_INTERVAL_MS = 5000;
const POLL_ERROR_INTERVAL_MS = 15000;
const EXTRACTION_WAITING_NOTICE_MS = 30000;

export interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateSummary: (document: StudyDocument) => void;
  onGenerateFlashcards: (document: StudyDocument) => void;
}

export function DocumentUploadModal({
  isOpen,
  onClose,
  onGenerateSummary,
  onGenerateFlashcards,
}: DocumentUploadModalProps) {
  const { t } = useTranslation("documents");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadedDocument, setUploadedDocument] = React.useState<StudyDocument | null>(null);
  const [localError, setLocalError] = React.useState("");
  const [isDragging, setIsDragging] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const {
    popupRef,
    dragHandleProps,
    dragStyle,
    isDragging: isMovingPopup,
  } = useDraggablePopup<HTMLElement>();

  const resetState = React.useCallback(() => {
    setSelectedFile(null);
    setUploadedDocument(null);
    setLocalError("");
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const uploadMutation = useMutation({
    retry: false,
    mutationFn: (file: File) => documentsApi.uploadDocument(file),
    onMutate: () => {
      setLocalError("");
    },
    onSuccess: (document) => {
      setUploadedDocument(document);
      queryClient.setQueryData<StudyDocument[]>(["documents", "recent"], (documents = []) => [
        document,
        ...documents.filter((item) => item.id !== document.id),
      ]);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => {
      setLocalError(getErrorMessage(error, "Could not upload this document."));
    },
  });

  const uploadedDocumentQuery = useQuery({
    queryKey: ["document", uploadedDocument?.id],
    queryFn: () => documentsApi.getDocument(uploadedDocument!.id),
    enabled: Boolean(uploadedDocument?.id),
    retry: false,
    refetchInterval: (query) => {
      const document = query.state.data;
      if (!document) return false;
      return document.status === "uploaded" || document.status === "processing"
        ? query.state.error
          ? POLL_ERROR_INTERVAL_MS
          : POLL_INTERVAL_MS
        : false;
    },
  });

  const handleClose = React.useCallback(() => {
    if (uploadMutation.isPending) return;
    resetState();
    onClose();
  }, [onClose, resetState, uploadMutation.isPending]);

  const handleGenerateSummary = React.useCallback(
    (document: StudyDocument) => {
      if (document.status !== "ready") {
        setLocalError(t("generation.documentNotReady", {
          status: t(`status.${document.status}`, { defaultValue: document.status }),
        }));
        return;
      }
      resetState();
      onGenerateSummary(document);
    },
    [onGenerateSummary, resetState, t]
  );

  const handleGenerateFlashcards = React.useCallback(
    (document: StudyDocument) => {
      if (document.status !== "ready") {
        setLocalError(t("generation.documentNotReady", {
          status: t(`status.${document.status}`, { defaultValue: document.status }),
        }));
        return;
      }
      resetState();
      onGenerateFlashcards(document);
    },
    [onGenerateFlashcards, resetState, t]
  );

  const selectFile = React.useCallback((file: File | undefined) => {
    setLocalError("");
    setUploadedDocument(null);
    if (!file) return;

    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setLocalError(t("uploadModal.unsupported"));
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError(t("uploadModal.tooLarge"));
      return;
    }

    setSelectedFile(file);
  }, [t]);

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setIsDragging(false);
      selectFile(event.dataTransfer.files[0]);
    },
    [selectFile]
  );

  const handleUpload = React.useCallback(() => {
    if (!selectedFile || uploadMutation.isPending) return;
    uploadMutation.mutate(selectedFile);
  }, [selectedFile, uploadMutation]);

  const errorText = localError || (uploadMutation.error ? getErrorMessage(uploadMutation.error, t("uploadModal.failed")) : "");
  const effectiveUploadedDocument = uploadedDocumentQuery.data ?? uploadedDocument;
  const isExtractionReady = effectiveUploadedDocument?.status === "ready";
  React.useEffect(() => {
    if (
      effectiveUploadedDocument?.status !== "uploaded" &&
      effectiveUploadedDocument?.status !== "processing"
    ) {
      return;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [effectiveUploadedDocument?.status]);
  const uploadedAtMs = effectiveUploadedDocument?.uploadedAt
    ? new Date(effectiveUploadedDocument.uploadedAt).getTime()
    : 0;
  const showExtractionWaiting =
    Boolean(effectiveUploadedDocument) &&
    !isExtractionReady &&
    effectiveUploadedDocument?.status !== "error" &&
    uploadedAtMs > 0 &&
    nowMs - uploadedAtMs > EXTRACTION_WAITING_NOTICE_MS;

  if (!isOpen) return null;

  return (
    <div
      data-dashboard-floating-layer
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 backdrop-blur-md sm:items-center"
    >
      <section
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-upload-title"
        className={cn(
          "w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[rgb(10_13_10/0.9)] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]",
          isMovingPopup && "cursor-grabbing"
        )}
        style={dragStyle}
      >
        <header className="flex items-start justify-between gap-4">
          <div
            {...dragHandleProps}
            className="flex min-w-0 flex-1 touch-none cursor-grab items-start gap-3 active:cursor-grabbing"
            title={t("uploadModal.drag")}
          >
            <GripHorizontal
              className="mt-1 h-4 w-4 shrink-0 text-text-muted"
              aria-hidden="true"
            />
            <div className="min-w-0">
            <p id="document-upload-title" className="text-lg font-light text-text-primary">
              {t("uploadModal.title")}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {t("uploadModal.description")}
            </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={uploadMutation.isPending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-label={t("actions.closeUpload")}
          >
            <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </button>
        </header>

        {effectiveUploadedDocument ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
              <p className="text-sm font-medium text-primary">
                {isExtractionReady
                  ? t("uploadModal.complete")
                  : t(`status.${effectiveUploadedDocument.status}`, {
                      defaultValue: effectiveUploadedDocument.status,
                    })}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                {effectiveUploadedDocument.originalName}
              </p>
              {showExtractionWaiting && (
                <p className="mt-2 text-xs leading-5 text-text-muted">
                  {t("uploadModal.extractionWaiting", {
                    defaultValue: "The worker is still preparing this document. Recovery will retry automatically.",
                  })}
                </p>
              )}
            </div>
            {errorText && (
              <div
                role="alert"
                className="flex gap-2 rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3 text-sm text-urgency-coral"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errorText}</span>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant="session"
                className="rounded-full"
                onClick={() => handleGenerateSummary(effectiveUploadedDocument)}
              >
                {t("summary")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => handleGenerateFlashcards(effectiveUploadedDocument)}
              >
                {t("flashcards")}
              </Button>
              <Button type="button" variant="ghost" className="rounded-full" onClick={handleClose}>
                {t("actions.later")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              disabled={uploadMutation.isPending}
              className={cn(
                "flex min-h-44 w-full flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-8 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70",
                isDragging
                  ? "border-primary/60 bg-primary/10"
                  : "border-white/15 bg-white/[0.04] hover:border-primary/40 hover:bg-white/[0.07]"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="sr-only"
                disabled={uploadMutation.isPending}
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <FileUp className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
              </span>
              <span className="mt-4 text-sm font-medium text-text-primary">
                {selectedFile ? selectedFile.name : t("uploadModal.dropBrowse")}
              </span>
              <span className="mt-1 text-xs text-text-muted">
                {t("uploadModal.supported")}
              </span>
            </button>

            {uploadMutation.isPending && (
              <div className="overflow-hidden rounded-full bg-white/[0.08]" aria-label={t("uploadModal.progress")}>
                <div className="h-1.5 w-2/3 animate-pulse rounded-full bg-primary" />
              </div>
            )}

            {errorText && (
              <div
                role="alert"
                className="flex gap-2 rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3 text-sm text-urgency-coral"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errorText}</span>
              </div>
            )}

            <Button
              type="button"
              variant="session"
              disabled={!selectedFile || uploadMutation.isPending}
              onClick={handleUpload}
              className="h-12 w-full rounded-full"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("actions.uploading")}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  {t("actions.uploadDocument")}
                </>
              )}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  return error instanceof Error && error.message ? error.message : fallback;
}
