# Research: Lọc item theo path trong field json (023)

Đọc code ngày 2026-10-27. SQL Postgres thử trên container `postgis/postgis:13-3.4-alpine` tạm (bảng `p(id, j json, b
jsonb)`), SQLite thử bằng package `sqlite3` của `apps/api` (SQLite 3.44.2); kết quả ghi **[Đã thử]**. Mục ghi [Inference]
hoặc [Unverified] là suy ra từ code, có task kiểm ở lượt 1.

## R1. Vì sao key `json(field, path, type)` bị 400 hôm nay, và chỗ sửa gốc

**Hiện trạng** (`apps/api/src`): `parseFilterKey` (`utils/parse-filter-key.ts:9-21`, port nguyên văn) trả
`fieldName = "transaction_data, Amount, number"` cho key `json(transaction_data, Amount, number)`. Hai chỗ chết trước
khi có SQL:

1. `permissions/modules/process-ast/lib/extract-fields-from-query.ts:56` đưa tên đó vào field map →
   `validatePathExistence` (`process-ast.ts:29, :52`) ném Forbidden, kể cả admin.
2. `database/run-ast/lib/apply-query/filter/get-filter-type.ts:12-13` ném `Invalid filter key`.

Ngoài ra `getOutputTypeForFunction('json')` là `undefined` (`libs/utils/src/shared/get-output-type-for-function.ts:6-16`,
cùng thiếu như Directus), nên `validateOperator` rơi vào danh sách toán tử mặc định.

**Decision**: sửa một lần ở gốc: `parseFilterKey` khi `functionName === 'json'` trả `fieldName` = tham số đầu
(`group3.split(',')[0].trim()`), comment `// Backoffice (spec 023)`. Kéo theo: quyền đọc được kiểm trên field json gốc
(FR-009) ở mọi chỗ dùng `extractFieldsFromQuery` (filter, sort, aggregate); `get-filter-type.ts` nhận đúng field.
`convert-wildcards.ts:62` (alias tới `json(...)` trong `*` của `fields`) **giữ hành vi Directus** (checklist CHK009:
request không có json filter không được đổi): file đó gọi `parseFilterKey(key, { jsonBaseField: false })` hoặc giữ
regex cũ tại chỗ; hành vi mới chỉ cho filter/sort/aggregate. Hệ quả ghi D-184.2: `sort=json(f, p)` hết lỗi kiểm quyền
path (Directus lỗi [Inference], kiểm ở parity lượt 1) và `fields=json(f, p, type)` trả giá trị có kiểu (Directus trả
null vì path `"p, type"`); `parseJsonResult` chuẩn hóa boolean/number về JSON trên cả hai vendor. Rồi
`get-filter-type.ts:18-27` thêm nhánh
json: `parseJsonFunction(key)` → `type` ánh xạ text → `'string'`, number → `'float'`, boolean → `'boolean'` (ba `Type`
có sẵn, nên `getFilterOperatorsForType` và `validateOperator` không đổi: string có `contains`, `starts_with`, `empty`...;
float có `gt`, `between`...; boolean có `eq`, `neq`, `null`, `nnull`). `type` lạ: `InvalidQueryError`.

**Rationale**: mọi caller của `parseFilterKey` (`get-filter-type`, `extract-fields-from-query`,
`get-column-pre-processor`, `convert-wildcards`) đều muốn tên field gốc; sửa từng caller là lặp.

**Alternatives considered**: nhánh riêng trong `extract-fields-from-query` và `get-filter-type` (hai chỗ, dễ lệch);
thêm `json` vào `getOutputTypeForFunction` (kiểu phụ thuộc tham số, không phụ thuộc tên hàm, nên không đặt ở đó).

## R2. Cú pháp: `parseJsonFunction` nhận 2–3 tham số, `[*]` chỉ trong filter

**Hiện trạng** (`database/helpers/fn/json/parse-function.ts`): tách ở dấu phẩy **đầu tiên** (L45), path là phần còn
lại, nên `json(f, Amount, number)` hôm nay cho path `.Amount, number` → Postgres `->'Amount, number'` và SQLite
`json_extract(x, '$.Amount, number')` trả NULL im lặng **[Đã thử]**. Regex L62 cấm `[]`, `*`, `?`, `@`, `$`, nên `[*]`
bị `unsupported path expression`. Depth tính số `.` và `[` so với `MAX_JSON_QUERY_DEPTH` (mặc định 10).

**Decision**: `parseJsonFunction(functionString, options?: { allowWildcard?: boolean })` trả `{ field, path, type }`:
tách dấu phẩy thành 2 hoặc 3 phần (nhiều hơn: 400 `Invalid json() syntax`); phần 3 phải là `text | number | boolean`,
thiếu là `text` (FR-001); `[*]` chỉ hợp lệ khi `allowWildcard` (filter: `get-filter-type`, `operator.ts`), đúng một
lần, tính 1 vào depth; `fields`/`sort` (`parse-current-level.ts:24`, `get-unaliased-field-key.ts:22`,
`get-column.ts:58`) giữ cấm `[*]`. Thêm `splitWildcard(path)` → `{ before, after }` cho R4.

Key trong URL: `qs` (`app-pipeline.ts:41-45`, depth 10) cắt `[`/`]` trong tên key **[Đã thử]**:
`filter[json(t, items[*].sku, text)][_eq]=A` thành `{"filter[json(t, items": {"*": ...}}`; dấu chấm, phẩy, ngoặc tròn
và khoảng trắng thì giữ nguyên. Path có `[..]` phải gửi `filter` dạng JSON (`?filter={"json(t, items[0].sku, text)":
{"_eq": "A"}}`), là dạng app web và SDK dùng. Ghi vào quickstart và spec (Sửa spec khi plan).

## R3. `applyOperator`: tách key ở dấu chấm đầu, biểu thức có kiểu, toán tử dùng `selectionRaw`

**Hiện trạng** (`database/run-ast/lib/apply-query/filter/operator.ts`): `key.split('.')` ở L34 và L96 cắt
`alias.json(t, a.b, number)` thành `json(t, a` (mất phần sau). Ép kiểu giá trị: theo `getOutputTypeForFunction` (L86-93,
json = undefined) rồi theo kiểu field (L96-113, bỏ qua vì `json(...)` không có trong `fields`), nên `"5"` từ query
string vẫn là chuỗi. `parseFilter` đã đổi `'true'`/`'false'`/`'null'` thành boolean/null
(`libs/utils/src/shared/parse-filter.ts:34-40`). Bốn toán tử dùng thẳng `key` làm identifier thay vì `selectionRaw`:
`_empty`/`_nempty` (L61-71), `_starts_with`/`_nstarts_with` (L147-153), `_ends_with`/`_nends_with` (L163-169) → với key
hàm thành `"alias"."json(...)"`, SQL sai (lỗi có sẵn của bản port, chỉ lộ ra với hàm trả string). `_regex`, `_ieq`
không nằm trong danh sách toán tử nên `validateOperator` chặn trước.

