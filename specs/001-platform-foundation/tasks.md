---

description: "Danh sách task cho feature 001: Nền tảng workspace và kết nối hệ thống"
---

# Tasks: Nền tảng workspace và kết nối hệ thống

**Input**: Tài liệu thiết kế trong `/specs/001-platform-foundation/`
**Prerequisites**: `plan.md`, `spec.md`; dùng thêm `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: BẮT BUỘC (Nguyên tắc V, VI). Mọi thay đổi có test; mọi endpoint có test đối chiếu chạy với cả Directus thật lẫn API mới, so status, header, body và tác động lên DB.

**Organization**: Task được nhóm theo user story để làm và kiểm thử độc lập. Phase 1 và 2 là nền chung.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: có thể làm song song (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task; Phase 1, 2 và Polish không có nhãn này.
- Mọi file port từ `directus/` PHẢI có comment đầu file `// Ported from directus/<đường dẫn nguồn>` và có dòng trong `tools/port-manifest/` (Nguyên tắc I, US7.4). KHÔNG sửa, xóa, tạo file trong `directus/`.
- Tên biến, comment, commit message viết tiếng Anh; tài liệu viết tiếng Việt (Nguyên tắc X).
- Test viết trước và phải fail trước khi cài đặt phần tương ứng.

## Quy ước đường dẫn

- API: `apps/api/src/**`; web: `apps/web/src/**`; thư viện: `libs/<tên>/src/**`.
- Test đối chiếu: `tests/parity/src/**` (riêng danh sách khác biệt ở `tests/parity/accepted-differences.ts`); benchmark: `tests/benchmark/src/**`; công cụ: `tools/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/packages/*`, `directus/tests/blackbox/**`.

## Tóm tắt

- Tổng số task: **112**
- Số task đánh dấu [P]: **69**
- MVP gợi ý: **User Story 1 + User Story 3** (Phase 1 + 2 + 3 + 5, cùng T058 của Phase 4). Nguyên tắc II: chưa có kiểm tra migration thì KHÔNG chạy cạnh Directus trên DB dùng chung.

| Phase | Số task |
|-------|---------|
| Phase 1: Setup | 8 |
| Phase 2: Foundational | 19 |
| Phase 3: User Story 1 - Chạy API mới bằng đúng cấu hình của Directus | 18 |
| Phase 4: User Story 2 - Các endpoint `/server/*` trả về giống Directus | 21 |
| Phase 5: User Story 3 - Dừng khởi động khi migration lệch | 11 |
| Phase 6: User Story 4 - Bộ test đối chiếu với Directus thật | 8 |
| Phase 7: User Story 5 - Log và metrics giống Directus | 6 |
| Phase 8: User Story 6 - Pipeline CI chặn thay đổi không đạt chuẩn | 8 |
| Phase 9: User Story 7 - Workspace monorepo cho lập trình viên | 6 |
| Phase 10: Polish & Cross-Cutting Concerns | 7 |

---

## Phase 1: Setup (khung monorepo dùng chung)

**Purpose**: Dựng workspace Nx + pnpm, cấu hình chất lượng và công cụ kiểm tra file port. Làm xong là `pnpm install` và `pnpm nx show projects` chạy được.

