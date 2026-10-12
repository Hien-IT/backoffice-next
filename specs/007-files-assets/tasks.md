---

description: "Danh sách task cho feature 007: Files, folders, assets (/files, /folders, /assets, TUS)"
---

# Tasks: Files, folders, assets (`/files`, `/folders`, `/assets`, TUS)

**Input**: Tài liệu thiết kế trong `/specs/007-files-assets/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md`, `data-model.md`, `contracts/`, `quickstart.md`,
`checklists/files-review.md`.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test. Test gốc của Directus đi kèm file port thì port theo, chạy đỏ trước rồi port code
  (research R13).
- Mọi endpoint thêm hoặc sửa có test đối chiếu chạy với cả Directus 11.17.4 thật lẫn app mới trên cả hai storage
  (`local` volume dùng chung và MinIO, research R6, R8); bộ blackbox và e2e của Directus port chạy hai lượt theo app
  (R7).
- Ảnh phát sinh so từng byte; ca đầu tiên so với fixture của `directus/tests/e2e` (R2). Lệch thì dừng, ghi bằng chứng
  vào "Ghi chú khi làm" và hỏi tech lead (Clarifications của spec).

**Organization**: Task nhóm theo user story của spec. Phase 1 và 2 là nền chung: thư viện, hằng, môi trường đối chiếu,
service port nguyên, provider, `router-options`, công cụ chụp storage. Thứ tự story theo research R14: US1 (tải lên, tải
về, dùng chéo) → US3 (quản lý file, thư mục, zip) → US2 (transform) → US4 (TUS) → US5 (import) → US6 (storage, env) →
US7 (blackbox, CI) → Polish (Playwright, benchmark, sổ khác biệt, đóng feature). US3 trước US2 vì `FoldersService` và
zip nhỏ, còn US2 cần đo byte sớm nhưng dựa trên `AssetsController` đã xong ở US1.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task. Phase 1, 2 và Polish không có nhãn này.
- File port từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn nguồn>`. Mỗi task port ghi các cặp
  `{ "source", "dest" }` (source tính từ `directus/`) vào `tools/port-manifest/007-T###.json`, theo đúng ID task.
  Chạy `node tools/check-port-headers.mjs` sau khi ghi. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Port nguyên vẹn: giữ tên biến, thứ tự câu lệnh, message của Directus. Chỗ khác nguồn ghi `// Backoffice: <lý do>`
  (danh sách cho phép ở plan, Constitution Check I). Giới hạn tạm ghi `// ponytail: <giới hạn>, <khi nào nâng>`.
- **Không sửa service của feature trước**; chỉ thêm factory vào `providers.ts`, rút `COLLECTIONS_WITHOUT_SERVICE_YET`
  trong `utils/get-service.ts`, thêm `scheduleSynchronizedJob` vào `utils/schedule.ts`.
- **Luôn tái tạo hành vi Directus**, kể cả hành vi không an toàn (R-13 đến R-18). Phát hiện hành vi không an toàn mới
  thì thêm dòng R-xx vào spec kèm bằng chứng (ca test, request, kết quả đo trên Directus thật, ngày đo) và một ca thể
  hiện; không tự lệch. Điểm spec ghi "đo ở task" thì task tương ứng đo trên Directus thật, ghi kết quả vào spec (thay
  "đo ở task") và "Ghi chú khi làm".
- Không đọc `useEnv()` ở cấp module (quy ước 001) trừ chỗ Directus làm thế và đã có tiền lệ.
- Tên biến, comment, commit viết tiếng Anh. Tài liệu viết tiếng Việt.
- Test viết trước và phải fail trước khi làm phần tương ứng.
- Quy trình merge thẳng `main`: mỗi nhóm task commit và push xong thì CI phải xanh; `pnpm run ci:local` khi Actions bị
  chặn.

## Quy ước đường dẫn

- API: `apps/api/src/**`. Libs: `libs/types/src/**`. Catalog: `pnpm-workspace.yaml`.
- Test đối chiếu: `tests/parity/src/**` (mới: `tests/parity/src/files/**`; blackbox port thêm vào
  `tests/parity/src/items/blackbox/**`). Danh sách khác biệt: `tests/parity/accepted-differences.ts`. Profile, env,
  fixture: `tests/parity/docker-compose.yml`, `tests/parity/env/**`, `tests/parity/fixtures/**`.
- E2E app Directus: `tests/directus-app-e2e/**`. Reverse proxy: `tests/parity/proxy/**`.
- Benchmark: `tests/benchmark/**`. Công cụ: `tools/**`. CI: `.github/workflows/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/packages/*`, `directus/tests/blackbox/**`,
  `directus/tests/e2e/**`.

## Tóm tắt

- Tổng số task: **58**
- Số task đánh dấu [P]: **38**
- Một lượt implement (dưới ngưỡng 60 của research R14), checkpoint sau mỗi phase.
- MVP gợi ý: **Phase 1 đến 5** (US1, US3, US2): `/files`, `/folders`, `/assets` kể cả transform, dùng chéo hai chiều,
  byte ảnh trùng. Feature chưa đóng được khi chưa xong US4 (TUS), US5 (import), US6, US7 (blackbox) và Polish.

---

## Phase 1: Setup (thư viện, hằng, type, môi trường đối chiếu)

**Purpose**: Thêm thư viện cùng bản Directus và kiểm sharp trên alpine; hằng, type thiếu; môi trường đối chiếu có
`local` dùng chung, fixture import, cặp `assets-limit`, chọn storage; suite và proxy (research R1, R2, R6, R8,
contracts/parity.md §1, §4).

- [X] T001 Thêm vào `catalog:` của `pnpm-workspace.yaml` đúng bản `directus/pnpm-workspace.yaml`: `sharp: 0.34.5`,
  `'@tus/server': 2.3.0`, `mime-types: 3.0.1`, `'@types/mime-types'`, `content-disposition: 0.5.4`,
  `'@types/content-disposition'`, `archiver: 7.0.1`, `'@types/archiver'`, `encodeurl: 2.0.0`, `'@types/encodeurl'`,
  `'exif-reader': 2.0.2`, `icc: 3.0.0`, `minimatch: 10.2.5`, `'zod-validation-error'` (bản Directus),
  `'tus-js-client'` (bản `directus/tests/blackbox/package.json`); `onlyBuiltDependencies` thêm `sharp` như Directus.
  `apps/api/package.json`: các gói trên (types vào devDependencies), `@tus/utils` 0.6.0, chuyển `axios` 1.15.0 sang
  `dependencies`; `tests/parity/package.json`: `tus-js-client` (dev). Chạy `pnpm install`, `pnpm audit --prod
  --audit-level=high`, rồi `docker build -f apps/api/Dockerfile .` và trong image chạy `node -e
  "console.log(require('sharp').versions)"`; ghi `sharp.versions` (libvips) và kết quả audit vào "Ghi chú khi làm"
  (research R1, R2; rủi ro "sharp trên alpine" của plan).
- [X] T002 [P] `libs/types/src/`: port `assets.ts` (`Transformation`, `TransformationParams`, `TransformationSet`,
  `TransformationFormat`, `TransformationMethods`...) từ `directus/packages/types/src/assets.ts` và kiểm `files.ts`
  (`File`, `ChunkedUploadContext`) đã đủ chưa, thiếu thì port từ `packages/types/src/files.ts`, `storage.ts`; export
  trong `libs/types/src/index.ts`; `libs/types/src/index.test.ts` thêm khẳng định export. Ghi manifest.
- [X] T003 [P] `apps/api/src/constants.ts`: port `SYSTEM_ASSET_ALLOW_LIST`, `ASSET_TRANSFORM_QUERY_KEYS`,
  `SUPPORTED_IMAGE_TRANSFORM_FORMATS`, `SUPPORTED_IMAGE_METADATA_FORMATS` và thêm `EXPIRATION_TIME`, `SCHEDULE` vào
  `RESUMABLE_UPLOADS` (getter, `getMilliseconds(env['TUS_UPLOAD_EXPIRATION'], 600_000)`) từ
  `directus/api/src/constants.ts`; `apps/api/src/constants.test.ts` thêm ca cho từng hằng và giá trị mặc định. Ghi
  manifest.
