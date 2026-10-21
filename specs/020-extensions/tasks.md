# Tasks: Extensions (020)

**Input**: Design documents from `/specs/020-extensions/` (plan.md, spec.md, research.md R1–R14, data-model.md,
contracts/{api,web,deploy,tests}.md, quickstart.md, checklists/release-gate.md đã áp)
**Prerequisites**: constitution 2.1.0 (extension trong phạm vi trừ theme); release-gate CHK001–CHK059 đã áp vào tài liệu.

**Tests**: bắt buộc (constitution V, VI). Mọi thay đổi có test; mọi endpoint thêm hoặc sửa có test parity chạy với
Directus 11.17.4 và app mới, so status, body và tác động DB.

**Organization**: theo user story của spec; thứ tự phase theo **ba lượt** của research R14 (mỗi lượt lên `main` khi CI
xanh), không thuần theo P: lượt 1 = US1, US2, US7, US5 (phần đọc, bật tắt); lượt 2 = US8 (shim), US3, US4; lượt 3 = US6
và phần cài/gỡ của US5, đóng.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`. **[P]**: làm song song được (khác file, không phụ thuộc
  task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `web/` = `apps/web/src/`; `e2e/` = `apps/web-e2e/src/`; `parity/` =
  `tests/parity/`; `fx/` = `tests/fixtures/extensions/`; `D/api/` = `directus/api/src/`; `D/app/` =
  `directus/app/src/`; `D/pkg/` = `directus/packages/`.
- File chép từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn>` (SFC: comment trong `<script setup>`);
  mỗi task chép ghi `{ "source", "dest" }` vào `tools/port-manifest/020-T###.json`; chạy `pnpm run check-port-headers`.
  KHÔNG sửa, xóa hay tạo file trong `directus/`. Chỗ khác nguồn ghi `// Backoffice: <lý do>` (D-xx, R-xx).
- Hành vi Directus có rủi ro chép nguyên, ghi `// Backoffice: same as Directus (R-xx)`: R-60 (đếm limit), R-62 (thứ tự
  filter sau reload), R-63 (bundle lỗi giữ bản cũ), R-65, R-66, R-68. Khác Directus có chủ đích: R-58 (khóa
  `extensions-settings`), R-61 (`offInit(event)`), R-64 (reject reload), R-67 (giữ module nội bộ), D-135..D-141.
- Component Vue: chép logic `<script setup>`, viết lại template bằng Reka UI + `Bo*` theo recipe nháp (Q-41..Q-46) trước
  khi code; KHÔNG hex thô, KHÔNG palette ngoài theme (`check-raw-colors`); nút chỉ icon có `aria-label`.
- Shim (`web/directus-shim/`): phần `Bo*` thiếu thì bổ sung vào `Bo*` (prop thêm, mặc định giữ hành vi cũ, test 012–019
  giữ xanh); shim chỉ map tên và hợp đồng.
- Chuỗi giao diện: khóa Directus (đã sinh ở 012); khóa thiếu vi-VN vào `web/lang/overlay/vi-VN.ts` (research R10).
- Dữ liệu test: collection `bo_ext_items`, `bo_ext_log` (seed T017); bộ extension mẫu `fx/` (T016, danh sách chuẩn
  data-model §9); dữ liệu do test tạo đặt tên `web-e2e-<cfg>-<spec>-<n>` / `parity-<suite>-<n>` và xóa ở `afterAll`.
- Checkout dùng chung với phiên khác: chỉ stage đường dẫn của 020, nhắn trước và sau mỗi push, không `stash`/`reset`/
  `add -A`. Sau mỗi phase: `pnpm nx run-many -t lint,typecheck,test,build -p api web` xanh (thêm lib mới vào `-p`).

---

## Phase 1: Setup (kiểm giả định mở, thư viện, recipe lượt 1) — Lượt 1

**Purpose**: chốt các điểm [Unverified] của research, thêm thư viện cùng bản Directus, recipe nháp cho màn lượt 1.

- [X] T001 Kiểm môi trường và ghi kết quả vào `specs/020-extensions/research.md` (mục "Kết quả T001"): (a) build thử
      `apps/api/Dockerfile` với `rolldown` 1.0.0-beta.31 trong `dependencies`, chạy `node -e "import('rolldown')"` trong
      container linux/amd64 alpine; không có binding musl thì ghi khác biệt mới (bỏ `EXTENSIONS_ROLLDOWN`, chỉ rollup) và
      báo owner trước khi đi tiếp; (b) trong container: `/directus/node_modules/.directus/{extensions,app-extensions,
      marketplace}` tạo và ghi được bởi uid 1000; (c) `node-machine-id` 1.1.12 trả sha256(hostname) (không có
      `/etc/machine-id`); (d) `pnpm audit --prod` với gói mới (tar 7.5.19 (security patch of the Directus 7.5.8), rolldown, chokidar 5, glob-to-regexp), advisory
      phải bỏ qua ghi `auditConfig` kèm lý do (spec Assumptions)
- [X] T002 Thư viện (research R1): `pnpm-workspace.yaml` catalog nhóm "same versions as directus" thêm `rollup` 4.59.0,
      `rolldown` 1.0.0-beta.31, `@rollup/plugin-virtual` 3.0.2, `@rollup/plugin-node-resolve` 16.0.3, `chokidar` 5.0.0,
      `node-machine-id` 1.1.12, `tar` 7.5.8, `glob-to-regexp` 0.4.1, `@types/glob-to-regexp` 0.4.4,
      `@directus/composables` 11.4.1, `@directus/extensions-sdk` 17.1.4, `semver` 7.7.3, `@types/semver`,
      `@vueuse/router` 14.0.0; `packages:` thêm `tests/fixtures/extensions`; `apps/api/package.json` dependencies thêm
      rollup, rolldown, hai plugin, chokidar, node-machine-id, tar, fs-extra, glob-to-regexp (+ `@types/*` dev);
      `tools/check-package-names.mjs` cho phép `@directus/composables`, `@directus/extensions-sdk`; `pnpm install`,
      `pnpm nx run api:build` xanh (pinia, axios, semver, `@vueuse/router` cho web thêm ở T100)
- [X] T003 [P] Recipe nháp Q-41 (Settings > Extensions: dòng extension với icon loại, tên, chip phiên bản, nguồn, chip
      trạng thái enabled/disabled/partial, nhóm theo loại với divider, bundle con lồng, menu dòng `more_vert`, trạng thái
      nạp và rỗng `no_extensions`) vào `design-system/docs/component-specs.md` (mục Tier 3 (020)) theo cách 018 làm
      Q-34..Q-39; ảnh nháp sáng/tối
- [X] T004 [P] Biến môi trường (contracts/api.md §3): `api/config/supported-variables.ts` thêm `EXTENSIONS_MUST_LOAD`,
      `EXTENSIONS_AUTO_RELOAD`, `EXTENSIONS_SANDBOX_MEMORY`, `EXTENSIONS_SANDBOX_TIMEOUT`, `EXTENSIONS_LIMIT`,
      `EXTENSIONS_ROLLDOWN`, `PACKAGE_FILE_LOCATION` (bỏ khỏi `warn-unsupported-variables.ts`); sửa
      `api/config/supported-variables.test.ts:179` (`EXTENSIONS_AUTO_RELOAD` nay supported) và thêm ca cho 7 biến

---

## Phase 2: Foundational (lib extensions, types, utils, bộ mẫu, env parity, manager lõi, service, controller) — Lượt 1

**Purpose**: phần mọi story cần. ⚠️ Không story nào bắt đầu trước khi phase này xong.

### Lib, types, utils

- [X] T010 [P] Tạo lib `libs/extensions` (`@backoffice/extensions`: `package.json`, `project.json`, `tsconfig*.json`,
      `vitest.config.ts` theo mẫu `libs/constants`); port `D/pkg/extensions/src/shared/` → `libs/extensions/src/shared/`:
      `constants/{pkg-key,shared-deps,languages}.ts` (`EXTENSION_PKG_KEY`, `APP_SHARED_DEPS`, `API_SHARED_DEPS`),
      `schemas/{options,manifest}.ts` (zod), `define*` (identity: interface, display, layout, module, panel,
      operationApp, operationApi, hook, endpoint, bundle); chép test schema của Directus nếu có; manifest
      `tools/port-manifest/020-T010.json`
- [X] T011 [P] Port `D/pkg/extensions/src/node/utils/{get-extensions,generate-extensions-entrypoint}.ts` →
      `libs/extensions/src/node/` (`getExtensionDefinition`, `resolveFsExtensions`, `resolveModuleExtensions`,
      `generateExtensionsEntrypoint`) và test của chúng (gồm snapshot `generate-extensions-entrypoint.test.ts:34,319-321`);
      export `@backoffice/extensions/node`
- [X] T012 [P] Types (research R2): `libs/types/src/extensions/*.ts` thêm `Extension`, `ApiExtension`, `HybridExtension`,
      `BundleExtension`, `ExtensionSettings`, `ApiOutput`, `BundleConfig`, `HookConfig`, `RegisterFunctions`,
      `EndpointConfig`, `HookExtensionContext`, `EndpointExtensionContext`, `ExtensionManagerOptions`, `ExtensionsServices`
      (port `D/pkg/types/src/extensions/*`); `ApiExtensionContext` thêm `emitter`
- [X] T013 [P] Utils: `libs/utils/src/shared/{pluralize,number-generator}.ts`, `libs/utils/src/node/{list-folders,
      resolve-package,path-to-relative-url}.ts` (port `D/pkg/utils/{shared,node}/*` cùng test); export ở index
