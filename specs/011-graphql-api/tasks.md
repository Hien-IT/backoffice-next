---

description: "Danh sách task cho feature 011: GraphQL (/graphql, /graphql/system, /server/specs/graphql)"
---

# Tasks: GraphQL (`/graphql`, `/graphql/system`)

**Input**: Tài liệu thiết kế trong `/specs/011-graphql-api/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R12, R12 đã đo 2026-10-14), `data-model.md`,
`contracts/` (`graphql-api.md`, `parity.md`), `quickstart.md`, `checklists/` (`requirements.md`, `api-compat.md`,
`testing.md`, `operations.md`).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test. Test gốc của Directus đi kèm file port thì port theo, chạy đỏ trước rồi port code
  (`aggregate-query.test.ts` 17, `filter-replace-m2a.test.ts` 15, `dedupe-resolvers.test.ts` 13,
  `parse-query.test.ts` 13, `resolvers/query.test.ts` 9, `replace-fragments.test.ts` 6, `process-error.test.ts` 4,
  `sanitize-gql-schema.test.ts` 4).
- Mọi endpoint thêm có test đối chiếu chạy với cả Directus 11.17.4 thật lẫn app mới, so status, body (nguyên văn, kể
  cả thứ tự: Clarifications), header cache và dòng DB qua `graphqlEffects` (research R9, contracts/parity.md §2); bộ
  blackbox port chạy hai lượt theo app.
- Điểm spec ghi "đo" đã đo ở R12 (method, path con, subscription qua HTTP, `_empty`, SDL, thứ tự introspection).
  Phát hiện lệch mới thì dừng, ghi bằng chứng vào "Ghi chú khi làm" và hỏi tech lead.

**Organization**: Task nhóm theo user story của spec. Phase 1 và 2 là nền chung: thư viện, biến env, cặp
`graphql-nointro`, toàn bộ port `services/graphql` (schema sinh ra là một khối, không tách theo story được),
middleware, controller, helper đối chiếu. Thứ tự story: US1 (đọc) → US2 (ghi) → US3 (hệ thống) → US4 (introspection,
SDL, cache schema) → US5 (lỗi, giới hạn, cache response) → US6 (E2E, benchmark, CI) → Polish (đóng feature). Bốn đợt
commit lên `main`: A = Phase 1, 2; B = Phase 3, 4, 5; C = Phase 6, 7; D = Phase 8, 9 (plan §Scale/Scope ghi nhóm theo
nội dung, đây là ánh xạ theo phase).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task. Phase 1, 2 và Polish không có nhãn này.
- File port từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn nguồn>`. Mỗi task port ghi các cặp
  `{ "source", "dest" }` (source tính từ `directus/`) vào `tools/port-manifest/011-T###.json`, theo đúng ID task.
  Chạy `node tools/check-port-headers.mjs` sau khi ghi. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Port nguyên vẹn: giữ tên biến, thứ tự câu lệnh, thứ tự `addFields`, message của Directus (thứ tự quyết định
  introspection nguyên văn, SC-001). Chỗ khác nguồn ghi `// Backoffice: <lý do>` (danh sách cho phép ở plan,
  Constitution Check I: `subscribe` giữ chỗ, `lru-cache`, `p-queue`, `update_extensions_item`, `redact.test.ts` đọc
  log container). Giới hạn tạm ghi `// ponytail: <giới hạn>, <khi nào nâng>`.
- Ánh xạ import khi port: `@directus/utils` → `@backoffice/utils`; `@directus/errors` → `@backoffice/errors`
  (`isDirectusError` → `isBackofficeError`); `@directus/types` → `@backoffice/types`; `@directus/env` →
  `@backoffice/env`; `@directus/system-data` → `@backoffice/system-data`; `@directus/constants` →
  `@backoffice/constants`; `@directus/schema-builder` (test) → `@backoffice/schema-builder`; `../../services/<x>.js`
  → `../../services/<x>.service.js`; `../../utils/get-service.js`, `../../bus/index.js`, `../../cache.js`,
  `../../logger/index.js`, `../../database/index.js`, `../../permissions/**`, `../../utils/reduce-schema.js`,
  `../../utils/sanitize-query.js`, `../../utils/validate-query.js`, `../../middleware/rate-limiter-registration.js`,
  `../../database/get-ast-from-query/utils/get-related-collection.js`, `../../constants.js` đã có cùng tên.
- **Không sửa service của feature trước** ngoài: `specifications.service.ts` (thêm `GraphQLSpecsService`),
  `server.controller.ts` (thêm `GET /specs/graphql/:scope?`), `utils/get-cache-key.ts` (nhánh `/graphql`), thêm
  factory vào `providers.ts`, thêm mẫu vào `middleware/router-options.ts`, khối Feature 011 trong
  `config/supported-variables.ts`, `services/index.ts`.
- **Luôn tái tạo hành vi Directus**, kể cả hành vi không an toàn (R-30 đến R-32). Phát hiện hành vi không an toàn mới
  thì thêm dòng R-xx vào spec kèm bằng chứng (ca test, request, kết quả đo trên Directus thật, ngày đo) và một ca thể
  hiện; không tự lệch.
- Không gửi email (D-23, D-27, D-28 qua service đã có), không cài extension (D-37), không WebSocket (D-17).
- Proxy: `graphql` vào `tests/parity/proxy/backoffice-routes.txt` **cùng task** đăng ký controller (T017); app
  Directus gọi `/graphql` ở Insights và "Save as copy".
- Tên biến, comment, commit viết tiếng Anh. Tài liệu viết tiếng Việt.
- Test viết trước và phải fail trước khi làm phần tương ứng.
- Mỗi file đối chiếu dọn dữ liệu mình tạo (item, collection tạm, field, user, share) trong `afterAll` bằng
  `cleanup(ids)` của 010, trên cả hai app; collection tạm đặt tên riêng theo file để chạy song song (shard CI) không
  đụng nhau; không tạo field trên seed của 005.
- Quy trình merge thẳng `main`: mỗi đợt commit và push xong thì CI phải xanh; `pnpm run ci:local` khi Actions bị
  chặn. Nhánh `011-graphql-api` tạo từ 28191d6, `main` đã có f9e5ca9: rebase lên `main` trước commit đầu, pull `main`
  trước mỗi commit.

## Quy ước đường dẫn

- API: `apps/api/src/**` (`services/graphql/**` giữ cây con như Directus, không hậu tố `.service.ts`).
- Test đối chiếu: `tests/parity/src/**` (mới: `tests/parity/src/graphql/**`; blackbox port thêm vào
  `tests/parity/src/items/blackbox/**`). Danh sách khác biệt: `tests/parity/accepted-differences.ts`. Profile, env:
  `tests/parity/docker-compose.yml`, `tests/parity/env/**`.
- E2E app Directus: `tests/directus-app-e2e/**`. Reverse proxy: `tests/parity/proxy/**`.
- Benchmark: `tests/benchmark/**`. Công cụ: `tools/**`. CI: `.github/workflows/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/tests/blackbox/**`, `directus/app/src/**`.

## Tóm tắt

- Tổng số task: **46**
- Số task đánh dấu [P]: **24**
- Một lượt implement, checkpoint sau mỗi phase; bốn đợt commit A–D.
- MVP gợi ý: **Phase 1 đến 3** (US1): `/graphql` và `/graphql/system` đọc được với schema theo user, phần GraphQL của
  8 file blackbox items đi tới app mới. Feature chưa đóng được khi chưa xong US2 đến US6 và Polish.

---

## Phase 1: Setup (thư viện, biến env, môi trường đối chiếu)

