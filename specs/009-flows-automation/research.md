# Research: Flows và tự động hóa (009)

Mỗi mục gồm Quyết định, Lý do, Đã cân nhắc. Mốc so sánh là Directus 11.17.4 (api 35.2.0). Điều gì chưa đo thì ghi
`[Suy luận]` và có task kiểm sớm. Quyết định lớn đã chốt ở Clarifications của spec: không gửi email (D-33, D-34 lâu
dài); cảnh báo một dòng khi flow theo lịch chạy với `SYNCHRONIZATION_STORE` không phải `redis`. Đường dẫn Directus
tính từ `directus/api/src` trừ khi ghi khác; đường dẫn app mới tính từ gốc repo.

## R1. Thư viện: thêm isolated-vm, micromustache, p-queue; không marked, nodemailer

- **Quyết định**: Thêm vào catalog `pnpm-workspace.yaml` đúng bản Directus (`directus/pnpm-workspace.yaml`):
  `isolated-vm 5.0.3`, `micromustache 8.0.3`, `p-queue 8.1.0`; thêm `isolated-vm` vào `onlyBuiltDependencies`.
  `apps/api` phụ thuộc ba gói này; `libs/utils` thêm `micromustache` (cho `applyOptionsData`). Đã có: axios 1.15.0,
  cron 4.3.4, encodeurl 2.0.0, jsonwebtoken 9.0.3, lodash-es, `@backoffice/validation`, `@backoffice/memory`.
  Không thêm `marked`, `sanitize-html`, `liquidjs`, `nodemailer` (operation `mail` không render, không gửi; D-34).
- **Lý do**: `exec` cần isolated-vm thật (12 unit test gốc so message của chính isolated-vm); `applyOptionsData`,
  `get` của `executeFlow` dùng micromustache; hàng đợi nạp lại dùng p-queue. Cùng bản với Directus để kết quả giống
  (SC-003).
- **Đã cân nhắc**: Thay p-queue bằng hàng đợi promise tự viết: bị loại, 20 dòng mới để tiết kiệm một gói Directus đang
  dùng. Thay isolated-vm bằng `node:vm`: bị loại, không giới hạn bộ nhớ, khác message lỗi, trái mô tả feature.

## R2. `FlowManager`: port nguyên tại `apps/api/src/flows.ts`, khởi tạo trong `createApp`

- **Quyết định**: Port `flows.ts` nguyên (singleton `getFlowManager()`, bus kênh `flows`, p-queue, `load`, `unload`,
  `runOperationFlow`, `runWebhookFlow`, `executeFlow`, `executeOperation`, `getFlow`, `addOperation`,
  `removeOperation`). Khác nguồn (ghi `Backoffice:`):
  - `initialize()` đăng ký 15 operation có sẵn từ danh sách tĩnh `apps/api/src/operations/index.ts` trước khi `load`
    (Directus làm việc này trong `ExtensionManager.registerInternalOperations` bằng `readdir`; app mới không có
    extension manager, Nguyên tắc XI).
  - `createApp` (`apps/api/src/app.ts`) gọi `await getFlowManager().initialize()` ngay sau `subscribeSchemaChanged()`
    và trước `createExpressApp()`: đúng vị trí của Directus (`app.ts:128-131`: sau `registerAuthProviders`, mà app
    mới chạy ở cuối `runStartupChecks`, và trước `express()`).
  - `onServerShutdown(() => flowManager.unload())` để job cron không giữ process khi SIGTERM (như `schedules/*.ts`).
  - Sau khi đăng ký handler trong `load`, nếu có ít nhất một trigger `schedule` và `SYNCHRONIZATION_STORE !== 'redis'`
    thì `logger.warn('Backoffice: SYNCHRONIZATION_STORE is not redis; scheduled flows run on every instance')`
    (Clarifications, FR-011).
  - `getSchema` của app mới là `apps/api/src/schema/get-database-schema.ts` (cùng chữ ký `getSchema({database})`).
  - Test khởi động app (`app.test.ts`, các `*.controller.test.ts` gọi `createApp()`) mock `./flows.js` như đã mock
    `./schedules/*.js`, vì `load` đọc `directus_flows` bằng `FlowsService`.
