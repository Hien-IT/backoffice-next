# Data Model: API chặn tìm kiếm, Import, Export theo cài đặt của collection

Không bảng, cột, migration, dòng `directus_*` mới (Nguyên tắc II). Dữ liệu là của spec 022.

## Cài đặt hiển thị của collection (có sẵn, spec 022)

Dòng `directus_collections` của collection người dùng, migration `20261026A`:

| Cột              | Kiểu    | Mặc định | Ý nghĩa ở 024                                                                      |
|------------------|---------|----------|------------------------------------------------------------------------------------|
| `bo_show_search` | boolean | `true`   | `false` (hoặc `0`): REST/GraphQL từ chối từ khóa tìm kiếm nhắm vào collection này  |
| `bo_show_import` | boolean | `true`   | `false`: `POST /utils/import/<collection>` bị từ chối trước khi ghi                 |
| `bo_show_export` | boolean | `true`   | `false`: `?export=` và `POST /utils/export/<collection>` bị từ chối                 |

`null` và cột thiếu = bật (FR-008). Collection hệ thống không có dòng nên không bị chặn (FR-010). Cả hai app ghi cột qua
`PATCH /collections/<c>` (`meta`), xóa cache hệ thống và phát `schemaChanged`.

## Map cài đặt trong process (mới, chỉ bộ nhớ)

Key `collection-toggles` của `localSchemaCache` (Keyv memory `_schema`, TTL `CACHE_SYSTEM_TTL`), giá trị:

```ts
type CollectionToggles = Record<string, { search?: false; import?: false; export?: false }>;
// chỉ collection có ít nhất một cài đặt tắt; thiếu key = bật hết
```

Vòng đời: rebuild từ `directus_collections` khi miss; xóa cùng SchemaOverview bởi `clearSystemCache` (process lưu) và
bus `schemaChanged` (mọi replica, khi có Redis); hết TTL như cache schema.

## Request bị chặn (khái niệm, không lưu)

Request HTTP tới Backoffice có một trong:

| Nguồn từ khóa / hành động                                                     | Collection xét                          | Cài đặt   |
|-------------------------------------------------------------------------------|-----------------------------------------|-----------|
| `query.search` (query string, body `query` của `SEARCH`/`PATCH`/`DELETE`/`POST /utils/export`) | collection của route            | search    |
| `query.deep[...]._search` (REST), đối số `search` của field lồng (GraphQL)   | collection đích của quan hệ tại mức đó  | search    |
| đối số `search` của query `<c>`, `<c>_aggregated`, mutation `create_<c>_items`, `update_<c>_items` | `<c>`             | search    |
| `query.export` (`GET /items/<c>`, `GET /items/<c>/<pk>`), `POST /utils/export/<c>` | `<c>`                               | export    |
| `POST /utils/import/<c>`                                                      | `<c>`                                   | import    |

| `?search=` trong query string của `POST`/`PATCH /items/<c>`, `PATCH /items/<c>/<pk>`              | `<c>`                                   | search    |

Kết quả: REST 403 với đúng lỗi quyền collection (`You don't have permission to access collection "<c>" or it does not
exist. Queried in root.`, hoặc `Queried in "<path>"` khi chặn qua quan hệ; code `FORBIDDEN`), không đọc/ghi response
cache, không đổi dữ liệu; GraphQL 200 với lỗi đó trong `errors[]` cho field đó, không ghi cache.
