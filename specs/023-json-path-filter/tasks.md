---

description: "Danh sách task cho feature 023: lọc item theo path trong field json"
---

# Tasks: Lọc item theo path trong field json

**Input**: Tài liệu thiết kế trong `/specs/023-json-path-filter/`
**Prerequisites**: `plan.md`, `spec.md` (D-184, D-184.1, D-184.2, D-185, D-186, D-187 duyệt 2026-10-27). Dùng thêm
`research.md` (R1–R16), `data-model.md`, `contracts/` (`api.md`, `graphql.md`, `web.md`, `tests.md`), `quickstart.md`,
`checklists/api-compat.md`.

**Điều kiện bắt đầu**: spec, plan, tasks 023 đã commit lên `main` (commit `docs(023): spec, plan, tasks`). Làm trên
`main`, không branch; script `.specify` cần `SPECIFY_FEATURE=023-json-path-filter`. Checkout dùng chung với các phiên
khác: `git add` theo đường dẫn, không `git add -A`/`.`, không `stash`, `reset`, `checkout --`; không stage
`apps/api/project.json`, `apps/web/project.json`; push khi `main` không có run CI đang chạy (push hủy run cũ), rồi gửi
số run cho phiên "Speckit migration chức năng và directus_collections fields" (021, theo dõi job ngoài web/benchmark).
Không sửa file dưới `directus/`. Máy local: chạy test từng file, `--maxWorkers=1`; không dừng container của phiên khác.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Endpoint đổi: `/items` (`GET`, `SEARCH`, `?export=`), `/utils/export`, `/permissions` (ghi), `/graphql`. Đối chiếu:
  `parity/items/json-path.test.ts` (D-184, D-184.2, D-185, request đối chứng `assertParity`), GraphQL normalizer
  (D-186), blackbox `json-fields` không đổi, E2E ba cấu hình (D-184.1, D-187).
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).

**Organization**: Task nhóm theo user story, xếp theo ba lượt commit (research R14): **Lượt 1** = Phase 1, 2, 3 (US1),
4 (US5); **Lượt 2** = Phase 5 (US2), 6 (US3); **Lượt 3** = Phase 7 (US4), 8 (Polish). US5 (P1) đi cùng lượt 1 vì quyền
và vendor gate là một phần của API REST. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E
liên quan xanh, commit, push khi `main` rảnh, gửi số run cho phiên 021, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `fn/` = `apps/api/src/database/helpers/fn/`; `aq/` =
  `apps/api/src/database/run-ast/lib/apply-query/`; `gql/` = `apps/api/src/services/graphql/`; `web/` = `apps/web/src/`;
  `sf/` = `apps/web/src/interfaces/_system/system-filter/`; `e2e/` = `apps/web-e2e/src/`; `parity/` = `tests/parity/src/`;
  `bench/` = `tests/benchmark/src/`.
- Comment code ghi Directus là "DR" (constitution IX). File port sửa giữ header nguồn và ghi `// Backoffice (spec 023,
  D-18x): ...` tại chỗ sửa; file mới ghi `// Backoffice (spec 023, D-18x)`.
- Không biến env mới (VIII). Không DDL, không migration (II).
- Thông điệp lỗi lấy đúng câu chữ ở `contracts/api.md` (`Filtering by a JSON path is not supported on <client>`,
  `Invalid json() syntax: unknown type "<t>"`, `Permission filters cannot use a JSON path`) và `contracts/graphql.md`
  (`"<f>_json" needs exactly one of text, number, boolean`); test so theo chúng.
- Lệnh test: `pnpm nx run api:test -- <file>`, `pnpm nx run web:test -- <file>`, `pnpm nx run parity-tests:env-up
  --vendor=postgres` rồi `pnpm nx run parity-tests:test -- src/items/json-path.test.ts`, `TEST_DB=sqlite3` cho SQLite,
  `E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- <spec>` (tên target kiểm lại trong `project.json` của từng project
  khi làm).

## Phase 1: Setup (chốt [Unverified] của research R15)

**Purpose**: chốt các điểm chưa kiểm trước khi viết code; kết quả có thể đổi chi tiết SQL của R4.

- [X] T001 Kiểm SQL và ghi "Kết quả T001" vào `specs/023-json-path-filter/research.md`: (a) `knex.raw('??.?? #>
      ARRAY[?, ?]::text[]', [t, c, 'items', '0'])` với client `pg` (`toSQL().toNative()`) sinh `$1`, `$2` và chạy đúng
      trên env parity Postgres (qua `hostDb()` của `parity/auth/db-effects.ts`) với `'0'` là chỉ số mảng; (b)
      `whereExists(function () { this.select(knex.raw('1')).from(knex.raw('json_array_elements(...) as bo_json_elem(v)'))
      .where(...) })` sinh SQL đúng với client `pg` và `sqlite3`; (c) bằng package `sqlite3` của `apps/api`:
      `json_type(col, bo_json_elem.fullkey || '.sku')` với `fullkey` = `$.items[1]`, `json_valid(NULL)` trong `AND`, và
      `json_each(col, '$.items')` trên mảng chuỗi; (d) knex bind `true` trên `sqlite3` thành `1`. Sai chỗ nào thì sửa R4
      và `contracts/api.md` trước khi làm Phase 2.
- [X] T002 [P] Đo hành vi Directus 11.17.4 trên env parity (Postgres) cho D-184.2 và ghi "Kết quả T002" vào
      `specs/023-json-path-filter/research.md`: `GET /items/<c>?sort=json(metadata,color)` (JSON array `sort=["json(metadata,
      color)"]` và chuỗi), `fields=json(metadata, color, number)`, `filter={"json(metadata, color, text)":{...}}` (status,
      `errors[0].extensions.code`, message). Khác với [Inference] của spec (D-184.2) thì sửa dòng D-184.2 và Edge Cases.

