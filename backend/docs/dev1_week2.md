# Dev 1 Tuần 2

Trạng thái: đã đủ phạm vi Dev 1 trong tài liệu phân chia công việc. Các phần AI
semantic, realtime score, warning cycle, auto-pause và AI insight async thuộc Dev
2 nên hiện chỉ có contract placeholder để frontend không phải đổi payload sau.

## Checklist Theo Ngày

| Ngày | Yêu cầu Dev 1 | Trạng thái | File chính |
| --- | --- | --- | --- |
| Day 8 | API Blacklist CRUD và default domains | Đã làm | `apps/extension/models.py`, `apps/extension/views.py` |
| Day 9 | API blacklist sync cho extension | Đã làm | `apps/extension/views.py`, `apps/extension/serializers.py` |
| Day 10 | Model `FocusScore`, `ScoreComponent`, phân loại trạng thái focus | Đã làm | `apps/scoring/models.py`, `apps/scoring/services/score_calculator.py` |
| Day 12 | Session Summary API: score, component, metadata, warning log | Đã làm | `apps/sessions/views.py`, `apps/sessions/serializers.py` |
| Day 13 | Session history API và dữ liệu cho detail drawer | Đã làm | `apps/sessions/views.py`, `apps/sessions/serializers.py` |
| Day 14 | Dashboard overview API: total time, sessions, avg score, completion rate | Đã làm | `apps/analytics/views.py`, `apps/analytics/serializers.py` |

## API Cần Xong Tuần 2

| Method | Endpoint | Mục đích | Ghi chú |
| --- | --- | --- | --- |
| `GET` | `/api/blacklist/` | Lấy domain mặc định và domain custom của user | Tự seed default rule nếu DB rỗng |
| `POST` | `/api/blacklist/` | Thêm domain custom | Tự chuẩn hóa URL/domain, ví dụ `https://www.youtube.com/watch` thành `youtube.com` |
| `GET` | `/api/blacklist/{id}/` | Lấy một rule blacklist | Chỉ thấy rule mặc định hoặc rule của chính user |
| `PUT/PATCH` | `/api/blacklist/{id}/` | Sửa domain hoặc severity custom | Rule mặc định bị chặn sửa |
| `DELETE` | `/api/blacklist/{id}/` | Xóa domain custom | Rule mặc định bị chặn xóa |
| `GET` | `/api/blacklist/sync/` | Payload sync cho extension | Trả `version`, `generatedAt`, `entries` |
| `GET` | `/api/sessions/` | History list cho dashboard/detail drawer | Có `page`, `limit`, `mode`, `tag`, `status`, `startedAfter`, `startedBefore` |
| `GET` | `/api/sessions/{id}/` | Chi tiết một session | Chặn xem session của user khác bằng 404 |
| `GET` | `/api/sessions/{id}/summary/` | Summary sau khi session hoàn thành | Trả score breakdown, metadata, warning log và AI placeholder |
| `GET` | `/api/dashboard/overview/` | Dashboard MVP overview | Có filter `range=today/7d/30d/90d/all` |

## Blacklist

`BlacklistEntry` lưu hai loại rule:

- Rule mặc định: `is_default=True`, không gắn user, dùng cho các domain phổ biến
  như `youtube.com`, `facebook.com`, `instagram.com`, `tiktok.com`.
- Rule custom: `is_default=False`, gắn với user hiện tại, cho phép CRUD.

`normalize_domain()` chạy trước khi lưu để dữ liệu sync ổn định. Người dùng có
thể nhập URL đầy đủ, domain có `www.`, hoặc domain thường; backend sẽ chuẩn hóa
về domain gốc. Constraint DB bảo vệ không cho default rule có user và không cho
custom rule thiếu user.

Luồng hoạt động:

1. Client gọi `GET /api/blacklist/`.
2. Backend gọi `ensure_default_blacklist_entries()` để bảo đảm rule mặc định tồn
   tại.
3. `available_to(user)` trả rule mặc định cộng rule custom của user.
4. Extension gọi `GET /api/blacklist/sync/` để nhận payload nhẹ, không phụ thuộc
   vào id DB.

## Focus Score

`FocusScore` là kết quả cuối của một session đã hoàn thành. Mỗi session chỉ có
một bản ghi score qua quan hệ one-to-one. `ScoreComponent` lưu các phần điểm để
frontend vẽ breakdown.

Các component hiện có:

- `content_relevance`: độ liên quan nội dung, hiện dùng fallback theo session
  mode trong phạm vi Dev 1.
- `focus_continuity`: mức hoàn thành thời lượng so với target.
- `tab_stability`: hiện là fallback 100 vì tab switch/warning thuộc Dev 2.
- `distraction_penalty`: hiện là fallback 100 vì distraction event thuộc Dev 2.

Phân loại trạng thái:

- `90-100`: `deep-focus`
- `75-89`: `focused`
- `60-74`: `average`
- `40-59`: `distracted`
- `0-39`: `highly-distracted`

Luồng tính điểm:

1. User kết thúc session qua `/api/sessions/{id}/end/` hoặc chuyển status sang
   `completed`.
