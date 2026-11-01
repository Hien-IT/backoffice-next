# Contract: API REST (D-203, D-204)

## Query (`GET`/`SEARCH /items/:collection`, `?export=`, `POST /utils/export/:collection`)

Không path, query, response, status, header mới. Chỉ giá trị của `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte` nhận
thêm dạng `$FIELD(<b>)` (FR-001..FR-007). Cột Directus ghi dự đoán [Unverified], T002 đo và sửa bảng này.

| Request (admin, trừ dòng ghi user) | Backoffice | Directus 11.17.4 |
|------------------------------------|------------|------------------|
| `GET /items/c?filter[total][_gt]=$FIELD(paid_amount)` | 200, item có `total > paid_amount` | 400 `INVALID_QUERY` "Invalid numeric value" [Unverified] |
| `...?filter={"updated_at":{"_gt":"$FIELD(published_at)"}}` | 200 | lỗi parse ngày [Unverified: 400 hoặc 500] |
| `...?filter[title][_eq]=$FIELD(slug)` | 200, item có `title = slug` | 200, 0 dòng (so với chuỗi) [Unverified] |
| `...?filter[active][_neq]=$FIELD(featured)` | 200, không dòng nào có một vế null | 400 hoặc 200/0 dòng [Unverified] |
| `...?filter[total][_eq]=$FIELD(title)` | 400 `INVALID_QUERY` `"$FIELD(title)" must be a number field like "total" (got string)` | 400 "Invalid numeric value" |
| `...?filter[total][_eq]=$FIELD(nope)` | 400 `INVALID_QUERY` `"$FIELD(nope)": unknown field "nope" in collection "c"` (admin); user thường: 403 `FORBIDDEN` (kiểm quyền path trước, research R3) | 400 "Invalid numeric value" |
| `...?filter[total][_eq]=$FIELD(tags)` (o2m alias) | 400 `"$FIELD(tags)" must be a column field` | 400 |
| `...?filter[total][_eq]=$FIELD(author.age)`, `$FIELD()`, `$FIELD(a b)` | 400 `INVALID_QUERY` `"$FIELD(author.age)": a field of the same collection is expected (no relation, no spaces)` (analyze I1) | 400 ép số (field số) / 200, 0 dòng (field chuỗi) |
| `...?filter[title][_eq]=$field(slug)` hoặc `$FIELD(slug` | 200, chuỗi thường như Directus | 200 |
| `...?filter[total][_null]=$FIELD(x)` | 400 "_null has to be a boolean" như Directus (analyze I2) | 400 |
| `...?filter[year(published_at)][_eq]=$FIELD(x)` | 400 `"$FIELD(...)" is only allowed on a plain field` | 400 (ép số) |
| `...?filter[title][_contains]=$FIELD(slug)` | 200, LIKE chuỗi thường, như Directus | 200 |
| `...?filter[total][_in]=$FIELD(paid_amount)` | 200, `IN ('$FIELD(paid_amount)')` → 400 ép số, như Directus | 400 |
| user không có quyền đọc `paid_amount`, `filter[total][_gt]=$FIELD(paid_amount)` | 403 `FORBIDDEN` như lọc thẳng `paid_amount` (FR-006) | 403 nếu không có quyền `total`; có quyền `total`: 400 ép số |
| `{ order: { total: { _gt: "$FIELD(paid_amount)" } } }` (qua m2o, hai field của `orders`) | 200 | 400 |
| `SEARCH /items/c` body `{ query: { filter: {...} } }`, `?export=csv`, `POST /utils/export/c` | như GET | như GET |
| `GET /users?filter[first_name][_eq]=$FIELD(last_name)` (collection hệ thống, cùng engine; CHK002) | 200, so hai field; parity không đo, D-203 ghi | như `/items` (chuỗi: 0 dòng) [Unverified] |

`meta=filter_count`: đếm theo cùng điều kiện. `_and`/`_or`: như mọi giá trị. Response cache: key theo query, không đổi.

### `applyOperator` (`apps/api/src/database/run-ast/lib/apply-query/filter/operator.ts`)

| Chỗ | Trước | Sau (Backoffice spec 028, D-203) |
|-----|-------|----------------------------------|
| sau khi tách `column` (:41), trước nhánh json (:44) | — | `operator` ∈ sáu toán tử và `parseFieldCompare(compareValue)` = `b` → `column` không hàm (400), `assertFieldCompare(schema, mappedCollection, column, b)`, `dbQuery[logical].where(selectionRaw, FIELD_COMPARE_SQL[operator], getColumn(knex, table, b, false, schema, { originalCollectionName }))`, `return` |
| `applyWhere`, `cast` | không đổi | không đổi (không tới với `$FIELD`) |

### `field-compare.ts` (mới, `apps/api/src/database/run-ast/lib/apply-query/filter/`)

```ts
export const FIELD_COMPARE_OPERATORS = ['_eq', '_neq', '_gt', '_gte', '_lt', '_lte'] as const;
export const FIELD_COMPARE_SQL: Record<FieldCompareOperator, '=' | '<>' | '>' | '>=' | '<' | '<='>;
export type FieldCompareGroup = 'number' | 'string' | 'boolean' | 'uuid' | 'date' | 'dateTime' | 'timestamp';
export function parseFieldCompare(value: unknown): string | null;        // '$FIELD(b)' → 'b'; '$FIELD(a.b)' → 'a.b' (assert 400); '$field(b)' → null
export function fieldCompareGroup(type: Type): FieldCompareGroup | null;
export function assertFieldCompare(schema: SchemaOverview, collection: string, fieldA: string, fieldB: string): void; // InvalidQueryError
export function hasFieldCompare(filter: unknown): boolean;               // cho D-204
```

### Quyền (`apps/api/src/permissions/modules/process-ast/utils/flatten-filter.ts`)

Nhánh toán tử (:23-26): thêm `[...parts.slice(0, -1), b]` vào `paths` khi `key` ∈ sáu toán tử và giá trị là
`$FIELD(b)`. Hệ quả: field b vào `readOnlyPaths` → kiểm tồn tại và quyền đọc như một filter key (403 `FORBIDDEN`).

## Permission (`POST/PATCH /permissions`, GraphQL `create/update_directus_permissions_item(s)`, `/backoffice/permissions`)

| Request | Backoffice | Directus |
|---------|------------|----------|
| `permissions` hoặc `validation` có `{ "total": { "_gt": "$FIELD(paid_amount)" } }` | 400 `INVALID_PAYLOAD` `Permission filters cannot compare two fields ($FIELD(...))` (D-204) | 200 |
| `POST /fields`, `/flows`, `/operations` với `$FIELD` | 200 như Directus | 200 |

`assertNoJsonPathFilter` (`services/permissions.service.ts:204`) → `assertNoBackofficeFilter` (json path + `$FIELD`),
gọi ở `createOne`, `updateMany` của `PermissionsService` và `BackofficePermissionsService`.
