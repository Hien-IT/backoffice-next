# Research: Index ghép, index trigram và tạo index không khóa bảng (030)

Đọc code ngày 2026-11-03 (hai lượt đọc có ghi dòng) và chạy thử trên Postgres 13.16 (`postgis/postgis:13-3.4-alpine`,
image của parity) và MySQL 8.4.13 (`mysql:8`) bằng container dùng một lần. Mục ghi [Inference] là suy ra từ code, có task
kiểm ở lượt 1; mục [Verified] đã chạy thử hoặc đọc đúng dòng; mục [Unverified] thử ở T001 trước khi viết code.

## R1. Helper index theo vendor: mở rộng `createIndex` thay vì viết helper mới

**Hiện trạng** [Verified]:

- `CreateIndexOptions = { attemptConcurrentIndex?: boolean; unique?: boolean }`
  (`apps/api/src/database/helpers/schema/types.ts:24-27`); `createIndex(collection, field: string, options)` là phương
  thức **cụ thể** của lớp cơ sở (`:216-222`): `CREATE [UNIQUE] INDEX ?? ON ?? (??)`, một cột.
- `generateIndexName(type: 'unique' | 'foreign' | 'index', collection, fields: string | string[])` (`:44-46`) **đã
  nhận mảng**: `apps/api/src/utils/get-default-index-name.ts:17-34` nối `table_f1_f2_type`, quá dài thì
  `prefix__<hash>_<type>`; maxLength mặc định 60, Postgres 63 (`dialects/postgres.ts:9-15`), MySQL 64 (`mysql.ts:12-18`),
  SQLite ∞ (`sqlite.ts:6-12`), MSSQL 128, Oracle ∞ với sha1 khi > 128, CockroachDB mặc định.
- Postgres `createIndex` (`postgres.ts:59-77`): `CREATE [UNIQUE] INDEX CONCURRENTLY ?? ON ?? (??)` khi
  `attemptConcurrentIndex`. MySQL (`mysql.ts:94-125`): thử `ALGORITHM=INPLACE LOCK=NONE`, `.catch(() => blockingQuery)`.
  SQLite không override. MSSQL `WITH (ONLINE = ON)` chỉ Enterprise, Oracle `ONLINE`, CockroachDB `CONCURRENTLY`.
- Không có helper `dropIndex`; chỗ khác dùng Knex `table.dropIndex([field], name)` / `dropUnique` (`fields.service.ts:1006,
  :1014`).
- Caller của `createIndex`: `fields.service.ts:1041,1048` (`addColumnIndex`, sau transaction khi concurrent, `:474-479`)
  và hai migration DR `20251028A:27`, `20260113A:26` (ngoài transaction, không try/catch).

**Decision**: đổi chữ ký trong lớp cơ sở thành `createIndex(collection, field: string | string[], options)` với
`CreateIndexOptions` thêm `type?: 'btree' | 'trigram'` (mặc định `btree`); lớp cơ sở sinh `(${fields.map(() => '??')})`
và ném `InvalidPayloadError` "Trigram indexes need PostgreSQL" cho `trigram`; Postgres override thêm nhánh trigram:

```sql
CREATE INDEX [CONCURRENTLY] ?? ON ?? USING gin (lower(??) gin_trgm_ops)
```

MySQL override nhận mảng cột ở cả hai câu (inplace + fallback). Tên: service tự gọi `generateIndexName('unique' | 'index',
collection, fields)`; trigram dùng hậu tố riêng `trgm` → thêm `'trgm'` vào union `type` của `generateIndexName` (cùng
hàm `getDefaultIndexName`, không đổi quy tắc cắt). Mọi caller cũ truyền một chuỗi, không đổi hành vi (unit
`dialects/*.test.ts`, 006 và parity `schema-management` phải xanh nguyên). Thêm `dropIndex(collection, name)` vào lớp cơ
sở: `knex.schema.alterTable(collection, t => t.dropIndex([], name))` ([Unverified] Knex chấp nhận mảng cột rỗng khi có
`indexName`; T001 kiểm trên ba vendor; nếu không, raw `DROP INDEX ??` cho Postgres/SQLite và `ALTER TABLE ?? DROP INDEX
??` cho MySQL).

