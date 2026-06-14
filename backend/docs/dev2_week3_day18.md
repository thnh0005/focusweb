# Dev2 Week 3 Day 18 - Notification Scheduler

## Notification Types

- `session_reminder`: daily reminder when a user has not started any focus session today.
- `weekly_summary`: weekly report-ready notification using `WeeklyFocusReportService`.
- `deep_work_suggestion`: suggestion before the user's best historical focus window.
- `test`: database-backed test notification created by `POST /api/notifications/test/`.

## Trigger Conditions

- Daily reminder requires global notifications and session reminder enabled, current local time at or after the reminder time, and no session started that local day.
- Weekly summary requires global notifications and weekly summary enabled. It is eligible on Monday local time and summarizes the previous calendar week.
- Deep Work suggestion requires global notifications and deep work suggestion enabled, at least two weeks of scored completed session data, at least five valid sessions, no active session, ready pattern detection, and the current local time inside the 30-minute lead window before best focus time.

## Frequency Limits And Dedupe Keys

- Daily reminder: one per user per local date, `session_reminder:{user_id}:{local_date}`.
- Weekly summary: one per user per reported week, `weekly_summary:{user_id}:{week_start}`.
- Deep Work suggestion: one per user per local date, `deep_work_suggestion:{user_id}:{local_date}`.
- Test notification: unique timestamped key, `test:{user_id}:{timestamp}`.

All notification creation uses `get_or_create` with a unique `dedupe_key`.

## Scheduler Frequency

The project has Celery configured, but no Celery Beat schedule is currently defined. Suggested schedules:

- `process_daily_session_reminders`: every 15-30 minutes.
- `process_weekly_summary_notifications`: hourly on Mondays, or every hour with service-side local Monday filtering.
- `process_deep_work_suggestions`: every 15-30 minutes.

Do not create per-user schedules.

## Timezone Handling

Timezone priority:

1. `user.preferences.timezone` if a future settings model adds it.
2. `user.profile.timezone` if a future profile model adds it.
3. `settings.TIME_ZONE`.

Invalid timezone strings fall back to `settings.TIME_ZONE` and log a safe warning.

## Manual Task Execution

From Django shell:

```python
from apps.notifications.tasks import (
    process_daily_session_reminders,
    process_weekly_summary_notifications,
    process_deep_work_suggestions,
    generate_notification_for_user,
)

process_daily_session_reminders.delay()
process_weekly_summary_notifications.delay()
process_deep_work_suggestions.delay()
generate_notification_for_user.delay(str(user.id), "session_reminder")
```

For synchronous local testing:

```python
process_daily_session_reminders.run()
```

## Test Endpoint

`POST /api/notifications/test/`

Payload:

```json
{"type": "session_reminder"}
```

Supported values: `session_reminder`, `weekly_summary`, `deep_work_suggestion`, `generic`.

The endpoint always creates a `test` notification for `request.user`. It does not accept custom title/message/user ID.

## Delivery Backend

Day 18 uses a database-backed in-app notification record. `NotificationDeliveryBackend.deliver()` marks the record as delivered. Browser push, email, Firebase, and Web Push are not configured.

## Known Limitations

- No Celery Beat schedule is configured yet.
- No browser push or email delivery backend exists.
- User timezone is not persisted in the current `UserPreference` schema; the service is ready to read it if Dev 1 adds that field later.
