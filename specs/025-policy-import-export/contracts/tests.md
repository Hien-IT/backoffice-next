# Contract: Tests (FR-033, Nguyên tắc V, X)

## Unit (`apps/api`, Vitest, knex-mock-client / SQLite bộ nhớ)

| File | Case |
|------|------|
| `database/backoffice-migrations/20261028A-create-backoffice-permissions.test.ts` | version, name; tạo bảng với đúng cột, index, không khóa ngoại; chạy hai lần không lỗi; hai `up` song song (process khác tạo trước) |
| `database/backoffice-migrations/index.test.ts` (nếu có) | danh sách gồm `20261026A`, `20261028A` theo thứ tự |
| `permissions/modules/backoffice-permissions/fetch-backoffice-permissions.test.ts` | một `select` theo policies/collection/action; `parseJSON` chuỗi (SQLite) và object (Postgres); csv `fields`; cache hit không query; `clearPermissionCache` làm miss |
| `.../fetch-backoffice-access.test.ts` | admin; không dòng; một dòng full; bộ lọc → `filter`; `$CURRENT_USER` thay bằng id; hai policy (`_or`, hợp fields, hợp formats, một dòng không `formats` → tất cả); dòng của policy không thuộc người gọi bị bỏ; `rules` một luật mỗi dòng, `forFormat` (FR-011 B) |
| `.../assert-backoffice-action.test.ts` | không quyền → lỗi quyền collection (message, code); định dạng ngoài `formats` → lỗi; có quyền trả access |
| `.../apply-export-access.test.ts` | luật đi theo query, bộ lọc của query giữ nguyên; `fields` thiếu/`*` → fields quyền giao field read; `*` khi quyền `*` giữ; field rõ, `group`, `aggregate` ngoài giới hạn (cả `a.b`) → lỗi |
| `.../export-rules.test.ts`, `process-ast.test.ts`, `inject-cases.test.ts` | luật qua spread, ngoài hash/JSON; cặp read × luật (`_and`, giao field, bỏ cặp rỗng); `processAst` với `exportRules` cho cases và `whenCase` theo cặp; `rootPermissions` chỉ ở tầng gốc (FR-011 D) |
| `middleware/collection-toggles-guard.test.ts` | `?export=` có quyền → `req.sanitizedQuery` có filter/fields; không quyền → 403 trước `next()`; toggle tắt → 403 trước khi xét quyền; `/users?export=`; không `export` → không gọi |
| `controllers/utils.controller.test.ts` | export: 403 không quyền, 403 định dạng, query có filter/fields khi có quyền; import: 403 trước busboy, `rowGuard` truyền vào service, định dạng theo mime; collection hệ thống: không gọi kiểm quyền import |
| `middleware/validate-batch.test.ts` | `SEARCH /items/A`, `SEARCH /users` body `query.export`: không quyền → lỗi; có quyền → filter/fields áp vào `req.sanitizedQuery`; `GET`, `PATCH`, `DELETE` không gọi kiểm; body không `export` → không gọi (analyze C1, CHK015) |
| `services/import-export.service.test.ts` | `rowGuard` gọi mỗi dòng trước `upsertOne` (JSON, CSV); ném → cả file hủy, không `upsertOne` nào sau; không `rowGuard` → như cũ |
| `permissions/modules/fetch-accountability-collection-access/*.test.ts` | admin có `import`, `export` full + formats; user: `none` mặc định, `partial` khi có bộ lọc, hợp fields/formats; collection chỉ có dòng mới vẫn xuất hiện |
| `services/graphql/resolvers/system.test.ts` | `permissions_me` có `import`, `export` |
| `services/backoffice-permissions.service.test.ts` | `cast-json`/`cast-csv` trên bản sao schema (ghi chuỗi, đọc object/mảng); non-admin: `validateAccess` trên `directus_permissions`, ghi với bản sao admin, activity ghi `user` người gọi; `action` ngoài registry → `InvalidPayloadError`; registry có action giả → ghi được, không đổi bảng (SC-006, analyze G1); `clearSystemCache` sau ghi |
| `controllers/backoffice-permissions.controller.test.ts` | 7 route, `useCollection`; `/items/backoffice_permissions` 403 |
| `services/policies.service.test.ts`, `collections.service.test.ts` | xóa policy/collection xóa dòng bảng mới |
| `database/validate-migrations.test.ts` | `start` dừng khi thiếu `20261028A` |

## Unit (`apps/web`)

