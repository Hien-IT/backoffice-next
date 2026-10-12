# Contract: snapshot, diff, apply (006)

Mốc là `utils/get-snapshot.ts`, `get-snapshot-diff.ts`, `apply-diff.ts`, `validate-snapshot.ts`, `validate-diff.ts`,
`sanitize-schema.ts`, `get-versioned-hash.ts`, `services/schema.ts` của Directus 11.17.4. Hình dạng dữ liệu ở
data-model.md §5, §6.

## 1. `GET /schema/snapshot`

- `getSchema({database, bypassCache: true})` rồi `CollectionsService.readByQuery()`, `FieldsService.readAll()`,
  `RelationsService.readAll()` với `accountability` admin (không lọc quyền).
- Lọc (`excludeSystem`, `excludeUntracked` áp riêng cho từng mảng): phần tử có `meta.system === true` hoặc
  `meta === null` bị bỏ. Hệ quả: collection hệ thống không có trong `collections`, nhưng field người dùng thêm vào
  collection hệ thống (meta không `system`) và relation từ chúng CÓ trong `fields`, `relations`; cột không có dòng
  `directus_fields` và bảng không metadata không vào snapshot. `systemFields` là field hệ thống có `schema.is_indexed`.
- Sắp xếp: collection theo `collection`; field, relation theo `collection` rồi `meta.id`; sau đó `omit(meta.id)`.
- `sanitizeCollection`: `collection`, `fields`, `meta`, `schema.name`. `sanitizeField`: `collection`, `field`, `type`,
  `meta`, `name`, `children` và `schema` gồm `name`, `table`, `data_type`, `default_value`, `max_length`,
  `numeric_precision`, `numeric_scale`, `is_nullable`, `is_unique`, `is_indexed`, `is_primary_key`, `is_generated`,
  `generation_expression`, `has_auto_increment`, `foreign_key_table`, `foreign_key_column` (bỏ `schema` với khóa tự
  tăng). `sanitizeRelation`: `collection`, `field`, `related_collection`, `meta`, `schema` gồm `table`, `column`,
  `foreign_key_table`, `foreign_key_column`, `constraint_name`, `on_update`, `on_delete`.
- `version: 1`, `directus: DIRECTUS_COMPAT_VERSION` (`'11.17.4'`), `vendor: getDatabaseClient(db)`.
- `?export=yaml|json|csv|xml`: `respond` của 005 (`js-yaml.dump`); `yaml` là định dạng app Directus và blackbox dùng.

## 2. `POST /schema/diff`

- Body: snapshot (JSON hoặc file, contracts/schema-api.md §2).
- `validateSnapshot(snapshot, force)`: Joi (`version` = 1, `directus` chuỗi bắt buộc, `vendor` ∈ `DatabaseClients`
  tùy chọn, `collections[]`, `fields[]` (`type` ∈ `TYPES` ∪ `ALIAS_TYPES` hoặc null; `schema` `.unknown().allow(null)`),
  `systemFields[]`, `relations[]`). Không `force`: `directus` phải bằng `'11.17.4'`; `vendor` bắt buộc và phải bằng
  vendor hiện tại; mỗi lỗi `400 INVALID_PAYLOAD` có đuôi "You can bypass this check by passing the \"force\" query
  parameter".
- `force` bật khi key `force` có trong query (`?force`, `?force=false` cũng bật).
- `getSnapshotDiff(current, snapshot)`: so từng collection, field, systemField, relation bằng `deep-diff`; alias ↔
  không alias thành xóa + tạo; systemField vắng → `E` `is_indexed` ngược; field, relation của collection bị xóa bị bỏ.
- Trả `{data: {hash: getVersionedHash(current), diff}}`; bốn mảng rỗng → `204`.

## 3. `POST /schema/apply`

- Body `{hash, diff}` (JSON hoặc file). `force` = `toBoolean(req.query.force)` (`true`, `1` bật).
- `validateApplyDiff(payload, current, force)`: Joi (bốn mảng bắt buộc, mỗi `diff` theo `kind`); bốn mảng rỗng →
  không làm gì (`204`); hash bằng `getVersionedHash(current)` hoặc `force` → apply; không thì lỗi `400 INVALID_PAYLOAD`
  theo thứ tự: tạo collection đã có / xóa collection không có; tạo field đã có / xóa field không có; systemField có
  `kind` khác `E` hoặc path khác `schema.is_indexed` ("...currently only \"schema.is_indexed\" is supported..."); tạo
  relation đã có / xóa relation không có; còn lại "Provided hash does not match the current instance's schema hash,
  indicating the schema has changed after this diff was generated. Please generate a new diff and try again or use the
  \"force\" query parameter to bypass this check".
- `applyDiff` trong một transaction (`bypassLimits`, `autoPurgeSystemCache: false`, event hoãn): (1) collection mới
  theo cây `meta.group`, field tạo kèm (khóa chính, khóa ngoại `char(36)`/`varchar(36)` → `uuid`); (2) xóa collection
  (xóa relation của nó trước); (3) sửa `meta` collection; (4) field: `N` → `createField`, `E`/`A` hoặc meta lồng
  `N`/`D` → `updateField`, `D` → `deleteField` (bỏ relation diff liên quan); schema đọc lại sau mỗi tạo, xóa; (5)
  `systemFields` `E` → `updateField`; (6) relation `N`, `E`/`A`, `D`. Sau transaction: `postColumnChange`,
  `flushCaches()` (xóa cache hệ thống và response cache, publish `schemaChanged`), phát action đã hoãn.
- Trả `204`. Lỗi giữa chừng: rollback (trừ DDL tự commit của MySQL), `postColumnChange` (SQLite: `PRAGMA
  foreign_keys` không bật lại trên kết nối đó) và `flushCaches` không chạy nên schema trong process của mọi instance
  hai app vẫn cũ tới lần xóa cache kế tiếp; như Directus. Xóa bảng, cột có dữ liệu theo diff `D` không hỏi lại.
- Ép `uuid`: với collection mới, field có `data_type` `char`/`varchar`, `max_length` 36 và là khóa chính hoặc có
  `foreign_key_table` + `foreign_key_column` được đổi thành `type: 'uuid'`, `data_type: 'uuid'`, `max_length: null`
  trên mọi vendor (`apply-diff.ts:76-88`).

## 4. Hash

`getVersionedHash(item) = objectHash({item, version: '11.17.4'})` (`object-hash` 3.0.0, cùng bản Directus). Cùng
snapshot → cùng hash ở hai app (SC-006; ca đo ở `cross-use.test.ts` và `schema.test.ts` port).

## 5. Dùng chéo (FR-043)

| Bước | App A | App B | Kỳ vọng |
|------|-------|-------|---------|
| 1 | `GET /schema/snapshot` | `GET /schema/snapshot` | bằng nhau từng byte sau `JSON.stringify` (cùng thứ tự key) |
| 2 | | `POST /schema/diff` với snapshot của A | `204` |
| 3 | sửa mô hình | `POST /schema/diff` với snapshot cũ của A | `{hash, diff}`; `hash` bằng `hash` tính ở A trên cùng schema |
| 4 | | `POST /schema/apply` với `{hash, diff}` | `204`; snapshot B bằng snapshot cũ của A |
| 5 | `GET /schema/snapshot` | | bằng snapshot B |
