# Implementation Plan: Collection hệ thống còn lại (`/settings`, `/presets`, `/notifications`, `/shares`, `/translations`, `/dashboards`, `/panels`, `/extensions`, `/utils`)

**Branch**: `010-system-collections` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-system-collections/spec.md`

## Summary

App mới phục vụ các route hệ thống còn lại của Directus 11.17.4 giống hệt: `/settings` (`SettingsService` đầy đủ
thay bản tối giản của 001; `setOwner` không gửi báo cáo chủ dự án, D-38), `POST /server/setup` (`createAdmin`, gỡ
D-14), `/presets`, `/notifications`, `/translations`, `/dashboards`, `/panels` (CRUD theo khuôn 008), `/shares`
(`SharesService` port nguyên: đăng nhập bằng share với mật khẩu, thời hạn, số lần dùng, token và phiên dùng chéo; mời
qua email ghi log, D-36), `/extensions` (danh sách từ `directus_extensions` với `schema: null`, bundle app rỗng là
hằng đo bằng rollup, duyệt registry thật qua client port, cài và gỡ bị từ chối, D-37), `/utils` (random, hash, sort,
revert, import CSV/JSON với bộ đếm chung trên Redis, export 5 định dạng ra `directus_files`, translations/generate,
cache/clear, resolve-redirect). Mọi chỗ gửi email ghi một dòng log cảnh báo, có guard tự động liệt kê sáu chỗ
`new MailService` của Directus. Gỡ D-09.8, D-14; D-31 thu hẹp còn ba collection deployment và thành lâu dài.

Cách làm:

- Port nguyên, cùng đường dẫn, kèm test gốc: `services/{settings,shares,translations,dashboards,panels,utils}.ts`,
  phần còn lại của `services/import-export.ts`, `utils/{create-admin,store,destroy-piped-stream,
  generate-translations,translations-shared,translations-validation}.ts`, `controllers/utils/handle-registry-error.ts`,
  `packages/extensions-registry` (3 module), `packages/utils/node/tmp.ts` (R2 đến R7).
- `ExtensionsService` viết mới chỉ phần đọc, bundle rỗng là chuỗi hằng (R6). Tám controller Nest mỏng theo mẫu 008;
  uuid kiểm trong handler thay regex param (R16).
- Thêm ky, papaparse, stream-json, async (R1); 11 biến sang nhóm A (R9).
- Bộ đối chiếu `tests/parity/src/system/` (13 file), cặp `setup` có DB Postgres riêng, registry giả, blackbox
  `mail.test.ts`, Playwright `system.spec.ts`, `setup.spec.ts`, benchmark `system.ts`, job `benchmark-system`
  (R10 đến R15, contracts/parity.md).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

Stack theo prompt của chủ dự án và cách feature này đáp ứng:

| Yêu cầu | Ở feature 010 |
|---------|---------------|
| Node 22, pnpm 10, Nx, `apps/api` NestJS strict | Giữ như 001 đến 009; thêm bốn gói Directus đang dùng (R1) |
| Knex với dialect như `directus/api/src/database/helpers` | Không DDL (trừ `translations/generate` dùng `CollectionsService`, `FieldsService`, `RelationsService` của 006); `UtilsService.sort`, `SharesService.login` dùng knex thô như Directus; export đọc theo lô trong transaction |
| Cache, bus Redis cùng key và kênh Directus | Bộ đếm import `directus:import-export` (`importCount`, `lock`); cache quyền xóa khi sửa share; `cache/clear?system` qua bus; data cache theo `CACHE_AUTO_PURGE_IGNORE_LIST`; không key mới |
| Validate bằng Joi hoặc Zod giống Directus | Joi: `/shares/auth`, `/shares/invite`, `/utils/random/string`, `/utils/sort`; Zod: `generateTranslations`, schema registry; không schema mới |
| Port từ `directus/api/src`, ghi đường dẫn gốc | Bảng ánh xạ bên dưới; manifest `tools/port-manifest/010-T*.json`; guard `check-port-headers` |
| Thư viện nội bộ `@backoffice/*` | `@backoffice/utils` thêm `node/tmp.ts`; `@backoffice/errors`, `@backoffice/memory`, `@backoffice/system-data` dùng như có |
| Env port từ `packages/env`, không đổi tên biến | Không biến mới; 11 biến sang nhóm A (R9); `SERVE_APP` đọc cho bundle |
| Mỗi service Directus một provider, controller mỏng | 9 factory mới trong `providers.ts`; 8 controller mới + `setup` trong `ServerController`; controller chỉ parse, chạy middleware, gọi service, `respond` (R16) |
| Vitest; test đối chiếu copy từ `directus/tests/blackbox`; Compose Postgres, MySQL, SQLite, Redis | R10 đến R15; 1 file blackbox copy, 3 file blackbox đổi đích; test gốc port nguyên; profile `setup`, dịch vụ `registry` |
| GitHub Actions, coverage BE 80% | contracts/parity.md §6 |

**Language/Version**: TypeScript 5.9.3 (bộ cờ strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS, ESM, pnpm
10.27.0, Nx 23.3. Giữ như 001 đến 009.

**Primary Dependencies**:
- Đã có: NestJS 12 (Express 5.2.1), knex 3.1.0, argon2 0.44.0, nanoid 5.1.16, jsonwebtoken 9.0.3, busboy 1.6.0,
  joi 18.2.6, zod 4.1.12, zod-validation-error 4.0.2, js-yaml 4.3.2, js2xmlparser 5.0.0, json2csv 5.0.7, ms 2.1.3,
  lodash-es, `@backoffice/memory` (`createCache`, `redisConfigAvailable`), `@backoffice/errors`, `@backoffice/
  system-data` (`systemCollectionRows`), `@backoffice/utils` (`getDateTimeFormatted`, `toBoolean`, `parseJSON`,
  `toArray`), `ItemsService`, `FilesService.uploadOne`, `RevisionsService.revert`, `NotificationsService`,
  `UsersService`, `RolesService`, `PoliciesService`, `AccessService`, `CollectionsService`, `FieldsService`,
  `RelationsService`, `getService`, `validateAccess`, `fetchAllowedFields`, `parseFields`, `getPermissionsForShare`,
  `clearCache` (quyền), `clearSystemCache`, `getCache`, `shouldClearCache`, `getCacheControlHeader`,
  `getMilliseconds`, `getSecret`, `generateHash`, `resolveLoginRedirect`, `Url`, `userName`, `sanitizeQuery`,
  `respond`, `validateBatch`, `collectionExists`, `useCollection`, `runMiddleware`, `ServiceFactory`,
  `REFRESH_COOKIE_OPTIONS`, `SESSION_COOKIE_OPTIONS`, `UUID_REGEX`, `Emitter`.
- Thêm: ky 1.14.0, papaparse 5.5.3 (+ `@types/papaparse` 5.5.0), stream-json 1.9.1 (+ `@types/stream-json` 1.7.8),
  async 3.2.6 (+ `@types/async` 3.2.25) (R1).

**Storage**:
- DB dùng chung; không DDL, không migration (trừ `translations/generate` tạo bảng người dùng qua 006). Đọc, ghi tám
  collection hệ thống qua service port; `directus_sessions` (phiên share), `directus_files` (file xuất), thông báo,
  activity, revision; `/server/setup` ghi roles, policies, access, users, settings ([data-model.md](./data-model.md)).
- Redis dùng chung: bộ đếm import, cache quyền, cache hệ thống, data cache; không key mới. File tạm của export trong
  `os.tmpdir()` của tiến trình, dọn ở `finally`.

**Testing**:
- Vitest 3.2.4: test gốc port kèm code (`import-export.test` 37, `generate-translations.test` 23,
  `translations-shared.test` 3, `store.test`, `destroy-piped-stream.test`, `handle-registry-error.test`, registry 8 file
  test (bỏ 2 file của `download`)); test mới cho `createTmpFile` (Directus không có test), 8 controller (supertest qua app
  Nest), `SharesService`, `SettingsService`, `TranslationsService`, `ExtensionsService`, `UtilsService`,
  `createAdmin`, `store`, `getService`, `supported-variables`, `router-options`, guard `mail-sites.guard.test.ts`,
  `fixtures.test.ts` của registry giả. Coverage 80% `apps/api`, `libs/utils`.
- `tests/parity/src/system/` (R10, contracts/parity.md §2); blackbox `mail.test.ts` + 3 file đổi đích (§5); cặp
  `setup` (§3); registry giả (§4).
- `tests/directus-app-e2e/src/{system,setup}.spec.ts` (R13); `routing.spec.ts`, `backoffice-routes.txt` sửa.
- `tests/benchmark/src/{system,seed-system}.ts`, job `benchmark-system` (R14).

**Target Platform**: Container Linux (`node:22-alpine`), nhiều replica cạnh Directus sau load balancer. Giữ như 001.
Không gói native mới.

**Project Type**: Monorepo web (Nx). Chạm `apps/api`, `libs/utils`, `tests/parity`, `tests/directus-app-e2e`,
`tests/benchmark`, CI, catalog pnpm.

**Performance Goals**:
- SC-006: `settings-get`, `presets-list`, `notifications-count`, `dashboards-panels`, `shares-auth` p95 và req/s không
  tệ hơn Directus quá 10%; `utils-sort` chỉ ghi số; đo hằng tuần, không chặn CI (quyết định 003).
- Export 10.000 item: xong trong cùng bậc thời gian với Directus (chỉ ghi số ở bộ đối chiếu, không chặn).

**Constraints**:
- Byte của file xuất, băm argon2 (kiểm chéo), payload JWT share, response registry trùng Directus: cùng bản json2csv,
  js2xmlparser, js-yaml (patch), argon2, ky.
- Không gửi email (D-33, D-34, D-36), không gửi báo cáo chủ dự án (D-38), không cài extension (D-37); GraphQL không
  chạm (D-09.9).
- Express 5 không có regex param: `/shares/info/:pk`, `/extensions/registry/*/:pk`, `/extensions/:pk` kiểm uuid trong
  handler, không khớp → `404 ROUTE_NOT_FOUND` (R4, R6).
- Mọi file port ghi `// Ported from directus/...`; manifest `tools/port-manifest/010-T*.json`.
- Cặp `setup` chỉ Postgres, Redis db index 9; registry giả luôn chạy trong môi trường đối chiếu.
- `/presets`, `/notifications`, `/translations`, `/extensions`, `/settings` vào proxy cùng task đăng ký controller
  (app Directus hydrate gọi chúng).

