# Contract: `/settings`, `/presets`, `/notifications`, `/shares`, `/translations`, `/dashboards`, `/panels`, `/extensions`, `POST /server/setup` (010)

Mẫu theo contracts của 008, 009. Chuẩn là Directus 11.17.4: `controllers/{settings,presets,notifications,shares,
translations,dashboards,panels,extensions,server}.ts`. Mọi route có `respond` (response cache, `meta`), lỗi theo
`errors[]` của Directus. "CRUD chuẩn" = đúng khuôn `controllers/comments.ts` (008 R4): `POST /` (đơn hoặc mảng, đọc
lại theo `sanitizedQuery`, `Forbidden` khi đọc lại → `204`), `GET /`, `SEARCH /` (`validateBatch('read')`; `keys` →
`readMany`, còn lại `readByQuery`; `meta` qua `MetaService`), `GET /:pk`, `PATCH /` (mảng; hoặc `keys`/`query` +
`data`), `PATCH /:pk`, `DELETE /` (mảng hoặc `keys`/`query`), `DELETE /:pk`.

## 1. `/settings` (`useCollection('directus_settings')`)

| Route | Hành vi | Lỗi |
|-------|---------|-----|
| `GET /` | `readSingleton(sanitizedQuery)`; `{ data: record \|\| null }` | `403` không quyền đọc |
| `POST /owner` | `setOwner(body)`: `upsertSingleton({ project_owner, project_usage, org_name, product_updates, project_status: null })`, log cảnh báo thay báo cáo (D-38); không body (`204`) | `403` không quyền update |
| `PATCH /` | `upsertSingleton(body)` rồi `readSingleton(sanitizedQuery)` → `{ data }`; `Forbidden` khi đọc lại → `204` | `403`, lỗi validate của field |

## 2. `/presets`, `/notifications`, `/translations`, `/dashboards`, `/panels`

CRUD chuẩn với `useCollection` tương ứng; service: `PresetsService`, `NotificationsService`, `TranslationsService`,
`DashboardsService`, `PanelsService`. Khác biệt theo service:

| Collection | Thêm |
|------------|------|
| notifications | mỗi `createOne` (kể cả từng phần tử của mảng) chạy `sendEmail` → một dòng log cảnh báo khi user có `email` và `email_notifications = true` (D-33) |
| translations | `createOne` trùng `key` + `language` → `400 INVALID_PAYLOAD` "Duplicate key and language combination"; `updateMany` → cùng lỗi khi `keys.length > 0` và payload có cả `key` và `language`, hoặc khi payload có một trong hai và một dòng gộp bị trùng |
| dashboards | ghi lồng `panels` (o2m, `create/update/delete`); xóa dashboard xóa panel (FK CASCADE) |

## 3. `/shares` (`useCollection('directus_shares')`)

Thứ tự route (quyết định khớp ở Nest):

