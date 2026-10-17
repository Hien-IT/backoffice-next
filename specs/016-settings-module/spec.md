# Feature Specification: Module Settings (data model, quyền, cài đặt dự án, presets, translations như Directus)

**Feature Branch**: `016-settings-module` (làm trên `main` như 012–015, không tạo branch vì dùng chung working tree với
session 015 đang đóng; 016 chỉ sửa `specs/016-*` cho tới khi 015 báo đóng và CI của 015 xanh)
**Created**: 2026-10-16
**Status**: Done (2026-10-17, waves 1–5, owner approvals recorded)
**Input**: User description: "Module Settings cho admin, giống Directus: data model (tạo và sửa collection, field,
relation, sắp xếp và nhóm field, cấu hình interface và display, điều kiện, validation), roles và policies (gán quyền theo
collection, action, field, điều kiện lọc), cài đặt dự án (tên, logo, màu, theme, ngôn ngữ, bản đồ, giới hạn file), presets
và bookmarks, translations, thông tin hệ thống. Tham chiếu directus/app/src/modules/settings. Giao diện theo
design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu
hỏi mở. Tiêu chí chấp nhận: data model và quyền tạo trên app mới dùng được ngay trên Directus. Ghi chú từ 013 (đưa vào
spec 016): làm form options của interface và display (options trong index.ts của 013 giữ sẵn dữ liệu; list và map có
options dạng component, D-56) và các interface _system còn lại (D-57, trừ system-mcp-prompts-collection-validation vì
AI, D-41). Ghi chú từ 014 (đưa vào spec 016): các link của Content đang trỏ khung Settings của 012 (D-71) và phải mở
được màn thật với đúng route: menu bookmark role/global ở cây collection mở /settings/presets/:id
(NavigationBookmark.vue), nút "tạo collection" (admin, chưa có collection) mở /settings/data-model/+
(ContentNavigation.vue, NoCollections.vue), menu chuột phải "sửa collection" mở /settings/data-model/:collection. Chuyển
hướng D-72 của 016: directus_settings → /settings/project, directus_collections → /settings/data-model, directus_roles →
/settings/roles, directus_presets → /settings/presets, directus_translations → /settings/translations, directus_flows →
/settings/flows (utils/get-item-route.ts). Interface _system còn lại (D-57) trừ hai cái 014 đã làm (system-filter,
system-input-translated-string, D-73); màn presets của Settings dùng lại system-filter, layout options và BookmarkAdd
của 014. Ghi chú từ 015 (đưa vào spec 016): menu "sửa role" của cây role ở module Users (admin, chuột phải và nút dòng)
trỏ /settings/roles/:id (D-85, modules/users/components/UsersNavigation.vue), phải mở màn role thật. Sáu interface
_system của màn user đã có (system-language, system-input-password, system-token, system-mfa-setup, system-theme,
system-theme-overrides); 016 làm phần còn lại của D-57. Màn cài đặt dự án dùng lại system-theme và
system-theme-overrides (dữ liệu theme tĩnh apps/web/src/theme/theme-presets.json, sinh bằng web:sync-themes)."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/app/src` trừ khi ghi khác):

- Module: `modules/settings/index.ts` (route `settings-data-model-redirect` (`''` → `/settings/data-model`),
  `settings-project`, `settings-appearance`, `data-model` (`settings-collections` + con `+` = `settings-add-new` nổi,
  `settings-fields` `:collection` + con `:field` = `settings-fields-field` nổi, guard `beforeEnter` nạp store và
  `PATCH /collections/:c {meta:{}}` cho bảng chưa quản lý), `policies` (`settings-policies-collection` + `+`,
  `settings-policies-item`), `roles` (`settings-roles-collection` + `+`, `settings-roles-public-item` (`public`),
  `settings-roles-item`), `presets` (`settings-presets-collection`, `settings-presets-item` `:id`), `translations`
  (`settings-translations-collection`, `settings-translations-item`), `settings-not-found` (`:_(.+)+`);
  `preRegisterCheck` = `admin_access`), `components/navigation.vue` (năm nhóm mục có vạch chia, dòng phiên bản),
  `routes/not-found.vue`.
- Data model: `routes/data-model/collections/collections.vue`, `components/CollectionItem.vue`,
  `collection-dialog.vue` (tạo và sửa folder), `collection-options.vue` (menu), `composables/use-expand-collapse.ts`
  (localStorage `collapsed-collection-ids`), `new-collection.vue` (drawer hai bước), `fields/fields.vue`,
  `fields/components/fields-management.vue`, `FieldSelect.vue`, `field-select-menu.vue`,
  `field-detail/field-detail.vue`, `field-detail-simple/*`, `field-detail-advanced/*` (tab schema, field,
  relationship, interface, display, validation, conditions), `shared/*`, `store/index.ts` (`startEditing`, `update`,
  `save`, `readyToSave`, `generationInfo`), `store/alterations/*` (standard, presentation, group, file, files, m2o,
  o2m, m2m, m2a, translations), `utils/get-junction-collection-name.ts`, `collection-exists.ts`, `field-exists.ts`;
  `stores/collections.ts`, `stores/fields.ts`, `stores/relations.ts`; field hệ thống
  `directus/packages/system-data/src/fields/collections.yaml`.
- Roles và policies: `routes/roles/collection.vue`, `add-new.vue`, `item.vue`, `public-item.vue`,
  `role-info-sidebar-detail.vue`, `use-save.ts`; `routes/policies/collection.vue`, `add-new.vue`, `item.vue`,
  `policy-info-sidebar-detail.vue`, `use-save.ts`, `use-duplicate.ts`; `interfaces/_system/system-permissions/*` (ma
  trận quyền, `permissions-header.vue`, `permissions-row.vue`, `permissions-toggle.vue`, `add-collection/*`,
  `detail/permissions-detail.vue`, `detail/components/*`), `directus/app/src/app-permissions.ts`, dữ liệu
  `directus/api/src/permissions/...app-access-permissions.yaml`, `schema-access-permissions.yaml`
  (`appAccessMinimalPermissions`); field hệ thống `roles.yaml`, `policies.yaml`, `access.yaml`.
- Cài đặt dự án: `routes/project/project.vue` (form `directus_settings` trừ `theming_group`, `ai_group`, `mcp_group`),
  `routes/appearance/item.vue` (chỉ `theming_group`), `stores/settings.ts` (`updateSettings`, `setOwner`),
  `interfaces/_system/system-owner`, `system-modules`, `system-folder`; field hệ thống `settings.yaml`;
  `constants.ts` (`MODULE_BAR_DEFAULT`).
- Presets và translations: `routes/presets/collection/collection.vue`, `components/presets-info-sidebar-detail.vue`,
  `presets/item.vue`, `interfaces/_system/system-scope`; `routes/translations/collection.vue`, `item.vue`,
  `lang/refresh-current-language.ts` (`refreshCurrentLanguage`); field hệ thống `presets.yaml`, `translations.yaml`;
  `stores/presets.ts` (`systemDefaults` của `directus_presets`).
- Interface hệ thống còn lại (`interfaces/_system`): `system-collection`, `system-collections`,
  `system-collections-translations`, `system-display`, `system-display-options`, `system-display-template`,
  `system-field`, `system-field-tree`, `system-fields`, `system-folder`, `system-inline-fields`, `system-interface`,
  `system-interface-options`, `system-manual-flow-select`, `system-modules`, `system-owner`, `system-permissions`,
  `system-scope`; `composables/use-field-tree.ts`; form options dạng component `interfaces/list/options.vue`,
  `interfaces/map/options.vue` (display `translations`, `related-values` có options dạng hàm, không có `options.vue`);
  `modules/settings/routes/data-model/field-detail/shared/extension-options.vue`.

**Dùng lại từ 012–015** (không viết lại): khung app, `PrivateView`, `PageHeader`, `DetailPanel`, `AppSidebar`
sub-menu, store user/settings/server/permissions/presets/fields/collections/relations/translations/flows (012); `BoForm`
(v-form, điều kiện, validation, menu field), toàn bộ interface và display của 013 cùng `options` trong `index.ts`,
`BoDrawer`, `BoDialog`, `BoTable`, `BoMenu`, `BoTabs`, `BoSortableList` (menu dòng Lên/Xuống, D-60, D-69),
`BoCheckboxTree`, `BoIconPicker`, `BoColorPicker`, `BoEditorFrame`, `system-raw-editor`, `DrawerCollection`, `DrawerItem`,
`DrawerBatch` (013); năm layout và `use-layout`, `use-items`, `use-preset`, `SearchInput` + `system-filter`, `FieldList`,
`system-input-translated-string`, `BookmarkAdd` (tên, icon, màu), `components/sidebar/*` (Layout, Export, Revisions,
Comments, Refresh), `use-item`, `use-edits-guard`, `SaveOptions`, `use-dialog-route`, `use-tree-keyboard`,
`get-item-route`, `ContentNotFound` (014); `use-folders`, `FolderPicker`, `system-language`, `system-theme`,
`system-theme-overrides` với `theme/theme-presets.json`, `UsersInvite` (015); `SetupForm` của `/setup` (012, D-53).

## User Scenarios & Testing *(mandatory)*

Người dùng là admin (`admin_access`) đang quản trị Directus app trên cùng DB, nay làm cùng việc trên app Backoffice:
tạo và sửa collection, field, relation; sắp xếp và nhóm field; cấu hình interface, display, điều kiện, validation; tạo
role và policy, gán quyền theo collection, action, field và bộ lọc; sửa cài đặt dự án và giao diện; quản lý preset và
bookmark toàn cục hoặc theo role; sửa chuỗi dịch tùy chỉnh; xem thông tin hệ thống. Collection, field, relation,
permission, role, policy, preset, translation và settings ghi ở app này dùng được ngay ở app kia.

Phạm vi: mọi route của module Settings mà Directus 11.17.4 có khi tắt WebSocket, AI, Marketplace và extension:
`/settings` (→ `/settings/data-model`), `/settings/data-model`, `/settings/data-model/+`,
`/settings/data-model/:collection`, `/settings/data-model/:collection/:field` (`+` = field mới, `?type=` = chế độ nâng
cao), `/settings/roles`, `/settings/roles/+`, `/settings/roles/public`, `/settings/roles/:primaryKey`,
`/settings/policies`, `/settings/policies/+`, `/settings/policies/:primaryKey`, `/settings/project`,
`/settings/appearance`, `/settings/presets`, `/settings/presets/:id`, `/settings/translations`,
`/settings/translations/:primaryKey`, màn không tìm thấy; thay khung D-40 của 012 cho module Settings và đích chuyển
hướng D-72 của 014 (`directus_settings`, `directus_collections`, `directus_roles`, `directus_presets`,
`directus_translations`); đích thật cho D-71 (014) và D-85 (015); 18 interface `_system` còn lại của D-57; form options
của interface và display (D-56); E2E ba cấu hình và bộ so payload. Ngoài phạm vi: `/settings/flows` và
`/settings/flows/:id` (017; mục sub-menu "Flows" vẫn có và trỏ khung 012 cho tới 017, D-92), `/settings/ai`, `ai_group`,
`mcp_group`, `system-mcp-prompts-collection-validation` (AI, XI, D-41), `/settings/marketplace/*`,
`/settings/extensions` (XI, D-41, D-93), `/settings/system-logs` (WebSocket, XI; Directus cũng ẩn khi
`info.websocket.logs` tắt), gửi email (X), snackbar (D-66, 018), chỉ báo collab (D-68). Hai mục của mô tả feature được
thu hẹp theo Directus 11.17.4: "thông tin hệ thống" là dòng phiên bản cuối sub-menu, app mới bỏ (D-95), và mục tải snapshot schema
(Directus không có màn thông tin hệ thống riêng; system logs ngoài phạm vi, D-93); "giới hạn file" là nhóm
`files_and_thumbnails` (`storage_asset_transform`, `storage_asset_presets`, `storage_default_folder`), còn giới hạn dung
lượng tải lên là biến môi trường `FILES_MAX_UPLOAD_SIZE` (VIII), không có trong settings.

### User Story 1 - Data model: danh sách collection, tạo collection, tạo folder (Priority: P1)

Admin vào Settings, thấy danh sách collection dạng cây (nhóm theo folder, kéo thả sắp xếp và lồng nhóm, collection ẩn
mờ đi, mục "bảng chưa quản lý" và mục "collection hệ thống"), tạo collection mới qua drawer hai bước (tên, khóa chính,
singleton; field hệ thống tùy chọn), tạo folder, ẩn/hiện, đặt trạng thái gập mở mặc định, xóa collection kèm cảnh báo
field phụ thuộc, tải snapshot schema.

**Why this priority**: Là màn mở đầu của module và điểm vào của tiêu chí chấp nhận (collection tạo ở app mới dùng được
trên Directus).

**Independent Test**: E2E trên bộ mẫu `bo_settings` (6 collection trong 2 folder lồng, 1 collection ẩn, 1 bảng không có
meta tạo bằng SQL, 1 collection có o2m trỏ tới collection khác): mở `/settings/data-model`, so cây, menu, trạng thái với
Directus app; tạo collection `bo_articles` với khóa `uuid`, `status`, `sort`, `date_created`, `user_created` qua app mới
rồi mở `/admin/content/bo_articles` trên Directus app (8155) và tạo một item; so dòng `directus_collections`,
`directus_fields`, `directus_relations` với cùng thao tác trên Directus app (bộ so DB `db-rows`).

**Acceptance Scenarios**:

1. **Given** admin, **When** mở `/settings`, **Then** chuyển tới `/settings/data-model`; sub-menu của module Settings
   trong sidebar là ba nhóm có vạch chia như `navigation.vue` trừ mục ngoài phạm vi: (Data Model `database`, Flows
   `bolt` → khung 012 tới 017), (Roles `group`, Access Policies `admin_panel_settings`), (Project `tune`, Appearance
   `palette`, Bookmarks/Presets `bookmark`, Translations `translate`); không có nhóm Report Bug, Request Feature (D-94),
   không có dòng phiên bản ở cuối (D-95); người không `admin_access` không thấy module (như
   `preRegisterCheck` 012) và route trả màn không có quyền của 012.
2. **Given** `/settings/data-model` với bộ mẫu, **When** mở, **Then** page header tiêu đề `settings_data_model`, icon
   `database`, breadcrumb Settings, ô tìm kiếm `search_collection` (autofocus khi hơn 25 collection không hệ thống), nút
   tạo folder (`create_new_folder`), nút tạo collection (`add` → `/settings/data-model/+`); cây: mục gốc là collection
   có `meta` và không `meta.group`, con là collection có `meta.group` bằng tên cha; mỗi mục có tay kéo, icon theo
   `meta.icon` và `meta.color` (icon `visibility_off` mờ khi `hidden`), tên collection (khớp tìm kiếm được tô), `note`,
   nút gập mở khi có con (`unfold_less`/`unfold_more`), menu; thanh "expand all/none" chỉ khi có collection trong nhóm;
   trạng thái gập lưu localStorage `backoffice-collapsed-collection-ids` (D-39); bấm collection có `schema` tới
   `/settings/data-model/:collection`, bấm folder (không `schema`) mở hộp sửa folder.
3. **Given** bảng `bo_raw` tạo bằng SQL không có dòng `directus_collections`, **When** nhìn danh sách, **Then** mục
   "bảng chưa quản lý" liệt kê nó với icon `add` và `dns`, tooltip `db_only_click_to_configure`; bấm thì route
   `settings-fields` gửi `PATCH /collections/bo_raw {meta:{}}` trước khi mở; menu của mục này có xóa (DROP bảng qua
   `DELETE /collections/bo_raw`); mục "collection hệ thống" là `BoDetail` gập liệt kê mọi `directus_*` với icon
   `settings`, không kéo, không menu. Hộp xóa của bảng chưa quản lý giống hộp xóa collection
   (`delete_collection_are_you_sure`, không cảnh báo thêm, như Directus); xóa là xóa bảng thật cùng dữ liệu.
4. **Given** kéo collection C vào trong folder F rồi thả, **When** thả, **Then** app cập nhật store ngay rồi gửi
   `PATCH /collections` với mảng `[{collection, meta:{sort: i+1, group}}]` cho mọi mục của danh sách đích (gốc: `group`
   null) như `onSort`; đường bàn phím tương đương (menu dòng Lên/Xuống/Vào nhóm/Ra nhóm, D-96) gửi cùng body.
5. **Given** menu của collection (không hệ thống), **When** mở, **Then** có: mở nội dung (`goto_collection_content`, chỉ
   khi có `schema`), ẩn/hiện (`make_collection_hidden|visible` hoặc `make_folder_*` → `PATCH /collections/:c
   {meta:{hidden}}` rồi nạp lại và notice `update_collection_success`), ba lựa chọn gập mở `start_open|start_collapsed|
   always_open` (`meta.collapse` = `open|closed|locked`, chỉ với folder hoặc mục có con, mục hiện tại đánh dấu), xóa
   (danger). Hộp xóa: tiêu đề `delete_collection_are_you_sure` hoặc `delete_folder_are_you_sure`, notice danger
   `delete_collection_peer_dependencies` liệt kê "field (collection)" của mọi relation có `one_collection` là nó (bỏ
   a2o); xác nhận → `DELETE /fields/:dep/:field` từng field phụ thuộc, `DELETE /collections/:c`, nạp lại collections và
   relations, notice `delete_collection_success`. Xóa folder có con: API đặt `meta.group` của con về null (con về gốc),
   hộp không cảnh báo thêm, như Directus.
6. **Given** nút tạo folder, **When** nhập key (db-safe, khóa khi sửa), icon (mặc định `folder`), màu, note, bản dịch
   tên (list `language` + `translation`) và lưu, **Then** `POST /collections {collection, meta:{…}}` không `schema`
   (folder = collection alias); sửa folder → `PATCH /collections/:c {meta}`; Esc hủy, Enter lưu; form đặt lại mỗi lần
   mở.
7. **Given** `/settings/data-model/+`, **When** mở, **Then** drawer `creating_new_collection` hai tab dọc
   (`collection_setup`, `optional_system_fields` khóa khi chưa có tên): bước 1 notice `creating_collection_info`, tên
   (monospace, db-safe, autofocus, placeholder `a_unique_table_name`, note `collection_names_are_case_sensitive`),
   `singleton`, vạch chia, tên khóa chính (mặc định `id`), kiểu `auto_increment_integer` (mặc định) |
   `auto_increment_big_integer` | `generated_uuid` | `manual_string`; nút "next" (khóa khi trống); bước 2 notice
   `creating_collection_system`, sáu field tùy chọn `status`, `sort` (khóa khi singleton), `date_created`,
   `user_created`, `date_updated`, `user_updated` mỗi cái có ô bật và ô tên (focus ô tên thì bật); nút "finish"; Enter ở
   bước 1 sang bước 2, ở bước 2 lưu.
