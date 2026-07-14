"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FileText, Layers3, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DashboardControlPopover } from "./DashboardControlPopover";
import { Button } from "@/components/ui/Button";
import { DocumentGenerationModal, type DocumentGenerationAction } from "@/components/study-tools/DocumentGenerationModal";
import { DocumentUploadModal } from "@/components/study-tools/DocumentUploadModal";
import {
  handleFlashcardsGenerationStatus,
  handleSummaryGenerationStatus,
} from "@/lib/documents/generationNotifications";
import { documentsApi } from "@/services/documents.api";
import type {
  DocumentSummary,
  FlashcardDeck,
  StudyDocument,
  SummaryMode,
} from "@/types/document.types";

const POLL_INTERVAL_MS = 5000;
const POLL_ERROR_INTERVAL_MS = 15000;

export interface AiDocumentsWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiDocumentsWidget({ isOpen, onClose }: AiDocumentsWidgetProps) {
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const [generationAction, setGenerationAction] =
    React.useState<DocumentGenerationAction>("summary");
  const [selectedDocument, setSelectedDocument] = React.useState<StudyDocument | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["documents", "recent"],
    queryFn: () =>
      documentsApi.getDocuments({
        sortBy: "date",
        sortOrder: "desc",
        limit: 5,
      }),
    enabled: isOpen,
    staleTime: 30_000,
    retry: false,
    refetchInterval: (query) => {
      const documents = query.state.data ?? [];
      return documents.some((document) => document.status === "uploaded" || document.status === "processing")
        ? query.state.error
          ? POLL_ERROR_INTERVAL_MS
          : POLL_INTERVAL_MS
        : false;
    },
  });

  const openGeneration = React.useCallback(
    (document: StudyDocument, action: DocumentGenerationAction) => {
      setSelectedDocument(document);
      setGenerationAction(action);
    },
    []
  );

  const handleDocumentAction = React.useCallback(
    (document: StudyDocument, action: DocumentGenerationAction) => {
      if (document.status !== "ready") {
        router.push(`/study-tools/${document.id}?tab=${action}&intent=${action}`);
        return;
      }

      if (action === "summary" && document.hasSummary) {
        router.push(`/study-tools/${document.id}?tab=summary`);
        return;
      }

      if (action === "flashcards" && document.hasFlashcards) {
        router.push(`/study-tools/${document.id}?tab=flashcards`);
        return;
      }

      openGeneration(document, action);
    },
    [openGeneration, router]
  );

  const closeGeneration = React.useCallback(() => {
    setSelectedDocument(null);
  }, []);

  const handleSummaryGenerated = React.useCallback(
    (summary: DocumentSummary, document: StudyDocument, mode: SummaryMode) => {
      handleSummaryGenerationStatus(summary, document, mode);
      queryClient.setQueryData(["document-summary", document.id, mode], summary);
      queryClient.setQueryData<StudyDocument>(["document", document.id], (current) =>
        current ? { ...current, hasSummary: true } : current
      );
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      router.push(`/study-tools/${document.id}?tab=summary&generated=summary&mode=${mode}`);
    },
    [queryClient, router]
  );

  const handleFlashcardsGenerated = React.useCallback(
    (deck: FlashcardDeck, document: StudyDocument) => {
      handleFlashcardsGenerationStatus(deck, document);
      queryClient.setQueryData(["document-flashcards", document.id], deck);
      const hasGeneratedCards =
        deck.status === "completed" || deck.status === "partial" || deck.cards.length > 0;
      queryClient.setQueryData<StudyDocument>(["document", document.id], (current) =>
        current ? { ...current, hasFlashcards: hasGeneratedCards } : current
      );
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      router.push(`/study-tools/${document.id}?tab=flashcards&generated=flashcards`);
    },
    [queryClient, router]
  );

  if (!isOpen) return null;

  const documents = documentsQuery.data ?? [];

  return (
    <>
      <DashboardControlPopover
        id="dashboard-docs-popover"
        title={t("focusHome.aiDocs.title")}
        description={t("focusHome.aiDocs.description")}
        icon={<FileText className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />}
        onClose={onClose}
        className="md:w-[min(92vw,460px)]"
      >
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="session"
              className="h-10 rounded-full"
              onClick={() => setIsUploadOpen(true)}
            >
              <FilePlus2 className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              {t("focusHome.aiDocs.add")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full"
              onClick={() => router.push("/study-tools")}
            >
              {t("focusHome.aiDocs.viewAll")}
            </Button>
          </div>

          <div className="space-y-2">
            {documentsQuery.isLoading ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-text-muted">
                {t("focusHome.aiDocs.loading")}
              </p>
            ) : documentsQuery.isError ? (
              <p role="alert" className="rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-4 text-sm text-urgency-coral">
                {t("focusHome.aiDocs.loadError")}
              </p>
            ) : documents.length === 0 ? (
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.04] p-5 text-left transition-colors hover:border-primary/40 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block text-sm font-medium text-text-primary">
                  {t("focusHome.aiDocs.emptyTitle")}
                </span>
                <span className="mt-1 block text-xs text-text-muted">
                  {t("focusHome.aiDocs.emptyDescription")}
                </span>
              </button>
            ) : (
              documents.map((document) => (
                <article
                  key={document.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/study-tools/${document.id}`)}
                    className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <p className="line-clamp-1 text-sm font-medium text-text-primary">
                      {document.originalName || document.filename}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      {document.fileType} / {document.status}
                    </p>
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDocumentAction(document, "summary")}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-3 text-xs text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5 stroke-[1.6]" aria-hidden="true" />
                      {document.hasSummary ? t("focusHome.aiDocs.openSummary") : t("focusHome.aiDocs.summary")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDocumentAction(document, "flashcards")}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-3 text-xs text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Layers3 className="mr-1.5 h-3.5 w-3.5 stroke-[1.6]" aria-hidden="true" />
                      {document.hasFlashcards ? t("focusHome.aiDocs.openDeck") : t("focusHome.aiDocs.flashcards")}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </DashboardControlPopover>

      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onGenerateSummary={(document) => {
          setIsUploadOpen(false);
          openGeneration(document, "summary");
        }}
        onGenerateFlashcards={(document) => {
          setIsUploadOpen(false);
          openGeneration(document, "flashcards");
        }}
      />

      <DocumentGenerationModal
        key={`${selectedDocument?.id ?? "none"}-${generationAction}`}
        isOpen={Boolean(selectedDocument)}
        action={generationAction}
        document={selectedDocument}
        force={false}
        onClose={closeGeneration}
        onSummaryGenerated={handleSummaryGenerated}
        onFlashcardsGenerated={handleFlashcardsGenerated}
      />
    </>
  );
}