**Rationale**: một chỗ sửa, đúng lớp của bản port; migration DR và `/fields` giữ nguyên câu SQL.

**Alternatives**: helper mới `createCompositeIndex` (lặp logic concurrent của 6 dialect); Knex `table.index([a, b], name)`
(không có `CONCURRENTLY`/`INPLACE`, không GIN).

**Kết quả T001** (2026-11-03, Postgres 13.16, MySQL 8.4.13, SQLite 3 qua Knex 3.1): `knex.schema.alterTable(t, b =>
b.dropIndex([], name))` gỡ được index đặt tên trên cả ba vendor (SQL: Postgres/SQLite `drop index "x"`, MySQL `alter
table t drop index x`); ba câu catalog của R5 trả đúng tên (Postgres qua `pg_index` ⋈ `pg_class` ⋈ `pg_namespace` với
`current_schema()`, có `indisvalid`; MySQL `information_schema.statistics`; SQLite `PRAGMA index_list`); SQLite lỗi
unique ghép: `SQLITE_CONSTRAINT: UNIQUE constraint failed: t.a, t.b`.

## R2. Trigram: index phải đặt trên `lower(col)` và `pg_trgm` cài được bởi chủ DB

[Verified 2026-11-03, Postgres 13.16, user `app` là owner của DB, không superuser]:

- `CREATE EXTENSION IF NOT EXISTS pg_trgm` thành công; `pg_trgm.control` có `trusted = true` (Postgres ≥ 13).
- Câu tìm kiếm của bản port là `LOWER(??) LIKE ?` với `%x%` (`run-ast/lib/apply-query/search.ts:80`, chỉ field
  `text`/`string`, bỏ `searchable: false` và `conceal`). Index `gin (lower(name) gin_trgm_ops)` cho `Bitmap Index Scan`
  với `'%abc%'` (3 ký tự) trên bảng 20.000 dòng; `'%ab%'` (2 ký tự) quét bảng → Assumptions của spec đúng.
- Không cần `enable_seqscan off` để thấy plan dùng index ở 20.000 dòng; parity EXPLAIN trên fixture ≥ 10.000 dòng.

**Decision**: SQL như R1; trước khi tạo index trigram đầu tiên chạy `CREATE EXTENSION IF NOT EXISTS pg_trgm` trong job;
lỗi quyền (`42501`) → dòng `failed` với `error` "pg_trgm is not installed; ask a DBA to run: CREATE EXTENSION pg_trgm"
(FR-011, spec nói 400 "không tạo gì": vì job nền, lỗi này hiện ở dòng `failed`; xem "Sửa câu chữ spec"). `meta.trigram`
= `getDatabaseClient(knex) === 'postgres'` (CockroachDB không có `pg_trgm`).

## R3. Hành vi vendor khi xóa cột nằm trong index ghép: phải gỡ index trước trên mọi vendor

[Verified]:

- Postgres: `ALTER TABLE t DROP COLUMN provider` xóa luôn index `(provider, provider_subject)`.
- MySQL 8.4: giữ lại index **unique** trên cột còn lại (`SHOW INDEX`: `t_provider_provider_subject_unique` trên
  `provider_subject`) → ràng buộc mới sai nghĩa, dữ liệu hợp lệ bị từ chối.
- SQLite qua Knex 3.1 (`lib/dialects/sqlite3/schema/ddl.js:128-183`): dựng lại bảng, giữ mỗi index với các cột còn lại
  (`parsedIndex.columns.filter(...)`, chỉ bỏ index khi hết cột) → giống MySQL.
