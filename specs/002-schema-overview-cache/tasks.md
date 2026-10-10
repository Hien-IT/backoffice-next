---

description: "Danh sách task cho feature 002: Schema overview và cache dùng chung"
---

# Tasks: Schema overview và cache dùng chung

**Input**: Tài liệu thiết kế trong `/specs/002-schema-overview-cache/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test.
- Mọi hành vi nhìn thấy được (endpoint, key và kênh Redis) có test đối chiếu chạy với cả Directus 11.17.4 thật lẫn
  app mới.

**Organization**: Task nhóm theo user story để làm và kiểm thử độc lập. Phase 1 và 2 là nền chung, làm cho app mới
có cache schema, khóa và bus giống Directus trong một process.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task. Phase 1, 2 và Polish không có nhãn này.
- File port từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn nguồn>`. Mỗi task port ghi các cặp
  `{ "source", "dest" }` (source tính từ `directus/`) vào `tools/port-manifest/002-T###.json`, theo đúng ID task.
  Chạy `node tools/check-port-headers.mjs` sau khi ghi. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Chỗ thêm so với nguồn ghi comment `// Backoffice: <lý do>`.
- Giữ quy ước của 001: không đọc `useEnv()` ở cấp module; đọc khi hàm được gọi lần đầu.
- Tên biến, comment, commit viết tiếng Anh. Tài liệu viết tiếng Việt.
- Test viết trước và phải fail trước khi làm phần tương ứng.
- Quy trình merge thẳng `main` (memory của dự án): mỗi nhóm task commit và push xong thì CI phải xanh. Task T019 tồn
  tại để giữ CI xanh ngay khi bước `schema` chạy ở mọi route.

## Quy ước đường dẫn

- API: `apps/api/src/**`. Thư viện: `libs/<tên>/src/**`.
- Test đối chiếu: `tests/parity/src/**`. Danh sách khác biệt: `tests/parity/accepted-differences.ts`.
- Benchmark: `tests/benchmark/**`. Công cụ: `tools/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/packages/*`.

## Tóm tắt

- Tổng số task: **44**
- Số task đánh dấu [P]: **24**
- MVP gợi ý: **User Story 1 + User Story 2** (Phase 1 + 2 + 3 + 4).

  Lý do không giao US1 một mình: hai app trao đổi nguyên SchemaOverview qua `schemaCache--done`. Chưa chứng minh
  schema giống hệt (US2) thì Directus có thể nhận một schema sai do app mới dựng (Nguyên tắc IV).

| Phase | Số task |
|-------|---------|
| Phase 1: Setup | 4 |
| Phase 2: Foundational | 15 |
| Phase 3: User Story 1 - Schema đồng bộ không cần khởi động lại | 7 |
| Phase 4: User Story 2 - SchemaOverview giống hệt Directus | 5 |
| Phase 5: User Story 3 - Dựng schema một lần khi nhiều instance cùng cần | 2 |
| Phase 6: User Story 4 - Cấu hình cache giống Directus | 4 |
| Phase 7: Polish & Cross-Cutting Concerns | 7 |

---

## Phase 1: Setup (phụ thuộc, lib mới, hạ tầng test)

**Purpose**: Thêm phụ thuộc cùng bản Directus, tạo khung `@backoffice/memory` và hạ tầng test đối chiếu cho nhiều
instance và namespace riêng.

- [X] T001 Thêm vào `catalog:` của `pnpm-workspace.yaml` hai phụ thuộc, đúng bản `directus/pnpm-workspace.yaml`:
  `lru-cache: 11.2.2` và `'@sesamecare-oss/redlock': 1.4.0`. Chạy `pnpm install` để cập nhật `pnpm-lock.yaml`. Chạy
  `pnpm audit --prod --audit-level=high`; nếu có cảnh báo mới, ghi lại và báo trước khi đi tiếp (Nguyên tắc X).
- [X] T002 Tạo khung `libs/memory` theo mẫu `libs/pressure`:
  - `package.json`: `@backoffice/memory`, ESM, `exports` gồm `"."` và `"./package.json"`; dependencies
    `@backoffice/utils: workspace:*`, `ioredis`, `lru-cache`, `@sesamecare-oss/redlock` (đều `catalog:`).
  - `tsconfig.json`, `tsconfig.lib.json`, `vitest.config.ts` (`createVitestConfig({ coverageThreshold: 80 })`).
  - `src/index.ts` tạm rỗng.

  Thêm `"@backoffice/memory": "workspace:*"` vào dependencies của `apps/api/package.json`. Kiểm:
  `pnpm nx show projects` có `@backoffice/memory`, và `node tools/check-package-names.mjs` pass. (sau T001)
- [X] T003 [P] Hạ tầng compose của test đối chiếu.
  - `tests/parity/docker-compose.yml`:
    - Thêm service `backoffice-api-2`: profile `multi`, cấu hình như `backoffice-api`, cổng `8157:8055`.
    - Thêm cặp `directus-cache-config` và `backoffice-api-cache-config`: profile `cache-config`, cổng `8755` và
      `8756`, `env_file` là `./env/${TEST_DB:-postgres}.env` cộng `./env/profile-cache-config.env`, theo mẫu cặp
      `ratelimit`.
  - Tạo `tests/parity/env/profile-cache-config.env` với: `CACHE_NAMESPACE=parity-cache-config`,
    `REDIS_BUS_NAMESPACE=parity:bus`, `REDIS_LOCK_NAMESPACE=parity:lock`,
    `REDIS_PERMISSIONS_NAMESPACE=parity-permissions`, `CACHE_SCHEMA_SYNC_TIMEOUT=1000`.
  - Thêm `multi` và `cache-config`:
    - vào `ALL_PROFILES` của `tests/parity/scripts/env.mjs`;
    - vào kiểu `Profile` và bảng cổng của `tests/parity/src/config.ts`.
  - `tests/parity/src/global-setup.ts`: đặt `BACKOFFICE_URL_2` khi `backoffice-api-2` trả ping, và URL của cặp
    `cache-config` như các cặp có sẵn.
  - `.github/workflows/ci.yml`: dòng `postgres` của matrix `parity` có `profiles:
    'ratelimit,cors-hsts,pressure,metrics,multi,cache-config'`.
