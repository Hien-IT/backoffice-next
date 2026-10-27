---

description: "Danh sách task cho feature 024: API chặn tìm kiếm, Import, Export theo cài đặt của collection"
---

# Tasks: API chặn tìm kiếm, Import, Export theo cài đặt của collection

**Input**: Tài liệu thiết kế trong `/specs/024-collection-toggles-api/`
**Prerequisites**: `plan.md`, `spec.md` (D-188, D-188.1, D-188.2, D-188.3, D-188.4 và câu lỗi FR-006 duyệt 2026-10-27).
Dùng thêm `research.md` (R1–R11), `data-model.md`, `contracts/` (`api.md`, `web.md`, `tests.md`), `quickstart.md`,
`checklists/requirements.md`, `checklists/api-compat.md`.

**Điều kiện bắt đầu**: spec, plan, tasks 024 đã commit lên `main` (commit `docs(024): spec, plan, tasks`). Làm trên
`main`, không branch; script `.specify` cần `SPECIFY_FEATURE=024-collection-toggles-api`. Checkout dùng chung với các
phiên khác: `git add` theo đường dẫn, không `git add -A`/`.`, không `stash`, `reset`, `checkout --`; không stage
`apps/api/project.json`, `apps/web/project.json`; push khi `main` không có run CI đang chạy (push hủy run cũ), rồi gửi
số run cho phiên "Speckit migration chức năng và directus_collections fields" (021) nếu phiên đó còn chạy. Không sửa
file dưới `directus/`. Máy local: chạy test từng file, `--maxWorkers=1`; không dừng container của phiên khác.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Endpoint đổi: `/items` (`GET`, `SEARCH`, `GET :pk`, `POST`, `PATCH`, `DELETE` khi có `search`; `?export=`),
  `/utils/export`, `/utils/import`, `/graphql` (query, `_aggregated`, field lồng, mutation). Đối chiếu:
  `parity/items/collection-toggles.test.ts` (D-188 `http`, đối chứng `assertParity` khi toggle bật hay request không
  bị chặn), case cache, flow, extension; bộ đối chiếu và blackbox hiện có không đổi (SC-002); E2E ba cấu hình.
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).

**Organization**: Task nhóm theo user story, xếp theo hai lượt commit (research R10): **Lượt 1** = Phase 1, 2, 3 (US1),
4 (US2), 5 (US3), 6 (US5), API; **Lượt 2** = Phase 7 (US4), 8 (Polish), web, E2E, tài liệu. Bước API của E2E 022 đảo
ngay ở lượt 1 (T027) vì lượt 1 làm nó đỏ ở `proxy-api`, `cors`. Mỗi lượt kết thúc bằng task "đóng lượt" (lint,
typecheck, test, build, E2E liên quan xanh, commit, push khi `main` rảnh, gửi số run cho phiên 021, CI xanh,
`graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `gql/` = `apps/api/src/services/graphql/`; `web/` = `apps/web/src/`;
  `e2e/` = `apps/web-e2e/src/`; `parity/` = `tests/parity/src/`.
- Comment code ghi Directus là "DR" (constitution IX). File port sửa giữ header nguồn và ghi `// Backoffice (spec 024,
  D-188): ...` tại chỗ sửa; file mới ghi `// Backoffice (spec 024, D-188)` ở đầu.
- Không biến env mới (VIII). Không DDL, không migration (II). Không sửa `ItemsService`, `ImportService`,
  `ExportService`, `sanitize-query.ts` (FR-009).
- Lỗi chặn: đúng `createCollectionForbiddenError(path, collection)` của
  `api/permissions/modules/process-ast/utils/validate-path/create-error.ts` (FR-006, contracts/api.md "Lỗi"); test so
  theo câu `You don't have permission to access collection "<c>" or it does not exist. Queried in root.` (hoặc
  `Queried in "<path>"`).
- Lệnh test: `pnpm nx run api:test -- <file>`, `pnpm nx run web:test -- <file>`, `pnpm nx run parity-tests:env-up
  --vendor=postgres` rồi `pnpm nx run parity-tests:test -- src/items/collection-toggles.test.ts`, `TEST_DB=sqlite3` cho
  SQLite, `E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- <spec>` (tên target kiểm lại trong `project.json` của từng
  project khi làm).

## Phase 1: Setup (chốt [Inference] của research)

**Purpose**: chốt các điểm chưa kiểm trước khi viết code; kết quả có thể đổi chi tiết R2, R7.