**Purpose**: Hai gói mới cài được và chỉ một bản `graphql`, bốn biến sang nhóm A, cặp `graphql-nointro` và cặp
blackbox log raw chạy được (research R1, R6, R9, R10; contracts/parity.md §1).

- [X] T001 Thư viện: `pnpm-workspace.yaml` catalog thêm `graphql: 16.12.0`, `graphql-compose: 9.1.0` (bản của
  `directus/pnpm-workspace.yaml`); `apps/api/package.json` thêm hai gói `catalog:`; `pnpm install`; `pnpm why graphql`
  phải cho đúng một bản 16.12.0 trong `apps/api` (peer của `graphql-compose`); `pnpm audit --prod --audit-level=high`
  không advisory mới; ghi vào "Ghi chú khi làm" (research R1, plan §Rủi ro).
- [X] T002 [P] `apps/api/src/config/supported-variables.ts` khối "Feature 011": `GRAPHQL_INTROSPECTION`,
  `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT`, `GRAPHQL_QUERY_TOKEN_LIMIT`, `GRAPHQL_SCHEMA_CACHE_CAPACITY`
  (`WEBSOCKETS_GRAPHQL_AUTH*`, `WEBSOCKETS_GRAPHQL_PATH` ở lại nhóm C); `supported-variables.test.ts` thêm ca
  (`['GRAPHQL_INTROSPECTION', true]`, `['GRAPHQL_SCHEMA_CACHE_CAPACITY', true]`, `['WEBSOCKETS_GRAPHQL_PATH', false]`);
  `specs/001-platform-foundation/contracts/config.md` nhóm A, C cập nhật; kiểm `libs/env` có mặc định và kiểu của ba
  biến đầu như `packages/env` (FR-005, research R6).
- [X] T003 [P] Môi trường đối chiếu: `tests/parity/docker-compose.yml` thêm cặp profile `graphql-nointro`
  (`directus-graphql-nointro` host `10555`, `backoffice-api-graphql-nointro` host `10556`; cổng cao nhất đang dùng
  trong `config.ts profilePorts` là `10456`, kiểm lại trước khi thêm và để `vendors.test.ts` bắt trùng cổng, `<<: *app`, `env_file` vendor +
  `env/profile-graphql-nointro.env`, healthcheck như cặp chính); `tests/parity/env/profile-graphql-nointro.env`
  (`GRAPHQL_INTROSPECTION=false`, `GRAPHQL_QUERY_TOKEN_LIMIT=50`, `GRAPHQL_SCHEMA_CACHE_CAPACITY=2`,
  `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT=1`); `tests/parity/env/profile-blackbox.env` thêm `LOG_STYLE=raw`,
  `LOG_LEVEL=info` (research R10); đăng ký `tests/parity/src/config.ts` (`profilePorts`), `src/docker.ts` (`compose()`),
  `scripts/env.mjs` (`ALL_PROFILES`), `src/vendors.test.ts`; `tools/ci-local.sh` thêm `graphql-nointro` vào profiles
  Postgres (contracts/parity.md §1, §5).

**Checkpoint**: `pnpm nx run-many -t test lint typecheck` xanh (api với test cũ); `env-up --vendor=postgres
--profiles=graphql-nointro,blackbox` lên đủ, `/server/ping` của bốn app `200`.

---

## Phase 2: Foundational (port `services/graphql`, middleware, controller, helper đối chiếu)

**Purpose**: Toàn bộ engine GraphQL của Directus có mặt và chạy được với admin; route trả lời; helper của bộ đối
chiếu sẵn sàng (research R2, R3, R5, R7, R8, R9). Thứ tự port theo phụ thuộc: scalar → utils → errors → schema parse →
schema types → resolvers → cache và `generateSchema` → `GraphQLService` → middleware → controller.

- [X] T004 [P] Scalar: port `directus/api/src/services/graphql/types/{bigint,date,geojson,hash,string-or-float,void}.ts`
  → `apps/api/src/services/graphql/types/` và `directus/api/src/utils/get-graphql-type.ts` →
  `apps/api/src/utils/get-graphql-type.ts`. Directus không có test: viết mới
  `apps/api/src/services/graphql/types/scalars.test.ts` (đỏ trước): `Date` parse và serialize chuỗi ISO, sai → message
  của Directus; `GraphQLBigInt` ngoài khoảng → lỗi; `Hash` không được đọc; `GraphQLStringOrFloat` nhận cả hai; `Void`;
  `getGraphQLType` cho mọi `Type` và `special` `conceal` (FR-052). Manifest `tools/port-manifest/011-T004.json`.
- [X] T005 [P] Utils: port `directus/api/src/services/graphql/utils/{add-path-to-validation-error,aggregate-query,
  dedupe-resolvers,filter-replace-m2a,process-error,replace-fragments,replace-funcs,sanitize-gql-schema}.ts` và sáu
  test gốc (`aggregate-query.test.ts`, `dedupe-resolvers.test.ts`, `filter-replace-m2a.test.ts`,
  `process-error.test.ts`, `replace-fragments.test.ts`, `sanitize-gql-schema.test.ts`) → `apps/api/src/services/graphql/
  utils/`; test gốc chạy đỏ trước (thiếu module) rồi xanh (59 ca); `sanitize-gql-schema` log qua `useLogger` của app;
  `process-error` dùng `isBackofficeError` (research R7). Manifest `011-T005.json`.
- [X] T006 [P] Errors: port `directus/api/src/services/graphql/errors/{execution,format,index,validation}.ts` →
  `apps/api/src/services/graphql/errors/` bằng `createError` của `@backoffice/errors` (code
  `GRAPHQL_VALIDATION`, `GRAPHQL_EXECUTION`, status 400, `extensions.errors` qua
  `formatError`); test mới `errors/errors.test.ts` (đỏ trước): hai lỗi có đúng code, status, `extensions.errors`
  với `message`, `locations`, `path` (FR-002, FR-050). Manifest `011-T006.json`.
- [X] T007 Schema parse (sau T004, T005): port `directus/api/src/services/graphql/schema/{parse-args,parse-query}.ts`
  và `parse-query.test.ts` → `apps/api/src/services/graphql/schema/`; test gốc 13 ca xanh (`sanitizeQuery`,
  `validateQuery`, `getRelationInfo` của app). Manifest `011-T007.json`.
- [X] T008 Schema types (sau T007): port `directus/api/src/services/graphql/schema/{get-types,read,write}.ts` →
  `apps/api/src/services/graphql/schema/`; trong `read.ts` thay `createSubscriptionGenerator(gql, eventName)` bằng
  `subscribeUnavailable` (hàm Backoffice trong cùng file ném `Error('Backoffice: GraphQL subscriptions have no
  transport (D-17)')`; `execute` của `graphql` không gọi `subscribe` nên không bao giờ chạy qua HTTP; giữ nguyên type,
  arg, enum, tên `<collection>_mutated` đầy đủ, không `scopeFilter`: FR-047, research R12.7); giữ nguyên thứ tự
  `addFields`, `addResolver`. Manifest `011-T008.json`.
- [X] T009 [P] Resolvers item (sau T007): port `directus/api/src/services/graphql/resolvers/{query,mutation,
  get-collection-type,get-field-type,get-relation-type}.ts` và `query.test.ts` → `apps/api/src/services/graphql/
  resolvers/`; test gốc 9 ca xanh. Manifest `011-T009.json`.
