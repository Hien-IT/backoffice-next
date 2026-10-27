# Research: API chặn tìm kiếm, Import, Export theo cài đặt của collection

Đọc code ngày 2026-10-27 (`apps/api`, `apps/web`, `tests/parity`, `apps/web-e2e`), chưa chạy thử. Mỗi mục: Decision,
Rationale, Alternatives. Mục ghi [Inference] là suy ra từ code, có task test xác nhận.

## R1. Đọc ba cài đặt ở API (FR-008, FR-013)

**Decision**: file mới `apps/api/src/utils/collection-toggles.ts`:

- `getCollectionToggles(): Promise<Record<string, { search?: false; import?: false; export?: false }>>`: đọc key
  `collection-toggles` của `localSchemaCache` (`getCache()` ở `apps/api/src/cache.ts:83-85`, Keyv memory namespace
  `_schema`, TTL `CACHE_SYSTEM_TTL`); miss thì một query
  `select collection, bo_show_search, bo_show_import, bo_show_export from directus_collections`, giữ các dòng có ít nhất
  một giá trị tắt (`false` hoặc `0`, SQLite/MySQL trả số), ghi lại cache. Null, `true`, `1` = bật (FR-008). Không lock
  (query nhỏ, không có thundering herd đáng kể).
- `assertToggle(collection, 'search' | 'import' | 'export', path = '')`: ném
  `createCollectionForbiddenError(path, collection)` (`permissions/modules/process-ast/utils/validate-path/create-error.ts`,
  cùng lỗi `collectionExists` và kiểm quyền trả cho người không có quyền, FR-006; sửa khi checklist 2026-10-27, CHK009)
  khi tắt; collection hệ thống không có dòng `directus_collections` nên không bao giờ bị chặn (FR-010).
- `hasSearchOff()`: map có ít nhất một collection tắt tìm kiếm (dùng ở R3).
- Xóa cache: `clearSystemCache` (`cache.ts:102-121`) đã `localSchemaCache.clear()` tại process lưu và phát
  `schemaChanged`; `subscribeSchemaChanged` (`cache.ts:40-54`) xóa `localSchemaCache` ở mọi replica khi có Redis. Cả
  Directus (`directus/api/src/cache.ts`) và Backoffice (`services/collections.service.ts:249`, `:300`) gọi
  `clearSystemCache` khi lưu collection, nên đổi ở app nào cũng có tác dụng từ request sau (FR-013). Sửa thẳng SQL thì
  `POST /utils/cache/clear` hoặc `cache clear` (Edge Cases).

**Rationale**: cùng cơ chế với SchemaOverview (002): rebuild từ DB, xóa qua bus trên mọi instance (Nguyên tắc VII);
không Redis roundtrip mỗi request; cột `bo_show_*` chắc chắn có vì `start` dừng khi thiếu migration riêng (FR-016 của
022).

**Alternatives**: (a) `systemCache` (Redis dùng chung, key riêng): cùng đường xóa nhưng thêm một `GET` Redis mỗi request
đọc items; (b) đọc DB mỗi request: chủ dự án không chọn (clarify câu 3); (c) thêm ba cột vào SchemaOverview: giá trị
cache `schema` trong `systemCache` dùng chung với Directus 11.17.4 (002, lock/bus), `freezeSchema` và type
`CollectionOverview` của `@backoffice/types`; Directus bỏ qua khóa lạ [Inference] nhưng không đáng rủi ro cho ba cờ.

Câu chữ spec FR-013 ("cache hệ thống dùng chung") sửa thành "cache schema trong process, xóa theo bus `schemaChanged`
như SchemaOverview (002)" (R11); ý của chủ dự án (cache, xóa khi lưu ở app nào cũng được) giữ nguyên.

## R2. Hàm dùng chung và các điểm chặn REST (FR-002, FR-004, FR-005, FR-017)

**Decision**: `assertCollectionToggles(collection, query: Query, schema)` trong cùng file:

1. `query.search` là chuỗi khác rỗng (sau `sanitizeQuery`, `apps/api/src/utils/sanitize-query.ts:77-80`: rỗng bị bỏ,
   chỉ khoảng trắng giữ nguyên) và `search` của `collection` tắt → `assertToggle(collection, 'search')` (lỗi quyền
   collection, `Queried in root`).
