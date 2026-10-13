# Data model: Collection hệ thống còn lại (010)

Feature này không có DDL. App mới đọc, ghi tám collection hệ thống qua service port của Directus (cùng dòng như
Directus), ghi `directus_sessions` (phiên share), `directus_files` (file xuất), `directus_notifications` (thông báo
của import, export), `directus_activity`, `directus_revisions` (qua `ItemsService`), và `directus_roles`,
`directus_policies`, `directus_access`, `directus_users` (`/server/setup`). Cột lấy từ
`directus/packages/system-data/src/fields/*.yaml`, quan hệ từ `relations/relations.yaml`.

## 1. Thực thể và quan hệ

| Thực thể | Nguồn | Service | Ghi chú |
|----------|-------|---------|---------|
| Settings | dòng `directus_settings` (singleton) | `SettingsService` | §2 |
| Preset / Bookmark | `directus_presets` | `PresetsService` | §3 |
| Notification | `directus_notifications` | `NotificationsService` (008) | §4 |
| Share, Phiên share | `directus_shares`, `directus_sessions.share` | `SharesService` | §5 |
| Translation string | `directus_translations` | `TranslationsService` | §6 |
| Dashboard, Panel | `directus_dashboards`, `directus_panels` | `DashboardsService`, `PanelsService` | §7 |
| Extension setting | `directus_extensions` (chỉ đọc) | `ExtensionsService` (Backoffice) | §8 |
| Import / Export job | bộ đếm Redis, file tạm, `directus_files`, thông báo | `ImportService`, `ExportService` | §9 |
| Admin đầu tiên | `directus_roles`, `directus_policies`, `directus_access`, `directus_users` | `createAdmin` | §10 |
| Cấu hình | `IMPORT_*`, `EXPORT_BATCH_SIZE`, `MAX_IMPORT_ERRORS`, `EXTENSIONS_CACHE_TTL`, `MARKETPLACE_*`, `ADMIN_*`, `SERVE_APP` | `@backoffice/env` | §11 |

Quan hệ (`relations.yaml`): Preset n–1 User (`user`), n–1 Role (`role`); Settings m2o tới `directus_files`
(`project_logo`, `public_foreground`, `public_background`, `public_favicon`), `directus_roles`
(`public_registration_role`), `directus_folders` (`storage_default_folder`); Panel n–1 Dashboard (`dashboard`, FK
CASCADE, `one_field: panels`, `one_deselect_action: delete`); Dashboard, Panel, Share n–1 User (`user_created`);
Notification n–1 User (`recipient`, `sender`); Share n–1 Role (`role`), n–1 Collection (`collection`); Session n–1
Share (`share`, FK CASCADE). Extension setting: `bundle` trỏ `id` của extension cha (không FK).

## 2. `directus_settings`

| Nhóm cột | Cột | Ghi chú |
|----------|-----|---------|
| Dự án | `project_name`, `project_descriptor`, `project_url`, `default_language`, `project_id` | `project_id` do migration đặt, chỉ đọc |
| Chủ dự án | `project_owner`, `project_usage`, `org_name`, `product_updates` (boolean), `project_status` | `setOwner` ghi năm cột; `project_status = null` (D-38) |
| Module, visual editor | `module_bar` (json), `visual_editor_urls` (json) | |
| Bảo mật, đăng ký | `auth_password_policy`, `auth_login_attempts`, `public_registration` (boolean), `public_registration_role` (m2o), `public_registration_verify_email` (boolean), `public_registration_email_filter` (json) | đọc bởi 003, 004 qua `readSingleton` |
| Files | `storage_asset_transform`, `storage_default_folder`, `storage_asset_presets` (json), `report_*_url` | đọc bởi 007 |
| Bản đồ, ảnh | `mapbox_key`, `basemaps` (json), `custom_aspect_ratios` (json), `collaborative_editing_enabled` | |
| Thương hiệu, theme | `project_color`, `project_logo`, `public_foreground`, `public_background`, `public_favicon`, `public_note`, `default_appearance`, `default_theme_light`, `theme_light_overrides` (json), `default_theme_dark`, `theme_dark_overrides` (json), `custom_css` | `/server/info` đọc 16 cột + `public_background.{id,type}` |
| AI, MCP | `ai_*`, `mcp_*` | đọc ghi như cột thường; tính năng ngoài phạm vi (D-17) |

Singleton: `readSingleton` trả dòng đầu hoặc giá trị mặc định của schema khi chưa có dòng; `upsertSingleton` tạo
hoặc cập nhật dòng đầu. Cast theo `special` (`cast-boolean`, `cast-json`) do `PayloadService`.