- [X] T010 [P] Resolvers hệ thống (sau T007): port `directus/api/src/services/graphql/resolvers/{system,system-global,
  system-admin}.ts` → `apps/api/src/services/graphql/resolvers/` với import sang `apps/api/src/services/*.service.js`
  (`AuthenticationService`, `UsersService`, `TFAService`, `UtilsService`, `RevisionsService`, `CollectionsService`,
  `FieldsService`, `RelationsService`, `ServerService`, `SpecificationService`, `ExtensionsService`, `FilesService`,
  `RolesService`), `REFRESH_COOKIE_OPTIONS`, `SESSION_COOKIE_OPTIONS` của `constants.ts`, `registrationRateLimiter`;
  `update_extensions_item` gọi `ExtensionsService` không có `updateOne` → ném `ForbiddenError` với
  `// Backoffice: D-37`; `server_specs_graphql` gọi `GraphQLSpecsService` (T014, stub tạm nếu cần). Test mới
  `resolvers/system.test.ts` (đỏ trước): với schema giả của `@backoffice/schema-builder`, `injectSystemResolvers`
  thêm đúng tập query và mutation theo admin, user thường, public, `OPENAPI_ENABLED`, `GRAPHQL_INTROSPECTION`
  (contracts/graphql-api.md §4; research R8). Manifest `011-T010.json`.
- [X] T011 Cache schema và `generateSchema` (sau T008, T009, T010): port `directus/api/src/services/graphql/
  schema-cache.ts` → `apps/api/src/services/graphql/schema-cache.ts` với `LRUCache` của `lru-cache` (`max =
  Number(env['GRAPHQL_SCHEMA_CACHE_CAPACITY'] ?? 100)`, `// Backoffice: lru-cache instead of mnemonist LRUMap`),
  `useBus().subscribe('schemaChanged', () => cache.clear())`; port `schema/index.ts` với `PQueue({ concurrency })`
  thay `Semaphore.runExclusive` (`// Backoffice: p-queue instead of async-mutex`), kiểm cache lần hai trong hàng đợi,
  lỗi trong hàm lan ra ngoài. Test mới (đỏ trước) `schema-cache.test.ts` (dung lượng, `schemaChanged` xóa hết) và
  `schema/index.test.ts` (khóa `scope_type_role_user`; cache hit không sinh lại; hai request cùng khóa chỉ sinh một
  lần; `concurrency` giới hạn; hàm ném → promise reject, không lưu cache) (FR-044, FR-045; research R5). Manifest
  `011-T011.json`.
- [X] T012 `GraphQLService` (sau T011): port `directus/api/src/services/graphql/index.ts` →
  `apps/api/src/services/graphql/index.ts` (`validationRules` + `NoSchemaIntrospectionCustomRule` khi
  `GRAPHQL_INTROSPECTION === false`, `execute`, `getSchema`, `read`, `upsertSingleton`, `create`, `update`, `delete`
  qua `getService`); factory `GraphQLService` trong `apps/api/src/providers.ts`; export trong
  `apps/api/src/services/index.ts`. Test mới `services/graphql/index.test.ts` (đỏ trước): `execute` với schema giả
  (validation lỗi → `GraphQLValidationError` có `path`; resolver ném `BackofficeError` → `errors[]` qua
  `processError`; `execute` ném → `GraphQLExecutionError`; `extensions` được giữ). Manifest `011-T012.json`.
- [X] T013 [P] Middleware: port `directus/api/src/middleware/graphql.ts` → `apps/api/src/middleware/graphql.ts`
  (`parseGraphQL`); test mới `middleware/graphql.test.ts` (đỏ trước): method khác `GET`, `POST` → `405` với `allowed`,
  `current`; `GET` đọc `query`, `variables` JSON (sai → `INVALID_QUERY`), `operationName`; thiếu `query` →
  `INVALID_PAYLOAD` "Must provide query string"; parse lỗi và quá `GRAPHQL_QUERY_TOKEN_LIMIT` → `GraphQLValidationError`;
  mutation qua `GET` → `405 allowed: ['POST']`; mutation đặt `res.locals.cache = false`; `graphqlParams` có `document`,
  `query`, `variables`, `operationName`, `contextValue { req, res, cache: Map }` (FR-001, contracts/graphql-api.md §1).
  Manifest `011-T013.json`.
- [X] T014 [P] SDL service: `apps/api/src/services/specifications.service.ts` thêm `GraphQLSpecsService` (hai
  `GraphQLService` scope `items`, `system`; `generate(scope)` → `getSchema('sdl')`) và field `graphql` của
  `SpecificationService`, port từ `directus/api/src/services/specifications.ts` phần tương ứng; sửa header "OAS only";
  `specifications.service.test.ts` thêm ca `generate('items')`, `generate('system')`, scope khác → `null` (FR-043).
  Manifest `011-T014.json`.
- [X] T015 [P] Khóa cache: port `directus/api/src/utils/get-graphql-query-and-variables.ts` →
  `apps/api/src/utils/get-graphql-query-and-variables.ts`; `apps/api/src/utils/get-cache-key.ts` thêm `isGraphQl` và
  `query: isGraphQl ? getGraphqlQueryAndVariables(req) : req.sanitizedQuery` như Directus, sửa header;
  `get-cache-key.test.ts` thêm ca: `POST /graphql` với `query`, `variables` cho khóa khác nhau theo `variables`, khớp
  khóa của Directus cho cùng input (`object-hash` cùng `version`) (FR-004). Manifest `011-T015.json`.
- [X] T016 [P] Helper đối chiếu `tests/parity/src/graphql/helpers.ts`: `gql(app, scope, document, { variables,
  operationName, token, method })`, `introspection(app, scope, token)` với `getIntrospectionQuery({ descriptions:
  true, specifiedByUrl: true, directiveIsRepeatable: true, schemaDescription: true, inputValueDeprecation: true })` của
  `graphql`, `sdl(app, scope, token)` (`GET /server/specs/graphql[/scope]`, trả body và header), `sameGql(...)` gửi hai
  app và `expect(...).toEqual(...)` nguyên văn (status, body, `Cache-Control`, `Vary`, header cache status) với
  `comparable()` của `src/system/helpers.ts` (010) cho id, thời gian, token, `graphqlEffects(fn)` = dòng DB của bảng dữ
  liệu + `directus_activity`, `directus_revisions`, `directus_sessions`; `warnLines`, `userWithPolicy` dùng lại; ba
  policy mẫu A (đọc một số field của hai collection của seed 005), B (đọc theo filter, create không read), C (update
  và delete không read, read trên quan hệ) (contracts/parity.md §2). Unit nhỏ `helpers.test.ts` cho `comparable` của
  response GraphQL (id dạng chuỗi).
- [X] T017 Controller (sau T012, T013): `apps/api/src/controllers/graphql.controller.ts` port từ
  `directus/api/src/controllers/graphql.ts`: `@Controller('graphql')`, `@All('system')`, `@All('system/*splat')` → scope
  `system`; `@All()`, `@All('*splat')` → scope `items` (khai báo `system` trước); mỗi handler `runMiddleware(parseGraphQL)`,
  `GraphQLService.execute(res.locals.graphqlParams)` → `res.locals.payload`, `errors` → `res.locals.cache = false`,
  `respond`; đăng ký trong `apps/api/src/app.module.ts`. Test mới `graphql.controller.test.ts` (supertest qua app Nest,
  đỏ trước): `POST /graphql/system { server_ping }` → `pong`; `POST /graphql` cùng document → `400` validation (scope
  `items`); `/graphql/anything` → `items`, `/graphql/system/anything` → `system`, `/graphql/systemx` → `items`
  (research R12.4); `OPTIONS`, `HEAD`, `PUT` → `405 Allow: GET, POST` (R12.1); `GET` mutation → `405`; thiếu `query` →
  `400`. Cùng task: `tests/parity/proxy/backoffice-routes.txt` thêm `graphql`, `tests/parity/src/proxy-conf.test.ts`
  cập nhật (ba mươi hai route), `tests/parity/src/request-set.ts` thêm `POST /graphql`, `POST /graphql/system`
  (`{ __typename }`) cho `db-unchanged`; `tests/parity/src/server/errors.test.ts` bỏ ca D-09.* của `/graphql`
  (Directus không có metric theo route nên không có ca metric; FR-054 sửa) (research R3). Manifest `011-T017.json`.
