# Contract: Dữ liệu dùng chung trên Redis

App mới và Directus 11.17.4 đọc ghi chung các key và kênh dưới đây. Mọi mục PHẢI giống Directus từng byte, trừ
chỗ ghi "chỉ cần bằng nhau sâu". Nguồn: `directus/packages/memory` 3.1.8, `directus/api/src/{cache.ts,bus,lock,
permissions/cache.ts,permissions/utils/with-cache.ts,utils/get-schema.ts}`, `keyv` 5.5.3, `@keyv/redis` 3.0.1.

## 1. Quy tắc mã hóa của `@backoffice/memory` (port `@directus/memory`)

| Mục | Quy tắc |
|-----|---------|
| Tên kênh hoặc key | `` `${namespace}:${key}` `` |
| Giá trị không phải số | `JSON.stringify`, rồi mã hóa UTF-8 (`TextEncoder`) |
| Nén | gzip của `node:zlib`, tùy chọn mặc định, khi độ dài ≥ `compressionMinSize` (mặc định 1000 byte). Bật mặc định |
| Nhận diện nén khi đọc | độ dài ≥ 19 và 3 byte đầu `1f 8b 08`, thì gunzip trước khi parse |
| Đọc | `TextDecoder`, rồi `parseJSON` của `@backoffice/utils`. Buffer rỗng cho ra `undefined` |
| Số (kv) | `SET key <số thập phân>`, không JSON, không nén. `increment` dùng `INCRBY`, không TTL |
| Xóa | `UNLINK`. `clear()` dùng `SCAN MATCH <ns>:*` rồi `UNLINK` theo lô |
| TTL (kv có `ttl`) | `SET … PX <ttl>` |

## 2. Dựng schema

| Mục | Giá trị |
|-----|---------|
| Khóa | `<REDIS_LOCK_NAMESPACE ?? 'directus:lock'>:schemaCache--preparing` |
| Lấy lượt | `INCRBY 1`. Lượt `1` dựng schema; lượt ≥ 2 chờ. Lượt ≥ `CACHE_SCHEMA_MAX_ITERATIONS` (100) thì `UNLINK` khóa |
| Kênh kết quả | `<REDIS_BUS_NAMESPACE ?? 'directus:bus'>:schemaCache--done` |
| Message | `{"schema":<SchemaOverview>}` hoặc `{"schema":null}` khi dựng lỗi. Thường vượt 1000 byte, nên được gzip |
| Thứ tự trong `finally` | `PUBLISH` kết quả (có await), rồi `UNLINK` khóa |
| Chờ | `SUBSCRIBE` khi bắt đầu chờ, `UNSUBSCRIBE` khi nhận được hoặc khi hết `CACHE_SCHEMA_SYNC_TIMEOUT` (10000 ms) |

Process nhận message do bên kia phát PHẢI dùng được schema đó như schema tự dựng (FR-012).

## 3. Tín hiệu đổi schema

| Mục | Giá trị |
|-----|---------|
| Kênh | `<REDIS_BUS_NAMESPACE ?? 'directus:bus'>:schemaChanged` |
| Message | `{"autoPurgeCache":false}`, hoặc `{}` khi `autoPurgeCache` là `undefined` |
| Bên phát | `clearSystemCache`. `PUBLISH` không await |
| Bên nhận | Chỉ đăng ký khi `redisConfigAvailable()`. Xóa `memorySchemaCache` và `localSchemaCache`. Xóa `cache` khi `CACHE_STORE=memory`, `CACHE_AUTO_PURGE=true` và `autoPurgeCache !== false`. Không xóa permissions cache (phần đó đi qua `multi-cache`) |

Thứ tự trong `clearSystemCache({ forced?, autoPurgeCache? })`:

1. Nếu `forced`, hoặc `lockCache.get('system-cache-lock')` rỗng: `lockCache.set('system-cache-lock', true, 10000)`,
   rồi `systemCache.clear()`, rồi `lockCache.delete('system-cache-lock')`.
2. `localSchemaCache.clear()`. Gán `memorySchemaCache = null`.
3. `await clearPermissionCache()`.
4. `publish('schemaChanged', { autoPurgeCache })`, không await.

## 4. Permissions cache

| Mục | Giá trị |
|-----|---------|
| Loại | Có Redis: `multi` (local LRU 100 key + Redis). Không Redis: local LRU 500 key |
| Namespace | `REDIS_PERMISSIONS_NAMESPACE ?? 'permissions'` |
| Key | `<ns>:<tên>-<getSimpleHash(JSON.stringify(args))>` |
| TTL | `PX ms(CACHE_SYSTEM_TTL)` nếu có biến, không thì không hết hạn |
| Giá trị | Theo quy tắc mục 1. Hai app PHẢI ghi giá trị bằng nhau sâu cho cùng key. Không cần giống từng byte |
| Kênh xóa | `<ns>:multi-cache`. Message `{"type":"clear","key":"<key>","origin":"<processId>"}` sau `set` hoặc `delete`; `{"type":"clear","origin":"<processId>"}` sau `clear` |
| Nhận | Bỏ qua khi `origin` trùng `processId` của chính process. Có `key` thì xóa key đó ở local, không thì xóa hết local |
| `processId` | md5 hex của `hostname() + pid + Date.now()`, tính một lần mỗi process |
| `getSimpleHash` | `h = 31*h + charCodeAt(i)`, cắt về int32 sau mỗi bước, kết quả `Math.abs(h).toString(16)` |

Key app mới tạo ở 002 (đường OAS cho public), với đối số đúng thứ tự trường:

| Tên | Đối số được băm |
|-----|------------------|
| `policies` | `{roles, user, ip}` |
| `raw-permissions` | `{policies, action?, collections? (đã sort), accountability?: {app}, bypassMinimalAppPermissions? (chỉ khi true)}` |

## 5. Cache Keyv (`getCache()`)

| Instance | Namespace Keyv | Store | TTL |
|----------|----------------|-------|-----|
| `cache` (khi `CACHE_ENABLED`) | `<CACHE_NAMESPACE>` | `CACHE_STORE` | `CACHE_TTL` |
| `systemCache` | `<CACHE_NAMESPACE>_system` | `CACHE_STORE` | `CACHE_SYSTEM_TTL` |
| `deploymentCache` | `<CACHE_NAMESPACE>_deployment` | `CACHE_STORE` | `CACHE_DEPLOYMENT_TTL` hoặc 5000 ms |
| `localSchemaCache` | `<CACHE_NAMESPACE>_schema` | luôn memory | `CACHE_SYSTEM_TTL` |
| `lockCache` | `<CACHE_NAMESPACE>_lock` | `CACHE_STORE` | không |

- Key thật trên Redis: `sets:namespace:<ns>:<ns>:<key>`. Giá trị: `{"value":…,"expires":<epoch ms>}`. `expires`
  không có khi không có TTL.
- `clear()`: `KEYS sets:namespace:<ns>:*` rồi `UNLINK`.
- Lỗi của từng instance log `warn` với tiền tố `[cache]`, `[system-cache]`, `[deployment-cache]`,
  `[schema-cache]`, `[lock-cache]`.

## 6. App mới KHÔNG được

- Tạo key hay kênh nào ngoài các mục trên (FR-033). Kiểm bằng `redis-trace.test.ts`.
- Đăng ký kênh bus mà nó không xử lý: `flows`, `extensions.reload`, `logs`, `websocket.event`... thuộc feature khác
  hoặc ngoài phạm vi.