- [X] T014 [P] `api/utils/{import-file-url,get-module-default,delete-from-require-cache}.ts` (port `D/api/utils/*` cùng
      test; `importFileUrl(path, base, {fresh})` thêm `?t=` như Directus)

### Bộ mẫu và môi trường test

- [X] T015 Viết mã nguồn bộ extension mẫu theo data-model §9 trong `fx/<name>/{package.json,src/**}` (13 package:
      `parity-hook-audit` — hook ghi tên event nhận được vào `bo_ext_log` CHỈ khi request có header `x-bo-ext-trace`
      hoặc event chạm collection `bo_ext_*` (không làm nặng suite khác), filter `items.create` thêm `audited` cho
      `bo_ext_items`, action ghi log, `init('routes.custom.before')` header `x-bo-ext: 1`, `schedule('* * * * *')` chỉ
      đăng ký khi env `BO_EXT_SCHEDULE=1` (profile `extensions`), `embed`; `parity-endpoint-demo`; `parity-endpoint-express4` một route mỗi mục D-139;
      `parity-operation-slack` (api + app); `parity-interface-color`, `parity-display-badge`, `parity-layout-grid`,
      `parity-module-report`, `parity-panel-counter` (dùng các `v-*`, directive, inject liệt kê ở data-model §9);
      `parity-bundle-tools` (interface + hook + operation, `partial: true`); `parity-{hook,endpoint,operation}-sandbox`
      với scope `request` tới `http://files-fixtures/*`, `log`, `sleep` và option bật ca vượt bộ nhớ/thời gian/URL ngoài
      scope); `fx/package.json` (`@backoffice/extension-fixtures`, private, devDependency `@directus/extensions-sdk`)
- [X] T016 Build bộ mẫu: script `build` (`directus-extension build` từng package) và `pack` (`npm pack` → `fx/<name>/
      <name>-<version>.tgz`); commit `dist/` và `.tgz`; `fx/fixtures-build.test.ts` build lại vào thư mục tạm và so byte với
      `dist/` (như test của script sync)
- [X] T017 [P] Seed: `apps/web/fixtures/interfaces/seed.mjs` + `lib.mjs` tạo `bo_ext_items` (id, title, audited boolean
      null) và `bo_ext_log` (id, kind, event, payload json, created_at), xóa ở `--clean`; `export.mjs` + snapshot
      `apps/web/fixtures/interfaces/snapshot/extensions.json`; `parity/src/web/fixtures-seed.test.ts` giữ xanh
- [X] T018 Env parity (contracts/tests.md §3): `parity/docker-compose.yml` cặp chính (8155/8156) và `multi` (8157) thêm
      `EXTENSIONS_LOCATION=s3`; `minio-init` chép `fx/*/{package.json,dist}` lên `s3://directus/extensions/<name>/` trước
      khi Directus khởi động; profile mới `extensions` (cặp 10655/10656, `EXTENSIONS_PATH=./extensions-ext`,
      `EXTENSIONS_LIMIT=3`, `MARKETPLACE_TRUST=sandbox`) thêm ở bốn chỗ (compose, `ALL_PROFILES` của
      `parity/scripts/env.mjs`, `compose()` của `parity/src/docker.ts`, `profilePorts` của `parity/src/config.ts`) và
      README; `env-up --profiles=app,multi,extensions` lên được, Directus 8155 nạp đủ bộ mẫu (log "Loaded extensions")
- [X] T019 [P] Harness parity: `parity/src/extensions/helpers.ts` (`admin()`, `nodes()` = 8155/8156/8157, `waitAll(fn,
      10_000)` thăm mỗi 500 ms, `containerLog(name, since)`, `extRows()` đọc `directus_extensions`, `extLog()` đọc
      `bo_ext_log`); `parity/src/suite.ts` thêm `src/extensions/**` vào `FULL_FILES`, `list`, `hooks`, `endpoints` vào
      `REDUCED_FILES`

### Manager lõi, service, controller (FR-001..FR-008, FR-031..FR-036)

- [X] T020 Port `D/api/extensions/lib/{get-extensions,get-extensions-settings,wrap-embeds}.ts` →
      `api/extensions/lib/`; `get-extensions-settings.ts` bọc bước tạo dòng trong khóa Redis `extensions-settings`
      (`useLock` increment/delete, thử mỗi 250 ms tối đa 30 s, quá hạn log warn + xóa khóa + tạo không khóa, đọc lại dòng
      sau khi giữ khóa; R-58); test: port `get-extensions-settings.test.ts` + ca khóa (hai lời gọi song song chỉ tạo một
      dòng; khóa kẹt quá hạn)
- [X] T021 Port `D/api/extensions/manager.ts` phần vòng đời → `api/extensions/manager.ts` + `api/extensions/index.ts`
      (`getExtensionManager()`): state (maps theo nguồn, `extensionsSettings`, `unregisterFunctionMap`, `localEmitter`,
      `endpointRouter`, `reloadQueue` PQueue 1, `messenger`, `processId`), `extensions` getter, `getExtension`,
      `initialize` (subscribe `extensions.reload` một lần, bỏ `origin` của mình), `load` (sync khi có
      `EXTENSIONS_LOCATION` → `process.exit(1)` khi lỗi; `getExtensions`, `getExtensionsSettings`, `registerApiExtensions`),
      `unload`, `reload` (dedupe, action `extensions.reload {extensions, added, removed}`, log; **reject khi job ném**,
      R-64), `isReloading`, `broadcastReloadNotification`, `handleExtensionError` (`EXTENSIONS_MUST_LOAD`); action
      `extensions.load`/`unload`; watcher chokidar khi `EXTENSIONS_AUTO_RELOAD` (debounce 500/650/2000);
      `registerApiExtensions` gọi các hàm đăng ký (thân ở T038, T040, T041, T082); test
      `api/extensions/manager.test.ts` (dedupe, reject R-64, settings lookup theo `(source, folder)`, MUST_LOAD, watcher:
      chokidar giả + timer giả, thêm/đổi/xóa thư mục kích reload sau 500/650/2000 ms, tắt khi `EXTENSIONS_AUTO_RELOAD=false`)
- [X] T022 Nối vào app (research R3): `api/app.ts` gọi `getExtensionManager().initialize()` ngay trước
      `flowManager.initialize()` và `onServerShutdown(() => manager.unload())` trước `flowManager.unload`;
      `api/extensions/extensions.module.ts` (Nest module, `onModuleInit` gọi `express.use(manager.getEndpointRouter())`
      — chạy sau route controller, trước 404 của `nest.init()`), đăng ký trong `api/app.module.ts`; test
      `api/extensions/mount.test.ts`: route hệ thống thắng endpoint trùng tên, endpoint tới được, 404 sau gỡ
- [X] T023 `services/index.ts` và context (FR-010, D-141): thêm export `AuthenticationService`, `ExtensionsService`,
      `ExtensionReadError`, `GraphQLService`, `ServerService`, `SettingsService`, `SpecificationService`, `TFAService`,
      `UtilsService`; context `services` cấp qua getter lười trong manager (tránh vòng import qua `server.service`);
      `api/services/mail.service.ts` (`MailService` cùng chữ ký Directus; `send` phát filter `email.send` rồi log như
      D-33/D-34); script `tools/extract-service-signatures.mjs` (TS compiler API: export × constructor × method công khai
      của `D/api/services/index.ts` và `api/services/index.ts`) + `tools/extract-service-signatures.test.ts` (bằng nhau
      trừ D-141), chạy trong `test:tools`
- [X] T024 `api/services/extensions.service.ts` port đủ `D/api/services/extensions.ts` trừ install/uninstall/reinstall
      (lượt 3): `readAll` (chờ `isReloading()`, entries bundle), `readOne`, `updateOne` (transaction, `"meta" is required`,
      `checkBundleAndSyncStatus`, 422, sau commit `reload().then(broadcast)` không chờ), `deleteOne`, `ExtensionReadError`;
      GIỮ `EMPTY_APP_EXTENSION_BUNDLE` và route `sources` hiện có tới T142 (lượt 2); `api/controllers/extensions.controller.ts`: `PATCH /:pk` (204 khi
      `ExtensionReadError` bọc Forbidden), `DELETE /:pk` thật, bỏ 403 của D-37 (cài/gỡ vẫn 503 tới lượt 3);
      `api/services/graphql/resolvers/system-admin.ts` `update_extensions_item` gọi `updateOne` rồi `readOne`, type
      `directus_extensions` như `D/api/services/graphql/resolvers/system-admin.ts:262-280`; test service + controller
      (sửa `extensions.controller.test.ts:163,205`)
- [X] T025 Parity của T024 (FR-031..FR-036): `parity/src/extensions/list.test.ts` (`GET /extensions`: schema, entries,
      dòng missing sau khi đổi tên thư mục; chunk lạ 404), `toggle.test.ts` (`PATCH` bật tắt, bundle ↔ entry, 422,
      `DELETE /:pk`, so `directus_extensions`), `graphql.test.ts` (`extensions` có và không có `name`,
      `update_extensions_item`); `parity/accepted-differences.ts`: entry D-37 http thu hẹp còn `POST
      /extensions/registry/install`, `/reinstall`, `DELETE /extensions/registry/uninstall/*`, và entry D-137 tạm (`GET /extensions/sources/*` body/status: app mới
      bundle rỗng, Directus bundle bộ mẫu; gỡ ở T142); sửa
      `parity/src/system/extensions.test.ts:88-135` (PATCH/DELETE nay giống Directus), `parity/src/graphql/system.test.ts:
      151-163`, `tests/directus-app-e2e/src/system.spec.ts:243-283`; spec 010 bảng D-37 cột "Gỡ ở" ghi "thu hẹp ở 020
      lượt 1, gỡ ở 020 lượt 3"

