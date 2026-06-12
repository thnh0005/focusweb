# Dev 2 Week 2 Integrated Audit

## Scope

This audit covers Dev 2 Week 2 Day 8 through Day 14:

- Day 8: Behavior Rule Engine
- Day 9: Semantic AI Service
- Day 10: Hybrid Decision Engine
- Day 11: Realtime Rolling Focus Score API
- Day 12: Warning Cycle Service and warning log API
- Day 13: AI Session Insight async job and APIs
- Day 14: AI fallback, provider resilience, circuit breaker, degraded mode, and integration hardening

Frontend and Week 3 work are out of scope.

## Implementation Inventory

### Models

- `apps.tracking.models.BrowserEvent`
- `apps.tracking.models.EventBatch`
- `apps.tracking.models.WarningEvent`
- `apps.tracking.models.WarningCycle`
- `apps.ai.models.AIAnalysisResult`
- `apps.ai.models.SessionInsight`
- `apps.scoring.models.FocusScore`
- `apps.scoring.models.ScoreComponent`
- `apps.extension.models.ExtensionHeartbeat`
- `apps.extension.models.BlacklistEntry`
- `apps.sessions.models.FocusSession`

### Services

- `apps.tracking.services.behavior_rule_engine.BehaviorRuleEngine`
- `apps.tracking.services.event_ingest_service.EventIngestService`
- `apps.tracking.services.warning_cycle_service.WarningCycleService`
- `apps.tracking.services.privacy_validator.PrivacyValidator`
- `apps.ai.services.ai_client.AIClient`
- `apps.ai.services.semantic_service.SemanticAnalysisService`
- `apps.ai.services.session_insight_service.SessionInsightService`
- `apps.ai.services.circuit_breaker.AICircuitBreaker`
- `apps.scoring.hybrid_decision_engine.HybridDecisionEngine`
- `apps.scoring.realtime_score_service.RealtimeScoreService`
- `apps.scoring.realtime_score.RealtimeScoreCalculator`

### Tasks

- `apps.tracking.tasks.advance_warning_cycle`
- `apps.ai.tasks.generate_session_insight`

### Endpoints

- `POST /api/sessions/{id}/events/batch/`
- `GET /api/sessions/{id}/score/realtime/`
- `GET /api/sessions/{id}/warnings/`
- `GET /api/sessions/{id}/ai-insight/`
- `POST /api/sessions/{id}/ai-insight/retry/`