- [X] T004 [P] Helper Redis cho test đối chiếu: `tests/parity/src/redis.ts`. Thêm `ioredis` (`catalog:`) vào
  `tests/parity/package.json`. Helper gồm:
  - `redis()`: client tới Redis của môi trường (cổng host `6108` như `docker-compose.yml`).
  - `decodeMessage(buf)`: gunzip khi độ dài ≥ 19 và 3 byte đầu là `1f 8b 08`, rồi `JSON.parse` (contracts/redis.md
    §1).
  - `flushSharedCaches({ busNs = 'directus:bus', permNs = 'permissions' })`, theo thứ tự:
    1. `PUBLISH <permNs>:multi-cache {"type":"clear","origin":"parity-test"}`;
    2. `UNLINK` mọi key `<permNs>:*` tìm bằng `SCAN`;
    3. `PUBLISH <busNs>:schemaChanged {}`;
    4. chờ 200 ms.
  - `traceRedis(fn)`: mở kết nối riêng chạy `MONITOR`, chạy `fn`, trả danh sách `{ client, command, key }`.
    `client` là IP nguồn. `key` là đối số đầu, hoặc tên kênh với `PUBLISH`/`SUBSCRIBE`.
  - `containerAddress(service)`: IP container qua `docker inspect`, dùng `compose` của `tests/parity/src/docker.ts`.

  Unit test `tests/parity/src/redis.test.ts` cho `decodeMessage` (có nén, không nén, buffer rỗng) và cho phần đọc dòng
  `MONITOR`. Test này chạy trong target `test`, không cần Docker.

---

## Phase 2: Foundational (cache schema, khóa, bus trong app mới)

**Purpose**: App mới có `getSchema` giống Directus (bộ nhớ, khóa, bus, thử lại), đủ 5 instance Keyv, và bước
`schema` trong mọi request. Sau phase này, một instance app mới chạy cạnh Directus đã tham gia cơ chế dựng schema
chung.

**⚠️ CRITICAL**: Chưa xong phase này thì không làm user story nào.

**Điều kiện** (đã đạt 2026-10-10): constitution 1.2.0 (Nguyên tắc VII cho phép cache trong process được xóa qua
bus Redis) và dòng Complexity Tracking của `plan.md` đã được tech lead duyệt, và nằm trên `main`.

- [X] T005 [P] Port `directus/packages/utils/shared/get-simple-hash.ts` và test của nó sang
  `libs/utils/src/shared/get-simple-hash.ts` (+ `.test.ts`). Export từ `libs/utils/src/shared/index.ts`. Ghi manifest.
- [X] T006 [P] Port `directus/packages/utils/node/process-id.ts` và test sang `libs/utils/src/node/process-id.ts`
  (+ `.test.ts`). Export từ `libs/utils/src/node/index.ts`. Ghi manifest.
- [X] T007 Port `directus/packages/memory/src/utils/**` (8 file và 8 file test) sang `libs/memory/src/utils/**`.
  `parseJSON` lấy từ `@backoffice/utils`. Ghi manifest. (sau T002)
- [X] T008 [P] Port `directus/packages/memory/src/bus/**` (kèm test) sang `libs/memory/src/bus/**`. Thêm
  `disconnect(): Promise<void>` vào interface `Bus` (`types/class.ts`):
  - `BusRedis`: gọi `quit()` trên kết nối `sub`;
  - `BusLocal`: không làm gì.

  Comment `// Backoffice: close the subscriber connection on shutdown (Principle VII, research R6)`. Thêm test cho
  `disconnect()`. Ghi manifest. (sau T007)
- [X] T009 [P] Port `directus/packages/memory/src/kv/**` (kèm test) sang `libs/memory/src/kv/**`. Ghi manifest.
  (sau T007)
- [X] T010 Port `directus/packages/memory/src/cache/**` (kèm test) sang `libs/memory/src/cache/**`.
  - Thêm `disconnect()` vào `CacheMulti` (gọi `this.bus.disconnect()`), có comment `Backoffice:` và test.
  - `libs/memory/src/index.ts` export `bus`, `cache`, `kv`. Không có `limiter` (research R1).
  - Ghi manifest. Chạy `pnpm nx run @backoffice/memory:test` (coverage ≥ 80%).
  - (sau T006, T008, T009)
- [X] T011 [P] Port `directus/api/src/bus/index.ts`, `lib/use-bus.ts`, `lib/use-bus.test.ts` sang `apps/api/src/bus/**`.
  Khi tạo bus Redis, đăng ký `onServerShutdown(() => bus.disconnect())` (`apps/api/src/shutdown.ts`); thêm ca test
  cho việc đăng ký. Ghi manifest. (sau T010)
- [X] T012 [P] Port `directus/api/src/lock/index.ts`, `lib/use-lock.ts`, `lib/use-lock.test.ts` sang
  `apps/api/src/lock/**`. Ghi manifest. (sau T010)
- [X] T013 [P] Port `directus/api/src/utils/freeze-schema.ts` và test sang `apps/api/src/utils/freeze-schema.ts`
  (+ `.test.ts`). Ghi manifest.
- [X] T014 [P] Thêm 10 biến của `contracts/config.md` vào `apps/api/src/config/supported-variables.ts`. Sửa test của
  danh sách này để kiểm:
  - 10 biến đó không còn bị cảnh báo;
  - 5 biến cache response (`CACHE_AUTO_PURGE_IGNORE_LIST`, `CACHE_CONTROL_S_MAXAGE`, `CACHE_STATUS_HEADER`,
    `CACHE_VALUE_MAX_SIZE`, `CACHE_SKIP_ALLOWED`) vẫn bị cảnh báo.