8. **Given** bấm finish, **When** lưu, **Then** `POST /collections` với `{collection, schema:{}, fields:[pk, …], meta:
   {sort_field, archive_field, archive_value, unarchive_value, singleton}}` đúng từng khóa như `new-collection.vue`
   (pk uuid: `special ['uuid']`, `length 36`, hidden, readonly; manual: string 255; auto: `integer|bigInteger`
   `has_auto_increment`; `status`: select-dropdown ba lựa chọn published/draft/archived với màu và display `labels`
   `showAsDot`, `default_value 'draft'`, `is_nullable false`, đặt `archive_field/value/unarchive_value`; `sort`: integer
   ẩn, đặt `sort_field`; `user_*`: uuid `special user-created|user-updated`, `select-dropdown-m2o` template
   `{{avatar}} {{first_name}} {{last_name}}`, display `user`; `date_*`: timestamp `special date-created|date-updated`,
   `datetime`, display `datetime {relative:true}`; thứ tự status, sort, user_created, date_created, user_updated,
   date_updated); rồi `POST /relations {collection, field, related_collection:'directus_users', schema:{}}` cho mỗi
   `user_*` (song song); nạp lại ba store; notice `collection_created`; `router.replace` tới màn collection mới.
9. **Given** panel của `/settings/data-model`, **When** mở, **Then** có mục `snapshot.export` (icon `download`, nội dung
   `snapshot.info`) với nút `snapshot.download` gọi `GET /schema/snapshot` và lưu `snapshot.json`.
10. **Given** không có collection nào có `meta`, **When** mở, **Then** trạng thái trống `no_collections` /
    `no_collections_copy_admin` với nút `create_collection`; nút "tạo collection" của module Content
    (`ContentNavigation`, `NoCollections` của 014) tới `/settings/data-model/+` mở drawer thật (D-71 gỡ).

---

### User Story 2 - Màn collection: danh sách field, sắp xếp, nhóm, bề rộng, form cài đặt collection (Priority: P1)

Admin mở một collection, thấy lưới field theo bề rộng (half/full/fill) với tay kéo, field khóa (hệ thống), nhóm lồng
(group), icon khóa chính, ẩn, chưa có meta, link sang collection liên quan; menu từng field (sửa, nhân bản, ẩn/hiện,
bề rộng, xóa); nút tạo field (chế độ đơn giản) và menu tạo nâng cao theo loại; bên dưới là form cài đặt collection
(`directus_collections`) lưu bằng nút save.

**Why this priority**: Là màn làm việc chính của data model; sắp xếp và nhóm field là yêu cầu nêu rõ.

**Independent Test**: E2E: mở `/settings/data-model/bo_articles`, kéo field vào group và đổi vị trí, đổi bề rộng, ẩn
field, nhân bản field sang collection khác, xóa field, sửa `display_template`, `archive_field`, `sort_field`,
`accountability`, `item_duplication_fields`, bật translations qua `translations_enable_helper`; so body
`PATCH /fields/:c`, `PATCH /fields/:c/:f`, `POST /fields/:c`, `DELETE /fields/:c/:f`, `PATCH /collections/:c`,
`POST /utils/translations/generate` với Directus app; so dòng `directus_fields` và thứ tự field hiện trên form item của
Directus app.

**Acceptance Scenarios**:

1. **Given** `/settings/data-model/bo_articles`, **When** mở, **Then** page header tiêu đề `formatTitle(collection)`,
   nút quay lại `/settings/data-model`, breadcrumb `settings_data_model`, nút xóa collection (ẩn với collection hệ
   thống; khóa khi chưa nạp; hộp `delete_are_you_sure` → `DELETE /collections/:c`, nạp lại, về danh sách), nút lưu
   (khóa khi `edits.meta` trống; `PATCH /collections/:c {meta:{khóa đã sửa}}` rồi về danh sách); Ctrl/Cmd+S lưu và ở
   lại; hộp `unsaved_changes` (Keep Editing trước, D-76); nội dung: tiêu đề `fields_and_layout` với badge
   `saves_automatically`, lưới field, rồi `BoForm` `directus_collections` theo `collections.yaml` (vạch chia, `collection`
   chỉ đọc, `note`, `icon`, `color`, `display_template` (`system-display-template`), `hidden`, `singleton`,
   `translations`, `translations_enable_helper` (`system-collections-translations`), `preview_url`, `versioning`,
   `archive_field` (`system-field` `allowNone`), `archive_app_filter`, `archive_value`, `unarchive_value`,
   `sort_field` (`system-field` kiểu số, không khóa chính, không khóa ngoại), `accountability`
   (`all|activity|null`), `item_duplication_fields` (`system-field-tree`)); form khóa với collection hệ thống; `sort`,
   `group`, `collapse` ẩn.
2. **Given** lưới field, **When** nhìn, **Then** field sắp theo `meta.sort` rồi `meta.id`, bỏ field bắt đầu bằng `$`;
   field `meta.system` đứng đầu, khóa (icon ổ khóa, tooltip `system_fields_locked`), không kéo, không menu; field không
   nhóm trong lưới kéo thả gốc; field group là khung lồng có tiêu đề (tay kéo, tên, dấu sao khi `required`,
   `visibility_off` khi `hidden`, menu với xóa khóa khi có con); dòng field là ô chỉ đọc: tay kéo, tên (+ sao), tên
   interface hoặc `db_only_click_to_configure` khi không có `meta`, tooltip "tên (kiểu) - interface", icon `vpn_key`
   (khóa chính), `report_problem` (không meta), `visibility_off` (ẩn), `open_in_new` tới collection liên quan (chỉ
   translations, m2o, m2m, o2m, files và khi khác collection hiện tại); bề rộng theo `meta.width` `half|full|fill`
   (mặc định full); bấm tên mở field; field không `meta` thì `PATCH /fields/:c/:f {meta:{special:
   getSpecialForType(type)}}` trước (json/csv/boolean → `cast-<type>`, uuid/hash/geometry → `[type]`, còn lại null).
3. **Given** kéo field vào group G ở vị trí 2, **When** thả, **Then** `PATCH /fields/:c` với mảng
   `[{field, meta:{sort: i+1, group: 'G'}}]` của mọi field trong danh sách đích (gốc: `group` null), cập nhật lạc quan,
   lỗi thì hoàn tác và hộp lỗi; chỉ áp kết quả của request mới nhất; đường bàn phím Lên/Xuống/Vào nhóm/Ra nhóm (D-96)
   gửi cùng body.
4. **Given** menu của field, **When** mở, **Then** `edit_field`, `duplicate_field` (chỉ localType standard, không khóa
   chính), `hide_field_on_detail|show_field_on_detail` (`PATCH {meta:{hidden}}`), vạch chia, `half_width|full_width|
   fill_width` (khóa ở giá trị hiện tại và với group), vạch chia, `delete_field` danger (khóa với khóa chính và group có
   con); không có mục "bắt buộc" (Directus không có).
5. **Given** nhân bản field, **When** chọn collection đích (`system-collection`, mặc định hiện tại) và tên (mặc định
   `<field>_copy`), **Then** `POST /fields/:đích` với bản sao bỏ `meta.id`, `meta.sort`, `meta.group`,
   `schema.comment`, `name`, đổi tên field trong khóa `validation` cùng collection; notice `field_create_success`.
6. **Given** xóa field, **When** xác nhận `delete_field_are_you_sure`, **Then** `DELETE /fields/:c/:f`, nạp lại
   collections, gỡ field và relation ở store ngay (hoàn tác khi lỗi).
7. **Given** nút `create_field` và menu `create_in_advanced_field_creation_mode`, **When** bấm, **Then** tới
   `/settings/data-model/:c/+` (đơn giản) hoặc `+?type=<standard|presentation|group|file|files|m2o|o2m|m2m|m2a|
   translations>` (nâng cao) với ba vạch chia như `fields-management.vue`.
8. **Given** collection chưa có translations và có field string/text, **When** bấm `enable_translations` của
   `translations_enable_helper`, **Then** drawer chọn field, collection translations, collection ngôn ngữ, hai khóa
   ngoại, `createLanguagesCollection`, `seedLanguages`; lưu → `POST /utils/translations/generate` với body như Directus
   rồi nạp lại ba store; đã có translations → notice success và nút `add_fields` (chế độ manage); collection hệ thống →
   không hiện.
9. **Given** collection hệ thống `directus_users`, **When** thêm field người dùng `bo_note` (input) qua drawer, **Then**
   `POST /fields/directus_users` như Directus (II cho phép cột người dùng trong collection hệ thống), form collection
   vẫn khóa, field mới hiện ở form user của 015; E2E dọn field ở `afterAll`.

---

### User Story 3 - Drawer field: chế độ đơn giản và nâng cao, relation, interface và display options, điều kiện, validation (Priority: P1)

Admin tạo field mới bằng cách chọn interface từ lưới thẻ (nhóm text & numbers, selection, relational, presentation,
groups, other; có tìm kiếm), nhập key, kiểu, mặc định, bắt buộc, collection liên quan; hoặc chuyển sang chế độ nâng cao
với tab dọc Schema, Relationship (khi quan hệ), Field, Interface, Display, Validation, Conditions; app sinh collection
junction, collection ngôn ngữ, field tương ứng và relation như Directus; lưu gửi đúng chuỗi request.

**Why this priority**: Chứa D-56 (form options) và phần lớn D-57; là tiêu chí "data model tạo trên app mới dùng được
ngay trên Directus".

**Independent Test**: Test component cho store field (port `store/index.test.ts` của Directus: `update`, `readyToSave`,
`generationInfo`, 10 alteration) và cho 18 interface `_system` với mock API (request allowlist như 013); E2E: tạo trên
app mới các field `title` (input, required), `body` (rich text, options), `tags` (tags, csv), `author` (m2o
`directus_users` với field tương ứng), `comments` (o2m sinh `bo_comments`), `categories` (m2m sinh junction),
`attachments` (files), `blocks` (m2a tới `bo_categories` và `bo_s_tags`), `translations` (sinh collection `languages` có
seed), `group_seo` (group) với điều kiện và validation (sinh 7 collection: `bo_comments`, `bo_categories`,
`bo_articles_bo_categories`, `bo_articles_files`, `bo_articles_blocks`, `bo_articles_translations`, `languages`); mở
`/admin/content/bo_articles/+` trên Directus app và tạo item điền đủ field theo bảng giá trị của `contracts/tests.md`
§5; so `directus_fields`, `directus_relations`, `directus_collections`, item của `languages` với cùng thao tác trên
Directus app (bộ so DB).

**Acceptance Scenarios**:

1. **Given** `/settings/data-model/bo_articles/+`, **When** mở, **Then** drawer `creating_new_field {collection}` (đổi
   thành `field_in_collection` khi có tên), chế độ đơn giản: ô tìm kiếm `search_field` autofocus ở header; lưới thẻ
   interface không hệ thống theo `group` và `order` (preview SVG hoặc icon, tên), thẻ không chọn mờ đi; cột 1/2/3/4
   theo bề ngang cửa sổ 400/600/840 px; bấm thẻ mở khung cấu hình ngay dưới hàng thẻ: `key` (required, db-safe,
   autofocus; interface có `autoKey` thì key tự `<suffix>-<nanoid6>` và không hiện ô), `type` (chọn trong `types` của
   interface; khóa khi chỉ một kiểu hoặc localType khác standard), `default_value` (ô bật với boolean, ô nhập
   placeholder NULL), `required`, khối quan hệ theo localType (`related_collection` cho m2o/m2m; + `foreign_key` cho
   o2m; `languages_collection` cho translations; `related_collections` nhiều lựa chọn cho m2a, singleton khóa), rồi
   options `standard` của interface; nút `save` (khóa khi `readyToSave` sai) và link
   `continue_in_advanced_field_creation_mode`.
2. **Given** chế độ nâng cao (field có sẵn, `?type=`, hoặc bấm link), **When** mở, **Then** tab dọc `schema`, (`relationship`
   hoặc `translations` ở vị trí 2 với o2m/m2o/m2m/m2a/files/file/translations), `field`, `interface_label`, `display`
   (trừ presentation và group), `validation`, `conditions`; nút lưu ở header (khóa khi chưa đủ, loading khi lưu); tab
   Schema: `key` (khóa khi field có sẵn, note `schema_setup_key`), `type` (`alias` khóa với field không schema; danh sách
   kiểu theo nhóm như Directus gồm geometry con; khóa khi localType khác standard hoặc field có sẵn; placeholder
   `determined_by_relationship` với m2o), `length` (string mới), `precision_scale` (decimal/float), `on_create`/
   `on_update` (uuid và kiểu thời gian, không với file; ghi vào `meta.special`, rỗng → null), `default_value` theo kiểu
   (ẩn với alias, khóa chính, generated), `nullable`, `unique`, `index` (khóa với generated và khóa chính); tab Field:
   `readonly`, `required` (+ cảnh báo khi cả hai), `hidden`, `searchable` (standard kiểu tìm được), `note`
   (`system-input-translated-string`), `field_name_translations`; không sửa `width` ở đây.
3. **Given** tab Interface, **When** mở, **Then** danh sách `interfacesForType` với mục gợi ý (sao) trước, vạch chia khi
   ≥ 5, interface không hợp lệ → notice `interface_not_found` + `reset_interface`; options vẽ bằng `ExtensionOptions`:
   `options` dạng mảng, dạng `{standard, advanced}`, dạng hàm nhận ngữ cảnh store (field, collection, relations…), hoặc
   component riêng của `list`, `map` (D-56 gỡ) vào `meta.options`; `no_options_available` khi trống; tab Display tương
   tự với `recommendedDisplays` + `raw`, `formatted-value`, `display_not_found` + `reset_display`, component riêng của
   `meta.display_options` (`translations`, `related-values` dùng options dạng hàm như mọi display).
4. **Given** tab Validation và Conditions, **When** sửa, **Then** validation = `system-filter`
   `{collectionName, fieldName, includeFunctions, includeValidation}` + `custom_validation_message`
   (`validation_message`), notice `configure_field_key_to_continue` khi chưa có key; conditions = `list` template
   `{{ name }}` với `name`, `rule` (`system-filter` `includeRelations:false`, `injectVersionField`), `readonly`,
   `required`, `hidden`, `clear_hidden_value_on_save` (chỉ khi hidden), `options` (`system-interface-options` chế độ
   batch với interface hiện tại); giá trị ghi ra bằng Directus app.
5. **Given** tab Relationship của m2m với collection liên quan `bo_categories` chưa tồn tại, **When** gõ tên, **Then**
   `auto_fill` bật: junction `bo_articles_bo_categories` (quy tắc `get-junction-collection-name`: `${a}_${b}`, tiền tố
   `junction_` khi bắt đầu `directus_`, hậu tố `_1`, `_2`… khi trùng), hai khóa ngoại `bo_articles_id`,
   `bo_categories_id`, ô `corresponding_field` (`add_m2m_to_collection`), `sort_field`, trigger
   (`one_deselect_action` nullify|delete, `on_delete` hai phía); notice `new_data_alert` liệt kê collection và field sẽ
   tạo; tương tự m2o (`add_o2m_to_collection`, `on_delete` SET NULL|SET DEFAULT|CASCADE|NO ACTION, tự quan hệ → NO
   ACTION, `is_nullable false` → NO ACTION), o2m (`sort_field` kiểu số, `one_deselect_action`), files (junction
   `<c>_files`, `directus_files_id`), m2a (`related_collections`, `collection_key` `collection`, field `item` string),
   translations (junction `<c>_translations`, ngôn ngữ `languages` với `code` PK, `name`, `direction` ltr|rtl và 8 dòng
   seed en-US, ar-SA, de-DE, fr-FR, ru-RU, es-ES, it-IT, pt-BR); `RelatedCollectionSelect` có menu `select_existing`
   (collection quản lý, singleton khóa, nhóm `system`), `RelatedFieldSelect` khóa alias, khóa chính, kiểu ngoài danh
   sách.
6. **Given** bấm lưu, **When** chạy, **Then** thứ tự request như `save()`: (1) `POST /fields/:c` hoặc
   `PATCH /fields/:c/:f` chỉ khóa đổi (bỏ `name`, bỏ qua khi bằng), (2) `POST /collections` hoặc `PATCH` cho
   `collections.junction|related` (bỏ `name`, `type`, `icon`, `color`), (3) `POST|PATCH /fields` cho `fields.*`, (4)
   `POST /relations` hoặc `PATCH /relations/:c/:f` cho `relations.m2o|o2m` có đủ collection và field, (5) `POST
   <endpoint>` với mảng dòng cho `items` (seed ngôn ngữ), (6) `GET /fields`; lỗi kiểm tra trước lưu (`Field key cannot
   be the same as foreign key`, `Duplicate fields cannot be created`) hiện hộp lỗi và drawer còn mở; lỗi API giữa
   chừng hiện hộp lỗi và drawer đóng như Directus (R-40); Esc/hủy về màn collection và đặt lại store.
7. **Given** field có sẵn, **When** mở, **Then** store `startEditing` xác định localType từ relations như Directus,
   `GET /fields/:c/:f` lấy `note`, `options`, `display_options`, `validation_message` thô (không dịch) với skeleton khi
   đang nạp; đổi interface → đổi localType và `type` theo `localTypes`/`types`; đổi `related_collection` sang
   `directus_files` → m2o thành file, m2m thành files và ngược lại (xóa options, display).

---

### User Story 4 - Roles và policies: danh sách, tạo, trang role, trang policy, ma trận quyền (Priority: P1)

Admin xem danh sách role (dòng Public giả cố định đầu, số user, role con, mô tả; tìm kiếm phía client), tạo role (chỉ
tên), mở trang role (form `directus_roles`: tên, icon, mô tả, parent, policies m2m qua `directus_access`, users o2m;
mời user; xóa), trang Public (policies công khai); xem danh sách policy (số user, số role; nhân bản), tạo policy (tên,
`app_access`, `admin_access`; tự thêm quyền tối thiểu cho app), mở trang policy với ma trận quyền theo collection và
năm action, chip ba mức (all/none/custom), drawer chi tiết (bộ lọc item, field, validation, preset), đặt lại quyền hệ
thống, thêm collection, `ip_access`, `enforce_tfa`, users và roles được gán.

**Why this priority**: Nửa thứ hai của tiêu chí chấp nhận (quyền tạo trên app mới dùng được ngay trên Directus); đích
thật cho D-85.

**Independent Test**: Test component ma trận với mock `/permissions`, `/policies/:id`, `/permissions/:id`; E2E: tạo role
`bo_editor2`, policy `bo_editor2_policy` (`app_access`), gán quyền `bo_articles` read all, create custom (field `title`,
`status`; preset `status: draft`; validation `title _nnull`), update custom với bộ lọc `author _eq $CURRENT_USER`,
delete none, share none; gán policy cho role, tạo user vào role (015); đăng nhập user đó ở Directus app (8155) và app
mới: sáu thao tác của SC-003; quyền ghi ra là 3 dòng `directus_permissions` (read all, create custom, update custom;
delete và share không có dòng); so dòng `directus_permissions`, `directus_access`, `directus_policies`, `directus_roles`
với cùng thao tác trên Directus app.

**Acceptance Scenarios**:

1. **Given** `/settings/roles`, **When** mở, **Then** tiêu đề `settings_roles`, icon `group`, tìm kiếm `search_role`
   (client, tên hoặc mô tả; autofocus khi > 25 role), nút `create_role` → `/settings/roles/+`; `GET /roles` `limit=-1`
   `fields=id,name,description,icon,users,children.name,children.id` `deep[users]={_aggregate:{count:'id'},
   _groupBy:['role'],_sort:'role',_limit:-1}` `sort=name` (fetchAll); bảng cột icon, tên (tô khớp), số user
   (`users[0].count.id`), role con (`related-values` `{{ name }}`, `ValueNull` khi trống), mô tả; dòng đầu luôn là
   Public (`public_label`, `public_description`, icon `public`, màu primary, hai ô `ValueNull`) → `/settings/roles/public`;
   dòng khác → `/settings/roles/:id`; không có dòng Administrator giả; không khớp → `no_results` + `clear_filters`.
2. **Given** hộp tạo role, **When** nhập tên (max 100) và lưu, **Then** `POST /roles {name}` rồi tới trang role mới;
   Esc về danh sách; trang role: tiêu đề `editing_role {role}`, quay lại, breadcrumb `settings_roles`, nút xóa (hộp
   `delete_are_you_sure` → `DELETE /roles/:id`, notice `item_delete_success`, về danh sách), nút mời (`person_add`,
   chỉ khi `auth.disableDefault` tắt; `UsersInvite` của 015 với role sẵn, D-83 áp dụng), nút lưu với `SaveOptions`
   (lưu và ở lại, lưu và thêm mới → `/settings/roles/+`, bỏ thay đổi; lưu bản sao khóa); `GET /roles/:id`
   `deep[users][_limit]=0`; form `directus_roles` theo `roles.yaml` (`name` required, `icon`, `description`, `parent`
   m2o lọc `id _neq {{id}}`, `children` ẩn, `policies` `list-m2m` qua `directus_access` layout list, nhóm `users` với
   `list-o2m`); lưu → `PATCH /roles/:id` với edits (quan hệ lồng dạng `{create, update, delete}` như Directus) rồi
   store user nạp lại; panel: Thông tin (khóa + nút chép), Revisions `directus_roles`; menu "sửa role" của module
   Users (015, D-85) mở màn này.
3. **Given** `/settings/roles/public`, **When** mở, **Then** tiêu đề `public_label`, chỉ nút lưu; form: notice
   `public_role_info` và field `policies` bản sao với `junctionFilter {role:{_null}, user:{_null}}` và `filter`
   `$FOLLOW(directus_access,policy) _none …`; nạp `GET /access?filter={_and:[{role:{_null:true}},{user:{_null:
   true}}]}&fields=id&limit=-1`; lưu → song song `POST /access` (create), `PATCH /access` (update), `DELETE /access`
   (ids) rồi nạp lại; panel không có Thông tin, không Revisions.
4. **Given** `/settings/policies`, **When** mở, **Then** tiêu đề `settings_permissions`, icon `admin_panel_settings`,
   tìm kiếm `search_policy`, nút `create_policy`; `GET /policies` `limit=-1` `fields=id,name,icon,description,
   enforce_tfa,ip_access,app_access,admin_access,users,roles` với `deep.users` và `deep.roles` đếm theo policy,
   `sort=name`, sắp lại client `localeCompare`; cột icon, tên, số user, số role, mô tả; menu dòng `duplicate_policy`:
   hộp với tên `"<name> (copy)"` → `GET /permissions?filter={policy:{_eq}}&limit=-1&fields=collection,action,
   permissions,validation,presets,fields,policy`, `POST /policies {name, icon, description, enforce_tfa, ip_access,
   app_access, admin_access}`, rồi `POST /permissions` mảng với `policy` mới (nếu có), nạp lại, ở lại danh sách; không
   chép user/role.
5. **Given** hộp tạo policy, **When** nhập tên, bật `app_access`, không `admin_access` và lưu, **Then** `POST /policies
   {name, admin_access, app_access}` rồi `POST /permissions` mảng `appAccessMinimalPermissions` (dữ liệu chép từ
   `app-access-permissions.yaml` + `schema-access-permissions.yaml` của Directus 11.17.4, mỗi dòng `permissions {}`,
   `validation null`, `presets null`, `fields ['*']`, `system true`, cộng `policy`), tới trang policy mới; trang policy:
   `editing_policy {policy}`, xóa, lưu với `SaveOptions` (thêm mới → `/settings/policies/+`), form `directus_policies`
   theo `policies.yaml` (`name`, `icon`, `description`, `permissions` = `system-permissions`, `app_access`,
   `admin_access`, `ip_access` tags cast-csv, `enforce_tfa`, vạch `assigned_to`, `users` và `roles` `list-m2m` với
   `junctionFilter`); lưu → một `PATCH /policies/:id` với edits gồm `permissions:{create, update, delete}` (ma trận
   không tự ghi `/permissions`); panel Thông tin, Revisions `directus_policies`. Mỗi dòng của `POST /permissions` gửi đủ
   khóa của `appAccessMinimalPermissions` (gồm `system: true`) cộng `policy`. `users` của trang policy gồm user được gán
   trực tiếp (không qua role) và số đếm ở danh sách gồm họ. `ip_access` là tags tự do, không kiểm ở client (API kiểm khi
   đăng nhập), như Directus.
6. **Given** ma trận quyền của policy có `app_access`, **When** nhìn, **Then** `GET /permissions?fields=*&filter=
   {_and:[{policy:<id>}]}&page=0&limit=-1` (bỏ qua với `+`, chạy lại khi lưu xong); `admin_access` bật (đọc giá trị form
   chưa lưu) → chỉ notice `admins_have_all_permissions`; bảng: cột `collection` và `actions` (6 cột), dòng theo
   collection sắp tên, collection thường trước, vạch `system_collections` rồi `directus_*`; hàng app tối thiểu hiện với
   chip khóa (tooltip `required_for_app_access`); ô tên có tooltip tên hiển thị và hai lối tắt `all`/`none`; năm chip
   create, read, update, delete, share; nút gỡ dòng (`remove` = none mọi action); `directus_extensions` khóa create và
   delete (`ValueNull`); chân bảng `reset_system_permissions_to` [`app_access_minimum`] [`recommended_defaults`] với hộp
   `reset_system_permissions_copy`; nút `permission_add_collection` (collection có meta, vạch, collection hệ thống; đã có
   thì khóa; thêm xong cuộn tới dòng); `no_permissions` khi trống.
7. **Given** chip của action, **When** mở menu, **Then** mức: `none` không có permission; `all` khi `fields` chứa `*`,
   `permissions` và `validation` rỗng; còn lại `custom`; menu `all_access` (khóa khi đã all), `no_access` (khóa khi đã
   none; ẩn khi hàng app tối thiểu), vạch, `use_custom` (mở drawer); set all = update permission hiện có thành `{fields:
   ['*'], permissions:null, validation:null, presets:null}` hoặc create `{policy, collection, action, fields:['*'],
   permissions:null, validation:null, presets:null}`; set none = xếp delete (permission tạo cục bộ thì bỏ); "đặt lại"
   xếp delete mọi permission trên collection hệ thống, với `recommended_defaults` thêm `appRecommendedPermissions` (dữ
   liệu chép từ `directus/app/src/app-permissions.ts` của Directus 11.17.4) với `policy`; mọi thay đổi phát `{create,
   update, delete}` (hoặc `undefined` khi không đổi) lên form, không gửi request tới khi lưu policy.
8. **Given** drawer chi tiết `<policy> -> <collection> -> <action>`, **When** mở, **Then** `GET
   /policies/:id?deep[users] [_limit]=0` gộp giá trị form, `GET /permissions/:id` khi permission có trên server gộp sửa
   đang xếp; tab dọc có chấm khi có giá trị: `item_permissions` (read/update/delete/share: `system-filter` trên
   `permissions`, nhãn `rule`, notice `permissions_for_policy`), `field_permissions` (create/read/update:
   `BoCheckboxTree` field qua `useFieldTree`, nút `all`/`none`, notice `fields_for_policy`; chọn hết → danh sách rõ,
   không chọn → `fields null`), `field_validation` (create/update: `system-filter` `includeValidation`, không quan hệ,
   notice `validation_for_policy`), `field_presets` (create/update: ô JSON `input-code`, notice `presets_for_policy`,
   cảnh báo `presets_field_warning` với field quan hệ có mảng); giá trị app tối thiểu hiện chỉ đọc dưới cảnh báo
   `the_following_are_minimum_permissions` và khóa trong cây; lưu: `isPermissionEmpty` → xếp delete, mới → create, có →
   update; Esc đóng. Ô JSON `presets` không hợp lệ: `input-code` báo lỗi cú pháp tại chỗ, giá trị không phát, như
   Directus. Chọn hết field ở tab Fields lưu danh sách rõ nên chip thành `custom`, không thành `all` (như Directus).

---

### User Story 5 - Cài đặt dự án và giao diện (Priority: P2)

Admin mở Project settings (form `directus_settings` trừ nhóm theme, AI, MCP: tên, mô tả, URL, ngôn ngữ mặc định, chủ
dự án, thanh module, visual editor URLs, bảo mật, đăng ký công khai, file và ảnh thu nhỏ, báo lỗi, collab, bản đồ, tỉ lệ
cắt ảnh) và Appearance (branding: màu, logo, ảnh public, favicon, ghi chú; theme: appearance mặc định, theme sáng/tối và
overrides, CSS tùy chỉnh); lưu bằng nút save; giá trị hiện ngay trên khung app của 012 (logo, màu, theme) như Directus.

**Why this priority**: Yêu cầu nêu rõ; không chặn data model và quyền.

**Independent Test**: E2E: sửa `project_name`, `default_language`, `module_bar` (tắt Insights, thêm link), `basemaps`,
`storage_asset_presets`, `custom_aspect_ratios`, `auth_password_policy`, `project_color`, `default_appearance`,
`theme_light_overrides`, `custom_css`; so body `PATCH /settings` với Directus app; mở lại Directus app và so sidebar,
logo, theme; đổi chủ dự án qua `system-owner` và so body `POST /settings/owner`.

**Acceptance Scenarios**:

1. **Given** `/settings/project`, **When** mở, **Then** tiêu đề `settings_project`, icon `tune`, breadcrumb Settings,
   nút lưu (khóa khi không có edits), Ctrl/Cmd+S, hộp `unsaved_changes`; `BoForm` `directus_settings` với mọi field của
   `settings.yaml` trừ `theming_group`, `ai_group`, `mcp_group` và con của chúng, giá trị đầu từ store settings (không
   fetch): `project_name`, `project_descriptor`, `project_url`, `default_language` (`system-language`), `project_owner`
   (`system-owner`), vạch `modules` + `module_bar` (`system-modules`), vạch `visual_editor` + `visual_editor_urls` (list
   `{url}` với `system-display-template` biến `$version`; dữ liệu giữ, app không có visual editing, D-41), vạch
   `security` + `auth_password_policy` (none | weak `/^.{8,}$/` | strong; allowOther), `auth_login_attempts`, vạch
   `public_registration` + bốn field (bộ lọc email là `system-filter` trên `directus_users`), vạch
   `files_and_thumbnails` + `storage_asset_transform` (all | none | presets), `storage_default_folder`
   (`system-folder`), `storage_asset_presets` (list `{{key}}`: key slug, fit, width, height, quality slider mặc định 80,
   withoutEnlargement, format auto|jpeg|png|webp|tiff|avif allowNone, transforms json), vạch `reporting` +
   `report_feature_url`, `report_bug_url`, `report_error_url` (`system-display-template` biến error.*, navigator.*,
   route.*, user.*, role.*), vạch `collaborative_editing` + `collaborative_editing_enabled` (chỉ đọc vì `info.websocket`
   false, như Directus), vạch `mapping` + `mapbox_key` (monospace), `basemaps` (list `{name, type raster|tile|style,
   url, tileSize ẩn khi raster, attribution}`), vạch `image_editor` + `custom_aspect_ratios` (list `{text, value}`);
   `project_usage`, `org_name`, `product_updates`, `project_status`, `project_id`, `id` ẩn. `mapbox_key` hiện rõ như
   Directus. Giá trị của `custom_aspect_ratios`, `basemaps`, `storage_asset_presets` không kiểm ở client (API lưu JSON),
   như Directus.
2. **Given** sửa và lưu, **When** bấm, **Then** `PATCH /settings` chỉ khóa đổi, gộp lạc quan, notice
   `settings_update_success`, hoàn tác khi lỗi; rồi store server nạp lại (với `isLanguageUpdated` khi
   `default_language` đổi); sidebar, logo, tiêu đề, theme của 012 cập nhật ngay (FR-030 đến FR-034 của 012).
3. **Given** `project_owner`, **When** bấm sửa, **Then** drawer `interfaces.system-owner.update` với `SetupForm` của
   012 (`project_owner`, `project_usage`, `org_name`, `product_updates`; không bước license, D-53), nút lưu khóa khi
   không đổi → `POST /settings/owner {project_owner, project_usage, org_name, product_updates}` (API ghi không báo cáo
   chủ sở hữu, D-38) rồi nạp lại settings; không qua edits của form.
4. **Given** `module_bar`, **When** sửa, **Then** danh sách kéo thả = `module_bar` đã lưu (mặc định `MODULE_BAR_DEFAULT`)
   cộng module chưa có (thêm ở trạng thái tắt): dòng module có ô bật, dòng `locked` (settings) có ổ khóa; dòng link bấm
   để sửa, nút `clear` gỡ; nút `add_link` mở drawer `custom_link` (name, icon, url bắt buộc); giá trị ghi
   `[{type:'module', id, enabled, locked?} | {type:'link', id, name, url, icon, enabled}]` như Directus; module ngoài
   phạm vi (visual, deployments) giữ trong dữ liệu và hiện trong danh sách như Directus, chỉ sidebar bỏ qua (D-41); link
   `docs` tới tài liệu Directus giữ trong dữ liệu (ghi lại đúng vị trí, tên đã dịch) nhưng không hiện trong danh sách
   (D-100) và sidebar cũng bỏ qua (D-49); đường bàn phím Lên/Xuống (D-96).
5. **Given** `/settings/appearance`, **When** mở, **Then** tiêu đề `settings_appearance`, icon `palette`; form chỉ
   `theming_group`: vạch `branding` + `project_color` (`select-color`), `project_logo`, `public_foreground`,
   `public_background`, `public_favicon` (`file`), `public_note`; vạch `theming` + `default_appearance` (auto | light |
   dark), `default_theme_light` và `default_theme_dark` (`system-theme` của 015: danh sách và xem trước theme Directus,
   nhãn qua file dịch, D-88; chọn không đổi giao diện Backoffice, dòng ghi chú như D-88), `theme_light_overrides`,
   `theme_dark_overrides` (`system-theme-overrides`; chỉ khóa có ánh xạ đổi giao diện Backoffice, D-43, D-89),
   `custom_css` (`input-code` css, số dòng; chèn vào `#custom-css` như 012 FR-034); lưu `PATCH /settings` rồi store
   server nạp lại; `project_color` chỉ đổi `--project-color` (XII).

---

### User Story 6 - Presets và bookmarks, translations (Priority: P2)

Admin xem danh sách preset trên layout của `directus_presets` (cột bookmark, collection, user, role), xóa và sửa hàng
loạt, mở trình sửa preset (tên, icon, màu, collection, phạm vi global/user/role, layout, tìm kiếm, bộ lọc, xem trước
layout thật với tùy chọn layout trong panel); xem danh sách chuỗi dịch tùy chỉnh, tạo và sửa (key, ngôn ngữ, giá trị),
ngôn ngữ app nạp lại ngay.

**Why this priority**: Đích thật của D-71 (menu bookmark role/global); không chặn các luồng khác.

**Independent Test**: E2E: mở `/settings/presets`, so cột và số đếm panel với Directus app; từ cây collection của
Content (014) chọn "sửa bookmark role" → `/settings/presets/:id` mở trình sửa; tạo preset role với layout cards và bộ
lọc; so body `POST|PATCH /presets` với Directus app và kiểm bookmark hiện trong cây collection của Directus app; tạo
translation `vi-VN` cho key `hello`, so body và kiểm chuỗi hiện ở cả hai app.

**Acceptance Scenarios**:

1. **Given** `/settings/presets`, **When** mở, **Then** màn danh sách trên `use-layout` + `use-preset` của 014 cho
   `directus_presets` (mặc định tabular cột `bookmark`, `collection`, `user` `{{email}}`, `role` `{{name}}` rộng 200 như
   `systemDefaults`), `SearchInput` với bộ lọc, nút xóa hàng loạt (khi có lựa chọn; hộp `batch_delete_confirm` →
   `DELETE /presets` mảng id; lỗi → hộp `something_went_wrong`), sửa hàng loạt (`DrawerBatch`), nút `create_preset` →
   `/settings/presets/+`; trống: `no_presets` / `no_presets_copy` + nút; không khớp: `no_results`; panel: Thông tin
   (`GET /presets?filter[bookmark][_nnull]=true&fields=id&meta=filter_count,total_count` → `bookmarks` = filter_count,
   `presets` = total − filter), Layout, `layout-sidebar-*`, Refresh, Export; bấm dòng → `/settings/presets/:id`.
2. **Given** `/settings/presets/:id` (hoặc `+`), **When** mở, **Then** tiêu đề `editing_preset`, quay lại
   `/settings/presets`, nút xóa (khóa với `+`; `DELETE /presets` body `[id]`), nút lưu (khóa khi không edits),
   Ctrl/Cmd+S; `GET /presets/:id` (bỏ qua với `+`); form: nhóm `name` (`system-input-translated-string`, placeholder
   `preset_name_placeholder` → `bookmark`), `icon` (mặc định `bookmark`), `color` (ba ô dùng chung với `BookmarkAdd`
   014), `collection` (select mọi collection; hệ thống chỉ `directus_users`, `directus_files`, `directus_activity`),
   `scope` (`system-scope`: `all_users` | chọn user qua `DrawerCollection` `directus_users` | chọn role qua
   `DrawerCollection` `directus_roles`; giá trị hiện tại hiện đầu với tên từ `GET /roles/:id?fields=id,name` hoặc `GET
   /users/:id?fields=id,first_name,last_name,email`), `layout` (các layout đã đăng ký), `search`, `filter`
   (`system-filter` `collectionField: 'collection'`, `rawFieldNames`), vạch `layout_preview`; dưới là layout thật chỉ
   đọc của collection đã chọn, `layout_query`/`layout_options` lưu theo tên layout (`{tabular:{…}}`), panel có
   `layout-options-*` và `layout-sidebar-*`; chưa chọn collection hoặc layout → notice
   `no_layout_collection_selected_yet`; mặc định mới: layout `tabular`, scope `all`. Preset scope user hiện tên user
   (email khi thiếu tên); preset không có `bookmark` (preset layout tự lưu) sửa được như mọi preset, Directus không phân
   biệt.
3. **Given** lưu preset, **When** chạy, **Then** body chỉ khóa đã sửa trong `bookmark`, `icon`, `color`, `collection`,
   `layout`, `layout_query`, `layout_options`, `filter`, `search`, và scope → `role_<id>` = `{role, user:null}`,
   `user_<id>` = `{user, role:null}`, `all` = cả hai null; `POST /presets` (mới) hoặc `PATCH /presets/:id`; store
   presets nạp lại; luôn về danh sách kể cả khi lỗi (như Directus, R-41); menu "sửa bookmark role/global" của
   `NavigationBookmark` (014) mở màn này (D-71 gỡ).
