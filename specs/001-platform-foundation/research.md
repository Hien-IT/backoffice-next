# Research: Nền tảng workspace và kết nối hệ thống (001)

**Ngày**: 2026-10-08 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Mỗi mục ghi: quyết định, lý do, phương án đã cân nhắc. Đường dẫn `directus/...` là code tham chiếu
Directus 11.17.4 (chỉ đọc). Phiên bản thư viện lấy từ `directus/pnpm-workspace.yaml` (catalog) khi
thư viện đó ảnh hưởng tới hành vi dùng chung với Directus (định dạng key Redis, log, metric, SQL,
lỗi). Phiên bản công cụ build và test kiểm tra trên npm ngày 2026-10-08.

---

## R1. Runtime và trình quản lý package

- **Quyết định**: Node 22 LTS, pnpm 10.27.0. Ghi `"packageManager": "pnpm@10.27.0"` và
  `"engines": {"node": "22", "pnpm": ">=10 <11"}` ở `package.json` gốc, thêm `.nvmrc` = `22`.
- **Lý do**: Giống `directus/package.json` (Nguyên tắc VI). Máy dev hiện có Node 24 và pnpm 11, nên
  phải dùng Corepack (`corepack enable`) và nvm/fnm để chạy đúng phiên bản.
- **Đã cân nhắc**: Node 24 (bị loại vì Directus chạy Node 22, native module như `sqlite3`,
  `oracledb` cần build cùng ABI với môi trường chạy thật).

## R2. Monorepo

- **Quyết định**: Nx 23.3 với pnpm workspaces và TypeScript project references (kiểu workspace mặc
  định của Nx 23). Cấu trúc `apps/api`, `apps/web`, `libs/*`, `tests/*`. Mọi package nội bộ tên
  `@backoffice/<tên>` khai báo trong `package.json` của từng project.
- **Lý do**: Constitution VI chỉ định Nx. Kiểu pnpm workspaces cho phép mỗi lib có `package.json`
  riêng với dependency riêng, giống cách Directus tổ chức `packages/*`, nên port package nào sang lib
  nấy gần như giữ nguyên.
- **Đã cân nhắc**: Nx "integrated" với path alias trong `tsconfig.base.json` (bị loại: Nx 23 không
  còn khuyến nghị, khó tách dependency theo lib); Turborepo (bị loại: trái constitution).

## R3. Framework API và định dạng module

- **Quyết định**: NestJS 12.1 (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` 12.1.x),
  chạy ESM (`"type": "module"`). Biên dịch bằng SWC (`@swc/core` 1.16, executor `@nx/js:swc`) với
  `decoratorMetadata: true` để Nest DI đọc được kiểu tham số. Kiểm tra kiểu bằng `tsc --noEmit`
  với TypeScript 5.9.3. Chạy dev bằng executor `@nx/js:node`.
- **Lý do**:
  - Code `directus/api/src` là ESM, import có hậu tố `.js`, dùng `import.meta.url`. NestJS 12 (phát
    hành 2026-08-27) là ESM gốc (`"type": "module"` trong `@nestjs/core`), nên port gần như nguyên văn.
  - Nhiều dependency của Directus chỉ có ESM (`nanoid` 5, `lodash-es`, `camelcase` 8).
  - TypeScript 5.9.3 trùng Directus. TypeScript 7 (bản native) chưa chắc hỗ trợ đủ
    `emitDecoratorMetadata` mà Nest cần, và các plugin Nx/ESLint chưa ổn định với nó.
  - esbuild không sinh decorator metadata, nên không dùng esbuild cho `apps/api`.
- **Cờ TypeScript**: kế thừa đúng bộ cờ của `@directus/tsconfig` 4.0.0 (`strict`,
  `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `verbatimModuleSyntax`,
  `module`/`moduleResolution` `Node16`, `target` ES2022; đây là ví dụ, `tsconfig.base.json` copy đủ cờ
  của `configs/base` và `configs/node22`, gồm `isolatedDeclarations: true`), để code port không phải sửa kiểu. `apps/api`
  bật thêm `experimentalDecorators`, `emitDecoratorMetadata` và tắt `isolatedDeclarations` (giống
  `directus/api/tsconfig.json`). Lớp được inject PHẢI import dạng giá trị, không `import type`.
- **Đã cân nhắc**: NestJS 11 CommonJS (bị loại: phải `require()` các package ESM, khác cách viết của
  code gốc); Fastify adapter (bị loại: middleware Directus viết cho Express).

## R4. Express 5 (Nest 12) so với Express 4.21.2 (Directus)

- **Quyết định**: Dùng `@nestjs/platform-express` 12 (Express 5.2.1) và tự cấu hình để giữ hành vi
  HTTP giống Express 4.21.2:
  - Tắt body parser của Nest (`bodyParser: false`). Dùng `body-parser@1.20.3` (bản Express 4.21.2 đi
    kèm), bọc lỗi thành `InvalidPayloadError({ reason: err.message })` như `directus/api/src/app.ts`.
  - `app.set('query parser', ...)` bằng `qs@6.14.2` với `QUERYSTRING_MAX_PARSE_DEPTH`,
    `QUERYSTRING_ARRAY_LIMIT`.
  - `app.disable('x-powered-by')`, `app.set('trust proxy', env.IP_TRUST_PROXY)`.
  - ETag: Express 5 vẫn dùng `etag` dạng weak như Express 4.
- **Lý do**: NestJS 12 chỉ hỗ trợ Express 5. Những chỗ Express 5 khác Express 4 có ảnh hưởng tới
  response (body parser, query parser, header mặc định) đều cấu hình lại được. Test đối chiếu so
  status, header, body nên bắt được khác biệt còn sót.
- **Hành vi router đã đo trên Directus** (FR-048) và cách giữ lại: đường dẫn không phân biệt hoa thường
  và bỏ qua `/` cuối (mặc định của cả Express 4 và 5); `HEAD` và `304` do Express tự xử lý; phương thức
  khác `GET` rơi xuống handler 404. Riêng `OPTIONS`: Directus gắn `/server/*` và `/metrics` vào
  `Router` con nên Express tự trả `200 Allow: GET,HEAD` (body `GET,HEAD`), còn `/server/ping`, `/`,
  `/robots.txt` gắn thẳng vào app nên rơi xuống 404. Nest gắn route thẳng vào app, nên `OPTIONS` tới
  `/server/info` sẽ thành 404, lệch Directus. Cách xử lý: một middleware `routerOptions` đăng ký trước
  route Nest, với đúng các path của router (`/server/info`, `/server/health`, `/server/specs/oas` khi
  `OPENAPI_ENABLED`, `/metrics` khi `METRICS_ENABLED`; KHÔNG gồm `/server/setup`, `/server/specs/graphql`
  của router Directus vì hai route này ngoài phạm vi, `OPTIONS` tới chúng là khác biệt D-14, D-15), trả
  `Allow: GET,HEAD` và body `GET,HEAD` như
  `sendOptionsResponse` của Express. Test `methods.test.ts` kiểm cả hai nhóm.
