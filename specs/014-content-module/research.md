# Research: Module Content (014)

Ngày 2026-10-15. Mỗi mục: quyết định, lý do, phương án bỏ. Directus tham chiếu 11.17.4 (`directus/app` 15.10.0,
`directus/packages/composables` 11.4.1, `@directus/utils` 13.4.1). Dòng [Unverified] kiểm ở task đầu lượt 1 (T002 như
013); kết quả ghi lại vào file này.

## R1. Thư viện và phiên bản

**Quyết định**: cùng bản Directus 11.17.4 ở gói quyết định hành vi hoặc dữ liệu; thêm vào catalog `pnpm-workspace.yaml`
nhóm "Web". Đã có từ 013: maplibre-gl 6.14.0, mapbox-gl-draw 1.5.1, mapbox-gl-geocoder 5.1.2, vuedraggable 4.1.0,
vue-virtual-scroller 2.0.0-beta.8, @directus/utils 13.4.1, @sindresorhus/slugify 2.2.1, micromustache 8.0.3.

| Gói | Bản (catalog Directus) | Giấy phép | Dùng cho | Ghi chú |
|-----|------------------------|-----------|----------|---------|
| `@fullcalendar/core`, `daygrid`, `timegrid`, `list`, `interaction` | 6.1.19 | MIT | layout `calendar` (FR-036) | Cùng option, view, sự kiện kéo như `layouts/calendar/index.ts`; locale nạp động `@fullcalendar/core/locales/<x>` như `get-fullcalendar-locale.ts`; TailAdmin free dùng FullCalendar nên recipe Q-4 có mẫu CSS |
| `@json2csv/plainjs` | 7.0.6 | MIT | `save-as-csv` (FR-092) | Cùng `Parser` để CSV tải trang hiện tại bằng byte với Directus (US6-2) |
| `file-saver` | 2.0.5 (+ `@types/file-saver`) | MIT | `saveAs` của CSV và export tải về | |
| `@directus/vue-split-panel` | 0.8.9 | MIT (repo GitHub; T002) | chia đôi live preview (FR-064) | Dự phòng: `SplitPanel.vue` riêng trên `ResizeHandle` + `useLayoutStorage` của 012 (sidebar split đã có), cùng props `size`, `collapsed`, `minSize`, `maxSize`, `snapPoints` |
| `json-to-graphql-query` | 2.3.0 (catalog Directus `directus/pnpm-workspace.yaml`; giấy phép, ESM kiểm T002) | MIT (T002) | `saveAsCopy` (FR-053) dựng query `<collection>_by_id` như `use-item` | Dự phòng: hàm chép tối thiểu (alias, args, field lồng) |
| `@fullcalendar/*` CSS | theo gói | | | Biến `--fc-*` đè bằng token theme trong `calendar.css` của app (T002: biến đặt trên `.fc` thắng `:root`, xem Kết quả kiểm) |

**Không thêm**: `@directus/composables`, `@directus/stores` (chép phần cần: `use-layout`, `use-items` đã có, `app.basemap`);
`axios` (sdk + `apiFetch`); thư viện bảng ảo mới (Q4 = vẽ đủ như Directus).

**Kết quả kiểm (T002, 2026-10-16)**: `pnpm view`: `@fullcalendar/core` 6.1.19, `@json2csv/plainjs` 7.0.6, `file-saver`
2.0.5, `json-to-graphql-query` 2.3.0 đều MIT; `@directus/vue-split-panel` 0.8.9 không khai `license` trong package nhưng
repo GitHub `directus/vue-split-panel` là MIT (GitHub API). `json-to-graphql-query` 2.3.0 đã có sẵn trong catalog (API
dùng); `@directus/vue-split-panel` được thêm vào danh sách web-only của `tools/check-package-names.mjs`.
`src/test-utils/libraries.smoke.browser.test.ts` (chromium): split panel nạp như ES module, `jsonToGraphQLQuery` dựng
đúng query `<c>_by_id`, và biến `--fc-*` đặt trên phần tử `.fc` thắng giá trị `:root` mà FullCalendar chèn lúc chạy.
`pnpm audit --prod --audit-level=high` không có advisory mới. Không cần dự phòng nào.

