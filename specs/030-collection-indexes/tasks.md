---

description: "Danh sách task cho feature 030: index ghép, index trigram và tạo index không khóa bảng cho collection người dùng"
---

# Tasks: Index ghép, index trigram và tạo index không khóa bảng cho collection người dùng

**Input**: Tài liệu thiết kế trong `/specs/030-collection-indexes/`
**Prerequisites**: `plan.md`, `spec.md` (D-210..D-210.4, hai điểm Complexity Tracking, 7 sửa câu chữ, card cuối trang
duyệt 2026-11-03). Dùng thêm `research.md` (R1–R14), `data-model.md`, `contracts/` (`api.md`, `web.md`, `tests.md`),
`quickstart.md`, `checklists/requirements.md`.

**Điều kiện bắt đầu**: spec, clarify, plan 030 đã commit lên `main`. Làm trên `main`, không branch; script `.specify`
cần `SPECIFY_FEATURE=030-collection-indexes`. Checkout dùng chung với các phiên khác: `git add` theo đường dẫn, không
`git add -A`/`.`, không `stash`, `reset`, `checkout --`; không stage `apps/api/project.json`, `apps/web/project.json`;
push theo quy tắc checkout dùng chung (hỏi phiên đang giữ vai trò push nếu có, `ListAgents`; chỉ push khi `main` không
có run CI đang chạy). Không sửa file dưới `directus/`. Máy local: chạy test từng file, `--maxWorkers=1`; không dừng
container của phiên khác; với `-- <file>` thì `parity-tests:parity` cần `TEST_DB=<vendor>`; lặp parity trên
`postgres`, `sqlite`, `mysql` (ma trận `parity` của CI).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Endpoint mới: `GET/POST/DELETE /backoffice/collections/:collection/indexes` (D-210, `doc`, test từng app bằng
  `appRequest`). Endpoint đổi hành vi: `DELETE /fields/:c/:f`, `POST /schema/apply`, `DELETE /collections/:c` (D-210.3,
  `doc`, tác động DB kiểm bằng catalog); `POST/PATCH /items/:c`, GraphQL `create_*`, `/utils/import` khi vi phạm unique
  ghép (D-210.4, `http`). Đối chiếu: `tests/parity/src/schema/indexes.test.ts` trên ba vendor; blackbox, parity
  `items/*`, `schema-management/*` hiện có không đổi; E2E ba cấu hình.
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).

