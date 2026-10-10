# Research: Schema overview và cache dùng chung

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-10

Mọi dữ kiện về Directus dưới đây đọc từ mã nguồn trong `directus/` (api 35.2.0, `@directus/memory` 3.1.8) và từ
`keyv` 5.5.3, `@keyv/serialize` 1.1.1, `@keyv/redis` 3.0.1 đã cài trong `node_modules/.pnpm`. Chỗ nào là suy luận
hoặc chưa kiểm chứng thì ghi [Suy luận] hoặc [Chưa kiểm chứng].

## R1. Port `directus/packages/memory` thành `@backoffice/memory`

- **Decision**: Port `bus/`, `kv/`, `cache/`, `utils/` của `directus/packages/memory/src` sang `libs/memory/src`
  (package `@backoffice/memory`), giữ nguyên cấu trúc file và test gốc. Không port `limiter/` (chưa có nơi dùng;
  rate limiter của API dùng thẳng `rate-limiter-flexible` từ feature 001). Thêm vào `@backoffice/utils` hai hàm
  mà gói này và permissions cache cần: `getSimpleHash` (`packages/utils/shared/get-simple-hash.ts`) và
  `processId` (`packages/utils/node/process-id.ts`). Thêm vào catalog đúng bản Directus dùng: `lru-cache` 11.2.2,
  `@sesamecare-oss/redlock` 1.4.0 (`kv/lib/redis.ts` import ở đầu file; `acquireLock` chưa có nơi gọi ở 002 nhưng
  giữ file nguyên vẹn, feature 009 cần khóa flow theo lịch).
- **Rationale**: Bus, khóa dựng schema và permissions cache của Directus đều đi qua gói này. Định dạng trên Redis
  là hợp đồng với Directus (contracts/redis.md): kênh `namespace:channel`, JSON UTF-8, gzip (`node:zlib`, mặc
  định) khi từ 1000 byte, nhận diện nén bằng 3 byte đầu `1f 8b 08` và độ dài ≥ 19, số nguyên ghi thẳng bằng
  `INCRBY`/`SET`. Port nguyên code là cách chắc nhất để giống từng byte.
- **Alternatives considered**: Tự viết bus và khóa gọn hơn trên ioredis (bị loại: dễ lệch ngưỡng nén, cách nhận
  diện nén, `UNLINK`/`DEL`, thứ tự key trong JSON). Dùng Keyv cho cả bus và khóa (bị loại: Directus không dùng
  Keyv cho các phần này, key sẽ khác).

## R2. Cache schema trong bộ nhớ process (Q1 = A)

- **Decision**: Port nguyên `getSchema` của `directus/api/src/utils/get-schema.ts:22-114` vào
  `apps/api/src/schema/get-database-schema.ts` (file của 001 đã chứa `getDatabaseSchema`), gồm tham số
  `database`, `bypassCache`, `attempt`; `MAX_ATTEMPTS = 3`; khóa `schemaCache--preparing` qua `useLock()`; message
  `schemaCache--done` qua `useBus()`; xóa khóa khi bộ đếm ≥ `CACHE_SCHEMA_MAX_ITERATIONS`; chờ tối đa
  `CACHE_SCHEMA_SYNC_TIMEOUT`; phát `{ schema }` và xóa khóa trong `finally`. Port
  `setMemorySchemaCache`/`getMemorySchemaCache` (`cache.ts:133-149`) và `utils/freeze-schema.ts`.
- **Rationale**: Clarify Q1 chốt làm đúng như Directus. Khi `CACHE_SCHEMA_FREEZE_ENABLED=false` (mặc định),
  `getMemorySchemaCache()` trả `cloneDeep` của schema ở mỗi lần gọi, tức mỗi request. Directus chịu cùng chi phí
  này, nên benchmark so sánh công bằng.
- **Alternatives considered**: Lưu schema trong Redis (Q1 = B, bị loại khi clarify). Bỏ `cloneDeep` để nhanh hơn
  (bị loại: code trong app có thể sửa schema nhận được; với freeze tắt, Directus cố ý trả bản sao).

## R3. `getCache()` đầy đủ, chỉ port hàm đã có nơi gọi

