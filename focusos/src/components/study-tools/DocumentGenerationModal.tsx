"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, GripHorizontal, Layers3, Loader2, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { documentsApi } from "@/services/documents.api";
import { useDraggablePopup } from "@/hooks";
import { cn } from "@/lib/utils/cn";
import type {
  DocumentSummary,
  FlashcardDeck,
  FlashcardQuantity,
  StudyDocument,
  SummaryMode,
} from "@/types/document.types";

export type DocumentGenerationAction = "summary" | "flashcards";

interface DocumentGenerationModalProps {
  isOpen: boolean;
  action: DocumentGenerationAction;
  document: StudyDocument | null;
  force?: boolean;
  initialSummaryMode?: SummaryMode;
  initialCardCount?: FlashcardQuantity;
  onClose: () => void;
  onSummaryGenerated?: (summary: DocumentSummary, document: StudyDocument, mode: SummaryMode) => void;
  onFlashcardsGenerated?: (
    deck: FlashcardDeck,
    document: StudyDocument,
    quantity: FlashcardQuantity
  ) => void;
}

const CARD_COUNTS: FlashcardQuantity[] = [5, 10, 15, 20];
const DEFAULT_SUMMARY_MODE: SummaryMode = "key_points";
const DEFAULT_CARD_COUNT: FlashcardQuantity = 10;

export function DocumentGenerationModal({
  isOpen,
  action,
  document,
  force = false,
  initialSummaryMode = DEFAULT_SUMMARY_MODE,
  initialCardCount = DEFAULT_CARD_COUNT,
  onClose,
  onSummaryGenerated,
  onFlashcardsGenerated,
}: DocumentGenerationModalProps) {
  const { t } = useTranslation("documents");
  const [summaryMode, setSummaryMode] = React.useState<SummaryMode>(initialSummaryMode);
  const [cardCount, setCardCount] = React.useState<FlashcardQuantity>(initialCardCount);
  const [error, setError] = React.useState("");
  const { popupRef, dragHandleProps, dragStyle, isDragging } =
    useDraggablePopup<HTMLElement>();

  const resetState = React.useCallback(() => {
    setSummaryMode(initialSummaryMode);
    setCardCount(initialCardCount);
    setError("");
  }, [initialCardCount, initialSummaryMode]);

  const summaryMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!document) throw new Error(t("generation.missingDocument"));
      return documentsApi.generateDocumentSummary({
        documentId: document.id,
        mode: summaryMode,
        force,
      });
    },
    onMutate: () => setError(""),
    onSuccess: (summary) => {
      if (!document) return;
      onSummaryGenerated?.(summary, document, summaryMode);
      resetState();
      onClose();
    },
    onError: (requestError) => {
      setError(getErrorMessage(requestError, t("generation.summaryFailed")));
    },
  });

  const flashcardsMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!document) throw new Error(t("generation.missingDocument"));
      return documentsApi.generateFlashcards({
        documentId: document.id,
        scope: "full_document",
        quantity: cardCount,
        difficulty: "medium",
        force,
      });
    },
    onMutate: () => setError(""),
    onSuccess: (deck) => {
      if (!document) return;
      onFlashcardsGenerated?.(deck, document, cardCount);
      resetState();
      onClose();
    },
    onError: (requestError) => {
      setError(getErrorMessage(requestError, t("generation.flashcardsFailed")));
    },
  });

  const summaryOptions: Array<{ label: string; value: SummaryMode; description: string }> = [
    {
      label: t("generation.short"),
      value: "key_points",
      description: t("generation.shortDescription"),
    },
    {
      label: t("generation.detailed"),
      value: "detailed",
      description: t("generation.detailedDescription"),
    },
  ];

  if (!isOpen || !document) return null;

  const isSummary = action === "summary";
  const isSubmitting = summaryMutation.isPending || flashcardsMutation.isPending;
  const documentReady = document.status === "ready";
  const documentNotReadyMessage = t("generation.documentNotReady", {
    status: t(`status.${document.status}`, { defaultValue: document.status }),
  });
  const handleClose = () => {
    if (isSubmitting) return;
    resetState();
    onClose();
  };

  return (
    <div
      data-dashboard-floating-layer
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 backdrop-blur-md sm:items-center"
    >
      <section
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-generation-title"
        className={cn(
          "w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[rgb(10_13_10/0.9)] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]",
          isDragging && "cursor-grabbing"
        )}
        style={dragStyle}
      >
        <header className="flex items-start justify-between gap-4">
          <div
            {...dragHandleProps}
            className="flex min-w-0 flex-1 touch-none cursor-grab gap-3 active:cursor-grabbing"
            title={t("generation.drag")}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              {isSummary ? (
                <Sparkles className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
              ) : (
                <Layers3 className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p id="document-generation-title" className="text-lg font-light text-text-primary">
                {isSummary ? t("generation.summaryTitle") : t("generation.flashcardsTitle")}
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-text-muted">
                {document.originalName || document.filename}
              </p>
            </div>
            <GripHorizontal
              className="ml-auto mt-1 h-4 w-4 shrink-0 text-text-muted"
              aria-hidden="true"
            />
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-label={t("actions.closeGeneration")}
          >
            <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </button>
        </header>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-xs text-text-muted">{t("generation.configureStep")}</p>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              {isSummary ? t("generation.summaryHelp") : t("generation.flashcardsHelp")}
            </p>
          </div>

          {isSummary ? (
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("generation.summaryType")}>
              {summaryOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={summaryMode === option.value}
                  disabled={isSubmitting}
                  onClick={() => setSummaryMode(option.value)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                    summaryMode === option.value
                      ? "border-primary/40 bg-primary/15 text-text-primary"
                      : "border-white/10 bg-white/[0.04] text-text-secondary hover:bg-white/[0.07]"
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {option.label}
                    {summaryMode === option.value && (
                      <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-text-muted">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("generation.cardCount")}>
              {CARD_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  role="radio"
                  aria-checked={cardCount === count}
                  disabled={isSubmitting}
                  onClick={() => setCardCount(count)}
                  className={cn(
                    "h-14 rounded-2xl border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                    cardCount === count
                      ? "border-primary/40 bg-primary/15 text-text-primary"
                      : "border-white/10 bg-white/[0.04] text-text-secondary hover:bg-white/[0.07]"
                  )}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    {count}
                    {cardCount === count && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex gap-2 rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3 text-sm text-urgency-coral"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {!documentReady && !error && (
            <div
              role="status"
              className="flex gap-2 rounded-2xl border border-urgency-amber/25 bg-urgency-amber/10 p-3 text-sm text-urgency-amber"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{documentNotReadyMessage}</span>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
            <Button
              type="button"
              variant="ghost"
              className="h-12 rounded-full"
              disabled={isSubmitting}
              onClick={handleClose}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="session"
              className="h-12 rounded-full"
              disabled={isSubmitting}
              onClick={() => {
                if (isSubmitting) return;
                if (!documentReady) {
                  setError(documentNotReadyMessage);
                  return;
                }
                if (isSummary) {
                  summaryMutation.mutate();
                  return;
                }
                flashcardsMutation.mutate();
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {t("generation.generating")}
                </>
              ) : isSummary ? (
                t("actions.generateSummary")
              ) : (
                t("actions.generateFlashcards")
              )}
            </Button>
          </div>
          <p className="text-center text-xs leading-5 text-text-muted">
            {t("generation.afterGenerate")}
          </p>
        </div>
      </section>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