- [X] T004 [P] Môi trường đối chiếu, storage `local` dùng chung: 9 file `tests/parity/env/<vendor>.env` đổi
  `STORAGE_LOCATIONS=local,s3`, thêm `STORAGE_LOCAL_DRIVER=local`, `STORAGE_LOCAL_ROOT=./uploads`; anchor `x-app` của
  `tests/parity/docker-compose.yml` thêm named volume `uploads:/directus/uploads` (khai báo ở `volumes:` gốc);
  `tests/parity/scripts/env.mjs` (bước sau `up`) chmod `777` `/directus/uploads` trong một container sau khi lên, theo
  tiền lệ `data.db`; `tests/parity/src/vendors.test.ts` thêm ca: mọi env có hai location, compose có volume. Chạy
  `env-up --vendor=postgres` và upload thử bằng Directus vào `local` để kiểm quyền ghi (rủi ro "volume uploads" của
  plan). (contracts/parity.md §1)
- [X] T005 [P] Fixture: `tests/parity/fixtures/files/` gồm bộ ảnh của FR-082 (jpeg RGB, jpeg CMYK, jpeg EXIF
  orientation 6, png 8-bit, png 16-bit, png alpha, webp, tiff, avif, gif tĩnh, gif động, ảnh 7000×100 cho giới hạn, jpeg
  cắt cụt, mỗi ảnh ≤ 200 KB, sinh bằng script `tests/parity/fixtures/make-images.mjs` dùng sharp để tái tạo được), pdf,
  svg, `photo.jpg.gz`, `photo.jpg.br`; `tests/parity/fixtures/assets/` copy `image.jpg`, `img_50x50.jpg` và mọi ảnh kết
  quả của `directus/tests/e2e/tests/endpoints/assets/` (ghi nguồn trong `README.md` của thư mục); service
  `files-fixtures` (`nginx:alpine`, mount `fixtures/files` chỉ đọc, thêm `location /redirect/ { return 302 /photo.jpg; }`
  và `location /gz/ { add_header Content-Encoding gzip; }`) vào `docker-compose.yml`, mọi app `depends_on` nó;
  `vendors.test.ts` kiểm service có mặt.
- [X] T006 [P] Hai cặp profile. `assets-limit` (`tests/parity/env/profile-assets-limit.env`): giá trị của blackbox
  Directus và các ca không phụ thuộc thời gian: `ASSETS_TRANSFORM_MAX_CONCURRENT=2`, `ASSETS_CACHE_REVALIDATE=true`,
  `TUS_ENABLED=true` (hết hạn và lịch dọn mặc định), `SYNCHRONIZATION_STORE=redis`, `CORS_ENABLED=false`,
  `FILES_MIME_TYPE_ALLOW_LIST=image/*,application/pdf`, `FILES_MAX_UPLOAD_SIZE=30mb`; cặp `directus-assets-limit`
  (10055), `backoffice-api-assets-limit` (10056). `assets-stress` (`profile-assets-stress.env`): chỉ các ca thời gian:
  `ASSETS_TRANSFORM_MAX_CONCURRENT=1`, `ASSETS_TRANSFORM_TIMEOUT=100ms`, `TUS_ENABLED=true`, `TUS_UPLOAD_EXPIRATION=2s`,
  `TUS_CLEANUP_SCHEDULE=* * * * *`, `SYNCHRONIZATION_STORE=redis`, `CORS_ENABLED=false`; cặp (10155, 10156). Cả hai theo
  mẫu cặp `blackbox`; `tests/parity/env/profile-cors-hsts.env` thêm `TUS_ENABLED=true` để đo `OPTIONS` TUS khi CORS
  bật; `tests/parity/scripts/env.mjs` thêm hai profile vào `ALL_PROFILES`; `tests/parity/src/config.ts` `profilePorts`
  thêm hai cặp; `vendors.test.ts` kiểm cổng không trùng và có file env. Cập nhật contracts/parity.md §1 (hai dòng
  profile).
- [X] T007 [P] Chọn storage và suite: `tests/parity/src/config.ts` thêm `PARITY_STORAGES` (mặc định `local,s3`) và
  `getStorages()`; `tests/parity/src/suite.ts`: `FULL_FILES` thêm `src/files/**/*.test.ts`, `REDUCED_FILES` thêm
  `src/files/{files,folders,assets}.test.ts`; `BLACKBOX_FILES` (hoặc `include` của
  `src/items/blackbox/vitest.blackbox.config.ts`) thêm `tests/common/assets/**`, `tests/db/routes/files/**`,
  `tests/db/routes/collections/files.test.ts`; test trong `src/vendors.test.ts` và `src/config.test.ts`.
- [X] T008 [P] `tests/parity/proxy/backoffice-routes.txt` thêm `files`, `folders`, `assets` (sinh lại `nginx.conf` bằng
  `scripts/proxy-conf.mjs`); `proxy-conf.test.ts` thêm ca `/files`, `/files/tus/x`, `/folders/x`, `/assets/x` về app
  mới, `/utils/sort/x` vẫn về Directus.

**Checkpoint**: `pnpm nx run-many -t test lint typecheck` xanh; image API build được và in `sharp.versions`;
`env-up --vendor=postgres --profiles=assets-limit,assets-stress` lên đủ container, `files-fixtures` trả `photo.jpg`, Directus upload
được vào `local` và `s3`.

---

## Phase 2: Foundational (service, request, TUS, synchronization port nguyên; provider; `OPTIONS`; chụp storage)

**Purpose**: Mọi story cần ba service, `transformations`, `request/*`, `tus/*`, `synchronization` port nguyên với test
gốc xanh, factory, mẫu `OPTIONS` và công cụ chụp storage (research R3, R4, R5, R8).

- [X] T009 [P] Port `apps/api/src/request/{index,agent-with-ip-validation,is-denied-ip}.ts` và ba test gốc từ
  `directus/api/src/request/` (`IpBlocklist` từ `@backoffice/utils/node`, `useEnv` từ `@backoffice/env`, logger của app).
  Ghi manifest.
- [X] T010 [P] Port `apps/api/src/utils/transformations.ts` và `transformations.test.ts` từ `directus/api/src/utils/`.
  Ghi manifest.
- [X] T011 [P] Port `apps/api/src/services/files/lib/{extract-metadata,get-sharp-instance}.ts`,
  `services/files/utils/{get-metadata,parse-image-metadata}.ts` và test gốc (`get-sharp-instance.test.ts`,
  `get-metadata.test.ts`) từ `directus/api/src/services/files/`. Ghi manifest.
- [X] T012 Port `apps/api/src/services/files.service.test.ts` từ `directus/api/src/services/files.test.ts` (sửa đường
  dẫn mock sang `.service.js`, `test-utils`), chạy đỏ; rồi port `apps/api/src/services/files.service.ts` từ
  `directus/api/src/services/files.ts` (`FilesService extends ItemsService`; `getStorage`, `getAxios` của T009,
  `extractMetadata` của T011, `formatTitle` từ `@backoffice/format-title`, `encodeURL`, `minimatch`, `mime-types`). Test
  gốc xanh. Ghi manifest. (sau T009, T011)
- [X] T013 [P] Port `apps/api/src/services/folders.service.ts` và `folders.service.test.ts` từ
  `directus/api/src/services/folders.ts`, `folders.test.ts` (kể cả `services/assets/name-deduper.ts` nếu Directus tách
  file, port cùng đường dẫn). Ghi manifest.
