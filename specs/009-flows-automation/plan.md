# Implementation Plan: Flows và tự động hóa (`/flows`, `/operations`, `/flows/trigger/:id`)

**Branch**: `009-flows-automation` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-flows-automation/spec.md`

## Summary

App mới chạy flows giống hệt Directus 11.17.4: `FlowManager` port nguyên (trigger `event` filter/action, `schedule`,
`operation`, `webhook`, `manual`; dữ liệu `$trigger`, `$last`, `$accountability`, `$env`; nhánh resolve/reject; log
chạy vào `directus_activity` `run` và `directus_revisions`), 15 operation có sẵn port nguyên (`exec` trong isolated-vm
với `FLOWS_RUN_SCRIPT_MAX_MEMORY`, `FLOWS_RUN_SCRIPT_TIMEOUT`; `mail` qua rate limiter rồi ghi log thay gửi, D-34),
route `/flows`, `/operations`, `/flows/trigger/:id`, `FlowsService`, `OperationsService` phát nạp lại qua bus kênh
`flows` dùng chung với Directus, flow theo lịch qua `SynchronizedClock` trên Redis như Directus (một bên chạy mỗi kỳ
khi `SYNCHRONIZATION_STORE=redis`, cảnh báo khi không). Gỡ D-09.7, D-26, D-29; thu hẹp D-31; D-33 lâu dài; thêm
D-34; `name` của lỗi về `DirectusError` (tương thích dữ liệu flow, R7).

Cách làm:

- Port nguyên, cùng đường dẫn, kèm test gốc: `flows.ts`, `services/flows.ts`, `services/operations.ts`,
  `operations/*` (15), `utils/redact-object.ts`, `utils/construct-flow-tree.ts`, `@directus/utils`
  `applyOptionsData`, `sieveFunctions`, `isValidJSON`, kiểu `flows.ts`, `extensions/operations.ts`;
  `defineOperationApi` (R2, R4 đến R6).
- Hai controller Nest mỏng theo mẫu 008; route trigger kiểm uuid thay regex param của Express 4 (R3). `FlowManager`
  khởi tạo trong `createApp` trước Express, `unload` khi SIGTERM (R2).
- Thêm isolated-vm 5.0.3, micromustache 8.0.3, p-queue 8.1.0 (bản Directus); 6 biến sang nhóm A (R1, R9).
- Bộ đối chiếu `tests/parity/src/flows/` (10 file), blackbox `webhook.test.ts` trên cặp `cache-mem`, cặp thủ công
  `flows-schedule` cho lịch, Playwright `flows.spec.ts`, benchmark `flows.ts`, job `benchmark-flows` (R10 đến R13,
  contracts/parity.md).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

Stack theo prompt của chủ dự án và cách feature này đáp ứng:

| Yêu cầu | Ở feature 009 |
|---------|---------------|
| Node 22, pnpm 10, Nx, `apps/api` NestJS strict | Giữ như 001 đến 008; thêm ba gói Directus đang dùng (R1) |
| Knex với dialect như `directus/api/src/database/helpers` | Không DDL; `FlowsService.deleteMany` dùng knex thô như Directus; filter flow chạy trên transaction của request (`context.database`) |
| Cache, bus Redis cùng key và kênh Directus | Kênh `flows` trên `REDIS_BUS_NAMESPACE`; clock `directus-sync:clock:<id>:<cron>`; rate limiter `RATE_LIMITER_EMAIL_FLOWS`; response cache của webhook `GET` với `cacheQueryParams` (005); không key mới (R8) |
| Validate bằng Joi hoặc Zod giống Directus | `condition` dùng `validatePayload` (Joi) của `@backoffice/validation`; không schema mới |
| Port từ `directus/api/src`, ghi đường dẫn gốc | Bảng ánh xạ bên dưới; manifest `tools/port-manifest/009-T*.json`; guard `check-port-headers` |
| Thư viện nội bộ `@backoffice/*` | `@backoffice/types` thêm `flows.ts`, `operations.ts`; `@backoffice/utils` thêm ba hàm; `@backoffice/errors` đổi `name` (R6, R7) |
| Env port từ `packages/env`, không đổi tên biến | Không biến mới; `FLOWS_*`, `RATE_LIMITER_EMAIL_FLOWS_*` sang nhóm A (R9) |
| Mỗi service Directus một provider, controller mỏng | `FlowsService`, `OperationsService` qua `ServiceFactory`; `FlowManager` là singleton module như Directus (không provider, dùng trước Nest); hai controller chỉ parse, chạy middleware, gọi service hoặc `runWebhookFlow`, `respond` (R2, R3) |
| Vitest; test đối chiếu copy từ `directus/tests/blackbox`; Compose Postgres, MySQL, SQLite, Redis | R10 đến R12, contracts/parity.md; 1 file blackbox; 20 file unit gốc port nguyên + `mail` viết lại; profile `flows-schedule`, `cache-mem` |
| GitHub Actions, coverage BE 80% | contracts/parity.md §4; R15 |

**Language/Version**: TypeScript 5.9.3 (bộ cờ strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS, ESM, pnpm
10.27.0, Nx 23.3. Giữ như 001 đến 008.

**Primary Dependencies**:
- Đã có: NestJS 12 (Express 5.2.1), knex 3.1.0, axios 1.15.0 (`getAxios` với agent `IMPORT_IP_DENY_LIST`),
  jsonwebtoken 9.0.3, cron 4.3.4, encodeurl 2.0.0, lodash-es, `@backoffice/memory` (bus, lock), `@backoffice/utils`
  (`deepMap`, `toArray`, `parseJSON`, `getRedactedString`, `parseFilter`, `validatePayload`), `@backoffice/errors`
  (`createError`, `ForbiddenError`, `InternalServerError`, `EmailLimitExceededError`, `RouteNotFoundError`),
  `@backoffice/validation` (`FailedValidationError`, `joiValidationErrorItemToErrorExtensions`),
  `@backoffice/system-data` (`isSystemCollection`), `ItemsService`, `ActivityService`, `RevisionsService`,
  `NotificationsService`, `MetaService`, `getService`, `getAccountabilityForRole`, `fetchPolicies`,
  `fetchPermissions`, `sanitizeQuery`, `Emitter`, `useBus`, `SynchronizedClock`, `scheduleSynchronizedJob`,
  `validateCron`, `createRateLimiter`, `respond`, `validateBatch`, `useCollection`, `runMiddleware`,
  `ServiceFactory`, `onServerShutdown`, `isValidUuid`.
- Thêm: isolated-vm 5.0.3, micromustache 8.0.3, p-queue 8.1.0 (R1).

**Storage**:
- DB dùng chung; không DDL, không migration. Đọc `directus_flows`, `directus_operations` (`status = active`,
  `fields = *, operations.*`); ghi hai bảng qua service port nguyên; ghi `directus_activity`, `directus_revisions`
  ([data-model.md](./data-model.md) §6); operation `item-*`, `notification` ghi collection người dùng và
  `directus_notifications` theo quyền của `permissions`.
- Redis dùng chung: kênh `flows`, clock `directus-sync` (khi bật), counter rate limiter email flows, response cache;
  không key mới.

**Testing**:
- Vitest 3.2.4: test gốc port kèm code (`flows.test` 2, 15 operation 94 khối test, `rate-limiter` 5, `redact-object` 14,
  `apply-options-data` 12, `sieve-functions` 8, `is-valid-json` 2); test mới cho `FlowManager` (Backoffice), hai
  controller (supertest qua app Nest), hai service, `getService`, `construct-flow-tree`, `supported-variables`,
  `app.test` (R15). `exec/index.test.ts` chạy isolated-vm thật. Coverage 80% `apps/api`, `libs/utils`,
  `libs/errors`.
- `tests/parity/src/flows/` (R10): `helpers`, `crud`, `webhook`, `manual`, `event`, `operations`, `logs`, `reload`,
  `schedule` (cặp `flows-schedule`), `e2e-app`. Blackbox thêm `flows/webhook.test.ts` trên cặp `cache-mem` (R11,
  [contracts/parity.md](./contracts/parity.md)).
- `tests/directus-app-e2e/src/flows.spec.ts` (R13); `routing.spec.ts`, `backoffice-routes.txt` sửa.
- `tests/benchmark/src/{flows,seed-flows}.ts`, job `benchmark-flows` (R13).

**Target Platform**: Container Linux (`node:22-alpine`), nhiều replica cạnh Directus sau load balancer. Giữ như 001.
Image build isolated-vm ở stage builder (toolchain đã có, FR-051).

**Project Type**: Monorepo web (Nx). Chạm `apps/api`, `libs/types`, `libs/utils`, `libs/errors`, `tests/parity`,
`tests/directus-app-e2e`, `tests/benchmark`, CI, catalog pnpm.

**Performance Goals**:
- SC-006: `webhook-sync`, `flows-list` p95 và req/s không tệ hơn Directus quá 10%; `webhook-exec` chỉ ghi số; đo
  hằng tuần, không chặn CI (quyết định 003).
- SC-004: 10 kỳ, đúng 10 lần chạy khi hai app cùng chạy với `SYNCHRONIZATION_STORE=redis`.
- SC-005: app kia dùng flow mới sau tối đa 2 s.

**Constraints**:
- Kết quả operation, `steps[].options`, revision `data` trùng Directus: cùng bản micromustache, isolated-vm,
  jsonwebtoken; lỗi serialize cùng `name` (R7); so ở `operations.test.ts`, `logs.test.ts`.
- Không thêm biến môi trường; không email (D-33, D-34); không extension (type lạ → `unknown`); GraphQL, `/utils`
  không chạm (D-09.8, D-09.9).
- Express 5 không có regex param: `/flows/trigger/:pk` kiểm uuid trong handler (R3).
- Mọi file port ghi `// Ported from directus/...`; manifest `tools/port-manifest/009-T*.json`.
- Cặp `flows-schedule` thủ công (chạy flow mỗi 2 s, `getSchema` mỗi lần; R-19); cặp chính giữ
  `SYNCHRONIZATION_STORE=memory`.

**Scale/Scope**:
- Port khoảng 600 dòng `flows.ts`, 75 dòng hai service, 400 dòng controller (→ Nest), 700 dòng 15 operation + 160
  dòng `redact-object`, `construct-flow-tree`, 120 dòng ba hàm utils, 60 dòng type; test gốc khoảng 1.900 dòng; blackbox
  copy 1 file (180 dòng); mới khoảng 1.900 dòng test đối chiếu, 120 dòng profile/compose, 250 dòng Playwright, 250
  dòng benchmark. Lớn hơn 008 (SPECKIT-GUIDE: 009 là feature lõi, có thể tách "trigger và engine" / "operation" khi
  implement); một `tasks.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.4.0. Kết quả dưới đây là lần 2, sau research, data model và contracts
(lần 1 trước research không có vi phạm; sau Phase 1 thêm một vi phạm IV ở Complexity Tracking theo
`/speckit.analyze` 2026-10-13, và một ghi nhận IX cần duyệt).

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`. Mọi file port ghi `// Ported from directus/...` (bảng ánh
  xạ, manifest `009-T*.json`). Chỗ khác nguồn ghi `Backoffice:`: đăng ký operation từ danh sách tĩnh, cảnh báo store
  memory, `unload` khi shutdown, kiểm uuid trong controller, `mail` ghi log, test `mail` viết lại. Thêm khi làm
  (T049): `$trigger.path` bỏ tiền tố mount `/flows` của Nest; `name` lỗi `DirectusError` (R7); `get-cache-key` nạp
  `flows.js` khi dùng và bỏ phần GraphQL (feature 011); `auth.update` của OAuth2/OpenID truyền payload đã lọc vào
  `UsersService.updateOne`; test mock FlowManager khi dựng cả app; test viết mới nơi Directus không có test.
- [x] **II. Dùng chung DB**: PASS. Không DDL, không migration; ghi `directus_flows`, `directus_operations` qua
  `ItemsService`; activity `run`, revision `{steps, data}` cùng nội dung (SC-003, `logs.test.ts`); `name` lỗi về
  `DirectusError` để dữ liệu JSON trong DB trùng (R7); khởi động chỉ đọc (`load`).
- [x] **III. API giống hệt**: PASS. Route, middleware, status, mã lỗi, `204`, `403` manual, `404` uuid sai, `$all`,
  header cache, như Directus (contracts/flows-api.md). D-09.7, D-26, D-29 gỡ; D-31 thu hẹp; D-34 là hành vi Nguyên
  tắc X (không gửi email) như D-23, D-33; R-22, R-23 tái tạo, bằng chứng đo ở bộ đối chiếu.
- [x] **IV. Chạy song song an toàn**: VI PHẠM CÓ LÝ DO (Complexity Tracking, chờ tech lead duyệt). Bus kênh `flows`
  cùng namespace nên hai app nạp lại lẫn nhau; flow theo sự kiện chạy ở instance nhận request; không state quan trọng
  trong process (cây flow dựng lại từ DB ở mỗi nạp). Câu "Flow theo lịch PHẢI dùng lock trên Redis, mỗi lượt chỉ một
  instance chạy" chỉ đạt khi mọi instance của hai app đặt `SYNCHRONIZATION_STORE=redis` (clock Redis, cơ chế duy nhất
  Directus có); với mặc định `memory` mỗi instance chạy mỗi kỳ (app mới ghi cảnh báo, FR-011). Ngoại lệ clock `memory`
  của 007 chỉ ghi nhận cho job dọn TUS (idempotent), không áp cho flow.
- [x] **V. Kiểm thử đối chiếu**: PASS. `crud`, `webhook`, `manual`, `event`, `operations`, `logs`, `reload`,
  `schedule`, `e2e-app`; blackbox `webhook.test.ts` hai lượt; Postgres đủ bộ mỗi lần push, MySQL, SQLite rút gọn, còn
  lại nightly (FR-061).
- [x] **VI. Kiến trúc**: PASS. Hai controller mỏng; hai service là lớp Directus qua `ServiceFactory`; `FlowManager`
  giữ dạng module singleton như Directus vì phải chạy trước Nest (không provider; như `Emitter`, `useBus`); Knex,
  không ORM; mỗi thay đổi có test (R15).
- [x] **VII. Đa instance**: PASS. Cây flow trong process dựng lại từ DB và làm mới qua bus Redis trên mọi instance
  (đúng câu cache trong process của 1.2.0); clock qua Redis khi bật; `unload` khi SIGTERM; khởi động chỉ đọc.
- [x] **VIII. Biến môi trường**: PASS. Không biến mới; 6 biến sang nhóm A (R9); `$env` từ `FLOWS_ENV_ALLOW_LIST`
  dùng chung.
- [x] **IX. Đổi thương hiệu**: PASS. `name` của lỗi trở lại `DirectusError` vì lọt vào `$all`,
  `directus_revisions.data` và script `exec`: là giữ định danh ảnh hưởng tương thích đúng như IX yêu cầu (R7), đảo lại
  một đổi tên của 001 nên ghi nhận ở Complexity Tracking để tech lead duyệt.
  Giữ kênh `flows`, key clock, id operation, thông điệp cảnh báo (tên kỹ thuật dùng chung). Hai dòng log mới ghi
  "Backoffice:".
- [x] **X. Chất lượng và vận hành**: PASS. Coverage 80%. Benchmark hằng tuần (ngoại lệ 003). Playwright là cổng chặn.
  Không gửi email: `mail` chạy đúng luồng tới bước gửi, trả như Directus, ghi log (D-34). Gỡ D-09.7, D-26, D-29, thu
  hẹp D-31, D-33 lâu dài, D-34, R-22, R-23, R-24, R7, vi phạm IV cần tech lead duyệt trước khi đóng feature; bảng của
  spec 001, 003, 004, 008 sửa theo.
- [x] **XI. Ngoài phạm vi**: PASS. Không extension (operation tùy chỉnh không có; type lạ xử lý như Directus khi
  extension vắng); không email; không GraphQL (011), không WebSocket; AI tools của flows không port.

## Project Structure

### Documentation (this feature)

```text
specs/009-flows-automation/
├── plan.md              # File này
├── research.md          # Phase 0: R1–R15
├── data-model.md        # Phase 1: flows, operations, cây flow, dữ liệu lần chạy, log, env, Redis, event
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── flows-api.md         # /flows, /operations, /flows/trigger, runWebhookFlow, executeFlow, executeOperation, trigger
│   ├── operations.md        # 15 operation: option, hành vi, kết quả, lỗi
│   └── parity.md            # môi trường, bộ đối chiếu, blackbox, CI, Playwright, benchmark
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

Chỉ liệt kê phần thêm hoặc sửa. Cấu trúc chung giữ như plan 001 đến 008.

```text
backoffice-next/
├── pnpm-workspace.yaml                         # SỬA: catalog isolated-vm, micromustache, p-queue; onlyBuiltDependencies
├── libs/types/src/{flows,operations}.ts + index.ts     # MỚI ← packages/types/src/flows.ts, extensions/operations.ts
├── libs/utils/src/shared/{apply-options-data,sieve-functions,is-valid-json}.ts (+ test gốc)   # MỚI ← packages/utils/shared
├── libs/utils/package.json                     # SỬA: micromustache
├── libs/errors/src/{create-error,is-backoffice-error}.ts (+ test)   # SỬA: name DirectusError (R7)
├── apps/api/package.json                       # SỬA: isolated-vm, micromustache, p-queue
├── apps/api/src/
│   ├── app.ts (+ test)                         # SỬA: getFlowManager().initialize() trước createExpressApp; unload khi shutdown
│   ├── app.module.ts, providers.ts             # SỬA: 2 controller, useCollection; factory Flows, Operations
│   ├── constants.ts                            # SỬA: UUID_REGEX
│   ├── flows.ts (+ test gốc + test Backoffice) # MỚI ← flows.ts
│   ├── operations/index.ts                     # MỚI: danh sách 15 config
│   ├── operations/define-operation-api.ts      # MỚI ← packages/extensions/src/shared/utils/define-extension.ts (một hàm)
│   ├── operations/<id>/index.ts (+ test gốc)   # MỚI ← operations/<id>/index.ts (15); mail/rate-limiter.ts (+ test gốc)
│   ├── services/flows.service.ts (+ test)      # MỚI ← services/flows.ts
│   ├── services/operations.service.ts (+ test) # MỚI ← services/operations.ts
│   ├── services/index.ts                       # SỬA
│   ├── utils/redact-object.ts (+ test gốc)     # MỚI ← utils/redact-object.ts
│   ├── utils/construct-flow-tree.ts (+ test)   # MỚI ← utils/construct-flow-tree.ts
│   ├── utils/get-service.ts (+ test)           # SỬA: directus_flows, directus_operations
│   ├── controllers/flows.controller.ts (+ test)        # MỚI ← controllers/flows.ts (Nest)
│   ├── controllers/operations.controller.ts (+ test)   # MỚI ← controllers/operations.ts
│   ├── middleware/router-options.ts (+ test)   # SỬA: khối Feature 009
│   ├── errors/error-handler.test.ts            # SỬA: name
│   └── config/supported-variables.ts (+ test)  # SỬA: khối Feature 009
├── specs/001-platform-foundation/contracts/config.md   # SỬA: nhóm A, C
├── tests/parity/
│   ├── docker-compose.yml, env/profile-flows-schedule.env   # SỬA, MỚI: cặp flows-schedule (thủ công)
│   ├── env/<vendor>.env                        # SỬA: FLOWS_ENV_ALLOW_LIST một biến test (logs.test.ts)
│   ├── src/{config,docker}.ts, scripts/env.mjs, src/vendors.test.ts   # SỬA: profile mới, manualProfiles
│   ├── src/suite.ts, src/request-set.ts, src/server/errors.test.ts   # SỬA
│   ├── proxy/backoffice-routes.txt, src/proxy-conf.test.ts   # SỬA: flows, operations
│   ├── accepted-differences.ts                 # SỬA: xóa D-09.7, D-26, D-29; D-31; D-33 bỏ removeAt; D-34 (đóng feature)
│   ├── README.md                               # SỬA: mục 009
│   ├── src/flows/                              # MỚI (contracts/parity.md §2)
│   │   ├── helpers.ts
│   │   └── {crud,webhook,manual,event,operations,logs,reload,schedule,e2e-app}.test.ts
│   └── src/items/blackbox/
│       ├── tests/db/routes/flows/webhook.test.ts   # MỚI (copy, cặp cache-mem)
│       ├── common/config.ts, sequencer.ts      # SỬA: nodeUrl cache-mem, AFTER
├── tests/directus-app-e2e/src/flows.spec.ts    # MỚI (R13); routing.spec.ts SỬA
├── tests/benchmark/src/{flows,seed-flows}.ts   # MỚI; project.json SỬA
├── tools/port-manifest/009-T*.json             # MỚI
├── tools/ci-local.sh                           # SỬA: cache-mem trong blackbox
├── .github/workflows/{ci,parity-matrix,nightly,benchmark}.yml   # SỬA (contracts/parity.md §4)
├── specs/001-platform-foundation/spec.md       # SỬA: D-09.7
├── specs/003-auth-session/spec.md              # SỬA: D-26
├── specs/004-permissions/spec.md               # SỬA: D-29, D-31
└── specs/008-activity-revisions-versions/spec.md   # SỬA: D-33 lâu dài
```

**Structure Decision**:
- Theo cấu trúc 001 đến 008: file của `directus/api/src` vào cùng đường dẫn trong `apps/api/src` (`flows.ts` ở
  gốc `src`, `operations/<id>/index.ts` giữ cây con); service và controller có hậu tố `.service.ts`,
  `.controller.ts`.
- Blackbox 009 thêm vào cây `tests/parity/src/items/blackbox/` (cùng shim) như 005 đến 008.
- Test đối chiếu mới đặt trong `tests/parity/src/flows/` (tách khỏi `src/auth/flows.ts` của 003).

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/`) | Đích | Ghi chú |
|---------------------|------|---------|
| `api/src/flows.ts` (+ test) | `apps/api/src/flows.ts` | Đăng ký operation tĩnh, cảnh báo store, `unload` khi shutdown (Backoffice) |
| `api/src/services/flows.ts` | `apps/api/src/services/flows.service.ts` | Nguyên; test mới |
| `api/src/services/operations.ts` | `apps/api/src/services/operations.service.ts` | Nguyên; test mới |
| `api/src/controllers/{flows,operations}.ts` | `apps/api/src/controllers/*.controller.ts` | Nest; uuid kiểm trong handler; test mới |
| `api/src/operations/<id>/index.ts` (+ test) ×15 | `apps/api/src/operations/<id>/index.ts` | Nguyên, trừ `mail` (log thay gửi; test viết lại) |
| `api/src/operations/mail/rate-limiter.ts` (+ test) | `apps/api/src/operations/mail/rate-limiter.ts` | Nguyên |
| `api/src/utils/redact-object.ts` (+ test) | `apps/api/src/utils/redact-object.ts` | Nguyên |
| `api/src/utils/construct-flow-tree.ts` | `apps/api/src/utils/construct-flow-tree.ts` | Nguyên; test mới |
| `api/src/constants.ts` (`UUID_REGEX`) | `apps/api/src/constants.ts` | Thêm hằng |
| `packages/extensions/src/shared/utils/define-extension.ts` (`defineOperationApi`) | `apps/api/src/operations/define-operation-api.ts` | Một hàm |
| `packages/types/src/flows.ts`, `extensions/operations.ts` | `libs/types/src/{flows,operations}.ts` | Nguyên |
| `packages/utils/shared/{apply-options-data,sieve-functions,is-valid-json}.ts` (+ test) | `libs/utils/src/shared/` | Nguyên |
| `tests/blackbox/tests/db/routes/flows/webhook.test.ts` | `tests/parity/src/items/blackbox/tests/db/routes/flows/` | Copy; `spawn` → `nodeUrl('cache-mem', 1)` |

### Phần không port hoặc hoãn

| Phần | Lý do | Thay ở |
|------|-------|--------|
| `services/mail/*`, `utils/md.ts`, bước `MailService.send` của operation `mail` | Nguyên tắc X, XI; D-34 (lâu dài) | log cảnh báo |
| `extensions/manager.ts` (đăng ký operation, operation của extension) | Nguyên tắc XI | danh sách tĩnh `operations/index.ts` |
| `tests/blackbox/tests/common/flows/schedule-hook.{seed,test}.ts` | Ba process, đếm stdout; shim không spawn | `src/flows/schedule.test.ts` trên cặp `flows-schedule` |
| `ai/tools/{flows,operations}` | Nguyên tắc XI (AI/MCP) | — |
| GraphQL `flows`, `operations`, `flows_trigger` | D-09.9 | 011 |
| Trình chỉnh sửa flow của app mới | FE | 017 |

## Complexity Tracking

| Vi phạm | Vì sao cần | Phương án đơn giản hơn bị loại vì |
|---------|------------|-----------------------------------|
| IV: "Flow theo lịch PHẢI dùng lock trên Redis, mỗi lượt chỉ một instance chạy" chỉ đạt khi mọi instance của hai app đặt `SYNCHRONIZATION_STORE=redis` và cùng `SYNCHRONIZATION_NAMESPACE`; với mặc định `memory` mỗi instance (Directus hoặc app mới) chạy mỗi kỳ | Directus 11.17.4 chỉ có `SynchronizedClock` cho job theo lịch (không khóa riêng cho flow); app mới dùng đúng clock đó nên khi bật `redis` hai app chia kỳ (SC-004); app mới ghi cảnh báo khi store không phải `redis` (FR-011, Clarifications); vận hành bật `SYNCHRONIZATION_STORE=redis` trong `.env` dùng chung là đủ | (1) Khóa Redis riêng của app mới mỗi kỳ: chỉ app mới biết khóa, instance Directus vẫn chạy, không đạt "một instance"; (2) app mới bỏ chạy flow theo lịch khi store `memory`: khác Directus khi chỉ chạy app mới (flow không bao giờ chạy); (3) app mới tự dùng Redis cho clock khi store `memory`: đổi nghĩa biến (VIII) và vẫn không đồng bộ với Directus |

Ghi nhận cần duyệt (không phải vi phạm): `name` của lỗi do `createError` tạo trở lại `DirectusError` (001 đã đổi thành
`BackofficeError`). Lý do: `name` là field enumerable, lọt vào `$all` trả cho client, `directus_revisions.data` của log
chạy (DB dùng chung, Logs sidebar của app Directus hiển thị) và `$last` đưa vào `condition`, `exec`; Nguyên tắc II, III,
IX ("giữ nguyên khi ảnh hưởng tương thích"). Phương án bị loại: đổi tên chỉ khi serialize trong `flows.ts` (ba đường
`res.json`, `redactObject`, `sieveFunctions`, script vẫn thấy tên khác); ghi khác biệt D-35 (dữ liệu DB khác Directus vi
phạm II).

Ngoại lệ đã duyệt của 001 đến 008 vẫn áp dụng: benchmark hằng tuần thay vì chặn CI (003); store `memory` với cảnh báo
một instance (001); clock `SYNCHRONIZATION_STORE=memory` của job dọn TUS (007, idempotent; không áp cho flow, xem dòng
IV ở trên). Gỡ D-09.7, D-26, D-29, thu hẹp D-31, D-33 lâu dài, D-34, R-22, R-23, R-24, vi phạm IV và ghi nhận `name`
cần tech lead duyệt trước khi đóng feature (Nguyên tắc X).

Rủi ro đã biết, theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| isolated-vm không build trên runner CI (alpine trong Docker, ubuntu ở job `quality`) hoặc build lâu | `quality`, `docker` đỏ | Task đầu tiên: thêm gói, `pnpm install`, chạy `exec/index.test.ts`, build image, `node -e "require('isolated-vm')"`; đo thời gian; nếu > 3 phút, cache `node_modules/.pnpm` theo lockfile |
| Kết quả `applyOptionsData` khác do micromustache `explicit` hoặc JSON mode | SC-003 đỏ ở nhiều operation | Port test gốc 12 ca trước khi port operation; `operations.test.ts` so `steps[].options` |
| Lỗi serialize khác (`name`, `extensions`, thứ tự khóa) trong `$all` và revision | SC-002, SC-003 đỏ | R7 làm sớm; ca `throw-error`, `item-read 403`, `condition` trong `operations.test.ts`, `logs.test.ts` so JSON |
| `FlowManager.load` trong test khởi động app (`createApp()` với DB mock) | Unit test đỏ | Mock `./flows.js` ở `app.test.ts` và mọi controller test gọi `createApp()` (như `./schedules/*.js`) |
| Flow theo lịch của cặp `flows-schedule` bị cặp chính nạp (nếu cặp chính nạp lại trong cửa sổ test) → chạy thêm trong namespace chính, `getSchema` mỗi 2 s (R-19) | Suite khác đỏ ngẫu nhiên | Chỉ `schedule.test.ts` bật cặp; `afterAll` xóa flow qua API cặp chính (cặp chính nạp lại và bỏ flow); chạy `sequential` cuối suite |
| Action flow chạy nền: hiệu ứng tới sau response | Ca so sánh đọc sớm | `event.test.ts` poll ≤ 5 s tới khi dòng activity `run` xuất hiện ở app vừa gọi |
| Response cache dùng chung Redis của cặp chính làm `GET /flows/trigger` ở app B trả kết quả cache của app A | `reload.test.ts` sai | Bộ đối chiếu gửi `Cache-Control: no-store` (005); blackbox `webhook.test.ts` trên cặp `cache-mem` (memory, không chia sẻ) |
| `PATCH /flows/:pk` lồng `operations` của `flow.vue` đi qua `PayloadService` o2m với `resolve`/`reject` unique | Lỗi unique khác thứ tự giữa hai app | `crud.test.ts` ca `saveChanges` đúng chuỗi của app (`PATCH /operations` mảng gỡ liên kết trước) |
| Guard `accepted-differences` đỏ khi xóa D-09.7, D-26, D-29 trước khi spec `Done`; cột "Gỡ khi" của D-34 phải là `—` | CI đỏ | Xóa entry trong commit đóng feature (tiền lệ 007, 008); spec 009 đã ghi `—` |
| Express 5 và route `trigger/:pk` cho `pk` không uuid hoặc uuid viết hoa | `404` khác body; uuid hoa `404` thay vì `403` | Kiểm `UUID_REGEX` với cờ `i` trong handler; supertest và `webhook.test.ts` so body với Directus |
| Thêm `flows` vào proxy trước khi có controller: app Directus gọi `GET /flows` trong `Promise.all` lúc hydrate (`app/src/hydrate.ts:75`), `404` làm app qua proxy hỏng | `e2e-directus-app` đỏ giữa các phase | Thêm route vào proxy cùng task đăng ký controller (T022 `flows`, T039 `operations`) |