| File | Case |
|------|------|
| `interfaces/_system/system-permissions/SystemPermissions.test.ts` | 6 cột; 4 cột khi store không có khóa; `getPermission` hai nguồn; All/No access của hàng tạo/xóa dòng ở đúng nguồn, không đụng dòng share; staging `hasEdits` |
| `.../detail/PermissionsDetail.test.ts`, `FormatsTab.test.ts` | tab của import/export; đọc `/backoffice/permissions/:id`; checkbox định dạng, rỗng = tất cả |
| `.../PermissionsRow.test.ts`, `PermissionsToggle.test.ts` | ô mờ + title khi toggle tắt, vẫn bấm được |
| `modules/settings/routes/policies/PolicyItemRoute.test.ts` | lưu policy rồi POST/PATCH/DELETE `/backoffice/permissions`; lỗi nguồn hai giữ staging; guard rời trang |
| `modules/settings/routes/policies/use-duplicate.test.ts` | chép dòng bảng mới |
| `composables/use-permissions/collection/use-collection-permissions.test.ts` | `importAllowed`, `exportAllowed`, `exportFormats` hai chế độ (FR-034) |
| `components/sidebar/ExportSidebarDetail.test.ts`, `BasicImportSidebarDetail.test.ts` | phần export/import theo quyền × toggle; select định dạng lọc; "Download Page as CSV" theo phần export |
| `modules/insights/routes/InsightsOverviewRoute.test.ts` | nút export/import theo quyền |
| `modules/content/routes/ItemRoute.test.ts`, `router/index.test.ts` | không SharesSidebarDetail; không route `shared` |
| `stores/permissions.test.ts` | `hasBackofficeActions` |
| `lang/keys.test.ts` | khóa overlay mới có ở en-US, vi-VN |

## Parity (`tests/parity`, cặp chính Postgres; reduced sqlite3, mysql)

| File | Nội dung |
|------|----------|
| `src/permissions/backoffice-permissions.test.ts` (mới, chạy một mình, thêm vào `suite.ts`) | collection per-run `parity_bo_perm_<run>`; policy P, user U (JWT, static token), public, share, admin; không quyền: export (`GET ?export`, `POST /utils/export`, `SEARCH /items/<c>` và `SEARCH /users` body `query.export`), import → D-189.1 (Directus 200, Backoffice 403, không file, không dòng); có quyền (dòng qua `POST /backoffice/permissions`): `assertParity` export csv/json, import csv/json (dữ liệu hai app giống); Use custom chỉ ở Backoffice: bộ lọc (dòng ngoài không có trong file), field (`*` → chỉ field quyền; field rõ → 403), định dạng (403), import dòng vi phạm (403, đếm item không đổi), cột ngoài (403); hai policy; `/permissions/me` và `permissions_me` (D-189 `jsonPointer`); toggle 024 tắt + có quyền → 403 cả admin; xóa policy ở Backoffice → dòng mất; xóa ở Directus → dòng còn, U vẫn gọi được API; `/items/backoffice_permissions` 403 ở Backoffice, 200 (admin) ở Directus → so riêng; `afterAll` dọn |
| `src/schema-management/*` hoặc profile `bootstrap` | Directus `migrate:latest`, `schema snapshot`, `schema apply` trên DB có bảng mới: không lỗi, bảng còn (US6) |
| `src/collections`, `src/fields`, `src/graphql` | `backoffice_permissions` lọc theo tiền tố (normalizer, `parity.ts:206`) |
| `accepted-differences.ts` | D-189 `http` (`GET /permissions/me`, `POST /graphql/system`, `jsonPointer /^\/data\/(permissions_me\/)?[^/]+\/(import\|export)$/` (CHK007), `directus: { absent: true }`), D-189.1 `http` (`parity_bo_perm_*`, `when.backofficeCode: 'FORBIDDEN'`), D-189.2..D-189.7 `doc` |
| `src/deploy/backoffice-migrations.test.ts` | `['20261026A', '20261028A']` |
| `src/deploy/backoffice-permissions.test.ts` (mới) | `/permissions/me` và `/backoffice/permissions` qua lb không tới Directus (như D-137); `skipIf(SEPARATE)`; cấp quyền qua replica 1, export ở replica 2 được ngay, thu hồi qua replica 2, replica 1 trả 403 (FR-013, analyze G4) |
| profile `bootstrap`, job `deploy`; parity MySQL rút gọn (PR); MSSQL, Oracle, CockroachDB (nightly) | Directus khởi động, `migrate` trên DB có bảng mới (SC-003, analyze G2); migration `20261028A` chạy trong `bootstrap` của env mỗi vendor (CHK030) |

## E2E (`apps/web-e2e`, ba cấu hình)

| Spec | Case |
|------|------|
| `settings-roles-policies.spec.ts` | ma trận: 6 cột (proxy-api, cross-site) / 4 cột (proxy-directus); không cột Share; bật export `bo_std`, Use custom `csv`, lưu, tải lại; nhân bản có dòng mới |
| `settings-permissions-bo.spec.ts` (mới) | `bo-editor` không export → không phần export ở Content `bo_content`; admin cấp (API) → có, chỉ `csv`; Users, Files, Insights; proxy-directus: theo read (FR-034) |
| `content-sidebar.spec.ts`, `payload/comments-shares.spec.ts` | không mục Shares; bỏ case share, giữ comment; `content-share.spec.ts` xóa |
| `content-collection-toggles.spec.ts` | admin có quyền nhưng toggle tắt → vẫn không phần export (không đổi) |

## Benchmark

`benchmark-items` hiện có (SC-007): request đọc không `export` không thêm bước (guard chỉ chạy khi có `export`).
