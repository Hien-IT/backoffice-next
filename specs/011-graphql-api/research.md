# Research: GraphQL (011)

Mỗi mục gồm Quyết định, Lý do, Đã cân nhắc. Mốc so sánh là Directus 11.17.4 (api 35.2.0). Điều gì chưa đo thì ghi
`[Suy luận]` và có task kiểm sớm. Quyết định lớn đã chốt ở Clarifications của spec: giữ type `Subscription` như
Directus (FR-047); so introspection và SDL nguyên văn kể cả thứ tự (SC-001); port nguyên năm file blackbox còn lại
(FR-061). Đường dẫn Directus tính từ `directus/api/src` trừ khi ghi khác; đường dẫn app mới tính từ gốc repo.

## R1. Thư viện: thêm `graphql`, `graphql-compose`, `mnemonist`, `async-mutex` (bản của Directus)

- **Quyết định**: Thêm vào catalog `pnpm-workspace.yaml` đúng bản Directus: `graphql 16.12.0`, `graphql-compose 9.1.0`,
  `mnemonist 0.40.3` (`LRUMap` của cache schema), `async-mutex 0.5.0` (`Semaphore` của hàng đợi sinh schema)
  (`apps/api`). `json-to-graphql-query 2.3.0` đã có trong catalog (bộ blackbox). Không thêm `graphql-ws` (subscription
  qua WebSocket, D-17).
- **Lý do**: `graphql` và `graphql-compose` quyết định từng byte của introspection, SDL, message lỗi validation (SC-001,
  SC-002), nên phải cùng bản. `mnemonist`, `async-mutex`: owner chọn ngày 2026-10-14 port nguyên văn như Directus
  (Nguyên tắc I) thay vì dùng lại `lru-cache`, `p-queue` đã có; `schema-cache.ts`, `schema/index.ts` không còn chỗ lệch.
- **Đã cân nhắc**: Dùng lại `lru-cache` 11.2.2 (`@backoffice/memory`) và `p-queue` 8.1.0 (flows) cho cùng ngữ nghĩa, bớt
  hai dependency: làm ở lượt implement đầu, owner đổi về bản Directus. `graphql-yoga`, `@nestjs/graphql`, Apollo: bị
  loại, schema không được sinh bằng `graphql-compose` thì tên type, thứ tự field, directive, message lỗi khác Directus.

## R2. Cấu trúc port: `apps/api/src/services/graphql/` cùng đường dẫn Directus, trừ subscription

- **Quyết định**: Port nguyên, cùng đường dẫn, kèm test gốc (8 file, 81 ca): `services/graphql/index.ts`
  (`GraphQLService`), `schema/{index,read,write,get-types,parse-args,parse-query}.ts`,
  `resolvers/{query,mutation,system,system-global,system-admin,get-collection-type,get-field-type,get-relation-type}.ts`,
  `types/{bigint,date,geojson,hash,string-or-float,void}.ts`, `utils/{add-path-to-validation-error,aggregate-query,
  dedupe-resolvers,filter-replace-m2a,process-error,replace-fragments,replace-funcs,sanitize-gql-schema}.ts`,
  `errors/{execution,format,index,validation}.ts`, `schema-cache.ts` (R1), `utils/get-graphql-type.ts`,
  `utils/get-graphql-query-and-variables.ts` (phần GraphQL của `get-cache-key.ts`, bỏ ở 005), `middleware/graphql.ts`
  (`parseGraphQL`), phần `GraphQLSpecsService` của `services/specifications.ts`. Không port `subscription.ts`
  (`createSubscriptionGenerator`, `bindPubSub`, dùng `websocket/*`, `events`) và `websocket/controllers/graphql.ts`:
  trong `schema/read.ts`, field `Subscription` giữ type, arg, enum như Directus nhưng `subscribe` là một hàm
  Backoffice ném lỗi (không bao giờ được gọi qua HTTP vì `execute` của `graphql` không gọi `subscribe`; ghi rõ trong
  header, FR-047). `@directus/*` → `@backoffice/*` (`types`, `errors`, `env`, `utils`, `constants`, `system-data`,
  `schema-builder` trong test); `useLogger`, `useBus`, `getCache`, `clearSystemCache`, `getService`, `reduceSchema`,
  `fetchAllowedFieldMap`, `fetchInconsistentFieldMap`, `sanitizeQuery`, `validateQuery`, `getRelatedCollection`,
  `createDefaultAccountability`, `fetchAccountabilityPolicyGlobals`, `fetchAccountabilityCollectionAccess`,
  `registrationRateLimiter`, `getSecret`, `getIPFromReq`, `generateHash`, `jwt`, `isDirectusJWT` đã có ở 001 đến 010
  (kiểm ngày 2026-10-14: 29 module đích có mặt, thiếu đúng `get-graphql-type.ts` và `get-schema.ts`; `get-schema`
  chỉ `subscription.ts` dùng). `@backoffice/constants` có `FUNCTIONS`, `GENERATE_SPECIAL`; `@backoffice/utils` có
  `getRelation`, `getRelationType`, `getRelationInfo`, `parseFilterFunctionPath`, `toBoolean`.
