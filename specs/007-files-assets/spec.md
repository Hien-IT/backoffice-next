# Feature Specification: Files, folders, assets (`/files`, `/folders`, `/assets`, TUS)

**Feature Branch**: `007-files-assets`
**Created**: 2026-10-12
**Status**: Draft
**Input**: User description: "Người dùng tải file lên, quản lý file và thư mục qua /files, /folders, và lấy file qua /assets/:id giống hệt Directus. Hỗ trợ upload multipart, upload resumable qua TUS, import từ URL, metadata ảnh (EXIF, IPTC, kích thước), và các storage location cấu hình bằng STORAGE_* giống Directus. Chỉ hỗ trợ driver local và s3 (gồm dịch vụ tương thích S3 như MinIO). Nếu cấu hình driver khác (gcs, azure, cloudinary, supabase) thì dừng khi khởi động và báo rõ location nào không hỗ trợ. Asset hỗ trợ transform (width, height, fit, quality, format, withoutEnlargement, key preset, transforms) với cùng cách đặt tên file phát sinh như Directus, để hai app dùng chung file đã sinh. Áp dụng ASSETS_* (giới hạn transform, cache-control) và phân quyền file giống Directus. Tham chiếu directus/api/src/services/files.ts, assets.ts, tus, packages/storage*. Tiêu chí chấp nhận: file tải lên ở app này xem và tải được ở app kia, và URL asset có transform trả về ảnh giống nhau."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/api/src` trừ khi ghi khác):

- Route: `controllers/files.ts` (`multipartHandler`, `POST /import`), `folders.ts`, `assets.ts` (`GET /:pk/:filename?`,
  `POST /folder/:pk`, `POST /files`), `tus.ts` (`checkFileAccess`); thứ tự mount trong `app.ts` (`/assets`, `/files/tus`
  chỉ khi `TUS_ENABLED`, trước `/files`, rồi `/folders`); `middleware/respond.ts`, `validate-batch.ts`;
  `utils/get-cache-headers.ts`.
- Service: `services/files.ts` (`uploadOne`, `importOne`, `createOne`, `updateMany`, `deleteMany`, `readByQuery`),
  `services/files/lib/extract-metadata.ts`, `services/files/utils/get-metadata.ts`, `parse-image-metadata.ts`,
  `lib/get-sharp-instance.ts`, `services/assets.ts` (`getAsset`, `zipFolder`, `getAssetSuffix`),
  `utils/transformations.ts` (`resolvePreset`, `getFormat`, `maybeExtractFormat`), `services/folders.ts` (`buildTree`).
- TUS: `services/tus/server.ts`, `data-store.ts`, `lockers.ts`, `schedules/tus.ts`; hằng `RESUMABLE_UPLOADS`
  (`constants.ts`).
- Import từ URL: `request/index.ts`, `request/agent-with-ip-validation.ts`, `request/is-denied-ip.ts`.
- Storage: `storage/` (`register-drivers.ts`, `register-locations.ts`, `get-storage-driver.ts`),
  `directus/packages/storage`, `storage-driver-local`, `storage-driver-s3`.
- Hằng: `ASSET_TRANSFORM_QUERY_KEYS`, `SYSTEM_ASSET_ALLOW_LIST`, `SUPPORTED_IMAGE_TRANSFORM_FORMATS`,
  `SUPPORTED_IMAGE_METADATA_FORMATS` (`constants.ts`), `TransformationMethods` (`directus/packages/types/src/assets.ts`),
  biến mặc định `FILES_*`, `ASSETS_*`, `TUS_*`, `IMPORT_IP_DENY_LIST`, `FILE_METADATA_ALLOW_LIST`
  (`directus/packages/env/src/constants/defaults.ts`).
- Phiên bản thư viện của Directus 11.17.4 (`directus/pnpm-workspace.yaml`): sharp 0.34.5, object-hash 3.0.0,
  @tus/server 2.3.0, @tus/utils 0.6.0, busboy 1.6.0, exif-reader 2.0.2, icc 3.0.0, archiver 7.0.1, mime-types 3.0.1,
  content-disposition 0.5.4, encodeurl 2.0.0.

**Đã có từ feature 001 đến 006** (trong `apps/api/src` và `libs/`): `libs/storage`, `libs/storage-driver-local`,
`libs/storage-driver-s3` (port của @directus/storage*); `getStorage()`, đăng ký driver và location theo `STORAGE_*`;
kiểm driver lúc khởi động (`startup/validate-storage-drivers.ts`, D-16: dừng và báo location dùng driver khác `local`,
`s3`); health `storage:<loc>:responseTime`; `uploads` trong `/server/info`; engine `ItemsService`, `PayloadService`,
`MetaService`, `validateBatch`, `useCollection`, response cache, `Emitter` và cầu nối `websocket.event`; `useLock`;
`scheduleSynchronizedJob` (`utils/schedule.ts`); `busboy` 1.6.0. Chưa có: `FilesService`, `FoldersService`,
`AssetsService`, TUS, import từ URL, route `/files`, `/folders`, `/assets` (D-09.5); `directus_files`,
`directus_folders` đang đi qua `ItemsService` chung (D-31, `COLLECTIONS_WITHOUT_SERVICE_YET`). Biến `FILES_*`,
`ASSETS_*`, `TUS_*`, `IMPORT_IP_DENY_LIST`, `FILE_METADATA_ALLOW_LIST` đang ở nhóm "chưa hỗ trợ" (chỉ cảnh báo).

**Bộ test liên quan của Directus** (số khối `it`/`it.each` mỗi file; mỗi khối chạy theo vendor và theo storage `local`,
`minio`): blackbox `tests/blackbox/tests/common/assets/read.test.ts` (1), `format.test.ts` (2), `limit.test.ts` (2),
`concurrency.test.ts` (1), `cache-revalidate.test.ts` (6); `tests/db/routes/files/storage.test.ts` (3), `tus.test.ts` (2);
`tests/db/routes/collections/files.test.ts` (2). E2E `tests/e2e/tests/endpoints/files/files.test.ts` (4), `old.test.ts`
(2), `assets/assets.test.ts` (6). Không có test blackbox cho `/folders` và `/files/import`.

## Clarifications

### Session 2026-10-13

- Q: "Ảnh giống nhau" của tiêu chí chấp nhận là trùng từng byte hay so điểm ảnh? → A: Trùng từng byte. Nếu đo thấy lệch
  do bản build thư viện ảnh giữa hai image, ghi bằng chứng và để tech lead chọn hạ xuống so điểm ảnh hay không trước khi
  đóng feature (FR-036, SC-004, Assumptions).
- Q: Mỗi lần push chạy bộ file, asset trên storage nào? → A: Postgres chạy cả `local` và MinIO; MySQL, SQLite bộ rút gọn
  chỉ MinIO; đủ ma trận vendor × storage ở workflow riêng và nightly (FR-081).
- Q: Có benchmark transform chưa sinh sẵn không? → A: Có: tập tham số cố định, xóa file phát sinh trước mỗi vòng, mức
  đồng thời dưới `ASSETS_TRANSFORM_MAX_CONCURRENT`, áp ngưỡng 10% (FR-084, SC-007).

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là người dùng app Directus (module Files, interface file và image, avatar), client gọi API
(`@directus/sdk`, script, `tus-js-client`), trang web công khai nhúng ảnh qua `/assets`, và đội vận hành cấu hình storage.

### User Story 1 - Tải file lên và tải về, dùng chéo giữa hai app (Priority: P1)

Người dùng tải một hoặc nhiều file lên bằng multipart (kèm `title`, `folder`, `storage`, các field khác đặt trước phần
file), thay file có sẵn bằng `PATCH /files/:id` multipart, tạo bản ghi file bằng JSON, rồi xem và tải file qua
`/assets/:id` (inline, `?download`, `Range`). File tải lên ở app này xem và tải được ở app kia, với cùng nội dung,
cùng dòng `directus_files` và cùng object trên storage.

**Why this priority**: Đây là tiêu chí chấp nhận của feature; interface file, image, avatar của app Directus đều dựa
trên luồng này (D-09.5).

**Independent Test**: Tải cùng file lên mỗi app trên từng storage (`local`, S3/MinIO); so status, body, header, dòng
`directus_files` (trừ id, ngày giờ) và object trên storage; lấy file qua `/assets` ở app còn lại và so từng byte.

**Acceptance Scenarios**:

1. **Given** storage location `local` và `s3`, **When** gửi `POST /files` multipart với `storage`, `title`,
   `description` rồi file, **Then** trả `200` `{data: {...}}` giống Directus; `filename_disk` là `<id>.<ext>`; `type`
   theo header của phần file; `filesize`, `uploaded_by`, `uploaded_on`, `width`, `height`, `metadata` đúng như
   Directus; object nằm ở location đã chọn.
2. **Given** multipart có nhiều file, **When** tải lên, **Then** trả `{data: [...]}`; mỗi file chỉ nhận các field đứng
   trước nó (sau file trước), như Directus.
3. **Given** file tải lên ở app A, **When** gọi `GET /assets/:id` ở app B với `?download`, với `Range: bytes=0-99`,
   với `HEAD`, **Then** nội dung trùng từng byte với file gốc; status (`200`, `206`), `Content-Type`,
   `Content-Disposition`, `Content-Range`, `Accept-Ranges`, `Cache-Control`, `Last-Modified`, `ETag`, `Vary` giống
   Directus.
4. **Given** file có sẵn và đã có file phát sinh, **When** `PATCH /files/:id` multipart với file mới khác đuôi, **Then**
   `filename_disk` đổi đuôi, file gốc cũ và mọi file phát sinh bị xóa khỏi storage, `GET /assets/:id` ở cả hai app trả
   file mới.
5. **Given** `POST /files` JSON không có `type` hoặc thiếu `storage`, multipart không có file, file không có tên, mime
   ngoài `FILES_MIME_TYPE_ALLOW_LIST`, file lớn hơn `FILES_MAX_UPLOAD_SIZE`, **When** gửi, **Then** cùng status (`400`,
   `413`), mã lỗi và message như Directus; không còn dòng `directus_files` hay object dở dang.
6. **Given** file bị xóa (`DELETE /files/:id`, `DELETE /files` với mảng, `keys`, `query`), **When** xóa ở một app,
   **Then** trả `204`; dòng `directus_files`, file gốc và mọi file phát sinh bị xóa; app kia trả `403` cho
   `/assets/:id` như Directus.
7. **Given** user chỉ có quyền đọc một phần `directus_files`, **When** gọi `GET /files`, `GET /files/:id`,
   `GET /assets/:id`, **Then** cùng tập field, cùng `403` khi không có quyền, như Directus; file là logo, favicon,
   ảnh nền công khai trong `directus_settings` xem được không cần quyền.

---

### User Story 2 - Transform ảnh với file phát sinh dùng chung (Priority: P1)

Trang web và app Directus lấy ảnh đã resize, đổi định dạng, chất lượng qua `/assets/:id?width=&height=&fit=&quality=
&format=&withoutEnlargement=&transforms=` hoặc `?key=<preset>`. File phát sinh có cùng tên và nằm cùng storage như
Directus đặt, nên app nào sinh trước thì app kia dùng lại, và hai app trả cùng ảnh.

**Why this priority**: Là nửa còn lại của tiêu chí chấp nhận; thumbnail của app Directus (preset `system-*`) dùng luồng
này trên mọi màn hình có ảnh.

**Independent Test**: Với bộ ảnh mẫu (jpeg, png, webp, tiff, avif, gif, ảnh có EXIF xoay) và ma trận tham số transform,
sinh ở app A, xóa file phát sinh, sinh lại ở app B; so tên object trên storage và nội dung trả về từng byte; rồi gọi app
kia khi file đã có và kiểm không có object mới được ghi.

**Acceptance Scenarios**:

1. **Given** ảnh jpeg và `?width=200&height=200&fit=cover&quality=80`, **When** gọi ở mỗi app, **Then** object phát
   sinh tên `<tên filename_disk không đuôi>__<hash>.<đuôi>` giống hệt tên Directus đặt (cùng `getAssetSuffix`,
   `maybeExtractFormat`), và ảnh trả về trùng từng byte (Assumptions về phiên bản thư viện ảnh).
2. **Given** file phát sinh do Directus tạo, **When** app mới nhận cùng URL, **Then** app mới đọc file đó, không ghi
   object mới; và ngược lại.
3. **Given** `?format=auto` với `Accept` có `image/avif`, chỉ `image/webp`, hoặc không có, **When** gọi, **Then** định
   dạng, `Content-Type`, `Vary` (thêm `Accept`) như Directus.
4. **Given** `directus_settings.storage_asset_transform` là `all`, `presets`, `none` và `storage_asset_presets` có preset,
   **When** gọi với `?key=`, với tham số tự do, với `key` không tồn tại, với preset `system-*`, **Then** cùng kết quả hoặc
   lỗi `400` như Directus.
5. **Given** `transforms` không phải mảng JSON, nhiều bước hơn `ASSETS_TRANSFORM_MAX_OPERATIONS`, method ngoài danh sách,
   tham số sharp sai, kích thước vượt `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION`, **When** gọi, **Then** cùng lỗi, status
   (`400`) như Directus.
6. **Given** số transform đang chạy và chờ vượt `ASSETS_TRANSFORM_MAX_CONCURRENT`, hoặc transform quá
   `ASSETS_TRANSFORM_TIMEOUT`, **When** gọi, **Then** `503` với cùng message như Directus, không để lại object dở dang.
7. **Given** file không phải ảnh transform được (pdf, gif, svg), **When** gọi có tham số transform, **Then** trả file gốc
   như Directus.
8. **Given** focal point (`focal_point_x`, `focal_point_y` trên file hoặc trong query), **When** `fit=cover` với đủ width
   và height, **Then** vùng cắt và tên file phát sinh như Directus.

---

### User Story 3 - Quản lý file và thư mục (Priority: P1)

Người dùng tạo, đổi tên, lồng, xóa thư mục qua `/folders`; đọc, lọc, tìm, sửa metadata file (title, tags, folder,
focal point, `filename_disk`, `filename_download`) qua `/files` với mọi query của Directus; tải một thư mục hoặc một
nhóm file dưới dạng zip qua `POST /assets/folder/:pk`, `POST /assets/files`.

**Why this priority**: Module Files của app Directus dùng đúng các route này; không có chúng thì không duyệt, di chuyển
hay dọn file được.

**Independent Test**: Chạy cùng chuỗi request ở hai app; so status, body, header, các dòng `directus_files`,
`directus_folders`, object trên storage; mở module Files của app Directus qua reverse proxy với route đi tới app mới.

**Acceptance Scenarios**:

1. **Given** cây thư mục, **When** `GET /folders`, `GET /files?filter[folder][_eq]=...&search=...&sort=...&meta=*`,
   `SEARCH`, **Then** body, `meta` giống Directus.
2. **Given** thư mục chứa file, **When** xóa thư mục, **Then** file về gốc (`folder = null`) và
   `storage_default_folder` về `null` khi trỏ tới thư mục đó (hành vi khóa ngoại của schema hệ thống), như Directus.
3. **Given** một file, **When** `PATCH /files/:id` đổi `filename_disk`, **Then** object được chuyển (hoặc trỏ lại khi
   đích đã có, theo `FILES_DELETE_ORIGINAL_ON_MOVE`), file phát sinh bị xóa, như Directus; đổi `filename_disk` cho nhiều
   file một lúc trả `400`.
4. **Given** thư mục có thư mục con và file, **When** `POST /assets/folder/:pk` hoặc `POST /assets/files` với `ids`,
   **Then** trả zip có cùng danh sách đường dẫn và nội dung file như Directus, `Content-Type`,
   `Content-Disposition` cùng dạng; quyền kiểm như Directus.
5. **Given** collection người dùng có field m2o tới `directus_files` (image, file) và m2m `files`, **When** ghi item lồng
   tạo hoặc sửa file qua `/items`, **Then** đi qua dịch vụ file như Directus (ví dụ thiếu `type` trả lỗi như Directus).

---

### User Story 4 - Upload resumable qua TUS (Priority: P2)

Khi `TUS_ENABLED=true`, client tải file lớn theo từng phần qua `/files/tus` (tạo, gửi chunk, hỏi offset, hủy, thay file
có sẵn bằng `metadata.id`/`replace_id`), tiếp tục được sau khi mất kết nối, kể cả khi chunk sau đi tới app kia.

**Why this priority**: Cần cho file lớn và app Directus khi bật TUS; sau multipart (US1) vì mặc định tắt.

**Independent Test**: Port `tus.test.ts`; tải một file nhiều chunk xen kẽ giữa hai app (chunk lẻ ở Directus, chunk chẵn
ở app mới) trên `local` và S3; so dòng `directus_files` và nội dung cuối.

**Acceptance Scenarios**:

1. **Given** `TUS_ENABLED=true`, **When** `POST /files/tus` với `Upload-Length`, `Upload-Metadata` (`filename_download`,
   `type`, `folder`...), **Then** `201` với `Location` theo `PUBLIC_URL`, dòng `directus_files` có `tus_id`, `tus_data`;
   `GET /files` không thấy file dở dang.
2. **Given** upload dở ở app A, **When** gửi `HEAD` rồi `PATCH` chunk tiếp ở app B, **Then** offset đúng, upload hoàn tất,
   `tus_id`, `tus_data` về `null`, metadata ảnh được trích, header `Directus-File-Id` trả về, event `files.upload` phát,
   như Directus.
3. **Given** upload của user khác, metadata sai, thay file đang có upload dở, user không có quyền tạo, sửa, **When** gửi,
   **Then** cùng status và lỗi như Directus.
4. **Given** upload dở quá `TUS_UPLOAD_EXPIRATION`, **When** lịch `TUS_CLEANUP_SCHEDULE` chạy (một instance mỗi lượt khi
   `SYNCHRONIZATION_STORE=redis`, mọi instance khi mặc định `memory`, FR-054), **Then** dòng và phần đã tải bị xóa (S3:
   hủy multipart upload) như Directus; chạy nhiều lần không đổi kết quả.
5. **Given** `TUS_ENABLED` không bật, **When** gọi `/files/tus`, **Then** cùng status và body như Directus (không có
   router TUS, request đi tới router `/files`).

---

### User Story 5 - Import file từ URL (Priority: P2)

Người dùng nhập file từ một URL công khai qua `POST /files/import` (`url`, `data`), app tải về, lưu vào storage và trích
metadata như upload thường, với bảo vệ chống truy cập mạng nội bộ theo `IMPORT_IP_DENY_LIST`.

**Why this priority**: Module Files có nút "Import from URL"; cần sau upload (US1).

**Independent Test**: Phục vụ file mẫu từ một server HTTP trong môi trường đối chiếu; import ở hai app; so body, dòng
`directus_files`, object; thử URL trỏ tới IP bị chặn.

**Acceptance Scenarios**:

1. **Given** URL trả ảnh (có hoặc không nén gzip, deflate, br, có chuyển hướng), **When** `POST /files/import`, **Then**
   `filename_download` theo tên cuối của URL sau chuyển hướng, `type` theo `Content-Type`, `title` như Directus, nội dung
   object trùng file nguồn.
2. **Given** URL tới IP trong `IMPORT_IP_DENY_LIST` (mặc định `0.0.0.0` nghĩa là mọi interface nội bộ và
   `169.254.169.254`), kể cả qua tên miền phân giải ra IP đó hoặc qua chuyển hướng, **When** import, **Then** bị từ chối
   với cùng lỗi (`503` mã của Directus) và không có dòng `directus_files`.
3. **Given** mime ngoài `FILES_MIME_TYPE_ALLOW_LIST` hoặc ngoài `options.filterMimeType`, payload thiếu `url`, **When**
   import, **Then** cùng `400` như Directus.

---

### User Story 6 - Cấu hình storage và vận hành (Priority: P2)

Đội vận hành dùng chung file `.env` với Directus: `STORAGE_LOCATIONS` nhiều location, driver `local` (root dùng chung
giữa các instance) và `s3` (AWS S3, MinIO, dịch vụ tương thích S3 với `ENDPOINT`, `FORCE_PATH_STYLE`, `ACL`,
`SERVER_SIDE_ENCRYPTION`, timeout, số kết nối). Cấu hình driver khác làm app dừng khi khởi động và báo rõ location.

**Why this priority**: Điều kiện chạy song song trên cùng storage (Nguyên tắc II, IV, VII); kiểm driver đã có từ 001 nên
chỉ cần bổ sung và kiểm lại.

**Independent Test**: Khởi động app mới với từng cấu hình (local, s3 MinIO, nhiều location, một location `gcs`); kiểm log,
mã thoát, `/server/health`, `/server/info`, và upload vào từng location.

**Acceptance Scenarios**:

1. **Given** `STORAGE_LOCATIONS=local,s3`, **When** upload không chỉ `storage`, **Then** file vào location đầu tiên; chỉ
   `storage=s3` thì vào `s3`; app kia đọc được cả hai.
2. **Given** một location dùng `gcs`, `azure`, `cloudinary` hoặc `supabase`, **When** khởi động, **Then** app thoát mã khác
   0 trước khi nhận request, log nêu tên location, driver và danh sách driver hỗ trợ (D-16, đã có từ 001).
3. **Given** các biến `FILES_*`, `ASSETS_*`, `TUS_*`, `IMPORT_IP_DENY_LIST`, `FILE_METADATA_ALLOW_LIST` và tùy chọn S3
   của Directus, **When** khởi động, **Then** chúng không còn trong cảnh báo "chưa hỗ trợ" và có tác dụng như ở Directus.

---

### User Story 7 - Bộ test file, asset của Directus chạy qua trên app mới (Priority: P2)

Các file blackbox và E2E liệt kê ở đầu spec được port sang bộ đối chiếu và đạt với cả hai app, trên storage `local` và
MinIO.

**Why this priority**: Kiểm chứng diện rộng theo vendor và storage; là cổng đóng feature.

**Independent Test**: Chạy bộ port với `TEST_DB=postgres`, `mysql`, `sqlite3` (vendor còn lại ở nightly), mỗi storage.

**Acceptance Scenarios**:

1. **Given** bộ port, **When** chạy với URL của app mới, **Then** 100% ca đạt, cùng kết quả như với URL của Directus.
2. **Given** một ca fail trên chính Directus ở một vendor hoặc storage, **When** chạy, **Then** ca đó được bỏ qua kèm ghi
   chú (Assumptions).

---

### Edge Cases

- Multipart: field đứng sau file không áp vào file đó; giá trị `"null"`, `"true"`, `"false"` thành `null`, boolean;
  không có `title` thì lấy từ tên file qua `formatTitle`; đọc lại bị `Forbidden` sau khi tạo trả `204` không body.
- Upload bị ngắt giữa chừng hoặc lỗi storage: dòng `directus_files` và object dở dang bị dọn như `cleanUp` của Directus;
  lỗi quyền ghi (`EROFS`, `EACCES`, `EPERM`) `500`, lỗi khác `503`.
- Xóa file dùng tiền tố tên (`list(<tên không đuôi>)`): mọi object có tên bắt đầu bằng tiền tố đó bị xóa, kể cả object
  không phải file phát sinh khi `filename_disk` được đặt tay ngắn (`photo.jpg` xóa cả `photography.png`; driver local so
  tiền tố không phân biệt hoa thường và đệ quy thư mục con). `filename_disk` có thư mục con (`a/b.jpg`): object gốc không
  bị xóa (mồ côi), object ở gốc bắt đầu bằng `b` bị xóa; thay file chỉ liệt kê theo `id` nên file phát sinh `b__*` ở gốc
  còn lại và được phục vụ tiếp. Làm như Directus (rủi ro R-13).
- Import từ URL không đặt timeout và không giới hạn kích thước: URL trả chậm hoặc file rất lớn giữ request và ghi storage
  tới khi phía kia đóng, như Directus (rủi ro R-14).
- Thay file (multipart, import) sửa dòng trước khi xóa object cũ và chuyển tên tạm: trong khoảng đó app kia trả `403`
  (object chưa có) hoặc file cũ; lỗi sau bước xóa làm dòng trỏ tới object không tồn tại, không rollback (R-15).
- Response cache dùng chung (005) áp cho mọi `GET` kể cả `GET /files` (lưu qua `respond`); `GET /assets` tra cache nhưng
  không bao giờ lưu (stream, không qua `respond`); `HEAD` không tra. Mặc định `CACHE_AUTO_PURGE=false` nên `GET /files`
  ở app kia có thể trả bản cũ tới hết TTL sau khi upload; bật `CACHE_AUTO_PURGE` thì một upload multipart xóa toàn bộ
  data cache ba lần (`createOne`, `updateOne`, sudo `updateOne`). Như Directus.
- Thay file bằng TUS (`replace_id`): chỉ `filename_download`, `filesize`, `type` và metadata trích được chép sang dòng
  đích (không chép `title`, `folder`...); `filename_disk` của đích giữ đuôi cũ dù `type` đổi (khác `uploadOne`); object
  cũ xóa theo tiền tố khóa chính rồi `move`; dòng tạm xóa qua `ItemsService` (không đụng storage). Như Directus.
- TUS: `modified_on` của dòng dở cập nhật ở mỗi chunk nên hết hạn tính từ chunk cuối; `PUBLIC_URL` mặc định `/` cho
  `Location` là `//files/tus/<id>` (dùng chung `.env` nên hai app giống nhau); `metadata.id` trỏ tới file không tồn tại
  với admin tạo dòng mới mang id client gửi (đo ở task).
