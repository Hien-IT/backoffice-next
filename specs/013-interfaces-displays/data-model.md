# Data model: Bộ interfaces và displays (013)

App web không có DB riêng. Dữ liệu là kết quả API Directus (đọc) và trạng thái client. Kiểu từ `@directus/types`
15.0.3; dưới đây chỉ ghi phần 013 dùng.

## 1. Field đã parse (`stores/fields.ts`, chép `parseField`)

| Field | Kiểu | Nguồn | Dùng ở |
|-------|------|-------|--------|
| `collection`, `field`, `type` | string | `GET /fields` | mọi nơi |
| `name` | string | `formatTitle(field)` hoặc `t('fields.<collection>.<field>')` từ `meta.translations` | nhãn |
| `schema.default_value`, `max_length`, `is_nullable`, `is_generated`, `is_primary_key`, `has_auto_increment` | | | mặc định, bộ đếm, chỉ đọc PK, menu field |
| `meta.interface`, `meta.options` | string \| null, object \| null | | `FormFieldInterface` (`v-bind`) |
| `meta.display`, `meta.display_options` | | | `RenderDisplay`, `RenderTemplate` |
| `meta.special` | string[] | | `group`, quan hệ (`m2o`, `o2m`, `m2m`, `m2a`, `files`, `translations`), `uuid` |
| `meta.width` | `half` \| `half-left` \| `half-right` \| `full` \| `fill` | | lưới |
| `meta.hidden`, `readonly`, `required`, `group`, `sort`, `note`, `system` | | | `getFormFields` |
| `meta.conditions[]` | `{ name, rule, hidden?, readonly?, required?, options?, clear_hidden_value_on_save? }` | | `applyConditions` |
| `meta.validation`, `meta.validation_message` | Filter, string | | `validateItem`, `FormField` |
| `meta.translations[]` | `{ language, translation }` | | `name` |

Dịch `$t:` trong `note`, `options`, `display_options`, `validation_message` (`translateFields`) khi hydrate và khi
đổi ngôn ngữ. Khi `meta.interface` null hoặc không có trong registry: `getDefaultInterfaceForType(type)`
(`get-form-fields`); display tương tự ở nơi vẽ.

## 2. Relation và RelationInfo (`stores/relations.ts`, `use-relation-*.ts`)

`GET /relations` → `Relation { collection, field, related_collection, meta: { one_field, one_collection_field,
one_allowed_collections, junction_field, sort_field, one_deselect_action }, schema }`.

| Loại | Info | Field chính |
|------|------|-------------|
| M2O | `RelationM2O` | `relation`, `relatedCollection`, `relatedPrimaryKeyField`, `type: 'm2o'` |
| O2M | `RelationO2M` | `relation`, `relatedCollection`, `relatedPrimaryKeyField`, `reverseJunctionField`, `sortField`, `type: 'o2m'` |
| M2M | `RelationM2M` | `relation`, `junction`, `junctionCollection`, `junctionPrimaryKeyField`, `junctionField`, `reverseJunctionField`, `relatedCollection`, `relatedPrimaryKeyField`, `sortField`, `type: 'm2m'` |
| M2A | `RelationM2A` | như M2M cộng `allowedCollections[]`, `collectionField`, `relationPrimaryKeyFields` (theo collection), `type: 'm2a'` |

`files` = M2M tới `directus_files`; `translations` = M2M với collection nối là collection bản dịch và
`junctionField` là khóa ngoại ngôn ngữ.

## 3. Giá trị interface phát ra (FR-040, FR-080)

| Nhóm | Dạng |
|------|------|
| chuẩn, lựa chọn | chuỗi, số (integer/float là number; bigInteger/decimal là chuỗi), boolean, ISO datetime (`YYYY-MM-DDTHH:mm:ss` theo kiểu, timestamp ISO UTC), mảng chuỗi (tags, multi), hex màu, tên icon, `null` |
| m2o, file, file-image | khóa chính \| object thay đổi (tạo hoặc sửa lồng, có khóa chính khi sửa item có sẵn) \| `null` |
| o2m, m2m, m2a, files, translations | `ChangesItem { create: Record[], update: Record[], delete: (string\|number)[] }`; ba mảng rỗng → `undefined` (không thay đổi); với `version` → mảng khóa chính (như Directus) |
| tree view | `ChangesItem` lồng: thay đổi của con nằm ở `item[field]` trong `create`/`update` của cha |
| list | mảng object \| `null` |
| collection-item-dropdown | `{ key, collection }` \| `null`; bản nhiều: mảng \| `null` |
| map | GeoJSON geometry (json, geometry*), WKT (string, text), `[lng, lat]` (csv) \| `null` |
| input-block-editor | `{ time, version, blocks[] }` \| `null`; block ảnh/tệp có `{ width, height, size, name, title, extension, fileId, fileURL, url }` |
| input-rich-text-html | chuỗi HTML \| `null`; markdown: chuỗi |
| input-code (json) | JSON đã parse \| chuỗi `{{ biến }}` \| `null` |

