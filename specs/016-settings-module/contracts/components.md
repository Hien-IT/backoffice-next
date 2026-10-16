# Contract: component, composable, store và dữ liệu mới của 016

Mọi component `<script setup lang="ts">`, Reka UI, `modelValue`/`update:modelValue`, theo `component-specs.md`; file
chép có header `// Ported from directus/app/src/...` và manifest `tools/port-manifest/016-T*.json`. Đường dẫn Directus
tính từ `directus/app/src/modules/settings/` trừ khi ghi khác.

## 1. Module và sub-menu

| Component / composable | Nguồn Directus | Props / API | Emit | Ghi chú |
|------------------------|----------------|-------------|------|---------|
| `modules/settings.ts` | `index.ts` | route data-model §1 | | flows giữ `ModulePlaceholder` (D-92) |
| `modules/settings/components/SettingsNavigation.vue` | `components/navigation.vue` | — | | 5 nhóm, D-94, D-95; slot `navigation` của `PrivateView` |
| `modules/content/routes/ContentNotFound.vue` (mở rộng) | `routes/not-found.vue` | + `module: 'settings'` | | |

## 2. Data model

| Component / composable | Nguồn Directus | Props / API | Emit | Ghi chú |
|------------------------|----------------|-------------|------|---------|
| `routes/data-model/CollectionsRoute.vue` | `routes/data-model/collections/collections.vue` | — | | `RouterView name="add"`; `BoSortableList group="collections"` |
| `routes/data-model/components/CollectionItem.vue` | `collections/components/CollectionItem.vue` | `collection`, `collections`, `search?`, `disableDrag?`, `collapsed` | `editCollection`, `setNestedSort` | lồng `BoSortableList nested` |
| `routes/data-model/components/CollectionDialog.vue` | `collection-dialog.vue` | `modelValue`, `collection?` | `update:modelValue` | `BoDialog`; key db-safe |
| `routes/data-model/components/CollectionOptions.vue` | `collection-options.vue` | `collection`, `hasNestedCollections?` | `editCollection` | `BoMenu` + hộp xóa với phụ thuộc |
| `routes/data-model/components/SnapshotSidebarDetail.vue` | phần sidebar của `collections.vue` | — | | `SidebarDetail` 014 |
| `routes/data-model/composables/use-expand-collapse.ts` | `composables/use-expand-collapse.ts` | `useExpandCollapse(collections)` → `{collapsed, hasNestedCollections, expandAll, collapseAll, toggle}` | | localStorage `backoffice-collapsed-collection-ids` |
| `routes/data-model/NewCollection.vue` | `new-collection.vue` | — | | `BoDrawer` + `BoTabs vertical`; `use-dialog-route` |
| `routes/data-model/FieldsRoute.vue` | `fields/fields.vue` | `collection`, `field?`, `type?` | | `useItem('directus_collections')`; `RouterView name="field"` |
| `routes/data-model/fields/FieldsManagement.vue` | `fields/components/fields-management.vue` | `collection` | | `BoSortableList group="fields"` với lớp grid |
| `routes/data-model/fields/FieldSelect.vue` | `FieldSelect.vue` | `field`, `fields`, `disabled?` | `setNestedSort`, `toggleVisibility`, `setWidth`, `duplicate`, `delete` | hộp nhân bản và xóa bên trong |
| `routes/data-model/fields/FieldSelectMenu.vue` | `field-select-menu.vue` | `field`, `noDelete?` | `toggleVisibility`, `setWidth`, `duplicate`, `delete` | `BoMenu` |
| `routes/data-model/field-detail/FieldDetail.vue` | `field-detail/field-detail.vue` | `collection`, `field`, `type?` | | `BoDrawer`; chọn simple/advanced |
| `.../simple/{FieldDetailSimple,FieldConfiguration,RelationshipConfiguration}.vue` | `field-detail-simple/*` | `search`; `chosenInterface`; `localType` | `save`, `toggleAdvanced` | lưới thẻ interface |
| `.../advanced/FieldDetailAdvanced.vue`, `Tabs.vue`, `Actions.vue` | `field-detail-advanced/field-detail-advanced{,-tabs,-actions}.vue` | `currentTab` | `save`, `cancel` | `BoTabs vertical` |
| `.../advanced/{Schema,Field,Interface,Display,Validation,Conditions}.vue` | `field-detail-advanced-{schema,field,interface,display,validation,conditions}.vue` | — (store) | | |
| `.../advanced/{Relationship,RelationshipM2o,RelationshipO2m,RelationshipM2m,RelationshipM2a,RelationshipTranslations}.vue` | `field-detail-advanced-relationship*.vue` | — (store) | | |
| `.../shared/ExtensionOptions.vue` | `shared/extension-options.vue` | `type: 'interface'\|'display'`, `extension?`, `showAdvanced?`, `options` (model), `disabled?`, `context?` | `update:options` | `BoForm`; options component (R4) |
| `.../shared/RelatedCollectionSelect.vue` | `shared/related-collection-select.vue` | `modelValue`, `disabled?` | `update:modelValue` | `BoInput` + `BoMenu` `select_existing` |
| `.../shared/RelatedFieldSelect.vue` | `shared/related-field-select.vue` | `modelValue`, `collection`, `disabled?`, `disabledFields?`, `typeAllowList?`, `typeDenyList?`, `nullable?` | `update:modelValue` | |
| `.../field-detail/store/index.ts` (+ `types.ts`, `alterations/*.ts`) | `field-detail/store/*` | Pinia `useFieldDetailStore()`: data-model §6 | | test port `index.test.ts` |
| `.../utils/{collection-exists,field-exists,get-junction-collection-name}.ts` | `utils/*` | | | |
| `interfaces/list/InterfaceListOptions.vue`, `interfaces/map/InterfaceMapOptions.vue` | `interfaces/list/options.vue`, `interfaces/map/options.vue` (từ `directus/app/src`) | `value`, `collection`, `field` | `input` | đăng ký qua `options` của `index.ts` (D-56); display `translations`, `related-values` có options dạng hàm |
| `composables/use-field-tree.ts` (tách) | `composables/use-field-tree.ts` (từ `directus/app/src`) | `useFieldTree(collection, inject?, filter?, strict?)` → `{treeList, loadFieldRelations, refresh}` | | `FieldList.vue` 014 chuyển sang dùng |

