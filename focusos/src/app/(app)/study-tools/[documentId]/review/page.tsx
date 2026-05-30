"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { documentsApi } from "@/services/documents.api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function FlashcardReviewPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;
  const [currentCardIdx, setCurrentCardIdx] = React.useState(0);
  const [isFlipped, setIsFlipped] = React.useState(false);

  const { data: flashcards, isLoading } = useQuery({
    queryKey: ["document-flashcards", documentId],
    queryFn: () => documentsApi.getFlashcardDeck(documentId),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Spinner className="h-7 w-7 text-focus-purple" />
        <span className="text-xs text-text-muted font-light">
          Loading flashcards...
        </span>
      </div>
    );
  }

  if (!flashcards || !flashcards.cards || flashcards.cards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-text-secondary">No flashcards found</p>
        <Button
          onClick={() => router.back()}
          className="bg-focus-purple text-white"
        >
          Back
        </Button>
      </div>
    );
  }

  const cards = flashcards.cards;
  const currentCard = cards[currentCardIdx];
  const progress = ((currentCardIdx + 1) / cards.length) * 100;

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-ambient-dark via-surface-deep to-ambient-dark">
      <div className="w-full max-w-2xl space-y-8">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <p className="text-text-muted font-light">
              Card {currentCardIdx + 1} of {cards.length}
            </p>
            <p className="text-text-muted font-light">{Math.round(progress)}%</p>
          </div>
          <div className="h-1 bg-surface-deep rounded-full overflow-hidden">
            <div
              className="h-full bg-focus-purple transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Flashcard */}
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="cursor-pointer h-64 sm:h-80 flex items-center justify-center"
        >
          <Card
            className={`w-full h-full flex flex-col items-center justify-center p-8 transition-all ${
              isFlipped ? "bg-focus-purple/10 border-focus-purple/50" : ""
            }`}
          >
            <div className="text-center space-y-4">
              <p className="text-xs text-text-muted font-medium uppercase">
                {isFlipped ? "Answer" : "Question"}
              </p>
              <p
                className={`${
                  isFlipped
                    ? "text-2xl text-focus-purple"
                    : "text-3xl font-light text-text-primary"
                }`}
              >
                {isFlipped ? currentCard.answer : currentCard.question}
              </p>
              <p className="text-xs text-text-muted pt-4">
                Click to {isFlipped ? "reveal question" : "reveal answer"}
              </p>
            </div>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <Button
            onClick={handlePrevious}
            disabled={currentCardIdx === 0}
            variant="outline"
            className="flex-1 border-subtle-border disabled:opacity-50"
          >
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentCardIdx === cards.length - 1}
            className="flex-1 bg-focus-purple hover:bg-focus-purple/90 text-white disabled:opacity-50"
          >
            Next
          </Button>
        </div>

        {currentCardIdx === cards.length - 1 && (
          <Button
            onClick={() => router.back()}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            Complete Review
          </Button>
        )}
      </div>
    </div>
  );
}
