# Contract: API (FR-001..FR-010, D-192)

Không route, tham số, status, header, lỗi, schema GraphQL hay OAS mới. Chỉ giá trị id API tự sinh ở collection người
dùng đổi từ UUID v4 sang UUID v7. Ví dụ dùng collection người dùng `articles` có khóa chính "Generated UUID" và field
`code` kiểu uuid đặt "Generate and Save UUID".

## 1. Giá trị đổi (Backoffice), Directus 11.17.4 giữ v4

| Request                                                        | Backoffice                                                       | Directus 11.17.4 |
|----------------------------------------------------------------|------------------------------------------------------------------|------------------|
| `POST /items/articles` `{"title":"a"}`                         | `data.id`, `data.code`: v7                                       | v4               |
| `POST /items/articles` `[{"title":"a"},{"title":"b"}]`         | mỗi `data[i].id` v7, tăng theo thứ tự mảng; mảng `data` đọc lại theo khóa chính nên trùng thứ tự gửi | v4; mảng `data` theo id v4 ngẫu nhiên |
| `PATCH /items/<singleton>` khi chưa có item                    | id của item mới: v7                                              | v4               |
| `POST /graphql` `create_articles_item`, `create_articles_items` | `id` trả về: v7; mảng của `create_articles_items` trùng thứ tự gửi | v4; mảng theo id v4 |
| `POST /utils/import/articles` (CSV/JSON, dòng không có id hoặc id rỗng) | item mới: v7; dòng có id giữ id đó                        | v4; giữ id       |
| Flow `item-create` trên `articles`                             | key trả về: v7                                                   | v4               |
| Item lồng: `POST /items/b` với o2m tới `articles`, m2m qua junction khóa uuid | item `articles` lồng và dòng junction mới: v7     | v4               |

## 2. Không đổi (giống Directus 11.17.4)

| Request                                                                  | Kết quả ở hai app                                     |
|--------------------------------------------------------------------------|-------------------------------------------------------|
| Tạo item ở 18 collection hệ thống có `id` special `uuid` (`directus_access`, `comments`, `dashboards`, `deployments`, `deployment_projects`, `deployment_runs`, `extensions`, `files`, `flows`, `folders`, `operations`, `panels`, `policies`, `roles`, `shares`, `translations`, `users`, `versions`; theo `directus/packages/system-data/src/fields/*.yaml`), ví dụ `POST /roles`, `/policies`, `/folders`, `/files`, `/flows`, `/users` | id v4 |
| Item lồng thuộc collection hệ thống (file, user, folder qua m2o)         | v4                                                    |
| `POST /users/invite` với `role` là role do Backoffice tạo                | Chấp nhận như role do Directus tạo (role là v4)       |
| `POST /items/articles` có `id` (bất kỳ phiên bản UUID)                    | Lưu đúng id đó                                        |
| `POST /items/articles` có `id` không phải UUID                           | Lỗi như Directus (`validateKeys`)                     |
| `PATCH /items/articles/<id>`                                             | id, `code` không sinh lại                             |
| Đọc, lọc `_eq`/`_in`, sắp, sửa, xóa item v4 hoặc v7 ở app bất kỳ         | Như nhau                                              |
| Introspection, SDL GraphQL; `/server/specs/oas`                          | Không đổi                                             |

## 3. Thứ tự

`GET /items/articles?sort=id` trả item tạo trên cùng một instance Backoffice theo thứ tự tạo trên Postgres, SQLite (đã
đo) và [Inference] MySQL, MariaDB, Oracle, CockroachDB; MSSQL không theo thứ tự tạo (research R5). Giữa replica chỉ theo
mili giây của đồng hồ từng máy; id v4 xen giữa không theo thời gian (FR-011).

Danh sách không có `sort` mặc định sắp theo khóa chính ở cả hai app (`get-ast-from-query/utils/get-allowed-sort.ts`,
bản port của Directus). Đọc cùng DB thì hai app trả cùng thứ tự. Id v7 bắt đầu bằng `01` tới 2039-09-07, nên khi sắp tăng
dần, item do Backoffice tạo đứng trước gần như mọi item v4 (sửa khi checklist 2026-10-29, CHK010).