**Scale/Scope**:
- Port khoảng 450 dòng sáu service nhỏ, 800 dòng import/export, 80 dòng `ExtensionsService` (mới), 400 dòng client
  registry, 700 dòng generate-translations + validation, 70 dòng `createAdmin`, 60 dòng `store`, 50 dòng `tmp`; 1.960
  dòng controller Directus → khoảng 1.700 dòng Nest; test gốc khoảng 2.900 dòng; blackbox copy 1 file (80 dòng) + 3
  file sửa; mới khoảng 2.800 dòng test đối chiếu, 200 dòng compose/env, 150 dòng registry giả, 500 dòng Playwright,
  300 dòng benchmark. Lớn hơn 009: `tasks.md` chia năm nhóm (A: settings, presets, notifications, translations,
  dashboards, panels; B: shares; C: utils, import/export; D: extensions, setup; E: E2E, benchmark, đóng feature).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.4.0. Kết quả dưới đây là lần 2, sau research, data model và contracts
(lần 1 trước research: hai mục XI đã hỏi và được owner trả lời ở Clarifications của spec; không vi phạm).

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`. Mọi file port ghi `// Ported from directus/...` (bảng ánh
  xạ, manifest `010-T*.json`). Chỗ khác nguồn ghi `Backoffice:`: `setOwner` không gửi báo cáo, `invite` ghi log,
  `ExtensionsService` chỉ đọc và bundle hằng, route cài extension trả `503`, kiểm uuid trong handler, guard
  `mail-sites`, test viết mới nơi Directus không có test. Thêm khi implement (2026-10-14): `libs/memory` `BusRedis`
  tạo kết nối subscriber với `enableReadyCheck: false` (a7bdbf3): Directus giữ race ready check `INFO` với `SUBSCRIBE`
  khi Redis còn `LOADING`, app mới chỉ bền hơn, không đổi giao tiếp bus.
