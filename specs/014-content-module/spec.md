# Feature Specification: Module Content (duyệt và chỉnh sửa dữ liệu như Directus)

**Feature Branch**: `014-content-module` (làm trên `main` như 012 và 013, không tạo branch vì dùng chung working tree; 013
chưa commit lúc viết spec này, 014 chỉ sửa `specs/014-*` cho tới khi 013 commit xong)
**Created**: 2026-10-15
**Status**: Done (2026-10-16, waves 1–4, 91025bb)
**Duyệt khác biệt**: tech lead duyệt ngày 2026-10-15 D-69 (đường bàn phím cho kéo thả) và D-73 (`system-filter`,
`system-input-translated-string` làm ở 014); D-67, D-68, D-70 đến D-72 là hệ quả của XI và D-40, duyệt gộp cùng Q5
(release-gate CHK067). D-74 (xác nhận xóa nhóm kanban) chỉ ghi nếu T003 thấy Directus không hỏi.
**Duyệt release-gate**: owner duyệt toàn bộ đề xuất của `checklists/release-gate-proposals.md` ngày 2026-10-15 (101
mục); đã áp vào spec, data-model, contracts, research.
**Input**: User description: "Người dùng duyệt và chỉnh sửa dữ liệu trong module Content giống Directus: danh sách
collection theo nhóm và folder, xem item với các layout table, cards, calendar, kanban và map (nguồn tile bản đồ cấu hình
được như Directus: Mapbox key hoặc tile server riêng), tìm kiếm, lọc, sắp xếp, chọn cột, lưu bookmark và preset, xuất và
nhập dữ liệu, thao tác hàng loạt. Trang chi tiết item có form theo cấu hình field, điều kiện ẩn hiện field, validation,
lưu và lưu tiếp, xóa, archive, sidebar revisions, comments, versions và chia sẻ. Hỗ trợ collection singleton. Chỉ hiện
những gì user có quyền. Danh sách phải mượt với collection khoảng 10 triệu bản ghi (phân trang và đếm phía server). Tham
chiếu directus/app/src/modules/content và layouts. Giao diện theo design-system/ (TailAdmin: theme, component-specs,
layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: các luồng chính của
module Content trên Directus làm được tương tự trên app mới. Ghi chú từ 013 (đưa vào spec 014): 013 chỉ làm component
(form, interface, display, drawer), không có màn hình. 014 nhận: màn item /content/:collection/:primaryKey dùng BoForm,
lưu item, hỏi unsaved_changes (FR-084 của 013); E2E ba cấu hình và so payload ghi với Directus app trên bộ mẫu
apps/web/fixtures/interfaces (dùng lại script seed); drawer chọn item theo layout của preset và bộ lọc nâng cao (D-58);
màn revisions, versions và chế độ so sánh (D-55); nội dung module Content (D-40); sự kiện "flow đã chạy" của header để
nạp lại item."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/app/src` trừ khi ghi khác):

- Module: `modules/content/index.ts` (route `no-collections`, `content-collection`, `content-item`,
  `content-item-preview`, `content-item-not-found`; guard `checkForSystem`; `getArchiveValue`; collection truy cập
  gần nhất trong localStorage), `routes/collection-or-item.vue` (singleton → item), `routes/collection.vue`,
  `routes/item.vue`, `routes/no-collections.vue`, `routes/not-found.vue`, `routes/preview.vue`,
  `components/navigation.vue`, `NavigationItem.vue`, `navigation-item-content.vue`, `navigation-bookmark.vue`,
  `composables/use-navigation.ts`, `components/version-menu.vue`, `version-promote-field.vue`.
- Layout: `layouts/index.ts` (đăng ký `layout-<id>`, `layout-options-<id>`, `layout-sidebar-<id>`,
  `layout-actions-<id>`), `layouts/{tabular,cards,calendar,kanban,map}/{index.ts,types.ts,*.vue,options.vue,actions.vue}`,
  `layouts/cards/components/{card,header}.vue`, `layouts/map/components/map.vue`, `layouts/map/style.ts`;
  `@directus/composables` `use-layout.ts`, `use-items.ts` (`directus/packages/composables/src`), `utils/geometry/*`
  (`basemap.ts`: OpenStreetMap mặc định, Mapbox khi `settings.mapbox_key`, `settings.basemaps`),
  `utils/format-items-count.ts`, `utils/save-as-csv.ts`, `utils/adjust-fields-for-displays.ts`,
  `composables/use-layout-click-handler.ts`, `composables/use-filter-fields.ts`.
- Preset và bookmark: `composables/use-preset.ts` (lưu tự động sau 450 ms khi không có bookmark; trạng thái đã lưu của
  bookmark), `stores/presets.ts`, `views/private/components/bookmark-add.vue`, `utils/get-route.ts`
  (`getCollectionRoute`, `getItemRoute`, `getSystemCollectionRoute`).
- Màn item: `composables/use-item/index.ts` (`save`, `saveAsCopy`, `remove`, `archive`, `validationErrors`),
  `composables/use-edits-guard.ts`, `composables/use-versions.ts`, `composables/use-template-data.ts`,
  `composables/use-flows.ts`, `composables/use-permissions/*` (`useCollectionPermissions`, `useItemPermissions`),
  `views/private/components/save-options.vue`, `flow-dialogs.vue`, `render-template.vue`.
- Sidebar và hộp thoại: `views/private/components/sidebar-detail.vue`, `layout-sidebar-detail.vue`,
  `archive-sidebar-detail.vue`, `refresh-sidebar-detail.vue`, `export-sidebar-detail.vue` (xuất và nhập),
  `import-error-dialog.vue`, `flow-sidebar-detail.vue`, `revisions-sidebar-detail.vue`, `revisions-date-group.vue`,
  `revision-item.vue`, `composables/use-revisions.ts`, `comments-sidebar-detail.vue`, `comment-input.vue`,
  `comment-item.vue`, `comment-item-header.vue`, `shares-sidebar-detail.vue`, `share-item.vue`,
  `comparison/{comparison-modal,comparison-header,comparison-toggle}.vue`, `comparison/use-comparison.ts`,
  `search-input.vue` (ô tìm kiếm và nút bộ lọc dùng `interface-system-filter`), `drawer-batch.vue`,
  `drawer-collection.vue` (layout theo preset ở chế độ chọn).
- Bộ lọc: `interfaces/_system/system-filter/*` (cây `_and`/`_or`, toán tử theo kiểu field, field quan hệ, biến động
  `$CURRENT_USER`, `$CURRENT_ROLE`, `$NOW`), `interfaces/_system/system-input-translated-string/*` (tên bookmark).
- Share: `routes/shared/shared.vue` (sau khi đăng nhập share, `router.replace(getItemRoute(collection, item))`),
  `views/shared/shared-view.vue`.
- Chuỗi dịch: `lang/translations/en-US.yaml` mục `layouts:`, khóa gốc `item_count`, `no_items`, `no_results`,
  `clear_filters`, `per_page`, `showing_count`..., `creating_in`, `editing_in`, `unsaved_changes`, `save_and_stay`,
  `save_as_copy`, `discard_all_changes`, `batch_delete_confirm`, `archive_confirm_count`, `bookmark_doesnt_exist`,
  `revisions`, `comments`, `shares`, `versions`...

**Đã có từ feature 001 đến 013**: API đầy đủ cho mọi lời gọi của module (`/items`, `/utils/sort`, `/presets`, `/revisions`,
`/versions` (`compare`, `save`, `promote`), `/comments`, `/shares` (`invite` chỉ ghi log, D-36), `/flows/trigger/:id`,
`/utils/export/:collection`, `/utils/import/:collection`, `/settings` với `mapbox_key`, `basemaps`). `apps/web` (012) có
khung TailAdmin (sidebar một cấp sub-menu L-3, page header, panel chi tiết L-4 `DetailPanel`), module `content` đăng ký
với route khung (`placeholderRoutes`, D-40), store `collections`, `fields`, `relations`, `permissions`, `presets`
(`getPresetForCollection`), `flows` (hydrate), `settings`, `user`, trang `/shared/:id`. 013 có `BoForm` (điều kiện,
validation, chế độ batch, chế độ so sánh D-55, cờ "có thay đổi" FR-084), 40 interface, 18 display, `RenderDisplay`,
`RenderTemplate`, `ItemsMenu`, `DrawerItem`, `DrawerCollection` (chỉ bảng, D-58), `DrawerBatch`, `DrawerFiles`,
`BoTable` (bảng đơn giản), `BoMapFrame`, `BoEditorFrame`, `BoSortableList`, composable `use-items`, `use-collection`,
`use-template-data`, `use-run-manual-flow`, `use-page-size`, `use-column-widths`, `use-alias-fields`, bộ mẫu
`apps/web/fixtures/interfaces` (seed + export, collection `bo_*`, user `bo-editor`, `bo-viewer`), chuỗi dịch `en-US`,
`vi-VN` đã gồm mục `layouts`. Chưa có: mọi màn hình của module Content, năm layout, preset và bookmark trên màn, bộ lọc
nâng cao, sidebar item, menu version, xuất nhập, thao tác hàng loạt trên màn, E2E với dữ liệu thật qua màn.

**Bộ test liên quan của Directus** (liệt kê bằng `ls` ngày 2026-10-15): `modules/content/components/version-menu.test.ts`,
`layouts/kanban/kanban.test.ts`, `layouts/calendar/options.test.ts`, `views/private/components/drawer-batch.test.ts`,
`export-sidebar-detail.test.ts`, `flow-sidebar-detail.test.ts`, `refresh-sidebar-detail.test.ts`,
`search-input.test.ts`, `composables/use-flows.test.ts`, `use-versions.test.ts`, `use-item/index.test.ts`,
`comparison/use-comparison.test.ts`, `use-revision.ts` (không có test), `directus/packages/composables/src/use-items.test.ts`.
Viết cho component Directus nên không port nguyên văn; dùng làm danh sách hành vi cần kiểm (FR-124). E2E của Directus app
qua proxy: `tests/directus-app-e2e/src/items.spec.ts`, `history.spec.ts` (005, 008) là mốc so sánh luồng.

## User Scenarios & Testing *(mandatory)*

Người dùng là admin và người dùng app (có `app_access`) đang dùng module Content của Directus app với cùng DB, nay làm
cùng việc trên app Backoffice: chọn collection, xem danh sách item ở layout đã lưu, tìm, lọc, sắp xếp, mở item, sửa,
lưu, xem lịch sử, bình luận, chia sẻ, xuất nhập dữ liệu. Preset, bookmark, item, revision, comment, version, share tạo
ở app này hiện đúng ở app kia.

Phạm vi: mọi route của module Content (`/content`, `/content/:collection`, `/content/:collection/:primaryKey`), năm
layout và option của chúng, preset và bookmark, tìm kiếm và bộ lọc nâng cao, màn item với sidebar (revisions, comments,
shares, flows) và menu version, xuất nhập, thao tác hàng loạt, drawer chọn item theo layout (gỡ D-58), chế độ so sánh
(gỡ D-55), trang item của share, E2E ba cấu hình. Ngoài phạm vi: collection hệ thống (`directus_users`, `directus_files`...
chuyển hướng tới module của chúng như Directus; nội dung là 015, 016, 018, D-40), trình cấu hình preset ở Settings (016),
snackbar thông báo (018, D-66), AI, collab, visual editing (XI). Live preview (`preview_url`) trong phạm vi, không có
visual editing (Clarifications Q1, FR-063 đến FR-069).

### User Story 1 - Danh sách collection và bảng item (Priority: P1)

Người dùng vào module Content, thấy cây collection theo nhóm và folder như Directus (nhóm mở/đóng/khóa, collection ẩn,
ô tìm collection khi nhiều), vào một collection và thấy bảng item ở layout đã lưu: cột, độ rộng, sắp xếp, phân trang,
số item, chọn nhiều; bấm một dòng mở item. Với collection khoảng 10 triệu bản ghi, trang đầu hiện ngay, số đếm về sau
và không chặn thao tác.

**Why this priority**: Là màn mở đầu của mọi luồng; bảng là layout mặc định của mọi collection.

**Independent Test**: E2E trên bộ mẫu `bo_*`: mở `/content`, so cây collection với Directus app, mở `bo_std`, đổi cột,
độ rộng, sắp xếp, trang, kích thước trang, tìm kiếm; so request `/items` gửi đi (query `fields`, `sort`, `limit`,
`page`, `filter`, `search`, `aggregate`) và dòng `directus_presets` ghi ra với Directus app. Benchmark hằng tuần trên
collection 10 triệu dòng của 005.

**Acceptance Scenarios**:

1. **Given** collection có `meta.group` lồng hai cấp, folder (collection không có `schema`), collection ẩn
   (`meta.hidden`), `collapse` là `open`, `closed`, `locked`, **When** mở `/content`, **Then** cây hiện như
   `navigation.vue`: nhóm `open`/`locked` mở sẵn, nhóm chứa collection đang xem tự mở, menu chuột phải "Hiện collection
   ẩn" khi có collection ẩn, ô tìm khi có hơn 20 collection hiện, không có collection thì màn `no_collections` (admin có
   nút tạo collection trỏ tới khung Settings).
2. **Given** `/content` và collection truy cập gần nhất lưu ở localStorage, **When** mở lại app, **Then** chuyển tới
   collection đó nếu còn thấy được; không thì collection gốc đầu tiên (bỏ qua nhóm đang đóng) như `index.ts`.
3. **Given** preset của collection chưa có, **When** mở collection, **Then** bảng có 4 field hiện đầu (bỏ `hidden` và
   `no-data`), sắp theo field sort hoặc khóa chính, 25 dòng mỗi trang, dòng "1-25 of N items"; đổi cột, độ rộng, căn
   lề, khoảng cách dòng, sắp xếp, trang và kích thước trang thì preset được lưu tự động sau 450 ms vào `/presets`
   (`layout_query.tabular`, `layout_options.tabular`) với cùng dạng Directus ghi (mẫu body kỳ vọng ở
   `fixtures/interfaces/snapshot/expected.content.json`, ghi tay từ Directus app; bộ so payload là xác nhận cuối).
4. **Given** collection 10 triệu dòng (benchmark 005), **When** mở trang đầu, đổi trang, sắp xếp, lọc, **Then** request
   danh sách chỉ có `limit`, `page`, `fields` đã chọn; số đếm gọi riêng bằng `aggregate` (countDistinct khóa chính) và
   hiện sau khi về; bảng và thao tác không chờ số đếm; SC-003.
5. **Given** không có item, **When** mở collection, **Then** trạng thái trống `item_count 0` với nút tạo (khi có quyền);
   có bộ lọc mà không khớp thì `no_results` với nút xóa bộ lọc; API lỗi thì notice lỗi với nút "đặt lại tùy chọn trang".
6. **Given** đã chọn một dòng, **When** bấm dòng khác, **Then** thêm vào lựa chọn (không mở item); Ctrl/Cmd + click dòng
   khi chưa chọn mở item ở tab mới.

---

### User Story 2 - Trang item: form, lưu, xóa, archive, singleton (Priority: P1)

Người dùng mở item (hoặc tạo mới bằng `+`), thấy form `BoForm` theo cấu hình field và quyền, sửa, lưu và thoát, lưu và ở
lại, lưu và tạo tiếp, lưu thành bản sao, bỏ thay đổi, xóa, archive/unarchive; rời trang khi còn thay đổi thì được hỏi.
Collection singleton mở thẳng form, không có danh sách.

**Why this priority**: Là nơi dữ liệu được ghi; mô tả nêu riêng từng thao tác; FR-084 và D-40 của 013 bàn giao.

**Independent Test**: E2E trên bộ mẫu: với mỗi collection `bo_*`, tạo, sửa, lưu, bản sao, xóa, archive ở app mới và ở
Directus app; so body `POST`/`PATCH`/`DELETE /items/*` (sau JSON round-trip, bỏ phần không ổn định) và dòng
`directus_activity`, `directus_revisions`; so với kịch bản sửa trong `expected.*.json` của 013.

**Acceptance Scenarios**:

1. **Given** item có `display_template`, **When** mở, **Then** tiêu đề là template đã điền, breadcrumb về collection
   (giữ `?bookmark=` nếu đến từ bookmark), tab là `<tên collection> | <template>`; item mới thì tiêu đề `creating_in`.
2. **Given** form có thay đổi, **When** Ctrl/Cmd + S, **Then** lưu và ở lại; item mới thì URL đổi thành khóa mới; Ctrl/Cmd
   + Shift + S lưu và mở form tạo mới; nút chính lưu rồi về danh sách; menu có `save_as_copy` (ẩn khi item mới, khóa khi
   không có quyền tạo) và `discard_all_changes`.
3. **Given** `saveAsCopy` trên item có o2m, m2m, m2a, translations, **When** lưu bản sao, **Then** body gửi như
   `use-item/index.ts` (khóa chính bị xóa, item nối tạo mới, m2o giữ khóa), rồi chuyển tới item mới.