- [X] T018 Blackbox đổi đích (sau T017): `tests/parity/src/items/blackbox/common/transport.ts` dùng `host` của test
  cho `requestGraphQL` (bỏ `getDirectusUrl`, sửa header); `common/config.ts` bỏ `getDirectusUrl` nếu không còn ai dùng
  (`grep -rn getDirectusUrl tests/parity/src`) và sửa comment "GraphQL stays on Directus"; chạy
  `PARITY_SUITE=blackbox PARITY_BLACKBOX_APP=backoffice` trên Postgres cho tám file items/fields/collections: ghi số ca
  đỏ vào "Ghi chú khi làm" (dự kiến xanh nếu port đúng; đỏ thì sửa port ở US1/US2, không sửa test) (FR-061).

**Checkpoint**: unit `apps/api` xanh gồm 81 ca gốc; `POST /graphql/system { server_ping }` ở app mới trả `pong`;
`env-up --profiles=app`: Insights của app Directus qua proxy có panel GraphQL hiện số. **Đợt commit A** (rebase lên
`main` trước).

---

## Phase 3: User Story 1 - Đọc dữ liệu người dùng qua `/graphql` (Priority: P1) 🎯 MVP

**Goal**: Query danh sách, `_by_id`, `_by_version`, singleton, aggregate, quan hệ lồng, filter, alias, fragment,
variables, `GET` trả `data` giống Directus từng giá trị và giống REST, theo quyền của user.

**Independent Test**: `tests/parity/src/graphql/read.test.ts` xanh trên Postgres, MySQL, SQLite; phần GraphQL của
tám file blackbox items xanh ở lượt `backoffice`.

### Tests for User Story 1

- [X] T019 [P] [US1] `tests/parity/src/graphql/read.test.ts` (đỏ trước ở các ca lệch): trên seed của 005 (`articles`,
  `categories`, `tags`, m2m, m2a): danh sách với mọi toán tử filter theo kiểu field, `_and`, `_or`, lọc qua quan hệ,
  `_some`, `_none`, `_FUNC` (`year`, `month`, `count`), `sort` nhiều field, `limit`, `offset`, `page`, `search`; lồng ba
  cấp có arg riêng; `_by_id`, `_by_version` (version của 008, có và không có), singleton; `_aggregated` mọi hàm,
  `groupBy`, hàm ngày giờ; alias, fragment, inline fragment trên union m2a, `__typename`, variables, hai operation với
  `operationName`; `GET` với `variables`; admin, user A, B, C, public, token share (share của 003 trên một item:
  `<c>_by_id` item đó `200`, item khác `errors` `FORBIDDEN`, quan hệ được phép); mỗi ca cũng so với REST tương đương
  như blackbox (US1 kịch bản 1–6; FR-010 đến FR-016).

### Implementation for User Story 1

- [X] T020 [US1] Sửa lệch phát hiện ở T018, T019 trong `apps/api/src/services/graphql/schema/{read,get-types,
  parse-query,parse-args}.ts`, `resolvers/query.ts`, `utils/*.ts` (chỉ sửa port cho đúng Directus; mỗi chỗ sửa ghi
  vào "Ghi chú khi làm" với request, kết quả hai app); thêm ca unit tương ứng vào test của file sửa.
- [ ] T021 [US1] `tests/parity/src/suite.ts`: `REDUCED_FILES` thêm `src/graphql/read.test.ts`; `FULL_FILES` thêm
  `src/graphql/**/*.test.ts`; chạy `reduced` trên MySQL, SQLite (`env-up --vendor=mysql`, `sqlite3`), ghi số ca theo
  vendor vào "Ghi chú khi làm" (ca đọc dòng DB chỉ SELECT, bài học 002).

**Checkpoint**: US1 xanh ba vendor; tám file blackbox xanh hai lượt. Có thể commit riêng.

---

## Phase 4: User Story 2 - Ghi dữ liệu người dùng qua `/graphql` (Priority: P1)

**Goal**: `create_*`, `update_*`, `update_*_batch`, `delete_*`, `update_<singleton>` với input lồng; tác động DB,
activity, revision, event, flow, cache giống REST; mutation không cache; `GET` mutation `405`.

**Independent Test**: `tests/parity/src/graphql/write.test.ts` xanh ba vendor.

### Tests for User Story 2

- [X] T022 [P] [US2] `tests/parity/src/graphql/write.test.ts` (đỏ trước): `create_<c>_item(s)` với input lồng m2o
  (tạo mới và id), o2m (`create`, `update`, `delete`), m2m, m2a; `update_<c>_item(s)`, `update_<c>_batch`,
  `delete_<c>_item(s)` (trả `{ id }`, `{ ids }`), `update_<singleton>` có và không selection (`true`); selection quan hệ
  sau mutation; `MAX_BATCH_MUTATION` (cặp blackbox đặt 100: gửi 101); `FORBIDDEN`, `RECORD_NOT_UNIQUE`, validation
  trong `errors[]` với `path`; user B (create không read): `create_<c>_item` có trong schema, dòng được tạo, đọc
  lại theo selection ném `ForbiddenError` → `200` với `data.create_<c>_item: null` và `errors[].extensions.code =
  FORBIDDEN` (`[Suy luận]` từ `services/graphql/index.ts` và `resolvers/mutation.ts`; đo trên Directus trước, so
  nguyên văn kể cả dòng DB đã tạo);
  mutation ở app A rồi query cùng document ở app B (data cache chung xóa); `GET` mutation `405`; flow action theo
  `items.create` của 009 chạy (dòng `directus_flows` + `directus_activity` của flow); `graphqlEffects` so bảng dữ
  liệu, `directus_activity`, `directus_revisions` (US2 kịch bản 1–6; FR-020 đến FR-025).

### Implementation for User Story 2

- [X] T023 [US2] Sửa lệch phát hiện ở T022 trong `apps/api/src/services/graphql/schema/write.ts`,
  `resolvers/mutation.ts`, `services/graphql/index.ts` (`create`, `update`, `delete`, `upsertSingleton`); mỗi chỗ ghi
  "Ghi chú khi làm"; thêm ca unit vào test của file sửa.
- [ ] T024 [US2] `tests/parity/src/suite.ts` `REDUCED_FILES` thêm `src/graphql/write.test.ts`; chạy MySQL, SQLite.

**Checkpoint**: US2 xanh ba vendor.

---

## Phase 5: User Story 3 - Dữ liệu hệ thống và thao tác hệ thống qua `/graphql/system` (Priority: P1)

**Goal**: Collection hệ thống, `collections*`, `fields*`, `relations*`, `auth_*`, `users_*`, `utils_*`, `server_*`,
`extensions` trả như Directus; email ghi log; token dùng chéo; năm file blackbox còn lại port và xanh.

**Independent Test**: `tests/parity/src/graphql/system.test.ts` xanh ba vendor; `login`, `refresh`, `redact`, `ping`,
`health` blackbox xanh hai lượt.

### Tests for User Story 3

