# Data model: GraphQL (011)

Feature này không thêm bảng, cột hay key Redis. Dữ liệu là schema GraphQL sinh từ `SchemaOverview` và quyền, cache
trong bộ nhớ mỗi instance, và document GraphQL đổi thành `Query` của engine 004/005. Mọi dòng DB do mutation ghi đi
qua service của collection, giống REST.

## 1. Schema GraphQL theo user (cache trong process)

| Thuộc tính | Giá trị | Ghi chú |
|------------|---------|---------|
| Khóa | `${scope}_${type}_${role}_${user}` | `scope` ∈ `items`, `system`; `type` ∈ `schema`, `sdl`; `role`, `user` từ accountability (`undefined` khi public) |
| Giá trị | `GraphQLSchema` (type `schema`) hoặc chuỗi SDL (`sdl`) | sinh bởi `generateSchema` qua `graphql-compose` |
| Dung lượng | LRU `GRAPHQL_SCHEMA_CACHE_CAPACITY` entry (mặc định 100) | `lru-cache` (research R1) |
| Xóa | toàn bộ khi nhận `schemaChanged` trên bus | phát bởi `clearSystemCache` của cả hai app (collection, field, relation, quyền, policy, role, access, user đổi qua service; `utils/cache/clear?system`) |
| Sinh đồng thời | tối đa `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT` (mặc định 5) mỗi instance | `p-queue`; kiểm cache lần hai sau khi vào hàng |

Đầu vào sinh schema (admin hoặc không accountability dùng schema đầy đủ; user khác):

| Hành động | Nguồn | Dùng cho |
|-----------|-------|----------|
| `read` | `reduceSchema(sanitized, fetchAllowedFieldMap(read))` | type đọc, filter, aggregate, `Query`, `Subscription` |
| `create` | `... fetchAllowedFieldMap(create)` | `create_<c>_input`, `create_<c>_item(s)` |
| `update` | `... fetchAllowedFieldMap(update)` | `update_<c>_input`, `update_<c>_item(s)`, `update_<c>_batch`, `update_<c>` |
| `delete` | `... fetchAllowedFieldMap(delete)` | `delete_<c>_item(s)` |
| không nhất quán | `fetchInconsistentFieldMap` cho bốn hành động | field nullable và resolver trả null khi dòng không được phép |

`sanitizeGraphqlSchema` bỏ trước: collection hoặc field có tên không khớp `^[_A-Za-z][_0-9A-Za-z]*$` hoặc trùng tên
dành riêng (`Subscription`, `Query`, `Mutation`, `Int`, `Float`, `String`, `Boolean`, `DateTime`, `ID`, `uid`, `Point`,
`PointList`, `Polygon`, `MultiPolygon`, `JSON`, `Hash`, `Date`, `Void`), cùng relation trỏ tới collection bị bỏ; một
dòng log cảnh báo mỗi mục.

## 2. Scope

| Scope | Route | Collection | Tên query, mutation | Thêm |
|-------|-------|------------|---------------------|------|
| `items` | `/graphql` | mọi collection không phải `directus_*` | `<collection>` | `<collection>_by_version` |
| `system` | `/graphql/system` | `directus_*` trừ `directus_collections`, `directus_fields`, `directus_relations`, `directus_migrations`, `directus_sessions`, `directus_extensions`; `directus_activity`, `directus_revisions` chỉ đọc | bỏ tiền tố `directus_` (`users`, `files`...) | thao tác hệ thống §4 |

Type của collection hệ thống vẫn có mặt trong scope `items` khi được tham chiếu qua quan hệ (ví dụ `user_created`
→ `directus_users`), với tên type giữ `directus_users`.

## 3. Type và field sinh cho mỗi collection đọc được `<c>` (tên như Directus)

