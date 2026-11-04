---

description: "Danh sách task cho feature 031: cài extension bằng gói .tgz tải lên"
---

# Tasks: Cài extension bằng gói `.tgz` tải lên

**Input**: Tài liệu thiết kế trong `/specs/031-extension-upload/`
**Prerequisites**: `plan.md`, `spec.md` (D-212..D-212.3, một điểm Complexity Tracking, 7 sửa câu chữ của plan và 14 của
checklist chờ chủ dự án duyệt trước lượt 1). Dùng thêm `research.md` (R1–R9), `data-model.md`, `contracts/` (`api.md`,
`web.md`, `tests.md`), `quickstart.md`, `checklists/` (requirements, api-compat, security, data-safety).

**Điều kiện bắt đầu**: spec, clarify, plan, checklist 031 đã commit lên `main`; D-212..D-212.3 duyệt. Làm trên `main`,
không branch; script `.specify` cần `SPECIFY_FEATURE=031-extension-upload`. Checkout dùng chung với các phiên khác:
`git add` theo đường dẫn, không `git add -A`/`.`, không `stash`, `reset`, `checkout --`; không stage
`apps/api/project.json`, `apps/web/project.json`; push theo quy tắc checkout dùng chung (`ListAgents` hỏi phiên đang giữ
vai trò push nếu có; chỉ push khi `main` không có run CI đang chạy). Không sửa file dưới `directus/`. Máy local: chạy
test từng file, `--maxWorkers=1`; không dừng container của phiên khác; với `-- <file>` thì `parity-tests:parity` cần
`TEST_DB=<vendor>`; parity của 031 chạy trên profile `extensions` (Postgres; `--profile extensions`), `env-up` lại sau
khi sửa API.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Endpoint mới: `GET/POST /backoffice/extensions/upload` (D-212, `doc`, test từng app bằng `appRequest`: Directus 404).
  Endpoint đổi hành vi: `DELETE /extensions/registry/uninstall/:pk` với dòng `upload` (D-212.3, `doc`); `GET
  /extensions`, `GET /extensions/:pk`, GraphQL `extensions`, `GET /extensions/sources/:chunk` khi gói còn (D-212.2,
  `http`). Đối chiếu: `tests/parity/src/extensions/upload.test.ts` trên profile `extensions`, gồm bước đo Directus khởi
  động lại (FR-023, D-212.1); parity `extensions/*` hiện có không đổi; deploy 3 replica; E2E ba cấu hình.
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).

**Organization**: Task nhóm theo user story, xếp theo hai lượt commit (research R9): **Lượt 1 (API)** = Phase 1, 2, 3
(US1 API), 4 (US2 API), 5 (US3 API), 6 (US4), 7 (US5 + đóng lượt); **Lượt 2 (Web)** = Phase 8 (US1 web), 9 (US2 + US3
web), 10 (E2E), 11 (Polish + đóng lượt). Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build,
parity/E2E liên quan xanh, commit, push khi `main` rảnh, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `ext/` = `apps/api/src/extensions/`; `web/` = `apps/web/src/`;
  `sx/` = `apps/web/src/modules/settings/routes/extensions/`; `e2e/` = `apps/web-e2e/src/`; `parity/` =
  `tests/parity/src/`; `fx/` = `tests/fixtures/extensions/`.
- Comment trong `apps/api`, `apps/web` viết Directus là "DR" (Nguyên tắc IX); mỗi chỗ sửa file port ghi
  `Backoffice (spec 031, D-212)`, giữ dòng `Ported from`.

## Phase 1: Setup (chốt [Unverified] của research, fixture, kiểu; lượt 1)

**Purpose**: chốt ba điểm chưa thử, có gói fixture để test, mở kiểu `source`.

- [ ] T001 Thử tại chỗ (script dùng một lần trong scratchpad, không commit): (a) `tar` 7.5.19 `extract({ file, cwd })`
      với tar có mục `../x`, `/etc/x` và symlink trỏ ra ngoài: không file ngoài `cwd` (bỏ qua hay lỗi, ghi cái nào);
      (b) `syncExtensions({ partialSync })` của `ext/lib/sync/sync.ts` khi một file của prefix biến mất giữa `list` và
      `read` (mock disk): bỏ qua hay ném (bài học 020 NoSuchKey); (c) `deploy/compose` có `EXTENSIONS_LOCATION` dùng chung
      cho các replica không (`grep -rn EXTENSIONS deploy/compose deploy/helm`); (d) `web/api/sdk.ts` `wrappedFetch` với
      `body: FormData` không ép `content-type` JSON; (e) `host` không khớp: `semver` không là dependency trực tiếp của
      `apps/api`/`libs/extensions` (grep 2026-11-04, analyze U1) → so **major** bằng regex trên chuỗi `host`
      (`/(\d+)/` đầu tiên ≠ major của `BACKOFFICE_VERSION` → cảnh báo), không thêm gói; ghi research R3. Ghi "Kết quả
      T001" vào `specs/031-extension-upload/research.md` R2/R3/R6/R8.
