# Research: Quản lý data model (006)

Mỗi mục gồm Quyết định, Lý do, Đã cân nhắc. Mốc so sánh là Directus 11.17.4 (api 35.2.0). Điều gì chưa đo thì ghi
`[Suy luận]` và có task kiểm sớm. Các quyết định lớn đã chốt ở Clarifications của spec: DDL trên bảng hệ thống (field
người dùng, index) làm như Directus và sửa constitution; so DDL nối tiếp trên cùng DB với cùng tên; benchmark năm route
đọc, snapshot, diff; seed blackbox 004, 005 có cờ chọn app; CLI schema ngoài phạm vi. Đường dẫn Directus tính từ
`directus/api/src` trừ khi ghi khác.

## R1. Thư viện và phiên bản

- **Quyết định**: Thêm vào catalog `pnpm-workspace.yaml` đúng bản của `directus/pnpm-workspace.yaml`: `deep-diff` 1.0.2
  và `@types/deep-diff` 1.0.5 (`get-snapshot-diff`, `apply-diff`, `validate-diff`, type `SnapshotDiff`), `busboy` 1.6.0
  và `@types/busboy` 1.5.4 (`schemaMultipartHandler`), `zod` 4.1.12 (`systemFieldUpdateSchema` của `services/fields.ts:56`,
  dùng ở `controllers/fields.ts` và `updateField`). Dùng lại bản đã có: `joi` 18.2.6 (Directus 18.0.1, bản vá của 003),
  `js-yaml` 4.3.2 (Directus 4.1.1; chỉ `load` file YAML của `/schema/diff`, `/apply` và `dump` của export đã có ở 005),
  `object-hash` 3.0.0 (`getVersionedHash`), `lodash-es`, `knex`, `wellknown` 0.5.0 (geometry helper đã có),
  `knex-mock-client` 3.0.2 và `@backoffice/schema-builder` (test gốc của service).
- **Lý do**: Cùng bản thì cùng kết quả: `deep-diff` quyết định hình dạng `diff` (kind, path, lhs, rhs) mà client và
  Directus đọc; `busboy` quyết định lỗi parse multipart; `zod` giữ file `fields.ts` port nguyên. `object-hash` của cùng
  object `{item, version: '11.17.4'}` cho cùng `hash` nên diff lấy ở app này apply được ở app kia (FR-043).
- **Đã cân nhắc**: Viết lại `systemFieldUpdateSchema` bằng `joi` để không thêm `zod`: bị loại, một dòng khác nguồn ở
  file 1.053 dòng không đáng, và `zod` sẽ cần cho `websocket/messages` (011) và `@directus/types` port sau. Thay
  `deep-diff` bằng so sánh tự viết: bị loại, định dạng `diff` là API công khai (`POST /schema/diff` trả về, `apply` nhận).

## R2. Bốn controller trong Nest, middleware và `OPTIONS`

- **Quyết định**: Bốn file `controllers/{collections,fields,relations,schema}.controller.ts`, mỗi handler một route theo
  đúng thứ tự file gốc; mount theo `app.ts` của Directus: `collections`, `fields` trước `items`, `relations`, `schema` sau
  (thứ tự chỉ ảnh hưởng `OPTIONS`, `router-options.ts` thêm dòng tương ứng). Chi tiết ở
  [contracts/schema-api.md](./contracts/schema-api.md).
  - `/collections`: không `useCollection` (`req.collection` là `undefined`, như Directus; ảnh hưởng `permissionsCacheable`
    của response cache, 005); `validateBatch('read')` cho `GET /` và `SEARCH /` qua `runMiddleware`; `MetaService`
    cho `meta` (`getMetaForQuery('directus_collections', {})`).
  - `/fields`: `useCollection('directus_fields')` trong `app.module.ts`; `collectionExists` của 005 (Directus import nó
    với tên `validateCollection`, `controllers/fields.ts:9`) qua `runMiddleware` ở đầu các handler có `:collection`;
    Joi `newFieldSchema`, `updateSchema` và `systemFieldUpdateSchema` (zod, từ service) giữ nguyên; query
    `concurrentIndexCreation` đọc như gốc (`'concurrentIndexCreation' in req.query && !== 'false'`).
  - `/relations`: `useCollection('directus_relations')`; Joi `newRelationSchema`, `updateRelationSchema` giữ nguyên.
  - `/schema`: `schemaMultipartHandler` port nguyên làm middleware chạy qua `runMiddleware` (busboy đọc `req` thô: app
    Nest tạo với `bodyParser: false`, `app.ts:28`, và `jsonBody` của pipeline chỉ parse `application/json` nên stream
    multipart còn nguyên); `readableStreamToString` port vào `@backoffice/utils/node`; `force` đọc khác nhau ở `diff`
    (`'force' in req.query`) và `apply` (`toBoolean`), giữ nguyên.
  - Mọi handler `return respond(req, res)`; `204` khi không có payload (005); lỗi `Forbidden` khi đọc lại sau ghi trả
    `204` như gốc.
