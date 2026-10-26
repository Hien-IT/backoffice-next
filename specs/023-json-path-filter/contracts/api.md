# Contract: API REST (D-184, D-185)

## Query (`GET`/`SEARCH /items/:collection`, `?export=`, `POST /utils/export/:collection`)

Không path, query, response, status, header mới. Chỉ `filter` nhận thêm key `json(field, path, type)` (FR-001..FR-006).

| Request | Postgres, SQLite | MySQL, MSSQL, Oracle, CockroachDB, Redshift | Directus 11.17.4 |
|---------|------------------|---------------------------------------------|------------------|
| `GET /items/c?filter={"json(transaction_data, Amount, number)":{"_eq":6000}}` | 200, item có số 6000 tại path | 400 `INVALID_QUERY` `Filtering by a JSON path is not supported on <client>` | 400 `INVALID_QUERY` `Invalid filter key "json(transaction_data, Amount, number)" on "c"` |
| `...{"json(transaction_data, items[*].sku, text)":{"_eq":"A"}}` | 200, item có phần tử `sku` = "A" | 400 | 400 |
| `...{"order":{"json(transaction_data, Amount, number)":{"_gt":100}}}` (m2o) | 200 | 400 | 400 |
| `...{"json(transaction_data, Amount, money)":{"_eq":6000}}` | 400 `INVALID_QUERY` `Invalid json() syntax: unknown type "money"` | 400 | 400 |
| `...{"json(transaction_data, items[, number)":{"_eq":1}}` | 400 `INVALID_QUERY` `Invalid json() syntax: unsupported path expression` | 400 | 400 |
| `...{"json(transaction_data, a[*].b[*], number)":...}` | 400 (chỉ một `[*]`) | 400 | 400 |
| `...{"json(title, x, text)":...}` (field không phải json) | 400 `Invalid function specified "json"` (như hôm nay) | 400 | 400 |
| `...{"json(transaction_data, Amount, number)":{"_contains":"6"}}` | 400 `"float" field type does not contain the "_contains" filter operator` | 400 | 400 |
| user không có quyền đọc `transaction_data` | 403 như lọc trực tiếp field | 403 | 403 |
| `filter[json(t, items[0].sku, text)][_eq]=A` (dạng ngoặc của `qs`) | 400 (`qs` cắt key; dùng `filter={...}`) | 400 | 400 |

`meta=filter_count,total_count`: `filter_count` đếm theo cùng điều kiện. `_and`/`_or`: như mọi key. Response cache:
key riêng theo query, không đổi hành vi.

### Parse key (`apps/api/src/database/helpers/fn/json/parse-function.ts`)

```ts
export function parseJsonFunction(fn: string, options?: { allowWildcard?: boolean }): { field: string; path: string; type: JsonFilterType };
// 'json(a, b)'            → { field: 'a', path: '.b',   type: 'text' }
// 'json(a, b.c, number)'  → { field: 'a', path: '.b.c', type: 'number' }
// 'json(a, b[*].c, text)' → ok chỉ khi allowWildcard; '[*]' nhiều hơn một lần: throw
// 'json(a)' / 'json(a, b, c, d)' / 'json(a, b, money)' → InvalidQueryError
export function splitWildcard(path: string): { before: string; after: string } | null;
export function jsonFilterType(type: JsonFilterType): 'string' | 'float' | 'boolean';
```

`parseFilterKey('json(a, b, number)')` → `{ fieldName: 'a', functionName: 'json' }` (sửa gốc, R1);
`convert-wildcards.ts` giữ hành vi Directus với alias `json(...)` trong `*` (checklist CHK009).

### Biểu thức theo vendor (`FnHelper`, `apps/api/src/database/helpers/fn`)

```ts
// types.ts
export type JsonFilterType = 'text' | 'number' | 'boolean';
export type FnHelperOptions = { ...; jsonPath: string | undefined; jsonType?: JsonFilterType };
abstract json(table, column, options?): Knex.Raw;            // có jsonType → biểu thức có kiểu; không → như hôm nay
jsonArrayElements(table, column, options: { jsonPath }): Knex.Raw; // FROM cho [*]; gốc: throw not supported
jsonElement(options: { alias: string; jsonPath: string; jsonType }): Knex.Raw; // phần tử có kiểu; gốc: throw
protected assertJsonFilterSupported(): void;                  // getDatabaseClient(knex) ∈ postgres|sqlite, khác → InvalidQueryError
```