- [ ] T002 [P] Fixture `fx/parity-upload-endpoint/`: `package.json` (`name` `parity-upload-endpoint`, `version` `1.0.0`,
      `directus:extension` type `endpoint`, `path dist/index.js`, `source src/index.js`, `host ^11.0.0`, `sandbox.enabled
      true`, scopes `log` như `fx/parity-endpoint-sandbox/package.json`), `src/index.js` (GET `/` trả `{ ok: true, source:
      'upload' }`), build `dist/` bằng `pnpm --filter @backoffice/extension-fixtures fixtures:build parity-upload-endpoint`
      và `fixtures:pack` → commit `dist/` + `parity-upload-endpoint-1.0.0.tgz`; `fx/fixtures-build.test.ts` xanh;
      **không** thêm vào `FIXTURES` của `parity/extensions/helpers.ts`, không chép lên kho ở seed
      (`tests/parity/docker-compose.yml` dòng 216–220 chỉ lặp `parity-*`: thêm loại trừ `parity-upload-*` vào vòng `for`).
      Cùng cách, fixture thứ hai `fx/parity-upload-bundle/` (analyze C1): bundle (`path.app dist/app.js`, `path.api
      dist/api.js`, mẫu `fx/parity-bundle-tools/package.json`) với hai entry: interface `upload-iface` (app) và endpoint
      `upload-endpoint` (api, `sandbox.enabled true`, trả `{ ok: true }`), `partial: true`; build + pack, commit `dist/` +
      `parity-upload-bundle-1.0.0.tgz`.
- [ ] T003 [P] Kiểu: `libs/types/src/extensions*.ts` (file chứa `ExtensionSettings`) `source: 'local' | 'registry' |
      'module' | 'upload'`; `libs/extensions/src/node/utils/generate-extensions-entrypoint.ts:14-17` tham số
      `extensionMaps` thêm `upload?: Map<string, Extension>` (thân hàm duyệt `Object.entries`, không đổi) + case trong
      `generate-extensions-entrypoint.test.ts` (map `upload` có setting → vào entrypoint); comment `Backoffice (spec 031,
      D-212)`.

**Checkpoint**: research không còn [Unverified]; `fixtures-build.test.ts`, `libs/extensions` test xanh; `tsc` của
`libs/types` xanh.

## Phase 2: Foundational (map `upload` trong manager, `installFromStream`)

**Purpose**: nguồn `upload` được quét, nạp, đồng bộ và gỡ như một nguồn thật; chưa có endpoint.

**⚠️ CRITICAL**: chưa xong Phase 2 thì không bắt đầu user story nào.

### Tests (MANDATORY) ⚠️

- [ ] T004 [P] `ext/lib/get-extensions.test.ts`: thư mục `<root>/.upload/<id>/package.json` ra map `upload`, không vào
      `local`; không có `.upload` → map rỗng.
- [ ] T005 [P] `ext/lib/get-extensions-settings.test.ts`: (a) thư mục `upload` không có dòng → `createMany` một dòng
      `{ enabled: true, source: 'upload', folder, bundle: null }` không gọi `list` của registry (mock); bundle → entry
      `source: 'upload'`, `bundle: id`; (b) dòng `upload` không có thư mục → giữ; (c) pass đọc không ghi (`write: false`)
      trả `null` khi thiếu dòng `upload` như local.
- [ ] T006 [P] `ext/manager.test.ts`: `getExtension('upload', f)`, getter `extensions` gồm `uploadExtensions`,
      `registerApiExtensions` nạp endpoint `upload` khi dòng `enabled` và bỏ khi `enabled: false`, `registerBundleExtension`
      với source `upload`; `installed({ source: 'upload', folder })` publish `{ partialSync: '.upload/<folder>', origin }`
      rồi `reload({ skipSync: true })` và `emitAction('extensions.installed', { versionId: folder })`;
      `uninstall(folder, 'upload')` gọi `installationManager.uninstall(folder, 'upload')` và `partialSync: '.upload/…'`;
      `updateWatchedExtensions` không watch đường dẫn dưới `.upload`; log `warn` một dòng cho **mỗi** extension của map
      `upload` (mọi type, kể cả chỉ app) có major của `host` khác major của `BACKOFFICE_VERSION` (so chuỗi, T001(e);
      clarify Q1, analyze I1/U1), trong `load()` sau khi có map.
- [ ] T007 [P] `ext/lib/installation/manager.test.ts` (tar thật trong thư mục tạm của test, `TEMP_PATH`/`EXTENSIONS_PATH`
      trỏ vào đó; storage mock cho `EXTENSIONS_LOCATION`): `installFromStream(stream, { source: 'upload', folder })` từ
      `fx/parity-upload-endpoint/parity-upload-endpoint-1.0.0.tgz` → `<EXTENSIONS_PATH>/.upload/<folder>/package.json` +
      `dist/index.js`, trả manifest; với `EXTENSIONS_LOCATION`: mọi file ghi lên kho, `package.json` ghi **sau** khi
      queue xong (ghi thứ tự `write` của mock); `install(versionId)` (mock `download`) vẫn ra `.registry/<versionId>`;
      `uninstall(folder, 'upload')` xóa `.upload/<folder>` local và prefix kho; `uninstall(folder)` mặc định `.registry`;
      thư mục tạm luôn bị xóa; `parity-upload-bundle-1.0.0.tgz` → manifest `type: 'bundle'` với 2 entry (C1); `EACCES`
      khi `move` (mock `fs-extra`) → `ServiceUnavailableError`, thư mục tạm xóa; stream bị `destroy()` giữa chừng →
      lỗi, không đích (analyze U3).

