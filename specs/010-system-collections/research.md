# Research: Collection hệ thống còn lại (010)

Mỗi mục gồm Quyết định, Lý do, Đã cân nhắc. Mốc so sánh là Directus 11.17.4 (api 35.2.0). Điều gì chưa đo thì ghi
`[Suy luận]` và có task kiểm sớm. Quyết định lớn đã chốt ở Clarifications của spec: không gửi báo cáo chủ dự án
(D-38); duyệt registry thật, cấm cài (D-37); nhập chỉ JSON, CSV; cổng đóng feature là 5 file blackbox + bộ đối chiếu +
E2E. Đường dẫn Directus tính từ `directus/api/src` trừ khi ghi khác; đường dẫn app mới tính từ gốc repo.

## R1. Thư viện: thêm ky, papaparse, stream-json, async; không tmp, marked, sanitize-html, rollup

- **Quyết định**: Thêm vào catalog `pnpm-workspace.yaml` đúng bản Directus (`directus/pnpm-workspace.yaml`):
  `ky 1.14.0` (client registry), `papaparse 5.5.3` + `@types/papaparse 5.5.0` (nhập CSV), `stream-json 1.9.1` +
  `@types/stream-json 1.7.8` (nhập JSON theo luồng), `async 3.2.6` + `@types/async 3.2.25` (`queue` của import).
  Đã có: argon2, nanoid 5.1.16 (cùng bảng chữ với 5.1.6), busboy, joi, zod 4.1.12, zod-validation-error, js-yaml,
  js2xmlparser, json2csv, ms, lodash-es, `@backoffice/memory` (`createCache`), `@backoffice/errors`
  (`OutOfDateError`, `ServiceUnavailableError`, `LimitExceededError`, `UnsupportedMediaTypeError`).
  Không thêm: `tmp` (`createTmpFile` của `@directus/utils/node` chỉ dùng `node:fs`, `node:os`, `node:crypto`),
  `marked`, `sanitize-html` (`utils/md.ts` chỉ phục vụ email, D-33, D-36), `rollup` và plugin (bundle extension rỗng
  là một chuỗi hằng, R6), `@directus/extensions-registry` từ npm (kéo theo `@directus/errors`, `@directus/extensions`;
  port 3 module cần dùng, R6).
- **Lý do**: Cùng bản để kết quả nhập, xuất, lỗi registry trùng Directus (SC-002, SC-003). `ky` giữ nguyên vì
  `handleRegistryError` so `error.name` (`TimeoutError`, `HTTPError` của ky) và `error.message` của ky (có retry
  mặc định cho GET 408/413/429/5xx); viết lại bằng `fetch` phải tái tạo cả message lẫn retry.
- **Đã cân nhắc**: Thay `stream-json` + `papaparse` bằng đọc cả file vào bộ nhớ: bị loại, khác giới hạn bộ nhớ và thứ
  tự lỗi (`MAX_IMPORT_ERRORS` đếm theo dòng khi luồng chạy).

## R2. Settings: `SettingsService` đầy đủ thay bản tối giản; `setOwner` không gửi báo cáo

- **Quyết định**: `apps/api/src/services/settings.service.ts` trở thành `class SettingsService extends ItemsService`
  (`directus_settings`) port từ `services/settings.ts`; `setOwner(data)` giữ `upsertSingleton({ project_owner,
  project_usage, org_name, product_updates, project_status: null })` và thay `sendReport(...)` bằng
  `logger.warn('Backoffice: owner report is out of scope; project owner <org_name hoặc "(no org)"> not reported')`
  (không in email; D-38). Bỏ `readProjectInfo()` và SQL viết tay của 001 (`PROJECT_FIELDS`, `CASTS`):
  `server.service.ts` gọi `settingsService.readSingleton({ fields: [...16 field, 'public_background.id',
  'public_background.type'] })` đúng như `services/server.ts:45-66`; bộ đối chiếu `/server/info` của 001 giữ làm
  guard. `authentication.service.ts`, `users.service.ts` đã gọi `readSingleton` nên không đổi.
  `settings.controller.ts`: `GET /` (`readSingleton(req.sanitizedQuery)`, `data || null`), `POST /owner`
  (`setOwner(req.body)`, không body), `PATCH /` (`upsertSingleton` rồi `readSingleton`; `Forbidden` → `204`).
  `useCollection('directus_settings')` trong `app.module.ts`.
