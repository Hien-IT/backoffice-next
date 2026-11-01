# Implementation Plan: Lọc item bằng so sánh hai field của cùng collection

**Branch**: `028-field-compare-filter` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=028-field-compare-filter`) | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-field-compare-filter/spec.md`

## Summary

Giá trị động `$FIELD(<b>)` ở vế phải của `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte` (REST `/items`, `SEARCH`,
export; GraphQL qua input `<f>_field`) so field a với field b của cùng item, cùng collection, cùng nhóm kiểu (số và
chuỗi so chéo trong nhóm; `date`, `dateTime`, `timestamp` chỉ cùng kiểu lưu), mọi vendor bằng `a <op> b` của SQL
chuẩn. Schema, dữ liệu, dependency không đổi; Directus 11.17.4 chạy chung không cần gì mới, chỉ trả kết quả khác cho
request và bookmark có `$FIELD` (D-203, D-203.1, đo ở lượt 1). Trang Content có nút chọn field và chip trong ô giá trị
(D-206), permission có `$FIELD` bị từ chối khi lưu (D-204), GraphQL thêm `field_compare_operators` + `field_ref`
(D-205, parity chuẩn hóa).

Cách làm (chi tiết ở [research.md](./research.md)): một file mới `field-compare.ts` (parse, nhóm kiểu, assert) dùng
ở `applyOperator` trước `cast`, vế phải qua `getColumn` như vế trái (R1, R2); `flattenFilter` đẩy thêm đường dẫn của
field b để kiểm quyền đọc (R3); guard permission của D-185 mở rộng (R4); GraphQL input riêng với giá trị `{ field }`
để rewrite không cần schema (R5); web: prop `includeFieldCompare`, nút `swap_horiz` + BoMenu + chip trong `InputGroup`
(R6); parity file mới, D-203 `http` theo kết quả đo, chỗ Directus 200 so riêng từng app (R8); E2E collection riêng
(R9); ba lượt (R12).

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict (cờ của `@directus/tsconfig`), Node.js 22 LTS, ESM, pnpm 10.27, Nx 23;
swc build cho `apps/api`; Vite cho `apps/web`.

**Primary Dependencies**: có sẵn, không thêm: Knex 3.1 (`knex.ref` ở vị trí giá trị của `where`), `@backoffice/types`
(`SchemaOverview`, `FieldOverview.alias`), `@backoffice/errors`, lodash-es, graphql 16.12.0 + graphql-compose 9.1.0
(hai input mới), NestJS 12; web: Vue 3.5, Reka UI 2.8.2, Tailwind CSS 4.3, `@directus/utils` 13.4.1 (web không dùng
`@backoffice/*`), BoMenu/BoIcon hiện có; test: Vitest 3.2.4, `knex-mock-client`, Playwright 1.64.0.

**Storage**: không bảng, cột, migration, dòng `directus_*` mới; `directus_presets.filter` chứa `"$FIELD(b)"` như mọi
giá trị (JSON tự do); response cache (Keyv dùng chung) có key riêng theo query; không Redis key mới.

**Testing**: Vitest unit (`apps/api`: `field-compare`, `operator`, `flatten-filter`, `permissions.service`,
`backoffice-permissions.service`, `replace-funcs`, graphql `schema/index`; `apps/web`: `utils/field-compare`,
`InputGroup`, `InputComponent`, `SystemFilter` browser, a11y browser); parity env chính (`items/field-compare.test.ts`
bộ `full` + `reduced` mọi vendor, `accepted-differences` D-203/D-204 `http`, normalizer D-205, `graphql/read.test.ts`
chỉ Backoffice); E2E `content-filter-field-compare.spec.ts` ba cấu hình (`proxy-directus` mong hành vi Directus đo ở
T002); vendor khác qua nightly; không benchmark (R11).

**Target Platform**: Linux `amd64` container (API), trình duyệt desktop/tablet (Chrome, Edge, Firefox, Safari).

**Project Type**: BE (`apps/api`) + FE (`apps/web`, `apps/web-e2e`) + test (`tests/parity`).

**Performance Goals**: scenario benchmark hiện có không tệ hơn Directus quá 10 % (SC-006; đường đi request không có
`$FIELD` chỉ thêm một kiểm chuỗi); so hai cột không dùng index, không đo riêng (Assumptions).

