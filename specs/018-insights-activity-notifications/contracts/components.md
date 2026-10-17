# Contract: component, composable, registry và dữ liệu mới của 018

Mọi component `<script setup lang="ts">`, Reka UI, `modelValue`/`update:modelValue`, theo `component-specs.md`; file
chép có header `// Ported from directus/app/src/...` và manifest `tools/port-manifest/018-T###.json`. Đường dẫn Directus
tính từ `directus/app/src/` trừ khi ghi khác.

## 1. Module, route, overview, hộp dashboard, nhập

| Component / composable | Nguồn Directus | Props / API | Emit | Ghi chú |
|------------------------|----------------|-------------|------|---------|
| `modules/insights.ts` | `modules/insights/index.ts` | data-model §1 | | `beforeEnter` gọi `refresh(pk)` |
| `modules/activity.ts` | `modules/activity/index.ts` | data-model §1 | | `hidden` |
| `modules/insights/routes/InsightsOverviewRoute.vue` | `routes/overview.vue` | — | | `BoTable` 3 cột + chọn nhiều, `SearchInput`, `BoMenu` dòng, `BoDialog` xóa, `DashboardDialog`, `RouterView`? không; `PrivateView fill`; sidebar `BasicImportSidebarDetail` |
| `modules/insights/routes/InsightsNotFound.vue` | `routes/not-found.vue` | — | | `ContentNotFound module="insights"` |
| `modules/insights/components/InsightsNavigation.vue` | `components/navigation.vue` | — | | sub-menu L-2; nút tạo khi rỗng |
| `modules/insights/components/DashboardDialog.vue` | `components/dashboard-dialog.vue` | `modelValue: boolean`, `dashboard?: Dashboard` | `update:modelValue`, `done(id)` | `BoDialog`; `select-icon`, `select-color` |
| `components/sidebar/BasicImportSidebarDetail.vue` | `views/private/components/basic-import-sidebar-detail.vue` | `collection: string` | `refresh` | `SidebarDetail id="import" icon="publish"`; `ImportErrorDialog` (014) |
| `modules/content/routes/ContentNotFound.vue` (mở rộng) | — | `module?: … \| 'insights' \| 'activity'` | | |

## 2. Trang dashboard, workspace, panel, drawer panel

| Component / composable | Nguồn Directus | Props / API | Emit | Ghi chú |
|------------------------|----------------|-------------|------|---------|
| `modules/insights/routes/DashboardRoute.vue` | `routes/dashboard.vue` | `primaryKey` | | `PrivateView fill`; nút zoom/sửa/Clear/+/Save; `BoWorkspace`; `RouterView name="detail" :dashboard-key :panel-key`; `CopyPanelDialog`; hộp Clear và `unsaved_changes`; sidebar Comments + Refresh |
| `modules/insights/components/PanelTile.vue` | `dashboard.vue` (template tile) | `panel`, `definition?`, `editMode`, `borderRadius`, `loading`, `error`, `data`, `now`, `dashboard` | `update(edits)`, `edit`, `duplicate`, `delete`, `move` | `BoWorkspaceTile` + trạng thái + `onErrorCaptured` + `<component :is="definition.component">` |
| `modules/insights/components/CopyPanelDialog.vue` | `dashboard.vue:330-355` | `modelValue: string \| null` (panel id), `dashboards` (trừ hiện tại) | `confirm(dashboardId)`, `cancel` | notice `no_other_dashboards_copy` |
| `modules/insights/routes/PanelConfiguration.vue` | `routes/panel-configuration.vue` | `dashboardKey`, `panelKey` | | `BoDrawer persistent` + `useDialogRoute`; `BoFancySelect layout="grid"` 11 loại (D-110); `ExtensionOptions type="panel"`; nhóm header |
| `components/workspace/BoWorkspace.vue` (mở rộng) | `components/v-workspace.vue` | + `zoomToFit = false`, `resizable = false`; slot `{tile, gridSize}` | | `transform: scale()`; inject `main-element` |
| `components/workspace/BoWorkspaceTile.vue` (mở rộng) | `components/v-workspace-tile.vue` | + `resizable = false`, `minWidth = 8`, `minHeight = 6`, `color`, `note`, `borderRadius` | `update({position_x?, position_y?, width?, height?})` | 8 tay cầm `data-resize`; nhãn `W×H`; `data-width/height`; `role="region"` + `aria-label`; icon note là nút `aria-label` = note + `BoTooltip` khi focus; flows không đổi |
| `components/BoFancySelect.vue` (mở rộng) | — | + `layout: 'list' \| 'grid' = 'list'` | | grid 2–3 cột, mục icon lớn + tên + mô tả |
| `…/ExtensionOptions.vue` (mở rộng) | — | `type` + `'panel'` | | không chạm store field (như `operation`) |
| `utils/point-on-line.ts` | `utils/point-on-line.ts` | `pointOnLine(p, a, b)` | | + test |

