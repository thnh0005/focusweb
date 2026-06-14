# Dev2 Week 4 Day 28 Integration Test

Date: 2026-06-14
Branch observed: main

## Scope

Day 28 adds scoped integration coverage for the Dev2 backend flows without adding new product features.

Flow A covers:

- User creates a Deep Work `FocusSession` through the sessions API.
- Extension heartbeat records/updates connection state.
- Extension active-session sync returns the active session and avoids raw browsing payloads.
- Browser event batch ingest persists accepted events and rejects sensitive fields.
- Semantic AI analysis runs through the provider boundary with `AIClient.complete_json` mocked.
- Rule engine and hybrid decision output feed the warning cycle.
- Warning levels 1, 2, and 3 are persisted.
- Deep Work warning level 3 emits `auto_pause_required` with `AUTO_PAUSE`.
- Realtime Focus Score is available through the real session score endpoint.
- A second user receives 404 for another user's warning and score endpoints.

Flow B covers:

- TXT document upload through `/api/documents/upload/`.
- Real text extraction and `StudyDocument` persistence.
- Summary request through `/api/documents/{id}/summary/`.
- Celery enqueue boundary through `transaction.on_commit`, with `.delay` mocked.
- Summary task body execution with `AIClient.complete_json` mocked.
- Flashcard generation request through `/api/documents/{id}/flashcards/generate/`.
- Flashcard task body execution with mocked AI provider.
- `FlashcardDeck` and `Flashcard` persistence.
- Cache-hit behavior for identical flashcard generation config.
- A second user receives 404 for another user's document summary and flashcard generation.

Additional boundary coverage:

- Event ingest survives AI provider failure and falls back to rule-only hybrid decisions without returning 500.
- Async task signatures are checked to avoid request/user/model-object/raw-prompt payloads.
- Cross-owner active-session sync returns no active session for `user_b`.
- Cross-owner event ingest into `user_a`'s session is blocked by the existing permission contract.
- Repeated summary generation with the same extraction checksum returns a cache hit and does not enqueue Celery.
- Re-extraction with a new checksum invalidates summary and flashcard cache state.
- Flashcard generation deduplicates repeated questions, ignores empty cards, and records a partial deck when AI output is insufficient.
- Deleted-document summary/flashcard tasks return non-retryable skipped results instead of raising.

## Files

- `apps/ai/test_day28_integration.py`
- `docs/dev2_week4_day28_integration.md`

## Commands

```powershell
$env:DJANGO_SECRET_KEY='day28-test-secret'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py check
$env:DJANGO_SECRET_KEY='day28-test-secret'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py makemigrations --check
$env:DJANGO_SECRET_KEY='day28-test-secret'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py showmigrations
$env:DJANGO_SECRET_KEY='day28-test-secret'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py test apps.ai.test_day28_integration --verbosity 2
git status --short
git diff --stat
```

Result: PASS, 5 tests.

Final command results:

- Django system check: PASS, 0 issues.
- Migration check: PASS, no model changes detected.
- Migration list under SQLite: command succeeded; local `db.sqlite3` has unapplied Week 4 migrations for `ai`, `analytics`, and `users`, while the Day 28 test database applied all migrations successfully.
- Day 28 integration tests: PASS, 5 tests, 0 failures, 0 skipped.

## External Boundaries Mocked

- Semantic AI provider: `AIClient.complete_json`.
- Document summary AI provider: `AIClient.complete_json`.
- Flashcard generation AI provider: `AIClient.complete_json`.
- Celery broker/result backend: `.delay` mocked at view enqueue boundaries.
- Warning-cycle async scheduling: `WarningCycleService.schedule_advance` mocked while asserting service advancement directly.

## Findings

- Production bug fixed: document summary and flashcard Celery task boundaries now return safe, non-retryable `DOCUMENT_NOT_FOUND` skipped results when the document record has been deleted before the worker loads it.
- Production bug fixed: flashcard stale-cache invalidation no longer depends on exact mutable JSON `scope` matching, so a new extraction checksum correctly marks prior completed/partial decks stale before creating a fresh pending deck.
- The first local test run briefly attempted Redis because the test mock ended before captured `on_commit` callbacks executed. The test was corrected so Celery remains mocked during callback execution.
- Deep Work warning level 3 currently emits an auto-pause signal and keeps the `FocusSession` active. This matches the existing service tests and current implementation; it does not perform the actual session status transition.
- Cross-owner event ingest currently returns `403 Forbidden`; warning, score, summary, and flashcard resource access return `404 Not Found`.

## Files Created

- `apps/ai/test_day28_integration.py`
- `docs/dev2_week4_day28_integration.md`

## Files Modified In This Pass

- `apps/ai/tasks.py`
- `apps/ai/services/flashcard_generation.py`
- `apps/ai/test_day28_integration.py`
- `docs/dev2_week4_day28_integration.md`

## Known Limitations

- Full backend test suite was intentionally not run per Day 28 instruction.
- Dev1 full Auth/Session/Dashboard/Analytics integration flow was not run.
- Frontend tests were not run.
- A real Chrome Extension was not launched.
- Production Redis/Celery workers were not used.
- Production storage was not used.
- No real OpenRouter or external AI provider call was made.
- Final full-project regression remains deferred to the final QA days.
- Local non-test `manage.py migrate` has an existing SQLite migration-order limitation reported in prior Day 27 notes. Test database migrations still apply cleanly.
- The repository remains dirty with broader Week 4 changes and untracked files, so this is not a clean release/merge readiness signal by itself.

## Readiness

Overall status: PASS for scoped Dev2 Day 28 integration coverage.

READY TO COMMIT for the scoped Day 28 files after reviewing the broader dirty working tree.
