# Contract: `/graphql`, `/graphql/system`, `/server/specs/graphql` (011)

Mốc: Directus 11.17.4 `controllers/graphql.ts`, `middleware/graphql.ts`, `controllers/server.ts`, `services/graphql`.
Mọi dòng "Directus" đã đọc từ code; dòng ghi "đo 2026-10-14" đã xác nhận trên Directus 11.17.4 (research R12).

## 1. Route và method

| Request | Kết quả | Ghi chú |
|---------|---------|---------|
| `POST /graphql` body `{ query, variables?, operationName? }` | thực thi ở scope `items` | `Content-Type: application/json` |
| `POST /graphql/system` | scope `system` | |
| `GET /graphql?query=...&variables=<json>&operationName=...` | như `POST`, chỉ operation `query` | `variables` thiếu → `{}` |
| `GET` với operation mutation | `405 METHOD_NOT_ALLOWED`, `Allow: POST` | `operationName` chọn operation |
| method khác `GET`, `POST` (gồm `OPTIONS`, `HEAD`; đo 2026-10-14) | `405 METHOD_NOT_ALLOWED`, `Allow: GET, POST`, body "Invalid method \"<M>\" used. Should be one of \"GET\", \"POST\"." với `extensions.allowed`, `current` | `parseGraphQL` chạy trước mọi thứ; không có dòng router-options |
| `POST /graphql/<bất kỳ>` (đo 2026-10-14) | scope `items` (`router.use('/')`); `/graphql/systemx` cũng `items` | `/graphql/system/<bất kỳ>` → `system` |
| operation `subscription` qua `POST` (đo 2026-10-14) | `200 { data: { <c>_mutated: null } }` khi field có trong schema; schema không có `Subscription` → `200` với `errors[0].extensions.code = INTERNAL_SERVER_ERROR` "An unexpected error occurred." | qua `GET` → `405 Allow: POST` |
| thiếu `query` | `400 INVALID_PAYLOAD` "Must provide query string" | |
| `variables` của `GET` không phải JSON | `400 INVALID_QUERY` "Variables are invalid JSON" | |
| parse lỗi hoặc quá `GRAPHQL_QUERY_TOKEN_LIMIT` | `400 GRAPHQL_VALIDATION_EXCEPTION` | `extensions.graphqlErrors[{ message, locations }]` |
| validation lỗi (field không có, arg sai kiểu, introspection khi tắt, nhiều operation không `operationName`) | `400 GRAPHQL_VALIDATION_EXCEPTION` | `graphqlErrors[{ message, locations, path? }]` |
| `execute` ném (variable sai kiểu...) | `400 GRAPHQL_EXECUTION_EXCEPTION` | `graphqlErrors[message]` |
| document hợp lệ | `200 { data, errors?, extensions? }` | lỗi resolver trong `errors[]`, `data` có field null |

Response lỗi `400` theo khuôn chung `{ errors: [{ message, extensions: { code, graphqlErrors } }] }` của `respond`.

## 2. Cache response

| Điều kiện | Hành vi |
|-----------|---------|
| `CACHE_ENABLED=true`, `POST` hoặc `GET /graphql*`, operation `query`, không `errors`, không `Cache-Control: no-store` (hoặc `CACHE_SKIP_ALLOWED=false`) | lưu theo khóa `hash({ user, role, path, query: { query, variables }, ip? , version })`; header `Cache-Control`, `Vary: Origin, Cache-Control`, `CACHE_STATUS_HEADER` như REST |
| operation `mutation` | `res.locals.cache = false` từ `parseGraphQL` |
| response có `errors` | không lưu |
| mutation thành công | data cache xóa theo `CACHE_AUTO_PURGE`, `CACHE_AUTO_PURGE_IGNORE_LIST` (qua service) |

## 3. `/server/specs/graphql`

