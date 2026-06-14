# Dev 2 Week 4 Day 26 - GDPR Account Export And Deletion Jobs

## Scope

Day 26 wires Dev 1's existing account endpoints to background jobs:

- `POST /api/account/export-data/`
- `DELETE /api/account/delete/`

Change password is unchanged.

## Account Export Flow

1. Authenticated user calls `POST /api/account/export-data/`.
2. The endpoint creates or reuses an `AccountDataExportJob`.
3. The endpoint enqueues `generate_account_data_export_task(job_id)` with `transaction.on_commit()`.
4. The worker claims the job, builds user-scoped export sections, writes a ZIP archive, stores it with Django storage, and marks the job completed.
5. Repeated requests reuse pending, processing, or unexpired completed jobs.

## Export Sections

The ZIP archive contains UTF-8 JSON files under `focusos-account-export/`:

- `manifest.json`
- `account.json`
- `preferences.json`
- `onboarding.json`
- `goal_templates.json`
- `sessions.json`
- `scores.json`
- `warnings.json`
- `browser_events.json`
- `blacklist.json`
- `extension.json`
- `notifications.json`
- `documents.json`
- `summaries.json`
- `flashcards.json`
- `reports.json`
- `ai_insights.json`

Uploaded document binaries are not included because the current `StudyDocument` model stores metadata/extracted text, not a `FileField`. The manifest records `binary_files_included=false`.

## Excluded Data

The export excludes:

- Password hash and raw password.
- Session cookies and session keys.
- CSRF tokens.
- API keys and environment secrets.
- Internal storage paths.
- Storage credentials.
- Raw provider responses.
- Tracebacks and internal exception details.
- Other users' data.

## Archive Format

Format: ZIP containing JSON files.

The archive writer uses server-controlled archive member names only. It does not accept client filenames or paths, does not write absolute paths, and avoids `..` path traversal.

`manifest.json` includes export version, generation time, user ID, format, binary-file limitation, and section record counts.

## Storage And Expiration

Storage path convention:

```text
account-exports/user-{user_id}/job-{job_id}/focusos-account-data.zip
```

Files are stored through Django storage, not in the database. Completed export jobs expire after 7 days. `cleanup_expired_account_exports_task()` deletes expired ZIP files and marks jobs `expired`.

## Export Idempotency

The export fingerprint uses SHA-256 over canonical JSON:

- `user_id`
- `export_version`
- latest relevant user-owned data timestamp

Pending/processing jobs are reused. Completed unexpired jobs are reused as cache hits. Failed/expired jobs with the same fingerprint are reset and reused safely.

## Export Task

Task:

```text
generate_account_data_export_task(job_id)
```

The task receives only a primitive job ID, loads the job internally, and calls `AccountDataExportService`. It does not receive request objects, user model instances, archive bytes, or export data through the queue.

## Account Deletion Flow

1. Dev 1 endpoint validates account deletion confirmation/password.
2. Endpoint creates a confirmed `AccountDeletionJob`.
3. Endpoint logs out the current request and enqueues `delete_account_data_task(job_id)` after transaction commit.
4. Worker claims the confirmed job.
5. User is marked inactive before long cleanup.
6. Django sessions for the user are revoked.
7. Pending account export jobs are cancelled; pending study report exports are failed with `ACCOUNT_DELETED`.
8. Generated account export ZIPs and study report PDFs are deleted through Django storage.
9. UUID-only rows that do not cascade from `User` are deleted explicitly: browser events, warning events, event batches, AI analysis results, extension heartbeats.
10. The user record is deleted and normal `CASCADE` relationships remove sessions, scores, profile, preferences, documents, flashcards, notifications, and custom blacklist entries.
11. The deletion job is retained with `user=null` and non-personal audit summary.

## Confirmation Boundary

The worker does not validate passwords. It only processes a job that the authenticated endpoint created with `confirmed=true`.

Unconfirmed jobs fail with `ACCOUNT_DELETION_NOT_CONFIRMED`.

## Session Revocation

The service scans Django session rows, decodes session data, and deletes sessions whose `_auth_user_id` matches the deleted user. It does not log or export session keys. Other users' sessions are left intact.

No token model exists in the current backend; token revocation is therefore not applicable for Day 26.

## File Cleanup

The deletion service deletes:

- Account export ZIP files.
- Study report PDF files.

The current document model has no uploaded file `FileField`, so document binary cleanup is a known limitation. Database document rows are removed by cascade when the user is deleted.

## Database Deletion Strategy

The service does not hold one long transaction while deleting storage files.

It uses short transactions for:

- Claiming the deletion job and marking the user inactive.
- Final database deletion and audit update.

Explicit UUID-only cleanup happens before `user.delete()` because those models do not have foreign keys to `FocusSession` or `User`.

## Pending Jobs

During deletion:

- Pending/processing `AccountDataExportJob` records are marked `cancelled`.
- Pending/processing `ReportExportJob` records are marked `failed` with `ACCOUNT_DELETED`.

Existing broker messages are not revoked directly; tasks are expected to load jobs and fail safely if the user/job no longer exists or was cancelled.

## Audit And Anonymization

No broad audit-log system exists. The retained deletion job stores only:

- Deletion version.
- Completion timestamp.
- Counts for revoked sessions, deleted files, and deleted row groups.

It does not retain email, display name, password, session key, token, or user content.

## Error Codes

Export:

- `ACCOUNT_EXPORT_FAILED`

Deletion:

- `ACCOUNT_DELETION_NOT_CONFIRMED`
- `ACCOUNT_DELETION_FAILED`
- `ACCOUNT_DELETED` for jobs cancelled because of deletion.

## Dev 1 Integration

Reused existing endpoints:

- `POST /api/account/export-data/`
- `DELETE /api/account/delete/`

No duplicate routes were added. Change-password was not changed.

## Tests

Targeted Day 26 tests live in:

```text
apps.users.test_day26_account_jobs
```

Coverage includes:

- User-scoped archive sections.
- Sensitive-field exclusion.
- Manifest and ZIP path safety.
- Export idempotency and expiration cleanup.
- Export endpoint enqueue after commit.
- Deletion confirmation guard.
- Session revocation.
- User file cleanup.
- User data deletion while preserving other users.
- Delete endpoint enqueue after commit.

## Known Limitations

- Account export currently includes document metadata/extracted/generated content, not uploaded binary files, because no document `FileField` exists in the current schema.
- There is no token-auth model to revoke.
- There is no global audit log model; the deletion job is the minimal retained audit record.
- Local `manage.py migrate` is blocked by an unrelated pending AI migration (`ai.0003_documentsummary...`) before the new users migration can run against the existing SQLite database. Test database migration succeeded during targeted Day 26 tests.
