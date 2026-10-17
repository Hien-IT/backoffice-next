---

description: "Danh sách task cho feature 017: trình chỉnh sửa Flows (danh sách, trigger, canvas operation, log chạy)"
---

# Tasks: Trình chỉnh sửa Flows (danh sách, trigger, canvas operation, log chạy như Directus)

**Input**: Tài liệu thiết kế trong `/specs/017-flows-editor/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R12 + bảng kiểm), `data-model.md`, `contracts/`
(`api-calls.md` #178–#184, `components.md`, `tests.md`), `quickstart.md`, `checklists/` (`requirements.md`,
`release-gate.md` CHK001–CHK052 đã áp, `release-gate-proposals.md`).

**Điều kiện bắt đầu**: làm trên `main`. Nếu có session khác dùng chung checkout: `git add` theo đường dẫn, không
`git add -A`, không `stash`, `reset`, `checkout -- <file>`; `git pull --rebase` trước khi push; nhắn session khác trước
và sau mỗi push và trước `parity-tests:env-up`/`env-down`; E2E local chạy tuần tự trên DB chung.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có test cạnh file: `*.test.ts` (project `unit`, happy-dom) hoặc `*.browser.test.ts` (project `browser`,
  chromium) theo `contracts/tests.md` §1; coverage `apps/web` ≥ 60 % gộp.
- Feature không thêm hay sửa endpoint API (research bảng kiểm: `PATCH /flows/:id` lồng và `/revisions` đã có parity 009,
  008) nên không có test đối chiếu endpoint mới; nếu T002 thấy API mới lệch Directus thì mở task sửa `apps/api` kèm
  parity 009 (FR-111). Đối chiếu ở mức màn: E2E ba cấu hình (§3), bộ so payload `flows` và bộ so DB ở `proxy-api` (§4),
  dùng chéo trên Directus app (§5, SC-002, SC-003), parity UI (SC-004); `fixtures-seed.test.ts` giữ xanh với bộ mẫu mở
  rộng.
- Chỗ còn [Unverified] (D-105) kiểm ở T002; kết quả ghi vào `research.md` và spec.

**Organization**: Task nhóm theo user story của spec, xếp theo bốn lượt commit (FR-112, research R11): **Lượt 1** =
Phase 1, 2, 3 (US1); **Lượt 2** = Phase 4 (US2), 5 (US3); **Lượt 3** = Phase 6 (US4), 7 (US5); **Lượt 4** = Phase 8
(US6), 9 (Polish). Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh,
commit, push, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Gốc đường dẫn: `apps/web/src/` viết tắt `src/`; `apps/web-e2e/src/` viết tắt `e2e/`; `apps/web/fixtures/interfaces/`
  viết tắt `fixtures/`; màn flows ở `src/modules/settings/routes/flows/` viết tắt `flows/`; đường dẫn Directus tính từ
  `directus/app/src/modules/settings/routes/flows/` trừ khi ghi khác.
- File chép từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn>` (SFC: comment trong `<script setup>`);
  mỗi task chép ghi các cặp `{ "source", "dest" }` vào `tools/port-manifest/017-T###.json`; chạy
  `pnpm run check-port-headers`. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Component Vue KHÔNG chép nguyên (VI, XII): chép logic trong `<script setup>`, viết lại template theo recipe nháp
  (T004, T005) bằng Reka UI và component `Bo*`. File `.ts` chép nguyên được. Chỗ khác nguồn ghi `// Backoffice: <lý do>`
  (api → sdk `requestEndpoint`, `notify` → notice tại chỗ D-45, `getPublicURL` → `getApiUrl`, bỏ AI D-54, bỏ RTL).
- Giao diện: KHÔNG hex thô, KHÔNG palette ngoài theme (`check-raw-colors`); màu nhánh resolve `brand-500`/tối
  `brand-400`, reject `orange-500`/tối `orange-400` (Clarifications); màu flow (`color`) chỉ qua `style` từ giá trị
  runtime. Nút chỉ icon có `aria-label`; control có label liên kết. Canvas chỉ chuột như Directus (ngoại lệ a11y,
  FR-106), mọi thứ khác tới được bằng phím.
- Chuỗi giao diện dùng khóa Directus (sinh ở 012); overlay mới duy nhất `operations_mail_not_sent_notice` (D-106).
- Dữ liệu E2E: bộ mẫu `bo_flows` (T014) seed sau `bo_content` của 014; KHÔNG E2E nào chạy `bo_all_ops`; flow do test tạo
  đặt tên `web-e2e-<cfg>-<spec>-<n>` và xóa ở `afterAll`; spec điều khiển Directus app (payload, parity-ui, cross-use)
  vào `DIRECTUS_APP_SPECS` (chỉ chromium-1280).
