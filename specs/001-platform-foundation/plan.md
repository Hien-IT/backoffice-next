# Implementation Plan: Nền tảng workspace và kết nối hệ thống

**Branch**: `001-platform-foundation` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-platform-foundation/spec.md`

## Summary

Dựng monorepo Nx gồm `apps/api` (NestJS 12, ESM), `apps/web` (Vue 3, khung tối thiểu) và các thư viện
`@backoffice/*` port từ `directus/packages/*`. API đọc cấu hình đúng như Directus 11.17.4 (port nguyên
`@directus/env`), kết nối 6 loại DB qua Knex và Redis, kiểm tra `directus_migrations` (101 version +
migration tùy biến) và dừng khi lệch, không bao giờ ghi DB. API phục vụ `/server/ping`,
`/server/health`, `/server/info`, `/server/specs/oas` (cho public) và `/metrics` với cùng response
như Directus, cùng định dạng lỗi, cùng log pino và metric prom-client. Cách làm: port từng file Directus
tương ứng (ghi nguồn ở đầu file), giữ đúng thứ tự middleware của `directus/api/src/app.ts`, giữ đúng
phiên bản các thư viện quyết định định dạng dữ liệu dùng chung. Kèm bộ test đối chiếu chạy cùng request
trên Directus thật và API mới (cùng file env), benchmark autocannon và pipeline GitHub Actions.

Chi tiết quyết định: [research.md](./research.md). Thực thể và dữ liệu đọc: [data-model.md](./data-model.md).
Contract: [contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (bộ cờ strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS,
ESM (`"type": "module"`), pnpm 10.27.0.

**Primary Dependencies**:
- Workspace: Nx 23.3 (`@nx/js`, `@nx/nest`, `@nx/vite`, `@nx/vitest`, `@nx/eslint`, `@nx/playwright`).
- API: NestJS 12.1 (`@nestjs/platform-express`, Express 5.2), biên dịch SWC 1.16 (`@nx/js:swc`).
- Cùng phiên bản Directus 11.17.4 (vì quyết định dữ liệu dùng chung hoặc hành vi nhìn thấy được):
  knex 3.1.0, pg 8.16.3, mysql2 3.15.3, sqlite3 5.1.7, tedious 18.6.1, oracledb 6.10.0, ioredis 5.8.2,
  keyv 5.5.3, @keyv/redis 3.0.1, rate-limiter-flexible 7.2.0, pino 9.7.0, pino-http 10.5.0,
  pino-http-print 3.1.0, pino-pretty 13.1.2, prom-client 15.1.3, cron 4.3.4, @godaddy/terminus 4.12.1,
  helmet 8.1.0, cors 2.8.5, cookie-parser 1.4.7, body-parser 1.20.3, qs 6.14.2, proxy-addr 2.0.7,
  object-hash 3.0.0, lodash-es 4.18.1, nanoid 5.1.6, ms 2.1.3, bytes 3.1.2, camelcase 8.0.0,
  dotenv 17.2.3, js-yaml 4.1.1, @aws-sdk/client-s3 3.928.0, @aws-sdk/lib-storage 3.928.0,
  @smithy/node-http-handler 4.4.5, swagger-cli 4.0.4.
- Web: Vue 3.5, Vite 7.3, PrimeVue 5.0 + @primeuix/themes 3.0, Pinia 3.0, Vue Router 4.6, vue-i18n 11.

**Storage**: DB dùng chung với Directus (Postgres, MySQL/MariaDB, SQLite, MSSQL, Oracle, CockroachDB),
**chỉ đọc** ở feature này. Redis dùng chung (rate limiter, cache, key kiểm tra). Storage location
`local`/`s3` dùng chung (chỉ ghi file kiểm tra `directus-health-file`, `directus-metric-file`).

**Testing**: Vitest 3.2.4 + `unplugin-swc` 2.0 (decorator metadata cho Nest) + `@vitest/coverage-v8`
3.2.4 (kèm `libs/env/src/lib/directus-compat.test.ts`, bảng kết quả đo từ Directus); `supertest` cho test HTTP trong process; bộ đối chiếu `tests/parity` (Vitest + `fetch` của
Node 22, Docker Compose); benchmark `tests/benchmark` (autocannon 8.0.0 + hdr-histogram-js);
E2E web `apps/web-e2e` (Playwright 1.64, một kịch bản khói).

**Target Platform**: Container Linux `node:22-alpine` (amd64, arm64) sau load balancer, nhiều replica
cạnh Directus. Máy dev macOS.

**Project Type**: Monorepo web (API + app web + thư viện dùng chung + project test).

**Performance Goals**: p95 latency và request/giây của `/server/ping`, `/server/health`,
`/server/info` không tệ hơn Directus quá 10% (SC-006). `/server/specs/oas` so với Directus chạy
`CACHE_SCHEMA=false` (container `directus-nocache`), cùng ngưỡng 10%; từ feature 002 so với Directus
mặc định.

**Constraints**:
- Không ghi DB (FR-022), chạy được với tài khoản DB chỉ có SELECT (FR-024). Khởi động chỉ đọc, an
  toàn khi nhiều replica khởi động cùng lúc.
- Dùng nguyên file env của Directus (SC-001). Không thêm biến `BACKOFFICE_` nào ở feature này.
- Key Redis, tên metric, định dạng log, mã lỗi trùng Directus.
- Dừng trong 10 s khi migration lệch (SC-004).
- Không gửi email (health luôn báo `email:connection` ok).

**Scale/Scope**: Thiết kế cho nhiều replica ngang hàng, tới 2.000 người dùng đồng thời (Nguyên tắc X).
Feature này: 5 endpoint, 13 thư viện, 1 app API, 1 app web khung, 2 project test.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.0.0. Kiểm lần 1 trước khi nghiên cứu; kiểm lần 2 sau khi
có research, data model, contracts (kết quả dưới đây là lần 2).

- [x] **I. Directus chỉ đọc** — PASS. Không sửa file nào trong `directus/`; job CI `guard-directus`
  chặn PR đổi `directus/`. Mọi file port có comment `// Ported from directus/...` ở đầu (bảng ánh xạ bên
  dưới). Hành vi không nêu trong spec theo Directus.
- [x] **II. Dùng chung DB** — PASS. Chỉ có câu `select` (data-model §1) và câu lệnh cấp phiên khi mở kết
  nối (FR-022). Không chạy migration, không `bootstrap`, không chạy schedule có ghi DB (`retention`,
  `project`, `telemetry`, `tus`). Kiểm tra `directus_migrations` khi khởi động và dừng khi lệch
  (FR-031). SC-003 kiểm bằng snapshot mọi bảng; FR-024 kiểm bằng role chỉ SELECT.
- [x] **III. API giống hệt** — PASS có ghi nhận. Path, status, header, body, lỗi như Directus. Mọi khác
  biệt (đổi thương hiệu, phần tạm thời chờ 003/004/005/011) nằm trong bảng "Khác biệt so với Directus"
  của spec. Rủi ro Express 5 được xử lý bằng cấu hình (research R4) và test đối chiếu.
- [x] **IV. Chạy song song an toàn** — PASS có ngoại lệ ghi ở Complexity Tracking (khóa job metrics
  trong process). Rate limiter dùng cùng thư viện, cùng `keyPrefix`, nên đếm chung key Redis với
  Directus. Không giữ state quan trọng trong process: schema và quyền không cache; khóa chống chạy
  chồng job metrics trong process giống Directus, là ngoại lệ Nguyên tắc VII ghi ở Complexity Tracking.
  JWT, bus, cache schema không có trong feature này. Store `memory` (mặc định của Directus) vẫn chạy,
  kèm cảnh báo một instance (FR-023, quyết định Q5).
- [x] **V. Kiểm thử đối chiếu** — PASS. Có test đối chiếu cho `/server/ping`, `/server/health`,
  `/server/info`, `/server/specs/oas`, `/metrics`, 404, lỗi payload, rate limit. Mỗi PR chạy Postgres
  đủ, MySQL và SQLite rút gọn. MariaDB, MSSQL, Oracle, CockroachDB (và Postgres 10, MySQL 5) chạy hằng
  đêm; MariaDB thêm vào vì FR-020, ngoài danh sách của Nguyên tắc V. Bộ blackbox được copy theo
  phần: cấu hình vendor, image DB, test server (research R17). Các phần còn lại copy dần ở feature có
  endpoint tương ứng.
- [x] **VI. Kiến trúc** — PASS. Nx, Node 22, pnpm 10, NestJS (controller mỏng; `ServerService`,
  `SettingsService`, `SpecificationService`, `MetricsService` là provider), Knex không ORM, Vue 3
  Composition API + PrimeVue + Pinia + Vue Router. TypeScript strict, ESLint, Prettier, mỗi thay đổi
  có test. Hạ tầng Directus viết dạng hàm dùng chung (`useEnv`, `useLogger`, `getDatabase`, `useRedis`)
  giữ nguyên dạng hàm để port sát code gốc, và được bọc thành provider để inject vào service.
- [x] **VII. Đa instance** — PASS có ngoại lệ ghi ở Complexity Tracking (khóa job metrics trong
  process). Khởi động chỉ đọc; `/server/health` cho probe; SIGTERM qua terminus
  (ngừng nhận, chạy nốt, đóng DB và Redis). Storage dùng location cấu hình chung. Web đọc
  `config.json` lúc chạy. Image API giữ thư mục làm việc `/directus` để đường dẫn tương đối trong cấu
  hình trỏ cùng chỗ (research R20).
- [x] **VIII. Biến môi trường** — PASS có một ngoại lệ ghi ở Complexity Tracking (FR-034: dừng khi
  storage driver ngoài phạm vi, trái câu "biến chưa hỗ trợ chỉ cảnh báo, không dừng"). Port nguyên
  `@directus/env`; hành vi `X`/`X_FILE`, ép kiểu, file cấu hình được đo và mã hóa thành test
  (`contracts/config.md`). Biến chưa hỗ trợ chỉ cảnh báo (FR-014). Không có biến mới.
- [x] **IX. Đổi thương hiệu** — PASS. Chỉ đổi: `X-Powered-By`, chữ "Directus" trong mô tả OpenAPI và log
  message, tên package `@backoffice/*`, tên lớp lỗi. Giữ: bảng `directus_*`, mã lỗi, `METRICS_NAME_PREFIX`,
  key kiểm tra `directus-health-*`, `directus-metric-*`, giá trị trong DB, phiên bản `11.17.4` báo cho
  client.
- [x] **X. Chất lượng và vận hành** — PASS có ngoại lệ ghi ở Complexity Tracking (quy mô benchmark).
  CI: lint, typecheck, unit + coverage (80% BE, 60% web), đối chiếu, E2E khói cho web, build image,
  `pnpm audit`, gitleaks, CodeQL, Dependabot, benchmark ≤ 10%.
  Log pino và metric giống Directus. Không gửi email. Khác biệt có trong spec, tech lead duyệt ở PR.
- [x] **XI. Ngoài phạm vi** — PASS. Không khởi tạo WebSocket, extension, AI/MCP, deployment, telemetry,
  không tạo mail transport. Việc đọc tên file trong `EXTENSIONS_PATH/migrations` chỉ để so migration,
  không nạp extension.

## Project Structure

### Documentation (this feature)

```text
specs/001-platform-foundation/
├── plan.md              # File này
├── research.md          # Phase 0: quyết định R1–R22
├── data-model.md        # Phase 1: bảng được đọc, cấu trúc trong bộ nhớ, dữ liệu ghi ra Redis/storage
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── server.openapi.yaml   # /server/ping, /server/health, /server/info, /server/specs/oas, /metrics, lỗi
│   ├── config.md             # đọc cấu hình: thứ tự ưu tiên, X/X_FILE, ép kiểu, biến chưa hỗ trợ (đã đo)
│   ├── startup.md            # thứ tự kiểm tra khi khởi động, message, mã thoát, tắt máy
│   └── observability.md      # log và metrics
├── checklists/
│   ├── requirements.md
│   └── parity-safety-config.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
backoffice-next/
├── package.json                 # packageManager pnpm@10.27.0, engines node 22, script gốc
├── pnpm-workspace.yaml          # packages: apps/*, libs/*, tests/*; catalog phiên bản (giống Directus)
├── nx.json
├── tsconfig.base.json           # bộ cờ của @directus/tsconfig 4.0.0
├── eslint.config.js             # ESLint 9 flat config
├── .prettierrc.json             # copy directus/.prettierrc.json
├── .editorconfig                # copy directus/.editorconfig (tab)
├── .nvmrc                       # 22
├── .npmrc                       # 3 dòng của directus/.npmrc
├── .prettierignore
├── .dockerignore
├── .gitleaks.toml               # allowlist env test
├── vitest.shared.ts             # createVitestConfig (ngưỡng coverage)
├── tools/                       # port-manifest/, check-port-headers.mjs, check-package-names.mjs,
│                                # guard-directus-unchanged.mjs, generate-migration-list.mjs (kèm *.test.mjs)
├── apps/
│   ├── api/                     # @backoffice/api — NestJS 12
│   │   ├── Dockerfile           # node:22-alpine, WORKDIR /directus, chạy `node main.js`
│   │   ├── package.json
│   │   ├── .swcrc               # decoratorMetadata, ESM
│   │   ├── vitest.config.ts     # unplugin-swc, coverage thresholds 80
│   │   └── src/
│   │       ├── main.ts                    # bootstrap: kiểm tra khởi động → express pipeline → Nest → listen
│   │       ├── app.module.ts
│   │       ├── constants.ts               # DIRECTUS_COMPAT_VERSION, OAS_REQUIRED_SCHEMAS, ALIAS_TYPES...
│   │       ├── server.ts                  # tạo http server, SERVER_*, terminus, SERVER_ONLINE
│   │       ├── app-pipeline.ts            # middleware Express theo thứ tự app.ts
│   │       ├── config/                    # supported-variables.ts, warn-unsupported-variables.ts, warn-single-instance.ts
│   │       ├── startup/                   # run-startup-checks.ts, validate-storage-drivers.ts
│   │       ├── database/                  # index.ts (getDatabase...), validate-migrations.ts,
│   │       │   ├── migrations/directus-11.17.4.ts   # 101 version
│   │       │   └── helpers/geometry/      # chỉ supported()
│   │       ├── redis/                     # createRedis, useRedis, redisConfigAvailable
│   │       ├── cache.ts                   # getCache() (phần cache cho health/metrics)
│   │       ├── rate-limiter.ts
│   │       ├── storage/                   # getStorage, registerDrivers, registerLocations
│   │       ├── logger/                    # createLogger, createExpressLogger, redactQuery
│   │       ├── metrics/                   # createMetrics, useMetrics, metrics.module.ts
│   │       ├── schedules/metrics.ts
│   │       ├── middleware/                # cors, extract-token, public-accountability (port create-default-accountability), rate-limiter-ip,
│   │       │                              # rate-limiter-global, json-body, respond (headers),
│   │       │                              # router-options (OPTIONS như Router con của Express 4)
│   │       ├── errors/                    # error-handler.filter.ts (port error-handler.ts + not-found)
│   │       ├── schema/                    # get-database-schema.ts, get-local-type.ts, get-default-value.ts,
│   │       │                              # get-field-system-rows.ts, read-relations.ts
│   │       ├── permissions/               # fetch-public-policies.ts, fetch-permissions.ts,
│   │       │                              # fetch-allowed-field-map.ts, filter-policies-by-ip.ts
│   │       ├── services/                  # server.service.ts, settings.service.ts, specifications.service.ts
│   │       ├── controllers/               # server.controller.ts, metrics.controller.ts
│   │       └── utils/                     # get-ip-from-req, url, get-address, validate-env, reduce-schema,
│   │                                      # get-milliseconds, async-handler
│   ├── web/                     # @backoffice/web — Vue 3 khung
│   │   ├── Dockerfile           # nginx:alpine phục vụ dist ở /admin (hoàn thiện ở 019)
│   │   ├── nginx.conf
│   │   ├── docker/40-config.sh  # sinh config.json từ env lúc container khởi động
│   │   ├── vite.config.ts       # base /admin/
│   │   ├── public/config.json   # cấu hình chạy mặc định (URL API)
│   │   └── src/                 # main.ts, App.vue, router, store, i18n (en-US, vi-VN copy từ directus/app/src/lang), runtime-config.ts
│   └── web-e2e/                 # Playwright: mở /admin, thấy "Backoffice"
├── libs/                        # mỗi lib port từ directus/packages/<cùng tên>, kèm test gốc
│   ├── env/                     # @backoffice/env
│   ├── errors/                  # @backoffice/errors
│   ├── utils/                   # @backoffice/utils (phần cần: toArray, toBoolean, isObject, parseJSON,
│   │                            #   getRelation, getRelationType, REDACTED_TEXT, getNodeEnv, ipInNetworks...)
│   ├── constants/               # @backoffice/constants (phần cần: JAVASCRIPT_FILE_EXTS...)
│   ├── types/                   # @backoffice/types (kiểu cần: SchemaOverview, Accountability, Permission...)
│   ├── schema/                  # @backoffice/schema (inspector 6 DB)
│   ├── system-data/             # @backoffice/system-data (YAML, đọc bằng js-yaml)
│   ├── format-title/            # @backoffice/format-title
│   ├── specs/                   # @backoffice/specs (YAML đã đổi thương hiệu, build bằng swagger-cli)
│   ├── storage/                 # @backoffice/storage
│   ├── storage-driver-local/    # @backoffice/storage-driver-local
│   ├── storage-driver-s3/       # @backoffice/storage-driver-s3
│   └── pressure/                # @backoffice/pressure
├── tests/
│   ├── parity/                  # @backoffice/parity-tests (target `test`: unit, không Docker; `parity`: cần Docker)
│   │   ├── docker-compose.yml   # DB theo vendor (profile), redis, minio, directus:11.17.4, backoffice-api; profile ratelimit, cors-hsts, pressure, metrics
│   │   ├── env/<vendor>.env     # một file env cho CẢ HAI app
│   │   ├── accepted-differences.ts
│   │   ├── README.md
│   │   ├── vitest.config.ts, vitest.parity.config.ts
│   │   └── src/                 # parity.ts, normalizers.ts, db-snapshot.ts, request-set.ts, spec-differences.ts,
│   │                            # get-dbs-to-test.ts, config.ts, await-connection.ts, parity-report.test.ts, vendors.test.ts,
│   │                            # server/{ping,health,info,oas,headers,methods,conditional,errors}.test.ts,
│   │                            # startup/{startup,config-files,shutdown}.test.ts, startup/temp-db.ts,
│   │                            # observability/{metrics,logs}.test.ts, db-unchanged.test.ts,
│   │                            # readonly-account.test.ts, redis-down.test.ts, accepted-differences.test.ts
│   └── benchmark/               # @backoffice/benchmark: run.ts (autocannon, p95, so sánh 10%), docker-compose.yml (directus-nocache)
├── dev/directus-reference/      # thêm anchor x-directus-environment + service backoffice-api (profile)
└── .github/
    ├── workflows/ci.yml, nightly.yml, codeql.yml
    └── dependabot.yml
```

**Structure Decision**: Monorepo Nx với pnpm workspaces. Mỗi package Directus cần dùng được port thành
một lib cùng tên dưới `libs/` (giữ cấu trúc file và test gốc), để diff với nguồn nhỏ và feature sau
dùng lại. Code của `directus/api/src` port vào `apps/api/src` theo **cùng tên thư mục và tên file**
(`services/`, `controllers/`, `middleware/`, `utils/`, `database/`...), thêm lớp module/controller
của Nest. Test đối chiếu và benchmark là project riêng dưới `tests/` vì chúng chạy với hai app.

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/`) | Đích | Ghi chú |
|---------------------|------|---------|
| `packages/env/src/**` | `libs/env/src/**` | Nguyên vẹn, kèm test |
| `api/src/utils/get-config-from-env.ts` | `apps/api/src/utils/get-config-from-env.ts` | Giữ chỗ như Directus: test port mock `@backoffice/env` mà hàm này vẫn chạy thật |
| `packages/errors/src/**` | `libs/errors/src/**` | Đổi tên `DirectusError` → `BackofficeError` |
| `packages/schema/src/**` | `libs/schema/src/**` | Nguyên vẹn |
| `packages/system-data/src/**` | `libs/system-data/src/**` | YAML đọc bằng js-yaml thay vì unplugin-yaml |
| `packages/format-title/src/**` | `libs/format-title/src/**` | Nguyên vẹn |
| `packages/specs/src/**` | `libs/specs/src/**` | Đổi "Directus" trong mô tả; build swagger-cli |
| `packages/storage*/src/**` (local, s3) | `libs/storage*/src/**` | Nguyên vẹn |
| `packages/pressure/src/**` | `libs/pressure/src/**` | Nguyên vẹn |
| `packages/utils/{shared,node}/*` (phần cần) | `libs/utils/src/{shared,node}/*` | Chỉ file được dùng |
| `packages/types/src/*` (phần cần) | `libs/types/src/*` | Chỉ kiểu được dùng |
| `api/src/app.ts` (phần middleware) | `apps/api/src/app-pipeline.ts` | Bỏ phần ngoài phạm vi |
| `api/src/server.ts` | `apps/api/src/server.ts` | Bỏ WebSocket, telemetry, emitter |
| `api/src/database/index.ts` | `apps/api/src/database/index.ts` | `validateMigrations` viết lại theo FR-031 |
| `api/src/database/helpers/geometry/*` | `apps/api/src/database/helpers/geometry/*` | Chỉ `supported()` |
| `api/src/redis/**`, `api/src/rate-limiter.ts` | cùng đường dẫn trong `apps/api/src` | |
| `api/src/cache.ts` | `apps/api/src/cache.ts` | Chỉ `getCache()` phần `cache`; bus, schema cache để 002 |
| `api/src/storage/**`, `api/src/utils/validate-storage.ts` | cùng đường dẫn | Thêm kiểm tra driver (FR-034) |
| `api/src/logger/**` | `apps/api/src/logger/**` | Bỏ `LogsStream` (WebSocket logs) |
| `api/src/metrics/**`, `api/src/schedules/metrics.ts`, `api/src/controllers/metrics.ts` | cùng đường dẫn | Bỏ nhánh PM2 |
| `api/src/middleware/{cors,extract-token,rate-limiter-ip,rate-limiter-global,error-handler,respond}.ts` | `apps/api/src/middleware/*`, `apps/api/src/errors/*` | `respond` chỉ phần header (cache để 005) |
| `api/src/controllers/not-found.ts` | `apps/api/src/errors/error-handler.filter.ts` | Ánh xạ 404 của Nest |
| `api/src/controllers/server.ts` | `apps/api/src/controllers/server.controller.ts` | Không có `/setup`, `/specs/graphql` (mọi phương thức, D-14, D-15) |
| `api/src/services/server.ts` | `apps/api/src/services/server.service.ts` | Email check cố định `ok` |
| `api/src/services/settings.ts` + `items.ts:readSingleton` | `apps/api/src/services/settings.service.ts` | Bản rút gọn (research R16.2) |
| `api/src/services/specifications.ts` | `apps/api/src/services/specifications.service.ts` | Chỉ phần `oas` |
| `api/src/utils/get-schema.ts` (`getDatabaseSchema`), `get-local-type.ts`, `get-default-value.ts`, `get-field-system-rows.ts` | `apps/api/src/schema/*` | Không cache |
| `api/src/services/relations.ts` (`readAll`, `stitchRelations`) | `apps/api/src/schema/read-relations.ts` | Đọc bằng knex |
| `api/src/permissions/{lib/fetch-policies,lib/fetch-permissions,utils/filter-policies-by-ip,modules/fetch-allowed-field-map/*}.ts` | `apps/api/src/permissions/*` | Đọc bằng knex (research R16.4) |
| `api/src/permissions/utils/create-default-accountability.ts`, `api/src/middleware/authenticate.ts:20-26` | `apps/api/src/middleware/public-accountability.ts` | Luôn public (R16.1) |
| `api/src/utils/{reduce-schema,get-ip-from-req,url,get-address,validate-env,get-milliseconds,async-handler}.ts` | `apps/api/src/utils/*` | |
| `tests/blackbox/common/{get-dbs-to-test,config}.ts`, `utils/await-connection.ts`, `tests/db/routes/server/*.test.ts` | `tests/parity/src/**` | Chuyển sang `parity()` |

### Phần port rút gọn tạm thời

Các phần dưới đây cho kết quả giống Directus với endpoint của feature 001, nhưng chưa phải bản port đầy
đủ. Mỗi phần ghi feature sẽ thay; test đối chiếu giữ nguyên để bắt lệch khi thay.

| Phần | Ở feature 001 | Thay ở |
|------|---------------|--------|
| Accountability | Luôn public, bỏ qua token | 003 |
| Đọc `directus_settings` | 3 câu SQL + `cast-boolean`/`cast-json` | 005 (ItemsService) |
| Đọc quyền public | SQL trực tiếp, không cache | 004 |
| SchemaOverview | Dựng mỗi lần gọi OAS (và `/server/info` khi không có dòng settings), không cache, không bus | 002 |
| `respond` | Chỉ header `Cache-Control: no-cache`, `Vary` | 005 |
| Hook `request.error`, `request.not_found` | Chưa gọi | 009 |

## Complexity Tracking

| Vi phạm | Vì sao cần | Phương án đơn giản hơn bị loại vì |
|---------|------------|-----------------------------------|
| Nguyên tắc VIII (câu "biến Directus chưa hỗ trợ: ghi cảnh báo, KHÔNG dừng app") bị lệch ở FR-034 / D-16: API dừng khi `STORAGE_<LOC>_DRIVER` là `gcs`, `azure`, `cloudinary`, `supabase` | Đã chốt khi làm rõ spec (phương án A) và khớp prompt feature 007 trong `SPECKIT-GUIDE.md`. Storage là tài nguyên dùng chung: chạy tiếp với driver không hỗ trợ thì mọi upload hỏng âm thầm và health báo lỗi mơ hồ. Nguyên tắc XI xếp storage ngoài phạm vi | Chỉ cảnh báo và chạy tiếp (bị loại: instance đánh dấu sẵn sàng nhưng không phục vụ được file). Cần tech lead duyệt trong PR (Nguyên tắc X). Nếu muốn đồng bộ chữ nghĩa, sửa Nguyên tắc VIII theo quy trình Governance (PATCH hoặc MINOR) |
| Nguyên tắc X (benchmark dùng dữ liệu ở quy mô 2.000 user đồng thời, collection 10 triệu bản ghi) bị lệch: T095 đo 50 kết nối trên DB mặc định | Endpoint của 001 (`/server/ping`, `/server/health`, `/server/info`, `/server/specs/oas`) không đọc collection người dùng, kết quả không phụ thuộc số bản ghi; endpoint chính của Nguyên tắc X (items, auth, files, assets) chưa có. Runner CI không chịu được 2.000 kết nối | Đo ngay ở quy mô thiết kế (bị loại: không đo thêm được gì cho `/server/*`, làm job benchmark chậm và dao động). Benchmark quy mô thiết kế làm cùng feature items, auth, files, assets. Cần tech lead duyệt trong PR (Nguyên tắc X) |
| Nguyên tắc VII ("KHÔNG dùng cache hay lock trong bộ nhớ process") bị lệch: khóa `lockedAt` chống chạy chồng job metrics (T090) nằm trong process | Port nguyên `directus/api/src/schedules/metrics.ts`; metric sinh theo từng node, khóa chỉ chống hai lượt chạy chồng trong cùng process, không phải state dùng chung giữa instance | Khóa Redis (bị loại: chỉ một instance sinh metric, các instance khác thiếu metric, lệch Directus). Cần tech lead duyệt trong PR (Nguyên tắc X) |
| Nguyên tắc X (coverage 80% cho libs BE) đo trên phần chạy được không cần DB: `libs/schema` loại 5 dialect máy chủ (`postgres`, `cockroachdb`, `mysql`, `mssql`, `oracledb`) khỏi phép đo unit | Các dialect này chỉ chạy được với DB thật; port nguyên từ Directus, Directus cũng không có unit test cho chúng. Chúng được kiểm bằng `tests/parity` trên từng vendor (PR: Postgres, MySQL; hằng đêm: MariaDB, MSSQL, Oracle, CockroachDB). Phần còn lại (SQLite với DB thật trong bộ nhớ, `createInspector`, utils) đạt > 90% | Mock chuỗi query của knex cho từng dialect (bị loại: test giòn, không chứng minh được câu SQL chạy đúng trên DB). Cần tech lead duyệt trong PR (Nguyên tắc X) |

Rủi ro đã biết (không phải vi phạm), theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| Express 5 (Nest 12) khác Express 4.21.2 (Directus) | Lệch header hoặc thông báo lỗi | Cấu hình body parser, query parser (R4); test đối chiếu có ca trailing slash, chữ hoa, `OPTIONS`, `HEAD`, phương thức sai, `GET /` |
| Repo private không có GitHub Code Security | CodeQL không chạy | Thay bằng Semgrep CE và ghi vào bảng này khi xảy ra (R19) |
| Benchmark trên runner CI dao động | Fail giả | Đo luân phiên nhiều vòng, lấy trung vị (R18) |
| Thứ tự collection trong OAS không xác định | Test đối chiếu chập chờn | Chuẩn hóa thứ tự `tags`, so object không theo thứ tự key (R16.5) |
| `/server/specs/oas` công khai dựng lại schema mỗi request (chưa có cache, FR-049) | Có thể bị dùng để làm quá tải DB | Chấp nhận tới feature 002, giống Directus khi `CACHE_SCHEMA=false`; pressure limiter mặc định bật, rate limiter nên bật khi mở Internet; benchmark so với Directus `CACHE_SCHEMA=false` |
| `OPTIONS` khác Directus vì Nest gắn route thẳng vào app | Lệch `Allow` và status | Middleware `router-options` (R4), `methods.test.ts`, `observability/metrics.test.ts` |
| `X`/`X_FILE` phụ thuộc thứ tự key | Cấu hình lạ cho kết quả khác nhau giữa môi trường | Dùng nguyên thuật toán Directus, golden test (R6), khuyến nghị không đặt cả hai |