2. `transition_session()` khóa session trong transaction, tự tính
   `actual_duration_seconds` theo thời gian server.
3. `ScoreCalculator.persist_final_score()` tạo/cập nhật `FocusScore` và các
   `ScoreComponent`.
4. Session được cập nhật thêm `focus_score`, `focus_state` để history và
   dashboard query nhanh.

Lưu ý: `actualDurationSeconds` trong request end session chỉ còn là field tương
thích với frontend cũ. Backend không tin thời lượng client gửi lên mà tự tính
theo `started_at`, pause time và thời điểm end.

## Session Summary

Endpoint `GET /api/sessions/{id}/summary/` chỉ trả dữ liệu khi session đã
`completed`. Nếu session còn active/paused sẽ trả lỗi validation.

Response chính:

- `session`: thông tin session đầy đủ.
- `scoreBreakdown`: `contentRelevance`, `focusContinuity`, `tabStability`,
  `distractionPenalty`, `total`.
- `scoreMetadata`: metadata từ calculator, hiện có `durationRatio`,
  `hasSemanticAi`, `hasWarningEvents`, `source`.
- `warningLog`: mảng rỗng trong phạm vi Dev 1, chờ Dev 2 nối warning service.
- `distractionEvents`: mảng rỗng trong phạm vi Dev 1.
- `aiInsights`: mảng rỗng trong phạm vi Dev 1.
- `isAiInsightReady`: `false` cho đến khi Dev 2 có async AI insight job.
- `recommendation`: gợi ý ngắn để frontend có text hiển thị ngay.

## Session History

`GET /api/sessions/` trả dữ liệu cho màn history và detail drawer.

Filter hỗ trợ:

- `page`, `limit`: phân trang nhẹ, giới hạn tối đa 100 item/lần gọi.
- `mode`: lọc normal/deep-work.
- `tag`: lọc theo tag name.
- `status`: lọc active/paused/auto-paused/completed/cancelled.
- `startedAfter`, `startedBefore`: lọc theo thời điểm bắt đầu.

Tất cả query đều theo `request.user`, vì vậy user không thể đọc history của user
khác.

## Dashboard Overview

`GET /api/dashboard/overview/` là API MVP cho dashboard tuần 2. Endpoint này dùng
cùng helper aggregate với analytics để số liệu không lệch giữa các màn.

Metric trả về:

- `totalFocusMinutes`: tổng phút focus từ các session completed.
- `totalSessions`: tổng số session trong range.
- `completedSessions`: số session completed.
- `averageFocusScore`: điểm trung bình các session completed.
- `completionRate`: phần trăm completed trên tổng session.
- `deepWorkSessionCount`: số session deep-work.
- `activeSessionId`: session đang mở nếu có.
- `lastSessionAt`: thời điểm session gần nhất.
- `dateRange`: range đang dùng.

## Ranh Giới Với Dev 2

Các API/logic sau không thuộc phần Dev 1 tuần 2:

- `GET /api/sessions/{id}/score/realtime/`
- `GET /api/sessions/{id}/warnings/`
- `GET /api/sessions/{id}/ai-insight/`
- `POST /api/sessions/{id}/ai-insight/retry/`
- Semantic AI service đọc title/meta/snippet.
- Hybrid decision engine và warning cycle 1/2/3.
- Auto-pause khi người dùng không quay lại nội dung liên quan.
- Async AI session insight job.

Dev 1 đã chừa sẵn các field `warningLog`, `distractionEvents`, `aiInsights`,
`isAiInsightReady`, `hasSemanticAi`, `hasWarningEvents` để Dev 2 nối dữ liệu
thật mà không phá contract frontend.

## Comment Code Đã Thêm

Các comment tiếng Việt nằm ở những điểm cần hiểu nhanh:

- `apps/extension/models.py`: seed default blacklist, normalize domain, query
  rule theo user.
- `apps/extension/views.py`: lý do seed default và payload sync cho extension.
- `apps/scoring/models.py`: vai trò của `FocusScore` và `ScoreComponent`.
- `apps/scoring/services/score_calculator.py`: cách mapping score sang focus
  state và fallback calculator tuần 2.
- `apps/sessions/services.py`: lifecycle session, tính actual duration, gắn
  final score lúc completed.
- `apps/sessions/views.py`: filter history và summary placeholder cho Dev 2.
- `apps/analytics/views.py`: aggregate dashboard overview.

## Kiểm Thử

Backend:

```powershell
cd focusweb\backend
$env:DJANGO_SECRET_KEY="focusos-dev-secret-key"
$env:DATABASE_ENGINE="sqlite"
$env:SQLITE_PATH="$env:TEMP\focusweb_week2.sqlite3"
python manage.py test
python manage.py spectacular --validate --file "$env:TEMP\focusweb-schema.yml"
```

Frontend:

```powershell
cd focusweb\frontend
npm run lint
npm run build
```

PostgreSQL local cần Docker Desktop/Postgres đang chạy rồi mới chạy được:

```powershell
cd focusweb\backend
python manage.py migrate
```