**Organization**: Task nhóm theo user story, xếp theo hai lượt commit (research R14): **Lượt 1 (API)** = Phase 1, 2,
3 (US1 API), 4 (US3 API), 5 (US4 API), 6 (US2 API), 7 (US5 + đóng lượt); **Lượt 2 (Web)** = Phase 8 (US1 web), 9
(US3 + US4 web), 10 (US2 web), 11 (E2E + benchmark), 12 (Polish + đóng lượt). Mỗi lượt kết thúc bằng task "đóng lượt"
(lint, typecheck, test, build, parity/E2E liên quan xanh, commit, push khi `main` rảnh, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `hs/` = `apps/api/src/database/helpers/schema/`; `mig/` =
  `apps/api/src/database/backoffice-migrations/`; `bi/` = `apps/api/src/services/backoffice-indexes/`; `web/` =
  `apps/web/src/`; `dm/` = `apps/web/src/modules/settings/routes/data-model/`; `e2e/` = `apps/web-e2e/src/`; `parity/` =
  `tests/parity/src/`.
- Comment trong `apps/api`, `apps/web` viết Directus là "DR" (Nguyên tắc IX); mỗi chỗ sửa file port ghi
  `Backoffice (spec 030, D-210)`, giữ dòng `Ported from`.

## Phase 1: Setup (chốt [Unverified] của research, lượt 1)

**Purpose**: chốt hai điểm chưa thử trước khi viết helper và catalog; kết quả có thể đổi câu SQL ở R1/R5.

- [x] T001 Thử tại chỗ (script dùng một lần trong scratchpad, không commit) trên Postgres (`postgis/postgis:13-3.4-alpine`),
      MySQL (`mysql:8`) và SQLite in-memory qua Knex 3.1: (a) `knex.schema.alterTable(t, b => b.dropIndex([], name))`
      có gỡ được index đặt tên không, nếu không thì chốt raw SQL theo vendor; (b) ba câu catalog của R5 (Postgres
      `pg_indexes` + `pg_index.indisvalid` qua `pg_class`/`pg_namespace` với `current_schema()`, MySQL
      `information_schema.statistics`, SQLite `PRAGMA index_list`) trả đúng tên; (c) SQLite thông điệp unique ghép
      (`UNIQUE constraint failed: t.a, t.b`); ghi kết quả vào `specs/030-collection-indexes/research.md` R1/R5/R7
      ("Kết quả T001").
- [x] T002 Đọc `design-system/README.md`, `design-system/docs/component-specs.md` (Card, Table, Modal, Select, Switch,
      SortableList D-60), `design-system/docs/layout-patterns.md` §8, `design-system/qa/handoff-checklist.md`,
      `apps/web/src/modules/users/components/UserPasskeys.vue` (card độc lập 029) và
      `apps/web/src/interfaces/_system/system-fields/SystemFields.vue:110-140` (BoSortableList + thêm field); ghi 5 dòng
      "Ghi chú đọc" vào `specs/030-collection-indexes/research.md` R8 (không code).

**Checkpoint**: R1/R5/R7 có "Kết quả T001"; không còn [Unverified] trong research.

## Phase 2: Foundational (migration, collection ẩn, helper index, catalog, khung service/controller)

**Purpose**: phần lõi dùng chung cho mọi story; không có nó thì không endpoint nào chạy.

**⚠️ CRITICAL**: chưa xong Phase 2 thì không bắt đầu user story nào.

### Tests (MANDATORY) ⚠️

- [x] T003 [P] Unit migration `mig/20261103A-create-backoffice-indexes.test.ts` (mẫu `20261101A-*.test.ts`): version
      `20261103A`, name `Create Backoffice Indexes`, danh sách `['20261026A','20261028A','20261101A','20261103A']`, 9 cột
      và null/default theo `data-model.md`, index `backoffice_indexes_collection_index`, unique
      `backoffice_indexes_name_unique`, không FK, chạy lại idempotent, race (`hasTable` mock false) — chạy đỏ.
- [x] T004 [P] Cập nhật danh sách version cứng: `mig/20261101A-create-backoffice-passkeys.test.ts:33`,
      `api/database/validate-migrations.test.ts:265-273`, `parity/deploy/backoffice-migrations.test.ts:30-34`,
      `parity/bootstrap/cross.test.ts:252-256` (`BO_VERSIONS` + `hasTable('backoffice_indexes')`).
- [x] T005 [P] Unit `libs/system-data/src/collections/index.test.ts`: `backoffice_indexes` `hidden: true, system: true`,
      `isSystemCollection` true (mẫu :43-70) — chạy đỏ.
- [x] T006 [P] Unit dialect `hs/dialects/postgres.test.ts`, `hs/dialects/mysql.test.ts`, `hs/dialects/sqlite.test.ts`,
      `hs/dialects/default.test.ts`: `createIndex(c, ['a','b'], { unique })` → `(??, ??)` với binding đúng;
      `createIndex(c, 'a')` cho SQL **y như snapshot cũ** (caller cũ không đổi); Postgres `type: 'trigram'` →
      `CREATE INDEX [CONCURRENTLY] ?? ON ?? USING gin (lower(??) gin_trgm_ops)`; MySQL inplace + fallback với 2 cột; lớp
      cơ sở ném `InvalidPayloadError` cho trigram; `dropIndex(c, name)` theo kết quả T001 — chạy đỏ.
- [x] T007 [P] Unit `api/utils/get-default-index-name.test.ts`: `type: 'trgm'` → `<c>_<f>_trgm`, cắt theo maxLength
      (mẫu case có sẵn) — chạy đỏ.
- [x] T008 [P] Unit `bi/catalog.test.ts` (knex-mock-client theo client): `listIndexNames(knex, table)` chạy câu đúng
      vendor từ T001, map `name → { valid }`, `indisvalid=false` → `valid: false`, mssql/oracle → `null` — chạy đỏ.
- [x] T009 [P] Unit `parity/normalizers.test.ts`: `BACKOFFICE_TABLE` và SDL regex bỏ `backoffice_indexes` (mẫu
      :539-560 passkeys) — chạy đỏ.

### Implementation

- [x] T010 Migration `mig/20261103A-create-backoffice-indexes.ts` theo `data-model.md` (mẫu `20261101A`: `hasTable` →
      `createTable` trong try/catch → `hasTable`; `string(64) collection` index, `string(128) name` unique, `json fields`,
      `string(16) type`, `boolean unique default false`, `string(16) status default 'creating'`, `text error` nullable,
      `timestamp date_created defaultTo now`); thêm vào `BACKOFFICE_MIGRATIONS` trong `mig/index.ts`; T003/T004 xanh.
- [x] T011 [P] `libs/system-data/src/collections/collections.yaml`: `backoffice_indexes` `hidden: true` với comment spec
      030 (cạnh `backoffice_passkeys`); T005 xanh.
- [x] T012 [P] `api/services/graphql/schema/index.ts` `SYSTEM_DENY_LIST` thêm `backoffice_indexes` (comment spec 030);
      `parity/normalizers.ts:117` `BACKOFFICE_TABLE` và SDL regex `:284,:287` thêm `indexes`; T009 xanh.
- [x] T013 `hs/types.ts`: `CreateIndexOptions.type?: 'btree' | 'trigram'`; `createIndex(collection, field: string |
      string[], options)` lớp cơ sở sinh `(${fields.map(() => '??').join(', ')})`, ném `InvalidPayloadError('Trigram
      indexes need PostgreSQL')` cho trigram; thêm `dropIndex(collection, name)` theo T001; `generateIndexName` nhận
      `'trgm'`; `api/utils/get-default-index-name.ts` union thêm `'trgm'`; comment `Backoffice (spec 030, D-210)`; T007 xanh.
- [x] T014 `hs/dialects/postgres.ts` `createIndex`: mảng cột, nhánh trigram (R1/R2); `hs/dialects/mysql.ts`: mảng cột ở
      inplace và fallback; (cockroachdb/mssql/oracle nhận mảng qua cùng mẫu `(??, ??)`, không nhánh trigram); T006 xanh;
      `pnpm nx run api:test -- helpers/schema` xanh nguyên.
- [x] T015 `bi/catalog.ts`: `listIndexNames(knex, table): Promise<Map<string, { valid: boolean }> | null>` theo
      `getDatabaseClient(knex)` (R5, T001); T008 xanh.
- [x] T016 Khung service `api/services/backoffice-indexes.service.ts` (`TABLE = 'backoffice_indexes'`, `extends
      ItemsService` với `accountability: { ...caller, admin: true }` và `withCasts` cast-json cho `fields`, mẫu
      `backoffice-permissions.service.ts:25-39,106-119`; `assertAdmin()` ném `ForbiddenError`; export ở
      `api/services/index.ts`) và controller `api/controllers/backoffice-indexes.controller.ts`
      (`@Controller('backoffice/collections')`, `admin(req)` và `noCache(res)` chép từ
      `backoffice-passkeys.controller.ts:58-67`, ba route trả 501 tạm); đăng ký ở `api/app.module.ts` (controllers +
      `useCollection('backoffice_indexes')`) và `api/providers.ts` (factory như :201-213); unit
      `api/controllers/backoffice-indexes.controller.test.ts` (supertest): 401 không token, 403 không admin, `res.locals.cache
      === false`, route không đè `backoffice/permissions` và `backoffice/auth/*`.

**Checkpoint**: migration + collection ẩn + helper mảng cột/trigram/dropIndex + catalog + khung route xong; `pnpm nx run
api:test` xanh; `pnpm nx run system-data:test` xanh.

## Phase 3: User Story 1 - Admin tạo index ghép (unique hoặc không), phần API (Priority: P1, lượt 1) 🎯 MVP

**Goal**: `POST` kiểm payload (R6), kiểm trùng, insert dòng `creating`, trả 202, job nền tạo index và đặt `ready`;
`GET` liệt kê với `missing` và `meta`; ghi trùng unique ghép trả một `RECORD_NOT_UNIQUE` mỗi field (D-210.4).

**Independent Test**: unit service (mọi nhánh validate) + job; parity T024 phần US1 trên ba vendor: 202 → ready → ghi
trùng ở hai app (Directus một mục, Backoffice hai mục).

### Tests for User Story 1 (MANDATORY) ⚠️

- [x] T017 [P] [US1] Unit `api/services/backoffice-indexes.service.test.ts` (knex-mock-client, schema giả có collection
      người dùng với field alias/o2m/json/text/string/pk): `validate`: 403 `directus_*`/`backoffice_*`/collection lạ;
      400 fields rỗng, > 8, trùng, alias, o2m, kiểu json, `text` khi client mysql, chỉ khóa chính, `type` lạ; trùng định
      nghĩa với dòng có sẵn (kể cả `failed`) → 400 "Index already exists: <name>"; tên có trong catalog → 400 "Index name
      already in use"; `create` insert `status: 'creating'` và trả dòng (202 ở controller); `list` gắn `missing` (ready +
      không có trong catalog), `meta` theo client; `create` ghi activity `create` trên `backoffice_indexes` với user
      gọi (FR-016a, analyze C1) — chạy đỏ.