- **Lý do**: FR-010 đến FR-012, FR-014; 001 chỉ có SQL viết tay vì chưa có engine; nay engine 004/005 có
  `readSingleton`, `upsertSingleton` (dùng cho mọi singleton của 005). Một đường đọc duy nhất để cache, quyền và
  event (`settings.update`) giống Directus.
- **Đã cân nhắc**: Giữ bản tối giản cạnh bản đầy đủ: bị loại, hai cách đọc một bảng, khác nhau ở cast và quyền.

## R3. `POST /server/setup` và `createAdmin`

- **Quyết định**: Port `utils/create-admin.ts` (`defaultAdminRole`, `defaultAdminPolicy`, `defaultAdminUser`,
  `createAdmin(schema, admin?)`) nguyên: dùng `RolesService`, `PoliciesService`, `AccessService`, `UsersService`
  (004) không accountability; fallback `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_TOKEN` từ env như Directus. Thêm
  `@Post('setup')` vào `server.controller.ts`: `isSetupCompleted()` (đã có) → `403`; `createAdmin(req.schema, {...})`
  rồi `settingsService.setOwner(req.body)` **không await** (Directus cũng không), `Forbidden` bên trong → `204`;
  `respond`. Ba biến `ADMIN_*` chuyển từ nhóm B sang nhóm A (`PROJECT_OWNER` ở lại B vì chỉ `bootstrap` đọc).
- **Lý do**: FR-013, gỡ D-14. Directus đọc `ADMIN_*` trong `createAdmin` khi body thiếu `project_owner`, nên app mới
  đọc giống (Nguyên tắc VIII; nhóm B nghĩa là "bị bỏ qua không cảnh báo", chuyển sang A không đổi hành vi nhìn thấy).
- **Đã cân nhắc**: Chặn `/server/setup` khi `ADMIN_*` không có trong body: bị loại, khác Directus.

## R4. Shares: `SharesService` port nguyên; `/shares/auth` dùng cookie của 003

- **Quyết định**: `services/shares.service.ts` port `services/shares.ts`: `createOne` (`validateAccess` action
  `share`), `updateMany`, `deleteMany` (`clearCache` của `permissions/cache.ts`), `login` (knex thô như Directus:
  chọn share theo hạn và `max_uses >= times_used`, argon2, tăng `times_used`, JWT `issuer: directus` với `getSecret`,
  `nanoid(64)`, ghi `directus_sessions`, xóa phiên hết hạn), `invite` (đọc share, người mời, dựng `message` và subject
  như Directus rồi `logger.warn('Backoffice: mail sending is out of scope; share invitation "<subject>" for <email>
  not sent')` mỗi email, D-36; không `md()`). `shares.controller.ts` theo thứ tự route của Directus: `POST /auth`
  (joi `sharedLoginSchema`; `mode` → body/cookie với `REFRESH_COOKIE_OPTIONS`, `SESSION_COOKIE_OPTIONS` của
  `constants.ts`, như `auth.controller.ts`), `POST /invite` (joi `sharedInviteSchema`), `POST /`, `GET /`, `SEARCH /`,
  `GET /info/:pk`, `GET /:pk`, `PATCH /`, `PATCH /:pk`, `DELETE /`, `DELETE /:pk`. `/info/:pk` và mọi `/:pk` chỉ nhận
  uuid (Express 4 regex param, `shares.ts:150, 199, 251, 299`): handler kiểm `UUID_REGEX` không phân biệt hoa thường,
  không khớp → `RouteNotFoundError` (như R3 của 009; `/shares/<không uuid>` không khớp route nào ở Directus, sửa
  2026-10-14 khi làm T004). Token
  share, refresh, logout và `getPermissionsForShare` đã có từ 003/004 (`src/auth/shares.test.ts` tạo share ở
  Directus; nay tạo ở mỗi app).
