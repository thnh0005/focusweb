"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { documentsApi } from "@/services/documents.api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import type { StudyDocument } from "@/types/document.types";

type DocumentReaderProps = {
  document: StudyDocument;
};

export function DocumentReader({ document }: DocumentReaderProps) {
  const { t } = useTranslation("documents");
  const isPdf = document.fileType === "pdf";
  const hasSourceFile = Boolean(document.sourceFileUrl);
  const shouldLoadPdf = isPdf && hasSourceFile;
  const shouldLoadText = document.fileType === "txt" || document.fileType === "docx" || !hasSourceFile;

  const fileQuery = useQuery({
    queryKey: ["document-source-file", document.id],
    queryFn: () => documentsApi.getDocumentFileBlob(document.id),
    enabled: shouldLoadPdf,
    retry: false,
  });

  const textQuery = useQuery({
    queryKey: ["document-source-text", document.id],
    queryFn: () => documentsApi.getDocumentSourceText(document.id),
    enabled: shouldLoadText,
    retry: false,
  });

  const objectUrl = React.useMemo(() => {
    if (!fileQuery.data) return;
    return URL.createObjectURL(fileQuery.data);
  }, [fileQuery.data]);

  React.useEffect(() => {
    if (!objectUrl) return;
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const text = textQuery.data?.text?.trim() ?? "";
  const isLoading = fileQuery.isLoading || textQuery.isLoading;
  const isError = fileQuery.isError || textQuery.isError;

  return (
    <Card className="rounded-[2rem] p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-primary">
            <FileText className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-light text-text-primary">{t("reader.title")}</h2>
            <p className="text-sm text-text-muted">{document.originalName || document.filename}</p>
          </div>
        </div>
        {objectUrl && (
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-4"
            onClick={() => window.open(objectUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="mr-2 h-4 w-4 stroke-[1.6]" aria-hidden="true" />
            {t("reader.openNewTab")}
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex min-h-[360px] items-center justify-center gap-3 rounded-3xl border border-white/10 bg-black/20 text-sm text-text-muted">
          <Spinner className="h-4 w-4 text-primary" />
          {t("reader.loading")}
        </div>
      )}

      {!isLoading && isError && (
        <div role="alert" className="rounded-2xl border border-urgency-coral/25 bg-urgency-coral/10 p-4 text-sm text-urgency-coral">
          {t("reader.loadError")}
        </div>
      )}

      {!isLoading && !isError && shouldLoadPdf && objectUrl && (
        <iframe
          src={objectUrl}
          title={t("reader.frameTitle", { name: document.originalName || document.filename })}
          className="h-[70dvh] min-h-[520px] w-full rounded-3xl border border-white/10 bg-white"
        />
      )}

      {!isLoading && !isError && shouldLoadText && (
        <div className="max-h-[70dvh] min-h-[520px] overflow-auto rounded-3xl border border-white/10 bg-black/20 p-5">
          {text ? (
            <pre className="whitespace-pre-wrap break-words font-sans text-sm font-light leading-7 text-text-secondary">
              {text}
            </pre>
          ) : (
            <p className="text-sm text-text-muted">{t("reader.emptyText")}</p>
          )}
        </div>
      )}

      {!isLoading && !isError && !shouldLoadPdf && !shouldLoadText && (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-text-muted">
          {t("reader.unsupported")}
        </div>
      )}
    </Card>
  );
}