- **Decision**: Mở rộng `apps/api/src/cache.ts` theo `directus/api/src/cache.ts`:
  - `getCache()` tạo đủ 5 instance Keyv như Directus: `cache` (khi `CACHE_ENABLED`), `systemCache` (`_system`,
    `CACHE_SYSTEM_TTL`), `deploymentCache` (`_deployment`, `CACHE_DEPLOYMENT_TTL` hoặc 5000 ms), `localSchemaCache`
    (`_schema`, luôn memory), `lockCache` (`_lock`, không TTL). Mỗi instance log lỗi với tiền tố `[cache]`,
    `[system-cache]`, `[deployment-cache]`, `[schema-cache]`, `[lock-cache]` (gỡ D-20).
  - Port `clearSystemCache`, bộ nhận `schemaChanged`, `setMemorySchemaCache`, `getMemorySchemaCache`.
  - Chưa port `flushCaches` (nơi gọi đầu tiên là `schema/apply` của 006 và migration), `setSystemCache`,
    `getSystemCache`, `setCacheValue`, `getCacheValue`, `*WithExpiry`, `*WithTTL` (nơi gọi đầu tiên là cache
    response ở 005). Vì vậy chưa cần `snappy` 7.3.3 và `compressJSON`.
- **Rationale**: Keyv và `@keyv/redis` đã cùng bản Directus (001), nên key và cách xóa giống sẵn: key thật là
  `sets:namespace:<ns>:<ns>:<key>`, `clear()` chạy `KEYS sets:namespace:<ns>:*` rồi `UNLINK`, giá trị là JSON
  `{"value":…,"expires":…}` của `@keyv/serialize`. Mỗi instance Keyv dùng Redis mở một kết nối riêng, giống
  Directus.
- **Alternatives considered**: Port cả file `cache.ts` (bị loại: kéo theo `snappy` và hàm chưa ai gọi; theo cách
  của 001, phần còn lại port cùng nơi gọi đầu tiên).

## R4. Thời điểm đăng ký bus và thứ tự middleware

- **Decision**:
  - Directus đăng ký `schemaChanged` khi `cache.ts` được nạp (cấp module, chỉ khi `redisConfigAvailable()`). App
    mới đăng ký trong `createApp()` trước khi nhận request, cùng điều kiện, một lần mỗi process. Cách này giữ quy
    ước của 001 là không đọc env ở cấp module.
  - Thêm 2 bước vào `app-pipeline.ts`, ngay sau `publicAccountability` (vị trí `authenticate` của Directus) và
    trước `router-options`:
    1. `schema`: port `middleware/schema.ts`, gán `req.schema = await getSchema()`. Bỏ qua `/server/health` với
       mọi phương thức, khớp theo cùng quy tắc route của Express (không phân biệt hoa thường, cho phép `/` cuối),
       để giữ D-13 (FR-022).
    2. `cache`: port `middleware/cache.ts`, ở 002 chỉ còn dòng đầu `getCache()` rồi `next()`. Directus gọi
       `getCache()` ở đầu mọi request đi qua bước này, kể cả khi `CACHE_ENABLED=false`, nên thời điểm tạo
       instance Keyv và log lỗi Redis giống nhau. Phần cache response thêm ở 005.
  - `server.controller.ts` (OAS, info) và `SettingsService` dùng `req.schema` thay cho `getSchema()` (FR-023).
  - `/`, `/robots.txt`, `/server/ping` nằm trước bước `schema` ở cả hai app, nên không dựng schema.
- **Rationale**: Thứ tự trong `directus/api/src/app.ts:302-315`: ping, `authenticate`, `schema`,
  `sanitizeQuery`, `requestCounter`, `cache`, router. `sanitizeQuery` thuộc 005 (D-12); `requestCounter` ngoài phạm
  vi từ 001.
- **Alternatives considered**: Bước `schema` thành Nest interceptor (bị loại: chạy sau router-options và 404 của
  Nest, lệch thứ tự Directus). Dựng schema cả cho `/server/health` (bị loại: 001 đã chốt D-13 là khác biệt lâu
  dài; probe phải phản ánh đúng trạng thái DB).