- **Lý do**: FR-040 đến FR-046. `login` không qua `ItemsService` nên không có event, activity (như Directus).
- **Đã cân nhắc**: Dùng `AuthenticationService.login` cho share: bị loại, payload JWT và cột `directus_sessions` khác.

## R5. Presets, notifications, translations, dashboards, panels: controller theo mẫu 008

- **Quyết định**: Bốn service nhỏ: `PresetsService` (đã có), `DashboardsService`, `PanelsService` (lớp con trơn),
  `TranslationsService` (port nguyên: `translationKeyExists`, `createOne`, `updateMany` với hai nhánh lỗi
  "Duplicate key and language combination"); `NotificationsService` giữ nguyên (008, D-33). Năm controller
  `presets|notifications|translations|dashboards|panels.controller.ts` cùng khuôn `comments.controller.ts` (`POST /`
  đơn và mảng, `GET`, `SEARCH` với `validateBatch('read')` qua `runMiddleware`, `GET /:pk`, `PATCH /` (`keys` hoặc
  `query`), `PATCH /:pk`, `DELETE /` (mảng hoặc `keys`/`query`), `DELETE /:pk`; `Forbidden` khi đọc lại → `204`);
  `useCollection` tương ứng trong `app.module.ts`; `getService` thêm `directus_dashboards`, `directus_panels`,
  `directus_settings`, `directus_shares`, `directus_translations`; `COLLECTIONS_WITHOUT_SERVICE_YET` còn ba
  collection deployment (comment đổi: lâu dài, Nguyên tắc XI).
- **Lý do**: FR-020, FR-021, FR-030, FR-031, FR-050, FR-060, FR-061; năm controller Directus giống nhau từng dòng trừ
  tên service, nên khuôn 008 dùng lại nguyên.
- **Đã cân nhắc**: Một controller chung tham số hóa theo collection: bị loại, khác cấu trúc Directus (Nguyên tắc VI,
  "mỗi service một provider, controller mỏng" và bảng ánh xạ file một–một).

## R6. Extensions: không có extension manager; registry port 3 module; bundle rỗng là hằng

