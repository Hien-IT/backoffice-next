# Contract: DDL theo vendor (006)

Mốc là `services/fields.ts` (`addColumnToTable`, `addColumnIndex`), `services/collections.ts` (`createTable`,
`dropTable`), `services/relations.ts` (`foreign`, `alterType`), `database/helpers/schema/*`, `geometry/*`,
`utils/get-default-index-name.ts` của Directus 11.17.4. App mới sinh cùng câu DDL vì dùng cùng Knex 3.1.0 và cùng
dialect helper (đã port ở 001, 004). Bộ đối chiếu không so SQL mà so cấu trúc DB (research R5).

## 1. Tạo bảng (`createOne`)

- `knex.schema.createTable(name, (table) => { for field not alias: addColumnToTable(table, field) })`; khóa chính:
  `primary().notNullable()`; tự tăng: `increments()` (integer) hoặc `bigIncrements()` (bigInteger).
- Thiếu field khóa chính → thêm `id` integer `has_auto_increment`, `is_primary_key`.
- `concurrentIndexCreation`: index `is_indexed`, `is_unique` không tạo trong `createTable` mà sau transaction qua
  `addColumnIndex` → `helpers.schema.createIndex(collection, field, {unique, attemptConcurrentIndex})`.
- Folder (`schema: null`): không DDL.
- Xóa: `knex.schema.dropTable(name)` trong transaction (MySQL tự commit DDL, như Directus).

## 2. Ánh xạ `type` → cột (`addColumnToTable`)

| `type` | Knex | Ghi chú |
|--------|------|---------|
| `alias`, `unknown`, special `no-data`, `group` | không tạo cột | |
| tự tăng (`has_auto_increment`) | `increments` / `bigIncrements` (bigInteger) | |
| `string` | `string(max_length)` | MSSQL: `max_length` null → `text` |
| `text` | `text` | |
| `integer`, `bigInteger`, `boolean`, `date`, `time`, `json`, `uuid`, `binary` | gọi Knex cùng tên | |
| `float`, `decimal` | `float(precision, scale)` / `decimal(precision, scale)` | mặc định 10, 5 (`DEFAULT_NUMERIC_PRECISION`, `_SCALE`) |
| `csv` | `text` | |
| `hash` | `string(255)` | |
| `dateTime` | `dateTime(name, {useTz: false})` | |
| `timestamp` | `timestamp(name, {useTz: true})` | |
| `geometry`, `geometry.Point`, `.LineString`, `.Polygon`, `.MultiPoint`, `.MultiLineString`, `.MultiPolygon` | `helpers.st.createColumn(table, field)` | kiểu riêng từng vendor (Postgres `geometry(Point)`, MySQL `point`, MSSQL `geometry`, Oracle `sdo_geometry`, SQLite `text`) |
| khác | `400` "Illegal type passed: x" | |

Áp sau khi tạo cột (mỗi lần `alter`): `setNullable` (`helpers.schema.setNullable`), `defaultTo`: `now()` hoặc
`CURRENT_TIMESTAMP` → `knex.fn.now()`; `CURRENT_TIMESTAMP(n)` → `knex.fn.now(n)`; giá trị trong
`ALLOWED_DB_DEFAULT_FUNCTIONS` (`gen_random_uuid()`) → `knex.raw`; chuỗi khác → giá trị; `null` → `defaultTo(null)`.
`is_primary_key` → `primary().notNullable()`. Cột đã có → `.alter()`.

Unique và index: so với cột hiện có (`existing`): thêm `unique(name, generateIndexName('unique', collection, field))`
hoặc `index(name, generateIndexName('index', ...))`, bỏ bằng `dropUnique`, `dropIndex` cùng tên; khi
`attemptConcurrentIndex` thì bỏ qua và tạo sau transaction (`createIndex` theo vendor: Postgres
`CREATE INDEX CONCURRENTLY`, MySQL `ALGORITHM=INPLACE, LOCK=NONE`, MSSQL `WITH (ONLINE = ON)`, Oracle `ONLINE`,
CockroachDB thường; SQLite không hỗ trợ đồng thời).

## 3. Tên index và khóa ngoại

- `generateIndexName(type, collection, field)` của dialect: mặc định `getDefaultIndexName(type, collection, field)` =
  `<collection>_<field>_<type>` chữ thường (`type` là `unique`, `index`, `foreign`); dài hơn 60 ký tự → cắt 55 + `_` +
  hash 4 ký tự (`getSimpleHash`); SQLite không giới hạn; MSSQL, Oracle, MySQL, Postgres, CockroachDB có bản riêng
  (xem `schema/dialects/*.ts` đã port).
