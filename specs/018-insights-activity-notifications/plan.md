# Implementation Plan: Insights, Activity, Notifications

**Branch**: `018-insights-activity-notifications` (trên `main`, không có branch riêng) | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-insights-activity-notifications/spec.md`

## Summary

Thay khung `/insights(/*)` và `/activity(/*)` của 012 (D-40, D-72) bằng ba phần của Directus 11.17.4: module Insights
(bảng dashboard với tìm, tạo/sửa/nhân bản/xuất/nhập/xóa; trang dashboard trên lưới 18 px với 11 panel có sẵn, zoom vừa
màn, tự làm mới, bình luận; chế độ sửa với drawer panel, kéo, đổi cỡ, nhân bản, Copy To, xóa, staging và ba request
hàng loạt `/panels` khi Save; biến dashboard), module Activity (bảng theo preset `directus_activity` với sub-menu lọc
hệ thống và drawer chi tiết) và thông báo (chuông ở header, drawer Inbox/Archive với archive/unarchive/xóa, mở item).
Tiêu chí: dashboard tạo ở Directus hiển thị đúng ở app mới (SC-002) qua E2E dùng chéo trên Directus app 8155, bộ so
payload (`POST /graphql` gộp, body ghi) và bộ so DB `directus_dashboards`, `directus_panels`, `directus_notifications`.

Cách làm:

- Chép logic từ `directus/app/src/stores/insights.ts` (thành `stores/insights.ts`), `utils/{get-groups,
  query-to-gql-string, point-on-line, format-number}.ts`, `composables/use-auto-fit-text.ts`, `panels/<id>/index.ts`
  (11 definition, registry tĩnh như operations 017), `panels/pie-chart/color-generator.ts` (viết lại trên `color` 5.0.2
  thay `chroma-js`, R1), `v-workspace-tile.vue` (resize vào `BoWorkspaceTile`), `modules/insights/*`,
  `modules/activity/*`, `views/private/components/{notifications-drawer, basic-import-sidebar-detail}.vue` với ghi
  nguồn và manifest; viết lại giao diện bằng Reka UI + theme TailAdmin theo recipe nháp Q-34..Q-39 viết trước khi code.
- Biểu đồ bằng `apexcharts` 4.7.0 (cùng bản Directus, MIT, 0 advisory, R1) gọi trực tiếp như Directus, chunk lười
  riêng; màu mặc định và bảng màu chuỗi từ token theme (D-108, Q-35); mỗi tile biểu đồ có bảng ẩn `sr-only`
  (FR-106) dùng cho cả E2E so dữ liệu (FR-105).
- Dùng lại: `BoWorkspace*` (017, mở rộng resize/zoom/màu/note/bo góc, R3), `createLayoutWrapper` + `usePreset` +
  `SearchInput` + `LayoutSidebarDetail` (014, cho Activity), `CommentsSidebarDetail`, `RefreshSidebarDetail` (đã có
  `events`/`idle`), `DrawerCollection`, `DrawerItem`, `RenderTemplate`, `ExtensionOptions` (mở rộng `type panel`),
  `BoFancySelect` (thêm `layout="grid"`), `ImportErrorDialog`, `ExportSidebarDetail` cách tải (`apiFetch` + blob, R2),
  `use-notices` (notice tại chỗ, D-66), store notifications (đếm), `getSimpleHash`/`applyOptionsData`/`adjustDate`/
  `abbreviateNumber` của `@directus/utils`, `json-to-graphql-query` (đã có), `isSystemCollection` (`get-item-route.ts`).
- Chỉ chuột cho kéo/đổi cỡ tile (Clarifications; ngoại lệ a11y như 017, tech lead duyệt); không snackbar (FR-080);
  không danh sách upload TUS (FR-076); không chép `preview.svg` (D-110).
- Test: Vitest `unit` (store insights: gộp GraphQL, biến, staging/Save 8 kịch bản; registry 11 panel so nguồn;
  `get-groups`, `query-to-gql-string`, `point-on-line`, `format-number`, `color-generator` port) + `browser` (bảng
  dashboard, trang dashboard hai chế độ với `bo_dash_all`, drawer panel, resize tile, Activity, drawer thông báo, axe,
  perf); Playwright bảy spec ở ba cấu hình; bộ so payload `insights`, `activity`, `notifications` và bộ so DB ở
  `proxy-api`; dùng chéo trên Directus app (R9). Bốn lượt commit (R11), phối hợp push với phiên 017.

Chi tiết: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/),
[quickstart.md](./quickstart.md).

## Technical Context

| Yêu cầu (prompt plan) | Ở feature 018 |
|-----------------------|---------------|
| Node 22, pnpm 10, Nx, `apps/web` Vue 3 script setup TS strict, Vite, Pinia, Vue Router | Giữ như 012–017 |
| Reka UI 2.8.2 + Tailwind CSS 4.3, theme `brand-*`, `gray-*` qua `@theme`, không hex, không palette | Giữ; màu panel/dashboard do người dùng chọn (`color` trong DB) là giá trị runtime inline (như icon collection 016, flow 017); màu mặc định của biểu đồ, meter, metric đọc từ token theme bằng `cssVar('--color-brand-500')` thay `--theme--primary` (D-108); bảng màu chuỗi sinh từ màu gốc bằng `color-generator` (R1) |
| Bố cục theo `layout-patterns.md`, component theo `component-specs.md` | Lưới dashboard trong `PrivateView fill` cuộn hai chiều; page header L-5; panel L-4 (Comments, Auto Refresh, Import); drawer panel nổi qua `RouterView` con; chuông trong header TailAdmin (`layout-patterns.md:91-94`, D-107); drawer thông báo `BoDrawer`; recipe Q-34..Q-39 trước khi code (FR-107); nhãn theo recipe 21ae3e9 |
| Settings áp lên theme như `app.vue` | Không đổi (012) |
| vue-i18n từ `directus/app/src/lang` | 73 khóa của 6 màn Directus đều có trong `en-US.json` (kiểm 2026-10-17); `panels.<id>` dùng tên khóa của Directus (`barchart`, `time_series`, `metric_list`…); không khóa overlay mới (R10) |
| `@directus/sdk` | Mọi request qua `requestEndpoint`/`apiFetch`; GraphQL qua `apiFetch('/graphql')` (như copy item 014); `fetchAll` cho store |
| Copy composable/utils, viết lại component bằng Reka UI | R2–R8; manifest `tools/port-manifest/018-T###.json`; `check-port-headers` |
| Vitest + VTU; Playwright E2E với Directus thật và API mới | `contracts/tests.md`; dùng chéo điều khiển Directus app bằng `helpers/directus-app.ts` (R9) |
| GitHub Actions, coverage FE 60% | Job `quality`, `e2e-web` (ma trận ba cấu hình) như 017; `check-bundle` `BUDGET_018`, `LAZY_BUDGETS_018` |
| Phần riêng 018 (prompt) | Port đúng danh sách file nêu trong prompt (R2–R8); store insights với truy vấn GraphQL gộp (R4); `BoWorkspace*` mở rộng không đổi flows (R3, test 017 giữ xanh); `apexcharts` 4.7.0 đã kiểm MIT và 0 advisory (R1); notice tại chỗ (FR-080); làm trên `main`, nhắn phiên 017 trước và sau mỗi push |

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23.3; trình duyệt như 012.

**Primary Dependencies**: đã có (012–017): vue 3.5, pinia 3, vue-router 4, vue-i18n 11, reka-ui 2.8.2, tailwindcss
4.3, @directus/sdk 21.3.0, @directus/types 15.0.3, @directus/utils 13.4.1 (`applyOptionsData`, `getSimpleHash`,
`adjustDate`, `abbreviateNumber`, `getFieldsFromTemplate`), json-to-graphql-query, color 5.0.2, @vueuse/core 14,
lodash-es, nanoid, escape-string-regexp (kiểm ở T001, không có thì dùng `lodash-es/escapeRegExp`), date-fns,
file-saver, marked + dompurify (`md()`). Thêm: `apexcharts` 4.7.0 (catalog, cùng bản Directus; MIT; GitHub advisory
chỉ có GHSA-w46j-8hm6-h8mm < 3.24.0, không ảnh hưởng; R1). Không thêm `chroma-js` (R1), không `@directus/extensions`
(`definePanel` = identity chép inline như `defineOperationApp` 017), không `@directus/system-data`
(`isSystemCollection` đã có).

**Storage**: không DB; Pinia store insights mới (port, R4) nạp ở hydrate khi có quyền đọc `directus_dashboards` và
`directus_panels`; store notifications (012) không đổi (drawer nạp danh sách cục bộ như Directus); store app thêm
`notificationsDrawerOpen`; staging panel trong store như Directus; biến dashboard trong store, không lưu;
`refreshIntervals` object thường; không localStorage mới; bộ mẫu `apps/web/fixtures/interfaces/snapshot/` thêm
`dashboards.json`, `panels.json`, `notifications.json`, `items.bo_insights_data.json`, `activity.json` (mẫu cho mock);
collection mẫu `bo_insights_data` do seed tạo (dữ liệu cố định, không E2E nào ghi).

**Testing**: Vitest `unit` + `browser` (chromium) trong `apps/web`, coverage ≥ 60 % gộp; axe; Playwright `apps/web-e2e`
bảy spec `insights-*`, `activity`, `notifications` ở `proxy-directus`, `proxy-api`, `cors`; payload ba spec và bộ so
DB ở `proxy-api`; dùng chéo (SC-002) ở `proxy-api` (`DIRECTUS_APP_SPECS`); parity `web` `fixtures-seed.test.ts` mở
rộng seed.

**Target Platform**: như 012 (image nginx tĩnh, cùng hoặc khác origin).

**Project Type**: Monorepo web. Chạm `apps/web` (src, fixtures, scripts, package.json), `pnpm-workspace.yaml`
(catalog `apexcharts`), `apps/web-e2e`, `design-system/docs` (recipe Q-34..Q-39), `design-system/qa/handoff-checklist.md`
(ngoại lệ a11y lưới dashboard), `tools/port-manifest`, spec 012 (D-40, D-45), 013 (D-66 giữ), 014 (D-72), 015 (D-90),
`SPECKIT-GUIDE.md`, `CLAUDE.md` (Active Technologies).

**Performance Goals**: FR-108 / SC-007 (`bo_dash_all` 11 tile < 1500 ms; đổi biến < 500 ms sau response; drawer
thông báo 25 dòng < 300 ms; số request: mở `/insights` 0, mở dashboard 1 `POST /graphql` (+1 `/graphql/system`), mở
drawer thông báo 1 danh sách); bundle chính ≤ `BUDGET_017` + 15 KB gzip; chunk lười: module Insights (route, store,
workspace mở rộng, drawer panel) ≤ 60 KB, registry + 11 component panel ≤ 40 KB, `apexcharts` ≤ 170 KB, drawer thông
báo ≤ 15 KB (R12).

**Constraints**:
- Chỉ API Directus ở `contracts/api-calls.md` (#185–#203 nối 017); 0 request ra ngoài (FR-110).
- Không sửa `directus/`; file chép ghi `// Ported from directus/app/src/...`; không sửa `apps/api` (kiểm xong: batch
  PATCH/DELETE, export, import, GraphQL aggregate/group đã có; FR-111).
- Không hex, không palette ngoài theme trong class; màu dashboard/panel từ DB inline; màu mặc định qua `cssVar`.
- Không chọn ngầm giao diện: recipe nháp Q-34..Q-39 trước (FR-107); design owner duyệt trước khi đóng (SC-008).
- Kéo/đổi cỡ tile chỉ chuột như Directus (Clarifications): ngoại lệ a11y ghi trong `handoff-checklist.md`, tech lead
  duyệt (cùng mục với canvas 017).
- Không extension (registry tĩnh, type lạ chỉ hiển thị header), WebSocket, email, snackbar (FR-080), danh sách upload
  (FR-076), `preview.svg` (D-110).
- Mở rộng component của 013–017 chỉ bằng prop thêm (`BoWorkspaceTile resizable/minWidth/...`, `ExtensionOptions type
  panel`, `BoFancySelect layout`, `ContentNotFound module 'insights'|'activity'`); test cũ giữ xanh.
- Quirk của Directus trong panel (`<=` xử lý như `<`; `contains` của bar-chart so ngược; resize top/left trôi khi
  chạm cỡ tối thiểu) chép nguyên để giống Directus, ghi R-53, R-54 "Cần xác nhận" (R5).
- Checkout dùng chung với phiên 017: chỉ stage đường dẫn của 018; nhắn trước và sau mỗi push; không stash/reset.

**Scale/Scope**: 3 module/phần (Insights: 3 route SFC + ≈ 8 component + store + 11 panel component + 11 definition +
5 utils port; Activity: 2 route SFC + sub-menu; Notifications: chuông + drawer + `BasicImportSidebarDetail`) ≈ 45 file
nguồn mới, ước lượng 5.000 dòng mới (≈ 2.200 chép), ≈ 35 file test, 7 spec E2E, 3 payload spec, bộ so DB mở rộng.
`tasks.md` chia bốn lượt (R11).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` 2.0.0. Lần 1 (trước research) và lần 2 (sau design): một vi phạm có lý do
(XII, kéo/đổi cỡ tile chỉ chuột), ghi ở Complexity Tracking và chờ tech lead duyệt theo Governance; còn lại PASS.

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`; file chép ghi nguồn, manifest `018-T###.json`,
  `check-port-headers`; script trích registry chỉ đọc `directus/app/src/panels`.
- [x] **II. Dùng chung DB**: PASS. Ghi chỉ qua `/dashboards`, `/panels`, `/notifications`, `/utils/import` (010);
  body và thứ tự request chép từ Directus (SC-005) để `directus_dashboards`, `directus_panels`,
  `directus_notifications` ghi ra bằng Directus (SC-002).
- [x] **III. API giống hệt**: PASS. Không endpoint mới; cùng query, body và tài liệu GraphQL gộp
  (`contracts/api-calls.md`).
- [x] **IV. Chạy song song an toàn**: PASS. Không state server; staging và biến chỉ trong trình duyệt; store nạp lại
  sau ghi.
- [x] **V. Kiểm thử đối chiếu**: PASS. Không endpoint mới; đối chiếu ở mức màn: E2E ba cấu hình, bộ so payload (kể cả
  tài liệu GraphQL), bộ so DB, dùng chéo trên Directus app (SC-002..SC-005); parity 010/011 đã có cho
  dashboards/panels/notifications/graphql aggregate.
- [x] **VI. Kiến trúc**: PASS. Vue 3 Composition API, Reka UI; route, luồng theo Directus app; 768 px+; `vi-VN`/`en-US`.
- [x] **VII. Đa instance**: PASS. Build tĩnh; không state server.
- [x] **VIII. Biến môi trường**: PASS. Không biến mới.
- [x] **IX. Đổi thương hiệu**: PASS. D-109 bỏ nút "Report error" (link GitHub Directus); khóa i18n Directus giữ; dữ
  liệu DB không đổi.
- [x] **X. Chất lượng**: PASS. Coverage 60 %, lint, typecheck, browser test, E2E, build image; `pnpm audit` với
  `apexcharts` (0 advisory, R1); D-107..D-110, R-49..R-57 trong spec, tech lead duyệt trước khi đóng (SC-010).
- [x] **XI. Ngoài phạm vi**: PASS. Không extension (registry tĩnh, type lạ chỉ hiển thị), AI, WebSocket (thông báo
  không realtime, R-52).
- [x] **XII. Design-system**: VIOLATION có lý do (chờ tech lead duyệt). Đã đọc `README.md`, `component-specs.md`,
  `layout-patterns.md`, `handoff-checklist.md`; theme qua `@theme`; không hex trong class; Q-34..Q-39 ghi ở spec, recipe
  nháp trước khi code, design owner duyệt trước khi đóng. Vi phạm: XII yêu cầu component dùng được bằng bàn phím, kéo
  tile và 8 tay cầm đổi cỡ chỉ bằng chuột (owner chọn A, Clarifications 2026-10-17); ghi ở Complexity Tracking và
  `design-system/qa/handoff-checklist.md` (cùng mục với canvas 017), tech lead duyệt trước khi đóng; chưa duyệt lúc
  đóng thì feature không đóng được. Biểu đồ vẽ bằng `apexcharts` (CSS của thư viện không thuộc theme): màu, font truyền
  qua options từ token (Q-35), CSS mặc định của apexcharts chỉ cho tooltip/legend và được ghi đè bằng token trong recipe;
  design owner duyệt.

## Project Structure

### Documentation (this feature)

```text
specs/018-insights-activity-notifications/
├── plan.md
├── research.md           # R1–R12 + bảng kiểm
├── data-model.md         # route, store, dashboard/panel, panel definition, staging, GraphQL gộp, activity, notification, bộ mẫu
├── quickstart.md
├── contracts/
│   ├── api-calls.md      # #185–#203, danh sách đóng cho E2E
│   ├── components.md     # component, composable, registry, E2E helpers
│   └── tests.md          # unit/browser, API giả lập, E2E, payload, bộ so DB, dùng chéo, perf, CI
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
pnpm-workspace.yaml                                        # catalog: apexcharts 4.7.0 (nhóm 013 "same versions as directus")
apps/web/
├── package.json                                           # + apexcharts
├── fixtures/interfaces/{seed.mjs (+createInsightsFixtures, +notifications), lib.mjs (+DASHBOARDS), export.mjs (+4 file), snapshot/{dashboards,panels,notifications,activity}.json, directus-registry.json (+panels)}
├── scripts/{extract-directus-registry.mjs (+PANEL_IDS), check-bundle.mjs (BUDGET_018, LAZY_BUDGETS_018)}
├── src/
│   ├── modules/{insights.ts, activity.ts}                  # route thật (D-40, D-72 gỡ)
│   ├── modules/insights/
│   │   ├── routes/{InsightsOverviewRoute,DashboardRoute,PanelConfiguration,InsightsNotFound}.vue
│   │   ├── components/{InsightsNavigation,DashboardDialog,CopyPanelDialog,PanelTile}.vue
│   │   └── perf.browser.test.ts
│   ├── modules/activity/
│   │   ├── routes/{ActivityCollectionRoute,ActivityItemRoute}.vue
│   │   └── components/ActivityNavigation.vue
│   ├── panels/{index.ts, registry.test.ts, types.ts}       # registry tĩnh 11 panel (definePanel identity)
│   ├── panels/<id>/{index.ts, Panel<Id>.vue}  ×11           # bar-chart, label, line-chart, list, meter, metric, metric-list, pie-chart, relational-variable, time-series, variable
│   ├── panels/shared/{ChartTable.vue (bảng sr-only FR-106), use-apex-chart.ts (nạp lười apexcharts), color-generator.ts, conditional.ts}
│   ├── panels/relational-variable/use-display-items.ts
│   ├── stores/insights.ts (+ .test.ts)                     # port stores/insights.ts
│   ├── stores/app.ts (+notificationsDrawerOpen), stores/notifications.ts (comment)
│   ├── hydrate.ts (+insights)
│   ├── utils/{get-groups,query-to-gql-string,point-on-line,format-number}.ts (+ .test.ts)
│   ├── composables/use-auto-fit-text.ts
│   ├── components/workspace/{BoWorkspace,BoWorkspaceTile}.vue  # + resize, zoomToFit, color, note, borderRadius, minWidth/minHeight, data-width/height
│   ├── components/{BoFancySelect.vue (+layout grid), NotificationsDrawer.vue, NotificationItem.vue}
│   ├── components/sidebar/BasicImportSidebarDetail.vue
│   ├── styles/apexcharts.css                               # ghi đè CSS của apexcharts bằng biến theme (release-gate CHK043)
│   ├── layout/AppHeader.vue (+NotificationsBell.vue), layout/PrivateView.vue (+NotificationsDrawer)
│   ├── modules/settings/routes/data-model/field-detail/shared/ExtensionOptions.vue   # + type 'panel'
│   ├── modules/content/routes/ContentNotFound.vue          # + module 'insights' | 'activity'
│   ├── test-utils/{fetch.ts (KNOWN_REQUESTS #185–#203, ENDPOINTS +4), fixtures.ts (Snapshot +4)}
│   └── utils/get-item-route.ts                            # comment
apps/web-e2e/src/
├── {insights-overview,insights-dashboard,insights-edit,insights-variables,insights-cross-use,activity,notifications}.spec.ts
├── insights-parity-ui.spec.ts, a11y.spec.ts (+018)
├── payload/{insights,activity,notifications}.spec.ts, payload/baselines/insights-*.json
└── helpers/{allowed-paths.ts (+#185..#203), payload.ts (+PATHS, normalizeGraphql), db-rows.ts (+INSIGHTS_TABLES, NOTIFICATIONS_TABLES), directus-app.ts (+insights, +notifications), insights.ts (lưới, resize, đọc bảng sr-only), fixtures.ts (+DASHBOARDS)}
apps/web-e2e/playwright.config.ts                          # core specs + insights-edit; DIRECTUS_APP_SPECS + insights-cross-use, insights-parity-ui
design-system/docs/{component-specs.md (Tier 3 (018): Q-34, Q-36, Q-37, Q-38, Q-39), layout-patterns.md (lưới dashboard Q-34, biểu đồ Q-35)}
design-system/qa/handoff-checklist.md                      # ngoại lệ a11y lưới dashboard
tools/port-manifest/018-T###.json
specs/012-*/spec.md (D-40, D-45), 013 (D-66), 014 (D-72), 015 (D-90)   # ghi trạng thái ở 018
SPECKIT-GUIDE.md, CLAUDE.md
```

**Structure Decision**: `modules/insights/` và `modules/activity/` giữ cấu trúc Directus (`routes/`, `components/`);
`panels/` ở gốc `src` như Directus (`app/src/panels`) cạnh `interfaces/`, `displays/`, `operations/`; store insights
là Pinia store như Directus (staging sống trong store vì `stagePanelDuplicate` với `dashboard` khác cần dùng chung
giữa dashboard); `BoWorkspace*` mở rộng tại chỗ (017 đã đặt ở `components/workspace/` cho mục đích này); drawer thông
báo và chuông ở `components/` + `layout/` vì thuộc khung app; `BasicImportSidebarDetail` ở `components/sidebar/` cạnh
các mục panel 014.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Vi phạm XII (chờ tech lead duyệt). Ngoại lệ a11y: kéo tile và 8 tay cầm đổi cỡ chỉ bằng chuột/pointer, cảm ứng không bảo đảm (XII yêu cầu bàn phím); vẫn tới được bằng phím: nút sửa, "+", Save, Clear Changes, pencil, menu tile, drawer panel, zoom (spec FR-027, FR-106) | Owner chọn A (Clarifications 2026-10-17): giữ y Directus và nhất quán với canvas 017 | Field vị trí/cỡ trong drawer panel hoặc phím mũi tên (B, C): thêm UI không có ở Directus, lệch parity UI; owner từ chối. Ghi ngoại lệ trong `handoff-checklist.md`, tech lead duyệt (SC-008) |
| Thư viện `apexcharts` (CSS riêng ngoài theme TailAdmin) | Directus vẽ 4 loại biểu đồ bằng apexcharts; cùng thư viện cho cùng cách nhóm, trục, chú giải (FR-105); TailAdmin cũng dùng ApexCharts (`theme.css:12` ghi CSS bên thứ ba bỏ ra) | Vẽ SVG tay: 4 loại biểu đồ với tooltip, legend, datetime axis là một thư viện mới tự viết; thư viện khác (`chart.js`, `echarts`): dữ liệu và cách nhóm khác Directus, khó so |
| `color-generator` viết lại trên `color` thay chép nguyên với `chroma-js` | Không thêm gói; `color` 5.0.2 (013) có `lab()`; màu chuỗi không được so với Directus (FR-105, D-108) nên sai lệch làm tròn Lab không ảnh hưởng parity | Thêm `chroma-js` 3.1.2 + `@types/chroma-js`: một gói nữa cho một hàm 30 dòng |
| Registry panel tĩnh + script trích (thay `import.meta.glob` và import `@directus/extensions`) | Như 013/017: không extension, bundle đoán được, test so nguồn không import mã Directus | `import.meta.glob`: không có lợi khi danh sách cố định |

## Phase 0, 1: kết quả

- research.md: R1 đến R12; bảng kiểm 2026-10-17 (đọc mã nguồn, ba báo cáo agent và kiểm trực tiếp): `apexcharts`
  4.7.0 MIT 0 advisory; `applyOptionsData`, `getSimpleHash` có trong `@directus/utils` 13.4.1; `json-to-graphql-query`,
  `color`, `file-saver`, `fetchAll`, `isSystemCollection`, `RefreshSidebarDetail` (với `events`/`idle`),
  `DrawerCollection`, `DrawerItem`, `use-edits-guard`, `createLayoutWrapper` đã có; `KNOWN_REQUESTS`/allowlist id cuối
  182 (017 còn #183–#184 chưa thêm) → 018 bắt đầu #185; `BUDGET_017`, `LAZY_BUDGETS_017`; `ENDPOINTS` và `PATHS`
  của payload chưa có dashboards/panels/activity/notifications (mở rộng ở T0xx); API `dashboards`/`panels`/
  `notifications` nhận batch PATCH/DELETE, `?export=json`, `/utils/import`, GraphQL aggregate/group có. T002 (lượt 1):
  chạy tay trên Directus app 8155 (tạo dashboard, thêm 2 panel + Save, resize, Copy To, Archive thông báo, nhập JSON)
  và lưu body làm mốc (`payload/baselines/insights-*.json`) trước khi viết bộ so payload; ghi tài liệu GraphQL gộp
  của `bo_dash_all` làm mốc cho test store.
- Sửa spec theo research (2026-10-17): FR-026 Copy To là staging (`stagePanelDuplicate` với `dashboard` đích), không
  `POST /panels` ngay; FR-045 `linkToItem` mở `DrawerItem` (sửa tại chỗ, `PATCH` rồi `refresh`) chứ không điều hướng;
  FR-013 xuất tải bằng `apiFetch` + blob như `ExportSidebarDetail`; FR-006 hydrate dùng `fetchAll` với `sort`; R-53,
  R-54 thêm.
- Release-gate (`checklists/release-gate.md` CHK001–CHK055, 2026-10-17): owner áp toàn bộ lời giải
  (`release-gate-proposals.md`): R-56 (Save lỗi một phần), R-57 (drawer thông báo bắt lỗi), sáu mục "Cần xác nhận";
  collection mẫu `bo_insights_data` và user `bo-insights-user` (số liệu ổn định); E2E thông báo trên user tạm; quy tắc
  so bảng sr-only; `apexcharts.css`; ma trận project E2E thống nhất; danh sách khóa vi-VN thiếu (R10).
- `/speckit.analyze` (2026-10-17) và sửa: biến dashboard dùng chung theo `field` cho mọi dashboard như Directus (R-55;
  Key Entities, US4, data-model §2, §6); bộ mẫu dùng tên biến riêng `all_*`, `vars_*`; màu nhãn action là biến CSS
  Directus chưa có trong web → Q-36 mở, không tự chọn (FR-062, T004, T082); T002 ghi thêm luồng sửa options, nhân bản +
  xóa, Save rỗng, request mở drawer thông báo và chạy sau T016; FR-108 đo được (16 ms mỗi move, mốc thời gian rõ).
- data-model.md: route, store, Dashboard/Panel, panel definition, staging, body Save, tài liệu GraphQL gộp, biến,
  Activity, Notification, bộ mẫu.
- contracts/: `api-calls.md` (#185–#203), `components.md`, `tests.md`.
- quickstart.md: cài, seed, trích registry, test, E2E ba cấu hình, payload, bộ so DB, dùng chéo, lint, build, đóng.
- Agent context: `CLAUDE.md` cập nhật bằng `update-agent-context.sh claude` khi plan xong (dòng 018 soạn ở quickstart
  §Đóng).
