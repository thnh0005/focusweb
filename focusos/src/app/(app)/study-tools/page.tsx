"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  Layers3,
  Plus,
  Search,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import { documentsApi } from "@/services/documents.api";
import { AmbientWorkspaceBackground } from "@/components/focus-home";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { StudyDocument } from "@/types/document.types";

const POLL_INTERVAL_MS = 5000;
const POLL_ERROR_INTERVAL_MS = 15000;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function StudyToolsPage() {
  const { t } = useTranslation("documents");
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "ready" | "summary" | "flashcards">("all");

  const { data: documents, isLoading, isError } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.getDocuments(),
    retry: false,
    refetchInterval: (query) => {
      const documents = query.state.data ?? [];
      return documents.some((doc) => doc.status === "uploaded" || doc.status === "processing")
        ? query.state.error
          ? POLL_ERROR_INTERVAL_MS
          : POLL_INTERVAL_MS
        : false;
    },
  });

  const documentCount = documents?.length ?? 0;
  const flashcardCount = documents?.filter((doc) => doc.hasFlashcards).length ?? 0;
  const summaryCount = documents?.filter((doc) => doc.hasSummary).length ?? 0;
  const nextDocument = documents?.find((doc) => doc.status === "ready" && (!doc.hasSummary || !doc.hasFlashcards));
  const filteredDocuments = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (documents ?? []).filter((doc) => {
      const matchesQuery =
        !normalizedQuery ||
        `${doc.originalName} ${doc.filename} ${doc.fileType}`.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "ready" && doc.status === "ready") ||
        (filter === "summary" && doc.status === "ready" && !doc.hasSummary) ||
        (filter === "flashcards" && doc.status === "ready" && !doc.hasFlashcards);
      return matchesQuery && matchesFilter;
    });
  }, [documents, filter, query]);

  return (
    <AmbientWorkspaceBackground className="min-h-[100dvh]">
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between gap-4" aria-label={t("list.nav")}>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 text-sm text-text-secondary backdrop-blur-xl transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            {t("actions.backDashboard")}
          </Link>
          <span className="rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs text-text-muted backdrop-blur-xl">
            AI Docs
          </span>
          <Button
            type="button"
            variant="session"
            onClick={() => router.push("/study-tools/upload")}
            className="hidden h-10 rounded-full px-4 sm:inline-flex"
          >
            <Plus className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            {t("actions.uploadDocument")}
          </Button>
        </nav>

        <header className="grid gap-5 py-7 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-stretch lg:py-9">
          <div className="max-w-3xl">
            <p className="text-sm text-text-muted">{t("list.eyebrow")}</p>
            <h1 className="mt-3 max-w-3xl text-balance text-4xl font-light leading-tight text-text-primary sm:text-5xl">
              {t("list.headline")}
            </h1>
            <p className="mt-5 max-w-2xl text-base font-light leading-7 text-text-secondary">
              {t("list.description")}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="session"
                onClick={() => router.push("/study-tools/upload")}
                className="h-12 rounded-full px-6"
              >
                <UploadCloud className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                {t("actions.uploadDocument")}
              </Button>
              {nextDocument && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    router.push(
                      `/study-tools/${nextDocument.id}?tab=${nextDocument.hasSummary ? "flashcards" : "summary"}&intent=${
                        nextDocument.hasSummary ? "flashcards" : "summary"
                      }`
                    )
                  }
                  className="h-12 rounded-full px-6"
                >
                  <WandSparkles className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  {t("actions.continueFlow")}
                </Button>
              )}
            </div>
          </div>
          <Card className="rounded-[1.75rem] p-5">
            <div className="grid gap-3">
              <DeskMetric icon={FileText} label={t("list.documents")} value={documentCount} compact />
              <DeskMetric icon={CheckCircle2} label={t("list.summaries")} value={summaryCount} compact />
              <DeskMetric icon={Layers3} label={t("list.reviewDecks")} value={flashcardCount} compact />
            </div>
          </Card>
        </header>

        <section className="grid gap-3 lg:grid-cols-3" aria-label={t("list.flowAria")}>
          <FlowHint icon={UploadCloud} title={t("list.flow.upload")} description={t("list.flow.uploadDescription")} />
          <FlowHint icon={BookOpen} title={t("list.flow.read")} description={t("list.flow.readDescription")} />
          <FlowHint icon={Layers3} title={t("list.flow.review")} description={t("list.flow.reviewDescription")} />
        </section>

        <section className="mt-8 flex-1 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs text-text-muted">{t("list.shelf")}</p>
              <h2 className="mt-1 text-2xl font-light text-text-primary">{t("list.documentsForReview")}</h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="session"
                onClick={() => router.push("/study-tools/upload")}
                className="h-10 rounded-full px-4"
              >
                <Plus className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                {t("actions.uploadDocument")}
              </Button>
              <label className="relative block min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <span className="sr-only">{t("list.search")}</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("list.search")}
                  className="h-10 w-full rounded-full border border-white/10 bg-white/[0.045] pl-9 pr-4 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <div className="flex overflow-x-auto rounded-full border border-white/10 bg-white/[0.04] p-1">
                {(["all", "ready", "summary", "flashcards"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`h-8 whitespace-nowrap rounded-full px-3 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      filter === item
                        ? "bg-white/[0.14] text-text-primary"
                        : "text-text-muted hover:bg-white/[0.06] hover:text-text-primary"
                    }`}
                  >
                    {t(`list.filters.${item}`)}
                  </button>
                ))}
              </div>
            </div>
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
                {t("list.loadError")}
              </p>
            </Card>
          ) : !documents || documents.length === 0 ? (
            <Card className="rounded-[1.75rem] p-8 sm:p-10">
              <div className="mx-auto max-w-xl text-center">
                <BookOpen className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-2xl font-light text-text-primary">{t("list.emptyTitle")}</h3>
                <p className="mx-auto mt-3 max-w-md text-sm font-light leading-6 text-text-secondary">
                  {t("list.emptyDescription")}
                </p>
                <Button
                  type="button"
                  variant="session"
                  onClick={() => router.push("/study-tools/upload")}
                  className="mt-6 h-11 rounded-full px-6"
                >
                  <Plus className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                  {t("actions.uploadDocument")}
                </Button>
              </div>
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card className="rounded-[1.75rem] p-8">
              <div className="max-w-xl">
                <p className="text-lg font-light text-text-primary">{t("list.noMatchesTitle")}</p>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{t("list.noMatchesDescription")}</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDocuments.map((doc: StudyDocument) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onOpen={() => router.push(`/study-tools/${doc.id}`)}
                  onPrimaryAction={() =>
                    router.push(getNextHref(doc))
                  }
                  labels={{
                    pages: t("pages", { count: doc.pageCount ?? 0 }),
                    summary: t("summary"),
                    flashcards: t("flashcards"),
                    status: t(`status.${doc.status}`, { defaultValue: doc.status }),
                    nextAction: getNextActionLabel(doc, t),
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </AmbientWorkspaceBackground>
  );
}

type DeskMetricIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function DeskMetric({
  icon: Icon,
  label,
  value,
  compact = false,
}: {
  icon: DeskMetricIcon;
  label: string;
  value: number;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-text-muted">{label}</span>
        <Icon className="h-4 w-4 text-primary/80" aria-hidden />
      </div>
      <p className={`${compact ? "mt-2 text-2xl" : "mt-4 text-3xl"} font-mono font-light text-text-primary`}>{value}</p>
    </div>
  );
}

function FlowHint({
  icon: Icon,
  title,
  description,
}: {
  icon: DeskMetricIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/15 p-4 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
          <Icon className="h-4 w-4 stroke-[1.6]" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
        </div>
      </div>
    </div>
  );
}

function DocumentCard({
  document,
  onOpen,
  onPrimaryAction,
  labels,
}: {
  document: StudyDocument;
  onOpen: () => void;
  onPrimaryAction: () => void;
  labels: {
    pages: string;
    summary: string;
    flashcards: string;
    status: string;
    nextAction: string;
  };
}) {
  const progressItems = [
    { key: "ready", label: labels.status, active: document.status === "ready" },
    { key: "summary", label: labels.summary, active: document.hasSummary },
    { key: "flashcards", label: labels.flashcards, active: document.hasFlashcards },
  ];

  return (
    <Card
      className="group min-h-64 rounded-3xl p-5 transition-all duration-fast hover:-translate-y-1 hover:border-primary/30 hover:bg-white/[0.07]"
    >
      <div className="flex h-full flex-col justify-between gap-5">
        <button
          type="button"
          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
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
            {formatBytes(document.fileSizeBytes)} / {labels.pages}
          </p>
        </button>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
            {progressItems.map((item) => (
              <span
                key={item.key}
                className={`h-1.5 rounded-full ${item.active ? "bg-primary" : "bg-white/[0.12]"}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {progressItems.map((item) => (
              <ShelfBadge key={item.key} active={item.active}>{item.label}</ShelfBadge>
            ))}
          </div>
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex h-10 w-full items-center justify-center rounded-full border border-white/10 bg-white/[0.055] px-4 text-sm text-text-primary transition-all hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {labels.nextAction}
            <ArrowRight className="ml-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </button>
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

function getNextTab(document: StudyDocument) {
  if (!document.hasSummary) return "summary";
  return "flashcards";
}

function getNextHref(document: StudyDocument) {
  if (document.hasSummary && document.hasFlashcards) return `/study-tools/${document.id}/review`;
  const nextTab = getNextTab(document);
  return `/study-tools/${document.id}?tab=${nextTab}${
    document.status === "ready" ? `&intent=${nextTab}` : ""
  }`;
}

function getNextActionLabel(document: StudyDocument, t: (key: string) => string) {
  if (document.status !== "ready") return t("list.nextActions.processing");
  if (!document.hasSummary) return t("list.nextActions.summary");
  if (!document.hasFlashcards) return t("list.nextActions.flashcards");
  return t("list.nextActions.review");
}
