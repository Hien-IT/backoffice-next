---

description: "Danh sách task cho feature 028: lọc item bằng so sánh hai field của cùng collection"
---

# Tasks: Lọc item bằng so sánh hai field của cùng collection

**Input**: Tài liệu thiết kế trong `/specs/028-field-compare-filter/`
**Prerequisites**: `plan.md`, `spec.md` (D-203, D-203.1, D-204, D-205, D-206 duyệt 2026-11-01). Dùng thêm
`research.md` (R1–R12), `data-model.md`, `contracts/` (`api.md`, `graphql.md`, `web.md`, `tests.md`), `quickstart.md`,
`checklists/api-compat.md`.

**Điều kiện bắt đầu**: spec, plan, tasks 028 đã commit lên `main` (commit `docs(028): spec, plan, tasks`). Làm trên
`main`, không branch; script `.specify` cần `SPECIFY_FEATURE=028-field-compare-filter`. Checkout dùng chung với các
phiên khác: `git add` theo đường dẫn, không `git add -A`/`.`, không `stash`, `reset`, `checkout --`; không stage
`apps/api/project.json`, `apps/web/project.json`; push theo quy tắc checkout dùng chung (hỏi phiên đang giữ vai trò
push nếu có, `ListAgents`; chỉ push khi `main` không có run CI đang chạy, vì push hủy run cũ). Không sửa file dưới
`directus/`. Máy local: chạy test từng file, `--maxWorkers=1`; không dừng container của phiên khác.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Endpoint đổi: `/items` (`GET`, `SEARCH`, `?export=`), `/utils/export`, `/permissions` và `/backoffice/permissions`
  (ghi), `/graphql`. Đối chiếu: `parity/items/field-compare.test.ts` (D-203, D-204, request đối chứng `assertParity`),
  GraphQL normalizer (D-205), blackbox không đổi, E2E ba cấu hình (D-203.1, D-206).
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).

**Organization**: Task nhóm theo user story, xếp theo ba lượt commit (research R12): **Lượt 1** = Phase 1, 2, 3 (US1),
4 (US4); **Lượt 2** = Phase 5 (US2); **Lượt 3** = Phase 6 (US3), 7 (Polish). US4 (P1) đi cùng lượt 1 vì quyền và từ
chối permission là một phần của API REST. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E
liên quan xanh, commit, push khi `main` rảnh, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `aq/` = `apps/api/src/database/run-ast/lib/apply-query/`; `perm/` =
  `apps/api/src/permissions/modules/process-ast/`; `gql/` = `apps/api/src/services/graphql/`; `web/` = `apps/web/src/`;
  `sf/` = `apps/web/src/interfaces/_system/system-filter/`; `e2e/` = `apps/web-e2e/src/`; `parity/` =
  `tests/parity/src/`.
- Comment code ghi Directus là "DR" (constitution IX). File port sửa giữ header nguồn và ghi `// Backoffice (spec 028,
  D-20x): ...` tại chỗ sửa; file mới ghi `// Backoffice (spec 028, D-20x)`.
- Không biến env mới (VIII). Không DDL, không migration, không dependency (II).
- Thông điệp lỗi lấy đúng câu chữ ở `contracts/api.md` (`"$FIELD(title)" must be a number field like "total" (got
  string)`, `"$FIELD(nope)": unknown field "nope" in collection "c"`, `"$FIELD(tags)" must be a column field`,
  `"$FIELD(...)" is only allowed on a plain field`, `Permission filters cannot compare two fields ($FIELD(...))`); test
  so theo chúng.
- Lệnh test: `pnpm nx run api:test -- <file>`, `pnpm nx run web:test -- <file>`, `pnpm nx run parity-tests:env-up
  --vendor=postgres` rồi `TEST_DB=postgres pnpm nx run parity-tests:parity -- src/items/field-compare.test.ts`
  (`TEST_DB=sqlite3`, `TEST_DB=mysql` cho vendor khác; với bộ lọc file cờ `--vendor` không tới script, 027),
  `E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- <spec>` (tên target kiểm lại trong `project.json` khi làm).

## Phase 1: Setup (chốt [Inference] và [Unverified] của research)

