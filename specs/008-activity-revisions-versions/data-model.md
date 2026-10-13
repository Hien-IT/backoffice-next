# Data model: Lịch sử thay đổi, content versioning, comment (008)

Feature này không có DDL. App mới ghi `directus_activity`, `directus_revisions`, `directus_versions`,
`directus_comments`, `directus_notifications` với cùng dòng như Directus và xóa `directus_activity`,
`directus_revisions` theo job retention với cùng điều kiện. Không có key Redis mới ngoài khóa
`schedule--data-retention` (`directus:lock`) và clock `retention` (`directus-sync`, khi bật). Cột lấy từ
`directus/packages/system-data/src/fields/{activity,revisions,versions,comments,notifications}.yaml`.

## 1. Thực thể và quan hệ

| Thực thể | Nguồn | Ghi chú |
|----------|-------|---------|
| Activity | Dòng `directus_activity` | §2; ghi bởi `ItemsService` (mọi service con), `AuthenticationService`, `VersionsService.save` |
| Revision | Dòng `directus_revisions` | §3; ghi khi `meta.accountability = all` |
| Version | Dòng `directus_versions` | §4; `VersionsService` |
| Comment | Dòng `directus_comments` | §5; `CommentsService` |
| Notification | Dòng `directus_notifications` | §6; `NotificationsService` khi comment có mention |
| Cấu hình retention | `RETENTION_*`, `ACTIVITY_RETENTION`, `REVISIONS_RETENTION`, `FLOW_LOGS_RETENTION` | §7 |

Quan hệ: Revision n–1 Activity (`activity`, FK `ON DELETE CASCADE`); Revision n–1 Revision (`parent`, FK
`ON DELETE SET NULL`); Revision n–1 Version (`version`, FK `ON DELETE CASCADE`); Activity n–1 User (`user`, không FK);
Version n–1 User × 2 (`user_created`, `user_updated`, FK `SET NULL`); Comment n–1 User × 2 (`user_created`,
`user_updated`, FK `SET NULL`); Notification n–1 User × 2 (`recipient` CASCADE, `sender` SET NULL). `collection`,
`item` của Activity, Revision, Version, Comment, Notification là chuỗi, không FK (item xóa vẫn giữ lịch sử).

## 2. `directus_activity`

| Cột | Kiểu | App mới ghi | Ghi chú |
|-----|------|-------------|---------|
| `id` | integer tự tăng | DB | bỏ khi so |
| `action` | string | `create`, `update`, `delete`, `login`, `logout`, `version_save` (feature này), `run` (Directus, flows) | `Action` của `@backoffice/constants`; không ghi `revert`, `comment`, `upload` ở 11.17.4 |
| `user` | uuid, null | `accountability.user` | null cho public |
| `timestamp` | timestamp | DB `now()` | bỏ khi so |
| `ip` | string, null | `accountability.ip` | theo `IP_TRUST_PROXY`, `IP_CUSTOM_HEADER` |
| `user_agent` | string, null | `accountability.userAgent` | header `User-Agent` nguyên |
| `collection` | string | tên collection | |
| `item` | string | khóa chính dạng chuỗi | |
| `origin` | string, null | `accountability.origin` | header `Origin` |

Alias `revisions` (o2m tới `directus_revisions.activity`) đọc được qua `fields`.

## 3. `directus_revisions`

| Cột | Kiểu | App mới ghi | Ghi chú |
|-----|------|-------------|---------|
| `id` | integer tự tăng | DB | bỏ khi so; ánh xạ chỉ số trong `historyEffects` |
| `activity` | integer FK | id activity cùng transaction | so qua chỉ số |
| `collection` | string | | |
| `item` | string | | |
| `data` | json, null | bản chụp item sau ghi, bỏ field quan hệ (`readMany` với `snapshotFields`) | `save`: bằng delta |
| `delta` | json, null | payload sau `prepareDelta` (các field thay đổi) | `save`: delta đã `prepareDelta` |
| `parent` | integer FK, null | revision của ghi lồng cha (`opts.parent`) | so qua chỉ số |
| `version` | uuid FK, null | id version khi `version_save` | so qua `key` |

Revert: Directus 11.17.4 dùng `data` của revision làm payload `updateOne` (không route ở 008; app Directus gửi qua
`PATCH /items`).

## 4. `directus_versions`