- [X] T001 Tạo `package.json` gốc (`name: backoffice`, `private: true`, `packageManager: pnpm@10.27.0`, `engines: {node: "22", pnpm: ">=10 <11"}`, script `build`/`lint`/`typecheck`/`test`/`format`/`check-port-headers` gọi `nx run-many` hoặc công cụ tương ứng, FR-004), `.nvmrc` (`22`) và `.npmrc` (copy 3 dòng của `directus/.npmrc`: `engine-strict=true`, `shell-emulator=true`, `save-prefix=''`)
- [X] T002 Tạo `pnpm-workspace.yaml` (`packages: [apps/*, libs/*, tests/*]`) kèm `catalog:` ghim đúng phiên bản trong `plan.md` §Technical Context và `research.md` R1–R22 (knex 3.1.0, pg 8.16.3, mysql2 3.15.3, sqlite3 5.1.7, tedious 18.6.1, oracledb 6.10.0, ioredis 5.8.2, keyv 5.5.3, @keyv/redis 3.0.1, rate-limiter-flexible 7.2.0, pino 9.7.0, pino-http 10.5.0, pino-http-print 3.1.0, pino-pretty 13.1.2, prom-client 15.1.3, cron 4.3.4, @godaddy/terminus 4.12.1, helmet 8.1.0, cors 2.8.5, cookie-parser 1.4.7, body-parser 1.20.3, qs 6.14.2, proxy-addr 2.0.7, object-hash 3.0.0, lodash-es 4.18.1, nanoid 5.1.6, ms 2.1.3, bytes 3.1.2, camelcase 8.0.0, dotenv 17.2.3, js-yaml 4.1.1, AWS SDK 3.928.0, swagger-cli 4.0.4; nx 23.3.0 cùng @nx/js, @nx/nest, @nx/vite, @nx/vitest, @nx/eslint, @nx/playwright; @nestjs/* 12.1.x, typescript 5.9.3, vitest 3.2.4, @vitest/coverage-v8 3.2.4, unplugin-swc 2.0.0, @swc/core 1.16.13, eslint 9.39.1, prettier 3.6.2, vue 3.5.x, vite 7.3.x, primevue 5.0.x, pinia 3.0.x, vue-router 4.6.x, vue-i18n 11.x, @playwright/test 1.64.x, autocannon 8.0.0)
- [X] T003 Tạo `nx.json` (cache cho `build`, `lint`, `typecheck`, `test`; `namedInputs`; `targetDefaults` với `dependsOn: ["^build"]`) và `tsconfig.base.json` copy đủ bộ cờ của `@directus/tsconfig` 4.0.0 (`configs/base` + `configs/node22`; gồm `isolatedDeclarations: true`, `allowUnreachableCode: false`, `allowUnusedLabels: false`, `forceConsistentCasingInFileNames: true`, `allowSyntheticDefaultImports: true`, `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `module`/`moduleResolution` `Node16`, `target` ES2022, `lib` ES2023, `declaration`, `esModuleInterop`, `skipLibCheck`)
- [X] T004 [P] Tạo `eslint.config.js` (ESLint 9 flat config: `@eslint/js`, `typescript-eslint`, `eslint-plugin-vue`, `eslint-config-prettier`), `.prettierrc.json` và `.editorconfig` (copy `directus/.prettierrc.json`, `directus/.editorconfig`: tab, printWidth 120, singleQuote), `.prettierignore`
- [X] T005 [P] Cập nhật `.gitignore` (thêm `.nx/`, `*.tsbuildinfo`, `test.db`; GIỮ file env của test bằng ngoại lệ `!tests/parity/env/*.env` vì `.env.*` đang bị bỏ qua) và tạo `.dockerignore` gốc (`node_modules`, `.git`, `directus`, `dev`, `graphify-out`, `coverage`, `dist`)
- [X] T006 [P] Tạo `vitest.shared.ts` ở gốc: hàm `createVitestConfig({ coverageThreshold, swc })` dùng `@vitest/coverage-v8`, `coverage.enabled: true` (để target `test` luôn kiểm ngưỡng, không cần cờ `--coverage`), reporter `text` + `lcov`, `thresholds` (lines, functions, branches, statements) nhận từ tham số (80 cho api và libs BE, 60 cho web), tùy chọn `unplugin-swc` cho project NestJS
- [X] T007 [P] Tạo công cụ kiểm tra file port: thư mục `tools/port-manifest/` (mỗi file `*.json` là mảng `{source, dest}`), `tools/check-port-headers.mjs` (đọc mọi file trong thư mục đó; fail khi `dest` không tồn tại, dòng đầu không chứa `Ported from directus/<source>`, hoặc `source` không tồn tại trong `directus/`) và test `tools/check-port-headers.test.mjs` (dùng thư mục tạm, đủ ca đạt và fail); đăng ký script `pnpm run check-port-headers` (US7.4, Nguyên tắc I)
- [X] T008 Chạy `pnpm install` để sinh `pnpm-lock.yaml` (commit), rồi xác nhận `pnpm nx show projects` và `pnpm run check-port-headers` chạy được trên workspace rỗng

**Checkpoint**: Workspace cài được; Nx nhận diện được project; công cụ kiểm tra file port chạy được.

---

## Phase 2: Foundational (chặn mọi user story)

**Purpose**: Port các thư viện nền, dựng khung `apps/api`, và lõi bộ test đối chiếu để mọi story sau đều có test đối chiếu từ đầu.

**⚠️ CRITICAL**: Chưa user story nào bắt đầu được cho tới khi phase này xong.

### Thư viện nền (port từ `directus/packages/*`)

- [X] T009 [P] Port `directus/packages/constants/src/**` sang `libs/constants/src/**` thành `@backoffice/constants` (tạo `package.json`, `tsconfig.json`, `vitest.config.ts`); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T010 [P] Port `directus/packages/utils/shared/*.ts` và `directus/packages/utils/node/*.ts` (chỉ các file được dùng và những file chúng import: `to-array`, `to-boolean`, `is-object`, `parse-json`, `get-redacted-string`, `get-node-env`, `ip-in-networks`, `get-relation`, `get-relation-type`...) sang `libs/utils/src/{shared,node}/**` thành `@backoffice/utils` (export `.` và `./node`), kèm các file `*.test.ts` gốc; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T011 [P] Port các kiểu cần dùng (`SchemaOverview`, `Accountability`, `Permission`, `Filter`, `Relation`, `Field`, `DatabaseClient`, `AbstractServiceOptions`, `Item`...) từ `directus/packages/types/src/**` sang `libs/types/src/**` thành `@backoffice/types`; copy nguyên cả thư mục khi các file phụ thuộc nhau; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file); `typecheck` phải đạt
- [X] T012 [P] Port `directus/packages/errors/src/**` sang `libs/errors/src/**` thành `@backoffice/errors`; đổi tên `DirectusError` thành `BackofficeError`, `isDirectusError` thành `isBackofficeError`, `name` của lỗi thành `BackofficeError`; GIỮ nguyên mã lỗi, message, HTTP status; kèm test gốc; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T013 Port `directus/packages/env/src/**` (gồm `constants/defaults.ts`, `directus-variables.ts`, `type-map.ts`, `lib/create-env.ts`, `lib/cast.ts`, mọi `utils/*`) sang `libs/env/src/**` (`get-config-from-env.ts` ở lại `apps/api/src/utils/` như Directus, T017) thành `@backoffice/env` (phụ thuộc `@backoffice/constants`, `@backoffice/utils`); GIỮ nguyên thứ tự duyệt key của `createEnv` (FR-016) và kèm toàn bộ test gốc; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T014 [P] Port `directus/packages/pressure/src/**` sang `libs/pressure/src/**` thành `@backoffice/pressure` kèm test; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T015 [P] Port `directus/packages/schema/src/**` (inspector cho Postgres, CockroachDB, MySQL, SQLite, MSSQL, Oracle) sang `libs/schema/src/**` thành `@backoffice/schema` kèm test; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)

### Khung `apps/api` (NestJS 12, ESM)

- [X] T016 Tạo project `apps/api` (`@backoffice/api`): `package.json` (`"type": "module"`, dependencies theo catalog), `project.json` (`"name": "api"`; target `build` dùng `@nx/js:swc`, `serve` dùng `@nx/js:node`, `test`, `lint`, `typecheck`), `.swcrc` (`decoratorMetadata`, `legacyDecorator`, output ESM), `tsconfig.json` (thừa kế `tsconfig.base.json`, bật `experimentalDecorators`, `emitDecoratorMetadata`, tắt `isolatedDeclarations`), `vitest.config.ts` (dùng `vitest.shared.ts`, `unplugin-swc`, ngưỡng coverage 80)
- [X] T017 [P] Tạo `apps/api/src/constants.ts` (`DIRECTUS_COMPAT_VERSION = '11.17.4'`, `OAS_REQUIRED_SCHEMAS = ['Query', 'x-metadata']`) và port `directus/api/src/utils/{validate-env,get-address,url,get-ip-from-req,async-handler,get-milliseconds}.ts` sang `apps/api/src/utils/` kèm test gốc (nếu có) và test mới cho phần chưa có; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T018 [P] Port `directus/api/src/logger/{index,redact-query}.ts` sang `apps/api/src/logger/` (BỎ `LogsStream` và nhánh `WEBSOCKETS_LOGS_*`), đổi message nói về chính app sang "Backoffice" (FR-090), kèm test gốc của `redact-query`; thêm `apps/api/src/logger/nest-logger.service.ts`: `LoggerService` của Nest bọc pino, chỉ chuyển `warn`/`error`/`fatal` (research R12); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T019 [P] Port `directus/api/src/middleware/error-handler.ts` và `directus/api/src/controllers/not-found.ts` thành `apps/api/src/errors/error-handler.filter.ts` (`ExceptionFilter` toàn cục: gộp nhiều lỗi, status dự phòng 500, ẩn lỗi lạ với người không phải admin, `stack` khi `NODE_ENV=development`, header `Allow` cho `METHOD_NOT_ALLOWED`, `NotFoundException` của Nest thành `RouteNotFoundError({ path: req.path })`) kèm `error-handler.filter.test.ts` (FR-050, FR-051); điểm gọi hook `request.error` / `request.not_found` để trống kèm chú thích (feature 009); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T020 [P] Port và viết middleware Express trong `apps/api/src/middleware/`: `extract-token.ts` (← `directus/api/src/middleware/extract-token.ts`), `cors.ts` (← `cors.ts`), `json-body.ts` (body-parser 1.20.3, bọc lỗi thành `InvalidPayloadError({ reason })`, `limit` = `MAX_PAYLOAD_SIZE`, giữ `rawBody`), `public-accountability.ts` (tạo `{role:null, user:null, roles:[], admin:false, app:false, ip}` + `userAgent` cắt 1024 ký tự + `origin` ← `directus/api/src/permissions/utils/create-default-accountability.ts` và `middleware/authenticate.ts:20-26`, bỏ qua token theo FR-044); mỗi file có `*.test.ts`; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T021 [P] Tạo stub `apps/api/src/metrics/index.ts` và `apps/api/src/metrics/lib/use-metrics.ts` với `useMetrics()` luôn trả `undefined` (module database của US1 import nó); ghi chú `// STUB: thay bằng bản port đầy đủ ở US5`
- [X] T022 Tạo `apps/api/src/app-pipeline.ts` (hàm `createExpressApp()` gắn middleware Express theo ĐÚNG thứ tự R5 của `research.md`: pressure limiter, helmet CSP/COOP/HSTS, logger HTTP, `X-Powered-By: Backoffice`, CORS, json body, cookie-parser, extractToken, `GET /` + `/robots.txt`, rồi điểm chèn cho rate limiter/ping/accountability/router Nest; `app.disable('x-powered-by')`, `trust proxy` = `IP_TRUST_PROXY`, query parser `qs` 6.14.2 với `QUERYSTRING_*`), `apps/api/src/app.module.ts` rỗng và `apps/api/src/main.ts` khung (`NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false, logger })`, filter toàn cục); chưa listen (US1)
- [X] T023 Tạo `apps/api/Dockerfile` theo `directus/Dockerfile` (`node:22-alpine`, `python3 build-base`, `pnpm --filter @backoffice/api deploy --legacy --prod dist` (như `directus/Dockerfile`; pnpm 10 cần `--legacy` khi không bật `inject-workspace-packages`), user `node`, `WORKDIR /directus`, `ENV DB_CLIENT=sqlite3 DB_FILENAME=/directus/database/database.sqlite NODE_ENV=production`, thư mục `database extensions uploads`, lệnh chạy `node main.js`, KHÔNG bootstrap, KHÔNG PM2; research R20, FR-017) và thêm vào `dev/directus-reference/docker-compose.yml` anchor `x-directus-environment` (dùng chung cho service `directus`) cùng service `backoffice-api` (profile `backoffice`, cổng ngoài 8056, build từ `apps/api/Dockerfile`, dùng cùng anchor) theo `quickstart.md` §3

### Lõi bộ test đối chiếu (`tests/parity`)

- [X] T024 [P] Tạo project `tests/parity` (`@backoffice/parity-tests`): `package.json`, `project.json` (`"name": "parity-tests"`; target `env-up`, `env-down` nhận `--vendor` và `--profiles`; target `test` chỉ chạy unit test không cần Docker: `src/*.test.ts` trừ `db-unchanged`, `readonly-account`, `redis-down`; target `parity` chạy test đối chiếu cần Docker: `src/{server,startup,observability}/**/*.test.ts` và `src/{db-unchanged,readonly-account,redis-down}.test.ts`, nhận `--vendor` (đặt `TEST_DB`, thắng biến `TEST_DB` có sẵn) và `PARITY_SUITE`), `tsconfig.json`, `vitest.config.ts` (target `test`) và `vitest.parity.config.ts` (target `parity`: môi trường node, chạy file tuần tự, timeout 30 s, `globalSetup` đọc `TEST_DB`, `PARITY_SUITE`, `DIRECTUS_URL`, `BACKOFFICE_URL` và cặp URL của từng profile đang bật (`DIRECTUS_URL_<PROFILE>`, `BACKOFFICE_URL_<PROFILE>`, T065); trước T082 mọi file đều chạy, tương đương `full`)
- [X] T025 [P] Tạo `tests/parity/docker-compose.yml` (profile theo vendor, bắt đầu bằng `postgres`: `postgis/postgis:13-3.4-alpine`, `redis:7-alpine`, MinIO + bước tạo bucket, `directus/directus:11.17.4` tự bootstrap DB trống, `backoffice-api` build từ `apps/api/Dockerfile` và khởi động SAU khi Directus healthy) và `tests/parity/env/postgres.env` (MỘT file env dùng cho CẢ HAI app qua `env_file`, giá trị test không phải secret thật; chứng minh SC-001; cấu hình giống `dev/directus-reference`: `CACHE_ENABLED=true`, `CACHE_STORE=redis`, `CACHE_AUTO_PURGE=true`, `RATE_LIMITER_STORE=redis`, `STORAGE_LOCATIONS=s3` với MinIO, `WEBSOCKETS_ENABLED=false`, kèm `ADMIN_EMAIL`/`ADMIN_PASSWORD` để Directus bootstrap, nhóm B của `contracts/config.md`)
- [X] T026 [P] Viết `tests/parity/src/parity.ts` (hàm `parity(request)`: gửi cùng request, cùng header Host, tới `DIRECTUS_URL` và `BACKOFFICE_URL`; so status, tập header FR-104, body theo FR-103) và `tests/parity/src/normalizers.ts` (FR-105: loại `info.version` và `ETag` của OAS, sắp `tags`/`paths` theo tên, chỉ so định dạng `Retry-After`, `reset`, `observedValue`; so JSON không phụ thuộc thứ tự key, có phụ thuộc thứ tự mảng); test đơn vị `parity.test.ts` bằng hai HTTP server cục bộ (không cần Docker): hai bên giống thì đạt, khác header hoặc body thì fail; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file) cho phần lấy từ blackbox
- [X] T027 [P] Port `directus/tests/blackbox/common/get-dbs-to-test.ts`, phần cấu hình theo vendor của `directus/tests/blackbox/common/config.ts` và `directus/tests/blackbox/utils/await-connection.ts` sang `tests/parity/src/{get-dbs-to-test,config,await-connection}.ts` (`TEST_DB` nhận `postgres`, `postgres10`, `mysql`, `mysql5`, `maria`, `mssql`, `oracle`, `cockroachdb`, `sqlite3`); tạo `tests/parity/accepted-differences.ts` khung (kiểu `AcceptedDifference` theo `data-model.md` §3.1, gồm `feature`, `kind`, `location` có biến thể `status`; mới có mục `D-01`); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)

**Checkpoint**: Mọi thư viện nền build và test đạt; `apps/api` build được và có Dockerfile; `parity()` có test đơn vị; `pnpm run check-port-headers` đạt. Có thể bắt đầu các user story.

---

## Phase 3: User Story 1 - Chạy API mới bằng đúng cấu hình của Directus (Priority: P1)

**Goal**: API mới khởi động bằng nguyên file `.env` của Directus, cạnh Directus trên cùng DB và Redis, kết nối được 6 loại DB, không ghi gì vào DB.

**Independent Test**: Dùng `dev/directus-reference/.env`: khởi động API mới cạnh Directus tham chiếu, `/server/ping` trả `pong`; chụp schema và dữ liệu mọi bảng trước và sau khi API khởi động, phục vụ request và tắt, hai bản chụp giống hệt (US1.1–US1.10).

### Tests cho US1 (BẮT BUỘC) - viết trước, phải fail trước khi cài đặt

> **LƯU Ý**: Viết các test này TRƯỚC và xác nhận chúng FAIL trước khi cài đặt.

- [X] T028 [P] [US1] `libs/env/src/lib/directus-compat.test.ts`: mã hóa bảng đã đo của `contracts/config.md` §2 (thứ tự `X`/`X_FILE`, `X_FILE` không phải biến Directus không mở rộng, tiền tố trên giá trị `_FILE`, `_FILE` không đọc được, kể cả giá trị có tiền tố: message nêu giá trị thô `string:/cfg/missing`), §3 (ép kiểu: `number:abc`=NaN, `boolean:xyz`=false, `json:` hỏng giữ chuỗi, `array:a,,b`, `0123`, `regex:(` ném SyntaxError) và §4 (JSON hỏng, YAML hỏng, YAML rỗng, JSON hoặc YAML không phải object, `.js` export sai kiểu, `.js` export hàm nhận `process.env`, `CONFIG_PATH` thiếu file, đường dẫn tương đối theo cwd, file ghi đè process)
- [X] T029 [P] [US1] `apps/api/src/config/supported-variables.test.ts` và `warn-unsupported-variables.test.ts`: nhóm A/B/C của `contracts/config.md` §5 trùng bảng; mọi mẫu nhóm A/B khớp ít nhất một mục `DIRECTUS_VARIABLES`; cấu hình có `AUTH_PROVIDERS` (C), `ADMIN_EMAIL` (B), `FOO` (ngoài danh sách) cho đúng một dòng warn chỉ chứa `AUTH_PROVIDERS`, A–Z, không có giá trị; `RATE_LIMITER_REGISTRATION_ENABLED`, `RATE_LIMITER_EMAIL_ENABLED` đặt tường minh bị cảnh báo, `RATE_LIMITER_POINTS` thì không; giá trị mặc định không bị tính; `SERVE_APP=true` đặt tường minh thì warn ở dòng riêng (dòng 4 của `contracts/startup.md`), không có trong dòng nhóm C; `SERVE_APP=false` hoặc không đặt thì không warn; `warn-single-instance.test.ts` (FR-023: không Redis; `CACHE_STORE=memory` kể cả giá trị mặc định và khi `CACHE_ENABLED=false`; `RATE_LIMITER_STORE=memory` chỉ khi `RATE_LIMITER_ENABLED` hoặc `RATE_LIMITER_GLOBAL_ENABLED`; có Redis, `CACHE_STORE=redis`, rate limiter tắt thì không warn)
- [X] T030 [P] [US1] `apps/api/src/database/index.test.ts`: cấu hình knex cho 6 client (`pg`, `cockroachdb`, `mysql`→`mysql2`, `sqlite3`, `mssql` với `useUTC:false`, `oracledb`), biến bắt buộc theo từng client (`validateEnv`), các câu lệnh cấp phiên khi mở kết nối (SQLite `PRAGMA foreign_keys = ON`, CockroachDB `SET serial_normalization`/`default_int_size`, Oracle `ALTER SESSION SET NLS_*`, FR-022), `getDatabaseClient`, `hasDatabaseConnection`, `validateDatabaseConnection` (thất bại thì log `Can't connect to the database.` và `process.exit(1)`), `validateDatabaseCharset` của MySQL; mock knex
- [X] T031 [P] [US1] `apps/api/src/redis/lib/create-redis.test.ts`, `use-redis.test.ts`, `utils/redis-config-available.test.ts` (copy từ `directus/api/src/redis/**`, đổi import sang `@backoffice/*`): `REDIS` chuỗi kết nối, nhóm `REDIS_*`, `REDIS_ENABLED`
- [X] T032 [P] [US1] `apps/api/src/app-pipeline.test.ts` (supertest trên app Nest dựng từ `createExpressApp()` + `AppModule` như `main.ts`, không cần DB): `GET /server/ping` → 200 `text/html; charset=utf-8` `pong` không có `Cache-Control`; token Bearer sai hoặc `?access_token=` sai vẫn `pong`; `access_token` + Bearer cùng lúc → 400 `INVALID_PAYLOAD`; `X-Powered-By: Backoffice`; `GET /` → 302 `Location: ./admin` (`ROOT_REDIRECT` mặc định); `/robots.txt`; `/admin` → 404 `ROUTE_NOT_FOUND`; path lạ → 404 đúng format; thứ tự middleware theo R5
- [X] T033 [P] [US1] `apps/api/src/server.test.ts`: `SERVER_*` gán vào http.Server, listen theo `HOST`/`PORT`/`UNIX_SOCKET_PATH`, `EADDRINUSE` → log `Port <port> is already in use` và `process.exit(1)`, trình tự tắt máy theo FR-080 (`beforeShutdown` đặt `SERVER_ONLINE=false` → ngừng nhận kết nối → hết `SERVER_SHUTDOWN_TIMEOUT` cắt kết nối còn lại → `knex.destroy()` và đóng Redis → log `Backoffice shut down OK. Bye bye!`); terminus gửi lại chính tín hiệu (`process.kill(process.pid, signal)` được gọi, mock); lỗi trong `onSignal` → thoát mã 1, không log (giống Directus, không truyền `logger` cho terminus)
- [X] T034 [P] [US1] `tests/parity/src/startup/config-files.test.ts`: chạy file build của API (`node dist/main.js`) với `CONFIG_PATH` là `.env`, `.json`, `.yaml`, `.yml`, `.js` (dạng hàm và dạng object) đặt `PORT`/`LOG_STYLE`, kiểm tra API nghe đúng cổng và trả `pong`; `SECRET_FILE`, `DB_PASSWORD_FILE` đọc được; biến có tiền tố ép kiểu (`number:`, `boolean:`...) được nhận; cấu hình lỗi (US1 và `contracts/config.md` §4) làm API dừng mã khác 0 với lỗi gốc; và `tests/parity/src/startup/shutdown.test.ts` (contract `startup.md` §3, FR-080: gửi `POST /nope` với `Content-Type: application/json`, gửi header rồi giữ body, gửi `SIGTERM`; gửi nốt body trước `SERVER_SHUTDOWN_TIMEOUT` → nhận đủ response `404`; giữ quá hạn → kết nối bị cắt; process kết thúc bằng tín hiệu `SIGTERM` (mã 143 khi chạy qua shell))
- [X] T035 [P] [US1] `tests/parity/src/server/ping.test.ts` (port `directus/tests/blackbox/tests/db/routes/server/ping.test.ts`, chuyển sang `parity()`, header `// Ported from` và ghi `tools/port-manifest/T035.json`): `parity()` cho `GET /server/ping` (không token, Bearer sai, `?access_token=` sai, `access_token` + Bearer → 400) giữa Directus và API mới; chỉ khác biệt được chấp nhận là `D-01`
- [X] T036 [P] [US1] `tests/parity/src/db-snapshot.ts` (data-model §3.3: chụp MỌI bảng gồm cột qua `@backoffice/schema`, định nghĩa index (cột, unique), khóa ngoại, `rowCount`, checksum SHA-256 các dòng ORDER BY khóa chính, bảng không có khóa chính thì ORDER BY mọi cột; không chụp trạng thái phiên) kèm test đơn vị (SQLite, gồm bảng không khóa chính và index đổi cột), `tests/parity/src/request-set.ts` (danh sách request cố định cho mọi endpoint của feature 001: ping, health, info, specs/oas, `/metrics` khi profile `metrics`, path lạ; kèm và không kèm token) và `tests/parity/src/db-unchanged.test.ts` (PARITY_SUITE=full: dừng MỌI container Directus, gồm `directus-<profile>` của T065, chụp, chạy API mới, gửi mọi request của `request-set.ts`, gửi SIGTERM, chụp lại, so sánh; US1.9, SC-003)
- [X] T037 [P] [US1] `tests/parity/src/readonly-account.test.ts`: tạo role Postgres chỉ có SELECT, chạy API mới với `DB_USER`/`DB_PASSWORD` của role đó (ghi đè trên cùng file env), kiểm tra khởi động thành công, mọi request của `request-set.ts` (T036) không trả `500` và không có lỗi quyền trong log (FR-024, US1.10); endpoint chưa làm trả 404 nên test đạt ở mọi phase và phủ dần khi US2, US5 thêm endpoint
- [X] T038 [P] [US1] `tests/parity/src/redis-down.test.ts` (PARITY_SUITE=full): dừng container Redis rồi kiểm tra API mới vẫn khởi động và trả `pong` khi `RATE_LIMITER_ENABLED=false` (FR-025, phần khởi động); ca rate limiter `500` nằm ở T050, ca health và log `[cache]` nằm ở T046

### Cài đặt US1

- [X] T039 [US1] Cấu hình biến: tạo `apps/api/src/config/supported-variables.ts` (nhóm A, B dưới dạng regex, trùng `contracts/config.md` §5), `apps/api/src/config/warn-unsupported-variables.ts` (FR-014: một dòng warn, A–Z, chỉ tên, bỏ giá trị mặc định, `X_FILE` tính theo `X`, riêng `SERVE_APP` theo quy tắc ở D-08) và `apps/api/src/config/warn-single-instance.ts` (FR-023, message theo `contracts/startup.md` dòng 5)
- [X] T040 [US1] Port `directus/api/src/database/index.ts` sang `apps/api/src/database/index.ts` (`getDatabase`, `getSchemaInspector` dùng `@backoffice/schema`, `getDatabaseClient`, `hasDatabaseConnection`, `validateDatabaseConnection`, `validateDatabaseCharset` (gọi không `await` trong `getDatabase()` như Directus, xem dòng 9 của `contracts/startup.md`), sự kiện `query`/`query-response`/`query-error` ghi histogram qua `useMetrics()`); CHƯA port `isInstalled`, `validateMigrations`, `validateDatabaseExtensions` (US3); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T041 [P] [US1] Port `directus/api/src/redis/{index.ts,lib/create-redis.ts,lib/use-redis.ts,utils/redis-config-available.ts}` sang `apps/api/src/redis/**`; khởi động KHÔNG kiểm tra Redis (FR-025); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T042 [US1] Hoàn thiện `apps/api/src/app-pipeline.ts`: thêm `GET /server/ping` (sau extractToken, trước bước xác thực; trả `res.send('pong')`), `GET /` redirect theo `ROOT_REDIRECT`, `GET /robots.txt`, middleware `public-accountability`; KHÔNG gắn handler 404 vào Express (route Nest gắn sau, ở `app.init()`): path lạ do Nest ném `NotFoundException`, filter T019 đổi thành `RouteNotFoundError` (R14); `/admin`, `/admin/*` rơi vào 404 (D-08)
- [X] T043 [US1] Port `directus/api/src/server.ts` sang `apps/api/src/server.ts` (BỎ WebSocket, subscription, logs controller, telemetry, emitter): `createServer()` gán `getConfigFromEnv('SERVER_')`, `startServer()` listen theo `HOST`/`PORT`/`UNIX_SOCKET_PATH` và xử lý `EADDRINUSE`, `@godaddy/terminus` 4.12.1 (`SIGINT`/`SIGTERM`/`SIGHUP`, `timeout` = `SERVER_SHUTDOWN_TIMEOUT`, export `SERVER_ONLINE`, `onSignal` gọi `knex.destroy()` như Directus và thêm đóng Redis theo Nguyên tắc VII; KHÔNG truyền `logger` cho terminus, như Directus); message `Backoffice shut down OK. Bye bye!`; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T044 [US1] Nối `apps/api/src/main.ts`: `useEnv()` → log phiên bản `Backoffice <version> (compatible with Directus 11.17.4)` (D-18) → cảnh báo biến chưa hỗ trợ và cấu hình một instance → `validateDatabaseConnection()` → tạo app → `startServer()`; lỗi cấu hình (ném từ `createEnv`) làm process thoát mã khác 0 với lỗi gốc
- [X] T045 [US1] Xác nhận US1: chạy toàn bộ test US1; dựng môi trường đối chiếu bằng `pnpm nx run parity-tests:env-up --vendor=postgres` (`quickstart.md` §5), chạy `PARITY_SUITE=full pnpm nx run parity-tests:parity --vendor=postgres` cho các file `ping`, `config-files`, `shutdown`, `db-unchanged`, `readonly-account`, `redis-down`; kiểm tra log container `backoffice-api` của `tests/parity/docker-compose.yml` không có dòng lỗi; thử bằng tay theo `quickstart.md` §2–§4; `pnpm nx run-many -t lint typecheck test build` đạt

**Checkpoint**: US1 chạy độc lập: API mới khởi động bằng file env của Directus, ping đạt, DB không đổi, chạy được với tài khoản chỉ đọc. Chưa phải MVP: chưa có kiểm tra migration (US3), chỉ chạy cạnh Directus trong môi trường test.

---

## Phase 4: User Story 2 - Các endpoint `/server/*` trả về giống Directus (Priority: P1)

**Goal**: `/server/ping`, `/server/health`, `/server/info`, `/server/specs/oas` (cho public) trả cùng status, header, body như Directus, cùng định dạng lỗi, cùng hành vi router.

**Independent Test**: Gửi cùng bộ request tới Directus tham chiếu và API mới, `parity()` so status, tập header FR-104 và body theo FR-103; mọi khác biệt còn lại đều có mã trong danh sách chấp nhận (US2.1–US2.13).

### Tests cho US2 (BẮT BUỘC) - viết trước, phải fail trước khi cài đặt

> **LƯU Ý**: Viết các test này TRƯỚC và xác nhận chúng FAIL trước khi cài đặt.

- [ ] T046 [P] [US2] `tests/parity/src/server/health.test.ts` (port `directus/tests/blackbox/tests/db/routes/server/health.test.ts`, chuyển sang `parity()`, header `// Ported from` và ghi `tools/port-manifest/T046.json`): `/server/health` ok (`200`, `application/health+json`, `{"status":"ok"}`, `Cache-Control: no-cache`, `Vary`), DB ngừng (`503 {"status":"error"}`; dừng container DB trong bộ `full`), ngưỡng `*_HEALTHCHECK_THRESHOLD` đặt rất thấp → `warn`, request có token vẫn ra dạng public (FR-044), `email:connection` không làm lỗi khi `EMAIL_*` hỏng; ca `CACHE_SCHEMA=false` + DB mất kết nối là khác biệt D-13, không so; `CACHE_ENABLED=true`, `CACHE_STORE=redis` và dừng container Redis (bộ `full`, bật lại sau ca) → cả hai trả `503 {"status":"error"}` (thành phần `cache:responseTime` lỗi), API mới log `warn` có tiền tố `[cache]` (FR-025)
- [ ] T047 [P] [US2] `tests/parity/src/server/info.test.ts`: `/server/info` public so toàn bộ body (17 key `project` đúng thứ tự, `setupCompleted`, `version` chỉ khi chưa có user), ETag giống nhau, và biến thể dữ liệu: `public_background` có file / không có, `public_registration` bật, `theme_light_overrides` có JSON; viết để chạy được trên mọi vendor (chuẩn hóa boolean và JSON theo từng DB ở T084); ở US2 chỉ chạy `postgres`; request kèm Bearer sai hoặc `?access_token=` sai → khác biệt D-10 (API mới trả body public)
- [ ] T048 [P] [US2] `tests/parity/src/server/oas.test.ts`: `/server/specs/oas` public (DB mặc định: tags `Assets`, `Authentication`, `Server`, 10 path, schemas `Query`, `x-metadata`), sau khi tạo collection và cấp quyền đọc public cho policy public thì `paths`, `tags`, `components.schemas` khớp (tạo dữ liệu qua REST của Directus); `OPENAPI_ENABLED=false` → 404 `ROUTE_NOT_FOUND`; áp FR-105 (bỏ `info.version`, ETag; sắp `tags`, `paths`); request kèm Bearer sai hoặc `?access_token=` sai → khác biệt D-10 (API mới trả OAS public)
- [ ] T049 [P] [US2] `tests/parity/src/server/headers.test.ts`: tập header FR-104 trên mọi response (CSP, COOP, `X-Powered-By` khác biệt D-01, `Content-Type`, `Cache-Control`, `Vary`); `CORS_ENABLED=true`/`HSTS_ENABLED=true` dùng profile `cors-hsts` của T065; `tests/parity/src/server/methods.test.ts` (FR-048: `POST` tới mọi `/server/*` → 404, riêng `POST /server/setup` Directus trả `403` vì DB đã có user, chấp nhận theo D-14, KHÔNG gửi tới DB chưa có user vì Directus sẽ ghi `directus_users`, `directus_settings`; `OPTIONS` tới `/server/info`, `/server/health`, `/server/specs/oas` → `200 Allow: GET,HEAD` body `GET,HEAD`; `OPTIONS /server/setup`, `OPTIONS /server/specs/graphql` → khác biệt D-14, D-15; `OPTIONS /server/ping`, `OPTIONS /`, `OPTIONS /robots.txt` → 404; `HEAD`, `/server/ping/` và `/SERVER/ping`; `GET /` → 302; `GET /robots.txt` mặc định và `ROBOTS_TXT` tùy biến (profile `cors-hsts` của T065), so body, `Content-Type`, tập header FR-104; `GET /admin` → 404, khác biệt D-08); `tests/parity/src/server/conditional.test.ts` (`If-None-Match` trùng ETag → 304 cho ping, health, info)
- [ ] T050 [P] [US2] `tests/parity/src/server/errors.test.ts`: route lạ → 404 `ROUTE_NOT_FOUND`; body JSON sai và vượt `MAX_PAYLOAD_SIZE` → `INVALID_PAYLOAD`; `?limit=abc` trên `/server/*` và `/nope?limit=abc` → khác biệt D-12 (API mới bỏ qua query); path lạ và `POST /server/ping` kèm Bearer sai → Directus `401 INVALID_CREDENTIALS`, API mới `404` (D-10); route chưa làm (`/auth`, `/items`, `/graphql`...) và route ngoài phạm vi (`/mcp`, `/ai`, `/deployments`, `/server/specs/graphql`) → API mới 404, chỉ chấp nhận khi có mã D-09.*, D-15 hoặc D-17. Dùng profile `ratelimit` của T065: vượt giới hạn → 429 `REQUESTS_EXCEEDED` (chỉ so định dạng `Retry-After`, `reset`; `extensions.limit` giống nhau); hai app đếm chung key Redis `rlflx:<ip>` và `rlflx:global-rate-limit`; vượt giới hạn toàn cục (nhiều IP qua `X-Forwarded-For`) → 429 ở cả hai; `/server/health` → `warn` theo ngưỡng rate limiter rất thấp; dừng container Redis → mọi request kể cả `/server/ping` nhận `500 INTERNAL_SERVER_ERROR` ở cả hai (FR-025). Dùng profile `pressure` của T065: `503 SERVICE_UNAVAILABLE`, so status, body, `Retry-After`, cả hai đều không có `X-Powered-By`, CSP (FR-045)
- [ ] T051 [P] [US2] Unit test `apps/api/src/services/settings.service.test.ts` (3 câu SQL của `readSingleton`: `directus_users limit 1`, `directus_settings order by id limit 1`, `directus_files where id in`; `cast-boolean` cho MySQL/SQLite/Oracle; `cast-json` cho chuỗi từ SQLite/MSSQL/MariaDB/Oracle, bỏ `__proto__`, JSON hỏng giữ chuỗi; `public_background` ở cuối; nhánh không có dòng settings), `server.service.test.ts` (health: ngưỡng, `ok`/`warn`/`error`, `SERVER_ONLINE=false`, `email:connection` luôn `ok`, request không admin chỉ nhận `{status}`; info: `version` chỉ khi chưa setup), `controllers/server.controller.test.ts`
- [ ] T052 [P] [US2] Unit test cho phần dựng OpenAPI: port `directus/api/src/services/specifications.test.ts` sang `apps/api/src/services/specifications.service.test.ts` (đổi chữ "Directus" theo D-02), `apps/api/src/schema/get-database-schema.test.ts` (`DB_EXCLUDE_TABLES`, bảng không khóa chính, tên có dấu cách), `read-relations.test.ts` (`stitchRelations`), `apps/api/src/permissions/fetch-public-policies.test.ts` (lọc IP, thứ tự `sort`, `cast-csv`), `fetch-permissions.test.ts`, `fetch-allowed-field-map.test.ts`, `apps/api/src/utils/reduce-schema.test.ts`
- [ ] T053 [P] [US2] Unit test hạ tầng: port test gốc của `directus/api/src/rate-limiter.ts` và hai middleware rate limiter (gồm kiểm tra cấu hình global phải cho phép nhiều request/giây hơn IP), `apps/api/src/storage/*.test.ts` (port từ `directus/api/src/storage/*.test.ts`: chỉ driver `local`, `s3`), `apps/api/src/middleware/router-options.test.ts` (đúng các path của router, không gồm `/server/setup`, `/server/specs/graphql` (D-14, D-15), `Allow: GET,HEAD`, tôn trọng `OPENAPI_ENABLED`, `METRICS_ENABLED`), `public-accountability` cảnh báo lần đầu mỗi process khi request có Bearer, `access_token` hoặc cookie `SESSION_COOKIE_NAME` (kể cả tên tùy biến), các lần sau mức `debug` (FR-044), `cache.test.ts` (health ghi rồi xóa key)

### Thư viện cần cho US2 (port)

- [ ] T054 [P] [US2] Port `directus/packages/system-data/src/**` (collections, fields, relations, app-access-permissions: các YAML và `index.ts`) sang `libs/system-data/src/**` thành `@backoffice/system-data`; nạp YAML bằng `js-yaml` một lần khi load module (thay `unplugin-yaml`), copy YAML vào output build; kèm test gốc; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T055 [P] [US2] Port `directus/packages/format-title/src/**` sang `libs/format-title/src/**` thành `@backoffice/format-title` kèm test; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T056 [P] [US2] Port `directus/packages/specs/src/**` (YAML OpenAPI) sang `libs/specs/src/**` thành `@backoffice/specs`: đổi chữ "Directus" đứng riêng trong `title`, `summary`, `description` thành "Backoffice" (KHÔNG đụng `directus_*`, `@directus/sdk`), script `build` dùng `swagger-cli@4.0.4 bundle src/openapi.yaml -o dist/openapi.json`, `index.js` export `spec` như `directus/packages/specs/index.js`; thêm test so `dist/openapi.json` với bản trong image `directus/directus:11.17.4` sau cùng phép thay chữ (bỏ qua nếu không có Docker); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T057 [P] [US2] Port `directus/packages/storage/src/**`, `directus/packages/storage-driver-local/src/**`, `directus/packages/storage-driver-s3/src/**` sang `libs/storage`, `libs/storage-driver-local`, `libs/storage-driver-s3` (`@backoffice/storage*`) kèm test, cùng AWS SDK 3.928.0, `@smithy/node-http-handler` 4.4.5, `@shopify/semaphore` 3.1.0, `@tus/utils` 0.6.0; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)

### Cài đặt US2

- [X] T058 [US2] Port `directus/api/src/cache.ts` (chỉ `getCache()` phần `cache`, `getKeyvInstance`, `getConfig`, `setCacheValue`/`getCacheValue`; bus, schema cache, `clearSystemCache` để feature 002) sang `apps/api/src/cache.ts`; port `directus/api/src/rate-limiter.ts`, `middleware/rate-limiter-ip.ts`, `middleware/rate-limiter-global.ts` sang `apps/api/src/rate-limiter.ts`, `apps/api/src/middleware/rate-limiter-{ip,global}.ts` (cùng `keyPrefix` mặc định để đếm chung key với Directus); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T059 [P] [US2] Port `directus/api/src/storage/{index,register-drivers,register-locations,get-storage-driver}.ts` sang `apps/api/src/storage/` (`getStorage()`; `getStorageDriver` chỉ trả `local` và `s3`, driver khác ném lỗi); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T060 [P] [US2] Port phần dựng schema: `getDatabaseSchema` của `directus/api/src/utils/get-schema.ts`, `get-local-type.ts`, `get-default-value.ts`, `get-field-system-rows.ts` sang `apps/api/src/schema/`; `readAll` và `stitchRelations` của `directus/api/src/services/relations.ts` thành `apps/api/src/schema/read-relations.ts` (đọc `directus_relations` bằng knex, `cast-csv` cho `one_allowed_collections`); KHÔNG cache (FR-049); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T061 [P] [US2] Port quyền public bằng knex trực tiếp (research R16.4): `fetch-policies` thành `apps/api/src/permissions/fetch-public-policies.ts` (lọc `role is null and user is null`, sắp `sort`, `filter-policies-by-ip.ts`, `ipInNetworks`), `fetch-permissions`, `fetch-allowed-field-map` từ `directus/api/src/permissions/**` sang `apps/api/src/permissions/` và `reduceSchema` từ `directus/api/src/utils/reduce-schema.ts` sang `apps/api/src/utils/reduce-schema.ts`; không cache; câu SQL đúng như `data-model.md` §1; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T062 [US2] Port `directus/api/src/services/specifications.ts` (chỉ `oas`: `generate`, `generateTags`, `generatePaths`, `generateComponents`, `generateField`, `fieldTypes`) sang `apps/api/src/services/specifications.service.ts` giữ nguyên mọi điểm lạ (path rỗng tạo trước khi kiểm tra quyền, `mergeWith` nối mảng, `replace` chỉ thay `item` đầu tiên); dùng `lodash-es`, `object-hash` 3.0.0, `@backoffice/format-title`, `@backoffice/specs`; `servers[0].url` = `PUBLIC_URL`, riêng `/` thì là header Host; đổi chữ "Directus" thành "Backoffice" ở `servers[].description`; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T063 [US2] Viết `apps/api/src/services/settings.service.ts` (bản rút gọn của `ItemsService.readSingleton` ở `directus/api/src/services/items.ts:1190-1231`: 3 câu SQL, `cast-boolean`, `cast-json`, thứ tự key, nhánh không có dòng dùng SchemaOverview dựng bằng phần port của T060, chỉ khi không có dòng) và port `directus/api/src/services/server.ts` sang `apps/api/src/services/server.service.ts` (`serverInfo` public, `health` đủ DB/cache/rate limiter/rate limiter global/storage, `email:connection` luôn `ok`, `releaseId` = `DIRECTUS_COMPAT_VERSION`, đọc `SERVER_ONLINE`); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T064 [US2] Tạo `apps/api/src/controllers/server.controller.ts` (controller mỏng: `GET /server/info`, `GET /server/health` với `Content-Type: application/health+json` và `503` khi `error`, `GET /server/specs/oas` chỉ đăng ký khi `OPENAPI_ENABLED !== false`), `apps/api/src/middleware/respond.ts` (`Cache-Control: no-cache`, `Vary: Origin, Cache-Control`, `res.json`), `apps/api/src/middleware/router-options.ts` (R4) và nối vào `app.module.ts` / `app-pipeline.ts` đúng thứ tự: rate limiter global, rate limiter IP, `/server/ping`, accountability public, router-options, route Nest, rồi 404 do Nest ném `NotFoundException` (R14, filter T019), KHÔNG có handler 404 Express; cảnh báo token lần đầu mỗi process trong `public-accountability` (FR-044); đăng ký provider hạ tầng trong `apps/api/src/app.module.ts` (`useFactory` bọc `useEnv`, `useLogger`, `getDatabase`, `useRedis`, token `ENV`, `LOGGER`, `DATABASE`, `REDIS`) để service nhận qua inject
- [ ] T065 [US2] Thêm vào `tests/parity/docker-compose.yml` các profile. Mỗi profile thêm MỘT CẶP container riêng (`directus-<profile>`, `backoffice-api-<profile>`, cổng riêng, cùng DB, cùng Redis, `CACHE_NAMESPACE` riêng), hai app của cặp đọc cùng file env vendor cộng phần mở rộng của profile; cặp chính không đổi env, nên bật nhiều profile cùng lúc không ảnh hưởng test khác; test của profile đọc `DIRECTUS_URL_<PROFILE>`, `BACKOFFICE_URL_<PROFILE>` do `globalSetup` (T024) đặt: `ratelimit` (`RATE_LIMITER_ENABLED=true`, `RATE_LIMITER_STORE=redis`, `RATE_LIMITER_POINTS` nhỏ, `RATE_LIMITER_GLOBAL_ENABLED=true` với giới hạn toàn cục lớn hơn IP, `RATE_LIMITER_HEALTHCHECK_THRESHOLD` và `RATE_LIMITER_GLOBAL_HEALTHCHECK_THRESHOLD` rất thấp), `cors-hsts` (`CORS_ENABLED=true`, `HSTS_ENABLED=true`, `ROBOTS_TXT` tùy biến), `pressure` (`PRESSURE_LIMITER_MAX_MEMORY_RSS` rất nhỏ; healthcheck kiểm cổng TCP thay cho `/server/health`); đây là task DUY NHẤT sửa profile của US2 (T049, T050 chỉ dùng), cập nhật `tests/parity/accepted-differences.ts` với `D-01`, `D-02`, `D-07`, `D-08`, `D-10`, `D-11`, `D-12`, `D-13`, `D-14`, `D-15`, `D-17`, `D-09.*` đang dùng
- [ ] T066 [US2] Xác nhận US2: chạy mọi test US2 trên `postgres` (`PARITY_SUITE=full`, bật profile `ratelimit`, `cors-hsts`, `pressure`); chạy lại `db-unchanged`, `readonly-account` (bộ request đã có endpoint US2); `mysql`, `sqlite3` chạy ở T085 sau khi T083 thêm env; không còn khác biệt ngoài danh sách; `pnpm nx run-many -t lint typecheck test build` đạt

**Checkpoint**: US1 và US2 cùng chạy: bốn endpoint `/server/*` giống Directus theo FR-103 đến FR-105.

---

## Phase 5: User Story 3 - Dừng khởi động khi migration lệch (Priority: P1) 🎯 MVP (cùng US1)

**Goal**: API dừng khi `directus_migrations` thiếu hoặc thừa so với Directus 11.17.4 (chấp nhận migration tùy biến), log nêu rõ version lệch; thực hiện các kiểm tra khởi động còn lại.

**Independent Test**: Ba DB: đủ migration, thiếu một, thừa một: khởi động API mới trên từng DB, kiểm tra mã thoát và log (US3.1–US3.9).

### Tests cho US3 (BẮT BUỘC) - viết trước, phải fail trước khi cài đặt

> **LƯU Ý**: Viết các test này TRƯỚC và xác nhận chúng FAIL trước khi cài đặt.

- [X] T067 [P] [US3] `apps/api/src/database/validate-migrations.test.ts`: đủ → ok; thiếu 1 hoặc nhiều; thừa; vừa thiếu vừa thừa (log cả hai nhóm, sắp tăng dần); migration tùy biến ở `MIGRATIONS_PATH` (có `-`, đuôi `.js`/`.cjs`/`.mjs`) và ở `EXTENSIONS_PATH/migrations` (đuôi `.js`) → hợp lệ kèm warn (message dòng 11b); ở `MIGRATIONS_PATH` file không có `-` hoặc sai đuôi không tính; ở `EXTENSIONS_PATH/migrations` file sai đuôi không tính, file `.js` không có `-` (ví dụ `utils.js`) cho version là cả tên file và bị báo thiếu; thư mục thiếu hoặc rỗng; version trùng tính một lần; so sánh phân biệt hoa thường; file trong thư mục nhưng chưa có trong DB → thiếu; không import file migration (FR-031, FR-035, FR-036)
- [X] T068 [P] [US3] `apps/api/src/database/migrations/directus-11.17.4.test.ts`: đọc `directus/api/src/database/migrations`, lọc theo `/^[0-9]+[A-Z]-[^.]+\.(?:js|ts)$/`, cắt trước dấu `-`, kỳ vọng đúng 101 version và bằng mảng tĩnh (fail khi lệch)
- [X] T069 [P] [US3] `apps/api/src/startup/run-startup-checks.test.ts` và `validate-storage-drivers.test.ts`: từng dòng của `contracts/startup.md` §1 (thứ tự, mức log, message, mã thoát): cấu hình global rate limiter sai, biến DB thiếu, DB không kết nối, thiếu `directus_collections` (`Database doesn't have Directus tables installed.`), migration lệch kèm gợi ý, `SECRET` thiếu hoặc ngắn, `PUBLIC_URL` không tuyệt đối, PostGIS/Spatialite thiếu, storage driver `gcs`/`azure`/`cloudinary`/`supabase` (FR-034, nêu tên location và driver), thư mục SQLite/upload/extensions (`validateStorage`)
- [X] T070 [P] [US3] `apps/api/src/database/helpers/geometry/geometry.test.ts` (`supported()` của Postgres/CockroachDB qua `pg_proc`, SQLite qua `pragma_function_list`, mặc định `true`) và `database/index.test.ts` bổ sung `isInstalled`, `validateDatabaseExtensions` (message theo từng client)
- [X] T071 [P] [US3] `tests/parity/src/startup/temp-db.ts` (tạo DB tạm từ DB đã migrate: Postgres: tạo một lần DB mẫu `directus_template` không có kết nối nào (`pg_dump | psql` từ DB chính sau khi Directus bootstrap), rồi `CREATE DATABASE <tạm> TEMPLATE directus_template`; SQLite copy file, vendor khác bỏ qua kèm `skip`) và `tests/parity/src/startup/startup.test.ts` (PARITY_SUITE=full): đủ migration → chạy; thiếu `20260211A` → thoát mã 1, log nêu version; thừa version lạ; vừa thiếu vừa thừa; migration tùy biến hợp lệ ở `MIGRATIONS_PATH` và ở `EXTENSIONS_PATH/migrations` (file trong volume mount); chưa cài Directus; DB không kết nối; storage driver `gcs`; cổng bị chiếm; ba instance khởi động cùng lúc bằng role chỉ SELECT của T037 (cấp SELECT trên DB tạm) cho cùng kết quả và snapshot DB không đổi (US3.8); Directus migrate dở (xóa một dòng migration cuối) cho log có gợi ý (US3.9); SC-004 (≤ 10 giây khi DB truy cập được)

### Cài đặt US3

- [X] T072 [US3] Viết `tools/generate-migration-list.mjs` (đọc `directus/api/src/database/migrations`, lọc theo regex của `run.ts`, in mảng đã sắp) và chạy nó để sinh `apps/api/src/database/migrations/directus-11.17.4.ts` (101 version, `20201028A` đến `20260211A`); không gõ tay
- [X] T073 [US3] Viết `apps/api/src/database/validate-migrations.ts` (FR-031/035/036: gộp danh sách chuẩn và version tùy biến từ `MIGRATIONS_PATH` và `getExtensionsPath()/migrations`, tính `missing` và `extra`, log `error` theo `contracts/startup.md` dòng 11 kèm gợi ý, `process.exit(1)`; log `warn` dòng 11b khi có version tùy biến; chỉ `readdir`, không mở, không import; không thử lại) và thêm vào `apps/api/src/database/index.ts` các hàm port `isInstalled` (`hasTable('directus_collections')` qua inspector) và `validateDatabaseExtensions`; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file) cho phần port
- [X] T074 [P] [US3] Port `directus/api/src/database/helpers/geometry/{index,types}.ts` và `dialects/*.ts` sang `apps/api/src/database/helpers/geometry/` chỉ giữ `supported()` (và lớp cơ sở tối thiểu để biên dịch); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [X] T075 [P] [US3] Port `directus/api/src/utils/validate-storage.ts` sang `apps/api/src/utils/validate-storage.ts` và viết `apps/api/src/startup/validate-storage-drivers.ts` (FR-034: duyệt `STORAGE_LOCATIONS`, driver ngoài `local`/`s3` thì log message dòng 15 và `process.exit(1)`); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file) cho phần port
- [X] T076 [US3] Viết `apps/api/src/startup/run-startup-checks.ts` thực hiện đúng thứ tự và message của `contracts/startup.md` §1 (dòng 1–17, trừ dòng 9 chạy song song), thay phần kiểm tra tạm ở `main.ts` của US1 bằng lời gọi này; cảnh báo `SECRET`, `PUBLIC_URL` theo FR-033
- [X] T077 [US3] Xác nhận US3: chạy `startup.test.ts` trên `postgres` (`sqlite3` chạy ở T085 sau khi T083 thêm env); thử thủ công theo `quickstart.md` §7; kiểm tra log lỗi liệt kê đúng version