- [x] **II. Dùng chung DB**: PASS. Không DDL, không migration trên `directus_*`; `translations/generate` tạo bảng
  người dùng qua 006; `/server/setup` ghi dòng qua service như Directus; `sort` ghi cột sort của collection người dùng
  bằng knex thô như Directus (R-26); `project_status = null` là giá trị Directus ghi khi gửi thành công (D-38).
- [x] **III. API giống hệt**: PASS. Route, middleware, status, mã lỗi, `204`, `404` uuid sai, header của bundle như
  Directus (contracts/system-api.md, utils-api.md). D-09.8, D-14 gỡ; D-31 thu hẹp; D-36, D-37, D-38 ghi trong spec với
  lý do; R-25 đến R-28 tái tạo, bằng chứng đo ở bộ đối chiếu.
- [x] **IV. Chạy song song an toàn**: PASS. Bộ đếm import trong Redis với khóa (`usingLock`) dùng chung hai app; tác
  vụ nền (export, import `background`) thuộc tiến trình nhận request như Directus; memo phiên bản registry 6 giờ trong
  tiến trình như Directus (không ảnh hưởng dữ liệu); cache quyền xóa qua Redis khi sửa share.
- [x] **V. Kiểm thử đối chiếu**: PASS. 13 file `src/system/`, blackbox `mail.test.ts` hai lượt, 3 file blackbox đổi
  đích; Postgres đủ bộ mỗi lần push, MySQL, SQLite rút gọn, còn lại nightly (FR-101).
