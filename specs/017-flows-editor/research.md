# Research: Trình chỉnh sửa Flows (017)

Ngày 2026-10-17. Mỗi mục: quyết định, lý do, phương án bỏ. Directus tham chiếu 11.17.4 (`directus/app` 15.10.0,
`@directus/types` 15.0.3). Hành vi Directus lấy từ ba báo cáo đọc mã nguồn khi viết spec (2026-10-17) và các lần kiểm
trực tiếp ghi ở bảng cuối; chưa chạy thử trên Directus thật. T002 (task đầu lượt 1) chạy tay bốn luồng trên Directus app
8155 (tạo flow manual, thêm 4 operation và lưu, Copy To, chạy từ trang item) và lưu body làm mốc trước khi viết bộ so
payload; kết quả ghi lại vào bảng cuối.

## R1. Thư viện và phiên bản

**Quyết định**: không thêm gói. Đã có trong `apps/web`: `nanoid` (id tạm `_<nanoid>`), `@sindresorhus/slugify` (key
operation), `lodash-es` (`sortBy`, `cloneDeep`, `throttle`, `isEqual`), `codemirror` 5 qua interface `input-code`
(JavaScript và JSON của `exec`, `condition`, `transform`, `payload`, `query`), `@directus/types` (`FlowRaw`,
`OperationRaw`, `OperationAppConfig`, `TriggerType`), `vuedraggable` không dùng (canvas kéo tự do, không sắp danh sách).
`ErrorCode` (34 mã) cho operation `throw-error` chép vào `operations/throw-error/error-codes.ts` (header nguồn
`directus/packages/errors/src/codes.ts`), test so với `libs/errors/src/codes.ts` (đọc file trong test); fallback
`INTERNAL_SERVER_ERROR`, 500, "An unexpected error occurred." giống `internal.ts` của Directus và `libs/errors` (kiểm
2026-10-17). Web không thêm phụ thuộc `@backoffice/errors` (CHK050: lib chỉ export `dist` cần build trước và kéo
`@backoffice/types`; web chưa dùng lib workspace nào).

**Phương án bỏ**: thư viện node-graph (`vue-flow`, `rete`, `jsplumb`): khác cách vẽ của Directus (lưới 18 px, mũi tên
tự sinh theo `create-line.ts`), tọa độ lưu `position_x/y` sẽ phải quy đổi và mất parity vị trí (SC-002); `@directus/errors`
trong web (thêm gói); phụ thuộc `@backoffice/errors` (cần build `dist`, ràng buộc Nx mới cho web).

## R2. Route, trang flow và named view của drawer operation

**Quyết định**:

- `modules/settings.ts` thay khối `flows` (hai route `Frame`) bằng: `settings-flows-collection` (`''` →
  `FlowsOverviewRoute.vue`), `settings-flows-item` (`:primaryKey`, `props: true`, `FlowRoute.vue`, `beforeEnter` tra
  `useFlowsStore().flows`, thiếu → `notFound(to)` của 016) với con `settings-flows-operation` (`:operationId`,
  `props: true`, `meta.isFloatingView`, `component: OperationDetail.vue`). Directus vẽ drawer bằng `<RouterView>` mặc
  định (không tên) trong `flow.vue:778` với props `operation`, `existingOperationKeys`, `flow` và sự kiện `save`,
  `cancel`; app làm giống (khác `+` của data-model dùng named view `add`). `FRAME_META`/`Frame` của flows bỏ; `Frame`
  giữ cho module khác.
- `beforeEnter` của Directus (`index.ts:221-230`) chỉ tra store (đã hydrate ở đăng nhập), không gọi API; app giữ.
  Vào `/settings/flows` gọi `flowsStore.hydrate()` (không chờ) để lấy flow mới do app kia tạo (Directus `overview.vue`
  không gọi nhưng `hydrate` sau mỗi ghi; thêm một `GET /flows` khi vào route là khác biệt số request → **không thêm**,
  giữ như Directus: dữ liệu mới xuất hiện sau thao tác ghi kế tiếp hoặc tải lại trang). Spec FR-010, FR-108 đã sửa
  theo (release-gate CHK021).
- `get-item-route.ts` không đổi (`directus_flows` → `/settings/flows`), chỉ sửa comment "khung 012 tới 017".