**Decision**:

1. Tách key ở dấu chấm **đầu tiên** (alias bảng không có dấu chấm) ở cả hai chỗ.
2. Ép giá trị theo kiểu json: number → `castToNumber` (như integer/float), text và boolean giữ nguyên (boolean đã được
   `parseFilter` đổi).
3. `selectionRaw` cho key json có `type` là **biểu thức có kiểu** của dialect (R4): `fn.json(table, field, { jsonPath,
   jsonType })` qua `getColumn` như hôm nay (thêm `jsonType` vào `FnHelperOptions`). Nhờ vậy mọi toán tử của
   `applyOperator` (`=`, `like`, `LOWER(??)`, `>`, `between`, `in`, `is null`) chạy nguyên trên biểu thức đó, không
   viết lại từng toán tử.
4. Bốn toán tử dùng `key` chuyển sang `selectionRaw` (với cột thường `getColumn` trả `knex.ref(table.column)`, SQL
   không đổi; test `operator.test.ts` hiện có kiểm điều này).
5. `[*]` (R4): tách phần thân toán tử (từ L43 tới cuối) thành `applyWhere(builder, selectionRaw, operator, compareValue,
   logical)`; `applyOperator` gọi nó trên `dbQuery` với cột, hoặc trên subquery `whereExists` với biểu thức phần tử.

**`_null` và `_empty` trên path có kiểu** (quyết định câu chữ, Sửa spec khi plan): biểu thức có kiểu là SQL NULL khi
field null, path không có, giá trị JSON `null`, hoặc giá trị **khác kiểu đã chọn**; `_null` khớp đúng các trường hợp
đó, `_nnull` khớp phần còn lại; `_empty` (Text) = NULL hoặc `''` như field chuỗi của Directus. Một biểu thức, một nghĩa
cho cả hai vendor (Postgres `#>` giữ JSON null là giá trị json, nhưng `json_typeof` = `'null'` ≠ kiểu chọn nên vẫn ra
SQL NULL; SQLite `json_type` = `'null'` tương tự).

**Alternatives considered**: nhánh riêng trong `applyOperator` viết lại SQL từng toán tử cho json (gấp đôi bảng toán
tử, lệch dần với bản port); `jsonpath` của Postgres (`jsonb_path_exists`, cần PG ≥ 12, profile `postgres10` của parity
dùng PG 10; CockroachDB không có).

## R4. SQL theo vendor: Postgres (json, jsonb) và SQLite; vendor khác 400

**Postgres** (`database/helpers/fn/dialects/postgres.ts`; `postgres`, `redshift`, `cockroachdb` cùng dùng
`FnHelperPostgres`, `fn/index.ts:2-8`). `json()` hiện trả `??::json->?->?` (json/jsonb, không phải text) nên `= ?`
không so được với chuỗi. `buildPostgresJsonPath` dùng `lodash.toPath`, số bind kiểu number: với tham số không có OID
(driver `pg`), `json -> $1` chọn `text` nên `'0'` là khóa, không phải chỉ số **[Đã thử]** `prepare q(text) ... j -> $1`
với `'0'` trả NULL. Dùng `#>`/`#>>` với `text[]` thì `'0'` là chỉ số mảng, dấu chấm trong tên khóa (`a.b`) vẫn đúng
**[Đã thử]**.

**Decision**, biểu thức có kiểu `T(X)` với `X = ??.?? #> ARRAY[?, ?, ...]::text[]` (mỗi đoạn path một binding chuỗi;
`#>` tồn tại cho cả `json` và `jsonb`, nên không ép `::jsonb`, giữ kiểu cột để expression index khớp), `TY` =
`json_typeof` hoặc `jsonb_typeof` theo `dbType` (như `count()` hôm nay):

| `type` | Biểu thức | [Đã thử] PG 13 |
|--------|-----------|----------------|
| text | `CASE WHEN TY(X) = 'string' THEN X #>> '{}' END` | `"6000"` → `6000` (text), số 6000 → NULL |
| number | `CASE WHEN TY(X) = 'number' THEN (X #>> '{}')::numeric END` | 6000 → `6000`, `"6000"` → NULL, JSON null → NULL, thiếu path → NULL |
| boolean | `CASE WHEN TY(X) = 'boolean' THEN (X #>> '{}')::boolean END` | `true` → `t` |

`[*]` (path `before[*]after`): `EXISTS (SELECT 1 FROM json_array_elements(CASE WHEN TY(A) = 'array' THEN A ELSE
'[]'::json END) AS bo_json_elem(v) WHERE <applyWhere trên T(bo_json_elem.v #> ARRAY[after...])>)` (`jsonb_array_elements`
và `'[]'::jsonb` với cột jsonb). Guard `CASE` là bắt buộc: không guard thì `cannot call json_array_elements on a
scalar` làm lỗi cả query **[Đã thử]**; có guard: `items: []`, `items: "notarray"`, field null đều không khớp
**[Đã thử]**. Expression index `CREATE INDEX ON t (((j #>> ARRAY['Amount'])::numeric))` và `((b #>> '{Amount}'))` tạo
được **[Đã thử]**; khớp với biểu thức của app hay không: đo ở benchmark (R11) [Unverified].

**Vendor gate**: `getDatabaseClient(knex)` (`database/index.ts:247-269`) phải là `'postgres'` hoặc `'sqlite'`; `cockroachdb`
và `redshift` dùng chung helper Postgres nên gate đặt theo client, không theo class. Đặt ở `FnHelper` gốc
(`fn/types.ts`): `json()` nhận `jsonType` → helper gốc có `assertJsonFilterSupported(client)` ném `InvalidQueryError`
`Filtering by a JSON path is not supported on <client>` (FR-008); postgres (client `postgres`) và sqlite đi tiếp; mysql,
mssql, oracle gọi assert ở đầu `json()` khi có `jsonType`. `fields=json(f, p)` (không `type`) không đổi trên mọi vendor.