## Phase 2: Foundational (parser, helper dialect, `applyOperator`)

**Purpose**: phần lõi dùng chung cho US1, US5 (REST), US4 (GraphQL đi qua cùng đường) và E2E của US2, US3.

**⚠️ CRITICAL**: chưa xong Phase 2 thì không bắt đầu user story nào.

### Tests (MANDATORY) ⚠️

- [X] T003 [P] Thêm vào `fn/json/parse-function.test.ts`: `json(a, b)` → `{ field: 'a', path: '.b', type: 'text' }`;
      `json(a, b.c, number)`, `json(a, b, boolean)`; `json(a, b, money)` → `InvalidQueryError` `Invalid json() syntax:
      unknown type "money"`; `json(a)`, `json(a, b, c, d)` → lỗi; `json(a, items[*].sku, text)` lỗi khi không
      `allowWildcard`, đúng khi có; `a[*].b[*]` → lỗi; depth `[*]` tính 1 so với `MAX_JSON_QUERY_DEPTH`; `splitWildcard`
      (`items[*].sku` → `{ before: '.items', after: '.sku' }`; `[*]` ở gốc → `{ before: '', after: '' }`, dùng cho mảng
      chuỗi như `directus_users.tags`; không `[*]` → `null`); `jsonFilterType`. Chạy đỏ.
- [X] T004 [P] Thêm vào `api/utils/parse-filter-key.test.ts`: `json(transaction_data, Amount, number)` → `{ fieldName:
      'transaction_data', functionName: 'json' }`; `json(a, b)` → `a`; `year(date)`, `count(links)`, `title` không đổi;
      option giữ hành vi DR (`fieldName` = toàn bộ trong ngoặc) cho `convert-wildcards`. Chạy đỏ.
- [X] T005 [P] Thêm vào `aq/filter/get-filter-type.test.ts`: key `json(meta, a, text|number|boolean)` trên field json →
      `{ type: 'string' | 'float' | 'boolean' }`; thiếu type → `string`; type lạ → `InvalidQueryError`; field không
      phải json → lỗi như hôm nay; key `meta` (field json, không hàm) → `{ type: 'json' }` (chỉ `null`/`nnull`). Chạy đỏ.
- [X] T006 [P] Tạo `fn/json/json-filter.test.ts` (`postgres.test.ts` mock `FnHelper` nên không dùng được; dùng
      `knex-mock-client` với `Client_PG`, `Client_SQLite3` và client giả mysql, cockroachdb, redshift): `json(table, col, { jsonPath, jsonType })` cho text/number/boolean
      đúng SQL và bindings của `contracts/api.md` "Biểu thức theo vendor" (Postgres `dbType` `json` và `jsonb`, SQLite
      có `json_valid`); không `jsonType` → SQL như hôm nay; `jsonArrayElements` và `jsonElement` (Postgres guard `CASE
      ... 'array'`, `'[]'::json`/`'[]'::jsonb`; SQLite `json_each` + `fullkey || ?`; `before`, `after` rỗng: chính cột
      và chính phần tử); `assertJsonFilterSupported`: client
      `postgres`, `sqlite` qua, `cockroachdb`, `redshift`, `mysql`, `mssql`, `oracle` ném `Filtering by a JSON path is
      not supported on <client>`; `parseJsonResult` chuẩn hóa boolean (`1`/`0` SQLite → `true`/`false`) và number
      (D-184.2). Chạy đỏ.
- [X] T007 [P] Thêm `Client_PG` (`class Client_PG extends MockClient {}`) vào `aq/mock.ts` và thêm vào
      `aq/filter/operator.test.ts`: key `alias.json(t, a.b, number)` giữ nguyên path sau dấu chấm đầu; giá trị `'5'` ép số
      với `number`; mỗi toán tử của `string`, `float`, `boolean` (`_eq`, `_neq`, `_in`, `_nin`, `_contains`, `_icontains`,
      `_starts_with`, `_ends_with`, `_gt`...`_between`, `_null`, `_nnull`, `_empty`, `_nempty`) áp trên biểu thức có
      kiểu (SQLite và Postgres json, jsonb); `[*]` → `exists (select 1 from ... bo_json_elem ...)` với toán tử bên trong,
      kể cả `_neq` và `_null`; cột thường với `_empty`, `_starts_with`, `_ends_with` cho **cùng SQL** như hiện nay (test
      cũ giữ xanh). Chạy đỏ.

### Implementation

- [X] T008 Sửa `fn/json/parse-function.ts` theo R2 và `contracts/api.md` "Parse key": trả `{ field, path, type }`, option
      `allowWildcard`, `splitWildcard`, `jsonFilterType`, type `JsonFilterType`; cập nhật mọi caller đọc `{ field, path }`
      (`api/database/run-ast/lib/parse-current-level.ts`, `api/permissions/utils/get-unaliased-field-key.ts`,
      `api/database/run-ast/utils/get-column.ts`) không bật `allowWildcard`. T003 xanh; `parse-function.test.ts` cũ xanh.
- [X] T009 Sửa `api/utils/parse-filter-key.ts` (R1: `json` → tham số đầu) và
      `api/database/get-ast-from-query/lib/convert-wildcards.ts` (giữ hành vi DR với alias `json(...)`, checklist
      CHK009). T004 xanh; `convert-wildcards.test.ts`, `extract-fields-from-query.test.ts` hiện có xanh.
- [X] T010 Sửa `aq/filter/get-filter-type.ts`: nhánh `functionName === 'json'` → `parseJsonFunction(key, {
      allowWildcard: true })` → `jsonFilterType(type)`. T005 xanh.
