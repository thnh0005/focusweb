"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileText,
  Layers3,
  Plus,
  Sparkles,
} from "lucide-react";
import { documentsApi } from "@/services/documents.api";
import { AmbientScene } from "@/components/ambient/AmbientScene";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { StudyDocument } from "@/types/document.types";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function StudyToolsPage() {
  const router = useRouter();

  const { data: documents, isLoading, isError } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.getDocuments(),
  });

  const documentCount = documents?.length ?? 0;
  const readyCount = documents?.filter((doc) => doc.status === "ready").length ?? 0;
  const flashcardCount = documents?.filter((doc) => doc.hasFlashcards).length ?? 0;

  return (
    <AmbientScene variant="rain" intensity="medium" className="min-h-[100dvh]">
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between gap-4" aria-label="AI documents navigation">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 text-sm text-text-secondary backdrop-blur-xl transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            Dashboard
          </Link>
          <span className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs text-text-muted backdrop-blur-xl">
            AI Docs
          </span>
        </nav>

        <header className="grid gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end lg:py-12">
          <div className="max-w-3xl">
            <p className="text-sm text-text-muted">AI documents</p>
            <h1 className="mt-3 text-balance text-5xl font-light leading-[0.98] text-text-primary sm:text-6xl lg:text-7xl">
              Study material, ready when you sit down.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-light leading-7 text-text-secondary">
              Keep PDFs, notes, summaries, and recall cards in a quiet reading room instead of the old dashboard shell.
            </p>
          </div>
          <Card className="rounded-[1.75rem] p-5">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs text-text-muted">Next action</p>
                <h2 className="mt-2 text-2xl font-light text-text-primary">Add source material</h2>
                <p className="mt-3 text-sm font-light leading-6 text-text-secondary">
                  Upload PDF, DOCX, or TXT files and turn them into readable summaries and flashcards.
                </p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
              </span>
            </div>
            <Button
              type="button"
              variant="session"
              onClick={() => router.push("/study-tools/upload")}
              className="mt-6 h-12 w-full rounded-full px-6"
            >
              <Plus className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
              Upload AI document
            </Button>
          </Card>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="AI document metrics">
          <DeskMetric icon={FileText} label="Documents" value={documentCount} />
          <DeskMetric icon={CheckCircle2} label="Ready" value={readyCount} />
          <DeskMetric icon={Layers3} label="Review decks" value={flashcardCount} />
        </section>

        <section className="mt-8 flex-1 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-text-muted">Shelf</p>
              <h2 className="mt-1 text-2xl font-light text-text-primary">Documents for review</h2>
            </div>
            <span className="font-mono text-xs text-text-muted">
              {documentCount} documents
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="glass-card min-h-56 rounded-3xl p-5">
                  <div className="skeleton h-12 w-12 rounded-2xl" />
                  <div className="skeleton mt-7 h-5 w-4/5" />
                  <div className="skeleton mt-3 h-4 w-2/3" />
                  <div className="mt-8 flex gap-2">
                    <div className="skeleton h-7 w-20 rounded-full" />
                    <div className="skeleton h-7 w-24 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <Card className="rounded-3xl border-urgency-amber/25 bg-urgency-amber/10 p-6">
              <p className="text-sm text-urgency-amber">
                Document shelf could not refresh. Try again in a moment.
              </p>
            </Card>
          ) : !documents || documents.length === 0 ? (
            <Card className="rounded-[1.75rem] p-8 sm:p-10">
              <div className="mx-auto max-w-xl text-center">
                <BookOpen className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-2xl font-light text-text-primary">Your shelf is empty</h3>
                <p className="mx-auto mt-3 max-w-md text-sm font-light leading-6 text-text-secondary">
                  Upload a document to create your first summary and review deck.
                </p>
                <Button
                  type="button"
                  variant="session"
                  onClick={() => router.push("/study-tools/upload")}
                  className="mt-6 h-11 rounded-full px-6"
                >
                  <Plus className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  Upload document
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {documents.map((doc: StudyDocument) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onOpen={() => router.push(`/study-tools/${doc.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </AmbientScene>
  );
}

type DeskMetricIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function DeskMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: DeskMetricIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text-muted">{label}</span>
        <Icon className="h-4 w-4 text-primary/80" aria-hidden />
      </div>
      <p className="mt-4 font-mono text-3xl font-light text-text-primary">{value}</p>
    </div>
  );
}

function DocumentCard({
  document,
  onOpen,
}: {
  document: StudyDocument;
  onOpen: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      className="group min-h-56 cursor-pointer rounded-3xl p-5 transition-all duration-fast hover:-translate-y-1 hover:border-primary/30 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex h-full flex-col justify-between gap-5">
        <div>
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-primary">
              <FileText className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-text-muted">
              {document.fileType.toUpperCase()}
            </span>
          </div>
          <h3 className="mt-5 line-clamp-2 text-lg font-light leading-snug text-text-primary">
            {document.originalName || document.filename}
          </h3>
          <p className="mt-2 text-sm text-text-muted">
            {formatBytes(document.fileSizeBytes)} / {document.pageCount ?? 0} pages
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ShelfBadge active={document.hasSummary}>Summary</ShelfBadge>
          <ShelfBadge active={document.hasFlashcards}>Flashcards</ShelfBadge>
          <ShelfBadge active={document.status === "ready"}>{document.status}</ShelfBadge>
        </div>
      </div>
    </Card>
  );
}

function ShelfBadge({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${
      active
        ? "border-primary/25 bg-primary/10 text-primary"
        : "border-white/10 bg-white/[0.035] text-text-muted"
    }`}>
      {children}
    </span>
  );
}
