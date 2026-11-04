# Contract: API REST (D-212, D-212.2, D-212.3)

Route mới dưới `/backoffice/extensions` (D-189.6); Directus 11.17.4 trả 404 `ROUTE_NOT_FOUND` (D-212, `doc`). Lỗi dùng mã
có sẵn: `INVALID_CREDENTIALS` (401), `FORBIDDEN` (403, không admin), `INVALID_PAYLOAD` (400), `CONTENT_TOO_LARGE` (413),
`LIMIT_EXCEEDED` (403, `EXTENSIONS_LIMIT`), `SERVICE_UNAVAILABLE` (503, lỗi chép lên kho/ghi đĩa như luồng registry),
`ROUTE_NOT_FOUND` (404). Mọi route đặt `res.locals.cache = false`. Admin = `accountability.admin === true`.

## `GET /backoffice/extensions/upload`

| | |
|-|-|
| Response 200 | `{ "data": { "max_upload_size": number \| null } }` — byte từ `FILES_MAX_UPLOAD_SIZE`, `null` khi không đặt (clarify Q3) |
| Mục đích | probe của web (nút Upload hiện khi 200) và kiểm kích thước phía trình duyệt |
| 401 / 403 | không token / không admin |

## `POST /backoffice/extensions/upload`

| | |
|-|-|
| Request | `multipart/form-data`, đúng một phần file (tên field bất kỳ, `file` theo quy ước), các field khác bị bỏ qua |
| Response 200 | `{ "data": ApiOutput }` — như một phần tử của `GET /extensions`: `{ id, bundle: null, meta: { id, enabled: true, folder: id, source: "upload", bundle: null }, schema: Extension }` (FR-010) |
| Tác dụng phụ | thư mục `.upload/<id>` ở local và kho dùng chung; dòng `directus_extensions` (+ entry bundle; activity `create` bởi admin như install registry); bus `partialSync: ".upload/<id>"` + reload; app bundle dựng lại; `extensions.installed` emit với `versionId: id` |
| 400 `INVALID_PAYLOAD` reason | `Request must be multipart/form-data`; `No file was uploaded`; `The file is not a gzipped tar archive` (lỗi gzip/tar); `package/package.json is missing (npm pack layout expected)`; `Invalid extension manifest: <zod message>`; `Extension type not found in package.json`; `An extension named "<name>" is already installed (<source>)`; `MARKETPLACE_TRUST=sandbox requires a sandboxed extension` |
| 413 `CONTENT_TOO_LARGE` | file vượt `FILES_MAX_UPLOAD_SIZE` (Busboy `limit`) |
| 403 `LIMIT_EXCEEDED` | `EXTENSIONS_LIMIT` như `preInstall` (`category: 'Extensions'`) |
| 503 `SERVICE_UNAVAILABLE` | `{ service: 'extensions', reason: 'Failed to extract the extension or write it to storage' }` (lỗi I/O, như registry) |
| Dọn | mọi lỗi: thư mục tạm xóa; thư mục `.upload/<id>` đã chép bị xóa (local + kho); không dòng |

Trình tự (research R5): giải nén + kiểm manifest/sandbox/limit → kiểm trùng name (sớm) → chép lên kho + local →
`withSettingsLock` { kiểm trùng name lại → tạo dòng } → broadcast + reload → `readOne(id)`.

## Route có sẵn đổi hành vi với `source: 'upload'` (D-212.3)

| Route | Directus 11.17.4 | Backoffice |
|-------|------------------|------------|
| `DELETE /extensions/registry/uninstall/:pk` | 400 `Cannot uninstall extensions that were not installed via marketplace` | 204: xóa dòng (+ entry), xóa `.upload/<folder>` kho + local, bus `partialSync`, reload; entry bundle vẫn 400 `Cannot uninstall sub extensions of bundles separately` |
| `POST /extensions/registry/reinstall` | 400 (cùng chữ) | 400 `Cannot reinstall extensions that were not installed via marketplace` (không đổi, FR-015) |
| `GET /extensions`, `GET /extensions/:pk`, GraphQL `extensions` | `schema: null` | `schema` đầy đủ (D-212.2 `http`); khi node đã nạp gói `upload`: không đọc, không ghi response cache dùng chung (`uploadedExtensionsCacheGuard`, implement 2026-11-04) |
| `PATCH /extensions/:pk` | cập nhật dòng, không nạp | cập nhật dòng, reload như registry |
| `DELETE /extensions/:pk` | xóa dòng | xóa dòng (FR-016, dòng Missing) |
| `GET /extensions/sources/:chunk` | bundle không có gói | bundle có phần app của gói tải lên |

Mọi route khác và mọi dòng `local`/`registry`/`module` không đổi.

## Log

- Nạp gói có `host` không khớp phiên bản Backoffice: `warn` `Extension "<name>" declares host "<host>", Backoffice is
  <version>` (clarify Q1), một dòng mỗi lần nạp.
- Tải lên thành công: `info` `Installed uploaded extension: <name>@<version> (<id>)`; gỡ: `info` `Uninstalled extension:
  <folder>` (có sẵn).