- **Lý do**: FR-010 đến FR-024; thứ tự khởi tạo quyết định flow `event` bắt được request đầu tiên. Danh sách tĩnh tránh
  `readdir` + `import()` động trên `dist` của swc và dễ mock trong test.
- **Đã cân nhắc**: Nạp operation bằng `readdir` như Directus: bị loại, thêm đường dẫn runtime phụ thuộc layout `dist`
  mà không có lợi (không có extension). Khởi tạo FlowManager trong `startSchedules()` (sau Nest init): bị loại, request
  tới trước khi handler event đăng ký sẽ không kích hoạt flow, khác Directus.

## R3. Hai controller Nest mỏng; route trigger không dùng regex param

- **Quyết định**: `apps/api/src/controllers/flows.controller.ts` (`GET|POST trigger/:pk` trước `:pk`; `POST /`,
  `GET /`, `SEARCH /`, `GET /:pk`, `PATCH /`, `PATCH /:pk`, `DELETE /`, `DELETE /:pk`) và
  `operations.controller.ts` (CRUD) theo mẫu `comments.controller.ts` của 008 (`ServiceFactory`, `MetaService`,
  `runMiddleware(validateBatch(...))`, `respond`, `isBackofficeError(error, ErrorCode.Forbidden)` → `204`).
  Express 5 (path-to-regexp 8) không nhận `:pk(<regex>)` của Directus, nên handler trigger kiểm `pk` bằng
  `UUID_REGEX` (thêm vào `apps/api/src/constants.ts` từ `constants.ts:64`) và ném `RouteNotFoundError({ path:
  req.path })` khi không khớp: Directus trả `404 ROUTE_NOT_FOUND` cho `/flows/trigger/<không uuid>` vì không route
  nào khớp (`GET /:pk` chỉ một segment). `useCollection('directus_flows')`, `useCollection('directus_operations')`
  trong `app.module.ts`; `router-options.ts` thêm khối Feature 009 (`/flows`, `/flows/:pk`, `/flows/trigger/:pk`
  với `GET, POST`, `/operations`, `/operations/:pk`). Task đầu kiểm `OPTIONS`, `HEAD`, uuid sai, `trigger` của flow
  không có (`403`) bằng supertest.
- **Lý do**: FR-001, FR-013; tiền lệ R4 của 007, 008.
- **Đã cân nhắc**: Một controller cho cả `/flows` và `/operations`: bị loại, `useCollection` theo tiền tố route.

## R4. `FlowsService`, `OperationsService`, `getService`

- **Quyết định**: Port nguyên `services/flows.ts` → `apps/api/src/services/flows.service.ts` và
  `services/operations.ts` → `operations.service.ts` (gọi `getFlowManager().reload()` sau `createOne`, `updateMany`,
  `deleteMany`; `FlowsService.deleteMany` đặt `resolve`, `reject` về null bằng `this.knex` thô trước khi xóa, R-22).
  `getService` thêm hai `case`, bỏ `directus_flows`, `directus_operations` khỏi `COLLECTIONS_WITHOUT_SERVICE_YET`
  (D-31 thu hẹp). `services/index.ts` export hai service; `flows.ts` dùng `import * as services from
  './services/index.js'` làm `context.services` của handler như Directus.
- **Lý do**: FR-002, FR-003: ghi lồng `operations` của trình chỉnh sửa (`PATCH /flows/:pk` với `operations:
  {create, update, delete}`) đi qua `PayloadService` → `getService('directus_operations')`, phải phát nạp lại.
- **Đã cân nhắc**: Không có.

