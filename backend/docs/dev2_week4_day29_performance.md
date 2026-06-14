# Dev2 Week 4 Day 29 Performance and Reliability Hardening

Date: 2026-06-14
Branch observed: main
Commit observed: 2cf8910 Merge dev1 into main

## Scope

Inspected Dev2-owned or Dev2-adjacent backend paths:

- `apps/tracking` event ingest and behavior rule evaluation.
- `apps/extension` heartbeat and active-session sync.
- `apps/scoring` realtime score service.
- `apps/ai` AI client, document summary, flashcard generation, and task boundaries.
- `apps/recommendations` pattern and recommendation services.
- `apps/notifications` scanner and single-user task.
- `apps/analytics` study report export worker.
- `apps/users` account export/delete workers.
- `config/settings.py` and Celery task configuration by usage.

Frontend, Dev1 CRUD flows, and full backend regression were intentionally out of scope.

## Baseline and Query Inventory

| Flow | Query/filter shape | Existing index/support | Finding |
|------|--------------------|------------------------|---------|
| Event batch rule evaluation | blacklist entries by default/user, repeated for each event | blacklist unique constraints, no in-memory batch cache | N+1 blacklist lookup inside batch rule evaluation |
| Realtime Focus Score | `BrowserEvent(session_id, created_at)` plus `AIAnalysisResult(session_id, browser_event_id, created_at)` | event index exists; AI result session index exists | 50-event score calculation uses 2 querysets in test |
| Active session sync | `FocusSession(user_id, status)` ordered by started time | `(user, status)`, `(user, started_at)` | No change; response is narrow serializer path |
| Pattern detection | completed sessions by user/date, warning/browser aggregate by session IDs | session user/date indexes, warning session indexes | Existing implementation already bulk aggregates most data |
| Recommendation | reuses `pattern_data` when provided | service argument support exists | No code change needed |
| Notification scanner | active users with `select_related("preferences", "profile")` | user active implicit table scan in local schema | Existing scanner chunks iterator; single-user task needed deleted-user handling |
| Document summary | document/mode unique constraint, checksum check | unique `(document, mode)` | Day 28 cache behavior retained |
| Flashcards | fingerprint lookup and bulk card create | fingerprint index | Day 28 stale invalidation retained |
| Report/account workers | job ID lookup inside task service | primary key | Missing jobs retried/raised before hardening |

## Changes

### Query/N+1 Fixes

- `BlacklistRepository` now caches available blacklist entries per user for the lifetime of the repository instance.
- `EventIngestService` already creates a single `BehaviorRuleEngine` per batch, so a batch now performs one blacklist query instead of one per event.
- Added regression coverage proving 50 rule evaluations use exactly 1 blacklist query.

### Async Task Hardening

- `generate_notification_for_user` now returns a safe skipped result when the user no longer exists.
- `generate_notification_for_user` now returns a safe failed result for unknown notification types instead of raising `KeyError`.
- `generate_study_report_export_task` now returns a non-retryable skipped result when the report job no longer exists.
- `generate_account_data_export_task` now returns a non-retryable skipped result when the export job no longer exists.
- `delete_account_data_task` now returns a non-retryable skipped result when the deletion job no longer exists.

### AI Retry Policy

- Verified `AIClient` retries retryable HTTP 429 according to `max_retries`.
- Verified HTTP 400 is treated as a non-retryable provider/business error and is not retried.
- Tests use mocked `urlopen`; no real OpenRouter or external AI call was made.

## Before/After Results

- Behavior rule blacklist lookup before: code path performed `BlacklistEntry.objects.available_to(user)` inside each `find_match` call, so a 50-event batch could issue 50 blacklist queries.
- Behavior rule blacklist lookup after: 50 event evaluations issue 1 blacklist query.
- Realtime score 50-event test: score calculation completed with at most 2 queries for events and AI analyses.
- Missing report/account worker records after: task returns `status=skipped`, `retryable=False`.
- Missing notification user after: task returns `status=skipped`, `error_code=USER_NOT_FOUND`.

## Index Status

No new index migration was added. Existing indexes matched the fixed paths:

- `BrowserEvent(session_id, created_at)`
- `WarningEvent(session_id, created_at)`
- `WarningCycle(session_id, status)`
- `FocusSession(user, status)` and `FocusSession(user, started_at)`
- `ReportExportJob(user, generation_fingerprint)` unique constraint
- `AccountDataExportJob(user, generation_fingerprint)` unique constraint
- `FlashcardDeck(generation_fingerprint)`
- `DocumentSummary(document, mode)` unique constraint

## Targeted Tests

Commands executed with `DJANGO_SECRET_KEY=day29-test-secret` and `DATABASE_ENGINE=sqlite`:

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check
.\.venv\Scripts\python.exe manage.py showmigrations
.\.venv\Scripts\python.exe manage.py test apps.ai.test_day29_performance --verbosity 2
.\.venv\Scripts\python.exe manage.py test apps.ai.test_day28_integration --verbosity 2
```

Results:

- Django system check: PASS, 0 issues.
- Migration check: PASS, no changes detected.
- Day 29 targeted tests: PASS, 5 tests.
- Day 28 directly affected integration tests: PASS, 5 tests.
- Failed/skipped targeted tests: none.

## Known Limitations

- Production PostgreSQL query plans were not tested because this local run used SQLite.
- No load test was run against production-like data.
- Notification scanner query count was inspected by code and existing chunking behavior, not benchmarked with a large user table.
- Pattern/recommendation/weekly report services were inspected and left unchanged because current code already uses aggregate/bulk query patterns for the checked paths.
- Queue routing was not changed; deployment can still route AI, document, notification, report, and account tasks separately if worker topology supports it.

## Tests Intentionally Not Executed

- Full backend regression suite was not run.
- Dev 1 full feature tests were not run.
- Frontend tests were not run.
- Production PostgreSQL query plans were not tested.
- Production Redis/Celery workers were not used.
- Production storage was not used.
- No real OpenRouter or external AI call was made.
- Full project regression and final release validation are deferred to Day 30.

## Readiness

Overall status: PASS for scoped Dev2 Day 29 performance/reliability hardening.

READY TO COMMIT for the scoped Day 29 changes after reviewing the broader dirty working tree.
