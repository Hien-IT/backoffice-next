---

description: "Danh sách task cho feature 014: module Content (duyệt và chỉnh sửa dữ liệu như Directus)"
---

# Tasks: Module Content (duyệt và chỉnh sửa dữ liệu như Directus)

**Input**: Tài liệu thiết kế trong `/specs/014-content-module/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R15, R12b), `data-model.md`, `contracts/`
(`api-calls.md`, `layouts.md`, `tests.md`), `quickstart.md`, `checklists/` (`requirements.md`, `release-gate.md`,
`release-gate-proposals.md`).

**Điều kiện bắt đầu**: phiên 013 báo CI xanh (run 38685401583 trên 5751122, 2026-10-15): đã đạt. Trước khi push:
`git pull --rebase`; không push khi CI của session khác đang chạy (một push lên `main` hủy CI đang chạy); nhắn session
khác trước `parity-tests:env-up`/`env-down` nếu có session đang dùng môi trường đối chiếu. Trước commit một phần: chạy
`git diff --cached --stat` (bài học 012).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có test cạnh file: `*.test.ts` (project `unit`, happy-dom) hoặc `*.browser.test.ts` (project `browser`,
  chromium) theo `contracts/tests.md` §1; coverage `apps/web` ≥ 60 % gộp hai project.
- Feature không thêm hay sửa endpoint API nên không có test đối chiếu endpoint mới. Đối chiếu ở mức màn: E2E ba cấu
  hình (`contracts/tests.md` §3) và bộ so payload ghi với Directus app ở `proxy-api` (§4); `fixtures-seed.test.ts` của
  013 giữ xanh với bộ mẫu mở rộng.
- 13 file test Directus (FR-124) port thành test cùng tên, header `// Ported from directus/...`.
- Chỗ research đánh [Unverified]/[Inference] có task kiểm sớm (T002, T003, T004); kết quả ghi vào research.md và spec.

**Organization**: Task nhóm theo user story của spec. Phase 1, 2 là nền chung. Bốn lượt commit (FR-127, Clarifications
Q3): **Lượt 1** = Phase 1, 2, 3 (US1), 4 (US2), 5 (US3); **Lượt 2** = Phase 6 (US4); **Lượt 3** = Phase 7 (US5);
**Lượt 4** = Phase 8 (US6), 9 (US7), 10 (Polish). Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test,
build, E2E hiện có + mới xanh, commit, push).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Gốc đường dẫn: `apps/web/src/` viết tắt `src/`; `apps/web-e2e/src/` viết tắt `e2e/`. Layout ở `src/layouts/<id>/`,
  màn ở `src/modules/content/`, mục sidebar ở `src/components/sidebar/`.
- File chép từ `directus/app/src` (hoặc `directus/packages/composables/src`) PHẢI có dòng đầu
  `// Ported from directus/<đường dẫn>` (SFC: comment trong `<script setup>`); mỗi task chép ghi các cặp
  `{ "source", "dest" }` vào `tools/port-manifest/014-T###.json`; chạy `pnpm run check-port-headers`. KHÔNG sửa, xóa
  hay tạo file trong `directus/`.
- Component Vue KHÔNG chép nguyên (VI, XII): chép logic trong `<script setup>` (hàm, props, mặc định, emits, watch),
  viết lại template theo recipe design-system bằng Reka UI. File `.ts` chép nguyên được. Chỗ khác nguồn ghi
  `// Backoffice: <lý do>` (api → sdk, `notify` → `useNotices` D-66, khóa localStorage `backoffice-`, bỏ AI/collab/visual
  editing D-67, D-68, D-70).
- Giao diện theo recipe nháp (T006): KHÔNG hex thô, KHÔNG palette ngoài theme (`check-raw-colors`); màu dữ liệu chỉ
  qua `style` từ giá trị runtime. Nút chỉ icon có `aria-label`; control có label liên kết; mọi kéo thả có đường bàn
  phím theo `contracts/layouts.md` §5 (D-69).
- Chuỗi giao diện dùng khóa Directus; chuỗi mới chỉ cho D-69, vào overlay `vi-VN` và `en-US` (T023).
- Dữ liệu E2E: collection `bo_content` (màn), `bo_std` không đổi (form 013); tên do test tạo theo `DATA_PREFIX`; mỗi
  spec xóa preset/bookmark của admin trên collection nó dùng ở `beforeEach`.
- Sau mỗi phase: `pnpm nx run web:lint`, `web:typecheck`, `web:test`, `web:build` xanh.

---

## Phase 1: Setup (thư viện, kiểm [Unverified], proxy dev, recipe nháp)

**Purpose**: cài gói, kiểm các giả định đọc từ code Directus, mở proxy dev, viết recipe nháp trước mọi task giao diện
(FR-110, SC-009).

- [X] T001 `pnpm-workspace.yaml` catalog nhóm "Web" thêm gói research R1 với bản Directus 11.17.4:
  `@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/list`,
  `@fullcalendar/interaction` (6.1.19), `@json2csv/plainjs: 7.0.6`, `file-saver: 2.0.5`, `@types/file-saver` (dev),
  `@directus/vue-split-panel: 0.8.9`, `json-to-graphql-query` (bản trong `directus/pnpm-workspace.yaml`);
  `apps/web/package.json` thêm theo `catalog:`; `pnpm install`; `pnpm audit --prod --audit-level=high` không có
  advisory mới (bài học 013: advisory high chặn CI); `pnpm run check-package-names` xanh.
- [X] T002 Kiểm [Unverified] của R1: `pnpm view <gói>@<bản> version license` cho mọi gói T001; `@directus/vue-split-panel`
  và `json-to-graphql-query` có build ESM chạy trong Vite (import thử trong `src/test-utils/browser.smoke.browser.test.ts`);
  biến `--fc-border-color`, `--fc-today-bg-color`, `--fc-event-bg-color` đè được bằng token (dựng một lịch trống trong
  browser test). Gói không dùng được thì chọn dự phòng của R1 (SplitPanel trên `ResizeHandle` 012; hàm dựng query
  GraphQL tối thiểu) ngay trong task này. Ghi kết quả vào `specs/014-content-module/research.md` mục R1 "Kết quả kiểm".
- [X] T003 Đọc code Directus 11.17.4 cho các mục đề xuất gắn T003 (release-gate CHK011, 019, 032, 037, 060, 088, 093) và
  ghi kết quả vào research R15 và spec: (a) `layouts/kanban/kanban.vue` có hộp xác nhận xóa nhóm không → giữ hoặc bỏ
  dòng D-74; (b) `components/v-table/*` có `allowHeaderReorder`, độ rộng tối thiểu cột → FR-031; (c)
  `views/private/components/live-preview.vue` thuộc tính iframe (`sandbox`, `allow`, `referrerpolicy`) → FR-069, bỏ
  [Unverified]; (d) `composables/use-flows.ts` `runManualFlow` body → FR-089; (e) hộp nhập của
  `export-sidebar-detail.vue` công tắc "chạy nền" → FR-090; (f) `drawer-collection.vue` preset tạm kế thừa
  `filter`/`search` → FR-029; (g) diff `src/composables/use-items.ts` với `directus/packages/composables/src/use-items.ts`
  và việc sdk `requestEndpoint` truyền `signal` tới `fetch` (`src/api/sdk.ts`); thiếu thì ghi việc sửa vào T017; (h)
  route quyền item của `use-permissions/item` (`GET /permissions/me/:collection/:pk`) có ở API mới (004) → contracts #53;
  (i) cấu trúc drawer chọn/tạo chuỗi dịch của `interfaces/_system/system-input-translated-string/*` (tên file, request
  `/translations`) → research R3, bỏ [Unverified].
- [X] T004 Đo trên Directus app (profile `app` của `tests/parity`, 8155): mở `bo_std` (013), bấm làm mới (sidebar
  Refresh hoặc layout refresh) sau khi thêm item qua API: request đếm có gửi lại không, số đếm có đổi không. Ghi FR-023
  và research R15; nếu Directus giữ số cũ thì tái tạo và thêm R-38 vào spec (bảng "Rủi ro chấp nhận").
- [X] T005 `apps/web/vite.config.ts` `API_PATHS` thêm `items|flows|folders|revisions|versions|comments|activity|graphql`
  (research R12b) để dev proxy tới `PUBLIC_URL`; `optimizeDeps.include` thêm `@fullcalendar/*`,
  `@directus/vue-split-panel`, `@json2csv/plainjs`, `file-saver`, `json-to-graphql-query` (browser test không nạp lại
  giữa chừng, bài học 013); chạy `PUBLIC_URL=http://127.0.0.1:8155 pnpm nx run web:serve` mở `/admin/content` kiểm tay.