- [X] T026 [P] Benchmark không extension (SC-005, analyze G1): `tests/benchmark/docker-compose.yml` ghi đè env của
      `directus`, `backoffice-api` bỏ `EXTENSIONS_LOCATION` (và `minio-init` không chép bộ mẫu) cho mọi job; chỉ target
      `web-extensions` (T149) bật lại bằng env file riêng `tests/benchmark/env/extensions.env`; kiểm `GET /extensions`
      rỗng trên env benchmark mặc định

**Checkpoint**: manager nạp bộ mẫu không đăng ký gì (thân đăng ký ở story), `/extensions` trả schema thật, parity
list/toggle/graphql xanh.

---

## Phase 3: User Story 1 - Hook, endpoint, operation đã build cho Directus chạy trên API mới (Priority: P1) 🎯 MVP — Lượt 1

**Goal**: extension API trong bộ mẫu chạy giống Directus trên API mới (FR-010..FR-019).

**Independent Test**: `env-up --profiles=app,multi,extensions`; `nx run parity-tests:parity -- src/extensions/{hooks,
endpoints,operations,must-load}` xanh; so `bo_ext_log` hai app.

### Tests cho User Story 1

- [X] T030 [P] [US1] `api/extensions/manager.hook.test.ts`: `register` có `filter/action/init/schedule/embed`; context có
      `services, env, database, emitter (riêng), logger, getSchema`; `init` gỡ bằng `offInit(event)` (R-61); `schedule`
      gọi `scheduleSynchronizedJob('<name>:<index>', cron)`, cron sai → `handleExtensionError`; `embed` rỗng → lỗi
      "Provided code is empty"
- [X] T031 [P] [US1] `api/extensions/manager.endpoint.test.ts`: mount `/<id>` (tên thư mục bỏ phần sau `:` khi config
      là hàm), `req.accountability`/`req.schema` có, `req.query` lồng (qs), gỡ → layer biến khỏi `endpointRouter.stack`
- [X] T032 [P] [US1] `api/extensions/manager.operation.test.ts`: `flowManager.addOperation(id, handler)`/`removeOperation`,
      bundle chỉ đăng ký entry `enabled` theo `(source, folder = entry.name, bundle = id)`
- [X] T033 [P] [US1] `parity/src/extensions/hooks.test.ts` (US1-1, US1-4, US1-5): tạo/sửa/xóa `bo_ext_items`, đăng nhập,
      upload file, tạo field tạm, mọi request gửi header `x-bo-ext-trace: <tiền tố app>` → so chuỗi tên event và payload
      `parity-hook-audit` ghi ở `bo_ext_log` giữa hai app; filter `audited` có trong item; header `x-bo-ext: 1` trên một route bất kỳ; schedule (cặp profile `extensions`, `BO_EXT_SCHEDULE=1`):
      chờ 3 phút đếm 3 dòng `tick` trên toàn hệ thống (cả hai app cùng chạy); embed: entry doc D-138
- [X] T034 [P] [US1] `parity/src/extensions/endpoints.test.ts` (US1-2): `/parity-endpoint-demo` GET/POST có và không có
      token; `/parity-endpoint-express4/*` mỗi route mỗi mục D-139 với kết quả mong đợi của spec (ca async: timeout 5 s
      cho Directus); entry `D-139` trong `parity/accepted-differences.ts` theo từng route
- [X] T035 [P] [US1] `parity/src/extensions/operations.test.ts` (US1-3): flow thủ công tạm dùng `parity-operation-slack`,
      chạy `POST /flows/trigger/<id>`, so `$last`, `directus_revisions` của flow; gỡ operation (PATCH tắt) → lỗi như 009
- [X] T036 [P] [US1] `parity/src/extensions/must-load.test.ts` (US1-6): chạy container Directus và Backoffice profile
      `extensions` với thư mục extension hỏng (manifest sai) chép riêng; `EXTENSIONS_MUST_LOAD=false` → `/server/health`
      ok + log cảnh báo cùng nội dung; `true` → container thoát mã khác 0

### Implementation cho User Story 1

- [X] T037 [US1] Event init (FR-012, research R3 bảng): `api/app-pipeline.ts` `createExpressApp` thành async,
      `await emitter.emitInit('app.before'|'middlewares.before', {app})` sau HSTS, `'middlewares.after'|'routes.before'`
      sau `beforeRoutes`; `api/extensions/extensions.module.ts` phát `routes.custom.before`/`after` quanh mount;
      `api/app.ts` phát `routes.after` sau `nest.init()`, `app.after` sau `startSchedules()`; sửa mọi chỗ gọi
      `createExpressApp`; `api/app-init-events.test.ts` kiểm thứ tự 8 event
- [X] T038 [US1] `registerHook` trong `api/extensions/manager.ts` (port `manager.ts:885-972`; `localEmitter`,
      `scheduleSynchronizedJob` của `api/utils/schedule.ts`, `offInit(event)` R-61, embed head/body); `registerHookExtension`
      (import `importFileUrl(..., {fresh: true})`, `getModuleDefault`, unregister + `deleteFromRequireCache`)
- [X] T039 [US1] Thứ tự filter (FR-011, R-62): test `api/extensions/manager.order.test.ts` (filter extension chạy trước
      filter flow lúc khởi động; sau reload chạy sau, ghi R-62)
- [X] T040 [US1] `registerEndpoint` + `registerEndpointExtension` (port `manager.ts:977-1002`; `express.Router()` của
      Express 5; context như hook; gỡ lọc `endpointRouter.stack`); không cache (FR-016 ghi chú)
- [X] T041 [US1] `registerOperation` + `registerOperationExtension` (`entrypoint.api`) + `registerBundleExtension`
      (`manager.ts:801-862`, luôn in-process) trong `api/extensions/manager.ts`; reload flow qua bus `flows` (FR-018)
- [X] T042 [US1] D-139 chốt (CHK026): chạy T034 trên hai app, ghi kết quả thật từng mục vào bảng D-139 của
      `specs/020-extensions/spec.md` và research R12 (bỏ [Unverified] nếu khớp); mục đổi → ghi "owner duyệt lại khi đóng"

**Checkpoint**: US1 xanh trên cặp chính; extension API của bộ mẫu chạy như Directus.

---

## Phase 4: User Story 2 - Nhiều instance: cài ở một node, mọi node thấy (Priority: P1) — Lượt 1

**Goal**: sync từ `EXTENSIONS_LOCATION`, reload qua bus, readiness, compose/Helm (FR-040..FR-052). Cài qua registry
(US2-1, US2-2 bản registry) bổ sung ở lượt 3 (T177).

**Independent Test**: `nx run parity-tests:parity -- src/extensions/multi`; `nx run parity-tests:deploy`;
`deploy/helm/backoffice/ci/test-template.sh`; job `deploy-k8s`.

### Tests cho User Story 2

- [X] T060 [P] [US2] Port test `D/api/extensions/lib/sync/{sync,status,tracker,utils}.test.ts` →
      `api/extensions/lib/sync/`; thêm ca: khởi động xóa khóa `extensions-sync/<machineId>` cũ của chính máy (R6), sync lỗi
      lúc khởi động → `process.exit(1)` (mock)
- [X] T061 [P] [US2] `parity/src/extensions/multi.test.ts` (8155, 8156, 8157): `PATCH` tắt `parity-endpoint-demo` ở 8156
      → 8155, 8157 trả 404 trong 10 s (SC-003, mốc response); chép thư mục extension mới lên MinIO bằng
      `@aws-sdk/client-s3`, `PATCH` một extension khác → mọi node sync và có endpoint mới, `directus_extensions` có đúng
      một dòng cho nó (R-58); tắt hook ở 8157, tạo item qua 8156 → không có log hook (US2-3); schedule 5 lượt = 5 dòng
      (US2-4; cặp profile `extensions` + một container Backoffice thứ hai cùng env, `BO_EXT_SCHEDULE=1`)
- [X] T062 [P] [US2] `parity/src/deploy/extensions.test.ts` (compose 3 BE + Directus, `EXTENSIONS_LOCATION=s3`): ca của
      T061 qua cổng riêng từng replica (env deploy test đặt `BO_EXT_SCHEDULE=1` cho ca schedule); container start → `/server/health` ok ≤ 60 s với bộ mẫu (FR-048);
      `compose up --scale backoffice-api=5` rồi gọi `/parity-endpoint-demo` vào replica mới ngay khi healthy (US2-5);
      chế độ `DEPLOY_MODE=separate-domain` chạy cùng ca
- [X] T063 [P] [US2] Helm CI: `deploy/helm/backoffice/ci/deps.yaml` ConfigMap `EXTENSIONS_LOCATION: s3`;
      `ci/test-template.sh` bộ `good` thêm `EXTENSIONS_LOCATION`, `expect_fail` khi thiếu với HPA bật (mặc định) và với
      `api.replicas=2` không HPA, `expect_ok` với `extensions.inImage=true`, kiểm path Ingress `/extensions/sources` tới
      Service `-api-only`; `ci/kind-test.sh`: `PATCH` tắt `parity-endpoint-demo` qua Directus pod rồi gọi qua Ingress tới
      ≥ 3 pod (404), bật lại (200), scale HPA và gọi lại