- [X] T011 Sửa `fn/types.ts` (`JsonFilterType`, `FnHelperOptions.jsonType`, `jsonArrayElements`, `jsonElement` mặc định
      ném, `assertJsonFilterSupported` qua `getDatabaseClient(this.knex)` của `api/database/index.ts`, `parseJsonResult`
      chuẩn hóa), `fn/dialects/postgres.ts` (biểu thức `#>`/`#>>` + `json_typeof`/`jsonb_typeof` theo `dbType` khi có
      `jsonType`; `json()` không `jsonType` giữ nguyên `->`), `fn/dialects/sqlite.ts`, và `fn/dialects/{mysql,mssql,
      oracle}.ts` (gọi assert ở đầu `json()` khi có `jsonType`). T006 xanh; test dialect hiện có xanh.
- [X] T012 Sửa `api/database/run-ast/utils/get-column.ts` (truyền `jsonType` và `allowWildcard` từ option filter vào
      `parseJsonFunction`/`fn.json`) và `aq/filter/operator.ts` theo R3 và `contracts/api.md` "applyOperator": tách key ở
      dấu chấm đầu (L34, L96); ép số cho json `number`; tách thân toán tử thành `applyWhere(builder, selectionRaw,
      operator, compareValue, logical)`; key có `[*]` → `dbQuery[logical === 'and' ? 'whereExists' : 'orWhereExists']`
      với `fn.jsonArrayElements` và `applyWhere` trên `fn.jsonElement`; `_empty`, `_nempty`, `_starts_with`,
      `_nstarts_with`, `_ends_with`, `_nends_with` dùng `selectionRaw`. T007 xanh; `aq/filter/index.test.ts`,
      `aq/sort.test.ts`, `aq/search.test.ts` hiện có xanh.

**Checkpoint**: parser, helper và `applyOperator` sẵn sàng; mọi test API hiện có xanh.

## Phase 3: User Story 1 - Lọc item theo giá trị trong field json qua API (Priority: P1) 🎯 MVP

**Goal**: `GET`/`SEARCH /items`, `?export=`, `/utils/export`, `meta.filter_count` lọc đúng theo `json(field, path, type)`
trên Postgres (json, jsonb) và SQLite, qua m2o, với `[*]`; request không json path giống Directus.

**Independent Test**: `parity/items/json-path.test.ts` trên Postgres và `TEST_DB=sqlite3`: tập item của Backoffice đúng
tập mong đợi, Directus 403 `FORBIDDEN` (D-184 chấp nhận, T002), request đối chứng `assertParity`.

### Tests for User Story 1 (MANDATORY) ⚠️

- [X] T013 [P] [US1] Thêm vào `aq/filter/index.test.ts` (mẫu `count(links)` L522-556 và m2o L149-199): key gốc
      `json(meta, Amount, number)`, m2o `{ order: { 'json(meta, Amount, number)': { _gt: 100 } } }` (join + alias đúng),
      `_and`/`_or` lồng, `[*]` qua m2o. Chạy đỏ nếu thiếu gì ở T012.
- [X] T014 [P] [US1] Tạo `parity/items/json-path.test.ts` (mẫu fixture `parity/permissions/fixtures.ts`
      `createUserCollection`, `createField`, `cleanup`): collection `parity_json_path_<run>` (field `transaction_data` json
      `cast-json`, m2o `order` tới `parity_json_path_orders_<run>` có field json `details`) với dữ liệu: `Amount` 6000,
      7000, `"6000"`, `"abc"`, thiếu, JSON null, field null; `dimensions.width`; `items` = `[{"sku":"A"},{"sku":2},"z"]`,
      `[]`, `"notarray"`; khóa `"a.b"`; `flag` true/false; field json thứ hai `labels` là mảng chuỗi gốc. Case: từng kiểu
      và toán tử chính, path lồng, chỉ số mảng, `[*]` với `_eq`, `_neq`, `_null`, `_gt`, `[*]` ở gốc của `labels`; m2o;
      `_and`/`_or`; `SEARCH`; `?export=csv`; `POST /utils/export/<c>`;
      `meta=filter_count`; mỗi case kiểm Backoffice 200 đúng tập id mong đợi và `result.accepted` có `D-184`; request đối
      chứng cùng collection (không json path): `assertParity`. D-184.2: `sort=json(...)` (có/không `type`), `fields=json(
      ..., number|boolean)` gửi riêng từng app theo `contracts/api.md` "Sort, fields" (Directus theo "Kết quả T002").
      Thêm file vào `REDUCED_FILES` và `FULL_FILES` của `parity/suite.ts`. Chạy đỏ (Directus/Backoffice chưa có mục
      chấp nhận).
- [X] T015 [P] [US1] Thêm vào `tests/parity/accepted-differences.ts` (sau D-181): `D-184` `kind: 'http'`, `feature:
      '023'`, `endpoints: ['GET /items/parity_json_path_*', 'SEARCH /items/parity_json_path_*', 'POST
      /utils/export/parity_json_path_*']`, `location: { any: true }`, `when: { directusStatus: 403, directusCode:
      'FORBIDDEN' }`, reason theo spec; `D-184.1`, `D-184.2` `kind: 'doc'`. `parity/accepted-differences.test.ts` xanh.

### Implementation for User Story 1

- [X] T016 [US1] Chạy `json-path.test.ts` trên env parity Postgres (cột `json`), sửa code Phase 2 tới khi xanh; thêm bước
      Postgres-only trong test: `hostDb().raw('ALTER TABLE ?? ALTER COLUMN ?? TYPE jsonb USING ??::jsonb', ...)` rồi `POST
      /utils/cache/clear?system` ở Directus (tiền lệ `parity/schema/sync.test.ts:114-116`), chạy lại cùng case (FR-008).