## R5. Permissions cache dùng chung (Q4 = A)

- **Decision**:
  - Port `permissions/cache.ts` và `permissions/utils/with-cache.ts`.
    - Có Redis: cache `multi`, gồm local LRU tối đa 100 key và Redis namespace `REDIS_PERMISSIONS_NAMESPACE`
      (mặc định `permissions`), TTL `CACHE_SYSTEM_TTL` nếu có. Kênh xóa là `<ns>:multi-cache`.
    - Không có Redis: local tối đa 500 key.
  - Tách `apps/api/src/permissions/lib/fetch-permissions.ts` của 001 thành hai file như Directus:
    - `utils/fetch-raw-permissions.ts`: `withCache('raw-permissions', …)` với đúng `prepareArg` của Directus. Thân
      hàm vẫn đọc bằng knex như 001.
    - `lib/fetch-permissions.ts`: gọi `fetchRawPermissions({ ...options, bypassMinimalAppPermissions:
      options.bypassDynamicVariableProcessing ?? false })`.
  - Bọc `fetchPolicies` bằng `withCache('policies', …, ({ roles, user, ip }) => ({ roles, user, ip }))`.
  - Chưa port `withAppMinimalPermissions`. Ở 002 mọi request là public (`app: false`), và với `app: false` hàm
    này trả nguyên danh sách (`permissions/lib/with-app-minimal-permissions.ts`). Port ở 003/004, khi có request
    `app: true`.
  - Các namespace khác (`roles-tree`, `global-access*`, `policies-ip-access`, `share-info`) port cùng nơi gọi đầu
    tiên (004).
- **Rationale**: Key là `namespace-` cộng `getSimpleHash(JSON.stringify(args))`, nên đối số phải dựng giống từng
  trường và đúng thứ tự trường. Đường gọi OAS cho public của Directus tạo đúng 3 key:
  - `policies-<hash {roles:[],user:null,ip}>`
  - `raw-permissions-<hash {policies,action:'read',accountability:{app:false}}>`
  - `raw-permissions-<hash {policies,accountability:{app:false}}>`

  Hai app đọc giá trị của nhau, nên giá trị phải bằng nhau sâu (deep-equal). JSON không giữ khác biệt về thứ tự
  key, nhưng giữ khác biệt về kiểu (`1` khác `"1"`), về `null` khác `[]`, và về thứ tự phần tử mảng. Đây là rủi ro
  chính của feature, vì 001 đọc quyền bằng knex thay cho `ItemsService`. Có test riêng ở R10 để bắt lệch.
- **Alternatives considered**:
  - Chỉ phát và nhận lệnh xóa, không đọc ghi cache (Q4 = B, bị loại khi clarify).
  - Dùng namespace permissions riêng cho app mới (bị loại: trái Nguyên tắc IV; Directus sẽ không xóa được cache
    của app mới khi quyền đổi).

## R6. Đóng kết nối khi tắt máy

- **Decision**:
  - `BusRedis` tạo kết nối nhận bằng `redis.duplicate()`. Cache `multi` tạo thêm một bus riêng. Directus không đóng
    các kết nối này.
  - Bản port thêm `disconnect()` vào `BusRedis` và `CacheMulti`, có comment `Backoffice:`. App mới đăng ký
    `onServerShutdown` cho bus, permissions cache và các instance Keyv dùng Redis.
  - Kết nối gửi là `useRedis()`, đã đóng ở `onSignal` từ 001.
- **Rationale**: Nguyên tắc VII yêu cầu đóng kết nối Redis trước khi thoát. Đây là cách 001 đã làm với Keyv và
  rate limiter.
- **Alternatives considered**: Để terminus kết thúc process mà không đóng (bị loại: trái Nguyên tắc VII). Truy cập
  trường private `sub` từ bên ngoài (bị loại: phụ thuộc chi tiết nội bộ).

## R7. Biến môi trường

