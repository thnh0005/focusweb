# Dev 2 Day 3

## Goal

Implement authenticated extension heartbeat reporting and active focus-session
synchronization APIs.

## APIs implemented

### POST `/api/extension/heartbeat/`

Creates the current user's first heartbeat or updates their latest heartbeat.
Each accepted heartbeat marks the extension active and refreshes `last_seen`.

Request:

```json
{
  "extension_version": "1.1.0",
  "browser": "chrome"
}
```

Response:

```json
{
  "status": "ok",
  "connected": true,
  "last_seen": "2026-06-04T14:00:00Z"
}
```

### GET `/api/extension/active-session/`

Returns the authenticated user's session only when its status is `active`.
Paused, auto-paused, completed, cancelled, and other users' sessions are not
returned.

Response with an active session:

```json
{
  "has_active_session": true,
  "session": {
    "id": "5ca74761-0d23-40ab-bbaf-57cebea9b6a9",
    "userId": "9fd448b4-b9d3-4866-b873-f59606bf2ac3",
    "mode": "normal",
    "goal": "Finish extension synchronization",
    "tags": [],
    "targetDurationSeconds": 3000,
    "startedAt": "2026-06-04T14:00:00Z",
    "status": "active"
  }
}
```

Response without an active session:

```json
{
  "has_active_session": false,
  "session": null
}
```

Both endpoints require authentication. Anonymous requests return Django REST
Framework's configured unauthenticated response.

## Files changed

- `apps/extension/serializers.py`
- `apps/extension/views.py`
- `apps/extension/urls.py`
- `apps/extension/services/__init__.py`
- `apps/extension/services/active_session_service.py`
- `apps/extension/services/heartbeat_service.py`
- `apps/extension/tests.py`
- `docs/dev2_day3.md`

`config/urls.py` already includes `apps.extension.urls` under `/api/`, so no
additional project URL change was required. The existing service package was
used instead of creating a conflicting `apps/extension/services.py` module.

## Validation result

- `python manage.py makemigrations`: no changes detected.
- `python manage.py migrate`: all migrations applied successfully.
- `python manage.py check`: no issues identified.
- `python manage.py test apps.extension.tests`: 6 tests passed.
- `python manage.py test`: full test suite passed.

## Known limitations

- Heartbeats update the latest heartbeat row for a user. The Day 2 model does
  not enforce a unique database constraint on `user_id`.
- Active-session synchronization is read-only and does not create or modify
  session lifecycle state.
- If the FocusSession model is unavailable, the active-session service
  defensively returns no active session.