- [X] T017 [US1] Chạy `json-path.test.ts` với `TEST_DB=sqlite3` (bộ `reduced`), sửa tới khi xanh; chạy lại
      `parity/items/crud.test.ts`, `export.test.ts` và blackbox `json-fields` (`parity-blackbox`, hai lượt app) trên
      Postgres: không đổi (SC-003). Ghi "Kết quả lượt 1" (US1) vào `specs/023-json-path-filter/research.md`.

**Checkpoint**: US1 chạy được độc lập qua REST và SDK.

## Phase 4: User Story 5 - Quyền, vendor không hỗ trợ và chỗ không cho dùng (Priority: P1)

**Goal**: quyền đọc kiểm trên field gốc, row filter vẫn áp dụng; vendor ngoài Postgres/SQLite 400 có thông điệp;
permission có path json bị 400 khi lưu (D-185); path ký tự lạ chỉ là dữ liệu.

**Independent Test**: unit `extract-fields-from-query`, `permissions.service`; parity `json-path.test.ts` phần quyền và
D-185 trên Postgres và SQLite.

### Tests for User Story 5 (MANDATORY) ⚠️

- [X] T018 [P] [US5] Thêm vào `api/permissions/modules/process-ast/lib/extract-fields-from-query.test.ts`: filter
      `json(transaction_data, Amount, number)` và m2o `order.json(details, x, text)`, sort `json(meta, a)` → field map có
      `transaction_data`, `order` + `details` của collection đích, `meta`. Chạy đỏ nếu T009 chưa đủ.
- [X] T019 [P] [US5] Thêm vào `api/services/permissions.service.test.ts` (describe L76): `createOne`, `updateMany`,
      `updateOne` (qua `updateMany`), `createMany` với `permissions` hoặc `validation` có key `json(` ở gốc, trong
      `_and`/`_or`/`_some`/`_none`, dạng object và chuỗi JSON → `InvalidPayloadError` `Permission filters cannot use a
      JSON path`, không gọi `super`; không có `json(` → gọi `super` như cũ. Chạy đỏ.
- [X] T020 [US5] Thêm vào `parity/items/json-path.test.ts` (sau T014, cùng file): user có quyền đọc collection nhưng không có
      `transaction_data` → cả hai app 403 (cùng code); user có row filter `status = published` → Backoffice chỉ trả item
      vừa khớp path vừa thuộc quyền; path có `'`, `;`, `--`, `"` → 200 không khớp hoặc 400 cú pháp, không 500; D-185:
      `POST /permissions` với `permissions: { "json(transaction_data, Amount, number)": { "_eq": 1 } }` gửi riêng từng app:
      Directus 200 (xóa ngay sau), Backoffice 400 `INVALID_PAYLOAD`, `PATCH` tương tự; vendor ngoài
      `postgres`/`sqlite3` (`getDbsToTest()[0]`): Directus 403 `FORBIDDEN`, Backoffice 400 `INVALID_QUERY` nêu vendor (MySQL ở bộ
      `reduced` của CI mỗi PR, SC-002; vendor khác ở nightly). Chạy đỏ.

### Implementation for User Story 5

- [X] T021 [US5] Thêm `assertNoJsonPathFilter(data)` vào `api/services/permissions.service.ts` (mẫu
      `PoliciesService.assertValidIpAccess`, `api/services/policies.service.ts:41-47`; `parseJSON` chuỗi; đi
      `flattenFilter` của `api/permissions/modules/process-ast/utils/flatten-filter.ts`; `InvalidPayloadError`) và gọi
      trước `super` ở `createOne` và `updateMany`. T019 xanh.
- [X] T022 [US5] Thêm `D-185` `kind: 'http'` vào `tests/parity/accepted-differences.ts` (`endpoints: ['POST
      /permissions', 'PATCH /permissions/*', 'PATCH /permissions']`, `when: { backofficeCode: 'INVALID_PAYLOAD' }`,
      `location: { any: true }`); chạy T018, T020 và `json-path.test.ts` đủ trên Postgres và SQLite, xanh.
- [ ] T023 Đóng lượt 1: `pnpm nx run-many -t lint,typecheck -p api parity-tests`; `api:test` các file đã sửa và cả
      `aq/`, `fn/`, `permissions/` (coverage BE ≥ 80 %); parity Postgres (`json-path`, `crud`, `export`, blackbox
      `json-fields`), SQLite và MySQL (`json-path`, `crud`; MySQL kiểm vendor gate, SC-002) local xanh; `git add` theo đường dẫn (Phase 1–4 và `research.md`);
      commit `feat(023): filter items by a path inside a json field (D-184, D-184.2, D-185)`; push khi `main` rảnh; gửi
      số run cho phiên 021; CI xanh (`parity` Postgres 2 shard, sqlite3, mysql reduced; `guard-differences`);
      `graphify update .`.

## Phase 5: User Story 2 - Người dùng lọc theo path json trên trang Content (Priority: P1)

**Goal**: bộ lọc của `/content/<collection>` có mục "JSON path" dưới field json, form path + kiểu, hàng
`Field › path (Type)` với toán tử theo kiểu, sửa được, lưu bookmark; mọi chỗ khác không có mục (D-187).

**Independent Test**: unit web + `e2e/content-filter-json-path.spec.ts` ở `proxy-api` và `cors` (lọc đúng, bookmark mở
lại), `proxy-directus` (lỗi D-184.1, bảng giữ nguyên).

### Tests for User Story 2 (MANDATORY) ⚠️

