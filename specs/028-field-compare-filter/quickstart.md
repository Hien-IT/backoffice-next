# Quickstart: Lọc item bằng so sánh hai field của cùng collection (028)

## Bật

Không cấu hình, không migration: chỉ cần API Backoffice (mọi vendor). Gọi domain Directus với `$FIELD` nhận kết quả
Directus (D-203).

## REST

```bash
# total > paid_amount
curl -H "Authorization: Bearer $TOKEN" "$API/items/orders?filter[total][_gt]=\$FIELD(paid_amount)"
```

Dạng JSON: `filter={"total":{"_gt":"$FIELD(paid_amount)"}}`. Với SDK:

```ts
await client.request(readItems('orders', { filter: { total: { _gt: '$FIELD(paid_amount)' } } }));
```

| Muốn | Filter |
|------|--------|
| số với số | `{ total: { _gt: '$FIELD(paid_amount)' } }` |
| ngày giờ với ngày giờ (cùng kiểu lưu) | `{ updated_at: { _gt: '$FIELD(published_at)' } }` |
| chuỗi với chuỗi | `{ title: { _eq: '$FIELD(slug)' } }` (hoa thường theo collation của cột) |
| qua m2o | `{ order: { total: { _gt: '$FIELD(paid_amount)' } } }` (hai field của `orders`) |
| GraphQL | `filter: { total_field: { _gt: { field: "paid_amount" } } }` |

Quy tắc: sáu toán tử `_eq _neq _gt _gte _lt _lte`; hai field cùng collection, cùng nhóm kiểu (số, chuỗi, boolean,
uuid; `date`, `dateTime`, `timestamp` chỉ với cùng kiểu); chuỗi, `uuid` và `boolean` chỉ `_eq`/`_neq`; một vế null
thì không khớp; khác nhóm, alias hay tên sai dạng: 400; field b không có hoặc không có quyền đọc: 403 như lọc thẳng
field b. Toán tử khác
(`_contains`, `_in`...) coi `$FIELD(...)` là chuỗi thường. Permission không nhận `$FIELD` (400 khi lưu).

## Trên app web

Trang Content → **Filter** → **Add Filter** → chọn field `Total` → toán tử **Greater than** → bấm nút ⇄ cạnh ô giá trị
→ chọn `Paid Amount`. Dòng lọc hiện `Total › Greater than › Paid Amount`. Bấm chip để đổi field hoặc chọn **Enter a
value** để nhập giá trị thường. Lưu bookmark như mọi bộ lọc. Bookmark đó mở trên Directus app không chạy được (D-203.1).

## Chạy test

```bash
pnpm nx run api:test -- field-compare operator flatten-filter permissions.service replace-funcs
pnpm nx run web:test -- field-compare InputGroup InputComponent
TEST_DB=postgres pnpm nx run parity-tests:parity -- src/items/field-compare.test.ts
pnpm nx run web-e2e:e2e -- content-filter-field-compare   # ba cấu hình theo profile `web`
```