- **Lý do**: Nguyên tắc I, VI (bảng ánh xạ một–một); mọi service resolver gọi đã có nên `services/graphql` gần như
  không cần sửa ngoài import. Test gốc chạy trước bộ đối chiếu để bắt lệch sớm.
- **Đã cân nhắc**: Bỏ hẳn field `Subscription` (Clarifications Q1 phương án B): bị loại theo owner. Port
  `subscription.ts` với `bindPubSub` không nối WebSocket: bị loại, kéo theo `websocket/utils/items.ts`,
  `websocket/messages.ts`, `events` cho code không chạy.

## R3. Route: `GraphqlController` Nest với `@All`, `parseGraphQL` qua `runMiddleware`, `respond`

- **Quyết định**: `apps/api/src/controllers/graphql.controller.ts` (`@Controller('graphql')`): `@All('system')` và
  `@All('system/*splat')` → scope `system`; `@All()` và `@All('*splat')` → scope `items` (Directus
  `router.use('/system')` và `router.use('/')` khớp mọi path con và mọi method; thứ tự khai báo trong class giữ
  `system` trước). Mỗi handler: `await runMiddleware(parseGraphQL, req, res)` (ném `405` cho method ngoài `GET`,
  `POST`, `400` thiếu `query` hoặc `variables` sai, `GRAPHQL_VALIDATION` khi parse lỗi, `405` mutation qua
  `GET`, đặt `res.locals.cache = false` cho mutation, dựng `graphqlParams` với `contextValue { req, res, cache: new
  Map() }`), rồi `new GraphQLService({ accountability, schema, scope }).execute(params)` → `res.locals.payload`; có
  `errors` thì `res.locals.cache = false`; `respond(req, res)`. Factory `GraphQLService` trong `providers.ts` như các
  service khác. `middleware/cache.ts` (đã xử lý `/graphql` cho `POST` từ 005) và `respond.ts` (cache `POST /graphql`)
  không đổi; `get-cache-key.ts` thêm nhánh `getGraphqlQueryAndVariables(req)` như Directus (khóa cache gồm `query`
  và `variables` thay `sanitizedQuery`). `router-options.ts`: không thêm dòng cho `/graphql` (Directus dùng
  `router.use`, `OPTIONS` và `HEAD` đi vào `parseGraphQL` → `405 Allow: GET, POST`; đo 2026-10-14, R12.1).
- **Lý do**: FR-001, FR-002, FR-004; cùng chuỗi middleware như `controllers/graphql.ts`; khuôn `runMiddleware` +
  `respond` là của 005 đến 010.
- **Đã cân nhắc**: Mount Express router thủ công trong `app.ts` thay controller Nest: bị loại, mọi route của app đi
  qua controller Nest (Nguyên tắc VI). `@nestjs/graphql`: bị loại (R1).

## R4. `/server/specs/graphql/:scope?`: thêm handler vào `ServerController`; gỡ D-15