2. `query.export` có giá trị và `export` tắt → `assertToggle(collection, 'export')` (mọi định dạng: `respond.ts:78-110`
   chỉ xử lý sau khi service chạy).
3. Đi `query.deep` (dạng của `sanitizeDeep`, `sanitize-query.ts:243-290`: khóa `_x` là tham số con, khóa khác là field
   lồng): mỗi mức có `_search` khác rỗng → `assertToggle(<collection mức đó>, 'search', <path nối bằng dấu chấm>)`; field lồng → collection đích bằng
   `getRelatedCollection(schema, current, field)` (`database/get-ast-from-query/utils/get-related-collection.ts`); field
   a2o (`getRelationInfo(...).relationType === 'a2o'`) có khóa `field:collection` (REST) hoặc `field__collection`
   (GraphQL, `parse-query.ts:135`) → đích là phần sau dấu; không tìm được quan hệ thì dừng nhánh đó. [Inference: dạng khóa
   a2o trong `deep` của REST; task unit test xác nhận với `getRelationInfo`.]

Điểm gọi:

- Middleware mới `collectionTogglesGuard` (`apps/api/src/middleware/collection-toggles-guard.ts`), `app.use` ngay trước
  `checkCacheMiddleware` (`app-pipeline.ts:165-167`, sau `sanitizeQuery` nên có `req.sanitizedQuery`, `req.schema`):
  lấy collection gốc từ `url.parse(req.originalUrl).pathname`: `/items/<c>` và `/items/<c>/<pk>` → `<c>`; `/<x>...` →
  `directus_<x>` khi có trong `req.schema.collections` (deep từ `/users`, `/files`... vào collection người dùng qua
  quan hệ admin tự thêm, FR-017); đường khác (kể cả endpoint của extension `/<extension-id>/...`, FR-009) → `next()`.
  Chạy cho mọi method (query string; `POST`/`PATCH` có `?search=` bị chặn trước khi ghi, FR-017); lỗi → Nest error
  filter trả 403 như lỗi quyền (không tới cache, không tới controller).
- `items.controller.ts`: `search()` gọi lại sau `validateBatch('read')` (thay `req.sanitizedQuery` bằng body `query`,
  `middleware/validate-batch.ts:26-29`); `updateMany`, `deleteMany` nhánh `req.body.query` (dòng 161, 221) gọi với
  `sanitizedQuery` của body. `readOne`, `readMany` được guard lo.
- `utils.controller.ts`: `import/:collection` (dòng 121): `assertToggle(collection, 'import')` ngay sau
  `collectionExists`, trước khi đọc multipart (FR-005: trước khi ghi item nào); `export/:collection` (dòng 169):
  `assertToggle(collection, 'export')` rồi `assertCollectionToggles(collection, sanitizedQuery, schema)` cho từ khóa
  trong body `query` (FR-017).

**Rationale**: một hàm, một dạng `Query` cho REST và GraphQL (`getQuery` của GraphQL cũng ra `Query` với `deep`, R4);
guard trước cache giải quyết FR-012 cho REST (R3) và gom `GET :collection`, `GET :collection/:pk`, deep từ endpoint hệ
thống vào một chỗ; service không đổi (FR-009).

**Alternatives**: kiểm trong `sanitizeQuery` (file port chung mọi route, không biết collection gốc); kiểm trong
`ItemsService.readByQuery` (chặn cả flow, extension: trái FR-009).

Thứ tự lỗi: guard chỉ chặn collection có trong map (có dòng `directus_collections`), nên collection không tồn tại hay
không có quyền vẫn đi đường cũ (403 của `collectionExists`/permissions). Guard chạy trước kiểm quyền, nên lỗi của guard
PHẢI giống hệt lỗi quyền collection (cùng câu, `Queried in root`), không phải câu mặc định của `ForbiddenError`: nếu
khác câu, người không có quyền phân biệt được collection tồn tại và đang tắt cài đặt (checklist CHK009, FR-006).

## R3. Response cache dùng chung (FR-012)

**Decision**:

- REST: guard (R2) ném lỗi trước `checkCacheMiddleware` (`app-pipeline.ts:167`) → không đọc, không ghi cache (lỗi không
  tới `respond`). `?export=` vốn không ghi cache (`respond.ts:39-44`), import là POST.
