---

description: "Danh sách task cho feature 009: Flows và tự động hóa (/flows, /operations, /flows/trigger/:id)"
---

# Tasks: Flows và tự động hóa (`/flows`, `/operations`, `/flows/trigger/:id`)

**Input**: Tài liệu thiết kế trong `/specs/009-flows-automation/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R15), `data-model.md`, `contracts/`
(`flows-api.md`, `operations.md`, `parity.md`), `quickstart.md`, `checklists/flows.md` (50 mục, 7 đã giải vào spec
ngày 2026-10-13).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test. Test gốc của Directus đi kèm file port thì port theo, chạy đỏ trước rồi port code
  (research R15). `exec/index.test.ts` chạy với isolated-vm thật, không mock.
- Mọi endpoint thêm có test đối chiếu chạy với cả Directus 11.17.4 thật lẫn app mới, so status, body, header và dòng
  `directus_activity` (`run`), `directus_revisions`, collection đích, `directus_notifications` qua `flowEffects`
  (research R10); bộ blackbox port chạy hai lượt theo app (R11).
- Điểm spec ghi "đo" (R-22, R-23, serialize lỗi R7, micromustache R6, bus trả message về người gửi R2) đo trên
  Directus thật trong task test tương ứng; lệch thì dừng, ghi bằng chứng vào "Ghi chú khi làm" và hỏi tech lead.

**Organization**: Task nhóm theo user story của spec. Phase 1 và 2 là nền chung: thư viện, type, util, biến env, môi
trường đối chiếu, service, `FlowManager` và năm operation "lõi" (`transform`, `log`, `throw-error`, `condition`,
`sleep`) để mọi story có flow chạy được. Thứ tự story: US1 (webhook, manual) → US2 (lịch) → US3 (event) → US4 (10
operation còn lại) → US5 (CRUD, nạp lại) → US6 (log chạy) → US7 (blackbox, E2E, CI) → Polish (benchmark, manifest,
sổ khác biệt, đóng feature). SPECKIT-GUIDE §6 cho phép tách 009 thành "trigger và engine" (Phase 1–5) và "operation"
(Phase 6) khi implement.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task. Phase 1, 2 và Polish không có nhãn này.
- File port từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn nguồn>`. Mỗi task port ghi các cặp
  `{ "source", "dest" }` (source tính từ `directus/`) vào `tools/port-manifest/009-T###.json`, theo đúng ID task.
  Chạy `node tools/check-port-headers.mjs` sau khi ghi. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Port nguyên vẹn: giữ tên biến, thứ tự câu lệnh, message của Directus. Chỗ khác nguồn ghi `// Backoffice: <lý do>`
  (danh sách cho phép ở plan, Constitution Check I). Giới hạn tạm ghi `// ponytail: <giới hạn>, <khi nào nâng>`.
- Ánh xạ import khi port: `@directus/utils` → `@backoffice/utils`; `@directus/errors` → `@backoffice/errors`
  (`isDirectusError` → `isBackofficeError`); `@directus/validation` → `@backoffice/validation`; `@directus/types` →
  `@backoffice/types`; `@directus/env` → `@backoffice/env`; `@directus/extensions` `defineOperationApi` →
  `../define-operation-api.js`; `./utils/get-schema.js` → `./schema/get-database-schema.js`; `./logger/index.js`,
  `./database/index.js`, `./bus/index.js`, `./emitter.js`, `./services/index.js`, `./utils/get-service.js`,
  `./permissions/lib/*.js`, `./request/index.js`, `./rate-limiter.js` đã có cùng tên.
- **Không sửa service của feature trước** ngoài: thêm factory vào `providers.ts`, rút `COLLECTIONS_WITHOUT_SERVICE_YET`
  và thêm `case` trong `utils/get-service.ts`, thêm mẫu vào `middleware/router-options.ts`, thêm `UUID_REGEX` vào
  `constants.ts`, thêm `getFlowManager().initialize()` và `unload` vào `app.ts`, đổi `name` trong
  `libs/errors/src/create-error.ts` và `is-backoffice-error.ts` (R7).
- **Luôn tái tạo hành vi Directus**, kể cả hành vi không an toàn (R-22, R-23, R-24). Phát hiện hành vi không an toàn mới
  thì thêm dòng R-xx vào spec kèm bằng chứng (ca test, request, kết quả đo trên Directus thật, ngày đo) và một ca thể
  hiện; không tự lệch.
- Không gửi email: operation `mail` qua rate limiter rồi ghi log cảnh báo (D-34, contracts/operations.md).
- Không đọc `useEnv()` ở cấp module trừ chỗ Directus làm thế (`operations/mail/rate-limiter.ts` tạo limiter lúc
  import; `FlowManager` đọc `FLOWS_ENV_ALLOW_LIST` trong constructor; giữ nguyên).
- Tên biến, comment, commit viết tiếng Anh. Tài liệu viết tiếng Việt.
- Test viết trước và phải fail trước khi làm phần tương ứng.
- Quy trình merge thẳng `main`: mỗi nhóm task commit và push xong thì CI phải xanh; `pnpm run ci:local` khi Actions bị
  chặn. Nhánh `009-flows-automation` giữ ngang `main` (fast-forward).

## Quy ước đường dẫn

- API: `apps/api/src/**`. Libs: `libs/types/src/**`, `libs/utils/src/shared/**`, `libs/errors/src/**`.
- Test đối chiếu: `tests/parity/src/**` (mới: `tests/parity/src/flows/**`; blackbox port thêm vào
  `tests/parity/src/items/blackbox/**`). Danh sách khác biệt: `tests/parity/accepted-differences.ts`. Profile, env:
  `tests/parity/docker-compose.yml`, `tests/parity/env/**`.
- E2E app Directus: `tests/directus-app-e2e/**`. Reverse proxy: `tests/parity/proxy/**`.
- Benchmark: `tests/benchmark/**`. Công cụ: `tools/**`. CI: `.github/workflows/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/packages/*`, `directus/tests/blackbox/**`,
  `directus/app/src/**`.

## Tóm tắt

- Tổng số task: **53**
- Số task đánh dấu [P]: **37**
- Một lượt implement, checkpoint sau mỗi phase.
- MVP gợi ý: **Phase 1 đến 4** (US1, US2): webhook và flow thủ công cho cùng kết quả ở hai app, flow theo lịch chạy
  một lần mỗi kỳ. Feature chưa đóng được khi chưa xong US3 đến US7 và Polish.

---

## Phase 1: Setup (thư viện, type, util, biến env, tên lỗi, proxy, profile)

**Purpose**: Ba gói mới build được, type và util dùng chung có mặt, `name` lỗi về `DirectusError`, 6 biến sang nhóm
A, proxy và hai profile sẵn sàng (research R1, R6, R7, R9, R11, R12, R14; contracts/parity.md §1).

- [X] T001 Thư viện: `pnpm-workspace.yaml` catalog thêm `isolated-vm: 5.0.3`, `micromustache: 8.0.3`,
  `p-queue: 8.1.0` (bản của `directus/pnpm-workspace.yaml`) và `isolated-vm` vào `onlyBuiltDependencies`;
  `apps/api/package.json` thêm ba gói `catalog:`; `libs/utils/package.json` thêm `micromustache`; `pnpm install`;
  `node -e "require('isolated-vm')"` trong `apps/api`; `docker build -f apps/api/Dockerfile .` rồi
  `docker run --rm <image> node -e "require('isolated-vm')"`; ghi thời gian `pnpm install` và build image vào "Ghi
  chú khi làm" (plan rủi ro 1); `pnpm audit --prod --audit-level=high` không advisory mới (FR-051, research R1).
- [X] T002 [P] `libs/types/src/`: port `flows.ts` (`Flow`, `FlowRaw`, `Operation`, `OperationRaw`, `TriggerType`) từ
  `directus/packages/types/src/flows.ts` và `operations.ts` (`OperationHandler`, `OperationContext`,
  `OperationApiConfig`) từ `directus/packages/types/src/extensions/operations.ts` (bỏ phần app/extension không dùng,
  ghi `// Backoffice:`); export trong `libs/types/src/index.ts`; `libs/types/src/index.test.ts` thêm khẳng định
  export. Ghi manifest `tools/port-manifest/009-T002.json`.