**Purpose**: chốt hai điểm chưa kiểm trước khi viết code; kết quả có thể đổi chi tiết SQL của R1 và cột Directus của
D-203.

- [X] T001 Kiểm R1 bằng test tạm với `knex-mock-client` (`Client_PG`, `Client_SQLite3` của `aq/mock.ts`):
      `qb.where(knex.ref('t.a'), '<>', knex.ref('t.b')).toSQL()` in `"t"."a" <> "t"."b"` không binding; nếu knex bind
      `Ref` làm giá trị thì đổi R1 sang `whereRaw('?? <> ??', [refA, refB])`. Ghi "Kết quả T001" vào
      `specs/028-field-compare-filter/research.md` (R1) và sửa `contracts/api.md` nếu đổi.
- [X] T002 Đo Directus (Postgres; SQLite ở T009) 11.17.4 trên env parity Postgres (`pnpm nx run parity-tests:env-up --vendor=postgres`): tạo
      collection tạm qua `/collections` của Directus với field số, chuỗi, `timestamp`, `boolean`, `uuid`; gửi
      `GET /items` với `$FIELD(b)` cho sáu toán tử trên từng nhóm, `SEARCH`, `?export=csv`; lưu bookmark vào
      `directus_presets` rồi gửi cùng filter (như Directus app); lặp lại các request trên env SQLite (`--vendor=sqlite3`,
      analyze I3); ghi status, `code`, body theo vendor vào cột Directus của D-203,
      D-203.1 trong `specs/028-field-compare-filter/spec.md` (bỏ [Unverified]), bảng request của `contracts/api.md`,
      "Kết quả T002" ở `research.md` R7; chọn `when` cho D-203 `http` (T008) và kỳ vọng E2E `proxy-directus` (T022).

## Phase 2: Foundational (`field-compare.ts`, `applyOperator`)

**Purpose**: phần lõi dùng chung cho US1, US4 (REST), US3 (GraphQL đi qua cùng đường) và E2E của US2.

**⚠️ CRITICAL**: chưa xong Phase 2 thì không bắt đầu user story nào.

### Tests (MANDATORY) ⚠️

- [X] T003 [P] Tạo `aq/filter/field-compare.test.ts`: `parseFieldCompare` (`$FIELD(b)` → `b`; `$FIELD( b )` → `b`;
      `$FIELD(a.b)` → `a.b`, `$FIELD()` → `''`, `$FIELD(b);--` → `b);--`; `$FIELD`, `$FIELD(b`, `$field(b)`, số, null,
      object → `null`); `assertFieldCompare` với tên sai dạng (`''`, `a.b`, `a b`, `b);--`) ném 400 "a field of the same
      collection is expected" (analyze I1); `fieldCompareGroup` theo bảng
      data-model (integer/decimal → `number`, string/text → `string`, date/dateTime/timestamp riêng, json/hash/alias/
      geometry → `null`); `assertFieldCompare` với `SchemaOverview` giả (field không có, `alias: true`, khác nhóm, date
      với timestamp, integer với decimal qua, field b = field a qua) ném `InvalidQueryError` đúng câu chữ
      `contracts/api.md`; `hasFieldCompare` (lồng `_and`/`_or`/`_some`/object, `_in` với `$FIELD` → false). Chạy đỏ.
- [X] T004 [P] Thêm vào `aq/filter/operator.test.ts` (`Client_SQLite3` và `Client_PG`): sáu toán tử với `$FIELD(b)` trên
      field integer → `"t"."a" = "t"."b"`, `<>`, `>`, `>=`, `<`, `<=` không binding, không gọi `castToNumber`; qua alias
      quan hệ (`table` = alias, `originalCollectionName` = collection đích) → `"alias"."b"`; `_contains` với `$FIELD(b)`
      → LIKE với binding `%$FIELD(b)%`; `year(x)` với `$FIELD(b)` → `InvalidQueryError` "only allowed on a plain field";
      `json(...)` với `$FIELD` → cùng lỗi; test cột thường hiện có giữ xanh. Chạy đỏ.

### Implementation