- `transforms=[]` kèm tham số khác đi qua mọi chế độ `storage_asset_transform` (R-16); `withoutEnlargement=false` là
  bật; `focal_point_x=0` trong query rơi về giá trị trên file.
- Sinh file phát sinh không khóa: trên `local` (và volume dùng chung) request thứ hai có thể thấy `exists` giữa chừng và
  stream file dở với `Content-Length` sai; trên S3 object chỉ xuất hiện khi ghi xong nên cả hai cùng sinh, bản ghi sau
  thắng; sinh lỗi xóa object có thể đang được request khác đọc (R-17). Như Directus.
- Không giới hạn số upload đồng thời phía server (`FILES_MAX_UPLOAD_CONCURRENCY` chỉ báo cho client).
- File có trong DB nhưng mất trên storage: `/assets/:id` trả `403` như Directus.
- `Range` không hợp lệ (đầu sau cuối, đầu vượt kích thước, cuối ≤ 0): `416`; `Range` bị bỏ qua khi có transform.
- `ASSETS_CACHE_REVALIDATE=true`: `If-None-Match`, `If-Modified-Since` khớp trả `304` với `Cache-Control: max-age=0,
  must-revalidate`; ETag là `"<giây của modified_on>"`, đổi sau khi thay file.
- `Cache-Control` của asset: `public` khi không đăng nhập, `private` khi có role, `max-age` theo `ASSETS_CACHE_TTL`,
  `no-store` khi request bỏ cache được phép; `Content-Security-Policy` theo `ASSETS_CONTENT_SECURITY_POLICY_*`.