- [X] T003 [P] `libs/utils/src/shared/`: port `apply-options-data.ts` (+ test gốc 12 ca), `sieve-functions.ts`
  (+ 8), `is-valid-json.ts` (+ 2) từ `directus/packages/utils/shared/`; export trong `libs/utils/src/shared/index.ts`;
  test gốc chạy đỏ trước (thiếu file) rồi xanh; `pnpm nx run @backoffice/utils:build` (apps/api đọc `dist`). Ghi
  manifest (research R6).
- [X] T004 [P] `libs/errors/src/create-error.ts`: `name = 'DirectusError'`; `is-backoffice-error.ts` so
  `'DirectusError'`; sửa `create-error.test.ts`, `errors/messages.test.ts`, `apps/api/src/errors/error-handler.test.ts`;
  thêm ca `JSON.stringify(new InternalServerError())` → `{"name":"DirectusError","code":"INTERNAL_SERVER_ERROR",
  "status":500}` và với `extensions`; `// Backoffice: R7 of feature 009`; `pnpm nx run @backoffice/errors:build`
  (research R7, spec "Cần xác nhận").
- [X] T005 [P] `apps/api/src/config/supported-variables.ts` khối "Feature 009": `FLOWS_ENV_ALLOW_LIST`,
  `FLOWS_RUN_SCRIPT_MAX_MEMORY`, `FLOWS_RUN_SCRIPT_TIMEOUT`, `RATE_LIMITER_EMAIL_FLOWS_.+`;
  `specs/001-platform-foundation/contracts/config.md` dòng A thêm, dòng C bớt (ghi `RATE_LIMITER_EMAIL_(?!FLOWS_)`);
  `supported-variables.test.ts` sửa bộ lọc dòng 31, thêm ca `['FLOWS_ENV_ALLOW_LIST', true]`,
  `['RATE_LIMITER_EMAIL_FLOWS_POINTS', true]`, `['RATE_LIMITER_EMAIL_ENABLED', false]`;
  `warn-unsupported-variables.test.ts` thêm ca `FLOWS_RUN_SCRIPT_TIMEOUT` không bị báo (FR-050, research R9).
- [X] T006 [P] `tests/parity/src/server/errors.test.ts` bỏ `/flows` khỏi ca `404` D-09.* (ca dùng `/settings`,
  `/graphql` còn lại). KHÔNG thêm `flows`, `operations` vào proxy ở Phase 1: app Directus gọi `GET /flows` trong
  `Promise.all` lúc hydrate (`directus/app/src/hydrate.ts:75`), `404` trước khi có controller làm hỏng app qua proxy
  và đỏ `e2e-directus-app`; việc này nằm ở T022 (`flows`) và T039 (`operations`) (contracts/parity.md §1).
- [X] T007 [P] Profile: `tests/parity/env/profile-flows-schedule.env` theo contracts/parity.md §1 (chú thích: thủ công,
  chạy flow mỗi 2 s, namespace riêng); `tests/parity/docker-compose.yml` thêm `directus-flows-schedule`,
  `backoffice-api-flows-schedule` (mẫu `retention`, cổng 10355/10356, `environment: FLOWS_SCHEDULE_HOOK_NAME=directus`
  / `backoffice`); `tests/parity/src/config.ts` `profilePorts['flows-schedule']`, `manualProfiles` thêm;
  `tests/parity/src/docker.ts` danh sách `--profile`; `tests/parity/scripts/env.mjs` `ALL_PROFILES`;
  `tests/parity/src/vendors.test.ts` xanh (cổng, env file, platform, uploads, không có trong `--profiles` CI);
  thêm `cache-mem` vào `--profiles` của job `parity-blackbox` trong `.github/workflows/ci.yml`, `parity-matrix.yml`
  (`blackbox-full`), `nightly.yml` và `tools/ci-local.sh` (research R11, R12).
- [X] T008 [P] `apps/api/src/constants.ts` thêm `UUID_REGEX` từ `directus/api/src/constants.ts:64` (+ ca test);
  `apps/api/src/middleware/router-options.ts` khối Feature 009: `/flows`, `/flows/:pk`, `/flows/trigger/:pk`
  (`GET, POST`), `/operations`, `/operations/:pk`; `router-options.test.ts` thêm ca (FR-001, contracts/flows-api.md §9).

**Checkpoint**: `pnpm nx run-many -t test lint typecheck` xanh (libs utils, errors, types; api với test cũ);
`env-up --profiles=app` lên, proxy vẫn đưa `/flows`, `/operations` tới Directus; `profileUp('flows-schedule')` lên
được rồi `profileStop`.

---

## Phase 2: Foundational (util, service, `FlowManager`, năm operation lõi, helper đối chiếu)

**Purpose**: Toàn bộ bộ máy flow có trước controller: `redactObject`, `constructFlowTree`, `defineOperationApi`,
`FlowsService`, `OperationsService`, `getService`, `FlowManager` với trigger đủ năm loại, năm operation lõi, khởi tạo
trong `createApp`, helper `tests/parity/src/flows/helpers.ts` (research R2, R4 đến R6, R10, R15).

- [X] T009 [P] Port `utils/redact-object.ts` + `redact-object.test.ts` (14 ca) từ `directus/api/src/utils/` vào
  `apps/api/src/utils/`; test đỏ trước. Ghi manifest.
- [X] T010 [P] Port `utils/construct-flow-tree.ts` vào `apps/api/src/utils/construct-flow-tree.ts`;
  `construct-flow-tree.test.ts` mới: cây resolve/reject lồng, `operation` gốc null, `options` null → `{}`, tham chiếu
  thiếu ném `Undefined reference in operations`. Ghi manifest.
- [X] T011 [P] `apps/api/src/operations/define-operation-api.ts` port hàm `defineOperationApi` từ
  `directus/packages/extensions/src/shared/utils/define-extension.ts` (+ test 1 ca trả nguyên config);
  `apps/api/src/operations/index.ts` export mảng `operations` (ban đầu rỗng, T017 và US4 thêm) và test "mỗi phần tử có
  `id`, `handler`, không trùng id". Ghi manifest.
- [X] T012 [P] Port `services/flows.ts` → `apps/api/src/services/flows.service.ts`, `services/operations.ts` →
  `operations.service.ts` (gọi `getFlowManager().reload()` sau `createOne`, `updateMany`, `deleteMany`;
  `FlowsService.deleteMany` `update({resolve: null, reject: null}).whereIn('flow', keys)` trước `super.deleteMany`);
  `flows.service.test.ts`, `operations.service.test.ts` mới (mock knex và `./flows.js`): mỗi hàm gọi `reload` đúng
  một lần sau ghi, `deleteMany` chạy update trước khi xóa và vẫn chạy khi `super.deleteMany` ném (R-22). Ghi manifest
  (FR-002).
- [X] T013 `apps/api/src/utils/get-service.ts`: `case 'directus_flows'` → `FlowsService`, `'directus_operations'` →
  `OperationsService`; rút hai tên khỏi `COLLECTIONS_WITHOUT_SERVICE_YET`, sửa comment ponytail; `get-service.test.ts`
  sửa; `apps/api/src/providers.ts` thêm factory hai service; `apps/api/src/services/index.ts` export. Sau T012
  (FR-003, contracts/flows-api.md §8).
- [X] T014 Port `flows.ts` + `flows.test.ts` (2 ca gốc, mock theo ánh xạ import) từ `directus/api/src/` vào
  `apps/api/src/flows.ts`, `flows.test.ts`; khác nguồn (`// Backoffice:`): `initialize()` gọi `addOperation` cho từng
  phần tử của `./operations/index.js` trước `load()`; cuối `load()` nếu có trigger `schedule` đã đăng ký và
  `env.SYNCHRONIZATION_STORE !== 'redis'` thì `logger.warn('Backoffice: SYNCHRONIZATION_STORE is not redis; scheduled
  flows run on every instance')`; `getSchema` từ `./schema/get-database-schema.js`; `import * as services from
  './services/index.js'`. Sau T009 đến T013. Ghi manifest (FR-010 đến FR-015, FR-020 đến FR-024,
  contracts/flows-api.md §3–§7).