## R5. 15 operation port nguyên; `mail` thay bước gửi bằng log

- **Quyết định**: `apps/api/src/operations/<id>/index.ts` (+ `index.test.ts` gốc) cho `condition`, `exec`,
  `item-create`, `item-read`, `item-update`, `item-delete`, `json-web-token`, `log`, `mail` (+ `rate-limiter.ts` và
  test gốc), `notification`, `request`, `sleep`, `throw-error`, `transform`, `trigger`; `operations/index.ts` liệt
  kê 15 config. `defineOperationApi` port từ `directus/packages/extensions/src/shared/utils/define-extension.ts`
  (chỉ hàm này) vào `apps/api/src/operations/define-operation-api.ts`; kiểu `OperationHandler`,
  `OperationContext`, `OperationApiConfig` port từ `directus/packages/types/src/extensions/operations.ts` vào
  `libs/types/src/operations.ts`; `Flow`, `FlowRaw`, `Operation`, `OperationRaw`, `TriggerType` từ
  `packages/types/src/flows.ts` vào `libs/types/src/flows.ts`.
  Ánh xạ import: `@directus/utils` → `@backoffice/utils`; `@directus/errors` → `@backoffice/errors`;
  `@directus/validation` → `@backoffice/validation`; `../../request/index.js` (đã có `getAxios` với agent kiểm
  `IMPORT_IP_DENY_LIST`); `../../utils/get-accountability-for-role.js`, `sanitize-query.js`, `../../services/*.js`,
  `../../rate-limiter.js` (`createRateLimiter`, `RateLimiterRes`) đều đã có.
  `mail/index.ts`: giữ `useFlowsEmailRateLimiter(flow!.id)` và cách dựng `mailObject`, rồi thay
  `new MailService(...)` + `send` bằng một dòng `logger.warn('Backoffice: mail sending is out of scope; flow mail
  "<subject>" to <to> not sent')`, trả undefined (D-34). 7 test gốc của `mail` (spy `MailService.prototype.send`,
  `md`) viết lại thành test của dòng log (cùng 7 ca option) vì không còn `MailService`, `md`.
  `exec/index.test.ts` chạy với isolated-vm thật (không mock) ở `apps/api` unit test; job `quality` của CI build
  native khi `pnpm install` (như sharp, argon2).
- **Lý do**: FR-030 đến FR-041; Nguyên tắc X (không gửi email, luồng vẫn chạy, log cảnh báo).
- **Đã cân nhắc**: Port `MailService` rồi chặn ở `send`: bị loại, kéo theo nodemailer, liquidjs, marked và
  `EMAIL_*` (nhóm chưa hỗ trợ, 010 không gửi email theo Clarifications).

## R6. Tiện ích dùng chung port kèm test gốc

- **Quyết định**: `libs/utils/src/shared/`: `apply-options-data.ts` (`applyOptionsData`, `optionToObject`,
  `optionToString`; 12 test), `sieve-functions.ts` (8), `is-valid-json.ts` (2) từ `directus/packages/utils/shared/`;
  `apps/api/src/utils/redact-object.ts` (14 test) và `construct-flow-tree.ts` (không có test gốc; test mới 3 ca:
  cây đúng, operation gốc null, tham chiếu thiếu ném "Undefined reference in operations"). `deepMap`, `toArray`,
  `parseJSON`, `getRedactedString`, `parseFilter`, `validatePayload` đã có. `libs/utils` build lại trước `apps/api`
  (nx `^build`).
- **Lý do**: FR-020, FR-021, FR-023, FR-041.
- **Đã cân nhắc**: Đặt `applyOptionsData` trong `apps/api`: bị loại, Directus để ở `@directus/utils` và 017 (FE) có
  thể cần cùng hàm.

## R7. `name` của lỗi là `DirectusError` (tương thích dữ liệu flow)