- [x] T018 [P] [US1] Unit `bi/jobs.test.ts`: `runIndexJob(row, ctx)` gọi `helpers.schema.createIndex` với
      `fields`/`unique`/`attemptConcurrentIndex` đúng rồi `updateOne(status: 'ready')`; lỗi → `updateOne(status:
      'failed', error)` qua ItemsService nên có activity `update` của cùng user (FR-016a); `running` Set thêm/bớt; log
      pino bắt đầu/xong/lỗi không chứa dữ liệu — chạy đỏ.
- [x] T019 [P] [US1] Unit extractor `api/database/errors/dialects/postgres.test.ts`, `mysql.test.ts`, `sqlite.test.ts`
      và `api/database/errors/translate.test.ts`: Postgres `detail` "Key (a, b)=(1, 2) already exists." → mảng 2
      `RecordNotUniqueError` (`field` a rồi b, `value` từ `data`); một cột như cũ (snapshot cũ xanh); SQLite "t.a, t.b" →
      mảng; MySQL tên `t_a_b_unique` không khớp cột → tra `backoffice_indexes` (knex mock trả `fields`) → mảng; không
      có bảng/dòng → như cũ; `translateDatabaseError(error, data, knex)` — chạy đỏ.
- [x] T020 [P] [US1] Unit `api/services/items.service.test.ts` (có sẵn): `createOne` ném mảng lỗi khi translate trả mảng,
      `primaryKey` xử lý từng phần tử (`:270-280`) — chạy đỏ.
- [x] T021 [P] [US1] Unit controller `api/controllers/backoffice-indexes.controller.test.ts`: `POST` 202 body `{ data }`,
      `?concurrentIndexCreation=false` → `attemptConcurrentIndex: false`, Joi 400 cho body sai dạng; `GET` 200 `{ data,
      meta }` — chạy đỏ.

### Implementation for User Story 1

- [x] T022 [US1] `api/services/backoffice-indexes.service.ts`: `validate(collection, body)` (R6, Joi như
      `newFieldSchema`), `generateName` qua `helpers.schema.generateIndexName('unique' | 'index' | 'trgm', c, fields)`,
      `assertNotDuplicate` (so `collection + fields + type + unique`; tên trong bảng hoặc catalog), `create(collection,
      body, { attemptConcurrentIndex })` → insert `creating` + `void runIndexJob` → trả dòng; `list(collection)` →
      dòng + `missing` + `meta { trigram, concurrent }` (R5, data-model); T017 xanh.
- [x] T023 [US1] `bi/jobs.ts`: `runIndexJob(row, { knex, service, helpers, attemptConcurrentIndex })`, `running:
      Set<Promise>`, cập nhật `ready`/`failed` (+ `error` cắt 1000 ký tự; vi phạm unique → thông điệp từ
      `RecordNotUniqueError` nếu dịch được), log pino; T018 xanh.
