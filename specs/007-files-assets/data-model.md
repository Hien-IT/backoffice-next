# Data model: Files, folders, assets, TUS (007)

Feature này không có DDL. App mới ghi `directus_files`, `directus_folders` (và `directus_activity`, `directus_revisions`
qua `ItemsService`) với cùng dòng như Directus, và ghi object trên storage dùng chung với cùng tên. Không có key Redis
mới ngoài các key Directus đã dùng: khóa TUS (`useLock`) và clock của lịch dọn (`SYNCHRONIZATION_NAMESPACE`).

## 1. Thực thể và quan hệ

| Thực thể | Nguồn | Ghi chú |
|----------|-------|---------|
| File | Dòng `directus_files` + object `storage/filename_disk` | §2, §3 |
| Folder | Dòng `directus_folders` | §4 |
| Storage location | `STORAGE_LOCATIONS` + `STORAGE_<LOC>_*` | §5 |
| File phát sinh | Object cạnh file gốc, tên theo §6 | không có dòng DB |
| Asset preset | `directus_settings.storage_asset_presets`, `storage_asset_transform`; preset `system-*` | §7 |
| Upload TUS | Dòng `directus_files` có `tus_id`, `tus_data` + object dở trên storage | §8 |

Quan hệ: File n–1 Folder (`folder`, FK `ON DELETE SET NULL`); Folder n–1 Folder (`parent`, FK không `on_delete`); File
n–1 User (`uploaded_by`, `modified_by`); Settings 0–1 Folder (`storage_default_folder`, FK `ON DELETE SET NULL`);
Settings 0–1 File × 4 (`project_logo`, `public_background`, `public_foreground`, `public_favicon`, bỏ qua kiểm quyền
ở `/assets`); User 0–1 File (`avatar`); collection người dùng m2o/m2m tới `directus_files` qua `FilesService` (FR-017).

## 2. `directus_files` (fields/files.yaml của system-data)

| Cột | Kiểu | App mới ghi | Ghi chú |
|-----|------|-------------|---------|
| `id` | uuid | `createOne` của ItemsService | khóa chính |
| `storage` | string | payload, mặc định location đầu của `STORAGE_LOCATIONS` | bắt buộc ở JSON `POST /files` |
| `filename_disk` | string | `<id><đuôi>`; đuôi = `extname(filename_download)` hoặc `.<mime.extension(type)>` hoặc rỗng | đổi được qua `PATCH` (chuyển object); chuẩn hóa chống path traversal ở `createOne` |
| `filename_download` | string | tên file multipart, tên cuối URL import, `Upload-Metadata` TUS | |
| `title` | string | `formatTitle(tên không đuôi)` khi không gửi và không thay file | |
| `type` | string | mime của phần multipart, `Content-Type` import, metadata TUS; mặc định `application/octet-stream` | bắt buộc ở JSON `POST /files` |
| `folder` | uuid | payload hoặc `storage_default_folder` | |
| `uploaded_by`, `uploaded_on` | uuid, timestamp | user hiện tại; `new Date().toISOString()` sau khi ghi object | special `user-created` |
| `modified_by`, `modified_on` | uuid, timestamp | ItemsService | `modified_on` là nguồn của `ETag`, `Last-Modified`, `version` đọc storage |
| `created_on` | timestamp | ItemsService | |
| `charset`, `duration`, `embed`, `location` | | không ghi (Directus không trích) | |
| `filesize` | bigint | `stat(filename_disk).size` sau khi ghi; TUS: `Upload-Length` | |
| `width`, `height` | integer | từ ảnh (jpeg, png, webp, gif, tiff, avif), đổi chỗ khi orientation ≥ 5 | chỉ khi chưa có |
| `metadata` | json | `pick(toàn bộ, FILE_METADATA_ALLOW_LIST)` (`*` = toàn bộ); key `ifd0`, `ifd1`, `exif`, `gps`, `interop`, `icc`, `iptc`, `xmp`; chuỗi được trim một tầng | chỉ khi chưa có |
| `description`, `tags` | text, json | IPTC `caption`, `keywords` (và `headline` → `title`) khi chưa có | |
| `focal_point_x`, `focal_point_y` | integer | payload | dùng cho `fit=cover` |
| `tus_id` | string(64) | TUS: id upload; `null` khi xong | `readByQuery` ẩn `tus_id != null` khi `TUS_ENABLED` |
| `tus_data` | json | TUS: `{metadata, size, offset, creation_date, ...}` của `@tus/utils` `Upload`; `metadata.replace_id` khi thay file | `null` khi xong |