- **Quyết định**: `libs/errors/src/create-error.ts` đổi `name = 'BackofficeError'` thành `'DirectusError'`;
  `isBackofficeError` so `name === 'DirectusError'`; sửa ba test đang so `name` (`create-error.test.ts`,
  `errors/messages.test.ts`, `apps/api/src/errors/error-handler.test.ts`). Tên hàm, interface
  (`BackofficeError`, `isBackofficeError`) giữ nguyên. Ghi vào "Cần xác nhận" của spec; cần tech lead duyệt khi đóng
  feature (Nguyên tắc IX: giữ định danh ảnh hưởng tương thích).
- **Lý do**: `name` là class field nên enumerable; Directus serialize lỗi của bước reject vào ba chỗ người dùng thấy:
  `$all` trả cho client webhook (`res.json` → `{name, extensions, code, status}`), `directus_revisions.data` của
  flow log (`redactObject` đổi `Error` thành `{name, message, stack, cause}`), và `$last` đưa vào `condition`,
  `exec` (script người dùng có thể so `name`). Dòng DB và response phải trùng Directus (Nguyên tắc II, III; SC-002,
  SC-003). Lỗi trả về client qua error handler không có `name` nên 001 đến 008 chưa gặp.
- **Đã cân nhắc**: Đổi `name` chỉ khi serialize trong `flows.ts`: bị loại, phải can thiệp vào ba đường (`res.json`,
  `redactObject`, `sieveFunctions`) và script `exec` vẫn thấy `BackofficeError`. Ghi khác biệt D-35 "name khác": bị
  loại, dữ liệu trong DB dùng chung khác nhau là vi phạm Nguyên tắc II.

## R8. Flow theo lịch: đúng cơ chế Directus, không khóa riêng

- **Quyết định**: `scheduleSynchronizedJob(flow.id, cron, ...)` đã có (`apps/api/src/utils/schedule.ts`,
  `SynchronizedClock` với store `memory`/`redis`, key `<SYNCHRONIZATION_NAMESPACE>:clock:<flow id>:<cron>`, Lua
  `setGreaterThan`). Không thêm `useLock`. Dòng cảnh báo khi store không phải `redis` (R2). `unload` khi SIGTERM gọi
  `job.stop()` → `clock.reset()` xóa key (như Directus khi nạp lại; R-23).
- **Lý do**: Assumptions của spec: khóa chỉ app mới biết không ngăn được Directus; Nguyên tắc VIII (không biến mới).
- **Đã cân nhắc**: Thêm `useLock` theo kỳ: bị loại (lý do trên).

## R9. Biến môi trường sang nhóm A

- **Quyết định**: Thêm vào `SUPPORTED_VARIABLES` khối Feature 009: `FLOWS_ENV_ALLOW_LIST`,
  `FLOWS_RUN_SCRIPT_MAX_MEMORY`, `FLOWS_RUN_SCRIPT_TIMEOUT`, `RATE_LIMITER_EMAIL_FLOWS_.+` (mẫu
  `RATE_LIMITER_(?!EMAIL_).+` giữ nguyên; `RATE_LIMITER_EMAIL_ENABLED` vẫn nhóm C). Sửa
  `specs/001-platform-foundation/contracts/config.md` dòng A và C; `supported-variables.test.ts` bỏ lọc
  `RATE_LIMITER_EMAIL*` ở dòng 31 thành lọc `RATE_LIMITER_EMAIL_(?!FLOWS_)`, thêm ca `['FLOWS_ENV_ALLOW_LIST', true]`,
  `['RATE_LIMITER_EMAIL_FLOWS_POINTS', true]`; `warn-unsupported-variables.test.ts` giữ ca `RATE_LIMITER_EMAIL_ENABLED`.
  Không có entry `type-map` cho các biến này (Directus cũng không): `FLOWS_ENV_ALLOW_LIST` qua `guessType` (`false`
  → boolean; `A,B` → mảng; một tên → chuỗi, `toArray` xử lý), như Directus.