- [X] T015 `apps/api/src/flows.test.ts` phần Backoffice (mock như gốc + `./operations/index.js`): `load` đăng ký
  event theo scope × collections (`articles.items.create`, `users.create`, `auth.login`, không `collections` → không
  event), filter handler truyền `database` của context và ném `$last` khi reject, action handler dùng `getDatabase()`;
  `schedule` cron sai → warn đúng câu, không job; cảnh báo store memory có/không; `runWebhookFlow` không handler →
  `ForbiddenError` + warn; manual: 6 lỗi theo thứ tự contracts/flows-api.md §3, non-admin có/không quyền (mock
  `fetchPolicies`, `fetchPermissions`, `getService.readMany`), `keys` so chuỗi, `async`; `executeFlow`: `return`
  `$all`/đường dẫn/rỗng, `error_on_reject` chỉ webhook/manual đồng bộ, activity/revision theo `accountability` (gọi
  `ActivityService.createOne` với `ip`, `user_agent`, `origin`; `RevisionsService.createOne` với `data.steps`,
  `data.data` đã che `headers.authorization`, `payload.password`, giá trị `$env`); `executeOperation`: type lạ →
  `unknown` + warn, `log` nhận dữ liệu che, `undefined` lồng → null, kết quả không serialize (BigInt) → reject, lỗi
  `Error` bỏ `stack`, chuỗi JSON → object, chuỗi thường, mảng; `reload` publish `{type:'reload'}`, subscriber khi chưa
  nạp → warn, hàng đợi một luồng và `runWebhookFlow` đợi `onIdle`; `unload` gọi `offFilter`, `offAction`,
  `job.stop()`. Sau T014 (FR-010 đến FR-024).
- [X] T016 `apps/api/src/app.ts`: `await getFlowManager().initialize()` sau `subscribeSchemaChanged()` và trước
  `createExpressApp()`; `onServerShutdown(() => getFlowManager().unload())` (`// Backoffice:`); `app.test.ts` thêm ca
  thứ tự (flows trước Express, schedules sau Nest) và `unload` khi shutdown; mọi test gọi `createApp()`
  (`app.test.ts`, `app-pipeline.test.ts`, `controllers/*.controller.test.ts`, `auth.test.ts`...) mock `./flows.js`
  (`getFlowManager: () => ({initialize, unload, runWebhookFlow, reload})`) như `./schedules/*.js`. Sau T014 (research
  R2, plan rủi ro 4).
- [X] T017 [P] Năm operation lõi: port `operations/{transform,log,throw-error,condition,sleep}/index.ts` + test gốc
  (2, 2, 6, 4, 2 ca) từ `directus/api/src/operations/` vào `apps/api/src/operations/<id>/`; `condition` dùng
  `parseFilter`, `validatePayload` của `@backoffice/utils`, `FailedValidationError`,
  `joiValidationErrorItemToErrorExtensions` của `@backoffice/validation`; `throw-error` dùng `createError`,
  `InternalServerError` của `@backoffice/errors`; thêm năm config vào `operations/index.ts`. Sau T011. Ghi manifest
  (FR-031, FR-035, FR-039).
- [X] T018 [P] `tests/parity/src/flows/helpers.ts`: `withoutD097`, `same()`, `seedFlow(app, {flow, operations})`
  (tạo qua `POST /flows` + `PATCH /flows/:id` lồng như `flow.vue`, đợi app kia nạp lại bằng poll `GET /flows/:id`
  ≤ 5 s), `runWebhook`, `flowEffects(fn)` (gọi `historyEffects` của 008 + dòng mới của collection đích và
  `directus_notifications`), `comparable()` (bỏ `data.data.$env`, `steps[].operation` → `<op:i>`, `headers` của
  `request` chỉ `content-type`, thời điểm → `<time>`), `cleanupFlows(ids)`; `tests/parity/src/flows/helpers.test.ts`
  (không Docker) cho `comparable`, thêm vào `include` của `tests/parity/vitest.config.ts`; `tests/parity/src/suite.ts`
  `REDUCED_FILES` thêm `src/flows/{crud,webhook,manual,event,operations,logs,reload}.test.ts`, `FULL_FILES` thêm
  `src/flows/**/*.test.ts` (research R10, contracts/parity.md §2).

**Checkpoint**: `pnpm nx run api:test` xanh (test gốc port: flows 2, redact-object 14, năm operation 16; test mới T010
đến T016); coverage `apps/api` không giảm dưới 80%; app khởi động với DB thật nạp flow (log không lỗi), `env-up` cặp
chính lên với image mới.

---

## Phase 3: User Story 1 - Webhook và flow thủ công cho cùng kết quả ở hai app (Priority: P1) 🎯 MVP

**Goal**: `GET|POST /flows/trigger/:id` cho webhook (đồng bộ, bất đồng bộ, `error_on_reject`, `return`,
`cacheEnabled`) và manual (6 kiểm tra, quyền non-admin) trả cùng status, body, header và log chạy như Directus.

**Independent Test**: `tests/parity/src/flows/webhook.test.ts`, `manual.test.ts` xanh trên Postgres (`full`), MySQL,
SQLite (`reduced`); kiểm tay quickstart §2.

### Tests for User Story 1

- [X] T019 [P] [US1] `tests/parity/src/flows/webhook.test.ts` (`reduced`, `full`): body là kết quả thô (không bọc
  `{data}`); flow `GET` mặc định (`$last` của `transform`), `$all` (so sau `comparable`), `return` đường dẫn
  (`$trigger.query.x`), `return` không có và kết quả falsy (`null`, `0`, `''`) → `204`; `POST` tới flow `GET` và `GET`
  tới flow `POST` → `403`; `async` → `204` rồi poll activity `run` ≤ 5 s; `error_on_reject` với `throw-error` (`422`,
  code, message), với `condition` không khớp (`400`, một phần tử `errors[]` mỗi lỗi) và với `$last` chuỗi/object
  thường (`500`); không `error_on_reject` → `200` với `$last` là lỗi serialize (`name`, `code`, `status`,
  `extensions`; R7 đo tại đây); `cacheEnabled=false` và mặc định: so header `Cache-Control`; flow `inactive`, flow
  `operation`, uuid sai (`404 ROUTE_NOT_FOUND`), uuid không có (`403`), uuid viết hoa của flow có thật (`403`, đo
  Express 4 không phân biệt hoa thường); public không token chạy được; R-24: flow `$all` gọi không token trả `$env`
  (ghi bằng chứng); `OPTIONS`, `HEAD` (US1 ca 1–4, 7; FR-001, FR-012, FR-013, FR-020, FR-024).
- [X] T020 [P] [US1] `tests/parity/src/flows/manual.test.ts` (`reduced`, `full`): body `{collection, keys, ...fields}`
  và `{collection}` với `requireSelection=false`; 6 lỗi `403` theo thứ tự contracts/flows-api.md §3 (kiểm log warn
  của hai app qua `logs()`); non-admin có quyền đọc collection và keys → chạy; không quyền đọc → `403`; một key không
  đọc được → `403`; `keys` số và chuỗi; `async` → `204`; `$trigger.body` giữ `fields` (US1 ca 5, 6).
- [X] T021 [P] [US1] `apps/api/src/controllers/flows.controller.test.ts` (supertest qua app Nest, mock
  `./flows.js` và service): `GET|POST /flows/trigger/:pk` gọi `runWebhookFlow('<METHOD>-<pk>', {path, query, body,
  method, headers}, {accountability, schema})`, `res.locals.payload = result` (không bọc `data`), `res.locals.cache =
  false` khi `cacheEnabled: false`, `204` khi `result` falsy, `404 ROUTE_NOT_FOUND` khi `pk` không uuid, uuid viết hoa
  qua kiểm và gọi `runWebhookFlow` với `pk` nguyên, `403` lan từ `ForbiddenError`; `POST /`, `GET /`,
  `SEARCH /`, `GET /:pk`, `PATCH /`, `PATCH /:pk`, `DELETE /`, `DELETE /:pk` theo `comments.controller.test.ts`;
  `OPTIONS /flows/trigger/<uuid>` → `Allow: GET, POST`.