**Phương án bỏ**: named view `operation` (phải sửa cả route và `FlowRoute`, khác Directus); nạp flow bằng
`useItem('directus_flows')` (Directus đọc từ store, `saveChanges` gửi `PATCH` lồng, không qua `use-item`).

## R3. Canvas: lưới, panel, kéo, mũi tên (Q-29, Q-30)

**Quyết định**:

- Chép `constants.ts` nguyên (`GRID_SIZE`, `PANEL_WIDTH`, `PANEL_HEIGHT`, ba offset) và `components/arrows/*` (9 file
  lib/utils + 9 `.test.ts`) nguyên vào `modules/settings/routes/flows/arrows/`; `Arrows.vue` viết lại (SVG `<path>`
  với lớp Tailwind `stroke-brand-500 dark:stroke-brand-400` / `stroke-orange-500 dark:stroke-orange-400`, reject thêm
  `stroke-dasharray` (FR-106), `opacity-50` khi mờ, `motion-reduce:transition-none`); `pointer-events: none`.
- `v-workspace.vue` + `v-workspace-tile.vue` của Directus (`directus/app/src/components/v-workspace/`) là component
  dùng chung với Insights (018): port thành `components/workspace/BoWorkspace.vue` và `BoWorkspaceTile.vue` ở 017 với
  prop đủ cho flows (`tiles`, `editMode`, `zoomToFit` không, `resizable false`); 018 mở rộng (resize, zoom) sau. Logic
  kéo (pointer events, bám lưới, nhãn `(x-1:y-1)`, throttle 20 ms) chép nguyên.
- `Operation.vue` (port `components/operation.vue`): tay cầm là `<button>` 32×32 (vùng bấm) với icon 24; nút "+"
  khi hover; kéo mũi tên bằng `pointerdown/move/up` trên tay cầm, `setPointerCapture`; không nhánh RTL (Cần xác nhận).
- Màu panel: resolve/trigger `brand`, con reject `orange` (header và chấm), lớp mờ `opacity-50` cho inactive/lẻ kèm
  `sr-only` (FR-106).
- Canvas trong `PrivateView fill` với vùng `overflow-auto` hai chiều; kích thước = biên panel xa nhất + 100 (+ 25 ô
  ở chế độ sửa) như `v-workspace.vue:76-81`.

**Phương án bỏ**: Canvas HTML `<canvas>` (mất DOM cho a11y và E2E `getBoundingClientRect`); CSS grid thật
(`grid-template-columns: repeat(auto, 18px)`) thay `position: absolute` (Directus dùng absolute theo px; giữ để so vị
trí pixel với Directus app trong E2E dùng chéo).

## R4. Staging và `saveChanges` (FR-027 đến FR-031)

**Quyết định**: chép logic `flow.vue` (`stagedPanels`, `panelsToBeDeleted`, `stagedFlow`, `stageOperation`,
`createOperation`, `duplicateOperation`, `deleteOperation`, `getTrees`, `saveChanges`, `onLink`, `onDrag`,
`isLoner`) sang composable `use-flow-editor.ts` (một file, có test unit cho 12 kịch bản SC-006) để `FlowRoute.vue` chỉ
còn template; `getTrees` thêm `Set` id đã thăm, gặp lại → `console.error` và dừng Save trước mọi request, như kết quả quan sát của Directus (T002; D-105 bỏ). Body `PATCH
/flows/:id` giữ thứ tự khóa của Directus (`...stagedFlow`, `operations`, `operation`) cho dễ đọc; bộ so payload so
object không theo thứ tự khóa (CHK020). Save lỗi: staging giữ, Save lại gửi lại cả hai request (R-47).

**Phương án bỏ**: Pinia store riêng (staging chỉ sống trong trang, Directus cũng là `ref` cục bộ); dùng `use-item`
(không có quan hệ lồng tạm).

## R5. Drawer operation, registry operation, `ExtensionOptions type operation` (FR-040 đến FR-045)

**Quyết định**:

- `apps/web/src/operations/index.ts` là registry tĩnh (mảng 15 `OperationAppConfig` import tường minh, sắp theo `id`)
  như `interfaces/index.ts` của 013; mỗi operation là `operations/<id>/index.ts` chép từ Directus (header nguồn,
  manifest). Không `import.meta.glob` (XI: không extension; glob làm bundle khó đoán).