- Sau mỗi phase: `pnpm nx run web:lint`, `web:typecheck`, `web:test`, `web:build` xanh.

---

## Phase 1: Setup (kiểm [Unverified], mốc Directus, recipe nháp)

**Purpose**: kiểm giả định còn lại, lấy mốc body ghi của Directus app, viết recipe nháp trước mọi task giao diện
(FR-107, SC-008).

- [ ] T001 Kiểm môi trường và bảng kiểm của research: `pnpm nx run parity-tests:env-up --vendor=postgres
      --profiles=app,web` lên được; xác nhận lại bảng "Kết quả kiểm" của `specs/017-flows-editor/research.md` bằng đọc
      code (không đổi gì thì ghi "T001 xác nhận 2026-10-xx"); dòng 017 của `CLAUDE.md` Active Technologies đúng với plan
- [ ] T002 Kiểm D-105 và hành vi Save của Directus trên Directus app 8155 (CHK052, R-47): tạo flow có vòng `resolve`
      bằng `PATCH /operations` trực tiếp, mở `/admin/settings/flows/<id>`, Edit Flow, đổi vị trí một panel, Save; ghi
      treo hay không vào `specs/017-flows-editor/research.md` (mục "Kết quả kiểm T002"); không treo → bỏ D-105 khỏi
      `spec.md` (Khác biệt, Edge Cases, FR-030) và ghi làm giống; xóa flow thử
- [ ] T003 [P] Mốc Directus app (CHK032, SC-006): trên Directus app 8155 chạy tay bằng Playwright ghi request
      (`page.on('request')`) bốn luồng: (1) tạo flow manual qua drawer, (2) thêm 4 operation (condition → resolve log,
      reject throw-error; log → resolve transform) và Save, (3) kéo panel transform, tháo rồi nối lại reject, Duplicate,
      Delete, Save, (4) Copy To; lưu body vào `e2e/payload/baselines/flows-*.json` (chuẩn hóa id thật → `key`, 5 ký tự
      ngẫu nhiên → `*`); so với body ở `data-model.md` §6 và spec US2-9; lệch thì sửa spec và data-model
- [ ] T004 [P] Recipe nháp Q-29 (canvas: lưới 18 px, nền sáng/tối, mũi tên `brand`/`orange` nét đứt cho reject, lớp
      mờ, nhánh gợi ý, vùng cuộn hai chiều trong `PrivateView fill`) vào `design-system/docs/layout-patterns.md` §13
      (mới) và dòng Settings của §7
- [ ] T005 [P] Recipe nháp Q-30 (panel operation, tay cầm 32 px, chân Trigger, menu tile, nhãn `(x:y)`, cắt dòng), Q-31
      (drawer operation), Q-32 (mục Logs, drawer log dòng thời gian), Q-33 (drawer flow hai tab, hộp Copy To, hộp xóa,
      trạng thái rỗng) vào `design-system/docs/component-specs.md` mục "Tier 3 recipes, nháp (017)"
- [ ] T006 [P] Ngoại lệ a11y canvas (FR-106, CHK045): thêm mục "017 canvas flow: chỉ chuột/pointer, cảm ứng không bảo
      đảm; tới được bằng phím: pencil, menu tile, select trạng thái Trigger, nút header, drawer" vào
      `design-system/qa/handoff-checklist.md` với trạng thái "chờ tech lead duyệt"

**Checkpoint**: T002, T003 xong trước test so body (T041, T090); T004–T006 xong trước task giao diện tương ứng.

---

## Phase 2: Foundational (registry operation, triggers, mở rộng component, bộ mẫu, API giả lập, harness)

**Purpose**: phần dùng chung cho mọi story. KHÔNG bắt đầu story nào trước khi phase này xong.

### Registry và định nghĩa

- [ ] T010 [P] Chép `ErrorCode` từ `directus/packages/errors/src/codes.ts` vào `src/operations/throw-error/error-codes.ts`
      (enum, header nguồn) và test `src/operations/throw-error/error-codes.test.ts` đọc `libs/errors/src/codes.ts` bằng
      `fs` và so danh sách mã (CHK050); manifest `tools/port-manifest/017-T010.json`
- [ ] T011 Chép 15 operation `directus/app/src/operations/<id>/index.ts` vào `src/operations/<id>/index.ts` (header
      nguồn; `defineOperationApp` identity inline trong `src/operations/define.ts`; `throw-error` dùng T010 với fallback
      `INTERNAL_SERVER_ERROR`, `500`, "An unexpected error occurred."; `trigger` dùng `useFlowsStore` của 012) và
      registry tĩnh `src/operations/index.ts` (`operations` sắp theo `id`, `getOperation(id)`) theo data-model §5;
      manifest `017-T011.json`
