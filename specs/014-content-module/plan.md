# Implementation Plan: Module Content (duyệt và chỉnh sửa dữ liệu như Directus)

**Branch**: `014-content-module` (trên `main`, không có branch riêng) | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-content-module/spec.md`

## Summary

Thay khung module Content của 012 bằng các màn thật: cây collection trong sub-menu sidebar, màn collection với năm
layout (tabular, cards, calendar, kanban, map) và preset/bookmark dùng chung với Directus, tìm kiếm và bộ lọc nâng cao
(`system-filter`), màn item dùng `BoForm` của 013 với lưu, bản sao, xóa, archive, hỏi thay đổi chưa lưu, menu version
và hộp so sánh (gỡ D-55), panel chi tiết với Revisions, Comments, Shares, Flows, live preview không visual editing
(Q1 = A), xuất nhập, thao tác hàng loạt, drawer chọn item theo layout của preset (gỡ D-58), trang item của share. Kiểm
bằng E2E ba cấu hình trên bộ mẫu `bo_*` của 013 (seed mở rộng), so payload ghi với Directus app, và benchmark màn trên
collection 10 triệu dòng.

Cách làm:

- Chép logic từ `directus/app/src` (route, composable `use-preset`, `use-item`, `use-versions`, `use-revisions`,
  `use-edits-guard`, `use-permissions`, `use-comparison`, setup của năm layout, `system-filter`, sidebar detail,
  export/import, live preview) với ghi nguồn; viết lại giao diện bằng Reka UI + theme TailAdmin theo recipe nháp Q-1
  đến Q-12 viết vào `design-system/docs/` trước khi code (R2, R10).
- Thư viện cùng bản Directus 11.17.4 ở chỗ quyết định hành vi hoặc dữ liệu: FullCalendar 6.1.19, `@json2csv/plainjs`
  7.0.6, `file-saver` 2.0.5, `@directus/vue-split-panel` 0.8.9, `json-to-graphql-query` 2.3.0; map,
  kéo thả, cuộn ảo đã có từ 013 (R1).
- Test: Vitest `unit` + `browser` như 013 với API giả lập mở rộng; E2E Playwright `apps/web-e2e` ở ba cấu hình của
  012; bộ so payload chạy cùng kịch bản trên Directus app (profile `app`) và app mới (proxy-api) trong cùng test;
  benchmark màn trong workflow hằng tuần (R12, R14).
- Bốn lượt commit theo story (Clarifications Q3, FR-127): lượt 1 US1–US3, lượt 2 US4, lượt 3 US5, lượt 4 US6–US7.

Chi tiết: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/),
[quickstart.md](./quickstart.md).

## Technical Context

| Yêu cầu (prompt plan) | Ở feature 014 |
|-----------------------|---------------|
| Node 22, pnpm 10, Nx, `apps/web` Vue 3 script setup TS strict, Vite, Pinia, Vue Router | Giữ như 012, 013 |
| Reka UI 2.8.2 + Tailwind CSS 4.3, theme `brand-*`, `gray-*` qua `@theme`, không hex, không palette | Giữ; màu dữ liệu (icon/màu collection, bookmark, nhóm kanban, chip tag) inline style như Q-C của 013; FullCalendar và MapLibre nhận token qua CSS đè (R4) |
| Bố cục theo `layout-patterns.md`, component theo `component-specs.md` | Cây collection trong sub-menu L-3 (Q2); page header L-5, panel L-4; recipe nháp Q-1 đến Q-12 trước khi code (R10) |
| Settings áp lên theme như `app.vue` | Không đổi (012) |
| vue-i18n từ `directus/app/src/lang` | Khóa `layouts.*`, `item_count`, `revisions`, `comments`, `shares`, `unsaved_changes`... đã sinh ở 012 (kiểm T00x); thiếu thì chạy lại script sync (R13) |
| `@directus/sdk` | Mọi request qua sdk (`requestEndpoint`, `apiFetch` cho blob và multipart); `SEARCH` cho query dài như `use-item` (R7) |
| Copy composable/utils, viết lại component bằng Reka UI | R2 đến R11; manifest `tools/port-manifest/014-T*.json` |
| Vitest + VTU; Playwright E2E với Directus thật và API mới | Vitest `unit` + `browser`; E2E `apps/web-e2e` ba cấu hình + bộ so payload (R12) |
| GitHub Actions, coverage FE 60% | Job `quality` (unit + browser), `e2e-web` (ba cấu hình + payload), `benchmark.yml` thêm job web (R14) |

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23.3; trình duyệt như 012.

**Primary Dependencies**: đã có (012, 013): vue 3.5, pinia 3, vue-router 4, vue-i18n 11, reka-ui 2.8.2, tailwindcss
4.3, @directus/sdk 21.3.0, @directus/utils 13.4.1 (`mergeFilters`, `getFilterOperatorsForType`, `getEndpoint`,
`moveInArray`, `getFieldsFromTemplate`, `getRelationType`), @vueuse/core 14, lodash-es, date-fns 4.1, dompurify,
maplibre-gl 6.14.0 + @mapbox/mapbox-gl-draw 1.5.1 + @mapbox/mapbox-gl-geocoder 5.1.2, vuedraggable 4.1.0,
vue-virtual-scroller 2.0.0-beta.8, @sindresorhus/slugify 2.2.1, micromustache 8.0.3, mitt, p-queue. Thêm (R1):
@fullcalendar/{core,daygrid,timegrid,list,interaction} 6.1.19, @json2csv/plainjs 7.0.6, file-saver 2.0.5 (+ types),
@directus/vue-split-panel 0.8.9, json-to-graphql-query 2.3.0 (bản catalog Directus; giấy phép và ESM kiểm T002).

**Storage**: không DB; Pinia (store `presets` mở rộng, `app.basemap`, `sidebar.activeAccordionItem`); localStorage
`backoffice-last-accessed-collection`, `backoffice-live-preview-{mode,size,full-width}` (D-39); bộ mẫu
`apps/web/fixtures/interfaces/snapshot/` mở rộng (presets, versions, shares, flow manual).

**Testing**: Vitest project `unit` (happy-dom) và `browser` (chromium) trong `apps/web`, coverage ≥ 60% gộp; axe trong
browser test; Playwright `apps/web-e2e` (spec `content-*.spec.ts`) ở `proxy-directus`, `proxy-api`, `cors`; bộ so
payload `apps/web-e2e/src/payload/*.spec.ts` chỉ ở `proxy-api` (Directus app ở 8155 cùng DB); `tests/parity` profile
`web` giữ `fixtures-seed.test.ts`; `tests/benchmark` thêm `web-content.ts` (Playwright, 10 triệu dòng của 005).

**Target Platform**: như 012 (image nginx tĩnh, cùng hoặc khác origin).

**Project Type**: Monorepo web. Chạm `apps/web` (src, fixtures, vite config, project.json, scripts/check-bundle.mjs),
`apps/web-e2e` (spec, helpers), `design-system/docs` (recipe nháp), `tests/parity/docker-compose.yml` (không đổi nếu
profile `web` đủ), `tests/benchmark` (compose thêm web, `src/web-content.ts`), `.github/workflows/{ci,benchmark}.yml`,
`pnpm-workspace.yaml` (catalog), `tools/port-manifest`, spec 012 (D-40, D-45 phần Content), spec 013 (D-55, D-58 "đã gỡ").

**Performance Goals**: SC-003 (trang đầu 10 triệu dòng < 2 s p95 không tính đếm; đổi trang, sắp xếp < 1,5 s p95; một
request danh sách mỗi thao tác), SC-011 (bảng 1000 × 10 < 2 s, browser test `PERF=1`); bundle chính giữ ngân sách
013 (205,8 KB gzip + ≤ 60 KB cho route, layout tabular, bộ lọc, sidebar); calendar, map, split panel, kanban tách
chunk lười (R14).

**Constraints**:
- Chỉ API Directus ở `contracts/api-calls.md` (#50 trở đi nối 013); request ra ngoài là danh sách đóng FR-112.
- Bắt đầu implement chỉ khi phiên 013 báo CI xanh của commit cuối: **đã đạt 2026-10-15** (run 38685401583 trên
  5751122); `apps/web` thuộc 014 từ đó.
- Không sửa `directus/`; file chép ghi `// Ported from directus/app/src/...`; không ghi `directus_fields`,
  `directus_relations`, `directus_collections`.
- Không hex, không palette ngoài theme trong class; màu dữ liệu chỉ inline style từ giá trị runtime.
- Không chọn ngầm giao diện: recipe nháp Q-1 đến Q-12 ghi vào `design-system/docs/` trước (FR-110); design owner duyệt
  trước khi đóng (SC-009).
- Không AI, collab, visual editing, extension (D-67, D-68, D-70); mọi kéo thả có đường bàn phím (D-69).
- Mở rộng component `Bo*` của 012/013 chỉ bằng prop tùy chọn; test của 012/013 giữ xanh.

**Scale/Scope**: 5 route + 4 component điều hướng; 5 layout (mỗi layout `index.ts` + 3 slot + component chính, ≈ 22
SFC); composable chép 12 (`use-preset`, `use-layout`, `use-item`, `use-versions`, `use-revisions`, `use-revision`,
`use-edits-guard`, `use-navigation-guard`, `use-permissions/*`, `use-comparison`, `use-navigation`, `use-flows` mở
rộng); bộ lọc 5 SFC + `FieldList`; màn item 1 + menu version 2 + so sánh 4 + lưu tùy chọn 1; sidebar 12 SFC (detail,
revisions 3, comments 4, shares 2, flows 1, layout, archive, refresh, export/import 2); live preview 2; utils chép ≈
10 (`format-items-count`, `save-as-csv`, `geometry/controls`, `get-fullcalendar-locale`, `field-utils`, comparison
normalizers...; route dùng `get-item-route.ts` đã có từ 013). Ước lượng 11.000 dòng mới (≈ 5.000 chép), ≈ 60 file test,
13 spec E2E, bộ so payload 5 file, 1 benchmark. `tasks.md` chia bốn lượt (FR-127): 1 = thư viện, recipe nháp, route, cây,
preset, tabular, bộ lọc, màn item, E2E US1–US3; 2 = cards, calendar, kanban, map, drawer theo layout, E2E US4; 3 =
sidebar, version, so sánh, live preview, share item, E2E US5; 4 = export/import, hàng loạt, archive, refresh, payload
suite, benchmark, a11y, perf, đóng.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` 2.0.0. Lần 1 (trước research) và lần 2 (sau design) không vi phạm.

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`; file chép ghi nguồn, manifest `014-T*.json`, guard
  `check-port-headers`; seed mở rộng chỉ gọi API.
- [x] **II. Dùng chung DB**: PASS. App web chỉ ghi qua API Directus (`/items`, `/presets`, `/versions`, `/comments`,
  `/shares`, `/utils/*`); dạng ghi preset (`layout_query`, `layout_options`, `filter`) chép từ `use-preset.ts` để
  Directus đọc được (SC-004).
- [x] **III. API giống hệt**: PASS. Không endpoint mới; cùng query như Directus app (`contracts/api-calls.md`);
  khác biệt dạng query (JSON thay ngoặc) đã chấp nhận ở 013 (#35).
- [x] **IV. Chạy song song an toàn**: PASS. Không state server; localStorage chỉ tiền tố `backoffice-`.
- [x] **V. Kiểm thử đối chiếu**: PASS. Không endpoint mới ở API; đối chiếu ở mức hành vi màn: E2E ba cấu hình
  (Directus thật, API mới) và bộ so payload ghi với Directus app trên cùng DB (SC-004); seed đối chiếu ở `tests/parity`
  giữ (013).
- [x] **VI. Kiến trúc**: PASS. Vue 3 Composition API, Reka UI; luồng, route, quyền theo Directus app; 768 px+;
  `vi-VN`/`en-US`; mỗi thay đổi có test.
- [x] **VII. Đa instance**: PASS. Build tĩnh.
- [x] **VIII. Biến môi trường**: PASS. Không biến mới (web đọc `PUBLIC_URL` như 012).
- [x] **IX. Đổi thương hiệu**: PASS. D-39 cho localStorage; path share `/admin/shared/<id>`, id layout, khóa preset giữ
  nguyên (định danh tương thích).
- [x] **X. Chất lượng**: PASS. Coverage 60%, lint, typecheck, browser test, E2E, build image trong CI; benchmark màn ở
  workflow hằng tuần (SC-003); không email (share invite chỉ gọi API, API ghi log D-36); D-67 đến D-73 trong spec, tech
  lead đã duyệt D-69, D-73 (Q5).
- [x] **XI. Ngoài phạm vi**: PASS. Live preview không phải visual editing (owner chọn Q1 = A); bỏ `use-ai-tools`
  (D-70), collab (D-68), extension layout (chỉ 5 layout nội bộ).
- [x] **XII. Design-system**: PASS. Đã đọc `README.md`, `component-specs.md`, `layout-patterns.md`,
  `handoff-checklist.md`; theme qua `@theme`; không hex trong class; Q-1 đến Q-12 ghi ở spec, recipe nháp trước khi
  code, design owner duyệt trước khi đóng; branding không đổi.

## Project Structure

### Documentation (this feature)

```text
specs/014-content-module/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-calls.md      # request mà module gửi (#50 trở đi), danh sách đóng cho E2E
│   ├── layouts.md        # contract LayoutConfig, props/state của wrapper, option và query mỗi layout
│   └── tests.md          # unit/browser, API giả lập, E2E ba cấu hình, bộ so payload, benchmark, CI
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── fixtures/interfaces/
│   ├── seed.mjs                    # mở rộng: bo_std versioning + archive, preset role/global, bookmark, share, flow location
│   ├── export.mjs                  # thêm presets.json, versions.json, shares.json, flows.json (manual)
│   └── snapshot/                   # thêm file trên
├── src/
│   ├── modules/content.ts          # route thật (thay placeholderRoutes), guard checkForSystem, getArchiveValue
│   ├── modules/content/
│   │   ├── routes/{CollectionOrItem,CollectionRoute,ItemRoute,NoCollections,ContentNotFound,PreviewRoute}.vue
│   │   ├── components/{ContentNavigation,NavigationItem,NavigationItemContent,NavigationBookmark,BookmarkAdd,VersionMenu,VersionPromoteField}.vue
│   │   └── composables/use-navigation.ts
│   ├── layouts/
│   │   ├── index.ts                # glob eager, getLayout(id), fallback tabular
│   │   ├── types.ts                # LayoutConfig, LayoutProps, LayoutState (contracts/layouts.md)
│   │   ├── use-layout.ts           # port @directus/composables use-layout (wrapper + layoutState)
│   │   ├── tabular/{index.ts,types.ts,Tabular.vue,TabularOptions.vue,TabularActions.vue}
│   │   ├── cards/{index.ts,types.ts,Cards.vue,CardsOptions.vue,CardsActions.vue,components/{Card,CardsHeader}.vue}
│   │   ├── calendar/{index.ts,types.ts,Calendar.vue,CalendarOptions.vue,CalendarActions.vue}
│   │   ├── kanban/{index.ts,types.ts,Kanban.vue,KanbanOptions.vue,KanbanActions.vue}
│   │   └── map/{index.ts,types.ts,MapLayout.vue,MapOptions.vue,MapActions.vue,components/MapView.vue,style.ts}
│   ├── interfaces/_system/
│   │   ├── system-filter/{index.ts,SystemFilter.vue,Nodes.vue,InputGroup.vue,InputComponent.vue,utils.ts}
│   │   └── system-input-translated-string/{index.ts,InputTranslatedString.vue}
│   ├── components/
│   │   ├── FieldList.vue           # port v-field-list (cây field, quan hệ, hàm), dùng cho bộ lọc, thêm cột, export
│   │   ├── BoTable.vue             # mở rộng bằng prop: fixedHeader, showManualSort, manualSortKey, rowHeight, header menu slot, kéo cột
│   │   ├── BoPagination.vue        # mới (recipe Q-2)
│   │   ├── SearchInput.vue         # port search-input (ô tìm + nút bộ lọc + số điều kiện)
│   │   ├── SplitPanel.vue          # bọc @directus/vue-split-panel (R11) hoặc dự phòng
│   │   ├── sidebar/{SidebarDetail,LayoutSidebarDetail,ArchiveSidebarDetail,RefreshSidebarDetail,ExportSidebarDetail,ImportErrorDialog,FlowSidebarDetail,RevisionsSidebarDetail,RevisionsDateGroup,RevisionItem,CommentsSidebarDetail,CommentInput,CommentItem,CommentItemHeader,SharesSidebarDetail,ShareItem}.vue
│   │   ├── comparison/{ComparisonModal,ComparisonHeader,ComparisonToggle}.vue, use-comparison.ts, types.ts, utils/*
│   │   ├── SaveOptions.vue, LivePreview.vue
│   │   └── drawers/DrawerCollection.vue   # layout theo preset ở selectMode (gỡ D-58)
│   ├── composables/{use-preset,use-item,use-versions,use-revisions,use-revision,use-edits-guard,use-navigation-guard,use-permissions/*,use-layout-click-handler,use-fake-version-field,use-nested-validation}.ts, use-items.ts (mở rộng nếu thiếu), use-run-manual-flow.ts (selection, location collection)
│   ├── stores/presets.ts (create, update, delete, bookmarks, savePreset), app.ts (basemap), layout/stores/sidebar.ts (activeAccordionItem)
│   ├── utils/{format-items-count,save-as-csv,get-fullcalendar-locale,field-utils,get-version-display-name,geometry/controls,hide-drag-image,sync-ref-property,upload-with-progress}.ts (route: get-item-route.ts có sẵn)
│   ├── test-utils/fetch.ts         # mockFixtureApi: presets CRUD, revisions, versions (compare/save/promote), comments, shares, utils/export|import|sort, aggregate theo filterSystem
│   └── lang/overlay/*.ts           # chỉ chuỗi D-69 (menu bàn phím) nếu Directus không có khóa
├── scripts/check-bundle.mjs        # ngân sách chunk mới (calendar, map layout, kanban, split panel)
└── vite.config.ts                  # optimizeDeps cho fullcalendar, split panel (R14)

apps/web-e2e/src/
├── content-{navigation,tabular,item,live-preview,filter-bookmark,layouts,sidebar,versions,export-import,batch,permissions,share,parity-ui}.spec.ts
├── payload/{items,presets,versions,comments-shares,utils}.spec.ts   # payload và content-parity-ui chạy khi E2E_CONFIG=proxy-api
└── helpers/{allowed-paths.ts (+#50..), content.ts, directus-app.ts (chép từ tests/directus-app-e2e helpers/app.ts), payload.ts}

tests/benchmark/{docker-compose.yml (+ backoffice-web ×2), src/web-content.ts, project.json (target web)}
.github/workflows/{ci.yml (e2e-web: bước payload), benchmark.yml (job benchmark-web)}
design-system/docs/{component-specs.md (Tier 3 nháp 014: Q-2..Q-12), layout-patterns.md (§9 cây collection Q-1, §10 live preview)}
tools/port-manifest/014-T*.json
pnpm-workspace.yaml                 # catalog nhóm Web: gói R1
specs/012-backoffice-web-shell/spec.md, specs/013-interfaces-displays/spec.md   # D-40, D-45, D-55, D-58 "đã gỡ ở 014"
```

**Structure Decision**: `modules/content/` và `layouts/<id>/` giữ cấu trúc Directus để so từng file; component dùng
chung (sidebar, comparison, bộ lọc) đặt theo vai trò trong `components/` như 013; interface `_system` theo thư mục
Directus để 016 thêm phần còn lại.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Không có vi phạm constitution. Rủi ro: `@directus/vue-split-panel` 0.8.9 và `json-to-graphql-query` 2.3.0 (bản của catalog Directus) chưa kiểm giấy phép và build ESM trên npm [Unverified: T002] | Chia đôi live preview như Directus (FR-064); `saveAsCopy` dựng query GraphQL như Directus (FR-053) | Dự phòng split: dùng `ResizeHandle` + `useLayoutStorage` của 012 (sidebar split đã có); dự phòng GraphQL: dựng chuỗi query bằng hàm nhỏ chép logic `jsonToGraphQLQuery` cho phần dùng |
| FullCalendar 6.1.19 CSS trên theme TailAdmin [Unverified mức đè biến `--fc-*`] | Calendar như Directus; TailAdmin free cũng dùng FullCalendar (recipe Q-4 có mẫu) | Viết lịch riêng: nhiều code, mất kéo thả và view của Directus |
| Benchmark compose chưa có image web [Unverified] | SC-003 đo trên 10 triệu dòng của 005 | Đo bằng API thuần không phản ánh "trang hiện xong" |
| Bộ so payload chạy Directus app và app mới trong cùng test (hai bộ selector) | SC-004; `tests/directus-app-e2e` so dòng DB, không so body | So dòng DB (như 005) bỏ sót dạng body (thứ tự khóa, `null` vs thiếu) |

## Phase 0, 1: kết quả

- research.md: R1 đến R15; bổ sung spec khi commit plan: `contracts/api-calls.md` #50 trở đi (kể cả `POST /graphql`
  cho `saveAsCopy`, như Directus), FR-039 geocoder, D-40/D-45 (012) và D-55/D-58 (013) ghi "đã gỡ ở 014" khi đóng.
- data-model.md: route, preset cục bộ, layout config/state, trạng thái màn item, version, revision + so sánh, comment,
  share, flow thủ công, bộ lọc, nền bản đồ, export/import, localStorage, store mở rộng, bộ mẫu mở rộng.
- contracts/: `api-calls.md`, `layouts.md`, `tests.md`.
- quickstart.md: cài, seed, test, E2E ba cấu hình, payload, benchmark, lint, build.
- Agent context: `CLAUDE.md` đã cập nhật (commit 781dd25, 2026-10-15, sau khi phiên 013 mở khóa working tree).