| # | Route | Hành vi | Lỗi |
|---|-------|---------|-----|
| 1 | `POST /auth` | joi `{ share: string required, password: string, mode: cookie\|json\|session }.unknown()`; `SharesService({ schema }).login(body, { session: mode === 'session' })`; `json`: `{ expires, access_token, refresh_token }`; `cookie`: cookie `REFRESH_TOKEN_COOKIE_NAME` với `REFRESH_COOKIE_OPTIONS`, body `{ expires, access_token }`; `session`: cookie `SESSION_COOKIE_NAME` với `SESSION_COOKIE_OPTIONS`, body `{ expires }` | `400 INVALID_PAYLOAD` (joi message); `401 INVALID_CREDENTIALS` (không tìm thấy share hợp lệ, sai mật khẩu) |
| 2 | `POST /invite` | joi `{ share: string required, emails: string[] }.unknown()`; `invite`: `403` không user; `readOne(share, { fields: ['collection'] })`; đọc người mời; mỗi email một dòng log cảnh báo (D-36); `204` | `400`, `403` |
| 3 | `POST /` | CRUD chuẩn; `createOne` kiểm `validateAccess(share, collection, [item])` | `403` |
| 4 | `GET /`, `SEARCH /` | CRUD chuẩn | |
| 5 | `GET /info/:pk` | `pk` phải uuid (hoa thường), không → `404 ROUTE_NOT_FOUND`; `SharesService({ schema }).readOne(pk, { fields: [id, collection, item, password, max_uses, times_used, date_start, date_end], filter: _and[_or[date_start ≤ now, null], _or[date_end ≥ now, null]] })`; `{ data }` | `403` không có dòng khớp |
| 6 | `GET /:pk` | `pk` phải uuid (hoa thường), không → `404 ROUTE_NOT_FOUND`; CRUD chuẩn | |
| 7 | `PATCH /`, `PATCH /:pk` | CRUD chuẩn (`:pk` uuid như #6); `updateMany` xóa cache quyền trước | |
| 8 | `DELETE /`, `DELETE /:pk` | CRUD chuẩn (`:pk` uuid như #6); `deleteMany` xóa cache quyền trước | |

`login`: chọn `id, date_start, date_end, times_used, max_uses, password` với bộ lọc hạn và `max_uses >= times_used`
(R-25); argon2 `verify(password_hash, payload.password)`; `update times_used + 1`; JWT `{ app_access: false,
admin_access: false, role: null, share, session? }` `issuer: directus`, `expiresIn` `SESSION_COOKIE_TTL` hoặc
`ACCESS_TOKEN_TTL`; insert `directus_sessions { token: nanoid(64), expires: now + REFRESH_TOKEN_TTL, ip, user_agent,
origin, share }`; `delete sessions where expires < now`; trả `{ accessToken, refreshToken, expires:
getMilliseconds(TTL) }`.

## 4. `/extensions` (`useCollection('directus_extensions')`, D-37)

| # | Route | Hành vi | Lỗi |
|---|-------|---------|-----|
| 1 | `GET /` | `ExtensionsService.readAll()`: dòng `directus_extensions` theo quyền người gọi, `bundle` null → `{ id, bundle, meta, schema: null }`; `{ data }` | `403` user không có quyền đọc (như Directus) |
| 2 | `GET /registry` | admin (`403`); `ListQuery` từ `sanitizedQuery`: `search`, `limit`, `offset`; `filter.by._eq`, `filter.type._eq` (type ngoài `EXTENSION_TYPES` → `403`); `sort[0]` ∈ `popular, recent, downloads`; `sandbox: true` khi `MARKETPLACE_TRUST === 'sandbox'`; `registry` = `MARKETPLACE_REGISTRY` nếu chuỗi; `list(query, options)`; payload là response registry (`{ meta: { filter_count }, data: [...] }`) | `503 SERVICE_UNAVAILABLE` service `marketplace` theo `handleRegistryError` (`TimeoutError` → "The registry server is not responding"; `TypeError` có "fetch" → "Unable to connect to the registry server"; khác → `error.message`; không phải Error → "An unknown error occurred"); `OutOfDateError` khi `/version` của registry khác `2024-01-29` |
| 3 | `GET /registry/account/:pk` | admin; uuid; `account(pk, options)` | như trên; không uuid → `404` |
| 4 | `GET /registry/extension/:pk` | admin; uuid; `describe(pk, options)` | như trên |
| 5 | `POST /registry/install` | admin; thiếu `version` hoặc `extension` → `403`; rồi `503 SERVICE_UNAVAILABLE` `{ service: 'marketplace', reason: 'Backoffice does not install extensions' }` | |
| 6 | `POST /registry/reinstall` | admin; thiếu `extension` → `403`; rồi `503` như trên | |
| 7 | `DELETE /registry/uninstall/:pk` | admin; uuid; `503` như trên | |
| 8 | `PATCH /:pk` | admin; uuid; `403 FORBIDDEN` | |
| 9 | `DELETE /:pk` | admin; uuid; `403 FORBIDDEN` | |
| 10 | `GET /sources/:chunk` | `chunk === 'index.js'` và `SERVE_APP` truthy → body `EMPTY_APP_EXTENSION_BUNDLE` (research R6), `Content-Type: application/javascript; charset=UTF-8`, `Cache-Control: getCacheControlHeader(req, getMilliseconds(EXTENSIONS_CACHE_TTL), false, false)`, `Vary: Origin, Cache-Control`; không qua `respond` | `404 ROUTE_NOT_FOUND` chunk khác hoặc `SERVE_APP` tắt |

Trong Directus `/sources/:chunk` không kiểm quyền (app tải trước đăng nhập): app mới cũng không.

## 5. `POST /server/setup`

| Bước | Hành vi |
|------|---------|
| 1 | `ServerService.isSetupCompleted()` (`directus_users` có dòng) → `403 FORBIDDEN` |
| 2 | `createAdmin(req.schema, { email: body.project_owner, password: body.password, first_name, last_name })`: role, policy, access, user (fallback `ADMIN_*`; thiếu email hoặc password → không tạo user, không lỗi) |
| 3 | `SettingsService({ schema }).setOwner(body)` không await (D-38: log, không gửi) |
| 4 | `Forbidden` bên trong → `204`; lỗi khác ném ra; thành công `204` |

## 6. Quyền (engine 004, `app-access-permissions.yaml`)

| Collection | Quyền tối thiểu app access | Khác |
|------------|----------------------------|------|
| `directus_settings` | read | update: policy |
| `directus_presets` | read (`user`/`role`/toàn cục), create (`validation user = $CURRENT_USER`), update, delete (`user = $CURRENT_USER`) | |
| `directus_notifications` | read (`recipient = $CURRENT_USER`), update (field `status`, `recipient = $CURRENT_USER`) | create, delete: policy |
| `directus_shares` | read (`user_created = $CURRENT_USER`) | create: hành động `share` trên item; update, delete: policy |
| `directus_translations` | read | ghi: policy |
| `directus_dashboards`, `directus_panels`, `directus_extensions` | không | policy; `/extensions/registry*` admin |

## 7. Event, cache

Xem data-model.md §12. `respond` áp response cache cho `GET`, `SEARCH` như 005; `POST /shares/auth`,
`POST /shares/invite`, `POST /settings/owner`, `POST /server/setup`, `/extensions/sources/:chunk` không cache.

## 8. Log cảnh báo mới (tiền tố `Backoffice:`, mức `warn`)

| Chỗ | Dòng |
|-----|------|
| `SharesService.invite` | `Backoffice: mail sending is out of scope; share invitation "<subject>" for <email> not sent` (một dòng mỗi email) |
| `SettingsService.setOwner` | `Backoffice: owner report is out of scope; project owner for <org_name \|\| "(no org)"> not reported` (không in email) |

## 9. Khác biệt với Directus (tham chiếu spec)

D-36 (invite), D-37 (extensions), D-38 (owner report). Mọi route khác: không khác biệt.

## 10. `router-options` (khối Feature 010, phần hệ thống)

| Mẫu | Allow |
|-----|-------|
| `/settings` | `GET,HEAD,PATCH` |
| `/settings/owner` | `POST` |
| `/(presets\|notifications\|translations\|dashboards\|panels\|shares)` | `POST,GET,HEAD,SEARCH,PATCH,DELETE` |
| `/(presets\|notifications\|translations\|dashboards\|panels\|shares)/<pk>` | `GET,HEAD,PATCH,DELETE` |
| `/shares/auth`, `/shares/invite` | `POST` |
| `/shares/info/<uuid>` | `GET,HEAD` |
| `/extensions` | `GET,HEAD` |
| `/extensions/registry` | `GET,HEAD` |
| `/extensions/registry/(account\|extension)/<uuid>` | `GET,HEAD` |
| `/extensions/registry/(install\|reinstall)` | `POST` |
| `/extensions/registry/uninstall/<uuid>` | `DELETE` |
| `/extensions/<uuid>` | `PATCH,DELETE` |
| `/extensions/sources/<chunk>` | `GET,HEAD` |
| `/server/setup` | `POST` |

Tính từ thứ tự route của chín router Directus (Express 4: mọi route khớp, theo thứ tự, HEAD sau GET), như 008, 009;
`apps/api/src/middleware/router-options.ts` khối Feature 010 (T004). `/shares/<không uuid>`, `/extensions/<không uuid>`,
`/settings/<khác>` không khớp route nào → `404`. Bộ đối chiếu của mỗi controller so `OPTIONS` với Directus thật.
Đo 2026-10-14: `OPTIONS` của các mẫu trên trùng Directus 11.17.4 ở `src/system/{settings,presets,notifications,
translations,insights,shares,extensions}.test.ts` và `src/server/methods.test.ts` (`/server/setup` → `200 Allow: POST`).