- [X] T014 Port `apps/api/src/services/assets.service.test.ts` từ `directus/api/src/services/assets.test.ts` (phủ
  FR-040 `version` khi đọc storage), chạy đỏ;
  rồi port `apps/api/src/services/assets.service.ts` từ `directus/api/src/services/assets.ts` (`getAsset`, `zipFolder`,
  `zipFiles`, `getAssetSuffix`; `validateItemAccess` của 004, `FilesService` sudo của T012, `FoldersService` của T013,
  `archiver`, `object-hash`, `sharp` qua `getSharpInstance`). Test gốc xanh. Ghi manifest. (sau T010, T012, T013)
- [X] T015 [P] Port `apps/api/src/synchronization.ts` từ `directus/api/src/synchronization.ts` (store `memory`, `redis`
  theo `SYNCHRONIZATION_STORE`, namespace `SYNCHRONIZATION_NAMESPACE` mặc định `directus-sync`, script Lua
  `setGreaterThan`); thêm `scheduleSynchronizedJob` vào `apps/api/src/utils/schedule.ts` (port phần còn thiếu của
  `directus/api/src/utils/schedule.ts`, sửa comment đầu file); viết mới `synchronization.test.ts` (memory:
  `setGreaterThan` chỉ tăng; redis: mock ioredis `defineCommand`) và `schedule.test.ts` (job chỉ chạy `cb` khi clock
  set được; `stop` reset clock). Ghi manifest.
- [X] T016 Port `apps/api/src/services/tus/{index,server,data-store,lockers,utils/wait-timeout}.ts` và `server.test.ts`
  từ `directus/api/src/services/tus/` (`useLock` của 002, `supportsTus` của `@backoffice/storage`, `RESUMABLE_UPLOADS`,
  `FILE_UPLOADS` của T003, `ItemsService`, `extractMetadata`, `emitter`, `getSchema`); viết thêm `data-store.test.ts`
  (create thiếu `size`/`filename_download` → `INVALID_METADATA`, thay file đang dở, `getFileById` lọc `uploaded_by` chỉ
  khi có `user`, `deleteExpired` theo `modified_on`) và `lockers.test.ts` (`KvLock` acquire, timeout, unlock) với kv
  giả. Port `apps/api/src/schedules/tus.ts` từ `directus/api/src/schedules/tus.ts` kèm `onServerShutdown(() =>
  job.stop())` (`// Backoffice:`, tiền lệ `schedules/metrics.ts`) và `tus.test.ts`. Ghi manifest. (sau T012, T015)
- [X] T017 `apps/api/src/providers.ts`: factory `FilesService`, `FoldersService`, `AssetsService` theo mẫu
  `PermissionsService`; `apps/api/src/services/index.ts` export ba service và `createTusServer`;
  `apps/api/src/utils/get-service.ts` bỏ `directus_files`, `directus_folders` khỏi `COLLECTIONS_WITHOUT_SERVICE_YET`
  (sửa comment `ponytail:`), `get-service.test.ts` thêm ca hai collection trả `FilesService`, `FoldersService`
  (FR-017). Typecheck toàn `apps/api`: util còn thiếu thì port bổ sung trong task này, ghi vào "Ghi chú khi làm". Ghi
  manifest. (sau T012 đến T016)
- [X] T018 [P] Đo `OPTIONS` trên Directus của cặp chính, cặp `assets-limit` (CORS tắt, TUS bật) và cặp `cors-hsts`
  (CORS bật, TUS bật) cho các path ở
  contracts/files-api.md §4 (`/files`, `/files/import`, `/files/x`, `/folders`, `/folders/x`, `/assets/x`,
  `/assets/x/y`, `/assets/folder/x`, `/assets/files`, `/files/tus`, `/files/tus/x`), ghi `Allow` hoặc header `Tus-*`
  thật vào contract, spec FR-050 (thay "đo ở task") và "Ghi chú khi làm"; thêm mẫu vào
  `apps/api/src/middleware/router-options.ts` theo thứ tự mount của Directus (`assets`, `files/tus` khi `TUS_ENABLED`,
  `files`, `folders`); `router-options.test.ts` thêm ca từng mẫu, dấu `/` cuối, và `files/tus` vắng khi tắt TUS.
- [X] T019 [P] `tests/parity/src/files/storage-capture.ts` (+ `storage-capture.test.ts` chạy với env đã lên):
  `listObjects(location, prefix)` (`local`: `docker compose exec` `find /directus/uploads`, `s3`: `DriverS3.list` của
  `@backoffice/storage-driver-s3` với env MinIO), `readObject`, `objectDigest` (sha256, size, `Content-Type` S3),
  `deleteDerived(prefix)` (xóa object có `__`), `fileRows(ids)` và `folderRows(ids)` qua knex bỏ cột theo FR-080;
  contracts/parity.md §2.

**Checkpoint**: `pnpm nx run api:test` xanh (test gốc port: files 36, folders 13, assets 19, tus/server 2,
get-metadata, get-sharp-instance, transformations 16, request 27, và test mới), `api:typecheck` xanh, coverage ≥ 80%;
`storage-capture.test.ts` xanh trên Postgres với cả hai storage.

---

## Phase 3: User Story 1 - Tải file lên và tải về, dùng chéo giữa hai app (Priority: P1) 🎯 MVP

**Goal**: `POST /files` multipart và JSON, `PATCH /files/:id` multipart, `DELETE`, `GET /assets/:id` (tải, `Range`,
`HEAD`, revalidate, file công khai); file tải ở app này tải được ở app kia trên cả hai driver (FR-001 đến FR-004,
FR-010 đến FR-015, FR-030 đến FR-033, SC-002, SC-003).

**Independent Test**: `parity --vendor=postgres` suite `full` với `src/files/{files,assets,cross-use}.test.ts`
(`PARITY_STORAGES=local,s3`); `reduced` ở MySQL, SQLite (`PARITY_STORAGES=s3`); so dòng `directus_files` và object qua
`storage-capture`.

### Tests for User Story 1

- [X] T020 [P] [US1] `tests/parity/src/files/files.test.ts` phần tải lên và xóa (`describe.each(getStorages())`,
  `scenario()` của 004): multipart một file với `storage`, `title`, `description` trước file; field sau file không áp;
  ép kiểu `"null"`, `"true"`, `"false"`; nhiều file; `title` từ tên file; đọc lại `Forbidden` → `204`; JSON `POST` có và
  thiếu `type`, thiếu `storage`; không file, file không tên; mime bị chặn trên cặp `assets-limit`
  (`FILES_MIME_TYPE_ALLOW_LIST=image/*,application/pdf` của T006; file thứ hai bị chặn: file đầu còn, response `400`,
  đo có treo không, ghi spec FR-010); file 31 MB (sinh lúc chạy) trên cặp `assets-limit`
  (`FILES_MAX_UPLOAD_SIZE=30mb`): `413`, không còn dòng và object; hai file mà file thứ hai 31 MB: file đầu còn
  (FR-010); `PATCH /files/:id` multipart cùng đuôi và khác đuôi (so object cũ, file phát
  sinh bị xóa, R-15: thứ tự dòng/object chụp sau mỗi bước bằng `storage-capture`); `DELETE` một, mảng, `keys`, `query`
  (R-13: đặt tay `filename_disk=photo.jpg` rồi tạo `photography.png`, xóa `photo`, chụp storage; tên có thư mục con
  `a/b.jpg`); quyền đọc một phần, `403`; `OPTIONS`, `HEAD`, `SEARCH`; đo `filename_download` không đuôi với mime lạ (`<id>.false`,
  ghi vào spec FR-011); số dòng `directus_activity`, `directus_revisions` theo bảng FR-003. Bằng chứng R-13, R-15 ghi
  vào spec.
