---

description: "Danh sách task cho feature 025: Quyền Import, Export theo policy, bỏ Share khỏi giao diện"
---

# Tasks: Quyền Import, Export theo policy, bỏ Share khỏi giao diện

**Input**: Tài liệu thiết kế trong `/specs/025-policy-import-export/`
**Prerequisites**: `plan.md`, `spec.md` (D-189..D-189.7 và R1–R10 duyệt 2026-10-28). Dùng thêm `research.md` (R1–R14),
`data-model.md`, `contracts/` (`api.md`, `web.md`, `tests.md`), `quickstart.md`, `checklists/requirements.md`.

**Điều kiện bắt đầu**: spec, plan, tasks 025 đã commit lên `main` (commit `docs(025): spec, plan, tasks`). Làm trên
`main`, không branch; script `.specify` cần `SPECIFY_FEATURE=025-policy-import-export`. Checkout dùng chung với các
phiên khác: `git add` theo đường dẫn, không `git add -A`/`.`, không `stash`, `reset`, `checkout --`; không stage
`apps/api/project.json`, `apps/web/project.json`; push khi `main` không có run CI đang chạy (push hủy run cũ), rồi báo
số run cho các phiên đang chạy. Không sửa file dưới `directus/`. Máy local: chạy test từng file, `--maxWorkers=1`;
không dừng container của phiên khác.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Endpoint đổi: `?export=` (mọi route trả item), `POST /utils/export`, `POST /utils/import`, `GET /permissions/me`,
  `permissions_me` của `/graphql/system`, `DELETE /policies`, `DELETE /collections`; endpoint mới `/backoffice/permissions`.
  Đối chiếu: `parity/permissions/backoffice-permissions.test.ts` (D-189, D-189.1 `http`; `assertParity` khi có quyền),
  test hiện có không đổi kết quả ngoài D-189.x (SC-002); E2E ba cấu hình.
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).

