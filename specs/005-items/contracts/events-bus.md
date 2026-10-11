# Contract: event và bus `websocket.event` (005)

Nguồn: `directus/api/src/emitter.ts`, `services/items.ts` (chỗ phát), `websocket/controllers/hooks.ts`,
`websocket/messages.ts` (`WebSocketEvent`), điểm gọi `websocket/controllers/rest.ts:18`, `graphql.ts:26`,
`server.ts:104`.

## 1. `Emitter`

| Hàm | Hành vi |
|-----|---------|
| `emitFilter(event \| event[], payload, meta, context?)` | với mỗi event, chạy từng listener tuần tự với `(payload hiện tại, {event, ...meta}, context ?? default)`; kết quả khác `undefined` thành payload mới; trả payload cuối |
| `emitAction(event \| event[], meta, context?)` | `emitAsync` từng event, không chờ; lỗi → `warn` `An error was thrown while executing action "<event>"` rồi `warn(err)` |
| `emitInit(event, meta)` | `emitAsync` chờ; lỗi → `warn` `An error was thrown while executing init "<event>"` rồi `warn(err)` |
| `onFilter`, `onAction`, `onInit`, `offFilter`, `offAction`, `offInit`, `offAll` | như `eventemitter2` |
| context mặc định | `{ database: getDatabase(), accountability: null, schema: null }` |
| tùy chọn `EventEmitter2` | `wildcard: true`, `verboseMemoryLeak: true`, `delimiter: '.'`, `ignoreErrors: true` |

## 2. Event đã phát trong code port (không sửa service)

| Scope | Nguồn | Event |
|-------|-------|-------|
| collection người dùng | `ItemsService` | `items.create`, `<c>.items.create`; `items.update`, `<c>.items.update`; `items.delete`, `<c>.items.delete` (filter và action) |
| `directus_users` ... | `ItemsService` với `eventScope` | `users.*`, `roles.*`, `policies.*`, `access.*`, `permissions.*`, `activity.*`, `revisions.*`, `presets.*`, `settings.*` (khi service đó ghi) |
| auth (003) | `AuthenticationService`, driver | `auth.login` (filter, action), `auth.jwt` (filter), `auth.create`, `auth.update` (action), `authenticate` (filter) |

`meta` và `context`: data-model.md §4.

## 3. Cầu nối `websocket.event`

| Event (`onAction`) | Thông điệp bus |
|--------------------|----------------|
| `<m>.create` với `m` ∈ {`items`, `users`, `roles`, `policies`, `access`, `permissions`, `activity`, `revisions`, `collections`, `presets`, `settings`, `folders`, `comments`, `notifications`, `shares`, `translations`, `dashboards`, `panels`, `flows`, `operations`, `versions`, `webhooks`, `extensions`...: mọi `systemCollectionNames` bỏ `directus_` trừ `migrations`, `fields`, `relations`, `files`, `sessions`} | `{ collection, action: 'create', key, payload: payload ?? {} }` |
| `<m>.update` | `{ collection, action: 'update', keys, payload: payload ?? {} }` |
| `<m>.delete` | `{ collection, action: 'delete', keys, payload: payload ?? [] }` |
| `fields.create` / `update` / `delete` | collection `directus_fields` (006) |
| `files.upload` (create), `files.update`, `files.delete` | (007) |
| `relations.create` (payload thêm `key`), `relations.update`, `relations.delete` (`keys: payload`, `payload: {collection, fields}`) | (006) |
| `items.sort` | `{ collection, action: 'update', keys: [item], payload: {} }` (010) |

`useBus().publish('websocket.event', message)`; bus và namespace của 002 (`REDIS_BUS_NAMESPACE`, mặc định
`directus:bus`; bus local khi không có Redis).

## 4. Điều kiện đăng ký (Clarifications)

`registerWebSocketEvents()` chạy một lần khi khởi động nếu `toBoolean(WEBSOCKETS_ENABLED)` và
(`toBoolean(WEBSOCKETS_REST_ENABLED)` hoặc `toBoolean(WEBSOCKETS_GRAPHQL_ENABLED)`); mặc định của Directus:
`WEBSOCKETS_ENABLED=false`, hai biến kia `true`. App mới không mở `/websocket` (D-17).

## 5. Bộ đối chiếu (FR-045)

Cặp `websocket` (research R5): subscriber ioredis trên `<REDIS_BUS_NAMESPACE>` kênh `websocket.event`
(`@backoffice/memory` bus: kiểm cách gói mã hóa kênh và thông điệp khi làm); chuỗi thao tác: tạo một, tạo nhiều, sửa
một, sửa nhiều, sửa lô, sửa theo query, xóa một, xóa nhiều, xóa theo query, ghi lồng o2m, singleton tạo rồi sửa, mỗi
collection hệ thống của 004 một thao tác, `PATCH /users/me/track/page` (một thông điệp `update` của `directus_users`); chuỗi của một thao tác chốt
khi response đã về và 2 giây không có thông điệp mới (FR-045); so mảng thông điệp hai app sau khi thay id bằng nhãn
(thứ tự giữ). Cặp chính: cùng chuỗi, mong đợi 0 thông điệp. Ca Redis dừng đo R-10 chạy ở cặp `cache-redis` (T044). Cặp `websocket` dùng Redis chính nên không dừng được riêng.