- [X] T005 Tạo `aq/filter/field-compare.ts` theo `contracts/api.md` "field-compare.ts" và research R1, R2 (hằng
      `FIELD_COMPARE_OPERATORS`, `FIELD_COMPARE_SQL`, `parseFieldCompare`, `fieldCompareGroup`, `assertFieldCompare`,
      `hasFieldCompare`; header `// Backoffice (spec 028, D-203)`). T003 xanh.
- [X] T006 Sửa `aq/filter/operator.ts`: sau khi tách `column` và trước nhánh json, nhánh `$FIELD` (R1): kiểm field thường,
      `assertFieldCompare(schema, originalCollectionName || table, column, b)`, `dbQuery[logical].where(selectionRaw,
      FIELD_COMPARE_SQL[operator], getColumn(knex, table, b, false, schema, { originalCollectionName }))`, `return`;
      comment `// Backoffice (spec 028, D-203)`. T004 xanh; `aq/filter/index.test.ts`, `aq/sort.test.ts`,
      `aq/search.test.ts` hiện có xanh.

**Checkpoint**: `applyOperator` so hai field; mọi test API hiện có xanh.

## Phase 3: User Story 1 - Lọc item bằng so sánh hai field qua API (Priority: P1) 🎯 MVP

**Goal**: `GET`/`SEARCH /items`, export và `meta.filter_count` nhận `$FIELD(b)` cho sáu toán tử, năm nhóm kiểu, null
không khớp, lồng qua quan hệ, trên Postgres, MySQL, SQLite; request không có `$FIELD` giống Directus.

**Independent Test**: parity `items/field-compare.test.ts` trên env Postgres (full), SQLite và MySQL (reduced) xanh.

### Tests for User Story 1 (MANDATORY) ⚠️

- [X] T007 [P] [US1] Tạo `parity/items/field-compare.test.ts` theo `parity/items/json-path.test.ts` và research R8:
      collection `parity_field_compare_<run>` (fields `total`, `paid_amount` integer; `price` decimal; `published_at`,
      `updated_at` timestamp; `title`, `slug` string; `body` text; `active`, `featured` boolean; `owner`, `reviewer` uuid)
      và `parity_field_compare_orders_<run>` với m2o; hàng có null; case: sáu toán tử × nhóm số (kể cả `total` với
      `price`), timestamp, chuỗi (`title` với `body`), boolean (`_eq`, `_neq`), uuid (`_eq`, `_neq`); null không khớp;
      m2o lồng `{ order: { total: { _gt: "$FIELD(paid_amount)" } } }`; `SEARCH`; `?export=csv` và `/utils/export`;
      `meta.filter_count`; `?aggregate[count]=*` với filter `$FIELD` (analyze C2); `_and`/`_or`; `_contains` với `$FIELD`
      0 dòng ở cả hai app (`assertParity`); request không có `$FIELD` cùng collection và các giá trị `$NOW(-1 day)`,
      `$CURRENT_USER`, `$field(slug)`, `$FIELD(slug` (chuỗi thường) cùng kết quả hai app (`assertParity`, FR-009,
      analyze C2); `$FIELD()`, `$FIELD(author.age)`, `_null: '$FIELD(x)'` → 400 (I1, I2); khác nhóm, field không có, alias, hàm: Backoffice 400
      `INVALID_QUERY` đúng câu chữ, Directus theo T002; với mỗi request Backoffice kiểm tập id mong đợi; request
      Directus trả 200 khác body (chuỗi) so riêng từng app. Thêm file vào `parity/suite.ts` (`full` glob và `reduced`)
      và `parity/vendors.test.ts` (như spec 023/024/027). Chạy đỏ (phần Backoffice).
- [X] T008 [P] [US1] Thêm vào `tests/parity/accepted-differences.ts`: D-203 `http` (`feature: '028'`, endpoints `GET
      /items/parity_field_compare_*`, `SEARCH /items/parity_field_compare_*`, `when` theo T002), D-203.1 `doc`; `pnpm nx
      run parity-tests:guard-differences` (tên target kiểm trong `tests/parity/project.json`) đọc được D-203..D-206 từ
      bảng của spec.

### Implementation for User Story 1

- [X] T009 [US1] Chạy T007 trên Postgres (`TEST_DB=postgres`), SQLite (`TEST_DB=sqlite3`), MySQL (`TEST_DB=mysql`);
      sửa cho tới xanh; ghi kết quả vendor (collation MySQL với `title`/`body`) vào `research.md` R10 "Kết quả T009".