**SQLite** (`dialects/sqlite.ts`, `json_extract(??.??, ?)` với `'$' + path`). `json_type(col, '$.a[2]')` trả `'true'`,
`'integer'`, `'real'`, `'text'`, `'null'`, SQL NULL khi thiếu path **[Đã thử]**; `json_extract` trên text không phải
JSON lỗi `malformed JSON` **[Đã thử]**; `json_each` trên scalar trả 1 dòng (chính scalar) nên cần guard `array`
**[Đã thử]**; `json_type(e.value, '$.sku')` lỗi khi phần tử là chuỗi (`e.value` là TEXT thường) **[Đã thử]** → với
suffix sau `[*]` dùng `e.fullkey || ?` trên cột gốc thay vì `e.value`.

| `type` | Biểu thức (`P` = `'$' + path` bind) |
|--------|-------------------------------------|
| text | `CASE WHEN json_type(V, P) = 'text' THEN json_extract(V, P) END`, `V = CASE WHEN json_valid(??.??) THEN ??.?? END` (Kết quả T001 c) |
| number | `... json_type(...) IN ('integer', 'real') THEN json_extract(...) END` |
| boolean | `CASE WHEN ... json_type(...) = 'true' THEN 1 WHEN ... = 'false' THEN 0 END` (knex bind `true` → 1) |

`[*]`: `EXISTS (SELECT 1 FROM json_each(??.??, P_before) AS bo_json_elem WHERE json_type(??.??, P_before) = 'array' AND
<applyWhere trên biểu thức với path = bo_json_elem.fullkey || P_after>)`; `json_valid` guard ở ngoài `json_each`
(`json_each` trên text không phải JSON lỗi **[Đã thử]**): `json_valid(??.??) AND EXISTS (...)`.

**API của helper** (`fn/types.ts`): `FnHelperOptions` thêm `jsonType?: 'text' | 'number' | 'boolean'`; `json()` trả
biểu thức có kiểu khi có `jsonType` (không có thì như hôm nay, kể cả `fields`); hai method mới chỉ postgres/sqlite cài:
`jsonArrayElements(table, column, { jsonPath })` → Raw cho `FROM`, và `jsonElement(options)` → Raw biểu thức có kiểu của
phần tử; helper gốc ném assert. `fields=json(f, p, number)` và `sort=json(f, p, number)` nhờ đó cũng ra giá trị có kiểu
(sort số đúng thứ tự) — mở rộng tự nhiên, ghi quickstart.

**Alternatives considered**: `::jsonb` cho mọi cột (một dạng SQL, nhưng index trên cột `json` không khớp);
`jsonb_path_exists` (PG 12+, R3); so sánh text không guard kiểu (chuỗi `"6000"` khớp Number, trái FR-004).

## R5. Quyền: field gốc, từ chối permission có path json khi lưu

**Field gốc**: sau R1, `validatePathPermissions` (`process-ast.ts:56-63`) kiểm `transaction_data` như lọc trực tiếp
(FR-009). Điều kiện hàng của permission đi qua `getCases` → `joinFilterWithCases` → cùng `applyFilter`
(`apply-query/index.ts:64-67`), nên row filter vẫn áp dụng.

**Từ chối khi lưu** (FR-011, D-185): `services/permissions.service.ts` override `createOne` (L41-47) và `updateMany`
(L65-71); mọi đường ghi (`updateOne` → `updateMany`, `createMany`/`updateBatch`/`upsertMany` qua `fork()` → `createOne`
/`updateOne`, `updateByQuery`, nested write từ policies qua `getService('directus_permissions')`) đều qua hai hàm đó.
Thêm `assertNoJsonPathFilter(data)` trước `super`: `parseJSON` `data.permissions` và `data.validation` nếu là chuỗi, đi
qua `flattenFilter` (`permissions/modules/process-ast/utils/flatten-filter.ts:5-37`, đã xử lý `_and`/`_or`/`_some`/
`_none`), path part nào bắt đầu bằng `json(` → `InvalidPayloadError` (mẫu `PoliciesService.assertValidIpAccess`,
`policies.service.ts:41-47`). GraphQL system mutation `create_permissions_item`/`update_permissions_item` gọi cùng
service → cùng lỗi. Không có validator filter nào sẵn (`validation` chỉ được parse ở `process-permissions.ts:16`).

`/fields`, `/flows`, `/operations`: không kiểm (clarify câu 5).

## R6. Sort và `fields` với tham số thứ ba

`applySort` (`apply-query/sort.ts`): path một phần không dấu chấm đi `getColumn` (L69-79) và chạy; `json(f, a.b)`
(L27 `split('.')`) và m2o `order.json(...)` (L110 thiếu `originalCollectionName`) **đã hỏng từ trước** [Inference];
`sanitizeSort` tách `,` (`sanitize-query.ts:134-143`) nên `?sort=json(f, p)` dạng chuỗi cũng hỏng; 403 của
`extractPathsFromQuery` hết sau R1. **Decision**: giữ nguyên phạm vi sort (spec: "sort đã chạy, không đổi"); R2 làm
`sort=json(f, p, number)` (JSON array hoặc không dấu phẩy) ra sort số. Sửa `split` paren-aware của sort: ngoài phạm vi,
ghi R12.

`payload.service.ts:398-410` chỉ parse kết quả `json()` trong `fields` (alias map từ AST), không liên quan filter.
Response cache: key từ toàn bộ query (`get-cache-key`), request có path json có key riêng.

## R7. GraphQL: `<field>_json` đổi về key REST **trước** `sanitizeQuery`

**Hiện trạng** (`services/graphql/schema/read.ts`): `<collection>_filter` ghép ở L448-510; json rơi vào
`StringFilterOperators` (default của `getGraphQLType`); `_func` cho json/alias ở L502-506 (`CountFunctionFilterOperators`,
= Directus `read.ts:494-498`). `<c>_quantifier_filter` clone sau vòng lặp (L735-744); m2o `addFields` L754-756; o2m
L778-784; m2a L806-816: field mới trên `_filter` tự có ở mọi chỗ lồng. Resolver: `query.ts:22` `parseArgs` →
`getQuery` (`schema/parse-query.ts`): `sanitizeQuery` L25 → `replaceFuncs` L172/174 (`utils/replace-funcs.ts:9-27`:
`key.endsWith('_func')` → `` `${fn}(${field})` ``). **`sanitizeQuery` → `parseFilter` bọc mọi lá không phải object
thành `{ _eq }` và object ≥ 2 khóa thành `_and`** (`libs/utils/src/shared/parse-filter.ts:86-98, 135-139`), nên `{
details_json: { path: "Amount", number: { _eq: 6000 } } }` qua sanitize thành `{ details_json: { _and: [{ path: { _eq:
"Amount" } }, { number: {...} }] } }` và `path` còn bị thay biến động. Mutation (`mutation.ts:20`) đưa `args` của
graphql-js (object prototype null, `valueFromAST.js:120`) thẳng vào `getQuery`.