- [X] T006 Recipe nháp "nháp (014)" cho Q-1 đến Q-12 (spec "Câu hỏi mở về design-system") trước mọi task giao diện:
  `design-system/docs/layout-patterns.md` §9 (cây collection trong sub-menu: thụt cấp `ps-4`, nút nhóm `aria-expanded`,
  bookmark là mục con có menu, ô tìm dính đầu, nút hiện collection ẩn, vai trò `tree`/`treeitem`, mũi tên, Q-1) và §10
  (live preview chia đôi: tay cầm, thanh công cụ, chọn kích thước, toàn bề rộng, Q-6); `design-system/docs/component-specs.md`
  mục "Tier 3 recipes, nháp (014)": bảng lớn và `BoPagination` (Q-2), lưới thẻ (Q-3), lịch FullCalendar trên token
  (Q-4), kanban (Q-5), khung layout bản đồ, popup, menu nền (Q-6), bộ lọc nâng cao và `SearchInput` (Q-7), nút bookmark
  ba trạng thái, menu version, split button lưu, notice stack D-66, skeleton tiêu đề `h-7 w-64` (Q-8), mục accordion của
  panel L-4 (Q-9), revisions và hộp so sánh (Q-10), comments với gợi ý `@`, shares (Q-11), hộp xuất/nhập, hộp lỗi nhập,
  hộp xác nhận hàng loạt (Q-12); cặp màu mới vào bảng tương phản `design-system/docs/migration-guide.md` (đánh dấu
  "014"); `specs/014-content-module/design-review/README.md` theo mẫu của 013.
- [X] T007 [P] `apps/web/scripts/check-bundle.mjs`: `BUDGET_014` = kích thước entry của 013 + 60 KB gzip (SC-012); danh
  sách gói chỉ được ở chunk lười thêm `@fullcalendar`, `@directus/vue-split-panel`, `json-to-graphql-query`,
  `@json2csv`; test `apps/web/scripts/check-bundle.test.mjs` (hoặc test hiện có) thêm ca.

**Checkpoint**: gói cài, giả định đã kiểm và ghi, dev proxy đủ route, recipe nháp có trước mọi task giao diện.

---

## Phase 2: Foundational (utils, store, quyền, guard, notices, layout wrapper, API giả lập, bộ mẫu)

**Purpose**: nền mà mọi story cần. Chưa có màn nào hoàn chỉnh.

### Utils và store

- [X] T008 [P] `src/utils/format-items-count.ts` thêm `formatItemsCountRelative` (chép phần còn lại của
  `directus/app/src/utils/format-items-count.ts`); test `src/utils/format-items-count.test.ts` cho cả hai hàm (lọc, một
  trang, nhiều trang, `count_of_total_items`).
- [X] T009 [P] Chép `src/utils/sync-ref-property.ts`, `src/utils/hide-drag-image.ts`, `src/utils/field-utils.ts`
  (`isPrimaryKey`, `isRelational`, `isDateCreated`...), `src/utils/get-version-display-name.ts`,
  `src/utils/get-fullcalendar-locale.ts` (import động `@fullcalendar/core/locales/<x>`); test cạnh mỗi file.
- [X] T010 `src/utils/save-as-csv.ts` chép `directus/app/src/utils/save-as-csv.ts` (`@json2csv/plainjs` `Parser`,
  `file-saver` `saveAs`, tên cột "A -> B" cho field lồng, `handler` của display qua `getDisplay` 013 thay
  `useExtension`, `useAliasFields`); test so byte với `apps/web/fixtures/interfaces/snapshot/expected.content.csv`.
  Làm **sau T023** (file CSV mốc ghi từ Directus app ở T023).
- [X] T011 `src/stores/presets.ts` (012) thêm như `directus/app/src/stores/presets.ts`: getter `bookmarks` (thứ tự
  global, role, user, tên), `getBookmark`, `create` (`POST /presets`), `update` (`PATCH /presets/:id`), `delete`
  (`DELETE /presets` mảng id), `savePreset` (không `id` → create với `user` = mình; `user` khác mình → create bản mới;
  còn lại update); hydrate bỏ qua `ShareUser` (đã có, FR-084); test `src/stores/presets.test.ts` thêm ca (CHK001 body đủ
  preset cục bộ).
- [X] T012 [P] `src/stores/app.ts` thêm `basemap` (ref, mặc định `'OpenStreetMap'`, như `@directus/stores` `app.ts`);
  `src/layout/stores/sidebar.ts` thêm `activeAccordionItem: string | null` (như `stores/sidebar.ts` Directus); test cạnh
  file.
- [X] T013 [P] `src/stores/translations.ts` thêm `create`, `update` (`POST`/`PATCH /translations`, nạp lại i18n) chép
  `directus/app/src/stores/translations.ts`; test.

### Quyền, guard, notices, lỗi

- [X] T014 Chép `src/composables/use-permissions/{index.ts,collection/use-collection-permissions.ts,
  item/use-item-permissions.ts,lib/*.ts,types/*.ts}` (`createAllowed`, `updateAllowed`, `deleteAllowed`, `sortAllowed`,
  `archiveAllowed`, `revisionsAllowed`, `shareAllowed`, `saveAllowed`, `fields`; `fetchItemPermissions` theo T003 h);
  test cạnh file với `permissions.<user>.json` của bộ mẫu.
- [X] T015 [P] Chép `src/composables/use-edits-guard.ts` và `src/composables/use-navigation-guard.ts` (router guard
  + `beforeunload`, `compareQuery`, `ignorePrefix`); test: subpath không hỏi, đổi `?version=` hỏi, rời trang hỏi,
  `hasEdits` false không hỏi.
- [X] T016 [P] `src/composables/use-notices.ts` + `src/components/NoticeStack.vue` (FR-054b, D-66: `BoNotice` xếp chồng
  dưới page header, `role="status"` `aria-live="polite"`, tự ẩn 3 s như Directus, lỗi là hộp thoại, nút đóng; recipe Q-8); gắn vào
  `src/layout/PrivateView.vue` dưới `PageHeader` (prop không đổi API cũ); `src/utils/unexpected-error.ts` (013) hiện hộp
  lỗi `BoDialog` (`unexpected_error`, `translateAPIError`, chi tiết gập, nút `done`) nếu chưa có; test cạnh file; test
  012 của `PrivateView` giữ xanh.
- [X] T017 [P] Bổ sung `src/composables/use-items.ts` theo kết quả T003 g (phần thiếu so với nguồn; `signal` của
  AbortController tới fetch qua sdk hoặc `apiFetch`); test `src/composables/use-items.test.ts` thêm ca hủy request, đếm
  theo `filterSystem`, về trang 1 khi đổi lọc.

### Layout wrapper, sidebar, FieldList, phân trang

- [X] T018 `src/layouts/types.ts` (`LayoutConfig`, `LayoutProps`, `LayoutState` theo `contracts/layouts.md` §1–§3),
  `src/layouts/index.ts` (glob eager `./*/index.ts`, `getLayouts()`, `getLayout(id)` → `undefined` thì màn dùng
  `tabular`), `src/layouts/use-layout.ts` chép `directus/packages/composables/src/use-layout.ts` (wrapper chạy `setup`,
  emit `update:selection|layoutOptions|layoutQuery`, slot mặc định `layoutState`, `expose.state`); test với một layout
  giả trong `src/layouts/use-layout.test.ts`.
- [X] T019 [P] Chép `src/composables/use-layout-click-handler.ts` (readonly, selectMode, lựa chọn đang có, Ctrl/Cmd mở
  tab mới); test.
- [X] T020 [P] `src/components/sidebar/SidebarDetail.vue` chép logic `views/private/components/sidebar-detail.vue` (props
  `id`, `title`, `icon`, `badge`; một mục mở qua `sidebar.activeAccordionItem`; Reka `Accordion` type single; emit
  `toggle`; recipe Q-9); test (mở mục này đóng mục kia, `aria-expanded`).
- [X] T021 [P] `src/components/FieldList.vue` chép logic `components/v-field-list/*` (cây field nạp lười theo quan hệ,
  không giới hạn độ sâu, hàm theo kiểu field, loại `alias` không quan hệ và `presentation`, chỉ field đọc được, tìm
  kiếm, chọn một hoặc nhiều; FR-041 CHK007); test.
- [X] T022 [P] `src/components/BoPagination.vue` (recipe Q-2: tối đa 7 nút, `aria-current="page"`, trước/sau, ẩn khi một
  trang, `nav` có `aria-label`); test.

### Bộ mẫu, API giả lập, E2E harness, chuỗi dịch

