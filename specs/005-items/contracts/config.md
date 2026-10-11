# Contract: biến môi trường (005)

Theo `apps/api/src/config/supported-variables.ts` (nhóm A, B, C của 001 contracts/config.md §5). Mặc định và kiểu từ
`directus/packages/env/src/constants/defaults.ts`, `directus-variables.ts`.

## 1. Chuyển từ nhóm C sang nhóm A

| Biến | Mặc định Directus | Kiểu | Dùng ở |
|------|-------------------|------|--------|
| `CACHE_STATUS_HEADER` | không có | string | middleware `cache` (tên header `HIT`/`MISS`) |
| `CACHE_VALUE_MAX_SIZE` | `false` | string (bytes) hoặc `false` | `respond` (§3f của cache.md) |
| `CACHE_SKIP_ALLOWED` | `false` | boolean | `shouldSkipCache` |
| `CACHE_CONTROL_S_MAXAGE` | `'0'` → `0` | number | `getCacheControlHeader` |
| `WEBSOCKETS_ENABLED` | `false` | boolean | điều kiện đăng ký cầu nối |
| `WEBSOCKETS_REST_ENABLED` | `true` | boolean | như trên |
| `WEBSOCKETS_GRAPHQL_ENABLED` | `true` | boolean | như trên |

Đã ở nhóm A từ trước: `CACHE_ENABLED`, `CACHE_TTL`, `CACHE_NAMESPACE`, `CACHE_STORE`, `CACHE_AUTO_PURGE`,
`CACHE_AUTO_PURGE_IGNORE_LIST`, `CACHE_SYSTEM_TTL`, `MAX_BATCH_MUTATION`, `PUBLIC_URL`.

## 2. Vẫn ở nhóm C

`WEBSOCKETS_REST_*` (`AUTH`, `PATH`, `CONN_LIMIT`, `HEARTBEAT_*`), `WEBSOCKETS_GRAPHQL_*`, `WEBSOCKETS_LOGS_*`,
`WEBSOCKETS_COLLAB_*` (Nguyên tắc XI), `EXPORT_BATCH_SIZE`, `IMPORT_EXPORT_NAMESPACE`, `MAX_IMPORT_*` (010),
`CACHE_SCHEMA_*` đã có ở 002.

## 3. Env của môi trường đối chiếu (không phải `.env` thật)

| File | Dòng thêm | Lý do |
|------|-----------|-------|
| `tests/parity/env/<vendor>.env` (mọi vendor) | `CACHE_SKIP_ALLOWED=true`, `CACHE_STATUS_HEADER=x-cache-status` | Clarifications, cache.md §8 |
| `env/profile-cache-mem.env`, `-mem-purge`, `-redis`, `-redis-purge` | research R5, gồm `CACHE_SKIP_ALLOWED=false` để ghi đè env vendor; `-redis` thêm `REDIS` trỏ `redis-cache`, `CACHE_VALUE_MAX_SIZE=1kb`, `WEBSOCKETS_ENABLED=true`, `WEBSOCKETS_REST_ENABLED=true` | bốn cấu hình của blackbox; R-10 |
| `env/profile-websocket.env` | `WEBSOCKETS_ENABLED=true`, `WEBSOCKETS_REST_ENABLED=true` | FR-045 |
| `env/profile-cache-config.env` | giữ `CACHE_ENABLED=false`, sửa ghi chú | `redis-down` của 002 |

SC-007: file `.env` thật của Directus không đổi; bảy biến ở §1 không còn trong cảnh báo khởi động.
