---

description: "Danh sách task cho feature 022: ẩn hiện ô tìm kiếm, Import, Export theo collection và migration riêng của Backoffice"
---

# Tasks: Ẩn hiện ô tìm kiếm, Import, Export theo collection và migration riêng của Backoffice

**Input**: Tài liệu thiết kế trong `/specs/022-collection-ui-toggles/`
**Prerequisites**: `plan.md`, `spec.md` (D-179..D-181 duyệt 2026-10-26). Dùng thêm `research.md` (R1–R12, "Sửa spec khi
plan"), `data-model.md`, `contracts/` (`migrations.md`, `web.md`, `tests.md`), `quickstart.md`.

**Điều kiện bắt đầu**: constitution 3.2.0 và spec/plan 022 đã ở `main` (`92538e6b`, `de087a5a`). Làm trên `main`,
không branch; script `.specify` cần `SPECIFY_FEATURE=022-collection-ui-toggles`. Checkout dùng chung với các phiên
khác: `git add` theo đường dẫn, không `git add -A`/`.`, không `stash`, `reset`, `checkout --`; không stage
`apps/api/project.json`, `apps/web/project.json`; push khi `main` không có run CI đang chạy (push hủy run cũ), rồi gửi
số run cho phiên "Speckit migration chức năng và directus_collections fields" (021). Không sửa file dưới `directus/`.
Máy local: chạy test từng file, `--maxWorkers=1`; không dừng container của phiên khác; profile `bootstrap` dùng cổng
riêng (6114, 10755–10757).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Không endpoint mới. Đối chiếu: profile `bootstrap` (dump, log CLI), env parity chính (request-set `/collections`,
  `/fields` với normalize D-181, blackbox collections/fields/schema, GraphQL SDL), deploy 3 replica, E2E ba cấu hình.
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).

**Organization**: Task nhóm theo user story, xếp theo ba lượt commit (research R11): **Lượt 1** = Phase 1, 2, 3 (US3),
4 (US4); **Lượt 2** = Phase 5 (US1), 6 (US2); **Lượt 3** = Phase 7 (Polish). US3 đi trước US1, US2 vì ba cột do
migration riêng tạo. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test liên quan xanh, commit, push khi
`main` rảnh, gửi số run cho phiên 021, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `bo-mig/` = `apps/api/src/database/backoffice-migrations/`; `web/` =
  `apps/web/src/`; `e2e/` = `apps/web-e2e/src/`; `parity/` = `tests/parity/src/`; `sysdata/` = `libs/system-data/src/`.
- Comment code ghi Directus là "DR" (constitution IX); file mới ghi `// Backoffice (spec 022, D-180)` thay header port.
- Không biến env mới (VIII). Không sửa `api/database/migrations/run.ts` và 101 file port (`port.test.ts`).
- Thông điệp log và lỗi lấy đúng câu chữ ở `contracts/migrations.md` (`Running Backoffice migrations...`, `Applying
  <name>...`, `Backoffice migrations are up to date`, `Backoffice migrations do not match.`); E2E và parity so theo
  chúng.
- Lệnh test: `pnpm nx run api:test -- <file>`, `pnpm nx run web:test -- <file>`, `pnpm nx run system-data:test`,
  `pnpm nx run parity-tests:env-up --vendor=postgres --profiles=bootstrap` rồi `pnpm nx run parity-tests:test --
  src/bootstrap/<file>`, `pnpm nx run parity-tests:deploy`, `pnpm nx run web-e2e:e2e -- <spec>` (tên target kiểm lại
  trong `project.json` của từng project khi làm).

## Phase 1: Setup (chốt [Unverified] của research)

**Purpose**: chốt hai điểm chưa kiểm của R1 và R4 trước khi viết code.

