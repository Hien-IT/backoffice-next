# Research: Files, folders, assets, TUS (007)

Mỗi mục gồm Quyết định, Lý do, Đã cân nhắc. Mốc so sánh là Directus 11.17.4 (api 35.2.0). Điều gì chưa đo thì ghi
`[Suy luận]` và có task kiểm sớm. Các quyết định lớn đã chốt ở Clarifications của spec: ảnh trùng từng byte (lệch do
bản build thư viện ảnh thì tech lead quyết); Postgres chạy cả `local` và MinIO mỗi lần push; benchmark có kịch bản sinh
transform mới. Đường dẫn Directus tính từ `directus/api/src` trừ khi ghi khác.

## R1. Thư viện và phiên bản

- **Quyết định**: Thêm vào catalog `pnpm-workspace.yaml` đúng bản của `directus/pnpm-workspace.yaml`: `sharp` 0.34.5
  (thêm vào `onlyBuiltDependencies` như Directus; bản prebuilt `@img/sharp-linuxmusl-x64` cho image alpine),
  `@tus/server` 2.3.0, `mime-types` 3.0.1 (+ `@types/mime-types`), `content-disposition` 0.5.4 (+ types), `archiver`
  7.0.1 (+ types), `encodeurl` 2.0.0 (+ types), `exif-reader` 2.0.2, `icc` 3.0.0, `minimatch` 10.2.5,
  `zod-validation-error` (bản của Directus, dùng ở `controllers/assets.ts`). Chuyển `axios` 1.15.0 từ devDependency
  sang dependency của `apps/api`; thêm `@tus/utils` 0.6.0 vào `apps/api` (đã có ở `libs/storage-driver-s3`). Dùng lại
  bản đã có: `busboy` 1.6.0, `object-hash` 3.0.0, `helmet` 8.1.0 (CSP của asset), `cron` 4.3.4, `bytes`, `ms`,
  `ip-matching` 2.1.2, `joi`, `zod` 4.1.12, `lodash-es`, `@backoffice/format-title`, `@backoffice/utils/node`
  (`IpBlocklist`).
- **Lý do**: Cùng bản thì cùng kết quả: `object-hash` quyết định tên file phát sinh (FR-035), `sharp` quyết định byte ảnh
  (SC-004), `@tus/server` quyết định header và status của giao thức TUS, `busboy` quyết định lỗi multipart, `mime-types`
  quyết định đuôi `filename_disk` và `Content-Type` sau đổi định dạng, `minimatch` quyết định `FILES_MIME_TYPE_ALLOW_LIST`.
- **Đã cân nhắc**: `@nestjs/platform-express` `FileInterceptor` (multer) cho multipart: bị loại, khác lỗi và thứ tự field
  so với `multipartHandler` của Directus (005/006 đã chọn busboy qua `runMiddleware`). Thư viện ảnh khác hoặc bản sharp
  mới hơn: bị loại, phá SC-004. `archiver` thay bằng thư viện zip khác: bị loại, danh sách entry và header phải giống.

## R2. Ảnh trùng từng byte: cùng sharp, cùng image alpine

- **Quyết định**: Ghim `sharp` 0.34.5 và chạy trên cùng nền `node:22-alpine` như image Directus (`directus/Dockerfile`
  và `apps/api/Dockerfile` đều alpine, cùng toolchain `python3 py3-setuptools build-base`), nên cả hai nhận cùng binary
  prebuilt `@img/sharp-linuxmusl-x64` kèm cùng libvips. Bộ đối chiếu so byte ảnh (FR-082); thêm fixture ảnh và ảnh kết
  quả của `directus/tests/e2e/tests/endpoints/assets/` (`img_50x50.jpg`...), vốn do sharp của Directus sinh ra, làm mốc
  thứ ba. Nếu lệch, ghi bằng chứng và đưa tech lead (Clarifications).
- **Lý do**: `[Suy luận]` cùng bản sharp và cùng libc (musl) cho cùng byte đầu ra; fixture e2e của Directus là bằng
  chứng sẵn có để đo ngay ở task đầu của gói asset trước khi viết ma trận transform.
- **Đã cân nhắc**: Copy `node_modules/sharp` từ image Directus vào image app mới: bị loại, phức tạp build và không cần
  nếu bản prebuilt trùng. So điểm ảnh ngay: bị loại (Clarifications chọn trùng byte).

## R3. Port nguyên service, util và request

