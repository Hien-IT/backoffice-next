# Data Model: Lọc item theo path trong field json (023)

Không có bảng, cột, migration hay dòng `directus_*` mới (Nguyên tắc II giữ nguyên). Mô hình dữ liệu của feature là
**điều kiện lọc** trong query và cách nó được lưu trong preset.

## Điều kiện lọc theo path json (trong `filter` của query)

| Thành phần | Giá trị | Ràng buộc |
|------------|---------|-----------|
| key | `json(<field>, <path>, <type>)` | `<field>`: tên field kiểu json của collection đích (sau quan hệ m2o nếu có: `{ order: { "json(...)": {...} } }`); `<path>`: cú pháp của `json(field, path)` hiện có (`Amount`, `a.b`, `items[0].sku`) + đúng một `[*]`; `<type>` ∈ `text`, `number`, `boolean`, thiếu = `text`; nhiều hơn 3 tham số hoặc `type` lạ: 400 `INVALID_QUERY` |
| toán tử | theo `getFilterOperatorsForType(jsonFilterType(type))` | text → `string` (`eq neq contains ncontains icontains starts_with ... empty nempty null nnull in nin`), number → `float` (`eq neq lt lte gt gte between nbetween null nnull in nin`), boolean → `boolean` (`eq neq null nnull`); toán tử ngoài danh sách: 400 |
| giá trị | như field cùng kiểu | number: ép số (`castToNumber`, lỗi → 400); boolean: `true`/`false` (đã được `parseFilter` đổi từ chuỗi); text: chuỗi |

**Giá trị có kiểu** `T(path, type)` của một dòng (R4): giá trị JSON tại path khi đúng kiểu; **SQL NULL** khi field null,
path không có, JSON `null`, hoặc giá trị khác kiểu (kể cả object/mảng). Toán tử áp dụng trên `T`, nên NULL không khớp
mọi toán tử trừ `_null` (và `_empty` của Text).

**`[*]`** (`before[*]after`): dòng khớp khi tồn tại phần tử `e` của mảng tại `before` sao cho `T(e, after, type)`
thỏa toán tử; `before` không phải mảng, mảng rỗng, field null: không khớp mọi toán tử (kể cả `_null`, `_neq`).

Ví dụ trên `transaction_data = {"Amount": 6000, "ApprovalCode": "940172", "Currency": "VND", "items": [{"sku": "A"},
{"sku": 2}, "z"]}`:

| Điều kiện | Khớp? |
|-----------|-------|
| `json(transaction_data, Amount, number)` `_eq` `6000` | có |
| `json(transaction_data, Amount, text)` `_eq` `"6000"` | không (số JSON, không phải chuỗi) |
| `json(transaction_data, ApprovalCode)` `_starts_with` `"94"` | có (type mặc định text) |
| `json(transaction_data, items[*].sku, text)` `_eq` `"A"` | có |
| `json(transaction_data, items[*].sku, number)` `_gt` `1` | có (phần tử thứ hai) |
| `json(transaction_data, items[*].sku, text)` `_neq` `"A"` | không (không phần tử nào có `sku` là chuỗi khác "A": `{"sku": 2}` là số → `T` NULL; `"z"` không có `sku` → `T` NULL) |
| `json(transaction_data, Missing, number)` `_null` `true` | có |
| `json(transaction_data, items[*].sku, text)` `_null` `true` | có (phần tử `{"sku": 2}` khác kiểu, `"z"` thiếu `sku`) |

## Hình dạng GraphQL (ánh xạ 1-1 về key REST, R7)

```graphql
input json_path_filter_operators {
  path: String!
  text: string_filter_operators
  number: number_filter_operators
  boolean: boolean_filter_operators
}
# trong <collection>_filter, mỗi field json f:
#   f_json: json_path_filter_operators
```

`{ transaction_data_json: { path: "Amount", number: { _eq: 6000 } } }` → `{ "json(transaction_data, Amount, number)": {
_eq: 6000 } }`. Đúng một trong `text`/`number`/`boolean`; thiếu hoặc thừa: lỗi `INVALID_QUERY`.

## Preset / bookmark (`directus_presets`, dùng chung với Directus)

| Cột | Thay đổi |
|-----|----------|
| `filter` (json) | không đổi cấu trúc; chứa key `json(field, path, type)` nguyên văn như mọi key khác, ví dụ `{"_and": [{"json(transaction_data, Amount, number)": {"_eq": "6000"}}]}` |

Directus app mở preset này gửi cùng filter tới Directus API → 403 `FORBIDDEN` (D-184.1, đo ở T002). Backoffice mở lại → cùng kết quả (FR-016).

## Field json (`directus_fields.type = 'json'`)

| Vendor | Cột DB | Đọc là | Lọc theo path |
|--------|--------|--------|---------------|
| Postgres | `json` (do app tạo) hoặc `jsonb` (tạo tay) | field `json` (`get-local-type.ts:72-73`) | có, biểu thức theo `dbType` (`json_typeof`/`jsonb_typeof`, `json_array_elements`/`jsonb_array_elements`) |
| SQLite | `json` (text) | field `json` | có (`json_type`, `json_extract`, `json_each`, guard `json_valid`) |
| MySQL/MariaDB, MSSQL, Oracle, CockroachDB, Redshift | theo vendor | field `json` | không: 400 `INVALID_QUERY` "Filtering by a JSON path is not supported on <client>" |

Không đổi schema, không đổi dữ liệu đã lưu.

## Permission (`directus_permissions`)

| Cột | Ràng buộc mới (D-185) |
|-----|------------------------|
| `permissions`, `validation` (json) | khi tạo/sửa qua `/permissions` hoặc GraphQL system, nếu có key bắt đầu bằng `json(` ở bất kỳ nhánh `_and`/`_or`/`_some`/`_none` → 400 `INVALID_PAYLOAD`; dòng không đổi |

`directus_fields.validation`, `directus_flows`, `directus_operations`: không kiểm (clarify câu 5).