- [X] T001 Kiểm và ghi "Kết quả T001" vào `specs/022-collection-ui-toggles/research.md`: (a) `redlock.using` của
      `@sesamecare-oss/redlock` 1.4.0 có tự gia hạn lock khi callback còn chạy không (đọc `node_modules/@sesamecare-oss/
      redlock/dist/*.js` hoặc README: `using` và `automaticExtensionThreshold`); nếu không, R1 đổi sang `acquireLock` +
      `extend` theo chu kỳ trong `bo-mig/run.ts`; (b) `grep -rn "startsWith('directus_')\|isSystemCollection"
      api/services/graphql/` để biết `backoffice_migrations` vào `/graphql` hay `/graphql/system` sau khi thành collection
      hệ thống; nếu khác Directus (bảng chưa quản lý → `/graphql` items) thì ghi vào D-181 của spec và thêm normalize
      SDL ở T018.

## Phase 2: Foundational (bộ chạy migration riêng và kiểm tra lúc `start`)

**Purpose**: runner, danh sách, lock và kiểm tra: mọi user story cần.

- [X] T002 [P] Viết `bo-mig/run.test.ts` (SQLite in-memory như `api/database/seeds/run.test.ts`; mock `../../cache.js`
      `flushCaches`, `../../logger/index.js`, `../../lock/index.js` `useLock` trả kv local): tạo bảng
      `backoffice_migrations` khi chưa có; chạy migration thiếu theo thứ tự với danh sách giả hai phần tử; bỏ qua đã
      chạy; không thiếu → không lock, không flush, log `Backoffice migrations are up to date`; có áp → `flushCaches(true)`
      đúng một lần; `up` ném lỗi → không ghi dòng, lỗi ném ra; đọc lại bảng sau khi lấy lock (migration giả ghi dòng
      trong lúc chờ lock → không chạy lại). Chạy đỏ.
- [X] T003 Viết `bo-mig/index.ts` (interface `BackofficeMigration { version; name; up }`, `BACKOFFICE_MIGRATIONS` rỗng tạm,
      comment D-180) và `bo-mig/run.ts` (`runBackofficeMigrations(knex, migrations = BACKOFFICE_MIGRATIONS)`: theo
      `contracts/migrations.md` bước 1–5; bảng: `version` string(255) primary, `name` string(255) notNullable,
      `timestamp` timestamp default `knex.fn.now()`; lock `useLock().usingLock('backoffice-migrations', ...)`;
      log `Running Backoffice migrations...` trước bước 2). T002 xanh.
- [X] T004 [P] Thêm vào `api/database/validate-migrations.test.ts`: db giả có `schema.hasTable` và `select('version')
      .from('backoffice_migrations')`; case không có bảng → `boMissing` = danh sách; thiếu một → `validateMigrations`
      exit 1 với `Backoffice migrations do not match.` và dòng `Missing Backoffice migrations (not run yet): ...`,
      `Run "node cli.js bootstrap" to apply them.`; dòng lạ → exit 1 `Unknown Backoffice migrations (newer
      Backoffice?): ...`; `migrationsValid` false khi thiếu migration riêng; các case Directus cũ giữ. Chạy đỏ.
- [X] T005 Sửa `api/database/validate-migrations.ts`: `checkMigrations` thêm `boRequired` (version của
      `BACKOFFICE_MIGRATIONS`), `boCompleted` (`hasTable` rồi select; không bảng = `[]`), `boMissing`, `boExtra`;
      `validateMigrations` và `migrationsValid` theo `contracts/migrations.md`. T004 xanh; `api/startup/run-startup-checks.ts`
      và `api/cli/load-extensions.ts` không cần sửa (gọi hàm cũ).

**Checkpoint**: runner và kiểm tra có test; chưa có migration nào.

## Phase 3: User Story 3 - Migration riêng của Backoffice, tự chạy khi khởi động (Priority: P1) 🎯 MVP

**Goal**: `bootstrap` (và `init`) chạy migration `20261026A` trên mọi vendor dưới lock; `start` dừng khi thiếu; parity
`bootstrap` và deploy 3 replica xanh.

**Independent Test**: profile `bootstrap` (Postgres): dump hai app giống nhau sau quy tắc D-180; DB của Backoffice có
`backoffice_migrations` một dòng và ba cột; chạy lại `bootstrap` → up to date; deploy: ba replica, một dòng.

### Tests for User Story 3 (MANDATORY) ⚠️