### Implementation for User Story 1

- [X] T022 [US1] `apps/api/src/controllers/flows.controller.ts` port từ `directus/api/src/controllers/flows.ts` theo
  mẫu `comments.controller.ts` (research R3; contracts/flows-api.md §1): handler `trigger/:pk` khai báo trước `:pk`,
  kiểm `new RegExp(`^${UUID_REGEX}$`, 'i')` → `RouteNotFoundError({path: req.path})`; `apps/api/src/app.module.ts`
  đăng ký controller và `useCollection('directus_flows')`; `app.test.ts`, `app-pipeline.test.ts` thêm ca. Cùng task:
  `tests/parity/proxy/backoffice-routes.txt` thêm `flows`; `tests/parity/src/proxy-conf.test.ts` ca
  `/flows/trigger/<uuid>` tới app mới, `/settings` vẫn tới Directus; `tests/directus-app-e2e/src/routing.spec.ts` thêm
  `flows`; `tests/parity/src/request-set.ts` thêm `GET /flows` (admin), `POST /flows` public bị từ chối. Ghi manifest.
  Chạy T019, T020 trên Postgres, MySQL, SQLite; ghi số ca vào "Ghi chú khi làm".

**Checkpoint**: US1 xanh; app Directus qua proxy (`env-up --profiles=app`): nút chạy flow thủ công trên item gọi
`/flows/trigger` tới app mới và báo thành công (quickstart §2).

---

## Phase 4: User Story 2 - Flow theo lịch chạy đúng một lần mỗi kỳ khi hai app cùng chạy (Priority: P1)

**Goal**: Trigger `schedule` đăng ký qua `scheduleSynchronizedJob`; với `SYNCHRONIZATION_STORE=redis` hai app chia kỳ,
tổng số lần chạy đúng bằng số kỳ; cảnh báo khi store `memory`.

**Independent Test**: `tests/parity/src/flows/schedule.test.ts` xanh trên cặp `flows-schedule`; quickstart §4.

- [X] T023 [US2] `tests/parity/src/flows/schedule.test.ts` (`full`, `sequential`, cuối suite `flows`):
  `profileUp('flows-schedule')` ở `beforeAll`, `profileStop` ở `afterAll` (kể cả khi `beforeAll` lỗi); seed flow
  `*/2 * * * * *` + `log` `flow-executed-on-{{ $env.FLOWS_SCHEDULE_HOOK_NAME }}` (port nội dung
  `directus/tests/blackbox/tests/common/flows/schedule-hook.seed.ts`, `accountability` mặc định) qua API của cặp; đợi
  20 s (10 kỳ): tổng dòng `flow-executed-on-` trong `logs()` của hai container = 10, số dòng activity `run` mới = 10,
  lặp 3 lượt (SC-004); `redis-cli monitor` namespace `parity-flows-schedule:sync` ghi 10 `setGreaterThan` thành công;
  dừng `directus-flows-schedule` → app mới chạy đủ 10; cron sai (`PATCH` `options.cron`) → warn `Couldn't register
  cron trigger` ở cả hai app, không dòng mới; R-23: `PATCH /flows/:id` (đổi `name`) ngay trước một kỳ, MONITOR thấy
  `DEL` rồi `SET` của cả hai instance, ghi bằng chứng vào spec R-23 (chấp nhận 10 hoặc 11 lần trong 10 kỳ);
  `afterAll` xóa flow qua API cặp chính (US2 ca 1–3, 5; FR-011, FR-062).
- [X] T024 [P] [US2] `apps/api/src/flows.test.ts` thêm ca lịch: `scheduleSynchronizedJob(flow.id, cron, cb)` với cron 6
  trường, `cb` gọi `executeFlow(flow)` không dữ liệu và `logger.error` khi ném (job vẫn còn), `unload` gọi
  `job.stop()`; `apps/api/src/startup/*.test.ts` hoặc `app.test.ts`: dòng warn store memory xuất hiện đúng một lần
  khi có flow lịch, không khi không có (US2 ca 1, 3, 4; FR-011).

**Checkpoint**: US2 xanh; log cặp `flows-schedule` cho thấy mỗi kỳ một bên chạy; cặp chính (store `memory`) ghi dòng
cảnh báo khi có flow theo lịch.

---

## Phase 5: User Story 3 - Flow theo sự kiện chạy ở app nhận request (Priority: P1)

**Goal**: Flow `event` filter/action kích hoạt từ request ghi item và collection hệ thống của app mới với cùng tên
event, payload, meta; filter chặn hoặc đổi payload; action chạy nền.

**Independent Test**: `tests/parity/src/flows/event.test.ts` xanh; US3 ca 1–5.

- [X] T025 [US3] `tests/parity/src/flows/event.test.ts` (`reduced`, `full`): seed flow filter/action cho
  `items.create|update|delete` trên `articles` (collection test của 005) và `directus_users`, `directus_files`,
  `directus_comments` (`users.create`, `files.update`, `comments.create`...); filter reject (`throw-error`) → request
  lỗi với status/code của nó ở cả hai app và không ghi item; filter `return` (`transform` đổi `payload.title`) → item
  ghi với giá trị mới; filter có `item-create` vào `articles_log` rồi request lỗi → dòng log bị rollback (transaction);
  action flow kết thúc bằng nhánh reject → request vẫn `2xx`, log chạy có bước `reject` (lỗi chỉ ở log, không lan
  lên response); action: response không đợi, poll ≤ 5 s activity `run` và `articles_log` (`$trigger.event`, `keys`, `collection`,
  `$accountability.user`); `auth.login` action (đăng nhập qua `/auth/login` của app mới); chỉ app nhận request chạy
  (đếm `run` theo app); `authenticate` filter không chặn (log). Dọn flow và `articles_log` ở `afterAll` (FR-010,
  FR-022, FR-023; US3 ca 1–5). Cần `item-create` của T029: ca dùng `item-create` chạy sau T029 (viết test trước, đỏ
  tới khi T029 xong); phần còn lại chỉ dùng operation lõi của T017.
- [X] T026 [P] [US3] `apps/api/src/flows.test.ts` thêm ca event: tên event cho scope mảng × collections hỗn hợp (user và
  hệ thống), scope `items.create` không `collections` → không `onFilter`; filter handler nhận `(payload, meta,
  context)` và trả giá trị của `return`; action handler nhận `(meta, context)` và lỗi không ném ra ngoài `emitAction`
  (dùng `mockEmitter`); `offFilter`/`offAction` đúng handler khi `unload` (US3 ca 1–3).

**Checkpoint**: US3 xanh; D-26, D-29 không còn đúng (ghi nhận để xóa ở T053).

---

## Phase 6: User Story 4 - Mọi operation có sẵn cho cùng kết quả (Priority: P1)

**Goal**: 10 operation còn lại port nguyên (`exec`, `item-create|read|update|delete`, `json-web-token`, `mail`,
`notification`, `request`, `trigger`); 15 operation cho cùng `$all`, hiệu ứng phụ và nhánh reject ở hai app.

**Independent Test**: `tests/parity/src/flows/operations.test.ts` xanh; 10 bộ unit test gốc xanh (exec với isolated-vm
thật); quickstart §5.

### Tests for User Story 4