**Checkpoint**: US1 chạy độc lập qua REST trên ba vendor của CI.

## Phase 4: User Story 4 - Quyền, kiểu và những chỗ không cho dùng (Priority: P1)

**Goal**: field b kiểm quyền đọc như filter key (403), permission có `$FIELD` bị từ chối khi lưu (D-204) ở ba đường
ghi, kiểu và field sai 400 (đã có ở Phase 2, 3).

**Independent Test**: unit `flatten-filter`, `permissions.service`, `backoffice-permissions.service` xanh; parity case
quyền và D-204 xanh.

### Tests for User Story 4 (MANDATORY) ⚠️

- [X] T010 [P] [US4] Thêm vào `perm/utils/flatten-filter.test.ts`: `{ total: { _gt: '$FIELD(paid_amount)' } }` → paths
      có `['total']` và `['paid_amount']`; lồng `{ order: { total: {...} } }` → `['order', 'paid_amount']`; trong
      `_and`/`_or`/`_some`; `_in: ['$FIELD(x)']` và `_contains: '$FIELD(x)'` không thêm; case hiện có xanh. Chạy đỏ.
- [X] T011 [P] [US4] Thêm vào `api/services/permissions.service.test.ts` và
      `api/services/backoffice-permissions.service.test.ts`: `permissions` hoặc `validation` (object và chuỗi JSON) có
      `$FIELD` ở toán tử trong sáu, lồng `_and`/`_some` → `InvalidPayloadError` `Permission filters cannot compare two
      fields ($FIELD(...))` ở `createOne`, `updateMany`; `_contains: '$FIELD(x)'` qua; json path vẫn bị chặn. Chạy đỏ.
- [X] T012 [P] [US4] Thêm vào `parity/items/field-compare.test.ts`: user có policy chỉ đọc `total` (fixtures
      `createUser`, `createPolicy`, `attachPolicy` của `parity/permissions/fixtures.ts`) gửi `total _gt
      $FIELD(paid_amount)` → 403 `FORBIDDEN` cả hai app (`assertParity`); cùng user với field b không có → 403 cả hai;
      policy có điều kiện hàng + `$FIELD` → tập id giao; `POST /permissions` và `PATCH /permissions/:id` với `$FIELD`
      trong `permissions`/`validation` → Backoffice 400 `INVALID_PAYLOAD`, Directus 200 (D-204); thêm case
      `/backoffice/permissions` vào `parity/permissions/backoffice-permissions.test.ts`; `POST /fields` với validation có
      `$FIELD` → 200 cả hai. Thêm D-204 `http` (`POST /permissions`, `PATCH /permissions`, `PATCH /permissions/*`, `POST
      /backoffice/permissions`, `PATCH /backoffice/permissions/*`; `backofficeCode: 'INVALID_PAYLOAD'`) vào
      `tests/parity/accepted-differences.ts`. Chạy đỏ.

### Implementation for User Story 4

- [X] T013 [US4] Sửa `perm/utils/flatten-filter.ts` theo research R3: ở nhánh toán tử, khi `key` ∈
      `FIELD_COMPARE_OPERATORS` và `parseFieldCompare(current[key])` trả `b`, đẩy thêm `[...parts.slice(0, -1), b]`;
      comment `// Backoffice (spec 028, D-203)`. T010 xanh; `perm/lib/extract-fields-from-query.test.ts` xanh.
- [X] T014 [US4] Sửa `api/services/permissions.service.ts`: `assertNoJsonPathFilter` → `assertNoBackofficeFilter`
      (export; thêm `hasFieldCompare`, thông điệp D-204, comment ghi D-185 + D-204); sửa
      `api/services/backoffice-permissions.service.ts` gọi hàm đó ở `createOne` và `updateMany`. T011 xanh.