- [X] T006 [P] [US3] Viết `bo-mig/20261026A-add-collection-ui-toggles.test.ts` (SQLite in-memory: tạo
      `directus_collections(collection)`, `directus_fields(id, collection, field, special, interface, width,
      translations, sort, ...)` tối thiểu): `up` hai lần → ba cột `bo_show_search`, `bo_show_import`, `bo_show_export`
      default true nullable (kiểm `columnInfo`), ba dòng `directus_fields` với `special = cast-boolean`, `interface =
      boolean`, `width = half`, `translations` en-US/vi-VN đúng chữ của `research.md` R3, không dòng trùng; cột có sẵn
      trước `up` → không lỗi. Chạy đỏ.
- [X] T007 [P] [US3] Thêm vào `api/cli/commands/bootstrap/index.test.ts` (mock `../../../database/backoffice-migrations/
      run.js` và `../../../database/validate-migrations.js` `migrationsValid`): nhánh Postgres DB trống và DB đã cài gọi
      runner một lần sau `runMigrations latest`; nhánh vendor khác (`unsupportedClient`) gọi runner khi `migrationsValid`
      true, không gọi khi false, vẫn exit 0. Chạy đỏ.
- [X] T008 [P] [US3] Thêm vào `api/cli/commands/init/index.test.ts`: sau `runMigrations(db, 'latest', false)` gọi
      `runBackofficeMigrations(db)` một lần. Chạy đỏ.
- [X] T009 [P] [US3] Thêm vào `parity/bootstrap/normalize.test.ts`: `normalizeLogs` bỏ dòng `Running Backoffice
      migrations...`, `Backoffice migrations are up to date`, `Applying Add Collection UI Toggles...` (quy tắc FR-019 của
      spec 022), giữ `Applying Remove Collection Foreign Keys...` của Directus. Chạy đỏ.
- [X] T010 [P] [US3] Thêm vào `parity/bootstrap/dump.test.ts`: dump bỏ cột `bo_*` khỏi `tables[].columns` và bỏ dòng
      `directus_fields` có `field` bắt đầu `bo_` khỏi `rows`; bảng `backoffice_*` không có trong `tables`. Chạy đỏ.

### Implementation for User Story 3

- [X] T011 [US3] Viết `bo-mig/20261026A-add-collection-ui-toggles.ts` (export `version`, `name = 'Add Collection UI
      Toggles'`, `up`: `hasColumn` → `alterTable` `boolean(col).defaultTo(true)`; dòng `directus_fields` nếu chưa có,
      `translations` là object như `api/database/migrations/20201029C-remove-system-fields.ts:1650`) và thêm vào
      `BACKOFFICE_MIGRATIONS` của `bo-mig/index.ts`. T006 xanh.
- [X] T012 [US3] Sửa `api/cli/commands/bootstrap/index.ts` theo `contracts/migrations.md` "Gọi từ đâu" (hai nhánh
      Postgres/SQLite trước `database.destroy()`; nhánh D-145 sau `bootstrapInstalled` khi `await migrationsValid(database)`).
      T007 xanh.
- [X] T013 [US3] Sửa `api/cli/commands/init/index.ts`: gọi `runBackofficeMigrations(db)` sau dòng 48. T008 xanh.
- [X] T014 [US3] Thêm quy tắc log vào `parity/bootstrap/normalize.ts` `normalizeLogs` (comment: spec 022 FR-019). T009
      xanh.