4. **Given** `/settings/translations`, **When** mở, **Then** danh sách trên `use-layout` cho `directus_translations`
   (tabular, cột theo field không ẩn: `key`, `language`, `value`), tìm kiếm và bộ lọc, xóa hàng loạt (`DELETE
   /translations` mảng), sửa hàng loạt, nút `create_custom_translation` → `/settings/translations/+`; trống:
   `no_custom_translations` / `no_custom_translations_copy` + nút; panel Layout, Refresh, Export.
5. **Given** `/settings/translations/:id`, **When** mở, **Then** tiêu đề `create_custom_translation` hoặc
   `edit_custom_translation`, breadcrumb tên collection → danh sách; form theo `translations.yaml`: `key` (monospace,
   required, placeholder `translation_key_placeholder`), `language` (`system-language`, required), `value`
   (`input-multiline`, required, placeholder `enter_a_value`); xóa (chỉ khi có sẵn) → `DELETE /translations/:id`, nạp lại
   ngôn ngữ hiện tại, về danh sách; lưu → `POST` hoặc `PATCH /translations[/:id]`, nạp lại ngôn ngữ hiện tại (store
   translations của 012 `refreshCurrentLanguage`), `SaveOptions` (ở lại: mới thì `router.replace` tới id; thêm mới; bản
   sao khóa khi mới); Ctrl/Cmd+S, Ctrl/Cmd+Shift+S; nạp lỗi → màn không tìm thấy; panel (chỉ item có sẵn): Revisions
   (khi accountability `all`; revert cũng nạp lại ngôn ngữ), Comments.

---

### User Story 7 - Đối chiếu với Directus, E2E ba cấu hình, dùng chéo (Priority: P2)

Mọi luồng trên chạy ở ba cấu hình API (proxy tới Directus thật, proxy tới API mới, khác origin) và so với Directus app
trên cùng DB; data model và quyền tạo ở app này được kiểm bằng cách dùng ở app kia; recipe design-system cho màn chưa có
mẫu được viết trước khi code.

**Why this priority**: Là tiêu chí chấp nhận.

**Independent Test**: Job `e2e-web` với spec `settings-*.spec.ts`; bộ so payload `settings` cho `/collections`,
`/fields`, `/relations`, `/roles`, `/policies`, `/permissions`, `/access`, `/settings`, `/settings/owner`, `/presets`,
`/translations`, `/utils/translations/generate`; bộ so DB (`db-rows`) cho `directus_collections`, `directus_fields`,
`directus_relations`, `directus_permissions`, `directus_access`, `directus_policies`, `directus_roles`; bộ so UI cho
sub-menu, tiêu đề, cột, `disabled` của nút, mục panel; kịch bản dùng chéo của SC-002 và SC-003.

**Acceptance Scenarios**:

1. **Given** bộ mẫu `bo_settings` seed qua Directus REST, **When** chạy E2E song song hai app, **Then** 0 lệch ngoài
   D-xx ở năm thuộc tính của SC-004.
2. **Given** cùng kịch bản ghi, **When** so body, **Then** 100% bằng sau chuẩn hóa (SC-005); lệch thật ghi R-xx.
3. **Given** data model và quyền tạo ở app mới, **When** dùng ở Directus app (và ngược lại), **Then** SC-002, SC-003 đạt.
4. **Given** recipe Q-20 đến Q-28, **When** đóng feature, **Then** design owner đã duyệt (SC-008).

### Edge Cases

- Collection có `meta.group` trỏ tới collection không tồn tại hoặc tạo vòng: cây Directus bỏ qua mục không về gốc; app
  làm giống, không treo; tìm kiếm không tìm thấy mục mồ côi (như Directus); ghi CHK.
- `PATCH /collections` khi kéo thả không được Directus chờ (`onSort` không await) nên lỗi không hiện và cây giữ thứ tự
  cục bộ tới lần nạp sau: app làm giống (owner chọn B, Clarifications 2026-10-16); không hộp lỗi, không hoàn tác.
- Xóa collection có relation a2o trỏ tới nó: Directus bỏ qua a2o trong cảnh báo; API vẫn xử lý; app giữ.
- Tên collection trùng khi tạo: không kiểm phía client (như Directus), API trả `RECORD_NOT_UNIQUE` → hộp lỗi, drawer còn
  mở.
- Tên field trùng trong cùng collection ở drawer: không kiểm (như Directus); API từ chối ở bước (1) của `save()` → hộp
  lỗi và drawer đóng (R-40); tên field trùng giữa `fields.*` sinh ra → lỗi trước lưu, drawer mở.
- Kéo field vào group đang gập hoặc group lồng group: Directus cho phép group lồng; app giữ; group vào chính nó bị
  vuedraggable chặn.
- Collection người dùng không có field `meta.system`; chỉ collection `directus_*` có field khóa: lưới field hiện, thêm
  field người dùng được (II), form collection khóa.
- Đổi `related_collection` sang collection singleton: menu khóa singleton; gõ tay thì Directus vẫn nhận → API quyết;
  app giữ.
- `translations.ts:362` của Directus gán chuỗi `'translations'` vào `relations.o2m.meta` và `:291` đọc
  `relations.o2m.sort_field`: port giữ kết quả quan sát được (không sinh `sort` field cho translations; [Unverified]
  `meta` bị ghi đè ngay sau bởi `update`), kiểm T002 bằng so dòng DB; nếu Directus thật ghi khác thì sửa theo DB và ghi
  R-xx.
- Policy có `admin_access`: ma trận ẩn, permission cũ trong DB giữ nguyên (không xóa) như Directus.
- `app_access` bật khi đang xem ma trận (chưa lưu): hàng app tối thiểu hiện ngay (đọc values của form).
- Permission của collection không còn trong store (collection bị xóa ở app khác): dòng bị bỏ như Directus; không xóa
  permission.
- Hàng app tối thiểu luôn được nối thêm (lỗi so sánh `item.action === perm.collection` ở Directus): hiển thị không đổi vì
  `getPermission` bỏ `policy null`; app port đúng hành vi quan sát (không "sửa" lỗi), ghi CHK.
- Public role lưu khi có create và delete cùng lúc: ba request song song như Directus; một request lỗi → hộp lỗi, các
  request khác đã chạy, nạp lại.
- `module_bar` chứa module không tồn tại (extension của Directus): giữ trong dữ liệu, dòng hiện với tên id như Directus;
  sidebar 012 bỏ qua.
- `basemaps` rỗng hoặc `mapbox_key` xóa: layout map của 014 về OpenStreetMap ở lần nạp sau.
- `default_language` đổi thành mã không có trong app (D-46): lưu được, giao diện rơi về `en-US`.
- Preset scope đổi từ role sang user: body có `role: null` và `user`; preset của user đang đăng nhập hiện ở cây Content
  ngay sau `presetsStore.hydrate()`.
- Preset có `layout` không đăng ký (extension): select hiện giá trị thô; Directus không vẽ layout không có nên app hiện
  notice `no_layout_collection_selected_yet` (CHK).
- Translation key có `$t:` lồng hoặc ký tự đặc biệt: lưu nguyên như Directus; `refreshCurrentLanguage` gộp vào vue-i18n.
- Màn hẹp 768 px: panel là drawer (L-4); drawer field và drawer quyền chiếm toàn màn; lưới field 1 cột (`half` thành
  full) như Directus dưới 600 px của form grid. Tab dọc của drawer field, drawer quyền và drawer tạo collection thành
  `BoTabs` ngang cuộn được ở đầu drawer.
- Phiên hết hạn giữa chuỗi request của `save()` field: request còn lại 401 → về đăng nhập như 012; phần đã ghi giữ (như
  Directus, không transaction ở client).
- Tên collection/field bắt đầu `directus_` hoặc trùng từ khóa SQL: không kiểm ở client (như Directus); API trả lỗi → hộp
  lỗi, drawer hoặc hộp còn mở.
- Admin khác hoặc Directus app đổi schema khi màn collection đang mở: không theo dõi, store cũ tới lần vào lại route,
  như Directus.
- Hai admin sửa cùng policy hoặc `directus_settings` ở hai app: ghi sau thắng; store settings gộp lạc quan rồi nạp lại,
  như Directus.
- Mất `admin_access` giữa phiên: route Settings đã đăng ký giữ tới khi đăng nhập lại (như Directus); request ghi bị API
  trả 403 → hộp lỗi.
- Dữ liệu do Directus tạo với interface hoặc layout extension: form hiện interface mặc định theo kiểu (013 FR-003);
  trình sửa preset hiện notice `no_layout_collection_selected_yet`.
- Tên junction vượt giới hạn độ dài tên bảng của DB (Postgres 63 ký tự): không kiểm ở client; API/DB lỗi → hộp lỗi.
- m2a với `related_collections` rỗng: `readyToSave` sai (thiếu `one_allowed_collections`).
- Xóa field đang là `sort_field` hoặc `archive_field`: không chặn (như Directus); `system-field` của form collection
  hiện key cũ dạng chữ thô, không có notice (đã kiểm T002).
- Đặt `parent` của role thành con hoặc cháu của nó: bộ lọc chỉ loại chính nó (như Directus); API từ chối vòng
  (`validateRoleNesting`, có ở cả hai API) → hộp lỗi, form giữ thay đổi (đã kiểm T002).
- Mất admin cuối (bỏ `admin_access`, xóa role hoặc policy admin cuối, gỡ chính mình khỏi role admin): API trả
  `UNPROCESSABLE_CONTENT` → hộp lỗi, form giữ thay đổi.
- Một trong ba request `/access` của trang Public lỗi: hộp lỗi; phần đã ghi giữ; nạp lại phản ánh trạng thái DB.

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| Mọi story | — | FR-001 đến FR-007 (route, sub-menu, khung màn, db-safe) | SC-001 |
| US1 | 1–10 | FR-010 đến FR-019 | SC-001, SC-002, SC-004 |
| US2 | 1–9 | FR-020 đến FR-029 | SC-001, SC-002, SC-005 |
| US3 | 1–7 | FR-030 đến FR-043 | SC-001, SC-002, SC-005, SC-006 |
| US4 | 1–8 | FR-050 đến FR-063 | SC-001, SC-003, SC-005 |
| US5 | 1–5 | FR-070 đến FR-077 | SC-001, SC-005 |
| US6 | 1–5 | FR-080 đến FR-088 | SC-001, SC-004, SC-005 |
| US7 | 1–4 | FR-100 đến FR-115 | SC-002 đến SC-010 |

## Requirements *(mandatory)*

### Functional Requirements

**Route, sub-menu và điều hướng**

- **FR-001**: Module `settings` PHẢI thay route khung của 012 bằng các route của `modules/settings/index.ts` trong phạm
  vi (xem Phạm vi), giữ tên route (`settings-collections`, `settings-add-new`, `settings-fields`,
  `settings-fields-field`, `settings-roles-*`, `settings-policies-*`, `settings-project`, `settings-appearance`,
  `settings-presets-*`, `settings-translations-*`, `settings-not-found`), `meta.isFloatingView` cho `+` và `:field`
  (vẽ nổi trên màn cha bằng named view như Directus), guard `beforeEnter` của `settings-collections` (nạp collections)
  và `settings-fields` (không có collection → `settings-not-found` với `params._`; không `meta` → `PATCH
  /collections/:c {meta:{}}`; nạp fields); `/settings/flows(/*)` giữ khung 012 (D-92); `/settings/ai`,
  `/settings/marketplace/*`, `/settings/extensions`, `/settings/system-logs` không đăng ký → `settings-not-found`
  (D-93); `preRegisterCheck` giữ của 012.
- **FR-002**: `accessibleSystemCollections` của `get-item-route.ts` giữ nguyên: `/content/directus_settings` →
  `/settings/project` (singleton), `directus_collections` → `/settings/data-model` (item → `/settings/data-model/:c`),
  `directus_roles` → `/settings/roles` (item → `/settings/roles/:id`), `directus_presets` → `/settings/presets`,
  `directus_translations` → `/settings/translations`, `directus_flows` → `/settings/flows` (khung tới 017); nay là màn
  thật trừ flows (D-72 gỡ phần 016).
- **FR-003**: Sub-menu của module Settings PHẢI là danh sách phẳng một cấp (L-3, không ngoại lệ cây) gồm ba nhóm có
  vạch chia như `navigation.vue`, bỏ mục ngoài phạm vi (AI, Marketplace, Extensions, System logs): nhóm 1 Data Model,
  Flows; nhóm 2 Roles, Access Policies; nhóm 3 Project, Appearance, Presets, Translations. Không có nhóm Report Bug,
  Request Feature kể cả khi `settings.report_bug_url` / `report_feature_url` có giá trị (D-94); không có dòng phiên bản
  ở cuối (D-95). Mục active theo tiền tố route (`aria-current`).
- **FR-004**: Màn không tìm thấy của module PHẢI là `ContentNotFound` của 014 với prop module `settings` (tiêu đề
  `page_not_found`, `page_not_found_body`), sub-menu Settings vẫn hiện.
- **FR-005**: Nút "tạo collection" (`ContentNavigation`, `NoCollections` của 014), menu "sửa collection" (014), menu
  "sửa bookmark role/global" (`NavigationBookmark` của 014), menu "sửa role" (`UsersNavigation` của 015) PHẢI mở màn
  thật tương ứng; comment "khung 012 tới 016" trong bốn file đó sửa (D-71, D-85 gỡ).
- **FR-006**: Mọi màn PHẢI dùng `PageHeader` (tiêu đề, breadcrumb, nút), `DetailPanel` L-4 khi có mục panel, hộp
  `unsaved_changes` với Keep Editing trước (D-76), form dừng ở `max-w-5xl` (D-82), notice tại chỗ (D-66), focus vào lựa
  chọn an toàn trong hộp xác nhận xóa. Trạng thái nạp: cây collection skeleton 6 dòng; bảng role, policy, preset,
  translation `BoTable loading`; ma trận `BoProgressLinear`; drawer field skeleton theo `loading` của store; trình sửa
  preset skeleton form. Lỗi nạp → `showUnexpectedError` (hộp lỗi) như Directus, màn giữ trạng thái rỗng.
- **FR-007**: Ô "db-safe" (key collection, folder, field, khóa chính, field hệ thống tùy chọn, junction, khóa ngoại, key
  nhân bản) PHẢI làm như `dbSafe` của `v-input.vue` Directus: khi gõ chỉ nhận `a-z`, `0-9`, `_` và khoảng trắng; khi
  nhập (gồm dán) thay khoảng trắng bằng `_`, bỏ dấu (NFD), xóa ký tự ngoài `[a-zA-Z0-9_]`; không giới hạn độ dài ở
  client (API báo lỗi); `BoInput` 013 thêm prop `dbSafe`.

**Danh sách collection**

- **FR-010**: Màn `/settings/data-model` PHẢI dựng cây như kịch bản US1-2 từ store collections: mục gốc có `meta` và
  không `meta.group`; con theo `meta.group`; `sort` theo `meta.sort`; tìm kiếm không phân biệt hoa thường trên key, cha
  giữ hiện khi con khớp; mục hệ thống trong `BoDetail` `system_collections` ẩn khi tìm kiếm không khớp mục nào trong đó;
  mục chưa quản lý từ `GET /collections` không `meta`.
- **FR-011**: Trạng thái gập PHẢI lưu localStorage `backoffice-collapsed-collection-ids` (mảng tên; D-39), thanh
  `expand` `all`/`none` chỉ khi có collection có `meta.group`; `meta.collapse` chỉ là giá trị mặc định ghi DB (dùng ở
  cây Content của 014), không đổi trạng thái cục bộ.
- **FR-012**: Kéo thả PHẢI dùng `BoSortableList` (013, có `group` lồng) với tay kéo; thả gửi `PATCH /collections` mảng
  `{collection, meta:{sort, group}}` của danh sách đích như kịch bản US1-4; không chờ response và không báo lỗi, như
  `onSort` của Directus (Clarifications 2026-10-16); đường bàn phím: menu dòng Lên/Xuống, Vào nhóm (vào folder liền
  trước), Ra nhóm (D-96).
- **FR-013**: Menu collection PHẢI như kịch bản US1-5; hộp xóa như kịch bản US1-5 với danh sách field phụ thuộc tính từ
  store relations (`meta.one_collection` = collection, có `many_collection` và `many_field`; bỏ a2o).
- **FR-014**: Hộp folder PHẢI như kịch bản US1-6 (`collection-dialog.vue`): key db-safe (FR-007) khóa khi sửa, icon mặc
  định `folder`, màu, note, `translations` list; `POST /collections {collection, meta}` hoặc `PATCH /collections/:c
  {meta}` (meta gồm cả `collection`, `icon`, `note`, `color`, `translations` như Directus); Esc hủy, Enter lưu; form đặt
  lại khi mở và đóng.
- **FR-015**: Drawer tạo collection PHẢI như kịch bản US1-7 và US1-8, mở theo route `+` (`use-dialog-route`; đóng là
  về `settings-collections`), body `POST /collections` và `POST /relations` đúng từng khóa của `new-collection.vue`
  (bộ so payload); không kiểm tên trùng ở client.
- **FR-016**: Panel của danh sách PHẢI có mục `snapshot.export` với nút tải `GET /schema/snapshot` → `snapshot.json` (cả
  body `{data}` của response, JSON thụt 2 dấu cách, như `collections.vue`); không có mục khác.
- **FR-017**: Trạng thái trống như kịch bản US1-10; skeleton khi store collections đang nạp lần đầu.
- **FR-018**: Danh sách request ghi của màn: `POST /collections`, `PATCH /collections` (mảng), `PATCH /collections/:c`,
  `DELETE /collections/:c`, `DELETE /fields/:c/:f` (phụ thuộc), `POST /relations` (`user_*`); đọc: `GET /collections`,
  `GET /relations`, `GET /fields`, `GET /schema/snapshot` (nguồn chuẩn `contracts/api-calls.md`). `PATCH
  /collections/:c` gồm guard `{meta:{}}`, menu ẩn/hiện, gập mở và hộp folder.
- **FR-019**: Collection hệ thống (`directus_*`) PHẢI không kéo, không menu, không xóa; bấm mở `/settings/data-model/
  directus_x` với form collection khóa và lưới field cho phép thêm, sửa, sắp xếp field người dùng (II, như Directus).

**Màn collection và lưới field**

- **FR-020**: Màn `/settings/data-model/:c` PHẢI như kịch bản US2-1: `use-item` của 014 với collection
  `directus_collections`, khóa chính là tên collection, endpoint `/collections`; `edits.meta` là model của `BoForm`
  `directus_collections` theo `collections.yaml` (mọi mục của yaml: 29 mục gồm 8 vạch chia và `sort`, `group`,
  `collapse` ẩn); lưu `PATCH /collections/:c {meta:{…}}` chỉ khóa đổi rồi về danh sách; lưu và ở lại bằng Ctrl/Cmd+S;
  `use-edits-guard`.
