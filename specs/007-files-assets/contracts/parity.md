# Contract: bộ đối chiếu, blackbox, môi trường, CI, E2E, benchmark (007)

Mẫu theo contracts/parity.md của 006. Mọi test mới chạy với cả hai app trên cùng DB và cùng storage (Nguyên tắc V).

## 1. Môi trường đối chiếu

| Thay đổi | Nội dung |
|----------|----------|
| `tests/parity/env/<vendor>.env` (9 file) | `STORAGE_LOCATIONS=local,s3`, `STORAGE_LOCAL_DRIVER=local`, `STORAGE_LOCAL_ROOT=./uploads`; giữ `STORAGE_S3_*` |
| `docker-compose.yml` anchor `x-app` | volume `uploads:/directus/uploads` (named volume, dùng chung mọi container Directus và app mới của vendor; container Backoffice mount ở `/backoffice/uploads` từ D-174 của 019 vì `STORAGE_LOCAL_ROOT=./uploads`); `env-up` chmod `/directus/uploads` 777 trong container như tiền lệ `data.db` |
| service `files-fixtures` | `nginx:alpine` phục vụ `tests/parity/fixtures/files/` (ảnh jpeg, png, webp, tiff, avif, gif, EXIF xoay, pdf, svg, `.gz`); URL `http://files-fixtures/<tên>` |
| profile `assets-limit` (10055, 10056) | `ASSETS_TRANSFORM_MAX_CONCURRENT=2`, `ASSETS_CACHE_REVALIDATE=true`, `TUS_ENABLED=true`, `SYNCHRONIZATION_STORE=redis`, `CORS_ENABLED=false`, `FILES_MIME_TYPE_ALLOW_LIST=image/*,application/pdf`, `FILES_MAX_UPLOAD_SIZE=30mb`; blackbox assets, tus và ca revalidate, mime, `413`, TUS thường |
| profile `assets-stress` (10155, 10156) | `ASSETS_TRANSFORM_MAX_CONCURRENT=1`, `ASSETS_TRANSFORM_TIMEOUT=100ms`, `TUS_ENABLED=true`, `TUS_UPLOAD_EXPIRATION=2s`, `TUS_CLEANUP_SCHEDULE=* * * * *`, `SYNCHRONIZATION_STORE=redis`, `CORS_ENABLED=false`; chỉ ca busy, timeout, hết hạn |
| profile `cors-hsts` (sửa) | thêm `TUS_ENABLED=true` để đo `OPTIONS /files/tus*` khi CORS bật |
| profile `blackbox` (sửa) | thêm `ASSETS_TRANSFORM_MAX_CONCURRENT=2`, `TUS_ENABLED=true` như `directus/tests/blackbox/common/config.ts`; hai cặp `assets-*` đọc thêm file này |
| `tests/parity/fixtures/assets/` | fixture của `directus/tests/e2e/tests/endpoints/assets/` (ảnh vào, ảnh kết quả) |

## 2. Thư mục `tests/parity/src/files/`

| File | Suite | Nội dung |
|------|-------|----------|
| `storage-capture.ts` | — | `listObjects(location, prefix)`: `local` đọc qua `docker exec`/volume, `s3` qua `@backoffice/storage-driver-s3` `list`; `readObject`; `deleteDerived(prefix)`; `fileRows(ids)` bỏ `id`, ngày giờ, `uploaded_by`; `folderRows` |
| `files.test.ts` | `reduced`, `full` | US1, US3: multipart (field trước/sau file, nhiều file, ép kiểu), JSON, `PATCH` thay file (đuôi đổi, file phát sinh bị xóa), đổi `filename_disk` (đích chưa có, đã có, `FILES_DELETE_ORIGINAL_ON_MOVE`), xóa một/nhiều/`keys`/`query` (R-13 đo), quyền một phần, `OPTIONS`, `HEAD`, `SEARCH`, lỗi `400`, `413` |
| `folders.test.ts` | `reduced`, `full` | CRUD, xóa folder có file (FK `SET NULL`), có folder con (lỗi DB) |
| `import.test.ts` | `full` | US5: fixtures (nén, chuyển hướng), `filterMimeType`, IP bị chặn (`127.0.0.1`, `169.254.169.254`, tên miền trỏ nội bộ), R-14 ghi nhận (không đo treo) |
| `assets.test.ts` | `reduced`, `full` | US2 phần HTTP: query, chế độ `storage_asset_transform`, preset, `format=auto`, header, `Range`, `416`, `HEAD`, `download`, `:filename`, file công khai, `403`; profile `assets-limit`: `503` busy, timeout, `304` |
| `transform-matrix.test.ts` | `full` | FR-082: ca đầu so với fixture e2e (R2); bộ ảnh × (`fit` 4 × `format` 6 gồm `auto` × `quality` × `withoutEnlargement` × focal point × `transforms` nhiều bước × preset): sinh ở A, chụp tên object + byte, xóa derived, sinh ở B, so; rồi gọi B khi A đã sinh, kiểm không object mới (SC-005) |
| `cross-use.test.ts` | `full` | SC-003 hai chiều, hai driver: multipart, JSON, import, TUS; xem, tải, transform, thay, xóa ở app kia |
| `tus.test.ts` | `full` (profile `assets-limit`) | US4: tạo ở A, `HEAD`/`PATCH` chunk xen kẽ A/B (local và S3, chunk ≥ 5 MiB), `Directus-File-Id`, `tus_id` null, ẩn khỏi `GET /files` khi dở, thay file, user khác, hết hạn và lịch dọn, `TUS_ENABLED=false` ở cặp chính |
| `zip.test.ts` | `full` | FR-041: entry và nội dung, quyền, lỗi body |
| `startup/storage.test.ts` (sửa) | `full` | FR-071, SC-006: `gcs` ở location thứ hai → exit 1 + log; hai location; health, info |
| `normalizers.ts` (sửa) | — | `Content-Disposition` (đã có), `ETag`/`Last-Modified` theo `modified_on` của từng app (so sau khi quy về giây), tên zip `-<datetime>` |
| `request-set.ts` (sửa) | — | `GET /files`, `/folders`, `/assets/:id` cho `db-unchanged`, `readonly-account` |

