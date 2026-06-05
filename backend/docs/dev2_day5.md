# Dev 2 Day 5

## Goal

Harden browser-event ingest so extension tracking payloads stay within the
FocusOS privacy boundary before any event is stored.

## Privacy boundary

The event batch endpoint rejects events containing unknown or sensitive fields.
Rejected events are not persisted. Valid events in the same batch are still
stored, and `rejected_count` reflects the number of rejected events.

Endpoint:

- `POST /api/sessions/{id}/events/batch/`

## Allowed fields

- `event_type`
- `url`
- `domain`
- `page_title`
- `meta_description`
- `content_snippet`
- `active_seconds`
- `idle_seconds`
- `tab_switch_count`

`occurred_at` is not accepted yet because the Day 2 `BrowserEvent` model does
not currently store it.

## Disallowed fields

- `password`
- `passwords`
- `form_input`
- `form_inputs`
- `input_value`
- `input_values`
- `keyboard_input`
- `keystrokes`
- `private_message`
- `private_messages`
- `message_body`
- `email_body`
- `full_page_content`
- `html`
- `raw_html`
- `cookies`
- `local_storage`
- `session_storage`
- `token`
- `access_token`
- `refresh_token`
- `authorization`

The validator also catches camelCase variants such as `keyboardInput` and
`localStorage`.

## Validation behavior

- Sensitive or unknown fields reject the event.
- Sensitive or unknown fields are never stored.
- `content_snippet`, `meta_description`, and `page_title` are limited to 500
  characters.
- `domain` is limited to 255 characters.
- `url` is optional; when present, it must be a valid URL and no longer than
  2048 characters.
- `active_seconds` and `idle_seconds` must be between 0 and 86400.
- `tab_switch_count` must be between 0 and 10000.
- Batches must contain 1 to 100 events.

## Request example

```json
{
  "events": [
    {
      "event_type": "url_change",
      "url": "https://docs.djangoproject.com/en/stable/topics/auth/",
      "domain": "docs.djangoproject.com",
      "page_title": "Django authentication",
      "meta_description": "Django authentication system documentation",
      "content_snippet": "Django comes with a user authentication system...",
      "active_seconds": 45,
      "idle_seconds": 0,
      "tab_switch_count": 1
    }
  ]
}
```

## Response example

```json
{
  "status": "ok",
  "batch_id": "ad1c4d95-51bb-4749-bd63-cd2ddc4968a9",
  "accepted_count": 1,
  "rejected_count": 0
}
```

## Files changed

- `apps/tracking/privacy.py`
- `apps/tracking/serializers.py`
- `apps/tracking/services/privacy_validator.py`
- `apps/tracking/tests.py`
- `docs/dev2_day5.md`

## Test and validation output

- `python manage.py makemigrations --check --dry-run`: no changes detected.
- `python manage.py check`: no issues identified.
- `python manage.py test apps.tracking.tests`: 9 tests passed.
- `python manage.py test`: full test suite passed.

## Known limitations

- Event-level rejection reasons are not returned in the public API response;
  only aggregate counts are returned.
- `occurred_at` remains unsupported until the `BrowserEvent` schema adds that
  field.
- AI scoring, rule engine behavior, realtime scoring, and final scoring are
  intentionally not implemented on Day 5.
