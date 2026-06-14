# Dev 2 Week 4 Day 27 QA

## Repository State

- Branch checked: `main`
- Recent commits checked:
  - `2cf8910 Merge dev1 into main`
  - `dcadb98 Merge origin/dev1 into dev1`
  - `daa3f91 dev2 week2`
  - `08783e3 ND tuần 4`
  - `08783e3 ND tuần 3`
- Working tree: dirty before Day 27 started, with existing Dev 2/Dev 1 week work across AI, analytics, sessions, users, notifications, recommendations, docs, settings, and requirements.
- No reset, clean, rebase, merge, checkout, push, or commit was performed.

## QA Scope

Day 27 covered Dev 2 backend areas only:

- Tracking and extension integration.
- Semantic AI and AI client error mapping.
- Behavior rule engine.
- Hybrid decision engine.
- Realtime focus score.
- Warning cycle.
- AI session insight.
- Pattern detection.
- Recommendation engine.
- Weekly report generator.
- Notification scheduler.
- Document extraction.
- Document summary.
- Flashcard generation.
- Day 25 study report export worker.
- Day 26 account export/deletion workers.

## Inventory

| Domain | Service/Task | Endpoint | Test module | Status |
|---|---|---|---|---|
| Tracking privacy | `privacy.py`, ingest validation | `POST /api/tracking/events/` | `apps.tracking.tests` | PASS |
| Event ingest | `EventIngestService` | `POST /api/tracking/events/` | `apps.tracking.tests` | PASS |
| Extension heartbeat | extension views/models | extension heartbeat endpoints | `apps.extension.tests` | PASS |
| Active session sync | extension/session integration | extension active-session endpoints | `apps.extension.tests` | PASS |
| Rule engine | `BehaviorRuleEngine` | ingest driven | `apps.tracking.tests` | PASS |
| Warning cycle | `WarningCycleService` | session warnings endpoints | `apps.tracking.tests` | PASS |
| Scoring | score calculators | realtime score endpoint | `apps.scoring.tests`, `apps.sessions.tests.RealtimeScoreApiTests` | PASS |
| Semantic AI | `SemanticAnalysisService`, `AIClient` | AI/tracking flow | `apps.ai.tests` | PASS |
| AI insight | `SessionInsightService`, task | session insight endpoints | `apps.ai.tests`, `apps.sessions.tests.SessionAIInsightApiTests` | PASS |
| Documents | parser/extraction service/task | document endpoints | `apps.ai.tests` | PASS |
| Summary | `DocumentSummaryService`, task | document summary endpoints | `apps.ai.tests` | PASS after fix |
| Flashcards | `FlashcardGenerationService`, task | flashcard endpoints | `apps.ai.tests` | PASS |
| Patterns | pattern service/API | recommendations endpoints | `apps.recommendations.tests` | PASS |
| Recommendations | recommendation/smart preset services | recommendation endpoints | `apps.recommendations.tests` | PASS |
| Weekly report | `WeeklyFocusReportService`, task | weekly snapshot | `apps.recommendations.tests` | PASS |
| Notifications | notification services/tasks | notification endpoints | `apps.notifications.tests.test_day18` | PASS |
| Study report export | Day 25 export service/tasks | report export endpoint | `apps.analytics.test_day25_export` | PASS |
| Account export/delete | Day 26 services/tasks | account endpoints | `apps.users.test_day26_account_jobs` | PASS |

## Commands Executed

```powershell
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py check
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py makemigrations --check
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py showmigrations tracking extension ai scoring recommendations notifications analytics users
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py test apps.tracking.tests apps.extension.tests
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py test apps.scoring.tests apps.ai.tests
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py test apps.ai.tests.DocumentApiTests apps.ai.tests.DocumentSummaryDay20Tests
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py test apps.scoring.tests apps.ai.tests
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py test apps.sessions.tests.RecentLearningContextDay23Tests apps.sessions.tests.RealtimeScoreApiTests apps.sessions.tests.SessionAIInsightApiTests apps.recommendations.tests
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py test apps.notifications.tests.test_day18
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py test apps.analytics.test_day25_export apps.users.test_day26_account_jobs
```

Final checks were rerun after the fix:

