# Dev 2 Week 2 Day 11

## Goal

Build calculate-on-read realtime rolling focus scoring for active and paused
sessions:

```text
GET /api/sessions/{id}/score/realtime/
```

The endpoint returns a score from recent rolling-window data without creating
warnings, auto-pausing, calling AI, changing session state, or writing final
`FocusScore` rows.

## Realtime Scoring Flow

1. Authenticate the request.
2. Load the session scoped to `request.user`.
3. Accept only `active` and `paused` sessions.
4. Query `BrowserEvent` rows for the session inside the rolling window.
5. Query matching successful `AIAnalysisResult` rows for the same session and
   event ids.
6. Normalize event metrics and AI relevance values.
7. Call the pure `RealtimeScoreCalculator`.
8. Serialize a response-safe dictionary.

## Rolling Window

Configuration is centralized in Django settings:

```bash
REALTIME_SCORE_WINDOW_SECONDS=300
REALTIME_SCORE_STALE_SECONDS=90
REALTIME_SCORE_MIN_EVENTS=3
REALTIME_SCORE_TAB_SWITCH_PENALTY=8
```

Only events with `created_at` inside the last `window_seconds` are included.

## Input Sources

- `BrowserEvent.active_seconds`
- `BrowserEvent.idle_seconds`
- `BrowserEvent.tab_switch_count`
- `BrowserEvent.created_at`
- `AIAnalysisResult.relevance_score`
- `AIAnalysisResult.focus_state`

AI rows are included only when they match both the session id and a
rolling-window event id. Failed/unavailable analyses are ignored by filtering
for empty `error_message` and excluding `unknown` focus state from relevance
averages.

## Components

Weights match the final score component family:

- `content_relevance`: `0.40`
- `focus_continuity`: `0.30`
- `tab_stability`: `0.15`
- `distraction_control`: `0.15`

### Content Relevance

Deep Work uses the average of valid `AIAnalysisResult.relevance_score` values in
the window, clamped to `0-100`.

Normal Mode does not require AI. If no relevance values exist, the component is
`null` and the score uses available component weights only.

### Focus Continuity

```text
focus_continuity = 100 - idle_ratio * 100
idle_ratio = idle_seconds / (active_seconds + idle_seconds)
```

The result is clamped to `0-100`. Missing, malformed, negative, or zero-total
duration data returns `null` instead of dividing by zero.

### Tab Stability

```text
tab_stability = 100 - tab_switch_count * configured_penalty
```

More tab switching never increases the score. The result is clamped to `0-100`.

### Distraction Control

Day 10 hybrid decisions are not persisted yet. Day 11 adapts available
`AIAnalysisResult.focus_state` values:

- `focused` => `100`
- `potentially_distracted` => `60`
- `distracted` => `20`

The component is the average of available adapted values. If none exist, it is
`null`.

## Counter Handling

If event counters are monotonic and changing inside the window, the calculator
treats them as cumulative snapshots and uses the observed in-window delta
instead of summing every snapshot. Otherwise it sums per-event values. This
avoids inflating tab switches or durations from cumulative counter snapshots.

## Missing Component Policy

The total score is a weighted average over available components only, with
weights normalized to the available total. Missing components are not silently
treated as `100`.

If event count is below `REALTIME_SCORE_MIN_EVENTS`, the response returns
`score = null` and `data_quality = INSUFFICIENT`.

## Score Labels

Score labels are separate from Hybrid Decision states:

- `90-100` => `DEEP_FOCUS`
- `75-89` => `FOCUSED`
- `60-74` => `AVERAGE`
- `40-59` => `DISTRACTED`
- `0-39` => `HIGHLY_DISTRACTED`

## Data Quality

- `INSUFFICIENT`: event count is below the configured minimum.
- `PARTIAL`: enough events exist, but one or more components are unavailable.
- `SUFFICIENT`: enough events exist and all four components are available.

No data returns HTTP 200 with `score = null`, not a fake perfect score.

## Stale Detection

If the newest event in the rolling window is older than
`REALTIME_SCORE_STALE_SECONDS`, `stale = true`. Stale data is not treated as an
API error.

## API Contract

Successful response:

```json
{
  "session_id": "...",
  "session_status": "active",
  "score": 81,
  "label": "FOCUSED",
  "components": {
    "content_relevance": 88,
    "focus_continuity": 79,
    "tab_stability": 73,
    "distraction_control": 80
  },
  "weights": {
    "content_relevance": 0.4,
    "focus_continuity": 0.3,
    "tab_stability": 0.15,
    "distraction_control": 0.15
  },
  "window_seconds": 300,
  "event_count": 18,
  "data_quality": "SUFFICIENT",
  "stale": false,
  "calculated_at": "..."
}
```

Insufficient response:

```json
{
  "session_id": "...",
  "session_status": "active",
  "score": null,
  "label": null,
  "components": {
    "content_relevance": null,
    "focus_continuity": null,
    "tab_stability": null,
    "distraction_control": null
  },
  "event_count": 0,
  "data_quality": "INSUFFICIENT",
  "stale": false
}
```

## Authentication And Ownership

The endpoint requires authentication. Session lookup is scoped to
`request.user`; another user's session id returns `404`.

Active and paused sessions return `200`. Closed sessions return a validation
error and are not mutated.

## Caching Decision

No caching was added. The query is small, uses the existing `session_id` and
`created_at` index on `BrowserEvent`, and avoids external calls. If caching is
added later, the key must include both user id and session id.

## Persistence Decision

Realtime score is calculate-on-read. The endpoint does not create or update
`FocusScore`, does not overwrite running-session score fields, and does not
create snapshot rows.

## Performance Considerations

- Queries are scoped by `session_id` and rolling-window timestamps.
- AI analyses are queried by session and event id set.
- Only metric fields required for scoring are selected from `BrowserEvent`.
- No snippets, URLs, raw AI response details, or unrelated user data are exposed.

## Deliberately Not Implemented

- Warning Cycle
- warning 1/2/3
- auto-pause
- OpenRouter calls
- AI Session Insight
- final score calculator changes
- frontend changes
- realtime score persistence
- cache layer

## How To Run Tests

From `backend`:

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py test
```

Focused tests:

```bash
python manage.py test apps.scoring.tests.RealtimeScoreCalculatorTests apps.sessions.tests.RealtimeScoreApiTests
```
