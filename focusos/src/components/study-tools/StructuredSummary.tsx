"use client";

import * as React from "react";
import type {
  DocumentSummary,
  DocumentSummaryStructuredContent,
} from "@/types/document.types";

interface StructuredSummaryProps {
  summary?: DocumentSummary | null;
  emptyText?: string;
}

export function StructuredSummary({
  summary,
  emptyText = "No summary exists yet. Generate one when you are ready.",
}: StructuredSummaryProps) {
  const structured = summary?.structuredContent ?? summary?.structured_content;

  if (hasKeyPoints(structured)) {
    return (
      <div className="space-y-3">
        {structured.key_points.map((item, index) => (
          <section
            key={`${item.title}-${index}`}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <h3 className="text-sm font-medium text-text-primary">{item.title}</h3>
            <p className="mt-2 text-sm font-light leading-6 text-text-secondary">
              {item.content}
            </p>
          </section>
        ))}
      </div>
    );
  }

  if (hasDetailedSections(structured)) {
    return (
      <article className="space-y-5 text-text-secondary">
        {structured.title && (
          <header>
            <h3 className="text-2xl font-light text-text-primary">{structured.title}</h3>
            {structured.overview && (
              <p className="mt-3 text-base font-light leading-8">{structured.overview}</p>
            )}
          </header>
        )}
        {structured.sections.map((section, index) => (
          <section key={`${section.heading}-${index}`}>
            <h4 className="text-base font-medium text-text-primary">{section.heading}</h4>
            <p className="mt-2 text-sm font-light leading-7">{section.content}</p>
          </section>
        ))}
        {structured.conclusion && (
          <section className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <h4 className="text-sm font-medium text-primary">Conclusion</h4>
            <p className="mt-2 text-sm font-light leading-7 text-text-secondary">
              {structured.conclusion}
            </p>
          </section>
        )}
      </article>
    );
  }

  const content = summary?.content?.trim();
  if (content) {
    return (
      <article className="max-w-none whitespace-pre-wrap text-base font-light leading-8 text-text-secondary">
        {content}
      </article>
    );
  }

  return <p className="text-sm text-text-muted">{emptyText}</p>;
}

function hasKeyPoints(
  value?: DocumentSummaryStructuredContent
): value is { key_points: Array<{ title: string; content: string }> } {
  if (!value || !("key_points" in value) || !Array.isArray(value.key_points)) {
    return false;
  }
  return value.key_points.some(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "title" in item &&
      "content" in item
  );
}

function hasDetailedSections(
  value?: DocumentSummaryStructuredContent
): value is {
  title?: string;
  overview?: string;
  sections: Array<{ heading: string; content: string }>;
  conclusion?: string;
} {
  if (!value || !("sections" in value) || !Array.isArray(value.sections)) {
    return false;
  }
  return value.sections.some(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "heading" in item &&
      "content" in item
  );
}
