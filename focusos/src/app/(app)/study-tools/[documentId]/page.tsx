"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { documentsApi } from "@/services/documents.api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

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
  const document = summary;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Spinner className="h-7 w-7 text-focus-purple" />
        <span className="text-xs text-text-muted font-light">
          Loading document...
        </span>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-text-secondary">Document not found</p>
        <Button
          onClick={() => router.push("/study-tools")}
          className="bg-focus-purple text-white"
        >
          Back to Documents
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      {/* Header */}
      <div className="space-y-2">
        <Button
          variant="outline"
          className="border-subtle-border text-text-secondary"
          onClick={() => router.back()}
        >
          ← Back
        </Button>
        <h1 className="text-3xl font-extralight text-text-primary mt-4">
          Document
        </h1>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full max-w-xs grid-cols-2 bg-surface-deep border border-subtle-border">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4 mt-4">
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-medium text-text-primary mb-3">
                Summary
              </h2>
              <p className="text-sm text-text-secondary font-light leading-relaxed">
                {document?.content || "Summary loading..."}
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* Flashcards Tab */}
        <TabsContent value="flashcards" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <Button
              onClick={() =>
                router.push(`/study-tools/${documentId}/review`)
              }
              className="flex-1 bg-focus-purple hover:bg-focus-purple/90 text-white"
            >
              Start Review
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(flashcards?.cards ?? []).map((card: any, idx: number) => (
              <Card key={idx} className="p-6 space-y-3">
                <p className="text-xs text-text-muted font-medium">
                  Card {idx + 1}
                </p>
                <p className="font-medium text-text-primary">{card.question}</p>
                <div className="text-sm text-text-secondary font-light pt-3 border-t border-subtle-border">
                  {card.answer}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