- [ ] T001 Kiểm và ghi "Kết quả T001" vào `specs/024-collection-toggles-api/research.md`: (a) dạng khóa `deep` của quan
      hệ a2o ở REST sau `sanitizeDeep` (`api/utils/sanitize-query.ts:243-290`): `field:collection` hay khác, bằng một
      test tạm gọi `sanitizeQuery({ deep: ... })` với schema mock có quan hệ a2o; (b) `tests/parity/src/parity.ts` áp
      `when.backofficeCode` thế nào cho response GraphQL 200/200 (đọc `errors[0].extensions.code` của body hay chỉ khi
      status khác): đọc code và `parity.test.ts`; (c) câu lỗi Directus 11.17.4 trả cho user không có quyền đọc collection
      (`GET /items/<c>`) trên env parity Postgres, khớp `createCollectionForbiddenError` (FR-006). Sai chỗ nào thì sửa R2,
      R7, `contracts/api.md`, `contracts/tests.md` trước khi làm Phase 2.
- [ ] T002 [P] Đo status Directus 11.17.4 trên env parity Postgres cho các hàng của `contracts/api.md` §1–§3 có cột
      Directus chưa chắc: `DELETE /items/<c>` theo `query.search` (204?), `GET /items/<c>/<pk>?search=` khi item không
      khớp từ khóa (403 hay 200 `data: null`), `POST /utils/import/<c>` (200 body rỗng), `POST /items/<c>?search=`; ghi
      "Kết quả T002" vào `specs/024-collection-toggles-api/research.md` và sửa cột Directus của `contracts/api.md` nếu khác.

---

## Phase 2: Foundational (đọc cài đặt, hàm kiểm dùng chung, guard trước response cache)

**Purpose**: phần lõi dùng chung cho US1, US2, US5 (REST qua guard), US1 (GraphQL qua resolver) và US3.

**⚠️ CRITICAL**: chưa xong Phase 2 thì không bắt đầu user story nào.

### Tests (MANDATORY) ⚠️

- [ ] T003 [P] Tạo `api/utils/collection-toggles.test.ts` (knex-mock-client như `api/services/*.test.ts`, cache bằng
      `getCache()` với `CACHE_STORE=memory`): `getCollectionToggles` miss → đúng một `select collection, bo_show_search,
      bo_show_import, bo_show_export from directus_collections`, hit → không query; `false` và `0` = tắt, `null`, `true`,
      `1`, cột thiếu = bật (FR-008); `clearSystemCache()` xóa map; `hasSearchOff` đúng/sai; `assertToggle` ném lỗi có
      `code` `FORBIDDEN` và message đúng câu `createCollectionForbiddenError('', c)` (và `Queried in "a.b"` khi có
      `path`); `assertCollectionToggles`: `search` rỗng không ném, chỉ khoảng trắng ném, `export` ném, `deep` o2m (đích
      là collection nhiều), m2o, a2o (khóa của T001(a) và `field__collection` của GraphQL), field không có quan hệ bỏ qua,
      collection hệ thống (`directus_users`) không ném. Chạy đỏ.
- [ ] T004 [P] Tạo `api/middleware/collection-toggles-guard.test.ts`: `GET /items/A?search=x` → lỗi trước `next`;
      `GET /items/A/1?search=x`, `POST /items/A?search=x`, `PATCH /items/A/1?search=x` → lỗi (FR-017, trước controller);
      `GET /items/A?export=csv`, `POST /items/A?export=csv`, `PATCH /items/A/1?export=json` → lỗi khi export tắt
      (FR-004, analyze U1); `GET /items/A` và `GET /items/A?search=` → `next()`;
      `GET /users?deep[rel][_search]=x` với quan hệ `directus_users.rel` → A (schema mock) → lỗi `Queried in "rel"`; `GET /parity-endpoint-demo/items?search=x`, `GET /server/info` → `next()` (FR-009);
      `POST /graphql` có `search` trong document → `res.locals.skipCacheRead === true` chỉ khi `hasSearchOff()`, không có
      collection tắt → không đặt cờ (FR-012, D-188.4). Chạy đỏ.
- [ ] T005 [P] Thêm vào `api/middleware/cache.test.ts` case `res.locals.skipCacheRead = true`: không gọi `getCacheValue`,
      header `CACHE_STATUS_HEADER` = `MISS` khi bật, gọi `next()`. Chạy đỏ.

### Implementation

- [ ] T006 Tạo `api/utils/collection-toggles.ts` (research R1, R2): `getCollectionToggles()` đọc/ghi key
      `collection-toggles` của `getCache().localSchemaCache` (miss: query của T003 bằng `getDatabase()`, giữ dòng có ít
      nhất một giá trị `false`/`0`); `hasSearchOff()`; `assertToggle(collection, kind, path = '')` ném
      `createCollectionForbiddenError(path, collection)`; `assertCollectionToggles(collection, query, schema)` kiểm
      `query.search` (chuỗi khác rỗng), `query.export`, rồi đi `query.deep` theo `getRelatedCollection`
      (`api/database/get-ast-from-query/utils/get-related-collection.ts`) và `getRelationInfo` (`@backoffice/utils`, a2o).
      T003 xanh.