- **Quyết định**: Port nguyên, cùng đường dẫn, kèm test gốc: `services/files.ts` → `files.service.ts` (extends
  `ItemsService` đã có), `services/folders.ts` → `folders.service.ts`, `services/assets.ts` → `assets.service.ts`,
  `services/files/lib/{extract-metadata,get-sharp-instance}.ts`, `services/files/utils/{get-metadata,
  parse-image-metadata}.ts`, `services/tus/{server,data-store,lockers,utils/wait-timeout}.ts`,
  `utils/transformations.ts`, `request/{index,agent-with-ip-validation,is-denied-ip}.ts`, `synchronization.ts` (R5),
  `schedules/tus.ts`; hằng `SYSTEM_ASSET_ALLOW_LIST`, `ASSET_TRANSFORM_QUERY_KEYS`, `SUPPORTED_IMAGE_TRANSFORM_FORMATS`,
  `SUPPORTED_IMAGE_METADATA_FORMATS`, `RESUMABLE_UPLOADS.EXPIRATION_TIME`, `.SCHEDULE` vào `constants.ts`; type
  `Transformation*`, `ChunkedUploadContext`, `File` từ `directus/packages/types` nếu `@backoffice/types` còn thiếu.
  `getStorage()`, driver `local`, `s3`, `useLock`, `getCacheControlHeader`, `getConfigFromEnv`, `validateEnv` đã có
  (001, 002). Bỏ `directus_files`, `directus_folders` khỏi `COLLECTIONS_WITHOUT_SERVICE_YET` (FR-017) để ghi lồng và
  `directus_users.avatar` đi qua `FilesService`.
- **Lý do**: FR-010 đến FR-040; giữ nguyên code là cách duy nhất bảo đảm cùng tên file phát sinh, cùng thứ tự dọn object,
  cùng lỗi. `libs/storage*` đã là bản port nguyên (chỉ đổi import), có `supportsTus` và đủ phương thức TUS.
- **Đã cân nhắc**: Viết `FilesService` gọn hơn (bỏ prefix listing, thêm timeout import): bị loại, trái R-13, R-14 và
  Nguyên tắc III.

## R4. Bốn controller Nest, multipart và route tùy chọn

- **Quyết định**: `controllers/{files,folders,assets,tus}.controller.ts`, mỗi handler một route theo đúng thứ tự file gốc;
  đăng ký trong `app.module.ts` theo thứ tự `app.ts` của Directus: `AssetsController`, `TusController` (chỉ khi
  `TUS_ENABLED`, qua `...(RESUMABLE_UPLOADS.ENABLED ? [TusController] : [])`), `FilesController`, `FoldersController`;
  `useCollection('directus_files')` cho files, assets, tus và `useCollection('directus_folders')` cho folders qua
  `consumer.apply(...).forRoutes(...)`. `multipartHandler` port nguyên làm `RequestHandler` chạy qua `runMiddleware`
  (app Nest tạo với `bodyParser: false`, chỉ `jsonBody` parse JSON nên stream multipart còn nguyên; tiền lệ
  `schemaMultipartHandler` của 006). `validateBatch`, `respond`, `MetaService`, `ServiceFactory` như 005.
  Route `GET /assets/:pk/:filename?` viết theo cú pháp Express 5 (`:pk{/:filename}`); task đầu của gói asset kiểm
  `OPTIONS`, `HEAD`, `:filename` qua supertest. `router-options.ts` thêm mẫu cho `/files`, `/files/import`,
  `/files/tus`, `/files/tus/:id`, `/folders`, `/assets/:pk`, `/assets/folder/:pk`, `/assets/files`
  (contracts/files-api.md §4).
- **Lý do**: FR-001; mẫu R2 của 005, 006. Thứ tự controller quyết định `/files/tus/:id` không rơi vào `PATCH /files/:pk`
  (như thứ tự mount của Directus) và `TUS_ENABLED=false` rơi đúng vào `/files/:pk` như Directus (US4 ca 5).
- **Đã cân nhắc**: Mount router Express của Directus thẳng vào app Nest: bị loại, trái Nguyên tắc VI (controller Nest).

## R5. TUS: `@tus/server` trong Nest, khóa Redis, lịch dọn đồng bộ