- [X] T015 Mở rộng `apps/api/src/cache.ts` theo `directus/api/src/cache.ts` (research R3).
  - `getCache()` trả đủ 5 instance của contracts/redis.md §5 (`cache`, `systemCache`, `deploymentCache`,
    `localSchemaCache`, `lockCache`), cùng namespace và TTL. Log lỗi với tiền tố `[cache]`, `[system-cache]`,
    `[deployment-cache]`, `[schema-cache]`, `[lock-cache]`. Đăng ký `onServerShutdown` disconnect cho mỗi instance
    dùng Redis.
  - Thêm `setMemorySchemaCache`, `getMemorySchemaCache` (dùng `freezeSchema`/`unfreezeSchema`, đọc
    `CACHE_SCHEMA_FREEZE_ENABLED`).
  - `_resetCache()` đặt lại mọi biến của module.
  - Cập nhật comment đầu file.
  - Test `apps/api/src/cache.test.ts`:
    - namespace và TTL của từng instance với store memory;
    - `deploymentCache` TTL mặc định 5000;
    - `localSchemaCache` luôn memory kể cả khi `CACHE_STORE=redis`;
    - tiền tố log khi store Redis lỗi;
    - freeze bật: trả cùng object đã đóng băng;
    - freeze tắt: trả bản sao khác tham chiếu, sửa được.
  - (sau T013)
- [X] T016 Port `getSchema` đầy đủ (`directus/api/src/utils/get-schema.ts:22-114`) vào
  `apps/api/src/schema/get-database-schema.ts`, thay `getSchema` rút gọn của 001.
  - Gồm: `database`, `bypassCache`, `attempt`, `MAX_ATTEMPTS = 3`; khóa `schemaCache--preparing` qua `useLock()`;
    message `schemaCache--done` qua `useBus()`; `CACHE_SCHEMA_MAX_ITERATIONS`, `CACHE_SCHEMA_SYNC_TIMEOUT`; log
    `trace` khi chờ; `finally` phát `{ schema }` rồi xóa khóa.
  - Cập nhật comment đầu file.
  - Test `get-database-schema.test.ts` với bus và khóa local (env không có Redis):
    - cache có sẵn thì không truy vấn DB;
    - `CACHE_SCHEMA=false` dựng lại mỗi lần, không chạm khóa;
    - `bypassCache` dựng lại;
    - lượt 1 dựng và phát `{schema}`;
    - lượt ≥ 2 chờ và dùng schema nhận qua message;
    - nhận `{schema:null}` thì thử lại;
    - hết `CACHE_SCHEMA_SYNC_TIMEOUT` thì thử lại;
    - sau 3 lần thì ném `Failed to get Schema information: hit infinite loop`;
    - lượt ≥ `CACHE_SCHEMA_MAX_ITERATIONS` thì xóa khóa;
    - dựng lỗi thì vẫn phát `{schema:null}` và xóa khóa.
  - (sau T011, T012, T015)
- [X] T017 Bước `schema` và `cache` trong pipeline (contracts/request-pipeline.md).
  - Port `directus/api/src/middleware/schema.ts` sang `apps/api/src/middleware/schema.ts`. Thêm điều kiện bỏ qua
    `/server/health` với mọi phương thức, khớp không phân biệt hoa thường và cho phép một `/` cuối (D-13, FR-022).
  - Port `directus/api/src/middleware/cache.ts` sang `apps/api/src/middleware/cache.ts`. Chỉ giữ `getCache()` rồi
    `next()`, comment rằng cache response làm ở 005 (D-11).
  - Gắn cả hai vào `apps/api/src/app-pipeline.ts` ngay sau `publicAccountability`, trước `options.beforeRoutes` và
    `createRouterOptions()`.
  - Test `middleware/schema.test.ts`, `middleware/cache.test.ts` và ca mới trong `app-pipeline.test.ts`:
    - `/server/ping`, `/server/health`, `/SERVER/health/` không gọi `getSchema`;
    - `/server/info`, `/metrics`, path lạ, `OPTIONS /server/info` có gọi;
    - lỗi của `getSchema` trả `500 INTERNAL_SERVER_ERROR`.
  - Ghi manifest. (sau T016)
- [X] T018 Dùng `req.schema` thay cho `getSchema()` (FR-023):
  - `apps/api/src/controllers/server.controller.ts`: OAS dùng `schema: req.schema`; info truyền schema cho
    `ServerService`.
  - `apps/api/src/services/server.service.ts`, `apps/api/src/services/settings.service.ts`: nhận schema qua options,
    bỏ lời gọi `getSchema()` trong `defaults()`.
  - Sửa `server.controller.test.ts`, `settings.service.test.ts` và test của `server.service.ts`.
  - (sau T017)
- [X] T019 Giữ CI xanh khi bước `schema` đã chạy ở mọi route:
  - `tests/parity/accepted-differences.ts`: D-13 chỉ còn `endpoints: ['GET /server/health']`, sửa `reason`.
  - `tests/parity/src/server/health.test.ts`, ca "database down": giữ phần so `/server/health` (vẫn thuộc D-13).
    Thêm vào cùng ca: trước khi tắt DB, `PUBLISH directus:bus:schemaChanged {}` để cache trống (dùng `redis()` của
    `src/redis.ts`, T004). Khi DB tắt, so `GET /server/info` và `GET /parity-unknown-path`: cả hai app trả
    `500 INTERNAL_SERVER_ERROR` (FR-021, D-13 thu hẹp, US3.2). Timeout dùng như ca health có sẵn. Không test nào
    khác so `/metrics` hay path lạ khi DB tắt.
  - Redis tắt: không cần sửa. Các ca Redis tắt có sẵn (`redis-down.test.ts`, `server/errors.test.ts`,
    `server/health.test.ts`) chỉ gọi `/server/ping` và `/server/health`, không đi qua bước `schema` (ghi khi làm).
  - Chạy `pnpm nx run parity-tests:parity --vendor=postgres` (bộ full) và `node tools/check-port-headers.mjs`. Commit
    phase 2 chỉ sau khi cả hai đạt.
  - (sau T018)

**Checkpoint**: App mới có cache schema giống Directus trong một process, test đối chiếu cũ vẫn đạt. Các user story
bắt đầu được.

---

## Phase 3: User Story 1 - Schema đồng bộ giữa Directus và app mới mà không khởi động lại (Priority: P1) 🎯 MVP

**Goal**: Thay đổi schema hoặc quyền ở Directus làm mọi instance app mới dùng schema và quyền mới trong 1 giây, và
ngược lại (FR-016 đến FR-020, SC-001). Permissions cache dùng chung với Directus (FR-019).