- **Quyết định**: `services/extensions.service.ts` viết mới (ghi `Backoffice:`), chỉ phần đọc:
  `readAll()` = `ItemsService('directus_extensions', {accountability}).readByQuery({ limit: -1 })` → với dòng
  `bundle === null`: `{ id, bundle, meta, schema: null }`; dòng có `bundle`: bỏ (Directus bỏ khi cha không có
  `schema`, tức extension không được nạp — đúng trạng thái "không có extension nào được nạp"); DB trống → `[]`.
  Không có `install`, `reinstall`, `uninstall`, `updateOne`, `deleteOne`.
  Registry: port `directus/packages/extensions-registry/src` trừ module `download` vào
  `apps/api/src/extensions/registry/` (`list`, `describe`, `account`, `getApiVersion` với memo 6 giờ như Directus,
  `assertVersionCompatibility` so `SUPPORTED_VERSION = '2024-01-29'`, schema zod, `constructUrl`,
  `DEFAULT_REGISTRY = 'https://registry.directus.io'`) kèm test gốc; `controllers/utils/handle-registry-error.ts` port
  nguyên. `extensions.controller.ts`: `GET /` (`readAll`), `GET /registry` (dựng `ListQuery` như Directus, `sandbox`
  khi `MARKETPLACE_TRUST === 'sandbox'`, `registry` từ `MARKETPLACE_REGISTRY`), `GET /registry/account/:pk`,
  `GET /registry/extension/:pk`, `POST /registry/install`, `POST /registry/reinstall`, `DELETE /registry/uninstall/:pk`
  (kiểm admin, kiểm body/uuid như Directus rồi ném `ServiceUnavailableError({ service: 'marketplace', reason:
  'Backoffice does not install extensions' })`), `PATCH /:pk`, `DELETE /:pk` (kiểm admin rồi `ForbiddenError`),
  `GET /sources/:chunk`. Mọi `:pk` của Directus là regex uuid: handler kiểm `UUID_REGEX` (hoa thường), không khớp →
  `RouteNotFoundError`.
  Bundle: Directus chỉ sinh bundle khi `SERVE_APP` bật (`extensions/manager.ts:304`, mặc định `true`) bằng rollup từ
  entrypoint `export const interfaces = [];export const displays = [];...` (7 loại `APP_EXTENSION_TYPES` +
  `HYBRID_EXTENSION_TYPES`). Đo bằng rollup 4.59.0 + `@rollup/plugin-virtual` 3.0.2 (bản của Directus) ngày
  2026-10-14 trên entrypoint rỗng, chunk `_virtual_entry.js`:
  `const interfaces = [];const displays = [];const layouts = [];const modules = [];const panels = [];const themes = [];const operations = [];\n\nexport { displays, interfaces, layouts, modules, operations, panels, themes };\n`.
  App mới trả đúng chuỗi này (hằng `EMPTY_APP_EXTENSION_BUNDLE` trong `extensions.service.ts`) cho `index.js` khi
  `SERVE_APP` truthy, với `Content-Type: application/javascript; charset=UTF-8`, `Cache-Control` =
  `getCacheControlHeader(req, getMilliseconds(EXTENSIONS_CACHE_TTL), false, false)` (`no-cache` khi biến không đặt,
  `no-store` khi request bỏ cache), `Vary: Origin, Cache-Control`; chunk khác hoặc `SERVE_APP` tắt →
  `RouteNotFoundError`. `[Suy luận]` bundle thật của container Directus trùng chuỗi đo: task đầu của extensions so
  byte với `GET /extensions/sources/index.js` của Directus trong môi trường đối chiếu.
  Cảnh báo `SERVE_APP_MESSAGE` (D-08) giữ nguyên: app web vẫn không được phục vụ; `SERVE_APP` nay được đọc cho một
  route (ghi ở contracts/config.md của 001).
- **Lý do**: FR-070 đến FR-072, D-37, Clarifications. Không có `ExtensionManager` (Nguyên tắc XI) nên `schema` luôn
  `null`; giữ `ItemsService` với accountability của người gọi để quyền giống Directus (`directus_extensions` không có
  trong quyền tối thiểu app access: user thường nhận `403` như Directus; đo ở task đầu).
- **Đã cân nhắc**: Trả `[]` cho mọi `GET /extensions`: bị loại, Directus có cài extension (dòng
  `directus_extensions` do Directus ghi) thì app mới phải thấy dòng đó. Gọi rollup lúc chạy: bị loại, thêm 5 gói cho
  một chuỗi hằng.

## R7. Utils: `UtilsService`, `ImportService`, `ExportService.exportToFile`, `generateTranslations`