- **Lý do**: FR-001 đến FR-003; mẫu R2 của 005 (`ItemsController`, `runMiddleware`, `ServiceFactory`).
- **Đã cân nhắc**: Interceptor Nest cho multipart (`FileInterceptor` của `@nestjs/platform-express`, multer): bị loại,
  khác lỗi và giới hạn so với busboy của Directus (`415`, "More than one file", JSON theo mimetype).

## R3. Port nguyên ba service và service schema

- **Quyết định**: Port nguyên, cùng đường dẫn, kèm test gốc (`services/collections.service.ts` ← `services/collections.ts`
  848 dòng, test 711; `fields.service.ts` ← `fields.ts` 1.053, test 1.483; `services/fields/{build-collection-and-field-relations,
  get-collection-meta-updates,get-collection-relation-list}.ts` 222 dòng, test 494; `relations.service.ts` ← `relations.ts`
  654, không test gốc, viết test mới; `schema.service.ts` ← `schema.ts` 79, test 212). Chỗ khác nguồn, mỗi chỗ ghi
  `// Backoffice:`: import `getSchema` từ `schema/get-database-schema.ts` (002), `getSystemFieldRowsWithAuthProviders`
  từ `schema/get-field-system-rows.ts`, `getDefaultValue`, `getLocalType` từ `schema/`; `systemFieldRows` cấp module của
  `fields.ts:53` giữ nguyên cách gọi. Bổ sung phần thiếu, port nguyên từ Directus: `ALLOWED_DB_DEFAULT_FUNCTIONS`
  vào `constants.ts`; `addFieldFlag` (`packages/utils/shared/add-field-flag.ts`, kèm test) vào `@backoffice/utils`;
  `flushCaches` vào `cache.ts` (`cache.ts:91` của Directus; header của `apps/api/src/cache.ts` đã hẹn "đến cùng caller
  đầu tiên"); type `Collection`, `ApiCollection` (`packages/types/src/collection.ts`) và `Snapshot*`, `DiffKind`
  (`snapshot.ts`) vào `@backoffice/types`; `MetaService` đã có. `getHelpers()` đã đủ mọi phương thức ba service gọi
  (`schema.parseCollectionName`, `processFieldType`, `preColumnChange`, `postColumnChange`, `preRelationChange`,
  `setNullable`, `generateIndexName`, `createIndex`, `constraintName`, `isOneOfClients`; `st.createColumn`;
  `date.fieldFlagForField`), đo lại bằng typecheck ở task đầu.
- **Lý do**: FR-010 đến FR-032, FR-050, FR-051. Service gọi `clearSystemCache`, `getCache().cache.clear()` khi
  `shouldClearCache`, `emitter.emitFilter`, `emitAction` đúng như gốc, nên cache hai app và event tự đúng (002, 004, 005
  đã port các phần đó); không sửa service nào của feature trước.
- **Đã cân nhắc**: Gom `fields/*` vào `fields.service.ts`: bị loại, khác cây file gốc, test gốc import theo đường dẫn.
- **Rủi ro**: Test gốc dùng `test-utils/knex.ts` (`createMockKnex`, `setupSystemCollectionMocks`) và
  `__utils__/schemas.ts` (`snapshotApplyTestSchema`, 305 dòng) chưa có trong `apps/api`: port kèm ở task test đầu tiên
  (`apps/api/src/test-utils/knex.ts`, `apps/api/src/__utils__/schemas.ts`), ghi `// Ported from`.

## R4. Snapshot, diff, apply: port nguyên util, không port CLI

- **Quyết định**: Port nguyên kèm test gốc: `utils/get-snapshot.ts` (93, test 452; `version` lấy từ
  `DIRECTUS_COMPAT_VERSION` thay `directus/version`, như `getCacheKey` của 005), `get-snapshot-diff.ts` (197, test 877),
  `apply-diff.ts` (379, test 849), `validate-snapshot.ts` (92, test 67; `version` như trên), `validate-diff.ts` (203,
  test 524), `sanitize-schema.ts` (110, test 538), `get-versioned-hash.ts` (6, test 115; `version` như trên).
  Không port `apply-snapshot.ts` (22 dòng, chỉ CLI gọi; Clarifications: CLI ngoài phạm vi) và test của nó.
- **Lý do**: FR-040 đến FR-043. `hash` = `object-hash({item: snapshot, version: '11.17.4'})`: Directus lấy `version`
  từ `directus/package.json` (11.17.4), nên cùng chuỗi thì cùng hash; ca FR-043 của `snapshot.test.ts` là phép đo.
  Snapshot gọi `getSchema({bypassCache: true})` rồi ba service `readByQuery`/`readAll` không qua quyền (admin), nên
  nội dung bằng nhau khi ba service bằng nhau; thứ tự key do `sortBy` và `omit(meta.id)` của gốc.
- **Đã cân nhắc**: Giữ `apply-snapshot.ts` "cho sau": bị loại (YAGNI, không ai gọi).

## R5. So DDL nối tiếp trên cùng DB (Clarifications, FR-060)

- **Quyết định**: Thư mục mới `tests/parity/src/schema-management/` (contracts/parity.md §1):
  - `ddl-capture.ts`: `captureModel(db, collections[])` trả, cho mỗi collection: `inspector.columnInfo(table)` của
    `@backoffice/schema` (đủ `data_type`, `max_length`, `numeric_precision`, `numeric_scale`, `is_nullable`,
    `default_value`, `is_primary_key`, `has_auto_increment`, `is_unique`, `is_indexed`, `foreign_key_*`, cùng thư viện
    Directus dùng cho `schema` của `/fields`), `foreignKeys()` (tên constraint, `on_update`, `on_delete`), index (tên,
    cột, unique; dùng lại truy vấn catalog theo vendor của `db-snapshot.ts`), và các dòng `directus_collections`,
    `directus_fields`, `directus_relations` của collection đó (bỏ `id` tự tăng, giữ `sort`). Snapshot đầy đủ của
    `db-snapshot.ts` (`snapshot(db)`) chụp trước và sau mỗi ca để kiểm DB trở về như trước (FR-013, FR-023).
  - `ddl-scenario.ts`: `ddlScenario(name, steps)` chạy `steps` (danh sách request) trên Directus, chụp, xóa mô hình qua
    `DELETE /collections` của Directus, kiểm snapshot DB bằng trước; chạy lại trên app mới, chụp, xóa qua app mới, kiểm;
    so hai bản chụp (`toEqual`) và so từng response bằng `parity()` của `parity.ts` với normalizer mới: `meta.id` của
    field và relation (số tự tăng, khác giữa hai lượt) thay bằng dấu hiệu; `date_created` không có ở ba bảng này.
  - `ddl.test.ts`: ma trận FR-060: mỗi kiểu của `TYPES` (14 `KNEX_TYPES`, `hash`, `csv`, `geometry` và 6 kiểu con, `uuid`
    khóa chính) × tùy chọn (`default_value` gồm `now()`, `CURRENT_TIMESTAMP`, `gen_random_uuid()` (Postgres), `is_nullable`,
    `is_unique`, `is_indexed`, `max_length`, `numeric_precision/scale`), ba kiểu khóa chính, folder, field hệ thống thêm
    index (`PATCH /fields/directus_users/email` với `schema.is_indexed`, Clarifications), `concurrentIndexCreation`,
    sửa kiểu (string → text, integer → float, có dữ liệu), sửa `max_length`, nullable, default, unique, index, xóa field,
    xóa collection có đủ phụ thuộc (preset, permission, activity, revision, relation, `item_duplication_fields`, group).
  - `relations.test.ts`: m2o (`on_delete` mỗi giá trị, `on_update`), o2m, m2m, m2a, translations, files (`directus_files`
    m2o), presentation, group; sửa `on_delete`; xóa relation; xóa field m2o, o2m (FR-023); unsigned trên MySQL.
  - `crud.test.ts`: `scenario()` + `flow` của 004 cho US1, US2: body, status, header, lỗi (tên `directus_`, `/`, trùng,
    alias, khóa chính nullable, field hệ thống, non-admin `403`, user có quyền một phần chỉ thấy phần được đọc),
    `OPTIONS`, `HEAD`, `SEARCH`, `PATCH` hàng loạt (kể cả lỗi giữa chừng của `updateFields`, không transaction).
  - Ca DDL trong một file chạy tuần tự (`fileParallelism: false` đã có; trong file dùng `it` tuần tự).
- **Lý do**: FR-060, SC-002, SC-003, Clarifications (A). Tên index và khóa ngoại sinh từ tên bảng nên chỉ so được khi
  cùng tên; chạy nối tiếp còn kiểm luồng xóa và dọn.
- **Đã cân nhắc**: Tiền tố tên theo app (B) và DB thứ hai (C): chủ dự án chọn A.
- **Rủi ro**: Truy vấn catalog index theo vendor của `db-snapshot.ts` chưa chắc trả `unique` và thứ tự cột trên mọi
  vendor (`[Suy luận]`, 001 viết cho bảng hệ thống); task đầu của gói kiểm trên Postgres, MySQL, SQLite với một bảng
  mẫu. MySQL tự commit DDL: ca "lỗi giữa chừng" so cả trạng thái dở dang hai bên (như Directus), không mong rollback.

## R6. Dùng chéo (FR-062) và xóa cache qua API (FR-050)

- **Quyết định**:
  - `cross-use.test.ts`: tham số hóa `schema/fixture.ts` của 002 (`createFixture`) theo app (`directusRequest` →
    `appRequest(app, ...)`, giữ tên `parity_overview_*`; fixture đã có mọi kiểu field, m2m, files junction, translations,
    singleton; thêm `archive_field`, `archive_value`, `unarchive_value`, `sort_field`, folder, m2a, presentation, group,
    geometry). Mỗi chiều: dựng ở app A → `GET /schema/snapshot` ở hai app bằng nhau (bỏ `vendor`? không: cùng DB nên
    cùng vendor) → `POST /schema/diff` với snapshot đó ở app B trả `204` → CRUD item lồng (m2m, translations, m2a) qua
    `/items` của app B → xóa field archive, sort ở app B rồi đọc `directus_collections` (FR-023, US3.5) → xóa mô hình
    ở app B → snapshot DB bằng trước. Chạy hai chiều.
  - `sync-api.test.ts` (profile `multi`, cặp chính): chiều "app mới đổi schema thì Directus và Backoffice-2 thấy" qua API
    (FR-020 của 002 hẹn kiểm lại ở 006): thêm field, đổi kiểu, xóa field, tạo collection và relation, xóa, `apply` diff
    ở app mới → `oasComponent` của Directus và Backoffice-2 thấy trong 1 giây (mẫu `backofficeFollows` của
    `schema/sync.test.ts`, SC-005); thêm ca response cache: `GET /fields/<c>` ở Directus (không header, `x-cache-status`
    `MISS` rồi `HIT`), đổi field ở app mới, `GET` kế tiếp ở Directus `MISS` (cặp chính `CACHE_AUTO_PURGE=true`).
    `schema/clear-system-cache.ts` giữ cho test của 002, sửa comment.
  - `request-set.ts` thêm `GET /collections`, `/fields`, `/relations`, `/schema/snapshot` cho `db-unchanged`,
    `readonly-account`.
- **Lý do**: SC-004, SC-005, SC-006; fixture 002 có sẵn, chỉ đổi URL.
- **Đã cân nhắc**: Viết fixture mới: bị loại, trùng 002.

## R7. Port bộ blackbox collections, fields, schema, timezone

- **Quyết định**: Thêm vào cây `tests/parity/src/items/blackbox/` (giữ tên thư mục của 005, cùng shim `@common`, cùng
  cặp `blackbox` 9555/9556): `tests/db/routes/collections/{crud,schema-cache}.test.ts`,
  `routes/fields/{crud,change-fields}.{test,seed}.ts`, `routes/schema/schema.{test,seed}.ts`,
  `tests/db/schema/timezone/{timezone,timezone-changed-node-tz-asia,timezone-changed-node-tz-america}.test.ts` và seed:
  copy nguyên, header `// Ported from`. Sửa cơ học, mỗi chỗ `// Backoffice:`:
  - Bỏ các khẳng định đọc `tests_extensions_log` ("Verify ... action hook run", extension `action-verify-schema` của
    Directus, D-17, Nguyên tắc XI): `collections/crud.test.ts` (14 dòng mỗi kiểu khóa), `fields/crud.test.ts` (4 dòng,
    và `sleep(1000)` trước đó). Event vẫn được kiểm ở unit test (`emitAction` gọi đúng tên) và `bus.test.ts` của 005
    (thêm thao tác `collections.*`, `fields.*`, `relations.*`, FR-051).
  - GraphQL (`/graphql/system`, 2 chỗ mỗi file crud): về Directus qua `transport.ts` như 005 (011 đổi lại).
  - `ClearCaches` (`POST /utils/cache/clear?system` ở setup URL): giữ như 005 (010); bus `schemaChanged` dùng chung nên
    app mới cũng xóa.
  - `DisableTestCachingSetup` (`TEST_NO_CACHE` → node `CACHE_SCHEMA=false` của Directus): shim bỏ qua, cặp `blackbox`
    giữ `CACHE_SCHEMA=true`; hai app xóa schema qua bus sau mỗi thay đổi nên không có schema cũ; nếu ca nào đỏ vì
    schema cũ thì đó là lỗi thật cần thấy. Ghi chú ở shim.
  - `schema-cache.test.ts` (hai node tự spawn): thay `spawn` và hai object env bằng URL của hai cặp profile mới
    `schema-cache` (có bus Redis, `CACHE_STORE=memory`, `CACHE_AUTO_PURGE=true`, `CACHE_NAMESPACE` khác nhau) và
    `schema-cache-nomsg` (`REDIS_ENABLED=false`, `SYNCHRONIZATION_STORE=memory`); shim `getUrl(vendor, env)` nhận
    `env[vendor].URL`; node 1 là app đang thử, node 2 là app kia của cặp (lượt `backoffice` kiểm chiều app mới → Directus,
    lượt `directus` kiểm chiều ngược; cả hai chiều của FR-050 được kiểm bằng khẳng định gốc).
  - `timezone-changed-node-tz-{asia,america}.test.ts` (node với `TZ` khác): hai cặp profile `tz-asia` (`TZ=Asia/Seoul`)
    và `tz-america` (`TZ=America/Sao_Paulo`), env còn lại như cặp `blackbox` và dùng chung bus, DB; shim `getUrl(vendor,
    env)` ánh xạ `env[vendor].TZ` sang URL của app đang thử trong cặp tương ứng, ném lỗi nếu `TZ` khác hai giá trị đó
    (gốc chọn `Asia/Dubai`, `America/Mexico_City` khi offset máy chạy test trùng; runner CI là UTC).
  - `schema.test.ts:18-19` import `version` của `api/package.json` (35.2.0, chỉ dùng ở ca `403`) và type
    `api/src/types/snapshot.js` (không tồn tại): thay bằng hằng và type của `@backoffice/types`.
  - Bốn file mới `describe.skipIf` khi URL profile vắng (bộ rút gọn MySQL, SQLite mỗi lần push không bật profile).
  - Cờ FR-064: `getSetupUrl()` đọc `PARITY_BLACKBOX_SETUP_APP` (`directus` mặc định, `backoffice`); các helper data model
    (`CreateCollection`, `CreateField*`, `CreateRelation`, `DeleteCollection`, `DeleteField`) vẫn gọi `getSetupUrl()`;
    file test 006 gọi thẳng `request(getUrl(vendor))` cho route đang kiểm như gốc. `blackbox-full` hằng tuần chạy thêm
    một lượt `PARITY_BLACKBOX_SETUP_APP=backoffice` (cả hai `PARITY_BLACKBOX_APP`).
  - Port phần hoãn của `common/common.test.ts` (`createCollection`, `createField`, `createFieldM2O`, `createFieldO2M`,
    `deleteField`, `deleteCollection`): thêm vào `tests/parity/src/permissions/blackbox-common.test.ts` của 004 (chạy
    với fixture riêng theo app).
- **Lý do**: FR-061, FR-064, SC-001; mẫu R6 của 005. Bốn cặp profile mới (8 container) chạy ở job `parity-blackbox`
  (Postgres, hiện chỉ có cặp `blackbox`, DB, Redis).
- **Đã cân nhắc**: Viết lại `schema-cache`, timezone thành `scenario()`: bị loại, giữ khẳng định gốc rẻ hơn. Spawn
  process trong test như gốc: bị loại, hai app là container.
- **Rủi ro**: `[Suy luận]` thời gian thêm khoảng 5 phút mỗi lượt (8 file). Ca fail trên chính Directus ở một vendor:
  `it.skipIf` theo vendor kèm ghi chú (Assumptions).

## R8. Cache response, `DB_EXCLUDE_TABLES`, biến môi trường

- **Quyết định**: Không thêm biến. `GET /collections`, `/fields`, `/relations`, `/schema/snapshot` đi qua `cache` và
  `respond` của 005 nên được cache và trả header như Directus (`req.collection` `undefined` ở `/collections` và
  `/schema`; `directus_fields`, `directus_relations` ở hai route kia; `?export` không cache); `POST /schema/diff|apply`
  không cache (không phải `GET`). `DB_EXCLUDE_TABLES` thuộc `DB_.+` nhóm A. Không có biến `BACKOFFICE_*`.
- **Lý do**: FR-001, Nguyên tắc VIII.

## R9. Playwright: module Data Model và Content (FR-063)

- **Quyết định**: `tests/directus-app-e2e/src/data-model.spec.ts` với `bothRuns` (lượt proxy: app Directus gọi
  `/collections`, `/fields`, `/relations`, `/schema` của app mới; lượt `dir`: Directus): ở `/admin/settings/data-model`
  tạo collection `e2e_<tag>_articles` (dialog New Collection, khóa chính tự tăng, `POST /collections`), thêm field
  `title` (string), `status` (dropdown), m2o `author` tới `directus_users`, translations (wizard tạo
  `e2e_<tag>_languages` và junction, `POST /relations` ×2), group, divider; `/admin/content/<c>/+` tạo item có bản
  dịch; xóa field, xóa collection; so dòng DB (`changesSince`, bảng người dùng) và so `GET /schema/snapshot` lấy trực
  tiếp từ Directus (8155) với lấy qua proxy (app mới) sau mỗi lượt. `routing.spec.ts` thêm khẳng định bốn route tới app
  mới; `proxy/backoffice-routes.txt` thêm `collections`, `fields`, `relations`, `schema`.
- **Lý do**: FR-063, SC-004; app Directus là client khó tính nhất của bốn route này (gửi `fields[]` lồng, `meta`
  đầy đủ, `PATCH /fields/:c` hàng loạt khi kéo thả sort).
- **Đã cân nhắc**: Kiểm `POST /utils/sort` (kéo thả item): thuộc 010, route vẫn về Directus qua proxy.

## R10. Benchmark (FR-065, SC-007)

- **Quyết định**: `tests/benchmark/src/{schema,seed-schema}.ts`, target `benchmark:schema`, job `benchmark-schema` trong
  `benchmark.yml` (hằng tuần, bấm tay, không chặn CI). Seed qua API của Directus (Postgres): 200 collection
  `bench_schema_<n>` × 15 field (đủ kiểu, 1 m2o tới `bench_schema_<n-1>`), 100 alias o2m đối diện → 300 dòng
  `directus_relations`, 3.000 dòng `directus_fields`; policy cho user có quyền đọc 50 collection với `fields` một phần.
  Kịch bản (`Scenario` của `items.ts`: warm-up, `BENCH_ROUNDS` lượt xen kẽ, so bằng `compare()` 10%): `GET /collections`,
  `GET /fields`, `GET /relations`, `GET /schema/snapshot` (admin, user), `POST /schema/diff` với snapshot hiện tại
  (admin, trả `204`); chế độ tươi (`Cache-Control: no-store`) và `HIT`. Số 200/3.000/300 là giả định của spec; đo lần
  đầu rồi chỉnh. Đã chỉnh (T054): 60 collection (snapshot dưới 1 MB, `MAX_PAYLOAD_SIZE` mặc định), snapshot và diff
  chạy 5 kết nối.
- **Lý do**: Clarifications (B), SC-007.
- **Đã cân nhắc**: Đo thao tác ghi DDL: bị loại (Clarifications).

## R11. Sổ khác biệt, spec cũ, constitution

- **Quyết định**: `accepted-differences.ts`: xóa entry `D-09.4` (dòng 79; guard đỏ khi spec `Done` mà entry còn);
  thêm entry `D-32` (`DELETE /collections/directus_*`: app mới `403`, Directus xóa bảng; không `removeAt`); R-11 ghi
  trong spec, không cần entry vì bộ so chỉ gọi `PATCH /collections/directus_<x>` ở cả hai app với cùng kết quả.
  `CollectionsService.deleteOne` của app mới thêm một `if` ở đầu (ghi `// Backoffice: D-32`): `isSystemCollection(key)`
  → `ForbiddenError`, trước `readByQuery`;
  spec 001 bản đồ D-09: dòng D-09.4 ghi "Gỡ ở 006"; Assumptions của 004, 005 ghi chú seed nay chọn được app (FR-064);
  comment `getSetupUrl` của shim và `schema/clear-system-cache.ts` sửa theo; `README.md` của parity thêm mục 006.
  Constitution 1.3.0 → 1.4.0 (MINOR) đã ban hành 2026-10-12 (trước implement, theo `/speckit.analyze` C1): Nguyên tắc
  II cho phép cột người dùng trong collection hệ thống qua API fields và index trên cột hệ thống (`schema.is_indexed`)
  như Directus; cấm đổi cột gốc, xóa bảng hệ thống và migration (Clarifications, D-32); Sync Impact Report ghi lý do;
  `plan-template.md` dòng II và `SPECKIT-GUIDE.md` sửa theo.
- **Lý do**: Nguyên tắc X; FR-024 trái chữ của 1.3.0, đã giải bằng 1.4.0 (Complexity Tracking).

## R12. Unit test

- **Quyết định**: Port kèm code: 13 file test gốc của R3, R4 (khoảng 6.300 dòng) cùng `test-utils/knex.ts`,
  `__utils__/schemas.ts`, `add-field-flag.test.ts`, `readable-stream-to-string.test.ts`. Viết mới:
  `services/relations.service.test.ts` (không có gốc: kiểm tra đầu vào, DDL khóa ngoại qua `knex-mock-client`, m2a
  không FK, `alterType`, xóa), bốn `*.controller.test.ts` (supertest qua app Nest như `items.controller.test.ts`: route,
  Joi, `validateCollection`, field hệ thống, multipart JSON và YAML, một file, `415`, `force`, `204`),
  `cache.test.ts` thêm `flushCaches`, `router-options.test.ts` thêm bốn nhóm route. Coverage 80% `apps/api`.
- **Lý do**: Nguyên tắc X; test gốc là bằng chứng port trung thành.

## R13. Thứ tự làm và tách nhỏ

- **Quyết định**: Gói A (nền): R1, type và util thiếu, `flushCaches`, test-utils, `CollectionsService`, `FieldsService`,
  `RelationsService` kèm test gốc (T đầu: typecheck ba service sau khi port để lộ helper thiếu). Gói B (route):
  R2 ba controller, `router-options`, proxy route, `crud.test.ts`, `request-set`, `ddl-capture` (đo truy vấn index ba
  vendor), `ddl.test.ts`, `relations.test.ts`. Gói C (schema): R4 util và test, `SchemaService`, controller `/schema`,
  `cross-use.test.ts`, `sync-api.test.ts`. Gói D (blackbox): R7 shim, cờ `PARITY_BLACKBOX_SETUP_APP`, bốn cặp profile,
  file port, `blackbox-common`, CI (`parity-blackbox`, `parity` rút gọn, `blackbox-full`). Gói E (sổ sách): R9
  Playwright, R10 benchmark, R11 spec cũ, README, constitution 1.4.0, đóng feature. A → B → C → D, E song song sau C.
  Nếu `tasks.md` vượt khoảng 60 task, tách hai phần (A+B+C, D+E) như 004, 005.
- **Lý do**: B cần service; C cần B (snapshot gọi ba service, cross-use cần route); D cần C (`schema.test.ts`).