- **Ghi chú cho feature sau**: Express 5 dùng `cookie` và `send` bản mới. Feature 003 (cookie) và 007
  (asset) PHẢI có test đối chiếu header `Set-Cookie`, `Content-Range`, `Content-Disposition`.
- **Đã cân nhắc**: Truyền một instance Express 4 vào `ExpressAdapter` (bị loại: Nest 12 sinh route
  theo cú pháp path-to-regexp 8, Express 4 không hiểu).

## R5. Đường đi của request và thứ tự middleware

- **Quyết định**: Giữ đúng thứ tự trong `directus/api/src/app.ts`. Middleware cấp Express đăng ký
  trong `main.ts` trước khi Nest gắn route:
  1. pressure limiter (`PRESSURE_LIMITER_*`, port `@directus/pressure`)
  2. helmet CSP (`CONTENT_SECURITY_POLICY_*`), COOP (`CROSS_ORIGIN_OPENER_POLICY*`), HSTS (`HSTS_*`)
  3. logger HTTP (pino-http)
  4. `X-Powered-By: Backoffice`
  5. CORS (`CORS_*`)
  6. JSON body (`MAX_PAYLOAD_SIZE`), `cookie-parser`, `extractToken`
  7. `GET /` (`ROOT_REDIRECT`), `GET /robots.txt` (`ROBOTS_TXT`)
  8. rate limiter toàn cục, rồi rate limiter theo IP
  9. `GET /server/ping` (route Express thuần, trước bước xác thực)
  10. accountability public (thay `authenticate` ở feature này, xem R16)
  11. route Nest: `/server/info`, `/server/health`, `/server/specs/oas`, `/metrics`
  12. 404 và xử lý lỗi (R14): 404 do Nest sinh sau route của nó; KHÔNG gắn handler 404 vào Express
      trước `NestFactory.create`
- **Không port ở feature này**: `authenticate` thật (003), `schema` middleware chạy mọi request
  (002), `sanitizeQuery` (005), `cache` và phần ghi cache của `respond` (005), `requestCounter`
  (telemetry, Nguyên tắc XI), route extension, WebSocket, AI, MCP, deployment webhook.
- **Lý do**: Thứ tự quyết định lỗi nào trả trước (ví dụ rate limit trước 404, pressure trước tất cả),
  nên phải giống Directus.

## R6. Đọc cấu hình

- **Quyết định**: Port toàn bộ `directus/packages/env` thành `libs/env` (`@backoffice/env`), gồm cả
  test. Giữ API `useEnv()`, `createEnv()`, `cast()`, và `getConfigFromEnv` (port từ
  `directus/api/src/utils/get-config-from-env.ts`, đặt ở `apps/api/src/utils/` như Directus). Phụ thuộc
  `dotenv@17.2.3`, `js-yaml@4.3.2` (Directus 4.1.1; bản vá bảo mật T107), `lodash-es@4.18.1`, `camelcase@8.0.0`.
- **Danh sách biến đã hỗ trợ** (FR-014): nguồn sự thật là `contracts/config.md` §5 (nhóm A hỗ trợ,
  nhóm B không áp dụng cho API, nhóm C chưa hỗ trợ). `apps/api/src/config/supported-variables.ts`
  chứa nhóm A và B dưới dạng regex và phải trùng bảng đó (có unit test). Khi khởi động, lấy các key
  trong cấu hình thô (process + file `CONFIG_PATH`; key `X_FILE` tính theo `X`; không tính giá trị
  mặc định) mà `isDirectusVariable(key)` đúng nhưng không thuộc nhóm A hoặc B, ghi một dòng `warn`
  liệt kê tên A–Z (không ghi giá trị). Riêng `SERVE_APP`: không vào dòng cảnh báo trên; cảnh báo ở
  dòng riêng khi có mặt trong cấu hình thô và giá trị sau ép kiểu bằng `true`. Mỗi feature sau chuyển biến từ C sang A trong cùng PR.
- **Hành vi đã đo trên image Directus 11.17.4** (thứ tự `X`/`X_FILE`, ép kiểu không hợp lệ, lỗi file
  cấu hình, đường dẫn tương đối): ghi ở `contracts/config.md` §1–§4 và mã hóa thành
  `libs/env/src/lib/directus-compat.test.ts`. Phát hiện quan trọng: khi cùng đặt `X` và `X_FILE`, key
  xuất hiện sau thắng (không phải "file luôn thắng"), nên thứ tự duyệt key của `createEnv` phải được
  giữ nguyên khi port.
- **Lý do**: Hành vi đọc biến (thứ tự ưu tiên file > process, `_FILE`, ép kiểu, đoán kiểu, `TYPE_MAP`)
  phải giống hệt Directus. Copy nguyên package kèm test là cách chắc chắn nhất.
- **Biến `BACKOFFICE_`**: feature này không cần biến mới nào.

## R7. Kết nối DB

- **Quyết định**: Port `getDatabase()`, `getDatabaseClient()`, `hasDatabaseConnection()`,
  `validateDatabaseConnection()`, `validateDatabaseCharset()` (gọi không `await` ngay khi tạo knex, như
  Directus), `isInstalled()`,
  `validateDatabaseExtensions()` từ `directus/api/src/database/index.ts`, cùng `validateEnv`,
  `GeometryHelper.supported()` (chỉ phần kiểm tra PostGIS/Spatialite). Dùng `knex@3.1.0` và driver
  đúng bản Directus: `pg@8.16.3` (Postgres, CockroachDB), `mysql2@3.22.6` (Directus 3.15.3; bản vá bảo mật T107), `sqlite3@5.1.7`,
  `tedious@18.6.1`, `oracledb@6.10.0` (chế độ thin, không cần Oracle Instant Client).
- Giữ nguyên các xử lý theo DB: SQLite `PRAGMA foreign_keys = ON`; CockroachDB
  `serial_normalization`, `default_int_size`; Oracle `NLS_*_FORMAT`; MySQL đổi client sang `mysql2`
  và bỏ `filename`; MSSQL `useUTC: false`; biến bắt buộc theo từng client; histogram thời gian truy
  vấn cho metrics.