- [X] T027 [US4] `tests/parity/src/flows/operations.test.ts` (`reduced` ca resolve, `full`): mỗi operation một flow
  webhook `POST`, `return = $all`, ca resolve và reject theo contracts/operations.md: `condition` (khớp, không khớp:
  mảng lỗi; filter `$CURRENT_USER`), `exec` (sync, async, `console.log`, `process.env` từ `$env`, lỗi cú pháp,
  `module.exports` không phải hàm, `while(true){}` → `Script execution timed out.` sau 10 s, bộ nhớ: `new
  Array(1e8).fill(1)` → `Array buffer allocation failed`), `item-*` với `permissions` `$trigger` (public → `403`),
  `$full`, `$public`, role test của 004, uuid role không tồn tại (reject `Configured role "<role>" isn't a valid
  role ID or doesn't exist.`), `key` một/nhiều/không, `payload` chuỗi JSON và object, `emitEvents` (flow
  action thứ hai không chạy khi `false`), `json-web-token` sign/verify/decode + 4 lỗi, `log`, `mail` (kết quả `null`,
  D-34 qua `logs()`; rate limiter chỉ unit test), `notification` (dòng `directus_notifications`, `$full` sender null,
  D-33), `request` tới `http://directus:8055/server/ping`, `/server/info` (so `data`, `status`, `headers`
  `content-type`), `/server/nope` (reject object `status: 404`), `http://nope.invalid` (reject `Error`), IP bị chặn
  (`http://169.254.169.254`), `Content-Type` tự thêm; `sleep` 100 ms; `transform`; `throw-error` 4 dạng; `trigger`
  tới flow `operation` với `serial`, `batch` (`batchSize: 2`), `parallel`, payload đơn, flow đích không có → `null` +
  warn; type lạ → `unknown` (so `$all` không có khóa, log warn); `undefined` lồng → null (US4 ca 1–12; FR-030 đến
  FR-041, FR-045).

### Implementation for User Story 4

- [X] T028 [P] [US4] Port `operations/exec/index.ts` + test gốc (12 ca, isolated-vm thật, `createRequire`) vào
  `apps/api/src/operations/exec/`; `sieveFunctions` của `@backoffice/utils`; thêm config vào `operations/index.ts`.
  Ghi manifest (FR-032).
- [X] T029 [P] [US4] Port `operations/{item-create,item-read,item-update,item-delete}/index.ts` + test gốc (4, 11,
  11, 11 ca; mock `../../services/items.js`, `../../utils/get-accountability-for-role.js`,
  `../../utils/sanitize-query.js`) vào `apps/api/src/operations/`; thêm bốn config. Ghi manifest (FR-033).
- [X] T030 [P] [US4] Port `operations/json-web-token/index.ts` + test gốc (12 ca) vào `apps/api/src/operations/
  json-web-token/`; thêm config. Ghi manifest (FR-034).
- [X] T031 [P] [US4] Port `operations/mail/rate-limiter.ts` + `rate-limiter.test.ts` (5 ca) và `mail/index.ts` vào
  `apps/api/src/operations/mail/`: giữ `useFlowsEmailRateLimiter(flow!.id)` và dựng `mailObject`, thay
  `MailService` + `send` bằng `logger.warn('Backoffice: mail sending is out of scope; flow mail "<subject>" to <to>
  not sent')` (`// Backoffice: D-34`), không import `md`; `mail/index.test.ts` viết lại 7 ca gốc thành kiểm dòng log
  (template mặc định `base`, template tùy chọn, `data`, wysiwyg, markdown không render, cc/bcc/replyTo không xuất
  hiện) + rate limiter vượt hạn ném `EmailLimitExceededError` trước khi log; thêm config. Ghi manifest (FR-036).
- [X] T032 [P] [US4] Port `operations/notification/index.ts` + test gốc (2 `test.each`) vào `apps/api/src/operations/
  notification/`; `NotificationsService` của 008; thêm config. Ghi manifest (FR-037).
- [X] T033 [P] [US4] Port `operations/request/index.ts` + test gốc (5 ca, mock `../../request/index.js`) vào
  `apps/api/src/operations/request/`; `encodeurl`, `isValidJSON` của `@backoffice/utils`; thêm config. Ghi manifest
  (FR-038).
- [X] T034 [P] [US4] Port `operations/trigger/index.ts` + test gốc (3 ca, `vi.doMock('../../flows.js')`) vào
  `apps/api/src/operations/trigger/`; thêm config. Ghi manifest (FR-040).
- [X] T035 [US4] `apps/api/src/operations/index.test.ts`: 15 id đúng thứ tự tên thư mục, `FlowManager.initialize()`
  đăng ký đủ 15 (`flows.test.ts` ca mới); chạy T027 trên Postgres, MySQL, SQLite; ghi số ca và thời gian ca `exec`
  timeout vào "Ghi chú khi làm". Sau T028 đến T034.

**Checkpoint**: US4 xanh; `pnpm nx run api:test` gồm 94 khối test gốc của operation; quickstart §5.

---

## Phase 7: User Story 5 - Sửa flow ở app này, app kia nạp lại ngay (Priority: P2)

**Goal**: `/flows`, `/operations` CRUD (kể cả ghi lồng của trình chỉnh sửa) giống Directus; mỗi ghi phát một message
`flows` và cả hai app (và instance thứ hai của app mới) nạp lại.

**Independent Test**: `crud.test.ts`, `reload.test.ts` xanh; quickstart §3.

### Tests for User Story 5

- [X] T036 [P] [US5] `tests/parity/src/flows/crud.test.ts` (`reduced`, `full`): `POST /flows` đơn, mảng, lồng
  `operations`; `GET`, `SEARCH` (`keys`, `query`), `GET /:pk`, `fields` (`operations.*`, `operation.*`,
  `operations.flow.*`), `filter`, `sort`, `meta`; `PATCH /` (`keys`, `query`, batch), `PATCH /:pk` lồng
  `{create, update, delete}` + `operation` đúng chuỗi `flow.vue saveChanges` (gồm `PATCH /operations` mảng gỡ
  `resolve`); `/operations` CRUD và `POST` sao chép operation (`copy panel`); `DELETE /flows/:pk` → operation mất theo
  CASCADE; user thường không policy → `403`; `OPTIONS`, `HEAD`; so dòng `directus_flows`, `directus_operations` và
  activity/revision của ghi; R-22: user có update nhưng không delete trên `directus_flows` gọi `DELETE /flows/:id` →
  `403` và `resolve`/`reject` của operation đã null ở cả hai app, ghi bằng chứng vào spec R-22 (FR-001 đến FR-004,
  US5 ca 1, 3, 4).
- [X] T037 [P] [US5] `tests/parity/src/flows/reload.test.ts` (`reduced`, `full`): tạo ở A → `POST /flows/trigger` ở B
  trong ≤ 2 s (poll mỗi 200 ms, ghi thời gian); sửa `options` của operation ở B qua `PATCH /operations/:id` → kết quả
  mới ở A; `PATCH /flows/:id {status: inactive}` ở A → `403` ở B; `DELETE` ở B → `403` ở A; ghi lồng `operations` qua `PATCH
  /flows/:pk` cũng nạp lại (`/items/directus_*` bị từ chối `403` như Directus); `GET /flows?fields[]=*&fields[]=operations.*`
  giống nhau sau mỗi bước; `full`: sửa ở Directus → cả 8156 và 8157 (profile `multi`) dùng flow mới; bus: một message
  `flows` `{type:'reload'}` mỗi ghi (đọc qua `redis-cli monitor` kênh `directus:bus:flows`) — đo R2 "message về
  chính người gửi" tại đây (US5 ca 1–2; FR-014, FR-062, SC-005).
- [X] T038 [P] [US5] `apps/api/src/controllers/operations.controller.test.ts` (supertest, mock service): 8 handler
  như `comments.controller.test.ts`, `OPTIONS`.

### Implementation for User Story 5

- [X] T039 [US5] `apps/api/src/controllers/operations.controller.ts` port từ `directus/api/src/controllers/operations.ts`
  theo mẫu `comments.controller.ts`; `app.module.ts` đăng ký và `useCollection('directus_operations')`; `app.test.ts`
  thêm ca. Cùng task: `tests/parity/proxy/backoffice-routes.txt` thêm `operations`; `proxy-conf.test.ts` ca
  `/operations/<uuid>` tới app mới; `routing.spec.ts` thêm `operations`; `request-set.ts` thêm `GET /operations`
  (admin). Ghi manifest. Chạy T036, T037.
- [X] T040 [P] [US5] `tests/parity/src/items/bus.test.ts` thêm event `flows.create|update|delete`,
  `operations.create|update|delete` qua cầu nối websocket (005) và kênh `flows` (FR-004).

