---

description: "Danh sách task cho feature 018: Insights (dashboard, 11 panel, biến), Activity, Notifications"
---

# Tasks: Insights, Activity, Notifications (dashboard và 11 panel, nhật ký hoạt động, chuông và drawer thông báo như Directus)

**Input**: Tài liệu thiết kế trong `/specs/018-insights-activity-notifications/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R12 + bảng kiểm), `data-model.md`, `contracts/`
(`api-calls.md` #185–#203, `components.md`, `tests.md`), `quickstart.md`, `checklists/requirements.md`.

**Điều kiện bắt đầu**: làm trên `main`; `git pull` trước khi sửa `e2e/helpers/{payload,db-rows,directus-app,allowed-paths}.ts`
và `src/test-utils/fetch.ts` (017 vừa sửa); CI trên `main` có `cancel-in-progress` (từ b82676a) nên push sẽ hủy run
đang chạy của phiên khác: báo trước khi push; env parity (`parity-postgres-*`) dùng chung: hỏi phiên đang chạy E2E trước
khi `env-up`/seed; chạy `ExtensionOptions.test.ts`, `modules/settings/**/field-detail/*`, `a11y.browser.test.ts`,
`perf.browser.test.ts` của settings trước khi push (016). 017 còn sửa `e2e/helpers/directus-app.ts` (phần flows) và
có thể `e2e/helpers/flows.ts`: 018 sửa local được nhưng chỉ commit hai file này sau khi 017 push bản sửa bước kéo (017
nhắn); `BoWorkspace*` giữ hành vi flows (kiểm bằng `settings-flows-editor` và `flow.test.ts`). Checkout dùng chung với phiên 017 (và 016 khi còn): `git add` theo đường dẫn,
không `git add -A`, không `stash`, `reset`, `checkout -- <file>`; `git pull --rebase` trước khi push; nhắn phiên khác
trước và sau mỗi push và trước `parity-tests:env-up`/`env-down`; E2E local chạy tuần tự trên DB chung.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có test cạnh file: `*.test.ts` (project `unit`, happy-dom) hoặc `*.browser.test.ts` (project `browser`,
  chromium) theo `contracts/tests.md` §1; coverage `apps/web` ≥ 60 % gộp.
- Feature không thêm hay sửa endpoint API (research bảng kiểm: `/dashboards`, `/panels`, `/notifications` batch,
  `?export=json`, `/utils/import`, GraphQL aggregate/group đã có parity 010/011) nên không có test đối chiếu endpoint
  mới; nếu T002 hoặc bộ so payload thấy API mới lệch Directus thì mở task sửa `apps/api` kèm parity 010/011 (FR-111).
  Đối chiếu ở mức màn: E2E ba cấu hình (§3), bộ so payload `insights`, `activity`, `notifications` và bộ so DB ở
  `proxy-api` (§4), dùng chéo trên Directus app (§5, SC-002, SC-003), parity UI (SC-004); `fixtures-seed.test.ts` giữ
  xanh với bộ mẫu mở rộng.

**Organization**: Task nhóm theo user story của spec, xếp theo bốn lượt commit (FR-112, research R11): **Lượt 1** =
Phase 1, 2, 3 (US1), 4 (US2); **Lượt 2** = Phase 5 (US3), 6 (US4); **Lượt 3** = Phase 7 (US5), 8 (US6), 9 (US7);
**Lượt 4** = Phase 10 (US8), 11 (Polish). Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E
hiện có + mới xanh, commit, push sau khi nhắn phiên chung checkout, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Gốc đường dẫn: `apps/web/src/` viết tắt `src/`; `apps/web-e2e/src/` viết tắt `e2e/`; `apps/web/fixtures/interfaces/`
  viết tắt `fixtures/`; `src/modules/insights/` viết tắt `insights/`; `src/modules/activity/` viết tắt `activity/`;
  đường dẫn Directus tính từ `directus/app/src/` trừ khi ghi khác.
- File chép từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn>` (SFC: comment trong `<script setup>`);
  mỗi task chép ghi các cặp `{ "source", "dest" }` vào `tools/port-manifest/018-T###.json`; chạy
  `pnpm run check-port-headers`. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Component Vue KHÔNG chép nguyên (VI, XII): chép logic trong `<script setup>`, viết lại template theo recipe nháp
  (T003, T004) bằng Reka UI và component `Bo*`. File `.ts` chép nguyên được. Chỗ khác nguồn ghi `// Backoffice: <lý do>`
  (api → `apiFetch`/`requestEndpoint`, `unexpectedError` → `showUnexpectedError` cho màn mới (FR-081), `notify` → notice
  tại chỗ (D-66), `window.open` export → blob (R2), `var(--theme--primary)` → `cssVar('--color-brand-500')` (D-108),
  `chroma-js` → `color` (R1), bỏ `preview.svg` (D-110), bỏ RTL).
- Quirk của Directus chép nguyên, ghi `// Backoffice: same as Directus (R-53)` / `(R-54)`: `<=` như `<`, `contains`
  của bar-chart so ngược, resize top/left trôi ở cỡ tối thiểu, `now` một lần (R-50), nhân bản dashboard thêm `try/catch`
  (R-49, khác duy nhất).
- Giao diện: KHÔNG hex thô, KHÔNG palette ngoài theme (`check-raw-colors`); màu dashboard/panel từ DB chỉ qua `style`;
  màu mặc định và bảng màu chuỗi lấy từ token. Nút chỉ icon có `aria-label`; control có label liên kết; nhãn field và
  nhãn lựa chọn theo recipe 21ae3e9. Kéo/đổi cỡ tile chỉ chuột như Directus (ngoại lệ a11y, FR-027), mọi thứ khác tới
  được bằng phím.
- Chuỗi giao diện dùng khóa Directus (sinh ở 012, đủ 73 khóa, R10); không overlay mới.
- Dữ liệu E2E: bộ mẫu `bo_insights` (T016) seed sau `bo_flows` của 017; KHÔNG E2E nào sửa `bo_dash_*`; dashboard và
  thông báo do test tạo đặt tên `web-e2e-<cfg>-<spec>-<n>` và xóa ở `afterAll`; spec điều khiển Directus app (payload,
  parity-ui, cross-use) vào `DIRECTUS_APP_SPECS` (chỉ chromium-1280).
- Sau mỗi phase: `pnpm nx run web:lint`, `web:typecheck`, `web:test`, `web:build` xanh.

---

## Phase 1: Setup (kiểm, mốc Directus, thư viện, recipe nháp)

**Purpose**: kiểm giả định còn mở của research, lấy mốc body ghi và tài liệu GraphQL của Directus app, thêm
`apexcharts`, viết recipe nháp trước mọi task giao diện (FR-107, SC-008).

- [X] T001 Kiểm môi trường và các điểm "kiểm T001" của research: `pnpm nx run parity-tests:env-up --vendor=postgres
      --profiles=app,web` lên được; xác nhận bằng đọc code và ghi kết quả vào `specs/018-insights-activity-notifications/research.md`
      (mục "Kết quả T001"): (a) `escape-string-regexp` có trong `apps/web` hay dùng `lodash-es/escapeRegExp`; (b)
      `PrivateView.vue` có `provide('main-element')` cho vùng nội dung hay cần thêm (R3); (c) preset mặc định
      `directus_activity` có trong `src/stores/presets.ts` (port `directus/app/src/stores/presets.ts:63-82`) hay cần
      thêm (R8); (d) `notifications-drawer.vue` lọc `recipient` bằng `$CURRENT_USER` hay id người dùng (R8, #201); (e)
      `activity/components/navigation.vue` giữ mục active trong `v-model:filter` hay query URL (R8); (f) composable
      theo dõi theme tối ở 012 (`useDark`/class `dark`) cho vẽ lại biểu đồ (R5); (g) `NoticeStack` hộp lỗi có Dismiss và
      `errors.<code>` (FR-081); (h) bỏ (bộ mẫu dùng `bo_insights_data` với `happened_at` cố định, release-gate CHK052);
      (i) `md()` của 013 (`src/utils/markdown.ts`) có cùng cấu hình `utils/md.ts:13-30` Directus (`ADD_ATTR target`,
      `_self` mặc định, `rel` cho `_blank`), thiếu thì ghi vào T094 (FR-074); (j) chép
      `directus/packages/utils/shared/apply-options-data.test.ts` thành `src/utils/apply-options-data.test.ts` chạy với
      `@directus/utils` đã cài, xanh (FR-053, CHK051)
- [ ] T002 [P] (chạy SAU T016: cần bộ mẫu `bo_insights`; viết spec ghi được làm trước) Mốc Directus app (SC-005,
      SC-006): `e2e/payload/insights-baselines.spec.ts` (`RECORD_BASELINES=1`, như 017 `flows-baselines.spec.ts`) điều
      khiển Directus app 8155 và ghi request (`page.on('request')`, response GraphQL) chín luồng: (1) tạo dashboard tạm qua
      hộp, (2) "+" metric (count `bo_insights_data`) và bar chart rồi Save, (3) kéo bar chart sang (13,1) và đổi cỡ metric 8×4
      bằng tay cầm góc dưới phải rồi Save, (4) Copy To sang dashboard tạm 2 rồi Save, (5) nhập file JSON xuất từ (1), (6)
      Archive thông báo `bo_notification_item`, (7) sửa options metric (đổi `function` sang `sum`) rồi Save, (8) Duplicate
      metric và Delete bar chart rồi Save, (9) vào sửa rồi không đổi gì: ghi `disabled` của Save và 0 request; cùng tài liệu
      GraphQL và response của `bo_dash_all`, `bo_dash_system`, `bo_dash_vars` (3 giá trị `vars_status`), và request khi mở
      drawer thông báo (danh sách, có đếm hay không, FR-108); lưu vào `e2e/payload/baselines/insights-*.json`
      và `fixtures/snapshot/graphql.bo_dash_all.json` (cần T016 seed trước); so với `data-model.md` §2, §3, §5 và
      `contracts/api-calls.md`; lệch thì sửa spec, data-model, contracts; xóa dữ liệu tạm
- [X] T003 [P] Recipe nháp Q-34 (lưới dashboard và tile: nền, viền, bo góc theo tile kề, header icon màu + tên + tooltip
      note, tay cầm resize 8 hướng 12 px vùng bấm 24 px, nhãn `W×H`, trạng thái nạp/lỗi/`no_data`, zoom-to-fit) và Q-35
      (biểu đồ: bảng màu chuỗi từ `brand-*` cho sáng/tối, trục, lưới, chữ `gray-500`/tối `gray-400`, tooltip, chú giải,
      nhãn dữ liệu, bảng `sr-only`) vào `design-system/docs/layout-patterns.md` §14 (mới) và dòng Insights của §7
- [X] T004 [P] Recipe nháp Q-36 (thẻ metric/metric-list, định dạng có điều kiện; đề xuất ánh xạ biến CSS màu của
      Directus trong metadata (`--theme--primary`, `--theme--primary-subdued`, `--blue`, `--blue-25`, `--theme--danger`,
      `--danger-25`, `--purple`, `--purple-25`) sang token, ví dụ `brand-500`/`brand-50`, `blue-light-500`/`blue-light-50`,
      `error-500`/`error-50`, `theme-purple-500`; trạng thái "Mở", design owner chốt trước T082), Q-37 (drawer panel: `BoFancySelect` lưới, nhóm header, raw editor), Q-38
      (chuông header: nút tròn TailAdmin + badge số, cách hiện > 99, ẩn khi 0), Q-39 (drawer thông báo: tab dọc, dòng ô
      chọn + subject + thời gian + mở rộng markdown + nút mở, thanh hành động khi chọn, rỗng) vào
      `design-system/docs/component-specs.md` mục "Tier 3 recipes, nháp (018)"
- [X] T005 [P] Ngoại lệ a11y lưới dashboard (FR-027, FR-106): thêm mục "018 lưới dashboard Insights: kéo tile và 8 tay
      cầm đổi cỡ chỉ chuột/pointer, cảm ứng không bảo đảm; tới được bằng phím: nút sửa, +, Save, Clear Changes, pencil,
      menu tile, drawer panel, zoom" vào `design-system/qa/handoff-checklist.md` cạnh mục canvas 017, trạng thái "chờ tech
      lead duyệt"
- [X] T006 [P] Thư viện (R1): `pnpm-workspace.yaml` catalog thêm `apexcharts: 4.7.0` trong nhóm 013 "same versions as
      directus/pnpm-workspace.yaml 11.17.4"; `apps/web/package.json` `"apexcharts": "catalog:"`; `pnpm install`;
      `pnpm audit --prod` không có advisory cho `apexcharts` (ghi kết quả vào research bảng kiểm)

**Checkpoint**: T001 xong trước Phase 2; T002 xong trước test so body (T014, T110); T003–T005 xong trước task giao diện
tương ứng.

---

## Phase 2: Foundational (registry panel, utils port, store insights, bộ mẫu, API giả lập, harness)

**Purpose**: phần dùng chung cho mọi story. KHÔNG bắt đầu story nào trước khi phase này xong.

### Registry và utils

- [X] T010 Chép 11 `directus/app/src/panels/<id>/index.ts` vào `src/panels/<id>/index.ts` (bỏ `import PreviewSVG` và
      khóa `preview`, D-110; `definePanel` identity trong `src/panels/define.ts`; `component` trỏ `./Panel<Id>.vue` tạm là
      component rỗng tới T044–T046), kiểu `src/panels/types.ts` (`PanelConfig`, `PanelQuery`) và registry tĩnh
      `src/panels/index.ts` (`panels` sắp theo `id`, `getPanel(id)`; theo mẫu `src/operations/index.ts` của 017) theo
      data-model §4; `get-groups` dùng ở `line-chart`, `time-series` trỏ T012; manifest `tools/port-manifest/018-T010.json`
- [X] T011 Mở rộng `apps/web/scripts/extract-directus-registry.mjs` thêm `PANEL_IDS` (11 id) và trích `panels` (id, icon,
      name, description, minWidth, minHeight, variable, skipUndefinedKeys, options tĩnh; options hàm với bộ đối số mẫu
      cho `variable` (`{type: 'string'}`, `{type: 'integer'}`) và mọi loại có options hàm; `query(options)` với 3 bộ
      options mẫu mỗi loại có query) vào `fixtures/directus-registry.json`; test `src/panels/registry.test.ts` so registry
      T010 với fixture (FR-040, FR-031, SC-006)
- [X] T012 [P] Chép `utils/get-groups.ts`, `utils/query-to-gql-string.ts`, `utils/point-on-line.ts`,
      `utils/format-number.ts` vào `src/utils/` (header nguồn; `query-to-gql-string` dùng `useFieldsStore` 012 cho khóa
      chính và `json-to-graphql-query` đã có) với test `src/utils/{get-groups,query-to-gql-string,point-on-line,format-number}.test.ts`
      (port test Directus nếu có, thêm ca: aggregate + groupBy, filter `year(x)` → `x_func`, collection hệ thống bỏ
      tiền tố, không `fields` → khóa chính; điểm trên/ngoài đoạn; `notation compact`, `style currency`, `unit`); manifest
      `018-T012.json`
- [X] T013 [P] Chép `composables/use-auto-fit-text.ts` vào `src/composables/use-auto-fit-text.ts`; viết lại
      `panels/pie-chart/color-generator.ts` vào `src/panels/shared/color-generator.ts` trên `color` 5.0.2 (`lab()`, R1,
      `// Backoffice: color instead of chroma-js`); `src/panels/shared/conditional.ts` chép các hàm so sánh của từng
      panel (metric, metric-list, meter, bar-chart, pie-chart) giữ quirk R-53; test
      `src/panels/shared/{color-generator,conditional}.test.ts` (độ dài, không trùng màu, màu đầu = gốc; mỗi toán tử, ca
      `<=` như `<`, `contains` ngược của bar-chart); manifest `018-T013.json`

### Store insights

- [X] T014 Port `stores/insights.ts` vào `src/stores/insights.ts` theo research R4 và data-model §2, §5, §6 (`apiFetch`
      cho `/graphql`, `/graphql/system`; `fetchAll`; `getSimpleHash`, `applyOptionsData` của `@directus/utils`;
      `isSystemCollection` của `src/utils/get-item-route.ts`; `showUnexpectedError`); `src/hydrate.ts` gọi `hydrate`/
      `dehydrate` của store sau store permissions (D-45 phần insights gỡ); test `src/stores/insights.test.ts`
      (contracts/tests §1: hydrate có/không quyền, tài liệu GraphQL gộp so `graphql.bo_dash_all.json` sau thay
      `query_<hex>`, tách hệ thống, lỗi từng phần, 400 gọi lại, `setVariable` chỉ nạp lại panel liên quan, biến quan hệ
      rỗng, biến dùng chung giữa hai dashboard (R-55), nhớ 3 dashboard, 8 kịch bản staging/Save so body mốc T002: thêm
      (2), sửa options (7), kéo + đổi cỡ (3), nhân bản + xóa (8), Copy To (4), Save rỗng (9); Save lỗi một phần: không
      `hydrate`, staging giữ (R-56); `stagePanelUpdate` với id không có trong store không ném lỗi); manifest `018-T014.json`

### Bộ mẫu, mock, mở rộng nhỏ

- [X] T015 [P] `src/modules/content/routes/ContentNotFound.vue`: `module` thêm `'insights' | 'activity'` (link về module
      tương ứng); test cạnh file thêm hai ca
- [X] T016 Bộ mẫu `bo_insights` (FR-103, data-model §12): `fixtures/seed.mjs` thêm `createInsightsFixtures()` sau
      `createFlowsFixtures` (collection `bo_insights_data` qua `POST /collections` với 7 field và 12 dòng cố định, user cố
      định `bo-insights-user`; `POST /dashboards` ×5 rồi `POST /panels` mảng theo bảng §12; 3 `POST /notifications` cho
      admin với ba dạng đích, chỉ cho dev/parity UI), cleanup theo tên `bo_dash_*`, subject `bo_notification_*`, xóa
      collection `bo_insights_data` và user `bo-insights-user`; `fixtures/lib.mjs` thêm
      `DASHBOARDS`, `NOTIFICATIONS`; `fixtures/export.mjs` xuất `snapshot/dashboards.json`, `panels.json`,
      `notifications.json`, `items.bo_insights_data.json`, `activity.json` (20 dòng đầu của admin); `tests/parity/src/web/fixtures-seed.test.ts` so hai
      app (bỏ `timestamp`, `directus_activity`); chạy seed trên 8155 và 8156 rồi commit snapshot
- [X] T017 API giả lập: `src/test-utils/fetch.ts` thêm #185–#203 vào `KNOWN_REQUESTS`, `ENDPOINTS` thêm `dashboards`,
      `panels`, `activity`, `notifications`; `mockFixtureApi` trả snapshot T016, `POST /graphql` theo alias từ
      `graphql.bo_dash_all.json` (T002), nhận ghi `/dashboards`, `/panels`, `/notifications` vào `fetch.db`, cho phép
      test ép 500 và lỗi GraphQL từng phần; `src/test-utils/fixtures.ts` `Snapshot` thêm bốn khóa (contracts/tests §2)

### Harness E2E và ngân sách

- [X] T018 [P] E2E harness: `e2e/helpers/allowed-paths.ts` thêm #185–#203; `e2e/helpers/flows.ts` export
      `moveAndRelease` (một dòng, 017 không đổi); `e2e/helpers/insights.ts` (mới: `openDashboard`, `readGrid`,
      `dragTile`, `resizeTile`, `readChartTable`, `readTileText`, `setVariable`, `createTempDashboard`,
      `deleteTempDashboards`, `createTempNotification`, `deleteTempNotifications`); `e2e/helpers/fixtures.ts` thêm
      `DASHBOARDS`, `NOTIFICATIONS`; `e2e/helpers/payload.ts` `PATHS` thêm dashboards/panels/notifications/activity/
      graphql/utils-import, `normalizeInsightsBody`, `normalizeGraphql` (contracts/components §8)
- [X] T019 [P] `apps/web/scripts/check-bundle.mjs`: `BUDGET_018 = BUDGET_017 + 15 * 1024`, `LAZY_BUDGETS_018` (route
      Insights `data-insights-route` 60 KB, panel components 40 KB, `apexcharts` 170 KB, `NotificationsDrawer` 15 KB gzip;
      chốt số `apexcharts` sau lần build đầu ở T050) gộp vào `LAZY_BUDGETS`; test của script cập nhật

**Checkpoint**: registry, utils, store, bộ mẫu, mock và harness sẵn sàng.

---

## Phase 3: User Story 1 - Danh sách dashboard: tạo, sửa, nhân bản, xuất, nhập, xóa (Priority: P1) 🎯 MVP — Lượt 1

**Goal**: `/insights` với bảng, tìm, hộp dashboard, menu dòng, xuất, nhập, xóa, sub-menu (spec US1, FR-001, FR-003,
FR-004, FR-010–FR-015).

**Independent Test**: spec US1 Independent Test: dashboard tạm tạo ở app mới xuất hiện trên Directus app với cùng giá
trị; nhân bản, xuất/nhập, xóa so DB.

### Tests cho User Story 1

- [X] T030 [P] [US1] `insights/routes/InsightsOverviewRoute.browser.test.ts`: cột, sắp xếp, tìm không phân biệt hoa
      thường, autofocus khi > 25, ô tìm ẩn khi 0, nút tạo/xuất/xóa gated theo quyền (`useCollectionPermissions`), menu
      dòng (Edit/Duplicate/Export/Delete), nhân bản body #187 và lỗi 500 → hộp lỗi + nút trở lại (R-49), xuất #191 qua
      `apiFetch` + blob, xóa một (#189) và nhiều (#190) có hộp xác nhận, rỗng `no_dashboards`/`no_results`, click/Ctrl-click
- [X] T031 [P] [US1] `insights/components/DashboardDialog.browser.test.ts` (tạo: body #187 `fields=id` → `hydrate` →
      điều hướng; sửa: #188, không điều hướng; Name bắt buộc; icon mặc định `dashboard`) và
      `src/components/sidebar/BasicImportSidebarDetail.browser.test.ts` (file JSON/CSV, #192 multipart, thành công notice
      `import_data_success` + `refresh`, lỗi → `ImportErrorDialog`)
- [X] T032 [P] [US1] `src/modules/insights.test.ts`: `/insights` → `insights-overview`, `/insights/<id>` →
      `insights-dashboard` với `beforeEnter` gọi `refresh`, `/insights/<id>/+` → `panel-detail`;
      `/content/directus_dashboards(/<id>)` chuyển hướng (FR-003)

### Implementation cho User Story 1

- [X] T033 [US1] `src/modules/insights.ts`: thay `placeholderRoutes('insights')` bằng ba route của data-model §1 (lazy
      import, `props: true`, `meta.isFloatingView` cho `panel-detail`); `DashboardRoute` và `PanelConfiguration` tạm là
      `InsightsNotFound` tới T048, T067; sửa comment "khung" ở `src/utils/get-item-route.ts`
- [X] T034 [P] [US1] `insights/routes/InsightsNotFound.vue` port `routes/not-found.vue` (dùng `ContentNotFound
      module="insights"`); manifest `018-T034.json`
- [X] T035 [P] [US1] `insights/components/DashboardDialog.vue` port `components/dashboard-dialog.vue` (`BoDialog`, Name,
      `select-icon`, `select-color`, Note; request và điều hướng như data-model §3) theo recipe Q-36/Q-2; manifest
      `018-T035.json`
- [X] T036 [P] [US1] `src/components/sidebar/BasicImportSidebarDetail.vue` port
      `views/private/components/basic-import-sidebar-detail.vue` (`SidebarDetail id="import" icon="publish"`, chọn file,
      `apiFetch` multipart #192, trạng thái tải/nhập, `notify`, `ImportErrorDialog`); manifest `018-T036.json`
- [X] T037 [P] [US1] `insights/components/InsightsNavigation.vue` port `components/navigation.vue` (sub-menu L-2 từ
      `insightsStore.dashboards` với icon màu inline, `aria-current`, nút tạo khi rỗng mở `DashboardDialog`); gắn vào slot
      `navigation` của `PrivateView`; manifest `018-T037.json`
- [X] T038 [US1] `insights/routes/InsightsOverviewRoute.vue` port `routes/overview.vue` theo research R7 (`PrivateView
      fill`, `BoTable`, `SearchInput`, header Export/Delete/+, `BoMenu` dòng, `BoDialog` xóa, `DashboardDialog`,
      nhân bản với `try/catch` R-49, xuất blob R2, sidebar `BasicImportSidebarDetail collection="directus_dashboards"
      @refresh="hydrate"`, `data-insights-route` cho bundle) theo recipe Q-2; manifest `018-T038.json`
- [X] T039 [US1] E2E `e2e/insights-overview.spec.ts` (contracts/tests §3): bảng 5 dashboard, sub-menu, tìm, tạo dashboard
      tạm (URL `/insights/<id>`; trang đích kiểm ở T049), sửa, nhân bản (số panel bản sao qua API), xuất (request + file
      tải), nhập lại file đã xuất, xóa một và nhiều; chromium 768/1280 ba cấu hình

**Checkpoint**: US1 dùng được độc lập; dashboard tạo ở app mới thấy được trên Directus app (kiểm tay, tự động ở T113).

---

## Phase 4: User Story 2 - Xem dashboard: panel hiển thị đúng số liệu, zoom vừa màn, tự làm mới (Priority: P1) — Lượt 1

**Goal**: trang dashboard chế độ xem với 11 panel, trạng thái tile, zoom, auto refresh, bình luận (spec US2, FR-020–
FR-023, FR-040–FR-052).

**Independent Test**: spec US2 Independent Test: `bo_dash_all` ở hai app cùng vị trí/cỡ, header, giá trị, dữ liệu biểu
đồ và tài liệu GraphQL.

### Tests cho User Story 2

- [X] T040 [P] [US2] `insights/routes/DashboardRoute.browser.test.ts` (chế độ xem với mock T017): 11 tile đúng
      `data-pos-x/y`, `data-width/height`, header khi `show_header` (icon/màu/tên/tooltip note), bo góc theo tile kề,
      vòng quay khi đang nạp, lỗi panel (GraphQL từng phần) chỉ ở tile đó, `no_data`, type lạ `bo-unknown` thân rỗng, một
      #196 + một #197 cho `bo_dash_system`, zoom bật/tắt (scale < 1 khi lưới lớn hơn vùng nội dung), auto refresh 10 s
      (fake timers → #196 lần hai), Comments sidebar, dashboard không có → not-found
- [X] T041 [P] [US2] Test component 11 panel `src/panels/<id>/Panel<Id>.browser.test.ts` với dữ liệu mẫu (FR-042–FR-052):
      metric (aggregate, `first`/`last`, prefix/suffix/notation/unit, màu điều kiện khớp cuối, auto-fit), metric-list
      (nhóm, thanh %, màu), meter (phần trăm, half, màu điều kiện khớp đầu), label, list (template, `linkToItem` mở
      `DrawerItem` → `PATCH` → `refresh`), bar/line/pie/time-series (options apexcharts dựng đúng type/series/categories/
      màu mặc định token, `ChartTable` cột và dòng, sparkline khi nhỏ, `missingData` của time-series, `range auto` và
      `now`), variable (interface theo `inter`, nửa rộng khi `width < 20`), relational-variable (hiển thị item đã chọn qua
      `use-display-items` #198); axe một tile mỗi loại sáng/tối
- [X] T042 [P] [US2] `src/components/workspace/BoWorkspace.browser.test.ts` thêm: `zoomToFit` tính scale theo vùng nội
      dung và đổi khi resize cửa sổ; slot `{tile, gridSize}`; ca flows 017 giữ nguyên

### Implementation cho User Story 2

- [X] T043 [US2] `src/components/workspace/BoWorkspace.vue`: prop `zoomToFit`, `resizable`, slot `gridSize`, `transform:
      scale()` theo research R3 (inject vùng nội dung theo T001 (b); thêm `provide` ở `src/layout/PrivateView.vue` nếu
      thiếu); flows 017 không truyền prop mới; manifest `018-T043.json` (phần zoom của `v-workspace.vue`)
- [X] T044 [P] [US2] `src/panels/shared/use-apex-chart.ts` (nạp lười `import('apexcharts')`, `render`/`updateOptions`/
      `destroy`, vẽ lại khi theme tối đổi theo T001 (f), `prefers-reduced-motion` tắt animation) và
      `src/panels/shared/ChartTable.vue` (`<table class="sr-only">` + `<caption>` = nhãn tile, `data-chart-table`, giá trị
      số sau biến đổi của panel trước định dạng, FR-105) và `src/styles/apexcharts.css` (ghi đè CSS tooltip/legend của
      thư viện chỉ bằng biến theme, biến thể `.dark`, quét bởi `check-raw-colors`; CHK043); test cạnh file
- [X] T045 [P] [US2] Port `panel-metric.vue`, `panel-metric-list.vue`, `panel-meter.vue`, `panel-label.vue`,
      `panel-list.vue` thành `src/panels/{metric,metric-list,meter,label,list}/Panel*.vue` (`formatNumber`,
      `useAutoFontFit`, `conditional.ts`, `RenderTemplate`, `DrawerItem`; màu mặc định `cssVar('--color-brand-500')`
      D-108) theo recipe Q-36; manifest `018-T045.json`
- [X] T046 [P] [US2] Port `panel-bar-chart.vue`, `panel-line-chart.vue`, `panel-pie-chart.vue`, `panel-time-series.vue`
      thành `src/panels/{bar-chart,line-chart,pie-chart,time-series}/Panel*.vue` (options apexcharts như Directus, màu từ
      token + `color-generator`, `ChartTable` từ cùng series, `abbreviateNumber`, `n()`, `adjustDate`, `fillGaps` của
      time-series) theo recipe Q-35; manifest `018-T046.json`
- [X] T047 [P] [US2] Port `panel-variable.vue`, `panel-relational-variable.vue`, `use-display-items.ts` thành
      `src/panels/{variable,relational-variable}/Panel*.vue` và `src/panels/relational-variable/use-display-items.ts`
      (hiển thị và chọn: `getInterface(inter)?.component`, `DrawerCollection`, `getVariable`/`setVariable` của store);
      manifest `018-T047.json`
- [X] T048 [US2] `insights/components/PanelTile.vue` (`BoWorkspaceTile` + trạng thái + `onErrorCaptured` + component của
      registry; `aria-label` tên panel hoặc loại) và `insights/routes/DashboardRoute.vue` port `routes/dashboard.vue` phần
      xem (`PrivateView fill`, nút zoom `fit_to_screen` và sửa (khóa theo `useItemPermissions('directus_panels')`),
      `BoWorkspace`, bo góc `pointOnLine`, `now` một lần, `applyOptionsData` cho tile, sidebar Comments + Refresh với
      `refreshIntervals`, `InsightsNotFound` khi không có, `RouterView name="detail"`) theo recipe Q-34; route ở T033 trỏ
      component thật; manifest `018-T048.json`
- [X] T049 [US2] E2E `e2e/insights-dashboard.spec.ts` (contracts/tests §3): `bo_dash_all` lưới/header/giá trị text,
      `readChartTable` 5 biểu đồ so mốc T002, `bo_dash_system`, `bo_dash_empty`, `bo_dash_unknown`, zoom, auto refresh
      10 s, Comments; trang đích của tạo dashboard (T039); chromium 768/1280 ba cấu hình
- [X] T050 [US2] Đóng lượt 1: lint, typecheck, `web:test`, `web:build`, `check-bundle` (chốt `apexcharts` trong
      `LAZY_BUDGETS_018` và ghi số đo vào spec FR-109), ghi thời gian job `e2e-web` (CHK054), `check-port-headers`, `check-raw-colors`, E2E `insights-*` + `settings-flows-*` xanh ở
      `proxy-api` local; nhắn phiên chung checkout; commit `feat(018): insights overview, dashboard view and the 11 panels
      (wave 1)`; push; CI xanh; `graphify update .`

**Checkpoint**: US1 + US2 dùng được; dashboard tạo ở Directus hiển thị ở app mới (tiêu đề tiêu chí chấp nhận, phần xem).

---

## Phase 5: User Story 3 - Sửa dashboard: thêm, cấu hình, kéo, đổi cỡ, nhân bản, chép, xóa panel, lưu một lần (Priority: P1) — Lượt 2

**Goal**: chế độ sửa, drawer panel, resize, menu tile, Save ba request (spec US3, FR-024–FR-032).

**Independent Test**: spec US3 Independent Test (vị trí, cỡ, options, `directus_panels` bằng Directus app).

### Tests cho User Story 3

- [X] T060 [P] [US3] `src/components/workspace/BoWorkspaceTile.browser.test.ts` thêm: 8 tay cầm chỉ ở chế độ sửa và khi
      `resizable`; delta ô; kẹp `minWidth/minHeight` và vị trí ≥ 1; top/left trôi ở cỡ tối thiểu (R-54); `update` chỉ
      khóa đổi; nhãn `W×H`; `color`, `note`, `borderRadius`; ca flows 017 (không resize) giữ xanh; chạy lại
      `src/modules/settings/routes/flows` xanh
- [X] T061 [P] [US3] `insights/routes/DashboardRoute.edit.browser.test.ts`: vào sửa (zoom tắt, +25 ô, nút), kéo và
      resize → staging, Duplicate (+2/+2), Copy To (staging với `dashboard` đích, Clear bỏ cả bản sao), Delete không hộp,
      Save → #193/#194/#195 chỉ khi có, body so mốc T002, `hydrate`, về chế độ xem; Save lỗi một phần (một request 500):
      hộp lỗi, không `hydrate`, staging giữ, về chế độ xem, guard còn chặn (R-56); Clear Changes hộp xác nhận; guard
      `unsaved_changes` (bỏ qua `/insights/<id>/*`, chặn khi chỉ có bản sao Copy To); `meta+s` cả ngoài chế độ sửa (không
      thay đổi → 0 request); người không quyền `update`: nút sửa khóa, URL `/insights/<id>/+` vẫn mở drawer; focus FR-029
- [X] T062 [P] [US3] `insights/routes/PanelConfiguration.browser.test.ts`: lưới 11 loại (icon, tên, mô tả; không ảnh),
      chọn loại → options `ExtensionOptions type panel` + raw editor, đổi loại đặt lại options; nhóm header khóa khi tắt
      Show Header; Done mới → `stagePanelCreate` cỡ tối thiểu, vị trí (1,1); Done sửa → `stagePanelUpdate`; `panelKey`
      không có trong store → drawer rỗng, Done khóa tới khi chọn loại, không lỗi; type lạ → lưới không chọn; Cancel; axe
      (metric, time-series, variable) sáng/tối; `ExtensionOptions.test.ts` + ca `panel`; `BoFancySelect.test.ts` + `grid`

### Implementation cho User Story 3

- [X] T063 [US3] `src/components/workspace/BoWorkspaceTile.vue`: `resizable`, `minWidth`, `minHeight`, `color`, `note`,
      `borderRadius`, 8 tay cầm `data-resize`, nhãn `W×H`, `update` mở rộng, `data-width/height`, icon ghi chú là nút có
      `aria-label` = note với `BoTooltip` mở khi focus (FR-106, "Cần xác nhận"), `role="region"` + `aria-label` theo research R3 và
      data-model §8 (thuật toán `v-workspace-tile.vue:141-269`, quirk R-54); manifest `018-T063.json`
- [X] T064 [P] [US3] `src/components/BoFancySelect.vue`: prop `layout: 'list' | 'grid'` (grid 2 cột ở 768, 3 cột từ lg;
      mục icon lớn + tên + mô tả) theo recipe Q-37
- [X] T065 [P] [US3] `src/modules/settings/routes/data-model/field-detail/shared/ExtensionOptions.vue`: `type` thêm
      `'panel'` (như `operation`: không chạm store field)
- [X] T066 [P] [US3] `insights/components/CopyPanelDialog.vue` port `dashboard.vue:330-355` (`BoDialog`, `BoSelect`
      dashboard khác, mặc định đầu tiên, notice `no_other_dashboards_copy`, Copy khóa khi rỗng) → `stagePanelDuplicate(id,
      {dashboard})`; manifest `018-T066.json`
- [X] T067 [US3] `insights/routes/PanelConfiguration.vue` port `routes/panel-configuration.vue` theo research R6
      (`BoDrawer persistent`, `useDialogRoute`, `BoFancySelect layout="grid"`, `ExtensionOptions type="panel"`, nhóm
      header, id tạm `_<nanoid>`); route `panel-detail` trỏ component thật; manifest `018-T067.json`
- [X] T068 [US3] `insights/routes/DashboardRoute.vue` chế độ sửa: nút Clear/+/Save, `useShortcut('meta+s')`,
      `useEditsGuard` + hộp `unsaved_changes` (D-76), hộp Clear, `PanelTile` sự kiện → store, `CopyPanelDialog`, focus
      FR-029 theo recipe Q-34
- [X] T069 [US3] E2E `e2e/insights-edit.spec.ts` (contracts/tests §3): dashboard tạm, "+" metric và bar chart, kéo (13,1),
      resize 8×4, Save (body qua `recordWrites`), Duplicate, Copy To sang dashboard tạm 2 rồi Save, Delete, Clear, guard,
      `meta+s`; thêm vào danh sách core của `apps/web-e2e/playwright.config.ts` (firefox/webkit 1280 cùng origin); kéo theo
      bài học 017 (`moveAndRelease`, `settleFrames`); chromium 768/1280 ba cấu hình

**Checkpoint**: US3 dùng được; dashboard sửa ở app mới mở được trên Directus app (tự động ở T113).

---

## Phase 6: User Story 4 - Biến dashboard (Priority: P2) — Lượt 2

**Goal**: đổi biến ở panel Variable/Relational Variable lọc các panel dùng `{{ biến }}` (spec US4, FR-053–FR-056).

**Independent Test**: spec US4 Independent Test trên `bo_dash_vars`.

### Tests cho User Story 4

- [X] T070 [P] [US4] `src/panels/variable/PanelVariable.browser.test.ts` và
      `src/panels/relational-variable/PanelRelationalVariable.browser.test.ts` thêm: đổi giá trị → `setVariable` → một
      #196 chỉ chứa panel có `{{ status }}`; chọn item qua `DrawerCollection` (`multiple`, giới hạn `limit`) → biến là mảng
      khóa; bỏ chọn hết → panel dùng biến `data = {}` không request; mặc định `defaultValue` trước lần nạp đầu

### Implementation cho User Story 4

- [X] T071 [US4] Hoàn thiện tương tác biến trong `src/panels/variable/PanelVariable.vue`,
      `src/panels/relational-variable/PanelRelationalVariable.vue` (giới hạn `limit`, chế độ một giá trị lưu scalar như
      Directus, đổi `collection` xóa biến qua `stagePanelUpdate`) và `DashboardRoute.vue` (`applyOptionsData` tính lại
      khi `variables` đổi); sửa store T014 nếu test T070 thấy lệch
- [X] T072 [US4] E2E `e2e/insights-variables.spec.ts`: `bo_dash_vars` đổi `vars_status` 3 giá trị, chọn `vars_author`, so giá trị
      metric và số dòng list, chỉ panel liên quan phát request, tải lại → về mặc định; chromium ba cấu hình
- [X] T073 [US4] Đóng lượt 2: lint, typecheck, `web:test`, `web:build`, `check-bundle`, `check-port-headers`,
      `check-raw-colors`, E2E `insights-*` + `settings-flows-*` xanh ở `proxy-api` local; nhắn phiên chung checkout; commit
      `feat(018): dashboard edit mode, panel drawer, tile resize and variables (wave 2)`; push; CI xanh;
      `graphify update .`

**Checkpoint**: Insights đầy đủ (US1–US4).

---

## Phase 7: User Story 5 - Activity (Priority: P2) — Lượt 3

**Goal**: `/activity` theo preset, sub-menu lọc hệ thống, lọc nâng cao, drawer chi tiết, mở item (spec US5, FR-002,
FR-060–FR-065).

**Independent Test**: spec US5 Independent Test.

### Tests cho User Story 5

- [X] T080 [P] [US5] `activity/routes/ActivityCollectionRoute.browser.test.ts` (preset mặc định tabular, sort
      `-timestamp`, 4 cột và rộng; sub-menu 7 mục → `filterSystem` trong #199 và `aria-current`; lọc nâng cao gộp `_and`;
      `showSelect none`; rỗng) và `activity/routes/ActivityItemRoute.browser.test.ts` (#200 fields, nhãn action dịch hoặc
      khóa thô, ngày `toLocaleString`, `UserPopover`, `user` null → hàng User rỗng, nút `launch` ẩn khi hệ thống hoặc
      `delete`, lỗi → `BoNotice danger` với thông điệp đã dịch,
      đóng giữ bộ lọc); `src/modules/activity.test.ts` (route, `hidden`, `/content/directus_activity(/<id>)` chuyển hướng)

### Implementation cho User Story 5

- [X] T081 [US5] `src/modules/activity.ts`: thay khung bằng `activity-collection` và con `activity-item` (data-model §1),
      giữ `hidden`; preset mặc định `directus_activity` vào `src/stores/presets.ts` nếu T001 (c) thấy thiếu (port
      `stores/presets.ts:63-82`)
- [X] T082 [P] [US5] `activity/components/ActivityNavigation.vue` port `modules/activity/components/navigation.vue`
      (All, My Activity, vạch, Create/Update/Delete/Login/Logout; mục active theo T001 (e)); màu nhãn action của bảng: áp
      ánh xạ Q-36 đã chốt (ví dụ alias biến CSS Directus sang token trong `src/styles/theme.css` hoặc trong
      `DisplayLabels.vue`, có test), không tự chọn khi Q-36 chưa chốt;
      manifest `018-T082.json`
- [X] T083 [US5] `activity/routes/ActivityCollectionRoute.vue` port `modules/activity/routes/collection.vue` (research R8:
      `usePreset`, `useLayout`, `createLayoutWrapper showSelect="none"`, `SearchInput showFilter`, `LayoutSidebarDetail`,
      tiêu đề `activity_feed` icon `access_time`, `RouterView name="detail"`); manifest `018-T083.json`
- [X] T084 [US5] `activity/routes/ActivityItemRoute.vue` port `modules/activity/routes/item.vue` (`BoDrawer`,
      `useDialogRoute`, #200, `getItemRoute`); manifest `018-T084.json`
- [X] T085 [US5] E2E `e2e/activity.spec.ts`: tạo/sửa/xóa item `bo_content` tạm, cột và thứ tự, 4 mục sub-menu, lọc nâng
      cao `collection`, drawer, `launch` tới trang item 014, chuyển hướng `/content/directus_activity`, role tối thiểu
      (Fixtures 014–016) chỉ thấy của mình; chromium 768/1280 ba cấu hình

**Checkpoint**: Activity dùng được độc lập.

---

## Phase 8: User Story 6 - Chuông và drawer thông báo (Priority: P2) — Lượt 3

**Goal**: chuông ở header với badge, drawer Inbox/Archive, archive/unarchive/xóa, mở item, link Activity (spec US6,
FR-070–FR-077).

**Independent Test**: spec US6 Independent Test với 3 thông báo mẫu.

### Tests cho User Story 6

- [X] T090 [P] [US6] `src/layout/NotificationsBell.browser.test.ts` (badge số từ store, ẩn khi 0 và nút vẫn bấm được,
      `aria-label` kèm số, vùng `aria-live="polite"` báo khi số đổi, bấm → `notificationsDrawerOpen`) và
      `src/stores/app.test.ts` (`notificationsDrawerOpen`)
- [X] T091 [P] [US6] `src/components/NotificationsDrawer.browser.test.ts`: không request khi đóng; mở → #201 tab Inbox;
      đổi tab bỏ chọn và nạp Archive; chọn một/tất cả (lưng chừng); Archive/Unarchive #202 + #201 + #26; Delete hộp xác
      nhận #203; lỗi (500) của danh sách, Archive, Delete → hộp lỗi; Archive lỗi giữ lựa chọn, Delete lỗi bỏ lựa chọn và
      đóng hộp (R-57); skeleton 10 dòng khi nạp; không làm mới khi đang mở; đích FR-072 ba dạng (singleton theo
      `meta.singleton`) + không đích (không nút); mở đích đóng drawer; `md(message)` làm sạch (script bị bỏ, link `_self`);
      tìm (`search`, highlight `mark`); rỗng `no_notifications`/`no_results`; phân trang 25; link Activity; axe hai tab
      sáng/tối

### Implementation cho User Story 6

- [X] T092 [P] [US6] `src/stores/app.ts`: `notificationsDrawerOpen` (gỡ ghi chú hoãn :24-25); `src/stores/notifications.ts`
      sửa comment đầu file (drawer có ở 018, không snackbar)
- [X] T093 [P] [US6] `src/layout/NotificationsBell.vue` port `module-bar-avatar.vue:56-65` theo recipe Q-38 (+ vùng
      `aria-live` sr-only, FR-070); chèn trước
      `UserMenu` trong `src/layout/AppHeader.vue` (sửa comment D-45); manifest `018-T093.json`
- [X] T094 [P] [US6] `src/components/NotificationItem.vue` port `views/private/components/notification-item.vue`
      (`BoCheckbox`, subject `mark`, `formatDistanceToNow`, nút `open_in_new`, mở rộng `md(message)`) theo recipe Q-39;
      manifest `018-T094.json`
- [X] T095 [US6] `src/components/NotificationsDrawer.vue` port `views/private/components/notifications-drawer.vue`
      (research R8: `BoDrawer` từ store app, `BoTabs vertical` Inbox/Archive, link Activity, `SearchInput`, hành động khi
      chọn, `BoDialog` xóa, `BoPagination`, skeleton 10 dòng, `refreshUnreadCount` sau ghi, hộp lỗi cho lỗi nạp/Archive/
      Delete (R-57), `data-notifications-drawer` cho bundle); gắn một
      lần trong `src/layout/PrivateView.vue`; không danh sách upload TUS (FR-076); manifest `018-T095.json`
- [X] T096 [US6] E2E `e2e/notifications.spec.ts`: user tạm `Fixtures` + 3 thông báo tạo ở `beforeAll` (xóa ở
      `afterAll`; không dùng thông báo của admin): badge 3, drawer hai tab, mở ba dạng đích, archive → badge 2 và dòng sang
      Archive, unarchive, xóa thông báo tạm có xác nhận, tìm, link Activity; chromium 768/1280 ba cấu hình

**Checkpoint**: Notifications dùng được độc lập.

---

## Phase 9: User Story 7 - Thông báo thành công và lỗi (giữ notice tại chỗ, D-66) (Priority: P3) — Lượt 3

**Goal**: màn mới của 018 dùng `notify` (notice tại chỗ) và `showUnexpectedError` (hộp lỗi không "Report error") (spec
US7, FR-080–FR-082).

**Independent Test**: spec US7 Independent Test.

- [X] T100 [US7] Kiểm và hoàn thiện hộp lỗi của `src/components/NoticeStack.vue`/`src/composables/use-notices.ts` theo
      T001 (g): tiêu đề `errors.<code>` hoặc `unexpected_error`, chi tiết, Dismiss, focus Dismiss, không "Report error"
      (D-109); `utils/unexpected-error.ts` không đổi (Clarifications); test cạnh file thêm ca thiếu; rà mọi lời gọi lỗi ở
      `insights/`, `activity/`, `src/panels/`, `NotificationsDrawer.vue`, `BasicImportSidebarDetail.vue` dùng
      `showUnexpectedError`/`notify`
- [X] T101 [US7] E2E thêm vào `e2e/notifications.spec.ts`: notice tại chỗ `role="status"` sau nhập dashboard, tự ẩn sau
      3000 ms; `page.route` trả 500 cho Save dashboard → hộp lỗi, focus Dismiss
- [X] T102 [US7] Đóng lượt 3: lint, typecheck, `web:test`, `web:build`, `check-bundle`, `check-port-headers`,
      `check-raw-colors`, E2E `insights-*`, `activity`, `notifications`, `settings-*`, `content-*` xanh ở `proxy-api`
      local; nhắn phiên chung checkout; commit `feat(018): activity module, notifications bell and drawer (wave 3)`; push;
      CI xanh; `graphify update .`

**Checkpoint**: mọi story chức năng xong.

---

## Phase 10: User Story 8 - Đối chiếu với Directus, E2E ba cấu hình, dùng chéo, recipe (Priority: P2) — Lượt 4

**Goal**: bằng chứng tiêu chí chấp nhận (spec US8, FR-100–FR-111, SC-002–SC-009).

**Independent Test**: spec US8 Independent Test.

- [ ] T110 [P] [US8] `e2e/payload/insights.spec.ts` (contracts/tests §4, 10 kịch bản trên Directus app 8155 rồi
      Backoffice; tài liệu GraphQL `bo_dash_all`, `bo_dash_vars` so sau `normalizeGraphql`; DB `INSIGHTS_TABLES` sau (1)–
      (7), (9), (10)); `e2e/helpers/db-rows.ts` thêm `INSIGHTS_TABLES`, `NOTIFICATIONS_TABLES` và chuẩn hóa data-model §3,
      §10; `e2e/helpers/directus-app.ts` thêm bước Directus app cần cho kịch bản
- [ ] T111 [P] [US8] `e2e/payload/activity.spec.ts` và `e2e/payload/notifications.spec.ts` (contracts/tests §4; DB
      `NOTIFICATIONS_TABLES` sau archive/unarchive/xóa)
- [ ] T112 [P] [US8] `e2e/insights-parity-ui.spec.ts` (SC-004 (a)–(f); (c) lọc `collection bo_insights_data`, dòng cùng
      `timestamp` so như tập; `test.skip(e2eConfig !== 'proxy-api')`, so
      `innerText`/`aria-disabled` hai app); thêm vào `DIRECTUS_APP_SPECS`
- [ ] T113 [US8] `e2e/insights-cross-use.spec.ts` (contracts/tests §5 (1)–(5), SC-002, SC-003); `e2e/helpers/directus-app.ts`
      thêm `openDirectusDashboard`, `readDirectusGrid` (+`--width`/`--height`), `readDirectusTileHeaders`,
      `readDirectusTileText`, `openDirectusNotifications`, `archiveDirectusNotification`; thêm vào `DIRECTUS_APP_SPECS`
- [ ] T114 [P] [US8] Perf `insights/perf.browser.test.ts` (`PERF=1`, `machineFactor()`; thêm file vào bước "web perf" của
      `.github/workflows/ci.yml` (job `quality` chạy `web:test` rồi mới tới bước này, theo 016); FR-108: 11 tile < 1500 ms, đổi
      biến < 500 ms, drawer thông báo 25 dòng < 300 ms, kéo/resize 20 tile < 16 ms mỗi move; đếm request mỗi thao tác)
- [ ] T115 [P] [US8] A11y `e2e/a11y.spec.ts` thêm khối 018 (FR-106: `/insights`, dashboard hai chế độ, drawer panel 3
      loại, `/activity`, drawer activity, drawer thông báo hai tab, chuông; sáng/tối; axe 0 serious/critical; màu do người
      dùng chọn loại khỏi quét như 017)
- [ ] T116 [US8] Sửa lệch do T110–T115 tìm ra (spec, code, hoặc ghi R-xx mới với lý do); lặp tới khi SC-002..SC-007 đạt

**Checkpoint**: tiêu chí chấp nhận có bằng chứng tự động.

---

## Phase 11: Polish & Cross-Cutting Concerns — Lượt 4

- [ ] T120 [P] Recipe Q-34..Q-39 trong `design-system/docs/` cập nhật theo code (trạng thái "Recipe theo code (T120)");
      bảng tương phản `design-system/docs/migration-guide.md` thêm cặp mới nếu T115 sửa màu; gửi design owner duyệt
- [ ] T121 [P] Tài liệu: spec 012 (D-40 phần Insights/Activity, D-45 phần insights và drawer thông báo ghi "đã gỡ ở
      018"), 013 (D-66 ghi "xét lại ở 018: giữ"), 014 (D-72 ghi "đã gỡ ở 018" cho `directus_dashboards`,
      `directus_activity`), 015 (D-90 ghi "đã gỡ ở 018: Directus 11.17.4 không có danh sách"); `SPECKIT-GUIDE.md` ghi chú
      cho 019 nếu có; `CLAUDE.md` dòng 018 khớp phạm vi thật, thêm mục Recent Changes 018
- [ ] T122 Bảng "Trạng thái khác biệt" trong `specs/018-insights-activity-notifications/spec.md` (như 017 T102): mỗi D-107..
      D-110, R-49..R-57, ngoại lệ a11y lưới dashboard và mục "Cần xác nhận" với nơi làm trong code; gửi tech lead duyệt;
      ghi duyệt vào bảng và Clarifications
- [ ] T123 Đóng feature: mọi task xong, CI xanh (quality, e2e-web ba cấu hình, parity web), coverage ≥ 60 %, design owner
      duyệt Q-34..Q-39 (SC-008), tech lead duyệt T122 (SC-010) và ngoại lệ a11y trong `handoff-checklist.md`; nhắn phiên
      chung checkout; commit `docs(018): close insights, activity and notifications`; push; `graphify update .`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): T001 trước mọi thứ; T002 ghi mốc chạy sau T016 (seed) và trước T014 (test so body) và T110 (số
  task nhỏ hơn nhưng thứ tự chạy là T016 → T002 → T014); T003–T006 song song.
- Phase 2 (Foundational): sau T001, T006. T010 → T011; T012, T013 song song; T014 cần T010, T012; T016 → T017; T018,
  T019 song song. Chặn mọi story.
- Phase 3 (US1) → Phase 4 (US2) trong lượt 1 (US2 cần route T033; trang đích tạo dashboard kiểm ở T049).
- Phase 5 (US3) cần US2 (`DashboardRoute`, `PanelTile`); Phase 6 (US4) cần US2 (panel biến hiển thị) và có thể song song
  US3.
- Phase 7 (US5), 8 (US6) độc lập với Insights (chỉ cần Phase 2: mock, harness); song song nhau; Phase 9 (US7) cần US6
  (`notifications.spec.ts`).
- Phase 10 (US8) cần US1–US7; Phase 11 sau Phase 10.

### User Story Dependencies

- US1: Phase 2. US2: US1 (route). US3: US2. US4: US2. US5: Phase 2. US6: Phase 2. US7: US6. US8: tất cả.

### Within Each User Story

- Test viết trước và chạy đỏ, rồi code; route trước màn; component con trước trang; E2E sau màn; đóng lượt cuối.

### Parallel Opportunities

- Phase 1: T002 (sau seed), T003, T004, T005, T006.
- Phase 2: T012 | T013 | T015 | T018 | T019 song song; T010 → T011; T016 → T017.
- US1: T030, T031, T032 (test); T034, T035, T036, T037 (component) song song rồi T038 → T039.
- US2: T040, T041, T042 (test); T044, T045, T046, T047 song song sau T043; rồi T048 → T049 → T050.
- US3: T060, T061, T062; T064, T065, T066 song song; T063 → T067 → T068 → T069.
- US5 và US6 song song (khác thư mục): T080 | T090, T091; T082 | T092, T093, T094.
- US8: T110, T111, T112, T114, T115 song song; T113 sau T110 (helper chung `directus-app.ts`).

## Parallel Execution Examples

```text
Lượt 1, Phase 2 (sau T001, T006):
  song song: T012 utils | T013 auto-fit, color, conditional | T015 ContentNotFound | T018 harness | T019 bundle
  rồi: T010 registry → T011 trích + test; T016 seed → T017 mock → T002 mốc; T014 store (sau T010, T012, T002)

Lượt 1, Phase 4:
  song song: T040 | T041 | T042 (test)
  rồi: T043 workspace zoom → song song T044 apex + ChartTable | T045 panel số | T046 biểu đồ | T047 biến
  rồi: T048 PanelTile + DashboardRoute → T049 E2E → T050 đóng lượt

Lượt 3:
  song song: [US5] T080 → T081 → T082 | T083 → T084 → T085   và   [US6] T090, T091 → T092 | T093 | T094 → T095 → T096
  rồi: T100 → T101 → T102

Lượt 4, Phase 10:
  song song: T110 payload insights | T111 payload activity/notifications | T112 parity UI | T114 perf | T115 a11y
  rồi: T113 cross-use → T116 sửa lệch → T120, T121 → T122 → T123
```

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2): danh sách dashboard và trang dashboard xem với 11 panel; E2E
   `insights-overview`, `insights-dashboard` xanh ba cấu hình; dashboard tạo ở Directus hiển thị ở app mới (tiêu chí
   chấp nhận chính).

### Incremental Delivery

1. Lượt 1: US1 + US2 (xem dashboard; chưa sửa).
2. Lượt 2: US3 + US4 (sửa dashboard, resize, drawer panel, biến).
3. Lượt 3: US5 + US6 + US7 (Activity, thông báo, notice/hộp lỗi).
4. Lượt 4: US8 + Polish (bằng chứng tiêu chí chấp nhận, duyệt, đóng).

## Truy vết FR → task

| FR | Task |
|----|------|
| FR-001, FR-003, FR-004 | T032, T033, T037 |
| FR-002, FR-065 | T080, T081 |
| FR-005 (khung màn, notice, hộp lỗi, trạng thái nạp) | T038, T048, T083, T095, T100 |
| FR-006, FR-041, FR-054, FR-055, FR-056 (biến dùng chung, R-55) | T014 (store), T070, T071 |
| FR-010, FR-011, FR-012, FR-013, FR-014, FR-015 | T030, T031, T035, T036, T038, T039 |
| FR-020, FR-021, FR-022, FR-023 | T040, T042, T043, T048 |
| FR-024, FR-025, FR-026, FR-027, FR-028, FR-029 | T005, T060, T061, T063, T066, T068, T069 |
| FR-030, FR-031, FR-032 | T010, T011, T062, T064, T065, T067 |
| FR-040 | T010, T011 |
| FR-042, FR-043, FR-044, FR-045, FR-046 | T041, T045 |
| FR-047, FR-048, FR-049, FR-050 | T041, T044, T046 |
| FR-051, FR-052, FR-053 | T041, T047, T070, T071 |
| FR-060, FR-061, FR-062, FR-063, FR-064 (không ghi, không ô chọn) | T080, T082, T083, T084 |
| FR-070, FR-077 | T090, T092, T093 |
| FR-071, FR-072, FR-073, FR-074, FR-075, FR-076 | T091, T094, T095, T096 |
| FR-080, FR-081, FR-082 | T100, T101 |
| FR-100, FR-102, FR-103 | T016, T039, T049, T069, T072, T085, T096, T113 |
| FR-101 | T002, T110, T111 |
| FR-104 | test cạnh file của mọi phase (T011–T014, T030–T032, T040–T042, T060–T062, T070, T080, T090, T091, T100) |
| FR-105, FR-106 | T044, T046, T049, T115 |
| FR-107 | T003, T004, T120 |
| FR-108 | T114 |
| FR-109 | T019, T050 |
| FR-110 | T017, T018 |
| FR-111 | T002, T116 |
| FR-112 | T050, T073, T102, T123 |
| FR-113 | T006 |
| FR-114 | T121, T122 |

## Ghi chú khi làm

Lượt 1 (2026-10-17, T001, T003–T019, T030–T050; T002 hoãn):

- T002 (mốc Directus app) chưa chạy: kỳ vọng của E2E `insights-dashboard` lấy từ các dòng seed (`INSIGHTS_ROWS` trong
  `fixtures/interfaces/seed.mjs`), không từ mốc Directus; làm T002 trước khi đóng 018.
- T030/T031 gộp vào `insights/routes/overview.test.ts` (unit, happy-dom; có cả `DashboardDialog`), T040 là
  `insights/routes/dashboard.test.ts` với registry panel giả lập; T041 gộp theo nhóm `src/panels/{charts,values,
  variables}.browser.test.ts`.
- T034: không có `InsightsNotFound.vue`, `DashboardRoute` dùng `ContentNotFound module="insights"` (T015).
- T035: Directus đặt lại icon `space_dashboard` khi hộp mở (không phải `dashboard`); test theo Directus.
- T044: nạp lười nằm ở `src/panels/shared/apex-charts.ts` (`loadApexCharts`, biến `--chart-*`), không có
  `use-apex-chart.ts`; `conditional.ts` không tạo, logic định dạng có điều kiện ở từng component như Directus.
- T048: header tile (icon, tên, nút note có tooltip) nằm trong `PanelTile` (`show-header` của `BoWorkspaceTile` tắt),
  có `data-panel-header`.
- T043: `BoWorkspace` đo vùng nội dung của phần tử cha (`useElementSize` content-box, padding của cha thay cho Directus
  `--content-padding`); scale không chặn ở 1 như Directus (ở 768 px dashboard `bo_dash_all` phóng ~1,06).
- T014/T050: `query-to-gql-string` (kéo theo `json-to-graphql-query`) được import lười trong `loadPanelData` để không
  vào chunk chính (store nạp từ `hydrate`); entry 251,2 KB gzip, `apexcharts` lười 152,0 KB, registry panel 18,6 KB,
  route insights 5,2 KB.
- E2E chạy local trên dev server Vite 4218 (cấu hình `dev`, chromium-768 và chromium-1280, 20/20); ba cấu hình proxy
  chạy trên CI. E2E `settings-flows-*` không chạy local (cần dựng lại image web của env chung, ảnh hưởng 017); thay
  bằng test browser `BoWorkspace` + flows (không đổi hành vi khi không truyền `zoomToFit`) và để CI chạy ba cấu hình.

Lượt 2 (2026-10-17, T060–T073):

- T060 là `src/components/workspace/BoWorkspaceTile.browser.test.ts` (8 tay cầm, delta ô, kẹp min, R-54, nhãn W×H,
  `borderRadius`); `color`, `note` của tile nằm ở `PanelTile` (lượt 1), không ở `BoWorkspaceTile`. T063, T066 đã làm ở
  lượt 1.
- T061 gộp vào `insights/routes/dashboard.test.ts` (unit): zoom tắt khi vào sửa, Duplicate, Copy To (staging trên
  dashboard đích, Save gửi `POST /panels` với `dashboard` đích), Delete + focus, Save, R-56, Clear, guard (bỏ qua
  `/insights/<id>/*`), `meta+s` không thay đổi → 0 request. Chưa có: so body với mốc T002 (T002 hoãn), ca người không
  quyền `update` (snapshot không có role đọc dashboard mà không sửa panel).
- FR-029 lệch có lý do: Save khóa khi chưa có thay đổi (như Directus) nên không nhận focus; bấm sửa đưa focus tới "+"
  (`data-action="create"`), Save nhận focus khi đã bật. Xóa tile → nút đầu của tile trước, không có thì "+". Done ở
  drawer → nút đầu của tile vừa tạo/sửa.
- T062 là `insights/routes/panel-configuration.test.ts` (unit, registry thật): 11 loại, chọn loại, header bật mặc định
  (FR-032) và khóa field khi tắt, Done tạo ở (1,1) cỡ tối thiểu, Done sửa, đổi loại đặt lại options (FR-030), key lạ,
  Cancel. Axe của drawer chưa chạy (để T115).
- T064: thẻ lưới dùng `BoIcon size="lg"` (30 px) thay 40 px của recipe Q-37; cập nhật recipe ở T120.
- T067: không chép `configRow` của Directus (options nằm dưới lưới, không chèn giữa hàng thẻ).
- T071: Directus không xóa biến khi đổi `collection` của relational variable, nên không làm phần đó; các ca còn lại có
  test ở `stores/insights.test.ts` (`setVariable`, biến rỗng → `{}`, mặc định) và `panels/variables.browser.test.ts`
  (limit, scalar), thêm ca trang ở `dashboard.test.ts`.
- T072: bộ mẫu sai: filter `owner: { _in }` trên m2o bị GraphQL từ chối (Directus cũng vậy); sửa thành
  `owner: { id: { _in } }` trong `seed.mjs`, snapshot `panels.json` và hai panel trên env chung (PATCH qua API 8156, đã
  báo 017).
- `apps/web-e2e/src/helpers/payload.ts`: `recordWrites` thêm `dashboards`, `panels`, `notifications`.
- `bo_dash_all` trên env chung bị sửa lưới từ trình duyệt lúc 15:00; đã khôi phục từ snapshot (chủ dự án đồng ý).
- E2E local cấu hình `dev` (chromium 768/1280): `insights-*` 28/28; firefox/webkit cho `insights-edit` để CI chạy.

Lượt 3 (2026-10-17, T080–T102):

- Q-36 chốt (chủ dự án): alias biến màu Directus `--theme--primary(-subdued)`, `--blue(-25)`, `--theme--danger`,
  `--danger-25`, `--purple(-25)` sang `brand-*`, `blue-light-*`, `error-*`, `theme-purple-500` (tint 12% sáng, 15% trong
  suốt khi tối), trong `src/styles/base.css` (`theme.css` giữ nguyên bản chép).
- T080 là unit (happy-dom): `src/modules/activity.test.ts`, `activity/routes/collection.test.ts` (dựng
  `directus_activity` trong bộ nhớ từ `directus/packages/system-data` vì snapshot không có), `activity/routes/item.test.ts`.
  Chuyển hướng `/content/directus_activity(/<id>)` đã có từ 014 (`checkForSystem`), không đổi code.
- T082: mục sub-menu là `<button aria-current="true">` (lọc là `ref` cục bộ như Directus, không có URL). Module ẩn
  (Activity) không có dòng ở module bar: `AppSidebar.vue` thêm một dòng tên module (không phải link) chứa sub-menu khi
  module đang mở không có trong bar (test ở `AppSidebar.test.ts`).
- T084 lệch có lý do: action chưa dịch hiện khóa thô (Directus để trống); lỗi nạp hiện `translateAPIError`; đóng giữ
  query (FR-063); giá trị là `<dl>`.
- T090/T091 là unit: `src/layout/NotificationsBell.test.ts`, `src/components/NotificationsDrawer.test.ts`,
  `src/stores/app.test.ts`. Axe hai tab chưa chạy (để T115).
- T093–T095: nguồn của dòng thông báo là `notifications-drawer.vue:356-394` (file `notification-item.vue` của Directus là
  snackbar); tab Inbox/Archive là `BoTabs` dọc trong thân drawer (ngang dưới 1024 px; `BoTabs` thêm slot `list-append`
  cho link Activity); khóa i18n mới `notifications_unread_count` (overlay en-US, vi-VN); drawer là chunk lười 4,2 KB gzip
  (`data-notifications-drawer`); `DELETE /notifications` gửi mảng khóa (hợp đồng #203). Đếm của `useItems` được nhớ như
  Directus: sau Archive hết Inbox có thể còn dòng chọn tất cả thay vì `no_notifications` ([Inference] chưa thử, như
  Directus).
- T096: quyền tối thiểu của Directus không cho user xóa thông báo của mình (Delete trả FORBIDDEN, hộp lỗi R-57 hiện
  đúng); spec cấp thêm quyền `delete` thông báo `recipient = $CURRENT_USER` cho role tạm.
- T100: hộp lỗi của `NoticeStack` đã đủ (Dismiss duy nhất, focus, `errors.<code>`, không "Report error"); thêm test.
- Sửa sau CI lượt 2 (run 39048165868): E2E `insights-variables` tìm user trong drawer (danh sách user dài trên CI);
  `dashboard.test.ts` dùng pinia của app đang mount (ca guard lỗi một lần trên CI, không tái hiện local);
  `DashboardRoute`/`PanelConfiguration` giữ registry panel bằng `shallowRef` (component panel không bị bọc reactive).
- Q-36 chỉnh sắc theo a11y (FR-106, axe `a11y.spec.ts`): sắc -500 của nháp không đạt 4,5:1 cho chữ nhỏ trên nền trắng và
  tint (`blue-light-500` 2,8:1, `error-500` 3,8:1); alias chữ dùng `brand-600`, `blue-light-700`, `error-700`, tím trộn
  80% với `gray-900` (sáng) và `-400` / tím trộn 70% với trắng (tối). Alias này cũng tô tiêu đề nhóm "Admin Options" của
  trang user (metadata Directus `var(--theme--danger)`, trước 018 không có màu). Badge chuông `bg-error-600` (badge solid
  error của design-system), `error-500` không đủ tương phản. Cần design owner xác nhận khi duyệt Q-36 (T120).
- `BoTabs`: slot `list-append` chỉ bọc tablist khi có slot (giữ cấu trúc DOM cho `GroupTabs` và các nơi khác).
- `navigation.spec.ts` (012): tiêu đề `/activity` giờ là "Activity Feed · Backoffice" (màn thật thay khung).
- E2E local cấu hình `dev` (chromium 768/1280): `insights-*`, `activity`, `notifications`, `navigation`, `requests`,
  `content-navigation`, `login`, `a11y` xanh; `branding` đỏ ở dev vì `index.html` của Vite thêm link favicon
  `/admin/admin/favicon.ico` ([Inference] chỉ ở dev server, CI chạy bản build đã xanh).
