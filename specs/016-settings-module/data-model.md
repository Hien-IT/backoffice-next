# Data model: Module Settings (016)

Kiểu lấy từ `@directus/types` 15.0.3 (`Collection`, `Field`, `Relation`, `Role`, `Policy`, `Permission`, `Preset`,
`Settings`, `Filter`) hoặc chép từ `directus/app/src/modules/settings/routes/data-model/field-detail/store/types.ts`.
Không có DB mới; mọi thứ là trạng thái trình duyệt dựng từ API và ghi qua API.

## 1. Route (FR-001)

| Tên | Path (dưới `/admin/settings`) | Component | Props / guard | Ghi chú |
|-----|-------------------------------|-----------|---------------|---------|
| `settings-data-model-redirect` | `` | redirect `/settings/data-model` | | |
| `settings-project` | `project` | `ProjectRoute` | | |
| `settings-appearance` | `appearance` | `AppearanceRoute` | | |
| `settings-collections` | `data-model` | `CollectionsRoute` | `beforeEnter`: `collectionsStore.hydrate()` (không chờ) | con `+` = `settings-add-new` (named view `add`, `isFloatingView`) → `NewCollection` |
| `settings-fields` | `data-model/:collection` | `FieldsRoute` | `beforeEnter`: không có → `settings-not-found` `{_: path}`; không `meta` → `PATCH /collections/:c {meta:{}}`; `fieldsStore.hydrate()`; props `collection`, `field`, `type` (query) | con `:field` = `settings-fields-field` (named view `field`, `isFloatingView`) → `FieldDetail` |
| `settings-policies-collection` | `policies` | `PoliciesCollectionRoute` | | con `+` = `settings-add-new-policy` (`add`) → `NewPolicy` |
| `settings-policies-item` | `policies/:primaryKey` | `PolicyItemRoute` | `primaryKey` | |
| `settings-roles-collection` | `roles` | `RolesCollectionRoute` | | con `+` = `settings-add-new-role` → `NewRole` |
| `settings-roles-public-item` | `roles/public` | `RolePublicRoute` | khai báo trước `:primaryKey` | |
| `settings-roles-item` | `roles/:primaryKey` | `RoleItemRoute` | `primaryKey` | |
| `settings-presets-collection` | `presets` | `PresetsCollectionRoute` | | |
| `settings-presets-item` | `presets/:id` | `PresetItemRoute` | `id` (`+` = mới) | |
| `settings-flows-collection`, `settings-flows-item` | `flows`, `flows/:primaryKey` | `ModulePlaceholder` (012) | | D-92, 017 |
| `settings-translations-collection` | `translations` | `TranslationsCollectionRoute` | | |
| `settings-translations-item` | `translations/:primaryKey` | `TranslationItemRoute` | `primaryKey` | |
| `settings-not-found` | `:_(.+)+` | `ContentNotFound` (`module="settings"`) | | `ai`, `marketplace/*`, `extensions`, `system-logs` rơi vào đây (D-93) |

`preRegisterCheck`: `user.admin_access === true` (012 giữ).

## 2. Sub-menu (`SettingsNavigation`, FR-003)

| Nhóm | Mục | Icon | `to` / `href` | Điều kiện |
|------|-----|------|---------------|-----------|
| 1 | `settings_data_model` | `database` | `/settings/data-model` | |
| 1 | `settings_flows` | `bolt` | `/settings/flows` | khung 012 (D-92) |
| 2 | `settings_roles` | `group` | `/settings/roles` | |
| 2 | `settings_permissions` | `admin_panel_settings` | `/settings/policies` | |
| 3 | `settings_project` | `tune` | `/settings/project` | |
| 3 | `settings_appearance` | `palette` | `/settings/appearance` | |
| 3 | `settings_presets` | `bookmark` | `/settings/presets` | |
| 3 | `settings_translations` | `translate` | `/settings/translations` | |

Active: `aria-current="page"` theo tiền tố path; `/settings/data-model/...` → Data Model.

## 3. Cây collection (`CollectionsRoute`, FR-010 đến FR-019)

