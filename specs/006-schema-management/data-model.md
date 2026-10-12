# Data model: Quản lý data model (006)

Feature này là feature đầu tiên app mới chạy DDL: tạo, sửa, xóa bảng và cột của collection người dùng, cột người dùng
thêm vào collection hệ thống và index trên cột hệ thống (Clarifications), khóa ngoại. Không tạo, sửa, xóa cột gốc của
bảng `directus_*`, không migration (Nguyên tắc II, bản 1.4.0). Metadata ghi vào ba bảng hệ thống bằng cùng dòng như
Directus. Không có key Redis mới, không có kênh bus mới.

## 1. Thực thể và quan hệ

| Thực thể | Nguồn | Ghi chú |
|----------|-------|---------|
| Collection | Bảng trong DB (`inspector.tableInfo()`) + dòng `directus_collections` (`meta`) + `systemCollectionRows` | `schema: null` là folder (chỉ `meta`); `meta: null` là bảng chưa có metadata; `DB_EXCLUDE_TABLES` bị loại (§2) |
| Field | Cột trong DB (`inspector.columnInfo()`, `schema`) + dòng `directus_fields` (`meta`) + `systemFieldRows` | Alias (`special` chứa `ALIAS_TYPES`) có `schema: null`; `type` của cột do `getLocalType` (002) suy từ `data_type` theo vendor (§3) |
| Relation | Khóa ngoại trong DB (`inspector.foreignKeys()`, `schema`) + dòng `directus_relations` (`meta`) + `systemRelationRows` | m2a không có khóa ngoại (`related_collection: null`, `schema: null`); khóa ngoại không metadata có `meta: null` (§4) |
| Snapshot | Tính từ ba thực thể trên bằng `getSnapshot()` | §5 |
| Diff | `getSnapshotDiff(current, snapshot)` | §6 |

Quan hệ: Collection 1–n Field (theo `collection`); Field 0–1 Relation (theo `collection` + `field`); Relation n–1
Collection đích (`related_collection`); Field `meta.group` → Field cùng collection (group); Collection `meta.group` →
Collection folder.

## 2. Collection

Dòng `directus_collections` (`CollectionMeta` của `@backoffice/system-data`): `collection` (khóa), `icon`, `note`,
`display_template`, `hidden`, `singleton`, `translations` (JSON), `archive_field`, `archive_app_filter`,
`archive_value`, `unarchive_value`, `sort_field`, `accountability`, `color`, `item_duplication_fields` (JSON), `sort`,
`group`, `collapse`, `preview_url`, `versioning`. Dòng `meta.system` của collection hệ thống không ghi vào DB.

Tạo (`createOne`, một transaction, contracts/ddl.md §1): tên hợp lệ (không rỗng, không `directus_`, không `/`,
`parseCollectionName` trên MySQL `lower_case_table_names`), chưa có trong `directus_collections` và trong schema;
`payload.schema` có → `createTable` với mọi field không alias; không có field khóa chính → thêm `id` integer tự
tăng với meta `{hidden: true, interface: 'numeric', readonly: true}`; `directus_fields` ghi bằng `ItemsService.createMany`
(`sort` = vị trí + 1, đếm lại theo `group`); `payload.meta` có → ghi dòng `directus_collections`. `createMany`: một
transaction, cache xóa một lần.

Sửa: chỉ `meta` (`updateOne`, `updateBatch`, `updateMany`); tạo dòng khi chưa có.

Xóa (`deleteOne`, một transaction, thứ tự của Directus): `dropTable` (nếu có `schema`) → `group = null` ở collection
con → xóa dòng `directus_collections` (ItemsService, event) → nếu có `schema`: xóa `directus_fields` theo query (event),
xóa `directus_presets`, null `parent` rồi xóa `directus_revisions` (chunk 10.000), xóa `directus_activity`,
`directus_permissions`, `directus_relations` (`many_collection`), sửa `item_duplication_fields` của collection liên
quan, xóa field o2m đối diện và field m2o trỏ tới (`deleteField`), gỡ khỏi `one_allowed_collections` của m2a.

## 3. Field

Dòng `directus_fields` (`FieldMeta`): `id` (tự tăng, không có trong snapshot), `collection`, `field`, `special` (CSV),
`interface`, `options` (JSON), `display`, `display_options` (JSON), `readonly`, `hidden`, `sort`, `width`,
`translations` (JSON), `note`, `conditions` (JSON), `required`, `group`, `validation` (JSON), `validation_message`,
`searchable`. `schema` đọc từ cột: `name`, `table`, `data_type`, `default_value`, `max_length`, `numeric_precision`,
`numeric_scale`, `is_nullable`, `is_unique`, `is_indexed`, `is_primary_key`, `is_generated`, `generation_expression`,
`has_auto_increment`, `foreign_key_table`, `foreign_key_column`, `comment`.

Ánh xạ `type` → DDL (`addColumnToTable`): contracts/ddl.md §2. Alias (`ALIAS_TYPES` = `alias`, `o2m`, `m2m`, `m2a`,
`o2a`, `files`, `translations`; special `no-data`, `group`): chỉ `meta`, `schema: null`.

Tạo: `preColumnChange` → kiểm trùng (cột hoặc meta) → filter `fields.create` → DDL (không alias) → meta với
`sort = max(sort) + 1` trong collection hoặc trong `group` → `postColumnChange` → action `fields.create` sau commit.
Sửa: không đổi tên, không đổi giữa alias và không alias, khóa chính không nullable; alter chỉ khi cột khác; meta
upsert (field hệ thống chỉ `schema.is_indexed`). Xóa: contracts/ddl.md §4 (dọn relation, cột, `archive_field`,
`sort_field`, `item_duplication_fields`, `group` con, meta, `directus_permissions.fields`).

