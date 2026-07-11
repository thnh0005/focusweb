# Groq Docker Env Debug Progress

## Goal

Debug why host curl works but FocusOS app/Celery does not.

## Env Source

* docker-compose env_file: none. `docker-compose.yml` uses root `.env` for Compose interpolation and injects values through inline `environment`.
* backend env: shared `x-backend-environment` anchor.
* celery_worker env: same shared `x-backend-environment` anchor.
* celery_beat env: same shared `x-backend-environment` anchor.
* duplicate env issue: no duplicate Groq/OpenRouter lines found in root `.env`.

## Safe Env Diagnostics

* backend base URL: `https://api.groq.com/openai/v1`
* backend model: `llama-3.1-8b-instant`
* backend document summary model: `llama-3.1-8b-instant`
* backend flashcard model: `llama-3.1-8b-instant`
* backend key prefix: `gsk_NC***`
* celery base URL: `https://api.groq.com/openai/v1`
* celery model: `llama-3.1-8b-instant`
* celery document summary model: `llama-3.1-8b-instant`
* celery flashcard model: `llama-3.1-8b-instant`
* celery key prefix: `gsk_NC***`
* AI_SEMANTIC_REALTIME_ENABLED: `false`

## Container Groq Test

* backend status before client fix: `403`
* backend result before client fix: Groq/Cloudflare `Error 1010: Access denied`, `browser_signature_banned`.
* celery status before client fix: `403`
* celery result before client fix: Groq/Cloudflare `Error 1010: Access denied`, `browser_signature_banned`.
* backend status after adding explicit `User-Agent`: `200`
* celery status after adding explicit `User-Agent`: `200`
* final URL shape: `https://api.groq.com/openai/v1/chat/completions`

## App Task Test

* task tested: `apps.ai.tasks.generate_document_summary`
* input: existing ready document, `mode=key_points`, `force=False`
* celery log result: task received and succeeded in about 1.35 seconds.
* task result: `status=completed`, `cached=False`, `error_code=`
* error code if any: none.

## Root Cause

* Docker env values were correct after adding explicit task model env passthroughs.
* Groq requests from Python `urllib` were blocked by Cloudflare with `403 Error 1010 browser_signature_banned`.
* The same in-container request returned `200` when an explicit `User-Agent` header was sent.
* `AIClient` now sends `User-Agent: FocusOS/0.1 (+https://localhost)`.

## Files Changed

* `docker-compose.yml`: pass `DOCUMENT_SUMMARY_MODEL` and `FLASHCARD_GENERATION_MODEL` to backend, celery worker, and celery beat through the shared env anchor.
* `.env`: set `DOCUMENT_SUMMARY_MODEL` and `FLASHCARD_GENERATION_MODEL` to the Groq model.
* `.env.example`: document Groq-compatible defaults and task model env vars.
* `backend/.env.example`: replace API key with a placeholder, document Groq-compatible defaults, task model env vars, and disabled realtime AI.
* `backend/apps/ai/services/ai_client.py`: add explicit `User-Agent` header.
* `GROQ_DOCKER_ENV_DEBUG_PROGRESS.md`: this progress report.

## Commands Run

* Command: `docker compose config`
* Result: backend, celery worker, and celery beat render Groq base/model/key env plus document and flashcard model env.
* Command: safe `printenv` diagnostics inside `backend` and `celery_worker`
* Result: both containers have matching Groq env values and key prefix.
* Command: Python Groq ping inside `backend` and `celery_worker`
* Result: `403` before explicit `User-Agent`, `200` after explicit `User-Agent`.
* Command: `docker compose up -d --build --force-recreate`
* Result: stack recreated successfully.
* Command: `docker compose restart backend celery_worker celery_beat`
* Result: long-running Python services restarted after code change.
* Command: `docker compose exec -T backend python manage.py check`
* Result: passed.
* Command: `docker compose exec -T backend python manage.py test apps.ai.tests.AIClientTests`
* Result: 11 tests passed.
* Command: Celery debug task round trip
* Result: `{'status': 'ok', 'worker': 'ai', 'provider': 'celery_debug'}`
* Command: document summary Celery task
* Result: completed successfully with no error code.

## Final Fix / Recommendation

* Keep realtime semantic AI disabled.
* Recreate containers whenever `.env` or Compose env wiring changes:

```powershell
docker compose down
docker compose up -d --build --force-recreate
```

* The AI flow is ready to test again from the UI. If another failure appears, inspect the backend request handling or document-specific parsing/state rather than provider auth/env.