- GraphQL: `checkCacheMiddleware` đọc cache cho POST/GET `/graphql` theo text document (`get-cache-key.ts:55`) trước khi
  parse; guard đặt `res.locals['skipCacheRead'] = true` khi `hasSearchOff()` (R1) và text của document
  (`getGraphqlQueryAndVariables(req).query`) khớp `/\bsearch\b/` (thu hẹp khi checklist 2026-10-27, CHK023: không
  collection nào tắt tìm kiếm thì cache như Directus); `middleware/cache.ts` (file port) thêm một dòng Backoffice: có cờ thì `MISS` và `next()`. Resolver
  (R4) ném lỗi cho field bị chặn; document có lỗi không ghi cache (`graphql.controller.ts:51-53`). Giới hạn ghi
  `ponytail:` trong code và spec (R11, D-188.4): khi có collection tắt tìm kiếm, document GraphQL có chữ `search` (kể cả
  field tên `search`) không được Backoffice trả từ cache, chỉ ghi; body giống hệt, header cache khác (MISS,
  `Cache-Control` TTL đầy đủ); bộ đối chiếu gửi `cache-control: no-store` cho request đọc (`tests/parity/src/parity.ts:
  114-119`) nên không thấy khác biệt này, `graphql/cache.test.ts` không dùng `search`; nâng cấp khi benchmark cho thấy cần: parse document và dò
  collection trước cache (lặp lại phần dò quan hệ của `getQuery`).

**Rationale**: entry do Directus ghi (shared, separate-domain) có cùng key (`version` = `DIRECTUS_COMPAT_VERSION`, user,
path, query; `get-cache-key.ts:50-57`) nên Backoffice sẽ trả 200 đã cache cho request bị chặn nếu không chặn trước
cache; parse + dò collection trước cache là ~80 dòng lặp `getQuery` (alias, fragment, hậu tố `_by_id`/`_aggregated`,
tiền tố mutation, scope system) chỉ để giữ HIT cho query có `search`. `tests/parity/src/graphql/cache.test.ts` và
`items/cache-*.test.ts` không dùng `search` (grep 2026-10-27) nên bộ đối chiếu cache không đổi.

**Alternatives**: parse + dò trước cache (chính xác, nhiều code); không làm gì (vi phạm FR-012 ở shared/separate-domain);
tắt đọc cache cho mọi `/graphql` (mất HIT cho mọi query).

## R4. GraphQL: chỗ kiểm, lỗi, mutation (FR-003, FR-017, clarify câu 1)

**Decision**: gọi `assertCollectionToggles(collection, query, gql.schema)` ở hai resolver sau khi biết tên collection
thật:

- `resolvers/query.ts`: sau khối `if (isAggregate) ... else ...` (dòng 25-41; `_aggregated`, `_by_id`, `_by_version` đã
  bỏ hậu tố), trước `gql.read` (dòng 50). `getQuery` (`schema/parse-query.ts:168-181`) đã đưa đối số của field lồng vào
  `query.deep[path]._search`, nên một lần đi `deep` (R2) là đủ cho field quan hệ lồng; `getAggregateQuery` ra `Query`
  với `search` (`sanitizeQuery(rawQuery)`).
- `resolvers/mutation.ts`: sau khi bỏ hậu tố `_batch`/`_items`/`_item` (dòng 30-32), trước `upsertSingleton` và
  `getService` (dòng 34-38): `query` của dòng 20 chứa `search` của mutation (kế thừa đối số query đọc,
  `schema/write.ts:58-60`) → từ chối trước khi ghi (clarify câu 1).
- Scope `/graphql/system`: `resolveQuery` dùng chung (collection `directus_<x>`, không có trong map, không chặn; field
  lồng vào collection người dùng vẫn kiểm qua `deep`). Resolver riêng của `resolvers/system.ts` (`users_me`,
  `server_specs`...) gọi `getQuery` cho collection hệ thống: không thêm kiểm (deep từ `users_me` vào collection người
  dùng qua quan hệ admin tự thêm là góc hiếm; ghi ở Assumptions, R11).
