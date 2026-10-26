# Quickstart: Lọc item theo path trong field json (023)

## Bật

Không cấu hình, không migration: chỉ cần API Backoffice (Postgres hoặc SQLite). Ở chế độ shared-domain (lb có cả
Directus trong `api_pool`), request có path json rơi vào Directus nhận 403 `FORBIDDEN` (D-184): gọi qua domain riêng của Backoffice
(separate-domain) hoặc chấp nhận.

## REST

```bash
# Amount = 6000 (số JSON)
curl -H "Authorization: Bearer $TOKEN" \
  "$API/items/transactions?filter=%7B%22json(transaction_data,%20Amount,%20number)%22:%7B%22_eq%22:6000%7D%7D"
```

Dạng chưa encode: `filter={"json(transaction_data, Amount, number)":{"_eq":6000}}`. Với SDK:

```ts
await client.request(readItems('transactions', {
  filter: { 'json(transaction_data, Amount, number)': { _eq: 6000 } },
}));
```

| Muốn | Key | Toán tử |
|------|-----|---------|
| chuỗi tại path | `json(f, ApprovalCode)` hoặc `json(f, ApprovalCode, text)` | của field chuỗi: `_eq`, `_contains`, `_starts_with`, `_in`, `_empty`... |
| số tại path | `json(f, Amount, number)` | của field số: `_eq`, `_gt`, `_between`, `_in`... |
| boolean tại path | `json(f, flag, boolean)` | `_eq`, `_neq`, `_null`, `_nnull` |
| phần tử bất kỳ của mảng | `json(f, items[*].sku, text)` | như trên; khớp khi có ít nhất một phần tử thỏa |
| qua quan hệ m2o | `{ "order": { "json(transaction_data, Amount, number)": { "_gt": 100 } } }` | — |
| GraphQL | `filter: { transaction_data_json: { path: "Amount", number: { _eq: 6000 } } }` | — |

Quy tắc: kiểu phải đúng kiểu JSON (chuỗi `"6000"` không khớp `number`); dòng không có path, `null` hoặc khác kiểu
không khớp (chỉ `_null` khớp); path có `[` `]` phải gửi `filter` dạng JSON (dạng `filter[...]` của query string cắt
ngoặc vuông); `[*]` một lần; tối đa 10 cấp.

## Trên app web

Trang Content hoặc drawer chọn item → **Filter** → **Add Filter** → mở field json → **JSON path** → nhập path
(`Amount`, `items[*].sku`), chọn kiểu (Text, Number, Boolean) → **Apply** → chọn toán tử và giá trị. Lưu bookmark như
mọi bộ lọc. Bookmark này mở trên Directus app sẽ báo lỗi (D-184.1).

## Index (Postgres, tùy chọn)

Lọc theo path quét cả bảng. Tạo expression index **đúng biểu thức** của app (CASE bọc kiểm kiểu, nên index trên
`(col->>'Amount')` không được dùng):

```sql
-- cột json, kiểu number tại Amount
CREATE INDEX transactions_amount ON transactions
  ((CASE WHEN json_typeof(transaction_data #> ARRAY['Amount']) = 'number'
         THEN (transaction_data #>> ARRAY['Amount'])::numeric END));
-- cột jsonb: thay json_typeof bằng jsonb_typeof
-- kiểu text:    CASE WHEN json_typeof(col #> ARRAY['k']) = 'string'  THEN col #>> ARRAY['k'] END
-- kiểu boolean: CASE WHEN json_typeof(col #> ARRAY['k']) = 'boolean' THEN (col #>> ARRAY['k'])::boolean END
-- path lồng: ARRAY['items','0','sku']
ANALYZE transactions;
```

`[*]` không dùng được index. Số đo trên seed 10 triệu dòng: research "Kết quả lượt 3".

## Lỗi thường gặp

| Thông báo | Nguyên nhân |
|-----------|-------------|
| `You don't have permission to access field "transaction_data, Amount, number"` (403 `FORBIDDEN`) | request tới Directus (shared-domain hoặc Directus app); Directus đọc cả `"field, path, type"` là tên field |
| `Filtering by a JSON path is not supported on mysql` | vendor ngoài Postgres, SQLite |
| `Invalid json() syntax: unknown type "money"` | `type` phải là `text`, `number`, `boolean` |
| `"float" field type does not contain the "_contains" filter operator` | toán tử không thuộc kiểu đã chọn |
| `Permission filters cannot use a JSON path` (400) | permission/policy không được dùng path json (D-185) |
| 403 | không có quyền đọc field json gốc |

## Chạy test

```bash
pnpm nx run api:test -- --filter json           # unit API
pnpm nx run parity-tests:env-up                   # env Postgres
pnpm nx run parity-tests:parity -- src/items/json-path.test.ts
TEST_DB=sqlite3 pnpm nx run parity-tests:parity -- src/items/json-path.test.ts
E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- content-filter-json-path
gh workflow run benchmark.yml -f job=benchmark-items
```
