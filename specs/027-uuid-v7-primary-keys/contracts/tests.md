# Contract: Tests (Nguyên tắc V, X; SC-001..SC-007)

## Unit (`apps/api/src/services/payload.service.test.ts`, Vitest, `knex-mock-client`)

| Case                                                                                                   | Mong đợi                                   |
|--------------------------------------------------------------------------------------------------------|--------------------------------------------|
| `new PayloadService('test')`, `transformers.uuid({ action: 'create', value })` với `value` thiếu, `null`, `''` | Khớp regex v7 (data-model.md)        |
| Như trên với collection `directus_roles`, `directus_files`, `backoffice_permissions`                   | Khớp regex v4                              |
| Collection người dùng tên `backoffice_items` (không có trong danh sách hệ thống)                       | v7                                         |
| `value` là một UUID có sẵn (v4, v7)                                                                     | Trả đúng `value`                           |
| `action: 'update'`, `'read'` với `value` có hoặc không                                                  | Trả đúng `value`                           |
| 10 000 lần gọi liên tiếp với `action: 'create'` trên collection người dùng (SC-002)                               | Mỗi kết quả lớn hơn kết quả trước (so chuỗi) |
| `processValues('create', [3 item])` trên schema có khóa chính special `uuid` (`@backoffice/schema-builder`) | 3 id v7 tăng theo thứ tự mảng; field special `uuid` không phải khóa chính cũng v7 |

Mười hai case transformer có sẵn (port từ test của DR) không đổi.

## Parity (`tests/parity`)

| File                                       | Nội dung                                                                                              |
|--------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `src/items/uuid-v7.test.ts` (mới, `REDUCED_FILES` và `FULL_FILES`) | Collection per-run tạo qua Directus (`createUserCollection(..., { primaryKey: 'uuid' })`, `permissions/fixtures.ts:221`): `parity_uuid7_<run>` có field `code` kiểu uuid special `uuid`, m2o `folder` → `directus_folders`; alias m2a qua junction khóa uuid tới collection con và `directus_folders`; collection con khóa uuid có m2o về collection chính (alias o2m); junction m2m khóa uuid tới `directus_files`; singleton khóa uuid. Case: (1) `POST` một item và mảng ở mỗi app: Backoffice `id`, `code` v7 và tăng theo mảng, Directus v4 (D-192); phần còn lại của body giống nhau sau khi bỏ id; (2) GraphQL `create_<c>_item(s)` và `POST /utils/import` (CSV không cột id, cột id rỗng, cột id có giá trị) ở Backoffice: v7, id có sẵn giữ nguyên; (3) item lồng: con o2m, dòng junction m2m và m2a v7, folder lồng qua m2o v4 (clarify câu 2); (4) `PATCH` singleton lần đầu ở Backoffice: v7; (5) id client gửi (v4) và id sai dạng: `assertParity` (giống Directus); `PATCH` không đổi id, `code`; (6) Backoffice `POST /roles`, `/policies`, `/folders`: v4; `POST /users/invite` với role vừa tạo ở hai app: không lỗi validate role; (7) đọc chéo: item v7 do Backoffice tạo được Directus đọc, lọc `_eq`/`_in`, sửa, xóa và ngược lại với item v4 do Directus tạo, đọc so bằng `parity()` có `Cache-Control: no-store`; (8) thứ tự: 30 item tạo lần lượt ở Backoffice, `GET ?sort=id&fields=title` trả đúng thứ tự tạo trên mọi vendor trừ `mssql` (`getDbsToTest()`), trên `mssql` thứ tự khác thứ tự tạo (research R5); `afterAll` xóa collection, role, policy, folder, user mời |
| `src/flows/operations.test.ts`             | Case `item-create` (`:188`, collection khóa uuid `:36-42`): key do flow tạo là v7 ở Backoffice, v4 ở Directus |
| `accepted-differences.ts`                  | D-192 `kind: 'doc'`, `feature: '027'` (test so từng app riêng, R7)                                     |
| `src/suite.ts`                             | Thêm `src/items/uuid-v7.test.ts` vào `REDUCED_FILES`, mẫu `src/items/{crud,export,json-path,collection-toggles,uuid-v7}.test.ts` của `FULL_FILES` |
| Blackbox, `items/crud.test.ts`, test ghi dùng `startFlow` | Không đổi (id thay bằng nhãn; seed blackbox dùng v5 cố định)                             |

Không có: E2E (không đổi giao diện); fixture extension mới (endpoint mẫu chỉ đọc; extension dùng chung `ItemsService`,
research R4, R7); scenario benchmark mới (research R8).

## Vendor

| Chạy ở                                   | Vendor                                         | Ghi kết quả vào                     |
|------------------------------------------|------------------------------------------------|-------------------------------------|
| PR CI (`ci.yml`, parity)                 | Postgres (full), MySQL 8, SQLite (reduced)     | research.md "Kết quả lượt 1"        |
| `nightly.yml` (chạy tay, chủ dự án quyết định) | MariaDB 11.4, MSSQL 2022, Oracle XE 21, CockroachDB 24.3, Postgres 10 | research.md bảng R5 |

## Hiệu năng

benchmark-items hiện có (SC-007); chi phí bộ sinh đã đo ở research "Kết quả đo".
