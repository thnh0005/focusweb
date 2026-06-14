# Dev2 Week 4 Day 2 - Recent Learning Context

Day 23 replaces `GET /api/recent-context/` with a safe reuse-context endpoint
for pre-filling the next focus-session form from session history.

## Endpoint

`GET /api/recent-context/`

The endpoint requires authentication and always uses `request.user`. Unsupported
methods return HTTP 405.

## Data Source

The service reuses existing session models:

- `FocusSession` for goal, mode, duration, status, and timestamps.
- `SessionTag` through `FocusSession.tags`.
- `UserPreference` only as a fallback for invalid legacy mode or duration.

No new models or migrations are required.

## Selection Rules

Historical context uses the latest completed or legacy finished session owned by
the authenticated user with a non-empty trimmed goal. Cancelled, active, paused,
auto-paused, whitespace-only, and other-user sessions are ignored for historical
context.

Open sessions are returned separately in `active_session` and are never reused
as `recent_context`.

## Response

When context exists, the endpoint returns `status=ready`, `has_context=true`,
`recent_context`, `reuse_config`, optional `active_session`, and `generated_at`.

When no historical context exists, it returns `status=empty`,
`has_context=false`, `recent_context=null`, `reuse_config=null`, optional
`active_session`, and `generated_at`.

## Normalization

Goals are trimmed, null bytes are removed, and CRLF/CR newlines are normalized
to LF while preserving language, case, and meaning.

Modes are exposed as `normal` or `deep_work`. Existing model value `deep-work`
is mapped to `deep_work`.

Target duration is converted from seconds to minutes. Actual duration uses
`actual_duration_seconds` when available, otherwise falls back to
`ended_at - started_at` for completed historical sessions.

## Privacy

The endpoint does not return URLs, browser titles, meta descriptions, snippets,
warning messages, notes, browsing history, raw warning events, raw browser
events, prompts, or content from another user. It does not call OpenRouter or
any AI API, mutate sessions, create tags, update preferences, or enqueue jobs.

## Tests

Covered by `RecentLearningContextDay23Tests`:

- Authentication required.
- Empty response with no valid completed goal.
- Latest completed context selection.
- Active/paused session returned separately.
- Goal normalization.
- Mode and duration normalization.
- Tags limited to three and reused by id.
- Privacy exclusions.
- No AI calls.
- Unsupported methods return HTTP 405.