- Lỗi: `ForbiddenError` ném trong resolver → `utils/process-error.ts` giữ `message` và `extensions.code = FORBIDDEN`,
  `path` của field; HTTP 200, `data` của field khác vẫn có (cách GraphQL trả lỗi từng field); controller chỉ đặt
  `res.locals.cache = false`. Schema GraphQL không đổi (không đối số, type mới) → introspection/SDL parity giữ nguyên
  (FR-003).

**Rationale**: resolver là lớp HTTP của GraphQL (FR-009); `collection` thật chỉ có sau khi bỏ hậu tố; `getQuery` nhận
`collection` kèm hậu tố ở mutation (`mutation.ts:20`) nên không kiểm trong `getQuery`.

**Alternatives**: kiểm trong `getQuery`/`getAggregateQuery` (thiếu tên thật ở mutation; 4 chỗ gọi của `system.ts`);
validation rule của graphql-js trước execute (cần dò collection như R3, và mất lỗi từng field).

## R5. Web: drawer chọn item, `list-o2m`, `list-m2m` (FR-014, clarify câu 2)

**Decision**:

- `components/drawers/DrawerCollection.vue`: `showSearch = computed(() => collectionInfo.value?.meta?.bo_show_search !==
  false)` (đã có `useCollection(collection)` dòng 59), `activeSearch = computed(() => showSearch ? search : null)`;
  layout wrapper `:search="activeSearch"` (dòng 179), `<SearchInput :show-search="showSearch" ...>` (dòng 204; prop có từ
  022, `components/SearchInput.vue:22`). `directus-shim/components/DrawerCollection.vue` bọc component này (dòng 6) nên
  drawer của extension theo cùng (FR-014).
- `interfaces/list-o2m/ListO2M.vue`: `showSearch` theo `relationInfo.value?.relatedCollection.meta?.bo_show_search !==
  false` (collection nhận `search`: `use-relation-multiple.ts:382`); `v-if="enableSearchFilter && showSearch && (...)"`
  (dòng 556) và `if (search.value && showSearch.value) q.search = search.value` (dòng 163) để giá trị cũ không gửi.
- `interfaces/list-m2m/ListM2M.vue`: như trên với `relationInfo.value?.junctionCollection.meta?.bo_show_search`, vì request
  có `search` đi tới collection trung gian (`use-relation-multiple.ts:365`, `:377`, `:467`, `:470`; search của Directus
  chỉ tìm trên field của collection gốc, không qua quan hệ).

**Rationale**: cùng quy tắc với Content (`CollectionRoute.vue:140-144`); web ẩn đúng ô mà API sẽ từ chối, không ẩn hơn
(m2m: collection trung gian nhận từ khóa, không phải collection liên quan). Câu chữ FR-014 sửa ở R11.

**Alternatives**: m2m theo collection liên quan (ẩn khi API vẫn nhận, trái "cùng quy tắc"); bắt lỗi 403 và ẩn ô sau khi
lỗi (người dùng thấy lỗi một lần).

## R6. E2E (FR-018)

**Decision**: sửa `apps/web-e2e/src/content-collection-toggles.spec.ts`:

- Bước API của test "both false" (dòng 143-157): ở `proxy-api` và `cors` mong 403 `FORBIDDEN` cho `?search=`, `?export=csv`
  (`api.call` ném hay trả lỗi: dùng helper trả status như `apiRequests`), `POST /utils/export/bo_content` và
  `POST /utils/import/bo_content` (CSV một dòng, item không tăng); ở `proxy-directus` (API là Directus) mong 200 như
  hiện nay (`e2eConfig === 'proxy-directus'`, `helpers/config.ts:6`; cách của `content-filter-json-path.spec.ts:15`).
- Test drawer (US4-1): collection per-run `e2e_toggles_<run>` có m2o `target` → `bo_content` (như
  `content-filter-json-path.spec.ts:64-69`); `bo_show_search` của `bo_content` tắt; mở item mới của collection đó, bấm
  field `target` → drawer (`getByRole('dialog')` có `table`): không `searchbox`, có nút Filter, bảng tải.
- Test `list-o2m` (US4-4): per-run `e2e_toggles_parents_<run>` có o2m `children` (interface `list-o2m`,
  `enableSearchFilter: true`) → `e2e_toggles_<run>.parent`; seed 11 con (ô search chỉ hiện khi `totalItemCount > 10`,
  `ListO2M.vue:556`); tắt search của collection con; mở item cha: không ô nhập từ khóa trong field `children`.
