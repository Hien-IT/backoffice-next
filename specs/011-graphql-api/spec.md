# Feature Specification: GraphQL (`/graphql`, `/graphql/system`)

**Feature Branch**: `011-graphql-api`
**Created**: 2026-10-14
**Status**: Done
**Duyệt khác biệt**: tech lead đã duyệt ngày 2026-10-14 gỡ D-09.9, D-15 (spec 001); rủi ro R-30 đến R-33 (đã đo, tái
tạo từ Directus); thư viện như Directus (`mnemonist`, `async-mutex`, owner chọn cùng ngày), không còn lệch mã gốc; không
có khác biệt mới; và đóng spec (Nguyên tắc X; quy trình không có PR)
**Input**: User description: "App mới cung cấp /graphql (dữ liệu người dùng) và /graphql/system (dữ liệu hệ thống), có schema sinh động từ data model và phân quyền của từng user, giống hệt Directus: query, mutation, aggregate, quan hệ lồng nhau, filter, đặt tên type và field giống nhau. Không làm subscription. Tham chiếu directus/api/src/services/graphql. Tiêu chí chấp nhận: introspection schema của app mới khớp với Directus cho cùng user, và các blackbox test GraphQL chạy qua."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/api/src` trừ khi ghi khác):

- Route: `controllers/graphql.ts` (`/graphql/system` và `/graphql`, mọi method qua `parseGraphQL` rồi `respond`;
  response có `errors` thì không cache), `middleware/graphql.ts` (`parseGraphQL`: chỉ `GET`, `POST`; `GET` lấy
  `query`, `variables` JSON, `operationName` từ query string; `POST` lấy từ body; thiếu `query` → `400 INVALID_PAYLOAD`
  "Must provide query string"; `variables` không phải JSON → `400 INVALID_QUERY`; parse với
  `GRAPHQL_QUERY_TOKEN_LIMIT`; lỗi parse → `GRAPHQL_VALIDATION`; mutation qua `GET` → `405`; mutation không
  cache; `contextValue` gồm `req`, `res` và một `Map` cache theo request), `controllers/server.ts`
  (`GET /server/specs/graphql/:scope?` trả SDL dạng file tải về, chỉ khi `GRAPHQL_INTROSPECTION` khác `false`),
  `middleware/respond.ts` (cache response cho `GET` và mọi request có path bắt đầu bằng `/graphql`).
- Service: `services/graphql/index.ts` (`GraphQLService`: `execute` với `specifiedRules` cộng
  `NoSchemaIntrospectionCustomRule` khi `GRAPHQL_INTROSPECTION=false`; `GraphQLValidationError`,
  `GraphQLExecutionError`; `read`, `upsertSingleton`, `create`, `update`, `delete`... gọi `getService` của collection),
  `services/graphql/schema/index.ts` (`generateSchema`: khóa cache `scope_type_role_user`, semaphore
  `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT`, `sanitizeGraphqlSchema`, `reduceSchema` theo `fetchAllowedFieldMap` cho
  read, create, update, delete; `fetchInconsistentFieldMap`; `SYSTEM_DENY_LIST` = `directus_collections`,
  `directus_fields`, `directus_relations`, `directus_migrations`, `directus_sessions`, `directus_extensions`;
  `READ_ONLY` = `directus_activity`, `directus_revisions`; scope `items` bỏ mọi collection hệ thống, scope `system`
  chỉ lấy collection hệ thống và bỏ tiền tố `directus_` ở tên query, mutation), `schema/read.ts` (type đọc, filter
  `<collection>_filter` với mọi toán tử, `_and`, `_or`, quantifier `_some`, `_none`, aggregate
  `<collection>_aggregated` với `count`, `countDistinct`, `countAll`, `sum`, `sumDistinct`, `avg`, `avgDistinct`, `min`,
  `max`, `group`, hàm ngày giờ `year`, `month`, `week`, `day`, `weekday`, `hour`, `minute`, `second`, hàm `count`
  trên quan hệ, `<collection>_by_id`, `<collection>_by_version`, arg `filter`, `sort`, `limit`, `offset`, `page`,
  `search`, `version`, type `Subscription` với `<collection>_mutated`), `schema/write.ts` (`create_<c>_item`,
  `create_<c>_items`, `update_<c>_item`, `update_<c>_items`, `update_<c>_batch`, `delete_<c>_item`,
  `delete_<c>_items`, input type `create_<c>_input`, `update_<c>_input`, singleton `update_<c>`, type
  `delete_one`, `delete_many`), `schema/get-types.ts` (map kiểu field sang `String`, `Int`, `Float`, `Boolean`,
  `GraphQLBigInt`, `Date`, `JSON`, `Hash`, `GraphQLGeoJSON`, `GraphQLStringOrFloat`, `GraphQLVoid`; quan hệ m2o, o2m,
  m2m, m2a qua union `<collection>_<field>_union`; version type; `directus_permissions.permissions` là `JSON`),
  `schema/parse-query.ts`, `schema/parse-args.ts` (đổi selection set và arg GraphQL thành `Query` của engine: alias,
  fragment, `__typename`, deep, `_FUNC` cho hàm), `resolvers/query.ts`, `resolvers/mutation.ts`,
  `resolvers/system.ts` (`server_ping`, `server_info`, `server_health`, `server_specs_oas`, `server_specs_graphql`,
  `users_me`, `update_users_me`, `users_invite`, `collections`, `collections_by_name`, `fields`, `fields_by_name`,
  `fields_in_collection`, `relations`, `relations_by_name`, `relations_in_collection`, `extensions` + các type
  `directus_collections`, `directus_fields`, `directus_relations` từ `get-collection-type.ts`, `get-field-type.ts`,
  `get-relation-type.ts`), `resolvers/system-global.ts` (`auth_login`, `auth_refresh`, `auth_logout`,
  `auth_password_request`, `auth_password_reset`, `users_me_tfa_generate`, `users_me_tfa_enable`,
  `users_me_tfa_disable`, `utils_random_string`, `utils_hash_generate`, `utils_hash_verify`, `utils_sort`,
  `utils_revert`, `utils_cache_clear`, `users_invite_accept`, `users_register`, `users_register_verify`; enum
  `auth_mode`), `resolvers/system-admin.ts` (`create|update|delete_collections_item`, `create|update|delete_fields_item`,
  `update_fields_items`, `create|update|delete_relations_item`, `update_extensions_item`),
  `services/graphql/types/*` (scalar `GraphQLBigInt`, `GraphQLDate`, `GraphQLGeoJSON`, `GraphQLHash`,
  `GraphQLStringOrFloat`, `GraphQLVoid`), `services/graphql/utils/*` (`aggregate-query`, `dedupe-resolvers`,
  `filter-replace-m2a`, `process-error`, `replace-fragments`, `replace-funcs`, `sanitize-gql-schema`,
  `add-path-to-validation-error`), `services/graphql/errors/*` (`GraphQLValidationError` → `400
  GRAPHQL_VALIDATION`, `GraphQLExecutionError` → `400 GRAPHQL_EXECUTION`, `formatError`),
  `services/graphql/schema-cache.ts` (LRU `GRAPHQL_SCHEMA_CACHE_CAPACITY`, mặc định 100, xóa khi nhận
  `schemaChanged` trên bus), `services/specifications.ts` (`GraphQLSpecsService.generate(scope)` in SDL),
  `services/graphql/subscription.ts` và `websocket/controllers/graphql.ts` (subscription qua WebSocket, ngoài phạm
  vi).
- Biến môi trường (`directus/packages/env/src/constants/defaults.ts`, `directus-variables.ts`):
  `GRAPHQL_INTROSPECTION=true`, `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT=5`, `GRAPHQL_QUERY_TOKEN_LIMIT=5000`,
  `GRAPHQL_SCHEMA_CACHE_CAPACITY` (không có mặc định trong `defaults.ts`, code dùng 100), `MAX_BATCH_MUTATION`,
  `QUERY_LIMIT_DEFAULT`, `QUERY_LIMIT_MAX`; `WEBSOCKETS_GRAPHQL_*` thuộc WebSocket (Nguyên tắc XI).
- Thư viện Directus dùng (phiên bản chốt ở plan): `graphql`, `graphql-compose`, `mnemonist` (LRU), `async-mutex`
  (semaphore); bộ blackbox dùng `json-to-graphql-query`.
- App Directus (client của feature này): `composables/use-item/index.ts` (`saveAsCopy` đọc item theo
  `item_duplication_fields` bằng GraphQL, `/graphql` hoặc `/graphql/system` theo collection; nhận `id` dạng chuỗi), `stores/insights.ts` (panel Insights gộp
  mọi query của một dashboard vào một request `/graphql` và một request `/graphql/system`; lỗi validation `400`
  được tách theo `path` của `extensions.errors`), `utils/query-to-gql-string.ts`, `stores/server.ts`
  (`server_info.websocket.graphql`).

**Đã có từ feature 001 đến 010** (trong `apps/api/src` và `libs/`): engine đọc ghi và quyền (`getAstFromQuery`,
`runAst`, `ItemsService`, `fetchAllowedFieldMap`, `fetchInconsistentFieldMap`, `reduceSchema`, 004, 005); mọi service
hệ thống mà resolver GraphQL gọi (`AuthenticationService`, `UsersService`, `TFAService`, `UtilsService`,
`RevisionsService.revert`, `CollectionsService`, `FieldsService`, `RelationsService`, `ServerService`,
`SpecificationService` phần OpenAPI, `ExtensionsService` đọc, 003, 006, 008, 010); response cache dùng chung với
Directus (005); `Emitter` và cầu nối `websocket.event` (005); bus Redis và `schemaChanged` (002); `respond`,
`router-options`; biến `GRAPHQL_*` ở nhóm "chưa hỗ trợ" (001); khác biệt D-09.9 (`/graphql` → `404`) và D-15
(`/server/specs/graphql` → `404`) ghi "gỡ ở 011". Chưa có: toàn bộ `services/graphql`, `parseGraphQL`, route
`/graphql`, `/graphql/system`, `/server/specs/graphql`, cache schema GraphQL, scalar tùy chỉnh.

**Bộ test liên quan của Directus** (đếm bằng grep ngày 2026-10-14: khối `it`/`it.each` × lần gọi `requestGraphQL`;
mỗi `it.each(vendors)` chạy một lần mỗi vendor): Directus không có bộ blackbox riêng cho GraphQL; GraphQL được kiểm
xen trong các file REST, mỗi ca gửi cùng truy vấn qua REST và qua `requestGraphQL` (`tests/blackbox/common/
transport.ts`, chọn `/graphql/system` khi collection là hệ thống). File chạm GraphQL:
`tests/db/routes/items/no-relation.test.ts` (46 `it`, 40 lần gọi), `o2m.test.ts` (26, 38), `m2m.test.ts` (32, 38),
`m2o.test.ts` (21, 32), `m2a.test.ts` (23, 28), `singleton.test.ts` (4, 6), `fields/crud.test.ts` (9, 2),
`collections/crud.test.ts` (11, 2) (tám file này đã port ở 005, 006 với phần GraphQL đang gửi về Directus của cặp,
D-09.9; các ca WebSocket đã bỏ khi port); `tests/common/auth/login.test.ts` (5, 6; 6 chỗ WebSocket sẽ bỏ),
`refresh.test.ts` (2, 5), `logger/redact.test.ts` (2, 5), `tests/db/routes/server/ping.test.ts` (1, 2),
`health.test.ts` (1, 2) (chưa port; 001, 003 có bộ đối chiếu riêng cho phần REST). Tổng 183 khối `it`, 206 lần gọi
GraphQL. Unit: `services/graphql/utils/aggregate-query.test.ts` (17), `filter-replace-m2a.test.ts` (15),
`dedupe-resolvers.test.ts` (13), `schema/parse-query.test.ts` (13), `resolvers/query.test.ts` (9),
`replace-fragments.test.ts` (6), `process-error.test.ts` (4), `sanitize-gql-schema.test.ts` (4).

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là client GraphQL đang gọi Directus (`@directus/sdk` với composable `graphql`, script,
ứng dụng front-end), app Directus (module Insights, "Save as copy" ở trang chi tiết item) và lập trình viên
dùng công cụ GraphQL (introspection, tải SDL) để sinh type cho client.

### User Story 1 - Đọc dữ liệu người dùng qua `/graphql` (Priority: P1)

Client gửi query tới `/graphql` với cùng tên type, field, arg như Directus: danh sách item có `filter`, `sort`,
`limit`, `offset`, `page`, `search`; một item theo khóa chính (`<collection>_by_id`); item theo version
(`<collection>_by_version`); quan hệ lồng nhau m2o, o2m, m2m, m2a (union) với arg riêng ở mỗi cấp; alias, fragment,
variables, `operationName`; aggregate (`<collection>_aggregated`) với `groupBy`; hàm ngày giờ và `count` trên quan hệ.
Kết quả chỉ chứa collection và field user được đọc.

**Why this priority**: Là luồng chính của mọi client GraphQL; phần lớn ca GraphQL của bộ blackbox là đọc.

**Independent Test**: Gửi cùng document GraphQL (admin, user có quyền một phần, public) tới hai app; so status, body
(`data`, `errors`), header; so với kết quả REST tương đương như bộ blackbox làm.

**Acceptance Scenarios**:

1. **Given** collection người dùng có quan hệ m2o, o2m, m2m, m2a, **When** query danh sách với `filter` (kể cả
   `_and`, `_or`, lọc qua quan hệ, `_some`, `_none`), `sort`, `limit`, `offset`, `page`, `search` và selection lồng
   nhiều cấp có arg riêng, **Then** `data` giống Directus từng giá trị (khóa chính trả dạng chuỗi `ID`, số lớn,
   ngày giờ, JSON, geometry theo scalar như Directus) và giống kết quả REST với cùng query.
2. **Given** item, **When** `<collection>_by_id`, `<collection>_by_version` (có và không có `version`), singleton
   (`<collection>` không arg danh sách), **Then** kết quả như Directus; không có item thì `data` null kèm `errors`
   như Directus.
3. **Given** `<collection>_aggregated` với `count`, `countDistinct`, `countAll`, `sum`, `avg`, `min`, `max`, `group`
   và arg `groupBy`, `filter`, `sort`, `limit`, **When** chạy ở hai app, **Then** kết quả giống nhau (kể cả kiểu số
   trả về theo vendor DB, so như 005).
4. **Given** user có quyền đọc một phần (field, filter, collection), **When** query field hoặc collection không được
   phép, **Then** validation `400 GRAPHQL_VALIDATION` "Cannot query field ..." như Directus vì type đó
   không có trong schema của user; field được phép nhưng dòng bị filter quyền thì trả rỗng như REST.
5. **Given** alias, fragment, `__typename`, variables, nhiều operation với `operationName`, **When** chạy, **Then**
   kết quả như Directus; thiếu `operationName` khi có nhiều operation trả lỗi như Directus.
6. **Given** query qua `GET /graphql?query=...&variables=...`, **When** chạy, **Then** kết quả như `POST`;
   `variables` không phải JSON → `400 INVALID_QUERY`; method khác `GET`, `POST` → `405` với `Allow: GET, POST`.

---

### User Story 2 - Ghi dữ liệu người dùng qua `/graphql` (Priority: P1)

Client tạo, sửa, xóa item bằng mutation `create_<c>_item`, `create_<c>_items`, `update_<c>_item`,
`update_<c>_items`, `update_<c>_batch`, `delete_<c>_item`, `delete_<c>_items`, `update_<c>` (singleton), kể cả ghi
lồng quan hệ trong input, rồi chọn field trả về (kể cả quan hệ) ngay trong mutation. Mọi tác động (dòng DB, activity,
revision, event, flow, xóa cache) giống như ghi qua REST.

**Why this priority**: Mutation là nửa còn lại của bộ blackbox items và là cách client ghi dữ liệu; sai thì hỏng
dữ liệu dùng chung với Directus.

**Independent Test**: Chạy cùng chuỗi mutation ở hai app với admin, user có quyền một phần, public; so response,
dòng DB (bảng dữ liệu, `directus_activity`, `directus_revisions`), event phát ra; đọc lại bằng REST ở app kia.

**Acceptance Scenarios**:

1. **Given** input có quan hệ lồng (m2o tạo mới, o2m `create`/`update`/`delete`, m2m, m2a), **When**
   `create_<c>_item`, `create_<c>_items`, **Then** dòng DB, activity, revision, response (theo selection) giống
   Directus; input type `create_<c>_input` có đúng field và kiểu như Directus.
2. **Given** item có sẵn, **When** `update_<c>_item(id, data)`, `update_<c>_items(ids, data)`,
   `update_<c>_batch(data: [...])`, `delete_<c>_item`, `delete_<c>_items`, **Then** kết quả và tác động như
   Directus; `delete_*` trả `{ id }` hoặc `{ ids }` như Directus; số item vượt `MAX_BATCH_MUTATION` trả lỗi như REST.
3. **Given** singleton, **When** `update_<c>(data)` có hoặc không có selection field, **Then** upsert và trả item
   (hoặc `true` khi không chọn field) như Directus.
4. **Given** user không có quyền tạo, sửa hoặc xóa collection, **When** gọi mutation tương ứng, **Then** mutation đó
   không có trong schema của user (`400 GRAPHQL_VALIDATION`), hoặc có nhưng bị từ chối ở engine thì
   `errors` mang `FORBIDDEN` như Directus.
5. **Given** mutation gửi qua `GET`, **When** chạy, **Then** `405` với `Allow: POST`; mutation qua `POST` không bao giờ
   được cache; sau mutation, query cùng nội dung ở app kia thấy dữ liệu mới (data cache dùng chung bị xóa như REST).
6. **Given** flow theo event `items.create` của collection, **When** tạo item qua GraphQL ở app mới, **Then** flow chạy
   như khi tạo qua REST (009).

---

### User Story 3 - Dữ liệu hệ thống và thao tác hệ thống qua `/graphql/system` (Priority: P1)

Client (và app Directus) đọc, ghi collection hệ thống (`users`, `roles`, `policies`, `permissions`, `files`,
`folders`, `activity`, `revisions`, `presets`, `settings`, `notifications`, `shares`, `translations`, `dashboards`,
`panels`, `flows`, `operations`, `versions`, `comments`...) với tên bỏ tiền tố `directus_`; đọc data model
(`collections`, `fields`, `relations` và biến thể `_by_name`, `_in_collection`) và ghi data model (admin); gọi các thao
tác đặc biệt (`server_ping`, `server_info`, `server_health`, `server_specs_oas`, `server_specs_graphql`, `users_me`,
`update_users_me`, `users_invite`, `auth_*`, `users_me_tfa_*`, `utils_*`, `users_invite_accept`, `users_register*`,
`extensions`, `update_extensions_item`).

**Why this priority**: App Directus dùng `/graphql/system` ở Insights và "Save as copy" của item hệ thống; bộ blackbox
`login`, `refresh`, `ping`, `health`, `fields`, `collections` gọi các thao tác này.

**Independent Test**: Chạy cùng document ở hai app với admin, user app access, public; so response, dòng DB, cookie,
log; token cấp qua `auth_login` ở app này dùng được ở app kia.

**Acceptance Scenarios**:

1. **Given** admin, **When** query `users`, `roles`, `files`, `activity`, `revisions`... với filter, quan hệ lồng và
   aggregate, **Then** kết quả như Directus; `activity`, `revisions` không có mutation; `collections`, `fields`,
   `relations`, `migrations`, `sessions`, `extensions` không có type item thường (danh sách loại trừ của Directus).
2. **Given** public hoặc user, **When** `auth_login(email, password, mode, otp)`, `auth_refresh`, `auth_logout`,
   **Then** response (`access_token`, `refresh_token`, `expires`), cookie theo `mode` (`json`, `cookie`, `session`),
   dòng `directus_sessions` và `directus_activity` giống Directus; token dùng chéo được giữa hai app (003).
3. **Given** `auth_password_request`, `users_invite`, `users_register`, **When** gọi ở app mới, **Then** luồng chạy và
   trả về như Directus, bước gửi email thay bằng dòng log cảnh báo (D-23, D-27, D-28).
4. **Given** admin, **When** `create_collections_item`, `create_fields_item`, `update_fields_items`,
   `create_relations_item`, `delete_*`, **Then** DDL và dòng meta như qua REST (006); `collections`, `fields`,
   `relations` đọc lại ở app kia thấy thay đổi (cache hệ thống dùng chung và cache schema GraphQL của mỗi instance
   đều bị xóa qua bus `schemaChanged`).
5. **Given** user app access, **When** `users_me`, `update_users_me`, `users_me_tfa_generate`, `users_me_tfa_enable`,
   `users_me_tfa_disable`, **Then** như Directus; `server_info`, `server_ping`, `server_health` trả cùng nội dung
   như REST của app mới (kể cả `websocket: false` và phần đổi thương hiệu đã ghi ở 001).
6. **Given** admin, **When** `extensions` và `update_extensions_item`, **Then** như D-37: danh sách với `schema`
   null, cập nhật trả lỗi như `PATCH /extensions/:pk`; `utils_cache_clear`, `utils_sort`, `utils_revert`,
   `utils_hash_*`, `utils_random_string` như REST của 010.

---

### User Story 4 - Schema theo từng user, introspection và SDL (Priority: P1)

Công cụ GraphQL (GraphiQL, codegen, SDK) chạy introspection ở `/graphql`, `/graphql/system` hoặc tải SDL ở
`/server/specs/graphql[/:scope]`; schema chỉ chứa collection, field, mutation user đó được phép và đổi ngay khi data
model hoặc quyền đổi ở app nào cũng được.

**Why this priority**: Là tiêu chí chấp nhận của mô tả ("introspection schema khớp với Directus cho cùng user").

**Independent Test**: Chạy query introspection chuẩn (`__schema` đầy đủ: type, field, arg, enum, input, union,
scalar, directive) ở hai app cho admin, user có quyền một phần, public (có và không có policy public), ở cả hai scope;
so kết quả; tải SDL ở hai app và so.

**Acceptance Scenarios**:

1. **Given** cùng data model và cùng user, **When** introspection ở `/graphql` và `/graphql/system`, **Then** tập
   type, field, arg, kiểu (kể cả non-null, list), giá trị enum, input, union, scalar, mô tả và directive giống
   Directus (SC-001); tên type, field, arg giống hệt (`<collection>`, `<collection>_filter`,
   `<collection>_aggregated`, `create_<collection>_input`, `delete_one`, `server_info`...).
2. **Given** user có quyền một phần, **When** introspection, **Then** chỉ có collection, field có quyền đọc, và
   mutation cho hành động được phép (create, update, delete tách riêng); collection không có field đọc được thì không
   có type; field có quyền khác nhau giữa các policy (không nhất quán) xử lý như Directus.
3. **Given** `GRAPHQL_INTROSPECTION=false`, **When** query chứa `__schema` hoặc `__type`, **Then**
   `400 GRAPHQL_VALIDATION` như Directus và `/server/specs/graphql` trả `404 ROUTE_NOT_FOUND`.
4. **Given** đổi quyền, thêm field, đổi tên collection ở app A (REST hoặc GraphQL), **When** introspection ở app B
   ngay sau đó với user bị ảnh hưởng, **Then** schema mới (cache schema GraphQL của mỗi instance bị xóa qua bus
   `schemaChanged`, như Directus).
5. **Given** `GET /server/specs/graphql` và `/server/specs/graphql/system`, **When** admin tải, **Then** nội dung SDL,
   `Content-Disposition` (`<project_name>_<yyyy-MM-dd>.graphql`), `Content-Type` giống Directus; `OPTIONS` trả
   `Allow: GET,HEAD` (gỡ D-15).
6. **Given** collection hoặc field có tên không hợp lệ với GraphQL (ký tự lạ, trùng tên dành riêng như `Query`,
   `Int`, `Date`, `Hash`), **When** sinh schema, **Then** collection, field đó bị bỏ với một dòng log cảnh báo như
   `sanitizeGraphqlSchema`; phần còn lại của schema vẫn sinh được.

---

### User Story 5 - Lỗi, giới hạn và cache giống Directus (Priority: P2)

Client nhận cùng status, mã lỗi, message, `extensions` (kể cả `errors` với `path`, `locations`) như Directus
cho mọi lỗi: parse, validation, thực thi, quyền, dữ liệu; cùng giới hạn token, concurrency sinh schema; cùng hành vi
cache response.

**Why this priority**: App Directus tách lỗi Insights theo `path` của `extensions.errors`; client dựa vào mã
lỗi. Không chặn luồng đọc ghi chính.

**Independent Test**: Gửi các document lỗi (sai cú pháp, field không có, arg sai kiểu, quá token, lỗi DB, `FORBIDDEN`
trong resolver, lỗi validation payload) ở hai app; so status, body (kể cả `locations`, `path`); đo cache hit.

**Acceptance Scenarios**:

1. **Given** document sai cú pháp hoặc quá `GRAPHQL_QUERY_TOKEN_LIMIT`, **When** gửi, **Then**
   `400 GRAPHQL_VALIDATION` với `extensions.errors` (message, `locations`) như Directus.
2. **Given** document hợp lệ nhưng một resolver lỗi (quyền, payload, DB), **When** chạy, **Then** `200` với `data`
   null tại field đó và `errors[].extensions.code` như Directus (`FORBIDDEN`, `INVALID_PAYLOAD`,
   `RECORD_NOT_UNIQUE`...), message admin thấy chi tiết, user thường thấy message rút gọn như `processError`;
   response có `errors` thì không cache.
3. **Given** query thành công qua `POST /graphql`, **When** gửi lại cùng document và variables ở app kia với cùng
   user, **Then** trúng response cache dùng chung (cùng khóa cache với Directus, 005) khi cache bật; header cache,
   `Cache-Control`, `Vary` như REST.
4. **Given** 10 user khác nhau gửi introspection đồng thời khi chưa có cache và
   `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT=1` (cặp `graphql-nointro`), **When** chạy, **Then** cả 10 trả `200` đúng
   schema của mình, không lỗi, không timeout; với `GRAPHQL_SCHEMA_CACHE_CAPACITY=2`, user thứ ba vẫn đúng (entry cũ
   bị đẩy và sinh lại).

---

### User Story 6 - Bộ test của Directus, E2E app Directus và benchmark chạy qua trên app mới (Priority: P2)

Phần GraphQL của tám file blackbox đã port chuyển sang gửi tới app đang thử; năm file blackbox chưa port được port;
unit của `services/graphql` được port; E2E app Directus qua proxy cho Insights và "Save as copy";
benchmark query GraphQL đọc nhiều.

**Why this priority**: Là tiêu chí chấp nhận của mô tả và cổng đóng feature.

**Independent Test**: Chạy bộ port với `TEST_DB=postgres`, `mysql`, `sqlite3` mỗi lần push, vendor còn lại ở
`nightly.yml`; proxy thêm `graphql` vào danh sách route đi tới app mới.

**Acceptance Scenarios**:

1. **Given** bộ port, **When** `requestGraphQL` gửi tới app mới (bỏ đường vòng về Directus của cặp), **Then** 100% ca
   đạt ở cả hai app; ca fail trên chính Directus được ghi chú như 005 đến 010.
2. **Given** E2E Playwright, **When** `/graphql`, `/graphql/system` đi tới app mới, **Then** dashboard Insights hiển
   thị và "Save as copy" ở trang chi tiết item cho kết quả như khi đi tới Directus.

---

### Edge Cases

- Scope `items` bỏ mọi collection `directus_*`; scope `system` bỏ collection người dùng và sáu collection trong
  danh sách loại trừ; `activity`, `revisions` chỉ đọc; `directus_permissions.permissions`, `validation`, `presets`
  là `JSON`; các collection này vẫn có type khi được tham chiếu qua quan hệ (ví dụ `user_created` trỏ `directus_users`
  trong scope `items`) như Directus.
- Type `Subscription` (`<collection>_mutated`): Directus sinh trong schema và introspection kể cả khi
  `WEBSOCKETS_ENABLED=false`; app mới giữ nguyên (FR-047, đã đo 2026-10-14: qua HTTP trả `data` null).
- `OPTIONS`, `HEAD` tới `/graphql` → `405 Allow: GET, POST` (đo 2026-10-14), không phải `200` như các router khác;
  `/graphql/<x>` → scope `items`, `/graphql/system/<x>` → `system`.
- `Query` rỗng (public không đọc được collection nào): một field `_empty: Void` "There's no data to query." như
  Directus; scope `system` vẫn có `server_*` và 17 mutation global (đo 2026-10-14).
- SDL của `/server/specs/graphql`: `Content-Type: application/octet-stream; charset=utf-8`, tên file
  `<project_name>_<yyyy-MM-dd>.graphql` với `project_name` của settings (mặc định "Directus", là dữ liệu, giữ nguyên);
  public tải được SDL theo quyền của mình (đo 2026-10-14).
- Khóa chính trả về luôn là chuỗi (`ID`); field số lớn là `GraphQLBigInt`; `Date` nhận và trả chuỗi ISO; filter của
  field `dateTime` nhận hàm `year`, `month`...; `_FUNC` trong selection (`year(date_created)`) tạo alias như Directus.
- Field có tên trùng tên dành riêng (`id` không, nhưng `Query`, `Mutation`, `Subscription`, `Int`, `Float`,
  `String`, `Boolean`, `DateTime`, `ID`, `uid`, `Point`, `PointList`, `Polygon`, `MultiPolygon`, `JSON`, `Hash`,
  `Date`, `Void`) hoặc tên không khớp `^[_A-Za-z][_0-9A-Za-z]*$` bị bỏ với log cảnh báo; collection có tên như vậy bị
  bỏ cùng mọi quan hệ tới nó.
- Field không nhất quán giữa các policy (`fetchInconsistentFieldMap`): kiểu trả về nullable và resolver trả null khi
  dòng đó không được phép, như Directus.
- Quyền đọc theo filter: schema không đổi, dữ liệu bị lọc ở engine; `<collection>_by_id` của item ngoài filter quyền
  trả `200` với `data: { <c>_by_id: null }` và `errors[]` mang `FORBIDDEN` (resolver ném `ForbiddenError` như REST
  `403`, `processError` giữ code); so nguyên văn với Directus (US1 kịch bản 2).
- Cache schema theo khóa `scope_type_role_user` trong bộ nhớ của từng instance; chỉ xóa khi `schemaChanged`
  (collection, field, relation, quyền, policy, role, access, user đổi qua service). Đổi trực tiếp trong DB không xóa
  cache ở cả Directus lẫn app mới (cùng hành vi). Hai user cùng role vẫn có hai entry (khóa có `user`).
- `MAX_BATCH_MUTATION` áp cho `create_<c>_items`, `update_<c>_items`, `update_<c>_batch`, `delete_<c>_items` và ghi
  lồng như REST. `QUERY_LIMIT_DEFAULT`, `QUERY_LIMIT_MAX` áp cho arg `limit` như REST (`limit: -1` theo cấu hình).
- Mutation qua `/graphql/system` cho `users`, `roles`, `policies`, `permissions`, `access` xóa cache quyền dùng chung
  và `schemaChanged` như REST (004); `update_users_me` đi qua `UsersService.updateOne` với cùng kiểm tra như
  `PATCH /users/me` (003, 004: user thường không đổi được `role`, `status`, `token`, `email` theo quyền tối thiểu).
- Document có cả query và mutation (nhiều operation): `operationName` chọn; không có `operationName` thì lỗi như
  Directus. `GET` với `operationName` trỏ tới mutation → `405`.
- Lỗi trong `execute` (ngoài resolver, ví dụ variable sai kiểu) → `400 GRAPHQL_EXECUTION`; lỗi validation
  có `path` được thêm từ `addPathToValidationError`.
- Response cache: `/graphql` được cache cho `POST` (khác REST chỉ cache `GET`); mutation và response có `errors`
  không cache; `CACHE_SKIP_ALLOWED` và `Cache-Control: no-store` áp như REST; app Directus gửi Insights với header
  bỏ cache.
- `server_specs_graphql` trong scope `system` trả chuỗi SDL của chính scope được hỏi; `server_specs_oas` trả JSON
  OpenAPI đã đổi thương hiệu như REST (001).
- `extensions` query, `update_extensions_item` (D-37), `users_invite` (D-27), `auth_password_request` (D-23),
  `users_register` (D-28): cùng hành vi với route REST tương ứng, không có khác biệt riêng của GraphQL.
- Bus Redis mất kết nối: cache schema của instance giữ nguyên tới khi bus nối lại (ioredis tự subscribe lại) và có
  `schemaChanged` mới, hoặc entry bị đẩy khỏi LRU; như Directus (cùng `@directus/memory` port).
- SIGTERM khi đang sinh schema hoặc đang chờ trong hàng đợi: request đó nằm trong "request đang dở" của luồng tắt
  (001), được chạy nốt trong `SHUTDOWN_TASK_TIMEOUT`; không có việc nền nào ngoài request.
- Lỗi khi sinh schema (ví dụ `buildSchema` ném vì tên bắt đầu `__`, không bị `sanitizeGraphqlSchema` lọc): lan ra
  `500 INTERNAL_SERVER_ERROR` của request đó ở cả hai app, không cache, request sau sinh lại (FR-045); bộ đối chiếu
  so nguyên văn với field tên `__x` trên collection tạm.
- `GRAPHQL_SCHEMA_CACHE_CAPACITY`, `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT`, `GRAPHQL_QUERY_TOKEN_LIMIT` không
  phải số nguyên dương: cấu hình không hợp lệ ở cả hai app (Directus không kiểm, hành vi phụ thuộc thư viện LRU và
  semaphore), không hỗ trợ và không kiểm; vận hành dùng cùng `.env` nên giá trị hợp lệ như Directus.

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| US1 | 1–6 | FR-001 đến FR-005, FR-010 đến FR-016 | SC-002, SC-003 |
| US2 | 1–6 | FR-001 đến FR-005, FR-020 đến FR-025 | SC-002, SC-003, SC-004 |
| US3 | 1–6 | FR-001, FR-030 đến FR-036 | SC-002, SC-003, SC-004 |
| US4 | 1–6 | FR-040 đến FR-047 | SC-001, SC-005 |
| US5 | 1–4 | FR-050 đến FR-054 | SC-002, SC-006 |
| US6 | 1–2 | FR-060 đến FR-065 | SC-002, SC-007 |

## Clarifications

### Session 2026-10-14

- Q: Directus 11.17.4 luôn sinh type `Subscription` (`<collection>_mutated`) kể cả khi `WEBSOCKETS_ENABLED=false`;
  mô tả yêu cầu "không làm subscription" và "introspection khớp": giữ hay bỏ type này? → A: Giữ type `Subscription`
  trong schema HTTP như Directus (introspection khớp nguyên văn, không có khác biệt mới); operation `subscription`
  gửi qua HTTP làm giống Directus (đo khi implement); transport WebSocket vẫn ngoài phạm vi (D-17) (FR-040, FR-047).
- Q: So introspection và SDL (SC-001) theo cách nào: sắp theo tên rồi so, hay nguyên văn kể cả thứ tự? → A: So
  nguyên văn JSON introspection và văn bản SDL (kể cả thứ tự type, field, arg, enum value, input field,
  possibleTypes); lệch thứ tự là khác biệt phải ghi vào bảng khác biệt và tech lead duyệt như mọi khác biệt khác
  (FR-041, FR-060, SC-001).
- Q: Năm file blackbox chưa port (`login`, `refresh`, `redact`, `ping`, `health`): port nguyên file hay chỉ ca
  GraphQL? → A: Port nguyên năm file (REST và GraphQL) chạy với cả hai app, như tiền lệ 005 đến 010; `redact.test.ts`
  đọc log container của app đang thử như `mail.test.ts` của 010 (FR-061).

## Requirements *(mandatory)*

### Functional Requirements

**Route và hành vi chung**

- **FR-001**: App mới PHẢI phục vụ `/graphql` (scope `items`, kể cả mọi path con `/graphql/<x>`) và
  `/graphql/system` (scope `system`, kể cả `/graphql/system/<x>`) với cùng chuỗi xử lý như `controllers/graphql.ts` và
  `middleware/graphql.ts` của Directus 11.17.4: chỉ `GET`, `POST` (method khác, kể cả `OPTIONS`, `HEAD`:
  `405 METHOD_NOT_ALLOWED` với `Allow: GET, POST` và body như Directus, đo 2026-10-14); `GET` đọc `query`, `variables` (JSON), `operationName` từ query
  string, `POST` đọc từ body JSON; thiếu `query` → `400 INVALID_PAYLOAD` "Must provide query string"; `variables`
  không phải JSON → `400 INVALID_QUERY` "Variables are invalid JSON"; parse với giới hạn
  `GRAPHQL_QUERY_TOKEN_LIMIT`; mutation qua `GET` → `405` với `Allow: POST`; `OPTIONS`, `HEAD` qua `router-options`
  như các route khác (001).
- **FR-002**: Response PHẢI là `{ data, errors, extensions }` do `execute` của GraphQL tạo, đi qua `respond` như
  Directus: status `200` khi document hợp lệ (kể cả khi có `errors` từ resolver); `400 GRAPHQL_VALIDATION`
  với `extensions.errors[]` (`message`, `locations`, `path` khi có) cho lỗi parse hoặc validation;
  `400 GRAPHQL_EXECUTION` cho lỗi thực thi ngoài resolver; mỗi lỗi resolver qua `processError` (FR-051): lỗi là
  `DirectusError` thì ai cũng thấy nguyên message và `extensions`; lỗi khác thì admin thấy message gốc với
  `INTERNAL_SERVER_ERROR`, user thường thấy "An unexpected error occurred.".
- **FR-003**: Mọi resolver PHẢI gọi đúng service của collection qua `getService` (ItemsService hoặc service hệ thống,
  004 đến 010) với accountability của request, để quyền, activity, revision, event, flow, xóa cache, validation
  payload và dòng DB giống hệt như cùng thao tác qua REST.
- **FR-004**: Response cache PHẢI làm như Directus: `/graphql` và `/graphql/system` được cache cho cả `POST` (khóa
  cache dùng chung với Directus: `object-hash` của `user`, `role`, path, `query` = `{ query, variables }` thay
  `sanitizedQuery`, `ip` khi policy có `ip_access`, `version` tương thích 11.17.4, như `get-cache-key.ts`), không cache khi operation là
  mutation, khi response có `errors`, khi `Cache-Control: no-store` và `CACHE_SKIP_ALLOWED`, hoặc khi cache tắt;
  header cache như REST.
- **FR-005**: Biến `GRAPHQL_INTROSPECTION`, `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT`, `GRAPHQL_QUERY_TOKEN_LIMIT`,
  `GRAPHQL_SCHEMA_CACHE_CAPACITY` PHẢI được đọc với cùng tên, kiểu và mặc định như Directus và chuyển khỏi nhóm
  "chưa hỗ trợ"; `WEBSOCKETS_GRAPHQL_*` ở lại nhóm WebSocket (chỉ cảnh báo, D-17).

**Đọc dữ liệu (scope `items` và collection hệ thống trong scope `system`)**

- **FR-010**: Với mỗi collection đọc được, schema PHẢI có query `<name>` (danh sách với arg `filter`, `sort`,
  `limit`, `offset`, `page`, `search`; singleton chỉ có arg `version`), và với collection không singleton
  `<name>_by_id(id: ID!, version: String)` và `<name>_aggregated`; ở scope `items` thêm `<name>_by_version` cho mọi
  collection, arg theo thứ tự `version: String!` rồi `id: ID!` (singleton chỉ `version: String!`), như
  `schema/read.ts:689-700` và `schema/index.ts:220` của Directus; `<name>` là tên collection ở scope `items` và tên bỏ
  tiền tố `directus_` ở scope `system`; kiểu và tên arg đúng như Directus.
- **FR-011**: Type đọc `<name>` PHẢI có đúng field với kiểu scalar như `get-types.ts` (`String`, `Int`, `Float`,
  `Boolean`, `GraphQLBigInt`, `Date`, `JSON`, `Hash`, `GraphQLGeoJSON`, `GraphQLStringOrFloat`, `ID` cho khóa chính,
  non-null và nullable như Directus); field quan hệ m2o, o2m, m2m trỏ type của collection liên quan với arg danh
  sách riêng; m2a là union `<collection>_<field>_union`; field alias hàm `<field>_func` với kiểu hàm ngày giờ và
  `count`.
- **FR-012**: Input `<name>_filter` PHẢI có mọi toán tử của Directus cho từng kiểu field (`_eq`, `_neq`, `_lt`,
  `_lte`, `_gt`, `_gte`, `_in`, `_nin`, `_null`, `_nnull`, `_contains`, `_icontains`, `_ncontains`, `_starts_with`,
  `_istarts_with`, `_nstarts_with`, `_nistarts_with`, `_ends_with`, `_iends_with`, `_nends_with`, `_niends_with`,
  `_between`, `_nbetween`, `_empty`, `_nempty`, `_intersects`, `_nintersects`, `_intersects_bbox`,
  `_nintersects_bbox`, `_regex`), `_and`, `_or`, lọc qua quan hệ, `<name>_quantifier_filter` với `_some`, `_none`,
  và filter hàm ngày giờ, đúng tên và kiểu như Directus.
- **FR-013**: Selection set, alias, fragment, inline fragment trên union, `__typename`, variables và `operationName`
  PHẢI được đổi thành `Query` của engine như `parse-query.ts`, `parse-args.ts`, `replace-fragments`,
  `replace-funcs`, `filter-replace-m2a`, `dedupe-resolvers`, để một request GraphQL sinh cùng truy vấn DB và cùng dữ
  liệu như request REST tương đương (bộ blackbox so hai bên).
- **FR-014**: `<name>_aggregated` PHẢI hỗ trợ `count`, `countDistinct`, `countAll`, `sum`, `sumDistinct`, `avg`,
  `avgDistinct`, `min`, `max`, `group` với arg `groupBy`, `filter`, `limit`, `offset`, `page`, `search`, `sort`, cùng
  kiểu trả về và cùng giá trị như REST `aggregate`, `groupBy` (005), kể cả khác biệt kiểu số theo vendor đã ghi.
- **FR-015**: Khóa chính PHẢI trả dạng chuỗi (`ID`) ở mọi cấp; giá trị ngày giờ, JSON, số lớn, geometry PHẢI đi qua
  scalar tùy chỉnh để chuỗi trả về giống Directus từng ký tự.
- **FR-016**: `GET` và `POST` PHẢI cho cùng kết quả với cùng document, variables, operationName.

**Ghi dữ liệu**

- **FR-020**: Với mỗi collection user được tạo, sửa, xóa, schema PHẢI có mutation `create_<name>_item(data)`,
  `create_<name>_items(data: [...])`, `update_<name>_item(id, data)`, `update_<name>_items(ids, data)`,
  `update_<name>_batch(data: [...])`, `delete_<name>_item(id)`, `delete_<name>_items(ids)`; singleton có
  `update_<name>(data)`; `activity`, `revisions` không có mutation; collection không có quyền hành động nào thì không
  có mutation đó (schema theo quyền create, update, delete tách riêng).
- **FR-021**: Input `create_<name>_input`, `update_<name>_input` PHẢI có đúng field, kiểu, non-null như Directus, kể
  cả input lồng cho quan hệ (m2o input của collection liên quan, o2m và m2m với `create`, `update`, `delete`, m2a).
- **FR-022**: Mutation PHẢI gọi `createOne`, `createMany`, `updateOne`, `updateMany`, `updateBatch`, `deleteOne`,
  `deleteMany`, `upsertSingleton` của service rồi đọc lại theo selection (có quyền đọc) như Directus; không chọn
  field trả về thì trả như Directus (`true` cho singleton; `delete_*` trả `{ id }`, `{ ids }`).
- **FR-023**: Tác động của mutation (dòng DB, `directus_activity`, `directus_revisions`, event `items.create|update|
  delete` và `<collection>.items.*`, flow theo event, xóa data cache và cache quyền, cầu nối `websocket.event`)
  PHẢI giống như cùng thao tác qua REST ở app mới.
- **FR-024**: `MAX_BATCH_MUTATION`, `QUERY_LIMIT_*`, validation payload, `RECORD_NOT_UNIQUE`, `FORBIDDEN` PHẢI áp và
  trả về như REST, đóng gói thành `errors[]` theo FR-002.
- **FR-025**: Mutation trong `/graphql/system` cho `users`, `roles`, `policies`, `permissions`, `access`, `settings`,
  `files`, `folders`, `flows`, `operations`, `presets`, `notifications`, `shares`, `translations`, `dashboards`,
  `panels`, `versions`, `comments` PHẢI qua service hệ thống tương ứng (003 đến 010) với cùng hành vi riêng (băm mật
  khẩu, kiểm quyền `share`, chặn trùng translation, xóa cache quyền...).

**Thao tác hệ thống (`/graphql/system`)**

- **FR-030**: Schema `system` PHẢI có query `server_ping`, `server_info`, `server_health`, `server_specs_oas`,
  `server_specs_graphql(scope)`, `users_me`, `collections`, `collections_by_name`, `fields`, `fields_by_name`,
  `fields_in_collection`, `relations`, `relations_by_name`, `relations_in_collection`, `extensions` (admin) với
  type, arg và điều kiện hiện diện (theo quyền, `GRAPHQL_INTROSPECTION`) như `resolvers/system.ts`,
  `system-admin.ts`; `server_info` trả cùng nội dung như `GET /server/info` của app mới (gồm `websocket: false` và
  các mục đổi thương hiệu đã ghi ở 001).
- **FR-031**: Schema `system` PHẢI có mutation `auth_login`, `auth_refresh`, `auth_logout`, `auth_password_request`,
  `auth_password_reset`, `users_me_tfa_generate`, `users_me_tfa_enable`, `users_me_tfa_disable`,
  `utils_random_string`, `utils_hash_generate`, `utils_hash_verify`, `utils_sort`, `utils_revert`,
  `utils_cache_clear`, `users_invite_accept`, `users_register`, `users_register_verify`, `update_users_me`,
  `users_invite`, và cho admin `create|update|delete_collections_item`, `create|update|delete_fields_item`,
  `update_fields_items`, `create|update|delete_relations_item`, `update_extensions_item`, với arg, kiểu trả về và
  enum (`auth_mode`) như Directus.
- **FR-032**: `auth_login(email, password, mode, otp)`, `auth_refresh`, `auth_logout` PHẢI tái dùng luồng đăng nhập,
  refresh, đăng xuất của 003: cùng response, cookie theo `mode` (`json`, `cookie`, `session`), `otp` cho user bật TFA
  (thiếu hoặc sai → `INVALID_OTP` như REST), dòng `directus_sessions`, `directus_activity`, bộ đếm đăng nhập sai và
  rate limiter dùng chung; token dùng chéo được với Directus.
- **FR-033**: `auth_password_request`, `users_invite`, `users_register` PHẢI chạy đúng luồng của route REST tương
  ứng ở app mới (không gửi email, ghi log cảnh báo: D-23, D-27, D-28) và trả về như Directus (kể cả thời gian chờ
  giả của `auth_password_request`).
- **FR-034**: Mutation data model (`*_collections_item`, `*_fields_item(s)`, `*_relations_item`) PHẢI gọi
  `CollectionsService`, `FieldsService`, `RelationsService` (006) với cùng DDL, dòng meta, xóa cache hệ thống và
  `schemaChanged` như REST; `collections`, `fields`, `relations` đọc qua cùng service với cùng cấu trúc `meta`,
  `schema` như REST.
- **FR-035**: `extensions`, `update_extensions_item` PHẢI làm như D-37 (`GET /extensions` trả dòng với `schema` null;
  cập nhật trả lỗi như `PATCH /extensions/:pk`); `utils_*` PHẢI gọi `UtilsService`, `RevisionsService.revert` (010).
- **FR-036**: `users_me`, `update_users_me`, `users_me_tfa_*` PHẢI làm như `/users/me`, `/users/me/tfa/*` (003).

**Schema theo user, introspection, SDL và cache schema**

- **FR-040**: Schema PHẢI được sinh từ `SchemaOverview` hiện hành và quyền của user: admin hoặc không có accountability
  thì toàn bộ schema đã làm sạch; user khác thì `reduceSchema` theo `fetchAllowedFieldMap` cho từng hành động read,
  create, update, delete và `fetchInconsistentFieldMap` (004: field chỉ được phép ở một phần policy thành
  nullable và resolver trả `null` khi dòng không được phép), bằng cùng quy tắc như `generateSchema` của Directus;
  scope `items` bỏ collection hệ thống, scope `system` chỉ lấy collection hệ thống trừ `SYSTEM_DENY_LIST`. Token
  share (accountability có `share`, `user` null, `role` của share) sinh schema theo quyền của share như REST
  (`getPermissionsForShare`, 004).
- **FR-041**: Kết quả introspection (`__schema`, `__type`) ở `/graphql` và `/graphql/system` cho cùng user và cùng
  data model PHẢI khớp nguyên văn với Directus, kể cả thứ tự (SC-001, Clarifications); tên type, field, arg, enum
  value, input, union, scalar, directive và mô tả giống hệt (Nguyên tắc IX giữ tên type GraphQL, kể cả `directus_*`
  trong tên type của scope `system`).
- **FR-042**: `GRAPHQL_INTROSPECTION=false` PHẢI thêm quy tắc chặn introspection vào validation (lỗi như Directus)
  và tắt `/server/specs/graphql` (`404 ROUTE_NOT_FOUND`) và query `server_specs_graphql`; `server_specs_oas` chỉ phụ
  thuộc `OPENAPI_ENABLED` như Directus (`resolvers/system.ts`).
- **FR-043**: `GET /server/specs/graphql/:scope?` (`items` mặc định, `system`; scope khác `404`) PHẢI trả SDL in từ
  schema của user gọi (`printSchema` như Directus, public cũng tải được), `Content-Disposition: attachment;
  filename="<project_name>_<yyyy-MM-dd>.graphql"`, `Content-Type: application/octet-stream; charset=utf-8` (đo
  2026-10-14); `HEAD` → `200`, `OPTIONS` → `200 Allow: GET,HEAD` như Directus. Gỡ D-15.
- **FR-044**: Schema sinh ra PHẢI được cache trong bộ nhớ mỗi instance theo khóa `scope_type_role_user` (`role`,
  `user` là `undefined` khi public; token share có `role` của share và `user` `undefined`, như Directus), tối đa
  `GRAPHQL_SCHEMA_CACHE_CAPACITY` entry (LRU), và PHẢI bị xóa toàn bộ khi nhận `schemaChanged` trên bus Redis dùng
  chung (phát bởi cả Directus và app mới khi collection, field, relation, quyền, policy, role, access, user đổi), như
  Directus và Nguyên tắc VII. Không có Redis thì cache chỉ xóa trong instance, như Directus. Khởi động không sinh
  schema trước (cache rỗng, chỉ subscribe bus); schema sinh ở request đầu của mỗi khóa.
- **FR-045**: Sinh schema PHẢI được giới hạn bởi semaphore `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT` mỗi instance
  với kiểm cache lần hai sau khi vào semaphore, không timeout khi chờ, như Directus; lỗi khi sinh schema lan ra
  response của request đó (`500 INTERNAL_SERVER_ERROR` qua `respond`), không được cache, request sau sinh lại.
- **FR-046**: `sanitizeGraphqlSchema` PHẢI bỏ collection, field có tên không hợp lệ hoặc trùng tên dành riêng (danh
  sách 18 tên và regex ở Edge Cases, như Directus) với cùng dòng log cảnh báo (đổi thương hiệu nếu có chữ Directus), và bỏ relation trỏ tới
  collection bị bỏ.
- **FR-047**: Schema PHẢI có type `Subscription` với field `<collection>_mutated(event)` (tên collection đầy đủ, kể
  cả `directus_*`, ở cả hai scope, cho mọi collection có type đọc, không lọc theo scope) và type `<collection>_mutated`
  (`key`, `event`, `data`), enum `EventEnum`, giống Directus kể cả khi WebSocket tắt (Clarifications). Operation
  `subscription` qua `POST` PHẢI trả `200 { data: { <collection>_mutated: null } }` như Directus 11.17.4 (đo
  2026-10-14, plan research R12.2); schema không có `Subscription` (không đọc được collection nào) trả `200` với
  `errors[].extensions.code = INTERNAL_SERVER_ERROR` như Directus; qua `GET` trả `405`. Không có transport WebSocket
  (D-17).

**Lỗi, giới hạn**

- **FR-050**: Mã lỗi, message, `extensions` của mọi lỗi GraphQL PHẢI giống Directus: `GRAPHQL_VALIDATION`,
  `GRAPHQL_EXECUTION` (400), lỗi resolver trong `errors[]` của response `200` với `extensions.code` của
  `DirectusError` (`name` giữ `DirectusError`, 009) và `path`, `locations`.
- **FR-051**: `processError` PHẢI làm như Directus: admin và lỗi là `DirectusError` thì giữ message, `extensions`;
  user thường thì lỗi không phải `DirectusError` thành `INTERNAL_SERVER_ERROR` "An unexpected error occurred" và lỗi
  gốc được ghi log; lỗi validation GraphQL giữ nguyên.
- **FR-052**: Scalar tùy chỉnh PHẢI báo lỗi sai kiểu (ví dụ `Date` không parse được, `Hash` không được đọc giá trị,
  `BigInt` ngoài khoảng) với cùng message như Directus.
- **FR-053**: Mọi dòng log mới (cảnh báo tên không hợp lệ, lỗi resolver nội bộ) PHẢI mang tiền tố "Backoffice:" khi
  là log riêng của app mới, giữ nguyên message khi là log Directus cũng ghi (đổi chữ Directus nếu có, Nguyên tắc IX).
- **FR-054**: Request GraphQL PHẢI đi qua cùng middleware như REST (authenticate, rate limiter, CORS, `schema`,
  `cache`, request id, log http). Directus không có metric theo route (`/metrics` chỉ có sức khỏe DB, cache, Redis,
  storage), nên không có gì thêm cho GraphQL.

**Kiểm thử**

- **FR-060**: Bộ đối chiếu `tests/parity/src/graphql` PHẢI gửi cùng document tới hai app (admin, user có quyền một
  phần, public, token share) và so status, body (`data`, `errors` kể cả `locations`, `path`, `extensions`), header
  cache, dòng DB cho mutation, log cảnh báo cho FR-033; gồm introspection đầy đủ và SDL ở cả hai scope cho mỗi loại
  user, so theo SC-001; gồm ca dùng chéo: mutation ở app này, query ở app kia; `schemaChanged` phát từ Directus xóa
  cache schema của app mới và ngược lại, kể cả cả hai replica của cặp `multi` (001); token `auth_login` của app này
  dùng ở app kia. Ca `GRAPHQL_INTROSPECTION=false`,
  `GRAPHQL_QUERY_TOKEN_LIMIT=50` (document 60 token bị từ chối), `GRAPHQL_SCHEMA_CACHE_CAPACITY=2`,
  `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT=1` (10 user khác nhau gửi đồng thời đều `200`, US5 kịch bản 4)
  chạy trên một cặp profile riêng `graphql-nointro` (cùng DB, Redis và namespace với cặp chính; vào `--profiles` của
  CI Postgres, không phải profile tay), vì các biến này chỉ đọc lúc khởi động.
- **FR-061**: Phần GraphQL của tám file blackbox đã port (`no-relation`, `o2m`, `m2m`, `m2o`, `m2a`, `singleton`,
  `fields/crud`, `collections/crud`) PHẢI gửi tới app đang thử như phần REST (bỏ đường vòng `getDirectusUrl` cho
  GraphQL ở `common/transport.ts`, `common/config.ts`), và năm file chưa port (`common/auth/login.test.ts`,
  `refresh.test.ts`, `common/logger/redact.test.ts`, `server/ping.test.ts`, `health.test.ts`) PHẢI được port nguyên
  file (cả ca REST lẫn GraphQL, giữ nguyên văn blackbox, chỉ đổi URL; Clarifications) chạy với cả hai app;
  `redact.test.ts` đọc log container của app đang thử như `mail.test.ts` (010) để kiểm mật khẩu bị che trong
  `auth_login`; ca WebSocket của `login.test.ts` bỏ như các file items đã port (D-17); `health.test.ts` bỏ SMTP giả và
  so mục `email` của `server_health` theo D-07 như `src/server/health.test.ts` của 001; 100% ca đạt; ca fail trên
  chính Directus ghi chú như 005 đến 010.
- **FR-062**: Unit test của `services/graphql` (tám file ở đầu spec) PHẢI được port và đạt.
- **FR-063**: E2E Playwright app Directus qua proxy (004) PHẢI thêm kịch bản: "Save as copy" ở trang chi tiết một
  item có `item_duplication_fields` gồm field quan hệ (app Directus chỉ gọi GraphQL ở `saveAsCopy`,
  `use-item/index.ts`, plan research R11); dashboard Insights với panel metric, list trên collection người dùng và
  panel trên collection hệ thống; `graphql` thêm vào `tests/parity/proxy/backoffice-routes.txt`.
- **FR-064**: Benchmark PHẢI thêm kịch bản GraphQL: danh sách có quan hệ lồng, `_by_id`, aggregate, introspection
  (schema đã cache) và mutation tạo item, với cùng cách so như 005 (p95, throughput không tệ hơn Directus quá 10%);
  đo thêm thời gian sinh schema lần đầu (không cache) cho data model của bộ đối chiếu, chỉ ghi nhận.
- **FR-065**: Cổng đóng feature gồm ba phần, phần nào đỏ cũng chặn: (1) 13 file blackbox ở FR-061 đạt với app mới
  là mục tiêu; (2) bộ đối chiếu FR-060 và unit port FR-062 đạt trên Postgres, MySQL, SQLite; (3) E2E FR-063 đạt. Benchmark
  FR-064 báo cáo hằng tuần, không chặn (ngoại lệ 003).

### Key Entities

- **Schema GraphQL theo user**: tập type, query, mutation sinh từ data model và quyền của một user cho một scope;
  định danh bởi scope, loại (schema hoặc SDL), role, user; sống trong cache của từng instance tới khi data model hoặc
  quyền đổi.
- **Scope**: `items` (collection người dùng, tên giữ nguyên) và `system` (collection hệ thống, tên bỏ tiền tố, cộng
  thao tác hệ thống).
- **Document GraphQL**: query, mutation (subscription chỉ có trong schema, FR-047) với variables, operationName; được đổi thành
  `Query` của engine (fields, filter, sort, limit, offset, page, search, aggregate, groupBy, deep, alias, version).
- **Kết quả**: `data`, `errors` (message, locations, path, extensions.code), `extensions`; được cache như response REST.
- **Lỗi GraphQL**: lỗi validation, thực thi (400) và lỗi resolver (200 với `errors`), cùng mã và message như Directus.

## Khác biệt so với Directus *(mandatory)*

Thay đổi với bảng khác biệt của các feature trước:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-09.9 | Gỡ: `/graphql`, `/graphql/system` làm ở feature này | FR-001 |
| D-15 | Gỡ: `/server/specs/graphql[/:scope]` làm ở feature này | FR-043 |

Giữ nguyên: D-17 (WebSocket: không có GraphQL qua WebSocket, `WEBSOCKETS_GRAPHQL_*` chỉ cảnh báo), D-23, D-27, D-28,
D-33 (email → log, áp cho `auth_password_request`, `users_invite`, `users_register` qua GraphQL), D-37 (`extensions`,
`update_extensions_item`), và các mục đổi thương hiệu của `/server/info`, `/server/specs/oas` (001) áp cho
`server_info`, `server_specs_oas`. Sửa bảng của spec cũ đi cùng feature này: dòng D-09.9 và D-15 trong spec 001;
entry tương ứng trong `tests/parity/accepted-differences.ts`; `tests/parity/proxy/backoffice-routes.txt` thêm
`graphql`. Mọi dòng cần tech lead duyệt khi đóng feature (Nguyên tắc X).

Khác biệt mới: Không có. Type `Subscription` giữ như Directus (Clarifications, FR-047); GraphQL qua WebSocket thuộc
D-17.

**Rủi ro chấp nhận (tái tạo từ Directus)**: như quy tắc của 004 đến 010. Các dòng dưới tìm từ đọc code, đã đo trên
Directus 11.17.4 ngày 2026-10-14 và tái tạo ở app mới; cần tech lead duyệt khi đóng feature.

| Mã | Hành vi của Directus | Bằng chứng | Hệ quả |
|----|----------------------|------------|--------|
| R-30 | Cache schema GraphQL theo khóa `scope_type_role_user` chỉ xóa khi `schemaChanged`; đổi quyền, role, data model trực tiếp trong DB (không qua service) không xóa; `schemaChanged` tới giữa lúc đang sinh thì schema cũ vẫn được `set` sau đó | `services/graphql/schema-cache.ts`, `schema/index.ts`, `cache.ts` (`clearSystemCache`); đo 2026-10-14 (Postgres, MySQL): quyền đọc ghi thẳng vào `directus_permissions` cho user C → `__type` của collection vẫn rỗng ở cả hai app, sau `POST /utils/cache/clear?system` thì có field ở app mới. Ca: `src/graphql/schema.test.ts` "R-30" | User thấy schema cũ tới khi có `schemaChanged` kế tiếp hoặc entry bị đẩy khỏi LRU hoặc instance khởi động lại. Tái tạo (FR-044) |
| R-31 | `/graphql` cache response cho `POST` theo body; `parseGraphQL` không giới hạn kích thước ngoài `MAX_PAYLOAD_SIZE` và `GRAPHQL_QUERY_TOKEN_LIMIT` | `middleware/respond.ts`, `middleware/graphql.ts`; đo 2026-10-14 trên cặp `cache-redis-purge`: `{ server_ping }` rồi `{  server_ping }` → số khóa `sets:namespace:parity-cache-redis-purge:*` tăng. Ca: `src/graphql/cache.test.ts` "R-31" | Mỗi document khác nhau là một entry cache; client sinh document ngẫu nhiên làm đầy data cache như Directus. Tái tạo (FR-004) |
| R-32 | Sinh schema cho user chưa có cache tốn CPU theo kích thước data model; chỉ giới hạn bằng semaphore mỗi instance, không giới hạn số user; cache giữ tới `GRAPHQL_SCHEMA_CACHE_CAPACITY` (100) `GraphQLSchema` trong bộ nhớ, không giới hạn theo byte | `schema/index.ts` (`generateSchema`), `schema-cache.ts` | Nhiều user khác nhau cùng lúc xếp hàng chờ sinh schema; bộ nhớ tăng theo số user × kích thước schema. Bằng chứng: đo 2026-10-14 (benchmark local, chỉ tham khảo): sinh schema admin lần đầu Directus 126 ms, app mới 98 ms trên data model benchmark; RSS sau 15 kịch bản Directus 782 MiB, app mới 539 MiB. Tái tạo (FR-045) |
| R-33 | `resolveMutation` gọi `getQuery` với tên field chưa bỏ hậu tố (`create_<c>_item`) làm collection, nên m2a trong selection của mutation không được nhận ra và mọi inline fragment bị gộp thành một danh sách field | `resolvers/mutation.ts:16-21`; đo 2026-10-14 trên Directus 11.17.4: `create_<c>_item { blocks { item { ... on <text> { body } } } }` → `200`, `data` null, `errors[0]` `FORBIDDEN` "field \"body\" in collection \"<quote>\""; hai fragment → `FORBIDDEN` field của collection kia; cùng kết quả ở app mới. Ca: `src/graphql/write.test.ts` "m2a inline fragments in the selection of a mutation" | Client chọn field của item m2a trong mutation nhận lỗi, dòng vẫn được ghi; đọc lại bằng query thường thì đúng. Tái tạo (FR-022) |

**Thư viện như Directus**: cache schema dùng `mnemonist` 0.40.3 (`LRUMap`), hàng đợi sinh schema dùng `async-mutex`
0.5.0 (`Semaphore`), cùng bản Directus 11.17.4; `schema-cache.ts` và `schema/index.ts` port nguyên văn (owner chọn
2026-10-14, thay phương án dùng lại `lru-cache`, `p-queue` của plan ban đầu). Không có lệch mã gốc cần duyệt.

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. Tên type GraphQL (kể cả `directus_users`, `directus_files`... trong scope `system`), tên scalar, tên
  query, mutation, enum, mã lỗi giữ nguyên vì client và introspection dựa vào (Nguyên tắc IX). Description trong
  schema chỉ đến từ sáu mô tả scalar cố định ("ISO8601 Date values", "BigInt value", "A Float or a String", "GeoJSON
  value", "Represents NULL values", "Hashed string values"), "There's no data to query." và `note` của field (dữ liệu
  dùng chung); đọc mã `services/graphql` ngày 2026-10-14 không có description nào chứa chữ "Directus", nên không có
  mục đổi thương hiệu và bộ so không bỏ qua gì.

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4. Khi spec không nói rõ, làm như code `services/graphql` của Directus. Quy ước
  message lỗi và quy tắc so của bộ đối chiếu như Assumptions của 004 đến 010.
- "Introspection khớp" (SC-001, Clarifications): so nguyên văn (deep-equal như bộ đối chiếu hiện có) kết quả JSON
  của query introspection chuẩn (`getIntrospectionQuery` của `graphql` với `descriptions`, `specifiedByUrl`,
  `directiveIsRepeatable`, `schemaDescription`, `inputValueDeprecation` bật) và văn bản SDL, kể cả thứ tự type, field, arg, enum value, input field,
  possibleTypes. Lệch thứ tự là khác biệt phải ghi và duyệt, không được bỏ qua bằng cách sắp lại. Mô tả type có chữ
  "Directus" (nếu đo thấy) so sau khi đổi thương hiệu, ghi vào danh sách đổi thương hiệu.
- Tiêu chí "các blackbox test GraphQL chạy qua": cổng đóng feature gồm ba phần, phần nào đỏ cũng chặn: (1) tám file
  blackbox đã port chuyển phần GraphQL sang app đang thử và năm file blackbox chưa port được port (FR-061); (2) bộ đối
  chiếu hai app gồm introspection và SDL theo loại user (FR-060) và unit port (FR-062); (3) E2E app Directus qua
  proxy (FR-063). Directus không có bộ blackbox riêng cho GraphQL nên không viết thêm bộ blackbox mới.
- Subscription: transport WebSocket (`graphql-ws`, `WEBSOCKETS_GRAPHQL_*`, `subscription.ts`,
  `websocket/controllers/graphql.ts`) ngoài phạm vi (Nguyên tắc XI, D-17), không port. Type `Subscription` trong
  schema HTTP giữ như Directus (Clarifications, FR-047); hàm `subscribe` của Directus không bao giờ được gọi qua HTTP
  nên không cần port.
- Tiền đề dùng chung `.env` (Nguyên tắc VIII): hai app cùng `GRAPHQL_*`, `CACHE_*`, `MAX_BATCH_MUTATION`,
  `QUERY_LIMIT_*`, cùng Redis và namespace, nên response cache và `schemaChanged` là chung; cache schema GraphQL là
  của từng instance như Directus (Nguyên tắc VII cho phép vì dựng lại từ DB và xóa qua bus). Hai app cấu hình lệch
  `GRAPHQL_*` (ví dụ một bên tắt introspection) là lỗi vận hành, không phải khác biệt của app; bộ đối chiếu không
  kiểm.
- GraphQL dùng lại engine đọc ghi và quyền của 004, 005 nguyên trạng; mọi khác biệt kiểu số theo vendor đã ghi ở
  005 áp cho `_aggregated`. Không thêm khác biệt riêng cho GraphQL.
- Thư viện `graphql`, `graphql-compose`, LRU và semaphore chốt phiên bản ở plan theo catalog của Directus 11.17.4.
- Proxy E2E: route `graphql` đi tới app mới; app Directus chỉ gọi GraphQL ở Insights (`stores/insights.ts`) và
  "Save as copy" của trang chi tiết item (`use-item/index.ts`), nên kịch bản E2E giới hạn ở đó.
- Ca của bộ blackbox, unit fail trên chính Directus ở một vendor được bỏ qua kèm ghi chú tên ca, như 005 đến 010.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% kết quả introspection (`/graphql`, `/graphql/system`) và SDL (`/server/specs/graphql`,
  `/server/specs/graphql/system`) cho admin, ba user quyền một phần (A: chỉ đọc một số field của hai collection; B:
  đọc theo filter và create không có read; C: update và delete không có read, read trên collection quan hệ), token
  share, public có và không có policy, trên data model của bộ đối chiếu, giống Directus
  nguyên văn kể cả thứ tự (Assumptions), không có type, field, arg, enum value, scalar, directive thừa, thiếu hay
  lệch chỗ (kể cả `Subscription`).
- **SC-002**: 100% request của bộ đối chiếu (FR-060; mỗi document gửi tới hai app là một request, đếm theo số lần
  gọi `sameGql`) cho cùng status, body (`data`, `errors` kể cả `locations`, `path`, `extensions`), header cache ở hai
  app, ngoài khác biệt đã ghi: D-37 (status và body của `update_extensions_item`, `extensions[].schema` null),
  D-23, D-27, D-28 (không có khác biệt HTTP, chỉ dòng log ở app mới), D-17 (không có request nào).
- **SC-003**: 100% ca GraphQL của mười ba file blackbox (FR-061) đạt ở cả hai app trên Postgres, MySQL, SQLite trước
  khi đóng feature; vendor còn lại đạt ở một lượt `nightly.yml` hoặc được ghi chú theo Assumptions; 100% unit port
  (FR-062) đạt.
- **SC-004**: 100% dòng DB do mutation GraphQL ở app mới ghi (bảng dữ liệu, `directus_activity`,
  `directus_revisions`, `directus_sessions`) trùng từng cột với dòng Directus ghi cho cùng mutation, theo tập so của
  004 đến 010; 100% kịch bản dùng chéo (FR-060) đạt ở cả hai chiều.
- **SC-005**: Sau khi quyền hoặc data model đổi qua API ở một app (không phải sửa DB thô, R-30), introspection ở app
  kia với user bị ảnh hưởng trả schema mới trong 100% ca của bộ đối chiếu, trong cùng khoảng chờ bus mà bộ đối chiếu
  002 và 004 dùng cho `schemaChanged` (poll tới khi đổi, tối đa vài giây), không cần khởi động lại.
- **SC-006**: Với `GRAPHQL_INTROSPECTION=false`, 100% query introspection và `/server/specs/graphql` bị từ chối với
  cùng status, mã lỗi như Directus; với `GRAPHQL_QUERY_TOKEN_LIMIT` nhỏ, document quá giới hạn bị từ chối giống
  Directus.
- **SC-007**: 100% kịch bản E2E app Directus (FR-063) qua app mới hoàn tất với cùng số bước và màn hình như qua
  Directus; ở mỗi kịch bản benchmark (FR-064), p95 latency và throughput của app mới không tệ hơn Directus quá 10%.