| Loại | Tên | Nội dung |
|------|-----|----------|
| Object | `<c>` | field theo `get-types.ts`: scalar (`String`, `Int`, `Float`, `Boolean`, `GraphQLBigInt`, `Date`, `JSON`, `Hash`, `GraphQLGeoJSON`, `ID` cho uuid và khóa chính, `[String]` cho csv), quan hệ m2o → type liên quan, o2m và m2m → `[type]` với arg danh sách, m2a → `[<c>_<field>_union]`; `<field>_func` cho hàm ngày giờ và `count` |
| Object | `<c>_aggregated` | `group: JSON`, `countAll: Int`, `count`, `countDistinct` (`<c>_aggregated_count`), `avg`, `sum`, `avgDistinct`, `sumDistinct`, `min`, `max` (`<c>_aggregated_fields`) |
| Object | `version_<c>` | bản ghi theo version (scope `items`) |
| Input | `<c>_filter` | mọi toán tử theo kiểu field (`string_filter_operators`, `number_filter_operators`, `boolean_filter_operators`, `date_filter_operators`, `geometry_filter_operators`, `hash_filter_operators`, `big_int_filter_operators`, `string_filter_operators`...), `_and`, `_or`, quan hệ lồng, `<c>_quantifier_filter` (`_some`, `_none`), `<field>_func` filter (`datetime_function_filter_operators`, `count_function_filter_operators`) |
| Input | `create_<c>_input`, `update_<c>_input` | field theo quyền tạo/sửa, input lồng cho quan hệ |
| Union | `<c>_<field>_union` | m2a |
| Enum | `EventEnum` (`create`, `update`, `delete`) | arg `event` của subscription |
| Object | `<collection>_mutated` | `key: ID!`, `event: EventEnum`, `data: <c>`; tên dùng tên collection đầy đủ (`directus_users_mutated`) ở cả hai scope (FR-047, research R12.7) |
| Query | `<c>(filter, sort, limit, offset, page, search)`, `<c>_by_id(id!, version)`, `<c>_aggregated(groupBy, filter, limit, offset, page, search, sort)`, `<c>_by_version(version!, id!)` (scope `items`) | singleton: `<c>(version)` và `<c>_by_version(version!)`; không có `_by_id`, `_aggregated` |
| Mutation | `create_<c>_item(data)`, `create_<c>_items(data: [..])`, `update_<c>_item(id!, data)`, `update_<c>_items(ids!, data)`, `update_<c>_batch(data: [..])`, `delete_<c>_item(id!)` → `delete_one`, `delete_<c>_items(ids!)` → `delete_many`, singleton `update_<c>(data)` | theo quyền từng hành động |
| Subscription | `<collection>_mutated(event)` | có trong schema cho mọi collection có type đọc, kể cả collection hệ thống trong scope `items` (không qua scopeFilter); không có transport (D-17); qua HTTP trả `null` (R12.2) |

Scalar chung: `Date`, `Hash`, `GraphQLBigInt`, `GraphQLGeoJSON`, `GraphQLStringOrFloat`, `Void`, `JSON`
(`graphql-compose`).

## 4. Thao tác hệ thống (scope `system`)

| Loại | Tên | Service app mới |
|------|-----|-----------------|
| Query | `server_ping`, `server_info`, `server_health` | `ServerService` |
| Query | `server_specs_oas`, `server_specs_graphql(scope)` (khi `OPENAPI_ENABLED`, `GRAPHQL_INTROSPECTION`) | `SpecificationService` |
| Query | `users_me`, `collections`, `collections_by_name`, `fields`, `fields_by_name`, `fields_in_collection`, `relations`, `relations_by_name`, `relations_in_collection` | `UsersService`, `CollectionsService`, `FieldsService`, `RelationsService` |
| Query | `extensions` (admin) | `ExtensionsService.readAll` (D-37) |
| Mutation | `auth_login`, `auth_refresh`, `auth_logout`, `auth_password_request`, `auth_password_reset` | `AuthenticationService`, `UsersService` (D-23) |
| Mutation | `users_me_tfa_generate`, `users_me_tfa_enable`, `users_me_tfa_disable` | `TFAService` |
| Mutation | `utils_random_string`, `utils_hash_generate`, `utils_hash_verify`, `utils_sort`, `utils_revert`, `utils_cache_clear` | `UtilsService`, `RevisionsService`, nanoid, argon2 |
| Mutation | `users_invite_accept`, `users_register`, `users_register_verify`, `update_users_me`, `users_invite` | `UsersService` (D-27, D-28), `registrationRateLimiter` |
| Mutation | `create|update|delete_collections_item`, `create|update|delete_fields_item`, `update_fields_items`, `create|update|delete_relations_item` (admin) | 006 |
| Mutation | `update_extensions_item` (admin) | `ForbiddenError` (D-37) |

