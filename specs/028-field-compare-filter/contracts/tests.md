# Contract: Test (FR-016, SC-002..SC-007)

## Unit (`apps/api`, Vitest, mock knex `Client_SQLite3` + `Client_PG` như 023)

| File | Case |
|------|------|
| `filter/field-compare.test.ts` (mới) | `parseFieldCompare` (đúng dạng, có dấu chấm, khoảng trắng, không ngoặc, không chuỗi); `fieldCompareGroup` bảng; `assertFieldCompare` (không có, alias, khác nhóm, date với timestamp, integer với decimal); `hasFieldCompare` (lồng `_and`/`_or`/`_some`) |
| `filter/operator.test.ts` | sáu toán tử → `"t"."a" <op> "t"."b"` không binding; `_neq` là `<>`; qua alias quan hệ dùng cùng alias; `_contains` với `$FIELD` là LIKE chuỗi thường; `year(x)` với `$FIELD` 400; không gọi `cast` |
| `permissions/.../flatten-filter.test.ts` | `{ a: { _gt: '$FIELD(b)' } }` → paths `[['a'], ['b']]`; lồng `{ order: { a: {...} } }` → `['order','b']`; `_in` với `$FIELD` không thêm |
| `services/permissions.service.test.ts`, `backoffice-permissions.service.test.ts` | `permissions`/`validation` có `$FIELD` → `InvalidPayloadError` ở createOne/updateMany; json path vẫn bị chặn |
| `graphql/utils/replace-funcs.test.ts` | `replaceFieldCompares` gộp, `_field` thắng, bỏ qua object không đúng dạng; `withBackofficeFilters` |
| `graphql/schema/index.test.ts` | `total_field` có ở items, không ở system, không khi có field thật `total_field`, không cho alias/json |

## Unit (`apps/web`)

| File | Case |
|------|------|
| `utils/field-compare.test.ts` (mới) | parse/format/group |
| `system-filter/InputGroup.test.ts` | nút chỉ với prop + sáu toán tử + nhóm; menu lọc cùng nhóm, trừ field a và alias, `(key)` khi trùng tên; chọn → emit `$FIELD(key)`; chip; field mất → chip lỗi; `field_compare_value` → null |
| `system-filter/InputComponent.test.ts` | `$FIELD(x)` hợp lệ ở field integer/uuid |
| `SystemFilter.browser.test.ts`, `modules/content/a11y.browser.test.ts` | bàn phím, axe |
| `CollectionRoute`/`DrawerCollection` test | prop bật/tắt |

## Parity (`tests/parity`, env chính, bộ `full` + `reduced` mọi vendor)

| File | Nội dung |
|------|----------|
| `src/items/field-compare.test.ts` (mới) | collection `parity_field_compare_<run>` (research R8); sáu toán tử × nhóm số, ngày giờ, chuỗi, boolean, uuid; null; m2o; export; `SEARCH`; user thiếu quyền b (403 cả hai app: `assertParity`); khác nhóm/không có (Backoffice 400, Directus 400: so status); T002: cùng request và bookmark gửi Directus, ghi kết quả vào spec D-203/D-203.1 và `contracts/api.md`; chỗ Directus 200 khác body: so riêng từng app |
| `accepted-differences.ts` | D-203 `http` (`when` theo T002), D-203.1/D-205/D-206 `doc`, D-204 `http` `INVALID_PAYLOAD` |
| `src/suite.ts`, `src/vendors.test.ts` | thêm file vào `full` và `reduced` |
| `src/normalizers.ts` (+ test), `src/parity.ts` | bỏ `field_compare_operators`, `field_ref`, `*_field` khỏi introspection/SDL |
| `src/graphql/read.test.ts` | khối "spec 028 D-205" chỉ Backoffice: so tập id với REST (SC-004) |
| `src/permissions/...` | permission có `$FIELD` 400 (D-204) |

## E2E (`apps/web-e2e`, ba cấu hình)

`src/content-filter-field-compare.spec.ts`: US2 chuột + bàn phím, bookmark, chip, DrawerCollection không có nút;
`proxy-directus`: mong hành vi Directus đo ở T002 (SC-005).

## Không có

Benchmark (research R11); migration; DDL.