- **Decision**: Thêm vào `apps/api/src/config/supported-variables.ts`:
  - `CACHE_SCHEMA`, `CACHE_SCHEMA_MAX_ITERATIONS`, `CACHE_SCHEMA_SYNC_TIMEOUT`, `CACHE_SCHEMA_FREEZE_ENABLED`
  - `CACHE_SYSTEM_TTL`, `CACHE_DEPLOYMENT_TTL`, `CACHE_AUTO_PURGE`
  - `REDIS_BUS_NAMESPACE`, `REDIS_LOCK_NAMESPACE`, `REDIS_PERMISSIONS_NAMESPACE`

  Giá trị mặc định lấy từ `@backoffice/env` (port nguyên) hoặc giá trị dự phòng trong code Directus:
  - `?? 'directus:bus'`, `?? 'directus:lock'`, `?? 'permissions'`
  - TTL deployment `|| 5000`

  `CACHE_AUTO_PURGE_IGNORE_LIST`, `CACHE_CONTROL_S_MAXAGE`, `CACHE_STATUS_HEADER`, `CACHE_VALUE_MAX_SIZE`,
  `CACHE_SKIP_ALLOWED` vẫn chưa hỗ trợ (005).
- **Rationale**: Nguyên tắc VIII, FR-030, FR-032. `getConfigFromEnv('REDIS')` cũng đưa các biến
  `REDIS_*_NAMESPACE` vào tùy chọn ioredis. Directus làm y như vậy, nên giữ nguyên.

## R8. Đường "app mới đổi schema" ở 002 (Q2 = A)

- **Decision**: Test đối chiếu gọi `clearSystemCache()` bằng code thật của image app mới, không qua HTTP:

  ```text
  docker compose exec -T backoffice-api node --input-type=module -e "<import /directus/dist/cache.js, gọi
  clearSystemCache(), rồi quit kết nối Redis để lệnh PUBLISH được gửi đi>"
  ```

  Process này dùng đúng env của container. `clearSystemCache` phát `schemaChanged` mà không chờ, nên helper gọi
  `quit()` trên `useRedis()` (gửi QUIT sau các lệnh đang chờ) trước khi thoát.
- **Rationale**: Không mở route mới, không cần auth, và chạy đúng code sẽ chạy trong production. Từ feature 006,
  đường này được kiểm lại qua `/fields`.
- **Alternatives considered**: Port lệnh CLI `cache clear` của Directus (bị loại: chưa có khung CLI, ngoài phạm
  vi). Test gọi thẳng code TypeScript từ `tests/parity` (bị loại: kéo theo phụ thuộc chéo giữa project test và
  mã nguồn API, không chạy đúng bản build trong image).

## R9. Lấy SchemaOverview của Directus để so sánh

- **Decision**: Helper `tests/parity/src/schema/capture.ts` làm 5 bước:
  1. `UNLINK <lock-ns>:schemaCache--preparing`, phòng khóa cũ còn sót.
  2. `SUBSCRIBE <bus-ns>:schemaCache--done`.
  3. `PUBLISH <bus-ns>:schemaChanged {}` để mọi process xóa schema trong bộ nhớ.
  4. Gửi `GET /server/info` tới đúng app cần lấy schema.
  5. Nhận message đầu tiên sau đó, gunzip nếu có magic gzip, rồi `JSON.parse`.

  Làm lần lượt cho Directus rồi cho app mới, sau đó so sánh bằng `toStrictEqual`, kể cả thứ tự relation.

  Cùng helper kiểm chiều dùng chéo (FR-012):
  - Đặt bộ đếm khóa bằng 1 (giả một process đang dựng).
  - Gửi request tới app X. Nó nhận lượt 2 và chờ.
  - Phát lại nguyên byte message `schemaCache--done` đã bắt được từ app Y.
  - App X trả 200 với nội dung dựng từ schema đó. Sau đó xóa khóa.
- **Rationale**: Không cần endpoint debug. Test đi qua đúng đường bus mà hai app dùng khi chạy thật.
- **Alternatives considered**: Thêm endpoint trả SchemaOverview (bị loại: route mới, khác Directus). So qua OAS
  (bị loại: OAS chỉ chứa collection mà public đọc được, không chứa `dbType`, `special`, `validation`...).

## R10. Bộ test đối chiếu của feature

Thêm thư mục `tests/parity/src/schema/`:

| File | Kiểm | Suite |
|------|------|-------|
| `overview.test.ts` | FR-008, FR-040, SC-002: so SchemaOverview hai bên trên fixture đủ loại field (US2), và dùng chéo message (FR-012) | reduced và full (Postgres, MySQL, SQLite mỗi lần push) |
| `sync.test.ts` | US1, SC-001: Directus thêm, sửa, xóa field/collection/relation → cả hai instance app mới thấy sau 1 s; đổi DB + `clearSystemCache` trong app mới → Directus thấy sau 1 s; đổi quyền và `POST /utils/cache/clear` trên Directus → app mới thấy | full |
| `build-once.test.ts` | US3, SC-003: đếm message `schemaCache--done` khi 20 request đồng thời tới 3 process; trường hợp chờ, hết giờ, schema `null` | full |
| `permissions-cache.test.ts` | FR-019, gỡ D-22: xóa permissions cache → request OAS tới Directus → chụp key và giá trị dưới `permissions:*` → xóa → request OAS tới app mới → chụp → so bằng nhau | full |
| `redis-trace.test.ts` | US4, SC-004, FR-033: dùng Redis `MONITOR`, nhóm lệnh theo IP container, chuẩn hóa thành `<lệnh> <key hoặc kênh>`; tập lệnh của app mới phải là tập con của Directus. Chạy với cặp profile `cache-config`, có namespace tùy chỉnh | full |
| `startup/cache-schema.test.ts` | US4.1, US4.4: chạy API trên host (`run-api.ts`) với `CACHE_SCHEMA=false` (không lệnh `schemaCache--` nào) và `CACHE_SCHEMA_FREEZE_ENABLED=true` (route vẫn trả như Directus) | full |

Sửa test có sẵn:

- `redis-down.test.ts`: làm ấm cache trước các ca cũ. Thêm FR-024 với cache còn và cache trống: cả hai app trả
  `500`, chờ tối đa 60 s. Thêm kiểm log có tiền tố `[system-cache]`, `[deployment-cache]`, `[lock-cache]` (gỡ
  D-20).
- Các test DB tắt dùng D-13: `/metrics` và path lạ phải giống Directus. D-13 trong registry chỉ còn
  `GET /server/health`.

Hạ tầng:

- `docker-compose.yml` thêm `backoffice-api-2` (cổng 8157, profile `multi`) và cặp profile `cache-config` (env
  `profile-cache-config.env`: `CACHE_NAMESPACE`, `REDIS_BUS_NAMESPACE`, `REDIS_LOCK_NAMESPACE`,
  `REDIS_PERMISSIONS_NAMESPACE` riêng, và `CACHE_SCHEMA_SYNC_TIMEOUT=1000` để ca khóa kẹt chạy nhanh).
- CI chạy hai profile này trong job Postgres full.

Fixture schema của US2:

- Tạo qua API của Directus (`POST /collections` kèm `fields`, `POST /relations`) trong
  `tests/parity/src/schema/fixture.ts`, xóa ở `afterAll`. Directus tự xử lý khác biệt giữa vendor, nên không cần
  file snapshot và không cần `force` của `/schema/apply`.
- Kiểu field lấy theo danh sách của blackbox `directus/tests/blackbox`. Kiểu chỉ có ở một vendor đặt sau điều kiện
  vendor.

Cách ly giữa các test:

- Hai app dùng chung permissions cache và schema qua bus, nên test so kết quả tính toán phải xóa cache giữa hai lần
  chụp. Nếu không, app mới có thể đọc giá trị Directus đã ghi và che lỗi của chính nó.
- Helper `flushSharedCaches()` làm 3 việc: `PUBLISH <perm-ns>:multi-cache {"type":"clear","origin":"parity-test"}`,
  `UNLINK` các key `<perm-ns>:*`, và `PUBLISH <bus-ns>:schemaChanged {}`.

Các cặp profile có sẵn (ratelimit, cors-hsts, pressure, metrics):

- Chúng dùng chung bus và khóa mặc định với cặp chính (`directus:bus`, `directus:lock`), giống một cụm thật.
- Test chạy tuần tự, và healthcheck chỉ gọi `/server/ping`. [Suy luận] Vì vậy chỉ app được gửi request mới dựng
  schema. Nếu một process khác dựng cùng lúc, schema vẫn giống, vì cùng DB.