4. **Given** API trả `FAILED_VALIDATION`, **When** lưu, **Then** form hiện lỗi tổng hợp và theo field (013), không rời
   trang; lỗi khác hiện hộp thoại lỗi.
5. **Given** có thay đổi chưa lưu, **When** bấm link khác (kể cả đổi `?version=`), **Then** hộp `unsaved_changes` với
   "Bỏ thay đổi" / "Tiếp tục sửa"; đóng tab thì `beforeunload` của trình duyệt như Directus.
6. **Given** collection có `archive_field`, **When** bấm archive, **Then** hỏi xác nhận, `PATCH` giá trị
   `archive_value`, về danh sách; item đã archive thì nút là unarchive và ở lại trang; không có quyền thì nút khóa với
   tooltip `not_allowed`.
7. **Given** collection singleton, **When** mở `/content/<singleton>`, **Then** form của item duy nhất (tạo nếu chưa có,
   như `useItem` với singleton), tiêu đề là tên collection, không có nút quay lại, xóa, archive, lưu-và-tạo-tiếp;
   `/content/<singleton>/<pk>` là không tìm thấy.
8. **Given** user không có quyền `update`, **When** mở item, **Then** form chỉ đọc, nút lưu khóa; không có quyền `read`
   field thì field không hiện (field từ `/permissions/me`).

---

### User Story 3 - Tìm kiếm, bộ lọc nâng cao, bookmark và preset (Priority: P1)

Người dùng gõ tìm kiếm, mở bộ lọc nâng cao (cây điều kiện `_and`/`_or`, toán tử theo kiểu field, field quan hệ, biến
`$CURRENT_USER`...), thấy số điều kiện đang áp; lưu trạng thái hiện tại thành bookmark (tên, icon, màu), mở bookmark từ
cây, sửa hoặc xóa bookmark của mình, cập nhật bookmark khi đổi, đặt lại. Preset của role và toàn cục (tạo ở Directus)
áp đúng.

**Why this priority**: Lọc và bookmark là cách người dùng quay lại dữ liệu của mình; preset dùng chung với Directus.

**Independent Test**: E2E: tạo bộ lọc 3 cấp ở app mới, so `filter` ghi vào `directus_presets` với bộ lọc tương đương tạo
ở Directus app; tạo bookmark ở app này mở ở app kia; preset role và global seed qua API hiện đúng cho `bo-editor`.

**Acceptance Scenarios**:

1. **Given** bộ lọc `{_and: [{status: {_eq: 'published'}}, {_or: [{author.name: {_contains: 'a'}}, {date: {_gte: '$NOW(-7 days)'}}]}]}`,
   **When** dựng bằng bộ lọc nâng cao, **Then** JSON lưu bằng với Directus (so sâu sau JSON round-trip: thứ tự mảng
   `_and`/`_or` giữ, thứ tự khóa object không tính), nút bộ lọc hiện "3", danh sách gọi `/items` với `filter` đó cộng
   bộ lọc archive hệ thống (`mergeFilters`).
2. **Given** chưa có bookmark, **When** bấm tạo bookmark, **Then** hộp thoại tên (chuỗi dịch `$t:`), icon, màu; lưu thì
   `POST /presets` với `user` là mình và chuyển tới `?bookmark=<id>`; bookmark hiện dưới collection trong cây.
3. **Given** đang ở bookmark của mình và đổi sắp xếp, **When** xem tiêu đề, **Then** icon "lưu bookmark" (chưa lưu) và
   icon "đặt lại"; lưu thì `PATCH /presets/:id`; bookmark của role/global thì chỉ có "tạo bookmark mới" và sửa trỏ tới
   `/settings/presets/:id` (khung 016).
4. **Given** `?bookmark=` không tồn tại, **When** mở, **Then** notice `bookmark_doesnt_exist` với nút về collection.
5. **Given** preset của user, của role và toàn cục cho cùng collection, **When** mở collection không bookmark, **Then** ưu
   tiên user, rồi role, rồi global như `stores/presets.ts`; đổi layout khi đang dùng preset (không bookmark) role/global
   thì tạo preset mới của user (store `savePreset`); đang ở bookmark role/global thì không tự lưu, chỉ có "tạo bookmark"
   (FR-012, FR-015).

---

### User Story 4 - Layout cards, calendar, kanban, map (Priority: P2)

Người dùng đổi layout ở panel bên phải, chỉnh option của layout (ảnh, tiêu đề, field ngày, field nhóm, field hình học,
nền bản đồ...), kéo thả sự kiện và thẻ, chọn nhiều, mở item. Nền bản đồ lấy từ settings như Directus: OpenStreetMap mặc
định, Mapbox khi có `mapbox_key`, tile server riêng trong `basemaps`.

**Why this priority**: Bốn layout này ít dùng hơn bảng nhưng mô tả nêu đủ năm; option lưu chung preset với Directus.

**Independent Test**: Test component mỗi layout với bộ mẫu (`bo_std` có ngày, chọn, m2o, ảnh, hình học): khẳng định
request `/items` (fields, filter theo vùng ngày hoặc bbox, limit) và `layout_options` ghi ra; E2E một kịch bản mỗi layout
so với Directus app.

**Acceptance Scenarios**:

1. **Given** layout `cards` với `imageSource`, `title`, `subtitle` template, `size`, `imageFit`, **When** hiện, **Then**
   thẻ có ảnh `/assets/<id>?key=system-medium-cover|contain`, tiêu đề và phụ đề đã điền, lưới theo `size`, chọn nhiều,
   phân trang như bảng.
2. **Given** layout `calendar` với `startDateField`, `endDateField` kiểu `date`, **When** đổi tháng, **Then** request
   dùng bộ lọc theo vùng ngày đang xem (`_between`, `_lte`/`_gte`) với `limit` bằng giới hạn query của server (hoặc
   1000); kéo sự kiện thì `PATCH /items/:collection/:id` với ngày đã chỉnh theo kiểu field; sự kiện cả ngày khi field
   kết thúc là `date`.
3. **Given** layout `kanban` nhóm theo field `choices` và theo m2o, **When** kéo thẻ sang cột khác, **Then** `PATCH`
   field nhóm; đổi thứ tự trong cột gọi `/utils/sort` khi có field sort; nhóm m2o tạo, đổi tên, xóa được khi có quyền;
   cột "chưa nhóm" chỉ khi field nullable; thẻ hiện ảnh, tiêu đề, text, ngày, tag, avatar user như Directus.
4. **Given** layout `map` trên field `geometry.Point` (PostGIS), **When** di chuyển bản đồ, **Then** request thêm
   `_intersects_bbox` theo khung nhìn; field json/csv thì không lọc theo khung; `clusterData` gom điểm; bấm điểm hiện
   popup template; kéo vùng chọn nhiều; khung nhìn lưu vào `layout_options.map.cameraOptions`.
5. **Given** settings có `mapbox_key` và một `basemaps` kiểu `raster` URL `{a-c}`, **When** mở option bản đồ, **Then**
   danh sách nền: Mapbox (style sáng/tối theo giao diện), OpenStreetMap, nền riêng; chọn nền riêng thì tile tải từ URL
   mở rộng `a`, `b`, `c`; không có `mapbox_key` thì không có mục Mapbox và không request Mapbox.

---

### User Story 5 - Sidebar item: revisions, comments, shares, flows; versions (Priority: P2)

Ở trang item, panel bên phải có Revisions (danh sách theo ngày, phân trang, so sánh với bản trước hoặc mới nhất, khôi
phục từng field), Comments (viết, nhắc `@user`, sửa, xóa), Shares (tạo, sửa, chép link, gửi mời, xóa), Flows thủ công.
Collection bật `versioning` có menu version trong breadcrumb: tạo, đổi tên, xóa, chuyển, lưu version, so sánh và
promote về bản chính.

**Why this priority**: Mô tả nêu bốn sidebar và version; API đã có (008, 009, 010); D-55 bàn giao.

**Independent Test**: E2E trên `bo_std` (bật versioning qua seed): tạo version ở app này, lưu, so sánh, promote ở app
kia; sửa item rồi revert một field; viết comment nhắc `bo-viewer` ở app mới, đọc ở Directus; tạo share, mở `/shared/:id`
ẩn danh. So dòng `directus_versions`, `directus_revisions`, `directus_comments`, `directus_shares`,
`directus_notifications`.

**Acceptance Scenarios**:

1. **Given** item có 25 revision, **When** mở Revisions, **Then** số đếm, 10 mục mỗi trang nhóm theo ngày, mục ghi ai và
   lúc nào (user `private_user` khi không đọc được); bấm mục mở hộp so sánh chế độ revision: "so với bản trước" /
   "mới nhất", chỉ hiện khác biệt, chọn field, "Apply" ghi giá trị vào form (chưa lưu) như Directus; revision không có
   delta hiện `revision_delta_created_externally`.
2. **Given** comment có `@<uuid>`, **When** hiện, **Then** uuid thay bằng tên user đánh dấu; gõ `@` gợi ý user; Ctrl/Cmd +
   Enter gửi; `POST /comments` tạo `directus_notifications` cho người được nhắc (008); sửa, xóa comment của mình.
3. **Given** user có quyền share, **When** tạo share (tên, role, mật khẩu, ngày bắt đầu/kết thúc, số lần dùng), **Then**
   `POST /shares` với `collection`, `item`; mục share có "chép link" `<origin>/admin/shared/<id>`, "gửi" (gọi
   `/shares/invite`, API ghi log, D-36) và xóa; không có quyền thì mục Shares ẩn.
4. **Given** collection bật `versioning`, **When** tạo version "Draft 2" trong menu, **Then** `POST /versions` với
   `key` slug `draft-2`, `name`, `collection`, `item`; chọn version thì URL thêm `?version=draft-2`, form nạp
   `?version=` của item (`handleVersion` 008), nút lưu thành "lưu version" (`POST /versions/:id/save`), menu có
   "lưu và về bản chính", "lưu và thoát", "bỏ thay đổi"; Revisions lọc theo version; Comments, Shares, Flows ẩn khi
   đang ở version.
5. **Given** version có delta, **When** mở so sánh, **Then** `GET /versions/:id/compare`: khác biệt, `outdated`,
   `mainHash`; chọn field và promote gọi `POST /versions/:id/promote` với `mainHash`, `fields`; tùy chọn xóa version
   sau promote; đổi version khi còn thay đổi thì hỏi trước; kiểm: dòng `directus_versions` mất khi chọn xóa, item chính
   đổi, `directus_activity` của item chính có dòng `update` như Directus (008).
6. **Given** flow thủ công `location: item` có `requireConfirmation`, **When** bấm trong Flows, **Then** hộp xác nhận với
   form `options.fields` (013), chạy `POST /flows/trigger/:id` với `collection`, `keys`, rồi item nạp lại (sự kiện
   "đã chạy" của 013); có thay đổi chưa lưu thì hỏi `run_flow_anyway` trước.

---

### User Story 6 - Xuất, nhập, thao tác hàng loạt, archive, tự làm mới (Priority: P2)

Người dùng xuất dữ liệu (CSV, JSON, XML, YAML; tải về hoặc lưu vào thư viện file khi lớn), nhập từ file CSV/JSON, chọn
nhiều item rồi xóa, archive hoặc sửa hàng loạt; lọc item đang hoạt động / đã archive / tất cả; đặt chu kỳ tự làm mới.

**Why this priority**: Mô tả nêu xuất nhập và thao tác hàng loạt; dùng API đã có (005, 010), drawer batch của 013.

**Independent Test**: E2E: xuất 10 item CSV ở hai app và so byte; xuất 3000 item buộc lưu vào thư viện (`/utils/export`)
rồi so file trong `directus_files`; nhập CSV 100 dòng và so item; chọn 3 item xóa/archive/sửa hàng loạt và so body.

**Acceptance Scenarios**:

1. **Given** bảng đang lọc 10 item, **When** mở Export, **Then** hộp thoại có định dạng, giới hạn (mặc định của layout),
   field (của layout), sắp xếp, bộ lọc và tìm kiếm hiện tại, số item sẽ xuất; tải về gọi `/items` với `export=csv` và
   lưu file; `≥ 2500` item hoặc vượt giới hạn query thì khóa "tải về", chỉ "lưu vào thư viện" với thư mục, gọi
   `POST /utils/export/:collection`.
2. **Given** layout bảng, **When** bấm "tải trang hiện tại", **Then** CSV từ dữ liệu đang hiện (`saveAsCSV`), cùng cột
   và cùng thứ tự với Directus.
3. **Given** file CSV, **When** nhập, **Then** `POST /utils/import/:collection` multipart với tiến độ; lỗi từng dòng hiện
   trong hộp lỗi nhập; xong thì danh sách nạp lại; không có quyền `create` thì phần nhập ẩn.
4. **Given** đã chọn 3 item, **When** bấm xóa, **Then** hỏi `batch_delete_confirm` (3), `DELETE /items/:collection` với
   body là mảng khóa; archive gọi `PATCH` với `keys` và `archive_value`; sửa hàng loạt mở `DrawerBatch` (013) rồi nạp
   lại; nút khóa với tooltip `not_allowed` khi thiếu quyền.
5. **Given** collection có `archive_field` và `archive_app_filter`, **When** chọn "đã archive" ở sidebar, **Then** URL
   thêm `?archived` (hoặc `?all`), bộ lọc hệ thống đổi, số đếm tổng theo bộ lọc hệ thống; user không đọc được
   `archive_field` thì không có mục Archive và không lọc.
6. **Given** chu kỳ làm mới 30 giây, **When** tab ẩn, **Then** ngừng; tab hiện lại thì làm mới ngay và chạy tiếp; giá trị
   lưu vào `refresh_interval` của preset.

---

### User Story 7 - Quyền, trang item của share, đối chiếu với Directus app (Priority: P2)

Mọi màn chỉ hiện collection, item, field, nút mà user có quyền. Người nhận link share đăng nhập bằng mật khẩu share và
thấy đúng một item. Toàn bộ luồng chính chạy ở ba cấu hình API của 012 và payload ghi trùng với Directus app.

**Why this priority**: Là tiêu chí chấp nhận ("làm được tương tự", "chỉ hiện những gì user có quyền") và cổng đóng
feature; E2E ba cấu hình là bàn giao của 013.

**Independent Test**: E2E với `admin`, `bo-editor`, `bo-viewer` ở ba cấu hình; bộ so payload chạy cùng kịch bản trên
Directus app qua proxy (`tests/directus-app-e2e`) và app mới, so body ghi.

**Acceptance Scenarios**:

1. **Given** `bo-viewer` (chỉ đọc), **When** mở module, **Then** chỉ collection đọc được trong cây; nút tạo, xóa,
   archive, sửa hàng loạt, nhập khóa hoặc ẩn như Directus; form chỉ đọc; `bo-editor` không có quyền xóa thì chỉ nút
   xóa khóa.
2. **Given** share có mật khẩu cho `bo_std/1`, **When** mở `/shared/<id>` ẩn danh, **Then** trang share (012) hỏi mật
   khẩu, đăng nhập xong chuyển tới `/content/bo_std/1` với phiên share: cây chỉ có collection đó, form theo quyền của
   role share, không có sidebar Shares/Comments ngoài quyền; hết hạn hoặc hết lượt thì thông báo như Directus.
3. **Given** bộ E2E US1 đến US6, **When** chạy ở ba cấu hình FR-071 của 012, **Then** 100% đạt; với mỗi thao tác ghi, body
   gửi tới API bằng body Directus app gửi cho cùng thao tác (sau chuẩn hóa FR-120).

---

### Edge Cases

- Collection không có khóa chính (bảng chỉ xem): Directus `useCollection` trả `primaryKeyField` null; bảng vẫn hiện,
  không bấm mở item, không chọn, đếm bằng `count(*)`; app mới làm giống.
- Khóa chính là chuỗi có ký tự đặc biệt (`/`, `%`, khoảng trắng): route mã hóa bằng `encodeURIComponent` như
  `getItemRoute`; tham số route giải mã trước khi gọi API.
- Khóa chính không tự tăng và không uuid: nút lưu chỉ bật khi đã nhập khóa (`isSavable`).
- Item mới của collection chỉ có giá trị mặc định: nút lưu bật (`isSavable` với `defaults`).
- Item không tồn tại, hoặc không có quyền đọc: trang không tìm thấy (`ContentNotFound`) với cây điều hướng; collection
  không tồn tại cũng vậy; collection hệ thống chuyển hướng (`checkForSystem`) tới route module của nó (khung D-40).
- `layout` trong preset là id không có (layout của extension): rơi về `tabular` như `layout-sidebar-detail.vue`.
- Preset lưu `layout_query.tabular.fields` có field không còn: bỏ field đó (lọc qua store fields) như `tabular/index.ts`.
- Đổi bộ lọc, tìm kiếm, sắp xếp, giới hạn: về trang 1; trang đang xem trống (item vừa bị xóa): về trang 1 như `useItems`.
- Request danh sách trước chưa về khi đã đổi điều kiện: hủy request cũ (abort); số đếm về muộn thì bỏ nếu đã có yêu cầu
  mới hơn (generation) như `useItems`.
