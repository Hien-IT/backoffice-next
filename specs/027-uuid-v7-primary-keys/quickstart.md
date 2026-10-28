# Quickstart: Khóa chính uuid tự sinh dùng UUID v7

## Kiểm tra bằng tay

Tạo collection có khóa chính "Generated UUID" (Settings > Data Model > Create Collection > "Generated UUID"), hoặc API:

```bash
curl -X POST "$API/collections" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"collection":"articles","schema":{},"meta":{},"fields":[{"field":"id","type":"uuid","meta":{"hidden":true,"readonly":true,"interface":"input","special":["uuid"]},"schema":{"is_primary_key":true,"length":36,"has_auto_increment":false}},{"field":"title","type":"string"}]}'
```

Tạo item không gửi id, ký tự thứ 15 của id là `7` ở Backoffice, `4` ở Directus 11.17.4 (D-192):

```bash
curl -s -X POST "$API/items/articles" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '[{"title":"a"},{"title":"b"},{"title":"c"}]'
```

Sắp theo id ra thứ tự tạo (Postgres, SQLite đã đo; MSSQL không theo thứ tự tạo):

```bash
curl -s "$API/items/articles?sort=id&fields=title" -H "Authorization: Bearer $TOKEN"
```

Collection hệ thống vẫn v4:

```bash
curl -s -X POST "$API/folders" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"uuid-check"}'
```

## Test

```bash
pnpm nx test api -- payload.service
```

```bash
pnpm nx run parity-tests:parity -- src/items/uuid-v7.test.ts src/flows/operations.test.ts
```

Vendor khác: bật env bằng `pnpm nx run parity-tests:env-up --vendor=<vendor>` rồi đặt `TEST_DB`, vì cờ `--vendor` không
tới script khi có `--` để lọc file:

```bash
TEST_DB=sqlite3 PARITY_SUITE=reduced pnpm nx run parity-tests:parity -- src/items/uuid-v7.test.ts
```

## Rollback

Trả transformer `uuid` về `randomUUID()`; id v7 đã ghi vẫn hợp lệ ở cả hai app, không cần đổi dữ liệu.
