# Research: Lọc item bằng so sánh hai field của cùng collection (028)

Đọc code ngày 2026-11-01, chưa chạy thử; không thử SQL trên DB thật. Mục ghi [Inference] là suy ra từ code, có task
kiểm ở lượt 1; mục [Unverified] là hành vi Directus, đo ở T002 (lượt 1) rồi ghi vào spec như 023.

## R1. Chỗ nhận `$FIELD(b)` ở API: `applyOperator`, trước `applyWhere` và `cast`

**Hiện trạng** (`apps/api/src/database/run-ast/lib/apply-query/filter/operator.ts`): `applyOperator` (:27) tách
`table`/`column` ở dấu chấm đầu (023), tính `selectionRaw = getColumn(knex, table, column, false, schema, {
originalCollectionName })` (:115, với cột thường là `knex.ref("alias.column")`, `utils/get-column.ts:106`) rồi gọi
`applyWhere` (:139), nơi `compareValue = cast(compareValue)` (:195) ép theo kiểu field a: `castToNumber('$FIELD(b)')`
ném `InvalidQueryError` "Invalid numeric value" (:11-23), ngày đi qua `helpers.date.parse`. Trước đó
`validateFilterPrimitive` (`utils/validate-query.ts:133`) nhận chuỗi, `parseDynamicVariable`
(`libs/utils/src/shared/parse-filter.ts:142`) không có nhánh `$FIELD` nên chuỗi tới `applyOperator` nguyên vẹn;
`validateOperator` (`filter/index.ts:205`, `:210`) đã chặn toán tử ngoài danh sách của kiểu field a
(`libs/utils/src/shared/get-filter-operators-for-type.ts`: uuid chỉ `eq neq null nnull in nin`, boolean chỉ `eq neq
null nnull`, số và ngày giờ đủ `lt lte gt gte`).

**Decision**: file mới `apps/api/src/database/run-ast/lib/apply-query/filter/field-compare.ts` (Backoffice, không port):

```ts
export const FIELD_COMPARE_OPERATORS = ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte'] as const;
export const FIELD_COMPARE_SQL = { _eq: '=', _neq: '<>', _gt: '>', _gte: '>=', _lt: '<', _lte: '<=' } as const;
/** `$FIELD(<x>)` → `<x>` đã trim (có thể rỗng hay sai); chuỗi không có dạng đó → null. */
export function parseFieldCompare(value: unknown): string | null;   // /^\$FIELD\((.*)\)$/ (analyze I1, cách a)
/** Nhóm kiểu: number | string | boolean | uuid | date | dateTime | timestamp | null (clarify câu 1). */
export function fieldCompareGroup(type: Type): FieldCompareGroup | null;
/** 400 khi tên b rỗng/có dấu chấm (quan hệ)/ký tự lạ, field b không có, là alias, hoặc khác nhóm với field a. */
export function assertFieldCompare(schema: SchemaOverview, collection: string, fieldA: string, fieldB: string): void;
```

Trong `applyOperator`, ngay sau khi tính `column` và trước nhánh json (:44): nếu `operator` ∈
`FIELD_COMPARE_OPERATORS` và `parseFieldCompare(compareValue)` trả `b`:

1. `column` phải là field thường (không `(`: không `json(...)`, không `year(...)`): 400 `"$FIELD(...)" is only
   allowed on a plain field`.
2. `assertFieldCompare(schema, originalCollectionName || table, column, b)` (`mappedCollection` như `cast` :60).
3. `dbQuery[logical].where(selectionRaw, FIELD_COMPARE_SQL[operator], getColumn(knex, table, b, false, schema, {
   originalCollectionName }))` rồi `return`. Knex nhận `Ref` ở vị trí giá trị và in ra định danh, không binding
   [Inference, kiểm ở unit test lượt 1 bằng `toSQL()`]. `_neq` dùng `<>` (không `whereNot`) để SQL là `a <> b`.