**Checkpoint**: US1, US2, US3 cùng chạy: API mới không chạy trên schema hệ thống lệch phiên bản. Đây là MVP (US1 + US3).

---

## Phase 6: User Story 4 - Bộ test đối chiếu với Directus thật (Priority: P2)

**Goal**: Lập trình viên chạy một lệnh để so Directus 11.17.4 thật với API mới và nhận báo cáo khác biệt rõ ràng; khác biệt được chấp nhận khai báo tập trung và tự hết hạn.

**Independent Test**: Chạy bộ test với Directus tham chiếu và API mới; cố ý đổi một chi tiết response thì bộ test báo đúng endpoint, trường, giá trị hai bên (US4.1–US4.4).

### Tests cho US4 (BẮT BUỘC)

> **LƯU Ý**: Viết các test này TRƯỚC và xác nhận chúng FAIL trước khi cài đặt.

- [ ] T078 [P] [US4] `tests/parity/src/accepted-differences.test.ts` (đọc bảng "Khác biệt so với Directus" của spec qua `spec-differences.ts` do T081 viết): mỗi mục có `id` trong bảng của đúng spec `specs/<feature>-*/spec.md` ghi ở trường `feature` (mã trùng ở spec khác không tính); `removeAt` khớp cột "Gỡ khi" của bảng đó; mục còn lại khi spec của feature `removeAt` có `Status: Done` làm test fail (FR-101); dùng spec giả trong thư mục tạm để kiểm cả ca fail, gồm hai spec cùng có `D-01`
- [ ] T079 [P] [US4] `tests/parity/src/parity-report.test.ts`: hai server cục bộ trả khác một header, một giá trị body lồng sâu, một status → thông báo lỗi nêu endpoint, header hoặc JSON pointer, giá trị Directus và giá trị API mới; khác biệt có trong `accepted-differences` thì bị bỏ qua (gồm khác biệt status qua `location: { status: true }`), ngoài danh sách thì fail (US4.2)
- [ ] T080 [P] [US4] `tests/parity/src/vendors.test.ts`: `getDbsToTest()` đọc `TEST_DB`, từ chối vendor lạ, trả đúng cấu hình `DB_*` và cổng cho 9 vendor; `PARITY_SUITE=reduced|full` chọn đúng nhóm file