| Trạng thái | Kiểu | Nguồn |
|------------|------|-------|
| `collections` | `Collection[]` | store collections (`GET /collections`, cả hệ thống) |
| `rootCollections` | `Collection[]` | có `meta`, `meta.group` null, không hệ thống; sắp `meta.sort` |
| `children(name)` | `Collection[]` | `meta.group === name` |
| `dbOnly` | `Collection[]` | `meta === null` (bảng chưa quản lý) |
| `systemCollections` | `Collection[]` | `isSystemCollection(collection)`; trong `BoDetail` |
| `search` | `string \| null` | lọc key, cha giữ khi con khớp |
| `collapsed` | `string[]` | localStorage `backoffice-collapsed-collection-ids` (`useExpandCollapse`) |
| `editCollection` | `Collection \| null` | folder đang sửa (hộp) |
| `createFolderActive` | boolean | |

`CollectionItem` props: `collection`, `collections`, `search`, `disableDrag`, `collapsed`; emit `editCollection`,
`setNestedSort(updates)`. `CollectionOptions` props: `collection`, `hasNestedCollections`; menu và hộp xóa (FR-013).
`CollectionDialog` props: `modelValue`, `collection?` (edit); form `{collection, icon:'folder', color, note,
translations:[{language, translation}]}`.

Body kéo thả (`onSort`): `PATCH /collections` `[{collection, meta:{sort: i+1, group: parent|null}}]` cho mọi mục của
danh sách đích; không chờ.

Hộp xóa: `dependencies = relations.filter(r => r.meta?.one_collection === c && r.meta?.many_collection &&
r.meta?.many_field)`; xóa: `DELETE /fields/:many_collection/:many_field` từng cái → `DELETE /collections/:c` →
`hydrate` collections + relations.

Panel: `SnapshotSidebarDetail` → `GET /schema/snapshot` (apiFetch) → `snapshot.json`.

## 4. Drawer tạo collection (`NewCollection`, FR-015)

| Trường | Kiểu | Mặc định |
|--------|------|----------|
| `collectionName` | string (db-safe) | null |
| `singleton` | boolean | false |
| `primaryKeyFieldName` | string | `id` |
| `primaryKeyFieldType` | `auto_int \| auto_big_int \| uuid \| manual` | `auto_int` |
| `systemFields.{status,sort,dateCreated,userCreated,dateUpdated,userUpdated}` | `{enabled: boolean, name: string}` | `false`, tên mặc định `status`, `sort`, `date_created`, `user_created`, `date_updated`, `user_updated` |
| `currentTab` | `collection_setup \| optional_system_fields` | setup |

Body `POST /collections` và `POST /relations` như spec US1-8 (chép `new-collection.vue:106-266`). Sau lưu:
`hydrate` relations, collections, fields → notice `collection_created` → `router.replace` `settings-fields`.

## 5. Màn collection và lưới field (`FieldsRoute`, `FieldsManagement`, FR-020 đến FR-029)

| Trạng thái | Kiểu | Nguồn |
|------------|------|-------|
| `useItem('directus_collections', collection)` | `item`, `edits.meta`, `hasEdits`, `save`, `remove` | `GET /collections/:c`; `PATCH /collections/:c {meta}`; `DELETE /collections/:c` |
| `fields` | `Field[]` | `fieldsStore.getFieldsForCollection(c)`, `orderBy(['meta.sort','meta.id'])`, bỏ `^\$` |
| `lockedFields` | `Field[]` | `meta.system === true` |
| `usableFields` | `Field[]` | còn lại |
| `rootFields` | `Field[]` | `meta.group == null` |
| `groupChildren(field)` | `Field[]` | `meta.group === field` |
| `currentUpdate` | `string` (nanoid) | biến module-level chung cho mọi collection; response chỉ áp khi khớp (spec FR-022) |