- `ExtensionOptions` (016) thêm `type: 'interface' | 'display' | 'operation'`, prop `collection?`, `field?`; khi
  `type === 'operation'` không gọi `useFieldDetailStore` (dùng `inject` an toàn: `getActivePinia` có nhưng store
  field không được tạo) và truyền `collection`/`field` `null` cho component options (không có operation nào dùng
  component). `extension` nhận `OperationAppConfig`; `optionsKind` giữ (`array` | `function` | `component` | `null`).
- `OperationDetail.vue` gọi `options(optionsValue)` khi là hàm rồi `translate` (`utils/translate-object-values.ts`
  đã có), truyền mảng kết quả qua prop `options` (như `AdvancedInterface.vue:84`); `getDefaultValuesFromFields`
  (`components/form/utils/get-default-values-from-fields.ts`, đã có) áp khi Done.
- `operation mail` thêm `BoNotice info` đầu form (D-106) với khóa overlay `operations_mail_not_sent_notice`
  (`lang/overlay/en-US.ts`, `vi-VN.ts`; tên phẳng vì overlay là object phẳng).
- `trigger.flow` lấy `useFlowsStore().flows.filter(trigger === 'operation')` lúc gọi hàm options (như nguồn).
- Test so nguồn (FR-044): như 013 (`registry.test.ts` so với fixture JSON trích bằng
  `scripts/extract-directus-registry.mjs`, không import mã Directus vào test của web vì operation `trigger` import
  `@/stores/flows`). 017 mở rộng script đó để trích `operations` (id, icon, name, description,
  options tĩnh, và với options hàm: kết quả với bộ đối số mẫu `{}`, `{type:'template'}`, `{operation:'sign'}`,
  `{iterationMode:'batch'}`) vào `fixtures/interfaces/directus-registry.json`; test so JSON (`overview` so bằng cách
  gọi với options mẫu ở cả hai phía, trong fixture ghi kết quả).

**Phương án bỏ**: options dạng component cho `exec` (Directus không có; `input-code` đủ); tách `ExtensionOptions`
thành component mới `OperationOptions` (trùng 90%).

## R6. Logs (FR-050 đến FR-055, Q-32)

**Quyết định**: `LogsSidebarDetail.vue` dùng `useRevisions(ref('directus_flows'), ref(flow.id), ref(null), {action:
'run', full: true})` (014 đã có `action`, `full`, đếm `aggregate`, request "created" giữ); nhóm ngày bằng
`RevisionsDateGroup` (props `title`); dòng là `<button>` với icon + `HH:mm (x ago)` (`date-fns` `format`,
`formatDistanceToNow` đã dùng ở 014); `LogsDrawer.vue` là `BoDrawer` với danh sách `<ol>` bước và `BoDetail`
(`Options`, `Payload`, `Accountability`), JSON `<pre class="overflow-x-auto">` `JSON.stringify(v, null, 2)`. Tên và
loại operation tra `flow.operations` và registry (type lạ → chuỗi thô).

**Phương án bỏ**: nạp log bằng `/activity` (Directus đọc `/revisions`; `/activity` không có `data.steps`).

## R7. Drawer flow và 5 trigger (FR-012)

**Quyết định**: `triggers.ts` chép nguyên (fields + overview, `publicURL` → `getApiUrl()` của `api/sdk.ts` như các
chỗ `getPublicURL` khác của 012–015; ở `cors` URL là origin API, đúng nghĩa webhook); `FlowDrawer.vue` là `BoDrawer
persistent` với `BoTabs orientation="vertical"` (016 Q-22) hai tab, `BoForm` cho options (`primary-key="+"`, fields
đã `translate`), `BoFancySelect` 5 trigger; `select-icon`/`select-color` của 013 cho icon và màu; select
`accountability` ba mục (`flow_tracking_all|activity|null`, giá trị `null` qua `BoSelect` với mục `null`).

**Phương án bỏ**: gộp drawer flow vào trang flow (Directus mở từ overview và từ pencil Trigger; cùng component).

## R8. Overview (FR-010, FR-011)

**Quyết định**: `FlowsOverviewRoute.vue` trên `BoTable` (`sortable`, `showResize`, `fixedHeader`, cột `icon`
42 px, `status` 100 px với `BoBadge`, `name` 240 px, `description` 360 px) như `RolesCollectionRoute` (016 Q-2); sắp
xếp client `sortBy`; click dòng `router.push`, Ctrl/Cmd/chuột giữa `window.open` (như `overview.vue:106-114`); menu
dòng `BoMenu` ba mục; nút tạo gated bởi `useCollectionPermissions('directus_flows').createAllowed`
(`composables/use-permissions/collection/`); hộp xóa `BoDialog`.

