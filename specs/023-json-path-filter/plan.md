# Implementation Plan: Lọc item theo path trong field json

**Branch**: `023-json-path-filter` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=023-json-path-filter`) | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/023-json-path-filter/spec.md`

## Summary

Key `json(field, path, type)` trong `filter` (REST `/items`, `SEARCH`, export; GraphQL qua input `<field>_json`) lọc
item theo giá trị tại một path trong field json, kiểu do client chọn (`text`, `number`, `boolean`), `[*]` cho phần tử
bất kỳ của mảng, qua m2o; Postgres (cột `json` và `jsonb`) và SQLite, vendor khác 400. Field, schema, dữ liệu không
đổi; Directus 11.17.4 chạy chung không cần gì mới, chỉ trả 400 cho request có key này (D-184) và cho bookmark có key
này (D-184.1). Trang Content và DrawerCollection có mục "JSON path" dưới field json (form path + kiểu), mọi chỗ khác mất
mục `functions.json` gây 400 (D-187); permission có path json bị từ chối khi lưu (D-185); GraphQL thêm type
`json_path_filter_operators` (D-186, parity chuẩn hóa); `sort=json(...)` chạy hết đường request và `fields=json(f, p,
type)` trả giá trị có kiểu, chuẩn hóa JSON trên hai vendor (D-184.2, checklist api-compat).

Cách làm (chi tiết ở [research.md](./research.md)): sửa gốc `parseFilterKey` và `parseJsonFunction` (R1, R2); biểu thức
có kiểu của dialect (`CASE WHEN json_typeof(...) ... END`, `json_type`) để mọi toán tử của `applyOperator` chạy nguyên,
`[*]` qua `whereExists` (R3, R4, đã thử SQL trên PG 13 và SQLite 3.44); quyền trên field gốc và từ chối permission (R5);
GraphQL đổi key trước `sanitizeQuery` (R7); web: prop `includeJsonPath`, `JsonPathForm`, sửa path lodash (R8); parity
file mới + D-184 `http` + normalizer D-186 (R10); E2E collection riêng (R11); benchmark có/không index (R12); ba lượt
(R14).

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict (cờ của `@directus/tsconfig`), Node.js 22 LTS, ESM, pnpm 10.27, Nx 23;
swc build cho `apps/api`; Vite cho `apps/web`.

**Primary Dependencies**: có sẵn, không thêm: Knex 3.1 (`pg` 8.16.3, `sqlite3` 5.1.7 với SQLite 3.44 bundled),
`@backoffice/utils` (`getFilterOperatorsForType`), `@backoffice/errors`, lodash-es, graphql 16.12.0 + graphql-compose
9.1.0 (input type mới), NestJS 12; web: Vue 3.5, Reka UI 2.8.2, Tailwind CSS 4.3, `@directus/utils` 13.4.1 (web không
dùng `@backoffice/*`), lodash-es; test: Vitest 3.2.4, `knex-mock-client`, Playwright 1.64.0, autocannon.

**Storage**: không bảng, cột, migration, dòng `directus_*` mới; `directus_presets.filter` chứa key mới như mọi key
(JSON tự do); cột json/jsonb Postgres và text SQLite đọc nguyên; response cache (Keyv dùng chung) có key riêng theo
query; không Redis key mới.

**Testing**: Vitest unit (`apps/api`: parse-filter-key, parse-function, get-filter-type, operator với `Client_SQLite3`
+ `Client_PG` mới, filter/index m2o, dialects postgres/sqlite, extract-fields-from-query, permissions.service,
replace-funcs, graphql schema; `apps/web`: FieldList, SystemFilter, utils, json-path, SearchInput, DrawerCollection,
browser keyboard, axe); parity env chính (`items/json-path.test.ts` Postgres full + reduced sqlite3/mysql, jsonb qua
DDL thô, `accepted-differences` D-184/D-185 `http`, normalizer D-186, `graphql/read.test.ts` chỉ Backoffice, blackbox
`json-fields` không đổi); E2E `content-filter-json-path.spec.ts` ba cấu hình (proxy-directus mong lỗi D-184.1);
benchmark `benchmark-items` có cột `payload`, đo riêng Backoffice có/không expression index; vendor khác qua nightly.

**Target Platform**: Linux `amd64` container (API), trình duyệt desktop/tablet (Chrome, Edge, Firefox, Safari).

**Project Type**: BE (`apps/api`) + FE (`apps/web`, `apps/web-e2e`) + test (`tests/parity`, `tests/benchmark`).

**Performance Goals**: scenario benchmark hiện có không tệ hơn Directus quá 10 % (SC-006, không sửa đường đi của request
không có json path); lọc theo path trên 10 triệu dòng: chỉ đo và ghi (không có mốc Directus), có và không có
expression index (R12); không request thêm ở web (form trong popover sẵn có).