- [ ] T012 Mở rộng `apps/web/scripts/extract-directus-registry.mjs` trích `operations` (id, icon, name, description,
      options tĩnh; options hàm với bộ đối số `{}`, `{type:'template'}`, `{type:'wysiwyg'}`, `{operation:'sign'}`,
      `{operation:'verify'}`, `{operation:'decode'}`, `{iterationMode:'batch'}`; overview với options mẫu) vào
      `fixtures/directus-registry.json`; test `src/operations/registry.test.ts` so registry của T011 với fixture
      (FR-044, SC-006)
- [ ] T013 [P] Chép `constants.ts` và `triggers.ts` vào `flows/constants.ts`, `flows/triggers.ts` (`getPublicURL()` →
      `getApiUrl()`, `// Backoffice: CHK013`) và port `triggers.test.ts` thành `flows/triggers.test.ts` (thêm ca URL
      webhook `${getApiUrl()}flows/trigger/<id>`); manifest `017-T013.json`

### Mở rộng component

- [ ] T014 Bộ mẫu `bo_flows` (FR-103, data-model §9): `fixtures/seed.mjs` thêm `bo_all_ops` (cây theo data-model §9,
      sáu operation có tác dụng phụ dưới reject của `log`), `bo_webhook`, `bo_schedule`, `bo_child`, `bo_event`,
      `bo_orphan` (mỗi flow một `POST /flows {…, operations: [cây lồng]}`; `bo_all_ops.trigger` trỏ `bo_child`), chạy
      `bo_all_ops` 3 lần (`reason` `ok`, `ok`, `fail`) với thử lại 10 × 500 ms khi API chưa nạp flow; dọn theo tên;
      `fixtures/export.mjs` xuất `snapshot/flows.json` (mở rộng), `snapshot/operations.json`, `snapshot/revisions.flows.json`;
      `tests/parity/src/web/fixtures-seed.test.ts` so hai app bỏ `directus_revisions`, `directus_activity`; chạy seed trên
      8155 và 8156 rồi commit snapshot
- [ ] T015 API giả lập: `src/test-utils/fetch.ts` thêm #178–#184 vào `KNOWN_REQUESTS` và `mockFixtureApi` trả
      `snapshot/flows.json`, `operations.json`, `revisions.flows.json` (lọc `item`, `page`, `aggregate`), nhận body lồng
      `PATCH /flows/<id>` và cho phép test ép 500 (contracts/tests §2)
- [ ] T016 [P] `src/modules/settings/routes/data-model/field-detail/shared/ExtensionOptions.vue`: thêm `type:
      'operation'`, prop `collection?`, `field?`; khi `operation` không gọi `useFieldDetailStore`; test
      `ExtensionOptions.test.ts` thêm ca `operation` (mảng options, không store field) và giữ ca cũ xanh (FR-042)
- [ ] T017 [P] Port `directus/app/src/components/v-workspace.vue`, `v-workspace-tile.vue` thành
      `src/components/workspace/BoWorkspace.vue`, `BoWorkspaceTile.vue` (kéo pointer bám lưới, throttle 20 ms, nhãn
      `(x-1:y-1)`, menu tile `BoMenu` + pencil, kích thước `(x+width+25)×18` khi sửa và `(x+width−1)×18` khi xem,
      `data-panel-key`, `data-pos-x`, `data-pos-y`; không resize, không zoom) với test
      `src/components/workspace/BoWorkspace.browser.test.ts`; manifest `017-T017.json`
- [ ] T018 [P] Overlay `src/lang/overlay/en-US.ts`, `vi-VN.ts`: `operations_mail_not_sent_notice` với chữ của spec
      FR-041 (D-106); `src/lang/overlay.test.ts` thêm ca hai ngôn ngữ

### Harness E2E và ngân sách

- [ ] T019 [P] E2E harness: `e2e/helpers/allowed-paths.ts` thêm #178–#184; `e2e/helpers/flows.ts` (mới: `openFlow`,
      `dragPanel`, `linkHandle`, `readGrid`, `countArrows`, `openOperation`, `createTempFlow`, `deleteTempFlows`);
      `e2e/helpers/fixtures.ts` thêm `FLOWS`; `e2e/helpers/db-rows.ts` thêm `FLOWS_TABLES` và chuẩn hóa ánh xạ
      `flow`/`operation`/`resolve`/`reject` → tên/key; `e2e/helpers/directus-app.ts` thêm `openDirectusFlow`,
      `readDirectusGrid` (`--pos-x/--pos-y`), `countDirectusArrows`; `e2e/helpers/payload.ts` thêm `normalizeFlowsBody`
      (contracts/components §6)