- **FR-021**: Lưới field PHẢI như kịch bản US2-2: `fieldsStore.hydrate({skipTranslation})` khi mount, dịch lại khi
  unmount; sắp theo `meta.sort` rồi `meta.id`; bỏ `$`; field hệ thống khóa đứng đầu; lưới gốc và khung group là
  `BoSortableList` group `fields` lồng; dòng field là ô chỉ đọc với các icon và tooltip nêu ở kịch bản; bề rộng theo
  `meta.width` (`half` = nửa, `full` = cả hàng, `fill` = cả hàng tràn; dưới 600 px đều cả hàng như form grid 013). Ở
  lưới, `fill` hiện như `full`; hai giá trị khác nhau chỉ ở form item (013).
- **FR-022**: Thả PHẢI gửi `PATCH /fields/:c` mảng `{field, meta:{sort: i+1, group}}` (gốc: `group` null; lọc mục nil),
  cập nhật lạc quan, hoàn tác và hộp lỗi khi lỗi, chỉ áp response mới nhất; đường bàn phím Lên/Xuống/Vào nhóm/Ra nhóm
  (D-96). "Vào nhóm" đưa field vào group liền trước trong cùng danh sách (như `indent` của `BoSortableList` và cây
  collection); không có group liền trước thì mục menu khóa. Bộ đếm "response mới nhất" là một biến module-level chung
  cho mọi collection, như `fieldsStore` Directus (đã kiểm T002); lỗi luôn hoàn tác và hiện hộp lỗi.
- **FR-023**: Menu field PHẢI như kịch bản US2-4 với các `PATCH /fields/:c/:f {meta:{hidden}}`, `{meta:{width}}`. Lỗi
  API: hoàn tác thay đổi lạc quan và hộp lỗi, như `fieldsStore.updateField` của Directus.
- **FR-024**: Nhân bản field PHẢI như kịch bản US2-5 (`duplicate_where_to`: `system-collection` + tên db-safe, mặc định
  `<field>_copy`; payload bỏ `meta.id`, `meta.sort`, `meta.group`, `schema.comment`, `name`; đổi tên khóa `validation`
  trỏ field cũ cùng collection; `POST /fields/:đích`; notice `field_create_success`). Tên đã có ở collection đích: API
  trả lỗi → hộp lỗi hiện trên hộp nhân bản, hộp nhân bản còn mở, như `FieldSelect.vue` Directus (đã kiểm T002).
- **FR-025**: Xóa field PHẢI như kịch bản US2-6; khóa chính và group có con không xóa được (menu khóa).
- **FR-026**: Bấm field không `meta` PHẢI `PATCH /fields/:c/:f {meta:{special}}` với `getSpecialForType` rồi mở
  drawer; field có `meta` mở thẳng.
- **FR-027**: Nút `create_field` và menu `create_in_advanced_field_creation_mode` PHẢI như kịch bản US2-7 (10 loại, ba
  vạch chia).
- **FR-028**: `translations_enable_helper` (`system-collections-translations`) PHẢI như kịch bản US2-8: đọc
  `values.collection` của form; không hiện với collection hệ thống; chế độ enable (notice
  `translations_enable_helper_description`, nút `enable_translations` khóa khi không có field phù hợp) và manage (notice
  success `translations_already_enabled`, select `translation_configuration` khi nhiều cấu hình, cảnh báo
  `translations_invalid_config_warning`, nút `add_fields`); drawer gửi `POST /utils/translations/generate` với body
  `{collection, translationsCollection, fields}` (manage) hoặc `{collection, fields, translationsCollection,
  languagesCollection, parentFkField, languageFkField, createLanguagesCollection, seedLanguages}` (enable); nạp lại ba
  store. Mặc định như Directus (đã kiểm T002): collection translations `<collection>_translations`, collection ngôn ngữ
  `languages`, khóa ngoại cha `<collection>_<pk cha, mặc định id>`, khóa ngoại ngôn ngữ `<languages>_<pk ngôn ngữ, mặc
  định code>`, tự điền tên bật; `createLanguagesCollection` và `seedLanguages` cùng bằng "collection ngôn ngữ chưa tồn
  tại", không có ô riêng; field đủ điều kiện là mọi field trừ khóa chính, `meta.system`, `alias`, tự tăng, `special`
  sinh giá trị (uuid, date-created, date-updated, role-created, role-updated, user-created, user-updated) và `special`
  quan hệ (file, files, m2o, o2m, m2m, m2a, translations), tất cả được chọn sẵn; collection ngôn ngữ có sẵn nhưng không
  hợp lệ: API quyết, lỗi hiện trong drawer.
- **FR-029**: Danh sách request của màn collection: đọc `GET /collections/:c`, `GET /fields`, `GET /fields/:c/:f`; ghi
  `PATCH /collections/:c`, `DELETE /collections/:c`, `PATCH /fields/:c` (mảng), `PATCH /fields/:c/:f`, `POST /fields/:c`,
  `DELETE /fields/:c/:f`, `POST /utils/translations/generate`.

**Drawer field**

- **FR-030**: Drawer PHẢI mở theo route `:field` (named view `field`), tiêu đề như kịch bản US3-1, Esc/hủy về màn
  collection và `$reset` store; Enter = lưu (chế độ nâng cao) hoặc lưu (chế độ đơn giản khi `readyToSave`). Thoát drawer
  khi đã sửa chưa lưu: không hỏi, `$reset` store, như Directus. Field không tồn tại mở bằng URL hoặc `?type=` không
  thuộc 10 localType: hộp lỗi rồi về màn collection (D-97; Directus ném lỗi JavaScript không bắt, đã kiểm T002).
- **FR-031**: Store field PHẢI port `store/index.ts` của Directus với cùng state (`collection`, `editing`, `field`,
  `fieldUpdates`, `relations.m2o|o2m`, `collections.junction|related`, `fields.corresponding|junctionCurrent|
  junctionRelated|sort|oneCollectionField`, `items`, `localType`, `autoGenerateJunctionRelation`, `loading`, `saving`),
  cùng `startEditing` (xác định localType; `GET /fields/:c/:f` lấy giá trị thô), cùng pipeline `update` (đổi interface
  → localType và type; đổi localType → `schema:{}`, reset relations, `special`; chạy alteration; `related_collection`
  `directus_files` ↔ file/files; quy tắc gộp: `schema`, `meta` gộp nông vào `field` và `fieldUpdates`, `items` thay,
  còn lại gộp sâu với mảng thay và `undefined` xóa khóa), cùng `missingConfiguration`/`readyToSave` theo localType,
  `interfacesForType`/`displaysForType`, `generationInfo`; test port `store/index.test.ts`.
- **FR-032**: Mười alteration PHẢI port `store/alterations/*` đúng kết quả (kiểm bằng test port và bộ so DB): standard
  (special theo kiểu, bỏ interface không hỗ trợ kiểu), presentation và group (bỏ schema, type `alias`, special),
  m2o (`on_delete` SET NULL mặc định; sinh collection liên quan với `id` integer auto; tự quan hệ → NO ACTION;
  `is_nullable false` → NO ACTION; `field.type` = kiểu PK liên quan), file (uuid, `directus_files`), o2m (relation
  `one_field`, `one_deselect_action nullify`; sinh collection, field tương ứng `select-dropdown-m2o` ẩn, `sort` integer
  ẩn), m2m (junction theo `get-junction-collection-name`, hai FK, `junction_field` chéo, junction `hidden`, icon
  `import_export`, các field junction ẩn, copy `one_field` của junction có sẵn), files (`<c>_files`,
  `directus_files_id`, fallback uuid), m2a (`item` string, `collection` string, `one_allowed_collections`,
  `one_collection_field`), translations (`<c>_translations`, `languages` với `code`/`name`/`direction` và 8 dòng seed,
  `m2o.field` `<lang>_<pk|code>`; không sinh `sort`); `collection-exists`/`field-exists` chỉ tra store.
- **FR-033**: Chế độ đơn giản PHẢI như kịch bản US3-1 (`field-detail-simple.vue`, `field-configuration.vue`,
  `relationship-configuration.vue`): sáu nhóm interface theo `group`, sắp `order`, chỉ interface không hệ thống, tìm
  theo id hoặc tên, cột theo bề ngang 400/600/840 px; khung cấu hình với `key`, `type`, `default_value`, `required`,
  khối quan hệ, options `standard`; `autoKey` → `<suffix>-<nanoid6>`, xóa key khi đổi sang interface khác. Ảnh xem trước
  của thẻ là `preview` SVG chép từ `index.ts` của từng interface Directus vào registry 013 (dữ liệu, sinh bằng script
  registry; màu qua `currentColor` và biến theme); interface không có `preview` hiện icon của nó, như Directus. Lưới thẻ
  là `radiogroup` (mũi tên di chuyển, Enter/Space chọn); chọn xong focus vào ô key của khung cấu hình. Ô key là db-safe
  (FR-007). Key tự động của interface có `autoKey` là `<đoạn thứ hai của id theo dấu ->-<nanoid 6 ký tự, chữ thường>`
  (`presentation-divider` → `divider-x1y2z3`), như `field-configuration.vue` (đã kiểm T002).
- **FR-034**: Tab nâng cao PHẢI như kịch bản US3-2 (`field-detail-advanced-tabs.vue`: thứ tự và điều kiện hiện).
- **FR-035**: Tab Schema PHẢI như kịch bản US3-2 (`field-detail-advanced-schema.vue`), gồm danh sách kiểu theo nhóm
  (string, text | boolean | integer, bigInteger, float, decimal | timestamp, dateTime, date, time | json, csv, uuid, hash
  | geometry và sáu kiểu con), `on_create`/`on_update` với lựa chọn `do_nothing`, `generate_and_save_uuid`,
  `save_current_user_id`, `save_current_user_role` (uuid; lọc theo m2o tới `directus_users`/`directus_roles`),
  `save_current_datetime` (kiểu thời gian); widget `default_value` theo kiểu.
- **FR-036**: Tab Field PHẢI như kịch bản US3-2 (`readonly`, `required`, cảnh báo, `hidden`, `searchable`, `note`
  `system-input-translated-string`, `field_name_translations` list với `system-language` mặc định ngôn ngữ user).
- **FR-037**: Tab Interface và Display PHẢI như kịch bản US3-3; `ExtensionOptions` PHẢI vẽ `BoForm` từ `options` của
  interface/display 013 (mảng; `{standard, advanced}` thành hai phần; hàm nhận ngữ cảnh `{field, editing, collection,
  relations, collections, fields, items, localType, autoGenerateJunctionRelation, saving, loading}`; component riêng
  `interface-options-<id>` cho `list`, `map`; không display nào có options component), ghi `meta.options` và
  `meta.display_options`; gợi ý theo kiểu như `field-detail-advanced-interface.vue` (string → input, select-dropdown;
  text → input-rich-text-html; boolean → boolean; số và uuid → input; thời gian → datetime; json →
  select-multiple-checkbox, tags; csv → tags) và `recommendedDisplays` + `raw`, `formatted-value` (D-56 gỡ).
- **FR-038**: Options dạng component PHẢI port `interfaces/list/options.vue` (danh sách field con với
  `system-interface`, `system-display`, `system-interface-options`, `system-display-options`,
  `system-input-translated-string`; template, `addLabel`, `sort`, `limit`), `interfaces/map/options.vue` (`geometryType`
  theo kiểu field, `defaultView` từ bản đồ `BoMapFrame`); options của display `translations` (`template` theo collection
  translations, `languageField`, `defaultLanguage`, `userLanguage`) và `related-values` (`template` theo collection liên
  quan) là hàm, vẽ qua `ExtensionOptions` (FR-037); giá trị ghi ra bằng Directus app.
- **FR-039**: Tab Relationship PHẢI như kịch bản US3-5 cho m2o/file, o2m, m2m/files, m2a, translations (`field-detail-
  advanced-relationship-*.vue`), `RelatedCollectionSelect` (ô db-safe, trạng thái "khớp" khi tồn tại, menu
  `select_existing` với collection quản lý (singleton khóa) và nhóm `system` crud-safe), `RelatedFieldSelect` (menu
  field theo bảng chữ cái; khóa alias, khóa chính, `disabledFields`, kiểu ngoài allow/deny), ô `auto_fill` chỉ field
  mới, notice `new_data_alert` từ `generationInfo`. Field quan hệ có sẵn: collection liên quan, junction và khóa ngoại
  khóa; `sort_field`, trigger (`on_delete`, `one_deselect_action`) và field tương ứng sửa được, như
  `field-detail-advanced-relationship-*.vue`.
- **FR-040**: Tab Validation và Conditions PHẢI như kịch bản US3-4.
- **FR-041**: `save()` PHẢI theo thứ tự sáu bước của kịch bản US3-6 với hai kiểm tra trước lưu; lỗi API giữa chừng hiện
  hộp lỗi, drawer đóng, các bước sau vẫn chạy như Directus (R-40); sau lưu `GET /fields` (skipTranslation) và màn
  collection cập nhật lưới. Các bước chạy tuần tự; trong bước 2, 3, 4, 5 vòng lặp cũng tuần tự theo thứ tự khóa
  (`junction`, `related`; `corresponding`, `junctionCurrent`, `junctionRelated`, `sort`, `oneCollectionField`; `m2o`,
  `o2m`) như `store/index.ts` (đã kiểm T002: `for…of` với `await`; thứ tự khóa theo khai báo state; `items` theo thứ tự
  chèn). Khi một bước lỗi, app không liệt kê bước đã ghi; dọn collection hoặc field dở bằng màn data model (R-40).
- **FR-042**: 18 interface `_system` còn lại PHẢI được đăng ký với cùng id, `types`, `localTypes`, `options`, `system:
  true` và hành vi như Directus (bảng Key Entities §Interface hệ thống): `system-collection` (select collection không
  alias, `includeSystem`, `includeSingleton`, `allowNone`), `system-collections` (checkbox collection `table`),
  `system-collections-translations` (FR-028), `system-display` (display theo `typeField`), `system-display-options`,
  `system-display-template` (`FieldList`/`useFieldTree` nạp lười quan hệ, `collectionField`, `injectVersionField`,
  `includeRelations`), `system-field` (`collectionField|collectionName`, `typeAllowList`, `allowNone`,
  `allowPrimaryKey`, `allowForeignKeys`; reset khi đổi collection), `system-field-tree` (`BoCheckboxTree` exclusive),
  `system-fields` (danh sách sắp xếp đường dẫn field, menu `add_field`, `allowSelectAll`, `fieldFilter`),
  `system-folder` (`use-folders` 015, gốc `root_name`), `system-inline-fields` (list field con: `field_key`,
  `field_name`, `type`, `interface_label` `system-interface`, `note`, `field_width`, `required`, `options`; phẳng hóa
  `meta.x`/`schema.x`), `system-interface` (interface không quan hệ, không hệ thống theo kiểu), `system-interface-
  options` (`isConditionOptions` batch, `context`), `system-manual-flow-select` (store flows: flow manual có collection,
  không `location collection`), `system-modules` (FR-074), `system-owner` (FR-073), `system-permissions` (FR-056 đến
  FR-059), `system-scope` (FR-084); `system-mcp-prompts-collection-validation` không làm (D-41, D-57 đóng).
  `system-collections` và `system-inline-fields` được đăng ký và có test nhưng chưa có màn dùng (017).
- **FR-043**: Danh sách request của drawer: đọc `GET /fields/:c/:f`, `GET /fields`, `GET /folders` (`system-folder`),
  `GET /roles/:id`, `GET /users/:id` (`system-scope`); ghi `POST /fields/:c`, `PATCH /fields/:c/:f`, `POST
  /collections`, `PATCH /collections/:c`, `POST /relations`, `PATCH /relations/:c/:f`, `POST /items/:c` hoặc `POST
  /<hệ thống>` (seed).

**Roles**

- **FR-050**: Danh sách role PHẢI như kịch bản US4-1 (request, cột, dòng Public, tìm kiếm client, autofocus, trạng
  thái không khớp); `BoTable` recipe Q-2 không sắp cột, cột co giãn.
- **FR-051**: Hộp tạo role PHẢI như kịch bản US4-2 (`POST /roles {name}`, tới trang role; Esc về danh sách; Enter
  lưu; nút lưu khóa khi trống).
- **FR-052**: Trang role PHẢI như kịch bản US4-2: `use-item` `directus_roles` với `deep[users][_limit]=0`, form theo
  `roles.yaml`, lưu `PATCH /roles/:id` với edits gồm quan hệ lồng `policies`/`users` dạng `{create, update, delete}`
  (như `list-m2m`/`list-o2m` của 013 phát), `userStore.hydrate()` sau lưu, xóa, mời (`UsersInvite` 015 với `role`),
  `SaveOptions`, phím tắt, panel Thông tin và Revisions; sau lưu và ở lại, Revisions nạp lại. Role không tồn tại hoặc
  không đọc được: form rỗng, không hộp lỗi, nút xóa khóa (`item` null), như Directus (đã kiểm T002). Lỗi "phải còn ít
  nhất một admin" (`UNPROCESSABLE_CONTENT`) khi xóa role admin cuối hoặc gỡ chính mình khỏi role admin: hộp lỗi API,
  form giữ thay đổi.
- **FR-053**: Trang Public PHẢI như kịch bản US4-3 (`GET /access` lọc role và user null; ba request ghi song song
  trên `/access`; field `policies` với `junctionFilter` và `filter` `$FOLLOW`); không Thông tin, không Revisions.
- **FR-054**: Danh sách request của roles: đọc `GET /roles` (fetchAll với `deep[users]`), `GET /roles/:id`, `GET
  /access`; ghi `POST /roles`, `PATCH /roles/:id`, `DELETE /roles/:id`, `POST /access`, `PATCH /access`, `DELETE
  /access`, `POST /users/invite`.

**Policies và ma trận quyền**

- **FR-055**: Danh sách policy, nhân bản, hộp tạo policy và trang policy PHẢI như kịch bản US4-4 và US4-5; dữ liệu
  `appAccessMinimalPermissions` và `appRecommendedPermissions` là bản chép tĩnh từ Directus 11.17.4
  (`directus/packages/system-data/src/app-access-permissions/*.yaml` và `directus/app/src/app-permissions.ts`) có test
  so với nguồn (như D-89 với theme). Trang policy có `use-edits-guard` (hộp `unsaved_changes`), Ctrl/Cmd+S lưu và ở lại,
  Ctrl/Cmd+Shift+S lưu và thêm mới, như trang role. Bỏ `admin_access` của policy admin cuối hoặc xóa nó: API trả
  `UNPROCESSABLE_CONTENT` → hộp lỗi, form giữ thay đổi.
- **FR-056**: `system-permissions` PHẢI nhận `value` là mảng id hoặc `{create, update, delete}`, phát `{create, update,
  delete}` hoặc `undefined`, đọc `app_access`/`admin_access` từ `values` của form (inject), nạp `GET /permissions` như
  kịch bản US4-6 (lại khi pk đổi và khi `value` về mảng sau lưu), ẩn với `admin_access`, bảng và chân bảng như kịch bản
  US4-6, chip như kịch bản US4-7, `directus_extensions` khóa create/delete. Trang policy luôn có khóa chính thật (tạo
  qua hộp rồi mới tới trang); nhánh bỏ qua `+` chỉ là phòng hờ.