| Vendor | `json(t, c, { jsonPath: '.Amount', jsonType: 'number' })` |
|--------|------------------------------------------------------------|
| Postgres, cột `json` | `CASE WHEN json_typeof("t"."c" #> ARRAY[?]::text[]) = 'number' THEN ("t"."c" #>> ARRAY[?]::text[])::numeric END` (bindings `['Amount', 'Amount']`) |
| Postgres, cột `jsonb` | như trên với `jsonb_typeof` |
| SQLite | `CASE WHEN json_valid("t"."c") AND json_type("t"."c", ?) IN ('integer', 'real') THEN json_extract("t"."c", ?) END` (bindings `['$.Amount', '$.Amount']`) |

text: `= 'string'` / `#>> '{}'`; SQLite `= 'text'`. boolean: `= 'boolean'` / `::boolean`; SQLite `CASE WHEN ... = 'true'
THEN 1 WHEN ... = 'false' THEN 0 END`.

`[*]` (`operator.ts`, `applyOperator` → `whereExists`):

```sql
-- Postgres, path items[*].sku, text, _eq 'A'
EXISTS (SELECT 1 FROM json_array_elements(CASE WHEN json_typeof("t"."c" #> ARRAY['items']::text[]) = 'array'
          THEN "t"."c" #> ARRAY['items']::text[] ELSE '[]'::json END) AS bo_json_elem(v)
        WHERE (CASE WHEN json_typeof(bo_json_elem.v #> ARRAY['sku']::text[]) = 'string'
               THEN bo_json_elem.v #>> ARRAY['sku']::text[] END) = 'A')
-- SQLite
json_valid("t"."c") AND EXISTS (SELECT 1 FROM json_each("t"."c", '$.items') AS bo_json_elem
        WHERE json_type("t"."c", '$.items') = 'array'
          AND (CASE WHEN json_type("t"."c", bo_json_elem.fullkey || '.sku') = 'text'
               THEN json_extract("t"."c", bo_json_elem.fullkey || '.sku') END) = 'A')
```

### `applyOperator` (`apps/api/src/database/run-ast/lib/apply-query/filter/operator.ts`)

| Chỗ | Trước | Sau |
|-----|-------|-----|
| L34, L96 `key.split('.')` | cắt mọi dấu chấm | cắt ở dấu chấm đầu |
| ép giá trị | theo `getOutputTypeForFunction` (json: không) | json: `number` → `castToNumber`; text, boolean giữ |
| `_empty`, `_nempty`, `_starts_with`, `_nstarts_with`, `_ends_with`, `_nends_with` | identifier `key` | `selectionRaw` |
| thân toán tử | inline | `applyWhere(builder, selectionRaw, operator, compareValue, logical)`; `[*]` gọi trong `whereExists` với `jsonElement` |

### Quyền (`permissions.service.ts`)

`createOne(data)`, `updateMany(keys, data)`: `assertNoJsonPathFilter(data)` trước `super`: `permissions`/`validation`
(chuỗi → `parseJSON`) qua `flattenFilter`; path part bắt đầu `json(` → `InvalidPayloadError` `Permission filters cannot
use a JSON path (json(...))` → 400 `INVALID_PAYLOAD`. Áp dụng cho REST `/permissions` (mọi đường ghi) và GraphQL system
`create_permissions_item`, `update_permissions_item(s)`. Directus: lưu được (D-185).

### Sort, fields (D-184.2)

| Request | Backoffice | Directus 11.17.4 |
|---------|------------|------------------|
| `sort=json(f, p)` | sắp xếp theo giá trị json (như `applySort` hôm nay) | lỗi kiểm quyền path [Inference R6; kiểm lượt 1] |
| `sort=json(f, p, number)` | sắp xếp theo số | như trên |
| `fields=json(f, p, number)` | giá trị số (JSON number); boolean → `true`/`false` trên cả Postgres và SQLite (`parseJsonResult` chuẩn hóa) | 200, giá trị `null` (path `"p, number"`) |
| `fields=json(f, p[*], text)` | 400 (`[*]` chỉ trong filter) | 200 null |

Parity: không đưa các request này vào `sameGql`/`assertParity`; test gửi riêng từng app và ghi D-184.2 (`doc`).
