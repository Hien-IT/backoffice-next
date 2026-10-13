# Contract: bộ đối chiếu, blackbox, retention, CI, E2E, benchmark (008)

Mẫu theo contracts/parity.md của 007. Mọi test mới chạy với cả hai app trên cùng DB (Nguyên tắc V).

## 1. Môi trường đối chiếu

| Thay đổi | Nội dung |
|----------|----------|
| `proxy/backoffice-routes.txt` | thêm `activity`, `revisions`, `versions`, `comments` (`/utils` vẫn tới Directus) |
| profile `retention` (cặp mới, cổng theo quy ước profile) | `RETENTION_ENABLED=true`, `RETENTION_SCHEDULE=*/10 * * * * *` (cron 6 trường, `validateCronExpression` của `cron` 4.3.4 nhận), `RETENTION_BATCH=3`, `ACTIVITY_RETENTION=2s`, `REVISIONS_RETENTION=1s`, `FLOW_LOGS_RETENTION=2s`, `SYNCHRONIZATION_STORE=redis`, `REDIS_BUS_NAMESPACE=parity-retention:bus`, `REDIS_LOCK_NAMESPACE=parity-retention:lock` (hai app của cặp chung khóa với nhau là đủ cho ca "một bên dọn"; không chung với cặp chính để không tăng R-19), `CACHE_NAMESPACE=parity-retention`. **Cặp này dùng chung DB với mọi cặp khác và xóa lịch sử cũ hơn 2 s mỗi 10 s, nên KHÔNG đưa vào `env-up` chung**: `retention.test.ts` tự `compose('--profile', 'retention', 'up', '-d', ...)` ở `beforeAll` và `compose('--profile', 'retention', 'stop', ...)` ở `afterAll` (kể cả khi `beforeAll` lỗi), chạy cuối suite `history` với `sequential: true` |
| cặp chính | không đổi (`RETENTION_ENABLED=false` mặc định) |
| cặp `tz-asia`, `tz-america` (006) | chạy thêm `versions.test.ts` ca `_date` |

## 2. Thư mục `tests/parity/src/history/`

| File | Suite | Nội dung |
|------|-------|----------|
| `history-effects.ts` | — | `historyEffects(fn)`: dòng mới của 5 bảng sau `fn`; `comparable()`: bỏ `id`, `timestamp`, `date_*`; `activity`, `parent` → chỉ số; `version` → `key`; `_date` trong `delta` → marker; `notifications.id` bỏ |
| `activity.test.ts` | `reduced`, `full` | US1: `GET`, `SEARCH` (`keys`, `query`), `GET /:pk`, `fields` lồng (`user.*`, `revisions.*`), `filter`, `sort`, `aggregate`, `meta`, admin / user tối thiểu / public, `OPTIONS`, `HEAD`; dòng do mỗi app ghi khi create, update, delete item và file so qua `historyEffects` (ip, user_agent, origin) |
| `revisions.test.ts` | `reduced`, `full` | query của `use-revisions.ts` (count, trang, `activity.*`), `GET /:pk`, quyền, revision của ghi lồng (`parent`), revision của `directus_files`, `directus_users` |
| `versions.test.ts` | `reduced`, `full` | US2: CRUD, mọi dòng lỗi của contracts/versions.md §2, `save` (delta đơn, quan hệ o2m/m2m/m2a, `create/update/delete`, gộp, `_user`/`_date`), `compare`, `promote` (`fields`, hash cũ, không delta, quyền), hash R2 trên `seed-all-field-types`, R-20 (user đọc-only `save` được), R-21 (hai `promote` đồng thời) |
| `version-read.test.ts` | `reduced`, `full` | `?version=`, `versionRaw`, `fields` lồng, singleton, version không có, item không có quyền; ca SQLite transaction |
| `comments.test.ts` | `reduced`, `full` | US4: CRUD, thứ tự lỗi 3.1, quyền tối thiểu (sửa comment người khác `403`), query của sidebar, mention: có quyền, không quyền (log), uuid không tồn tại, nhắc chính mình; D-33: user có `email_notifications` (log cảnh báo, không dòng khác) |
| `cross-use.test.ts` | `reduced`, `full` | FR-062: ghi ở A đọc ở B cả hai chiều cho 5 bảng; version tạo+save ở A, compare+promote ở B; revert bằng `PATCH /items` với `data` của revision ghi ở app kia |
| `retention.test.ts` | `full` | US5 trên cặp `retention`: seed dòng cũ/mới (sửa `timestamp` trực tiếp qua `hostDb`), chờ một kỳ, so dòng còn lại; bật cả hai app, 10 kỳ, đếm lượt xóa qua Redis `MONITOR` hoặc log (0 trùng); `ACTIVITY_RETENTION` < `REVISIONS_RETENTION` không dọn revision |
| `e2e-app.test.ts` | `full` | đúng chuỗi request của sidebar Revisions, Comments, menu Version, module Activity (lấy từ `directus/app`), so response |

