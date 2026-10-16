---

description: "Danh sách task cho feature 016: module Settings (data model, quyền, cài đặt dự án, presets, translations như Directus)"
---

# Tasks: Module Settings (data model, quyền, cài đặt dự án, presets, translations như Directus)

**Input**: Tài liệu thiết kế trong `/specs/016-settings-module/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R13), `data-model.md`, `contracts/`
(`api-calls.md` #137–#177, `components.md`, `tests.md`), `quickstart.md`, `checklists/` (`requirements.md`,
`release-gate.md` CHK001–CHK105 đã áp, `release-gate-proposals.md`).

**Điều kiện bắt đầu**: phiên 015 báo "đã đóng" và CI xanh ở commit cuối của 015 (T001). Trước đó chỉ sửa
`specs/016-*`. Dùng chung checkout `main` với session khác: `git add` theo đường dẫn, không `git add -A`, không
`stash`, `reset`, `checkout -- <file>`; `git pull --rebase` trước khi push; nhắn session khác trước và sau mỗi push và
trước `parity-tests:env-up`/`env-down`; E2E local chạy tuần tự trên DB chung.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có test cạnh file: `*.test.ts` (project `unit`, happy-dom) hoặc `*.browser.test.ts` (project `browser`,
  chromium) theo `contracts/tests.md` §1; coverage `apps/web` ≥ 60 % gộp.
- Feature không thêm hay sửa endpoint API nên không có test đối chiếu endpoint mới; nếu T004 thấy API mới lệch Directus
  khi lưu quan hệ lồng thì T075 sửa `apps/api` kèm test đối chiếu 004. Đối chiếu ở mức màn: E2E ba cấu hình
  (`contracts/tests.md` §3), bộ so payload `settings` và bộ so DB ở `proxy-api` (§4), dùng chéo trên Directus app (§5,
  SC-002, SC-003), parity UI (SC-004); `fixtures-seed.test.ts` của 013 giữ xanh với bộ mẫu mở rộng.
- Chỗ spec/research đánh [Unverified] có task kiểm sớm (T002, T003, T004); kết quả ghi vào research.md và spec.

**Organization**: Task nhóm theo user story của spec, xếp theo năm lượt commit (FR-112, research R11): **Lượt 1** =
Phase 1, 2, 3 (US1), 4 (US2); **Lượt 2** = Phase 5 (US3); **Lượt 3** = Phase 6 (US4); **Lượt 4** = Phase 7 (US5), 8
(US6); **Lượt 5** = Phase 9 (US7), 10 (Polish). Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test,
build, E2E hiện có + mới xanh, commit, push, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Gốc đường dẫn: `apps/web/src/` viết tắt `src/`; `apps/web-e2e/src/` viết tắt `e2e/`; `apps/web/fixtures/interfaces/`
  viết tắt `fixtures/`. Màn Settings ở `src/modules/settings/` (`routes/<nhóm>/`, `components/`), interface ở
  `src/interfaces/_system/<id>/`, đường dẫn Directus tính từ `directus/app/src/modules/settings/` trừ khi ghi khác.
- File chép từ `directus/app/src` (hoặc `directus/packages/system-data`) PHẢI có dòng đầu `// Ported from directus/<đường
  dẫn>` (SFC: comment trong `<script setup>`); mỗi task chép ghi các cặp `{ "source", "dest" }` vào
  `tools/port-manifest/016-T###.json`; chạy `pnpm run check-port-headers`. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Component Vue KHÔNG chép nguyên (VI, XII): chép logic trong `<script setup>`, viết lại template theo recipe
  design-system bằng Reka UI. File `.ts` chép nguyên được. Chỗ khác nguồn ghi `// Backoffice: <lý do>` (api → sdk,
  `notify` → `useNotices` D-66, khóa localStorage `backoffice-`, bỏ AI/MCP D-41, D-93).
- Giao diện theo recipe nháp (T005–T007): KHÔNG hex thô, KHÔNG palette ngoài theme (`check-raw-colors`); màu dữ liệu
  (icon collection, swatch) chỉ qua `style` từ giá trị runtime. Nút chỉ icon có `aria-label`; control có label liên kết;
  kéo thả có menu bàn phím (D-96).
- Chuỗi giao diện dùng khóa Directus (sinh ở 012); không overlay mới (dòng "Backoffice" của D-95 là chuỗi tĩnh).
- Dữ liệu E2E: `bo_settings` (T019) seed sau `bo_users` của 015; tên do test tạo theo `DATA_PREFIX`; mỗi spec dọn
  collection, field, role, policy, preset, translation nó tạo ở `afterEach`/`afterAll`; DDL thật chạy tuần tự trong một
  worker; spec điều khiển Directus app (payload, parity-ui, cross-use) vào `DIRECTUS_APP_SPECS` (chỉ chromium-1280).
- Sau mỗi phase: `pnpm nx run web:lint`, `web:typecheck`, `web:test`, `web:build` xanh.

---

## Phase 1: Setup (điều kiện vào, kiểm [Unverified], mốc Directus, recipe nháp)

**Purpose**: xác nhận 015 đóng, kiểm các giả định đọc từ code Directus, lấy mốc body ghi của Directus app, viết recipe
nháp trước mọi task giao diện (FR-107, SC-008).

- [x] T001 Xác nhận điều kiện bắt đầu (FR-111, CHK101): tin nhắn phiên 015 "đã đóng", CI xanh ở commit cuối của 015
      (`gh run list --branch main`); chạy `.specify/scripts/bash/update-agent-context.sh claude` với
      `SPECIFY_FEATURE=016-settings-module` rồi sửa dòng Active Technologies theo câu soạn sẵn ở `quickstart.md` §Đóng
      feature (`CLAUDE.md`); ghi run id vào `specs/016-settings-module/research.md` R11; không sửa `apps/web` trước khi
      xong task này
