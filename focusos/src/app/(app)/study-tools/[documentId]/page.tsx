"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, FileText, Layers3, RefreshCcw, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { documentsApi } from "@/services/documents.api";
import { AmbientWorkspaceBackground } from "@/components/focus-home";
import {
  handleFlashcardsGenerationStatus,
  handleSummaryGenerationStatus,
} from "@/lib/documents/generationNotifications";
import {
  DocumentGenerationModal,
  type DocumentGenerationAction,
} from "@/components/study-tools/DocumentGenerationModal";
import { DocumentReader } from "@/components/study-tools/DocumentReader";
import { StructuredSummary } from "@/components/study-tools/StructuredSummary";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import type {
  DocumentSummary,
  Flashcard,
  FlashcardDeck,
  StudyDocument,
  SummaryMode,
} from "@/types/document.types";

const POLL_INTERVAL_MS = 5000;
const POLL_ERROR_INTERVAL_MS = 15000;
const EXTRACTION_WAITING_NOTICE_MS = 30000;

function isPendingStatus(status?: string) {
  return status === "pending" || status === "processing";
}

function isDocumentExtracting(document?: StudyDocument) {
  return document?.status === "uploaded" || document?.status === "processing";
}

function documentPollInterval(query: { state: { data?: StudyDocument; error: unknown } }) {
  const document = query.state.data;
  if (!isDocumentExtracting(document)) return false;
  return query.state.error ? POLL_ERROR_INTERVAL_MS : POLL_INTERVAL_MS;
}