- Hai app sinh cùng file phát sinh cùng lúc: cả hai ghi cùng tên với cùng nội dung; không khóa, như hai instance Directus.
- File phát sinh có trước khi thay file gốc: bị xóa khi thay (US1), nên không trả ảnh cũ.
- Ảnh EXIF orientation ≥ 5: `width`, `height` đổi chỗ; transform tự xoay trừ khi có bước `rotate`.
- `FILE_METADATA_ALLOW_LIST=*` ghi toàn bộ metadata; giá trị chuỗi được cắt khoảng trắng một tầng.
- `TUS_ENABLED=true` với driver không hỗ trợ TUS: không xảy ra trong phạm vi vì `local`, `s3` đều hỗ trợ; TUS chỉ dùng
  location đầu tiên của `STORAGE_LOCATIONS`.
- Không có Redis: khóa TUS dùng bộ nhớ trong process, chỉ an toàn một instance (cảnh báo một instance đã có khi thiếu
  Redis, 001).
- File hệ thống công khai (logo, favicon, nền trong `directus_settings`) bỏ qua kiểm quyền ở `/assets`, kể cả khi role
  public không đọc được `directus_files`.
- Id không phải uuid ở `/assets/:id`: `403`; `/:pk/:filename` dùng `filename` cho `Content-Disposition`.

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| US1 | 1–7 | FR-001 đến FR-004, FR-010 đến FR-015, FR-030 đến FR-033 | SC-002, SC-003 |
| US2 | 1–8 | FR-034 đến FR-040 | SC-004, SC-005 |
| US3 | 1–5 | FR-001, FR-016, FR-017, FR-020, FR-021, FR-041 | SC-002 |
| US4 | 1–5 | FR-050 đến FR-054 | SC-003 |
| US5 | 1–3 | FR-060, FR-061 | SC-002 |
| US6 | 1–3 | FR-070 đến FR-073 | SC-006 |
| US7 | 1–2 | FR-080, FR-081 | SC-001 |
| Mọi story | — | FR-082 đến FR-084 | SC-007 |