- [X] T025 [P] [US3] `tests/parity/src/graphql/system.test.ts` (đỏ trước): `users`, `roles`, `files`, `activity`
  (không mutation trong schema), `collections`, `collections_by_name`, `fields*`, `relations*` (admin và user thường);
  `auth_login` ba `mode` (`json` body, `cookie` và `session` header `Set-Cookie`, dòng `directus_sessions`,
  `directus_activity`), user bật TFA (fixture của 003): không `otp` và `otp` sai → `INVALID_OTP`, đúng → `200`;
  `auth_refresh`, `auth_logout`, token của app này dùng ở app kia; `auth_password_request`,
  `users_invite`, `users_register` (`warnLines` D-23, D-27, D-28 ở app mới, response giống); `users_me`,
  `update_users_me`, `users_me_tfa_generate` → `enable` → `disable`; `utils_random_string`, `utils_hash_generate` →
  `utils_hash_verify` chéo app, `utils_sort`, `utils_revert`, `utils_cache_clear` (sau đó introspection ở app kia
  sinh lại: đo bằng tạo field thô rồi `utils_cache_clear`, FR-044); `create_fields_item` ở app này rồi
  `fields_in_collection` ở app kia (DDL và cache schema GraphQL chéo), `delete_fields_item`; `extensions` (admin
  `schema: null`), `update_extensions_item` → `FORBIDDEN` ở app mới, so status của Directus theo D-37; `server_ping`,
  `server_info`, `server_health`, `server_specs_oas`, `server_specs_graphql(scope)`; mutation qua service hệ thống
  (FR-025): `create_shares_item` không quyền `share` → `FORBIDDEN`, có quyền → dòng với `password` băm argon2 và trả
  che; `create_translations_item` trùng `key` + `language` → `INVALID_PAYLOAD`; `update_settings` (singleton) rồi
  `GET /server/info` ở app kia; `create_users_item` với `password` → cột băm, đăng nhập được ở app kia;
  `create_presets_item` của user app access với `user` khác mình → `FORBIDDEN` (US3 kịch bản 1–6; FR-030 đến
  FR-036).
- [X] T026 [P] [US3] Blackbox port năm file (đỏ trước ở lượt `backoffice` khi chưa có route): copy
  `directus/tests/blackbox/tests/common/auth/{login,refresh}.test.ts` → `tests/parity/src/items/blackbox/tests/common/
  auth/` (bỏ các khối dùng `createWebSocketConn`, ghi `// Backoffice: WebSocket cases left out (D-17)`);
  `tests/common/logger/redact.test.ts` → `.../tests/common/logger/redact.test.ts` (bỏ `spawn`, `TestLogger`: lấy mốc
  `logs(service)` trước request, sau request lọc dòng mới chứa `/auth/refresh` hoặc `/graphql/system`, `service` =
  `directus-blackbox` hoặc `backoffice-api-blackbox` theo `PARITY_BLACKBOX_APP`; giữ nguyên khẳng định
  `"cookie":"--redacted--"`, `"set-cookie":"--redacted--"`); `tests/db/routes/server/{ping,health}.test.ts` →
  `.../tests/db/routes/server/` (bỏ `SMTPServer`; `health` so mục `email` theo D-07: ở app mới không có mục, ghi
  `// Backoffice: D-07`); `tests/parity/src/suite.ts` `BLACKBOX_FILES` thêm năm file; manifest `011-T026.json`
  (research R10; FR-061).

### Implementation for User Story 3

- [X] T027 [US3] Sửa lệch phát hiện ở T025, T026 trong `apps/api/src/services/graphql/resolvers/{system,
  system-global,system-admin}.ts` (cookie theo `mode`, `expires` kiểu chuỗi của GraphQL, `users_me` query); mỗi chỗ ghi
  "Ghi chú khi làm"; thêm ca unit vào `resolvers/system.test.ts`.
- [ ] T028 [US3] `tests/parity/src/suite.ts` `REDUCED_FILES` thêm `src/graphql/system.test.ts`; chạy MySQL, SQLite;
  chạy blackbox hai lượt (`PARITY_BLACKBOX_APP=directus`, `backoffice`) trên Postgres, ghi số ca.

**Checkpoint**: US3 xanh; 13 file blackbox xanh hai lượt. **Đợt commit B**.

---

## Phase 6: User Story 4 - Schema theo từng user, introspection và SDL (Priority: P1)

**Goal**: Introspection và SDL khớp nguyên văn Directus cho admin, ba user quyền một phần, public có và không policy, ở
hai scope; `GRAPHQL_INTROSPECTION=false` chặn; cache schema xóa chéo qua bus; tên không hợp lệ bị bỏ; `/server/specs/
graphql` có mặt (gỡ D-15).

**Independent Test**: `tests/parity/src/graphql/schema.test.ts` xanh (Postgres đủ, ba vendor phần `reduced`); cặp
`graphql-nointro` xanh.

### Tests for User Story 4

- [X] T029 [P] [US4] `tests/parity/src/graphql/schema.test.ts` (đỏ trước): introspection (`helpers.introspection`) và
  SDL (`helpers.sdl`, so body, `Content-Type`, `Content-Disposition`) hai scope cho admin, user A, B, C, public có policy
  đọc một collection, public không policy (`_empty`, scope `system` có `server_*` và 17 mutation: research R12.3) →
  `toEqual` nguyên văn (SC-001); xóa cache chéo: tạo field ở Directus → introspection ở app mới có field ngay, xóa field
  ở app mới → Directus mất ngay; sửa quyền user A ở app mới qua `/permissions` → Directus đổi (SC-005; chờ bus tối đa
  như 004); collection tạm tên `Query` và field tên `1abc` → bị bỏ ở hai app, một dòng log cảnh báo ở app mới
  (`warnLines`), dọn sau; `describe.skipIf(!hasProfile('graphql-nointro'))`: `__schema` → `400`, `/server/specs/
  graphql` → `404`, `OPTIONS /server/specs/graphql` → `404`, document 60 token → `400`, `GRAPHQL_SCHEMA_CACHE_CAPACITY=2`
  với ba user liên tiếp vẫn đúng, 10 user khác nhau gửi introspection đồng thời với `MAX_CONCURRENT=1` đều `200`
  (US5 kịch bản 4) (SC-006); introspection với token share (schema theo quyền của share, FR-040);
  `describe.skipIf(!hasProfile('multi'))`: tạo field ở Directus → introspection ở cả `backoffice-api` và
  `backoffice-api-2` đổi (FR-060); collection tạm có field tên `__x` → `500` ở cả hai app, so nguyên văn (Edge Cases);
  `/server/specs/graphql/x` → `404`; `HEAD`, `OPTIONS` của route SDL ở cặp
  chính (`200 Allow: GET,HEAD`) (US4 kịch bản 1–6; FR-040 đến FR-047).
- [X] T030 [P] [US4] `apps/api/src/controllers/server.controller.test.ts` thêm ca (đỏ trước): `GET /server/specs/graphql`
  và `/system` → `200`, `Content-Type: application/octet-stream; charset=utf-8`, `Content-Disposition: attachment;
  filename="<project_name>_<yyyy-MM-dd>.graphql"`, body là SDL; `/x` → `404`; `GRAPHQL_INTROSPECTION=false` → `404`;
  `apps/api/src/middleware/router-options.test.ts` thêm ca `OPTIONS /server/specs/graphql` → `GET,HEAD` chỉ khi biến
  khác `false` (FR-042, FR-043; research R4, R12.6).

### Implementation for User Story 4