### Implementation cho User Story 2

- [X] T064 [US2] Port `D/api/extensions/lib/sync/{sync,status,tracker,utils}.ts` → `api/extensions/lib/sync/` (storage
      `getStorage().location(EXTENSIONS_LOCATION)`, `useLock`, `useBus`, `node-machine-id`); `initialize()` xóa khóa cũ của
      máy mình trước sync `forceSync` (R6, một process mỗi container); nối vào `load()` của T021
- [X] T065 [US2] Readiness (FR-048): xác nhận `createApp` (gồm `initialize`) xong trước `listen` (`api/server.ts`); test
      `api/server.extensions.test.ts` (health chỉ trả sau khi manager loaded)
- [X] T066 [P] [US2] Compose (contracts/deploy.md §1): `deploy/compose/.env.example` `EXTENSIONS_LOCATION=s3`;
      `deploy/compose/lb/shared-domain.conf` `upstream bo_pool` + `location ^~ /extensions/sources/` + `@retry_bo`;
      `deploy/compose/docker-compose.yml` service `registry` (profile `extensions-test`, mount
      `tests/parity/registry`); `deploy/README.md` mục "Extensions" đủ các ý của contracts/deploy.md §1 (cùng
      `EXTENSIONS_PATH`/`EXTENSIONS_LOCATION`, `module`, đóng sẵn, "Nâng cấp từ 019", runbook crash, node lệch R-65, không
      `EXTENSIONS_AUTO_RELOAD`, một process mỗi container, self-check); `tests/parity/src/proxy-conf.test.ts` giữ xanh
- [X] T067 [P] [US2] Helm (contracts/deploy.md §2): `values.yaml` `extensions.inImage: false`;
      `templates/api-only-service.yaml`; `templates/ingress.yaml` path `/extensions/sources` trước `/admin`, `/`;
      `templates/_checks.tpl` reason mới (FR-045, chặn cả upgrade); `templates/NOTES.txt` dòng route + "Nâng cấp từ 019"

**Checkpoint**: lượt 1 phần API + nhiều instance xanh ở `parity`, `deploy`, `deploy-k8s`.

---

## Phase 5: User Story 7 - Extension API sandboxed (Priority: P2) — Lượt 1

**Goal**: extension `sandbox.enabled` chạy trong isolate với scope, giới hạn bộ nhớ, thời gian (FR-020..FR-026).

**Independent Test**: `nx run parity-tests:parity -- src/extensions/sandbox`; unit `api/extensions/lib/sandbox`.

- [X] T080 [P] [US7] Unit `api/extensions/lib/sandbox/**/*.test.ts`: scope `log`/`sleep`/`request` (thông điệp lỗi như
      `D/api/extensions/lib/sandbox/sdk/generators/*.ts`), URL glob, method, import khác `directus:api` bị từ chối, timeout,
      `RangeError` → log + `process.abort()` (mock), `process.env` chỉ `NODE_ENV`, dispose isolate khi gỡ
- [X] T081 [P] [US7] `parity/src/extensions/sandbox.test.ts`: hook/endpoint/operation sandboxed (US7-1..4), URL trong scope
      nhưng IP bị `IMPORT_IP_DENY_LIST` chặn, tải nền autocannon 30 s/10 kết nối ≥ 1.000 request vào `/server/ping` và
      `GET /items/bo_ext_items` trong lúc ca vượt thời gian chạy: 0 non-2xx (SC-004)
- [X] T082 [US7] Port 17 file `D/api/extensions/lib/sandbox/**` → `api/extensions/lib/sandbox/**` (entrypoint, host
      reference, `register/*`, `sdk/{index,instantiate,sdk}.ts`, `sdk/generators/*`, `sdk/utils/*`; `getAxios()` của
      `api/request/index.ts`, `numberGenerator` của T013); `registerSandboxedApiExtension` trong
      `api/extensions/manager.ts` (port `:616-674`)

---

## Phase 6: User Story 5 - Settings > Extensions: xem, bật tắt, cài lại, gỡ (Priority: P2) — Lượt 1 (T096: lượt 3)

**Goal**: màn `/settings/extensions` như Directus (FR-083..FR-085); notice "reload required" (lượt 1, CHK034).

**Independent Test**: `E2E_CONFIG=<cfg> nx run web-e2e:e2e -- settings-extensions` ba cấu hình; payload
`payload/extensions.spec.ts` ở `proxy-api`.

### Tests cho User Story 5

- [X] T090 [P] [US5] `web/stores/extensions.test.ts`: `refresh` (so id extension app/hybrid bật trước/sau → notice
      persist `reload-required` với nút reload), `toggleState` (`PATCH {meta: {enabled: !enabled}}`), `remove`, rồi
      `refresh`; `web/modules/settings/routes/extensions/ExtensionsRoute.test.ts`: nhóm theo `schema.type`, `missing`,
      bundle con lồng, trạng thái partial, menu theo nguồn (uninstall khóa khi không phải registry), không hộp xác nhận
- [X] T091 [P] [US5] Sửa test ghim D-93: `web/modules/settings.test.ts:76-83`, `web/modules/settings/components/
      SettingsNavigation.test.ts:26-37`; `e2e/requests.spec.ts:43` (cho phép `/extensions*` theo allowlist);
      `web/test-utils/fetch.ts` `KNOWN_REQUESTS` và `e2e/helpers/allowed-paths.ts` thêm #204–#208, #213 (contracts/web.md §7)

### Implementation cho User Story 5

- [X] T092 [US5] `web/composables/use-notices.ts` `NoticeRaw` thêm `id`, `icon`, `closeable`, `showReload`, `progress`,
      `loading`, `alwaysShowText`, `dismissIcon`, `dismissText`, `dismissAction` (notify với `id` có sẵn thì không thêm
      trùng); `NoticeStack` vẽ nút dismiss theo `dismissIcon`/`dismissText`/`dismissAction`; test
- [X] T093 [US5] Port `D/app/stores/extensions.ts` → `web/stores/extensions.ts` (`apiFetch`; notice qua `notify`, D-66)
- [X] T094 [US5] Port `D/app/modules/settings/routes/extensions/{extensions.vue,constants.ts,types.ts,components/
      {ExtensionItem,extension-item-options,extension-group-divider}.vue}` → `web/modules/settings/routes/extensions/
      {ExtensionsRoute.vue,constants.ts,types.ts,components/{ExtensionItem,ExtensionItemOptions,ExtensionGroupDivider}.vue}`
      theo recipe Q-41 (T003); `web/modules/settings.ts` route `settings-extensions`; `SettingsNavigation.vue` nhóm 4 mục
      `category` Extensions (Marketplace ở T175); khóa vi-VN thiếu vào `web/lang/overlay/vi-VN.ts`; `web/lang/keys.test.ts`
      thêm thư mục
- [ ] T095 [US5] E2E `e2e/settings-extensions.spec.ts` (ba cấu hình: danh sách, nhóm, bundle lồng, bật tắt + notice, remove
      dòng missing tạo bằng đổi tên thư mục trên MinIO); `e2e/payload/extensions.spec.ts` + `e2e/helpers/db-rows.ts`
      `EXTENSIONS_TABLES = ['directus_extensions']` (so với Directus app 8155 cùng thao tác); `e2e/settings-parity-ui.spec.ts:
      77-78`; `e2e/a11y.spec.ts` thêm màn