- [X] T021 [P] [US1] `tests/parity/src/files/assets.test.ts` phần phục vụ file gốc: `GET /assets/:id` inline, `?download`,
  `?download=false`, `/:id/:filename`, `Range` hợp lệ (`206`, suffix), `416` bốn kiểu, `HEAD`, header theo FR-031 (ca
  `Cache-Control` gửi không kèm `no-store`; `public` với token public, `private` với user), id không uuid `403`, object
  mất trên storage `403`, file công khai (`project_logo` trong `directus_settings`) với role public không có quyền; trên
  cặp `assets-limit`: `If-None-Match`, `If-Modified-Since` → `304`, ETag đổi sau thay file. Normalizer `ETag`,
  `Last-Modified` theo FR-080.
- [X] T022 [P] [US1] `tests/parity/src/files/cross-use.test.ts` phần multipart và JSON: tải ở A (mỗi driver), đọc dòng và
  tải qua `/assets` ở B so từng byte, thay ở B, xóa ở B, A trả `403`; cả hai chiều (SC-003).
- [X] T023 [P] [US1] `apps/api/src/controllers/files.controller.test.ts` (supertest qua app Nest, mẫu
  `collections.controller.test.ts` của 006): `multipartHandler` (field trước/sau file, reset payload, ép kiểu, `413` khi
  `truncated`, không file `400`, file không tên `400`, mime bị chặn `400`), JSON `createOne`, `readMany` khi nhiều key,
  `Forbidden` khi đọc lại → `204`, `validateBatch` cho `GET`/`PATCH`/`DELETE` hàng loạt, `PATCH /:pk` multipart gọi
  `uploadOne(stream, payload, pk)` rồi `updateOne(pk, {})`, `POST /import` Joi.
- [X] T024 [P] [US1] `apps/api/src/controllers/assets.controller.test.ts` phần không transform: `useCollection`, chuỗi
  kiểm query với query rỗng, CSP header theo `ASSETS_CONTENT_SECURITY_POLICY_*`, `Vary`, `Range` parse, `HEAD` 200 không
  body, `Content-Disposition` inline/attachment, revalidate `304`, lỗi stream `500` JSON, route `:pk{/:filename}` và
  `OPTIONS`.

### Implementation for User Story 1

- [X] T025 [US1] Port `apps/api/src/controllers/files.controller.ts` từ `directus/api/src/controllers/files.ts`:
  `multipartHandler` giữ nguyên làm `RequestHandler` chạy qua `runMiddleware`; mọi route theo contracts/files-api.md
  §1 (kể cả `POST /import`, `SEARCH`); `res.locals['payload']` rồi `respond`; đăng ký trong `app.module.ts` với
  `useCollection('directus_files')` (thứ tự: sau `AssetsController`, chừa chỗ `TusController` của US4). Test T023 xanh.
  Ghi manifest. (sau T017)
- [X] T026 [US1] Port `apps/api/src/controllers/assets.controller.ts` từ `directus/api/src/controllers/assets.ts`:
  `GET :pk{/:filename}` ba bước (kiểm query với settings, `helmet.contentSecurityPolicy`, phục vụ), `POST folder/:pk`,
  `POST files` (zod), `HEAD`; đăng ký đầu tiên trong `app.module.ts` với `useCollection('directus_files')`. Test T024
  xanh. Ghi manifest. (sau T017)
- [X] T027 [US1] `tests/parity/src/normalizers.ts` thêm chuẩn hóa `ETag`, `Last-Modified` theo `modified_on` của dòng từng
  app và tên zip `-<datetime>`; `tests/parity/src/parity.ts` `COMPARED_HEADERS` thêm `Content-Disposition`,
  `Accept-Ranges`, `Content-Range`, `Vary`, `Content-Security-Policy`, `Cache-Control` (khi ca yêu cầu); so body nhị phân
  bằng sha256; `tests/parity/src/request-set.ts` thêm `GET /files`, `GET /files/:id`, `GET /assets/:id` cho
  `db-unchanged`, `readonly-account`. Chạy `parity --vendor=postgres` (`full`, `PARITY_STORAGES=local,s3`) và `reduced`
  MySQL, SQLite (`PARITY_STORAGES=s3`): T020 đến T022 xanh. (sau T025, T026)

**Checkpoint**: US1 kiểm độc lập xanh; kiểm tay quickstart §2 (dòng 1 và tải file gốc) đúng.

---

## Phase 4: User Story 3 - Quản lý file và thư mục (Priority: P1)

**Goal**: `/folders` CRUD, `GET /files` với query, đổi `filename_disk`, zip thư mục và nhóm file, ghi lồng qua `/items`
đi qua `FilesService` (FR-016, FR-017, FR-020, FR-021, FR-041).

**Independent Test**: `parity --vendor=postgres` với `src/files/{folders,files,zip,nested-files,e2e-files}.test.ts`.

### Tests for User Story 3

- [X] T028 [P] [US3] `tests/parity/src/files/folders.test.ts`: CRUD, `meta`, `SEARCH`, `OPTIONS`; xóa thư mục có file
  (`folder` về `null`, `storage_default_folder` về `null`); xóa thư mục còn con (đo status trên Directus ở Postgres,
  MySQL, SQLite, ghi vào spec FR-021 thay "đo ở task", so với app mới); quyền.
- [X] T029 [US3] `tests/parity/src/files/files.test.ts` phần quản lý: `GET /files` với `filter[folder]`, `search`,
  `sort`, `fields`, `meta=*`, `aggregate`; `PATCH /files/:id` đổi `filename_disk` (đích chưa có → object chuyển; đích đã
  có → trỏ lại, object gốc giữ; mọi object cùng tiền tố `thư mục/tên` bị xóa; tên có thư mục con), đổi nhiều file `400`;
  sửa `title`, `tags`, `focal_point_*`, `folder`; metadata ảnh (`width`, `height`, `metadata` theo
  `FILE_METADATA_ALLOW_LIST` mặc định, IPTC → `description`, `title`, `tags`, EXIF orientation 6 đổi chỗ) so dòng.
  `FILES_DELETE_ORIGINAL_ON_MOVE=true` chỉ kiểm unit (T012). (sau T020)
- [X] T030 [P] [US3] `tests/parity/src/files/zip.test.ts`: `POST /assets/folder/:pk` (cây hai cấp, hai file cùng tên
  trong một thư mục, file và thư mục con cùng tên), `POST /assets/files` (`ids` hai thư mục cùng tên file), so danh
  sách entry và sha256 từng entry (giải nén bằng `yauzl`, thêm devDependency vào
  `tests/parity`), header `Content-Type`, `Content-Disposition` (chuẩn hóa thời điểm), body sai `400`, không quyền
  `403`.
- [X] T031 [P] [US3] `tests/parity/src/files/nested-files.test.ts`: collection người dùng có m2o `image` và m2m `files`
  tới `directus_files` (dựng qua API 006 ở Directus, cùng tên `parity_files_*`); ghi lồng tạo file thiếu `type` → lỗi
  như Directus, sửa `title` lồng; `PATCH /users/me` `avatar` lồng; so dòng (FR-017).
- [X] T032 [P] [US3] `apps/api/src/controllers/folders.controller.test.ts` (supertest): mọi route, `validateBatch`,
  `Forbidden` khi đọc lại → `204`.

### Implementation for User Story 3

- [X] T033 [US3] Port `apps/api/src/controllers/folders.controller.ts` từ `directus/api/src/controllers/folders.ts`;
  đăng ký cuối trong `app.module.ts` với `useCollection('directus_folders')`. Test T032 xanh. Ghi manifest. (sau T017)
- [X] T034 [US3] Viết lại `directus/tests/e2e/tests/endpoints/files/files.test.ts` và `old.test.ts` thành
  `tests/parity/src/files/e2e-files.test.ts` theo `scenario()` (header `// Ported from directus/tests/e2e/...`, giữ
  nguyên assert, fixture từ `tests/parity/fixtures/assets/`). Chạy `parity --vendor=postgres` `full`: T028 đến T031,
  T034 xanh. (sau T033)

**Checkpoint**: US3 xanh; app Directus qua proxy (`env-up --profiles=app`) duyệt được module Files với route về app mới
(kiểm tay: tạo thư mục, tải lên, di chuyển, xóa).