### Implementation

- [ ] T008 `ext/lib/get-extensions.ts`: `uploadExtensions = resolveFsExtensions(join(getExtensionsPath(), '.upload'))`,
      trả `{ local, registry, module, upload }`.
- [ ] T009 `ext/lib/get-extensions-settings.ts`: tham số và `readAndCreateSettings` nhận `upload`; `uploadSettings` lọc
      `source === 'upload'`; vòng lặp thứ tư như `module` (không nhánh đổi tên của local, không marketplace);
      `generateSettingsEntry` union source thêm `'upload'`.
- [ ] T010 `ext/manager.ts`: `private uploadExtensions: Map<string, Extension>`; `extensions` getter; `getExtension`
      case `'upload'`; `load()` nhận `upload` từ `getExtensions()` và truyền vào `getExtensionsSettings`;
      `generateExtensionBundle` truyền map `upload`; `registerApiExtensions` `sources` thêm `upload`;
      `registerBundleExtension` union source thêm `'upload'`; `updateWatchedExtensions` bỏ cả `uploadDir`;
      `install(versionId)` giữ chữ ký và gọi `installed({ source: 'registry', folder: versionId })` mới (tách phần
      broadcast + reload + emit + log); `uninstall(folder, source: 'registry' | 'upload' = 'registry')` tạo `syncFolder`
      theo source; cảnh báo `host` trong `load()` cho mọi extension của `uploadExtensions` (T006); `installed(target)`
      public (broadcast + reload + emit + log, dùng ở `install` và T016). Comment `Backoffice (spec 031, D-212)` mỗi chỗ.
- [ ] T011 `ext/lib/installation/manager.ts`: tách `installFromStream(tarStream: Readable, target: { source: 'registry'
      | 'upload'; folder: string }): Promise<ExtensionManifest>` (bước 3–7 của R1, thư mục con theo source, thư mục tạm
      `TEMP_PATH/<source === 'upload' ? 'upload-extensions' : 'marketplace'>/<folder>`, `package.json` chép cuối sau
      `queue.onIdle()`, lỗi `isBackofficeError` đi qua nguyên, lỗi khác → `ServiceUnavailableError` như cũ, `finally rm`);
      `install(versionId)` = mkdir + download + `installFromStream`; `uninstall(folder, source = 'registry')`.
- [ ] T012 Chạy T004–T007 xanh; unit `ext/**` và `api/services/extensions.service.test.ts` hiện có xanh nguyên.

**Checkpoint**: unit `apps/api` `extensions/**` xanh; `pnpm nx run api:typecheck` xanh; parity `extensions/list.test.ts`
và `install.test.ts` xanh nguyên (profile `extensions`, không hành vi mới nào kích hoạt vì chưa có `.upload`).

## Phase 3: User Story 1 - Admin tải một gói lên và dùng ngay, phần API (Priority: P1, lượt 1) 🎯 MVP

**Goal**: `POST /backoffice/extensions/upload` nhận gói hợp lệ, cài, trả dòng + schema; endpoint của gói chạy; GET probe.

**Independent Test**: parity bước 1–3 của contracts/tests.md §2; `curl -F file=@…` ở quickstart.

### Tests for User Story 1 (MANDATORY) ⚠️

- [ ] T013 [P] [US1] `api/services/extensions.service.test.ts` (knex-mock, manager/installationManager mock): `installUpload(stream)`
      gọi `installationManager.installFromStream(stream, { source: 'upload', folder: <uuid v4> })`, rồi trong
      `withSettingsLock` (mock `lib/settings-lock.js`) kiểm trùng name lần hai và `createOne({ id: folder, enabled: true,
      folder, source: 'upload', bundle: null })` + `createMany` entry bundle (`manifest['directus:extension'].entries`
      → `{ enabled: true, folder: entry.name, source: 'upload', bundle: id }`, kiểm với manifest của
      `parity-upload-bundle`; C1),
      rồi `extensionsManager.installed({ source: 'upload', folder })`, rồi trả `readOne(id)`; `EXTENSIONS_LIMIT` đạt →
      `LimitExceededError` trước khi giải nén xong (điểm = số entry hoặc 1).
- [ ] T014 [P] [US1] `api/controllers/backoffice-extensions.controller.test.ts` (supertest, mẫu
      `backoffice-indexes.controller.test.ts`): `GET /backoffice/extensions/upload` 200 `{ data: { max_upload_size:
      null } }` (admin; với `FILES_MAX_UPLOAD_SIZE=10mb` → `10485760`), 403 user, 401 không token; `POST` multipart
      (`.attach('file', <tgz>)`) 200 `{ data: ApiOutput }` với service mock; `res.locals.cache === false`; không multipart
      → 400 `Request must be multipart/form-data`; multipart không file → 400 `No file was uploaded`.