- **Quyết định**:
  - `services/utils.service.ts` port `services/utils.ts` nguyên (`sort` với knex thô, `systemCollectionRows` của
    `@backoffice/system-data`, `validateAccess`, `fetchAllowedFields`, `shouldClearCache`, `emitter.emitAction`
    `items.sort`; `clearCache` với `clearSystemCache({ forced: true })` và `cache.clear()`).
  - `services/import-export.service.ts` thêm phần còn lại của `services/import-export.ts`: `ImportService` (`import`,
    `importJSON` với `StreamArray`, `importCSV` với `Papa.parse`, gom lỗi tới `MAX_IMPORT_ERRORS`, `queue` của
    `async`, thông báo khi `background`), `ExportService.exportToFile` (transaction, lô `EXPORT_BATCH_SIZE`, `sort`
    thêm khóa chính, `getHeadingsForCsvExport` với `parseFields`, `createTmpFile`, `FilesService.uploadOne`, thông báo
    thành công/thất bại), `getHeadingsForCsvExport`. Port thêm `utils/store.ts` (`useStore` trên `createCache` của
    `@backoffice/memory`, `redisConfigAvailable`, `useRedis`), `utils/destroy-piped-stream.ts`, và
    `directus/packages/utils/node/tmp.ts` → `libs/utils/src/node/tmp.ts` (`createTmpFile`), kèm test gốc.
  - `utils/generate-translations.ts`, `utils/translations-shared.ts`, `utils/translations-validation.ts` port nguyên
    kèm hai file test gốc (`CollectionsService`, `FieldsService`, `RelationsService`, `getSchema`, `transaction`,
    `emitter` đã có).
  - `utils.controller.ts` theo thứ tự route Directus: `GET /random/string` (joi), `POST /hash/generate`,
    `POST /hash/verify` (`generateHash`, `argon2.verify`), `POST /sort/:collection` (`runMiddleware(collectionExists)`
    rồi joi), `POST /revert/:revision` (`RevisionsService.revert`, `respond`), `POST /import/:collection`
    (`collectionExists`; `req.is('multipart/form-data') === false` → `415`; busboy trên `req` thô như
    `files.controller.ts` — `json-body` chỉ parse `application/json` nên luồng multipart còn nguyên; `background` qua
    `toBoolean(req.query.background)`), `POST /export/:collection` (`collectionExists`; `400` thiếu `query`, `format`;
    `sanitizeQuery`; gọi `exportToFile` không await; `respond`), `POST /translations/generate` (admin;
    `generateTranslations`; `clearSystemCache({ forced: true })` lỗi chỉ log), `POST /cache/clear`
    (`'system' in req.query && (=== '' || Boolean(...))`), `POST /resolve-redirect`. Không `useCollection`.
- **Lý do**: FR-080 đến FR-088, FR-051. Mọi phụ thuộc đã có từ 004 đến 009 trừ bốn gói R1.
- **Đã cân nhắc**: Bỏ `useStore` và đếm import cục bộ: bị loại, `IMPORT_MAX_CONCURRENCY` phải đếm chung với Directus
  (FR-102). Ghi file xuất thẳng vào storage không qua file tạm: bị loại, khác `FilesService.uploadOne` (metadata,
  tên file phát sinh của 007).

## R8. Không gửi email: kiểm tra tự động các chỗ `new MailService`

- **Quyết định**: Unit test `apps/api/src/services/mail-sites.guard.test.ts`: quét `directus/api/src/**/*.ts` (bỏ
  `*.test.ts`) tìm `new MailService(`, so tập file với danh sách cố định 6 file (`services/users.ts` 3 chỗ,
  `services/notifications.ts`, `services/shares.ts`, `operations/mail/index.ts`) và với mỗi file kiểm file app mới
  tương ứng (`users.service.ts`, `notifications.service.ts`, `shares.service.ts`, `operations/mail/index.ts`) có
  chuỗi `mail sending is out of scope`. Dòng log của `shares.invite` theo cùng mẫu của D-33, D-34 (R4).
- **Lý do**: FR-090, FR-091, SC-005: bản Directus sau thêm chỗ gửi mail thì test đỏ, không bỏ sót.
- **Đã cân nhắc**: Guard bằng script shell trong CI: bị loại, vitest đã chạy trong `quality` và có coverage.

## R9. Biến môi trường: 11 biến sang nhóm A, không biến mới