## R9. Kiểm thử: E2E ba cấu hình, bộ so payload, bộ so DB, dùng chéo (FR-100 đến FR-104)

**Quyết định**:

- Sáu spec `settings-flows-*.spec.ts`; `settings-flows-editor` chạy mọi browser ở cùng origin (thêm vào biểu thức
  "core" của `playwright.config.ts` như ba spec 016); `settings-flows-cross-use` thêm vào `DIRECTUS_APP_SPECS`;
  `settings-parity-ui` mở rộng.
- Kéo thả trong Playwright: `page.mouse.move(x, y, {steps: 8})` giữa `down`/`up` trên tay cầm và điểm nhận (pointer
  events, `setPointerCapture`); vị trí panel đọc bằng `getBoundingClientRect` của `[data-panel-id]` chia 18 làm tròn.
- Không E2E nào chạy `bo_all_ops`; flow tạm `web-e2e-<cfg>-*` (CHK007). Webkit flake với kéo → `test.fixme` có lý do
  (CHK048).
- Bộ so payload `payload/flows.spec.ts`: `recordWrites` + `normalize` (014) mở rộng: bỏ `_<nanoid>` (đã bỏ trước gửi),
  thay 5 ký tự ngẫu nhiên của key nhân bản/placeholder bằng `*`, sắp `operations.create/update` theo `key`,
  `delete` theo id ánh xạ `key`; đọc `GET /revisions` so query sau khi sắp `fields[]`.
- Bộ so DB: `FLOWS_TABLES = ['directus_flows', 'directus_operations']` trong `db-rows.ts`; chuẩn hóa `id`,
  `date_created`, `user_created`, và `flow`/`operation`/`resolve`/`reject` ánh xạ sang `key` (hoặc `name` của flow).
- Dùng chéo (FR-102) điều khiển Directus app 8155 bằng `helpers/directus-app.ts` (016): mở `/admin/settings/flows/<id>`,
  đọc `--pos-x`/`--pos-y` của `.v-workspace-tile` → vị trí lưới (Backoffice: `data-pos-x/y`); tải lại app mới trước khi
  mở flow do Directus app tạo; đếm `svg path`, lớp `.reject`; mở drawer operation bằng click pencil.
- Fixture `bo_flows` (FR-103, release-gate CHK006, CHK049): `bo_all_ops` chỉ chạy nhánh không tác dụng phụ (sáu
  operation có tác dụng phụ nằm dưới reject của `log`); seed thử lại trigger tối đa 10 × 500 ms. `seed.mjs` thêm sáu flow, mỗi flow một `POST /flows {…, operations: [cây]}` với
  `resolve`/`reject` là object lồng (cùng dạng `saveChanges` của Directus gửi trong `create`; parity 009 `crud` đã
  kiểm API nhận cây lồng); snapshot `flows.json` mở rộng,
  thêm `operations.json`; chạy `bo_all_ops` 3 lần qua `POST /flows/trigger/:id` trong seed (sau khi API nạp flow:
  seed đợi 1 s hoặc gọi lại khi 403 "flow not found" tối đa 5 lần); `fixtures-seed.test.ts` so snapshot bỏ log.
- Cleanup: `seed.mjs` xóa theo tên `bo_*` flow (cascade xóa operations).

**Phương án bỏ**: `dragTo` của Playwright (không bắn pointermove đủ bước cho `setPointerCapture`).

## R10. i18n

**Quyết định**: mọi khóa của spec có trong `en-US.json` (kiểm 2026-10-17: `operations.*` 15 nhóm, `triggers.*` 6
nhóm, 17 khóa phẳng mẫu); `vi-VN.json` thiếu khóa nào thì rơi về `en-US` như Directus (016 R10). Khóa mới duy nhất:
`operations_mail_not_sent_notice` ở overlay (D-106).

## R11. Bốn lượt commit (FR-112)

