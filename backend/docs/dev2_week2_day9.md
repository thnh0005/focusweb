# Dev 2 Week 2 Day 9

## Goal

Build the Semantic AI Service for Deep Work relevance analysis. The service
compares the active session goal with sanitized page context and returns a
structured relevance result for later Hybrid Decision Engine work.

This day does not implement hybrid decisions, warning cycles, auto-pause,
realtime scoring, end-of-session insights, pattern detection, recommendations,
or frontend behavior.

## Semantic Analysis Flow

1. Event ingest validates the session is owned by the authenticated user and is
   active.
2. Browser events that pass privacy validation are stored as before.
3. Rule-engine metadata is evaluated.
4. Semantic analysis is attempted for each stored event.
5. The semantic service skips ineligible events without calling the provider.
6. Eligible Deep Work events call the AI client.
7. Provider output is parsed, clamped, normalized, and saved to
   `AIAnalysisResult`.
8. Provider errors are returned as metadata and do not fail event ingest.

## Eligibility Rules

Semantic AI only calls the provider when:

- session belongs to the authenticated user
- event belongs to the same session
- session status is `active`
- session mode is `deep-work`
- session goal is not blank
- event already passed ingest privacy validation
- snippet sent to AI is capped at 500 characters

Normal Mode, paused, finished, cancelled, and goal-less Deep Work sessions are
skipped.

## Input Contract

The service normalizes only the fields required for relevance:

```json
{
  "goal": "Study Django REST Framework serializers",
  "title": "Serializers - Django REST framework",
  "meta": "Serializer documentation",
  "snippet": "Serializers allow complex data conversion.",
  "domain": "django-rest-framework.org"
}
```

Normalization:

- `None` values become empty strings
- strings are trimmed
- title and meta are capped at 500 characters
- snippet is capped at 500 characters
- domain is lowercased and stripped of protocol, `www.`, path, query, and port
- extra raw payload fields are not sent to AI

## Output Contract

Successful semantic result:

```json
{
  "status": "ok",
  "analysis_id": "uuid",
  "relevance_score": 82,
  "classification": "RELEVANT",
  "is_relevant": true,
  "confidence": 0.91,
  "reason": "Matches the study goal.",
  "source": "openrouter",
  "model": "configured-model",
  "latency_ms": 25
}
```

Skipped result:

```json
{
  "status": "skipped",
  "reason": "session_not_deep_work",
  "source": "semantic_ai"
}
```

Provider error result:

```json
{
  "status": "error",
  "error_code": "AI_PROVIDER_ERROR",
  "source": "semantic_ai"
}
```

## Relevance Thresholds

The parser prioritizes `relevance_score` and normalizes classification from the
score:

- 70-100: `RELEVANT`
- 40-69: `UNCERTAIN`
- 0-39: `NOT_RELEVANT`

If the provider returns a classification that conflicts with the score, the
score wins. Scores are clamped to 0-100. Confidence is clamped to 0-1. Missing
confidence defaults to `0`; missing reason defaults to an empty string.

## Provider Configuration

Settings are read from environment variables:

```bash
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_REQUEST_TIMEOUT_SECONDS=2
AI_MAX_RETRIES=1
```

Missing API key or model does not crash Django startup. The client raises
`AI_NOT_CONFIGURED`, and event ingest still succeeds.

## Prompt Contract

The prompt builder creates separate system and user prompts. The system prompt
requires valid JSON only:

```json
{
  "relevance_score": 0,
  "classification": "RELEVANT | UNCERTAIN | NOT_RELEVANT",
  "confidence": 0.0,
  "reason": "short explanation"
}
```

The system prompt explicitly treats page title, meta description, snippet, and
domain as untrusted webpage data. It tells the provider to ignore instructions
inside webpage content and only judge relevance to the session goal.

## Prompt Injection Protection

Webpage content is placed only in the user prompt inside an "untrusted webpage
data" section. The system prompt contains the instruction hierarchy and does
not include page snippet text. This prevents webpage text such as "ignore
previous instructions" from becoming a system instruction.

## Privacy Limits

- No passwords, form fields, private messages, keyboard input, cookies, storage,
  tokens, HTML, or full page content are accepted by ingest privacy validation.
- Semantic service sends only goal, title, meta, snippet, and domain.
- Snippet is capped at 500 characters.
- API keys are read from settings and are not logged.
- Raw provider exceptions are not returned through the API.

## Integration Decision

Integration is synchronous but soft-failing. The current project has Celery
configured, but semantic worker flow is not yet established or tested. To avoid
inventing a queue contract in this task, event ingest stores browser events
first and then calls semantic analysis. Provider failures are normalized into
optional `semantic_evaluations` metadata and do not change the HTTP success
contract.

Existing ingest response fields remain:

- `status`
- `batch_id`
- `accepted_count`
- `rejected_count`

Optional metadata now includes:

- `rule_evaluations`
- `semantic_evaluations`

## AIAnalysisResult Persistence

Successful analyses are saved to the existing `AIAnalysisResult` model:

- `session_id`
- `browser_event_id`
- `provider`
- `model_name`
- `session_goal`
- `page_title`
- `domain`
- `content_snippet`
- `relevance_score`
- `is_relevant`
- `focus_state`
- `reason`
- `raw_response` with normalized classification and confidence
- `latency_ms`

The model has no direct `user` field, so ownership is enforced through the
session and event checks before persistence.

## Idempotency Strategy

Before calling the provider, the semantic service checks for an existing
`AIAnalysisResult` with the same `session_id` and `browser_event_id`. If found,
it returns the existing result and does not call the provider again. This avoids
duplicates during retry without requiring a migration.

## Error Codes

Normalized provider errors:

- `AI_NOT_CONFIGURED`
- `AI_TIMEOUT`
- `AI_RATE_LIMITED`
- `AI_PROVIDER_ERROR`
- `AI_INVALID_RESPONSE`

Only timeout and transient 5xx transport errors are retried up to the configured
retry count. Validation and parse errors are not retried.

## Deliberately Not Implemented

- Hybrid Decision Engine
- final focus classification
- warning cycle
- `WarningEvent` creation from semantic result
- auto-pause
- realtime focus score
- AI Session Insight
- Pattern Detection
- Recommendation Engine
- frontend changes
- new model or migration

## How To Run Tests

From `backend`:

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py test
```

For focused coverage:

```bash
python manage.py test apps.ai.tests apps.tracking.tests.EventBatchIngestApiTests
```

Tests mock provider behavior and do not require a real `OPENROUTER_API_KEY`.
