# Feature Specification: Quản lý data model (`/collections`, `/fields`, `/relations`, `/schema`)

**Feature Branch**: `006-schema-management`
**Created**: 2026-10-12
**Status**: Done
**Duyệt khác biệt**: tech lead đã duyệt gỡ D-09.4, khác biệt D-32, rủi ro R-11, R-12 và constitution 1.4.0 (Nguyên tắc
II: cột người dùng và index trên collection hệ thống) ngày 2026-10-12 (Nguyên tắc X; quy trình không có PR)
**Input**: User description: "Admin tạo, sửa, xóa collection, field và relation qua /collections, /fields, /relations giống hệt Directus. App mới tạo và sửa bảng, cột thật trong DB (đúng kiểu dữ liệu từng loại DB), đồng thời ghi metadata vào directus_collections, directus_fields, directus_relations, giống cách Directus làm. Hỗ trợ collection folder, alias field (o2m, m2m, m2a, presentation, group), field geometry, translations, archive và sort field. Hỗ trợ /schema/snapshot, /schema/diff, /schema/apply cùng format với Directus. Sau mỗi thay đổi, cache schema được xóa trên cả hai app. Tham chiếu directus/api/src/services/collections.ts, fields.ts, relations.ts, schema.ts, database/helpers. Tiêu chí chấp nhận: data model tạo ở app mới mở được và dùng bình thường trên Directus, và ngược lại."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/api/src` trừ khi ghi khác):

- Route: `controllers/collections.ts`, `fields.ts`, `relations.ts`, `schema.ts` (`schemaMultipartHandler`: JSON hoặc
  multipart một file JSON/YAML); `middleware/collection-exists.ts`, `validate-batch.ts`, `respond.ts` (`204` khi không
  có payload, `export` cho `/schema/snapshot`); thứ tự mount trong `app.ts`.
- Service: `services/collections.ts` (`createOne`, `createMany`, `readByQuery`, `readOne`, `readMany`, `updateOne`,
  `updateBatch`, `updateMany`, `deleteOne`, `deleteMany`), `services/fields.ts` (`readAll`, `readOne`, `createField`,
  `addColumnToTable`, `addColumnIndex`, `updateField`, `updateFields`, `deleteField`),
  `services/fields/get-collection-meta-updates.ts`, `services/relations.ts` (`readAll`, `readOne`, `createOne`,
  `updateOne`, `deleteOne`, `alterType`, `filterForbidden`), `services/schema.ts`.
- Snapshot, diff, apply: `utils/get-snapshot.ts`, `get-snapshot-diff.ts`, `apply-diff.ts`, `apply-snapshot.ts`,
  `validate-snapshot.ts`, `validate-diff.ts`, `sanitize-schema.ts`, `get-versioned-hash.ts`;
  `directus/packages/types/src/snapshot.ts`.
- DDL theo DB: `database/helpers/schema/` (`types.ts` và dialect `cockroachdb`, `default`, `mssql`, `mysql`, `oracle`,
  `postgres`, `sqlite`), `database/helpers/geometry/` (`createColumn`), `sequence/`, `number/`;
  `utils/get-default-index-name.ts`; hằng `KNEX_TYPES`, `ALIAS_TYPES`, `DEFAULT_NUMERIC_PRECISION`,
  `DEFAULT_NUMERIC_SCALE`, `ALLOWED_DB_DEFAULT_FUNCTIONS` (`constants.ts`, `directus/packages/constants`).
- Cache: `cache.ts` (`clearSystemCache`, `flushCaches`, bus `schemaChanged`), `utils/should-clear-cache.ts`.
- Collection, field, relation hệ thống: `directus/packages/system-data` (`systemCollectionRows`, `systemFieldRows`,
  `systemRelationRows`).

**Đã có từ feature 001 đến 005** (trong `apps/api/src`): dialect helper `database/helpers` (gồm `schema`, `geometry`,
`sequence`, `number`, `date`, `fn`, `capabilities`); SchemaOverview cache trong process, lock và bus `schemaChanged`
dùng chung với Directus, thao tác xóa cache hệ thống gọi từ code (FR-017, FR-020 của 002); permissions cache và xóa
cache dữ liệu (004, 005); engine đọc ghi `ItemsService`, `PayloadService`, `MetaService`; `/items` với response cache
và `export` (`json`, `csv`, `csv_utf8`, `xml`, `yaml`); `Emitter` thật; `validateBatch`; `useCollection`;
`DIRECTUS_COMPAT_VERSION = '11.17.4'`; Playwright E2E app Directus qua nginx reverse proxy (004). Chưa có:
`CollectionsService`, `FieldsService`, `RelationsService`, `SchemaService`, các route `/collections`, `/fields`,
`/relations`, `/schema` (D-09.4).

**Bộ test blackbox liên quan** (`directus/tests/blackbox/tests/db`, số khối `it`/`it.each` mỗi file, mỗi khối chạy
theo vendor và có thể lồng theo kiểu khóa chính, user): `routes/collections/crud.test.ts` (11),
`routes/collections/schema-cache.test.ts` (2), `routes/fields/crud.test.ts` (9), `routes/fields/change-fields.test.ts`
(15), `routes/schema/schema.test.ts` (22), `schema/timezone/timezone.test.ts` (3),
`timezone-changed-node-tz-asia.test.ts` (3), `timezone-changed-node-tz-america.test.ts` (3); seed
`routes/fields/{crud,change-fields}.seed.ts`, `routes/schema/schema.seed.ts`. Không có thư mục `routes/relations`.
Hoãn từ 004: phần `createCollection()`, `createField()`, `createFieldM2O()`, `createFieldO2M()`, `deleteField()`,
`deleteCollection()` của `common.test.ts`. Hoãn từ 005: `schema/timezone/*.test.ts`. `routes/collections/files.test.ts`
thuộc `/files` (007).

## Clarifications

### Session 2026-10-12

- Q: Directus cho thêm field người dùng vào collection hệ thống và tạo, xóa index trên cột hệ thống; cả hai là DDL trên
  bảng `directus_*`, trong khi Nguyên tắc II cấm tạo, sửa, xóa bảng hay cột hệ thống. App mới làm như Directus hay từ
  chối? → A: Làm như Directus. Nguyên tắc II hiểu là cấm đổi bảng, cột gốc của Directus và migration hệ thống; cột do
  người dùng thêm qua API và index trên cột hệ thống (`schema.is_indexed`) được phép. Không thêm khác biệt; constitution
  1.4.0 ban hành 2026-10-12 ghi cách hiểu này (FR-024). Riêng xóa bảng hệ thống vẫn cấm: D-32.
- Q (clarify): Hai app dùng chung một DB nên không cùng tạo một tên bảng được; so DDL thế nào? → A: Chạy nối tiếp trên
  cùng DB với cùng tên: Directus tạo, bộ test chụp cấu trúc và metadata, xóa; app mới tạo lại, chụp, so. Ca DDL trong
  một file chạy tuần tự (FR-060).
- Q (clarify): Có benchmark các route đọc data model (app Directus gọi khi nạp) không? → A: Có: `GET /collections`,
  `/fields`, `/relations`, `GET /schema/snapshot`, `POST /schema/diff`, với admin và user có quyền một phần, trên data
  model cỡ lớn; ngưỡng 10% của Nguyên tắc X; workflow benchmark hằng tuần, không chặn CI (FR-065, SC-007).
- Q (clarify): Seed của bộ blackbox 004, 005 dùng API của app nào? → A: Thêm cờ chọn app tạo seed; mỗi lần push vẫn seed
  bằng Directus; workflow đủ bộ hằng tuần chạy thêm một lượt seed bằng app mới (FR-064).
- Q (clarify): Lệnh CLI `directus schema snapshot`, `schema apply` có trong phạm vi không? → A: Ngoài phạm vi. App mới
  không có CLI schema; pipeline dùng CLI của Directus trên cùng DB hoặc route `/schema/*` (Assumptions).

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là quản trị viên dựng data model (qua app Directus, `@directus/sdk`, script), đội phát triển
chuyển data model giữa các môi trường bằng snapshot, diff, apply, và mọi client đang đọc ghi dữ liệu trên cả hai app.

### User Story 1 - Tạo, sửa, xóa collection và field thường, có bảng và cột thật (Priority: P1)

Admin tạo collection (có hoặc không kèm field, khóa chính tự tăng, số nguyên lớn, uuid hoặc chuỗi tự nhập), collection
folder (chỉ metadata), thêm, sửa, xóa field mọi kiểu dữ liệu (chuỗi, văn bản, số nguyên, số lớn, số thực, decimal,
boolean, ngày, giờ, datetime, timestamp, json, csv, hash, uuid, binary, geometry các kiểu con; `unknown` và cột
`is_generated` chỉ đọc), với giá trị mặc định, nullable,
unique, index, độ dài, precision, scale. App mới tạo và sửa bảng, cột thật trong DB với đúng kiểu cột Directus sinh
ra trên từng loại DB, và ghi `directus_collections`, `directus_fields` như Directus.

**Why this priority**: Đây là nền của mọi data model; không có nó thì không dựng được quan hệ, snapshot hay dữ liệu
người dùng nào trên app mới (D-09.4).

**Independent Test**: Gửi cùng chuỗi request tạo, sửa, xóa tới Directus rồi tới app mới, nối tiếp trên cùng DB với
cùng tên (FR-060); so status, body, header, cấu trúc bảng (kiểu cột, nullable, default, khóa chính, unique, index, tên index) và các dòng metadata.

**Acceptance Scenarios**:

1. **Given** DB chưa có `articles`, **When** admin `POST /collections` với `{collection: "articles", schema: {}, meta: {...}}`
   không kèm field, **Then** bảng `articles` có cột `id` tự tăng là khóa chính; `directus_fields` có dòng `id` (`hidden`,
   `interface: numeric`, `readonly`); response và các dòng giống Directus.
2. **Given** payload có `fields` với mọi kiểu dữ liệu và các tùy chọn `schema.*`, **When** tạo ở mỗi app trên cùng
   vendor, **Then** kiểu cột, độ dài, precision, scale, default (kể cả `now()`, `CURRENT_TIMESTAMP`, `gen_random_uuid()`),
   nullable, unique, index và tên index trong DB giống Directus; `sort` của field theo thứ tự và theo `group` như Directus.
3. **Given** `POST /collections` với `schema: null` và `meta`, **When** tạo, **Then** chỉ có dòng `directus_collections`
   (folder), không có bảng; collection khác đặt `meta.group` vào folder đó được.
4. **Given** field `title` có sẵn, **When** `PATCH /fields/articles/title` đổi kiểu, độ dài, nullable, default, unique
   hoặc index, **Then** cột được sửa như Directus: số dòng và giá trị từng cột sau alter bằng nhau ở hai app (kể cả
   SQLite tạo lại bảng); khi dữ liệu không đổi kiểu được, lỗi có cùng status và mã như Directus (FR-022);
   `PATCH /collections/articles` chỉ sửa metadata.
5. **Given** collection có dữ liệu, quan hệ, quyền, preset, activity, revision, **When** `DELETE /collections/articles`,
   **Then** trả `204`; bảng bị xóa; metadata, quan hệ, field quan hệ ở collection khác, dòng `directus_presets`,
   `directus_revisions`, `directus_activity`, `directus_permissions` của collection và `item_duplication_fields`,
   `one_allowed_collections` liên quan được dọn đúng như Directus; collection con của folder bị đưa về `group = null`.
6. **Given** tên collection bắt đầu bằng `directus_`, chứa `/`, trùng tên có sẵn, field trùng, khóa chính nullable, đổi
   kiểu sang hoặc từ `alias`, **When** gửi, **Then** cùng lỗi, status, message như Directus.
7. **Given** user không phải admin, **When** gọi bất kỳ thao tác ghi nào, **Then** `403 FORBIDDEN` như Directus; khi đọc,
   chỉ thấy collection, field, relation mình có quyền đọc (cùng tập và thứ tự như Directus).
8. **Given** `?concurrentIndexCreation`, **When** tạo collection hoặc field có index, **Then** index được tạo sau
   transaction theo cách của Directus trên từng vendor.

---

### User Story 2 - Quan hệ và alias field (Priority: P1)

Admin tạo m2o, o2m, m2m, m2a, translations (o2m tới collection junction có m2o tới `languages`), field alias kiểu
presentation (divider, notice, button...) và group (detail, raw, accordion...), qua `/fields` và `/relations` như app
Directus gửi. App mới tạo khóa ngoại thật với `on_delete`, `on_update` như Directus, ghi `directus_relations` đầy đủ
(`one_field`, `junction_field`, `sort_field`, `one_collection_field`, `one_allowed_collections`,
`one_deselect_action`), và dọn đúng khi xóa.

**Why this priority**: Data model thực tế hầu như luôn có quan hệ; bộ blackbox items (005) cũng cần quan hệ để seed.

**Independent Test**: Dựng cùng mô hình có đủ năm loại quan hệ và alias trên hai app; so `GET /relations`, `GET
/fields`, khóa ngoại trong DB; ghi item lồng qua `/items` ở app kia.

**Acceptance Scenarios**:

1. **Given** `articles` và `authors`, **When** tạo field `author` (uuid hoặc integer) rồi `POST /relations` với
   `related_collection: "authors"` và `schema.on_delete: "SET NULL"`, **Then** có khóa ngoại tên như Directus
   (`getDefaultIndexName`), kiểu cột được đổi khi Directus đổi (ví dụ unsigned trên MySQL), `directus_relations` có dòng
   giống Directus (tác động của `on_delete` lên dữ liệu khi xóa item là hành vi DB, kiểm qua `/items` ở 005; feature
   này chỉ so khóa ngoại tạo ra).
2. **Given** m2m qua junction `articles_tags`, **When** tạo như app Directus (hai field m2o ở junction, alias `m2m` ở
   `articles`, hai relation), **Then** `GET /relations/articles_tags` và `GET /fields/articles/tags` giống Directus; ghi
   lồng tạo đúng dòng junction ở cả hai app.
3. **Given** m2a (`one_allowed_collections`, `one_collection_field`), **When** tạo, **Then** không có khóa ngoại cho phía
   "any", metadata giống Directus; xóa một collection trong danh sách cho phép thì nó bị gỡ khỏi `one_allowed_collections`.
4. **Given** field translations tạo theo đúng chuỗi request của app Directus, **When** mở form item ở app Directus,
   **Then** interface translations hiển thị và lưu được bản dịch.
5. **Given** field alias `presentation` và `group` có field con (`meta.group`), **When** tạo, **Then** không có cột trong
   DB, `schema` là `null` khi đọc; xóa group thì field con về `group = null`.
6. **Given** relation có sẵn, **When** `PATCH /relations/:collection/:field` đổi `on_delete`, **Then** khóa ngoại được tạo
   lại với tên đúng theo vendor (CockroachDB khác); **When** `DELETE`, **Then** khóa ngoại bị xóa và trả `204`.
7. **Given** field m2o là một đầu của quan hệ o2m, **When** xóa field m2o, **Then** relation và field o2m ở collection kia
   bị xóa; **When** xóa field o2m, **Then** relation còn, `one_field = null`, như Directus.

---

### User Story 3 - Data model dùng chéo giữa hai app (Priority: P1)

Data model tạo ở app mới mở được và dùng bình thường trên Directus (module Data Model, module Content, `/items`), và
ngược lại. Mỗi thay đổi ở app này làm app kia thấy ngay ở request kế tiếp, không cần khởi động lại.

**Why this priority**: Đây là tiêu chí chấp nhận của feature và là điều kiện chạy song song (Nguyên tắc II, IV).

**Independent Test**: Dựng mô hình đầy đủ ở app mới, gọi `GET /schema/snapshot` ở cả hai app (phải trùng), rồi chạy CRUD
item và E2E app Directus trên Directus; làm lại theo chiều ngược.

**Acceptance Scenarios**:

1. **Given** mô hình dựng ở app mới, **When** gọi `GET /schema/snapshot` ở Directus và ở app mới với
   `Cache-Control: no-store` (route này được response cache dùng chung; không bỏ cache thì app B có thể trả bản `HIT`
   của app A và phép so vô nghĩa), **Then** hai snapshot giống hệt; `POST /schema/diff` của snapshot đó ở app kia trả
   `204`.
2. **Given** mô hình dựng ở app mới, **When** client gọi `/items` của Directus (tạo, đọc lồng, sửa, xóa mọi loại quan hệ),
   **Then** thành công như khi mô hình được dựng ở Directus; và ngược lại.
3. **Given** app Directus mở qua reverse proxy, **When** quản trị viên xem collection, field, relation, folder,
   translations, archive và sort field ở module Data Model và Content, **Then** mọi màn hình hiển thị và thao tác được
   như khi Directus tự dựng.
4. **Given** cả hai app đã nạp schema vào bộ nhớ, **When** một app tạo, sửa hoặc xóa collection, field, relation, hoặc
   apply diff, **Then** request kế tiếp ở app kia (và mọi instance khác) thấy schema mới; permissions cache và, khi
   `CACHE_AUTO_PURGE=true`, response cache được xóa như Directus.
5. **Given** collection có `meta.archive_field`, `archive_value`, `unarchive_value`, `sort_field`, **When** xóa field được
   dùng làm archive hoặc sort, **Then** các key đó trong `directus_collections` về `null` như Directus; khi còn, app
   Directus lọc archive và kéo thả sắp xếp được.

---

### User Story 4 - Snapshot, diff, apply cùng format với Directus (Priority: P2)

Đội phát triển lấy snapshot ở môi trường này, tính diff và apply ở môi trường khác, với file JSON hoặc YAML, giữa hai
app bất kỳ.

**Why this priority**: Là cách chuyển data model giữa môi trường; cần sau khi CRUD (US1, US2) đã đúng.

**Independent Test**: Chạy port của `routes/schema/schema.test.ts` với cả hai app; lấy snapshot ở app này, diff và apply
ở app kia; so kết quả.

**Acceptance Scenarios**:

1. **Given** data model bất kỳ, **When** `GET /schema/snapshot` (và `?export=yaml`), **Then** body (`version`, `directus`
   là `11.17.4`, `vendor`, `collections`, `fields`, `systemFields`, `relations`, sắp xếp key, bỏ `meta.id`) giống từng byte
   với Directus.
2. **Given** snapshot gửi bằng JSON body hoặc multipart (một file JSON hoặc YAML), **When** `POST /schema/diff`, **Then**
   `{data: {hash, diff}}` giống Directus; không khác thì `204`; snapshot sai version, sai vendor (khi không `force`), body
   rỗng, nhiều file, file hỏng, content type khác trả cùng lỗi (`400`, `415`) như Directus.
3. **Given** diff và hash lấy từ một app, **When** `POST /schema/apply` ở app còn lại, **Then** trả `204` và schema đích
   giống khi Directus apply; hash lệch (không `force`) trả cùng lỗi chi tiết như Directus; lỗi giữa chừng rollback.
4. **Given** `systemFields` có `schema.is_indexed`, **When** apply, **Then** chỉ index của field hệ thống được đổi, mọi
   thay đổi khác trên field hệ thống bị từ chối như Directus.

---

### User Story 5 - Bộ blackbox data model của Directus chạy qua trên app mới (Priority: P2)

Các file test collections, fields, schema, timezone (danh sách ở đầu spec) và phần hoãn của `common.test.ts` được port
sang bộ đối chiếu và đạt với cả hai app.

**Why this priority**: Kiểm chứng DDL theo vendor trên diện rộng; seed của các bộ test khác (005) chuyển sang dùng được
API của app mới.

**Independent Test**: Chạy bộ port với `TEST_DB=postgres`, `mysql`, `sqlite3` (và vendor còn lại ở nightly); mọi ca đạt
ở cả hai app.

**Acceptance Scenarios**:

1. **Given** seed tạo qua API của app được kiểm, **When** chạy từng file test với URL của app mới, **Then** 100% ca đạt,
   cùng kết quả như khi chạy với URL của Directus.
2. **Given** `schema-cache.test.ts` (nhiều node, có và không bus), **When** một node là app mới, **Then** thay đổi lan tới
   node kia như giữa hai node Directus.
3. **Given** ca timezone đổi `TZ` của node, **When** chạy với app mới, **Then** giá trị ngày giờ đọc ghi giống Directus.
4. **Given** một ca đã fail trên chính Directus ở một vendor, **When** chạy bộ port, **Then** ca đó được bỏ qua theo vendor
   với ghi chú (Assumptions).

---

### Edge Cases

- `GET /collections` bỏ qua query (`readByQuery()` không nhận query) nhưng vẫn trả `meta` theo `directus_collections`;
  bảng trong DB chưa có metadata trả `meta: null`; `DB_EXCLUDE_TABLES` bị loại.
- `POST /collections` với mảng: một transaction, một lỗi rollback cả lô; cache xóa một lần sau cùng.
- `PATCH /fields/:collection` (mảng) gọi `updateField` tuần tự, **không** trong transaction: lỗi ở phần tử thứ n giữ
  thay đổi của các phần tử trước, như Directus.
- `PATCH` khiến lần đọc lại bị `Forbidden` trả `204` không body.
- Field hệ thống: `PATCH` chỉ nhận `schema.is_indexed` (message `Only "schema.is_indexed" may be modified for system
  fields`), `DELETE` trả `403`.
- MySQL với `lower_case_table_names=1`: tên collection bị chuyển chữ thường như Directus.
- Tên index dài hơn giới hạn vendor: rút gọn kèm hash như `getDefaultIndexName`; SQLite không giới hạn.
- SQLite: tắt rồi bật `foreign_keys` quanh thay đổi cột (`preColumnChange`, `postColumnChange`); thay đổi cột tạo lại
  bảng như Knex làm cho Directus.
- Oracle: `on_delete` của quan hệ tự tham chiếu bị bỏ (`preRelationChange`); xử lý kiểu field riêng (`processFieldType`).
- Hai app cùng đổi schema một lúc: Directus không khóa DDL; app mới cũng không thêm khóa (kết quả như hai instance
  Directus).
- DDL trên MySQL tự commit: lỗi giữa chừng có thể để lại bảng hoặc cột đã tạo, như Directus.
- Apply diff khi field hoặc relation thuộc collection đang bị xóa: phần đó bị bỏ khỏi diff như Directus; khóa chính và
  khóa ngoại `char(36)`/`varchar(36)` được đổi sang `uuid` như Directus.
- Diff đổi kiểu giữa alias và không alias: thành xóa rồi tạo mới.
- `/schema/apply?force=false` (`toBoolean`) khác `/schema/diff?force=false` (có key là bật), như Directus.
- Tên collection có khoảng trắng, chữ hoa, ký tự ngoài ASCII: Directus chỉ chặn rỗng, `directus_`, `/` (và chữ thường
  trên MySQL `lower_case_table_names`); bảng được tạo, `GET /collections/<tên>` đọc được, nhưng schema trong process bỏ
  qua bảng có khoảng trắng và bảng không khóa chính nên `/fields/<tên>`, `/items/<tên>` trả `403`. Làm như Directus.
- Tên collection, field dài hơn giới hạn vendor (64; MSSQL, Oracle 128): Directus không kiểm trước, lỗi DB trả về
  (FR-020 phần lỗi). Làm như Directus.
- Default `gen_random_uuid()` trên vendor không có hàm (MySQL, SQLite, MSSQL): lỗi DB (FR-020 phần lỗi); câu
  `ALTER TABLE` lỗi không để lại gì.
- `DB_EXCLUDE_TABLES`: bảng bị loại không có trong `/collections`, schema trong process (nên không có trong `/fields`,
  `/relations`, `/items`, snapshot); apply diff tạo collection trùng tên bảng bị loại gặp lỗi DB "đã tồn tại" (`500`),
  như Directus.
- Body `PATCH /fields/:c/:f` có `field` khác URL: Directus dùng `field` của body cho cột và metadata, rồi đọc lại theo
  URL (không có đường đổi tên); làm như Directus.
- Apply lỗi giữa chừng: transaction rollback (DDL tự commit trên MySQL thì không), `postColumnChange` và `flushCaches`
  không chạy, nên schema trong process của cả hai app vẫn là bản cũ tới lần xóa cache kế tiếp, như Directus.
- Xóa collection khi bảng khác còn khóa ngoại trỏ tới nó (m2o từ collection khác): `DROP TABLE` chạy đầu tiên và bị DB
  chặn (Postgres "other objects depend on it"), Directus trả `500`, transaction rollback, không dọn gì; app mới làm y
  hệt (đo ở `ddl.test.ts`, T021). Muốn xóa phải xóa field m2o hoặc relation trước, như app Directus làm. SQLite không
  chặn: `204`, bảng bị xóa, khóa ngoại còn lại trỏ vào bảng không tồn tại (T031, cả hai app).
- CockroachDB: Directus 11.17.4 trả `500` khi đổi `max_length` của cột (`ALTER COLUMN TYPE is not supported inside a
  transaction`), app mới làm y hệt; ca diff, apply của bộ đối chiếu cần đổi kiểu cột nên bỏ qua trên CockroachDB.
- `GET /fields`, `GET /relations` không có `ORDER BY` khi đọc metadata: thứ tự là thứ tự vật lý của dòng trong DB, như
  Directus; hai app gọi cùng lúc trả cùng thứ tự, bộ so nối tiếp sắp lại trước khi so (research R5).
- Snapshot do người dùng soạn tay (YAML) thiếu key tùy chọn (ví dụ `meta.note`): `deep-diff` báo thuộc tính bị xóa và
  apply ghi lại metadata theo snapshot, như Directus; thứ tự key không tạo diff.

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| US1 | 1–8 | FR-001 đến FR-003, FR-010 đến FR-013, FR-020 đến FR-024 | SC-002, SC-003 |
| US2 | 1–7 | FR-021, FR-023, FR-030 đến FR-032 | SC-002, SC-003 |
| US3 | 1–5 | FR-040, FR-043, FR-050, FR-051, FR-062, FR-063 | SC-004, SC-005, SC-006 |
| US4 | 1–4 | FR-040 đến FR-043 | SC-006 |
| US5 | 1–4 | FR-060, FR-061, FR-064 | SC-001 |
| Mọi story | — | FR-065 (benchmark) | SC-007 |

## Requirements *(mandatory)*

### Functional Requirements

**Route và hành vi chung**

- **FR-001**: App mới PHẢI phục vụ mọi route của `controllers/collections.ts`, `fields.ts`, `relations.ts`, `schema.ts`
  với cùng method, path, middleware, body, query (`concurrentIndexCreation`, `force`, `export`), response, status (kể
  cả `204`), header và thứ tự lỗi như Directus 11.17.4, kể cả `SEARCH /collections`, `OPTIONS`, `HEAD`.
- **FR-002**: Mọi thao tác ghi PHẢI chỉ cho admin (`403 FORBIDDEN` cho user khác); đọc PHẢI lọc theo quyền đọc như
  Directus (collection cho phép và group cha, field theo `fields` của permission, relation theo `filterForbidden`).
- **FR-003**: Kiểm tra payload (Joi của controller, kiểm tên, trùng, kiểu, khóa chính, alias, field hệ thống) PHẢI cho
  cùng lỗi, message và status như Directus.

**Collection**

- **FR-010**: Tạo collection PHẢI làm như `CollectionsService.createOne`: một transaction; `fields` phải là mảng
  (`400` "fields must be an array"); tự thêm `id` khi không field nào có `is_primary_key` hoặc `has_auto_increment`;
  tạo bảng và cột qua cùng ánh xạ kiểu; ghi `directus_fields` với `sort` = vị trí + 1 (đếm lại từ 1 trong mỗi `group`),
  `meta.sort` client gửi được ưu tiên (lodash `merge`); rồi `directus_collections`; collection folder (`schema: null`)
  chỉ ghi metadata; tạo nhiều trong một transaction. Dòng `directus_activity`, `directus_revisions` cho
  `directus_collections`, `directus_fields` ghi như Directus (ItemsService có `accountability`).
- **FR-011**: Đọc collection PHẢI ghép bảng trong DB, dòng `directus_collections` và collection hệ thống như Directus,
  áp `DB_EXCLUDE_TABLES` ở `/collections`; bảng bị loại cũng không có trong schema trong process nên vắng ở `/fields`,
  `/relations`, snapshot (Edge Cases).
- **FR-012**: Sửa collection (`updateOne`, `updateBatch`, `updateMany`) PHẢI chỉ sửa metadata, tạo dòng metadata khi
  chưa có, như Directus; kể cả `PATCH /collections/directus_<x>` (Directus không chặn: tạo dòng `directus_collections`
  cho collection hệ thống, rủi ro R-11).
- **FR-013**: Xóa collection PHẢI dọn bảng, metadata, field, relation, field quan hệ ở collection khác,
  `one_allowed_collections`, `item_duplication_fields`, `group` của collection con và các dòng `directus_presets`,
  `directus_revisions`, `directus_activity`, `directus_permissions` đúng như `deleteOne` của Directus, trong một
  transaction. Dòng `directus_shares`, `directus_versions` của collection bị xóa qua khóa ngoại `ON DELETE CASCADE`
  của schema hệ thống (migration của Directus); `directus_comments`, `directus_notifications` không có khóa ngoại nên
  để nguyên, như Directus. `DELETE /collections/directus_<x>` PHẢI trả `403 FORBIDDEN` (khác biệt D-32: Directus không
  chặn và xóa bảng hệ thống, trái Nguyên tắc II).

**Field**

- **FR-020**: Tạo, sửa field không alias PHẢI sinh DDL như `addColumnToTable` và dialect helper của Directus trên từng
  vendor: ánh xạ kiểu (`KNEX_TYPES`), tự tăng, `string` với `max_length` (MSSQL không độ dài thành `text`), `float`,
  `decimal` với precision, scale mặc định 10, 5, `csv`, `hash`, `dateTime` không timezone, `timestamp` có timezone,
  geometry theo `helpers.st.createColumn`, `binary`, default (kể cả `ALLOWED_DB_DEFAULT_FUNCTIONS`), nullable, khóa
  chính, unique, index với tên theo `generateIndexName`, và `concurrentIndexCreation`. Quy tắc chi tiết như Directus:
  `max_length` null → độ dài mặc định của Knex (255) trừ MSSQL (`text`), `max_length` chuỗi chuyển thẳng cho Knex;
  `is_unique` và `is_indexed` cùng `true` tạo cả hai; giá trị thiếu khi sửa lấy từ cột hiện có; trên vendor không tạo
  index đồng thời được (SQLite) `concurrentIndexCreation` tạo index thường, response không đổi; `gen_random_uuid()`
  trên vendor không có hàm là lỗi DB. Lỗi DB: `updateField` dịch qua `translateDatabaseError` (mã
  `RECORD_NOT_UNIQUE`, `VALUE_TOO_LONG`, `NOT_NULL_VIOLATION`, `VALUE_OUT_OF_RANGE`, `INVALID_FOREIGN_KEY`,
  `CONTAINS_NULL_VALUES` theo bảng ánh xạ từng vendor đã port ở 004); `createField`, `createOne` của collection và
  relation không dịch, lỗi DB chưa ánh xạ trả `500 INTERNAL_SERVER_ERROR` với body chung; bộ đối chiếu so status và
  mã, không so message của `500`.
- **FR-021**: Field alias (`ALIAS_TYPES`: `alias`, `o2m`, `m2m`, `m2a`, `o2a`, `files`, `translations`; special
  `no-data`, `group`) PHẢI chỉ ghi metadata, không tạo cột, đọc ra `schema: null`.
- **FR-022**: Sửa field PHẢI alter khi `schema` gửi lên khác toàn bộ object cột hiện có (`isEqual` của Directus; `PATCH`
  với `schema` một phần luôn alter, app Directus gửi đủ object; khi apply diff so qua `sanitizeColumn`), không có đường
  đổi tên field (Edge Cases), không cho đổi giữa alias và không alias, khóa chính không nullable, dịch lỗi DB như
  Directus (`translateDatabaseError`, FR-020); `PATCH /fields/:collection` chạy tuần tự không transaction.
- **FR-023**: Xóa field PHẢI dọn relation (m2o: xóa relation và field o2m đối diện; o2m: `one_field = null`), cột,
  `archive_field`, `sort_field`, `item_duplication_fields` của collection, `group` của field con, metadata, và field đó
  trong `directus_permissions.fields` (thành `null` khi rỗng), như Directus. KHÔNG dọn (như Directus): `filter`,
  `validation`, `presets` của permission; `conditions`, `validation`, `display_template` của field và collection khác;
  `layout_query`, `layout_options`, `filter` của `directus_presets` còn nhắc tên field.
- **FR-024**: Field hệ thống PHẢI chỉ cho đổi `schema.is_indexed` (kể cả tạo index đồng thời) và không cho xóa, như
  Directus: `PATCH` với key ngoài `collection`, `field`, `schema.is_indexed` → `400` "Only \"schema.is_indexed\" may
  be modified for system fields" (zod `strict`); apply với `kind` khác `E` hoặc path khác `schema.is_indexed` → `400`
  với message của `validateApplyDiff`; index tên theo `generateIndexName` như index thường. Field người dùng trong
  collection hệ thống (ví dụ m2o trong `directus_users`) PHẢI có đủ vòng đời như field thường: tạo, sửa, xóa, làm đầu
  quan hệ, xuất hiện ở `/fields/directus_<x>` và trong `fields` của snapshot (FR-040), tạo được bằng apply ở app kia
  (Clarifications).

**Relation**

- **FR-030**: Tạo relation PHẢI kiểm tra và tạo khóa ngoại (tên `getDefaultIndexName`, `on_delete`, `on_update`, đổi
  kiểu cột qua `alterType` khi Directus đổi, `preRelationChange`), ghi `directus_relations`; m2a không có khóa ngoại.
  Lỗi DB khi tạo khóa ngoại (kiểu cột khác kiểu khóa chính đích, dòng mồ côi, khóa đích không unique) không dịch:
  `500 INTERNAL_SERVER_ERROR` như Directus (FR-020). `directus_relations` ghi qua ItemsService không `accountability`
  nên KHÔNG có dòng `directus_activity`, `directus_revisions` cho relation, như Directus.
- **FR-031**: Sửa relation PHẢI xóa và tạo lại khóa ngoại với tên theo `constraintName` của vendor (chỉ `schema.on_delete`,
  `on_update` và `meta` đổi được; `related_collection` giữ của relation hiện có; m2a không có DDL, chỉ metadata), sửa
  hoặc tạo metadata; xóa relation PHẢI xóa khóa ngoại khi có và metadata, như Directus.
- **FR-032**: Đọc relation PHẢI ghép metadata, relation hệ thống và mọi khóa ngoại trong DB (kể cả tới bảng không có
  trong schema; khóa ngoại không metadata có `meta: null`; metadata không khóa ngoại có `schema: null`; relation hệ
  thống có `schema` khi khóa ngoại tồn tại) như `stitchRelations` của Directus.

**Snapshot, diff, apply**

- **FR-040**: `GET /schema/snapshot` PHẢI trả cùng nội dung và thứ tự key như `getSnapshot` của Directus (JSON trùng
  từng byte), với `directus: "11.17.4"` và `vendor` của DB. Collection hệ thống không có trong `collections`, nhưng
  field người dùng của chúng (và relation từ các field đó) CÓ trong `fields`, `relations` (chỉ `meta.system === true`
  và `meta === null` bị loại), như Directus. `?export=yaml` dùng phần export của 005: nội dung sau parse PHẢI bằng
  bản JSON; trùng từng byte với Directus được đo và ghi (rủi ro R1 của 005: `js-yaml` 4.3.2 với 4.1.1).
- **FR-041**: `POST /schema/diff` PHẢI nhận JSON hoặc multipart một file (JSON theo mimetype, còn lại YAML), kiểm
  snapshot như `validateSnapshot` (version, vendor, `force`), trả `{hash, diff}` như `getSnapshotDiff` và
  `getVersionedHash`, `204` khi không khác. Giới hạn kích thước: body JSON theo `MAX_PAYLOAD_SIZE`; multipart không giới
  hạn (busboy mặc định), như Directus.
- **FR-042**: `POST /schema/apply` PHẢI kiểm diff và hash như `validateApplyDiff` (thứ tự và message lỗi ở
  contracts/snapshot.md §3), apply theo đúng thứ tự của `applyDiff` trong một transaction (khóa chính và khóa ngoại
  `char`/`varchar` độ dài 36 trong collection mới được ép sang `uuid` trên mọi vendor, như Directus), rồi
  `postColumnChange`, xóa cache và phát event sau commit; trả `204`. Apply xóa bảng và cột có dữ liệu theo diff `D`
  không hỏi lại, không có dry-run, như Directus; lỗi giữa chừng theo Edge Cases.
- **FR-043**: Snapshot lấy ở app này PHẢI diff và apply được ở app kia và ngược lại, cùng vendor, không cần `force`.
  Snapshot khác vendor với `force` làm như Directus nhưng không thuộc phạm vi kiểm của feature này.

**Cache và event**

- **FR-050**: Sau mỗi thay đổi schema (gồm apply), app mới PHẢI gọi thao tác xóa cache hệ thống của 002 như
  `clearSystemCache` (lock `system-cache-lock`, xóa schema trong process, permissions cache, publish `schemaChanged`
  với `autoPurgeCache`) và xóa response cache khi `shouldClearCache`, để mọi instance của hai app thấy schema mới ở
  request kế tiếp (FR-020 của 002 được kiểm lại qua API).
- **FR-051**: App mới PHẢI phát cùng event, cùng thời điểm như Directus: `collections.*` và `relations.create|update`
  (filter và action qua ItemsService), `fields.create|update|delete` (filter và action), `relations.delete` (chỉ
  action), action sau commit với schema mới; cùng điều kiện đẩy `websocket.event` như 005.

**Kiểm thử**

- **FR-060**: Bộ đối chiếu PHẢI so status, body, header, cấu trúc DB và các dòng `directus_collections`,
  `directus_fields`, `directus_relations` của hai app, cho mọi kiểu field (`KNEX_TYPES` kể cả `binary`, `hash`, `csv`,
  `geometry` và kiểu con, `uuid`) và mọi loại quan hệ. Thuộc tính cấu trúc so (tập của SC-003): với cột `data_type`,
  `max_length`, `numeric_precision`, `numeric_scale`, `is_nullable`, `default_value`, `is_primary_key`,
  `has_auto_increment`, `is_unique`, `is_indexed`, `is_generated`, `generation_expression`, `comment`,
  `foreign_key_table`, `foreign_key_column` (đúng tập `columnInfo` của thư viện schema); với index tên, cột, unique;
  với khóa ngoại tên constraint, cột, bảng và cột đích, `on_update`, `on_delete`. Không so collation, charset,
  tablespace. Mỗi ca chạy nối tiếp trên cùng DB với cùng
  tên: Directus chạy chuỗi request, bộ test chụp cấu trúc và metadata rồi xóa mô hình (qua API, kiểm luôn luồng xóa và
  DB trở về như trước); app mới chạy lại cùng chuỗi, chụp và so. Ca DDL trong một file chạy tuần tự (Clarifications).
- **FR-061**: Bộ blackbox ở đầu spec PHẢI được port và đạt ở cả hai app. Postgres đủ bộ mỗi lần push; MySQL, SQLite bộ
  rút gọn mỗi lần push và đủ bộ ở workflow riêng; MariaDB, MSSQL, Oracle, CockroachDB, Postgres 10, MySQL 5 ở
  `nightly.yml` (hiện bấm tay, lịch tắt tới khi mọi feature xong), như tiền lệ 004, 005.
- **FR-062**: PHẢI có kiểm tra chéo: dựng mô hình đầy đủ (mọi kiểu field, folder, năm loại quan hệ, translations,
  presentation, group, archive, sort) ở app này rồi so snapshot và chạy CRUD `/items` ở app kia, cả hai chiều.
- **FR-063**: PHẢI có Playwright E2E app Directus qua reverse proxy cho module Data Model (tạo collection, field, quan hệ,
  translations) và Content trên mô hình do app mới dựng.
- **FR-064**: Seed của bộ blackbox 004, 005 PHẢI chọn được app tạo collection, field, relation (Directus hoặc app mới)
  bằng một cờ cấu hình. Mỗi lần push seed bằng Directus như hiện tại; workflow đủ bộ hằng tuần chạy thêm một lượt seed
  bằng app mới, mọi ca vẫn đạt ở cả hai app (Clarifications).
- **FR-065**: PHẢI có benchmark `GET /collections`, `GET /fields`, `GET /relations`, `GET /schema/snapshot` và `POST
  /schema/diff` (snapshot của chính data model đó, kết quả `204`) ở hai app, với token admin và token user có quyền đọc
  một phần, trên data model cỡ lớn (60 collection, khoảng 930 field, 59 relation, dựng qua API; snapshot dưới
  `MAX_PAYLOAD_SIZE` mặc định 1 MB). Chạy ở workflow benchmark hằng tuần, không chặn CI (Clarifications).

### Key Entities

- **Collection**: một bảng dữ liệu người dùng hoặc folder; metadata ở `directus_collections` (icon, note, hidden,
  singleton, translations, `archive_field`, `archive_value`, `unarchive_value`, `sort_field`, `group`,
  `item_duplication_fields`...).
- **Field**: một cột hoặc một alias; metadata ở `directus_fields` (interface, display, options, special, `group`, `sort`,
  width, conditions, validation...), phần `schema` đọc từ DB.
- **Relation**: liên kết giữa field và collection; metadata ở `directus_relations`, phần `schema` là khóa ngoại trong DB.
- **Snapshot**: bản mô tả data model (`version`, `directus`, `vendor`, `collections`, `fields`, `systemFields`,
  `relations`).
- **Diff**: danh sách thay đổi giữa snapshot và schema hiện tại theo từng collection, field, relation, kèm hash của
  schema hiện tại.
- **Thuật ngữ "schema"**: trong spec này "phần `schema`" là object cấu trúc cột hoặc khóa ngoại của field, relation
  (API); "schema trong process" là SchemaOverview của 002; "route `/schema`" là snapshot, diff, apply. Chỗ nào có thể
  nhầm, spec ghi đủ cụm.

## Khác biệt so với Directus *(mandatory)*

Thay đổi với bảng khác biệt của các feature trước:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-09.4 | Gỡ: `/collections`, `/fields`, `/relations`, `/schema` làm ở feature này | FR-001 đến FR-043 |

Sửa bảng của spec cũ đi cùng feature này: dòng D-09.4 trong spec 001; Assumptions của 004, 005 về seed qua API Directus
(FR-064). Entry tương ứng trong `tests/parity/accepted-differences.ts`. Mọi dòng cần tech lead duyệt khi đóng feature
(Nguyên tắc X).

Khác biệt mới:

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại | Gỡ khi |
|----|----------|------------------|---------|-------|------|--------|
| D-32 | `DELETE /collections/directus_<x>` bởi admin | Không chặn: `readByQuery` liệt kê collection hệ thống kèm `schema` (bảng có trong DB), `deleteOne` gọi `dropTable` rồi dọn metadata (`services/collections.ts:621-660`, `validateAccess` bỏ qua admin). Đo ngày 2026-10-12 (T010) trên Directus 11.17.4 SQLite bỏ đi: `DELETE /collections/directus_notifications` trả `204`, bảng `directus_notifications` mất khỏi `sqlite_master` | `403 FORBIDDEN` (message của `ForbiddenError`), không DDL | Nguyên tắc II cấm xóa bảng hệ thống trên DB dùng chung | khác | — |

**Rủi ro chấp nhận (tái tạo từ Directus)**: như quy tắc của 004, 005; cần tech lead duyệt khi đóng feature.

| Mã | Hành vi của Directus | Bằng chứng | Hệ quả |
|----|----------------------|------------|--------|
| R-11 | `PATCH /collections/directus_<x>` với `meta` không bị chặn: `updateOne` tạo dòng `directus_collections` cho collection hệ thống (chưa có dòng nên `exists` false); `readByQuery` sau đó có hai entry cho collection đó (dòng DB và `systemCollectionRows`) | `services/collections.ts:444-470`, `:316-331` | `/collections` và app Directus hiển thị trùng (đo T010: `GET /collections` trả hai entry `directus_users` sau `PATCH`); chỉ dữ liệu, không DDL, nên tái tạo (FR-012). Bộ đối chiếu có ca, dọn dòng sau ca |
| R-12 | Trên SQLite (pool một kết nối), `RelationsService.deleteOne` đọc khóa ngoại bằng knex chính (`this.foreignKeys()`, không phải `trx`) bên trong transaction; khi cache `foreignKeys` trống, request chờ pool tới `acquireConnectionTimeout` (60 giây) rồi `500` (`Knex: Timeout acquiring a connection`). Xảy ra với `DELETE /relations/:c/:f` và `DELETE /fields/:c/:f` của field m2o | `services/relations.ts:467-469`; đo ở `relations.test.ts` trên SQLite (T031): log của cả Directus và app mới có `KnexTimeoutError` | Chỉ SQLite. Tái tạo (FR-031); ca so sánh bỏ qua trên SQLite vì thời điểm treo phụ thuộc cache |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. Key `directus` trong snapshot, message `Provided snapshot's directus version ...` của `validateSnapshot`,
  tên event (`collections.*`, `fields.*`, `relations.*`), tên bảng `directus_*`, tiền tố tên index và khóa ngoại giữ
  nguyên vì là định dạng dữ liệu dùng chung hoặc tên kỹ thuật (Nguyên tắc IX).

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4. Khi spec không nói rõ, làm như code Directus. Quy ước message lỗi và quy tắc so
  của bộ đối chiếu như Assumptions của 004, 005.
- Cách hiểu Nguyên tắc II cho field người dùng trong collection hệ thống và index trên cột hệ thống theo Clarifications;
  constitution 1.4.0 (2026-10-12) đã ghi.
- Nguyên tắc II cho phép tạo, sửa bảng dữ liệu người dùng qua API collections, fields, relations; ghi dữ liệu (không
  đổi cấu trúc) vào `directus_collections`, `directus_fields`, `directus_relations`, `directus_presets`,
  `directus_revisions`, `directus_activity`, `directus_permissions` là hành vi bình thường của API.
- Translations, archive, sort là cách app Directus dùng metadata và các route chung: server không có logic riêng ngoài
  dọn `archive_field`, `sort_field` khi xóa field. Kéo thả sắp xếp gọi `POST /utils/sort/:collection` (010); trong E2E,
  route đó vẫn đi tới Directus theo bảng định tuyến của proxy (004).
- Directus không khóa DDL đồng thời; app mới cũng không thêm khóa. Thay đổi schema đồng thời từ hai app có kết quả như
  hai instance Directus.
- Bộ đối chiếu so DDL bằng cách đọc cấu trúc DB qua cùng thư viện đọc schema mà Directus dùng (đã có ở 002), không so
  câu SQL.
- Ca của bộ blackbox fail trên chính Directus ở một vendor được bỏ qua theo vendor với ghi chú tên ca và vendor, như
  005. Ca `schema-cache.test.ts` và timezone cần nhiều node hoặc đổi `TZ` của process: dùng thêm instance trong môi
  trường đối chiếu, cách dựng chọn khi lập plan.
- Lệnh CLI `directus schema snapshot`, `directus schema apply` (`utils/apply-snapshot.ts`) ngoài phạm vi: app mới không
  có CLI schema; pipeline deploy dùng CLI của Directus trên cùng DB hoặc gọi route `/schema/*` (Clarifications). Không
  phải khác biệt API (Nguyên tắc III chỉ nói REST và GraphQL).
- Benchmark chỉ đo các route đọc và snapshot, diff (FR-065); thao tác ghi DDL hiếm và phụ thuộc DB nên không đo. Quy
  mô ban đầu (200 collection, 3.000 field, 300 relation) đã chỉnh sau lần đo đầu (T054, 2026-10-12): snapshot 2,5 MB
  vượt `MAX_PAYLOAD_SIZE` mặc định nên `POST /schema/diff` trả `400` ở cả hai app; còn 60 collection (snapshot khoảng
  770 KB). `GET /schema/snapshot`, `POST /schema/diff` đo với 5 kết nối: 50 kết nối xếp hàng quá timeout 10 giây ở cả
  hai app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% ca của bộ blackbox port (US5) đạt ở cả hai app trên Postgres, MySQL, SQLite trước khi đóng feature;
  vendor còn lại đạt ở một lượt `nightly.yml` bấm tay trước khi đóng feature hoặc được ghi chú theo Assumptions.
- **SC-002**: 100% request của bộ đối chiếu `/collections`, `/fields`, `/relations`, `/schema` (kể cả lỗi, `OPTIONS`,
  `HEAD`) cho cùng status, body, header ở hai app, ngoài khác biệt đã ghi.
- **SC-003**: Với mỗi kiểu field và mỗi loại quan hệ, trên mỗi vendor được kiểm, cấu trúc DB và metadata do app mới tạo
  giống Directus ở 100% thuộc tính so sánh (FR-060).
- **SC-004**: Mô hình đầy đủ dựng ở một app cho snapshot giống hệt ở app kia, và 100% thao tác CRUD item, màn hình Data
  Model, Content trong E2E thành công ở app kia, cả hai chiều.
- **SC-005**: Sau mỗi thay đổi schema ở một app, request kế tiếp tới app kia (đã nạp schema trước đó) thấy schema mới
  trong 100% lần đo, không cần khởi động lại.
- **SC-006**: Snapshot lấy ở app này diff và apply được ở app kia và ngược lại; sau apply, `POST /schema/diff` với cùng
  snapshot trả `204` ở cả hai app.
- **SC-007**: Với data model cỡ lớn (FR-065), p95 latency và throughput của mỗi kịch bản benchmark ở app mới không tệ hơn
  Directus quá 10%.