### Cài đặt US4

- [ ] T081 [US4] Hoàn thiện `tests/parity/accepted-differences.ts`: đủ `D-01` đến `D-20` và `D-09.1` đến `D-09.9`, mỗi mục có `feature: '001'`, `kind`, `reason`, `removeAt`; mục `kind: 'http'` có `endpoints`, `location`, giá trị hai bên; mục `kind: 'doc'` (D-03, D-04, D-05, D-06, D-16, D-18, D-19, D-20) không có `location` (D-09.1=003, D-09.2=004, D-09.3=005, D-09.4=006, D-09.5=007, D-09.6=008, D-09.7=009, D-09.8=010, D-09.9=011, D-10=004, D-11=005, D-12=005, D-14=010, D-15=011, D-20=002); viết `tests/parity/src/spec-differences.ts`
- [ ] T082 [US4] Hoàn thiện `parity.ts`: báo cáo khác biệt theo US4.2, tích hợp `accepted-differences` (mục `kind: 'doc'` bỏ qua khi so; `location` `status` cho khác biệt status), `PARITY_SUITE=reduced|full`: `full` chạy mọi `*.test.ts` của target `parity` (không cần liệt kê file); `reduced` chỉ chạy `server/{ping,health,info,errors,methods,conditional}.test.ts`, và trong các file đó ca cần dừng container hoặc profile riêng (`ratelimit`, `cors-hsts`, `pressure`, `metrics`) chỉ chạy ở `full`
- [ ] T083 [US4] Thêm env và profile compose cho từng vendor: `tests/parity/env/{postgres10,mysql,mysql5,maria,sqlite3,mssql,oracle,cockroachdb}.env` và service DB trong `tests/parity/docker-compose.yml` (images: `postgis/postgis:10-3.2-alpine`, `mysql:8`, `mysql:5`, `mariadb:11.4`, `mcr.microsoft.com/mssql/server:2022-latest`, `gvenzl/oracle-xe:21-slim-faststart`, `cockroachdb/cockroach:latest-v24.3`; SQLite dùng volume chung cho hai app); mỗi vendor một file env dùng cho CẢ HAI app
- [ ] T084 [US4] Điều chỉnh `db-snapshot.ts` và `tests/parity/src/server/info.test.ts` cho từng vendor (kiểu cột, boolean, JSON); hoàn thiện target Nx `parity-tests:parity` (`--vendor` đặt `TEST_DB`, thắng biến có sẵn; `PARITY_SUITE`), và `tests/parity/README.md` (tiếng Việt) mô tả cách chạy, cách thêm khác biệt được chấp nhận
- [ ] T085 [US4] Xác nhận US4: chạy `PARITY_SUITE=reduced` trên `postgres`, `mysql`, `maria`, `sqlite3`; `PARITY_SUITE=full` trên `postgres`; chạy `startup.test.ts` trên `sqlite3` (dời từ T077); cố ý đổi một chi tiết response của API mới (cục bộ, không commit) và kiểm tra báo cáo đúng chỗ