**Decision**:

- `read.ts`: sau L433 tạo `JsonPathFilterOperators = createInputTC({ name: 'json_path_filter_operators', fields: {
  path: String!, text: StringFilterOperators, number: NumberFilterOperators, boolean: BooleanFilterOperators } })`;
  trong reduce sau L506: `if (field.type === 'json' && gql.scope === 'items' && !(`${field.field}_json` in
  collection.fields)) acc[`${field.field}_json`] = { type: JsonPathFilterOperators }`. Không dùng `@oneOf` (graphql
  16.12 có, nhưng bắt mọi field nullable, `path` là `String!`, và thêm directive vào SDL): "đúng một trong
  text/number/boolean" kiểm ở bước đổi key. Type chỉ in ra SDL khi có field dùng (graphql-compose `getFromSchema.js:9-26`),
  `/graphql/system` không có vì `scope` check.
- `utils/replace-funcs.ts` thêm `replaceJsonPaths(filter)`: key `endsWith('_json')`, value `isPlainObject` (lodash,
  vì prototype null) có `path` chuỗi → đúng một trong `text|number|boolean` (khác: `InvalidQueryError`) → `result['json(<f>,
  <path>, <type>)'] = value[type]`; đệ quy object/array (`_and`/`_or`/`_some`/`_none`, m2o lồng); `{ foo_json: { path: {
  _eq } } }` (field m2o tên `foo_json` có field `path`) giữ nguyên vì `path` không phải chuỗi.
- Gọi **trước** `sanitizeQuery` ở ba chỗ: `parse-query.ts:25` (query và mutation), `parse-query.ts:160` (args của
  field quan hệ lồng → `deep`), `utils/aggregate-query.ts:19`. `parse-query.test.ts:50-52` mock `replace-funcs.js` chỉ
  có `replaceFuncs` → thêm `replaceJsonPaths: vi.fn((v) => v)`.
- Schema cache (`schema-cache.ts:10-14`, key `${scope}_${type}_${role}_${user}`, clear trên bus `schemaChanged`): không
  đổi.
- OAS: `filter` là `$ref` object tự do (`libs/specs/src/parameters/filter.yaml`), không có schema toán tử theo
  collection → không đổi.

Mở: `*_json` cũng xuất hiện trên collection hệ thống có field json (`directus_users.tags`? `directus_settings`...)
chạm tới từ scope items qua quan hệ. Giữ (FR-006 m2o), normalizer bỏ chúng (R9).

**Alternatives considered**: lồng vào `_func` (đổi `count_function_filter_operators` dùng chung với alias → collection
không có json cũng lệch); scalar `JSON` (không kiểm cấu trúc); đổi key trong `replaceFuncs` (sau sanitize: sai, R7
đoạn hiện trạng).

## R8. Web: FieldList, system-filter, SearchInput, DrawerCollection

**Hiện trạng** (`apps/web/src`): `FieldList.vue` (props L32-62, không có cờ ngữ cảnh) dựng hàng `function` ở L207-209
từ `getFunctionsForType(field.type)` của `@directus/utils` 13.4.1 (json → `['count', 'json']`), nhãn
`` `${$t(`functions.${row.fn}`)} (${displayName(row.node)})` `` L397, emit `` `${row.fn}(${row.node.key})` `` L280 (json
→ `json(meta)` hoặc `json(author.meta)` qua m2o, không có path). `SystemFilter.vue` không có prop `includeFunctions`,
luôn truyền `include-functions` cho FieldList (L239) và Nodes (L447); `addNode` L118-121 với key có ngoặc:
`getOutputTypeForFunction(fn)` (json → `undefined` → danh sách toán tử mặc định, nên ảnh "functions.json ... Contains")
rồi `set({}, key, ...)` L143. `Nodes.vue`: `getFieldPreview` L132-166 tách `.`, `getCompareOptions` L279-305,
`isExistingField` L307-320, `updateComparator` L196-248 `get(node, field + '.' + comparator)`; node đệ quy L556-566
chỉ truyền `filter, collection, depth, inline, rawFieldNames, variableInputEnabled`. `InputGroup.vue`: `fieldInfo` L42-59
null với key hàm, `interfaceType` fallback `'string'`, `fieldValue` L91-93 `get` chấm. `SearchInput.vue` (L225 render
`SystemFilter inline`), gọi từ `CollectionRoute.vue:417`, `DrawerCollection.vue:203` (cũng bao `DrawerFiles` và mọi
interface quan hệ), và 11 chỗ khác (Files, Users, Activity, Notifications, Presets, Translations, Insights, Roles,
Policies, Data Model, FieldDetail). SystemFilter qua interface `system-filter`: permissions (`PermissionsTab.vue:44`,
`ValidationTab.vue:44`), `AdvancedValidation.vue:43`, `AdvancedConditions.vue:50`, `PresetItemRoute.vue:441`, 9 panel
Insights, 9 options của interface quan hệ/file, và `ExportSidebarDetail.vue:735-739` (bộ lọc của export). Flows không
dùng FieldList (condition là `input-code`).

**Lỗi chặn (code dùng chung)** **[Đã thử lodash trong apps/web]**: `get`/`set` với chuỗi path tách ở `.` và `[`, nên key
`json(meta, items[0].sku, text)` hỏng ở `utils.ts:24` (`getComparator`), `:28` (`fieldToFilter`, `split('.')`),
`SystemFilter.vue:143`, `Nodes.vue:134, :200-201, :257-258, :312`, `InputGroup.vue:92`; `get(node, [k, '_eq'])` (path
mảng) và `split(/\.(?![^(]*\))/)` (tách chấm ngoài ngoặc) chạy đúng.

**Decision**:

1. `system-filter/utils.ts`: thêm `splitFieldPath(key) = key.split(/\.(?![^(]*\))/)` và dùng path **mảng** cho
   `get`/`set` ở mọi chỗ trên; `SystemFilter.addNode` dùng `fieldToFilter(key, '_' + op, value)` thay `set({}, key)`.
   Key không có chấm trong ngoặc (`year(x)`, `a.count(b)`) cho kết quả như cũ (test `utils.test.ts`).
