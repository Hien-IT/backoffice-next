# Quickstart: Index ghép, index trigram và tạo index không khóa bảng (030)

## Bật

Không biến môi trường mới. Cần `bootstrap` (hoặc `init`) đã chạy sau khi nâng cấp: migration riêng `20261103A` tạo
`backoffice_indexes`; `start` trên DB thiếu migration dừng với lỗi như 022. Trigram cần Postgres và quyền
`CREATE EXTENSION pg_trgm` (Postgres ≥ 13: chủ DB đủ; không có quyền thì DBA chạy `CREATE EXTENSION pg_trgm;` một lần).

## Tạo index unique ghép (ví dụ `passenger_auth_identities (provider, provider_subject)`)

Settings > Data Model > `passenger_auth_identities` → card "Indexes" (cuối trang) → "Add index" → chọn `provider`, rồi
`provider_subject` (thứ tự = thứ tự cột; đổi bằng kéo thả hoặc menu Move up/down) → bật "Unique" → Create. Dòng hiện
"Creating…" rồi "Ready" (card tự làm mới mỗi 5 giây).

Bằng API (token admin):

```bash
curl -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"fields":["provider","provider_subject"],"unique":true}' \
  "$API/backoffice/collections/passenger_auth_identities/indexes"      # → 202, status creating
curl -H "Authorization: Bearer $TOKEN" "$API/backoffice/collections/passenger_auth_identities/indexes"   # poll tới ready
```

Tên index: `passenger_auth_identities_provider_provider_subject_unique` (tự sinh). Từ đó ghi trùng cặp giá trị trả 400
`RECORD_NOT_UNIQUE` với hai mục `provider`, `provider_subject` ở Backoffice; Directus cùng DB cũng từ chối (lỗi của DB).

## Tăng tốc tìm kiếm (Postgres)

Cùng card → "Add index" → một field chuỗi (ví dụ `name`) → type "Trigram (contains, PostgreSQL)" → Create. Filter
`?filter[name][_icontains]=...` với từ khóa từ 3 ký tự dùng index. `?search=` thì không chắc: nó nối OR mọi cột chuỗi và
sắp theo khóa chính, nên ở bảng lớn planner vẫn có thể quét (FR-024: 10M dòng không nhanh hơn, 2M dòng dùng index).

## Tạo trên bảng lớn

Mặc định không khóa bảng (Postgres `CONCURRENTLY`, MySQL `INPLACE LOCK=NONE` rồi tự rơi về cách thường, SQLite luôn khóa);
tắt bằng `?concurrentIndexCreation=false` hoặc công tắc trong dialog. Request trả 202 ngay; theo dõi trạng thái bằng GET.
SIGTERM trong lúc tạo: dòng thành `failed` "Server shutdown"; xóa dòng dọn index dở dang rồi tạo lại.

## Xóa

Card → nút xóa → xác nhận; hoặc `DELETE $API/backoffice/collections/<c>/indexes/<name>` (204). Xóa một field nằm trong
index: hộp thoại xóa field nêu các index sẽ bị gỡ; API gỡ index trước rồi xóa cột (mọi vendor). Directus xóa cột hay
DBA xóa index: dòng hiện "Missing on the database", xóa dòng được.

## Chạy test

```bash
pnpm nx run api:test -- backoffice-indexes                       # unit API
pnpm nx run web:test:unit -- collection-indexes                  # unit web
TEST_DB=postgres pnpm nx run parity-tests:parity -- schema/indexes   # parity (lặp với sqlite, mysql)
E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- settings-data-model-indexes
```

## Gỡ tay

`DROP INDEX <name>` cho từng index (Postgres/SQLite; MySQL `ALTER TABLE <t> DROP INDEX <name>`), `DROP TABLE
backoffice_indexes`, xóa dòng `20261103A` trong `backoffice_migrations`.