- **Lý do**: FR-050; mặc định đã có trong `libs/env/src/constants/defaults.ts`.
- **Đã cân nhắc**: Không có.

## R10. Bộ đối chiếu `tests/parity/src/flows/`

- **Quyết định**: Thư mục mới `tests/parity/src/flows/` (không đụng `src/auth/flows.ts` của 003). `helpers.ts`:
  `same()` với `withoutD097` (lọc `D-09.7` khi feature đang mở, tiền lệ 008 `withoutD096`), `seedFlow(app, def)`
  tạo flow + operation qua API của một app rồi đợi app kia nạp lại (poll `GET /flows/:id` hoặc gọi thử), `runWebhook`,
  `flowEffects(fn)` = `historyEffects` (dòng `directus_activity` `run`, `directus_revisions`) + dòng mới của
  collection đích và `directus_notifications`; `comparable()` thêm chuẩn hóa `data.data.$env` (bỏ), `data.steps[].
  operation` (id → chỉ số), `headers` của `request` (chỉ giữ `content-type`, `content-length`), thời điểm. Các file:
  `crud.test.ts` (FR-001 đến FR-004; ghi lồng; R-22), `webhook.test.ts` (US1 ca 1–4, 7), `manual.test.ts` (US1 ca
  5, 6), `event.test.ts` (US3: filter chặn, filter đổi payload qua `return`, action đợi hiệu ứng, collection hệ thống
  `directus_users`, `directus_files`, `directus_comments`), `operations.test.ts` (US4: mỗi operation một flow webhook
  `return = $all`, ca resolve và reject; `request` gọi `http://directus:8055/server/ping` và `/server/info`, ca lỗi
  `/server/nope` → `404`; `trigger` ba `iterationMode`), `logs.test.ts` (US6: dòng activity, revision của mọi
  trigger, redaction, lỗi serialize R7, D-34 qua `logs()` của `docker.ts`), `reload.test.ts` (US5, FR-062, SC-005:
  sửa ở A, kích hoạt ở B trong 2 s, hai chiều), `schedule.test.ts` (US2, SC-004 trên cặp `flows-schedule`; R12),
  `e2e-app.test.ts` (chuỗi request của `flow.vue` `saveChanges`, `stores/flows.ts`, `use-flows.ts`,
  `logs-sidebar-detail.vue` → `use-revisions.ts`). `suite.ts`: `REDUCED_FILES` thêm `crud`, `webhook`, `manual`,
  `event`, `operations`, `logs`, `reload`; `FULL_FILES` thêm `src/flows/**/*.test.ts`. `server/errors.test.ts` bỏ
  `/flows` khỏi ca `404` D-09.*. `request-set.ts` thêm request `/flows`, `/operations` chỉ đọc cho `db-unchanged`.
  Cache: bộ đối chiếu gửi `Cache-Control: no-store` tới cặp chính (005) nên `cacheEnabled` của webhook `GET` kiểm ở
  blackbox (R11); `webhook.test.ts` chỉ kiểm header `Cache-Control` của response.
- **Lý do**: FR-060 đến FR-062; tiền lệ R6 của 008. `request` dùng Directus làm server đích để không thêm container.
- **Đã cân nhắc**: Thêm container httpbin cho `request`: bị loại, `/server/ping`, `/server/info` đủ cho thành công,
  lỗi HTTP và header; lỗi mạng kiểm bằng host không tồn tại.

## R11. Blackbox: `webhook.test.ts` trên cặp `cache-mem`; `schedule-hook` thay bằng `schedule.test.ts`