| Lượt | Nội dung | Kiểm |
|------|----------|------|
| 1 | Phase 1 (kiểm, mốc Directus app T003, recipe nháp Q-29..Q-33, ngoại lệ a11y), Phase 2 (registry, triggers, workspace, bộ mẫu), route, `FlowsOverviewRoute`, `FlowDrawer`, `triggers.ts`, `settings-flows-overview.spec.ts` | US1; test unit/browser; E2E ba cấu hình |
| 2 | `BoWorkspace*`, `Operation.vue`, `Arrows.vue` + lib port + test, `use-flow-editor.ts`, `FlowRoute.vue`, `OperationDetail.vue`, registry 15 operation + script trích + test so nguồn, `ExtensionOptions type operation`, D-106, `settings-flows-editor.spec.ts`, `settings-flows-operations.spec.ts` | US2, US3; SC-006 |
| 3 | `LogsSidebarDetail`, `LogsDrawer`, `settings-flows-logs.spec.ts`, `settings-flows-manual.spec.ts`, fixture `bo_flows` + log mẫu, `hydrate()` sau ghi | US4, US5 |
| 4 | `payload/flows.spec.ts`, `FLOWS_TABLES`, `settings-flows-cross-use.spec.ts`, `settings-parity-ui` mở rộng, perf, bundle `BUDGET_017`, axe, ngoại lệ a11y trong `handoff-checklist.md`, docs (spec 014/016 "đã gỡ ở 017", `CLAUDE.md`, `SPECKIT-GUIDE.md`), duyệt D/R | US6; SC-002..SC-010 |

## R12. Hiệu năng và bundle

**Quyết định**: perf `modules/settings/routes/flows/perf.browser.test.ts` (`PERF=1`, `machineFactor()`): 50 operation /
60 mũi tên < 500 ms; `generateArrows` 50 panel < 8 ms mỗi lần di chuyển (đo thuần hàm, CHK030); drawer operation < 200 ms; log 10 dòng
< 300 ms. Số request: mở `/settings/flows` = 0 (store, R2); trang flow = 1 đếm (+2 khi Logs mở: danh sách và request "created" của `use-revisions`); Save = n
`PATCH /operations` + 1 `PATCH /flows/:id` + 1 `GET /flows`. Chunk lười: `FlowRoute` (canvas + arrows + workspace +
`use-flow-editor`) ≤ 60 KB gzip, registry operation ≤ 25 KB, `LogsDrawer` ≤ 15 KB; `BUDGET_017 = BUDGET_016 + 20 KB`,
`LAZY_BUDGETS_017`.

## Kết quả kiểm (2026-10-17, đọc mã nguồn, chưa chạy thử)

| Mục | Kết quả | Sửa ở |
|-----|---------|-------|
| API mới nhận `operations: {create, update, delete}` lồng trong `PATCH /flows/:id` | `FlowsService extends ItemsService`; parity `tests/parity/src/flows/crud.test.ts:176-190` đã so với Directus | không đổi |
| `GET /revisions` với `activity.action`, `aggregate[count]` | `use-revisions.ts` (014) có `action`, `full`, đếm; API 008 serve `/revisions` với `sanitizeQuery` | không đổi |
| `ExtensionOptions` | import `useFieldDetailStore` ở dòng 12, 33–35; prop `type: 'interface' \| 'display'` | R5, T016 |
| `getDefaultValuesFromFields` | `components/form/utils/get-default-values-from-fields.ts` | R5 |
| `translate` | `utils/translate-object-values.ts` | R5, R7 |
| `useCollectionPermissions` | `composables/use-permissions/collection/use-collection-permissions.ts` | R8 |
| `ErrorCode` | `libs/errors/src/codes.ts` 34 mã; lib export `dist` (cần build) và import `@backoffice/types` → chép vào web | R1 |
| Logs Directus | trạng thái lần chạy = bước cuối (`use-revisions.ts:171`); lọc `status === 'reject'` trang hiện tại; badge `abbreviateNumber`; nạp = `VProgressLinear`; chấm bước mặc định/`resolve` màu chính, `reject` màu phụ; drawer log không `persistent` | spec US4, FR-004, FR-052 |
| Lỗi ghi Directus | drawer flow, menu bảng, Save: `unexpectedError`, không đổi store; Save chỉ xóa staging sau `hydrate` | spec FR-012..FR-014, FR-030, R-47 |
| Vị trí tile Directus | biến CSS `--pos-x`, `--pos-y` (ô) trên `.v-workspace-tile`; kích thước canvas `(x+width+25)×18` (sửa), `(x+width−1)×18` (xem) | spec FR-021, SC-002 |
| Trigger null | panel Trigger `t('triggers.<type>.name')`, không overview (`flow.vue:167-181`) | spec Edge Cases |
| Sao chép | `isCopySupported`; `use-clipboard` (web đã có) | spec FR-022 |
| `@directus/types` ở web | `FlowRaw`, `OperationRaw`, `OperationAppConfig` trong `apps/web/node_modules/@directus/types/dist/index.d.ts` | không đổi |
| `getPublicURL` | web dùng `getApiUrl()` (`api/sdk.ts`) ở mọi chỗ (`get-asset-url.ts`) | R7 |
| Overlay i18n | `lang/overlay/{en-US,vi-VN}.ts` object phẳng | R10 |
| `DIRECTUS_APP_SPECS` | `apps/web-e2e/playwright.config.ts:24-25` | R9 |
| `db-rows.ts` | `TABLES`, `SETTINGS_TABLES`; `changesSince`/`snapshot` nhận `extra` | R9 |
| `check-bundle.mjs` | `BUDGET_016`, `LAZY_BUDGETS_016` | R12 |
| Allowlist | `allowed-paths.ts` id cuối 176; 016 contract tới #177 | contracts #178– |
| Fixture flows | `seed.mjs:1490` tạo `bo-flow-content`, `bo-flow-item`; cleanup theo tên dòng 82 | R9 |
| Directus `RouterView` drawer operation | không tên, props `operation`, `existing-operation-keys`, `flow`, `@save`, `@cancel` (`flow.vue:778-784`) | R2 |
| `directus_operations` | `position_x/y` NOT NULL, `resolve`/`reject` unique, `key` không unique (`20220429A-add-flows.ts`) | spec Edge Cases |
| `trigger-detail.vue` | không được import | không port |
| Nút chạy thủ công | `use-run-manual-flow.ts`, `FlowSidebarDetail.vue`, `FlowDialogs.vue` (014) dùng ở `CollectionRoute`, `ItemRoute`, `DrawerItem`, `presentation-*` | không đổi |