**Constraints**: không sửa `directus/` (I); không DDL, không migration (II); API/GraphQL giống Directus trừ D-184..D-187
(III, V: `http` entries + normalizer); path và giá trị chỉ qua binding (FR-010); vendor gate theo `getDatabaseClient`
(FR-008); không biến env mới (VIII); comment code ghi "DR" (IX); coverage BE ≥ 80 %, FE ≥ 60 % (X); form theo recipe
Input/Select của `design-system/docs/component-specs.md` Q-7, chỉ token theme (XII); Postgres tối thiểu 10 (profile
`postgres10`), nên không dùng jsonpath (PG 12).

**Scale/Scope**: API ~10 file sửa (`parse-filter-key`, `parse-function`, `get-filter-type`, `operator`, `get-column`,
`fn/types`, `fn/dialects/{postgres,sqlite,mysql,mssql,oracle}`, `permissions.service`) + 2 file GraphQL + 1 test mock;
web 1 component mới (`JsonPathForm`), 1 util mới (`json-path`), 6 file sửa (`FieldList`, `SystemFilter`, `Nodes`,
`InputGroup`, `utils`, `SearchInput`), 2 call site, 2 overlay i18n; parity 1 file mới + 3 sửa; E2E 1 spec mới; benchmark
2 file sửa; docs 4 file; D-184..D-187.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.2.0). Mark PASS, or VIOLATION with
a row in Complexity Tracking.

- [x] I. PASS: không file nào trong `directus/` đổi; các file port sửa (`parse-filter-key.ts`, `operator.ts`,
  `read.ts`, `replace-funcs.ts`...) giữ header nguồn và ghi comment `// Backoffice (spec 023, D-18x)` tại chỗ sửa.
- [x] II. PASS: không bảng, cột, migration, dòng `directus_*`; không DDL (ALTER sang jsonb chỉ trong test parity trên
  collection của test); DB dùng được với Directus 11.17.4 không đổi.
- [x] III. PASS với D-184..D-187 ghi trong spec (chấp nhận 2026-10-27, câu chữ duyệt sau plan): path, query, response,
  status, header, cookie giống Directus cho mọi request không có key mới (FR-012); key mới là phần mở rộng 200 thay 400.
- [x] IV. PASS: không state trong process; cache response chung key theo query; không lock, không bus mới.
- [x] V. PASS: parity `items/json-path.test.ts` (D-184, D-185 `http`, đối chứng `assertParity`), GraphQL normalizer
  D-186 + `read.test.ts`, blackbox không đổi, vendor khác nightly (contracts/tests.md).
- [x] VI. PASS: không service mới; code trong `apps/api/src/database`, `services/permissions.service.ts`,
  `services/graphql`; Vue 3 Composition API, prop và một component nhỏ.
- [x] VII. PASS: không ảnh hưởng khởi động, FE không cấu hình mới; nhiều replica không đổi.
- [x] VIII. PASS: không biến môi trường mới; `MAX_JSON_QUERY_DEPTH` là biến Directus có sẵn.
- [x] IX. PASS: chuỗi mới (`JSON path`, `Đường dẫn JSON`, thông điệp lỗi) là của Backoffice; không đổi tên gì của
  Directus; comment "DR".
- [x] X. PASS: coverage qua unit test (contracts/tests.md); hiệu năng: không sửa đường đi request thường, benchmark đo
  riêng; log pino không đổi; không email; khác biệt D-184..D-187 trong spec.
- [x] XI. PASS: không chạm mục ngoài phạm vi.
- [x] XII. PASS: đã đọc `design-system/README.md`, `docs/component-specs.md` (Input L110-126, Select L128-146, Q-7
  L1265-1312), `docs/layout-patterns.md`, `qa/handoff-checklist.md`; form path + kiểu chưa có mẫu riêng: ghi thành câu
  hỏi mở trong spec và chủ dự án (design owner) chốt 2026-10-27 ghép từ recipe Q-7, Input, Select (spec FR-017, sửa
  khi analyze); form dùng `BoInput`/`BoSelect`, token theme, nhãn và lỗi liên kết, bàn phím; thêm gạch đầu dòng Q-7;
  không màu mới nên `migration-guide.md` không đổi.

Post-design re-check (sau Phase 1): không đổi; "Sửa spec khi plan" (research R16) là câu chữ FR-001, FR-004, FR-013,
FR-018, Edge Cases, D-186, áp vào spec cùng commit plan.

## Project Structure

### Documentation (this feature)