- Lỗi vendor khác: MySQL `TEXT` không prefix → `1170 BLOB/TEXT column 'name' used in key specification without a key
  length`; Postgres `json` không có opclass btree (tài liệu); đều chặn trước ở FR-001a, không tới DB.

**Decision**: `FieldsService.deleteField` gọi `BackofficeIndexesService.dropForField(collection, field)` **trước**
`transaction(...)` (sau `preColumnChange` `:703` và filter `fields.delete` `:707-720`): mỗi dòng có field đó → `dropIndex`
(bỏ qua lỗi "không tồn tại") rồi xóa dòng (activity delete, FR-016a); dòng `creating` chưa quá hạn → `409`. `schema/apply`
xóa field qua cùng `deleteField` nên được luôn. `CollectionsService.deleteOne` xóa dòng trong transaction cạnh
`backoffice_permissions` (`collections.service.ts:712-716`), index mất cùng bảng.

## R4. Job nền trong process, trạng thái trong DB, không hàng đợi

**Hiện trạng** [Verified]: không có registry job nền; `onServerShutdown` (`shutdown.ts:12`) chạy **sau**
`database.destroy()` (`server.ts:120-129`), mỗi task tối đa `SHUTDOWN_TASK_TIMEOUT = 1000` ms; terminus `timeout` =
`SERVER_SHUTDOWN_TIMEOUT` (1000). Lock Redis `usingLock` giữ `lockTimeout` 5 s với redlock `using` tự gia hạn
(`libs/memory/src/kv/lib/redis.ts:69-74,153-155`); kho `local` không loại trừ gì (`local.ts:83-85`).

**Decision**:

1. `POST` kiểm payload (R6), kiểm trùng, **insert dòng `creating`** qua ItemsService (activity create), trả `202 { data }`,
   rồi `void runIndexJob(row)`; job: (trigram) `CREATE EXTENSION`, `createIndex` với `attemptConcurrentIndex` theo query,
   `updateOne(status: 'ready')`; lỗi → Postgres `dropIndex` dọn INVALID, `updateOne(status: 'failed', error)`. Job dùng
   `accountability` của admin gọi (activity update ghi user đó, clarify Q2) và `knex` của request (một kết nối pool trong
   suốt job; `DB_POOL__MAX` mặc định của Knex 10 → ghi rủi ro ở plan).
2. Trùng và đua giữa replica: **unique trên `backoffice_indexes.name`** (data-model) thay cho khóa Redis: hai POST cùng
   index → insert thứ hai vi phạm unique → 400 trùng, không cần Redis, đúng cả khi không Redis (FR-010 sửa câu chữ:
   "khóa dùng chung" → "ràng buộc duy nhất"). Tên trùng với index có sẵn trên DB không có dòng → kiểm catalog (R5) trước
   insert → 400 "tên đã có".
3. SIGTERM: `server.ts` `onSignal` gọi `failRunningIndexJobs()` (module `services/backoffice-indexes/jobs.ts`, `Set` các
   job đang chạy) **trước** `database.destroy()`: mỗi job đang chạy được `UPDATE ... status = 'failed', error = 'Server
   shutdown'` (nhanh, không chờ DDL); DDL bị hủy khi pool đóng (Postgres để lại index INVALID, xóa dòng sẽ dọn). Replica
   crash (không SIGTERM) → dòng ở `creating`; GET coi là `failed` khi `date_created` quá 1 giờ và catalog không có index
   hợp lệ (FR-009). Assumptions của spec "SIGTERM chờ job tới SHUTDOWN_TASK_TIMEOUT" sửa thành "đánh dấu failed ngay".
4. Không `schemaChanged`, không xóa response cache: SchemaOverview không chứa index, `/fields` không đổi (D-210.1).