- [ ] T020 [P] `apps/web/scripts/check-bundle.mjs`: `BUDGET_017 = BUDGET_016 + 20 * 1024`, `LAZY_BUDGETS_017` (FlowRoute
      60 KB, registry 25 KB, LogsDrawer 15 KB gzip) gộp vào `LAZY_BUDGETS`; test của script cập nhật

**Checkpoint**: registry, triggers, `ExtensionOptions`, workspace, bộ mẫu, mock và harness sẵn sàng.

---

## Phase 3: User Story 1 - Danh sách flow, tạo flow và chọn trigger, bật tắt, xóa (Priority: P1) 🎯 MVP — Lượt 1

**Goal**: bảng flow, drawer flow hai tab với năm trigger, menu đổi trạng thái/sửa/xóa (spec US1, FR-010–FR-016).

**Independent Test**: spec US1 Independent Test: `bo_manual` tạo ở app mới mở được trên Directus app với cùng trigger.

### Tests cho User Story 1

- [ ] T030 [P] [US1] `flows/FlowsOverviewRoute.browser.test.ts`: cột, sắp xếp mặc định và bỏ sắp xếp, click/Ctrl-click,
      menu (`PATCH {status}` rồi `GET /flows`; lỗi 500 → hộp lỗi, store không đổi), hộp xóa (`DELETE`, lỗi giữ dòng),
      nút tạo khóa khi không quyền `create`, trạng thái rỗng, axe sáng/tối
- [ ] T031 [P] [US1] `flows/FlowDrawer.browser.test.ts`: mặc định flow mới, tab 2 khóa khi tên rỗng, Next/Save/Finish
      theo tab, 5 trigger và field ẩn/hiện theo `triggers.ts`, reset options khi đổi trigger và khi đổi `type` của
      event, body `POST /flows?fields=id` và `PATCH` cả body, lỗi lưu giữ drawer và giá trị, `startTab trigger_setup`,
      axe hai tab
- [ ] T032 [P] [US1] `src/modules/settings.test.ts`: `/settings/flows` → `settings-flows-collection` (component thật,
      không `Frame`); `SettingsNavigation.test.ts` giữ mục Flows

### Implementation cho User Story 1

- [ ] T033 [US1] `src/modules/settings.ts`: khối `flows` thay `Frame` bằng `settings-flows-collection` →
      `() => import('./settings/routes/flows/FlowsOverviewRoute.vue')` (FR-001; route item ở T050); sửa comment D-92 và
      comment "khung" ở `src/utils/get-item-route.ts`
- [ ] T034 [US1] `flows/FlowDrawer.vue` port `flow-drawer.vue` (BoDrawer persistent, `BoTabs orientation="vertical"`,
      `BoFancySelect` trigger, `BoForm` options đã `translate`, `select-icon`, `select-color`, select accountability, lưu
      và lỗi như FR-012, emit `done(id)`/`cancel`) theo recipe Q-33; manifest `017-T034.json`
- [ ] T035 [US1] `flows/FlowsOverviewRoute.vue` port `overview.vue` (`PrivateView fill`, `BoTable` 4 cột, `BoMenu` dòng,
      `BoDialog` xóa, `FlowDrawer`, sắp xếp `sortBy`, không gọi API khi vào route, `hydrate()` sau ghi, điều hướng sau
      tạo FR-015) theo recipe Q-2, Q-33; manifest `017-T035.json`
- [ ] T036 [US1] E2E `e2e/settings-flows-overview.spec.ts` (contracts/tests §3): bảng `bo_flows`, sắp xếp, menu đổi trạng
      thái flow tạm, drawer tạo flow tạm với mỗi trigger, sửa, xóa, lỗi lưu (`page.route` trả 500), điều hướng sau tạo;
      chromium 768/1280 ba cấu hình
- [ ] T037 [US1] Đóng lượt 1: lint, typecheck, `web:test`, `web:build`, `check-bundle`, `check-port-headers`,
      `check-raw-colors`, E2E `settings-*` + `content-sidebar` xanh ở `proxy-api` local; commit
      `feat(017): flows overview, flow drawer and triggers (wave 1)`; push; CI xanh; `graphify update .`

**Checkpoint**: US1 dùng được độc lập; flow tạo ở app mới mở được trên Directus app (kiểm tay, tự động ở T091).

---

## Phase 4: User Story 2 - Canvas trình sửa: panel, nối resolve/reject, kéo vị trí, lưu một lần (Priority: P1) — Lượt 2

**Goal**: trang flow với canvas, mũi tên, staging, Save một `PATCH /flows/:id` (spec US2, FR-020–FR-032).

**Independent Test**: spec US2 Independent Test (vị trí, mũi tên, `directus_operations` bằng Directus app).

### Tests cho User Story 2