- [ ] T015 [P] [US1] `parity/extensions/upload.test.ts` phần 1 (đỏ tới T018): D-212 Directus `GET`/`POST` 404
      `ROUTE_NOT_FOUND`, Backoffice GET 200; tải `fx/parity-upload-endpoint/parity-upload-endpoint-1.0.0.tgz` (FormData +
      `fetch`, `admin()`) → 200 `meta.source === 'upload'`, `schema.type === 'endpoint'`, `schema.name ===
      'parity-upload-endpoint'`; `waitAll` `/parity-upload-endpoint` 200 ở `backoffice` và `backoffice-2`, 404 ở
      `directus`; `extRows()` có dòng `{ folder: <id>, source: 'upload', bundle: null, enabled: true }`; `mc ls
      local/directus/extensions/.upload/<id>/` có `package.json`, `dist/index.js`; D-212.2: `GET /extensions` Directus dòng
      `schema: null`, Backoffice `schema.type` (`same()` loại trừ dòng id này cho phần còn lại); **bundle** (C1): tải
      `fx/parity-upload-bundle/parity-upload-bundle-1.0.0.tgz` → 200 `schema.type === 'bundle'`, `extRows()` có 2 dòng con
      `{ bundle: <id>, source: 'upload', folder: 'upload-iface' | 'upload-endpoint' }`, `waitAll` `/upload-endpoint` 200 ở
      hai node Backoffice, `GET /extensions/sources/<chunk đầu của GET /extensions/sources/index.js>` ở Backoffice chứa
      `upload-iface`, ở Directus không (D-212.2 app bundle); Directus `GET /extensions` bỏ 2 dòng con (cha `schema: null`);
      **bật/tắt** (C3): `PATCH /extensions/<id endpoint> { meta: { enabled: false } }` ở Backoffice → `waitAll` 404 ở hai
      node, bật lại → 200; cùng PATCH ở Directus (`enabled: false`) → dòng cập nhật, Backoffice tắt theo (bus), bật lại;
      **đua** (C2): `Promise.all` tải lại `parity-upload-endpoint` ở `backoffice` và `backoffice-2` sau khi đã gỡ nó (T026
      chạy trước bước này hoặc bước này đặt sau T026 phần 3) → đúng một 200 và một 400 `already installed (upload)`, một
      dòng, một thư mục `.upload/` mới trên kho; dọn ở `afterAll` (xóa dòng, `mc rm` prefix, `waitAll` fixture local 200
      như `install.test.ts`).

### Implementation for User Story 1

- [ ] T016 [US1] `api/services/extensions.service.ts`: `installUpload(stream: Readable): Promise<ApiOutput>` theo
      T013 và research R5 (kiểm `EXTENSIONS_LIMIT` bằng cách tách `assertLimit(points)` từ `preInstall`; lỗi sau khi file
      ở đích → `installationManager.uninstall(folder, 'upload')` rồi ném); comment `Backoffice (spec 031, D-212)`.
- [ ] T017 [US1] `api/controllers/backoffice-extensions.controller.ts` (mới): `@Controller('backoffice/extensions')`;
      `GET upload` → `{ data: { max_upload_size: bytes.parse(env.FILES_MAX_UPLOAD_SIZE) ?? null } }`; `POST upload`:
      `req.is('multipart/form-data')` → 400; Busboy `{ headers, limits: { files: 1, fileSize } }` (mẫu
      `files.controller.ts:42-46`), `on('file')` → `service.installUpload(fileStream)`; `fileStream.on('limit')` →
      `ContentTooLargeError` (hủy stream, service dọn); không file khi `close` → 400; lỗi → `next(error)`; trả 200 `{ data }`
      qua `respond`; `res.locals.cache = false`; admin/401/403 như `backoffice-indexes.controller.ts:30-36`.
- [ ] T018 [US1] `api/app.module.ts`: controller vào `controllers`, `consumer.apply(useCollection('directus_extensions'))
      .forRoutes(BackofficeExtensionsController)`; `ExtensionsService` đã là provider (giữ). Chạy T013–T015 xanh (parity:
      `env-up` profile `extensions`, `TEST_DB=postgres`).

**Checkpoint**: parity `upload.test.ts` phần 1 xanh; `install.test.ts`, `list.test.ts`, `endpoints.test.ts` xanh nguyên.

## Phase 4: User Story 2 - Gói sai bị từ chối sạch, phần API (Priority: P1, lượt 1)

**Goal**: mọi đường từ chối trả đúng mã/reason và không để lại file hay dòng.

**Independent Test**: parity bước 5 của contracts/tests.md §2; unit T019/T020.

### Tests for User Story 2 (MANDATORY) ⚠️

- [ ] T019 [P] [US2] `ext/lib/installation/manager.test.ts` thêm: file không phải gzip (`package.json` thường) →
      `InvalidPayloadError` reason `The file is not a gzipped tar archive`; tar không có `package/package.json` → reason
      `package/package.json is missing (npm pack layout expected)`; manifest sai (`directus:extension` thiếu `type`) →
      reason bắt đầu `Invalid extension manifest:`; `MARKETPLACE_TRUST=sandbox` + endpoint không `sandbox.enabled` → reason
      `MARKETPLACE_TRUST=sandbox requires a sandboxed extension`; `MARKETPLACE_TRUST=sandbox` + gói chỉ app (interface) →
      **được nhận** (FR-006 sau checklist); trùng name với `existingNames` truyền vào → reason `An extension named "x" is
      already installed (local)`; mọi trường hợp: thư mục tạm xóa, không `.upload/<folder>`, kho không ghi (mock); tar có
      `../x` (T001) không file ngoài tạm.
