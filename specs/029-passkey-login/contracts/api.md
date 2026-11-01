# Contract: API REST (D-207, D-207.2, D-207.3)

Mọi route dưới `/backoffice/` (D-189.6); Directus 11.17.4 trả 404 `ROUTE_NOT_FOUND` ở tất cả (D-207, `doc`). Không
endpoint có sẵn nào đổi hành vi. Lỗi dùng mã có sẵn: `INVALID_CREDENTIALS` (401), `FORBIDDEN` (403), `INVALID_PAYLOAD`
(400), `ROUTE_NOT_FOUND` (404), `SERVICE_UNAVAILABLE` (503, kho rate limiter/challenge không với tới). Mọi GET đặt
`res.locals.cache = false` (không vào response cache dùng chung).

Passkey "bật" = `PUBLIC_URL` tuyệt đối và hostname không phải IP (research R5). Khi tắt, **mọi** route dưới đây trả
404 `ROUTE_NOT_FOUND` như Directus.

## Công khai

### `GET /backoffice/auth/passkey`

| | |
|-|-|
| Response 200 | `{ "data": { "rp_id": "bo.example.com" } }` |
| Dùng để | web quyết định hiện nút login và card (`rp_id === location.hostname`); không lộ gì khác |

### `POST /backoffice/auth/passkey/login/options`

| | |
|-|-|
| Body | không |
| Response 200 | `{ "data": <PublicKeyCredentialRequestOptionsJSON> }`: `challenge` (base64url), `rpId`, `timeout` 300000, `userVerification: "required"`, `allowCredentials: []` |
| Tác dụng phụ | challenge vào kho với `purpose: login`, 5 phút |
| Giới hạn | rate limiter toàn cục (`RATE_LIMITER_*`) như mọi route |

### `POST /backoffice/auth/passkey/login`

| | |
|-|-|
| Body | `{ "response": <AuthenticationResponseJSON>, "mode"?: "json" \| "cookie" \| "session" }` (`mode` mặc định `json` như `/auth/login`) |
| Response 200 | y hệt `/auth/login` theo `mode`: `json` → `{ data: { expires, access_token, refresh_token } }`; `cookie` → `{ data: { expires, access_token } }` + cookie `REFRESH_TOKEN_COOKIE_NAME`; `session` → `{ data: { expires } }` + cookie `SESSION_COOKIE_NAME` (cùng `refreshCookieOptions()`/`sessionCookieOptions()`) |
| Tác dụng phụ | như login local: dòng `directus_sessions`, activity `login`, `last_access`, `auth.login` filter pending + action success với `provider: "default"`, `payload: { passkey: true, mode }`; reset `auth_login_attempts`; thêm `counter`, `last_used` của passkey. Không OTP, không `enforce_tfa` trong token (D-207.3) |
| 400 `INVALID_PAYLOAD` | body không có `response` đúng dạng, `mode` lạ (sau `stall`) |
| 401 `INVALID_CREDENTIALS` | challenge không có/đã dùng/hết hạn/sai mục đích (challenge đăng ký); thiếu cờ xác minh người dùng (UV); `response.id` không có dòng; user không có (mồ côi), `status !== active`, `provider !== default`; chữ ký sai; counter lùi hoặc bằng khi đã lưu > 0; `verified === false`. Cùng thông điệp "Invalid user credentials.", cùng `LOGIN_STALL_TIME` cho mọi nhánh |
| Đếm attempt | user `active` và `provider = default`: `consumeLoginAttempt` trước khi xác minh (như mật khẩu), hết lượt → `suspended` + activity/revision; user không có, không `active` hay sai provider: từ chối trước, không đếm (như `authentication.service.ts:131`; sửa khi analyze 2026-11-01) |
| 503 `SERVICE_UNAVAILABLE` | kho rate limiter không với tới (như login local), kho challenge không với tới |

## Cần xác thực (user của mình; mọi token có `accountability.user` như `/users/me/tfa/*`; `provider` phải là `default`, khác → 403 `FORBIDDEN`; không xác thực → 401)

### `GET /backoffice/users/me/passkeys`

```json
{ "data": [ { "id": "…", "name": "MacBook Pro (Touch ID)", "date_created": "2026-11-01T09:12:33.000Z",
  "last_used": null, "device_type": "multiDevice", "backed_up": true, "transports": ["internal"] } ] }
```

Sắp theo `date_created` tăng dần. Không trả `credential_id`, `public_key`, `counter`.

### `POST /backoffice/users/me/passkeys/options`