- Hai tab cùng sửa preset: lưu tự động của tab sau ghi đè như Directus (không khóa).
- Hai người cùng sửa một item (collab tắt, D-68): không khóa, không phát hiện xung đột; `PATCH` chỉ gửi field đã sửa
  nên bản lưu sau ghi đè từng field như Directus khi tắt WebSocket; revision ghi đủ hai lần.
- Bookmark của user khác (admin thấy qua cây? không: cây chỉ hiện bookmark của mình, role mình, global); admin sửa
  bookmark role/global qua Settings.
- Xóa bookmark đang mở: về route collection.
- Lưu item rồi API trả 200 nhưng không có dữ liệu (quyền đọc không có sau khi tạo): Directus chuyển tới item mới và màn
  không tìm thấy; làm giống.
- Form singleton khi chưa có item: `GET /items/<singleton>` trả `{}`/null; lưu đầu tiên là `PATCH` (API tự tạo) như Directus.
- Rời trang khi đang lưu: không hỏi (thay đổi đã gửi); lưu lỗi thì giữ thay đổi.
- `preview_url` có nhưng template điền ra chuỗi rỗng (field trống): không nút xem trước; URL khác origin: iframe vẫn
  nạp, `refreshLivePreview` chỉ gọi được hàm trong iframe cùng origin, lỗi thì bỏ qua như Directus; popup bị trình
  duyệt chặn: như Directus, không dự phòng (chế độ `popup` giữ, khung xem trước ẩn, nút xem trước vẫn bật để đổi chế
  độ); đóng popup: về chia đôi sau tối đa 1 giây (kiểm định kỳ như Directus). URL xem trước dựng từ dữ liệu đã lưu
  (`use-template-data`), không từ thay đổi chưa lưu; đổi sau khi lưu (FR-063).
- Live preview ở bề rộng ≤ `sm`: iframe chiếm toàn bề rộng, không kéo được (như `isMobile` của Directus); item mới (`+`)
  không có xem trước.
- Calendar: field bắt đầu kiểu `date` không hiện giờ; `timestamp` dùng view giờ; nhiều hơn giới hạn query thì chỉ phần
  đầu hiện (như Directus, không cảnh báo thêm).
- Kanban: field nhóm `readonly` hoặc không có quyền update thì không kéo được; nhóm m2o không có quyền `delete` thì không
  xóa nhóm.
- Map: field hình học không có → notice `no_compatible_fields`; dữ liệu hình học lỗi → `geojsonError` hiện, bản đồ trống;
  tile không tải được → khung trống, thao tác vẫn được (013).
- Export > giới hạn query của server: luôn lưu vào thư viện; `limit -1` là tất cả.
- Import file sai kiểu (không CSV/JSON): API trả lỗi, hộp lỗi hiện; file lớn: tiến độ tải lên rồi "đang nhập".
- Thao tác hàng loạt trên trang có item vừa bị user khác xóa: `DELETE /items/:c` và `PATCH {keys}` chạy trong
  transaction ở API, lỗi thì không item nào đổi; hộp lỗi hiện thông điệp API, lựa chọn giữ.
- Lưu item trả 403/404 (item chính hoặc version bị xóa ở nơi khác): hộp lỗi, thay đổi giữ; sau lưu version mà
  `getVersions` không còn version đó: về bản chính, như Directus.
- Field user không được update: form 013 không phát `edits` cho field đó; dán qua raw editor thì API trả 403 → hộp lỗi.
- Đổi collection khi đang có lựa chọn, kéo thả dở hoặc request chưa về: lựa chọn xóa, `useItems` reset và hủy request,
  preset cục bộ dựng lại theo collection mới, kéo thả bị hủy khi unmount (như Directus).
- User chỉ đọc một phần field: cột của preset trên field không đọc được bị bỏ khi dựng; sắp xếp theo field không đọc
  được → API 403 → trạng thái lỗi của layout với nút đặt lại tùy chọn; cây field của bộ lọc chỉ liệt kê field đọc được.
- `?bookmark=` không phải số (`NaN`) → `bookmark_doesnt_exist`; bookmark của collection khác với URL: vẫn mở với
  collection trong URL (Directus không kiểm); bookmark bị xóa ở tab khác: lưu ở tab này trả 403 → hộp lỗi.
- Rời trang trước khi debounce 450 ms ghi preset: thay đổi mất như Directus; ghi preset lỗi (403, mạng): hộp lỗi
  `unexpectedError`.
- Calendar: item không có ngày bắt đầu không hiện; kéo cho kết thúc trước bắt đầu bị FullCalendar từ chối (revert).
- Map: `cameraOptions.bbox` lưu không hợp lệ → MapLibre ném, bỏ qua fit (try/catch như `map.vue`); `clusterData` chỉ
  gom điểm, đường/vùng vẽ thường.
- Comment rất dài: không giới hạn ở client (API `MAX_PAYLOAD_SIZE`); mention user không đọc được → giữ `@uuid` thô;
  xóa comment đang sửa → ô sửa đóng.
- Import quá `MAX_PAYLOAD_SIZE`/`FILES_MAX_UPLOAD_SIZE` (413), hủy giữa chừng (đóng hộp = abort XHR), mất quyền
  `create` sau khi mở (403): hộp lỗi, như Directus.
- Export tải về bị server từ chối dù client đã khóa theo `queryLimit.max` (giới hạn đổi sau khi tải trang): hộp lỗi.
- Phiên hết hạn giữa chừng (401 khi lưu, tự lưu preset, làm mới định kỳ): như 012, nhận ra khi `refresh()` thất bại,
  về đăng nhập với lý do; thay đổi chưa lưu mất như Directus.
- Revisions: `accountabilityScope` khác `all` (collection `accountability: activity` hoặc null) → không có mục Revisions
  như Directus; quyền đọc `directus_revisions` không có → ẩn.
- Version: key trùng key global (`main`?) bị chặn như `isVersionKeyGlobal`; xóa version đang mở → về bản chính; item
  chính bị xóa khi đang ở version → lỗi 403 như 008.
- Comment nhắc user không đọc được (`/users` lọc): giữ `@uuid` thô như Directus.
- Share: `max_uses` đạt hoặc hết hạn → `share_access_*` như `shared.vue`; user đã đăng nhập thường mở `/shared/:id` thì
  chuyển thẳng tới item.
- Phím tắt Ctrl/Cmd + S khi focus ở trình soạn (TinyMCE, CodeMirror) bắt phím: theo Directus (`useShortcut` trên form).
- Màn hẹp 768 px: panel chi tiết là drawer (L-4), bảng cuộn ngang trong khung; kanban nhiều cột cuộn ngang trong khung
  layout (`overflow-x-auto`), map và calendar co theo khung; trang không cuộn ngang (FR-116).
- Kéo thả (thẻ kanban, sự kiện calendar, sắp xếp tay trong bảng) có đường bàn phím: menu "Lên/Xuống", "Chuyển sang
  nhóm...", đổi ngày bằng form (D-69, như D-60 của 013).

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| US1 | 1–6 | FR-001 đến FR-009, FR-020 đến FR-034 | SC-001, SC-002, SC-003, SC-011 |
| US2 | 1–8 | FR-050 đến FR-069 | SC-001, SC-004 |
| US3 | 1–5 | FR-010 đến FR-019, FR-040 đến FR-044 | SC-001, SC-004 |
| US4 | 1–5 | FR-035 đến FR-039 | SC-001, SC-005 |
| US5 | 1–6 | FR-070 đến FR-089 | SC-001, SC-004 |
| US6 | 1–6 | FR-090 đến FR-099 | SC-001, SC-004 |
| US7 | 1–3 | FR-100 đến FR-103, FR-110 đến FR-127 | SC-001, SC-004, SC-006 đến SC-010, SC-012 |

## Requirements *(mandatory)*

### Functional Requirements

**Route và điều hướng**

- **FR-001**: Module `content` PHẢI thay route khung của 012 bằng các route của `modules/content/index.ts`: `/content`
  (`no-collections`: chuyển tới collection truy cập gần nhất còn thấy được, không thì collection gốc đầu tiên bỏ qua nhóm
  đang đóng; không có collection thì màn `no_collections`), `/content/:collection` (`collection-or-item`: singleton → màn
  item, còn lại → màn collection; props `bookmark`, `archive` từ query `bookmark`, `archived`, `all`),
  `/content/:collection/:primaryKey` (màn item; `+` là tạo mới), route không khớp → màn không tìm thấy trong module.
  `/content/:collection/:primaryKey/preview` (cửa sổ xem trước, FR-066).
- **FR-002**: Guard `checkForSystem`: `:collection` là collection hệ thống có route riêng (`directus_users` → `/users`,
  `directus_files` → `/files`, `directus_dashboards` → `/insights`, `directus_activity` → `/activity`,
  `directus_settings` → `/settings/project`, `directus_collections`, `directus_roles`, `directus_presets`,
  `directus_translations`, `directus_flows` → `/settings/...`) PHẢI chuyển hướng tới route đó (kèm `:primaryKey`);
  đích là khung của 012 cho tới 015, 016, 018 (D-40). Đi từ collection có `?bookmark=` tới item cùng collection PHẢI
  giữ `?bookmark=`.
- **FR-003**: Collection truy cập gần nhất PHẢI lưu ở localStorage khóa `backoffice-last-accessed-collection` (D-39),
  cập nhật mỗi khi `:collection` đổi.