- [x] T024 [US1] Controller: `POST :collection/indexes` `@HttpCode(202)`, `GET :collection/indexes`; T021 xanh.
- [x] T025 [US1] Extractor: `api/database/errors/dialects/postgres.ts` tách nhóm ngoặc đầu bằng `', '`; `sqlite.ts` tách
      `', '`; `mysql.ts` nhận `knex?` và tra `backoffice_indexes` theo tên (hasTable cache module); `api/database/errors/
      translate.ts` chữ ký `(error, data, knex?)` trả `DirectusError | DirectusError[]`; `api/services/items.service.ts:270,
      :821` và `api/services/fields.service.ts` truyền `this.knex`, xử lý mảng (`primaryKey` từng phần tử, throw mảng); comment
      `Backoffice (spec 030, D-210.4)`; T019/T020 xanh; `pnpm nx run api:test -- items.service` xanh nguyên.
- [x] T026 [US1] Parity `parity/schema/indexes.test.ts` (khung + US1; `REDUCED_FILES` trong `parity/suite.ts` thêm file;
      `parity/vendors.test.ts` `toContain`): fixture `parity_idx_<vendor>` tạo qua `appRequest('backoffice','POST',
      '/collections')` với `provider`, `provider_subject`, `name` (string), `note` (text), `payload` (json), 10.000 dòng
      qua `knexConfig` (cho US2 EXPLAIN); Directus 404 ba route; POST 202 → poll GET tới `ready` ≤ 60 s; catalog
      (`knexConfig`) có index; `GET /fields/<c>` hai app bằng nhau (D-210.1); POST 2 item trùng ở hai app: Directus 400
      một mục, Backoffice 400 hai mục `field` `provider`, `provider_subject` (D-210.4); GraphQL `create_<c>_item` trùng
      → hai mục; `POST /utils/import/<c>` CSV hai dòng trùng → Backoffice lỗi hai mục, Directus một mục (D-210.4, analyze
      C2); `GET /activity?filter[collection][_eq]=backoffice_indexes` ở Backoffice có create + update (FR-016a); 400 các
      nhánh validate; trùng định nghĩa 400; `concurrentIndexCreation=false` → ready; chạy `TEST_DB=postgres`, `sqlite`,
      `mysql`.
- [x] T027 [US1] `tests/parity/accepted-differences.ts`: D-210 (`doc`), D-210.1 (`doc`), D-210.4 (`http`, `endpoints:
      ['POST /items/parity_idx_*', 'PATCH /items/parity_idx_*']`, `location: { jsonPointer: /^\/errors\/\d+\/extensions\/field$/ }`,
      `when: { directusStatus: 400 }`); `pnpm nx run parity-tests:test -- accepted-differences` xanh.

**Checkpoint**: MVP API: index ghép unique tạo được, ready, chặn ghi trùng ở hai app, lỗi liệt kê từng field; parity
US1 xanh trên ba vendor.

## Phase 4: User Story 3 - Tạo index không khóa bảng đang dùng, phần API (Priority: P2, lượt 1)

**Goal**: mặc định không khóa (Postgres `CONCURRENTLY`, MySQL inplace + fallback); job lỗi dọn INVALID; SIGTERM đánh
dấu `failed` trước khi pool đóng; dòng `creating` quá 1 giờ đọc như `failed`; hai request cùng index → một thành công.

**Independent Test**: unit jobs/shutdown; deploy `parity/deploy/indexes.test.ts` trên 3 replica (SC-004, SIGTERM).

### Tests for User Story 3 (MANDATORY) ⚠️

- [x] T028 [P] [US3] Unit `bi/jobs.test.ts`: lỗi trên Postgres → `helpers.schema.dropIndex` dọn rồi `failed`;
      `failRunningIndexJobs()` cập nhật mọi dòng đang chạy `failed` "Server shutdown" trong ≤ 500 ms và không chờ DDL;
      `createIndex` được gọi với `attemptConcurrentIndex: true` mặc định — chạy đỏ.
- [x] T029 [P] [US3] Unit `api/server.test.ts` (hoặc file test có sẵn của `server.ts`): `onSignal` gọi
      `failRunningIndexJobs` **trước** `database.destroy()` — chạy đỏ.
- [x] T030 [P] [US3] Unit service: `list` đổi dòng `creating` có `date_created` > 1 giờ, catalog không có/INVALID và
      (Postgres) `pg_stat_progress_create_index` không có dòng cho index đó thành `failed` "Index build stopped (replica
      shut down)" (tính lúc đọc, không update); Postgres có build đang chạy → giữ `creating` (analyze U1); dòng `creating`
      mới → giữ; unique `name` vi phạm khi insert → 400 "Index already exists" — chạy đỏ.
- [x] T031 [US3] Deploy `parity/deploy/indexes.test.ts` (mẫu `deploy/backoffice-permissions.test.ts`, `shutdown.test.ts`):
      bảng 200.000 dòng qua `psql`/`generate_series`; POST ở `replicaUrl(1)` → 202; GET ở `replicaUrl(2)` thấy `creating`
      rồi `ready`; trong lúc `creating` ghi 20 item qua `boLbUrl`, mỗi cái < 2 s (SC-004); POST
      `?concurrentIndexCreation=false` ghi bị chờ (quan sát thời gian); POST rồi SIGTERM replica đang chạy (`compose`) →
      dòng `failed` "Server shutdown", DELETE dọn INVALID (`psql` `pg_index.indisvalid`); hai POST đồng thời ở replica 1
      và 2 → một 202, một 400 — viết, chạy đỏ (không có job).