- **Quyết định**: `TusController` có handler cho `POST /files/tus`, `PATCH|DELETE|OPTIONS|HEAD /files/tus/:id`, mỗi
  handler chạy `checkFileAccess` (port) rồi `const [server, cleanup] = await createTusServer({schema, accountability})`,
  `await server.handle(req, res)`, `cleanup()`; `@tus/server` ghi thẳng vào `res` nên không qua `respond`. Khóa: `KvLock`
  port nguyên trên `useLock()` (Redis `REDIS_LOCK_NAMESPACE` hoặc `directus:lock`, key là id upload) nên hai app và mọi
  instance tranh cùng khóa (FR-053). Lịch dọn: port `synchronization.ts` (`SynchronizedClock`, store `memory` hoặc
  `redis` theo `SYNCHRONIZATION_STORE`, namespace `SYNCHRONIZATION_NAMESPACE` mặc định `directus-sync`) và
  `scheduleSynchronizedJob` vào `utils/schedule.ts` (hiện chỉ có `validateCron`), `schedules/tus.ts` chạy ở startup
  khi `TUS_ENABLED` và dừng khi shutdown (tiền lệ `schedules/metrics.ts`). Mặc định `SYNCHRONIZATION_STORE=memory` nên
  mỗi instance tự chạy dọn như Directus; dọn là idempotent (xóa dòng hết hạn, hủy multipart S3). `SYNCHRONIZATION_STORE`,
  `SYNCHRONIZATION_NAMESPACE` vào nhóm A.
- **Lý do**: FR-050 đến FR-054; `@tus/server` nhận `IncomingMessage`/`ServerResponse` nên chạy được trong handler Nest
  `[Suy luận: kiểm ở task đầu gói TUS]`; cùng key khóa và cùng key clock (`directus-sync:clock:tus-cleanup:<cron>`) là
  điều kiện "tiếp tục ở app kia".
- **Đã cân nhắc**: Lock riêng bằng `@sesamecare-oss/redlock` của 002: bị loại, khác key với Directus nên hai app không
  tranh chấp nhau. Chạy dọn bằng `scheduleSynchronizedJob` nhưng ép `redis`: bị loại, đổi hành vi so với Directus.

## R6. Storage `local` dùng chung và fixture import trong môi trường đối chiếu

- **Quyết định**: Mọi env vendor của `tests/parity/env/*.env` đổi `STORAGE_LOCATIONS=local,s3` (thêm
  `STORAGE_LOCAL_DRIVER=local`, `STORAGE_LOCAL_ROOT=./uploads`), named volume `uploads` mount vào `/directus/uploads`
  ở anchor `x-app` (mọi container Directus và app mới của mọi cặp profile, cùng vendor); `env-up` chmod thư mục trong
  container như tiền lệ `data.db` của SQLite. Thêm service `files-fixtures` (nginx alpine phục vụ
  `tests/parity/fixtures/files/`: ảnh jpeg, png, webp, tiff, avif, gif, ảnh EXIF xoay, pdf, svg, file nén) cho
  `/files/import`; ca chặn IP dùng `http://127.0.0.1:<port>` và `http://169.254.169.254/`. Location đầu là `local`
  (như blackbox của Directus), nên upload không chỉ `storage` và TUS vào `local`.
- **Lý do**: FR-080, Clarifications (Postgres cả hai storage mỗi lần push); bộ blackbox của Directus chạy
  `describe.each(['local','minio'])`. Volume dùng chung là cách Nguyên tắc VII cho phép `local`.
- **Đã cân nhắc**: Chỉ MinIO: bị loại (Clarifications). Thư mục bind mount trên host: bị loại, quyền file trên runner
  Linux (bài học SQLite của 006).

## R7. Port bộ blackbox và e2e

- **Quyết định**: Copy 8 file blackbox vào `tests/parity/src/items/blackbox/tests/{common/assets,db/routes/files,
  db/routes/collections}/` với sửa `// Backoffice:` tối thiểu: `const storages = ['local','minio']` → `getStorages()`
  của shim (`PARITY_STORAGES`, mặc định `local,s3`); URL qua shim như 005, 006; `tus.test.ts` dùng `tus-js-client`
  (thêm devDependency bản của Directus). Ba file e2e (`files.test.ts`, `old.test.ts`, `assets.test.ts`) không có
  harness ở repo: viết lại thành `tests/parity/src/files/e2e-{files,assets}.test.ts` theo `scenario()` của bộ đối chiếu,
  header `// Ported from directus/tests/e2e/...`, giữ nguyên assert và fixture ảnh (`image.jpg`, `img_50x50.jpg`...).
  `health.test.ts` của blackbox: port nếu chưa có ở 001.
- **Lý do**: FR-081, US7; fixture ảnh của e2e là mốc byte (R2).
- **Đã cân nhắc**: Port cả harness `directus/tests/e2e`: bị loại, thêm một cách chạy thứ ba cho 3 file.

## R8. Bộ đối chiếu `tests/parity/src/files/`