2. `apps/web/src/utils/json-path.ts` (+ test): `parseJsonPathKey(key) → { field, path, type } | null`,
   `formatJsonPathKey(field, path, type)`, `jsonPathError(path) → string | null` (ngữ pháp của R2: 2–3 tham số, `[*]`
   một lần, ngoặc vuông cân, depth ≤ 10; `apps/web` không có `@backoffice/*` nên là bản chép, test chép case của
   `parse-function.test.ts`), `jsonFilterType(type)` → `'string' | 'float' | 'boolean'`.
3. Prop `includeJsonPath` (mặc định `false`): `FieldList` (L177 lọc `fn !== 'json' || props.includeJsonPath`; nhãn L397
   `row.fn === 'json' ? $t('json_path') : ...`; emit giữ `json(<key>)` làm placeholder) → `SystemFilter` (truyền ở L236
   và L199) → `Nodes` (L444 và node đệ quy L556) → `SearchInput` (L225) → bật **chỉ** ở `CollectionRoute.vue:417` và
   `DrawerCollection.vue:203` (FR-013, FR-015, D-187). Bộ lọc của `ExportSidebarDetail` không bật (ghi "Sửa spec khi
   plan"); mọi chỗ khác mất mục `json` gây 400 hôm nay, giữ `count`.
4. Form path + kiểu `JsonPathForm.vue` (`system-filter/`): `BoInput` path (label, `error` liên kết `aria-describedby`,
   `role=alert`) + `BoSelect` kiểu (Text/Number/Boolean) + nút Add/Apply + link quay lại danh sách field; dùng ở hai
   chỗ: (a) `SystemFilter` khi nhận placeholder `json(<key>)` (không có dấu phẩy): đổi nội dung `PopoverContent`
   L235-268 từ FieldList sang form, chỉ gọi `addNode(json(field, path, type))` khi path hợp lệ (US2-3: không gửi
   request); (b) `Nodes` với hàng json: popover của chip field (L443-455) mở form điền sẵn, Apply → `replaceNode`
   (L272) với key mới, đổi kiểu thì đặt lại toán tử về toán tử đầu của kiểu và xóa giá trị. Không đặt form trong
   `treeitem` của FieldList (phá roving tabindex). Chip hàng json chỉ sửa được khi `includeJsonPath`; hiển thị thì
   không gate (Settings > Presets, export sidebar thấy và giữ hàng đã lưu).
5. Hàng json trong `Nodes`: `getFieldPreview` nhánh json → `Field › path (Type)` (`displayName(field)` + path + nhãn
   kiểu); `getCompareOptions` và `SystemFilter.addNode` lấy kiểu qua `jsonFilterType`; `updateField` so kiểu đã giải
   (không `fieldsStore.getField`); `isExistingField` dùng `splitFieldPath`; `InputGroup.fieldInfo` trả field giả `{
   type }` để `interfaceType` ra input/number/boolean toggle (InputComponent `v-if="type === 'boolean'"`). Giá trị
   number từ InputComponent là chuỗi: API ép theo `type` (R3), UI không đổi.
6. i18n: `apps/web/src/lang/overlay/{en-US,vi-VN}.ts` là khóa phẳng, merge nông, `overlay.test.ts` cấm khóa trùng
   base (nên không đặt `functions.json`). Thêm (comment `// Spec 023 (D-187)`): `json_path` "JSON path" / "Đường dẫn
   JSON", `json_path_type_text` "Text" / "Chữ", `json_path_type_number` "Number" / "Số", `json_path_type_boolean`
   "Boolean" / "Đúng/Sai", `json_path_invalid` "Invalid JSON path" / "Đường dẫn JSON không hợp lệ", `json_path_apply`
   "Apply" / "Áp dụng" (nếu base chưa có `apply`; kiểm khi implement). File JSON sinh bởi `sync-translations.mjs` không
   sửa tay (test checksum).
7. Design-system: không component mới ngoài form ghép từ recipe Input (`component-specs.md` L110-126) và Select
   (L128-146) trong popover Q-7 (L1265-1312); thêm một gạch đầu dòng "JSON path form" vào mục Q-7; không màu mới nên
   `migration-guide.md` (bảng contrast, Decisions C/L/B) không có dòng.

**Alternatives considered**: nhập path ngay trong hàng FieldList (phá tree pattern); emit key có `type` mặc định rồi sửa
sau (gửi request với path rỗng → 400); `functions.json` trong overlay (overlay test cấm, merge nông ghi đè cả
`functions`).

## R9. Bookmark/preset và drawer

`use-preset.ts` L148-151 → `updatePreset({ filter })` → `stores/presets.ts` POST/PATCH `/presets` body JSON, không
biến đổi key → `json(field, path, type)` lưu nguyên trong `directus_presets.filter` [Inference, FR-016]. `use-items.ts`
L93/L225 gửi `filter` qua SDK (JSON) nên path có `[..]` không qua `qs` (R2). `DrawerCollection.vue:60` dùng preset tạm
(`usePreset(collection, ref(null), true)`), không lưu. Settings > Presets (`PresetItemRoute.vue:441`, `rawFieldNames`)
hiện hàng json đã lưu, không có mục thêm (prop mặc định `false`).

## R10. Parity: file mới `items/json-path.test.ts`, D-184 dạng `http`, jsonb, vendor

**Hiện trạng** (`tests/parity`): mỗi file tự tạo collection qua Directus (`createUserCollection`, `createField`,
`cleanup()` ở `src/permissions/fixtures.ts:221-261`); `parity(req)` (`src/parity.ts:375`) gửi cả hai app, `compare`
(`:176`) so status, header, body đã `normalizeBody`; `assertParity` (`:414`) ném khi còn khác biệt không được chấp
nhận; mục `kind: 'http'` lọc theo `endpoints` (bỏ query string, `:98`), `when: { directusStatus, directusCode,
backofficeCode }` (`:327-329`), `location: { any: true }`; mẫu "Directus X / Backoffice Y" tường minh ở
`items/crud.test.ts:301-309`. File chạy theo glob tường minh `src/suite.ts` (`REDUCED_FILES` L13, `FULL_FILES` L41).
Blackbox `json-fields.test.ts` chạy hai lượt cùng assertion (`PARITY_BLACKBOX_APP`), nên **không thêm** case filter
vào đó. Không có `jsonb` ở đâu trong tests; `hostDb()` (`src/auth/db-effects.ts:10`) chạy DDL thô, tiền lệ "đổi sau
lưng Directus" `src/schema/sync.test.ts:114-116`, rồi `POST /utils/cache/clear?system` ở Directus (bus chung xóa cache
Backoffice). Vendor: `getDbsToTest()[0]` (`src/get-dbs-to-test.ts:17`); CI `parity` chạy `reduced` cho sqlite3 và mysql,
`full` Postgres 2 shard; `nightly.yml` chạy `full` trên maria, mssql, oracle, cockroachdb, postgres10.