### Implementation for User Story 3

- [x] T032 [US3] `bi/jobs.ts`: dọn INVALID (`dropIndex` bỏ qua lỗi) trước `failed`; `failRunningIndexJobs()`; export;
      T028 xanh.
- [x] T033 [US3] `api/server.ts` `onSignal`: `await failRunningIndexJobs()` trước `database.destroy()` (comment
      `Backoffice (spec 030, D-210)`, giữ `Ported from`); T029 xanh.
- [x] T034 [US3] Service: quy tắc 1 giờ trong `list` với `building(name)` ở `bi/catalog.ts` (Postgres
      `pg_stat_progress_create_index`, vendor khác false; research R5); bắt vi phạm unique `name` ở insert → 400; T030 xanh.
- [ ] T035 [US3] Chạy T031 trên env deploy local (`pnpm nx run parity-tests:deploy -- indexes`), sửa tới xanh; ghi thời
      gian ghi đo được vào `specs/030-collection-indexes/spec.md` (US3 kịch bản 1, SC-004).

**Checkpoint**: job nền chịu lỗi, SIGTERM, replica chết; deploy suite xanh.

## Phase 5: User Story 4 - Xóa index, xóa field hay collection, index mất ngoài hệ thống, phần API (Priority: P1, lượt 1)

**Goal**: `DELETE` gỡ index rồi xóa dòng; xóa field ở Backoffice gỡ index trước cột (mọi vendor); xóa collection xóa
dòng; `missing: true` khi Directus/DBA xóa; dòng `creating` → 400.

**Independent Test**: unit cascade ở hai service; parity T040 (xóa field ở Backoffice → index và dòng mất, `/fields`
hai app bằng nhau; Directus xóa cột → `missing`).

### Tests for User Story 4 (MANDATORY) ⚠️

- [x] T036 [P] [US4] Unit service: `remove(collection, name)` → `dropIndex` + `deleteOne` (activity); `missing`/`failed`
      → chỉ xóa dòng, `DROP INDEX IF EXISTS` bỏ qua lỗi; `creating` < 1 giờ → 400 "Index is still being created"; tên không
      thuộc collection → 403; `dropForField(collection, field)` gỡ mọi dòng có field, 400 khi có `creating`;
      `deleteForCollection(trx, collection)` xóa dòng, 400 khi có `creating` chưa quá hạn (analyze C3); `remove` và cascade
      ghi activity `delete` với user gọi (FR-016a) — chạy đỏ.
- [x] T037 [P] [US4] Unit `api/services/fields.service.test.ts` (có sẵn): `deleteField` gọi `dropForField` sau
      `preColumnChange` và filter `fields.delete`, **trước** `transaction` (thứ tự bằng spy), `hasTable` false → bỏ qua;
      `addColumnIndex`/`addColumnToTable` snapshot cũ xanh — chạy đỏ.
- [x] T038 [P] [US4] Unit `api/services/collections.service.test.ts` (có sẵn): `deleteOne` xóa dòng `backoffice_indexes`
      trong transaction cạnh `backoffice_permissions` (`hasTable` guard); dòng `creating` chưa quá hạn → 400 trước
      `dropTable` (analyze C3) — chạy đỏ.
- [x] T039 [P] [US4] Unit controller: `DELETE :collection/indexes/:name` 204/400/403 — chạy đỏ.

### Implementation for User Story 4

- [x] T040 [US4] Service `remove`, `dropForField`, `deleteForCollection`; controller DELETE; T036/T039 xanh.
- [x] T041 [US4] `api/services/fields.service.ts` `deleteField`: gọi `new BackofficeIndexesService({ knex: this.knex,
      schema: this.schema, accountability: this.accountability }).dropForField(collection, field)` trước `transaction`
      (`:722`), comment `Backoffice (spec 030, D-210.3)`; `api/services/collections.service.ts` `deleteOne`: `deleteForCollection`
      trong transaction cạnh `:712-716`; T037/T038 xanh; `pnpm nx run api:test -- fields.service collections.service` xanh nguyên.
- [x] T042 [US4] Parity `parity/schema/indexes.test.ts` phần US4 trên ba vendor: DELETE 204 → catalog không còn, ghi trùng
      được; xóa field `provider` ở Backoffice (`DELETE /fields`) → cột mất, index mất, dòng mất, `/fields` hai app bằng
      nhau (D-210.3); `POST /schema/apply` xóa field có index → như trên; tạo lại index rồi Directus xóa cột
      (`appRequest('directus','DELETE','/fields/...')`) → GET Backoffice `missing: true` (MySQL: index còn trên cột còn
      lại được dọn khi DELETE dòng), DELETE dòng 204; xóa collection ở Backoffice → dòng mất; dòng `creating` (mock bằng
      insert thẳng qua `knexConfig`) → DELETE 400, xóa field 400; `accepted-differences.ts` thêm D-210.2, D-210.3 (`doc`).

**Checkpoint**: cascade và dọn dẹp đúng trên ba vendor; parity US1 + US4 xanh.

## Phase 6: User Story 2 - Admin tạo index trigram cho tìm kiếm trên Postgres, phần API (Priority: P2, lượt 1)