## Requirements *(mandatory)*

### Functional Requirements

**Route và hành vi chung**

- **FR-001**: App mới PHẢI phục vụ mọi route của `controllers/files.ts`, `folders.ts`, `assets.ts` và `tus.ts` (khi
  `TUS_ENABLED`) với cùng method, path, thứ tự mount, middleware, body, query, response, status (kể cả `204`, `206`,
  `304`, `416`), header và thứ tự lỗi như Directus 11.17.4, kể cả `SEARCH`, `OPTIONS`, `HEAD`.
- **FR-002**: Quyền trên `directus_files`, `directus_folders` PHẢI áp như Directus qua engine của 004 (đọc theo field
  cho phép, tạo, sửa, xóa theo permission và filter); `/assets` kiểm quyền đọc file theo accountability (gồm role
  public) và giới hạn field đọc được như `sanitizeFields`; file hệ thống công khai bỏ qua kiểm quyền.
- **FR-003**: Ghi `directus_files`, `directus_folders` PHẢI tạo dòng `directus_activity`, `directus_revisions` và phát
  event cùng thời điểm, cùng điều kiện như Directus; cùng điều kiện đẩy `websocket.event` như 005. Số dòng và event mong
  đợi (đọc từ code Directus, bộ đối chiếu so số dòng theo `collection`, `item`, `action`; `delta` của revision thứ hai
  khi thay file chỉ có `modified_on`, `modified_by`):

  | Đường ghi | `directus_activity` | `directus_revisions` | Event |
  |-----------|---------------------|----------------------|-------|
  | Multipart tạo (mỗi file) | 1 `create` | 1 (chưa có `filename_disk`, `filesize`, metadata: bước sudo không ghi) | chỉ action `files.upload`, không `files.create` |
  | JSON `POST /files` | 1 `create` | 1 | `files.create` (filter và action) |
  | `PATCH /files/:pk` multipart | 2 `update` (thay file, rồi `updateOne(pk, {})` của controller) | 2 | `files.upload` |
  | Import mới / import có `data.id` | 1 `create` / 1 `update` | 1 / 1 | chỉ action `files.upload`, không filter |
  | TUS: tạo, mỗi chunk, xong | 1 `create` (dòng tạo có accountability); mỗi chunk 0 và hoàn tất 0 (ItemsService sudo) | 1; chunk và hoàn tất 0 | `files.update` mỗi chunk (sudo vẫn phát), `files.upload` khi xong |
  | Xóa | 1 `delete` mỗi key | 0 | `files.delete` |
  | Upload mới lỗi giữa chừng | thêm 1 `delete` (dọn), dòng `create` còn | — | — |
- **FR-004**: Mọi giá trị app mới ghi vào `directus_files` (`id`, `storage`, `filename_disk`, `filename_download`,
  `type`, `filesize`, `width`, `height`, `metadata`, `tags`, `title`, `description`, `uploaded_by`, `uploaded_on`,
  `modified_by`, `modified_on`, `tus_id`, `tus_data`, `folder`, focal point) PHẢI có cùng định dạng như Directus
  (Nguyên tắc II), để mỗi app đọc, sửa, xóa file của app kia.

**Upload và quản lý file**

- **FR-010**: Multipart PHẢI làm như `multipartHandler`: field trước file, reset payload sau mỗi file, ép kiểu `"null"`,
  `"true"`, `"false"`, `title` từ tên file, `filename_download`, `type` theo phần file, kiểm
  `FILES_MIME_TYPE_ALLOW_LIST` (minimatch; chỉ áp cho multipart và import, không áp cho JSON và ghi lồng), giới hạn
  `FILES_MAX_UPLOAD_SIZE` (`413`), nhiều file, lỗi khi không có file hoặc file không tên. Nhiều file mà file thứ n bị
  `413` hoặc bị chặn mime: response là lỗi đó, các file trước đã lưu vẫn còn (dòng và object), chỉ file lỗi được dọn, như
  Directus; stream của file bị chặn mime không được đọc hết (có treo hay không: đo ở task, cả hai app).
- **FR-011**: `uploadOne` PHẢI làm như Directus: location mặc định là location đầu của `STORAGE_LOCATIONS`; folder mặc
  định `storage_default_folder`; tạo dòng trước; `filename_disk = <id><đuôi>` với đuôi = `extname(filename_download)`,
  không có thì `'.' + mime.extension(type)`, không có `type` thì rỗng (mime không ánh xạ được đuôi cho ra `<id>.false`
  theo cách viết của Directus: tái tạo, đo T020 trên Directus 11.17.4); ghi object; `filesize` theo storage; trích metadata; `uploaded_on`;
  dọn khi lỗi (`cleanUp` chỉ dọn file hiện tại; dọn thất bại vì thiếu quyền xóa chỉ ghi log).
