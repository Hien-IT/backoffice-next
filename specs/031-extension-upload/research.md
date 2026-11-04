# Research: Cài extension bằng gói `.tgz` tải lên (031)

Đọc code ngày 2026-11-04 (Backoffice và mã nguồn Directus 11.17.4 trong `directus/`), chưa chạy thử. Mục ghi [Verified]
đọc đúng dòng; [Inference] suy ra từ code, có task kiểm ở lượt 1; [Unverified] thử ở T001 trước khi viết code.

## R1. Luồng cài từ registry: tách phần sau khi có stream tar thành hàm dùng chung

**Hiện trạng** [Verified] (`apps/api/src/extensions/lib/installation/manager.ts:23-116`): `install(versionId)` làm
tuần tự trong một `try/finally rm(tempDir)`: (1) `mkdir TEMP_PATH/marketplace/<versionId>`; (2) `download(versionId,
MARKETPLACE_TRUST === 'sandbox', { registry })` → stream; (3) ghi `bin.tar.tgz` vào thư mục tạm bằng `DriverLocal`; (4)
`extract({ file, cwd: tempDir })` của `tar` 7; (5) đọc `package/package.json`, `ExtensionManifest.parseAsync`, bắt
`[EXTENSION_PKG_KEY].type`; (6) nếu `EXTENSIONS_LOCATION`: chép từng file của `package/` lên
`<EXTENSIONS_PATH>/.registry/<versionId>/…` qua `p-queue`; (7) `move(package → <extensionPath>/.registry/<versionId>)`.
Lỗi khác `ServiceUnavailable` bị gói thành `ServiceUnavailableError({ service: 'extensions' })`. `uninstall(folder)` xóa
prefix `.registry/<folder>` ở kho và thư mục local.

**Decision**: thêm `installFromStream(tarStream: Readable, target: { source: 'registry' | 'upload'; folder: string })`
chứa các bước (3)–(7) với thư mục con `.registry` hay `.upload` theo `source`; `install(versionId)` còn (1)–(2) rồi gọi
nó với `{ source: 'registry', folder: versionId }`; `uninstall(folder, source = 'registry')` nhận thư mục con theo
source. Phần upload thêm trước bước (6):

- kiểm `name` trùng: so với `extensionsManager.extensions` (mọi source, kể cả entry bundle? → chỉ extension cấp cao:
  `extensions` getter trả các map cấp cao) → `InvalidPayloadError({ reason: 'An extension named "<name>" is already
  installed (<source>)' })` (xem R4 về mã lỗi);
- kiểm sandbox: `MARKETPLACE_TRUST === 'sandbox'` và manifest không có `sandbox.enabled === true` (hook/endpoint/
  operation/bundle có phần api) → `InvalidPayloadError({ reason: 'MARKETPLACE_TRUST=sandbox requires a sandboxed
  extension' })`. Registry làm việc này bằng URL tải (`download.ts:70`), Backoffice chưa kiểm manifest ở đâu.
- kiểm `EXTENSIONS_LIMIT` như `preInstall` (`extensions.service.ts:70-85`): điểm = số entry của bundle hoặc 1.
- thứ tự chép lên kho (checklist 2026-11-04 CHK035): mọi file qua `p-queue` rồi `onIdle()`, **sau đó** mới
  `package.json`; thư mục không có `package.json` bị `resolveFsExtensions` bỏ qua, nên replica sync dở hay khởi động
  không thấy gói thiếu file. Local `move` là một thao tác nguyên tử trên cùng filesystem.

Lỗi của phần kiểm là `InvalidPayloadError` (400) và `LimitExceededError`, không bị gói thành 503: `catch` hiện gói mọi lỗi
không phải `ServiceUnavailable`; sửa để `isBackofficeError(err)` đi qua nguyên (comment `Backoffice (spec 031, D-212)`).
Thông điệp cho tar hỏng/thiếu `package/package.json`/manifest sai: `InvalidPayloadError({ reason })` với lý do từ
`tar` (lỗi gzip/tar) hay `ENOENT package/package.json` hay thông điệp zod của `ExtensionManifest` (FR-002).