- [ ] T007 Tạo `api/middleware/collection-toggles-guard.ts` (research R2, R3): `asyncHandler`; collection gốc từ
      `url.parse(req.originalUrl).pathname` (`/items/<c>[/<pk>]` → `<c>`; `/<x>...` → `directus_<x>` khi có trong
      `req.schema.collections`; còn lại `next()`); gọi `assertCollectionToggles(collection, req.sanitizedQuery,
      req.schema)`; với `/graphql*`: đặt `res.locals['skipCacheRead'] = true` khi `hasSearchOff()` và
      `getGraphqlQueryAndVariables(req).query` khớp `/\bsearch\b/`, kèm comment `// ponytail: a GraphQL document with
      "search" skips the shared cache read while a collection has search off (D-188.4); parse the document and resolve
      its collections before the cache when a benchmark asks for it.` T004 xanh.
- [ ] T008 Sửa `api/middleware/cache.ts` (file port): dòng `// Backoffice (spec 024, D-188.4)` → khi
      `res.locals['skipCacheRead']` thì đặt `MISS` (nếu bật header) và `return next()`, trước `getCacheKey`; sửa
      `api/app-pipeline.ts`: `app.use(collectionTogglesGuard)` ngay trước `app.use(checkCacheMiddleware)` (dòng 167),
      comment Backoffice. T005 xanh; `api:test` của `app.test.ts`, `middleware/*.test.ts` xanh.

**Checkpoint**: `GET /items/A?search=`, `?export=` bị chặn trước cache; request khác đi như cũ.

---

## Phase 3: User Story 1 - API từ chối tìm kiếm trên collection đã tắt "Hiện ô tìm kiếm" (Priority: P1) 🎯 MVP

**Goal**: mọi từ khóa tìm kiếm nhắm vào collection tắt `bo_show_search` qua REST và GraphQL của Backoffice nhận lỗi quyền
collection (FR-002, FR-003, FR-006, FR-017); đọc không từ khóa giống Directus.

**Independent Test**: tắt search của `parity_toggles_<run>`; `parity/items/collection-toggles.test.ts` phần search ở
Postgres và SQLite: Backoffice 403/`errors`, Directus 200 (D-188), request không bị chặn `assertParity`.

### Tests for User Story 1 (MANDATORY) ⚠️

- [ ] T009 [P] [US1] Thêm vào `api/controllers/items.controller.test.ts`: `SEARCH /items/A` body `{"query":{"search":"x"}}`
      → lỗi sau `validateBatch`; `PATCH /items/A` và `DELETE /items/A` body `{"query":{"search":"x"}, ...}` → lỗi, không
      gọi `updateByQuery`/`deleteByQuery`; toggle bật → như cũ. Chạy đỏ.
- [ ] T010 [P] [US1] Thêm vào `gql/resolvers/query.test.ts`: `A(search: "x")`, `A_aggregated(search: "x")`, field lồng
      `B { rel(search: "x") }` (qua `query.deep`) → `ForbiddenError` đúng câu, không gọi `gql.read`; `search: ""` và
      `filter` → như cũ; scope `system` collection gốc `directus_users` → không chặn, nhưng field lồng
      `users { rel(search: "x") }` với `rel` → A → `ForbiddenError` `Queried in "rel"` (analyze C1). Chạy đỏ.
- [ ] T011 [P] [US1] Tạo `gql/resolvers/mutation.test.ts`: `create_A_items(data, search: "x")`, `create_A_item`,
      `update_A_items(ids, data, search: "x")`, `update_A_batch` → lỗi trước `createMany`/`updateMany`/`updateBatch`
      (spy không được gọi, clarify câu 1); không `search` → như cũ; singleton `update_S(search)` → lỗi trước
      `upsertSingleton`. Chạy đỏ.