**Goal**: `type: 'trigram'` một field string/text trên Postgres: `CREATE EXTENSION IF NOT EXISTS pg_trgm` rồi GIN trên
`lower(col)`; `?search=` dùng index; vendor khác 400; `meta.trigram`.

**Independent Test**: parity T045 với `EXPLAIN` (`TEST_DB=postgres`), 400 trên sqlite/mysql.

### Tests for User Story 2 (MANDATORY) ⚠️

- [x] T043 [P] [US2] Unit service: trigram với 2 field/kiểu số/`unique: true`/client ≠ postgres → 400 với thông điệp
      contracts; tên `<c>_<f>_trgm`; `meta.trigram` chỉ postgres — chạy đỏ.
- [x] T044 [P] [US2] Unit `bi/jobs.test.ts`: trigram chạy `CREATE EXTENSION IF NOT EXISTS pg_trgm` trước `createIndex`;
      lỗi `42501` → `failed` "pg_trgm is not installed; ask a DBA to run: CREATE EXTENSION pg_trgm" — chạy đỏ.

### Implementation for User Story 2

- [x] T045 [US2] Service validate trigram + `meta.trigram`; `bi/jobs.ts` nhánh `pg_trgm` (R2); T043/T044 xanh.
- [x] T046 [US2] Parity `parity/schema/indexes.test.ts` phần US2: `TEST_DB=postgres`: POST trigram `name` → ready;
      `pg_extension` có `pg_trgm`; `EXPLAIN (COSTS OFF) SELECT ... WHERE LOWER(name) LIKE '%abc%'` qua `knexConfig` chứa
      `Bitmap Index Scan on <c>_name_trgm` (fixture 10.000 dòng); `GET /items/<c>?search=abc` hai app cùng kết quả và thứ
      tự trước/sau index; trigram trên `payload` (json) 400, hai field 400, `unique: true` 400; `TEST_DB=sqlite|mysql`:
      trigram 400 "Trigram indexes need PostgreSQL"; MySQL btree trên `note` (text) 400; Postgres/SQLite btree trên
      `note` ready.

**Checkpoint**: trigram xanh trên Postgres, 400 đúng chỗ trên hai vendor kia.

## Phase 7: User Story 5 - Chạy song song với Directus (Priority: P2) + đóng lượt 1

**Goal**: không test hiện có đổi kết quả; dump/bootstrap/deploy biết bảng mới; tài liệu vận hành; commit lượt 1.

**Independent Test**: parity `items/*`, `schema-management/*`, blackbox hiện có xanh nguyên trên ba vendor; `bootstrap`
profile xanh.

- [ ] T047 [P] [US5] `parity/bootstrap/cross.test.ts` chạy xanh với `backoffice_indexes` (profile `bootstrap`:
      `pnpm nx run parity-tests:bootstrap`); `tests/parity/README.md` mục 030 (suite `schema/indexes`, deploy `indexes`,
      D-210..D-210.4).
- [x] T048 [P] [US5] `deploy/README.md` mục "Index của collection (spec 030)": `pg_trgm` và quyền (Postgres ≥ 13 chủ DB
      đủ; lệnh cho DBA), 202 + trạng thái, SIGTERM đánh dấu `failed`, dòng `creating` quá 1 giờ, gỡ tay (`DROP INDEX`,
      `DROP TABLE backoffice_indexes`, dòng `20261103A`), index ngoài snapshot/apply, một kết nối pool mỗi job.
- [x] T049 [US5] Chạy `pnpm nx run api:lint`, `api:typecheck`, `api:test` (`--maxWorkers=1`), `system-data:test`,
      `parity-tests:test`; parity `TEST_DB=postgres|sqlite|mysql pnpm nx run parity-tests:parity -- schema/indexes
      items/ schema-management/`; blackbox liên quan; sửa tới xanh.
