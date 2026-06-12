# Dev 2 Week 2 Day 12

## Goal

Implement Warning Cycle Service for:

```text
DISTRACTED -> Warning 1 -> Warning 2 -> Warning 3
```

Deep Work emits an auto-pause-required signal after Warning 3. Normal Mode
completes the warning cycle without pause. Day 12 does not pause sessions,
create AI insights, call OpenRouter, end/cancel sessions, or change final focus
scores.

## Warning State Machine

Persisted `WarningCycle.status` values:

- `warning_1_sent`
- `warning_2_sent`
- `warning_3_sent`
- `resolved`
- `completed`
- `auto_pause_required`
- `cancelled`

Active cycle statuses are:

- `warning_1_sent`
- `warning_2_sent`
- `warning_3_sent`
- `auto_pause_required`

The database enforces one active warning cycle per session.

## Trigger Conditions

The service starts a cycle only when:

- Hybrid Decision state is `DISTRACTED`
- `FocusSession.status` is `active`
- source event belongs to the same session
- there is no active cycle
- the same source-event decision has not already started a cycle

`FOCUSED` and `POTENTIALLY_DISTRACTED` do not start a full cycle. If an active
cycle exists, both states resolve it for the MVP recovery policy.

## Deep Work Behavior

Deep Work:

```text
Warning 1 -> Warning 2 -> Warning 3 -> AUTO_PAUSE_REQUIRED
```

After Warning 3:

```json
{
  "status": "auto_pause_required",
  "current_level": 3,
  "auto_pause_required": true,
  "action": "AUTO_PAUSE"
}
```

The service does not mutate `FocusSession.status`. It only emits the signal for
later Day 13 work.

## Normal Mode Behavior

Normal Mode:

```text
Warning 1 -> Warning 2 -> Warning 3 -> completed
```

After Warning 3:

```json
{
  "status": "completed",
  "current_level": 3,
  "auto_pause_required": false,
  "action": "NONE"
}
```

Normal Mode is never force-paused.

## Timing And Celery

Settings:

```bash
WARNING_INTERVAL_SECONDS=5
WARNING_MAX_LEVEL=3
```

When Warning 1 or Warning 2 is created, the service uses
`transaction.on_commit()` to enqueue:

```text
advance_warning_cycle(cycle_id)
```

with `countdown=WARNING_INTERVAL_SECONDS`.

The task checks:

- cycle exists and is still active
- session still exists
- session is still `active`
- next warning time has been reached
- current level is below the max
- the next warning level does not already exist

No `time.sleep()` is used and HTTP requests are not blocked while waiting for
later warnings.

## Recovery Policy

`FOCUSED` resolves an active cycle.

`POTENTIALLY_DISTRACTED` also resolves an active cycle for MVP false-positive
reduction.

Scheduled tasks for resolved cycles no-op because the task locks and loads only
active cycles.

Paused, completed, and cancelled sessions do not advance.

## WarningEvent Persistence

Day 12 extends `WarningEvent` and adds `WarningCycle`.

`WarningCycle` stores:

- session id
- source event
- idempotency key
- mode
- status
- current level
- decision state
- decision score
- reason codes
- domain
- auto-pause signal
- action
- next warning time
- started/resolved timestamps

`WarningEvent` stores:

- session id
- cycle link
- browser event link
- warning level
- warning type
- decision state
- decision score
- reason codes
- domain
- auto-pause-required flag
- created timestamp

It does not store snippets, prompts, AI raw response, provider errors, passwords,
form content, private messages, or API keys.

## Schema Decision

The existing `WarningEvent` model did not safely represent active-cycle state,
resolution, idempotency, per-level uniqueness, or auto-pause-required status.
Day 12 adds the minimal `WarningCycle` model and extends `WarningEvent` with
metadata fields required by the warning log and cycle engine.

Migration:

```text
apps/tracking/migrations/0003_warningevent_auto_pause_required_and_more.py
```

## Idempotency

Protection layers:

- `WarningCycle.idempotency_key` is unique.
- one active warning cycle per session is enforced by a conditional unique
  constraint.
- each cycle has at most one `WarningEvent` per warning level through
  `unique(warning_cycle, warning_level)`.
- service methods use `transaction.atomic()`.
- cycle updates use `select_for_update()`.
- warning rows use `get_or_create()`.

Same decision retry and task retry do not create duplicate warnings.

## Concurrency Handling

Concurrent or retried tasks lock the cycle before advancing. If a task for an
old cycle runs after recovery or after a new cycle starts, it no-ops because the
old cycle is no longer active.

The max level is 3; warning level 4 is never created.

## Hybrid Integration

Current synchronous pipeline:

```text
BrowserEvent
-> Rule Engine
-> Semantic AI
-> Hybrid Decision Engine
-> WarningCycleService.handle_decision()
```

The warning service consumes structured decision context only. It does not call
AI, re-run the rule engine, or classify content.

## GET Warnings API

Endpoint:

```text
GET /api/sessions/{id}/warnings/
```

Response shape:

```json
{
  "session_id": "...",
  "session_status": "active",
  "mode": "deep-work",
  "warning_count": 3,
  "active_cycle": {
    "cycle_id": "...",
    "status": "auto_pause_required",
    "current_level": 3,
    "next_warning_at": null,
    "auto_pause_required": true,
    "started_at": "...",
    "resolved_at": null
  },
  "warnings": [
    {
      "id": "...",
      "cycle_id": "...",
      "level": 1,
      "decision_state": "DISTRACTED",
      "decision_score": 86,
      "domain": "youtube.com",
      "reason_codes": ["CONTENT_NOT_RELEVANT", "BLACKLIST_HIGH"],
      "auto_pause_required": false,
      "triggered_at": "..."
    }
  ]
}
```

No warnings:

```json
{
  "session_id": "...",
  "warning_count": 0,
  "active_cycle": null,
  "warnings": []
}
```

Warnings are sorted by `triggered_at` ascending.

## Authentication And Ownership

The endpoint requires authentication and uses the existing owner-scoped session
lookup. Another user's session id returns `404`. Missing session returns `404`.
GET does not create warnings and does not mutate session state.

## Privacy Boundary

The warnings API does not expose:

- full URL
- page title
- meta description
- snippet
- AI prompt
- AI raw response
- provider errors
- stack traces

Only warning overlay/session-summary data is returned.

## Worker Command

Unit tests do not require a real worker. In development with Redis available:

```bash
celery -A config worker -l info
```

## Deliberately Not Implemented

- AI Session Insight
- AI Insight retry endpoint
- fallback AI policy
- frontend changes
- direct OpenRouter calls
- blocking waits
- automatic pause mutation
- automatic end/cancel/resume
- final Focus Score overwrite

## Test Commands

From `backend`:

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py migrate
python manage.py test
```

Focused coverage:

```bash
python manage.py test apps.tracking.tests.WarningCycleServiceTests apps.tracking.tests.SessionWarningsApiTests
```
