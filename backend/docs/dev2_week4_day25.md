# Dev 2 Week 4 Day 25 - Study Report PDF Export

## Scope

Day 25 extends Dev 1's existing analytics report export model and endpoints:

- `POST /api/reports/export/`
- `GET /api/reports/export/{job_id}/`

No Theme Preference, Ambient Effects Preference, frontend, account export, or external AI generation work is included.

## POST Export Flow

1. Authenticated user posts `format=pdf` with either `date_from` and `date_to`, or `range=7d|30d`.
2. Request validation rejects unsupported formats, future dates, reversed dates, and ranges over 365 days.
3. The API computes a stable SHA-256 fingerprint from user, range, format, and report version.
4. Existing pending, processing, or valid completed jobs for the same fingerprint are reused.
5. New jobs are created as `pending` and queued with `transaction.on_commit()`.
6. The Celery task loads the job by ID and calls `StudyReportExportService`.
7. The service aggregates user-scoped report data, renders a PDF, stores it through Django storage, and marks the job completed or failed.

Existing Dev 1 JSON/HTML fallback behavior is preserved for compatibility.

## Job Statuses

- `pending`: job accepted and waiting for worker.
- `processing`: worker claimed the job.
- `completed`: PDF generated and stored.
- `failed`: safe error code/message recorded.
- `expired`: completed file expired and was cleaned up.
- `ready`: retained for existing Dev 1 JSON/HTML jobs.

Progress convention:

- `0`: pending.
- `20`: processing/aggregation started.
- `60`: rendering started.
- `90`: storing started.
- `100`: completed.

## Date Range And Timezone

The PDF path accepts:

```json
{
  "date_from": "2026-06-01",
  "date_to": "2026-06-30",
  "format": "pdf"
}
```

or:

```json
{
  "range": "30d",
  "format": "pdf"
}
```

Rules:

- Dates are interpreted in the resolved user timezone.
- The start bound is local `00:00:00` on `date_from`.
- The end bound is before local `00:00:00` after `date_to`.
- Queries use timezone-aware UTC datetimes.
- Invalid/missing user timezone falls back to `settings.TIME_ZONE`, then UTC.
- Maximum range is 365 days.

## Data Sections

The report data view model contains:

- Period metadata.
- Summary metrics.
- Session list.
- Focus score trend grouped by local date.
- Distraction summary.
- Mode breakdown.
- Saved AI session insights when present.
- Generation metadata.

## Summary Metrics

The builder calculates:

- Total focus minutes/hours from completed sessions' actual duration.
- Total session count.
- Completed and cancelled session counts.
- Normal and deep work session counts.
- Average focus score from completed scored sessions.
- Completion rate.
- Total warnings and average warnings per session.
- Active focus days.
- Best focus day by completed focus time.

Zero-session reports are valid and render as empty reports.

## Data Not Exported

The export intentionally excludes:

- Full URLs.
- Query strings.
- Page titles.
- Meta descriptions.
- Content snippets.
- Raw browser event payloads.
- Warning messages.
- Session cookies or tokens.
- AI prompts.
- Provider raw responses.
- Internal storage paths.

Session goals and tags may be included because this is the user's own private report. Text is escaped, control characters are removed, and long strings are truncated.

## PDF Renderer

`StudyReportPDFRenderer` uses ReportLab.

The renderer:

- Accepts only sanitized report data.
- Does not query the database.
- Does not call AI or network services.
- Does not accept template paths or arbitrary HTML from the client.
- Returns PDF bytes and checks for the `%PDF` header in the export service.

## Unicode Vietnamese Support

The renderer tries to register a Unicode TrueType font from deployment/system font locations, including an optional `REPORT_PDF_FONT_PATH`. If no Unicode font is available, it falls back to ReportLab's default font.

Tests verify Unicode input does not crash rendering. Exact visual glyph rendering is environment-dependent unless a Unicode font is deployed.

## Storage

Files are stored through Django's configured storage using the model `FileField`.

Path convention:

```text
reports/exports/user-{user_id}/job-{job_id}/study-report-{date_from}-{date_to}.pdf
```

The client cannot provide filename, path, template path, HTML, or report content. The API response exposes the storage URL only, not an internal filesystem path.

## Ownership And Download Preparation

Both POST and GET use `request.user`.

Protections:

- Client `user_id` is ignored.
- Job lookup is scoped by authenticated user.
- Worker exports only `job.user` data.
- Other users' sessions, warnings, and insights are excluded.
- Other users cannot retrieve job status.
- Completed jobs expose `downloadReady=true`; pending, failed, and expired jobs do not.

## Idempotency

The generation fingerprint is canonical JSON hashed with SHA-256 using:

- `user_id`
- `date_from`
- `date_to`
- `format`
- `report_version`

The model enforces a per-user unique fingerprint for non-empty fingerprints. Repeat POSTs reuse pending/processing/completed jobs when valid. Failed or expired jobs with the same fingerprint are reset and reused safely.

## Async Task

Task:

```text
generate_study_report_export_task(job_id)
```

The task only receives a primitive `job_id`, loads the job internally, and delegates to `StudyReportExportService`. It does not receive request objects, user models, report data, or PDF bytes through the queue.

The task has limited retry for unexpected transient exceptions. Business `ReportExportError` failures are persisted on the job and are not retried indefinitely.

## Error Codes

Implemented error codes include:

- `INVALID_REPORT_DATE_RANGE`
- `REPORT_RANGE_TOO_LARGE`
- `PDF_RENDER_FAILED`
- `REPORT_EXPORT_FAILED`

The API and job state do not expose tracebacks, internal paths, database details, storage credentials, or raw PDF library exceptions.

## Expiration And Cleanup

Completed PDF exports expire after 14 days. Cleanup deletes the stored file and marks the job `expired`.

Task:

```text
cleanup_expired_report_exports_task()
```

The cleanup function is idempotent and ignores pending/processing jobs.

## Dev 1 Integration Notes

Dev 1's `ReportExportJob`, `ReportExportRequestSerializer`, `ReportExportJobSerializer`, `ReportExportView`, and `ReportExportDetailView` are reused.

The existing routes are not duplicated:

- `reports/export/`
- `reports/export/<uuid:job_id>/`

The existing `ready` status and JSON/HTML fallback path remain for compatibility.

## Tests

Targeted Day 25 tests live in:

```text
apps.analytics.test_day25_export
```

Coverage includes:

- Data builder user scoping and privacy exclusions.
- Empty report data.
- PDF bytes generation.
- Fingerprint stability and user scoping.
- Pending job idempotency.
- Export service status and file metadata.
- Expired export cleanup.
- POST authentication and enqueue behavior.
- Invalid date range API response.
- Cross-user status access denial.

## Known Limitations

- The Day 25 status endpoint returns file metadata and storage URL only; a dedicated streaming download endpoint can be added by Dev 1 if required.
- PDF layout is intentionally simple for MVP and uses tables rather than chart dependencies.
- Saved AI insights are reused only when already present; no external AI provider is called during export.
- Local `migrate` may be blocked in a dirty worktree by unrelated pending AI migrations; the Day 25 test database migration path passed during targeted tests.