**Checkpoint**: US5 xanh; quickstart §3 hai chiều không khởi động lại.

---

## Phase 8: User Story 6 - Log chạy flow hiển thị trong app Directus (Priority: P2)

**Goal**: Activity `run` và revision `{steps, data}` của mọi trigger trùng Directus sau chuẩn hóa, che đúng khóa và
giá trị `$env`, lỗi serialize giống (R7); Logs sidebar đọc được.

**Independent Test**: `logs.test.ts` xanh; Logs sidebar trong E2E (T046).

- [ ] T041 [P] [US6] `tests/parity/env/postgres.env`, `mysql.env`, `sqlite3.env` (và các vendor nightly) thêm
  `FLOWS_ENV_ALLOW_LIST=PARITY_FLOWS_ENV_TEST` và `PARITY_FLOWS_ENV_TEST=parity-env-secret` (cả hai app cùng giá trị;
  chú thích test values only); `tests/parity/src/vendors.test.ts` ca: mọi vendor env có hai dòng (FR-023 redaction).
- [ ] T042 [US6] `tests/parity/src/flows/logs.test.ts` (`reduced`, `full`): với webhook (public và admin: `user`,
  `ip`, `user_agent`, `origin`; `User-Agent`, `Origin` cố định), manual, event filter và action, flow `operation`
  (log theo id flow đích), `accountability` `all`/`activity`/null: so dòng activity và revision qua `flowEffects` +
  `comparable`; redaction: `headers.authorization`, `headers.cookie`, `query.access_token`, `payload.password` →
  `--redacted--`, giá trị `parity-env-secret` trong `$trigger.body` → `--redacted:PARITY_FLOWS_ENV_TEST--` ở cả
  `steps[].options` và `data`; lỗi bước reject (`throw-error`, `item-read` `403`, `condition`) serialize
  `{name: 'DirectusError', message}` trong revision và `{name, extensions, code, status}` trong `$all` (R7; ghi bằng
  chứng JSON của Directus vào "Ghi chú khi làm"); query của `use-revisions.ts` (`filter activity.action = run`,
  `aggregate count`, `fields` lồng) giống nhau; filter flow reject làm `POST /items/articles` lỗi → không còn dòng
  `run`, revision của lần chạy đó ở cả hai app (rollback cùng transaction của request); log chạy app mới ghi đọc được
  qua `/revisions` của Directus và ngược lại. Cùng task, ca bắt buộc trong `tests/parity/src/history/retention.test.ts`
  (file của 008, cặp `retention`): chạy một flow webhook `accountability = all` ở app mới của cặp chính, đợi một kỳ
  retention (`FLOW_LOGS_RETENTION=2s`): dòng activity `run` (và revision nối) do app mới ghi bị dọn, dòng `run` mới hơn
  mốc còn lại (US6 ca 1–4; FR-023, FR-062, SC-003). Sau T041.

**Checkpoint**: US6 xanh; Logs sidebar của app Directus qua proxy hiển thị lần chạy do app mới ghi với từng bước.

---

## Phase 9: User Story 7 - Bộ test của Directus, E2E app Directus và benchmark chạy qua trên app mới (Priority: P2)

**Goal**: Blackbox `webhook.test.ts` hai lượt trên cặp `cache-mem`, `e2e-app` đúng chuỗi request của app, Playwright,
CI xanh mọi job.

**Independent Test**: CI `parity`, `parity-blackbox`, E2E xanh trên push.

- [ ] T043 [P] [US7] Blackbox: copy `directus/tests/blackbox/tests/db/routes/flows/webhook.test.ts` vào
  `tests/parity/src/items/blackbox/tests/db/routes/flows/webhook.test.ts`; thay khối `spawn`/`getPort`/
  `awaitDirectusConnection`/`kill` bằng `env[vendor]['URL'] = nodeUrl('cache-mem', 1)` và `describe.skipIf(
  !hasProfile('cache-mem'))` (`// Backoffice:`); `tests/parity/src/items/blackbox/common/config.ts` `nodeUrl` thêm
  `'cache-mem'`; `sequencer.ts` `AFTER` thêm file; `src/blackbox-shim.test.ts` thêm ca; chạy hai lượt
  (`PARITY_BLACKBOX_APPS=directus,backoffice`) với `--profiles=...,cache-mem`. Ghi manifest (research R11,
  contracts/parity.md §3).
- [ ] T044 [P] [US7] `tests/parity/src/flows/e2e-app.test.ts` (`full`): đúng chuỗi request của `stores/flows.ts`
  (`GET /flows?fields[]=*&fields[]=operations.*&limit=-1`), `flow-drawer.vue` (`POST /flows?fields=id`), `flow.vue`
  `saveChanges` (`PATCH /operations` mảng rồi `PATCH /flows/:pk` lồng), `overview.vue` (`PATCH {status}`, `DELETE`),
  `use-flows.ts` (`POST /flows/trigger/:id` cả hai dạng body), `logs-sidebar-detail.vue` → `use-revisions.ts` (ba
  query); so response qua `same()` (FR-063).
- [ ] T045 [P] [US7] `tests/directus-app-e2e/src/flows.spec.ts` (Playwright, `bothRuns`): tạo collection `posts` qua
  `DIRECTUS_URL`; Settings → Flows: tạo flow thủ công (`posts`), thêm Transform + Log, Save; item → menu Flows → chạy
  → thông báo thành công; danh sách chọn 2 → chạy; Logs sidebar 2 lần chạy với 2 bước; toggle status → nút biến mất;
  xóa flow; bảng so `directus_flows`, `directus_operations`, `directus_activity` (`run`), `directus_revisions` sau
  chuẩn hóa id, thời điểm, `steps[].operation`; chạy cục bộ bằng Chrome cài sẵn (config tạm `channel: 'chrome'`, không
  commit) (FR-063, contracts/parity.md §5).
- [ ] T046 [US7] CI: `.github/workflows/ci.yml` `docker` thêm bước `docker run --rm <image> node -e
  "require('isolated-vm')"`; kiểm `suite.ts` đã gồm `flows` (`reduced`, `full`), blackbox qua glob, `flows.spec.ts`
  qua `testDir`, `flows-schedule` không trong `--profiles`, `cache-mem` có trong blackbox (T007); push, theo dõi
  `gh run list --branch main`, sửa job đỏ; ghi thời gian job `quality` (build isolated-vm) và `parity-blackbox` vào
  "Ghi chú khi làm". Sau T043 đến T045 và mọi story.

**Checkpoint**: CI xanh trên push: `quality`, `guard-differences`, `parity` (Postgres `full` hai shard, MySQL, SQLite
`reduced`), `parity-blackbox` hai lượt, `parity-cache`, `parity-matrix-rotating`, `e2e-directus-app`, `docker`,
`security`, `publish`.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T047 [P] `tests/benchmark/src/seed-flows.ts` (collection 1.000 item; 50 flow × 3 operation; flow
  `webhook-sync` `transform` → `condition` → `item-read`, `accountability: null`; flow `webhook-exec`) và
  `tests/benchmark/src/flows.ts`: `webhook-sync`, `flows-list` (ngưỡng 10%), `webhook-exec` (chỉ ghi số), 50 kết nối,
  3 vòng, cùng mẫu `history.ts`; `tests/benchmark/project.json` target `flows`; `compare.test.ts` thêm ca nếu
  `compare.ts` đổi (FR-063, SC-006, research R13).
- [ ] T048 [P] `.github/workflows/benchmark.yml` job `benchmark-flows` theo mẫu `benchmark-history`; chạy cục bộ 3
  vòng trên Postgres, ghi p95, req/s và thời gian job vào "Ghi chú khi làm".
- [ ] T049 [P] Manifest và header: kiểm `tools/port-manifest/009-T*.json` đủ cho T002, T003, T009 đến T012, T014,
  T017, T022, T028 đến T034, T039, T043; `node tools/check-port-headers.mjs` xanh; mọi chỗ `// Backoffice:` thuộc danh
  sách của plan (Constitution Check I).