- [x] T002 Kiểm [Unverified] bằng đọc code và lệnh, ghi kết quả vào `specs/016-settings-module/research.md` (mục "Kết
      quả kiểm T002") và sửa spec nếu lệch: `useItem` với `directus_collections` (khóa chuỗi, endpoint `/collections`)
      và store collections có `directus_*`, store fields có `meta.system` (R2, R7, CHK099); `BoSortableList` lồng hai
      cấp thả vào danh sách rỗng (R3); `fixtures/directus-registry.json` có bao nhiêu `_system` và `optionsKind` của
      `list`, `map`, display `translations`, `related-values` (R4, CHK102); `jiti` import được
      `directus/app/src/app-permissions.ts` (R5); `DIRECTUS_APP_SPECS` trong `apps/web-e2e/playwright.config.ts` (R9);
      khóa i18n của R10 có trong `src/lang` `vi-VN` (chạy `keys.test.ts`); hành vi Directus nêu ở spec FR-024 (nhân bản
      trùng tên), FR-028 (mặc định helper translations), FR-030 (`startEditing` field không có, `?type=` lạ), FR-033
      (`suffix` của `autoKey`), FR-041 (thứ tự vòng lặp của `save()`), FR-052 (role 404), FR-074 (`module-bar.vue` có
      lọc scheme URL không), FR-086 (unique `key`+`language`), Edge Cases (`parent` vòng của role, xóa field là
      `sort_field`), `updateFields` bộ đếm theo collection (CHK041) Kết quả nào lệch lời giải đã áp của
      `checklists/release-gate.md` thì bỏ dấu `[x]` của mục đó, sửa spec theo hành vi Directus thật rồi đánh dấu lại.
- [x] T003 [P] Mốc Directus app (CHK100): với `parity-tests:env-up --profiles=app`, chạy tay trên Directus app 8155 bốn
      luồng ghi (tạo collection có 6 field hệ thống; field m2m sinh junction; tạo policy `app_access` rồi gán quyền ở ma
      trận; tạo preset role) bằng Playwright ghi request (`page.on('request')`), lưu body vào
      `e2e/payload/baselines/settings-*.json`; so với body trong spec US1-8, US3-6, US4-5, US6-3; lệch thì sửa spec
- [x] T004 [P] Kiểm quan hệ lồng ở API mới (research R6, CHK097): spec `e2e/payload/nested-save.spec.ts` (chạy ở
      `proxy-api`, thuộc `DIRECTUS_APP_SPECS`, giữ lại làm test hồi quy) gửi cùng `PATCH /policies/:id` với
      `permissions:{create,update,delete}` và `PATCH /roles/:id` với `policies`, `users` lồng tới 8155 và 8156, so
      `changesSince` của `e2e/helpers/db-rows.ts` trên `directus_permissions`, `directus_access`; ghi kết quả vào
      research R6; lệch → mở T075
- [x] T005 [P] Recipe nháp Q-20 (cây collection, hộp folder) và Q-24 (sub-menu Settings, dòng "Backoffice") vào
      `design-system/docs/layout-patterns.md` §12 (mới) và dòng Settings của §7 (danh sách phẳng L-3, không ngoại lệ
      cây)
- [x] T006 [P] Recipe nháp Q-21 (lưới field), Q-22 (drawer field: lưới thẻ interface `radiogroup`, tab dọc, 768 px tab
      ngang), Q-27 (drawer tạo collection, hộp tạo role/policy, hộp nhân bản, hộp xóa với phụ thuộc) vào
      `design-system/docs/component-specs.md` mục "Tier 3 recipes, nháp (016)"
- [x] T007 [P] Recipe nháp Q-23 (ma trận và chip ba mức theo đề xuất của spec Q-23, drawer quyền), Q-25 (`system-modules`,
      `system-fields`, `system-folder`, `system-scope`, `system-owner`), Q-26 (trình sửa preset với xem trước layout)
      vào `design-system/docs/component-specs.md` cùng mục

**Checkpoint**: T001 xong mới sửa `apps/web`; T005–T007 xong trước task giao diện tương ứng.

---

## Phase 2: Foundational (mở rộng component, store, dữ liệu tĩnh, registry, route, bộ mẫu, API giả lập, harness)

**Purpose**: phần dùng chung chặn mọi story. Lượt 1.

### Mở rộng component và composable

- [x] T010 [P] `BoInput` thêm prop `dbSafe` (spec FR-007, research R13: keydown chỉ `a-z0-9_` và khoảng trắng; input thay
      khoảng trắng bằng `_`, bỏ dấu NFD, xóa ký tự ngoài `[a-zA-Z0-9_]`) trong `src/components/BoInput.vue`; test gõ,
      dán, chữ có dấu trong `src/components/BoInput.test.ts`
- [x] T011 [P] `BoTabs` thêm prop `orientation: 'horizontal' | 'vertical'` (Reka Tabs; mũi tên lên/xuống khi dọc) trong
      `src/components/BoTabs.vue`; test bàn phím trong `src/components/BoTabs.test.ts`
- [x] T012 [P] Tách `useFieldTree` khỏi `src/components/FieldList.vue` sang `src/composables/use-field-tree.ts` (chép
      `directus/app/src/composables/use-field-tree.ts`: `treeList`, `loadFieldRelations`, `refresh`, nạp lười quan hệ);
      `FieldList.vue` dùng lại; test `src/composables/use-field-tree.test.ts`; test của `FieldList` giữ xanh

### Store và dữ liệu tĩnh

- [x] T013 [P] Hàm ghi store (data-model §14, research R7): `upsertCollection`, `updateCollection`, `deleteCollection`
      trong `src/stores/collections.ts`; `upsertField`, `updateField`, `updateFields` (lạc quan, hoàn tác, bộ đếm theo
      collection), `deleteField` trong `src/stores/fields.ts`; `upsertRelation` trong `src/stores/relations.ts` (chép
      `directus/app/src/stores/{collections,fields,relations}.ts`); test request và hoàn tác trong
      `src/stores/{collections,fields,relations}.test.ts`
- [x] T014 [P] `updateSettings` thêm notice `settings_update_success` và hoàn tác khi lỗi, thêm `setOwner` →
      `POST /settings/owner` rồi `hydrate` trong `src/stores/settings.ts` (comment đầu file bỏ "feature 016 adds it");
      test trong `src/stores/settings.test.ts`
- [x] T015 [P] `systemDefaults.directus_presets` (tabular, cột `bookmark`, `collection`, `user`, `role` rộng 200) chép từ
      `directus/app/src/stores/presets.ts` vào `src/stores/presets.ts`; test trong `src/stores/presets.test.ts`
- [x] T016 [P] Script `apps/web/scripts/sync-permissions-data.mjs` (jiti, như `sync-theme-presets.mjs`) ghi
      `src/permissions/app-permissions-data.json` (`minimal` gộp hai yaml của
      `directus/packages/system-data/src/app-access-permissions/` với mặc định `permissions {}`, `validation null`,
      `presets null`, `fields ['*']`, `system true`; `recommended` và `actions` từ `app-permissions.ts`); target
      `web:sync-permissions-data` trong `apps/web/project.json`; test so nguồn
      `src/permissions/app-permissions-data.test.ts` (FR-105); `check-brand.mjs` miễn file sinh `MODULE_BAR_DEFAULT` giữ
      ở `src/constants.ts` (012), không sinh (FR-105).
- [x] T017 [P] Registry (research R4, CHK001, CHK102): `apps/web/scripts/extract-directus-registry.mjs` thêm `preview`
      SVG của interface, 18 `_system`; chạy lại sinh `fixtures/directus-registry.json`; thêm `preview` vào
      `src/interfaces/*/index.ts` của 013 (chuỗi SVG, màu `currentColor`); cập nhật `src/interfaces/registry.test.ts`

### Route, sub-menu

- [x] T018 Route thật thay `placeholderRoutes` (data-model §1, FR-001): `src/modules/settings.ts` với guard
      `settings-collections` (nạp collections) và `settings-fields` (không có → `settings-not-found`; không `meta` →
      `PATCH /collections/:c {meta:{}}`; nạp fields), named view `add`/`field`, flows giữ `ModulePlaceholder` (D-92),
      catch-all `settings-not-found`; component tạm `() => import` cho route chưa làm; `SettingsNavigation.vue` (chép
      `components/navigation.vue`: năm nhóm, D-94, D-95, `aria-current`) trong
      `src/modules/settings/components/SettingsNavigation.vue`; `ContentNotFound` thêm `module: 'settings'` trong
      `src/modules/content/routes/ContentNotFound.vue`; test route và sub-menu trong `src/modules/settings.test.ts`,
      `src/modules/settings/components/SettingsNavigation.test.ts`

### Bộ mẫu, API giả lập, E2E harness

- [x] T019 Bộ mẫu `bo_settings` (data-model §15) trong `fixtures/seed.mjs` (sau `bo_users`; folder `bo_settings_group` >
      `bo_settings_sub`, collection `bo_s_*`, role `bo_s_role`, policy `bo_s_policy` với 3 permission, access, preset
      role và global, translation `bo_hello`) và `fixtures/export.mjs` → `fixtures/snapshot/settings.*.json`; parity
      `tests/parity/src/web/fixtures-seed.test.ts` mở rộng; `fixtures/snapshot.test.ts` xanh
- [x] T020 `mockFixtureApi` #137–#177 (contracts/tests §2: ghi vào snapshot trong bộ nhớ cho `POST /collections`,
      `/fields`, `/relations`; mock lồng `PATCH /roles|policies`; `GET /schema/snapshot` cố định) trong
      `src/test-utils/fetch.ts` và `KNOWN_REQUESTS` (sau T019)