- [X] T024 [P] [US2] Tạo `web/utils/json-path.test.ts`: `parseJsonPathKey` (2–3 tham số, placeholder `json(meta)` →
      `null`, key không phải json → `null`, m2o `author.json(meta, a, text)`), `formatJsonPathKey`, `jsonPathError`
      (rỗng, `items[`, `a[*].b[*]`, `?`, `@`, `$`, depth > 10 → lỗi; `Amount`, `a.b`, `items[0].sku`, `items[*].sku` → `null`),
      `jsonFilterType`; chép case của `fn/json/parse-function.test.ts`. Chạy đỏ.
- [X] T025 [P] [US2] Thêm vào `sf/utils.test.ts`: `splitFieldPath('author.json(meta, items[0].sku, text)')` → `['author',
      'json(meta, items[0].sku, text)']`; `getField`, `getComparator`, `fieldToFilter` với key json có `.` và `[`; key cũ
      (`title`, `author.name`, `year(date)`, `a.count(b)`) cho kết quả như trước. Chạy đỏ.
- [X] T026 [P] [US2] Thêm vào `web/components/FieldList.test.ts` (cạnh "functions per field type", L127-140, `bo_std`
      `Tags`): không `includeJsonPath` → không có hàng `json`, có `Count (Tags)`; có prop → hàng "JSON path (Tags)", emit
      `add` `['json(tags)']`; qua m2o emit `json(<m2o>.<field>)`. Chạy đỏ.
- [X] T027 [P] [US2] Thêm vào `sf/SystemFilter.test.ts` (helper `setup`, `openAddFilter`, `addField`, `operator`,
      `typeIn`): có `includeJsonPath`: chọn "JSON path" → form; path `items[` → lỗi `Invalid JSON path`, không emit; path
      `Amount` + Number + Apply → emit `{ "json(tags, Amount, number)": { "_eq": null } }` (toán tử đầu của `float`); hàng
      hiện `Tags › Amount (Number)` và chỉ toán tử số; Boolean → input toggle; sửa path/kiểu qua chip → key mới, đổi
      kiểu thì toán tử về đầu danh sách và xóa giá trị; hàng json trong nhóm `_and`/`_or` vẫn có prop; key m2o. Không
      prop: hàng json đã có vẫn hiện, chip chỉ đọc, không có mục thêm. Chạy đỏ.
- [X] T028 [P] [US2] Thêm vào `web/components/SearchInput.test.ts` (describe "Backoffice", L154-200): prop
      `includeJsonPath` truyền xuống `SystemFilter`; mặc định `false`. Chạy đỏ.
- [X] T029 [P] [US2] Thêm vào `sf/SystemFilter.browser.test.ts` (keyboard, L43) luồng bàn phím: Tab/Enter tới
      `treeitem` "JSON path (...)", gõ path, Tab tới kiểu, chọn Number, Enter Apply; và vào
      `web/modules/content/a11y.browser.test.ts` (helper `bothSchemes`, cạnh case D-179 L288): popover bộ lọc với form
      JSON path, trạng thái lỗi, sáng và tối, 0 vi phạm serious/critical. Chạy đỏ.

### Implementation for User Story 2

- [X] T030 [P] [US2] Tạo `web/utils/json-path.ts` theo `contracts/web.md` (ngữ pháp R2, chép từ
      `fn/json/parse-function.ts`, ghi nguồn ở comment đầu). T024 xanh.
- [X] T031 [US2] Sửa `sf/utils.ts` (`splitFieldPath`, path mảng trong `getComparator`, `fieldToFilter`) và mọi `get`/
      `set` chuỗi path trong `sf/SystemFilter.vue` (L143 → `fieldToFilter`), `sf/Nodes.vue` (L134, L200-201, L257-258,
      L312), `sf/InputGroup.vue` (L92). T025 xanh; `SystemFilter.test.ts`, `utils.test.ts` hiện có xanh.
- [X] T032 [US2] Sửa `web/components/FieldList.vue`: prop `includeJsonPath` (mặc định `false`), `supportedFunctions`
      (L175-178) lọc `json` khi không có prop, nhãn L397 `row.fn === 'json' ? $t('json_path') : ...`. T026 xanh.
- [X] T033 [P] [US2] Tạo `sf/JsonPathForm.vue` theo `contracts/web.md` (`BoInput` path có `label`, `error`, `autofocus`;
      `BoSelect` kiểu; nút Apply; link quay lại; Enter = Apply; chỉ token theme) và test component riêng
      `sf/JsonPathForm.test.ts` (emit `apply` chỉ khi hợp lệ, `back`, nhãn liên kết).
- [X] T034 [US2] Sửa `sf/SystemFilter.vue` (prop `includeJsonPath`; truyền cho FieldList L236 và Nodes L199; placeholder
      `json(<key>)` → hiện `JsonPathForm` trong `PopoverContent` L235-268; Apply → `addNode(formatJsonPathKey(...))` với
      kiểu qua `jsonFilterType`), `sf/Nodes.vue` (prop, truyền FieldList L444 và node đệ quy L556; `getFieldPreview`
      nhánh json `Field › path (Type)`; `getCompareOptions` L279-305 và `updateField` L250-270 theo kiểu json;
      `isExistingField` qua `splitFieldPath`; chip hàng json mở `JsonPathForm` điền sẵn khi có prop, Apply →
      `replaceNode` L272), `sf/InputGroup.vue` (`fieldInfo` giả `{ type }` cho key json). T027, T029 (phần
      SystemFilter) xanh.
- [X] T035 [US2] Sửa `web/components/SearchInput.vue` (prop `includeJsonPath` → `SystemFilter` L225) và
      `web/modules/content/routes/CollectionRoute.vue` (L417 `:include-json-path="true"`). T028 xanh.