**Alternatives**: khóa Redis suốt job (không loại trừ khi không Redis, redlock gia hạn mỗi 5 s trong nhiều phút); hàng
đợi Redis + worker (ngoài phạm vi, Nguyên tắc VII không đòi); chờ job khi SIGTERM (pool đóng sau 1 s, không giữ được).

## R5. Liệt kê và đối chiếu catalog theo vendor

**Decision** (`services/backoffice-indexes/catalog.ts`, một hàm `listIndexNames(knex, table): Promise<Map<name,
{ valid: boolean }>>`):

| Vendor | Câu | Ghi chú |
|--------|-----|---------|
| postgres, cockroachdb | `SELECT i.indexname, x.indisvalid FROM pg_indexes i JOIN pg_class c ON c.relname = i.indexname JOIN pg_index x ON x.indexrelid = c.oid WHERE i.tablename = ?` ([Verified] dạng join qua `regclass` chạy; T001 chốt join qua `pg_class`+`pg_namespace` với `current_schema()`) | `indisvalid = false` = INVALID |
| mysql, mariadb | `SELECT DISTINCT index_name FROM information_schema.statistics WHERE table_schema = database() AND table_name = ?` [Verified] | luôn valid |
| sqlite | `PRAGMA index_list(??)` | luôn valid |
| mssql, oracle | không kiểm: `missing: null` | ngoài phạm vi đo (Assumptions) |

`GET` trả mỗi dòng với `missing` = `status === 'ready' && !catalog.has(name)`; `failed_stale` = `status === 'creating' &&
age > 1h && !(catalog.get(name)?.valid) && !building(name)` → trả `status: 'failed'`, `error: 'Index build stopped
(replica shut down)'` (tính lúc đọc, không ghi). `building(name)` (analyze U1): Postgres `SELECT 1 FROM
pg_stat_progress_create_index p JOIN pg_class c ON c.oid = p.index_relid WHERE c.relname = ?` (PG ≥ 12; một index đang
build `CONCURRENTLY` đã có dòng `pg_index` với `indisvalid = false`, nên không có bước này một build dài hơn 1 giờ bị coi
là `failed` và DELETE sẽ gỡ nó); vendor khác `false`.

## R6. Kiểm payload và kiểu field

**Decision** (`BackofficeIndexesService.validate(collection, body)`):

- `collection` phải có trong `schema.collections`, `isSystemCollection(collection) === false` (`@backoffice/system-data`)
  → 403 `ForbiddenError` cho `directus_*`/`backoffice_*` (như `CollectionsService.deleteOne:629`).
- `fields`: mảng 1–8 chuỗi, không trùng, mỗi field có trong `schema.collections[c].fields` với `alias === false`; kiểu theo
  FR-001a (`field.type` ∈ string, integer, bigInteger, float, decimal, boolean, uuid, date, time, dateTime, timestamp,
  hash; `text` chỉ khi client ∉ {mysql, mariadb}); khóa chính một mình → 400.
- `type` ∈ {btree, trigram}; trigram: đúng 1 field kiểu `string`/`text`, `unique` phải false, client = postgres.
- Trùng: cùng `collection`, `fields` (JSON so sánh theo thứ tự), `type`, `unique` với một dòng bất kỳ (kể cả `failed`)
  → 400 "Index already exists"; tên sinh ra có trong catalog hoặc vi phạm unique `name` → 400 "Index name already in use".
- Joi schema như `newFieldSchema` của `fields.controller.ts`, lỗi → `InvalidPayloadError` (mã có sẵn, không mã mới).

## R7. Lỗi trùng unique ghép: từng field

