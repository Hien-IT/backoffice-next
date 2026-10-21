# Data Model: Chạy độc lập (021)

Feature không thêm bảng, cột hay khóa Redis. Bảng hệ thống do seed tạo và 101 migration sửa đúng như Directus 11.17.4.

## Bảng `directus_migrations` (seed `15-migrations.yaml`, chung với Directus)

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `version` | string, khóa chính, not null | phần trước `-` đầu tiên của tên file migration (`20201028A`, hoặc version của custom migration) |
| `name` | string(255), not null | tiêu đề từ phần còn lại của tên file qua `formatTitle` (`remove-collection-foreign-keys` → `Remove Collection Foreign Keys`) |
| `timestamp` | timestamp, default `$now` | DB điền khi insert; `migrate:down` chọn hàng theo (`timestamp`, `version`) giảm dần |

Ràng buộc: `version` duy nhất trong tập (101 hệ thống ∪ custom); trùng → lỗi "Migration keys collide!" trước khi ghi.
Chuyển trạng thái của một migration: `chưa chạy` → (`up()` thành công) → `đã chạy` (có hàng) → (`down()` thành công) →
`chưa chạy` (xóa hàng). Hàng chỉ ghi sau `up()` xong; không transaction bao ngoài (như Directus).

## Migration hệ thống (101 file)

| Thuộc tính | Giá trị |
|------------|---------|
| tên file | `YYYYMMDD[A-Z]-<ten-kebab>.ts` (dist: `.js`), khớp `^[0-9]+[A-Z]-[^.]+\.(js|ts)$` |
| vị trí | `apps/api/src/database/migrations/` → `/directus/dist/database/migrations/` |
| export | `up(knex)`, `down(knex)` |
| nguồn | `directus/api/src/database/migrations/<file>`, header dòng 1, 9 specifier thay thế (research R4) |
| danh sách | `DIRECTUS_MIGRATIONS` (101 version) = tập version của thư mục (test) |

## Custom migration

| Thuộc tính | Giá trị |
|------------|---------|
| tên file | có `-`, đuôi `.js`/`.cjs`/`.mjs`; `.ts` bị bỏ qua |
| vị trí | `MIGRATIONS_PATH` (mặc định `./migrations` → `/directus/migrations` trong image) |
| cách đến pod | compose: volume `migrations`; Kubernetes: ConfigMap `migrations.configMap` mount `/directus/migrations`, hoặc file trong image |
| chạy bởi | `migrate:latest|up|down`, `bootstrap` (latest) của Directus hoặc Backoffice trên cùng thư mục |
| kiểm tra lúc `start` | 001: version phải có hàng (thiếu → dừng), hàng không có file → dừng |

## Seed (15 file)

| Thuộc tính | Giá trị |
|------------|---------|
| tên file | `NN-<bang>.yaml` (`01-collections` … `15-migrations`), đọc theo thứ tự tên, bỏ file bắt đầu `run` |
| nội dung | `table`, `columns.{name}.{type, primary, nullable, default, length, increments, unsigned, unique, references}` |
| đặc biệt | `length: MAX_TABLE_NAME_LENGTH|MAX_COLUMN_NAME_LENGTH` theo helper schema của vendor; `default: $now` → `fn.now()`; default object/array → JSON string; `type: alias|unknown` bỏ; `geometry*` qua helper `st` |
| điều kiện | lỗi `Database is already installed` khi có `directus_collections` |

## Lệnh CLI

| Lệnh | Điều kiện DB | Ghi | Thoát |
|------|--------------|-----|-------|
| `bootstrap [--skipAdminInit]` | chờ 5×5 s | trống: seed, latest, admin, settings; đã cài: latest | 0; lỗi 1; vendor khác: trống 1, đã cài 0 (D-145) |
| `database install` | trống | seed | 0; đã cài 1 |
| `database migrate:latest|up|down` | đã cài | theo bảng migrations | 0; `Nothing to upgrade/downgrade` 1; vendor khác 1 |
| `users create|passwd`, `roles create`, `count`, `cache clear`, `schema snapshot|apply`, `security *` | theo Directus | theo Directus | theo contracts/cli.md |
| `init` | thư mục trống | seed + latest (DB mới), `.env`, admin | 0; 5 lần lỗi 1 |
| `start` | đã cài, migration khớp | không | chạy server; lệch 1 (001) |

Mọi lệnh: nạp extension trước (nếu `DB_CLIENT`, đã cài, migration không thiếu), phát `cli.before`/`cli.after`.

## Chế độ triển khai

| Chế độ | Compose | Helm | Ai chạy `bootstrap` | Replica chạy |
|--------|---------|------|---------------------|--------------|
| `shared` (019, mặc định) | `docker-compose.yml` (+ override 019/020) | `mode: shared` | Directus (CMD image) và từng replica Backoffice (CMD image, Q1) | CMD image: `bootstrap` rồi `start` |
| `standalone` (021) | `+ docker-compose.standalone.yml` | `mode: standalone` | service `bootstrap` một lần / Job hook `pre-install`,`pre-upgrade` | `node cli.js start` |

## Job `bootstrap` (Helm, chế độ độc lập)

| Thuộc tính | Giá trị |
|------------|---------|
| hook | `pre-install,pre-upgrade`, weight `10`, delete-policy `before-hook-creation` |
| pod | image API, `envFrom` ConfigMap + Secret, `securityContext` như Deployment (uid/gid 1000, `runAsNonRoot`, drop `ALL`), `resources` theo `bootstrap.resources`, `restartPolicy: Never`, volume uploads (nếu có), migrations (nếu có) |
| giới hạn | `parallelism: 1`, `completions: 1` (thử lại tuần tự), `backoffLimit` (3), `activeDeadlineSeconds` (600) |
| trạng thái | `Running` → `Complete` (Helm tiếp tục) \| `Failed` (Helm dừng; release cũ không đổi; Job còn lại để xem log) |

## Phiên chạy `bootstrap` (trạng thái của một DB)

```text
trống ──seed──▶ có bảng (0 hàng directus_migrations) ──latest──▶ 101 hàng ──createAdmin──▶ role/policy(/user) ──settings──▶ xong
đã cài ──latest──▶ xong (custom migration mới; DB Directus cũ hơn được nâng lên 11.17.4)
cài dở (có directus_collections, thiếu bảng seed khác) ──▶ coi là đã cài, latest lỗi ở migration chạm bảng thiếu, mã 1 (như Directus)
migration lỗi giữa chừng ──▶ hàng chưa ghi, lần sau chạy lại migration đó (như Directus); phục hồi theo tài liệu
vendor khác (gồm redshift): trống ──▶ lỗi mã 1; đã cài ──▶ xong, không migrate (D-145)
```