- [X] T096 [US5] (lượt 3, sau T174) Menu `uninstall`, `reinstall` gọi thật (#207, #208); E2E `settings-extensions.spec.ts`
      thêm ca uninstall/reinstall qua fake registry
- [ ] T097 [US5] Đóng lượt 1: `pnpm nx run-many -t lint,typecheck,test,build`, `check-port-headers`, parity đủ
      (`--profiles` như CI + `multi,extensions`), `deploy` hai chế độ, `test-template.sh`; ghi "Ghi chú khi làm" cuối file
      này; commit (nhắn phiên khác trước/sau push), theo dõi CI tới xanh

**Checkpoint**: lượt 1 lên `main`.

---

## Phase 7: User Story 8 - Shim `v-*` khớp Directus, đúng design-system và a11y (Priority: P2) — Lượt 2

**Goal**: 77 component, 3 view, 7 directive, 4 inject, `--theme--*` (FR-073..FR-082, data-model §7, §8).

**Independent Test**: `cd apps/web && pnpm exec vitest run src/directus-shim` (contract + unit) và `--project browser
src/directus-shim` (axe, bàn phím).

### Chuẩn bị lượt 2

- [ ] T100 [US8] Hạ `pinia` 3.0.3 → 2.3.1 (catalog) và thêm vào `apps/web/package.json` `axios`, `@directus/composables`,
      `semver`, `@vueuse/router`; grep `defineStore(`, `storeToRefs`, `acceptHMRUpdate` tìm API chỉ có ở pinia 3, sửa nếu
      có; chạy toàn bộ `web:test` + E2E `navigation`, `content-*` một cấu hình (CHK039)
- [X] T101 [P] [US8] Recipe nháp Q-44 (component mới của shim, `BoPopover`, dialog không tiêu đề, select nhóm/divider, thang
      z-index và ca lồng, ảnh sáng/tối), Q-45 (`PrivateView` 11 slot/7 prop trên khung D-127/D-128, `PublicView`,
      `SharedView`), Q-46 (173 `--theme--*` + `.type-*`, `.form-grid` sang token) vào `design-system/docs/{component-specs,
      layout-patterns}.md`
- [X] T102 [P] [US8] `apps/web/scripts/extract-directus-components.mjs` (`@vue/compiler-sfc` + `typescript`: props tên/
      kiểu/mặc định, emits, slot `<slot name>` và slot props, `defineExpose`, của mọi file trong `D/app/components/
      register.ts`, `D/app/views/register.ts`, `D/app/directives/register.ts`) → `apps/web/fixtures/
      directus-components.json`; `apps/web/scripts/extract-directus-components.test.ts` sinh lại và so byte

### Tests cho User Story 8

- [X] T103 [US8] `web/directus-shim/contract.test.ts` (đỏ trước): mọi tên đăng ký toàn cục có; props/emits/slots/expose
      khớp JSON trừ danh sách `IGNORED` kèm lý do (data-model §7: `DrawerItem.overlay`, `popoverProps`,
      `VForm.collabContext`, …); slot đọc từ template shim

### Implementation cho User Story 8

- [X] T104 [US8] `web/api/axios.ts` (port `D/app/api.ts`: `baseURL = getApiUrl()`, `withCredentials`, interceptor
      `requestsStore.startRequest` + `requestQueue` + `sdk.getToken()`, `endRequest`); `web/directus-shim/use-system.ts`
      (port `D/app/composables/use-system.ts`: 14 store, `API_INJECT`, `SDK_INJECT`, `EXTENSIONS_INJECT`); test
- [X] T105 [US8] Thành viên store thiếu (FR-079): `web/stores/notifications.ts` (`queue`, `dialogs`, `previous`,
      `notifications`, `overlayIsActive`, `lastFour`, `setOverlayIsActive`, `add` → `notify`, `hide`, `remove`, `update`),
      `web/stores/server.ts` (`info.extensions`, `ai_enabled`/`mcp_enabled` `false`), `web/stores/settings.ts`
      (`availableAiProviders` `[]`), `web/hydrate.ts` (`appStore.basemap`); test từng store
- [X] T106 [P] [US8] Port 7 directive `D/app/directives/{click-outside,context-menu,focus,prevent-focusout,
      input-auto-width,markdown,tooltip}.ts` → `web/directus-shim/directives/`; `web/utils/markdown.ts` thêm tùy chọn
      `target`; tooltip một `#tooltip` chung, delay 500/125 ms, modifier, RTL, style token; test từng directive
- [X] T107 [P] [US8] `web/directus-shim/styles/theme-vars.css` (173 `--theme--*` + 11 biến app dùng không khai +
      `_variables.scss` + palette `--{color}{,-10..-190}` + `.type-*` + `.form-grid` theo data-model §8, Q-46), đè
      `theme_*_overrides` như 012; test đọc schema `D/pkg/types/src/extensions/themes.ts` và kiểm đủ tên
- [X] T108 [P] [US8] `apps/web/index.html` thêm `#dialog-outlet`, `#menu-outlet` sau `#app` (z-index theo Q-44); component
      dùng chung mới `web/components/BoPopover.vue` (Reka Popover, slot activator/default, `v-model:open`), `BoDialog` thêm
      chế độ không tiêu đề, `BoSelect` thêm `children`/nhóm/divider/`itemIcon`/`itemColor`; browser test + axe
- [X] T109 [P] [US8] Shim "cùng hợp đồng" (13, data-model §7): `VFieldList`, `VDatePicker`, `VErrorBoundary`,
      `RenderDisplay`, `RenderTemplate`, `ExportSidebarDetail`, `SidebarDetail`, `UserPopover`, `ValueNull`, `DrawerFiles`,
      `DrawerBatch`, … đăng ký thẳng component sẵn có trong `web/directus-shim/register.ts`
- [X] T110 [P] [US8] Shim nhóm nút/biểu tượng: `VButton` (mở rộng `BoButton`), `VIcon` (mở rộng `BoIcon`), `VChip`
      (mở rộng `BoChip`), `VBadge`, `VAvatar`, `VIconFile`, `VImage`, `VHighlight`, `VHover` (mới) trong
      `web/directus-shim/components/`; browser test + axe từng cái
- [X] T111 [P] [US8] Shim nhóm nhập liệu: `VInput`, `VTextarea`, `VCheckbox`, `VCheckboxTree`, `VSlider`, `VSelect`,
      `VFancySelect`, `VUpload`, `VRemove` (mở rộng `Bo*`), `VRadio`, `VTemplateInput`, `VFieldTemplate`,
      `VCollectionFieldTemplate`, `VEmojiPicker` (mới; thư viện emoji như Directus); browser test + axe
- [X] T112 [P] [US8] Shim nhóm lớp phủ: `VMenu` (trên `BoPopover`, expose `activator/id/activate/deactivate`), `VDialog`,
      `VDrawer` (mở rộng `BoDrawer`), `VOverlay`, `TransitionBounce`, `TransitionDialog`, `TransitionExpand` (port
      `expand-methods.ts`); focus theo FR-077 (Esc lớp trên cùng, trả focus); browser test + axe (ca lồng với Bo)
- [X] T113 [P] [US8] Shim nhóm danh sách/tab/thẻ: `VList`, `VListItem`, `VListGroup`, `VListItemContent`, `VListItemHint`,
      `VListItemIcon`, `VItemGroup`, `VItem` (`useGroupable` của `@directus/composables`), `VTabs`, `VTab`, `VTabsItems`,
      `VTabItem`, `VCard`, `VCardTitle`, `VCardSubtitle`, `VCardText`, `VCardActions`, `VSheet`, `VDivider`, `VDetail`;
      browser test + axe
- [X] T114 [P] [US8] Shim nhóm phản hồi/dữ liệu: `VNotice`, `VInfo`, `VError`, `VSkeletonLoader`, `VProgressCircular`,
      `VProgressLinear`, `VPagination`, `VTable` (map `headers`/`items`/`itemKey`, chọn object dòng khi
      `selectionUseKeys=false`), `VTextOverflow`, `VBreadcrumb`, `VResizeable` (tay cầm có bàn phím), `VWorkspace`,
      `VWorkspaceTile`, `VForm` (`inline`), `DrawerCollection` (chuyển mọi slot), `DrawerItem`; browser test + axe
- [X] T115 [US8] View (FR-073, FR-074, Q-45): `web/directus-shim/views/{PrivateView,PublicView,SharedView}.vue`;
      `web/layout/PageHeader.vue` thêm slot `title-outer:prepend`, `title:prepend`, `title:append`, `actions:prepend`,
      `actions:append`; `web/layout/PrivateView.vue` `provide('main-element')`; `web/layout/DetailPanel.vue` bọc
      `AccordionRoot`; `web/layout/PublicView.vue` thêm `wide`; test
- [X] T116 [US8] `web/directus-shim/register.ts` (`registerShims(app)`: 77 + 3 + 7, PascalCase) chỉ được import động khi
      bundle có extension app; T103 xanh; `apps/web/scripts/check-bundle.mjs` `BUDGET_020` (bundle chính ≤ `BUDGET_019`
      + 3 KB gzip), chunk shim ≤ 150 KB gzip

**Checkpoint**: contract test 77/77 + 3/3 + 7/7 + 4/4 xanh, axe 0 vi phạm.

---

## Phase 8: User Story 3 - Interface, display, layout, panel, operation app chạy trong app mới (Priority: P1) — Lượt 2

**Goal**: API dựng bundle, web nạp qua import map, registry lúc chạy (FR-060..FR-069).

**Independent Test**: `E2E_CONFIG=<cfg> nx run web-e2e:e2e -- extensions-app` ba cấu hình + payload ở `proxy-api`.

### Tests cho User Story 3

- [X] T140 [P] [US3] `api/extensions/bundle.test.ts`: dựng từ bộ mẫu, chunk import bare `vue`/`pinia`/
      `@directus/extensions-sdk` (không alias), extension tắt bị bỏ, entry bundle theo `enabled`, tên chunk ổn định giữa
      hai lần dựng cùng bộ file, dựng lỗi lần đầu → `getAppExtensionChunk()` null (R-63)
- [X] T141 [P] [US3] Web: `web/extensions.test.ts` (URL `${apiUrl}extensions/sources/index.js`, lỗi → warn, gộp nội bộ +
      extension, `useExtensions`, `themes` rỗng), test `register*` của năm registry, `apps/web/vite-plugin-extensions.test.ts`
      (build nhỏ: 5 file `*.entry.js`, import map trước module script, `preserveEntrySignatures`)

### Implementation cho User Story 3

- [X] T142 [US3] `generateExtensionBundle` + `getAppExtensionChunk` trong `api/extensions/manager.ts` (rollup/rolldown,
      `virtual` + `nodeResolve({browser: true})`, `external: APP_SHARED_DEPS`, `TEMP_PATH/app-extensions`, luôn dựng,
      D-137); bỏ `EMPTY_APP_EXTENSION_BUNDLE`; `api/controllers/extensions.controller.ts` `sources/:chunk` whitelist + header;
      `parity/src/extensions/list.test.ts` thêm ca sources (status/header; body khác: entry `D-137` chuyển từ tạm sang
      lâu dài, chỉ body)
- [X] T143 [US3] `apps/web/vite.config.ts` plugin `backoffice-extensions-build` (input 5 shared dep, `entryFileNames:
      'assets/[name].[hash].entry.js'`, `preserveEntrySignatures`, chèn import map ở `generateBundle`; dev chèn ở
      `transformIndexHtml`); `web/extensions/sdk.ts` (module `@directus/extensions-sdk`, contracts/web.md §3); T020 của
      research: kiểm bằng Playwright (a) CSP không hash chặn import map, (b) dev Vite nạp được extension; ghi kết quả vào
      research (mục "Kết quả T143")
- [X] T144 [US3] CSP image web (FR-062): `apps/web/docker/40-config.sh` đọc import map trong `index.html`, tính sha256
      base64; `apps/web/docker/csp.awk` thêm `'sha256-…'` và origin `PUBLIC_URL` tuyệt đối vào `script-src`;
      `apps/web/docker/web-image.test.ts` thêm ca
- [X] T145 [US3] `web/extensions.ts` (port `D/app/extensions.ts`); `web/main.ts` thứ tự `loadExtensions` →
      (`registerShims` nếu có extension app) → `registerExtensions` → `useSystem` → `app.use(router)`; `web/hydrate.ts`
      `onHydrateExtensions`/`onDehydrateExtensions`
- [X] T146 [US3] Registry lúc chạy: `web/{interfaces,displays,layouts,panels,operations}/index.ts` thêm `register*`, giữ
      `get*`; `web/composables/use-extension.ts` mọi loại; `web/stores/insights.ts` đọc panel từ registry; bọc
      `ErrorBoundary` (fallback notice `unexpected_error`, FR-067) ở `FormFieldInterface.vue`, `RenderDisplay.vue`,
      wrapper layout (`web/layouts/use-layout.ts`), `PanelTile.vue`, `ExtensionOptions.vue`, `OperationDetail.vue`; test
- [X] T147 [US3] E2E `e2e/extensions-app-{interface,display,layout,panel,operation}.spec.ts` ba cấu hình (US3-1..7, gồm
      user không phải admin); payload so Directus app ở `proxy-api`; `e2e/helpers/allowed-paths.ts` #213 cho chunk
- [X] T148 [US3] Acceptance chunk chéo replica (FR-051, FR-047): `parity/src/deploy/extensions.test.ts` thêm `index.js` từ
      replica 1 và chunk nó import từ replica 2 cùng nội dung; gọi `index.js` 20 lần qua lb chung domain, đọc log upstream
      của lb (`lbLog`): không lần nào vào `directus:8055`; `ci/kind-test.sh` kiểm endpoints của Service `-api-only` không có
      pod Directus; `parity/src/extensions/multi.test.ts` thêm ca tương tự 8156/8157
- [X] T149 [US3] Benchmark (FR-096, SC-006): `tests/benchmark/src/web-shared.ts` (gộp `signIn`, `track`, `p95`, `usual` của
      `web-content.ts`, `web-files-users.ts`, bỏ ghi chú `shortcut:`), `tests/benchmark/src/web-extensions.ts`, target
      `web-extensions` ở `tests/benchmark/project.json`, bước mới trong `.github/workflows/benchmark.yml` job
      `benchmark-web` (`if: ${{ !cancelled() }}`)

---

## Phase 9: User Story 4 - Module extension có route riêng và mục trong sidebar (Priority: P2) — Lượt 2

**Goal**: module extension có route, mục sidebar theo `module_bar`, trang trong khung TailAdmin (FR-070..FR-074).

**Independent Test**: `E2E_CONFIG=<cfg> nx run web-e2e:e2e -- extensions-app-module`.

- [X] T160 [P] [US4] `web/modules/index.test.ts` (module extension đăng ký, `preRegisterCheck`, trùng id module nội bộ →
      giữ nội bộ + warn, R-67) và `web/interfaces/_system/system-modules/modules.test.ts` (`useAllModules` có module
      extension, `OUT_OF_SCOPE_MODULES` vẫn ẩn)
- [X] T161 [US4] `web/modules/index.ts` nhận danh sách nội bộ + extension; `web/interfaces/_system/system-modules/
      modules.ts` `useAllModules` lấy từ `web/extensions.ts`; `web/layout/AppSidebar.vue` hiện module extension theo
      `module_bar`
- [X] T162 [US4] E2E `e2e/extensions-app-module.spec.ts` (bật `parity-module-report` ở Settings > Appearance, mục sidebar,
      route, slot `navigation`/`actions`/`sidebar` của `private-view` vào sub-menu, page header, popover chi tiết)
- [ ] T163 [US4] Đóng lượt 2: như T097 + `e2e-web` ba cấu hình; commit, theo dõi CI tới xanh

---

## Phase 10: User Story 6 - Marketplace: duyệt registry, xem chi tiết, cài (Priority: P2) — Lượt 3

**Goal**: cài, cài lại, gỡ từ registry (API + màn Marketplace), gỡ hẳn D-37 và D-93 (FR-037..FR-039, FR-086..FR-088).

**Independent Test**: `nx run parity-tests:parity -- src/extensions/install` (profile `extensions`); E2E
`settings-marketplace`, `extensions-cross-use`.

### Tests cho User Story 6

- [X] T170 [P] [US6] Recipe nháp Q-42, Q-43 (registry, trang extension, trang tài khoản, trạng thái nạp/nạp lại/lỗi/rỗng)
      vào `design-system/docs/component-specs.md`
- [X] T171 [P] [US6] Fake registry: `parity/registry/server.mjs` thêm `GET /download/:versionId[?sandbox=true]` trả `.tgz`
      của `fx/` (404 khi `sandbox=true` mà extension không sandbox); `parity/registry/fixtures/{list,describe}.json`
      thêm `…0006..0013`; `api/extensions/registry/fixtures.test.ts` giữ xanh
- [X] T172 [P] [US6] Unit: port `D/api/extensions/lib/installation/manager.test.ts`; `api/extensions/lib/installation/
      tarball-safety.test.ts` (tarball có đường dẫn tuyệt đối, `..`, symlink ra ngoài: không file nào ngoài thư mục tạm,
      R-68); service `preInstall` (limit, `points`), `install` (dòng cha + con), `uninstall`/`reinstall` (400 các ca)
- [X] T173 [P] [US6] `parity/src/extensions/install.test.ts` (profile `extensions`): install/reinstall/uninstall qua fake
      registry, `LIMIT_EXCEEDED`, tải lỗi 503, so `directus_extensions` và thư mục trên MinIO; gỡ entry D-37 khỏi
      `parity/accepted-differences.ts`; sửa `parity/src/system/extensions.test.ts`, `tests/directus-app-e2e/src/
      system.spec.ts` phần install

### Implementation cho User Story 6

- [X] T174 [US6] API: port `@directus/extensions-registry` `download` → `api/extensions/registry/download.ts` (+ export
      `index.ts`); `D/api/extensions/lib/installation/{index,manager}.ts` → `api/extensions/lib/installation/`;
      `install`/`uninstall` trong manager (broadcast `partialSync`, reload `skipSync`, action); service `preInstall`,
      `install`, `uninstall`, `reinstall`; controller bỏ `NO_INSTALL`; spec 010 D-37 ghi "gỡ ở 020"
- [X] T175 [US6] Web: port `D/app/modules/settings/routes/marketplace/**` → `web/modules/settings/routes/marketplace/
      {RegistryRoute,ExtensionRoute,AccountRoute}.vue` + components + `utils/format-name.ts` theo Q-42, Q-43
      (`useRouteQuery`, `semver`, sparkline apexcharts, readme `v-md` với `target`); routes `marketplace`,
      `marketplace-registry`, `marketplace-account`, `marketplace-extension` ở `web/modules/settings.ts`; mục `storefront`
      Marketplace ở `SettingsNavigation.vue`; allowlist #209–#212; khóa vi-VN; test route và component
- [X] T176 [US6] E2E `e2e/settings-marketplace.spec.ts` ba cấu hình (tìm, lọc, sắp, trang, extension: compat, install →
      Settings > Extensions, limit khóa nút R-60; account); `e2e/extensions-cross-use.spec.ts` (US2-7, US6-4) vào
      `DIRECTUS_APP_SPECS`
- [X] T177 [US6] Acceptance cài qua registry (US2-1, US2-2): `parity/src/deploy/extensions.test.ts` bật service `registry`
      (`DEPLOY_EXTENSIONS_REGISTRY=1`), cài `parity-endpoint-demo` qua Directus → 3 replica 200 trong 10 s, gỡ qua một replica
      → mọi node 404; `deploy/helm/backoffice/ci/kind-test.sh` job `registry` trong cụm, cài qua Directus pod, gọi qua Ingress
- [X] T178 [US6] Spec trạng thái: 016 D-93 (Marketplace, Extensions gỡ ở 020), 011 FR-035 (gỡ ở 020), 012 D-41 (app
      extension, Marketplace), D-45 (extensions), dòng 345, 001 D-17 (phần extension); `docs/directus-gap-audit.md`

---

## Phase 11: User Story 9 - Đối chiếu, E2E, bộ extension mẫu (Priority: P3) — Lượt 3

**Goal**: bằng chứng SC-001..SC-009 trên toàn bộ.

- [ ] T190 [US9] Parity đầy đủ: `env-up` với profile CI + `multi,extensions`, `nx run parity-tests:parity` (full) và
      `parity-blackbox`; 0 khác biệt ngoài D-135..D-141 (SC-001); `guard-differences` xanh (entry mới có trong bảng spec)
- [ ] T191 [US9] E2E đầy đủ ba cấu hình + `a11y.spec.ts` (SC-007), `DIRECTUS_APP_SPECS` (dùng chéo); benchmark
      `gh workflow run benchmark.yml` các job API và `benchmark-web` (SC-005, SC-006), ghi số vào research
- [ ] T192 [US9] Acceptance `deploy` hai chế độ + `deploy-k8s` (SC-003), ghi thời gian readiness thực đo (FR-048)

---

## Phase 12: Polish & Cross-Cutting Concerns — Lượt 3

- [X] T200 [P] Tài liệu: `specs/020-extensions/spec.md` (Status, bảng D-139 cuối, R-58..R-68), `SPECKIT-GUIDE.md` (020 đã
      xong), `CLAUDE.md` (`update-agent-context.sh claude`, Recent Changes 020), `deploy/README.md` rà lại, memory
- [ ] T201 Design owner duyệt Q-41..Q-46 (SC-008) với ảnh sáng/tối; `design-system/qa/handoff-checklist.md` ghi ngoại lệ
      chỉ chuột (`VWorkspace`) nếu shim dùng
- [ ] T202 Owner duyệt khác biệt D-135..D-141, mục "Cần xác nhận và rủi ro" R-58..R-68, D-139 sau T042
- [ ] T203 Đóng 020: CI xanh ở `quality`, `parity`, `e2e-web`, `deploy`, `deploy-k8s` (SC-009); commit, theo dõi CI

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: T001 trước mọi thứ (kết quả rolldown có thể đổi R1); T002 sau T001; T003, T004 song song.
- Phase 2: sau T002. T010 → T011 (cùng lib); T012, T013, T014 song song với T010; T015 → T016 → T018 (MinIO cần `dist`);
  T017, T019, T026 song song; T020 cần T011, T012; T021 cần T020, T013, T014; T022 cần T021; T023, T024 cần T021; T025 cần
  T024, T018, T019. Chặn mọi story.
- Lượt 1: Phase 3 (US1), Phase 4 (US2), Phase 5 (US7) cần Phase 2 và chạy song song được (khác file trong manager: thứ tự
  T038 → T040 → T041 → T082 khi cùng sửa `manager.ts`); Phase 6 (US5) cần T024; T097 đóng lượt 1 sau T030–T095.
- Lượt 2: T100 trước mọi task web lượt 2; Phase 7 (US8) → Phase 8 (US3) (cần `registerShims`, `use-system`); Phase 9
  (US4) cần T145 (extensions.ts) và T115 (view); T163 đóng lượt 2.
- Lượt 3: Phase 10 (US6) cần lượt 2 (màn web, bundle) và T024; T096 (US5) sau T174; Phase 11 sau Phase 10; Phase 12 cuối.

### User Story Dependencies

- US1: Phase 2. US2: Phase 2 (T061 dùng endpoint của US1 → sau T040). US7: Phase 2. US5: T024 (lượt 1), T174 (T096).
- US8: T100. US3: US8 (T104, T116). US4: US3 (T145), US8 (T115). US6: US3, US5. US9: tất cả.

### Within Each User Story

- Test viết trước và chạy đỏ, rồi code; port lib trước manager; API trước web; component con trước trang; E2E sau màn;
  đóng lượt cuối.

### Parallel Opportunities

- Phase 1: T003 | T004.
- Phase 2: T010 | T012 | T013 | T014 | T017 | T019; T015 → T016 → T018 nối tiếp.
- Lượt 1: [US1] T030–T036 test song song; [US2] T060–T063 song song; [US7] T080 | T081; T066 | T067 (compose, Helm).
- Lượt 2: T101 | T102; T106 | T107 | T108; T109–T114 (sáu nhóm shim, khác file); T140 | T141; T160 song song với T147.
- Lượt 3: T170 | T171 | T172 | T173; T175 song song với T174 sau khi contract API chốt.

## Parallel Execution Examples

```text
Lượt 1, Phase 2 (sau T002):
  song song: T010 lib shared | T012 types | T013 utils | T014 api utils | T017 seed | T019 harness
  nối tiếp:  T011 → T020 → T021 → T022 → T023, T024 → T025;  T015 → T016 → T018

Lượt 1, story:
  song song: [US1] T030..T036 | [US2] T060..T063 | [US7] T080, T081 | [US5] T090, T091
  rồi:       T037 → T038 → T039 → T040 → T041 → T042 | T064 → T065 | T082 | T092 → T093 → T094 → T095
  song song: T066 compose | T067 Helm
  rồi:       T097 đóng lượt 1

Lượt 2:
  T100 pinia → song song T101 recipe | T102 trích
  rồi: T103 contract (đỏ) → T104, T105 → song song T106 | T107 | T108 → song song T109..T114 → T115 → T116
  rồi: T140 | T141 → T142 → T143 → T144 → T145 → T146 → T147 → T148 | T149
  rồi: T160 → T161 → T162 → T163 đóng lượt 2

Lượt 3:
  song song: T170 | T171 | T172 | T173
  rồi: T174 → T096 | T175 → T176 → T177 → T178 → T190 → T191 → T192 → T200..T203
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 → Phase 3 (US1): extension API của bộ mẫu chạy giống Directus trên cặp chính; đây là điều kiện để
   Directus và Backoffice chạy chung pool khi đã có extension.

### Incremental Delivery

1. Lượt 1: US1 + US2 + US7 + US5 (phần đọc, bật tắt): API và nhiều instance hoàn chỉnh; cài từ registry vẫn 503.
2. Lượt 2: US8 + US3 + US4: extension app chạy trong app mới.
3. Lượt 3: US6 + phần cài/gỡ của US5 + US9 + Polish: marketplace, gỡ D-37/D-93, bằng chứng và duyệt.

## Truy vết FR → task

| FR | Task |
|----|------|
| FR-001, FR-002, FR-003 | T011, T020, T021 |
| FR-004, FR-005 | T021, T022, T036 |
| FR-006, FR-007, FR-008 | T004, T021 |
| FR-010 | T023, T030, T038 |
| FR-011 | T033, T038, T039 |
| FR-012 | T030, T037 |
| FR-013 | T030, T033, T038 |
| FR-014 | T030, T038 |
| FR-015, FR-016 | T022, T031, T034, T040 |
| FR-017, FR-018 | T032, T035, T041 |
| FR-019 | T031, T034, T040, T042 |
| FR-020..FR-026 | T080, T081, T082 |
| FR-031..FR-036 | T024, T025, T142 |
| FR-037..FR-039 | T171..T174 |
| FR-040..FR-044, FR-049, FR-050 | T060, T061, T064 |
| FR-045 | T063, T067 |
| FR-046, FR-047, FR-052 | T066, T067 |
| FR-048 | T062, T065, T192 |
| FR-051 | T062, T148, T177 |
| FR-060 | T140, T142, T148 |
| FR-061, FR-062, FR-063 | T141, T143, T144, T145 |
| FR-064..FR-069 | T093, T141, T145, T146, T147 |
| FR-070..FR-072 | T160, T161, T162 |
| FR-073, FR-074 | T115, T162 |
| FR-075..FR-078, FR-082 | T102, T103, T106, T108..T116 |
| FR-079, FR-081 | T104, T105 |
| FR-080 | T107 |
| FR-083..FR-085 | T090..T096 |
| FR-086..FR-088 | T170, T175, T176 |
| FR-090 | T015, T016 |
| FR-091 | T023, T025, T033..T036, T061, T081, T173 |
| FR-092, FR-093 | T102, T103, T109..T115 |
| FR-094 | T095, T147, T162, T176 |
| FR-095 | T062, T177, T192 |
| FR-096 | T149 |

## Ghi chú khi làm

(Ghi kết quả T001, T042, T143 và lệch so với tài liệu ở đây khi đóng từng lượt.)

### Lượt 1 (2026-10-21)

- Bộ mẫu có 14 package (thêm `parity-endpoint-express4-path` cho các mục path-to-regexp của D-139, tách khỏi
  `parity-endpoint-express4` vì một path kiểu cũ ném lỗi lúc đăng ký làm hỏng cả extension).
- Manager port đủ ngay ở T021 (gồm đăng ký hook/endpoint/operation/bundle, sandbox, bundle app luôn dựng): T038, T040,
  T041, T082 làm cùng T021; test gộp trong `api/extensions/manager.test.ts` (thay ba file `manager.{hook,endpoint,
  operation,order}.test.ts`) và `api/extensions/sandbox.test.ts`; thứ tự 8 event init ở `app-pipeline.test.ts` (thay
  `app-init-events.test.ts`); readiness ở `server.test.ts` (thay `server.extensions.test.ts`).
- `services` của context: không thêm export vào `services/index.ts` (vòng import qua `server.service`); `extraServices()`
  của `api/extensions/services.ts` nạp lười; `tools/extract-service-signatures.mjs` so `index.ts` + `extraServices` với
  Directus: 0 khác biệt ngoài D-141 (thêm `MailService.getDefaultTemplateData`). Test dạng `node --test`
  (`tools/extract-service-signatures.test.mjs`) cho khớp `test:tools`.
- `MailService` mới làm `services/mail-sites.guard.test.ts` (cấm `class MailService`) đỏ: guard cho phép đúng file
  log-only này và vẫn cấm transport.
- Mọi test dựng app (`createApp`) nay chạy manager thật (không extension): `test-utils/flows.ts` thêm
  `addOperation`/`removeOperation`; `flows.ts` vẫn tự đăng ký operation nội bộ (manager cũng đăng ký như Directus).
- `@directus/extensions-sdk` 17.1.4 (devDependency của bộ mẫu) ghim `vite` 8.0.8: peer `vite` của gói ở root
  (`unplugin-swc`, `@nx/vite`) chuyển sang 8 và `vitest.shared.ts` lỗi kiểu; root `package.json` thêm `vite` 7.3.7 (bản
  vitest dùng) để peer ở root giữ như trước.
- Sandbox [Unverified với Directus, chờ parity T081]: trên Node 22 (macOS và image API linux/amd64), isolated-vm 5.0.3 báo
  "Script failed to terminate" khi một hàm vòng lặp bận vượt `EXTENSIONS_SANDBOX_TIMEOUT`, `onCatastrophicError` gọi
  `process.abort()` (code giống Directus). Ca `/slow` của `parity-endpoint-sandbox` vì vậy có thể làm chết cả hai app; T081
  so hành vi thật trước khi viết ca tải nền SC-004.
- Menu dòng extension: mục bị khóa không có tooltip (Reka bỏ qua mục disabled), lý do `uninstall_locked` ghi trong chữ
  của mục; nút menu có `title` `enabled_dev_tooltip` khi khóa ở dev. Link Marketplace chỉ hiện khi có route (lượt 3).
- `NoticeRaw` có `progress`, `loading`, `showReload` trong type nhưng chưa vẽ (dành cho shim lượt 2).
- T042 (D-139 đo thật): khác dự kiến một mục, `res.send(201)` trên Express 5 trả 200 với body `201` (dự kiến 500);
  các mục khác khớp. Owner duyệt lại mục này khi đóng 020.
- Parity extensions chạy trên env có dữ liệu seed cũ: `bo_ext_items`, `bo_ext_log` tạo bằng tay theo `seed.mjs`
  (`extensionsCollections`). Một lần `toggle.test.ts` (ca bundle) quá 30 s khi chạy sau `endpoints`/`multi`, không tái
  hiện ở 5 lần chạy sau; theo dõi trên CI.

### Lượt 2 (2026-10-21, đang làm)

- Shim (T109–T116): 77 + 3 + 7 tên đăng ký, `contract.test.ts` xanh. Lệch có chủ đích: `VDialog`, `VMenu` teleport vào
  `body` thay vì `#dialog-outlet`/`#menu-outlet` (modal Reka đánh `aria-hidden` lên outlet có sẵn trước khi mở, dialog mở
  từ drawer sẽ bị ẩn); hai outlet vẫn có trong `index.html` cho extension tự teleport. `BoDialog` không cần chế độ không
  tiêu đề: `VDialog` dựng thẳng trên Reka Dialog, tên lấy từ heading đầu của nội dung.
