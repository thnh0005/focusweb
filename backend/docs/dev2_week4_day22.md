# Dev2 Week 4 Day 1 - Smart Deep Work Preset

Day 22 adds `GET /api/smart-preset/`, a deterministic preset endpoint for
pre-filling a focus-session form.

## Endpoint

`GET /api/smart-preset/`

Supported ranges:

- `30d` default
- `90d`
- `all`

Invalid ranges return HTTP 400. The endpoint requires authentication and always
uses `request.user`.

## Minimum Data

Personalization requires at least 5 valid sessions: owned by the user,
completed, not cancelled, and with a Focus Score. Under 5 sessions returns
`status=insufficient_data`, `personalized=false`, and a clearly marked fallback
preset.

## Reuse

`SmartPresetService` calls `PatternDetectionService` once and passes that result
into `FocusRecommendationService`, so Day 15 and Day 16 logic remain the source
for best duration, mode, break, and preferred time.

## Preset Fields

- `mode`: `normal` or `deep_work`
- `requires_goal`: true only for `deep_work`
- `duration_minutes`: frontend-friendly integer such as 25, 40, 50, 75, or 90
- `break_minutes`: integer break recommendation
- `preferred_time`: time bucket from pattern detection, or null
- `confidence`: `default`, `low`, `medium`, or `high`
- `reason_codes`: stable codes for frontend logic

## Fallback

Fallback order:

1. Personalized recommendation when enough history exists.
2. `UserPreference.default_mode` and `default_duration_minutes` when available.
3. System default `normal`, 25 minutes, 5 minute break.

GET never writes these fallback values to preferences.

## Privacy

The endpoint returns aggregate preset data only. It does not return session IDs,
URLs, titles, meta descriptions, snippets, prompts, or data from another user.
It does not call external AI, create sessions, change preferences, change
blacklists, send notifications, or create session tags.

## Known Limitations

The confidence rule is deterministic and intentionally conservative. Domain or
tag-specific presets can be added later when Session Tags are finalized by Dev 1.