- [X] T023 `apps/web/fixtures/interfaces/seed.mjs` mở rộng (data-model §9): collection `bo_content` (field `id`, `status`
  choices, `title`, `body`, `date_published`, `sort`, `author` m2o `directus_users`, `cover` file, `tags` csv, `location`
  geometry.Point khi có PostGIS; `meta.versioning`, `archive_field: status`, `archive_value: 'archived'`,
  `unarchive_value: 'draft'`, `archive_app_filter`, `display_template: '{{ title }}'`, `preview_url`, `sort_field: sort`;
  30 item), folder `bo_folder` (`collapse: locked`) chứa `bo_content`, preset user/role/global, bookmark cá nhân và
  global, version `draft` + `local-1` có delta, share có mật khẩu `bo-share-password` `max_uses: 5`, 2 comment (một có
  `@<uuid bo-viewer>`), flow `bo-flow` thêm `location: both`, flow `bo-flow-item` (`location: item`,
  `requireConfirmation` + 1 field), collection `bo_singleton` (`meta.singleton: true`, field `id`, `site_name` string,
  `tagline` text, `maintenance` boolean; một item; FR-058, US2-7); quyền `bo-editor`/`bo-viewer` trên `bo_content` và
  `bo_singleton` như `bo_std`; `bo_std` KHÔNG đổi;
  `export.mjs` thêm `presets.json`, `versions.json`, `shares.json`, `revisions.bo_content.json`,
  `comments.bo_content.json`, `flows.json` mở rộng, chuẩn hóa như 013 (id revision/activity theo thứ tự, `hash`
  cố định); chạy `pnpm nx run web:fixtures -- --api http://127.0.0.1:8155 ...`, commit snapshot;
  `apps/web/fixtures/interfaces/snapshot.test.ts` thêm kiểm file mới; ghi tay `expected.content.json` (body preset US1-3,
  mẫu request `/items` mỗi layout, nguồn ghi rõ) và `expected.content.csv` (tải trang hiện tại từ Directus app);
  `apps/web/fixtures/interfaces/README.md` cập nhật; chạy `tests/parity/src/web/fixtures-seed.test.ts` xanh.
- [X] T024 `src/test-utils/fetch.ts` `mockFixtureApi` mở rộng theo `contracts/tests.md` §2 (`/presets` CRUD trong bộ
  nhớ, `/revisions`, `/versions` CRUD + compare/save/promote, `/comments`, `/shares` + invite, `/users` tìm kiếm,
  `/utils/sort|export|import`, `/items` aggregate theo `filterSystem` và `export=csv`, `/graphql` `<c>_by_id`,
  `/permissions/me/<c>/<pk>`); `KNOWN_REQUESTS` thêm #50–#96 của `contracts/api-calls.md`; `src/test-utils/fixtures.ts`
  nạp file snapshot mới; test `src/test-utils/fetch.test.ts` cho route mới.
- [X] T025 `e2e/helpers/allowed-paths.ts` thêm #50–#96 (method + path); `e2e/helpers/content.ts` (mở collection/item,
  chọn layout, đợi bảng, xóa preset + bookmark của admin trên collection qua `AdminApi`, tên theo `DATA_PREFIX`);
  `e2e/helpers/external-hosts.ts` (`page.route('**/*')` chặn host ngoài `webUrl`/`apiUrl`/`localhost`, stub
  `tile.openstreetmap.org` PNG 1×1, `fonts.openmaptiles.org` 204, `api.mapbox.com` style JSON tối thiểu + geocoding rỗng,
  `preview.example` HTML rỗng) dùng trong fixture chung; `apps/web-e2e/playwright.config.ts` thêm `grep`/`grepInvert`
  để firefox-1280, webkit-1280 chỉ chạy spec gắn tag `@core` (SC-001); bước CI seed `bo_*` trước E2E (sửa job `e2e-web`
  trong `.github/workflows/ci.yml`: `pnpm nx run web:fixtures -- --api http://127.0.0.1:8155 --email ... --password ...`
  sau `env-up`).
- [X] T026 [P] `src/lang/keys.test.ts` (CHK097): mọi khóa `$t('…')`/`t('…')` tĩnh trong `src/modules/content`,
  `src/layouts`, `src/components/sidebar`, `src/components/comparison`, `src/interfaces/_system` có trong
  `src/lang/translations/en-US.json` (hoặc overlay); chuỗi D-69 ("Lên", "Xuống", "Chuyển trái", "Chuyển phải",
  "Chuyển sang nhóm…") thêm vào `src/lang/overlay/en-US.ts` và `src/lang/overlay/vi-VN.ts`.

**Checkpoint**: nền xong: quyền, guard, notices, wrapper layout, sidebar detail, FieldList, phân trang, bộ mẫu mở rộng,
API giả lập và harness E2E. Story có thể bắt đầu.

---

## Phase 3: User Story 1 - Danh sách collection và bảng item (Priority: P1) 🎯 MVP

**Goal**: cây collection trong sub-menu sidebar, màn collection với layout bảng, preset tự lưu dùng chung với Directus,
phân trang và đếm phía server.

**Independent Test**: E2E `content-navigation` và `content-tabular` ở ba cấu hình; preset ghi ra so với Directus app
(payload ở Phase 9); browser test bảng 1000 × 10 (SC-011).

### Tests cho User Story 1

- [X] T027 [P] [US1] `e2e/content-navigation.spec.ts` (US1-1, US1-2, FR-001 đến FR-005, FR-009): cây nhóm/folder/ẩn/tìm,
  nhóm `locked`, nhóm chứa collection đang xem tự mở, `/content` về collection gần nhất, chuyển hướng
  `/content/directus_users` → `/users`, `/content/directus_revisions` → không tìm thấy, bàn phím cây (FR-004b); tag `@core`
  không gắn.
- [X] T028 [P] [US1] `e2e/content-tabular.spec.ts` `@core` (US1-3 đến US1-6, FR-022 đến FR-034): cột mặc định, thêm/ẩn
  cột, độ rộng, căn lề, khoảng cách, sắp xếp, trang, kích thước trang, chọn nhiều, Ctrl+click tab mới, trạng thái
  trống/không kết quả/lỗi (đặt lại tùy chọn), preset ghi ra đọc lại qua `AdminApi`, số request mỗi thao tác (SC-003 bảng
  request); ở chromium-768 trang không cuộn ngang (`document.documentElement.scrollWidth <= window.innerWidth` như
  `navigation.spec.ts` 012, FR-116).

### Implementation cho User Story 1

- [X] T029 [P] [US1] Chép `src/modules/content/composables/use-navigation.ts` (`activeGroups`, `showHidden` dùng chung,
  mở nhóm cha của collection đang xem); test.
- [X] T030 [US1] `src/modules/content/components/{ContentNavigation,NavigationItem,NavigationItemContent,
  NavigationBookmark}.vue` chép logic `modules/content/components/*` (FR-004, FR-004b, FR-005 phần liệt kê và điều
  hướng bookmark; sửa/xóa bookmark ở T053): cây trong slot `navigation` của `PrivateView`/`AppSidebar` theo recipe §9,
  `dense` > 5, ô tìm > 20 (lọc từ 3 ký tự như Directus), "hiện/ẩn collection ẩn" (nút + `contextmenu`), admin không có
  collection thì nút tạo collection tới khung Settings (D-71); browser test bàn phím và cây 300 collection + 100
  bookmark < 500 ms (SC-011, `PERF=1`).
- [X] T031 [US1] `src/modules/content.ts` thay `placeholderRoutes` bằng route chép `modules/content/index.ts` (FR-001,
  FR-002; data-model §1): `no-collections` (beforeEnter về collection gần nhất `backoffice-last-accessed-collection` hoặc
  gốc đầu tiên bỏ nhóm đóng), `content-collection`, `content-item`, `content-item-preview`, `content-item-not-found`,
  guard `checkForSystem` (dùng `getSystemCollectionRoute` của `src/utils/get-item-route.ts`, giữ `?bookmark=`),
  `getArchiveValue`; component lười; `src/modules/content/routes/{NoCollections,ContentNotFound,CollectionOrItem}.vue`
  (singleton → màn item; ghi collection gần nhất); test `src/modules/content.test.ts` (mọi nhánh guard) và test 012
  `src/modules/index.test.ts` giữ xanh.
- [X] T032 [US1] Chép `src/composables/use-preset.ts` (FR-010 đến FR-019; data-model §2): preset cục bộ, debounce 450 ms
  gửi toàn bộ preset, bookmark không tự lưu và `bookmarkSaved` so sâu, `resetPreset` lưu ngay, `saveCurrentAsBookmark`,
  `clearLocalSave`, subscribe store đổi tên, `temporary`, phiên share không ghi; test port + ca CHK001.
- [X] T033 [US1] `src/layouts/tabular/{index.ts,types.ts}` chép `layouts/tabular/{index.ts,types.ts}` bỏ
  `useAiToolsStore` (D-70): `useItemOptions` (cột mặc định CHK034, sort mặc định sort_field hoặc pk, limit 25),
  `useTable` (headers, widths debounce 350 ms, align, spacing → 29/43/58), `showingCount`, `download` (`saveAsCSV`),
  `selectAll`, `refresh`; test `src/layouts/tabular/index.test.ts` với `mockFixtureApi`.
