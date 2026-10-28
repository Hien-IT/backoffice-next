# Data Model: Khóa chính uuid tự sinh dùng UUID v7

Không bảng, cột, migration, dòng `directus_*` mới (Nguyên tắc II). Feature chỉ đổi giá trị API tự sinh cho field có sẵn.

## Field special `uuid` (có sẵn)

Field có `meta.special` chứa `uuid` trong `directus_fields`:

- Khóa chính "Generated UUID" khi tạo collection (`NewCollection.vue:123-130`; Directus app `new-collection.vue:159`).
- Field kiểu uuid đặt "Generate and Save UUID" khi tạo field (`AdvancedSchema.vue:168-179`).

Cột DB do Knex tạo theo vendor, không có default (research R5): `uuid` (Postgres, CockroachDB), `char(36)` (MySQL,
MariaDB, SQLite, Oracle), `uniqueidentifier` (MSSQL).

## Quy tắc chọn giá trị khi ghi (PayloadService, transformer `uuid`)

| Collection của item                                   | Giá trị trong payload        | Thao tác              | Kết quả                       |
|-------------------------------------------------------|------------------------------|-----------------------|-------------------------------|
| Người dùng (không phải `isSystemCollection`)          | thiếu, `null`, chuỗi rỗng    | tạo                   | UUID v7 mới                   |
| Hệ thống (`directus_*`, `backoffice_*` trong danh sách) | thiếu, `null`, chuỗi rỗng  | tạo                   | UUID v4 mới (`randomUUID()`) |
| Bất kỳ                                                | có giá trị                   | tạo                   | giữ nguyên (kiểm UUID hợp lệ như Directus nếu là khóa chính) |
| Bất kỳ                                                | bất kỳ                       | sửa, đọc              | giữ nguyên                    |

Item tạo lồng (o2m, m2m, m2a, m2o) áp quy tắc theo collection của chính item đó (clarify câu 2): junction là collection
người dùng; file, user, folder là collection hệ thống.

## Dạng giá trị UUID v7 (`uuid` 11.1.0)

| Byte  | Nội dung                                                                 |
|-------|--------------------------------------------------------------------------|
| 0–5   | Mốc thời gian Unix, mili giây (big-endian)                               |
| 6     | Version `7` (4 bit cao) + 4 bit của bộ đếm                               |
| 7–10  | Phần còn lại của bộ đếm 32 bit (byte 8 có 2 bit variant `10`) + 2 bit ngẫu nhiên |
| 11–15 | 40 bit ngẫu nhiên                                                        |

Chuỗi chữ thường dạng 8-4-4-4-12, ký tự thứ 15 là `7`, ký tự thứ 20 thuộc `8`, `9`, `a`, `b`. Bộ đếm và mốc giữ trong
module, nên trong một process id tăng dần theo thứ tự sinh, kể cả cùng mili giây (research R2).

Kiểm bằng regex:

```text
v7: ^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
v4: ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
```

## Vòng đời

Giá trị chỉ được sinh một lần, lúc tạo item; sau đó không đổi. Không có bước chuyển đổi dữ liệu cũ; một bảng có thể có
lẫn v4 (dữ liệu cũ, Directus, client) và v7.