| Cột | Kiểu | App mới ghi | Ghi chú |
|-----|------|-------------|---------|
| `id` | uuid | `ItemsService` sinh | bỏ khi so; so qua `key` |
| `key` | string | payload; không được `main`; duy nhất theo (`key`, `collection`, `item`) do service kiểm (không unique index) | |
| `name` | string, null | payload | |
| `collection` | string | payload; phải có `meta.versioning = true` | |
| `item` | string | payload | |
| `hash` | string, null | `objectHash(mainItem)` lúc tạo | so bằng tuyệt đối (R2) |
| `date_created`, `date_updated` | timestamp | special `date-created`, `date-updated` | bỏ khi so |
| `user_created`, `user_updated` | uuid | special `user-created`, `user-updated` | |
| `delta` | json, null | `assign({}, existingDelta, revisionDelta)`; mỗi object thay đổi mang `_user`, `_date` (`Date` từ `writeTimestamp`, serial hóa ISO) | so sau khi thay `_date` bằng marker |

Vòng đời: tạo (`hash`) → `save` nhiều lần (gộp delta, hash không đổi) → `compare` (`outdated` khi hash item chính
đổi) → `promote` (cập nhật item chính; version vẫn còn, Directus không xóa) → `DELETE`. Chỉ `key`, `name` sửa được qua
`PATCH`.

## 5. `directus_comments`

| Cột | Kiểu | App mới ghi | Ghi chú |
|-----|------|-------------|---------|
| `id` | uuid | sinh | bỏ khi so |
| `collection` | string | payload, bắt buộc | kiểm quyền đọc item |
| `item` | string | payload, bắt buộc | |
| `comment` | text | payload, bắt buộc | mention `@<uuid v4>` |
| `date_created`, `date_updated` | timestamp | special | bỏ khi so |
| `user_created`, `user_updated` | uuid | special | `createOne`, `updateOne`, `deleteOne` đòi `accountability.user` |

Collection có `accountability` trong system-data nên ghi comment sinh activity, revision như Directus (FR-044).

## 6. `directus_notifications`

| Cột | Kiểu | App mới ghi | Ghi chú |
|-----|------|-------------|---------|
| `id` | integer tự tăng | DB | bỏ khi so |
| `timestamp` | timestamp | DB | bỏ khi so |
| `status` | string | mặc định `inbox` | |
| `recipient` | uuid | user được nhắc | |
| `sender` | uuid, null | người viết comment | |
| `subject` | string | `You were mentioned in <collection>` | |
| `message` | text, null | mẫu của `CommentsService` (trích comment, `<em>tên</em>`, link `PUBLIC_URL/admin/content/<collection>/<item>`) | |
| `collection`, `item` | string | của comment | |

Email: không gửi (D-33); `sendEmail` chạy tới bước quyết định gửi rồi ghi log cảnh báo.

## 7. Retention

| Biến | Mặc định | Tác dụng |
|------|----------|----------|
| `RETENTION_ENABLED` | `false` | bật job |
| `RETENTION_SCHEDULE` | `0 0 * * *` | cron; không hợp lệ thì không đăng ký |
| `RETENTION_BATCH` | `500` | số dòng mỗi lần xóa |
| `ACTIVITY_RETENTION` | `90d` | `directus_activity` `action != run` có `timestamp` cũ hơn |
| `FLOW_LOGS_RETENTION` | `90d` | `directus_activity` `action = run` |
| `REVISIONS_RETENTION` | `90d` | `directus_revisions` nối `directus_activity` theo `timestamp`; chỉ khi `ACTIVITY_RETENTION` tắt hoặc lớn hơn |

Khóa Redis `schedule--data-retention` (giá trị: thời điểm ms), hạn 10 phút, cập nhật sau mỗi lô, xóa khi xong. Giá
trị không phải thời lượng → `getMilliseconds` trả `undefined` → task bỏ qua.

## 8. Event và cache

| Sự kiện | Khi | Payload |
|---------|-----|---------|
| `activity.create`, `revisions.create`, `versions.create|update|delete`, `comments.create|update|delete`, `notifications.create` (scope = tên collection bỏ tiền tố) | như `ItemsService` | như 005 |
| `items.promote`, `<collection>.items.promote` (filter) | trước `updateOne` của promote | `payloadToUpdate`, meta `{collection, item, version}` |
| `items.promote` (action) | sau `updateOne` | `{payload, collection, item, version}` |

Data cache: `save` xóa toàn bộ khi `shouldClearCache(cache, undefined, collection)`; ghi version, comment, notification
qua `ItemsService` xóa theo `CACHE_AUTO_PURGE` như 005; `RevisionsService` không xóa (`autoPurgeCache: false`).