**Decision**:

- File mới `src/items/json-path.test.ts` (thêm vào `REDUCED_FILES` và `FULL_FILES`): collection
  `parity_json_path_<run>` với field `transaction_data` (json, `cast-json`) và m2o `order` tới collection thứ hai có
  json; dữ liệu theo spec (6000, 7000, `"6000"`, thiếu, null, `"abc"`, `dimensions.width`, `items[*].sku`, mảng rỗng,
  `items` không phải mảng, khóa `a.b`). Request: `GET /items` với từng kiểu/toán tử, `_and`/`_or`, m2o, `[*]`, `_null`,
  `SEARCH /items`, `?export=csv`, `POST /utils/export`, `meta=filter_count`; kiểm `result.accepted` có `D-184` cho
  request json path và `[]` + `assertParity` cho request đối chứng (cùng collection, không json path). Trên Postgres:
  sau các case với cột `json`, `ALTER TABLE ... ALTER COLUMN transaction_data TYPE jsonb USING ...::jsonb` qua
  `hostDb()`, xóa cache hệ thống, chạy lại cùng case (FR-008). Vendor ngoài postgres/sqlite3: Directus 403 `FORBIDDEN`,
  Backoffice 400 `INVALID_QUERY` (D-184 cũng chấp nhận), kiểm message của Backoffice nêu vendor.
- `accepted-differences.ts`: `D-184` `kind: 'http'`, `feature: '023'`, `endpoints: ['GET /items/parity_json_path_*',
  'SEARCH /items/parity_json_path_*', 'POST /utils/export/parity_json_path_*']`, `location: { any: true }`, `when: {
  directusStatus: 403, directusCode: 'FORBIDDEN' }` (T002; scope theo tiền tố collection, tránh chấp nhận mọi 403);
  `D-185` `http` cho `POST /permissions`, `PATCH /permissions/*` với `when: { backofficeCode: 'INVALID_PAYLOAD' }` và
  test gửi riêng từng app (xóa permission Directus đã lưu); `D-184.1`, `D-186`, `D-187` `kind: 'doc'`, lý do trỏ
  normalizer (D-186). `spec-differences.ts` đọc cột `Mã` và cột cuối của bảng spec 023 (7 cột, `—`) như hiện có.
- `normalizers.ts` (D-186): `/graphql` introspection bỏ type `json_path_filter_operators` và `inputFields` có
  `type.name` đó (hàm D-181 chỉ lọc `fields`, L103-119); SDL (`withoutBackofficeSdl` L241-255 và
  `withoutBackofficeSpecs` L94-97 vì `server_specs_graphql(scope: items)` trả SDL items): bỏ khối `input
  json_path_filter_operators {...}` và dòng `  <f>_json: json_path_filter_operators`; `parity.ts:195-200` thêm
  `json_path_filter_operators` vào điều kiện bỏ so ETag; sắp xếp type introspection khi Backoffice có type này
  (`sortIntrospectionTypes`, L225-230) [Inference: thứ tự type theo depth-first từ Query có thể đổi khi
  `string_filter_operators` được chạm tới qua `json_path_filter_operators` trước]. Test ở `normalizers.test.ts`,
  `parity.test.ts` cạnh case D-181.
- GraphQL (`graphql/read.test.ts`): Directus từ chối `*_json`, nên không vào danh sách `sameGql`; thêm case chỉ
  Backoffice so GraphQL với REST tại Backoffice (mẫu blackbox L128-137): top level, m2o `category { ... }`, `_and`/`_or`;
  `schema/index.test.ts` thêm `details` json vào `articles` và kiểm `articles_filter.details_json`, SDL system không có
  type mới.

## R11. E2E ba cấu hình và fixture

**Hiện trạng** (`apps/web-e2e`): một `playwright.config.ts`, `E2E_CONFIG` ∈ `proxy-directus` (8161, API là Directus →
json path 400), `proxy-api` (8162), `cors` (web 8181 → API 8163); `content-*.spec.ts` không `@core` chạy chromium;
`payload/*.spec.ts` chỉ proxy-api; `requests.ts` `test` fail khi gọi path ngoài allowlist hoặc thiếu khóa i18n.
`content-filter-bookmark.spec.ts` L89-114: `Filter` → `Add Filter` → `treeitem` → textbox → chờ `PATCH /presets/:id`.
`bo_content` (`apps/web/fixtures/interfaces/seed.mjs:1314-1360`) **không có field json**; thêm field thì phải sinh lại
snapshot (`export.mjs`, `fields.json`, `items.bo_content`, `expected.content.*`) và `tests/parity/src/web/fixtures-seed.test.ts`.
`directus_users.tags` là json, chạm tới từ `bo_content.author` qua drawer. `content-navigation.spec.ts:64-72` tạo/xóa
collection bằng `AdminApi` (`helpers/api.ts:10`).

**Decision**: spec mới `content-filter-json-path.spec.ts`: tạo collection riêng `bo_json_<run>` qua `AdminApi` (field
json + vài item theo spec, xóa cache ở mọi API như `content-navigation`), không sửa `bo_content` và snapshot; luồng US2
bằng chuột và bàn phím (Tab/Enter tới `treeitem` "JSON path (…)", form, lỗi path `items[`, Apply, bảng lọc, lưu bookmark,
tải lại, mở bookmark); drawer (US3): mở item `bo_content`, chọn `author` → DrawerCollection của `directus_users`, lọc
`tags › [*] (Text) = <tag>` sau khi gán tag cho một user qua API; kiểm mục "JSON path" **không** có ở Files, Users,
Settings > Policies (một case). Cấu hình `proxy-directus`: sau Apply, mong lỗi API (notice `INVALID_QUERY`, D-184.1) và
bảng giữ nguyên; `proxy-api`, `cors`: lọc đúng. Allowlist `allowed-paths.ts` thêm path tạo collection nếu chưa có.
Payload suite: không có case (Directus app không tạo được bookmark json, D-187).

## R12. Benchmark: seed có cột json, đo riêng Backoffice, có và không có index

**Hiện trạng** (`tests/benchmark`): `seed-items.ts` tạo `bench_articles` (`title`, `status`, `body`, `category` m2o,
`date_created`; `INSERT ... SELECT generate_series`, `BENCH_ITEMS_ROWS` 10 000 000) qua Directus, **không có cột json**;
`items.ts` `Scenario {name, method, path, user, fresh}`, `measure()` autocannon 50 kết nối, `compare()` 10 % trên p95,
req/s, CPU (`compare.ts:88-135`, `TOLERANCE`), `notBlocking` vẫn đo Directus; workflow `benchmark.yml` job
`benchmark-items` (`:108-135`, `BENCH_ROUNDS` 3); `web-content.ts` đo ba app (Directus app 8173, web → Directus 8171,
web → API 8172), gate `webSlower` 10 % và 25 ms.