- **FR-057**: Dòng và chip PHẢI tính mức `none|all|custom` và thực hiện set all/none/reset/thêm collection/gỡ dòng đúng
  body như kịch bản US4-7; dòng app tối thiểu khóa với tooltip `required_for_app_access`, chip "full" tối thiểu không có
  menu; thao tác không gửi request (chỉ xếp vào alterations). Chọn hết field ở drawer lưu danh sách rõ nên chip thành
  `custom`, không phải `all` (như Directus). Hàng app tối thiểu được nối thêm cả khi policy đã có permission cùng
  collection và action (lỗi so sánh của Directus); chip lấy permission có `policy`, nên chỉ hiện một chip.
- **FR-058**: Drawer chi tiết PHẢI như kịch bản US4-8 (`permissions-detail.vue`): tiêu đề, hai request nạp, bốn tab
  theo action, cây field từ `useFieldTree` (read gồm quan hệ), chuyển `*` thành danh sách rõ và rỗng thành null, giá
  trị tối thiểu chỉ đọc, lưu xếp create/update/delete; Esc đóng; drawer là `BoDrawer` với tab dọc (`BoTabs`
  orientation vertical).
- **FR-059**: Ma trận PHẢI không tự gọi `/permissions` để ghi; mọi thay đổi đi trong `PATCH /policies/:id`
  (`permissions:{create,update,delete}`) hoặc `POST /policies` + `POST /permissions` của hộp tạo; API mới PHẢI nhận quan
  hệ lồng này như Directus (kiểm T002 bằng bộ so DB; là engine 004 đã port). Lỗi xác thực của một permission trong
  `PATCH /policies/:id` hiện ở `ValidationErrors` đầu form (013), không đánh dấu dòng ma trận, như Directus.
- **FR-060**: Danh sách request của policies: đọc `GET /policies` (fetchAll với `deep.users`, `deep.roles`), `GET
  /policies/:id`, `GET /permissions` (lọc `policy`), `GET /permissions/:id`; ghi `POST /policies`, `PATCH /policies/:id`,
  `DELETE /policies/:id`, `POST /permissions` (mảng: nhân bản, app tối thiểu).
- **FR-061**: Người không admin PHẢI không vào được module (FR-001); user được gán quyền ở app mới PHẢI được API
  Directus và API mới cho/chặn giống nhau (SC-003; parity 004 bảo đảm phía API, 016 chỉ kiểm dữ liệu ghi ra). Ẩn module
  chỉ là UX; API (004) chặn mọi request ghi của Settings với người không admin (E2E `settings-permissions` kiểm 403).
- **FR-062**: Trang policy và role PHẢI dùng `list-m2m`/`list-o2m` của 013 cho `users`, `roles`, `policies`
  (`directus_access` là junction; `junctionFilter` áp vào bộ lọc của drawer chọn; template theo yaml).
- **FR-063**: Xóa role hoặc policy PHẢI chỉ là hộp `delete_are_you_sure` → `DELETE` → về danh sách (không hộp chuyển
  user; Directus 11.17.4 không có).

**Cài đặt dự án và giao diện**

- **FR-070**: `/settings/project` PHẢI như kịch bản US5-1 và US5-2: `BoForm` `directus_settings` với mọi field của
  `settings.yaml` trừ ba nhóm, giá trị đầu từ store settings, `collaborative_editing_enabled` chỉ đọc khi
  `info.websocket` false hoặc `collaborativeEditing` false, lưu `PATCH /settings` chỉ khóa đổi qua store settings
  (`updateSettings` của 012 thêm notice `settings_update_success` và hoàn tác), rồi store server nạp lại; branding 012
  cập nhật ngay.
- **FR-071**: `/settings/appearance` PHẢI như kịch bản US5-5: chỉ `theming_group`; `default_theme_light|dark` dùng
  `system-theme`, `theme_*_overrides` dùng `system-theme-overrides` của 015 (D-88, D-89 áp dụng cho settings:
  `appearance` prop `light|dark`); `custom_css` là `input-code` css; `project_color` chỉ `--project-color` (XII, D-43).
  `system-theme` của 015 thêm option `appearance` (`light|dark`) như `index.ts` Directus. User có `appearance` riêng
  không đổi giao diện khi đổi `default_appearance`; user có `appearance` null theo dự án sau `serverStore.hydrate()`
  (như 012).
- **FR-072**: `select-color`, `file`, `select-dropdown`, `list`, `input-code`, `tags`, `slider`, `boolean`, `input` của
  013 PHẢI đủ cho mọi field của `settings.yaml` ngoài `_system` (kiểm registry; thiếu option nào thì ghi R-xx).
- **FR-073**: `system-owner` PHẢI hiện email chủ dự án chỉ đọc + nút sửa (tooltip `interfaces.system-owner.edit`),
  drawer `interfaces.system-owner.update` dùng `SetupForm` 012 (bốn field, không license, D-53), lưu khóa khi không đổi
  → `POST /settings/owner` rồi `settingsStore.hydrate()`; không ghi vào edits của form; API không báo cáo chủ sở hữu
  (D-38). `project_owner` trống: ô trống và nút sửa; `POST /settings/owner` lỗi: hộp lỗi trong drawer, drawer còn mở.
- **FR-074**: `system-modules` PHẢI như kịch bản US5-4: danh sách `BoSortableList` của `module_bar` đã lưu (mặc định
  `MODULE_BAR_DEFAULT` chép từ `constants.ts` Directus) cộng module chưa có (tắt), ô bật, ổ khóa cho `locked`, link bấm
  sửa và nút gỡ, drawer `custom_link` (name, icon `select-icon`, url bắt buộc), giá trị như Directus; module ngoài phạm
  vi và mục `docs` giữ trong dữ liệu (D-41, D-49); đường bàn phím Lên/Xuống (D-96). URL của link không lọc scheme ở
  client, như `module-bar.vue` Directus (đã kiểm T002); id trùng hoặc thiếu `settings`: không kiểm, như Directus.
- **FR-075**: `system-folder` PHẢI là ô chỉ đọc hiện đường dẫn thư mục (gốc `interfaces.system-folder.root_name`) với
  menu cây thư mục từ `use-folders` (015), phát id hoặc null.
- **FR-076**: `public_registration_email_filter` PHẢI là `system-filter` (014) trên `directus_users` field `email`;
  `report_error_url`, `visual_editor_urls[].url` PHẢI là `system-display-template` với biến tĩnh như yaml.
- **FR-077**: Danh sách request: đọc `GET /settings` (store 012), `GET /folders`, `GET /server/info`; ghi `PATCH
  /settings`, `POST /settings/owner`.

**Presets và translations**

- **FR-080**: `/settings/presets` PHẢI như kịch bản US6-1 trên `use-layout` + `use-preset` 014 với collection
  `directus_presets` (store presets thêm `systemDefaults` của `directus_presets` chép từ `stores/presets.ts` Directus),
  nút hàng loạt, panel Thông tin với request đếm, Layout, Refresh, Export.
- **FR-081**: `/settings/presets/:id` PHẢI như kịch bản US6-2 (form cục bộ với 8 field và vạch, mặc định mới, xem trước
  layout thật chỉ đọc qua `use-layout` với `layout_query`/`layout_options` theo tên layout, panel `layout-options-*` và
  `layout-sidebar-*`, notice khi chưa chọn). Xem trước dùng `limit` của layout (25) và đếm qua `aggregate` như
  `use-items` 014, an toàn với collection 10 triệu dòng; panel dùng layout options của 014 (`layout-options-<id>`).
- **FR-082**: Lưu preset PHẢI như kịch bản US6-3 (body theo khóa đã sửa, ánh xạ scope, `POST`/`PATCH`, `presetsStore.
  hydrate()`, luôn về danh sách, R-41); xóa `DELETE /presets` body `[id]`.
- **FR-083**: Ba ô tên/icon/màu PHẢI dùng cùng ba interface với `BookmarkAdd` của 014 (không dùng component
  `BookmarkAdd`) (cùng `system-input-translated- string`, `BoIconPicker`, `BoColorPicker`).
- **FR-084**: `system-scope` PHẢI như kịch bản US6-2: ba lựa chọn, `DrawerCollection` cho user/role, nhãn giá trị hiện
  tại qua `GET /roles/:id` hoặc `GET /users/:id`, phát `all` | `user_<id>` | `role_<id>`.
- **FR-085**: `/settings/translations` PHẢI như kịch bản US6-4 trên `use-layout` + `use-preset` cho
  `directus_translations` (không `systemDefaults`: cột theo field không ẩn), nút hàng loạt, panel Layout, Refresh,
  Export.
- **FR-086**: `/settings/translations/:id` PHẢI như kịch bản US6-5 với `use-item` `directus_translations`
  (`/translations`), form theo `translations.yaml`, `refreshCurrentLanguage` sau lưu, xóa và revert (store translations
  012 nạp lại `GET /translations` theo ngôn ngữ hiện tại và gộp vào i18n), `SaveOptions`, panel Revisions (khi
  `accountability all`) và Comments; nạp lỗi → không tìm thấy. Trùng (`key`, `language`) được phép:
  `directus_translations` không có ràng buộc unique (đã kiểm T002); chuỗi tùy chỉnh dùng qua `$t:<key>` nên không đè
  khóa i18n của app. Giá trị có cú pháp message lỗi: vue-i18n cảnh báo và giữ chuỗi thô, E2E bỏ qua cảnh báo này.
  `refreshCurrentLanguage` chưa có ở `apps/web` (store translations 012 chỉ có `setLanguage`): 016 chép
  `directus/app/src/lang/refresh-current-language.ts` vào `src/lang/refresh-current-language.ts`.
- **FR-087**: Danh sách request: đọc `GET /presets` (danh sách 014 với `collection=directus_presets`; đếm `meta`),
  `GET /presets/:id`, `GET /translations`, `GET /translations/:id`, `GET /roles/:id`, `GET /users/:id`; ghi `POST
  /presets`, `PATCH /presets/:id`, `DELETE /presets` (mảng), `PATCH /presets` (hàng loạt), `POST /translations`,
  `PATCH /translations/:id`, `DELETE /translations/:id`, `DELETE /translations` (mảng), `PATCH /translations`.
- **FR-088**: Preset tạo ở màn này PHẢI hiện đúng ở cây collection của Content 014 (bookmark global/role/user) và ở
  Directus app sau `hydrate` (SC-004).

**Đối chiếu, kiểm thử, chất lượng**

- **FR-100**: E2E `settings-data-model.spec.ts`, `settings-field-detail.spec.ts`, `settings-roles-policies.spec.ts`,
  `settings-project.spec.ts`, `settings-presets-translations.spec.ts`, `settings-permissions.spec.ts` (người không
  admin), `settings-parity-ui.spec.ts`, `settings-cross-use.spec.ts` (FR-102) PHẢI chạy ở ba cấu hình như 014/015
  (`DIRECTUS_APP_SPECS` cho spec điều khiển Directus app chỉ chromium-1280). Spec sửa `directus_settings` chạy
  `test.describe.serial` trong một worker và khôi phục settings ở `afterAll`; spec khác không khẳng định branding.
- **FR-101**: Bộ so payload `apps/web-e2e/src/payload/settings.spec.ts` PHẢI so body ghi của FR-018, FR-029, FR-043,
  FR-054, FR-060, FR-077, FR-087 với Directus app cùng kịch bản sau chuẩn hóa (id, thời gian, `nanoid`, thứ tự khóa); bộ
  so DB (`helpers/db-rows.ts`) so dòng `directus_collections`, `directus_fields`, `directus_relations`,
  `directus_permissions`, `directus_access`, `directus_policies`, `directus_roles`, `directus_presets`,
  `directus_translations`, `directus_settings` sau mỗi kịch bản (bỏ `id`, `sort` tự tăng, thời gian). Request song song
  (ba request `/access`, hai `POST /relations` của `user_*`) được sắp theo `(method, path, body)` trước khi so.
- **FR-102**: Kịch bản dùng chéo PHẢI có trong E2E ở `proxy-api`: (a) data model tạo ở app mới (US3 Independent Test) →
  mở và tạo item trên Directus app 8155 bằng Playwright → so item đọc qua API mới; (b) role/policy tạo ở app mới (US4
  Independent Test) → đăng nhập user đó trên Directus app và app mới → cùng kết quả cho sáu thao tác của SC-003; (c)
  ngược lại: tạo ở Directus app → mở ở app mới và so lưới field, ma trận quyền (SC-002, SC-003).
- **FR-103**: Bộ mẫu `bo_settings` PHẢI seed qua Directus REST (`apps/web-e2e/src/helpers/fixtures.ts` mở rộng), snapshot
  commit, parity `tests/parity/src/web/fixtures-seed.test.ts` mở rộng; seed lại giữa hai lượt so payload.
- **FR-104**: Store field, 10 alteration, `ExtensionOptions`, 18 interface `_system`, ma trận quyền và drawer chi tiết,
  `system-modules`, `system-scope` PHẢI có test component với mock API (request allowlist như 013); options component
  của `list`, `map` và options dạng hàm của display `translations`, `related-values` có test giá trị ghi ra.
- **FR-105**: Dữ liệu quyền tĩnh chép từ Directus (`appAccessMinimalPermissions`, `appRecommendedPermissions`) PHẢI sinh
  bằng script `web:sync-permissions-data` (như `web:sync-themes`) với test so nguồn; tên file không chứa "directus"
  (D-89 áp dụng). `MODULE_BAR_DEFAULT` đã có ở `src/constants.ts` của 012, không sinh.
- **FR-106**: A11y: lưới field và cây collection có đường bàn phím (D-96), thông báo `aria-live` khi di chuyển (không
  dùng `aria-grabbed`, đã bỏ từ WAI-ARIA 1.1); chip quyền là `button` với `aria-haspopup`, mức đọc được bằng chữ
  (tooltip + sr-only), không chỉ bằng màu; tab dọc là `BoTabs` (Reka Tabs, mũi tên); drawer có focus trap, Esc, trả
  focus; axe 0 vi phạm serious/critical trên danh sách collection, màn collection, drawer field (hai chế độ), danh sách
  và trang role, policy với ma trận và drawer chi tiết, project, appearance, danh sách và trình sửa preset, translations
  ở sáng và tối (SC-008); D-96 được owner chọn nên không có ngoại lệ a11y cho kéo thả (tech lead duyệt trước khi đóng).
  Focus sau hành động: tạo collection → tiêu đề màn collection (`h1 tabindex=-1`); xóa field → dòng kế tiếp hoặc nút
  `create_field`; đóng drawer → phần tử đã mở nó; lưu preset hoặc xóa role, policy, translation → tiêu đề danh sách.
  Thông báo `aria-live` khi di chuyển bằng menu dùng chuỗi của `BoSortableList` 013 ("<tên> chuyển tới vị trí <i>/<n>",
  "<tên> vào nhóm <g>"). MapLibre (options `map`), FullCalendar và map của xem trước preset dùng lớp tối của 014;
  `motion-reduce` tắt hiệu ứng kéo. Tương phản theo `migration-guide.md`: mục mờ `gray-500` trên nền sáng, `gray-400`
  trên nền tối; chip quyền như Q-23. Nút icon và tay kéo tối thiểu 32×32 px (`size-8`). Danh sách màn axe: 13 màn của
  SC-004 và bốn drawer/hộp: drawer tạo collection, drawer field (hai chế độ), drawer quyền, hộp xóa collection.
- **FR-107**: Recipe design-system Q-20 đến Q-27 PHẢI viết nháp vào `design-system/docs/component-specs.md` và
  `layout-patterns.md` (mục "Tier 3 recipes (016)") trước khi code màn tương ứng; design owner duyệt trước khi đóng.
- **FR-108**: Hiệu năng (ngân sách máy tham chiếu nhân `machineFactor()` như 014 R14; trung vị 3 lần; chromium;
  `PERF=1`): cây 300 collection trong 30 folder vẽ dưới 500 ms; lưới 200 field với 10 group vẽ dưới 500 ms; ma trận 60
  collection × 5 action vẽ dưới 500 ms; mở drawer field có sẵn dưới 300 ms sau `GET /fields/:c/:f`; số request mỗi thao
  tác: mở màn collection = 1 `GET /collections/:c` + 2 `GET /fields` (guard và `fields-management` cùng hydrate, như
  Directus; T115) (+ 0 relations: store); kéo thả = 1 PATCH; mở trang
  policy = 1 policy + 1 permissions (+ `list-m2m` users/roles: 2 trang + 2 đếm như 015 SC-007). Mốc kết thúc của "mở
  drawer field": `loading` của store về false và tab Schema vẽ xong. Thêm: ma trận 300 collection × 5 action dưới 1
  giây; cây field của drawer quyền nạp lười. Số request thêm: mở drawer field có sẵn = 1 `GET /fields/:c/:f`; trang role
  = 1 role + `list-m2m` policies (1 trang + 1 đếm) + `list-o2m` users (1 + 1); danh sách preset = 1 danh sách + 1 đếm +
  1 panel. Không có benchmark web hằng tuần cho Settings (màn quản trị, dữ liệu nhỏ); perf trong browser test là đủ.
- **FR-109**: Bundle: drawer field (store + tab), ma trận quyền, trình sửa preset (xem trước layout), dữ liệu quyền tĩnh
  là chunk lười; chunk chính ≤ ngân sách 015 + 20 KB gzip; dữ liệu quyền ≤ 10 KB gzip; `scripts/check-bundle.mjs`. Chunk
  lười: drawer field ≤ 80 KB, ma trận quyền ≤ 40 KB, dữ liệu quyền ≤ 10 KB gzip (research R12).
- **FR-110**: Không request ngoài danh sách FR-018, FR-029, FR-043, FR-054, FR-060, FR-077, FR-087 và danh sách 012–015
  (`allowed-paths.ts`, `KNOWN_REQUESTS`); 0 request ra ngoài.
- **FR-111**: Không sửa file trong `directus/`; không sửa `apps/web`, `apps/web-e2e`, `design-system/`, spec 012–015
  trước khi 015 báo đóng (quy tắc session 015, 2026-10-16); 016 chỉ commit `specs/016-*` tới lúc đó.
- **FR-112**: Chia lượt commit: lượt 1 route, sub-menu, danh sách collection, màn collection, lưới field (US1, US2) +
  `system-collection`, `system-field`, `system-field-tree`, `system-display-template`, `system-collections-
  translations`; lượt 2 drawer field, store, alteration, `ExtensionOptions`, options component, `system-interface*`,
  `system-display*`, `system-fields`, `system-inline-fields`, `system-collections`, `system-manual-flow-select` (US3);
  lượt 3 roles, policies, `system-permissions` (US4); lượt 4 project, appearance, presets, translations,
  `system-owner`, `system-modules`, `system-folder`, `system-scope` (US5, US6); lượt 5 bộ so payload, bộ so DB, dùng
  chéo, parity UI, perf, bundle (US7); mỗi lượt commit lên `main` với CI xanh.