- Chạy ba cấu hình với admin và user thường như test hiện có (`for (const who of ['admin','reader'])`).

**Rationale**: fixture `bo_content` và snapshot giữ nguyên; collection per-run như 023.

## R7. Parity (FR-018, Nguyên tắc V)

**Decision**: file mới `tests/parity/src/items/collection-toggles.test.ts` (thêm vào hai danh sách của `suite.ts`:
reduced dòng 15, full dòng 43):

- Collection per-run `parity_toggles_<run>` (string `title`), `parity_toggles_child_<run>` (m2o `parent`), tạo qua
  `createUserCollection` của `permissions/fixtures.ts` như `json-path.test.ts`; tắt từng cài đặt bằng
  `PATCH /collections/parity_toggles_<run>` ở Directus (DB chung) rồi `POST /utils/cache/clear` ở cả hai app.
- `parity(...)` cho mỗi đường: `GET`/`SEARCH /items` có `search`, `?search=` rỗng (giống), `GET :pk?search=`, `PATCH`,
  `DELETE` theo `query.search`, `deep[children][_search]`, `?export=csv|json`, `POST /utils/export`, `POST /utils/import`
  (multipart, `files/helpers.ts`), `/graphql` (`gql()` của `graphql/helpers.ts`: query gốc, `_aggregated`, field lồng,
  `create_*_items(search)` rồi đếm dòng không tăng), `POST /items?search=` và `?export=` (đếm dòng không tăng), admin,
  user thường, share (đăng nhập share theo `auth/shares.test.ts`; sửa khi checklist 2026-10-27, CHK028), public
  (`getPublicPolicy` của `schema/helpers.ts`) và static token (user của `createUser`, `permissions/fixtures.ts:204`)
  (sửa khi analyze 2026-10-27, G2). Endpoint hệ thống (analyze C1, Nguyên tắc V; thay quyết định "chỉ unit" của
  CHK029): collection per-run `parity_toggles_owned_<run>` có m2o `owner` → `directus_users` và alias o2m
  `parity_toggles_owned_<run>` trên `directus_users` (dòng `directus_fields` + `one_field` của quan hệ, không DDL bảng
  hệ thống), `GET /users?deep[<alias>][_search]=x` và `/graphql/system` `users { <alias>(search: "x") { id } }`; file
  chạy một mình (`fileParallelism: false`, `tests/parity/vitest.parity.config.ts:10`; mỗi shard Postgres có env riêng),
  `afterAll` xóa alias, quan hệ, collection. FR-013 (analyze G1): `setToggles(meta, { clear: false })` sửa ở Directus
  không xóa cache tay, request sau tới Backoffice 403 (bus `schemaChanged` qua Redis dùng chung của cặp chính). Khác biệt
  chấp nhận bằng entry `accepted-differences.ts`:
  `{ id: 'D-188', kind: 'http', endpoints: ['GET /items/parity_toggles_*', 'SEARCH /items/parity_toggles_*', 'PATCH
  /items/parity_toggles_*', 'DELETE /items/parity_toggles_*', 'GET /items/parity_toggles_*/*', 'POST
  /utils/export/parity_toggles_*', 'POST /utils/import/parity_toggles_*', 'GET /users', 'POST /graphql', 'POST /graphql/system'], location: { any: true }, when:
  { backofficeCode: 'FORBIDDEN' } }` (`when.backofficeCode` có trong type, dòng 21; GraphQL 200/200 khác body → `any` +
  `backofficeCode` đọc `errors[0].extensions.code` [Inference: kiểm cách `parity.ts` đọc `backofficeCode` ở T-parity]).
  Backoffice kiểm thêm: status 403, body `ForbiddenError`, dữ liệu không đổi.
- Toggle bật và null: `assertParity` (giống hệt, FR-011).
- Cache (US5-2): trên cặp chính (cache bật, `CACHE_SKIP_ALLOWED`, `items/cache-cross.test.ts:334`): gọi `GET
  /items/parity_toggles_<run>?search=x` ở Directus (200, ghi cache), rồi cùng request ở Backoffice → 403; cùng document
  GraphQL → `errors` FORBIDDEN.
