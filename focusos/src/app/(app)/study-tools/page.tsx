"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { documentsApi } from "@/services/documents.api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function StudyToolsPage() {
  const router = useRouter();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.getDocuments(),
  });

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-extralight text-text-primary leading-tight">
            Study Tools
          </h1>
          <p className="text-base text-text-secondary font-light">
            Upload documents, generate smart summaries, and create flashcards.
          </p>
        </div>
      </div>

      {/* Upload Card */}
      <Card
        className="p-12 border-2 border-dashed border-subtle-border hover:border-focus-purple/50 transition-colors cursor-pointer space-y-4"
        onClick={() => router.push("/study-tools/upload")}
      >
        <div className="text-center space-y-2">
          <p className="text-4xl">📄</p>
          <h2 className="text-lg font-medium text-text-primary">
            Upload Document
          </h2>
          <p className="text-sm text-text-secondary font-light">
            Click to upload PDF, DOCX, or TXT files
          </p>
        </div>
      </Card>

      {/* Documents List */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-text-primary">
          Your Documents
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Spinner className="h-6 w-6 text-focus-purple" />
          </div>
        ) : !documents || documents.length === 0 ? (
          <Card className="p-12 text-center space-y-3">
            <p className="text-4xl">📚</p>
            <h3 className="text-lg font-medium text-text-primary">
              No documents yet
            </h3>
            <p className="text-sm text-text-secondary font-light">
              Upload your first document to get started with AI summaries and flashcards.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc: any) => (
              <Card
                key={doc.id}
                className="p-6 cursor-pointer hover:border-focus-purple/50 transition-colors"
                onClick={() => router.push(`/study-tools/${doc.id}`)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-text-primary truncate">
                        {doc.name}
                      </h3>
                      <p className="text-xs text-text-muted mt-1">
                        {doc.fileSize} · {doc.uploadedAt}
                      </p>
                    </div>
                    <p className="text-2xl">📄</p>
                  </div>
                  <p className="text-sm text-text-secondary font-light">
                    {doc.pageCount} pages
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