Vòng đời upload multipart (`uploadOne`): `createOne` (dòng, `emitEvents:false`) → ghi object → `filesize` → metadata
→ `uploaded_on` → `updateOne` sudo → `files.upload`. Thay file: ghi `temp_<filename_disk>` → `updateOne` → xóa mọi
object theo tiền tố `id` → `move(temp, filename_disk)`. Lỗi giữa chừng: xóa dòng (file mới) hoặc file tạm (thay file).
Xóa: `super.deleteMany` → `list(<tên không đuôi>)` → xóa từng object (R-13).

Dòng `directus_activity`, `directus_revisions`: như ItemsService với `accountability`; `updateOne` sudo sau upload
không `accountability` nên không có revision riêng cho bước metadata (như Directus; bộ đối chiếu so số dòng).

## 3. Object trên storage

- Đường dẫn: `join(STORAGE_<LOC>_ROOT, filename_disk)` (local: `fullPath = join(root, join(sep, p))`; S3: key
  `root/filename_disk` nếu có `root`). Không thư mục con theo folder.
- File tạm thay file: `temp_<filename_disk>` cùng location.
- Health: `directus-health-file` ở mỗi location, không xóa.
- Ghi S3 bằng `Upload` của lib-storage với `ContentType = type`; `ACL`, `ServerSideEncryption` theo env.

## 4. `directus_folders`

| Cột | Ghi chú |
|-----|---------|
| `id` | uuid |
| `name` | string |
| `parent` | uuid, FK tới `directus_folders.id` không `on_delete` (xóa folder còn con: lỗi DB như Directus) |

`FoldersService` = `ItemsService('directus_folders')` + `buildTree(root)` cho zip (kiểm quyền đọc gốc với user không
admin, khử trùng tên trong cùng cha). Xóa folder: `directus_files.folder` và `storage_default_folder` về `null` do FK.

## 5. Storage location

`STORAGE_LOCATIONS` (mảng, mặc định `local`); mỗi `STORAGE_<LOC>_*` thành config camelCase qua `getConfigFromEnv`
(`FORCE_PATH_STYLE` → `forcePathStyle`), cộng `tus: {enabled, chunkSize}`. Driver `local`: `{root}`. Driver `s3`:
`root, key, secret, bucket, acl, serverSideEncryption, serverSideEncryptionKmsKeyId, endpoint, region, forcePathStyle,
connectionTimeout (5000), socketTimeout (120000), maxSockets (500), keepAlive (true)`. Driver khác: dừng khởi động
(D-16). Location đầu: mặc định upload, location của TUS.

## 6. File phát sinh

Tên: `basename(filename_disk, ext) + '__' + objectHash(transforms) + (toFormat cuối ? '.' + format : ext)`;
`transforms` là mảng bước đã dựng bởi `resolvePreset` (`toFormat`, `resize`, `extract`) nối với `transforms` của query,
không phải query thô. Cùng location với file gốc. `Content-Type` theo đuôi khi đổi định dạng. Bị xóa khi thay file, đổi
`filename_disk`, xóa file (tiền tố). Không có dòng DB; không cache ngoài storage.