**Independent Test**:
- Bật `env-up --profiles=multi`.
- Làm ấm cache, rồi thêm field qua `POST /fields` của Directus. OAS của `backoffice-api` và `backoffice-api-2` có
  field mới sau 1 giây.
- Thêm cột bằng SQL và chạy `clearSystemCache()` trong container app mới. OAS của Directus có cột đó sau 1 giây.

### Tests for User Story 1 (MANDATORY) ⚠️

- [X] T020 [P] [US1] Helper `tests/parity/src/schema/clear-system-cache.ts` (research R8).
  - Hàm `clearSystemCacheIn(service, opts?)` chạy, qua `compose` của `src/docker.ts`:
    `exec -T <service> node --input-type=module -e "<script>"`.
  - Script: import `/directus/dist/cache.js` và `/directus/dist/redis/index.js`, rồi `await clearSystemCache(opts)`
    (`opts` ví dụ `{ forced: true }`, như `POST /utils/cache/clear?system` của Directus), `await useRedis().quit()`,
    `process.exit(0)`.
  - Ném lỗi kèm stderr khi mã thoát khác 0.
  - Kiểm đường dẫn `dist` thật trong image `hiennd23/backoffice-api:local` trước khi dùng.
- [X] T021 [US1] Test đối chiếu `tests/parity/src/schema/sync.test.ts` (US1.1–US1.4, SC-001). Cần profile `multi`;
  bỏ qua kèm thông báo khi không có `BACKOFFICE_URL_2`.
  - `beforeAll`, qua `directusRequest` của `src/directus-api.ts`:
    - tạo collection `parity_sync` (khóa `id`, field `title`);
    - cho policy public quyền `read` trên đó;
    - làm ấm cache bằng `GET /server/specs/oas` ở `DIRECTUS_URL`, `BACKOFFICE_URL`, `BACKOFFICE_URL_2`.
  - Ca 1: `POST /fields/parity_sync` thêm `rating`. Chờ 1000 ms. OAS của cả hai instance app mới có `rating`.
  - Ca 2: đổi kiểu field (`PATCH`), xóa field, tạo và xóa collection, tạo và xóa relation m2o. Mỗi thay đổi phản ánh
    ở cả hai instance sau 1 giây.
  - Ca 3: thêm cột bằng SQL (knex của `src/config.ts`) và dòng `directus_fields`.
    - OAS của Directus chưa có cột (cache cũ).
    - Chạy `clearSystemCacheIn('backoffice-api')`.
    - Sau 1 giây, OAS của Directus và của `backoffice-api-2` có cột.
  - Ca 4:
    - Bớt field trong quyền public qua `PATCH /permissions/<id>` của Directus. App mới phản ánh sau 1 giây.
    - Sửa `directus_permissions` bằng SQL, rồi `POST /utils/cache/clear` trên Directus. App mới phản ánh sau 1 giây.
  - In độ trễ đo được.
  - `afterAll` dọn collection, quyền và cột.
  - (sau T020)
- [X] T022 [P] [US1] Test đối chiếu `tests/parity/src/schema/permissions-cache.test.ts` (FR-019, gỡ D-22).
  - `beforeAll`, qua Directus API: tạo collection `parity_perm` và quyền public `read` có `fields`, `validation`,
    `presets` khác `null`, và `permissions` là filter tĩnh (ví dụ `{"title":{"_nnull":true}}`). Filter KHÔNG chứa
    biến `$CURRENT_USER`, `$CURRENT_ROLE`, `$CURRENT_POLICIES`, `$NOW`, vì xử lý biến động thuộc feature 004.
  - Với từng app: `flushSharedCaches()`, rồi `GET /server/specs/oas`, rồi đọc mọi key `permissions:*` và giá trị
    (`decodeMessage`).
  - Kiểm:
    - hai app có cùng tập key: đúng 1 key `policies-…` và 2 key `raw-permissions-…` (research R5);
    - giá trị bằng nhau bằng `toStrictEqual`, không chuẩn hóa.
  - Ca dùng chéo: Directus ghi cache, app mới gọi OAS mà không flush. Kết quả bằng OAS khi app mới tự tính.
  - `afterAll` dọn dữ liệu.

### Implementation for User Story 1

- [X] T023 [US1] Port permissions cache.
  - `directus/api/src/permissions/cache.ts` sang `apps/api/src/permissions/cache.ts`:
    - `useCache` qua `defineCache` của `@backoffice/memory`;
    - cấu hình tính khi gọi lần đầu: không Redis là `local` 500 key; có Redis là `multi`, namespace
      `REDIS_PERMISSIONS_NAMESPACE ?? 'permissions'`, TTL `getMilliseconds(CACHE_SYSTEM_TTL)`, local 100 key;
    - `clearCache()`;
    - đăng ký `onServerShutdown` gọi `disconnect()` cho cache `multi`.
  - `directus/api/src/permissions/utils/with-cache.ts` và test gốc `with-cache.test.ts` sang
    `apps/api/src/permissions/utils/`.
  - Test `apps/api/src/permissions/cache.test.ts` cho hai cấu hình.
  - Ghi manifest.
- [X] T024 [P] [US1] Đưa đọc quyền qua cache (research R5, contracts/redis.md §4).
  - Tạo `apps/api/src/permissions/utils/fetch-raw-permissions.ts`:
    - `fetchRawPermissions = withCache('raw-permissions', _fetchRawPermissions, prepareArg)`, với `prepareArg` đúng
      như `directus/api/src/permissions/utils/fetch-raw-permissions.ts:7-17`;
    - thân `_fetchRawPermissions` là phần đọc knex đang có trong `lib/fetch-permissions.ts`.
  - `apps/api/src/permissions/lib/fetch-permissions.ts`:
    - thêm `bypassDynamicVariableProcessing?` vào options;
    - gọi `fetchRawPermissions({ ...options, bypassMinimalAppPermissions: options.bypassDynamicVariableProcessing ??
      false }, context)`.
  - `apps/api/src/permissions/lib/fetch-policies.ts`: đổi tên thân hàm thành `_fetchPolicies`, export
    `fetchPolicies = withCache('policies', _fetchPolicies, ({ roles, user, ip }) => ({ roles, user, ip }))`.
  - Cập nhật comment đầu các file.
  - Test trong `apps/api/src/permissions/permissions.test.ts`:
    - lần gọi thứ hai cùng đối số không truy vấn DB;
    - key là `policies-<getSimpleHash(JSON.stringify({roles:[],user:null,ip}))>`;
    - đúng 2 key `raw-permissions-…` cho hai bộ đối số của đường OAS.
  - Ghi manifest.
  - (sau T023)