**Checkpoint**: Bộ test đối chiếu chạy được trên Postgres, MySQL, MariaDB, SQLite (T085); MSSQL, Oracle, CockroachDB xác nhận ở lượt nightly đầu tiên sau T098 (SC-001); báo cáo rõ khác biệt, và tự phát hiện khác biệt tạm thời hết hạn.

---

## Phase 7: User Story 5 - Log và metrics giống Directus (Priority: P2)

**Goal**: Log JSON giống Directus (`LOG_LEVEL`, `LOG_STYLE`, request id) và `/metrics` Prometheus theo `METRICS_*` với cùng tên metric.

**Independent Test**: `LOG_STYLE=raw` cho từng dòng log JSON cùng tập key; `METRICS_ENABLED=true` scrape `/metrics` ở hai app cho cùng tên metric (US5.1–US5.8).

### Tests cho US5 (BẮT BUỘC)

> **LƯU Ý**: Viết các test này TRƯỚC và xác nhận chúng FAIL trước khi cài đặt.

- [ ] T086 [P] [US5] `apps/api/src/logger/logger.contract.test.ts`: `LOG_STYLE=raw` ra JSON một dòng với `req.id`, `req.method`, `req.url`, `res.statusCode`, `responseTime`; `LOG_LEVEL=warn` bỏ log thấp hơn; `Authorization`/`Cookie` bị che `--redacted--`; khi `LOG_STYLE=raw` thêm `req.query.access_token` và `res.headers['set-cookie']` bị che (như Directus); `access_token` trong `req.url` bị che; `LOG_HTTP_IGNORE_PATHS`; `LOGGER_LEVELS` đổi trường `severity`; request id là số tăng dần, không đọc `X-Request-Id`, không thêm header; không log giá trị secret (FR-062); `LOG_STYLE` mặc định dùng pino-pretty
- [ ] T087 [P] [US5] Port test gốc `directus/api/src/metrics/lib/use-metrics.test.ts` và `directus/api/src/schedules/metrics.test.ts` sang `apps/api/src/metrics/lib/use-metrics.test.ts`, `apps/api/src/schedules/metrics.test.ts`; thêm `apps/api/src/controllers/metrics.controller.test.ts` (admin không có ở feature này; `Metrics <token>` hợp lệ → 200 `text/plain`, `Cache-Control: no-cache`, `Vary: Origin, Cache-Control`; sai hoặc thiếu, hoặc chỉ có Bearer hay `?access_token=` → 403 `FORBIDDEN` (D-10); `METRICS_ENABLED=false` → 404) và test tên metric, help text, bucket histogram theo `contracts/observability.md`
- [ ] T088 [P] [US5] `tests/parity/src/observability/metrics.test.ts` (dùng profile `metrics` của T091: `METRICS_ENABLED=true`, `METRICS_TOKENS`, `METRICS_SCHEDULE` ngắn; chờ một lượt, scrape cả hai, so tập tên metric và help text, không so giá trị; so header FR-104 gồm `Vary`; `OPTIONS /metrics` → `200 Allow: GET,HEAD`, `HEAD /metrics`; `/metrics` không token → 403; Bearer sai → khác biệt D-10; `/metrics?limit=abc` → khác biệt D-12; tắt → 404 như nhau) và `tests/parity/src/observability/logs.test.ts` (`LOG_STYLE=raw` ở cả hai: đọc `docker logs`, gửi `GET /server/ping` (Directus phục vụ trước bước xác thực nên token không đổi response) một lần kèm `Authorization`, `Cookie`, một lần kèm `?access_token=`; so tập key đệ quy của dòng log HTTP (gồm `req.headers`, `req.query`, `res.headers`) sau khi bỏ `time`, `pid`, `hostname`, `remotePort`, `responseTime`, `req.id`; kiểm tra giá trị nhạy cảm bị che)

