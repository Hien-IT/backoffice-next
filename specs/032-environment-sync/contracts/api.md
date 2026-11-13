# Contract: API REST (D-214)

Bốn route mới dưới `/backoffice/sync` (tiền tố D-189.6); Directus 11.17.4 trả 404 `ROUTE_NOT_FOUND` (D-214, `doc`).
Chỉ REST: không GraphQL, không có trong `/server/specs/oas`, `/server/info` không đổi. Mọi route: chỉ admin
(`accountability.admin === true`; không token 401 `INVALID_CREDENTIALS`, không admin 403 `FORBIDDEN`), đặt
`res.locals.cache = false`, đi qua rate limiter, CORS và cookie session như các route `/backoffice/` khác. Kiểu ở
[data-model.md](../data-model.md). Lỗi chỉ dùng mã có sẵn.

## `GET /backoffice/sync`

| | |
|-|-|
| Response 200 | `{ "data": SyncInfo }` |
| Mục đích | probe của web (mục menu hiện khi 200); đích gọi ở nguồn để kiểm phiên bản (FR-005) |

## `GET /backoffice/sync/state?groups=schema,flows`

| | |
|-|-|
| Query | `groups`: danh sách `GroupKey` cách nhau dấu phẩy; bỏ trống = cả mười nhóm; giá trị lạ → 400 `INVALID_QUERY` |
| Response 200 | `{ "data": { "info": SyncInfo, "state": SyncState } }` |
| Ghi chú | đọc với accountability của người gọi; field có special `encrypt`, `conceal`, `hash` không có trong `state` (R9); không ghi gì |

## `POST /backoffice/sync/diff`

| | |
|-|-|
| Request | `{ "url": string, "token": string, "groups"?: GroupKey[] }` |
| Response 200 | `{ "data": { "hash": string, "source": SyncInfo, "groups": GroupKey[], "rows": SyncRow[] } }`; dòng `same` không mang `changes`, `source`, `target` |
| Tác dụng phụ | không; không ghi DB, log, activity (FR-015) |

Trình tự: kiểm body → chuẩn hóa URL → `GET <url>/backoffice/sync` ở nguồn → so `SyncInfo` với của đích →
`GET <url>/backoffice/sync/state` → kiểm hình dạng → `readState()` ở đích → tính dòng, phụ thuộc, `impact`, `hash`.

## `POST /backoffice/sync/apply`

| | |
|-|-|
| Request | `{ "url": string, "token": string, "hash": string, "groups": GroupKey[], "selected": string[] }` (`selected` là `SyncRow.id`) |
| Response 200 | `{ "data": SyncResult }` |
| Tác dụng phụ | các dòng được chọn được tạo, sửa, xóa ở đích trong một transaction; activity và revision của từng dòng dưới tên người gọi (FR-028); sau commit: cache, reload flow, reload extension, job index |

Trình tự (sửa khi checklist 2026-11-14, CHK032): kiểm body → chuẩn hóa URL → `GET <url>/backoffice/sync` và so
`SyncInfo` → **giữ khóa** → đọc lại state hai bên → tính dòng và `hash` → so `hash` → kiểm `selected` (tồn tại,
`selectable`, đủ `depends`, đủ `cascade`) → transaction (thứ tự ở data-model) → commit → nhả khóa → việc sau commit →
kết quả. Lỗi ở việc sau commit không đổi status 200; `SyncResult.warnings` nêu bước lỗi (FR-025).

## Lỗi của `diff` và `apply`

| Status, mã | Khi | `reason` (tiếng Anh, không chứa URL hay token) |
|---|---|---|
| 400 `INVALID_PAYLOAD` | body sai | thông điệp của Joi |
| 400 `INVALID_PAYLOAD` | URL không phải http/https, có user/password | `"url" must be an http or https URL without credentials` |
| 400 `INVALID_PAYLOAD` | địa chỉ nằm trong `IMPORT_IP_DENY_LIST` | `The source address is not allowed` |
| 400 `INVALID_PAYLOAD` | nguồn trả 401 | `The source rejected the token` |
| 400 `INVALID_PAYLOAD` | nguồn trả 403 | `The source token does not belong to an admin` |
| 400 `INVALID_PAYLOAD` | nguồn trả 404 ở `/backoffice/sync` (Directus, Backoffice cũ) | `The source does not support environment sync` |
| 400 `INVALID_PAYLOAD` | lệch phiên bản hoặc migration | `Version mismatch: source Backoffice <a>, target <b>` hoặc `Migration mismatch: <n> differ` (kèm `extensions.source`, `extensions.target` là `SyncInfo` rút gọn) |
| 400 `INVALID_PAYLOAD` | nhóm `schema` khi hai bên khác vendor | `Data model cannot be compared between <a> and <b>` (chỉ khi `groups` có `schema`; clarify 5) |
| 400 `INVALID_PAYLOAD` | `hash` không khớp (apply) | `The comparison is out of date, compare again` |
| 400 `INVALID_PAYLOAD` | dòng lạ, không tick được, thiếu phụ thuộc, thiếu dòng xóa kèm (apply) | `Unknown row "<id>"`; `Row "<id>" cannot be applied: <reason>`; `Row "<id>" needs "<id phụ thuộc>"`; `Deleting "<id>" also deletes "<id xóa kèm>"` |
| 400 `INVALID_PAYLOAD` | người gọi mất quyền admin sau khi ghi (apply) | `This change would remove your own admin access` |
| lỗi của service | một dòng lỗi khi ghi (apply) | lỗi gốc của service (ví dụ `RECORD_NOT_UNIQUE`, lỗi kiểm admin cuối), thêm `extensions.row = <SyncRow.id>` |
| 503 `SERVICE_UNAVAILABLE` (`service: 'sync'`) | nguồn không tới được, quá 30 giây, trả 3xx, trả sai hình dạng, quá 100 MB | `The source could not be reached`; `The source timed out`; `The source redirected the request`; `The source returned an unexpected response` |
| 503 `SERVICE_UNAVAILABLE` (`service: 'sync'`) | một lượt áp dụng khác đang chạy | `Another sync is being applied` |

Token sai ở nguồn không bao giờ là 401 ở đích (R11). Sau mọi lỗi ở `apply` trước commit, đích không đổi (FR-025).

## Route có sẵn

Không route nào đổi. `GET /schema/snapshot`, `POST /schema/diff`, `POST /schema/apply` và CLI `schema` giữ nguyên.

## Log

Không dòng log mới chứa URL, token hay nội dung cấu hình. Một dòng `info` sau mỗi lượt áp dụng thành công:
`Environment sync applied: <n> created, <n> updated, <n> deleted` (không tên nguồn).