- `isInstalled()` dùng `hasTable('directus_collections')` của schema inspector (R16).
- **Lý do**: SQL và cấu hình kết nối giống hệt nên hai app thấy cùng dữ liệu, cùng múi giờ, cùng
  định dạng ngày.

## R8. Kiểm tra migration khi khởi động

- **Quyết định**:
  - Danh sách chuẩn là một mảng tĩnh 101 version (`20201028A` … `20260211A`) trong
    `apps/api/src/database/migrations/directus-11.17.4.ts`. Một unit test đọc thư mục
    `directus/api/src/database/migrations`, lọc file theo đúng regex của `run.ts`
    (`/^[0-9]+[A-Z]-[^.]+\.(?:js|ts)$/`), cắt phần trước dấu `-`, và so với mảng. Test fail nếu lệch.
  - Version tùy biến: đọc tên file ở hai nơi. (1) `MIGRATIONS_PATH` (mặc định `./migrations`), nơi
    `database/migrations/run.ts` của Directus tìm migration tùy biến để chạy, lọc `name.includes('-')`
    và `/\.(c|m)?js$/`. (2) `<getExtensionsPath()>/migrations`, nơi `validateMigrations` của Directus
    tìm, lọc `.js`. Cắt phần trước dấu `-` đầu tiên (`split('-')[0]`; file ở nơi (2) không có `-` thì
    version là cả tên file, như Directus). Chỉ đọc tên, không `import`. (Phát hiện khi rà
    checklist: Directus có hai nơi khác nhau; chỉ đọc nơi thứ hai như bản nháp đầu sẽ coi migration
    tùy biến đã chạy là "thừa".)
  - So sánh: `missing = chuẩn ∪ tùy biến − DB`, `extra = DB − (chuẩn ∪ tùy biến)`. Có phần tử nào thì
    log `error` liệt kê theo thứ tự tăng dần, rồi `process.exit(1)`. Có version tùy biến thì log
    `warn` (FR-035). Không thử lại, không chờ (FR-036): lệch thì thoát mã 1 và log kèm gợi ý "nếu
    Directus đang migrate thì khởi động lại sau".
- **Đã kiểm tra**: DB tham chiếu (`dev/directus-reference`, Postgres 16, ngoài danh sách cam kết; số
  dòng do danh sách migration quyết định, không phụ thuộc phiên bản Postgres, T068 kiểm lại bằng thư mục
  migration) có đúng 101 dòng, từ `20201028A` tới `20260211A`. Spec ghi "103" là nhầm (103 là số file, gồm `run.ts` và `run.test.ts`) và đã được sửa.
- **Lý do**: Danh sách tĩnh không phụ thuộc việc đóng gói thư mục `directus/` vào image. Test chống
  lệch giữ danh sách đúng khi nâng phiên bản Directus.

## R9. Redis, cache, rate limiter

- **Quyết định**:
  - `ioredis@5.8.2`. Port `createRedis`, `useRedis`, `redisConfigAvailable` từ
    `directus/api/src/redis`.
  - Cache: `keyv@5.5.3` và `@keyv/redis@3.0.1`, namespace `CACHE_NAMESPACE`, port phần `getCache()`
    của `directus/api/src/cache.ts` cần cho health check và metrics. Bus và cache schema để
    feature 002. Không dựng cache hệ thống, lock cache nên không có log `[system-cache]`,
    `[deployment-cache]`, `[lock-cache]` (D-20).
  - Rate limiter: `rate-limiter-flexible@7.2.0`, port `directus/api/src/rate-limiter.ts` và hai
    middleware `rate-limiter-ip.ts`, `rate-limiter-global.ts` (gồm kiểm tra cấu hình global phải lớn
    hơn IP). Cùng `keyPrefix` mặc định, nên key Redis trùng với Directus (`rlflx:<ip>`,
    `rlflx:global-rate-limit`) và hai app đếm chung.
  - Cảnh báo FR-023: khi `redisConfigAvailable()` sai; hoặc `CACHE_STORE` là `memory` (giá trị hiệu lực, kể cả
    mặc định, không phụ thuộc `CACHE_ENABLED`); hoặc `RATE_LIMITER_STORE` là `memory` khi bật rate limiter IP
    hoặc toàn cục.
- **Lý do**: Dùng đúng thư viện và đúng bản của Directus là điều kiện để key và giá trị trong Redis
  giống nhau (Nguyên tắc IV).

## R10. Storage cho health check

- **Quyết định**: Port nguyên `directus/packages/storage`, `storage-driver-local`,
  `storage-driver-s3` thành `libs/storage`, `libs/storage-driver-local`, `libs/storage-driver-s3`
  (kèm test), cùng bản AWS SDK (`@aws-sdk/client-s3@3.928.0`, `@aws-sdk/lib-storage@3.928.0`,
  `@smithy/node-http-handler@4.4.5`, `@shopify/semaphore@3.1.0`, `@tus/utils@0.6.0`). Port
  `getStorage()`, `registerDrivers`, `registerLocations`, `validateStorage()`.
- Kiểm tra FR-034 trước khi tạo storage: với mỗi location trong `STORAGE_LOCATIONS`, nếu
  `STORAGE_<LOCATION>_DRIVER` không phải `local` hoặc `s3` thì log `error` và `process.exit(1)`.
- **Lý do**: Health check của Directus ghi file `directus-health-file` vào từng location; metrics ghi
  `directus-metric-file`. Driver là package độc lập, port nguyên vẹn rẻ hơn viết lại và dùng tiếp
  cho feature 007.

## R11. Health check

- **Quyết định**: Port `ServerService.health()` nguyên logic: DB (response time, pool), cache (khi
  `CACHE_ENABLED`), rate limiter và rate limiter toàn cục (khi bật), từng storage location, cùng
  ngưỡng mặc định (150 ms, storage 750 ms), cùng key tạm `directus-health-<nanoid(5)>`. Thành phần
  `email:connection` luôn `{status: "ok", componentType: "email"}`, không tạo mail transport (khác biệt
  đã ghi trong spec). `SERVER_ONLINE` lấy từ trạng thái tắt máy (R15). Request không phải admin chỉ
  nhận `{status}`. Header `Content-Type: application/health+json`, `503` khi `error`,
  `Cache-Control: no-cache`, `Vary: Origin, Cache-Control`.
- **Lý do**: Spec FR-041.

## R12. Log

