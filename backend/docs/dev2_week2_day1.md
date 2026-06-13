# Dev 2 Week 2 Day 1

## Goal

Build a deterministic Behavior Rule Engine that evaluates browser-event risk
signals for:

- blacklist membership and severity
- idle time
- tab switch frequency in a 60 second window

The result is structured metadata for the future Hybrid Decision Engine. This
work does not implement semantic AI, hybrid classification, warning cycles,
auto-pause, realtime score, or session lifecycle changes.

## Supported Rules

Each accepted browser event is evaluated against three rules:

- `blacklist`: checks the normalized event domain against default and current
  user blacklist entries.
- `idle`: checks `idle_seconds`.
- `tab_switch`: checks `tab_switch_count`.

All three evaluated signals are returned. Medium and high signals also emit
machine-readable reason codes.

## Thresholds

Thresholds are centralized in
`apps.tracking.services.behavior_rule_engine.BehaviorRuleConfig`.

Idle:

- below 60 seconds: `LOW`
- 60 to 179 seconds: `MEDIUM`
- 180 seconds or more: `HIGH`

Tab switching in a 60 second window:

- below 5 switches: `LOW`
- 5 to 9 switches: `MEDIUM`
- 10 switches or more: `HIGH`

Blacklist:

- no match: `LOW`
- `medium` severity: `MEDIUM`
- `high` severity: `HIGH`

Risk scores are deterministic and bounded to 0-100. The overall score is the
highest signal score, so multiple active signals cannot push the score above
100.

## Input Contract

The engine accepts the sanitized browser event dictionary already used by event
ingest:

```json
{
  "event_type": "url_change",
  "url": "https://example.com/path",
  "domain": "example.com",
  "idle_seconds": 60,
  "tab_switch_count": 5
}
```

Missing, `null`, invalid, or negative numeric values are treated as `0`.
Missing or empty domains are safe and do not match blacklist entries.

## Output Contract

The rule engine returns:

```json
{
  "risk_level": "MEDIUM",
  "risk_score": 60,
  "should_warn": true,
  "signals": [
    {
      "rule": "blacklist",
      "risk_level": "MEDIUM",
      "score": 60,
      "reason": "Domain matches medium severity blacklist entry reddit.com."
    }
  ],
  "reason_codes": ["BLACKLIST_MEDIUM"],
  "domain": "reddit.com",
  "blacklist_match": {
    "domain": "reddit.com",
    "severity": "medium",
    "source": "custom"
  }
}
```

Reason codes currently used:

- `BLACKLIST_MEDIUM`
- `BLACKLIST_HIGH`
- `IDLE_MEDIUM`
- `IDLE_HIGH`
- `TAB_SWITCH_MEDIUM`
- `TAB_SWITCH_HIGH`

`should_warn` is true for Normal Mode blacklist matches. The engine does not
create `WarningEvent` rows and does not pause sessions.

## Domain Normalization

Domains are normalized before comparison:

- lowercase
- remove protocol
- remove `www.`
- remove path and query string
- strip ports by using the parsed hostname
- handle empty input safely

Matching uses a domain boundary check:

- `youtube.com` matches `youtube.com`
- `m.youtube.com` matches `youtube.com`
- `notyoutube.com` does not match `youtube.com`

Blacklist lookup uses `BlacklistEntry.objects.available_to(user)`, which keeps
default entries and the current user's custom entries only. Other users'
custom blacklist entries are not queried as matches.

## Event Ingest Integration

`POST /api/sessions/{id}/events/batch/` now keeps the existing response fields:

- `status`
- `batch_id`
- `accepted_count`
- `rejected_count`

It also adds optional metadata:

```json
{
  "rule_evaluations": [
    {
      "event_index": 0,
      "event_type": "url_change",
      "result": {}
    }
  ]
}
```

Only accepted events are evaluated. Rejected events are not stored and are not
included in `rule_evaluations`. Session ownership and active-session validation
still run before event storage and rule evaluation.

## Deliberately Not Implemented

- OpenRouter or any AI API call
- Semantic AI Service
- Hybrid Decision Engine
- warning cycle 1/2/3
- `WarningEvent` creation from rules
- auto-pause
- realtime score
- final Focused / Potentially Distracted / Distracted classification
- frontend changes
- new models or migrations

## How To Run Tests

From `backend`:

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py test
```

For focused rule-engine coverage:

```bash
python manage.py test apps.tracking.tests.BehaviorRuleEngineTests
python manage.py test apps.tracking.tests.EventBatchIngestApiTests
```
