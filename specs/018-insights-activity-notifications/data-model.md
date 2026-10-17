# Data model: Insights, Activity, Notifications (018)

Kiểu lấy từ `@directus/types` 15.0.3 (`Dashboard`, `Panel`, `Notification`, `Activity`, `Filter`) hoặc chép từ
`directus/app/src/types/insights.ts` và `stores/insights.ts` (`CreatePanel`, `UpdatePanel`, `PanelQuery`). Không có DB
mới; mọi thứ là trạng thái trình duyệt dựng từ API và ghi qua API 010/011.

## 1. Route (FR-001, FR-002)

| Tên | Path (dưới `/admin`) | Component | Props / guard | Ghi chú |
|-----|----------------------|-----------|---------------|---------|
| `insights-overview` | `/insights` | `InsightsOverviewRoute` | | thay khung (D-40) |
| `insights-dashboard` | `/insights/:primaryKey` | `DashboardRoute` | `primaryKey`; `beforeEnter`: `insightsStore.refresh(pk)` không chờ; thiếu trong store → `InsightsNotFound` trong trang | `RouterView name="detail"` vẽ con |
| `panel-detail` | `/insights/:primaryKey/:panelKey` | `PanelConfiguration` | `primaryKey`, `panelKey` (`+` = mới, id thật hoặc `_…`); `meta.isFloatingView` | `useDialogRoute` |
| `activity-collection` | `/activity` | `ActivityCollectionRoute` | | thay khung; module `hidden` |
| `activity-item` | `/activity/:primaryKey` | `ActivityItemRoute` | `primaryKey`; `meta.isFloatingView` | `RouterView name="detail"` |

`preRegisterCheck` Insights: `canRead('directus_dashboards')` (012). `get-item-route.ts` không đổi.
`/content/directus_dashboards(/:pk)` → `/insights(/:pk)`, `/content/directus_activity(/:pk)` → `/activity(/:pk)`.

## 2. Store insights (`stores/insights.ts`, FR-006, FR-041, FR-053..FR-056)

| Thành viên | Kiểu | Ghi chú |
|------------|------|---------|
| `dashboards` | `Dashboard[]` | `fetchAll('/dashboards', {params: {fields: ['*'], sort: ['name']}})` |
| `panels` | computed `Panel[]` | `panelsWithEdits`: raw + `edits.create` − `edits.delete`, gộp `edits.update` |
| `loading` | `string[]` | id panel đang nạp |
| `errors` | `Record<string, Error>` | lỗi từng panel |
| `data` | `Record<string, unknown>` | kết quả theo id panel (mảng khi nhiều truy vấn) |
| `edits` | `{create: CreatePanel[], update: UpdatePanel[], delete: string[]}` | staging |
| `hasEdits` | computed | ba mảng khác rỗng |
| `saving` | boolean | |
| `variables` | `Record<string, unknown>` | khóa `field` của panel biến, dùng chung mọi dashboard (R-55); mặc định từ `defaultValue` khi hydrate |
| `refreshIntervals` | `Record<string, number \| null>` | object thường, theo dashboard |
| `lastLoaded` | `string[]` | tối đa 3; vượt thì bỏ dữ liệu panel của dashboard cũ nhất |

Hàm: `hydrate()` (chỉ khi đọc được `directus_dashboards` và `directus_panels`; lỗi → `[]`), `dehydrate()`,
`clearCache()`, `clearEdits()`, `getDashboard(id)`, `getPanelsForDashboard(id)`, `refresh(dashboard)`,
`stagePanelCreate(panel)`, `stagePanelUpdate({id, edits})` (id `_…` → vào `create`; nạp lại nếu JSON truy vấn đổi; đổi
`collection` của biến quan hệ → xóa biến), `stagePanelDuplicate(id, overrides?)` (clone, `id: _<nanoid>`, `+2/+2`,
4×4 nếu thiếu cỡ, `assign(overrides)`; Copy To = `overrides {dashboard}`), `stagePanelDelete(id)`, `saveChanges()`,
`getVariable(field)`, `setVariable(field, value)`.

