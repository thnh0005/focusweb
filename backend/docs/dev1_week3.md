# Dev 1 Tuần 3

Trạng thái: đã làm phần Dev 1 theo file phân chia công việc. Tuần 1 và tuần 2
đã được đối chiếu lại, chưa thấy thiếu hạng mục Dev 1 chính. Các phần Pattern
Detection, Recommendation, Weekly Report job, AI summary/generation và
notification scheduler vẫn thuộc Dev 2.

## Đối Chiếu Tuần 1 Và Tuần 2

Tuần 1 đã có:

- Auth register/login/logout/me bằng session auth và CSRF.
- Profile, preferences, onboarding complete.
- Goal template library built-in và custom.
- FocusSession, SessionTag, SessionNote, state transition audit.
- API create/pause/resume/end/cancel session.

Tuần 2 đã có:

- Blacklist CRUD, default domains và sync payload cho extension.
- FocusScore, ScoreComponent và focus state classification.
- Final score khi session completed.
- Session history, detail và summary API.
- Dashboard overview MVP.

## Checklist Tuần 3 Dev 1

| Yêu cầu | Trạng thái | File chính |
| --- | --- | --- |
| `GET /api/analytics/overview/` | Đã làm | `apps/analytics/views.py` |
| `GET /api/analytics/focus-trend/` | Đã làm | `apps/analytics/urls.py` |
| `GET /api/analytics/distractions/` | Đã có fallback Dev1 | `apps/analytics/views.py` |
| `GET /api/analytics/time-heatmap/` | Đã làm | `apps/analytics/urls.py` |
| `GET /api/analytics/session-breakdown/` | Đã làm | `apps/analytics/views.py` |
| `GET /api/analytics/weekly-snapshot/` | Đã làm phần Dev1 | `apps/analytics/views.py` |
| `GET/PUT /api/notifications/settings/` | Đã làm | `apps/users/views.py` |
| `GET/POST/DELETE /api/documents/` | Đã làm, delete qua detail route | `apps/ai/views.py` |
| `GET /api/flashcard-decks/` | Đã làm | `apps/ai/views.py` |
| `GET/PATCH/DELETE /api/flashcard-decks/{id}/` | Đã làm | `apps/ai/views.py` |
| `POST /api/flashcard-decks/{id}/review-session/` | Đã làm | `apps/ai/views.py` |

## API Đã Thêm

- `GET /api/analytics/overview/`
- `GET /api/analytics/focus-trend/`
- `GET /api/analytics/time-heatmap/`
- `GET /api/analytics/session-breakdown/`
- `GET|PUT|PATCH /api/notifications/settings/`
- `GET|POST /api/documents/`
- `POST /api/documents/upload/`
- `GET|PATCH|DELETE /api/documents/{id}/`
- `GET|POST /api/documents/{id}/summary/`
- `GET|POST /api/documents/{id}/flashcards/`
- `POST /api/documents/{id}/flashcards/generate/`
- `GET /api/flashcard-decks/`
- `GET|PATCH|DELETE /api/flashcard-decks/{id}/`
- `POST /api/flashcard-decks/{id}/review-session/`

## Ghi Chú Dev1/Dev2

- Document upload tuần 3 lưu metadata và text trích xuất bằng fallback parser.
- Summary và flashcards hiện là server fallback để UI test được. Dev2 có thể thay
  bằng AI summary/generation mà không đổi response shape.
- Distraction analytics hiện trả mảng rỗng vì warning event thuộc Dev2.
- Weekly snapshot có số liệu Dev1; AI recommendation thuộc Dev2.
- Notification settings chỉ lưu cấu hình. Scheduler/push notification thuộc Dev2.

## Kiểm Thử

```powershell
cd focusweb\backend
$env:DJANGO_SECRET_KEY="focusos-dev-secret-key"
$env:DATABASE_ENGINE="sqlite"
$env:SQLITE_PATH="$env:TEMP\focusweb_week3.sqlite3"
python manage.py test
python manage.py spectacular --validate --file "$env:TEMP\focusweb-week3-schema.yml"
```
