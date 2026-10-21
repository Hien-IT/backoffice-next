# Implementation Plan: Extensions

**Branch**: `020-extensions` (trên `main`, không có branch riêng) | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-extensions/spec.md`

## Summary

Extension đã build cho Directus 11.17.4 chạy trên API mới và app web mới mà không cần build lại (owner: phương án A).
API: port `directus/api/src/extensions` (manager, get-extensions, settings, sync từ `EXTENSIONS_LOCATION`, installation
từ registry, sandbox isolated-vm, bundle app bằng rollup) với `services`, `database`, `getSchema`, `env`, `logger`,
`emitter` của app mới; 8 event init tại đúng vị trí của `app.ts` Directus; endpoint mount sau route hệ thống trước 404;
`/extensions` đầy đủ (gỡ D-37); nhiều instance qua storage dùng chung, bus `extensions.reload` và khóa schedule cùng
tên với Directus. Web: nạp `/extensions/sources/index.js`, shared dep qua **import map** sinh lúc build (owner chọn D ở
plan, D-140 bỏ), `pinia` 2.3.1, registry interface/display/layout/panel/operation/module đăng ký lúc chạy, shim 77
component + 3 view + 7 directive + 4 inject (`useApi` = axios, owner duyệt), 173 biến `--theme--*`, màn Settings >
Extensions và Marketplace. Ba lượt lên `main` (R14).

Chi tiết: [research.md](./research.md) R1–R14, [data-model.md](./data-model.md), [contracts/](./contracts/),
[quickstart.md](./quickstart.md).

## Technical Context

| Yêu cầu (prompt plan BE + FE) | Ở feature 020 |
|-------------------------------|---------------|
| Node 22, pnpm 10, Nx, `apps/api` NestJS strict, Knex, Redis bus/cache/lock cùng key Directus | Giữ; manager là singleton như FlowManager 009 (`getExtensionManager()`), controller/service Nest như 010; bus `extensions.reload`, khóa `extensions-sync/<machineId>`, `extensions-settings` (mới, R6), clock schedule cùng tên Directus |
| Port logic từ file tương ứng, ghi nguồn đầu file, `@backoffice/*` | `apps/api/src/extensions/**` ← `directus/api/src/extensions/**`; `libs/extensions` ← `directus/packages/extensions`; manifest `tools/port-manifest/020-T###.json` |
| Env đọc bằng lib env, không đổi tên | 7 biến chuyển từ cảnh báo sang supported (`EXTENSIONS_MUST_LOAD`, `_AUTO_RELOAD`, `_SANDBOX_MEMORY`, `_SANDBOX_TIMEOUT`, `_LIMIT`, `_ROLLDOWN`, `PACKAGE_FILE_LOCATION`); không biến mới |
| Vitest unit, parity với Directus thật (blackbox), Compose Postgres/MySQL/SQLite | `contracts/tests.md`: suite `src/extensions/**` (+ profile `extensions`, `multi`), acceptance deploy, kind |
| `apps/web` Vue 3 script setup, Vite, Pinia, Router, Reka UI + Tailwind 4 theme TailAdmin, không hex | Shim theo token (D-136); `pinia` 2.3.1 (R1); plugin Vite import map (R4); recipe Q-41..Q-46 trước khi code |
| Bố cục `layout-patterns.md`, component `component-specs.md` | `PrivateView` shim trên khung D-127/D-128 (Q-45); hai màn Settings theo mẫu bảng/lưới (Q-41..Q-43); component mới theo Q-44 |
| vue-i18n từ `directus/app/src/lang` | Khóa đã có; overlay vi-VN 23 khóa (R10) |
| `@directus/sdk` là client | Giữ cho mã app; **axios 1.15.0 chỉ cho `useApi()` của extension** (owner duyệt 2026-10-21, lệch 012) |
| Copy composable/utils, viết lại component bằng Reka UI | `@directus/composables` 11.4.1 dùng thẳng (gói công khai extension đã compile với); shim viết trên `Bo*`/Reka |
| Playwright ba cấu hình, GitHub Actions, coverage BE 80 % FE 60 % | `e2e-web` + `payload/extensions`; CI job hiện có, không job mới; `check-bundle` `BUDGET_020` |
| Phần riêng 020 | Port đúng danh sách file của spec; D-139 Express 5 (R12); import map (R4); shim toàn bộ (R8, data-model §7); fake registry `/download`; `EXTENSIONS_LOCATION` bắt buộc khi nhiều replica (R13) |

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23; Express 5.2.1 (D-139); trình duyệt như 012 (import map: Chrome 89+, Firefox 108+, Safari 16.4+)

**Primary Dependencies**: API thêm rollup 4.59.0, rolldown 1.0.0-beta.31, @rollup/plugin-virtual 3.0.2, @rollup/plugin-node-resolve 16.0.3, chokidar 5.0.0, node-machine-id 1.1.12, tar 7.5.19 (security patch of the Directus 7.5.8), fs-extra 11.3.2, glob-to-regexp 0.4.1 (cùng bản Directus 11.17.4; isolated-vm 5.0.3, p-queue, ky, express 5 đã có); web thêm @directus/composables 11.4.1, axios 1.15.0, semver 7.7.3, @vueuse/router 14.0.0, pinia đổi 3.0.3 → 2.3.1; fixtures @directus/extensions-sdk 17.1.4

**Storage**: không bảng mới; `directus_extensions` dùng chung, ghi qua ItemsService như Directus; file extension trên storage `EXTENSIONS_LOCATION` (S3/MinIO) + cache local `TEMP_PATH/extensions`; bundle app `TEMP_PATH/app-extensions` mỗi node; Redis: bus `extensions.reload`, khóa `extensions-sync/*`, `extensions-settings`, clock schedule

**Testing**: Vitest unit (api, libs, web unit + browser + axe, contract test shim từ `fixtures/directus-components.json`), parity `src/extensions/**` (cặp chính + `multi` + profile `extensions`), E2E ba cấu hình + payload + dùng chéo, acceptance compose 3 BE + Directus và kind, benchmark `web-extensions`

**Target Platform**: Linux amd64 containers (API image alpine: kiểm rolldown musl T001), Kubernetes ≥ 1.29, trình duyệt desktop/tablet

**Project Type**: Monorepo web (BE + FE + deploy): `apps/api`, `libs/{extensions,types,utils,constants}`, `apps/web`, `apps/web-e2e`, `tests/{parity,fixtures/extensions,benchmark}`, `deploy/{compose,helm}`, `design-system/docs`

**Performance Goals**: SC-003 (mọi node phản ánh cài/gỡ/bật tắt trong 10 s; schedule 1 lần/lượt; pod mới trả endpoint ngay khi ready), SC-005 (benchmark hiện có không chậm hơn ngưỡng khi không có extension), SC-006 (mở app lần đầu với bộ mẫu không chậm hơn Directus app quá 10 % và 25 ms); readiness lần đầu sau sync + nạp + dựng bundle ≤ 60 s với bộ mẫu trên runner CI (FR-048; 019 SC-008 30 s khi không extension); bundle chính web ≤ `BUDGET_019` + 3 KB gzip (loader + import map); chunk shim chỉ tải khi bundle có extension app, trần 150 KB gzip; chunk Settings extensions/marketplace ≤ 40 KB

**Constraints**:
- Không sửa `directus/`; file chép ghi `// Ported from …`; không biến env mới; khi khởi động chỉ ghi dòng
  `directus_extensions` cho extension mới thấy (ngoại lệ của Nguyên tắc VII, constitution 2.2.0), qua ItemsService và khóa
  `extensions-settings`.
- Benchmark chạy không extension (SC-005): env benchmark bỏ `EXTENSIONS_LOCATION`; chỉ `web-extensions` bật bộ mẫu.
- Hook mẫu chỉ ghi `bo_ext_log` khi request có header `x-bo-ext-trace` hoặc chạm collection `bo_ext_*`; schedule mẫu chỉ
  bật ở profile `extensions` (không làm nặng suite khác).
- Express 5 thay Express 4: D-139, không cài Express 4 (owner B).
- Hai image độc lập, không cùng commit (import map); `/extensions/sources/*` chỉ từ Backoffice ở chung domain (FR-047).
- Không hex, không palette ngoài theme trong shim; recipe Q-41..Q-46 trước khi code; design owner duyệt trước khi đóng.
- `MailService` chỉ log (D-33/D-34); không WebSocket/deployment/AI service (D-141); theme không nạp (D-135).
- Ba lượt (R14); checkout dùng chung với phiên khác: chỉ stage đường dẫn của 020, nhắn trước và sau push.
- Một process Node mỗi container (D-19 của 001): điều kiện để xóa khóa sync cũ lúc khởi động (R6); PM2 không hỗ trợ.
- CSP image web cho import map bằng hash `sha256` tính lúc container khởi động, không `'unsafe-inline'` (R4).
- Helm check `EXTENSIONS_LOCATION` chặn cả `helm upgrade` release 019 (owner chọn a), kèm hướng dẫn nâng cấp.

**Scale/Scope**: API ≈ 45 file port (manager + 3 lib + installation 2 + sync 4 + sandbox 17 + registry download + service + controller + Nest module + 7 utils) ≈ 3.500 dòng (≈ 2.800 chép); libs ≈ 15 file; web ≈ 120 file (extensions.ts, plugin Vite, sdk, use-system, axios, 77 shim + 3 view + 7 directive, theme-vars.css, 5 registry sửa, store extensions, 2 màn Settings ≈ 15 SFC, 30 `Bo*` mở rộng) ≈ 9.000 dòng mới; fixtures 13 package; test ≈ 70 file; deploy ≈ 8 file; recipe 6 câu hỏi. `tasks.md` chia ba lượt.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` 2.2.0 (sửa 2026-10-21 trước plan). Lần 1 (trước research) và lần 2 (sau
design): PASS, không vi phạm; các điểm cần chú ý ghi ở Complexity Tracking.

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`; script `extract-directus-components.mjs` và
  `extract-directus-registry.mjs` chỉ đọc; manifest `020-T###.json`, `check-port-headers`.
- [x] **II. Dùng chung DB**: PASS. Chỉ bảng `directus_extensions`, ghi qua ItemsService với cùng dòng Directus tạo
  (`get-extensions-settings`, `install`); không DDL, không migration; khóa `extensions-settings` ở Redis (R-58).
- [x] **III. API giống hệt**: PASS. Route, body, status, header, mã lỗi của `/extensions` và GraphQL như Directus
  (`contracts/api.md`); khác biệt D-135..D-141 ghi trong spec với lý do và được owner duyệt.
- [x] **IV. Chạy song song an toàn**: PASS. Cùng kênh bus, cùng tên khóa clock, cùng storage; extension API chạy ở mọi
  node của pool (US1, US2); state bật tắt ở DB.
- [x] **V. Kiểm thử đối chiếu**: PASS. Suite parity cho mọi route `/extensions` và hành vi hook/endpoint/operation/
  sandbox (`contracts/tests.md` §3), gỡ D-37 khỏi accepted-differences; E2E ba cấu hình + payload + dùng chéo.
- [x] **VI. Kiến trúc**: PASS. Manager singleton như FlowManager 009; service Nest factory như 010; Knex; Vue 3
  Composition API; Reka UI cho shim; route/luồng như Directus app.
- [x] **VII. Đa instance**: PASS (constitution 2.2.0: ghi dòng `directus_extensions` cho extension mới lúc khởi động là
  ngoại lệ được phép, có khóa Redis R-58). `EXTENSIONS_LOCATION` bắt buộc khi nhiều replica (Helm check, compose), sync lúc khởi
  động, reload qua bus, không state chỉ trong process (bundle mỗi node là hàm của bộ file đã sync, FR-060), readiness
  sau nạp, khóa cũ của máy mình xóa lúc khởi động (R6).
- [x] **VIII. Biến môi trường**: PASS. Chỉ biến Directus (7 biến chuyển sang supported); không biến mới; Helm value
  `extensions.inImage` không phải env.
- [x] **IX. Đổi thương hiệu**: PASS. Tên service, event, kênh bus, khóa, tên component `v-*`, inject key, module
  `@directus/extensions-sdk`, `directus:api` giữ nguyên (tương thích); log/giao diện ghi Backoffice.
- [x] **X. Chất lượng**: PASS. Coverage BE 80 %, FE 60 %; benchmark SC-005/SC-006; không gửi email (`MailService` log);
  khác biệt trong spec; `pnpm audit` cho gói mới (tar 7, rolldown beta: kiểm T001).
- [x] **XI. Ngoài phạm vi**: PASS. Theme (D-135), AI/MCP, WebSocket, deployment (D-141) không làm; extension nay trong
  phạm vi theo 2.1.0.
- [x] **XII. Design-system**: PASS. Đã đọc `README.md`, `component-specs.md`, `layout-patterns.md`, `handoff-checklist.md`;
  shim theo token, Q-41..Q-46 ghi ở spec, recipe trước khi code, design owner duyệt trước khi đóng (SC-008); kéo
  `VResizeable`/`VWorkspace` giữ ngoại lệ chuột đã duyệt ở 017/018, thêm bàn phím cho tay cầm `VResizeable`.

## Project Structure

### Documentation (this feature)

```text
specs/020-extensions/
├── plan.md
├── research.md           # R1–R14 + bảng kiểm
├── data-model.md         # manifest, settings rows, ApiOutput, context/event/bus/lock, web registry/store/import map, kiểm kê 77 shim, --theme--*, fixtures
├── quickstart.md
├── contracts/
│   ├── api.md            # REST, GraphQL, env, bus, khóa, event, context, sandbox SDK, D-139
│   ├── web.md            # bundle, import map, sdk module, inject, đăng ký shim, registry, API calls #204–#213, i18n
│   ├── deploy.md         # compose, lb, Helm, image
│   └── tests.md          # unit, browser, parity, E2E, acceptance, benchmark, manifest
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
pnpm-workspace.yaml                                   # catalog: rollup, rolldown, @rollup/plugin-virtual, @rollup/plugin-node-resolve, chokidar, node-machine-id, tar 7, glob-to-regexp, @directus/composables, semver, @vueuse/router, @directus/extensions-sdk; pinia 2.3.1
libs/
├── extensions/src/{shared/{constants,schemas,define}, node/{get-extensions,generate-extensions-entrypoint}}.ts   # @backoffice/extensions
├── types/src/extensions/*.ts                         # Extension, ApiOutput, ExtensionSettings, HookConfig, EndpointConfig, contexts
└── utils/src/{shared/{pluralize,number-generator}, node/{list-folders,resolve-package,path-to-relative-url}}.ts
apps/api/
├── package.json                                      # + dependencies R1
├── src/extensions/{index,manager}.ts
├── src/extensions/lib/{get-extensions,get-extensions-settings,wrap-embeds}.ts (+ get-extensions-path có sẵn)
├── src/extensions/lib/installation/{index,manager}.ts
├── src/extensions/lib/sync/{sync,status,tracker,utils}.ts
├── src/extensions/lib/sandbox/{generate-api-extensions-sandbox-entrypoint,generate-host-function-reference}.ts, register/*, sdk/{index,instantiate,sdk}.ts, sdk/generators/*, sdk/utils/*
├── src/extensions/registry/download.ts (+ index.ts export)
├── src/extensions/extensions.module.ts               # Nest module: onModuleInit mount endpointRouter + routes.custom.*
├── src/services/{extensions.service.ts (port đủ), mail.service.ts (log), index.ts (+ export còn thiếu)}
├── src/controllers/extensions.controller.ts          # bỏ 503/403, PATCH/DELETE, sources whitelist
├── src/services/graphql/resolvers/system-admin.ts    # update_extensions_item
├── src/{app.ts, app-pipeline.ts (async, emitInit), server.ts (shutdown unload)}
├── src/utils/{import-file-url,get-module-default,delete-from-require-cache}.ts
├── src/config/{supported-variables,warn-unsupported-variables}.ts
└── Dockerfile                                        # không đổi (T001 kiểm)
apps/web/
├── package.json, vite.config.ts (+ plugin backoffice-extensions-build), index.html (+ #dialog-outlet, #menu-outlet)
├── src/{main.ts, hydrate.ts, extensions.ts, extensions/sdk.ts, api/axios.ts}
├── src/directus-shim/{register.ts, use-system.ts, components/V*.vue ×77, views/{PrivateView,PublicView,SharedView}.vue, directives/*.ts ×7, styles/theme-vars.css, contract.test.ts}
├── src/components/{BoPopover.vue (mới), Bo*.vue (mở rộng 30), form/BoForm.vue (+inline)}, layout/{PageHeader,PrivateView,DetailPanel}.vue (+ slot, AccordionRoot, main-element)
├── src/{interfaces,displays,layouts,panels,operations,modules}/index.ts   # register*
├── src/composables/{use-extension,use-notices}.ts, src/stores/{extensions.ts (mới), notifications.ts, server.ts, settings.ts, app.ts}
├── src/modules/settings.ts, modules/settings/components/SettingsNavigation.vue
├── src/modules/settings/routes/extensions/{ExtensionsRoute.vue, components/{ExtensionItem,ExtensionItemOptions,ExtensionGroupDivider}.vue, constants.ts, types.ts}
├── src/modules/settings/routes/marketplace/{RegistryRoute,ExtensionRoute,AccountRoute}.vue, components/{InlineFilter,ExtensionListItem,MetadataItem,ExtensionBanner,ExtensionReadme,ExtensionMetadata*,ExtensionInstall,AccountBanner,AccountMetadata}.vue, utils/format-name.ts
├── src/utils/markdown.ts (+target), src/lang/overlay/vi-VN.ts, src/test-utils/fetch.ts (#204–#213)
├── scripts/{extract-directus-components.mjs, check-bundle.mjs (BUDGET_020)}, fixtures/directus-components.json
├── fixtures/interfaces/{seed.mjs (+bo_ext_items, bo_ext_log), snapshot/extensions.json}
└── docker/csp.awk (+ origin PUBLIC_URL), docker/web-image.test.ts
apps/web-e2e/src/{settings-extensions,settings-marketplace,extensions-app-{interface,display,layout,panel,operation,module},extensions-cross-use}.spec.ts, payload/extensions.spec.ts, requests.spec.ts, settings-parity-ui.spec.ts, a11y.spec.ts, helpers/{allowed-paths,payload,db-rows,directus-app}.ts
tests/fixtures/extensions/{package.json, <13 package>/{package.json,src,dist,*.tgz}, fixtures-build.test.ts}
tests/parity/{docker-compose.yml (EXTENSIONS_LOCATION, minio-init copy, profile extensions), env/{postgres,mysql,sqlite,profile-extensions}.env, registry/server.mjs (+/download), scripts/env.mjs, src/{config,docker,suite}.ts, src/extensions/*.test.ts, src/deploy/extensions.test.ts, src/web/fixtures-seed.test.ts, accepted-differences.ts}
tests/benchmark/src/{web-extensions.ts, web-shared.ts}, project.json; .github/workflows/benchmark.yml
deploy/compose/{.env.example, docker-compose.yml, lb/shared-domain.conf, README.md}
deploy/helm/backoffice/{values.yaml, templates/{api-only-service.yaml,ingress.yaml,_checks.tpl,NOTES.txt}, ci/{deps.yaml,test-template.sh,kind-test.sh}}
design-system/docs/{component-specs.md, layout-patterns.md}   # recipe Q-41..Q-46
tools/port-manifest/020-T###.json, tools/check-package-names.mjs
specs/{001,010,011,012,016}/spec.md                   # trạng thái D-17, D-37, FR-035, D-41, D-45, D-93
SPECKIT-GUIDE.md, CLAUDE.md, docs/directus-gap-audit.md
```

**Structure Decision**: `apps/api/src/extensions/**` giữ cây của `directus/api/src/extensions` (manifest port theo file);
`@backoffice/extensions` tách lib vì web và API cùng cần schema/hằng; shim gom ở `apps/web/src/directus-shim/` để tách
rõ "hợp đồng Directus" khỏi `Bo*` (mọi phần thiếu được bổ sung vào `Bo*`, shim chỉ map tên); hai màn Settings giữ cấu
trúc `routes/extensions`, `routes/marketplace` của Directus; bộ extension mẫu là workspace riêng ở `tests/fixtures`
(build bằng SDK thật, không trộn vào `apps/web/fixtures` 013 dùng cho dữ liệu).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Không vi phạm constitution. Điểm cần ghi: `axios` thêm vào `apps/web` dù 012 chốt "`@directus/sdk` là client duy nhất" | `useApi()` của Directus là AxiosInstance; extension gọi `api.get/interceptors` (owner duyệt 2026-10-21, chỉ cho `useApi()`) | Lớp giả AxiosInstance trên SDK: interceptor, cancel token khác hành vi (owner chọn A) |
| `pinia` hạ 3.0.3 → 2.3.1 | Chunk `pinia` dùng chung phải có API extension đã compile với (`defineStore({id})`) | Giữ pinia 3 + khác biệt: owner từ chối |
| `rolldown` beta (binary native) trong image | Spec FR-060 `EXTENSIONS_ROLLDOWN` như Directus | Bỏ biến: lệch VIII (biến Directus); giữ, T001 kiểm musl, không có binding thì ghi khác biệt |
| `process.abort()` khi isolate lỗi nghiêm trọng (pod restart) | Như Directus (FR-025); cô lập extension hỏng | Nuốt lỗi: khác Directus, isolate hỏng còn chạy |
| Express 5 cho endpoint (D-139) | Nguyên tắc VI; owner chọn B | Express 4 cạnh 5: hai bản, lớp chuyển request |
| Khóa Redis `extensions-settings` (không có ở Directus) | N node Backoffice khởi động cùng lúc chèn dòng trùng (bảng không unique) | Không khóa: dòng trùng ở mọi lần scale; thêm unique index: DDL bảng hệ thống (II) |

## Phase 0, 1: kết quả

- research.md: R1–R14; bảng kiểm 2026-10-21 (sáu báo cáo agent đọc mã, kiểm trực tiếp Express 5, Vite, Dockerfile,
  CSP, kind MinIO). Hai câu hỏi hỏi owner khi plan: import map (D, bỏ D-140) và pinia 2.3.1; ghi vào spec
  Clarifications.
- Sửa spec theo research (2026-10-21): FR-062 import map; FR-049/FR-052 bỏ ràng buộc cùng commit; FR-074 slot/prop
  thật của `PrivateView` (không `splitView`); FR-079 thành viên store thiếu; FR-080/Q-46 173 biến; FR-086/US6/Q-42/Q-43
  bỏ chọn phiên bản và nhãn sandbox (Directus 11.17.4 không có); D-137 thêm "luôn dựng, không theo `SERVE_APP`"; D-139
  danh sách đủ; D-140 bỏ; D-141 mới (services ngoài phạm vi, `MailService` log, AI members); R-58..R-61 "Cần xác nhận".
- data-model.md: manifest và ba nguồn, dòng settings, `ApiOutput`, context/event/bus/khóa/sandbox/tarball, web registry/
  store/import map/inject/store members, màn Settings, kiểm kê 77 shim (13 cùng hợp đồng, 30 mở rộng, 34 mới), view,
  directive, 173 `--theme--*`, 13 fixture.
- contracts/: `api.md`, `web.md`, `deploy.md`, `tests.md`.
- quickstart.md: cài, fixtures, API, web, E2E, nhiều instance, đóng.
- Agent context: `CLAUDE.md` cập nhật bằng `update-agent-context.sh claude` (dòng 020 ở Active Technologies).
- Release-gate (`checklists/release-gate.md` CHK001–CHK059, 2026-10-21): owner duyệt áp toàn bộ lời giải
  (`release-gate-proposals.md`), CHK013 chọn a (Helm chặn cả upgrade, kèm hướng dẫn). Đã áp vào spec (US2-6/7, US3-6/7,
  US6-4, Edge Cases, FR-006, FR-011, FR-012, FR-014, FR-016, FR-022, FR-035, FR-040, FR-045, FR-047, FR-048, FR-052,
  FR-060..FR-062, FR-067, FR-073, FR-076, FR-077, FR-080, FR-081, FR-083, FR-087, FR-090, FR-091, D-139 kết quả mong đợi,
  D-141 mở rộng, R-58 bổ sung, R-62..R-68, Q-41/Q-43/Q-44, Assumptions mô hình tin cậy, SC-001, SC-003, SC-004, SC-007,
  SC-008), research (R3 bảng event và thứ tự, R4 CSP hash và shim lười, R6, R7, R14), data-model (§7 cột bỏ qua, §9
  chuẩn), contracts.
- `/speckit.analyze` (2026-10-21): 18 phát hiện, owner áp toàn bộ, C1 chọn (a) → constitution 2.2.0 (ngoại lệ VII cho
  dòng `directus_extensions`); I1 giữ bundle rỗng tới T142; I2 FR-069 store không hydrate; G1 benchmark không extension;
  G2 hook mẫu ghi log có điều kiện; I3 bỏ `skipSync` khỏi FR-042; G3 test route lb; G4 test watcher; I4..I7, T1, U1, D1,
  A1 sửa chữ; CHK060, CHK061 thêm vào release-gate.
