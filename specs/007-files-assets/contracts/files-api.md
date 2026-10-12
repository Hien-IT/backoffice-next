# Contract: `/files`, `/folders`, `/files/import` (007)

Mọi route giống Directus 11.17.4 (`controllers/files.ts`, `folders.ts`). Thứ tự đăng ký controller trong
`app.module.ts`: `AssetsController`, `TusController` (khi `TUS_ENABLED`), `FilesController`, `FoldersController`.
`useCollection('directus_files')` cho files, assets, tus; `useCollection('directus_folders')` cho folders.

## 1. `/files`

| Method + path | Middleware (qua `runMiddleware`) | Hành vi |
|---------------|----------------------------------|---------|
| `POST /files` | `multipartHandler` | multipart: `res.locals.savedFiles` → 1 key `readOne` `{data:{}}`, nhiều key `readMany` `{data:[]}`; JSON: `createOne(body)` rồi `readOne`; `Forbidden` khi đọc lại → `204` |
| `POST /files/import` | Joi `{url: string required, data: object, options.filterMimeType: string[]}` | `importOne(url, data, options)` → `readOne`; `Forbidden` → `204` |
| `GET /files`, `SEARCH /files` | `validateBatch('read')` | singleton? không; `body.keys` → `readMany`; else `readByQuery`; `meta` qua `MetaService` |
| `GET /files/:pk` | | `readOne` → `{data}` |
| `PATCH /files` | `validateBatch('update')` | mảng → `updateBatch`; `keys` → `updateMany`; `query` → `updateByQuery`; `readMany` |
| `PATCH /files/:pk` | `multipartHandler` | multipart: `uploadOne(stream, payload, pk)` trong handler; sau đó luôn `updateOne(pk, body)`; `readOne` |
| `DELETE /files` | `validateBatch('delete')` | mảng → `deleteMany`; `keys` → `deleteMany`; `query` → `deleteByQuery`; `204` |
| `DELETE /files/:pk` | | `deleteOne`; `204` |

### `multipartHandler` (port nguyên)

- Bỏ qua khi không `multipart/form-data`. Busboy `{headers, defParamCharset:'utf8', limits:{fileSize: bytes(FILES_MAX_UPLOAD_SIZE)}}`.
- Field trước file; `"null"`, `"true"`, `"false"` ép kiểu; payload reset sau mỗi file.
- Mỗi file: thiếu tên → `400 InvalidPayload "File is missing filename"`; mime không khớp `FILES_MIME_TYPE_ALLOW_LIST`
  (minimatch) → `400`; `title = formatTitle(parse(filename).name)` khi không `pk` và không `title`;
  `filename_download ||= filename`; `type = mimeType`; `uploadOne(stream, payload, pk)`.
- Không file → `400 "No files were included in the body"`. `truncated` → `413 ContentTooLarge`.
- Chạy được vì app Nest tạo với `bodyParser:false` và `jsonBody` chỉ parse JSON (tiền lệ `schemaMultipartHandler`).

### `importOne`

`validateAccess create` → `getAxios().get(encodeURL(url), {responseType:'stream', decompress:false})` (lỗi → `503`
`external-file`) → tên = `decodeURI(basename(pathname của URL cuối))` → mime = `Content-Type` trước `;` →
kiểm allow list và `filterMimeType` (`400`) → `uploadOne(decompressResponse(stream), {filename_download, type, title,
...body}, body.id)`. Agent HTTP/HTTPS kiểm IP theo `IMPORT_IP_DENY_LIST` (`agentWithIpValidation`). Không timeout
(R-14).

## 2. `/folders`

| Method + path | Middleware | Hành vi |
|---------------|------------|---------|
| `POST /folders` | | mảng → `createMany`, else `createOne`; đọc lại; `Forbidden` → `204` |
| `GET`, `SEARCH /folders` | `validateBatch('read')` | như files; `meta` của `directus_folders` |
| `GET /folders/:pk` | | `readOne` |
| `PATCH /folders` | `validateBatch('update')` | như files |
| `PATCH /folders/:pk` | | `updateOne` → `readOne` |
| `DELETE /folders` | `validateBatch('delete')` | `204` |
| `DELETE /folders/:pk` | | `204` |