- **FR-113**: Thư viện mới: không (vuedraggable đã có từ 013 qua `BoSortableList`; `nanoid` kiểm có trong `apps/web`,
  thiếu thì thêm cùng phiên bản Directus 11.17.4; chốt ở plan).
- **FR-114**: Tài liệu: spec 012 (D-40 phần Settings ghi "đã gỡ ở 016"), 013 (D-56, D-57 ghi "đã gỡ ở 016" trừ MCP),
  014 (D-71, D-72 phần 016), 015 (D-85) sửa khi 015 mở khóa; `CLAUDE.md` Active Technologies thêm dòng 016;
  `SPECKIT-GUIDE.md` ghi chú cho 017 (Flows: mục sub-menu và `/settings/flows` của 016 là khung, D-92;
  `system-manual-flow-select` đã có) và 018 (snackbar D-66); `graphify update .` sau mỗi lượt.
- **FR-115**: Mọi D-92 đến D-103 và R-40 đến R-42 được tech lead duyệt trước khi đóng; không còn điểm cần làm rõ
  (xem Clarifications).

### Key Entities *(include if feature involves data)*

- **Collection** (`directus_collections`): `collection`, `meta` (`icon`, `note`, `display_template`, `hidden`,
  `singleton`, `translations`, `archive_field`, `archive_app_filter`, `archive_value`, `unarchive_value`,
  `sort_field`, `accountability`, `color`, `item_duplication_fields`, `sort`, `group`, `collapse`, `preview_url`,
  `versioning`), `schema` (null = folder). Nguồn: store collections (`GET /collections`), guard `PATCH {meta:{}}`.
- **Field** (`directus_fields`): `field`, `type`, `schema` (`is_nullable`, `is_unique`, `is_indexed`,
  `default_value`, `max_length`, `numeric_precision`, `numeric_scale`, `is_primary_key`, `has_auto_increment`,
  `foreign_key_*`), `meta` (`interface`, `options`, `display`, `display_options`, `readonly`, `hidden`, `required`,
  `searchable`, `sort`, `width`, `group`, `translations`, `note`, `conditions`, `validation`, `validation_message`,
  `special`, `system`). `localType` suy từ `special` và relations (standard, presentation, group, file, files, m2o,
  o2m, m2m, m2a, translations).
- **Relation** (`directus_relations`): `collection`, `field`, `related_collection`, `meta` (`one_field`,
  `one_collection_field`, `one_allowed_collections`, `junction_field`, `sort_field`, `one_deselect_action`), `schema`
  (`on_delete`, `on_update`).
- **Role** (`directus_roles`): `name`, `icon`, `description`, `parent`, `children`, `policies` (qua `directus_access`),
  `users`. **Public**: không có dòng; là tập `directus_access` có `role` null và `user` null.
- **Policy** (`directus_policies`): `name`, `icon`, `description`, `ip_access` (csv), `enforce_tfa`, `admin_access`,
  `app_access`, `permissions` (o2m `directus_permissions`), `users`, `roles` (qua `directus_access`).
- **Permission** (`directus_permissions`): `policy`, `collection`, `action` (create, read, update, delete, share),
  `permissions` (filter), `validation` (filter), `presets` (json), `fields` (csv, `*` = tất cả). Mức hiển thị
  `none|all|custom` suy từ ba khóa. Dữ liệu tĩnh: `appAccessMinimalPermissions` (policy null, `system: true`),
  `appRecommendedPermissions`.
- **Access** (`directus_access`): `role`, `user`, `policy`, `sort`.
- **Settings** (`directus_settings`, singleton id 1): mọi field của `settings.yaml`; nhóm `theming_group` ở
  Appearance; `ai_group`, `mcp_group` không hiện (dữ liệu giữ nguyên); `module_bar` json `[{type, id, enabled,
  locked?, name?, url?, icon?}]`; `project_owner`, `project_usage`, `org_name`, `product_updates` ghi qua
  `/settings/owner`.
- **Preset** (`directus_presets`): `bookmark`, `icon`, `color`, `collection`, `user`, `role` (scope), `layout`,
  `layout_query`, `layout_options` (json theo tên layout), `filter`, `search`, `refresh_interval`.
- **Translation** (`directus_translations`): `key`, `language`, `value`.
- **Snapshot**: JSON của `GET /schema/snapshot` (006), chỉ tải về.
- **Khóa localStorage**: `backoffice-collapsed-collection-ids` (mảng tên collection gập; D-39).
- **Interface hệ thống** (18): id, kiểu, nơi dùng ở bảng dưới; `options` theo `index.ts` Directus.

| Interface | types / localTypes | Dùng ở (016) | API |
|-----------|--------------------|--------------|-----|
| `system-collection` | string | nhân bản field; options list; `mcp_prompts_collection` không hiện | — |
| `system-collections` | json, csv | (flows 017) đăng ký sẵn | — |
| `system-collections-translations` | alias | `translations_enable_helper` | `POST /utils/translations/generate` |
| `system-display` | string | `list` options | — |
| `system-display-options` | — | `list` options | — |
| `system-display-template` | string | `display_template`, `preview_url`, `report_error_url`, `visual_editor_urls`, options quan hệ 013 | — |
| `system-field` | string | `archive_field`, `sort_field` | — |
| `system-field-tree` | string (mảng) | `item_duplication_fields` | — |
| `system-fields` | csv, json | options `list-o2m`, `list-m2m` | — |
| `system-folder` | uuid | `storage_default_folder`, options file 013 | `GET /folders` |
| `system-inline-fields` | json | (flows 017) đăng ký sẵn | — |
| `system-interface` | string | `list` options, inline-fields | — |
| `system-interface-options` | — | conditions, `list` options, inline-fields | — |
| `system-manual-flow-select` | string | options `presentation-header`, `presentation-links` | store flows |
| `system-modules` | json | `module_bar` | — |
| `system-owner` | string | `project_owner` | `POST /settings/owner` |
| `system-permissions` | alias / o2m | `directus_policies.permissions` | `GET /permissions`, `GET /policies/:id`, `GET /permissions/:id` |
| `system-scope` | string | preset `scope` | `GET /roles/:id`, `GET /users/:id` |

## Khác biệt so với Directus *(mandatory)*

Mã tiếp theo sau D-91 (014). D-39, D-41, D-43, D-45, D-47, D-49, D-52, D-66, D-68, D-76, D-82 áp dụng cho mọi màn của
016, không lặp. Gỡ ở 016: D-40 (phần Settings trừ `/settings/flows`), D-56, D-57 (18 interface; `system-mcp-prompts-
collection-validation` đóng vĩnh viễn theo D-41), D-71, D-72 (phần `directus_settings`, `directus_collections`,
`directus_roles`, `directus_presets`, `directus_translations`), D-85.

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|------|
| D-92 | Mục "Flows" của sub-menu Settings và `/settings/flows(/*)` | Trình chỉnh sửa flows | Mục hiện, trỏ khung 012 (D-40) | 017 làm trình chỉnh sửa; `directus_flows` của D-72 trỏ cùng chỗ; owner chọn A (Clarifications 2026-10-16) | ngoài phạm vi (tạm thời) | 017: **đã gỡ ở 017** (trình chỉnh sửa flows thật, cùng route) |
| D-93 | `/settings/ai`, `/settings/marketplace/*`, `/settings/extensions`, `/settings/system-logs`; mục sub-menu tương ứng; nhóm `ai_group`, `mcp_group` của settings | Có (AI/MCP và logs khi bật; marketplace, extensions luôn) | Không đăng ký (→ không tìm thấy), không hiện mục, không hiện nhóm field; dữ liệu DB giữ nguyên | Nguyên tắc XI, D-41; Directus cũng ẩn AI và logs khi tắt | ngoài phạm vi | — |
| D-94 | Mục "Report Bug", "Request Feature" của sub-menu | Luôn hiện; mặc định trỏ GitHub Directus (`DEFAULT_REPORT_*_URL`) | Không hiện, kể cả khi `report_bug_url` / `report_feature_url` có giá trị; hai field vẫn sửa được ở màn Project và ghi như Directus | Nguyên tắc IX (như D-49); owner yêu cầu bỏ hẳn (2026-10-17) | đổi thương hiệu | — |
| D-95 | Dòng phiên bản cuối sub-menu | "Directus <version>" với icon Directus, link GitHub releases | Không hiện dòng nào | Nguyên tắc IX; `info.version` là phiên bản tương thích 11.17.4 nên hiện số sẽ gây hiểu nhầm; owner chọn B (2026-10-16), rồi bỏ hẳn dòng "Backoffice" (2026-10-17) | đổi thương hiệu | — |
| D-96 | Đường bàn phím cho kéo thả ở cây collection, lưới field (gồm vào/ra nhóm), danh sách `system-modules`, `system-fields`, `list` options | Chỉ chuột | Thêm menu dòng Lên/Xuống/Vào nhóm/Ra nhóm; kéo chuột giữ như Directus | WCAG 2.1.1, Nguyên tắc XII; mở rộng D-69 (014); owner chọn A (Clarifications 2026-10-16), ; duyệt | khác | — |
| D-97 | Mở drawer field cho field không tồn tại (gõ URL) hoặc `?type=` không thuộc 10 localType | Lỗi JavaScript không bắt: `startEditing` gán `field` null rồi vẽ `field.field`; `alterations[type]` không có | Hộp lỗi (`showUnexpectedError`) rồi về màn collection | Không chép lỗi làm hỏng màn; E2E coi `pageerror` là lỗi (đã kiểm T002, 2026-10-16) | khác | — |
| D-98 | Nút hiện/ẩn collection ẩn của module Content | Chỉ ở menu chuột phải của cây collection | Nút icon `visibility`/`visibility_off` (`aria-pressed`) trên dòng "Content" của sidebar (đích `module-actions-<id>` của `AppSidebar`, `Teleport`), chỉ khi module đang mở và có collection ẩn; menu chuột phải giữ | Đường bàn phím (014) nay không chiếm một hàng riêng trên ô tìm; owner yêu cầu (Clarifications 2026-10-16) | khác | — |
| D-99 | Cuộn ở trang danh sách Content, Files, Users | Cả vùng nội dung cuộn (`private-view-main` `overflow: auto`, header bar `sticky`); phân trang nằm dưới bảng, cuộn theo | `PrivateView fill`: trang cao đúng cửa sổ, chỉ thân bảng cuộn; page header và phân trang đứng yên; khung gốc `relative` để nhãn `sr-only` trong bảng không kéo dài trang | Owner yêu cầu (Clarifications 2026-10-16); hành vi và request không đổi | khác | — |
| D-100 | Link "Documentation" (`docs`, `https://docs.directus.io`) trong danh sách `system-modules` | Hiện trong danh sách (dòng link có nút gỡ) | Không hiện trong danh sách; vẫn giữ trong dữ liệu, ghi lại đúng vị trí với tên đã dịch khi lưu, nên dữ liệu ghi giống Directus app | Owner yêu cầu (2026-10-17); Nguyên tắc IX như D-49 (sidebar đã ẩn link này) | đổi thương hiệu | — |
| D-101 | Breadcrumb ở đầu trang (`headline` của header bar) | `v-breadcrumb` trên tiêu đề ở mọi trang có trang cha | Không hiện ở mọi trang; dòng tiêu đề giữ nút quay lại, icon, tiêu đề; trang vẫn truyền `breadcrumb` cho `PageHeader` để bật lại ở một chỗ. Hai bộ parity UI có so breadcrumb (files/users, settings) ghi nó là khác biệt được phép | Owner yêu cầu (2026-10-17) | khác | — |
| D-103 | Tham số `page` khi nạp quyền của policy (`system-permissions`, `GET /permissions?filter[policy]…&limit=-1`) | Gửi `page=0` | Không gửi `page`: `@directus/sdk` 21.3.0 (`query-to-params.ts`) chỉ gửi `page` ≥ 1 | API Directus bỏ qua `page=0` (`sanitize-query.ts` giữ 0, `apply-query` chỉ tính offset khi `page` khác 0 và `limit` khác -1), nên kết quả như nhau; SDK là client duy nhất (012); owner duyệt (2026-10-17) | khác | — |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Khóa `special` `cast-csv` của `ip_access`: giá trị ghi là chuỗi csv như Directus; không đổi.

| Mã | Rủi ro | Nguồn và bằng chứng | Ảnh hưởng | Duyệt |
|----|--------|---------------------|-----------|-------|
| R-40 | `save()` của drawer field nuốt lỗi API (`unexpectedError`) nên drawer đóng dù một bước lỗi; các bước sau vẫn chạy | `field-detail/store/index.ts:221-293` Directus | Có thể tạo collection junction mà không tạo field; app không liệt kê bước đã ghi, dọn tay qua màn data model; như Directus; tái tạo, không sửa | Duyệt (owner, 2026-10-17) |
| R-41 | Trình sửa preset luôn về danh sách trong `finally` kể cả khi `POST`/`PATCH` lỗi | `presets/item.vue` Directus | Người dùng mất form đang sửa khi lỗi; như Directus; tái tạo | Duyệt (owner, 2026-10-17) |
| R-42 | `PATCH /collections` khi kéo thả không được Directus chờ (`onSort` không await) nên lỗi không hiện và cây giữ thứ tự cục bộ sai tới lần nạp sau | `collections.vue:115-141` Directus | App mới làm giống (owner chọn B, Clarifications 2026-10-16); tái tạo, không sửa | Duyệt (owner, 2026-10-17) |

**Trạng thái khác biệt (T122, lượt 5, 2026-10-16; D-100, D-101, D-103 thêm 2026-10-17; owner duyệt cả bảng 2026-10-17)**:

| Mã | Đã làm trong code | Duyệt |
|----|-------------------|-------|
| D-92 | `modules/settings.ts`: `/settings/flows(/*)` là khung 012 (`ModulePlaceholder`); mục "Flows" của `SettingsNavigation.vue` giữ vị trí và nhãn | Owner chọn A (Clarifications); duyệt; **đã gỡ ở 017** |
| D-93 | `modules/settings.ts` không khai báo `ai`, `marketplace`, `extensions`, `system-logs` (rơi vào `settings-not-found`); `ProjectRoute.vue` bỏ `ai_group`, `mcp_group` | Duyệt (owner, 2026-10-17) |
| D-94 | `SettingsNavigation.vue`: không có nhóm "Report Bug", "Request Feature" | Owner bỏ hẳn (2026-10-17); duyệt |
| D-95 | `SettingsNavigation.vue`: không có dòng cuối | Owner bỏ hẳn (2026-10-17); duyệt |
| D-96 | `BoSortableList` (menu dòng Lên/Xuống/Vào nhóm/Ra nhóm) ở cây collection, lưới field, `system-modules`, `system-fields`, options `list` | Owner chọn A (Clarifications); duyệt |
| D-97 | `field-detail/FieldDetail.vue`: field không có hoặc `?type=` lạ → `showUnexpectedError` rồi `router.replace` về màn collection | Duyệt (owner, 2026-10-17) |
| D-98 | `layout/AppSidebar.vue` (đích `module-actions-<id>`) và `modules/content/components/ContentNavigation.vue` (`Teleport` nút hiện/ẩn) | Owner yêu cầu (2026-10-16); duyệt |
| D-99 | `layout/PrivateView.vue` prop `fill` (gốc `relative h-dvh overflow-hidden`), dùng ở `CollectionRoute`, `FilesCollectionRoute`, `UsersCollectionRoute` | Owner yêu cầu (2026-10-16); duyệt |
| D-100 | `interfaces/_system/system-modules/SystemModules.vue`: `isDocsLink` lọc khỏi danh sách; setter chèn lại link docs | Owner yêu cầu (2026-10-17); duyệt |
| D-101 | `layout/PageHeader.vue` không vẽ `nav[aria-label="Breadcrumb"]`; E2E đổi sang nút Back hoặc kiểm không có breadcrumb; `settings-parity-ui`, `files-users-parity-ui` coi breadcrumb của Directus là khác biệt được phép | Owner yêu cầu (2026-10-17); duyệt |
| D-103 | `system-permissions/SystemPermissions.vue` truyền `page: 0` như Directus, SDK bỏ khi gửi; test ghi dạng request của SDK | Owner duyệt (2026-10-17) |
| R-40 | `field-detail/store/index.ts` port nguyên `save()` (nuốt lỗi từng bước như Directus) | Duyệt (owner, 2026-10-17) |
| R-41 | `presets/PresetItemRoute.vue` gọi `router.push` về danh sách trong `finally` như Directus; khi lưu lỗi các sửa còn giữ nên guard sửa dở chặn và hiện hộp `unsaved_changes` (cả hai app), không mất form | Duyệt (owner, 2026-10-17) |
| R-42 | `CollectionsRoute.vue`: `PATCH /collections` khi kéo thả không chờ, không báo lỗi | Owner chọn B (Clarifications); duyệt |

## Câu hỏi mở về design-system (Nguyên tắc XII)

Như 014/015: recipe nháp vào `design-system/docs/` trước khi code (sau khi 015 mở khóa tài liệu), design owner duyệt
trước khi đóng 016. Q-1 (nhãn field), Q-2 (bảng), Q-7 (tìm kiếm, bộ lọc), Q-8 (page header), Q-9 (panel), Q-10
(revisions), Q-11 (comments), Q-12 (hàng loạt), Q-19 (theme) dùng lại.