- **FR-012**: Thay file (`PATCH /files/:id` multipart, import có `id`, TUS với `replace_id`) PHẢI xóa mọi object theo
  tiền tố id (file gốc cũ và file phát sinh) rồi đưa file mới vào `filename_disk`, theo đúng thứ tự bước của Directus
  cho từng đường (multipart, import: ghi tên tạm → sửa dòng → xóa theo tiền tố → chuyển tên tạm; TUS: data-model §8).
- **FR-013**: `POST /files` JSON PHẢI yêu cầu `type`, chuẩn hóa `filename_disk` chống path traversal (`relative(sep,
  resolve(sep, p))`: `../x` thành `x`, `a/b.jpg` giữ nguyên thư mục con) và báo trùng như `FilesService.createOne`:
  `403 FORBIDDEN` (message chung), ném sau kiểm quyền và filter hook trong cùng lời gọi (`preMutationError`, Directus gọi
  là "deferred" để không lộ tên đã tồn tại), không insert; không có unique constraint trong DB nên hai request đồng thời
  cùng tên có thể cùng qua, như Directus.
- **FR-014**: Xóa file (một, nhiều, theo `keys`, theo `query`) PHẢI xóa dòng rồi xóa mọi object theo tiền tố
  `parse(filename_disk).name` (chỉ tên, không thư mục, không đuôi) như `deleteMany` (R-13). Tiền tố mỗi đường khác nhau
  như Directus: xóa dùng tên không thư mục; thay file (multipart, import) dùng khóa chính `id`; TUS thay file dùng khóa
  chính của file đích; đổi `filename_disk` dùng `thư mục/tên`.
- **FR-015**: Khi `TUS_ENABLED`, mọi đường đọc qua `FilesService.readByQuery` PHẢI ẩn file đang tải dở (`tus_id` khác
  `null`): `GET /files`, `GET /files/:pk` (`403`), `GET /assets/:pk` (`AssetsService` đọc bằng `FilesService` sudo nên
  `403`, không stream object dở); file đích của thay file bằng TUS vẫn trả object cũ tới khi `move`; `deleteMany` cũng
  không thấy dòng dở nên xóa dòng mà không xóa object (tái tạo, đo ở task). Đọc lồng qua `/items` không qua
  `FilesService.readByQuery` nên không ẩn, như Directus.
- **FR-016**: Đổi `filename_disk` PHẢI làm như `updateMany`: sửa dòng trước (transaction riêng mỗi key), rồi liệt kê
  object theo tiền tố `thư mục/tên` cũ; đích chưa có → `move` object gốc; đích đã có → dòng trỏ sang object đích (chỉ
  đổi DB), object gốc giữ lại trừ khi `FILES_DELETE_ORIGINAL_ON_MOVE=true`; mọi object khác cùng tiền tố (file phát sinh
  ở gốc khi file không thư mục) bị xóa; đổi cho nhiều file một lúc trả `400`. Thao tác storage không rollback khi
  transaction lỗi, như Directus.
- **FR-017**: `directus_files`, `directus_folders` PHẢI dùng dịch vụ riêng ở mọi đường ghi (route riêng, ghi lồng qua
  `/items`, quan hệ từ collection khác như `directus_users.avatar`), tức là gỡ hai collection này khỏi danh sách đi qua
  `ItemsService` chung (thu hẹp D-31).

**Metadata ảnh**

- **FR-020**: Với ảnh jpeg, png, webp, gif, tiff, avif, app mới PHẢI trích `width`, `height` (đổi chỗ khi orientation ≥
  5), EXIF (`ifd0`, `ifd1`, `exif`, `gps`, `interop`), ICC, IPTC, XMP; IPTC `caption`, `headline`, `keywords` thành
  `description`, `title`, `tags` khi chưa có; `metadata` lọc theo `FILE_METADATA_ALLOW_LIST`; giá trị JSON ghi vào DB
  giống Directus.
- **FR-021**: Thư mục PHẢI dùng CRUD chuẩn như `FoldersService`; xóa thư mục để khóa ngoại hệ thống đặt `folder`,
  `storage_default_folder` về `null`; xóa thư mục còn thư mục con gặp lỗi khóa ngoại (`parent` không `on_delete`) không
  được dịch: `500 INTERNAL_SERVER_ERROR` như Directus (đo T028 trên Postgres: `500`, message là câu lỗi khóa ngoại
  của DB ở cả hai app; vendor khác đo ở nightly); `buildTree` cho zip kiểm quyền
  đọc thư mục gốc với user không phải admin và khử trùng tên như Directus.

**Asset**

- **FR-030**: `GET /assets/:pk/:filename?` PHẢI kiểm query như Directus: chỉ nhận `ASSET_TRANSFORM_QUERY_KEYS`;
  `transforms` là mảng JSON tối đa `ASSETS_TRANSFORM_MAX_OPERATIONS` bước, method trong `TransformationMethods`; chế độ
  `storage_asset_transform` `all`, `presets`, `none` với `storage_asset_presets` và preset `system-*`; cùng lỗi `400`.
  Chi tiết như Directus: chế độ `all` cho `key` kèm tham số khác, gộp nông `{...preset, ...query}` (query đè preset,
  `transforms` của query thay toàn bộ `transforms` của preset); `transforms=[]` (mảng rỗng) đi qua trước mọi kiểm chế
  độ nên tham số khác vẫn được áp ở `presets`, `none` (R-16); `withoutEnlargement` là chuỗi, mọi giá trị không rỗng kể
  cả `false` đều là bật và cho cùng tên file phát sinh; `download` chỉ kiểm có mặt (`?download=false` vẫn tải về).
- **FR-031**: Header của asset PHẢI giống Directus: `Content-Type`, `Content-Disposition` (`inline` hoặc `attachment`
  khi có `download`, tên từ `:filename`, `filename_download` hoặc id), `Accept-Ranges`, `Cache-Control` theo
  `ASSETS_CACHE_TTL` và `ASSETS_CACHE_REVALIDATE`, `Last-Modified`, `ETag`, `Vary`, `Content-Security-Policy` theo
  `ASSETS_CONTENT_SECURITY_POLICY_*`.
- **FR-032**: `Range` PHẢI được xử lý như Directus (`206`, suffix range, `416`), chỉ khi không có transform; `HEAD` trả
  header không body, nhưng vẫn chạy `getAsset` nên có sinh và ghi file phát sinh; `HEAD` không đi qua response cache.
- **FR-033**: `ASSETS_CACHE_REVALIDATE=true` PHẢI cho `304` với `If-None-Match`, `If-Modified-Since` như Directus.
- **FR-034**: Transform PHẢI dựng chuỗi bước như `resolvePreset` (`toFormat`, `resize`, `extract` theo focal point,
  `withoutEnlargement`), chọn định dạng như `getFormat` (`auto` theo `Accept`: avif, rồi webp; nguồn avif, webp, tiff
  thành png khi không chỉ định), chỉ áp cho jpeg, png, webp, tiff, avif; file loại khác trả nguyên bản. Focal point:
  giá trị trong query hoặc preset thắng khi khác rỗng và khác `0` (`0` là falsy nên rơi về giá trị trên file), X và Y
  xét riêng; chỉ cắt theo focal khi `fit` là `cover` hoặc vắng, có đủ `width`, `height` và cả hai tọa độ khác `null`.
- **FR-035**: Tên file phát sinh PHẢI là `basename(filename_disk không đuôi) + "__" + objectHash(chuỗi bước) + đuôi`
  (đuôi theo `toFormat` cuối cùng, không có thì đuôi gốc), ghi ở gốc của location (không thư mục con dù `filename_disk`
  có thư mục), giống từng ký tự với tên Directus đặt cho cùng file và cùng tham số, để hai app dùng chung file đã sinh.
  Đầu vào hash là mảng bước đã dựng theo thứ tự của `resolvePreset`: `transforms` của query hoặc preset, rồi
  `['toFormat', format, {quality}]`, rồi `['resize', {...}]` và `['extract', region]` (region tính từ `width`, `height`
  trên dòng file và focal point), nên phụ thuộc `Accept` khi `format=auto`, kích thước và focal point đã lưu; không gồm
  bước `rotate` mặc định và `modified_on`. Đổi focal point tạo tên mới, file phát sinh cũ không bị dọn, như Directus.
- **FR-036**: Khi file phát sinh đã có, app mới PHẢI đọc nó, không sinh lại; khi chưa có, PHẢI sinh, ghi rồi trả, với nội
  dung trùng từng byte với ảnh Directus sinh cho cùng tham số (Assumptions).