- [x] **VI. Kiến trúc**: PASS. Tám controller mỏng; mỗi service một factory provider; `ExtensionsService` là lớp
  Backoffice tối giản vì không có extension manager (Nguyên tắc XI); Knex, không ORM; mỗi thay đổi có test.
- [x] **VII. Đa instance**: PASS. Không state quan trọng trong tiến trình; bộ đếm import và cache trên Redis; file tạm
  cục bộ dọn ngay; khởi động chỉ đọc.
- [x] **VIII. Biến môi trường**: PASS. Không biến mới; 11 biến sang nhóm A (gồm ba `ADMIN_*` từ nhóm B vì
  `createAdmin` đọc như Directus); `SERVE_APP` được đọc cho bundle, cảnh báo D-08 giữ (R6, R9).
- [x] **IX. Đổi thương hiệu**: PASS. Giữ `issuer: directus`, namespace `directus:import-export`, tiêu đề thông báo,
  link `/admin/shared/<id>`, `/admin/files/<id>`, tên role `Administrator` (dữ liệu dùng chung). Dòng log mới ghi
  "Backoffice:". Chuỗi `503` "Backoffice does not install extensions" là thông điệp của app mới (D-37).
- [x] **X. Chất lượng và vận hành**: PASS. Coverage 80%. Benchmark hằng tuần (ngoại lệ 003). Playwright là cổng chặn.
  Không gửi email: `invite`, thông báo chạy đúng luồng tới bước gửi rồi ghi log (D-36, D-33); guard tự động sáu chỗ.
  Gỡ D-09.8, D-14, thu hẹp D-31, D-36, D-37, D-38, R-25 đến R-28 cần tech lead duyệt trước khi đóng feature; bảng
  của spec 001, 004 sửa theo.
