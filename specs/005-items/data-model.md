# Data model: Items (005)

Feature này không thêm bảng hay cột (Nguyên tắc II). Dữ liệu mới nằm ở Redis (bản cache response), trong process
(listener của emitter) và trên dây (file export, thông điệp bus). Thuật ngữ cache theo Key Entities của spec 004.

## 1. Thực thể và quan hệ

| Thực thể | Nguồn | Ghi chú |
|----------|-------|---------|
| Collection người dùng | `SchemaOverview.collections[<tên>]` (002) | `singleton: boolean` quyết định route (contracts/items-api.md §2); `primary` là khóa chính; không có trong schema → `403` collection (FR-002) |
| Collection hệ thống | `systemCollectionRows` của `@backoffice/system-data` | `/items/directus_*` → `403`; cờ `singleton` của `directus_settings` lấy từ đây (không dùng ở `/items`, dùng ở `/settings`, feature 010) |
| Item | dòng của collection người dùng | Đọc ghi qua `ItemsService` (004): quyền, preset, validation, activity, revision, ghi lồng theo `directus_relations` |
| Bản cache response | Redis (`CACHE_STORE=redis`) hoặc bộ nhớ process (`memory`), Keyv namespace `CACHE_NAMESPACE` | §2 |
| File export | Response HTTP | §3 |
| Event | Trong process (`Emitter`) | §4 |
| Thông điệp `websocket.event` | Kênh bus Redis `websocket.event` (namespace `REDIS_BUS_NAMESPACE`, mặc định `directus:bus`) | §5 |

## 2. Bản cache response

Hai key cho mỗi response được lưu (`respond`, FR-011, FR-012):

| Key Keyv | Giá trị | TTL |
|----------|---------|-----|
| `<hash>` | `compress(res.locals.payload)` (JSON nén như `setCacheValue` của 004) | `res.locals.cacheTTL ?? CACHE_TTL` |
| `<hash>__expires_at` | `compress({ exp: Date.now() + ttl })` | TTL mặc định của Keyv = `CACHE_TTL` |

`<hash>` = `object-hash` của:

```text
{
  version: '11.17.4',            // DIRECTUS_COMPAT_VERSION; Directus: directus/version
  user: accountability.user ?? null,
  path: pathname của req.originalUrl,
  query: req.sanitizedQuery,      // object frozen của sanitizeQuery (004)
  ip?: accountability.ip          // chỉ khi fetchPoliciesIpAccess(...) có mạng khớp IP
}
```

Key Redis thật: `sets:namespace:<CACHE_NAMESPACE>:<CACHE_NAMESPACE>:<hash>` (Keyv 5 với `@keyv/redis`,
`useRedisSets: false`; cùng dạng với `filter-context-*` 004 đã đo, `tests/parity/src/redis.ts`). Directus dùng cùng công
thức nên hai app đọc bản của nhau (SC-003). Không có key hay field nào thêm.

Vòng đời: tạo ở `respond` khi đủ điều kiện (contracts/cache.md §3); đọc ở middleware `cache` (`GET`, không skip); mất
khi hết TTL, khi `cache.clear()` do thao tác ghi (`shouldClearCache`, FR-082, FR-083 của 004) hoặc khi `schemaChanged`
với store `memory` (FR-084 của 004). Không có trạng thái khác.

## 3. File export

| Thuộc tính | Giá trị |
|------------|---------|
| Tên file | `<req.collection ?? 'Export'> <YYYYMMDD-HMS>.<ext>`; `ext` theo contracts/export.md §1 |
| Header | `Content-Disposition: attachment; filename="<tên>"` (Express `res.attachment`), `Content-Type` theo định dạng, `Cache-Control: no-cache`, `Vary: Origin, Cache-Control` |
| Body | `ExportService.transform(res.locals.payload?.data, format)` |
| Nguồn | mọi route đi qua `respond` có `req.sanitizedQuery.export` |

## 4. Event (trong process)

