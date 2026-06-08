# Dev 2 Day 2

## Files created

- `apps/tracking/models.py`
- `apps/tracking/admin.py`
- `apps/tracking/migrations/__init__.py`
- `apps/tracking/migrations/0001_initial.py`
- `apps/extension/models.py`
- `apps/extension/admin.py`
- `apps/extension/migrations/__init__.py`
- `apps/extension/migrations/0001_initial.py`
- `docs/dev2_day2.md`

## Models added

- `apps.tracking.models.BrowserEvent`
- `apps.tracking.models.EventBatch`
- `apps.extension.models.ExtensionHeartbeat`

All models use UUID primary keys, default ordering, `__str__` methods, and
indexes for their expected lookup patterns. All three models are registered
with Django Admin.

## Fields added

### BrowserEvent

- `id`
- `session_id`
- `event_type`
- `url`
- `domain`
- `page_title`
- `meta_description`
- `content_snippet`
- `active_seconds`
- `idle_seconds`
- `tab_switch_count`
- `created_at`

### EventBatch

- `id`
- `session_id`
- `batch_size`
- `processed`
- `received_at`
- `processed_at`

### ExtensionHeartbeat

- `id`
- `user_id`
- `extension_version`
- `browser`
- `is_active`
- `last_seen`
- `created_at`

## Migration names

- `extension.0001_initial`
- `tracking.0001_initial`

## Validation results

Validation used an isolated SQLite database configured through environment
variables.

- `python manage.py makemigrations tracking extension`: created both initial
  migrations.
- `python manage.py makemigrations`: no changes detected after generation.
- `python manage.py makemigrations --check --dry-run`: no changes detected.
- `python manage.py migrate`: applied `extension.0001_initial` and
  `tracking.0001_initial` successfully.
- `python manage.py check`: no issues identified.
- Model persistence check: created one row for each model successfully.
- Django Admin registration check: all three models registered.
- `python manage.py test`: 26 tests passed.

No authentication logic, session API, frontend code, or other Dev 2 feature
layers were modified.