| Request | Kết quả |
|---------|---------|
| `GET /server/specs/graphql` hoặc `/server/specs/graphql/items` | `200`, body SDL (`printSchema`) của schema `items` theo quyền người gọi; `Content-Disposition: attachment; filename="<project_name>_<yyyy-MM-dd>.graphql"` (`project_name` mặc định "Directus" là dữ liệu, giữ); `Content-Type: application/octet-stream; charset=utf-8` (đo 2026-10-14, `res.attachment` theo đuôi `.graphql`) |
| `GET /server/specs/graphql/system` | SDL scope `system` |
| `GET /server/specs/graphql/<khác>` | `404 ROUTE_NOT_FOUND` |
| `OPTIONS` | `200`, `Allow: GET,HEAD` (router-options) |
| `GRAPHQL_INTROSPECTION=false` | mọi request → `404 ROUTE_NOT_FOUND`; `OPTIONS` cũng `404` |
| public, user thường | SDL theo schema của họ, không kiểm admin (đo 2026-10-14: public không policy → `type Query { _empty: Void }` + `scalar Void`) |

## 4. Schema: tên và điều kiện hiện diện

Xem [data-model.md](../data-model.md) §3, §4. Quy tắc hiện diện:

| Thành phần | Có khi |
|------------|--------|
| `Query.<c>`, `<c>_by_id`, `<c>_aggregated` | user đọc được ít nhất một field của `<c>` (collection không singleton); singleton chỉ `<c>` |
| `Query.<c>_by_version` | scope `items` |
| `Mutation.create_<c>_item(s)` | quyền create; `update_*` quyền update; `delete_*` quyền delete; không cho `directus_activity`, `directus_revisions` |
| `Mutation.update_<c>` | singleton, quyền update |
| `Subscription.<collection>_mutated` (tên collection đầy đủ, kể cả `directus_*`, ở cả hai scope; không qua scopeFilter) | user đọc được collection đó (FR-047; đo 2026-10-14: admin scope `items` có 221 field) |
| `Query.server_specs_oas` | `OPENAPI_ENABLED !== false` |
| `Query.server_specs_graphql` | `GRAPHQL_INTROSPECTION !== false` |
| `Query.users_me`, `Mutation.update_users_me` | accountability có `user` và `directus_users` đọc/sửa được |
| `Query.collections*`, `fields*`, `relations*` | user đọc được `directus_collections`, `directus_fields`, `directus_relations` (hoặc admin) |
| `Query.extensions`, `Mutation.update_extensions_item`, `*_collections_item`, `*_fields_item(s)`, `*_relations_item` | admin |
| `Mutation.users_invite` | `directus_users` ghi được |
| `Mutation.auth_*`, `utils_*`, `users_register*`, `users_invite_accept`, `users_me_tfa_*` | luôn (global) |

`Query` không có field nào (public không đọc được gì): `Query._empty: Void` "There's no data to query.", `mutationType`
và `subscriptionType` null ở scope `items`; scope `system` vẫn có `server_*` và 17 mutation global (đo 2026-10-14,
research R12.3).

## 5. Lỗi resolver (`200` với `errors[]`)

| Tình huống | `extensions.code` | message admin | message user thường |
|------------|-------------------|---------------|---------------------|
| không có quyền | `FORBIDDEN` | của `BackofficeError` | như admin (lỗi là `DirectusError`) |
| payload sai | `INVALID_PAYLOAD`, `FAILED_VALIDATION`, `RECORD_NOT_UNIQUE`... | như REST | như REST |
| lỗi không phải `BackofficeError` | `INTERNAL_SERVER_ERROR` | message gốc | "An unexpected error occurred." |
| scalar sai | `GRAPHQL_VALIDATION_EXCEPTION` (400) | message của scalar (`Date`, `BigInt`, `Hash`) | |

`errors[].path`, `locations` như `graphql`; `name` của lỗi giữ `DirectusError` (009).

## 6. Khác biệt áp dụng (không có mục mới)

| Mục | Hành vi app mới |
|-----|-----------------|
| D-17 | không nâng cấp WebSocket trên `/graphql`; `WEBSOCKETS_GRAPHQL_*` chỉ cảnh báo; `server_info.websocket = false` |
| D-23, D-27, D-28 | `auth_password_request`, `users_invite`, `users_register` ghi log thay email |
| D-37 | `extensions` trả dòng với `schema: null`; `update_extensions_item` → `FORBIDDEN` |
| đổi thương hiệu 001 | `server_info`, `server_specs_oas` như REST |