- **Quyết định**: `@Get('specs/graphql')` và `@Get('specs/graphql/:scope')` trong `server.controller.ts`: khi
  `GRAPHQL_INTROSPECTION === false` → `RouteNotFoundError` (Directus không mount route); `scope` ngoài `items`,
  `system` → `RouteNotFoundError`; `serverInfo()` lấy `project_name`; `specificationService.graphql.generate(scope)`
  (`printSchema` qua `getSchema('sdl')`, cache theo khóa `scope_sdl_role_user`); `res.attachment('<project_name>_<yyyy-MM-dd>.graphql')`
  (`date-fns` `format`, đã có) rồi `res.send(sdl)` (không `respond`, không cache, như Directus). `router-options.ts`
  thêm `[/^\/server\/specs\/graphql(\/[^/]+)?\/?$/i, 'GET,HEAD']` chỉ khi `GRAPHQL_INTROSPECTION !== false` (như dòng
  `specs/oas` với `OPENAPI_ENABLED`). `specifications.service.ts` thêm `GraphQLSpecsService` (hai `GraphQLService`
  scope `items`, `system`) và field `graphql`. Gỡ D-15 (`accepted-differences.ts`, `server/methods.test.ts`,
  `server/errors.test.ts`, spec 001).
- **Lý do**: FR-042, FR-043; SC-001 so SDL.
- **Đã cân nhắc**: Không.

## R5. Schema theo user và cache: port nguyên `generateSchema`; cache LRU mỗi instance, xóa qua `schemaChanged`

- **Quyết định**: `schema/index.ts` port nguyên: khóa `scope_type_role_user`; `cache.get` → nếu thiếu,
  `semaphore.runExclusive(async () => { kiểm cache lần hai; sanitize; admin hoặc không accountability → 4 bản schema đầy đủ, khác →
  reduceSchema theo fetchAllowedFieldMap cho read/create/update/delete + fetchInconsistentFieldMap; getReadableTypes,
  getWritableTypes; scope system → injectSystemResolvers; Query/Mutation theo scopeFilter; buildSchema hoặc
  printSchema; cache.set })`. `schema-cache.ts`: `new LRUMap<string, GraphQLSchema | string>(Number(env
  ['GRAPHQL_SCHEMA_CACHE_CAPACITY'] ?? 100) })`, `useBus().subscribe('schemaChanged', () => cache.clear())` tại
  module load như Directus (bus Redis dùng chung với Directus; không có Redis thì bus local, cache chỉ xóa trong
  instance, R-30). `clearSystemCache` của app (002) đã publish `schemaChanged`; `CollectionsService`, `FieldsService`,
  `RelationsService`, `PermissionsService`, `PoliciesService`, `RolesService`, `AccessService`, `UsersService`,
  `UtilsService.clearCache` đã gọi nó (004, 006, 010). Không thêm key Redis, không thêm biến.
- **Lý do**: FR-040, FR-044, FR-045; Nguyên tắc VII (1.2.0 cho phép cache trong process dựng lại từ DB và xóa qua bus,
  nhắc đích danh cache GraphQL schema của 011).
- **Đã cân nhắc**: Cache schema trong Redis: bị loại, `GraphQLSchema` không serialize được; Directus cũng không.
  Khóa cache thêm `admin`/policies: bị loại, khác Directus (R-30 tái tạo).

## R6. Biến môi trường: bốn biến `GRAPHQL_*` sang nhóm A

- **Quyết định**: `supported-variables.ts` khối "Feature 011": `GRAPHQL_INTROSPECTION`,
  `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT`, `GRAPHQL_QUERY_TOKEN_LIMIT`, `GRAPHQL_SCHEMA_CACHE_CAPACITY`;
  `WEBSOCKETS_GRAPHQL_*` ở lại nhóm C (chỉ cảnh báo, D-17; `WEBSOCKETS_GRAPHQL_ENABLED` đã nhóm A từ 005 vì
  `/server/info` đọc). `libs/env` đã có mặc định và kiểu của ba biến đầu (port từ `packages/env`);
  `GRAPHQL_SCHEMA_CACHE_CAPACITY` không có mặc định ở Directus (code dùng `?? 100`), giữ nguyên cách đọc. Cập nhật
  `specs/001-platform-foundation/contracts/config.md` nhóm A, C và `supported-variables.test.ts`.
- **Lý do**: FR-005, Nguyên tắc VIII.
- **Đã cân nhắc**: Không.

## R7. Lỗi: `GraphQLValidationError`, `GraphQLExecutionError` là `BackofficeError` với mã Directus; `processError` giữ `DirectusError` name