**Phương án bỏ**: lịch riêng trên Reka (mất kéo thả, view, locale của FullCalendar); CSV viết tay (khác byte với
Directus ở quoting); fetch blob thay `file-saver` (file-saver xử lý Safari, như Directus).

## R2. Route, điều hướng, cây collection trong sidebar (Q2)

**Quyết định**:

- `modules/content.ts` thay `placeholderRoutes` bằng route chép từ `modules/content/index.ts` (`no-collections`,
  `content-collection`, `content-item`, `content-item-preview`, `content-item-not-found`, guard `checkForSystem`,
  `getArchiveValue`); `RouterPass` của 012 giữ. Route con dùng `component: () => import(...)` (chunk lười, R14).
- Sidebar 012 đã có slot `navigation` của module đang hoạt động (`AppSidebar.vue` dòng 145). Module Content truyền
  `ContentNavigation.vue` (chép `navigation.vue` + `NavigationItem.vue` + `navigation-item-content.vue` +
  `navigation-bookmark.vue`) vào slot đó qua `PrivateView` (slot `navigation` đã có). Cây: mục nhóm là
  `<button aria-expanded>` + `<ul>` lồng (thụt `ps-4` mỗi cấp), bookmark là mục con có menu; ô tìm (`type="search"`) dính
  đầu cây; nút "hiện collection ẩn" cạnh ô tìm (thay menu chuột phải, giữ cả `contextmenu`). Recipe Q-1 viết vào
  `layout-patterns.md` §9 trước khi code.
- `useNavigation` (chép): `activeGroups`, `showHidden` là ref module-level dùng chung; nhóm `collapse: locked` không
  đóng; nhóm chứa collection đang xem tự mở.
- `getCollectionRoute`, `getItemRoute`, `getSystemCollectionRoute`: dùng `src/utils/get-item-route.ts` đã có từ 013 (đủ
  ba hàm chép từ `utils/get-route.ts`); không tạo file mới.
- Collection gần nhất: `useLocalStorage('backoffice-last-accessed-collection')`.

Tài liệu: `layout-patterns.md` §7 dòng "Module navigation" thêm "một cấp, trừ module Content: cây nhiều cấp (014 §9)"
(CHK055; sửa ở lượt 1 khi working tree mở khóa).

**Phương án bỏ**: cột điều hướng thứ hai (Q2 = A); cây trong vùng nội dung.

## R3. Preset và bookmark

**Quyết định**: chép `composables/use-preset.ts` nguyên logic (debounce 450 ms, `bookmarkSaved` so sâu, `temporary`
cho drawer, `resetPreset`, `saveCurrentAsBookmark`, subscribe store để đổi tên); mở rộng `stores/presets.ts` (012 chỉ
có hydrate + `getPresetForCollection`) bằng `bookmarks` (getter, thứ tự global → role → user → tên), `create`, `update`,
`delete`, `savePreset` (preset của user khác → tạo bản mới cho mình, như đã xác minh), `clearPreset`? (không dùng ở
Content, bỏ). `BookmarkAdd.vue` chép `bookmark-add.vue`: tên qua `system-input-translated-string` (D-73), icon
`select-icon`, màu `select-color` của 013.

`system-input-translated-string` (chép `interfaces/_system/system-input-translated-string/*`): ô nhập có nút mở
drawer chọn/tạo chuỗi dịch (`/translations`, store `translations` của 012 có hydrate; thêm `create`/`update` nếu
thiếu). T003 i: Directus có ba file (`index.ts`, `input-translated-string.vue`, `custom-translations-tooltip.vue`);
ô nhập kèm menu gợi ý khóa dịch (nạp khóa bằng `fetchAll('/translations')`, lọc theo chữ gõ), chọn khóa → `$t:<key>`,
tạo khóa mới mở `DrawerItem` (013) trên `directus_translations` với `primary-key="+"` và giá trị mặc định
(`key` = snakeCase của chữ gõ, `language` của user), lưu xong gọi store translations nạp lại. Không có drawer riêng.