- [X] T015 [US4] Chạy T012 trên Postgres; sửa tới xanh; `guard-differences` xanh với D-204.
- [ ] T016 Đóng lượt 1: `pnpm nx run-many -t lint,typecheck -p api parity-tests`; `api:test` các file đã sửa và cả
      `aq/`, `perm/`, `api/services/permissions*`, `api/services/backoffice-permissions*` (coverage BE ≥ 80 %); parity
      Postgres (`field-compare`, `crud`, `export`, `permissions/backoffice-permissions`), SQLite và MySQL
      (`field-compare`, `crud`) local xanh; `git add` theo đường dẫn (Phase 1–4, `research.md`, `spec.md`,
      `contracts/api.md`); commit `feat(028): compare two fields of the same collection with $FIELD(b) (D-203, D-204)`;
      push theo quy tắc checkout dùng chung; CI xanh (`parity` Postgres 2 shard, sqlite3, mysql reduced,
      `guard-differences`); `graphify update .`.

**Checkpoint**: lượt 1 trên `main`, CI xanh; D-203 cột Directus đã là số đo.

## Phase 5: User Story 2 - Người dùng thêm dòng lọc "field a so với field b" trên trang Content (Priority: P1)

**Goal**: ô giá trị của dòng lọc ở trang Content có nút chọn field (cùng nhóm kiểu) và chip tên field b; gõ tay
`$FIELD(b)` vẫn nhận; bookmark giữ; bàn phím; DrawerCollection và chỗ khác không có nút (D-206).

**Independent Test**: unit `InputGroup`, `InputComponent`, browser a11y xanh; E2E
`content-filter-field-compare.spec.ts` xanh ở `proxy-api`, `cors`; ở `proxy-directus` đúng kết quả T002.

### Tests for User Story 2 (MANDATORY) ⚠️

- [X] T017 [P] [US2] Tạo `web/utils/field-compare.test.ts`: `parseFieldCompare`, `formatFieldCompare`,
      `fieldCompareGroup` (cùng case với T003, không có assert schema). Chạy đỏ.
- [X] T018 [P] [US2] Tạo `sf/InputComponent.test.ts` (chưa có): field `integer` với `$FIELD(paid_amount)` → không
      `aria-invalid`, emit `input`; `$field(x)` → invalid như nay; `uuid` với `$FIELD(owner)` hợp lệ; `$NOW` vẫn hợp lệ.
      Chạy đỏ.
- [X] T019 [P] [US2] Tạo `sf/InputGroup.test.ts` (chưa có; mount với Pinia stores `fields`, `relations` giả như
      `SystemFilter.test.ts`): nút `field_compare` chỉ khi `includeFieldCompare` ∧ toán tử trong sáu ∧ field a thuộc nhóm
      (không với `_contains`, field json, không prop); menu liệt kê field cùng nhóm của collection của field a (số:
      `paid_amount`, `price`; không `title`, không field a, không o2m alias), tên hiển thị, `(key)` khi hai field trùng
      `name`, `rawFieldNames` → key; chọn → emit `update:field` với `$FIELD(paid_amount)`; giá trị `$FIELD(paid_amount)`
      → chip tên hiển thị, `aria-label` `field_compare_with`; field b không có → chip `text-error-500`, `aria-invalid`,
      `title` `field_compare_missing`; mục `field_compare_value` → emit `null`; field a qua quan hệ (`order.total`) liệt
      kê field của `orders`. Chạy đỏ.
- [X] T020 [P] [US2] Thêm vào `sf/SystemFilter.browser.test.ts` và `web/modules/content/a11y.browser.test.ts`: Tab tới
      nút, Enter mở menu, mũi tên + Enter chọn, focus về chip; axe không vi phạm với nút, menu, chip, chip lỗi. Chạy đỏ.
- [X] T021 [P] [US2] Thêm vào `web/components/SearchInput.test.ts` (prop tới `SystemFilter`), test của
      `web/modules/content/routes/CollectionRoute.vue` (có `include-field-compare`) và
      `web/components/drawers/DrawerCollection.test.ts` (không có). Chạy đỏ.