- [ ] T040 [P] [US2] Port 9 test arrows `components/arrows/{lib,utils}/*.test.ts` vào `flows/arrows/{lib,utils}/` cạnh
      file port ở T043; chạy đỏ trước
- [ ] T041 [P] [US2] `flows/use-flow-editor.test.ts`: 12 kịch bản SC-006 (thêm con resolve, con reject, nối lại sang cha
      khác, tháo, xóa có con, xóa operation đầu, nhân bản, đổi vị trí, đổi trạng thái, Save rỗng, Save sau xóa + thêm
      cùng key, vòng dữ liệu → lỗi D-105) so body `PATCH /operations` và `PATCH /flows/:id` với
      `e2e/payload/baselines/flows-*.json` của T003; Save lỗi giữ staging và Save lại gửi lại (R-47); `hasEdits` (R-44)
- [ ] T042 [P] [US2] `flows/FlowRoute.browser.test.ts`: chế độ xem `bo_all_ops` (15 panel, số mũi tên, lớp mờ của
      `bo_orphan`, overview, trigger null), Edit Flow, kéo panel, "+" → route `+`, kéo nối/tháo, Duplicate, Copy To
      (`POST /operations`, lỗi giữ hộp), Delete, Save, Clear Changes, guard rời trang, `Ctrl/Cmd+S`, Delete Flow (về danh
      sách kể cả lỗi), focus sau Edit/Save/Clear, sao chép URL webhook (`use-clipboard`), axe hai chế độ sáng/tối

### Implementation cho User Story 2

- [ ] T043 [US2] Chép `components/arrows/{lib,utils}/*.ts` và `types.ts` vào `flows/arrows/` nguyên vẹn (header nguồn,
      bỏ nhánh RTL nếu có trong lib và ghi `// Backoffice`); T040 xanh; manifest `017-T043.json`
- [ ] T044 [P] [US2] `flows/components/Arrows.vue` port `arrows/arrows.vue` (SVG `aria-hidden`, lớp `stroke-brand-500
      dark:stroke-brand-400` / `stroke-orange-500 dark:stroke-orange-400`, reject `stroke-dasharray`, `opacity-50` khi
      mờ, `motion-reduce:transition-none`) theo Q-29
- [ ] T045 [P] [US2] `flows/components/OptionsOverview.vue` port `options-overview.vue` (`<dl>` nội suy chữ, tiêu đề
      `name` với tooltip `key`, Trigger `t('triggers.<type>.name')`, nút sao chép khi `copyable` và `isCopySupported`)
- [ ] T046 [US2] `flows/use-flow-editor.ts` port script `flow.vue` (staging, `stageOperation`, `duplicateOperation`,
      `copyTo`, `deleteOperation`, `onDrag`, `onLink` từ chối vòng, `isLoner`, `getTrees` với `Set` đã thăm D-105,
      `saveChanges`, `clearChanges`, `hasEdits`) theo data-model §6; T041 xanh; manifest `017-T046.json`
- [ ] T047 [US2] `flows/components/Operation.vue` port `components/operation.vue` (header icon và tên loại, màu
      `brand`/`orange`, tay cầm `<button>` 32 px resolve/reject/attachment, nút "+" khi hover, kéo mũi tên pointer,
      chân Trigger chấm + select trạng thái, sr-only trạng thái mờ, error boundary `unexpected_error`) theo Q-30
- [ ] T048 [US2] `flows/components/CopyToDialog.vue` (BoDialog thường, select flow khác từ store, notice
      `no_other_flows_copy`, nút khóa khi rỗng)
- [ ] T049 [US2] `flows/FlowRoute.vue` port template `flow.vue` (`PrivateView fill`, `PageHeader` hai chế độ, tiêu đề
      chấm trạng thái, `BoWorkspace` + `Operation` + `Arrows`, `RouterView` không tên với `operation`,
      `existing-operation-keys`, `flow`, `@save`, `@cancel`, hộp Clear Changes, hộp xóa flow, `CopyToDialog`,
      `FlowDrawer startTab trigger_setup` cho pencil Trigger, `use-edits-guard` `ignorePrefix`, `use-shortcut` `meta+s`,
      `DetailPanel` có slot cho Logs ở T072); manifest `017-T049.json`
- [ ] T050 [US2] `src/modules/settings.ts`: thêm `settings-flows-item` (`:primaryKey`, `props: true`, `beforeEnter` tra
      store, thiếu → `notFound(to)`) và con `settings-flows-operation` (`:operationId`, `props: true`,
      `meta.isFloatingView`, component `OperationDetail.vue` của T061); `src/modules/settings.test.ts` thêm ca item,
      operation `+`, id không có → not-found
