# Dev 1 Tuần 4

Trạng thái: đã đối chiếu lại tuần 1, tuần 2, tuần 3 và chưa thấy thiếu hạng mục chính thuộc Dev 1. Tuần 4 đã bổ sung phần trải nghiệm cá nhân, ngữ cảnh gần đây, quản lý tag/note, export report và account settings. Các phần smart preset AI, recommendation, pattern detection nâng cao, scheduler và worker PDF thật vẫn thuộc Dev 2.

## Đối Chiếu Tuần 1-3

Tuần 1 đã có:

- Auth register/login/logout/me bằng session auth và CSRF.
- Profile, preferences, onboarding complete.
- Goal template built-in/custom.
- FocusSession, SessionTag, SessionNote và state transition audit.
- API create/pause/resume/end/cancel session.

Tuần 2 đã có:

- Blacklist CRUD, default domains và sync payload cho extension.
- FocusScore, ScoreComponent và focus state classification.
- Final score khi session completed.
- Session history/detail/summary.
- Dashboard overview MVP.

Tuần 3 đã có:

- Analytics overview, focus trend, distractions fallback, time heatmap, session breakdown, weekly snapshot.
- Notification settings.
- Document library upload/CRUD.
- Flashcard deck CRUD và review session.
- Placeholder/fallback cho phần AI để Dev2 nối tiếp mà không đổi contract frontend.

## Checklist Tuần 4 Dev 1

| Yêu cầu | Trạng thái | File chính |
| --- | --- | --- |
| `GET/POST/PATCH/DELETE /api/tags/` | Đã làm | `apps/sessions/views.py`, `apps/sessions/serializers.py` |
| `GET/PUT /api/sessions/{id}/note/` | Đã làm, có thêm `PATCH` | `apps/sessions/views.py` |
| `GET /api/recent-context/` | Đã làm | `apps/sessions/views.py` |
| `GET /api/streak/` | Đã làm, có alias `/api/user/streak/` | `apps/users/views.py` |
| `GET/PUT /api/music/preferences/` | Đã làm, có thêm `PATCH` | `apps/users/views.py` |
| `GET/PUT /api/theme/preferences/` | Đã làm, có thêm `PATCH` | `apps/users/views.py` |
| `GET/PUT /api/ambient/preferences/` | Đã làm, có thêm `PATCH` | `apps/users/views.py` |
| `POST /api/reports/export/` | Đã làm JSON/HTML/PDF fallback | `apps/analytics/views.py` |
| `GET /api/reports/export/{job_id}/` | Đã làm | `apps/analytics/views.py` |
| `POST /api/account/change-password/` | Đã làm | `apps/users/views.py` |
| `POST /api/account/export-data/` | Đã làm | `apps/users/views.py` |
| `DELETE /api/account/delete/` | Đã làm | `apps/users/views.py` |
| `GET /api/health/` | Đã có | `core/views.py`, `config/urls.py` |
| `GET /api/docs/` | Đã có Swagger UI | `config/urls.py` |

## API Tuần 4 Đã Thêm

- `GET|POST /api/tags/`
- `GET|PUT|PATCH|DELETE /api/tags/{id}/`
- `GET|PUT|PATCH /api/sessions/{id}/note/`
- `GET /api/recent-context/`
- `GET /api/streak/`
- `GET /api/user/streak/`
- `GET|PUT|PATCH /api/music/preferences/`
- `GET|PUT|PATCH /api/theme/preferences/`
- `GET|PUT|PATCH /api/ambient/preferences/`
- `POST /api/reports/export/`
- `GET /api/reports/export/{job_id}/`
- `POST /api/account/change-password/`
- `POST /api/account/export-data/`
- `DELETE /api/account/delete/`

## Cách Hoạt Động Chính

- Tag là dữ liệu riêng của từng user. Khi tạo session hoặc sửa tag, backend tự chuẩn hóa tên, chặn trùng tên trong cùng user và không cho đọc tag của user khác.
- Session note là quan hệ một-một với session. Endpoint note dùng cho màn history/detail, còn `noteSearch` hoặc `q` trên `/api/sessions/` giúp tìm lại session theo nội dung ghi chú.
- Recent context gom active session, last completed session, recent goals, recent notes và suggested tags để frontend dựng màn tiếp tục học nhanh.
- Streak tính trực tiếp từ các ngày có completed session, không phụ thuộc cron. Sau khi tính, backend cập nhật lại `Profile.streak_count` để profile/dashboard đọc nhanh.
- Music/theme/ambient preferences dùng chung bảng `UserPreference`, tránh tách thêm bảng khi dữ liệu vẫn là cấu hình cá nhân đơn giản.
- Report export tạo `ReportExportJob` đồng bộ, trả payload JSON ngay. HTML là fallback có sẵn, PDF giữ payload và note để Dev2/worker render file thật sau.
- Account export trả user, profile, preferences, sessions và documents của chính user hiện tại. Delete account yêu cầu mật khẩu hiện tại trước khi xóa.

## Comment Code Đã Thêm

Các comment tiếng Việt đã đặt ở những đoạn cần hiểu luồng:

- `apps/users/models.py`: vai trò của user, profile, preference và onboarding.
- `apps/users/views.py`: auth response, CSRF, notification settings, streak, preference tuần 4 và account actions.
- `apps/sessions/models.py`: goal template, tag, session, note và transition audit.
- `apps/sessions/services.py`: chuẩn hóa tag, lifecycle, duration server-side và final score.
- `apps/sessions/views.py`: ownership, history filter, summary placeholder, note và recent context.
- `apps/analytics/models.py`: lưu job export report tuần 4.
- `apps/analytics/views.py`: aggregate dashboard/analytics, filter theo tag và tạo report export.
- `apps/extension/models.py`, `apps/extension/views.py`: blacklist default/custom và sync extension.
- `apps/scoring/models.py`, `apps/scoring/services/score_calculator.py`: score breakdown và fallback calculator.
- `apps/ai/models.py`: document library, summary fallback, flashcard deck và review session.

## Kiểm Thử

Backend:

```powershell
cd focusweb\backend
$env:DJANGO_SECRET_KEY="focusos-dev-secret-key"
$env:DATABASE_ENGINE="sqlite"
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
python manage.py spectacular --validate --file "$env:TEMP\focusweb-week4-schema.yml"
```

Frontend:

```powershell
cd focusweb\focusos
npm run lint
npm run build
```