- **Quyết định**: Copy `tests/db/routes/flows/webhook.test.ts` vào `tests/parity/src/items/blackbox/tests/db/routes/
  flows/`; thay khối `spawn` bằng `env[vendor]['URL'] = nodeUrl('cache-mem', 1)` + `describe.skipIf(!hasProfile(
  'cache-mem'))` (tiền lệ `schema-cache.test.ts`), mở rộng union của `nodeUrl` với `'cache-mem'`; thêm `cache-mem`
  vào `--profiles` của job `parity-blackbox` (ci.yml, ci-local.sh) và file vào `AFTER` của `sequencer.ts` như
  Directus (`sequential-tests.ts:29`). Cặp `cache-mem` có `CACHE_ENABLED=true`, `CACHE_STORE=memory` đúng như test
  gốc (`CACHE_SKIP_ALLOWED=false` không ảnh hưởng: test không gửi `Cache-Control`).
  `tests/common/flows/schedule-hook.{seed,test}.ts` không copy được (ba process với env khác nhau, đếm stdout): thay
  bằng `src/flows/schedule.test.ts` làm cùng phép đo trên cặp `flows-schedule` (R12): seed cùng flow (`*/2 * * * * *`,
  `log` với `flow-executed-on-{{ $env.FLOWS_SCHEDULE_HOOK_NAME }}`), đếm dòng log của hai container qua `logs()`
  (`docker.ts`): tổng 5 dòng trong 10 s như ca redis của Directus; ca "node memory chạy riêng 5 lần" bỏ (không có node
  thứ ba; hành vi memory được đo ở unit test `schedule.test.ts` đã port ở 008).
- **Lý do**: FR-061; shim không có `paths.cli` (không spawn Directus).
- **Đã cân nhắc**: Cặp blackbox riêng cho webhook: bị loại, `cache-mem` đã đúng cấu hình.

## R12. Cặp profile `flows-schedule` (thủ công)

- **Quyết định**: Cặp `directus-flows-schedule` / `backoffice-api-flows-schedule` (cổng 10355/10356, profile
  `flows-schedule`, `manualProfiles` thêm), `env/profile-flows-schedule.env`: `CACHE_NAMESPACE=parity-flows-schedule`,
  `REDIS_BUS_NAMESPACE=parity-flows-schedule:bus`, `REDIS_LOCK_NAMESPACE=parity-flows-schedule:lock`,
  `SYNCHRONIZATION_STORE=redis`, `SYNCHRONIZATION_NAMESPACE=parity-flows-schedule:sync`,
  `FLOWS_ENV_ALLOW_LIST=FLOWS_SCHEDULE_HOOK_NAME`, `LOG_LEVEL=info`; compose `environment:` mỗi container
  `FLOWS_SCHEDULE_HOOK_NAME=directus` / `backoffice` (tiền lệ `CACHE_NAMESPACE` của `schema-cache`). Đăng ký ở
  `profilePorts`, `docker.ts compose()`, `scripts/env.mjs ALL_PROFILES`, `vendors.test.ts` tự kiểm. `schedule.test.ts`
  `profileUp` ở `beforeAll`, `profileStop` ở `afterAll` (kể cả khi `beforeAll` lỗi), chạy `sequential` cuối suite
  `flows` như `retention.test.ts`. Flow seed tạo qua API của cặp này, giữ `accountability` mặc định `all` để đếm
  cả dòng activity `run` (SC-004); xóa flow ở `afterAll` **qua API của cặp chính** để cặp chính (nếu đã nạp lại
  trong lúc test vì một suite khác ghi flow) bỏ flow này khỏi bộ nhớ.
- **Lý do**: US2, SC-004; cặp chính dùng `SYNCHRONIZATION_STORE=memory` và flow theo lịch gọi `getSchema` mỗi kỳ
  (tăng R-19 trong namespace chung), nên tách cặp như `retention`.
- **Đã cân nhắc**: Bật `SYNCHRONIZATION_STORE=redis` ở cặp chính: bị loại (R-19, và cặp chính phải giữ mặc định
  Directus cho các suite khác).

## R13. Playwright và benchmark

