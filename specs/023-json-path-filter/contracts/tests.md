# Contract: test (023)

## Unit API (`apps/api`, Vitest, lượt 1 và 3)

| File | Case |
|------|------|
| `utils/parse-filter-key.test.ts` | `json(a, b, number)` → `fieldName 'a'`; key thường không đổi |
| `database/helpers/fn/json/parse-function.test.ts` | 2–3 tham số, `type` mặc định/lạ, `[*]` với và không `allowWildcard`, hai `[*]`, depth, `splitWildcard` |
| `database/run-ast/lib/apply-query/filter/get-filter-type.test.ts` | json → `string`/`float`/`boolean`; `type` lạ → 400 |
| `database/run-ast/lib/apply-query/filter/operator.test.ts` | `Client_SQLite3` và `Client_PG` mới (`mock.ts`): SQL từng toán tử trên biểu thức có kiểu (json và jsonb qua `dbType`), `[*]` → `EXISTS`, path có dấu chấm qua alias, `_empty`/`_starts_with`/`_ends_with` dùng `selectionRaw` (SQL cột thường không đổi) |
| `database/run-ast/lib/apply-query/filter/index.test.ts` | key gốc và m2o (`order.json(...)`), `_and`/`_or` |
| `database/helpers/fn/dialects/{postgres,sqlite}.test.ts` | `json()` có `jsonType`, `jsonArrayElements`, `jsonElement`; mysql/mssql/oracle → `InvalidQueryError` |
| `permissions/modules/process-ast/lib/extract-fields-from-query.test.ts` | key json → field gốc |
| `services/permissions.service.test.ts` | `createOne`/`updateMany` với `permissions`/`validation` có `json(` → `InvalidPayloadError`; không có → đi `super` |
| `services/graphql/utils/replace-funcs.test.ts` (mới, lượt 3) | top level, m2o, `_and`/`_or`/`_some`, prototype null, 0 hoặc 2 kiểu → lỗi, `foo_json.path` object giữ nguyên |
| `services/graphql/utils/aggregate-query.test.ts`, `schema/parse-query.test.ts` | thứ tự trước `sanitizeQuery`; mock thêm `replaceJsonPaths` |
| `services/graphql/schema/index.test.ts` | `articles_filter.details_json: json_path_filter_operators` (items), SDL system không có type |

Coverage BE ≥ 80 % giữ (X).

## Parity (`tests/parity`, env chính, lượt 1 và 3)

| File | Thay đổi | Kiểm |
|------|----------|------|
| `src/items/json-path.test.ts` (mới; `suite.ts` `REDUCED_FILES` + `FULL_FILES`) | collection `parity_json_path_<run>` + collection m2o, dữ liệu spec; request json path: `result.accepted` có `D-184`, Backoffice 200 đúng tập item (so với tập mong đợi), Directus 400 `INVALID_QUERY`; request đối chứng: `assertParity`; Postgres: lặp lại sau `ALTER COLUMN ... TYPE jsonb` + cache clear; vendor khác: cả hai 400, message Backoffice nêu vendor; D-185: `POST /permissions` từng app, Directus 200 (xóa sau), Backoffice 400 `INVALID_PAYLOAD` | US1, US5, FR-001..FR-012, SC-002, SC-003 |
| `accepted-differences.ts` | D-184 (`http`, endpoints theo tiền tố, `when` 400 `INVALID_QUERY`), D-185 (`http`, `/permissions`, `when.backofficeCode INVALID_PAYLOAD`), D-184.1, D-184.2, D-186, D-187 (`doc`) | `accepted-differences.test.ts`, `guard-differences` |
| `src/items/json-path.test.ts` (D-184.2) | `sort=json(f, p)`, `sort=json(f, p, number)`, `fields=json(f, p, number)`/`boolean` gửi riêng từng app: ghi status/body thật của Directus (xác nhận [Inference] R6), Backoffice đúng thứ tự và giá trị chuẩn hóa JSON trên Postgres và SQLite | D-184.2, Edge Cases |
| `src/normalizers.ts`, `src/parity.ts` (lượt 3) | bỏ `json_path_filter_operators` và `*_json` (introspection `inputFields`, SDL, `server_specs_graphql`), bỏ ETag, sort type | `graphql/schema.test.ts`, `system.test.ts` xanh nguyên văn; unit `normalizers.test.ts`, `parity.test.ts` |
| `src/graphql/read.test.ts` (lượt 3) | case chỉ Backoffice: GraphQL `_json` = REST `json(...)` (top level, m2o, `_and`) | US4, SC-004 |
| blackbox `items/blackbox/.../json-fields.test.ts` | không đổi | SC-003 |

## E2E (`apps/web-e2e`, lượt 2)

| File | Case | Cấu hình |
|------|------|----------|
| `src/content-filter-json-path.spec.ts` (mới) | tạo `bo_json_<run>` qua `AdminApi` + item; Filter → Add Filter → `treeitem` "JSON path (Payload)" → form: `items[` → lỗi tại chỗ, không request; `Amount` + Number + `_eq` 6000 → bảng đúng; lưu bookmark, reload, mở bookmark → cùng bảng; sửa path/kiểu qua chip; bàn phím toàn luồng; axe không vi phạm | `proxy-api`, `cors`: lọc đúng; `proxy-directus`: Apply → notice lỗi `INVALID_QUERY`, bảng giữ nguyên |
| cùng file | drawer: item `bo_content` → chọn `author` → lọc `tags › [*] (Text) = <tag>` (tag gán qua API) → chỉ user đó | như trên |
| cùng file | Files, Users, Settings > Policies: danh sách field không có "JSON path", có `Count` | ba cấu hình |
| `src/allowed-paths.ts` | path tạo collection/field nếu thiếu | — |
| `modules/content/a11y.browser.test.ts` | popover bộ lọc với form JSON path, trạng thái lỗi | sáng/tối |

## Unit web (`apps/web`, lượt 2)

`FieldList.test.ts` (hàng JSON path chỉ khi prop, nhãn, emit placeholder, qua m2o), `SystemFilter.test.ts` (parse/hiển
thị hàng json, toán tử theo kiểu, form thêm với lỗi và không emit, sửa path/kiểu, hàng trong nhóm, key m2o),
`SystemFilter.browser.test.ts` (bàn phím), `utils.test.ts` (`splitFieldPath`, path có chấm), `utils/json-path.test.ts`,
`SearchInput.test.ts`, `DrawerCollection.test.ts` (prop), `lang/overlay.test.ts` (tự động). Coverage FE ≥ 60 % giữ.

## Benchmark (`tests/benchmark`, lượt 3, chạy tay)

`seed-items.ts` thêm `payload`; `items.ts` khối chỉ Backoffice: `GET /items/bench_articles?filter={"json(payload,
Amount, number)":{"_eq":6000}}&limit=25&fields=id,title` không index và có expression index (biểu thức R4), gate lỗi,
bảng riêng, `EXPLAIN`; `web-content.ts` một dòng 8172 reported-only. SC-006: scenario hiện có vẫn ≤ 10 %.