## 3. `directus_presets`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | tự tăng | bỏ khi so |
| `bookmark` | string, null | khác null = bookmark |
| `user` | uuid, null (m2o) | quyền tối thiểu: `_eq $CURRENT_USER` |
| `role` | uuid, null (m2o) | preset của role |
| `collection` | string | |
| `search` | string, null | |
| `layout` | string, null | |
| `layout_query`, `layout_options`, `filter` | json | |
| `refresh_interval` | int, null | |
| `icon`, `color` | string, null | |

Preset toàn cục: `user` và `role` đều null. Quyền tối thiểu app access (`app-access-permissions.yaml:36-73`): đọc với
`_or` [`user = $CURRENT_USER`, `role` trong cây role của user và `user` null, `user` và `role` null]; tạo với
`validation user = $CURRENT_USER`; sửa, xóa với `permissions user = $CURRENT_USER`.

## 4. `directus_notifications`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | tự tăng | |
| `timestamp` | timestamp (`date-created`) | bỏ khi so |
| `status` | string, mặc định `inbox` | `inbox`, `archived`; quyền tối thiểu chỉ cho sửa cột này |
| `recipient` | uuid (m2o users) | quyền tối thiểu đọc: `_eq $CURRENT_USER` |
| `sender` | uuid, null | |
| `subject` | string | |
| `message` | text, null | |
| `collection` | string, null | |
| `item` | string, null | |

Thông báo do feature này sinh: import nền ("Your import has been successful" / "Your import has failed",
`recipient = sender = người gọi`), export ("Your export of <collection> is ready" với `collection = directus_files`,
`item = <file id>`, hoặc "Your export of <collection> failed"). Mỗi `createOne` chạy `sendEmail` → một dòng log
cảnh báo khi user có `email` và `email_notifications = true` (D-33).

## 5. `directus_shares` và phiên share

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid | |
| `name` | string, null | |
| `collection` | string (m2o collections) | |
| `item` | string | khóa của item được chia sẻ |
| `role` | uuid, null (m2o roles) | giới hạn quyền (`getPermissionsForShare`) |
| `password` | string, null (`hash`, `conceal`) | argon2 khi ghi; `**********` khi đọc |
| `date_start`, `date_end` | timestamp, null | hạn dùng |
| `max_uses` | int, null | |
| `times_used` | int, mặc định 0 | `login` tăng 1 |
| `date_created`, `user_created` | special | |

Phiên share (`directus_sessions`): `token` (nanoid 64), `expires` (`now + REFRESH_TOKEN_TTL`), `ip`, `user_agent`,
`origin`, `share` (FK CASCADE), `user` null. Token JWT: `{ app_access: false, admin_access: false, role: null, share,
session? }`, `issuer: directus`, TTL `ACCESS_TOKEN_TTL` (json, cookie) hoặc `SESSION_COOKIE_TTL` (session).

Điều kiện đăng nhập (`login`): `id = share`, (`date_end` null hoặc ≥ now), (`date_start` null hoặc ≤ now),
(`max_uses` null hoặc ≥ `times_used`); mật khẩu khớp argon2 nếu share có mật khẩu. `GET /shares/info/:pk` đọc không
accountability với bộ lọc `date_start`, `date_end` (không kiểm `max_uses`).

## 6. `directus_translations`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid | |
| `key` | string | |
| `language` | string | |
| `value` | text | |

Ràng buộc duy nhất `key` + `language` do service (không có unique index trong DB): `createOne` và `updateMany` kiểm
trước khi ghi.

## 7. `directus_dashboards`, `directus_panels`

Dashboard: `id` (uuid), `name`, `icon` (mặc định `dashboard`), `note`, `color`, `date_created`, `user_created`,
`panels` (o2m). Panel: `id` (uuid), `dashboard` (FK CASCADE), `name`, `icon`, `color`, `note`, `type`, `show_header`
(boolean), `position_x`, `position_y`, `width`, `height`, `options` (json), `date_created`, `user_created`. Không có
quyền tối thiểu app access: user cần policy.

## 8. `directus_extensions` (chỉ đọc)

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid | |
| `folder` | string | tên thư mục hoặc tên gói |
| `source` | string | `local`, `registry`, `module` |
| `bundle` | uuid, null | id extension cha |
| `enabled` | boolean | |

`GET /extensions` trả `{ id, bundle, meta: <dòng>, schema: null }` cho dòng `bundle` null; dòng có `bundle` bị bỏ
(cha không có `schema`). Route cài, gỡ, bật tắt không ghi bảng này (D-37).

