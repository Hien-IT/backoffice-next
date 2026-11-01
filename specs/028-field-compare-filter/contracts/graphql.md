# Contract: GraphQL `/graphql` (D-205)

Schema (scope `items` chỉ; `/graphql/system` không đổi), thêm sau `json_path_filter_operators` trong
`apps/api/src/services/graphql/schema/read.ts`:

```graphql
input field_ref { field: String! }
input field_compare_operators {
  _eq: field_ref
  _neq: field_ref
  _gt: field_ref
  _gte: field_ref
  _lt: field_ref
  _lte: field_ref
}
```

Trong `<collection>_filter`, mỗi field `f` có `fieldCompareGroup(f.type) != null`, không alias, và collection không có
field thật tên `f_field`: `f_field: field_compare_operators`. Field `*_func`, `*_json` giữ nguyên.

| Query | Kết quả |
|-------|---------|
| `{ c(filter: { total_field: { _gt: { field: "paid_amount" } } }) { id } }` | như REST `filter[total][_gt]=$FIELD(paid_amount)` |
| `{ c(filter: { _or: [{ updated_at_field: { _gt: { field: "published_at" } } }, { title: { _eq: "x" } }] }) { id } }` | như REST |
| `{ c(filter: { order: { total_field: { _gt: { field: "paid_amount" } } } }) { id } }` (qua m2o) | như REST |
| `{ c_aggregated(filter: { total_field: { _gt: { field: "paid_amount" } } }) { count { id } } }` | như REST |
| `mutation { update_c_items(filter: { total_field: {...} }, data: {...}) { id } }` | lọc như REST rồi ghi |
| `total_field: { _gt: { field: "title" } }` | lỗi GraphQL `INVALID_QUERY` (khác nhóm, R2) |
| `total_field: { _gt: { field: "nope" } }` | `FORBIDDEN` (user) / `INVALID_QUERY` (admin), như REST |
| `active_field: { _gt: { field: "featured" } }` | `INVALID_QUERY` (`validateOperator`: boolean không có `_gt`) |

Rewrite (`apps/api/src/services/graphql/utils/replace-funcs.ts`), trước `sanitizeQuery`:

```ts
export function replaceFieldCompares<T>(filter: T): T;
// { total_field: { _gt: { field: 'paid_amount' } }, title: { _eq: 'x' } }
//   → { total: { _gt: '$FIELD(paid_amount)' }, title: { _eq: 'x' } }
// nhận dạng: key endsWith('_field'), giá trị object mà mọi khóa ∈ sáu toán tử và mỗi giá trị là { field: string }
// gộp với key `total` nếu có; cùng toán tử: `_field` thắng
export function withBackofficeFilters<T extends { filter?: unknown }>(query: T): T; // replaceJsonPaths + replaceFieldCompares (đổi tên withJsonPaths)
```

Call site: `schema/parse-query.ts:26`, `:161`; `utils/aggregate-query.ts:19`.

Introspection, SDL, `server_specs_graphql`: khác Directus ở hai input mới và các field `*_field`; `tests/parity`
chuẩn hóa như D-186 (`withoutBackofficeIntrospection`, `withoutBackofficeSdl` với `FIELD_COMPARE_TYPES`), ETag không so.