**Phương án bỏ**: lưu preset ngay mỗi thay đổi (nhiều request hơn Directus); bỏ tên dịch `$t:` (khác Directus).

## R4. Layout: registry, wrapper và năm layout

**Quyết định**:

- `layouts/index.ts`: `import.meta.glob('./*/index.ts', { eager: true })`, `getLayout(id)` trả config hoặc
  `undefined` → `tabular`; không đăng ký component toàn cục (như R2 của 013). `LayoutConfig` kiểu riêng
  (`contracts/layouts.md`) chép từ `@directus/extensions` `defineLayout`.
- `use-layout.ts` chép `directus/packages/composables/src/use-layout.ts`: wrapper component nhận `LayoutProps`, chạy
  `setup(props, { emit })` của layout, phát `update:selection`, `update:layoutOptions`, `update:layoutQuery`, lộ
  `layoutState` qua slot mặc định và `state` qua `defineExpose` (màn collection gọi `layoutRef.state.refresh`,
  `download`).
- Màn collection vẽ `<component :is="layout.component" v-bind="layoutState">`, slot `actions`, `options`, `sidebar`
  qua `<component :is="layout.slots.x" v-bind="layoutState">` (thay `layout-actions-<id>` toàn cục).
- Mỗi `index.ts` chép setup Directus bỏ `useAiToolsStore` (D-70); `syncRefProperty`, `hideDragImage` chép từ utils.
- **tabular**: mở rộng `BoTable` (013, recipe "Table, simple") bằng prop tùy chọn: `fixedHeader`, `rowHeight`
  (29/43/58), `showManualSort` + `manualSortKey` (kéo bằng chuột qua vuedraggable + menu dòng Lên/Xuống, D-69),
  `headers` có `width`, `align`, `description`, `sortable`; slot `header-context-menu` (sắp tăng/giảm, căn lề, ẩn,
  chuyển trái/phải); kéo đổi thứ tự cột (vuedraggable trên `<th>`); kéo độ rộng (đã có); `allowHeaderReorder`.
  Footer: `BoPagination.vue` mới (recipe Q-2: tối đa 7 nút, `aria-current="page"`, nút trước/sau) + `BoSelect` kích
  thước trang (lọc theo `queryLimit.max`, `usePageSize`). Nút "+" thêm cột = `FieldList` (R6) trong Popover. Kéo đổi
  thứ tự cột chỉ nếu `v-table` Directus có `allowHeaderReorder` (T003 kiểm; không có thì bỏ, CHK037).
- **Drawer chọn item**: `BoDrawer` thêm slot `sidebar` tùy chọn (panel phải 240 px trong drawer, dưới `xl` thành mục
  gập ở đầu body) cho `LayoutSidebarDetail` + option layout như `drawer-collection.vue` (CHK060); preset tạm kế thừa
  `filter`/`search` đã lưu (CHK006).
- **cards**: lưới `grid` với `--size` → `grid-template-columns: repeat(auto-fill, minmax(<size*40>px, 1fr))` như
  Directus; `Card.vue` (checkbox chọn, ảnh `/assets/<id>?modified=&key=system-medium-cover|contain`, icon fallback,
  tiêu đề/phụ đề `RenderTemplate`), `CardsHeader.vue` (chọn tất cả, sắp xếp field + chiều, kích thước trang).
- **calendar**: `Calendar.vue` mount FullCalendar vào `div` (`createCalendar`/`destroyCalendar` từ setup như Directus);
  option, view, `eventChange` → `PATCH`; locale từ i18n (`get-fullcalendar-locale.ts` chép, import động);
  `dataset_too_large_currently_showing_n_items` khi `items.length >= limit`; bàn phím: FullCalendar có điều hướng
  toolbar bằng phím; đổi ngày sự kiện bằng form item (D-69, không thêm UI).
