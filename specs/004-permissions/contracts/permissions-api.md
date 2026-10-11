# Contract: API của `/users`, `/roles`, `/policies`, `/access`, `/permissions` (004)

Mốc: `directus/api/src/controllers/{users,roles,policies,access,permissions}.ts` của 11.17.4. Mọi route, thứ tự khớp
route, body, query, status, mã lỗi, message, header giữ như Directus (Nguyên tắc III). Route được viết thành controller
Nest mỏng theo thứ tự đăng ký của file gốc (research R3). Thứ tự middleware chung: `extractToken` → `authenticate`
(mọi path, FR-001) → `schema` → `sanitizeQuery` (mới, D-12 thu hẹp) → `cache` (D-11, chưa đọc cache) → controller.

## 1. Route CRUD chung (năm controller)

Thứ tự đăng ký (quyết định route nào khớp trước và header `Allow` của `OPTIONS`):

| # | Route | Middleware | Hành vi |
|---|-------|-----------|---------|
| 1 | `POST /` | — | body object → `createOne`; mảng → `createMany`. Đọc lại bằng `readOne`/`readMany` với `req.sanitizedQuery`; lần đọc lại ném `FORBIDDEN` thì không có payload → `204`. Status `200` (Nest phải đặt `@HttpCode(200)`) |
| 2 | `GET /` | `validateBatch('read')` (đặt `req.body = {}`) | `readByQuery(sanitizedQuery)` + `MetaService.getMetaForQuery` → `{ data, meta }` |
| 3 | `SEARCH /` | `validateBatch('read')` | `body.query` (nếu có) thay query string (qua `sanitizeQuery` + `validateQuery`); body phải khớp `{ keys?: (string|number)[], query?: object }` |
| 4 | `GET /me`... | — | route riêng của từng controller (§2) |
| 5 | `GET /:pk` | — | `readOne(pk, sanitizedQuery)`; ở `/users`, `/policies`, `/access`, `/permissions`: `req.path.endsWith('me')` thì `next()` (không có route sau → `404 ROUTE_NOT_FOUND`, kể cả `/users/some`) |
| 6 | `PATCH /` | `validateBatch('update')` | mảng → `updateBatch`; `{ keys, data }` → `updateMany`; `{ query, data }` → `updateByQuery`; `keys` xor `query`; `data` bắt buộc. Đọc lại bằng `readMany`; `FORBIDDEN` → `204` |
| 7 | `PATCH /:pk` | — | `updateOne`; đọc lại; `FORBIDDEN` → `204` |
| 8 | `DELETE /` | `validateBatch('delete')` | mảng khóa → `deleteMany`; `{ keys }` → `deleteMany`; `{ query }` → `deleteByQuery`. `204` |
| 9 | `DELETE /:pk` | — | `deleteOne`. `204` |

Quy tắc chung:
- `req.collection` = `directus_<x>` (`useCollection`), dùng cho `MetaService` và `sanitizeQuery`.
- `validateBatch`: `GET` đặt body rỗng; thiếu body → `400 INVALID_PAYLOAD` `Payload in body is required`; lỗi Joi →
  `400 INVALID_PAYLOAD` với message Joi (`"data" is required`, `"value" contains a conflict between exclusive peers
  [query, keys]`...).
- Không có payload (`res.locals.payload` rỗng) → `204` không body (`respond`).
- Mọi thao tác ghi: số item > `MAX_BATCH_MUTATION` → `400 INVALID_PAYLOAD` `Exceeded max batch mutation limit of <n>`
  (`ItemsService`, không có dấu chấm cuối).
- Khác nhau giữa controller:
  - `SEARCH /users`, `SEARCH /roles`: bỏ qua `body.keys`, luôn `readByQuery`.
  - `/policies`, `/access`: có `body.keys` thì `readMany(keys, sanitizedQuery)`.
  - `/permissions`: `req.singleton` có thì `readSingleton`; luôn `readByQuery({ ...sanitizedQuery, limit: -1 })` và
    `meta` với `limit: -1`.
- Khóa chính không hợp lệ (`'me'` ở `PATCH /policies/me`, `DELETE /users/me`, pk không phải uuid): `validateKeys` →
  `403 FORBIDDEN`, như Directus.

## 2. Route riêng

### `/users`

