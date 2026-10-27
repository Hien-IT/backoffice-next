# Quickstart: API chặn tìm kiếm, Import, Export theo cài đặt của collection

## Bật tắt

Settings > Data Model > collection > card "Content: Search, Import, Export" (022), hoặc API:

```bash
curl -X PATCH "$API/collections/articles" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"meta":{"bo_show_search":false,"bo_show_import":false,"bo_show_export":false}}'
```

Có tác dụng từ request sau trên mọi replica Backoffice (cả khi lưu ở Directus app). Sửa thẳng SQL thì xóa cache:

```bash
curl -X POST "$API/utils/cache/clear" -H "Authorization: Bearer $TOKEN"
```

## Kiểm tra bằng tay

```bash
curl -i "$API/items/articles?search=abc" -H "Authorization: Bearer $TOKEN"          # 403 FORBIDDEN
curl -i "$API/items/articles" -H "Authorization: Bearer $TOKEN"                     # 200
curl -i "$API/items/articles?export=csv" -H "Authorization: Bearer $TOKEN"          # 403
curl -i -X POST "$API/utils/import/articles" -H "Authorization: Bearer $TOKEN" -F file=@rows.csv   # 403
curl -s -X POST "$API/graphql" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"{ articles(search: \"abc\") { id } }"}'                             # 200, errors[0].extensions.code = FORBIDDEN
```

Cùng request gửi tới Directus 11.17.4 trả 200 (D-188). Ở compose shared-domain, lb chia request cho cả Directus nên
request có thể không bị chặn; dùng `docker-compose.standalone.yml` hoặc override separate-domain để chặn đủ.

## Web

- Content của collection tắt search: không ô nhập từ khóa, nút Filter vẫn có (022).
- Drawer chọn item (field m2o/o2m/m2m) của collection đó: không ô nhập từ khóa, nút Filter vẫn có (024).
- Interface `list-o2m`/`list-m2m` có "Search Filter": ô search ẩn khi collection nhận từ khóa (o2m: collection liên
  quan; m2m: collection trung gian) tắt search.

## Test

```bash
pnpm nx test api -- collection-toggles
pnpm nx test web -- DrawerCollection ListO2M ListM2M
pnpm nx run parity-tests:parity -- src/items/collection-toggles.test.ts
E2E_CONFIG=proxy-api pnpm nx e2e web-e2e -- content-collection-toggles.spec.ts
```

## Rollback

Bật lại ba cài đặt (`true`) hoặc để `null`; không có dữ liệu riêng để gỡ.