---

## Phase 5: User Story 2 - Transform ảnh với file phát sinh dùng chung (Priority: P1)

**Goal**: Transform cùng tên object và cùng byte với Directus; app kia dùng lại file đã sinh; chế độ, preset, giới hạn,
`format=auto` như Directus (FR-034 đến FR-040, SC-004, SC-005).

**Independent Test**: `parity --vendor=postgres` với `src/files/{transform-matrix,assets,e2e-assets}.test.ts`.

- [ ] T035 [US2] `tests/parity/src/files/transform-matrix.test.ts` (so cả `Content-Type` sau đổi định dạng, FR-039):
  **ca đầu** tải `fixtures/assets/image.jpg` ở mỗi app
  và so output của `?width=50` (và các ca khác của e2e `assets.test.ts`) với `img_50x50.jpg`... của Directus (R2); lệch
  thì dừng, ghi sha256, kích thước, `sharp.versions` của hai image vào "Ghi chú khi làm", hỏi tech lead
  (Clarifications), không làm tiếp phase này. Nếu trùng: ma trận bộ ảnh T005 × (`fit` 4 × `format` 6 gồm `auto` với ba
  `Accept` × `quality` 2 × `withoutEnlargement` × focal point (file và query, `0`) × `transforms` nhiều bước × preset
  `system-*` và preset settings): sinh ở A, chụp tên object và sha256 bằng `storage-capture`, `deleteDerived`, sinh ở B,
  so; gọi B khi A đã sinh và khẳng định không object mới (SC-005); ca song song hai app cùng URL chưa sinh (R-17: chỉ
  so trạng thái cuối); ảnh 7000×100 và jpeg cắt cụt trên cặp `assets-limit`; ảnh có `width`/`height` trong dòng nhỏ hơn
  thật (sửa dòng bằng `PATCH`) đo status (`500`, ghi vào spec FR-037 thay "đo ở task"). Bằng chứng R-17 vào spec. (sau
  T027)
- [ ] T036 [US2] `tests/parity/src/files/assets.test.ts` phần transform: `ASSET_TRANSFORM_QUERY_KEYS` (key lạ bị bỏ),
  `transforms` không phải mảng, quá `ASSETS_TRANSFORM_MAX_OPERATIONS`, method lạ, tham số sharp sai (`400`); ba chế độ
  `storage_asset_transform` × `key` có/không/lạ × tham số tự do (sửa `directus_settings` qua Directus, trả lại sau);
  `transforms=[]` vượt chế độ (R-16, bằng chứng vào spec); `withoutEnlargement=false` cùng tên object; file không phải
  ảnh (pdf, svg, gif) trả nguyên bản; `format=auto` ba `Accept` với `Vary`; trên cặp `assets-stress`: `503` busy
  (`MAX_CONCURRENT=1`, hai request song song), `503` timeout (`100ms`, không còn object dở); trên cặp `assets-limit`:
  `HEAD` với transform sinh file (chụp storage). (sau T021)
- [ ] T037 [P] [US2] `apps/api/src/controllers/assets.controller.test.ts` phần transform: ba chế độ, `transforms=[]`,
  gộp preset với query, `format=auto` theo `Accept`, `Range` bị bỏ khi có transform (cùng file với T024 của US1).
- [ ] T038 [P] [US2] Viết lại `directus/tests/e2e/tests/endpoints/assets/assets.test.ts` thành
  `tests/parity/src/files/e2e-assets.test.ts` theo `scenario()`, giữ `toMatchFile` với fixture (so byte).
- [ ] T039 [US2] Sửa lệch phát hiện ở T035 đến T038 trong `assets.service.ts`, `transformations.ts`,
  `assets.controller.ts` (chỉ lỗi port, không đổi hành vi); chạy `parity --vendor=postgres` `full` và `reduced` MySQL,
  SQLite: phase xanh. (sau T035 đến T038)

**Checkpoint**: SC-004, SC-005 đo được trên Postgres cả hai storage; quickstart §2 dòng 2, 3 in `SAME`.

---

## Phase 6: User Story 4 - Upload resumable qua TUS (Priority: P2)

**Goal**: `/files/tus` khi `TUS_ENABLED`, khóa Redis, lịch dọn đồng bộ, tiếp tục upload ở app kia (FR-050 đến FR-054).

**Independent Test**: `parity --vendor=postgres` với `src/files/tus.test.ts` trên cặp `assets-limit` (TUS bật),
`assets-stress` (hết hạn), `cors-hsts` (`OPTIONS` khi CORS bật) và ca
`TUS_ENABLED=false` trên cặp chính.

