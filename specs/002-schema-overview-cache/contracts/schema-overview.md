# Contract: SchemaOverview

SchemaOverview của app mới PHẢI bằng của Directus 11.17.4 trên cùng DB và cùng cấu hình (FR-008). Nguồn quy tắc:
`directus/api/src/utils/get-schema.ts` (`getDatabaseSchema`), `get-local-type.ts`, `get-default-value.ts`,
`get-field-system-rows.ts`, `services/relations.ts` (`readAll`, `stitchRelations`), `directus/packages/schema`.
Bản port ở 001 nằm trong `apps/api/src/schema/`.

## Quy tắc dựng

1. `overview = inspector.overview()`. Đọc `directus_collections` (5 cột), cộng `systemCollectionRows`.
2. Với mỗi bảng trong `overview`:
   - Bỏ qua nếu nằm trong `DB_EXCLUDE_TABLES` (log `trace`).
   - Bỏ qua nếu không có khóa chính (log `warn`).
   - Bỏ qua nếu tên có dấu cách (log `warn`).
   - Collection: `primary`; `singleton = toBoolean(meta.singleton)`; `note` và `sortField` lấy từ meta hoặc `null`;
     `accountability` lấy từ meta, mặc định `'all'` khi không có dòng meta.
   - Mỗi cột thành một field:
     - `defaultValue = getDefaultValue(column) ?? null`
     - `nullable = is_nullable ?? true`
     - `generated = is_generated ?? false`
     - `type = getLocalType(column)`
     - `dbType = data_type`
     - `precision` và `scale` là `null` khi giá trị falsy
     - `special = []`, `note = null`, `validation = null`, `alias = false`, `searchable = true`
3. Đọc `directus_fields` (7 cột), cộng `getSystemFieldRowsWithAuthProviders()`, loại dòng có `special` chứa `no-data`.
   Với mỗi dòng:
   - Bỏ qua nếu collection không có trong kết quả.
   - Bỏ qua nếu không phải alias (`special` không giao với `ALIAS_TYPES` = `alias`, `o2m`, `m2m`, `m2a`, `o2a`,
     `files`, `translations`) và cũng không có cột.
   - Field được ghi đè:
     - `type = (có cột && getLocalType(column, { special })) || 'alias'`
     - `validation`: parse JSON nếu là chuỗi
     - `searchable = toBoolean(searchable) ?? true`
     - `alias = existing?.alias ?? true`
     - Các giá trị số và mặc định giữ từ cột nếu có.
4. `relations`:
   - Lấy dòng `directus_relations` cộng `systemRelationRows`.
   - Lấy foreign key từ `inspector.foreignKeys()` (nhánh `bypassCache`, không cache).
   - Ghép bằng `stitchRelations`: FK khớp meta theo `many_collection`, `many_field`, `one_collection`; meta không có
     FK thì có `schema: null`.
   - Không lọc theo quyền (không có accountability).

## Quy tắc so sánh (test đối chiếu)

- So toàn bộ cây bằng `toStrictEqual` sau `JSON.parse`, đúng như hai app nhận qua bus. Không chuẩn hóa giá trị nào.
- `relations` so theo đúng thứ tự.
- Thứ tự key trong object không được so (JSON không giữ ý nghĩa thứ tự key).
- Lấy schema của mỗi app qua message `schemaCache--done` (research R9).
- DB mẫu tạo qua API của Directus trong `tests/parity/src/schema/fixture.ts`, gồm:
  - mọi kiểu field theo vendor;
  - field alias `o2m`, `m2m`, `m2a`, `translations`, `files`, presentation, group;
  - field `no-data`;
  - `validation` dạng chuỗi JSON;
  - `note`, `sort_field`, `singleton`, `accountability = null`.

  Thêm bằng SQL trực tiếp trong test: bảng không có khóa chính, bảng tên có dấu cách, và bảng trong
  `DB_EXCLUDE_TABLES`.