## Kết quả kiểm T002 (2026-10-17)

- Dữ liệu: flow `web-e2e-t002-cycle` (manual, `bo_content`), hai operation log `a`, `b`, `a.resolve = b`, `b.resolve = a`
  (`PATCH /operations` nhận), `flow.operation = a`. Trang `/admin/settings/flows/<id>` của Directus app 8155 mở bình
  thường: 3 panel, mũi tên vẽ cả vòng.
- Edit Flow, kéo panel `b` 3 ô mỗi trục (`--pos-x` 37 → 40, `--pos-y` 1 → 4), Save: tab không treo (`page.evaluate`
  trả lời sau 3 ms). Console có `RangeError: Maximum call stack size exceeded` (từ `Array.find` trong đệ quy dựng cây)
  dưới dạng warning `[app-private-view-header-bar-action-button-error]` của Vue.
- Không có request ghi nào (không `PATCH /operations`, không `PATCH /flows/:id`); không hộp lỗi, không thông báo; trang
  ở lại chế độ sửa; DB không đổi (`position_x/y` của `b` vẫn 37/1). Flow thử đã xóa.

## Kết quả T001 và T003 (2026-10-17)

- T001: môi trường parity (Directus 8155, API mới 8156, proxy 8160–8163, web 8180/8181) đang chạy; bảng "Kết quả kiểm"
  ở trên xác nhận lại bằng đọc code, không đổi.
- Hậu quả của T002 trên môi trường dùng chung: sau khi tạo flow vòng, `FlowManager` của Directus và của API mới cùng
  nạp lỗi (`RangeError`) và bỏ nạp mọi flow (log `Flows have to be loaded before they can be reloaded`); manual trigger
  trả 403. Khởi động lại ba container API (`directus`, `backoffice-api`, `backoffice-api-web-cors`) thì hết. Ghi R-48;
  test không tạo dữ liệu vòng.
- T003: `apps/web-e2e/src/payload/flows-baselines.spec.ts` (chạy với `RECORD_BASELINES=1`, như 016) ghi
  `payload/baselines/flows-{create,save,edit,copy}.json`; `helpers/payload.ts` ghi thêm `/flows`, `/operations`. Dạng
  body thật đã đưa vào data-model §6 và spec US2-7, US2-9: `operation` là cây object lồng, `create`/`update` chỉ chứa
  cây không cha, `flow` ở mọi nút, nút có sẵn chỉ gửi trường đổi, nhân bản chép cả trường giao diện của panel.