- [X] T025 [P] [US1] `clearSystemCache` và bộ nhận `schemaChanged` trong `apps/api/src/cache.ts`, theo
  contracts/redis.md §3.
  - `clearSystemCache` làm đủ 4 bước theo đúng thứ tự: `system-cache-lock` TTL 10000; `await clearPermissionCache()`;
    publish không await.
  - Hàm `subscribeSchemaChanged()`: chỉ khi `redisConfigAvailable()`, một lần mỗi process. Gọi trong `createApp()`
    của `apps/api/src/app.ts` trước khi nhận request.
  - Test trong `cache.test.ts` (bus local và mock):
    - `clearSystemCache` xóa `systemCache`, `localSchemaCache`, schema trong bộ nhớ và permissions cache, và phát
      `schemaChanged` với `{ autoPurgeCache }`;
    - không xóa `systemCache` khi `system-cache-lock` đang có, trừ khi `forced`;
    - bộ nhận xóa schema trong bộ nhớ và `localSchemaCache`;
    - bộ nhận chỉ xóa `cache` khi `CACHE_STORE=memory`, `CACHE_AUTO_PURGE=true` và `autoPurgeCache !== false`;
    - không đăng ký khi không có Redis.
  - (sau T023)
- [X] T026 [US1] Chạy `sync.test.ts` và `permissions-cache.test.ts` trên Postgres
  (`pnpm nx run parity-tests:env-up --vendor=postgres --profiles=multi`) tới khi đạt.
  - Lệch giá trị permissions cache thì sửa phần đọc ở T024, kèm unit test. Không chuẩn hóa trong test.
  - Ghi độ trễ đo được vào commit message.

**Checkpoint**: Đổi schema hoặc quyền ở một bên thì bên kia thấy trong 1 giây. Permissions cache dùng chung.

---

## Phase 4: User Story 2 - SchemaOverview giống hệt Directus (Priority: P1)

**Goal**: SchemaOverview của app mới bằng của Directus trên cùng DB, ở mọi vendor được kiểm (FR-001 đến FR-008,
SC-002). Schema do bên này dựng dùng được ở bên kia (FR-012).

**Independent Test**: Chạy `overview.test.ts` trên Postgres, MySQL, SQLite: so SchemaOverview hai bên bắt qua bus
và phát lại message chéo.

### Tests for User Story 2 (MANDATORY) ⚠️

- [X] T027 [P] [US2] Fixture schema `tests/parity/src/schema/fixture.ts`, tạo qua API của Directus bằng
  `directusRequest`: `POST /collections` kèm `fields`, `POST /relations`. Directus tự xử lý khác biệt giữa vendor, nên
  không cần file snapshot.
  - Hàm `createFixture()` tạo các collection `parity_overview_*` gồm:
    - mọi kiểu field Directus hỗ trợ trên vendor đang chạy (danh sách theo `directus/tests/blackbox`), với kiểu chỉ có
      ở một vendor (như `geometry` trên Postgres) đặt sau điều kiện vendor;
    - field có giá trị mặc định, nullable và không nullable, decimal có precision và scale;
    - alias `o2m`, `m2m`, `m2a`, `translations`, `files`;
    - field presentation (`special: ['alias','no-data']`), field group;
    - `validation` lưu dạng chuỗi JSON, `note`, `sort_field`, `singleton: true`, `accountability: null`.
  - Hàm `dropFixture()` xóa tất cả.
- [X] T028 [P] [US2] Helper `tests/parity/src/schema/capture.ts` (research R9).
  - `captureSchema(appUrl, { busNs, lockNs })`, theo thứ tự:
    1. `UNLINK <lockNs>:schemaCache--preparing`;
    2. `SUBSCRIBE <busNs>:schemaCache--done`;
    3. `PUBLISH <busNs>:schemaChanged {}`;
    4. `GET /server/info` tới `appUrl`;
    5. lấy message đầu tiên và trả `{ schema: decodeMessage(raw), raw }`.
  - `replaySchema(appUrl, raw)`, theo thứ tự:
    1. `SET <lockNs>:schemaCache--preparing 1`;
    2. gửi `GET /server/specs/oas` mà không await;
    3. chờ tới khi `PUBSUB NUMSUB <busNs>:schemaCache--done` ≥ 1;
    4. `PUBLISH` nguyên `raw`;
    5. trả response, rồi `UNLINK` khóa.
  - Thời hạn 15 s.
- [X] T029 [US2] Test đối chiếu `tests/parity/src/schema/overview.test.ts` (US2.1–US2.5, FR-008, FR-012, FR-040).
  - `beforeAll`: `createFixture()`, rồi tạo bằng SQL các bảng `parity_no_pk` (không khóa chính), `"parity with space"`
    và `sysdiagrams` (nằm trong `DB_EXCLUDE_TABLES` mặc định), kèm cột cho mỗi bảng.
  - Ca 1: `captureSchema(DIRECTUS_URL)` bằng `captureSchema(BACKOFFICE_URL)` theo `toStrictEqual`, gồm thứ tự
    `relations`, không chuẩn hóa (contracts/schema-overview.md).
  - Ca 2: `replaySchema(BACKOFFICE_URL, rawDirectus)` trả 200, và OAS bằng OAS khi app mới tự dựng.
  - Ca 3: `replaySchema(DIRECTUS_URL, rawBackoffice)` trả 200, và OAS bằng OAS khi Directus tự dựng.
  - Ca 4: log của cả hai container có dòng `warn` về bảng không khóa chính và bảng tên có dấu cách, cùng message
    (`logs` của `src/docker.ts`).
  - `afterAll`: `dropFixture()` và xóa các bảng SQL.
  - (sau T027, T028)

### Implementation for User Story 2

- [X] T030 [US2] `tests/parity/src/suite.ts`: thêm `src/schema/overview.test.ts` vào `REDUCED_FILES` và
  `src/schema/**/*.test.ts` vào `FULL_FILES`. Sửa test của danh sách suite nếu có.