`saveChanges` (song song, chỉ khi mảng khác rỗng, không `fields`): `POST /panels` `[…create bỏ id]`, `PATCH /panels`
`[…update]`, `DELETE /panels` `[…id]`; rồi `hydrate()`, bỏ `data` của panel mới, `loadPanelData(panel chưa có data)`,
`clearEdits()`. Lỗi (bất kỳ request nào): hộp lỗi, không `hydrate`, không `clearEdits`; trang vẫn về chế độ xem
(`dashboard.vue:168-171`); request đã thành công không hoàn lại, Save lại gửi lại toàn bộ staging (R-56).
`stagePanelUpdate` của app bỏ qua id không có trong store ("Cần xác nhận", Directus có thể ném lỗi).

## 3. Dashboard và Panel (bảng `directus_dashboards`, `directus_panels`)

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| Dashboard `id` | uuid | |
| `name` | string | bắt buộc ở hộp |
| `icon` | string | mặc định `dashboard` |
| `color` | string \| null | inline style |
| `note` | string \| null | |
| `date_created`, `user_created` | | bỏ khi so |
| `panels` | `Panel[]` | o2m; chỉ trong body nhân bản và xuất |
| Panel `id` | uuid | id tạm client `_<nanoid>` |
| `dashboard` | uuid | Copy To đổi sang đích |
| `name`, `icon`, `color`, `note` | string \| null | header; `icon` rơi về icon của loại |
| `show_header` | boolean | mặc định `true` ở drawer |
| `type` | string | 11 id có sẵn hoặc lạ |
| `position_x`, `position_y` | integer | ô 1-based; mới `(1, 1)`; nhân bản `+2/+2` |
| `width`, `height` | integer | ô; mới = `minWidth/minHeight` của loại hoặc 4×4; resize kẹp ≥ min |
| `options` | JSON theo loại (§4) | `applyOptionsData(options, variables, skipUndefinedKeys)` trước khi truy vấn |
| `date_created`, `user_created` | | bỏ khi so |

Hộp dashboard: `POST /dashboards {name, icon, color, note}` `fields=id` → `hydrate` → điều hướng; `PATCH
/dashboards/<id>` cùng body `fields=id` → `hydrate`. Nhân bản: `POST /dashboards {…dashboard, name: '<name> (copy)',
panels: […bỏ id, date_created, user_created], id/date_created/user_created: undefined}` `fields=id`. Xuất: `GET
/dashboards?export=json&fields[]=name,icon,note,color,panels.name,panels.icon,panels.color,panels.show_header,
panels.note,panels.type,panels.position_x,panels.position_y,panels.width,panels.height,panels.options&filter={"id":
{"_in":[…]}}`. Nhập: `POST /utils/import/directus_dashboards` multipart `file`.

## 4. Panel definition (`panels/<id>/index.ts`, FR-040, SC-006)

`PanelConfig = { id, name: '$t:panels.<key>.name', description, icon, component, options: DeepPartial<Field>[] |
(ctx) => DeepPartial<Field>[], minWidth, minHeight, query?(options) → PanelQuery | PanelQuery[] | undefined,
variable?: true, skipUndefinedKeys?: string[] }`; `PanelQuery = { collection, query: Query }`.

| id | khóa i18n | icon | min W×H | query | variable / skip |
|----|-----------|------|---------|-------|-----------------|
| `bar-chart` | `barchart` | `bar_chart` | 12×10 | group `[xAxis]`, aggregate `{fn ?? max: [yAxis]}`, filter, limit −1; thêm truy vấn display khi `xAxisDisplayField` | |
| `label` | `label` | `title` | 6×2 | — | |
| `line-chart` | `linechart` | `show_chart` | 6×6 | aggregate `{aggregation: [yAxis]}`, group `[xAxis \| getGroups(datePrecision, xAxis), grouping?]`, filter, limit −1 | |
| `list` | `list` | `list` | 12×6 | filter, sort `(sortDirection desc ? '-' : '') + (sortField ?? pk)`, limit ?? 5, fields từ `displayTemplate` + pk | skip `displayTemplate` |
| `meter` | `meter` | `speed` | 6×6 | aggregate `{fn: [field]}`, filter | |
| `metric` | `metric` | `functions` | 6×2 | `first/last`: fields `[field]`, sort theo `sortField`, limit 1; khác: aggregate `{function: [field]}`, filter, limit 1 | |
| `metric-list` | `metric_list` | `format_list_numbered` | 12×6 | group `[groupByField]`, aggregate `{aggregateFunction: [aggregateField]}`, sort theo aggregate `sortDirection`, limit ?? 5, filter | |
| `pie-chart` | `piechart` | `pie_chart` | 10×10 | group `[column]`, aggregate `{fn ?? count: [column]}`, filter, limit −1 | |
| `relational-variable` | `relational-variable` | `science` | 12×6 | — (REST riêng, §7) | variable; skip `displayTemplate` |
| `time-series` | `time_series` | `show_chart` | 12×6 | group `getGroups(precision ?? hour, dateField)`, aggregate `{function: [valueField]}`, filter + `{dateField: {_gte: '$NOW(-<range>)'}}` trừ `auto`, limit −1 | |
| `variable` | `variable` | `science` | 12×6 | — | variable; skip `options` |

