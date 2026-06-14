# Dev2 Week 3 Day 21 - AI Flashcard Generation

Day 21 adds AI flashcard generation from extracted document text. The source of
truth is always `StudyDocument.extracted_text`; document summaries are not used
as the default source.

## Endpoint

`POST /api/documents/{id}/flashcards/generate/`

Example full document request:

```json
{"scope":"full_document","quantity":10,"difficulty":"medium"}
```

Example page range request:

```json
{"scope":"page_range","page_start":3,"page_end":7,"quantity":10,"difficulty":"hard"}
```

Example section request:

```json
{"scope":"section","section_start":2,"section_end":4,"quantity":5,"difficulty":"easy"}
```

The endpoint requires authentication and document ownership. It never accepts
raw document text, custom prompts, provider URLs, API keys, or model names from
the client.

## Scopes

- `full_document`: uses all extracted text.
- `page_range`: uses Day 19 `page_map`; unsupported when a reliable page map is
  unavailable.
- `section`: uses `metadata.extraction.section_map`; unsupported when absent.

## Difficulty

- `easy`: definitions, terms, facts, basic formulas, one-step answers.
- `medium`: explanations, relationships, cause/effect, simple applications.
- `hard`: analysis, comparison, application, synthesis, and trade-offs grounded
  in source text.

## Validation

Quantity is bounded by `FLASHCARD_GENERATION_MIN_QUANTITY` and
`FLASHCARD_GENERATION_MAX_QUANTITY`. Output must be JSON:

```json
{
  "language": "vi",
  "difficulty": "medium",
  "flashcards": [{"question": "string", "answer": "string"}],
  "warnings": []
}
```

The validator trims text, removes empty cards, strips HTML tags, deduplicates
questions/pairs, rejects question-equals-answer, enforces quantity, and performs
a lightweight source-grounding keyword overlap check.

## Chunking

Long selected source text reuses the Day 20 `DocumentChunker`, configured with
`FLASHCARD_GENERATION_CHUNK_CHARACTERS` and `FLASHCARD_GENERATION_MAX_CHUNKS`.
Quantity is allocated across chunks by character count. A single bounded fill
pass can request missing cards without fabricating placeholders.

## Persistence

Existing Dev 1 `FlashcardDeck` and `Flashcard` models are reused. `FlashcardDeck`
stores generation status, requested/generated counts, scope metadata, source
checksum, fingerprint, provider/model, prompt version, attempts, and safe error
fields.

## Cache And Idempotency

Generation fingerprint includes document owner, document ID, selected source
checksum, scope, difficulty, quantity, and prompt version. Same fingerprint
returns an existing completed/partial deck. Repeated pending/processing requests
return existing status. Changed source checksum marks matching old decks stale.

## Async Task

`generate_document_flashcards(document_id, config, force=False)` accepts primitive
values only and loads the document internally.

## Privacy

The API does not return extracted text, AI prompts, chunk text, raw provider
responses, API keys, local paths, or tracebacks. It does not execute code or open
URLs found in documents.

## Known Limitations

Grounding is lightweight keyword overlap, not semantic verification. No embedding
or vector database is used. Historical deck versions are kept as separate deck
rows when configuration/fingerprint changes.