Quy tắc so: `parity()` (status, `COMPARED_HEADERS` + `Content-Disposition`, `Content-Type`, `Cache-Control`, `Vary`,
`Accept-Ranges`, `Content-Range`, `Content-Security-Policy`; body JSON theo cấu trúc; body nhị phân theo sha256). Mỗi
file dọn bằng `DELETE /files`, `DELETE /folders` ở `afterAll` và `deleteDerived` dự phòng.

## 3. Blackbox: file thêm vào `tests/parity/src/items/blackbox/`

| Nguồn (`directus/tests/blackbox/tests/`) | Sửa (`// Backoffice:`) |
|------------------------------------------|------------------------|
| `common/assets/{read,format,limit,concurrency,cache-revalidate}.test.ts` | `storages` → `getStorages()` của shim (`PARITY_STORAGES`, mặc định `local,s3`); URL qua shim; `limit`, `cache-revalidate` dùng cặp `assets-limit` qua `nodeUrl` |
| `db/routes/files/{storage,tus}.test.ts` | `storages`; `tus-js-client` (devDependency bản Directus); `tus` dùng cặp `assets-limit` |
| `db/routes/collections/files.test.ts` | URL |
| `db/routes/server/health.test.ts` | nếu chưa port ở 001 |
| `directus/tests/e2e/tests/endpoints/{files/files,files/old,assets/assets}.test.ts` | viết lại thành `src/files/e2e-{files,assets}.test.ts` theo `scenario()`, header `// Ported from`, giữ assert và fixture |

`common/config.ts` của shim: thêm `getStorages()`, cặp `assets-limit` vào bảng `nodeUrl`.

## 4. CI

| Workflow, job | Thay đổi |
|---------------|----------|
| `ci.yml` `parity` | Postgres `full` (hai shard): thêm profile `assets-limit`; `PARITY_STORAGES=local,s3`. MySQL, SQLite `reduced`: `PARITY_STORAGES=s3` (Clarifications) |
| `ci.yml` `parity-blackbox` | thêm profile `assets-limit`; `PARITY_STORAGES=local,s3` |
| `parity-matrix.yml` | `blackbox-full` và `parity-matrix`: `PARITY_STORAGES=local,s3` |
| `nightly.yml` | `PARITY_STORAGES=local,s3` |
| `benchmark.yml` | job `benchmark-files` |
| `tools/ci-local.sh` | bước tương ứng |
| `proxy/backoffice-routes.txt` | `files`, `folders`, `assets` |
| `accepted-differences.ts` | xóa D-09.5; D-31 bỏ `directus_files`, `directus_folders` (commit đóng feature) |

## 5. Playwright (`tests/directus-app-e2e/src/`)

`files.spec.ts`: tải lên qua input file, import URL `http://files-fixtures/...` (app tải server-side nên URL nội bộ
của compose đủ), xem trước ảnh (thumbnail `system-*`), sửa title và folder, tạo folder, di chuyển, xóa, tải zip thư
mục; `items.spec.ts` thêm ca thumbnail trên layout cards;
`routing.spec.ts` thêm ba route về app mới.

## 6. Benchmark (`tests/benchmark/src/files.ts`, `seed-files.ts`)

| Kịch bản | Request | Ghi chú |
|----------|---------|---------|
| `asset-raw` | `GET /assets/:id` (200 ảnh jpeg ~1 MB, xoay vòng) | admin |
| `asset-derived` | `GET /assets/:id?key=system-medium-cover` | sinh sẵn ở seed |
| `asset-transform` | `GET /assets/:id?width=<w>` 20 giá trị × 10 ảnh | `deleteDerived` trước mỗi vòng; `connections: 10` (< `ASSETS_TRANSFORM_MAX_CONCURRENT` 25) |
| `files-list` | `GET /files?limit=50` | admin; user đọc 50% file theo `filter` |
| `files-upload` | `POST /files` multipart 10 KB | dọn sau mỗi vòng |

p95 ở tốc độ cố định 80% của Directus, throughput ở 50 kết nối (trừ `asset-transform`), 3 vòng; `compare.ts` ngưỡng 10%.
Ghi `benchmark-files` duration vào tasks sau lần chạy đầu (tiền lệ 006).