- **FR-037**: Giới hạn PHẢI như Directus: `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` (giới hạn pixel đầu vào và kích thước
  ảnh), `ASSETS_TRANSFORM_MAX_CONCURRENT` (`503` "Server too busy"), `ASSETS_TRANSFORM_TIMEOUT` (`503`, xóa object dở),
  `ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL`; tự xoay theo EXIF trừ khi có bước `rotate`; lỗi tham số thư viện ảnh `400`.
  Kiểm kích thước dùng `width`, `height` trên dòng file (thiếu hoặc vượt → `400 ILLEGAL_ASSET_TRANSFORMATION`); ảnh có
  số pixel thật vượt `limitInputPixels` dù dòng ghi nhỏ hơn (metadata sai) gây lỗi thư viện ảnh không ánh xạ → `500`,
  như Directus (đo ở task). Lỗi giữa pipeline xóa object dở; message có `timeout` → `503`.
- **FR-038**: Giới hạn đồng thời transform PHẢI tính theo từng process như Directus (không chia sẻ giữa instance): trong
  cụm N instance, tổng số transform đồng thời có thể tới N × `ASSETS_TRANSFORM_MAX_CONCURRENT`; ca `503` "busy" đo trên
  một instance.
- **FR-039**: Khi format đổi, `Content-Type` PHẢI theo đuôi file phát sinh như Directus.
- **FR-040**: Đọc từ storage PHẢI truyền `version` theo `modified_on` như Directus.
- **FR-041**: `POST /assets/folder/:pk` và `POST /assets/files` PHẢI trả zip cùng danh sách đường dẫn, cùng nội dung
  file, cùng header (`application/zip`, tên `folder-<tên>-<thời điểm>.zip`, `files-<thời điểm>.zip`), cùng kiểm body
  (`ids` là mảng uuid, ít nhất một) và cùng kiểm quyền như `zipFolder`, `buildTree` của Directus; lỗi stream trả `500` JSON. Byte của file zip không cần trùng
  (thời điểm nén nằm trong zip). Tên file: `folder-<name hoặc unknown>-<YYYYMMDD-HMS>.zip` qua `contentDisposition()`,
  `files-<YYYYMMDD-HMS>.zip` ghi thẳng header; thời điểm theo giờ địa phương của server, tháng ngày có số 0 đứng đầu,
  giờ phút giây không (`-953` cho 09:05:03); bộ đối chiếu chuẩn hóa phần thời điểm. Khử trùng tên: thư mục theo từng cha,
  file theo từng thư mục, riêng nhau (file và thư mục con cùng tên không khử), hậu tố ` (n)` đặt sau đuôi
  (`photo.jpg (1)`); `POST /assets/files` đặt mọi entry ở gốc nhưng vẫn khử theo thư mục nên file cùng tên ở hai thư mục
  tạo entry trùng; object mất giữa chừng → zip bị cắt, như Directus.

**TUS**

- **FR-050**: Khi `TUS_ENABLED=true`, app mới PHẢI mount `/files/tus` trước `/files` với cùng hành vi giao thức như
  @tus/server 2.3.0 mà Directus dùng (`creation`, `termination`, `expiration`; `POST`, `PATCH`, `HEAD`, `DELETE`,
  `OPTIONS`), `maxSize` theo `FILES_MAX_UPLOAD_SIZE`, `Location` theo `PUBLIC_URL`, header CORS, `Directus-File-Id`.
  `OPTIONS`: khi `CORS_ENABLED=true` middleware CORS trả `204` cho mọi `OPTIONS` trước khi tới TUS (không header
  `Tus-*`); khi tắt CORS, `OPTIONS /files/tus/:id` đi qua `checkFileAccess` (`read`) rồi TUS trả `Tus-Version`,
  `Tus-Extension: creation,termination,expiration`, `Tus-Max-Size` khi có (đo T018: `204`, cùng các header
  `access-control-*` của @tus/server; không quyền đọc → `403`), còn `OPTIONS /files/tus` không có handler TUS nên là
  `OPTIONS` tự động của Express (`Allow: POST`). Lỗi giao thức: `Upload-Length` quá `maxSize` → `413` (đo T018), thiếu `Upload-Length` hoặc `filename_download`, thay file
  đang có upload dở, `Upload-Metadata` không parse được → `400 INVALID_METADATA`, driver tạo lỗi → dọn dòng rồi `500`.
- **FR-051**: Kiểm quyền TUS PHẢI như `checkFileAccess` (method → action, `Upload-Metadata`, `id` thay file, field trong
  metadata); upload chỉ tìm thấy với chính user tạo (`uploaded_by`) khi accountability có `user`; không có `user` (role
  public) thì không lọc theo người tạo; admin không có ngoại lệ (chỉ thấy upload của chính mình), như Directus.
- **FR-052**: Lưu dở PHẢI dùng cùng cột `tus_id`, `tus_data` và cùng cách ghi chunk theo driver như Directus (local: ghi
  vào file theo offset; S3: multipart upload với part tối thiểu 5 MiB, `TUS_CHUNK_SIZE`), để một upload bắt đầu ở app
  này tiếp tục được ở app kia. Offset trả cho `HEAD` lấy từ `tus_data.offset` trong DB (không hỏi storage). S3: phần dư
  của một `PATCH` nhỏ hơn kích thước part và không phải part cuối bị bỏ (không ghi part dở lên S3), offset trả về không
  gồm phần dư nên client gửi lại; số part được đánh theo `ListParts`; hoàn tất đòi đúng `ceil(size / chunkSize)` part,
  thiếu hoặc thừa → `500` (R-18). Ca xen kẽ hai app gửi mỗi `PATCH` đúng `TUS_CHUNK_SIZE` byte trừ chunk cuối.
- **FR-053**: Khóa TUS PHẢI dùng cùng khóa và namespace Redis như Directus khi có Redis (Nguyên tắc VII), để hai app và
  mọi instance không ghi chồng một upload.
- **FR-054**: Dọn upload hết hạn PHẢI chạy theo `TUS_CLEANUP_SCHEDULE` qua lịch đồng bộ cùng tên job `tus-cleanup` và
  cùng key clock với Directus (`SYNCHRONIZATION_STORE`, `SYNCHRONIZATION_NAMESPACE`): khi `SYNCHRONIZATION_STORE=redis`
  trong cụm hai app chỉ một instance chạy mỗi lượt; mặc định `memory` mỗi instance tự chạy như Directus (dọn là
  idempotent).

**Import từ URL**

- **FR-060**: `POST /files/import` PHẢI kiểm body như Directus, kiểm quyền tạo, tải bằng URL đã encode, tự giải nén
  gzip, deflate, br (encoding khác, kể cả `gzip, br` hay `zstd`, lưu nguyên dạng nén), lấy tên theo URL cuối sau chuyển
  hướng (`basename(pathname)`: đường dẫn `/` hoặc rỗng cho tên rỗng, `title` rỗng, đuôi lấy theo mime; `%` hỏng làm
  `decodeURI` ném ngoài `try` → `500`, đo ở task), `type` theo `Content-Type` trước `;` hoặc `application/octet-stream`,
  kiểm mime theo `FILES_MIME_TYPE_ALLOW_LIST` trước rồi `filterMimeType` (mỗi danh sách khớp một mẫu minimatch là đủ,
  chỉ so header, không đọc nội dung; `data.type` đè `type` sau khi kiểm), rồi lưu như upload (FR-011). Quyền: kiểm
  `create` mức collection trước khi tải; field trong `data` kiểm ở `createOne`; thay file (`data.id`) kiểm `update` sau
  khi đã tải xong về tên tạm. Lỗi tải (`ftp:`, `file:`, URL hỏng, không nối được) trả `503 SERVICE_UNAVAILABLE`
  (`external-file`); URL `data:` không có `request` nên lỗi ngoài `try` → `500` (đo ở task); theo chuyển hướng tối đa 21
  lần (mặc định của follow-redirects, axios không đặt), mỗi hop dùng lại agent kiểm IP. Không giới hạn kích thước và
  thời gian tải, kể cả sau giải nén (R-14).
- **FR-061**: Mọi kết nối của import PHẢI bị kiểm IP theo `IMPORT_IP_DENY_LIST` như `agentWithIpValidation` (IP literal
  trước khi nối, tên miền sau khi phân giải, mỗi lần chuyển hướng; dải, CIDR, địa chỉ đơn). `0.0.0.0` thêm interface
  loopback dưới dạng subnet (gồm `::1/128`) và địa chỉ của interface khác dưới dạng địa chỉ đơn (IPv4 và IPv6), không
  thêm `0.0.0.0` hay `::` và không chặn subnet xung quanh; IPv6 nhận dạng bằng `isIPv6`, IPv4-mapped (`::ffff:127.0.0.1`,
  `::ffff:7f00:1`) khớp mục IPv4 (test của Directus khẳng định; NAT64, 6to4 không có test). Một mục cấu hình không parse
  được → chặn mọi request; danh sách rỗng (`IMPORT_IP_DENY_LIST=`) → không chặn gì, kể cả `169.254.169.254`; danh sách và
  interface được dựng lại ở mỗi lần kiểm. Như Directus.