## 3. Dịch vụ `FilesService` (ngoài upload, xem data-model.md §2)

- `createOne`: thiếu `type` → `400`; `filename_disk` chuẩn hóa `relative(sep, resolve(sep, p))`; trùng → `Forbidden`
  deferred.
- `updateMany`: một key và `filename_disk` đổi → transaction: `list(<dir>/<name>)`; đích chưa có → `move`; đã có →
  trỏ lại, xóa gốc khi `FILES_DELETE_ORIGINAL_ON_MOVE`; luôn xóa file phát sinh. Nhiều key đổi `filename_disk` →
  `400`.
- `deleteMany`: đọc `id, storage, filename_disk` sudo → `super.deleteMany` → `list(parse(filename_disk).name)` → xóa.
- `readByQuery`: `TUS_ENABLED` → thêm filter `tus_id: {_null: true}`.
- Ghi lồng từ collection khác và `directus_users.avatar` đi qua `FilesService` (gỡ khỏi
  `COLLECTIONS_WITHOUT_SERVICE_YET`, FR-017).

## 4. `router-options.ts`: mẫu `OPTIONS` thêm

Đo trên Directus 11.17.4 ngày 2026-10-13 (T018), không token, cặp chính (TUS tắt), `assets-limit` (TUS bật, CORS tắt),
`cors-hsts` (CORS bật):

| Path | `Allow` (TUS tắt) | TUS bật | CORS bật |
|------|-------------------|---------|----------|
| `/files` | `POST,GET,HEAD,SEARCH,PATCH,DELETE` | như TUS tắt | `204`, `Access-Control-Allow-Methods`, không `Allow` |
| `/files/import` | `POST,GET,HEAD,PATCH,DELETE` (khớp cả `/:pk`) | như TUS tắt | như trên |
| `/files/:pk` | `GET,HEAD,PATCH,DELETE` | như TUS tắt | như trên |
| `/files/tus` | `GET,HEAD,PATCH,DELETE` (khớp `/:pk`) | `POST` (router tus trả) | như trên |
| `/files/tus/:id` | `404` | đi tới handler TUS: không quyền đọc `403`; có quyền `204` với `Tus-Version: 1.0.0`, `Tus-Resumable: 1.0.0`, `Tus-Extension: creation,termination,expiration`, `Tus-Max-Size` (khi có `FILES_MAX_UPLOAD_SIZE`), `access-control-*` của @tus/server | như trên |
| `/folders` | `POST,GET,HEAD,SEARCH,PATCH,DELETE` | | |
| `/folders/:pk` | `GET,HEAD,PATCH,DELETE` | | |
| `/assets/:pk`, `/assets/:pk/:filename`, `/assets/folder` | `GET,HEAD` | | |
| `/assets/folder/:pk`, `/assets/files` | `POST,GET,HEAD` | | |

Ghi chú: header `access-control-allow-headers` của @tus/server trong Directus có `CORS_ALLOWED_HEADERS` bị tách từng ký tự
(`C, o, n, t, e, n, t, -, T, y, p, e, ...`) vì chuỗi được trải vào mảng; port nguyên `services/tus/server.ts` tái tạo.
`POST /files/tus` với `Upload-Length` quá `FILES_MAX_UPLOAD_SIZE` trả `413`; tạo được trả `201`.

## 5. Lỗi và status

| Tình huống | Status, mã |
|------------|------------|
| Thiếu `type` (JSON), thiếu `url`, mime bị chặn, không file, file không tên, `transforms` sai | `400 INVALID_PAYLOAD` / `INVALID_QUERY` |
| File quá `FILES_MAX_UPLOAD_SIZE` | `413 CONTENT_TOO_LARGE` |
| Không quyền | `403 FORBIDDEN` |
| Lỗi tải URL, storage không ghi được (ngoài `EROFS`, `EACCES`, `EPERM`) | `503 SERVICE_UNAVAILABLE` |
| `EROFS`, `EACCES`, `EPERM` | `500 INTERNAL_SERVER_ERROR` |
| `Range` sai | `416 RANGE_NOT_SATISFIABLE` |