- [ ] T020 [P] [US2] `api/controllers/backoffice-extensions.controller.test.ts` thêm: `FILES_MAX_UPLOAD_SIZE=1kb` + file
      2 KB → 413 `CONTENT_TOO_LARGE`, service không được gọi tới `createOne` (stream hủy); service ném `InvalidPayloadError`
      → 400 với reason nguyên; user thường → 403 trước khi đọc body.
- [ ] T021 [P] [US2] `parity/extensions/upload.test.ts` phần 2: `package.json` thường → 400 reason `not a gzipped tar`;
      tar tự dựng trong test (`tar.create` vào thư mục tạm, không `package/`) → 400 `package/package.json is missing`;
      `fx/parity-endpoint-demo/parity-endpoint-demo-1.0.0.tgz` (không sandbox) → 400 `MARKETPLACE_TRUST=sandbox requires…`;
      `fx/parity-endpoint-sandbox/parity-endpoint-sandbox-1.0.0.tgz` (trùng name với fixture local) → 400 `already
      installed (local)`; user thường (`userToken` của helpers files) → 403; sau mỗi lần `extRows()` không đổi, `mc ls
      local/directus/extensions/.upload/` không thêm thư mục; Directus cùng request → 404 (D-212).

### Implementation for User Story 2

- [ ] T022 [US2] `ext/lib/installation/manager.ts`: trong `installFromStream` các kiểm tra theo thứ tự R1 (định dạng →
      manifest → `type` → sandbox theo `MARKETPLACE_TRUST` chỉ khi gói có phần API: `type` hook/endpoint/operation hoặc
      bundle có entry api → trùng name so với `options.existingNames: Map<name, source>`), tất cả **trước** khi chép; lỗi
      `tar`/gzip bắt ở `extract` và map thành `InvalidPayloadError`; `ENOENT` của `package/package.json` → reason riêng;
      zod → `Invalid extension manifest: ${issues}`.
- [ ] T023 [US2] `api/services/extensions.service.ts`: `existingNames` từ `extensionsManager.extensions` (cấp cao, `name`
      → source: suy từ map của manager, thêm `getExtensionSource(name)` nhỏ ở manager) truyền vào `installFromStream`;
      kiểm lại trong `withSettingsLock` (đọc `directus_extensions` + manager) → cùng reason; `EXTENSIONS_LIMIT`.
- [ ] T024 [US2] `api/controllers/backoffice-extensions.controller.ts`: 413 trên `limit`, 400 không file, lỗi đi qua
      `next`; chạy T019–T021 xanh.

**Checkpoint**: parity `upload.test.ts` phần 1–2 xanh; `security.md` CHK019/CHK021/CHK026 có code tương ứng.

## Phase 5: User Story 3 - Gỡ gói đã tải lên, phần API (Priority: P2, lượt 1)

**Goal**: uninstall có sẵn nhận `upload`, xóa file (kho + local) và dòng; reinstall 400.

**Independent Test**: parity bước 6 của contracts/tests.md §2.

### Tests for User Story 3 (MANDATORY) ⚠️

- [ ] T025 [P] [US3] `api/services/extensions.service.test.ts` thêm: `uninstall(id)` với dòng `source: 'upload'` →
      `deleteOne` + `extensionsManager.uninstall(folder, 'upload')`; dòng `local`/`module` → 400 chữ cũ; entry bundle
      `upload` → 400 `Cannot uninstall sub extensions of bundles separately`; `reinstall(id)` với `upload` → 400 `Cannot
      reinstall extensions that were not installed via marketplace`, không gọi manager.
- [ ] T026 [P] [US3] `parity/extensions/upload.test.ts` phần 3: Directus `DELETE /extensions/registry/uninstall/<id>` →
      400 reason `not installed via marketplace` (D-212.3, dòng còn); Backoffice `POST /extensions/registry/reinstall`
      `{ extension: id }` → 400; Backoffice `DELETE` → 204; `waitAll` `/parity-upload-endpoint` 404 ở `backoffice` và
      `backoffice-2`; `extRows()` không còn dòng; `mc ls .upload/<id>/` rỗng; `GET /extensions` hai app bằng nhau (`same`);
      tải lại cùng gói → 200 (trùng tên đã hết) rồi gỡ lại; gỡ bundle (C1): `DELETE` dòng cha → 204, hai dòng con mất,
      `/upload-endpoint` 404, `mc ls .upload/<id bundle>/` rỗng; `DELETE` một dòng con → 400 `sub extensions of bundles`.

### Implementation for User Story 3

- [ ] T027 [US3] `api/services/extensions.service.ts`: `uninstall` chấp nhận `['registry', 'upload']`, truyền
      `settings.source` cho `extensionsManager.uninstall(folder, source)`; `reinstall` không đổi; chạy T025–T026 xanh.

**Checkpoint**: parity `upload.test.ts` phần 1–3 xanh.

