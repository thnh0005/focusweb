# Dev 2 - Week 2 - Day 14: AI Fallback And Provider Resilience

## Goal

Harden the Week 2 core loop so FocusOS still accepts valid tracking data,
scores sessions, avoids unsafe warnings, and generates session insight fallback
when the AI provider is unavailable.

## AI Error Taxonomy

Central AI exceptions expose:

- `AI_NOT_CONFIGURED`
- `AI_AUTH_ERROR`
- `AI_TIMEOUT`
- `AI_RATE_LIMITED`
- `AI_PROVIDER_UNAVAILABLE`
- `AI_PROVIDER_ERROR`
- `AI_INVALID_RESPONSE`
- `AI_CIRCUIT_OPEN`
- `AI_UNKNOWN_ERROR`

Each error carries a safe code, retryable flag, safe message, provider, and
operation. Public API responses never expose raw exceptions, prompts, snippets,
headers, keys, tokens, cookies, or stack traces.

## Retry Policies

Semantic realtime uses the `AIClient` bounded retry policy:

- `AI_REQUEST_TIMEOUT_SECONDS`
- `AI_MAX_RETRIES`
- `AI_RETRY_BACKOFF_SECONDS`

It retries timeout, 429, and provider 5xx/unavailable errors. It does not retry
auth, provider 400, validation, or parser errors.

Session insight avoids stacked retries by using an `AIClient(max_retries=0)` and
letting Celery retry transient errors:

- `SESSION_INSIGHT_TASK_MAX_RETRIES`
- `SESSION_INSIGHT_TASK_RETRY_BACKOFF_SECONDS`
- compatible aliases: `AI_INSIGHT_MAX_RETRIES`,
  `AI_INSIGHT_RETRY_BACKOFF_SECONDS`

After bounded retry failure, insight uses deterministic fallback.

## Timeout Settings

The provider timeout is configured through `AI_REQUEST_TIMEOUT_SECONDS`. Tests do
not require a real API key or live OpenRouter call.

## Circuit Breaker

`AICircuitBreaker` stores state in Django cache with provider and operation keys:

- `CLOSED`: calls provider normally.
- `OPEN`: skips provider and raises `AI_CIRCUIT_OPEN`.
- `HALF_OPEN`: allows a trial call after cooldown.

Configuration:

- `AI_CIRCUIT_FAILURE_THRESHOLD`
- `AI_CIRCUIT_COOLDOWN_SECONDS`

Cache/Redis failures fail open for application flow: the pipeline continues
without crashing, and rule-based paths are not blocked.

## Semantic Fallback

When semantic AI succeeds, persisted `AIAnalysisResult` is used and hybrid
decision source remains `HYBRID`.

When semantic AI fails, no fake relevance score is created. The semantic result
is structured as unavailable:

```json
{
  "status": "error",
  "available": false,
  "relevance_score": null,
  "classification": null,
  "confidence": null,
  "source": "UNAVAILABLE",
  "error_code": "AI_TIMEOUT"
}
```

## Deep Work Rule-Only Policy

For Deep Work with semantic unavailable:

- LOW rule risk => `FOCUSED`
- MEDIUM rule risk => `POTENTIALLY_DISTRACTED`
- HIGH rule risk => `POTENTIALLY_DISTRACTED`

The hybrid output uses `decision_source=RULE_ONLY_FALLBACK`,
`fallback_applied=true`, and includes `ai_error_code` when available. Provider
failure is not treated as a distraction signal.

## Normal Mode Policy

Normal Mode keeps the existing deterministic rule-only mapping:

- LOW => `FOCUSED`
- MEDIUM => `POTENTIALLY_DISTRACTED`
- HIGH => `DISTRACTED`

## Event Ingest Partial Failure Behavior

Valid events and the event batch are persisted before AI calls occur. Provider
failure cannot roll back valid `BrowserEvent` rows, convert accepted events into
rejected events, or return HTTP 500. The response keeps existing fields and adds
optional AI metadata:

```json
{
  "ai": {
    "status": "DEGRADED",
    "success_count": 8,
    "fallback_count": 2
  }
}
```

## Hybrid Degraded Output

Hybrid decisions tolerate `None`, unavailable, or malformed semantic input.
Degraded output includes:

- `decision_source`
- `fallback_applied`
- `ai_error_code`

Inputs are copied and not mutated.

## Warning Safety Behavior

Warning Cycle acts only on the final hybrid decision. Semantic unavailable does
not create a warning, does not trigger auto-pause, and does not create a
distraction signal. If deterministic Normal Mode rules legitimately produce
`DISTRACTED`, warning behavior remains normal. Warning cycle/event rows persist
`decision_source` when available.

## Realtime Score Degraded Behavior

Realtime score never calls the provider, creates warnings, changes session
state, or writes final score. When relevance is unavailable:

- `content_relevance=null`
- available components are reweighted
- `data_quality=PARTIAL` when enough event data exists
- `ai_status=DEGRADED`
- score remains bounded 0-100

If there are too few events, score remains `null` and data quality is
`INSUFFICIENT`.

## Session Insight Fallback

Session insight handles missing key, timeout, 429, provider 5xx, invalid
response, and circuit-open errors. Circuit-open falls back immediately. Fallback
success stores:

- `status=COMPLETED`
- `source=RULE_BASED_FALLBACK`
- 1-4 observations
- sanitized `error_code` and `error_message`

## Structured Logging

AI logging uses safe structured fields only:

- operation
- provider
- session_id
- event_id
- error_code
- retryable
- retry_count
- fallback_applied
- latency_ms
- circuit_state

The logger does not emit prompts, snippets, API keys, auth headers, cookies,
tokens, raw provider payloads, or full browsing history.

## Privacy Rules

Privacy validation still runs before persistence. Semantic AI receives only the
bounded title/meta/snippet contract already validated by tracking. Session
insight receives aggregate metrics only and never raw events, full URLs, or page
snippets.

## Environment Variables

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_BASE_URL`
- `AI_REQUEST_TIMEOUT_SECONDS`
- `AI_MAX_RETRIES`
- `AI_RETRY_BACKOFF_SECONDS`
- `AI_INSIGHT_MAX_RETRIES`
- `AI_INSIGHT_RETRY_BACKOFF_SECONDS`
- `SESSION_INSIGHT_TASK_MAX_RETRIES`
- `SESSION_INSIGHT_TASK_RETRY_BACKOFF_SECONDS`
- `SESSION_INSIGHT_MANUAL_RETRY_LIMIT`
- `SESSION_INSIGHT_STALE_PROCESSING_SECONDS`
- `AI_CIRCUIT_FAILURE_THRESHOLD`
- `AI_CIRCUIT_COOLDOWN_SECONDS`

## Test Commands

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py migrate
python manage.py test apps.ai
python manage.py test apps.tracking
python manage.py test apps.scoring
python manage.py test apps.extension
python manage.py test apps.sessions
python manage.py test
```

## Known Limitations

There is no Prometheus integration. AI observability is currently structured log
events and counters by event name. No second AI provider was added.