**Storage và cấu hình**

- **FR-070**: Storage PHẢI đọc `STORAGE_LOCATIONS` và `STORAGE_<LOC>_*` như Directus (camelCase theo
  `getConfigFromEnv`), gồm mọi tùy chọn của driver `local` (`ROOT`) và `s3` (`KEY`, `SECRET`, `BUCKET`, `REGION`,
  `ENDPOINT`, `FORCE_PATH_STYLE`, `ACL`, `SERVER_SIDE_ENCRYPTION`, `SERVER_SIDE_ENCRYPTION_KMS_KEY_ID`, `ROOT`,
  `CONNECTION_TIMEOUT`, `SOCKET_TIMEOUT`, `MAX_SOCKETS`, `KEEP_ALIVE`, `HEALTHCHECK_THRESHOLD`), với cùng đường dẫn
  object như Directus trên cùng cấu hình.
- **FR-071**: Driver `gcs`, `azure`, `cloudinary`, `supabase` ở bất kỳ location nào PHẢI làm app dừng khi khởi động, báo
  tên location, driver và driver được hỗ trợ (D-16, đã có từ 001, kiểm lại trong feature này).
- **FR-072**: Các biến `FILES_MIME_TYPE_ALLOW_LIST`, `FILES_MAX_UPLOAD_SIZE`, `FILES_DELETE_ORIGINAL_ON_MOVE`,
  `FILES_MAX_UPLOAD_CONCURRENCY`, `FILE_METADATA_ALLOW_LIST`, `ASSETS_*`, `TUS_*`, `IMPORT_IP_DENY_LIST` và tùy chọn
  storage ở FR-070 PHẢI chuyển sang nhóm biến được hỗ trợ (không còn trong cảnh báo khởi động). `IMPORT_TIMEOUT`,
  `IMPORT_MAX_CONCURRENCY` (import item, 010) và tùy chọn của driver ngoài phạm vi giữ nguyên nhóm.
  `FILES_MAX_UPLOAD_CONCURRENCY` chỉ có tác dụng ở `uploads.maxConcurrency` của `/server/info` (đã có từ 001; app
  Directus tự giới hạn phía client), server không giới hạn số upload đồng thời, như Directus.
- **FR-073**: `/server/health` (`storage:<loc>:responseTime`) và `/server/info` (`uploads`) PHẢI giữ hành vi như
  Directus với mọi location đã cấu hình (đã có từ 001, kiểm lại với nhiều location).

**Kiểm thử**

- **FR-080**: Bộ đối chiếu PHẢI so status, body, header, dòng `directus_files`, `directus_folders` và object trên storage
  của hai app, trên storage `local` và S3 (MinIO), cho mọi route ở FR-001, kể cả lỗi. Tập so: dòng DB bỏ `id`,
  `created_on`, `modified_on`, `uploaded_on`, `tus_id`, `tus_data` khi đã xong (các cột còn lại kể cả `uploaded_by`,
  `modified_by` so nguyên vì cùng admin); object so key, kích thước, sha256 nội dung, `Content-Type` trên S3, không so
  thời gian; header `ETag`, `Last-Modified` so sau khi quy về `modified_on` của dòng tương ứng ở mỗi app (chỉ so bằng
  tuyệt đối trong ca dùng chéo một dòng); ca so `Cache-Control` của asset gửi request không kèm `Cache-Control:
  no-store` (quy tắc mặc định của bộ đối chiếu từ 005 làm header thành `no-store`).
- **FR-081**: Bộ blackbox và E2E ở đầu spec PHẢI được port và đạt ở cả hai app: Postgres đủ bộ trên cả `local` và MinIO
  mỗi lần push; MySQL, SQLite bộ rút gọn chỉ trên MinIO mỗi lần push và đủ bộ trên cả hai storage ở workflow riêng;
  vendor còn lại trên cả hai storage ở `nightly.yml`, như tiền lệ 004 đến 006 (Clarifications).
- **FR-082**: PHẢI có kiểm tra chéo: tải lên ở app này, xem, tải, transform, thay, xóa ở app kia, cả hai chiều, trên cả
  hai driver; transform với bộ ảnh mẫu và ma trận tham số (mọi `fit`, `format` gồm `auto`, `quality`,
  `withoutEnlargement`, focal point, `transforms` nhiều bước, preset) so tên object phát sinh và byte ảnh. Bộ ảnh mẫu
  (mỗi ảnh ≤ 200 KB): jpeg RGB, jpeg CMYK, jpeg có EXIF orientation ≥ 5, png 8-bit, png 16-bit, png có alpha, webp,
  tiff, avif, gif tĩnh, gif động, ảnh có kích thước vượt `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` của profile giới hạn,
  ảnh hỏng (cắt cụt) cho `ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL`, cùng fixture ảnh kết quả của
  `directus/tests/e2e/tests/endpoints/assets/` làm mốc byte (Clarifications).
- **FR-083**: PHẢI có Playwright E2E app Directus qua reverse proxy cho module Files (tải lên, import URL, xem trước, sửa
  metadata, chuyển thư mục, xóa, tải zip) và thumbnail trên màn hình Content, với `/files`, `/folders`, `/assets` đi tới
  app mới.
- **FR-084**: PHẢI có benchmark ở hai app: `GET /assets/:id` file gốc, `GET /assets/:id` với transform đã sinh sẵn,
  `GET /assets/:id` sinh transform mới (tập tham số cố định, xóa file phát sinh trước mỗi vòng, mức đồng thời dưới
  `ASSETS_TRANSFORM_MAX_CONCURRENT` để không đo `503`), `GET /files` (admin và user có quyền một phần), `POST /files`
  multipart file nhỏ; chạy ở workflow benchmark hằng tuần, không chặn CI, như tiền lệ 006 (Clarifications).

### Key Entities

- **File**: một dòng `directus_files` cùng object gốc trên một storage location; thuộc tính tên trên storage, tên tải về,
  mime, kích thước, kích thước ảnh, metadata, tiêu đề, mô tả, tags, folder, focal point, người và thời điểm tải lên, trạng
  thái TUS.
- **Folder**: một dòng `directus_folders` (tên, thư mục cha); file và thư mục mặc định trỏ tới.
- **Storage location**: một vị trí lưu đặt tên trong `STORAGE_LOCATIONS`, driver `local` hoặc `s3`, dùng chung giữa hai
  app.
- **File phát sinh** (thuật ngữ duy nhất trong spec cho "derived asset", "transformed asset" của Directus): ảnh đã
  transform, lưu cạnh file gốc với tên theo FR-035, dùng chung giữa hai app.
- **Asset preset**: transform đặt tên trong `directus_settings.storage_asset_presets` hoặc preset `system-*`; chế độ
  `storage_asset_transform`.
- **Upload TUS**: một upload dở, gắn với dòng `directus_files` qua `tus_id`, `tus_data` và phần dữ liệu đã ghi trên
  storage.

## Khác biệt so với Directus *(mandatory)*

Thay đổi với bảng khác biệt của các feature trước:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-09.5 | Gỡ: `/files` (gồm `/files/tus`), `/folders`, `/assets` làm ở feature này | FR-001 đến FR-061 |
| D-31 | Thu hẹp: bỏ `directus_files`, `directus_folders` khỏi danh sách collection hệ thống đi qua `ItemsService` chung | FR-017 |

Giữ nguyên: D-16 (driver `gcs`, `azure`, `cloudinary`, `supabase` dừng khi khởi động, FR-071). Sửa bảng của spec cũ đi
cùng feature này: dòng D-09.5 trong spec 001, dòng D-31 trong spec 004; entry tương ứng trong
`tests/parity/accepted-differences.ts`; `tests/parity/proxy/backoffice-routes.txt` thêm `files`, `folders`, `assets`.
Mọi dòng cần tech lead duyệt khi đóng feature (Nguyên tắc X).

Khác biệt mới: Không có.

**Rủi ro chấp nhận (tái tạo từ Directus)**: như quy tắc của 004 đến 006. Bằng chứng tối thiểu cho mỗi R-xx trước khi
đóng feature (tiền lệ R-11, R-12): tên ca test đối chiếu tái tạo, request gửi, kết quả đo trên Directus 11.17.4 thật
(status, dòng DB hoặc object trên storage) và ngày đo, ghi vào cột "Bằng chứng"; cần tech lead duyệt khi đóng feature.