## Phase 6: User Story 4 - Nhiều replica cùng thấy gói (Priority: P2, lượt 1)

**Goal**: gói lên kho dùng chung, mọi replica nạp qua bus; replica khởi động lại sync `.upload`.

**Independent Test**: deploy `extension-upload.test.ts` 3 replica; parity `backoffice-2` đã kiểm ở T015/T026.

- [ ] T028 [P] [US4] `ext/lib/sync/sync.test.ts` (có sẵn, thêm case): `partialSync: '.upload/<id>'` chép đúng prefix về
      `<TEMP_PATH>/extensions/.upload/<id>`; khi `package.json` không còn trên kho → `rm` thư mục local; sync đầy đủ gồm
      file dưới `.upload/`; theo kết quả T001(b): file mất giữa chừng → bỏ qua (nếu T001 cho thấy ném thì sửa `sync.ts`
      bắt `NoSuchKey`/`ENOENT` của một file và ghi `warn`, comment `Backoffice (spec 031)`).
- [ ] T029 [US4] `parity/deploy/extension-upload.test.ts` (mới, mẫu `deploy/indexes.test.ts`): `adminToken(replicaUrl(1))`,
      POST multipart qua `boLbUrl` → 200; `waitFor` `replicaUrl(1..3)` `/parity-upload-endpoint` 200 trong ≤ 10 s
      (SC-004); `docker restart` replica 2 → sau `/server/ping` endpoint vẫn 200 (sync đầy đủ, US4 kịch bản 3); gỡ qua lb
      → 204; `waitFor` cả ba 404 ≤ 10 s; nếu T001(c) cho thấy deploy compose không có `EXTENSIONS_LOCATION`: thêm vào
      `deploy/compose` (MinIO đã có, 019) và ghi `deploy/README.md`.
- [ ] T030 [US4] `tests/parity/project.json` / `vitest.deploy.config.ts`: file mới vào suite deploy; chạy
      `pnpm nx run parity-tests:deploy -- extension-upload` local (Postgres, 3 replica) xanh.

**Checkpoint**: deploy test xanh local.

## Phase 7: User Story 5 - Chạy song song với Directus 11.17.4 + đóng lượt 1 (Priority: P2)

**Goal**: D-212.1 đo thật; `accepted-differences`; README; lượt 1 lên `main` với CI xanh.

- [ ] T031 [US5] `parity/extensions/upload.test.ts` phần 4 (FR-023, chèn giữa phần 1 và 2): sau khi tải gói lên,
      `const since = new Date(); compose('restart', 'directus-extensions')`; chờ `/server/ping` Directus 200 (`waitAll`
      60 s); `containerLog('directus-extensions', since)` không có dòng `"level":50` hay chứa `extension` + `error`;
      `extRows()` cùng số dòng và không dòng `source: 'registry'` có `folder` là id; Directus `/parity-upload-endpoint`
      404; `GET /extensions` Directus dòng id `schema: null`; ghi số liệu vào spec "Đánh giá hiện trạng" dòng 5 → [Verified].
- [ ] T032 [P] [US5] `tests/parity/accepted-differences.ts`: D-212 (doc), D-212.1 (doc), D-212.2 (http), D-212.3 (doc)
      với `reason` theo bảng spec; `spec-differences.test.ts` (nếu có) xanh; `tests/parity/README.md` mục 031.
- [ ] T033 [P] [US5] `deploy/README.md` mục "Tải extension lên (spec 031)": chỉ admin; gói không sandbox = mã tùy ý với
      quyền tiến trình API; `MARKETPLACE_TRUST=sandbox` ép sandbox cho gói có phần API; `FILES_MAX_UPLOAD_SIZE` (không đặt
      = không giới hạn; không giới hạn sau giải nén, gzip bomb); `EXTENSIONS_LOCATION` cho nhiều replica; `.upload` ẩn với
      Directus; gỡ tay (thư mục + dòng); `host` không khớp chỉ log.
- [ ] T034 [US5] Chạy `pnpm nx run api:lint`, `api:typecheck`, `api:test` (`--maxWorkers=1`), `api:build`; parity profile
      `extensions` đủ (`list`, `hooks`, `endpoints`, `install`, `sandbox`, `multi`, `upload`) trên `TEST_DB=postgres`;
      `libs/extensions`, `libs/types` test; sửa tới xanh.