- Flow (US5-3, FR-009): `flows/operations.test.ts` thêm case `item-read` có `query.search` trên collection tắt: cả hai
  app trả dữ liệu như nhau.
- Extension (US5-3, FR-009, SC-004; sửa khi checklist 2026-10-27, CHK027): profile `extensions`,
  `extensions/endpoints.test.ts`: tắt ba cài đặt của `bo_ext_items`, `GET /parity-endpoint-demo/items?search=x&export=csv`
  giống ở hai app (endpoint đọc `bo_ext_items` qua `ItemsService`, route không phải `/items`).
- Thu dọn: bật lại cài đặt và `POST /utils/cache/clear` trong `afterAll` để D-188.4 không chạm file khác chạy sau.
- D-188.1, D-188.2, D-188.3, D-188.4: `kind: 'doc'`.

**Rationale**: cùng dạng D-184 (`json-path.test.ts`); mọi request không bị chặn vẫn qua `assertParity`.

## R8. Unit test

- `utils/collection-toggles.test.ts` (knex-mock-client: miss → một `select`; `false`/`0`/`null`; `assertCollectionToggles`
  với `search` rỗng/khoảng trắng, `export`, `deep` o2m/m2o/a2o, quan hệ không có).
- `middleware/collection-toggles-guard.test.ts` (path → collection gốc; `/graphql` đặt cờ theo regex; đường khác
  `next()`); `middleware/cache.test.ts` thêm case cờ.
- `controllers/items.controller.test.ts`, `utils.controller.test.ts` thêm case 403 và case bật.
- `services/graphql/resolvers/query.test.ts` thêm case; `mutation.test.ts` (mới nếu chưa có): `search` → 403 trước
  `createMany`.
- Web: `DrawerCollection.test.ts` (prop `show-search`, `search` null), `ListO2M.test.ts`, `ListM2M.test.ts` (mới nếu
  chưa có: ô ẩn theo meta, `query.search` không gửi).

## R9. Tài liệu

- `specs/022-collection-ui-toggles/spec.md`: FR-008, FR-009 thêm "(sửa bởi 024: API cũng chặn; DrawerCollection theo
  cài đặt)"; US2 kịch bản 4 ghi chú.
- `deploy/README.md` (sau đoạn D-184 dòng 270): D-188 ở shared-domain; `tests/parity/README.md` (gần dòng 132): file
  mới và D-188; `CLAUDE.md` Active Technologies + Recent Changes; `SPECKIT-GUIDE.md` trạng thái 024.
- `design-system/docs/migration-guide.md`: không đổi (không màu, component mới).

## R10. Chia lượt

1. API: R1–R4, unit, parity R7 (kể cả flow case), docs API. Bước API của E2E 022 (`content-collection-toggles.spec.ts`
   dòng 143-157) sẽ đỏ ở `proxy-api`/`cors` khi lượt 1 lên CI trước lượt 2 → đảo bước này ngay trong lượt 1.
2. Web: R5, unit web, E2E drawer và `list-o2m` (R6), docs còn lại, "sửa bởi 024" ở spec 022.

## Kết quả T001 (2026-10-27, đọc code)

- (a) Khóa `deep` của quan hệ a2o là `field:collection` ở REST (`database/get-ast-from-query/lib/parse-fields.ts:255`,
  `:261` đọc `options.deep?.[\`${fieldKey}:${relatedCollection}\`]`). GraphQL: `getQuery` ghi `field__collection` rồi
  `filterReplaceM2ADeep` (`services/graphql/utils/filter-replace-m2a.ts:75-77`) đổi thành `field:collection` trước khi
  trả `query`, nên `assertCollectionToggles` chỉ cần dạng `field:collection`. Thêm: khóa `deep` có thể là alias
  (GraphQL ghi `deep` theo alias của field và `_alias` ở mức cha, `parse-query.ts:93-104`; REST có `alias`), nên hàm đi
  `deep` đổi khóa qua `query.alias` ở gốc và `_alias` ở mức lồng, như `filterReplaceM2ADeep:63`.
- (b) `when.backofficeCode` so `errors[0].extensions.code` của body Backoffice không phụ thuộc status
  (`tests/parity/src/parity.ts:336`, `errorCode` `:359-361`), nên entry D-188 khớp cả response GraphQL 200/200 có lỗi.