- [ ] T012 [US1] Tạo `parity/items/collection-toggles.test.ts` (dạng `parity/items/json-path.test.ts`): collection
      per-run `parity_toggles_<run>` (`title` string), `parity_toggles_child_<run>` (m2o `parent` → gốc, o2m `children`)
      qua `createUserCollection`, `createField`, `POST /relations` của `parity/permissions/fixtures.ts`; seed vài dòng;
      user thường có policy đọc/sửa hai collection và static token (`createUser`, `permissions/fixtures.ts:204`); public:
      quyền đọc hai collection trên policy public (`getPublicPolicy` của `parity/schema/helpers.ts`); share của một item
      (đăng nhập share như `parity/auth/shares.test.ts`); helper `setToggles(meta, { clear = true })` = `PATCH
      /collections/parity_toggles_<run>` ở Directus, rồi `POST /utils/cache/clear` ở hai app khi `clear`. Phần search
      (search tắt): mọi hàng §1 của `contracts/api.md` với admin, user thường (JWT và static token), share, public
      (FR-007, analyze G2): `parity(...)` ở hai app, khác biệt chấp nhận D-188, Backoffice kiểm status 403 hay
      `errors[0].extensions.code` `FORBIDDEN`, câu lỗi, số dòng không đổi sau `PATCH`/`DELETE`/`POST`/mutation; `search=`
      rỗng, không `search`, `filter` → `assertParity`; toggle bật và null → `assertParity` cho cùng các request (FR-011).
      Endpoint hệ thống (analyze C1, Nguyên tắc V): collection per-run `parity_toggles_owned_<run>` có m2o `owner` →
      `directus_users` và alias o2m cùng tên trên `directus_users` (`POST /fields/directus_users` type `alias` special
      `o2m`, `one_field` của quan hệ; không DDL bảng hệ thống); tắt search của `parity_toggles_owned_<run>`;
      `GET /users?deep[<alias>][_search]=x` và `POST /graphql/system` `{ users { <alias>(search: "x") { id } } }` → D-188,
      Backoffice `Queried in "<alias>"`. FR-013 (analyze G1): `setToggles({ bo_show_search: false }, { clear: false })`
      (sửa ở Directus, không xóa cache tay) rồi `GET /items/parity_toggles_<run>?search=x` ở Backoffice → 403; bật lại cũng
      không xóa tay → `assertParity`. `afterAll`: bật lại, xóa alias trên `directus_users`, quan hệ, collection per-run,
      xóa quyền public đã thêm, xóa cache, `cleanup()`. Thêm file vào hai danh sách của `parity/suite.ts` (reduced cạnh `json-path`, full
      `src/items/{crud,export,json-path,collection-toggles}.test.ts`). Chạy đỏ ở Backoffice.
- [ ] T013 [P] [US1] Thêm vào `tests/parity/accepted-differences.ts`: `D-188` `kind: 'http'`, `feature: '024'`,
      `endpoints: ['GET /items/parity_toggles_*', 'SEARCH /items/parity_toggles_*', 'POST /items/parity_toggles_*',
      'PATCH /items/parity_toggles_*', 'DELETE /items/parity_toggles_*', 'POST /utils/export/parity_toggles_*', 'POST
      /utils/import/parity_toggles_*', 'GET /users', 'POST /graphql', 'POST /graphql/system']`, `location: { any: true }`, `when: { backofficeCode: 'FORBIDDEN'
      }` (chỉnh theo T001(b)), `reason`; `D-188.1`, `D-188.2`, `D-188.3`, `D-188.4` `kind: 'doc'` với `reason` theo bảng
      Khác biệt của spec. `parity/accepted-differences.test.ts` (đối chiếu mã với bảng Khác biệt qua
      `parity/spec-differences.ts`) xanh.

### Implementation for User Story 1

- [ ] T014 [US1] Sửa `api/controllers/items.controller.ts`: `search()` gọi `assertCollectionToggles(req.collection,
      req.sanitizedQuery, req.schema)` sau `validateBatch('read')`; `updateMany` và `deleteMany` nhánh `req.body.query`
      (dòng 161, 221) gọi với `sanitizedQuery` của body trước service; comment `// Backoffice (spec 024, D-188)`. T009 xanh.
- [ ] T015 [US1] Sửa `gql/resolvers/query.ts`: sau khối `isAggregate`/`getQuery` (dòng 25-41), trước `gql.read` (dòng
      50), gọi `assertCollectionToggles(collection, query, gql.schema)`. T010 xanh.
- [ ] T016 [US1] Sửa `gql/resolvers/mutation.ts`: sau khi bỏ hậu tố `_batch`/`_items`/`_item` (dòng 30-32), trước
      `upsertSingleton` và `getService` (dòng 34-38), gọi `assertCollectionToggles(collection, query, gql.schema)`. T011
      xanh.
- [ ] T017 [US1] Chạy `parity/items/collection-toggles.test.ts` phần search trên Postgres (cặp chính) và SQLite
      (`TEST_DB=sqlite3`, reduced) xanh; sửa code (không sửa test) đến khi xanh.

**Checkpoint**: tìm kiếm bị chặn ở mọi đường của FR-002, FR-003, FR-017; request khác giống Directus.

---

## Phase 4: User Story 2 - API từ chối export trên collection đã tắt "Hiện Export" (Priority: P1)

**Goal**: `?export=` (list và `:pk`) và `POST /utils/export/<c>` bị chặn khi export tắt; body `query.search` của
`/utils/export` bị chặn khi search tắt (FR-004, FR-017).

**Independent Test**: tắt export của `parity_toggles_<run>`; phần export của `collection-toggles.test.ts`: không trả
file, không tạo dòng `directus_files`; `GET` không `export` giống Directus.