**Constraints**: không sửa `directus/` (I); không DDL, không migration, không dependency (II); API/GraphQL giống
Directus trừ D-203..D-206 (III, V: `http`/`doc` entries + normalizer); tên field b chỉ vào SQL qua `knex.ref` sau khi
tra schema (FR-007); không biến env mới (VIII); comment code ghi "DR" và `Backoffice (spec 028, D-20x)` ở file port
(IX); coverage BE ≥ 80 %, FE ≥ 60 % (X); nút và chip ghép từ recipe Q-7, BoMenu, chip dòng lọc, chỉ token theme (XII).

**Scale/Scope**: API 1 file mới (`field-compare.ts`) + 5 file sửa (`operator.ts`, `flatten-filter.ts`,
`permissions.service.ts`, `backoffice-permissions.service.ts`, GraphQL `read.ts` + `replace-funcs.ts` + 3 call site
đổi tên hàm); web 1 util mới + 6 file sửa (`InputComponent`, `InputGroup`, `Nodes`, `SystemFilter`, `SearchInput`,
`CollectionRoute`), 2 overlay i18n; parity 1 file mới + 4 sửa; E2E 1 spec mới; docs 5 file; D-203..D-206.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.4.0). Mark PASS, or VIOLATION with
a row in Complexity Tracking.

- [x] I. PASS: không file nào trong `directus/` đổi; các file port sửa (`operator.ts`, `flatten-filter.ts`,
  `permissions.service.ts`, `read.ts`, `replace-funcs.ts`, `InputComponent.vue`, `InputGroup.vue`, `Nodes.vue`,
  `SystemFilter.vue`) giữ header nguồn và ghi comment `// Backoffice (spec 028, D-20x)` tại chỗ sửa; `field-compare.ts`
  (API và web) là file Backoffice.
- [x] II. PASS: không bảng, cột, migration, dòng `directus_*`, dependency; không DDL; DB dùng được với Directus
  11.17.4 không đổi.
- [x] III. PASS với D-203..D-206 ghi trong spec (chủ dự án duyệt sau plan): path, query, response, status, header,
  cookie giống Directus cho mọi request không có `$FIELD` ở sáu toán tử (FR-009); giá trị mới là phần mở rộng.
- [x] IV. PASS: không state trong process; cache response chung key theo query; không lock, không bus mới.
- [x] V. PASS: parity `items/field-compare.test.ts` (D-203, D-204 `http`, `assertParity` cho quyền và request thường),
  GraphQL normalizer D-205 + `read.test.ts`, blackbox không đổi, vendor khác nightly (contracts/tests.md).
- [x] VI. PASS: không service mới; code trong `apps/api/src/database`, `permissions`, `services/permissions.service.ts`,
  `services/graphql`; Vue 3 Composition API, prop và một util nhỏ.
- [x] VII. PASS: không ảnh hưởng khởi động, FE không cấu hình mới; nhiều replica không đổi.
- [x] VIII. PASS: không biến môi trường mới.
- [x] IX. PASS: chuỗi mới (`Compare with a field`, `So với field khác`, thông điệp lỗi) là của Backoffice; không đổi
  tên gì của Directus; comment "DR".
- [x] X. PASS: coverage qua unit test (contracts/tests.md); hiệu năng: đường đi request thường không đổi, không
  benchmark riêng (R11); log pino không đổi; không email; khác biệt D-203..D-206 trong spec.
- [x] XI. PASS: không chạm mục ngoài phạm vi.
- [x] XII. PASS: đã đọc `design-system/README.md`, `docs/component-specs.md` (Q-7 L1269-1325: SearchInput, SystemFilter,
  value controls, JSON path form), `docs/layout-patterns.md`, `qa/handoff-checklist.md`; nút chọn field + chip chưa có
  mẫu riêng: ghi ở "Cần xác nhận" của spec, đề xuất ghép từ Q-7 (nút icon cùng lớp với nút `{{ }}`, chip như chip field
  của dòng lọc, BoMenu), chủ dự án (design owner) chốt ở analyze như C1 của 023; nhãn `aria-label`, bàn phím, trạng
  thái lỗi; không màu mới nên `migration-guide.md` không đổi.