- [X] T031 [US2] Chạy `overview.test.ts` trên Postgres (full), MySQL và SQLite (reduced).
  - Sửa mọi lệch trong `apps/api/src/schema/*` (`get-local-type.ts`, `get-default-value.ts`, `read-relations.ts`,
    `get-database-schema.ts`) cho tới khi đạt. Không chuẩn hóa trong test.
  - Mỗi chỗ sửa có unit test trong file test tương ứng.
  - (sau T029, T030)

**Checkpoint**: SchemaOverview hai bên giống nhau, và dùng chéo qua bus được.

---

## Phase 5: User Story 3 - Nhiều instance khởi động cùng lúc dựng schema một lần (Priority: P2)

**Goal**: Khi cache trống, chỉ process giữ lượt đầu của khóa dựng schema. Process khác chờ, hết giờ thì thử lại,
giống Directus (FR-011 đến FR-013, SC-003).

**Independent Test**: Chạy `build-once.test.ts` với profile `multi` và `cache-config`: đếm message
`schemaCache--done` khi 20 request đồng thời tới 3 process.

### Tests for User Story 3 (MANDATORY) ⚠️

- [X] T032 [P] [US3] Test đối chiếu `tests/parity/src/schema/build-once.test.ts`.
  - Số lần dựng là số message trên kênh `schemaCache--done`. Process nguồn là IP của lệnh `PUBLISH` trong
    `traceRedis`.
  - Ca 1 (SC-003):
    1. `flushSharedCaches()`;
    2. gửi 1 request tới `BACKOFFICE_URL`, không await;
    3. gửi ngay 19 request đồng thời, chia cho `DIRECTUS_URL`, `BACKOFFICE_URL`, `BACKOFFICE_URL_2`.

    Kết quả: mọi request trả 200, đúng 1 lần dựng.
  - Ca 2: sau ca 1, gửi tuần tự thêm request tới từng process. Mỗi process dựng tối đa 1 lần.
  - Ca 3 (dựng lỗi khi DB vẫn chạy; trường hợp DB tắt nằm ở T019):
    1. `SET` khóa bằng 1, rồi gửi request tới app (process này phải chờ);
    2. `UNLINK` khóa, rồi `PUBLISH {"schema":null}`.

    Kết quả: app tự dựng và trả 200. Làm cho Directus và app mới, so kết quả.
  - Ca 4, chạy trên cặp `cache-config` (`CACHE_SCHEMA_SYNC_TIMEOUT=1000`):
    - Khóa kẹt: `SET parity:lock:schemaCache--preparing 1`. Cả hai app trả `500` sau 3 lần chờ.
    - Khóa ở 99: cả hai app xóa khóa (vì đạt `CACHE_SCHEMA_MAX_ITERATIONS`), thử lại, rồi trả 200.
  - Cuối mỗi ca: `UNLINK` khóa.

### Implementation for User Story 3

- [X] T033 [US3] Chạy `build-once.test.ts` trên Postgres (`--profiles=multi,cache-config`).
  - Lệch Directus thì sửa `getSchema` (T016), kèm unit test. Không có cài đặt mới ngoài Phase 2.
  - Ghi số lần dựng đo được vào commit message.
  - (sau T032)

**Checkpoint**: Cơ chế dựng một lần, chờ, thử lại và xóa khóa giống Directus.

---

## Phase 6: User Story 4 - Cấu hình cache giống Directus (Priority: P2)

**Goal**: Các biến `CACHE_*` và `REDIS_*_NAMESPACE` có cùng tác dụng như Directus. App mới không tạo key hay kênh lạ
(FR-024, FR-030 đến FR-033, SC-004). Log lỗi Redis giống Directus (gỡ D-20).

**Independent Test**: Chạy `redis-trace.test.ts` trên cặp `cache-config`: tập lệnh Redis của app mới là tập con của
Directus. Chạy `redis-down.test.ts`: hành vi và log khi Redis mất giống Directus.

### Tests for User Story 4 (MANDATORY) ⚠️

- [X] T034 [P] [US4] Test đối chiếu `tests/parity/src/schema/redis-trace.test.ts` (US4.2, US4.3, SC-004, FR-033).
  Chạy trên cặp `cache-config`.
  - Sửa `tests/parity/src/directus-api.ts`: `directusRequest` nhận thêm `baseUrl` tùy chọn (mặc định
    `DIRECTUS_URL`), để gọi Directus của cặp `cache-config`.
  - Với từng app của cặp:
    1. `flushSharedCaches({ busNs: 'parity:bus', permNs: 'parity-permissions' })`;
    2. `traceRedis` quanh 4 bước: `GET /server/specs/oas`, `PUBLISH parity:bus:schemaChanged {}`,
       `GET /server/info`, rồi xóa cache hệ thống. Bước xóa cache hệ thống phải cùng `forced` ở hai bên:
       - Directus: `POST /utils/cache/clear?system` tới `DIRECTUS_URL_CACHE_CONFIG` (gọi
         `clearSystemCache({ forced: true })`, `directus/api/src/services/utils.ts:166-168`);
       - app mới: `clearSystemCacheIn('backoffice-api-cache-config', { forced: true })`;
    3. lọc theo IP container (`containerAddress`).
  - Kiểm:
    - tập `<lệnh> <key>` của app mới ⊆ tập của Directus;
    - có `INCRBY parity:lock:schemaCache--preparing`, `PUBLISH parity:bus:schemaCache--done`,
      `SET parity-permissions:policies-…`;
    - cả hai bên có `SET sets:namespace:parity-cache-config_lock:parity-cache-config_lock:system-cache-lock`,
      `KEYS sets:namespace:parity-cache-config_system:*`, `PUBLISH parity:bus:schemaChanged`,
      `PUBLISH parity-permissions:multi-cache` (US4.2);
    - không có key hay kênh nào dưới `directus:`, `permissions:` hay `sets:namespace:system-cache`;
    - `PUBSUB NUMSUB parity:bus:schemaChanged parity-permissions:multi-cache` mỗi kênh ≥ 2.
  - (sau T020)