- Bundle (T116): `extensions.ts` chỉ import động năm registry khi bundle có extension app; bản đầu import tĩnh làm
  chunk chính lên 622 KB gzip (registry interface kéo theo CodeMirror). `check-bundle.mjs` nay đo entry cùng các chunk
  nó import tĩnh (import map tách `vue`, `vue-router`, `vue-i18n`, `pinia`, `@directus/extensions-sdk` thành entry
  riêng): 264,4 KB gzip so với 252,3 KB trước lượt 2 (+12,1 KB, research dự kiến +3 KB): mã mới khoảng +3 KB, phần còn
  lại là năm entry giữ đủ export và gzip từng file. Vẫn dưới `BUDGET_020` (343,8 KB). Chunk shim 88,8 KB gzip (≤ 150).
- T143 (kết quả kiểm dev): import map trỏ `/@id/<dep>` không dùng được (Vite trả 504 "Outdated Optimize Dep" vì thiếu
  `?v=`, hoặc nạp bản thứ hai của module); dev trỏ vào module ảo `export * from '<dep>'`, Vite viết lại sang đúng URL
  optimize app đang dùng. Kiểm bằng trình duyệt: 7 extension app đăng ký, interface lưu được giá trị.
- `useExtension` giữ interface/display: thêm loại khác (import tĩnh registry panel/layout/operation) kéo registry panel
  vào chunk `BoForm`, và không caller nào cần. Layout extension được bọc `ErrorBoundary` lúc `registerLayouts` (các màn
  render layout trực tiếp ở tám chỗ). `hydrate.ts` gọi `onHydrateModules` như trước (không có `onHydrateExtensions`).