| Loại | Khi | Tên | `meta` | `context` |
|------|-----|-----|--------|-----------|
| filter | trong transaction, trước khi ghi | `items.create`, `<collection>.items.create` (`update`, `delete` tương tự); collection hệ thống: `<scope>.create` với scope = tên bỏ `directus_` | `{ collection }` (update: `{ keys, collection }`; delete: `{ collection }` với payload là mảng khóa) | `{ database: trx, schema, accountability }` |
| action | sau commit | cùng tên | create: `{ payload, key, collection }`; update: `{ payload, keys, collection }`; delete: `{ payload: keys, keys, collection }` | `{ database: getDatabase(), schema, accountability }` |

Ánh xạ thao tác → action event (từ `ItemsService` đã port):

| Thao tác | Action event |
|----------|--------------|
| `createOne` | một `*.create` (`key`) |
| `createMany` | một `*.create` cho mỗi item, phát sau commit của cả lô (gom qua `bypassEmitAction`) |
| `updateOne`, `updateMany`, `updateByQuery` | một `*.update` với `keys` của cả lô |
| `updateBatch` | một `*.update` cho mỗi item (`keys: [pk]`) |
| `deleteOne`, `deleteMany`, `deleteByQuery` | một `*.delete` với `keys` |
| `upsertSingleton` | `*.create` hoặc `*.update` tùy có dòng chưa |
| ghi lồng | event của collection con (`nestedActionEvents`) sau event chính |
| `emitEvents: false` | không phát. Ở Directus chỉ dùng trong `flows.ts`, `utils/versioning/handle-version.ts` và các service `tus`, `fields`, `files` (feature 006 đến 009); luồng của 001 đến 005, kể cả `track/page`, đều phát |

Listener trong feature này: chỉ cầu nối §5 (`onAction`). Listener là trạng thái trong process dựng lại khi khởi động,
không chứa dữ liệu (Nguyên tắc VII).

## 5. Thông điệp `websocket.event`

Port của `websocket/controllers/hooks.ts`; type `WebSocketEvent` (thuần, không zod):

```text
{ collection: string, action: 'create', key: string | number, payload: Record<string, unknown> }   // payload mặc định {}
{ collection: string, action: 'update', keys: (string | number)[], payload: Record<string, unknown> }
{ collection: string, action: 'delete', keys: (string | number)[], payload: unknown[] }            // payload mặc định []
```

Module đăng ký: `items` và mọi `systemCollectionNames` bỏ `directus_`, trừ `migrations`, `fields`, `relations`, `files`
(hook riêng: `fields.*` → collection `directus_fields`; `files.upload` như create; `relations.*`; `items.sort`) và
`sessions`. Hook riêng được port nguyên nhưng chỉ có tác dụng khi feature 006, 007, 010 phát event đó.

Điều kiện đăng ký (Clarifications): `WEBSOCKETS_ENABLED=true` và (`WEBSOCKETS_REST_ENABLED=true` hoặc
`WEBSOCKETS_GRAPHQL_ENABLED=true`). Thông điệp mang nguyên `meta.payload` của action event (R-07).

## 6. Redis (dùng chung với Directus)

| Cấu trúc | Key hoặc kênh | Feature | Ghi chú |
|----------|---------------|---------|---------|
| Cache dữ liệu | `sets:namespace:<CACHE_NAMESPACE>:<CACHE_NAMESPACE>:<hash>` và `...:<hash>__expires_at` | 005 | §2; cùng namespace với `filter-context-*` của 004 |
| Bus | kênh `websocket.event` | 005 | §5 |
| Bus | kênh `schemaChanged` | 002, 004 | không đổi |
| Cache quyền | `permissions:policies-ip-access-<hash>` | 004 | đọc ở `getCacheKey` |

Không có key hay kênh nào Directus không dùng.

## 7. Trạng thái trong process (Nguyên tắc VII)

| Trạng thái | Dựng lại từ | Xóa qua bus |
|------------|-------------|-------------|
| Listener của `Emitter` (cầu nối §5) | code, lúc khởi động | không cần |
| `cache` Keyv store `memory` | request (bản cache) | `schemaChanged` với `autoPurgeCache` (004 FR-084); cảnh báo một instance của 001 |
| `actionsRegistered` của `registerWebSocketEvents` | khởi động | không cần |