- [X] T036 [P] [US2] Thêm khóa vào `web/lang/overlay/en-US.ts` và `web/lang/overlay/vi-VN.ts` theo `contracts/web.md`
      "i18n" (comment `// Spec 023 (D-187)`; trước khi thêm, grep base `web/lang/translations/en-US.json` và bỏ khóa đã
      có); `web/lang/overlay.test.ts` xanh.
- [X] T037 [US2] Tạo `e2e/content-filter-json-path.spec.ts` (helper `helpers/requests.ts` `test`, `helpers/api.ts`
      `AdminApi`, `helpers/content.ts`, `helpers/login.ts`; mẫu tạo/xóa collection `content-navigation.spec.ts:64-72`):
      `beforeAll` tạo `bo_json_<run>` (field `payload` json + 4 item theo spec) và xóa cache ở mọi API; luồng chuột:
      Filter → Add Filter → mở `Payload` → `treeitem` "JSON path (Payload)" → `items[` → lỗi tại chỗ và không request
      `/items` mới → `Amount` + Number + Apply → Equals 6000 → bảng chỉ còn item đúng; lưu bookmark (chờ `PATCH
      /presets/:id`), reload, mở bookmark → cùng bảng; sửa chip sang `Currency` Text; luồng bàn phím riêng; nhánh
      `e2eConfig === 'proxy-directus'`: sau Apply có notice lỗi API và bảng giữ nguyên (D-184.1). Thêm path tạo
      collection/field vào `e2e/allowed-paths.ts` nếu thiếu.
- [X] T038 [US2] Thêm vào `e2e/content-filter-json-path.spec.ts` case FR-015: mở bộ lọc ở `/files`, `/users`, Settings >
      Policies (filter của permission) → mở field json (`tags`) → có `Count`, không có "JSON path"; và vào
      `tests/parity/accepted-differences.ts` `D-187` `kind: 'doc'`.
- [X] T039 [P] [US2] Thêm gạch đầu dòng "JSON path form" vào mục Q-7 của `design-system/docs/component-specs.md`
      (L1265-1312) theo `contracts/web.md` "design-system".

**Checkpoint**: US2 chạy độc lập trên trang Content (cần lượt 1 cho `proxy-api`, `cors`).

## Phase 6: User Story 3 - Lọc theo path json trong drawer chọn item (Priority: P2)

**Goal**: DrawerCollection (mọi interface quan hệ, DrawerFiles) có mục "JSON path" như trang Content.

**Independent Test**: unit `DrawerCollection.test.ts`; E2E drawer của `author` (`directus_users.tags`) lọc `[*]`.

### Tests for User Story 3 (MANDATORY) ⚠️

- [X] T040 [P] [US3] Thêm vào `web/components/drawers/DrawerCollection.test.ts` (L80-230): `SearchInput` nhận
      `includeJsonPath` `true`; filter json path của drawer được gửi trong request `/items` (SDK, JSON). Chạy đỏ.

### Implementation for User Story 3

- [X] T041 [US3] Sửa `web/components/drawers/DrawerCollection.vue` (L203 `:include-json-path="true"`). T040 xanh.
- [X] T042 [US3] Thêm vào `e2e/content-filter-json-path.spec.ts` case drawer: gán `tags: ["e2e-<run>"]` cho một user qua
      `AdminApi` (`directus_users.tags` là mảng chuỗi json); mở một item `bo_content` → field `author` → drawer
      `directus_users` → Filter → `Tags` → "JSON path" → path `[*]` (phần tử bất kỳ của mảng gốc) + Text → Equals
      `e2e-<run>` → chỉ user đó hiện; chọn user như bình thường; xóa tag sau test.
- [ ] T043 Đóng lượt 2: `pnpm nx run-many -t lint,typecheck -p web web-e2e parity-tests`; `web:test` các file đã sửa và
      cả `sf/`, `components/` (coverage FE ≥ 60 %), browser project (`SystemFilter.browser`, `a11y.browser`); `web:build`;
      E2E `content-filter-json-path`, `content-filter-bookmark` local `proxy-api`; `git add` theo đường dẫn; commit
      `feat(023): JSON path filter in the Content filter and the item drawer (D-187)`; push khi `main` rảnh; gửi số run
      cho phiên 021; CI xanh (`e2e-web` ba cấu hình, `web`); `graphify update .`.

## Phase 7: User Story 4 - Lọc theo path json qua GraphQL (Priority: P2)

**Goal**: `<field>_json: json_path_filter_operators` trong `<collection>_filter` (scope items), đổi về key REST trước
`sanitizeQuery`; parity introspection/SDL xanh sau normalizer D-186.

**Independent Test**: unit `replace-funcs`, `schema/index`; parity `graphql/read.test.ts` (GraphQL = REST ở Backoffice),
`graphql/schema.test.ts`, `system.test.ts` xanh nguyên văn sau normalize.

### Tests for User Story 4 (MANDATORY) ⚠️

- [ ] T044 [P] [US4] Tạo `gql/utils/replace-funcs.test.ts` theo `contracts/tests.md`: top level, m2o lồng, `_and`/`_or`,
      `_some`, object prototype null (`Object.create(null)`), 0 hoặc 2 trong `text`/`number`/`boolean` →
      `InvalidQueryError` `"<f>_json" needs exactly one of text, number, boolean`, `{ x_json: { _eq: 1 } }` và `{ foo_json:
      { path: { _eq: 'x' } } }` giữ nguyên. Chạy đỏ.
