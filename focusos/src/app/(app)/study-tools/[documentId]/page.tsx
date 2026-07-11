"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Layers3, RefreshCcw, Sparkles } from "lucide-react";
import { documentsApi } from "@/services/documents.api";
import { AmbientScene } from "@/components/ambient/AmbientScene";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import type { DocumentSummary, Flashcard, FlashcardDeck, StudyDocument } from "@/types/document.types";

const POLL_LIMIT = 30;
const POLL_INTERVAL_MS = 2500;

function isPendingStatus(status?: string) {
  return status === "pending" || status === "processing";
}

function isFailedStatus(status?: string) {
  return status === "failed";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function generationLabel(item?: { status?: string; provider?: string; source?: string; modelName?: string; model_name?: string }) {
  if (!item) return "Not generated";
  if (isPendingStatus(item.status)) return "Generating";
  if (isFailedStatus(item.status)) return "Generation failed";
  if (item.provider === "rule_based" || item.source === "rule_based_fallback") {
    return "Generated fallback";
  }
  if (item.provider || item.modelName || item.model_name) return "AI generated";
  return "Generated";
}

function updateDocumentFlags(
  document: StudyDocument | undefined,
  flags: Partial<Pick<StudyDocument, "hasSummary" | "hasFlashcards">>
) {
  return document ? { ...document, ...flags } : document;
}

export default function DocumentPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;
  const queryClient = useQueryClient();
  const [summaryRequested, setSummaryRequested] = React.useState(false);
  const [flashcardsRequested, setFlashcardsRequested] = React.useState(false);
  const [summaryPollCount, setSummaryPollCount] = React.useState(0);
  const [flashcardsPollCount, setFlashcardsPollCount] = React.useState(0);
  const [summaryActionError, setSummaryActionError] = React.useState("");
  const [flashcardsActionError, setFlashcardsActionError] = React.useState("");

  const documentQuery = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentsApi.getDocument(documentId),
  });

  const summaryQuery = useQuery({
    queryKey: ["document-summary", documentId, "detailed"],
    queryFn: () => documentsApi.getDocumentSummary(documentId, "detailed"),
    enabled: Boolean(documentQuery.data?.hasSummary || summaryRequested),
    retry: false,
  });

  const flashcardsQuery = useQuery({
    queryKey: ["document-flashcards", documentId],
    queryFn: () => documentsApi.getFlashcardDeck(documentId),
    enabled: Boolean(documentQuery.data?.hasFlashcards || flashcardsRequested),
    retry: false,
  });

  const generateSummaryMutation = useMutation({
    mutationFn: (force: boolean) =>
      documentsApi.generateDocumentSummary({
        documentId,
        mode: "detailed",
        force,
      }),
    onMutate: () => {
      setSummaryActionError("");
      setSummaryRequested(true);
      setSummaryPollCount(0);
    },
    onSuccess: (generatedSummary) => {
      queryClient.setQueryData<DocumentSummary>(
        ["document-summary", documentId, "detailed"],
        generatedSummary
      );
      queryClient.setQueryData<StudyDocument>(["document", documentId], (document) =>
        updateDocumentFlags(document, { hasSummary: true })
      );
    },
    onError: (error) => {
      setSummaryActionError(getErrorMessage(error, "Could not generate summary."));
    },
  });

  const generateFlashcardsMutation = useMutation({
    mutationFn: (force: boolean) =>
      documentsApi.generateFlashcards({
        documentId,
        quantity: 10,
        difficulty: "medium",
        scope: "full_document",
        force,
      }),
    onMutate: () => {
      setFlashcardsActionError("");
      setFlashcardsRequested(true);
      setFlashcardsPollCount(0);
    },
    onSuccess: (generatedDeck) => {
      queryClient.setQueryData<FlashcardDeck>(
        ["document-flashcards", documentId],
        generatedDeck
      );
      queryClient.setQueryData<StudyDocument>(["document", documentId], (document) =>
        updateDocumentFlags(document, { hasFlashcards: generatedDeck.cards.length > 0 })
      );
    },
    onError: (error) => {
      setFlashcardsActionError(getErrorMessage(error, "Could not generate flashcards."));
    },
  });

  const summary = summaryQuery.data;
  const flashcards = flashcardsQuery.data;
  const summaryStatus = summary?.status ?? (summary?.content ? "completed" : undefined);
  const flashcardsStatus = flashcards?.status ?? (flashcards?.cards?.length ? "completed" : undefined);
  const isSummaryBusy = generateSummaryMutation.isPending || isPendingStatus(summaryStatus);
  const isFlashcardsBusy = generateFlashcardsMutation.isPending || isPendingStatus(flashcardsStatus);

  React.useEffect(() => {
    if (!isPendingStatus(summaryStatus) || summaryPollCount >= POLL_LIMIT) return;
    const timeout = window.setTimeout(() => {
      setSummaryPollCount((count) => count + 1);
      summaryQuery.refetch();
    }, POLL_INTERVAL_MS);
    return () => window.clearTimeout(timeout);
  }, [summaryPollCount, summaryQuery, summaryStatus]);

  React.useEffect(() => {
    if (!isPendingStatus(flashcardsStatus) || flashcardsPollCount >= POLL_LIMIT) return;
    const timeout = window.setTimeout(() => {
      setFlashcardsPollCount((count) => count + 1);
      flashcardsQuery.refetch();
    }, POLL_INTERVAL_MS);
    return () => window.clearTimeout(timeout);
  }, [flashcardsPollCount, flashcardsQuery, flashcardsStatus]);

  const isLoading = documentQuery.isLoading;

  if (isLoading) {
    return (
      <AmbientScene variant="rain" intensity="low" className="min-h-[100dvh]">
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="glass-panel flex h-20 w-20 items-center justify-center rounded-3xl">
            <Spinner className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-text-muted">Opening reading panel</p>
        </div>
      </AmbientScene>
    );
  }

  if (documentQuery.isError || !documentQuery.data) {
    return (
      <AmbientScene variant="rain" intensity="low" className="min-h-[100dvh]">
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-text-secondary">
            {documentQuery.isError ? "Document could not be loaded." : "AI document not found"}
          </p>
          <Button type="button" onClick={() => router.push("/study-tools")} variant="session" className="rounded-full">
            Back to study desk
          </Button>
        </div>
      </AmbientScene>
    );
  }

  const summaryContent = summary?.content?.trim();
  const hasSummaryContent = Boolean(summaryContent);
  const hasCards = Boolean(flashcards?.cards?.length);
  const summaryErrorText =
    summaryActionError ||
    summary?.errorMessage ||
    (summaryQuery.isError ? getErrorMessage(summaryQuery.error, "Summary could not be loaded.") : "");
  const flashcardsErrorText =
    flashcardsActionError ||
    flashcards?.errorMessage ||
    (flashcardsQuery.isError ? getErrorMessage(flashcardsQuery.error, "Flashcards could not be loaded.") : "");

  return (
    <AmbientScene variant="rain" intensity="low" className="min-h-[100dvh]">
      <main className="mx-auto max-w-5xl space-y-7 p-4 sm:p-6 lg:p-8">
        <header className="space-y-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to study desk"
          >
            <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </button>
          <div>
            <p className="text-sm text-text-muted">AI document</p>
            <h1 className="mt-2 text-4xl font-light text-text-primary">Document study</h1>
            <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-text-secondary">
              {documentQuery.data.originalName || documentQuery.data.filename}
            </p>
          </div>
        </header>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-full border border-white/10 bg-white/[0.045] p-1">
            <TabsTrigger value="summary" className="rounded-full">Summary</TabsTrigger>
            <TabsTrigger value="flashcards" className="rounded-full">Flashcards</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-5">
            <Card className="rounded-[2rem] p-6 sm:p-8">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-primary">
                    <BookOpen className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-xl font-light text-text-primary">Readable summary</h2>
                    <p className="text-sm text-text-muted">
                      {generationLabel(summary)} / detailed mode
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={hasSummaryContent ? "outline" : "session"}
                  onClick={() => generateSummaryMutation.mutate(hasSummaryContent || isFailedStatus(summaryStatus))}
                  disabled={isSummaryBusy || documentQuery.data.status !== "ready"}
                  className="rounded-full px-5"
                >
                  {generateSummaryMutation.isPending || isPendingStatus(summaryStatus) ? (
                    "Generating"
                  ) : isFailedStatus(summaryStatus) ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                      Retry summary
                    </>
                  ) : hasSummaryContent ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                      Generate summary
                    </>
                  )}
                </Button>
              </div>

              {summaryErrorText && (
                <div role="alert" className="mb-5 rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3 text-sm text-urgency-coral">
                  {summaryErrorText}
                </div>
              )}

              <article className="max-w-none whitespace-pre-wrap text-base font-light leading-8 text-text-secondary">
                {summaryQuery.isLoading || generateSummaryMutation.isPending ? (
                  <span className="inline-flex items-center gap-3 text-text-muted">
                    <Spinner className="h-4 w-4 text-primary" />
                    Summary generation has started. This can take a moment.
                  </span>
                ) : summaryContent ? (
                  summaryContent
                ) : (
                  <span className="text-text-muted">
                    {summaryStatus === "pending" || summaryStatus === "processing"
                      ? "Summary is still being prepared."
                      : "No summary exists yet. Generate one when you are ready."}
                  </span>
                )}
              </article>
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
                    <h2 className="text-xl font-light text-text-primary">Review deck</h2>
                    <p className="mt-1 text-sm text-text-secondary">
                      {hasCards
                        ? `${flashcards?.cards?.length ?? 0} cards ready for active recall.`
                        : `${generationLabel(flashcards)} / 10 medium cards`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={hasCards ? "outline" : "session"}
                    onClick={() => generateFlashcardsMutation.mutate(hasCards || isFailedStatus(flashcardsStatus))}
                    disabled={isFlashcardsBusy || documentQuery.data.status !== "ready"}
                    className="rounded-full px-5"
                  >
                    {generateFlashcardsMutation.isPending || isPendingStatus(flashcardsStatus) ? (
                      "Generating"
                    ) : isFailedStatus(flashcardsStatus) ? (
                      "Retry flashcards"
                    ) : hasCards ? (
                      "Regenerate"
                    ) : (
                      "Generate flashcards"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="session"
                    onClick={() => router.push(`/study-tools/${documentId}/review`)}
                    disabled={!hasCards}
                    className="rounded-full px-6"
                  >
                    Start review
                  </Button>
                </div>
              </div>
            </Card>

            {flashcardsErrorText && (
              <div role="alert" className="rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-3 text-sm text-urgency-coral">
                {flashcardsErrorText}
              </div>
            )}

            {flashcardsQuery.isLoading || generateFlashcardsMutation.isPending ? (
              <Card className="rounded-3xl p-6 text-center">
                <Spinner className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-3 text-sm text-text-muted">Flashcard generation has started.</p>
              </Card>
            ) : hasCards ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {flashcards?.cards.map((card: Flashcard, idx: number) => (
                  <Card key={card.id || idx} className="rounded-3xl p-5">
                    <p className="text-xs font-mono text-text-muted">Card {idx + 1}</p>
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
                    ? "Flashcards are still being prepared."
                    : "No flashcards are available yet. Generate a deck to begin review."}
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </AmbientScene>
  );
}
