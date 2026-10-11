# Contract: port bộ blackbox, bộ đối chiếu, CI, E2E, benchmark (005)

Chi tiết quyết định: research R4 đến R6, R9, R11, R12.

## 1. Thư mục `tests/parity/src/items/`

```text
src/items/
├── crud.test.ts            # US1 qua scenario() + flow (R9)
├── export.test.ts          # FR-044
├── cache-blackbox.test.ts  # port cache.test.ts, cache-purge.test.ts trên bốn cặp (R5)
├── cache-cross.test.ts     # FR-042 dùng chéo
├── bus.test.ts             # FR-045
└── blackbox/               # port nguyên cấu trúc directus/tests/blackbox (R6)
    ├── vitest.blackbox.config.ts  (alias @common → ./common, sequencer seed-first, fileParallelism false)
    ├── 00-seed.test.ts            (user có static token qua Directus; seedDBStructure() của từng seed)
    ├── common/{config,functions,transport,get-dbs-to-test,seed-functions,types,variables}.ts
    └── tests/db/{routes/items/*.{test,seed}.ts, query/{index,filter/index}.ts, schema/**/index.ts}
```

## 2. Shim `@common`

| Hàm gốc | Shim |
|---------|------|
| `getUrl(vendor)` | URL của app đang thử trong cặp `blackbox`: `PARITY_BLACKBOX_APP` (`backoffice` mặc định, `directus`) → `BACKOFFICE_URL_BLACKBOX` / `DIRECTUS_URL_BLACKBOX` |
| (mới) `getSetupUrl()` | Directus của cặp `blackbox` |
| `config.envs[vendor]` | giá trị của `env/profile-blackbox.env` (`MAX_BATCH_MUTATION`...) |
| `CreateCollection`, `DeleteCollection`, `CreateField`, `DeleteField`, `CreateRelation`, `CreateFieldM2O`, `CreateFieldO2M`, `CreateFieldM2M`, `CreateFieldM2A` | gọi `getSetupUrl()` (D-09.4, 006) |
| `CreateItem`, `ReadItem`, `UpdateItem`, `CreateRole`, `CreateUser`, `CreatePolicy`, `CreatePermission`, `DeletePermission` | gọi app đang thử |
| `requestGraphQL(host, ...)` | bỏ `host`, gọi `getSetupUrl()` (D-09.9; 011 đổi về app đang thử) |
| `createWebSocketConn`, `createWebSocketGql` | không có; khối dùng chúng bị bỏ trong file test (ghi `// Backoffice:`) |
| `PRIMARY_KEY_TYPES` | `PARITY_BLACKBOX_PK_TYPES` (csv) hoặc đủ `integer,uuid,string` |
| `vendors` | `getDbsToTest()` của parity (một vendor) |
| `USER.*` | giữ nguyên hằng; `00-seed.test.ts` tạo user với đúng `token` qua Directus nếu chưa có |
| `DisableTestCachingSetup`, `EnableTestCaching`, `ClearCaches` | không làm gì (cặp chính `CACHE_AUTO_PURGE=true`; `/utils/cache/clear` thuộc 010) |
| (khi cần) `known-failures.ts` | ca fail trên chính Directus theo vendor: `{ vendor, file, name, run }`; là đường cơ sở của SC-001 (FR-040). Chưa tạo: lượt Directus trên Postgres đạt đủ |

## 3. Lượt chạy và suite

| `PARITY_SUITE` | File | Lượt | Dùng ở |
|----------------|------|------|--------|
| `full` | như cũ + `src/items/{crud,export}.test.ts` | 1 | job `parity` Postgres |
| `reduced` | như cũ + `src/items/crud.test.ts` | 1 | job `parity` MySQL, SQLite |
| `blackbox` | `src/items/blackbox/**` | 2: `PARITY_BLACKBOX_APP=backoffice` rồi `directus` (`parity.mjs` lặp) | job `parity-blackbox` (Postgres, đủ ba kiểu khóa); job `parity` MySQL, SQLite với `PARITY_BLACKBOX_PK_TYPES=integer` (rút gọn); `parity-matrix.yml` job `blackbox-full` cho MySQL, SQLite đủ (hằng tuần) |
| `cache` | `src/items/{cache-blackbox,cache-cross,cache-redis-down,bus}.test.ts` | 1 | job `parity-cache` (Postgres) với profile `cache-mem,cache-mem-purge,cache-redis,cache-redis-purge,websocket` |
| `matrix` | không đổi | | |

## 4. Bộ so sánh

- `parity.ts` `send()`: header mặc định `cache-control: no-store` cho `GET`, `HEAD` khi request chưa đặt.
- `COMPARED_HEADERS` thêm `x-cache-status`, `content-disposition`; chuẩn hóa `content-disposition` thay
  `\d{8}-\d{1,6}` bằng `<timestamp>`.