- [X] T031 [US4] `apps/api/src/controllers/server.controller.ts` thêm `@Get('specs/graphql')` và
  `@Get('specs/graphql/:scope')` port từ `directus/api/src/controllers/server.ts` (`GRAPHQL_INTROSPECTION === false` →
  `RouteNotFoundError`; scope ngoài `items`, `system` → `RouteNotFoundError`; `serverInfo()` → `project_name`;
  `specificationService.graphql.generate(scope)`; `res.attachment(filename)` với `format` của `date-fns`; `res.send`);
  sửa header "Not built yet"; `apps/api/src/middleware/router-options.ts` thêm
  `[/^\/server\/specs\/graphql(\/[^/]+)?\/?$/i, 'GET,HEAD']` khi `GRAPHQL_INTROSPECTION !== false`, sửa comment D-15;
  `tests/parity/src/server/methods.test.ts` bỏ ca D-15. Manifest `011-T031.json`.
- [X] T032 [US4] Sửa lệch introspection phát hiện ở T029 (thứ tự type, field, description, directive) trong
  `apps/api/src/services/graphql/schema/*.ts`, `resolvers/*.ts` theo nguyên tắc giữ thứ tự gọi của Directus; nếu lệch
  do thứ tự `SchemaOverview` thì sửa ở `apps/api/src/schema/**` (002) với ca thêm vào `src/schema/overview.test.ts`;
  không sắp lại ở bộ so; ghi "Ghi chú khi làm" từng lệch (plan §Rủi ro).
- [ ] T033 [US4] `tests/parity/src/suite.ts` `REDUCED_FILES` thêm `src/graphql/schema.test.ts` (phần admin + user A);
  chạy MySQL, SQLite; chạy `full` Postgres với `graphql-nointro`.

**Checkpoint**: US4 xanh; SHA introspection của app mới trùng Directus cho sáu cấu hình user ở hai scope.

---

## Phase 7: User Story 5 - Lỗi, giới hạn và cache giống Directus (Priority: P2)

**Goal**: Mọi lỗi parse, validation, thực thi, resolver, scalar cùng status, code, message, `locations`, `path`;
response cache dùng chung cho `POST /graphql`; R-31 có bằng chứng.

**Independent Test**: `tests/parity/src/graphql/errors.test.ts` xanh Postgres; `cache.test.ts` xanh trên cặp
`cache-redis`.

### Tests for User Story 5

- [X] T034 [P] [US5] `tests/parity/src/graphql/errors.test.ts` (đỏ trước): sai cú pháp, field không có, arg sai kiểu,
  scalar sai (`Date` "abc", `BigInt` quá lớn, `Hash` đọc), hai operation không `operationName`, `operationName` lạ,
  `GET` với `variables` JSON sai, thiếu `query`, document chỉ có fragment (không operation), `PUT`, `OPTIONS`, `HEAD`
  (R12.1), operation `subscription` qua `POST`
  với admin (`data` null) và public không type (`INTERNAL_SERVER_ERROR` bị che) và qua `GET` (`405`) (R12.2, FR-047);
  lỗi resolver: admin và user thường cho `FORBIDDEN` (giữ nguyên), lỗi không phải `DirectusError`: trên Postgres
  `full`, `articles(filter: { id: { _eq: "not-a-number" } })` với khóa chính integer → lỗi DB không qua
  `translateDatabaseError` → admin thấy message của DB với `INTERNAL_SERVER_ERROR`, user thường thấy "An unexpected
  error occurred." (`[Suy luận]`, đo trên Directus trước; vendor khác có thể không lỗi nên chỉ Postgres); so nguyên văn
  `extensions`, `path`, `locations` (US5 kịch bản 1, 2; FR-050 đến FR-052).
- [X] T035 [P] [US5] `tests/parity/src/graphql/cache.test.ts` (đỏ trước; `describe.skipIf(!hasProfile('cache-redis'))`):
  `POST /graphql` lần hai ở app kia → header cache status `HIT`, `Cache-Control`, `Vary`; mutation không cache;
  response có `errors` không cache; `Cache-Control: no-store` → `MISS`; mutation ở app A → query cũ ở app B `MISS`
  (xóa data cache); R-31: hai document khác khoảng trắng → hai entry (đếm key Redis namespace cache trước và sau);
  `tests/parity/src/suite.ts` `CACHE_FILES` thêm file (US5 kịch bản 3; FR-004; R-31).

### Implementation for User Story 5

- [X] T036 [US5] Sửa lệch phát hiện ở T034, T035 trong `apps/api/src/services/graphql/errors/*.ts`,
  `utils/process-error.ts`, `utils/add-path-to-validation-error.ts`, `middleware/graphql.ts`, `utils/get-cache-key.ts`;
  ghi "Ghi chú khi làm"; thêm ca unit vào test của file sửa.
- [X] T037 [US5] Bằng chứng R-30, R-32: R-30 đo trên Directus (đổi `directus_permissions` bằng SQL thô qua `hostDb()` →
  introspection của user vẫn cũ ở cả hai app tới khi `utils_cache_clear`), thêm ca "R-30" vào
  `tests/parity/src/graphql/schema.test.ts` chỉ trên Postgres `full`; R-32 lấy từ T042 (benchmark); ghi cột "Bằng
  chứng" trong `specs/011-graphql-api/spec.md` với ngày đo.

**Checkpoint**: US5 xanh; `parity-cache` xanh với `src/graphql/cache.test.ts`. **Đợt commit C**.

---

## Phase 8: User Story 6 - Bộ test của Directus, E2E app Directus và benchmark chạy qua trên app mới (Priority: P2)

**Goal**: `e2e-app.test.ts`, Playwright `graphql.spec.ts`, benchmark `graphql`, CI đủ profile và file.

**Independent Test**: `parity` full Postgres xanh gồm `src/graphql/**`; `e2e-directus-app` xanh với `graphql.spec.ts`;
`benchmark:graphql` chạy local có số liệu.

### Tests for User Story 6

- [X] T038 [P] [US6] `tests/parity/src/graphql/e2e-app.test.ts` (đỏ trước): đúng chuỗi request của
  `directus/app/src/stores/insights.ts` (một `POST /graphql` gộp ba panel bằng alias `panel_<id>`, một
  `POST /graphql/system`, panel lỗi → `400` với `extensions.errors[0].path`) và `use-item/index.ts` `saveAsCopy`
  (`<alias>_by_id` với `item_duplication_fields` gồm m2o, o2m, m2a alias) ở hai app; so response (FR-063 phần request).
- [X] T039 [P] [US6] `tests/directus-app-e2e/src/graphql.spec.ts` (đỏ trước ở lượt proxy khi route chưa tới app mới):
  (1) Insights: tạo dashboard, thêm panel Metric `count` trên `articles`, panel List trên `articles` hiển thị
  `category.name`, panel Metric trên `directus_users`; mở dashboard, đọc giá trị ba panel, so hai lượt (`bothRuns`);
  `proxyLog` cho thấy `/graphql`, `/graphql/system` tới app mới; (2) "Save as copy": collection có
  `item_duplication_fields` (`title`, `category`, `tags`) tạo qua `/fields` meta; mở item, Save as copy; item mới có cùng
  `title`, `category`, `tags`; dọn sau. `tests/directus-app-e2e/src/routing.spec.ts` thêm `/admin/insights/<id>` có panel
  GraphQL (contracts/parity.md §6; FR-063).

### Implementation for User Story 6

- [X] T040 [US6] Sửa lệch phát hiện ở T038, T039 (alias nhiều panel, `__typename`, m2a alias) trong
  `apps/api/src/services/graphql/schema/parse-query.ts`, `utils/replace-fragments.ts`, `utils/dedupe-resolvers.ts`;
  ghi "Ghi chú khi làm".