`FieldSelect` props: `field`, `fields`, `disabled`; emit `setNestedSort`, `toggleVisibility`, `setWidth`, `duplicate`,
`delete`. Thả: `PATCH /fields/:c` `[{field, meta:{sort: i+1, group}}]`. Menu: `PATCH /fields/:c/:f` `{meta:{hidden}}`,
`{meta:{width}}`. Nhân bản: `POST /fields/:target` (clone bỏ `meta.id|sort|group`, `schema.comment`, `name`; đổi tên
field trong `meta.validation` khi cùng collection). Xóa: `DELETE /fields/:c/:f` → `hydrate` collections. Mở field không
`meta`: `PATCH /fields/:c/:f {meta:{special: getSpecialForType(type)}}`.

Form `directus_collections`: mọi field của `collections.yaml` (xem spec FR-020); `disabled` khi hệ thống.

## 6. Store field (`fieldDetail`, FR-030 đến FR-043)

State (chép `store/types.ts`):

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| `collection` | `string \| undefined` | |
| `editing` | `string` | `'+'` khi mới |
| `field` | `DeepPartial<Field>` | gồm `schema`, `meta` |
| `fieldUpdates` | `DeepPartial<Field>` | chỉ khóa đổi, gửi ở bước 1 của `save()` |
| `relations.m2o`, `relations.o2m` | `DeepPartial<Relation> \| undefined` | |
| `collections.junction`, `collections.related` | `DeepPartial<Collection & {fields}> \| undefined` | sinh khi collection chưa tồn tại |
| `fields.corresponding`, `junctionCurrent`, `junctionRelated`, `sort`, `oneCollectionField` | `DeepPartial<Field> \| undefined` | |
| `items` | `Record<string, Record<string, any>[]>` | seed ngôn ngữ |
| `localType` | `LocalType` | `standard` mặc định |
| `autoGenerateJunctionRelation` | boolean | true |
| `loading`, `saving` | boolean | |

Getters: `missingConfiguration: string[]`, `readyToSave`, `interfacesForType`, `displaysForType`, `generationInfo:
{name, type: 'collection'|'field'}[]`. Actions: `startEditing(collection, field, localType?)`, `update(updates)`
(pipeline spec US3-7), `save()` (sáu bước spec US3-6), `$reset`.

`fieldDetail` không hỏi `unsaved_changes` khi đóng drawer (spec FR-030); field không tồn tại hoặc `?type=` lạ → hộp lỗi rồi về màn collection (D-97).

`LocalType` = `standard | presentation | group | file | files | m2o | o2m | m2m | m2a | translations`.
`getSpecialForType`: json/csv/boolean → `cast-<type>`; uuid/hash/geometry → `[type]`; khác → null.
Junction name: `${a}_${b}`, tiền tố `junction_` khi bắt đầu `directus_`, hậu tố `_1`, `_2`… tới khi không trùng.

Alteration (kết quả, spec FR-032): bảng tóm tắt giá trị sinh

| localType | `relations` | `collections` sinh (khi chưa có) | `fields` sinh | `items` |
|-----------|-------------|----------------------------------|---------------|---------|
| m2o/file | m2o `{collection, field, related_collection, meta:{sort_field:null}, schema:{on_delete:'SET NULL'}}`; file: related `directus_files` | related `{fields:[id integer auto pk hidden], meta:{}, schema:{}}` | corresponding (o2m alias `list-o2m`, chỉ mới) | — |
| o2m | o2m `{related_collection: current, meta:{one_field, sort_field:null, one_deselect_action:'nullify'}, schema:{on_delete:'SET NULL'}}` | related | corresponding (`select-dropdown-m2o` hidden, kiểu PK hiện tại), sort (integer hidden) | — |
| m2m/files | o2m + m2o với `junction_field` chéo, `one_field`; files: m2o related `directus_files`, field `directus_files_id` | junction `{meta:{hidden:true, icon:'import_export'}, schema:{name}, fields:[id]}`, related | junctionCurrent (PK hiện tại), junctionRelated (PK liên quan; fallback integer / uuid), sort (integer), corresponding (m2m `list-m2m`) | — |
| m2a | o2m; m2o `{related_collection:null, schema:null, field:'item', meta:{one_allowed_collections, one_collection_field:'collection'}}` | junction | junctionCurrent, junctionRelated `item` string, oneCollectionField `collection` string, sort | — |
| translations | o2m; m2o related `languages` (hoặc có sẵn), field `<lang>_<pk\|code>` | junction `<c>_translations`; languages `{code string pk, name string, direction string default ltr select-dropdown}` | junctionCurrent, junctionRelated (fallback string) | `languages`: 8 dòng seed |
| standard | — | — | — | — |
| presentation/group | — (schema bỏ, type alias, special) | — | — | — |