- **Quyết định**: `SUPPORTED_VARIABLES` thêm khối Feature 010: `IMPORT_TIMEOUT`, `IMPORT_MAX_CONCURRENCY`,
  `IMPORT_EXPORT_NAMESPACE`, `MAX_IMPORT_ERRORS`, `EXPORT_BATCH_SIZE`, `EXTENSIONS_CACHE_TTL`,
  `MARKETPLACE_REGISTRY`, `MARKETPLACE_TRUST`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_TOKEN` (ba biến cuối rời
  `NOT_APPLICABLE_VARIABLES`). `EMAIL_*`, `TELEMETRY*`, `COMPLIANCE_URL`, `EXTENSIONS_*` khác giữ nhóm C.
  `specs/001-platform-foundation/contracts/config.md` §5 cập nhật; `SERVE_APP` ghi chú (R6).
- **Lý do**: FR-095; mặc định đọc từ `@backoffice/env` (port của `packages/env`) đã có đủ.
- **Đã cân nhắc**: Không có.

## R10. Bộ đối chiếu `tests/parity/src/system/`

- **Quyết định**: 13 file (contracts/parity.md §2): `helpers.ts`, `settings`, `presets`, `notifications`, `shares`,
  `translations`, `insights` (dashboards + panels), `extensions`, `utils-misc` (random, hash, sort, revert,
  cache/clear, resolve-redirect, translations/generate), `import-export`, `setup` (cặp `setup`, chỉ Postgres),
  `e2e-app`, và blackbox `mail.test.ts` trong cây `src/items/blackbox/tests/db/mail/`. Dùng `scenario()`, `step()`,
  `same()`, `historyEffects` của 003/008; so dòng DB qua `hostDb()`; băm argon2 so chéo (`verify` ở app kia); JWT so
  payload trừ `iat`, `exp`, `session`; file xuất đọc qua `/assets/:id` ở hai app và so byte sau khi thay
  `getDateTimeFormatted()` trong `title`, `filename_download`; log cảnh báo đếm bằng `logs(service)` của `docker.ts`.
  `REDUCED_FILES` thêm `src/system/{settings,presets,notifications,shares,translations,insights,utils-misc}.test.ts`;
  `FULL_FILES` thêm `src/system/**/*.test.ts`.
- **Lý do**: FR-100, FR-102, SC-002 đến SC-005; tiền lệ 008, 009.
- **Đã cân nhắc**: Viết blackbox mới theo định dạng Directus: bị loại ở Clarifications.

## R11. Cặp `setup` có DB riêng (Postgres), không phải profile thủ công

- **Quyết định**: Compose thêm `postgres-setup` (`postgis/postgis:13-3.4-alpine`, `POSTGRES_DB=directus`, cổng host
  `6112`), `directus-setup` (`10455`), `backoffice-api-setup` (`10456`), profile `setup`;
  `env/profile-setup.env`: `DB_HOST=postgres-setup`, `ADMIN_EMAIL=`, `ADMIN_PASSWORD=` (rỗng: `bootstrap` của image
  Directus tạo role và policy Administrator nhưng không tạo user, `createAdmin` dừng ở `if (!adminEmail ||
  !adminPassword) return`), `REDIS=redis://redis:6379/9` (db index riêng: cô lập mọi namespace cache, bus, lock,
  quyền, sync khỏi cặp chính vì khác DB), `PUBLIC_URL=http://localhost:10455`. Backoffice khởi động sau
  `directus-setup` healthy (migration đã chạy). Không thuộc `manualProfiles` (DB riêng, không phá suite khác); vào
  `--profiles` của job parity Postgres `full` và job `e2e-directus-app`. `setup.test.ts`: `describe.skipIf(vendor !==
  'postgres' || !hasProfile('setup'))`; `setupDb()` là knex tới `127.0.0.1:6112`; chuỗi: `GET /server/info` hai app
  (setup chưa xong) → `POST /server/setup` ở Directus (ghi lại dòng mới của `directus_roles`, `directus_policies`,
  `directus_access`, `directus_users`, `directus_settings`) → xóa các dòng vừa tạo → cùng request ở app mới → so
  dòng sau chuẩn hóa id, băm, thời điểm → gọi lại khi đã có user → `403` ở cả hai → xóa để lượt sau còn chạy.
