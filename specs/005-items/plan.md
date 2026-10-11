# Implementation Plan: Items (CRUD `/items`, response cache, export, event, bus `websocket.event`)

**Branch**: `005-items` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-items/spec.md`

## Summary

App mới có route `/items/:collection` giống hệt Directus 11.17.4 (CRUD từng cái và hàng loạt, `SEARCH`, singleton) trên
engine đọc ghi đã port ở 004; thêm response cache dùng chung Redis với Directus (cùng key, cùng header, gỡ D-11),
xuất file qua `export` (gỡ D-12), emitter thật phát mọi event như Directus (thu hẹp D-26, D-29) và cầu nối
`websocket.event` lên bus theo cùng điều kiện `WEBSOCKETS_*` (gỡ D-30). Tiêu chí chấp nhận: bộ blackbox items, query,
relational của Directus chạy qua ở cả hai app trên Postgres, MySQL, SQLite.

Cách làm:

- Port nguyên vẹn, cùng đường dẫn, kèm test gốc: `collection-exists`, `get-cache-key` (bỏ nhánh flow, GraphQL),
  `get-cache-headers`, `should-skip-cache`, `permissions-cacheable`, `get-string-byte-size`, `middleware/cache`,
  `middleware/respond` (đủ), `ExportService.transform`, `emitter`, `websocket/controllers/hooks` (research R2, R3, R7,
  R8). Không sửa service nào: mọi lời gọi emitter đã có từ 004.
- `ItemsController` Nest mỏng theo thứ tự route của file gốc; `collectionExists` và `validateBatch` chạy qua
  `runMiddleware`; `respond` thành `respond(req, res)` ở 82 chỗ gọi của 7 controller cũ (R2).
- Cầu nối bus đăng ký khi `WEBSOCKETS_ENABLED` và (`WEBSOCKETS_REST_ENABLED` hoặc `WEBSOCKETS_GRAPHQL_ENABLED`), như
  điểm gọi của Directus (Clarifications, R8).
- Bộ đối chiếu: bộ blackbox copy nguyên cấu trúc với shim `@common` (GraphQL về Directus tới 011, bỏ khối WebSocket),
  chạy hai lượt theo app (R6); cặp chính giữ cache bật với `CACHE_SKIP_ALLOWED=true` và bộ so sánh gửi `Cache-Control:
  no-store` (R4); bốn cặp cache và một cặp WebSocket (R5); test `crud`, `export`, `cache-cross`, `bus` (R9); Playwright
  module Content và tải CSV (R12); benchmark 10 triệu dòng hằng tuần (R11).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (bộ cờ strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS, ESM, pnpm
10.27.0, Nx 23.3. Giữ như 001 đến 004.

**Primary Dependencies**:
- Đã có: NestJS 12.1.2 (Express 5.2.1, `@Search()`), knex 3.1.0, ioredis 5.8.2, keyv 5.5.3 + `@keyv/redis`, joi 18.2.6,
  `object-hash` 3.0.0, `bytes` 3.1.2, `js-yaml` 4.3.2 (bản vá, Directus 4.1.1), `snappy` (nén giá trị cache),
  `@backoffice/utils` (`getEndpoint`, `getDateTimeFormatted`, `ipInNetworks`), `@backoffice/system-data`
  (`systemCollectionRows`, `systemCollectionNames`, `isSystemCollection`), `@backoffice/memory` (bus).
- Thêm vào catalog, cùng bản Directus (research R1): `json2csv` 5.0.7 + `@types/json2csv`, `js2xmlparser` 5.0.0,
  `eventemitter2` 6.4.9; cho `tests/parity`: `supertest` 7.1.4 + `@types/supertest` (catalog có), `json-to-graphql-query`
  2.3.0, `seedrandom` 3.0.5 + `@types/seedrandom`.
- Không thêm `graphql-ws`, `ws`, `stream-json`, `papaparse`, `async`, `pg-copy-streams`.

**Storage**:
- DB dùng chung, không DDL. Ghi qua `ItemsService` (004): collection người dùng, `directus_activity`,
  `directus_revisions` (contracts/items-api.md §6). Collection của test tạo qua API của Directus (006 chưa có).
- Redis dùng chung ([data-model.md §6](./data-model.md)): cache dữ liệu `<CACHE_NAMESPACE>:<hash>` và `<hash>__expires_at`
  (cùng công thức key với Directus), kênh bus `websocket.event`; không key hay kênh nào Directus không dùng.

**Testing**:
- Vitest 3.2.4: test port (`get-cache-key`, `get-cache-headers`, `should-skip-cache`, `permissions-cacheable`,
  `import-export` phần `transform`), test mới cho `respond`, `cache`, `collection-exists`, `items.controller`, `emitter`,
  `hooks`, `router-options` (research R13). Coverage 80% `apps/api`.
- `tests/parity`: `src/items/` (R9) và `src/items/blackbox/` (R6, hai lượt theo app); suite mới `blackbox`, `cache`;
  profile `cache-mem`, `cache-mem-purge`, `cache-redis`, `cache-redis-purge`, `websocket` (R5); env cặp chính thêm
  `CACHE_SKIP_ALLOWED=true`, `CACHE_STATUS_HEADER` (R4). Job CI mới `parity-blackbox`, `parity-cache`; `parity-matrix.yml`
  thêm `blackbox-full` MySQL, SQLite ([contracts/parity-blackbox.md](./contracts/parity-blackbox.md) §6).
- `tests/directus-app-e2e`: `items.spec.ts` qua proxy, `items` vào `backoffice-routes.txt` (R12).
- `tests/benchmark`: `items.ts`, `seed-items.ts`, job `benchmark-items` hằng tuần (R11).

**Target Platform**: Container Linux, nhiều replica cạnh Directus sau load balancer, không sticky session. Giữ như 001.

**Project Type**: Monorepo web (Nx). Feature này chạm BE và test: `apps/api`, `tests/parity`, `tests/directus-app-e2e`,
`tests/benchmark`, CI, catalog. Không chạm `libs/*` (mọi util cần đã có).

**Performance Goals**:
- SC-006: collection 10 triệu dòng (Clarifications), p95 và req/s của list có filter và sort, by id, `POST`, `PATCH`,
  `DELETE` với admin và user có filter quyền, ở chế độ tươi và `HIT`, không tệ hơn Directus quá 10%; đo hằng tuần,
  không chặn CI (quyết định 003, 004).
- SC-003: `HIT` chéo hai chiều 100%; cùng key và giá trị 100%.
- Endpoint của 001 đến 004 giữ ngưỡng cũ (benchmark `run.ts`, `auth.ts`, `permissions.ts` chuyển sang header
  `Cache-Control: no-store` thay `directus-noresponsecache`, R10).

**Constraints**:
- Mọi route đi qua `respond` mới: chạy lại toàn bộ bộ đối chiếu 001 đến 004 (FR-047) sau gói cache.
- Response export trùng từng byte (thư viện cùng bản, R1); key cache trùng Directus (R3, đo sớm).
- Cầu nối bus chỉ khi `WEBSOCKETS_*` cho phép; app mới không mở WebSocket (Nguyên tắc XI).
- Không thêm biến `BACKOFFICE_*`; bảy biến chuyển nhóm A ([contracts/config.md](./contracts/config.md)).
- Mọi file port ghi `// Ported from directus/...`; manifest `tools/port-manifest/005-T*.json`.
- Tái tạo R-07, R-08 (Clarifications).

**Scale/Scope**:
- Port khoảng 1.100 dòng code (`respond` 130, `cache` 70, bốn util 200, `collection-exists` 30, `ExportService`
  rút gọn 90, `emitter` 110, `hooks` 160, controller 230 → Nest) và khoảng 600 dòng test gốc; blackbox copy khoảng
  9.000 dòng (11 file test, seed, `query/filter`, `schema/*`, `seed-functions`) với shim khoảng 300 dòng; mới khoảng
  2.000 dòng test đối chiếu, 300 dòng Playwright, 300 dòng benchmark, compose và env. Nhỏ hơn 004 (không port engine);
  tách `tasks.md` theo research R14 nếu vượt khoảng 60 task.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.3.0. Kiểm lần 1 trước research: không có vi phạm chưa giải thích. Kết
quả dưới đây là lần 2, sau research, data model và contracts.

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`. Mọi file port ghi `// Ported from directus/...` (bảng ánh
  xạ bên dưới, manifest `tools/port-manifest/005-T*.json`). Chỗ khác nguồn ghi `Backoffice:`: `getCacheKey` bỏ nhánh
  flow và GraphQL, `cache` bỏ telemetry, `ExportService` chỉ `transform`, `WebSocketEvent` type thuần, điểm gọi
  `registerWebSocketEvents` trong `app.ts`, `respond(req, res)`, controller Nest, khối WebSocket bỏ trong file blackbox.
- [x] **II. Dùng chung DB**: PASS. Không DDL, không migration (benchmark nạp dữ liệu vào bảng do Directus tạo qua API,
  chỉ `INSERT`). Dòng ghi giống Directus vì đi qua `ItemsService` port nguyên (SC-002 so trên ba vendor).
- [x] **III. API giống hệt**: PASS. Route, thứ tự, query, body, status, mã lỗi, message, header (`Cache-Control`,
  `Vary`, `CACHE_STATUS_HEADER`, `Content-Disposition`, `Content-Type`), `OPTIONS` như Directus
  (contracts/items-api.md, cache.md, export.md). Khác biệt còn lại: D-09.6 (`version`, 008), D-26 và D-29 thu hẹp
  (flow, 009); không có khác biệt mới.
- [x] **IV. Chạy song song an toàn**: PASS. Cùng key và giá trị cache dữ liệu (`object-hash` của cùng object,
  `DIRECTUS_COMPAT_VERSION`), cùng kênh bus `websocket.event`, cùng điểm xóa cache (004). `HIT` chéo và purge chéo
  kiểm ở `cache-cross.test.ts`. Không state quan trọng trong process (data-model.md §7).
- [x] **V. Kiểm thử đối chiếu**: PASS. `/items` có `crud.test.ts`, `request-set`, blackbox hai lượt (R6); cache, export,
  bus có test riêng (R9); chạy lại 001 đến 004 (FR-047). Postgres đủ mỗi lần push (`parity`, `parity-blackbox`,
  `parity-cache`); MySQL, SQLite rút gọn mỗi lần push và đủ ở `parity-matrix.yml` (Clarifications); nightly giữ như 001.
- [x] **VI. Kiến trúc**: PASS. `ItemsController` Nest mỏng; `ItemsService`, `MetaService`, `ExportService` là lớp Directus,
  factory trong `providers.ts` khi controller cần; middleware và util giữ dạng hàm. Knex, không ORM. Mỗi thay đổi có
  test (R13).
- [x] **VII. Đa instance**: PASS. Cache dữ liệu ở Redis khi `CACHE_STORE=redis`; store `memory` giữ cảnh báo một
  instance của 001. Listener của emitter dựng lại khi khởi động. Khởi động chỉ đọc (đăng ký listener không ghi gì).
  Không lock hay cron mới.
- [x] **VIII. Biến môi trường**: PASS. Bảy biến chuyển nhóm A với cùng tên, mặc định, kiểu (contracts/config.md);
  không biến mới; `WEBSOCKETS_*` còn lại và biến import, export nền vẫn nhóm C.
- [x] **IX. Đổi thương hiệu**: PASS. Giữ: tên kênh `websocket.event`, tên event, tên file export `Export`, tiền tố log
  `[cache]`, `version: '11.17.4'` trong key cache (định danh kỹ thuật dùng chung), tên collection `directus_*`. Không
  nhãn người dùng mới.
- [x] **X. Chất lượng và vận hành**: PASS. Coverage 80% `apps/api`. Benchmark hằng tuần (ngoại lệ đã duyệt ở 003).
  Playwright là cổng chặn (004). Không gửi email. Khác biệt và rủi ro (R-07, R-08) ghi ở spec, cần tech lead duyệt
  trước khi đóng feature; bảng của spec 001, 003, 004 sửa theo (R10).
- [x] **XI. Ngoài phạm vi**: PASS. Không mở WebSocket (chỉ publish bus theo điều kiện của Directus; khối WebSocket
  của blackbox bỏ); không GraphQL (GraphQL của blackbox về Directus tới 011); không extension (emitter có listener duy
  nhất là cầu nối); không telemetry (`requestCounter`, bộ đếm `cached`); import, export nền thuộc 010.

## Project Structure

### Documentation (this feature)

```text
specs/005-items/
├── plan.md              # File này
├── research.md          # Phase 0: R1–R14
├── data-model.md        # Phase 1: thực thể, bản cache, file export, event, thông điệp bus, Redis, state
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── items-api.md         # route, collectionExists, singleton, OPTIONS, thứ tự lỗi
│   ├── cache.md             # middleware cache, respond, shouldSkipCache, bảng Cache-Control, bộ đối chiếu
│   ├── export.md            # định dạng, tên file, header, trường hợp biên
│   ├── events-bus.md        # Emitter, event đã phát, ánh xạ thông điệp bus, điều kiện đăng ký
│   ├── config.md            # biến chuyển nhóm A, env của môi trường đối chiếu
│   └── parity-blackbox.md   # port blackbox, shim, suite, profile, CI, Playwright, benchmark
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

Chỉ liệt kê phần thêm hoặc sửa. Cấu trúc chung giữ như plan 001 đến 004.

```text
backoffice-next/
├── pnpm-workspace.yaml                         # catalog: json2csv, @types/json2csv, js2xmlparser, eventemitter2,
│                                               #   json-to-graphql-query, seedrandom, @types/seedrandom
├── apps/api/
│   ├── package.json                            # SỬA: json2csv, js2xmlparser, js-yaml, eventemitter2
│   └── src/
│       ├── app.ts                              # SỬA: registerWebSocketEvents() theo WEBSOCKETS_* (R8)
│       ├── app.module.ts, providers.ts         # SỬA: ItemsController; factory ItemsService, ExportService
│       ├── emitter.ts                          # THAY ← emitter.ts (eventemitter2); emitter.test.ts THAY
│       ├── websocket/messages.ts               # MỚI: type WebSocketEvent (thuần)
│       ├── websocket/controllers/hooks.ts      # MỚI ← websocket/controllers/hooks.ts (+ test mới)
│       ├── middleware/collection-exists.ts     # MỚI ← middleware/collection-exists.ts (+ test mới)
│       ├── middleware/cache.ts                 # THAY ← middleware/cache.ts đủ (bỏ telemetry); cache.test.ts THAY
│       ├── middleware/respond.ts               # THAY ← middleware/respond.ts đủ, respond(req, res); respond.test.ts THAY
│       ├── middleware/router-options.ts        # SỬA: hai dòng /items (contracts/items-api.md §3)
│       ├── utils/{get-cache-key,get-cache-headers,should-skip-cache,permissions-cacheable,get-string-byte-size}.ts
│       │                                       # MỚI ← utils/*.ts (+ 4 test gốc)
│       ├── services/import-export.service.ts   # MỚI ← services/import-export.ts (ExportService.transform; + test gốc phần transform)
│       ├── services/index.ts                   # SỬA: export ExportService
│       ├── controllers/items.controller.ts     # MỚI ← controllers/items.ts (Nest; + test mới)
│       ├── controllers/{auth,server,users,roles,policies,access,permissions}.controller.ts   # SỬA: respond(req, res)
│       └── config/supported-variables.ts       # SỬA: contracts/config.md §1
├── tests/parity/
│   ├── package.json                            # SỬA: supertest, json-to-graphql-query, seedrandom (+types)
│   ├── docker-compose.yml                      # SỬA: 5 cặp profile (R5), redis-cache
│   ├── env/<vendor>.env (9 file)               # SỬA: CACHE_SKIP_ALLOWED=true, CACHE_STATUS_HEADER=x-cache-status
│   ├── env/profile-{cache-mem,cache-mem-purge,cache-redis,cache-redis-purge,websocket}.env   # MỚI
│   ├── env/profile-cache-config.env            # SỬA: ghi chú
│   ├── proxy/backoffice-routes.txt             # SỬA: items
│   ├── accepted-differences.ts                 # SỬA: research R10
│   ├── README.md                               # SỬA: mục 005, ghi chú D-11
│   ├── scripts/parity.mjs                      # SỬA: suite blackbox chạy hai lượt
│   ├── vitest.parity.config.ts                 # SỬA: suite blackbox, cache
│   ├── src/{suite,config,parity,request-set,global-setup}.ts   # SỬA
│   ├── src/items/cache-redis-down.test.ts      # MỚI: Redis của cặp cache-redis dừng (FR-016, R-10)
│   └── src/items/
│       ├── crud.test.ts, export.test.ts, cache-blackbox.test.ts, cache-cross.test.ts, bus.test.ts   # MỚI (R9)
│       └── blackbox/                           # MỚI (R6, contracts/parity-blackbox.md §1, §2)
│           ├── vitest.blackbox.config.ts, 00-seed.test.ts, sequencer.ts
│           ├── common/{config,functions,transport,get-dbs-to-test,seed-functions,types,variables}.ts
│           └── tests/db/{routes/items/**,query/**,schema/**}
├── tests/directus-app-e2e/src/items.spec.ts    # MỚI (R12); routing.spec.ts SỬA
├── tests/benchmark/
│   ├── src/{items,seed-items}.ts               # MỚI (R11)
│   ├── src/{run,auth,permissions}.ts           # SỬA: header Cache-Control: no-store thay directus-noresponsecache (R10)
│   ├── docker-compose.yml, project.json        # SỬA: target items; bỏ directus-noresponsecache nếu không còn dùng
├── tools/port-manifest/005-T*.json             # MỚI
├── tools/ci-local.sh                           # SỬA: parity-blackbox, parity-cache
├── .github/workflows/ci.yml                    # SỬA: job parity (mysql, sqlite3 thêm blackbox rút gọn), parity-blackbox, parity-cache, e2e, publish.needs
├── .github/workflows/parity-matrix.yml         # SỬA: job blackbox-full (mysql, sqlite3)
├── .github/workflows/benchmark.yml             # SỬA: job benchmark-items
├── specs/001-platform-foundation/spec.md       # SỬA: D-09.3, D-11, D-12 (R10)
├── specs/003-auth-session/spec.md              # SỬA: D-26 (R10)
└── specs/004-permissions/spec.md               # SỬA: D-29, D-30, dòng D-11 (R10)
```

**Structure Decision**:
- Theo cấu trúc 001 đến 004: file của `directus/api/src` vào cùng đường dẫn trong `apps/api/src`; service và
  controller có hậu tố `.service.ts`, `.controller.ts`.
- Bộ blackbox port giữ nguyên cấu trúc thư mục của `directus/tests/blackbox` dưới `tests/parity/src/items/blackbox/`
  với shim `@common` (contracts/parity-blackbox.md §2), là dự án vitest riêng chạy hai lượt theo app.
- Test đối chiếu mới đặt trong `tests/parity/src/items/`; profile cache và WebSocket là cặp riêng trong
  `docker-compose.yml` chạy ở job CI riêng.

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/`) | Đích | Ghi chú |
|---------------------|------|---------|
| `api/src/controllers/items.ts` | `apps/api/src/controllers/items.controller.ts` | Nest, cùng thứ tự route (R2); test mới |
| `api/src/middleware/collection-exists.ts` | cùng đường dẫn | Nguyên vẹn; test mới |
| `api/src/middleware/respond.ts` | cùng đường dẫn | Đủ; `respond(req, res)`; test mới |
| `api/src/middleware/cache.ts` | cùng đường dẫn | Đủ, bỏ `useBufferedCounter`; test mới |
| `api/src/utils/get-cache-key.ts` (+ test) | `apps/api/src/utils/` | Bỏ `getFlowManager` (009), `getGraphqlQueryAndVariables` (011); `version` = `DIRECTUS_COMPAT_VERSION` |
| `api/src/utils/{get-cache-headers,should-skip-cache,permissions-cacheable,get-string-byte-size}.ts` (+ test) | `apps/api/src/utils/` | Nguyên vẹn |
| `api/src/services/import-export.ts` (`ExportService.transform`, + test phần đó) | `apps/api/src/services/import-export.service.ts` | `exportToFile`, `ImportService` → 010 |
| `api/src/emitter.ts` | `apps/api/src/emitter.ts` | Thay stub của 004; test mới |
| `api/src/websocket/controllers/hooks.ts` | cùng đường dẫn | Nguyên vẹn; `WebSocketEvent` type thuần; test mới |
| `api/src/websocket/messages.ts` (`WebSocketEvent`) | `apps/api/src/websocket/messages.ts` | Chỉ type, không zod |
| `tests/blackbox/tests/db/routes/items/*.{test,seed}.ts`, `seed-all-field-types.ts`, `seed-relational-fields.ts`, `tests/db/query/**`, `tests/db/schema/**` (trừ `timezone`), `common/{seed-functions,types,variables}.ts` | `tests/parity/src/items/blackbox/...` | Copy nguyên; khối WebSocket bỏ (R6) |
| `tests/blackbox/common/{config,functions,transport,get-dbs-to-test}.ts` | `tests/parity/src/items/blackbox/common/` | Shim (contracts/parity-blackbox.md §2) |
| `tests/blackbox/tests/db/app/cache.{test,seed}.ts`, `tests/db/routes/permissions/cache-purge.{test,seed}.ts` | `tests/parity/src/items/cache-blackbox.test.ts` | Bốn process → bốn cặp profile (R5) |
| `tests/blackbox/setup/sequencer.ts` | `tests/parity/src/items/blackbox/sequencer.ts` | Rút gọn: seed trước |

### Phần port rút gọn tạm thời (sau feature này)

| Phần | Ở feature 005 | Thay ở |
|------|---------------|--------|
| `getCacheKey` | Không có `rawQuery` của `/flows/trigger`, không có GraphQL | 009, 011 |
| `cache`, `respond` cho `/graphql` | Nhánh `originalUrl.startsWith('/graphql')` giữ trong code, chưa có route | 011 |
| `ExportService` | Chỉ `transform` | 010 (`exportToFile`, `ImportService`) |
| Hook `fields.*`, `files.*`, `relations.*`, `items.sort` của cầu nối | Có, chưa có event nào phát | 006, 007, 010 |
| Flow theo event | Không có listener | 009 (D-26, D-29 thu hẹp) |
| Query `version` trên `/items` | Hành vi của `ItemsService` 004 (D-09.6) | 008 |
| GraphQL của blackbox | Về Directus | 011 |
| `res.locals.cacheInstance`, `cacheTTL` | Port, chưa route nào đặt | 007 |
| `requestCounter`, bộ đếm `cached` | Không port (telemetry) | — |

## Complexity Tracking

Không có vi phạm mới. Các ngoại lệ đã duyệt của 001 đến 004 vẫn áp dụng: benchmark chạy hằng tuần thay vì chặn CI
(003); store `memory` với cảnh báo một instance (001); bus và lock local khi không có Redis (002). Thu hẹp D-26, D-29 và
gỡ D-09.3, D-11, D-12, D-30, cùng R-07, R-08, cần tech lead duyệt trước khi đóng feature (Nguyên tắc X).

Rủi ro đã biết, theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| Key cache lệch Directus (`object-hash` băm cả `undefined`, thứ tự key của `sanitizedQuery`) | `HIT` chéo không xảy ra, SC-003 đỏ | Task đo key cho 10 query mẫu ở hai app trước khi port phần còn lại (R3) |
| Byte export lệch (`js-yaml` 4.3.2 với 4.1.1; charset do Express thêm) | SC-004 đỏ | Ca FR-044 từng định dạng; nếu lệch ở YAML thì hỏi chủ dự án (R1) |
| `respond(req, res)` đổi 82 chỗ gọi | Route cũ đỏ | Một task, chạy lại `full` ngay sau (FR-047) |
| Bộ blackbox: ca fail trên chính Directus ở MySQL (001 ghi 4 lỗi có sẵn) | Lượt `directus` đỏ | `it.skipIf` theo vendor kèm ghi chú (Assumptions của spec) |
| Bộ blackbox chạy lâu (`[Suy luận]` 660 ca mỗi lượt) | Job quá 60 phút | Job riêng `parity-blackbox`; MySQL, SQLite rút gọn một kiểu khóa; đủ ở workflow hằng tuần |
| Năm cặp container thêm | Runner hết bộ nhớ | Job riêng `parity-cache` chỉ bật năm cặp đó (R5) |
| 10 triệu dòng trên runner | Hết đĩa, seed lâu | `generate_series`, index tối thiểu; đo lần đầu, chủ dự án chọn lại nếu không chứa nổi (R11) |
| Guard `accepted-differences` đỏ khi sửa bảng 001, 003, 004 hoặc `removeAt` | CI đỏ | Sửa spec và entry trong cùng commit; xóa entry `removeAt: '005'` khi đóng feature (R10) |
| GraphQL của blackbox về Directus trả bản cache cũ | Ca đỏ giả | Cặp chính `CACHE_AUTO_PURGE=true`: mọi thao tác ghi xóa cache dùng chung (R6) |
| Bus `@backoffice/memory` mã hóa kênh và thông điệp (namespace, JSON) | Subscriber của `bus.test.ts` không thấy | Đọc cách gói publish khi làm; subscribe bằng pattern (R9) |