- [X] T015 [US3] Sửa `parity/bootstrap/dump.ts` (comment D-180). T010 xanh.
- [X] T016 [US3] Thêm vào `parity/bootstrap/cross.test.ts`: (a) sau baseline, DB `backoffice_bootstrap` có bảng
      `backoffice_migrations` với đúng một dòng `20261026A Add Collection UI Toggles` và `directus_collections` có ba
      cột; DB `directus_bootstrap` không có bảng và cột; (b) `cliRun('backoffice', ['bootstrap'])` lần nữa → log có
      `Backoffice migrations are up to date`, vẫn một dòng, `directus_migrations` 101 dòng không đổi; (c) case có sẵn
      "Directus khởi động trên DB của Backoffice" vẫn xanh (US4 kịch bản 1); (d) US3 kịch bản 5: xóa dòng `20261026A`
      khỏi `backoffice_migrations` của DB `backoffice_bootstrap` qua knex, `cliRun('backoffice', ['start'])` (thoát mã 1
      ngay ở kiểm tra migration; timeout 60 s) → log `Backoffice migrations do not match.` và `Missing Backoffice
      migrations (not run yet): 20261026A`; rồi `cliRun('backoffice', ['bootstrap'])` → `Applying Add Collection UI
      Toggles...` không lỗi (cột đã có, FR-014), dòng trở lại.
- [X] T017 [US3] Viết `parity/deploy/backoffice-migrations.test.ts` (mẫu `parity/deploy/smoke.test.ts`, `instances.ts`):
      qua DB của compose: `backoffice_migrations` đúng một dòng mỗi version của `BACKOFFICE_MIGRATIONS`; ba cột có; log
      của `REPLICAS` replica (`compose logs backoffice-api`) có đúng một `Applying Add Collection UI Toggles...` và các
      replica còn lại `Backoffice migrations are up to date` (chế độ standalone: dòng ở log service `bootstrap`, replica
      không có `Applying`); cả replica healthy; `directus_migrations` không có version ngoài `DIRECTUS_MIGRATIONS`.
- [X] T018 [US3] Chạy local: `pnpm nx run api:test` cho các file T002–T008; `pnpm nx run parity-tests:env-up
      --vendor=postgres --profiles=bootstrap` rồi `parity-tests:test` cho `src/bootstrap/{schema,cross,cli,init,partial}
      .test.ts`; `parity-tests:deploy` (3 replica, kiểm T017; nếu máy local không chạy được deploy thì ghi "kiểm trên CI"
      vào task đóng lượt). Ghi số đo thời gian migration riêng (log pino `time`) vào `research.md` "Kết quả lượt 1".

**Checkpoint**: DB đã migrate bằng `bootstrap`; Directus khởi động trên DB đó; ba replica một dòng.

## Phase 4: User Story 4 - Chạy song song với Directus 11.17.4 trên cùng DB (Priority: P1, lượt 1)

**Goal**: `backoffice_migrations` là collection hệ thống ở Backoffice (D-181); `GET /collections`, `GET /fields` của hai
app giống nhau sau normalize; env parity chính và request-set xanh trên DB có ba cột.

**Independent Test**: env parity Postgres sau `env-up`: request-set `GET /collections` (admin, user), `SEARCH
/collections`, `GET /fields`, `GET /fields/directus_collections` so hai app xanh; `GET /items/backoffice_migrations` ở
Backoffice 403.

### Tests for User Story 4 (MANDATORY) ⚠️

- [X] T019 [P] [US4] Sửa `sysdata/collections/index.test.ts`: `isSystemCollection('backoffice_migrations')` true,
      `'backoffice_x'` false, `'directus_custom'` false; test "all collections start with directus_" thành "directus_
      hoặc backoffice_"; `systemCollectionRows` có `backoffice_migrations` với `system: true`, `hidden: true`. Chạy đỏ.
- [X] T020 [P] [US4] Thêm vào `parity/normalizers.test.ts`: `normalizeBody('/collections', body)` và `SEARCH /collections`
      bỏ phần tử `collection` bắt đầu `backoffice_`; `/fields` bỏ phần tử `collection` bắt đầu `backoffice_`; các path
      khác không đổi. Chạy đỏ.
- [X] T021 [P] [US4] Thêm `D-180` (kind `doc`, feature `022`, reason trỏ `contracts/migrations.md`) và `D-181` (kind `doc`,
      reason: normalize `/collections`, `/fields` ở `normalizers.ts`) vào `tests/parity/accepted-differences.ts`; chạy
      `parity/accepted-differences.test.ts` (đọc bảng "Khác biệt" của spec 022).

### Implementation for User Story 4

