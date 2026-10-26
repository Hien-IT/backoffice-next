# Contract: GraphQL `/graphql` (D-186)

## Schema (chỉ scope `items`)

```graphql
input json_path_filter_operators {
  path: String!
  text: string_filter_operators
  number: number_filter_operators
  boolean: boolean_filter_operators
}

input <collection>_filter {
  # ... các field như hôm nay, kể cả <f>_func: count_function_filter_operators ...
  <f>_json: json_path_filter_operators   # mỗi field f kiểu json của collection (bỏ qua nếu collection đã có field tên <f>_json)
  _and: [<collection>_filter]
  _or: [<collection>_filter]
}
```

`<collection>_quantifier_filter` (clone sau vòng lặp), filter của quan hệ m2o/o2m/m2a, `filter:` của field và của
mutation dùng chung `<collection>_filter`, nên `_json` có ở mọi chỗ lồng. `/graphql/system`: không có type và field mới.
Collection hệ thống có field json chạm tới từ scope items (ví dụ `directus_users.tags` qua `user_created`) cũng có
`<f>_json` (normalizer parity bỏ).

## Query

```graphql
query {
  transactions(filter: { transaction_data_json: { path: "Amount", number: { _eq: 6000 } } }) { id }
  orders(filter: { _and: [
    { order: { transaction_data_json: { path: "items[*].sku", text: { _eq: "A" } } } },
    { status: { _eq: "paid" } }
  ] }) { id }
  transactions_aggregated(filter: { transaction_data_json: { path: "flag", boolean: { _eq: true } } }) { count { id } }
}
```

| Input | Kết quả |
|-------|---------|
| đúng một trong `text`/`number`/`boolean` | ánh xạ về `{"json(transaction_data, Amount, number)": {"_eq": 6000}}` rồi đi đường REST (FR-007) |
| không có hoặc ≥ 2 trong ba | lỗi GraphQL `INVALID_QUERY` `"transaction_data_json" needs exactly one of text, number, boolean` |
| `path` sai cú pháp, `[*]` hai lần | lỗi GraphQL `INVALID_QUERY` như REST |
| vendor không hỗ trợ | lỗi GraphQL `INVALID_QUERY` như REST |
| `{ foo_json: { path: { _eq: "x" } } }` với `foo_json` là field m2o thật có field `path` | giữ nguyên (không phải điều kiện json path) |

## Ánh xạ (`apps/api/src/services/graphql/utils/replace-funcs.ts`)

```ts
export function replaceJsonPaths(filter: unknown): unknown;
// { f_json: { path, <type>: ops } } → { 'json(f, <path>, <type>)': ops }; đệ quy object (kể cả prototype null) và array
```

Gọi **trước** `sanitizeQuery` ở `schema/parse-query.ts:25` (query và mutation), `:160` (args field quan hệ → `deep`)
và `utils/aggregate-query.ts:19`. `replaceFuncs` (`_func`) giữ nguyên.

## Introspection, SDL và parity

Khác Directus đúng ở: type `json_path_filter_operators`, field `<f>_json` trong mỗi `<collection>_filter` có field json
(cả `inputFields` introspection và dòng SDL), ETag của `/graphql` introspection và `/server/specs/graphql`.
`tests/parity/src/normalizers.ts` bỏ cả hai trước khi so; `parity.ts` bỏ so ETag khi body có
`json_path_filter_operators`; sắp xếp type introspection khi có. Phần còn lại so nguyên văn (FR-012).
