# Dev 2 - Week 2 - Day 13: AI Session Insight

## Goal

Generate a short AI session insight asynchronously after a valid completed focus
session. The feature exposes:

- `GET /api/sessions/{id}/ai-insight/`
- `POST /api/sessions/{id}/ai-insight/retry/`

Pattern detection, recommendations, weekly reports, notification scheduling, and
frontend changes are not part of this day.

## Async Flow

When `FocusSession` transitions to `completed`, the lifecycle service persists
the final score and then uses `transaction.on_commit()` to enqueue
`generate_session_insight(session_id)`. The endpoint never waits for OpenRouter.

The task accepts only a primitive session ID:

1. Load the session.
2. Verify eligibility.
3. Create or lock the one-to-one `SessionInsight`.
4. No-op if already completed.
5. Mark `PROCESSING` inside a short transaction.
6. Release the transaction before calling the AI provider.
7. Aggregate sanitized metrics.
8. Call the configured AI client.
9. Parse observations.
10. Save `COMPLETED`.
11. Retry transient provider failures up to the configured max.
12. Use deterministic rule-based fallback when AI is unavailable or invalid.

## Eligibility

Only `FocusSession.Status.COMPLETED` is eligible. `ACTIVE`, `PAUSED`,
`AUTO_PAUSED`, and `CANCELLED` are not eligible and return
`SESSION_NOT_ELIGIBLE` for retry attempts.

## Aggregation Fields

The aggregator reads only the requested session:

- session mode, goal, target duration, actual duration, completion status
- final score and component scores
- event count
- tab switch count
- total idle seconds
- warning count
- distracted and potentially distracted semantic counts
- average and lowest relevance score
- relevance decline signal
- warning decision-state counts and average warning decision score

## Privacy Boundary

Session insight never sends raw browser events, raw URLs, page snippets, prompts,
provider headers, stack traces, API keys, or raw provider responses to the API.
The AI prompt receives aggregate metrics only.

## AI Prompt And Output

The prompt asks for valid JSON only:

```json
{"observations":["observation 1","observation 2"]}
```

The parser supports JSON code fences, removes empty observations, truncates long
items, caps output at four observations, and raises `AI_INVALID_RESPONSE` when
there is no usable observation.

## Fallback Rules

The rule-based fallback is deterministic and uses real aggregate data:

- high content relevance
- low content relevance
- low continuity
- low tab stability
- multiple warnings
- materially short completion versus target
- generic completed-session observation when no rule matches

It returns one to four neutral observations and never calls AI.

## Persistence Decision

`AIAnalysisResult` remains dedicated to per-event semantic relevance and stores
event-related fields such as snippets and raw response metadata. Session insight
uses a separate `SessionInsight` model with:

- one-to-one `session`
- `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`
- `AI`, `RULE_BASED_FALLBACK`
- observations JSON list
- model name
- retry count
- sanitized error code/message
- started/generated/created/updated timestamps

## Status Transitions

- Missing record: API presents `PENDING`
- `PENDING` -> `PROCESSING` when the task starts
- `PROCESSING` -> `COMPLETED` on AI success
- `PROCESSING` -> `PENDING` before Celery automatic retry
- `PROCESSING` -> `COMPLETED` with `RULE_BASED_FALLBACK` on fallback success
- `PROCESSING` -> `FAILED` only if fallback cannot produce observations
- stale `PROCESSING` can be retried manually

## Idempotency

The one-to-one database constraint guarantees one insight per session. The task
uses `select_for_update()` and no-ops completed rows. Manual retry updates the
same row and rejects duplicate queued or active work.

## Automatic Retry

Transient AI errors (`AI_TIMEOUT`, `AI_RATE_LIMITED`, `AI_PROVIDER_ERROR`) are
retried by Celery up to `SESSION_INSIGHT_TASK_MAX_RETRIES` with backoff from
`SESSION_INSIGHT_TASK_RETRY_BACKOFF_SECONDS`. Non-transient errors use fallback.

## Manual Retry

Manual retry is allowed for `FAILED`, fallback-completed rows, and stale
`PROCESSING` rows. It is rejected for AI-completed rows, fresh processing rows,
queued rows, ineligible sessions, and rows beyond
`SESSION_INSIGHT_MANUAL_RETRY_LIMIT`.

## Stale Processing Policy

`PROCESSING` is stale when `started_at` is older than
`SESSION_INSIGHT_STALE_PROCESSING_SECONDS`.

## GET API

`GET /api/sessions/{id}/ai-insight/` is authenticated and user scoped. Sessions
owned by another user return 404. GET does not call AI, enqueue work, create a
row, or change session state.

## POST Retry API

`POST /api/sessions/{id}/ai-insight/retry/` is authenticated and user scoped.
Accepted retries return 202 and enqueue after commit. Conflicts return 409 with
one of:

- `INSIGHT_ALREADY_PROCESSING`
- `INSIGHT_ALREADY_COMPLETED`
- `RETRY_LIMIT_REACHED`

## Worker Command

```bash
celery -A config worker -l info
```

## Test Commands

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py test
```

If applying the new model locally:

```bash
python manage.py migrate
```

## Not Implemented

This day does not implement pattern detection, recommendation engine, weekly
reporting, notification scheduling, or frontend work.
