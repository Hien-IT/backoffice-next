# Data Model: Index ghép, index trigram và tạo index không khóa bảng (030)

Một bảng hệ thống mới `backoffice_indexes` qua migration riêng `20261103A` (Nguyên tắc II từ 3.2.0: bảng `backoffice_*`,
`up` only, Knex, 7 vendor, chạy lại được, không FK, không dòng `directus_fields`). Các index thật nằm trên bảng của
collection người dùng, không có hàng nào trong `directus_*`.

## Bảng `backoffice_indexes` (migration `20261103A`, "Create Backoffice Indexes")

| Cột | Knex | Null | Ghi chú |
|-----|------|------|---------|
| `id` | `uuid` primary | không | UUID v4 sinh ở API (collection hệ thống giữ v4, 027) |
| `collection` | `string(64)`, index | không | Tên collection người dùng; không FK (Nguyên tắc II); dòng mồ côi khi Directus xóa collection |
| `name` | `string(128)`, **unique** | không | Tên index thật trên DB, sinh bởi `generateIndexName` (≤ 63 Postgres, 64 MySQL); unique là chỗ loại trừ đua giữa replica (research R4) |
| `fields` | `json` | không | Mảng tên field theo thứ tự cột, ví dụ `["provider","provider_subject"]`; đọc qua `cast-json` (`withCasts`, như `backoffice_permissions`) |
| `type` | `string(16)` | không | `btree` \| `trigram` |
| `unique` | `boolean` default `false` | không | Chỉ `btree` |
| `status` | `string(16)` default `creating` | không | `creating` \| `ready` \| `failed` (clarify Q1) |
| `error` | `text` | có | Thông điệp lỗi khi `failed` (vendor hoặc "Server shutdown", "pg_trgm is not installed…") |
| `date_created` | `timestamp` default `knex.fn.now()` | không | Mốc cho quy tắc "creating quá 1 giờ" (FR-009) |

Index: `backoffice_indexes_collection_index (collection)`, `backoffice_indexes_name_unique (name)`. `string(128)` cho
`name` đủ cho mọi vendor có giới hạn (MSSQL 128); unique trên `varchar(128)` nằm trong giới hạn khóa của MySQL/MSSQL/Oracle
(như `credential_id` của 029). Chạy lại được: `hasTable` → return; race: `createTable` trong try/catch rồi `hasTable`
(mẫu `20261101A`). Gỡ tay: `DROP TABLE backoffice_indexes` + xóa dòng `20261103A` trong `backoffice_migrations` (index
thật trên các bảng người dùng không tự mất; xóa tay bằng `DROP INDEX`).

## Trạng thái và chuyển trạng thái

```text
POST (202) ──insert──▶ creating ──job xong──▶ ready ──DELETE──▶ (xóa dòng, DROP INDEX)
                         │  │                   │
                         │  └──job lỗi / SIGTERM──▶ failed ──DELETE──▶ (xóa dòng, DROP INDEX IF EXISTS)
                         │
                         └──(không ghi) GET: creating quá 1 giờ, catalog không có index hợp lệ và (Postgres) không có build đang chạy ⇒ trả như failed
```

- `creating` chưa quá 1 giờ: DELETE, xóa field có trong `fields`, xóa collection → 400 `INVALID_PAYLOAD` "Index is still
  being created" (không mã lỗi mới).
- `ready` mà catalog không có tên → GET trả `missing: true` (tính lúc đọc); DELETE chỉ xóa dòng.
- `failed`: DELETE dọn `DROP INDEX IF EXISTS` (Postgres INVALID) rồi xóa dòng; tạo lại được sau khi xóa (unique `name`).

## Giá trị tính lúc đọc (không lưu)

| Trường trả về | Cách tính |
|---------------|-----------|
| `missing` | `status === 'ready' && !catalog.has(name)` (research R5); `null` trên vendor không kiểm catalog (MSSQL, Oracle) |
| `status`/`error` (ghi đè) | `creating` && `now - date_created > 1h` && `!(catalog.get(name)?.valid)` && (Postgres: không có dòng `pg_stat_progress_create_index` cho index đó; analyze U1) → `failed`, `error: "Index build stopped (replica shut down)"` |
| `meta.trigram` | `getDatabaseClient(knex) === 'postgres'` |
| `meta.concurrent` | client ∈ {postgres, cockroachdb, mysql, mariadb, oracle, mssql} (helper có nhánh không khóa; MySQL/MSSQL có thể rơi về khóa) |

## Quan hệ với bảng có sẵn

| Bảng | Dùng |
|------|------|
| Bảng của collection người dùng | `CREATE [UNIQUE] INDEX [CONCURRENTLY] <name> ON <table> (<fields>)` hoặc `USING gin (lower(<field>) gin_trgm_ops)`; `DROP INDEX` |
| `directus_collections`, `directus_fields` | chỉ đọc qua SchemaOverview để kiểm collection/field (research R6); không ghi |
| `directus_activity`, `directus_revisions` | create/update/delete trên collection `backoffice_indexes` qua ItemsService (clarify Q2, FR-016a) |
| `pg_extension` (Postgres) | `CREATE EXTENSION IF NOT EXISTS pg_trgm` trước index trigram đầu tiên |

## Ràng buộc payload (research R6)

| Trường | Quy tắc |
|--------|---------|
| `fields` | 1–8 chuỗi, không trùng, cột thật (`alias === false`), kiểu theo FR-001a (`text` không trên MySQL/MariaDB), không chỉ khóa chính |
| `type` | `btree` (mặc định) \| `trigram` (1 field `string`/`text`, Postgres, `unique` false) |
| `unique` | boolean, mặc định `false` |
| trùng | cùng `collection` + `fields` (thứ tự) + `type` + `unique` với dòng bất kỳ → 400; tên sinh ra đã có trong catalog hoặc trong bảng → 400 |

## Ví dụ dòng

```json
{
  "id": "3f6c1b2a-9d4e-4c8b-8a1f-2b3c4d5e6f70",
  "collection": "passenger_auth_identities",
  "name": "passenger_auth_identities_provider_provider_subject_unique",
  "fields": ["provider", "provider_subject"],
  "type": "btree",
  "unique": true,
  "status": "ready",
  "error": null,
  "date_created": "2026-11-03T08:15:02.000Z",
  "missing": false
}
```
