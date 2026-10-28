# Contract: API (REST, GraphQL)

Mọi request không nêu ở đây giữ nguyên như Directus 11.17.4 (FR-035); export, import có quyền đầy đủ không Use custom
cho cùng file, cùng dữ liệu như Directus. "Có quyền" = admin, hoặc ít nhất một policy của người gọi
có dòng `backoffice_permissions` cho (collection, action) và định dạng xin nằm trong `formats` của quyền đã cộng dồn.
Toggle 024 (`bo_show_import`, `bo_show_export`) tắt thì 403 trước, cho mọi người (FR-009).

## Lỗi (FR-008)

Như 024: HTTP 403, `createCollectionForbiddenError`:

```json
{ "errors": [{ "message": "You don't have permission to access collection \"A\" or it does not exist. Queried in root.",
               "extensions": { "code": "FORBIDDEN" } }] }
```

Dùng cho: không quyền, định dạng không được phép, field xin rõ ngoài giới hạn (export), cột ngoài giới hạn hay dòng
vi phạm bộ lọc (import, cả file). Không đọc, không ghi response cache (guard chạy trước `checkCacheMiddleware`).

## 1. Export (FR-006, FR-015, D-189.1)

| Request                                                                    | Không quyền | Có quyền                                   | Directus |
|----------------------------------------------------------------------------|-------------|--------------------------------------------|----------|
| `GET /items/A?export=csv` (mọi định dạng; cả `GET /items/A/<pk>`)         | 403         | 200, file; bộ lọc AND read; field giao     | 200      |
| `GET /users?export=json` (endpoint hệ thống)                               | 403         | 200                                        | 200      |
| `GET /items/A?export=json` khi `formats` chỉ `csv`                         | 403         | —                                          | 200      |
| `GET /items/A?export=csv&fields=id,secret` với `fields` quyền `id,title`   | 403         | —                                          | 200      |
| `GET /items/A?export=csv&fields=*` (hoặc không `fields`)                   | —           | 200, chỉ `id,title`                         | 200 (mọi field read) |
| `POST /items/A?export=csv`, `PATCH /items/A?export=csv` (ghi + export)     | 403, không ghi | 200                                     | 200      |
| `POST /utils/export/A` body `{ "query": {...}, "format": "csv", "file": {...} }` | 403, không tạo file | 200, file nền với bộ lọc, field đã áp | 200 |
| `POST /utils/export/A` với `format` ngoài `formats`                        | 403         | —                                          | 200      |
| `SEARCH /items/A`, `SEARCH /users`, `SEARCH /files`... body `{ "query": { "export": "csv" } }` (analyze C1, CHK015) | 403 | 200, file như `?export=` | 200 |

Export qua quan hệ (`fields=rel.*`): chỉ xét collection của route (như 024).

## 2. Import (FR-007, FR-016, D-189.1)

| Request                                                               | Kết quả Backoffice                                   | Directus |
|-----------------------------------------------------------------------|------------------------------------------------------|----------|
| `POST /utils/import/A` multipart, không quyền import                  | 403 trước khi đọc file                               | 200      |
| có quyền, thiếu `create` hoặc `update`                                | 403 như hiện nay (`ImportService`)                   | 403      |
| có quyền, file JSON khi `formats` chỉ `csv`                           | 403, không ghi                                       | 200      |
| có quyền, một dòng vi phạm bộ lọc (`validatePayload`)                 | 403, cả file bị hủy (transaction), không ghi item nào | 200     |
| có quyền, file có cột ngoài `fields`                                  | 403, cả file bị hủy                                  | 200      |
| có quyền, file hợp lệ                                                 | 200, giống Directus                                  | 200      |
| collection hệ thống (`directus_dashboards`...), người không phải admin | 403 như Directus (`ImportService`), không kiểm quyền `import` (analyze I1) | 403 |
| collection hệ thống, admin                                            | 200, giống Directus                                  | 200      |

## 3. `GET /permissions/me` (FR-018, D-189)

Thêm `import`, `export` cho mỗi collection có trong kết quả (dạng ở data-model.md). Admin: mọi collection `full`.
Người không phải admin: chỉ collection có ít nhất một dòng `directus_permissions` (như Directus); collection chỉ có
dòng ở bảng mới không xuất hiện (analyze U1). Người không có dòng nào: `{}` như Directus. `permissions_me` của `POST /graphql/system`: cùng JSON.
Header, cache: như Directus (D-189.2).

## 4. `/backoffice/permissions` (FR-020, D-189.6; Directus: 404)

Cùng dạng `/permissions` (`permissions.controller.ts`), collection `backoffice_permissions`:

| Route                     | Body / query                                   | Kết quả                                                  |
|---------------------------|------------------------------------------------|----------------------------------------------------------|
| `POST /backoffice/permissions` | một object hoặc mảng (`policy`, `collection`, `action`, `permissions?`, `fields?`, `options?`) | 200 `{ data: row \| row[] }`; `action` ngoài registry → 400 `INVALID_PAYLOAD` |
| `GET /backoffice/permissions` | `filter`, `fields`, `sort`, `limit`, `offset`, `page`, `meta` (sanitizeQuery) | 200 `{ data: row[] }`                        |
| `GET /backoffice/permissions/:id` | `fields`                                   | 200 `{ data: row }`; không có → 403 (như `/permissions/:id`) |
| `PATCH /backoffice/permissions` | mảng rows (batch) hoặc `{ keys, data }`      | 200 `{ data: row[] }`                                    |
| `PATCH /backoffice/permissions/:id` | partial row                              | 200 `{ data: row }`                                      |
| `DELETE /backoffice/permissions` | mảng id                                     | 204                                                      |
| `DELETE /backoffice/permissions/:id` | —                                       | 204                                                      |

Quyền: admin; người không phải admin cần quyền tương ứng trên `directus_permissions` (`validateAccess`), nếu không 403.
`permissions`, `validation`, `presets`, `options` là JSON; `fields` là mảng (csv trong DB). Mỗi ghi: activity (`create`,
`update`, `delete`, collection `backoffice_permissions`), revisions; xóa cache hệ thống và cache quyền (cả hai app qua
bus), response cache mỗi lần ghi như `PermissionsService` của Directus (không xét `CACHE_AUTO_PURGE`, bỏ qua khi
`autoPurgeCache: false`).

Không `?export=` ở route này; không có trong GraphQL; `/items/backoffice_permissions` → 403 (collection hệ thống).

## 5. Xóa theo (FR-021)

| Request ở Backoffice            | Thêm                                                        |
|---------------------------------|-------------------------------------------------------------|
| `DELETE /policies/:id`, batch   | xóa dòng `backoffice_permissions` của policy                |
| `DELETE /collections/:name`     | xóa dòng `backoffice_permissions` của collection            |

Cùng request ở Directus: không xóa (dòng mồ côi, bỏ qua khi đọc).

## 6. Không đổi

`/permissions` (5 action), `/policies`, `/shares` và `POST /shares/auth`, `/items/*` không `export`, GraphQL schema
(introspection, SDL), `/collections` và `/fields` (bảng mới là collection hệ thống ẩn: D-189.5, so sánh như D-181).