function isFailedStatus(status?: string) {
  return status === "failed";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function generationLabel(
  item: { status?: string; provider?: string; source?: string; modelName?: string; model_name?: string } | undefined,
  t: (key: string) => string
) {
  if (!item) return t("status.notGenerated");
  if (item.status === "not_generated") return t("status.notGenerated");
  if (isPendingStatus(item.status)) return t("status.generating");
  if (isFailedStatus(item.status)) return t("status.failed");
  if (item.provider === "rule_based" || item.source === "rule_based_fallback") {
    return t("status.fallback");
  }
  if (item.provider || item.modelName || item.model_name) return t("status.aiGenerated");
  return t("status.generated");
}

function documentNotReadyMessage(
  document: StudyDocument,
  t: (key: string, options?: Record<string, string>) => string
) {
  return t("generation.documentNotReady", {
    status: t(`status.${document.status}`, { defaultValue: document.status }),
  });
}

function updateDocumentFlags(
  document: StudyDocument | undefined,
  flags: Partial<Pick<StudyDocument, "hasSummary" | "hasFlashcards">>
) {
  return document ? { ...document, ...flags } : document;
}

export default function DocumentPage() {
  const { t } = useTranslation("documents");
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const documentId = params.documentId as string;
  const queryClient = useQueryClient();
  const initialGenerated = searchParams.get("generated");
  const initialIntent = searchParams.get("intent");
  const [activeTab, setActiveTab] = React.useState(() => {
    const tab = searchParams.get("tab");
    return tab === "flashcards" || tab === "source" ? tab : "summary";
  });
  const [summaryRequested, setSummaryRequested] = React.useState(
    initialGenerated === "summary" || initialIntent === "summary"
  );
  const [flashcardsRequested, setFlashcardsRequested] = React.useState(
    initialGenerated === "flashcards" || initialIntent === "flashcards"
  );
  const [activeSummaryMode, setActiveSummaryMode] = React.useState<SummaryMode>(
    searchParams.get("mode") === "key_points" || searchParams.get("mode") === "key-points"
      ? "key_points"
      : "detailed"
  );
  const [generationAction, setGenerationAction] =
    React.useState<DocumentGenerationAction | null>(null);
  const [summaryActionError, setSummaryActionError] = React.useState("");
  const [flashcardsActionError, setFlashcardsActionError] = React.useState("");
  const handledIntentRef = React.useRef("");
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  const documentQuery = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentsApi.getDocument(documentId),
    retry: false,
    refetchInterval: documentPollInterval,
  });

  const summaryQuery = useQuery({
    queryKey: ["document-summary", documentId, activeSummaryMode],
    queryFn: () => documentsApi.getDocumentSummary(documentId, activeSummaryMode),
    enabled: Boolean(documentQuery.data?.hasSummary || summaryRequested),
    retry: false,
    refetchInterval: (query) => {
      const summary = query.state.data;
      if (!summary) return false;
      return isPendingStatus(summary.status)
        ? query.state.error
          ? POLL_ERROR_INTERVAL_MS
          : POLL_INTERVAL_MS
        : false;
    },
  });

  const flashcardsQuery = useQuery({
    queryKey: ["document-flashcards", documentId],
    queryFn: () => documentsApi.getFlashcardDeck(documentId),
    enabled: Boolean(documentQuery.data || flashcardsRequested),
    retry: false,
    refetchInterval: (query) => {
      const deck = query.state.data;
      if (!deck) return false;
      return isPendingStatus(deck.status)
        ? query.state.error
          ? POLL_ERROR_INTERVAL_MS
          : POLL_INTERVAL_MS
        : false;
    },
  });

  const summary = summaryQuery.data;
  const flashcards = flashcardsQuery.data;
  const summaryStatus = summary?.status ?? (summary?.content ? "completed" : undefined);
  const flashcardsStatus = flashcards?.status;
  const isSummaryBusy = isPendingStatus(summaryStatus);
  const isFlashcardsBusy = isPendingStatus(flashcardsStatus);
  const documentExtractionStatus = documentQuery.data?.status;

  React.useEffect(() => {
    if (documentExtractionStatus !== "uploaded" && documentExtractionStatus !== "processing") {
      return;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [documentExtractionStatus]);

  const openGeneration = React.useCallback((action: DocumentGenerationAction) => {
    setGenerationAction(action);
    if (action === "summary") {
      setSummaryActionError("");
      return;
    }
    setFlashcardsActionError("");
  }, []);

  React.useEffect(() => {
    const intent = searchParams.get("intent");
    const document = documentQuery.data;
    if (intent !== "summary" && intent !== "flashcards") return;
    if (!document || document.status !== "ready") return;

    const intentKey = `${document.id}-${intent}`;
    if (handledIntentRef.current === intentKey) return;

    handledIntentRef.current = intentKey;
    setActiveTab(intent);
    openGeneration(intent);
  }, [documentQuery.data, openGeneration, searchParams]);

  const isLoading = documentQuery.isLoading;

  if (isLoading) {
    return (
      <AmbientWorkspaceBackground className="min-h-[100dvh]">
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="glass-panel flex h-20 w-20 items-center justify-center rounded-3xl">
            <Spinner className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-text-muted">{t("detail.loading")}</p>
        </div>
      </AmbientWorkspaceBackground>
    );
  }

  if (documentQuery.isError || !documentQuery.data) {
    return (
      <AmbientWorkspaceBackground className="min-h-[100dvh]">
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-text-secondary">
            {documentQuery.isError ? t("detail.loadError") : t("detail.notFound")}
          </p>
          <Button type="button" onClick={() => router.push("/study-tools")} variant="session" className="rounded-full">
            {t("actions.backStudyDesk")}
          </Button>
        </div>
      </AmbientWorkspaceBackground>
    );
  }

  const summaryContent = summary?.content?.trim();
  const hasSummaryContent = Boolean(summaryContent);
  const hasCards = Boolean(flashcards?.cards?.length);
  const summaryErrorText =
    summaryActionError ||
    summary?.errorMessage ||
    (summaryQuery.isError ? getErrorMessage(summaryQuery.error, t("detail.summaryLoadError")) : "");
  const flashcardsErrorText =
    flashcardsActionError ||
    flashcards?.errorMessage ||
    (flashcardsQuery.isError ? getErrorMessage(flashcardsQuery.error, t("detail.flashcardsLoadError")) : "");

  const document = documentQuery.data;
  const handleGenerateClick = (action: DocumentGenerationAction) => {
    if (document.status !== "ready") {
      const message = documentNotReadyMessage(document, t);
      if (action === "summary") {
        setSummaryActionError(message);
      } else {
        setFlashcardsActionError(message);
      }
      return;
    }
    openGeneration(action);
  };
  const uploadedAtMs = document.uploadedAt ? new Date(document.uploadedAt).getTime() : 0;
  const showExtractionWaiting =
    isDocumentExtracting(document) &&
    uploadedAtMs > 0 &&
    nowMs - uploadedAtMs > EXTRACTION_WAITING_NOTICE_MS;

  return (
    <AmbientWorkspaceBackground className="min-h-[100dvh]">
      <main className="mx-auto max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
        <header className="space-y-5">
          <nav className="flex items-center justify-between gap-4" aria-label={t("detail.nav")}>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 text-sm text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("actions.backStudyDesk")}
            >
              <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              {t("actions.backStudyDesk")}
            </button>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-text-muted">
              {t(`status.${document.status}`, { defaultValue: document.status })}
            </span>
          </nav>
          {showExtractionWaiting && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-text-secondary">
              {t("detail.extractionWaiting", {
                defaultValue: "The system is still preparing this document. Recovery will retry automatically if the worker missed the first queue attempt.",
              })}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
            <Card className="rounded-[2rem] p-6 sm:p-7">
              <p className="text-sm text-text-muted">{t("detail.eyebrow")}</p>
              <h1 className="mt-2 text-4xl font-light leading-tight text-text-primary">{t("detail.title")}</h1>
              <p className="mt-4 max-w-2xl text-sm font-light leading-relaxed text-text-secondary">
                {document.originalName || document.filename}
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                <DocumentMeta icon={FileText} label={t("detail.fileType")} value={document.fileType.toUpperCase()} />
                <DocumentMeta icon={BookOpen} label={t("detail.pages")} value={t("pages", { count: document.pageCount ?? 0 })} />
                <DocumentMeta
                  icon={CheckCircle2}
                  label={t("detail.studyState")}
                  value={document.hasFlashcards ? t("detail.readyToReview") : generationLabel(summary, t)}
                />
              </div>
            </Card>
            <StudyFlowRail
              title={t("detail.flow.title")}
              steps={[
                { label: t("detail.flow.uploaded"), active: ["uploaded", "processing", "ready"].includes(document.status) },
                { label: t("detail.flow.source"), active: Boolean(document.canReadInline) },
                { label: t("detail.flow.summary"), active: document.hasSummary || hasSummaryContent || isSummaryBusy },
                { label: t("detail.flow.flashcards"), active: document.hasFlashcards || hasCards || isFlashcardsBusy },
                { label: t("detail.flow.review"), active: hasCards },
              ]}
            />
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-xl grid-cols-3 rounded-full border border-white/10 bg-white/[0.045] p-1">
            <TabsTrigger value="source" className="rounded-full">{t("reader.tab")}</TabsTrigger>
            <TabsTrigger value="summary" className="rounded-full">{t("summary")}</TabsTrigger>
            <TabsTrigger value="flashcards" className="rounded-full">{t("flashcards")}</TabsTrigger>
          </TabsList>

          <TabsContent value="source" className="mt-5">
            <DocumentReader document={document} />
          </TabsContent>

          <TabsContent value="summary" className="mt-5">
            <Card className="rounded-[2rem] p-6 sm:p-8">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-primary">
                    <BookOpen className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-xl font-light text-text-primary">{t("detail.readableSummary")}</h2>
                    <p className="text-sm text-text-muted">
                      {t("detail.summaryMeta", {
                        label: generationLabel(summary, t),
                        mode: activeSummaryMode === "key_points" ? t("generation.short") : t("generation.detailed"),
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={hasSummaryContent ? "outline" : "session"}
                  onClick={() => handleGenerateClick("summary")}
                  disabled={isSummaryBusy}
                  className="rounded-full px-5"
                >
                  {isPendingStatus(summaryStatus) ? (
                    t("generation.generating")
                  ) : isFailedStatus(summaryStatus) ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                      {t("actions.retrySummary")}
                    </>
                  ) : hasSummaryContent ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                      {t("actions.regenerateSummary")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                      {t("actions.generateSummary")}
                    </>
                  )}
                </Button>
              </div>

              {summaryErrorText && (
                <div role="alert" className="mb-5 rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3 text-sm text-urgency-coral">
                  {summaryErrorText}
                </div>
              )}

              <div className="max-w-none text-base font-light leading-8 text-text-secondary">
                {summaryQuery.isLoading ? (
                  <span className="inline-flex items-center gap-3 text-text-muted">
                    <Spinner className="h-4 w-4 text-primary" />
                    {t("detail.summaryStarted")}
                  </span>
                ) : summaryContent ? (
                  <StructuredSummary summary={summary} />
                ) : (
                  <span className="text-text-muted">
                    {summaryStatus === "pending" || summaryStatus === "processing"
                      ? t("detail.summaryPreparing")
                      : t("detail.summaryEmpty")}
                  </span>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="flashcards" className="mt-5 space-y-5">
            <Card className="rounded-[2rem] p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-primary">
                    <Layers3 className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-xl font-light text-text-primary">{t("detail.reviewDeck")}</h2>
                    <p className="mt-1 text-sm text-text-secondary">
                      {hasCards
                        ? t("detail.cardsReady", { count: flashcards?.cards?.length ?? 0 })
                        : t("detail.configurableCards", { label: generationLabel(flashcards, t) })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={hasCards ? "outline" : "session"}
                    onClick={() => handleGenerateClick("flashcards")}
                    disabled={isFlashcardsBusy}
                    className="rounded-full px-5"
                  >
                    {isPendingStatus(flashcardsStatus) ? (
                      t("generation.generating")
                    ) : isFailedStatus(flashcardsStatus) ? (
                      t("actions.retryFlashcards")
                    ) : hasCards ? (
                      t("regenerate")
                    ) : (
                      t("actions.generateFlashcards")
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="session"
                    onClick={() => router.push(`/study-tools/${documentId}/review`)}
                    disabled={!hasCards}
                    className="rounded-full px-6"
                  >
                    {t("actions.startReview")}
                  </Button>
                </div>
              </div>
            </Card>

            {flashcardsErrorText && (
              <div role="alert" className="rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3 text-sm text-urgency-coral">
                {flashcardsErrorText}
              </div>
            )}

            {flashcardsQuery.isLoading ? (
              <Card className="rounded-3xl p-6 text-center">
                <Spinner className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-3 text-sm text-text-muted">{t("detail.flashcardsStarted")}</p>
              </Card>
            ) : hasCards ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {flashcards?.cards.map((card: Flashcard, idx: number) => (
                  <Card key={card.id || idx} className="rounded-3xl p-5">
                    <p className="text-xs font-mono text-text-muted">{t("detail.cardLabel", { count: idx + 1 })}</p>
                    <p className="mt-3 font-medium leading-relaxed text-text-primary">{card.question}</p>
                    <div className="mt-4 border-t border-white/10 pt-4 text-sm font-light leading-relaxed text-text-secondary">
                      {card.answer}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-3xl p-6 text-center">
                <p className="text-sm text-text-muted">
                  {isPendingStatus(flashcardsStatus)
                    ? t("detail.flashcardsPreparing")
                    : t("detail.flashcardsEmpty")}
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <DocumentGenerationModal
        key={`${documentId}-${generationAction ?? "closed"}-${activeSummaryMode}-${flashcards?.requestedQuantity || flashcards?.quantity || 10}`}
        isOpen={generationAction !== null}
        action={generationAction ?? "summary"}
        document={document}
        initialSummaryMode={activeSummaryMode}
        initialCardCount={flashcards?.requestedQuantity || flashcards?.quantity || 10}
        force={
          generationAction === "summary"
            ? hasSummaryContent || isFailedStatus(summaryStatus)
            : hasCards || isFailedStatus(flashcardsStatus)
        }
        onClose={() => setGenerationAction(null)}
        onSummaryGenerated={(generatedSummary, document, mode) => {
          handleSummaryGenerationStatus(generatedSummary, document, mode);
          setActiveSummaryMode(mode);
          setSummaryRequested(true);
          queryClient.setQueryData<DocumentSummary>(
            ["document-summary", document.id, mode],
            generatedSummary
          );
          queryClient.setQueryData<StudyDocument>(["document", document.id], (current) =>
            updateDocumentFlags(current, { hasSummary: true })
          );
          void queryClient.invalidateQueries({ queryKey: ["documents"] });
        }}
        onFlashcardsGenerated={(generatedDeck, document) => {
          handleFlashcardsGenerationStatus(generatedDeck, document);
          setFlashcardsRequested(true);
          const hasGeneratedCards =
            generatedDeck.status === "completed" ||
            generatedDeck.status === "partial" ||
            generatedDeck.cards.length > 0;
          queryClient.setQueryData<FlashcardDeck>(
            ["document-flashcards", document.id],
            generatedDeck
          );
          queryClient.setQueryData<StudyDocument>(["document", document.id], (current) =>
            updateDocumentFlags(current, { hasFlashcards: hasGeneratedCards })
          );
          void queryClient.invalidateQueries({ queryKey: ["document-flashcards", document.id] });
          void queryClient.invalidateQueries({ queryKey: ["documents"] });
        }}
      />
    </AmbientWorkspaceBackground>
  );
}

type DetailIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function DocumentMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: DetailIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
        {label}
      </div>
      <p className="mt-2 truncate text-sm text-text-primary">{value}</p>
    </div>
  );
}

function StudyFlowRail({
  title,
  steps,
}: {
  title: string;
  steps: Array<{ label: string; active: boolean }>;
}) {
  return (
    <Card className="rounded-[2rem] p-5">
      <p className="text-sm text-text-muted">{title}</p>
      <div className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs ${
                step.active
                  ? "border-primary/30 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.035] text-text-muted"
              }`}
            >
              {index + 1}
            </span>
            <span className={step.active ? "text-sm text-text-primary" : "text-sm text-text-muted"}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