## 7. Roles (FR-050 đến FR-054)

| Màn | Dữ liệu | Request |
|-----|---------|---------|
| Danh sách | `roles: (Role & {users:[{count:{id}}], children:[{id,name}]})[]`, hàng Public giả `{id:'public', name: t('public_label'), description: t('public_description'), icon:'public'}`; `search` client | `GET /roles` fetchAll `limit=-1` `fields=id,name,description,icon,users,children.name,children.id` `deep[users]={_aggregate:{count:'id'},_groupBy:['role'],_sort:'role',_limit:-1}` `sort=name` |
| Tạo | `name` | `POST /roles {name}` → `settings-roles-item` |
| Trang | `useItem('directus_roles', pk, null, {deep:{users:{_limit:0}}})`; form `roles.yaml` | `GET /roles/:id?deep[users][_limit]=0`; `PATCH /roles/:id` edits (lồng `policies`, `users` `{create,update,delete}`); `DELETE /roles/:id`; `POST /users/invite {email[], role}` |
| Public | `accessIds: string[]` từ `GET /access?filter={_and:[{role:{_null:true}},{user:{_null:true}}]}&fields=id&limit=-1`; field `policies` clone với `junctionFilter`, `filter $FOLLOW` | song song `POST /access` (create), `PATCH /access` (update), `DELETE /access` (ids) |

## 8. Policies và ma trận (FR-055 đến FR-063)

| Màn | Dữ liệu | Request |
|-----|---------|---------|
| Danh sách | `policies` với `userCount = users[0]?.count.user ?? 0`, `roleCount`; sắp `localeCompare` | `GET /policies` fetchAll `fields=id,name,icon,description,enforce_tfa,ip_access,app_access,admin_access,users,roles` `deep.users={_aggregate:{count:'user'},_groupBy:['policy'],_sort:'policy',_limit:-1}` `deep.roles=…count:'role'…` `sort=name` |
| Nhân bản | `name = "<name> (copy)"` | `GET /permissions?filter={policy:{_eq}}&limit=-1&fields=collection,action,permissions,validation,presets,fields,policy` → `POST /policies {name, icon, description, enforce_tfa, ip_access, app_access, admin_access}` → `POST /permissions [..., policy]` |
| Tạo | `name`, `app_access`, `admin_access` | `POST /policies` → nếu `app_access && !admin_access`: `POST /permissions` mảng `minimal` (JSON R5) với `policy` |
| Trang | `useItem('directus_policies', pk)`; form `policies.yaml` | `GET /policies/:id`; `PATCH /policies/:id` edits (lồng `permissions`, `users`, `roles`); `DELETE /policies/:id` |

`system-permissions` state: `permissions: Permission[]` (server), `localPermissions` (gộp `value` alterations),
`appMinimal` (JSON `minimal` khi `values.app_access`), `rows: {collection, permissions[]}[]` (thường trước, hệ thống
sau), `detail: {collection, action} | null`. Mức: `none` không có; `all` khi `fields` chứa `*` và `permissions`,
`validation` rỗng; `custom` còn lại. Emit `{create: Partial<Permission>[], update: Partial<Permission>[], delete:
string[]} | undefined`. Set all: `{fields:['*'], permissions:null, validation:null, presets:null}` (+ `policy,
collection, action` khi create). Reset: delete mọi permission hệ thống (+ create `recommended` với `policy`).

Drawer chi tiết: `GET /policies/:id?deep[users][_limit]=0` (gộp `values`), `GET /permissions/:id` (khi có); tab theo
action: `item_permissions` (read/update/delete/share), `field_permissions` (create/read/update), `field_validation`
(create/update), `field_presets` (create/update); lưu → `isPermissionEmpty` ? delete : create|update (xếp vào
alterations).