- **Quyết định**: Port `directus/api/src/logger/index.ts` (bỏ nhánh WebSocket logs): `pino@9.7.0`,
  `pino-http@10.5.0`, `pino-http-print@3.1.0`, `pino-pretty@13.1.2`, cùng redact
  (`req.headers.authorization`, `req.headers.cookie`; khi `LOG_STYLE=raw` thêm `req.query.access_token`,
  `res.headers['set-cookie']`; `access_token` trong URL), `LOGGER_*`, `LOGGER_HTTP_*`, `LOG_LEVEL`,
  `LOG_STYLE`, `LOG_HTTP_IGNORE_PATHS`. Request id là `req.id` mặc định của pino-http (số tăng dần
  trong process), đúng quyết định Q5.
- Logger nội bộ của Nest: truyền một `LoggerService` bọc pino, chỉ chuyển `warn`, `error`, `fatal`;
  bỏ `log`, `debug`, `verbose` (nên không có dòng "Mapped {...} route"). Lý do: Directus không in các
  dòng này, log phải giống.
- Message có chữ "Directus" đổi thành "Backoffice", trừ câu nói về bảng `directus_*` hoặc về chính
  Directus (spec, bảng khác biệt).

## R13. Metrics

- **Quyết định**: Port `directus/api/src/metrics` và `schedules/metrics.ts` với `prom-client@15.1.3`
  và `cron@4.3.4`: cùng tên metric (`<prefix>db_<client>_connection_errors`,
  `<prefix>db_<client>_response_time_ms` với cùng bucket, `<prefix>cache_<store>_connection_errors`,
  `<prefix>redis_connection_errors`, `<prefix>storage_<location>_connection_errors`), cùng help text,
  cùng `METRICS_SCHEDULE`, `METRICS_SERVICES`, `METRICS_HEALTH_CHECK_PREFIX`. `/metrics` nhận
  `Authorization: Metrics <token>` theo `METRICS_TOKENS`, trả `text/plain`, `Cache-Control: no-cache`,
  `Vary: Origin, Cache-Control`.
- Bỏ nhánh PM2 (`AggregatorRegistry`, `pm2.sendDataToProcessId`): mỗi container API chạy một process
  Node, Prometheus scrape từng container. Khác biệt D-19.
- **Đã cân nhắc**: `collectDefaultMetrics()` của prom-client (bị loại: Directus không bật, thêm vào sẽ
  khác tên metric).

## R14. Lỗi

- **Quyết định**:
  - Port `directus/packages/errors` thành `libs/errors` (`@backoffice/errors`), kèm test. Mã lỗi,
    message, HTTP status giữ nguyên. Đổi tên lớp và hàm theo Nguyên tắc IX: `DirectusError` →
    `BackofficeError`, `isDirectusError` → `isBackofficeError`. Thuộc tính `name` của lỗi là
    `BackofficeError` (chỉ xuất hiện trong log).
  - Port `middleware/error-handler.ts` thành một `ExceptionFilter` toàn cục của Nest: cùng logic gộp
    nhiều lỗi, cùng status dự phòng 500, ẩn lỗi lạ với người không phải admin, thêm `stack` khi
    `NODE_ENV=development`, header `Allow` cho `METHOD_NOT_ALLOWED`.
  - Route không khớp: Nest ném `NotFoundException` từ handler 404 nội bộ. Filter đổi nó thành
    `RouteNotFoundError({ path: req.path })` → `404`, `Route <path> doesn't exist.`. Không có handler
    404 riêng trong `app-pipeline.ts`: middleware Express gắn trước route Nest nên sẽ chặn mọi route.
  - Lỗi từ middleware Express (body parser, rate limiter, pressure, `extractToken`) đi qua handler
    lỗi mà Nest gắn vào Express, nên cũng tới filter này.
  - Hook `request.error` và `request.not_found` của Directus chưa có (emitter thuộc feature 009).
    Điểm gọi được để sẵn trong filter.
- **Lý do**: Spec FR-050, FR-051.

## R15. Vòng đời server

- **Quyết định**: Tạo instance Express, gắn middleware theo R5, rồi tạo app bằng
  `NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false, logger: <LoggerService
  bọc pino, R12> })`, gán `getConfigFromEnv('SERVER_')` vào `http.Server`
  (`keepAliveTimeout`, `headersTimeout`, `requestTimeout`...), lắng nghe theo `HOST`/`PORT` hoặc
  `UNIX_SOCKET_PATH`, log `Server started at http://<address>`. Tắt máy dùng
  `@godaddy/terminus@4.12.1` như `directus/api/src/server.ts`: tín hiệu `SIGINT`, `SIGTERM`, `SIGHUP`,
  `timeout` = `SERVER_SHUTDOWN_TIMEOUT`, `beforeShutdown` đặt `SERVER_ONLINE = false`, `onSignal` gọi
  `knex.destroy()` như Directus và thêm (Nguyên tắc VII, Directus không làm) dừng job metrics, đóng các
  kết nối Redis, `onShutdown` log
  `Backoffice shut down OK. Bye bye!`.
- **Ngữ nghĩa đã xác minh từ mã nguồn terminus 4.12.1 và stoppable 1.1.0** (FR-080): trình tự là
  `beforeShutdown` → `server.stop()` → `onSignal` → `onShutdown`. `server.stop()` đóng listener và đóng
  kết nối rảnh; sau `timeout` ms các kết nối còn lại bị `end()` rồi `destroy()` (request dở bị cắt). Cuối
  cùng terminus gỡ handler và gửi lại chính tín hiệu (`process.kill(pid, signal)`), nên process kết thúc
  bằng tín hiệu (143 với SIGTERM), không phải mã 0; lỗi trong lúc tắt thì thoát mã 1, không log (Directus không truyền
  `logger` cho terminus, giữ như vậy). Cổng bị chiếm:
  log `Port <port> is already in use` rồi thoát mã 1 (`server.ts`).
- Không dùng `app.enableShutdownHooks()` của Nest để không có hai bộ xử lý tín hiệu.
- **Lý do**: FR-080, FR-081, Nguyên tắc VII.

## R16. `/server/info`, `/server/specs/oas` và các phần đọc dữ liệu hệ thống

Khảo sát `directus/api/src/services/server.ts`, `services/specifications.ts`, `services/items.ts`,
`utils/get-schema.ts`, `permissions/*` cho request public. Kết quả và quyết định:

**R16.1 Accountability của request public.** Directus không để `null`, mà tạo
`{role: null, user: null, roles: [], admin: false, app: false, ip}` (`permissions/utils/create-default-accountability.ts`),
thêm `userAgent` (cắt 1024 ký tự) và `origin` nếu có header (`middleware/authenticate.ts:20-26`).
- **Quyết định**: middleware `publicAccountability` tạo đúng object này cho mọi request (token bị bỏ
  qua theo Q1). Feature 003 thay bằng `authenticate` thật.

**R16.2 `/server/info`.** Directus gọi `SettingsService.readSingleton` (không accountability) qua bộ
máy AST của ItemsService (khoảng 3.000 dòng, thuộc feature 005). SQL thực chạy:
1. `select * from directus_users limit 1` (`isSetupCompleted`).
2. `select <16 field>, public_background, id from directus_settings order by id asc limit 1`.
3. `select id, type from directus_files where id in (?)` khi `public_background` khác null; không tìm
   thấy file thì giữ `null`.

Chuyển đổi theo `special` của `directus/packages/system-data/src/fields/settings.yaml`:
`public_registration`, `public_registration_verify_email` là `cast-boolean` (MySQL, SQLite, Oracle trả
0/1); `theme_light_overrides`, `theme_dark_overrides` là `cast-json` (SQLite, MSSQL, MariaDB, Oracle trả
chuỗi; parse bằng `parseJSON` bỏ key `__proto__`, JSON lỗi thì giữ chuỗi). Thứ tự key: 16 field thường
theo thứ tự yêu cầu, rồi `public_background`.
- **Quyết định**: `SettingsService.readSingleton` ở feature này là bản port rút gọn chạy đúng 3 câu SQL
  trên bằng knex, cùng hai phép chuyển đổi và thứ tự key. Không port bộ máy AST. Feature 005 thay bằng
  `ItemsService` thật; test đối chiếu `/server/info` giữ nguyên để bắt lệch.
- Trường hợp không có dòng settings (chỉ xảy ra khi bị xóa tay vì migration `20250613A` luôn tạo một
  dòng): port nhánh mặc định của `items.ts:1208-1227` (chỉ field có default khác null, theo thứ tự cột
  của schema inspector, không có `public_background`), dùng SchemaOverview ở R16.3.
- `version` = `11.17.4` khi chưa có user (`DIRECTUS_COMPAT_VERSION` trong `apps/api/src/constants.ts`).

**R16.3 SchemaOverview cho OpenAPI.** `generate()` cần toàn bộ schema (collections, fields, relations).
- **Quyết định**: Port ở feature này phần dựng schema, KHÔNG có cache:
  - `directus/packages/schema` → `libs/schema` (inspector cho 6 loại DB, nguyên vẹn kèm test).
  - `directus/packages/system-data` → `libs/system-data` (YAML định nghĩa collection, field, relation
    hệ thống). File YAML copy vào thư mục build và đọc bằng `js-yaml` một lần khi nạp module (Directus
    nhúng YAML bằng `unplugin-yaml` khi bundle; đọc lúc chạy cho kết quả như nhau và không cần bundler).
  - `getDatabaseSchema()` của `utils/get-schema.ts:116-234`, cùng `getLocalType`, `getDefaultValue`,
    `getSystemFieldRowsWithAuthProviders`.
  - Đọc relations: `select * from directus_relations` (chuyển `one_allowed_collections` theo
    `cast-csv`) + `systemRelationRows` + `inspector.foreignKeys()` + `stitchRelations` của
    `services/relations.ts`.
  - Mỗi lần gọi `/server/specs/oas` dựng schema mới. Cache trong process, khóa Redis
    `schemaCache--preparing` và bus `schemaChanged` thuộc feature 002. `/server/health` không cần schema nên
    không dựng; `/server/info` chỉ dựng khi không có dòng settings (R16.2).
- **Lý do**: Đây là phần đọc thuần, feature 002 dùng lại nguyên vẹn và chỉ thêm cache. Phần này kéo
  vào 001 vì quyết định Q1 (OAS cho public).

**R16.4 Quyền public cho OpenAPI.** `generate()` với người không phải admin gọi
`fetchAllowedFieldMap`, `reduceSchema`, `fetchPolicies`, `fetchPermissions`. Các hàm này đọc
`directus_access`, `directus_policies`, `directus_permissions` qua `AccessService` và
`PermissionsService` (lại là ItemsService).
- **Quyết định**:
  - Port nguyên `reduceSchema`, `fetchAllowedFieldMap`, phần lọc theo IP của `fetchPolicies`
    (`filter-policies-by-ip.ts`, `ipInNetworks`) và thứ tự sắp xếp policy.
  - Phần đọc DB thay bằng knex chạy cùng SQL như Directus:
    `select role, policy, id from directus_access where role is null and "user" is null order by sort`;
    `select id, ip_access from directus_policies where id in (...)` (`ip_access` theo `cast-csv`);
    `select * from directus_permissions where policy in (...) [and action = 'read'] order by id`
    (`fields` theo `cast-csv`; `permissions`, `validation`, `presets` theo `cast-json`).
  - Không cache quyền ở feature này (Directus cache bằng `withCache`, namespace `permissions`).
  - Feature 004 thay bằng module permissions đầy đủ.
- **Lý do**: Kết quả OAS chỉ dùng `collection`, `action`, `fields` của permission. Port cả
  `AccessService`/`PermissionsService` sẽ kéo theo bộ máy AST.

**R16.5 Sinh tài liệu OpenAPI.**
- **Quyết định**: Port nguyên `SpecificationService.oas` (`specifications.ts:69-635`), giữ mọi điểm
  lạ của code gốc: tạo `paths[path] = {}` trước khi kiểm tra quyền, `mergeWith` nối mảng, `replace`
  chỉ thay chữ `item` đầu tiên, khóa component giữ vị trí. Dùng đúng `lodash-es` (`cloneDeep`,
  `mergeWith`), `object-hash@3.0.0`, port `@directus/format-title` thành `libs/format-title`, cùng
  `getRelation`/`getRelationType` trong `@backoffice/utils`, `OAS_REQUIRED_SCHEMAS = ['Query', 'x-metadata']`.
- `servers[0].url`: `PUBLIC_URL`, riêng khi `PUBLIC_URL === '/'` thì là header Host.
- Spec tĩnh: copy `directus/packages/specs/src` sang `libs/specs/src`, đổi chữ `Directus` (viết hoa,
  đứng riêng) trong `title`, `summary`, `description` thành `Backoffice`, không đụng `directus_*` hay
  `@directus/sdk`. Build bằng `swagger-cli@4.0.4 bundle` ra `dist/openapi.json` như Directus. Job đối
  chiếu trên CI so file này với `node_modules/@directus/specs/dist/openapi.json` trong image
  `directus/directus:11.17.4` sau khi áp cùng phép thay chữ.