- [X] T041 [P] [US6] Benchmark `tests/benchmark/src/graphql.ts` (dùng seed của `seed-items.ts`): `list` (`articles`
  với `filter`, `sort`, `limit: 25`, `category { name }`), `by_id`, `aggregated` (`count`, `groupBy: ["status"]`),
  `introspection` (admin, schema đã cache), `create_articles_item`; admin và user quyền một phần; fresh và cache như
  `items.ts`; cổng 10% qua `compare.ts`; đo một lần thời gian sinh schema lần đầu (`utils_cache_clear` rồi một
  introspection), chỉ in; `tests/benchmark/project.json` target `graphql`; `.github/workflows/benchmark.yml` job
  `benchmark-graphql` (hằng tuần như các job khác) (contracts/parity.md §7; FR-064, SC-007).
- [X] T042 [US6] Chạy benchmark local một vòng (`pnpm nx run benchmark:env-up && pnpm nx run benchmark:graphql`,
  Directus amd64 giả lập, chỉ tham khảo), ghi p95, req/s, thời gian sinh schema lần đầu và RSS của container app mới
  trước/sau 10 user sinh schema (`docker stats --no-stream`) vào "Ghi chú khi làm" và cột "Bằng chứng" R-32.
- [X] T043 [US6] CI: `.github/workflows/ci.yml` job `parity` dòng Postgres `full` thêm `graphql-nointro` vào
  `--profiles`; `nightly.yml` kiểm `full` đã gồm `src/graphql` (glob); `parity-matrix.yml` không đổi;
  `tests/parity/README.md` thêm mục 011 (profile `graphql-nointro`, `LOG_STYLE=raw` của cặp blackbox, 13 file
  blackbox); `tests/directus-app-e2e` thêm spec vào danh sách chạy nếu có (contracts/parity.md §5).

**Checkpoint**: CI xanh toàn bộ với `graphql` tới app mới; `benchmark-graphql` có số liệu local. 

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Manifest, sổ khác biệt, spec cũ, bằng chứng rủi ro, đóng feature (Nguyên tắc X).

- [ ] T044 [P] `node tools/check-port-headers.mjs` 0 lỗi với manifest `011-T004` đến `011-T031`; mọi file nguồn mới của
  011 có `Ported from` hoặc `Backoffice:`; coverage dòng `apps/api` ≥ 80% (`pnpm nx run api:test`), ghi số vào "Ghi chú
  khi làm"; `pnpm nx run-many -t lint typecheck` xanh; `graphify update .`.
- [ ] T045 [P] Tài liệu: `specs/011-graphql-api/spec.md` cột "Bằng chứng" R-30 đến R-32 (từ T037, T042), mục "Lệch có
  chủ đích" giữ; `specs/001-platform-foundation/spec.md` dòng D-09.9, D-15 ghi "gỡ ở 011 (ngày)";
  `specs/011-graphql-api/checklists/*.md` đánh dấu mục đã rà; `research.md` R12 bổ sung số đo của app mới nếu khác;
  `CLAUDE.md` Recent Changes giữ dòng 011.
- [ ] T046 Đóng feature (sau khi tech lead duyệt gỡ D-09.9, D-15, R-30 đến R-32, hai chỗ thay thư viện):
  `tests/parity/accepted-differences.ts` xóa entry D-09.9, D-15 (guard `removeAt: '011'`); `specs/011-graphql-api/
  spec.md` `Status: Done` và dòng "Duyệt khác biệt" như 010; `specs/001-platform-foundation/spec.md` ghi ngày gỡ; commit
  `chore(011): close feature 011-graphql-api`; CI xanh. **Đợt commit D**.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (T004, T005, T006 song song; T007 sau T004, T005; T008 sau T007; T009, T010 song song sau T007;
  T011 sau T008, T009, T010; T012 sau T011; T013, T014, T015, T016 song song bất kỳ lúc nào sau T001; T017 sau T012,
  T013; T018 sau T017) → đợt commit A.
- Phase 3, 4, 5 độc lập với nhau sau Phase 2 (test [P] viết trước; task sửa lệch của mỗi story chỉ sửa file port
  tương ứng). Thứ tự khuyến nghị US1 → US2 → US3 vì blackbox items cần cả đọc lẫn ghi.
- Phase 6 sau Phase 5 (T029 cần user A, B, C của T016 và route SDL của T031; T031 cần T014). Phase 7 sau Phase 2
  (T035 cần cặp `cache-redis` của 005).
- Phase 8 sau Phase 3 đến 7 (E2E cần đọc, ghi, Insights; benchmark cần route ổn định). Phase 9 cuối.

## Parallel Execution Examples

- Phase 2: T004, T005, T006 cùng lúc (scalar, utils, errors); sau đó T009, T010 cùng lúc; T013, T014, T015, T016 bất
  kỳ lúc nào.
- Phase 3–5: T019, T022, T025, T026 viết cùng lúc (bốn file test khác nhau), rồi T020, T023, T027 sửa lệch theo file
  port riêng.
- Phase 6–7: T029, T030, T034, T035 cùng lúc.
- Phase 8: T038, T039, T041 cùng lúc.

## Implementation Strategy

- MVP: Phase 1 → 2 → 3. Sau đợt A app mới đã trả lời `/graphql` cho admin; US1 xác nhận bằng ba vendor và tám file
  blackbox.
- Mỗi story sau đó là một bộ test đối chiếu + sửa lệch trong file port tương ứng; không viết lại engine.
- Introspection nguyên văn (US4) là cổng khó nhất: làm sau khi đọc, ghi, hệ thống đã khớp để lệch còn lại chỉ do thứ
  tự hoặc description.

## Ghi chú khi làm

- 2026-10-14 (trước T001): đo R12 trên Directus 11.17.4 của cặp parity Postgres, xem research R12; môi trường đã hạ
  (`compose down`).
- 2026-10-14 T001: catalog thêm `graphql 16.12.0`, `graphql-compose 9.1.0`; `pnpm install` 2 s (store đã có);
  `pnpm why graphql` trong `apps/api`: một bản 16.12.0 (peer của `graphql-compose` và `graphql-type-json 0.3.2`);
  `pnpm audit --prod`: 40 advisory, không advisory nào chạm `graphql*`, số high (25, đều ignored) không đổi.
- 2026-10-14 T004–T006 (đọc mã `services/graphql/errors`): mã lỗi của Directus là `GRAPHQL_VALIDATION` và
  `GRAPHQL_EXECUTION` (không có hậu tố `_EXCEPTION`), danh sách lỗi con nằm ở `extensions.errors` (khớp phép đo R12.1,
  R12.2); spec, contract, data-model, tasks đã sửa tên (`graphqlErrors` → `errors`). App Directus đọc
  `extensions.graphqlErrors` ở `stores/insights.ts` là tên cũ phía client, không ảnh hưởng API.
- 2026-10-14 T002, T003: `graphql-nointro` cổng 10555/10556; `profile-blackbox.env` thêm `LOG_STYLE=raw`, `LOG_LEVEL=info`.
- 2026-10-14 T004–T017: port xong `services/graphql` (trừ `subscription.ts`), 81 ca gốc + 48 ca mới xanh; unit api
  3.517 ca, coverage dòng 85,6%; lint, typecheck xanh. Ba điều phải xử lý khi port:
  (1) Vitest nạp `graphql` hai bản (Vite lấy `module` = ESM cho app, Node lấy `main` = CJS cho `graphql-compose`
  vì gói không có `exports`) → `graphql-compose` báo "Cannot convert to OutputType"; `apps/api/vitest.config.ts`
  alias `graphql` về đúng file Node resolve (một bản, như production). (2) `rate-limiter-registration.ts`: Directus
  tạo limiter lúc nạp module chỉ khi `RATE_LIMITER_REGISTRATION_ENABLED`; app mới tạo lúc dùng, nên thêm
  `registrationRateLimiter()` cho resolver `users_register`; khi biến tắt, Directus đọc `rateLimiter.consume` trên
  `undefined` → TypeError → `INTERNAL_SERVER_ERROR` qua `processError` (ứng viên R-33, đo ở T025 nếu có cặp tắt
  biến). (3) `services/index.ts` không re-export `graphql/index.js`: kéo `server.service` → `server.ts` → `app.module`
  vào mọi test import `services/index.js` (payload.service.test đỏ). `GQLScope`, `GraphQLParams` đặt ở
  `apps/api/src/types/graphql.ts` (cần type express, graphql). `lru-cache` thêm vào `apps/api/package.json` (đã có
  trong catalog).