Suite `reduced` chạy trên MySQL, SQLite mỗi lần push; `full` trên Postgres mỗi lần push và các vendor còn lại ở nightly.

## 3. Blackbox

| File | Sửa |
|------|-----|
| `tests/db/routes/items/version.test.ts` | copy nguyên |
| `tests/db/routes/items/version.seed.ts` | copy nguyên; seed qua `PARITY_BLACKBOX_SETUP_APP` như các seed khác (tạo collection có `versioning: true`) |
| `common/functions.ts` | đã có `CreateVersion`, `SaveVersion` |
| `00-seed.test.ts`, `sequencer.ts` | thêm seed `version` |

Chạy hai lượt (`PARITY_BLACKBOX_APPS=directus,backoffice`) trên Postgres mỗi lần push; MySQL, SQLite trong job rút gọn;
còn lại nightly.

## 4. CI

| Workflow | Thay đổi |
|----------|----------|
| `ci.yml` `quality` | coverage 80% gồm file mới |
| `ci.yml` `parity` | suite `history`; KHÔNG thêm `retention` vào `--profiles` (`retention.test.ts` tự bật, tự tắt cặp) |
| `ci.yml` `parity-blackbox` | thêm `version` |
| `parity-matrix.yml`, `nightly.yml` | như `parity` |
| `benchmark.yml` | job `benchmark-history` (cùng mẫu `benchmark-files`) |
| E2E job | `history.spec.ts` |
| `guard-differences` | D-09.6 xóa, D-31 thu hẹp, D-33 thêm ở commit đóng feature |

## 5. Playwright (`tests/directus-app-e2e/src/history.spec.ts`)

| Kịch bản | Bước |
|----------|------|
| Revisions | tạo collection (versioning, accountability all), tạo item, sửa 2 lần → sidebar Revisions 3 dòng, mở so sánh, Revert dòng đầu, Save → giá trị cũ, 4 dòng |
| Comments | viết comment có mention (gõ `@`, chọn user), sửa, xóa; bộ đếm; user được nhắc thấy thông báo ở chuông |
| Version | menu Version: tạo bản nháp, sửa field, Save, mở `?version=`, so sánh (modal), promote (chọn field), đổi tên, xóa |
| Activity | module Activity: dòng mới nhất là `update` của user, chi tiết có IP, user agent |

`/activity`, `/revisions`, `/versions`, `/comments` qua proxy tới app mới; `/items`, `/files` cũng tới app mới (004 đến
007); `/utils`, `/notifications` tới Directus.

## 6. Benchmark (`tests/benchmark/src/history.ts`)

| Kịch bản | Request |
|----------|---------|
| `revisions-sidebar` | `GET /revisions` với filter collection+item, `fields` của sidebar, `limit=20`, và `aggregate count` |
| `activity-list` (admin, user tối thiểu) | `GET /activity?sort=-timestamp&limit=50&fields=...` |
| `version-save` | `POST /versions/:id/save` delta một field (mỗi vòng id khác nhau từ pool) |
| `item-version-read` | `GET /items/:c/:id?version=draft` |

Seed `seed-history.ts`: collection versioning, 2.000 item, 20 revision mỗi item, 1 version `draft` có delta mỗi item.
Ngưỡng 10% p95 và req/s; chạy hằng tuần, không chặn CI.