- **Không xác định trước được**: `info.version` = `object-hash({now, user})` đổi theo từng request; thứ tự
  collection theo câu truy vấn của inspector (không có ORDER BY). Bộ so sánh của test đối chiếu bỏ
  qua `info.version` và ETag của `/server/specs/oas`, so object không phụ thuộc thứ tự key, và sắp
  xếp mảng `tags` theo `name` trước khi so. Đây là bước chuẩn hóa, không phải khác biệt hành vi.
- Đã kiểm chứng trên DB tham chiếu (Postgres 16; kết quả do metadata schema quyết định, test đối chiếu
  T048 chạy lại trên Postgres 13): OAS public dài 12.661 byte, tags `Assets`, `Authentication`,
  `Server`, 10 path, schemas `Query`, `x-metadata`, có 2 chỗ chữ "Directus" (mô tả server và mô tả tag
  `Server`).

**R16.6 Các bước Directus làm ở mọi request mà API mới bỏ qua.** Directus chạy `authenticate`, `schema`,
`sanitizeQuery` cho mọi route sau `/server/ping` (gồm `/metrics`, path lạ, `/admin`). API mới không port ba
middleware này (R5) nên có khác biệt nhìn thấy được trên các route đó: token sai (D-10), query sai (D-12),
DB mất kết nối khi `CACHE_SCHEMA=false` (D-13). Test: T050, T088.

## R17. Bộ test đối chiếu

- **Quyết định**: Dựng project Nx `tests/parity` (`@backoffice/parity-tests`) bằng Vitest 3.2.4,
  KHÔNG chạy nguyên bộ `directus/tests/blackbox`. Tái sử dụng có chọn lọc (copy, ghi nguồn ở đầu file):
  - `common/get-dbs-to-test.ts` (chọn vendor qua `TEST_DB`), cấu hình vendor trong
    `common/config.ts`, `utils/await-connection.ts`.
  - Image DB trong `tests/blackbox/docker-compose.yml`.
  - Test `/server/ping`, `/server/health` trong `tests/db/routes/server/*.test.ts`, chuyển sang hàm
    `parity()`.
- **Cách chạy**: target `parity-tests:parity` (cần Docker); target `parity-tests:test` chỉ chạy unit
  test của bộ so sánh. Mỗi vendor có một file env (`tests/parity/env/<vendor>.env`). Docker Compose chạy DB,
  Redis, MinIO, Directus 11.17.4 (image chính thức `directus/directus:11.17.4`, tự bootstrap DB) và
  API mới (image build từ repo), cả hai đọc **cùng file env đó** (chứng minh SC-001). API mới chỉ
  khởi động sau khi Directus healthy. Mỗi profile (`ratelimit`, `cors-hsts`, `pressure`, `metrics`) thêm
  một cặp Directus + API mới riêng (cổng riêng, cùng DB và Redis, `CACHE_NAMESPACE` riêng); cặp chính
  không đổi env, nên bật nhiều profile cùng lúc an toàn.
- **Hàm `parity(req)`**: gửi cùng request (cùng header Host) tới `DIRECTUS_URL` và `BACKOFFICE_URL`, so
  status, tập header FR-104 và body theo FR-103. Trước khi so, áp các bộ chuẩn hóa FR-105 (loại
  `info.version` và `ETag` của OAS, sắp `tags` và `paths` theo tên, chỉ so định dạng `Retry-After`) và
  danh sách khác biệt được chấp nhận.
- **Danh sách khác biệt được chấp nhận**: `tests/parity/accepted-differences.ts` (kiểu ở data-model
  §3.1). Mỗi dòng có `id` (cột "Mã" của bảng "Khác biệt so với Directus", ví dụ `D-01`, `D-09.3`),
  `feature` (spec đã thêm mục, ví dụ `001`), `kind` (`http`: khác biệt trong response; `doc`: log,
  package, migration, khởi động, bộ so sánh bỏ qua), với `http` thêm `endpoints`, vị trí (`status`, tên
  header, hoặc JSON pointer; `''` là cả body) và giá trị mong đợi ở hai bên, cùng `reason` và `removeAt`
  (số feature, chỉ với khác biệt tạm thời). `accepted-differences.test.ts` đọc bảng trong `spec.md` của
  feature ghi ở `feature` và fail khi: một `id` không có trong bảng đó; `removeAt` không khớp cột "Gỡ
  khi"; hoặc spec của feature `removeAt` đã có `Status: Done` mà mục vẫn còn.
- **Snapshot DB** (SC-003): hàm chụp danh sách mọi bảng (không chỉ `directus_*`), cột (qua schema
  inspector), định nghĩa index (cột, unique), khóa ngoại và checksum dữ liệu từng bảng (SELECT có ORDER
  BY khóa chính, bảng không có khóa chính thì ORDER BY mọi cột; băm SHA-256). Không
  chụp trạng thái phiên kết nối. Kịch bản kiểm tra riêng: dừng
  mọi container Directus (kể cả của profile), chụp, khởi động API mới, gửi toàn bộ request, gửi SIGTERM, chụp lại, so sánh. Như vậy chỉ
  API mới tác động lên DB trong khoảng đo.
- **Rút gọn và đầy đủ**: biến `PARITY_SUITE=full|reduced` (FR-102). `full` chạy mọi `*.test.ts` của target `parity`.
  `reduced` chỉ chạy `server/{ping,health,info,errors,methods,conditional}.test.ts`; trong các file đó, ca cần dừng
  container hoặc profile riêng (`ratelimit`, `cors-hsts`, `pressure`, `metrics`) chỉ chạy ở `full`. `redis-down.test.ts`
  (dừng Redis, API vẫn khởi động, FR-025) và `readonly-account.test.ts` (role chỉ SELECT trên Postgres, FR-024) thuộc `full`.
- **Kịch bản khởi động** (US3, FR-034, FR-036): chạy file build của API trên DB tạm (Postgres: sau khi
  Directus bootstrap, tạo một lần DB mẫu `directus_template` bằng `pg_dump | psql`, không có kết nối nào,
  rồi `CREATE DATABASE <tạm> TEMPLATE directus_template`, vì Postgres từ chối TEMPLATE khi DB nguồn còn
  kết nối; SQLite: copy file), sửa `directus_migrations` của DB tạm (đây là
  test ghi, không phải API ghi), kiểm tra mã thoát và log. Gồm cả migration tùy biến ở `MIGRATIONS_PATH`
  và `EXTENSIONS_PATH/migrations`, cổng bị chiếm, file cấu hình lỗi, ba instance khởi động cùng lúc.
  Việc ghi `CREATE DATABASE`, sửa `directus_migrations` do test, không do API.