- [x] T021 [P] Harness E2E (contracts/components §6): `e2e/helpers/allowed-paths.ts` (#137–#177),
      `e2e/helpers/settings.ts` (`openSettings`, `dragRow`, `moveRow`, `fieldDrawer`, `permissionChip`,
      `createCollectionViaUi`, `createPolicyViaUi`), `e2e/helpers/db-rows.ts` (10 bảng, chuẩn hóa `id`, `sort`, thời
      gian), `e2e/helpers/payload.ts` (sắp request song song theo `(method, path, body)`), `e2e/helpers/directus-app.ts`
      (`fillItemForm`, `loginAs`), `e2e/helpers/fixtures.ts` (`seedSettings`, `cleanupSettings`); `e2e/helpers.spec.ts`
      thêm case
- [x] T022 [P] `apps/web/scripts/check-bundle.mjs`: `BUDGET_016 = BUDGET_015 + 20 KB`, `LAZY_BUDGETS_016` (drawer field
      ≤ 80 KB, ma trận ≤ 40 KB, dữ liệu quyền ≤ 10 KB gzip, FR-109); test của script cập nhật

**Checkpoint**: lint, typecheck, test, build xanh; `/settings` mở sub-menu thật và route tạm.

---

## Phase 3: User Story 1 - Data model: danh sách collection, tạo collection, tạo folder (Priority: P1) 🎯 MVP

**Goal**: màn `/settings/data-model` như Directus: cây theo folder, kéo thả (chuột và menu D-96), bảng chưa quản lý,
collection hệ thống, menu, hộp xóa với phụ thuộc, hộp folder, drawer tạo collection hai bước, snapshot.

**Independent Test**: spec US1 Independent Test; E2E `settings-data-model.spec.ts` phần US1 xanh ba cấu hình; collection
tạo ở app mới mở được trên Directus app.

### Tests cho User Story 1

- [x] T030 [P] [US1] Test `useExpandCollapse` (localStorage `backoffice-collapsed-collection-ids`, expand all/none,
      toggle) trong `src/modules/settings/routes/data-model/composables/use-expand-collapse.test.ts`
- [x] T031 [P] [US1] Test `CollectionsRoute` (cây gốc/con, tìm kiếm giữ cha, mục chưa quản lý, `BoDetail` hệ thống,
      thả → `PATCH /collections` mảng không chờ, menu Lên/Xuống/Vào nhóm/Ra nhóm gửi cùng body, menu ẩn/hiện và gập mở,
      hộp xóa với phụ thuộc và thứ tự `DELETE`, hộp folder `POST`/`PATCH`, snapshot `snapshot.json`, skeleton và lỗi nạp,
      trạng thái trống) trong `src/modules/settings/routes/data-model/CollectionsRoute.test.ts`
- [x] T032 [P] [US1] Test `NewCollection` (hai bước, Enter, db-safe, singleton khóa `sort`; body `POST /collections` đúng
      từng khóa cho 4 kiểu khóa chính × 6 field hệ thống so với `e2e/payload/baselines/settings-collection.json` của
      T003; hai `POST /relations`; `router.replace`) trong `src/modules/settings/routes/data-model/NewCollection.test.ts`
- [x] T033 [P] [US1] E2E phần US1 (kịch bản 1–10, bảng `bo_raw` chỉ `proxy-api`, link "tạo collection" và "sửa
      collection" từ Content mở màn thật) trong `e2e/settings-data-model.spec.ts` Chuyển hướng
      `/content/directus_collections` và item của nó tới màn thật (FR-002).

### Implementation cho User Story 1

- [x] T034 [P] [US1] Chép `composables/use-expand-collapse.ts` vào
      `src/modules/settings/routes/data-model/composables/use-expand-collapse.ts`
- [x] T035 [US1] `CollectionItem.vue` (lồng `BoSortableList nested group="collections"`, tay kéo, icon màu, note, nút gập,
      `indent`/`outdent` = Vào/Ra nhóm), `CollectionOptions.vue` (menu, hộp xóa với phụ thuộc từ store relations),
      `CollectionDialog.vue` (folder, `BoInput dbSafe`, list bản dịch) trong
      `src/modules/settings/routes/data-model/components/` theo recipe Q-20, Q-27
- [x] T036 [US1] `CollectionsRoute.vue` (page header, tìm kiếm autofocus khi > 25, expand all/none, cây, mục chưa quản lý,
      `BoDetail` hệ thống, trạng thái trống, `RouterView name="add"`) và `SnapshotSidebarDetail.vue` trong
      `src/modules/settings/routes/data-model/`; nối vào route `settings-collections`
- [x] T037 [P] [US1] `NewCollection.vue` (chép `new-collection.vue`: `BoDrawer` + `BoTabs orientation="vertical"`,
      `use-dialog-route`, body và relations như US1-8) trong `src/modules/settings/routes/data-model/NewCollection.vue`
- [x] T038 [US1] Gỡ D-71: comment "khung 012 tới 016" trong `src/modules/content/components/ContentNavigation.vue`,
      `NavigationBookmark.vue`, `src/modules/content/routes/NoCollections.vue`; `e2e/content-navigation.spec.ts`
      khẳng định "tạo collection" mở drawer thật và "sửa collection" mở màn collection

**Checkpoint**: US1 dùng được độc lập (danh sách, tạo collection, folder).

---

## Phase 4: User Story 2 - Màn collection: lưới field, sắp xếp, nhóm, bề rộng, form collection (Priority: P1)

**Goal**: màn `/settings/data-model/:collection` như Directus: lưới field kéo thả với group lồng, menu field, nhân bản,
xóa, nút tạo field (route tới drawer của lượt 2), form `directus_collections` với 5 interface `_system`, helper bật
translations.

**Independent Test**: spec US2 Independent Test; E2E `settings-data-model.spec.ts` phần US2 xanh ba cấu hình.

### Tests cho User Story 2

- [x] T040 [P] [US2] Test `FieldsManagement` + `FieldSelect` + `FieldSelectMenu` (sắp `meta.sort`/`meta.id`, bỏ `$`,
      field khóa, group lồng, bề rộng, icon trạng thái, thả và menu D-96 → `PATCH /fields/:c` mảng, lạc quan và hoàn tác,
      chỉ áp response mới nhất theo collection, menu ẩn/bề rộng → `PATCH /fields/:c/:f`, nhân bản body và đổi tên khóa
      `validation`, xóa, field không meta → `PATCH {meta:{special}}`) trong
      `src/modules/settings/routes/data-model/fields/FieldsManagement.test.ts`
- [x] T041 [P] [US2] Test `FieldsRoute` (form `directus_collections` 29 mục, khóa với hệ thống, lưu `PATCH
      /collections/:c {meta}`, Ctrl/Cmd+S, `unsaved_changes` Keep Editing trước, xóa collection) trong
      `src/modules/settings/routes/data-model/FieldsRoute.test.ts`
- [x] T042 [P] [US2] Test component cho `system-collection`, `system-field`, `system-field-tree`,
      `system-display-template`, `system-collections-translations` (giá trị phát, reset khi đổi collection, request
      `POST /utils/translations/generate` hai chế độ) trong `src/interfaces/_system/<id>/*.test.ts`
- [x] T043 [US2] E2E phần US2 (kịch bản 1–9, gồm field `bo_note` trong `directus_users` và dọn) trong
      `e2e/settings-data-model.spec.ts`

### Implementation cho User Story 2

- [x] T044 [P] [US2] Interface `system-collection` và `system-field` (chép `interfaces/_system/system-collection`,
      `system-field` của `directus/app/src`) trong `src/interfaces/_system/system-collection/`,
      `src/interfaces/_system/system-field/`
- [x] T045 [P] [US2] Interface `system-field-tree` (`BoCheckboxTree` exclusive + `useFieldTree`) và
      `system-display-template` (`FieldList` + `useFieldTree`) trong `src/interfaces/_system/system-field-tree/`,
      `src/interfaces/_system/system-display-template/`
- [x] T046 [P] [US2] Interface `system-collections-translations` và drawer của nó (FR-028; mặc định theo kết quả T002)
      trong `src/interfaces/_system/system-collections-translations/`
- [x] T047 [US2] `FieldsManagement.vue`, `FieldSelect.vue`, `FieldSelectMenu.vue` (lưới grid 2 cột, `BoSortableList
      group="fields"` lồng, hộp nhân bản với `system-collection` và `BoInput dbSafe`, hộp xóa, nút `create_field` và menu
      `create_in_advanced_field_creation_mode`) trong `src/modules/settings/routes/data-model/fields/` theo recipe Q-21
- [x] T048 [US2] `FieldsRoute.vue` (`useItem('directus_collections')`, `BoForm` với `edits.meta`, page header, xóa, lưu,
      `use-edits-guard`, `RouterView name="field"` trỏ tạm khung tới lượt 2) trong
      `src/modules/settings/routes/data-model/FieldsRoute.vue`
- [ ] T049 [US2] Đóng lượt 1: `web:lint`, `typecheck`, `test` (coverage ≥ 60 %), `build` + `check-bundle`
      (`BUDGET_016`), `check-port-headers`, `guard-directus` (SC-009), E2E 012–015 + `settings-data-model` ba cấu hình
      xanh; nhắn session khác; `git pull --rebase`; commit
      `feat(016): settings module routes, data model list and collection page (wave 1)`; push; theo dõi CI, sửa đỏ;
      nhắn sau push; `graphify update .`

---

## Phase 5: User Story 3 - Drawer field: hai chế độ, relation, options, điều kiện, validation (Priority: P1) — Lượt 2

**Goal**: drawer `/settings/data-model/:collection/:field` như Directus với store `fieldDetail` và 10 alteration,
`ExtensionOptions` và 2 options component `list`, `map` (gỡ D-56), 8 interface `_system` của form options.

**Independent Test**: spec US3 Independent Test; test port `store/index.test.ts` + 20 kịch bản (SC-006); E2E
`settings-field-detail.spec.ts` xanh ba cấu hình.

### Tests cho User Story 3

- [x] T050 [P] [US3] Port `field-detail/store/index.test.ts` của Directus và 20 kịch bản alteration của SC-006 (so JSON
      `fieldUpdates`, `collections`, `fields`, `relations`, `items`) trong
      `src/modules/settings/routes/data-model/field-detail/store/index.test.ts`,
      `.../store/alterations.test.ts`; test `get-junction-collection-name` trong `.../utils/*.test.ts`
- [x] T051 [P] [US3] Test `ExtensionOptions` (mảng, `{standard, advanced}`, hàm với ngữ cảnh store, component, null →
      `no_options_available`; số field đúng cho mọi interface/display 013 theo registry) trong
      `src/modules/settings/routes/data-model/field-detail/shared/ExtensionOptions.test.ts`
- [x] T052 [P] [US3] Test component cho `system-interface`, `system-interface-options` (batch khi `isConditionOptions`),
      `system-display`, `system-display-options`, `system-fields` (menu Lên/Xuống D-96), `system-inline-fields` (phẳng
      và gộp `meta.x`/`schema.x`), `system-collections`, `system-manual-flow-select` trong
      `src/interfaces/_system/<id>/*.test.ts`
- [x] T053 [P] [US3] Test options component `list`, `map` (giá trị phát ra bằng Directus) trong
  `src/interfaces/list/InterfaceListOptions.test.ts`, `src/interfaces/map/InterfaceMapOptions.test.ts`; options dạng hàm
  của display `translations`, `related-values` kiểm trong test `ExtensionOptions` (T051)
- [x] T054 [P] [US3] Test `FieldDetail` (đơn giản: lưới thẻ `radiogroup`, `preview`/icon, khung cấu hình, `autoKey`;
      nâng cao: 7 tab, tab Schema theo kiểu, tab Relationship 5 loại, `generationInfo`; `save()` đúng thứ tự sáu bước so
      với `e2e/payload/baselines/settings-field-m2m.json`; hai lỗi trước lưu; Esc không hỏi; field không có hoặc
      `?type=` lạ → hộp lỗi và về màn collection, D-97) trong
      `src/modules/settings/routes/data-model/field-detail/FieldDetail.test.ts`
- [x] T055 [US3] E2E 10 field của US3 qua hai chế độ, điều kiện, validation, options component; so DB với Directus app
      (kịch bản tương tự) trong `e2e/settings-field-detail.spec.ts`

### Implementation cho User Story 3

- [x] T056 [P] [US3] Chép `utils/{collection-exists,field-exists,get-junction-collection-name}.ts` vào
      `src/modules/settings/routes/data-model/utils/`
- [x] T057 [US3] Store `fieldDetail` (chép `field-detail/store/index.ts`, `types.ts`, `alterations/*.ts`: data-model §6;
      import store 012, `sdk`, `showUnexpectedError`) trong `src/modules/settings/routes/data-model/field-detail/store/`
- [x] T058 [P] [US3] `ExtensionOptions.vue`, `RelatedCollectionSelect.vue`, `RelatedFieldSelect.vue` (chép `shared/*`) trong
      `src/modules/settings/routes/data-model/field-detail/shared/`
- [x] T059 [P] [US3] 8 interface `system-interface`, `system-interface-options`, `system-display`,
      `system-display-options`, `system-fields`, `system-inline-fields`, `system-collections`,
      `system-manual-flow-select` trong `src/interfaces/_system/<id>/`
- [x] T060 [P] [US3] Options component (chép `interfaces/list/options.vue`, `interfaces/map/options.vue`) và `options`
  trong `index.ts` của `list`, `map`; comment D-56 trong `src/interfaces/types.ts` sửa
- [x] T061 [US3] `FieldDetail.vue` (`BoDrawer`, tiêu đề, chọn chế độ) và chế độ đơn giản `FieldDetailSimple.vue`,
      `FieldConfiguration.vue`, `RelationshipConfiguration.vue` trong
      `src/modules/settings/routes/data-model/field-detail/` theo recipe Q-22; nối `RouterView name="field"` của T048;
      field không có hoặc `?type=` lạ → `showUnexpectedError` rồi `router.replace` về màn collection (D-97)
- [x] T062 [US3] Chế độ nâng cao `FieldDetailAdvanced.vue`, `Tabs.vue` (`BoTabs orientation="vertical"`, ngang ở 768 px),
      `Actions.vue`, `Schema.vue`, `Field.vue`, `Interface.vue`, `Display.vue`, `Validation.vue`, `Conditions.vue` trong
      `src/modules/settings/routes/data-model/field-detail/advanced/`
- [x] T063 [US3] `Relationship.vue`, `RelationshipM2o.vue`, `RelationshipO2m.vue`, `RelationshipM2m.vue`,
      `RelationshipM2a.vue`, `RelationshipTranslations.vue` (chép `field-detail-advanced-relationship*.vue`) trong
      `src/modules/settings/routes/data-model/field-detail/advanced/`
- [ ] T064 [US3] Đóng lượt 2: cổng như T049 (SC-001, SC-002 phần data model, SC-006; chunk drawer field ≤ 80 KB); commit
      `feat(016): field drawer, field detail store, interface and display options (wave 2)`; push; CI; `graphify update .`

---

## Phase 6: User Story 4 - Roles và policies, ma trận quyền (Priority: P1) — Lượt 3

**Goal**: `/settings/roles(/public|/:id)`, `/settings/policies(/:id)` như Directus với `system-permissions` và drawer chi
tiết; đích thật của D-85.

**Independent Test**: spec US4 Independent Test; E2E `settings-roles-policies.spec.ts` xanh ba cấu hình; ba dòng
`directus_permissions` bằng Directus app.

### Tests cho User Story 4

- [ ] T070 [P] [US4] Test `SystemPermissions`, `PermissionsRow`, `PermissionsToggle` (mức `none|all|custom`, set
      all/none/remove, `directus_extensions` khóa, hàng app tối thiểu khóa với `app_access` chưa lưu, `admin_access` ẩn
      bảng, reset hai kiểu, thêm collection, emit `{create,update,delete}` hoặc `undefined`, nạp lại sau lưu) trong
      `src/interfaces/_system/system-permissions/SystemPermissions.test.ts`
- [ ] T071 [P] [US4] Test `PermissionsDetail` (hai request nạp, tab theo action, `*` → danh sách rõ, rỗng → null, giá trị
      tối thiểu chỉ đọc, JSON không hợp lệ, `isPermissionEmpty` → delete) trong
      `src/interfaces/_system/system-permissions/detail/PermissionsDetail.test.ts`
- [ ] T072 [P] [US4] Test route roles (request danh sách với `deep`, hàng Public, tìm kiếm client, hộp tạo `POST /roles
      {name}`, trang role `PATCH` lồng, mời với `role`, xóa, lỗi `UNPROCESSABLE_CONTENT`, Public ba request `/access`) trong
      `src/modules/settings/routes/roles/roles.test.ts`
- [ ] T073 [P] [US4] Test route policies (danh sách với hai `deep`, nhân bản ba request, hộp tạo + minimal có `system:
      true`, trang policy `PATCH` lồng gồm `permissions`, `use-edits-guard`, phím tắt) trong
      `src/modules/settings/routes/policies/policies.test.ts`
- [ ] T074 [US4] E2E US4 (kịch bản 1–8, menu "sửa role" của Users mở trang role thật) trong
      `e2e/settings-roles-policies.spec.ts` Chuyển hướng `/content/directus_roles` và item của nó tới màn thật (FR-002).

### Implementation cho User Story 4

- [x] T075 [US4] Chỉ khi T004 lệch: sửa lưu quan hệ lồng ở `apps/api/src/services/` (port Directus tương ứng) kèm test
      đối chiếu trong `tests/parity/src/permissions/` (V); không lệch thì đóng task với ghi chú ở research R6
- [ ] T076 [P] [US4] `SystemPermissions.vue`, `PermissionsHeader.vue`, `PermissionsRow.vue`, `PermissionsToggle.vue`,
      `AddCollection.vue` + `use-collections.ts`, `app-permissions.ts` (chép `directus/app/src/app-permissions.ts`, đọc
      `src/permissions/app-permissions-data.json`) và `index.ts` trong `src/interfaces/_system/system-permissions/` theo
      recipe Q-23
- [ ] T077 [P] [US4] `detail/PermissionsDetail.vue`, `Tabs.vue`, `Actions.vue`, `AppMinimal.vue`, `Permissions.vue`,
      `Fields.vue`, `Validation.vue`, `Presets.vue` (`BoDrawer`, `BoTabs` dọc, `BoCheckboxTree` + `useFieldTree`,
      `system-filter`, `input-code` json) trong `src/interfaces/_system/system-permissions/detail/`
- [ ] T078 [P] [US4] `RolesCollectionRoute.vue`, `NewRole.vue`, `use-save.ts`, `RoleItemRoute.vue`, `RolePublicRoute.vue`,
      `RoleInfoSidebarDetail.vue` trong `src/modules/settings/routes/roles/`; nối route
- [ ] T079 [P] [US4] `PoliciesCollectionRoute.vue`, `NewPolicy.vue`, `use-save.ts`, `use-duplicate.ts`,
      `PolicyItemRoute.vue`, `PolicyInfoSidebarDetail.vue` trong `src/modules/settings/routes/policies/`; nối route
- [ ] T080 [US4] Gỡ D-85: comment trong `src/modules/users/components/UsersNavigation.vue`;
      `e2e/users-directory.spec.ts` khẳng định menu "sửa role" mở trang role thật
- [ ] T081 [US4] Đóng lượt 3: cổng như T049 (SC-001, SC-003 phần dữ liệu ghi, SC-005 phần roles/policies; chunk ma trận
      ≤ 40 KB, dữ liệu quyền ≤ 10 KB); commit `feat(016): roles, policies and permissions matrix (wave 3)`; push; CI;
      `graphify update .`

---

## Phase 7: User Story 5 - Cài đặt dự án và giao diện (Priority: P2) — Lượt 4

**Goal**: `/settings/project`, `/settings/appearance` như Directus với `system-owner`, `system-modules`, `system-folder`,
`system-theme` (+ `appearance`), `system-theme-overrides`.

**Independent Test**: spec US5 Independent Test; E2E `settings-project.spec.ts` xanh ba cấu hình.

### Tests cho User Story 5

- [ ] T090 [P] [US5] Test `system-owner` (drawer `SetupForm`, `POST /settings/owner`, trống, lỗi), `system-modules`
      (danh sách gộp `MODULE_BAR_DEFAULT`, ô bật, khóa, link thêm/sửa/gỡ, menu Lên/Xuống, giá trị phát), `system-folder`
      (đường dẫn, gốc, phát id/null), `system-theme` option `appearance` trong `src/interfaces/_system/<id>/*.test.ts`
- [ ] T091 [P] [US5] Test `ProjectRoute` (lọc ba nhóm, `collaborative_editing_enabled` chỉ đọc, `PATCH /settings` chỉ
      khóa đổi, notice và hoàn tác, `serverStore.hydrate({isLanguageUpdated})`) và `AppearanceRoute` (chỉ
      `theming_group`) trong `src/modules/settings/routes/project/ProjectRoute.test.ts`,
      `src/modules/settings/routes/appearance/AppearanceRoute.test.ts` Thêm: mọi field của `settings.yaml` ngoài
      `_system` có interface và option trong registry 013, thiếu thì ghi R-xx (FR-072);
      `public_registration_email_filter` là `system-filter` trên `directus_users.email` và `report_error_url` là
      `system-display-template` với biến error.*, navigator.*, route.*, user.*, role.* (FR-076).
- [ ] T092 [US5] E2E US5 (`describe.serial`, khôi phục settings ở `afterAll`; branding 012 đổi ngay; Directus app thấy
      cùng sidebar) trong `e2e/settings-project.spec.ts` Chuyển hướng `/content/directus_settings` tới
      `/settings/project` (FR-002).

### Implementation cho User Story 5

- [ ] T093 [P] [US5] Interface `system-owner` (`BoDrawer` + `SetupForm` 012, `setOwner`) trong
      `src/interfaces/_system/system-owner/`
- [ ] T094 [P] [US5] Interface `system-modules` và `ModuleLinkDrawer.vue` (`BoSortableList`, `nanoid`) trong
      `src/interfaces/_system/system-modules/`
- [ ] T095 [P] [US5] Interface `system-folder` (`useFolders` 015) trong `src/interfaces/_system/system-folder/`
- [ ] T096 [P] [US5] Option `appearance` cho `system-theme` trong `src/interfaces/_system/system-theme/index.ts`,
      `SystemTheme.vue`
- [ ] T097 [US5] `ProjectRoute.vue`, `AppearanceRoute.vue` trong `src/modules/settings/routes/project/`,
      `src/modules/settings/routes/appearance/`; nối route; `get-item-route` (`directus_settings` → `/settings/project`)
      giữ, comment D-72 sửa

---

## Phase 8: User Story 6 - Presets và bookmarks, translations (Priority: P2) — Lượt 4

**Goal**: `/settings/presets(/:id)`, `/settings/translations(/:id)` như Directus với `system-scope`; đích thật của D-71
(bookmark role/global).

**Independent Test**: spec US6 Independent Test; E2E `settings-presets-translations.spec.ts` xanh ba cấu hình.

### Tests cho User Story 6

- [ ] T100 [P] [US6] Test `system-scope` (ba lựa chọn, `DrawerCollection` user/role, nhãn giá trị hiện tại, phát giá trị)
      trong `src/interfaces/_system/system-scope/SystemScope.test.ts`
- [ ] T101 [P] [US6] Test route presets (danh sách `systemDefaults`, panel đếm, xóa và sửa hàng loạt; trình sửa: mặc định
      mới, scope → `{role,user}`, body chỉ khóa đổi, luôn về danh sách, xem trước layout với `limit` 25) trong
      `src/modules/settings/routes/presets/presets.test.ts`
- [ ] T102 [P] [US6] Test route translations (danh sách, trang item, `refreshCurrentLanguage` sau lưu/xóa, `SaveOptions`,
      nạp lỗi → không tìm thấy) trong `src/modules/settings/routes/translations/translations.test.ts`
- [ ] T103 [US6] E2E US6 (từ cây Content "sửa bookmark role" mở trình sửa; preset hiện ở cây Content của hai app;
      translation hiện ở hai app) trong `e2e/settings-presets-translations.spec.ts` Chuyển hướng
      `/content/directus_presets`, `/content/directus_translations` và item của chúng tới màn thật (FR-002).

### Implementation cho User Story 6

- [ ] T104 [P] [US6] Interface `system-scope` trong `src/interfaces/_system/system-scope/`
- [ ] T105 [P] [US6] `PresetsCollectionRoute.vue`, `PresetsInfoSidebarDetail.vue` (layout wrapper 014) trong
      `src/modules/settings/routes/presets/`
- [ ] T106 [US6] `PresetItemRoute.vue` (form cục bộ, ba ô cùng interface với `BookmarkAdd`, `use-layout` chỉ đọc, panel
      `layout-options-*`, notice khi chưa chọn) trong `src/modules/settings/routes/presets/`; gỡ comment D-71 của
      `NavigationBookmark.vue` nếu T038 chưa làm
- [ ] T107 [P] [US6] `TranslationsCollectionRoute.vue`, `TranslationItemRoute.vue` trong
      `src/modules/settings/routes/translations/` Chép `directus/app/src/lang/refresh-current-language.ts` vào
      `src/lang/refresh-current-language.ts` kèm test `src/lang/refresh-current-language.test.ts` (FR-086).
- [ ] T108 [US6] Đóng lượt 4: cổng như T049 (SC-001, SC-004 phần presets, SC-005 phần settings/presets/translations);
      commit `feat(016): project, appearance, presets and translations (wave 4)`; push; CI; `graphify update .`

---

## Phase 9: User Story 7 - Đối chiếu với Directus, E2E ba cấu hình, dùng chéo (Priority: P2) — Lượt 5

**Goal**: bằng chứng cho tiêu chí chấp nhận (SC-002 đến SC-008).

**Independent Test**: job `e2e-web` ba cấu hình; payload, parity UI, cross-use ở `proxy-api` chromium-1280.

### Tests cho User Story 7

- [ ] T110 [P] [US7] Bộ so payload: mọi kịch bản của bảng `contracts/tests.md` §4, so body với Directus app sau chuẩn
      hóa (SC-005) và `changesSince` 10 bảng trong `e2e/payload/settings.spec.ts`
- [ ] T111 [P] [US7] Dùng chéo (SC-002, SC-003; giá trị điền §5; sáu thao tác của SC-003; chiều ngược) trong
      `e2e/settings-cross-use.spec.ts`
- [ ] T112 [P] [US7] Parity UI năm thuộc tính, 13 màn, 14 nút (SC-004) trong `e2e/settings-parity-ui.spec.ts`
- [ ] T113 [P] [US7] Người không admin: module ẩn, route không có quyền, API 403 cho request ghi (FR-061) trong
      `e2e/settings-permissions.spec.ts`
- [ ] T114 [P] [US7] axe 13 màn + 4 drawer/hộp sáng và tối (SC-008, FR-106) trong
      `src/modules/settings/a11y.browser.test.ts`
- [ ] T115 [P] [US7] Perf FR-108 (cây 300, lưới 200, ma trận 60 × 5 và 300 × 5, drawer field, số request) với
      `machineFactor()` trong `src/modules/settings/perf.browser.test.ts`

### Implementation cho User Story 7

- [ ] T116 [US7] `apps/web-e2e/playwright.config.ts` (`DIRECTUS_APP_SPECS` thêm payload settings, parity UI, cross-use;
      worker 1 cho DDL) và `.github/workflows/ci.yml` (bước `PERF=1` thêm file perf của 016 nếu cần) Thêm `settings` vào
      biểu thức `CONTENT_NOT_CORE` và gắn `@core` cho `settings-data-model`, `settings-field-detail`,
      `settings-roles-policies` để firefox và webkit chỉ chạy ba spec lõi (SC-001).

---

## Phase 10: Polish & đóng feature — Lượt 5

- [ ] T120 [P] Tài liệu: spec 012 (D-40 phần Settings "đã gỡ ở 016"), 013 (D-56, D-57 "đã gỡ ở 016", MCP đóng), 014
      (D-71, D-72 phần 016), 015 (D-85) trong `specs/01{2,3,4,5}-*/spec.md`; `SPECKIT-GUIDE.md` ghi chú cho 017 (mục Flows
      và khung D-92; `system-manual-flow-select`, `system-collections`, `system-inline-fields` đã có) và 018 (snackbar
      D-66)
- [ ] T121 [P] Recipe Q-20 đến Q-27 hoàn thiện theo code và gửi design owner duyệt; `design-system/qa/handoff-checklist.md`
      đạt; ghi trạng thái Q-20 đến Q-27 trong `specs/016-settings-module/spec.md`
- [ ] T122 Bảng trạng thái khác biệt D-92 đến D-99 và R-40 đến R-42 (code đã làm, duyệt) trong
      `specs/016-settings-module/spec.md` như 015 T103; tech lead duyệt (SC-010)
- [ ] T123 Đóng feature: mọi cổng của T049 + payload, cross-use, parity UI, axe, perf, bundle xanh; commit
      `test(016): settings payload, cross-use and parity suites, close feature (wave 5)`; nhắn session khác; push; CI;
      `graphify update .`; cập nhật memory dự án

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: T001 chặn mọi task sửa `apps/web`; T002 sau T001; T003, T004 song song sau T001 (cần env parity); T005–T007
  song song (chỉ tài liệu, sau khi 015 mở khóa `design-system/`).
- Phase 2: sau T001, T002. T010–T017 song song; T018 sau T010, T011 (route tạm); T019 → T020; T021, T022 song song.
- Phase 3 (US1) và Phase 4 (US2): sau Phase 2 và T005, T006; US2 dùng route của T018 và `CollectionsRoute` để đi tới màn
  collection; T049 đóng lượt 1.
- Phase 5 (US3): sau lượt 1 (cần `FieldsRoute` T048); T064 đóng lượt 2.
- Phase 6 (US4): sau lượt 2 và T007 (recipe Q-23; dùng `system-filter`, `BoTabs` dọc, `useFieldTree`; độc lập với drawer
  field về code) và T004; T081 đóng lượt 3.
- Phase 7 (US5) và Phase 8 (US6): sau lượt 3 và T007 (recipe Q-25, Q-26; dùng chung T014, T015); song song với nhau;
  T108 đóng lượt 4.
- Phase 9, 10: sau lượt 4; T123 đóng feature.

### User Story Dependencies

- US1 → không phụ thuộc story khác (MVP).
- US2 → US1 (điều hướng từ danh sách; bộ mẫu chung).
- US3 → US2 (route con `:field` của màn collection).
- US4 → Phase 2; độc lập với US1–US3 về code (dùng `useFieldTree`, `BoTabs`).
- US5, US6 → Phase 2; độc lập với nhau.
- US7 → tất cả.

### Within Each User Story

Test trước (viết test đỏ), rồi utils/composable/store → component → route → E2E → payload; mỗi task chép kèm manifest và
header nguồn; sau mỗi phase chạy bốn cổng.

### Parallel Opportunities

- Phase 1: T003, T004, T005, T006, T007.
- Phase 2: T010, T011, T012, T013, T014, T015, T016, T017, T021, T022.
- US1: T030, T031, T032, T033 (test); T034, T037 cùng nhau.
- US2: T040, T041, T042 (test); T044, T045, T046.
- US3: T050–T054 (test); T056, T058, T059, T060.
- US4: T070–T073 (test); T076, T077, T078, T079.
- US5: T090, T091; T093–T096. US6: T100–T102; T104, T105, T107.
- US7: T110–T115. Polish: T120, T121.

## Parallel Execution Examples

```text
Lượt 1, Phase 2 (sau T001, T002):
  song song: T010 BoInput dbSafe | T011 BoTabs orientation | T012 use-field-tree | T013 store ghi | T014 settings store
             | T015 presets defaults | T016 sync permissions data | T017 registry preview
  rồi: T018 route + sub-menu (cần T010, T011) | T019 seed → T020 mock API | T021 harness E2E | T022 bundle budgets

Lượt 2, Phase 5 (US3):
  song song: T050 store tests | T051 ExtensionOptions test | T052 _system tests | T053 options tests | T054 FieldDetail test
  song song: T056 utils | T058 shared | T059 8 interface | T060 options component
  rồi: T057 store → T061 simple → T062 advanced → T063 relationship → T055 E2E → T064 đóng lượt

Lượt 3, Phase 6 (US4):
  song song: T070 | T071 | T072 | T073
  song song: T076 ma trận | T077 drawer | T078 roles | T079 policies (T075 chỉ khi T004 lệch)
  rồi: T080 → T074 E2E → T081 đóng lượt
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 → Phase 3 (US1): danh sách collection, folder, tạo collection; E2E `settings-data-model` phần US1
   xanh ba cấu hình; collection tạo ở app mới mở được trên Directus app.

### Incremental Delivery

1. Lượt 1: US1 + US2 (data model dùng được, chưa có drawer field).
2. Lượt 2: US3 (tạo và sửa field đủ loại; SC-002 phần data model).
3. Lượt 3: US4 (roles, policies, ma trận; SC-003 phần dữ liệu).
4. Lượt 4: US5 + US6 (cài đặt, presets, translations).
5. Lượt 5: US7 + Polish (bằng chứng tiêu chí chấp nhận, duyệt, đóng).

## Ghi chú khi làm

- 2026-10-16: T001 theo tin nhắn của session 015 (code 015 xong, `e2e-web` xanh ở `53f0d47`; research R11).
- T002 (chỉ đọc): kết quả ở research "Kết quả kiểm T002"; thêm D-97; chỉ `list`, `map` có options component.
- T003: `apps/web-e2e/src/payload/settings-baselines.spec.ts` (chạy khi `RECORD_BASELINES=1`) ghi mốc hai luồng data
  model (`settings-collection.json`, `settings-field-m2m.json`); mốc của policy và preset lấy ở T110 (bộ so payload chạy
  cả hai app) vì luồng giao diện của Directus app cho hai màn này cần thêm bộ chọn. Chế độ đơn giản của field m2m không gửi
  khóa `schema` cho field alias và gửi relation m2o trước o2m.
- T004: quan hệ lồng của `PATCH /roles|policies` ở API mới ghi như Directus; T075 đóng không sửa. `helpers/payload.ts`
  ghi thêm đường dẫn Settings (`collections`, `fields`, `relations`, `roles`, `policies`, `permissions`, `access`,
  `settings`, `translations`).
- T015 đã có từ 015 (`systemDefaults.directus_presets` giống Directus). T017: chỉ chép ảnh xem trước
  (`scripts/sync-interface-previews.mjs`, nạp lười qua `src/interfaces/previews.ts`); fixture registry thêm id `_system`
  cùng task đăng ký interface đó, vì `registry.test.ts` đòi mỗi id trong fixture phải đã đăng ký.
- T019: bộ mẫu rút gọn (data-model §15): role, policy với ba quyền trên `bo_std`, chuỗi dịch `bo_hello`; không thêm
  collection để cây Content và snapshot 013–015 không đổi.
- T020, T021: API giả lập và danh sách request E2E thêm các dòng data model (#138–#168); các dòng roles, policies,
  settings, presets, translations thêm ở lượt của chúng. Helper E2E `settings.ts`, `directus-app.ts` (`fillItemForm`,
  `loginAs`) viết cùng spec dùng chúng. `db-rows.ts` có `SETTINGS_TABLES` (khóa `collection` cho
  `directus_collections`). T022: marker của ma trận là thuộc tính `data-permissions-matrix` (khóa i18n nằm trong chunk
  ngôn ngữ).
- US1 (T030–T038): menu collection dựng trong `CollectionsRoute.vue` và đưa xuống dòng qua injection
  `COLLECTION_TREE`, hộp xóa là `DeleteCollectionDialog.vue` (không có `CollectionOptions.vue` riêng). Drawer tạo
  collection dùng tab ngang (drawer 640px quá hẹp cho tab dọc; recipe Q-27 sửa theo). Note `$t:` của ba collection
  `directus_deployment*` không có chuỗi trong Directus 11.17.4: hai app hiện key, helper E2E bỏ qua đúng ba key này.
  Tiêu đề trang `/settings` là "Data Model" (navigation.spec sửa theo). T033 chạy xanh với cấu hình `dev` (API Directus);
  ba cấu hình proxy chạy ở T049.
- US2 (T040–T048): `field-select-menu.vue` là danh sách mục menu dựng trong `FieldsManagement.vue` (hàng của
  `BoSortableList`), hộp nhân bản và hộp xóa đặt một lần ở trang. `BoSortableList` thêm `listClass`, `rowClass`,
  `canIndent`; `BoSelect` thêm mục khóa và hàng `deselect`; `BoMenu` thêm `danger`; `BoCheckboxTree` phát `group-toggle`.
  Port thêm `use-schema.ts` và `get-special-for-type.ts`. `system-display-template` là ô nhập + nút chọn field
  (FieldList) như CardsOptions 014; prop `fields` chỉ liệt kê cấp đầu (shortcut ghi trong file). Snapshot fixture thêm
  field hệ thống của `directus_collections` (xuất từ 8155 và 8156 giống nhau). T043: kịch bản 9 (field `bo_note` trong
  `directus_users` qua drawer) chờ drawer field của US3, làm ở lượt 2.
- T049 (cổng cục bộ): lint 0 lỗi, typecheck sạch, 3567 test xanh (coverage dòng 95,16 %), bundle 241,8 KB gzip,
  port header và guard directus sạch; E2E `settings-data-model`, `navigation`, `content-navigation`, `a11y`,
  `requests` xanh ở ba cấu hình (chromium-1280). Dưới tải máy (Directus giả lập amd64), test browser của 013/015 đỏ
  ngẫu nhiên; `ImageEditor.browser.test.ts` sửa để chờ menu mở, `FieldsRoute.test.ts` dùng thời hạn 15 s.
- US3 (T050–T063): store `fieldDetail`, 10 alteration và utils data model port bằng script (chỉ đổi import, kiểu
  `DeepPartial` nới, tham số `state` không dùng thành `_state`, một `return` ở global.ts); test so nguồn với Directus và
  20 kịch bản alteration chụp snapshot (`alterations.test.ts`); test `store/index.test.ts` port bằng `vi.spyOn` (không có
  `@pinia/testing`). `useExtension` port trên registry apps/web. Drawer: chế độ đơn giản (thẻ `radiogroup`, ảnh xem trước
  nạp lười), nâng cao (BoTabs dọc từ 1024px, các tab tên `Advanced*` cho lint), `BoDrawer wide`, `BoFancySelect` (port
  `v-fancy-select`). Tên interface/display dịch bằng `translateString` (dịch nguyên `$t:` như Directus khi đăng ký; regex
  của `translate` cắt `$t:tree_view`). Sửa thêm `select-dropdown` (013): lựa chọn giá trị `''` (tags `whitespace`) làm Reka
  báo lỗi. `list`/`map` có component options (D-56 gỡ), `FIELD_TYPES_SELECT` thêm vào `constants.ts`. T054 so chuỗi
  request m2m với baseline Directus; T055 chạy xanh với cấu hình `dev`, gồm kịch bản 9 của US2 (`bo_note`).
- Lượt 2, góp ý owner khi xem giao diện (2026-10-16; spec Clarifications, D-98, D-99, Q-28):
  - `AppSidebar` có đích `module-actions-<id>` trên dòng module đang mở; `ContentNavigation` teleport nút hiện/ẩn vào
    đó (D-98).
  - `DrawerCollection` bỏ `LayoutSidebarDetail`.
  - `BoDrawer`, `BoDialog`, `ComparisonModal` đổi lớp phủ và viền ở chế độ tối.
  - Tiêu đề nhóm sidebar thành `sr-only`.
  - `PrivateView` có prop `fill` (trang danh sách Content, Files, Users chỉ cuộn trong bảng; gốc `relative`, D-99).
  - `BoIcon` vẽ 20 icon `custom-icons` của Directus. Manifest là `016-T064-custom-icons.json`; test `PageHeader`,
    `UserMenu` đổi theo.
  - `system-filter` có pill điều kiện; popover `SearchInput` ở chế độ tối là `gray-800`.
  - Preview SVG của drawer field ánh xạ biến `--theme--*` sang token.
  - Dữ liệu thử "Demo phân trang 01–40" trong `bo_content` (Directus 8155) chỉ để xem phân trang, phải xóa trước khi
    chạy E2E cục bộ.