- [x] **XI. Ngoài phạm vi**: PASS, đã hỏi trước. Hai mục chạm XI (telemetry: báo cáo chủ dự án; extension: route
  registry và quản lý extension) được owner quyết ở Clarifications 2026-10-14 (D-38 không gửi; D-37 duyệt thật, cấm
  cài). Hành vi với extension bằng Directus khi không có extension nào được nạp; với telemetry bằng Directus khi báo
  cáo đã gửi xong. Không email, không GraphQL (011), không WebSocket, AI/MCP, deployment (D-17; D-31 lâu dài cho ba
  collection deployment).

## Project Structure

### Documentation (this feature)

```text
specs/010-system-collections/
├── plan.md              # File này
├── research.md          # Phase 0: R1–R16
├── data-model.md        # Phase 1: tám collection, phiên share, import/export job, admin đầu tiên, env, event
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── system-api.md        # /settings, /presets, /notifications, /shares, /translations, /dashboards, /panels, /extensions, /server/setup
│   ├── utils-api.md         # /utils/*
│   └── parity.md            # môi trường, bộ đối chiếu, cặp setup, registry giả, blackbox, CI, Playwright, benchmark
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

Chỉ liệt kê phần thêm hoặc sửa. Cấu trúc chung giữ như plan 001 đến 009.

```text
backoffice-next/
├── pnpm-workspace.yaml                         # SỬA: catalog ky, papaparse, stream-json, async (+ @types)
├── libs/utils/src/node/tmp.ts (+ test gốc), index.ts      # MỚI ← packages/utils/node/tmp.ts
├── apps/api/package.json                       # SỬA: 4 gói
├── apps/api/src/
│   ├── app.module.ts, providers.ts             # SỬA: 8 controller, 8 useCollection; 9 factory
│   ├── services/settings.service.ts (+ test)   # SỬA ← services/settings.ts (extends ItemsService; setOwner không gửi)
│   ├── services/server.service.ts (+ test)     # SỬA: serverInfo đọc qua readSingleton như Directus
│   ├── services/shares.service.ts (+ test)     # MỚI ← services/shares.ts (invite ghi log)
│   ├── services/translations.service.ts (+ test)   # MỚI ← services/translations.ts
│   ├── services/dashboards.service.ts, panels.service.ts   # MỚI ← services/dashboards.ts, panels.ts
│   ├── services/extensions.service.ts (+ test) # MỚI (Backoffice): readAll, EMPTY_APP_EXTENSION_BUNDLE
│   ├── services/utils.service.ts (+ test)      # MỚI ← services/utils.ts
│   ├── services/import-export.service.ts (+ test gốc)   # SỬA ← services/import-export.ts (ImportService, exportToFile, getHeadingsForCsvExport)
│   ├── services/mail-sites.guard.test.ts       # MỚI (Backoffice): guard sáu chỗ new MailService (FR-091)
│   ├── services/index.ts                       # SỬA
│   ├── extensions/registry/{list,describe,account,get-api-version,assert-version-compatibility,constants}.ts, schemas (+ test gốc)   # MỚI ← packages/extensions-registry/src
│   ├── extensions/registry/fixtures.test.ts    # MỚI: kiểm fixture của registry giả bằng schema
│   ├── utils/create-admin.ts (+ test)          # MỚI ← utils/create-admin.ts
│   ├── utils/store.ts (+ test gốc)             # MỚI ← utils/store.ts
│   ├── utils/destroy-piped-stream.ts           # MỚI ← utils/destroy-piped-stream.ts
│   ├── utils/generate-translations.ts, translations-shared.ts, translations-validation.ts (+ 2 test gốc)   # MỚI ← utils/*
│   ├── utils/get-service.ts (+ test)           # SỬA: 5 collection; COLLECTIONS_WITHOUT_SERVICE_YET còn 3 (lâu dài)
│   ├── controllers/utils/handle-registry-error.ts   # MỚI ← controllers/utils/handle-registry-error.ts
│   ├── controllers/{settings,presets,notifications,shares,translations,dashboards,panels,extensions,utils}.controller.ts (+ test)   # MỚI ← controllers/*.ts (Nest)
│   ├── controllers/server.controller.ts (+ test)   # SỬA: POST /setup
│   ├── middleware/router-options.ts (+ test)   # SỬA: khối Feature 010
│   └── config/supported-variables.ts (+ test)  # SỬA: khối Feature 010; ADMIN_* rời nhóm B
├── specs/001-platform-foundation/contracts/config.md   # SỬA: nhóm A, B, C; SERVE_APP
├── tests/parity/
│   ├── docker-compose.yml                      # SỬA: registry; postgres-setup, directus-setup, backoffice-api-setup
│   ├── env/<vendor>.env (9), env/profile-setup.env   # SỬA: MARKETPLACE_REGISTRY; MỚI
│   ├── registry/server.mjs, registry/fixtures/*.json   # MỚI (R12)
│   ├── src/{config,docker}.ts, scripts/env.mjs, src/vendors.test.ts   # SỬA: profile setup
│   ├── src/suite.ts, src/request-set.ts, src/server/errors.test.ts, src/auth/shares.test.ts   # SỬA
│   ├── proxy/backoffice-routes.txt, src/proxy-conf.test.ts   # SỬA: 9 segment (từng task)
│   ├── accepted-differences.ts                 # SỬA: xóa D-09.8, D-14; D-31; D-36, D-37, D-38 (đóng feature)
│   ├── README.md                               # SỬA: mục 010
│   ├── src/system/                             # MỚI (contracts/parity.md §2)
│   │   ├── helpers.ts
│   │   └── {settings,presets,notifications,shares,translations,insights,extensions,utils-misc,import-export,setup,e2e-app}.test.ts
│   └── src/items/blackbox/
│       ├── tests/db/mail/mail.test.ts          # MỚI (copy, đổi kiểm theo D-33)
│       ├── common/{functions,config}.ts, ../cache-blackbox.test.ts   # SỬA: /presets, /utils tới app đang kiểm
├── tests/directus-app-e2e/src/{system,setup}.spec.ts   # MỚI (R13); routing.spec.ts SỬA
├── tests/benchmark/src/{system,seed-system}.ts # MỚI; project.json SỬA
├── tools/port-manifest/010-T*.json             # MỚI
├── tools/ci-local.sh                           # SỬA: setup trong profiles Postgres và E2E
├── .github/workflows/{ci,parity-matrix,nightly,benchmark}.yml   # SỬA (contracts/parity.md §6)
├── specs/001-platform-foundation/spec.md       # SỬA: D-09.8, D-14
└── specs/004-permissions/spec.md               # SỬA: D-31
```

**Structure Decision**:
- Theo cấu trúc 001 đến 009: file của `directus/api/src` vào cùng đường dẫn trong `apps/api/src`; service và
  controller có hậu tố `.service.ts`, `.controller.ts`; client registry vào `apps/api/src/extensions/registry/` (gói
  Directus riêng, không có chỗ tương ứng trong `api/src`).
- Blackbox 010 thêm vào cây `tests/parity/src/items/blackbox/` (cùng shim) như 005 đến 009.
- Test đối chiếu mới đặt trong `tests/parity/src/system/`.

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/`) | Đích | Ghi chú |
|---------------------|------|---------|
| `api/src/services/settings.ts` | `apps/api/src/services/settings.service.ts` | `setOwner` không `sendReport` (D-38); thay bản 001 |
| `api/src/services/shares.ts` | `apps/api/src/services/shares.service.ts` | `invite` ghi log (D-36); test mới |
| `api/src/services/translations.ts` | `apps/api/src/services/translations.service.ts` | Nguyên; test mới |
| `api/src/services/{dashboards,panels}.ts` | `apps/api/src/services/*.service.ts` | Nguyên |
| `api/src/services/utils.ts` | `apps/api/src/services/utils.service.ts` | Nguyên; test mới |
| `api/src/services/import-export.ts` (+ test) | `apps/api/src/services/import-export.service.ts` | Phần còn lại; test gốc 37 ca |
| `api/src/services/extensions.ts` | `apps/api/src/services/extensions.service.ts` | Chỉ `readAll` dạng đọc (Backoffice); test mới |
| `api/src/controllers/{settings,presets,notifications,shares,translations,dashboards,panels,extensions,utils}.ts` | `apps/api/src/controllers/*.controller.ts` | Nest; uuid trong handler; test mới |
| `api/src/controllers/server.ts` (`/setup`) | `apps/api/src/controllers/server.controller.ts` | Thêm handler |
| `api/src/controllers/utils/handle-registry-error.ts` | `apps/api/src/controllers/utils/handle-registry-error.ts` | Nguyên |
| `api/src/utils/create-admin.ts` | `apps/api/src/utils/create-admin.ts` | Nguyên; test mới |
| `api/src/utils/store.ts` (+ test) | `apps/api/src/utils/store.ts` | Nguyên |
| `api/src/utils/destroy-piped-stream.ts` | `apps/api/src/utils/destroy-piped-stream.ts` | Nguyên |
| `api/src/utils/{generate-translations,translations-shared,translations-validation}.ts` (+ 2 test) | `apps/api/src/utils/` | Nguyên |
| `packages/extensions-registry/src/{constants,modules/{list,describe,account},utils,schemas}` (+ test) | `apps/api/src/extensions/registry/` | Không `download`; `@directus/*` → `@backoffice/*` |
| `packages/utils/node/tmp.ts` (+ test) | `libs/utils/src/node/tmp.ts` | Nguyên |
| `tests/blackbox/tests/db/mail/mail.test.ts` | `tests/parity/src/items/blackbox/tests/db/mail/` | Copy; kiểm đổi theo D-33 |

### Phần không port hoặc hoãn

| Phần | Lý do | Thay ở |
|------|-------|--------|
| `telemetry/lib/send-report.ts`, `schedules/project.ts` | Nguyên tắc XI; D-38 | log cảnh báo |
| `services/mail/*`, `utils/md.ts` | Nguyên tắc X, XI; D-33, D-36 | log cảnh báo |
| `extensions/manager.ts`, `services/extensions.ts` (install, uninstall, updateOne, deleteOne), rollup bundle | Nguyên tắc XI; D-37 | `ExtensionsService` đọc, bundle hằng, `503`/`403` |
| `packages/extensions-registry` module `download` | chỉ dùng khi cài extension | — |
| `services/deployment*.ts` | Nguyên tắc XI (D-17, D-31 lâu dài) | `ItemsService` chung |
| GraphQL của các collection này | D-09.9 | 011 |
| Màn hình Settings, Insights, Notifications của app mới | FE | 016, 018 |

## Complexity Tracking

Không có vi phạm constitution. Ghi nhận cần tech lead duyệt khi đóng feature (Nguyên tắc X): gỡ D-09.8, D-14; D-31
thu hẹp và thành lâu dài (ba collection deployment đi qua `ItemsService` chung; `PayloadService` vẫn mã hóa field
`conceal`/`hash` theo schema nhưng không có kiểm tra `credentials`, `provider` của `DeploymentService`; chỉ admin chạm
tới); D-36, D-37, D-38; R-25 đến R-28 với bằng chứng đo.

Ngoại lệ đã duyệt của 001 đến 009 vẫn áp dụng: benchmark hằng tuần thay vì chặn CI (003); store `memory` với cảnh báo
một instance (001); D-08 app web ở container riêng (`SERVE_APP` nay được đọc cho một route, cảnh báo giữ).

Rủi ro đã biết, theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| Bundle rỗng của container Directus khác chuỗi đo bằng rollup trên máy dev (phiên bản plugin, định dạng) | `extensions.test.ts` đỏ ở ca byte | Task đầu của extensions `curl` `/extensions/sources/index.js` của Directus trong môi trường đối chiếu và chốt hằng theo kết quả; ghi ngày đo vào research R6 |
| `GET /extensions` của user thường: Directus trả `403` hay `[]` tùy quyền tối thiểu; app Directus có gọi khi không phải admin | `extensions.test.ts` đỏ; app qua proxy hỏng cho user thường | Đo ở task đầu với user app access ở Directus; app mới dùng `ItemsService` với accountability nên theo Directus |
| Nhập CSV/JSON lệch ở chi tiết (`dynamicTyping`, đường dẫn khóa `a.b`, thứ tự lỗi, `rows`) | SC-002, SC-003 đỏ | Port nguyên và chạy 37 unit test gốc trước bộ đối chiếu; `import-export.test.ts` so `errors[]` nguyên văn |
| File xuất khác byte (thứ tự cột CSV từ `parseFields`, BOM `csv_utf8`, `\t` của JSON) | `import-export.test.ts` đỏ | So từng format trên collection có quan hệ và `fields` lồng; `transform` đã trùng từ 005 |
| Cặp `setup`: bootstrap của image Directus với `ADMIN_EMAIL=` rỗng vẫn tạo user, hoặc schema cache Redis chéo cặp chính | `setup.test.ts` đỏ hoặc cặp chính lỗi | Task đầu của D: dựng cặp, kiểm `directus_users` trống và `/server/info` `setup: false`; Redis db index 9 cô lập key; nếu `REDIS` URL với db index không được một app nhận thì chuyển sang bộ namespace riêng như `retention` |
| `page.route` trong `setup.spec.ts` không bắt được request (service worker, redirect) | E2E setup đỏ ở lượt Backoffice | Dự phòng: gọi `POST /server/setup` ở app mới bằng `request` của Playwright rồi mở app kiểm màn đăng nhập |
| Registry giả lệch schema zod (`describe`, `account` nhiều field) | `503` ở cả hai app, ca happy path đỏ | `fixtures.test.ts` parse fixture bằng schema port trước khi dựng dịch vụ |
| Bộ đếm import chung: TTL `1h` và lock `usingLock` của `@backoffice/memory` khác chữ ký với `@directus/memory` | `429` sai hoặc đếm không giảm | Unit test gốc `store.test.ts`; `import-export.test.ts` đọc khóa Redis trực tiếp |
| `SharesService.login` xóa phiên hết hạn của mọi user: suite khác đang dùng phiên gần hết hạn | Ca refresh của 003 đỏ ngẫu nhiên | TTL của môi trường đối chiếu dài (mặc định 7 ngày), không có phiên gần hạn; ghi nhận |
| Thêm `settings` vào proxy khi `PATCH /settings` chưa đủ: app Directus đọc được nhưng trang Project lưu lỗi | E2E đỏ giữa các phase | Mỗi controller làm trọn CRUD trong một task rồi mới thêm vào proxy |
| Guard `accepted-differences` đỏ khi xóa D-09.8, D-14 trước khi spec `Done`; D-37 cần entry `http` đúng endpoint | CI đỏ | Xóa và thêm entry trong commit đóng feature (tiền lệ 007 đến 009) |
| `ADMIN_*` rời nhóm B: test `warn-unsupported-variables` và contracts/config.md của 001 | Unit test đỏ | Sửa cùng task với `supported-variables` |