- [ ] T035 Đóng lượt 1: `git add` theo đường dẫn (`apps/api`, `libs/extensions`, `libs/types`, `tests/fixtures/extensions`,
      `tests/parity`, `deploy/README.md`, `specs/031-extension-upload`), commit `feat(api): install an extension from an
      uploaded .tgz package (spec 031, D-212)` với dòng `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; push khi
      `main` rảnh; theo dõi CI (quality, parity postgres/sqlite/mysql, blackbox, deploy, bootstrap), sửa job đỏ; `graphify
      update .`; ghi mã commit và run CI vào spec Status.

**Checkpoint**: lượt 1 trên `main`, CI xanh; D-212.1 [Verified] trong spec.

## Phase 8: User Story 1 - Nút Upload, dialog, probe, phần web (Priority: P1, lượt 2)

**Goal**: Settings > Extensions có nút Upload (ẩn khi API là Directus), dialog chọn file, cài xong danh sách tải lại.

**Independent Test**: unit + browser test; E2E ở Phase 10.

### Tests for User Story 1 (MANDATORY) ⚠️

- [ ] T036 [P] [US1] `web/composables/use-extension-upload.test.ts` (mẫu `use-passkey-support.test.ts`): probe GET
      `/backoffice/extensions/upload` 200 → `available=true`, `maxUploadSize` từ `data.max_upload_size`; 404/lỗi mạng →
      `false` im lặng; một probe cho mỗi API URL; `upload(file)` gửi `FormData` field `file` bằng `apiFetch` POST không
      `content-type`; 400 → ném lỗi dịch được bằng `translateAPIError` (reason giữ).
- [ ] T037 [P] [US1] `sx/components/ExtensionUploadDialog.browser.test.ts` (project `browser`, axe): mở dialog, input file
      có label, nút Upload disabled khi chưa chọn; chọn `.txt` → lỗi `upload_extension_wrong_type` (`role="alert"`); chọn
      file 0 byte → `files_are_empty`; `maxUploadSize` 10 + file 20 byte → `upload_extension_too_large`; chọn `.tgz` hợp lệ +
      fetch mock 200 → `extensionsStore.refresh` gọi, `notify` thành công, emit `close`; fetch mock 400 reason → BoNotice
      với reason, dialog còn mở, gửi lại được; đang gửi: `aria-busy`, Escape không đóng; không vi phạm axe serious.
- [ ] T038 [P] [US1] `sx/ExtensionsRoute.test.ts` thêm: nút "Upload extension" ở slot actions khi `available` true, không
      có khi false; bấm mở dialog; `web/test-utils/fetch.ts` KNOWN_REQUESTS thêm GET/POST `/backoffice/extensions/upload`.

### Implementation for User Story 1

- [ ] T039 [P] [US1] `web/composables/use-extension-upload.ts` (mới): `useExtensionUpload(): { available, maxUploadSize,
      ready, upload }` theo contracts/web.md và T036; `_resetExtensionUpload()` cho test.
- [ ] T040 [P] [US1] `web/lang/overlay/en-US.ts`, `vi-VN.ts`: khối `// Spec 031 (D-212)` với 8 key của contracts/web.md.
- [ ] T041 [US1] `sx/components/ExtensionUploadDialog.vue` (mới): BoDialog (`modelValue`), vùng kéo thả + `<input
      type="file" accept=".tgz,.tar.gz,application/gzip,application/x-gzip">` gắn label (mẫu drop zone của
      `web/components/files/BoUpload.vue`, không tái dùng component), tên + kích thước file, kiểm trước khi gửi, BoButton
      Upload/Cancel, `BoProgressCircular` + `aria-busy`, BoNotice lỗi (`translateAPIError`), thành công → `refresh` +
      `notify` + đóng + focus về trigger; mọi chuỗi từ gói qua text binding.
- [ ] T042 [US1] `sx/ExtensionsRoute.vue`: `<template #actions>` BoButton primary icon `upload` `v-if="available"` mở
      dialog; `<ExtensionUploadDialog v-model="uploadOpen" />`; chạy T036–T038 xanh.

**Checkpoint**: unit + browser web xanh; nút hiện ở `proxy-api` local, ẩn ở `proxy-directus`.

## Phase 9: User Story 2 + User Story 3 - Lỗi trong dialog, chip nguồn, menu, phần web (Priority: P1/P2, lượt 2)

**Goal**: lỗi API hiện tại chỗ (đã ở T041), hàng extension `upload` có chip "Uploaded", Uninstall mở, không Reinstall.

### Tests (MANDATORY) ⚠️

- [ ] T043 [P] [US3] `sx/components/ExtensionItem.test.ts`: `meta.source === 'upload'` → chip `extension_source_upload`
      sau chip version, tên là `schema.name`, không RouterLink Marketplace; `local`/`registry` không chip.
- [ ] T044 [P] [US3] `sx/components/ExtensionItemOptions.test.ts`: `upload` → Uninstall enabled (không hậu tố
      `uninstall_locked`), không Reinstall; `local` → Uninstall disabled như cũ; Missing `upload` → chỉ Remove.
- [ ] T045 [P] [US2] `sx/components/ExtensionUploadDialog.browser.test.ts` thêm: 413 `CONTENT_TOO_LARGE` và 403
      `LIMIT_EXCEEDED` hiện thông điệp dịch; `host` không khớp không phải lỗi (không kiểm ở web).

### Implementation

- [ ] T046 [P] [US3] `sx/components/ExtensionItem.vue`: BoChip `t('extension_source_upload')` khi `upload`.
- [ ] T047 [P] [US3] `sx/components/ExtensionItemOptions.vue`: `uninstallLocked = !['registry', 'upload'].includes(source)`;
      chạy T043–T045 xanh.

**Checkpoint**: unit web `sx/**` xanh.

## Phase 10: E2E ba cấu hình (US1, US2, US3, US5)

