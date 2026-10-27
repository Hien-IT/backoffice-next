# Implementation Plan: Quyền Import, Export theo policy, bỏ Share khỏi giao diện

**Branch**: `025-policy-import-export` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=025-policy-import-export`) | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-policy-import-export/spec.md`

## Summary

Import và export thành hai action cùng cấp create, read, update, delete: admin cấp theo policy trên từng collection (kể
cả collection hệ thống), có Use custom (bộ lọc dòng, field, định dạng file); API Backoffice từ chối `?export=`,
`POST /utils/export`, `POST /utils/import` khi policy không cho (403 cùng lỗi 024, D-189.1), sau toggle 024 (toggle tắt
chặn mọi người); `GET /permissions/me` và `permissions_me` thêm `import`, `export` (D-189); quyền lưu ở bảng hệ thống
mới `backoffice_permissions` (migration riêng `20261028A`, không khóa ngoại, `action` chuỗi + `options` JSON để thêm
action sau không đổi schema), ghi qua endpoint riêng `/backoffice/permissions` (D-189.6); web: ma trận 6 cột không
share, drawer Use custom, phần import/export ở Content, Users, Files, Presets, Translations, Insights theo quyền; bỏ
mục Shares và `/shared/:id` (D-189.4); lb và Ingress đưa `/permissions/me`, `/backoffice/*` về Backoffice (D-189.7).
Directus 11.17.4 cùng DB không đổi hành vi; không dependency mới; không sửa constitution.

Cách làm (chi tiết ở [research.md](./research.md)): migration + collection hệ thống ẩn, SchemaOverview dùng chung giữ
bản Directus dựng, service vá `special` cục bộ (R1, R6); registry action trong `libs/constants` (R2); module
`permissions/modules/backoffice-permissions/` (fetch có `withCache`, cộng dồn `mergePermissions`, assert cùng lỗi 024,
`applyExportAccess` đưa bộ lọc/field vào query để engine đọc làm phần giao với read) gọi ở guard 024 và
`utils.controller` (R3, R4); `ImportService` nhận `rowGuard` tùy chọn (R3); `/permissions/me` (R5); web hai nguồn với
staging `provide/inject`, drawer thêm `FormatsTab`, `use-collection-permissions` thêm `importAllowed`/`exportAllowed`
với luật Directus khi API là Directus (R7, R8); bỏ share (R9); lb/Ingress (R10); parity, E2E (R11, R12); ba lượt
(R13); sửa câu chữ spec (R14).

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict (cờ của `@directus/tsconfig`), Node.js 22 LTS, ESM, pnpm 10.27, Nx 23;
swc build cho `apps/api`; Vite cho `apps/web`.

**Primary Dependencies**: có sẵn, không thêm: NestJS 12 (Express 5), Knex 3.1, `@backoffice/memory` (cache `permissions`
multi/Redis), `@backoffice/utils` (`parseJSON`, `validatePayload`, `toArray`), `@backoffice/errors`, `@backoffice/validation`
(`FailedValidationError`), lodash-es; web: Vue 3.5, Pinia, Reka UI 2.8.2, Tailwind CSS 4.3, `@directus/sdk` 21.3.0; test:
Vitest 3.2.4, knex-mock-client, SQLite bộ nhớ, Playwright 1.64.0, autocannon.

**Storage**: bảng mới `backoffice_permissions` (migration riêng `20261028A`, `backoffice_migrations`), không khóa ngoại,
không dòng `directus_*`; cache quyền `withCache('backoffice-permissions')` trong namespace `permissions` dùng chung (xóa
bởi `clearSystemCache` ở cả hai app); response cache dùng chung không đổi (D-189.2).