- 2026-10-14 T018: `requestGraphQL` gửi tới host của test; `getDirectusUrl` giữ vì `case-when.test.ts` còn dùng cho
  một phép so REST với Directus. Lượt `PARITY_BLACKBOX_APPS=backoffice` trên Postgres cho seed, common và tám file
  (collections/fields crud, m2a, m2m, m2o, no-relation, o2m, singleton): 10/10 file, 9.670 ca đạt, 10 skip có sẵn; mọi
  ca GraphQL của tám file đi tới app mới và đạt ngay lượt đầu.
- 2026-10-14 checkpoint đợt A: `POST /graphql/system { server_ping }` trả `pong` ở cả bốn app; introspection của admin
  (hai scope) và public trùng từng byte giữa Directus và app mới trên DB vừa dựng (sha items 2244757e, system 744a3a9c,
  public 1d24daa6).
- 2026-10-14 T016: `helpers.ts` của bộ đối chiếu: `sameGql`, `introspection`, `sdl`, `createGraphqlModel` (prefix riêng
  mỗi file), `seedGraphqlModel`, `createGraphqlUsers` (A, B, C và policy của mỗi user), `graphqlEffects`; mặc định
  `Cache-Control: no-store` (POST /graphql cũng được cache, CACHE_SKIP_ALLOWED=true ở env vendor); `ACCEPTED` bỏ D-09.9,
  D-15 khi feature còn mở (bài học 008, 010). Hai điều phát hiện khi dựng data model qua API Directus: field `json`
  không có `meta` bị `POST /collections` từ chối (`FAILED_VALIDATION` collection, field), dùng `special: cast-json`;
  `/versions` cần `meta.versioning: true`. `read.test.ts` lần đầu chạy song song với seed blackbox thì gặp
  "Collection doesn't exist" khi tạo relation (schema do cặp blackbox ghi vào cache Redis dùng chung): không chạy bộ
  GraphQL cùng lúc với seed blackbox trên máy local.
- 2026-10-14 T019–T038 (Postgres, môi trường đối chiếu local): `src/graphql/` read 9, write 6, system 10, schema 11,
  errors 5, e2e-app 3 ca đạt; cache 4 ca skip (cần cặp `cache-redis-purge`, chạy ở job `parity-cache`). Không có lệch
  nào ở mã port; các lần đỏ đều do test: image cũ chưa có route SDL; `server_health` của public dao động `ok`/`warn` theo
  ngưỡng thời gian của check khi máy tải (dùng `parityStable` như REST 001); user không role không có `users_me` trong
  schema (kiểm token chéo bằng `users_me_tfa_generate`); m2a nhận `item` là chuỗi trong input; đặt tên id phải theo
  bảng (id của hai bảng trùng số). R-33 (m2a + inline fragment trong selection của mutation) đo trên Directus và tái tạo,
  thêm vào spec. Lệch tìm được ở bước sửa: không có (T020, T023, T027, T032, T036, T040 không cần sửa mã port).
- 2026-10-14 T029: introspection và SDL của admin, A, B, C, token share, public không policy và có policy trùng nguyên
  văn ở hai scope; field tạo ở app này hiện trong schema app kia trong < 1 s (cả hai chiều); R-30 đo: quyền ghi thẳng DB
  không đổi schema ở cả hai app tới `utils/cache/clear?system`; collection `9gql_bad_*` bị bỏ với dòng cảnh báo; field
  `__x` trên collection hợp lệ làm hỏng schema items ở cả hai app như nhau; cặp `graphql-nointro` đạt (introspection,
  SDL 404, 60 token, 10 user đồng thời với `MAX_CONCURRENT=1`).
- 2026-10-14 T041: `tests/benchmark/src/graphql.ts` (list, by id, aggregated × admin/user × fresh/cache, introspection,
  create), target `benchmark:graphql`, job `benchmark-graphql`; chưa chạy (T042).
- 2026-10-14 T043: `ci.yml` thêm `graphql-nointro` vào hai shard Postgres `full`; `nightly.yml` dùng glob `full` nên đã
  gồm `src/graphql`; README mục 011. `routing.spec.ts` không cần sửa: `graphql.spec.ts` tự kiểm proxy log.
- 2026-10-14 T039: `graphql.spec.ts` 2/2 đạt qua proxy local (Insights: ba panel, `/graphql` và `/graphql/system` tới
  app mới; Save as Copy: dòng ghi giống Directus, `last_page` của admin mang id bản sao nên được chuẩn hóa);
  `routing.spec.ts` 2/2 đạt với `graphql` trong danh sách route. Local: container `proxy` cũ (Exited 128, network đã
  xóa sau `compose down` chỉ với profile vendor) phải `up --force-recreate --no-deps proxy`.
- 2026-10-14 T042 (local, 1 vòng 5 s, Directus amd64 giả lập trên arm64, chỉ tham khảo; số chính thức từ CI): 15/15
  kịch bản `ok` (p95 Directus/Backoffice ms, req/s): list admin no-store 484/445, 142/144; by id admin no-store 332/359,
  194/198; aggregated admin no-store 386/381, 174/181; list user no-store 427/381, 155/157; introspection admin
  656/658, 27,8/30,2; create admin 355/351, 155/164; create user 554/385, 144/139; các kịch bản cached 255–304 ms. Sinh
  schema lần đầu (sau `utils/cache/clear?system`): Directus 126 ms, app mới 98 ms; RSS sau benchmark: Directus 782 MiB,
  app mới 539 MiB (bằng chứng R-32). Lượt đầu đỏ vì kịch bản sai, giống nhau ở hai app: `create` gửi `category: 1`
  (m2o là input object), list của user chọn `category { name }` (với user, `category` là giá trị `Int` trong schema),
  aggregate không giới hạn trên bảng 1,7 GiB không xong trong một vòng; đã sửa kịch bản.
- 2026-10-14 CI b264065 (run 38527923214): quality, docker, guard, security, matrix, Postgres full 1 và 2, blackbox
  (directus), e2e xanh; đỏ: (1) `cache.test.ts` khẳng định sai `Cache-Control: max-age` cho HIT có token (cả hai app trả
  `no-cache`); (2) blackbox `mail.test.ts` (backoffice, MySQL reduced): `LOG_STYLE=raw` của cặp blackbox làm dấu ngoặc
  kép trong dòng log thành `\"`, mẫu tìm không khớp → regex nhận cả hai dạng; (3) SQLite: `data`/`delta` của revisions là
  chuỗi JSON, hàm đặt tên id của `write.test.ts` không đọc → parse; (4) E2E: `last_page` của Save as Copy (sửa ở 1c60a48)
  và `system.spec.ts` Import/Export của 010 lỗi ngẫu nhiên khi uuid file mở đầu bằng 8 chữ số (mẫu thời gian ăn mất
  nhóm đầu) → đổi thứ tự thay thế.