- [ ] T051 [US2] E2E `e2e/settings-flows-editor.spec.ts` (contracts/tests §3): xem `bo_all_ops`; trên flow tạm: kéo panel,
      "+" thêm, kéo nối/tháo (cả hai ví dụ US2-6), Duplicate, Copy To, Delete, Save (so body bằng `recordWrites`), Clear
      Changes, guard, Ctrl+S, Delete Flow; chromium 768/1280 ba cấu hình + firefox/webkit-1280 cùng origin; thêm vào
      biểu thức spec lõi của `apps/web-e2e/playwright.config.ts`; webkit flake → `test.fixme` có lý do (CHK048)

**Checkpoint**: canvas dùng được với operation có sẵn; "+" mở drawer ở Phase 5.

---

## Phase 5: User Story 3 - Drawer operation: loại, tên và key, form options của 15 operation (Priority: P1) — Lượt 2

**Goal**: drawer operation nổi trên canvas với 15 loại và form options đúng nguồn (spec US3, FR-040–FR-045).

**Independent Test**: spec US3 Independent Test (field mỗi loại khớp nguồn; options ghi bằng Directus app).

### Tests cho User Story 3

- [ ] T060 [P] [US3] `flows/OperationDetail.browser.test.ts`: tiêu đề tạo/sửa, Name/Key (placeholder, key theo tên,
      `dbSafe`, trùng → `operation_key_unique_error`), 15 loại (số field, điều kiện ẩn của `json-web-token`, `mail`,
      `trigger`), notice D-106 ở `mail` hai ngôn ngữ, đổi loại → options `{}`, loại lạ → `operation_not_found`, Done emit
      `{...defaults, ...options}`, Cancel; axe với exec, mail, trigger

### Implementation cho User Story 3

- [ ] T061 [US3] `flows/OperationDetail.vue` port `components/operation-detail.vue` (`useDialogRoute`, `BoDrawer
      persistent`, `BoInput dbSafe`, `@sindresorhus/slugify`, `BoFancySelect` 15 loại, `ExtensionOptions
      type="operation"` với options đã gọi hàm và `translate`, `getDefaultValuesFromFields`, `BoNotice` D-106 khi `mail`)
      theo Q-31; nối `@save` vào `stageOperation` của T046 (staging, vị trí con theo cha, US2-5, US2-12); manifest
      `017-T061.json`
- [ ] T062 [US3] E2E `e2e/settings-flows-operations.spec.ts`: mở drawer từng operation của `bo_all_ops` và so field với
      bảng data-model §5 (nhãn, loại input), key tự sinh và trùng trên flow tạm, loại lạ ở `bo_orphan`, notice `mail`;
      "+" nhiều lần trước Save (US2-12) rồi Save; chromium ba cấu hình
- [ ] T063 [US3] Đóng lượt 2: bốn cổng, `check-bundle` (chunk canvas, registry), `check-port-headers`, E2E
      `settings-flows-*` + `settings-*` xanh ở `proxy-api` local; commit `feat(017): flow canvas, operation drawer and the
      15 operations (wave 2)`; push; CI xanh; `graphify update .`

**Checkpoint**: tạo và sửa flow đầy đủ trên app mới (SC-002 phần dữ liệu, tự động ở T091).

---

## Phase 6: User Story 4 - Log các lần chạy (Priority: P2) — Lượt 3

**Goal**: mục Logs và drawer log từ `/revisions` (spec US4, FR-050–FR-055).

**Independent Test**: spec US4 Independent Test (cùng số đếm, nhóm, bước ở hai app).

### Tests cho User Story 4