### Tests for User Story 2 (MANDATORY) ⚠️

- [ ] T018 [P] [US2] Thêm vào `api/controllers/utils.controller.test.ts`: `POST /utils/export/A` khi export tắt → lỗi,
      `exportToFile` không được gọi; export bật + body `query.search` khi search tắt → lỗi; export bật, không search →
      như cũ. Chạy đỏ.
- [ ] T019 [US2] Thêm phần export vào `parity/items/collection-toggles.test.ts` (sau T012, cùng file): export tắt →
      `?export=csv`, `?export=json` (list và `:pk`), `POST /items?export=csv` và `PATCH /items/:pk?export=json` (số dòng
      và giá trị không đổi; FR-004, analyze U1), `POST /utils/export` (đếm dòng `directus_files` qua `hostDb()` không
      tăng sau 2 giây) với admin và user thường: D-188, Backoffice 403; `GET` không `export` → `assertParity`. Chạy đỏ
      cho `/utils/export`.

### Implementation for User Story 2

- [ ] T020 [US2] Sửa `api/controllers/utils.controller.ts` `export/:collection` (dòng 169): sau `collectionExists`, trước
      kiểm `query`/`format` của body: `assertToggle(collection, 'export')`; sau `sanitizeQuery` của body, trước
      `exportToFile`: `assertCollectionToggles(collection, sanitizedQuery, req.schema)`; comment Backoffice. T018, T019
      xanh (`?export=` của `/items` đã chặn ở guard T007).

**Checkpoint**: export bị chặn ở cả ba đường; T017 vẫn xanh.

---

## Phase 5: User Story 3 - API từ chối import trên collection đã tắt "Hiện Import" (Priority: P1)

**Goal**: `POST /utils/import/<c>` bị chặn trước khi đọc file khi import tắt (FR-005); `POST /items` không đổi.

**Independent Test**: tắt import; phần import của `collection-toggles.test.ts`: 0 item mới; `POST /items/<c>` giống
Directus.

### Tests for User Story 3 (MANDATORY) ⚠️

- [ ] T021 [P] [US3] Thêm vào `api/controllers/utils.controller.test.ts`: `POST /utils/import/A` multipart khi import tắt
      → lỗi, `ImportService.import` không được gọi, busboy không đọc stream; import bật → như cũ. Chạy đỏ.
- [ ] T022 [US3] Thêm phần import vào `parity/items/collection-toggles.test.ts` (sau T019): import tắt → `POST
      /utils/import` CSV 2 dòng (multipart của `parity/files/helpers.ts`) với admin và user thường: D-188, Backoffice 403,
      đếm dòng không tăng; `POST /items` một item và mảng → `assertParity` (dòng tạo xóa sau). Chạy đỏ.

### Implementation for User Story 3

- [ ] T023 [US3] Sửa `api/controllers/utils.controller.ts` `import/:collection` (dòng 121): `assertToggle(collection,
      'import')` ngay sau `collectionExists`, trước kiểm `Content-Type` và busboy; comment Backoffice. T021, T022 xanh.

**Checkpoint**: import bị chặn; T017, T019 vẫn xanh.

---

## Phase 6: User Story 5 - Chạy song song và không ảnh hưởng chỗ khác (Priority: P1)

**Goal**: response cache dùng chung không lọt (FR-012); flow và extension không bị chặn (FR-009); bộ đối chiếu, blackbox
hiện có không đổi (SC-002); E2E 022 theo hành vi mới.

**Independent Test**: case cache, flow, extension xanh; bộ đối chiếu hiện có xanh; `e2e/content-collection-toggles.spec.ts`
xanh ở ba cấu hình.

### Tests for User Story 5 (MANDATORY) ⚠️

- [ ] T024 [US5] Thêm case cache vào `parity/items/collection-toggles.test.ts` (sau T022), chỉ trên cặp chính có cache
      (như `parity/items/cache-cross.test.ts:334`, không gửi `cache-control: no-store`): search tắt; `GET
      /items/parity_toggles_<run>?search=x` ở Directus (200, ghi cache) rồi cùng request, cùng token ở Backoffice → 403;
      cùng document GraphQL `{ parity_toggles_<run>(search: "x") { id } }` ở Directus rồi Backoffice → `errors`
      `FORBIDDEN` (US5-2, SC-003). Thêm case D-188.4: bật lại search của mọi collection → document có `search` ở
      Backoffice đọc cache như cũ (header `x-cache-status` `HIT` lần hai, như `parity/graphql/cache.test.ts:12`).
- [ ] T025 [P] [US5] Thêm vào `parity/flows/operations.test.ts` case operation `item-read` có `query.search` trên một
      collection per-run tắt search: flow chạy ở hai app, dữ liệu trả giống nhau (FR-009, US5-3, SC-004); bật lại sau.