- T142: manager vẫn giữ `EMPTY_APP_EXTENSION_BUNDLE` cho trường hợp không có extension app (fbe68014): không nạp
  rollup lúc khởi động, tránh 503 của replica mới trong `deploy/shutdown.test.ts`; có extension app thì luôn dựng.
- Module trùng id module nội bộ: giữ module nội bộ, `console.warn` (R-67), ở `setModules`.
- Fixture `parity-panel-counter` sửa query `count: ['*']` → `count: ['id']`: store insights gửi query panel bằng GraphQL,
  `count { * }` không hợp lệ ở cả hai app; dist và `.tgz` dựng lại.
- E2E: một file `extensions-app.spec.ts` (interface, display, layout, panel, operation, module) thay sáu file, chromium;
  `allowed-paths` #214 `GET /server/ping` là request của interface mẫu. Cấu hình `proxy-directus` đưa
  `/extensions/sources/` vào Backoffice như lb deploy (bundle của Directus import `/admin/assets/*.entry.js` của chính nó).
- T148: ca chunk chéo replica ở `deploy/extensions.test.ts` (tải thêm `parity-display-badge` lên bucket, gỡ ở `afterAll`
  để replica các file sau khởi động không có extension app), `extensions/multi.test.ts` (8156/8157) và `kind-test.sh`
  (endpoints của `bo-api-only` không có pod Directus); chưa chạy local (chờ CI).