## 5. Document GraphQL → `Query` của engine

| GraphQL | `Query` | Ghi chú |
|---------|---------|---------|
| selection set, alias, fragment, inline fragment, `__typename` | `fields[]`, `alias{}` | `replace-fragments`, `parse-query.ts`; `__typename` bỏ khi gọi engine, thêm lại khi trả |
| arg `filter` | `filter` | `filter-replace-m2a` cho m2a; `_FUNC` → hàm |
| `sort`, `limit`, `offset`, `page`, `search`, `version` | tương ứng | `sanitizeQuery`, `validateQuery` như REST |
| arg ở field quan hệ | `deep` | `parse-args.ts` |
| `<c>_aggregated` | `aggregate`, `groupBy` | `aggregate-query.ts` |
| `<field>_func { year }` | `fields: ['year(<field>)']` | `replace-funcs` |
| `dedupeRelationalResolver` | một lần gọi engine mỗi request cho mọi resolver cùng `info` | `object-hash` trên `fieldNodes` |

## 6. Kết quả và lỗi

| Thành phần | Nguồn | Cache |
|------------|-------|-------|
| `data` | `execute()` | cache response `POST /graphql` theo khóa `getCacheKey` (`query`, `variables`, user, role, ip khi policy có `ip_access`, `version` tương thích) khi không có `errors` và không phải mutation |
| `errors[]` | `processError` mỗi lỗi resolver: `message`, `locations`, `path`, `extensions.code` | có `errors` → không cache |
| `400 GRAPHQL_VALIDATION_EXCEPTION` | parse hoặc `validate` lỗi | `extensions.graphqlErrors[]` |
| `400 GRAPHQL_EXECUTION_EXCEPTION` | `execute` ném | `extensions.graphqlErrors[]` |

## 7. Biến môi trường

| Biến | Mặc định Directus | Dùng ở |
|------|-------------------|--------|
| `GRAPHQL_INTROSPECTION` | `true` | validation rule `NoSchemaIntrospectionCustomRule`; mount `/server/specs/graphql`, `server_specs_graphql`, `server_specs_oas` |
| `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT` | `5` | hàng đợi sinh schema |
| `GRAPHQL_QUERY_TOKEN_LIMIT` | `5000` | `parse(..., { maxTokens })` |
| `GRAPHQL_SCHEMA_CACHE_CAPACITY` | không có (code `?? 100`) | LRU |
| `MAX_BATCH_MUTATION`, `QUERY_LIMIT_DEFAULT`, `QUERY_LIMIT_MAX`, `CACHE_*` | như 004, 005 | qua engine và `respond` |

## 8. Tác động của mutation (giống REST)

`directus_activity`, `directus_revisions` qua `ItemsService` (008); event `items.create|update|delete`,
`<c>.items.*` và flow (009); `directus_sessions`, `directus_activity` cho `auth_login`, `auth_refresh`, `auth_logout`
(003); cache quyền và `schemaChanged` cho `users`, `roles`, `policies`, `permissions`, `access`, data model (004,
006); data cache theo `CACHE_AUTO_PURGE` (005). Không có cột hay định dạng mới.