- [X] T034 [US1] `src/components/BoTable.vue` mở rộng bằng prop tùy chọn (FR-030 đến FR-032; recipe Q-2): `fixedHeader`,
  header có `width`, `align`, `description`, `sortable`, slot `header-context-menu` (sắp tăng/giảm, căn trái/giữa/phải,
  ẩn cột, "Chuyển trái/phải" D-69, ô độ rộng), kéo đổi thứ tự cột chỉ nếu T003 b thấy Directus có, `rowHeight`,
  `aria-sort` trên header, `caption`, click dòng phát `{item, event}`; test 013 của `BoTable` giữ xanh; thêm
  `src/components/BoTable.browser.test.ts` ca mới.
- [X] T035 [US1] `src/layouts/tabular/{Tabular.vue,TabularOptions.vue,TabularActions.vue}`: bảng theo state, footer
  `BoPagination` + chọn kích thước trang lọc `queryLimit.max` (`usePageSize` 013, FR-033), nút "+" thêm cột bằng
  `FieldList` trong Popover, sắp xếp tay (kéo + menu dòng Lên/Xuống khi `sortAllowed`, FR-032, D-69), slot
  `no-results`/`no-items`/`error`; `TabularActions` dòng số đếm `role="status" aria-live="polite"` (FR-115b);
  `TabularOptions` khoảng cách dòng; browser test + `src/layouts/tabular/perf.browser.test.ts` 1000 × 10 < 2 s, cuộn 10
  lần không vẽ lại toàn bảng (SC-011, `PERF=1`).
- [X] T036 [P] [US1] `src/components/sidebar/LayoutSidebarDetail.vue` chép `layout-sidebar-detail.vue` (menu chọn layout
  từ `getLayouts()`, icon, fallback tabular, slot option của layout; FR-021); test.
- [X] T037 [US1] `src/modules/content/routes/CollectionRoute.vue` chép logic `routes/collection.vue` phần US1 (FR-006,
  FR-008, FR-020 đến FR-028, FR-044 phần bộ lọc hệ thống): `PrivateView` (breadcrumb, tiêu đề, icon/màu collection,
  slot actions với `layout.slots.actions`, nút tạo item khóa khi không có quyền FR-098), `useLayout` với preset,
  `filterSystem` archive, `mergeFilters`, lựa chọn xóa khi đổi collection, slot trạng thái, panel L-4 với
  `LayoutSidebarDetail`; `useHead`; tiêu đề tab theo FR-051 (phần collection); `ContentNotFound` khi collection không có
  hoặc hệ thống; test `src/modules/content/routes/CollectionRoute.test.ts`.
- [X] T038 [US1] Kiểm story: E2E T027, T028 xanh ở `proxy-directus`, `proxy-api`, `cors`; `web:test` xanh; manifest
  `tools/port-manifest/014-T029..T037.json`.

**Checkpoint**: module Content thay khung 012: cây, bảng, preset tự lưu. MVP dùng được để duyệt dữ liệu.

---

## Phase 4: User Story 2 - Trang item: form, lưu, xóa, archive, singleton, live preview (Priority: P1)

**Goal**: màn `/content/:collection/:primaryKey` dùng `BoForm` (013) với đủ thao tác lưu của Directus, hỏi thay đổi
chưa lưu, singleton, live preview không visual editing (Q1 = A).

**Independent Test**: E2E `content-item` và `content-live-preview` ở ba cấu hình; port `use-item/index.test.ts`.

### Tests cho User Story 2

- [X] T039 [P] [US2] `e2e/content-item.spec.ts` `@core` (US2-1 đến US2-8, FR-050 đến FR-062): tạo, lưu và thoát, lưu và
  ở lại (URL đổi khóa mới), lưu và tạo tiếp, bản sao (`bo_content` có m2o, o2m của bộ mẫu `bo_rel`), bỏ thay đổi, xóa,
  archive/unarchive, hỏi `unsaved_changes` khi rời trang và khi đổi `?version=`, lỗi validation (field bắt buộc), singleton
  `bo_singleton` (seed T023: mở `/content/bo_singleton` thẳng form, `PATCH /items/bo_singleton`, không nút quay lại/xóa/
  archive, `/content/bo_singleton/1` → không tìm thấy), `bo-viewer` form chỉ đọc, tiêu đề tab chuỗi cuối
  (FR-051), notice tại chỗ, focus sau xóa và lưu-tạo-tiếp (FR-115c).
- [X] T040 [P] [US2] `e2e/content-live-preview.spec.ts` (FR-063 đến FR-069): nút xem trước bật/tắt, chia đôi và kéo tay
  cầm (cả mũi tên), toàn bề rộng, popup mở `/content/bo_content/1/preview` và `postMessage('refresh')`, nạp lại sau lưu,
  ≤ `sm` toàn bề rộng, khóa localStorage `backoffice-live-preview-*`; `preview.example` stub (T025).

### Implementation cho User Story 2

- [X] T041 [US2] Chép `src/composables/use-item/index.ts` (+ `lib/*` nếu có) (FR-050 đến FR-055; data-model §4): api →
  sdk, `notify` → `useNotices`, `unexpectedError`, `save` (validate cục bộ, `clearHiddenFieldsByCondition`,
  `pushGroupOptionsDown` từ form 013), `saveAsCopy` (GraphQL `POST /graphql|/graphql/system` bằng `json-to-graphql-query`
  hoặc dự phòng T002, `findExistingRelatedItems` với `SEARCH` khi query > 8192, `clearPrimaryKey`,
  `clearJunctionRelatedKey`), `archive`, `remove`, `refresh`, `isArchived`, singleton endpoint; port test
  `directus/app/src/composables/use-item/index.test.ts` → `src/composables/use-item/index.test.ts`.
- [X] T042 [P] [US2] Chép `src/composables/use-nested-validation.ts` và `useShortcut`/`translateShortcut` từ
  `directus/packages/composables` (`src/composables/use-shortcut.ts`; gắn vào phần tử form, `meta` = Ctrl/Cmd); test.
- [X] T043 [P] [US2] `src/components/SaveOptions.vue` chép logic `save-options.vue` (split button theo recipe Q-8: menu
  Reka `DropdownMenu` cạnh nút lưu, `disabledOptions`, gợi ý phím tắt); test.
- [X] T044 [US2] `src/modules/content/routes/ItemRoute.vue` chép logic `routes/item.vue` bỏ collab, AI, visual editing
  (FR-050 đến FR-062, FR-115c): `BoForm` (013) với `fields` theo quyền, `initialValues`, `edits`, `primaryKey`,
  `loading`, `disabled` (`isFormDisabled`), `validationErrors`, `autofocus`, `direction`; tiêu đề `RenderTemplate` +
  skeleton; breadcrumb (giữ `?bookmark=`), nút quay lại; `isSavable`, `disabledOptions`; nút xóa/archive với hộp xác nhận
  (focus nút Hủy, FR-115d), lưu chính + `SaveOptions`; guard `useEditsGuard` (`compareQuery: ['version']`) + hộp
  `unsaved_changes`; phím tắt; sự kiện "flow đã chạy" nạp lại item (FR-059); singleton (FR-058); `ContentNotFound`
  (FR-061); `useHead` (FR-051 chuỗi cuối); test `src/modules/content/routes/ItemRoute.test.ts` (nhánh savable, singleton,
  chỉ đọc, guard).
- [X] T045 [P] [US2] `src/components/SplitPanel.vue` bọc `@directus/vue-split-panel` (hoặc dự phòng T002) với tay cầm
  `ResizeHandle` 012: props `size`, `collapsed`, `minSize`, `maxSize`, `snapPoints`, `collapseThreshold`, `disabled`;
  bàn phím mũi tên ±5 %, Home/End (D-69); `motion-reduce`; test.
- [X] T046 [P] [US2] `src/components/LivePreview.vue` chép logic `views/private/components/live-preview.vue` bỏ visual
  editing (FR-065, FR-069): thanh công cụ (URL, nạp lại, kích thước 400×600 ↔ toàn khung, ô rộng/cao, zoom 25–200 %, mở
  cửa sổ, menu hiển thị), iframe với thuộc tính theo T003 c, `window.refreshLivePreview`, trạng thái `no_url`/`invalid_url`;
  test.
- [X] T047 [US2] Live preview trong `ItemRoute.vue` + `src/modules/content/routes/PreviewRoute.vue` (FR-063, FR-064,
  FR-066 đến FR-068): `previewUrl` từ `use-template-data` với `preview_url` và `$version`, chế độ `split`/`popup`/tắt,
  localStorage `backoffice-live-preview-{mode,size,full-width}`, `livePreviewEnforceDefault`, `isMobile` (`sm`),
  `window.open` 900×800 tên `live-preview`, nhận `postMessage` cùng origin từ cửa sổ con, đóng con khi rời trang, popup bị
  chặn: không dự phòng; test.