**Decision**: `seed-items.ts` thêm field `payload` (json, `cast-json`) và `json_build_object('Amount', g % 10000,
'Currency', 'VND')` vào INSERT (seed của `items`, `graphql`, `web-content` cùng lớn thêm; policy user đọc thêm
`payload`); `items.ts` thêm khối sau các scenario so sánh: đo **chỉ Backoffice** `GET
/items/bench_articles?filter={"json(payload, Amount, number)":{"_eq":6000}}&limit=25&fields=id,title` (admin,
`no-store`) `ROUNDS` vòng, gate chỉ `errors`, in bảng riêng vào `GITHUB_STEP_SUMMARY`; chạy hai lần: không index, rồi
sau `CREATE INDEX bench_articles_payload_amount ON bench_articles ((CASE WHEN json_typeof(payload #> ARRAY['Amount']) =
'number' THEN (payload #>> ARRAY['Amount'])::numeric END))` + `ANALYZE` (đúng biểu thức của R4 để planner khớp; `CASE`
bọc nên index trên `(payload->>'Amount')` **không** khớp [Inference]); log `EXPLAIN` để xác nhận index scan; ghi số đo
vào research "Kết quả lượt 3" và quickstart (hướng dẫn admin tạo index đúng biểu thức). `web-content.ts`: một dòng
chỉ ở 8172, reported-only (preset filter json path, 8171/8173 trả 400).

## R13. Tài liệu, CI, D-codes

- `tests/parity/README.md`: mục "Test items (feature 005)" thêm gạch đầu dòng 023 (`json-path.test.ts`, D-184..D-187,
  jsonb, vendor); quy trình "Thêm khác biệt được chấp nhận" đã có (L292-302).
- `deploy/README.md`: gạch đầu dòng cạnh L160 (tiền lệ D-137 `/extensions/sources/*` → `bo_pool`): ở shared-domain,
  request có json path rơi vào Directus nhận 403 (D-184), không thêm định tuyến; separate-domain và standalone không
  ảnh hưởng.
- `design-system/docs/migration-guide.md`: chỉ có dòng theo mã D khi có cặp màu mới (D-172, D-176); form JSON path dùng
  recipe Input/Select có sẵn → không có dòng; `component-specs.md` Q-7 thêm gạch đầu dòng (R8-7).
- CI: `ci.yml` `parity` (reduced sqlite3/mysql, full Postgres 2 shard) tự chạy file mới qua `suite.ts`; `e2e-web` tự
  lấy `src/**/*.spec.ts`; `benchmark.yml` tay/hằng tuần; `guard-differences` (`ci.yml:80-90`) kiểm bảng spec.
- CLAUDE.md "Active Technologies"/"Recent Changes" qua `update-agent-context.sh` (plan) và tay khi đóng (như 022).

## R14. Ba lượt lên `main`

1. **Lượt 1 (API REST + parity)**: R1–R6, `accepted-differences.ts` D-184/D-185, `json-path.test.ts`, `suite.ts`, unit
   API (`parse-filter-key`, `parse-function`, `get-filter-type`, `operator` với `Client_SQLite3` và `Client_PG` mới
   trong `apply-query/mock.ts`, `filter/index` m2o, `extract-fields-from-query`, `permissions.service`), blackbox
   `json-fields` xanh. Đóng lượt: lint, typecheck, `api:test`, parity Postgres + SQLite local, commit, push (phối hợp
   với phiên khác), CI xanh, `graphify update .`.
2. **Lượt 2 (Web + E2E)**: R8, R9, overlay i18n, unit web (`FieldList`, `SystemFilter`, `utils`, `json-path`,
   `SearchInput`, `DrawerCollection`, browser keyboard, axe), E2E `content-filter-json-path.spec.ts` ba cấu hình,
   `component-specs.md` Q-7. Đóng lượt như trên + `web:test`, `web:build`, E2E local proxy-api.
3. **Lượt 3 (GraphQL, parity introspection, benchmark, tài liệu)**: R7, normalizer D-186, `graphql/read.test.ts`,
   `schema/index.test.ts`, benchmark R12 (chạy tay `gh workflow run benchmark.yml -f job=benchmark-items`), README,
   deploy/README, CLAUDE.md, đóng spec (Status, D-codes duyệt câu chữ).

## R15. Điều chưa kiểm được khi khảo sát (task kiểm ở lượt tương ứng)

- [Unverified] knex `raw` với `??.?? #> ARRAY[?, ?]::text[]` sinh đúng `$n` và driver `pg` bind chuỗi trong `ARRAY[]`
  (lượt 1, unit `Client_PG` + parity Postgres).
- [Unverified] `whereExists` callback với `.from(knex.raw(...))` và `applyWhere` trên builder con (lượt 1).
- [Unverified] SQLite `bo_json_elem.fullkey || ?` ghép suffix sau `[*]` và `json_valid(NULL)` (NULL → `AND` false)
  (lượt 1, unit `Client_SQLite3` + parity sqlite3).
- [Unverified] Gate CockroachDB/Redshift qua `getDatabaseClient` (nightly cockroachdb).
- [Unverified] GraphQL `replaceJsonPaths` với args prototype null của mutation; thứ tự type introspection (lượt 3).
- [Unverified] Index trên biểu thức `CASE ...` được planner dùng (lượt 3, `EXPLAIN` trong benchmark).
- [Inference] `directus_presets.filter` lưu key nguyên văn (lượt 2, E2E bookmark).

## R16. Sửa spec khi plan (áp vào `spec.md` cùng commit plan)

- FR-001: thêm "path có `[`/`]` phải gửi `filter` dạng JSON (`?filter={...}` hoặc body), vì `qs` cắt ngoặc vuông trong
  tên key; app web và SDK gửi JSON" (R2).
- FR-004: nêu rõ "giá trị có kiểu" là SQL NULL khi field null, path không có, JSON `null` **hoặc giá trị khác kiểu đã
  chọn**; `_null` khớp đúng các trường hợp đó, `_nnull` phần còn lại; `_empty`/`_nempty` (Text) như field chuỗi
  (NULL hoặc `''`) (R3).