- [ ] T026 [P] [US5] Thêm vào `parity/extensions/endpoints.test.ts` (profile `extensions`): tắt ba cài đặt của
      `bo_ext_items`, `same({ path: '/parity-endpoint-demo/items?search=x&export=csv' })` giống ở hai app; bật lại và xóa
      cache sau (FR-009, SC-004, checklist CHK027).
- [ ] T027 [US5] Sửa `e2e/content-collection-toggles.spec.ts` test "both false" (dòng 143-157) và header comment (dòng
      1-5, "the API still searches and exports (FR-008)" → hành vi 024): khi `e2eConfig !== 'proxy-directus'` (`import
      { e2eConfig } from './helpers/config.js'`) mong `GET /items/bo_content?search=Content&limit=1` và
      `?export=csv&limit=1` trả 403 `FORBIDDEN` (helper trả status, không ném), `POST /utils/export/bo_content` 403,
      `POST /utils/import/bo_content` CSV một dòng 403 và số item không tăng; `proxy-directus` giữ 200 như hiện nay
      (D-188). Tên test đổi theo (US1-1, US2-1, US3-1 của 024).

### Implementation for User Story 5

- [ ] T028 [US5] Chạy và làm xanh (sửa code, không sửa test): T024 (Postgres cặp chính), T025, T026 (profile
      `extensions`), T027 (`E2E_CONFIG=proxy-api` và `proxy-directus` local); bộ hiện có không đổi kết quả (SC-002):
      `parity/items/{crud,export,json-path,cache-cross}.test.ts`, `parity/graphql/{read,write,schema,cache}.test.ts`,
      `parity/system/import-export.test.ts`, blackbox items (`parity/items/blackbox`) trên Postgres.
- [ ] T029 Đóng lượt 1: `pnpm nx run-many -t lint,typecheck -p api parity-tests web-e2e`; `api:test` các file đã sửa và
      cả `middleware/`, `utils/`, `gql/resolvers/`, `controllers/` (coverage BE ≥ 80 %); parity Postgres
      (`collection-toggles`, bộ của T028), SQLite và MySQL (`collection-toggles`, `crud` reduced), profile `extensions`
      (`endpoints`) local xanh; E2E `content-collection-toggles` local `proxy-api`; `git add` theo đường dẫn (Phase 1–6,
      `research.md`); commit `feat(024): block search, import and export at the API per collection toggle (D-188)`; push
      khi `main` rảnh; gửi số run cho phiên 021; CI xanh (`parity` Postgres, sqlite3, mysql reduced; `guard-differences`;
      `e2e-web` ba cấu hình); `graphify update .`.

**Checkpoint (MVP)**: API chặn đủ ba phần; chủ dự án dùng được ngay qua API.

---

## Phase 7: User Story 4 - Drawer chọn item theo cài đặt tìm kiếm (Priority: P2)

**Goal**: DrawerCollection, `list-o2m` (collection liên quan), `list-m2m` (collection trung gian) ẩn ô nhập từ khóa khi
collection nhận từ khóa tắt `bo_show_search`, giữ bộ lọc, không gửi `search` (FR-014, D-188.3).

**Independent Test**: unit web; E2E drawer và `list-o2m` ở ba cấu hình với admin và user thường.

### Tests for User Story 4 (MANDATORY) ⚠️

- [ ] T030 [P] [US4] Thêm vào `web/components/drawers/DrawerCollection.test.ts`: meta `bo_show_search: false` →
      `SearchInput` nhận `showSearch` `false`, layout wrapper nhận `search` `null` dù preset có `search`; `true`/`null` →
      như cũ. Chạy đỏ.
- [ ] T031 [P] [US4] Thêm vào `web/interfaces/list-o2m/ListO2M.test.ts`: `enableSearchFilter: true`, collection liên quan
      meta `bo_show_search: false`, 11 item → không ô search (`input[type=search]`), `query` truyền cho
      `useRelationMultiple` không có `search`; meta `true` → ô hiện như cũ. Chạy đỏ.
- [ ] T032 [P] [US4] Thêm vào `web/interfaces/list-m2m/ListM2M.test.ts`: như T031 theo meta của collection trung gian
      (`relationInfo.junctionCollection`); meta của collection liên quan tắt nhưng trung gian bật → ô vẫn hiện (research
      R5). Chạy đỏ.

### Implementation for User Story 4

- [ ] T033 [P] [US4] Sửa `web/components/drawers/DrawerCollection.vue`: `showSearch = computed(() =>
      collectionInfo.value?.meta?.bo_show_search !== false)`, `activeSearch = computed(() => (showSearch.value ?
      search.value : null))`; `:search="activeSearch"` (dòng 179), `<SearchInput :show-search="showSearch" ...>` (dòng 204);
      comment `// Backoffice (spec 024, D-188.3)` như `web/modules/content/routes/CollectionRoute.vue:139-144`. T030 xanh.