[Verified] Postgres `detail`: `Key (provider, provider_subject)=(p1, s1) already exists.`; MySQL: `Duplicate entry
'p1-s1' for key 't.t_provider_provider_subject_unique'` (chỉ tên index); SQLite [Inference] `UNIQUE constraint failed:
t.a, t.b`. Extractor hiện tại: Postgres lấy nhóm ngoặc đầu làm một `field` (`errors/dialects/postgres.ts:37-53`); MySQL
suy `field` từ `<collection>_<field>_unique` (`mysql.ts:43-86`); SQLite tách `table.field` của từ cuối (`sqlite.ts:20-31`).
`error-handler.ts:28` đã nhận mảng lỗi; `translateDatabaseError(error, data)` (`errors/translate.ts:21`) được gọi ở
`items.service.ts:270,821` và `fields.service.ts`.

**Decision**: `translateDatabaseError(error, data, knex?)` trả `DirectusError | DirectusError[]`:

- Postgres: tách nhóm ngoặc đầu bằng `', '` → nếu > 1 field: mảng `RecordNotUniqueError({ collection, field, value:
  data[field] })` mỗi field; 1 field như cũ.
- SQLite: tách `', '` tương tự (FR-016 gồm SQLite, analyze I1).
- MySQL: khi tên index không khớp mẫu `<collection>_<field>_unique` với một cột có thật, tra `backoffice_indexes` theo
  `name` (cần `knex`; `hasTable` một lần, cache module) → `fields` → mảng lỗi; không tra được → như cũ (D-210.4 ghi
  giới hạn).
- `items.service.ts:270-280` xử lý `primaryKey` trên từng phần tử của mảng rồi `throw` mảng; `:821` throw thẳng.
- GraphQL [Verified khi implement]: `services/graphql/errors/format.ts` (port nguyên văn) gộp một mảng lỗi thành mục đầu
  cho mọi resolver, kể cả FAILED_VALIDATION; giữ nguyên để không thêm khác biệt với Directus: GraphQL trả field thứ
  nhất. `ImportService.createErrorTracker().addCapturedError` nhận mảng và đếm từng phần tử (`/utils/import` đủ field).

## R8. Web: card độc lập sau BoForm, không chèn giữa các card

[Verified] Card D-182 là một card của `BoForm card` qua divider giả `bo_content_toggles_divider` (`FieldsRoute.vue:101-132`),
đứng **trước** card Duplication; `BoForm` không có slot (`components/form/BoForm.vue`). Card độc lập mẫu:
`modules/users/components/UserPasskeys.vue:189-266` (wrapper `rounded-2xl border ...`, header với BoIcon + h3 + nút
`size="sm" icon="add"`, body `border-t ... p-4 sm:p-6` với `BoTable`, `data-testid`).

**Decision**: `modules/settings/routes/data-model/components/CollectionIndexes.vue` đặt **sau** `<BoForm>` trong
`FieldsRoute.vue:191` (cuối trang, sau Duplication), `data-testid="collection-indexes"`, chỉ khi `!isSystem`; FR-018 sửa
câu chữ "ngay sau card Content: Search, Import, Export" → "sau các card cài đặt của collection (card cuối trang)"; ghi ở
"Cần xác nhận" cho design owner. Thành phần: `BoTable` (cột name, fields, type, unique, status), `#item-append` nút xóa
(`BoButton variant="ghost" square icon="delete"`), `#empty`; nút "Add index" mở `BoDialog` với: `BoSelect` "Add field"
(items = cột thật chưa chọn, `showDeselect` false, chọn là thêm vào danh sách và reset), `BoSortableList` (`item-key`
= field, `rowActions` = Remove như `SystemFields.vue:110-120`), `BoSelect` type (btree; trigram khi `meta.trigram`),
`BoSwitch` unique (tắt + disabled khi trigram), `BoSwitch` "Create without locking the table" (hiện khi
`meta.concurrent`, bật sẵn). Xóa: `BoDialog` xác nhận `variant="danger"` (như xóa collection `FieldsRoute.vue:193-198`).