- **FR-004**: Cây collection PHẢI nằm trong sub-menu của module Content ở sidebar (L-3 mở rộng thành cây lồng nhiều
  cấp cho riêng module này: nhóm gập mở là mục có con, bookmark là mục con của collection, ô tìm và nút "hiện collection
  ẩn" ở đầu cây; các module khác giữ một cấp; không thêm cột điều hướng; Clarifications Q2, recipe Q-1) và PHẢI như
  `navigation.vue`,
  `NavigationItem.vue`: collection gốc (`meta.group` null) sắp theo `meta.sort` rồi tên; nhóm (collection có con) mở/đóng,
  `collapse: locked` không đóng được, trạng thái mở dùng chung toàn app (`useNavigation`), nhóm chứa collection đang xem
  tự mở; folder (collection không có `schema`) chỉ là nhóm, không bấm mở; icon và màu của collection; tên dịch
  (`collection_names`); mật độ `dense` khi hơn 5 collection; ô tìm collection khi hơn 20 collection hiện (lọc theo tên,
  nhóm vẫn hiện con khớp); mục "Hiện/Ẩn collection ẩn" (menu chuột phải và nút tương đương bàn phím) khi có collection
  ẩn; admin không có collection nào thì nút "tạo collection" tới khung Settings. Bàn phím (FR-004b): cây là danh sách
  lồng với vai trò `tree`/`treeitem` (hoặc nút `aria-expanded` cho nhóm), mũi tên lên/xuống di chuyển mục, trái/phải
  đóng/mở nhóm, Enter mở; ô tìm không khớp gì thì có thông báo sr-only "không có kết quả".
- **FR-005**: Dưới mỗi collection trong cây PHẢI có bookmark của collection đó mà user thấy (của mình, của role mình,
  global) như `navigation-bookmark.vue`: icon và màu bookmark, tên dịch, route `?bookmark=<id>`; menu: sửa (bookmark cá
  nhân: hộp thoại tên, icon, màu; role/global: link `/settings/presets/:id`, khung 016) và xóa (hộp xác nhận); user không
  có quyền thì icon khóa và tooltip `cannot_edit_<scope>_bookmarks`; xóa bookmark đang mở thì về route collection.
- **FR-006**: Màn collection PHẢI có page header (L-5): breadcrumb "Content" (hoặc tên collection khi ở bookmark), tiêu
  đề là tên collection (hoặc tên bookmark), icon và màu collection (icon `archive` khi đang lọc archive), các nút
  bookmark (FR-015), nút hành động của layout (`layout-actions-*`: số item đang hiện, kích thước trang), ô tìm kiếm với
  nút bộ lọc, nút xóa/archive/sửa hàng loạt khi có lựa chọn, nút tạo item (khóa khi không có quyền `create`), hộp thoại
  flow (`FlowDialogs`).
- **FR-007**: Màn item PHẢI có page header: nút quay lại (lịch sử trình duyệt nếu có, không thì route collection kèm
  `?bookmark=`), breadcrumb tên collection, tiêu đề (FR-051), menu version (FR-070), nút xóa, archive, lưu với menu
  tùy chọn lưu (FR-053), hộp thoại flow; bóng header khi form cuộn.
- **FR-008**: Panel chi tiết L-4 (`DetailPanel` của 012) PHẢI chứa các mục dạng accordion `sidebar-detail` (một mục mở,
  trạng thái mở nhớ theo tiêu đề như `useGroupable` group `sidebar-detail`): ở màn collection: Layout (FR-021),
  Archive (FR-044), Refresh (FR-099), Export/Import (FR-090), Flows (FR-089); ở màn item (item đã có): Revisions,
  Comments, Shares, Flows (FR-080 đến FR-089); item mới (`+`) không có mục nào (như `v-if="isNew === false &&
  actualPrimaryKey"` của Directus).
- **FR-009**: Màn không tìm thấy của module (`not-found.vue`) PHẢI hiện trong bố cục với cây điều hướng; dùng cho item,
  collection không tồn tại hoặc không đọc được, singleton có `:primaryKey`, và `/content/directus_*` của collection hệ
  thống không có route riêng ở FR-002 (`isSystemCollection` như `collection.vue`).

**Preset và bookmark**

- **FR-010**: Preset của màn PHẢI theo `use-preset.ts`: không có `?bookmark=` thì lấy preset của collection
  (`getPresetForCollection`: user, rồi role, rồi global, rồi mặc định `{layout: 'tabular'}`); có `?bookmark=` thì lấy
  bookmark đó; `layout`, `layout_options[layout]`, `layout_query[layout]`, `filter`, `search`, `refresh_interval`,
  `bookmark` (tên) đọc và ghi từ preset cục bộ.
- **FR-011**: Không ở bookmark: mọi thay đổi preset PHẢI lưu tự động sau 450 ms (debounce) qua `savePreset` của store
  với **toàn bộ preset cục bộ** như `savePreset(localPreset)` của Directus: lần đầu `POST /presets` body là preset mặc
  định của `getPresetForCollection` cộng thay đổi: `{layout, bookmark: null, role: null, user, search, filter,
  layout_query, layout_options, refresh_interval, icon: 'bookmark', color: null, collection}` (không `id`); `layout` là
  `null` khi chưa đổi layout (đo trên Directus app T023, mốc `expected.content.json`), `layout_query` có cả `page`; sau đó `PATCH /presets/:id` cũng với toàn bộ preset cục bộ (không chỉ khóa đổi);
  preset có `id` của user khác → `POST` bản mới của mình (store). Phiên share: store presets không nạp, không ghi, preset
  cục bộ là `{layout: 'tabular'}`.
- **FR-012**: Ở bookmark: thay đổi KHÔNG tự lưu; `bookmarkSaved` so sâu preset cục bộ với bookmark trong store; "lưu
  bookmark" (`savePreset`) chỉ cho bookmark của mình; "đặt lại" (`clearLocalSave`) về bản trong store.
- **FR-013**: "Tạo bookmark" PHẢI lưu trạng thái hiện tại (bỏ `id`, `user` là mình) kèm tên, icon, màu từ hộp thoại
  `bookmark-add.vue` (tên bằng `system-input-translated-string`, icon `select-icon`, màu `select-color`), rồi chuyển tới
  `?bookmark=<id>`; tên bookmark hiện qua `translate` (`$t:`). `system-input-translated-string` chép nguyên Directus
  (D-73): ô nhập chuỗi thường, nút mở drawer danh sách chuỗi dịch từ `/translations` (tìm, chọn → giá trị
  `$t:<key>`, tạo chuỗi mới qua store translations), 016 dùng lại.
- **FR-014**: "Đặt lại tùy chọn trang" (`resetPreset`, nút ở trạng thái lỗi của layout) PHẢI ghi ngay
  `layout_query: null, layout_options: null, layout: 'tabular', filter: null, search: null, refresh_interval: null`.
- **FR-015**: Nút bookmark cạnh tiêu đề PHẢI như `collection.vue`: không ở bookmark → "tạo bookmark"; ở bookmark đã
  lưu → icon đầy; ở bookmark của mình chưa lưu → "cập nhật bookmark" (màu cảnh báo) và "đặt lại"; ở bookmark role/global
  → "tạo bookmark" (bản mới của mình).
- **FR-016**: `?bookmark=` không có trong store PHẢI hiện notice `bookmark_doesnt_exist` với nút về collection; không nạp
  layout.
- **FR-017**: Đổi tên bookmark trong cây PHẢI cập nhật tiêu đề màn đang mở (subscribe store presets).
- **FR-018**: Store presets (012) PHẢI mở rộng như `stores/presets.ts`: `savePreset` (post/patch rồi cập nhật store),
  `delete`, `getBookmark`, `bookmarks`, `getPresetForCollection`; nạp lại khi đổi user.
- **FR-019**: Preset cục bộ dùng cho drawer chọn item (`temporary`, FR-029) KHÔNG ghi ra API.

**Danh sách và layout chung**

- **FR-020**: App PHẢI đăng ký năm layout `tabular`, `cards`, `calendar`, `kanban`, `map` với cùng id, tên
  (`layouts.<id>.*`), icon, và cùng ba slot `options`, `sidebar`, `actions` như `layouts/index.ts`; màn collection dựng
  layout qua `useLayout` (wrapper nhận `collection`, `selection`, `layoutOptions`, `layoutQuery`, `filter`,
  `filterUser`, `filterSystem`, `search`, `selectMode`, `showSelect`, `readonly`, `resetPreset`, `clearFilters`) và
  phát `layoutState` cho slot như Directus. Layout không có (`layout` lạ) rơi về `tabular`.
- **FR-021**: Mục Layout của panel PHẢI cho chọn layout (menu năm mục, icon) và hiện `layout-options-<id>` của layout
  đang chọn; đổi layout ghi `layout` vào preset.
- **FR-022**: Nạp item PHẢI theo `useItems` (013 đã port, mở rộng nếu thiếu): request `/items/:collection` với `limit`,
  `page`, `fields` (luôn thêm khóa chính, bỏ field `$...`), `alias`, `sort`, `search`, `filter`, `deep`; hủy request
  trước khi có request mới; cờ tải sau 150 ms; đổi collection thì reset; đổi `filter`, `sort`, `limit`, `search` thì về
  trang 1; trang trống (khác 1) thì về trang 1; `changeManualSort` gọi `POST /utils/sort/:collection` `{item, to}` và
  đổi thứ tự cục bộ.
- **FR-023**: Số đếm PHẢI gọi riêng, không chặn danh sách: `itemCount` (theo `filter` + `search`) và `totalCount` (theo
  `filterSystem`) bằng `GET /items/:collection?aggregate[countDistinct]=<pk>` (hoặc `count=*` khi không có khóa chính),
  nhớ kết quả theo `(url, filter, search)` theo từng instance layout (`useMemoize` như Directus; không xóa khi bấm làm
  mới: `refresh()` gọi lại hai đếm nhưng nhận cache vì khóa không đổi, nên không có request đếm và số đếm giữ giá trị cũ;
  đo ở T004, tái tạo như Directus, R-38), bỏ kết quả cũ khi đã có yêu cầu
  mới; chỉ gọi lại `itemCount` khi `collection`, `filter`, `search` đổi (không khi đổi trang, sắp xếp, cột).
- **FR-024**: Dòng số đếm PHẢI theo `format-items-count.ts` và `showingCount` của từng layout: tabular, cards:
  `formatItemsCountPaginated` (`"<từ>-<đến> of <N> items"`, kèm "filtered" khi có `filterUser`), ẩn khi
  `!totalCount || !itemCount`; calendar: tổng khi chưa chọn field ngày, tương đối khi có, ẩn khi null; kanban: tổng khi
  chưa có nhóm, tương đối theo số thẻ hiện; map: tổng khi chưa có field hình học, phân trang khi nhiều trang, tương đối
  còn lại; `totalPages` từ `itemCount` và `limit`.
- **FR-025**: Bấm item ở mọi layout PHẢI theo `use-layout-click-handler.ts`: `readonly` → không; `selectMode` hoặc đã có
  lựa chọn → thêm/bỏ khỏi lựa chọn; không thì mở route item; Ctrl/Cmd + click mở tab mới. Lựa chọn (mảng khóa chính) xóa
  khi đổi collection; `selectAll` chọn mọi item đang hiện.
- **FR-026**: Trạng thái của layout PHẢI có ba slot như `collection.vue`: `no-results` (có bộ lọc/tìm kiếm, nút xóa bộ
  lọc đặt `filter` và `search` null), `no-items` (icon collection, `no_items_copy`, nút tạo khi có quyền), `error`
  (`unexpected_error`, chi tiết lỗi, nút đặt lại tùy chọn trang).
- **FR-027**: Bộ lọc gửi lên API PHẢI là `mergeFilters(filterUser, filterSystem)` (`@directus/utils`), trong đó
  `filterSystem` là bộ lọc archive (FR-044); `totalCount` chỉ theo `filterSystem`.
- **FR-028**: Màn collection PHẢI xử lý lỗi xóa/archive hàng loạt bằng hộp thoại lỗi (`something_went_wrong`, chi tiết
  lỗi, "Xong") như Directus.
- **FR-029**: `DrawerCollection` (013) PHẢI dùng layout theo preset của collection (user, role, global; preset tạm,
  FR-019, kế thừa cả `filter` và `search` đã lưu của preset làm bộ lọc người dùng ban đầu như `drawer-collection.vue`)
  ở chế độ chọn (`selectMode`, `showSelect` một/nhiều, `readonly` false; map chọn một = thay thế, chọn nhiều = cộng
  dồn khi giữ Shift như `handleSelect`), ô tìm kiếm có nút bộ lọc nâng cao (FR-041) hợp với bộ lọc của interface
  (`filterSystem`), panel option layout trong drawer qua slot `sidebar` mới của `BoDrawer` (panel phải 240 px; dưới
  `xl` thành mục gập ở đầu body; recipe §8 cập nhật, test 013 giữ); gỡ D-58.

**Layout bảng (`tabular`)**

- **FR-030**: Cột mặc định khi `layout_query.tabular.fields` trống: lọc field `hidden` và `no-data` theo thứ tự
  `meta.sort`, lấy 4 đầu, rồi sắp theo tên field (`.sort()` như `tabular/index.ts`); field trong preset không còn thì bỏ; cột quan hệ (`author.name`) nạp qua alias (`use-alias-fields`) và field
  bổ sung theo display (`adjustFieldsForDisplays`); mô tả cột lồng "A -> B"; cột không sắp xếp được với kiểu `json`,
  `alias`, `presentation`, `translations`.
- **FR-031**: Mỗi header PHẢI có menu: sắp tăng, sắp giảm, căn trái/giữa/phải (ghi `layout_options.tabular.align`), ẩn
  cột; nút "+" thêm cột (cây field `FieldList`, không chọn tất cả); kéo đổi độ rộng (ghi `widths` sau 350 ms; mặc định
  144, tối thiểu 32 px như `table-header.vue` Directus, cột mới 144; ẩn cột trong lúc debounce ghi widths rồi fields
  như Directus); kéo đổi thứ tự cột như Directus (`tabular.vue` bật `allow-header-reorder` của `v-table`, T003 b);
  bàn phím: menu header có "Chuyển trái/phải" (D-69).
- **FR-032**: Dòng PHẢI hiện giá trị bằng `RenderDisplay` theo `display` của field (mặc định theo kiểu), ô chọn dòng
  (`showSelect`), header dính (`fixed-header`), chiều cao theo `spacing` (`compact` 29, `cozy` 43, `comfortable` 58 px,
  option ở panel), sắp xếp tay bằng kéo khi collection có field sort, không có sắp xếp khác và user có quyền update field
  sort (`sortAllowed` của `useCollectionPermissions`; `manual-sort-key`), cộng "Lên/Xuống" ở menu dòng (D-69); không
  có quyền thì kéo và menu Lên/Xuống ẩn.
- **FR-033**: Footer PHẢI có phân trang (`VPagination` ↔ recipe Q-2: tối đa 7 nút, trang hiện tại `aria-current`) và
  chọn kích thước trang (25, 50, 100, 250, 500, 1000 lọc `≤ queryLimit.max` của server như `usePageSize` 013, `-1` =
  không cắt; hiện khi `items ≥ 25` hoặc `limit < 25`) ghi `layout_query.tabular.limit`; đổi kích thước về trang 1. Bảng vẽ toàn bộ dòng của trang như Directus (không ảo hóa,
  Clarifications Q4); ngân sách vẽ ở SC-011.
- **FR-034**: `layout-actions-tabular` PHẢI hiện dòng số đếm (FR-024); tải trang hiện tại thành CSV xem FR-092.

**Layout cards, calendar, kanban, map**

- **FR-035** `cards`: option `size` (4), `icon` (`box`, khi không có ảnh), `imageSource` (field file đầu tiên hoặc
  `$thumbnail` với `directus_files`), `imageFit` (`crop`|`contain`), `title`, `subtitle` (template, nút chọn field);
  field nạp = khóa chính + `<imageSource>.{modified_on,type,filename_disk,storage,id}` + field của template; ảnh qua
  `/assets/<id>?modified=<modified_on>&key=system-medium-cover|contain`; thẻ có checkbox chọn, icon fallback, tiêu đề
  và phụ đề `RenderTemplate`; `actions`: số đếm, sắp xếp (field + chiều), kích thước trang; một hàng khi vừa.
- **FR-036** `calendar`: option `template` (mặc định khóa chính), `startDateField`, `endDateField` (field `date`,
  `dateTime`, `timestamp`), `firstDay`; `viewInfo` (view và ngày đầu đang xem) ghi vào `layout_options`; bộ lọc theo
  vùng ngày của view (`_between` bắt đầu, `_between` kết thúc, hoặc bao trùm) hợp với bộ lọc user; `limit` = giới hạn
  query của server (`/server/info` `queryLimit.max`, `-1` → 1000), trang 1, sắp theo khóa chính; view tháng, tuần, ngày,
  danh sách (tuần/ngày theo giờ khi field là `dateTime`/`timestamp`); ngôn ngữ theo app; sự kiện cả ngày khi field kết
  thúc là `date` (+1 ngày cho thư viện, −1 khi ghi); kéo/đổi cỡ sự kiện gọi `PATCH /items/:collection/:id` với ngày
  theo kiểu field (`dateTime` cắt 19 ký tự), lỗi thì hoàn tác; bấm sự kiện mở item hoặc chọn; `actions`: hôm nay, trước,
  sau, chọn view, số đếm tương đối; `viewInfo` và `cameraOptions` (map) giữ nguyên theo preset của từng collection,
  không tính lại khi đổi kích thước màn. Thư viện lịch: FullCalendar 6.1.19 như Directus (plan R1).
- **FR-037** `kanban`: option `groupField` (field có `choices` kiểu string/số, hoặc m2o), `groupTitle` (field tên của
  collection nhóm khi m2o), `titleField`, `textField`, `imageSource`, `crop`, `dateField`, `tagsField` (json/csv),
  `userField` (m2o hoặc m2m tới `directus_users`), `showUngrouped` (chỉ khi field nhóm nullable), `groupOrder` (thứ tự
  cột cho `choices`); nhóm m2o nạp từ collection nhóm (sort field, giới hạn query hoặc 100); cột "chưa nhóm"; thẻ hiện
  ảnh (`/assets/<id>?modified=...&width=250&height=150` khi crop, `key=system-medium-contain` khi không), tiêu đề,
  text, ngày, tag, avatar user; kéo thẻ sang cột: thứ tự request như `change()` Directus (`/utils/sort` trước khi đổi vị
  trí có field sort, rồi `PATCH /items/:collection/:id` `{[groupField]: id}`); kéo cột (m2o: `/utils/sort` của collection
  nhóm; `choices`: `groupOrder.sortMap`); thêm/đổi tên/xóa nhóm m2o (`POST`/`PATCH`/`DELETE` collection nhóm) theo
  quyền (`canReorderGroups`, `canReorderItems`, `canUpdateGroupTitle`, `canDeleteGroups` như `useLayoutPermissions`);
  xóa nhóm là xóa item thật của collection nhóm: hỏi xác nhận như `kanban.vue` nếu Directus có (T003), không có thì thêm
  `BoDialog` xác nhận và ghi D-74; `limit` = `layoutQuery.limit || 1000` (không cắt theo `queryLimit.max`, API tự cắt);
  bàn phím: menu thẻ "Chuyển sang nhóm…", "Lên/Xuống" (D-69).
- **FR-038** `map`: option `geometryField` (field `geometry*` hoặc interface `map`; mặc định field đầu),
  `displayTemplate` (mặc định `display_template` của collection hoặc khóa chính), `clusterData`, nền bản đồ
  (`basemap`, FR-039), `cameraOptions` (tâm, zoom, bbox, ghi khi di chuyển); field nạp = hình học + template + khóa
  chính; bộ lọc `_intersects_bbox` theo bbox khung nhìn khi field là hình học native; GeoJSON dựng từ item theo
  `utils/geometry` (WKT, GeoJSON, `[lng, lat]` csv); vừa dữ liệu lần đầu và khi đổi field; điểm/đường/vùng theo
  `map/style.ts`, cụm khi bật (chỉ gom điểm); bấm feature mở item (hoặc ở `selectMode`: chọn, thay thế khi không giữ
  Shift, cộng dồn khi giữ Shift như `handleClick`/`handleSelect`), kéo khung chọn nhiều, popup template khi rê; lỗi
  hình học hiện notice; `actions`: số đếm (phân trang khi nhiều trang), "vừa dữ liệu"; `limit` mặc định 1000 trong
  preset, phân trang; bàn phím: danh sách item đang hiện trong panel để mở/chọn (D-69).
- **FR-039**: Nguồn nền bản đồ PHẢI theo `basemap.ts`: OpenStreetMap raster mặc định (tile `{a-c}.tile.openstreetmap.org`,
  tileSize 256, attribution); khi `settings.mapbox_key` có thì thêm mục Mapbox đầu danh sách (style
  `mapbox://styles/directus/...` sáng hoặc tối theo giao diện, qua maplibre với `transformRequest` tới
  `api.mapbox.com` kèm key như Directus); mọi mục `settings.basemaps` (`name`, `type` `raster`|`tile`|`style`, `url`,
  `tileSize`, `attribution`) với mở rộng URL `{a-c}`, `{1-4}`, `{a,b}`; nền đang chọn giữ trong store `app`
  (`basemap`, mặc định `OpenStreetMap`, như `@directus/stores`), không ghi preset hay localStorage, dùng chung với
  interface `map` (013). Có `mapbox_key` thì thêm ô tìm địa điểm (geocoder Mapbox); không có → không request nào tới
  Mapbox.

**Tìm kiếm, bộ lọc, archive**

- **FR-040**: Ô tìm kiếm PHẢI như `search-input.vue`: mở rộng khi focus, giá trị ghi `search` của preset khi gõ (debounce
  của `useItems` 500 ms throttle), nút xóa, nút bộ lọc với số điều kiện đang áp (đếm toán tử `_*` trừ `_and`/`_or`),
  Esc đóng; giữ mở khi focus vào menu con.
- **FR-041**: Bộ lọc nâng cao PHẢI là bản port của `interfaces/_system/system-filter` (lấy từ D-57 của 013, xem
  Clarifications): cây `_and`/`_or` lồng, thêm điều kiện theo field (cây field `FieldList` chép `v-field-list`: nạp lười
  khi mở nút quan hệ, không giới hạn độ sâu, gồm collection hệ thống qua quan hệ như `directus_users`, hàm theo kiểu
  field `year`, `month`, `week`, `day`, `weekday`, `hour`, `minute`, `second`, `count`, loại `alias` không quan hệ và
  `presentation`, chỉ field user đọc được), toán tử theo kiểu field (`operators.*`, danh sách theo `get-filter-operators-for-type`), ô giá trị theo kiểu (chuỗi,
  số, ngày với `$NOW(...)`, boolean, chọn từ `choices`, quan hệ chọn item), biến `$CURRENT_USER`, `$CURRENT_ROLE`,
  `$CURRENT_POLICIES`, `$NOW` (menu), kéo đổi thứ tự điều kiện, xóa, chuyển `_and`↔`_or`; JSON phát ra trùng dạng
  Directus (SC-004). Cùng component dùng cho `DrawerCollection` (FR-029).
- **FR-042**: Bộ lọc và tìm kiếm PHẢI ghi vào preset (`filter`, `search`) và hiện lại khi mở; "xóa bộ lọc" đặt cả hai
  null.
- **FR-043**: Bộ lọc của màn collection KHÔNG điền `{{ field }}` (chỉ bộ lọc của interface quan hệ làm vậy, 013); giá
  trị động chỉ là biến `$CURRENT_USER`, `$CURRENT_ROLE`, `$CURRENT_POLICIES`, `$NOW`, do API thay như Directus.
- **FR-044**: Archive: collection có `archive_field` và `archive_app_filter` và user đọc được `archive_field` (quyền
  `read` có `fields` `*` hoặc chứa field) thì `filterSystem` = `{[field]: {_neq: archive_value}}` mặc định,
  `{_eq: archive_value}` với `?archived`, null với `?all` (`archive_value` `'true'`/`'false'` đọc thành boolean;
  `archive_value` null → `{_neq: null}` và nút archive ghi null, như Directus); mục
  Archive ở panel (ba lựa chọn, đổi query, giữ các query khác); icon header `archive` khi đang lọc; nút archive hàng
  loạt ẩn khi đang xem đã archive.

**Màn item**

- **FR-050**: Màn item PHẢI dùng `BoForm` (013) với: `fields` theo quyền (`useItemPermissions(...).fields`: field user
  đọc được, `readonly` khi không được update), `initialValues` là item (`GET /items/:collection/:pk?fields=*` với
  `?version=` khi đang ở version, như `useItem`), `edits` (`modelValue`), `primaryKey` (`+` khi mới hoặc đang tải),
  `loading`, `disabled` (FR-056), `validationErrors`, `autofocus` khi mới, `direction` theo user, `version`.
- **FR-051**: Tiêu đề PHẢI là `creating_in`/`editing_in` (hoặc `creating_unit`/`editing_unit` khi có
  `collection_names_singular`); item đã có với `display_template` thì tiêu đề là `RenderTemplate` trên dữ liệu template
  (`use-template-data`, skeleton khi tải, kích thước ở recipe Q-8); singleton: tên collection với icon; tiêu đề tab:
  màn đặt `<collection> | <tiêu đề>` (singleton: `<collection>`) rồi `titleTemplate` của 012 thêm ` · <project_name ||
  Backoffice>`, chuỗi cuối ví dụ `bo_content | Hello · Backoffice` (E2E kiểm chuỗi cuối).
- **FR-052**: `isSavable` PHẢI như `item.vue`: false khi không có quyền lưu và không ở version; true khi có thay đổi;
  khóa chính không tự tăng và không uuid thì cần đã nhập khóa; item mới với `defaults` thì true.
- **FR-053**: Nút lưu chính PHẢI lưu và về danh sách (`saveAndQuit`; singleton ở lại); menu tùy chọn (`save-options.vue`):
  `save_and_stay` (Ctrl/Cmd + S; item mới thì `router.replace` tới khóa mới, có thì nạp lại item và Revisions),
  `save_and_create_new` (Ctrl/Cmd + Shift + S; ẩn khi không có quyền tạo), `save_as_copy` (ẩn khi mới hoặc không có quyền
  tạo; `saveAsCopy` của `use-item`: đọc item bằng GraphQL `POST /graphql` (`/graphql/system` với collection hệ thống)
  với `item_duplication_fields` (rỗng/null → chỉ khóa chính; quan hệ ngoài danh sách không chép), bỏ khóa chính và khóa
  của item nối, giữ m2o, o2m thành tạo mới, như `findExistingRelatedItems` (`SEARCH` khi query dài), `clearPrimaryKey`,
  `clearJunctionRelatedKey`, bản sao = dữ liệu đọc + `edits`), `discard_all_changes`; menu chỉ hiện khi `isSavable` và
  không singleton.
- **FR-054**: Lưu PHẢI gọi `POST /items/:collection` (mới) hoặc `PATCH /items/:collection/:pk` chỉ với `edits`
  (singleton: `PATCH /items/:collection`); `FAILED_VALIDATION` và `RECORD_NOT_UNIQUE` → `validationErrors` (form 013);
  lỗi khác → hộp lỗi chép `unexpectedError` (`BoDialog` tiêu đề `unexpected_error`, text `translateAPIError`, chi tiết
  gập dạng khối mã, nút `done`; dùng chung cho mọi lỗi không validation); thành công → notice tại chỗ (D-66;
  `item_create_success`, `item_update_success`).
- **FR-054b** Thông báo tại chỗ (D-66, `useNotices`): `BoNotice` xếp chồng ngay dưới page header (`role="status"`,
  `aria-live="polite"`), tự ẩn sau 3 giây như store notifications của Directus (`persist` thì không), có nút đóng; lỗi không validation (`unexpectedError`) là hộp thoại như `notification-dialogs.vue`; dùng cho lưu, xóa, archive, bản sao, chép
  link, export bắt đầu, import xong, flow chạy xong (recipe Q-8).
- **FR-055**: Xóa PHẢI hỏi `delete_are_you_sure`, `DELETE /items/:collection/:pk`, về danh sách; nút ẩn khi mới, singleton
  hoặc đang ở version; khóa khi không có quyền (`deleteAllowed`), tooltip `not_allowed`. Archive/unarchive như
  `useItem.archive` (US2-6); nút ẩn khi không có `archive_field`, mới, singleton, đang ở version.
- **FR-056**: Form PHẢI `disabled` khi item đã có và không có quyền update (và, khi ở version, không có quyền update
  `directus_versions`); nút lưu khóa (`disabled`) với tooltip `not_allowed`; form `disabled` vẫn có menu field (xem/chép
  giá trị thô) như Directus.
- **FR-057**: Rời trang khi `hasEdits` (cờ của 013 FR-084) PHẢI hỏi `unsaved_changes` (`use-edits-guard`: so cả query
  `version`; "Bỏ thay đổi" đi tiếp, "Tiếp tục sửa" ở lại); `beforeunload` khi đóng tab; "bỏ thay đổi" trong menu xóa
  `edits`.
- **FR-058**: Singleton (`collection-or-item.vue`): `GET /items/:collection` là item; không có thì form với mặc định; mọi
  lưu là `PATCH`; không có nút quay lại; breadcrumb "Content"; `/content/<singleton>/<pk>` → không tìm thấy; khóa chính
  thật dùng cho sidebar (revisions, comments...) khi có.
- **FR-059**: Sự kiện "flow đã chạy" (013 FR-057, `useFlows` `onRefreshCallback`) PHẢI nạp lại item (và Revisions);
  ở màn collection nạp lại danh sách và xóa lựa chọn.
- **FR-060**: Phím tắt Ctrl/Cmd + S, Ctrl/Cmd + Shift + S, Ctrl/Cmd + Alt + S (lưu version về bản chính) PHẢI chỉ bắt khi
  focus trong form (`useShortcut` trên phần tử form).
- **FR-061**: Item không đọc được, collection không có, hoặc lỗi nạp PHẢI hiện màn không tìm thấy (FR-009); `+` với
  collection không có quyền tạo: form hiện nhưng lưu khóa (như Directus).
- **FR-062**: Nạp item PHẢI thêm `fields=*` cộng field quan hệ mà template tiêu đề cần (`use-template-data` gọi riêng),
  như Directus (hai request).
**Live preview** (Clarifications Q1 = A; `item.vue`, `routes/preview.vue`, `live-preview.vue`; không có visual
editing, D-67)

- **FR-063**: URL xem trước PHẢI là `collection.meta.preview_url` điền bằng `renderStringTemplate` trên dữ liệu template
  của item (`use-template-data` với template là `preview_url`: dữ liệu đã lưu, không phải `edits`; nạp lại sau lưu)
  cộng `$version` = key version đang xem hoặc `main`; chuỗi rỗng (sau trim) → không có xem trước. Item mới (`+`) không
  có xem trước.
- **FR-064**: Khi có URL, header PHẢI có nút "xem trước" (bật/tắt, tooltip `live_preview.enable`/`disable`); bật là chế
  độ chia đôi: form bên trái, khung xem trước bên phải (`SplitPanel` ↔ Q-6) với tỉ lệ kéo được (mặc định 50 %, tối
  thiểu 20 %, tối đa 80 %, điểm hút 50 %), nút toàn bề rộng (khung chiếm 100 %, kéo quá 95 % cũng bật, dưới thì tắt),
  tay cầm kéo có đường bàn phím (D-69: mũi tên đổi tỉ lệ theo bước, như `ResizeHandle` của 012).
- **FR-065**: Khung xem trước (`live-preview.vue`, chép nguyên thanh công cụ) PHẢI có: iframe URL, ô URL hiện tại
  (menu khi nhiều URL), nút nạp lại, nút kích thước (`toggleFullscreen`: toàn khung ↔ 400×600 với ô rộng/cao nhập
  được), zoom 25/50/75/100/150/200 %, nút mở cửa sổ mới, menu tùy chọn hiển thị (toàn bề rộng); nạp lại sau mỗi lần lưu
  item hoặc lưu version (`refreshLivePreview`); không có nút visual editing (D-67).
- **FR-066**: Chế độ cửa sổ: nút "mở cửa sổ mới" mở `/content/:collection/:pk/preview` bằng `window.open` tên
  `live-preview` (900×800, không thanh công cụ trình duyệt); route `preview` chỉ có khung xem trước (`in-popup`), tính
  URL như FR-063 với version hiện tại; cửa sổ con gửi `postMessage('refresh', origin)` khi lưu, cửa sổ cha nhận (chỉ
  từ cùng origin và từ chính cửa sổ con) và nạp lại item; cha gọi nạp lại iframe của con sau khi lưu; đóng cửa sổ con →
  về chia đôi; `window.open` trả null (bị chặn) → như Directus, không dự phòng (Edge Cases); rời trang item → đóng cửa
  sổ con.
- **FR-067**: Chế độ (`split`|`popup`|tắt), tỉ lệ và toàn bề rộng PHẢI lưu ở localStorage khóa
  `backoffice-live-preview-mode`, `backoffice-live-preview-size`, `backoffice-live-preview-full-width` (D-39); tỉ lệ
  lưu dưới mức tối thiểu thì dùng mặc định cho tới khi kéo lớn hơn (như `livePreviewEnforceDefault`).
- **FR-068**: Ở bề rộng ≤ `sm`: khung xem trước chiếm toàn bề rộng khi bật, không kéo; tỉ lệ không ghi.
- **FR-069**: Iframe xem trước PHẢI chép đúng thuộc tính của `live-preview.vue`: `id="frame"`, `src`, `title`
  (`live_preview.iframe_title`), sự kiện `load`; Directus không đặt `sandbox`, `allow`, `referrerpolicy` (T003 c), app
  mới cũng không (không thêm hạn chế mới), hiện trạng thái tải;
  URL khác origin nạp bình thường; lỗi gọi vào iframe bỏ qua. Rủi ro: URL do admin cấu hình, chấp nhận như Directus
  (Assumptions).

**Version**

- **FR-070**: Menu version PHẢI hiện khi collection `meta.versioning`, item đã có, user đọc được `directus_versions`
  (`version-menu.vue`): tên version hiện tại (`main` hoặc `name`/`key`), danh sách version của item (`GET /versions`
  lọc `collection`, `item`), version global `draft` (khóa đặt trước `DRAFT_VERSION_KEY`, `type: global`: luôn có trong
  menu dù chưa tồn tại (`id: '+'`), tạo khi lưu lần đầu, không đổi tên, không cho đặt key trùng; cần quyền tạo
  `directus_versions` để vào khi chưa tồn tại, như `use-versions.ts`), tạo (hộp thoại tên và key, key slug tự từ tên;
  key trùng global: nút tạo khóa với tooltip `reserved_version_key` như `version-menu.vue`), đổi tên (`PATCH /versions/:id`), xóa
  (hộp xác nhận, `DELETE /versions/:id`, về bản chính), chuyển (hỏi khi có thay đổi); quyền tạo/sửa/xóa theo
  `directus_versions`.
- **FR-071**: Đang ở version (`?version=<key>`): form nạp `GET /items/:collection/:pk?version=<key>&versionRaw=true`
  khi version đã tồn tại; version `+` (`draft` chưa tạo) không gửi `version=`, form là bản chính; nút lưu thành "lưu
  version" (`POST /versions/:id/save` với `edits`, như `useVersions.saveVersion`; version `+` thì `POST /versions` trước
  rồi save); menu:
  lưu và về bản chính, lưu và thoát, bỏ thay đổi; `versionValidationErrors`; Revisions lọc `version`; Comments, Shares,
  Flows ẩn; xóa, archive ẩn.