- [X] T022 [P] [US2] Tạo `e2e/content-filter-field-compare.spec.ts` theo `e2e/content-filter-json-path.spec.ts` và
      research R9: collection `bo_cmp_<config>` (`total`, `paid_amount` integer; `published_at`, `updated_at` timestamp;
      3 dòng) tạo qua API của cấu hình; luồng US2 bằng chuột (Filter → Add Filter → Total → Greater than → nút ⇄ → Paid
      Amount; bảng còn đúng dòng); bằng bàn phím; chip hiện "Paid Amount"; lưu bookmark, tải lại, mở bookmark cùng kết
      quả; chip → Enter a value → nhập 50; DrawerCollection (mở từ một field m2o của collection khác hoặc helper hiện
      có) không có nút; `proxy-directus`: kỳ vọng theo T002 (layout hiện lỗi API hoặc 0 dòng); thêm path vào danh
      sách cho phép của helper request nếu thiếu. Chạy đỏ.

### Implementation for User Story 2

- [X] T023 [US2] Tạo `web/utils/field-compare.ts` theo `contracts/web.md` (header `// Backoffice (spec 028, D-206)`).
      T017 xanh.
- [X] T024 [US2] Sửa `sf/InputComponent.vue` `isValueValid`: `parseFieldCompare(value)` hợp lệ; comment spec 028. T018
      xanh.
- [X] T025 [US2] Sửa `sf/InputGroup.vue` theo `contracts/web.md` và research R6: prop `includeFieldCompare`,
      `canCompareField`, `compareFields` (từ `fieldsStore.getFieldsForCollection(fieldInfo.collection)`), nút
      `swap_horiz` + `BoMenu`, chip (bình thường và lỗi), `field_compare_value`; focus về nút/chip khi menu đóng. T019
      xanh.
- [X] T026 [US2] Nối prop: `sf/Nodes.vue` (→ `InputGroup`, `Nodes` đệ quy), `sf/SystemFilter.vue` (hai chỗ),
      `web/components/SearchInput.vue`, `web/modules/content/routes/CollectionRoute.vue` (`include-field-compare`);
      `web/components/drawers/DrawerCollection.vue` không đổi. T021 xanh.
- [X] T027 [P] [US2] Thêm bốn khóa `field_compare`, `field_compare_with`, `field_compare_value`,
      `field_compare_missing` vào `web/lang/overlay/en-US.ts` và `web/lang/overlay/vi-VN.ts` theo `contracts/web.md`.
- [X] T028 [P] [US2] Thêm gạch đầu dòng "Field compare (spec 028, D-206)" vào recipe Q-7 của
      `design-system/docs/component-specs.md` (sau "JSON path form"): nút icon, menu, chip, chip lỗi, bàn phím; không
      component mới, không màu mới.
- [X] T029 [US2] Chạy T020 (browser project) và T022 ở ba cấu hình local (`E2E_CONFIG=proxy-api`, `cors`,
      `proxy-directus`, profile `web`); sửa tới xanh.
- [ ] T030 Đóng lượt 2: `pnpm nx run-many -t lint,typecheck -p web web-e2e`; `web:test` các file đã sửa (project `unit`
      và `browser`, coverage FE ≥ 60 %); `web:build`; E2E ba cấu hình xanh; `git add` theo đường dẫn; commit `feat(web):
      compare two fields in the Content filter (028, D-206)`; push theo quy tắc; CI `e2e-web` (chromium, firefox, webkit)
      xanh; `graphify update .`.

**Checkpoint**: lượt 2 trên `main`; US2 dùng được ở trang Content.

## Phase 6: User Story 3 - Lọc so sánh hai field qua GraphQL (Priority: P2)

**Goal**: `<f>_field: field_compare_operators` với `field_ref { field }` ở scope items cho cùng tập item như REST;
introspection/SDL ngoài phần thêm giống Directus (D-205).

**Independent Test**: unit `replace-funcs`, `schema/index` xanh; parity `graphql/read.test.ts` khối 028 và
introspection/SDL (`graphql` suite) xanh.

### Tests for User Story 3 (MANDATORY) ⚠️

- [X] T031 [P] [US3] Thêm vào `gql/utils/replace-funcs.test.ts`: `replaceFieldCompares` (`{ total_field: { _gt: { field:
      'paid_amount' } } }` → `{ total: { _gt: '$FIELD(paid_amount)' } }`; gộp với `total` có sẵn, `_field` thắng cùng
      toán tử; lồng `_and`/`_or`/mảng/quan hệ; object không đúng dạng (`{ _gt: 'x' }`, khóa lạ) giữ nguyên; `_json` vẫn
      chạy); `withBackofficeFilters` (đổi tên từ `withJsonPaths`, test cũ sửa tên). Chạy đỏ.