- **kanban**: `Kanban.vue` với vuedraggable nhóm `group: 'kanban'` giữa cột (chép `change` của Directus), cột kéo
  được, thẻ (ảnh, tiêu đề, text, ngày `format-date`, tag chip, avatar user), nút thêm nhóm (m2o), menu nhóm (đổi tên,
  xóa), cột "chưa nhóm"; menu thẻ "Chuyển sang nhóm…" (submenu nhóm), "Lên/Xuống" (D-69). `useFilterFields` nằm trong
  `kanban/index.ts` Directus: chép theo.
- **map**: `MapView.vue` chép `layouts/map/components/map.vue` trên `BoMapFrame` (013): control điều hướng, định vị,
  "vừa dữ liệu" (`ButtonControl`), chọn khung (`BoxSelectControl`) chép `utils/geometry/controls.ts`, geocoder Mapbox
  khi có `mapbox_key` (nạp động như 013), nguồn GeoJSON + layer từ `style.ts` (chép; màu `--theme--primary` → token
  qua `getComputedStyle` của `--color-brand-500`), popup template (`RenderTemplate`), `cameraOptions` ghi khi
  `moveend`; nền từ `app.basemap` (store `app` thêm `basemap` ref, mặc định `OpenStreetMap`); danh sách item đang
  hiện trong `MapActions`/sidebar để chọn bằng bàn phím (D-69). WebGL trong CI: như 013 (test tự bỏ qua).

**Phương án bỏ**: bảng ảo (Q4); đăng ký `layout-<id>` toàn cục; FullCalendar Vue wrapper `@fullcalendar/vue3`
(Directus mount thẳng core, giữ giống).

## R5. Nạp item và đếm (`useItems`, 10 triệu dòng)

**Quyết định**: `apps/web/src/composables/use-items.ts` của 013 là bản chép đủ của `@directus/composables`
(`filterSystem`, `alias`, `deep`, `changeManualSort`, `fetchAggregate` memo theo `(url, filter, search)`, generation,
abort, loading 150 ms, về trang 1); T003 g: diff với nguồn chỉ khác api → sdk và `isCancel` → `AbortError`, không thiếu phần nào. Không thêm cơ chế
riêng cho 10 triệu dòng (Q-B): "mượt" = không chặn và không request thừa (FR-022, FR-023); đo SC-003 ở R14. Hủy request
bằng `AbortController`: bản port đã truyền `signal` qua `onRequest` của sdk (T003 g).

## R6. Tìm kiếm và bộ lọc nâng cao (`system-filter`, D-73)

**Quyết định**: chép `interfaces/_system/system-filter/{index.ts,system-filter.vue,Nodes.vue,input-group.vue,
input-component.vue,utils.ts}` thành `interfaces/_system/system-filter/`; toán tử từ `getFilterOperatorsForType`,
`getOutputTypeForFunction` của `@directus/utils`; cây field từ `FieldList.vue` chép `components/v-field-list`
(đệ quy quan hệ tới độ sâu Directus, hàm `year()`, `month()`..., `$CURRENT_*`); nút `_and`/`_or`, kéo thứ tự điều
kiện bằng vuedraggable (+ menu "Lên/Xuống", D-69), ô giá trị theo kiểu dùng interface 013 (`input`, `datetime`,
`boolean`, `select-dropdown` với `choices`, `select-dropdown-m2o` cho quan hệ, như `input-component.vue`), biến động
qua menu (`$NOW(-7 days)` nhập tay như Directus). `SearchInput.vue` chép `search-input.vue` (mở rộng khi focus, số điều
kiện, Popover chứa `SystemFilter`). `FieldList` dùng lại cho nút "+" cột (R4) và chọn field export (R10).

**Phương án bỏ**: bộ lọc dạng text JSON (không như Directus); để 016 (thanh tìm kiếm không có bộ lọc).

## R7. Màn item

**Quyết định**:

- Chép `composables/use-item/index.ts` (api → sdk; `notify` → `useNotices` tại chỗ D-66: `BoNotice` dưới page header,
  tự ẩn như snackbar 5 s, `aria-live="polite"`; `unexpectedError` → `BoDialog` lỗi), `use-edits-guard.ts` +
  `use-navigation-guard.ts` (router `beforeEach` + `beforeunload`), `use-permissions/{index,collection,item,lib}`
  (`fetchItemPermissions` gọi `GET /permissions/me/:collection/:pk` như Directus (T003 h: API mới có `@Get(['me/:collection', 'me/:collection/:pk'])` ở `permissions.controller.ts`)), `use-nested-validation.ts`, `use-template-data` (013). `saveAsCopy`: query GraphQL
  `POST /graphql` (hoặc `/graphql/system`) như Directus (011 có cả hai app) với `json-to-graphql-query` (R1).
- `ItemRoute.vue` chép `item.vue` bỏ collab, AI, visual editing (`useVisualEditing` → `false`); `SaveOptions.vue`
  (menu Reka `DropdownMenu` cạnh nút lưu: split button, recipe Q-8); phím tắt `useShortcut` chép từ
  `@directus/composables` (hoặc `useMagicKeys` của vueuse với cùng tổ hợp) gắn vào phần tử form.
- Singleton: `CollectionOrItem.vue` chép; `actualPrimaryKey`/`internalPrimaryKey` như Directus.
- `isFormDisabled`, `isSavable`, `disabledOptions`, tiêu đề, `useHead` chép nguyên.

## R8. Version, so sánh, revision

**Quyết định**: chép `use-versions.ts` (global `draft` qua `DRAFT_VERSION_KEY` của `constants.ts`, `saveVersion`,
`addVersion`, `updateVersion`, `deleteVersion`), `use-fake-version-field.ts`, `version-menu.vue` (menu Reka
`DropdownMenu` trong breadcrumb, hộp tạo/đổi tên/xóa/chuyển bằng `BoDialog`), `version-promote-field.vue`,
`comparison/{comparison-modal,comparison-header,comparison-toggle}.vue`, `use-comparison.ts`, `types.ts`, utils chuẩn
hóa và diff (T003: `composables/use-comparison-diff.ts`, `utils/get-revision-fields.ts`,
`utils/reconstruct-comparison-html.ts`, `utils/should-show-comparison-diff.ts`, `utils/get-default-values-from-fields.ts`
(013 có)), `utils/field-utils.ts`,
`get-version-display-name.ts`; hộp so sánh dùng `BoForm` với `comparisonMode`/`comparisonSide` của 013 (gỡ D-55).
`use-revisions.ts`, `use-revision.ts`, `revisions-sidebar-detail.vue`, `revisions-date-group.vue`, `revision-item.vue`
chép; "Apply" phát `revert` → `edits` của form. Chế độ `collab` của modal bỏ (D-68).

## R9. Panel chi tiết: SidebarDetail và các mục

**Quyết định**: `SidebarDetail.vue` chép `sidebar-detail.vue` (accordion một mục mở: `useGroupable` thay bằng Reka
`Accordion` type single + store `sidebar.activeAccordionItem` nhớ mục mở, L-4 "sections as collapsible blocks");
`DetailPanel` của 012 nhận slot như cũ. Các mục chép: Layout (menu chọn layout + `layout.slots.options`), Archive
(`BoSelect` ba lựa chọn, đổi query), Refresh (`BoSelect` chu kỳ; `emitter` `tabIdle`/`tabActive` của `idle.ts` 012),
Export/Import (R10), Flows (`use-run-manual-flow` 013 mở rộng `selection`, `location: 'collection'`, FlowDialogs),
Revisions (R8), Comments (`comments-sidebar-detail`, `comment-input` với gợi ý `@`: `BoCombobox`-like popover trên
textarea, `/users` tìm kiếm; `comment-item`, `comment-item-header`; DOMPurify `ALLOWED_TAGS: []`), Shares
(`shares-sidebar-detail`, `share-item`; tạo/sửa bằng `DrawerItem` 013 trên `directus_shares` với
`fields` cho sẵn `collection`, `item` như Directus; gửi email: hộp thoại textarea → `POST /shares/invite`; chép link:
`navigator.clipboard` + notice D-66).