**Alternatives**: viết `UploadManager` riêng chép 60 dòng: bác (trùng code, hai chỗ sửa khi `tar` đổi).

## R2. Giải nén an toàn (FR-005)

[Verified] `tar` 7 `extract` mặc định bỏ mục có đường dẫn tuyệt đối và `..` thoát khỏi `cwd` (`preservePaths: false`
là mặc định; symlink ra ngoài bị chặn trừ khi `preservePaths`). Thư mục đích `.upload/<uuid>` sinh ở API bằng
`randomUUID()`, không lấy từ tên file hay `package.json`. [Unverified] T001 thử một tar có mục `../x` và `/etc/x`: không
có file ngoài thư mục tạm, lỗi hoặc bỏ qua (chấp nhận cả hai, miễn không ghi ra ngoài). Thư mục tạm riêng cho upload:
`TEMP_PATH/upload-extensions/<uuid>` (không trùng `marketplace/<versionId>` của registry).

Kích thước: Busboy `limits.fileSize` từ `FILES_MAX_UPLOAD_SIZE` như `files.controller.ts:42-46`; khi vượt Busboy phát
`limit` trên file stream → `ContentTooLargeError` (413, có sẵn), hủy stream và dọn thư mục tạm (clarify Q3: không đặt =
không giới hạn, `bytes.parse(undefined) → undefined`). Không áp `FILES_MIME_TYPE_ALLOW_LIST` (là của thư viện file;
trình duyệt gửi `application/gzip` hoặc `application/x-gzip`, có nơi `application/octet-stream`): định dạng kiểm bằng
`tar` khi giải nén, không bằng MIME.

## R3. Manager: nguồn `upload` là map thứ tư

[Verified] Các chỗ lệ thuộc danh sách nguồn: `manager.ts:89-93` (ba map), `:177-192` (`extensions` getter,
`getExtension`), `:311-317` (`getExtensions()` → ba map + `getExtensionsSettings`), `:596` (`updateWatchedExtensions` bỏ
`.registry`), `:619-623` (`generateExtensionsEntrypoint` ba map), `:740-745` (`registerApiExtensions` ba map), `:768`,
`:867` (`registerBundleExtension` union source); `lib/get-extensions.ts:11` (`resolveFsExtensions('.registry')`);
`lib/get-extensions-settings.ts:16-20, 48-50, 73, 145-168` (ba vòng lặp, `generateSettingsEntry` gọi marketplace cho
`registry`); `libs/extensions/src/node/utils/generate-extensions-entrypoint.ts:14-17` (kiểu tham số ba map, thân hàm
duyệt `Object.entries` nên nhận map thứ tư không đổi logic).

**Cảnh báo `host`** (clarify Q1; analyze I1/U1): `semver` không là dependency trực tiếp của `apps/api` hay
`libs/extensions` (grep 2026-11-04), nên không `satisfies`: trong `load()` sau khi có map `upload`, với mỗi extension
(mọi type) lấy số đầu tiên của `host` (`/(\d+)/`) và so với major của `BACKOFFICE_VERSION`; khác → một dòng `warn`
`Extension "<name>" declares host "<host>", Backoffice is <version>`. Không chặn, không thêm gói.

**Decision**: thêm `uploadExtensions` đọc từ `resolveFsExtensions(join(getExtensionsPath(), '.upload'))`; mọi chỗ trên
nhận `upload` với cùng cách xử lý như `local` (không marketplace), riêng `updateWatchedExtensions` bỏ cả `.upload` như
`.registry` (gói không phải "local" nên watcher không theo dõi). Kiểu `ExtensionSettings.source` của `@backoffice/types`
mở rộng thêm `'upload'` (lib riêng của Backoffice, không phải `@directus/types`); kiểu tham số của
`generateExtensionsEntrypoint` thêm `upload?`. Thư mục `.upload` không có dòng → `generateSettingsEntry(folder, ext,
'upload')` tạo dòng bật (FR-011, như local). Dòng `upload` không có thư mục → giữ (như DR giữ dòng registry mồ côi).