- [ ] T050 [US5] Đóng lượt 1: `git add` theo đường dẫn (API, libs, tests, deploy/README, specs/030, SPECKIT-GUIDE.md,
      CLAUDE.md), commit `feat(api): collection indexes: composite, trigram, non-blocking creation (spec 030, D-210)` với
      dòng `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; push khi `main` rảnh; theo dõi CI (`gh run watch`),
      sửa job đỏ; `graphify update .`; ghi mã commit và run CI vào `specs/030-collection-indexes/spec.md` Status.

**Checkpoint**: lượt 1 trên `main`, CI xanh.

## Phase 8: User Story 1 - Card "Indexes" trên trang collection, phần web (Priority: P1, lượt 2)

**Goal**: card độc lập sau BoForm: liệt kê, thêm (BoSelect + BoSortableList + BoSwitch), xóa với xác nhận; ẩn khi API
là Directus; strings en-US/vi-VN.

**Independent Test**: browser test card + axe; unit composable; `FieldsRoute.test.ts` với request 229.

### Tests for User Story 1 (MANDATORY) ⚠️

- [x] T051 [P] [US1] Unit `web/composables/use-collection-indexes.test.ts` (`mockApi`): GET 404 → `available=false`,
      không log; 403 → false; 200 → `indexes`, `meta`; `create(body, concurrent=false)` gọi `POST
      ...?concurrentIndexCreation=false`; `remove(name)` DELETE; `indexesOf(field)`; cache theo collection dùng chung —
      chạy đỏ.
- [x] T052 [P] [US1] Browser test `dm/components/CollectionIndexes.browser.test.ts` (`mockFixtureApi` + answers): không
      render khi 404; bảng tên/fields chip/type/unique/status; dialog thêm: chọn field qua BoSelect → vào BoSortableList,
      menu dòng Move up/Move down/Remove (bàn phím), switch unique, Create gửi body đúng thứ tự, 400 hiện BoNotice trong
      dialog, 202 đóng dialog + dòng `creating`; một case chỉ bàn phím: Tab tới "Add index", Enter, chọn field bằng
      phím, Tab tới Create, Enter → POST đúng (SC-001, analyze C4); dialog xóa (danger) gọi DELETE; focus trả về nút; axe
      không serious — chạy đỏ.
- [x] T053 [P] [US1] `web/test-utils/fetch.ts` `KNOWN_REQUESTS` 229–231 (contracts/web.md); `dm/FieldsRoute.test.ts`:
      card render sau form với answer GET 200, không render với 404, `assertOnlyKnownRequests` — chạy đỏ.
- [x] T054 [P] [US1] `web/lang/overlay.test.ts` (có sẵn) chạy đỏ cho tới khi hai overlay có đủ key khối Spec 030.

### Implementation for User Story 1

- [x] T055 [US1] `web/composables/use-collection-indexes.ts` theo contracts/web.md (`sdk.request(requestEndpoint(...))`,
      `apiFetch` cho probe status, cache module theo collection); T051 xanh.
- [x] T056 [US1] `dm/components/CollectionIndexes.vue` (card mẫu `UserPasskeys.vue:189-266`, `data-testid="collection-indexes"`,
      icon `database`; BoTable cột `name`, `fields`, `type`, `unique`, `status`; `#item-append` nút xóa; `#empty`; dialog
      thêm với BoSelect "Add a field…" (items = cột thật `!alias` chưa chọn từ `fieldsStore.getFieldsForCollection`),
      BoSortableList (`item-key` field, `rowActions` Remove), BoSelect type (btree; trigram khi `meta.trigram`), BoSwitch
      unique (disabled + false khi trigram), BoSwitch concurrent (khi `meta.concurrent`, bật sẵn); dialog xóa danger);
      `dm/FieldsRoute.vue`: `<CollectionIndexes v-if="!isSystem" :collection />` sau `<BoForm>`; T052/T053 xanh.
- [x] T057 [US1] `web/lang/overlay/en-US.ts`, `vi-VN.ts` khối "Spec 030 (D-210.4)" theo bảng contracts/web.md; T054 xanh.

**Checkpoint**: card tạo/xóa index ghép chạy với API mock; browser test + axe xanh.

## Phase 9: User Story 3 + User Story 4 - Trạng thái, poll, toast, missing, hộp thoại xóa field, phần web (Priority: P1/P2, lượt 2)

**Goal**: dòng `creating` có vòng xoay và card poll 5 s tới khi hết; toast khi 202/ready/failed; `failed` hiện lỗi;
`missing` chip; xóa bị khóa khi `creating`; hộp thoại xóa field nêu index sẽ gỡ.

**Independent Test**: unit composable (fake timers), browser test trạng thái, `FieldsManagement.test.ts`.

### Tests (MANDATORY) ⚠️

- [x] T058 [P] [US3] Unit `use-collection-indexes.test.ts`: với dòng `creating`, `setInterval` 5 s gọi GET, dừng khi hết
      `creating` và khi unmount (`vi.useFakeTimers`); toast `index_ready_notice`/`index_failed_notice` khi trạng thái đổi;
      `notify` `index_created_notice` sau create — chạy đỏ.
- [x] T059 [P] [US3] Browser test `CollectionIndexes.browser.test.ts`: `creating` vòng xoay + nút xóa disabled; `failed`
      hiện `error` (title/tooltip); `missing` chip; dialog xóa dòng `failed`/`missing` gọi DELETE — chạy đỏ.