- **Quyết định**: `errors/validation.ts`, `execution.ts` port nguyên bằng `createError` của `@backoffice/errors`
  với code `GRAPHQL_VALIDATION`, `GRAPHQL_EXECUTION`, status 400, `extensions.errors`
  qua `formatError` (`message`, `locations`, `path`, `extensions`); `processError(accountability, error)` port nguyên:
  lỗi gốc là `BackofficeError` (`isBackofficeError`) → giữ message, code, extensions (admin thấy nguyên; user thường
  cũng thấy vì Directus chỉ che lỗi không phải `DirectusError`); lỗi khác → admin thấy message, `extensions.code =
  INTERNAL_SERVER_ERROR`; user thường thấy "An unexpected error occurred."; log `logger.error` như Directus. Lỗi đi
  qua `respond` thành `{ errors: [...] }` với `name: DirectusError` (quyết định 009) và `code` nguyên. Ca so
  `process-error.test.ts` 4 ca port nguyên.
- **Lý do**: FR-002, FR-050, FR-051; app Directus tách lỗi Insights theo `extensions.errors[].path`.
- **Đã cân nhắc**: Không.

## R8. Resolver hệ thống: dùng service đã có; email theo D-23, D-27, D-28; extensions theo D-37

- **Quyết định**: `resolvers/system.ts`, `system-global.ts`, `system-admin.ts` port nguyên với import đổi sang
  `apps/api/src/services/*.service.ts`: `AuthenticationService.login/refresh/logout`, `UsersService.requestPasswordReset/
  resetPassword/inviteUser/acceptInvite/registerUser/verifyRegistration` (003, 004: đã ghi log thay email),
  `TFAService`, `UtilsService.sort/clearCache`, `RevisionsService.revert`, `CollectionsService`, `FieldsService`,
  `RelationsService` (006), `ServerService.serverInfo/health`, `SpecificationService.oas/graphql`,
  `ExtensionsService.readAll` (010, `schema: null`, D-37) và `updateOne` → không có ở app mới: resolver
  `update_extensions_item` ném `ForbiddenError` như `PATCH /extensions/:pk` (D-37, FR-035). Cookie của `auth_login`,
  `auth_refresh`, `auth_logout` theo `mode` dùng `REFRESH_COOKIE_OPTIONS`, `SESSION_COOKIE_OPTIONS` của `constants.ts`
  (003) qua `contextValue.res`. `users_register` dùng `registrationRateLimiter` (004) qua `contextValue.req`.
  `server_info` lấy từ `ServerService` nên `websocket: false`, đổi thương hiệu như 001.
- **Lý do**: FR-030 đến FR-036, FR-003; không khác biệt mới.
- **Đã cân nhắc**: Không.

## R9. Bộ đối chiếu `tests/parity/src/graphql/` và introspection nguyên văn

- **Quyết định**: Thư mục mới `tests/parity/src/graphql/` (contracts/parity.md §2): `helpers.ts` (`gql(app, scope,
  document, variables, token)`, `introspection(app, scope, token)` chạy query introspection chuẩn của `graphql`
  (`getIntrospectionQuery({ descriptions: true, specifiedByUrl: true, directiveIsRepeatable: true, schemaDescription:
  true, inputValueDeprecation: true })`), `sdl(app, scope, token)` tải `/server/specs/graphql[/system]`; so bằng
  `toEqual` nguyên văn (không sắp lại; lệch thứ tự là khác biệt, Clarifications); `graphqlEffects(fn)` = dòng DB của
  mutation như `historyEffects`/`systemEffects`; `comparable()` của 010 cho id, thời gian, token). File test:
  `schema.test.ts` (introspection và SDL hai scope cho admin, ba user quyền một phần, public có và không policy,
  `GRAPHQL_INTROSPECTION=false` qua cặp `graphql-nointro`, tên không hợp lệ qua collection tạm, xóa cache chéo),
  `read.test.ts`, `write.test.ts`, `system.test.ts`, `errors.test.ts`, `cache.test.ts`, `e2e-app.test.ts` (chuỗi
  request của `use-item` và `stores/insights.ts`). Cặp profile mới `graphql-nointro` (`GRAPHQL_INTROSPECTION=false`,
  `GRAPHQL_QUERY_TOKEN_LIMIT=50`) để kiểm FR-042, SC-006; không vào `manualProfiles`.
- **Lý do**: FR-060, SC-001 đến SC-006.
- **Đã cân nhắc**: So introspection sau khi sắp theo tên: bị loại (Clarifications Q1 của clarify). Dùng
  `printSchema` ở client thay SDL của route: bị loại, SDL của route là contract (`/server/specs/graphql`).