Sync từ kho dùng chung [Verified] (`lib/sync/sync.ts:58-100`): sync đầy đủ liệt kê mọi file dưới `EXTENSIONS_PATH` của
kho (gồm `.upload/…`) và chép về `TEMP_PATH/extensions`, nên replica khởi động lại thấy gói (US4 kịch bản 3);
`partialSync: '.upload/<id>'` đi qua `getSyncPaths` (`utils.ts:40-56`, nối đường dẫn con, không kiểm tên) và xóa thư mục
local khi `package.json` không còn trên kho (uninstall). `install`/`uninstall` của manager nhận `source` để tạo
`syncFolder` đúng.

## R4. Mã lỗi: 409 của spec thành 400 `INVALID_PAYLOAD`

[Verified] `@backoffice/errors` không có mã 409 (danh sách `libs/errors/src/codes.ts`); 030 đã đổi 409 → 400 cùng lý do
("không mã lỗi mới", spec 030 "Sửa câu chữ khi plan"). 413 có sẵn: `ContentTooLargeError` (`CONTENT_TOO_LARGE`).

**Decision**: trùng `name` → 400 `INVALID_PAYLOAD` reason `An extension named "<name>" is already installed (<source>)`;
spec FR-004, US2 kịch bản 3, Edge Cases, bảng câu hỏi của guide sửa chữ "409" → "400 `INVALID_PAYLOAD`". Mọi lỗi của
kiểm gói là `INVALID_PAYLOAD` với `reason` khác nhau (contracts/api.md liệt kê).

## R5. Endpoint và khóa

**Decision**: controller mới `backoffice-extensions.controller.ts` `@Controller('backoffice/extensions')` (D-189.6, mẫu
`backoffice-indexes.controller.ts:1-40`): admin (`accountability.admin`), `res.locals.cache = false`.

- `POST upload`: `req.is('multipart/form-data')` bắt buộc (khác → 400); Busboy một file (`limits: { files: 1, fileSize }`),
  bỏ field khác; file stream → `ExtensionsService.installUpload(stream)`; trả 200 `{ data: ApiOutput }` (dòng + schema,
  FR-010). Busboy `limit` → 413. Stream không ghi đĩa trung gian ngoài `bin.tar.tgz` của thư mục tạm (R1 bước 3; tar 7
  giải nén từ file, không từ stream gzip trực tiếp: giữ cách của luồng registry).
- `GET upload`: 200 `{ data: { max_upload_size: number | null } }` (admin) — là probe của web (R8) và cho trình duyệt
  chặn file quá lớn trước khi gửi; Directus 404 (D-212). Rẻ hơn thêm cờ vào `/server/info` (Nguyên tắc III).

Khóa: dùng `withSettingsLock` có sẵn (`lib/settings-lock.ts`, key `extensions-settings`, 30 s) quanh "kiểm trùng name
+ ghi dòng" (sau khi file đã ở đích), thay vì key Redis mới: cùng khóa mà `getExtensionsSettings` dùng khi tạo dòng, nên
hai replica tải cùng `name` cùng lúc hoặc một replica đang reload không chen nhau (FR-013). Kiểm trùng name lần hai
trong khóa (đọc `directus_extensions` + `extensions` của manager); lần đầu (R1) để từ chối sớm trước khi chép lên kho.
Request thua: xóa thư mục `.upload/<id>` vừa chép (local + kho) rồi 400.

Thứ tự `installUpload(stream)`: (a) `installationManager.installFromStream(stream, { source: 'upload', folder: id })`
→ manifest; (b) `withSettingsLock`: kiểm trùng, `extensionsItemService.createOne({ id, enabled: true, folder: id,
source: 'upload', bundle: null })` + `createMany` entry bundle (như `install`, `extensions.service.ts:92-105`); (c)
`extensionsManager.installed({ source: 'upload', folder: id })` = broadcast `partialSync` + `reload({ skipSync: true })`
+ `emitAction('extensions.installed', { extensions, versionId: id })` (tách từ `install`, `manager.ts:251-267`); (d)
`readOne(id)` trả `ApiOutput`. Lỗi ở (b)/(c): xóa file và dòng (nếu có) rồi ném.