- [ ] T034 [P] [US4] Sửa `web/interfaces/list-o2m/ListO2M.vue`: `showSearch` theo
      `relationInfo.value?.relatedCollection.meta?.bo_show_search !== false`; `v-if="enableSearchFilter && showSearch &&
      (...)"` (dòng 556); `if (search.value && showSearch.value) q.search = search.value` (dòng 163). T031 xanh.
- [ ] T035 [P] [US4] Sửa `web/interfaces/list-m2m/ListM2M.vue`: như T034 với `relationInfo.value?.junctionCollection.meta`
      (dòng 191, 598). T032 xanh.
- [ ] T036 [US4] Thêm vào `e2e/content-collection-toggles.spec.ts` test drawer (US4-1, US4-2): collection per-run
      `e2e_toggles_<run>` (tên qua `e2eName`) có m2o `target` → `bo_content` (interface `select-dropdown-m2o`, như
      `e2e/content-filter-json-path.spec.ts:64-69`); `toggle({ bo_show_search: false })`; mở item mới của collection
      per-run, bấm field `target` → dialog có `table`: không `searchbox`, có nút `Filter`, bảng có dòng; Tab tới Filter,
      Enter mở popover; admin và reader (reader có quyền đọc collection per-run); xóa collection trong `afterAll`. Thêm
      path tạo collection/field/relation vào `e2e/allowed-paths.ts` nếu thiếu.
- [ ] T037 [US4] Thêm vào `e2e/content-collection-toggles.spec.ts` test `list-o2m` (US4-4): collection per-run
      `e2e_toggles_parents_<run>` có o2m `children` (interface `list-o2m`, `enableSearchFilter: true`) ←
      `e2e_toggles_<run>.parent`; seed 11 con cho một cha; tắt search của collection con; mở item cha: field `children` có
      bảng 11 dòng (hoặc trang đầu), không ô search; bật lại → ô hiện.

---

## Phase 8: Polish & Cross-Cutting (lượt 2)

- [ ] T038 [P] Sửa `specs/022-collection-ui-toggles/spec.md`: FR-008 thêm "(sửa bởi 024: API Backoffice cũng chặn,
      D-188)", FR-009 thêm "(sửa bởi 024: DrawerCollection, `list-o2m`, `list-m2m` theo cài đặt tìm kiếm, D-188.3)", US2
      kịch bản 4 và FR-019 (bước API của E2E) ghi chú tương tự.
- [ ] T039 [P] Sửa `deploy/README.md` (sau đoạn D-184, dòng 270): D-188 ở shared-domain (request rơi vào Directus không
      bị chặn), sửa SQL thì `POST /utils/cache/clear`; `tests/parity/README.md` (gần dòng 132): file
      `items/collection-toggles.test.ts`, D-188 `http`, case cache, flow, extension.
- [ ] T040 [P] Kiểm `design-system/docs/migration-guide.md`: 024 không thêm màu, token, component (chỉ ẩn ô có sẵn) nên
      không đổi; ghi "Kết quả T040" một dòng vào `specs/024-collection-toggles-api/research.md` R9.
- [ ] T041 [P] Sửa `CLAUDE.md`: dòng Active Technologies của 024 đổi "planned" thành "implemented 2026-10-xx", thêm mục
      Recent Changes 024 (D-188..D-188.4, guard trước cache, drawer/o2m/m2m); `SPECKIT-GUIDE.md` mục 024 dòng Trạng thái
      (lượt, commit, CI).
- [ ] T042 Chạy `quickstart.md` trên env parity (`proxy-api`): các lệnh `curl` cho đúng status ghi trong file; sai thì
      sửa quickstart hoặc code.
- [ ] T043 Chạy workflow `benchmark-items` và `benchmark-web` trên CI sau push lượt 1 (hoặc lượt 2) như 023; SC-006:
      scenario hiện có không tệ hơn Directus quá 10 %; ghi "Kết quả benchmark" vào
      `specs/024-collection-toggles-api/research.md`.
- [ ] T044 Đóng lượt 2: `pnpm nx run-many -t lint,typecheck -p web web-e2e`; `web:test` các file đã sửa và cả
      `components/drawers/`, `interfaces/list-o2m/`, `interfaces/list-m2m/` (coverage FE ≥ 60 %); `web:build`; E2E
      `content-collection-toggles` local `proxy-api` và `proxy-directus`; `git add` theo đường dẫn; commit
      `feat(024): item drawer and list-o2m/list-m2m follow the search toggle (D-188.3)` và `docs(024): close the
      collection toggles API spec`; spec 024 dòng Status → `Implemented 2026-10-xx` với commit và số run CI; push khi
      `main` rảnh; gửi số run cho phiên 021; CI xanh (`e2e-web` ba cấu hình, `web`); `graphify update .`.

