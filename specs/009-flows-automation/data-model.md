# Data model: Flows và tự động hóa (009)

Feature này không có DDL. App mới đọc, ghi `directus_flows`, `directus_operations` qua `ItemsService` (cùng dòng
như Directus) và ghi `directus_activity` (`action = run`), `directus_revisions` (log chạy) với cùng nội dung. Key
Redis dùng chung với Directus: kênh bus `flows`, đồng hồ đồng bộ `<SYNCHRONIZATION_NAMESPACE>:clock:<flow id>:<cron>`,
rate limiter `RATE_LIMITER_EMAIL_FLOWS` theo flow id. Cột lấy từ
`directus/packages/system-data/src/fields/{flows,operations}.yaml`, mặc định từ migration `20220429A-add-flows.ts`.

## 1. Thực thể và quan hệ

| Thực thể | Nguồn | Ghi chú |
|----------|-------|---------|
| Flow | Dòng `directus_flows` | §2; `FlowsService` |
| Operation | Dòng `directus_operations` | §3; `OperationsService` |
| Flow tree | `Flow` trong bộ nhớ của `FlowManager` (`constructFlowTree`) | §4; dựng lại ở mỗi `load` |
| Lần chạy | dữ liệu theo khóa + `steps` | §5; không lưu, trừ log |
| Log chạy | Activity `run` + Revision | §6 |
| Cấu hình | `FLOWS_*`, `RATE_LIMITER_EMAIL_FLOWS_*`, `SYNCHRONIZATION_*` | §7 |

Quan hệ (`relations.yaml:134-160`): Operation n–1 Flow (`flow`, FK CASCADE, `one_field: operations`,
`one_deselect_action: delete`); Flow 1–1 Operation gốc (`operation`, uuid unique, FK); Operation 1–1 Operation
(`resolve`, `reject`, uuid unique, FK tự tham chiếu); Flow, Operation n–1 User (`user_created`, FK SET NULL).
Activity `run` và Revision trỏ flow qua `collection = directus_flows`, `item = <flow id>` (chuỗi, không FK).

## 2. `directus_flows`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid | sinh bởi `ItemsService`; bỏ khi so, so qua `name` |
| `name` | string | |
| `icon` | string(30), null | |
| `color` | string, null | |
| `description` | text, null | |
| `status` | string, mặc định `active` | chỉ `active` được nạp |
| `trigger` | `event`, `schedule`, `operation`, `webhook`, `manual`, null | |
| `accountability` | `all` (mặc định), `activity`, null | quyết định log chạy (§6) |
| `options` | json (`cast-json`), null | theo trigger, bảng dưới; `null` thành `{}` khi dựng cây |
| `operation` | uuid, null | operation gốc |
| `date_created`, `user_created` | special | bỏ khi so |

`options` theo trigger (đọc trong `flows.ts` `load`, `executeFlow`):

| Trigger | Khóa | Ý nghĩa |
|---------|------|---------|
| `event` | `type` (`filter`, `action`), `scope` (chuỗi hoặc mảng), `collections` (mảng), `return` | scope `items.create|update|delete` × collections → `<c>.items.<a>` hoặc `<hệ thống>.<a>`; scope khác giữ nguyên |
| `schedule` | `cron` | `validateCron`; job `scheduleSynchronizedJob(flow.id, cron)` |
| `operation` | `return` | chỉ chạy qua `runOperationFlow` |
| `webhook` | `method` (`GET` mặc định, `POST`), `async`, `cacheEnabled` (chỉ `GET`), `error_on_reject`, `return` (mặc định `$last`), `cacheQueryParams` (khóa cache, 005) | handler `<METHOD>-<id>` |
| `manual` | `collections`, `requireSelection` (mặc định true), `requireConfirmation`, `fields`, `location`, `async`, `error_on_reject`; `return` ép `$last` | handler `POST-<id>` |

## 3. `directus_operations`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid | bỏ khi so; so qua `key` |
| `name` | string, null | |
| `key` | string, not null | khóa trong dữ liệu flow (`keyedData[key]`) |
| `type` | string, not null | một trong 15 id (§5 của contracts/operations.md); type lạ → `unknown` |
| `position_x`, `position_y` | integer, not null | canvas |
| `options` | json (`cast-json`), null | có thể chứa `{{ }}`; `applyOptionsData` trước khi chạy |
| `resolve`, `reject` | uuid, null, unique | operation kế |
| `flow` | uuid, not null | FK CASCADE |
| `date_created`, `user_created` | special | bỏ khi so |

Vòng đời qua trình chỉnh sửa: `PATCH /flows/:pk` với `operations: { create: [cây lồng], update: [cây lồng có id],
delete: [id] }` và `operation: <id gốc>`; đôi khi `PATCH /operations` mảng `{id, resolve: null}` trước để gỡ unique.
`DELETE /flows/:pk`: `resolve`, `reject` về null (knex thô, R-22) rồi xóa flow → operation xóa theo CASCADE.

## 4. Flow tree (bộ nhớ, `constructFlowTree`)

`Flow = FlowRaw - operations + { operation: Operation | null, options: {} khi null }`; `Operation = OperationRaw -
flow + { resolve: Operation | null, reject: Operation | null }` (đệ quy). Tham chiếu `operation`, `resolve`, `reject`
tới id không có trong `operations` của flow → `Error('Undefined reference in operations')` → `load` thất bại (nạp lại
lỗi ở cả hai app). Mọi `FlowManager` dựng lại toàn bộ cây khi nhận `{ type: 'reload' }`.

## 5. Dữ liệu một lần chạy