- [X] T048 [US2] Kiểm story: E2E T039, T040 xanh ở ba cấu hình; manifest `014-T041..T047.json`.

**Checkpoint**: tạo, sửa, lưu kiểu, bản sao, xóa, archive, singleton, live preview chạy như Directus.

---

## Phase 5: User Story 3 - Tìm kiếm, bộ lọc nâng cao, bookmark và preset (Priority: P1)

**Goal**: `SearchInput` + `system-filter` (D-73), bookmark tạo/mở/sửa/xóa/cập nhật/đặt lại, preset role/global.

**Independent Test**: E2E `content-filter-bookmark` ở ba cấu hình; unit test 10 mẫu JSON bộ lọc của Directus (SC-004).

### Tests cho User Story 3

- [X] T049 [P] [US3] `e2e/content-filter-bookmark.spec.ts` `@core` (US3-1 đến US3-5, FR-010 đến FR-017, FR-040 đến
  FR-043): bộ lọc ba cấp (số điều kiện "3"), tìm kiếm, xóa bộ lọc, tạo bookmark (tên `$t:` qua chuỗi dịch), mở bookmark từ
  cây, đổi sắp xếp → "cập nhật bookmark" và "đặt lại", sửa/xóa bookmark cá nhân, bookmark global chỉ "tạo bookmark",
  `?bookmark=999999` → `bookmark_doesnt_exist`, preset role của `bo-editor`, preset role/global đổi layout tạo preset user.

### Implementation cho User Story 3

- [X] T050 [P] [US3] Chép `src/interfaces/_system/system-filter/{index.ts,utils.ts}` (`getNodeName`, `getField`,
  `fieldHasFunction`, `getComparator`, `fieldToFilter`); test `utils.test.ts`.
- [X] T051 [US3] `src/interfaces/_system/system-filter/{SystemFilter.vue,Nodes.vue,InputGroup.vue,InputComponent.vue}` chép
  logic (FR-041, recipe Q-7): cây `_and`/`_or`, thêm điều kiện bằng `FieldList` (chỉ field đọc được), toán tử
  `getFilterOperatorsForType`/`getOutputTypeForFunction` của `@directus/utils`, ô giá trị bằng interface 013 theo kiểu
  (`input`, `datetime`, `boolean`, `select-dropdown` có `choices`, `select-dropdown-m2o` cho quan hệ), biến `$CURRENT_*`,
  `$NOW`, kéo đổi thứ tự (vuedraggable) + menu Lên/Xuống (D-69), đổi `_and`↔`_or`, xóa; đăng ký trong registry
  interface (013 `src/interfaces/index.ts` glob `_system`); test `SystemFilter.test.ts` với 10 mẫu JSON ghi từ Directus app
  (nguồn ghi rõ trong test).
- [X] T052 [US3] `src/components/SearchInput.vue` (sau T051) chép logic `views/private/components/search-input.vue` (mở rộng khi
  focus, đếm toán tử `activeFilterCount`, Popover chứa `SystemFilter`, Esc đóng, giữ mở khi focus vào menu con); port test
  `search-input.test.ts` → `src/components/SearchInput.test.ts`.
- [X] T053 [US3] Chép `src/interfaces/_system/system-input-translated-string/{index.ts,InputTranslatedString.vue}` (+
  drawer danh sách chuỗi dịch `/translations`: tìm, chọn → `$t:<key>`, tạo qua `translationsStore.create`; FR-013,
  D-73) và `src/modules/content/components/BookmarkAdd.vue` (tên, icon `select-icon`, màu `select-color`); trong
  `NavigationBookmark.vue` thêm menu sửa (cá nhân: hộp thoại; role/global: link `/settings/presets/:id` khung 016, D-71)
  và xóa (hộp xác nhận; xóa bookmark đang mở → route collection, focus tiêu đề FR-115c), icon khóa + tooltip
  `cannot_edit_<scope>_bookmarks`; test cạnh file.
- [X] T054 [US3] `CollectionRoute.vue` phần US3 (FR-012 đến FR-017, FR-040, FR-042): `SearchInput` trong actions ghi
  `search`/`filter` preset, nút bookmark ba trạng thái cạnh tiêu đề (FR-015), `clearFilters`, notice
  `bookmark_doesnt_exist` (FR-016), tiêu đề theo `bookmarkTitle`, breadcrumb khi ở bookmark; test.
- [X] T055 [US3] **Đóng lượt 1**: `pnpm nx run-many -t lint typecheck test build check-bundle` xanh; E2E hiện có (012,
  013) + T027, T028, T039, T040, T049 xanh ở ba cấu hình (local theo quickstart); `pnpm run check-port-headers`; cập nhật
  `[X]` các task; commit (Conventional Commits, tiếng Anh) và push lên `main` theo quy tắc ở đầu file; theo dõi CI tới
  xanh (`gh run watch`), đỏ thì sửa trước khi sang lượt 2.

**Checkpoint (lượt 1)**: US1–US3 chạy độc lập, CI xanh.

---

## Phase 6: User Story 4 - Layout cards, calendar, kanban, map (Priority: P2) — Lượt 2

**Goal**: bốn layout còn lại với option và query như Directus, nền bản đồ từ settings, drawer chọn item theo layout
preset (gỡ D-58).

**Independent Test**: test component mỗi layout với `mockFixtureApi` (request `/items` và `layout_options` so
`expected.content.json`); E2E `content-layouts` một kịch bản mỗi layout.

### Tests cho User Story 4

- [X] T056 [P] [US4] `e2e/content-layouts.spec.ts` (US4-1 đến US4-5): cards (ảnh, tiêu đề/phụ đề template, kích thước),
  calendar (đổi tháng → filter vùng ngày; kéo sự kiện → `PATCH`), kanban (kéo thẻ đổi cột → `/utils/sort` rồi `PATCH`;
  menu "Chuyển sang nhóm…"; ở chromium-768 kanban cuộn ngang trong khung, trang không cuộn ngang: `scrollWidth <=
  innerWidth`, FR-116), map (nền OSM/Mapbox stub/raster riêng từ settings tạm `basemaps`, `_intersects_bbox` khi di
  chuyển, chọn bằng danh sách bàn phím), drawer chọn item (m2o của `bo_rel` 013) theo layout cards của preset.

### Implementation cho User Story 4

- [X] T057 [P] [US4] `src/layouts/cards/{index.ts,types.ts,Cards.vue,CardsOptions.vue,CardsActions.vue,
  components/Card.vue,components/CardsHeader.vue}` chép `layouts/cards/*` (FR-035, recipe Q-3): field nạp từ
  `imageSource` + template, ảnh `/assets/<id>?modified=&key=system-medium-cover|contain`, lưới theo `size`, chọn, icon
  fallback, sắp xếp + kích thước trang trong header; test `index.test.ts` + `Cards.browser.test.ts`.
- [X] T058 [P] [US4] `src/layouts/calendar/{index.ts,types.ts,Calendar.vue,CalendarOptions.vue,CalendarActions.vue,
  calendar.css}` chép `layouts/calendar/*` (FR-036, recipe Q-4): FullCalendar `createCalendar`/`destroyCalendar`, view
  theo kiểu field, bộ lọc vùng ngày, `limit` = `queryLimit.max` hoặc 1000, `eventChange` → `PATCH` với ngày theo kiểu
  (`dateTime` cắt 19, cả ngày ±1), revert khi lỗi, locale (`get-fullcalendar-locale`), `viewInfo`,
  `dataset_too_large_currently_showing_n_items`; `calendar.css` đè `--fc-*` bằng token, dark, `motion-reduce` (FR-110c);
  port `directus/app/src/layouts/calendar/options.test.ts` → `CalendarOptions.test.ts`; `Calendar.browser.test.ts`.
- [X] T059 [P] [US4] `src/layouts/kanban/{index.ts,types.ts,Kanban.vue,KanbanOptions.vue,KanbanActions.vue}` chép
  `layouts/kanban/*` gồm `useFilterFields` (FR-037, recipe Q-5): nhóm `choices`/m2o, `groupOrder`, cột "chưa nhóm" khi
  nullable, thẻ (ảnh, tiêu đề, text, ngày, tag chip, avatar), `change()` (`/utils/sort` rồi `PATCH`), kéo cột, thêm/đổi
  tên/xóa nhóm m2o theo `useLayoutPermissions` (xác nhận xóa theo T003 a / D-74), menu thẻ "Chuyển sang nhóm…",
  "Lên/Xuống" và menu cột "Chuyển trái/phải" (D-69), cuộn ngang trong khung; port
  `directus/app/src/layouts/kanban/kanban.test.ts` → `Kanban.browser.test.ts`.