- [X] T022 [US4] Sửa `sysdata/collections/collections.yaml` (+ dòng `collection: backoffice_migrations`, `hidden: true`,
      `note: Backoffice migrations`) và `sysdata/collections/index.ts` `isSystemCollection` (tiền tố `directus_` hoặc
      `backoffice_`, comment D-181). T019 xanh; `pnpm nx run system-data:test`.
- [X] T023 [US4] Sửa `parity/normalizers.ts` `normalizeBody` (comment D-181). T020 xanh.
- [X] T024 [US4] Kiểm API trên env parity Postgres sau `env-up` (service `backoffice-api` tự `bootstrap`): `GET
      /items/backoffice_migrations` admin → Backoffice 403 `FORBIDDEN`, Directus 200 (D-181, chỉ ghi nhận, không có
      trong request-set); `GET /collections/backoffice_migrations` hai app (Backoffice `meta.system true`, Directus
      `meta null`, normalize không áp vì path khác: thêm vào `normalizers.ts` nếu request-set có path này, hiện không);
      `DELETE /collections/backoffice_migrations` **chỉ gửi tới Backoffice** (`BACKOFFICE_URL`) → bị từ chối; KHÔNG gửi
      tới Directus: ở Directus lệnh này xóa bảng của DB dùng chung (spec Edge Cases, D-181). Ghi kết quả vào
      `research.md` "Kết quả lượt 1".
- [X] T025 [US4] Chạy `parity-tests:test` cho `src/parity.test.ts` (request-set), `src/schema/overview.test.ts`,
      `src/schema-management/{cross-use,ddl-capture}.test.ts`, `src/graphql/*.test.ts` (SDL với `backoffice_migrations`,
      R4/T001) trên env Postgres; sửa normalize theo T001(b) nếu SDL lệch (ghi D-181).
- [ ] T026 Đóng lượt 1: `pnpm nx run api:lint`, `api:typecheck`, `system-data:lint`, `parity-tests:lint`; test các file
      của Phase 2–4 xanh; `git add` theo đường dẫn (`apps/api/src/database`, `apps/api/src/cli`, `libs/system-data`,
      `tests/parity`, `specs/022-*`); commit `feat(022): Backoffice migrations runner, migration 20261026A and the
      backoffice_migrations system collection (wave 1)`; kiểm `gh run list --branch main --status in_progress` rỗng rồi
      push; gửi số run cho phiên 021; theo dõi `gh run view <id>`: `quality`, `parity (postgres)`, `parity (sqlite3,
      bootstrap)`, `parity (mysql)`, `parity-blackbox`, `deploy`, `deploy-k8s` xanh; sửa đỏ ở commit sau; `graphify update .`.

**Checkpoint**: lượt 1 trên `main`, CI xanh; DB parity có ba cột; web chưa đọc chúng.

## Phase 5: User Story 1 - Admin ẩn ô tìm kiếm của một collection (Priority: P1, lượt 2)

**Goal**: `bo_show_search` tắt → trang Content ẩn ô nhập từ khóa, giữ nút bộ lọc, không gửi từ khóa của
preset/bookmark; mọi người dùng; `/content/backoffice_migrations` not found.

**Independent Test**: E2E `content-collection-toggles.spec.ts` case tìm kiếm ở ba cấu hình với admin và user thường.

### Tests for User Story 1 (MANDATORY) ⚠️

- [X] T027 [P] [US1] Thêm vào `web/components/SearchInput.test.ts` (describe `Backoffice`): `showSearch: false` → không
      `textbox`, không nút `search`/`clear_value`, có nút `filter` với badge số bộ lọc, pill có class `w-11`; click pill
      không ném lỗi, không emit; `showSearch: false, showFilter: false` → không render pill; đóng popover không focus.
      Chạy đỏ.
- [X] T028 [P] [US1] Thêm vào `web/modules/content/routes/CollectionRoute.test.ts`: collection có `meta.bo_show_search:
      false` và preset `search: 'abc'` → layout wrapper nhận `search: null`, `SearchInput` nhận `showSearch false`,
      `ExportSidebarDetail` nhận `search undefined`; `meta.bo_show_search: null` hoặc không có → `search: 'abc'` như nay;
      `/content/backoffice_migrations` → `ContentNotFound`. Chạy đỏ.
