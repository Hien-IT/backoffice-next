# Implementation Plan: Files, folders, assets (`/files`, `/folders`, `/assets`, TUS)

**Branch**: `007-files-assets` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-files-assets/spec.md`

## Summary

App mới có `/files` (multipart, JSON, import từ URL, TUS), `/folders`, `/assets` (tải, `Range`, revalidate, transform,
zip) giống hệt Directus 11.17.4, ghi `directus_files`, `directus_folders` bằng cùng dòng và object trên storage dùng
chung (`local`, `s3`) bằng cùng tên, kể cả file phát sinh (`<id>__<object-hash>.<ext>`), nên file tải lên ở app này
xem, tải, transform, thay, xóa được ở app kia và URL asset có transform trả cùng byte. Gỡ D-09.5, thu hẹp D-31.

Cách làm:

- Port nguyên, cùng đường dẫn, kèm test gốc: `FilesService`, `FoldersService`, `AssetsService`, `files/{lib,utils}`,
  `tus/*`, `transformations`, `request/*`, `synchronization`, `scheduleSynchronizedJob`, `schedules/tus`; thêm
  `sharp` 0.34.5, `@tus/server` 2.3.0 và các thư viện cùng bản Directus (research R1, R3); `libs/storage*`, `useLock`,
  `getCacheControlHeader`, `getConfigFromEnv`, startup kiểm driver (D-16) đã có từ 001, 002.
- Bốn controller Nest mỏng theo thứ tự `app.ts` của Directus (`assets`, `files/tus` khi `TUS_ENABLED`, `files`,
  `folders`); `multipartHandler` qua `runMiddleware` như `schemaMultipartHandler` của 006; `@tus/server` chạy trong
  handler Nest; `router-options` thêm mẫu (R4, R5, contracts/files-api.md, assets.md, tus-storage.md).
- Bộ đối chiếu: môi trường thêm location `local` trên named volume dùng chung, server fixture cho import, cặp profile
  `assets-limit` và `assets-stress`; `tests/parity/src/files/` với ma trận transform so tên object và byte (ca đầu so với fixture e2e của
  Directus, R2), dùng chéo hai chiều hai driver, TUS xen kẽ chunk giữa hai app; port 8 file blackbox và 3 file e2e;
  Playwright module Files; benchmark năm kịch bản gồm sinh transform mới (R6 đến R10, contracts/parity.md).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

Stack theo prompt của chủ dự án (SPECKIT-GUIDE) và cách feature này đáp ứng:

| Yêu cầu | Ở feature 007 |
|---------|---------------|
| Node 22, pnpm 10, Nx, `apps/api` NestJS strict | Giữ như 001 đến 006; `sharp` thêm vào `onlyBuiltDependencies` như Directus (R1, R2) |
| Knex với dialect như `directus/api/src/database/helpers` | Không DDL; ghi qua `ItemsService` (004, 005); `FilesService extends ItemsService` |
| Cache, bus Redis cùng key và kênh Directus | Khóa TUS qua `useLock()` (`directus:lock`, key = id upload); clock lịch dọn `directus-sync:clock:tus-cleanup:<cron>` khi `SYNCHRONIZATION_STORE=redis`; response cache của `/files` như 005; không key mới (R5) |
| Validate bằng Joi hoặc Zod giống Directus | Joi `importSchema`, zod `{ids}` của zip, kiểm query asset của Directus giữ nguyên |
| Port từ `directus/api/src`, ghi đường dẫn gốc | Bảng ánh xạ file port; manifest `tools/port-manifest/007-T*.json`; guard `check-port-headers` |
| Thư viện nội bộ `@backoffice/*` | `@backoffice/storage*`, `format-title`, `utils/node` (`IpBlocklist`) đã có; `@backoffice/types` thêm `assets.ts`, `files.ts` nếu thiếu |
| Env port từ `packages/env`, không đổi tên biến | Không biến mới; 25 biến `FILES_*`, `ASSETS_*`, `TUS_*`, `IMPORT_IP_DENY_LIST`, `SYNCHRONIZATION_*`, tùy chọn S3 sang nhóm A (R11) |
| Mỗi service Directus một provider, controller mỏng | `FilesService`, `FoldersService`, `AssetsService` qua `ServiceFactory` trong `providers.ts`; `createTusServer` là hàm (như Directus); bốn controller chỉ parse, chạy middleware, gọi service, `respond` (R4) |
| Vitest; test đối chiếu copy từ `directus/tests/blackbox`; Compose Postgres, MySQL, SQLite, Redis | R6 đến R8, contracts/parity.md; 8 file blackbox + 3 e2e; profile `assets-limit`; MinIO đã có, thêm `local` và `files-fixtures` |
| GitHub Actions, coverage BE 80% | contracts/parity.md §4; R13 |

**Language/Version**: TypeScript 5.9.3 (bộ cờ strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS, ESM, pnpm
10.27.0, Nx 23.3. Giữ như 001 đến 006.

**Primary Dependencies**:
- Đã có: NestJS 12 (Express 5.2.1), knex 3.1.0, `@backoffice/storage` (Driver, TusDriver, `supportsTus`),
  `@backoffice/storage-driver-local`, `-s3` (`@aws-sdk/client-s3`, `lib-storage` 3.928.0, `@tus/utils` 0.6.0),
  `@backoffice/memory`, `useLock`, `getStorage`, `validateStorageDrivers`, `validateStorage`, `getCacheControlHeader`,
  `getConfigFromEnv`, `validateEnv`, `validateCron`, `ItemsService`, `PayloadService`, `MetaService`, `SettingsService`,
  `validateItemAccess`, `validateAccess`, `Emitter`, `respond`, `validateBatch`, `useCollection`, `runMiddleware`,
  `ServiceFactory`, busboy 1.6.0, object-hash 3.0.0, helmet 8.1.0, cron 4.3.4, bytes, ms, ip-matching 2.1.2, joi,
  zod 4.1.12, lodash-es, `@backoffice/format-title`, `IpBlocklist` (`@backoffice/utils/node`), axios 1.15.0 (dev →
  dependency).
- Thêm vào catalog, cùng bản Directus (R1): sharp 0.34.5, @tus/server 2.3.0, mime-types 3.0.1, content-disposition
  0.5.4, archiver 7.0.1, encodeurl 2.0.0, exif-reader 2.0.2, icc 3.0.0, minimatch 10.2.5, zod-validation-error (bản
  Directus) và `@types/*` tương ứng; devDependency `tus-js-client` (bản của blackbox Directus).
- Không thêm: multer, thư viện ảnh khác, thư viện zip khác, timeout cho import.

**Storage**:
- DB dùng chung; không DDL, không migration. Ghi `directus_files`, `directus_folders`, `directus_activity`,
  `directus_revisions` như Directus ([data-model.md](./data-model.md)).
- Storage dùng chung: object `filename_disk`, `temp_<filename_disk>`, file phát sinh `<tên>__<hash>.<ext>`,
  `directus-health-file`; driver `local` (volume dùng chung), `s3`; driver khác dừng khởi động (D-16).
- Redis dùng chung: khóa TUS (`directus:lock`), clock `directus-sync` (khi bật); không key mới.

**Testing**:
- Vitest 3.2.4: test gốc port kèm code (`files.service` 36, `folders.service` 13, `assets.service` 19, `tus/server` 2,
  `get-sharp-instance`, `get-metadata`, `transformations` 16, `request/*` 27); test mới cho bốn controller (supertest
  qua app Nest), `multipartHandler`, `checkFileAccess`, `synchronization`, `scheduleSynchronizedJob`, `router-options`
  (R13). Coverage 80% `apps/api`.
- `tests/parity/src/files/` (R8): `storage-capture.ts`, `files`, `folders`, `import`, `assets`, `transform-matrix`,
  `cross-use`, `tus`, `zip`, `e2e-files`, `e2e-assets`; `startup/storage.test.ts` sửa; `normalizers`, `request-set`
  sửa. Blackbox thêm 8 file với shim `getStorages()` và cặp `assets-limit` (R7, [contracts/parity.md](./contracts/parity.md)).
- `tests/directus-app-e2e`: `files.spec.ts`, `items.spec.ts` (thumbnail), `routing.spec.ts`, `backoffice-routes.txt` (R9).
- `tests/benchmark`: `files.ts`, `seed-files.ts`, job `benchmark-files` (R10).

**Target Platform**: Container Linux (`node:22-alpine`, cùng nền image Directus), nhiều replica cạnh Directus sau load
balancer, storage dùng chung. Giữ như 001.

**Project Type**: Monorepo web (Nx). Chạm `apps/api`, `libs/types` (type nếu thiếu), `tests/parity`,
`tests/directus-app-e2e`, `tests/benchmark`, CI, catalog, Dockerfile (chỉ nếu prebuilt sharp cần `apk` thêm; mặc định
không).

**Performance Goals**:
- SC-007: `asset-raw`, `asset-derived`, `asset-transform` (10 kết nối), `files-list` (admin, user), `files-upload`;
  p95 và req/s không tệ hơn Directus quá 10%; đo hằng tuần, không chặn CI (quyết định 003).
- SC-005: app kia không ghi object mới khi file phát sinh đã có (đo bằng liệt kê storage).

**Constraints**:
- Tên file phát sinh và byte ảnh trùng Directus: cùng `object-hash` trên cùng mảng bước, cùng sharp 0.34.5 trên cùng
  nền alpine (R2); lệch byte → bằng chứng và tech lead (Clarifications).
- Không thêm biến môi trường; không timeout import (R-14); xóa theo tiền tố (R-13); giới hạn transform theo process.
- Mọi file port ghi `// Ported from directus/...`; manifest `tools/port-manifest/007-T*.json`.
- Route tùy chọn `/assets/:pk/:filename?` theo cú pháp Express 5; thứ tự controller giữ `/files/tus` trước `/files`.

**Scale/Scope**:
- Port khoảng 1.500 dòng service, 400 dòng util/request/sync, 1.100 dòng controller (→ Nest), 600 dòng test gốc
  service/util + 500 dòng test request/tus; blackbox copy khoảng 900 dòng + 3 file e2e viết lại; mới khoảng 2.000 dòng
  test đối chiếu và capture, 300 dòng compose/profile/shim, 250 dòng Playwright, 300 dòng benchmark, fixture ảnh.
  Cỡ 006; tách `tasks.md` nếu vượt 60 task (R14).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.4.0. Kết quả dưới đây là lần 2, sau research, data model và contracts
(lần 1 trước research không có vi phạm; không đổi sau Phase 1).

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`. Mọi file port ghi `// Ported from directus/...` (bảng ánh
  xạ bên dưới, manifest `007-T*.json`). Chỗ khác nguồn ghi `Backoffice:`: controller Nest, `multipartHandler` và
  `checkFileAccess` qua `runMiddleware`, đăng ký `TusController` có điều kiện, `stop()` lịch dọn khi shutdown,
  `storages` → `getStorages()` trong blackbox, 3 file e2e viết lại.
- [x] **II. Dùng chung DB**: PASS. Không DDL, không migration; ghi `directus_files`, `directus_folders` qua service port
  nguyên nên cùng dòng (SC-003 so dòng và object trên hai driver); khởi động không ghi gì (`getStorage()` lười, health
  ghi `directus-health-file` chỉ khi gọi, như Directus).
- [x] **III. API giống hệt**: PASS. Route, middleware, Joi, zod, status, mã lỗi, message, header (kể cả `Content-
  Disposition`, `Cache-Control`, `ETag`, `Vary`, CSP, `Directus-File-Id`), `204`, `206`, `304`, `416`, multipart, TUS
  như Directus (contracts). D-09.5 gỡ, D-31 thu hẹp; không khác biệt mới; R-13 đến R-18 tái tạo (xóa theo tiền tố,
  import không giới hạn, thay file không atomic, `transforms=[]` vượt chế độ, sinh file phát sinh không khóa, phần dư
  chunk S3), bằng chứng đo ở bộ đối chiếu theo quy tắc của spec.
- [x] **IV. Chạy song song an toàn**: PASS. Khóa TUS cùng key Redis `directus:lock`; clock lịch dọn cùng key
  `directus-sync` (khi `SYNCHRONIZATION_STORE=redis`, như Directus); response cache dùng chung (005); không state mới
  trong process ngoài hàng đợi sharp (theo process ở Directus) và clock `memory` mặc định (R5, như Directus).
- [x] **V. Kiểm thử đối chiếu**: PASS. Mỗi route có `files`, `folders`, `import`, `assets`, `tus`, `zip`; dùng chéo
  `cross-use`, `transform-matrix`; 8 file blackbox + 3 e2e hai lượt; Postgres đủ bộ cả hai storage mỗi lần push, MySQL,
  SQLite rút gọn trên S3, còn lại nightly (FR-081, Clarifications).
- [x] **VI. Kiến trúc**: PASS. Bốn controller mỏng; ba service là lớp Directus qua `ServiceFactory`; Knex, không ORM;
  mỗi thay đổi có test (R13).
- [x] **VII. Đa instance**: PASS. File và file phát sinh trên storage dùng chung (`s3`, `local` volume dùng chung; môi
  trường đối chiếu dùng named volume); khóa TUS trên Redis; lịch dọn đồng bộ qua Redis khi bật; khởi động chỉ đọc;
  `stop()` lịch khi SIGTERM. Clock `memory` mặc định là hành vi Directus, dọn idempotent (Complexity Tracking, tiền lệ
  metrics).
- [x] **VIII. Biến môi trường**: PASS. Không biến mới; 25 biến sang nhóm A (R11); driver ngoài phạm vi dừng khởi động
  là D-16 đã duyệt ở 001 (ngoại lệ Nguyên tắc VIII, Complexity Tracking của 001).
- [x] **IX. Đổi thương hiệu**: PASS. Giữ `Directus-File-Id`, `directus-health-file`, `tus-cleanup`, `directus-sync`,
  `directus:lock`, preset `system-*`, event `files.*` (tên kỹ thuật dùng chung). Không nhãn người dùng mới.
- [x] **X. Chất lượng và vận hành**: PASS. Coverage 80%. Benchmark hằng tuần (ngoại lệ đã duyệt ở 003). Playwright là
  cổng chặn (004). Không gửi email. Gỡ D-09.5, thu hẹp D-31, R-13 đến R-18 cần tech lead duyệt trước khi đóng feature;
  bảng của spec 001, 004 sửa theo (R12).
- [x] **XI. Ngoài phạm vi**: PASS. Driver `gcs`, `azure`, `cloudinary`, `supabase` không port (D-16); không extension,
  không AI (`ai/files` thuộc D-17), không WebSocket (cầu nối `websocket.event` của 005 giữ nguyên).

## Project Structure

### Documentation (this feature)

```text
specs/007-files-assets/
├── plan.md              # File này
├── research.md          # Phase 0: R1–R14
├── data-model.md        # Phase 1: file, folder, storage, file phát sinh, preset, TUS, event
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── files-api.md         # /files, /folders, /files/import, multipartHandler, OPTIONS, lỗi
│   ├── assets.md            # /assets: query, header, range, revalidate, transform, tên file phát sinh, zip
│   ├── tus-storage.md       # /files/tus, lịch dọn, synchronization, storage, env nhóm A, import IP
│   └── parity.md            # môi trường, bộ đối chiếu, blackbox, CI, Playwright, benchmark
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

Chỉ liệt kê phần thêm hoặc sửa. Cấu trúc chung giữ như plan 001 đến 006.

```text
backoffice-next/
├── pnpm-workspace.yaml                         # catalog: sharp, @tus/server, mime-types, content-disposition, archiver, encodeurl, exif-reader, icc, minimatch, zod-validation-error, tus-js-client; onlyBuiltDependencies: sharp
├── libs/types/src/{assets,files}.ts            # MỚI nếu thiếu ← packages/types/src/{assets,files}.ts
├── apps/api/
│   ├── package.json                            # SỬA: thư viện trên; axios → dependencies; @tus/utils
│   └── src/
│       ├── constants.ts (+ test)               # SỬA: SYSTEM_ASSET_ALLOW_LIST, ASSET_TRANSFORM_QUERY_KEYS, SUPPORTED_IMAGE_*, RESUMABLE_UPLOADS.EXPIRATION_TIME, .SCHEDULE
│       ├── app.module.ts, providers.ts         # SỬA: 4 controller (thứ tự), useCollection; factory Files, Folders, Assets
│       ├── synchronization.ts (+ test)         # MỚI ← synchronization.ts
│       ├── utils/schedule.ts (+ test)          # SỬA: scheduleSynchronizedJob
│       ├── schedules/tus.ts (+ test)           # MỚI ← schedules/tus.ts
│       ├── startup/run-startup-checks.ts       # SỬA: lịch dọn TUS; shutdown.ts stop
│       ├── request/{index,agent-with-ip-validation,is-denied-ip}.ts (+ test gốc)   # MỚI ← request/
│       ├── services/files.service.ts (+ test gốc)      # MỚI ← services/files.ts
│       ├── services/files/lib/{extract-metadata,get-sharp-instance}.ts (+ test gốc)   # MỚI
│       ├── services/files/utils/{get-metadata,parse-image-metadata}.ts (+ test gốc)   # MỚI
│       ├── services/folders.service.ts (+ test gốc)    # MỚI ← services/folders.ts
│       ├── services/assets.service.ts (+ test gốc)     # MỚI ← services/assets.ts
│       ├── services/tus/{index,server,data-store,lockers,utils/wait-timeout}.ts (+ test gốc)   # MỚI ← services/tus/
│       ├── services/index.ts                   # SỬA
│       ├── utils/transformations.ts (+ test gốc)       # MỚI ← utils/transformations.ts
│       ├── utils/get-service.ts                # SỬA: bỏ directus_files, directus_folders
│       ├── middleware/router-options.ts (+ test)       # SỬA: mẫu /files, /folders, /assets, /files/tus
│       ├── controllers/files.controller.ts (+ test)    # MỚI ← controllers/files.ts (Nest; multipartHandler giữ nguyên)
│       ├── controllers/folders.controller.ts (+ test)  # MỚI ← controllers/folders.ts
│       ├── controllers/assets.controller.ts (+ test)   # MỚI ← controllers/assets.ts
│       ├── controllers/tus.controller.ts (+ test)      # MỚI ← controllers/tus.ts (checkFileAccess giữ nguyên)
│       └── config/supported-variables.ts (+ test)      # SỬA: khối Feature 007
├── tests/parity/
│   ├── docker-compose.yml                      # SỬA: volume uploads, files-fixtures, cặp assets-limit, assets-stress
│   ├── env/*.env (9 vendor), env/profile-{assets-limit,assets-stress}.env, env/profile-cors-hsts.env   # SỬA, MỚI, SỬA
│   ├── fixtures/{files,assets}/                # MỚI: ảnh mẫu, fixture e2e của Directus
│   ├── proxy/backoffice-routes.txt             # SỬA: files, folders, assets
│   ├── accepted-differences.ts                 # SỬA: xóa D-09.5, thu hẹp D-31 (đóng feature)
│   ├── README.md                               # SỬA: mục 007
│   ├── scripts/env-up (chmod uploads)          # SỬA
│   ├── src/{suite,config,normalizers,request-set}.ts   # SỬA
│   ├── src/startup/storage.test.ts             # SỬA
│   ├── src/files/                              # MỚI (contracts/parity.md §2)
│   │   ├── storage-capture.ts
│   │   └── {files,folders,import,assets,transform-matrix,cross-use,tus,zip,e2e-files,e2e-assets}.test.ts
│   └── src/items/blackbox/
│       ├── common/config.ts (+ test)           # SỬA: getStorages, cặp assets-limit
│       └── tests/{common/assets/**,db/routes/files/**,db/routes/collections/files.test.ts}   # MỚI (8 file)
├── tests/directus-app-e2e/src/files.spec.ts    # MỚI (R9); items.spec.ts, routing.spec.ts SỬA
├── tests/benchmark/src/{files,seed-files}.ts   # MỚI (R10); project.json SỬA
├── tools/port-manifest/007-T*.json             # MỚI
├── tools/ci-local.sh                           # SỬA
├── .github/workflows/{ci,parity-matrix,nightly,benchmark}.yml   # SỬA (contracts/parity.md §4)
├── specs/001-platform-foundation/spec.md       # SỬA: D-09.5
└── specs/004-permissions/spec.md               # SỬA: D-31
```

**Structure Decision**:
- Theo cấu trúc 001 đến 006: file của `directus/api/src` vào cùng đường dẫn trong `apps/api/src`; service và
  controller có hậu tố `.service.ts`, `.controller.ts`; `services/files/`, `services/tus/` giữ cây con như gốc;
  `request/` là thư mục mới cùng tên gốc.
- Blackbox 007 thêm vào cây `tests/parity/src/items/blackbox/` (cùng shim) như 006; 3 file e2e viết lại trong
  `src/files/` vì repo không có harness `tests/e2e`.
- Test đối chiếu mới đặt trong `tests/parity/src/files/`.

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/`) | Đích | Ghi chú |
|---------------------|------|---------|
| `api/src/services/files.ts` (+ test) | `apps/api/src/services/files.service.ts` | Nguyên |
| `api/src/services/files/lib/*.ts`, `utils/*.ts` (+ test) | `apps/api/src/services/files/{lib,utils}/` | Nguyên |
| `api/src/services/folders.ts` (+ test) | `apps/api/src/services/folders.service.ts` | Nguyên |
| `api/src/services/assets.ts` (+ test) | `apps/api/src/services/assets.service.ts` | Nguyên |
| `api/src/services/tus/*.ts`, `utils/wait-timeout.ts` (+ test) | `apps/api/src/services/tus/` | Nguyên |
| `api/src/utils/transformations.ts` (+ test) | `apps/api/src/utils/transformations.ts` | Nguyên |
| `api/src/request/*.ts` (+ test) | `apps/api/src/request/` | Nguyên |
| `api/src/synchronization.ts` | `apps/api/src/synchronization.ts` | Nguyên; test mới |
| `api/src/utils/schedule.ts` (`scheduleSynchronizedJob`) | `apps/api/src/utils/schedule.ts` | Thêm hàm |
| `api/src/schedules/tus.ts` | `apps/api/src/schedules/tus.ts` | + `stop()` khi shutdown |
| `api/src/controllers/{files,folders,assets,tus}.ts` | `apps/api/src/controllers/*.controller.ts` | Nest; `multipartHandler`, `checkFileAccess` nguyên; test mới |
| `api/src/constants.ts` (hằng asset, image, TUS) | `apps/api/src/constants.ts` | Thêm hằng |
| `packages/types/src/{assets,files}.ts` | `libs/types/src/` | Nếu thiếu |
| `tests/blackbox/tests/common/assets/**`, `db/routes/files/**`, `db/routes/collections/files.test.ts` | `tests/parity/src/items/blackbox/tests/...` | Copy nguyên; sửa ở contracts/parity.md §3 |
| `tests/e2e/tests/endpoints/{files,assets}/**` (+ fixture ảnh) | `tests/parity/src/files/e2e-*.test.ts`, `tests/parity/fixtures/assets/` | Viết lại theo `scenario()`, giữ assert |

### Phần không port hoặc hoãn

| Phần | Lý do | Thay ở |
|------|-------|--------|
| `storage-driver-{gcs,azure,cloudinary,supabase}` | Nguyên tắc XI, D-16 | — |
| `ai/files` | D-17 | — |
| `IMPORT_TIMEOUT`, `IMPORT_MAX_CONCURRENCY` (`services/import-export.ts`) | Import item | 010 |
| Harness `directus/tests/e2e` | 3 file viết lại trong bộ đối chiếu (R7) | — |
| TUS qua nhiều replica của riêng app mới | Feature 019 (Assumptions) | 019 |

## Complexity Tracking

Không có vi phạm mới. Ngoại lệ đã duyệt của 001 đến 006 vẫn áp dụng: D-16 dừng khởi động với driver ngoài phạm vi
(trái chữ Nguyên tắc VIII, duyệt ở 001); benchmark hằng tuần thay vì chặn CI (003); store `memory` với cảnh báo một
instance (001). Ghi nhận thêm (không phải vi phạm, hành vi Directus): clock lịch dọn TUS mặc định `SYNCHRONIZATION_STORE=
memory` nên mỗi instance tự chạy dọn (idempotent); hàng đợi transform `ASSETS_TRANSFORM_MAX_CONCURRENT` tính theo
process. Gỡ D-09.5, thu hẹp D-31, R-13 đến R-18 cần tech lead duyệt trước khi đóng feature (Nguyên tắc X).

Rủi ro đã biết, theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| Byte ảnh lệch giữa hai image dù cùng sharp 0.34.5 (bản build libvips) | SC-004 đỏ | Ca đầu `transform-matrix` so với fixture e2e của Directus (R2) ở gói C; lệch → bằng chứng, tech lead (Clarifications) |
| sharp không cài được trên alpine (`onlyBuiltDependencies`, prebuilt musl) | Image không build | Task đầu gói A: `pnpm install` + `docker build`, ghi `sharp.versions` |
| `@tus/server` 2.3.0 trong handler Nest/Express 5 (`handle(req,res)`, `OPTIONS` của tus) | US4 | Task đầu gói D: supertest `POST`/`HEAD`/`PATCH`/`OPTIONS` |
| Route tùy chọn `:pk{/:filename}` và thứ tự controller trong Nest 12 | `OPTIONS`, `/files/tus/:id` rơi vào `/files/:pk` | Task đầu gói B: supertest `OPTIONS` mọi path, `PATCH /files/tus/x` khi bật/tắt TUS |
| `Content-Disposition` khác giữa Express 4 (0.5.4) và 5 (1.0.0) ở `res.attachment` | Header lệch | Đo ở `assets.test.ts`; dùng `normalizeContentDisposition` (005) nếu chỉ khác dạng; khác giá trị → nghiên cứu lại |
| Named volume `uploads` quyền ghi (uid `node`) ở hai image | Upload `local` `503` | `env-up` chmod như `data.db`; task đo đầu gói C |
| MinIO prefix listing và `local` list không phân biệt hoa thường (R-13) | Ca xóa | Tái tạo; ca so trạng thái storage hai bên |
| `local` default location đổi hành vi test cũ (health ghi thêm location, benchmark health) | Job khác | Chạy lại `full` sau khi đổi env; benchmark health đã đo 40% rate (005) |
| Fixture ảnh lớn làm repo nặng | Clone chậm | Ảnh ≤ 200 KB, ảnh benchmark sinh bằng sharp lúc seed |
| Ca blackbox `limit`, `concurrency` phụ thuộc thời gian | Flaky | Chạy ở cặp `assets-limit` với `MAX_CONCURRENT=2` đúng config blackbox Directus; ca timeout, hết hạn tách sang `assets-stress` (analyze I2); retry như Directus |
| Guard `accepted-differences` đỏ khi xóa `D-09.5` trước khi spec `Done` | CI đỏ | Xóa entry trong commit đóng feature (R12) |