- [X] T060 [P] [US4] Chép `src/utils/geometry/controls.ts` (`ButtonControl`, `BoxSelectControl`) và `src/layouts/map/style.ts`
  (màu từ token `--color-brand-500` qua `getComputedStyle`); test.
- [X] T061 [US4] `src/layouts/map/{index.ts,types.ts,MapLayout.vue,MapOptions.vue,MapActions.vue,components/MapView.vue}`
  chép `layouts/map/*` (FR-038, FR-039, recipe Q-6) trên `BoMapFrame` 013: nền `getBasemapSources()` (013) + `app.basemap`,
  control điều hướng/định vị/vừa dữ liệu/chọn khung, geocoder Mapbox nạp động khi có `mapbox_key`, GeoJSON từ
  `utils/geometry`, cụm điểm, popup `RenderTemplate`, `cameraOptions` ghi khi `moveend`, `_intersects_bbox` khi native,
  `handleClick`/`handleSelect` (Shift cộng dồn), lỗi hình học notice; `MapActions` có danh sách item đang hiện để
  mở/chọn bằng bàn phím (D-69); `MapLayout.browser.test.ts` (tự bỏ qua khi không có WebGL, như 013).
- [X] T062 [US4] `src/components/drawers/BoDrawer.vue` thêm slot `sidebar` tùy chọn (panel phải 240 px; dưới `xl` mục gập
  đầu body; recipe `layout-patterns.md` §8 cập nhật) và `src/components/drawers/DrawerCollection.vue` theo layout preset
  (FR-029, gỡ D-58): `usePreset(collection, null, true)` kế thừa `filter`/`search` (T003 f), `useLayout` với
  `selectMode`, `showSelect`, `filterSystem` = `filter` của interface, `SearchInput`, `LayoutSidebarDetail` trong slot
  `sidebar`; test 013 (`DrawerCollection.test.ts`, interface quan hệ) giữ xanh; thêm ca layout cards và map.
- [X] T063 [US4] **Đóng lượt 2**: như T055 với E2E T056; commit, push, CI xanh.

**Checkpoint (lượt 2)**: năm layout và drawer chọn item theo layout.

---

## Phase 7: User Story 5 - Sidebar item: revisions, comments, shares, flows; versions (Priority: P2) — Lượt 3

**Goal**: panel chi tiết của màn item đủ bốn mục, menu version, hộp so sánh version/revision (gỡ D-55).

**Independent Test**: E2E `content-sidebar`, `content-versions`; port `use-versions`, `version-menu`, `use-comparison`,
`use-flows`, `flow-sidebar-detail` test.

### Tests cho User Story 5

- [X] T064 [P] [US5] `e2e/content-sidebar.spec.ts` (US5-1 đến US5-3, US5-6; FR-080 đến FR-084, FR-089): revisions (đếm,
  trang, nhóm ngày, so sánh "trước"/"mới nhất", Apply ghi vào form rồi lưu), comments (gợi ý `@`, Ctrl+Enter, sửa, xóa,
  mention `bo-viewer` tạo `directus_notifications`), shares (tạo, chép link, gửi mời, xóa; `bo-editor` không có quyền
  share → ẩn), flow `bo-flow-item` có xác nhận và `run_flow_anyway` khi có thay đổi; item mới không có mục nào.
- [X] T065 [P] [US5] `e2e/content-versions.spec.ts` (US5-4, US5-5; FR-070 đến FR-073): `draft` global luôn có, tạo version
  (key slug, key `draft` bị chặn), chuyển (hỏi khi có thay đổi), lưu version, "lưu và về bản chính", so sánh + promote
  (xóa version tùy chọn), đổi tên, xóa; kiểm `directus_versions`, item chính, `directus_activity`.

### Implementation cho User Story 5

- [X] T066 [P] [US5] Chép `src/composables/use-revisions.ts`, `src/composables/use-revision.ts` (10 mỗi trang, `sort -id`,
  lọc `version`, đếm, nhóm theo ngày); test.
- [X] T067 [US5] `src/components/sidebar/{RevisionsSidebarDetail,RevisionsDateGroup,RevisionItem}.vue` chép logic
  (FR-080, recipe Q-10): `SidebarDetail` với badge đếm, nạp khi mở, phân trang, `private_user`, hiện khi
  `revisionsAllowed && accountabilityScope === 'all'`, mở hộp so sánh chế độ revision; test.
- [X] T068 [P] [US5] Chép `src/components/comparison/{use-comparison.ts,types.ts}` và utils chuẩn hóa liên quan
  (`getNormalizedComparisonData`, build version/revision comparison); port
  `directus/app/src/views/private/components/comparison/use-comparison.test.ts`.
- [X] T069 [US5] `src/components/comparison/{ComparisonModal,ComparisonHeader,ComparisonToggle}.vue` chép logic bỏ chế độ
  collab (D-68) (FR-072, FR-073, FR-081, recipe Q-10): hai cột `BoForm` 013 với `comparisonMode`/`comparisonSide` (gỡ
  D-55), checkbox chỉ trên field khác biệt (mặc định chọn hết), công tắc "chỉ hiện khác biệt", `outdated`, promote
  (khóa khi không có quyền update item chính; ô xóa version khi có quyền delete `directus_versions`), Apply revision phát
  `revert`, `no_relational_data`, focus trả về nút mở; browser test.
- [X] T070 [P] [US5] Chép `src/composables/use-versions.ts` (global `draft` qua `DRAFT_VERSION_KEY`, `saveVersion` tạo
  `+` trước, `addVersion`/`updateVersion`/`deleteVersion`) và `src/composables/use-fake-version-field.ts`; `DRAFT_VERSION_KEY`
  vào `src/constants.ts`; port `directus/app/src/composables/use-versions.test.ts`.
- [X] T071 [US5] `src/modules/content/components/{VersionMenu,VersionPromoteField}.vue` chép logic (FR-070, recipe Q-8):
  menu trong breadcrumb, hộp tạo/đổi tên (slugify key, tooltip `reserved_version_key`), xóa, chuyển (hỏi khi có thay
  đổi), mở hộp so sánh; port `directus/app/src/modules/content/components/version-menu.test.ts` → `VersionMenu.test.ts`.
- [X] T072 [US5] `ItemRoute.vue` phần version (FR-071, FR-060): `?version=` ↔ `currentVersion`, `use-item` gửi
  `version`/`versionRaw` khi version đã tồn tại, nút "lưu version" + menu (về bản chính, thoát, bỏ thay đổi), Ctrl/Cmd +
  Alt + S, `versionValidationErrors`, ẩn xóa/archive/Comments/Shares/Flows khi ở version, `isFormDisabled` theo quyền
  update `directus_versions`; test.
- [X] T073 [P] [US5] `src/components/sidebar/{CommentsSidebarDetail,CommentInput,CommentItem,CommentItemHeader}.vue` chép
  logic (FR-082, FR-110b, recipe Q-11): danh sách nhóm ngày, `@uuid` → `<mark>tên</mark>` qua DOMPurify không tag, gợi ý
  user khi gõ `@` (`/users` tìm kiếm, điều hướng bàn phím), Ctrl/Cmd + Enter, sửa, xóa có xác nhận; test.
- [X] T074 [P] [US5] `src/components/sidebar/{SharesSidebarDetail,ShareItem}.vue` chép logic (FR-083, recipe Q-11): danh
  sách, hết hạn/hết lượt, menu (chép link qua `navigator.clipboard` + notice, gửi mời hộp thoại → `/shares/invite`,
  sửa, xóa), tạo/sửa bằng `DrawerItem` 013 trên `directus_shares` với `{collection, item}` sẵn và ẩn; test.
- [X] T075 [US5] `src/components/sidebar/FlowSidebarDetail.vue` chép logic + `src/composables/use-run-manual-flow.ts`
  (013) mở rộng `selection`, `location: 'collection' | 'item'`, tooltip, `isFlowDisabled`, body theo T003 d (FR-089);
  port `directus/app/src/composables/use-flows.test.ts` (phần chưa port ở 013) và
  `views/private/components/flow-sidebar-detail.test.ts` → `FlowSidebarDetail.test.ts`.
- [X] T076 [US5] `ItemRoute.vue` panel L-4 (FR-008): Revisions, Comments, Shares, Flows khi item đã có và không ở version
  (Revisions vẫn hiện ở version); làm mới Revisions sau lưu; test.
- [X] T077 [US5] **Đóng lượt 3**: như T055 với E2E T064, T065; commit, push, CI xanh.

**Checkpoint (lượt 3)**: sidebar item và version như Directus.

---

## Phase 8: User Story 6 - Xuất, nhập, hàng loạt, archive, tự làm mới (Priority: P2) — Lượt 4

**Goal**: mục Export/Import, thao tác hàng loạt, Archive, Refresh, Flows ở màn collection.

**Independent Test**: E2E `content-export-import`, `content-batch`; port `export-sidebar-detail`,
`refresh-sidebar-detail` test.