## R10. Blackbox: phần GraphQL của tám file đi tới app đang thử; port nguyên năm file; `LOG_STYLE=raw` cho cặp blackbox

- **Quyết định**: `tests/parity/src/items/blackbox/common/transport.ts`: `requestGraphQL(host, ...)` dùng `host`
  như Directus (bỏ `getDirectusUrl` và comment "GraphQL comes with feature 011"); `common/config.ts` xóa
  `getDirectusUrl` nếu không còn ai dùng (kiểm `cache-blackbox.test.ts` sau 010). Port nguyên: `tests/common/auth/
  login.test.ts`, `refresh.test.ts` (bỏ ca `createWebSocketConn` như các file items đã port, ghi D-17), `tests/common/
  logger/redact.test.ts` (không `spawn`: thay `TestLogger` bằng đọc `logs(service)` của `docker.ts` cho app đang thử
  (`directus-blackbox` hoặc `backoffice-api-blackbox`), lọc dòng chứa `/auth/refresh` hoặc `/graphql/system` kể từ mốc
  trước request; cặp blackbox đặt `LOG_STYLE=raw`, `LOG_LEVEL=info` trong `profile-blackbox.env` để dòng http là JSON
  với `"cookie":"--redacted--"` như test gốc mong đợi), `tests/db/routes/server/ping.test.ts`, `health.test.ts` (bỏ
  `SMTPServer` giả: Directus của cặp không có SMTP, app mới không gửi email; phần kiểm `email` của `health` ở app mới
  theo D-07). `common/variables.ts`, `get-dbs-to-test.ts`, `config.ts` đã có từ 005. `suite.ts` `BLACKBOX_FILES` thêm
  năm file.
- **Lý do**: FR-061, SC-003; Clarifications Q2 của clarify.
- **Đã cân nhắc**: Port `TestLogger` với `spawn` app mới trong container: bị loại, bộ đối chiếu không spawn tiến
  trình trong container; `logs()` đã dùng cho `mail.test.ts` (010).

## R11. E2E app Directus và benchmark

- **Quyết định**: `tests/directus-app-e2e/src/graphql.spec.ts`: (1) Insights: dashboard với panel Metric (`count`
  trên collection người dùng), List (collection người dùng có m2o), Metric trên `directus_users` (`/graphql/system`);
  đọc giá trị hiển thị và so với lượt Directus (`routing.spec.ts` kiểm `graphql` đi tới app mới). (2) Trang chi tiết
  item: app Directus chỉ gọi GraphQL ở `saveAsCopy` (`use-item/index.ts:208-230`, `<alias>_by_id` với
  `item_duplication_fields`): kịch bản "Save as copy" trên collection có `item_duplication_fields` gồm field quan hệ
  m2o, o2m, và trên `directus_users`-like collection hệ thống nếu có (`/graphql/system`); so item tạo ra. Sửa FR-063
  của spec cho đúng chỗ app gọi GraphQL (trang chi tiết không gọi GraphQL khi mở, chỉ khi sao chép). `backoffice-routes.txt`
  thêm `graphql` cùng task đăng ký controller. Benchmark `tests/benchmark/src/graphql.ts` + `seed-graphql.ts` (dùng
  lại seed của `items.ts`): `list` (có m2o lồng), `by_id`, `aggregated`, `introspection` (admin, schema đã cache),
  `create_item` mutation; admin và user quyền một phần; fresh và cache; job `benchmark-graphql` hằng tuần (ngoại lệ
  003); ghi thêm thời gian sinh schema lần đầu (xóa cache qua `utils_cache_clear` rồi đo một request) chỉ in số.
- **Lý do**: FR-063, FR-064, SC-007.
- **Đã cân nhắc**: Không.

## R12. Đo trên Directus 11.17.4 (môi trường đối chiếu, Postgres, ngày 2026-10-14)

Đo bằng `curl` trên `directus` của cặp chính (`http://127.0.0.1:8155`, `WEBSOCKETS_ENABLED=false`, `CACHE_ENABLED=true`),
script giữ ở scratchpad của phiên; ca chạy lại trong `tests/parity/src/graphql/errors.test.ts` và `schema.test.ts`.

