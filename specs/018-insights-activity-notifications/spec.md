# Feature Specification: Insights, Activity, Notifications (dashboard và 11 panel, nhật ký hoạt động, chuông và drawer thông báo như Directus)

**Feature Branch**: `018-insights-activity-notifications` (làm trên `main` như 012–017, không tạo branch; `specs/018-*`
là thư mục feature hiện tại theo quy tắc "thư mục số cao nhất" của `.specify/scripts/bash/common.sh`)
**Created**: 2026-10-17
**Status**: Draft
**Input**: User description: "Module Insights: tạo dashboard, thêm và sắp xếp panel (metric, metric list, meter, time
series, line chart, bar chart, pie chart, list, label, variable, relational variable), lọc theo biến dashboard. Module
Activity: xem nhật ký hoạt động, lọc theo user, collection, hành động. Notifications: chuông thông báo, đánh dấu đã đọc,
mở item liên quan. Luồng giống Directus. Tham chiếu directus/app/src/modules/insights, activity,
directus/app/src/panels. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung
app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: dashboard tạo ở Directus hiển thị đúng trên app
mới. Ghi chú từ 014: /content/directus_dashboards và /content/directus_activity chuyển hướng sang /insights, /activity
(khung của 012, D-72); 018 thay khung bằng màn thật, giữ route. Ghi chú từ 015: drawer thông báo chưa có danh sách
upload TUS dở (D-90); khi 018 làm drawer thông báo thì thêm danh sách này như Directus (tusResumableUploadsChanged),
utils/upload-file.ts đã giữ việc tiếp tục upload dở khi chọn lại cùng file. Ghi chú từ 017: BoWorkspace và
BoWorkspaceTile (src/components/workspace, port của v-workspace, v-workspace-tile) đã có cho canvas flows: kéo bám lưới
18 px, menu tile, data-pos-x/y; chưa có resize và zoom mà dashboard Insights cần. /content/directus_operations không
chuyển hướng, giống Directus (get-route.ts không có dòng đó). Ghi chú từ 016: thông báo dạng snackbar của Directus vẫn
là notice tại chỗ và hộp lỗi (D-66 của 013); settingsStore.updateSettings và các màn Settings dùng
notify/showUnexpectedError. Khi 018 làm Notifications thì xét lại cách hiển thị này."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/app/src` trừ khi ghi khác; khảo sát 2026-10-17):

- Insights route: `modules/insights/index.ts:11-49` (`insights-overview` `/insights`, `insights-dashboard`
  `/insights/:primaryKey` với `beforeEnter` gọi `store.refresh(pk)` (chỉ nạp dữ liệu panel của dashboard đã có trong
  store; dashboard không có trong store → `not-found.vue`), con `panel-detail` `:panelKey` nổi ở named view
  `detail`, `+` = panel mới; module hiện khi admin hoặc quyền đọc `directus_dashboards` `partial`/`full`).
- Insights danh sách: `routes/overview.vue` (bảng icon màu, Name (sắp xếp, mặc định tăng dần), Note; chọn nhiều; tìm
  client theo tên, hiện khi có ít nhất một dashboard, autofocus khi > 25; xuất JSON phần chọn (`GET /dashboards
  ?export=json` với `fields` dashboard + `panels.*` giao diện, `filter id _in`); xóa hàng loạt có xác nhận; tạo; menu
  dòng Edit / Duplicate (`"<name> (copy)"`, chép panel, không gated) / Export / Delete; mục sidebar
  `BasicImportSidebarDetail collection="directus_dashboards"` (`POST /utils/import/directus_dashboards`)),
  `components/navigation.vue` (danh sách dashboard ở sub-menu), `components/dashboard-dialog.vue` (Name bắt buộc, Icon
  mặc định `dashboard`, Color, Note; `POST`/`PATCH /dashboards`; tạo xong điều hướng tới dashboard).
- Trang dashboard: `routes/dashboard.vue` (chế độ xem: nút zoom-to-fit, nút sửa gated bởi quyền `update` của
  `directus_panels`; chế độ sửa: Clear Changes, thêm panel, Save, `meta+s`; vào sửa tắt zoom; sidebar Comments và
  Refresh; tile: loading, lỗi, `no_data`, error boundary; bo góc tile theo tile kề; menu tile Copy To / Duplicate /
  Delete; guard `useEditsGuard` bỏ qua tiền tố `/insights/:pk`), `routes/panel-configuration.vue` (drawer
  `persistent`: lưới loại panel có ảnh xem trước, options của loại với raw editor, nhóm header `show_header`, name,
  icon, color, note; panel mới id `_<nanoid>`, cỡ = cỡ tối thiểu của loại hoặc 4×4, vị trí (1,1); chỉ staging).
- Store: `stores/insights.ts` (`hydrate` nạp mọi `/dashboards`, `/panels` khi có quyền đọc cả hai; biến mặc định từ
  `options.defaultValue` của panel loại `variable: true`; staging create/update/delete, Save = `POST`/`PATCH`/`DELETE
  /panels` hàng loạt; nhân bản +2/+2; dữ liệu panel: `query(options)` của loại → gộp mọi truy vấn của dashboard thành một
  tài liệu GraphQL (`query_<hash>`) gửi `POST /graphql`, collection hệ thống gửi `/graphql/system`; lỗi từng phần gắn
  vào panel, 400 thì gửi lại không có panel lỗi; nhớ dữ liệu 3 dashboard gần nhất; `setVariable` chỉ nạp lại panel có
  `{{ field }}` trong options và truy vấn đổi; biến quan hệ rỗng → panel dùng nó nhận `{}` và không truy vấn;
  `refreshIntervals` trong bộ nhớ theo dashboard). `applyOptionsData` ở `directus/packages/utils/shared/
  apply-options-data.ts`.
- Panel: `panels/index.ts` (sắp theo `id`) và 11 thư mục `panels/<id>/` (`index.ts` options, `minWidth`/`minHeight`,
  `query`, `variable`, `skipUndefinedKeys`; `panel-<id>.vue` hiển thị; `preview.svg`); biểu đồ bar, line, pie, time
  series vẽ bằng `apexcharts` (`directus/app/package.json:116`, catalog 4.7.0); `utils/get-groups.ts` (nhóm ngày).
- Workspace: `components/v-workspace.vue` (lưới 18 px, cỡ theo tile xa nhất, chế độ sửa +25 ô, zoom-to-fit = `scale()`
  theo tỉ lệ nhỏ hơn của rộng/cao), `components/v-workspace-tile.vue` (mặc định min 8×6, 8 tay cầm resize, nhãn `W×H`
  khi resize, kẹp cỡ tối thiểu và vị trí ≥ 1, menu tile, pencil).
- Activity: `modules/activity/index.ts:5-30` (`hidden: true`, `activity-collection` `/activity`, con `activity-item`
  `:primaryKey` nổi ở named view `detail`), `routes/collection.vue` (`usePreset('directus_activity')`, layout wrapper
  `show-select="none"`, tiêu đề `activity_feed` icon `access_time`, `SearchInput` tìm + lọc nâng cao, sidebar layout,
  rỗng `no_results`/`no_items`), `components/navigation.vue` (All activity, My activity `user _eq` mình, vạch, lọc
  action create/update/delete/login/logout; lọc đi vào `filter-system`, ẩn khỏi UI lọc), `routes/item.vue` (drawer:
  `GET /activity/:pk` với User, Action, Date, IP, User agent, Origin, Collection, Item; nút `launch` mở item, ẩn với
  collection hệ thống hoặc action `delete`), preset mặc định `stores/presets.ts:63-82` (tabular, sort `-timestamp`,
  cột action/collection/timestamp/user, rộng 120/210/240/240), display field ở
  `directus/packages/system-data/src/fields/activity.yaml`.
- Thông báo: `views/private/components/module-bar-avatar.vue:56-65` (chuông luôn bấm được, mở drawer; `VBadge` số chưa
  đọc ẩn khi 0), `notifications-drawer.vue` (chỉ nạp khi mở; lọc `recipient` = mình và `status` = tab; fields `id, subject,
  message, collection, item, timestamp`; sort `-timestamp`; 25 dòng/trang; tab Inbox/Archive; tìm; chọn tất cả/một;
  Archive ↔ Unarchive = `PATCH /notifications {keys, data: {status}}`; xóa có xác nhận; dòng mở rộng hiện `message`
  markdown; nút `open_in_new` tới item; link "Activity"), `stores/notifications.ts` (`refreshUnreadCount` = đếm
  `inbox` khi hydrate, sau archive/xóa, sau chạy flow thủ công; hàng đợi snackbar `add`, tự ẩn 3000 ms khi không
  `persist`; `dialog: true` thành hộp thoại), `notifications-group.vue` (snackbar góc dưới phải),
  `notification-dialogs.vue` (hộp lỗi, nút "Report error" cho admin khi mã `UNKNOWN`), `utils/notify.ts`,
  `utils/unexpected-error.ts`, `types/notifications.ts`.
- `Events.tusResumableUploadsChanged` (`events.ts:9`) chỉ được phát ở `utils/upload-file.ts:54,61,73,98`; Directus
  11.17.4 không có nơi nghe và drawer thông báo không có danh sách upload (đã kiểm bằng grep 2026-10-17, xem FR-076).
- Chuyển hướng: `utils/get-route.ts:6-7` (`directus_dashboards` → `/insights`, `directus_activity` → `/activity`;
  `directus_notifications` không có dòng); `modules/content/index.ts:17-30` (`checkForSystem`).
- API (đã có, `apps/api`): `/dashboards`, `/panels` CRUD và hàng loạt (010), `?export=json` (`middleware/respond.ts`),
  `POST /utils/import/:collection` (010), `/graphql`, `/graphql/system` với aggregate và group (011), `/activity`
  (008), `/notifications` (010), `/items` aggregate/groupBy (005).

**Dùng lại từ 012–017** (không viết lại): khung app, `PrivateView` (`fill`), `PageHeader`, `DetailPanel`, sub-menu
module, `ModulePlaceholder` (bị thay), `ContentNotFound`, store notifications (đếm chưa đọc), `use-notices`
(`notify`, `showUnexpectedError`), `NoticeStack` (012); `BoForm`, `BoDrawer`, `BoDialog`, `BoTable`, `BoMenu`,
`BoNotice`, `BoTooltip`, `BoIconPicker`, `BoColorPicker`, `RenderDisplay`, `RenderTemplate`, `DrawerCollection`, mọi
interface (cho panel `variable` và form options), display `labels`, `collection`, `datetime`, `user`, `UserPopover`
(013); `use-preset`, layout wrapper và layout tabular, `SearchInput` + system-filter, `CommentsSidebarDetail`,
`RefreshSidebarDetail`, `LayoutSidebarDetail`, `ImportErrorDialog`, `use-edits-guard`, `use-dialog-route`,
`use-shortcut`, `get-item-route`, `use-run-manual-flow` (014); `utils/upload-file.ts` (015); `ExtensionOptions`,
`BoFancySelect`, `system-*` interface (016); `BoWorkspace`, `BoWorkspaceTile` (017: kéo bám lưới 18 px, menu tile
Copy To / Duplicate / Delete, `data-pos-x/y`; thiếu resize, nhãn `W×H`, cỡ tối thiểu, zoom-to-fit, màu/note/bo góc
tile, FR-024).

## User Scenarios & Testing *(mandatory)*

Người dùng là người đang dùng Directus app trên cùng DB, nay làm cùng việc trên app Backoffice:

- người có quyền đọc `directus_dashboards` xem dashboard; người có quyền ghi tạo dashboard, thêm panel, sắp xếp và đổi
  cỡ panel, lọc dữ liệu bằng biến của dashboard;
- mọi người dùng app xem nhật ký hoạt động (admin thấy hết, người khác thấy theo quyền, tối thiểu là activity của mình),
  lọc theo user, collection, hành động, mở item liên quan;