| Route | Điều kiện | Kết quả |
|-------|-----------|---------|
| `GET /users/me` | token share → `{ data: { share } }`; không `user` → `401 INVALID_CREDENTIALS` | `readOne(user, sanitizedQuery)`; `FORBIDDEN` → `{ data: { id } }` |
| `PATCH /users/me` | không `user` → `401` | `updateOne(user, body)` với accountability của request rồi `readOne`; không có đường lui khi `FORBIDDEN` |
| `PATCH /users/me/track/page` | không `user` → `401`; thiếu `last_page` → `400 INVALID_PAYLOAD` `"last_page" key is required` | `UsersService` không accountability, `updateOne(user, { last_page }, { autoPurgeCache: false })`; `204`; không activity |
| `POST /users/invite` | Joi: `email` (email hoặc mảng email, bắt buộc), `role` (uuid v4, bắt buộc), `invite_url` (uri) → `400 INVALID_PAYLOAD` | `inviteUser(email, role, invite_url ?? null)`; `204` (D-27: log thay email) |
| `POST /users/invite/accept` | Joi: `token`, `password` bắt buộc | `acceptInvite`; `204`. Lỗi: `401 TOKEN_EXPIRED`, `403 INVALID_TOKEN` (chữ ký, scope), `400 INVALID_INVITE` `This invite is no longer valid.`, `400 FAILED_VALIDATION` (chính sách mật khẩu) |
| `POST /users/me/tfa/generate` | 003 | như 003 |
| `POST /users/me/tfa/enable` | không `user` → `401`; thiếu `secret` hoặc `otp` → `400 INVALID_PAYLOAD` | `TFAService.enableTFA(user, otp, secret)`: `TFA Secret is already set for this user`, `"otp" is invalid` (400); ghi `tfa_secret` qua `ItemsService('directus_users')` với accountability của request; `204` |
| `POST /users/me/tfa/disable` | không `user` → `401`; thiếu `otp` → `400` | `verifyOTP` rồi `disableTFA`: `User "<id>" doesn't have TFA enabled`, `"otp" is invalid`; `204` |
| `POST /users/:pk/tfa/disable` | không `user` → `401`; không admin → `403 FORBIDDEN` | `disableTFA(pk)`; `204` |
| `POST /users/register` | `checkRateLimit` (`RATE_LIMITER_REGISTRATION_*`, theo IP) → `429 REQUESTS_EXCEEDED` + `Retry-After`; Joi: `email`, `password` bắt buộc, `verification_url` uri, `first_name`, `last_name` | `UsersService` không accountability `.registerUser`; `204`. Lỗi: `400` `URL "<url>" can't be used to verify registered users`; `403 FORBIDDEN` (tắt đăng ký; email không khớp bộ lọc, sau khi chờ) |
| `GET /users/register/verify-email?token=` | Joi `token` lỗi → `302` tới `/admin/login` | `verifyRegistration(token)` → `302` tới `/admin/users/<id>`. Lỗi: `403 INVALID_TOKEN`/`FORBIDDEN` (scope), `401 TOKEN_EXPIRED`, `400 INVALID_PAYLOAD` `Invalid verification code` |

### `/roles`

| Route | Điều kiện | Kết quả |
|-------|-----------|---------|
| `GET /roles/me` | không `user` và không `role` → `403 FORBIDDEN` | `readMany(roles, { ...sanitizedQuery, limit: -1 })`; `FORBIDDEN` → `{ data: roles.map(id => ({ id })) }` |

`GET /roles/:pk` không bỏ qua path kết thúc bằng `me`.

### `/policies`

| Route | Điều kiện | Kết quả |
|-------|-----------|---------|
| `GET /policies/me/globals` | không `user` và không `role`, hoặc `FORBIDDEN` → `200` `{ data: { app_access: false } }` | `fetchAccountabilityPolicyGlobals` → `{ data: { app_access, admin_access, enforce_tfa } }` |

### `/permissions`

| Route | Điều kiện | Kết quả |
|-------|-----------|---------|
| `GET /permissions/me` | không `user`, không `role`, không `share` → `403 FORBIDDEN` | `fetchAccountabilityCollectionAccess` → `{ data: { [collection]: { [action]: { access: 'none'|'partial'|'full', fields?, presets? } } } }`; admin: mọi collection, mọi action `{ access: 'full', fields: ['*'] }` |
| `GET /permissions/me/:collection/:pk?` | `getItemPermissions`: không `user` → `403` | `{ data: { update: { access, fields?, presets? }, delete: { access }, share: { access } } }`; admin: cả ba `true`; singleton không có dòng: `update` kiểm như `create`; singleton có quyền `update`: thêm `fields` (hợp, `*` thắng), `presets` (gộp nông) |

`GET /permissions` với `app = true`: thêm quyền tối thiểu của app (`id: null`, `policy: null`, `system: true`), lọc theo
`filter` của request (`withAppMinimalPermissions`).

## 3. `OPTIONS` (header `Allow`)

Theo router Express 4 của Directus: method của mọi route khớp path, theo thứ tự đăng ký, `HEAD` sau `GET`, không lặp;
không route nào khớp → `404 ROUTE_NOT_FOUND`. Thêm vào bảng của `middleware/router-options.ts` (001, 003):

| Path | `Allow` |
|------|---------|
| `/users`, `/roles`, `/policies`, `/access`, `/permissions` | `POST,GET,HEAD,SEARCH,PATCH,DELETE` |
| `/users/me`, `/roles/me`, `/permissions/me`, `/<x>/<pk>` (một đoạn) | `GET,HEAD,PATCH,DELETE` |
| `/users/invite`, `/users/register` | `GET,HEAD,PATCH,DELETE,POST` |
| `/users/me/track/page` | `PATCH` |
| `/users/invite/accept`, `/users/me/tfa/generate`, `/users/me/tfa/enable`, `/users/me/tfa/disable`, `/users/<pk>/tfa/disable` | `POST` |
| `/users/register/verify-email`, `/policies/me/globals`, `/permissions/me/<collection>`, `/permissions/me/<collection>/<pk>` | `GET,HEAD` |