- [x] T060 [P] [US4] Unit `dm/fields/FieldsManagement.test.ts` (có sẵn, `mockApi`): dialog xóa field hiện "These indexes
      will be dropped: <name>" khi GET trả dòng có field; không hiện khi 404 hoặc không có index; xóa vẫn gọi `DELETE
      /fields/...` — chạy đỏ.

### Implementation

- [x] T061 [US3] Composable: poll + toast; card: trạng thái/`missing`/disabled; T058/T059 xanh.
- [x] T062 [US4] `dm/fields/FieldsManagement.vue`: body của BoDialog xóa field với `indexesOf(deleteTarget.field)` từ
      `useCollectionIndexes` (chỉ khi `available`); T060 xanh.

**Checkpoint**: card phản ánh job nền; hộp thoại xóa field cảnh báo.

## Phase 10: User Story 2 - Lựa chọn trigram trong dialog, phần web (Priority: P2, lượt 2)

- [x] T063 [P] [US2] Browser test: `meta.trigram=false` → BoSelect type chỉ btree; `true` → có trigram; chọn trigram cắt
      `fields` còn 1, unique tắt + disabled; BoSelect field chỉ string/text khi trigram — chạy đỏ.
- [x] T064 [US2] Card: logic trigram trong dialog; T063 xanh.

**Checkpoint**: trigram chọn được chỉ khi API báo hỗ trợ.

## Phase 11: E2E ba cấu hình + benchmark (US1, US2, US3, US4, US5)

- [x] T065 [P] [US5] `e2e/helpers/allowed-paths.ts` 229–231 (đồng bộ `fetch.ts`).
- [x] T066 [US1] `e2e/settings-data-model-indexes.spec.ts` (serial; collection `${P}_idx` qua `AdminApi` với `provider`,
      `provider_subject`, `name`; `proxy-directus`: `getByTestId('collection-indexes')` `toHaveCount(0)` rồi return;
      `proxy-api`/`cors`: mở trang collection, Add index → chọn `provider_subject` rồi `provider`, Move up qua menu
      "Options for provider" để `provider` lên đầu, switch Unique, Create → dòng `Creating…` rồi `Ready` (poll ≤ 60 s);
      `api.call('POST','/items/<c>')` hai lần trùng → lỗi có `errors.length === 2`; xóa field `provider` qua menu →
      dialog có dòng "These indexes will be dropped" → Delete → card không còn dòng; thêm lại index rồi xóa qua nút xóa →
      không còn; axe `[data-testid="collection-indexes"], [role="dialog"]`); chạy `E2E_CONFIG=proxy-api`, `cors`,
      `proxy-directus` trên chromium, firefox, webkit; sửa tới xanh.
- [x] T067 [US2] E2E `proxy-api` (Postgres): Add index type Trigram trên `name` → Ready; `cors` giống; `proxy-directus`
      bỏ qua (card ẩn).
- [x] T068 [P] [US2] Benchmark `tests/benchmark/src/items.ts` case `SEARCH_LIST` (`?search=<3 ký tự có trong seed
      title>&limit=25`) Backoffice-only trước/sau `CREATE INDEX ... USING gin (lower(title) gin_trgm_ops)` raw như case
      json path (`:153-189`), EXPLAIN; bảng kết quả thêm hai dòng; chạy `pnpm nx run benchmark:items` local nhỏ (hoặc CI
      `benchmark-items` thủ công) và ghi số đo vào `specs/030-collection-indexes/spec.md` (FR-024, US2).

**Checkpoint**: E2E ba cấu hình xanh trên ba trình duyệt; benchmark có số.

## Phase 12: Polish + đóng lượt 2

- [x] T069 [P] `design-system/docs/component-specs.md`: recipe "Q-xx Collection indexes" (card độc lập + BoTable + dialog
      BoSelect/BoSortableList/BoSwitch; trạng thái creating/ready/failed/missing; bàn phím).
- [x] T070 [P] Ghi chú "(030: ...)" ở `specs/006-schema-management/spec.md` (index một cột `is_unique`/`is_indexed` không
      đổi; index ghép qua 030; xóa field gỡ index 030 trước) và `specs/016-settings-module/spec.md` (card Indexes cuối
      trang collection; hộp thoại xóa field).
- [x] T071 [P] `CLAUDE.md` dòng 030 → "implemented", `SPECKIT-GUIDE.md` mục 030 trạng thái + bảng quyết định, bài học CI.
- [ ] T072 Đóng spec: `specs/030-collection-indexes/spec.md` Status "Implemented 2026-11-xx, hai lượt (commit, CI)",
      số đo SC-004/FR-024, D-210..D-210.4 "duyệt"; `checklists/requirements.md` ghi chú.
- [ ] T073 Chạy `pnpm nx run web:lint`, `web:typecheck`, `web:test:unit`, `web:test:browser`, `web:build`, E2E ba cấu
      hình; sửa tới xanh.
- [ ] T074 Đóng lượt 2: `git add` theo đường dẫn (web, web-e2e, benchmark, design-system, specs, CLAUDE.md,
      SPECKIT-GUIDE.md), commit `feat(web): Indexes card on the Data Model collection page (spec 030, D-210.4)` với dòng
      `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; push khi `main` rảnh; theo dõi CI (web, e2e-web, parity,
      deploy), sửa job đỏ; `graphify update .`; ghi mã commit và run CI vào spec Status.

**Checkpoint**: lượt 2 trên `main`, CI xanh, spec đóng.

## Dependencies & Execution Order

- **Phase 1 → 2**: T001 chốt SQL cho T006/T013/T015; T002 không chặn API.
- **Phase 2 → 3**: T010–T016 trước mọi story (migration, helper, catalog, khung route).
- **US1 API (3)** trước **US3 (4)** (job có rồi mới làm lỗi/SIGTERM) và **US4 (5)** (có dòng rồi mới xóa/cascade); **US2
  (6)** chỉ cần Phase 2 + T022/T023 (validate + job) nên làm được song song với 4/5 sau T024.
- **Lượt 2** chỉ bắt đầu sau T050 (API trên `main`, CI xanh). **Phase 8** trước 9 và 10; **Phase 11** sau 8–10; **Phase
  12** cuối.
- Trong mỗi story: test ([P]) viết trước và đỏ → implementation → parity/E2E.

## Parallel Example: Phase 2

```text
Song song: T003, T004, T005, T006, T007, T008, T009 (test đỏ)   → rồi T010; T011 ∥ T012; T013 → T014 ∥ T015 → T016
```

## Parallel Example: User Story 1 (API)

```text
Song song: T017, T018, T019, T020, T021 (test đỏ) → T022 → T023 ∥ T025 → T024 → T026 → T027
```

## Implementation Strategy

- **MVP** = Phase 1–3 + T040/T041 của Phase 5 (xóa và cascade là an toàn dữ liệu, không để lại index thiếu cột) +
  Phase 7: index ghép unique tạo/xóa được qua API, chặn ghi trùng ở hai app.
- Tăng dần: US3 (job chịu lỗi/SIGTERM, deploy), US2 (trigram), rồi web (card, dialog, E2E), benchmark, polish.
- Hai lượt commit; mỗi lượt kết thúc bằng CI xanh trước khi sang lượt sau.