**Organization**: Task nhóm theo user story, xếp theo ba lượt commit (research R13): **Lượt 1** (API) = Phase 1, 2, 3
(US1 API), 4 (US2), 5 (US4 API), 6 (US3 API), 7 (US6, gồm sửa test và E2E hiện có export/import bằng người không phải
admin, vì lượt 1 làm chúng đỏ: analyze O1); **Lượt 2** (Web) = Phase 8 (US1 web), 9 (US3 web), 10 (US4 web), 11 (US5);
**Lượt 3** (deploy, tài liệu) = Phase 12, 13. Mỗi lượt kết thúc bằng task "đóng lượt" (lint,
typecheck, test, build, E2E liên quan xanh, commit, push khi `main` rảnh, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task (spec.md).
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `gql/` = `apps/api/src/services/graphql/`; `bop/` =
  `apps/api/src/permissions/modules/backoffice-permissions/`; `web/` = `apps/web/src/`; `sp/` =
  `apps/web/src/interfaces/_system/system-permissions/`; `e2e/` = `apps/web-e2e/src/`; `parity/` = `tests/parity/src/`.
- Comment code ghi Directus là "DR" (constitution IX). File port sửa giữ header nguồn và ghi `// Backoffice (spec 025,
  D-189...): ...` tại chỗ sửa; file mới ghi `// Backoffice (spec 025, D-189...)` ở đầu.
- Không biến env mới (VIII). Không DDL hay dòng `directus_*` (II); chỉ migration riêng `20261028A`.
- Lỗi chặn: đúng `createCollectionForbiddenError(path, collection)` của
  `api/permissions/modules/process-ast/utils/validate-path/create-error.ts` (FR-008, như 024); test so theo câu `You
  don't have permission to access collection "<c>" or it does not exist. Queried in root.`.
- Thứ tự kiểm: toggle 024 trước (`assertToggle`/`assertCollectionToggles`), rồi quyền policy (FR-009).
- Lệnh test: `pnpm nx run api:test -- <file>`, `pnpm nx run web:test -- <file>`, `pnpm nx run parity-tests:env-up
  --vendor=postgres` rồi `pnpm nx run parity-tests:test -- src/permissions/backoffice-permissions.test.ts`,
  `TEST_DB=sqlite3` cho SQLite, `E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- <spec>` (tên target kiểm lại trong
  `project.json` của từng project khi làm).

---

## Phase 1: Setup (chốt [Inference] của research, lượt 1)

**Purpose**: xác nhận các suy luận của research trước khi viết code; ghi kết quả vào research.md.

- [ ] T001 Kiểm và ghi "Kết quả T001" vào `specs/025-policy-import-export/research.md`: (a) `apps/web` import được
      `@backoffice/constants` trong Vite và Vitest không (`apps/web/package.json`, `vite.config`); không được thì R2 giữ
      bản sao ở `sp/app-permissions.ts`; (b) sau khi tạo bảng thử trên SQLite và Postgres, `getSchema()` của Backoffice
      cho `backoffice_permissions` các field không có `special`, collection `accountability: 'all'`, giống bản Directus
      dựng (so `GET /schema/snapshot`? không: so SchemaOverview qua log hoặc test unit `api/utils/get-schema`) (R1);
      (c) `processPermissions` (`api/permissions/utils/process-permissions.ts`) và `fetchDynamicVariableData` nhận dòng
      bảng mới (cùng khóa `permissions`, `validation`, `presets`, `fields`, `policy`, `collection`, `action`) (R3); (d) chữ
      ký `mergePermissions` ở `api/permissions/utils/merge-permissions.ts` (R3); (e) `ItemsService.createOne` với bản sao
      accountability `admin: true` ghi `directus_activity.user` là user của bản sao (R6); (f)
      `deploy/helm/backoffice/ci/kind-test.sh:161` có kiểm danh sách version migration riêng không (R1); (g) status
      Directus 11.17.4 cho `GET /users?export=csv`, `POST /utils/import/directus_dashboards` với user không phải admin có
      quyền read/create/update (spec US2-8).
- [ ] T002 [P] Rà test hiện có export hay import bằng người gọi không phải admin (sau 025 người đó nhận 403 ở Backoffice,
      không seed); ghi "Kết quả T002" (file, case, người gọi, cách sửa: cấp dòng qua `POST /backoffice/permissions` ở
      bước chuẩn bị khi app là Backoffice, hoặc tách kỳ vọng theo app) vào research.md: `parity/items/export.test.ts`,
      `parity/system/import-export.test.ts`, `parity/items/crud.test.ts`, `parity/items/json-path.test.ts`,
      `parity/items/collection-toggles.test.ts`, `parity/system/e2e-app.test.ts`, `parity/request-set.ts`,
      `parity/extensions/endpoints.test.ts`, `parity/observability/logs.test.ts`, `parity/schema-management/schema.test.ts`,
      `parity/proxy-conf.test.ts`, `parity/items/blackbox/**`, `e2e/content-export-import.spec.ts`,
      `e2e/files-users-permissions.spec.ts`, `e2e/files-library.spec.ts`, `e2e/insights-overview.spec.ts`,
      `e2e/content-collection-toggles.spec.ts`, `e2e/payload/utils.spec.ts`, `e2e/payload/insights*.spec.ts`. Flow,
      extension gọi service: không đổi (FR-014).

---

## Phase 2: Foundational (bảng, registry, đọc quyền, lượt 1)

**Purpose**: bảng `backoffice_permissions`, registry action, module đọc và cộng dồn quyền; mọi story API cần phase này.

**⚠️ CRITICAL**: chưa xong phase này thì chưa làm story nào.

### Tests (MANDATORY) ⚠️

- [ ] T003 [P] Tạo `api/database/backoffice-migrations/20261028A-create-backoffice-permissions.test.ts` (SQLite bộ nhớ +
      `runSeed`, như `20261026A-add-collection-ui-toggles.test.ts`): `version = '20261028A'`, `name = 'Create Backoffice
      Permissions'`; cột và nullability theo data-model.md (`policy` not null, `action` not null, còn lại nullable);
      index `(policy, collection, action)` có, không unique; `inspector.foreignKeys('backoffice_permissions')` rỗng;
      `up` hai lần không lỗi; `createTable` ném nhưng bảng đã có (process khác tạo trước, mock) → không ném. Chạy đỏ.
- [ ] T004 [P] Thêm case vào test của danh sách migration (`api/database/backoffice-migrations/run.test.ts`): danh sách
      `BACKOFFICE_MIGRATIONS` là `['20261026A', '20261028A']` theo thứ tự; `api/database/validate-migrations.test.ts`:
      thiếu `20261028A` trong `backoffice_migrations` → `start` dừng với thông báo migration thiếu. Chạy đỏ.
- [ ] T005 [P] Tạo `libs/constants/src/backoffice-permissions.test.ts`: khóa `import`, `export`; `requires`; `formats`
      (`csv`, `json` / `csv`, `csv_utf8`, `json`, `xml`, `yaml`); `PERMISSION_ACTIONS` vẫn 5 action. Chạy đỏ.
- [ ] T006 [P] Tạo `bop/fetch-backoffice-permissions.test.ts` (knex-mock-client, cache `permissions` local): một `select`
      `backoffice_permissions` `whereIn policy`, lọc `collection`, `action` khi có; `permissions`, `options` chuỗi (SQLite)
      và object (Postgres) → object; `fields` csv → mảng, null giữ null; lần hai cùng tham số không query (`withCache`);
      `clearCache()` (`api/permissions/cache.ts`) → query lại. Chạy đỏ.
- [ ] T007 [P] Tạo `bop/fetch-backoffice-access.test.ts`: admin → `{ allowed: true, filter: null, fields: ['*'], formats:
      <tất cả> }` không query; không dòng → `allowed: false`; một dòng không bộ lọc → `filter: null`, `fields` theo dòng;
      bộ lọc có `$CURRENT_USER` → thay bằng id; hai policy → `_or` bộ lọc, hợp `fields`, `['*']` nếu một dòng `*`, hợp
      `formats`, một dòng không `options.formats` → tất cả; dòng của policy không thuộc người gọi không ảnh hưởng (mock
      `fetchPolicies`). Chạy đỏ.
- [ ] T008 [P] Tạo `bop/assert-backoffice-action.test.ts`: không `allowed` → lỗi quyền collection (message, code
      `FORBIDDEN`, `Queried in root`); `format` ngoài `formats` → cùng lỗi; `format` undefined → chỉ xét `allowed`; có quyền
      → trả access. Chạy đỏ.
- [ ] T009 [P] Thêm case vào `parity/normalizers.test.ts` (tạo nếu chưa có): introspection và SDL có type
      `backoffice_permissions*` bị bỏ như `backoffice_migrations*`; `/collections`, `/fields` bỏ mọi `backoffice_*`.
      Chạy đỏ.

### Implementation

- [ ] T010 Tạo `api/database/backoffice-migrations/20261028A-create-backoffice-permissions.ts` (research R1): `hasTable`
      → `createTable` trong `try` (catch: `hasTable` lại, có thì bỏ qua) với các cột của data-model.md (`increments id`,
      `uuid policy` not null, `string(64) collection` nullable, `string(64) action` not null, `json permissions`,
      `validation`, `presets`, `options`, `text fields`), `table.index(['policy', 'collection', 'action'])`; không
      `foreign()`; thêm vào `BACKOFFICE_MIGRATIONS` ở `api/database/backoffice-migrations/index.ts:15`. T003, T004 xanh.
- [ ] T011 [P] Tạo `libs/constants/src/backoffice-permissions.ts` (research R2: `BACKOFFICE_EXPORT_FORMATS`,
      `BACKOFFICE_IMPORT_FORMATS`, `BACKOFFICE_PERMISSION_ACTIONS`, `BackofficePermissionsAction`, ánh xạ mime import →
      định dạng) và export ở `libs/constants/src/index.ts`. T005 xanh.
- [ ] T012 [P] Sửa `libs/types/src/permissions.ts`: type `BackofficePermission` (dòng bảng mới, `options: { formats?:
      string[] } | null`); `CollectionPermissions` thêm `import?`, `export?` (cùng dạng action + `formats?: string[]`);
      `PermissionsAction` không đổi.
- [ ] T013 [P] Đăng ký collection hệ thống: `libs/system-data/src/collections/collections.yaml` thêm
      `backoffice_permissions` (`hidden: true`, không `note`, cạnh `backoffice_migrations:129`, comment spec 025
      D-189.5); `gql/schema/index.ts:50` thêm `'backoffice_permissions'` vào `SYSTEM_DENY_LIST`; build `libs/system-data`
      (dist) như 022; test `libs/system-data` `isSystemCollection('backoffice_permissions') === true`.
- [ ] T014 Tạo `bop/fetch-backoffice-permissions.ts`, `bop/fetch-backoffice-access.ts`, `bop/assert-backoffice-action.ts`
      (research R3; `withCache('backoffice-permissions', ...)` của `api/permissions/utils/with-cache.ts`; `fetchPolicies`;
      `processPermissions` + `fetchDynamicVariableData` như `api/permissions/lib/fetch-permissions.ts:24-42`;
      `mergePermissions` theo Kết quả T001 (d); `parseJSON` của `@backoffice/utils`). T006–T008 xanh.
- [ ] T015 Sửa `parity/normalizers.ts:122` (introspection, SDL) và `parity/parity.ts:206` (`backofficeCollections`) lọc
      theo tiền tố `backoffice_` thay tên `backoffice_migrations`; sửa `parity/deploy/backoffice-migrations.test.ts:30` chờ
      `['20261026A', '20261028A']`; sửa `deploy/helm/backoffice/ci/kind-test.sh` nếu Kết quả T001 (f) thấy danh sách
      version. T009 xanh.

**Checkpoint**: migration chạy, bảng là collection hệ thống ẩn, đọc và cộng dồn quyền có test; parity hiện có không
lệch vì bảng mới.

---

## Phase 3: User Story 1 - Admin cấp quyền Import, Export (API: service, endpoint, xóa theo) (Priority: P1) 🎯 MVP

**Goal**: `/backoffice/permissions` đọc, ghi dòng quyền như `/permissions`; xóa policy, collection qua Backoffice xóa
dòng theo (FR-020, FR-021, D-189.6).

**Independent Test**: admin `POST /backoffice/permissions` một dòng export, `GET` lại, `PATCH`, `DELETE`; activity có
dòng; xóa policy → dòng mất; Directus `GET /backoffice/permissions` → 404.

### Tests for User Story 1 (MANDATORY) ⚠️

- [ ] T016 [P] [US1] Tạo `api/services/backoffice-permissions.service.test.ts`: ghi `permissions`/`options` object →
      DB chuỗi JSON (SQLite) và đọc lại object; `fields` mảng ↔ csv (bản sao schema có `special`, schema dùng chung không
      bị sửa: so object gốc); `action` ngoài registry → `InvalidPayloadError`; người không phải admin không có quyền
      `create` trên `directus_permissions` → `ForbiddenError`, có quyền → ghi được, `directus_activity.user` là người gọi;
      `clearSystemCache` gọi sau mỗi ghi; `CACHE_AUTO_PURGE=true` → `cache.clear()`; registry mock có action giả
      `revert` → ghi được dòng `action = 'revert'` không cần migration (SC-006, analyze G1). Chạy đỏ.
- [ ] T017 [P] [US1] Tạo `api/controllers/backoffice-permissions.controller.test.ts` (dạng
      `api/controllers/permissions.controller.test.ts`): 7 route của contracts/api.md §4 (một và nhiều, batch `PATCH`,
      `{ keys, data }`, `DELETE` mảng, `GET /:pk`), `useCollection('backoffice_permissions')`; `GET
      /items/backoffice_permissions` → 403 (`isSystemCollection`). Chạy đỏ.
- [ ] T018 [P] [US1] Thêm vào `api/services/policies.service.test.ts`: `deleteMany([p])` xóa dòng `backoffice_permissions`
      có `policy = p`, giữ dòng của policy khác; `api/services/collections.service.test.ts`: `deleteOne('A')` xóa dòng có
      `collection = 'A'`. Chạy đỏ.

### Implementation for User Story 1

- [ ] T019 [US1] Tạo `api/services/backoffice-permissions.service.ts` (research R6): `extends ItemsService`, bản sao
      schema vá `special` cho `permissions`, `validation`, `presets`, `options` (`cast-json`) và `fields` (`cast-csv`);
      mỗi phương thức ghi/đọc: không admin → `validateAccess({ collection: 'directus_permissions', action })` rồi chạy với
      bản sao accountability `admin: true`; kiểm `action` thuộc `BACKOFFICE_PERMISSION_ACTIONS`; `clearCaches` như
      `api/services/permissions.service.ts:30-36`. Đăng ký provider như các service khác (`serviceProviders`). T016 xanh.
- [ ] T020 [US1] Tạo `api/controllers/backoffice-permissions.controller.ts` (`@Controller('backoffice/permissions')`,
      route và thân như `api/controllers/permissions.controller.ts`, bỏ `/me`); đăng ký ở `api/app.module.ts` (`controllers`,
      `consumer.apply(useCollection('backoffice_permissions'))`). T017 xanh.
- [ ] T021 [US1] Sửa `api/services/policies.service.ts` `deleteMany` (dòng 98) và `api/services/collections.service.ts`
      `deleteOne` (cạnh dòng 711): xóa dòng `backoffice_permissions` theo policy, collection (comment spec 025 FR-021).
      T018 xanh.
- [ ] T022 [US1] Tạo `parity/permissions/backoffice-permissions.test.ts` (chạy một mình như
      `parity/items/collection-toggles.test.ts`; thêm vào `parity/suite.ts`): collection per-run `parity_bo_perm_<run>`,
      policy P, user U qua `parity/permissions/fixtures.ts` (`createPolicy`, `attachPolicy`, `createUser`); phần
      endpoint: CRUD `/backoffice/permissions` ở Backoffice (status, body, activity), Directus 404; `GET
      /items/backoffice_permissions` Backoffice 403, Directus (admin) 200 (so riêng, D-189.5); xóa policy, collection ở
      Backoffice → dòng mất; `afterAll` dọn. Thêm vào `tests/parity/accepted-differences.ts` D-189.5, D-189.6 `doc`
      (`feature: '025'`).

**Checkpoint**: admin ghi được quyền import, export qua API; chưa có kiểm ở export, import.

---

## Phase 4: User Story 2 - API kiểm quyền Import, Export theo policy (Priority: P1)

**Goal**: `?export=`, `POST /utils/export`, `POST /utils/import` cần quyền theo policy, sau toggle 024; admin luôn có;
mọi collection kể cả hệ thống; nhiều policy cộng dồn (FR-006..FR-013, D-189.1).

**Independent Test**: U có read, create, update trên `A` nhưng không có import, export → ba đường 403; cấp export →
`?export=csv` 200 giống Directus; `/users?export=csv` 403 khi không cấp trên `directus_users`.

### Tests for User Story 2 (MANDATORY) ⚠️

- [ ] T023 [P] [US2] Thêm vào `api/middleware/collection-toggles-guard.test.ts`: `GET /items/A?export=csv` không quyền →
      lỗi trước `next`; có quyền → `next()`; toggle export tắt + có quyền → lỗi toggle (không gọi `fetchBackofficeAccess`);
      `/users?export=json` → xét `directus_users`; không `export` → không gọi `fetchBackofficeAccess`; `POST /items/A?export=csv`
      không quyền → lỗi. Chạy đỏ.
- [ ] T024 [P] [US2] Thêm vào `api/controllers/utils.controller.test.ts`: `POST /utils/export/A` không quyền → lỗi, không
      gọi `exportToFile`; `POST /utils/import/A` không quyền → lỗi trước busboy (không đọc stream); toggle tắt → lỗi toggle
      trước; `POST /utils/import/directus_dashboards` → không gọi `fetchBackofficeAccess` (để `ImportService` từ chối
      người không phải admin như Directus, analyze I1). Chạy đỏ.
- [ ] T025 [P] [US2] Thêm vào `api/middleware/validate-batch.test.ts`: `SEARCH` (`req.collection = 'A'` như
      `/items/A`, và `'directus_users'` như `/users`) body `{"query":{"export":"csv"}}` không quyền → lỗi quyền collection
      trước `next`; có quyền → `next()`; body không `export` → không gọi `fetchBackofficeAccess`; `GET`, `PATCH`,
      `DELETE` không gọi (analyze C1, checklist CHK015). Chạy đỏ.

### Implementation for User Story 2

- [ ] T026 [US2] Sửa `api/middleware/collection-toggles-guard.ts`: sau `assertCollectionToggles` (dòng 33), khi
      `req.sanitizedQuery.export` và `target` có trong `req.schema.collections`: `assertBackofficeAction({ accountability:
      req.accountability, collection: target, action: 'export' }, { schema: req.schema, knex: getDatabase() })` (comment
      spec 025 D-189.1). T023 xanh.
- [ ] T027 [US2] Sửa `api/controllers/utils.controller.ts`: `import` (sau `assertToggle`, dòng 127; bỏ qua khi
      `isSystemCollection(collection)`, FR-007) và `export` (sau `assertToggle`, dòng 177) gọi `assertBackofficeAction` với
      `action` tương ứng. T024 xanh.
- [ ] T028 [US2] Sửa `api/middleware/validate-batch.ts` (file port): ngay sau khi gán `req.sanitizedQuery` từ body
      (dòng 27), khi method là `SEARCH` và `req.sanitizedQuery.export`: `assertBackofficeAction({ accountability:
      req.accountability, collection: req.collection, action: 'export' })` (một chỗ cho `SEARCH` của items và 21
      controller hệ thống; toggle 024 vẫn kiểm trong `items.controller.ts search()`; comment spec 025 D-189.1, analyze C1,
      checklist CHK015). T025 xanh.
- [ ] T029 [US2] Thêm phần kiểm vào `parity/permissions/backoffice-permissions.test.ts` (sau T022): không quyền → `GET
      ?export=csv`, `GET /:pk?export=json`, `POST /utils/export`, `POST /utils/import` (csv, json): Directus 200,
      Backoffice 403 lỗi quyền collection, không file, đếm item không đổi (D-189.1); cấp export, import (dòng không Use
      custom) → `assertParity` export csv/json, import (dữ liệu hai app giống); admin không dòng → 200; hai policy chỉ P2
      cấp → 200; public (policy Public, `getPublicPolicy`), share (đăng nhập như `parity/auth/shares.test.ts`), static
      token; toggle 024 tắt + có quyền → 403 cả admin; `GET /users?export=csv` không quyền trên `directus_users` → 403;
      `SEARCH /items/<c>` và `SEARCH /users` body `query.export` không quyền → D-189.1 (analyze C1, CHK015);
      `POST /utils/import/directus_dashboards`
      bằng U → `assertParity` (hai app 403 như nhau, analyze I1).
      Thêm D-189.1 `http` vào `tests/parity/accepted-differences.ts` (`endpoints`: `GET /items/parity_bo_perm_*`, `SEARCH
      /items/parity_bo_perm_*`, `SEARCH /users`, `GET /users`, `POST /utils/export/parity_bo_perm_*`, `POST
      /utils/import/parity_bo_perm_*`; `location: { any: true }`; `when: { backofficeCode: 'FORBIDDEN' }`).

**Checkpoint**: quyền import, export có hiệu lực ở API (bật/tắt); Use custom chưa áp.

---

## Phase 5: User Story 4 - Use custom ở API (bộ lọc dòng, field, định dạng) (Priority: P2)

**Goal**: export áp bộ lọc (AND read), field (giao read, field rõ ngoài → 403), định dạng; import kiểm từng dòng, cột,
định dạng, vi phạm → hủy cả file (FR-015..FR-017).

**Independent Test**: P export `B` với `status = published`, `id,title`, `csv` → file đúng dòng, cột; `json` 403;
`fields=id,body` 403; import CSV một dòng `published` khi bộ lọc `draft` → 403, đếm item không đổi.

### Tests for User Story 4 (MANDATORY) ⚠️

- [ ] T030 [P] [US4] Tạo `bop/apply-export-access.test.ts`: filter AND với filter sẵn có; filter null không đổi query;
      `fields` thiếu hoặc `*` → field quyền; `*` khi quyền `['*']` giữ `*`; field rõ ngoài (cả `a.b` xét `a`) → lỗi quyền
      collection. Chạy đỏ.
- [ ] T031 [P] [US4] Thêm vào `api/services/import-export.service.test.ts`: `rowGuard` gọi mỗi dòng trước `upsertOne`
      (JSON, CSV); `rowGuard` ném ở dòng 2 → promise reject, transaction rollback (không item nào), không `upsertOne` cho
      dòng sau; không `rowGuard` → như cũ. Chạy đỏ.
- [ ] T032 [P] [US4] Thêm vào `api/middleware/collection-toggles-guard.test.ts`, `api/controllers/utils.controller.test.ts`
      và `api/middleware/validate-batch.test.ts` (`SEARCH` body `query.export`):
      định dạng ngoài `formats` → lỗi; có quyền Use custom → `req.sanitizedQuery` (và query của `/utils/export`) có
      filter AND, fields giao; import: mime → định dạng, định dạng ngoài → lỗi, `rowGuard` truyền vào
      `ImportService.import` (cột ngoài `fields` → lỗi; dòng không thỏa bộ lọc → lỗi quyền collection). Chạy đỏ.

### Implementation for User Story 4

- [ ] T033 [US4] Tạo `bop/apply-export-access.ts` (research R3) và thêm tham số `format` vào `bop/assert-backoffice-action.ts`
      (`formats` của access). T030 xanh, T008 vẫn xanh.
- [ ] T034 [US4] Sửa `api/services/import-export.service.ts` (file port): `import(..., options?: { background: boolean;
      rowGuard?: (row: Record<string, unknown>) => void })`; truyền xuống `importJSON`, `importCSV`; gọi `rowGuard(task.data)`
      trong `saveQueue` ngay trước `upsertOne`/`upsertSingleton` (dòng ~356, bản CSV tương ứng), lỗi vào `errorTracker` như
      lỗi ghi (comment spec 025 FR-016). T031 xanh.
- [ ] T035 [US4] Sửa `api/middleware/collection-toggles-guard.ts`, `api/middleware/validate-batch.ts` (`SEARCH`) và
      `api/controllers/utils.controller.ts`: export gọi `assertBackofficeAction(..., format)` rồi
      `applyExportAccess(query, access)` (`req.sanitizedQuery` ở guard và `validate-batch.ts`; `sanitizedQuery` trước
      `exportToFile`); import: kiểm `allowed` trước busboy (T027), khi có file: định dạng từ mime
      (registry T011) → `assertBackofficeAction(..., format)`, `rowGuard` (cột ngoài `access.fields` khi không `*` → lỗi;
      `validatePayload(access.filter, row)` của `@backoffice/utils` có lỗi → lỗi quyền collection). T032 xanh.
- [ ] T036 [US4] Thêm phần Use custom vào `parity/permissions/backoffice-permissions.test.ts` (sau T029; chỉ Backoffice,
      per app): bộ lọc → file không có dòng ngoài; field `*` → chỉ field quyền; field rõ ngoài → 403; định dạng ngoài →
      403 (`?export=` và `POST /utils/export`); import dòng vi phạm, cột ngoài, định dạng ngoài → 403, đếm item không đổi;
      hai policy với bộ lọc, field khác nhau → dòng của policy nào dùng field của policy đó (FR-011).

**Checkpoint**: Use custom có hiệu lực ở API.

---

## Phase 6: User Story 3 - `/permissions/me` có `import`, `export` (API) (Priority: P1)

**Goal**: `GET /permissions/me` và `permissions_me` thêm `import`, `export` kèm `formats` (FR-018, FR-019, D-189).

**Independent Test**: U có export `csv` trên `B` → `/permissions/me` có `B.export.access = 'full'`, `formats: ['csv']`,
`B.import.access = 'none'`; admin có hai khóa `full` ở mọi collection; GraphQL cùng JSON.

### Tests for User Story 3 (MANDATORY) ⚠️

- [ ] T037 [P] [US3] Thêm vào `api/permissions/modules/fetch-accountability-collection-access/fetch-accountability-collection-access.test.ts`:
      admin có `import`, `export` `full`, `['*']`, mọi định dạng; user: mặc định `none`; dòng có bộ lọc → `partial`; hợp
      `fields`, `formats`; collection chỉ có dòng ở bảng mới KHÔNG xuất hiện (như Directus, analyze U1); 5 action cũ không
      đổi. Chạy đỏ.
- [ ] T038 [P] [US3] Thêm vào test resolver system (`gql/resolvers/system.test.ts` hoặc file test hiện có của
      `permissions_me`): kết quả có `import`, `export`; introspection type `permissions_me_type` không đổi. Chạy đỏ.

### Implementation for User Story 3

- [ ] T039 [US3] Sửa `api/permissions/modules/fetch-accountability-collection-access/fetch-accountability-collection-access.ts`
      (file port, research R5): nhánh admin thêm `import`, `export`; nhánh user sau vòng `directus_permissions` đọc dòng
      bảng mới qua `fetchBackofficePermissions({ policies })` và điền như contracts/api.md §3 (comment spec 025 D-189).
      T037, T038 xanh.
- [ ] T040 [US3] Thêm phần `/permissions/me` vào `parity/permissions/backoffice-permissions.test.ts` (sau T036): U có
      dòng → hai app khác chỉ ở `/<c>/import`, `/<c>/export` (D-189 accepted), phần còn lại giống; `permissions_me` của
      `/graphql/system` như trên; admin. Thêm D-189 `http` vào `tests/parity/accepted-differences.ts` (`endpoints: ['GET
      /permissions/me', 'POST /graphql/system']`, `location: { jsonPointer: /^\/data\/(permissions_me\/)?[^/]+\/(import|export)$/
      }` (chỉ khóa của `/permissions/me`, `permissions_me`; checklist CHK007), `directus: { absent: true }`).

**Checkpoint**: web đọc được quyền import, export từ API mới.

---

## Phase 7: User Story 6 - Chạy song song với Directus (API, lượt 1) (Priority: P1)

**Goal**: Directus 11.17.4 cùng DB không đổi hành vi; test hiện có không lệch ngoài D-189.x (FR-030, SC-002, SC-003).

**Independent Test**: bộ đối chiếu và blackbox hiện có xanh; Directus `GET /schema/snapshot`, `POST /schema/diff` với
snapshot của chính nó, `/permissions/me` của U có dòng: không lỗi, bảng còn.

### Tests for User Story 6 (MANDATORY) ⚠️

- [ ] T041 [US6] Thêm phần chạy song song vào `parity/permissions/backoffice-permissions.test.ts` (sau T040): Directus
      `GET /schema/snapshot` không có `backoffice_permissions`; `POST /schema/diff` với snapshot vừa lấy → không thay đổi;
      Directus `GET /permissions/me` cho U có dòng → 200 (US6-2); xóa policy P ở Directus → dòng còn, U gọi export ở
      Backoffice → 403 (không 500), `/permissions/me` Backoffice 200 (US6-3); `GET /server/health` hai app 200.
- [ ] T042 [US6] Sửa test hiện có theo Kết quả T002: cấp dòng `backoffice_permissions` cho người gọi không phải admin
      trong bước chuẩn bị (chỉ khi app là Backoffice, qua `POST /backoffice/permissions` bằng admin), hoặc kỳ vọng theo app
      khi case cố ý so không quyền; không đổi request của Directus.
- [ ] T043 [US6] Sửa E2E hiện có theo Kết quả T002 (lượt 1, analyze O1) (`e2e/content-export-import.spec.ts`, `e2e/files-users-permissions.spec.ts`,
      `e2e/files-library.spec.ts`, `e2e/insights-overview.spec.ts`, `e2e/payload/utils.spec.ts`, `e2e/payload/insights*.spec.ts`):
      người gọi không phải admin cần quyền → cấp trong `beforeAll` khi cấu hình không phải `proxy-directus`.
- [ ] T044 [P] [US6] Thêm vào `tests/parity/accepted-differences.ts` D-189.2, D-189.3, D-189.4, D-189.7 `doc`
      (`feature: '025'`, reason theo bảng khác biệt của spec); `parity/accepted-differences.test.ts` xanh (mọi entry có
      trong spec 025).

### Đóng lượt 1

- [ ] T045 Đóng lượt 1: `pnpm nx run-many -t lint,typecheck -p api constants types system-data parity-tests`; `api:test`
      các file đã sửa, `bop/`, `api/permissions/`, `api/services/import-export*`, `api/database/backoffice-migrations/`
      (coverage BE ≥ 80 %); `api:build`; parity Postgres `src/permissions/backoffice-permissions.test.ts` và các file của
      T042, SQLite reduced; profile parity `bootstrap` (Directus trên DB có bảng mới, migrate chéo; SC-003, analyze G2);
      E2E của T043 local `proxy-api` và `proxy-directus`; `git add` theo đường dẫn; commit `feat(025): import and export
      permissions per policy at the API (D-189)`; push khi `main` rảnh; CI xanh (`api`, `parity` gồm MySQL rút gọn (migration
      trong `bootstrap` của env), `deploy` vì T015 đổi kỳ vọng migration và Directus khởi động trên DB có bảng, `e2e-web`
      ba cấu hình); xem lần chạy nightly MSSQL, Oracle, CockroachDB kế tiếp (CHK030); `graphify update .`.

---

## Phase 8: User Story 1 - Ma trận quyền 6 cột (Web, lượt 2) (Priority: P1) 🎯 MVP

**Goal**: ma trận create, read, update, delete, import, export, không share; hai nguồn; lưu sau policy; nhân bản; ô mờ
khi toggle tắt; 4 cột khi API là Directus (FR-022..FR-027, FR-034, D-189.3).

**Independent Test**: admin mở policy, bật export `bo_std`, lưu, tải lại → ô export full; nhân bản → bản sao có dòng.

### Tests for User Story 1 (MANDATORY) ⚠️

- [ ] T046 [P] [US1] Thêm vào `sp/SystemPermissions.test.ts`: 6 cột khi store có khóa `import`, 4 khi không; không cột
      share; `getPermission` đọc hai nguồn (mock `GET /backoffice/permissions`); All access hàng → tạo 4 dòng
      `directus_permissions` + 2 dòng staging; No access → xóa đúng nguồn, dòng `share` có sẵn không bị xóa; `disabledActions`
      giữ; ô import của collection hệ thống (`directus_users`) bị khóa, All access hàng đó không tạo dòng import (analyze
      I1). Chạy đỏ.
- [ ] T047 [P] [US1] Tạo hoặc sửa test `sp/PermissionsRow.test.ts`, `sp/PermissionsToggle.test.ts`: collection meta
      `bo_show_export: false` → ô export `opacity-50`, `title` = chuỗi `bo_toggle_off_hint`, vẫn bấm và mở menu bằng bàn
      phím. Chạy đỏ.
- [ ] T048 [P] [US1] Thêm vào `web/modules/settings/routes/policies/policies.test.ts` (hoặc `PolicyItemRoute.test.ts` mới):
      Save → `PATCH /policies/:id` rồi `POST`/`PATCH`/`DELETE /backoffice/permissions` theo staging; lỗi lần hai → dialog
      lỗi, staging giữ, `hasEdits` vẫn true; rời trang có staging → guard hỏi. Chạy đỏ.
- [ ] T049 [P] [US1] Thêm vào `web/modules/settings/routes/policies/use-duplicate.test.ts`: đọc `GET
      /backoffice/permissions?filter[policy][_eq]=<id>&limit=-1` và `POST` với `policy` mới; không dòng → không `POST`. Chạy
      đỏ.
- [ ] T050 [P] [US1] Thêm vào `web/stores/permissions.test.ts`: `hasBackofficeActions` true khi một collection có khóa
      `import`; false với `/permissions/me` của Directus. Chạy đỏ.

### Implementation for User Story 1

- [ ] T051 [US1] Sửa `sp/app-permissions.ts:12`: `editablePermissionActions = ['create', 'read', 'update', 'delete',
      'import', 'export']`, `backofficeActions` (nhãn, định dạng; import từ `@backoffice/constants` hoặc bản sao theo Kết
      quả T001 (a)), `isBackofficeAction`; sửa `web/stores/permissions.ts`: type `PermissionsAction` thêm `import`,
      `export`, `ActionPermission.formats?`, getter `hasBackofficeActions`. T050 xanh.
- [ ] T052 [US1] Tạo `sp/use-bo-permissions-staging.ts`: `InjectionKey`, `createBoPermissionsStaging(policyId)` (alterations
      `{ create, update, delete }`, `hasEdits`, `flush()` gửi `POST`/`PATCH`/`DELETE /backoffice/permissions` qua `sdk` +
      `requestEndpoint`, `reset()`), `useBoPermissionsStaging()` (`inject`).
- [ ] T053 [US1] Sửa `sp/SystemPermissions.vue` (research R7): đọc nguồn hai, gộp `displayItems`, rẽ `getPermission`,
      `editItem`, `stageEdits`, `setFullAccess`, `setNoAccess`, `setFullAccessAll`, `setNoAccessAll`, `removeCollection`
      theo `isBackofficeAction`; cột theo `hasBackofficeActions` (FR-034); `disabledActions` thêm `import` cho collection
      hệ thống (FR-022). Sửa `sp/PermissionsRow.vue` (`v-for` cột theo
      prop, ô mờ theo meta collection) và `sp/PermissionsToggle.vue` (prop `mutedHint`). Thêm overlay
      `bo_toggle_off_hint` (en-US, vi-VN) ở `web/lang/overlay/`. T046, T047 xanh.
- [ ] T054 [US1] Sửa `web/modules/settings/routes/policies/PolicyItemRoute.vue`: tạo staging, `provide`; `hasEdits` gộp;
      `saveAndStay`, `saveAndAddNew`, `saveAndQuit` gọi `staging.flush()` sau `save()`; `discardAndLeave`/`discardAndStay`
      gọi `staging.reset()`. Sửa `web/modules/settings/routes/policies/use-duplicate.ts:32` chép dòng bảng mới. T048, T049
      xanh.
- [ ] T055 [US1] Sửa `e2e/settings-roles-policies.spec.ts` (test ma trận dòng 146, nhân bản dòng 188): `proxy-api`,
      `cors`: header có Import, Export, không Share; bật export `bo_std`, lưu, tải lại → ô full; nhân bản → bản sao có dòng
      (đọc qua API `/backoffice/permissions`); `proxy-directus`: 4 cột (FR-034). Thêm `GET`, `POST`, `PATCH`, `DELETE`
      `/backoffice/permissions(/<id>)` vào `e2e/helpers/allowed-paths.ts`; rà `e2e/payload/settings.spec.ts`,
      `e2e/payload/settings-baselines.spec.ts` (trang policy gọi thêm `/backoffice/permissions`: ghi khác biệt hoặc bỏ
      khỏi so sánh payload; analyze G3).

**Checkpoint**: admin phân quyền import, export trên giao diện.

---

## Phase 9: User Story 3 - Import, Export ở các module theo quyền (Web) (Priority: P1)

**Goal**: phần import, export ở Content, Users, Files, Presets, Translations, Insights theo `/permissions/me` và toggle
022; định dạng lọc; luật Directus khi API là Directus (FR-028, FR-034).

**Independent Test**: `bo-editor` không export → không phần export ở Content `bo_content`; cấp export `csv` → có, chỉ CSV.

### Tests for User Story 3 (MANDATORY) ⚠️

- [ ] T056 [P] [US3] Thêm vào test `web/composables/use-permissions/collection/use-collection-permissions.test.ts` (tạo nếu
      chưa có): `importAllowed`, `exportAllowed`, `exportFormats` khi store có khóa (admin, user `none`, `full`, `formats`)
      và khi không có (theo read; create + update); collection hệ thống: `importAllowed` chỉ admin ở cả hai chế độ
      (analyze I1). Chạy đỏ.
- [ ] T057 [P] [US3] Thêm vào `web/components/sidebar/ExportSidebarDetail.test.ts` và `BasicImportSidebarDetail.test.ts`:
      phần export (gồm "Download Page as CSV") theo `exportAllowed && showExport`; phần import theo `importAllowed &&
      showImport`; select định dạng chỉ `exportFormats`, mặc định định dạng đầu. Chạy đỏ.
- [ ] T058 [P] [US3] Thêm vào `web/modules/insights/routes/overview.test.ts`: nút Export dashboard theo `exportAllowed` của
      `directus_dashboards`, import chỉ admin (`importAllowed` của collection hệ thống, analyze I1). Chạy đỏ.

### Implementation for User Story 3

- [ ] T059 [US3] Sửa `web/composables/use-permissions/collection/use-collection-permissions.ts` (thêm `importAllowed`,
      `exportAllowed`, `exportFormats`, research R8). T056 xanh.
- [ ] T060 [US3] Sửa `web/components/sidebar/ExportSidebarDetail.vue` (dòng 532 `importAllowed`, phần export
      `exportAllowed`, select `:627-634` lọc) và `web/components/sidebar/BasicImportSidebarDetail.vue` (dòng 120). T057 xanh.
- [ ] T061 [US3] Sửa `web/modules/insights/routes/InsightsOverviewRoute.vue` (`:126-128`, `:268-271`, `:294`). T058 xanh.
- [ ] T062 [US3] Tạo `e2e/settings-permissions-bo.spec.ts`: `bo-editor` (fixture) ở `proxy-api`, `cors`: không quyền →
      Content `bo_content` không phần export, import; admin cấp export `csv` qua `POST /backoffice/permissions` (afterAll
      xóa) → có phần export, select chỉ CSV; Users, Files, Insights tương tự; `proxy-directus`: phần export theo read
      (FR-034).

**Checkpoint**: người dùng thấy import, export đúng quyền.

---

## Phase 10: User Story 4 - Drawer Use custom (Web) (Priority: P2)

**Goal**: drawer import, export có bộ lọc dòng, field, định dạng (FR-026).

**Independent Test**: mở ô export → Use custom → tab Item Permissions, Field Permissions, Formats; chọn `csv`, lưu → dòng
có `options.formats = ['csv']`.

### Tests for User Story 4 (MANDATORY) ⚠️

- [ ] T063 [P] [US4] Thêm vào `sp/detail/PermissionsDetail.test.ts`: action `export` → ba tab (`permissions`, `fields`,
      `formats`), không `validation`, `presets`; đọc `/backoffice/permissions/:id`; dòng staging `+`; tiêu đề `… -> Export`;
      action share không còn tab. Tạo `sp/detail/FormatsTab.test.ts`: checkbox các định dạng của action, rỗng = `options`
      null, chọn → `options.formats`; nhãn liên kết, bàn phím. Chạy đỏ.

### Implementation for User Story 4

- [ ] T064 [US4] Tạo `sp/detail/FormatsTab.vue` (`<script setup lang="ts">`, checkbox của design-system, `modelValue`/
      `update:modelValue`, chuỗi overlay `bo_formats`, `bo_formats_hint` en-US, vi-VN). Sửa `sp/detail/PermissionsDetail.vue`
      (`load` theo `isBackofficeAction`, `tabsValue` dòng 64-100, bỏ `'share'` ở dòng 71, `emit` dòng cho staging). T063
      xanh.
- [ ] T065 [US4] Thêm bước Use custom vào `e2e/settings-roles-policies.spec.ts` (sau T055): ô export → Use custom → tab
      Formats chọn CSV → lưu → `GET /backoffice/permissions` có `options.formats = ['csv']`; ô hiện trạng thái partial.

---

## Phase 11: User Story 5 - Bỏ share khỏi giao diện (Priority: P2)

**Goal**: không mục Shares ở trang item, không route `/shared/:id` (FR-029, D-189.4).

**Independent Test**: trang item không có Shares; `/admin/shared/<id>` → not found / đăng nhập; API `/shares` như cũ.

### Tests for User Story 5 (MANDATORY) ⚠️

- [ ] T066 [P] [US5] Sửa test `web/modules/content/routes/ItemRoute.test.ts` (sidebar không có Shares) và
      `web/router/index.test.ts` hoặc `web/router/guard.test.ts` (không route `shared`; `/shared/<uuid>` rơi vào route bắt
      mọi path). Chạy đỏ.

### Implementation for User Story 5

- [ ] T067 [US5] Xóa `web/components/sidebar/SharesSidebarDetail.vue` và `.test.ts`; bỏ chỗ dùng ở
      `web/modules/content/routes/ItemRoute.vue:819-824` và import; bỏ `shareAllowed` ở
      `web/composables/use-permissions/item/use-item-permissions.ts` nếu không còn ai dùng. T066 xanh (phần item).
- [ ] T068 [US5] Xóa route `shared` ở `web/router/index.ts:91-93`, `web/routes/SharedRoute.vue` và `SharedRoute.test.ts`;
      giữ `web/router/guard.ts` và store user `share`. T066 xanh.
- [ ] T069 [US5] E2E: xóa `e2e/content-share.spec.ts`; bỏ case share của `e2e/payload/comments-shares.spec.ts` (giữ
      comment) và của `e2e/content-sidebar.spec.ts` nếu có; `e2e/helpers/allowed-paths.ts` bỏ dòng `/shares/info`,
      `/shares/auth` nếu không còn spec nào dùng; tìm mọi chỗ khác trong `e2e/` gọi `/admin/shared/`.

### Đóng lượt 2

- [ ] T070 Đóng lượt 2: `web/lang/keys.test.ts` có khóa overlay mới; `pnpm nx run-many -t lint,typecheck -p web web-e2e`;
      `web:test` các file đã sửa và cả `interfaces/_system/system-permissions/`, `components/sidebar/`,
      `modules/settings/routes/policies/` (coverage FE ≥ 60 %); `web:build`; E2E `settings-roles-policies`,
      `settings-permissions-bo`, các spec của T069 local `proxy-api` và `proxy-directus`; `git add` theo đường dẫn;
      commit `feat(025): permission matrix with import and export, module import/export by policy, no share UI
      (D-189.3, D-189.4)`; push khi `main` rảnh; CI xanh (`web`, `e2e-web` ba cấu hình); `graphify update .`.

---

## Phase 12: User Story 6 - Lb, Ingress (deploy, lượt 3) (Priority: P1)

**Goal**: `/permissions/me` và `/backoffice/*` luôn tới Backoffice ở shared-domain (FR-031, D-189.7).

**Independent Test**: deploy compose shared-domain: 8 lần `GET /permissions/me` và `GET /backoffice/permissions` qua lb,
log lb không có dòng nào tới IP `directus`.

### Tests for User Story 6 (MANDATORY) ⚠️

- [ ] T071 [P] [US6] Tạo `parity/deploy/backoffice-permissions.test.ts` (như `parity/deploy/extensions.test.ts:95-106`,
      `describe.skipIf(SEPARATE)`): admin token; 8 lần mỗi đường qua `lbUrl`, `lbLog(since)` không có `${directusIp}:8055`;
      cấp export cho U qua `replicaUrl(1)`, `?export=csv` ở `replicaUrl(2)` → 200 ngay; thu hồi qua `replicaUrl(2)`,
      `replicaUrl(1)` → 403 (FR-013, analyze G4). Chạy đỏ (trên env deploy).

### Implementation for User Story 6

- [ ] T072 [US6] Sửa `deploy/compose/lb/shared-domain.conf`: trước `location /` thêm `location = /permissions/me` và
      `location ^~ /backoffice/` tới `bo_pool` với `error_page 502 504 = @retry_bo` (research R10, comment spec 025
      D-189.7). T071 xanh.
- [ ] T073 [US6] Sửa `deploy/helm/backoffice/templates/ingress.yaml` (cạnh dòng 32): path `/permissions/me` `Exact` và
      `/backoffice` `Prefix` tới Service `-api-only`; kiểm `helm template` render đúng thứ tự (trước `/`); thêm kiểm vào
      `deploy/helm/backoffice/ci/kind-test.sh` nếu file đã kiểm `/extensions/sources`.

---

## Phase 13: Polish & Cross-Cutting (lượt 3)

- [ ] T074 [P] Sửa `deploy/README.md` (mục migration riêng, dòng ~383): migration `20261028A`, bảng
      `backoffice_permissions`, không seed (admin phân quyền lại sau khi cài), rollback tay và cách sửa tay khi migration
      hỏng giữa chừng (bảng có, index thiếu; CHK032); D-189.1, D-189.2 khi chạy cùng Directus; Directus app ở cấu hình
      proxy tới API mới nhận 403 cho tới khi được cấp (CHK003); Activity của Directus hiện dòng `backoffice_permissions`
      (CHK008); lb/Ingress D-189.7. Sửa `tests/parity/README.md`: file `permissions/backoffice-permissions.test.ts`, D-189,
      D-189.1, deploy test.
- [ ] T075 [P] Kiểm `design-system/docs/migration-guide.md`: 025 thêm tab `FormatsTab` (checkbox có sẵn), ô mờ
      `opacity-50` + `title`, không màu, token mới; ghi mục Decisions nếu ô mờ cần ghi chú tương phản (WCAG), nếu không
      ghi "Kết quả T075" một dòng vào research.md.
- [ ] T076 [P] Sửa `CLAUDE.md`: dòng Active Technologies của 025 đổi "planned" thành "implemented 2026-10-xx", thêm mục
      Recent Changes 025; `SPECKIT-GUIDE.md` mục 025 dòng Trạng thái (lượt, commit, CI).
- [ ] T077 Chạy `quickstart.md` trên env parity `proxy-api`: các lệnh `curl` cho đúng status ghi trong file; sai thì sửa
      quickstart hoặc code.
- [ ] T078 Chạy workflow `benchmark-items` và `benchmark-web` trên CI sau push lượt 1 hoặc 2; SC-007: scenario hiện có
      không tệ hơn Directus quá 10 %; ghi "Kết quả benchmark" vào research.md.
- [ ] T079 Đóng lượt 3: `pnpm nx run-many -t lint -p parity-tests`; parity deploy local nếu chạy được (hoặc dựa CI
      `deploy`, `deploy-k8s`); `git add` theo đường dẫn; commit `feat(025): route /permissions/me and /backoffice to
      Backoffice (D-189.7)` và `docs(025): close the policy import/export spec`; spec 025 dòng Status → `Implemented
      2026-10-xx` với commit và số run CI; push khi `main` rảnh; CI xanh (`deploy`, `deploy-k8s`, toàn bộ); `graphify
      update .`.

---

## Dependencies & Execution Order

### Phase

- Lượt 1: Phase 1 (T001, T002) → Phase 2 (T003–T015) → Phase 3 (US1 API, T016–T022) → Phase 4 (US2, T023–T029) →
  Phase 5 (US4 API, T030–T036) → Phase 6 (US3 API, T037–T040) → Phase 7 (US6, T041–T044, gồm T043 sửa E2E hiện có) →
  T045 đóng lượt 1.
- Lượt 2: Phase 8 (US1 web, T046–T055) → Phase 9 (US3 web, T056–T062) → Phase 10 (US4 web, T063–T065) → Phase 11 (US5,
  T066–T069) → T070. E2E của lượt 2 cần lượt 1 trên `main` (endpoint, `/permissions/me` có khóa).
- Lượt 3: Phase 12 (T071–T073) → Phase 13 (T074–T078) → T079.

### User story

- US1 API (Phase 3) cần Phase 2 (bảng, registry). US2 cần Phase 2 (`assertBackofficeAction`) và T022 (file parity).
- US4 API cần US2 (điểm gọi ở guard, `utils.controller`). US3 API cần Phase 2 (`fetchBackofficePermissions`).
- US6 cần US1–US4 API (case parity dùng endpoint và kiểm).
- Web: US1 web cần US3 API (`hasBackofficeActions`) và US1 API (endpoint); US3 web cần US3 API; US4 web cần US1 web
  (drawer mở từ ma trận); US5 độc lập.

### Trong một story

- Test trước (chạy đỏ), rồi code.
- `parity/permissions/backoffice-permissions.test.ts`: T022 → T029 → T036 → T040 → T041 theo thứ tự.
- `api/middleware/collection-toggles-guard.ts`: T026 rồi T035; test: T023 rồi T032.
- `api/controllers/utils.controller.ts`: T027 rồi T035; test: T024 rồi T032.
- `api/middleware/validate-batch.ts`: T028 rồi T035; test: T025 rồi T032.
- `tests/parity/accepted-differences.ts`: T022, T029, T040, T044 theo thứ tự.
- `sp/SystemPermissions.vue`: T053; `sp/detail/PermissionsDetail.vue`: T064; `e2e/settings-roles-policies.spec.ts`: T055
  rồi T065.

## Parallel Example

```bash
# Phase 1–2:
T001 inferences | T002 audit existing tests
T003 migration.test | T004 run/validate tests | T005 constants.test | T006 fetch.test | T007 access.test | T008 assert.test | T009 normalizers.test
T011 constants | T012 types | T013 system collection   (sau T010: T014, T015)

# Lượt 1, sau Phase 2:
T016 service.test | T017 controller.test | T018 policies/collections tests
T023 guard.test | T024 utils.controller.test | T025 validate-batch.test   (sau Phase 3)
T030 apply-export-access.test | T031 import-export.service.test
T037 collection-access.test | T038 system resolver test
# parity: T022 → T029 → T036 → T040 → T041 cùng file; T042 parity hiện có | T043 E2E hiện có (sau T029)

# Lượt 2:
T046 SystemPermissions.test | T047 Row/Toggle tests | T048 policy save test | T049 use-duplicate.test | T050 store.test
T056 use-collection-permissions.test | T057 sidebar tests | T058 insights test | T063 drawer tests | T066 share tests

# Lượt 3:
T071 deploy test | T074 READMEs | T075 migration-guide | T076 CLAUDE.md, SPECKIT-GUIDE.md
```

## Implementation Strategy

### MVP (lượt 1 + Phase 8)

1. Phase 1–2: bảng, registry, đọc quyền.
2. Phase 3–4: endpoint ghi quyền và kiểm bật/tắt ở API (US1 API, US2).
3. Phase 6: `/permissions/me`.
4. Phase 8: ma trận 6 cột.
5. **Dừng và kiểm**: admin cấp export, user không có export bị 403, web ẩn/hiện đúng.

### Incremental Delivery

1. Lượt 1 (API, kể cả Use custom, parity, sửa test và E2E hiện có) → commit, CI xanh. Sau lượt 1, người không phải admin mất import, export ở
   API Backoffice cho tới khi admin cấp (không seed, đã duyệt); web cũ của lượt trước vẫn hiện nút → bấm nhận 403 cho
   tới lượt 2.
2. Lượt 2 (web, E2E) → commit, CI xanh.
3. Lượt 3 (deploy, tài liệu) → commit, CI xanh, đóng spec.

### Ghi chú

- [P] = khác file, không phụ thuộc task chưa xong.
- Mỗi task một commit cục bộ hoặc gom theo lượt; push theo quy ước "Điều kiện bắt đầu".
- Khác biệt mới phát sinh: dừng, ghi spec, hỏi chủ dự án.