### Settings

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_BASE_URL`
- `AI_REQUEST_TIMEOUT_SECONDS`
- `AI_MAX_RETRIES`
- `AI_RETRY_BACKOFF_SECONDS`
- `AI_CIRCUIT_FAILURE_THRESHOLD`
- `AI_CIRCUIT_COOLDOWN_SECONDS`
- `SESSION_INSIGHT_TASK_MAX_RETRIES`
- `SESSION_INSIGHT_TASK_RETRY_BACKOFF_SECONDS`
- `AI_INSIGHT_MAX_RETRIES`
- `AI_INSIGHT_RETRY_BACKOFF_SECONDS`
- `SESSION_INSIGHT_MANUAL_RETRY_LIMIT`
- `SESSION_INSIGHT_STALE_PROCESSING_SECONDS`
- `REALTIME_SCORE_WINDOW_SECONDS`
- `REALTIME_SCORE_STALE_SECONDS`
- `REALTIME_SCORE_MIN_EVENTS`
- `REALTIME_SCORE_TAB_SWITCH_PENALTY`
- `WARNING_INTERVAL_SECONDS`
- `WARNING_MAX_LEVEL`

## Requirement Matrix

| Day | Area | Verdict | Evidence |
| --- | --- | --- | --- |
| Day 8 | Behavior Rule Engine | PASS | Blacklist, idle, tab-switch, domain normalization, ownership, deterministic behavior, and no-AI tests pass in `apps.tracking`. |
| Day 9 | Semantic AI Service | PASS | Eligibility, prompt privacy, parsing, clamping, retry, timeout, idempotent persistence, and degraded metadata are covered in `apps.ai` and `apps.tracking`. |
| Day 10 | Hybrid Decision Engine | PASS | Deep Work matrix, Normal Mode rule-only mapping, semantic unavailable fallback, no DB/provider side effects, and non-mutation tests pass in `apps.scoring`. |
| Day 11 | Realtime Score | PASS | Endpoint routing, ownership, active/paused policy, insufficient/partial/sufficient data, no provider/warning/session side effects, and component math tests pass. |
| Day 12 | Warning Cycle | PASS | Warning 1/2/3, no Warning 4, resolve, auto-pause signal only, idempotency, and GET no-side-effect tests pass. |
| Day 13 | AI Session Insight | PASS | Async enqueue after commit, one row per session, fallback, retry API conflicts, owner scoping, and completed no-op tests pass. |
| Day 14 | Fallback and Resilience | PASS WITH FIXES | AI unknown-error taxonomy and event ingest degraded behavior were hardened and regression-tested. |

## Endpoint Matrix

| Endpoint | Auth | Owner scoped | Side effects | Verdict |
| --- | --- | --- | --- | --- |
| `POST /api/sessions/{id}/events/batch/` | Required | Yes | Persists valid events, runs rule/AI/hybrid/warning pipeline | PASS |
| `GET /api/sessions/{id}/score/realtime/` | Required | Yes | Read-only | PASS |
| `GET /api/sessions/{id}/warnings/` | Required | Yes | Read-only | PASS |
| `GET /api/sessions/{id}/ai-insight/` | Required | Yes | Read-only | PASS |
| `POST /api/sessions/{id}/ai-insight/retry/` | Required | Yes | Queues retry after commit when accepted | PASS |

## Model And Migration Matrix

| Area | Migration coverage | Constraints/indexes | Verdict |
| --- | --- | --- | --- |
| Tracking events | `tracking.0001` | Session/time and event indexes | PASS |
| Warning events | `tracking.0002`, `0003`, `0004` | Level check, unique warning level per cycle, active cycle uniqueness | PASS |
| AI analysis | `ai.0001` | Session/time, relevance, focus state, relevance boolean indexes | PASS |
| Session insight | `ai.0002` | OneToOne session relation and status/update index | PASS |
| Scoring | `scoring.0001`, `0002` | Score/component constraints | PASS |
| Extension blacklist | `extension.0002` | Default/custom ownership and uniqueness constraints | PASS |

`makemigrations --check` reported no changes. `migrate` reported no migrations to apply.

## Security And Privacy Findings

- Week 2 APIs are authenticated.
- Session-scoped APIs use owner-filtered lookups and return 404 for other users where the existing convention requires it.
- Event ingest rejects unsupported and sensitive fields before persistence.
- Warning and insight responses do not expose snippets, raw provider payloads, prompts, stack traces, auth headers, cookies, or API keys.
- AI structured logging only keeps safe fields such as provider, operation, IDs, error code, retryability, fallback state, latency, and circuit state.

## Async And Idempotency Findings

- Warning cycle advancement uses Celery countdown and does not block with sleep.
- Warning cycle writes are protected by active-cycle and warning-level uniqueness constraints plus `select_for_update`.
- Session insight is enqueued with `transaction.on_commit`.
- Session insight task accepts a primitive session ID and uses one `SessionInsight` row per session.
- Completed AI insight reruns are no-ops.
- Automatic insight retry is bounded by Celery settings; the provider client is configured with no nested retry for insight work.

## Integration Findings

### Deep Work

The integrated Deep Work path is connected:

1. Authenticated user has an active Deep Work session with a goal.
2. Extension event batch is validated for privacy.
3. Valid `BrowserEvent` rows persist before AI work.
4. Rule Engine evaluates blacklist/idle/tab-switch signals.
5. Semantic AI can persist `AIAnalysisResult`.
6. Hybrid Decision combines rule and semantic outputs.
7. Only `DISTRACTED` starts a warning cycle.
8. Realtime Score reads the persisted event and AI analysis without calling the provider.
9. Warning API returns persisted warnings.
10. Session end enqueues insight after commit.
11. Insight fallback completes when provider work is unavailable.
12. Cross-user access is denied.

### Normal Mode

Normal Mode remains rule-only:

- Semantic AI is skipped.
- Provider configuration does not affect Normal Mode ingest.
- HIGH deterministic rules can produce `DISTRACTED`.
- Warning 3 completes without forced pause.
- Realtime Score does not require AI.
- No unnecessary semantic `AIAnalysisResult` is created.

## Bugs Fixed During Audit

### AI unknown exception taxonomy

- Severity: Medium
- Area: Day 14 fallback and provider resilience
- Files: `apps/ai/services/ai_client.py`, `apps/ai/services/semantic_service.py`
- Root cause: unexpected provider/client exceptions were not consistently mapped into the centralized AI taxonomy.
- Impact: event ingest could return HTTP 500 instead of degraded semantic metadata if a raw client exception escaped.
- Fix: preserve known `AIServiceError` subclasses, convert unknown failures to `AI_UNKNOWN_ERROR`, and return safe semantic unavailable metadata.
- Regression tests: `apps.ai.tests.AIClientTests.test_unexpected_provider_error_is_taxonomized_without_raw_message`, `apps.ai.tests.SemanticAnalysisServiceTests.test_unexpected_client_error_is_returned_as_unknown_safe_metadata`, and `apps.tracking.tests.EventBatchIngestApiTests.test_unexpected_ai_error_does_not_make_event_ingest_return_500`.

### Missing integrated AI success-path regression

- Severity: Low
- Area: End-to-end core loop test coverage
- File: `apps/tracking/tests.py`
- Root cause: degraded ingest paths were covered, but there was no API-level test proving semantic success persisted AI analysis, fed Hybrid Decision, created Warning Cycle, and appeared in Realtime Score.
- Impact: integration regressions across Day 9 through Day 12 could pass module-level tests.
- Fix: added a Deep Work API integration test for AI success path through event ingest, hybrid warning creation, warnings API, and realtime score.
- Regression test: `apps.tracking.tests.EventBatchIngestApiTests.test_deep_work_ai_success_core_loop_persists_hybrid_warning_and_realtime_score`.

## Test Results

Commands were run with the project venv, `DJANGO_SECRET_KEY=audit-test-secret`, and `DATABASE_ENGINE=sqlite`.

| Command | Count | Result |
| --- | ---: | --- |
| `python manage.py test apps.tracking` | 48 | OK |
| `python manage.py test apps.ai` | 41 | OK |
| `python manage.py test apps.scoring` | 36 | OK |
| `python manage.py test apps.extension` | 12 | OK |
| `python manage.py test apps.sessions` | 31 | OK |
| `python manage.py test apps.analytics` | 6 | OK |
| `python manage.py test apps.users` | 8 | OK |
| `python manage.py check` | n/a | OK |
| `python manage.py makemigrations --check` | n/a | No changes detected |
| `python manage.py migrate` | n/a | No migrations to apply |
| `python manage.py test` | 182 | OK |

## Known Limitations

- Local PostgreSQL was not running during this audit, so tests and migration application were verified with SQLite.
- SQLite cannot fully model production PostgreSQL locking behavior, but database constraints and idempotency paths are covered by tests.
- No configured backend lint/type-check command was found.
- `docs/dev2_week2_day8.md` is not present; Day 8 behavior is documented by implementation/tests and adjacent Week 2 docs.
- AI observability is structured logging only; no metrics backend was added.

## Final Verdict

Overall status: PASS WITH FIXES.

Week 2 verdict: READY TO COMMIT after review of the existing dirty working tree. READY TO MERGE depends on normal repository process, reviewer approval, and CI in the target environment.