**Testing**: Vitest unit (API: migration, module `backoffice-permissions`, guard, `utils.controller`, `import-export.service`
(`rowGuard`), `fetch-accountability-collection-access`, `backoffice-permissions.service`/`controller`, `policies`,
`collections`, `validate-migrations`; web: `SystemPermissions`, `PermissionsDetail`, `FormatsTab`, `PermissionsRow`,
`PolicyItemRoute`, `use-duplicate`, `use-collection-permissions`, `ExportSidebarDetail`, `InsightsOverviewRoute`,
`ItemRoute`, router, store, lang keys); parity `src/permissions/backoffice-permissions.test.ts` (D-189, D-189.1), deploy
`backoffice-migrations`, `backoffice-permissions` (lb); E2E `settings-roles-policies`, `settings-permissions-bo` (mới),
`content-sidebar`, `payload/comments-shares` ba cấu hình; benchmark `benchmark-items` hiện có (SC-007). Chi tiết
[contracts/tests.md](./contracts/tests.md).

**Target Platform**: Linux `amd64` container (API), trình duyệt desktop/tablet (Chrome, Edge, Firefox, Safari).

**Project Type**: BE (`apps/api`, `libs/constants`, `libs/types`, `libs/system-data`) + FE (`apps/web`, `apps/web-e2e`)
+ deploy (`deploy/compose`, `deploy/helm`) + test (`tests/parity`).

**Performance Goals**: scenario benchmark hiện có không tệ hơn Directus quá 10 % (SC-007): request đọc không `export`
không thêm bước; request export/import thêm `fetchPolicies` (đã cache) và một `select` nhỏ (cache `permissions`);
`/permissions/me` thêm một `select` theo policies.

**Constraints**: không sửa `directus/` (I); chỉ bảng `backoffice_*` qua migration riêng, không `directus_fields` cho
bảng mới, SchemaOverview dùng chung giữ bản Directus dựng (II, 002); API giống Directus trừ D-189..D-189.7 (III, V);
chỉ kiểm ở lớp HTTP, `ExportService` không đổi, `ImportService` chỉ thêm hook tùy chọn (FR-014); không biến env mới
(VIII); comment code ghi "DR" (IX); coverage BE ≥ 80 %, FE ≥ 60 % (X); giao diện: không màu, token, component mới
(XII).

**Scale/Scope**: API ~9 file mới (migration + test, 4 file module `backoffice-permissions` + test, service, controller,
deploy test) + ~12 file sửa (`backoffice-migrations/index.ts`, `collections.yaml`, `graphql/schema/index.ts`,
`libs/constants`, `libs/types`, guard, `utils.controller.ts`, `import-export.service.ts`,
`fetch-accountability-collection-access.ts`, `policies.service.ts`, `collections.service.ts`, `app.module.ts`); web ~4 file
mới (`FormatsTab.vue`, staging composable, E2E spec, overlay keys) + ~14 sửa, ~4 xóa (`SharesSidebarDetail`,
`SharedRoute`, `content-share.spec.ts` và test); deploy 2 file; parity 4 file; docs 5 file; D-189..D-189.7.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.2.0). Mark PASS, or VIOLATION with
a row in Complexity Tracking.

- [x] I. PASS: không file nào trong `directus/` đổi; file port sửa (`collection-toggles-guard.ts` là của Backoffice;
  `utils.controller.ts`, `import-export.service.ts`, `fetch-accountability-collection-access.ts`, `policies.service.ts`,
  `collections.service.ts`, `permissions.ts` của types) giữ header nguồn và comment `// Backoffice (spec 025, D-189)` tại
  chỗ sửa; file mới là của Backoffice.
- [x] II. PASS (3.2.0): một migration riêng `20261028A` tạo bảng `backoffice_permissions` (`up` only, Knex, chạy lại
  được, 7 vendor), ghi `backoffice_migrations`, `bootstrap`/`init` chạy, `start` kiểm (có sẵn); không DDL, không dòng
  `directus_*`; không khóa ngoại tới `directus_*`; DB dùng được với Directus 11.17.4 không file, không cấu hình mới
  (bảng chưa quản lý, như D-181); dữ liệu ghi ra (`directus_activity`, `directus_revisions`) cùng dạng.
- [x] III. PASS với D-189..D-189.7 ghi trong spec (chấp nhận 2026-10-28, chủ dự án kiêm tech lead duyệt 2026-10-28 sau
  plan): mọi request không
  nêu giữ path, query, response, status, header, cookie như Directus; request bị chặn 403 cùng lỗi quyền collection;
  `/permissions/me` thêm khóa, không đổi khóa cũ; GraphQL schema không đổi.