- mọi người dùng app thấy số thông báo ở Inbox trên chuông, mở drawer, đọc, chuyển sang Archive (đây là "đánh dấu đã
  đọc" của mô tả feature: Directus không có cờ đã đọc, Clarifications), mở item liên quan.

Dashboard, panel và trạng thái thông báo ghi ở app này mở được ngay ở app kia với cùng bố cục, cùng options, cùng số
liệu.

Phạm vi: `/insights`, `/insights/:primaryKey`, `/insights/:primaryKey/:panelKey` (`+` = mới), `/activity`,
`/activity/:primaryKey`, chuông ở header và drawer thông báo; thay khung D-40 (012) của Insights và Activity, đích thật
cho `directus_dashboards` và `directus_activity` của D-72 (014), gỡ D-45 phần insights và drawer thông báo (012); 11
panel có sẵn của Directus 11.17.4 với đúng `id`, option fields, cỡ tối thiểu, truy vấn; xét lại D-66 (giữ notice tại
chỗ, FR-080) và D-90 (gỡ: Directus không có danh sách upload, FR-076); E2E ba cấu hình, bộ so payload, kịch bản dùng chéo.

Ngoài phạm vi: panel từ extension (XI, D-41; dữ liệu có loại lạ vẫn hiện, xem Edge Cases), thông báo realtime qua
WebSocket (D-41; Directus cũng không thăm dò, xem FR-073), gửi email thông báo (X), AI, `/content/directus_notifications`
(Directus không chuyển hướng, giữ như 014), module bar avatar kiểu Directus (khung TailAdmin của 012, D-52).

### User Story 1 - Danh sách dashboard: tạo, sửa, nhân bản, xuất, nhập, xóa (Priority: P1)

Người dùng vào Insights, thấy bảng dashboard (icon màu, tên, ghi chú) và cùng danh sách ở sub-menu; tìm theo tên; bấm
"+" mở hộp tạo (tên, icon, màu, ghi chú), tạo xong vào dashboard mới; từ menu dòng sửa, nhân bản, xuất JSON, xóa có xác
nhận; chọn nhiều để xuất hoặc xóa; nhập file JSON/CSV ở panel chi tiết.

**Why this priority**: Là điểm vào của module và của tiêu chí chấp nhận (dashboard tạo ở Directus hiện trong danh sách
của app mới).

**Independent Test**: E2E trên bộ mẫu `bo_insights` (FR-103): mở `/insights`, so bảng, sub-menu, nút với Directus app;
tạo dashboard tạm qua app mới rồi mở `/admin/insights` trên Directus app: dòng xuất hiện với cùng tên, icon, màu, ghi
chú; nhân bản `bo_dash_all` và so số panel của bản sao; xuất rồi nhập lại file JSON và so dòng `directus_dashboards`,
`directus_panels` với cùng thao tác trên Directus app (bộ so DB).

**Acceptance Scenarios**:

1. **Given** người có quyền đọc `directus_dashboards`, **When** mở `/insights`, **Then** bảng như `overview.vue`: cột
   icon (màu `color`), Name (sắp xếp được, mặc định tăng dần), Note; chọn nhiều; cột co kéo; click dòng mở
   `/insights/:id`, Ctrl/Cmd/chuột giữa mở tab mới; sub-menu Insights liệt kê dashboard theo cùng thứ tự với icon màu.
2. **Given** có ít nhất một dashboard, **When** gõ vào ô tìm, **Then** lọc client theo tên, không phân biệt hoa thường;
   ô tìm autofocus khi có hơn 25 dashboard; không khớp → trạng thái `no_results` với nút xóa tìm; chưa có dashboard →
   trạng thái `no_dashboards` với nút tạo (chỉ khi có quyền `create`), ô tìm ẩn.
3. **Given** có quyền `create`, **When** bấm "+", **Then** hộp `create_dashboard`: Name (bắt buộc, autofocus), Icon
   (mặc định `dashboard`), Color, Note; Save gửi `POST /dashboards` rồi nạp lại store và điều hướng tới dashboard mới;
   Cancel đóng không ghi.
4. **Given** menu dòng, **When** chọn, **Then** Edit Dashboard (khi có quyền `update`; mở cùng hộp với giá trị hiện có,
   `PATCH /dashboards/:id`), Duplicate (`POST /dashboards` với `name` = `"<name> (copy)"` và mọi panel bỏ `id`,
   `date_created`, `user_created`; nạp lại), Export (mở URL xuất JSON của dashboard đó), Delete (khi có quyền `delete`;
   hộp xác nhận rồi `DELETE /dashboards/:id`).
5. **Given** đã chọn nhiều dòng, **When** bấm Export hoặc Delete ở header, **Then** Export tải file JSON từ `GET
   /dashboards?export=json&fields=<15 trường>&filter={"id":{"_in":[…]}}` (nút khóa khi không có quyền `create`, như
   Directus);
   Delete hỏi xác nhận rồi `DELETE /dashboards` với mảng khóa.
6. **Given** panel chi tiết của `/insights`, **When** chọn file JSON hoặc CSV và bấm nhập, **Then** `POST
   /utils/import/directus_dashboards` (multipart); thành công → thông báo `import_data_success` và nạp lại; lỗi → hộp lỗi
   nhập (`ImportErrorDialog` của 014).
7. **Given** dashboard tạo ở Directus app, **When** mở `/insights` trên app mới (sau tải lại, xem Edge Cases), **Then**
   dòng xuất hiện với cùng giá trị; và ngược lại.

---

### User Story 2 - Xem dashboard: panel hiển thị đúng số liệu, zoom vừa màn, tự làm mới (Priority: P1)

Người dùng mở một dashboard: các panel nằm đúng vị trí và cỡ trên lưới, mỗi panel có header (tên, icon, màu, ghi chú)
khi bật và phần thân là metric, danh sách, biểu đồ… với số liệu lấy từ DB; bật zoom-to-fit để thấy cả dashboard; chọn
chu kỳ tự làm mới; xem và viết bình luận ở panel chi tiết.

**Why this priority**: Là tiêu chí chấp nhận chính: dashboard tạo ở Directus hiển thị đúng trên app mới.

**Independent Test**: E2E: mở dashboard `bo_dash_all` (11 panel, mỗi loại một, do seed tạo bằng Directus REST) trên app
mới và Directus app song song; so cho từng panel: vị trí và cỡ ô, chữ header, giá trị hiển thị (metric, metric list,
list, meter, label), dữ liệu biểu đồ (nhãn trục, nhãn chuỗi, giá trị điểm) và body `POST /graphql` (bộ so payload).

**Acceptance Scenarios**:

1. **Given** dashboard có panel, **When** mở `/insights/:id`, **Then** mỗi panel là tile tại (`position_x`,
   `position_y`) với cỡ `width`×`height` ô 18 px; header khi `show_header` (icon hoặc icon của loại, màu `color`, tên;
   ghi chú `note` là tooltip); tile bo góc theo tile kề như Directus; tiêu đề trang là tên dashboard; nút zoom-to-fit và
   nút sửa (khóa khi không có quyền `update` trên `directus_panels`).
2. **Given** mở dashboard, **When** dữ liệu nạp, **Then** mọi truy vấn của các panel gộp trong một `POST /graphql`
   (và một `POST /graphql/system` nếu có panel trên collection hệ thống), như FR-041; tile đang nạp lần đầu hiện vòng
   quay; tile lỗi hiện icon cảnh báo, `unexpected_error` và chi tiết lỗi; tile có dữ liệu rỗng hiện `no_data`; lỗi một
   panel không làm các panel khác lỗi (gửi lại bỏ panel lỗi khi API trả 400, như `insights.ts:265-315`).
3. **Given** 11 loại panel, **When** hiển thị, **Then** mỗi loại cho cùng kết quả với Directus theo FR-042 đến FR-052
   (giá trị, định dạng số, định dạng có điều kiện, chuỗi biểu đồ, nhóm thời gian, link tới item).
4. **Given** chế độ xem, **When** bấm zoom-to-fit, **Then** toàn bộ lưới co theo tỉ lệ nhỏ hơn của rộng/cao vùng nội
   dung để thấy hết; bấm lại thì về cỡ thật; vào chế độ sửa thì zoom tắt; trạng thái zoom không lưu (như Directus).
5. **Given** panel chi tiết, **When** chọn mục Auto Refresh, **Then** năm lựa chọn (không, 10 s, 30 s, 1 phút, 5 phút);
   chọn chu kỳ thì nạp lại dữ liệu dashboard theo chu kỳ, dừng khi người dùng nhàn rỗi như `refresh-sidebar-detail.vue`;
   lựa chọn nhớ theo dashboard trong phiên, mất khi tải lại trang; mục Comments như trang item (014) với
   `collection directus_dashboards`.
6. **Given** đã mở dashboard A rồi B rồi A, **When** quay lại A, **Then** dữ liệu cũ hiện ngay và nạp lại nền (nhớ 3
   dashboard gần nhất).

---

### User Story 3 - Sửa dashboard: thêm, cấu hình, kéo, đổi cỡ, nhân bản, chép, xóa panel, lưu một lần (Priority: P1)

Người có quyền bấm sửa: lưới mở rộng, mỗi tile có pencil và menu; bấm "+" mở drawer chọn loại panel (lưới có ảnh xem
trước), điền options của loại và nhóm header; kéo tile đổi vị trí và kéo tay cầm đổi cỡ (bám lưới, không nhỏ hơn cỡ tối
thiểu của loại); nhân bản, chép sang dashboard khác, xóa; Save ghi mọi thay đổi; Clear Changes hỏi rồi bỏ; rời trang khi
sửa dở thì hỏi.

**Why this priority**: "Thêm và sắp xếp panel" là yêu cầu chính của mô tả; dashboard tạo ở app mới phải mở được ở
Directus với cùng bố cục.

**Independent Test**: E2E: tạo dashboard tạm, thêm metric (count trên `bo_insights_data`) và bar chart, kéo bar chart sang
(13, 1), đổi cỡ metric thành 8×4, lưu; mở trên Directus app 8155 và so vị trí, cỡ (`--pos-x`, `--pos-y`, `--width`,
`--height` của Directus; `data-pos-x/y`, `data-width/height` của Backoffice), options và giá trị; so dòng
`directus_panels` với cùng thao tác trên Directus app (bộ so DB).

**Acceptance Scenarios**:

1. **Given** chế độ xem và có quyền, **When** bấm sửa, **Then** chế độ sửa: zoom tắt, lưới rộng thêm 25 ô, nút Clear
   Changes, "+" (thêm panel) và Save (khóa khi không có thay đổi); mỗi tile có pencil và menu `more_vert` (Copy To...
   khóa với panel chưa lưu id `_…`, Duplicate, Delete).
2. **Given** chế độ sửa, **When** bấm "+", **Then** mở `/insights/:id/+` (drawer `persistent`) với lưới 11 loại panel
   (icon lớn của loại, tên, mô tả; D-110), chọn loại thì hiện options của loại (FR-031) và nhóm header: Show Header, Name, Icon,
   Color, Note (bốn field sau khóa khi tắt header); Done thêm panel id `_<nanoid>` cỡ = cỡ tối thiểu của loại (4×4 nếu
   loại không khai), vị trí (1,1) vào staging; Cancel bỏ.
3. **Given** chế độ sửa, **When** kéo tile, **Then** vị trí bám lưới 18 px, không nhỏ hơn 1, vào staging; **When**
   kéo một trong 8 tay cầm, **Then** cỡ bám lưới, không nhỏ hơn cỡ tối thiểu của loại, nhãn `W×H` hiện khi kéo, vào
   staging.
4. **Given** menu tile, **When** chọn, **Then** Duplicate thêm bản sao lệch +2/+2 vào staging; Copy To... mở hộp chọn
   dashboard khác và thêm bản sao với `dashboard` đích vào staging, ghi khi Save (FR-026); Delete bỏ khỏi staging (panel đã lưu vào danh sách xóa),
   không hộp xác nhận (như Directus, R-51).
5. **Given** có thay đổi, **When** bấm Save hoặc `Ctrl/Cmd+S` (không khi drawer mở), **Then** gửi `POST /panels` (mảng
   panel mới, bỏ id tạm), `PATCH /panels` (thay đổi panel có sẵn), `DELETE /panels` (khóa bị xóa) như
   `insights.ts:421-461`, nạp lại store, về chế độ xem; lỗi (bất kỳ request nào) → hộp lỗi, không nạp lại store,
   staging giữ (guard rời trang vẫn chặn) nhưng trang VẪN về chế độ xem như `dashboard.vue:168-171`; request đã thành
   công không hoàn lại, Save lại gửi lại toàn bộ staging (R-56).
6. **Given** có thay đổi, **When** bấm Clear Changes, **Then** hộp xác nhận rồi bỏ staging; **When** rời trang (trừ
   sang `/insights/:id/*`), **Then** hộp `unsaved_changes` (Keep Editing trước, Discard).
7. **Given** dashboard sửa ở app mới, **When** mở ở Directus app, **Then** cùng tile, vị trí, cỡ, header, options; và
   ngược lại.

---

### User Story 4 - Biến dashboard: lọc các panel bằng panel variable và relational variable (Priority: P2)

Người dùng đổi giá trị ở panel Variable (ô nhập theo interface đã cấu hình) hoặc chọn item ở panel Relational
Variable; các panel có `{{ <tên biến> }}` trong options (ví dụ trong filter) nạp lại với giá trị mới. Như Directus, biến
là của cả app trong phiên (khóa `field`), không riêng một dashboard.

**Why this priority**: Mô tả yêu cầu "lọc theo biến dashboard"; phụ thuộc US2.

**Independent Test**: E2E trên `bo_dash_vars` (biến `vars_status` dạng `select-dropdown` mặc định `published`, biến
quan hệ `vars_author` trên `directus_users`; metric count và list trên `bo_insights_data` lọc bằng hai biến; tên biến không
dùng ở dashboard mẫu khác, R-55): đổi biến ở hai app, so giá
trị metric, số dòng list và body `POST /graphql` sau mỗi lần đổi.

**Acceptance Scenarios**:

1. **Given** panel Variable có `defaultValue`, **When** mở dashboard, **Then** biến mang giá trị mặc định trước khi
   nạp dữ liệu; các panel dùng biến truy vấn với giá trị đó.
2. **Given** đổi giá trị biến, **When** giá trị mới vào store, **Then** chỉ panel đã có dữ liệu, có `{{ <field> }}`
   trong options và truy vấn thay đổi được nạp lại (một `POST /graphql` gộp; gồm cả panel của dashboard khác đã nạp
   trong 3 dashboard gần nhất, như `insights.ts:467-499`); panel khác giữ nguyên, không request.
3. **Given** panel Relational Variable (`multiple` hoặc một), **When** chọn item qua drawer chọn item (013), **Then**
   panel hiện các item đã chọn theo `displayTemplate` (nạp bằng REST `filter` khóa `_in`, giới hạn `limit`), biến là
   khóa (mảng khi `multiple`); bỏ chọn hết → panel dùng biến nhận options rỗng và không truy vấn (như
   `insights.ts:186-220`).
4. **Given** giá trị biến, **When** tải lại trang, **Then** biến về giá trị mặc định (không lưu, như Directus).

---

### User Story 5 - Activity: nhật ký hoạt động, lọc theo user, collection, hành động, mở item liên quan (Priority: P2)

Người dùng mở Activity (từ link ở drawer thông báo, từ `/content/directus_activity`, hoặc URL): bảng activity mới nhất
trước (hành động có màu, collection có icon, thời gian tương đối, user); sub-menu: tất cả, của tôi, theo hành động; tìm
và lọc nâng cao theo user, collection, IP…; bấm dòng mở drawer chi tiết; nút mở item liên quan.

**Why this priority**: Mô tả yêu cầu; dùng lại layout, preset, bộ lọc của 014 nên ít rủi ro.

**Independent Test**: E2E: tạo, sửa, xóa item `bo_content` và đăng nhập lại để có activity; mở `/activity` ở hai app,
so cột, thứ tự, nhãn; chọn "My activity", "Update", lọc `collection = bo_content` qua lọc nâng cao, so request `GET
/activity` và số dòng; mở drawer một dòng `update`, so trường, bấm mở item → trang item 014.

**Acceptance Scenarios**:

1. **Given** người dùng app, **When** mở `/activity`, **Then** tiêu đề `activity_feed` (icon `access_time`); layout
   theo preset `directus_activity` của người dùng (mặc định tabular, sort `-timestamp`, cột action, collection,
   timestamp, user với rộng 120/210/240/240); không có ô chọn dòng; đổi layout, cột, sort lưu vào preset như 014.
2. **Given** sub-menu Activity, **When** chọn mục, **Then** All Activity (không lọc), My Activity (`user _eq` mình),
   vạch, Create, Update, Delete, Login, Logout (`action _eq`); lọc này là lọc hệ thống, không hiện trong UI lọc; mục
   active đánh dấu.
3. **Given** ô tìm và lọc nâng cao, **When** thêm điều kiện `collection`, `user`, `ip`, `timestamp`…, **Then** gộp với
   lọc hệ thống bằng `_and`, như `SearchInput` của 014.
4. **Given** bấm dòng, **When** mở `/activity/:id`, **Then** drawer với User (tên, popover), Action (nhãn dịch), Date
   (giờ địa phương), IP, User Agent, Origin, Collection, Item; nút `launch` mở `get-item-route(collection, item)` (ẩn khi
   collection hệ thống hoặc action `delete`); đóng drawer về `/activity` giữ bộ lọc; lỗi nạp → `BoNotice` danger trong
   drawer.
5. **Given** người không admin với quyền tối thiểu (đọc activity của mình), **When** mở `/activity`, **Then** chỉ thấy
   dòng của mình (API lọc); không lỗi.
6. **Given** URL `/content/directus_activity` hoặc `/content/directus_activity/:id`, **When** mở, **Then** chuyển tới
   `/activity` hoặc `/activity/:id` (D-72 gỡ phần `directus_activity`).

---

### User Story 6 - Chuông và drawer thông báo: đọc, lưu trữ (đánh dấu đã đọc), xóa, mở item liên quan (Priority: P2)

Người dùng thấy chuông ở header với số thông báo chưa đọc; bấm mở drawer: tab Inbox và Archive, tìm, mở rộng dòng để
đọc nội dung, bấm mở item liên quan, chọn một hoặc nhiều để lưu trữ (đánh dấu đã đọc) hoặc đưa lại Inbox, xóa có xác
nhận; link "Activity" tới module Activity.

**Why this priority**: Mô tả yêu cầu; thông báo do comment có mention (008) và operation `notification` của flow (009)
tạo cần một nơi để đọc.

**Independent Test**: E2E: tạo 3 thông báo cho user tạm của `Fixtures` (một trỏ item `bo_content`, một trỏ collection,
một không link) bằng REST admin; đăng nhập user đó ở app mới: badge 3; mở drawer, so danh sách với Directus app; lưu trữ một → badge 2, dòng sang
Archive ở cả hai app; mở item → trang item 014, drawer đóng; xóa một có xác nhận; so body `PATCH /notifications`,
`DELETE /notifications` với Directus app.

**Acceptance Scenarios**:

1. **Given** đăng nhập, **When** khung app hiện, **Then** chuông ở header (TailAdmin) với badge số chưa đọc (`inbox`
   của mình, đếm như 012); 0 thì ẩn badge, chuông vẫn bấm được (để xem Archive) như Directus (Q-38); bấm mở drawer
   thông báo.
2. **Given** drawer mở, **When** nạp, **Then** chỉ khi mở mới gửi `GET /notifications` lọc `recipient` = mình và
   `status` = tab, fields `id, subject, message, collection, item, timestamp`, sort `-timestamp`, 25 dòng/trang có phân
   trang; header hiện số dòng; tab Inbox (mặc định) và Archive ở cột trái; link Activity.
3. **Given** danh sách, **When** xem dòng, **Then** ô chọn, `subject` (từ khóa tìm được tô), thời gian tương đối; nút
   mở item (khi có đích, FR-072); nút mở rộng hiện `message` dạng markdown đã làm sạch; ô chọn tất cả ở đầu (trạng thái
   lưng chừng khi chọn một phần); đổi tab thì bỏ chọn.
4. **Given** đã chọn, **When** bấm Archive (tab Inbox) hoặc Unarchive (tab Archive), **Then** `PATCH /notifications
   {keys, data: {status: 'archived' | 'inbox'}}`, nạp lại danh sách và badge; **When** bấm Delete, **Then** hộp xác
   nhận rồi `DELETE /notifications` mảng khóa, nạp lại danh sách và badge.
5. **Given** dòng có đích, **When** bấm mở, **Then** điều hướng tới đích (FR-072) và đóng drawer.
6. **Given** tìm, **When** gõ, **Then** lọc server bằng `search`; không khớp → `no_results` với nút xóa lọc; không có
   thông báo → `no_notifications`.
7. **Given** thông báo lưu trữ ở app mới, **When** mở Directus app, **Then** dòng ở Archive và badge giảm; và ngược lại.

---

### User Story 7 - Thông báo thành công và lỗi toàn app (giữ notice tại chỗ, D-66) (Priority: P3)

Sau một thao tác (lưu, xóa, nhập file, chạy flow, chép link), người dùng thấy notice ngắn tại chỗ dưới page header như
các màn 013–017; lỗi không lường trước hiện hộp lỗi với mã và nút đóng. Các màn mới của 018 dùng cùng cách.

**Why this priority**: Ghi chú từ 016 yêu cầu xét lại; owner chọn giữ notice tại chỗ (Clarifications 2026-10-17) nên
018 chỉ áp cách đó cho màn mới và nối `utils/unexpected-error.ts` vào hộp lỗi.

**Independent Test**: E2E nhập file dashboard, nhân bản dashboard, lưu dashboard và gây lỗi 500 giả ở Insights: notice
hiện dưới page header với `role="status"`, tự ẩn sau 3000 ms; lỗi hiện hộp lỗi, focus vào Dismiss.

**Acceptance Scenarios**:

1. **Given** thao tác thành công gọi `notify`, **When** hiện, **Then** notice tại chỗ (`NoticeStack` 012, Q-8) tự ẩn
   sau 3000 ms trừ khi `persist`, có nút đóng khi `persist` và `closeable` không `false`; không snackbar.
2. **Given** lỗi không lường trước gọi `showUnexpectedError`, **When** hiện, **Then** hộp lỗi với `errors.<code>` và
   nút Dismiss (như `notification-dialogs.vue`); không có nút "Report error" (D-109).

---

### User Story 8 - Đối chiếu với Directus, E2E ba cấu hình, dùng chéo, recipe design-system (Priority: P2)

Mọi luồng trên chạy ở ba cấu hình API (proxy tới Directus thật, proxy tới API mới, khác origin) và so với Directus app
trên cùng DB; dashboard, panel, thông báo ghi ở app này mở và sửa được ở app kia; recipe design-system cho panel, biểu
đồ, drawer thông báo, chuông được viết trước khi code và design owner duyệt.

**Why this priority**: Là tiêu chí chấp nhận.

**Independent Test**: Job `e2e-web` với spec `insights-*.spec.ts`, `activity-*.spec.ts`, `notifications-*.spec.ts`;
bộ so payload `insights`, `activity`, `notifications`; bộ so DB cho `directus_dashboards`, `directus_panels`,
`directus_notifications`; bộ so UI cho bảng, sub-menu, header tile, giá trị panel, dữ liệu biểu đồ; kịch bản dùng chéo
của SC-002.

**Acceptance Scenarios**:

1. **Given** bộ mẫu `bo_insights` seed qua Directus REST, **When** chạy E2E song song hai app, **Then** 0 lệch ngoài
   D-xx ở các thuộc tính của SC-004.
2. **Given** cùng kịch bản ghi, **When** so body, **Then** 100% bằng sau chuẩn hóa (SC-005); lệch thật ghi R-xx.
3. **Given** dashboard tạo ở Directus app, **When** mở ở app mới, **Then** SC-002 đạt; và ngược lại.
4. **Given** recipe Q-34 đến Q-39, **When** đóng feature, **Then** design owner đã duyệt (SC-008).

### Edge Cases

- Panel có `type` không đăng ký (extension ở Directus): Directus vẽ tile với header và thân rỗng (thành phần
  `panel-<type>` không tồn tại). App vẽ header và thân rỗng, không lỗi, các panel khác bình thường; drawer panel mở
  được, lưới loại không chọn mục nào ("đã xác nhận 2026-10-18").
- Options có `{{ biến }}` không có panel biến nào khai: `applyOptionsData` giữ chuỗi hoặc thay bằng rỗng theo
  `skipUndefinedKeys` như `@directus/utils`; truy vấn có thể lỗi → tile lỗi, các panel khác bình thường.
- Panel trên collection đã xóa, field đã xóa hoặc người xem không có quyền đọc: GraphQL trả lỗi cho query đó → tile lỗi
  với chi tiết; API trả 400 cho cả tài liệu → gửi lại bỏ panel lỗi (US2-2).
- Collection hệ thống (`directus_users`, `directus_files`…) trong panel: truy vấn gửi `/graphql/system`.
- `line-chart` đọc `options.datePrecision` mà form không có field đó (đã kiểm `panels/line-chart/index.ts:28`): chỉ đặt
  được qua raw editor; app giữ cùng hành vi.
- `time-series` tính khoảng thời gian từ thời điểm mở trang (`now` lấy một lần ở `dashboard.vue:53`); auto refresh
  không dời mốc này (như Directus, ghi R-50).
- Dashboard không có panel: chế độ xem hiện lưới trống; nút sửa vẫn bấm được khi có quyền.
- Panel `width`/`height` nhỏ hơn cỡ tối thiểu (ghi qua API): vẽ theo dữ liệu; resize lần đầu kẹp về cỡ tối thiểu.
- Hai panel chồng nhau: vẽ chồng như Directus.
- `position_x`/`position_y` ≤ 0 (ghi tay): vẽ như dữ liệu; kéo một lần là về ≥ 1.
- Nhân bản dashboard lỗi (quyền tạo panel thiếu): Directus không bắt lỗi (`overview.vue:121-129`, nút giữ trạng thái
  đang chạy); app bắt lỗi, hiện hộp lỗi và trả nút về bình thường (R-49, "đã xác nhận 2026-10-18").
- Dashboard bị xóa ở app khác khi đang mở: Save → lỗi → hộp lỗi; nạp lại → màn không tìm thấy.
- Store insights nạp ở đăng nhập: dashboard tạo ở app kia sau đó chỉ thấy khi tải lại trang hoặc sau một lần ghi ở app
  này; mở thẳng URL của nó trước đó hiện màn không tìm thấy (như Directus: `refresh(pk)` chỉ nạp dữ liệu panel).
- Người không có quyền đọc `directus_panels` nhưng đọc được `directus_dashboards`: store không nạp (cần cả hai), module
  hiện danh sách rỗng như Directus.
- Chu kỳ tự làm mới đang chạy khi chuyển sang chế độ sửa: dữ liệu vẫn nạp; staging không đổi.
- Thông báo có `collection` mà người xem không còn quyền đọc: nút mở vẫn hiện; trang đích báo không có quyền (014).
- Thông báo có `item` bắt đầu bằng `/` và không có `collection`: mở đường dẫn đó trong app (FR-072).
- `message` có HTML/markdown nguy hiểm: làm sạch như `md()` của 013 (`dompurify`), không chạy script.
- Badge chưa đọc lớn (> 99): `v-badge.vue` của Directus ghi "chỉ 2 ký tự" nhưng hiện nguyên `value`; cách hiện số lớn
  chốt ở Q-38 ("đã xác nhận 2026-10-18").
- Activity của collection đã xóa: cột collection hiện tên thô; nút mở item vẫn hiện (không phải hệ thống), trang đích báo
  không tìm thấy.
- Activity `action` lạ (`run`, `comment`, `version_save`…): nhãn từ `field_options.directus_activity.<action>` hoặc khóa
  thô; không có mục sub-menu (như Directus).
- Màn 768 px: lưới dashboard cuộn hai chiều trong vùng nội dung; panel chi tiết là drawer (L-4); drawer panel và drawer
  thông báo chiếm toàn màn.
- `prefers-reduced-motion`: không hiệu ứng biểu đồ, kéo, resize.
- Chế độ tối: biểu đồ đổi màu lưới, trục, chữ theo theme (Q-35).
- Phiên hết hạn khi Save: 401 → về đăng nhập (012); staging mất (như Directus).
- Save lỗi một phần (một trong ba request `/panels` lỗi, ví dụ không có quyền tạo panel ở dashboard đích của Copy To,
  hoặc panel đã bị xóa ở app khác → 403/404): hộp lỗi, không nạp lại, staging giữ, trang về chế độ xem; Save lại gửi lại
  toàn bộ staging nên panel đã tạo lần trước bị tạo trùng (R-56, như Directus).
- Mở `/insights/<id>/<panelKey>` với `panelKey` không có trong store: drawer mở với options rỗng, lưới loại không chọn,
  Done khóa tới khi chọn loại (`panel-configuration.vue:54,148`); `stagePanelUpdate` của app bỏ qua id không có trong
  store thay vì ném lỗi ("đã xác nhận 2026-10-18").
- Người không có quyền `update` trên `directus_panels`: nút sửa khóa (`useItemPermissions('directus_panels', <id
  dashboard>)` như nguồn), nhưng route `panel-detail` không có guard (như Directus): vào URL drawer được, Done vào
  staging, Save → API 403 → hộp lỗi ("đã xác nhận 2026-10-18").
- Mention trong bình luận của dashboard: API tạo thông báo `collection directus_dashboards`, nút mở dẫn `/insights/<id>`.
- Auto Refresh khi phiên hết hạn: request 401 → luồng đăng xuất của 012 về `/login`; trang dashboard unmount dừng chu kỳ.
- Thông báo mới trong lúc drawer đang mở: không hiện tới khi mở lại; badge không đổi (R-52).
- Dashboard mở ở hai tab hoặc hai app, Save lệch nhau: ghi sau thắng theo từng panel (ba request `/panels` độc lập);
  `hydrate` sau Save hiện trạng thái DB (như Directus).
- Copy To rồi Clear Changes: bản sao sang dashboard khác cũng bị bỏ (staging chung của store, như Directus).
- Hai dashboard có panel biến cùng `field`: dùng chung một giá trị; khi nạp store, `defaultValue` của panel đứng sau theo
  thứ tự `sort dashboard` thắng (`insights.ts:125-135`); đổi biến ở dashboard này đổi luôn ở dashboard kia (như
  Directus, R-55).

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| Mọi story | — | FR-001 đến FR-006 (route, sub-menu, khung màn, store) | SC-001 |
| US1 | 1–7 | FR-010 đến FR-015 | SC-001, SC-002, SC-004, SC-005 |
| US2 | 1–6 | FR-020 đến FR-023, FR-040 đến FR-052 | SC-001, SC-002, SC-003, SC-004, SC-007 |
| US3 | 1–7 | FR-024 đến FR-032 | SC-001, SC-002, SC-005 |
| US4 | 1–4 | FR-053 đến FR-056 | SC-001, SC-003, SC-005 |
| US5 | 1–6 | FR-060 đến FR-065 | SC-001, SC-004, SC-005 |
| US6 | 1–7 | FR-070 đến FR-077 | SC-001, SC-002, SC-004, SC-005 |
| US7 | 1–2 | FR-080 đến FR-082 | SC-001 |
| US8 | 1–4 | FR-100 đến FR-114 | SC-002 đến SC-010 |

## Requirements *(mandatory)*

### Functional Requirements

**Route, sub-menu và khung màn**

- **FR-001**: Module `insights` PHẢI thay `placeholderRoutes('insights')` (012) bằng `insights-overview` (`/insights`),
  `insights-dashboard` (`/insights/:primaryKey`, `beforeEnter` gọi `refresh(pk)` của store để nạp dữ liệu panel), con
  `panel-detail` (`:panelKey`, nổi, `+` = mới); giữ `preRegisterCheck` (admin hoặc quyền đọc `directus_dashboards`
  `partial`/`full`). Dashboard không có trong store → màn không tìm thấy của module (port `not-found.vue`).
- **FR-002**: Module `activity` PHẢI thay khung bằng `activity-collection` (`/activity`) và con `activity-item`
  (`/activity/:primaryKey`, nổi); giữ `hidden` (không có mục ở sidebar module, như Directus); vào được từ link ở drawer
  thông báo, `/content/directus_activity` và URL.
- **FR-003**: `get-item-route` giữ `directus_dashboards` → `/insights`, `directus_activity` → `/activity`; nay là màn thật
  (D-72 gỡ hết, D-40 gỡ hết). `directus_notifications` không chuyển hướng (như Directus).
- **FR-004**: Sub-menu Insights PHẢI liệt kê dashboard (icon màu, tên, sắp theo tên) và nút tạo khi rỗng; sub-menu
  Activity là danh sách của FR-061. Cả hai theo sub-menu module của 012 (L-2).
- **FR-005**: Mọi màn PHẢI dùng `PageHeader`, `DetailPanel` L-4, hộp `unsaved_changes` Keep Editing trước (D-76), cách
  hiện thông báo của FR-080, hộp lỗi khi request lỗi. Trạng thái nạp: bảng dashboard `BoTable loading`; tile vòng quay;
  bảng activity theo layout 014; drawer thông báo 10 dòng skeleton khi đang nạp (như `notifications-drawer.vue:339-340`).
- **FR-006**: Store insights PHẢI port `stores/insights.ts` (`hydrate` khi đăng nhập nếu có quyền đọc cả
  `directus_dashboards` và `directus_panels`: `GET /dashboards` sort `name` và `GET /panels` sort `dashboard`, mọi
  trang, `dehydrate` khi đăng xuất, `refresh`, staging, `saveChanges`, dữ liệu
  panel, biến, nhớ 3 dashboard, `refreshIntervals`); D-45 phần insights gỡ.

**Danh sách dashboard (US1)**

- **FR-010**: Màn `/insights` PHẢI dựng bảng, tìm, trạng thái rỗng như US1-1, US1-2 từ store (không gọi API khi vào
  route).
- **FR-011**: Hộp dashboard PHẢI là port `dashboard-dialog.vue` (field, mặc định, request, điều hướng như US1-3; khi sửa
  không điều hướng; `persistent`; lỗi `POST`/`PATCH` → hộp lỗi, hộp dashboard còn mở với giá trị đã nhập như
  `dashboard-dialog.vue:62-77`).
- **FR-012**: Menu dòng và hành động hàng loạt PHẢI gated theo quyền như `overview.vue` (Edit: `update`; Delete:
  `delete`; Export hàng loạt khóa khi không `create`; Export ở menu dòng và Duplicate không gated, như nguồn) và gửi
  request như US1-4, US1-5. Lỗi: xóa một → hộp lỗi, hộp xác nhận còn (`overview.vue:176-184`); xóa hàng loạt → hộp
  lỗi, hộp xác nhận đóng, lựa chọn giữ (`:197-209`).
- **FR-013**: Xuất PHẢI mở URL `GET /dashboards?export=json` với đúng 15 field của `overview.vue:139-160` và `filter id
  _in`; tải bằng `apiFetch` + blob + lưu file như mục xuất 014 (`ExportSidebarDetail`) thay `window.open` của Directus
  (cookie phiên không đi theo ở cấu hình khác origin; cùng request, cùng file JSON; "đã xác nhận 2026-10-18", plan R2). Tên file
  theo `Content-Disposition` của API (`directus_dashboards <YYYYMMDD-HMS>.json`, `respond.ts:79-90`), fallback
  `directus_dashboards.json`; dashboard 0 panel xuất với `panels: []`.
- **FR-014**: Nhập PHẢI là port `basic-import-sidebar-detail.vue` (file `text/csv, application/json`; `POST
  /utils/import/directus_dashboards` multipart; trạng thái đang tải và đang nhập; thành công → thông báo
  `import_data_success {filename}` và `hydrate`; lỗi → `ImportErrorDialog`).
- **FR-015**: Nhân bản PHẢI gửi đúng body của `overview.vue:103-129` (dashboard và panel bỏ `id`, `date_created`,
  `user_created`; tên `"<name> (copy)"`) rồi `hydrate`; lỗi → hộp lỗi (R-49).

**Trang dashboard và workspace (US2, US3)**

- **FR-020**: Trang dashboard PHẢI vẽ tile theo US2-1 trong `PrivateView fill`; tiêu đề là tên dashboard; sidebar có
  Comments (`collection directus_dashboards`, khóa = id) và Auto Refresh (US2-5).
- **FR-021**: Trạng thái tile PHẢI như `dashboard.vue:283-323` (vòng quay khi đang nạp lần đầu; khi nạp lại thân tile
  độ mờ 50 % (`opacity-50`, như `.loading { opacity: 0.5 }` `:404-408`), vẫn tương tác được, `motion-reduce` bỏ chuyển
  tiếp; lỗi với chi tiết, gồm lỗi quyền từng phần của GraphQL; `no_data` khi dữ liệu rỗng; lỗi khi vẽ chỉ ảnh hưởng tile
  đó).
- **FR-022**: Zoom-to-fit PHẢI như `v-workspace.vue:89-99`: `scale = min((rộng − 2·padding) / rộng lưới, (cao − cao
  page header − 2·padding) / cao lưới)`, padding và cao page header đo lúc chạy từ khung 012 (Directus: 0.6875/1.375rem
  và 3.375rem), không kẹp; cập nhật khi đổi cỡ vùng nội dung; ở 768 px panel chi tiết là drawer nên vùng nội dung là cả
  chiều rộng; không lưu.
- **FR-023**: Bo góc tile PHẢI theo tile kề như `dashboard.vue:57-131`: một góc "chạm" khi điểm góc nằm trên một cạnh
  của tile khác (`pointOnLine`: tích chéo 0 và nằm trong đoạn); góc chạm bán kính 0, góc khác theo recipe Q-34.
- **FR-024**: `BoWorkspace` và `BoWorkspaceTile` (017) PHẢI được mở rộng, không viết lại: resize bằng 8 tay cầm bám
  lưới với nhãn `W×H`, `minWidth`/`minHeight` (mặc định 8×6 như `v-workspace-tile.vue:68-83`), prop `color`, `note`,
  `borderRadius`, `showHeader`, zoom-to-fit, `data-width`/`data-height` cho E2E; flows (017) không đổi hành vi
  (`resizable` mặc định tắt cho flows; test 017 giữ xanh).
- **FR-025**: Chế độ sửa PHẢI như US3-1, US3-3; vị trí và cỡ vào staging (throttle như Directus); Save khóa khi không có
  thay đổi.
- **FR-026**: Menu tile PHẢI như US3-4; Copy To... mở hộp chọn dashboard khác (mặc định dashboard khác đầu tiên; không
  có → notice `no_other_dashboards_copy`, nút Copy khóa) và gọi `stagePanelDuplicate(id, {dashboard: đích})` như
  `dashboard.vue:157-162`: bản sao là staging (id tạm, `+2/+2`), chỉ ghi khi Save của dashboard hiện tại (`POST /panels`
  với `dashboard` đích); không request ngay (plan R6, kiểm 2026-10-17).
- **FR-027**: Kéo và đổi cỡ tile PHẢI chỉ bằng chuột/pointer như Directus (owner chọn A, Clarifications 2026-10-17):
  ghi ngoại lệ a11y cho lưới dashboard (WCAG 2.1.1, gồm thao tác cảm ứng trên máy tính bảng) trong
  `design-system/qa/handoff-checklist.md` như canvas 017, tech lead duyệt trước khi đóng; không thêm field vị trí/cỡ
  hay phím mũi tên. Những gì Directus đã có bằng phím vẫn phải tới được bằng phím: nút sửa, "+", Save, Clear Changes,
  pencil và menu `more_vert` của tile (Copy To, Duplicate, Delete), drawer panel, zoom-to-fit.
- **FR-028**: Save PHẢI như US3-5 (ba request hàng loạt song song như `insights.ts:421-461`, chỉ gửi loại có thay đổi;
  `hydrate`; thoát chế độ sửa; lỗi: hộp lỗi, phần đã ghi thành công rời staging và store nạp lại, chỉ phần lỗi giữ
  trong staging, vẫn thoát chế độ sửa: D-112, khác R-56 của Directus); `Ctrl/Cmd+S` gọi
  Save cả ngoài chế độ sửa như `dashboard.vue:164-166` (khi không có thay đổi thì không request); Clear Changes và guard
  như US3-6.
- **FR-029**: Thứ tự focus: bấm sửa → nút Save; Save thành công hoặc Clear Changes → nút sửa; Done ở drawer panel →
  tile vừa tạo hoặc sửa; xóa tile → tile trước hoặc nút "+"; đóng drawer → phần tử đã mở nó.

**Drawer panel (US3)**

- **FR-030**: Drawer panel PHẢI là port `panel-configuration.vue`: `persistent`; lưới 11 loại (icon lớn của loại, tên,
  mô tả; không chép `preview.svg` của Directus, D-110) bằng `BoFancySelect` dạng lưới; đổi loại đặt lại options; Done
  khóa khi chưa chọn loại; panel có sẵn mở với giá trị hiện có.
- **FR-031**: Options của mỗi loại PHẢI dựng bằng `ExtensionOptions` (016) với `type panel` từ registry 11 loại (port
  `panels/<id>/index.ts`: `id`, `name`, `icon`, `description`, `options` mảng hoặc hàm, `minWidth`, `minHeight`,
  `query`, `variable`, `skipUndefinedKeys`), kèm nút raw editor; test so nguồn như registry operation của 017.
- **FR-032**: Nhóm header PHẢI như US3-2: các field khác khóa khi tắt Show Header; panel mới không bật sẵn header (không
  gửi `show_header`, cột mặc định false), như Directus (mốc T002 `insights-add.json`, sửa 2026-10-18).

**11 panel (US2)**

- **FR-040**: Registry panel PHẢI có đúng 11 `id` sắp theo `id`: `bar-chart`, `label`, `line-chart`, `list`, `meter`,
  `metric`, `metric-list`, `pie-chart`, `relational-variable`, `time-series`, `variable`; cỡ tối thiểu: bar-chart 12×10,
  label 6×2, line-chart 6×6, list 12×6, meter 6×6, metric-list 12×6, metric 6×2, pie-chart 10×10, relational-variable
  12×6, time-series 12×6, variable 12×6 (plan đối chiếu lại từng `index.ts`).
- **FR-041**: Dữ liệu PHẢI nạp như `insights.ts:205-315`: mỗi panel `query(options sau applyOptionsData)` → một hoặc
  nhiều `{collection, query}`; gộp thành một tài liệu GraphQL với alias `query_<hash>` (cùng cách băm), gửi `POST
  /graphql` (và `/graphql/system`); không gửi khi không có panel cần dữ liệu; panel `label`, `variable`,
  `relational-variable` không truy vấn qua đây.
- **FR-042**: `metric`: `limit 1`; aggregate theo `function` trên `field` (`count`, `countDistinct`, `avg`,
  `avgDistinct`, `sum`, `sumDistinct`, `min`, `max`), hoặc `first`/`last` đọc giá trị thô theo `sortField`; hiện số
  theo `prefix`, `suffix`, `numberStyle`, `notation`, `unit`, `minimumFractionDigits`, `maximumFractionDigits` (định
  dạng `Intl.NumberFormat` theo `locale` vue-i18n = ngôn ngữ người dùng, như `format-number.ts:133-150`),
  `conditionalFormatting` (toán tử và màu nền/chữ), căn lề, cỡ, kiểu, font. Giá trị null và chuỗi số xử lý từng panel
  như nguồn (R-53): bar-chart bỏ nhóm falsy và `Number(null)` → 0, line-chart truyền giá trị thô, pie chỉ `×100` khi có
  `decimals`, time-series `Number(null)` → 0; nhãn số của biểu đồ dùng `n()` theo cùng `locale`.
- **FR-043**: `metric-list`: nhóm theo `groupByField`, aggregate `aggregateFunction` trên `aggregateField`, sắp theo
  aggregate `sortDirection`, `limit` (mặc định 5); mỗi dòng nhãn nhóm (qua display của field) và số định dạng như metric,
  `conditionalFormatting`.
- **FR-044**: `meter`: aggregate `fn` trên `field` với `filter`; vòng đo theo `max`, `size` (full/half), `strokeWidth`,
  `roundedStroke`, `showPercentage`, `color`, `conditionalFill`.
- **FR-045**: `list`: `filter`, sort theo `sortField` hoặc khóa chính, `sortDirection` (mặc định `desc`), `limit`
  (mặc định 5); mỗi dòng theo `displayTemplate` (`RenderTemplate` 013); `linkToItem` thì bấm dòng mở `DrawerItem` (013)
  sửa tại chỗ: lưu gửi `PATCH /items/<collection>/<pk>` rồi `refresh(dashboard)` (như `panel-list.vue`, không điều hướng;
  plan R5).
- **FR-046**: `label`: `text` với `whiteSpace`, `color`, `textAlign`, `fontWeight`, `fontStyle`, `fontSize`, `font`;
  không truy vấn.
- **FR-047**: `bar-chart`: nhóm theo `xAxis`, aggregate `function` (mặc định `max`) trên `yAxis`, `filter`, `limit -1`;
  `xAxisDisplayField` thì truy vấn thứ hai lấy nhãn từ collection liên quan; `horizontal`, `decimals`, `color`,
  `showAxisLabels`, `showDataLabel`, `conditionalFill`.
- **FR-048**: `line-chart`: aggregate `aggregation` trên `yAxis`, nhóm theo `xAxis` (hoặc phần ngày theo `datePrecision`,
  Edge Cases) và `grouping` (một chuỗi mỗi giá trị nhóm), `filter`, `limit -1`; `decimals`, `color`, `min`, `max`,
  `curveType`, `fillType`, `showAxisLabels`, `showMarker`, `showLegend`.
- **FR-049**: `pie-chart`: nhóm theo `column`, aggregate `function` (mặc định `count`), `limit -1`; `donut`,
  `showLabels`, `legend`, `decimals`, `color`, `conditionalFill`.
- **FR-050**: `time-series`: nhóm theo `getGroups(precision, dateField)` (mặc định `hour`), lọc `dateField _gte
  $NOW(-<range>)` trừ `range auto` (mặc định 1 tuần; lựa chọn auto, 5/15/30 phút, 1/4 giờ, 1/2 ngày, 1 tuần, 1/3 tháng),
  aggregate `function` trên `valueField`, `limit -1`; `missingData` (`ignore`/`null`/`0`), `decimals`, `min`, `max`,
  `curveType`, `fillType`, `showXAxis`, `showYAxis`, `color`. Múi giờ: trình duyệt (không dùng setting của user); chỉ
  field kiểu `timestamp` trừ offset hiện tại của trình duyệt (`panel-time-series.vue:169,360`); API nhóm `timestamp`
  theo UTC; trục `datetimeUTC: false`, tooltip `d(…, 'long')`.
- **FR-051**: `variable`: hiện interface `inter` với `options` (013) cho `field` kiểu `type`, mặc định `defaultValue`;
  đổi giá trị gọi `setVariable` (US4).
- **FR-052**: `relational-variable`: chọn item của `collection` qua drawer chọn item 013 (`multiple`, `limit`, `filter`),
  hiện theo `displayTemplate`; nạp item đã chọn bằng `GET /items/:collection` lọc khóa `_in` (lỗi → hộp lỗi; khóa không
  còn thì không hiện và bị bỏ khi người dùng bỏ chọn, `use-display-items.ts:49-66`); vượt `limit` → báo lỗi và giữ `limit`
  khóa đầu (lựa chọn mới đứng trước, `panel-relational-variable.vue:47-55`); nút thêm ẩn khi đủ `limit` (mặc định 5).

**Biến dashboard (US4)**

- **FR-053**: `applyOptionsData` PHẢI dùng bản của `@directus/utils` đã cài (013) với `skipUndefinedKeys` của loại;
  không viết lại; test port `apply-options-data.test.ts` của Directus chạy với bản đã cài. Giá trị biến chèn vào object
  options (không vào chuỗi GraphQL); tài liệu dựng bằng `jsonToGraphQLQuery` (escape chuỗi); quyền đọc vẫn do API.
- **FR-054**: `setVariable` PHẢI chỉ nạp lại panel có `{{ <field> }}` trong options JSON và truy vấn đã đổi (so truy
  vấn cũ/mới như `insights.ts:467-499`), gộp trong một request. Panel không truy vấn (label, `displayTemplate` của list,
  variable) nhận options sau `applyOptionsData` qua computed của trang nên hiển thị đổi ngay, không request.
- **FR-055**: Biến khởi tạo từ `defaultValue` của panel `variable: true` khi nạp store; không lưu qua tải lại trang.
- **FR-056**: Biến quan hệ rỗng PHẢI làm panel dùng nó nhận `{}` và không truy vấn (như `insights.ts:186-220`).

**Activity (US5)**

- **FR-060**: Màn `/activity` PHẢI dùng `use-preset('directus_activity')` và layout wrapper 014 với `show-select none`,
  preset mặc định như US5-1, `SearchInput`, mục layout ở panel chi tiết, trạng thái rỗng `no_results`/`no_items`.
- **FR-061**: Sub-menu PHẢI như US5-2; lọc của mục đi vào `filter-system` (không vào preset, không hiện ở UI lọc);
  mục active lưu theo URL query hoặc trạng thái như Directus (plan đọc lại `navigation.vue`).
- **FR-062**: Cột dùng display từ metadata field `directus_activity` (`labels` có màu cho action, `collection` có icon,
  `datetime relative` cho timestamp, `user`). Màu nhãn action đến từ metadata (`foreground`/`background` là biến CSS
  của Directus: `var(--theme--primary)`, `var(--blue)`, `var(--theme--danger)`, `var(--purple)` và bản `-subdued`/`-25`,
  `system-data/src/fields/activity.yaml:13-29`); `apps/web` chưa định nghĩa các biến này (kiểm 2026-10-17) nên hiện
  không có màu. Cách ánh xạ sang token là câu hỏi mở Q-36 (không tự chọn, XII).
- **FR-063**: Drawer `/activity/:id` PHẢI như US5-4 (`GET /activity/:pk` với fields `user.id, user.email,
  user.first_name, user.last_name, action, timestamp, ip, user_agent, origin, collection, item`); `user` null → hàng User
  rỗng (`item.vue:111-116`); lỗi → `BoNotice danger` với thông điệp đã dịch (`translateAPIError` như 014; Directus in
  object lỗi thô, "đã xác nhận 2026-10-18").
- **FR-064**: Không có ghi trên Activity (API không cho, `COLLECTIONS_DENY_LIST`); không ô chọn, không xóa.
- **FR-065**: `/content/directus_activity(/:pk)` chuyển như US5-6.

**Thông báo (US6)**

- **FR-070**: Chuông PHẢI ở header TailAdmin (thay ghi chú D-45 ở `AppHeader.vue`), badge số chưa đọc từ store
  notifications (012, `refreshUnreadCount` đếm `inbox` của mình); nhãn truy cập `notifications` kèm số; vùng
  `aria-live="polite"` sr-only báo số chưa đọc khi số đổi (Directus không có, "đã xác nhận 2026-10-18"); Q-38. Phiên share không
  vào khung private nên không có chuông (store bỏ qua user share, như Directus).
- **FR-071**: Drawer thông báo PHẢI là port `notifications-drawer.vue` như US6-2 đến US6-6; nạp khi mở, không làm mới
  khi đang mở (thông báo mới chỉ thấy khi mở lại); phân trang 25. Lỗi: Directus không bắt lỗi Archive/Unarchive và lỗi
  nạp danh sách, Delete chỉ `try/finally` (`:180-210`); app thêm hộp lỗi cho cả ba (R-57), phần còn lại như nguồn
  (Archive lỗi: lựa chọn giữ; Delete lỗi: lựa chọn bỏ, hộp xác nhận đóng).
- **FR-072**: Đích của nút mở PHẢI như `notifications-drawer.vue:105-126` (singleton theo
  `collectionsStore.getCollection(collection)?.meta?.singleton`): có `collection` và (collection singleton hoặc
  không có `item`) → route collection; có `collection` và `item` → `get-item-route`; không `collection` và `item` bắt đầu
  bằng `/` → đường dẫn đó; khác → không có nút.
- **FR-073**: `refreshUnreadCount` PHẢI chạy khi hydrate, sau archive/unarchive/xóa, sau chạy flow thủ công (014); không
  thăm dò định kỳ và không WebSocket (như Directus 11.17.4; D-41). Thông báo mới đến từ người khác chỉ thấy sau một
  trong các lúc trên hoặc tải lại (R-52).
- **FR-074**: `message` PHẢI hiện markdown đã làm sạch như `utils/md.ts:13-30` Directus (`marked` + DOMPurify, `ADD_ATTR
  ['target']`, link mặc định `target="_self"`, `_blank` thêm `rel="noopener noreferrer"`); `md()` 013 kiểm cùng cấu hình
  (T001); `subject` tô từ khóa tìm (chữ thuần). Link do API ghi trong `message` của mention (`/admin/content/<collection>/
  <item>`, `comments.ts:134-136`) chuyển hướng qua `checkForSystem` (FR-003).
- **FR-075**: Link "Activity" trong drawer tới `/activity` và đóng drawer.
- **FR-076**: Drawer thông báo KHÔNG có danh sách upload TUS dở, giống Directus 11.17.4 (owner chọn A, Clarifications
  2026-10-17): Directus chỉ phát `tusResumableUploadsChanged` mà không có nơi nghe (`events.ts:9`,
  `utils/upload-file.ts:54-98`, đã kiểm 2026-10-17). D-90 (015) gỡ vì không còn là khác biệt; `utils/upload-file.ts`
  giữ việc tiếp tục upload dở khi chọn lại cùng file (015 FR-022), không phát sự kiện.
- **FR-077**: Store app PHẢI có `notificationsDrawerOpen` (gỡ ghi chú hoãn ở `stores/app.ts`); drawer gắn một lần ở
  khung app.

**Thông báo thành công/lỗi toàn app (US7)**

- **FR-080**: `notify` PHẢI giữ notice tại chỗ dưới page header (`NoticeStack` 012, recipe Q-8) cho mọi màn, gồm màn
  mới của 018; không port snackbar `notifications-group.vue` (owner chọn A, Clarifications 2026-10-17). D-66 (013) giữ,
  phạm vi mở rộng sang 018; các màn 013–017 không đổi.
- **FR-081**: `showUnexpectedError` (012, `use-notices`) PHẢI hiện hộp lỗi như `notification-dialogs.vue` (tiêu đề
  `errors.<code>` hoặc `unexpected_error`, chi tiết, Dismiss); không có nút "Report error" (D-109). Màn mới của 018 chỉ
  dùng `showUnexpectedError`; `utils/unexpected-error.ts` (console + trả lỗi để hiện tại chỗ, 13 nơi gọi ở 012–017) giữ
  nguyên, không nối vào hộp lỗi (owner chọn B, Clarifications 2026-10-17).
- **FR-082**: API `notify(options)` giữ dạng `SnackbarRaw` của Directus (`title`, `text`, `type`
  `info|success|warning|error`, `persist`, `closeable`, `dialog`, `error`…) để các màn đã port không đổi lời gọi.

**Đối chiếu, kiểm thử, chất lượng (US8)**

- **FR-100**: E2E `insights-overview.spec.ts`, `insights-dashboard.spec.ts`, `insights-edit.spec.ts`,
  `insights-variables.spec.ts`, `activity.spec.ts`, `notifications.spec.ts` PHẢI chạy chromium 768/1280 ở ba cấu hình
  như 014–017; `insights-edit` chạy thêm firefox-1280 và webkit-1280 ở cùng origin (kéo, resize); spec điều khiển
  Directus app (`insights-cross-use.spec.ts`, `insights-parity-ui.spec.ts`, `payload/*`) chỉ chromium-1280 ở `proxy-api`
  (`DIRECTUS_APP_SPECS`); thời gian job `e2e-web` ghi lại ở mỗi lượt, vượt 100 phút thì tách shard như 016; E2E tạo dashboard và thông báo tạm tên
  `web-e2e-<cfg>-<spec>-<n>`, xóa ở `afterAll`; kéo thả theo bài học 017 (`moveAndRelease`, `settleFrames` ở
  `apps/web-e2e/src/helpers/flows.ts`).
- **FR-101**: Bộ so payload `apps/web-e2e/src/payload/{insights,activity,notifications}.spec.ts` PHẢI so body ghi
  (`POST`/`PATCH`/`DELETE /dashboards`, `/panels`, `PATCH`/`DELETE /notifications`, `POST /utils/import/...`) và request
  đọc (`POST /graphql` của dashboard, `GET /activity`, `GET /notifications`, đếm chưa đọc) với Directus app cùng kịch
  bản sau chuẩn hóa (id, id tạm, thời gian; GraphQL so theo AST sau chuẩn hóa alias; query REST so theo nghĩa bằng
  `canonicalPath` như 017 vì SDK và axios khác dạng `fields=`/`fields[]=`); bộ so DB thêm
  `directus_dashboards`, `directus_panels`, `directus_notifications`.
- **FR-102**: Kịch bản dùng chéo PHẢI có trong E2E ở `proxy-api`: (a) `bo_dash_all` seed qua Directus REST → mở ở app
  mới, so như SC-002; (b) dashboard + 2 panel tạo và sắp ở app mới (US3 Independent Test) → mở trên Directus app 8155,
  so vị trí, cỡ, header, giá trị; sửa trên Directus app (thêm panel, đổi cỡ) → nạp lại app mới thấy đúng; (c) thông báo
  lưu trữ ở một app thấy ở Archive của app kia; (d) đổi biến dashboard ở hai app cho cùng giá trị panel.
- **FR-103**: Bộ mẫu `bo_insights` PHẢI seed qua Directus REST (`apps/web/fixtures/interfaces` thêm
  `dashboards.json`, `panels.json`, `notifications.json`; snapshot commit; parity `fixtures-seed.test.ts` mở rộng):
  collection riêng `bo_insights_data` (chỉ seed ghi, không E2E nào ghi; `status`, `category`, `amount` decimal, `qty`
  integer, `happened_at` dateTime cố định, `owner` m2o `directus_users` với 2 user cố định) để số liệu không đổi theo E2E
  khác; `bo_dash_all` (11 panel, mỗi loại một, trên `bo_insights_data`, có `conditionalFormatting`/`conditionalFill` ở
  metric, metric-list, bar-chart; time-series dùng `range auto` để không phụ thuộc giờ chạy), `bo_dash_vars` (US4),
  `bo_dash_system` (metric trên `directus_users`, list trên `directus_files`), `bo_dash_empty` (0 panel),
  `bo_dash_unknown` (1 panel loại lạ `bo-unknown`); 3 thông báo cho admin (FR-072 ba dạng đích) chỉ dùng cho dev và
  parity UI; E2E thông báo dùng user tạm của `Fixtures` (014–016) làm `recipient`, tạo 3 thông báo ở `beforeAll`, xóa ở
  `afterAll`, không dựa số chưa đọc của admin.
- **FR-104**: Test component với mock API (allowlist như 013): registry 11 panel (so nguồn options, cỡ tối thiểu,
  `query` với options mẫu), gộp truy vấn GraphQL (mốc ghi tay từ Directus app), `setVariable`, staging/Save (8 kịch bản:
  thêm, sửa, kéo, đổi cỡ, nhân bản, xóa, chép sang, Save rỗng), `BoWorkspaceTile` resize, drawer thông báo (đích, tab,
  chọn, archive), Activity (lọc hệ thống), thông báo của FR-080.
- **FR-105**: Hiển thị biểu đồ PHẢI cho cùng dữ liệu với Directus (chuỗi, nhãn, giá trị, kiểu đường, chú giải), so bằng
  dữ liệu đã đưa vào biểu đồ, không so pixel: phía Backoffice đọc bảng ẩn của FR-106 (giá trị số sau biến đổi của
  panel, trước định dạng: bar `Number(toFixed)`, pie giá trị gốc, line/time-series giá trị chuỗi); phía Directus là cùng
  biến đổi áp lên response GraphQL của Directus app (mốc T002); so thứ tự hạng mục, tên chuỗi, số chuỗi và giá trị từng
  điểm (sai số 0 sau làm tròn `decimals`); màu theo D-108 và Q-35.
- **FR-106**: A11y: tile là `role="region"` với `aria-label` = `name` hoặc tên loại (khi tắt header hay không tên),
  `<caption>` của bảng sr-only dùng cùng nhãn; icon ghi chú (`note`) là nút icon có `aria-label` = note và tooltip mở khi
  focus (Directus là `<span>` chỉ mở khi rê chuột, `v-workspace-tile.vue:292`; "đã xác nhận 2026-10-18"); chuỗi biểu đồ phân biệt
  không chỉ bằng màu nhờ chú giải, tooltip và bảng sr-only có tên chuỗi (không thêm nét đứt), tương phản màu chuỗi với
  nền ≥ 3:1 (Q-35); mỗi tile biểu đồ (bar, line, pie, time series, meter)
  có bảng ẩn `sr-only` sinh từ cùng dữ liệu đưa vào biểu đồ (nhãn trục, tên chuỗi, giá trị; owner chọn A, Clarifications
  2026-10-17), biểu đồ vẽ là `aria-hidden`; badge chuông có nhãn truy cập; drawer có focus trap, Esc, trả focus; mục
  active của sub-menu có `aria-current`; kéo/đổi cỡ chỉ bằng chuột (ngoại lệ FR-027); axe 0 vi phạm serious/critical ở `/insights`, trang
  dashboard (hai chế độ), drawer panel (3 loại: metric, time-series, variable), `/activity`, drawer activity, drawer
  thông báo (hai tab), ở sáng và tối (SC-008); màu panel do người dùng chọn (`color` trong dữ liệu) là dữ liệu, không
  tính là màu thô.
- **FR-107**: Recipe design-system Q-34 đến Q-39 PHẢI viết nháp vào `design-system/docs/component-specs.md` và
  `layout-patterns.md` (mục "Tier 3 recipes (018)") trước khi code màn tương ứng; nhãn field và nhãn lựa chọn theo
  recipe đã đổi ở 017 (commit 21ae3e9); design owner duyệt trước khi đóng.
- **FR-108**: Hiệu năng (ngân sách nhân `machineFactor()`, trung vị 3 lần, chromium, `PERF=1`): `bo_dash_all` vẽ đủ 11
  tile có dữ liệu dưới 1500 ms tính từ lúc vào route tới khi tile cuối vẽ xong, với API giả lập trả ngay (browser
  test); đổi biến → panel liên quan cập nhật dưới 500 ms sau khi response về; kéo/resize: mỗi `pointermove` xử lý dưới
  16 ms với 20 tile; drawer thông báo 25 dòng vẽ dưới 300 ms sau khi response về; số request: mở dashboard = 1 `POST
  /graphql` (+1 `/graphql/system` khi có panel hệ thống) và 1 `GET /comments` đếm bình luận của sidebar, 0 request
  dashboard/panel (store); mở `/insights` = 0; mở drawer thông báo = 1 `GET /notifications` danh sách + 1 đếm
  `aggregate[countDistinct]=id` của `useItems` (đếm #26 chỉ chạy sau ghi), như Directus (mốc T002, T114 2026-10-18). Thời gian với API thật phụ thuộc API (benchmark BE đã có) và ngoài phạm vi FR-108; E2E chỉ đếm request.
- **FR-109**: Bundle: module Insights, registry panel và thư viện biểu đồ là chunk lười; chunk chính ≤ ngân sách 017 +
  15 KB gzip (chuông, drawer thông báo, cách hiện FR-080); chunk lười gzip: route Insights ≤ 60 KB, component panel ≤
  40 KB, `apexcharts` ≤ 170 KB (đo ở T050: 152,0 KB), `NotificationsDrawer` ≤ 15 KB; đo bằng
  `scripts/check-bundle.mjs` trong job `quality`; vượt → CI đỏ, sửa bằng nạp lười theo loại panel (không đổi thư viện).
- **FR-110**: Không request ngoài danh sách FR-013, FR-014, FR-015, FR-028, FR-041, FR-052, FR-063, FR-071 và danh sách
  012–017 (`allowed-paths.ts`, `KNOWN_REQUESTS`); 0 request ra ngoài.
- **FR-111**: Không sửa file trong `directus/`; không sửa `apps/api` trừ khi so payload phát hiện lệch với Directus (khi
  đó thêm task sửa API kèm parity 010/011).
- **FR-112**: Chia lượt commit: lượt 1 route, danh sách dashboard, store, xem dashboard với 11 panel (US1, US2); lượt 2
  chế độ sửa, workspace resize/zoom, drawer panel, biến (US3, US4); lượt 3 Activity, chuông, drawer thông báo, FR-080
  (US5, US6, US7); lượt 4 bộ so payload, DB, dùng chéo, parity UI, perf, bundle, a11y, recipe (US8); mỗi lượt commit lên
  `main` với CI xanh, phối hợp push với phiên chung checkout.
- **FR-113**: Thư viện mới: chỉ thư viện biểu đồ mà Directus dùng (plan chốt tên và bản, kiểm advisory bảo mật và giấy
  phép); không thêm thư viện grid/dashboard (workspace 017 mở rộng).
- **FR-114**: Tài liệu: spec 012 (D-40, D-45 ghi "đã gỡ ở 018"), 013 (D-66 giữ, ghi "xét lại ở 018: giữ"), 014 (D-72 phần
  còn lại), 015 (D-90 "đã gỡ ở 018: Directus không có danh sách"); `CLAUDE.md` Active Technologies thêm dòng 018; `graphify update .` sau mỗi lượt; D-107 đến D-110,
  R-49 đến R-57 được tech lead duyệt trước khi đóng.

### Key Entities *(include if feature involves data)*

- **Dashboard** (`directus_dashboards`): `id` (uuid), `name`, `icon` (mặc định `dashboard`), `color`, `note`,
  `date_created`, `user_created`; o2m `panels`.
- **Panel** (`directus_panels`): `id`, `dashboard`, `name`, `icon`, `color`, `show_header`, `note`, `type` (một trong
  11 id hoặc extension), `position_x`, `position_y`, `width`, `height` (ô lưới 18 px), `options` (JSON theo loại),
  `date_created`, `user_created`. Id tạm `_<nanoid>` chỉ ở client.
- **Panel definition** (client, port `panels/<id>/index.ts`): `id`, `name`, `icon`, `description`, `options`
  (mảng hoặc hàm), `minWidth`, `minHeight`, `query(options)`, `variable`, `skipUndefinedKeys`.
- **Dashboard variable** (client): khóa `field` của panel `variable`/`relational-variable`; một object `variables`
  dùng chung cho mọi dashboard (không tách theo dashboard, như `stores/insights.ts:41` Directus); mặc định
  `defaultValue`; không lưu.
- **Activity** (`directus_activity`): `id`, `action`, `user`, `timestamp`, `ip`, `user_agent`, `origin`, `collection`,
  `item`, o2m `revisions`; chỉ đọc.
- **Notification** (`directus_notifications`): `id`, `status` (`inbox`/`archived`), `timestamp`, `recipient`,
  `sender`, `subject`, `message` (markdown, có thể null), `collection`, `item`; quyền tối thiểu: đọc của mình, sửa
  `status`.
- **Snackbar / notice** (client, `SnackbarRaw`): `id`, `title`, `text`, `type`, `persist`, `closeable`, `dialog`,
  `error`, `loading`, `progress`.

## Khác biệt so với Directus *(mandatory)*

Mã tiếp theo sau D-106 (017): D-107 đến D-110. D-39, D-41, D-43, D-45 (phần còn lại), D-47, D-49, D-52, D-54, D-68, D-76, D-82, D-99,
D-101 áp dụng cho mọi màn của 018, không lặp. Gỡ ở 018: D-40 (Insights, Activity), D-45 (insights, drawer thông báo),
D-72 (`directus_dashboards`, `directus_activity`), D-90 (015; Directus không có danh sách upload, FR-076). D-66 (013)
giữ và áp cho màn mới của 018 (FR-080).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|------|
| D-107 | Vị trí chuông thông báo | Thanh module, cạnh avatar | Header TailAdmin (nút chuông có badge) | Khung 012 (D-52), mẫu header TailAdmin | khác | — |
| D-108 | Màu mặc định của panel và biểu đồ khi `color` null | `--theme--primary` và bảng màu của theme Directus | Token theme (`brand-*` và bảng màu biểu đồ của Q-35); `color` đã lưu vẫn dùng nguyên | Nguyên tắc XII; `--theme--primary` → `--color-brand-500` là ánh xạ có sẵn của 012 (constitution XII, override map), không phải chọn mới; Q-35 chỉ chốt bảng màu chuỗi sinh ra và màu trục/lưới | khác | — |
| D-109 | Nút "Report error" trong hộp lỗi (admin, mã `UNKNOWN`) | Mở link báo lỗi lên GitHub của Directus | Không có | Nguyên tắc IX (không dẫn người dùng Backoffice tới Directus) | đổi thương hiệu | — |
| D-110 | Ảnh xem trước của loại panel trong drawer chọn loại | `preview.svg` của mỗi loại (`panel-configuration.vue:162-170`), icon khi không có | Luôn icon lớn của loại, tên, mô tả (nhánh rơi về icon của Directus); không chép tài sản SVG | Không chép tài sản của Directus app; ảnh theo theme Directus, không theo design-system (Nguyên tắc XII); owner chọn B (Clarifications 2026-10-17) | khác | — |
| D-111 | Panel trên collection người xem không đọc được | Lỗi trang `Cannot read properties of null (reading 'field')` ở `query-to-gql-string.ts` (`formatQuery`), hoặc tile `no_data` khi `query()` của panel tự trả rỗng | Chỉ tile đó hiện lỗi `FORBIDDEN` (thông điệp và mã); các tile khác nạp bình thường | Một panel không làm hỏng cả dashboard; chủ dự án chọn 2026-10-18 (T113) | khác | — |
| D-112 | Save lỗi một phần | Ba request song song; một lỗi thì giữ mọi staging, Save lại tạo trùng các panel đã tạo (R-56) | Phần thành công rời staging, store nạp lại; chỉ phần lỗi còn staging cho lần Save sau | Tránh tạo trùng dữ liệu; chủ dự án 2026-10-18 | khác | — |
| D-113 | Toán tử định dạng có điều kiện | `<=` so như `<` (metric, metric list, meter, bar chart); `contains`, `starts_with`, `ends_with`… của bar chart so ngược (giá trị luật chứa nhãn) (R-53) | `<=` gồm cả giá trị bằng; nhãn chứa / bắt đầu / kết thúc bằng giá trị luật | Đúng nghĩa toán tử; màu ở biên khác Directus với cùng dữ liệu; chủ dự án 2026-10-18 | khác | — |
| D-114 | Mốc `now` của time series | Lấy một lần khi mở trang, auto refresh không dời cửa sổ (R-50) | Mỗi lần refresh (auto, sidebar, đổi dashboard) lấy `now` mới | Dashboard treo màn hình hiện số liệu mới; chủ dự án 2026-10-18 | khác | — |
| D-115 | Số đếm của drawer thông báo | `useItems` nhớ số đếm theo truy vấn: sau Archive/Delete tab có thể báo sai số hoặc "No Notifications" dù còn dòng | Đếm lại sau mỗi lần ghi (xóa bộ nhớ đếm của `useItems`) | Số và trạng thái rỗng đúng; thêm request đếm sau ghi; chủ dự án 2026-10-18 | khác | — |
| D-116 | Số chưa đọc của chuông | Không tự cập nhật (R-52) | Đếm lại khi tab trình duyệt hiện lại, tối đa một lần mỗi phút (không thăm dò) | Thấy thông báo mới khi quay lại tab; chủ dự án 2026-10-18 | khác | — |

**Đã xác nhận** (chủ dự án 2026-10-18, SC-010; trước đó ghi "Cần xác nhận"):

- Panel loại lạ hiện thân rỗng (Edge Cases).
- Cách hiện số chưa đọc lớn (> 99): badge `99+`, số đủ trong `aria-label` (Q-38).
- Nhân bản dashboard có bắt lỗi (R-49).
- RTL của `v-workspace-tile` (lật tọa độ kéo/resize) không port, như 017.
- Xuất dashboard tải bằng `apiFetch` + blob thay `window.open` (cùng request, cùng file; FR-013).
- `v-workspace-tile` của Directus chỉ gỡ listener `pointerup` sau một sửa đổi khác rỗng; app luôn gỡ (017 đã làm; không
  ảnh hưởng dữ liệu).
- Lỗi hộp lỗi và notice: `utils/unexpected-error.ts` giữ console (Clarifications Q2).
- Export ở menu dòng không gated theo quyền, Export ở header khóa khi không `create` (như `overview.vue:229-236`).
- `stagePanelUpdate` bỏ qua id không có trong store (Directus có thể ném lỗi).
- Route `panel-detail` không guard quyền; `Ctrl/Cmd+S` gọi Save cả ngoài chế độ sửa (như Directus).
- Drawer activity in thông điệp lỗi đã dịch thay object lỗi thô.
- Icon ghi chú của tile là nút tới được bằng phím, tooltip mở khi focus (Directus chỉ rê chuột).
- Vùng `aria-live` báo số chưa đọc (Directus không có).
- Drawer activity hiện khóa thô của action chưa dịch (Directus để trống).
- Bấm sửa dashboard đưa focus tới "+" khi Save còn khóa (FR-029; Save khóa khi chưa có thay đổi, như Directus).
- (Thay bởi D-115, 2026-10-18) ~~Drawer thông báo nhớ số đếm của `useItems` như Directus.~~

| Mã | Rủi ro | Nguồn và bằng chứng | Ảnh hưởng | Duyệt |
|----|--------|---------------------|-----------|-------|
| R-49 | Nhân bản dashboard không bắt lỗi, nút kẹt trạng thái đang chạy | `overview.vue:121-129` Directus | App bắt lỗi (hộp lỗi); hành vi thành công giữ nguyên | Duyệt (tech lead, 2026-10-18) |
| R-50 | Mốc `now` của time-series lấy một lần khi mở trang, auto refresh không dời | `dashboard.vue:53` Directus | Dữ liệu mới vẫn vào, nhưng cửa sổ thời gian không trượt tới khi tải lại; tái tạo | Thay bởi D-114 (owner, 2026-10-18) |
| R-51 | Xóa panel không hộp xác nhận | `dashboard.vue`, `insights.ts` Directus | Chỉ staging, Clear Changes khôi phục; tái tạo | Duyệt (tech lead, 2026-10-18) |
| R-52 | Số chưa đọc không tự cập nhật khi người khác gửi thông báo | `stores/notifications.ts:20-55` Directus (không thăm dò, không WebSocket) | Người dùng thấy số cũ tới khi có thao tác làm mới hoặc tải lại; tái tạo (D-41) | Thay bởi D-116 (owner, 2026-10-18) |
| R-53 | Toán tử định dạng có điều kiện: `<=` xử lý như `<` ở metric, metric-list, meter, bar-chart; `contains`/`starts_with`… của bar-chart so ngược chiều (`giá trị so sánh.includes(giá trị)`); metric lấy luật khớp cuối, meter lấy luật đầu | `panel-metric.vue:197`, `panel-meter.vue:127`, `panel-bar-chart.vue:329-332` Directus (plan R5, 2026-10-17) | Màu có điều kiện sai ở biên; chép nguyên để hai app hiện giống nhau với cùng dữ liệu; tái tạo | Thay bởi D-113 (owner, 2026-10-18) |
| R-54 | Đổi cỡ tile từ cạnh trên/trái vẫn dời `x`/`y` khi cỡ đã chạm tối thiểu (tile trôi) | `v-workspace-tile.vue:215-221` Directus | Vị trí ghi ra khác ý người dùng ở biên; chép nguyên để `position_x/y` ghi ra bằng Directus với cùng thao tác (SC-002); tái tạo | Duyệt (tech lead, 2026-10-18) |
| R-55 | Biến dashboard dùng chung theo `field` cho mọi dashboard; `defaultValue` trùng `field` thì panel sau thắng | `stores/insights.ts:41,125-135,467-499` Directus (kiểm 2026-10-17, /speckit.analyze F1) | Hai dashboard cùng tên biến ảnh hưởng lẫn nhau; tái tạo; bộ mẫu dùng tên biến riêng cho mỗi dashboard (data-model §12) | Duyệt (tech lead, 2026-10-18) |
| R-56 | Save lỗi một phần: ba request `/panels` song song, một lỗi thì không `hydrate`, staging giữ nhưng trang về chế độ xem; Save lại gửi lại toàn bộ staging → panel đã tạo lần trước bị tạo trùng | `stores/insights.ts:421-461`, `dashboard.vue:168-171` Directus (release-gate CHK001) | Panel trùng sau khi Save lại; người dùng xóa tay; tái tạo như Directus | Thay bởi D-112 (owner, 2026-10-18) |
| R-57 | Drawer thông báo không bắt lỗi Archive/Unarchive và lỗi nạp danh sách; Delete chỉ `try/finally` | `notifications-drawer.vue:180-210` Directus (release-gate CHK003) | App thêm hộp lỗi (như R-49), hành vi thành công và trạng thái lựa chọn giữ như nguồn | Duyệt (tech lead, 2026-10-18) |

**Trạng thái khác biệt (T122, lượt 4, 2026-10-18; tech lead duyệt cả bảng 2026-10-18, SC-010)**:

| Mã | Đã làm trong code | Duyệt |
|----|-------------------|-------|
| D-107 | `src/layout/NotificationsBell.vue` trong `src/layout/AppHeader.vue` trước `UserMenu` (badge `bg-error-600`, `99+`, `aria-live`); `NotificationsBell.test.ts`, E2E `notifications.spec.ts` | Duyệt (tech lead, 2026-10-18) |
| D-108 | `src/panels/shared/apex-charts.ts` (`THEME`), `src/styles/apexcharts.css` (`--chart-*`, biến thể `.dark`), `src/panels/pie-chart/index.ts` (`cssVar('--color-brand-500')`); `color` đã lưu dùng nguyên; `panels/charts.browser.test.ts` | Duyệt (tech lead, 2026-10-18) |
| D-109 | `src/components/NoticeStack.vue`: hộp lỗi chỉ có Dismiss (`NoticeStack.test.ts`, E2E `notifications.spec.ts` lỗi Save 500) | Duyệt (tech lead, 2026-10-18) |
| D-110 | `src/panels/<id>/index.ts` không chép `preview`; `routes/PanelConfiguration.vue` lưới `BoFancySelect layout="grid"` icon, tên, mô tả (`panel-configuration.test.ts`) | Duyệt (tech lead, 2026-10-18) |
| D-111 | `stores/insights.ts` `loadPanelData`: collection của panel (theo `query()` hoặc `options.collection`) không có trong store fields → `errors[panel]` mã `FORBIDDEN`, panel bỏ khỏi tài liệu GraphQL (`insights.test.ts`) | Duyệt (owner, 2026-10-18) |
| D-112 | `stores/insights.ts` `saveChanges` (`Promise.allSettled`; `insights.test.ts`) | Duyệt (owner, 2026-10-18) |
| D-113 | `panels/metric`, `metric-list`, `meter`, `bar-chart` (`<=` gồm bằng; toán tử chuỗi của bar chart theo nhãn); `values.browser.test.ts`, `charts.browser.test.ts` | Duyệt (owner, 2026-10-18) |
| D-114 | `routes/DashboardRoute.vue` `now` là ref, `refreshDashboard()` lấy mốc mới (`dashboard.test.ts`) | Duyệt (owner, 2026-10-18) |
| D-115 | `composables/use-items.ts` `clearCountCache`; `components/NotificationsDrawer.vue` `refresh()` (`NotificationsDrawer.test.ts`) | Duyệt (owner, 2026-10-18) |
| D-116 | `layout/NotificationsBell.vue` (`visibilitychange`, throttle 60 s; `NotificationsBell.test.ts`) | Duyệt (owner, 2026-10-18) |
| R-49 | `routes/InsightsOverviewRoute.vue` duplicate có `try/catch` → `showUnexpectedError`, nút về bình thường (`overview.test.ts`) | Duyệt (tech lead, 2026-10-18) |
| R-50 | `routes/DashboardRoute.vue` `now = new Date()` một lần mỗi trang, như `dashboard.vue:53` | Thay bởi D-114 (owner, 2026-10-18) |
| R-51 | `stores/insights.ts` `stagePanelDelete` không hộp; `DashboardRoute.vue` `deletePanel` chỉ chuyển focus (`dashboard.test.ts`) | Duyệt (tech lead, 2026-10-18) |
| R-52 | `stores/notifications.ts` không thăm dò; số chưa đọc làm mới sau ghi của drawer và chạy flow thủ công | Thay bởi D-116 (owner, 2026-10-18) |
| R-53 | `panels/metric`, `metric-list`, `meter`, `bar-chart` chép nguyên phép so (`<=` như `<`, `contains` ngược của bar-chart); `panels/values.browser.test.ts` | Thay bởi D-113 (owner, 2026-10-18) |
| R-54 | `components/workspace/BoWorkspaceTile.vue` `onPointerMove` như `v-workspace-tile.vue:215-221` (`BoWorkspaceTile.browser.test.ts` ca R-54) | Duyệt (tech lead, 2026-10-18) |
| R-55 | `stores/insights.ts` `variables` theo `field`, `defaultValue` của panel sau thắng (`insights.test.ts`) | Duyệt (tech lead, 2026-10-18) |
| R-56 | `stores/insights.ts` `saveChanges`: ba request song song, lỗi thì không `hydrate`, staging giữ, `DashboardRoute` vẫn thoát chế độ sửa (`insights.test.ts`, `dashboard.test.ts`) | Thay bởi D-112 (owner, 2026-10-18) |
| R-57 | `components/NotificationsDrawer.vue` bắt lỗi nạp, Archive/Unarchive, Delete → `showUnexpectedError`; Archive lỗi giữ lựa chọn, Delete lỗi bỏ lựa chọn và đóng hộp (`NotificationsDrawer.test.ts`) | Duyệt (tech lead, 2026-10-18) |
| Ngoại lệ a11y lưới dashboard | Kéo tile và 8 tay cầm chỉ bằng chuột như Directus (`design-system/qa/handoff-checklist.md`); lưới là `role="region"` nhận focus; axe sáng/tối sạch ở các màn 018 (`a11y.spec.ts` khối 018) | Duyệt (tech lead, 2026-10-18) |
| Đã xác nhận | Các mục ở danh sách "Đã xác nhận" trên | Duyệt (owner, 2026-10-18) |

## Câu hỏi mở về design-system (Nguyên tắc XII)

Như 014–017: recipe nháp vào `design-system/docs/` trước khi code, design owner duyệt trước khi đóng 018. Q-2 (bảng),
Q-3 (lưới thẻ), Q-7 (tìm và lọc), Q-8 (page header, notice), Q-9 (panel), Q-22 (drawer tab dọc), Q-28 (lớp phủ),
Q-29/Q-30 (lưới và tile của canvas 017) dùng lại. Design-system chưa có mẫu cho biểu đồ, thẻ metric, lưới dashboard, nội
dung drawer thông báo, badge số trên nút icon (TailAdmin chỉ có chấm) (agent khảo sát 2026-10-17;
`component-specs.md:82` chỉ ghi "insights panels" là Tier 3 mở).

| Mã | Câu hỏi | Trạng thái |
|----|---------|------------|
| Q-34 | Tile dashboard: nền, viền, bo góc theo tile kề, header (icon màu, tên, tooltip note), tay cầm resize 8 hướng và nhãn `W×H`, trạng thái nạp/lỗi/`no_data`, zoom-to-fit | Recipe theo code (T120); design owner duyệt 2026-10-18 |
| Q-35 | Biểu đồ (bar, line, pie, time series, meter): bảng màu chuỗi từ token theme cho sáng/tối, lưới trục, chữ trục, tooltip, chú giải, nhãn dữ liệu; bảng ẩn `sr-only` cho trình đọc màn hình (FR-106) | Recipe theo code (T120); design owner duyệt 2026-10-18 |
| Q-36 | Thẻ metric và metric list: cỡ chữ số theo tile, định dạng có điều kiện (nền/chữ); ánh xạ biến CSS màu của Directus có trong metadata (`--theme--primary(-subdued)`, `--blue(-25)`, `--theme--danger`, `--danger-25`, `--purple(-25)`; nhãn action của Activity, FR-062) sang token theme | Recipe theo code (T120); design owner duyệt 2026-10-18 |
| Q-37 | Drawer panel: lưới chọn loại (icon lớn, tên, mô tả; không ảnh xem trước, D-110), nhóm header, raw editor | Recipe theo code (T120); design owner duyệt 2026-10-18 |
| Q-38 | Chuông header: badge số (cỡ, cách hiện số > 99, ẩn khi 0) thay chấm TailAdmin | Recipe theo code (T120); design owner duyệt 2026-10-18 |
| Q-39 | Drawer thông báo: tab Inbox/Archive, dòng có ô chọn, subject, thời gian, mở rộng markdown, nút mở, thanh hành động khi chọn | Recipe theo code (T120); design owner duyệt 2026-10-18 |

## Clarifications

### Session 2026-10-18

- Q: Tech lead duyệt bảng khác biệt (D-107..D-110, R-49..R-57) và ngoại lệ a11y lưới dashboard? → A: Duyệt cả bảng (2026-10-18, SC-010).

### Session 2026-10-17

- Q: Kéo và đổi cỡ tile có cần đường bàn phím? → A (owner): chỉ chuột/pointer như Directus và canvas 017; ghi ngoại lệ
  a11y (WCAG 2.1.1) trong `design-system/qa/handoff-checklist.md`, tech lead duyệt; không thêm field vị trí/cỡ hay phím
  mũi tên (FR-027, FR-106, SC-008, SC-010).
- Q: Drawer thông báo có danh sách upload TUS dở (ghi chú 015, D-90)? → A (owner): không, giống Directus 11.17.4 (sự
  kiện `tusResumableUploadsChanged` không có nơi nghe); D-90 gỡ vì không còn là khác biệt (FR-076).
- Q: `notify` hiện snackbar như Directus hay giữ notice tại chỗ (ghi chú 016, D-66)? → A (owner): giữ notice tại chỗ
  dưới page header cho mọi màn, gồm 018; không port snackbar; D-66 giữ; Q-40 không cần (FR-080, US7).
- Q: "Đánh dấu đã đọc" của mô tả feature là gì khi Directus chỉ có `status` `inbox`/`archived`? → A (owner,
  2026-10-17, /speckit.clarify): "đã đọc" = chuyển sang Archive (`status: archived`) như Directus; số trên chuông = số
  ở Inbox; không thêm trạng thái hay nhãn mới (US6, FR-070, FR-071).
- Q: Có nối `utils/unexpected-error.ts` (console, 13 nơi gọi ở 012–017 tự hiện notice tại chỗ) vào hộp lỗi của
  `showUnexpectedError`? → B (owner, 2026-10-17, /speckit.clarify): giữ nguyên hàm cũ; màn mới của 018 dùng
  `showUnexpectedError`; không đụng màn đã xong (FR-081).
- Q: Trình đọc màn hình đọc biểu đồ bằng gì? → A (owner, 2026-10-17, /speckit.clarify): bảng ẩn `sr-only` trong mỗi
  tile biểu đồ sinh từ cùng dữ liệu, biểu đồ `aria-hidden`; E2E dùng bảng này để so dữ liệu biểu đồ (FR-105, FR-106,
  Q-35).
- Release-gate (`checklists/release-gate.md` CHK001–CHK055, 2026-10-17): owner yêu cầu áp toàn bộ lời giải
  (`checklists/release-gate-proposals.md`); thêm R-56, R-57, sáu mục "đã xác nhận 2026-10-18", collection mẫu `bo_insights_data`,
  thông báo E2E trên user tạm.
- Q: Lưới chọn loại panel có chép `preview.svg` của Directus? → B (owner, 2026-10-17, /speckit.clarify): không chép; ô
  chọn gồm icon lớn của loại, tên, mô tả; ghi D-110 (FR-030, US3-2, Q-37).

## Assumptions

- API (010, 011) nhận GraphQL aggregate/group mà panel gửi và trả cùng dạng với Directus; nếu so payload phát hiện lệch
  thì sửa ở `apps/api` (FR-111).
- `GET /dashboards?export=json` và `POST /utils/import/directus_dashboards` của API mới hoạt động như Directus (010).
- `@directus/utils` 13.4.1 (013) có `applyOptionsData` giống bản Directus 11.17.4 (plan kiểm).
- Store notifications (012) đã đếm `inbox` của mình; mở rộng thêm, không thay.
- `ExtensionOptions` (016) nhận thêm `type panel` như đã nhận `type operation` ở 017.
- Mọi chuỗi i18n nêu trong spec (`create_dashboard`, `no_dashboards`, `activity_feed`, `no_notifications`,
  `auto_refresh`, `panels.*`…) có trong `en-US.json` của 012 (plan kiểm từng khóa).
- Thư viện biểu đồ dùng cùng thư viện với Directus để dữ liệu và cách nhóm hiển thị giống nhau (FR-113); plan kiểm
  advisory trước khi cài.
- Bộ mẫu dùng collection riêng `bo_insights_data` (FR-103), `bo_content` của 014 cho Activity và thông báo, và quyền
  tối thiểu của role thử 014–016 để kiểm Activity và thông báo cho người không admin.
- Hiệu năng theo máy tham chiếu và `machineFactor()` như 014–017.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% kịch bản E2E của US1 đến US8 đạt ở ba cấu hình API (Directus thật, API mới cùng origin, API mới khác
  origin) trên chromium 768 và 1280 (mọi spec E2E mới); cùng origin thêm firefox-1280 và webkit-1280 cho
  `insights-edit`; `insights-cross-use`, `insights-parity-ui` và `payload/*` chỉ chromium-1280 ở `proxy-api`.
- **SC-002**: Dashboard `bo_dash_all` và `bo_dash_system` tạo ở Directus hiển thị trên app mới với: 100% tile cùng vị trí
  và cỡ (sai số 0 ô), cùng chữ header, cùng giá trị hiện ở metric, metric list, list, meter, label, cùng dữ liệu biểu đồ
  (thứ tự hạng mục, tên và số chuỗi, giá trị từng điểm theo FR-105) ở bar, line, pie, time series; ô `variable` hiện
  `defaultValue`, `relational-variable` rỗng; tài liệu GraphQL bằng nhau (SC-005); dashboard tạo và sắp ở app mới mở trên
  Directus app với cùng tiêu chí; dòng `directus_dashboards`, `directus_panels` bằng dòng Directus app ghi cho cùng thao
  tác sau chuẩn hóa — đây là tiêu chí "dashboard tạo ở Directus hiển thị đúng trên app mới".
- **SC-003**: Đổi biến ở `bo_dash_vars` (3 giá trị mỗi biến: `vars_status` `published`/`draft`/`archived`;
  `vars_author` [admin]/[user cố định của bộ mẫu]/[]) cho cùng giá trị panel và cùng body `POST /graphql` ở hai
  app; panel không dùng biến không phát request.
- **SC-004**: Với bộ mẫu, so với Directus app trên cùng DB, 0 lệch ngoài D-xx ở: (a) nhãn và thứ tự dòng bảng dashboard,
  sub-menu Insights, sub-menu Activity; (b) tiêu đề các màn; (c) cột và 20 dòng đầu của bảng activity lọc `collection
  bo_insights_data` (chỉ seed ghi), dòng cùng `timestamp` so như tập; (d) trường của
  drawer activity; (e) danh sách drawer thông báo hai tab và số badge; (f) `disabled`/ẩn của nút tạo, sửa, Save, Clear
  Changes, Export, Delete, Archive; thu bằng `innerText` và `aria-disabled`.
- **SC-005**: 100% body ghi và request đọc của FR-101 bằng Directus app cho cùng kịch bản sau chuẩn hóa; lệch thật ghi
  R-xx.
- **SC-006**: Registry 11 panel: test so nguồn đạt 100% (options tĩnh, options hàm với 3 bộ đối số mẫu, cỡ tối thiểu,
  `query` với 3 bộ options mẫu mỗi loại cho cùng kết quả như hàm của Directus).
- **SC-007**: Hiệu năng FR-108 đạt; số request mỗi thao tác đúng FR-108.
- **SC-008**: Q-36 được design owner chốt trước T082 (lượt 3, màu nhãn action); Q-34, Q-35, Q-37 đến Q-39 duyệt trước
  khi đóng (T123); `qa/handoff-checklist.md` đạt trước khi đóng; axe 0 vi
  phạm serious/critical trên các màn của FR-106 ở sáng và tối; ngoại lệ a11y kéo/đổi cỡ tile (FR-027) có trong
  `qa/handoff-checklist.md`.
- **SC-009**: Coverage `apps/web` ≥ 60%; lint, typecheck, unit, E2E ba cấu hình, build image xanh; ngân sách bundle
  FR-109; 0 màu thô ngoài danh sách miễn; 0 file trong `directus/` bị sửa; 0 request ngoài FR-110.
- **SC-010**: D-107 đến D-110, R-49 đến R-57 và mục "đã xác nhận 2026-10-18" được tech lead duyệt; D-40, D-45 (012), D-72 (014), D-90
  (015) ghi "đã gỡ ở 018" ở spec gốc; D-66 (013) ghi "giữ ở 018"; ngoại lệ a11y của lưới dashboard (FR-027) ghi trong
  `design-system/qa/handoff-checklist.md` và tech lead duyệt.