| Mã | Hành vi của Directus | Bằng chứng | Hệ quả |
|----|----------------------|------------|--------|
| R-13 | Xóa, thay file, đổi tên xóa object theo tiền tố với tiền tố khác nhau mỗi đường (xóa: tên không thư mục không đuôi; thay file: khóa chính; đổi tên: `thư mục/tên`); driver local so không phân biệt hoa thường và đệ quy | `services/files.ts:483-486` (`deleteMany`), `:207` (`uploadOne`), `:419-426` (`updateMany`); `storage-driver-local/src/index.ts:98-113` | Với `filename_disk` mặc định (uuid) không ảnh hưởng; đặt tay tên ngắn xóa cả object khác (`photo.jpg` xóa `photography.png`); tên có thư mục con để lại object gốc mồ côi và file phát sinh cũ. Tái tạo (FR-012, FR-014, FR-016); đo ở `files.test.ts` |
| R-14 | Import từ URL không đặt timeout và không giới hạn kích thước (kiểm `truncated` chỉ có với busboy; axios `maxContentLength: -1`, `timeout: 0`, stream bỏ qua kiểm) | `services/files.ts:183`, `request/index.ts:17`; axios `defaults` | URL trả chậm hoặc file rất lớn giữ request và ghi storage tới khi phía kia đóng; giải nén cũng không giới hạn. Tái tạo (FR-060); đo ở `import.test.ts` (ca file lớn vừa phải, không đo treo) |
| R-15 | Thay file (multipart, import) sửa dòng (`filename_disk`, `type`) trong transaction riêng trước khi xóa object cũ theo tiền tố và chuyển tên tạm; lỗi sau đó chỉ xóa file tạm, không rollback dòng | `services/files.ts:204-216` | Lỗi storage giữa chừng để lại dòng trỏ tới object không tồn tại và nội dung cũ đã mất; khoảng giữa các bước app kia trả `403` hoặc file cũ. Tái tạo (FR-012); đo ở `files.test.ts` bằng ca thay file khác đuôi và so trạng thái |
| R-16 | `GET /assets` với `transforms=[]` (mảng rỗng) đi qua trước mọi kiểm `storage_asset_transform`, nên tham số tự do vẫn được áp ở chế độ `presets`, `none` và `key` lạ không bị chặn ở `all` | `controllers/assets.ts:230-235` | Giới hạn transform của settings bị vượt bằng một tham số thêm. Tái tạo (FR-030); đo ở `assets.test.ts` |
| R-17 | Sinh file phát sinh không khóa: kiểm `exists` rồi ghi thẳng vào tên đích (driver local không ghi tạm); sinh lỗi xóa object đích | `services/assets.ts:311, 379, 382`; `storage-driver-local/src/index.ts:81-86` | Trên `local` request đồng thời có thể stream file dở với `Content-Length` sai hoặc bị xóa khi đang đọc; trên S3 hai app cùng sinh, bản sau thắng. Tái tạo (FR-036); đo ở `transform-matrix.test.ts` (ca song song, chấp nhận kết quả không xác định, chỉ so trạng thái cuối) |
| R-18 | TUS trên S3: phần dư của `PATCH` nhỏ hơn part bị bỏ (không ghi part dở), offset trả về không gồm phần dư; hoàn tất đòi đúng `ceil(size / chunkSize)` part | `storage-driver-s3/src/index.ts:448-488, 366-393, 411-413` | Client gửi chunk không bằng `TUS_CHUNK_SIZE` phải gửi lại phần dư; chunk cuối lớn hơn 5 MiB nhưng nhỏ hơn `chunkSize` có thể làm số part lệch và hoàn tất `500` (suy luận, đo ở `tus.test.ts`). Tái tạo (FR-052) |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. Header `Directus-File-Id` của TUS, tên file `directus-health-file`, tên job `tus-cleanup`, event
  `files.upload`, preset `system-*`, namespace khóa `directus:lock` giữ nguyên vì là tên kỹ thuật dùng chung với app
  Directus và Directus (Nguyên tắc IX).

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4. Khi spec không nói rõ, làm như code Directus. Quy ước message lỗi và quy tắc so
  của bộ đối chiếu như Assumptions của 004 đến 006.
- "Ảnh giống nhau" (tiêu chí chấp nhận) nghĩa là trùng từng byte (Clarifications). App mới dùng cùng phiên bản thư viện xử lý ảnh
  (sharp 0.34.5 với libvips đi kèm) và object-hash 3.0.0 như Directus, chạy cùng kiến trúc trong CI (linux/amd64). Nếu
  đo thấy byte khác do bản build thư viện ảnh giữa hai image, ghi bằng chứng và đưa ra tech lead quyết định (so điểm ảnh
  hoặc ghi khác biệt) trước khi đóng feature.
- Tiền đề dùng chung `.env` (Nguyên tắc VIII): hai app cùng `STORAGE_*` (nên cùng location đầu, nơi ghi mặc định và
  nơi ghi TUS), cùng `PUBLIC_URL` (header `Location` của TUS), cùng `TUS_*`, `FILES_*`, `ASSETS_*`. Nếu khác (ví dụ
  `TUS_ENABLED` chỉ bật ở một app thì app kia lộ file dở ở `GET /files`) là ngoài phạm vi, không kiểm. Nguyên tắc VII:
  driver `local` khi chạy nhiều instance phải là volume dùng chung.
- Không chứa file dở dang hay file phát sinh trong bộ nhớ hoặc đĩa riêng của instance ngoài thư mục tạm của hệ điều hành
  khi chia part S3 (như Directus).
- Mặc định của Directus giữ nguyên: `STORAGE_LOCATIONS=local`, `STORAGE_LOCAL_ROOT=./uploads` (image Docker của app mới
  có cùng thư mục làm việc như image Directus), `TUS_ENABLED=false`, `ASSETS_CACHE_TTL=30d`,
  `ASSETS_TRANSFORM_MAX_CONCURRENT=25`, `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION=6000`, `ASSETS_TRANSFORM_MAX_OPERATIONS=5`,
  `ASSETS_TRANSFORM_TIMEOUT=7500ms`, `IMPORT_IP_DENY_LIST=0.0.0.0,169.254.169.254`, `FILES_MAX_UPLOAD_SIZE` không giới
  hạn.
- Directus không trích `duration`, `charset` và không có event `files.import`; app mới cũng không.
- TUS qua nhiều replica của riêng app mới thuộc feature 019; feature này chỉ yêu cầu dùng cùng khóa và dữ liệu dở như
  Directus (FR-052, FR-053) và kiểm xen kẽ giữa hai app.
- Môi trường đối chiếu đã có MinIO (bucket `directus`); thêm location `local` trên volume dùng chung giữa hai app và một
  server HTTP phục vụ file mẫu cho import.
- Ca của bộ blackbox, E2E fail trên chính Directus ở một vendor hoặc storage được bỏ qua kèm ghi chú tên ca, như 005,
  006.
- Route AI liên quan file của Directus thuộc D-17 (ngoài phạm vi), không thuộc feature này.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% ca của bộ blackbox và E2E port (US7) đạt ở cả hai app trên Postgres, MySQL, SQLite và cả hai storage
  trước khi đóng feature; vendor còn lại đạt ở một lượt `nightly.yml` bấm tay hoặc được ghi chú theo Assumptions.
- **SC-002**: 100% request của bộ đối chiếu `/files`, `/folders`, `/assets`, `/files/import` (kể cả lỗi, `OPTIONS`,
  `HEAD`) cho cùng status, body, header ở hai app, ngoài khác biệt đã ghi.
- **SC-003**: 100% file tải lên ở một app (multipart, JSON, TUS, import, trên `local` và S3) xem và tải được ở app kia với
  nội dung trùng từng byte, cả hai chiều.
- **SC-004**: Với bộ ảnh mẫu và ma trận tham số transform (FR-082), 100% URL asset trả ảnh trùng từng byte ở hai app và
  100% tên object phát sinh trùng nhau.
- **SC-005**: Khi file phát sinh đã có do app này sinh, 100% request cùng URL ở app kia không ghi object mới lên storage.
- **SC-006**: Với mỗi driver ngoài phạm vi, app mới thoát mã khác 0 trước khi nhận request đầu tiên và log nêu đúng
  location trong 100% lần thử; với `local`, `s3`, upload vào từng location thành công.
- **SC-007**: Ở mỗi kịch bản benchmark (FR-084), p95 latency và throughput của app mới không tệ hơn Directus quá 10%
  (Nguyên tắc X).