### Tests cho User Story 6

- [X] T078 [P] [US6] `e2e/content-export-import.spec.ts` (US6-1 đến US6-3; FR-090 đến FR-092): hộp xuất (định dạng, giới
  hạn, field lồng, bộ lọc sửa được, sắp xếp), tải về CSV và so byte với file Directus app tải cùng điều kiện, khóa ở
  `files` khi xuất ≥ 2500 dòng (cách duy nhất: `page.route()` sửa response `aggregate` của hộp xuất thành
  `countDistinct` 3000; nhánh `> queryLimit.max` kiểm bằng unit test ở T080), lưu vào thư viện (`export_started`), "tải trang hiện tại" so byte `expected.content.csv`, nhập CSV 10 dòng,
  nhập lỗi → hộp lỗi, chạy nền.
- [X] T079 [P] [US6] `e2e/content-batch.spec.ts` (US6-4 đến US6-6; FR-095 đến FR-099, FR-044): xóa/archive/sửa hàng loạt
  (`DrawerBatch`), lỗi transaction → hộp lỗi và lựa chọn giữ, Archive sidebar (`?archived`, `?all`), Refresh 10 s (đồng hồ
  giả của Playwright), Flows `bo-flow` với lựa chọn.

### Implementation cho User Story 6

- [X] T080 [P] [US6] `src/utils/upload-with-progress.ts` (`XMLHttpRequest` qua URL `apiUrl` với `withCredentials`, tiến độ,
  abort) và `src/components/sidebar/{ExportSidebarDetail,ImportErrorDialog}.vue` chép logic
  `export-sidebar-detail.vue`, `import-error-dialog.vue` (FR-090, FR-091, recipe Q-12): nhập (file `.csv`/`.json`, tiến
  độ, `importing`, `background`, lỗi `FAILED_VALIDATION` → hộp lỗi), hộp xuất (số đếm debounce 250 ms, khóa `files` khi
  `> queryLimit.max` hoặc `≥ 2500`, `FieldList`, `SystemFilter`, thư mục bằng `BoSelect` thư mục của 013, tải về
  `apiFetch` → blob → `saveAs`, lưu thư viện), "tải trang hiện tại" (`onDownload`); port
  `views/private/components/export-sidebar-detail.test.ts` → `ExportSidebarDetail.test.ts`, thêm ca khóa `files` khi số
  xuất `> queryLimit.max` (server store giả `queryLimit.max = 100`) và khi `≥ 2500`.
- [X] T081 [P] [US6] `src/components/sidebar/{ArchiveSidebarDetail,RefreshSidebarDetail}.vue` chép logic (FR-044, FR-099):
  Archive ba lựa chọn đổi query giữ query khác; Refresh chu kỳ `null/10/30/60/300`, `emitter` `tabIdle`/`tabActive` của
  012, ghi `refresh_interval`; port `refresh-sidebar-detail.test.ts` → `RefreshSidebarDetail.test.ts`.
- [X] T082 [US6] `CollectionRoute.vue` phần US6 (FR-028, FR-095 đến FR-098, FR-008): nút xóa/archive/sửa hàng loạt khi có
  lựa chọn (khóa + tooltip `not_allowed`), hộp xác nhận `batch_delete_confirm`/`archive_confirm_count` (focus Hủy),
  `DELETE /items/:c` mảng khóa, `PATCH {keys, data}`, `DrawerBatch` 013, hộp lỗi; panel L-4 thêm Archive (khi
  `hasArchive`), Refresh, Export/Import, Flows (`FlowSidebarDetail` với `selection`); `FlowDialogs` 013; test.

**Checkpoint**: màn collection đủ chức năng như Directus.

---

## Phase 9: User Story 7 - Quyền, trang item của share, đối chiếu với Directus app (Priority: P2) — Lượt 4

**Goal**: quyền theo user và share, bộ so payload với Directus app, so giao diện SC-002, benchmark màn SC-003.

**Independent Test**: E2E `content-permissions`, `content-share`, `content-parity-ui`; bộ `payload/*` ở `proxy-api`;
benchmark `benchmark:web` chạy tay một lần.

### Tests cho User Story 7

- [X] T083 [P] [US7] `e2e/content-permissions.spec.ts` (US7-1; FR-100 đến FR-103): `bo-viewer` (cây chỉ collection đọc
  được, nút khóa/ẩn, form chỉ đọc), `bo-editor` (không xóa), field không đọc được không có cột, sắp xếp theo field không
  đọc được → trạng thái lỗi; thêm một lượt với user ngôn ngữ `vi-VN` kiểm số đếm và ngày nhóm (CHK091).
- [X] T084 [P] [US7] `e2e/content-share.spec.ts` (US7-2; FR-084): mở `/shared/<id>` ẩn danh, nhập `bo-share-password`, về
  `/content/bo_content/1` với phiên share (cây chỉ collection đó, không bookmark, không ghi preset, không `track/page`),
  `/content` → theo quyền; share hết lượt → thông báo; user đã đăng nhập mở `/shared/<id>` → thẳng tới item.
- [X] T085 [P] [US7] `e2e/content-parity-ui.spec.ts` (SC-002): với `admin`, `bo-editor`, `bo-viewer`, thu năm thuộc tính
  (nhãn và thứ tự mục cây, header cột mặc định, chuỗi số đếm, `aria-disabled`/`disabled` của nút, mục sidebar) ở app
  mới và Directus app (8155/admin, selector riêng), so bằng; chạy khi `E2E_CONFIG=proxy-api`.

### Implementation cho User Story 7

- [X] T086 [US7] `src/routes/SharedRoute.vue` (012): sau đăng nhập share `router.replace(getItemRoute(collection, item))`,
  user thường đã đăng nhập chuyển thẳng (như `shared.vue`); module Content với `ShareUser` không gọi store presets ghi,
  không bookmark (FR-084); test `SharedRoute.test.ts` thêm ca; test 012 giữ xanh.
- [X] T087 [US7] `e2e/helpers/payload.ts` (`recordWrites`, `normalize` theo `contracts/tests.md` §4: thứ tự gửi, uuid, id
  trong path, thời gian, `DATA_PREFIX`, khóa object không thứ tự) và `e2e/helpers/directus-app.ts` (chép
  `tests/directus-app-e2e/src/helpers/{app,login}.ts` có header nguồn; `last_page` null + xóa cache dữ liệu trước lượt
  Directus như `bothRuns`; helper bộ lọc, version, comment, share cho Directus app: một hàm mỗi nhóm kịch bản); test
  `e2e/helpers/payload.spec.ts` (normalize).
- [X] T088 [P] [US7] `e2e/payload/items.spec.ts`: tạo, sửa, bản sao (`POST /graphql` + `POST`), xóa, archive item
  `bo_content`; `expect(normalize(bo)).toEqual(normalize(dir))`; chỉ `proxy-api`.
- [X] T089 [P] [US7] `e2e/payload/presets.spec.ts`: preset tự lưu (đổi cột, sắp xếp, option layout cho mỗi layout:
  mốc SC-005), bookmark tạo/cập nhật/xóa, bộ lọc ba cấp (so `filter` trong body).
- [X] T090 [P] [US7] `e2e/payload/versions.spec.ts`: tạo version, save, promote (có `mainHash`, `fields`), đổi tên, xóa.
- [X] T091 [P] [US7] `e2e/payload/comments-shares.spec.ts`: comment có mention, sửa, xóa; share tạo, sửa, invite, xóa.
- [X] T092 [P] [US7] `e2e/payload/utils.spec.ts`: xóa và sửa hàng loạt, `/utils/sort` (kéo sắp xếp tay; kéo không ổn
  định trên Directus app thì `test.fixme` có lý do và ghi trong spec), export tải về (so file), export thư viện, import CSV
  (so tên field multipart, tên file).
- [X] T093 [US7] CI `.github/workflows/ci.yml`: job `e2e-web` chạy spec `content-*` ở ba cấu hình (đã có bước chung), thêm
  bước `payload` + `content-parity-ui` chỉ khi `E2E_CONFIG=proxy-api`; job `quality` bước `web perf` thêm
  `src/layouts/tabular/perf.browser.test.ts` và cây (`PERF=1`); `timeout-minutes` của `e2e-web` xem lại (≤ 75 nếu được,
  không thì ghi lý do).
- [X] T094 [US7] Benchmark màn (FR-125, SC-003, `contracts/tests.md` §5): `tests/benchmark/docker-compose.yml` thêm hai
  service `backoffice-web` (proxy tới Directus và tới API mới, như profile `web` của parity); `tests/benchmark/src/web-content.ts`
  (Playwright chromium, đăng nhập, `/admin/content/bench_articles`: trang đầu đến dòng 25, đổi trang, sắp xếp
  `date_created` (index) và `title` (không index), lọc `status`; 11 lần, p95; cùng phép đo trên Directus app xen kẽ; số
  request mỗi thao tác; báo cáo markdown như `items.ts`; chặn khi app mới chậm hơn Directus app > 10 % p95);
  `tests/benchmark/project.json` target `web`; `.github/workflows/benchmark.yml` job `benchmark-web` (sau
  `benchmark-items`, dùng seed 10 triệu dòng); chạy `workflow_dispatch` một lần, ghi kết quả vào research R14.

