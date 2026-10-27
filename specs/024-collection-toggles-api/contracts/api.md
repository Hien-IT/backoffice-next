# Contract: API (REST, GraphQL)

Mọi request không nêu ở đây giữ nguyên như Directus 11.17.4 (FR-011). "Tắt" = cột `bo_show_*` của collection là `false`;
`null`/thiếu = bật.

## Lỗi (FR-006)

REST: HTTP 403, đúng lỗi mà người không có quyền đọc collection nhận hiện nay (`createCollectionForbiddenError`), nên
không phân biệt được với "không có quyền" hay "không tồn tại":

```json
{
  "errors": [
    {
      "message": "You don't have permission to access collection \"A\" or it does not exist. Queried in root.",
      "extensions": { "code": "FORBIDDEN" }
    }
  ]
}
```

Chặn qua quan hệ (`deep`, field lồng GraphQL): `Queried in "<path>"` với `<path>` là đường field tới mức đó.

GraphQL: HTTP 200, `errors[]` có phần tử `{ message, extensions: { code: "FORBIDDEN" }, path: [<field>] }`, `data` của
field khác vẫn có; document có lỗi không ghi response cache.

## 1. Tìm kiếm (`bo_show_search` tắt trên A)

| Request                                                                    | Kết quả Backoffice | Directus 11.17.4 |
|----------------------------------------------------------------------------|--------------------|------------------|
| `GET /items/A?search=abc` (kể cả kèm `aggregate`, `groupBy`)              | 403                | 200              |
| `SEARCH /items/A` body `{"query":{"search":"abc"}}`                        | 403                | 200              |
| `GET /items/A/<pk>?search=abc`                                             | 403                | 200 / 403 quyền  |
| `PATCH /items/A` body `{"query":{"search":"abc"},"data":{...}}`            | 403, không sửa     | 200              |
| `DELETE /items/A` body `{"query":{"search":"abc"}}`                        | 403, không xóa     | 204              |
| `POST /items/A?search=abc`, `PATCH /items/A?search=abc` (keys), `PATCH /items/A/<pk>?search=abc` | 403, không tạo/sửa | 200 |
| `GET /items/B?deep[<quan hệ tới A>][_search]=abc` (B bất kỳ)                | 403                | 200              |
| `GET /users?deep[<quan hệ tới A>][_search]=abc` (endpoint hệ thống có quan hệ tới A) | 403, `Queried in "<quan hệ>"` | 200 |
| GraphQL `/graphql/system` `{ users { <quan hệ tới A>(search: "abc") { id } } }` | lỗi FORBIDDEN ở field `users.<quan hệ>` | data |
| `POST /utils/export/A` body `{"query":{"search":"abc"},"format":"csv"}` (export bật) | 403      | 200              |
| `GET /items/A?search=` (rỗng), không `search`                              | 200 giống Directus | 200              |
| `GET /items/A?search=%20` (chỉ khoảng trắng)                               | 403                | 200              |
| GraphQL `{ A(search: "abc") { id } }`, `{ A_aggregated(search: "abc") { count { id } } }` | lỗi FORBIDDEN ở field | data |
| GraphQL `{ B { <quan hệ tới A>(search: "abc") { id } } }`                  | lỗi FORBIDDEN ở field `B.<quan hệ>` | data |
| GraphQL `mutation { create_A_items(data: [...], search: "abc") { id } }`, `update_A_items(ids, data, search)` | lỗi FORBIDDEN, không tạo/sửa | tạo/sửa |
| GraphQL `{ A(search: "") { id } }`, `{ A(filter: {...}) { id } }`         | giống Directus     | data             |

Thứ tự: guard chạy trước response cache và trước `collectionExists`, nhưng chỉ chặn collection có dòng
`directus_collections`, nên collection không tồn tại hay không có quyền trả lỗi như trước.

## 2. Export (`bo_show_export` tắt trên A)

| Request                                                        | Backoffice            | Directus |
|----------------------------------------------------------------|-----------------------|----------|
| `GET /items/A?export=csv` (json, csv_utf8, xml, yaml như nhau) | 403, không file       | file     |
| `GET /items/A/<pk>?export=json`                                | 403                   | file     |
| `POST /items/A?export=csv`, `PATCH /items/A?export=csv` (keys), `PATCH /items/A/<pk>?export=json` | 403, không tạo/sửa | file |
| `POST /utils/export/A` body `{"query":{},"format":"csv"}`      | 403, không tạo file   | 200      |
| `GET /items/A` không `export`                                  | 200 giống Directus    | 200      |

## 3. Import (`bo_show_import` tắt trên A)

| Request                                              | Backoffice                       | Directus |
|------------------------------------------------------|----------------------------------|----------|
| `POST /utils/import/A` multipart CSV/JSON            | 403 trước khi đọc file, 0 item mới | 200    |
| `POST /items/A` một item hay mảng                    | giống Directus                   | 200      |

## 4. Không bị chặn (FR-009, FR-010)

- Collection hệ thống (`directus_*`, `backoffice_*`) với mọi tham số.
- Flow (`item-read` có `query.search`, operation export), endpoint HTTP của extension (`/<extension-id>/...`, kể cả khi
  đọc `search` của request) gọi `ItemsService`, `ImportService`, `ExportService`, hook.
- Export qua quan hệ: `GET /items/B?export=csv&fields=a.*` khi A tắt export (chỉ xét collection của route).
- Toggle bật hoặc null: mọi request giống Directus.

## 5. Response cache (FR-012)

- REST bị chặn: không đọc, không ghi cache (lỗi trước `checkCacheMiddleware`).
- GraphQL: khi có ít nhất một collection tắt tìm kiếm, document có từ `search` không được đọc từ cache ở Backoffice
  (vẫn ghi khi không lỗi): header `<CACHE_STATUS_HEADER>: MISS` khi bật header, `Cache-Control` TTL đầy đủ (D-188.4);
  không collection nào tắt thì như Directus. Document bị chặn không ghi.

## 6. Thời điểm (FR-013)

Lưu `PATCH /collections/A` ở Backoffice hay Directus → `clearSystemCache` + bus `schemaChanged` → mọi replica Backoffice
đọc lại ở request sau, không cần xóa cache tay. Sửa SQL: `POST /utils/cache/clear` (hoặc `cache clear`).

## 7. Người gọi (FR-007)

Mọi bảng trên áp cho admin, user thường (policy đọc/sửa A), share (đăng nhập share của một item A), public (policy public
đọc A) và static token của user.