- [X] T035 [P] [US4] Thêm ca vào `tests/parity/src/redis-down.test.ts` (FR-024, US4.5, gỡ D-20).
  - Ca cache còn: làm ấm cache, rồi `redisDown()`. `GET /server/info` và `GET /server/specs/oas` ở hai app cùng 200.
  - Ca cache trống: `PUBLISH directus:bus:schemaChanged {}`, rồi `redisDown()`. `GET /server/info` ở hai app cùng
    `500`; chờ tối đa 60 s, không khẳng định thời gian.
  - Log: sau khi Redis tắt, log của mỗi app có tiền tố `[system-cache]`, `[deployment-cache]`, `[lock-cache]` và
    `[cache]`. Env đối chiếu có `CACHE_ENABLED=true`.
  - Bật lại Redis và chờ hai app trả 200.
- [X] T036 [P] [US4] Test khởi động trên host `tests/parity/src/startup/cache-schema.test.ts`, dùng
  `src/startup/run-api.ts` (US4.1, US4.4).
  - Với `CACHE_SCHEMA=false`: `traceRedis` quanh 2 request `/server/info` không có lệnh nào chứa `schemaCache--`.
  - Với `CACHE_SCHEMA_FREEZE_ENABLED=true`: `/server/specs/oas` và `/server/info` trả như Directus cấu hình mặc định.
    Nếu code ghi vào schema đã đóng băng, request sẽ lỗi.
  - Không sửa `suite.ts`: glob `src/{server,startup,observability}/**/*.test.ts` đã gồm file này.

### Implementation for User Story 4

- [X] T037 [US4] Chạy `redis-trace.test.ts`, `redis-down.test.ts`, `startup/cache-schema.test.ts` trên Postgres
  (`--profiles=multi,cache-config`). Sửa lệch trong `apps/api/src/{cache.ts,bus,lock,permissions,schema}`, kèm unit
  test. (sau T034, T035, T036)

**Checkpoint**: Mọi user story đạt độc lập.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Gỡ khác biệt tạm thời, bật lại cổng benchmark, kiểm tra toàn bộ và đóng feature.

- [ ] T038 [P] Gỡ D-20 và D-22 khỏi `tests/parity/accepted-differences.ts`. Chạy `tests/parity/src/accepted-differences.test.ts`.
  Nếu bảng "Khác biệt so với Directus" của spec 002 (cột `Mã | Thay đổi | Lý do`) làm `src/spec-differences.ts` đọc
  sai, sửa parser và test của nó.
- [X] T039 [P] Benchmark `/server/specs/oas` chặn CI (SC-005, research R12).
  - `tests/benchmark/docker-compose.yml`: đổi `directus-nocache` thành `directus-noresponsecache`. Bỏ `CACHE_SCHEMA:
    'false'`, giữ `CACHE_ENABLED: 'false'`, đặt `CACHE_NAMESPACE: benchmark-noresponsecache`, giữ cổng 8655.
  - `tests/benchmark/src/run.ts`: OAS dùng container này, bỏ `notBlocking`, sửa comment đầu file. Đổi tên biến URL
    theo container mới, cả ở `.github/workflows/ci.yml` nếu file đó đặt biến này.
  - Sửa `tests/benchmark/src/compare.test.ts` nếu có test dựa vào `notBlocking` của OAS.
  - Chạy benchmark với `BENCH_ROUNDS=5`, ghi p95 và req/s vào commit message.
  - Nếu vượt 10%: đếm câu SQL mỗi request OAS ở hai app (log câu lệnh của Postgres) và tìm nguyên nhân. Chỉ đề xuất
    nới cổng khi tech lead duyệt.
- [X] T040 [P] Cập nhật `tests/parity/README.md`:
  - profile `multi` và `cache-config`;
  - helper `src/redis.ts` (`flushSharedCaches`, `traceRedis`), và vì sao phải xóa cache dùng chung giữa hai lần chụp;
  - thư mục `src/schema/`;
  - lệnh `clearSystemCacheIn`.
- [ ] T041 Chạy kiểm tra toàn bộ:
  - `pnpm nx run-many -t lint typecheck test` (coverage ≥ 80% cho `api`, `@backoffice/memory`, `@backoffice/utils`);
  - `node tools/check-port-headers.mjs`, `node tools/check-package-names.mjs`, `node tools/guard-directus-unchanged.mjs`;
  - `pnpm audit --prod --audit-level=high`;
  - build image `apps/api/Dockerfile`;
  - parity Postgres full với `--profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config`;
  - parity MySQL và SQLite reduced.

  Sửa tới khi đạt.
- [ ] T042 Chạy `specs/002-schema-overview-cache/quickstart.md` §2–§3 bằng tay trên `dev/directus-reference`. Sửa
  quickstart nếu lệch.
- [ ] T043 [P] Chạy `graphify update .` sau khi đổi code (CLAUDE.md của dự án).
- [ ] T044 Đóng feature:
  - đổi `**Status**: Draft` thành `**Status**: Done` trong `specs/002-schema-overview-cache/spec.md`;
  - push `main` và theo dõi CI tới khi mọi job xanh.
  - (sau T038–T043)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: không phụ thuộc. T002 cần T001. T003 và T004 làm song song với T001, T002.
- **Foundational (Phase 2)**: cần Phase 1. CHẶN mọi user story.
- **US1 (Phase 3)** và **US2 (Phase 4)**: cần Phase 2. Làm song song được (khác file test, khác phần code).
- **US3 (Phase 5)**, **US4 (Phase 6)**: cần Phase 2. Test của US3 và US4 dùng `flushSharedCaches`, cũng cần T023, T025
  (permissions cache và `clearSystemCache`) để kết quả không bị cache dùng chung che. US4 cần thêm T020 (helper
  `clearSystemCacheIn`, dùng ở T034).
- **Polish (Phase 7)**:
  - T038 và T039 cần T026 (permissions cache đã đạt).
  - T041–T044 cần mọi phase trước.

### Thứ tự trong Phase 2

```text
T005 ─┐
T006 ─┼─► T010 ─┬─► T011 ─┐
T007 ─► T008 ─┤ ├─► T012 ─┼─► T016 ─► T017 ─► T018 ─► T019
      └► T009 ─┘ │         │
T013 ───────────┴─► T015 ─┘
T014 (độc lập)
```