- [x] IV. PASS: cache quyền mới trong namespace `permissions` dùng chung, xóa bởi `clearSystemCache` ở cả hai app (qua
  bus); không state riêng trong process; không lock, không bus mới; response cache chung không đổi key (D-189.2).
- [x] V. PASS: parity `src/permissions/backoffice-permissions.test.ts` (D-189 `jsonPointer`, D-189.1 `http` theo
  `parity_bo_perm_*`, `assertParity` khi có quyền, Use custom per app, public, share, admin, xóa policy/collection ở hai
  app, Directus `schema snapshot`/`apply` trên DB có bảng), deploy tests; blackbox không đổi (contracts/tests.md).
- [x] VI. PASS: `BackofficePermissionsService extends ItemsService` như `PermissionsService`, controller mỏng; module
  kiểm quyền trong `permissions/modules/`; Knex; Vue 3 Composition API, composable staging nhỏ.
- [x] VII. PASS: migration riêng dưới lock dùng chung (runner 022); cache rebuild từ DB, xóa qua bus Redis trên mọi
  instance; lb/Ingress route tĩnh; FE không cấu hình mới.
- [x] VIII. PASS: không biến môi trường mới.
- [x] IX. PASS: chuỗi mới chỉ ở overlay en-US/vi-VN (`bo_formats`, `bo_formats_hint`, `bo_toggle_off_hint`); lỗi là
  `ForbiddenError` có sẵn; comment "DR".
- [x] X. PASS: coverage qua unit test (contracts/tests.md); hiệu năng: guard chỉ chạy khi có `export`, benchmark hiện
  có; log pino không đổi (403 như lỗi quyền); không email; khác biệt D-189..D-189.7 trong spec; tài liệu
  (quickstart, `deploy/README`, migration-guide) ghi không seed và giới hạn shared-domain.
- [x] XI. PASS: không chạm mục ngoài phạm vi.
- [x] XII. PASS: đã đọc `design-system/README.md`, `docs/component-specs.md`, `docs/layout-patterns.md`,
  `qa/handoff-checklist.md`; cột mới dùng `PermissionsToggle`/`PermissionsRow` có sẵn; tab mới `FormatsTab` trên
  `BoTabs` + checkbox của design-system; ô mờ bằng `opacity-50` + `title` (tooltip đọc được, vẫn focus/bấm được bằng
  bàn phím); không hex, không palette ngoài theme; không câu hỏi mở.

Post-design re-check (sau Phase 1): không đổi; "Sửa câu chữ spec khi plan" (research R14: FR-005, FR-014, FR-020,
D-189.6, D-189.7 path `/backoffice/permissions`, bảng Đánh giá dòng 20) áp vào spec cùng commit plan.

## Project Structure

### Documentation (this feature)