## 3. Registry panel (`apps/web/src/panels/`)

| File | Nguồn | Export | Ghi chú |
|------|-------|--------|---------|
| `index.ts` | `panels/index.ts` (glob → tĩnh) | `panels: PanelConfig[]`, `getPanel(id)` | sắp theo `id`; không extension; `definePanel` identity inline |
| `types.ts` | `@directus/extensions` `PanelConfig` | kiểu | chép |
| `<id>/index.ts` ×11 | `panels/<id>/index.ts` | `default: PanelConfig` | bỏ `preview` (D-110); `component` import `./Panel<Id>.vue` |
| `<id>/Panel<Id>.vue` ×11 | `panels/<id>/panel-<id>.vue` | props như Directus (`showHeader`, `height`, `width`, `now`, `data`, `gridSize`, `id`, `dashboard` + options) | màu mặc định `cssVar('--color-brand-500')` (D-108); biểu đồ: `use-apex-chart` + `ChartTable` |
| `shared/use-apex-chart.ts` | — | `useApexChart(el, options)` → `{render, update, destroy}` | `import('apexcharts')` lười; vẽ lại khi theme đổi |
| `shared/ChartTable.vue` | — | `caption`, `columns: string[]`, `rows: (string \| number \| null)[][]` | `<table class="sr-only">` (FR-106); `<caption>` = nhãn tile; giá trị số sau biến đổi của panel trước định dạng (FR-105); `data-chart-table` cho E2E |
| `src/styles/apexcharts.css` | — | — | ghi đè CSS tooltip/legend của `apexcharts` chỉ bằng biến theme, biến thể `.dark`; quét bởi `check-raw-colors` |
| `shared/color-generator.ts` | `panels/pie-chart/color-generator.ts` | `monoThemeGenerator(base, length)` | trên `color` 5.0.2 (R1) |
| `shared/conditional.ts` | từng `panel-*.vue` | hàm so sánh theo panel | quirk chép nguyên (R-53) |
| `relational-variable/use-display-items.ts` | `panels/relational-variable/use-display-items.ts` | `useDisplayItems(collection, template, ids)` | #198 |
| `utils/get-groups.ts`, `utils/query-to-gql-string.ts`, `utils/format-number.ts`, `composables/use-auto-fit-text.ts` | cùng tên | như Directus | + test |
| `registry.test.ts` | — | | so `fixtures/interfaces/directus-registry.json` `panels` (script trích mở rộng `PANEL_IDS`) |
| `scripts/extract-directus-registry.mjs` (+) | — | | trích `panels` (id, icon, name, description, minWidth, minHeight, variable, skipUndefinedKeys, options tĩnh hoặc với bộ đối số mẫu, `query` với 3 bộ options mẫu) |

## 4. Store

| File | Nguồn | API | Ghi chú |
|------|-------|-----|---------|
| `stores/insights.ts` | `stores/insights.ts` | data-model §2 | `apiFetch` cho GraphQL; `fetchAll`; `hydrate.ts` thêm |
| `stores/app.ts` (mở rộng) | `stores/app.ts` | + `notificationsDrawerOpen: boolean` | |

## 5. Activity

| Component | Nguồn | Props | Emit | Ghi chú |
|-----------|-------|-------|------|---------|
| `modules/activity/routes/ActivityCollectionRoute.vue` | `modules/activity/routes/collection.vue` | — | | `usePreset('directus_activity')`, `createLayoutWrapper` `showSelect="none"`, `SearchInput showFilter`, `LayoutSidebarDetail`; `RouterView name="detail"` |
| `modules/activity/components/ActivityNavigation.vue` | `modules/activity/components/navigation.vue` | `filter: Filter \| null` | `update:filter` | sub-menu L-2, `aria-current` |
| `modules/activity/routes/ActivityItemRoute.vue` | `modules/activity/routes/item.vue` | `primaryKey` | | `BoDrawer` + `useDialogRoute`; `UserPopover`; nút `launch` |

