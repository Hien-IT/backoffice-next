# Data Model: Lọc item bằng so sánh hai field của cùng collection (028)

Không có bảng, cột, migration, dòng `directus_*` hay dependency mới (Nguyên tắc II). Mô hình của feature là **giá trị
động `$FIELD(b)`** trong `filter` của query và cách nó được lưu trong preset.

## Điều kiện so sánh hai field (trong `filter` của query)

| Thành phần | Giá trị | Ràng buộc |
|------------|---------|-----------|
| key (field a) | tên field thường của collection đích (sau quan hệ nếu có: `{ order: { total: {...} } }`) | không hàm (`year(...)`, `json(...)`): 400 |
| toán tử | `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte` | phải nằm trong bảng toán tử DR của kiểu field a (`uuid`, `boolean`: chỉ `_eq`, `_neq`); toán tử khác với chuỗi `$FIELD(...)`: giá trị thường |
| giá trị (field b) | chuỗi `$FIELD(<b>)`; `<b>` sau trim phải khớp `[^\s().,]+` (rỗng, dấu chấm, khoảng trắng: 400, analyze I1) | field b có trong collection của field a, `alias === false`, cùng nhóm kiểu (bảng dưới); khác nhóm, alias, tên sai dạng: 400 `INVALID_QUERY`; b không tồn tại hoặc user không có quyền đọc b: 403 `FORBIDDEN` cho mọi user (kiểm đường dẫn chạy trước, research R3, lượt 1) |

Nhóm kiểu (`fieldCompareGroup`, clarify 2026-11-01 câu 1):

| Nhóm | `type` của field |
|------|------------------|
| number | integer, bigInteger, float, decimal |
| string | string, text |
| boolean | boolean |
| uuid | uuid (gồm m2o tới users) |
| date | date |
| dateTime | dateTime |
| timestamp | timestamp |
| (không) | time, hash, json, csv, geometry.*, binary, alias → 400 |

SQL sinh ra: `WHERE "t"."a" <op> "t"."b"` với `<op>` ∈ `= <> > >= < <=`; một vế NULL → dòng không khớp (clarify câu 4).

Ví dụ trên dòng `{ total: 100, paid_amount: 60, published_at: '2026-01-01T00:00:00Z', updated_at:
'2026-02-01T00:00:00Z', title: 'A', slug: 'a', active: true, featured: null }`:

| Điều kiện | Khớp? |
|-----------|-------|
| `total` `_gt` `$FIELD(paid_amount)` | có |
| `total` `_lte` `$FIELD(paid_amount)` | không |
| `updated_at` `_gt` `$FIELD(published_at)` | có |
| `active` `_neq` `$FIELD(featured)` | không (một vế null) |
| `title` `_eq` `$FIELD(slug)` | không (`A` ≠ `a` trên Postgres/SQLite; MySQL mặc định không phân biệt: có) |
| `total` `_eq` `$FIELD(title)` | 400 (khác nhóm) |
| `total` `_eq` `$FIELD(author.age)` | 400 "a field of the same collection is expected" (qua quan hệ; analyze I1) |
| `title` `_eq` `$field(slug)` | giá trị thường (chữ thường không phải `$FIELD`): 0 dòng |
| `title` `_contains` `$FIELD(slug)` | giá trị thường: LIKE `%$FIELD(slug)%`, 0 dòng |

## Hình dạng GraphQL (ánh xạ 1-1 về REST, research R5)

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
# trong <collection>_filter (scope items), mỗi field thuộc một nhóm kiểu và không alias,
# khi collection không có field thật tên <f>_field:
#   <f>_field: field_compare_operators
```

`{ total_field: { _gt: { field: "paid_amount" } } }` → `{ "total": { "_gt": "$FIELD(paid_amount)" } }`. Có cả
`total` và `total_field` cùng toán tử: `total_field` thắng.

## Preset / bookmark (`directus_presets`, dùng chung với Directus)

| Cột | Thay đổi |
|-----|----------|
| `filter` (json) | không đổi cấu trúc; chứa `"$FIELD(b)"` nguyên văn như mọi giá trị, ví dụ `{"_and": [{"total": {"_gt": "$FIELD(paid_amount)"}}]}` |

Directus app mở preset này gửi cùng filter tới Directus API → kết quả của D-203 cột Directus (đo T002). Backoffice mở
lại → cùng kết quả (FR-010).

## Permission (`directus_permissions`, `backoffice_permissions`)

| Cột | Ràng buộc mới (D-204) |
|-----|------------------------|
| `permissions`, `validation` (json) | khi tạo/sửa qua `/permissions`, GraphQL system hoặc `/backoffice/permissions`, nếu một toán tử trong sáu có giá trị `$FIELD(...)` ở bất kỳ nhánh `_and`/`_or`/`_some`/`_none` → 400 `INVALID_PAYLOAD`; dòng không đổi |

`directus_fields.validation`, `directus_flows`, `directus_operations`: không kiểm (FR-011).
