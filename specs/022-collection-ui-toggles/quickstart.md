# Quickstart: Ẩn hiện ô tìm kiếm, Import, Export theo collection (022)

## Bật cho một DB

Không làm gì: container Backoffice chạy `node cli.js bootstrap && exec node cli.js start`; `bootstrap` chạy migration
Directus (Postgres, SQLite) rồi migration riêng của Backoffice trên mọi vendor. Log:

```
Running migrations...
Running Backoffice migrations...
Applying Add Collection UI Toggles...
Done
```

Lần sau: `Backoffice migrations are up to date`. Nhiều replica khởi động cùng lúc: một replica chạy, các replica khác
chờ khóa Redis `directus:lock:backoffice-migrations` rồi thấy đã xong. Chế độ độc lập: service `bootstrap` của compose
hoặc Job Helm chạy, replica chỉ `start`.

Vendor ngoài Postgres, SQLite (MySQL, MariaDB, MSSQL, Oracle, CockroachDB): DB phải do Directus cài và migrate xong
(D-145); `bootstrap` của Backoffice thấy đủ migration Directus thì chạy migration riêng.

`start` trên DB chưa có migration riêng:

```
Backoffice migrations do not match.
Missing Backoffice migrations (not run yet): 20261026A
Run "node cli.js bootstrap" to apply them.
```

```bash
docker exec <container> node cli.js bootstrap
```

## Dùng

Settings > Data Model > collection: ba toggle **Show Search**, **Show Import**, **Show Export** (vi-VN: Hiện ô tìm
kiếm, Hiện Import, Hiện Export), cuối form; mặc định bật. Lưu rồi tải lại trang Content của collection:

| Tắt | Trang Content |
|-----|---------------|
| Show Search | không có ô nhập từ khóa; nút bộ lọc còn; từ khóa trong bookmark không được gửi |
| Show Import | mục Import/Export không có phần import |
| Show Export | không có nút Export và link tải CSV của trang |
| cả Import và Export | không có mục Import/Export |

Áp dụng cho mọi người dùng, kể cả admin. API không đổi: `?search=`, `?export=`, `/utils/import`, `/utils/export` vẫn
chạy theo permission.

Qua API:

```bash
curl -X PATCH "$URL/collections/bo_content" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"meta":{"bo_show_search":false,"bo_show_import":false,"bo_show_export":true}}'
```

## Directus 11.17.4 chạy chung

Không cần file, biến môi trường hay cấu hình mới. Directus thấy:

- ba toggle trong form collection của Directus app (không có tác dụng ở Content của Directus app);
- bảng `backoffice_migrations` trong nhóm bảng chưa quản lý của Data Model (admin). Backoffice coi nó là collection
  hệ thống (ẩn, 403 ở `/items`, D-181). Muốn Directus app cũng không thấy thì thêm `DB_EXCLUDE_TABLES=
  spatial_ref_sys,sysdiagrams,backoffice_migrations` ở cả hai app (tùy chọn, không bắt buộc; giá trị mặc định có hai
  bảng đầu).

`migrate:latest|up|down` của Directus không đổi: `directus_migrations` không có dòng của Backoffice.

## Rollback (tay)

Không có lệnh down. Trên DB:

```sql
ALTER TABLE directus_collections DROP COLUMN bo_show_search, DROP COLUMN bo_show_import, DROP COLUMN bo_show_export;
DELETE FROM directus_fields WHERE collection = 'directus_collections' AND field IN ('bo_show_search','bo_show_import','bo_show_export');
DELETE FROM backoffice_migrations WHERE version = '20261026A';
```

(SQLite: `DROP COLUMN` từng cột, SQLite ≥ 3.35.) Rồi `node cli.js cache clear --system` hoặc khởi động lại. Bản
Backoffice có migration này sẽ chạy lại nó ở lần `bootstrap` sau.

## Thêm migration riêng (dev)

1. `apps/api/src/database/backoffice-migrations/YYYYMMDDA-<ten>.ts`: export `version`, `name`, `up(knex)`; chỉ bảng
   `backoffice_*`, cột `bo_*`, dòng `directus_fields` của cột đó; `up` chạy lại được.
2. Thêm vào `BACKOFFICE_MIGRATIONS` của `index.ts`.
3. Test SQLite in-memory chạy `up` hai lần; `dump.ts` của parity bỏ cột `bo_*` mới nếu ở bảng khác.
4. `pnpm nx run parity-tests:env-up --vendor=postgres --profiles=bootstrap` rồi `parity-tests:test --profiles=bootstrap`.

## Nâng Directus

Trước khi ghim bản sau 11.17.4: `grep -rn "bo_\|backoffice_" directus/api/src/database/migrations` phải rỗng.
