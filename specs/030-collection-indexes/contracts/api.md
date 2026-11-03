# Contract: API REST (D-210, D-210.3, D-210.4)

Mọi route dưới `/backoffice/collections/:collection/indexes` (D-189.6); Directus 11.17.4 trả 404 `ROUTE_NOT_FOUND`
(D-210, `doc`). Không endpoint có sẵn nào đổi đường, query hay response; `GET /fields` không đổi (D-210.1). Lỗi dùng mã có
sẵn: `INVALID_CREDENTIALS` (401, không token), `FORBIDDEN` (403, không admin hoặc collection hệ thống/không có),
`INVALID_PAYLOAD` (400), `ROUTE_NOT_FOUND` (404). Mọi GET đặt `res.locals.cache = false` (không vào response cache dùng
chung). Admin = `accountability.admin === true` (kiểm ở controller như `backoffice-passkeys.controller.ts:58-62`).

## `GET /backoffice/collections/:collection/indexes`

| | |
|-|-|
| Response 200 | `{ "data": Index[], "meta": { "trigram": boolean, "concurrent": boolean } }` |
| `Index` | `{ id, collection, name, fields: string[], type: "btree" \| "trigram", unique: boolean, status: "creating" \| "ready" \| "failed", error: string \| null, date_created, missing: boolean \| null }` (data-model: `missing` và `status` quá hạn tính lúc đọc) |
| Sắp xếp | `date_created` tăng dần |
| 403 | collection hệ thống, collection không tồn tại, user không admin |

## `POST /backoffice/collections/:collection/indexes?concurrentIndexCreation=false`

| | |
|-|-|
| Body | `{ "fields": string[], "type"?: "btree" \| "trigram", "unique"?: boolean }` (Joi như `newFieldSchema`) |
| Query | `concurrentIndexCreation` như `POST /fields` (`fields.controller.ts:50-51`): mặc định bật; `=false` tắt |
| Response **202** | `{ "data": Index }` với `status: "creating"`; job nền tạo index (research R4) |
| Tác dụng phụ | dòng `backoffice_indexes` (activity `create` bởi admin gọi); khi job xong: `status` `ready` hoặc `failed` + `error` (activity `update` cùng user); Postgres: `CREATE EXTENSION IF NOT EXISTS pg_trgm` trước index trigram |
| 400 `INVALID_PAYLOAD` | `fields` rỗng/>8/trùng/không phải cột thật/kiểu ngoài FR-001a (`text` trên MySQL: "Field `name` of type text cannot be indexed on MySQL"); `trigram` không phải Postgres ("Trigram indexes need PostgreSQL"), nhiều field, kiểu khác string/text, `unique: true`; chỉ khóa chính; trùng định nghĩa ("Index already exists: <name>"); tên đã có trong catalog hoặc bảng ("Index name already in use: <name>") |
| 403 `FORBIDDEN` | collection `directus_*`/`backoffice_*`, collection không tồn tại, không admin |
| Thông điệp `error` khi `failed` | dữ liệu đang trùng: "Record not unique: provider, provider_subject = (p1, s1)" (từ `RecordNotUniqueError` nếu dịch được, không thì thông điệp vendor); `pg_trgm` không quyền: "pg_trgm is not installed; ask a DBA to run: CREATE EXTENSION pg_trgm"; SIGTERM: "Server shutdown"; khác: thông điệp vendor cắt 1000 ký tự |

## `DELETE /backoffice/collections/:collection/indexes/:name`

| | |
|-|-|
| Response 204 | index gỡ (`DROP INDEX`, bỏ qua "không tồn tại"), dòng xóa (activity `delete`) |
| 400 `INVALID_PAYLOAD` | dòng `creating` chưa quá 1 giờ: "Index is still being created" |
| 403 | không admin, collection hệ thống |
| 404 `ROUTE_NOT_FOUND`? | **Không**: tên không có trong bảng của collection đó → 403 `FORBIDDEN` (như xóa item không tồn tại qua ItemsService) |

## Cascade trong endpoint có sẵn (D-210.3)

| Endpoint | Thêm |
|----------|------|
| `DELETE /fields/:collection/:field`, `POST /schema/apply` xóa field | trước transaction của `FieldsService.deleteField`: mỗi dòng có field → `DROP INDEX` + xóa dòng (activity `delete`); dòng `creating` chưa quá hạn → 400 "Index is still being created", field không xóa |
| `DELETE /collections/:collection`, `DELETE /collections` | trong transaction, cạnh `backoffice_permissions`: xóa dòng của collection; dòng `creating` chưa quá hạn → 400 |

## Lỗi ghi trùng (D-210.4)

`POST/PATCH /items/:collection`, `/utils/import`: vi phạm unique ghép → 400 với **một mục `RECORD_NOT_UNIQUE` mỗi
field** của index (GraphQL `create_*_item(s)`: mục đầu với field thứ nhất, vì `formatError` của Directus gộp mọi mảng lỗi) (`extensions: { collection, field, value }`), thứ tự như trong index; Postgres và
SQLite từ thông điệp của vendor; MySQL qua tra `backoffice_indexes` theo tên index (không tra được → như Directus: một mục
với `field` suy từ tên). Unique một cột không đổi.

## Response 202 ví dụ

```json
{
  "data": {
    "id": "3f6c1b2a-9d4e-4c8b-8a1f-2b3c4d5e6f70",
    "collection": "passenger_auth_identities",
    "name": "passenger_auth_identities_provider_provider_subject_unique",
    "fields": ["provider", "provider_subject"],
    "type": "btree",
    "unique": true,
    "status": "creating",
    "error": null,
    "date_created": "2026-11-03T08:15:02.000Z",
    "missing": null
  }
}
```