## 9. Import / Export job

| Thành phần | Nội dung |
|------------|----------|
| Bộ đếm import | cache `@backoffice/memory` kiểu `redis` namespace `IMPORT_EXPORT_NAMESPACE` (mặc định `directus:import-export`), khóa `importCount`, lock `lock`, TTL `IMPORT_TIMEOUT` (`1h`); Redis không cấu hình thì cache `local` |
| Giới hạn | `importCount >= IMPORT_MAX_CONCURRENCY` (20) → `LimitExceededError` category `Concurrent import` (`429`); giảm ở `finally` |
| Nhập | JSON (`StreamArray`), CSV (`Papa.parse`, header, `dynamicTyping`), từng dòng qua `getService(collection).upsertOne` trong transaction; lỗi gom tới `MAX_IMPORT_ERRORS` (1000) rồi ném `FailedValidationError`/lỗi gốc với `rows` |
| Xuất | transaction đọc `getService(collection).readByQuery` theo lô `EXPORT_BATCH_SIZE` (5000), `sort` luôn có khóa chính, `limit` của query giới hạn tổng; file tạm `createTmpFile()`; `transform(format)` nối từng lô (`includeHeader`, `includeFooter`); CSV: tiêu đề từ `getHeadingsForCsvExport(parseFields(fields))` |
| File xuất | `FilesService.uploadOne(stream, { ...file, title: 'export-<collection>-<getDateTimeFormatted()>', filename_download: '<title>.<format>', type })` với `type`: `csv` → `text/csv`, `csv_utf8` → `text/csv; charset=utf-8`, `json` → `application/json`, `xml` → `text/xml`, `yaml` → `text/yaml` |
| Thông báo | §4; link `PUBLIC_URL/admin/files/<id>` trong `message` của export |

## 10. Admin đầu tiên (`/server/setup`)

`createAdmin(schema, { email, password, first_name, last_name })`: `directus_roles` (`defaultAdminRole`: name
`Administrator`, icon `verified`, description `$t:admin_description`), `directus_policies` (`defaultAdminPolicy`:
`admin_access`, `app_access` true), `directus_access` (`policy`, `role`), `directus_users` (`defaultAdminUser`:
`status = active`, `first_name` mặc định `Admin`, `last_name` mặc định `User`, `email`, `password` (argon2 qua
`UsersService`), `role`, `token` từ `ADMIN_TOKEN` hoặc null). Rồi `setOwner(body)` (§2). Điều kiện: `directus_users`
trống.

## 11. Cấu hình (dùng chung `.env`, Nguyên tắc VIII)

| Biến | Mặc định | Dùng ở |
|------|----------|--------|
| `IMPORT_EXPORT_NAMESPACE` | `directus:import-export` | bộ đếm import |
| `IMPORT_TIMEOUT` | `1h` | TTL bộ đếm |
| `IMPORT_MAX_CONCURRENCY` | `20` | giới hạn import đồng thời (chung hai app) |
| `MAX_IMPORT_ERRORS` | `1000` | số lỗi gom |
| `EXPORT_BATCH_SIZE` | `5000` | lô đọc khi xuất |
| `EXTENSIONS_CACHE_TTL` | không đặt | `Cache-Control` của `/extensions/sources/:chunk` (`no-cache` khi không đặt) |
| `MARKETPLACE_REGISTRY` | không đặt (`https://registry.directus.io`) | client registry |
| `MARKETPLACE_TRUST` | `sandbox` | `sandbox=true` trong query list |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_TOKEN` | không đặt | fallback của `createAdmin` |
| `SERVE_APP` | `true` | có trả bundle `index.js` hay không (cảnh báo D-08 vẫn in) |

## 12. Event và cache

Mỗi ghi qua `ItemsService` phát `<scope>.items.<action>` với scope là tên bỏ tiền tố (`settings.update`,
`presets.create`, `notifications.create`, `shares.create`, `translations.update`, `dashboards.delete`,
`panels.update`) và xóa data cache theo `CACHE_AUTO_PURGE`, `CACHE_AUTO_PURGE_IGNORE_LIST` (mặc định gồm
`directus_presets`: ghi preset không xóa cache). `UtilsService.sort` phát `items.sort`, `<collection>.items.sort`
(action, payload `{ collection, item, to }`) và xóa data cache theo `shouldClearCache`. `/utils/cache/clear` xóa data
cache; với `system` xóa cả schema và quyền qua bus (hai app dựng lại). `SharesService.updateMany`, `deleteMany` xóa
cache quyền dùng chung trước khi ghi. Không có `extensions.*` (D-35), không có `email.send`.