| | |
|-|-|
| Body | `{ "password": "…" }` |
| Kiểm | `AuthenticationService.verifyPassword(user, password)` như `POST /users/me/tfa/generate`; sai → 401 `INVALID_CREDENTIALS` (không đếm attempt, như TFA); đã có 10 passkey → 400 `INVALID_PAYLOAD` reason `"User already has the maximum of 10 passkeys"` |
| Response 200 | `{ "data": <PublicKeyCredentialCreationOptionsJSON> }`: `rp: { id, name: project_name \|\| "Backoffice" }`, `user: { id: base64url(uuid), name: email, displayName: "First Last" \|\| email }`, `challenge`, `pubKeyCredParams` (ES256, RS256 mặc định thư viện), `excludeCredentials` (mọi passkey hiện có của user, với `transports`), `authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" }`, `attestation: "none"`, `timeout` 300000 |
| Tác dụng phụ | challenge vào kho với `purpose: register`, `user` |

### `POST /backoffice/users/me/passkeys`

| | |
|-|-|
| Body | `{ "response": <RegistrationResponseJSON>, "name": "MacBook Pro (Touch ID)" }` |
| Kiểm | challenge lấy-và-xóa nguyên tử trong kho với `purpose: register` và `user` = user hiện tại (không có, đã dùng, sai mục đích, của user khác → 400 `INVALID_PAYLOAD`); `verifyRegistrationResponse` (`requireUserVerification`: thiếu cờ UV → 400, origin, rpID); `credentialDeviceType`/`credentialBackedUp` lưu; credential id > 255 ký tự → 400; trùng `credential_id` → 400; `name` trim 1–100 → 400; vẫn còn chỗ (10) → 400 |
| Response 200 | `{ "data": { "id", "name", "date_created", "last_used": null, "device_type", "backed_up", "transports" } }` |

### `PATCH /backoffice/users/me/passkeys/:id`

Body `{ "name": "…" }` (1–100). 200 `{ data: <dòng> }`; `:id` không của user → 403 `FORBIDDEN` (không lộ tồn tại).

### `DELETE /backoffice/users/me/passkeys/:id`

204. `:id` không của user → 403 `FORBIDDEN`. Không cần mật khẩu (clarify câu 4).

## Admin (`accountability.admin`; khác → 403 `FORBIDDEN`)

### `GET /backoffice/users/:pk/passkeys`

Như `GET .../me/passkeys` cho user `:pk`; user không có → `[]`; user `provider !== default` → `[]` (không 403, để card
quyết định ẩn theo `provider`).

### `DELETE /backoffice/users/:pk/passkeys/:id`

204; `:id` không thuộc `:pk` → 403. Không cần mật khẩu (như `POST /users/:pk/tfa/disable`).

## Thay đổi gián tiếp

| Chỗ | Backoffice | Directus |
|-----|-----------|----------|
| `DELETE /users/:id`, `/users` (batch), GraphQL `delete_users_item(s)` | xóa thêm dòng `backoffice_passkeys` của user (D-207.2) | chỉ bảng DR |
| `GET /collections`, `/fields/backoffice_passkeys`, OAS, GraphQL introspection/SDL | `backoffice_passkeys` là collection hệ thống ẩn, 403 `/items/backoffice_passkeys`, không type GraphQL | bảng chưa quản lý (normalizer `backoffice_*`, D-207.1) |
| `GET /auth` | không đổi (passkey không phải provider) | như nhau |
| `/auth/login`, `/auth/refresh`, `/auth/logout`, `/users/me` | không đổi; session do passkey tạo làm mới và đăng xuất như mọi session, cả ở Directus cùng DB; `refresh` giữ `bo_passkey` trên dòng phiên mới | như nhau |
| `GET /policies/me/globals`, GraphQL `policies_me_globals` (D-207.5) | `enforce_tfa: false` khi token là token phiên và dòng `directus_sessions` của nó có `bo_passkey = true` (không đọc, không ghi response cache cho phiên đó: `Cache-Control: no-cache`); mọi trường hợp khác (phiên mật khẩu/LDAP/SSO, token `json`/`cookie`, static token, share) như Directus | `enforce_tfa: true` khi policy bắt buộc, kể cả với cookie của phiên passkey (không đọc cột) |
| `GET /fields/directus_sessions`, `/schema/snapshot` | cột `bo_passkey` hiện như mọi cột DB (meta null); snapshot bỏ bảng hệ thống | như nhau (cùng DB) |

## Sự kiện và log

Log không ghi challenge, `response` của authenticator hay public key (FR-007).

- `auth.login` (filter pending, action success/fail): `provider: "default"`, `payload: { passkey: true, mode }`, `user`,
  `status`, `error` như login local (clarify câu 3).
- `auth.jwt` filter: như login local (token không có `enforce_tfa` khi passkey).
- Log `warn` lúc khởi động khi passkey tắt vì `PUBLIC_URL`; log `info` mỗi lần đăng ký/xóa passkey (user id, passkey
  id) qua logger request.