- FR-013/FR-015: bộ lọc của mục Export (detail panel trang Content) không có mục "JSON path", giữ hàng đã lưu (R8-3).
- FR-018/US2: ở cấu hình E2E `proxy-directus`, Apply cho lỗi API (D-184.1) và bảng giữ nguyên; `fields=json(f, p, type)`
  và `sort=json(f, p, type)` cũng trả giá trị có kiểu (R4) (ghi Edge Cases).
- Edge Cases: giá trị Text `true`/`false`/`null` từ query string bị `parseFilter` đổi kiểu như field chuỗi hiện nay (dùng
  `filter` JSON với chuỗi để lọc chuỗi `"true"`).
- D-186: `*_json` cũng có trên collection hệ thống có field json chạm tới từ scope items (`directus_users.tags`...);
  normalizer bỏ (R7).

## Kết quả T001 (2026-10-27, env parity Postgres 13 + package `sqlite3` 5.1.7 / SQLite 3.44.2)

- (a) `knex.raw('?::json #>> ARRAY[?, ?, ?]::text[]', ...)` với client `pg` sinh `$1..$4`; `'0'` là chỉ số mảng (kết quả
  `"A"`). `ARRAY[]::text[]` (path rỗng, `[*]` ở gốc) trả chính giá trị. Biểu thức có kiểu với binding JS number `6000` và
  boolean `true` so đúng. `numeric` về JS là **chuỗi** (`"6000.5"`) → `parseJsonResult` của `fields`/sort ép số theo `type`.
- (b) `whereExists(function () { this.select(knex.raw('1')).from(knex.raw('json_array_elements(CASE ... END) as ??(??)',
  [..., 'bo_json_elem', 'v'])).where(knex.raw(...), '=', 'A') })` sinh `where exists (select 1 from json_array_elements(...)
  as "bo_json_elem"("v") where CASE ... END = $8)` và chạy đúng (chỉ dòng có phần tử `sku` = "A"; `[]`, `"x"`, null không
  khớp).
- (c) SQLite: `json_type(col, ...)` trên text không phải JSON **lỗi `malformed JSON` kể cả khi có `json_valid(col) AND`
  phía trước** (optimizer tính `json_type(col, P)` của subquery trước, không theo thứ tự `AND`). Sửa R4: mọi chỗ dùng
  `V = CASE WHEN json_valid(col) THEN col END` thay cho `col` (`json_type(NULL, P)` = NULL, `json_each(NULL)` 0 dòng).
  Đã thử: number/text/boolean, `_null`, `[*]` với `fullkey || '.sku'`, `[*]` ở gốc (`$`, suffix rỗng), `!=` trên `[*]`,
  dòng `'not json'` không làm lỗi.
- (d) knex bind `true` trên `sqlite3` so được với `1` (`CASE ... WHEN 'true' THEN 1 ...`).
- Khóa có dấu chấm (`"a.b"`) không gọi được bằng path `a.b` ở cả hai vendor (Postgres `toPath` tách chấm, SQLite cần
  `$."a.b"`), giống `json()` của `fields` hiện nay; không thêm cú pháp (Edge Cases).

## Kết quả T002 (2026-10-27, Directus 11.17.4 ở env parity, admin)

| Request | Directus |
|---------|----------|
| `filter={"json(metadata, color)":{"_eq":"red"}}` | 403 `FORBIDDEN` `You don't have permission to access field "metadata, color" ...` |
| `filter={"json(metadata, n, number)":{"_eq":2}}` | 403 `FORBIDDEN` (field `"metadata, n, number"`) |
| `filter={"json(metadata)":{"_contains":"1"}}` | 400 `INVALID_QUERY` `Invalid json() syntax: requires json(field, path) format` |
| `sort=json(metadata,color)` (chuỗi, có/không khoảng trắng) và `sort=["json(metadata, color)"]` | 403 `FORBIDDEN` |
| `fields=id,json(metadata, n)` | 200, `metadata_n_json` = 2, 10 |
| `fields=id,json(metadata, n, number)` | 200, `metadata_n_number_json` = null |
| `POST /permissions` với `permissions: {"json(metadata, n, number)": {"_eq": 1}}` | 200 (lưu được) |

Hệ quả: D-184 `http` dùng `when: { directusStatus: 403, directusCode: 'FORBIDDEN' }`; E2E `proxy-directus` mong notice
lỗi 403; spec, contracts, quickstart sửa câu chữ 400 → 403 (không đổi khác biệt). Alias của `fields` ba tham số giữ
`metadata_n_number_json` như Directus.

## Kết quả lượt 1 (2026-10-27, env parity local)

- Unit API: 4030 test xanh (361 file), coverage đạt ngưỡng; test mới: `parse-function.test.ts` (ngữ pháp 2–3 tham số,
  `[*]`, `"` bị từ chối), `parse-filter-key.test.ts`, `get-filter-type.test.ts`, `fn/json/json-filter.test.ts` (SQL theo
  vendor, gate, `normalizeTypedJsonValue`), `operator.test.ts`, `filter/index.test.ts`, `extract-fields-from-query.test.ts`,
  `permissions.service.test.ts`, `payload.service.test.ts`.
- Parity `src/items/json-path.test.ts`: Postgres 31/31 (cột `json` rồi `jsonb` sau `ALTER`), SQLite 39/41 cùng
  `crud.test.ts` (2 case chỉ Postgres bỏ qua); `items/{crud,export}`, `permissions/{accountability,write-rules}` trên
  Postgres xanh (78). MySQL (vendor gate) và blackbox `json-fields` để CI.
- Lỗi tìm thấy khi chạy thật: knex `whereIn(raw, values)` đặt binding của cột raw **sau** giá trị (`_in`/`_nin` lỗi
  `invalid input syntax for type numeric`); `applyWhere` viết danh sách `IN` bằng `whereRaw` cho cột raw có binding, cột
  thường giữ `whereIn` (SQL như DR).
- Response cache dùng chung: `fields=json(f, p, number)` gửi tới Directus trước rồi Backoffice nhận lại response null
  của Directus từ cache (cùng key) → helper `at()` của test gửi `Cache-Control: no-store`; ghi Edge Case trong spec.
- Ký tự `"` trong tên khóa của path bị từ chối ở filter (SQLite đọc `$."...` là nhãn có ngoặc kép và lỗi khi không đóng).
- Vòng import: `fn/types.ts` không import `getDatabaseClient` (database/index → helpers → fn → types), dùng bảng tên client
  cục bộ cho gate.
- `sort=json(f, p[, type])`: dạng chuỗi bị `sanitizeSort` tách ở dấu phẩy ở cả hai app; test dùng `sort[0]=...`.
