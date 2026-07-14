"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { documentsApi } from "@/services/documents.api";
import { AmbientWorkspaceBackground } from "@/components/focus-home";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

export default function FlashcardReviewPage() {
  const { t } = useTranslation("documents");
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;
  const [currentCardIdx, setCurrentCardIdx] = React.useState(0);
  const [isFlipped, setIsFlipped] = React.useState(false);

  const { data: flashcards, isLoading } = useQuery({
    queryKey: ["document-flashcards", documentId],
    queryFn: () => documentsApi.getFlashcardDeck(documentId),
  });

  const cards = flashcards?.cards ?? [];

  const handleNext = () => {
    if (currentCardIdx < cards.length - 1) {
      setCurrentCardIdx(currentCardIdx + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentCardIdx > 0) {
      setCurrentCardIdx(currentCardIdx - 1);
      setIsFlipped(false);
    }
  };

  const handleRestart = React.useCallback(() => {
    setCurrentCardIdx(0);
    setIsFlipped(false);
  }, []);

  React.useEffect(() => {
    if (cards.length === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrentCardIdx((index) => {
          const nextIndex = Math.min(index + 1, cards.length - 1);
          if (nextIndex !== index) setIsFlipped(false);
          return nextIndex;
        });
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentCardIdx((index) => {
          const nextIndex = Math.max(index - 1, 0);
          if (nextIndex !== index) setIsFlipped(false);
          return nextIndex;
        });
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setIsFlipped((value) => !value);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cards.length]);

  if (isLoading) {
    return (
      <AmbientWorkspaceBackground className="min-h-[100dvh]">
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="glass-panel flex h-20 w-20 items-center justify-center rounded-3xl">
            <Spinner className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm text-text-muted">{t("reviewPage.loading")}</p>
        </div>
      </AmbientWorkspaceBackground>
    );
  }

  if (cards.length === 0) {
    return (
      <AmbientWorkspaceBackground className="min-h-[100dvh]">
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-text-secondary">{t("reviewPage.empty")}</p>
          <Button type="button" onClick={() => router.back()} variant="session" className="rounded-full">
            {t("actions.back")}
          </Button>
        </div>
      </AmbientWorkspaceBackground>
    );
  }

  const safeCurrentCardIdx = Math.min(currentCardIdx, cards.length - 1);
  const currentCard = cards[safeCurrentCardIdx];
  const progress = ((safeCurrentCardIdx + 1) / cards.length) * 100;

  return (
    <AmbientWorkspaceBackground className="min-h-[100dvh]">
      <main className="flex min-h-[100dvh] flex-col p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("actions.backDocument")}
          >
            <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </button>
          <p className="text-sm font-mono text-text-muted">
            {t("reviewPage.progress", { current: safeCurrentCardIdx + 1, total: cards.length })}
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-7 py-8">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm text-text-muted">
              <span>{isFlipped ? t("reviewPage.answer") : t("reviewPage.question")}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-primary transition-all duration-fast" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFlipped((value) => !value)}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
            aria-label={isFlipped ? t("reviewPage.showQuestion") : t("reviewPage.revealAnswer")}
          >
            <Card className={`min-h-[340px] rounded-[2rem] p-8 transition-all duration-fast sm:p-10 ${
              isFlipped ? "border-primary/35 bg-primary/10" : "bg-white/[0.045]"
            }`}>
              <div className="flex h-full min-h-[270px] flex-col items-center justify-center text-center">
                <p className="text-sm font-mono text-text-muted">
                  {isFlipped ? t("reviewPage.answer") : t("reviewPage.question")}
                </p>
                <p className={`mt-6 text-balance font-light leading-tight ${
                  isFlipped ? "text-2xl text-text-primary sm:text-3xl" : "text-3xl text-text-primary sm:text-5xl"
                }`}>
                  {isFlipped ? currentCard.answer : currentCard.question}
                </p>
                <p className="mt-8 text-xs text-text-muted">
                  {isFlipped ? t("reviewPage.pressQuestion") : t("reviewPage.pressAnswer")}
                </p>
              </div>
            </Card>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              onClick={handlePrevious}
              disabled={safeCurrentCardIdx === 0}
              variant="outline"
              className="h-12 rounded-full disabled:opacity-50"
            >
              {t("actions.previous")}
            </Button>
            <Button
              type="button"
              onClick={handleNext}
              disabled={safeCurrentCardIdx === cards.length - 1}
              variant="session"
              className="h-12 rounded-full disabled:opacity-50"
            >
              {t("actions.next")}
            </Button>
          </div>

          {safeCurrentCardIdx === cards.length - 1 && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={handleRestart}
                variant="outline"
                className="h-12 rounded-full"
              >
                <RotateCcw className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                {t("actions.restart")}
              </Button>
              <Button
                type="button"
                onClick={() => router.back()}
                variant="session"
                className="h-12 rounded-full"
              >
                {t("actions.completeReview")}
              </Button>
            </div>
          )}
        </div>
      </main>
    </AmbientWorkspaceBackground>
  );
}