`CORS_ENABLED=true` thì `cors` trả lời `OPTIONS` trước (như 001).

## 4. Query (D-12 thu hẹp)

`sanitizeQuery` chạy cho mọi route sau `schema`: `fields`, `filter` (parse JSON, giải biến động theo accountability),
`search`, `sort`, `limit` (`QUERY_LIMIT_DEFAULT` 100, `QUERY_LIMIT_MAX`), `offset`, `page`, `meta`, `aggregate`,
`groupBy`, `deep`, `alias`, `backlink`, `export` (giữ giá trị, xử lý ở 005); `validateQuery`: `400 INVALID_QUERY` cho
giá trị sai kiểu, toán tử lạ, `alias` sai, độ sâu quan hệ quá `MAX_RELATIONAL_DEPTH`. Query rỗng → `req.sanitizedQuery`
= `{}` đóng băng. Áp dụng cả cho `/server/*`, `/metrics`, path lạ (D-12 của 001 chỉ còn `export`).

## 5. Lỗi (mã, status, message)

| Mã | Status | Message | Khi |
|----|--------|---------|-----|
| `FORBIDDEN` | 403 | `You don't have permission to access this.` | mặc định: đọc theo id không ra dòng; `validateKeys`; `GET /roles/me`, `GET /permissions/me` không đăng nhập; không admin ở `/users/:pk/tfa/disable`; đăng ký tắt hoặc email bị lọc |
| | | `You don't have permission to perform "<action>" for collection "<c>" or it does not exist.` | `validateAccess` không field |
| | | `You don't have permissions to perform "<action>" for the field(s) "a", "b" in collection "<c>" or it does not exist.` | `validateAccess` có field |
| | | `You don't have permission to access collection "<c>" or it does not exist. Queried in root.` / `... Queried in "<path>".` | `processAst`, `processPayload` (collection) |
| | | `You don't have permission to access field "<f>" in collection "<c>" or it does not exist. Queried in ...` / `... fields "<f1>", "<f2>" ... or they do not exist. Queried in ...` | `processAst`, `processPayload` (field) |
| `INVALID_PAYLOAD` | 400 | message Joi, hoặc các `reason` ở §2 và: `You can't change the "tfa_secret" value manually`, `You can't change the "provider" value manually`, `You can't change the "external_identifier" value manually`, `A role cannot be a parent of itself`, `A role cannot have a parent that is already a descendant of itself`, `IP Access contains an incorrect value. Valid values are: IP addresses, IP ranges and CIDR blocks`, `URL "<url>" can't be used to invite users` | |
| `INVALID_QUERY` | 400 | message của `validateQuery` | §4 |
| `FAILED_VALIDATION` | 400 | `Provided password doesn't match password policy`; lỗi theo field (`Validation failed for field "<f>". Value <...>`), với `extensions` `{ field, type, valid?, invalid?, substring?, path? }` | `processPayload`, `checkPasswordPolicy`, email |
| `RECORD_NOT_UNIQUE` | 400 | như `translateDatabaseError` hoặc `UsersService` (email, static token) | |
| `INVALID_INVITE` | 400 | `This invite is no longer valid.` | |
| `UNPROCESSABLE_CONTENT` | 422 | `Cannot remove the last admin user from the system` | `validateRemainingAdminCount` |
| `LIMIT_EXCEEDED` | 403 | `<category> limit exceeded.` với `extensions.category` là `Active Admin users`, `Active App users` (app + admin) hoặc `Active API users` | giới hạn `USERS_*_ACCESS_LIMIT` |
| `INVALID_CREDENTIALS` | 401 | | không `user` ở `/users/me*`, `/users/me/tfa/*`; static token sai |
| `TOKEN_EXPIRED` | 401; `INVALID_TOKEN` | 403 | JWT, token mời, token xác minh |
| `REQUESTS_EXCEEDED` | 429 | + `Retry-After` | limiter đăng ký |
| `ROUTE_NOT_FOUND` | 404 | | path không khớp, kể cả `GET /<x>/…me` của §1 dòng 5 |

Thứ tự ném lỗi (FR-033): hook filter (không có, D-29) → kiểm quyền → `preMutationError` của service (email, mật khẩu,
URL mời) → ghi DB → kiểm toàn vẹn số user (trong transaction) → xóa cache → đọc lại.

## 6. Response

- `{ data }` cho đọc một; `{ data, meta? }` cho danh sách (`meta` chỉ khi query có `meta`); `204` cho xóa và cho đọc
  lại bị cấm.
- `POST /` tạo nhiều trả mảng các item đọc lại theo thứ tự khóa.
- Header: như 001 (`Cache-Control: no-cache`, `Vary: Origin, Cache-Control` tới 005; `X-Powered-By: Backoffice`
  D-01; `Content-Type: application/json; charset=utf-8`).
- Field che (`conceal`): `password`, `tfa_secret`, `token` → `**********` khi có giá trị, `null` khi trống.