Test blackbox của Directus chưa dùng lại được ở feature này, vì cần `/fields`, `/utils/cache/clear` và đăng nhập:

- `tests/db/routes/collections/schema-cache.test.ts`: copy ở feature 006.
- `tests/db/routes/permissions/cache-purge.test.ts`: copy ở feature 004.

## R11. DB không đổi khi có test làm thay đổi schema

- **Decision**: Giữ cách đo của `db-unchanged.test.ts` (001): tắt Directus, chụp DB, chỉ app mới chạy, chụp lại.
  Test của feature này cho Directus ghi schema (field, collection, permission, và các dòng activity, revision do
  Directus ghi). Mỗi test dọn dữ liệu nó tạo trong `afterAll` và không nằm trong khoảng giữa hai lần chụp.
  `readonly-account.test.ts` chạy lại với bước `schema` để chứng minh việc dựng schema chỉ cần SELECT.
- **Rationale**: SC-006 nhằm chứng minh app mới không ghi DB. Dòng activity do Directus ghi không xóa sạch được, nên
  chụp toàn bộ trước và sau cả bộ test sẽ luôn lệch. Đã sửa câu chữ SC-006 cho khớp (spec, "Chỉnh khi lập plan").

## R12. Benchmark `/server/specs/oas` chặn CI (gỡ D-22)

- **Decision**: Trong `tests/benchmark`:
  - Container tham chiếu bỏ `CACHE_SCHEMA=false`, giữ `CACHE_ENABLED=false` để Directus không trả OAS từ cache
    response (D-11, 005). Đổi tên `directus-nocache` thành `directus-noresponsecache`.
  - `run.ts` bỏ `notBlocking` của OAS. `/server/info` cũng so với container này (chỉnh khi làm T039: Directus của
    cặp chính trả `/server/info` từ cache response).
  - Xóa dòng D-22 khỏi `accepted-differences.ts`. Dòng Complexity Tracking tương ứng của 001 hết hiệu lực.
- **Rationale**: SC-005 ("so với Directus cấu hình mặc định", mặc định `CACHE_ENABLED=false`). Hai bên cùng cache
  schema và permissions, cùng `cloneDeep` mỗi request.
- **Risk**: [Chưa kiểm chứng] Chưa đo p95 OAS sau khi có cache. Nếu vẫn vượt 10%, xử lý trong tasks (đo, tìm câu SQL
  thừa). Chỉ nới cổng khi tech lead duyệt.

## R13. Redis mất kết nối (FR-024)

- **Decision**: Không thêm xử lý riêng.
  - `useLock()` dùng `useRedis()` (ioredis tùy chọn mặc định).
  - Khi Redis mất, `INCRBY` nằm trong hàng đợi offline của ioredis và bị từ chối sau `maxRetriesPerRequest` (mặc
    định 20) lần kết nối lại.
  - Lỗi đi tới error handler và trả `500`.
  - Khi cache còn trong bộ nhớ, `getSchema` trả ngay, không chạm Redis.
- **Rationale**: Clarify câu 2 (Session 2026-10-10) chốt làm giống Directus.
- [Suy luận] Theo `retryStrategy` mặc định (`min(times * 50, 2000)` ms), 20 lần thử mất khoảng 10 s. Test chỉ kiểm
  status, có thời hạn 60 s, và không khẳng định thời gian.

## R14. Phạm vi kiểu dữ liệu, validate và NestJS

- **Validation**: Feature này không nhận payload nào, nên không dùng Joi hay Zod.
- **NestJS**: Không thêm controller, service hay provider mới. Hạ tầng (`useBus`, `useLock`, `getCache`,
  `getSchema`) giữ dạng hàm như Directus và như 001 (`useRedis`, `useEnv`). Bước `schema` là middleware Express trong
  pipeline (R4).
- **Coverage**: `libs/memory` mang theo test gốc của Directus. Phần thêm trong `apps/api` có unit test với
  `@backoffice/memory` chạy ở chế độ local. Phần Redis thật kiểm ở `tests/parity`.