```text
specs/023-json-path-filter/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (R1–R16)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output: api.md, graphql.md, web.md, tests.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/src/
├── utils/parse-filter-key.ts (+ .test.ts)                      # json: fieldName = tham số đầu (R1)
├── database/get-ast-from-query/lib/convert-wildcards.ts         # giữ hành vi DR với alias json(...) (checklist CHK009)
├── database/run-ast/lib/parse-current-level.ts                  # đọc { field, path } mới của parseJsonFunction
├── permissions/utils/get-unaliased-field-key.ts                 # đọc { field, path } mới của parseJsonFunction
├── database/helpers/fn/
│   ├── types.ts (+ .test.ts)                                   # JsonFilterType, jsonType, jsonArrayElements, jsonElement, assertJsonFilterSupported
│   ├── json/parse-function.ts (+ .test.ts)                     # 2–3 tham số, [*] (allowWildcard), splitWildcard, jsonFilterType (R2)
│   └── dialects/
│       ├── postgres.ts (+ .test.ts)                            # json() có kiểu (#>, json(b)_typeof), [*] (R4); gate cockroachdb/redshift
│       ├── sqlite.ts (+ .test.ts mới)                          # json_type, json_extract, json_each, json_valid (R4)
│       └── mysql.ts, mssql.ts, oracle.ts                        # assert khi có jsonType
├── database/run-ast/
│   ├── utils/get-column.ts                                     # truyền jsonType, allowWildcard cho filter
│   └── lib/apply-query/
│       ├── filter/get-filter-type.ts (+ .test.ts)              # nhánh json → string/float/boolean
│       ├── filter/operator.ts (+ .test.ts)                     # split dấu chấm đầu, ép số, applyWhere, whereExists, selectionRaw (R3)
│       ├── filter/index.test.ts                                # case m2o json
│       └── mock.ts                                             # + Client_PG
├── permissions/modules/process-ast/lib/extract-fields-from-query.test.ts   # field gốc
├── services/permissions.service.ts (+ .test.ts)               # assertNoJsonPathFilter (R5, D-185)
└── services/graphql/
    ├── schema/read.ts                                          # json_path_filter_operators, <f>_json (R7)
    ├── schema/parse-query.ts (+ .test.ts mock)                 # replaceJsonPaths trước sanitizeQuery (2 chỗ)
    ├── utils/aggregate-query.ts (+ .test.ts)                   # replaceJsonPaths trước sanitizeQuery
    ├── utils/replace-funcs.ts (+ .test.ts mới)                 # replaceJsonPaths
    └── schema/index.test.ts                                    # details_json, system không có
apps/web/src/
├── utils/json-path.ts (+ .test.ts)                             # parse/format/error/jsonFilterType (R8-2)
├── components/FieldList.vue (+ .test.ts)                       # prop includeJsonPath, nhãn json_path
├── components/SearchInput.vue (+ .test.ts)                     # prop → SystemFilter
├── components/drawers/DrawerCollection.vue (+ .test.ts)        # :include-json-path
├── modules/content/routes/CollectionRoute.vue                  # :include-json-path
├── interfaces/_system/system-filter/
│   ├── JsonPathForm.vue (mới)                                   # path + kiểu + Apply (R8-4)
│   ├── SystemFilter.vue (+ .test.ts, .browser.test.ts)         # placeholder → form; prop
│   ├── Nodes.vue                                               # hàng json, chip sửa, prop đệ quy
│   ├── InputGroup.vue                                          # field giả theo kiểu
│   └── utils.ts (+ .test.ts)                                   # splitFieldPath, path mảng (R8-1)
├── lang/overlay/en-US.ts, vi-VN.ts                             # json_path, json_path_type_*, json_path_invalid, json_path_apply
└── modules/content/a11y.browser.test.ts                        # form JSON path
apps/web-e2e/src/
├── content-filter-json-path.spec.ts (mới)                      # US2, US3, FR-015, ba cấu hình (R11)
└── allowed-paths.ts                                            # nếu thiếu path
tests/parity/
├── accepted-differences.ts                                     # D-184, D-184.1, D-185, D-186, D-187
└── src/
    ├── suite.ts                                                # + items/json-path.test.ts (reduced, full)
    ├── items/json-path.test.ts (mới)                           # R10
    ├── normalizers.ts (+ .test.ts), parity.ts (+ .test.ts)     # D-186
    └── graphql/read.test.ts                                    # case chỉ Backoffice
tests/benchmark/src/
├── seed-items.ts                                               # cột payload
├── items.ts                                                    # khối đo riêng, index (R12)
└── web-content.ts                                              # dòng 8172 reported-only
design-system/docs/component-specs.md                           # Q-7: JSON path form
tests/parity/README.md, deploy/README.md, CLAUDE.md             # 023, D-184 shared-domain
specs/023-json-path-filter/spec.md                              # câu chữ R16
```

**Structure Decision**: không project Nx mới, không lib mới (web chép ngữ pháp path vì không dùng `@backoffice/*`);
code API ở đúng lớp của bản port (helper dialect cho SQL, `applyOperator` cho toán tử); parity và benchmark ở
`tests/`; E2E trong `apps/web-e2e` như 014–022.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Không có vi phạm: D-184, D-184.1, D-184.2, D-185, D-186, D-187 là khác biệt API ghi trong spec theo Nguyên tắc X (chủ dự
án duyệt 2026-10-27); không sửa constitution. Nguyên tắc XII: câu hỏi mở về form path + kiểu đã chốt trong spec
(analyze C1).