- [ ] T045 [P] [US4] Thêm vào `gql/utils/aggregate-query.test.ts` (không mock `sanitizeQuery`): `{ filter: { details_json:
      { path: 'a', number: { _eq: 1 } } } }` → `query.filter` có `'json(details, a, number)': { _eq: 1 }` (đổi trước
      sanitize); sửa mock `../utils/replace-funcs.js` của `gql/schema/parse-query.test.ts` L50-52 thêm
      `replaceJsonPaths: vi.fn((v) => v)` và thêm case gọi trước `sanitizeQuery` (L25, L160). Chạy đỏ.
- [ ] T046 [P] [US4] Thêm vào `gql/schema/index.test.ts`: `c.field('details').json()` cho `articles` (L29-33); scope
      items có `articles_filter.details_json` kiểu `json_path_filter_operators` (field `path: String!`, `text`, `number`,
      `boolean`); SDL scope system không có `json_path_filter_operators`. Chạy đỏ.
- [ ] T047 [P] [US4] Thêm vào `parity/normalizers.test.ts` (cạnh case D-181 L112-156) và `parity/parity.test.ts` (L149,
      L185): introspection bỏ type `json_path_filter_operators` và `inputFields` có `type.name` đó; SDL bỏ khối `input
      json_path_filter_operators {...}` và dòng `  <f>_json: json_path_filter_operators`; `server_specs_graphql`; bỏ so
      ETag khi body có `json_path_filter_operators`; sắp xếp type introspection. Chạy đỏ.

### Implementation for User Story 4

- [ ] T048 [US4] Thêm `replaceJsonPaths` vào `gql/utils/replace-funcs.ts` theo R7 (lodash `isPlainObject`, `transform`).
      T044 xanh.
- [ ] T049 [US4] Gọi `replaceJsonPaths` trước `sanitizeQuery` ở `gql/schema/parse-query.ts` (L25 cho `filter` của query
      và mutation, L160 cho args field quan hệ) và `gql/utils/aggregate-query.ts` (L19). T045 xanh.
- [ ] T050 [US4] Sửa `gql/schema/read.ts`: tạo `json_path_filter_operators` sau L433, thêm `<f>_json` trong reduce sau
      L506 khi `field.type === 'json'`, `gql.scope === 'items'` và collection không có field tên `<f>_json`. T046 xanh;
      `gql/schema/*.test.ts` hiện có xanh.
- [ ] T051 [US4] Sửa `parity/normalizers.ts` (`withoutBackofficeIntrospection` lọc `inputFields`, `withoutBackofficeSdl`,
      `withoutBackofficeSpecs`) và `parity/parity.ts` (L195-200 ETag, L225-230 sort) cho D-186; thêm `D-186` `kind:
      'doc'` (reason trỏ normalizer) vào `tests/parity/accepted-differences.ts`. T047 xanh.
- [ ] T052 [US4] Thêm vào `parity/graphql/read.test.ts` case chỉ Backoffice (mẫu blackbox L128-137): `articles(filter: {
      details_json: { path: "order", number: { _gt: 2 } } })` và m2o `category { ... }`, `_and`/`_or`, aggregate → cùng
      tập id với REST `json(...)` ở Backoffice; mutation `update_articles_items(filter: ...)` trên item test. Chạy
      `parity/graphql/schema.test.ts`, `system.test.ts`, `read.test.ts` trên Postgres: xanh (SC-004).

**Checkpoint**: US4 chạy độc lập qua GraphQL; parity GraphQL nguyên văn sau normalize.

## Phase 8: Polish & Cross-Cutting (lượt 3)

**Purpose**: benchmark, vendor khác, tài liệu, đóng feature.

- [ ] T053 [P] Sửa `bench/seed-items.ts` (field `payload` json `cast-json` ở L55-63; `json_build_object('Amount', g %
      10000, 'Currency', 'VND')` trong INSERT L77-83; policy user đọc thêm `payload` L110) và `bench/items.ts` (khối sau
      các scenario so sánh: `measure(seeded, s, 'backoffice', ...)` cho `GET /items/bench_articles?filter={"json(payload,
      Amount, number)":{"_eq":6000}}&limit=25&fields=id,title`, admin, `ROUNDS` vòng; lần 1 không index, lần 2 sau
      `CREATE INDEX` đúng biểu thức của `quickstart.md` "Index" + `ANALYZE`; log `EXPLAIN`; gate chỉ `errors`; bảng riêng
      vào `GITHUB_STEP_SUMMARY`); `bench/web-content.ts` một dòng reported-only cho 8172 (preset filter json path).
- [ ] T054 Chạy `gh workflow run benchmark.yml -f job=benchmark-items` và `-f job=benchmark-web`; ghi số đo (p95, req/s,
      có/không index, `EXPLAIN` có index scan không) vào `specs/023-json-path-filter/research.md` "Kết quả lượt 3" và
      `quickstart.md` "Index"; scenario hiện có ≤ 10 % so với Directus (SC-006). Index không được dùng thì sửa biểu thức
      R4 hoặc hướng dẫn index, ghi lại.
- [ ] T055 [P] Chạy `gh workflow run nightly.yml` (hoặc `parity-matrix.yml` theo chú thích workflow) cho mysql, maria,
      mssql, oracle, cockroachdb, postgres10: `json-path.test.ts` (vendor gate 400 có thông điệp; postgres10 lọc đúng);
      ghi kết quả vào `research.md` "Kết quả lượt 3". Bổ sung cho SC-002 (bắt buộc là T006 và MySQL `reduced`); chủ dự án
      quyết định có chạy nightly không (đang chạy tay).
- [ ] T056 [P] Thêm gạch đầu dòng 023 vào `tests/parity/README.md` mục "Test items (feature 005)" (L115-133:
      `json-path.test.ts`, D-184..D-187, bước jsonb, vendor) và ghi chú vào `deploy/README.md` cạnh L160 (shared-domain:
      request có json path rơi vào Directus nhận 403, D-184; separate-domain, standalone không ảnh hưởng).
