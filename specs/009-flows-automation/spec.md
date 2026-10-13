# Feature Specification: Flows và tự động hóa (`/flows`, `/operations`, `/flows/trigger/:id`)

**Feature Branch**: `009-flows-automation`
**Created**: 2026-10-13
**Status**: Draft
**Input**: User description: "App mới chạy flows giống hệt Directus. Flow và operation lưu trong directus_flows và directus_operations. Hỗ trợ các trigger: event (hook action và filter trên items và các collection hệ thống, cùng tên event như Directus), schedule (cron), webhook (/flows/trigger/:id, GET/POST, đồng bộ hoặc bất đồng bộ), manual (nút bấm trên item) và another flow. Hỗ trợ mọi operation có sẵn: condition, exec, item-create/read/update/delete, json-web-token, log, mail, notification, request, sleep, transform, trigger flow, throw error. Operation exec (Run Script) chạy JavaScript trong sandbox isolated-vm với giới hạn FLOWS_RUN_SCRIPT_MAX_MEMORY và FLOWS_RUN_SCRIPT_TIMEOUT giống Directus. Operation mail không gửi email, chỉ ghi log và trả kết quả thành công như khi gửi xong. Hỗ trợ dữ liệu $trigger, $last, $accountability, $env và nhánh resolve/reject. Flow theo lịch dùng lock trên Redis, nên khi cả Directus và app mới cùng chạy thì mỗi lượt chỉ một bên thực thi. Khi flow thay đổi ở app này, app kia nạp lại flow qua bus. Log chạy flow ghi vào activity và revisions giống Directus. Tham chiếu directus/api/src/flows.ts, operations, services/flows.ts, operations.ts. Tiêu chí chấp nhận: cùng một flow cho kết quả giống nhau ở hai app, và flow theo lịch không bị chạy hai lần."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/api/src` trừ khi ghi khác):

- Bộ máy flow: `flows.ts` (`FlowManager`: `initialize`, `reload` qua bus kênh `flows` message `{ type: 'reload' }`,
  `load`, `unload`, `runOperationFlow`, `runWebhookFlow`, `executeFlow`, `executeOperation`; khóa dữ liệu
  `$trigger`, `$last`, `$accountability`, `$env`); `utils/construct-flow-tree.ts`; `utils/redact-object.ts`;
  `utils/schedule.ts` (`scheduleSynchronizedJob`, `validateCron`); `synchronization.ts` (`SynchronizedClock`,
  `SYNCHRONIZATION_STORE`, `SYNCHRONIZATION_NAMESPACE`); `app.ts:128-131` (`flowManager.initialize()` sau extension
  manager, trước khi dựng Express); `extensions/manager.ts:869-875` (đăng ký 15 operation có sẵn từ thư mục
  `operations/`).
- Route: `controllers/flows.ts` (`GET|POST /trigger/:pk(uuid)` qua `runWebhookFlow` với khóa `<METHOD>-<id>`,
  `res.locals.cache = false` khi `cacheEnabled` tắt; CRUD với `useCollection('directus_flows')`, `validateBatch`,
  `respond`), `controllers/operations.ts` (CRUD với `useCollection('directus_operations')`).
- Service: `services/flows.ts` (`FlowsService`: `createOne`, `updateMany`, `deleteMany` gọi `flowManager.reload()`;
  `deleteMany` đặt `resolve`, `reject` của operation thuộc flow về null trước khi xóa), `services/operations.ts`
  (`OperationsService`, cùng cách reload); `utils/get-service.ts:46-55`.
- Operation có sẵn (`operations/<id>/index.ts`): `condition`, `exec` (isolated-vm, `FLOWS_RUN_SCRIPT_MAX_MEMORY`,
  `FLOWS_RUN_SCRIPT_TIMEOUT`), `item-create`, `item-read`, `item-update`, `item-delete`
  (`utils/get-accountability-for-role.ts`, `$trigger`, `$full`, `$public`, uuid role), `json-web-token`, `log`,
  `mail` (`operations/mail/rate-limiter.ts`, `RATE_LIMITER_EMAIL_FLOWS_*`, `services/mail`), `notification`
  (`services/notifications.ts`), `request` (`request/index.ts` `getAxios` với agent kiểm `IMPORT_IP_DENY_LIST`,
  `encodeurl`), `sleep`, `throw-error` (`createError`), `transform`, `trigger` (`iterationMode` `serial`, `batch`,
  `parallel`).
- Tiện ích dùng chung: `@directus/utils` `applyOptionsData`, `optionToObject`, `optionToString`, `sieveFunctions`,
  `deepMap`, `isValidJSON`, `parseJSON`, `toArray`, `getRedactedString`; `micromustache` `get`; `p-queue`
  (hàng đợi reload); `@directus/system-data` `isSystemCollection`; `@directus/validation` `validatePayload`;
  `utils/parse-filter.ts`.
- Biến mặc định (`directus/packages/env/src/constants/defaults.ts`): `FLOWS_ENV_ALLOW_LIST=false`,
  `FLOWS_RUN_SCRIPT_MAX_MEMORY=32` (MB), `FLOWS_RUN_SCRIPT_TIMEOUT=10000` (ms), `RATE_LIMITER_EMAIL_FLOWS_ENABLED=false`,
  `RATE_LIMITER_EMAIL_FLOWS_POINTS=1`, `RATE_LIMITER_EMAIL_FLOWS_DURATION=60`, `SYNCHRONIZATION_STORE=memory`,
  `SYNCHRONIZATION_NAMESPACE=directus-sync`.
- Cột hệ thống: `directus/packages/system-data/src/fields/flows.yaml`, `operations.yaml` (`directus_flows.accountability`
  mặc định `all`); kiểu `Flow`, `FlowRaw`, `Operation`, `OperationRaw` (`directus/packages/types/src/flows.ts`).
- App Directus (client của feature này): `stores/flows.ts` (`GET /flows?fields[]=*&fields[]=operations.*&limit=-1`),
  `modules/settings/routes/flows/*` (trình chỉnh sửa flow: `POST`, `PATCH`, `DELETE /flows`, `/operations`, ghi lồng
  `operations` theo cú pháp `create/update/delete`; `triggers.ts` liệt kê tùy chọn mỗi trigger), `components/
  logs-sidebar-detail.vue` (đọc `/revisions` với `collection = directus_flows`, hiển thị `data.steps`, `data.data`),
  `composables/use-flows.ts` (`POST /flows/trigger/<id>` với body `{ collection, keys, ...fields }` hoặc
  `{ collection, ...fields }` khi `requireSelection = false`), `views/private/components/flow-sidebar-detail.vue`,
  `modules/content/routes/item.vue`, `collection.vue` (nút chạy flow thủ công).
- Phiên bản thư viện của Directus 11.17.4: isolated-vm, micromustache, p-queue, encodeurl, jsonwebtoken 9.0.3 (đã có
  từ 003), axios (đã có từ 007), cron (đã có từ 008).

**Đã có từ feature 001 đến 008** (trong `apps/api/src` và `libs/`): `Emitter` thật (`onFilter`, `onAction`,
`offFilter`, `offAction`; mọi event `items.*`, `<collection>.items.*`, `<hệ thống>.*`, `auth.*`, `authenticate`
được phát như Directus từ 003, 005, 008), `useBus`, `useLock`, `SynchronizedClock` (store `memory` và `redis`),
`scheduleSynchronizedJob`, `validateCron`, `getAccountabilityForRole`, `getService` (`directus_flows`,
`directus_operations` còn đi qua `ItemsService` chung, D-31), `ActivityService`, `RevisionsService`,
`NotificationsService` (D-33: không gửi email), `sanitizeQuery`, `parseFilter`, `@backoffice/validation`
`validatePayload`, `createRateLimiter`, `getAxios` với agent kiểm `IMPORT_IP_DENY_LIST`, response cache và `respond`,
`useCollection`, `validateBatch`, `unhandled-rejection.ts` (giữ process như pm2), job `retention` với
`FLOW_LOGS_RETENTION` cho `action = run`; `libs/utils`: `deepMap`, `parseJSON`, `toArray`, `getRedactedString`.
Chưa có: `FlowManager`, `FlowsService`, `OperationsService`, 15 operation, route `/flows`, `/operations`,
`/flows/trigger/:id` (D-09.7), `constructFlowTree`, `redactObject`, `applyOptionsData`, `optionToObject`,
`optionToString`, `sieveFunctions`, `isValidJSON`; isolated-vm, micromustache, p-queue chưa cài; biến `FLOWS_*`,
`RATE_LIMITER_EMAIL_FLOWS_*` còn ở nhóm "chưa hỗ trợ".

**Bộ test liên quan của Directus** (số khối `it`/`it.each`, `test` mỗi file): blackbox
`tests/blackbox/tests/db/routes/flows/webhook.test.ts` (2: "cacheEnabled works for GET", "ignores cacheEnabled for
POST", mỗi vendor một process Directus riêng với `CACHE_ENABLED=true`, `CACHE_STORE=memory`); unit `flows.test.ts`
(2), `operations/condition` (4), `exec` (12), `item-create` (4), `item-delete` (11), `item-read` (11), `item-update`
(11), `json-web-token` (12), `log` (2), `mail` (7), `mail/rate-limiter.test.ts` (5), `notification` (2), `request` (5),
`sleep` (2), `throw-error` (6), `transform` (2), `trigger` (3), `utils/redact-object.test.ts`; `utils/schedule.test.ts`
đã port ở 008. Không có test blackbox hay E2E cho trigger event, schedule, manual, operation.

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là admin dựng flow trong app Directus (Settings → Flows, trình chỉnh sửa kéo thả, Logs
sidebar), người dùng bấm nút chạy flow trên trang item hoặc danh sách item, hệ thống ngoài gọi webhook
`/flows/trigger/:id`, và đội vận hành chạy hai app song song với flow theo lịch.

### User Story 1 - Webhook và flow thủ công cho cùng kết quả ở hai app (Priority: P1)

Hệ thống ngoài gọi `GET` hoặc `POST /flows/trigger/:id` của flow webhook; người dùng bấm nút chạy flow thủ công trên
item trong app Directus (qua proxy, request tới app mới). Flow chạy chuỗi operation theo nhánh resolve/reject, trả
về `$last` hoặc `$all` (hoặc không có body khi bất đồng bộ), lỗi khi `error_on_reject`, như Directus.

**Why this priority**: Là nửa đầu của tiêu chí chấp nhận ("cùng một flow cho kết quả giống nhau ở hai app") với
đường gọi trực tiếp nhất; mọi operation được kiểm qua đây.

**Independent Test**: Seed cùng bộ flow (mỗi trigger × mỗi operation × nhánh resolve, reject) vào DB dùng chung; gọi
`/flows/trigger/:id` ở hai app với cùng body, query, header; so status, body, header; so hiệu ứng phụ (item,
notification, log) và dòng activity `run`, revision.

**Acceptance Scenarios**:

1. **Given** flow webhook `method = GET` (mặc định), **When** `GET /flows/trigger/:id` ở hai app với cùng query và
   header, **Then** body là `$last` (mặc định `return`), hoặc `$all` (toàn bộ dữ liệu theo khóa `$trigger`, `$last`,
   `$accountability`, `$env`, khóa từng operation), hoặc đường dẫn `return` tùy chọn; `$trigger` là
   `{ path, query, body, method, headers }`; `POST` tới flow `GET` (hoặc ngược lại) trả `403` và log cảnh báo.
2. **Given** flow webhook `async = true`, **When** gọi, **Then** trả `204` ngay, flow vẫn chạy xong và ghi log chạy;
   `error_on_reject` bị bỏ qua.
3. **Given** flow webhook đồng bộ với `error_on_reject = true` và operation cuối reject (ví dụ `throw-error` với
   `code`, `status`, `message`), **When** gọi, **Then** response là lỗi đó với cùng status, `code`, `message` như
   Directus; `$last` không phải `Error` (chuỗi, object, mảng lỗi của `condition`) trả `500` như Directus.
4. **Given** flow webhook `GET` với `cacheEnabled = false`, **When** gọi khi response cache bật, **Then** response không
   được cache (hai lần gọi cho kết quả khác nếu flow đổi); `cacheEnabled` bị bỏ qua với `POST` (blackbox
   `webhook.test.ts`).
5. **Given** flow thủ công với `collections`, `requireSelection`, `fields`, **When** `POST /flows/trigger/:id` với body
   `{ collection, keys, ...fields }` như app Directus gửi, **Then** flow chạy với `$trigger.body` là body đó và trả
   `$last` (hoặc `204` khi `async`); thiếu `collection`, `collections` rỗng, collection không nằm trong danh sách,
   thiếu `keys` khi `requireSelection`, `keys` rỗng, không đăng nhập đều trả `403` kèm dòng cảnh báo như Directus.
6. **Given** user không phải admin, **When** chạy flow thủ công, **Then** cần quyền đọc collection và đọc được mọi
   `keys` (engine 004), không có thì `403`; các operation sau đó chạy với accountability theo option `permissions` của
   từng operation.
7. **Given** flow `inactive` hoặc id không tồn tại, **When** gọi `/flows/trigger/:id`, **Then** `403`; id không phải
   uuid trả `404` theo route.

---

### User Story 2 - Flow theo lịch chạy đúng một lần mỗi kỳ khi hai app cùng chạy (Priority: P1)

Đội vận hành chạy Directus và app mới song song với `SYNCHRONIZATION_STORE=redis` (như hai instance Directus). Flow
`schedule` với biểu thức cron đăng ký ở cả hai app; mỗi kỳ chỉ một bên thực thi, nhờ khóa đồng hồ đồng bộ trên Redis
mà Directus dùng (`SynchronizedClock`, khóa `<SYNCHRONIZATION_NAMESPACE>:<flow id>:<cron>`).

**Why this priority**: Là nửa sau của tiêu chí chấp nhận ("flow theo lịch không bị chạy hai lần"); chạy trùng tạo
dữ liệu đôi và gọi webhook ngoài hai lần.

**Independent Test**: Trong cặp đối chiếu riêng (hai app, cùng Redis, `SYNCHRONIZATION_STORE=redis`, namespace riêng),
tạo flow cron mỗi 5 giây ghi một item mang định danh instance (qua `$env`); đợi 10 kỳ; đếm item và dòng activity
`run`; `MONITOR` Redis namespace đồng bộ. Chạy lại với chỉ một app bật để so dòng activity, revision của mỗi lần chạy.

**Acceptance Scenarios**:

1. **Given** flow `schedule` active với cron hợp lệ, **When** app mới khởi động hoặc nạp lại flow, **Then** đăng ký job
   đồng bộ `scheduleSynchronizedJob(flow.id, cron)` như Directus; cron không hợp lệ ghi cảnh báo "Couldn't register
   cron trigger. Provided cron is invalid: <cron>" và bỏ qua.
2. **Given** hai app cùng chạy với `SYNCHRONIZATION_STORE=redis` và cùng namespace, **When** qua 10 kỳ, **Then** tổng
   số lần chạy là 10 (mỗi kỳ đúng một bên), mỗi lần chạy có `$accountability = null`, một dòng activity `run`
   (`user`, `ip`, `user_agent`, `origin` null) và revision theo `accountability` của flow.
3. **Given** lỗi trong lần chạy theo lịch, **When** operation ném lỗi không bắt được hoặc ghi log thất bại, **Then**
   lỗi được ghi log (`logger.error`) và job vẫn chạy kỳ sau, không dừng process.
4. **Given** `SYNCHRONIZATION_STORE=memory` (mặc định), **When** có flow theo lịch, **Then** mỗi instance tự chạy mỗi kỳ
   như hai instance Directus (không thêm khóa riêng, Nguyên tắc VIII); app mới ghi một dòng cảnh báo khi nạp flow
   theo lịch trong chế độ này (D-18).
5. **Given** flow theo lịch bị tắt hoặc xóa ở app kia, **When** bus báo nạp lại, **Then** job ở app này dừng và khóa
   đồng hồ bị xóa (`clock.reset`) như Directus.

---

### User Story 3 - Flow theo sự kiện chạy ở app nhận request (Priority: P1)

Admin tạo flow `event` kiểu `filter` hoặc `action` với `scope` (`items.create`, `items.update`, `items.delete` kèm
`collections`, hoặc tên event khác như `auth.login`, `authenticate`) trong app Directus; request ghi item hoặc
collection hệ thống tới app mới kích hoạt flow với cùng tên event, cùng payload và meta; flow `filter` chặn request
hoặc sửa payload, flow `action` chạy sau khi ghi, như Directus.

**Why this priority**: Flow theo sự kiện là cách dùng phổ biến nhất; D-26 và D-29 ghi nhận chúng chưa chạy ở app mới
từ 003, 004.

**Independent Test**: Seed flow filter và action cho mỗi scope trên collection người dùng và collection hệ thống có
route ở app mới (`directus_users`, `directus_files`, `directus_comments`, ...); gửi cùng request ghi tới hai app; so
response (filter), hiệu ứng phụ (action, đợi tới khi xuất hiện), dòng activity `run`, revision.

**Acceptance Scenarios**:

1. **Given** flow `event` với `scope = items.create` và `collections = [articles, directus_users]`, **When** nạp,
   **Then** đăng ký handler cho `articles.items.create` và `users.create` (collection hệ thống bỏ tiền tố, như
   Directus); scope khác (`auth.login`, `authenticate`, ...) đăng ký nguyên tên; không có `collections` thì scope
   `items.*` không đăng ký.
2. **Given** flow `filter` trên `items.create`, **When** `POST /items/articles` ở app mới, **Then** flow chạy trước khi
   ghi với `$trigger = { payload, event, collection, ... }` (payload và meta của filter), trong transaction của
   request (operation `item-*` của flow dùng cùng kết nối); operation cuối reject thì request thất bại với `$last`
   (ví dụ lỗi của `throw-error` với status, code của nó); `return` của flow khác rỗng thì giá trị trả về thay payload
   như handler filter Directus.
3. **Given** flow `action` trên `items.update`, **When** `PATCH /items/articles/:id`, **Then** response không đợi flow;
   flow chạy sau với `$trigger = { event, payload, keys, collection }` và `$accountability` của request, dùng kết
   nối DB thường; lỗi của flow chỉ ghi log.
4. **Given** cùng flow event đăng ký ở cả hai app, **When** request tới Directus, **Then** chỉ Directus chạy flow; tới
   app mới thì chỉ app mới chạy (không có cơ chế chạy chéo).
5. **Given** flow event trên collection hệ thống chưa có route ở app mới (D-09.8), **When** request đi tới Directus
   qua proxy, **Then** flow chạy ở Directus; app mới chỉ chạy khi chính nó phát event (ghi lồng qua `ItemsService`).

---

### User Story 4 - Mọi operation có sẵn cho cùng kết quả (Priority: P1)

Admin dùng 15 operation có sẵn của Directus trong flow; mỗi operation nhận option đã thay thế `{{ }}` từ dữ liệu
flow, trả cùng dữ liệu (hoặc cùng lỗi ở nhánh reject) ở hai app; `exec` chạy JavaScript trong sandbox với giới hạn
bộ nhớ và thời gian; `mail` không gửi mà ghi log.

**Why this priority**: Kết quả của flow là kết quả của các operation; một operation lệch là tiêu chí chấp nhận hỏng.

**Independent Test**: Port 15 bộ unit test của Directus; bộ đối chiếu chạy flow webhook đồng bộ `return = $all` cho
mỗi operation với option thành công và option lỗi, so `$all` (bỏ `$env`, chuẩn hóa id, thời điểm), so dòng DB mà
operation ghi.

**Acceptance Scenarios**:

1. **Given** operation `condition` với `filter` (kể cả `$CURRENT_USER`, `$NOW`, `$accountability`), **When** chạy,
   **Then** payload khớp trả null và đi nhánh resolve; không khớp đi nhánh reject với mảng `FailedValidationError`
   (cùng `code`, `extensions`) như Directus.
2. **Given** operation `exec` với `module.exports = function(data) {...}`, **When** chạy, **Then** nhận `data` đã
   lược hàm, `process.env` là `$env`, `console.*` ghi vào log của app; trả giá trị (kể cả Promise); vượt
   `FLOWS_RUN_SCRIPT_TIMEOUT` hoặc `FLOWS_RUN_SCRIPT_MAX_MEMORY`, lỗi cú pháp, `module.exports` không phải hàm đều đi
   nhánh reject với cùng message như Directus (ví dụ "Script execution timed out.").
3. **Given** operation `item-create|read|update|delete` với `permissions` `$trigger`, `$full`, `$public` hoặc uuid
   role, **When** chạy, **Then** dùng accountability tương ứng (`getAccountabilityForRole`), `payload`, `key`, `query`
   từ chuỗi JSON hoặc object, `emitEvents` theo option; kết quả là khóa, item, hoặc null như Directus; lỗi quyền
   (`403`) đi nhánh reject.
4. **Given** operation `json-web-token` `sign`, `verify`, `decode`, **When** chạy, **Then** cùng token, cùng lỗi
   ("Undefined JSON Web Token payload", "Undefined JSON Web Token secret", "Undefined JSON Web Token token",
   'Undefined "Operation" for JSON Web Token', lỗi của jsonwebtoken) như Directus.
5. **Given** operation `log`, **When** chạy, **Then** ghi `logger.info` với message đã thay thế từ dữ liệu đã che
   (`authorization`, `cookie`, `access_token`, `password`, `token`, `tfa_secret`, `external_identifier`, `auth_data`,
   `credentials`, các `ai_*_api_key`) như Directus; kết quả null.
6. **Given** operation `mail`, **When** chạy, **Then** qua rate limiter `RATE_LIMITER_EMAIL_FLOWS_*` theo flow id (vượt
   hạn đi nhánh reject với `EmailLimitExceededError` như Directus), rồi ghi một dòng log cảnh báo thay vì gửi (D-34)
   và trả null như Directus trả khi đã giao cho transport; `to`, `subject`, `type`, `template` chỉ xuất hiện trong
   dòng log.
7. **Given** operation `notification`, **When** chạy, **Then** tạo một dòng `directus_notifications` cho mỗi `recipient`
   với `sender` là user của accountability theo `permissions` (`$full` là service không accountability), `subject`,
   `message`, `collection`, `item`; trả mảng khóa; dòng D-33 cho mỗi người nhận có email.
8. **Given** operation `request`, **When** chạy, **Then** gửi với `url` đã encode, `method`, `body`, `headers` (tự thêm
   `Content-Type: application/json` khi body là object hoặc chuỗi JSON), chặn IP trong `IMPORT_IP_DENY_LIST`; trả
   `{ status, statusText, headers, data }`; phản hồi lỗi HTTP đi nhánh reject với object cùng bốn field; lỗi mạng
   đi nhánh reject với `Error`.
9. **Given** operation `sleep`, `transform`, `throw-error`, **When** chạy, **Then** chờ `milliseconds`, trả object từ
   `json`, ném lỗi `createError(code, message, status)` (mặc định `INTERNAL_SERVER_ERROR`, "An unexpected error
   occurred.", `500`) như Directus.
10. **Given** operation `trigger` với `flow` là flow `operation` ("another flow") và `payload` mảng, **When** chạy với
    `iterationMode` `serial`, `batch` (`batchSize` mặc định 10), `parallel` (mặc định), **Then** flow đích chạy mỗi
    phần tử với `$trigger` là phần tử, kết quả là mảng `$last` của các lần chạy; payload không phải mảng chạy một lần;
    flow đích không có hoặc không active trả null kèm cảnh báo "Couldn't find operation triggered flow with id".
11. **Given** operation có `type` không đăng ký (operation của extension), **When** chạy, **Then** ghi cảnh báo
    "Couldn't find operation <type>", dừng chuỗi với status `unknown` như Directus.
12. **Given** kết quả operation có `undefined` lồng hoặc không serialize được, **When** chạy, **Then** `undefined` thay
    bằng null; không serialize được (vòng tham chiếu, BigInt) đi nhánh reject như Directus.

---

### User Story 5 - Sửa flow ở app này, app kia nạp lại ngay (Priority: P2)

Admin tạo, sửa, bật, tắt, xóa flow và operation trong app Directus (qua proxy, `/flows`, `/operations` tới app mới)
hoặc qua API của Directus; app còn lại nạp lại toàn bộ flow qua bus mà không cần khởi động lại; lần kích hoạt kế tiếp
dùng định nghĩa mới ở cả hai app.

**Why this priority**: Không có thì flow sửa ở một bên chỉ chạy đúng ở bên đó; là yêu cầu của mô tả.

**Independent Test**: Chuỗi `POST`, `PATCH`, `DELETE /flows`, `/operations` (kể cả ghi lồng `operations` của trình
chỉnh sửa) ở app A, kích hoạt webhook ở app B ngay sau; so response và `$all`; quan sát message `flows` trên bus.

**Acceptance Scenarios**:

1. **Given** `POST`, `PATCH`, `DELETE /flows` hoặc `/operations` (đơn, mảng, `keys`, `query`, ghi lồng), **When** gọi
   ở app mới, **Then** response, activity, revision như Directus; một message `{ type: 'reload' }` trên kênh `flows`
   của bus dùng chung; cả hai app nạp lại (hàng đợi một luồng, cảnh báo "Flows have to be loaded before they can be
   reloaded" khi chưa nạp lần đầu).
2. **Given** webhook gọi tới trong lúc đang nạp lại, **When** chạy, **Then** đợi hàng đợi nạp lại xong rồi mới chạy như
   Directus.
3. **Given** `DELETE /flows/:id`, **When** gọi, **Then** `resolve`, `reject` của operation thuộc flow được đặt null trước
   rồi xóa flow (operation xóa theo khóa ngoại), như Directus; app kia không còn flow sau khi nạp lại.
4. **Given** `GET`, `SEARCH /flows`, `/operations` với `fields` (`operations.*`, `flow.*`), `filter`, `sort`, `meta`,
   **When** gọi ở hai app bằng admin và user có quyền một phần, **Then** status, body, `meta` giống nhau; `OPTIONS`,
   `HEAD` như các route khác.

---

### User Story 6 - Log chạy flow hiển thị trong app Directus (Priority: P2)

Mỗi lần chạy, flow có `accountability` `all` hoặc `activity` ghi một dòng activity `run` trên `directus_flows`; với
`all` ghi thêm revision chứa các bước (operation, key, status, option đã thay thế) và toàn bộ dữ liệu đã che; Logs
sidebar của trình chỉnh sửa flow trong app Directus hiển thị các lần chạy do app mới ghi; job dọn lịch sử xóa theo
`FLOW_LOGS_RETENTION`.

**Why this priority**: Là yêu cầu "log chạy flow ghi vào activity và revisions giống Directus" và là cách người dùng
kiểm tra flow.

**Independent Test**: Chạy cùng flow ở hai app; so dòng `directus_activity` (`action = run`) và `directus_revisions`
(`data.steps`, `data.data`) sau chuẩn hóa; mở Logs sidebar trong E2E.

**Acceptance Scenarios**:

1. **Given** flow `accountability = all`, **When** chạy xong (kể cả khi reject), **Then** một dòng activity
   (`action = run`, `collection = directus_flows`, `item = flow id`, `user`, `ip`, `user_agent`, `origin` từ
   `$accountability` hoặc null) và một revision (`activity`, `collection`, `item`, `data = { steps, data }`, `delta`
   null) với cùng nội dung như Directus: `steps[].options` là option sau khi thay thế; `data` là toàn bộ dữ liệu theo
   khóa đã che các khóa nhạy cảm và các giá trị trùng biến trong `$env`; lỗi ở bước reject serialize với cùng tập
   field như Directus.
2. **Given** `accountability = activity`, **When** chạy, **Then** chỉ dòng activity; `null` thì không dòng nào.
3. **Given** dòng do app mới ghi, **When** mở Logs sidebar của flow trong app Directus (qua proxy), **Then** hiển thị
   danh sách lần chạy, từng bước với trạng thái và dữ liệu như khi Directus ghi.
4. **Given** `RETENTION_ENABLED=true`, **When** tới kỳ, **Then** dòng `run` cũ hơn `FLOW_LOGS_RETENTION` bị xóa (đã có
   từ 008, kiểm lại với dòng do flow của app mới ghi).

---

### User Story 7 - Bộ test của Directus, E2E app Directus và benchmark chạy qua trên app mới (Priority: P2)

Bộ blackbox `webhook.test.ts`, unit `flows.test.ts`, 15 bộ `operations/*`, `rate-limiter.test.ts`,
`redact-object.test.ts` được port và đạt ở cả hai app; Playwright E2E app Directus qua proxy cho trình chỉnh sửa flow,
nút chạy flow trên item và danh sách, Logs sidebar; benchmark webhook.

**Why this priority**: Kiểm chứng diện rộng theo vendor; là cổng đóng feature.

**Independent Test**: Chạy bộ port với `TEST_DB=postgres`, `mysql`, `sqlite3` mỗi lần push, vendor còn lại ở
`nightly.yml`.

**Acceptance Scenarios**:

1. **Given** bộ port, **When** chạy với app mới là mục tiêu, **Then** 100% ca đạt, ca fail trên chính Directus được
   ghi chú như 005 đến 008.
2. **Given** E2E Playwright, **When** `/flows`, `/operations`, `/flows/trigger` đi tới app mới, **Then** tạo flow thủ
   công với hai operation trong trình chỉnh sửa, chạy từ trang item và từ danh sách có chọn, xem Logs sidebar, tắt flow
   (nút biến mất), xóa flow, đều hoàn tất với cùng màn hình như qua Directus.

---

### Edge Cases

- `flow.options.return`: webhook mặc định `$last` khi rỗng; manual luôn bị ép `$last` (option của flow bị ghi đè khi
  nạp, chỉ trong bộ nhớ); `$all` trả cả `$env` (giá trị thật, không che) và `$accountability` ra client, như Directus.
- Response `204` khi kết quả là `undefined` (`async`, hoặc `return` trỏ đường dẫn không có); `null` trả `{ data: null }`.
- Operation `log` nhận dữ liệu đã che nhưng bước ghi vào revision che cả giá trị trùng `$env`; `$all` và `$last` trả
  về client thì không che.
- `applyOptionsData` thay `{{ a.b }}` trong chuỗi và trong khóa, giá trị của object lồng; `{{ $last }}` trỏ object
  trong chuỗi riêng trả object (JSON mode của Directus); so cả hai dạng.
- `context.flow` được gán lần đầu (`??=`): flow đích của operation `trigger` chạy với `context.flow` của flow gốc nên
  rate limiter của `mail` tính theo flow gốc; `$trigger`, `$accountability` của flow đích theo payload và context gốc.
- Flow `operation` ("another flow") không có handler webhook/manual/event: gọi `/flows/trigger/:id` của nó trả `403`.
- Filter flow chạy trong transaction của request: `item-*` với `database` của context dùng cùng transaction; action
  flow dùng kết nối thường; schedule, webhook, manual dùng kết nối thường và `getSchema` mỗi lần chạy (tăng tỉ lệ
  R-19 nếu có nhiều lần chạy trong namespace dùng chung: cặp đối chiếu cho lịch có namespace riêng).
- Flow `async` (webhook, manual): `executeFlow` không được await; lỗi sau các bước (ghi activity thất bại) thành
  unhandled rejection, process giữ như pm2 (`unhandled-rejection.ts`).
- `error_on_reject` chỉ có tác dụng với webhook và manual đồng bộ; với filter flow, reject luôn ném `$last`; với action
  và schedule, reject chỉ ghi log chạy.
- `SynchronizedClock.reset()` xóa khóa Redis khi nạp lại: nạp lại ngay trước một kỳ có thể cho cả hai instance đặt
  được khóa (R-23).
- Nạp lại là toàn bộ (unload mọi flow rồi load): mọi job cron dừng và đăng ký lại; message của chính app cũng được
  nhận qua bus (Redis pub/sub trả về cho người gửi).
- Flow có `operation` (gốc) trỏ operation không thuộc flow hoặc `resolve`/`reject` trỏ operation không có:
  `constructFlowTree` ném "Undefined reference in operations" khi nạp, làm nạp lại thất bại ở cả hai app như Directus.
- `exec`: `console.log` nhiều tham số ghi mảng, một tham số ghi giá trị; mỗi lần chạy tạo isolate mới và giải phóng;
  kết quả không copy được (hàm) đi nhánh reject.
- `item-*` với `permissions` là uuid role không tồn tại: `getAccountabilityForRole` dựng accountability rỗng như
  Directus (không lỗi), quyền bằng public.
- `request`: `url` thay thế rồi mới encode; redirect tới IP bị chặn cũng bị chặn bởi agent như 007.
- Manual: `keys` được so bằng chuỗi (`String(key)`), nên `1` và `"1"` khớp; `requireSelection = false` cho phép không
  `keys` (trang danh sách không chọn gì).
- Webhook `GET` được cache theo khóa cache của 005 (gồm accountability và URL) khi `cacheEnabled` không tắt; `POST`
  không bao giờ cache.
- Unit test `exec` của Directus cần isolated-vm thật (native): CI build module trong image như Directus; trên arm64
  cục bộ cũng build được.

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| US1 | 1–7 | FR-001 đến FR-004, FR-012, FR-013, FR-020 đến FR-024 | SC-002, SC-003 |
| US2 | 1–5 | FR-011, FR-020, FR-050, FR-051 | SC-004 |
| US3 | 1–5 | FR-010, FR-020 đến FR-023 | SC-003 |
| US4 | 1–12 | FR-021, FR-022, FR-030 đến FR-045 | SC-001, SC-003 |
| US5 | 1–4 | FR-001 đến FR-003, FR-014, FR-015 | SC-002, SC-005 |
| US6 | 1–4 | FR-023, FR-024 | SC-003 |
| US7 | 1–2 | FR-060 đến FR-063 | SC-001, SC-006 |

## Requirements *(mandatory)*

### Functional Requirements

**Route và service**

- **FR-001**: App mới PHẢI phục vụ mọi route của `controllers/flows.ts` và `controllers/operations.ts`, cùng thứ tự
  middleware (`useCollection`, `validateBatch`, `respond`), cùng status, body, header và lỗi với Directus 11.17.4,
  gồm `OPTIONS`, `HEAD` qua `router-options` với mẫu `/flows*`, `/operations*`; `GET|POST /flows/trigger/:pk` chỉ
  nhận `pk` dạng uuid.
- **FR-002**: `FlowsService`, `OperationsService` PHẢI là port của `services/flows.ts`, `services/operations.ts`:
  `ItemsService` trên hai collection, `createOne`, `updateMany`, `deleteMany` gọi `flowManager.reload()` sau khi ghi;
  `FlowsService.deleteMany` đặt `resolve`, `reject` của `directus_operations` thuộc các flow về null bằng knex thô
  trước khi xóa (ngoài transaction, không kiểm quyền; R-22).
- **FR-003**: `getService` PHẢI trả `FlowsService` cho `directus_flows` và `OperationsService` cho
  `directus_operations` ở mọi đường ghi (route riêng, ghi lồng `operations` qua `/flows`, ghi qua `/items`), để mọi
  thay đổi đều phát nạp lại; hai collection rời `COLLECTIONS_WITHOUT_SERVICE_YET` (D-31 thu hẹp).
- **FR-004**: Quyền trên `directus_flows`, `directus_operations` PHẢI áp như Directus qua engine của 004 (không có
  quyền tối thiểu app access; user thường cần policy); response cache, `meta`, `Emitter` và cầu nối websocket như các
  route item (005); event của hai collection mang scope `flows.*`, `operations.*`.

**Bộ máy flow (FlowManager)**

- **FR-010**: App mới PHẢI có một `FlowManager` singleton port từ `flows.ts`: khởi tạo (`initialize`) sau khi đăng
  ký auth provider và trước khi dựng Express như `app.ts` của Directus; `load` đọc mọi flow `status = active` với
  `fields = ['*', 'operations.*']`, `limit = -1` bằng service không accountability, dựng cây bằng `constructFlowTree`,
  đăng ký handler theo `trigger`: `event` (filter hoặc action theo `options.type`, tên event theo quy tắc scope ×
  collections của Directus, collection hệ thống bỏ tiền tố `directus_`), `schedule`, `operation`, `webhook` (khóa
  `<METHOD>-<id>`, `method` mặc định `GET`, `return` mặc định `$last`), `manual` (khóa `POST-<id>`, `return` ép
  `$last`); `unload` gỡ handler, dừng job; 15 operation có sẵn đăng ký bằng `addOperation` lúc khởi tạo (app mới
  không có extension manager).
- **FR-011**: Trigger `schedule` PHẢI dùng `scheduleSynchronizedJob(flow.id, options.cron, ...)` với `validateCron`
  như Directus (cron không hợp lệ: cảnh báo, bỏ qua), chạy `executeFlow(flow)` không dữ liệu, bắt lỗi và ghi
  `logger.error`; đồng hồ đồng bộ dùng `SYNCHRONIZATION_STORE`, `SYNCHRONIZATION_NAMESPACE` dùng chung với Directus
  (khóa `<namespace>:<flow id>:<cron>`, `setGreaterThan` thời điểm kỳ kế tiếp), không thêm khóa nào khác (Nguyên tắc
  IV, VIII). Khi `SYNCHRONIZATION_STORE` không phải `redis` và có ít nhất một flow theo lịch được đăng ký, `load`
  PHẢI ghi một dòng cảnh báo mức `warn`: "Backoffice: SYNCHRONIZATION_STORE is not redis; scheduled flows run on every
  instance" (một dòng mỗi lần nạp; D-18).
- **FR-012**: `runWebhookFlow(id, data, context)` PHẢI đợi hàng đợi nạp lại rỗng, trả `403 Forbidden` kèm cảnh báo
  "Couldn't find webhook or manual triggered flow with id" khi không có handler; handler webhook trả
  `{ result, cacheEnabled }` (`cacheEnabled` chỉ tắt với `GET` và `options.cacheEnabled === false`; `async` trả
  `result` undefined ngay); handler manual kiểm theo đúng thứ tự và thông điệp cảnh báo của Directus (`collection`,
  `collections` rỗng, collection không thuộc danh sách, `keys` khi `requireSelection` (mặc định true), đăng nhập,
  với non-admin: `fetchPolicies` + `fetchPermissions` action `read` trên collection rồi `readMany(keys, { fields:
  [primary] }, { emitEvents: false })` và so khóa bằng chuỗi), mọi lỗi là `403`.
- **FR-013**: Route `/flows/trigger/:pk` PHẢI gọi `runWebhookFlow` với `data = { path, query, body, method, headers }`
  và `context = { accountability, schema }` của request, đặt `res.locals.cache = false` khi `cacheEnabled` tắt, và
  trả qua `respond` (`204` khi kết quả undefined).
- **FR-014**: `reload()` PHẢI chỉ publish `{ type: 'reload' }` lên kênh `flows` của bus dùng chung; subscriber (đăng ký
  trong constructor) đưa `unload` + `load` vào hàng đợi một luồng; chưa nạp lần đầu thì cảnh báo "Flows have to be
  loaded before they can be reloaded". Message do Directus publish PHẢI làm app mới nạp lại và ngược lại (cùng
  `REDIS_BUS_NAMESPACE`); không có Redis thì bus local chỉ nạp lại trong process.
- **FR-015**: `runOperationFlow(id, data, context)` PHẢI đợi hàng đợi nạp lại, trả null kèm cảnh báo "Couldn't find
  operation triggered flow with id" khi không có flow `operation` với id đó.

**Thực thi flow**

- **FR-020**: `executeFlow` PHẢI dựng dữ liệu theo khóa `$trigger` (dữ liệu trigger, null với schedule), `$last`
  (ban đầu bằng `$trigger`), `$accountability` (từ context hoặc null), `$env` (các biến trong `FLOWS_ENV_ALLOW_LIST`,
  rỗng khi tắt), gán `context.flow ??= flow`, lấy `database`, `schema` từ context hoặc mặc định, chạy chuỗi từ
  `flow.operation` theo `successor` trả về, ghi `keyedData[operation.key]` và `$last` sau mỗi bước, lưu
  `steps[] = { operation: id, key, status, options }`, rồi ghi log chạy (FR-023), ném `$last` theo quy tắc
  `error_on_reject` (webhook, manual đồng bộ) và filter reject, trả `keyedData` với `return = $all`, `get(keyedData,
  return)` (micromustache) với đường dẫn, undefined khi rỗng.
- **FR-021**: `executeOperation` PHẢI: trả `{ successor: null, status: 'unknown', data: null, options: null }` kèm cảnh
  báo khi `type` chưa đăng ký; với `type = log` thay thế option từ dữ liệu đã che theo danh sách khóa của Directus;
  `applyOptionsData(options, data)`; gọi handler với `{ services, env, database, logger, getSchema, data: keyedData,
  accountability: null, ...context }`; `JSON.stringify(result ?? null)` để bắt kết quả không serialize được; thay
  `undefined` lồng bằng null (`deepMap`); resolve trả `{ successor: operation.resolve, status: 'resolve', data:
  result ?? null, options }`; lỗi: `Error` bỏ `stack`, chuỗi JSON hợp lệ được parse, chuỗi khác giữ nguyên, giá trị
  khác giữ nguyên hoặc null, trả `{ successor: operation.reject, status: 'reject', data, options }`.
- **FR-022**: Handler trigger PHẢI truyền context như Directus: filter `{ accountability, database: transaction của
  request, getSchema: schema của context }` với dữ liệu `{ payload, ...meta }`; action `{ accountability, database:
  getDatabase(), getSchema }` với dữ liệu `meta`; webhook, manual `{ accountability, schema }`; schedule không
  context; operation `trigger` truyền `omit(context, 'data')` của flow gốc.
- **FR-023**: Sau chuỗi, khi `flow.accountability !== null`, PHẢI ghi `directus_activity` (`action = run`, `user`,
  `ip`, `user_agent`, `origin` từ accountability của context hoặc null, `collection = directus_flows`, `item =
  flow.id`) bằng `ActivityService` không accountability với `database`, `schema` của lần chạy; khi `all` ghi thêm
  `directus_revisions` (`activity`, `collection`, `item`, `data = { steps, data }`) với `steps` che theo giá trị `$env`
  và `data` che theo danh sách khóa của Directus và giá trị `$env` (`redactObject`, chuỗi thay thế của
  `getRedactedString`); lỗi ở bước reject được serialize với cùng tập field enumerable như Directus (đo ở T0xx:
  `DirectusError` của `@backoffice/errors` có `extensions`, `code`, `status`; `message` không enumerable).
- **FR-024**: Lỗi ném từ `executeFlow` tới route PHẢI đi qua error handler chung như Directus: `DirectusError` trả
  status, `code`, `message` của nó; giá trị khác trả `500 INTERNAL_SERVER_ERROR` (và log lỗi).

**Operation có sẵn**

- **FR-030**: 15 operation PHẢI là port của `operations/<id>/index.ts` với cùng `id`, cùng option, cùng kết quả và
  cùng lỗi (message) như Directus 11.17.4; `services` truyền cho handler là index service của app mới.
- **FR-031**: `condition`: `parseFilter(filter, accountability, undefined, true)` rồi `validatePayload(filter, data,
  { requireAll: true })`; lỗi ném mảng `FailedValidationError` dựng từ `joiValidationErrorItemToErrorExtensions`;
  khớp trả null.
- **FR-032**: `exec`: isolate isolated-vm với `memoryLimit = FLOWS_RUN_SCRIPT_MAX_MEMORY`; `global`, `process = { env:
  $env }`, `module = { exports: null }`, `console.{log,info,warn,error,trace,debug}` gọi logger (một tham số ghi giá
  trị, nhiều ghi mảng); `context.eval(code, { timeout })` rồi `evalClosure('return module.exports($0.data)')` với
  `{ data: sieveFunctions(data) }`, `timeout = FLOWS_RUN_SCRIPT_TIMEOUT`, kết quả `reference + promise` rồi `copy()`;
  giải phóng reference, context, isolate sau mỗi lần chạy, kể cả khi lỗi (đo ở unit test port).
- **FR-033**: `item-create`, `item-read`, `item-update`, `item-delete`: accountability theo `permissions` (`$trigger`
  hoặc rỗng: của context; `$full`: `getAccountabilityForRole('system')`; `$public`: role null; khác: uuid role),
  `payload`, `query` qua `optionToObject`, `query` qua `sanitizeQuery` với accountability đó, `emitEvents` theo
  option; chọn `createMany(toArray(payload))`, `readByQuery|readOne|readMany`, `updateBatch|updateByQuery|updateOne|
  updateMany`, `deleteByQuery|deleteOne|deleteMany` theo dạng `key`, `payload` như Directus; không payload trả null.
- **FR-034**: `json-web-token`: `sign`, `verify`, `decode` bằng jsonwebtoken 9.0.3 với `payload`, `token`, `secret`,
  `options` qua `optionToObject`, `optionToString`; thiếu tham số ném `Error` với message của Directus.
- **FR-035**: `log`: `logger.info(optionToString(message))`, không kết quả.
- **FR-036**: `mail`: `useFlowsEmailRateLimiter(context.flow.id)` với `createRateLimiter('RATE_LIMITER_EMAIL_FLOWS')`
  khi `RATE_LIMITER_EMAIL_FLOWS_ENABLED` (store dùng chung, lỗi `EmailLimitExceededError` với `points`, `duration`,
  `message` từ env); sau đó, thay cho `MailService.send`, ghi một dòng log mức `warn`: "Backoffice: mail sending is
  out of scope; flow mail "<subject>" to <to> not sent" (một dòng mỗi lần chạy, không đọc `EMAIL_*`, không lỗi) và
  trả undefined như Directus (D-34, Nguyên tắc X). `cc`, `bcc`, `replyTo`, `type`, `template`, `data`, `body` không
  được kiểm hay render.
- **FR-037**: `notification`: accountability theo `permissions` như `item-*` nhưng `$full` là null (service không
  accountability); `NotificationsService.createMany` với một dòng mỗi `recipient` (`toArray`), `sender =
  accountability.user ?? null`, `subject`, `message`, `collection`, `item` qua `optionToString` (null khi rỗng); trả
  mảng khóa; `sendEmail` của 008 ghi dòng D-33.
- **FR-038**: `request`: `headers` mảng `{ header, value }` thành object, tự thêm `Content-Type: application/json` khi
  chưa có và `body` là object hoặc chuỗi JSON hợp lệ; `getAxios()` (agent kiểm `IMPORT_IP_DENY_LIST` của 007),
  `encodeUrl(url)`; trả `{ status, statusText, headers, data }`; lỗi có response ném chuỗi JSON của bốn field đó
  (được parse thành object ở nhánh reject); lỗi khác ném nguyên.
- **FR-039**: `sleep`: `setTimeout(Number(milliseconds))`; `transform`: `optionToObject(json)`; `throw-error`:
  `createError(code ?? 'INTERNAL_SERVER_ERROR', message ?? 'An unexpected error occurred.', parseInt(status) hoặc 500)`
  rồi ném instance.
- **FR-040**: `trigger`: `optionToObject(payload) ?? null`; mảng với `iterationMode` `serial` (tuần tự), `batch`
  (`batchSize ?? 10`, `Promise.all` mỗi lô), `parallel` hoặc rỗng (`Promise.all` toàn bộ) trả mảng kết quả; không phải
  mảng chạy một lần; mỗi lần gọi `runOperationFlow(flow, payload, omit(context, 'data'))`.
- **FR-041**: Tiện ích `applyOptionsData`, `optionToObject`, `optionToString`, `sieveFunctions`, `isValidJSON`,
  `redactObject` PHẢI được port với cùng hành vi (port kèm unit test của Directus: `redact-object.test.ts`, và test
  của `@directus/utils` cho các hàm còn lại).
- **FR-045**: Mọi message cảnh báo và lỗi của bộ máy flow và operation PHẢI trùng chuỗi với Directus (bảng trong
  `contracts/` của plan), trừ hai dòng mới của FR-011 và FR-036.

**Cấu hình**

- **FR-050**: Biến `FLOWS_ENV_ALLOW_LIST`, `FLOWS_RUN_SCRIPT_MAX_MEMORY`, `FLOWS_RUN_SCRIPT_TIMEOUT`,
  `RATE_LIMITER_EMAIL_FLOWS_ENABLED`, `RATE_LIMITER_EMAIL_FLOWS_POINTS`, `RATE_LIMITER_EMAIL_FLOWS_DURATION` PHẢI
  chuyển sang nhóm "đã hỗ trợ" với cùng mặc định và cách ép kiểu như Directus (`FLOWS_ENV_ALLOW_LIST` là danh sách
  tên biến, `false` nghĩa là `$env` rỗng); không thêm biến mới (Nguyên tắc VIII). `SYNCHRONIZATION_STORE`,
  `SYNCHRONIZATION_NAMESPACE` đã thuộc nhóm hỗ trợ từ 001.
- **FR-051**: Image Docker của app mới PHẢI build được isolated-vm (native) trong stage build như image Directus và
  chạy `exec` ở runtime alpine; `pnpm install` cục bộ trên macOS arm64 cũng build được (ghi trong quickstart).

**Kiểm thử**

- **FR-060**: Bộ đối chiếu PHẢI so status, body, header của hai app cho mọi route ở FR-001 kể cả lỗi, `OPTIONS`,
  `HEAD`, `204`; với mỗi flow của bộ seed (mỗi trigger × mỗi operation × nhánh resolve, reject, `return` `$last` và
  `$all`, `async`, `error_on_reject`, `cacheEnabled`, `permissions` bốn dạng) so `$all` sau khi bỏ `$env`, chuẩn hóa
  id tự sinh, thời điểm, `headers` của `request` (chỉ so tập khóa ổn định); so hiệu ứng phụ (item, notification) và
  dòng `directus_activity` (`run`), `directus_revisions` (`data.steps`, `data.data`) theo tập so của FR-060 của 008;
  bộ đối chiếu gửi cùng `User-Agent`, `Origin`; operation `request` gọi một server giả trong môi trường đối chiếu.
- **FR-061**: Bộ blackbox, unit ở đầu spec PHẢI được port và đạt ở cả hai app trên Postgres, MySQL, SQLite mỗi lần
  push; vendor còn lại ở `nightly.yml`, như tiền lệ 004 đến 008. Bộ đối chiếu mới chia `reduced` (một flow mỗi
  trigger, mỗi operation một ca resolve; Postgres, MySQL, SQLite mỗi lần push) và `full` (mọi ca lỗi, quyền, R-22,
  R-23, lịch, e2e-app; Postgres mỗi lần push, vendor còn lại nightly).
- **FR-062**: PHẢI có kiểm tra chéo cả hai chiều: flow tạo hoặc sửa ở app này kích hoạt ở app kia ngay sau (nạp lại
  qua bus); flow theo lịch với hai app cùng chạy (`SYNCHRONIZATION_STORE=redis`) trong cặp đối chiếu riêng có
  namespace bus, lock, sync riêng (profile thủ công như `retention`); operation `trigger` gọi flow `operation` ở cùng
  app; log chạy do app này ghi đọc được qua `/revisions` của app kia.
- **FR-063**: PHẢI có Playwright E2E app Directus qua reverse proxy cho Settings → Flows (tạo flow thủ công với hai
  operation, sửa, bật tắt, xóa; `/flows`, `/operations` tới app mới), nút chạy flow trên trang item và danh sách
  (`/flows/trigger` tới app mới), Logs sidebar (`/revisions` tới app mới); và benchmark ở hai app cho
  `POST /flows/trigger/:id` đồng bộ (flow `transform` → `condition` → `item-read`, `return = $last`) và `GET /flows`
  (query của store app Directus) với 50 kết nối, ở workflow benchmark hằng tuần, không chặn CI.

### Key Entities

- **Flow**: một dòng `directus_flows`: tên, trạng thái (`active`, `inactive`), `trigger` (`event`, `schedule`,
  `operation`, `webhook`, `manual`), `options` theo trigger (`type`, `scope`, `collections`, `cron`, `method`,
  `async`, `cacheEnabled`, `error_on_reject`, `return`, `requireSelection`, `requireConfirmation`, `fields`),
  `operation` gốc, `accountability` (`all`, `activity`, null).
- **Operation**: một dòng `directus_operations` thuộc một flow: `key` (khóa dữ liệu), `type` (một trong 15 id),
  `options` (có thể chứa `{{ }}`), `resolve`, `reject` trỏ operation kế, vị trí trên canvas.
- **Lần chạy flow**: dữ liệu theo khóa (`$trigger`, `$last`, `$accountability`, `$env`, khóa từng operation), danh
  sách bước (operation, key, status, option đã thay thế), kết quả trả về; được ghi thành **Activity** `run` và
  **Revision** (`data.steps`, `data.data` đã che).
- **Đồng hồ đồng bộ**: khóa Redis `<SYNCHRONIZATION_NAMESPACE>:<flow id>:<cron>` dùng chung giữa mọi instance của hai
  app khi `SYNCHRONIZATION_STORE=redis`.
- **Message nạp lại**: `{ type: 'reload' }` trên kênh `flows` của bus dùng chung.

## Khác biệt so với Directus *(mandatory)*

Thay đổi với bảng khác biệt của các feature trước:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-09.7 | Gỡ: `/flows`, `/operations`, `/flows/trigger/:id` làm ở feature này | FR-001 đến FR-015 |
| D-26 | Gỡ: flow theo event `auth.login`, `auth.jwt`, `auth.create`, `auth.update`, `authenticate` chạy ở app mới | FR-010, FR-022 |
| D-29 | Gỡ: flow theo event của năm collection của 004 chạy ở app mới | FR-010, FR-022 |
| D-31 | Thu hẹp: bỏ `directus_flows`, `directus_operations` khỏi danh sách collection hệ thống đi qua `ItemsService` chung | FR-003 |

Giữ nguyên: D-09.8 (`/utils`, `/settings`, ... chờ 010), D-33. Sửa bảng của spec cũ đi cùng feature này: dòng D-09.7
trong spec 001, dòng D-26 trong spec 003, dòng D-29 và D-31 trong spec 004; entry tương ứng trong
`tests/parity/accepted-differences.ts`; `tests/parity/proxy/backoffice-routes.txt` thêm `flows`, `operations`. Mọi
dòng cần tech lead duyệt khi đóng feature (Nguyên tắc X).

Khác biệt mới:

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại | Gỡ khi |
|----|----------|------------------|---------|-------|------|--------|
| D-34 | Operation `mail` | `MailService.send` qua `EMAIL_TRANSPORT` (sendmail, smtp, mailgun, ses), render markdown hoặc template liquid, lỗi gửi chỉ ghi log | Qua rate limiter như Directus rồi ghi một dòng log cảnh báo thay vì gửi (như D-23, D-27, D-28, D-33); kết quả của operation giống nhau (undefined) | Mô tả feature: "không gửi email, chỉ ghi log"; `EMAIL_*` thuộc nhóm chưa hỗ trợ; Nguyên tắc X | ngoài phạm vi (lâu dài) | khi dự án quyết định gửi email |

**Rủi ro chấp nhận (tái tạo từ Directus)**: như quy tắc của 004 đến 008. Bằng chứng tối thiểu cho mỗi R-xx trước khi
đóng feature: tên ca test đối chiếu tái tạo, request gửi, kết quả đo trên Directus 11.17.4 thật và ngày đo, ghi vào cột
"Bằng chứng"; cần tech lead duyệt khi đóng feature.

| Mã | Hành vi của Directus | Bằng chứng | Hệ quả |
|----|----------------------|------------|--------|
| R-22 | `FlowsService.deleteMany` đặt `resolve`, `reject` của mọi operation thuộc flow về null bằng knex thô, ngoài transaction và trước khi `ItemsService.deleteMany` kiểm quyền | `services/flows.ts` (`deleteMany`); đo ở T0xx: user không có quyền delete trên `directus_flows` gọi `DELETE /flows/:id` | Nhận `403` nhưng các operation của flow đã mất liên kết (flow hỏng, chỉ còn operation gốc); lỗi DB giữa chừng cũng để lại trạng thái này. Tái tạo (FR-002) |
| R-23 | Nạp lại flow dừng và đăng ký lại mọi job cron; `SynchronizedClock.reset()` xóa khóa Redis của job, nên nạp lại ngay trước một kỳ cho phép cả hai instance `setGreaterThan` thành công | `utils/schedule.ts` (`stop`), `synchronization.ts` (`reset`); đo ở T0xx bằng Redis `MONITOR`: `DEL` rồi hai `SET` của cùng khóa quanh một kỳ ở Directus 11.17.4; ca test chấp nhận 10 hoặc 11 lần chạy trong 10 kỳ khi có nạp lại giữa chừng | Một kỳ có thể chạy ở cả hai bên ngay sau khi sửa flow; SC-004 đo khi không sửa flow trong cửa sổ đo. Tái tạo (FR-011, FR-014) |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. Kênh bus `flows`, khóa `<flow id>:<cron>`, namespace `directus-sync`, giá trị `action = run`, id operation,
  khóa `$trigger`, `$last`, `$accountability`, `$env`, thông điệp cảnh báo giữ nguyên vì là dữ liệu hoặc tên kỹ thuật
  dùng chung với app Directus và Directus (Nguyên tắc IX). Hai dòng log mới (FR-011, FR-036) mang tiền tố
  "Backoffice:" như D-33.

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4. Khi spec không nói rõ, làm như code Directus. Quy ước message lỗi và quy tắc so
  của bộ đối chiếu như Assumptions của 004 đến 008.
- "Cùng một flow cho kết quả giống nhau ở hai app" (tiêu chí chấp nhận) nghĩa là: với cùng định nghĩa flow trong DB
  dùng chung và cùng request kích hoạt, hai app trả cùng response, để lại cùng hiệu ứng phụ trong DB, và ghi cùng dòng
  activity `run`, revision (`data.steps`, `data.data`) sau chuẩn hóa (FR-060); với operation `request`, cùng request
  tới server giả. `$env` bằng nhau vì hai app đọc cùng `.env` (Nguyên tắc VIII).
- "Flow theo lịch không bị chạy hai lần" nghĩa là: với `SYNCHRONIZATION_STORE=redis` và cùng `SYNCHRONIZATION_NAMESPACE`
  ở mọi instance của hai app, mỗi kỳ của mỗi flow theo lịch chạy ở đúng một instance (SC-004). Đây là cơ chế duy nhất
  Directus có cho job theo lịch (`SynchronizedClock`); với store `memory` (mặc định của Directus) mỗi instance tự chạy,
  kể cả giữa hai instance Directus, và app mới không thể ngăn Directus chạy. App mới không thêm khóa riêng (Nguyên
  tắc VIII: không biến mới; một khóa chỉ app mới biết cũng không ngăn được Directus), chỉ cảnh báo (FR-011). Lệ
  ngoại lệ với `retention` của 008: Directus tự có khóa `schedule--data-retention` nên không phụ thuộc store.
- Flow theo event chỉ chạy ở app phát event (in-process), như hai instance Directus; không có cơ chế chuyển event
  giữa hai app (SPECKIT-GUIDE §1).
- Extension (operation tùy chỉnh, hook) chưa làm (SPECKIT-GUIDE §1): operation `type` lạ ở app mới dừng chuỗi với
  `unknown` như Directus khi extension không được cài; đây là hành vi Directus, không ghi khác biệt mới.
- Rate limiter email của flows giữ như Directus (store dùng chung, cùng counter theo flow id) dù không gửi email, để
  nhánh reject (`EmailLimitExceededError`) giống nhau; ba biến `RATE_LIMITER_EMAIL_FLOWS_*` vào nhóm hỗ trợ (FR-050).
- Tiền đề dùng chung `.env` (Nguyên tắc VIII): hai app cùng `FLOWS_*`, `RATE_LIMITER_EMAIL_FLOWS_*`,
  `SYNCHRONIZATION_*`, `REDIS_BUS_NAMESPACE`, `IMPORT_IP_DENY_LIST`, `PUBLIC_URL`. Nếu khác là ngoài phạm vi.
- Mặc định của Directus giữ nguyên: `FLOWS_ENV_ALLOW_LIST=false`, `FLOWS_RUN_SCRIPT_MAX_MEMORY=32`,
  `FLOWS_RUN_SCRIPT_TIMEOUT=10000`, `RATE_LIMITER_EMAIL_FLOWS_ENABLED=false`, `_POINTS=1`, `_DURATION=60`.
- Trình chỉnh sửa flow của app mới (FE) thuộc 017; 009 kiểm bằng app Directus qua proxy như 007, 008. GraphQL
  (`flows`, `operations`, `flows_trigger`) thuộc 011. AI tools (`ai/tools/flows`) ngoài phạm vi.
- Môi trường đối chiếu đã có proxy, cặp app chính; thêm một cặp thủ công cho lịch (namespace riêng,
  `SYNCHRONIZATION_STORE=redis`, `FLOWS_ENV_ALLOW_LIST` cho biến định danh instance) và một server HTTP giả cho
  `request`; E2E dùng cùng cách chạy Playwright như 007 (Chrome cài sẵn).
- Ca của bộ blackbox, unit fail trên chính Directus ở một vendor được bỏ qua kèm ghi chú tên ca, như 005 đến 008.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% ca của bộ blackbox, unit port (US7) đạt ở cả hai app trên Postgres, MySQL, SQLite trước khi đóng
  feature; vendor còn lại đạt ở một lượt `nightly.yml` bấm tay hoặc được ghi chú theo Assumptions.
- **SC-002**: 100% request của bộ đối chiếu `/flows`, `/operations`, `/flows/trigger/:id` (kể cả lỗi, `OPTIONS`,
  `HEAD`, `204`, `403`) cho cùng status, body, header ở hai app, ngoài khác biệt đã ghi (D-34).
- **SC-003**: 100% flow của bộ seed (mỗi trigger, mỗi operation, cả hai nhánh) cho cùng `$all` (theo tập so FR-060),
  cùng hiệu ứng phụ và cùng dòng activity `run`, revision ở hai app; với flow theo event, 100% request ghi kích hoạt
  flow ở app nhận request và chỉ ở đó.
- **SC-004**: Với hai app cùng chạy (`SYNCHRONIZATION_STORE=redis`, cặp đối chiếu riêng) và flow cron mỗi 5 giây,
  trong 10 kỳ liên tiếp không sửa flow: tổng số lần chạy đếm qua item do flow ghi và dòng activity `run` bằng đúng 10
  (0 lần trùng, 0 lần thiếu), Redis `MONITOR` ghi 10 lần đặt khóa đồng hồ thành công; lặp 3 lượt đều đạt.
- **SC-005**: 100% ca sửa flow ở một app (tạo, sửa operation, tắt, xóa) được app kia dùng ở lần kích hoạt kế tiếp sau
  tối đa 2 giây, cả hai chiều.
- **SC-006**: 100% kịch bản E2E app Directus (FR-063) qua app mới hoàn tất với cùng số bước và màn hình như qua
  Directus; ở mỗi kịch bản benchmark, p95 latency và throughput của app mới không tệ hơn Directus quá 10%, như tiền lệ
  005 đến 008.
