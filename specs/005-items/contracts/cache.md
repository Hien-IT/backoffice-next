# Contract: response cache (005)

Nguồn: `directus/api/src/middleware/cache.ts`, `middleware/respond.ts`, `utils/get-cache-key.ts`,
`utils/get-cache-headers.ts`, `utils/should-skip-cache.ts`, `utils/permissions-cacheable.ts`. Key và giá trị:
data-model.md §2.

## 1. Vị trí trong pipeline

`authenticate` → `schema` → `sanitizeQuery` → **`cache`** → router → handler → **`respond`**. Không có `requestCounter`
(telemetry, D-17).

## 2. Middleware `cache` (đọc)

| Bước | Điều kiện | Kết quả |
|------|-----------|---------|
| 1 | method khác `GET` (và không phải `/graphql`) | `next()` không header |
| 2 | `CACHE_ENABLED` khác `true` hoặc `getCache().cache` null | `next()` không header |
| 3 | `shouldSkipCache(req)` (§4) | header `<CACHE_STATUS_HEADER>: MISS` (nếu biến đặt), `next()` |
| 4 | tính key; lỗi đọc Redis | log `warn` `[cache] Couldn't read key <key>. <message>`; header `MISS`; `next()` |
| 5 | không có giá trị | header `MISS`; `next()` |
| 6 | có giá trị; lỗi đọc `__expires_at` | log `warn` `[cache] Couldn't read key <key>__expires_at. <message>`; header `MISS`; `next()` |
| 7 | có giá trị | `Cache-Control` = `getCacheControlHeader(req, exp - now, true, true)` (§5), `Vary: Origin, Cache-Control`, header `HIT`, `res.json(value)` `200`; route không chạy |

## 3. `respond` (ghi)

Lưu khi **tất cả** đúng:

| # | Điều kiện |
|---|-----------|
| a | `req.method` là `GET` (hoặc `originalUrl` bắt đầu `/graphql`, 011) |
| b | `originalUrl` không bắt đầu bằng `/auth` |
| c | `CACHE_ENABLED === true` và có cache dữ liệu |
| d | `!req.sanitizedQuery.export` |
| e | `res.locals.cache !== false` (`/server/health` đặt `false`) |
| f | `CACHE_VALUE_MAX_SIZE === false` hoặc `byteLength(JSON.stringify(payload)) <= parseBytes(CACHE_VALUE_MAX_SIZE)` |
| g | `permissionsCacheable(req.collection, ctx, req.accountability)`: không có `req.collection`, hoặc không permission `read` nào của collection đó (policy của accountability, `bypassDynamicVariableProcessing`) có filter chứa chuỗi bắt đầu `$NOW` |

Khi có `res.locals.cacheInstance` (007, assets): điều kiện chỉ còn e, cache instance, d, f. Lỗi ghi → log `warn`
`[cache] Couldn't set key <key>. <err>`, vẫn trả response.

## 4. `shouldSkipCache(req)`

`true` khi:

- (a) header `Referer` có và trỏ vào `<PUBLIC_URL>/admin`: nếu `PUBLIC_URL` tương đối (`/`), so path của Referer bắt
  đầu bằng path admin; nếu tuyệt đối, so chuỗi Referer bắt đầu bằng `<PUBLIC_URL>/admin`; **và** `checkAutoPurge()`:
  `CACHE_AUTO_PURGE === false`, hoặc pathname của `originalUrl` bắt đầu bằng `getEndpoint(c)` (`/items/<c>` hoặc
  `/<c bỏ directus_>`) của một `c` trong `CACHE_AUTO_PURGE_IGNORE_LIST`;
- (b) `CACHE_SKIP_ALLOWED` đúng và header `Cache-Control` của request chứa `no-store`.

## 5. Header `Cache-Control` (`getCacheControlHeader(req, ttl, globalCacheSettings, personalized)`)

| Thứ tự | Điều kiện | Giá trị |
|--------|-----------|---------|
| 1 | `shouldSkipCache(req)` | `no-store` |
| 2 | `ttl` undefined hoặc `< 0` | `no-cache` |
| 3 | `globalCacheSettings` và `CACHE_AUTO_PURGE === true` | `no-cache` |
| 4 | còn lại | `[public|private, ]max-age=<round(ttl/1000)>[, s-maxage=<CACHE_CONTROL_S_MAXAGE>]`: `public` khi `!accountability?.role`, `private` khi có role (chỉ khi `personalized`); `s-maxage` khi `globalCacheSettings` và `CACHE_CONTROL_S_MAXAGE` là số nguyên `>= 0` (mặc định `0` → luôn có `s-maxage=0`) |

`respond` không lưu và không có `cacheTTL` → `no-cache`. Luôn `Vary: Origin, Cache-Control`.

Ví dụ với `CACHE_TTL=5m`, `CACHE_AUTO_PURGE=false`, mặc định `CACHE_CONTROL_S_MAXAGE`:

| Request | Lưu | `Cache-Control` | `x-cache-status` (khi đặt) |
|---------|-----|-----------------|----------------------------|
| `GET /items/a` public, lần 1 | có | `public, max-age=300, s-maxage=0` | `MISS` |
| cùng request lần 2 (còn 250 s) | — | `public, max-age=250, s-maxage=0` | `HIT` |
| `GET /items/a` user có role | có | `private, max-age=300, s-maxage=0` | `MISS` |
| `GET /items/a?export=csv` | không | `no-cache` | `MISS` |
| `GET /items/a` với `Cache-Control: no-store`, `CACHE_SKIP_ALLOWED=true` | có (không đọc) | `no-store` | `MISS` |
| `GET /items/a` với Referer `<PUBLIC_URL>/admin/...` (skip theo §4a) | có (không đọc) | `no-store` | `MISS` |
| `GET /items/a` quyền đọc có `$NOW` | không | `no-cache` | `MISS` |
| `GET /server/health` | không | `no-cache` | `MISS` |
| `POST /items/a` | không | `no-cache` | (không header) |
| `CACHE_AUTO_PURGE=true`, `GET /items/a` lần 1 | có | `no-cache` | `MISS` |
| `CACHE_AUTO_PURGE=true`, lần 2 | — | `no-cache` | `HIT` |

## 6. Xóa cache

Không đổi so với 004 (FR-082, FR-083, FR-084): `shouldClearCache(cache, opts, collection)` sau mỗi thao tác ghi của
`ItemsService` → `cache.clear()`; `clearSystemCache` không xóa cache dữ liệu; store `memory` xóa ở instance khác qua
`schemaChanged` với `autoPurgeCache`.

## 7. Redis không dùng được (FR-016)

`cache.get` ném → bước 4 hoặc 6 của §2 (`MISS`); `cache.set` ném → §3 (log, vẫn trả). Thời gian chờ do ioredis (cùng
cấu hình với Directus); ca đo ở `redis-down.test.ts` với cặp `cache-redis` (research R9).

## 8. Bộ đối chiếu (Clarifications, FR-043)

Cặp chính: `CACHE_SKIP_ALLOWED=true`, `CACHE_STATUS_HEADER=x-cache-status`; bộ so sánh gửi `Cache-Control: no-store`
với mọi `GET`, `HEAD` → hai app trả `no-store`, `MISS`; header `cache-control`, `vary`, `x-cache-status` được so. Bốn
cặp cache (research R5) không đặt `CACHE_SKIP_ALLOWED` và nhận request không header.
