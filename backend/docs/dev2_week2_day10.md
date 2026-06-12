# Dev 2 Week 2 Day 10

## Goal

Build a deterministic Hybrid Decision Engine that combines Behavior Rule Engine
output and Semantic AI output to classify an event as:

- `FOCUSED`
- `POTENTIALLY_DISTRACTED`
- `DISTRACTED`

The engine is pure: it does not call AI, query the database, create warnings,
pause sessions, update sessions, or contain Celery logic.

## Input Contract

Rule evaluation input:

```json
{
  "risk_level": "LOW | MEDIUM | HIGH",
  "risk_score": 0,
  "reason_codes": ["TAB_SWITCH_MEDIUM"],
  "signals": []
}
```

Semantic analysis input:

```json
{
  "status": "ok",
  "classification": "RELEVANT | UNCERTAIN | NOT_RELEVANT",
  "relevance_score": 85,
  "confidence": 0.9
}
```

If semantic analysis is `null` or has a non-success status such as `error` or
`skipped`, Deep Work uses semantic-unavailable fallback.

## Output Contract

```json
{
  "state": "DISTRACTED",
  "decision_score": 88,
  "confidence": 0.89,
  "decision_source": "HYBRID",
  "reason_codes": ["CONTENT_NOT_RELEVANT", "TAB_SWITCH_MEDIUM"],
  "contributing_signals": [],
  "rule_risk_level": "MEDIUM",
  "semantic_classification": "NOT_RELEVANT",
  "semantic_relevance_score": 25,
  "should_start_warning_cycle": true
}
```

`should_start_warning_cycle` is only a signal for later work. Day 10 does not
create a `WarningEvent`, start a countdown, pause a session, or change
`FocusSession.status`.

## State Definitions

These decision states are separate from final Focus Score labels such as
`Deep Focus`, `Average`, or `Highly Distracted`.

- `FOCUSED`: current event looks aligned and behavior risk is low.
- `POTENTIALLY_DISTRACTED`: one side of the evidence is weak or concerning, but
  not enough to call the event distracted.
- `DISTRACTED`: semantic and behavior evidence are strong enough according to
  the matrix.

## Deep Work Matrix

| Semantic | Rule Risk | State |
| --- | --- | --- |
| `RELEVANT` | `LOW` | `FOCUSED` |
| `RELEVANT` | `MEDIUM` | `POTENTIALLY_DISTRACTED` |
| `RELEVANT` | `HIGH` | `POTENTIALLY_DISTRACTED` |
| `UNCERTAIN` | `LOW` | `POTENTIALLY_DISTRACTED` |
| `UNCERTAIN` | `MEDIUM` | `POTENTIALLY_DISTRACTED` |
| `UNCERTAIN` | `HIGH` | `DISTRACTED` |
| `NOT_RELEVANT` | `LOW` | `POTENTIALLY_DISTRACTED` |
| `NOT_RELEVANT` | `MEDIUM` | `DISTRACTED` |
| `NOT_RELEVANT` | `HIGH` | `DISTRACTED` |

The matrix is the source of truth for state. `decision_score` does not override
the matrix.

## Normal Mode

Normal Mode has no Semantic AI. It uses rule-only mapping:

- `LOW` => `FOCUSED`
- `MEDIUM` => `POTENTIALLY_DISTRACTED`
- `HIGH` => `DISTRACTED`

Output uses:

- `decision_source = RULE_ONLY`
- `semantic_classification = null`
- `semantic_relevance_score = null`

## Blacklist Special Case

Blacklist is handled only through the provided `RuleEvaluationResult`.
The Hybrid Engine does not query `BlacklistEntry`.

- high blacklist + `RELEVANT` => `POTENTIALLY_DISTRACTED`
- high blacklist + `NOT_RELEVANT` => `DISTRACTED`

This prevents a relevant YouTube tutorial from becoming `DISTRACTED` only
because the domain is blacklisted.

## Semantic Unavailable

When Deep Work semantic input is missing, skipped, errored, or still pending:

- `LOW` rule => `FOCUSED`
- `MEDIUM` rule => `POTENTIALLY_DISTRACTED`
- `HIGH` rule => `POTENTIALLY_DISTRACTED`

Output uses `decision_source = RULE_ONLY` and appends
`SEMANTIC_UNAVAILABLE`. Provider timeout or missing AI result never creates
`DISTRACTED` by itself.

## Decision Score

Hybrid score:

```text
semantic_distraction_score = 100 - relevance_score
decision_score =
  semantic_distraction_score * 0.65
  + rule_risk_score * 0.35
```

The result is rounded and clamped to integer `0-100`.

Rule-only score uses `rule_risk_score` directly, also clamped to `0-100`.

## Confidence

Hybrid confidence:

```text
confidence =
  semantic_confidence * 0.70
  + rule_confidence * 0.30
```

Rule confidence:

- `LOW = 0.70`
- `MEDIUM = 0.80`
- `HIGH = 0.90`

Confidence is clamped to `0-1`.

## Reason Codes

The engine preserves all rule reason codes and adds one semantic reason code
when semantic input is available:

- `CONTENT_RELEVANT`
- `CONTENT_UNCERTAIN`
- `CONTENT_NOT_RELEVANT`
- `SEMANTIC_UNAVAILABLE`

## Integration Point

Event ingest now returns optional `hybrid_decisions` metadata after:

1. storing accepted `BrowserEvent` rows
2. creating `rule_evaluations`
3. creating `semantic_evaluations`
4. passing both structured results into `HybridDecisionEngine`

Existing response fields remain unchanged.

## Persistence Decision

`AIAnalysisResult` currently has no dedicated fields for hybrid state, decision
score, decision confidence, decision source, or hybrid reason codes. Day 10 does
not add a migration or new model only for hybrid persistence. The engine returns
structured output; persistence can be added when the warning-cycle or realtime
pipeline requires it.

## Idempotency

The engine is deterministic and pure. The same rule, semantic, and mode inputs
produce the same output. Since Day 10 does not write a hybrid record, it cannot
create duplicate database rows during retry.

## Deliberately Not Implemented

- Warning cycle 1/2/3
- `WarningEvent` creation
- auto-pause
- `FocusSession` state changes
- realtime rolling score
- realtime score API
- AI Session Insight
- direct OpenRouter calls from Hybrid Engine
- frontend changes

## How To Run Tests

From `backend`:

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py test
```

Focused coverage:

```bash
python manage.py test apps.scoring.tests.HybridDecisionEngineTests apps.tracking.tests.EventBatchIngestApiTests
```