Option fields của từng loại chép nguyên từ `index.ts` của Directus (test so nguồn qua `directus-registry.json`
`panels`), gồm cả `conditionalFormatting`/`conditionalFill` (list `{operator, value, color}`), định dạng số (`prefix`,
`suffix`, `numberStyle`, `notation`, `unit`, `minimumFractionDigits`, `maximumFractionDigits`), biểu đồ (`color`,
`decimals`, `min`, `max`, `curveType`, `fillType`, `showAxisLabels`, `showMarker`, `showLegend`, `showDataLabel`,
`horizontal`, `donut`, `showLabels`, `legend`, `missingData`, `showXAxis`, `showYAxis`), biến (`field`, `type`,
`defaultValue`, `inter` qua `system-interface`, `options` qua `system-interface-options`; quan hệ: `field`,
`collection`, `multiple`, `limit`, `displayTemplate`, `filter`).

## 5. Tài liệu GraphQL gộp (`loadPanelData`, FR-041, SC-005)

Mỗi panel có `query` → một hoặc nhiều `{collection, query}`; `applyOptionsData` trước. Khóa `query_<getSimpleHash(
panel.id + collection + JSON.stringify(query))>`. Tách `isSystemCollection(collection)` thành hai tài liệu:

```graphql
query {
  query_1a2b3c: bo_insights_data_aggregated(groupBy: ["status"], filter: {…}, limit: -1) { group count { id } }
  query_4d5e6f: bo_insights_data(filter: {…}, sort: ["-id"], limit: 5) { id status category }
  query_7a8b9c: bo_insights_data_aggregated(groupBy: ["day(happened_at)", …]) { … }
}
```

(`query-to-gql-string.ts`: aggregate → `<collection>_aggregated` với `groupBy`; filter khóa `year(x)` → `x_func: {year:
…}`; hệ thống bỏ tiền tố `directus_` và gửi `/graphql/system`.) Response `data.query_<hash>` gán vào `data[panelId]`
(mảng theo `index` khi nhiều truy vấn); `errors[]` với `extensions.graphqlErrors[0].path[0]` → `errors[panelId]`; HTTP
400 có `errors` → gọi lại bỏ panel lỗi. Bộ so payload so chuỗi sau khi thay `query_[0-9a-f]+` → `query_*`.

## 6. Biến dashboard (FR-053..FR-056)

`variables[field]` là một object dùng chung cho mọi dashboard (không tách theo dashboard, R-55); khởi tạo khi nạp store
từ `options.defaultValue` của panel `variable: true` (trùng `field` thì panel sau theo `sort dashboard` thắng; giá trị đã
có giữ nguyên: `assign({}, defaults, variables)`); `setVariable` chỉ
nạp lại panel có `{{ field }}` trong `JSON.stringify(options)`, đã có `data`, và `JSON.stringify(query(applyOptionsData(
cũ)))` ≠ mới; biến quan hệ rỗng (`[]`/`null`) → panel dùng nó `data = {}`, không truy vấn. Không lưu qua tải lại.

## 7. Panel đặc biệt

- `variable`: `getInterface(inter)?.component` với `v-bind="options"`, `value = getVariable(field)`, `@input =
  setVariable(field, $event)`; `width < 20` → nửa rộng.