- **Lý do không chạy nguyên blackbox**: bộ blackbox tự khởi động process Directus từ `dist/`, dùng API
  nội bộ của Vitest 1.6.1, xếp thứ tự file qua `/items/tests_flow_*` và seed dữ liệu qua REST (cần
  `/items`, `/auth` mà API mới chưa có). Từ feature 003, 005 trở đi sẽ copy thêm test blackbox theo
  từng endpoint và chuyển sang `parity()`.

## R18. Benchmark

- **Quyết định**: `tests/benchmark` dùng `autocannon@8.0.0` (cùng bản blackbox) qua API lập trình. Với
  mỗi endpoint: khởi động nóng 5 s, rồi 3 vòng luân phiên Directus và API mới, mỗi vòng 20 s,
  50 kết nối. p95 tính từ sự kiện `response` của autocannon (thời gian từng request) bằng
  `hdr-histogram-js` (autocannon chỉ có sẵn p90, p97.5, p99). Lấy trung vị 3 vòng; fail khi p95 của
  API mới lớn hơn Directus quá 10% hoặc số request/giây nhỏ hơn quá 10%.
- **Phạm vi ở feature này**: `/server/ping`, `/server/health`, `/server/info` so với Directus cấu hình
  mặc định. `/server/specs/oas` so với một container Directus thứ hai chạy `CACHE_SCHEMA=false`
  (`directus-nocache` trong `tests/benchmark/docker-compose.yml`), vì API mới dựng schema mỗi request
  (FR-049, SC-006). Từ feature 002 chuyển sang so với Directus mặc định.
- **Giảm nhiễu trên CI**: hai app chạy trên cùng runner, cùng DB và Redis, đo luân phiên; số vòng và
  thời gian chỉnh bằng `BENCH_ROUNDS`, `BENCH_DURATION`. Target `benchmark:env-up` dựng môi trường
  (Compose `include` môi trường đối chiếu Postgres và thêm `directus-nocache`); `benchmark:run` không tự
  dựng.
- **Container tham chiếu `directus-nocache`**: `CACHE_SCHEMA=false` và `CACHE_ENABLED=false`. Chỉ tắt
  `CACHE_SCHEMA` thì Directus vẫn dựng schema mỗi request (middleware `schema` chạy trước `cache`) nhưng trả OAS
  từ cache response (D-11), bỏ qua bước sinh OAS mà API mới làm mỗi request; phép so khi đó không cùng việc
  (đo T108: Directus 150 req/s khi có cache response, 118 req/s khi tắt).
- **Kết quả nền (T108, 2026-10-09, máy dev Apple Silicon, Docker, 3 vòng × 20 s, 50 kết nối)**: image
  Directus chỉ có amd64, nên đo với mọi container ở amd64 (`DOCKER_DEFAULT_PLATFORM=linux/amd64`, cả hai app
  chạy giả lập như nhau). Lần đo khi API mới chạy native arm64 không công bằng, không dùng làm nền.

  | Endpoint | p95 Directus (ms) | p95 Backoffice (ms) | req/s Directus | req/s Backoffice | Kết quả |
  | --- | --- | --- | --- | --- | --- |
  | `/server/ping` | 27.5 | 18.9 | 2093 | 3018 | đạt |
  | `/server/health` | 507.6 | 497.4 | 196 | 343 | đạt |
  | `/server/info` | 180.6 | 58.4 | 304 | 1054 | đạt |
  | `/server/specs/oas` (so với `directus-nocache`) | 470.0 | 432.6 | 118 | 125 | đạt |

  Số đo trên máy giả lập; nền chính thức lấy từ job `benchmark` của CI (runner amd64).

  Trên CI (`ubuntu-latest`, 2026-10-09, 3 vòng × 20 s), hai lần chạy cùng code: `/server/specs/oas` p95 Backoffice
  cao hơn 11% rồi 21% (req/s 45/45, 31/32); `/server/health` +6% rồi +24%. Riêng Directus, p95 OAS dao động 36%
  giữa hai lần. Đếm SQL mỗi request OAS: Directus 8, Backoffice 14 (đọc lại `directus_access`, `directus_policies`,
  `directus_permissions` hai lần vì chưa có permissions cache, D-20); `/server/health` cả hai chỉ `SELECT 1`.
  Quyết định: OAS đo nhưng không chặn tới feature 002 (D-22); CI chạy `BENCH_ROUNDS=5`.

## R19. CI trên GitHub Actions

- **Quyết định**: `.github/workflows/`:
  - `ci.yml` (pull request và push `main`):
    - `guard-directus`: fail nếu `git diff --name-only <base>...HEAD` có đường dẫn `directus/`.
    - `quality`: `pnpm install --frozen-lockfile`, `nx affected -t lint typecheck test build`
      (trên `main` chạy `run-many`), `pnpm run check-port-headers`, `pnpm run check-package-names`,
      `swagger-cli validate` cho `specs/*/contracts/*.openapi.yaml`. Target `test` không cần Docker
      (`parity-tests:test` chỉ chạy unit test). Coverage dùng `@vitest/coverage-v8@3.2.4` với `thresholds` 80%
      cho `apps/api` và libs BE, 60% cho `apps/web`; `createVitestConfig` bật `coverage.enabled`, nên target `test` luôn kiểm ngưỡng và
      dưới ngưỡng thì Vitest trả mã lỗi.
    - `parity` (matrix: `parity-tests:env-up --vendor=<vendor> [--profiles=...]`, `parity-tests:parity
      --vendor=<vendor>`, cuối job `parity-tests:env-down`): `postgres` + `full` (bật thêm profile
      `ratelimit`, `cors-hsts`, `pressure`, `metrics`), `mysql` + `reduced`, `sqlite3` + `reduced`.
    - `guard-differences`: chạy `accepted-differences.test.ts` (mã khớp spec, mục tạm thời hết hạn).
    - `benchmark`: Postgres, sau `parity` (`benchmark:env-up`, `benchmark:run`).
    - `docker`: build image `apps/api` và `apps/web`.
    - `e2e`: sau `docker`, chạy image web và API trên Postgres đã được
      Directus bootstrap (`parity-tests:env-up --vendor=postgres`), chạy smoke test Playwright của `apps/web-e2e`
      (`nx run web-e2e:e2e`).
    - `security`: `pnpm audit --prod --audit-level=high`, gitleaks (chạy image
      `ghcr.io/gitleaks/gitleaks`, không dùng action có giấy phép).
    - `publish` (chỉ khi push `main`, sau khi mọi job trên đạt): nạp image đã test từ artifact của job
      `docker`, gắn tag `latest` và mã commit, push `hiennd23/backoffice-api`, `hiennd23/backoffice-web` lên
      Docker Hub. Cần secret `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`.
  - `semgrep.yml`: Semgrep CE (`p/typescript`) chạy ở pull request, push `main` và hằng tuần. Kế hoạch ban
    đầu là `codeql.yml` (`github/codeql-action`, `javascript-typescript`); repo private không có GitHub Code
    Security nên đã thay (rủi ro bên dưới, Complexity Tracking của plan).
  - `nightly.yml`: hằng đêm, `parity` + `full` cho `maria`, `mssql`, `oracle`, `cockroachdb`, và các
    bản cũ Directus kiểm thử `postgres10`, `mysql5` (cùng `mysql`, `sqlite3` bản `full`). MariaDB
    không có trong danh sách của Nguyên tắc V; thêm vào hằng đêm vì FR-020 hứa hỗ trợ.
  - `.github/dependabot.yml`: npm (pnpm) và GitHub Actions, hằng tuần.