## 9. Settings (FR-070 đến FR-077)

| Màn | Field | Request |
|-----|-------|---------|
| Project | mọi field `settings.yaml` trừ `theming_group`, `ai_group`, `mcp_group` và con; `collaborative_editing_enabled` readonly khi `info.websocket === false` | `PATCH /settings` edits (store `updateSettings`: gộp lạc quan, notice, hoàn tác) → `serverStore.hydrate({isLanguageUpdated})` |
| Appearance | `theming_group`: `project_color`, `project_logo`, `public_foreground`, `public_background`, `public_favicon`, `public_note`, `default_appearance`, `default_theme_light`, `theme_light_overrides`, `default_theme_dark`, `theme_dark_overrides`, `custom_css` | `PATCH /settings` → `serverStore.hydrate()` |
| `system-owner` | `project_owner`, `project_usage`, `org_name`, `product_updates` (SetupForm 012) | `POST /settings/owner` → `settingsStore.hydrate()` |
| `system-modules` | `ModuleBarPart[]` = `[{type:'module', id, enabled, locked?} \| {type:'link', id: nanoid(), name, url, icon, enabled}]`; nguồn `settings.module_bar ?? MODULE_BAR_DEFAULT` + module chưa có (tắt) | — (lưu cùng form) |
| `system-folder` | `string \| null` | `GET /folders` (use-folders) |

## 10. Presets (FR-080 đến FR-084)

| Màn | Dữ liệu | Request |
|-----|---------|---------|
| Danh sách | `use-layout` + `use-preset('directus_presets')`; `systemDefaults.directus_presets` = tabular cột `bookmark`, `collection`, `user`, `role` (200) | #50 danh sách, #51 đếm với `collection=directus_presets`; `DELETE /presets` mảng; `PATCH /presets` (batch); panel `GET /presets?filter[bookmark][_nnull]=true&fields=id&meta=filter_count,total_count` |
| Trình sửa | `preset: Preset`, `edits`; form (ba ô tên, icon, màu dùng cùng interface với `BookmarkAdd`, không dùng component) `name`→`bookmark`, `icon` (`bookmark`), `color`, `collection`, `scope` (`all \| user_<id> \| role_<id>`), `layout` (`tabular`), `search`, `filter`; `layout_query[layout]`, `layout_options[layout]` qua `use-layout` readonly | `GET /presets/:id`; `POST /presets` / `PATCH /presets/:id` chỉ khóa đổi + `{role, user}` theo scope; `DELETE /presets [id]`; `presetsStore.hydrate()`; `GET /roles/:id?fields=id,name`, `GET /users/:id?fields=id,first_name,last_name,email` (system-scope) |

## 11. Translations (FR-085 đến FR-088)

| Màn | Dữ liệu | Request |
|-----|---------|---------|
| Danh sách | `use-layout` + `use-preset('directus_translations')`; cột theo field không ẩn (`key`, `language`, `value`) | #50, #51 với `collection=directus_translations`; `DELETE /translations` mảng; `PATCH /translations` |
| Item | `useItem('directus_translations', pk)`; form `translations.yaml` | `GET /translations/:id`; `POST /translations`; `PATCH /translations/:id`; `DELETE /translations/:id`; sau đó `refreshCurrentLanguage()` (store translations 012: `GET /translations?filter[language]=<lang>&limit=-1` gộp vào i18n) |

## 12. Interface `_system` (FR-042)

Xem bảng ở spec §Key Entities. Props chung của 013 (`value`, `disabled`, `collection`, `field`, `primaryKey`, `width`,
`type`) + options của `index.ts` Directus. Giá trị phát ra:

| Id | Giá trị | Nguồn danh sách |
|----|---------|-----------------|
| `system-collection` | `string \| null` | store collections (lọc alias; `includeSystem`; `includeSingleton`) |
| `system-collections` | `string[]` | store collections `type === 'table'` |
| `system-collections-translations` | — (alias) | store fields/relations của `values.collection`; `POST /utils/translations/generate` |
| `system-display` | `string \| null` | registry displays theo `values[typeField]` |
| `system-display-options` | `Record<string, unknown>` | `ExtensionOptions('display')` |
| `system-display-template` | `string` | `useFieldTree(collection)` lười; `FieldList` |
| `system-field` | `string \| null` | store fields của `collectionName \| values[collectionField]` |
| `system-field-tree` | `string[]` | `useFieldTree`; `BoCheckboxTree` exclusive |
| `system-fields` | `string[]` | `useFieldTree`; `BoSortableList` |
| `system-folder` | `string \| null` | `useFolders` |
| `system-inline-fields` | `DeepPartial<Field>[]` (phẳng `meta.x`/`schema.x` trong form, gộp lại khi phát) | `list` 013 |
| `system-interface` | `string \| null` | registry interfaces không quan hệ, không hệ thống theo type |
| `system-interface-options` | `Record<string, unknown>` | `ExtensionOptions('interface')`, `batchMode` khi `isConditionOptions` |
| `system-manual-flow-select` | `string \| null` | store flows (manual, có collection, `location !== 'collection'`) |
| `system-modules` | `ModuleBarPart[]` | §9 |
| `system-owner` | `string` (chỉ đọc) | settings store; `POST /settings/owner` |
| `system-permissions` | alterations | §8 |
| `system-scope` | `'all' \| 'user_<id>' \| 'role_<id>'` | `DrawerCollection` |

## 13. Dữ liệu tĩnh (R5)

`src/permissions/app-permissions-data.json`: `{ minimal: Permission[] (policy null, system true), recommended:
Permission[] (policy null), actions: ['create','read','update','delete','share'] }`; sinh bằng
`scripts/sync-permissions-data.mjs`; test so nguồn.

## 14. Store mở rộng

| Store | Thêm | Nguồn Directus |
|-------|------|----------------|
| `collections` | `upsertCollection(c, values)`, `updateCollection(c, updates)`, `deleteCollection(c)` | `stores/collections.ts` |
| `fields` | `upsertField(c, f, values)`, `updateField(c, f, updates)`, `updateFields(c, updates[])` (lạc quan, hoàn tác, bộ đếm), `deleteField(c, f)` | `stores/fields.ts` |
| `relations` | `upsertRelation(c, f, values)` | `stores/relations.ts` |
| `settings` | `updateSettings` thêm notice `settings_update_success` và hoàn tác; `setOwner(values)` → `POST /settings/owner` | `stores/settings.ts` |
| `presets` | `systemDefaults.directus_presets` | `stores/presets.ts` |
| `fieldDetail` (mới) | §6 | `field-detail/store` |

## 15. Bộ mẫu Settings (FR-103)

Đã làm ở T019 (2026-10-16), rút gọn so với bản nháp: không thêm collection vào seed, vì cây collection của module Content
và snapshot của 013–015 sẽ đổi theo. Collection, field, folder, bảng không meta mà E2E 016 cần do chính spec tạo với
tiền tố `DATA_PREFIX` và dọn ở `afterAll` (bảng `bo_raw` chỉ ở `proxy-api`, tạo bằng SQL qua `hostDb()`).

| Thực thể | Nội dung (`lib.mjs` `SETTINGS`) |
|----------|---------------------------------|
| Role | `bo-settings-role` (icon `tune`, con của `bo-editor`) |
| Policy | `bo-settings-policy` (`app_access`), gán cho role qua `directus_access` |
| Permission trên `bo_std` | read all; create `input_string`, `select_dropdown` với validation `input_string _nnull` và preset `select_dropdown: a`; update `input_string` với bộ lọc `input_string _nnull` |
| Translation | `bo_hello`: `en-US` "Hello", `vi-VN` "Xin chào" |
| Preset | dùng lại preset và bookmark của 014 (của admin, role `bo-editor`, global) |

Snapshot export: `snapshot/settings.{roles,policies,permissions,access,translations}.json`, ghi sau file của 015 để số
uuid của 013–015 không đổi. Seed qua Directus 8155 và qua API mới 8156 cho cùng năm file (đã kiểm T019).