## R10. Export, import, hàng loạt, archive

**Quyết định**: `ExportSidebarDetail.vue` chép `export-sidebar-detail.vue`: nhập = `<input type="file" accept=".csv,.json">`
+ tải lên bằng `XMLHttpRequest` để có tiến độ (fetch không có upload progress) qua helper
`uploadWithProgress(path, formData, onProgress)` mới (T003: `BoUpload` 013 dùng fetch, tiến độ theo số file đã xong, không theo byte); `?background=true` khi chọn chạy nền; lỗi `FAILED_VALIDATION` → `ImportErrorDialog`. Xuất tải về =
`apiFetch('<endpoint>?export=<fmt>&...')` → `blob` → `saveAs(blob, '<collection>.<ext>')`; lưu thư viện = `POST
/utils/export/:collection`; chọn field bằng `FieldList` (R6), thư mục bằng `FolderPicker`? (Directus `folder-picker.vue`;
013 `DrawerFiles` có select thư mục: dùng lại `BoSelect` thư mục của 013). `onDownload` của layout = `saveAsCSV`
(R1). Hàng loạt: nút trong page header; `DrawerBatch` 013; `DELETE /items/:c` body mảng; archive `PATCH` `{keys,data}`.

## R11. Live preview (Q1 = A)

**Quyết định**: `LivePreview.vue` chép `live-preview.vue` bỏ visual editing (D-67): thanh công cụ (URL, nạp lại, kích
thước màn, zoom, mở cửa sổ, menu hiển thị), iframe `id`, `src`, `title`, `load` như Directus (không `sandbox`, T003 c), `window.refreshLivePreview`; `SplitPanel.vue` bọc `@directus/vue-split-panel` (R1) với
`PrivateViewResizeHandle` → `ResizeHandle` 012 làm tay cầm (mũi tên đổi 5 %, D-69); `PreviewRoute.vue` chép
`preview.vue` (`in-popup`, `postMessage('refresh')`); localStorage `backoffice-live-preview-*`; `useBreakpoints`
`sm` cho `isMobile`. Recipe Q-6 ghi `layout-patterns.md` §10.

## R12. Kiểm thử

**Quyết định** (`contracts/tests.md`):

1. Unit (happy-dom): composable chép, utils, store, guard route, `format-items-count`, `save-as-csv` (so byte với
   fixture CSV xuất từ Directus), bộ lọc (JSON phát ra), `use-preset` (debounce, trạng thái bookmark).
2. Browser (chromium): năm layout với `mockFixtureApi`, bảng 1000 × 10 (SC-011, `PERF=1`), kéo thả + đường bàn phím
   (D-69), menu version, hộp so sánh, bốn sidebar, hộp xuất/nhập, live preview (iframe `about:blank`), axe sáng/tối.
3. `mockFixtureApi` mở rộng: `/presets` CRUD (lưu trong bộ nhớ, trả `id` tăng), `/revisions` (+ `aggregate count`,
   `filter_count`), `/versions` (CRUD, `compare`, `save`, `promote`), `/comments` CRUD, `/shares` CRUD + `invite`,
   `/users` tìm kiếm, `/utils/sort`, `/utils/export`, `/utils/import` (multipart), `/items` `aggregate` theo
   `filterSystem`, `export=csv`, `/graphql` (`<c>_by_id`), `/permissions/me/:c/:pk`; snapshot thêm `presets.json`,
   `versions.json`, `shares.json`, `revisions.<c>.json`, `comments.<c>.json` (export mở rộng).
4. E2E `apps/web-e2e/src/content-*.spec.ts` theo story (US1–US7), chạy ở ba cấu hình; `allowed-paths.ts` thêm #50 trở
   đi; dữ liệu qua `Fixtures`/`AdminApi` có sẵn với `DATA_PREFIX`; seed `bo_*` chạy trước bộ E2E (bước CI
   `pnpm nx run web:fixtures -- --api http://127.0.0.1:8155`, idempotent).