Alias bảng: ở root `table` là `aliasMap[''].alias || collection` (`filter/index.ts:213`), qua quan hệ là alias do
`getColumnPath` tạo với `targetCollection` làm `originalCollectionName` (`:185`, `:207`); field b cùng collection với
field a nên dùng lại đúng `table` đó. Hai vế không ghép chuỗi người dùng: tên b chỉ vào SQL qua `knex.ref` sau khi tra
schema (FR-007).

**Kết quả T001** (2026-11-01, script tạm với knex 3.1 của `apps/api`): `where(knex.ref('t.a'), '<>', knex.ref('t.b'))`
sinh `"t"."a" <> "t"."b"` không binding trên `MockClient`, `pg`, `sqlite3` (backtick) và `mysql2`; `whereNot(ref, ref)`
sinh `not "t"."a" = "t"."b"`, nên `_neq` dùng `where(..., '<>', ...)` như R1. Không cần `whereRaw`.

**Rationale**: một chỗ, trước `cast`, không đụng bảng toán tử của DR; `getColumn` đã là cách vế trái vào SQL.

Tên b (analyze I1, chủ dự án chọn cách a 2026-11-01): mọi chuỗi `$FIELD(...)` là giá trị động, nên `$FIELD()`,
`$FIELD(author.age)`, `$FIELD(a b)` cho 400 rõ lý do thay vì âm thầm là chuỗi thường (field chuỗi sẽ ra 0 dòng).
Hợp lệ: `^[^\s().,]+$` sau trim. `$field(b)` (chữ thường), `$FIELD`, `$FIELD(b` vẫn là chuỗi thường.