Post-design re-check (sau Phase 1): không đổi; "Sửa spec khi plan" (research R2, R3, R5) là câu chữ FR-003, FR-008,
Edge Cases, D-205, áp vào spec cùng commit plan.

## Project Structure

### Documentation (this feature)

```text
specs/028-field-compare-filter/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (R1–R12)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output: api.md, graphql.md, web.md, tests.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/src/
├── database/run-ast/lib/apply-query/filter/
│   ├── field-compare.ts (+ .test.ts, mới)                     # parseFieldCompare, fieldCompareGroup, assertFieldCompare, hasFieldCompare (R1, R2)
│   └── operator.ts (+ .test.ts)                               # nhánh $FIELD trước json/applyWhere: where(a, op, getColumn(b)) (R1)
├── permissions/modules/process-ast/utils/flatten-filter.ts (+ .test.ts)   # đường dẫn của field b vào paths (R3)
├── services/permissions.service.ts (+ .test.ts)               # assertNoBackofficeFilter: json path + $FIELD (R4, D-204)
├── services/backoffice-permissions.service.ts (+ .test.ts)    # cùng assert ở createOne/updateMany (R4)
└── services/graphql/
    ├── schema/read.ts                                          # field_ref, field_compare_operators, <f>_field (R5)
    ├── schema/parse-query.ts, utils/aggregate-query.ts         # withBackofficeFilters (đổi tên withJsonPaths)
    ├── utils/replace-funcs.ts (+ .test.ts)                     # replaceFieldCompares, withBackofficeFilters
    └── schema/index.test.ts                                    # <f>_field ở items, không ở system
apps/web/src/
├── utils/field-compare.ts (+ .test.ts, mới)                    # parse/format/group (R6)
├── components/SearchInput.vue (+ .test.ts)                     # prop includeFieldCompare → SystemFilter
├── modules/content/routes/CollectionRoute.vue                  # :include-field-compare (D-206)
├── interfaces/_system/system-filter/
│   ├── SystemFilter.vue                                        # prop → Nodes
│   ├── Nodes.vue                                               # prop → InputGroup, Nodes đệ quy
│   ├── InputGroup.vue (+ .test.ts)                             # nút swap_horiz, BoMenu field cùng nhóm, chip (R6)
│   └── InputComponent.vue (+ .test.ts)                         # isValueValid nhận $FIELD(...)
├── lang/overlay/en-US.ts, vi-VN.ts                             # field_compare, field_compare_with, field_compare_value, field_compare_missing
└── modules/content/a11y.browser.test.ts                        # nút, menu, chip
apps/web-e2e/src/
└── content-filter-field-compare.spec.ts (mới)                  # US2, FR-013, ba cấu hình (R9)
tests/parity/
├── accepted-differences.ts                                     # D-203, D-203.1, D-204, D-205, D-206
└── src/
    ├── suite.ts, vendors.test.ts                               # + items/field-compare.test.ts (full, reduced)
    ├── items/field-compare.test.ts (mới)                       # R8, T002 đo Directus
    ├── normalizers.ts (+ .test.ts)                             # field_compare_operators, field_ref, *_field (D-205)
    └── graphql/read.test.ts                                    # khối spec 028 chỉ Backoffice
design-system/docs/component-specs.md                           # Q-7: Field compare
tests/parity/README.md, CLAUDE.md, SPECKIT-GUIDE.md             # 028, D-203..D-206
specs/028-field-compare-filter/spec.md                          # câu chữ R2, R3, R5; kết quả T002
```

**Structure Decision**: không project Nx mới, không lib mới (web chép ngữ pháp `$FIELD` vì không dùng
`@backoffice/*`, như `utils/json-path.ts` của 023); code API ở đúng lớp của bản port (`applyOperator` cho toán tử,
`flattenFilter` cho quyền, `replace-funcs` cho GraphQL); parity ở `tests/`; E2E trong `apps/web-e2e` như 014–027.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Không có vi phạm: D-203, D-203.1, D-204, D-205, D-206 là khác biệt API/UI ghi trong spec theo Nguyên tắc X (chủ dự án
duyệt sau plan); không sửa constitution. Nguyên tắc XII: câu hỏi mở về nút chọn field + chip ở "Cần xác nhận", chốt ở
analyze.