- **Lý do**: FR-013, SC-003; `isSetupCompleted` chỉ `false` khi `directus_users` trống, không thể làm trên DB chung.
  `hostDbEnv` chỉ hỗ trợ postgres/sqlite3 nên một vendor là đủ (DDL không liên quan).
- **Đã cân nhắc**: Profile thủ công như `retention`: không cần, DB riêng. Xóa user trên DB chung rồi tạo lại: bị
  loại, phá mọi suite đang chạy song song. Một DB phụ trong container `postgres` chính (init script): bị loại, image
  postgis không có `POSTGRES_MULTIPLE_DATABASES`, thêm script init cho một pair.

## R12. Registry giả `tests/parity/registry/server.mjs`

- **Quyết định**: Dịch vụ compose `registry` (image `node:22-alpine`, `node /registry/server.mjs`, cổng trong mạng
  `9100`, không profile: luôn chạy như `redis`), chỉ `node:http`: `GET /version` → `{ "version": "2024-01-29" }`;
  `GET /extensions` → fixture 5 extension (lọc `search`, `type`, `by`, `sandbox`; `sort` `popular|recent|downloads`;
  `limit`, `offset`; `meta.filter_count`) theo `RegistryListResponse`; `GET /extensions/:id` → fixture theo
  `RegistryDescribeResponse`; `GET /accounts/:id` → `RegistryAccountResponse`; id lạ → `404` JSON. Mỗi
  `env/<vendor>.env` thêm `MARKETPLACE_REGISTRY=http://registry:9100`. Fixture được kiểm bằng unit test với schema
  zod đã port (`apps/api/src/extensions/registry/*.test.ts` đọc file fixture) để registry giả và client không lệch.
- **Lý do**: FR-072, FR-100; so happy path của duyệt registry mà không phụ thuộc mạng ngoài; lỗi (`404`, không kết
  nối) cho cùng `503` ở hai app vì cùng `ky`.
- **Đã cân nhắc**: Dùng registry thật: bị loại, kết quả đổi theo thời gian và cần mạng ngoài trong CI. Gộp vào
  `idp/server.mjs`: bị loại, `idp` chỉ chạy ở profile `sso`.

## R13. Playwright: `system.spec.ts` và `setup.spec.ts`

- **Quyết định**: `tests/directus-app-e2e/src/system.spec.ts` qua proxy (cổng 8160) với `bothRuns`: cài đặt dự án
  (tên, màu, logo, theme, CSS), bookmark và preset layout, chuông thông báo (đọc, lưu trữ), sidebar chia sẻ (tạo có
  mật khẩu, thời hạn, số lần dùng; mở `/admin/shared/<id>`, nhập mật khẩu, xem item), Settings > Translations,
  Insights (dashboard, thêm, di chuyển, xóa panel), sắp xếp tay trong bảng, sidebar xuất (file xuất xuất hiện trong
  Files, thông báo) và nhập (CSV), Marketplace (duyệt danh sách từ registry giả, bấm cài → lỗi). `setup.spec.ts`: mở
  app của `directus-setup` (`http://localhost:10455/admin`, màn cài đặt lần đầu vì chưa có user); lượt Backoffice dùng
  `page.route('**/server/setup', route => route.fetch({ url: <backoffice-setup>/server/setup }))` để request đi tới
  app mới (không cần proxy thứ hai); so dòng DB tạo ra ở hai lượt, xóa giữa hai lượt bằng knex tới `6112`.
  `routing.spec.ts` thêm 9 segment; `backoffice-routes.txt` thêm từng dòng **cùng task đăng ký controller** (bài học
  009: app Directus gọi `/settings`, `/presets`, `/notifications`, `/translations`, `/extensions` khi hydrate).
- **Lý do**: FR-103, SC-006.
- **Đã cân nhắc**: Proxy thứ hai cho cặp `setup`: bị loại, một `page.route` 5 dòng đủ.

## R14. Benchmark `tests/benchmark/src/system.ts`