- [ ] T050 [P] Tài liệu: `specs/001-platform-foundation/spec.md` dòng D-09.7 (gỡ ở 009); `specs/003-auth-session/
  spec.md` dòng D-26 (gỡ ở 009); `specs/004-permissions/spec.md` dòng D-29 (gỡ ở 009), D-31 (thu hẹp: bỏ
  `directus_flows`, `directus_operations`); `specs/008-activity-revisions-versions/spec.md` dòng D-33 (`Loại` lâu dài,
  `Gỡ khi` `—`); `tests/parity/README.md` mục 009 (helper `withoutD097`, cặp `flows-schedule`, `cache-mem` cho
  blackbox); `CLAUDE.md` mục 009 (kiểm lại); `specs/009-flows-automation/quickstart.md` kiểm lại lệnh và cổng.
- [ ] T051 Coverage và chất lượng: `pnpm nx run-many -t test lint typecheck`, coverage `apps/api`, `libs/utils`,
  `libs/errors` ≥ 80% (ghi số), `pnpm audit --prod --audit-level=high` không advisory mới, `graphify update .`.
- [ ] T052 Spec: điền bằng chứng R-22 (T036), R-23 (T023), R-24 (T019), R7 (T019, T042), uuid viết hoa (T019),
  micromustache R6 (T003), bus R2 (T037) vào
  bảng rủi ro và "Ghi chú khi làm"; cập nhật `checklists/flows.md` mục liên quan (CHK046, CHK047); sửa FR nếu đo
  khác (ghi rõ, không tự lệch).
- [ ] T053 Đóng feature (sau T046 đến T052, tech lead duyệt gỡ D-09.7, D-26, D-29, thu hẹp D-31, D-33 lâu dài, D-34,
  R-22, R-23, R-24, vi phạm IV của plan Complexity Tracking, ghi nhận `name` R7): `tests/parity/accepted-differences.ts` xóa entry `D-09.7`, `D-26`, `D-29`, sửa comment
  `D-31`, bỏ `removeAt` của `D-33`, thêm `D-35` (kind `doc`, "No extensions.* or email.send events: no extension manager and no mail service (Principle XI)") và `D-34` (kind `doc`, "No flow mail: the mail operation writes a warning line
  after the rate limiter (Principle X)"); helper `same()` bỏ bộ lọc D-09.7; `spec.md` Status `Done` + dòng "Duyệt
  khác biệt" với ngày; commit `chore(009): close feature 009-flows-automation`, push `main`, CI (gồm
  `guard-differences`) xanh; cập nhật memory dự án.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 trước (cài gói) rồi T002 đến T008 song song (T006, T007 cùng chạm
  `tests/parity/src/vendors.test.ts` và các workflow: làm nối tiếp hoặc một người).
- **Phase 2 (Foundational)**: sau Phase 1. T009, T010, T011, T012, T018 song song; T013 sau T012; T014 sau T009 đến
  T013; T015, T016 sau T014; T017 sau T011 (song song với T014). CHẶN mọi story.
- **Phase 3 (US1)**: sau Phase 2. T019, T020, T021 song song; T022 cuối.
- **Phase 4 (US2)**: sau Phase 2 và T007. T023, T024 song song (T023 cần cặp `flows-schedule`, chạy `sequential`).
- **Phase 5 (US3)**: sau Phase 2 (độc lập với US1, US2). T025, T026 song song; các ca `item-create` của T025 chỉ xanh
  sau T029 (US4).
- **Phase 6 (US4)**: sau US1 (dùng webhook để chạy operation). T027 trước (đỏ); T028 đến T034 song song; T035 cuối.
- **Phase 7 (US5)**: sau US1. T036, T037, T038 song song; T039 rồi T040.
- **Phase 8 (US6)**: sau US1 đến US5 (so log của mọi trigger và operation). T041 rồi T042.
- **Phase 9 (US7)**: T043 sau US1 và T007; T044 sau US5; T045 sau US1, US5, US6; T046 sau tất cả story.
- **Phase 10 (Polish)**: T047 đến T050 song song sau US7; T051, T052 sau T047 đến T050; T053 cuối.

### Within Each User Story

- Test đối chiếu và test controller viết trước, đỏ, rồi controller hoặc operation.
- Test gốc port trước, đỏ, rồi code (T003, T009, T014, T017, T028 đến T034).
- Mỗi story kết thúc bằng một lượt `parity` đủ ở Postgres và rút gọn ở MySQL, SQLite.
- Mục spec ghi "đo" (R-22, R-23, R7, R6, R2) được đo trong T036, T023, T019/T042, T003, T037 và ghi lại vào spec ở
  T052.

### Parallel Opportunities

- Phase 1: T002 đến T008 song song sau T001.
- Phase 2: T009, T010, T011, T012, T018 song song; T017 song song với T014.
- US1: T019 đến T021 song song.
- US2, US3: song song với nhau và với US1 sau Phase 2 (ca `item-create` của US3 chờ T029).
- Proxy: `flows` thêm ở T022, `operations` ở T039, không ở Phase 1 (app Directus hydrate gọi `GET /flows`).
- US4: T028 đến T034 song song (7 task).
- US5: T036 đến T038 song song; T040 song song với T039.
- US7: T043, T044, T045 song song.
- Polish: T047 đến T050 song song.

---

## Parallel Example: User Story 4

```bash
# Test đối chiếu viết trước, đỏ:
Task: "operations.test.ts 15 operation × resolve/reject (T027)"
# Rồi 7 task port song song:
Task: "exec + 12 test gốc isolated-vm thật (T028)"
Task: "item-create/read/update/delete + 37 test gốc (T029)"
Task: "json-web-token + 12 test gốc (T030)"
Task: "mail + rate-limiter, test viết lại (T031)"
Task: "notification + 2 test gốc (T032)"
Task: "request + 5 test gốc (T033)"
Task: "trigger + 3 test gốc (T034)"
# Rồi:
Task: "operations/index.ts 15 config, chạy T027 (T035)"
```

## Parallel Example: Phase 2

```bash
Task: "redact-object.ts + 14 test gốc (T009)"
Task: "construct-flow-tree.ts + test (T010)"
Task: "define-operation-api.ts + operations/index.ts (T011)"
Task: "flows.service.ts, operations.service.ts + test (T012)"
Task: "tests/parity/src/flows/helpers.ts + suite.ts (T018)"
# Rồi: get-service.ts + providers.ts (T013) → flows.ts + test gốc (T014) → test Backoffice (T015), app.ts (T016);
# năm operation lõi (T017) song song với T014
```

## Implementation Strategy

### MVP (Phase 1 đến 4)

1. Phase 1, 2: nền (gói native, type, util, tên lỗi, env, profile, service, `FlowManager`, năm operation lõi).
2. US1: `flows.controller.ts`; webhook và manual cho cùng kết quả ở hai app; app Directus qua proxy chạy flow thủ công.
3. US2: cặp `flows-schedule`; 10 kỳ đúng 10 lần chạy; cảnh báo store memory.
4. Dừng, kiểm quickstart §2, §4: đã đạt cả hai tiêu chí chấp nhận của spec (với năm operation lõi).

### Phần còn lại (Phase 5 đến 10)

- US3 song song với US1/US2; US4 (10 operation) và US5 (CRUD, nạp lại) sau US1; US6 (log) sau cùng của story; US7 gom
  blackbox, e2e-app, Playwright, CI; Polish gồm benchmark, manifest, sổ khác biệt, bằng chứng R-xx và đóng feature
  (tech lead duyệt).

## Notes

- `[P]` = file khác nhau, không phụ thuộc task chưa xong.
- Commit sau mỗi nhóm task xanh; push `main`; theo dõi CI.
- Ca blackbox hoặc đối chiếu fail trên chính Directus: ghi chú tên ca và bỏ qua theo Assumptions, không sửa Directus.
- `directus/` chỉ đọc; `tools/check-port-headers.mjs` chặn file port thiếu header.
- Cặp `flows-schedule` dùng chung DB: chỉ T023 bật, luôn `profileStop` và xóa flow qua cặp chính ở `afterAll`.