- **Rủi ro**: CodeQL miễn phí cho repo public. Nếu `Hien-IT/backoffice-next` là repo private không có
  GitHub Code Security thì thay bằng Semgrep CE (`semgrep scan --config p/typescript`) và ghi vào
  Complexity Tracking. Đã xảy ra (GitHub API trả 404 cho repo khi chưa đăng nhập).
- **Image DB cho CI**: lấy từ `directus/tests/blackbox/docker-compose.yml`: `postgis/postgis:13-3.4-alpine`
  (và `10-3.2-alpine` cho `postgres10`), `mysql:8` (và `mysql:5` cho `mysql5`), `mariadb:11.4`, `mcr.microsoft.com/mssql/server:2022-latest`,
  `cockroachdb/cockroach:latest-v24.3`, Oracle `gvenzl/oracle-xe:21-slim-faststart` (image blackbox
  `quillbuilduser/oracle-18-xe-micro-sq` cũ và không còn bảo trì), `redis:7-alpine` (giống
  `dev/directus-reference`), `cgr.dev/chainguard/minio` (có sẵn `mc` cho bước tạo bucket; `minio/minio`, `minio/mc`
  của blackbox không còn trên Docker Hub, CI không tải được).

## R20. Image Docker của API

- **Quyết định**: `apps/api/Dockerfile` theo khuôn `directus/Dockerfile`: `node:22-alpine`, build với
  `python3 build-base` (cho `sqlite3`), `pnpm --filter @backoffice/api deploy --legacy --prod dist` (như
  `directus/Dockerfile`; pnpm 10 từ chối `deploy` khi thiếu `--legacy` và không bật
  `inject-workspace-packages`), chạy bằng user `node`. Giữ thư mục làm
  việc `/directus` và cùng biến mặc định của image Directus (`DB_CLIENT=sqlite3`,
  `DB_FILENAME=/directus/database/database.sqlite`, `NODE_ENV=production`). KHÔNG chạy
  `bootstrap`, KHÔNG dùng PM2: lệnh chạy là `node main.js`.
- **Lý do**: `CONFIG_PATH` mặc định là `.env` ở thư mục làm việc, `STORAGE_LOCAL_ROOT` mặc định
  `./uploads`, `EXTENSIONS_PATH` `./extensions`. Đổi thư mục làm việc sẽ làm cùng một cấu hình trỏ
  sai chỗ (SC-001). Image chỉ hoàn thiện ở feature 019; ở đây cần để chạy test đối chiếu trên CI.

## R21. App web khung

- **Quyết định**: `apps/web`: Vue 3.5, Vite 7.3, `@vitejs/plugin-vue` 6.0.1, Pinia 3.0, Vue Router 4.6
  (cùng major với Directus app), vue-i18n 11. Thư viện UI: Reka UI 2.8.2 (MIT, headless, cùng bản
  `directus/pnpm-workspace.yaml`) giữ hành vi component như Directus; style riêng của Backoffice bằng
  Tailwind CSS 4.3.3 (MIT, `@tailwindcss/vite` 4.3.3, hỗ trợ Vite 7). Màu, font và theme sáng/tối đặt bằng
  CSS variable để áp `project_color`, logo và theme trong `directus_settings` như Directus. Cả hai thêm ở
  feature 012 khi có component đầu tiên; khung chỉ có một trang nên chưa cài. Ban đầu chọn PrimeVue 5.0, bị loại ngày 2026-10-09 vì PrimeVue 5 dùng license thương mại
  PrimeUI (cần license key; constitution 1.1.0). Pinia 3.0
  và Vite 7.3 khác major với Directus app (Pinia 2.3.1, Vite 8.0.8 trong `directus/pnpm-workspace.yaml`):
  app khung chưa copy store hay composable nào của Directus app; feature 012 chốt lại khi bắt đầu copy. Khi khởi động, app đọc `config.json` cạnh `index.html` (base `/admin/`) để lấy URL
  API; dev server phục vụ file mặc định. Chỉ có một trang khung hiển thị "Backoffice" và kết quả
  `GET /server/ping`. i18n: en-US, vi-VN copy các key cần từ
  `directus/app/src/lang/translations/{en-US,vi-VN}.yaml` (Nguyên tắc VI), có header port; thêm ngôn ngữ
  bằng một file mới. Test: Vitest 3.2.4 + `@vue/test-utils` 2.4.6 + `happy-dom`, ngưỡng 60%; E2E khói
  `apps/web-e2e` (Playwright 1.64) chạy ở job `e2e` của CI.
- **Lý do**: FR-003. Mọi màn hình nghiệp vụ thuộc feature 012 trở đi.

## R22. Chất lượng code

- **Quyết định**: ESLint 9 flat config (`@eslint/js` 9.39.1, `typescript-eslint` 8.46.4,
  `eslint-plugin-vue` 10.5.1, `eslint-config-prettier` 10.1.8) và Prettier 3.6.2 với đúng
  `directus/.prettierrc.json` (printWidth 120, singleQuote). Thụt lề bằng tab như Directus.
- **Lý do**: Cùng định dạng thì diff giữa file port và file gốc nhỏ, review dễ.
