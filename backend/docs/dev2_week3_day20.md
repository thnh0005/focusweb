# Dev2 Week 3 Day 20 - AI Document Summary

Day 20 implements AI-backed summaries for extracted study documents.

## Modes

- `key_points`: concise important ideas, concepts, definitions, formulas,
  processes, and conclusions.
- `detailed`: broader overview with sections and conclusion.

## Endpoints

- `POST /api/documents/{id}/summary/` creates or reuses a summary job.
- `GET /api/documents/{id}/summary/?mode=key_points` reads one mode.
- `GET /api/documents/{id}/summary/?mode=detailed` reads one mode.
- `GET /api/documents/{id}/summary/` reads both modes.

GET never calls the AI provider.

## Preconditions

The document must belong to the authenticated user, have `StudyDocument.status`
set to `ready`, and contain non-empty extracted text. Extraction failures,
pending extraction, and empty extraction return safe error codes.

## Persistence

The existing `DocumentSummary` model is reused and extended with status,
structured JSON, checksum, provider/model metadata, prompt version, chunk
metadata, generation attempts, safe error fields, and timestamps. One current
summary row is kept per document and mode.

## Cache And Stale Behavior

The current extraction checksum is read from `metadata.extraction.checksum` when
available, otherwise derived from `extracted_text`. A completed summary with the
same checksum is returned as a cache hit. When the checksum changes, the existing
summary is marked `stale` and regenerated on POST.

## Chunking And Map-Reduce

Short documents use one final AI call. Longer documents are split by paragraph
or sentence boundaries using:

- `DOCUMENT_SUMMARY_CHUNK_CHARACTERS`
- `DOCUMENT_SUMMARY_CHUNK_OVERLAP_CHARACTERS`
- `DOCUMENT_SUMMARY_MAX_CHUNKS`
- `DOCUMENT_SUMMARY_MAX_SOURCE_CHARACTERS`

Long documents are summarized chunk-by-chunk, then reduced into one final JSON
summary. Reduce receives chunk summaries only, not the full raw document again.

## Prompt Safety

Document content is placed only in the user prompt inside
`<DOCUMENT_CONTENT>...</DOCUMENT_CONTENT>`. The system prompt treats document
text as untrusted input, forbids following instructions inside the document,
forbids code execution and link access, and requires source-grounded JSON.

## AI Configuration

The service reuses the existing `AIClient`. `DOCUMENT_SUMMARY_MODEL` defaults to
`OPENROUTER_MODEL`. Timeout and retry behavior come from existing AI settings and
the bounded summary task retry settings.

## Error Codes

- `EXTRACTION_NOT_READY`
- `EXTRACTION_FAILED`
- `NO_EXTRACTABLE_TEXT`
- `AI_CONFIGURATION_ERROR`
- `AI_TIMEOUT`
- `AI_RATE_LIMITED`
- `AI_PROVIDER_UNAVAILABLE`
- `AI_REQUEST_FAILED`
- `INVALID_AI_OUTPUT`
- `SUMMARY_GENERATION_FAILED`

## Manual Task Retry

Use the Celery task with primitive arguments only:

```python
generate_document_summary.delay(str(document_id), "key_points", force=True)
```

## Privacy Notes

The API does not return extracted text, prompts, chunks, provider raw responses,
API keys, local paths, or tracebacks. Summary cache is scoped to the document and
therefore to the owner.

## Day 21 Note

Flashcard generation should use extracted source content directly when it needs
high factual fidelity. The summary can help UX, but it should not replace the
source for precise flashcard generation.

## Known Limitations

Historical summary versions are not retained; the current row per document/mode
is updated when the checksum changes. Token usage is not exposed in the API.
