# Contract: registry interface và display

## 1. Props mọi interface nhận (`FormFieldInterface`, chép `form-field-interface.vue`)

| Prop | Kiểu | Nguồn |
|------|------|-------|
| `...field.meta.options` | theo interface | `v-bind`, trước các prop dưới |
| `value` | unknown | `edits[field] ?? schema.default_value ?? null` |
| `disabled`, `nonEditable`, `loading`, `autofocus` | boolean | form |
| `batchMode`, `batchActive`, `comparisonMode`, `comparisonActive`, `comparisonSide` | boolean / string | form (comparison không có UI, D-55) |
| `width` | string | `meta.width ?? 'full'` |
| `type` | string | `field.type` |
| `collection`, `field` | string | |
| `fieldData` | Field | cả field |
| `primaryKey` | string \| number \| `'+'` | |
| `length` | number \| null | `schema.max_length` |
| `direction` | `ltr` \| `rtl` \| undefined | |
| `rawEditorEnabled` | boolean | |
| `version` | ContentVersion \| null | |

Emits: `input(value)` (giá trị mới, theo bảng §3 data-model), `setFieldValue({ field, value })` (đặt field khác
của form; dùng ở `header`? không; giữ cho tương thích). Interface nhóm nhận thêm `fields`, `values`,
`initialValues`, `batchActiveFields`, `validationErrors`, `badge`, `group` và emit `apply(values)`.

Interface không được gọi API ghi ngoài FR-054. Màu từ options/dữ liệu áp bằng `style` (không class).

## 2. Props mọi display nhận (`RenderDisplay`)

`...display_options` (v-bind), `value`, `interface`, `interfaceOptions`, `type`, `collection`, `field`. Null →
`ValueNull`; display không có trong registry → text (`BoTextOverflow`); lỗi vẽ → text.

## 3. Danh sách id (SC-001)

Interface (40): `boolean`, `collection-item-dropdown`, `collection-item-multiple-dropdown`, `datetime`, `file`,
`file-image`, `files`, `group-accordion`, `group-detail`, `group-raw`, `group-tabs`, `input`,
`input-autocomplete-api`, `input-block-editor`, `input-code`, `input-hash`, `input-multiline`,
`input-rich-text-html`, `input-rich-text-md`, `list`, `list-m2a`, `list-m2m`, `list-o2m`, `list-o2m-tree-view`,
`map`, `presentation-divider`, `header`, `presentation-links`, `presentation-notice`, `select-color`,
`select-dropdown`, `select-dropdown-m2o`, `select-icon`, `select-multiple-checkbox`,
`select-multiple-checkbox-tree`, `select-multiple-dropdown`, `select-radio`, `slider`, `tags`, `translations`;
cộng `system-raw-editor`.

Display (18): `boolean`, `collection`, `color`, `datetime`, `file`, `filesize`, `formatted-json-value`,
`formatted-value`, `hash`, `icon`, `image`, `labels`, `mime-type`, `rating`, `raw`, `related-values`,
`translations`, `user`.

Khóa options của từng id: spec FR-020 đến FR-079 (nguồn `directus/app/src/{interfaces,displays}/<id>/index.ts`).
Test `registry.test.ts` so `id`, `types`, `localTypes`, `group`, `relational`, `hideLabel`, `hideLoader`, tên khóa
options (kể cả trong `{standard, advanced}` và hàm với vài `field.type`) với bản đọc trực tiếp từ
`directus/app/src` (test chạy trong repo, đọc file Directus như `sync-translations.test.ts`).

## 4. Mặc định theo kiểu

Như FR-002; `getDefaultInterfaceForType(type)` trả `input` cho kiểu lạ, `getDefaultDisplayForType` trả `raw`.

## 5. Handler (dạng chữ)

`handler(value, options, { interfaceOptions, field, collection })` → `string | null`; có ở `collection`,
`datetime`, `filesize`, `formatted-json-value`, `formatted-value`, `labels`, `mime-type`, `related-values`,
`translations`, `user`. `renderDisplayStringTemplate(collection, template, item)` dùng handler của field lồng.

## 6. `fields` (field cần nạp thêm)

`adjustFieldsForDisplays(fields, collection)` trả danh sách `field.sub` theo `display.fields`; `$thumbnail` bỏ với
`directus_files`; field gốc trùng → alias `getSimpleHash` (`useAliasFields`), đọc lại bằng `getFromAliasedItem`.