```text
specs/025-policy-import-export/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (R1–R14)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output: api.md, web.md, tests.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
libs/
├── constants/src/backoffice-permissions.ts            # mới: registry action (R2); index.ts export
├── types/src/permissions.ts                           # sửa: CollectionPermissions import?/export? + formats?
└── system-data/src/collections/collections.yaml       # sửa: backoffice_permissions hidden (D-189.5)

apps/api/src/
├── database/backoffice-migrations/
│   ├── 20261028A-create-backoffice-permissions.ts     # mới (+ .test.ts)
│   └── index.ts                                       # sửa: BACKOFFICE_MIGRATIONS
├── permissions/modules/backoffice-permissions/        # mới (R3)
│   ├── fetch-backoffice-permissions.ts                # withCache('backoffice-permissions')
│   ├── fetch-backoffice-access.ts                     # policies → rows → processPermissions → mergePermissions
│   ├── assert-backoffice-action.ts                    # lỗi quyền collection; định dạng
│   └── apply-export-access.ts                         # filter AND, fields giao, field rõ ngoài → lỗi
├── permissions/modules/fetch-accountability-collection-access/
│   └── fetch-accountability-collection-access.ts      # sửa: import, export (R5)
├── middleware/collection-toggles-guard.ts             # sửa: ?export= → assert + applyExportAccess (R3)
├── controllers/
│   ├── utils.controller.ts                            # sửa: import (rowGuard), export (R3)
│   └── backoffice-permissions.controller.ts           # mới: /backoffice/permissions (R6, + .test.ts)
├── services/
│   ├── backoffice-permissions.service.ts              # mới: extends ItemsService (R6, + .test.ts)
│   ├── import-export.service.ts                       # sửa: options.rowGuard (R3)
│   ├── policies.service.ts                            # sửa: deleteMany xóa theo (R6)
│   ├── collections.service.ts                         # sửa: deleteOne xóa theo (R6)
│   └── graphql/schema/index.ts                        # sửa: SYSTEM_DENY_LIST
└── app.module.ts                                      # sửa: controller + useCollection

apps/web/src/
├── interfaces/_system/system-permissions/
│   ├── app-permissions.ts                             # sửa: 6 action, backofficeActions (R2, R7)
│   ├── SystemPermissions.vue, PermissionsRow.vue, PermissionsToggle.vue   # sửa (R7)
│   ├── use-bo-permissions-staging.ts                  # mới: staging + provide/inject key (R7)
│   └── detail/PermissionsDetail.vue, detail/FormatsTab.vue   # sửa / mới (R7)
├── modules/settings/routes/policies/PolicyItemRoute.vue, use-duplicate.ts   # sửa (R7)
├── composables/use-permissions/collection/use-collection-permissions.ts     # sửa (R8)
├── stores/permissions.ts                              # sửa: hasBackofficeActions, formats (R8)
├── components/sidebar/ExportSidebarDetail.vue, BasicImportSidebarDetail.vue   # sửa (R8)
├── modules/insights/routes/InsightsOverviewRoute.vue  # sửa (R8)
├── modules/content/routes/ItemRoute.vue               # sửa: bỏ SharesSidebarDetail (R9)
├── components/sidebar/SharesSidebarDetail.vue, routes/SharedRoute.vue        # xóa (R9)
├── router/index.ts                                    # sửa: bỏ route shared (R9)
└── lang/overlay/{en-US,vi-VN}.ts                      # sửa: 3 khóa

apps/web-e2e/src/
├── settings-roles-policies.spec.ts, content-sidebar.spec.ts, payload/comments-shares.spec.ts   # sửa
├── settings-permissions-bo.spec.ts                    # mới
└── content-share.spec.ts                              # xóa

deploy/
├── compose/lb/shared-domain.conf                      # sửa: /permissions/me, /backoffice/ → bo_pool (R10)
├── helm/backoffice/templates/ingress.yaml             # sửa: hai path tới -api-only (R10)
└── README.md                                          # sửa: migration 20261028A, không seed, lb

tests/parity/
├── accepted-differences.ts                            # D-189..D-189.7
├── src/normalizers.ts, src/parity.ts, src/suite.ts    # sửa: tiền tố backoffice_, file mới
├── src/permissions/backoffice-permissions.test.ts     # mới
└── src/deploy/backoffice-migrations.test.ts, backoffice-permissions.test.ts   # sửa / mới
```

**Structure Decision**: Nx monorepo có sẵn; không project mới. Module kiểm quyền đặt cạnh các module quyền đã port
(`apps/api/src/permissions/modules/`), service và controller theo mẫu `permissions.*`; web theo cấu trúc interface
`system-permissions` của 016.

## Complexity Tracking

Không có vi phạm. Hai chỗ đáng ghi (không phải vi phạm):

| Điểm | Vì sao | Cách đơn giản hơn bị loại vì |
|------|--------|------------------------------|
| `ImportService.import` nhận `rowGuard` tùy chọn (sửa file port) | Use custom import phải kiểm từng dòng trong stream; parser CSV/JSON nằm trong service | Parse lại file ở controller trùng parser; kiểm trong service thì flow/extension bị chặn (FR-014) |
| `BackofficePermissionsService` chạy `ItemsService` với bản sao accountability `admin: true` sau `validateAccess` trên `directus_permissions` | Engine không có dòng quyền nào trên bảng mới cho người không phải admin; owner muốn luật như `directus_permissions` | Service Knex thuần phải tự ghi activity, revisions, auto purge (trùng `ItemsService`) |