- (c) `createCollectionForbiddenError` là bản port nguyên văn (`permissions/modules/process-ast/utils/validate-path/
  create-error.ts`), cùng câu Directus trả cho user không có quyền; parity T012 so câu này ở cả hai app.

## Kết quả T002 (2026-10-27, env parity Postgres local)

Đo qua `parity/items/collection-toggles.test.ts` (Directus 11.17.4 ở `http://127.0.0.1:8155`): `GET`/`SEARCH /items/<c>`
có `search` (kể cả `aggregate`, `groupBy`, chỉ khoảng trắng) và `GET /items/<c>/<pk>?search=` khớp item → 200;
`PATCH /items/<c>` theo `query.search` → 200; `DELETE /items/<c>` theo `query.search` → 204; `?export=` → 200 có file;
`/users?deep[...][_search]=` và GraphQL (gốc, `_aggregated`, field lồng, `/graphql/system`) → 200 không lỗi. Đúng cột
Directus của `contracts/api.md`. `POST /utils/import`, `POST /utils/export`, `POST /items?search=` chỉ gửi tới Backoffice
(ghi dữ liệu thật ở Directus), nên cột Directus của các hàng đó giữ theo code `directus/api/src/controllers/utils.ts`.

Khi implement: entry `http` D-188 chỉ gồm `GET`/`SEARCH`/`PATCH`/`DELETE /items/parity_toggles_*`; GraphQL, `/users`,
đường ghi, import, export so riêng từng app trong file đó, để entry không che một lỗi FORBIDDEN thật của `POST /graphql`
hay `GET /users` ở file khác (khác chữ của T013, research R7).

## Kết quả lượt 1 (2026-10-27, local)

- Test DB SQLite của `apps/api` (`test/directus-db.ts`) không có ba cột `bo_show_*`: `getCollectionToggles` bắt lỗi
  của câu `select` và coi mọi cài đặt là bật, không cache (FR-008 "không có cột = bật"); trên DB thật cột luôn có vì
  `start` dừng khi thiếu migration 20261026A. Test controller thêm cột bằng `alterTable` trong case của 024.
- `assertCollectionToggles` thoát sớm khi query không có `search`, `export`, `deep` (không tra cache, không query).
- Lỗi chặn kèm `extensions.reason` như lỗi quyền collection hiện có (cùng thân lỗi `collectionExists` trả).
- Parity: `items/collection-toggles.test.ts` 51 case xanh trên Postgres (admin, user JWT, static token, share, public;
  `/users` deep, `/graphql/system`, mutation, cache do Directus ghi trước, FR-013 không xóa cache tay); `afterAll` xóa
  dòng của A trước `cleanup()` vì `A.owner` có khóa ngoại tới user test. `flows/operations.test.ts` (item-read có search)
  và `extensions/endpoints.test.ts` (chạy trên cặp chính, không cần profile `extensions`) xanh. Bộ hiện có
  `items/{crud,export,json-path}`, `graphql/{read,write,schema}`, `system/import-export` xanh.
- E2E `content-collection-toggles.spec.ts` 9/9 ở `proxy-api`, `proxy-directus`, `cors` (env mới cần seed bộ fixture
  `bo_*` bằng `apps/web/fixtures/interfaces/seed.mjs` như CI).

## R11. Sửa spec khi plan (câu chữ, áp vào spec cùng commit plan)

- FR-012: thêm "Backoffice không đọc response cache cho document GraphQL có từ `search` (chỉ ghi); response giống hệt,
  chỉ mất HIT" (R3).
- FR-013: "cache hệ thống dùng chung" → "cache schema trong process của mỗi replica, xóa theo bus `schemaChanged` như
  SchemaOverview (002)" (R1).
- FR-014: `list-m2m` theo cài đặt của collection trung gian (collection nhận từ khóa), `list-o2m` theo collection liên
  quan (R5).
- D-188 (App mới): GraphQL "HTTP 200, `errors[].extensions.code = FORBIDDEN` cho field đó, field khác vẫn có dữ liệu"
  (R4).
- Assumptions: resolver riêng của scope system (`users_me`...) không kiểm deep vào collection người dùng (R4); REST
  endpoint hệ thống có `deep._search` vào collection người dùng do guard lo (R2).