- `relational-variable`: `DrawerCollection` chọn item (`multiple`, `filter`, giới hạn `limit`); `use-display-items(
  collection, displayTemplate ?? collection.display_template ?? '{{pk}}', ids)` → `GET /items/<collection>?fields[]=
  <từ template>,<pk>&filter={"<pk>":{"_in":[…]}}` (#198); giá trị biến = pk (mảng khi `multiple`).
- `list`: dòng `RenderTemplate`; `linkToItem` → `DrawerItem` sửa tại chỗ (`@input` → `PATCH <endpoint>/<pk>` rồi
  `refresh(dashboard)`).
- Biểu đồ: dữ liệu bảng ẩn `ChartTable {caption, columns: string[], rows: (string | number | null)[][]}` tính từ cùng
  `series`/`categories` (FR-106).

## 8. Workspace (`BoWorkspace`, `BoWorkspaceTile`, FR-022..FR-025)

Tile props mới: `resizable = false`, `minWidth = 8`, `minHeight = 6`, `color`, `note`, `borderRadius = [true ×4]`;
`update` emit `{position_x?, position_y?, width?, height?}` (chỉ khóa đổi); `data-pos-x/y`, `data-width/height`;
tay cầm `data-resize="top|right|bottom|left|top-left|top-right|bottom-left|bottom-right"`. Resize: delta ô =
`round((pageX − startX) / 18)`; top `h = H − dy, y = Y + dy`; right `w = W + dx`; bottom `h = H + dy`; left `w = W − dx,
x = X + dx`; kẹp `x, y ≥ 1`, `w ≥ minWidth`, `h ≥ minHeight` (R-54). Workspace: `zoomToFit`; cỡ = tile xa nhất (+25 ô
sửa, −1 ô xem); `zoomScale = min((mainW − 2·pad) / wsW, (mainH − header − 2·pad) / wsH)`, `transform: scale()`. Bo góc:
`borderRadius[i] = !góc i chạm cạnh tile khác` (`pointOnLine`).

## 9. Activity (`directus_activity`, FR-060..FR-065)

| Trường | Hiển thị |
|--------|----------|
| `action` | display `labels` (013) với choices từ metadata `/fields` (chữ `field_options.directus_activity.<action>`; màu là biến CSS của Directus `--theme--primary`, `--blue`, `--theme--danger`, `--purple`, chưa có trong web → Q-36) |
| `collection` | display `collection` (icon) |
| `timestamp` | display `datetime relative` (bảng), `toLocaleString` (drawer) |
| `user` | display `user` (bảng), `UserPopover` (drawer) |
| `ip`, `user_agent`, `origin`, `item` | chuỗi (drawer); `ip`/`user_agent`/`origin` monospace |
| `revisions` | o2m, không hiện |

Preset mặc định `directus_activity`: layout `tabular`, `layout_query.tabular {sort: ['-timestamp'], fields:
['action', 'collection', 'timestamp', 'user']}`, `layout_options.tabular.widths {action 120, collection 210,
timestamp 240, user 240}`. Lọc hệ thống của sub-menu: `null` | `{user: {_eq: '<me>'}}` | `{action: {_eq: '<a>'}}`.
Drawer: `GET /activity/<pk>?fields[]=user.id,user.email,user.first_name,user.last_name,action,timestamp,ip,
user_agent,origin,collection,item`.

## 10. Notification (`directus_notifications`, FR-070..FR-077)

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| `id` | integer | |
| `status` | `inbox` \| `archived` | tab; Archive = "đã đọc" (Clarifications) |
| `timestamp` | datetime | tương đối trong dòng |
| `recipient`, `sender` | uuid user | drawer không nạp `sender` |
| `subject` | string | tô từ khóa tìm |
| `message` | string \| null | markdown → `md()` |
| `collection`, `item` | string \| null | đích FR-072 |

Drawer: `GET /notifications?filter={"_and":[{"recipient":{"_eq":"<me>"}},{"status":{"_eq":"<tab>"}}]}&fields[]=id,
subject,message,collection,item,timestamp&sort[]=-timestamp&limit=25&page=<n>&search=<q>` (`<me>` theo cách Directus
gửi, kiểm T001); `PATCH /notifications {keys: [...], data: {status}}`; `DELETE /notifications [ids]`; đếm `GET
/notifications?aggregate[count]=id&filter=…inbox` (#26). Đích: `collection` + singleton hoặc không `item` → route
collection; `collection` + `item` → `getItemRoute`; không `collection` + `item` bắt đầu `/` → path; khác → không nút.

## 11. Snackbar / notice (FR-080..FR-082)

`NoticeRaw {title, text?, type?: info|success|warning|error, persist?, dialog?, code?, error?}` của `use-notices`
(012) — giữ; `notify()` của 018 chỉ dùng `title`, `type`, `persist` (nhập thành công: `import_data_success`).

## 12. Bộ mẫu `bo_insights` (FR-103, release-gate CHK029, CHK034, CHK052, CHK053)

Collection riêng `bo_insights_data` (tạo trong seed qua `POST /collections`, chỉ seed ghi, không E2E nào ghi) để số
liệu của dashboard mẫu không đổi khi E2E khác tạo/xóa item `bo_content`:

| Field | Kiểu | Giá trị mẫu |
|-------|------|-------------|
| `id` | integer, khóa tự tăng | 1–12 |
| `status` | string | `published` ×5, `draft` ×4, `archived` ×3 |
| `category` | string | `a` ×6, `b` ×4, `c` ×2 |
| `amount` | decimal(10,2) | giá trị cố định, có một dòng `null` |
| `qty` | integer | giá trị cố định |
| `happened_at` | dateTime (không timezone, không trừ offset ở time-series) | 12 thời điểm cố định trong 6 ngày của 2026-10-01..06 |
| `owner` | m2o `directus_users` | admin ×7, user cố định `bo-insights-user` (seed, role thử 014–016) ×5 |

| Dashboard | Panel (type: options chính; vị trí x,y w×h) | Dùng ở |
|-----------|---------------------------------------------|--------|
| `bo_dash_all` (icon `dashboard`, màu `#465FFF` giá trị người dùng) | `metric` (count `bo_insights_data`, prefix `#`, conditionalFormatting `>= 3` success; 1,1 6×2), `label` ("Backoffice", bold; 7,1 6×2), `metric-list` (group `status`, count, limit 5, conditionalFormatting `>= 2`; 1,3 12×6), `meter` (sum `qty`, max 100, half; 13,1 6×6), `list` (sort `-id`, limit 5, template `{{status}} {{category}}`, linkToItem; 13,7 12×6), `bar-chart` (xAxis `status`, yAxis `amount`, sum, decimals 2, conditionalFill; 1,9 12×10), `line-chart` (xAxis `category`, yAxis `qty`, sum; 25,1 6×6), `pie-chart` (column `category`, count, donut; 19,7 10×10), `time-series` (dateField `happened_at`, precision `day`, range `auto`, count; 1,19 12×6), `variable` (field `all_status`, type string, defaultValue `published`, inter `select-dropdown` với choices; 13,19 12×6; không panel nào dùng `{{all_status}}`), `relational-variable` (field `all_author`, collection `directus_users`, multiple; 25,19 12×6) | US2, US3, perf, parity UI, SC-002 |
| `bo_dash_vars` | `variable vars_status` (select-dropdown `published`/`draft`/`archived`, mặc định `published`), `relational-variable vars_author` (`directus_users`, multiple), `metric` count `bo_insights_data` lọc `status _eq {{vars_status}}` và `owner _in {{vars_author}}`, `list` cùng filter | US4, SC-003 (3 giá trị mỗi biến: `published`/`draft`/`archived`; [admin]/[`bo-insights-user`]/[]) |
| `bo_dash_system` | `metric` count `directus_users`, `list` `directus_files` template `{{title}}` | `/graphql/system` |
| `bo_dash_empty` | không panel | Edge Cases |
| `bo_dash_unknown` | 1 panel `type: 'bo-unknown'` | Edge Cases |

Tên biến của mỗi dashboard mẫu là riêng (`all_*`, `vars_*`) vì biến dùng chung toàn store (R-55): E2E của dashboard này
không đổi giá trị panel của dashboard kia. Mốc dữ liệu biểu đồ tính từ response GraphQL của Directus app (T002) với cùng
biến đổi của panel (FR-105).

Thông báo mẫu (admin, chỉ dev và parity UI): `bo_notification_item` (`collection bo_content`, `item 1`, message markdown
có link), `bo_notification_collection` (`collection bo_content`, không item), `bo_notification_path` (không collection,
`item '/settings/project'`). E2E thông báo không dùng ba dòng này: mỗi spec tạo user tạm bằng `Fixtures` (014–016) và 3
thông báo cho user đó ở `beforeAll` (cùng ba dạng đích, subject `web-e2e-<cfg>-<n>`), xóa ở `afterAll`.

Activity mẫu: seed `bo_insights_data` tạo activity `create` cho 12 dòng (SC-004 (c) lọc `collection bo_insights_data`,
dòng cùng `timestamp` so như tập); snapshot `activity.json` 20 dòng cho mock.