- **FR-072**: Hộp so sánh (`comparison-modal.vue`, chế độ `version`, dùng chế độ so sánh của form 013, gỡ D-55) PHẢI:
  `GET /versions/:id/compare` → danh sách field khác (`differences_count`), công tắc "chỉ hiện khác biệt", checkbox chọn
  chỉ trên field có khác biệt (mặc định chọn tất cả), xem hai bên (bản chính / version) với interface chỉ đọc, cảnh
  báo `outdated`; "Promote" gọi `POST /versions/:id/promote` `{mainHash, fields}`, nút khóa khi không có quyền update
  item chính; tùy chọn "xóa version sau promote" (`delete_on_apply_copy`) chỉ khi có quyền delete `directus_versions`;
  xong thì về bản chính và nạp lại.
- **FR-073**: Chế độ `revision` của hộp so sánh (FR-081) và chế độ `collab` (D-68, không làm) dùng cùng component.

**Sidebar item**

- **FR-080** Revisions: hiện khi `revisionsAllowed` (đọc `directus_revisions`) và `accountabilityScope === 'all'`
  (`accountabilityScope` = `collection.meta.accountability` như `useCollection`; `activity` hoặc null → không có mục); số
  đếm (`/revisions` `aggregate count` theo `collection`, `item`, `version` null hoặc id); danh sách 10 mỗi trang
  (`min(10, queryLimit.max)`), `sort -id`, field như `use-revisions.ts`, nhóm theo ngày (`today`, `yesterday`, ngày
  ngắn), mục ghi hành động (`create`, `update`, `version_save`...), user (`private_user` khi không đọc được) và giờ;
  nạp khi mở mục; phân trang; nút nạp lại.
- **FR-081**: Bấm revision PHẢI mở hộp so sánh chế độ `revision`: so với "bản trước" hoặc "mới nhất", chỉ khác biệt,
  chọn field, ghi chú `no_relational_data`; "Apply" phát `revert` với giá trị thô của các field chọn (m2o là khóa;
  o2m/m2m không có trong `delta`; field user không đọc được không có trong `delta` nên không hiện) → ghi vào `edits`
  của form (chưa lưu, user bấm lưu); revision không có `delta` → `revision_delta_created_externally`, không mở.
- **FR-082** Comments: hiện khi không ở version; số đếm và danh sách như `comments-sidebar-detail.vue` (`/comments` lọc
  `collection`, `item`, `sort -date_created`, field user); nhóm theo ngày; `@<uuid>` thay bằng tên user (`/users` lọc
  `_in`) trong `<mark>`, HTML còn lại bị khử (DOMPurify không tag); ô nhập (`comment-input.vue`): gợi ý user khi gõ `@`
  (`/users` tìm kiếm, chèn `@<uuid>`), Ctrl/Cmd + Enter gửi (`POST /comments` `{collection, item, comment}`); sửa
  (`PATCH /comments/:id`), xóa (`DELETE`, hộp xác nhận) comment của mình (admin: mọi comment, theo quyền API); nạp khi
  mở mục.
- **FR-083** Shares: hiện khi không ở version; `allowed` = `shareAllowed` của item (quyền `share` của collection); số
  đếm và danh sách (`/shares` lọc `collection`, `item`, `sort name`); mục share (`share-item.vue`): tên, role, ngày, số
  lần dùng, menu: sửa, chép link (`<origin><root>admin/shared/<id>` → clipboard; thông báo thành công/lỗi tại chỗ,
  D-66), gửi (hộp thoại nhập email cách dấu phẩy hoặc xuống dòng, `POST /shares/invite` `{emails, share}`; API chỉ ghi
  log, D-36, UI báo như Directus), xóa (hộp xác nhận); mục hết hạn hoặc hết lượt có chữ phụ như `share-item.vue`;
  `navigator.clipboard` không có (HTTP không bảo mật) → notice lỗi `share_copy_link_error`; tạo/sửa bằng `DrawerItem`
  (013) trên `directus_shares` với `edits` sẵn `{collection, item}` và hai field đó ẩn, field `name`, `role`,
  `password` (hash, `input-hash` không hiện lại), `date_start`, `date_end`, `max_uses` (`POST`/`PATCH /shares`).
- **FR-084**: Trang `/shared/:id` (012) sau khi đăng nhập share PHẢI chuyển tới route item (`getItemRoute`); với phiên
  share, module Content PHẢI hoạt động theo quyền của share (cây chỉ collection đọc được, không bookmark, không nạp và
  không ghi preset; form, sidebar theo quyền; `/content` hoặc collection khác → `no_collections`/không tìm thấy theo
  quyền; không gọi `track/page` như 012); user thường đã đăng nhập mở `/shared/:id` thì chuyển thẳng tới item như
  `shared.vue`.