## 6. Thông báo

| Component | Nguồn | Props | Emit | Ghi chú |
|-----------|-------|-------|------|---------|
| `layout/NotificationsBell.vue` | `views/private/components/module-bar-avatar.vue:56-65` | — | | nút header TailAdmin + badge số (Q-38, ẩn khi 0, nút luôn bấm được); `aria-label`; vùng `aria-live="polite"` sr-only khi số đổi; mở drawer qua store app |
| `components/NotificationsDrawer.vue` | `views/private/components/notifications-drawer.vue` | — (`v-model` từ store app) | | `BoDrawer`; tab Inbox/Archive; `SearchInput`; Archive/Unarchive/Delete; skeleton 10 dòng; hộp lỗi cho lỗi nạp/Archive/Delete (R-57); `BoPagination`; link Activity |
| `components/NotificationItem.vue` | `views/private/components/notification-item.vue` | `notification`, `selected`, `search` | `update:selected`, `open` | `BoCheckbox`; `mark` highlight; `md(message)`; nút `open_in_new` |
| `layout/AppHeader.vue`, `layout/PrivateView.vue` (mở rộng) | — | | | chèn chuông; gắn drawer một lần |

## 7. Bundle, port manifest

- `scripts/check-bundle.mjs`: `BUDGET_018 = BUDGET_017 + 15 * 1024`; `LAZY_BUDGETS_018` = route Insights 60 KB, panel
  components 40 KB, apexcharts 170 KB (chốt sau đo), NotificationsDrawer 15 KB.
- `pnpm-workspace.yaml` catalog `apexcharts: 4.7.0`; `apps/web/package.json` `"apexcharts": "catalog:"`.
- `tools/port-manifest/018-T###.json`: `stores/insights.ts`, `utils/{get-groups,query-to-gql-string,point-on-line,
  format-number}.ts`, `composables/use-auto-fit-text.ts`, `panels/**` (11 `index.ts`, 11 `.vue`, `color-generator`,
  `use-display-items`), `modules/insights/**`, `modules/activity/**`, `notifications-drawer.vue`,
  `notification-item.vue`, `basic-import-sidebar-detail.vue`, `v-workspace*.vue` (phần resize/zoom).

## 8. E2E helpers (`apps/web-e2e/src/helpers`)

| Helper | Làm gì |
|--------|--------|
| `allowed-paths.ts` | + #185–#203 |
| `insights.ts` | `openDashboard(page, name)`, `readGrid(page)` → `{id, type, x, y, w, h}[]` từ `data-*` của `[data-panel-id]`, `dragTile(page, type, {dx, dy})`, `resizeTile(page, type, handle, {dx, dy})` (dùng `moveAndRelease` export từ `flows.ts` + `settleFrames`), `readChartTable(page, type)` → `{columns, rows}` từ `[data-chart-table]`, `readTileText(page, type)`, `setVariable(page, field, value)` |
| `db-rows.ts` | `INSIGHTS_TABLES = ['directus_dashboards', 'directus_panels']`, `NOTIFICATIONS_TABLES = ['directus_notifications']`; chuẩn hóa `id`, `date_created`, `user_created`, `timestamp`, `dashboard` → name, `recipient`/`sender` → email |
| `directus-app.ts` (+) | `openDirectusDashboard(page, id)`, `readDirectusGrid` (+ `--width`, `--height`), `readDirectusTileHeaders`, `readDirectusTileText(type)`, `openDirectusNotifications`, `archiveDirectusNotification(subject)` |
| `payload.ts` (+) | `PATHS` + dashboards/panels/notifications/activity/graphql/utils-import; `normalizeInsightsBody` (id tạm, id → tên, sắp mảng panels); `normalizeGraphql` (`query_[0-9a-f]+` → `query_*`, gộp khoảng trắng) |
| `notifications` (trong `insights.ts` hoặc `fixtures.ts`) | `createTempNotifications(fixtures, user, 3)` tạo 3 thông báo cho user tạm (ba dạng đích), xóa ở `afterAll` |
| `fixtures.ts` (+) | `DASHBOARDS = { all: 'bo_dash_all', vars: 'bo_dash_vars', system: 'bo_dash_system', empty: 'bo_dash_empty', unknown: 'bo_dash_unknown' }`, `NOTIFICATIONS` |
| `flows.ts` | export `moveAndRelease` (một dòng; hành vi 017 không đổi) |