### Cài đặt US5

- [ ] T089 [US5] Port `directus/api/src/metrics/lib/{create-metrics,use-metrics}.ts` và `types/*` sang `apps/api/src/metrics/` THAY stub của Phase 2 (BỎ nhánh PM2/`AggregatorRegistry`; giữ tên metric, help, bucket; metric Redis và storage dùng `useRedis()`, `getStorage()`); thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T090 [US5] Port `directus/api/src/schedules/metrics.ts` sang `apps/api/src/schedules/metrics.ts` (`cron` 4.3.4, `validateCron` ← `directus/api/src/utils/schedule.ts`, khóa chống chạy chồng trong process, ngoại lệ Nguyên tắc VII ghi ở Complexity Tracking) và `directus/api/src/controllers/metrics.ts` thành `apps/api/src/controllers/metrics.controller.ts` (chỉ chấp nhận `Metrics <token>` ở feature này, FR-044, FR-071); đăng ký route khi `METRICS_ENABLED=true`, thêm `/metrics` vào `router-options.ts`, dừng job trong `onSignal` của `server.ts`; tạo `apps/api/src/metrics/metrics.module.ts` export `MetricsService` (bọc `useMetrics()`), `metrics.controller.ts` nhận service qua inject; thêm comment đầu file `// Ported from directus/<đường dẫn nguồn>` cho mọi file port và ghi từng cặp nguồn→đích vào file riêng `tools/port-manifest/<tên-task>.json` (mỗi task một file để các task [P] không đụng cùng file)
- [ ] T091 [US5] Thêm profile `metrics` (một cặp container riêng theo quy ước của T065) với `LOG_STYLE=raw` vào `tests/parity/docker-compose.yml` / `tests/parity/env`, cập nhật danh sách khác biệt nếu cần (D-03, D-18, D-19), rồi xác nhận US5: chạy test logger, metrics và `observability/*` trên `postgres`; chạy lại `readonly-account` với profile `metrics` (có `/metrics`)