- [ ] T057 Ghi `specs/023-json-path-filter/research.md` "Kết quả lượt 1/2/3" (T001, T002, T017, T054, T055);
      `spec.md` Status → Implemented (ngày, ba lượt, CI run); `checklists/requirements.md` note; `SPECKIT-GUIDE.md` mục
      023 trạng thái; `CLAUDE.md` Recent Changes thêm dòng 023.
- [ ] T058 Đóng lượt 3: `pnpm nx run-many -t lint,typecheck -p api web parity-tests benchmark`; `api:test` `gql/`;
      parity GraphQL Postgres local xanh; `git add` theo đường dẫn; commit `feat(023): GraphQL json path filter, parity
      normalizer, benchmark and docs (D-186)`; push khi `main` rảnh; gửi số run cho phiên 021; CI xanh; `graphify update
      .`; báo chủ dự án kết quả SC-001..SC-006.

## Dependencies & Execution Order

### Phase

- Phase 1 (T001, T002) → Phase 2 (T003–T012) → Phase 3 (US1, T013–T017) → Phase 4 (US5, T018–T022) → T023 đóng lượt 1.
- Lượt 2: Phase 5 (US2, T024–T039) → Phase 6 (US3, T040–T042) → T043 đóng lượt 2; cần lượt 1 trên `main` (API của env
  E2E `proxy-api`, `cors` lọc được).
- Lượt 3: Phase 7 (US4, T044–T052) → Phase 8 (T053–T057) → T058; Phase 7 chỉ cần lượt 1 (đường REST), làm song song với
  lượt 2 được nếu có người (khác file), nhưng commit theo thứ tự lượt.

### User story

- US1 cần Phase 2. US5 cần Phase 2 (T009 cho quyền field gốc, T011 cho vendor gate); T018–T020 làm song song với Phase 3
  (khác file, trừ `json-path.test.ts`: T020 thêm vào file của T014, làm sau T014).
- US2 cần lượt 1 cho E2E; unit web (T024–T036) không cần API. US3 cần US2 (prop và form trong `SearchInput`,
  `SystemFilter`).
- US4 cần Phase 2 và US1 (key REST đã chạy); T047, T051 (normalizer) độc lập với API.

### Trong một story

- Test trước (chạy đỏ), rồi code.
- `operator.ts` sửa một lần ở T012 (cả tách key, ép số, `applyWhere`, `[*]`, `selectionRaw`).
- `json-path.test.ts` (parity) được T014, T016, T020 sửa theo thứ tự; `content-filter-json-path.spec.ts` (E2E) được
  T037, T038, T042 sửa theo thứ tự; `accepted-differences.ts` được T015, T022, T038, T051 sửa theo thứ tự.
- `SystemFilter.vue`, `Nodes.vue` sửa hai lần (T031 path mảng, T034 tính năng): T031 trước.

## Parallel Example

```bash
# Phase 1–2:
T001 SQL checks | T002 Directus D-184.2 behaviour
T003 parse-function.test | T004 parse-filter-key.test | T005 get-filter-type.test | T006 fn dialect tests | T007 operator.test + Client_PG

# Phase 3–4 (sau Phase 2):
T013 filter/index.test | T014 parity json-path.test | T015 accepted-differences D-184 | T018 extract-fields test | T019 permissions.service test
# T020 sau T014 (cùng file json-path.test.ts)

# Lượt 2:
T024 json-path.test (web) | T025 sf/utils.test | T026 FieldList.test | T027 SystemFilter.test | T028 SearchInput.test | T029 browser + a11y | T040 DrawerCollection.test
T030 utils/json-path.ts | T033 JsonPathForm.vue | T036 overlay i18n | T039 component-specs.md

# Lượt 3:
T044 replace-funcs.test | T045 aggregate/parse-query tests | T046 schema/index.test | T047 normalizers/parity tests | T053 benchmark | T055 nightly | T056 READMEs
```

## Implementation Strategy

### MVP (lượt 1)

1. Phase 1 → chốt SQL (T001) và hành vi Directus cho D-184.2 (T002).
2. Phase 2 → parser, helper dialect, `applyOperator`; test API cũ xanh.
3. Phase 3 (US1) → `/items` lọc theo path trên Postgres json/jsonb và SQLite; parity xanh. **Dừng và kiểm**: request đối
   chứng giống Directus (`assertParity`), blackbox `json-fields` xanh, `GET /items?filter={"json(transaction_data,
   Amount, number)":{"_eq":6000}}` đúng tập item.
4. Phase 4 (US5) → quyền, vendor gate, D-185; đóng lượt 1. Chủ dự án dùng được ngay qua API ("nếu API có hỗ trợ là được
   rồi").

### Tăng dần

- Lượt 2: web (US2, US3), E2E ba cấu hình.
- Lượt 3: GraphQL (US4), parity introspection, benchmark, vendor khác, tài liệu, đóng feature.

## Notes

- 58 task; 29 task [P]. Setup 2, Foundational 10 (T003–T012), US1 5 (T013–T017), US5 5 (T018–T022), US2 16
  (T024–T039), US3 3 (T040–T042), US4 9 (T044–T052), Polish 5 (T053–T057), đóng lượt 3 (T023, T043, T058).
- `[*]` ở gốc (path `[*]`, mảng chuỗi như `directus_users.tags`) là trường hợp riêng của FR-002 (`before`, `after`
  rỗng), có test ở T003, T006, T014, T042.
- Câu chữ lỗi, nhãn i18n và SQL lấy đúng ở `contracts/`; parity và E2E so theo chúng.