**Alternatives considered**: đặt kiểm ở `validate-query.ts` (không có schema ở đó); nhánh trong `parseDynamicVariable`
của `libs/utils` (trả gì? giá trị phải là cột, không phải hằng; và web không dùng `@backoffice/utils`); toán tử mới
`_eq_field` ở REST (bookmark dùng chung hiện toàn bộ dòng ở Directus app vì `applyOperator` DR bỏ qua toán tử lạ;
spec bảng hiện trạng #11).

## R2. Nhóm kiểu và field hợp lệ (clarify câu 1)

`FieldOverview` (`libs/types/src/schema.ts:6`): `type`, `dbType: string | null`, `alias: boolean`, `special`. Field b
hợp lệ khi có trong `schema.collections[c].fields`, `alias === false` (o2m, m2m, m2a, presentation là alias), và
`fieldCompareGroup(typeB) === fieldCompareGroup(typeA)`:

| Nhóm | `type` | Ghi chú |
|------|--------|---------|
| number | integer, bigInteger, float, decimal | so chéo trong nhóm; vendor ép số |
| string | string, text | so chéo; collation của cột (Assumptions) |
| boolean | boolean | `validateOperator` đã chỉ cho `_eq`, `_neq` |
| uuid | uuid | m2o tới users là uuid; chỉ `_eq`, `_neq` (DR) |
| date / dateTime / timestamp | mỗi kiểu một nhóm | SQLite: `timestamp` lưu epoch ms (`cast-timestamp`, `helpers/date/dialects/sqlite.ts:27`), `dateTime`/`date` lưu text ISO [Inference] → so chéo vô nghĩa |

`hash`, `json`, `csv`, `time`, `geometry.*`, `binary`, `alias`: `null` → 400 ở cả hai vế. Thông báo 400 nêu hai field
và nhóm: `"$FIELD(title)" must be a number field like "total" (got string)`; không có: `"$FIELD(x)": unknown field
"x" in collection "c"`; alias: `"$FIELD(tags)" must be a column field`; tên sai dạng: `"$FIELD(author.age)": a field
of the same collection is expected (no relation, no spaces)` (analyze I1).

**Sửa spec khi plan**: Edge Cases ghi rõ uuid và boolean chỉ có `_eq`/`_neq` qua `$FIELD` (bảng toán tử DR của kiểu
field a, không nới).

## R3. Quyền đọc field b: `flattenFilter` thêm đường dẫn của b (clarify câu 2)

**Hiện trạng**: `flattenFilter` (`permissions/modules/process-ast/utils/flatten-filter.ts:5`, port nguyên văn) chỉ đẩy
đường dẫn key vào `paths` khi gặp toán tử (`:23-26`), không nhìn giá trị; `extractPathsFromQuery` (:26) đưa chúng vào
`readOnlyPaths` → `extractFieldsFromQuery` → `validatePathExistence`/kiểm quyền đọc theo field map. Không sửa thì user
không có quyền đọc b vẫn dò được b qua `a = $FIELD(b)` (spec #5).

**Kết quả lượt 1** (2026-11-01, parity Postgres): `validatePathExistence` chạy cho admin nữa, nên `$FIELD(nope)` là 403
`FORBIDDEN` "...or it does not exist" cho mọi user (như Directus với filter key lạ); chỉ tên hợp lệ
(`isFieldCompareName`) được đẩy vào `paths`, tên sai dạng (`$FIELD()`, `$FIELD(a.b)`) để `applyOperator` trả 400 rõ.

**Decision**: trong nhánh toán tử của `flattenFilter`, nếu `key` ∈ `FIELD_COMPARE_OPERATORS` và
`parseFieldCompare(current[key])` trả `b`: đẩy thêm `[...parts.slice(0, -1), b]` (cùng collection: thay phần cuối).
Comment `// Backoffice (spec 028, D-203)`. Field b đi qua cùng bước kiểm như một filter key: thiếu quyền → 403
`FORBIDDEN` như DR (FR-006); field b không có trong schema → `validatePathExistence` cũng 403 trước khi tới R2
[Inference; spec FR-003 nói 400: kiểm ở T002 và ghi câu chữ: field không có + user thường = 403 như DR cho filter key
lạ, admin = 400 của R2]. `assertNoJsonPathFilter` dùng `flattenFilter` chỉ để lấy key nên thêm path của b không đổi
kết quả của nó.

**Alternatives**: sửa `extractPathsFromQuery` (phải tự duyệt filter lần nữa); kiểm trong `applyOperator` bằng
`permissions` (không có accountability ở đó).

## R4. Từ chối `$FIELD` trong permission khi lưu (D-204, như D-185)

`assertNoJsonPathFilter` (`services/permissions.service.ts:204`, gọi ở `createOne` :45 và `updateMany` :71) duyệt bằng
`flattenFilter`. **Decision**: thêm `hasFieldCompare(filter)` vào `field-compare.ts` (duyệt đệ quy `_and`/`_or`/object,
true khi một toán tử trong sáu có giá trị `$FIELD(...)`) và gọi trong cùng hàm (đổi tên thành
`assertNoBackofficeFilter`, hai caller): 400 `INVALID_PAYLOAD` `Permission filters cannot compare two fields
($FIELD(...))`. `BackofficePermissionsService` (025, `services/backoffice-permissions.service.ts:40`, `:54`) nhận
`permissions`/`validation` như `directus_permissions` (`assertAction` chỉ kiểm `action`): gọi cùng hàm ở `createOne`
và `updateMany` (D-204 nói `/backoffice/permissions`). `/fields` validation, `/flows`, `/operations`: không kiểm
(FR-011).

## R5. GraphQL: input `<field>_field` với giá trị `{ field }` (clarify câu 3, sửa dạng giá trị)

**Hiện trạng** (`services/graphql/schema/read.ts`): `<collection>_filter` chọn `*_filter_operators` theo
`getGraphQLType` (:470-499); 023 thêm `json_path_filter_operators` (:436) và `<f>_json` chỉ ở `gql.scope === 'items'`
và khi không có field thật tên đó (:528); `replaceJsonPaths` (`utils/replace-funcs.ts:13`) đổi key trước
`sanitizeQuery` qua `withJsonPaths` (`schema/parse-query.ts:26`, `:161`, `utils/aggregate-query.ts:19`), nhận dạng
bằng `typeof value.path === 'string'`.

**Vấn đề với giá trị `String`** (dạng clarify câu 3: `total_field: { _gt: "paid_amount" }`): rewrite không có schema,
nên không phân biệt được với filter của một field thật tên `total_field` kiểu string (`{ _eq: "abc" }`): cùng hình
dạng. 023 thoát nhờ `path`. **Decision**: giữ input riêng và sáu toán tử, nhưng giá trị là object một khóa:

```graphql
input field_ref { field: String! }
input field_compare_operators { _eq: field_ref, _neq: field_ref, _gt: field_ref, _gte: field_ref, _lt: field_ref, _lte: field_ref }
# trong <collection>_filter (scope items), mỗi field có fieldCompareGroup(type) != null và !alias, khi không có field thật `<f>_field`:
#   <f>_field: field_compare_operators
```

`replaceFieldCompares` (cùng file `replace-funcs.ts`): key `endsWith('_field')`, giá trị object mà mọi khóa ∈ sáu toán
tử và mỗi giá trị là object có `field` chuỗi → `result[f] = { ...result[f], [op]: `$FIELD(${field})` }` (gộp với
`f` nếu cũng có; trùng toán tử: `_field` thắng, ghi quickstart). Không field thật nào nhận object ở `_eq` (mọi
`*_filter_operators` là scalar hoặc list), nên không nhầm. `withJsonPaths` đổi tên `withBackofficeFilters` và gọi cả
hai rewrite (3 call site + test). Lỗi field không có/khác nhóm: từ R2 qua `sanitizeQuery` → `INVALID_QUERY` như 023.

Parity: `tests/parity/src/normalizers.ts` thêm `FIELD_COMPARE_TYPES = ['field_compare_operators', 'field_ref']` vào
`withoutBackofficeIntrospection` (:118) và `withoutBackofficeSdl` (:267: bỏ hai `input ... {}` và dòng
`<f>_field: field_compare_operators`); `accepted-differences.ts` D-205 `doc`.

**Sửa spec khi plan**: FR-008, D-205, data-model: giá trị `{ field: "b" }` thay vì `"b"`; ví dụ `filter: {
total_field: { _gt: { field: "paid_amount" } } }`.

**Alternatives**: giá trị `String` + rewrite có schema (phải duyệt quan hệ theo từng nhánh filter, bản sao logic của
`getColumnPath`); toán tử `_eq_field` trong từng `*_filter_operators` (đổi 4 type dùng chung, normalizer lọc trong
từng type, cũng cần schema để biết `_eq_field` không phải field).

## R6. Web: nút chọn field và chip trong `InputGroup`, `$FIELD` qua ô nhập (clarify câu 5)

**Hiện trạng** (`apps/web/src/interfaces/_system/system-filter/`): `InputComponent.vue` `isValueValid` (:103-119)
chỉ cho qua chuỗi khớp pattern kiểu (:67: số, uuid), biến động của `@directus/utils` (5 prefix) hoặc `{{ }}`; với
field số, `$FIELD(paid_amount)` bị đánh dấu `aria-invalid` và không emit. `InputGroup.vue`: `fieldInfo` (:44) từ
`fieldsStore.getField(collection, path)`, `value` computed (:113) emit `fieldToFilter(path, comparator, value)`, nút
biến `{{ }}` (:252-269) chỉ với `variableInputEnabled` và `_in/_nin`; `Nodes.vue` chỉ truyền prop xuống
`InputGroup` (:642). Prop 023 `includeJsonPath` đi `SearchInput.vue:29` → `SystemFilter.vue:54` → `Nodes.vue:81`;
`CollectionRoute.vue:426` và `DrawerCollection.vue:216` bật.

**Decision**:

- `apps/web/src/utils/field-compare.ts` (+ test): `parseFieldCompare`, `formatFieldCompare`, `fieldCompareGroup`,
  `FIELD_COMPARE_OPERATORS` (bản sao ngữ pháp của API, như `utils/json-path.ts` của 023; web không dùng
  `@backoffice/*`).
- `InputComponent.vue` `isValueValid`: `parseFieldCompare(value)` cũng hợp lệ (gõ tay vẫn nhận, FR-012).
- `InputGroup.vue`: prop `includeFieldCompare`; `canCompareField = includeFieldCompare && comparator ∈ sáu toán tử &&
  fieldCompareGroup(fieldInfo.type) != null`; `compareFields` = `fieldsStore.getFieldsForCollection(fieldInfo.collection)`
  (collection của field a, cũng đúng qua quan hệ) lọc cùng nhóm, không alias (`meta.special` không chứa o2m/m2m/m2a,
  `schema` khác null), trừ field a; khi `parseFieldCompare(value)` trả `b`: thay `InputComponent` bằng chip button
  `rounded-md px-1.5 py-0.5 font-mono text-theme-sm text-brand-500` (như chip field của Nodes), text = tên hiển thị
  của b (`field.name`, thêm `(key)` khi hai field cùng `name`; `rawFieldNames` → key), `aria-label`
  `t('field_compare_with', { field })`, mở cùng BoMenu; b không còn trong collection: chip `text-error-500` với key thô
  và `aria-invalid`. Khi chưa có `$FIELD`: `InputComponent` như nay + nút icon `swap_horiz` (`size-6`, `aria-label`
  `t('field_compare')`, cùng lớp với nút `{{ }}`) mở BoMenu: mục đầu `t('field_compare_value')` (về nhập giá trị:
  `value = null`) rồi các `compareFields` (`onSelect: value = formatFieldCompare(key)`).
- Prop chain `includeFieldCompare`: `SearchInput` → `SystemFilter` → `Nodes` (đệ quy) → `InputGroup`; chỉ
  `CollectionRoute.vue` bật (D-206); `DrawerCollection.vue` không.
- i18n overlay `apps/web/src/lang/overlay/{en-US,vi-VN}.ts`: `field_compare` "Compare with a field" / "So với field
  khác", `field_compare_with` "Compared with {field}" / "So với {field}", `field_compare_value` "Enter a value" /
  "Nhập giá trị", `field_compare_missing` "Field {field} not found" / "Không có field {field}".
- Design-system (XII): không component mới; ghi một gạch đầu dòng "Field compare (spec 028, D-206)" vào recipe Q-7
  (`design-system/docs/component-specs.md:1317` kế "JSON path form"); không màu mới nên `migration-guide.md` không
  đổi. Chủ dự án (design owner) chốt ở analyze như C1 của 023.

**Alternatives**: mục trong `FieldList` (field b là giá trị, không phải key; FieldList là danh sách key); form riêng
như `JsonPathForm` (nặng hơn một menu).

**Kết quả lượt 2** (2026-11-01): unit `InputGroup` (16), `InputComponent` (12), browser `SystemFilter` + a11y trang Content
(axe sạch ở nút, chip và menu mở trên trang; trong harness component Reka ẩn phần còn lại khi menu modal mở nên bỏ axe
ở bước đó), E2E `content-filter-field-compare.spec.ts` 3/3 ở `proxy-api`, `cors`, `proxy-directus` (Directus 400 với
field số, layout hiện `INVALID_QUERY` và nút Reset Page Preferences). Hai điểm DR gặp khi viết E2E: treeitem của field
ngày có nút mở rộng ở đầu nên chọn bằng Enter; Directus 11.17.4 không có `case 'timestamp'` trong
`getFilterOperatorsForType`, dòng lọc timestamp mở với "Contains" (danh sách mặc định, vẫn có `_gt`..`_lte`), cả hai
app như nhau. `InputComponent` giữ `onUpdated` của DR nên `aria-invalid` của giá trị bị từ chối không giữ sau render.

## R7. Bookmark và Directus app (D-203.1) [Unverified]

Bookmark lưu `{"total": {"_gt": "$FIELD(paid_amount)"}}` vào `directus_presets.filter` (JSON tự do, FR-010). Directus
app mở bookmark gửi cùng filter tới Directus API: `applyOperator` DR giống bản port (spec #3, #4) nên field số → 400
`INVALID_QUERY` "Invalid numeric value"; field chuỗi → 200, so với chuỗi nguyên văn, 0 dòng; field ngày → `new
Date('$FIELD(b)')` không hợp lệ: Postgres helper trả chuỗi "Invalid Date"/NaN → lỗi DB 500 hoặc 400 tùy helper
[Unverified]. T002 đo cả ba nhóm trên Postgres (profile chính) và ghi vào D-203/D-203.1 và contracts/api.md; E2E ở
`proxy-directus` mong đúng hành vi đo được (SC-005).

**Kết quả T002** (2026-11-01, Directus 11.17.4 trên env parity Postgres, script tạm, 2 dòng, admin): field số với
`$FIELD(b)` (sáu toán tử, cũng `$FIELD(title)`, `$FIELD(nope)`, `$FIELD()`): 400 `INVALID_QUERY` "Invalid numeric
value"; field chuỗi: `_eq` 200 với 0 dòng, `_neq` 200 với mọi dòng (so với chuỗi nguyên văn), `_gt` 400 (toán tử
không có cho chuỗi, cũng ở Backoffice); field `timestamp`, `boolean`, `uuid`: 500 `INTERNAL_SERVER_ERROR` với thông
điệp SQL của Postgres (`invalid input syntax for type timestamp with time zone: "$FIELD(published_at)"`); `_contains`
200 với 0 dòng; `_null: '$FIELD(x)'` 400 "_null has to be a boolean"; `SEARCH` và `?export=csv` như `GET`;
`POST /utils/export` 204 (job nền lỗi, không có file); bookmark lưu 200 vào `directus_presets`, mở lại là cùng request
(400 với field số). **SQLite** (cùng script, env `sqlite3`): field số, chuỗi, `_contains`, `_null`, export, bookmark như
Postgres; field `timestamp`, `boolean`, `uuid`: **200** (SQLite so text với text: `_eq`/`_gt` 0 dòng, `_neq` mọi dòng),
không 500. **MySQL 8** (cùng script): số 400, chuỗi 200, `timestamp` 500 (MySQL từ chối chuỗi làm datetime), `boolean`
và `uuid` 200 (so text, `_eq` 0 dòng, `_neq` mọi dòng). Bảng `DIRECTUS_STATUS` của `field-compare.test.ts` ghi ba vendor
đã đo; vendor nightly để mở (200, 400 hoặc 500).

## R8. Parity: file mới, D-203 `http`, chỗ Directus trả 200 so riêng từng app

`tests/parity/src/items/field-compare.test.ts` theo `json-path.test.ts`: collection `parity_field_compare_<run>` với
`total`, `paid_amount` (integer), `price` (decimal), `published_at`, `updated_at` (timestamp), `title`, `slug`
(string), `active`, `featured` (boolean), `owner`, `reviewer` (uuid), hàng có null; mỗi vendor (bộ `full` và
`reduced`: so cột với cột là SQL chuẩn, không gate), thêm vào `suite.ts` (:15, :49) và `vendors.test.ts` (:120-122).
`accepted-differences.ts` D-203 `http` cho `GET/SEARCH /items/parity_field_compare_*` với `when` theo kết quả T002
(số/ngày: `directusStatus: 400`); trường hợp Directus trả 200 khác body (chuỗi) không diễn tả được bằng `when` → so
riêng từng app (`appRequest('backoffice')` kiểm tập id, `appRequest('directus')` kiểm 0 dòng) như D-184.2 của 023.
D-204 `http` `POST/PATCH /permissions` `backofficeCode: 'INVALID_PAYLOAD'` như D-185; D-205, D-206 `doc`. GraphQL:
`tests/parity/src/graphql/read.test.ts` thêm khối "spec 028 D-205" chỉ Backoffice (:253 mẫu).

## R9. E2E ba cấu hình

`apps/web-e2e/src/content-filter-field-compare.spec.ts` theo `content-filter-json-path.spec.ts`: collection
`bo_cmp_<config>` tạo qua API của cấu hình với `total`, `paid_amount` (integer), `published_at`, `updated_at`
(timestamp), 3 dòng; luồng US2 bằng chuột và bàn phím (Tab tới nút `swap_horiz`, Enter, chọn bằng mũi tên), bookmark
lưu và mở lại, chip tên hiển thị; `proxy-directus` mong kết quả đo ở T002 (layout hiện lỗi API như D-184.1); kiểm
DrawerCollection không có nút (FR-013).

## R10. Null, collation, vendor

`a <> b` với NULL không đúng → không khớp (clarify câu 4), giống `whereNot` của DR cho giá trị thường; không thêm `IS
NULL`. Chuỗi so theo collation cột (MySQL mặc định không phân biệt hoa thường, Postgres/SQLite phân biệt): như `_eq`
giá trị thường hôm nay, ghi Assumptions; unit test chỉ dùng chuỗi khác nhau rõ. MSSQL/Oracle/CockroachDB qua nightly.

**Kết quả T009** (2026-11-01): `field-compare.test.ts` xanh trên Postgres 16, SQLite và MySQL 8 (29 case); MySQL so chuỗi
không phân biệt hoa thường (`title _eq $FIELD(slug)` khớp cả `Beta`/`beta`, `Gamma`/`gamma`), Postgres và SQLite phân
biệt; test ghi kỳ vọng theo vendor (`CASE_INSENSITIVE`). Vendor nightly chưa chạy (T040).

**Kết quả lượt 3** (2026-11-01): unit `replace-funcs` (gộp, `_field` thắng, bỏ qua field thật `x_field`), `schema/index`
(`<f>_field` cho integer/timestamp/boolean/uuid/m2o, không cho json/hash/alias, không khi có field thật `<f>_field`,
không ở scope system); parity Postgres `graphql/read.test.ts` khối 028 và `graphql/schema.test.ts` (sau khi bỏ
`<f>_field` cho tên bắt đầu `__`: case "field named __x" của 011 so danh sách lỗi schema với DR). T040: vendor nightly
chưa chạy, chủ dự án quyết định.

## R11. Hiệu năng

So hai cột không dùng index B-tree của một cột; không tạo index, không case benchmark (SC-006 giữ ngưỡng của scenario
hiện có; đường đi request không có `$FIELD` chỉ thêm một `parseFieldCompare` trên chuỗi, bỏ qua khi giá trị không
phải chuỗi).

**Kết quả T041** (2026-11-01): benchmark-items 41275639129 xanh, mọi scenario "ok" trong ngưỡng 10 % của Directus
(SC-006); không có case riêng cho `$FIELD`.

## R12. Ba lượt và tài liệu

Lượt 1 API REST (R1–R4, R8, T002 đo Directus) → lượt 2 web + E2E (R6, R9) → lượt 3 GraphQL (R5) + tài liệu: spec
(D-203..D-206 câu chữ cuối), `CLAUDE.md` (Active Technologies + Recent Changes), `tests/parity/README.md`,
`SPECKIT-GUIDE.md` trạng thái 028, `design-system/docs/component-specs.md` Q-7. Mỗi lượt đóng bằng lint, typecheck,
test, build, E2E, commit thẳng `main`, CI xanh, `graphify update .`.