```powershell
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py check
$env:DJANGO_SECRET_KEY='local-day27-check'; $env:DATABASE_ENGINE='sqlite'; .\.venv\Scripts\python.exe manage.py makemigrations --check
git status --short
git diff --stat
```

## Test Results

Final scoped pass totals:

- Tracking + extension: 60 tests passed.
- AI + scoring: 109 tests passed.
- Sessions/coaching/recommendations: 85 tests passed.
- Notifications: 31 tests passed.
- Day 25 + Day 26 async jobs: 18 tests passed.

Final selected Dev 2 coverage total: 303 passing tests.

During QA, one failing run occurred before the fix:

- `apps.scoring.tests apps.ai.tests`: 109 tests run, 1 error.

A focused rerun after the fix passed:

- `apps.ai.tests.DocumentApiTests apps.ai.tests.DocumentSummaryDay20Tests`: 15 tests passed.

## Bug Found

Document summary single-mode `GET /api/documents/{id}/summary/?mode=detailed` had a response contract regression:

- Older document library flow expected top-level `documentId` and `content`.
- Day 20 summary status flow expected a `summary` wrapper.
- The endpoint returned only one shape, causing one test failure.

## Bug Fixed

Files changed for Day 27:

- `apps/ai/serializers.py`
- `apps/ai/views.py`

Fix:

- Added `documentId` camelCase alias to `DocumentSummarySerializer`.
- Restored fallback summary creation for single-mode GET without calling AI.
- Single-mode GET now returns additive compatibility data:
  - top-level summary fields.
  - `documentId`.
  - `extraction_status`.
  - nested `summary`.

This keeps both the legacy library contract and the Day 20 async summary contract working.

## Migration Status

- `manage.py check`: PASS.
- `manage.py makemigrations --check`: PASS, no model changes pending.
- `showmigrations` shows unapplied migration files in the dirty worktree:
  - `ai.0003`, `ai.0004`
  - `analytics.0002`
  - `users.0003`, `users.0004`
- Existing local SQLite migrate limitation remains from prior days: `ai.0003_documentsummary...` fails against the existing local DB because `ai_documentsummary` is missing. Test database setup succeeds for scoped test runs.

## External Calls

- No real OpenRouter or external AI provider call was made.
- AI client network paths are tested with patched `urlopen` or fake clients.
- Notification tests did not send real email.
- No Spotify/YouTube/API fetch was performed.

## Privacy And Security Findings

- Tracking tests verify sensitive field rejection and warning responses do not expose raw browsing content.
- AI/session insight tests verify prompt/raw provider response is not exposed.
- Recommendation and weekly report tests verify URLs are not leaked in user-facing aggregate responses.
- Day 25 report export tests verify no full URL/title/meta/snippet leaks.
- Day 26 account export intentionally includes user-owned browser/document content for GDPR export, but excludes password hashes, session keys, internal paths, and raw provider responses.
- Source search found notification error logging in a tested transient-failure path; the logged message does not include user content/secrets.

## Task And Idempotency Findings

- AI document extraction, summary, flashcard, session insight task paths passed scoped tests.
- Weekly report task accepts primitive user ID and reruns without persistence duplicates.
- Notification task wrappers are callable and dedupe keys prevent duplicate notification creation.
- Warning cycle duplicate/retry tests passed.
- Day 25 report export job idempotency passed.
- Day 26 account export/delete worker idempotency and cleanup tests passed.

## Query And Performance Notes

- Scoped tests did not reveal N+1 regressions severe enough to fail current contracts.
- Export jobs use Django storage and temporary files where implemented.
- Document summary/flashcard flows use chunking and mocked AI clients in tests.

## Tests Not Run

- Full backend test suite was not run.
- Dev 1 full Auth/Profile/Session CRUD tests were not run.
- Dev 1 full Dashboard/Analytics tests were not run.
- Dev 1 Swagger/Postman work was not tested.
- Frontend tests were not run.
- Real OpenRouter/AI provider calls were not made.
- Final full-project regression remains deferred to the final integration/QA day.

## Readiness

Overall Day 27 scoped QA status: PASS for selected Dev 2 test scope.

Repository readiness: NOT READY TO COMMIT until the broader dirty worktree and existing local migration limitation are reviewed as part of final integration.