- **Quyết định**: Thư mục mới với `files.test.ts` (US1, US3: multipart, JSON, nhiều file, `PATCH` thay file, đổi
  `filename_disk`, xóa, quyền, lỗi), `folders.test.ts`, `import.test.ts` (US5), `assets.test.ts` (US2: query, header,
  range, revalidate, preset, lỗi, giới hạn với profile `assets-limit`), `transform-matrix.test.ts` (FR-082: bộ ảnh ×
  tham số, so tên object và byte, kiểm không ghi object mới), `cross-use.test.ts` (SC-003 hai chiều, hai driver),
  `tus.test.ts` (US4 xen kẽ chunk giữa hai app, hết hạn), `zip.test.ts` (FR-041: danh sách entry và nội dung), `storage-capture.ts`
  (liệt kê object theo tiền tố ở `local` qua volume và ở S3 qua `@backoffice/storage-driver-s3`; dòng `directus_files`,
  `directus_folders` bỏ id và ngày giờ). Hai profile mới: `assets-limit` (`ASSETS_TRANSFORM_MAX_CONCURRENT=2` như
  blackbox Directus, `ASSETS_CACHE_REVALIDATE=true`, `TUS_ENABLED=true`, `SYNCHRONIZATION_STORE=redis`, mime allow list
  hẹp, `FILES_MAX_UPLOAD_SIZE=30mb`) cho blackbox assets, tus và ca không phụ thuộc thời gian; `assets-stress`
  (`MAX_CONCURRENT=1`, `ASSETS_TRANSFORM_TIMEOUT=100ms`, `TUS_UPLOAD_EXPIRATION=2s`, lịch dọn mỗi phút) chỉ cho ca busy,
  timeout, hết hạn, tách ra để blackbox không flaky (`/speckit.analyze` I2); `cors-hsts` bật thêm TUS để đo `OPTIONS` khi
  CORS bật; cặp chính giữ `TUS_ENABLED` mặc định để kiểm US4 ca 5.
- **Lý do**: FR-080, FR-082; tiền lệ `schema-management/` của 006. `normalizeContentDisposition` của 005 đã có cho khác
  biệt Express 4/5 (`content-disposition` 0.5.4 và 1.0.0) `[Suy luận: đo lại ở ca đầu]`.
- **Đã cân nhắc**: Nhét ca giới hạn vào cặp chính bằng env mặc định: bị loại, `MAX_CONCURRENT=25` không ép được `503`.

## R9. Playwright: module Files và thumbnail (FR-083)

- **Quyết định**: `tests/directus-app-e2e/src/files.spec.ts`: tải lên (kéo thả qua input), import URL (fixtures), xem
  trước, sửa title và folder, di chuyển, xóa, tải zip thư mục; `items.spec.ts` thêm ca thumbnail `system-small-cover`
  trên layout cards. `proxy/backoffice-routes.txt` thêm `files`, `folders`, `assets`; `routing.spec.ts` thêm ba route.
- **Lý do**: FR-083; app Directus là client thật của `/assets?key=system-*`.
- **Đã cân nhắc**: Không.

## R10. Benchmark (FR-084, SC-007)

- **Quyết định**: `tests/benchmark/src/files.ts` + `seed-files.ts` (200 ảnh jpeg 1 MB và 1.000 dòng file nhỏ qua API,
  user một phần đọc 50%): kịch bản `asset-raw` (`GET /assets/:id`), `asset-derived` (`?key=system-medium-cover` sinh
  sẵn), `asset-transform` (tập 20 tham số `width` khác nhau × 10 ảnh, xóa object `__*` trước mỗi vòng bằng
  `storage-capture.ts`, `connections` = 10 < `ASSETS_TRANSFORM_MAX_CONCURRENT`), `files-list` (admin, user), `files-upload`
  (multipart 10 KB). Job `benchmark-files` trong `benchmark.yml` (hằng tuần, không chặn CI).
- **Lý do**: Clarifications; tiền lệ `schema.ts` (mỗi kịch bản một script, `compare.ts`).
- **Đã cân nhắc**: Đo `asset-transform` ở 50 kết nối: bị loại, đo nhầm `503` (Clarifications).

## R11. Biến môi trường và startup