`uninstall(id)` [Verified `:107-121`]: nới `source !== 'registry'` thành `!['registry', 'upload'].includes(source)`,
gọi `extensionsManager.uninstall(settings.folder, settings.source)`; thông điệp giữ. `reinstall` giữ nguyên: `upload`
rơi vào `Cannot reinstall extensions that were not installed via marketplace` (400, FR-015 đúng chữ). Dòng "Missing"
nguồn `upload`: `DELETE /extensions/:pk` có sẵn xóa dòng (FR-016, như web "Remove" hiện nay cho local).

## R6. Web

[Verified] `ExtensionsRoute.vue` không có nút nào ở header; `PrivateView` có slot `actions` (dùng ở Content/Files);
`BoUpload` (`components/files/BoUpload.vue`) tự tải lên `/files` qua `uploadFiles` → không dùng được cho endpoint khác
mà không thêm prop. `ExtensionItem.vue:137` chỉ dùng `source` cho link Marketplace; `ExtensionItemOptions.vue:25`
`uninstallLocked = source !== 'registry'`, menu Missing có Reinstall chỉ khi `registry`. Store `stores/extensions.ts`
có `refresh`, `install`, `uninstall`, `remove`. Probe mẫu: `use-collection-indexes.ts:84-93` (404 → `available=false`),
`use-passkey-support.ts` (một probe một API URL).

**Decision**:

- `composables/use-extension-upload.ts`: `available` (GET `/backoffice/extensions/upload` 200 → true, 404/lỗi → false,
  một lần cho mỗi API URL như passkey), `maxUploadSize`, `upload(file): Promise<ApiOutput>` gửi `FormData` (`file`) bằng
  `apiFetch('/backoffice/extensions/upload', { method: 'POST', body: formData })` (không đặt `content-type`, trình
  duyệt đặt boundary; [Unverified] `wrappedFetch` không ép JSON — T0xx kiểm), lỗi → `translateAPIError`.
- `components/ExtensionUploadDialog.vue`: BoDialog với `<input type="file" accept=".tgz,.tar.gz,application/gzip">`
  trong một vùng kéo thả nhỏ (mẫu drop zone của BoUpload, không tái dùng component), tên file đã chọn, `BoNotice` lỗi,
  nút Upload (disabled khi chưa chọn/đang gửi, `aria-busy`), trước khi gửi kiểm `file.size > maxUploadSize` (nếu có) →
  lỗi tại chỗ; thành công → `extensionsStore.refresh()`, `notify` thành công, đóng. Chuỗi overlay en-US/vi-VN khối
  "Spec 031".
- `ExtensionsRoute.vue`: slot `actions` của PrivateView với `BoButton` "Upload" (icon `upload`) `v-if="available"`.
- `ExtensionItem.vue`: `BoChip` "Uploaded"/"Đã tải lên" khi `meta.source === 'upload'` cạnh chip version (FR-018).
- `ExtensionItemOptions.vue`: `uninstallLocked = !['registry', 'upload'].includes(source)`; Missing: Reinstall chỉ
  `registry` (đã vậy), Remove cho mọi source (đã vậy).
- E2E: `settings-extensions-upload.spec.ts` ba cấu hình; fixture `.tgz` đọc từ `tests/fixtures/extensions/<name>/<name>-1.0.0.tgz`
  (R7) qua `setInputFiles`; `allowed-paths.ts` thêm GET/POST `/backoffice/extensions/upload` (id 232, 233) và
  `test-utils/fetch.ts` KNOWN_REQUESTS tương ứng.

## R7. Fixture: các `.tgz` đã có sẵn, không đóng thêm

