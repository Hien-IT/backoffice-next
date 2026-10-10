# Implementation Plan: Schema overview và cache dùng chung

**Branch**: `002-schema-overview-cache` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-schema-overview-cache/spec.md`

## Summary

App mới giữ SchemaOverview trong bộ nhớ từng process và phối hợp với Directus 11.17.4 qua Redis dùng chung, giống
hệt Directus (Q1 = A):

- khóa `schemaCache--preparing` để chỉ một process dựng schema;
- message `schemaCache--done` mang nguyên schema;
- tín hiệu `schemaChanged` để xóa cache trên mọi instance;
- permissions cache hai lớp (local + Redis) với kênh `multi-cache` (Q4 = A).

Cách làm:

- Port `directus/packages/memory` (bus, kv, cache) thành `@backoffice/memory`.
- Port phần còn thiếu của `cache.ts`, `bus`, `lock`, `getSchema`, `middleware/schema.ts`, `permissions/cache.ts`,
  `with-cache.ts`.
- Đưa bước `schema` vào mọi request như Directus, trừ `/server/health` (D-13).

Phần dựng SchemaOverview từ DB đã có ở 001 và giữ nguyên. Chiều "app mới đổi schema" kiểm bằng cách gọi
`clearSystemCache()` trong container app mới (Q2 = A).

Test đối chiếu mới:

- lấy SchemaOverview của mỗi app qua bus và so sánh;
- đồng bộ hai chiều với hai instance app mới;
- đếm số lần dựng schema;
- so giá trị permissions cache;
- dùng `MONITOR` để chứng minh app mới không tạo key hay kênh lạ.

Benchmark `/server/specs/oas` trở lại làm cổng chặn CI (gỡ D-22).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (bộ cờ strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS, ESM, pnpm
10.27.0, Nx 23.3. Giữ nguyên như feature 001.

**Primary Dependencies**:
- Đã có, cùng bản Directus: ioredis 5.8.2, keyv 5.5.3, @keyv/redis 3.0.1, lodash-es 4.18.1, knex 3.1.0, NestJS 12.1
  (Express 5.2).
- Thêm vào catalog, cùng bản Directus 11.17.4 (`directus/pnpm-workspace.yaml`): `lru-cache` 11.2.2,
  `@sesamecare-oss/redlock` 1.4.0 (dependency của `@backoffice/memory`).
- Chưa cần `snappy` 7.3.3: `setCacheValue` và `getCacheValue` chưa có nơi gọi (research R3).
- Không dùng Joi hay Zod: feature này không nhận payload (research R14).

**Storage**:
- DB dùng chung, chỉ SELECT: catalog, `directus_collections`, `directus_fields`, `directus_relations`,
  `directus_access`, `directus_policies`, `directus_permissions`.
- Redis dùng chung với Directus: khóa, bus, permissions cache, Keyv system/lock/deployment cache
  ([contracts/redis.md](./contracts/redis.md)).
- Schema trong bộ nhớ process.

**Testing**:
- Vitest 3.2.4: unit test của `@backoffice/memory` (test gốc Directus, bus và kv local; phần Redis mock ioredis như
  test gốc), `@backoffice/utils`, `apps/api`.
- `tests/parity` (Docker Compose, Postgres full; MySQL và SQLite reduced): thêm `src/schema/*.test.ts`, profile
  `multi` (instance app mới thứ hai) và `cache-config` (namespace riêng).
- `tests/benchmark` (autocannon): OAS so với Directus `CACHE_ENABLED=false`.

**Target Platform**: Container Linux `node:22-alpine`, nhiều replica cạnh Directus, sau load balancer. Giữ như 001.

**Project Type**: Monorepo web (Nx). Feature này chỉ chạm BE: `apps/api`, `libs/memory` mới, `libs/utils`,
`tests/parity`, `tests/benchmark`.

**Performance Goals**:
- SC-001: thay đổi schema ở một bên có hiệu lực ở bên kia sau tối đa 1 giây.
- SC-003: mỗi process dựng tối đa 1 lần cho mỗi lần cache bị xóa.
- SC-005: p95 và req/s của `/server/specs/oas` không tệ hơn Directus (`CACHE_ENABLED=false`, cache schema mặc định)
  quá 10%, và là cổng chặn CI.
- `/server/ping`, `/server/health`, `/server/info` giữ ngưỡng 10% của 001. `/server/info` nay chịu thêm chi phí
  `cloneDeep` schema mỗi request; Directus cũng vậy.

**Constraints**:
- Không ghi DB. Chạy được với tài khoản chỉ SELECT.
- Không tạo key hay kênh Redis ngoài danh sách Directus dùng (FR-033).
- Giá trị permissions cache phải bằng nhau sâu với giá trị Directus ghi.
- Không thêm biến `BACKOFFICE_*`. Không thêm route.

**Scale/Scope**:
- Thiết kế cho nhiều replica ngang hàng cạnh nhiều instance Directus.
- Schema được gửi qua bus (gzip) ở mỗi lần dựng.
- 1 lib mới, khoảng 12 file port trong `apps/api`, 6 file test đối chiếu mới, 2 profile compose mới.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.2.0. Kiểm lần 1 trước research, không có vi phạm chưa giải thích.
Kết quả dưới đây là lần 2, sau khi có research, data model và contracts.

- [x] **I. Directus chỉ đọc**: PASS.
  - Không sửa `directus/`.
  - Mọi file port ghi `// Ported from directus/...` (bảng ánh xạ bên dưới).
  - Chỗ thêm so với nguồn (`disconnect()` của bus và multi cache, research R6) ghi `Backoffice:` trong comment.
- [x] **II. Dùng chung DB**: PASS.
  - Chỉ SELECT (data-model §1).
  - `readonly-account.test.ts` và `db-unchanged.test.ts` chạy lại với bước `schema`.
  - Thay đổi DB trong test đồng bộ là do Directus hoặc SQL của test tạo, và được dọn sau test (research R11).
- [x] **III. API giống hệt**: PASS.
  - Không thêm hay đổi route.
  - Bước `schema` đặt đúng vị trí của Directus, nên lỗi `500` khi không dựng được schema giống Directus.
  - D-13 thu hẹp còn `/server/health` (contracts/request-pipeline.md).
- [x] **IV. Chạy song song an toàn**: PASS.
  - Cùng khóa, kênh, namespace, key và định dạng message (contracts/redis.md).
  - Schema do bên này dựng dùng được ở bên kia.
  - Thay đổi schema hoặc quyền ở một bên làm bên kia xóa cache.
  - Cache schema trong process không phải state quan trọng: nó được dựng lại từ DB và xóa qua bus, giống Directus,
    đúng Nguyên tắc VII của constitution 1.2.0.
- [x] **V. Kiểm thử đối chiếu**: PASS.
  - 6 file test mới (research R10) và sửa `redis-down.test.ts`, test D-13.
  - Benchmark OAS chặn CI.
  - `overview.test.ts` vào bộ reduced (MySQL, SQLite mỗi lần push).
  - Bộ blackbox `schema-cache.test.ts` và `cache-purge.test.ts` cần `/fields`, `/utils/cache/clear` và đăng nhập,
    nên copy ở 006 và 004 (research R10).
- [x] **VI. Kiến trúc**: PASS.
  - Lib `@backoffice/memory` port từ package cùng tên.
  - Hạ tầng giữ dạng hàm như Directus và như 001 (`useBus`, `useLock`, `getCache`, `getSchema`).
  - Không thêm controller hay service Nest vì không có endpoint mới.
  - Knex, không ORM. Mỗi thay đổi có test.
- [x] **VII. Đa instance**: PASS theo constitution 1.2.0: schema và lớp local của permissions cache nằm trong bộ
  nhớ process, được dựng lại từ DB/Redis và xóa qua bus Redis, giống Directus. Ngoại lệ còn lại (bus và khóa local
  khi không có Redis) ghi ở Complexity Tracking.
  - Khởi động không ghi gì.
  - Kết nối bus và permissions cache đóng khi SIGTERM (research R6).
  - Không cấu hình Redis thì bus và khóa chỉ trong process; cảnh báo một instance từ 001 vẫn ghi.
- [x] **VIII. Biến môi trường**: PASS.
  - 10 biến chuyển sang "hỗ trợ" ([contracts/config.md](./contracts/config.md)).
  - Mặc định lấy từ `@backoffice/env` và giá trị dự phòng của Directus.
  - Không có biến mới.
- [x] **IX. Đổi thương hiệu**: PASS. Giữ nguyên `directus:bus`, `directus:lock`, `system-cache`, `permissions`,
  `schemaCache--preparing`, `schemaCache--done`, `schemaChanged`, `multi-cache`, `system-cache-lock`. Message lỗi và
  log của các phần port không nhắc "Directus".
- [x] **X. Chất lượng và vận hành**: PASS.
  - Coverage 80% cho `apps/api`, `libs/memory`, `libs/utils`.
  - Benchmark OAS trở lại chặn CI, nên dòng Complexity Tracking về D-22 của 001 hết hiệu lực.
  - Log giống Directus: tiền tố `[system-cache]`... (gỡ D-20), `trace` khi chờ schema.
  - Mọi khác biệt đã ghi ở spec.
- [x] **XI. Ngoài phạm vi**: PASS. Không đăng ký kênh bus của flows, extensions, websocket, logs. Không port
  `limiter` của gói memory. `deploymentCache` chỉ được tạo, không dùng.

## Project Structure

### Documentation (this feature)

```text
specs/002-schema-overview-cache/
├── plan.md              # File này
├── research.md          # Phase 0: R1–R14
├── data-model.md        # Phase 1: bảng đọc, SchemaOverview, trạng thái process, dữ liệu Redis
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── redis.md              # khóa, kênh, key, mã hóa, nén, TTL: hợp đồng với Directus
│   ├── schema-overview.md    # quy tắc dựng và quy tắc so sánh SchemaOverview
│   ├── request-pipeline.md   # thứ tự middleware, route có dựng schema, lỗi
│   └── config.md             # biến CACHE_*, REDIS_*_NAMESPACE
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

Chỉ liệt kê phần thêm hoặc sửa. Cấu trúc chung giữ như plan 001.

```text
backoffice-next/
├── pnpm-workspace.yaml                    # catalog: lru-cache 11.2.2, @sesamecare-oss/redlock 1.4.0
├── libs/
│   ├── memory/                            # MỚI @backoffice/memory ← directus/packages/memory/src (bỏ limiter)
│   │   └── src/{index.ts, bus/**, kv/**, cache/**, utils/**}   # kèm *.test.ts gốc
│   └── utils/src/
│       ├── shared/get-simple-hash.ts      # ← packages/utils/shared/get-simple-hash.ts (+ test)
│       └── node/process-id.ts             # ← packages/utils/node/process-id.ts (+ test)
├── apps/api/src/
│   ├── bus/{index.ts, lib/use-bus.ts}     # MỚI ← api/src/bus
│   ├── lock/{index.ts, lib/use-lock.ts}   # MỚI ← api/src/lock
│   ├── cache.ts                           # SỬA: đủ 5 instance, clearSystemCache, schemaChanged, memory schema cache
│   ├── app.ts                             # SỬA: đăng ký schemaChanged trước khi nhận request (R4)
│   ├── app-pipeline.ts                    # SỬA: thêm bước schema và cache sau publicAccountability
│   ├── middleware/schema.ts               # MỚI ← api/src/middleware/schema.ts (+ bỏ qua /server/health)
│   ├── middleware/cache.ts                # MỚI ← api/src/middleware/cache.ts (chỉ getCache(), 005 làm tiếp)
│   ├── schema/get-database-schema.ts      # SỬA: getSchema đầy đủ (lock, bus, retry, bypassCache)
│   ├── utils/freeze-schema.ts             # MỚI ← api/src/utils/freeze-schema.ts
│   ├── controllers/server.controller.ts   # SỬA: dùng req.schema
│   ├── services/settings.service.ts       # SỬA: dùng schema được truyền vào
│   ├── services/server.service.ts         # SỬA: nhận schema qua options
│   ├── permissions/cache.ts               # MỚI ← api/src/permissions/cache.ts
│   ├── permissions/utils/with-cache.ts    # MỚI ← api/src/permissions/utils/with-cache.ts
│   ├── permissions/utils/fetch-raw-permissions.ts  # MỚI: tách từ lib/fetch-permissions.ts, có withCache
│   ├── permissions/lib/fetch-permissions.ts        # SỬA: gọi fetchRawPermissions như Directus
│   ├── permissions/lib/fetch-policies.ts           # SỬA: bọc withCache('policies')
│   └── config/supported-variables.ts      # SỬA: thêm 10 biến (contracts/config.md)
├── tests/parity/
│   ├── docker-compose.yml                 # SỬA: backoffice-api-2 (profile multi, 8157), cặp cache-config
│   ├── env/profile-cache-config.env       # MỚI: namespace riêng, CACHE_SCHEMA_SYNC_TIMEOUT=1000
│   ├── accepted-differences.ts            # SỬA: xóa D-20, D-22; D-13 chỉ còn GET /server/health
│   ├── scripts/env.mjs                    # SỬA: thêm profile multi, cache-config
│   ├── package.json                       # SỬA: thêm ioredis
│   ├── README.md                          # SỬA: profile mới, helper Redis, src/schema/
│   └── src/
│       ├── config.ts, global-setup.ts     # SỬA: cổng và URL của profile multi, cache-config
│       ├── directus-api.ts                # SỬA: directusRequest nhận baseUrl
│       ├── server/health.test.ts          # SỬA: ca DB tắt so thêm /server/info, path lạ (D-13 thu hẹp)
│       ├── suite.ts                       # SỬA: thêm src/schema/** vào full, overview vào reduced
│       ├── redis.ts                       # MỚI: client Redis của test, decode message, flushSharedCaches, MONITOR
│       ├── redis-down.test.ts             # SỬA: làm ấm cache, FR-024, log tiền tố cache (D-20)
│       ├── startup/cache-schema.test.ts   # MỚI: CACHE_SCHEMA=false, CACHE_SCHEMA_FREEZE_ENABLED=true (US4)
│       └── schema/
│           ├── fixture.ts                 # tạo và xóa schema mẫu qua API Directus (US2)
│           ├── capture.ts                 # bắt SchemaOverview qua schemaCache--done (R9)
│           ├── clear-system-cache.ts      # docker compose exec … clearSystemCache() (R8)
│           ├── overview.test.ts           # US2, FR-008, FR-012, FR-040
│           ├── sync.test.ts               # US1, SC-001
│           ├── build-once.test.ts         # US3, SC-003
│           ├── permissions-cache.test.ts  # FR-019 (D-22)
│           └── redis-trace.test.ts        # US4, SC-004, FR-033
├── tests/benchmark/
│   ├── docker-compose.yml                 # SỬA: directus-noresponsecache (CACHE_ENABLED=false, schema cache mặc định)
│   └── src/run.ts                         # SỬA: OAS chặn CI
└── .github/workflows/ci.yml               # SỬA: job parity Postgres bật profile multi, cache-config
```

**Structure Decision**:
- Theo cấu trúc 001: package Directus thành lib cùng tên dưới `libs/`, file của `directus/api/src` vào cùng đường
  dẫn trong `apps/api/src`.
- Ngoại lệ có sẵn từ 001: `getSchema` vẫn nằm trong `apps/api/src/schema/get-database-schema.ts` cạnh
  `getDatabaseSchema`, để không đổi import của các file đã có.
- Test đối chiếu mới đặt trong `tests/parity/src/schema/`.

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/`) | Đích | Ghi chú |
|---------------------|------|---------|
| `packages/memory/src/{index,bus,kv,cache,utils}/**` | `libs/memory/src/**` | Nguyên vẹn, kèm test. Bỏ `limiter/`. Thêm `disconnect()` (R6) |
| `packages/utils/shared/get-simple-hash.ts` | `libs/utils/src/shared/get-simple-hash.ts` | Nguyên vẹn |
| `packages/utils/node/process-id.ts` | `libs/utils/src/node/process-id.ts` | Nguyên vẹn |
| `api/src/bus/**`, `api/src/lock/**` | `apps/api/src/bus/**`, `apps/api/src/lock/**` | Nguyên vẹn |
| `api/src/cache.ts` | `apps/api/src/cache.ts` | Thêm phần 002 (R3). Chưa port `flushCaches`, `setCacheValue`... |
| `api/src/utils/get-schema.ts` (`getSchema`) | `apps/api/src/schema/get-database-schema.ts` | `getDatabaseSchema` đã port ở 001 |
| `api/src/utils/freeze-schema.ts` | `apps/api/src/utils/freeze-schema.ts` | Nguyên vẹn |
| `api/src/middleware/schema.ts` | `apps/api/src/middleware/schema.ts` | Thêm bỏ qua `/server/health` (D-13) |
| `api/src/middleware/cache.ts` | `apps/api/src/middleware/cache.ts` | Chỉ `getCache()` (D-11, 005) |
| `api/src/permissions/cache.ts`, `utils/with-cache.ts` | cùng đường dẫn trong `apps/api/src` | Nguyên vẹn |
| `api/src/permissions/utils/fetch-raw-permissions.ts` | `apps/api/src/permissions/utils/fetch-raw-permissions.ts` | `PermissionsService` thay bằng knex như 001. Chưa có `withAppMinimalPermissions` (R5) |

### Phần port rút gọn tạm thời

| Phần | Ở feature 002 | Thay ở |
|------|---------------|--------|
| `middleware/cache.ts` | Chỉ gọi `getCache()` | 005 |
| `cache.ts` | Không có `flushCaches`, `set/getSystemCache`, `set/getCacheValue*` | 005, 006 |
| Permissions cache | Chỉ `policies`, `raw-permissions` (đường OAS public) | 004 |
| `fetchRawPermissions` | Đọc bằng knex, không có `withAppMinimalPermissions` | 004 |
| Đổi schema từ app mới | Chỉ `clearSystemCache()` gọi trong process (test) | 006 (`/fields`...), 010 (`/utils/cache/clear`) |
| SchemaOverview, accountability, settings | Như bảng tương ứng của plan 001, trừ dòng SchemaOverview (đã thay ở 002) | 003, 005 |

## Complexity Tracking

| Vi phạm | Vì sao cần | Phương án đơn giản hơn bị loại vì |
|---------|------------|-----------------------------------|
| Nguyên tắc VII (1.2.0: "KHÔNG dùng cache hay lock trong bộ nhớ process làm nguồn dữ liệu duy nhất") bị lệch khi không cấu hình Redis: bus và khóa dựng schema chạy local trong process (`createBus({ type: 'local' })`, `createKv({ type: 'local' })`), giống Directus | Nguyên tắc VIII: cấu hình một instance không có Redis của Directus phải chạy được ngay. Cùng trường hợp với dòng 8 Complexity Tracking của 001 (store `memory`, cảnh báo một instance) | Dừng khi không có Redis (bị loại: lệch Directus, hỏng cấu hình một instance đang chạy). Cần tech lead duyệt (Nguyên tắc X) |

Tech lead đã duyệt dòng trên và constitution 1.2.0 ngày 2026-10-10 (chủ dự án xác nhận; quy trình không có PR).

Cache schema trong process và lớp local của permissions cache không còn là vi phạm: constitution 1.2.0 (sửa
Nguyên tắc VII ngày 2026-10-10) cho phép cache trong process khi nó được dựng lại từ DB hoặc Redis và bị xóa qua
bus Redis trên mọi instance.

Dòng "Nguyên tắc X (benchmark ≤ 10% là cổng chặn) được nới cho `/server/specs/oas` tới feature 002 (D-22)" ở
Complexity Tracking của plan 001 hết hiệu lực khi feature này xong.

Rủi ro đã biết (không phải vi phạm), theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| Giá trị permissions cache app mới ghi (đọc bằng knex) khác giá trị Directus ghi (đọc bằng `ItemsService`) về kiểu, `null`, thứ tự | Directus đọc giá trị của app mới và cho kết quả quyền khác | `permissions-cache.test.ts` so key và giá trị hai bên trên mọi vendor của bộ full. Lệch thì sửa phần đọc, không chuẩn hóa trong test |
| Test so kết quả bị che: app mới đọc cache hoặc schema Directus vừa ghi | Lỗi tính toán của app mới không lộ ra | `flushSharedCaches()` giữa hai lần chụp. Test dùng chéo tách riêng (R9, R10) |
| Cặp profile có sẵn dùng chung bus và khóa mặc định | Một process ngoài ý muốn dựng schema trong lúc test đếm | Test chạy tuần tự; healthcheck chỉ gọi `/server/ping`; test đếm build ghi rõ process nguồn qua IP trong `MONITOR` khi cần |
| `PUBLISH schemaChanged` không await | Request gửi sát ngay sau response có thể còn thấy schema cũ | Đúng như Directus. SC-001 đo từ 1 giây sau response |
| p95 OAS chưa đo sau khi có cache (R12) | Cổng benchmark có thể đỏ | Đo sớm trong tasks. Nếu vượt, tìm nguyên nhân trước khi xin nới |
| Redis mất làm request chờ khoảng 10 s rồi mới `500` (mặc định ioredis, [Suy luận]) | Probe hoặc client timeout sớm hơn | Giống Directus (FR-024). `/server/health` không dựng schema nên probe không bị ảnh hưởng |
| `KEYS` trong `clear()` của `@keyv/redis` chặn Redis khi nhiều key | Chậm Redis lúc xóa cache hệ thống | Giống Directus, cùng bản thư viện. Không đổi |