| Khóa | Giá trị |
|------|---------|
| `$trigger` | webhook/manual: `{ path, query, body, method, headers }`; filter: `{ payload, ...meta }` (`event`, `collection`, `keys`?); action: `meta` (`event`, `payload`, `keys`, `collection`); `trigger` op: phần tử payload; schedule: null |
| `$last` | ban đầu `$trigger`; sau mỗi bước = `data` của bước |
| `$accountability` | của context hoặc null |
| `$env` | `pick(env, FLOWS_ENV_ALLOW_LIST)` hoặc `{}` |
| `<operation.key>` | `data` của bước đó (null khi handler trả undefined) |

`steps[]`: `{ operation: <id>, key, status: resolve|reject|unknown, options: <đã thay thế> | null }`.

Kết quả bước (`executeOperation`): resolve → `result ?? null` sau `deepMap(undefined → null)`; reject → `Error` (bỏ
`stack`; enumerable: `name = DirectusError`, `extensions`, `code`, `status`), chuỗi JSON hợp lệ → object, chuỗi khác,
mảng (`condition`), null. Kết quả trả về route: `$all` = toàn bộ bảng trên (không che); đường dẫn `return` = `get(
keyedData, path)`; rỗng = undefined (`204`).

## 6. Log chạy

| Bảng | Khi | Cột |
|------|-----|-----|
| `directus_activity` | `flow.accountability !== null`, sau chuỗi (kể cả reject) | `action = run`, `user`, `ip`, `user_agent`, `origin` từ `$accountability` hoặc null, `collection = directus_flows`, `item = <flow id>`, `timestamp` DB |
| `directus_revisions` | `flow.accountability === all` | `activity`, `collection = directus_flows`, `item`, `data = { steps, data }`, `delta` null, `parent` null, `version` null |

`data.steps`: `steps[]` che giá trị trùng `$env` (`redactObject` `values`). `data.data`: toàn bộ dữ liệu theo khóa che
theo đường dẫn `['**','headers','authorization']`, `['**','headers','cookie']`, `['**','query','access_token']`,
`['**','payload', <password|token|tfa_secret|external_identifier|auth_data|credentials|ai_openai_api_key|
ai_anthropic_api_key|ai_google_api_key|ai_openai_compatible_api_key>]` và giá trị trùng `$env`; chuỗi thay thế
`--redacted--` (`getRedactedString()`), hoặc `--redacted:<KEY>--` cho giá trị env. `Error` thành `{ name, message,
stack?, cause? }` qua replacer của `redactObject`. `RevisionsService` ghi với `autoPurgeCache: false` (008). Job
`retention` xóa `action = run` theo `FLOW_LOGS_RETENTION` (008).

## 7. Cấu hình

| Biến | Mặc định | Tác dụng |
|------|----------|----------|
| `FLOWS_ENV_ALLOW_LIST` | `false` | tên biến đưa vào `$env` (chuỗi phẩy → mảng qua `toArray`) |
| `FLOWS_RUN_SCRIPT_MAX_MEMORY` | `32` | MB, `memoryLimit` của isolate `exec` |
| `FLOWS_RUN_SCRIPT_TIMEOUT` | `10000` | ms, `timeout` của `eval` và `evalClosure` |
| `RATE_LIMITER_EMAIL_FLOWS_ENABLED` | `false` | bật rate limiter của `mail` |
| `RATE_LIMITER_EMAIL_FLOWS_POINTS` | `1` | số mail mỗi kỳ, theo flow id |
| `RATE_LIMITER_EMAIL_FLOWS_DURATION` | `60` | giây |
| `RATE_LIMITER_EMAIL_FLOWS_ERROR_MESSAGE` | không có | `extensions.message` của `EmailLimitExceededError` |
| `SYNCHRONIZATION_STORE`, `SYNCHRONIZATION_NAMESPACE` | `memory`, `directus-sync` | đồng hồ job theo lịch (001) |
| `IMPORT_IP_DENY_LIST` | `['0.0.0.0', '169.254.169.254']` | agent của `request` (007) |

## 8. Redis và bus

| Key / kênh | Namespace | Ai | Khi |
|------------|-----------|----|-----|
| kênh `flows`, message `{ type: 'reload' }` | `REDIS_BUS_NAMESPACE` (`directus:bus`) | `FlowsService`, `OperationsService` của cả hai app | sau mỗi create, update, delete |
| `clock:<flow id>:<cron>` (`setGreaterThan` thời điểm kỳ kế) | `SYNCHRONIZATION_NAMESPACE` (`directus-sync`), chỉ khi store `redis` | `scheduleSynchronizedJob` | mỗi kỳ; xóa khi `stop()` |
| counter `RATE_LIMITER_EMAIL_FLOWS` theo flow id | `RATE_LIMITER_STORE` | operation `mail` | mỗi lần chạy khi bật |
| response cache `GET /flows/trigger/:id` (key có `rawQuery` theo `cacheQueryParams`) | `CACHE_NAMESPACE` | `respond` | khi `cacheEnabled !== false` |

## 9. Event

| Sự kiện | Khi | Ghi chú |
|---------|-----|---------|
| `flows.create|update|delete`, `operations.create|update|delete` | `ItemsService` của hai collection | scope hệ thống (bỏ tiền tố) |
| Handler flow `event`: `<c>.items.<a>` (filter/action), `<hệ thống>.<a>`, `auth.*`, `authenticate`, tên khác | đăng ký ở `load`, gỡ ở `unload` | filter nhận `(payload, meta, context)`, trả giá trị thay payload khi flow có `return`; action nhận `(meta, context)` |