[Verified] `tests/fixtures/extensions/scripts/build.mjs --pack` (`fixtures:pack`) đã viết `<name>-<version>.tgz` vào
thư mục mỗi fixture **và các file này đã commit** (`parity-endpoint-demo-1.0.0.tgz`, `parity-bundle-tools-1.0.0.tgz`,
…) vì fake registry `tests/parity/registry/server.mjs` phục vụ chúng qua `GET /download/:versionId` (020 T171, compose
mount `../fixtures/extensions:/fixtures:ro`). Spec FR-022 viết "đóng bằng `npm pack` khi build fixture (không commit
`.tgz`)" là sai hiện trạng → sửa: dùng các `.tgz` đã commit; parity và E2E đọc thẳng file.

Gói cho test: `parity-endpoint-demo` (endpoint không sandbox: bị từ chối khi `MARKETPLACE_TRUST=sandbox` — profile
`extensions` đặt mặc định `sandbox` theo `install.test.ts`), `parity-endpoint-sandbox` (endpoint sandbox: cài được, gọi
`/parity-endpoint-sandbox`), `parity-bundle-tools` (bundle: dòng con), một file không phải tar (`package.json`) và một
tar không có manifest (T0xx tạo tạm bằng `tar` trong test). **Lưu ý**: các fixture này cũng đang nạp từ kho dùng chung
dưới tên thư mục local (`helpers.ts FIXTURES`), nên tải `parity-endpoint-sandbox.tgz` lên sẽ 400 trùng `name` → test
trùng tên dùng chính nó; test cài thành công cần một gói có `name` khác: thêm fixture `parity-upload-endpoint`
(endpoint sandbox, `name` riêng, trả `{ ok: true, source: 'upload' }`) có `dist/` và `.tgz` commit như các fixture khác
(`fixtures-build.test.ts` kiểm dist), **không** đưa vào `FIXTURES` (không chép lên kho lúc seed) và registry giả không
cần biết nó. Cùng cách, `parity-upload-bundle` (analyze C1): bundle chỉ app (interface `upload-iface`, display
`upload-display`; manifest DR không cho bundle tùy chọn sandbox, nên bundle có entry API bị từ chối dưới
`MARKETPLACE_TRUST=sandbox`, ca đó dùng `parity-bundle-tools.tgz`), để kiểm dòng entry, app bundle (D-212.2) và gỡ bundle.

## R8. Parity và deploy

[Verified] Profile `extensions`: Directus + Backoffice + Backoffice thứ hai (`multi`) chung DB và `EXTENSIONS_LOCATION=s3`
(`helpers.ts`, `install.test.ts`); `nodes()`, `waitAll`, `extRows()`, `containerLog(service, since)` có sẵn; mọi
install/uninstall đợi `loadedEverywhere`. `accepted-differences.ts` mục `kind: 'doc' | 'http'` theo feature (D-210 mẫu
`:622-640`). `suite.ts:48, :77` gom `src/extensions/**` vào matrix.

**Decision** `tests/parity/src/extensions/upload.test.ts` (chạy sau `install.test.ts`, cùng dọn): (1) Directus
`POST/GET /backoffice/extensions/upload` 404 (D-212 `doc`, `appRequest` từng app); (2) Backoffice tải
`parity-upload-endpoint.tgz` lên: 200 với `meta.source: 'upload'`, `schema.type: 'endpoint'`; `waitAll` cho endpoint
`/parity-upload-endpoint` trả 200 ở cả hai node Backoffice, Directus 404; dòng `extRows()` có `source: 'upload'`,
`folder` = id; kho có `extensions/.upload/<id>/package.json` (`mc ls`); (3) `GET /extensions` của Directus có dòng với
`schema: null`, Backoffice có schema (D-212.2 `http`); (4) **đo D-212.1 (FR-023)**: `compose restart directus-extensions`,
chờ `/server/ping`, `containerLog` không có `error`, `extRows()` không thêm dòng, Directus vẫn 404 endpoint; (5) gói
hỏng ×3 (`package.json` thường, tar không manifest, `parity-endpoint-demo.tgz` không sandbox) → 400 với `reason` đúng,
`extRows()` không đổi, kho không có `.upload/` mới; trùng name (`parity-endpoint-sandbox.tgz`) → 400; user thường 403;
(6) uninstall qua `DELETE /extensions/registry/uninstall/:id` → 204, dòng mất, kho sạch, cả hai node 404 (`waitAll`);
Directus `DELETE` cùng id trước đó → 400 "not installed via marketplace" (D-212.3 `doc`). `accepted-differences.ts`
thêm D-212 (doc), D-212.1 (doc), D-212.2 (http), D-212.3 (doc).