- [X] T029 [P] [US1] Thêm vào `web/stores/collections.test.ts` và `web/utils/get-item-route.test.ts`: `backoffice_migrations`
      là hệ thống (trong `systemCollections` như `directus_migrations`, không trong `allCollections`, không trong
      `crudSafeSystemCollections` vì deny list; `getCollectionRoute` trả `''`); `backoffice_x` (không trong deny list)
      vẫn hệ thống theo tiền tố. Chạy đỏ.

### Implementation for User Story 1

- [X] T030 [US1] Sửa `web/components/SearchInput.vue` theo `contracts/web.md` (prop `showSearch`, template, `activate`,
      `onFilterOpen`; comment D-179). T027 xanh.
- [X] T031 [P] [US1] Sửa `web/stores/collections.ts` (`isSystemCollection` + `backoffice_`, `COLLECTIONS_DENY_LIST` +
      `backoffice_migrations`) và `web/utils/get-item-route.ts` (`isSystemCollection` + `backoffice_`); comment D-181.
      T029 xanh.
- [X] T032 [US1] Sửa `web/modules/content/routes/CollectionRoute.vue`: `toggles`, `showSearch`, `activeSearch`;
      `:search="activeSearch"` ở layout wrapper; `:show-search` ở `SearchInput`; `:search="activeSearch ?? undefined"` ở
      `ExportSidebarDetail` (comment D-179, FR-004). T028 xanh (phần tìm kiếm).
- [X] T033 [US1] Viết `e2e/content-collection-toggles.spec.ts` (mẫu `e2e/content-export-import.spec.ts`,
      `e2e/content-permissions.spec.ts` cho user thường `fixtures.role('content reader', { read: ['bo_content'] })`):
      `beforeEach` PATCH `/collections/bo_content` meta; `afterEach` PATCH ba cột `null`; case: tắt tìm kiếm với admin và
      user thường (không `textbox` tìm kiếm, nút `Filter` mở popover, thêm điều kiện lọc được); bookmark có `search`
      → request `/items/bo_content` không có `search=` (kiểm qua `helpers/requests.ts`), bookmark giữ `search` (GET
      `/presets/:id`); bàn phím (SC-004): từ page header Tab tới nút `Filter`, Enter mở popover, Escape đóng; bật lại →
      có `textbox`. Chạy ở cấu hình proxy-api local; ba cấu hình trên CI.
- [X] T034 [US1] Thêm case vào `e2e/settings-data-model.spec.ts` (cạnh case D-71 dòng 246): `/admin/content/
      backoffice_migrations` → not found; Data Model liệt kê `directus_migrations`, không liệt kê `backoffice_migrations`
      (sửa khi implement lượt 3: khóa hiển thị D-118 trùng).

**Checkpoint**: tìm kiếm ẩn hiện theo cài đặt ở ba cấu hình.

## Phase 6: User Story 2 - Admin ẩn Import, Export của một collection (Priority: P1, lượt 2)

**Goal**: `bo_show_import`, `bo_show_export` tắt riêng từng phần của mục Import/Export; cả hai tắt → không có mục; form
collection có ba toggle với nhãn en-US/vi-VN.

**Independent Test**: E2E case import/export và Data Model ở ba cấu hình.

### Tests for User Story 2 (MANDATORY) ⚠️

- [X] T035 [P] [US2] Thêm vào `web/components/sidebar/ExportSidebarDetail.test.ts`: `showImport: false` → không
      `label_import`, không input file, không nút `import_data_button`, còn `export_items` và `download_page_as_csv`;
      `showExport: false` → không hai nút đó, còn phần import (với `createAllowed`); cả hai bật → như nay (không
      `BoDivider` thừa khi ẩn export). Chạy đỏ.
- [X] T036 [P] [US2] Thêm vào `web/modules/content/routes/CollectionRoute.test.ts`: `bo_show_import: false,
      bo_show_export: false` → không render `ExportSidebarDetail`; chỉ một tắt → render với prop tương ứng. Chạy đỏ.

