# Contract: `/activity`, `/revisions`, `/comments`, mention, thông báo (008)

Mốc: `controllers/activity.ts`, `revisions.ts`, `comments.ts`, `services/comments.ts`, `notifications.ts` của Directus
11.17.4. Mọi route trả `{data, meta?}` qua `respond` (response cache dùng chung), lỗi `{errors: [{message,
extensions: {code, reason?}}]}`.

## 1. `/activity` (`useCollection('directus_activity')`)

| Route | Service | Ghi chú |
|-------|---------|---------|
| `GET /` | `readSingleton` nếu `req.singleton`, `readMany(body.keys)` nếu có, còn lại `readByQuery` | `meta` qua `MetaService.getMetaForQuery('directus_activity')` |
| `SEARCH /` | `validateBatch('read')` rồi như trên | body `{query}` hoặc `{keys}` |
| `GET /:pk` | `readOne(pk, sanitizedQuery)` | `{data: null}` khi không có |

Quyền: admin đọc tất cả; user app access tối thiểu đọc dòng `user = $CURRENT_USER`; public `403`. Không có route ghi
(Directus 11 bỏ `/activity/comment`).

## 2. `/revisions` (`useCollection('directus_revisions')`)

| Route | Service | Ghi chú |
|-------|---------|---------|
| `GET /`, `SEARCH /` | `validateBatch('read')`, `readByQuery` | không `readMany`, không singleton |
| `GET /:pk` | `readOne` | `{data: null}` khi không có |

Query của app Directus (`use-revisions.ts`): `filter` `{collection, item, version?, activity.action?}`, `aggregate`
`{count: 'id'}`, `fields` `id, data, delta, collection, item, activity.action, activity.timestamp, activity.user.*,
activity.ip, activity.user_agent, activity.origin`, `sort=-id`, `limit`, `page`. `RevisionsService` ghi với
`autoPurgeCache: false`, `bypassLimits: true`; đọc chịu `QUERY_LIMIT_MAX`.

## 3. `/comments` (`useCollection('directus_comments')`)

| Route | Service | Ghi chú |
|-------|---------|---------|
| `POST /` | `createMany` (mảng) hoặc `createOne`, rồi `readMany`/`readOne`; `Forbidden` khi đọc lại → `204` | `200` |
| `GET /`, `SEARCH /` | `validateBatch('read')`; `readMany(keys)` hoặc `readByQuery` | `meta` |
| `GET /:pk` | `readOne` | |
| `PATCH /` | `validateBatch('update')`; `updateBatch`, `updateMany(keys, data)`, `updateByQuery` | |
| `PATCH /:pk` | `updateOne` | |
| `DELETE /` | `validateBatch('delete')`; `deleteMany(body)`, `deleteMany(keys)`, `deleteByQuery` | `204` |
| `DELETE /:pk` | `deleteOne` | `204` |

### 3.1 Lỗi của `CommentsService.createOne`

| Điều kiện | Status | code | reason |
|-----------|--------|------|--------|
| Không `accountability.user` (create, update, delete) | 403 | `FORBIDDEN` | |
| Thiếu `comment` | 400 | `INVALID_PAYLOAD` | `"comment" is required` |
| Thiếu `collection` | 400 | `INVALID_PAYLOAD` | `"collection" is required` |
| Thiếu `item` | 400 | `INVALID_PAYLOAD` | `"item" is required` |
| Không đọc được item (`validateAccess` read) | 403 | `FORBIDDEN` | |

Thứ tự kiểm đúng như trên (user → comment → collection → item → quyền).

### 3.2 Mention

- Regex `@[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}` (không phân biệt hoa thường), `uniq`.
- Với mỗi mention: `usersService.readOne(uuid, {fields: id, first_name, last_name, email, role.id})` (service không
  accountability; user không tồn tại → lỗi `403` của `readOne` ném ra); dựng accountability `{user, role, admin, app,
  roles: fetchRolesTree, ip: null}` + `fetchGlobalAccess`; `validateAccess` read item với accountability đó:
  `Forbidden` → log warn `User <id> doesn't have proper permissions to receive notification for this item.` và bỏ
  qua; lỗi khác ném ra.
- Thông báo: `recipient`, `sender`, `subject` `You were mentioned in <collection>`, `message` theo mẫu Directus
  (mention thay bằng `<em>userName</em>` hoặc `@Unknown User`, mỗi dòng comment thêm `> `, link
  `PUBLIC_URL/admin/content/<collection>/<item>`), `collection`, `item`.
- Email: `NotificationsService.sendEmail` đọc user; nếu `email` và `email_notifications = true` thì ghi log cảnh báo
  `Backoffice: mail sending is out of scope; notification <id> for <email> not sent` và không gọi mail (D-33, Nguyên
  tắc X); không đọc `EMAIL_*`.

## 4. `getService`

| Collection | Service |
|------------|---------|
| `directus_activity` | `ActivityService` (đã có) |
| `directus_revisions` | `RevisionsService` (đã có) |
| `directus_versions` | `VersionsService` (mới) |
| `directus_comments` | `CommentsService` (mới; bỏ khỏi `COLLECTIONS_WITHOUT_SERVICE_YET`) |
| `directus_notifications` | `NotificationsService` (mới; bỏ khỏi `COLLECTIONS_WITHOUT_SERVICE_YET`) |

## 5. `OPTIONS`, `HEAD`, cache

Như các route item (005): `router-options` theo mẫu `/activity*`, `/revisions*`, `/versions*`, `/comments*`; `HEAD`
trả header của `GET`; response cache theo `CACHE_*`, `Cache-Control: no-store` bỏ qua cache khi `CACHE_SKIP_ALLOWED`.
