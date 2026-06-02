"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Layers3 } from "lucide-react";
import { documentsApi } from "@/services/documents.api";
import { AmbientScene } from "@/components/ambient/AmbientScene";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import type { Flashcard } from "@/types/document.types";

export default function DocumentPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["document-summary", documentId, "detailed"],
    queryFn: () => documentsApi.getDocumentSummary(documentId, "detailed"),
  });

  const { data: flashcards, isLoading: flashcardsLoading } = useQuery({
    queryKey: ["document-flashcards", documentId],
    queryFn: () => documentsApi.getFlashcardDeck(documentId),
  });

  const isLoading = summaryLoading || flashcardsLoading;

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

  if (!summary) {
    return (
      <AmbientScene variant="rain" intensity="low" className="min-h-[100dvh]">
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-text-secondary">AI document not found</p>
          <Button type="button" onClick={() => router.push("/study-tools")} variant="session" className="rounded-full">
            Back to study desk
          </Button>
        </div>
      </AmbientScene>
    );
  }

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
              Review the generated summary, then move into a focused flashcard pass.
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
              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-primary">
                  <BookOpen className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl font-light text-text-primary">Readable summary</h2>
                  <p className="text-sm text-text-muted">Generated in detailed mode</p>
                </div>
              </div>
              <article className="max-w-none whitespace-pre-wrap text-base font-light leading-8 text-text-secondary">
                {summary.content || "Summary loading..."}
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
                      {flashcards?.cards?.length ?? 0} cards ready for active recall.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="session"
                  onClick={() => router.push(`/study-tools/${documentId}/review`)}
                  disabled={!flashcards?.cards?.length}
                  className="rounded-full px-6"
                >
                  Start review
                </Button>
              </div>
            </Card>

            {flashcards?.cards?.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {flashcards.cards.map((card: Flashcard, idx: number) => (
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
                <p className="text-sm text-text-muted">No flashcards are available for this document yet.</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </AmbientScene>
  );
}