- [X] T032 [P] [US3] Thêm vào `gql/schema/index.test.ts`: `<collection>_filter` scope items có `total_field`,
      `title_field`, `published_at_field`, `active_field`, `owner_field` kiểu `field_compare_operators`; không cho json,
      alias, hash, geometry; không khi có field thật `total_field`; scope system không có; type `field_ref` có
      `field: String!`. Chạy đỏ.
- [X] T033 [P] [US3] Thêm khối `describe('spec 028 D-205: field compare filters (Backoffice only)')` vào
      `parity/graphql/read.test.ts` theo khối 023 (:253): sáu toán tử trên số, chuỗi, timestamp, boolean, uuid; `_or`;
      m2o lồng; `_aggregated`; `update_<c>_items(filter:)`; so tập id với REST (SC-004); lỗi khác nhóm (`INVALID_QUERY`),
      field không có (`FORBIDDEN`/`INVALID_QUERY` theo user), `active_field._gt` (`INVALID_QUERY`). Chạy đỏ.
- [X] T034 [P] [US3] Thêm vào `parity/normalizers.test.ts` và `parity/parity.test.ts`: introspection bỏ type
      `field_compare_operators`, `field_ref` và field `*_field` của type đó (không bỏ field thật `x_field` kiểu khác);
      SDL bỏ hai `input ... {}` và dòng `  <f>_field: field_compare_operators`. Chạy đỏ.

### Implementation for User Story 3

- [X] T035 [US3] Sửa `gql/schema/read.ts` theo `contracts/graphql.md`: `FieldRef`, `FieldCompareFilterOperators` sau
      `JsonPathFilterOperators`; trong vòng lặp field: `gql.scope === 'items'`, `fieldCompareGroup(field.type)`,
      `!field.alias`, không có field thật `<f>_field` → `acc[`${field.field}_field`]`; comment `// Backoffice (spec 028,
      D-205)`. T032 xanh; `gql/schema/*.test.ts` hiện có xanh.
- [X] T036 [US3] Sửa `gql/utils/replace-funcs.ts` (`replaceFieldCompares`, `withBackofficeFilters` gọi cả hai rewrite,
      giữ `replaceJsonPaths`), đổi call site ở `gql/schema/parse-query.ts` (hai chỗ) và `gql/utils/aggregate-query.ts`.
      T031 xanh; `parse-query.test.ts`, `aggregate-query.test.ts` xanh.
- [X] T037 [US3] Sửa `parity/normalizers.ts` (`FIELD_COMPARE_TYPES`, `withoutBackofficeIntrospection`,
      `withoutBackofficeSdl`), thêm D-205 `doc` vào `tests/parity/accepted-differences.ts`; chạy T033, T034 và bộ
      `graphql` (introspection, SDL, `server_specs_graphql`; profile `graphql-nointro` không đổi) trên Postgres; sửa
      tới xanh.

**Checkpoint**: GraphQL cho cùng tập item như REST; introspection/SDL đối chiếu xanh.

## Phase 7: Polish & Cross-Cutting (lượt 3)

- [X] T038 [P] Thêm D-206 `doc` vào `tests/parity/accepted-differences.ts`; thêm mục `src/items/field-compare.test.ts`
      (spec 028) vào `tests/parity/README.md` theo mẫu mục 023 (:138).
- [X] T039 [P] Tài liệu: `CLAUDE.md` dòng 028 ở Active Technologies ("planned" → "implemented", kết quả T002, câu chữ
      cuối) và mục Recent Changes; `SPECKIT-GUIDE.md` dòng Trạng thái 028 "Đã xong" với commit và run CI;
      `specs/028-field-compare-filter/spec.md` Status + bảng D (câu chữ cuối), `research.md` "Kết quả lượt 1/2/3";
      `checklists/requirements.md` ghi "Sau implement".
- [X] T040 [P] (chưa chạy, chủ dự án quyết định; research R10) Vendor khác (MariaDB, MSSQL, Oracle, CockroachDB): chạy `nightly.yml` thủ công với `field-compare` hoặc
      để chủ dự án quyết định như T055 của 023; ghi kết quả (hoặc "chưa chạy") vào `research.md` R10.