Dữ liệu: composable `use-collection-indexes.ts` (`list(collection)`, `create`, `remove`, `meta`, `available` = GET không
404/403; `sdk.request(requestEndpoint(...))` như `use-passkeys.ts:44,91`; lỗi inline bằng `translateAPIError`); poll:
`setInterval` 5 s khi có dòng `creating`, `onUnmounted` clear (không dùng `useAutoRefresh`: nó bật chấm D-199 của detail
panel). Toast `notify({ title })` (`use-notices.ts:55`) khi 202, `ready`, `failed`.

Hộp thoại xóa field (`FieldsManagement.vue:397-402`, BoDialog có slot mặc định chưa dùng): thêm `<p>` "These indexes
will be dropped: a, b" từ cùng composable (`indexesOf(field)`), chỉ khi `available` và danh sách khác rỗng (FR-019a).

Chuỗi overlay (`lang/overlay/{en-US,vi-VN}.ts`, khối "Spec 030 (D-210.4)"): `indexes`, `indexes_description`,
`add_index`, `index_fields_add`, `index_type`, `index_type_btree`, `index_type_trigram`, `index_unique_label`,
`index_concurrent`, `index_status_creating`, `index_status_ready`, `index_status_failed`, `index_missing`,
`index_delete_confirm`, `index_created_notice`, `index_ready_notice`, `index_failed_notice`, `indexes_dropped_with_field`,
`indexes_empty`; không dùng key DR có sẵn (`index`, `unique`, `remove`, `add_field`, `status`, `type` được dùng thẳng từ
DR). `KNOWN_REQUESTS` thêm id 229–231 (`GET/POST /backoffice/collections/ID/indexes`, `DELETE .../indexes/ID`),
`allowed-paths.ts` đồng bộ.

## R9. Route và service API