- **FR-089** Flows: mục Flows ở panel (màn collection và item) liệt kê flow thủ công của collection theo `location`
  (`both`, `collection`, `item`) từ store flows (013), tooltip `run_flow_on_current`/`run_flow_on_selected`/
  `run_flow_on_current_collection`, khóa khi cần lựa chọn mà chưa chọn (`requireSelection`), chạy qua
  `use-run-manual-flow` (013) với hộp xác nhận tùy chọn và hộp `unsaved_changes` (`run_flow_anyway`) khi có thay đổi;
  body như `runManualFlow` của `use-flows.ts` (T003 d): ở màn collection với `requireSelection: false` và không có
  lựa chọn → `{...giá trị xác nhận, collection}` (không có `keys`); còn lại → `{...giá trị xác nhận, collection, keys}`
  với `keys` = `[pk]` ở màn item hoặc lựa chọn ở màn collection; chạy xong xóa lựa chọn; kết quả hiện bằng notice
  D-66; xong thì FR-059; trạng thái đang chạy.

**Xuất, nhập, hàng loạt, làm mới**

- **FR-090** Export/Import (`export-sidebar-detail.vue`): mục ở panel màn collection với "Nhập" (chỉ khi `createAllowed`:
  chọn file `.csv`, `.json`, nút nhập, tiến độ tải lên rồi `importing`; `POST /utils/import/:collection` multipart
  `file`; lỗi → `import-error-dialog.vue` (danh sách lỗi API); xong → nạp lại danh sách và notice
  `import_data_success`; công tắc "chạy nền" (`background`, `?background=true`, notice `import_upload_success`, không
  nạp lại; ô checkbox `import_background`, khóa khi đang tải hoặc đang nhập, như `export-sidebar-detail.vue` T003 e) và
  "Xuất" (mở hộp thoại FR-091).
- **FR-091**: Hộp thoại xuất PHẢI có: định dạng (`csv`, `json`, `xml`, `yaml`), giới hạn (mặc định `limit` của layout
  hoặc `min(25, queryLimit.max)`; `-1` là tất cả; làm tròn số), bộ lọc (sửa được bằng `system-filter`) và tìm kiếm (ô
  nhập) khởi tạo từ màn, field (chọn nhiều bằng `FieldList` từ field không alias, mặc định field của layout kể cả field
  lồng `author.name`, bỏ field `$...`; không field → nút xuất khóa), sắp xếp (field và chiều), nơi lưu
  (`download` hoặc `files` với thư mục); số item sẽ xuất (`aggregate` theo bộ lọc, debounce 250 ms, tối đa = giới hạn);
  khi số xuất `> queryLimit.max` hoặc `≥ 2500` thì khóa ở `files` (về lại khi giảm); tải về gọi
  `GET /items/:collection?export=<format>&limit&fields&sort&filter&search` và lưu file `<collection>.<ext>`; lưu vào
  thư viện gọi `POST /utils/export/:collection` `{format, query, file: {folder}}` và báo `export_started`.
- **FR-092**: "Tải xuống" dữ liệu đang hiện (`onDownload` của layout: `saveAsCSV`, cột theo `fields`, tên cột lồng
  "A -> B", giá trị qua `handler` của display, như Directus) PHẢI có trong mục Export như Directus.
- **FR-095** Xóa hàng loạt: nút khi `selection.length > 0`, khóa khi `batchDeleteAllowed !== true` (quyền `delete` của
  collection); hộp `batch_delete_confirm` (n); `DELETE /items/:collection` body mảng khóa; xong xóa lựa chọn, nạp lại;
  lỗi → FR-028.
- **FR-096** Archive hàng loạt: nút khi có lựa chọn, collection có `archive_field`, không đang xem `archived`; khóa khi
  không có quyền update (`archiveAllowed`); hộp `archive_confirm_count`; `PATCH /items/:collection`
  `{keys, data: {[archive_field]: archive_value}}`.
- **FR-097** Sửa hàng loạt: nút khi có lựa chọn, khóa khi `batchEditAllowed === false`; mở `DrawerBatch` (013) với
  `primaryKeys`, `collection`; drawer gửi `PATCH /items/:collection {keys, data}`; xong xóa lựa chọn và nạp lại.
- **FR-098**: Nút tạo item (`+`) khóa khi `createAllowed === false` với tooltip `not_allowed`.
- **FR-099** Refresh: mục ở panel màn collection với chọn chu kỳ (`không`, 10 s, 30 s, 1 phút, 5 phút), ghi
  `refresh_interval` của preset; chạy `refresh` của layout mỗi chu kỳ; ngừng khi tab idle (`idle.ts` của 012), làm mới
  ngay và chạy lại khi tab hoạt động; nút làm mới tay.

**Quyền**

- **FR-100**: Cây chỉ hiện `visibleCollections` của store collections (có `schema`, không `hidden` trừ khi hiện ẩn, user
  có quyền `read` theo `/permissions/me`, hoặc admin); collection hệ thống không trong cây (chuyển hướng FR-002).
- **FR-101**: Nút và mục PHẢI theo `useCollectionPermissions` và `useItemPermissions` của Directus (port): `createAllowed`,
  `updateAllowed`, `deleteAllowed`, `archiveAllowed` (update có field archive), `shareAllowed`, `revisionsAllowed`,
  `saveAllowed`, `fields`; hành vi khóa (disabled + tooltip `not_allowed`) hay ẩn đúng chỗ như Directus.
- **FR-102**: Admin thấy mọi collection và mọi nút; share user chỉ thấy theo quyền của share.
- **FR-103**: Field user không đọc được KHÔNG gửi lên API ở `fields` của danh sách và export; preset có field đó thì bỏ
  khi dựng cột (như store fields lọc); sắp xếp theo field không đọc được → API 403 → trạng thái lỗi của layout (FR-026);
  cây field của bộ lọc chỉ liệt kê field đọc được.

**Thiết kế, ngôn ngữ, phạm vi kỹ thuật**

- **FR-110**: Giao diện theo design-system (XII): bố cục `layout-patterns.md` (page header L-5, panel L-4, drawer §8),
  recipe `component-specs.md` (Table, Pagination, Card, Modal, Dropdown, Badge, Alert, Tier 3 của 013); màn và thành
  phần chưa có mẫu ghi ở "Câu hỏi mở về design-system" (Q-1 đến Q-12), xử lý như 013 (recipe nháp trước khi code, design
  owner duyệt trước khi đóng).
- **FR-110b**: Mọi chuỗi dữ liệu người dùng (tên bookmark sau `translate`, tiêu đề template, nhãn nhóm kanban, tag,
  tên share, comment) PHẢI vẽ bằng text binding, không `v-html`; chỉ comment đi qua DOMPurify không tag để chèn
  `<mark>` tên user; `help`/`text` markdown của interface đã khử ở 013.
- **FR-110c**: Chế độ tối và `prefers-reduced-motion` PHẢI áp cả phần của thư viện bên thứ ba: FullCalendar (biến
  `--fc-*` đè bằng token), popup và control MapLibre, chuyển động kéo thả và split panel (`motion-reduce`); kiểm bằng
  axe ở `html.dark` (FR-123).
- **FR-111**: Chuỗi dịch dùng khóa Directus đã sinh ở 012 (`layouts.*`, khóa gốc); thiếu `vi-VN` rơi về `en-US`.
- **FR-112**: App chỉ gọi API theo chuẩn Directus (`contracts/api-calls.md` #50 đến #96, kể cả `POST /graphql` cho
  bản sao); request ra ngoài chỉ: tile nền bản đồ (FR-039), glyph `fonts.openmaptiles.org`, style và geocoding Mapbox
  (`api.mapbox.com`) khi có key, iframe `preview_url`; không có `/websocket`, `/ai`, `/extensions/sources` (012
  FR-072). Trong E2E, host ngoài bị chặn bằng `route()` và các host trên được stub (contracts/tests §3).
- **FR-113**: Không sửa `directus/`; không ghi `directus_fields`, `directus_relations`, `directus_collections` ở màn này.
- **FR-114**: Khóa localStorage/sessionStorage mới theo tiền tố `backoffice-` (D-39): collection gần nhất, kích thước
  và chế độ live preview (FR-067).
- **FR-115**: Mọi thao tác kéo thả PHẢI có đường bàn phím tương đương (D-69) theo danh sách đóng ở
  `contracts/layouts.md` §5: sắp xếp tay (menu dòng), thứ tự và độ rộng cột (menu header), thẻ và cột kanban (menu),
  sự kiện calendar (sửa ngày trong form item), chọn trên bản đồ (danh sách trong panel), tay cầm live preview (mũi tên
  ±5 %, Home/End), điều kiện bộ lọc (menu); hộp thoại và drawer bẫy focus; mọi nút icon có nhãn; bảng có
  caption/`aria-label`, header `scope`, cột sắp xếp `aria-sort`.
- **FR-115b**: Dòng số đếm là vùng `role="status" aria-live="polite"`; đổi trang và sắp xếp thông báo qua vùng đó
  ("Trang n", "Sắp theo X tăng dần").
- **FR-115c**: Focus sau hành động: xóa item → tiêu đề trang danh sách; lưu và tạo tiếp → field đầu (`autofocus`); đóng
  hộp so sánh hoặc drawer → nút đã mở; xóa bookmark đang mở → tiêu đề trang collection.
- **FR-115d**: Hộp xác nhận (xóa, archive, hàng loạt, rời trang, xóa version/bookmark/nhóm) focus ban đầu vào nút Hủy
  (hoặc nút đầu không phá hủy), nội dung gắn `aria-describedby`, Esc hủy (Reka Dialog).
- **FR-116**: Hỗ trợ từ 768 px; không cuộn ngang trang (bảng cuộn trong khung).

**Kiểm thử**

- **FR-120**: E2E Playwright (`apps/web-e2e`, mở rộng) PHẢI phủ US1 đến US7 trên bộ mẫu của 013 (seed qua
  `pnpm nx run web:fixtures` ở `tests/parity` profile `web`; mở rộng seed bằng collection **mới** `bo_content`
  (`versioning`, `archive_field`, `display_template`, `preview_url`, `sort_field`, 30 item) và folder `bo_folder` cho
  cây nhiều cấp, preset role/global, bookmark, version, share, comment, flow thủ công `location both` và `item`;
  `bo_std` và snapshot 013 giữ nguyên) và chạy ở ba cấu hình của 012 FR-071 (Directus thật, API mới cùng origin, API
  mới khác origin); ba cấu hình dùng chung DB nên mỗi spec xóa preset và bookmark của admin trên collection nó dùng ở
  `beforeEach` và đặt tên bookmark theo `DATA_PREFIX`; so payload ghi với Directus app chỉ ở cấu hình `proxy-api`:
  cùng kịch bản chạy trên Directus app (profile `app`, 8155, cùng DB) rồi app mới, ghi lại `{method, path, body}` của
  request ghi (`/items`, `/presets`, `/versions`, `/comments`, `/shares`, `/utils/*`, `/graphql`) theo thứ tự, so sau
  chuẩn hóa (JSON round-trip, `DATA_PREFIX`, uuid, id trong path, thời gian, `time`/`id` block editor như 013
  Assumptions; thứ tự mảng giữ, thứ tự khóa object không tính); khác biệt thật ghi R-xx.
- **FR-121**: Test component (Vitest browser) cho năm layout, bộ lọc nâng cao, menu version, hộp so sánh, bốn sidebar,
  hộp xuất, nhập, với API giả lập của 013 (`mockFixtureApi`) mở rộng cho `/presets`, `/revisions`, `/versions`,
  `/comments`, `/shares`, `/utils/*`; khẳng định request gửi và DOM.
- **FR-122**: Unit test cho port của `use-preset`, `use-items` (phần mở rộng), `use-item`, `use-versions`, `use-revisions`,
  `use-flows`, `use-edits-guard`, `format-items-count`, `save-as-csv`, `basemap`, `get-route`, guard `checkForSystem`.
- **FR-123**: axe 0 vi phạm serious/critical trên màn collection (mỗi layout), màn item với sidebar, hộp thoại, ở sáng
  và tối; ngoại lệ chỉ cho thư viện bên thứ ba (bản đồ, lịch) và màu dữ liệu, ghi rule id và lý do.
- **FR-124**: Hành vi trong 13 file test Directus (đếm 2026-10-15) PHẢI có test tương ứng ở `apps/web`:
  `modules/content/components/version-menu.test.ts` → `VersionMenu.test.ts`; `layouts/kanban/kanban.test.ts` →
  `Kanban.browser.test.ts`; `layouts/calendar/options.test.ts` → `CalendarOptions.test.ts`;
  `views/private/components/{drawer-batch (013 đã port), export-sidebar-detail, flow-sidebar-detail,
  refresh-sidebar-detail, search-input}.test.ts` → cùng tên PascalCase; `composables/{use-flows, use-versions,
  use-item/index}.test.ts` và `comparison/use-comparison.test.ts` → cùng tên; `packages/composables/use-items.test.ts`
  (013 đã port). Header `// Ported from directus/...`, manifest `014-T*.json`.
- **FR-125**: Benchmark hằng tuần (workflow của 005) thêm kịch bản màn: với collection 10 triệu dòng, đo thời gian tới khi
  bảng hiện trang đầu, đổi trang, sắp xếp, lọc theo field có index và không index, số đếm; ghi p95 (SC-003).
- **FR-126**: Coverage `apps/web` ≥ 60%; lint, typecheck, kiểm màu thô, build image xanh.
- **FR-127**: Việc làm PHẢI chia bốn lượt theo story (Clarifications Q3): lượt 1 US1–US3, lượt 2 US4, lượt 3 US5, lượt
  4 US6–US7; mỗi lượt là một hoặc vài commit trên `main` với lint, typecheck, unit, E2E hiện có và build image xanh
  trước khi sang lượt sau; test E2E ba cấu hình và benchmark (FR-120, FR-125) chạy đủ ở lượt 4 nhưng mỗi lượt thêm E2E
  của story mình.

### Key Entities *(include if feature involves data)*

- **Collection**: `collection`, `schema` (null = folder), `meta` (`group`, `sort`, `collapse`, `hidden`, `singleton`,
  `icon`, `color`, `note`, `display_template`, `archive_field`, `archive_value`, `unarchive_value`,
  `archive_app_filter`, `sort_field`, `accountability`, `versioning`, `preview_url`, `translations`).
- **Preset / Bookmark** (`directus_presets`): `id`, `bookmark` (tên, null = preset), `user`, `role`, `collection`,
  `layout`, `layout_query` (theo layout: `fields`, `sort`, `page`, `limit`), `layout_options` (theo layout),
  `filter`, `search`, `refresh_interval`, `icon`, `color`.
- **Layout**: id, option (FR-030 đến FR-038), query, trạng thái (`items`, `loading`, `itemCount`, `totalCount`,
  `selection`), hành động (`refresh`, `download`, `selectAll`, `resetPreset`).
- **Item**: giá trị theo field, khóa chính, `edits` (phần đã sửa), `validationErrors`, cờ archive.
- **Revision**: `id`, `activity` (`action`, `timestamp`, `user`, `ip`, `user_agent`), `delta`, `data`, `version`.
- **Version** (`directus_versions`): `id`, `key`, `name`, `collection`, `item`, `delta`, `hash`, `date_*`, `type`
  (`local`/`global`), `+` khi chưa tạo.
- **Comment**: `id`, `comment` (có `@<uuid>`), `date_created`, `user_created`.
- **Share**: `id`, `name`, `collection`, `item`, `role`, `password`, `date_start`, `date_end`, `max_uses`, `times_used`.
- **Flow thủ công**: `id`, `name`, `icon`, `color`, `status`, `options` (`collections`, `location`, `requireSelection`,
  `requireConfirmation`, `confirmationDescription`, `fields`).
- **Bộ lọc**: cây `_and`/`_or` của `{field: {operator: value}}` với biến động.
- **Nền bản đồ**: `name`, `type`, `url`, `tileSize`, `attribution`.
- **Quyền**: `/permissions/me` theo collection và action, `fields`, `access`.

## Khác biệt so với Directus *(mandatory)*

Mã tiếp theo sau D-66 (013). D-39 (thương hiệu, khóa localStorage), D-41 (AI, collab, extension), D-47 (TailAdmin),
D-66 (notice tại chỗ thay snackbar, tới 018) áp dụng cho mọi màn của 014, không lặp. D-40 (khung module) gỡ cho Content ở
014; D-55 (chế độ so sánh) và D-58 (layout và bộ lọc của drawer chọn item) gỡ ở 014 (FR-072, FR-081, FR-029).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|------|
| D-67 | Nút "sửa trong trang" (visual editing) và module Visual Editor trong khung live preview | Có khi trang đích nhúng `@directus/visual-editing` | Không có; live preview còn lại làm đủ (FR-063 đến FR-069) | Nguyên tắc XI; owner chọn A ở Q1 (2026-10-15) | ngoài phạm vi | — |
| D-68 | Chỉ báo người cùng sửa (collab) ở header và hộp va chạm (`comparison-modal` chế độ `collab`), hộp `unsaved_changes_collab` | Có khi bật WebSocket | Không có; như Directus khi tắt WebSocket | Nguyên tắc XI (D-41) | ngoài phạm vi | — |
| D-69 | Đường bàn phím cho kéo thả: menu dòng "Lên/Xuống" (sắp xếp tay), menu header "Chuyển trái/phải" (thứ tự cột), menu thẻ kanban "Chuyển sang nhóm…", "Lên/Xuống", danh sách item của layout map trong panel, tay cầm live preview | Chỉ chuột | Thêm; kéo chuột giữ như Directus | WCAG 2.1.1, Nguyên tắc XII; cùng lý do D-60; tech lead duyệt 2026-10-15 (Q5) | khác | — |
| D-70 | Nạp lại khi công cụ AI ghi dữ liệu (`onSystemToolResult`) | Có | Không có | Nguyên tắc XI (D-41) | ngoài phạm vi | — |
| D-71 | Nút "sửa bookmark role/global" và nút "tạo collection" trỏ tới Settings | Trang Settings | Trỏ tới khung Settings của 012 (D-40) | 016 chưa có | ngoài phạm vi (tạm thời) | 016: **đã gỡ ở 016** (màn presets và data model thật, cùng route) |
| D-72 | Collection hệ thống chuyển hướng tới module của nó (`/users`, `/files`, `/insights`, `/activity`, `/settings/*`) | Màn đầy đủ | Khung module (D-40) | 015, 016, 018 chưa có | ngoài phạm vi (tạm thời) | 015: `directus_users`, `directus_files` **đã gỡ ở 015** (màn Files và Users thật, cùng route); 016: `directus_settings`, `directus_collections`, `directus_roles`, `directus_presets`, `directus_translations` **đã gỡ ở 016**, `directus_flows` **đã gỡ ở 017** (trình chỉnh sửa flows); `directus_dashboards`, `directus_activity` **đã gỡ ở 018** (màn Insights, Activity thật) |
| D-74 | Xác nhận trước khi xóa nhóm kanban (xóa item thật của collection nhóm) | Xóa ngay khi bấm, không hỏi (`kanban.vue:195` gọi `deleteGroup` thẳng; T003 a) | Hộp xác nhận (focus Hủy) | An toàn dữ liệu (xóa item thật không hoàn tác được); owner duyệt có điều kiện ở release-gate CHK011 | khác | — |
| D-73 | Interface hệ thống `system-filter` (bộ lọc nâng cao) và `system-input-translated-string` (tên bookmark) | Có | Làm ở 014 (D-57 của 013 đã sửa, commit `0e513e5`) | Thanh tìm kiếm và bookmark của Content cần; Clarifications Q-A; tech lead duyệt 2026-10-15 (Q5) | — (thu hẹp D-57) | — |
| D-75 | Tên user trong mention của comment | Chèn thẳng tên vào HTML (`comment-item.vue`), có thể chạy mã qua tên user | Tên được escape HTML trước khi bọc `<mark>` (DOMPurify không cho tag khác) | An toàn (FR-110b) | khác | — |
| D-76 | Thứ tự nút của hộp `unsaved_changes` ở màn item | "Discard Changes" trước, "Keep Editing" sau | "Keep Editing" trước, nhận focus đầu (Hủy trước) | FR-115d (focus vào lựa chọn an toàn) | khác | — |
| D-77 | Lỗi của request đếm (`getItemCount`/`getTotalCount` trong `use-items`) | Ném lại trong watcher, thành promise bị từ chối không ai bắt (vd 403 ở collection không đọc được) | Ghi `console.warn`, giữ số đếm cũ; lỗi của request danh sách vẫn hiện ở layout | Không làm vỡ trang khi đếm lỗi (CI 014) | khác | — |
| D-78 | Nút thêm nhóm của kanban (nhóm m2o) | Có hộp thêm nhóm nhưng không có nút mở | Cột "Add group" (viền đứt) khi user được tạo ở collection nhóm | FR-037, recipe Q-5 | khác | — |
| D-79 | Mục Shares khi user không có quyền share | Mục vẫn hiện, chỉ ẩn nút "New Share" | Ẩn cả mục, không gửi request | FR-083, US5-3 | khác | — |
| D-80 | Chọn item trên map trong drawer chọn một | Không truyền `showSelect` cho map: chọn thêm cộng dồn | Truyền `showSelect`: chọn một thay lựa chọn cũ, chọn nhiều cộng dồn (Shift) | FR-029 | khác | — |
| D-81 | Nút xuất của hộp Export | Bấm được khi chưa chọn field | Khóa khi chưa chọn field nào | FR-091 | khác | — |
| D-82 | Bề ngang form của màn item trên màn rộng | Form chiếm hết bề ngang nội dung; field `fill` kéo hết bề ngang | Form dừng ở 64rem (`max-w-5xl`); field `fill` dừng ở đó | Dễ đọc trên màn rộng (chủ dự án, 2026-10-15) | khác | — |
| D-91 | Nội dung gửi khi sửa comment (`PATCH /comments/<id>`) | Ô soạn thảo contenteditable (`comment-input.vue`, `v-template-input`) nạp comment cũ dạng HTML `md()` có `\n` sau `</p>`; trên Chromium thay toàn bộ nội dung gửi `"\nEdited comment"` (người gõ tay còn bị đảo chữ: `"\nyped commentT"`), Firefox và WebKit gửi đúng chữ đã gõ | Ô nhập văn bản (recipe Q-11) gửi đúng chữ đã gõ trên mọi trình duyệt | Ký tự `\n` là lỗi contenteditable của Chromium, không phải logic Directus; chép lại phải bỏ Q-11 và chỉ khớp trên Chromium (phiên 015 dò trên Directus app 8155, 2026-10-16; chủ dự án quyết giữ, 2026-10-16) | khác | — |
| D-124 | Giá trị gửi khi khôi phục revision có field `input-rich-text-html` khác nhau | Gửi HTML đã chèn thẻ tô màu diff (`<span class="comparison-diff--added">`), vì `processRichTextHtmlFields` ghi đè chính `incoming`/`base` mà `comparison-modal` dùng để khôi phục (đọc code 11.17.4, chưa đo) | Hiển thị diff như Directus; khôi phục gửi giá trị gốc trước khi chèn thẻ (`raw` của comparison) | Không ghi markup hiển thị vào dữ liệu | khác | — |
| D-129 | Nút mở/đóng nhóm trong cây collection của sidebar | Mũi tên sau tên (`v-list-group`) | Mũi tên `expand_more` ở cuối dòng (xoay 180° khi mở); các mục cùng cấp thẳng hàng, mục con thụt 16 px so với cha (trước đó nút ở đầu dòng làm mục con lệch trái hơn icon của cha) | Owner 2026-10-21 | khác | — |
| D-133 | Viền thẻ đang chọn của layout cards | Viền chọn của `v-card` | Viền brand 2px vẽ bên trong thẻ (`border-brand-500` + `ring-1 ring-inset`); trước đó `ring-2` vẽ ra ngoài bị khung cuộn của trang `fill` cắt mất ở thẻ sát mép | Owner 2026-10-21 (lỗi hiển thị) | khác | — |
| D-150 | Khung form của màn item | `v-form` nằm thẳng trên nền trang, không khung | Form trong Card TailAdmin (`rounded-2xl border border-gray-200 bg-white`, thân `p-4 sm:p-6`); mỗi divider đang hiện mở một card mới, tiêu đề và icon của divider thành header card, card đầu không header (tiêu đề đã ở page header, D-127); field giữ bề ngang Directus (cột 342px) nên cột rộng 47.375rem, 67.125rem khi có field `fill`, canh trái nội dung; form rỗng không lồng card (owner 2026-10-22) | Design-system TailAdmin (Form Layout), owner 2026-10-22 | khác | — |
| D-153 | Vị trí cột form của màn item | Form canh trái, chỉ có `--content-padding` (`modules/content/routes/item.vue`) | Cột form (card, 47.375rem / 67.125rem) canh trái vùng nội dung, bỏ căn giữa của owner 2026-10-18, về lại vị trí như Directus (`utils/form-column.ts`, layout-patterns §5) | Owner 2026-10-22 | khác | — |
| D-155 | Vị trí menu phiên bản ở page header | Dòng headline trên tiêu đề, sau breadcrumb và dấu `•` | Ngay sau tiêu đề trên cùng dòng (`title-append`), bỏ dấu `•` thừa từ khi bỏ breadcrumb (D-101); header còn một dòng | Owner 2026-10-22 (lỗi hiển thị) | khác | — |
| D-156 | Folder gốc trong cây collection của sidebar | Dòng folder như dòng collection (icon, tên), con thụt vào | Folder cấp 1 (không schema) là tiêu đề nhóm kiểu TailAdmin (`text-theme-xs uppercase tracking-wide text-gray-500`, không icon, cách nhóm trước `mt-3`), con không thụt; folder sâu hơn và collection có con giữ kiểu cũ; vẫn bấm để đóng/mở, bàn phím tree không đổi | Cây 3 cấp khó đọc, owner 2026-10-22 | khác | — |
| D-160 | Giao diện phân trang (`BoPagination`, dùng ở tabular, cards, map, revisions, thông báo, marketplace) | `v-pagination` | Phân trang data table của TailAdmin: nút mũi tên có viền 40 px (`arrow_back` / `arrow_forward`), nút trang 40 px chữ `text-sm font-medium`, trang hiện tại nền `brand-500/[0.08]` chữ brand-600 (TailAdmin brand-500 chỉ 4.35:1); hành vi (số trang hiện, `…`, đầu/cuối) giữ như Directus | Giống TailAdmin, owner 2026-10-22 | khác | — |
| D-170 | Kéo thả dòng trong filter (`system-filter`) | Không có gợi ý nơi thả | Trong lúc kéo một dòng, mọi group AND/OR hiện khung nét đứt mờ và nền brand nhạt (từ D-171 là viền card của group; group rỗng cao 32px) để thấy chỗ thả; tùy chọn Sortable giữ như Directus (`Nodes.vue`, component-specs Search and advanced filter) | Owner 2026-10-23 | khác | — |
| D-171 | Group AND/OR trong filter (`system-filter`) | Header dạng pill, dòng con thụt vào với viền trái | Mỗi group là card TailAdmin (`rounded-xl`, viền, nền xám nhạt, bóng nhẹ) chứa header phẳng (chip AND/OR, mô tả, menu và nút xóa ở mép phải) và các dòng con; viền trái 3px theo màu chip (brand AND, cam OR); khi kéo (D-170) viền card thành nét đứt brand trên nền brand nhạt (`Nodes.vue`, component-specs Search and advanced filter) | Owner 2026-10-23 | khác | — |

**Trạng thái khác biệt (T099, cuối lượt 4)**:

| Mã | Đã làm trong code | Duyệt |
|----|-------------------|-------|
| D-67 | `LivePreview.vue`, `PreviewRoute.vue`: không nút và lớp visual editing | Tech lead duyệt (gộp Q5, CHK067), xác nhận lại 2026-10-15 |
| D-68 | `ComparisonModal.vue`, `ComparisonHeader.vue`: không chế độ `collab` | Tech lead duyệt (gộp Q5, CHK067), xác nhận lại 2026-10-15 |
| D-69 | Menu header "Chuyển trái/phải" và menu dòng "Lên/Xuống" (`layouts/tabular/Tabular.vue`), menu cột và thẻ kanban (`layouts/kanban/Kanban.vue`), danh sách "Items in view" của map (`layouts/map/MapActions.vue`), phím tay cầm live preview (`components/SplitPanel.vue`), "Lên/Xuống" của điều kiện bộ lọc (`system-filter/Nodes.vue`); lịch: đổi ngày bằng form | Tech lead duyệt 2026-10-15 (Q5) |
| D-70 | `ItemRoute.vue`: không nạp lại theo công cụ AI | Tech lead duyệt (gộp Q5, CHK067), xác nhận lại 2026-10-15 |
| D-71 | Sửa bookmark role/global trỏ `/settings/presets/:id` (`NavigationBookmark.vue`); "tạo collection" trỏ `/settings/data-model/+` (`ContentNavigation.vue`, `NoCollections.vue`) | Tech lead duyệt (gộp Q5, CHK067), xác nhận lại 2026-10-15; đã gỡ ở 016 |
| D-72 | `checkForSystem` của `modules/content.ts` chuyển `/content/directus_*` sang route module (`utils/get-item-route.ts`), hiện khung module của 012 | Tech lead duyệt (gộp Q5, CHK067), xác nhận lại 2026-10-15; đã gỡ ở 015, 016, 017 (`directus_flows`) và 018 (`directus_dashboards`, `directus_activity`) |
| D-73 | `interfaces/_system/system-filter/`, `interfaces/_system/system-input-translated-string/` | Tech lead duyệt 2026-10-15 (Q5) |
| D-74 | `Kanban.vue`: `BoDialog` xác nhận trước khi xóa nhóm (Hủy trước) | Owner duyệt có điều kiện (CHK011); điều kiện thỏa (T003 a: Directus xóa ngay). Tech lead xác nhận 2026-10-15 |
| R-38 | `composables/use-items.ts` giữ memo đếm như Directus; `use-items.test.ts` khẳng định 0 request đếm sau làm mới | Tech lead duyệt 2026-10-15 |
| D-75 | `CommentItem.vue`: escape tên trong mention | Tech lead duyệt 2026-10-15 |
| D-76 | `ItemRoute.vue`: hộp `unsaved_changes` đặt "Keep Editing" trước | Tech lead duyệt 2026-10-15 |
| D-77 | `composables/use-items.ts`: request đếm lỗi không ném lại | Tech lead duyệt 2026-10-15 |
| D-78 | `layouts/kanban/Kanban.vue`: cột "Add group" | Tech lead duyệt 2026-10-15 |
| D-79 | `components/sidebar/SharesSidebarDetail.vue`: ẩn cả mục khi không có quyền | Tech lead duyệt 2026-10-15 |
| D-80 | `layouts/map/*`: truyền `showSelect` | Tech lead duyệt 2026-10-15 |
| D-81 | `components/sidebar/ExportSidebarDetail.vue`: khóa nút xuất khi chưa chọn field | Tech lead duyệt 2026-10-15 |
| D-82 | `modules/content/routes/ItemRoute.vue`: `BoForm` `max-w-5xl` | Chủ dự án duyệt 2026-10-15 |
| D-91 | `components/sidebar/CommentInput.vue`, `CommentItem.vue` giữ ô nhập Q-11; `e2e/payload/comments-shares.spec.ts` khẳng định hai payload khác nhau | Chủ dự án duyệt 2026-10-16 |
| D-124 | `components/comparison/use-comparison.ts` (`raw`), `ComparisonModal.vue` (khôi phục đọc `raw`); `use-comparison.test.ts` | Chủ dự án duyệt, tech lead duyệt 2026-10-20 |
| D-129 | `modules/content/components/NavigationItem.vue` (nút ở cuối dòng); `design-system/docs/layout-patterns.md` §9 | Owner yêu cầu (2026-10-21) |
| D-133 | `layouts/cards/components/Card.vue`; `Cards.browser.test.ts`; `design-system/docs/component-specs.md` (Cards grid) | Owner yêu cầu (2026-10-21) |
| D-150 | `components/form/BoForm.vue` prop `card`; `utils/form-column.ts`; `modules/content/routes/ItemRoute.vue`; `BoForm.us1.test.ts`, `form-column.test.ts`, `ItemRoute.test.ts`; `design-system/docs/layout-patterns.md` §5, §8 (Form card) | Owner duyệt (2026-10-22) |
| D-153 | `utils/form-column.ts` bỏ `mx-auto`; `form-column.test.ts`, `ItemRoute.test.ts`; layout-patterns §5, §8 | Owner yêu cầu (2026-10-22) |
| D-155 | `modules/content/routes/ItemRoute.vue` (`#title-append`), `components/VersionMenu.vue` (bỏ `•`), `layout/PageHeader.vue` (chú thích); component-specs (Page header controls) | Owner yêu cầu (2026-10-22) |
| D-156 | `modules/content/components/NavigationItem.vue` (`heading`), `NavigationItemContent.vue` (icon tùy chọn); layout-patterns §9 | Owner yêu cầu (2026-10-22) |
| D-160 | `components/BoPagination.vue`, `BoPagination.test.ts`; component-specs (Data table and pagination) | Owner yêu cầu (2026-10-22) |

**Rủi ro chấp nhận (tái tạo từ Directus)**: theo quy tắc của 004 (tái tạo hành vi Directus và ghi R), mã tiếp theo sau
R-37; tech lead duyệt trước khi đóng.

| Mã | Hành vi của Directus | Bằng chứng | Hệ quả |
|----|----------------------|------------|--------|
| R-38 | Làm mới layout (chu kỳ `refresh_interval`, flow chạy xong, sau thao tác hàng loạt) nạp lại danh sách nhưng không gửi lại request đếm: `getItemCount`/`getTotalCount` gọi `fetchAggregate` có `useMemoize` theo `(url, filter, search)` không bao giờ xóa trong instance layout | `packages/composables/src/use-items.ts` (`useMemoize`, không `clear`); đo T004 ngày 2026-10-16 trên Directus app 11.17.4 (8155): `bo_std` 3 item, chu kỳ 10 s, thêm item qua API → sau lần làm mới bảng có 4 dòng, 0 request đếm, vẫn hiện "3 Items" | Dòng số đếm và số trang sai tới khi đổi bộ lọc, tìm kiếm hoặc mở lại màn; app mới tái tạo (test khẳng định 0 request đếm sau làm mới) |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Khóa localStorage `directus-last-accessed-collection`, `live-preview-*` đổi tiền tố `backoffice-` (D-39): hai app
  không chia sẻ localStorage (khác origin `/admin` chỉ khi cùng domain; cùng domain thì khóa khác nhau không xung đột).
- Link share `<origin>/admin/shared/<id>`: giữ path `/admin/shared` như Directus để link tạo ở app này mở được ở app kia
  (cùng reverse proxy).
- D-69 và D-73: đã duyệt (Q5), không còn chờ.

## Câu hỏi mở về design-system (Nguyên tắc XII)

`component-specs.md` có Table (bảng cơ bản), Pagination (chưa), Card, Modal, Dropdown; `layout-patterns.md` §7 ghi
sub-menu module **một cấp** (L-3) và "mỗi module feature quyết định điều hướng sâu hơn (nhóm collection, folder)". Xử lý
như 013: recipe nháp vào `design-system/docs/` trước khi code, design owner duyệt trước khi đóng 014. Danh sách duyệt:
`design-review/README.md`.

| Mã | Câu hỏi | Trạng thái |
|----|---------|------------|
| Q-1 | Cây collection nhiều cấp (nhóm lồng, folder, collection ẩn, bookmark dưới collection, ô tìm, menu chuột phải) **bên trong sub-menu của sidebar** (owner chọn 2026-10-15, Clarifications Q2): thụt cấp, icon gập mở, mục bookmark, ô tìm dính đầu cây, menu "hiện collection ẩn" | Đóng 2026-10-20 (design owner duyệt): recipe nháp `layout-patterns.md` §9 đã đối chiếu code (T098), chờ design owner duyệt |
| Q-2 | Bảng dữ liệu lớn: header dính, kéo độ rộng và thứ tự cột, menu header, ô chọn, kéo sắp xếp tay, ba khoảng cách dòng, footer phân trang và kích thước trang (TailAdmin chỉ có BasicTable) | Đóng 2026-10-20 (design owner duyệt): recipe nháp `component-specs.md` (Q-2) đã đối chiếu code (T098), chờ design owner duyệt |
| Q-3 | Lưới thẻ (cards): thẻ ảnh, kích thước thẻ, chọn, trạng thái tải | Đóng 2026-10-20 (design owner duyệt): recipe nháp `component-specs.md` (Q-3) đã đối chiếu code (T098), chờ design owner duyệt |
| Q-4 | Lịch (toolbar, view tháng/tuần/ngày/danh sách, sự kiện, kéo) trên theme TailAdmin (TailAdmin có mẫu Calendar với FullCalendar: dùng được không) | Đóng 2026-10-20 (design owner duyệt): recipe nháp `component-specs.md` (Q-4) đã đối chiếu code (T098), chờ design owner duyệt |
| Q-5 | Bảng kanban: cột, thẻ (ảnh, tag, avatar, ngày), kéo thả, thêm/sửa cột | Đóng 2026-10-20 (design owner duyệt): recipe nháp `component-specs.md` (Q-5) đã đối chiếu code (T098), chờ design owner duyệt |
| Q-6 | Khung layout bản đồ toàn trang, popup item, chọn vùng, menu nền; panel chia đôi live preview (tay cầm kéo, thanh công cụ khung xem trước, chọn kích thước màn hình) | Đóng 2026-10-20 (design owner duyệt): recipe nháp "Map layout" và `layout-patterns.md` §10 đã đối chiếu code (T098), chờ design owner duyệt |
| Q-7 | Bộ lọc nâng cao: cây điều kiện lồng, chọn field (cây), toán tử, ô giá trị theo kiểu, nút `_and`/`_or`, kéo thả; thanh tìm kiếm mở rộng có nút bộ lọc và số điều kiện | Đóng 2026-10-20 (design owner duyệt): recipe nháp `component-specs.md` (Q-7) đã đối chiếu code (T098), chờ design owner duyệt |
| Q-8 | Nút bookmark cạnh tiêu đề page header; menu version trong breadcrumb; nút lưu có menu phụ (split button) | Đóng 2026-10-20 (design owner duyệt): recipe nháp `component-specs.md` (Q-8) đã đối chiếu code (T098), chờ design owner duyệt |
| Q-9 | Mục accordion trong panel L-4: Layout (menu chọn + option), Archive, Refresh, Export/Import, Flows (nút chạy, trạng thái) | Đóng 2026-10-20 (design owner duyệt): recipe nháp `component-specs.md` (Q-9) đã đối chiếu code (T098), chờ design owner duyệt |
| Q-10 | Revisions: nhóm theo ngày, mục revision, phân trang; hộp so sánh (hai cột, chọn field, chỉ khác biệt) | Đóng 2026-10-20 (design owner duyệt): recipe nháp `component-specs.md` (Q-10) đã đối chiếu code (T098), chờ design owner duyệt |
| Q-11 | Comments: luồng theo ngày, ô nhập với gợi ý `@`, `<mark>` tên user; Shares: mục share, drawer tạo/sửa, hộp gửi email | Đóng 2026-10-20 (design owner duyệt): recipe nháp `component-specs.md` (Q-11) đã đối chiếu code (T098), chờ design owner duyệt |
| Q-12 | Hộp thoại xuất (nhiều trường), nhập (chọn file, tiến độ), hộp lỗi nhập; hộp xác nhận hàng loạt | Đóng 2026-10-20 (design owner duyệt): recipe nháp `component-specs.md` (Q-12) đã đối chiếu code (T098), chờ design owner duyệt |

## Clarifications

### Session 2026-10-15

- Q-A: `system-filter` (bộ lọc nâng cao) thuộc 016 theo D-57 của 013, nhưng thanh tìm kiếm của Content cần nó. → A: 014
  làm `system-filter` và `system-input-translated-string` (tên bookmark); thu hẹp D-57 (D-73, FR-041, FR-013); dòng
  D-57 của spec 013 đã sửa theo (commit `0e513e5`).
- Q-B: Đếm phía server với 10 triệu dòng: làm như Directus (đếm riêng bằng `aggregate`, không chặn danh sách, nhớ theo bộ
  lọc) hay thêm giới hạn riêng? → A: Như Directus (FR-023), không thêm cơ chế riêng; "mượt" đo bằng thời gian hiện trang
  đầu không tính số đếm (SC-003); API phía 005 chịu trách nhiệm tốc độ đếm (SC-006 của 005).
- Q1: Live preview (`collection.meta.preview_url`: iframe chia đôi hoặc cửa sổ `/content/:collection/:pk/preview`, nạp
  lại sau lưu, `$version`) có thuộc 014 không? Mô tả không nêu; visual editing là XI. → A: Làm live preview đầy đủ như
  Directus trừ visual editing (FR-063 đến FR-069, Q-6, route preview, D-67 chỉ còn visual editing). Owner chọn
  2026-10-15.
- Q2: Cây collection nhiều cấp đặt ở đâu trong khung TailAdmin (sidebar chỉ có sub-menu một cấp, L-3)? → A: Bên trong
  sub-menu của sidebar, mở rộng thành cây lồng nhiều cấp cho riêng module Content; không thêm cột điều hướng, không
  đặt trong vùng nội dung (FR-004, Q-1).
- Q3: 014 vượt 60 task; chia thế nào (SPECKIT-GUIDE)? → A: Một feature, tasks chia bốn lượt theo story: lượt 1 cây
  collection, bảng, màn item, tìm kiếm, bộ lọc, bookmark (US1–US3); lượt 2 cards, calendar, kanban, map (US4); lượt 3
  sidebar, version, live preview (US5); lượt 4 xuất nhập, hàng loạt, E2E ba cấu hình, benchmark (US6–US7). Mỗi lượt
  kết thúc bằng commit lên `main` với lint, unit, E2E hiện có xanh, như 004 (FR-127).
- Q4: Trang bảng tới 1000 dòng vẽ thế nào (vẽ đủ như Directus, ảo hóa dòng, hay giới hạn 250)? → A: Như Directus, vẽ
  toàn bộ dòng của trang, header dính bằng CSS, không ảo hóa, giữ danh sách kích thước trang; thêm tiêu chí đo trang
  1000 dòng × 10 cột (FR-033, SC-011).
- Q5: D-69 (đường bàn phím cho kéo thả) và D-73 (`system-filter`, `system-input-translated-string` làm ở 014) duyệt
  thế nào? → A: Tech lead duyệt cả hai ngày 2026-10-15; không còn mục chờ ở "Cần xác nhận".

## Assumptions

- Thư viện: lịch dùng FullCalendar 6 như Directus (TailAdmin cũng dùng), bản đồ maplibre-gl 6.14.0 (D-62) và
  `@mapbox/mapbox-gl-draw` của 013, kéo thả `vuedraggable` (013); phiên bản chốt ở plan.
- Thao tác kéo chuột giữ như Directus; đường bàn phím là bổ sung (D-69), không thay thế.
- Store `collections`, `fields`, `relations`, `permissions`, `presets`, `flows` của 012/013 đủ cho 014; thiếu hàm thì
  port thêm từ store Directus tương ứng (FR-018).
- `useItems` của 013 (`apps/web/src/composables/use-items.ts`) là bản port của `@directus/composables`; 014 dùng lại và
  mở rộng (`filterSystem`, `alias`, `deep`, `changeManualSort`) nếu thiếu.
- E2E so payload chạy tuần tự hai app trên cùng DB seed lại giữa hai lượt; chuẩn hóa như 013; khác biệt thật ghi R-xx.
- Benchmark màn (FR-125) chỉ chạy ở workflow hằng tuần của 005 (dữ liệu 10 triệu dòng), không chặn CI; ngưỡng SC-003
  đo ở API mới và Directus thật, hai cấu hình.
- Với collection 10 triệu dòng, Directus app cũng chờ `countDistinct`; app mới không nhanh hơn API; "mượt" là không
  chặn và không gửi request thừa (FR-022, FR-023).
- Share user: module Content đã nhận `ShareUser` ở 012 (`preRegisterCheck`); 014 chỉ cần quyền từ `/permissions/me`.
- Nút "tạo collection" (admin, không có collection) và sửa bookmark role/global trỏ khung Settings (D-71).
- Thông báo thành công (lưu, xóa, chép link) là notice tại chỗ trong page header hoặc hộp thoại (D-66) tới khi 018 có
  snackbar.
- Chuỗi `layouts.*`, `revisions`, `comments`, `shares`, `versions`... đã có trong file dịch sinh ở 012 (sinh từ toàn bộ
  `en-US.yaml`); thiếu thì chạy lại script sinh, không viết tay.
- Màn preset ở Settings (016) không thuộc 014; 014 ghi preset đúng dạng để 016 và Directus đọc.
- Cỡ trang mặc định và danh sách cỡ trang như Directus; không thêm "tải thêm" hay cuộn vô hạn.
- Rủi ro chấp nhận như Directus: iframe live preview nhúng URL do admin cấu hình trong `preview_url` (FR-069); preset
  tự lưu có thể mất khi rời trang trong 450 ms; hai người sửa cùng item ghi đè từng field (D-68).
- Thay đổi tài liệu ngoài `specs/014-*` khi 013 mở khóa working tree: `design-system/docs/layout-patterns.md` §7 ghi
  ngoại lệ cây nhiều cấp cho module Content (CHK055), spec 012 Assumptions trỏ tới đó; D-40, D-45 (012) và D-55, D-58
  (013) ghi "đã gỡ ở 014" khi đóng.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% kịch bản E2E của US1 đến US7 đạt ở ba cấu hình API (Directus thật, API mới cùng origin, API mới khác
  origin) trên chromium 768 và 1280; cấu hình cùng origin thêm firefox-1280 và webkit-1280 cho ba spec lõi
  (`content-tabular`, `content-item`, `content-filter-bookmark`; giới hạn 75 phút của job `e2e-web`); cors chỉ
  chromium-1280 như 012; "các luồng chính của module Content làm được tương tự" = SC-001 và SC-004.
- **SC-002**: Với bộ mẫu, so với Directus app trên cùng DB cho ba user (`admin`, `bo-editor`, `bo-viewer`) bằng E2E
  song song, 0 lệch ngoài D-xx ở năm thuộc tính: (a) nhãn và thứ tự mục cây (nhóm, bookmark), (b) text header cột mặc
  định, (c) chuỗi dòng số đếm, (d) `disabled` của nút tạo, xóa, archive, sửa hàng loạt, lưu, xóa item, (e) mục sidebar
  hiện; thu bằng `innerText` và `aria-disabled`.
- **SC-003**: Trên collection 10 triệu dòng (benchmark 005): app mới không chậm hơn Directus app (8155/admin) cùng kịch
  bản quá 10 % p95 (constitution X) ở cả hai cấu hình API; mục tiêu tuyệt đối (không chặn): trang đầu (25 dòng, 4 cột)
  dưới 2 giây p95 không tính số đếm, đổi trang và sắp xếp theo field có index dưới 1,5 giây p95; số request mỗi thao
  tác: đổi trang và sắp xếp = 1 danh sách, 0 đếm; lọc hoặc tìm = 1 danh sách + 1 `itemCount` (+ 1 `totalCount` chỉ
  khi bộ lọc archive đổi); đổi collection = 1 + 2; số đếm về không làm bảng vẽ lại quá 1 lần; đo ở workflow benchmark
  hằng tuần, chromium, 11 lần lấy p95.
- **SC-004**: 100% body ghi (`/items` tạo, sửa, bản sao, xóa, archive, hàng loạt; `/presets`; `/versions` tạo, save,
  promote; `/comments`; `/shares`; `/utils/import`, `/utils/export`; `/utils/sort`) của kịch bản E2E bằng body Directus
  app gửi cho cùng kịch bản sau chuẩn hóa (FR-120); bộ lọc dựng bằng bộ lọc nâng cao cho JSON bằng Directus ở 10 mẫu
  (FR-041).
- **SC-005**: Năm layout: với bộ mẫu, request `/items` (fields, filter, limit, sort) và `layout_options` ghi ra của mỗi
  layout trùng Directus (test component, mẫu request viết tay từ `index.ts` Directus có ghi dòng nguồn; mốc
  `layout_options` ghi từ Directus app bằng bộ so payload, kịch bản "đổi option layout"); mỗi layout có ít nhất một
  kịch bản E2E so với Directus app; map chạy với ba nguồn nền (OSM, Mapbox stub bằng `route()`: style JSON tối thiểu và
  geocoding rỗng, raster riêng) không request ngoài danh sách FR-112.
- **SC-006**: axe 0 vi phạm serious/critical trên màn collection (năm layout), màn item với bốn sidebar và hộp so sánh,
  hộp xuất/nhập, ở sáng và tối (ngoại lệ FR-123); 100% thao tác kéo thả trong danh sách đóng `contracts/layouts.md` §5
  có đường bàn phím (D-69) kiểm trong test.
- **SC-007**: Coverage `apps/web` ≥ 60%; lint, typecheck, unit, E2E (ba cấu hình), build image xanh; 0 màu thô ngoài
  danh sách miễn (Q-C của 013).
- **SC-008**: 0 file trong `directus/` bị sửa; trong E2E, 0 request tới route ngoài danh sách FR-112 và 012 FR-072.
- **SC-009**: Recipe nháp Q-1 đến Q-12 được design owner duyệt, bảng Q chuyển "Đóng", `qa/handoff-checklist.md` đạt
  trước khi đóng 014.
- **SC-010**: D-67 đến D-73 và R-38 trở đi (nếu có) được tech lead duyệt trước khi đóng; D-55, D-58 của 013 và D-40 của
  012 (phần Content) ghi "đã gỡ ở 014".
- **SC-011**: Layout bảng với 1000 dòng × 10 cột có display (dữ liệu giả lập đã nạp) vẽ xong trong dưới 2 giây; cuộn
  10 lần `scrollBy(0, 2000)` không ném lỗi và không vẽ lại toàn bảng (đếm `onUpdated` ≤ 1); cây 300 collection + 100
  bookmark vẽ dưới 500 ms; điều kiện đo như SC-004 của 013 (chromium CI, lần dựng đầu, trung vị 3 lần, bước `PERF=1`
  không coverage).
- **SC-012**: Chunk chính của app giữ ngân sách 013 + 60 KB gzip; calendar, map layout, kanban, cards, split panel +
  live preview, hộp so sánh, `system-filter` là chunk lười; `scripts/check-bundle.mjs` kiểm trong CI.