| Mã | Câu hỏi | Trạng thái |
|----|---------|------------|
| Q-20 | Cây collection của Data Model: mục có tay kéo, icon màu, note, nút gập, menu; folder lồng với thụt cấp; mục mờ khi ẩn; mục "bảng chưa quản lý" với icon `add`; `BoDetail` collection hệ thống; thanh expand all/none; hộp folder (key khóa, icon, màu, note, list bản dịch) | Nháp 2026-10-16 (T005–T007), làm theo code ở lượt 1–4 (T121), owner duyệt 2026-10-17 |
| Q-21 | Lưới field: ô chỉ đọc theo bề rộng half/full/fill với tay kéo, các icon trạng thái, khung group lồng có tiêu đề, dòng field khóa (hệ thống) với ổ khóa, nút `create_field` toàn bề ngang và nút nét đứt "chế độ nâng cao" với menu; badge `saves_automatically` | Nháp 2026-10-16 (T005–T007), làm theo code ở lượt 1–4 (T121), owner duyệt 2026-10-17 |
| Q-22 | Drawer field: chế độ đơn giản với lưới thẻ interface (preview SVG/icon, nhóm, cột theo bề ngang, khung cấu hình chèn dưới hàng thẻ, thẻ không chọn mờ), chế độ nâng cao với tab dọc trong cột trái của drawer (`BoTabs` vertical), notice `new_data_alert`, ô chọn collection/field liên quan với trạng thái "khớp" và menu `select_existing`; ở 768 px tab dọc thành tab ngang cuộn được | Nháp 2026-10-16 (T005–T007), làm theo code ở lượt 1–4 (T121), owner duyệt 2026-10-17 |
| Q-23 | Ma trận quyền: bảng collection × 5 action với chip ba mức (đề xuất: all = nền `success-50` chữ `success-700` icon `check`; none = viền `gray-300` chữ `gray-500` icon `block`; custom = nền `warning-50` chữ `warning-700` icon `rule`; chữ action luôn hiện, mức đọc bằng sr-only), chip khóa (app tối thiểu), vạch `system_collections`, nút gỡ dòng, chân bảng "đặt lại về…", nút thêm collection dạng select; drawer chi tiết với tab dọc có chấm trạng thái, cây field checkbox, ô JSON, cảnh báo tối thiểu | Nháp 2026-10-16 (T005–T007), làm theo code ở lượt 1–4 (T121), owner duyệt 2026-10-17 |
| Q-24 | Sub-menu Settings: ba nhóm có vạch chia trong sub-menu L-3; không link Report (D-94), không dòng cuối (D-95) | Nháp 2026-10-16 (T005–T007), làm theo code ở lượt 1–4 (T121), owner duyệt 2026-10-17 |
| Q-25 | Danh sách kéo thả của `system-modules` (ô bật, ổ khóa, dòng link bấm sửa và nút gỡ, nút `add_link`), `system-fields` (đường dẫn field với mũi tên, nút gỡ, menu thêm), `system-folder` (ô chỉ đọc + menu cây), `system-scope` (select ba mục với mục giá trị hiện tại), `system-owner` (dòng email + nút sửa, drawer SetupForm) | Nháp 2026-10-16 (T005–T007), làm theo code ở lượt 1–4 (T121), owner duyệt 2026-10-17 |
| Q-26 | Trình sửa preset: form tám field, vạch `layout_preview`, layout thật chỉ đọc bên dưới trong khung viền, notice khi chưa chọn; danh sách preset và translations dùng Q-2 | Nháp 2026-10-16 (T005–T007), làm theo code ở lượt 1–4 (T121), owner duyệt 2026-10-17 |
| Q-27 | Drawer tạo collection hai bước (tab dọc, notice đầu bước, sáu dòng field tùy chọn với ô bật + ô tên), hộp tạo role (một ô), hộp tạo policy (ô tên + hai ô bật), hộp nhân bản policy/field, hộp xóa collection với notice danger phụ thuộc | Nháp 2026-10-16 (T005–T007), làm theo code ở lượt 1–4 (T121), owner duyệt 2026-10-17 |
| Q-28 | Chỉnh hiển thị theo góp ý owner khi xem lượt 2 (2026-10-16): lớp phủ drawer tối hơn (`bg-gray-900/50`, tối `gray-950/80`) và viền trái drawer ở chế độ tối; lớp phủ modal nhạt hơn TailAdmin (`bg-gray-900/40` + `backdrop-blur-[2px]`, tối `gray-950/60`) và viền modal ở chế độ tối; tiêu đề nhóm "Modules" của sidebar chỉ còn `sr-only`; popover bộ lọc ở chế độ tối nền `gray-800` viền `gray-700`, mỗi điều kiện lọc là viên pill có viền như `.header` của Directus | Recipe đã sửa (layout-patterns §7, §8; component-specs Modal, Comparison modal), owner duyệt 2026-10-17 |

## Clarifications

### Session 2026-10-16

- Q: `custom_css` của Appearance có áp lên app Backoffice không? → Đã quyết ở 012 (FR-034: chèn vào `#custom-css`
  như Directus); 016 chỉ thêm ô sửa. Không hỏi lại.
- Q: Appearance tách màn riêng hay gộp vào Project? → Như Directus 11.17.4: hai route `/settings/project` và
  `/settings/appearance` (mô tả feature gộp "cài đặt dự án (tên, logo, màu, theme…)" nhưng Nguyên tắc VI giữ route).
- Q: Mục "Flows" trong sub-menu khi 017 chưa có? → A (owner, 2026-10-16): hiện và trỏ khung 012 (D-92) để
  `directus_flows` của D-72 có đích và sub-menu giữ thứ tự, nhãn như Directus; không ẩn, không danh sách chỉ đọc.
- Q: Hộp "chuyển user sang role khác" khi xóa role, cờ `admin_access`/`app_access` trên role? → Không có ở Directus
  11.17.4 (thuộc policy); không làm.
- Q: Có kiểm tên collection/field trùng ở client không? → Không, như Directus; API trả lỗi (edge case).
- Q: Dòng cuối sub-menu Settings (D-95) hiện gì khi `info.version` là phiên bản tương thích 11.17.4? → B (owner,
  2026-10-16): chỉ chữ "Backoffice", không số phiên bản, không link; không đổi `/server/info` (FR-003, D-95, Q-24).
  Khi duyệt (owner, 2026-10-17): bỏ hẳn dòng này.
- Q: Kéo thả sắp xếp collection: chờ `PATCH /collections` và báo lỗi, hay như Directus không chờ? → B (owner,
  2026-10-16): như Directus, không chờ, không báo lỗi; R-42 chỉ ghi nhận hành vi tái tạo (FR-012, Edge Cases, R-42).
- Q: Đường bàn phím cho kéo thả ở Settings (cây collection, lưới field, `module_bar`, `system-fields`, options
  `list`)? → A (owner, 2026-10-16): menu dòng Lên/Xuống/Vào nhóm/Ra nhóm ở cây collection và lưới field, Lên/Xuống ở
  các danh sách còn lại; kéo chuột giữ như Directus (D-96, FR-012, FR-022, FR-074, FR-106; không ngoại lệ a11y).
- Q: Còn điểm nào cần làm rõ trước plan? → Không còn: ba điểm có nhiều cách hiểu (Appearance, Flows, phiên bản) đã chốt
  theo Directus hoặc ghi D-xx chờ duyệt.
- Release-gate (owner, 2026-10-16): áp toàn bộ đề xuất CHK001–CHK105 của `checklists/release-gate-proposals.md` vào
  spec, plan, research, data-model, contracts.
- Góp ý giao diện khi xem lượt 2 (owner, 2026-10-16), áp ngay:
  - Nút hiện/ẩn collection ẩn lên dòng "Content" của sidebar (D-98).
  - Drawer chọn item (`DrawerCollection`) bỏ cột Layout Options cho giống Directus. Đây là bổ sung của 014; slot
    `sidebar` vẫn giữ.
  - Drawer và modal dễ phân biệt với trang; tiêu đề "Modules" của sidebar ẩn (Q-28).
  - Trang danh sách chỉ cuộn trong bảng (D-99).
  - Nút "Update Bookmark" dùng icon SVG riêng của Directus: `BoIcon` port đủ 20 icon `custom-icons`; tên trùng font
    như `box`, `logout` cũng vẽ SVG như Directus.
  - Khung bộ lọc rõ hơn ở chế độ tối (Q-28).
- Góp ý khi xem trang Project (owner, 2026-10-17): app mới mặc định ẩn link "Documentation" trong danh sách thanh module
  (D-100); dữ liệu vẫn giữ link như Directus.
- Góp ý khi xem trang item (owner, 2026-10-17): bỏ breadcrumb ở đầu trang (D-101); page header dính dưới app header khi
  cuộn như header bar `sticky` của Directus (layout-patterns §5).
- Duyệt (owner, 2026-10-17): recipe Q-20 đến Q-28 (T121) và bảng D-92 đến D-101, R-40 đến R-42 (T122) được duyệt, trừ
  hai điểm sửa khi duyệt: sub-menu Settings bỏ hẳn nhóm Report Bug, Request Feature (D-94) và dòng "Backoffice" ở cuối
  (D-95, Q-24).
- Hai khác biệt của lượt 3 (owner, 2026-10-17): hộp tạo role và tạo policy sửa cho giống Directus (`v-dialog
  persistent`): bấm ra ngoài không đóng, chỉ Esc và Cancel về danh sách; `BoDialog` có prop `persistent`, không ghi D-xx
  (mã D-102 bỏ trống). SDK bỏ `page=0` khi nạp quyền của policy: ghi D-103, duyệt.
- Góp ý giao diện sau lượt 5 (owner, 2026-10-17). Các sửa này đưa app về giống Directus nên không thêm D-xx:
  - Ô chọn (`BoSelect`) hiện mục đã chọn kèm icon thật, như `v-select` của Directus. Trước đó in tên ligature, ví dụ
    "table_rows Table" ở ô Layout.
  - Khung bộ lọc (`SearchInput`) mở trong drawer chọn item nằm gọn trong drawer. Thân drawer là vùng va chạm và bề rộng
    co theo chỗ trống; trước đó tràn qua mép trái drawer.
  - Viền focus 3px của ô nhập trên trang item không còn bị cắt ở mép trái: khung cuộn của split panel có đệm 4px.
  - Page header dính dưới app header khi cuộn. Vị trí đo theo border-box nên không giật 1px khi bắt đầu dính.
- Lỗi do các bộ test lượt 5 tìm ra, đã sửa cho giống Directus:
  - Form item của Content (014) không áp quyền theo field: field chỉ đọc vẫn sửa được, preset không điền sẵn. Đã sửa:
    chỉ truyền `fields` vào form, như `item.vue`.
  - Role có 0 user hiện `0` thay vì giá trị rỗng `--` của Directus.
  - Nhãn menu dòng của `list-m2m` hiện tên lưu dạng `$t:` (policy Public).
  - Tương phản: dòng ẩn, sao bắt buộc, icon collection, tab dọc đang chọn.
  - Ô chọn Type ở tab Schema chưa có nhãn.


## Assumptions

- API mới (004) nhận quan hệ lồng `{create, update, delete}` trong `PATCH /roles/:id` (`policies`, `users`) và
  `PATCH /policies/:id` (`permissions`, `users`, `roles`) như Directus (ItemsService/PayloadService đã port); plan kiểm
  T002 bằng bộ so DB; lệch thì là lỗi API (sửa ở API, không đổi body FE).
- API mới có `GET /schema/snapshot` (006), `POST /utils/translations/generate` (010), `POST /settings/owner` (010,
  D-38), `POST /users/invite` (004/015), `/access` (004); `/server/info` trả `version` 11.17.4 và `websocket false`.
- `options` của mọi interface và display 013 giữ đúng dữ liệu `index.ts` Directus (FR-005 của 013), gồm dạng hàm và
  `{standard, advanced}`; `ExtensionOptions` chỉ cần vẽ chúng bằng `BoForm`.
- `BoSortableList` của 013 hỗ trợ `group` lồng (vuedraggable) hoặc được mở rộng ở lượt 1; menu dòng Lên/Xuống đã có
  (D-60, D-69), thêm Vào nhóm/Ra nhóm.
- `use-field-tree` của Directus được port ở 014 cho `system-filter` (`FieldList`); 016 dùng lại cho
  `system-display-template`, `system-field-tree`, `system-fields`, cây field của drawer quyền.
- Store collections/fields/relations của 012 có `hydrate`, `getCollection`, `upsertField`, `updateFields`,
  `deleteField`, `upsertCollection`, `updateCollection`, `deleteCollection`, `upsertRelation` như Directus; thiếu hàm
  nào thì thêm port ở lượt 1 (ghi ở plan).
- Store settings 012 mở rộng `updateSettings` với notice và hoàn tác, thêm `setOwner` (comment đầu file đã ghi "016").
- Store translations 012 chưa có `refreshCurrentLanguage` (đã kiểm 2026-10-16): 016 chép `lang/refresh-current-language.ts` (FR-086); store flows 012 có danh
  sách flow manual cho `system-manual-flow-select`.
- `UsersInvite` của 015 nhận prop `role` sẵn và ẩn ô role (như `users-invite.vue`).
- Dữ liệu tĩnh (quyền tối thiểu, quyền gợi ý, `MODULE_BAR_DEFAULT`) chép bằng script có test so nguồn, tên file không
  chứa "directus" (D-89 áp dụng); `check-brand` miễn dữ liệu sinh.
- Hiệu năng theo máy tham chiếu và `machineFactor()` như 014/015; perf trong `PERF=1`.
- Tài liệu ngoài `specs/016-*` chỉ sửa sau khi 015 mở khóa working tree (FR-111).
- Bộ so DB `helpers/db-rows.ts` của 014/015 đọc Postgres trực tiếp ở `proxy-api`; 016 mở rộng bảng; so sau chuẩn hóa
  `id`, thời gian, `sort` tự tăng của `directus_fields`.
- Mọi chuỗi i18n nêu trong spec (`creating_new_collection`, `delete_collection_peer_dependencies`,
  `admins_have_all_permissions`, `reset_system_permissions_to`, `interfaces.system-owner.*`,
  `no_layout_collection_selected_yet`…) có trong `en-US.yaml` của Directus 11.17.4 (file sinh của 012 lấy toàn bộ).
- SC-002, SC-003 đo trên Postgres của env parity; DDL trên vendor khác dựa vào parity 006.
- Seed `bo_settings` chạy sau `bo_users` của 015 (`bo_s_role` là con của `bo-editor`).
- `custom_css`, template `report_error_url`, link `module_bar` là nội dung admin tin cậy, chèn như Directus (012
  FR-034), không lọc.
- Nếu T002 thấy API mới không nhận quan hệ lồng như Directus, 016 thêm task sửa `apps/api` (lượt 3) kèm cập nhật parity
  004.
- `BoTabs` 013 chưa có `orientation` (đã kiểm 2026-10-16): 016 thêm prop (Reka Tabs) và test phím mũi tên lên/xuống.
- T002 kiểm store collections có dòng `directus_*` và store fields có `meta.system`; T003 chạy tay bốn luồng ghi trên
  Directus app 8155 (tạo collection, field m2m, policy với quyền, preset) và lưu body làm mốc trước khi viết bộ so
  payload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% kịch bản E2E của US1 đến US7 đạt ở ba cấu hình API (Directus thật, API mới cùng origin, API mới khác
  origin) trên chromium 768 và 1280; cùng origin thêm firefox-1280 và webkit-1280 cho ba spec lõi
  (`settings-data-model`, `settings-field-detail`, `settings-roles-policies`); cors chỉ chromium-1280; spec điều khiển
  Directus app chỉ chromium-1280 (`DIRECTUS_APP_SPECS`, giới hạn 100 phút của job, như 014/015).
- **SC-002**: Data model tạo ở app mới (collection `bo_articles` với 10 field của US3 Independent Test, 7 collection
  sinh (danh sách ở US3 Independent Test), 8 dòng ngôn ngữ) mở được trên Directus app 8155 và tạo được item điền đủ 10
  field với giá trị của `contracts/tests.md` §5 mà không sửa gì; dòng `directus_collections`, `directus_fields`,
  `directus_relations` bằng dòng Directus app ghi cho cùng thao tác sau chuẩn hóa (`id`, `sort` tự tăng); và ngược lại
  (tạo ở Directus app, mở ở app mới: lưới field, drawer field hiện cùng giá trị) — đây là tiêu chí "data model tạo trên
  app mới dùng được ngay trên Directus".
- **SC-003**: Role + policy + 3 permission (read all, create custom, update custom; delete và share không có dòng) tạo ở
  app mới (US4 Independent Test): user của role đó đăng nhập trên Directus app và app mới cho cùng kết quả ở 6 thao tác
  (tạo item, đọc, sửa item của mình, sửa item người khác bị chặn, xóa bị chặn, field không được đọc không hiện); dòng
  `directus_permissions`, `directus_access`, `directus_policies`, `directus_roles` bằng Directus app sau chuẩn hóa —
  tiêu chí "quyền tạo trên app mới dùng được ngay trên Directus". Sáu thao tác này là danh sách chuẩn (US4, FR-102,
  `contracts/tests.md` §5 trỏ về đây); đo bằng HTTP status của request và DOM (`aria-disabled`, có hay không trong DOM).
- **SC-004**: Với bộ mẫu `bo_settings`, so với Directus app trên cùng DB bằng E2E song song (admin), 0 lệch ngoài D-xx ở
  năm thuộc tính: (a) nhãn và thứ tự mục sub-menu và cây collection (gồm folder, mục chưa quản lý, hệ thống), (b) tiêu
  đề và breadcrumb của 13 màn (danh sách collection, màn collection, danh sách role, trang role, Public, danh sách
  policy, trang policy, Project, Appearance, danh sách preset, trình sửa preset, danh sách translation, trang
  translation), (c) chuỗi dòng số đếm (user, role, bookmarks, presets) và nhãn chip quyền, (d) `disabled`/ẩn của 14 nút
  (tạo folder, tạo collection, xóa collection, lưu collection, tạo field, next, finish, lưu field, tạo role, mời, xóa
  role, tạo policy, nhân bản policy, tạo preset; "ẩn" = không có trong DOM), (e) mục panel hiện; thu bằng `innerText` và
  `aria-disabled`; preset tạo ở app mới hiện ở cây Content của cả hai app.
- **SC-005**: 100% body ghi (FR-018, FR-029, FR-043, FR-054, FR-060, FR-077, FR-087) của kịch bản E2E bằng body Directus
  app gửi cho cùng kịch bản sau chuẩn hóa (FR-101: `id`, thời gian, `nanoid` của link và `autoKey`, thứ tự khóa; mảng
  giữ thứ tự); lệch thật ghi R-xx. Mỗi request ghi #157–#177 được ít nhất một kịch bản kích hoạt (bảng kịch bản →
  request ở `contracts/tests.md` §4).
- **SC-006**: Store field: test port `store/index.test.ts` của Directus đạt 100%; 10 alteration cho 20 kịch bản mẫu
  (m2o, o2m, m2m, m2a, translations × collection liên quan có sẵn và chưa có = 10; file; files; standard với hai kiểu;
  presentation; group; m2o tự quan hệ; o2m tự quan hệ; m2m với junction có sẵn; field có sẵn đổi interface) sinh cùng
  `fieldUpdates`, `collections`, `fields`, `relations`, `items` như Directus (so JSON); `ExtensionOptions` vẽ đúng số
  field cho mọi interface và display 013 (test registry); 18 interface `_system` có test component với request đúng
  allowlist.
- **SC-007**: Hiệu năng FR-108 đạt (ngân sách nhân `machineFactor()`); số request mỗi thao tác đúng như FR-108.
- **SC-008**: Recipe Q-20 đến Q-28 được design owner duyệt, `qa/handoff-checklist.md` đạt trước khi đóng; axe 0 vi phạm
  serious/critical trên 13 màn của SC-004 và 4 drawer/hộp của FR-106 ở sáng và tối; đường bàn phím D-96 có test (di
  chuyển bằng menu gửi cùng body kéo thả) ở năm nơi: cây collection, lưới field, `system-modules`, `system-fields`,
  options `list`.
- **SC-009**: Coverage `apps/web` ≥ 60%; lint, typecheck, unit, E2E ba cấu hình, build image xanh; chunk chính ≤ ngân
  sách 015 + 20 KB gzip; 0 màu thô ngoài danh sách miễn; 0 file trong `directus/` bị sửa; 0 request ngoài FR-110.
- **SC-010**: D-92 đến D-103 và R-40 đến R-42 được tech lead duyệt; D-40 (Settings), D-56, D-57, D-71, D-72 (phần 016),
  D-85 ghi "đã gỡ ở 016" ở spec gốc; ghi chú cho 017 và 018 trong `SPECKIT-GUIDE.md`. Duyệt ghi ở bảng trạng thái khác
  biệt của spec (như 015 T103).