- Khóa ngoại: `table.foreign(field, getDefaultIndexName('foreign', collection, field)).references(pk).inTable(related)
  .onDelete(on_delete).onUpdate(on_update)`; sửa: `dropForeign(field, helpers.schema.constraintName(existing))` rồi
  tạo lại (CockroachDB đổi tên constraint).
- `getColumnNameMaxLength`, `getTableNameMaxLength`: 64 mặc định; MSSQL 128; Oracle 128 (bản 12.2+), đọc từ helper.

## 4. Sửa và xóa field, relation

- Sửa cột: chỉ `alter` khi `schema` khác cột hiện có (so bằng `sanitizeColumn` khi apply diff); `preColumnChange` /
  `postColumnChange` bao quanh (SQLite tắt rồi bật `PRAGMA foreign_keys`; Knex tạo lại bảng SQLite khi `alter`);
  `changeToType` của helper khi đổi kiểu (Oracle, CockroachDB có bản riêng); lỗi DB → `translateDatabaseError`.
- Xóa field (một transaction): m2o → `relationsService.deleteOne` (xóa khóa ngoại) và xóa field o2m đối diện; o2m →
  `one_field = null`; `dropColumn` nếu không alias; `getCollectionMetaUpdates` → `archive_field`, `sort_field` về `null`,
  gỡ khỏi `item_duplication_fields`; field con `group = null`; xóa meta; gỡ khỏi `directus_permissions.fields`.
- Relation: tạo → `alterType` (MySQL: cột int → int unsigned khi khóa chính đích unsigned, giữ NOT NULL) rồi `foreign`;
  m2a (`related_collection` null) → không DDL; Oracle tự tham chiếu → `on_delete` bị bỏ (`preRelationChange`).

## 5. Bảng hệ thống (Clarifications, Nguyên tắc II 1.4.0)

- Cho phép: `POST /fields/directus_<x>` thêm cột người dùng (DDL `ALTER TABLE directus_users ADD COLUMN ...`), sửa
  và xóa cột đó; `PATCH /fields/directus_<x>/<field hệ thống>` với `schema.is_indexed` (tạo, xóa index trên cột gốc),
  kể cả qua `systemFields` của `apply` và `concurrentIndexCreation`.
- Cấm (như Directus): đổi kiểu, nullable, default, xóa cột gốc (`403`, `400` của gốc); migration.
- `DELETE /collections/directus_<x>`: Directus không chặn (`readByQuery` trả collection hệ thống kèm `schema`,
  `deleteOne` gọi `dropTable`; `validateAccess` bỏ qua admin) → app mới trả `403 FORBIDDEN` trước mọi DDL (D-32,
  Nguyên tắc II). Kiểm ở `collections.service.test.ts` (mới) và `crud.test.ts` (ca chỉ gọi ở app mới; không gọi ở
  Directus của môi trường đối chiếu). Đo hành vi Directus một lần trên DB bỏ đi (task đầu gói B) để ghi bằng chứng.
- `PATCH /collections/directus_<x>` với `meta`: như Directus, tạo dòng `directus_collections` (R-11); ca đối chiếu dọn
  dòng đó sau khi so.
- Lỗi DB: chỉ `updateField` dịch qua `translateDatabaseError`; `createField`, `createOne` collection, mọi DDL của
  relation ném lỗi thô → `500 INTERNAL_SERVER_ERROR` body chung (`createOne` collection chỉ `InvalidPayload` cho tên,
  trùng, `fields` không phải mảng, "Illegal type"). Tên quá dài, `gen_random_uuid()` ở vendor không có hàm, khóa ngoại
  lệch kiểu đều rơi vào nhóm `500`.
- Bộ đối chiếu có ca cho cả hai nhóm (research R5); `db-unchanged.test.ts` chụp cột để chắc không có thay đổi ngoài
  ý muốn.

## 6. Vendor

| Vendor | Dialect helper | Đặc thù trong bộ đối chiếu |
|--------|----------------|-----------------------------|
| Postgres (chính), Postgres 10 | `postgres` | `gen_random_uuid()`, `CONCURRENTLY`, `geometry(...)` cần PostGIS (đã có trong image test của 001) |
| MySQL 8, MySQL 5, MariaDB | `mysql` | `lower_case_table_names`, unsigned, `point`, tự commit DDL |
| SQLite | `sqlite` | tạo lại bảng khi `alter`, `PRAGMA foreign_keys`, không giới hạn tên |
| MSSQL | `mssql` | `text` khi không `max_length`, `ONLINE = ON`, tên 128 |
| Oracle | `oracle` | `processFieldType`, `preRelationChange`, `sdo_geometry` |
| CockroachDB | `cockroachdb` | `constraintName`, `changeToType` |

Postgres đủ bộ mỗi lần push; MySQL, SQLite bộ rút gọn mỗi lần push; còn lại nightly (FR-061).