- T149: `web-shared.ts` gom `signIn`, `p95`, `usual`, `envValue`, `TIMEOUT` (`track` khác nhau theo màn, giữ riêng);
  `web-extensions.ts` đo mở `/admin/content/<collection>` tới khi badge của display extension hiện; chạy thử 2 lượt trên
  dev local đúng luồng, số đo thật chờ workflow tuần.
- Store (T105): `notifications.add/hide/remove/update` đi vào notice tại chỗ của `use-notices` (D-66); `update` cập nhật
  `previous` theo id (Directus gán `previous = queue.map(...)`, lỗi của bản gốc, không chép).

### Lượt 3 (2026-10-21, đang làm)

- T174: installation manager, `download` và service `install`/`reinstall`/`uninstall` đã port ở lượt 1; lượt 3 chỉ bỏ 503
  ở controller. Đo trên env local: Directus 11.17.4 và Backoffice cùng 204 cho cài, cài lại, gỡ `parity-interface-color`
  qua fake registry; extension không sandbox với `MARKETPLACE_TRUST` mặc định (`sandbox`) → 503 "Could not download the
  extension" và dòng `directus_extensions` ghi trước khi tải vẫn còn, ở cả hai app.
- T171: id version của fixture registry trước trùng nhau (`…00a` cho mọi extension) → đổi thành id extension với tiền tố
  `f`; thêm `parity-endpoint-demo` (…0006, không sandbox) thay vì `…0006..0013`; registry mount `tests/fixtures/extensions`.
- T172: `tarball-safety.test.ts` chạy tar 7 thật với entry tuyệt đối, `..` và symlink ra ngoài rồi file đi qua symlink:
  không file nào ra ngoài thư mục tạm.
- T096: menu Directus chỉ có Reinstall ở dòng Missing; E2E thử Uninstall một extension cài từ registry (dòng tìm theo
  `data-extension-id`, vì bản registry và bản local cùng tên).
- Toggle extension app bị khóa khi web chạy Vite dev (`import.meta.env.DEV`, như Directus): ca bật tắt của
  `settings-extensions.spec.ts` không chạy được ở cấu hình `dev`.
- T175 (subagent, rồi sửa): Marketplace là port của `routes/marketplace/**`; mục Settings đặt TRƯỚC Extensions như Directus
  (recipe Q-42 sửa theo); `settings-parity-ui.spec.ts` không còn lọc "Marketplace". Lệch đã ghi trong code: request list
  dùng `apiFetch` (SDK bỏ `meta.filter_count`), debounce 300 ms như Directus, giá trị `all` của BoSelect thay `null`,
  bỏ ảnh banner storefront. Khóa vi-VN thiếu trong Directus vi-VN (`install_extension`, `manage`, …) để rơi về en-US
  như Directus (cùng cách lượt 1), không thêm overlay.
- Fake registry: `by` của list là id tài khoản (trang account của app gửi `filter[by][_eq]=<accountId>`), dòng list chỉ có
  username → server tra `accounts.json`; trước đó trang account rỗng ở cả hai app.
- T176: `settings-marketplace.spec.ts` (registry, extension + Install → Manage, account); ca giới hạn R-60 nằm ở unit test
  `ExtensionRoute.test.ts` (cần `EXTENSIONS_LIMIT` trên env); `extensions-cross-use` không viết riêng: cài ở Directus app
  rồi thấy ở app mới đã có trong `directus-app-e2e/system.spec.ts` + parity `install.test.ts`.
- T177: compose: global-setup bật profile `extensions-test` và `MARKETPLACE_REGISTRY`; cài qua Directus → mọi node nạp
  trong 10 s, gỡ qua replica 2 → bundle mọi replica bỏ. Job registry trong cụm kind chưa làm (chưa có image registry
  trong kind; ghi lại cho T192).
- Quality CI: script `build` của gói fixtures (xóa `dist` tại chỗ) bị `nx run-many -t build` chạy song song với test
  so `dist` → đổi tên `fixtures:build`/`fixtures:pack`. Security: `nanoid` 5.1.16 cho `@directus/composables`.