5. Bộ so payload `apps/web-e2e/src/payload/*.spec.ts` (chỉ `E2E_CONFIG=proxy-api`): mỗi kịch bản có hai hàm
   (`directusApp(page)` trên `http://127.0.0.1:8155/admin` với helper chép từ
   `tests/directus-app-e2e/src/helpers/app.ts`, `backoffice(page)` trên proxy-api), `page.on('request')` ghi
   `{method, path, postData}` của request ghi, chuẩn hóa (`DATA_PREFIX`, id, thời gian, `time`/`id` block editor, thứ
   tự khóa) rồi `expect(bo).toEqual(dir)`. Kịch bản: tạo/sửa/bản sao/xóa/archive item `bo_std`, preset tự lưu +
   bookmark, bộ lọc 3 cấp, version tạo/save/promote, comment, share, sửa hàng loạt, xóa hàng loạt, export tải về
   (so file), import CSV, `/utils/sort`.
6. Benchmark `tests/benchmark/src/web-content.ts` (R14).
7. Parity: `fixtures-seed.test.ts` giữ, snapshot mới cùng chuẩn hóa.

**Phương án bỏ**: so dòng DB như 005 (bỏ sót dạng body); chạy payload ở cả ba cấu hình (gấp ba thời gian, body không
phụ thuộc cấu hình).

## R12b. Lưu ý từ phiên 013 (2026-10-15, khi bàn giao `apps/web`)

- `apps/web/vite.config.ts` `API_PATHS` chưa proxy `/items`, `/flows`, `/folders`, `/revisions` ở dev: lượt 1 thêm (cùng
  `/presets`, `/versions`, `/comments`, `/shares`, `/utils`, `/graphql`).
- Editor.js `render()` xong trong `requestIdleCallback`: browser test của màn item chờ block theo `data-id` và một idle
  callback như `mountEditor` của `InputBlockEditor.browser.test.ts`.
- Menu TinyMCE trong `BoDrawer` chưa kiểm (`shortcut:` trong `InputRichTextHtml.vue`): kiểm ở drawer item lồng của
  lượt 1, ghi kết quả.
- CI của 013 xanh ở run 38685401583 (commit 5751122); `check-package-names` cho `@directus/utils`, `@directus/types` chỉ
  trong `apps/web` (62b5fc4).

## R13. Chuỗi dịch