## 3. Roles và policies

| Component / composable | Nguồn Directus | Props / API | Emit | Ghi chú |
|------------------------|----------------|-------------|------|---------|
| `routes/roles/RolesCollectionRoute.vue` | `routes/roles/collection.vue` | — | | `BoTable` Q-2; hàng Public giả; `RouterView name="add"` |
| `routes/roles/NewRole.vue`, `use-save.ts` | `add-new.vue`, `use-save.ts` | — | | `BoDialog` |
| `routes/roles/RoleItemRoute.vue` | `item.vue` | `primaryKey` | | `useItem`, `SaveOptions`, `UsersInvite role=` |
| `routes/roles/RolePublicRoute.vue` | `public-item.vue` | — | | ba request `/access` |
| `routes/roles/RoleInfoSidebarDetail.vue` | `role-info-sidebar-detail.vue` | `role` | | |
| `routes/policies/PoliciesCollectionRoute.vue` | `routes/policies/collection.vue` | — | | menu dòng nhân bản |
| `routes/policies/NewPolicy.vue`, `use-save.ts`, `use-duplicate.ts` | cùng tên | — | | minimal từ JSON R5 |
| `routes/policies/PolicyItemRoute.vue`, `PolicyInfoSidebarDetail.vue` | `item.vue`, `policy-info-sidebar-detail.vue` | `primaryKey` | | |
| `interfaces/_system/system-permissions/SystemPermissions.vue` | `interfaces/_system/system-permissions/system-permissions.vue` | props 013 + `primaryKey`, `collection`, `field`, `value` | `input` (alterations) | `inject('values')` |
| `.../PermissionsHeader.vue`, `PermissionsRow.vue`, `PermissionsToggle.vue`, `AddCollection.vue`, `use-collections.ts` | `permissions-header.vue`, `permissions-row.vue`, `permissions-toggle.vue`, `add-collection/{add-collection.vue,use-collections.ts}` | `collection`, `permissions`, `appMinimal`, `disabledActions`; `action`, `permission`, `appMinimal` | `setAll`, `setNone`, `remove`, `openDetail` | chip `BoMenu` |
| `.../detail/{PermissionsDetail,Tabs,Actions,AppMinimal,Permissions,Fields,Validation,Presets}.vue` | `detail/permissions-detail.vue`, `detail/components/*` | `policyKey`, `permission`, `collection`, `action` | `save`, `close` | `BoDrawer` + `BoTabs vertical`; `BoCheckboxTree`; `system-filter`; `input-code` |
| `.../app-permissions.ts` | `directus/app/src/app-permissions.ts` | `appRecommendedPermissions`, `appAccessMinimalPermissions`, `editablePermissionActions`, `disabledActions` từ JSON | | |

## 4. Settings, presets, translations