1. Method trên `/graphql` và `/graphql/system`: `OPTIONS`, `HEAD`, `PUT`, `DELETE`, `PATCH` → `405`, header
   `Allow: GET, POST` (có dấu cách), body `METHOD_NOT_ALLOWED` "Invalid method \"<M>\" used. Should be one of
   \"GET\", \"POST\"." với `extensions.allowed`, `current`. Không có dòng nào trong `router-options.ts` cho
   `/graphql` (xác nhận R3).
2. Operation `subscription` qua HTTP: admin, `POST /graphql/system`
   `subscription { directus_users_mutated { key event } }` → `200 {"data":{"directus_users_mutated":null}}` (`execute`
   không gọi `subscribe`, không có `resolve` → `null`, không `errors`); qua `GET` → `405 Allow: POST` (không phải
   operation `query`). Public ở scope `items` (không có `Subscription` type vì không đọc được collection nào) →
   `200 {"errors":[{"message":"An unexpected error occurred.","extensions":{"code":"INTERNAL_SERVER_ERROR"}}]}` (lỗi
   "Schema is not configured to execute subscription operation" của `graphql` không phải `DirectusError`, bị che bởi
   `processError`). FR-047 chốt theo đó.
3. Public ở scope `items` không đọc được gì: `Query` có đúng một field `_empty: Void` với description "There's no data
   to query.", `mutationType` và `subscriptionType` `null`. Public ở scope `system`: `Query` có `server_specs_oas`,
   `server_specs_graphql`, `server_ping`, `server_info`, `server_health`, `_empty`; `Mutation` có 17 mutation global
   (`auth_*`, `users_me_tfa_*`, `utils_*`, `users_invite_accept`, `users_register*`); `subscriptionType` `null`.
4. Path con: `POST /graphql/anything` → scope `items`; `/graphql/system/anything` → scope `system`;
   `/graphql/systemx` → scope `items` (Express `router.use('/system')` khớp theo segment). Xác nhận R3 (`@All('system')`,
   `@All('system/*splat')`, `@All()`, `@All('*splat')`).
5. Thứ tự introspection: hai request liên tiếp cùng tiến trình cho cùng SHA (items 5.125.221 byte, system 2.076.230
   byte). Thứ tự `types` là thứ tự định nghĩa (không sắp theo tên): `Query`, rồi type của collection đầu tiên trong
   `SchemaOverview` (`test_items_json_products_uuid`), `JSON`, `count_functions`, `Int`, `String`, `ID`...; `Query`
   fields theo thứ tự collection của `SchemaOverview` (002 đã so thứ tự này với Directus). Sau khi khởi động lại
   container Directus (`docker compose restart directus`, cùng DB): cùng SHA ở cả hai scope (items `40c850060c4a`,
   system `a3df39c129ac`). Thứ tự chỉ phụ thuộc `SchemaOverview` và thứ tự `addFields` trong mã, nên so nguyên văn
   khả thi; app mới phải giữ đúng thứ tự `SchemaOverview` (002) và thứ tự gọi trong `schema/*.ts`, `resolvers/*.ts`.
6. `/server/specs/graphql`: admin → `200`, `Content-Type: application/octet-stream; charset=utf-8` (`res.attachment`
   đặt theo đuôi `.graphql`), `Content-Disposition: attachment; filename="Directus_2026-10-14.graphql"`
   (`project_name` của settings, mặc định "Directus": dữ liệu dùng chung, giữ nguyên theo Nguyên tắc IX; môi trường
   đối chiếu có cùng settings nên tên file trùng), `/items` và không scope cùng nội dung (886.693 byte), `/system`
   360.942 byte, `/x` → `404 ROUTE_NOT_FOUND`; public → `200` với SDL `type Query { _empty: Void }` + `scalar Void`
   (105 byte, không kiểm admin); `OPTIONS` → `200 Allow: GET,HEAD`; `HEAD` → `200`.
7. Tên field `Subscription`: `<collection>_mutated` dùng **tên collection đầy đủ** ở cả hai scope
   (`directus_users_mutated`, không bỏ tiền tố), và vòng lặp subscription của `read.ts` không qua `scopeFilter`: scope
   `items` của admin cũng có 221 field `_mutated` gồm cả collection hệ thống có type đọc (vì được tham chiếu qua quan
   hệ). Port nguyên sẽ giống; data-model §3 sửa theo.
8. Scope `system` có enum `graphql_sdl_scope` (arg của `server_specs_graphql`) và type `server_info*` ngay sau `Query`.
