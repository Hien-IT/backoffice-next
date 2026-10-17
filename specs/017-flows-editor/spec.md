# Feature Specification: Trình chỉnh sửa Flows (danh sách, trigger, canvas operation, log chạy, nút chạy thủ công như Directus)

**Feature Branch**: `017-flows-editor` (làm trên `main` như 012–016, không tạo branch; `specs/017-*` là thư mục feature
hiện tại theo quy tắc "thư mục số cao nhất" của `.specify/scripts/bash/common.sh`)
**Created**: 2026-10-17
**Status**: Draft
**Input**: User description: "Admin tạo và chỉnh sửa flow bằng giao diện kéo thả như Directus: chọn trigger, thêm
operation, nối nhánh resolve và reject, cấu hình từng operation, bật tắt flow, xem log các lần chạy. Nút chạy flow thủ
công hiện trên trang item hoặc danh sách item. Tham chiếu directus/app/src/modules/settings/routes/flows và
directus/app/src/operations. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng
khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: flow tạo ở app mới mở và sửa được trên
Directus, và ngược lại. Ghi chú từ 016 (đưa vào spec 017): mục "Flows" của sub-menu Settings và /settings/flows(/*)
đang là khung của 012 (D-92 của 016); /content/directus_flows cũng trỏ về đó (D-72). Đã có sẵn ba interface _system mà
màn flow dùng: system-manual-flow-select, system-collections, system-inline-fields (port của Directus, 016)."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/app/src` trừ khi ghi khác):

- Route: `modules/settings/index.ts:207-247` (`settings-flows-collection` `/settings/flows`, `settings-flows-item`
  `/settings/flows/:primaryKey` với `beforeEnter` tra store, thiếu → `settings-not-found`; con
  `settings-flows-operation` `:operationId` nổi (`meta.isFloatingView`), `+` = operation mới).
- Store: `stores/flows.ts` (`hydrate` = `GET /flows?fields=*,operations.*`, không quyền đọc → `[]`;
  `getManualFlowsForCollection`).
- Danh sách: `routes/flows/overview.vue` (một bảng: icon, Status, Name, Description; sắp xếp client; menu dòng đổi
  trạng thái / sửa / xóa; nút tạo gated bởi quyền `create` của `directus_flows`; trạng thái rỗng `no_flows`).
- Drawer flow: `routes/flows/flow-drawer.vue` (hai tab `flow_setup`, `trigger_setup`; mặc định `icon bolt`,
  `status active`, `accountability all`; `POST /flows` hoặc `PATCH /flows/:id` cả body), `routes/flows/triggers.ts`
  (năm trigger `event`, `webhook`, `schedule`, `operation`, `manual` với option fields và `overview`).
- Trình sửa: `routes/flows/flow.vue` (staging `stagedPanels`, `panelsToBeDeleted`, `stagedFlow`; `saveChanges` dựng cây
  rồi `PATCH /flows/:id {operations:{create,update,delete}, operation}`; nhân bản; "Copy To" `POST /operations`; xóa;
  guard sửa dở; `meta+s`), `routes/flows/constants.ts` (`GRID_SIZE 18`, panel 14×14 ô, `ATTACHMENT_OFFSET`,
  `RESOLVE_OFFSET`, `REJECT_OFFSET`), `components/operation.vue` (panel, tay cầm resolve/reject/attachment, nút gợi ý
  "+", kéo mũi tên), `components/options-overview.vue`, `components/arrows/*` (sinh và vẽ mũi tên SVG, có test),
  `components/v-workspace*.vue` (lưới, kéo panel, nhãn vị trí khi kéo, menu tile).
- Drawer operation: `components/operation-detail.vue` (tên, key `db-safe` tự sinh từ tên bằng `slugify`, duy nhất; chọn
  loại bằng fancy select phẳng; form options qua `ExtensionOptions` với `options` dạng mảng hoặc hàm; notice
  `operation_not_found`). `components/trigger-detail.vue` không được import ở đâu (không port).
- Log: `components/logs-sidebar-detail.vue` (`useRevisions('directus_flows', id, null, {action:'run', full:true})`,
  `GET /revisions` lọc `collection`, `item`, `version _null`, `activity.action run`, `sort -id`, `limit 10`, đếm
  `aggregate[count]`; nhóm theo ngày; toggle `show_failed_only`; phân trang), `components/logs-drawer.vue` (dòng thời
  gian: bước trigger với Options/Payload/Accountability, mỗi `data.steps[]` với Options và Payload).
- Operation app-side: `operations/index.ts` (glob, sắp theo `id`) và 15 thư mục `operations/<id>/index.ts` (không có
  `.vue`; `options` là mảng hoặc hàm một đối số; `overview(options, {flow})`); kiểu `OperationAppConfig` ở
  `directus/packages/types/src/extensions/operations.ts`.
- Nút chạy thủ công: `composables/use-flows.ts`, `views/private/components/flow-sidebar-detail.vue`,
  `flow-dialogs.vue`, dùng ở `modules/content/routes/item.vue`, `collection.vue`, `interfaces/presentation-header`,
  `presentation-links` (đã port ở 014, xem "Dùng lại").
- API (đã có ở 009, `apps/api`): `/flows`, `/operations` CRUD, `POST|GET /flows/trigger/:id`, reload qua bus `flows`,
  log chạy ghi `directus_activity` (`action run`) và `directus_revisions` (`data.steps`, `data.data`) khi
  `accountability` là `all`; `/revisions` với filter như Directus (008).

**Dùng lại từ 012–016** (không viết lại): khung app, `PrivateView` (`fill`), `PageHeader`, `DetailPanel`, sub-menu
Settings (016, Q-24), `ContentNotFound`, store flows/collections/fields/permissions/server/notifications (012);
`BoForm`, `BoDrawer`, `BoDialog` (`persistent`), `BoTable`, `BoMenu`, `BoTabs` (`orientation`), `BoFancySelect`,
`BoSelect`, `BoIconPicker`, `BoColorPicker`, `BoNotice`, `BoTooltip`, `BoDetail`, interface `input-code` (CodeMirror 5),
`select-dropdown`, `select-multiple-dropdown`, `select-radio`, `tags`, `list`, `boolean`, `input`, `input-multiline`,
`input-rich-text-md`, `input-rich-text-html`, `select-icon`, `select-color`, `system-raw-editor` (013);
`use-run-manual-flow` (port `use-flows.ts`), `FlowSidebarDetail`, `FlowDialogs`, `use-revisions`, `use-edits-guard`,
`use-dialog-route`, `use-shortcut`, `RevisionsDateGroup` (nhóm theo ngày), `get-item-route`, `SaveOptions` (014);
`ExtensionOptions`, `system-collection`, `system-collections`, `system-inline-fields`, `system-input-translated-string`,
`system-manual-flow-select`, `system-interface`, `system-interface-options`, `BoInput dbSafe` (016, FR-007).

## User Scenarios & Testing *(mandatory)*

Người dùng là admin (`admin_access`) đang quản trị Directus app trên cùng DB, nay làm cùng việc trên app Backoffice:
xem danh sách flow, tạo flow và chọn trigger (event hook, webhook, lịch cron, flow khác, thủ công), bật tắt flow, mở
trình sửa dạng canvas để thêm operation, cấu hình từng operation bằng form của loại đó, nối nhánh resolve và reject bằng
kéo thả, kéo panel đổi vị trí, lưu một lần, xem log các lần chạy theo ngày và từng bước; chạy flow thủ công từ trang
item hoặc danh sách item (đã có từ 014) và thấy lần chạy trong log. Flow và operation ghi ở app này mở và sửa được
ngay ở app kia, với cùng vị trí panel, cùng mũi tên, cùng options.

Phạm vi: `/settings/flows`, `/settings/flows/:primaryKey`, `/settings/flows/:primaryKey/:operationId` (`+` = mới),
màn không tìm thấy; thay khung D-92 (016) và đích thật cho `directus_flows` của D-72 (014); 5 trigger và 15 operation
có sẵn của Directus 11.17.4 với đúng `id`, option fields, `overview`; log chạy qua `/revisions`; E2E ba cấu hình, bộ
so payload và DB, kịch bản dùng chéo. Ngoài phạm vi: operation và trigger từ extension (XI, D-41; dữ liệu có loại lạ
vẫn hiện, xem Edge Cases), AI (`useAiToolsStore` trong store flows, đã gỡ D-54), WebSocket (không có trong các file
flows), gửi email thật của operation `mail` (X, D-34: API ghi log; form options giữ nguyên như Directus để dữ liệu
tương thích, thêm notice D-106), snackbar (D-45, D-66, 018), `/settings/flows` cho người không admin (module Settings chỉ admin như
Directus; nút chạy thủ công cho người không admin đã ở 014).

### User Story 1 - Danh sách flow, tạo flow và chọn trigger, bật tắt, xóa (Priority: P1)

Admin vào Settings → Flows, thấy bảng flow (icon màu, trạng thái, tên, mô tả), bấm "+" mở drawer hai tab: Flow Setup
(tên, trạng thái, mô tả, icon, màu, mức ghi activity/log) rồi Trigger Setup (chọn một trong năm trigger, điền options
của trigger); hoàn tất thì vào trình sửa của flow mới. Từ menu dòng đổi trạng thái ngay, sửa flow (mở lại drawer), xóa
có xác nhận.

**Why this priority**: Là màn mở đầu của feature, điểm vào của tiêu chí chấp nhận (flow tạo ở app mới mở được trên
Directus) và điều kiện để dùng `system-manual-flow-select`, nút chạy thủ công của 014 với flow do app mới tạo.

**Independent Test**: E2E trên bộ mẫu `bo_flows` (xem FR-103): mở `/settings/flows`, so bảng, menu, nút tạo với
Directus app; tạo flow `bo_manual` (flow tạm do E2E tạo, FR-100; trigger manual trên `bo_content`, `location both`, `requireConfirmation` với một
field `reason` bắt buộc) qua app mới rồi mở `/admin/settings/flows/<id>` trên Directus app 8155: drawer trigger hiện
cùng giá trị; so dòng `directus_flows` với cùng thao tác trên Directus app (bộ so DB).

**Acceptance Scenarios**:

1. **Given** admin, **When** mở `/settings/flows`, **Then** bảng một cấp như `overview.vue`: cột icon (`item.icon ??
   bolt`, màu `item.color ?? brand`), Status (badge `active` nổi, `inactive` mờ, sắp xếp được), Name (sắp xếp được),
   Description; sắp xếp mặc định theo tên tăng dần, bỏ sắp xếp thì về mặc định; cột co kéo được, header dính; click
   dòng mở `/settings/flows/:id`, Ctrl/Cmd/chuột giữa mở tab mới; sub-menu Settings của 016 với mục Flows active.
2. **Given** chưa có flow, **When** mở danh sách, **Then** trạng thái rỗng icon `bolt`, tiêu đề `no_flows`, chữ
   `no_flows_copy`, nút `create_flow` chỉ khi quyền `create` trên `directus_flows` cho phép.
3. **Given** admin, **When** bấm "+", **Then** drawer `persistent` tiêu đề `creating_new_flow`, tab dọc `flow_setup` và
   `trigger_setup` (tab 2 khóa khi chưa có tên); Flow Setup: Name (bắt buộc, autofocus), Status (`active`/`inactive`),
   Description, Icon (`select-icon`), Color (`select-color`), vạch chia, "Activity & Logs Tracking" với ba mức `all`,
   `activity`, `null`; mặc định `icon bolt`, `status active`, `accountability all`, `color null`; nút `arrow_forward`
   Next khóa khi tên rỗng.
4. **Given** tab Trigger Setup, **When** chọn trigger, **Then** fancy select phẳng năm mục (Event Hook `anchor`,
   Webhook `link`, Schedule (CRON) `schedule`, Another Flow `bolt`, Manual `touch_app`) với tên và mô tả; dưới là form
   options của trigger đó theo `triggers.ts` (xem FR-012); đổi trigger thì `options = {}`; với Event Hook đổi `type`
   thì `options = {type}`; nút `check` "Finish Setup" khóa khi chưa chọn trigger.
5. **Given** bấm Finish Setup, **When** lưu, **Then** `POST /flows?fields=id` với body `{name, icon, color,
   description, status, accountability, trigger, options}` (options là JSON thô của form); nạp lại store; điều hướng
   tới `/settings/flows/<id>` (chế độ sửa vì chưa có operation).
6. **Given** menu dòng (`more_vert`, mở trái), **When** chọn, **Then** ba mục: "Set Flow to Inactive" (`block`) hoặc
   "Set Flow to Active" (`check`) gửi `PATCH /flows/:id {status}` ngay rồi nạp lại; "Edit Flow" mở drawer
   `updating_flow` với giá trị từ store (lưu bằng `PATCH /flows/:id` cả body, đóng drawer, không điều hướng); "Delete
   Flow" (danger) mở hộp `flow_delete_confirm {flow}` với Cancel và Delete (danger, loading; Esc hủy) gửi
   `DELETE /flows/:id` rồi nạp lại. Không có mục nhân bản flow (như Directus).
7. **Given** flow mới tạo ở app mới, **When** mở trên Directus app, **Then** dòng xuất hiện trong bảng, drawer sửa và
   trigger hiện cùng giá trị; và ngược lại.

---

### User Story 2 - Canvas trình sửa: panel, nối resolve/reject, kéo vị trí, lưu một lần (Priority: P1)

Admin mở `/settings/flows/:id`: canvas lưới với panel Trigger ở góc trên trái và các panel operation; ở chế độ xem thấy
mũi tên resolve (màu chính) và reject (màu phụ), panel mờ khi flow inactive hoặc panel không nối về trigger. Trong
spec này "màu chính" là `brand-500` (tối `brand-400`) thay `--theme--primary` và "màu phụ" là `orange-500` (tối
`orange-400`) thay `--theme--secondary` của Directus (owner chọn, Clarifications 2026-10-17); áp cho mũi tên, tay cầm,
icon trạng thái và chấm bước của log, header panel con reject (CHK026). Bấm "Edit
Flow" sang chế độ sửa: kéo panel đổi vị trí (bám lưới 18 px), bấm "+" ở tay cầm resolve/reject để thêm operation, kéo từ
tay cầm tới điểm nhận của panel khác để nối hoặc thả ra ngoài để tháo, menu panel nhân bản / sao chép sang flow khác /
xóa, đổi trạng thái flow ở chân panel Trigger, bấm pencil ở Trigger để mở drawer trigger. "Save" ghi mọi thay đổi trong
một `PATCH /flows/:id`; "Clear Changes" hỏi rồi bỏ; rời trang khi còn sửa dở thì hộp `unsaved_changes`.

**Why this priority**: Là lõi của feature và của tiêu chí chấp nhận (vị trí, mũi tên, options tạo ở app này hiện đúng
ở app kia).

**Independent Test**: E2E: trên `bo_manual` của US1 thêm 4 operation (condition → resolve: log; reject: throw-error;
log → resolve: transform) bằng nút "+", kéo panel transform sang `(37, 1)`, lưu; mở trên Directus app 8155 và so ảnh
chụp canvas (vị trí panel, số mũi tên, màu nhánh) và `directus_operations` (`position_x`, `position_y`, `resolve`,
`reject`, `options`, `key`) với cùng thao tác trên Directus app (bộ so DB); kéo tháo một mũi tên rồi nối lại vào panel
khác, lưu, so lại.

**Acceptance Scenarios**:

1. **Given** flow có operation, **When** mở `/settings/flows/:id`, **Then** chế độ xem: tiêu đề = tên flow với chấm
   trạng thái (tooltip), nút "Delete Flow" (`delete`) và "Edit Flow" (`edit`); panel Trigger ảo `$trigger` ở ô (1,1),
   không kéo được, icon `offline_bolt`, tiêu đề "Trigger", thân là tên trigger và `overview` của trigger (ví dụ
   webhook: Method và URL `<API URL>flows/trigger/<id>` có nút sao chép, FR-012), chân là trạng thái flow; mỗi operation là
   panel 14×14 ô tại (`position_x`, `position_y`) với icon và tên loại ở header, tiêu đề = `name` (tooltip = `key`),
   `<dl>` label/text từ `overview(options, {flow})` của loại; panel `DetailPanel` có mục Logs (US4).
2. **Given** chế độ xem, **When** nhìn mũi tên, **Then** SVG phủ lên canvas (`pointer-events: none`): từ tay cầm
   resolve (`RESOLVE_OFFSET` 14×18, 10×18) tới điểm nhận (`ATTACHMENT_OFFSET` 0, 3×18) của panel con, màu chính; từ
   tay cầm reject (14×18, 12×18) màu phụ; nét 2 px, đầu tròn, mũi tên ">" 8 px; đường thẳng khi cùng y, đường L/Z tránh
   panel khi `x + 54 < toX`, đường vòng khi ngược chiều (`create-line.ts`, `find-best-position.ts`); mũi tên và panel
   mờ khi flow inactive hoặc panel không có cha hoặc chuỗi cha không về `$trigger`; panel là con reject dùng màu phụ.
3. **Given** flow 0 operation hoặc URL có `:operationId`, **When** mở, **Then** vào thẳng chế độ sửa; chế độ sửa: nút
   "Clear Changes" (`clear`) và "Save" (`check`, loading); canvas rộng thêm 25 ô; mọi panel có nút pencil; operation
   có menu `more_vert` với "Copy To..." (khóa khi id tạm `_`), "Duplicate", "Delete"; nút "+" (`add_circle_outline`)
   ở tay cầm chưa nối khi rê chuột (luôn hiện ở resolve của Trigger) kèm nhánh gợi ý dài 3 ô; tooltip
   `operation_handle_resolve`/`operation_handle_reject`.
4. **Given** chế độ sửa, **When** kéo panel, **Then** vị trí bám lưới 18 px, không nhỏ hơn 1, nhãn `(x-1:y-1)` hiện
   khi kéo, Trigger không kéo được, panel không đổi cỡ; vị trí vào staging (`update` throttle 20 ms).
5. **Given** chế độ sửa, **When** bấm "+" ở tay cầm chưa có con, **Then** mở `/settings/flows/:id/+` (drawer operation,
   US3) nhớ `parentId` và `attachType`; khi Done: operation mới có id tạm `_<nanoid>`, cha được gán
   `resolve`/`reject` = id tạm (Trigger → `flow.operation`), vị trí con resolve `(cha.x+18, cha.y)`, con reject
   `(cha.x+18, cha.y+16)`, không cha `(15,15)`.
6. **Given** chế độ sửa, **When** kéo từ tay cầm resolve/reject (hoặc từ điểm nhận của panel con để đổi cha), **Then**
   mũi tên sống bám lưới theo con trỏ; thả trong 40 px của một điểm nhận thì nối (từ chối vòng bằng cách đi ngược
   chuỗi cha; điểm nhận chỉ một cha nên link cũ vào đích bị gỡ); thả ra chỗ trống thì tháo (`null`); Trigger gán
   `flow.operation`. Ví dụ: nối reject của `log` vào điểm nhận của `transform` đang là con resolve của `condition`
   → `condition.resolve` thành null, `log.reject = transform`; nối Trigger vào operation đang có cha → link của cha cũ
   gỡ, `flow.operation` = operation đó.
7. **Given** menu panel, **When** chọn, **Then** "Duplicate" tạo bản sao không `id`/`resolve`/`reject`, vị trí +2/+2,
   key `<key>_<5 chữ a-z>`, vào staging; "Copy To..." mở hộp chọn flow khác (không có → notice `no_other_flows_copy`,
   nút khóa) và gửi ngay `POST /operations` với panel bỏ `id`, `date_created`, `user_created`, `resolve`, `reject`,
   `flow` = đích rồi nạp lại (không qua staging); "Delete" xóa khỏi staging không hộp xác nhận, id thật vào
   `panelsToBeDeleted`, gỡ link ở cha (Trigger → `stagedFlow.operation null`), con không được nối lại (thành panel lẻ).
8. **Given** chân panel Trigger ở chế độ sửa, **When** đổi select trạng thái, **Then** `stagedFlow.status` đổi, panel
   và mũi tên mờ/đậm ngay; chỉ ghi khi Save. Pencil ở Trigger mở drawer flow tab `trigger_setup`; lưu ở drawer này
   `PATCH /flows/:id` ngay, ngoài staging. Pencil ở operation mở `/settings/flows/:id/<operationId>`.
9. **Given** có thay đổi, **When** bấm Save hoặc `Ctrl/Cmd+S` (không khi drawer đang mở), **Then** dựng cây từ panel
   gốc với sửa đổi gộp vào, bỏ id tạm; trước hết `PATCH /operations` mảng `{id, resolve: null}` / `{id, reject: null}`
   cho link cũ sẽ bị nối lại; rồi `PATCH /flows/:id` body `{...stagedFlow, operation: <resolve của Trigger>,
   operations: {create: [cây không id], update: [cây có id, trừ $trigger], delete: [ids]}}`; nạp lại, xóa staging, về
   chế độ xem. Không thay đổi → về chế độ xem, không request.
10. **Given** có thay đổi, **When** bấm Clear Changes, **Then** hộp "Unsaved Changes" / `discard_changes_copy` với
    Discard và Keep Editing; không thay đổi thì bỏ ngay. Rời route (ngoài tiền tố `/settings/flows/<id>`) khi
    `stagedPanels` hoặc `panelsToBeDeleted` khác rỗng → hộp `unsaved_changes` (Keep Editing trước, D-76).
11. **Given** nút Delete Flow trên trang, **When** xác nhận, **Then** `DELETE /flows/:id`, về `/settings/flows` kể cả
    khi lỗi (như `flow.vue:91-105`); flow không có trong store → màn không tìm thấy của Settings (016 FR-004).
12. **Given** chế độ sửa, **When** bấm "+" nhiều lần trước Save (kể cả "+" trên operation vừa thêm, id `_…`), **Then**
    mỗi operation mới có id tạm riêng, con của operation tạm nằm lồng trong cây `create` khi Save; pencil trên operation
    tạm mở `/settings/flows/:id/_<nanoid>` với giá trị đang staging.

---

### User Story 3 - Drawer operation: chọn loại, tên và key, form options của 15 operation (Priority: P1)

Admin bấm "+" hoặc pencil ở một operation: drawer nổi trên canvas với ô Name, ô Key (db-safe, tự sinh từ tên, phải duy
nhất trong flow), fancy select 15 loại operation (icon, tên, mô tả), rồi form options đúng của loại đó (ví dụ Run
Script có ô code JavaScript, Condition có ô JSON filter, Trigger Flow chỉ liệt kê flow có trigger "Another Flow");
"Done" đưa operation vào staging của canvas.

**Why this priority**: Không có drawer này thì không thêm được operation; options sai một key là flow chạy khác trên
Directus.

**Independent Test**: Test component với mock API: với mỗi loại trong 15 loại, mở drawer, so danh sách field (tên,
kiểu, interface, width, mặc định, ẩn/hiện theo điều kiện) với `operations/<id>/index.ts`; lưu với options rỗng và so
`{...defaults, ...options}` với Directus; E2E: tạo một operation mỗi loại trong `bo_all_ops` qua app mới, mở từng
drawer trên Directus app 8155 và so giá trị; so `directus_operations.options` (bộ so DB).

**Acceptance Scenarios**:

1. **Given** mở `/settings/flows/:id/+`, **When** drawer hiện, **Then** drawer `persistent` nổi trên canvas (`RouterView`
   không tên của trang flow, FR-001), tiêu đề `create_operation` (hoặc `edit_operation`), phụ đề = tên flow, icon
   `offline_bolt`, một nút "Done" (`check`) khóa khi chưa chọn loại hoặc key trùng; Name placeholder = tên loại đã
   chọn hoặc `operation_name`; Key db-safe (016 FR-007) placeholder = `slugify(<id>_<5 ký tự a-z0-9>, '_')` hoặc
   `operation_key`; key theo tên (`slugify(name, '_')`) chừng nào key còn bằng slug của tên cũ hoặc tên rỗng; key có
   trong `existingOperationKeys` (đã lưu trừ đã xóa, cộng staging, trừ chính nó) → lỗi `operation_key_unique_error`.
2. **Given** fancy select loại, **When** mở, **Then** 15 mục phẳng sắp theo `id`: condition `rule`, exec `code`,
   item-create `add`, item-delete `delete`, item-read `visibility`, item-update `edit`, json-web-token `key`, log
   `terminal`, mail `mail`, notification `notifications`, request `link`, sleep `schedule`, throw-error `error`,
   transform `move_down`, trigger `flag`, tên và mô tả từ `operations.<id>.name|description`; đổi loại → `options = {}`.
3. **Given** đã chọn loại, **When** form hiện, **Then** `ExtensionOptions` kiểu `operation` với `raw-editor-enabled`
   vẽ `options` của loại: mảng dùng thẳng, hàm gọi với giá trị options hiện tại (một đối số) rồi `translate`; field
   theo FR-031 (ví dụ: `exec.code` là `input-code` JavaScript với mặc định `module.exports = async function(data)
   {...}`; `condition.filter` `input-code` JSON với template `{"$trigger":{"category":{"_eq":"Example"}}}`;
   `json-web-token` hiện payload/secret/options hay token/secret/options hay token/options theo `operation`;
   `mail.template` chỉ khi `type template`, `body` là `input-rich-text-html` khi `wysiwyg` còn lại `input-rich-text-md`,
   `data` chỉ khi `template`; `trigger.flow` là select các flow có `trigger === 'operation'` trong store,
   `batchSize` chỉ khi `iterationMode batch`; `throw-error.code` là select mọi `ErrorCode` với `allowOther`).
4. **Given** bấm Done, **When** lưu, **Then** emit `{flow, name: name || tên loại, key: key || key sinh, type, options:
   {...getDefaultValuesFromFields(fields), ...options}}` (schema `default_value` của từng field áp vào), cha staging
   (US2-5), về `/settings/flows/:id`; Cancel/Esc về route flow, không staging.
5. **Given** operation có `type` không đăng ký (extension tạo ở Directus), **When** mở drawer, **Then** notice danger
   `operation_not_found` với link đặt lại loại; panel trên canvas hiện tên loại thô và không có overview (như Directus).

---

### User Story 4 - Log các lần chạy: mục Logs ở panel và drawer từng bước (Priority: P2)

Admin mở panel chi tiết → Logs: số lần chạy, danh sách nhóm theo ngày (Hôm nay, Hôm qua, ngày), mỗi dòng icon
thành công/thất bại và giờ chạy; bật "Show Failed Only"; phân trang 10 dòng; bấm một dòng mở drawer dòng thời gian:
bước Trigger (Options, Payload, Accountability) rồi từng operation (tên, loại, Options, Payload) với chấm màu theo
trạng thái.

**Why this priority**: Là mục "xem log các lần chạy" của mô tả feature; dùng dữ liệu 009 đã ghi giống Directus nên rủi
ro thấp, có thể làm sau canvas.

**Independent Test**: E2E `settings-flows-logs.spec.ts` trên 3 log của `bo_all_ops` do seed tạo (2 resolve, 1 reject
qua `throw-error`): badge, nhóm ngày, icon, lọc, drawer của lần reject. Phần hai app: FR-102 (c) chạy `bo_manual` từ
trang item ở app mới và ở Directus app rồi so Logs của hai app (cùng số đếm, nhóm ngày, icon, bước, Options và
Payload sau chuẩn hóa thời gian); bộ so payload so request `GET /revisions` với Directus (FR-101).

**Acceptance Scenarios**:

1. **Given** trang flow, **When** panel chi tiết mở, **Then** mục `logs` (`fact_check`) với badge số đếm rút gọn bằng
   `abbreviateNumber` của `@directus/utils` (không theo locale, như Directus) khi > 0; đếm nạp khi mount (`GET /revisions?aggregate[count]=id&filter…`); danh sách nạp khi mount nếu mục đang mở,
   không thì ở lần mở đầu: `GET /revisions` lọc `_and[collection directus_flows, item <id>, version _null,
   activity.action run]`, `sort -id`, `limit min(10, queryLimit.max)`, `page`, fields `id, collection, item,
   activity.{action, timestamp, user.{id,email,first_name,last_name}, ip, user_agent, origin}, data, delta`.
2. **Given** có log, **When** hiện, **Then** nhóm theo ngày (Today / Yesterday / ngày ngắn, bỏ năm nếu năm nay) mới
   nhất trước; trạng thái một lần chạy = trạng thái bước cuối của `data.steps`; icon `check_circle` (màu chính) khi
   `resolve`, `cancel` (màu phụ) khi khác; chữ giờ theo `date-fns_time` và "x ago" theo ngôn ngữ người dùng, giờ địa
   phương trình duyệt (port `use-revisions.ts:160-185` đã có ở 014); không hiện user, IP (như Directus).
3. **Given** toggle `show_failed_only`, **When** bật, **Then** lọc client trên trang hiện tại, giữ lần chạy có trạng thái
   (bước cuối) `reject`;
   rỗng → `no_logs_on_page`; không có log → `no_logs`; nhiều trang → phân trang (`total-visible 3`).
4. **Given** bấm một dòng, **When** drawer mở, **Then** tiêu đề = thời gian (ngày ngắn + giờ), icon `fact_check`; dòng
   thời gian: bước "Trigger" + tên trigger với `BoDetail` Options (= `flow.options` hiện tại), Payload
   (`data.$trigger`), Accountability (`data.$accountability`); mỗi `data.steps[]` `{operation, status, key, options}`:
   chấm màu theo status (mặc định và `resolve` màu chính, `reject` màu phụ; như `logs-drawer.vue:193-203`), tên operation (từ store theo `operation`, không có → `key`, tooltip key), tên loại (hoặc
   type thô, hoặc `--`), Options (options đã resolve của bước) và Payload (`data.data[key]`) dạng `<pre>` JSON.
5. **Given** flow `accountability` là `activity` hoặc `null`, **When** mở Logs, **Then** không có dòng (API không ghi
   revision) — mục vẫn hiện với số 0 như Directus; log cũ ghi khi còn `all` vẫn hiện (lọc theo `item`, không theo
   `accountability`).

---

### User Story 5 - Nút chạy thủ công trên trang item và danh sách item với flow do app mới tạo (Priority: P2)

Admin tạo flow manual ở app mới (US1) với collection, `location`, `requireSelection`, `requireConfirmation` và các field
xác nhận; mở trang item hoặc danh sách của collection đó ở app mới và ở Directus app: nút flow hiện đúng chỗ, hộp xác
nhận đúng field, chạy xong có thông báo và log (US4).

**Why this priority**: Mô tả feature nêu rõ; phần nút đã có ở 014 (`FlowSidebarDetail`, `FlowDialogs`,
`use-run-manual-flow`), 017 chỉ nối hai đầu và kiểm bằng E2E, nên không viết lại.

**Independent Test**: E2E `settings-flows-manual.spec.ts`: tạo `bo_manual` (location `both`, confirmation với `reason`
bắt buộc) và `bo_manual_item` (location `item`, `requireSelection` ẩn); mở `/content/bo_content` và một item: nút ở
panel Flows, tooltip và `disabled` đúng (chưa chọn → khóa với `requireSelection`); chọn 2 item, chạy: hộp xác nhận với
ô `reason`, Confirm khóa khi rỗng; `POST /flows/trigger/:id {reason, collection, keys}`; notice thành công; log mới
ở US4. Cùng kịch bản trên Directus app 8155 cho cùng request (bộ so payload).

**Acceptance Scenarios**:

1. **Given** flow manual tạo ở app mới, **When** mở trang item/danh sách của collection đó ở app mới và Directus app,
   **Then** nút hiện ở cả hai (store flows nạp lại sau khi lưu; Directus app nạp khi vào); `location item` không hiện
   ở danh sách, `collection` không hiện ở item; flow `inactive` không hiện.
2. **Given** chạy từ app mới, **When** xong, **Then** request đúng `use-flows.ts` (014 đã port): `{...confirmValues,
   collection, keys}` hoặc `{...confirmValues, collection}` khi `requireSelection false` và chưa chọn; notice tại chỗ
   (D-45) thay snackbar `trigger_flow_success`; `refreshUnreadCount`.
3. **Given** `system-manual-flow-select` ở options của `presentation-links`/`presentation-header` (016), **When** mở
   sau khi tạo flow manual mới, **Then** flow mới có trong danh sách (`location !== 'collection'`).
4. **Given** flow manual `async true` hoặc `error_on_reject true`, **When** chạy, **Then** hành vi của 014 giữ: async
   trả ngay và hiện notice thành công; reject với `error_on_reject` trả lỗi và hiện notice danger; E2E manual có một
   flow tạm `async`.

---

### User Story 6 - Đối chiếu với Directus, E2E ba cấu hình, dùng chéo, recipe design-system (Priority: P2)

Mọi luồng trên chạy ở ba cấu hình API (proxy tới Directus thật, proxy tới API mới, khác origin) và so với Directus app
trên cùng DB; flow tạo ở app này được mở, sửa và chạy ở app kia; recipe design-system cho canvas, panel, drawer
operation và log được viết trước khi code và design owner duyệt.

**Why this priority**: Là tiêu chí chấp nhận.

**Independent Test**: Job `e2e-web` với spec `settings-flows-*.spec.ts`; bộ so payload `flows` cho `POST /flows`,
`PATCH /flows/:id` (status, body drawer, body Save với `operations`), `PATCH /operations`, `POST /operations` (Copy
To), `DELETE /flows/:id`, `POST /flows/trigger/:id`, `GET /revisions` (log); bộ so DB (`db-rows`) cho
`directus_flows`, `directus_operations`; bộ so UI cho bảng, menu, tiêu đề, `disabled` của nút, mục panel; kịch bản
dùng chéo của SC-002.

**Acceptance Scenarios**:

1. **Given** bộ mẫu `bo_flows` seed qua Directus REST, **When** chạy E2E song song hai app, **Then** 0 lệch ngoài D-xx
   ở năm thuộc tính của SC-004.
2. **Given** cùng kịch bản ghi, **When** so body, **Then** 100% bằng sau chuẩn hóa (SC-005); lệch thật ghi R-xx.
3. **Given** flow tạo ở app mới, **When** mở, sửa, chạy ở Directus app (và ngược lại), **Then** SC-002 đạt.
4. **Given** recipe Q-29 đến Q-33, **When** đóng feature, **Then** design owner đã duyệt (SC-008).

### Edge Cases

- Operation có `type` không đăng ký (extension ở Directus): panel hiện header với type thô, không overview; drawer hiện
  notice `operation_not_found` với link đặt lại; lưu được các operation khác mà không đụng options của nó.
- Trigger `options` có key lạ hoặc thiếu (`cron` rỗng, `collections` không phải mảng): form hiện giá trị thô, không
  kiểm ở client (như Directus); API quyết khi chạy.
- `flow.operation` trỏ tới operation không thuộc flow hoặc đã xóa ở app khác: panel Trigger không có mũi tên; mọi
  operation là panel lẻ (mờ); không treo.
- `resolve`/`reject` tạo vòng trong dữ liệu (ghi tay vào DB): `getTrees` của Directus đệ quy vô hạn khi Save →
  app dừng khi gặp lại một id trong đường đi và hiện hộp lỗi (D-105); chế độ xem vẽ bình thường (mũi tên vẫn vẽ);
  kéo nối trên canvas đã từ chối vòng nên chỉ dữ liệu ngoài tạo được.
- Hai operation cùng `position_x/y`: chồng lên nhau như Directus; kéo tách ra.
- `position_x`/`position_y` là `NOT NULL` trong `directus_operations` (migration `20220429A-add-flows.ts`, đã kiểm
  2026-10-17) nên không có ca vị trí null; vị trí 0 hoặc âm (ghi tay): Directus vẽ ngoài lưới; app giữ, kéo một lần
  là về ≥ 1.
- Key trùng: DB không có unique trên `key` (chỉ `resolve`, `reject` unique; đã kiểm migration 2026-10-17) nên chỉ
  client kiểm duy nhất trong flow như Directus; key trùng với flow khác cho phép; dữ liệu có hai key trùng trong một
  flow (ghi tay hoặc Copy To) vẫn vẽ, drawer báo `operation_key_unique_error` khi mở một trong hai.
- Tên flow trùng: không kiểm (như Directus).
- Xóa operation có con: con thành panel lẻ, không nối lại, không hộp xác nhận (như Directus, ghi R-43).
- Save lỗi ở bước nào (`PATCH /operations` hoặc `PATCH /flows/:id`): như `flow.vue` (`try/catch`, staging chỉ xóa
  sau `hydrate` thành công) → hộp lỗi, staging và chế độ sửa giữ; Save lần sau tính lại và gửi lại cùng `PATCH
  /operations` (gán null lần hai không đổi gì) rồi `PATCH /flows/:id`. Nếu `PATCH /operations` đã ghi mà `PATCH
  /flows/:id` lỗi và người dùng tải lại trang: staging mất, DB còn link đã gỡ (operation thành panel lẻ) → R-47.
- Copy To flow khác khi `key` đã có ở flow đích: API chấp nhận (không unique), flow đích có hai key trùng (như
  Directus); danh sách flow đích lấy từ store (có thể cũ); `POST /operations` lỗi (flow đích đã bị xóa ở app khác,
  hoặc lý do khác) → hộp lỗi, hộp Copy To còn mở.
- Trình sửa mở ở hai tab hoặc hai app, lưu lệch nhau: ghi sau thắng; staging bên kia ghi đè khi Save (như Directus).
- Flow bị xóa ở app khác khi đang mở: Save → 403/404 → hộp lỗi; nạp lại → không tìm thấy.
- Log có `data.steps` rỗng (flow chạy mà không có operation): như revision thiếu `steps` bên dưới.
- Log của operation đã bị xóa: tên từ `key`, loại từ `operation` thô (như Directus).
- `data` của revision bị redact (`--redacted--` cho header auth, mật khẩu, token, biến env): hiện nguyên chuỗi.
- `queryLimit.max` của server nhỏ hơn 10: `limit` theo server.
- Người dùng mất `admin_access` giữa phiên: route đã đăng ký giữ; request ghi 403 → hộp lỗi.
- Màn 768 px: canvas cuộn hai chiều trong vùng nội dung (`PrivateView fill`), panel chi tiết là drawer (L-4), drawer
  operation và drawer flow chiếm toàn màn; tab dọc của drawer flow thành `BoTabs` ngang (016 Q-22).
- `prefers-reduced-motion`: không hiệu ứng mờ dần của mũi tên và kéo.
- RTL: Directus lật tọa độ kéo; app không hỗ trợ RTL (012, không có ngôn ngữ RTL) → không port nhánh RTL (ghi "Cần xác
  nhận").
- Phiên hết hạn khi Save: 401 → về đăng nhập (012); staging mất (như Directus).
- Webhook URL trong overview là `${getApiUrl()}flows/trigger/<id>` (`getApiUrl()` của 012 kết thúc bằng `/`, thay
  `getPublicURL()` của Directus): ở cấu hình `cors` là origin API, ở cùng origin là URL của app; parity UI so phần
  `/flows/trigger/<id>` (SC-004).
- Flow có `trigger` null (tạo bằng API) hoặc trigger không đăng ký: như `flow.vue:167-181` và `options-overview.vue:18`,
  panel Trigger hiện tiêu đề `t('triggers.<type>.name')` (vue-i18n trả về khóa thô khi thiếu), không overview; drawer tab
  Trigger Setup không chọn mục nào và form rỗng; Save ở tab Flow Setup gửi `trigger` và `options` như store (không xóa).
- Mở `/settings/flows/<id>` của flow vừa tạo ở app kia sau khi đã đăng nhập: store chưa có flow → màn không tìm thấy
  tới khi tải lại trang (như Directus: store chỉ nạp khi đăng nhập và sau ghi); bảng flow cũng chưa có dòng đó.
- Người không admin mở URL `/settings/flows(/*)`: module Settings không đăng ký (`preRegisterCheck` 012) nên rơi vào màn
  không tìm thấy của app như 016; admin luôn qua quyền `directus_operations` (`admin_access`).
- `trigger.flow` trỏ tới flow đã xóa hoặc đã đổi trigger khác `operation`: select hiện giá trị thô (như
  `select-dropdown`), overview hiện id thô.
- `options` của operation null hoặc không phải object (dữ liệu cũ): overview gọi với `{}`; drawer mở với `{}`.
- Flow rất lớn hoặc panel ở xa: không giới hạn số operation; canvas lớn theo biên panel và cuộn; hiệu năng chỉ cam kết
  tới 50 operation (FR-108).
- Revision có `data` null hoặc thiếu `steps`: không có bước, trạng thái không phải `resolve` (icon `cancel`), drawer
  chỉ có bước Trigger.
- Tên flow hoặc operation rất dài: cắt một dòng với "…" ở ô bảng (`BoTable`), tiêu đề trang (`PageHeader`, chuỗi đầy
  đủ ở `title`) và tiêu đề panel (tooltip `key` giữ) (Q-30).
- Máy tính bảng cảm ứng: kéo panel và kéo mũi tên dùng pointer events như Directus, không xử lý cảm ứng riêng
  (`touch-action` mặc định) nên chạm kéo có thể cuộn trang thay vì kéo; không bảo đảm, ghi trong ngoại lệ a11y
  (FR-106); E2E chỉ dùng chuột.

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| Mọi story | — | FR-001 đến FR-006 (route, sub-menu, khung màn, store) | SC-001 |
| US1 | 1–7 | FR-010 đến FR-016 | SC-001, SC-002, SC-004, SC-005 |
| US2 | 1–12 | FR-020 đến FR-032 | SC-001, SC-002, SC-005, SC-006 |
| US3 | 1–5 | FR-040 đến FR-045 | SC-001, SC-002, SC-005, SC-006 |
| US4 | 1–5 | FR-050 đến FR-055 | SC-001, SC-003 |
| US5 | 1–4 | FR-060 đến FR-062 | SC-001, SC-003 |
| US6 | 1–4 | FR-100 đến FR-114 (FR-106: ngoại lệ a11y canvas) | SC-002 đến SC-010 |
| Edge Cases | Save lỗi giữa chừng | FR-030, R-47 | SC-006 |

## Requirements *(mandatory)*

### Functional Requirements

**Route, sub-menu và khung màn**

- **FR-001**: Module `settings` PHẢI thay hai route khung `flows` của 016 (`modules/settings.ts:165-172`,
  `ModulePlaceholder`) bằng `settings-flows-collection` (`/settings/flows`), `settings-flows-item`
  (`/settings/flows/:primaryKey`, `props: true`, `beforeEnter` tra `useFlowsStore().flows`, thiếu → `settings-not-found`
  với `params._`), con `settings-flows-operation` (`:operationId`, `props: true`, `meta.isFloatingView`, vẽ qua
  `RouterView` không tên của trang flow với props `operation`, `existing-operation-keys`, `flow` và sự kiện `save`,
  `cancel`, như `flow.vue:778-784`; khác named view `add` của `settings-add-new` 016); test `modules/settings.test.ts:67-68` cập nhật (`/settings/flows/3f2a`
  → `settings-flows-item`, thêm `/settings/flows/3f2a/+` → `settings-flows-operation`). D-92 gỡ.
- **FR-002**: `get-item-route.ts` giữ `directus_flows: { route: '/settings/flows' }` (item → `/settings/flows/:pk`);
  nay là màn thật (D-72 gỡ phần `directus_flows`). `directus_operations` không có trong bảng ánh xạ của Directus
  (`utils/get-route.ts`, đã kiểm 2026-10-17) nên `/content/directus_operations` giữ như Directus (không chuyển hướng).
- **FR-003**: Mục "Flows" của sub-menu Settings (016 Q-24, `SettingsNavigation.vue:20`) giữ vị trí và nhãn; active
  theo tiền tố `/settings/flows`.
- **FR-004**: Mọi màn PHẢI dùng `PageHeader` (tiêu đề, nút; không breadcrumb D-101), `DetailPanel` L-4 cho mục Logs,
  hộp `unsaved_changes` với Keep Editing trước (D-76), notice tại chỗ (D-45, D-66), hộp lỗi `showUnexpectedError` khi
  request lỗi. Trạng thái nạp: bảng flow `BoTable loading`; canvas vẽ từ store (đã hydrate ở đăng nhập) nên không
  skeleton, chỉ `SettingsNotFound` khi không có; danh sách log là `BoProgressLinear indeterminate` khi chưa có dữ liệu
  và đang nạp (như `logs-sidebar-detail.vue:86`).
- **FR-005**: Store flows (012) PHẢI giữ `hydrate` (`GET /flows?fields=*,operations.*`, không quyền → `[]`),
  `getManualFlowsForCollection`, `isActiveFlow`; mọi thao tác ghi của 017 gọi `hydrate()` sau khi xong như Directus
  (không cập nhật lạc quan); không thêm hàm ghi vào store (các màn gọi SDK trực tiếp như Directus).
- **FR-006**: Hộp xác nhận xóa flow, hộp Clear Changes, hộp Copy To là `BoDialog` thường (bấm ra ngoài đóng = Cancel,
  như `v-dialog` của Directus); chỉ drawer flow và drawer operation là `persistent`; drawer log không `persistent`
  (`logs-drawer.vue:72-77`), đóng bằng Esc, bấm ngoài hoặc nút đóng. Focus vào lựa chọn an toàn
  (Cancel / Keep Editing).

**Danh sách flow và drawer flow (US1)**

- **FR-010**: Màn `/settings/flows` PHẢI dựng bảng như kịch bản US1-1 từ store, không gọi API khi vào route (như
  `overview.vue`; store nạp ở đăng nhập và sau mỗi ghi), sắp xếp client bằng `sortBy` theo cột, mặc định `{by: 'name', desc: false}`; không có mục
  panel chi tiết (Directus chỉ có navigation); `PrivateView fill` (D-99) để chỉ thân bảng cuộn.
- **FR-011**: Nút "+" PHẢI khóa khi `useCollectionPermissions('directus_flows').createAllowed === false` với tooltip
  `not_allowed`, không thì tooltip `create_flow`; trạng thái rỗng như kịch bản US1-2.
- **FR-012**: Drawer flow PHẢI là port của `flow-drawer.vue`: props `primaryKey` (`+` mặc định), `startTab`; hai tab
  dọc (`BoTabs orientation vertical` trong cột trái của drawer, 016 Q-22), tab 2 khóa khi tên rỗng; field và mặc định
  như kịch bản US1-3; `BoFancySelect` năm trigger và `BoForm` options với `primary-key="+"`; quy tắc reset options như
  kịch bản US1-4; nút theo tab: Next (`arrow_forward`, flow mới ở tab 1), Save (`check`, flow có sẵn), Finish Setup
  (`check`, flow mới ở tab 2); `@apply` của drawer theo cùng logic; lưu như kịch bản US1-5 và US1-6; emit `done(id)`
  và `cancel`. Option fields của năm trigger PHẢI đúng `triggers.ts`:
  - `event`: `type` (`select-radio` `filter` "Filter (Blocking)" / `action` "Action (Non-Blocking)"); khi `action`:
    `scope` (`select-multiple-dropdown`, monospace) với `items.create|update|delete|promote|sort`, vạch,
    `server.start|stop`, `response`, `auth.login`, `files.upload`, `extensions.load|unload|reload|installed|
    uninstalled`; khi `filter`: `items.create|update|delete|promote`, vạch, `request.not_found`, `request.error`,
    `database.error`, `auth.login|jwt|create|update`, `authenticate`, `email.send`, và `return` (`select-radio`
    `$last`/`$all`, `allowOther`); `collections` (`system-collections`, csv) chỉ đọc khi scope không có `items.*`,
    `includeSystem` false chỉ khi scope chỉ gồm `items.promote`/`items.sort`; overview Type, Scope, Collections (`--`
    khi rỗng).
  - `webhook`: `method` GET/POST (mặc định GET), `async` (bắt buộc, mặc định false), `error_on_reject` (ẩn khi async),
    `return` (`$last`/`$all`/khác, mặc định `$last`, ẩn khi async), `cacheEnabled` (mặc định true, ẩn khi không GET),
    `cacheQueryParams` (tags, ẩn khi cache tắt hoặc không GET); overview Method và URL `${getApiUrl()}flows/trigger/<id>`
    `copyable` (Edge Cases).
  - `schedule`: `cron` (`input`, placeholder `* * 1 * * *`); overview Interval.
  - `operation`: chỉ `return`; overview rỗng.
  - `manual`: `collections` (`system-collections`), `async` (mặc định false), `error_on_reject` (ẩn khi async),
    `location` (`both`/`collection`/`item`, mặc định `both`), `requireSelection` (mặc định true, ẩn khi `location
    item`), vạch "Confirmation Dialog" (`quiz`), `requireConfirmation` (mặc định false), `confirmationDescription`
    (`system-input-translated-string`, placeholder `$t:run_flow_confirm`, ẩn khi không xác nhận), `fields`
    (`system-inline-fields`, ẩn khi không xác nhận); không có `return`; overview mô tả + Collections.
  Lưu lỗi (`POST`/`PATCH`): như `flow-drawer.vue:148-151`, hộp lỗi, drawer còn mở, giá trị giữ, nút hết loading.
- **FR-013**: Menu dòng PHẢI như kịch bản US1-6 (ba mục, không nhân bản); đổi trạng thái gửi `PATCH /flows/:id
  {status}` ngay rồi `hydrate()`; lỗi → hộp lỗi, store không đổi (badge giữ giá trị cũ), như `overview.vue:132-140`.
- **FR-014**: Hộp xóa PHẢI như kịch bản US1-6; sau xóa `hydrate()`; lỗi ở bảng → hộp lỗi, dòng còn (như
  `overview.vue:116-128`); từ trang flow thì về danh sách kể cả khi lỗi
  (US2-11).
- **FR-015**: Sau `done` của drawer: tạo mới → `router.push('/settings/flows/<id>')`; sửa → chỉ đóng drawer.
- **FR-016**: Body ghi của US1: `POST /flows?fields=id {name, icon, color, description, status, accountability,
  trigger, options}`; `PATCH /flows/:id` cùng body (drawer) hoặc `{status}` (menu); `DELETE /flows/:id`; request đọc:
  `GET /flows?fields[]=*&fields[]=operations.*` (hydrate). Thêm vào `allowed-paths.ts` (#33, #48 đã có).

**Canvas trình sửa (US2)**

- **FR-020**: Trang `/settings/flows/:primaryKey` PHẢI là port của `flow.vue`: flow hiển thị = flow trong store gộp
  `stagedFlow` (`status`, `operation`) và `stagedPanels`; `editMode` ban đầu true khi 0 operation hoặc có
  `operationId`; header hai chế độ như kịch bản US2-1 và US2-3; tiêu đề với chấm trạng thái; `SettingsNotFound` khi
  flow không có trong store.
- **FR-021**: Lưới và kích thước PHẢI theo `constants.ts`: `GRID_SIZE 18`, panel 14×14 ô, `ATTACHMENT_OFFSET (0,
  3·18)`, `RESOLVE_OFFSET (14·18, 10·18)`, `REJECT_OFFSET (14·18, 12·18)`; `position_x/y` là ô 1-based lưu trên
  operation; panel Trigger ảo `$trigger` ở (1,1), không kéo, `resolve = flow.operation`; kích thước canvas tính theo ô
  lưới trên cả hai trục: chế độ sửa `(x + width + 25) × 18` px, chế độ xem `(x + width − 1) × 18` px với `x`, `width`
  của panel xa nhất (`v-workspace.vue:76-86`); SVG mũi tên = biên panel xa nhất + 100 px.
- **FR-022**: Panel operation PHẢI như kịch bản US2-1: header icon và tên loại (hoặc "Trigger"/`offline_bolt`), thân
  `options-overview` (tiêu đề `name`, tooltip `key`; `<dl>` từ `overview(options, {flow})` đã `translate`, nút sao
  chép khi `copyable` và trình duyệt hỗ trợ clipboard (`use-clipboard`, chuỗi `copy_raw_value_success`/
  `copy_raw_value_fail` hiện bằng notice tại chỗ, D-45)), chân panel Trigger với chấm + select trạng thái (sửa) hoặc chữ (xem); lớp mờ khi flow inactive
  hoặc panel lẻ (không cha hoặc chuỗi cha không về `$trigger`, `flow.vue:202-239`); panel là con reject dùng màu phụ;
  loại không đăng ký → không overview, lỗi vẽ vào error boundary `unexpected_error`. Mọi chuỗi người dùng nhập (tên
  flow, tên và key operation, text của overview, JSON log) hiện bằng nội suy chữ, không HTML (như Directus).
  Vị trí ô của panel ghi ở `data-pos-x`, `data-pos-y` trên `[data-panel-key]` để E2E đọc (SC-002).
- **FR-023**: Tay cầm và nút gợi ý PHẢI như kịch bản US2-3: resolve (`check_circle`, màu chính) hiện ở chế độ sửa hoặc
  khi có link; reject (`cancel`, màu phụ) và điểm nhận (`adjust`) chỉ ở operation; nút "+" khi rê chuột ở chế độ sửa và
  tay cầm chưa nối (luôn ở resolve của Trigger); tooltip `operation_handle_resolve`/`operation_handle_reject`; click
  (pointerup không di chuyển) ở tay cầm chưa có con (hoặc con đang chờ xóa) → `create` (US2-5).
- **FR-024**: Mũi tên PHẢI là port nguyên `components/arrows/*` (`generate-arrows`, `create-line`,
  `find-best-position`, `generate-path`, `get-points`, `generate-corner`, `min-max-point`, `range`,
  `is-point-in-panel`) với các `.test.ts` của Directus port đạt 100%; vẽ như kịch bản US2-2; nhánh gợi ý 3 ô; mũi tên
  đang kéo tới con trỏ; không nhánh RTL (xem Cần xác nhận).
- **FR-025**: Kéo panel PHẢI như kịch bản US2-4 (port `v-workspace-tile.vue`): bám lưới, tối thiểu 1, nhãn
  `(x-1:y-1)`, không đổi cỡ, throttle 20 ms, chỉ chế độ sửa, Trigger không kéo; chỉ chuột/pointer như Directus (ngoại lệ a11y, Clarifications 2026-10-17).
- **FR-026**: Kéo nối PHẢI như kịch bản US2-6 (`flow.vue:503-574`): điểm nhận gần nhất trong 40 px, từ chối vòng, gỡ
  link cũ vào đích, thả ra ngoài = tháo; Trigger ghi `stagedFlow.operation`; chỉ chuột/pointer như Directus (ngoại lệ a11y).
- **FR-027**: Staging PHẢI như `flow.vue:244-302`: id tạm `_<nanoid>`, gán link ở cha, vị trí con resolve `(x+18, y)`,
  reject `(x+18, y+16)`, không cha `(15,15)`; sửa operation có sẵn gộp vào `stagedPanels`.
- **FR-028**: Menu panel PHẢI như kịch bản US2-7: Duplicate (bỏ `id`, `resolve`, `reject`; +2/+2; key `<key>_<5 a-z>`),
  Copy To (hộp chọn flow khác; `POST /operations` ngay với panel bỏ `id`, `date_created`, `user_created`, `resolve`,
  `reject`, `flow` đích; `hydrate()`), Delete (không hộp xác nhận; `panelsToBeDeleted`; gỡ link ở cha; con không nối
  lại).
- **FR-029**: Pencil ở Trigger PHẢI mở drawer flow `startTab trigger_setup` và lưu ngay bằng `PATCH /flows/:id` ngoài
  staging; pencil ở operation mở `/settings/flows/:id/<operationId>` (id tạm `_…` cũng mở được).
- **FR-030**: Save PHẢI như kịch bản US2-9 (`saveChanges`, `flow.vue:310-384`): không thay đổi → chỉ thoát chế độ
  sửa; có → `getTrees` từ panel gốc, bỏ id tạm, `PATCH /operations [{id, resolve|reject: null}]` cho link cũ sẽ nối
  lại, rồi `PATCH /flows/:id {...stagedFlow, operation, operations: {create, update, delete}}`; `hydrate()`, xóa
  staging, thoát chế độ sửa; `Ctrl/Cmd+S` qua `use-shortcut` (không khi drawer operation hoặc drawer trigger mở);
  lỗi → hộp lỗi, staging và chế độ sửa giữ, Save lại gửi lại toàn bộ (Edge Cases, R-47). Vòng trong dữ liệu → dừng
  và hộp lỗi (D-105).
- **FR-031**: Clear Changes và guard PHẢI như kịch bản US2-10 (`use-edits-guard` với `ignorePrefix
  '/settings/flows/<id>'`; `hasEdits` = `stagedPanels` hoặc `panelsToBeDeleted` khác rỗng; `stagedFlow` một mình không
  tính, R-44).
- **FR-032**: Body ghi của US2: `PATCH /operations` (mảng), `PATCH /flows/:id` (Save với `operations` lồng; drawer
  trigger), `POST /operations` (Copy To), `DELETE /flows/:id`.

**Drawer operation và 15 operation (US3)**

- **FR-040**: Drawer operation PHẢI là port của `operation-detail.vue` qua `use-dialog-route`: props `operation`,
  `existingOperationKeys` (đã lưu trừ đã xóa, cộng staging), `flow`; drawer `persistent`, tiêu đề, phụ đề, icon, nút
  Done như kịch bản US3-1; Name và Key như kịch bản US3-1 (`slugify` của `@sindresorhus/slugify` với `separator '_'`,
  `BoInput dbSafe`); fancy select 15 loại như kịch bản US3-2; đổi loại → `options = {}`; notice `operation_not_found`
  với link đặt lại khi loại lạ; Done emit như kịch bản US3-4; Cancel về route flow.
- **FR-041**: Registry operation app-side PHẢI có 15 mục đúng `operations/<id>/index.ts` (cùng `id`, `icon`, `name`,
  `description` là khóa `$t:operations.<id>.*`, `overview`, `options`), sắp theo `id`, kiểu `OperationAppConfig`
  (`@directus/types` 15.0.3 đã có); không có registry extension (XI). Chi tiết field (tên, kiểu, interface, width, mặc
  định, điều kiện ẩn) PHẢI khớp nguồn; tóm tắt:
  - `condition`: `filter` json `input-code` (JSON) full, placeholder = template `{"$trigger":{"category":{"_eq":
    "Example"}}}`; overview `condition_rules`.
  - `exec`: `code` string `input-code` JavaScript full, mặc định `module.exports = async function(data) {\n\t// Do
    something...\n\treturn {};\n}`; overview rỗng.
  - `item-create`: `collection` (`system-collection`, half, bắt buộc), `permissions` PERM half, `emitEvents` boolean
    half mặc định false, `payload` json `input-code` full placeholder `item_payload_placeholder`; overview Collection,
    Payload. PERM = `select-dropdown` mặc định `$trigger`, choices "From Trigger" `$trigger`, "Public Role" `$public`,
    "Full Access" `$full` (chữ literal), `allowOther`.
  - `item-delete`: `collection`, PERM half, `emitEvents`, `key` csv `tags` half `iconRight vpn_key`, `query` json
    `input-code` full template `{"filter":{"status":{"_eq":"active"}}}`; overview Collection, Key (`toArray(key).join(',
    ')` hoặc `--`).
  - `item-read`: PERM **full** trước, `collection`, `key`, `query`, `emitEvents` (nhãn dùng khóa
    `operations.item-create.emit_events` như nguồn); overview như item-delete.
  - `item-update`: `collection`, PERM half, `emitEvents`, `key`, `payload`, `query`; overview như item-delete.
  - `json-web-token`: `operation` select `sign`/`verify`/`decode` full không mặc định; `sign` → payload (json
    `input-multiline` monospace), secret (`input`), options (json `input-code`); `verify` → token, secret, options;
    `decode` → token, options; overview Operation.
  - `log`: `message` `input` full placeholder, note `operation_variables_note`; overview Message.
  - `mail`: `to`, `subject`, `cc`, `bcc`, `replyTo` (csv `tags`/`input` full với `iconRight`), `type` select half mặc
    định `markdown` (`markdown`/`wysiwyg`/`template`), `template` half placeholder `base` (chỉ `template`), `body`
    text full (`input-rich-text-html` khi `wysiwyg`, không thì `input-rich-text-md`; ẩn khi `template`), `data` json
    `input-code` full (chỉ `template`); overview Subject, To, Type, và CC/BCC/Reply-To khi có. Form giữ nguyên dù API
    chỉ ghi log (D-34); đầu form có `BoNotice` info khóa overlay `operations_mail_not_sent_notice` (D-106): en-US
    "Backoffice does not send email. This operation only writes a log entry and returns success.", vi-VN "Backoffice
    không gửi email. Operation này chỉ ghi log và trả kết quả thành công."; "Backoffice" là tên sản phẩm (IX); không đổi
    field hay giá trị ghi.
  - `notification`: `recipient` csv `tags` half (`people_alt`, note), PERM half, `subject` `input` full, `message`
    `input-rich-text-md` full, `collection` `system-collection` half (không bắt buộc), `item` `input` half (`vpn_key`,
    note); overview Subject, Message.
  - `request`: `method` select half GET/POST/PATCH/DELETE `allowOther` mặc định GET, `url` `input` half, `headers`
    json `list` full (`header`, `value` bắt buộc, half), `body` text `input-multiline` monospace full; overview URL,
    Method (`?? GET`).
  - `sleep`: `milliseconds` integer `input` full `{min 0, type integer, placeholder 1000}`; overview Milliseconds.
  - `throw-error`: `code` select mọi `ErrorCode` (danh sách chép từ `directus/packages/errors/src/codes.ts`, test so
    với `libs/errors/src/codes.ts`) `allowOther` placeholder
    `INTERNAL_SERVER_ERROR`, `status` select 400/401/403/404/405/422/429/500 (chuỗi) `allowOther` placeholder `500`,
    `message` `input` placeholder "An unexpected error occurred."; overview Code, Status, Message với fallback đó (giống
    `InternalServerError` của Directus và `libs/errors`, đã kiểm 2026-10-17).
  - `transform`: `json` json `input-code` full template `{"user":"{{ $accountability.user }}","data":"{{ $last }}"}`;
    overview JSON.
  - `trigger`: `flow` select half `iconRight bolt` placeholder `a_flow_uuid` với choices = flow trong store có
    `trigger === 'operation'` (text = name, value = id, không `allowOther`), `iterationMode` json select half
    `parallel`/`serial`/`batch` mặc định `parallel` (note), `batchSize` integer half mặc định 10 chỉ khi `batch`,
    `payload` json `input-code` full (template như transform); overview Flow (id thô, không resolve tên).
- **FR-042**: `ExtensionOptions` (016) PHẢI nhận `type 'operation'` (ngoài `interface`/`display`) và không phụ thuộc
  `useFieldDetailStore` khi `type operation` (`collection`/`field` không có); options dạng hàm do drawer gọi với
  options hiện tại (một đối số) rồi `translate` như `operation-detail.vue:116-125`; `raw-editor-enabled` cho mọi
  field.
- **FR-043**: Options lưu PHẢI là `{...getDefaultValuesFromFields(fields), ...options}` (port
  `utils/get-default-values-from-fields.ts` nếu 013/016 chưa có).
- **FR-044**: Registry 15 operation PHẢI có test so với nguồn Directus (đọc `directus/app/src/operations/<id>/index.ts`
  trong test, so JSON của `options` tĩnh/hàm với cùng đối số mẫu và `overview` với cùng options mẫu), như test so
  nguồn của 013 FR-005.
- **FR-045**: Body ghi của US3: không có request riêng (operation vào staging, ghi ở FR-030); request đọc: `GET /flows`
  (store) cho `trigger.flow`.

**Log chạy (US4)**

- **FR-050**: Mục Logs PHẢI là port của `logs-sidebar-detail.vue` trên `use-revisions` (014) với tham số `('directus_flows',
  id, null, {action: 'run', full: true})`: request như kịch bản US4-1 (gồm request đếm `aggregate[count]=id`; request
  "created" của `use-revisions` giữ như Directus dù không dùng, xem Cần xác nhận); nạp như kịch bản US4-1.
- **FR-051**: Danh sách PHẢI nhóm theo ngày bằng `RevisionsDateGroup` (014 Q-10), dòng như kịch bản US4-2, toggle
  `show_failed_only` client-side trang hiện tại, phân trang và trạng thái rỗng như kịch bản US4-3; không hiện user/IP.
- **FR-052**: Drawer log PHẢI là port của `logs-drawer.vue` như kịch bản US4-4: `BoDrawer`, dòng thời gian dọc, `BoDetail`
  cho Options/Payload/Accountability của bước Trigger (Options = `flow.options` hiện tại, R-45) và Options/Payload của
  từng bước; JSON `<pre>` pretty 2 khoảng trắng; chấm màu theo status (mặc định và `resolve` = màu chính, `reject` = màu phụ, như `logs-drawer.vue:193-203`). Chỉ
  admin xem; dữ liệu đã redact ở API (`--redacted--`) hiện nguyên, không che thêm (như Directus).
- **FR-053**: Số đếm PHẢI nạp khi mount trang flow (không chờ mở mục) để badge hiện; danh sách nạp lười.
- **FR-054**: Request đọc của US4: `GET /revisions` (danh sách, đếm) với filter đúng kịch bản US4-1; so với Directus
  ở bộ so payload đọc (FR-101).
- **FR-055**: Không có chỉ báo "chưa xem", không tự nạp lại khi có lần chạy mới, không nút Refresh (như Directus);
  danh sách mới khi đổi trang log, bật/tắt lọc hoặc tải lại trang.

**Nút chạy thủ công (US5)**

- **FR-060**: Không viết lại `use-run-manual-flow`, `FlowSidebarDetail`, `FlowDialogs` (014); 017 PHẢI gọi
  `flowsStore.hydrate()` sau mọi thao tác ghi để nút trên trang item/danh sách phản ánh flow mới trong cùng phiên.
- **FR-061**: E2E `settings-flows-manual.spec.ts` PHẢI đi hết luồng US5 Independent Test ở ba cấu hình và so request
  `POST /flows/trigger/:id` với Directus app (bộ so payload).
- **FR-062**: `system-manual-flow-select` (016) PHẢI liệt kê flow manual mới sau `hydrate()` (test component có sẵn mở
  rộng một ca).

**Đối chiếu, kiểm thử, chất lượng (US6)**

- **FR-100**: E2E `settings-flows-overview.spec.ts`, `settings-flows-editor.spec.ts`, `settings-flows-operations.spec.ts`,
  `settings-flows-logs.spec.ts`, `settings-flows-manual.spec.ts`, `settings-flows-cross-use.spec.ts` (FR-102) PHẢI
  chạy ở ba cấu hình như 014–016; `settings-flows-editor` chạy cả firefox-1280 và webkit-1280 ở cùng origin (kéo thả
  pointer events); spec điều khiển Directus app chỉ chromium-1280 (`DIRECTUS_APP_SPECS`); `settings-parity-ui.spec.ts`
  thêm bảng flow, trang flow, drawer flow, drawer operation. Không E2E nào chạy `bo_all_ops` (log của nó chỉ do seed
  tạo, badge 3 ổn định); E2E tạo và chạy flow tạm tên `web-e2e-<cfg>-<spec>-<n>`, xóa ở `afterAll`. Trong spec,
  `bo_manual` và `bo_manual_item` là tên logic của các flow tạm đó (không thuộc bộ mẫu `bo_flows`). Nếu webkit flake
  với kéo pointer, test kéo đánh `test.fixme` riêng cho webkit kèm lý do ghi ở bảng trạng thái (SC-001).
- **FR-101**: Bộ so payload `apps/web-e2e/src/payload/flows.spec.ts` PHẢI so body ghi của FR-016, FR-032 và request
  `POST /flows/trigger/:id`, cùng request đọc `GET /revisions` của FR-054 với Directus app cùng kịch bản sau chuẩn hóa
  (id, id tạm `_…` đã bỏ trước gửi, thời gian, 5 ký tự ngẫu nhiên của key nhân bản và placeholder key → `*`; object so không
  theo thứ tự khóa; mảng giữ thứ tự trừ `operations.create/update/delete` sắp theo `key`); bộ so DB (`helpers/db-rows.ts`) thêm `directus_flows`,
  `directus_operations` vào bảng mới `FLOWS_TABLES` (bỏ `id`, `date_created`, `user_created`, và
  với operation mới: `flow` ánh xạ theo tên).
- **FR-102**: Kịch bản dùng chéo PHẢI có trong E2E ở `proxy-api`: (a) flow `bo_manual` + 4 operation tạo ở app mới
  (US2 Independent Test) → mở `/admin/settings/flows/<id>` trên Directus app 8155 bằng Playwright → so vị trí panel
  (Directus: biến CSS `--pos-x`, `--pos-y` của `.v-workspace-tile`; Backoffice: `data-pos-x`, `data-pos-y`), số mũi tên và lớp nhánh, mở drawer operation `condition` và so
  `filter`; sửa trên Directus app (thêm `log` vào reject của `transform`, lưu) → nạp lại app mới → panel mới đúng vị
  trí và mũi tên; (b) ngược lại: tạo flow và operation trên Directus app → tải lại app mới (Edge Cases) → mở → so như (a); (c) chạy
  `bo_manual` từ trang item ở cả hai app → cùng số log và cùng bước (US4); (d) flow có `trigger operation` tạo ở app
  mới xuất hiện trong select `trigger.flow` của Directus app.
- **FR-103**: Bộ mẫu `bo_flows` PHẢI seed qua Directus REST (`apps/web/fixtures/interfaces` mở rộng `flows.json` và
  thêm `operations.json`; snapshot commit; parity `tests/parity/src/web/fixtures-seed.test.ts` mở rộng): giữ `bo-flow`,
  `bo-flow-content`, `bo-flow-item` của 013/014; thêm `bo_all_ops` (manual trên `bo_content`, 15 operation mỗi loại
  một; chỉ nhánh không tác dụng phụ chạy: resolve `condition → log → transform → sleep (10 ms) → json-web-token (sign,
  secret literal) → item-read (`bo_content` key 1) → exec (trả `{}`) → trigger (`bo_child`)`, reject của `condition` →
  `throw-error`; sáu operation có tác dụng phụ `item-create`, `item-update`, `item-delete`, `request` (URL
  `http://127.0.0.1/`), `mail`, `notification` là chuỗi dưới reject của `log`, không bao giờ chạy; vị trí trải trên
  lưới), `bo_webhook` (webhook GET, cache bật, 2
  operation), `bo_schedule` (inactive, cron `0 0 * * * *`, 1 operation), `bo_child` (trigger `operation`, 1 `log`;
  `bo_all_ops` có `trigger` trỏ tới nó), `bo_event` (action `items.create` trên `bo_content`, 1 `log`), `bo_orphan`
  (1 operation không nối, 1 operation có `type` lạ `bo-unknown` để kiểm Edge Cases). Seed lại giữa hai lượt so
  payload. Log mẫu: chạy `bo_all_ops` 3 lần trong seed để US4 có dữ liệu (2 resolve, 1 reject khi `reason` là `fail`); seed thử
  lại `POST /flows/trigger/:id` tối đa 10 lần cách 500 ms khi API chưa nạp flow (bus reload); `fixtures-seed.test.ts`
  bỏ `directus_revisions`, `directus_activity` khi so hai app.
- **FR-104**: Test component với mock API (allowlist như 013): drawer flow (5 trigger, reset options, nút theo tab),
  drawer operation (15 loại, key tự sinh, duy nhất, loại lạ), canvas (staging: thêm/nối/tháo/xóa/nhân bản/Save body),
  arrows lib (port `.test.ts` Directus), Logs (nhóm ngày, lọc, phân trang, drawer), `ExtensionOptions type operation`;
  `use-run-manual-flow` test có sẵn mở rộng cho flow mới sau `hydrate`.
- **FR-105**: Registry 15 operation sinh tay (port) nhưng PHẢI có test so nguồn (FR-044); không có dữ liệu tĩnh sinh
  bằng script (khác 016 FR-105).
- **FR-106**: A11y: kéo panel, kéo nối/tháo mũi tên và nút "+" ở tay cầm chỉ bằng chuột/pointer như Directus (owner
  chọn B, Clarifications 2026-10-17): ghi ngoại lệ a11y cho canvas (WCAG 2.1.1) trong `design-system/qa/handoff-checklist.md` (gồm cả
  thao tác cảm ứng trên máy tính bảng, Edge Cases), tech lead duyệt trước khi đóng; không thêm menu di chuyển/nối. Những gì Directus đã có bằng phím vẫn phải tới được bằng
  phím: nút pencil, menu `more_vert` (Duplicate, Copy To, Delete), select trạng thái ở chân Trigger, nút header, drawer;
  mũi tên là SVG `aria-hidden`; trạng thái mờ không chỉ bằng màu (sr-only "không nối tới trigger" / "flow inactive");
  drawer có focus trap, Esc, trả focus; axe 0 vi phạm serious/critical ở
  bảng flow, trang flow (hai chế độ), drawer flow (hai tab), drawer operation (3 loại: exec, mail, trigger), mục Logs
  và drawer log, ở sáng và tối (SC-008). Focus sau hành động: tạo flow → tiêu đề trang flow (`h1 tabindex=-1`); Edit Flow
  → nút Save; Save thành công hoặc Clear Changes → nút Edit Flow; Done ở drawer operation → panel vừa tạo hoặc sửa; xóa
  panel → panel cha hoặc Trigger; đóng drawer → phần tử đã mở nó. Chế độ tối: nền lưới `gray-800`, panel `gray-900`
  viền `gray-800`, mũi tên và tay cầm `brand-400`/`orange-400`, `<pre>` JSON nền `gray-900` chữ `gray-300` (Q-29, Q-32). Màu nhánh
  theo Q-29 kèm hình dạng khác nhau (resolve `check_circle`, reject `cancel`, và mũi tên reject nét đứt) để không chỉ
  dựa màu. Tương phản theo `migration-guide.md`; nút icon và tay cầm tối thiểu 32×32 px; `motion-reduce` tắt hiệu
  ứng.
- **FR-107**: Recipe design-system Q-29 đến Q-33 PHẢI viết nháp vào `design-system/docs/component-specs.md` và
  `layout-patterns.md` (mục "Tier 3 recipes (017)") trước khi code màn tương ứng; design owner duyệt trước khi đóng.
- **FR-108**: Hiệu năng (ngân sách máy tham chiếu nhân `machineFactor()` như 014 R14; trung vị 3 lần; chromium;
  `PERF=1`): canvas 50 operation với 60 mũi tên vẽ dưới 500 ms sau khi store sẵn; mỗi lần di chuyển khi kéo,
  `generateArrows` cho 50 panel dưới 8 ms; mở drawer operation dưới 200 ms; danh sách log 10 dòng dưới 300 ms sau `GET
  /revisions`; số request: mở `/settings/flows` = 0 (store); mở trang flow = 0 (store) + 1 đếm log (+ 2
  khi mục Logs đang mở: danh sách và request "created" của `use-revisions`, như Directus); Save = n `PATCH /operations` (số link gỡ, thường 0) + 1 `PATCH /flows/:id` + 1
  `GET /flows`; không benchmark hằng tuần (màn quản trị).
- **FR-109**: Bundle: canvas (arrows, workspace), registry operation, drawer log là chunk lười; chunk chính ≤ ngân sách
  016 + 20 KB gzip; chunk lười: canvas ≤ 60 KB, registry operation ≤ 25 KB, drawer log ≤
  15 KB gzip; `scripts/check-bundle.mjs`.
- **FR-110**: Không request ngoài danh sách FR-016, FR-032, FR-045, FR-054 (`contracts/api-calls.md` #178–#184, cùng
  #33, #48 đã có) và danh sách 012–016 (`allowed-paths.ts`,
  `KNOWN_REQUESTS`); 0 request ra ngoài.
- **FR-111**: Không sửa file trong `directus/`; không sửa `apps/api` trừ khi T002 phát hiện lệch so với Directus (khi
  đó thêm task sửa API kèm parity 009).
- **FR-112**: Chia lượt commit: lượt 1 route, bảng, drawer flow, 5 trigger (US1); lượt 2 canvas, panel, mũi tên, kéo
  thả, staging, Save, menu panel (US2) + drawer operation và registry 15 operation, `ExtensionOptions type operation`
  (US3); lượt 3 Logs và drawer log (US4), E2E manual (US5); lượt 4 bộ so payload, bộ so DB, dùng
  chéo, parity UI, perf, bundle, a11y, recipe (US6); mỗi lượt commit lên `main` với CI xanh.
- **FR-113**: Thư viện mới: không; web không phụ thuộc lib workspace (danh sách `ErrorCode` chép, FR-041) (`nanoid`, `@sindresorhus/slugify`, `codemirror`, `vuedraggable` đã có trong
  `apps/web/package.json`; không thêm thư viện node-graph hay pan-zoom: canvas là lưới CSS + SVG như Directus).
- **FR-114**: Tài liệu: spec 016 (D-92 ghi "đã gỡ ở 017"), 014 (D-72 phần `directus_flows`), `CLAUDE.md` Active
  Technologies thêm dòng 017; `SPECKIT-GUIDE.md` ghi chú cho 018 nếu có (ví dụ `/content/directus_operations`);
  `graphify update .` sau mỗi lượt. D-105, D-106, R-43 đến R-47 và ngoại lệ a11y của canvas (FR-106) được tech lead duyệt
  trước khi đóng.

### Key Entities *(include if feature involves data)*

- **Flow** (`directus_flows`): `id` (uuid), `name`, `icon` (mặc định `bolt`), `color`, `description`, `status`
  (`active`/`inactive`), `trigger` (`event`/`webhook`/`schedule`/`operation`/`manual`), `accountability`
  (`all`/`activity`/null), `options` (JSON theo trigger), `operation` (uuid operation đầu), `date_created`,
  `user_created`; quan hệ o2m `operations`. Nguồn: store flows (`GET /flows?fields=*,operations.*`).
- **Operation** (`directus_operations`): `id`, `name`, `key` (duy nhất trong flow), `type` (một trong 15 id hoặc
  extension), `position_x`, `position_y` (ô lưới 1-based), `options` (JSON theo loại), `resolve`, `reject` (uuid
  operation con), `flow`, `date_created`, `user_created`. Id tạm `_<nanoid>` chỉ ở client.
- **Trigger definition** (client, `triggers.ts`): `id`, `name`, `icon`, `description`, `options` (fields hoặc hàm),
  `overview(options, {flow})`.
- **Operation definition** (client, `OperationAppConfig`): `id`, `name`, `icon`, `description`, `options` (mảng hoặc
  hàm một đối số), `overview(options, {flow})` → `[{label, text, copyable?}]`.
- **Run log** (`directus_activity` `action run` + `directus_revisions` `collection directus_flows`, `item` = flow id,
  `data: {steps: [{operation, key, status, options}], data: {$trigger, $accountability, $last, <key>: …}}`, `version`
  null). Nguồn: `GET /revisions` qua `use-revisions`.

## Khác biệt so với Directus *(mandatory)*

Mã tiếp theo sau D-103 (016); D-104 bỏ trống (đường bàn phím cho canvas: owner chọn giữ như Directus, không phải khác
biệt). D-39, D-41, D-43, D-45, D-47, D-49, D-52, D-54, D-66, D-68, D-76, D-82, D-99, D-101 áp
dụng cho mọi màn của 017, không lặp. Gỡ ở 017: D-92 (016), D-72 (phần `directus_flows`, 014). D-34 (009: operation
`mail` chỉ ghi log) ảnh hưởng hành vi chạy, không ảnh hưởng màn.

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|------|
| D-105 | `getTrees` khi Save với `resolve`/`reject` tạo vòng trong dữ liệu (ghi tay vào DB; `resolve`/`reject` unique nên vòng vẫn tạo được) | Đệ quy vô hạn (treo tab) [Unverified: kiểm T002 bằng dữ liệu vòng] | Dừng khi gặp lại id trong đường đi và hộp lỗi (`showUnexpectedError`), chế độ sửa giữ | Không chép lỗi làm hỏng màn (như D-97); E2E coi `pageerror` là lỗi; T002 thử dữ liệu vòng trên Directus app: treo thì giữ D-105, không treo thì bỏ mã và làm giống | khác | — |
| D-106 | Form options của operation `mail` trong drawer operation | Chỉ các field của `operations/mail/index.ts` | Thêm `BoNotice` info ở đầu form: Backoffice không gửi email, operation chỉ ghi log và trả thành công (D-34); field và giá trị ghi giữ nguyên | Nguyên tắc X (không gửi email); người dùng cần biết trước khi cấu hình; owner chọn B (Clarifications 2026-10-17) | khác | — |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên; tech lead xác nhận khi duyệt bảng khác
biệt, SC-010):

- Nhánh RTL của kéo mũi tên (`operation.vue`, lật tọa độ khi `document.dir === 'rtl'`): app không có ngôn ngữ RTL (012)
  nên không port; không phải khác biệt hành vi với vi-VN/en-US.
- `trigger-detail.vue` không được Directus import: không port.
- Request "created" của `use-revisions` (Directus gửi thêm một `GET /revisions` tìm bản ghi `create` của item) không có
  tác dụng với flow: giữ như Directus (014 đã port) để bộ so request bằng nhau.
- Chuỗi literal "From Trigger" / "Public Role" / "Full Access" trong PERM và "Filter (Blocking)" / "Action
  (Non-Blocking)" không qua i18n (như nguồn): giữ nguyên.

| Mã | Rủi ro | Nguồn và bằng chứng | Ảnh hưởng | Duyệt |
|----|--------|---------------------|-----------|-------|
| R-43 | Xóa operation không có hộp xác nhận và con không được nối lại (thành panel lẻ) | `flow.vue:429-447` Directus | Người dùng có thể xóa nhầm; Clear Changes hoặc rời không lưu khôi phục được vì chỉ là staging; tái tạo, không sửa | Chờ duyệt |
| R-44 | Guard sửa dở chỉ tính `stagedPanels`/`panelsToBeDeleted`; đổi trạng thái ở chân Trigger hay nối lại Trigger (`stagedFlow`) một mình không chặn rời trang | `flow.vue:578-607` Directus | Mất thay đổi trạng thái chưa lưu khi rời trang; tái tạo | Chờ duyệt |
| R-45 | Drawer log hiện Options của bước Trigger là `flow.options` hiện tại, không phải lúc chạy | `logs-drawer.vue` Directus | Log cũ hiện options mới sau khi sửa trigger; tái tạo | Chờ duyệt |
| R-46 | "Show Failed Only" lọc client trên trang hiện tại (10 dòng), không đổi request | `logs-sidebar-detail.vue:49-63` Directus | Trang có thể rỗng (`no_logs_on_page`) dù có lần thất bại ở trang khác; tái tạo | Chờ duyệt |
| R-47 | Save gửi `PATCH /operations` (gỡ link) rồi `PATCH /flows/:id` trong hai request; bước sau lỗi thì DB còn link đã gỡ | `flow.vue:310-384` Directus | Staging giữ nên Save lại khôi phục; tải lại trang trước khi Save lại thì operation thành panel lẻ, nối lại tay; tái tạo | Chờ duyệt |

## Câu hỏi mở về design-system (Nguyên tắc XII)

Như 014–016: recipe nháp vào `design-system/docs/` trước khi code, design owner duyệt trước khi đóng 017. Q-2 (bảng),
Q-8 (page header), Q-9 (panel), Q-10 (revisions theo ngày), Q-22 (drawer tab dọc), Q-24 (sub-menu Settings), Q-28
(lớp phủ drawer/modal) dùng lại. Design-system chưa có mẫu cho canvas nút–mũi tên, panel operation, dòng thời gian log
(agent khảo sát 2026-10-17: chỉ có Cards grid Q-3, Kanban Q-5, Revisions Q-10 là gần).

| Mã | Câu hỏi | Trạng thái |
|----|---------|------------|
| Q-29 | Canvas flow: nền lưới 18 px (chấm hoặc ô mờ `gray-100`/tối `gray-800`), vùng cuộn hai chiều trong `PrivateView fill`; màu nhánh resolve = `brand-500` và reject = `orange-500` (tối `brand-400`/`orange-400`; owner chọn 2026-10-17 thay `--theme--secondary` hồng của Directus; recipe chỉ còn chốt sắc độ lớp mờ và tay cầm), nét 2 px, mũi tên ">" 8 px, reject nét đứt (a11y); lớp mờ panel lẻ/inactive (`opacity-50`); mũi tên gợi ý 3 ô và nút "+" khi rê chuột | Mở |
| Q-30 | Panel operation 14×14 ô (252 px): header icon + tên loại (nền `gray-50`/tối `gray-800`), tiêu đề `name` với tooltip key, `<dl>` label/text cắt dòng, nút sao chép; tay cầm tròn resolve/reject/attachment nhô ra mép (32 px vùng bấm); panel Trigger với chân trạng thái (chấm + select inline); menu tile `more_vert` và pencil ở góc; nhãn `(x:y)` khi kéo | Mở |
| Q-31 | Drawer operation nổi trên canvas: hàng Name + Key (half/half), fancy select 15 mục (icon, tên, mô tả; dùng `BoFancySelect` của 016 Q-22), form options bên dưới với nút raw editor; notice `operation_not_found` | Mở |
| Q-32 | Mục Logs trong panel: badge số đếm, nhóm ngày (Q-10), dòng icon trạng thái + giờ, toggle "Show Failed Only", phân trang 3 nút; drawer log: dòng thời gian dọc với chấm màu trạng thái, khối Trigger và từng bước, `BoDetail` Options/Payload chứa `<pre>` JSON cuộn ngang | Mở |
| Q-33 | Drawer flow hai tab (Q-22 dùng lại): nhóm "Activity & Logs Tracking" sau vạch chia; tab Trigger Setup với fancy select 5 mục rồi form options; hộp "Copy To…" với select flow; hộp xóa flow; trạng thái rỗng `no_flows` | Mở |

## Clarifications

### Session 2026-10-17

- Q: Nút chạy flow thủ công trên trang item/danh sách có làm lại không? → Không: 014 đã port `use-flows.ts`,
  `FlowSidebarDetail`, `FlowDialogs` và dùng ở Content, `DrawerItem`, `presentation-header`, `presentation-links`
  (Directus cũng chỉ dùng ở các chỗ này, không ở Files/Users); 017 chỉ thêm `hydrate()` sau ghi và E2E hai đầu (US5).
- Q: Đường bàn phím cho kéo thả canvas (di chuyển panel, nối/tháo nhánh)? → B (owner, 2026-10-17): chỉ chuột/pointer
  như Directus, ghi ngoại lệ a11y cho canvas (tech lead duyệt); không thêm menu di chuyển/nối (khác D-96, D-69 vì
  canvas không có danh sách tuyến tính để sắp); mã D-104 bỏ trống (FR-025, FR-026, FR-106, SC-008).
- Q: Có hiện notice "API mới không gửi email" ở form operation `mail`? → B (owner, 2026-10-17): giữ form y Directus và
  thêm `BoNotice` info ở đầu form (D-106, FR-041 `mail`); không đổi field hay dữ liệu ghi.
- Q: Màu nhánh reject khi theme không có `secondary` của Directus? → B (owner, 2026-10-17): resolve `brand-500`, reject
  `orange-500` (tối `brand-400`/`orange-400`), gần sắc của Directus và không trùng màu lỗi của form; reject vẫn nét đứt
  (FR-106); dùng cho mũi tên, tay cầm, icon và chấm trạng thái log (US2, US4, FR-022, FR-023, FR-052, Q-29).
- Q: Có trang `/settings/flows` cho người không admin đọc flow? → Không, module Settings `preRegisterCheck admin_access`
  như Directus; nút chạy thủ công cho người không admin đã ở 014.
- Q: Còn điểm nào cần làm rõ trước plan? → Ba điểm có nhiều cách hiểu (canvas chỉ chuột, notice mail, màu nhánh
  reject) đã chốt; không chặn plan.

## Assumptions

- API mới (009) nhận `PATCH /flows/:id` với `operations: {create, update, delete}` lồng và cây operation lồng (con
  trong `resolve`/`reject` dạng object) như Directus (ItemsService/PayloadService của 004 đã port; parity 009 `crud`
  đã có); plan kiểm T002 bằng bộ so DB với kịch bản US2 Independent Test; lệch là lỗi API, sửa ở `apps/api`.
- `GET /revisions` của API mới (008) nhận filter lồng `activity.action` và `aggregate[count]`, như Directus (parity
  009 `logs.test.ts` đã ghi nhận Logs sidebar đọc được).
- Store flows (012) có `hydrate` nạp `operations.*`; `use-revisions` (014) nhận tham số `action` và `full` như Directus
  (`composables/use-revisions.ts`); thiếu thì mở rộng ở lượt 3 (ghi ở plan).
- `ExtensionOptions` (016) hiện phụ thuộc `useFieldDetailStore` (agent khảo sát 2026-10-17): 017 tách phụ thuộc đó
  khi `type operation` (prop `collection`/`field` tùy chọn) mà không đổi hành vi cho interface/display (test 016 giữ
  xanh).
- `BoFancySelect` (016) nhận mục `{value, icon, text, description}`; `BoTabs` có `orientation vertical`; `BoDialog` có
  `persistent`; `BoInput` có `dbSafe` (016 FR-007); `use-shortcut` hỗ trợ `meta+s`.
- `nanoid`, `@sindresorhus/slugify` có trong `apps/web/package.json` (đã kiểm 2026-10-17); `@directus/errors`
  `ErrorCode` có qua `@directus/types`/`@directus/errors` đã cài (013) hoặc chép danh sách mã với test so nguồn.
- Mọi chuỗi i18n nêu trong spec (`creating_new_flow`, `flow_tracking_*`, `operation_key_unique_error`,
  `no_other_flows_copy`, `show_failed_only`, `triggers.*`, `operations.*`…) có trong `en-US.json` của 012 (đã kiểm
  khối `triggers` dòng 2867 và `operations` dòng 2910).
- Hiệu năng theo máy tham chiếu và `machineFactor()` như 014–016; perf trong `PERF=1`.
- Bộ so DB `helpers/db-rows.ts` đọc Postgres trực tiếp ở `proxy-api`; thêm bảng flows/operations; so sau chuẩn hóa
  `id`, thời gian, `user_created`, và `flow`/`resolve`/`reject` ánh xạ theo `key`.
- Seed `bo_flows` chạy sau `bo_content` (014) vì trỏ collection đó; chạy `bo_all_ops` 3 lần trong seed cần API chạy
  flow thật (manual trigger qua REST), làm trên cả hai app trong parity `fixtures-seed`.
- URL trong overview webhook dùng `getApiUrl()` của 012 (kết thúc bằng `/`, cùng vai trò `getPublicURL()` của
  Directus; đã kiểm 2026-10-17).
- Playwright kéo thả bằng `mouse.move/down/up` với bước nhỏ hoạt động trên pointer events của canvas ở chromium,
  firefox, webkit (014 Kanban đã dùng); nếu webkit flake thì test kéo đánh `test.fixme` cho webkit (FR-100, SC-001).
  Thao tác cảm ứng không có E2E (Edge Cases).
- D-105, D-106, R-43 đến R-47 và ngoại lệ a11y của canvas chờ tech lead duyệt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% kịch bản E2E của US1 đến US6 đạt ở ba cấu hình API (Directus thật, API mới cùng origin, API mới
  khác origin) trên chromium 768 và 1280; cùng origin thêm firefox-1280 và webkit-1280 cho `settings-flows-editor`;
  cors chỉ chromium-1280; spec điều khiển Directus app chỉ chromium-1280 (`DIRECTUS_APP_SPECS`); test kéo trên webkit
  có thể `test.fixme` nếu flake, ghi lý do ở bảng trạng thái (FR-100).
- **SC-002**: Flow `bo_manual` + 4 operation (US2 Independent Test) tạo ở app mới mở được trên Directus app 8155 với
  cùng vị trí panel (sai số 0 ô; ô đọc từ `--pos-x/--pos-y` của Directus và `data-pos-x/y` của Backoffice), cùng số mũi tên và lớp nhánh, cùng options ở drawer từng operation, cùng giá trị ở
  drawer trigger; sửa trên Directus app (thêm operation, đổi vị trí, đổi trạng thái) rồi mở ở app mới thấy đúng; và
  ngược lại (tạo ở Directus app, mở và sửa ở app mới, lưu, Directus app thấy đúng); dòng `directus_flows`,
  `directus_operations` bằng dòng Directus app ghi cho cùng thao tác sau chuẩn hóa — đây là tiêu chí "flow tạo ở app
  mới mở và sửa được trên Directus, và ngược lại".
- **SC-003**: Chạy `bo_manual` từ trang item và danh sách ở app mới và ở Directus app: cùng request
  `POST /flows/trigger/:id` sau chuẩn hóa; mục Logs của hai app hiện cùng số đếm, cùng nhóm ngày, cùng icon; drawer
  của cùng một lần chạy hiện cùng danh sách bước, Options và Payload sau chuẩn hóa thời gian.
- **SC-004**: Với bộ mẫu `bo_flows`, so với Directus app trên cùng DB bằng E2E song song (admin), 0 lệch ngoài D-xx ở
  năm thuộc tính: (a) nhãn và thứ tự dòng bảng flow và mục sub-menu, (b) tiêu đề của 4 màn (bảng flow, trang flow,
  drawer flow, drawer operation) và tên/loại của mọi panel trên trang `bo_all_ops`, (c) chuỗi `<dl>` overview của 15
  panel và 5 trigger (bộ mẫu có đủ 5 trigger), (d) `disabled`/ẩn của 9 nút (tạo flow, Next, Finish Setup, Save
  drawer, Edit Flow, Save canvas, Clear Changes, Done operation, Copy To), (e) mục panel hiện (Logs) và badge số đếm;
  thu bằng `innerText` và `aria-disabled` (không so màu); URL webhook so phần `/flows/trigger/<id>`; notice
  D-106 nằm ở drawer operation, không thuộc (c).
- **SC-005**: 100% body ghi (FR-016, FR-032, `POST /flows/trigger/:id`) và request đọc `GET /revisions` của kịch bản
  E2E bằng Directus app cho cùng kịch bản sau chuẩn hóa (FR-101); lệch thật ghi R-xx.
- **SC-006**: Registry 15 operation và 5 trigger: test so nguồn đạt 100% (options tĩnh, options hàm với 3 bộ đối số
  mẫu mỗi loại có điều kiện, overview với options mẫu); arrows lib: test port của Directus (`create-line`,
  `find-best-position`, `generate-arrows`, `generate-path`, `generate-corner`, `get-points`, `is-point-in-panel`,
  `min-max-point`, `range`) đạt 100%; staging/Save: 12 kịch bản mẫu (thêm con resolve, thêm con reject, nối lại sang
  cha khác, tháo, xóa có con, xóa operation đầu, nhân bản, đổi vị trí, đổi trạng thái, Save rỗng, Save sau xóa + thêm
  cùng key, vòng dữ liệu) sinh cùng body `PATCH /operations` và `PATCH /flows/:id` như Directus (so JSON với mốc ghi tay trên Directus app 8155
  ở T002, `payload/baselines/flows-*.json`, test unit dùng cùng file; chuẩn hóa id thật → `key`, 5 ký tự ngẫu nhiên →
  `*`).
- **SC-007**: Hiệu năng FR-108 đạt (ngân sách nhân `machineFactor()`); số request mỗi thao tác đúng FR-108.
- **SC-008**: Recipe Q-29 đến Q-33 được design owner duyệt, `qa/handoff-checklist.md` đạt trước khi đóng; axe 0 vi
  phạm serious/critical trên các màn của FR-106 ở sáng và tối; ngoại lệ a11y của canvas (chỉ chuột, cảm ứng không
  bảo đảm) ghi trong `design-system/qa/handoff-checklist.md`, tech lead duyệt trước khi đóng và ghi duyệt ở bảng trạng
  thái khác biệt của spec.
- **SC-009**: Coverage `apps/web` ≥ 60%; lint, typecheck, unit, E2E ba cấu hình, build image xanh; chunk chính ≤ ngân
  sách 016 + 20 KB gzip; 0 màu thô ngoài danh sách miễn; 0 file trong `directus/` bị sửa; 0 request ngoài FR-110.
- **SC-010**: D-105, D-106, R-43 đến R-47 và mục "Cần xác nhận" được tech lead duyệt; D-92 (016) và D-72 phần `directus_flows` (014) ghi
  "đã gỡ ở 017" ở spec gốc. Duyệt ghi ở bảng trạng thái khác biệt của spec (như 016 T122).