- [ ] T070 [P] [US4] `flows/components/LogsSidebarDetail.browser.test.ts`: request đếm khi mount và danh sách khi mở (query
      #183, #184), badge `abbreviateNumber`, `BoProgressLinear` khi nạp, nhóm ngày, icon theo bước cuối, lọc
      `show_failed_only` trang hiện tại, `no_logs`, `no_logs_on_page`, phân trang, `data` null
- [ ] T071 [P] [US4] `flows/components/LogsDrawer.browser.test.ts`: tiêu đề thời gian, bước Trigger (Options =
      `flow.options`, Payload, Accountability), bước operation (tên, key, loại, Options, Payload, chấm màu theo status),
      operation đã xóa, `--redacted--` hiện nguyên, không `persistent`, axe sáng/tối

### Implementation cho User Story 4

- [ ] T072 [US4] `flows/components/LogsSidebarDetail.vue` port `logs-sidebar-detail.vue` trên `use-revisions` (014) với
      `{action: 'run', full: true}`, `RevisionsDateGroup`, `BoPagination`; gắn vào `DetailPanel` của `FlowRoute.vue`
      theo Q-32; manifest `017-T072.json`
- [ ] T073 [US4] `flows/components/LogsDrawer.vue` port `logs-drawer.vue` (`BoDrawer`, `<ol>` bước, `BoDetail`, `<pre>`
      `JSON.stringify(v, null, 2)`) theo Q-32; manifest `017-T073.json`
- [ ] T074 [US4] E2E `e2e/settings-flows-logs.spec.ts`: badge 3 của `bo_all_ops` (seed), nhóm ngày, 2 resolve/1 reject,
      lọc, drawer lần reject (bước `throw-error`); chromium ba cấu hình

---

## Phase 7: User Story 5 - Nút chạy thủ công với flow do app mới tạo (Priority: P2) — Lượt 3

**Goal**: flow manual tạo ở app mới chạy được từ trang item/danh sách ở hai app (spec US5, FR-060–FR-062).

**Independent Test**: spec US5 Independent Test.

- [ ] T080 [P] [US5] `src/composables/use-run-manual-flow.test.ts` thêm ca flow mới xuất hiện sau `flowsStore.hydrate()`;
      `src/interfaces/_system/system-manual-flow-select/*.test.ts` thêm ca flow manual mới (FR-062)
- [ ] T081 [US5] Rà các đường ghi của 017 (`FlowsOverviewRoute`, `FlowDrawer`, `FlowRoute` Save/Copy To/Delete) đều gọi
      `flowsStore.hydrate()` sau khi thành công (FR-060); thiếu thì sửa
- [ ] T082 [US5] E2E `e2e/settings-flows-manual.spec.ts`: tạo flow manual tạm (location `both`, xác nhận với `reason` bắt
      buộc) và flow `async` qua drawer; mở `/content/bo_content` và một item: nút, tooltip, `disabled`, hộp xác nhận,
      `POST /flows/trigger/:id`, notice; Logs của flow tạm có lần chạy mới; chromium ba cấu hình
- [ ] T083 [US5] Đóng lượt 3: bốn cổng, `check-bundle` (drawer log), E2E `settings-flows-*`, `content-sidebar`
      xanh ở `proxy-api` local; commit `feat(017): flow logs and manual run end to end (wave 3)`; push; CI xanh;
      `graphify update .`

---

## Phase 8: User Story 6 - Đối chiếu với Directus, E2E ba cấu hình, dùng chéo (Priority: P2) — Lượt 4

**Goal**: bằng chứng tiêu chí chấp nhận (spec US6, FR-100–FR-108, SC-002–SC-008).

**Independent Test**: spec US6 Independent Test.

### Tests cho User Story 6

- [ ] T090 [P] [US6] Bộ so payload `e2e/payload/flows.spec.ts` (proxy-api, `DIRECTUS_APP_SPECS`): 10 kịch bản của
      contracts/tests §4 trên Directus app 8155 rồi Backoffice, `recordWrites` + `normalizeFlowsBody`, mốc T003, bộ so DB
      `FLOWS_TABLES` sau (1)–(7), (10); seed lại giữa hai lượt
- [ ] T091 [P] [US6] Dùng chéo `e2e/settings-flows-cross-use.spec.ts` (proxy-api, thêm vào `DIRECTUS_APP_SPECS` của
      `apps/web-e2e/playwright.config.ts`): năm bước của contracts/tests §5 (SC-002, SC-003)
- [ ] T092 [P] [US6] Parity UI `e2e/settings-parity-ui.spec.ts` thêm bảng flow, trang `bo_all_ops`, drawer flow, drawer
      operation theo SC-004 (a)–(e); URL webhook so phần đường dẫn; ghi khác biệt được phép (D-101, D-106)
- [ ] T093 [P] [US6] Perf `flows/perf.browser.test.ts` (`PERF=1`, `machineFactor()`): canvas 50 operation/60 mũi tên
      < 500 ms, `generateArrows` 50 panel < 8 ms mỗi lần di chuyển, drawer operation < 200 ms, log 10 dòng < 300 ms, số
      request mỗi thao tác của FR-108; thêm vào bước web perf của `.github/workflows/ci.yml`
- [ ] T094 [P] [US6] A11y E2E `e2e/a11y.spec.ts` thêm bảng flow, trang flow hai chế độ, drawer flow hai tab, drawer
      operation (exec, mail, trigger), Logs và drawer log ở sáng và tối (FR-106, SC-008)

### Implementation cho User Story 6

- [ ] T095 [US6] Sửa lệch do T090–T094 tìm ra (body, DOM, a11y, perf) theo hành vi Directus; lệch thật không sửa được
      ghi R-xx mới trong `specs/017-flows-editor/spec.md` kèm bằng chứng

---

## Phase 9: Polish & đóng feature — Lượt 4

- [ ] T100 [P] Tài liệu: spec 016 (D-92 "đã gỡ ở 017") và 014 (D-72 phần `directus_flows` "đã gỡ ở 017") trong
      `specs/01{4,6}-*/spec.md`; `SPECKIT-GUIDE.md` ghi chú cho 018 (`BoWorkspace*` dùng lại cho Insights;
      `/content/directus_operations` không chuyển hướng như Directus)
- [ ] T101 [P] Recipe Q-29 đến Q-33 hoàn thiện theo code và gửi design owner duyệt; `design-system/qa/handoff-checklist.md`
      đạt (gồm ngoại lệ canvas của T006); ghi trạng thái Q-29 đến Q-33 trong `specs/017-flows-editor/spec.md`
- [ ] T102 Bảng trạng thái khác biệt D-105, D-106, R-43 đến R-47, ngoại lệ a11y canvas và mục "Cần xác nhận" (code đã
      làm, duyệt) trong `specs/017-flows-editor/spec.md` như 016 T122; tech lead duyệt (SC-010)
- [ ] T103 Đóng feature: mọi cổng của T083 + payload, cross-use, parity UI, axe, perf, bundle xanh; coverage ≥ 60 %;
      commit `test(017): flows payload, cross-use and parity suites, close feature (wave 4)`; push; CI xanh;
      `graphify update .`; cập nhật memory dự án (feature 017 đóng, run id CI)

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: T001 trước mọi task; T002, T003 cần env parity (song song sau T001); T004–T006 song song (chỉ tài liệu).
- Phase 2: sau T001. T010, T013, T016, T017, T018, T019, T020 song song; T011 sau T010; T012 sau T011; T014 → T015.
- Phase 3 (US1): sau Phase 2 và T005 (Q-33); T037 đóng lượt 1.
- Phase 4 (US2): sau lượt 1, T003 (mốc cho T041) và T004, T005 (Q-29, Q-30); T043 trước T044, T046; T046 trước T047,
  T049; T049 trước T050, T051.
- Phase 5 (US3): sau T049, T050 (route con và staging); T063 đóng lượt 2.
- Phase 6 (US4) và Phase 7 (US5): sau lượt 2; song song với nhau; T083 đóng lượt 3.
- Phase 8, 9: sau lượt 3; T103 đóng feature.

### User Story Dependencies

- US1 → không phụ thuộc story khác (MVP).
- US2 → US1 (route `flows`, `FlowDrawer` cho pencil Trigger).
- US3 → US2 (route con `:operationId` trên `FlowRoute`, staging).
- US4 → US2 (`DetailPanel` của `FlowRoute`); độc lập với US3.
- US5 → US1 (tạo flow manual); độc lập với US2–US4 về code.
- US6 → tất cả.

### Within Each User Story

Test trước (viết test đỏ), rồi lib/composable → component → route → E2E → payload; mỗi task chép kèm manifest và header
nguồn; sau mỗi phase chạy bốn cổng.

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005, T006.
- Phase 2: T010, T013, T016, T017, T018, T019, T020.
- US1: T030, T031, T032 (test).
- US2: T040, T041, T042 (test); T044, T045 sau T043.
- US4: T070, T071 (test). US5: T080. US4 và US5 song song.
- US6: T090, T091, T092, T093, T094. Polish: T100, T101.

## Parallel Execution Examples

```text
Lượt 1, Phase 2 (sau T001):
  song song: T010 error codes | T013 triggers | T016 ExtensionOptions | T017 workspace | T018 overlay | T019 harness | T020 bundle
  rồi: T011 15 operation → T012 registry test; T014 seed → T015 mock API

Lượt 2, Phase 4–5:
  song song: T040 arrows tests | T041 use-flow-editor tests | T042 FlowRoute test
  rồi: T043 arrows lib → song song T044 Arrows | T045 OptionsOverview; T046 use-flow-editor
  rồi: T047 Operation → T048 CopyTo → T049 FlowRoute → T050 route → T060 → T061 OperationDetail → T051, T062 E2E → T063

Lượt 4, Phase 8:
  song song: T090 payload | T091 cross-use | T092 parity UI | T093 perf | T094 a11y
  rồi: T095 sửa lệch → T100, T101 → T102 → T103
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 → Phase 3 (US1): bảng flow, drawer flow, năm trigger; E2E `settings-flows-overview` xanh ba cấu
   hình; flow tạo ở app mới mở được trên Directus app.

### Incremental Delivery

1. Lượt 1: US1 (quản lý flow và trigger; canvas còn là route không tìm thấy).
2. Lượt 2: US2 + US3 (canvas và drawer operation; SC-002 phần dữ liệu).
3. Lượt 3: US4 + US5 (log, nút chạy thủ công hai đầu; SC-003).
4. Lượt 4: US6 + Polish (bằng chứng tiêu chí chấp nhận, duyệt, đóng).

## Ghi chú khi làm

- (trống; ghi kết quả từng lượt ở đây như 016)
