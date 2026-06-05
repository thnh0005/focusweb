# Dev 2 Day 6

## Goal

Add the database models needed for the warning cycle, semantic AI relevance
analysis, hybrid focus-state decisions, and future realtime scoring support.

This day only adds database and admin support. It does not implement AI calls,
rule-engine behavior, scoring logic, auth changes, session lifecycle changes, or
frontend changes.

## Models added

### WarningEvent

App: `apps.tracking`

Fields:

- `id`: UUID primary key
- `session_id`: UUID
- `browser_event`: nullable optional foreign key to `tracking.BrowserEvent`
- `warning_level`: positive small integer constrained to `1`, `2`, or `3`
- `warning_type`: choice field with `normal_blacklist`, `deep_work_ai`, `idle`,
  `tab_switch`, `manual`
- `domain`: string, max 255, blank allowed
- `url`: URL field, max 2048, blank allowed
- `message`: text, blank allowed
- `was_acknowledged`: boolean, default false
- `triggered_auto_pause`: boolean, default false
- `created_at`: auto-created timestamp

### AIAnalysisResult

App: `apps.ai`

Fields:

- `id`: UUID primary key
- `session_id`: UUID
- `browser_event_id`: nullable optional UUID reference
- `provider`: string, max 100, blank allowed
- `model_name`: string, max 100, blank allowed
- `session_goal`: text, blank allowed
- `page_title`: string, max 500, blank allowed
- `domain`: string, max 255, blank allowed
- `content_snippet`: text, blank allowed
- `relevance_score`: float, default 0.0
- `is_relevant`: boolean, default false
- `focus_state`: choice field with `focused`, `potentially_distracted`,
  `distracted`, `unknown`
- `reason`: text, blank allowed
- `raw_response`: JSON object, default empty object, blank allowed
- `latency_ms`: positive integer, nullable and blank allowed
- `error_message`: text, blank allowed
- `created_at`: auto-created timestamp

`browser_event_id` is stored as a UUID rather than a hard foreign key so the AI
app stays loosely coupled to tracking and avoids future circular import issues.

## Indexes added

`WarningEvent`:

- `session_id`, `created_at`
- `warning_level`
- `warning_type`

`AIAnalysisResult`:

- `session_id`, `created_at`
- `relevance_score`
- `focus_state`
- `is_relevant`

## Admin registration

- `WarningEvent` is registered in Django Admin.
- `AIAnalysisResult` is registered in Django Admin.

## Migration names

- `apps/tracking/migrations/0002_warningevent.py`
- `apps/ai/migrations/0001_initial.py`

## Validation output

- `python manage.py makemigrations tracking ai`: no changes detected after
  generated migrations were present.
- `python manage.py makemigrations --check --dry-run`: no changes detected.
- `python manage.py migrate`: applied all migrations successfully, including
  `ai.0001_initial` and `tracking.0002_warningevent`.
- `python manage.py check`: system check identified no issues.
- `python manage.py test`: 40 tests passed.

## Known limitations

- No AI provider integration is implemented yet.
- No rule engine or warning trigger pipeline is implemented yet.
- No realtime scoring or final scoring logic is implemented yet.
- `AIAnalysisResult.browser_event_id` is a UUID reference for now, not a
  database-level foreign key.
- `session_id` remains a UUID field instead of a hard `FocusSession` foreign key
  to preserve the existing Day 2 to Day 5 API boundaries.

## Next steps for Day 7 / Week 2

- Add warning-generation services that create `WarningEvent` rows from browser
  events and session state.
- Add AI analysis orchestration that persists `AIAnalysisResult` rows.
- Add hybrid focus-state decision logic using rules plus AI analysis.
- Add realtime score calculation using stored browser events, warnings, and AI
  analysis results.
