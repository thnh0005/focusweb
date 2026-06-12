# Dev 2 Week 2 Audit Checklist

## Rule Engine

- Deterministic blacklist, idle, and tab-switch rules pass.
- Rule Engine does not call AI.
- User-scoped blacklist behavior is preserved.

## Semantic AI

- Provider success persists `AIAnalysisResult`.
- Provider errors return structured unavailable metadata.
- No fake relevance score is generated during fallback.
- Prompt privacy boundaries remain in place.

## Hybrid Decision

- AI success uses `HYBRID`.
- Deep Work semantic-unavailable uses `RULE_ONLY_FALLBACK`.
- Normal Mode rule-only behavior remains unchanged.
- Output includes `fallback_applied` and `ai_error_code`.

## Realtime Score

- Endpoint never calls provider.
- Missing relevance produces partial/degraded metadata.
- Available components are reweighted.
- Score is bounded 0-100 or null when insufficient.

## Warning Cycle

- Warnings only follow final hybrid state.
- Semantic unavailable does not create warning by itself.
- Warning retries remain idempotent.
- `decision_source` is persisted when available.

## AI Session Insight

- One insight row per session.
- Task accepts primitive session ID.
- Provider success stores `source=AI`.
- Provider/circuit/invalid response failures use deterministic fallback.
- Manual retry updates the same row.

## Provider Fallback

- Missing key, timeout, 429, 5xx/unavailable, invalid response, and circuit-open
  paths are covered.
- Circuit breaker uses cache and does not crash when cache is unavailable.

## Event Ingest Reliability

- Valid events persist before provider work.
- Provider errors do not rollback accepted events or return HTTP 500.
- Partial batch rejection still applies only to validation/privacy failures.
- Optional AI degraded metadata is additive.

## Ownership And Security

- Session API lookups remain scoped to authenticated user.
- Cross-user session access returns 404 where existing session APIs require it.
- Tracking ownership validation remains active.

## Privacy

- Explicit sensitive fields are rejected.
- Session insight sends aggregate metrics only.
- Logs omit prompts, snippets, API keys, tokens, cookies, headers, and raw
  provider payloads.

## Celery Idempotency

- Warning cycle tasks do not duplicate warning levels.
- Session insight task does not duplicate rows.
- Completed insight task reruns no-op.

## Migration Status

- AI session insight migration exists.
- Warning decision source migration exists.
- `makemigrations --check` should report no changes.

## Full Test Results

- Run per-app tests first when iterating.
- Full suite must pass before Week 2 is considered hardened.