- **Quyết định**: `tests/directus-app-e2e/src/flows.spec.ts` với `bothRuns`: Settings → Flows → tạo flow thủ công
  (collection `posts` tạo qua `DIRECTUS_URL` như `history.spec.ts`) với `transform` → `log`, lưu; mở item → nút
  Flows → chạy → thông báo thành công; danh sách → chọn 2 item → chạy; Logs sidebar có 2 lần chạy với từng bước;
  tắt flow → nút biến mất; xóa flow. Bảng so: `directus_flows`, `directus_operations`, `directus_activity`
  (`run`), `directus_revisions`. `routing.spec.ts` thêm `flows`, `operations`. Benchmark `tests/benchmark/src/flows.ts`
  + `seed-flows.ts`: `webhook-sync` (`POST /flows/trigger/:id`, flow `transform` → `condition` → `item-read`,
  `return = $last`, `accountability: null` để không ghi log mỗi request) và `flows-list` (`GET /flows?fields[]=*&
  fields[]=operations.*&limit=-1` với 50 flow), 50 kết nối, 3 vòng, cùng mẫu `history.ts`; job `benchmark-flows`.
- **Lý do**: FR-063, SC-006.
- **Đã cân nhắc**: Benchmark flow `exec`: bị loại khỏi cổng 10% (tạo isolate mỗi lần chạy là chi phí của isolated-vm,
  giống nhau ở hai app); đo một vòng không chặn để ghi số.

## R14. Bảng khác biệt, guard và proxy

- **Quyết định**: Khi đóng feature: xóa entry `D-09.7`, `D-26`, `D-29`; sửa `D-31` (bỏ hai collection khỏi
  `COLLECTIONS_WITHOUT_SERVICE_YET`, cập nhật comment); `D-33` bỏ `removeAt` và sửa bảng spec 008 (`Loại` lâu dài,
  `Gỡ khi` `—`); thêm `D-34` kind `doc` (`removeAt` không có; spec ghi `—` vì parser `spec-differences.ts` chỉ nhận
  `—`, `theo bản đồ`); sửa dòng tương ứng ở spec 001, 003, 004. `proxy/backoffice-routes.txt` thêm `flows`,
  `operations` (tiền tố `flows` bao `/flows/trigger/...`); `proxy-conf.test.ts`, `routing.spec.ts` sửa theo.
- **Lý do**: Guard `accepted-differences.test.ts` so `removeAt` với cột "Gỡ khi" của spec; tiền lệ 007, 008.
- **Đã cân nhắc**: Không có.

## R15. Test đơn vị và coverage

- **Quyết định**: Port `flows.test.ts` (2 ca, mock như Directus nhưng `@backoffice/env`, `./schema/get-database-
  schema.js`, `./operations/index.js`), 15 `index.test.ts` của operation, `rate-limiter.test.ts`, `redact-object.
  test.ts`, test của ba hàm `libs/utils`. Viết mới: `flows.test.ts` phần Backoffice (đăng ký event theo scope ×
  collections, cron không hợp lệ, cảnh báo store memory, `runWebhookFlow` `403`, manual đủ 6 lỗi và ca non-admin,
  `executeFlow` với `return` `$all`/đường dẫn/rỗng, `error_on_reject`, filter reject ném, activity/revision theo
  `accountability`, redaction, `executeOperation` type lạ, `undefined` → null, lỗi chuỗi JSON), hai controller
  (supertest: uuid sai `404`, trigger `GET`/`POST`, `204` async, `OPTIONS`), `flows.service.test.ts`,
  `operations.service.test.ts` (gọi `reload`), `get-service.test.ts`, `construct-flow-tree.test.ts`,
  `supported-variables.test.ts`, `app.test.ts` (thứ tự khởi tạo, `unload` khi shutdown). Coverage 80% `apps/api`,
  `libs/utils`, `libs/errors`.
- **Lý do**: Nguyên tắc VI, X.
- **Đã cân nhắc**: Không có.