- `request-set.ts` thêm: `GET /items/<collection>` (admin, user, public), `?export=csv`, `?export=json`,
  `GET /items/<collection>/<pk>`, `SEARCH` không body, `OPTIONS` hai path, `/items/nope`, `/items/directus_users`.

## 5. Profile và cổng (docker-compose.yml, config.ts)

| Profile | Directus | Backoffice | Env riêng |
|---------|----------|------------|-----------|
| `cache-mem` | 9055 | 9056 | `profile-cache-mem.env` |
| `cache-mem-purge` | 9155 | 9156 | `profile-cache-mem-purge.env` |
| `cache-redis` | 9255 | 9256 | `profile-cache-redis.env` (+ `redis-cache` riêng để dừng trong `redis-down`, R9) |
| `cache-redis-purge` | 9355 | 9356 | `profile-cache-redis-purge.env` |
| `websocket` | 9455 | 9456 | `profile-websocket.env` |
| `blackbox` | 9555 | 9556 | `profile-blackbox.env`: env của `directus/tests/blackbox/common/config.ts` (`CACHE_ENABLED=false`, `MAX_BATCH_MUTATION=100`, `QUERY_LIMIT_DEFAULT=90`, `MAX_RELATIONAL_DEPTH=5`, `MAX_PAYLOAD_SIZE=10mb`) |

Fixture của bốn cặp `cache-*` tạo qua Directus của chính cặp đó. Cặp `blackbox` dùng chung Redis, bus, namespace với cặp chính. Cặp `websocket` dùng chung Redis, bus và namespace
với cặp chính, nên fixture tạo qua cặp nào cũng được.

## 6. CI (`.github/workflows`)

| Job | Vendor | Lệnh | Chặn `publish` |
|-----|--------|------|----------------|
| `parity` (sửa) | postgres `full`; mysql, sqlite3 `reduced` + `blackbox` rút gọn | như cũ; mysql, sqlite3 thêm profile `blackbox` và bước `parity-blackbox` với `PARITY_BLACKBOX_PK_TYPES=integer` | có |
| `parity-blackbox` (mới) | postgres | `env-up --vendor=postgres --profiles=blackbox`; `parity-blackbox` | có |
| `parity-cache` (mới) | postgres | `env-up --profiles=cache-mem,...,websocket`; `PARITY_SUITE=cache parity` | có |
| `e2e-directus-app` (sửa) | postgres | thêm `items.spec.ts` | có |
| `parity-matrix.yml` `blackbox-full` (mới) | mysql, sqlite3 | `PARITY_SUITE=blackbox` đủ ba kiểu khóa | không (xanh trước khi Done) |
| `benchmark.yml` `benchmark-items` (mới) | postgres | `benchmark:items` | không |

`tools/ci-local.sh` thêm ba bước tương ứng (không benchmark).

## 7. Playwright (`tests/directus-app-e2e/src/items.spec.ts`)

| Bước | Request mong đợi qua proxy | So |
|------|----------------------------|-----|
| tạo item ở `/admin/content/e2e_articles/+` | `POST /items/e2e_articles` → app mới | dòng `e2e_articles`, activity, revision |
| sửa | `PATCH /items/e2e_articles/<id>` | như trên |
| xóa một | `DELETE /items/e2e_articles/<id>` | |
| chọn hai item, xóa | `DELETE /items/e2e_articles` mảng | |
| sidebar Export → CSV → Download file | `GET /items/e2e_articles?export=csv&...&access_token=...` (download) | nội dung file sau khi bỏ `<timestamp>` trong tên |

`routing.spec.ts`: `/items/*` tới app mới; `proxy/backoffice-routes.txt` thêm `items`.

## 8. Benchmark (`tests/benchmark/src/{items,seed-items}.ts`)

| Mục | Giá trị |
|-----|---------|
| Dữ liệu | `bench_categories` 100 dòng; `bench_articles` 10.000.000 dòng (`generate_series`), index `status`, `category`, `date_created`; thêm 200.000 dòng cho `DELETE` (dải id riêng mỗi app) |
| Kịch bản | list có filter, sort, limit, m2o; by id; `POST`; `PATCH`; `DELETE`; × {admin, user filter quyền} |
| Chế độ | tươi (`Cache-Control: no-store`), `HIT` (lặp cùng `GET`, không header) |
| Đo | như `permissions.ts`: warm-up 5 s, `BENCH_ROUNDS` lượt xen kẽ, throughput 50 kết nối, p95 ở 80% req/s Directus, ngưỡng 10% (`compare.ts`) |
| Tham chiếu | Directus cặp chính (cache bật, `CACHE_SKIP_ALLOWED=true`) |