- **Quyết định**: Seed `seed-system.ts`: 200 preset của user benchmark, 1.000 thông báo (`inbox` 500), 20 dashboard
  × 10 panel, collection 1.000 item có `sort_field`, 1 share có mật khẩu. Kịch bản: `settings-get` (`GET /settings`,
  admin), `presets-list` (query của `stores/presets.ts`, user), `notifications-count` (`GET /notifications?
  aggregate[count]=*&filter[recipient][_eq]=$CURRENT_USER&filter[status][_eq]=inbox`), `dashboards-panels`
  (`GET /dashboards?fields[]=*&fields[]=panels.*&limit=-1`), `shares-auth` (`POST /shares/auth`, 10 kết nối, argon2),
  `utils-sort` (`POST /utils/sort/<c>`, 10 kết nối, không chặn: chỉ ghi số vì mỗi lần ghi đổi dữ liệu). 50 kết nối
  cho các kịch bản đọc, 3 vòng, ngưỡng 10%; job `benchmark-system` cùng mẫu `benchmark-history`; hằng tuần.
- **Lý do**: FR-104, SC-006.
- **Đã cân nhắc**: Benchmark import/export: bị loại, chạy nền và ghi file, kết quả không đo được qua response.

## R15. Blackbox: port `mail.test.ts`, chuyển `/presets`, `/utils/cache/clear` sang app đang kiểm

- **Quyết định**: Copy `tests/db/mail/mail.test.ts` vào `src/items/blackbox/tests/db/mail/` với khối SMTP giả bỏ đi
  (Backoffice: không có máy chủ thư; ở Directus của cặp blackbox `EMAIL_TRANSPORT` mặc định `sendmail` không có
  binary, Directus ghi lỗi gửi và vẫn trả `200`): kiểm `200`, hai dòng `directus_notifications` (đọc qua
  `GET /notifications` của app) và, khi `PARITY_BLACKBOX_APP=backoffice`, hai dòng log
  `mail sending is out of scope` mới trong `logs('backoffice-api-blackbox')`; bỏ `sleep(5000)`. `common/functions.ts`
  gửi `/utils/cache/clear?system` tới `getSetupUrl()`; `cache-blackbox.test.ts` (port của `app/cache.test.ts`,
  `cache-purge.test.ts`) gửi `/presets`, `/utils/cache/clear` tới app đang kiểm; `schema-cache.test.ts` đã dùng
  `getUrl`. Comment "/utils is feature 010" ở `common/config.ts` sửa thành chỉ GraphQL (011).
- **Lý do**: FR-101, Clarifications (cổng đóng feature); `mail.test.ts` nguyên văn không thể đạt khi không gửi email.
- **Đã cân nhắc**: Thêm SMTP giả (mailpit) cho Directus của cặp blackbox để giữ kiểm gốc: bị loại, thêm container và
  đổi env Directus chỉ để chứng minh Directus gửi mail, không phải mục tiêu của bộ đối chiếu.

## R16. Controller Nest và `router-options`

- **Quyết định**: Mỗi controller một file, thứ tự handler đúng thứ tự route Directus (Nest khớp theo thứ tự khai
  báo: `shares/auth`, `shares/invite`, `shares/info/:pk` trước `shares/:pk`; `extensions/registry/*`,
  `extensions/sources/:chunk` trước `extensions/:pk`). `router-options.ts` thêm khối Feature 010 với các mẫu và
  phương thức ở contracts/system-api.md §10 và utils-api.md §12 (đo `OPTIONS`, `HEAD` ở task đầu mỗi controller).
  `providers.ts` thêm factory cho `PresetsService`, `SharesService`, `TranslationsService`, `DashboardsService`,
  `PanelsService`, `ExtensionsService`, `UtilsService`, `ImportService`, `ExportService`.
- **Lý do**: Nguyên tắc VI; tiền lệ 008, 009.
- **Đã cân nhắc**: Không có.