**Checkpoint**: Log và metrics dùng chung được hệ thống thu thập của Directus (SC-005).

---

## Phase 8: User Story 6 - Pipeline CI chặn thay đổi không đạt chuẩn (Priority: P2)

**Goal**: Mỗi PR tự chạy lint, typecheck, unit test kèm coverage, test đối chiếu, E2E (app web), quét bảo mật, benchmark và build image; không đạt thì không merge.

**Independent Test**: Mở bốn PR thử (lỗi lint, coverage tụt dưới ngưỡng, secret giả, response `/server/info` khác Directus): cả bốn bị chặn (US6.1–US6.5).

### Tests cho US6 (BẮT BUỘC)

> **LƯU Ý**: Viết các test này TRƯỚC và xác nhận chúng FAIL trước khi cài đặt.

- [ ] T092 [P] [US6] `tools/guard-directus-unchanged.test.mjs`: tạo repo git tạm, đổi một file dưới `directus/` thì script fail, chỉ đổi file ngoài `directus/` thì đạt (FR-111)
- [ ] T093 [P] [US6] `tests/benchmark/src/compare.test.ts`: quy tắc so sánh (trung vị 3 vòng; fail khi p95 của API mới lớn hơn Directus quá 10% hoặc request/giây nhỏ hơn quá 10%; đạt khi trong ngưỡng; xử lý vòng lỗi), `percentile` từ histogram (FR-113, R18)

### Cài đặt US6

- [ ] T094 [P] [US6] Viết `tools/guard-directus-unchanged.mjs` (so `git diff --name-only <base>...HEAD`, fail nếu có đường dẫn bắt đầu bằng `directus/`)
- [ ] T095 [P] [US6] Tạo `tests/benchmark` (`@backoffice/benchmark`): `package.json`, `project.json` (`"name": "benchmark"`; target `env-up`, `env-down`, `run`; chỉ Postgres, `run` không tự dựng môi trường), `src/run.ts` (autocannon 8.0.0 qua API lập trình, 50 kết nối, khởi động nóng 5 s, 3 vòng luân phiên mỗi vòng 20 s, p95 từ sự kiện response bằng `hdr-histogram-js`; endpoint `/server/ping`, `/server/health`, `/server/info` so với Directus mặc định, `/server/specs/oas` so với container `directus-nocache`), `src/compare.ts`, `docker-compose.yml` (`include` profile `postgres` của `tests/parity/docker-compose.yml` và thêm `directus-nocache` chạy `CACHE_SCHEMA=false`), biến `BENCH_ROUNDS`, `BENCH_DURATION`
- [ ] T096 [P] [US6] Kiểm tra mọi `libs/*` BE dùng `createVitestConfig({ coverageThreshold: 80 })` của `vitest.shared.ts` và bật báo cáo `lcov` (`apps/api` đặt 80 ở T016, `apps/web` đặt 60 ở T102); sửa lib nào còn thiếu
- [ ] T097 [US6] Tạo `.github/workflows/ci.yml` (pull request và push `main`; cài Node 22 + Corepack pnpm; jobs: `guard-directus`, `quality` với `nx affected -t lint typecheck test build`, `pnpm run check-port-headers`, `pnpm run check-package-names` và `swagger-cli validate` cho `specs/*/contracts/*.openapi.yaml`, `guard-differences`, `parity` chạy `pnpm nx run parity-tests:env-up --vendor=<vendor>` (kèm `--profiles` của dòng matrix), `pnpm nx run parity-tests:parity --vendor=<vendor>`, cuối job `parity-tests:env-down` (luôn chạy, kể cả khi fail), theo matrix `postgres`+`full` (bật thêm profile `ratelimit`, `cors-hsts`, `pressure`, `metrics`), `mysql`+`reduced`, `sqlite3`+`reduced`, `benchmark` (sau `parity`, Postgres: `benchmark:env-up` rồi `benchmark:run`), `docker` (build `apps/api` và `apps/web`), `e2e` (sau `docker`: dựng Postgres đã được Directus 11.17.4 bootstrap bằng `pnpm nx run parity-tests:env-up --vendor=postgres`, chạy container `apps/web` và `apps/api` từ image của job `docker`, chạy smoke test Playwright của T101 bằng `pnpm nx run web-e2e:e2e` với `BASE_URL` trỏ tới container web), `security`: `pnpm audit --prod --audit-level=high` và gitleaks bằng image `ghcr.io/gitleaks/gitleaks`), job nào fail thì PR không merge được (ghi chú cấu hình branch protection trong `tests/parity/README.md`)
- [ ] T098 [P] [US6] Tạo `.github/workflows/nightly.yml` (`schedule` hằng đêm: `PARITY_SUITE=full` cho `maria`, `mssql`, `oracle`, `cockroachdb`, `postgres10`, `mysql5`, cùng `mysql`, `sqlite3` bản `full`; tải artifact log khi fail), `.github/workflows/codeql.yml` (`javascript-typescript`, pull request, push `main`, hằng tuần), `.github/dependabot.yml` (npm/pnpm và GitHub Actions, hằng tuần), `.gitleaks.toml` (allowlist cho `tests/parity/env/*.env` và `dev/directus-reference`); nếu repo private không có GitHub Code Security thì thay CodeQL bằng Semgrep CE và ghi vào Complexity Tracking của `plan.md`
- [ ] T099 [US6] Xác nhận US6: chạy cục bộ `act` hoặc từng bước script của `ci.yml`; mở 4 PR thử trên GitHub (lỗi lint, coverage tụt, secret giả, response `/server/info` khác Directus) và xác nhận cả bốn bị chặn; ghi kết quả vào mô tả PR

**Checkpoint**: Mọi cổng chất lượng của Nguyên tắc X chạy tự động và chặn merge; ngưỡng coverage của `apps/web` và job `e2e` có hiệu lực khi US7 (T101–T104) xong.

---

## Phase 9: User Story 7 - Workspace monorepo cho lập trình viên (Priority: P3)

**Goal**: Lập trình viên clone repo, cài một lệnh, build/lint/test thống nhất; app web khung đọc cấu hình lúc chạy và hiển thị Backoffice.

**Independent Test**: Trên máy sạch có Node 22 và pnpm 10: clone, `pnpm install`, `pnpm nx run-many -t build lint typecheck test` đều đạt; mở app web thấy "Backoffice" (US7.1–US7.4).

### Tests cho US7 (BẮT BUỘC)

> **LƯU Ý**: Viết các test này TRƯỚC và xác nhận chúng FAIL trước khi cài đặt.

- [ ] T100 [P] [US7] `apps/web/src/runtime-config.test.ts` (đọc `config.json` lúc chạy, thiếu file thì dùng mặc định `/`, không ghi cứng lúc build) và `apps/web/src/App.test.ts` (Vitest + `@vue/test-utils` + `happy-dom`: hiển thị chữ "Backoffice", gọi `GET <apiUrl>/server/ping` và hiện kết quả, i18n `en-US` và `vi-VN`)
- [ ] T101 [P] [US7] `apps/web-e2e/src/smoke.spec.ts` (Playwright 1.64: mở `/admin/`, thấy "Backoffice", gọi ping thành công, `config.json` đổi URL API thì app gọi URL mới) và `tools/check-package-names.test.mjs` cùng `tools/check-package-names.mjs` và script gốc `pnpm run check-package-names` (mọi `package.json` nội bộ có tên `@backoffice/*`; không còn `@directus/*` trừ thư viện bên thứ ba cho phép như `@directus/sdk`; FR-002)

### Cài đặt US7

