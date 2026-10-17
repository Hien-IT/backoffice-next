# Research: Insights, Activity, Notifications (018)

Ngày 2026-10-17. Mỗi mục: quyết định, lý do, phương án bỏ. Directus tham chiếu 11.17.4 (`directus/app` 15.10.0,
`@directus/utils` 13.4.1). Hành vi Directus lấy từ bốn báo cáo đọc mã nguồn (hai khi viết spec, hai khi plan) và các
lần kiểm trực tiếp ghi ở bảng cuối; chưa chạy thử trên Directus thật. T002 (task đầu lượt 1) chạy tay sáu luồng trên
Directus app 8155 (tạo dashboard, thêm metric + bar chart rồi Save, đổi cỡ và kéo rồi Save, Copy To, nhập JSON, Archive
thông báo) và lưu body làm mốc (`payload/baselines/insights-*.json`) cùng tài liệu GraphQL gộp của `bo_dash_all` trước
khi viết bộ so payload và test store.

## R1. Thư viện và phiên bản

**Quyết định**: thêm một gói `apexcharts` 4.7.0 vào catalog `pnpm-workspace.yaml` (nhóm "same versions as
directus/pnpm-workspace.yaml 11.17.4") và `apps/web/package.json`. Kiểm 2026-10-17: `npm view apexcharts@4.7.0
license` = MIT; GitHub Advisory Database cho `apexcharts` chỉ có GHSA-w46j-8hm6-h8mm (XSS, < 3.24.0), không ảnh hưởng
4.7.0; bản mới nhất 8.3.1 không dùng vì Directus pin 4.7.0 (cùng options, cùng cách vẽ; CHK: `pnpm audit` ở CI). Gọi
trực tiếp `new ApexCharts(el, options)` như `panel-*.vue` của Directus (không `vue3-apexcharts`), nạp lười qua
`panels/shared/use-apex-chart.ts` (`import('apexcharts')` khi tile biểu đồ mount) để chunk `apexcharts` tách riêng.

Không thêm: `chroma-js` (`panels/pie-chart/color-generator.ts` dùng `chroma(base).get('lab')` và `chroma.lab()`; viết
lại bằng `color` 5.0.2 đã có từ 013: `Color(base).lab().array()` và `Color.lab(l, a, b).hex()`; màu chuỗi không thuộc
bộ so FR-105 và mặc định đã khác Directus theo D-108); `@directus/extensions` (`definePanel` là identity, chép inline
như `defineOperationApp` của 017); `@directus/system-data` (`isSystemCollection` ở `utils/get-item-route.ts`);
`object-hash` (Directus dùng `getSimpleHash` của `@directus/utils`, đã có); `escape-string-regexp` (nếu chưa có trong
`apps/web`, dùng `escapeRegExp` của `lodash-es`; kiểm T001).

Đã có và dùng lại: `@directus/utils` (`applyOptionsData`, `getSimpleHash`, `adjustDate`, `abbreviateNumber`,
`getFieldsFromTemplate`, `getEndpoint`), `json-to-graphql-query` (cho `query-to-gql-string`), `file-saver` (xuất),
`marked` + `dompurify` (`md()`), `nanoid`, `lodash-es`, `@vueuse/core`.

**Phương án bỏ**: `vue3-apexcharts` (TailAdmin dùng; Directus không, thêm lớp bọc không cần); `chart.js`/`echarts`
(khác cách nhóm và options với Directus, khó so dữ liệu); vẽ SVG tay (4 loại biểu đồ với trục datetime, tooltip, chú
giải là một thư viện tự viết); `apexcharts` 8.x (khác bản Directus, options đã đổi).

## R2. Route, module, màn không tìm thấy, xuất và nhập

**Quyết định**:

- `modules/insights.ts`: thay `placeholderRoutes('insights')` bằng `insights-overview` (`''`, `InsightsOverviewRoute`),
  `insights-dashboard` (`:primaryKey`, `props: true`, `DashboardRoute`, `beforeEnter` gọi
  `useInsightsStore().refresh(to.params.primaryKey)` không chờ như `index.ts:22-26` Directus) với con `panel-detail`
  (`:panelKey`, `props: true`, `meta.isFloatingView`, `PanelConfiguration`) vẽ qua `<RouterView name="detail"
  :dashboard-key :panel-key>` như `dashboard.vue:328`; `preRegisterCheck` giữ `canRead('directus_dashboards')` (012
  đã ánh xạ "admin hoặc partial/full"). Dashboard không có trong store → `InsightsNotFound` (port `not-found.vue`,
  dùng `ContentNotFound` với `module="insights"`; `ContentNotFound` thêm `'insights' | 'activity'` vào union).
- `modules/activity.ts`: `activity-collection` (`''`, `ActivityCollectionRoute`) với con `activity-item`
  (`:primaryKey`, `props: true`, `meta.isFloatingView`, `ActivityItemRoute`) vẽ qua `<RouterView name="detail">`;
  `hidden: true` giữ (không vào sidebar module); vào `/activity` từ link ở drawer thông báo, `checkForSystem` và URL.
- `get-item-route.ts` không đổi (đã có hai dòng); chỉ sửa comment "khung 012 tới 018".
- Xuất (FR-013): không `window.open` (Directus `overview.vue:131-169` mở URL mới; ở cấu hình khác origin cookie phiên
  không đi theo). Dùng cùng cách `ExportSidebarDetail.vue:384-409` của 014: `apiFetch('/dashboards?export=json&…')` →
  `blob` → `saveAs`. Request vẫn là `GET /dashboards?export=json&fields[]=…&filter=…` (#191) nên bộ so request so được;
  ghi là "Cần xác nhận" (không phải khác biệt hành vi với người dùng: cùng file JSON). Spec FR-013 sửa theo.
- Nhập (FR-014): port `basic-import-sidebar-detail.vue` thành `components/sidebar/BasicImportSidebarDetail.vue`
  (`collection` prop, `POST /utils/import/<collection>` multipart qua `apiFetch`, `notify` thành công, lỗi →
  `ImportErrorDialog` của 014 với `errors`); đặt ở panel chi tiết của `/insights` như Directus (`overview.vue:282`).

**Phương án bỏ**: named view `add` như `settings-add-new` 016 (Directus dùng `name="detail"` cho cả Insights và
Activity; giữ tên để so); nạp dashboard bằng `use-item` (Directus đọc từ store).

## R3. Workspace: resize, zoom, màu, note, bo góc (Q-34)

**Quyết định**: mở rộng `BoWorkspaceTile.vue` (017) bằng prop thêm, mặc định giữ hành vi flows:

- `resizable` (mặc định `false`; Directus mặc định `true` nhưng flows 017 truyền `false`; Insights truyền `true`),
  `minWidth = 8`, `minHeight = 6`, `color`, `note` (icon info với tooltip trong header), `borderRadius: [tl, tr, br,
  bl]` (mặc định `[true, true, true, true]`; khi kéo ép tất cả `true` như Directus), `showHeader` đã có.
- Resize: 8 tay cầm `<div>` (`resize-top`, `-right`, `-bottom`, `-left`, 4 góc) chỉ hiện ở chế độ sửa, `pointerdown.stop`
  bắt đầu `resize-*`; cùng vòng `pointermove` throttle 20 ms trên `window` của kéo; delta ô =
  `Math.round((pageX - startX) / gridSize)`; top: `h = startH - dy, y = startY + dy`; right: `w = startW + dx`; bottom:
  `h = startH + dy`; left: `w = startW - dx, x = startX + dx`; kẹp `x, y ≥ 1`, `w ≥ minWidth`, `h ≥ minHeight` đúng như
  `v-workspace-tile.vue:215-221` kể cả việc top/left vẫn dời `x`/`y` khi cỡ đã chạm tối thiểu (R-54, chép nguyên để
  dữ liệu ghi ra giống Directus); nhãn `W×H` khi resize (Directus hiện `width × height`), nhãn `(x:y)` khi kéo giữ.
- `update` emit mở rộng: `{ position_x?, position_y?, width?, height? }` (khóa chỉ có khi đổi), như
  `editedPosition` của Directus; flows 017 chỉ đọc `position_x/y` nên không đổi. Listener `pointerup` luôn gỡ (017 đã
  làm vậy; Directus chỉ gỡ sau sửa đổi khác rỗng — không chép quirk này vì không ảnh hưởng dữ liệu, ghi "Cần xác nhận").
- `data-width`, `data-height` thêm cạnh `data-pos-x/y` cho E2E.
- `BoWorkspace.vue`: thêm `zoomToFit` (mặc định `false`) và `resizable` (truyền xuống tile mặc định); `zoomScale =
  min((mainW - 2·pad) / wsW, (mainH - header - 2·pad) / wsH)` với `mainElement` là vùng nội dung của `PrivateView`
  (inject `main-element`, 012 có ref vùng nội dung; thêm `provide` nếu chưa có — kiểm T001), áp `transform: scale()`
  gốc trên trái, hộp ngoài = cỡ đã scale + padding (`v-workspace.vue:89-121`); cập nhật khi `ResizeObserver` của vùng
  nội dung đổi; slot mặc định `{tile, gridSize}` (017 chỉ có `{tile}`: thêm `gridSize`, tương thích); không vẽ tile
  mặc định (Insights tự vẽ `PanelTile`).
- Flows 017: không truyền prop mới → test 017 giữ xanh (kiểm bằng `pnpm exec vitest run src/components/workspace
  src/modules/settings/routes/flows`).

**Phương án bỏ**: component tile riêng cho Insights (chép hai lần kéo); thư viện grid (`vue-grid-layout`): tọa độ và
quy tắc kẹp khác Directus → lệch `position_x/y`, `width/height` (SC-002).

## R4. Store insights và truy vấn GraphQL gộp (FR-006, FR-041, FR-053..FR-056)

**Quyết định**: port `stores/insights.ts` nguyên (Pinia setup store `insightsStore`), chỉ đổi: `api.post` →
`apiFetch('/graphql', {method: 'POST', body})` và `/graphql/system`; `fetchAll` (đã có, cùng chữ ký
`fetchAll(path, {params}, limit)`); `unexpectedError` → `showUnexpectedError` (FR-081); `getPanel(type)` từ registry
`panels/index.ts`; `isSystemCollection` từ `get-item-route.ts`; `escapeStringRegexp` (R1). Giữ: `MAX_CACHE_SIZE 3`,
`lastLoaded`, `edits {create, update, delete}`, `hasEdits`, `saving`, `errors`, `loading`, `data`, `variables`,
`refreshIntervals`, `hydrate` (`fetchAll('/dashboards', {params: {fields: ['*'], sort: ['name']}})` và
`fetchAll('/panels', {params: {fields: ['*'], sort: ['dashboard']}})` song song, chỉ khi đọc được cả hai; lỗi → `[]`;
biến mặc định từ panel `variable: true`), `refresh(dashboard)` (nạp dữ liệu panel của dashboard, không nạp lại danh
sách), `stagePanelCreate/Update/Duplicate/Delete`, `saveChanges` (`POST /panels` mảng bỏ `id`, `PATCH /panels` mảng,
`DELETE /panels` mảng id — ba request song song chỉ khi mảng khác rỗng, không `fields`; rồi `hydrate`, bỏ dữ liệu panel
mới tạo, `loadPanelData` cho panel chưa có dữ liệu, `clearEdits`), `getVariable`, `setVariable` (regex
`{{\s*?<field>\s*?}}` trên `JSON.stringify(options)`; chỉ nạp lại khi đã có dữ liệu và JSON truy vấn đổi),
`hasEmptyRelation` (biến quan hệ rỗng → `data[id] = {}`), `loadPanelData` (alias `query_<getSimpleHash(panel.id +
collection + JSON.stringify(query))>`, panel nhiều truy vấn giữ `index/length` và gom mảng; tách hệ thống/không hệ
thống thành hai tài liệu gửi song song; lỗi từng phần qua `extensions.graphqlErrors[0].path[0]`; thrown 400 với
`data.errors` → bỏ panel lỗi và gọi lại, không bỏ được gì → hộp lỗi; `finally` gỡ `loading`).

`utils/query-to-gql-string.ts` chép nguyên (`jsonToGraphQLQuery`; bỏ tiền tố `directus_` cho hệ thống; alias
`<collection>_aggregated` + `groupBy` khi aggregate; `year(x)` → `x_func: {year}`; không `fields` → khóa chính từ store
fields). `utils/get-groups.ts` chép nguyên. Mốc test: tài liệu GraphQL mà Directus app gửi cho `bo_dash_all` (T002, ghi
`payload/baselines/insights-graphql.json`) so chuỗi sau chuẩn hóa alias (`query_<hash>` tính từ id panel nên khác id
giữa hai app → thay bằng `query_*` khi so; thứ tự trường giữ).

**Phương án bỏ**: nạp từng panel bằng REST `GET /items?aggregate` (Directus gộp GraphQL; số request và cache khác);
store tách staging (Directus để chung).

## R5. 11 panel: definition, component, biểu đồ, bảng sr-only (FR-040..FR-052, FR-105, FR-106, Q-35, Q-36)

**Quyết định**:

- Registry `panels/index.ts` tĩnh: 11 `PanelConfig` import tường minh sắp theo `id`; `getPanel(id)`; mỗi
  `panels/<id>/index.ts` chép từ Directus (bỏ `import PreviewSVG`, D-110; `definePanel` identity chép từ
  `@directus/extensions`); `panels/types.ts` chép kiểu `PanelConfig` (`id, name, icon, description, component,
  options, minWidth, minHeight, query?, variable?, skipUndefinedKeys?`). Component tra bằng `getPanel(type)?.component`
  thay `app.component('panel-<id>')` (XI: không extension).
- `Panel<Id>.vue` ×11 port từ `panel-<id>.vue`; biểu đồ (bar, line, pie, time-series) dựng options giống Directus (type,
  series, xaxis, plotOptions, dataLabels, legend, stroke, fill, sparkline khi nhỏ, `abbreviateNumber` trên trục > 10000,
  `n()` của vue-i18n), chỉ đổi: màu mặc định `cssVar('--color-brand-500')` (D-108) thay `var(--theme--primary)`; màu
  trục/lưới/chữ theo token (Q-35); font `Outfit`; `chart.foreColor`/`theme.mode` theo class `dark`; vẽ lại khi theme đổi
  (`watch` class `dark` qua `useDark` hoặc `MutationObserver` — kiểm 012 có composable theme).
- Quirk chép nguyên (R-53, "Cần xác nhận"): `<=` xử lý như `<` ở metric, metric-list, meter, bar-chart; `contains`…
  của bar-chart so ngược (`compareValue.includes(value)`); metric: luật khớp cuối thắng, meter: luật đầu; time-series
  `fillGaps` chỉ chèn tối đa 2 điểm mỗi khoảng trống; `now` lấy một lần (R-50); `datePrecision` của line-chart chỉ qua
  raw editor. Lý do: hành vi chuẩn là Directus (I); sửa thì màn hai app hiện khác nhau với cùng dữ liệu.
- `formatNumber` (`utils/format-number.ts`, Intl.NumberFormat với `notation`, `style`, `unit`, `currency`, fraction
  digits) chép nguyên; `useAutoFontFit` (`composables/use-auto-fit-text.ts`, ResizeObserver) chép nguyên cho label và
  metric; `use-display-items.ts` chép vào `panels/relational-variable/` (REST `GET /items/<collection>` với
  `fields` từ template + khóa, `filter {pk: {_in: ids}}`); `list` dùng `RenderTemplate` và `DrawerItem` (sửa tại chỗ:
  `PATCH <endpoint>/<pk>` rồi `insightsStore.refresh(dashboard)`) — spec FR-045 sửa theo; `variable` dùng
  `getInterface(inter)?.component` với `options`, nửa rộng khi `width < 20`; `relational-variable` dùng
  `DrawerCollection` (`active, collection, selection, filter, multiple`, `@input`).
- Bảng ẩn (FR-106, Clarifications): `panels/shared/ChartTable.vue` nhận `{columns, rows}` do mỗi panel biểu đồ tính từ
  cùng `series`/`categories` (bar: cột nhãn + giá trị; line/time-series: cột thời gian + một cột mỗi chuỗi; pie: nhãn +
  giá trị; meter: giá trị, max, phần trăm), render `<table class="sr-only">` với `<caption>` = tên panel; thẻ apexcharts
  `aria-hidden="true"`. E2E đọc bảng này (`helpers/insights.ts readChartTable`) để so với dữ liệu Directus app
  (Directus không có bảng: E2E dùng chéo đọc `w.ApexCharts`? Không — đọc qua `page.evaluate` các `series`/`categories`
  từ instance apexcharts của Directus bằng `ApexCharts.getChartByID`? Directus không đặt `chart.id`; thay vào đó so với
  mốc tính sẵn từ dữ liệu seed cố định (`bo_content` có ngày tạo cố định, FR-103) và so body GraphQL (SC-005); mốc ghi
  ở T002 từ response GraphQL của Directus app).
- CSS của `apexcharts` (tooltip, legend; thư viện tự chèn): ghi đè trong `src/styles/apexcharts.css` chỉ bằng biến theme
  (`var(--color-gray-*)`, `var(--font-outfit)`), có biến thể `.dark`; `check-raw-colors` quét file này; `toolbar.show`
  giữ như options của Directus (release-gate CHK043).
- Giá trị trong `ChartTable` là số sau biến đổi của panel, trước định dạng (bar `Number(toFixed)`, pie giá trị gốc không
  ×100, line/time-series giá trị chuỗi); E2E so với cùng biến đổi áp lên response GraphQL của Directus app, sai số 0 sau
  làm tròn `decimals` (CHK023).
- `panels/shared/conditional.ts`: hàm so sánh của metric/metric-list/meter/bar/pie chép nguyên từng biến thể (không
  gộp, vì quirk khác nhau giữa panel).

**Phương án bỏ**: sửa quirk (`<=`): lệch Directus; gộp hàm so sánh: đổi hành vi từng panel; `aria-label` tóm tắt
(owner chọn bảng).

## R6. Trang dashboard, drawer panel, Copy To (FR-020..FR-032, Q-34, Q-37)

**Quyết định**:

- `DashboardRoute.vue` port `dashboard.vue`: `PrivateView fill` tiêu đề/icon/màu dashboard; nút header: zoom
  (`fit_to_screen`, `BoButton` toggle), sửa (`edit`, khóa theo `useItemPermissions('directus_panels', pk).updateAllowed`),
  ở chế độ sửa: Clear Changes (`clear`, hộp xác nhận khi có sửa), "+" (`add`, `router.push` `panel-detail` `+`), Save
  (`check`, khóa khi `!hasEdits`, loading `saving`); `useShortcut('meta+s')`; vào sửa tắt zoom; `now = new Date()` một
  lần; `useEditsGuard(hasEdits, {ignorePrefix: '/insights/<pk>'})` với hộp `unsaved_changes` (D-76); tile
  `borderRadius` theo `pointOnLine` (chép `utils/point-on-line.ts` và thuật toán `dashboard.vue:57-131`); trạng thái
  tile như `dashboard.vue:283-323` (`BoProgressCircular` khi `loading` chưa có `data`; lỗi: icon `warning` +
  `unexpected_error` + chi tiết lỗi; `no_data` khi `isEmpty(data)`; `onErrorCaptured` quanh component panel thay
  `VErrorBoundary`); sidebar: `CommentsSidebarDetail collection="directus_dashboards"`, `RefreshSidebarDetail
  v-model="refreshInterval" @refresh="insightsStore.refresh(pk)"` với `refreshInterval` đọc/ghi
  `insightsStore.refreshIntervals[pk]`.
- `PanelTile.vue`: `BoWorkspaceTile` với `resizable`, `minWidth/minHeight` từ definition, `color`, `note`, `icon`
  (`panel.icon ?? definition.icon`), `showHeader`, `borderRadius`; sự kiện `update` → `stagePanelUpdate({id, edits})`,
  `edit` → `router.push` `panel-detail` id, `duplicate` → `stagePanelDuplicate(id)`, `delete` → `stagePanelDelete(id)`
  (không hộp, R-51), `move` → mở `CopyPanelDialog`.
- Copy To (FR-026, sửa spec): `CopyPanelDialog.vue` (`BoDialog`, `BoSelect` dashboard khác, notice
  `no_other_dashboards_copy` khi không có, nút Copy khóa) → `stagePanelDuplicate(copyPanelID, {dashboard: đích})`;
  là staging (ghi khi Save của dashboard hiện tại: `POST /panels` với `dashboard` đích), như `dashboard.vue:157-162`.
- `PanelConfiguration.vue` port `panel-configuration.vue`: `BoDrawer persistent` qua `useDialogRoute`; lưới loại:
  `BoFancySelect` thêm prop `layout: 'list' | 'grid'` (grid 2–3 cột, mục = icon lớn + tên + mô tả; D-110); đổi loại →
  `options = {}` + cỡ tối thiểu; `ExtensionOptions type="panel" :extension="definition"` (016/017 mở rộng: `type
  'panel'`, không chạm store field, `optionsKind` như operation) + raw editor; nhóm header: `BoToggle show_header`,
  `BoInput name`, `select-icon`, `select-color`, `BoInput note` (khóa khi tắt header); Done: panel mới `{id:
  '_<nanoid>', dashboard, type, options, name, icon, color, note, show_header, position_x: 1, position_y: 1, width:
  minWidth ?? 4, height: minHeight ?? 4}` → `stagePanelCreate`; có sẵn → `stagePanelUpdate`; Cancel → `router.push`
  dashboard; focus theo FR-029.
- `InsightsNavigation.vue`: sub-menu module (L-2) liệt kê `insightsStore.dashboards` (đã sắp theo tên) với icon màu,
  nút tạo khi rỗng (mở `DashboardDialog`).

**Phương án bỏ**: `VErrorBoundary` port (Vue 3 `onErrorCaptured` đủ); drawer panel là component con của trang (Directus
qua route con nổi; giữ để URL `/insights/:id/+` giống).

## R7. Overview, hộp dashboard (FR-010..FR-015, Q-2)

**Quyết định**: `InsightsOverviewRoute.vue` trên `BoTable` (`sortable`, `showResize`, `showSelect multiple`, cột icon
(màu) 42 px, `name` sắp xếp mặc định tăng, `note`), tìm client `name.toLowerCase().includes(search)` với
`SearchInput` không `showFilter` (`autofocus` khi > 25, ẩn khi 0 dashboard), header: Export (khóa khi
`!createAllowed`), Delete hàng loạt (`deleteAllowed`, `BoDialog` xác nhận, `DELETE /dashboards` mảng), "+"
(`createAllowed`); menu dòng `BoMenu`: Edit (`updateAllowed`), Duplicate (`POST /dashboards {…dashboard, panels:
[…bỏ id/date_created/user_created], name: '<name> (copy)'}` `fields=id`, loading theo dòng, `try/catch` → hộp lỗi, R-49),
Export, Delete (`deleteAllowed`); trạng thái rỗng `no_dashboards` + nút tạo, `no_results` + nút xóa tìm; panel chi
tiết: `BasicImportSidebarDetail collection="directus_dashboards" @refresh="hydrate"`; click dòng `router.push`,
Ctrl/Cmd/chuột giữa `window.open`. `DashboardDialog.vue` port `dashboard-dialog.vue`: `BoDialog`, `BoInput name`
(required, autofocus), `select-icon` (mặc định `dashboard`), `select-color`, `BoInput note`; Save → `POST /dashboards
{name, icon, color, note}` `fields=id` rồi `hydrate` rồi `router.push` dashboard mới; sửa → `PATCH /dashboards/<id>`
cùng body, `hydrate`, đóng.

## R8. Activity (FR-060..FR-065) và thông báo (FR-070..FR-082, Q-38, Q-39)

**Quyết định**:

- `ActivityCollectionRoute.vue` port `collection.vue`: `usePreset(ref('directus_activity'))` (014; preset mặc định
  `stores/presets.ts` đã port có `directus_activity`? kiểm T001, thiếu thì thêm như Directus `presets.ts:63-82`),
  `useLayout(layout)` + `createLayoutWrapper` với `showSelect="none"`, `filterSystem` = lọc của sub-menu, `search`,
  `filter` của `SearchInput` (`showFilter`, `collection="directus_activity"`); tiêu đề `activity_feed` icon
  `access_time`; panel chi tiết: `LayoutSidebarDetail` + `layout-options`/`layout-sidebar` slot như `CollectionRoute`
  (không Archive/Export/Flow); rỗng `no_results`/`no_items`. `ActivityNavigation.vue`: mục All Activity, My Activity
  (`{user: {_eq: currentUser.id}}`), vạch, 5 action (`{action: {_eq}}`); trạng thái mục active giữ trong `ref` của
  route (Directus: `navigation.vue` dùng `v-model:filter` của trang, không query URL — kiểm T001; nếu có query thì
  theo). `ActivityItemRoute.vue` port `item.vue`: `BoDrawer` qua `useDialogRoute`, `GET /activity/<pk>?fields=…`
  (#200), nhãn action `field_options.directus_activity.<action>` (khóa thô khi thiếu), `toLocaleString`, `UserPopover`,
  nút `launch` → `getItemRoute(collection, item)` (ẩn khi `isSystemCollection` hoặc `delete`), lỗi → `BoNotice danger`;
  đóng → `router.push('activity-collection')` (giữ query hiện tại của trang nếu có).
- Chuông: `layout/NotificationsBell.vue` trong `AppHeader.vue` trước `UserMenu` (D-107; mẫu TailAdmin
  `layout-patterns.md:91-94`: nút tròn `size-11 rounded-full border border-gray-200 bg-white dark:…` với badge số thay
  chấm, Q-38); `aria-label` = `notifications` + số; bấm → `appStore.notificationsDrawerOpen = true` (thêm vào
  `stores/app.ts`, gỡ ghi chú hoãn).
- `components/NotificationsDrawer.vue` port `notifications-drawer.vue`: `BoDrawer` `v-model` `notificationsDrawerOpen`
  gắn một lần trong `PrivateView.vue`; nạp chỉ khi mở (`watch(open, immediate)`), `GET /notifications` với
  `filter {_and: [{recipient: {_eq: '$CURRENT_USER'}}, {status: {_eq: tab}}]}` (Directus dùng `userStore.currentUser.id`
  hay `$CURRENT_USER`? kiểm T001 và chép đúng), `fields[]=id,subject,message,collection,item,timestamp`,
  `sort=-timestamp`, `limit=25`, `page`, `search` (#201); cột trái `BoTabs vertical` Inbox/Archive (Q-22) + link
  Activity; header: số dòng, `SearchInput`, nút Archive/Unarchive (`PATCH /notifications {keys, data: {status}}`
  #202) và Delete (`BoDialog` xác nhận, `DELETE /notifications` mảng #203) khi có chọn; sau ghi: nạp lại và
  `refreshUnreadCount`; `NotificationItem.vue`: `BoCheckbox`, subject với highlight tìm (`mark`), thời gian tương đối
  (`formatDistanceToNow`), nút `open_in_new` khi có đích (FR-072), nút mở rộng hiện `md(message)`; chọn tất cả với
  trạng thái lưng chừng; đổi tab bỏ chọn; rỗng `no_notifications`/`no_results`; phân trang `BoPagination`.
- Lỗi drawer (release-gate CHK003, R-57): Directus không bắt lỗi Archive/Unarchive và lỗi nạp, Delete chỉ `try/finally`;
  app thêm `catch` → `showUnexpectedError`, giữ trạng thái lựa chọn như nguồn. Drawer nạp chỉ khi mở, 10 dòng skeleton
  khi nạp (`notifications-drawer.vue:339-340`); không làm mới khi đang mở.
- Notice (FR-080, FR-081): `notify`/`showUnexpectedError` của `use-notices` dùng cho mọi màn 018; `utils/
  unexpected-error.ts` không đổi (Clarifications). Hộp lỗi hiện có của `NoticeStack` kiểm đã có nút Dismiss và
  `errors.<code>`; thiếu thì bổ sung (D-109: không "Report error").
- `GET /notifications` đếm (#26 của 012) giữ; `use-run-manual-flow` đã gọi `refreshUnreadCount` (FR-073).

**Phương án bỏ**: thăm dò định kỳ số chưa đọc (Directus không; R-52); drawer thông báo qua route (Directus dùng store
app); Activity nav qua query URL nếu Directus không làm.

## R9. Kiểm thử: E2E ba cấu hình, bộ so payload, bộ so DB, dùng chéo (FR-100..FR-104)

**Quyết định**:

- Bảy spec: `insights-overview`, `insights-dashboard`, `insights-edit` (core: thêm vào biểu thức core của
  `playwright.config.ts` để chạy firefox/webkit 1280 cùng origin), `insights-variables`, `insights-cross-use`
  (`DIRECTUS_APP_SPECS`), `activity`, `notifications`; `insights-parity-ui.spec.ts` (`DIRECTUS_APP_SPECS`); `a11y.spec.ts`
  thêm khối 018.
- Kéo/đổi cỡ trong Playwright: `helpers/insights.ts` dùng `settleFrames` (export sẵn) và chép mẫu `moveAndRelease`
  của `flows.ts` (không export; export nó ở 018 — sửa một dòng, 017 không đổi hành vi) với cả hai đầu trong khung nhìn;
  resize: `mouse.down` trên tay cầm `[data-resize="bottom-right"]`, `move` theo bước 8, `up`; đọc lưới từ
  `data-pos-x/y`, `data-width/height` của `[data-panel-id]`; Directus: biến CSS `--pos-x`, `--pos-y`, `--width`,
  `--height` của `.v-workspace-tile` (`readDirectusGrid` của 017 mở rộng đọc `--width/--height`).
- Dashboard tạm `web-e2e-<cfg>-<spec>-<n>`, xóa ở `afterAll` (`DELETE /dashboards` mảng; panel cascade); thông báo tạm
  tạo qua `POST /notifications` (admin) với subject `web-e2e-…`, xóa ở `afterAll`. Không E2E nào sửa `bo_dash_all`.
- Bộ so payload: `payload/insights.spec.ts` (tạo dashboard; thêm metric + bar chart Save; kéo + đổi cỡ Save; Duplicate
  + Delete Save; Copy To Save; sửa dashboard; nhân bản dashboard; xuất (request); nhập; xóa), `payload/activity.spec.ts`
  (`GET /activity` của 4 mục sub-menu + lọc nâng cao `collection`; `GET /activity/:pk`), `payload/notifications.spec.ts`
  (danh sách hai tab, tìm, archive, unarchive, xóa, đếm). `helpers/payload.ts`: `PATHS` thêm `dashboards`, `panels`,
  `notifications`, `activity`, `graphql`, `utils/import`; `normalizeInsightsBody` (bỏ `_<nanoid>`, thay id dashboard/panel
  → tên, sắp mảng `POST/PATCH /panels` theo `name`+`type`); tài liệu GraphQL so sau khi thay `query_<hex>` → `query_*`
  và chuẩn hóa khoảng trắng; `/graphql` và `/graphql/system` so riêng.
- Bộ so DB: `INSIGHTS_TABLES = ['directus_dashboards', 'directus_panels']`, `NOTIFICATIONS_TABLES =
  ['directus_notifications']` trong `db-rows.ts`; chuẩn hóa `id`, `date_created`, `user_created`, `timestamp`, `dashboard`
  → tên dashboard, `recipient`/`sender` → email.
- Dùng chéo (FR-102, SC-002): `helpers/directus-app.ts` thêm `openDirectusDashboard(id)`, `readDirectusGrid` (+width/
  height), `readDirectusTileHeaders`, `readDirectusMetricValues` (text của `.metric`, `.metric-list`, `.list`, label,
  meter `%`), `archiveDirectusNotification`; so vị trí/cỡ 0 ô lệch, chữ header, giá trị text; biểu đồ so qua body GraphQL
  và mốc dữ liệu (R5).
- Fixture `bo_insights` (FR-103): `seed.mjs` `createInsightsFixtures()` sau `createFlowsFixtures` (cần `bo_content`):
  `POST /dashboards` ×5 rồi `POST /panels` mảng (options cố định, vị trí trải trên lưới, time-series `range auto`,
  `bo_dash_all` 11 panel mỗi loại một), 3 `POST /notifications` cho admin (`recipient` = admin id; đích: item
  `bo_content` 1, collection `bo_content` không item, `item: '/settings/project'` không collection); cleanup theo tên
  `bo_dash_*` và subject `bo_notification_*`; `lib.mjs` thêm `DASHBOARDS`; `export.mjs` thêm `dashboards.json`,
  `panels.json`, `notifications.json`, `activity.json` (20 dòng đầu của admin, chỉ để mock); `fixtures-seed.test.ts`
  so snapshot bỏ `directus_activity` và `timestamp`.

**Phương án bỏ**: so pixel biểu đồ (font/anti-alias khác giữa hai app); đọc instance apexcharts của Directus (không có
`chart.id`).

## R10. i18n

**Quyết định**: 73 khóa `t('…')` của `dashboard.vue`, `notifications-drawer.vue`, `panel-configuration.vue`,
`overview.vue`, `activity/item.vue`, `activity/navigation.vue` đều có trong `en-US.json` (kiểm 2026-10-17; chỉ thiếu
`directus_dashboards` là khóa động của `t(collection)`, rơi về `collection_names` qua store collections như 014); tên
panel `panels.<barchart|label|linechart|list|meter|metric|metric_list|piechart|relational-variable|time_series|variable>.name`
và `.description` có; `field_options.directus_activity.{login,logout,create,update,delete}` có; `fit_to_screen` có
(dashboard dùng khóa này, không phải `zoom_to_fit`). Không khóa overlay mới. `vi-VN` thiếu khóa nào thì rơi về
`en-US` như 016 R10 (và như Directus). Kiểm 2026-10-17 (release-gate CHK055): `vi-VN.json` thiếu 19/73 khóa của 6 màn
(`activity_item`, `create_dashboard`, `delete_dashboard`, `delete_label`, `discard_changes_copy`, `duplicate_dashboard`,
`edit_dashboard`, `edit_panels`, `export_dashboard`, `insights`, `item`, `logout`, `no_dashboards`, `no_dashboards_copy`,
`origin`, `panel_header`, `panel_name_placeholder`, `search_dashboard`, và khóa động `directus_dashboards`) và 8/11 tên
panel (`panels.*` chỉ có `barchart`, `label`, `list`); `field_options.directus_activity` thiếu `logout`. Các chuỗi này
hiện tiếng Anh ở vi-VN như Directus; không dịch bổ sung (dịch thuộc file Directus đồng bộ bằng `web:sync-translations`).

## R11. Bốn lượt commit (FR-112)

| Lượt | Nội dung | Kiểm |
|------|----------|------|
| 1 | Phase 1 (kiểm T001, mốc Directus app T002, recipe nháp Q-34..Q-39, ngoại lệ a11y), `apexcharts` vào catalog, registry 11 panel + script trích + test so nguồn, utils port (`get-groups`, `query-to-gql-string`, `point-on-line`, `format-number`, `color-generator`, `use-auto-fit-text`), store insights + test, route, `InsightsOverviewRoute`, `DashboardDialog`, `BasicImportSidebarDetail`, `InsightsNavigation`, `DashboardRoute` chế độ xem + `PanelTile` + 11 `Panel*.vue` + `ChartTable`, `BoWorkspace` zoom, fixture `bo_insights`, `insights-overview.spec.ts`, `insights-dashboard.spec.ts` | US1, US2; test unit/browser; E2E ba cấu hình |
| 2 | `BoWorkspaceTile` resize/màu/note/bo góc, chế độ sửa (Save, Clear, guard, `meta+s`), `PanelConfiguration` + `BoFancySelect grid` + `ExtensionOptions type panel`, `CopyPanelDialog`, biến (`variable`, `relational-variable`, `setVariable`), `insights-edit.spec.ts`, `insights-variables.spec.ts` | US3, US4 |
| 3 | Activity (route, nav, drawer), chuông, `NotificationsDrawer` + `NotificationItem`, `stores/app` `notificationsDrawerOpen`, `activity.spec.ts`, `notifications.spec.ts`, fixture thông báo | US5, US6, US7 |
| 4 | Bộ so payload ×3, bộ so DB, `insights-cross-use`, `insights-parity-ui`, perf, bundle `BUDGET_018`, axe, ngoại lệ a11y trong `handoff-checklist.md`, docs (spec 012/013/014/015 trạng thái ở 018, `CLAUDE.md`, `SPECKIT-GUIDE.md`), duyệt D/R | US8; SC-002..SC-010 |

Mỗi lượt commit lên `main` với CI xanh; nhắn phiên 017 (và 016 nếu còn) trước và sau mỗi push; chỉ stage đường dẫn 018.

## R12. Hiệu năng và bundle

**Quyết định**: (FR-108 chỉ đo với API giả lập; thời gian thật ngoài phạm vi) perf `modules/insights/perf.browser.test.ts` (`PERF=1`, `machineFactor()`): `bo_dash_all` 11 tile có
dữ liệu (mock GraphQL trả ngay) < 1500 ms; `setVariable` → panel liên quan cập nhật < 500 ms sau response; drawer thông
báo 25 dòng < 300 ms; kéo/resize 20 tile không rớt khung (đo `generate borderRadius` + render < 16 ms mỗi move). Số
request: mở `/insights` = 0; mở dashboard = 1 `POST /graphql` (+1 `/graphql/system` khi có panel hệ thống), 0 request
dashboard/panel; Save = ≤ 3 request `/panels` + `GET /dashboards` + `GET /panels` (hydrate) + 1 `POST /graphql` cho
panel mới; mở drawer thông báo = 1 `GET /notifications`. Chunk lười: route Insights (store, workspace mở rộng, drawer
panel, registry definition) ≤ 60 KB gzip; 11 component panel ≤ 40 KB; `apexcharts` ≤ 170 KB (ước lượng dist min ~560
KB → gzip ~150 KB; đo ở T0xx và chốt); `NotificationsDrawer` ≤ 15 KB; `BUDGET_018 = BUDGET_017 + 15 KB` (chuông + store
app + wiring drawer); `LAZY_BUDGETS_018`.

## Kết quả kiểm (2026-10-17, đọc mã nguồn và lệnh kiểm, chưa chạy thử)

| Mục | Kết quả | Sửa ở |
|-----|---------|-------|
| `apexcharts` 4.7.0 | MIT (`npm view`); GitHub advisories: chỉ GHSA-w46j-8hm6-h8mm < 3.24.0; không có trong `pnpm-lock.yaml`; Directus catalog 4.7.0 | R1 |
| `chroma-js` | Directus catalog 3.1.2, chỉ dùng ở `color-generator.ts`; `color` 5.0.2 của web có `lab()` | R1 |
| `@directus/utils` 13.4.1 | export `applyOptionsData`, `getSimpleHash`, `adjustDate`, `abbreviateNumber` (`dist/shared/index.d.ts`) | R1, R4 |
| `json-to-graphql-query` | có trong `apps/web/package.json` và catalog | R4 |
| `isSystemCollection` | `utils/get-item-route.ts` (không cần `@directus/system-data`) | R4 |
| `fetchAll` | `utils/fetch-all.ts` `fetchAll(path, {params}, limit)` | R4 |
| `BoWorkspace` | props `tiles, editMode, gridSize`; slot `tile({tile})`; không emit; thiếu zoom | R3 |
| `BoWorkspaceTile` | props `id, x, y, width, height, name, icon, showHeader, draggable, editMode, showOptions, alwaysUpdatePosition, gridSize`; emit `update({position_x, position_y}), move, duplicate, delete, edit`; chỉ kéo; listener luôn gỡ | R3 |
| `RefreshSidebarDetail` | `v-model number \| null`, emit `refresh`, dùng `events.ts`/`idle.ts` (đã port `tabIdle`/`tabActive`) | R6 |
| `CommentsSidebarDetail` | props `collection`, `primaryKey` | R6 |
| `DrawerCollection`, `DrawerItem`, `RenderTemplate` | có (`components/drawers/`, `components/render/`) | R5 |
| `use-display-items` | chưa có → chép | R5 |
| `ExtensionOptions` | `type: 'interface' \| 'display' \| 'operation'` → thêm `'panel'` | R6 |
| `BoFancySelect` | `items, modelValue, disabled`; chỉ dạng cột → thêm `layout` | R6 |
| `ContentNotFound` | `module?: 'content' \| 'files' \| 'users' \| 'settings'` → thêm `'insights' \| 'activity'` | R2 |
| `createLayoutWrapper` | `layouts/use-layout.ts:18`, props `showSelect`, `filterSystem`, `search`, `filter`… | R8 |
| `SearchInput` | props `modelValue, showFilter, collection, filter, autofocus, placeholder` | R7, R8 |
| `ExportSidebarDetail` tải | `apiFetch` + `blob` + `saveAs` (`:384-409`), không `window.open` | R2 |
| `ImportErrorDialog` | props `errors: APIError[]`, `collection`, `defineModel<boolean>` | R2 |
| `use-notices` | `notify`, `showUnexpectedError` (dialog `errors.<code>`), `NOTICE_TIMEOUT 3000`, `NoticeStack` | R8 |
| `md()` | `utils/markdown.ts:27` (marked + DOMPurify) | R8 |
| `stores/notifications.ts` | `unread`, `hydrate`, `refreshUnreadCount` (#26), `setUnreadCount`; `hydrate.ts:39` | R8 |
| `stores/app.ts` | thiếu `notificationsDrawerOpen` (ghi chú hoãn :24-25) | R8 |
| `AppHeader.vue` | menu toggle + `UserMenu`; chuông chèn trước `UserMenu` | R8 |
| `use-run-manual-flow.ts:287` | gọi `refreshUnreadCount` | FR-073 |
| `getItemRoute` | `directus_dashboards → /insights`, `directus_activity → /activity`; không `directus_notifications` | R2 |
| `KNOWN_REQUESTS` / `ALLOWED_CALLS` | id cuối 182 (017 chưa thêm #183–#184); `ENDPOINTS` không có dashboards/panels/activity; `PATHS` của `payload.ts` không có dashboards/panels/notifications/activity | contracts #185–#203 |
| `check-bundle.mjs` | `BUDGET_017 = BUDGET_016 + 20 KB`; `LAZY_BUDGETS_017` ba chunk | R12 |
| `extract-directus-registry.mjs` | `OPERATION_IDS`, vòng trích :499-519 → thêm `PANEL_IDS` | R5 |
| `seed.mjs` / `export.mjs` / `lib.mjs` | `createFlowsFixtures` :1998, cleanup theo tên :46-131, map snapshot :325-361, `FLOWS` :22-29 | R9 |
| `playwright.config.ts` | core specs :18-19; `DIRECTUS_APP_SPECS` :24-25 | R9 |
| `flows.ts` helper | `moveAndRelease` không export, `settleFrames` export | R9 |
| `machineFactor()` | `test-utils/perf.ts:25` | R12 |
| i18n | 73 khóa có; `fit_to_screen`; `panels.<id>` với `_`; `field_options.directus_activity.*` | R10 |
| API | `dashboards`/`panels`/`notifications` controller: PATCH mảng hoặc `{keys, data}`, DELETE mảng hoặc `{keys}`; `respond.ts` export json; `utils.controller.ts` `import/:collection`; GraphQL `_aggregated` + `group` (`schema/read.ts`, `aggregate-query.ts`); `activity.controller.ts` chỉ đọc | không sửa `apps/api` |
| Directus store | `hydrate` = `fetchAll` với `sort`; alias `getSimpleHash`; `saveChanges` ba request song song không `fields`; Copy To = `stagePanelDuplicate` với `dashboard` | R4, R6, spec FR-026 |
| Directus `list` panel | `linkToItem` mở `DrawerItem`, `PATCH` rồi `refresh` | R5, spec FR-045 |
| Directus `refresh-sidebar-detail` | `tabIdle`/`tabActive` của `idle.ts` (5 phút), không `useIdle` | R6 |
| Directus v-workspace | tile không có `zoomToFit`; workspace `zoomScale` với `main-element` inject; `update` `{edits, id}` | R3 |
| Directus quirk | `<=` như `<`; bar-chart `contains` ngược; resize top/left trôi ở cỡ tối thiểu; listener chỉ gỡ khi có sửa | R5 (R-53, R-54) |
| Release-gate (2026-10-17, đọc mã) | Save lỗi một phần: không hydrate, staging giữ, vẫn thoát sửa (R-56); drawer thông báo không bắt lỗi (R-57); hộp dashboard `persistent`, lỗi giữ hộp; xóa hàng loạt lỗi đóng hộp giữ lựa chọn; `panel-detail` không guard, `meta+s` ngoài chế độ sửa; null theo từng panel; locale số = ngôn ngữ user; time-series múi giờ trình duyệt, chỉ `timestamp` trừ offset; `md()` `marked` + DOMPurify `ADD_ATTR target`; label chữ thuần; tên file xuất từ `Content-Disposition`; note tile là `<span>` chỉ rê chuột; `VBadge` không `aria-live`; skeleton 10 dòng ở drawer; zoom padding 0.6875/1.375rem, header 3.375rem; idle 5 phút | spec FR-011..FR-106, Edge Cases, R-56, R-57 |
| Parity GraphQL 011 | `_aggregated` + `groupBy` hàm ngày (`tests/parity/src/graphql/e2e-app.test.ts:59`), `*_func` trong filter (`read.test.ts:81-118`); `/graphql/system` aggregate chưa có → bộ so payload `bo_dash_system` (T110) phủ | tasks T110 |
| Chuông Directus | `VBadge :value="unread" :disabled="unread == 0"` chỉ ẩn badge; nút luôn bấm được | spec US6-1 |
| `tusResumableUploadsChanged` | chỉ phát, không nghe | spec FR-076 |

## Kết quả T001 (2026-10-17, đọc code)

- (a) `escape-string-regexp` không có trong `apps/web`: store dùng `escapeRegExp` của `lodash-es` (cùng kết quả cho tên
  field). `color` 5.0.2 có; `apexcharts` thêm ở T006.
- (b) `PrivateView.vue` không `provide('main-element')`; trang `fill` cuộn trong `div.overflow-auto` (`:127`).
  `BoWorkspace` đo phần tử cha cuộn của chính nó bằng `ResizeObserver` (không thêm `provide`).
- (c) Preset mặc định `directus_activity` đã có trong `src/stores/presets.ts:69` (014): T081 không cần thêm.
- (d) Directus lọc `recipient: { _eq: userStore.currentUser.id }` (`notifications-drawer.vue:79-80`), không
  `$CURRENT_USER`: app gửi id người dùng (#201).
- (e) Mục active của sub-menu Activity là `v-model:filter` (`roleFilter` cục bộ của trang, `collection.vue:48`), không
  query URL: app giữ `ref` cục bộ, mất khi rời trang (như Directus).
- (f) Theme tối: class `dark` trên `html` do `use-app-head.ts:54` đặt; biểu đồ theo dõi bằng `useMutationObserver`
  (`@vueuse/core`) trên `document.documentElement` `class`.
- (g) `NoticeStack` hộp lỗi đã có tiêu đề, `[code] message`, nút Dismiss, không "Report error" (D-109): T100 không đổi
  code, chỉ kiểm lời gọi.
- (h) bỏ (bộ mẫu dùng `bo_insights_data`).
- (i) `md()` của 013 (`utils/markdown.ts`) khác Directus: link khác origin mở `_blank` + `rel`, link cùng origin không đặt
  `target` (Directus đặt `_self` cho mọi link). Khác biệt này đã duyệt ở 013 (an toàn hơn), dùng nguyên cho thông báo.
- (j) Port `apply-options-data.test.ts` làm ở T012 (`src/utils/apply-options-data.test.ts`).