- [ ] T048 [P] `e2e/helpers/allowed-paths.ts`: 232 `GET ^/backoffice/extensions/upload$`, 233 `POST` cùng path.
- [ ] T049 `e2e/settings-extensions-upload.spec.ts` (mới, mẫu `settings-extensions.spec.ts` + `helpers/extensions.ts`):
      `proxy-directus`: không nút "Upload extension"; `proxy-api`, `cors`: nút có → dialog → `setInputFiles`
      `fx/parity-upload-endpoint/parity-upload-endpoint-1.0.0.tgz` → toast, hàng `[data-extension="parity-upload-endpoint"]`
      với chip "Uploaded" và Enabled, `loadedEverywhere(id)`; axe dialog mở (`checkA11y` như 016); gửi `package.json` thường
      → `role="alert"` trong dialog, dialog còn; menu hàng → Uninstall → xác nhận → hàng biến mất, poll `GET /extensions`
      không còn id ở mọi node; `afterAll` dọn dòng/kho nếu test đứt giữa chừng (`hostDb`, `mc` qua helper nếu có; nếu
      không, API `DELETE`).
- [ ] T050 Chạy E2E local ba cấu hình (`PARITY_WEB_*` theo `apps/web-e2e/README`), chromium; sửa tới xanh (lưu ý bài học:
      sign-in mở `last_page`, `env-up` lại sau khi sửa web).

**Checkpoint**: E2E ba cấu hình xanh local.

## Phase 11: Polish + đóng lượt 2

- [ ] T051 [P] `specs/020-extensions/spec.md`: ghi chú "(031: nguồn `upload`, `POST /backoffice/extensions/upload`;
      uninstall nhận `upload`)" ở phần cài/gỡ extension và bảng D-37.
- [ ] T052 [P] `CLAUDE.md` dòng 031 → "implemented" với commit/CI; `SPECKIT-GUIDE.md` mục 031 trạng thái + bài học.
- [ ] T053 [P] `design-system/docs/component-specs.md`: recipe Q-41 thêm "Upload extension dialog" (một đoạn, trỏ
      contracts/web.md) nếu design owner yêu cầu; nếu không, ghi "không đổi" vào spec.
- [ ] T054 Đóng spec: `specs/031-extension-upload/spec.md` Status "Implemented 2026-11-xx, hai lượt (commit, CI)",
      D-212..D-212.3 "duyệt", "Đánh giá hiện trạng" dòng 4–6 [Verified] với số liệu T031; `checklists/requirements.md` ghi chú.
- [ ] T055 Chạy `pnpm nx run web:lint`, `web:typecheck`, `web:test:unit`, `web:test:browser`, `web:build`, E2E ba cấu
      hình; sửa tới xanh.
- [ ] T056 Đóng lượt 2: `git add` theo đường dẫn (`apps/web`, `apps/web-e2e`, `design-system`, `specs`, `CLAUDE.md`,
      `SPECKIT-GUIDE.md`), commit `feat(web): upload an extension package on Settings > Extensions (spec 031, D-212)` với
      dòng `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; push khi `main` rảnh; theo dõi CI (web, e2e-web,
      parity, deploy), sửa job đỏ; `graphify update .`; ghi mã commit và run CI vào spec Status.

**Checkpoint**: lượt 2 trên `main`, CI xanh, spec đóng.

## Dependencies & Execution Order

- **Phase 1 → 2**: T001 chốt R2/R3 cho T011/T028; T002 cho mọi test dùng gói; T003 cho T009/T010 (kiểu).
- **Phase 2 → 3**: T008–T012 trước mọi story (không có map `upload` thì không nạp được gì).
- **US1 API (3)** trước **US2 (4)** (kiểm tra thêm vào luồng đã chạy) và **US3 (5)** (có dòng rồi mới gỡ); **US4 (6)** chỉ
  cần Phase 3 (deploy test tải và gỡ: gỡ cần T027 → làm 6 sau 5); **US5 (7)** cuối lượt 1 (đo Directus cần gói còn → T031
  chèn trước phần 2 của parity nhưng viết sau).
- **Lượt 2** chỉ bắt đầu sau T035 (API trên `main`, CI xanh). **Phase 8** trước 9; **Phase 10** sau 8–9; **Phase 11** cuối.
- Trong mỗi story: test ([P]) viết trước và đỏ → implementation → parity/E2E.

## Parallel Example: Phase 2

```text
Song song: T004, T005, T006, T007 (test đỏ) → T008 ∥ T009 → T010 → T011 → T012
```

## Parallel Example: User Story 1 (API)

```text
Song song: T013, T014, T015 (test đỏ) → T016 → T017 → T018
```

## Parallel Example: User Story 1 (web)

```text
Song song: T036, T037, T038 (test đỏ) → T039 ∥ T040 → T041 → T042
```

## Implementation Strategy

- **MVP** = Phase 1–3 + Phase 5 (gỡ là an toàn dữ liệu: không có gỡ thì trùng tên không tháo được) + Phase 7: tải gói
  hợp lệ lên qua API, chạy trên mọi node của profile `extensions`, gỡ sạch, Directus cùng DB không đổi.
- Tăng dần: US2 (mọi đường từ chối), US4 (deploy 3 replica), rồi web (nút, dialog, chip, menu, E2E), polish.
- Hai lượt commit; mỗi lượt kết thúc bằng CI xanh trước khi sang lượt sau.