### Implementation for User Story 2

- [X] T037 [US2] Sửa `web/components/sidebar/ExportSidebarDetail.vue` theo `contracts/web.md` (prop `showImport`,
      `showExport`; `v-if="createAllowed && showImport"`; `BoDivider` khi `showExport`; phần export `v-if="showExport"`;
      comment D-179). T035 xanh.
- [X] T038 [US2] Sửa `web/modules/content/routes/CollectionRoute.vue`: `showImport`, `showExport`; `ExportSidebarDetail`
      `v-if="showImport || showExport"`, `:show-import`, `:show-export`. T036 xanh.
- [X] T039 [US2] Thêm vào `e2e/content-collection-toggles.spec.ts`: tắt import (mục có `Export Items`, `Download Page as
      CSV`, không `Import Data`); tắt export (còn phần import, không hai nút export); cả hai tắt (không nút `Import /
      Export` trong detail panel, `Layout Options`, `Refresh` còn); Data Model `/settings/data-model/bo_content`: ba
      toggle `Show Search`, `Show Import`, `Show Export` ở card cuối, đổi ngôn ngữ vi-VN thấy `Hiện ô tìm kiếm`; tắt
      `Show Export` và lưu → PATCH `/collections/bo_content` có `meta.bo_show_export: false` (kiểm qua
      `helpers/requests.ts`), trang Content phản ánh sau tải lại; API khi cả ba tắt (FR-008, US2 kịch bản 4): AdminApi
      `GET /items/bo_content?search=x` và `GET /items/bo_content?export=csv&limit=1` → 200 như trước.
- [X] T040 [P] [US2] Thêm test browser project (`web/components/SearchInput.browser.test.ts` mới hoặc file browser test
      có sẵn của component, cấu hình `apps/web/vitest.config.ts` project `browser`): `SearchInput` `showSearch=false`
      và `ExportSidebarDetail` `showImport=false` không vi phạm axe.
- [ ] T041 Đóng lượt 2: `pnpm nx run web:lint`, `web:typecheck`, `web:test` các file T027–T036, T040; `web-e2e` spec
      T033/T034/T039 ở cấu hình proxy-api local; `git add` theo đường dẫn (`apps/web/src`, `apps/web-e2e/src`,
      `specs/022-*`); commit `feat(022): per-collection search, import and export toggles in the Content module (wave
      2)`; push khi `main` rảnh; gửi số run cho phiên 021; theo dõi `e2e-web (proxy-directus|proxy-api|cors)`, `quality`
      xanh; sửa đỏ; `graphify update .`.

**Checkpoint**: D-179 đủ ở ba cấu hình; form Data Model có ba toggle.

## Phase 7: Polish & Cross-Cutting (lượt 3)

**Purpose**: đối chiếu đầy đủ trên DB đã migrate, tài liệu, đóng feature.

- [ ] T042 [P] Chạy blackbox collections/fields/schema trên env Postgres (`parity-tests:test` với `profiles=blackbox`,
      `src/items/blackbox` collections/fields/schema theo README `tests/parity`) và GraphQL (`src/graphql`): 0 fail ở
      cả hai app (SC-003); nếu một test đếm field của `directus_collections` hoặc so toàn bộ `GET /collections` thì sửa
      normalize (D-181) chứ không sửa test blackbox.
- [ ] T043 [P] Chạy `gh workflow run parity-matrix.yml` (vendor MySQL, MariaDB, MSSQL, Oracle, CockroachDB: nhánh D-145
      chạy migration riêng, SC-006) và `gh workflow run benchmark.yml -f job=benchmark-web` (trang Content không thêm
      request); ghi kết quả vào `research.md` "Kết quả lượt 3".
- [ ] T044 [P] Thêm mục "Migration riêng của Backoffice" vào `deploy/README.md` theo `quickstart.md` (bootstrap tự chạy,
      lock, vendor khác, `start` báo thiếu, rollback tay, D-181, `DB_EXCLUDE_TABLES` tùy chọn, nâng Directus phải grep
      `bo_`/`backoffice_`).