---

## Dependencies & Execution Order

### Phase

- Lượt 1: Phase 1 (T001, T002) → Phase 2 (T003–T008) → Phase 3 (US1, T009–T017) → Phase 4 (US2, T018–T020) → Phase 5
  (US3, T021–T023) → Phase 6 (US5, T024–T028) → T029 đóng lượt 1.
- Lượt 2: Phase 7 (US4, T030–T037) → Phase 8 (T038–T043) → T044; E2E của T036, T037 cần lượt 1 trên `main` (API của
  env `proxy-api`, `cors` chặn search, nên drawer phải không gửi `search`).

### User story

- US1, US2, US5 cần Phase 2 (guard, hàm kiểm). US3 chỉ cần T006 (`assertToggle`).
- US2, US3 độc lập với US1 về code (khác file trừ `utils.controller.ts` chung cho T020, T023: T020 trước), nhưng
  `collection-toggles.test.ts` dùng chung: T012 → T019 → T022 → T024 theo thứ tự.
- US4 (web) không cần API cho unit (T030–T035); E2E (T036, T037) cần lượt 1.

### Trong một story

- Test trước (chạy đỏ), rồi code.
- `parity/items/collection-toggles.test.ts`: T012, T019, T022, T024 sửa theo thứ tự.
- `api/controllers/utils.controller.ts`: T020 rồi T023; `utils.controller.test.ts`: T018 rồi T021.
- `e2e/content-collection-toggles.spec.ts`: T027 (lượt 1), T036, T037 (lượt 2) theo thứ tự.

## Parallel Example

```bash
# Phase 1–2:
T001 deep a2o / parity backofficeCode / Directus message | T002 Directus statuses
T003 collection-toggles.test | T004 guard.test | T005 cache.test

# Phase 3–6 (sau Phase 2):
T009 items.controller.test | T010 query.test | T011 mutation.test | T013 accepted-differences | T018 utils.controller.test (export)
T025 flows/operations case | T026 extensions/endpoints case
# T012 → T019 → T022 → T024 cùng file collection-toggles.test.ts

# Lượt 2:
T030 DrawerCollection.test | T031 ListO2M.test | T032 ListM2M.test
T033 DrawerCollection.vue | T034 ListO2M.vue | T035 ListM2M.vue
T038 spec 022 | T039 READMEs | T040 migration-guide | T041 CLAUDE.md, SPECKIT-GUIDE.md
```

## Implementation Strategy

### MVP (lượt 1)

1. Phase 1 → chốt khóa `deep` a2o, cách parity đọc `backofficeCode`, câu lỗi Directus (T001), status Directus (T002).
2. Phase 2 → đọc cài đặt, hàm kiểm, guard trước cache. **Dừng và kiểm**: `api:test` cũ xanh, `GET /items/A?search=x` 403
   với đúng câu lỗi quyền collection.
3. Phase 3 (US1) → `SEARCH`, `PATCH`/`DELETE` theo query, GraphQL query và mutation; parity search xanh.
4. Phase 4, 5 (US2, US3) → export, import.
5. Phase 6 (US5) → cache, flow, extension, E2E 022 đảo; đóng lượt 1. Chủ dự án dùng được ngay qua API.

### Tăng dần

- Lượt 2: web (US4), E2E drawer và `list-o2m`, tài liệu, benchmark, đóng feature.

## Notes

- 44 task; 22 task [P]. Setup 2 (T001–T002), Foundational 6 (T003–T008), US1 9 (T009–T017), US2 3 (T018–T020), US3 3
  (T021–T023), US5 5 (T024–T028), US4 8 (T030–T037), Polish 6 (T038–T043), đóng lượt 2 (T029, T044).
- Bước API của E2E 022 (T027) ở lượt 1, không phải lượt 2 như prompt của tasks, vì lượt 1 làm nó đỏ ở `proxy-api`,
  `cors` (research R10).
- `?export=` của `/items` và `?search=` của mọi request `/items` được guard (T007) chặn trước controller; controller chỉ
  thêm kiểm cho query trong body (`SEARCH`, `PATCH`, `DELETE`, `/utils/export`).
- `/users?deep[...]` và field lồng của `/graphql/system` có cả unit (T004, T010) và parity (T012), theo Nguyên tắc V
  (analyze C1; đảo quyết định "chỉ unit" của checklist CHK029).
- Analyze 2026-10-27 đã áp: C1, G1, I1, CQ1, G2, U1, I2; còn I3, I4, G3, G4, D1 (LOW) để lại.
- Resolver riêng của `gql/resolvers/system.ts` không kiểm (spec Assumptions).