Deploy [Verified] `tests/parity/src/deploy/indexes.test.ts` mẫu (`replicaUrl(n)`, `boLbUrl`, `api`, `waitFor`);
compose deploy có `EXTENSIONS_LOCATION` dùng chung (019, kiểm ở T0xx: `grep EXTENSIONS deploy/compose`). Thêm
`deploy/extension-upload.test.ts`: tải qua `boLbUrl`, gọi `/parity-upload-endpoint` ở `replicaUrl(1..3)` tới khi 200
(≤ 10 s, SC-004), gỡ, tới khi 404.

## Kết quả T001 (2026-11-04, chạy tại chỗ)

- (a) [Verified] `tar` 7.5.19 `extract({ file, cwd })` trên một tar dựng tay: `../escape.txt` bị bỏ (không có file ở thư
  mục cha), `/tmp/abs_escape.txt` bị đặt lại thành `<cwd>/tmp/abs_escape.txt`, symlink `package/link → ../../../../etc`
  rồi `package/link/pwned.txt`: tar thay symlink bằng thư mục, không có `/etc/pwned.txt`. Không gì ra ngoài `cwd`. Còn lại
  một rủi ro: tar chỉ có symlink (không có mục con) để lại symlink trỏ ra ngoài trong `package/`, rồi bước chép lên kho
  (`tmpStorage.list` + `read`) có thể đọc theo nó. Quyết định: với nguồn `upload`, `extract` có `filter` bỏ mục
  `SymbolicLink` và `Link` (gói `npm pack` không chứa link); luồng registry giữ nguyên như DR.
- (b) [Verified] `syncExtensions` (`lib/sync/sync.ts`) gọi `await disk.read(filepath)` không bắt lỗi: file mất giữa `list`
  và `read` làm sync ném, `load()` gọi `process.exit(1)` (đúng bài học 020 với Directus NoSuchKey; registry hôm nay cũng
  vậy). Quyết định (T028): bắt lỗi "không tồn tại" của **một** file khi đọc (`NoSuchKey`/`ENOENT`/`NotFound`), ghi `warn`
  và bỏ qua file đó; lỗi khác vẫn ném như cũ. Comment `Backoffice (spec 031)`.
- (c) [Verified] `deploy/compose/.env.example` đặt `EXTENSIONS_LOCATION=s3` (layout mặc định dùng kho chung); chỉ override
  `docker-compose.shared-extensions.yml` tắt nó. Không cần sửa deploy compose.
- (d) [Verified] `wrappedFetch` của `web/api/sdk.ts` truyền `init` nguyên cho `fetch` (không đặt `content-type`), nên
  `FormData` đi với boundary của trình duyệt.
- (e) [Verified] `semver` không có trong `apps/api/package.json`, `libs/extensions/package.json`, `package.json` gốc: cảnh
  báo `host` so major bằng regex (R3).

## R9. Hai lượt

Lượt 1 API (R1–R5, R7 fixture, R8 parity + deploy, deploy/README); lượt 2 web (R6, E2E, overlay, spec 020 ghi chú,
đóng spec). Lượt 1 xanh cục bộ bằng unit `apps/api` (installation manager với tar thật trong thư mục tạm, service với
knex-mock, controller supertest multipart) và parity `extensions` (`TEST_DB=postgres`, profile `extensions`).