Điều kiện sinh: `type` thuộc jpeg, png, webp, tiff, avif và có bước transform; width, height của ảnh ≤
`ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION`; hàng đợi sharp ≤ `ASSETS_TRANSFORM_MAX_CONCURRENT` (theo process); timeout
`ASSETS_TRANSFORM_TIMEOUT` (1–3600 s); `failOn = ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL`; tự `rotate()` trừ khi có bước
`rotate`.

## 7. Settings dùng

| Field `directus_settings` | Dùng ở |
|---------------------------|--------|
| `storage_default_folder` | folder mặc định khi upload, TUS |
| `storage_asset_transform` (`all`, `none`, `presets`) | kiểm query `/assets` |
| `storage_asset_presets` (`[{key, fit, width, height, quality, withoutEnlargement, format, transforms}]`) | `?key=` |
| `project_logo`, `public_background`, `public_foreground`, `public_favicon` | bỏ kiểm quyền ở `/assets` |

Preset hệ thống: `system-{small,medium,large}-{cover,contain}` = 64, 300, 800 px, `format: auto`.

## 8. Upload TUS

- Tạo: dòng `directus_files` với `tus_id`, `tus_data`, `filesize = Upload-Length`, `storage` = location đầu, `folder`
  mặc định, `filename_disk = <id><ext>`, `type`, `title` mặc định; `createChunkedUpload` (local: file rỗng; S3:
  `CreateMultipartUpload`, `upload-id` trong `tus_data.metadata`).
- Ghi chunk: `writeChunk` theo offset (local `r+`; S3 part ≥ 5 MiB theo `TUS_CHUNK_SIZE`, tối đa 10.000 part), cập nhật
  `tus_data.offset`; đủ → `finishChunkedUpload`, thay file (`replace_id`): xóa tiền tố cũ, `move`.
- Hoàn tất (`onUploadFinish`): trích metadata, `tus_id`, `tus_data` = `null`; thay file: chỉ copy `filename_download`,
  `filesize`, `type` và metadata sang dòng đích (không `title`, `folder`...), `filename_disk` đích giữ đuôi cũ, xóa dòng
  tạm qua `ItemsService` (không đụng storage); `files.upload`; header `Directus-File-Id`. Mỗi chunk: `updateOne` sudo
  cập nhật `modified_on` và phát `files.update`.
- Tìm upload: theo `tus_id`, `storage` và `uploaded_by` = user hiện tại khi accountability có `user` (không có `user` thì
  không lọc; admin không ngoại lệ). Offset của `HEAD` lấy từ `tus_data.offset` trong DB.
- S3: phần dư của `PATCH` nhỏ hơn part (trừ part cuối) bị bỏ, offset trả về không gồm phần dư; hoàn tất đòi đúng
  `ceil(size / chunkSize)` part (R-18).
- Hết hạn: `size != offset` và `modified_on + TUS_UPLOAD_EXPIRATION < now` (tính từ chunk cuối) → xóa dòng và
  `deleteChunkedUpload`; dòng `size == offset` nhưng hoàn tất lỗi không bao giờ hết hạn.
- Khóa: key = id upload trong kv của `useLock()` (Redis `directus:lock`), `acquireTimeout` 30 s, `lockTimeout` 60 s.
- Clock lịch dọn: `${SYNCHRONIZATION_NAMESPACE}:clock:tus-cleanup:${TUS_CLEANUP_SCHEDULE}` (Redis khi
  `SYNCHRONIZATION_STORE=redis`, else bộ nhớ process).

## 9. Event

| Event | Khi | Ghi chú |
|-------|-----|---------|
| `files.upload` (action) | sau multipart, import, TUS xong | payload, key, collection |
| `files.create`, `files.update`, `files.delete` | JSON `POST`, `PATCH`, `DELETE` qua ItemsService | multipart không phát `files.create` |
| `folders.create|update|delete` | ItemsService | |
| `websocket.event` | như 005 | `files.upload` → `create` |

## 10. Giá trị không ghi, không có

`duration`, `charset`, event `files.import`, `ASSETS_DEFAULT_FORMAT`, timeout của import (R-14).
