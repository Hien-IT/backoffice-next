# Feature Specification: Collection hệ thống còn lại (`/settings`, `/presets`, `/notifications`, `/shares`, `/translations`, `/dashboards`, `/panels`, `/extensions`, `/utils`)

**Feature Branch**: `010-system-collections`
**Created**: 2026-10-14
**Status**: Done
**Duyệt khác biệt**: tech lead đã duyệt ngày 2026-10-14 gỡ D-09.8, D-14 (spec 001); D-31 lâu dài (chỉ còn ba collection
deployment, spec 004); thêm D-36, D-38 (`doc`), D-37 (`doc` + `http`); rủi ro R-25 đến R-29 (đã đo); hai lệch có chủ đích
so với mã gốc (`BusRedis` subscriber bỏ ready check; giữ `stream-json` 1.9.1); và đóng spec (Nguyên tắc X; quy trình
không có PR)
**Input**: User description: "App mới cung cấp các endpoint hệ thống còn lại giống hệt Directus: /settings (cài đặt dự án, theme, branding), /presets (preset và bookmark của layout), /notifications (lưu và hiển thị trong app, không gửi email), /shares (chia sẻ item bằng link, mật khẩu, thời hạn, số lần xem, đăng nhập bằng share), /translations (chuỗi dịch tùy chỉnh), /dashboards và /panels (insights), /extensions (chỉ trả danh sách rỗng hoặc tối thiểu, vì chưa hỗ trợ extension), /utils (hash/generate, hash/verify, random/string, sort, revert, cache/clear, import, export với CSV, JSON, XML, YAML), Không gửi email: mọi chỗ Directus gửi mail thì bỏ qua bước gửi và ghi log cảnh báo, phần còn lại của luồng chạy như cũ. Tham chiếu các service tương ứng trong directus/api/src/services. Tiêu chí chấp nhận: blackbox test của các endpoint này chạy qua trên app mới."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/api/src` trừ khi ghi khác):

- Route: `controllers/settings.ts` (`GET /`, `PATCH /`, `POST /owner`), `controllers/presets.ts`,
  `controllers/notifications.ts`, `controllers/translations.ts`, `controllers/dashboards.ts`, `controllers/panels.ts`
  (CRUD với `useCollection`, `validateBatch`, `respond`), `controllers/shares.ts` (`POST /auth`, `POST /invite`, CRUD,
  `GET /info/:pk(uuid)`), `controllers/extensions.ts` (`GET /`, `GET /registry`, `GET /registry/account/:pk`,
  `GET /registry/extension/:pk`, `POST /registry/install`, `POST /registry/reinstall`,
  `DELETE /registry/uninstall/:pk`, `PATCH /:pk`, `DELETE /:pk`, `GET /sources/:chunk`;
  `controllers/utils/handle-registry-error.ts`), `controllers/utils.ts` (`GET /random/string`, `POST /hash/generate`,
  `POST /hash/verify`, `POST /sort/:collection`, `POST /revert/:revision`, `POST /import/:collection`,
  `POST /export/:collection`, `POST /translations/generate`, `POST /cache/clear`, `POST /resolve-redirect`),
  `controllers/server.ts` (`POST /setup`); `middleware/collection-exists.ts`, `respond.ts`, `validate-batch.ts`,
  `use-collection.ts`.
- Service: `services/settings.ts` (`setOwner`), `services/presets.ts`, `services/dashboards.ts`, `services/panels.ts`
  (lớp con trơn của `ItemsService`), `services/notifications.ts` (`createOne`, `sendEmail`), `services/shares.ts`
  (`createOne` kiểm quyền `share`, `updateMany`, `deleteMany` xóa cache quyền, `login`, `invite`),
  `services/translations.ts` (chặn trùng `key` + `language`), `services/extensions.ts` (`readAll`, `readOne`,
  `updateOne`, `deleteOne`, `install`, `reinstall`, `uninstall`), `services/utils.ts` (`sort`, `clearCache`),
  `services/import-export.ts` (`ImportService.import`, `importJSON`, `importCSV`, `ExportService.exportToFile`,
  `transform`), `services/server.ts` (`isSetupCompleted`), `services/revisions.ts` (`revert`, đã port ở 008);
  `utils/get-service.ts`, `utils/create-admin.ts`, `utils/generate-hash.ts`, `utils/generate-translations.ts`,
  `utils/translations-shared.ts`, `utils/store.ts` (bộ đếm import dùng chung trên Redis), `telemetry/lib/send-report.ts`,
  `schedules/project.ts`, `permissions/utils/get-permissions-for-share.ts` (đã port ở 004).
- Chỗ gửi email của Directus 11.17.4 (`new MailService`): `services/users.ts` (mời user, xác minh đăng ký, quên mật
  khẩu), `services/notifications.ts` (`sendEmail`), `services/shares.ts` (`invite`), `operations/mail/index.ts`.
- Biến mặc định (`directus/packages/env/src/constants/defaults.ts`): `IMPORT_EXPORT_NAMESPACE='directus:import-export'`,
  `IMPORT_TIMEOUT='1h'`, `IMPORT_MAX_CONCURRENCY=20`, `MAX_IMPORT_ERRORS=1000`, `EXPORT_BATCH_SIZE=5000`,
  `MARKETPLACE_TRUST='sandbox'`, `TELEMETRY=true`, `TELEMETRY_URL`, `COMPLIANCE_URL='https://telemetry.directus.io'`.
- Cột hệ thống: `directus/packages/system-data/src/fields/settings.yaml`, `presets.yaml`, `notifications.yaml`,
  `shares.yaml` (`password` có `special` `hash`, `conceal`), `translations.yaml`, `dashboards.yaml`, `panels.yaml`,
  `extensions.yaml`; quyền tối thiểu app access (`app-access-permissions/app-access-permissions.yaml`):
  `directus_presets` (read, create, update, delete theo `user`), `directus_settings` (read), `directus_translations`
  (read), `directus_notifications` (read và update field `status` theo `recipient`), `directus_shares` (read theo
  `user_created`).
- App Directus (client của feature này): `stores/settings.ts` (`GET`, `PATCH /settings`, `POST /settings/owner`),
  `stores/presets.ts`, `stores/notifications.ts`, `stores/translations.ts`, `stores/extensions.ts`,
  `extensions.ts` (`import extensions/sources/index.js`), `modules/insights` (`/dashboards`, `/panels`),
  `views/shared` và sidebar chia sẻ (`/shares`, `/shares/info/:id`, `/shares/auth`), `interfaces/_system/
  system-collections-translations` (`/utils/translations/generate`), sidebar xuất nhập (`/utils/export`,
  `/utils/import`), bảng có sắp xếp tay (`/utils/sort`), `views/private/components/license-banner.vue` (owner).

**Đã có từ feature 001 đến 009** (trong `apps/api/src` và `libs/`): engine đọc ghi và quyền (004, 005), response
cache, `Emitter`, cầu nối websocket (005), `PresetsService`, `NotificationsService` (D-33: ghi log thay vì gửi email),
`RevisionsService.revert` (chưa có route), `ExportService.transform` (chỉ cho query `export` của 005),
`FilesService.uploadOne` (007), `getPermissionsForShare`, `fetchShareInfo`, đăng nhập và refresh phiên share (003),
`resolveLoginRedirect` (003), `generateHash`, bản `SettingsService` tối giản chỉ đọc 17 field cho `/server/info`,
`FlowManager` (event của các collection này đã chạy được khi Directus phát). `getService` còn cho `directus_dashboards`,
`directus_panels`, `directus_settings`, `directus_shares`, `directus_translations` (và ba collection deployment) đi
qua `ItemsService` chung (D-31). Chưa có: mọi route ở trên (D-09.8), `POST /server/setup` (D-14), `SharesService`,
`TranslationsService`, `DashboardsService`, `PanelsService`, `ExtensionsService`, `UtilsService`, `ImportService`,
`ExportService.exportToFile`, `createAdmin`, `generateTranslations`; biến `IMPORT_*`, `EXPORT_BATCH_SIZE`,
`MAX_IMPORT_ERRORS` còn ở nhóm "chưa hỗ trợ".

**Bộ test liên quan của Directus** (số khối `it`/`test` đếm bằng grep, chốt lại ở plan): Directus không có bộ
blackbox riêng cho các route này. File blackbox chạm tới chúng: `tests/blackbox/tests/db/mail/mail.test.ts` (1:
`POST /notifications` với hai thông báo, chờ hai email ở SMTP giả), `tests/db/app/cache.test.ts` (6: `/presets`,
`/utils/cache/clear`, `CACHE_AUTO_PURGE_IGNORE_LIST`), `tests/db/routes/collections/schema-cache.test.ts` (2) và
`tests/db/routes/permissions/cache-purge.test.ts` (1) (`/utils/cache/clear`), `common/functions.ts`
(`/utils/cache/clear?system`). Unit: `services/import-export.test.ts` (37), `services/extensions.test.ts` (1),
`utils/generate-translations.test.ts` (23), `utils/translations-shared.test.ts` (3),
`permissions/utils/get-permissions-for-share.test.ts` (6, đã port ở 004). Bản port hiện tại gửi `/presets` và
`/utils/cache/clear` tới Directus của cặp blackbox (`getDirectusUrl`, `cache-blackbox.test.ts`); `mail.test.ts` chưa
port.

## Clarifications

### Session 2026-10-14

- Q: Báo cáo chủ dự án mà Directus gửi tới `COMPLIANCE_URL` (`POST /settings/owner`, `POST /server/setup`): app mới
  làm gì? → A: Không gửi; ghi các field chủ dự án với `project_status = null` như khi Directus gửi thành công và ghi
  một dòng log cảnh báo (FR-012, FR-013, D-38).
- Q: Route registry và quản lý extension (`/extensions/registry*`, `PATCH`, `DELETE /extensions/:pk`) trả gì cho admin?
  → A: Duyệt thật, cấm cài: `GET /registry`, `/registry/account/:pk`, `/registry/extension/:pk` gọi registry như
  Directus; `install`, `reinstall`, `uninstall` trả `503`; `PATCH`, `DELETE /:pk` trả `403` (FR-072, D-37).
- Q: Mô tả ghi "import, export với CSV, JSON, XML, YAML", Directus chỉ nhập JSON, CSV: app mới nhập những định dạng
  nào? → A: Giống hệt Directus: nhập JSON, CSV (XML, YAML trả `415`); xuất `csv`, `csv_utf8`, `json`, `xml`, `yaml`;
  không thêm khác biệt (FR-084, FR-085).
- Q: Directus chỉ có 5 file blackbox chạm các route này; cổng đóng feature là gì? → A: Port 5 file đó (`mail.test.ts`
  ở app mới kiểm 0 email và 2 dòng log cảnh báo) cộng bộ đối chiếu hai app cho mọi route và E2E app Directus, cả ba
  cùng chặn đóng feature, như 008; không viết thêm bộ blackbox mới (FR-100 đến FR-103, SC-001, SC-002, SC-006).

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là người dùng app Directus (cài đặt dự án, bookmark và preset layout, chuông thông báo,
chia sẻ item, chuỗi dịch, Insights, xuất nhập dữ liệu, sắp xếp tay), người nhận link chia sẻ (không có tài khoản),
client gọi API (`@directus/sdk`, script) và admin cài đặt dự án lần đầu.

### User Story 1 - Cài đặt dự án, theme, branding dùng chung giữa hai app (Priority: P1)

Admin đổi tên dự án, logo, màu, theme sáng tối, CSS tùy chỉnh, ngôn ngữ mặc định, chính sách mật khẩu, preset ảnh
qua `/settings` ở app mới; app Directus, `/server/info` và mọi chỗ đọc settings ở cả hai app thấy giá trị mới ngay.
User app access đọc settings. Admin cài dự án trên DB chưa có user bằng `POST /server/setup`.

**Why this priority**: App Directus đọc `/settings` khi khởi động; thiếu thì app không mở được khi `/settings` đi tới
app mới. `/server/setup` là route cuối cùng còn thiếu của `/server` (D-14).

**Independent Test**: Gửi cùng chuỗi `GET`, `PATCH /settings` (admin, user app access, public) ở hai app, so response
và dòng `directus_settings`; đổi ở app này rồi đọc `/server/info`, `GET /settings` ở app kia; chạy `POST /server/setup`
trên một DB riêng chưa có user ở mỗi app.

**Acceptance Scenarios**:

1. **Given** admin, **When** `PATCH /settings` với `project_name`, `project_color`, `project_logo`,
   `theme_light_overrides`, `custom_css`, **Then** dòng `directus_settings` (tạo nếu chưa có) và response (đọc lại
   theo `fields`) giống Directus; không có quyền đọc lại thì `204` không body như Directus.
2. **Given** user app access, **When** `GET /settings`, **Then** đọc được theo quyền tối thiểu; public không có policy
   thì `403`; chưa có dòng nào thì trả giá trị mặc định của singleton như Directus.
3. **Given** settings đổi ở app mới, **When** gọi `GET /server/info`, `GET /settings` hoặc đăng nhập (chính sách
   mật khẩu, số lần đăng nhập sai) ở Directus, **Then** giá trị mới có hiệu lực như khi đổi ở Directus.
4. **Given** DB chưa có dòng `directus_users`, **When** `POST /server/setup` với `project_owner`, `password`,
   `first_name`, `last_name`, **Then** tạo admin như `createAdmin` của Directus và ghi thông tin chủ dự án (FR-013);
   gọi lại hoặc DB đã có user thì `403`.
5. **Given** admin, **When** `POST /settings/owner`, **Then** các field chủ dự án được ghi như Directus; báo cáo gửi về
   máy chủ của Directus làm theo FR-012.

---

### User Story 2 - Preset layout và bookmark (Priority: P1)

Người dùng lưu cấu hình layout (cột, sắp xếp, bộ lọc, tìm kiếm) và bookmark ở module Content; admin tạo preset cho role
hoặc toàn cục. Preset, bookmark tạo ở app này hiện ở app kia.

**Why this priority**: Module Content đọc và ghi `/presets` mỗi lần đổi layout; cache blackbox dùng `/presets`.

**Independent Test**: Chạy cùng chuỗi CRUD `/presets` và các query của `stores/presets.ts` ở hai app với admin và user
app access; so response và dòng DB.

**Acceptance Scenarios**:

1. **Given** user app access, **When** tạo, sửa, xóa preset có `user` là chính mình, **Then** thành công như Directus;
   preset của user khác hoặc `user` khác chính mình trả `403` theo quyền tối thiểu.
2. **Given** preset của user, của role và toàn cục (`user`, `role` null), **When** app Directus đọc preset với bộ lọc
   `_or` của nó, **Then** danh sách và thứ tự giống Directus.
3. **Given** bookmark (`bookmark` khác null) tạo ở app mới, **When** mở module Content ở app Directus, **Then** bookmark
   hiện trong danh sách, đổi tên, xóa được.

---

### User Story 3 - Thông báo trong app, không gửi email (Priority: P1)

Người dùng nhận thông báo (do người khác, flow, mention, xuất nhập dữ liệu tạo), xem trong chuông thông báo, đánh dấu
đã đọc (lưu trữ). Mọi chỗ Directus gửi email cho thông báo thì app mới ghi một dòng log cảnh báo thay vì gửi.

**Why this priority**: Chuông thông báo của app Directus gọi `/notifications` định kỳ; là yêu cầu "không gửi email" của
mô tả.

**Independent Test**: Port `mail.test.ts` với kiểm tra đổi theo D-33; so CRUD `/notifications` ở hai app; đếm dòng log
cảnh báo và kết nối SMTP (phải bằng 0).

**Acceptance Scenarios**:

1. **Given** admin, **When** `POST /notifications` với mảng hai thông báo cho user có `email` và
   `email_notifications = true`, **Then** `200`, hai dòng `directus_notifications` giống Directus, hai dòng log cảnh
   báo, không có email nào được gửi.
2. **Given** user app access, **When** đọc thông báo, **Then** chỉ thấy thông báo có `recipient` là mình; `PATCH` chỉ
   được field `status`; field khác `403`.
3. **Given** app Directus mở chuông thông báo qua proxy, **When** đọc, lưu trữ thông báo, **Then** số đếm và danh sách
   giống khi đi tới Directus.

---

### User Story 4 - Chia sẻ item bằng link (Priority: P1)

Người dùng có quyền `share` tạo link chia sẻ một item với mật khẩu, thời điểm bắt đầu, kết thúc, số lần xem tối đa, role
giới hạn quyền; người nhận mở link, nhập mật khẩu, xem item mà không cần tài khoản. Share và phiên share dùng chéo được
giữa hai app. Mời qua email thì ghi log thay vì gửi.

**Why this priority**: Là luồng có bảo mật (mật khẩu, thời hạn, số lần dùng, token); sai một điều kiện là lộ dữ liệu.

**Independent Test**: Tạo share ở app này, `GET /shares/info/:id`, `POST /shares/auth` ở app kia với mọi `mode`, dùng
token đọc item ở cả hai app; chạy các ca hết hạn, chưa tới hạn, hết lượt, sai mật khẩu; so response, dòng
`directus_shares`, `directus_sessions`.

**Acceptance Scenarios**:

1. **Given** user không có quyền `share` trên item, **When** `POST /shares`, **Then** `403`; có quyền thì dòng
   `directus_shares` được tạo, `password` lưu dạng băm argon2 và trả về bị che như Directus.
2. **Given** share còn hạn, **When** `POST /shares/auth` với `share`, `password`, `mode` `json`, `cookie`, `session`,
   **Then** response, cookie, dòng `directus_sessions` (`share`, `ip`, `user_agent`, `origin`) và `times_used` tăng một
   giống Directus; payload JWT có `share`, `role: null`, `app_access: false`, `admin_access: false`.
3. **Given** share hết hạn, chưa tới `date_start`, hết lượt hoặc sai mật khẩu, **When** `POST /shares/auth`, **Then**
   `401 INVALID_CREDENTIALS` như Directus; thiếu `share` hoặc `mode` sai trả `400`; share có mật khẩu mà payload
   không có `password` trả `500` như Directus (R-29); share không có mật khẩu thì bỏ qua `password`.
4. **Given** token share cấp ở app A, **When** đọc item được chia sẻ (và quan hệ được phép) ở app B, **Then** đọc được
   như Directus; item khác, collection khác trả `403`; refresh phiên share qua `/auth/refresh` chạy ở cả hai app.
5. **Given** `GET /shares/info/:id` không token, **When** share còn hạn, **Then** trả `id`, `collection`, `item`,
   `password` (che), `max_uses`, `times_used`, `date_start`, `date_end` như Directus; hết hạn thì `403`.
6. **Given** người dùng đăng nhập đọc được share, **When** `POST /shares/invite` với `emails`, **Then** mỗi email một
   dòng log cảnh báo (D-36), không gửi email, response giống Directus; không đăng nhập hoặc không đọc được share trả `403`.
7. **Given** sửa (`role`, `item`) hoặc xóa share ở app này, **When** dùng token share cũ đọc item ở app kia ngay sau
   đó, **Then** kết quả theo share mới (`role` mới) hoặc `403` (share đã xóa, `fetchShareInfo` không thấy), không
   phải kết quả cũ từ cache quyền dùng chung.

---

### User Story 5 - Tiện ích `/utils` (Priority: P1)

Module Content sắp xếp tay item bằng kéo thả, xuất dữ liệu ra file, nhập file CSV hoặc JSON; field hash dùng
`hash/generate`, `hash/verify`; field token dùng `random/string`; sidebar Revisions khôi phục qua `revert`; admin xóa
cache; app đăng nhập SSO dùng `resolve-redirect`; hộp thoại tạo translations dùng `translations/generate`.

**Why this priority**: Các bộ blackbox đã port gọi `/utils/cache/clear` ở mọi lượt seed; xuất nhập và sắp xếp là luồng
chính của module Content.

**Independent Test**: Gửi mỗi route `/utils` ở hai app với admin, user có quyền một phần, public; so response, dòng
DB, file xuất, thông báo tạo ra; băm ở app này kiểm ở app kia.

**Acceptance Scenarios**:

1. **Given** chuỗi bất kỳ, **When** `POST /utils/hash/generate` ở app A rồi `POST /utils/hash/verify` ở app B,
   **Then** `true`; thiếu `string` hoặc `hash` trả `400` với reason như Directus; hash hỏng trả `400` `Invalid "hash" or
   "string"`.
2. **Given** `GET /utils/random/string?length=n`, **When** `n` từ 1 tới 500, **Then** chuỗi đúng độ dài và bảng chữ của
   nanoid; `n` ngoài khoảng hoặc không phải số nguyên trả `400 INVALID_QUERY`; thiếu `length` thì 32 ký tự.
3. **Given** collection có `sort_field`, **When** `POST /utils/sort/:collection` với `item`, `to`, **Then** giá trị sort
   của mọi dòng sau thao tác giống Directus (kể cả khi có dòng sort null hoặc trùng), event `items.sort` phát, data
   cache bị xóa theo cấu hình; không có sort field trả `400`; user không có quyền update field sort trả `403`.
4. **Given** revision của item, **When** `POST /utils/revert/:revision`, **Then** item quay về `data` của revision,
   activity và revision mới giống Directus.
5. **Given** file CSV hoặc JSON, **When** `POST /utils/import/:collection` (multipart), **Then** item được tạo hoặc
   cập nhật như Directus, lỗi dữ liệu trả cùng danh sách lỗi; `?background=true` trả ngay và tạo thông báo thành công
   hoặc thất bại; loại file khác trả `415`; vượt `IMPORT_MAX_CONCURRENCY` (đếm chung với Directus) trả lỗi giới hạn.
6. **Given** `POST /utils/export/:collection` với `query` và `format` (`csv`, `csv_utf8`, `json`, `xml`, `yaml`),
   **When** xuất xong, **Then** một file trong `directus_files` có nội dung byte giống Directus (trừ phần phụ thuộc thời
   điểm), tiêu đề, tên tải về, loại MIME như Directus, và người gọi nhận thông báo "Your export of ... is ready"; lỗi
   tạo thông báo "Your export of ... failed".
7. **Given** admin, **When** `POST /utils/cache/clear` (có và không `?system`), **Then** data cache (và cache hệ thống
   khi có `system`) bị xóa ở cả hai app; user không phải admin trả `403`.
8. **Given** admin, **When** `POST /utils/translations/generate` từ hộp thoại translations, **Then** collection, field,
   relation sinh ra giống Directus và cache hệ thống bị xóa; user không phải admin trả `403`.

---

### User Story 6 - Chuỗi dịch tùy chỉnh (Priority: P2)

Admin thêm, sửa, xóa chuỗi dịch (`key`, `language`, `value`) ở Settings > Translations; app Directus dùng chuỗi dịch
khi hiển thị tên field, collection.

**Why this priority**: Không chặn luồng chính, nhưng app Directus đọc `/translations` khi khởi động.

**Independent Test**: CRUD `/translations` ở hai app gồm ca trùng `key` + `language`; so response và dòng DB.

**Acceptance Scenarios**:

1. **Given** cặp `key` + `language` đã có, **When** tạo dòng trùng hoặc sửa thành trùng, **Then** `400
   INVALID_PAYLOAD` "Duplicate key and language combination" như Directus.
2. **Given** user app access, **When** đọc `/translations`, **Then** đọc được theo quyền tối thiểu; ghi thì `403`.

---

### User Story 7 - Dashboard và panel của Insights (Priority: P2)

Người dùng có quyền tạo dashboard, thêm, sắp xếp, sửa, xóa panel; dashboard tạo ở app này mở được ở app kia.

**Why this priority**: Module Insights không dùng được nếu thiếu; không chặn luồng khác.

**Independent Test**: CRUD `/dashboards` (gồm ghi lồng `panels`) và `/panels` ở hai app; so response và dòng DB.

**Acceptance Scenarios**:

1. **Given** user có policy trên `directus_dashboards`, `directus_panels`, **When** tạo dashboard có panel lồng, **Then**
   dòng DB và response giống Directus; không có policy thì `403` (không có quyền tối thiểu).
2. **Given** dashboard có panel, **When** xóa dashboard, **Then** panel bị xóa theo khóa ngoại như Directus.

---

### User Story 8 - `/extensions` tối thiểu để app Directus chạy (Priority: P3)

App Directus đọc danh sách extension và tải bundle extension của app khi khởi động; app mới không hỗ trợ extension
(Nguyên tắc XI) nhưng trả đủ để app Directus mở bình thường.

**Why this priority**: Chỉ cần để app không lỗi khi khởi động; trang Marketplace không phải luồng chính.

**Independent Test**: Gọi các route `/extensions` ở hai app khi Directus không cài extension nào; mở app Directus qua
proxy với `/extensions` đi tới app mới.

**Acceptance Scenarios**:

1. **Given** Directus không cài extension nào, **When** `GET /extensions` (admin), **Then** response giống Directus.
2. **Given** app Directus khởi động qua proxy, **When** tải `/extensions/sources/index.js`, **Then** app nạp được bundle
   rỗng và mở bình thường.
3. **Given** admin mở Marketplace, **When** duyệt danh sách, xem extension, xem tác giả, **Then** response giống
   Directus (cùng registry); user không phải admin trả `403`.
4. **Given** admin bấm cài, cài lại, gỡ, bật tắt hoặc xóa extension, **When** request tới app mới, **Then** `503`
   (cài, cài lại, gỡ) hoặc `403` (bật tắt, xóa) và `directus_extensions` không đổi (D-37).

---

### User Story 9 - Bộ test của Directus, E2E app Directus và benchmark chạy qua trên app mới (Priority: P2)

Bộ blackbox và unit ở đầu spec được port và đạt ở cả hai app; Playwright E2E app Directus qua proxy cho các module dùng
các route này; benchmark các route đọc nhiều.

**Why this priority**: Là tiêu chí chấp nhận của mô tả và cổng đóng feature.

**Independent Test**: Chạy bộ port với `TEST_DB=postgres`, `mysql`, `sqlite3` mỗi lần push, vendor còn lại ở
`nightly.yml`.

**Acceptance Scenarios**:

1. **Given** bộ port, **When** chạy với app mới là mục tiêu (`/presets`, `/utils/cache/clear`, `/notifications` đi tới
   app mới), **Then** 100% ca đạt, ca fail trên chính Directus được ghi chú như 005 đến 009.
2. **Given** E2E Playwright, **When** các route của feature này đi tới app mới, **Then** mọi kịch bản ở FR-103 hoàn tất
   và màn hình như khi đi tới Directus.

---

### Edge Cases

- Share `max_uses`: điều kiện của Directus là `max_uses >= times_used` trước khi tăng, nên theo đọc code share có
  `max_uses = n` đăng nhập được `n + 1` lần; hai lần đăng nhập đồng thời đọc cùng `times_used` (không khóa). Chưa đo;
  ứng viên rủi ro R-25 (tái tạo).
- Quyền của token share theo `getPermissionsForShare` (đã port ở 004): giao quyền của `role` của share và quyền của
  `user_created` (một bên là admin thì lấy bên kia; cả hai là admin thì mọi field), giới hạn trong item được chia sẻ và
  quan hệ của nó; app mới chỉ cần dùng lại, không đổi.
- `POST /shares/auth` xóa mọi dòng `directus_sessions` hết hạn (của mọi user) sau khi ghi phiên, như Directus.
- `GET /shares/info/:pk` không dùng accountability: ai biết id share đều đọc được thông tin share còn hạn (không lộ
  mật khẩu vì bị che).
- `/utils/sort` ghi bằng truy vấn thô: không kiểm filter quyền theo dòng (chỉ quyền update collection và field sort),
  không ghi activity, revision, có thể đánh lại số sort của mọi dòng khi có giá trị null hoặc trùng. Ứng viên R-26 (tái
  tạo).
- `/utils/hash/generate`, `/utils/hash/verify`, `/utils/random/string`, `/shares/auth`, `/shares/info` không cần đăng
  nhập; chi phí argon2 chỉ bị giới hạn bởi `RATE_LIMITER_*`. Ứng viên R-27 (tái tạo).
- `POST /server/setup` đồng thời trên DB trống: hai request có thể cùng qua kiểm "chưa có user" (không khóa). Chưa đo;
  ứng viên R-28 (tái tạo).
- `POST /utils/export` trả về trước khi xuất xong; tiến trình nhận request chết giữa chừng thì không có file, không có
  thông báo, như Directus. Export chạy trong transaction đọc theo lô `EXPORT_BATCH_SIZE`, luôn thêm khóa chính vào `sort`.
- `POST /utils/import` không `background`: lỗi trả về client; có `background`: lỗi chỉ thành thông báo và log. Bộ đếm
  import đặt trong Redis namespace `IMPORT_EXPORT_NAMESPACE` có khóa, hết hạn sau `IMPORT_TIMEOUT`; Redis không cấu
  hình thì đếm cục bộ mỗi tiến trình, như Directus.
- `PATCH /settings` khi chưa có dòng: `upsertSingleton` tạo dòng; nhiều dòng `directus_settings` (DB do công cụ khác
  ghi) thì đọc dòng đầu như Directus.
- `POST /settings/owner` không tự kiểm admin; quyền do `upsertSingleton` với accountability của người gọi quyết định.
- `TranslationsService.updateMany` với nhiều khóa và cả `key`, `language` trong payload luôn trả `400`, kể cả khi
  không trùng, như Directus.
- Thông báo có `recipient` mà user không có `email` hoặc `email_notifications` khác `true`: không có dòng log cảnh báo
  (Directus cũng không gửi).
- `GET /extensions/sources/<chunk khác>` trả `404 ROUTE_NOT_FOUND` như Directus khi không có chunk đó.
- `POST /utils/sort` với `item` hoặc `to` không tồn tại: Directus đọc `undefined[sortField]` → `TypeError` → `500`
  (`[Suy luận]` từ `services/utils.ts`, đo ở `utils-misc.test.ts`); các dòng đã được điền sort hoặc đánh lại số trước
  đó vẫn giữ (không transaction), như Directus.
- `POST /utils/revert/:revision`: revision không có → `403`; revision không có `data` → `400 INVALID_PAYLOAD` "Revision
  doesn't contain data to revert to"; không có quyền update item → `403` từ `ItemsService.updateOne` (008).
- Share có mật khẩu, payload `/shares/auth` thiếu `password` → `500` (R-29); payload có `password` cho share không có
  mật khẩu → bỏ qua, đăng nhập được.

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| US1 | 1–5 | FR-001 đến FR-005, FR-010 đến FR-014 | SC-002, SC-003, SC-004 |
| US2 | 1–3 | FR-001, FR-002, FR-020, FR-021 | SC-001, SC-002 |
| US3 | 1–3 | FR-030, FR-031, FR-090, FR-091 | SC-001, SC-005 |
| US4 | 1–7 | FR-040 đến FR-046, FR-090 | SC-002, SC-003, SC-004 |
| US5 | 1–8 | FR-080 đến FR-088, FR-095 | SC-001, SC-002, SC-004 |
| US6 | 1–2 | FR-050, FR-051 | SC-002 |
| US7 | 1–2 | FR-060, FR-061 | SC-002 |
| US8 | 1–4 | FR-070 đến FR-072, FR-095 | SC-002, SC-006 |
| US9 | 1–2 | FR-100 đến FR-104 | SC-001, SC-006 |

## Requirements *(mandatory)*

### Functional Requirements

**Route và hành vi chung**

- **FR-001**: App mới PHẢI phục vụ mọi route của `controllers/settings.ts`, `presets.ts`, `notifications.ts`,
  `shares.ts`, `translations.ts`, `dashboards.ts`, `panels.ts`, `extensions.ts`, `utils.ts` và `POST /server/setup`,
  cùng thứ tự middleware (`useCollection`, `validateBatch`, `collectionExists`, `respond`), cùng status, body, header và
  lỗi với Directus 11.17.4, gồm `OPTIONS`, `HEAD` qua `router-options` với các mẫu tương ứng.
- **FR-002**: Quyền trên các collection `directus_settings`, `directus_presets`, `directus_notifications`,
  `directus_shares`, `directus_translations`, `directus_dashboards`, `directus_panels`, `directus_extensions` PHẢI áp
  như Directus qua engine của 004, gồm quyền tối thiểu app access (danh sách ở đầu spec) và hành động `share`.
- **FR-003**: `getService` PHẢI trả `SettingsService`, `SharesService`, `TranslationsService`, `DashboardsService`,
  `PanelsService` cho collection tương ứng ở mọi đường ghi (route riêng, ghi lồng, flow, import, export), như Directus;
  chỉ ba collection deployment còn đi qua `ItemsService` chung (D-31 thu hẹp).
- **FR-004**: Response cache, `meta`, `Emitter` và cầu nối websocket PHẢI làm như các route item (005). Event mang scope
  là tên bỏ tiền tố (`settings.*`, `presets.*`, `notifications.*`, `shares.*`, `translations.*`, `dashboards.*`,
  `panels.*`); `items.sort` và `<collection>.items.sort` (action) phát sau `sort`; flow theo event của các scope này chạy
  ở app nhận request (009). Không phát `extensions.*` (D-35).
- **FR-005**: Ghi vào các collection này PHẢI xóa data cache và cache hệ thống theo `CACHE_AUTO_PURGE`,
  `CACHE_AUTO_PURGE_IGNORE_LIST` và quy tắc của Directus, để app kia thấy thay đổi ngay (blackbox `cache.test.ts`).

**Settings và cài đặt lần đầu**

- **FR-010**: `GET /settings` PHẢI trả `readSingleton(query)`; `PATCH /settings` PHẢI `upsertSingleton(body)` rồi đọc
  lại theo query, đọc lại bị cấm thì trả `204` không body, như Directus.
- **FR-011**: `SettingsService` đầy đủ PHẢI thay bản tối giản của 001; `/server/info` giữ nguyên output (bộ đối chiếu
  của 001 tiếp tục kiểm).
- **FR-012**: `POST /settings/owner` PHẢI ghi `project_owner`, `project_usage`, `org_name`, `product_updates` và
  `project_status = null` bằng `upsertSingleton` với quyền người gọi như Directus, và PHẢI không gửi báo cáo chủ dự án
  tới `COMPLIANCE_URL` (Clarifications, D-38): không mở kết nối ra ngoài, không đặt `project_status = pending` (để job
  `project` của Directus chạy cạnh không gửi lại), thay bằng một dòng log mức `warn` có tiền tố "Backoffice:", không
  chứa email chủ dự án. Response giống Directus.
- **FR-013**: `POST /server/setup` PHẢI làm như Directus: có dòng `directus_users` thì `403`; chưa có thì `createAdmin`
  (role, policy admin, access, user với `email = project_owner`, `password`, `first_name`, `last_name`) rồi `setOwner`
  không chờ (cùng cách xử lý báo cáo ở FR-012); lỗi `FORBIDDEN` bên trong trả `204`. Body thiếu `project_owner` hoặc
  `password` thì lấy `ADMIN_EMAIL`, `ADMIN_PASSWORD` từ env như Directus; cả hai nguồn đều rỗng thì chỉ tạo role,
  policy, access, không tạo user, vẫn `204` (không `400`); `token` của user lấy `ADMIN_TOKEN` hoặc null. Gỡ D-14.
- **FR-014**: Mọi chỗ của app mới đọc settings (chính sách mật khẩu, số lần đăng nhập sai, preset ảnh, transform ảnh,
  ngôn ngữ, tên dự án cho TFA, đăng ký công khai...) PHẢI thấy giá trị mới ngay sau khi settings đổi ở app nào cũng được,
  như Directus.

**Presets và bookmarks**

- **FR-020**: CRUD `/presets` PHẢI qua `PresetsService` với quyền tối thiểu app access: đọc preset của mình, của role
  mình và toàn cục; tạo, sửa, xóa với `user` là chính mình.
- **FR-021**: Các query của `stores/presets.ts` (lọc `_or` theo `user`, `role`, null; `limit -1`) PHẢI trả cùng kết
  quả và thứ tự như Directus.

**Notifications**

- **FR-030**: CRUD `/notifications` PHẢI qua `NotificationsService` (008): mỗi thông báo tạo (kể cả mảng, mỗi phần tử
  một lần `createOne`) chạy `sendEmail` tới bước quyết định gửi rồi ghi log cảnh báo thay cho bước gửi (D-33).
- **FR-031**: Quyền tối thiểu app access PHẢI cho đọc thông báo có `recipient` là mình và chỉ sửa field `status`; các
  query của chuông thông báo (lọc `status`, `aggregate count`, `PATCH` hàng loạt) trả như Directus.

**Shares**

- **FR-040**: `SharesService.createOne` PHẢI kiểm `validateAccess` hành động `share` trên `collection`, `item` khi có
  accountability (`403`); `updateMany`, `deleteMany` PHẢI xóa cache quyền dùng chung trước khi ghi, như Directus.
- **FR-041**: `POST /shares/auth` PHẢI kiểm payload bằng joi (`share` bắt buộc, `password` chuỗi, `mode` thuộc `cookie`,
  `json`, `session`; khóa thừa được chấp nhận), chọn share theo `id`, `date_start` null hoặc ≤ hiện tại, `date_end`
  null hoặc ≥ hiện tại, `max_uses` null hoặc ≥ `times_used`; kiểm mật khẩu bằng argon2 khi share có mật khẩu (payload
  thiếu `password` → `argon2.verify` ném `TypeError` → `500`, R-29); sai thì `401 INVALID_CREDENTIALS`; tăng
  `times_used`; ký JWT `{ app_access: false, admin_access: false, role: null, share,
  session? }` với `issuer: directus`, TTL `ACCESS_TOKEN_TTL` hoặc `SESSION_COOKIE_TTL`; ghi `directus_sessions`
  (`token`, `expires` theo `REFRESH_TOKEN_TTL`, `ip`, `user_agent`, `origin`, `share`); xóa phiên hết hạn; trả body và
  cookie theo `mode` như `/auth/login` (003).
- **FR-042**: Token và phiên share cấp ở app này PHẢI dùng được ở app kia (đọc item theo `getPermissionsForShare`,
  refresh, logout), như 003 và 004.
- **FR-043**: `GET /shares/info/:pk(uuid)` PHẢI đọc không accountability các field `id`, `collection`, `item`,
  `password`, `max_uses`, `times_used`, `date_start`, `date_end` với bộ lọc thời hạn như Directus; không tìm thấy trả
  `403`.
- **FR-044**: `POST /shares/invite` PHẢI kiểm joi (`share` bắt buộc, `emails` mảng chuỗi), `403` khi không có user,
  đọc share theo quyền người gọi, đọc tên người mời, dựng tiêu đề "<tên> has shared an item with you" và link
  `PUBLIC_URL/admin/shared/<id>`, rồi ghi một dòng log cảnh báo mỗi email thay cho bước gửi (D-36); response như
  Directus.
- **FR-045**: CRUD `/shares` PHẢI băm `password` bằng argon2 khi ghi (`special` `hash` của `PayloadService`, mọi đường
  ghi kể cả lồng qua `/items`) và che bằng chuỗi `**********` khi đọc (`conceal`) ở mọi đường đọc: `GET /shares`,
  `GET /shares/:pk`, `GET /shares/info/:pk`, đọc lại sau `POST`, `PATCH`; null giữ null.
- **FR-046**: Mọi lỗi của shares PHẢI trùng code và `reason` với Directus.

**Translations**

- **FR-050**: `TranslationsService` PHẢI port đủ: `createOne` trùng `key` + `language` trả `400 INVALID_PAYLOAD`
  "Duplicate key and language combination"; `updateMany` trả lỗi đó khi có khóa và payload có cả `key`, `language`,
  hoặc khi payload có một trong hai và dòng gộp bị trùng.
- **FR-051**: `POST /utils/translations/generate` PHẢI port `generate-translations.ts` (kiểm payload bằng zod, tạo
  collection ngôn ngữ, collection translations, field, relation trong transaction), chỉ admin (`403`), rồi xóa cache hệ
  thống (lỗi xóa cache chỉ ghi log), như Directus.

**Dashboards và panels**

- **FR-060**: CRUD `/dashboards`, `/panels` PHẢI qua `DashboardsService`, `PanelsService`, gồm ghi lồng `panels` trong
  dashboard; xóa dashboard xóa panel theo khóa ngoại như Directus.
- **FR-061**: Các query của module Insights (dashboard kèm `panels.*`, `limit -1`) PHẢI trả như Directus.

**Extensions** (Nguyên tắc XI: app mới không có extension manager)

- **FR-070**: `GET /extensions` PHẢI trả các dòng `directus_extensions` đọc theo quyền người gọi với `schema: null`
  (không có extension nào được nạp), bỏ dòng thuộc bundle không có cha như `readAll` của Directus; DB chưa có dòng nào
  thì `[]`, trùng Directus không cài extension.
- **FR-071**: `GET /extensions/sources/index.js` PHẢI trả bundle extension app rỗng có cùng nội dung, `Content-Type`,
  `Cache-Control` (theo `EXTENSIONS_CACHE_TTL`), `Vary` như Directus 11.17.4 không cài extension (chuỗi đo bằng rollup
  ở research R6, xác nhận trên container Directus ở task T048); chunk khác trả `404 ROUTE_NOT_FOUND`.
- **FR-072**: Mọi route registry và `PATCH`, `DELETE /extensions/:pk` PHẢI giữ kiểm admin (`403`) và kiểm tham số
  như Directus (Clarifications). Sau đó:
  - `GET /registry`, `GET /registry/account/:pk(uuid)`, `GET /registry/extension/:pk(uuid)` PHẢI gọi registry như
    Directus: cùng cách dựng query (`search`, `limit`, `offset`, `sort` thuộc `popular`, `recent`, `downloads`, `filter`
    `by`, `type` với `_eq`; `type` ngoài `EXTENSION_TYPES` trả `403`), `sandbox` khi `MARKETPLACE_TRUST = sandbox`,
    `MARKETPLACE_REGISTRY` nếu đặt, lỗi registry đổi thành `503 SERVICE_UNAVAILABLE` service `marketplace` như
    `handle-registry-error.ts`; response là payload của registry.
  - `POST /registry/install`, `POST /registry/reinstall`, `DELETE /registry/uninstall/:pk(uuid)` PHẢI kiểm body như
    Directus (thiếu `extension`, `version` trả `403`) rồi trả `503 SERVICE_UNAVAILABLE` service `marketplace` với reason
    `Backoffice does not install extensions` (contracts/system-api.md §4); không ghi `directus_extensions`, không tải
    gói.
  - `PATCH /:pk(uuid)`, `DELETE /:pk(uuid)` PHẢI trả `403 FORBIDDEN`, không ghi `directus_extensions`.

**Utils**

- **FR-080**: `GET /utils/random/string` PHẢI kiểm `length` bằng joi (số nguyên 1 đến 500, mặc định 32; không phải số
  nguyên, âm, hoặc lặp nhiều lần (`?length=1&length=2`, thành mảng) → `400 INVALID_QUERY` với message joi; query thừa
  được chấp nhận) và trả chuỗi nanoid; không cần đăng nhập.
- **FR-081**: `POST /utils/hash/generate` PHẢI trả `400` khi thiếu `string` và trả băm argon2 bằng `generateHash`
  (cùng tham số Directus); `POST /utils/hash/verify` PHẢI trả `400` khi thiếu `string` hoặc `hash`, `true`/`false` khi
  kiểm được, `400` `Invalid "hash" or "string"` khi argon2 ném lỗi. Băm tạo ở app này kiểm được ở app kia.
- **FR-082**: `POST /utils/sort/:collection` PHẢI qua `collectionExists`, kiểm joi (`item`, `to` chuỗi hoặc số, bắt
  buộc) và port `UtilsService.sort`: lấy `sort_field` từ `directus_collections` (hoặc dòng mặc định của collection hệ
  thống), không có thì `400`; người gọi không phải admin cần quyền update collection và field sort (`403`); điền giá trị
  cho dòng sort null, đánh lại số khi trùng, dời item, xóa data cache theo `shouldClearCache`, phát `items.sort`; trả
  `200` body rỗng.
- **FR-083**: `POST /utils/revert/:revision` PHẢI gọi `RevisionsService.revert` (008) và trả như Directus.
- **FR-084**: `POST /utils/import/:collection` PHẢI theo đúng thứ tự kiểm của Directus: `collectionExists` (`403`)
  → không phải multipart (`415 UNSUPPORTED_MEDIA_TYPE`) → `ImportService.import`: collection hệ thống cần admin
  (`403`) → quyền create rồi update (`403`) → loại file ∉ `application/json`, `text/csv`,
  `application/vnd.ms-excel` (kể cả XML, YAML, Clarifications) → `415` → bộ đếm `IMPORT_MAX_CONCURRENCY` dùng chung
  trong namespace `IMPORT_EXPORT_NAMESPACE` (khóa `importCount`, TTL `IMPORT_TIMEOUT`; Redis không cấu hình thì đếm
  cục bộ) vượt → `429 LIMIT_EXCEEDED` category `Concurrent import`. Các lỗi này xảy ra trước khi tách nền nên luôn trả
  về client, kể cả với `background=true`. Nhập JSON, CSV trong **một** transaction: lỗi validate của từng dòng gom tới
  `MAX_IMPORT_ERRORS` rồi ném `FAILED_VALIDATION` (nhiều `errors[]`, mỗi lỗi có `rows` là số dòng hoặc khoảng dòng),
  lỗi khác ném nguyên; mọi lỗi làm rollback toàn bộ import (không dòng nào được giữ); quá `IMPORT_TIMEOUT` → lỗi
  `TIMEOUT` category `Import`. Không `background`: chờ xong, lỗi trả client, `200` body rỗng. `background=true`: trả
  `200` ngay; xong tạo thông báo cho người gọi (`recipient = sender = user`) tiêu đề "Your import has been successful"
  với message "Hello <tên>,\n\nYour import in <collection> has been successful.\n", hoặc "Your import has failed" với
  message có `error.message`; lỗi nền chỉ ghi log và thông báo, không có cách lấy `errors[]`.
- **FR-085**: `POST /utils/export/:collection` PHẢI: thiếu `query` hoặc `format` trả `400`; qua `collectionExists`;
  `sanitizeQuery`; trả ngay rồi chạy `exportToFile` nền: đọc theo lô `EXPORT_BATCH_SIZE` trong transaction qua
  `getService`, ghi file tạm theo `format` (`csv`, `csv_utf8`, `json`, `xml`, `yaml`, cùng byte với `transform` của
  Directus, tiêu đề cột CSV theo `getHeadingsForCsvExport`), tải lên bằng `FilesService.uploadOne` với `title`
  `export-<collection>-<thời điểm>`, `filename_download`, `type` như Directus (cho phép ghi đè qua `file`), tạo thông báo
  cho người gọi; lỗi thì log và tạo thông báo thất bại. Trường hợp biên như Directus: `query.limit = -1` hoặc lớn hơn
  tổng → xuất hết; collection không có dòng nào → vẫn tải lên một file rỗng và thông báo thành công; `fields` lồng quan
  hệ trong CSV → tiêu đề cột theo `getHeadingsForCsvExport` (`a.b`); "thất bại" = `format` không hợp lệ, lỗi đọc
  (collection bị xóa giữa chừng), lỗi tải lên: không có file, file tạm bị dọn, một thông báo "Your export of
  <collection> failed".
- **FR-086**: `POST /utils/cache/clear` PHẢI chỉ cho admin (`403`); xóa data cache; có khóa `system` trong query
  (`?system`, `?system=true`, và cả `?system=false` vì Directus dùng `Boolean('false')`) thì xóa cache hệ thống ép buộc
  (schema, quyền) qua bus để cả hai app dựng lại, như Directus. "App kia dựng lại" đo bằng: đổi schema trực tiếp trong
  DB (hoặc ở Directus với cache schema bật), đọc `/fields` ở app kia thấy cũ, gọi `cache/clear?system` ở app này, đọc
  lại ở app kia thấy mới.
- **FR-087**: `POST /utils/resolve-redirect` PHẢI trả `400` khi thiếu `redirect` hoặc `provider` không phải chuỗi, trả
  kết quả `resolveLoginRedirect` (003), lỗi thì `400` `Invalid "redirect" provided`.
- **FR-088**: Mọi lỗi của `/utils` PHẢI trùng code và `reason` với Directus.

**Không gửi email**

- **FR-090**: Mọi chỗ Directus 11.17.4 gửi email PHẢI chạy đủ luồng (kiểm tra, đọc dữ liệu, ghi DB, response) và chỉ
  thay bước gửi bằng một dòng log mức `warn` mỗi email, không đọc `EMAIL_*`, không mở kết nối gửi thư: quên mật khẩu
  (D-23), mời user (D-27), xác minh đăng ký (D-28), thông báo (D-33), operation `mail` (D-34), mời xem share (D-36). Dòng
  log có tiền tố "Backoffice:", tên người nhận và tiêu đề, không chứa token hay link có bí mật (như FR-062 của 003).
- **FR-091**: PHẢI có kiểm tra tự động liệt kê mọi chỗ `new MailService` của Directus 11.17.4 (sáu chỗ ở đầu spec) và
  bảo đảm mỗi chỗ có bản thay thế ghi log ở app mới, để chỗ gửi mail mới của bản Directus sau không bị bỏ sót.

**Biến môi trường**

- **FR-095**: `IMPORT_TIMEOUT`, `IMPORT_MAX_CONCURRENCY`, `IMPORT_EXPORT_NAMESPACE`, `MAX_IMPORT_ERRORS`,
  `EXPORT_BATCH_SIZE`, `EXTENSIONS_CACHE_TTL`, `MARKETPLACE_REGISTRY`, `MARKETPLACE_TRUST` PHẢI được đọc với cùng mặc
  định và chuyển sang nhóm "đã hỗ trợ"; `EMAIL_*`, `TELEMETRY*`, `COMPLIANCE_URL` và các `EXTENSIONS_*` khác giữ nhóm
  "chưa hỗ trợ" (cảnh báo khi đặt); không thêm biến mới (Nguyên tắc VIII).

**Kiểm thử**

- **FR-100**: Bộ đối chiếu PHẢI so status, body, header và dòng `directus_settings`, `directus_presets`,
  `directus_notifications`, `directus_shares`, `directus_sessions` (phiên share), `directus_translations`,
  `directus_dashboards`, `directus_panels`, `directus_files` (file xuất), `directus_activity`, `directus_revisions` của
  hai app cho mọi route ở FR-001 kể cả lỗi. Tập so: bỏ `id` tự sinh, thời điểm (`timestamp`, `date_*`, `expires`,
  `uploaded_on`); băm argon2 (`directus_shares.password`, `directus_users.password`) so bằng cách kiểm chéo (salt ngẫu
  nhiên); `directus_sessions.token`, `directus_files.filename_disk` so bằng dạng (marker); `times_used` so sau cùng số
  lần đăng nhập ở mỗi app; chuỗi ngẫu nhiên so độ dài và bảng chữ; JWT so payload trừ `iat`, `exp`, `session`; file
  xuất: dòng `directus_files` so sau khi thay thời điểm trong `title`, `filename_download`; thân file so byte tuyệt
  đối. Route duyệt registry so với một registry giả trong môi trường đối chiếu (`MARKETPLACE_REGISTRY` chung cho hai
  app), không gọi registry thật.
- **FR-101**: Bộ blackbox, unit ở đầu spec PHẢI được port và đạt ở cả hai app trên Postgres, MySQL, SQLite mỗi lần push
  (vendor còn lại ở `nightly.yml`): `mail.test.ts` ở app mới kiểm `200`, hai dòng thông báo, hai dòng log cảnh báo và
  không email nào tới SMTP giả (đổi theo D-33), ở Directus giữ kiểm gốc (hai email) khi môi trường đối chiếu có SMTP giả
  cho Directus, không có thì kiểm `200` và hai dòng thông báo (chốt ở plan); `cache.test.ts`, `schema-cache.test.ts`, `cache-purge.test.ts`, `common/functions.ts`
  gửi `/presets`, `/utils/cache/clear` tới app mới (bỏ ngoại lệ `getDirectusUrl` cho các route này); unit
  `import-export.test.ts` (phần còn lại), `extensions.test.ts`, `generate-translations.test.ts`,
  `translations-shared.test.ts`.
- **FR-102**: PHẢI có kiểm tra chéo cả hai chiều: settings đổi ở app này đọc ở app kia; preset, bookmark, thông báo,
  chuỗi dịch, dashboard ghi ở app này đọc ở app kia; share tạo ở app này đăng nhập, dùng token, refresh ở app kia; băm
  tạo ở app này kiểm ở app kia; sort ở app này đọc thứ tự ở app kia; file xuất ở app này tải được ở app kia; xóa cache
  ở app này làm app kia dựng lại; `IMPORT_MAX_CONCURRENCY` đếm chung giữa hai app (đo bằng khóa Redis
  `<IMPORT_EXPORT_NAMESPACE>:importCount` tăng khi import nền chạy ở app A, tăng tiếp ở app B, về 0 khi xong).
- **FR-103**: PHẢI có Playwright E2E app Directus qua reverse proxy, với các route của feature này đi tới app mới: cài
  đặt dự án (tên, màu, logo, theme, CSS), bookmark và preset layout, chuông thông báo (đọc, lưu trữ), sidebar chia sẻ
  (tạo có mật khẩu, thời hạn, số lần dùng; mở trang share `/admin/shared/<id>`: `GET /shares/info/:id`,
  `POST /shares/auth`, rồi `/items` bằng token share, đều tới app mới), Settings > Translations, Insights
  (dashboard, thêm, di chuyển, xóa panel), sắp xếp tay trong bảng, sidebar xuất và nhập dữ liệu, khởi động app với
  `/extensions` tối thiểu, trang Marketplace (duyệt được, cài báo lỗi), màn cài đặt lần đầu (`/server/setup`) trên DB
  riêng chưa có user.
- **FR-104**: PHẢI có benchmark ở hai app cho `GET /settings`, `GET /presets` (query của app), `GET /notifications`
  (đếm của chuông), `GET /dashboards` kèm `panels.*`, `POST /shares/auth`, `POST /utils/sort/:collection` trên dữ liệu
  seed cố định (số lượng chốt ở plan), ở workflow benchmark hằng tuần, không chặn CI.

### Key Entities

- **Settings**: một dòng `directus_settings` (singleton): tên, mô tả, logo, màu, theme sáng tối và override, CSS, ngôn
  ngữ mặc định, nền và ảnh trang công khai, chính sách mật khẩu, số lần đăng nhập sai, preset và giới hạn transform ảnh,
  đăng ký công khai, cấu hình bản đồ, module bar, thông tin chủ dự án (`project_owner`, `project_usage`, `org_name`,
  `product_updates`, `project_status`, `project_id`).
- **Preset / Bookmark**: một dòng `directus_presets` của một collection: layout, query, options, bộ lọc, tìm kiếm, gắn
  với user, role hoặc toàn cục; bookmark là preset có tên (`bookmark`).
- **Notification**: một dòng `directus_notifications`: người nhận, người gửi, tiêu đề, nội dung, trạng thái
  (`inbox`, `archived`), collection và item liên quan.
- **Share**: một dòng `directus_shares` cho một item: tên, role giới hạn quyền, mật khẩu (băm), thời điểm bắt đầu và
  kết thúc, số lần dùng tối đa và đã dùng, người tạo; mỗi lần đăng nhập sinh một **phiên share** trong
  `directus_sessions` (`share`).
- **Translation string**: một dòng `directus_translations`: `key`, `language`, `value`; cặp `key` + `language` duy
  nhất.
- **Dashboard / Panel**: `directus_dashboards` (tên, icon, ghi chú, màu) có nhiều `directus_panels` (loại, vị trí,
  kích thước, options).
- **Extension setting**: một dòng `directus_extensions` (bật tắt, nguồn, thư mục, bundle cha) do Directus quản lý; app
  mới chỉ đọc.
- **Import / Export job**: thao tác nền gắn với người gọi; bộ đếm import dùng chung trên Redis; kết quả là item được
  ghi, file trong `directus_files` và thông báo.

## Khác biệt so với Directus *(mandatory)*

Thay đổi với bảng khác biệt của các feature trước:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-09.8 | Gỡ: `/settings`, `/presets`, `/notifications`, `/shares`, `/translations`, `/dashboards`, `/panels`, `/extensions`, `/utils` làm ở feature này | FR-001 đến FR-088 |
| D-14 | Gỡ: `POST /server/setup` làm ở feature này | FR-013 |
| D-31 | Thu hẹp: bỏ `directus_dashboards`, `directus_panels`, `directus_settings`, `directus_shares`, `directus_translations`; chỉ còn `directus_deployments`, `directus_deployment_projects`, `directus_deployment_runs` đi qua `ItemsService` chung; đổi loại sang "ngoài phạm vi (lâu dài)" vì module deployment thuộc Nguyên tắc XI (đi cùng D-17) | FR-003 |

Giữ nguyên: D-07 (kiểm kết nối email ở `/server/health`), D-17, D-23, D-27, D-28, D-33, D-34, D-35. Sửa bảng của spec
cũ đi cùng feature này: dòng D-09.8 và D-14 trong spec 001, dòng D-31 trong spec 004; entry tương ứng trong
`tests/parity/accepted-differences.ts`; `tests/parity/proxy/backoffice-routes.txt` thêm `settings`, `presets`,
`notifications`, `shares`, `translations`, `dashboards`, `panels`, `extensions`, `utils`. Mọi dòng cần tech lead duyệt
khi đóng feature (Nguyên tắc X).

Khác biệt mới:

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại | Gỡ khi |
|----|----------|------------------|---------|-------|------|--------|
| D-36 | Email mời xem share (`POST /shares/invite`) | `SharesService.invite` gửi một email mỗi địa chỉ qua `MailService` (template `base`), lỗi gửi chỉ ghi log | Chạy đủ kiểm tra, đọc share và người mời, dựng tiêu đề và link như Directus rồi ghi một dòng log cảnh báo mỗi địa chỉ thay vì gửi; response giống nhau | Mô tả feature: "không gửi email"; Nguyên tắc X, XI; như D-23, D-27, D-28, D-33, D-34 | ngoài phạm vi (lâu dài) | — |
| D-37 | `/extensions` | `GET /` liệt kê extension đã nạp kèm `schema`; `/sources/index.js` là bundle rollup của extension app; cài, cài lại, gỡ extension từ registry; `PATCH`, `DELETE /:pk` bật tắt, xóa extension và nạp lại | `GET /` trả dòng `directus_extensions` với `schema: null` (`[]` khi Directus không cài extension, trùng Directus); bundle rỗng như Directus không cài extension; duyệt registry giống Directus; cài, cài lại, gỡ trả `503 SERVICE_UNAVAILABLE`; `PATCH`, `DELETE /:pk` trả `403` (FR-070 đến FR-072) Từ 020 lượt 1 (thu hẹp): `GET /` trả `schema` thật, `PATCH`, `DELETE /:pk` như Directus, bundle theo D-137 của 020; chỉ cài, cài lại, gỡ còn trả 503 tới 020 lượt 3. Đã gỡ ở 020 lượt 3 (2026-10-21): cài, cài lại, gỡ qua registry như Directus; entry đã xóa khỏi `accepted-differences.ts`. | Mô tả feature: "chỉ trả danh sách rỗng hoặc tối thiểu"; owner chọn ở Clarifications 2026-10-14; Nguyên tắc XI | đã gỡ (020 lượt 3) | 020 |
| D-38 | Báo cáo chủ dự án (`POST /settings/owner`, `POST /server/setup`) | `setOwner` gửi báo cáo (email chủ dự án, `project_id`, `version`) tới `COMPLIANCE_URL/v1/owner` mà không chờ; gửi lỗi thì đặt `project_status = pending` để job `project` gửi lại | Không gửi; ghi field chủ dự án với `project_status = null` như khi gửi thành công và một dòng log cảnh báo; response và dòng DB giống Directus khi gửi thành công | Owner chọn ở Clarifications 2026-10-14; telemetry thuộc Nguyên tắc XI | ngoài phạm vi (lâu dài) | — |

Entry trong `tests/parity/accepted-differences.ts`: D-36, D-38 là `doc` (không có khác biệt HTTP); D-37 gồm một entry
`doc` (danh sách với `schema: null`, bundle hằng, không có extension manager) và một entry `http` cho
`POST /extensions/registry/install`, `POST /extensions/registry/reinstall`, `DELETE /extensions/registry/uninstall/*`,
`PATCH /extensions/*`, `DELETE /extensions/*` (`location: any`), để comparer bỏ qua đúng các response khác Directus
và `guard-differences` đọc được.

**Rủi ro chấp nhận (tái tạo từ Directus)**: như quy tắc của 004 đến 009. Bằng chứng tối thiểu cho mỗi R-xx trước khi
đóng feature: tên ca test đối chiếu tái tạo, request gửi, kết quả đo trên Directus 11.17.4 thật và ngày đo, ghi vào cột
"Bằng chứng"; cần tech lead duyệt khi đóng feature. Các dòng dưới tìm từ đọc code, đã đo trên Directus 11.17.4 ngày 2026-10-14 và tái tạo ở app mới.

| Mã | Hành vi của Directus | Bằng chứng | Hệ quả |
|----|----------------------|------------|--------|
| R-25 | `SharesService.login` chấp nhận khi `max_uses >= times_used` rồi mới tăng `times_used`, không khóa dòng | `services/shares.ts` (`login`:71-95); đo 2026-10-14 trên Directus 11.17.4: share `max_uses = 1`, `POST /shares/auth` ba lần tuần tự → `200, 200, 401` ở cả hai app. Ca: `src/system/shares.test.ts` "R-25" | Share có `max_uses = n` đăng nhập được `n + 1` lần; đăng nhập đồng thời có thể vượt thêm. Tái tạo (FR-041) |
| R-26 | `UtilsService.sort` cập nhật bằng truy vấn thô sau khi chỉ kiểm quyền update collection và field sort | `services/utils.ts` (`sort`); đo 2026-10-14 trên Directus 11.17.4: user có update với filter `status = draft`, `POST /utils/sort` dời item `published` → `200`, cột sort của dòng ngoài filter đổi, 0 dòng activity, cùng kết quả ở app mới. Ca: `src/system/utils-misc.test.ts` "R-26" | User có quyền update giới hạn bằng filter vẫn đổi được giá trị sort của dòng ngoài filter; không có activity, revision. Tái tạo (FR-082) |
| R-27 | `hash/generate`, `hash/verify`, `random/string`, `/shares/auth`, `/shares/info` không yêu cầu đăng nhập | `controllers/utils.ts`, `controllers/shares.ts`; đo 2026-10-14 không token ở cả hai app: `POST /utils/hash/generate` `200`, `POST /utils/hash/verify` `200 {"data":true}`, `GET /utils/random/string` `200`, `GET /shares/info/<uuid lạ>` `403`, `POST /shares/auth` share lạ `401 INVALID_CREDENTIALS`. Ca: `utils-misc.test.ts`, `shares.test.ts` "(R-27)" | Public gọi được thao tác argon2 tốn CPU; chỉ `RATE_LIMITER_*` giới hạn. Tái tạo (FR-041, FR-043, FR-080, FR-081) |
| R-28 | `POST /server/setup` kiểm "chưa có user" rồi tạo admin, không khóa | `controllers/server.ts` (`/setup`), `utils/create-admin.ts`; đo 2026-10-14 trên cặp `setup`: hai `POST /server/setup` đồng thời trên DB trống → `204, 400`, 1 user, 2 role (role, policy của request thua ở lại vì `createAdmin` không chạy trong transaction; user thứ hai vấp unique email), cùng kết quả ở app mới. Ca: `src/system/setup.test.ts` "R-28" | Hai request đồng thời trên DB trống có thể cùng tạo admin. Tái tạo (FR-013) |
| R-29 | `SharesService.login` gọi `argon2.verify(hash, payload.password)` không kiểm `password` có mặt; argon2 0.44 `Buffer.from(undefined)` ném `TypeError` | `services/shares.ts` (`login`:97), `argon2.cjs` `verify`; đo 2026-10-14: share có mật khẩu, `POST /shares/auth` body `{ share }` → `500 INTERNAL_SERVER_ERROR` ở cả hai app. Ca: `shares.test.ts` "R-29" | Client quên `password` nhận `500` thay vì `401`; không lộ dữ liệu. Tái tạo (FR-041) |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. Link `PUBLIC_URL/admin/shared/<id>`, `PUBLIC_URL/admin/files/<id>`, tiêu đề thông báo ("Your export of ...
  is ready", "Your import has been successful"...), tiêu đề mời share, issuer JWT `directus`, namespace
  `directus:import-export` giữ nguyên vì là dữ liệu hoặc tên kỹ thuật dùng chung với app Directus và Directus (Nguyên tắc
  IX). Dòng log mới (FR-044, FR-090) mang tiền tố "Backoffice:" như D-33.

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4. Khi spec không nói rõ, làm như code Directus. Quy ước message lỗi và quy tắc so
  của bộ đối chiếu như Assumptions của 004 đến 009.
- Tiêu chí chấp nhận "blackbox test của các endpoint này chạy qua" (Clarifications): cổng đóng feature gồm ba phần,
  phần nào đỏ cũng chặn đóng: (1) năm file blackbox của Directus chạm tới các route này (`mail.test.ts`,
  `app/cache.test.ts`, `schema-cache.test.ts`, `cache-purge.test.ts`, `common/functions.ts`) chạy với các route đó đi
  tới app mới (FR-101); (2) bộ đối chiếu hai app cho mọi route ở FR-001 và kiểm tra chéo (FR-100, FR-102); (3) E2E app
  Directus qua proxy (FR-103). Directus không có bộ blackbox riêng cho `/settings`, `/shares`, `/translations`,
  `/dashboards`, `/panels`, `/extensions` và phần lớn `/utils`; không viết thêm bộ blackbox mới vì bộ đối chiếu đã so
  với Directus thật. `mail.test.ts` chờ email ở SMTP giả nên không thể đạt nguyên văn khi không gửi email: bản port
  đổi kiểm tra ở app mới theo D-33 (FR-101).
- Định dạng xuất nhập (Clarifications): nhập chỉ JSON, CSV (`application/json`, `text/csv`,
  `application/vnd.ms-excel`), nhập XML hoặc YAML trả `415` như Directus; app Directus cũng chỉ cho chọn file
  `text/csv, application/json` (`export-sidebar-detail.vue`). Xuất có `csv`, `csv_utf8`, `json`, `xml`, `yaml`.
- `/utils/translations/generate`, `/utils/resolve-redirect` và `POST /settings/owner` thuộc feature này vì nằm trong
  controller tương ứng của Directus ("giống hệt"); `POST /server/setup` thuộc feature này vì D-14 ghi "gỡ ở 010".
- Tiền đề dùng chung `.env` (Nguyên tắc VIII): hai app cùng `PUBLIC_URL`, `SECRET`, `ACCESS_TOKEN_TTL`,
  `REFRESH_TOKEN_TTL`, `SESSION_COOKIE_TTL`, tên cookie, `IMPORT_*`, `EXPORT_BATCH_SIZE`, cùng Redis và namespace, nên
  bộ đếm import, cache quyền, cache hệ thống là chung.
- Ca `/server/setup` cần DB chưa có user: chạy ở cặp profile `setup` có DB riêng (Postgres, Redis cô lập), là profile
  thường (không phá suite khác nên vào `--profiles` của CI), chỉ trên Postgres. Tiền đề: Directus của cặp khởi động
  với `ADMIN_EMAIL`, `ADMIN_PASSWORD` rỗng nên `bootstrap` tạo role, policy Administrator mà không tạo user; bộ test xóa
  user, role, policy, access do mình tạo sau mỗi lượt và ở cuối để lượt sau và lần chạy CI sau vẫn gặp DB chưa có
  user.
- Tác vụ nền (export, import `background`) chạy trong tiến trình nhận request, mất khi tiến trình dừng, như Directus.
- Duyệt registry (FR-072): khi vận hành, app mới gọi registry thật như Directus (`https://registry.directus.io` hoặc
  `MARKETPLACE_REGISTRY`), không ra được thì `503` như Directus. Trong môi trường đối chiếu, cả hai app trỏ
  `MARKETPLACE_REGISTRY` tới một registry giả cố định (FR-100), không gọi registry thật.
- Môi trường đối chiếu không cài extension nào cho Directus; nếu đo thấy Directus có dòng `directus_extensions` sẵn thì
  ghi lại và so theo FR-070.
- GraphQL của các collection này thuộc 011; WebSocket, AI/MCP, deployment ngoài phạm vi (D-17).
- Ca của bộ blackbox, unit fail trên chính Directus ở một vendor được bỏ qua kèm ghi chú tên ca, như 005 đến 009.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% ca của bộ blackbox, unit port (FR-101) đạt ở cả hai app trên Postgres, MySQL, SQLite trước khi đóng
  feature; vendor còn lại đạt ở một lượt `nightly.yml` bấm tay hoặc được ghi chú theo Assumptions.
- **SC-002**: 100% request của bộ đối chiếu cho mọi route ở FR-001 (kể cả lỗi, `OPTIONS`, `HEAD`) cho cùng status, body,
  header ở hai app, ngoài khác biệt đã ghi (D-36, D-37 phần cài, gỡ, bật tắt, xóa extension; D-38 không có khác biệt
  HTTP).
- **SC-003**: 100% dòng DB do app mới ghi trong bộ đối chiếu trùng từng cột (theo tập so FR-100) với dòng Directus ghi
  cho cùng request.
- **SC-004**: 100% kịch bản dùng chéo (FR-102) đạt ở cả hai chiều: share tạo ở một app đăng nhập và đọc item được ở app
  kia, băm tạo ở một app kiểm được ở app kia, settings đổi ở một app có hiệu lực ngay ở app kia, file xuất ở một app tải
  được ở app kia.
- **SC-005**: Ở cả sáu chỗ gửi email (FR-090), mỗi email Directus sẽ gửi tương ứng đúng một dòng log cảnh báo (đếm
  trong log container ở bộ đối chiếu), response và dòng DB của luồng giống Directus, và app mới không có mã nào mở kết
  nối gửi thư: không phụ thuộc `nodemailer`, không có `MailService`, không đọc `EMAIL_TRANSPORT` (guard FR-091).
- **SC-006**: 100% kịch bản E2E app Directus (FR-103) qua app mới hoàn tất với cùng số bước và màn hình như qua Directus;
  ở mỗi kịch bản benchmark (FR-104), p95 latency và throughput của app mới không tệ hơn Directus quá 10%, như tiền lệ 005
  đến 009.