`DisplayItem` (hàng của danh sách quan hệ): record cộng `$index`, `$type` (`created` \| `updated` \| `deleted`),
`$edits`.

## 4. Registry (`interfaces/index.ts`, `displays/index.ts`)

`InterfaceConfig` (chép kiểu Directus): `id`, `name`, `icon`, `description?`, `component`, `options` (mảng, hàm,
`{standard, advanced}` hoặc component; chỉ giữ dữ liệu, D-56), `types`, `localTypes?`, `group?`, `relational?`,
`hideLabel?`, `hideLoader?`, `autoKey?`, `recommendedDisplays?`, `system?`, `preview?` (bỏ).

`DisplayConfig`: `id`, `name`, `icon`, `component`, `options`, `types`, `localTypes?`, `fields?` (mảng hoặc hàm
`(options, { collection, field, type }) => string[]`), `handler?(value, options, { interfaceOptions, field,
collection }) => string | null`.

Mặc định theo kiểu: bảng FR-002 (`get-default-interface-for-type`, `get-default-display-for-type`).

## 5. Trạng thái form (`BoForm`)

| Field | Kiểu | Ghi chú |
|-------|------|---------|
| `initialValues` | Record | từ API hoặc mặc định |
| `modelValue` (edits) | Record | chỉ field đã sửa; `emitValue` bỏ khi bằng ban đầu |
| `values` | computed | `{ ...initialValues, ...edits }`, `provide('values')` cho interface quan hệ (filter `{{ }}`) |
| `primaryKey` | string \| number \| `'+'` | `'+'` = tạo mới |
| `validationErrors[]` | `{ collection, field, type, ...ValidationError }` | khớp theo `field` hoặc `fn(field)` |
| `batchMode`, `batchActiveFields[]` | | drawer sửa hàng loạt |
| `rawActiveFields` | Set<string> | trình sửa thô |
| `hasEdits` | computed (expose) | FR-084 |

Props interface nhận từ `FormFieldInterface`: xem `contracts/registry.md`.

## 6. Bộ mẫu (`apps/web/fixtures/interfaces/snapshot/`)

| File | Nội dung | Chuẩn hóa |
|------|----------|-----------|
| `collections.json` | `GET /collections` của `bo_*` | thứ tự theo `collection` |
| `fields.json` | `GET /fields` của `bo_*` | `meta.id` → `null`, thứ tự `collection, meta.sort, field` |
| `relations.json` | `GET /relations` của `bo_*` | `meta.id` → `null` |
| `items.<collection>.json` | item mẫu với `fields=*.*` (quan hệ một cấp) | id → `bo-<n>` theo thứ tự tạo (map ổn định), `date_created`/`date_updated`/`user_*` → `null` |
| `files.json` | `GET /files` trong folder `bo-fixtures` | id ổn định, `filename_disk`, `modified_on` → cố định |
| `permissions.<user>.json` | `GET /permissions/me` của `admin`, `bo-editor` (quyền một phần), `bo-viewer` | |
| `expected.<interface>.json` | giá trị mong đợi mỗi kịch bản sửa (US7-2, SC-002), viết tay từ hành vi Directus | |
| `meta.json` | API đã sinh, thời điểm, phiên bản Directus | |

Collection mẫu (tối thiểu): `bo_std` (mọi interface chuẩn, lựa chọn, slider, tags, code, hash, datetime 4 kiểu, map
6 kiểu, list, color, icon), `bo_groups` (nhóm lồng + 4 presentation + điều kiện + validation), `bo_rel` (m2o, o2m
list/table, m2m, m2a, files, file, file-image, collection-item-*), `bo_tree` (o2m đệ quy), `bo_translations` +
`bo_languages`, `bo_rel_target`, `bo_junction_*`, `bo_m2a_a`, `bo_m2a_b`; mỗi display có ít nhất một field với
`display_options`.

## 7. localStorage

| Khóa | Giá trị | Nguồn Directus |
|------|---------|----------------|
| `backoffice-m2m-column-widths-<collection>-<field>` | `Record<field, px>` | `directus-m2m-column-widths-*` |
| `backoffice-o2m-column-widths-<collection>-<field>` | | `directus-o2m-column-widths-*` |

## 8. Store mở rộng

| Store | Thêm | Nguồn |
|-------|------|-------|
| `fields` | `parseField`, `translateFields`, `getField`, `getFieldsForCollection`, `getPrimaryKeyFieldForCollection`, `getFieldGroupChildren` | `stores/fields.ts` |
| `collections` | `getCollection`, `visibleCollections`, `allCollections`, `translateCollections` | `stores/collections.ts` |
| `relations` | `getRelationsForField`, `getRelationsForCollection`, `getRelationForField` | `stores/relations.ts` |
| `presets` | `getPresetForCollection` (chỉ `layout_query.tabular.fields` dùng ở D-58) | `stores/presets.ts` |
| `flows` (mới) | `hydrate` (`GET /flows`), `getManualFlowsForCollection`, `isActiveFlow` | `stores/flows.ts` (R10) |
