# Dev 1 Week 1

## Delivered

- Django/DRF backend configured for PostgreSQL, Redis, Celery, CORS, CSRF, and
  session authentication.
- Custom email-based `User` with `Profile`, `UserPreference`, and
  `OnboardingSurvey`.
- Registration, login, logout, current-user, profile, preferences, and
  onboarding APIs.
- Built-in and custom goal template library. The data migration seeds the 15
  templates used by the current frontend.
- Focus session schema with tags, notes, state-transition audit records, and
  atomic start/pause/resume/end/cancel lifecycle operations.
- Compatibility aliases for the current Next.js API client.

## Run locally

```powershell
Copy-Item .env.example .env
python -m pip install -r requirements.txt
docker compose up -d postgres redis
python manage.py migrate
python manage.py runserver
```

PostgreSQL is the default database. Tests may use SQLite without changing the
normal runtime configuration:

```powershell
$env:DATABASE_ENGINE = "sqlite"
$env:SQLITE_PATH = "$env:TEMP\focusos-tests.sqlite3"
python manage.py test
```

## API routes

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `GET /api/auth/csrf/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`
- `GET|PUT|PATCH /api/users/profile/`
- `GET|PUT|PATCH /api/users/preferences/`
- `POST /api/onboarding/complete/`
- `GET|POST /api/goal-templates/`
- `GET|PUT|PATCH|DELETE /api/goal-templates/{id}/`
- `GET|POST /api/sessions/`
- `GET|PATCH /api/sessions/{id}/`
- `POST /api/sessions/{id}/pause/`
- `POST /api/sessions/{id}/resume/`
- `POST /api/sessions/{id}/end/`
- `POST /api/sessions/{id}/cancel/`

The aliases `/api/user/profile/`, `/api/user/preferences/`,
`/api/auth/onboarding/`, and `/api/sessions/templates/` remain available for
the existing frontend.

## Lifecycle rules

- A user can have only one active, paused, or auto-paused session.
- Deep Work requires a goal; a selected template can supply that goal.
- A session accepts at most three user-owned tags.
- State transitions are validated, locked with database transactions, and
  recorded with timestamps.
- Actual duration is calculated by the server and excludes paused time.
- Cancelled sessions remain stored but do not increment completed-session
  totals.