### User Story Dependencies

- **US1 (P1)**: sau Phase 2. Không phụ thuộc story khác.
- **US2 (P1)**: sau Phase 2. Không phụ thuộc story khác. Đi cùng US1 trong MVP (xem Tóm tắt).
- **US3 (P2)**: sau Phase 2 và T023, T025.
- **US4 (P2)**: sau Phase 2 và T020, T023, T025.

### Within Each User Story

- Test viết trước và fail trước khi làm phần cài đặt.
- Helper (T020, T027, T028) trước test dùng chúng.
- Lệch so với Directus được sửa ở code app mới, không chuẩn hóa trong test.

### Parallel Opportunities

- Phase 1: T003, T004 song song với nhau và với T001–T002.
- Phase 2: T005, T006, T013, T014 song song. T008, T009 song song. T011, T012 song song.
- US1: T020, T022 song song. T024, T025 song song sau T023.
- US2: T027, T028 song song.
- US1 và US2 làm song song sau Phase 2.
- US4: T034, T035, T036 song song.
- Polish: T038, T039, T040, T043 song song.

---

## Parallel Example: User Story 1

```bash
# Test và helper viết cùng lúc:
Task: "Helper clearSystemCacheIn in tests/parity/src/schema/clear-system-cache.ts"
Task: "Parity test permissions cache in tests/parity/src/schema/permissions-cache.test.ts"

# Sau T023, hai phần cài đặt chạy song song:
Task: "fetchRawPermissions + withCache('policies') in apps/api/src/permissions/**"
Task: "clearSystemCache + subscribeSchemaChanged in apps/api/src/cache.ts, apps/api/src/app.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Schema fixture via Directus API in tests/parity/src/schema/fixture.ts"
Task: "captureSchema / replaySchema in tests/parity/src/schema/capture.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Phase 1: Setup.
2. Phase 2: Foundational. Commit khi T019 xanh: app mới đã có cache schema giống Directus.
3. Phase 3 (US1) và Phase 4 (US2), làm song song.
4. **STOP and VALIDATE**:
   - `sync.test.ts`, `permissions-cache.test.ts`, `overview.test.ts` đạt trên Postgres;
   - `overview.test.ts` đạt trên MySQL và SQLite.
5. Đến đây đã chạy song song an toàn với Directus.

### Incremental Delivery

1. Setup + Foundational: cache schema trong một process, CI xanh.
2. + US1 + US2: đồng bộ hai chiều, schema giống hệt. Đây là MVP.
3. + US3: chứng minh cơ chế dựng một lần, chờ và thử lại.
4. + US4: chứng minh cấu hình, namespace, hành vi khi Redis mất.
5. + Polish: gỡ D-20, D-22, cổng benchmark OAS, đóng feature.

---

## Notes

- [P] = khác file, không phụ thuộc task chưa xong.
- Test đối chiếu so kết quả tính toán của hai app phải gọi `flushSharedCaches()` giữa hai lần chụp. Nếu không, app
  mới đọc giá trị Directus vừa ghi và che lỗi của chính nó (plan, Rủi ro).
- Các cặp profile có sẵn dùng chung bus và khóa mặc định với cặp chính. Test chạy tuần tự để chỉ app được gửi request
  mới dựng schema.
- Test blackbox `schema-cache.test.ts` và `cache-purge.test.ts` của Directus copy ở feature 006 và 004 (research
  R10).
- US1.5 (không Redis) chỉ có unit test ở 002 (T025). Test đối chiếu tương ứng là ca `REDIS_ENABLED=false` của
  blackbox `schema-cache.test.ts`, copy ở 006.

## Ghi chú khi làm (2026-10-10)

- T022: Directus còn ghi key `permissions:policies-ip-access-*` từ khóa của cache response (`utils/get-cache-key.ts`,
  D-11, feature 005); test bỏ key này khỏi phép so. Các key `policies`, `raw-permissions` bằng nhau sâu ở hai bên.
- T021, T022: Directus trả GET từ cache response (`CACHE_ENABLED=true` trong env đối chiếu, D-11), và
  `schemaChanged` không xóa cache response trên Redis; helper `oasComponent` và `flushSharedCaches` xóa nó trước khi đọc.
- T027: field thêm từng cái qua `POST /fields` (tạo collection kèm nhiều field một lần bị Directus từ chối).
- T030: thêm `schema` vào glob của `FULL_FILES` thay vì liệt kê file.
- T035: các ca FR-024 nằm ở `tests/parity/src/schema/redis-down.test.ts` và chạy trên cặp `cache-config`, với
  `CACHE_ENABLED=false` trong `env/profile-cache-config.env`: cache response của Directus đọc Redis và treo khi Redis
  mất, che hành vi cần so. `redis-down.test.ts` có sẵn chỉ kiểm khởi động trên host nên không sửa.
- T034: `UNLINK`/`DEL` nhiều key được tách từng key, `SCAN` lấy mẫu `MATCH`, vì thứ tự và con trỏ phụ thuộc trạng thái.
- T038 làm cùng T044: gỡ D-20, D-22 khỏi registry chỉ hợp lệ khi spec 002 đã `Done` (guard
  `accepted-differences.test.ts` nay bỏ qua mã đã được feature `Done` gỡ).
- Độ trễ đo ở local (Docker Desktop, Directus giả lập amd64): Directus → app mới 20–25 ms, app mới → Directus 57 ms;
  Redis mất với cache trống: cả hai trả `500` sau khoảng 12 s.
- T029: trên SQLite, bước tạo 3 bảng bị bỏ qua bằng SQL từ host không chạy (file DB thuộc container, runner Linux
  không ghi được); hành vi bỏ qua các bảng này kiểm trên Postgres và MySQL.
- T039: `/server/info` cũng so với `directus-noresponsecache`. Lần chạy CI đầu (run 38038497056) so với Directus của cặp
  chính (`CACHE_ENABLED=true`, trả GET từ cache response, D-11): 318 so với 355 req/s (thấp hơn 10,4%). Directus cấu
  hình mặc định không có cache response, đúng mốc "cấu hình mặc định" của SC-005 và SC-006 (001).