`apps/web/src/lang/translations/en-US.json` đã có `layouts`, `item_count`, `revisions`, `comments`, `shares`,
`unsaved_changes`, `save_and_stay`, `bookmark_doesnt_exist` (kiểm grep 2026-10-15). Khóa còn lại kiểm bằng test
"không có cảnh báo missing key" (E2E 012 đã chặn `vue-i18n` missing-key). Chuỗi mới chỉ cho D-69 ("Chuyển sang
nhóm…", "Chuyển trái/phải"): overlay `vi-VN` + `en-US` như D-60.

## R14. Hiệu năng và bundle

- Chunk lười: route item, route collection; layout `calendar` (FullCalendar ≈ 90 KB gzip [Unverified]), `map`
  (maplibre 013), `kanban`, `cards`; split panel + live preview; `system-filter`; hộp so sánh. `check-bundle.mjs`
  thêm ngân sách: chunk chính 013 + ≤ 60 KB.
- SC-011: `layouts/tabular/perf.browser.test.ts` 1000 × 10 (`PERF=1`; một lần đo sau một lần mount khởi động).
  Kết quả 2026-10-15: máy CI GitHub chậm hơn Mac dev khoảng 5 lần (cây collection 992 ms trên CI so với 170 ms
  trên local; bảng 7,3 s so với 1,8 s). Owner chọn (2026-10-15) hệ số máy: ngân sách giữ cho máy tham chiếu (Mac dev
  Apple M-series), `src/test-utils/perf.ts` `machineFactor()` đo một tải DOM + JS cố định (trung vị 5) chia cho
  `REFERENCE_MS` = 55 đo trên máy tham chiếu, ngân sách nhân hệ số (không dưới 1); áp cho bảng SC-011 và cây
  collection (T030). Bước `web perf` chạy Vue bản production (`PERF=1` đặt `process.env.NODE_ENV`), mount bằng
  `createApp` (không qua `@vue/test-utils`: hook theo tên component tốn khoảng một phần ba thời gian). Sau thay đổi:
  bảng 0,9–1,1 s, cây khoảng 100 ms trên máy tham chiếu.
- SC-003: `tests/benchmark/src/web-content.ts`: Playwright chromium mở app web (compose benchmark thêm hai service
  `backoffice-web` như profile `web` của parity: proxy tới Directus 8155 và API 8156 [Unverified: compose benchmark
  chưa có web; T0xx thêm]), đăng nhập, vào `/content/<bench_articles>` (collection 10 triệu dòng của `seed-items.ts`),
  đo `performance.mark` từ `goto` tới bảng có 25 dòng (`waitForSelector('tbody tr:nth-child(25)')`), đổi trang, sắp xếp
  theo `date_created` (có index) và theo `title` (không index), lọc `status`; 11 lần, lấy p95; ghi vào báo cáo
  benchmark như `items.ts`; ngưỡng SC-003 ở cả hai cấu hình; không chặn CI (job `benchmark-web` trong
  `benchmark.yml`, hằng tuần).

## R15. Bốn lượt (Q3) và điều kiện

| Lượt | Phase tasks | Nội dung | Cổng |
|------|-------------|----------|------|
| 1 | Setup, nền, US1, US2, US3 | thư viện R1 (kiểm [Unverified]), recipe nháp Q-1..Q-12, route + cây, preset + bookmark, `useLayout` + tabular, `SearchInput` + `system-filter`, màn item + `use-item` + guard, E2E US1–US3, allowed-paths | lint, typecheck, unit + browser, E2E hiện có + mới, build xanh; commit |
| 2 | US4 | cards, calendar, kanban, map, `DrawerCollection` theo layout (gỡ D-58), E2E US4 | như trên |
| 3 | US5 | SidebarDetail, Revisions + so sánh (gỡ D-55), Comments, Shares, Flows, menu version, live preview, share item route, E2E US5 | như trên |
| 4 | US6, US7, Polish | Export/Import, hàng loạt, Archive, Refresh, bộ so payload, benchmark web, axe, perf SC-011, manifest, recipe duyệt, spec D-xx/R-xx, memory | CI đủ job; benchmark hằng tuần chạy tay một lần |

Điều kiện bắt đầu lượt 1: phiên 013 báo CI xanh (commit cuối của 013). Trong lượt, `git pull --rebase` trước push;
không push khi CI của session khác đang chạy (bài học 013); nhắn session kia trước `env-up`/`env-down`. tasks.md ghi
mục "Điều kiện bắt đầu" như 013 (CHK096).

Kết quả T004 (2026-10-16): Directus app làm mới layout gửi lại request danh sách nhưng không gửi request đếm (memo
của `useItems`), số đếm hiện giá trị cũ → R-38 trong spec, app mới tái tạo. Script đo giữ ở scratchpad của phiên, các
bước: preset admin `refresh_interval: 10` trên `bo_std`, mở màn, `POST /items/bo_std`, chờ 12 s, đếm dòng và request.

Task kiểm sớm lượt 1 (T002/T003, kết quả ghi lại vào file này): gói R1 trên npm; diff `use-items.ts` với nguồn và sdk
`signal` (CHK093); `v-table` `allowHeaderReorder` (CHK037); `kanban.vue` xác nhận xóa nhóm (D-74, CHK011); thuộc tính
iframe `live-preview.vue` (CHK088); `runManualFlow` body (CHK019); hộp nhập "chạy nền" (CHK032); memo đếm sau làm mới
trên Directus app (R-38, CHK036). Lượt 4: `seed-items.ts` và compose benchmark cho web (CHK094); helper Directus app
cho payload, một task mỗi nhóm kịch bản (CHK095).