## 4. Relation

Dòng `directus_relations` (`RelationMeta`): `id`, `many_collection`, `many_field`, `one_collection`, `one_field`,
`one_collection_field`, `one_allowed_collections` (CSV), `junction_field`, `sort_field`, `one_deselect_action`. API đọc
ra `{collection, field, related_collection, schema, meta}`; `schema` là khóa ngoại (`table`, `column`,
`foreign_key_table`, `foreign_key_column`, `constraint_name`, `on_update`, `on_delete`).

Tạo: collection và field có trong schema, field không phải khóa chính, `related_collection` có trong schema (hoặc
null cho m2a), chưa có relation trên field; `preRelationChange` (Oracle bỏ `on_delete` tự tham chiếu); có
`related_collection` → `alterType` (MySQL: int → int unsigned khi khóa chính đích unsigned) → `foreign(field,
getDefaultIndexName('foreign', collection, field)).references(pk).onDelete(...).onUpdate(...)`; meta qua ItemsService
(event `relations.create`). Sửa: xóa khóa ngoại cũ (`constraintName` theo vendor), tạo lại; meta sửa hoặc tạo. Xóa:
xóa khóa ngoại nếu có, xóa meta thô, action `relations.delete` (không filter).

## 5. Snapshot (`@backoffice/types` `Snapshot`, port `packages/types/src/snapshot.ts`)

```text
{
  version: 1,
  directus: '11.17.4',          // DIRECTUS_COMPAT_VERSION; Directus: directus/package.json
  vendor: 'postgres' | 'mysql' | 'cockroachdb' | 'sqlite' | 'oracle' | 'mssql' | 'redshift',
  collections: [{ collection, meta, schema: { name } }],                      // sắp theo collection; bỏ meta.system, meta null
  fields: [{ collection, field, type, meta (không id), schema (16 key, bỏ với khóa tự tăng), name?, children? }],
                                                                               // sắp theo collection, meta.id rồi bỏ id
  systemFields: [{ collection, field, schema: { is_indexed } }],              // field hệ thống có is_indexed
  relations: [{ collection, field, related_collection, meta (không id), schema (7 key) }]
}
```

Key được `sanitizeCollection`, `sanitizeField`, `sanitizeRelation` lọc (contracts/snapshot.md §1). `hash` =
`object-hash({item: snapshot, version: '11.17.4'})`.

## 6. Diff (`SnapshotDiff`)

```text
{
  collections: [{ collection, diff: Diff[] }],
  fields: [{ collection, field, diff: Diff[] }],
  systemFields: [{ collection, field, diff: Diff[] }],
  relations: [{ collection, field, related_collection, diff: Diff[] }]
}
```

`Diff` là của `deep-diff` 1.0.2: `kind` `N` (mới), `D` (xóa), `E` (sửa, `lhs`, `rhs`), `A` (mảng, `index`, `item`),
`path`. Quy tắc: đổi kiểu alias ↔ không alias thành `D` + `N`; `systemField` vắng trong snapshot thành `E`
`is_indexed` ngược lại; field và relation của collection bị xóa bị bỏ khỏi diff. Response của `/schema/diff`:
`{data: {hash, diff}}`; body của `/schema/apply`: `{hash, diff}`.

## 7. Dữ liệu ghi ở bảng hệ thống khác (không đổi cấu trúc)

| Bảng | Thao tác | Khi nào |
|------|----------|---------|
| `directus_presets`, `directus_revisions`, `directus_activity`, `directus_permissions` | `DELETE` theo `collection` | Xóa collection có bảng |
| `directus_permissions.fields` | Gỡ tên field khỏi CSV (`null` khi rỗng) | Xóa field |
| `directus_collections.archive_field`, `sort_field`, `item_duplication_fields`, `group` | `null` hoặc gỡ phần tử | Xóa field, xóa collection |
| `directus_activity`, `directus_revisions` | Dòng `create`, `update`, `delete` của `directus_collections`, `directus_fields` qua ItemsService có `accountability`; KHÔNG có dòng cho `directus_relations` (ItemsService của relation không `accountability`, `services/relations.ts:280-285`) | Như Directus |
| `directus_shares`, `directus_versions` | Dòng của collection bị xóa qua `ON DELETE CASCADE` của schema hệ thống | Xóa collection (FR-013) |
| `directus_collections` cho collection hệ thống | `PATCH /collections/directus_<x>` tạo dòng (R-11); `DELETE /collections/directus_<x>` bị chặn `403` (D-32) | FR-012, FR-013 |

## 8. Cache và event (không key mới)

- Sau mỗi thao tác ghi: `cache.clear()` khi `shouldClearCache` (response cache dùng chung, `CACHE_AUTO_PURGE`), rồi
  `clearSystemCache({autoPurgeCache})` (lock `system-cache-lock`, xóa schema trong process, permissions cache,
  publish `schemaChanged` trên `REDIS_BUS_NAMESPACE`); `apply` gọi `flushCaches()` sau transaction. Mọi instance của
  hai app dựng lại schema ở request kế tiếp (002).
- Event: `collections.create|update|delete`, `relations.create|update` (filter và action qua ItemsService),
  `fields.create|update|delete` (filter, action), `relations.delete` (action); action sau commit với schema mới;
  cầu nối `websocket.event` của 005 đã có `fields.*`, `relations.*`.

## 9. State trong process

Không thêm. `systemFieldRows` cấp module của `fields.ts` là hằng (`getSystemFieldRowsWithAuthProviders()` đọc env lúc
khởi động, như Directus). Directus không khóa DDL đồng thời; app mới cũng không.