## Ghi chú khi làm

- T001 (2026-10-14): isolated-vm 5.0.3, micromustache 8.0.3, p-queue 8.1.0 cài bằng bản dựng sẵn (prebuild) trên macOS
  arm64 (`pnpm install` 4 s) và trong stage builder alpine amd64 (`prebuild-install`, không cần `node-gyp`); image
  `docker build --platform linux/amd64` 58 s (lớp cache), `node -e "require('isolated-vm')"` trong image chạy isolate
  đúng. Directus 11.17.4 không dùng `--no-node-snapshot`, app mới cũng không. `pnpm audit --prod --audit-level=high`:
  không advisory mới (mọi high/critical đều nằm trong danh sách bỏ qua có sẵn).
- T007: nightly.yml không chạy blackbox, nên `cache-mem` chỉ thêm vào `--profiles` của blackbox ở `ci.yml` (Postgres,
  và các job MySQL, SQLite `reduced` có blackbox), `parity-matrix.yml` (`blackbox-full`) và `tools/ci-local.sh`.
- T015: test Backoffice của `FlowManager` đặt ở `apps/api/src/flows.manager.test.ts` (32 ca) để `flows.test.ts` giữ
  nguyên bản port (2 ca). Đo được một hành vi Directus: `{{ x }}` trỏ giá trị không có (không phải toàn chuỗi) được
  micromustache render thành chuỗi `"undefined"` (ca manual `requireSelection = false` không có `keys`).
- T016: 22 file test dựng cả app (`createApp()` trực tiếp hoặc qua `test/data-model-app.ts`) mock `../flows.js` bằng
  `src/test-utils/flows.ts`; `app-pipeline.test.ts` có ca `initialize` một lần và `unload` khi `runShutdownTasks`.
- T018: `seedFlow` tạo flow rồi operation từ cuối lên đầu với uuid sinh trước, `PATCH` operation gốc, rồi đợi
  `RELOAD_WAIT` = 500 ms cho hai app nạp lại qua bus (không poll trigger để khỏi sinh lần chạy thừa).
- US1 (T019–T022, 2026-10-14, Postgres cục bộ, hai app amd64 giả lập): `webhook.test.ts` 15/15, `manual.test.ts`
  11/11 lần chạy đầu. Đo trên Directus 11.17.4 thật: uuid viết hoa của flow có thật khớp route và trả `403` ở cả hai
  app (Express 4 không phân biệt hoa thường, như spec FR-001 đã sửa); lỗi `throw-error` không `error_on_reject` trả
  `200` với `{"name":"DirectusError","code":"NOPE","status":422}` ở cả hai app (R7 khớp); `condition` với
  `error_on_reject` trả `400 FAILED_VALIDATION`. Controller: `$trigger.path` lấy đường dẫn trong router Directus
  (`/trigger/<id>`, bỏ `/flows`), vì Nest gắn route ở app. MySQL, SQLite chạy ở CI.
- US2 (T023, 2026-10-14, Postgres cục bộ): `schedule.test.ts` 7/7 trên cặp `flows-schedule`. Ba lượt 10 kỳ (cron
  `*/2`, đếm từ lần chạy đầu như blackbox Directus): mỗi lượt đúng 10 dòng activity `run` và 10 dòng log tổng hai
  container (app mới thắng phần lớn kỳ vì Directus chạy giả lập amd64, ví dụ 1/9). Dừng Directus: app mới chạy đủ
  10; dừng app mới: Directus chạy đủ 10. Cron sai: cả hai app ghi cảnh báo, không chạy. R-23: đổi `name` 50 ms trước
  kỳ thứ năm, lượt đo được 10 lần (không chạy đôi; ca chấp nhận 10 hoặc 11). T024: các ca lịch ở unit test nằm trong
  `flows.manager.test.ts` (cron 6 trường, lỗi lần chạy theo lịch ghi `logger.error` và giữ job, `unload` dừng job,
  cảnh báo store memory đúng một lần khi có flow theo lịch).
- US3, US4 (T025–T035, 2026-10-14, Postgres cục bộ): `event.test.ts` 7/7, `operations.test.ts` 22/22, 94 khối test
  gốc của operation + `rate-limiter` 5 xanh (exec với isolated-vm thật), `mail` viết lại 8 ca. Đo trên Directus thật:
  - Lỗi JS thường (không phải `DirectusError`: timeout của `exec`, role không tồn tại của `item-*`) serialize thành
    `{}` trong `$all` ở cả hai app (`message` không enumerable); chỉ log chạy giữ `message`.
  - `request` từ chính container Directus tới `http://directus:8055` bị `IMPORT_IP_DENY_LIST` mặc định (`0.0.0.0` =
    IP của chính máy) chặn, còn từ container app mới thì không: do môi trường, không phải do code; test dùng
    `http://files-fixtures/` làm đích chung.
  - Filter flow reject làm request lỗi: `item-create` trong flow và dòng `run` bị rollback ở cả hai app.
- Phát hiện khi làm US3: feature 003 port `AuthenticationService`, `authenticate`, ba driver SSO và
  `database/errors/translate.ts` mà bỏ các event `auth.login` (filter, action), `auth.jwt`, `auth.create`,
  `auth.update`, `authenticate`, `database.error` (ghi D-26); feature 001 bỏ `response`, `server.start`, `server.stop`
  (server.ts), `request.error` (error handler), `request.not_found` (404) và phần `/flows/trigger` của khóa cache
  (`cacheQueryParams`), ghi "feature 009". Đã port nguyên các điểm phát này và khôi phục các ca test gốc đã bị cắt
  (`authenticate.test.ts` "Short-circuits when authenticate filter is used", 4 ca `auth.login` của
  `authentication.test.ts`, 2 assert `auth.update` của `ldap.test.ts`, 3 ca flow trigger của `get-cache-key.test.ts`,
  mock DB của `error-handler.test.ts`); ca `auth.login` trong `event.test.ts`. `get-cache-key.ts` import `flows.js`
  động (chỉ khi path là `/flows/trigger/...`) để middleware cache không kéo cả bộ máy flow vào (khác nguồn, ghi
  `Backoffice:`). Event `extensions.*` và `email.send` không phát: D-35 mới (spec).
- CI của `f2abeab` (2026-10-14): (1) gitleaks báo 3 khóa giả trong `redact-object.test.ts` (test gốc Directus):
  thêm file vào allowlist `.gitleaks.toml` như `get-cache-key.test.ts`. (2) `redis-down.test.ts` "starts and answers
  pong while Redis is down" (FR-025 của 001) đỏ: app mới thoát mã 1 khi `REDIS` không truy cập được vì
  `FlowManager.initialize()` dựng schema qua khóa Redis lúc khởi động. Đo Directus 11.17.4 `node cli.js start` cùng
  điều kiện: cũng thoát mã 1 (`MaxRetriesPerRequestError`). Chủ dự án chọn giống Directus (Clarifications 2026-10-14):
  FR-025 của spec 001 và ca test sửa thành kỳ vọng thoát mã 1.
- US5 (T036–T040, 2026-10-14, Postgres cục bộ): `crud.test.ts` 11/11 (ổn định qua 3 lượt sau khi sắp các mảng đọc lại
  theo tên/khóa: thứ tự theo uuid ngẫu nhiên ở cả hai app), `reload.test.ts` 4/4, `bus.test.ts` 2/2 (suite `cache`,
  thêm bước `flows.*`, `operations.*`). Đo: app kia dùng định nghĩa mới sau 100–600 ms ở cả hai chiều (SC-005 < 2 s);
  instance thứ hai của app mới (profile `multi`) cũng nạp lại; app vừa ghi tự nạp lại (Redis giao message cho chính kết
  nối subscribe của nó, CHK046). R-22 đo trên Directus thật: user có update nhưng không delete trên `directus_flows`
  gọi `DELETE /flows/:id` → `403` ở cả hai app và `resolve` của operation đầu đã thành `null`. `/items/directus_*` bị
  từ chối `403` ở cả hai app (spec FR-003 sửa theo).
