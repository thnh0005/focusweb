# Dev 2 Day 1

## Apps created

- `apps.tracking`
- `apps.extension`
- `apps.ai`
- `apps.scoring`

## Service skeletons created

- `apps/tracking/services/privacy_validator.py`
  - `PrivacyValidator.validate_browser_payload(payload: dict) -> dict`
- `apps/tracking/services/event_ingest_service.py`
  - `EventIngestService.ingest_batch(user, session_id, events: list) -> dict`
- `apps/extension/services/active_session_service.py`
  - `ActiveSessionService.get_active_session_for_user(user) -> dict | None`
- `apps/ai/services/ai_client.py`
  - `AIClient.analyze_relevance(goal: str, title: str = "", meta: str = "", snippet: str = "") -> dict`
- `apps/ai/services/prompt_builder.py`
  - `PromptBuilder.build_relevance_prompt(goal, title, meta, snippet) -> str`
- `apps/scoring/services/score_calculator.py`
  - `ScoreCalculator.calculate_realtime_score(events: list) -> dict`

## Worker status

Celery is already configured in this backend:

- `celery` is present in `requirements.txt`
- `config/celery.py` exists
- `config/__init__.py` imports the Celery app
- `apps/ai/tasks.py` defines `debug_ai_worker_task` with `@shared_task`

## Not done on Day 1

- No tracking, extension, AI, or scoring models were added.
- No migrations were created or run for Dev 2 modules.
- No auth, session, or health endpoint changes were made.
- No real AI provider API calls were added.
- No database session lookup was added for extension active-session behavior.
- Day 2 should add real schemas/models and persistence once the module contracts are confirmed.