- [ ] T045 Ghi `research.md`: "Kết quả lượt 1/2/3" (T001, T018, T024, T025, T043), vị trí ba toggle trong form (ảnh chụp
      hoặc mô tả, R12); `spec.md` Status → Implemented (ngày, ba lượt, CI run); `checklists/requirements.md` note;
      `SPECKIT-GUIDE.md` mục 022 trạng thái; `CLAUDE.md` Recent Changes thêm dòng 022.
- [ ] T046 Đóng lượt 3: lint, typecheck; `git add` theo đường dẫn; commit `docs(022): deploy README, research results and
      feature close`; push khi `main` rảnh; gửi số run cho phiên 021; CI xanh; `graphify update .`; báo chủ dự án kết
      quả SC-001..SC-006.

## Dependencies & Execution Order

### Phase

- Phase 1 (T001) → Phase 2 (T002–T005) → Phase 3 (US3, T006–T018) → Phase 4 (US4, T019–T025) → T026 đóng lượt 1.
- Lượt 2: Phase 5 (US1, T027–T034) → Phase 6 (US2, T035–T040) → T041 đóng lượt 2; cần lượt 1 trên `main` (DB parity và
  env E2E có ba cột; `isSystemCollection` của API cho `settings-data-model` case).
- Lượt 3: Phase 7 (T042–T045) sau lượt 2 → T046.

### User story

- US3 cần Phase 2 (runner, kiểm tra). US4 cần US3 (DB có bảng và cột để đối chiếu) nhưng T019–T023 làm song song với
  Phase 3 (khác file).
- US1, US2 cần US3 (cột) và US4 (`isSystemCollection` web chỉ cần T031, không cần API). US2 cần T032 của US1
  (`toggles` computed trong `CollectionRoute.vue`); T037 làm song song với Phase 5.

### Trong một story

- Test trước (chạy đỏ), rồi code.
- `CollectionRoute.vue` sửa hai lần (T032 tìm kiếm, T038 import/export) trên cùng `toggles` computed.

## Parallel Example

```bash
# Phase 2–3 sau T001:
T002 run.test.ts | T004 validate-migrations.test.ts | T006 20261026A.test.ts | T007 bootstrap test | T008 init test | T009 normalize.test.ts | T010 dump.test.ts

# Phase 4 song song với Phase 3 (khác file):
T019 system-data test | T020 normalizers.test.ts | T021 accepted-differences.ts

# Lượt 2:
T027 SearchInput.test.ts | T028 CollectionRoute.test.ts | T029 store/route tests | T035 ExportSidebarDetail.test.ts | T036 CollectionRoute.test.ts (import/export)
T030 SearchInput.vue | T031 store + get-item-route | T037 ExportSidebarDetail.vue
```

## Implementation Strategy

### MVP (lượt 1)

1. Phase 1, 2 → runner có lock và test; kiểm tra lúc `start`.
2. Phase 3 (US3) → migration `20261026A` chạy trong `bootstrap`/`init`; profile `bootstrap` và deploy xanh. **Dừng và
   kiểm**: Directus khởi động trên DB đã migrate, `directus_migrations` 101 dòng, ba replica một dòng.
3. Phase 4 (US4) → collection hệ thống, normalize D-181, request-set xanh; đóng lượt 1.

### Tăng dần

- Lượt 2: web (US1, US2), E2E ba cấu hình.
- Lượt 3: blackbox/GraphQL đầy đủ, vendor hằng đêm, README, đóng feature.

## Notes

- 46 task; 20 task [P]. US3: 13 (T006–T018), US4: 7 (T019–T025), US1: 8 (T027–T034), US2: 6 (T035–T040); Setup 1,
  Foundational 4, đóng lượt 3, Polish 4.
- Không `down`, không lệnh CLI riêng, không yaml field hệ thống cho `backoffice_migrations` (research R1, R4).
- Nhãn toggle và thông điệp log lấy đúng chữ ở `research.md` R3 và `contracts/migrations.md`; E2E và parity so theo
  chúng.