- [ ] T041 Đóng lượt 3: `pnpm nx run-many -t lint,typecheck -p api web parity-tests`; `api:test` `gql/`; parity
      Postgres `graphql` và bộ `full`; `git add` theo đường dẫn; commit `feat(graphql): field compare input and docs
      (028, D-205)`; push theo quy tắc; CI xanh (`parity`, `guard-differences`, `e2e-web`); chạy workflow
      `benchmark-items` thủ công (hoặc đọc run hàng tuần kế tiếp) và ghi kết quả SC-006 vào `research.md` R11 (analyze
      C1); `graphify update .`; đóng feature.

## Dependencies & Execution Order

### Phase

- Lượt 1: Phase 1 (T001, T002) → Phase 2 (T003–T006) → Phase 3 (US1, T007–T009) → Phase 4 (US4, T010–T015) → T016
  đóng lượt 1. T002 chỉ cần env parity, làm song song với T001; T007/T008 cần T002 (cột Directus, `when`).
- Lượt 2: Phase 5 (US2, T017–T029) → T030 đóng lượt 2; cần lượt 1 trên `main` (API của env E2E `proxy-api` và `cors`
  là Backoffice mới).
- Lượt 3: Phase 6 (US3, T031–T037) → Phase 7 (T038–T040) → T041; Phase 6 chỉ cần lượt 1 (đường REST), làm song song
  với lượt 2 được nếu khác người.

### User story

- US1 (P1, lượt 1): cần Phase 2. Không cần story khác.
- US4 (P1, lượt 1): cần Phase 2 và `field-compare.ts` (T005); case quyền trong parity cần collection của T007.
- US2 (P1, lượt 2): cần US1 trên `main` (E2E `proxy-api`); không cần US3, US4 (chỉ UI).
- US3 (P2, lượt 3): cần Phase 2 và US1 (REST đúng); không cần US2.

### Trong một story

- Test trước (chạy đỏ) → file mới → file sửa → chạy xanh → task đóng lượt.
- T013 (flatten-filter) trước T015 (parity quyền); T014 trước case D-204 của T015.
- T025 (InputGroup) trước T026 (nối prop) trước T029 (E2E).
- T035, T036 trước T037 (normalizer + parity GraphQL).

## Parallel Example

```bash
# Lượt 1, sau Phase 2:
#   T007 (parity items) ‖ T008 (accepted-differences) ‖ T010 ‖ T011 (unit quyền, permission)
# Lượt 2:
#   T017 ‖ T018 ‖ T019 ‖ T020 ‖ T021 ‖ T022 (test đỏ), rồi T023 → T024 → T025 → T026; T027 ‖ T028 bất kỳ lúc nào
# Lượt 3:
#   T031 ‖ T032 ‖ T033 ‖ T034, rồi T035 ‖ T036 → T037; T038 ‖ T039 ‖ T040
```

## Implementation Strategy

### MVP (lượt 1)

1. T001, T002: chốt SQL của knex và hành vi Directus.
2. Phase 2: `field-compare.ts` + nhánh trong `applyOperator`.
3. US1 + US4: parity ba vendor, quyền field b, D-204.
4. T016: commit, CI. Dừng được ở đây: API dùng `$FIELD` qua SDK/URL, bookmark gõ tay vẫn chạy.

### Tăng dần

- Lượt 2: web (US2), E2E ba cấu hình.
- Lượt 3: GraphQL (US3), parity introspection, tài liệu, vendor khác, đóng feature.

## Notes

- 41 task, 22 có [P]; 3 lượt; US1 9 task (T001–T009 kể cả Setup/Foundational), US4 7, US2 14, US3 7, Polish 4.
- Không benchmark (research R11); không migration, không dependency.
- Nếu T001 cho thấy knex bind `Ref` làm giá trị: dùng `whereRaw('?? <op> ??')`, cập nhật R1 và contracts/api.md trước
  T004.
- Nếu T002 cho thấy Directus trả 500 cho field ngày: ghi vào D-203 và E2E `proxy-directus` kỳ vọng 500 (hành vi
  Directus, không sửa gì).