| Component / composable | Nguồn Directus | Props / API | Emit | Ghi chú |
|------------------------|----------------|-------------|------|---------|
| `routes/project/ProjectRoute.vue` | `routes/project/project.vue` | — | | `BoForm directus_settings` lọc nhóm |
| `routes/appearance/AppearanceRoute.vue` | `routes/appearance/item.vue` | — | | chỉ `theming_group` |
| `routes/presets/PresetsCollectionRoute.vue`, `PresetsInfoSidebarDetail.vue` | `routes/presets/collection/*` | — | | layout wrapper 014 |
| `routes/presets/PresetItemRoute.vue` | `presets/item.vue` | `id` | | form cục bộ; `use-layout` readonly; `BookmarkAdd` ô tên/icon/màu |
| `routes/translations/TranslationsCollectionRoute.vue`, `TranslationItemRoute.vue` | `routes/translations/*` | `primaryKey` | | `refreshCurrentLanguage` |
| `interfaces/_system/system-owner/SystemOwner.vue` | `interfaces/_system/system-owner/*` | props 013 | | `BoDrawer` + `SetupForm` 012; `setOwner` |
| `interfaces/_system/system-modules/{SystemModules,ModuleLinkDrawer}.vue` | `system-modules/*` | props 013 | `input` | `BoSortableList`; `nanoid` |
| `interfaces/_system/system-folder/SystemFolder.vue` | `system-folder/*` | props 013 | `input` | `useFolders` 015 |
| `interfaces/_system/system-scope/SystemScope.vue` | `system-scope/*` | props 013 | `input` | `DrawerCollection` 014 |
| 12 interface còn lại (`system-collection`, `system-collections`, `system-collections-translations`, `system-display`, `system-display-options`, `system-display-template`, `system-field`, `system-field-tree`, `system-fields`, `system-inline-fields`, `system-interface`, `system-interface-options`, `system-manual-flow-select`) | `interfaces/_system/<id>/*` | props 013 + options của `index.ts` | `input` | data-model §12 |

## 5. Store, dữ liệu, script

| Hạng mục | Thêm | Nguồn |
|----------|------|-------|
| `stores/collections.ts` | `upsertCollection`, `updateCollection`, `deleteCollection` | `stores/collections.ts` Directus |
| `stores/fields.ts` | `upsertField`, `updateField`, `updateFields`, `deleteField` | `stores/fields.ts` |
| `stores/relations.ts` | `upsertRelation` | `stores/relations.ts` |
| `stores/settings.ts` | `updateSettings` (notice, hoàn tác), `setOwner` | `stores/settings.ts` |
| `stores/presets.ts` | `systemDefaults.directus_presets` | `stores/presets.ts` |
| `src/permissions/app-permissions-data.json` | sinh | `scripts/sync-permissions-data.mjs` (jiti) |
| `scripts/check-bundle.mjs` | `BUDGET_016`, `LAZY_BUDGETS_016` | |
| `fixtures/interfaces/{seed.mjs,export.mjs}` | `bo_settings` (data-model §15) | |
| `fixtures/interfaces/directus-registry.json` | 18 `_system` (fixture hiện có 9), `preview`; `list`, `map` đã là `optionsKind: component` | `scripts/extract-directus-registry.mjs` |
| `test-utils/fetch.ts` | `mockFixtureApi` #137–#177, mock lồng `PATCH /roles|policies` | |

## 5b. Mở rộng component của 013 và 015 (research R13)

| Component | Thêm | Ghi chú |
|-----------|------|---------|
| `components/BoInput.vue` | prop `dbSafe` | spec FR-007, theo `v-input.vue` |
| `components/BoTabs.vue` | prop `orientation: 'horizontal' \| 'vertical'` | Reka Tabs; mũi tên lên/xuống khi dọc |
| `interfaces/_system/system-theme/index.ts`, `SystemTheme.vue` | option `appearance` | Appearance (FR-071) |
| `interfaces/*/index.ts` (013) | `preview` (chuỗi SVG) | sinh bằng `extract-directus-registry.mjs` (FR-033) |

## 6. E2E helpers (`apps/web-e2e/src/helpers`)

| File | Thêm |
|------|------|
| `allowed-paths.ts` | #137–#177 |
| `settings.ts` (mới) | `openSettings(page, path)`, `dragRow(page, from, to)` (chuột) và `moveRow(page, row, 'up'\|'down'\|'indent'\|'outdent')` (menu D-96), `fieldDrawer(page)`, `permissionChip(page, collection, action)`, `createCollectionViaUi(...)`, `createPolicyViaUi(...)` |
| `db-rows.ts` | `snapshot([...10 bảng])`, chuẩn hóa `id`, `sort`, thời gian |
| `directus-app.ts` | `fillItemForm(page, values)` cho `/admin/content/<c>/+`, `loginAs(context, email, password)` |
| `fixtures.ts` | `seedSettings()`, `cleanupSettings()` |