**Decision**: `controllers/backoffice-indexes.controller.ts` `@Controller('backoffice/collections')` (controller
`backoffice` đã thuộc passkeys, `backoffice/permissions` thuộc 025): `GET :collection/indexes`, `POST :collection/indexes`
(`@HttpCode(202)`), `DELETE :collection/indexes/:name`; guard `admin(req)` chép từ `backoffice-passkeys.controller.ts:58-62`
(401/403), `res.locals['cache'] = false` (`:64-67`); `useCollection('backoffice_indexes')` trong `app.module.ts` như
`:108`; provider factory như `providers.ts:201-213`. `services/backoffice-indexes.service.ts` `extends ItemsService`
trên `backoffice_indexes` với `accountability: { ...caller, admin: true }` và `withCasts` (cast-json cho `fields`) như
`backoffice-permissions.service.ts:25-39,106-119`; mọi method public kiểm `caller.admin` trước (403). GraphQL:
`SYSTEM_DENY_LIST` thêm `backoffice_indexes` (`services/graphql/schema/index.ts:42-55`). DELETE: dòng `creating` chưa quá
hạn → `409` (mã có sẵn? Không có `CONFLICT` trong `@backoffice/errors`: dùng `InvalidPayloadError` 400 "Index is still
being created" — spec nói 409; ghi "Sửa câu chữ spec": 400 `INVALID_PAYLOAD`, không mã lỗi mới).

## R10. Migration riêng `20261103A` và các danh sách phải cập nhật

**Decision**: `database/backoffice-migrations/20261103A-create-backoffice-indexes.ts` theo mẫu `20261101A`
(`hasTable` → `createTable` trong try/catch → `hasTable`); `BACKOFFICE_MIGRATIONS` thêm; cập nhật các danh sách cứng
[Verified]: `20261101A-create-backoffice-passkeys.test.ts:33`, `database/validate-migrations.test.ts:265-273`,
`tests/parity/src/deploy/backoffice-migrations.test.ts:30-34`, `tests/parity/src/bootstrap/cross.test.ts:252-256`
(`BO_VERSIONS`); `libs/system-data/src/collections/collections.yaml` thêm `backoffice_indexes` `hidden: true` + test
`index.test.ts:43-70`; `tests/parity/src/normalizers.ts:117` `BACKOFFICE_TABLE` và SDL regex `:284,:287` thêm `indexes`
+ `normalizers.test.ts`.

## R11. Parity và bộ đối chiếu

**Decision**: `tests/parity/src/schema/indexes.test.ts` (đã nằm trong glob `FULL_FILES` `src/{...,schema,...}/**`,
`suite.ts:52`; thêm vào `REDUCED_FILES`): fixture collection `parity_idx_<vendor>` tạo qua `/collections` ở Backoffice;
D-210 kind `doc` (route chỉ Backoffice, test từng app bằng `appRequest` như D-189.6, D-207); POST → 202, poll GET tới
`ready` (≤ 60 s); `GET /fields/<c>` hai app giống nhau (D-210.1 `doc`); ghi trùng ở hai app: Directus 400 với một
mục `field: "a, b"` (Postgres) / tên index (MySQL), Backoffice 400 với hai mục → D-210.4 `http` (`endpoints: ['POST
/items/parity_idx_*']`, `location: { jsonPointer: /\/errors\/\d+\/extensions\/field$/ }`); xóa field → index mất
(D-210.3 `doc`); trigram chỉ `TEST_DB=postgres` (`getDbsToTest`, `src/get-dbs-to-test.ts:17`) với `EXPLAIN` qua
`knexConfig`; `accepted-differences.ts` thêm 5 entry. Deploy: `tests/parity/src/deploy/indexes.test.ts`: POST ở
`replicaUrl(1)` → 202, GET ở `replicaUrl(2)` thấy `creating` rồi `ready`; trong lúc `creating` ghi 20 item qua
`boLbUrl` mỗi cái < 2 s (SC-004) trên bảng 200.000 dòng tạo bằng `generate_series` (Postgres); SIGTERM ở replica đang
chạy job → dòng `failed` "Server shutdown" (dùng `compose`/`containerIp` của `shutdown.test.ts`).

## R12. Benchmark `?search=`

**Decision**: `tests/benchmark/src/items.ts` thêm case `SEARCH_LIST` (`?search=<3 ký tự có trong seed>&limit=25`) đo
Backoffice-only trước/sau `CREATE INDEX ... USING gin (lower(title) gin_trgm_ops)` bằng raw SQL như case json path
(`:153-189`, `CREATE INDEX` `:174-177`, EXPLAIN), bảng kết quả thêm hai dòng; số đo vào spec (FR-024), không ngưỡng.

## R13. E2E

**Decision**: `apps/web-e2e/src/settings-data-model-indexes.spec.ts`, serial, collection `${P}_idx` tạo qua
`AdminApi` (`content-collection-toggles.spec.ts:37-104`), `proxy-directus`: `card(page)` (`getByTestId('collection-indexes')`)
`toHaveCount(0)` rồi return (mẫu `users-passkey.spec.ts:63-68`); `proxy-api`/`cors`: thêm index unique hai field qua
dialog (BoSelect → BoSortableList → switch unique → Create), chờ trạng thái `ready` (poll của card), POST hai item trùng
qua `api.call` → lỗi 400 (kiểm `errors.length === 2`), xóa index qua dialog, xóa field có index thấy dòng cảnh báo trong
hộp thoại xóa field; axe include `[data-testid="collection-indexes"], [role="dialog"]`; `ALLOWED_CALLS` 229–231.

## R14. Hai lượt

Lượt 1 API: migration + danh sách, collection hệ thống, helper R1 + `dropIndex`, catalog R5, service + controller R9, job
+ shutdown R4, cascade R3, extractor R7, unit, parity R11 (ba vendor), deploy test, deploy/README. Lượt 2 web: composable,
card, dialog, hộp thoại xóa field, overlay, KNOWN_REQUESTS/allowed-paths, unit + browser test, E2E R13, benchmark R12,
spec notes "(030: ...)" ở 006 và 016, đóng spec.
