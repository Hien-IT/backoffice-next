# Implementation Plan: Module Settings (data model, quyền, cài đặt dự án, presets, translations như Directus)

**Branch**: `016-settings-module` (trên `main`, không có branch riêng) | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-settings-module/spec.md`

## Summary

Thay khung module Settings của 012 (D-40) bằng các màn thật của Directus 11.17.4 trong phạm vi: danh sách collection
(cây theo folder, kéo thả, bảng chưa quản lý, hệ thống, snapshot), drawer tạo collection, màn collection với lưới field
kéo thả và form `directus_collections`, drawer field hai chế độ với store và 10 alteration chép từ Directus, roles
(danh sách, trang, Public), policies với ma trận quyền `system-permissions` và drawer chi tiết, Project và Appearance
(form `directus_settings` với `system-owner`, `system-modules`, `system-folder`, theme của 015), presets (danh sách và
trình sửa với xem trước layout, `system-scope`), translations; form options của interface và display (`ExtensionOptions`,
gỡ D-56) và 18 interface `_system` còn lại (gỡ D-57 trừ MCP). Đích thật cho D-71, D-72 (phần 016), D-85. Tiêu chí: data
model và quyền tạo ở app mới dùng được ngay trên Directus app 8155 (SC-002, SC-003) qua E2E dùng chéo và bộ so DB.

Cách làm:

- Chép logic từ `directus/app/src` (route của `modules/settings/index.ts`, store `field-detail/store` + `alterations`,
  `use-expand-collapse`, `get-junction-collection-name`, `use-duplicate`, `use-save`, `system-permissions/*`,
  `app-permissions.ts`, `use-field-tree`) với ghi nguồn; viết lại giao diện bằng Reka UI + theme TailAdmin theo recipe
  nháp Q-20 đến Q-27 viết vào `design-system/docs/` trước khi code màn tương ứng (R2 đến R8).
- Dùng lại: `use-item`, `use-preset`, `use-layout`, `SearchInput` + `system-filter`, `FieldList` (tách
  `use-field-tree`), `components/sidebar/*`, `DrawerBatch`, `DrawerCollection`, `BookmarkAdd`, `ContentNotFound` (014);
  `BoForm` (`provide('values')` đã có), `BoSortableList` (`nested`, `group`, indent/outdent đã có), `BoTabs`,
  `BoCheckboxTree`, mọi interface và display với `options` giữ nguyên dạng Directus (013); `use-folders`,
  `system-theme`, `system-theme-overrides`, `UsersInvite` (prop `role`) (015); `SetupForm`, store settings/server/
  translations/flows, `MODULE_BAR_DEFAULT` (012).
- Thêm hàm ghi cho store collections/fields/relations (port `stores/{collections,fields,relations}.ts` phần
  `upsert*`, `update*`, `delete*`), R1.
- Dữ liệu tĩnh chép từ Directus bằng script `web:sync-permissions-data` (jiti, như `sync-themes`): quyền tối thiểu
  (`libs/system-data` là lib Node với js-yaml, không nhúng vào web), quyền gợi ý (`app-permissions.ts`), R5.
- Không thư viện mới (R1). Test: Vitest `unit` + `browser` với API giả lập mở rộng (#137–#177); E2E Playwright bảy
  spec ở ba cấu hình; bộ so payload `settings` và bộ so DB ở `proxy-api`; kịch bản dùng chéo trên Directus app (R9).
- Năm lượt commit (FR-112, R11).

Chi tiết: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/),
[quickstart.md](./quickstart.md).

## Technical Context

| Yêu cầu (prompt plan) | Ở feature 016 |
|-----------------------|---------------|
| Node 22, pnpm 10, Nx, `apps/web` Vue 3 script setup TS strict, Vite, Pinia, Vue Router | Giữ như 012–015 |
| Reka UI 2.8.2 + Tailwind CSS 4.3, theme `brand-*`, `gray-*` qua `@theme`, không hex, không palette | Giữ; màu icon collection (`meta.color`) và swatch là giá trị runtime inline (như icon role 015); chip quyền ba mức dùng token `success-*`, `gray-*`, `warning-*` cộng chữ (Q-23) |
| Bố cục theo `layout-patterns.md`, component theo `component-specs.md` | Sub-menu Settings là danh sách phẳng L-3 (không ngoại lệ cây); page header L-5, panel L-4; drawer `BoDrawer` với tab dọc (`BoTabs` vertical) cho drawer field, drawer quyền, drawer tạo collection; recipe Q-20 đến Q-27 trước khi code (FR-107) |
| Settings áp lên theme như `app.vue` | Không đổi (012); Appearance ghi `project_color`, `theme_*_overrides`, `custom_css` và 012 áp ngay sau `serverStore.hydrate()` (FR-070, FR-071) |
| vue-i18n từ `directus/app/src/lang` | Khóa `settings_*`, `creating_new_collection`, `permissionsLevel.*`, `interfaces.system-*.*`… đã sinh ở 012 (R10); không overlay mới (dòng "Backoffice" của D-95 là chuỗi tĩnh tên sản phẩm, không dịch) |
| `@directus/sdk` | Mọi request qua `requestEndpoint`; `GET /schema/snapshot` tải về qua `apiFetch` (blob) |
| Copy composable/utils, viết lại component bằng Reka UI | R2 đến R8; manifest `tools/port-manifest/016-T*.json`; `check-port-headers` |
| Vitest + VTU; Playwright E2E với Directus thật và API mới | `contracts/tests.md`; kịch bản dùng chéo điều khiển Directus app bằng `helpers/directus-app.ts` (R9) |
| GitHub Actions, coverage FE 60% | Job `quality`, `e2e-web` (ma trận ba cấu hình) như 015; `check-bundle` `BUDGET_016` |

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23.3; trình duyệt như 012.

**Primary Dependencies**: đã có (012–015): vue 3.5, pinia 3, vue-router 4, vue-i18n 11, reka-ui 2.8.2, tailwindcss
4.3, @directus/sdk 21.3.0, @directus/utils 13.4.1, @directus/types 15.0.3, @directus/format-title, @vueuse/core 14,
lodash-es, nanoid, vuedraggable 4.1.0, jiti (dev, script sync). Thêm: không (R1).

**Storage**: không DB; Pinia (store collections/fields/relations thêm hàm ghi; store settings thêm `setOwner`, notice
và hoàn tác; store presets thêm `systemDefaults.directus_presets`); store Pinia mới `fieldDetail` (port
`field-detail/store`); localStorage `backoffice-collapsed-collection-ids`; dữ liệu tĩnh
`src/permissions/app-permissions-data.json` (sinh); bộ mẫu `apps/web/fixtures/interfaces/snapshot/` thêm `bo_settings`
(collections, fields, relations, roles, policies, permissions, access, presets, translations).

**Testing**: Vitest `unit` + `browser` (chromium) trong `apps/web`, coverage ≥ 60 % gộp; axe; test port
`field-detail/store/index.test.ts`; Playwright `apps/web-e2e` tám spec `settings-*` (gồm `settings-cross-use`) ở `proxy-directus`, `proxy-api`,
`cors`; payload `settings.spec.ts` và bộ so DB ở `proxy-api`; kịch bản dùng chéo (SC-002, SC-003) ở `proxy-api`
(`DIRECTUS_APP_SPECS`); parity `web` giữ `fixtures-seed.test.ts` (mở rộng seed).

**Target Platform**: như 012 (image nginx tĩnh, cùng hoặc khác origin).

**Project Type**: Monorepo web. Chạm `apps/web` (src, fixtures, scripts), `apps/web-e2e`, `design-system/docs` (recipe
nháp Q-20 đến Q-27), `.github/workflows/ci.yml` (nếu cần thêm spec vào `DIRECTUS_APP_SPECS`), `tools/port-manifest`,
spec 012 (D-40 Settings), 013 (D-56, D-57), 014 (D-71, D-72 phần 016), 015 (D-85), `SPECKIT-GUIDE.md` (ghi chú 017,
018), `CLAUDE.md` (Active Technologies).

**Performance Goals**: FR-108 / SC-007 (cây 300 collection < 500 ms, lưới 200 field < 500 ms, ma trận 60 × 5 < 500 ms,
drawer field < 300 ms sau nạp; số request mỗi thao tác; ngân sách cho Mac tham chiếu nhân `machineFactor()`); bundle
chính ≤ `BUDGET_015` + 20 KB gzip; dữ liệu quyền ≤ 10 KB gzip (FR-109).

**Constraints**:
- Chỉ API Directus ở `contracts/api-calls.md` (#137–#177 nối 015); 0 request ra ngoài (FR-110).
- Bắt đầu sửa `apps/web`, `apps/web-e2e`, `design-system/`, spec 012–015, `CLAUDE.md` chỉ khi phiên 015 báo đóng và
  push xong (FR-111); commit chỉ `specs/016-*` cho tới khi đó; `update-agent-context.sh` chạy ở task đầu lượt 1.
- Không sửa `directus/`; file chép ghi `// Ported from directus/app/src/...`; app không ghi thẳng DB, chỉ qua API
  `/collections`, `/fields`, `/relations`, `/roles`, `/policies`, `/permissions`, `/access`, `/settings`, `/presets`,
  `/translations`, `/utils/translations/generate`.
- Không hex, không palette ngoài theme trong class; màu dữ liệu (icon collection, swatch) inline từ runtime.
- Không chọn ngầm giao diện: recipe nháp Q-20 đến Q-27 vào `design-system/docs/` trước (FR-107); design owner duyệt
  trước khi đóng (SC-008).
- Không AI/MCP, marketplace, extensions, system logs (D-93), không flows (D-92, 017), không email (mời qua
  `UsersInvite` với D-83), không collab (D-68).
- Mở rộng component và store của 012–015 chỉ bằng prop và hàm thêm; test của 012–015 giữ xanh; `registry.test.ts`
  của 013 cập nhật fixture `directus-registry.json` cho 18 interface `_system` (R4).

**Scale/Scope**: 1 module (route file + 14 route SFC: collections, new-collection, fields, field-detail, roles ×4,
policies ×3, project, appearance, presets ×2, translations ×2) + ≈ 30 component (collection item/dialog/options,
fields-management, field-select + menu, 10 tab/relationship SFC của drawer field, shared ×3, permissions ×6,
sidebar-detail ×3) + store `fieldDetail` (index + 10 alteration + types + utils ×3) + 18 interface `_system` (≈ 26 SFC)
+ 2 options component + `ExtensionOptions` + `use-field-tree` tách + hàm ghi store ×3 + script sync + JSON. Ước lượng
9.000 dòng mới (≈ 4.500 chép), ≈ 70 file test, 8 spec E2E, 1 payload spec, bộ so DB mở rộng. `tasks.md` chia năm lượt
(R11).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` 2.0.0. Lần 1 (trước research) và lần 2 (sau design) không vi phạm.

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`; file chép ghi nguồn, manifest `016-T*.json`,
  `check-port-headers`; script `sync-permissions-data.mjs` chỉ đọc `directus/packages/system-data` và
  `directus/app/src/app-permissions.ts`.
- [x] **II. Dùng chung DB**: PASS. DDL chỉ qua API `/collections`, `/fields`, `/relations` của 006 (như Directus app);
  body và thứ tự request chép từ Directus (SC-005) để `directus_collections/fields/relations/permissions` ghi ra bằng
  Directus (SC-002, SC-003); không ghi thẳng bảng hệ thống.
- [x] **III. API giống hệt**: PASS. Không endpoint mới; cùng query và body (`contracts/api-calls.md`).
- [x] **IV. Chạy song song an toàn**: PASS. Không state server; localStorage chỉ `backoffice-`; store trong trình
  duyệt nạp lại sau mỗi lần ghi như Directus.
- [x] **V. Kiểm thử đối chiếu**: PASS. Không endpoint mới ở API; đối chiếu ở mức màn: E2E ba cấu hình, bộ so payload,
  bộ so DB, dùng chéo trên Directus app (SC-002, SC-003); seed `fixtures-seed.test.ts` mở rộng. Rủi ro quan hệ lồng
  trong `PATCH /roles`, `PATCH /policies` kiểm ở T002 (R6); lệch là lỗi API, sửa ở API với parity 004.
- [x] **VI. Kiến trúc**: PASS. Vue 3 Composition API, Reka UI; route, luồng, quyền theo Directus app; 768 px+;
  `vi-VN`/`en-US`; mỗi thay đổi có test.
- [x] **VII. Đa instance**: PASS. Build tĩnh; không state server.
- [x] **VIII. Biến môi trường**: PASS. Không biến mới.
- [x] **IX. Đổi thương hiệu**: PASS. D-94 (bỏ URL mặc định GitHub Directus), D-95 (chữ "Backoffice"); `id` theme và
  dữ liệu `module_bar` (`docs`) giữ vì là dữ liệu DB; khóa i18n Directus giữ.
- [x] **X. Chất lượng**: PASS. Coverage 60 %, lint, typecheck, browser test, E2E, build image; không email (D-83); D-92
  đến D-96, R-40 đến R-42 trong spec, tech lead duyệt trước khi đóng (SC-010).
- [x] **XI. Ngoài phạm vi**: PASS. Không AI/MCP, marketplace, extensions, system logs (D-93), flows (D-92), collab;
  `visual_editor_urls` chỉ là ô dữ liệu (D-41).
- [x] **XII. Design-system**: PASS. Đã đọc `README.md`, `component-specs.md`, `layout-patterns.md`,
  `handoff-checklist.md`; theme qua `@theme`; không hex trong class; Q-20 đến Q-27 ghi ở spec, recipe nháp trước khi
  code, design owner duyệt trước khi đóng; branding không đổi; đường bàn phím D-96 nên không có ngoại lệ a11y mới.

## Project Structure

### Documentation (this feature)

```text
specs/016-settings-module/
├── plan.md
├── research.md           # R1–R12
├── data-model.md         # route, store, cây collection, lưới field, store field, ma trận quyền, settings, preset, bộ mẫu
├── quickstart.md
├── contracts/
│   ├── api-calls.md      # #137–#177, danh sách đóng cho E2E
│   ├── components.md     # component, composable, store, interface, dữ liệu tĩnh, E2E helpers
│   └── tests.md          # unit/browser, API giả lập, E2E, payload, bộ so DB, dùng chéo, perf, CI
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── fixtures/interfaces/{seed.mjs, export.mjs, snapshot/}   # bo_settings: 6 collection trong 2 folder, bảng bo_raw không meta, role/policy/permission mẫu, preset role, translation
├── scripts/{sync-permissions-data.mjs, check-bundle.mjs (BUDGET_016, LAZY_BUDGETS_016)}
├── src/
│   ├── modules/settings.ts                                # route thật (thay placeholderRoutes trừ flows)
│   ├── modules/settings/
│   │   ├── components/SettingsNavigation.vue              # 5 nhóm, D-94, D-95
│   │   ├── routes/data-model/
│   │   │   ├── CollectionsRoute.vue, NewCollection.vue
│   │   │   ├── components/{CollectionItem,CollectionDialog,CollectionOptions,SnapshotSidebarDetail}.vue
│   │   │   ├── composables/use-expand-collapse.ts
│   │   │   ├── FieldsRoute.vue
│   │   │   ├── fields/{FieldsManagement,FieldSelect,FieldSelectMenu}.vue
│   │   │   ├── field-detail/FieldDetail.vue
│   │   │   ├── field-detail/simple/{FieldDetailSimple,FieldConfiguration,RelationshipConfiguration}.vue
│   │   │   ├── field-detail/advanced/{FieldDetailAdvanced,Tabs,Schema,Field,Interface,Display,Validation,Conditions,Relationship,RelationshipM2o,RelationshipO2m,RelationshipM2m,RelationshipM2a,RelationshipTranslations,Actions}.vue
│   │   │   ├── field-detail/shared/{ExtensionOptions,RelatedCollectionSelect,RelatedFieldSelect}.vue
│   │   │   ├── field-detail/store/{index.ts,types.ts,alterations/{index,standard,presentation,group,file,files,m2o,o2m,m2m,m2a,translations}.ts}
│   │   │   └── utils/{collection-exists,field-exists,get-junction-collection-name}.ts
│   │   ├── routes/roles/{RolesCollectionRoute,NewRole,RoleItemRoute,RolePublicRoute,RoleInfoSidebarDetail}.vue, use-save.ts
│   │   ├── routes/policies/{PoliciesCollectionRoute,NewPolicy,PolicyItemRoute,PolicyInfoSidebarDetail}.vue, use-save.ts, use-duplicate.ts
│   │   ├── routes/project/ProjectRoute.vue, routes/appearance/AppearanceRoute.vue
│   │   ├── routes/presets/{PresetsCollectionRoute,PresetItemRoute,PresetsInfoSidebarDetail}.vue
│   │   └── routes/translations/{TranslationsCollectionRoute,TranslationItemRoute}.vue
│   ├── interfaces/_system/{system-collection,system-collections,system-collections-translations,system-display,system-display-options,system-display-template,system-field,system-field-tree,system-fields,system-folder,system-inline-fields,system-interface,system-interface-options,system-manual-flow-select,system-modules,system-owner,system-permissions,system-scope}/
│   │   └── system-permissions/{SystemPermissions,PermissionsHeader,PermissionsRow,PermissionsToggle,AddCollection,detail/{PermissionsDetail,Tabs,Actions,AppMinimal,Permissions,Fields,Validation,Presets}}.vue, use-collections.ts, app-permissions.ts
│   ├── interfaces/list/InterfaceListOptions.vue, interfaces/map/InterfaceMapOptions.vue   # options component (D-56)

│   ├── lang/refresh-current-language.ts                 # chép Directus (spec FR-086)
│   ├── composables/use-field-tree.ts                      # tách từ FieldList.vue (014)
│   ├── components/{BoInput.vue (+dbSafe), BoTabs.vue (+orientation)}                    # research R13
│   ├── stores/{collections.ts (+upsert/update/delete), fields.ts (+upsertField, updateField(s), deleteField), relations.ts (+upsertRelation), settings.ts (+setOwner, notice, hoàn tác), presets.ts (+systemDefaults.directus_presets)}
│   ├── permissions/app-permissions-data.json              # sinh: minimal + recommended
│   ├── test-utils/fetch.ts                                # mockFixtureApi #137–#177
│   └── utils/get-item-route.ts                            # không đổi (comment "khung 012" sửa)
apps/web/src/modules/content/components/{ContentNavigation,NavigationBookmark}.vue, routes/NoCollections.vue; modules/users/components/UsersNavigation.vue   # comment D-71/D-85
apps/web-e2e/src/
├── {settings-data-model,settings-field-detail,settings-roles-policies,settings-project,settings-presets-translations,settings-permissions,settings-parity-ui,settings-cross-use}.spec.ts
├── payload/{settings,nested-save}.spec.ts, payload/baselines/settings-*.json   # mốc body ghi của Directus app (T003)
└── helpers/{allowed-paths.ts (+#137..), settings.ts, db-rows.ts (+bảng), directus-app.ts (+)}
design-system/docs/{component-specs.md (Tier 3 nháp 016: Q-21, Q-22, Q-23, Q-25, Q-26, Q-27), layout-patterns.md (§12 cây collection Q-20, sub-menu Settings Q-24)}
tools/port-manifest/016-T*.json
specs/012-*/spec.md, 013, 014, 015   # "đã gỡ ở 016"
SPECKIT-GUIDE.md, CLAUDE.md
```

**Structure Decision**: `modules/settings/routes/<nhóm>/` giữ cấu trúc Directus (`data-model/`, `roles/`,
`policies/`, `project/`, `appearance/`, `presets/`, `translations/`) để so từng file; store field đặt trong
`routes/data-model/field-detail/store/` như Directus (Pinia `defineStore('fieldDetail')`); interface `_system` theo thư
mục Directus cạnh 8 cái đã có; options component đặt cạnh interface của nó (như Directus `options.vue`); dữ liệu
quyền tĩnh ở `src/permissions/` (mới) cạnh `stores/permissions.ts`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Không có vi phạm constitution. Dữ liệu quyền chép tĩnh (`app-permissions-data.json`, ≈ 8 KB) thay vì import `@backoffice/system-data` | Hộp tạo policy và ma trận cần `appAccessMinimalPermissions`; `libs/system-data` đọc yaml bằng js-yaml lúc chạy (Node) | Import lib: kéo js-yaml vào bundle và đọc yaml trong trình duyệt; sửa lib thành JSON ảnh hưởng API (001–011). Script có test so nguồn (FR-105) như theme 015 |
| Store Pinia `fieldDetail` riêng (không dùng `use-item`) | Drawer field là máy trạng thái với alteration chéo nhiều collection/field/relation; Directus cũng là store riêng; test port `index.test.ts` cần cùng API | Viết lại bằng `use-item`: không có pipeline alteration, mất khả năng so JSON với Directus (SC-006) |
| Tách `use-field-tree` khỏi `FieldList.vue` (014) | 4 chỗ dùng (`system-display-template`, `system-field-tree`, `system-fields`, drawer quyền) | Chép logic 4 lần hoặc dùng `FieldList` dạng ẩn: trùng mã, khó test |
| Mock lồng cho `PATCH /roles`, `PATCH /policies` trong `mockFixtureApi` | Trang role/policy lưu quan hệ lồng, test component cần body đúng | Chỉ E2E: chậm, không chạy trong `quality` |

## Phase 0, 1: kết quả

- research.md: R1 đến R12; [Unverified] kiểm ở T002: API mới nhận quan hệ lồng trong `PATCH /roles|policies` (R6),
  `BoSortableList` lồng với `group` hai cấp (R3), fixture `directus-registry.json` có đủ 18 `_system` (R4), `jiti` chạy
  được `app-permissions.ts` (R5), `useItem` với `directus_collections` (endpoint `/collections`, khóa chính chuỗi) (R2),
  `DIRECTUS_APP_SPECS` nhận thêm spec dùng chéo (R9), `vi-VN.yaml` đủ khóa (R10).
- Release-gate CHK001–CHK105 (`checklists/release-gate.md`) áp toàn bộ 2026-10-16 (owner); thêm research R13, T004, T003.
- data-model.md: route, sub-menu, cây collection, drawer tạo collection, lưới field, store field và alteration, roles,
  policies và ma trận, settings, presets, translations, 18 interface, dữ liệu tĩnh, store, bộ mẫu.
- contracts/: `api-calls.md` (#137–#177), `components.md`, `tests.md`.
- quickstart.md: cài, seed, sync dữ liệu quyền, test, E2E ba cấu hình, payload, bộ so DB, dùng chéo, lint, build.
- Agent context: `CLAUDE.md` cập nhật bằng `update-agent-context.sh claude` ở task đầu lượt 1 (sau khi 015 mở khóa,
  FR-111); dòng Active Technologies 016 soạn sẵn ở quickstart §Đóng.