**Checkpoint**: "các luồng chính làm được tương tự" có bằng chứng: E2E ba cấu hình, payload trùng, UI trùng, benchmark.

---

## Phase 10: Polish & đóng feature — Lượt 4

**Purpose**: a11y, bàn phím, manifest, tài liệu, duyệt recipe, cập nhật spec 012/013, đóng.

- [X] T095 [P] `src/modules/content/a11y.browser.test.ts` (FR-123, SC-006): axe 0 vi phạm `serious`/`critical` ở sáng và
  `html.dark` trên màn collection (năm layout), màn item với bốn sidebar, hộp so sánh, hộp xuất/nhập, menu version, cây
  collection; ngoại lệ chỉ thư viện bên thứ ba (FullCalendar, MapLibre attribution) và màu dữ liệu, ghi rule id và lý do.
- [X] T096 [P] `src/modules/content/keyboard.browser.test.ts` (SC-006): mỗi mục của `contracts/layouts.md` §5 có ca bàn
  phím (sắp xếp tay, cột, thẻ và cột kanban, chọn trên map, tay cầm live preview, điều kiện bộ lọc) và FR-115c, FR-115d
  (focus sau hành động, hộp xác nhận).
- [X] T097 [P] Manifest `tools/port-manifest/014-T*.json` đủ cho mọi file chép; `pnpm run check-port-headers` và
  `node tools/guard-directus-unchanged.mjs` xanh (SC-008).
- [X] T098 Recipe nháp Q-1 đến Q-12 đối chiếu với component đã làm (sửa recipe theo code, dòng "Deviation" khi khác chủ
  ý), `specs/014-content-module/design-review/README.md` cập nhật; chờ design owner (owner dự án) duyệt; khi duyệt, bảng
  Q của spec chuyển "Đóng" kèm tên recipe, bỏ marker "nháp (014)" (SC-009).
- [X] T099 Cập nhật spec: 014 (bảng D-67 đến D-74 và R-38 nếu có chờ tech lead duyệt, kết quả T002–T004 đã ghi, Status);
  `specs/012-backoffice-web-shell/spec.md` (D-40 phần Content và D-45 sidebar chi tiết: "đã gỡ ở 014");
  `specs/013-interfaces-displays/spec.md` (D-55, D-58: "đã gỡ ở 014"); `tests/parity/accepted-differences.ts` nếu có mục
  liên quan; `SPECKIT-GUIDE.md` prompt 015/016 thêm ghi chú bàn giao (preset Settings, `system-*` còn lại, chuyển hướng
  D-72).
- [X] T100 [P] `apps/web/README.md` (module Content, lệnh E2E và payload, benchmark web) và
  `specs/014-content-module/quickstart.md` chạy lại từng lệnh, sửa chỗ sai.
- [X] T101 **Đóng lượt 4 và feature**: `pnpm nx run-many -t lint typecheck test build check-bundle`, E2E ba cấu hình,
  payload, parity `web` xanh local; commit, push, CI xanh mọi job (kể cả `publish`); `[X]` mọi task; memory
  `project-014-content-module.md` cập nhật trạng thái Done và bài học; `graphify update .`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: không phụ thuộc. T002, T003, T004 phải xong trước task dùng kết quả của chúng (T017, T034, T044,
  T046, T059, T062, T075, T080).
- **Phase 2 (Foundational)**: sau Phase 1; chặn mọi story. T018 trước mọi layout; T023 trước T010, T024 và mọi E2E;
  T025 trước mọi spec E2E.
- **Phase 3 (US1)**: sau Phase 2. T031 trước T037; T032 trước T037; T033, T034 trước T035.
- **Phase 4 (US2)**: sau Phase 2; dùng route của T031 (US1). T041 trước T044; T045, T046 trước T047.
- **Phase 5 (US3)**: sau T037 (US1, màn collection). T050 trước T051; T051 trước T052; T053 trước T054. T055 đóng lượt 1.
- **Phase 6 (US4)**: sau lượt 1. T060 trước T061; T062 sau T057–T061 (drawer cần layout).
- **Phase 7 (US5)**: sau lượt 2 (theo thứ tự lượt; kỹ thuật chỉ cần US2). T066 trước T067; T068 trước T069; T070 trước
  T071, T072; T067, T073, T074, T075 trước T076.
- **Phase 8 (US6)**: sau lượt 3. T080, T081 trước T082.
- **Phase 9 (US7)**: sau Phase 8. T087 trước T088–T092.
- **Phase 10**: sau mọi story.

### User Story Dependencies

- **US1** (P1): nền của mọi màn; không phụ thuộc story khác.
- **US2** (P1): dùng route của US1; độc lập với US3 về chức năng.
- **US3** (P1): dùng màn collection của US1.
- **US4** (P2): dùng wrapper layout (Phase 2), màn collection (US1), bộ lọc (US3) cho drawer.
- **US5** (P2): dùng màn item (US2).
- **US6** (P2): dùng màn collection (US1), `FieldList`, `SystemFilter` (US3).
- **US7** (P2): dùng mọi story (đối chiếu toàn bộ).

### Within Each User Story

- Spec E2E viết trước (thất bại), rồi composable/utils, rồi component, rồi màn; test cạnh file trong cùng task.
- Task chép ghi manifest ngay trong task đó.

### Parallel Opportunities

- Phase 1: T007 song song với T002–T006.
- Phase 2: T008, T009, T012, T013, T015, T016, T017, T019, T020, T021, T022, T026 song song (khác file); T010 sau T023.
- US1: T027, T028, T029, T036 song song; T033 song song với T030.
- US2: T039, T040, T042, T043, T045, T046 song song.
- US3: T049, T050 song song; T051 → T052 tuần tự.
- US4: T056, T057, T058, T059, T060 song song.
- US5: T064, T065, T066, T068, T070, T073, T074 song song.
- US6: T078, T079, T080, T081 song song.
- US7: T083, T084, T085 song song; T088–T092 song song sau T087.
- Polish: T095, T096, T097, T100 song song.

---

## Parallel Execution Examples

```text
# Phase 2, cùng lúc (khác file):
T008 format-items-count, T009 utils chép, T012 store app/sidebar, T013 store translations,
T015 edits guard, T016 notices, T019 click handler, T020 SidebarDetail, T021 FieldList, T022 BoPagination

# US4, cùng lúc:
T057 cards, T058 calendar, T059 kanban, T060 geometry controls + style (rồi T061 map)

# US5, cùng lúc:
T066 use-revisions, T068 use-comparison, T070 use-versions, T073 comments, T074 shares

# US7 sau T087:
T088 payload items, T089 presets, T090 versions, T091 comments-shares, T092 utils
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2.
2. Phase 3 (US1): cây collection + bảng + preset tự lưu.
3. Dừng, kiểm: E2E T027, T028 ở ba cấu hình; người dùng duyệt dữ liệu như Directus (chưa sửa).

### Incremental Delivery

1. Lượt 1: US1 → US2 (sửa item, live preview) → US3 (lọc, bookmark) → T055 commit + CI xanh.
2. Lượt 2: US4 (bốn layout, drawer theo layout) → T063.
3. Lượt 3: US5 (sidebar, version, so sánh) → T077.
4. Lượt 4: US6 (xuất nhập, hàng loạt) → US7 (quyền, share, payload, benchmark) → Polish → T101.

Mỗi lượt là một bản dùng được; lượt sau không phá lượt trước (E2E của lượt trước chạy lại ở mỗi lượt).

---

## Ghi chú khi làm

- Lưu ý bàn giao từ 013 (research R12b): Editor.js render trong `requestIdleCallback` (browser test chờ block theo
  `data-id`); menu TinyMCE trong `BoDrawer` chưa kiểm: kiểm khi E2E item mở drawer item lồng (T039), ghi kết quả.
- Bài học repo: Directus chạy `CACHE_ENABLED=true` ở môi trường đối chiếu, nên E2E đọc trạng thái ghi qua DB host hoặc xóa
  cache dữ liệu trước khi so; đợi `PATCH` trả lời trước khi xóa cookie; đợi `trackPage` (500 ms) trước khi kiểm URL sau
  đăng nhập; Semgrep chặn cả test (`// nosemgrep: <rule> -- lý do`).
- Mọi chỗ code khác Directus có chủ ý: comment `// Backoffice:` + mã D/R trong spec; không thêm hành vi Directus không có
  ngoài D-69, D-74 (nếu T003 a cần).