- [ ] T102 [P] [US7] Tạo project `apps/web` (`@backoffice/web`): `package.json`, `project.json` (`"name": "web"`; target `serve`, `build`, `test`, `lint`, `typecheck`), `vite.config.ts` (Vite 7.3, `@vitejs/plugin-vue`, `base: '/admin/'`), `index.html`, `tsconfig.json`, `vitest.config.ts` (ngưỡng coverage 60), `eslint` theo `eslint-plugin-vue`
- [ ] T103 [US7] Viết `apps/web/src/main.ts`, `App.vue` (Composition API, `<script setup lang="ts">`, hiển thị "Backoffice" và kết quả ping), `router/index.ts`, `stores/server.ts` (Pinia), `i18n/index.ts` (vue-i18n 11, mỗi ngôn ngữ một file, thêm ngôn ngữ sau không sửa code khác) và `i18n/{en-US,vi-VN}.ts` (copy đúng các key khung cần từ `directus/app/src/lang/translations/{en-US,vi-VN}.yaml`, dòng đầu `// Ported from directus/app/src/lang/translations/<lang>.yaml`, ghi `tools/port-manifest/T103.json`; chữ "Directus" chỉ app đổi thành "Backoffice"), `runtime-config.ts` và `public/config.json` mặc định (PrimeVue 5 + `@primeuix/themes` chỉ nạp những gì khung cần)
- [ ] T104 [US7] Tạo `apps/web/Dockerfile` (nginx:alpine phục vụ build ở `/admin`, fallback `index.html` cho route SPA, script `apps/web/docker/40-config.sh` sinh `config.json` từ biến môi trường lúc container khởi động để một image dùng cho mọi môi trường; Nguyên tắc VII, FR-003) và `apps/web/nginx.conf`; tạo project `apps/web-e2e` (`project.json` có `"name": "web-e2e"` và target `e2e` của `@nx/playwright`, `playwright.config.ts` đọc `BASE_URL`, mặc định dev server của `apps/web`)
- [ ] T105 [US7] Xác nhận US7 và SC-008: trên máy sạch (container `node:22`, 4 vCPU, 8 GB RAM, không cache pnpm và Nx) chạy `corepack enable && pnpm install && pnpm nx run-many -t build lint typecheck test`, đo thời gian (≤ 15 phút), chạy `pnpm run check-port-headers` và `pnpm run check-package-names`; xác nhận mọi project đạt

**Checkpoint**: Mọi user story hoạt động; workspace dùng được bằng lệnh thống nhất.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Rà soát chéo, tài liệu, bảo mật và đóng feature.

- [ ] T106 [P] Viết `README.md` gốc (tiếng Việt, ngắn): yêu cầu (Node 22, pnpm 10), lệnh build/lint/test, cách chạy API cạnh Directus (`quickstart.md`), quy tắc port file (comment nguồn, `tools/port-manifest/`), quy tắc không sửa `directus/`
- [ ] T107 Rà bảo mật: Dockerfile của api và web (user không root, ghim phiên bản base image, không copy `.env`), `.dockerignore`, `pnpm audit`, gitleaks cục bộ, xác nhận log không chứa secret (FR-062) bằng test `logs.test.ts`
- [ ] T108 Chạy toàn bộ `quickstart.md` §1–§11 từ đầu trên máy sạch; ghi kết quả benchmark nền vào `specs/001-platform-foundation/research.md` R18; xác nhận SC-001 đến SC-008 từng mục
- [ ] T109 Xác nhận `git diff --stat directus/` rỗng (Nguyên tắc I); `pnpm run check-port-headers` đạt; không còn `STUB` trong `apps/api/src/metrics`
- [ ] T110 Chạy `/speckit.analyze` để kiểm tra spec, plan, tasks khớp nhau trước khi merge; cập nhật mục "Constitution Check" của `plan.md` nếu có thay đổi
- [ ] T111 Cập nhật đồ thị tri thức theo `CLAUDE.md`: chạy `graphify update .`; cập nhật mục Active Technologies của `CLAUDE.md` cho đúng thực tế
- [ ] T112 Trong PR merge vào `main`: đặt `Status: Done` ở đầu `specs/001-platform-foundation/spec.md` (kích hoạt kiểm tra hết hạn của khác biệt tạm thời, FR-101); tech lead duyệt các ngoại lệ ở Complexity Tracking của `plan.md`: FR-034/D-16 (Nguyên tắc VIII), quy mô benchmark (Nguyên tắc X), khóa job metrics trong process (Nguyên tắc VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: không phụ thuộc, bắt đầu ngay.
- **Foundational (Phase 2)**: cần Setup xong; CHẶN mọi user story. Trong phase này, khung `apps/api` (logger, bộ lọc lỗi, middleware, pipeline) cần các thư viện nền xong trước (constants, utils, types, errors, env).
- **US1 (Phase 3)**: cần Phase 2. Không phụ thuộc story khác. Cùng US3 tạo thành MVP.
- **US2 (Phase 4)**: cần Phase 2 và T022, T042, T043 của US1 (cùng một `app-pipeline.ts`); kiểm thử độc lập được bằng `parity()`.
- **US3 (Phase 5)**: cần T040, T044 của US1, T015 (Phase 2) và T058 của US2 (port `rate-limiter-global.ts`, chứa kiểm tra cấu hình dòng 6/6b của `contracts/startup.md`); kiểm tra khởi động chạy trước khi nghe cổng nên chỉnh `main.ts` của US1.
- **US4 (Phase 6)**: cần lõi `tests/parity` (Phase 2); hoàn thiện sau khi US1 đến US3 có test đối chiếu để có dữ liệu cho danh sách khác biệt.
- **US5 (Phase 7)**: cần T040, T041 (US1) và T059 (US2) vì metrics kiểm tra DB, Redis, storage; thay stub T021 của Phase 2.
- **US6 (Phase 8)**: cần `tests/parity` (Phase 2) và các project có test; job `docker` và `e2e` cần `apps/web/Dockerfile`, `apps/web-e2e` của US7 (T101, T104), nên làm T097 sau T104 hoặc để hai job đó tạm bỏ qua web.
- **US7 (Phase 9)**: phần khung workspace đã nằm ở Phase 1; phase này thêm app web, độc lập với US1 đến US6.
- **Polish**: sau khi các story cần thiết xong.

### Within Each User Story

- Test viết trước và FAIL trước khi cài đặt.
- Thư viện port trước service; service trước controller; controller trước tích hợp pipeline.
- Mỗi story kết thúc bằng task "Xác nhận" chạy test độc lập của story.

### Parallel Opportunities

- Phase 1: các task [P] (lint, git, vitest, công cụ port).
- Phase 2: các thư viện port là task riêng file (lưu ý T013 cần T009 và T010); khung API và lõi test đối chiếu chạy song song với nhau.
- Trong mỗi story: mọi task test [P] chạy song song; các task port thư viện [P] chạy song song.
- Sau Phase 2: test của US4 (T078–T080) và T083 làm song song với US1; T081, T082, T084, T085 làm sau US3. US2 và US3 cần chung `app-pipeline.ts`, `main.ts` nên làm tuần tự hoặc phối hợp.

---

## Parallel Example: User Story 1

```bash
# Các test của US1 chạy cùng lúc:
Task: T028  # libs/env/src/lib/directus-compat.test.ts: mã hóa bảng đã đo của con...
Task: T029  # apps/api/src/config/supported-variables.test.ts và warn-unsupported...
Task: T030  # apps/api/src/database/index.test.ts: cấu hình knex cho 6 client (pg...
Task: T031  # apps/api/src/redis/lib/create-redis.test.ts, use-redis.test.ts, u...
Task: T032  # apps/api/src/app-pipeline.test.ts (supertest, không cần DB): GET /s...
Task: T033  # apps/api/src/server.test.ts: SERVER_* gán vào http.Server, listen ...

# Sau khi test viết xong, cài đặt song song được:
Task: T041  # Port directus/api/src/redis/{index.ts,lib/create-redis.ts,lib/use-red...
Task: T040  # Port directus/api/src/database/index.ts sang apps/api/src/database/...
```

## Implementation Strategy

### MVP trước (User Story 1 + User Story 3)

1. Phase 1: Setup. 2. Phase 2: Foundational (BẮT BUỘC). 3. Phase 3: US1. 4. T058 (port `rate-limiter-global.ts`, chứa kiểm tra cấu hình dòng 6/6b) rồi Phase 5: US3.
5. **DỪNG và XÁC NHẬN**: API mới chạy bằng file env của Directus, ping đạt, DB không đổi, chạy với tài khoản chỉ đọc, dừng khi migration lệch.

### Giao theo từng bước

1. Setup + Foundational → nền xong.
2. US1 → xác nhận.
3. US2 → xác nhận: bốn endpoint giống Directus.
4. US3 → xác nhận: API từ chối schema lệch phiên bản → (MVP: US1 + US3; có thể giao trước US2 theo mục trên).
5. US4, US5, US6 (P2) theo thứ tự hoặc song song.
6. US7 (P3), rồi Polish.

### Ghi chú về phạm vi

- Các phần làm rút gọn tạm thời (accountability luôn public, `readSingleton` 3 câu SQL, quyền public bằng SQL trực tiếp, schema không cache) KHÔNG phải nợ ngầm: chúng nằm trong `plan.md` §"Phần port rút gọn tạm thời" và mỗi khác biệt nhìn thấy được có mã `D-xx` kèm "Gỡ khi".
- Rủi ro đã biết (Express 5, `OPTIONS`, thứ tự `X`/`X_FILE`, OAS chưa cache) có task kiểm thử riêng: T049, T028, T048.

## Bản đồ phủ yêu cầu (FR → task)

| Yêu cầu | Task |
|---------|------|
| FR-001, FR-002, FR-004 | T001, T002, T003, T008, T009–T015, T101, T105 |
| FR-003 | T102, T103, T104, T100, T101 |
| FR-010 đến FR-013, FR-016, FR-017 | T013, T028, T034, T023 |
| FR-014, FR-015 | T029, T039 |
| FR-020, FR-021, FR-023 | T030, T040, T031, T041, T029, T039 |
| FR-022, FR-024, FR-025 | T036, T037, T038, T030, T040, T041, T046, T050, T071 |
| FR-030, FR-032, FR-033 | T069, T076, T070, T074, T073, T071 |
| FR-031, FR-035, FR-036 | T067, T068, T072, T073, T071 |
| FR-034 | T069, T075, T071 |
| FR-040, FR-045, FR-047, FR-048 | T032, T042, T035, T049, T050, T064, T047, T051, T063 |
| FR-041, FR-042 | T046, T047, T051, T063, T064 |
| FR-043, FR-049 | T048, T052, T060, T061, T062, T056 |
| FR-044 | T053, T064, T020, T046, T047, T048, T087, T088 |
| FR-046 | T053, T058, T050, T065 |
| FR-050, FR-051 | T019, T032, T050 |
| FR-060, FR-061, FR-062 | T018, T086, T088 |
| FR-070, FR-071 | T087, T089, T090, T088 |
| FR-080, FR-081 | T033, T034, T043 |
| FR-090 | T018, T056, T101 |
| FR-100 đến FR-105 | T026, T027, T078, T079, T080, T081, T082, T083, T084 |
| FR-110, FR-112 | T097, T098, T096, T101, T104 |
| FR-111 | T092, T094 |
| FR-113 | T093, T095 |

## Notes

- [P] = khác file, không phụ thuộc.
- Nhãn [Story] gắn task với user story để truy vết.
- Mỗi story có thể hoàn tất và kiểm thử độc lập.
- Xác nhận test FAIL trước khi cài đặt.
- Commit sau mỗi task hoặc nhóm task hợp lý (Conventional Commits, tiếng Anh).
- Dừng ở bất kỳ Checkpoint nào để kiểm tra story độc lập.
- Tránh: task mơ hồ, xung đột cùng file, phụ thuộc chéo story làm mất tính độc lập.