- **Quyết định**: Thêm khối `// Feature 007` vào nhóm A của `supported-variables.ts`: `FILES_MIME_TYPE_ALLOW_LIST`,
  `FILES_MAX_UPLOAD_SIZE`, `FILES_DELETE_ORIGINAL_ON_MOVE`, `FILES_MAX_UPLOAD_CONCURRENCY`, `FILE_METADATA_ALLOW_LIST`,
  `ASSETS_CACHE_TTL`, `ASSETS_CACHE_REVALIDATE`, `ASSETS_TRANSFORM_MAX_CONCURRENT`, `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION`,
  `ASSETS_TRANSFORM_MAX_OPERATIONS`, `ASSETS_TRANSFORM_TIMEOUT`, `ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL`,
  `ASSETS_CONTENT_SECURITY_POLICY.*`, `TUS_ENABLED`, `TUS_CHUNK_SIZE`, `TUS_UPLOAD_EXPIRATION`, `TUS_CLEANUP_SCHEDULE`,
  `IMPORT_IP_DENY_LIST`, `SYNCHRONIZATION_STORE`, `SYNCHRONIZATION_NAMESPACE`, `STORAGE_.+_FORCE_PATH_STYLE`,
  `STORAGE_.+_CONNECTION_TIMEOUT`, `STORAGE_.+_SOCKET_TIMEOUT`, `STORAGE_.+_MAX_SOCKETS`, `STORAGE_.+_KEEP_ALIVE`.
  Giữ nhóm C: `IMPORT_TIMEOUT`, `IMPORT_MAX_CONCURRENCY` (010), tùy chọn driver ngoài phạm vi. Startup không đổi
  (`validateStorageDrivers`, `validateStorage` đã có); `getStorage()` vẫn khởi tạo lười; `schedules/tus.ts` thêm sau
  `registerAuthProviders`. Không cảnh báo một instance cho `local` (quyết định khi clarify: app không biết volume có dùng
  chung hay không).
- **Lý do**: FR-070 đến FR-073; quy tắc "mỗi feature chuyển biến mình dùng sang nhóm A".
- **Đã cân nhắc**: Một mẫu `STORAGE_.+_.+`: bị loại, file giữ danh sách tường minh.

## R12. Sổ khác biệt và spec cũ

- **Quyết định**: Gỡ D-09.5 (spec 001, `accepted-differences.ts`) ở commit đóng feature; thu hẹp D-31 (spec 004 và
  entry) bỏ `directus_files`, `directus_folders`; D-16 giữ. Spec 007 FR-054 ghi rõ điều kiện `SYNCHRONIZATION_STORE=redis`
  (R5). R-13, R-14 đo và ghi bằng chứng ở `files.test.ts`, `import.test.ts`.
- **Lý do**: Nguyên tắc X; tiền lệ R11 của 006.
- **Đã cân nhắc**: Không.

## R13. Unit test

- **Quyết định**: Port test gốc kèm code: `services/files.test.ts` (36), `folders.test.ts` (13), `assets.test.ts` (19),
  `tus/server.test.ts` (2), `files/lib/get-sharp-instance.test.ts`, `files/utils/get-metadata.test.ts`,
  `utils/transformations.test.ts` (16), `request/*.test.ts` (27), `schedule.test.ts` nếu có. Test mới (supertest qua app
  Nest, như 006): bốn controller, `multipartHandler`, `checkFileAccess`, `synchronization`, `scheduleSynchronizedJob`,
  `router-options`. Coverage 80% `apps/api`.
- **Lý do**: Nguyên tắc VI, X.
- **Đã cân nhắc**: Không.

## R14. Thứ tự làm

- **Quyết định**: Gói A: catalog, hằng, type, port service, util, request, synchronization, `get-service.ts`,
  typecheck, unit test gốc. Gói B: bốn controller, `multipartHandler`, `router-options`, nhóm A env, test controller.
  Gói C: môi trường đối chiếu (`local`, `uploads`, `files-fixtures`, profile `assets-limit`), `storage-capture.ts`,
  `files`, `folders`, `import`, `assets`, `transform-matrix` (đo R2 sớm bằng fixture e2e), `cross-use`, `zip`. Gói D:
  TUS (controller, lịch dọn, `tus.test.ts` đối chiếu). Gói E: blackbox 8 file + e2e viết lại, CI (`parity`,
  `parity-blackbox`, `parity-matrix`, `nightly`). Gói F: Playwright. Gói G: benchmark. Gói H: sổ khác biệt, spec cũ,
  README, đóng feature. Tách `tasks.md` thành hai phần nếu vượt 60 task (tiền lệ 006).
- **Lý do**: Đo rủi ro lớn nhất (byte ảnh, route tùy chọn, `@tus/server` trong Nest) ở đầu mỗi gói.
- **Đã cân nhắc**: Không.