- [ ] T040 [P] [US4] `tests/parity/src/files/tus.test.ts` (cặp `assets-limit` cho mọi ca trừ hết hạn; cặp
  `assets-stress` cho ca hết hạn; `tus-js-client` và request thô): `POST`
  với `Upload-Length`, `Upload-Metadata` → `201`, `Location` theo `PUBLIC_URL`, dòng có `tus_id`, `tus_data`; `GET
  /files` ẩn, `GET /files/:pk` và `GET /assets/:pk` `403`; `HEAD` offset; `PATCH` xen kẽ Directus/app mới trên `local`
  và `s3` với chunk đúng `TUS_CHUNK_SIZE` (file 20 MB), hoàn tất: `Directus-File-Id`, `tus_id` null, metadata ảnh (event
  `files.upload` chỉ kiểm ở unit test T041, bộ đối chiếu không quan sát được event); mỗi chunk cập nhật
  `modified_on`; thay file `replace_id` (object cũ và file phát sinh theo tiền tố khóa chính bị xóa, đuôi giữ nguyên,
  dòng tạm mất); user khác `HEAD` → lỗi, role public không lọc; `Upload-Length` quá `FILES_MAX_UPLOAD_SIZE` (profile có
  `FILES_MAX_UPLOAD_SIZE=30mb`, đo `413`, ghi spec FR-050), thiếu `filename_download` `400`, thay file đang dở `400`,
  `Upload-Metadata` hỏng `400`; `OPTIONS /files/tus/:id` và `/files/tus` (CORS tắt, ghi header thật vào spec FR-050)
  và trên cặp `cors-hsts` (CORS bật: `204`, không header `Tus-*`, so với Directus); `DELETE /files/:id` bằng admin trên
  dòng đang tải dở: so status hai app, chụp storage (dòng mất, object dở còn: FR-015, ghi kết quả vào spec thay "đo ở
  task"); FR-053: trong lúc một `PATCH` lớn đang chạy ở app A, `redis-cli --scan --pattern 'directus:lock:*'` thấy key
  mang id upload, `HEAD` cùng id ở app B lúc đó trả như Directus (so status), xong thì key biến mất; R-18: `PATCH` 3 MiB
  trên `s3` → offset không tăng, gửi lại; trên cặp `assets-stress`: hết hạn `2s` và lịch `* * * * *` với
  `SYNCHRONIZATION_STORE=redis`: dòng và part mất, key `directus-sync:clock:tus-cleanup:*` trong Redis; cặp chính
  (`TUS_ENABLED=false`): `POST /files/tus` và `PATCH /files/tus/x` so với Directus (rơi vào `/files`). Bằng chứng R-18
  vào spec.
- [ ] T041 [P] [US4] `apps/api/src/controllers/tus.controller.test.ts` (supertest, `TUS_ENABLED=true` qua env của test):
  `checkFileAccess` (method → action, `metadata.id` → `update` với `primaryKeys`, field trong metadata, metadata hỏng
  `400 INVALID_METADATA`), handler gọi `createTusServer` rồi `handle`, `cleanup` luôn chạy; `OPTIONS /:id`; không đăng
  ký khi `TUS_ENABLED=false` (`app.module` test).
- [ ] T042 [US4] Port `apps/api/src/controllers/tus.controller.ts` từ `directus/api/src/controllers/tus.ts`
  (`checkFileAccess` giữ nguyên qua `runMiddleware`); `app.module.ts` đăng ký `TusController` trước `FilesController`
  chỉ khi `RESUMABLE_UPLOADS.ENABLED` với `useCollection('directus_files')`; `startup/run-startup-checks.ts` (hoặc
  `main.ts` theo tiền lệ metrics) gọi `schedules/tus.ts` sau `registerAuthProviders`; `router-options.ts` mẫu TUS có
  điều kiện (T018). Test T041 xanh; chạy T040 trên Postgres (cả hai storage) và MySQL, SQLite (`s3`). Ghi manifest.
  (sau T016, T017, T025)

**Checkpoint**: US4 xanh; `tests/parity/src/items/blackbox` chưa cần.

---

## Phase 7: User Story 5 - Import file từ URL (Priority: P2)

**Goal**: `POST /files/import` với kiểm IP, giải nén, chuyển hướng, mime (FR-060, FR-061).

**Independent Test**: `parity --vendor=postgres` với `src/files/import.test.ts` (cần `files-fixtures`).

- [ ] T043 [P] [US5] `tests/parity/src/files/import.test.ts`: import `http://files-fixtures/photo.jpg` (so dòng và object
  với upload multipart cùng file), `/gz/photo.jpg.gz` (giải nén), `/redirect/` (tên theo URL cuối), `data`
  (`title`, `folder`, `id` thay file), `options.filterMimeType` khớp/không, URL thiếu `400`; chặn:
  `http://127.0.0.1:8055/`, `http://169.254.169.254/`, `http://[::1]/`, tên miền `localhost` → `503` không dòng; `ftp://`,
  `file:///etc/passwd`, URL hỏng → `503`; `data:image/png;base64,...` và URL có `%zz` (đo status trên Directus, ghi
  spec FR-060 thay "đo ở task"); URL không `Content-Type` và đường dẫn `/` (tên rỗng, đuôi theo mime); encoding `zstd`
  giả (nginx `add_header`) lưu nguyên; R-14: file 50 MB từ fixtures (sinh lúc chạy) import được không giới hạn (không đo
  treo). Bằng chứng R-14 vào spec.
- [ ] T044 [US5] `apps/api/src/controllers/files.controller.test.ts` thêm ca `POST /import`: Joi (`url` bắt buộc,
  `options.filterMimeType` mảng), gọi `importOne(url, data, options)`, `Forbidden` khi đọc lại → `204`. (cùng file với
  T023)
- [ ] T045 [US5] `tests/parity/src/files/cross-use.test.ts` thêm chiều import (import ở A, tải ở B, cả hai driver);
  `apps/api/src/request/is-denied-ip.test.ts` thêm ca `IMPORT_IP_DENY_LIST` rỗng (không chặn) và một mục hỏng (chặn tất)
  nếu test gốc chưa có; chạy `parity --vendor=postgres` `full`: T043 đến T045 xanh. (sau T043, T044)

**Checkpoint**: US5 xanh.

---

## Phase 8: User Story 6 - Cấu hình storage và vận hành (Priority: P2)

**Goal**: Biến `FILES_*`, `ASSETS_*`, `TUS_*`, `IMPORT_IP_DENY_LIST`, `SYNCHRONIZATION_*`, tùy chọn S3 sang nhóm A; kiểm
lại dừng khởi động với driver ngoài phạm vi, health, info với hai location (FR-070 đến FR-073, SC-006).

**Independent Test**: `pnpm nx run api:test` (config) và `parity --vendor=postgres` với `src/startup/storage.test.ts`.

- [ ] T046 [P] [US6] `apps/api/src/config/supported-variables.ts` thêm khối `// Feature 007` theo contracts/tus-storage.md
  §4 (25 mẫu, gồm `ASSETS_CONTENT_SECURITY_POLICY.*`, `STORAGE_.+_FORCE_PATH_STYLE`...); `supported-variables.test.ts`
  thêm ca từng biến thuộc nhóm A và `IMPORT_TIMEOUT`, `STORAGE_X_CONTAINER_NAME` vẫn nhóm C;
  `warn-unsupported-variables.test.ts` kiểm env của parity (`STORAGE_S3_FORCE_PATH_STYLE=true`) không còn cảnh báo.
- [ ] T047 [P] [US6] `tests/parity/src/startup/storage.test.ts` (sửa hoặc tạo): app mới khởi động với
  `STORAGE_LOCATIONS=local,s3,cloud` + `STORAGE_CLOUD_DRIVER=gcs` (container tạm qua `run-api.ts`) thoát mã 1 trước khi
  mở cổng, log có tên location, driver, danh sách hỗ trợ (SC-006, D-16); với `local,s3`: `/server/health` có hai key
  `storage:*:responseTime` ở cả hai app, `/server/info` `uploads` như Directus (`FILES_MAX_UPLOAD_CONCURRENCY`,
  `TUS_ENABLED`), upload không `storage` vào `local`, `storage=s3` vào `s3` (US6 ca 1); log khởi động không còn cảnh
  báo các biến của T046 (so với Directus không có dòng này: D-18).

**Checkpoint**: US6 xanh.

---

## Phase 9: User Story 7 - Bộ test file, asset của Directus chạy qua trên app mới (Priority: P2)

**Goal**: 8 file blackbox port chạy hai lượt theo app trên cả hai storage; CI theo Clarifications (FR-081, SC-001).

**Independent Test**: `parity-blackbox --vendor=postgres` (`PARITY_STORAGES=local,s3`) và MySQL, SQLite (`s3`).

- [ ] T048 [US7] Shim `tests/parity/src/items/blackbox/common/config.ts`: `getStorages()` đọc `PARITY_STORAGES`
  (`local,s3`), bảng `nodeUrl` thêm cặp `assets-limit`; `config.test.ts` thêm ca; `global-setup` đặt URL cặp mới.
- [ ] T049 [P] [US7] Port `directus/tests/blackbox/tests/common/assets/{read,format,limit,concurrency,cache-revalidate}.test.ts`
  vào `tests/parity/src/items/blackbox/tests/common/assets/` (sửa `// Backoffice:`: `storages` → `getStorages()`, URL
  qua shim, `limit`, `concurrency`, `cache-revalidate` dùng cặp `assets-limit` qua `nodeUrl`; fixture ảnh copy kèm).
  Ghi manifest. (sau T048)
- [ ] T050 [P] [US7] Port `directus/tests/blackbox/tests/db/routes/files/{storage,tus}.test.ts` vào
  `tests/parity/src/items/blackbox/tests/db/routes/files/` (`storages` → `getStorages()`, `tus` dùng cặp `assets-limit`,
  `tus-js-client`). Ghi manifest. (sau T048)
- [ ] T051 [P] [US7] Port `directus/tests/blackbox/tests/db/routes/collections/files.test.ts` và, nếu 001 chưa port,
  `tests/db/routes/server/health.test.ts` vào cùng cây. Ghi manifest. (sau T048)
- [ ] T052 [US7] CI: `.github/workflows/ci.yml` job `parity` (Postgres `full` hai shard: thêm profile `assets-limit`,
  `assets-stress`, `PARITY_STORAGES=local,s3`; MySQL, SQLite `reduced`: `PARITY_STORAGES=s3`), job `parity-blackbox`
  (profile `assets-limit`, `PARITY_STORAGES=local,s3`); `parity-matrix.yml` và `nightly.yml` đặt `PARITY_STORAGES=local,s3`;
  `tools/ci-local.sh` bước tương ứng. Chạy `parity-blackbox --vendor=postgres` hai lượt và `reduced` MySQL, SQLite; ca
  fail trên chính Directus ở một vendor hoặc storage → `it.skipIf` kèm ghi chú tên ca, vendor, storage (Assumptions);
  ghi danh sách vào "Ghi chú khi làm". (sau T049 đến T051)

**Checkpoint**: CI `parity`, `parity-blackbox` xanh trên push.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Playwright module Files, benchmark, README, sổ khác biệt, đóng feature (FR-083, FR-084, research R9, R10,
R12).

- [ ] T053 [P] `tests/directus-app-e2e/src/files.spec.ts` (Playwright qua proxy, profile `app`): tải lên qua input file,
  import URL `http://files-fixtures/photo.jpg`, xem trước (thumbnail `system-*` tải về `200`), sửa title, tạo thư mục, di
  chuyển, xóa, tải zip thư mục; `items.spec.ts` thêm ca layout cards hiển thị thumbnail; `routing.spec.ts` thêm `/files`,
  `/folders`, `/assets` về app mới (`proxy-log`).
- [ ] T054 [P] `tests/benchmark/src/files.ts` và `seed-files.ts` (200 ảnh jpeg ~1 MB sinh bằng sharp lúc seed, 1.000
  dòng file nhỏ, user đọc 50%): năm kịch bản theo contracts/parity.md §6 (`asset-transform` `deleteDerived` trước mỗi
  vòng, `connections: 10`); `tests/benchmark/project.json` target `files`; `.github/workflows/benchmark.yml` job
  `benchmark-files`; chạy một lần cục bộ, ghi p95, req/s và thời lượng job vào "Ghi chú khi làm".
- [ ] T055 [P] `tests/parity/README.md` mục 007 (storage `local` dùng chung, `PARITY_STORAGES`, `files-fixtures`, cặp
  `assets-limit`, cách chạy ma trận transform); kiểm `quickstart.md` chạy được từng lệnh, sửa nếu lệch.
- [ ] T056 [P] Sổ khác biệt: `tests/parity/accepted-differences.ts` xóa entry `D-09.5`, sửa entry `D-31` bỏ
  `directus_files`, `directus_folders`; `specs/001-platform-foundation/spec.md` dòng D-09.5 ghi "Gỡ ở 007";
  `specs/004-permissions/spec.md` dòng D-31 thu hẹp; bảng "Khác biệt" và "Rủi ro" của `specs/007-files-assets/spec.md`
  đủ bằng chứng R-13 đến R-18 (ngày đo, ca test); `guard-differences` xanh. (commit đóng feature, sau mọi phase)
- [ ] T057 [P] `graphify update .` sau khi code xong; `pnpm run ci:local` một lượt đủ; kiểm coverage `apps/api` ≥ 80%.
- [ ] T058 Đóng feature: `specs/007-files-assets/spec.md` `Status: Done`, dòng "Duyệt khác biệt" (tech lead duyệt gỡ
  D-09.5, thu hẹp D-31, R-13 đến R-18); `plan.md` ghi kết quả benchmark và sharp.versions; CLAUDE.md "Recent Changes"
  thêm 007; memory dự án. (sau T053 đến T057)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T002 đến T008 song song sau T001 (T004 đến T006 cùng sửa `docker-compose.yml`: làm nối tiếp
  hoặc một người).
- **Phase 2 (Foundational)**: sau Phase 1. T009, T010, T011, T013, T015 song song; T012 sau T009, T011; T014 sau T010,
  T012, T013; T016 sau T012, T015; T017 sau T012 đến T016; T018, T019 độc lập (cần env đã lên). CHẶN mọi story.
- **Phase 3 (US1)**: sau Phase 2. T020 đến T024 song song; T025, T026 sau T017; T027 cuối.
- **Phase 4 (US3)**: sau US1 (dùng `files.test.ts`, `AssetsController`). T028, T030, T031, T032 song song; T029 sau
  T020; T033 sau T032; T034 cuối.
- **Phase 5 (US2)**: sau US1 (`AssetsController`). T035 đầu tiên (cổng byte); T036 sau T021; T037 sau T024; T038 song
  song; T039 cuối.
- **Phase 6 (US4)**: sau Phase 2 và T025 (thứ tự controller). T040, T041 song song; T042 sau.
- **Phase 7 (US5)**: sau US1 (`FilesController` có `/import`). T043 song song với T044; T045 sau.
- **Phase 8 (US6)**: sau Phase 2; T046, T047 song song; có thể chạy song song với US2 đến US5.
- **Phase 9 (US7)**: sau US1, US2, US4 (blackbox assets, storage, tus). T048 trước; T049 đến T051 song song; T052 cuối.
- **Phase 10 (Polish)**: T053 đến T057 song song sau US7; T058 sau tất cả.

### Within Each User Story

- Test đối chiếu và test controller viết trước, đỏ, rồi controller.
- Test gốc port trước, đỏ, rồi code (T012, T014, T016).
- Mỗi story kết thúc bằng một lượt `parity` đủ ở Postgres (hai storage) và rút gọn ở MySQL, SQLite (`s3`).
- Mục spec ghi "đo ở task" được đo trong task test tương ứng và ghi lại vào spec ngay trong task đó.

### Parallel Opportunities

- Phase 1: T002, T003, T007, T008 song song với nhau và với T004 đến T006.
- Phase 2: T009, T010, T011, T013, T015, T018, T019 song song.
- US1: T020 đến T024 song song; T025, T026 song song.
- US3: T028, T030, T031, T032 song song; US3 có thể bắt đầu test khi US1 đang làm controller.
- US2: T037, T038 song song với T035, T036.
- US4: T040, T041 song song; US4 và US5, US6 song song với nhau sau US1.
- US7: T049 đến T051 song song.
- Polish: T053 đến T057 song song.

---

## Parallel Example: User Story 1

```bash
# Test viết trước, song song:
Task: "files.test.ts phần tải lên và xóa (T020)"
Task: "assets.test.ts phần file gốc (T021)"
Task: "cross-use.test.ts multipart, JSON (T022)"
Task: "files.controller.test.ts (T023)"
Task: "assets.controller.test.ts phần không transform (T024)"

# Rồi hai controller song song:
Task: "files.controller.ts (T025)"
Task: "assets.controller.ts (T026)"
```

## Parallel Example: Phase 2

```bash
# Port nguyên, song song:
Task: "request/* (T009)"
Task: "transformations (T010)"
Task: "files/lib, files/utils (T011)"
Task: "folders.service (T013)"
Task: "synchronization, scheduleSynchronizedJob (T015)"
Task: "đo OPTIONS, router-options (T018)"
Task: "storage-capture.ts (T019)"
```

---

## Implementation Strategy

### MVP (Phase 1 đến 5)

1. Phase 1, 2: thư viện (sharp trên alpine kiểm ngay ở T001), môi trường hai storage, service với test gốc xanh,
   factory, `OPTIONS`, `storage-capture`.
2. US1: `/files` upload, `/assets` tải; dùng chéo hai chiều trên hai driver; R-13, R-15 đo.
3. US3: `/folders`, quản lý file, zip, ghi lồng.
4. US2: cổng byte với fixture e2e (T035) rồi ma trận transform; SC-004, SC-005.
5. **DỪNG và kiểm**: `parity` Postgres `full` hai storage, MySQL và SQLite `reduced` xanh; quickstart §2 in `SAME`;
   module Files của app Directus qua proxy dùng được (kiểm tay).

### Phần còn lại (Phase 6 đến 10)

1. US4: TUS, lịch dọn, synchronization; xen kẽ chunk hai app.
2. US5: import, kiểm IP; R-14 đo.
3. US6: nhóm A env, startup với driver ngoài phạm vi, health, info.
4. US7: blackbox 8 file, CI.
5. Polish: Playwright, benchmark, README, sổ khác biệt, đóng feature.

---

## Notes

- [P] = khác file, không phụ thuộc task chưa xong.
- [US#] để truy vết task về story.
- Mỗi story kiểm độc lập được bằng suite của nó; commit sau mỗi task hoặc nhóm task; dừng ở checkpoint để kiểm.
- Không có khác biệt mới; R-13 đến R-18 là hành vi không an toàn của Directus được tái tạo có chủ ý, mỗi R có một ca
  thể hiện và bằng chứng đo.
- Byte ảnh lệch ở T035 là điểm dừng duy nhất cần tech lead quyết trước khi làm tiếp (Clarifications).
- Tránh: task mơ hồ, hai task cùng sửa một file song song (T020/T029, T021/T036, T023/T044, T024/T037 làm nối tiếp),
  phụ thuộc chéo story làm mất tính độc lập.

## Ghi chú khi làm

- T001: `pnpm audit --prod --audit-level=high` báo 17 advisory high, đều từ hai gói cùng bản Directus: `sharp` 0.34.5 (3)
  và `axios` 1.15.0 (14). Đo trước khi quyết: sharp 0.34.5 cục bộ (darwin-arm64) trùng 4/4 fixture ảnh của
  `directus/tests/e2e/tests/endpoints/assets/`; sharp 0.35.5 (libvips 8.18.7) trùng ở jpeg, webp, png, grayscale nhưng
  khác byte ở avif, tiff. Chủ dự án chọn giữ cả hai (2026-10-13): 17 GHSA vào `auditConfig.ignoreGhsas` kèm comment,
  dòng Complexity Tracking ở plan; audit exit 0 sau đó.
- T001: image `hiennd23/backoffice-api:local` build được trên linux/amd64. Cả image app mới và `directus/directus:11.17.4`
  dùng đúng `sharp@0.34.5`, `@img/sharp-linuxmusl-x64@0.34.5`, `@img/sharp-libvips-linuxmusl-x64@1.2.4`; app mới in
  `vips 8.17.3, heif 1.20.2, aom 3.13.1, mozjpeg 0826579, webp 1.6.0, tiff 4.7.1` (cơ sở cho research R2).
- T002: `libs/types` thêm `sharp` vào `dependencies` (Directus để là peer tùy chọn) theo tiền lệ `deep-diff` của 006.
- T003: không ghi manifest cho `constants.ts` (port từng phần, comment trong file dẫn nguồn), như 006.
- T004: không cần chmod: named volume `uploads` lấy quyền thư mục `/directus/uploads` của image (uid `node` ở cả hai
  image); đo trên Postgres: Directus ghi được vào `local` và `s3`, app mới `touch` được trong volume. Anchor `x-app` và
  34 service cặp profile đều mount volume (test trong `vendors.test.ts`).
- T005: sinh fixture bằng `tests/parity/fixtures/make-images.mjs` (sharp, devDependency của `tests/parity`); ảnh IPTC
  đo trên Directus: `description` = caption, `tags` = keywords, `title` vẫn từ tên file (multipart đặt `title` trước khi
  trích). `layers.png` (883 KB) copy nguyên từ blackbox Directus vì `concurrency.test.ts` dùng nó (vượt mức 200 KB).
  Chạy local không đặt `DOCKER_DEFAULT_PLATFORM` (image MinIO chỉ có arm64 trên máy): image app mới chạy arm64 cục bộ,
  amd64 trên CI.
- T006: `profile-blackbox.env` thêm `ASSETS_TRANSFORM_MAX_CONCURRENT=2`, `TUS_ENABLED=true` (phần còn lại của
  `directus/tests/blackbox/common/config.ts` mà các file files, assets đọc) nên 8 file blackbox chạy trên cặp `blackbox`;
  `assets-limit` là nút revalidate của `cache-revalidate.test.ts`, `assets-stress` (thêm `ASSETS_CACHE_TTL=1h`) là nút
  mặc định của file đó. Cả hai cặp đọc thêm `profile-blackbox.env`.
- T009 đến T016: số test gốc port: `request/*` 19, `transformations` + metadata 19, `files.service` 40,
  `folders.service` + `name-deduper` 37, `assets.service` 19, `schedule` 7, `tus/server` 2. Thêm theo Directus:
  `sanitize-filename` 1.6.3 (dùng bởi `NameDeduper`), type `Folder`, `test-utils/{env,storage}.ts`,
  `test-utils/services/{files,folders}-service.ts`. Test mới: `synchronization` 3, `tus/data-store` 10, `tus/lockers` 4,
  `schedules/tus` 3. Ghi nhận khi viết test: TUS đặt `title = formatTitle(filename_download)` giữ cả đuôi ("Photo.jpg"),
  multipart bỏ đuôi; `parseIptc` của Directus bỏ qua marker IPTC đầu tiên (fixture có dòng ApplicationRecordVersion).
- T017: toàn bộ `apps/api` sau Phase 2: 239 file, 2.664 test xanh, coverage 85,84%.
- T018: đo `OPTIONS` (bảng ở contracts/files-api.md §4); `access-control-allow-headers` của @tus/server trong Directus bị
  tách từng ký tự (chuỗi `CORS_ALLOWED_HEADERS` trải vào mảng), port nguyên nên tái tạo. Semgrep đỏ từ commit đóng 006
  (`apps/api/test/data-model-app.ts`, JWT ký bằng secret test) sửa bằng `nosemgrep` có lý do, theo tiền lệ `sso.ts`.
- T019: `storage-capture` dùng `@aws-sdk/client-s3` trực tiếp (thay `@backoffice/storage-driver-s3`): cần
  `ContentType` của object; `local` đọc qua `docker compose exec directus` (`find`, `sha256sum`, `stat`).
- T020 đến T027: D-09.5 đang chấp nhận mọi khác biệt của `/files`, `/folders`, `/assets` nên `parity()` trên các route
  đó không so gì; thu hẹp entry về các route chưa làm (`/folders`, `/files/tus`), entry vẫn còn tới khi spec Done
  (guard). Kiểm bằng test tạm: chỉ D-01 được chấp nhận. Đo trên Directus 11.17.4 (T020): FR-003 multipart một file
  1 activity `create` + 1 revision, thay file thêm 2 `update` + 2 revision; FR-011 `<id>.false` với mime lạ; R-13 xóa
  `<prefix>.jpg` xóa luôn `<prefix>graphy.jpg` của file khác (ca `files.test.ts` "R-13"). Thứ tự `data` khi tải nhiều
  file theo thứ tự upload xong, không xác định ở cả hai app: test sắp theo `filename_download`. `parity.ts` so body
  nhị phân bằng sha256 và gửi body Buffer (multipart); `COMPARED_HEADERS` thêm `accept-ranges`, `content-range`.
  T024 ghi nhận: admin của test không có role nên `Cache-Control: public` (getCacheControlHeader xét role).
- T028 đến T034: D-09.5 thu hẹp tiếp, chỉ còn `/files/tus`. Đo trên Directus 11.17.4 (Postgres): xóa thư mục còn
  thư mục con trả `500 INTERNAL_SERVER_ERROR` với message là câu lỗi khóa ngoại của DB ở cả hai app (spec FR-021); zip
  thư mục đặt entry dưới tên thư mục gốc, file trùng tên thêm ` (1)` sau đuôi, file và thư mục con cùng tên (`photos`)
  không khử trùng (FR-041). Zip so bằng `fflate` 0.8.3 (đã có trong lockfile, devDependency của `tests/parity`).
  `meta=*` của `/folders` có `total_count` đếm cả thư mục của lượt chạy trước: test dùng `meta=filter_count`. Hai file
  e2e `files` viết lại thành `e2e-files.test.ts`, `e2e-files-old.test.ts` (12 ca, cả hai app, hai storage). Proxy:
  `files`, `folders`, `assets` thêm vào `backoffice-routes.txt`. Playwright chưa chạy cục bộ (máy chưa có trình duyệt
  Playwright, cài cần tải về): job `e2e-directus-app` của CI kiểm.
- T008: dòng `files`, `folders`, `assets` của `proxy/backoffice-routes.txt` thêm ở T034 (khi đủ controller US1, US3),
  để E2E app Directus không gọi route chưa có; test định tuyến đã có ở `proxy-conf.test.ts`. Đã thêm ở T034.
