# Contract: API xác thực (003)

Nguồn gốc:
- `directus/api/src/controllers/auth.ts` và router của từng driver trong `directus/api/src/auth/drivers/*.ts`;
- `controllers/users.ts` (`/me/tfa/generate`);
- `services/authentication.ts`, `services/users.ts`, `services/tfa.ts`;
- `middleware/authenticate.ts`, `middleware/extract-token.ts`.

Mọi giá trị, message, status như Directus 11.17.4, trừ các khác biệt ghi ở bảng D-xx của spec. Message lỗi lấy từ
`@backoffice/errors` (port của `@directus/errors`).

## 1. Vị trí trong pipeline

`extractToken` (001) → rate limiter (001) → `/server/ping` → **bước xác thực** → `schema` (002) → `cache` → route.

Bước xác thực (research R2):
- path khớp `^/auth(/|$)` hoặc `^/users/me/tfa/generate/?$` (không phân biệt hoa thường): `authenticate`;
- path khác: `publicAccountability` của 001 (D-10, tới 004).

`authenticate` lấy token từ `req.token`:
- không có token: accountability public (`createDefaultAccountability` + `ip`, `userAgent` cắt 1024, `origin`);
- JWT có `iss: "directus"`: kiểm chữ ký và hạn bằng `SECRET`; thiếu `role`, `app_access` hoặc `admin_access` thì
  `INVALID_TOKEN`; có claim `session` thì phải có dòng `directus_sessions` khớp `token`, `user` (hoặc `null`), `share`
  (hoặc `null`), chưa hết hạn; gán `user`, `role`, `roles`, `admin`, `app`, `session`, `share`;
- chuỗi khác: static token, tìm user `active` có `token` bằng chuỗi đó.

| Lỗi | Status | Mã | Ghi chú |
|-----|--------|----|---------|
| JWT hết hạn | 401 | `TOKEN_EXPIRED` | |
| JWT sai chữ ký, sai định dạng, thiếu claim | 403 | `INVALID_TOKEN` | |
| Lỗi khác khi kiểm JWT | 503 | `SERVICE_UNAVAILABLE` | `service: jwt` |
| Static token không khớp, session không còn | 401 | `INVALID_CREDENTIALS` | |

Khi lỗi `INVALID_CREDENTIALS` hoặc `INVALID_TOKEN` và token đến từ cookie `SESSION_COOKIE_NAME`, response xóa cookie đó
theo §4.

Các route `/auth/*` không dùng `req.accountability`. Chúng tạo accountability mặc định riêng
(`createDefaultAccountability({ ip })` + `userAgent` + `origin`), như Directus.

## 2. Endpoint

`<p>` là tên provider trong `AUTH_PROVIDERS`, so không phân biệt hoa thường theo thứ tự khai báo. Ô "404" là
`404 ROUTE_NOT_FOUND`.

| Method, path | Có khi | Vào | Ra (thành công) |
|--------------|--------|-----|-----------------|
| `GET /auth` | luôn | query `sessionOnly` | `200 {data: [{name, label, driver, icon}], disableDefault}`; danh sách lọc theo `sessionOnly` như Directus, bỏ provider `saml` (D-24) |
| `POST /auth/login` | `AUTH_DISABLE_DEFAULT` khác `true` | `{email, password, mode?, otp?}` | §3 |
| `POST /auth/login/<p>` | driver `local` | như trên | §3 |
| `POST /auth/login/<p>` | driver `ldap` | `{identifier, password, mode?, otp?}` | §3 (LDAP) |
| `GET /auth/login/<p>` | driver `openid`, `oauth2` | query `redirect?`, `prompt?`, `otp?` | `302` tới IdP, đặt cookie trạng thái (§5) |
| `POST /auth/login/<p>/callback` | driver `openid`, `oauth2` | form `application/x-www-form-urlencoded` | `303` tới `./callback?<form>` |
| `GET /auth/login/<p>/callback` | driver `openid`, `oauth2` | query của IdP, cookie trạng thái | §5 |
| `POST /auth/refresh` | luôn | `{mode?, refresh_token?}`, cookie | §3 |
| `POST /auth/logout` | luôn | `{mode?, refresh_token?}`, cookie | `204`; xóa cookie (§4) |
| `POST /auth/password/request` | luôn | `{email, reset_url?}` | `204` (cả khi user không có, không `active`, SSO) |
| `POST /auth/password/reset` | luôn | `{token, password}` | `204` |
| `POST /users/me/tfa/generate` | luôn | `{password}` (user provider `default`) | `200 {data: {secret, otpauth_url}}` |

Mọi tổ hợp khác dưới `/auth/login/...`, và `/users/me/tfa/enable`, `/users/me/tfa/disable`, `/users/:pk/tfa/disable`
(D-09.10, tới 005), trả 404.

### 2.1 Lỗi theo endpoint (message như Directus)

| Endpoint | Điều kiện | Status, mã |
|----------|-----------|------------|
| login (`local`) | Joi lỗi (`email` thiếu hoặc sai, `password` thiếu, `mode` lạ, `otp` không phải chuỗi) | `400 INVALID_PAYLOAD`, `reason` là message Joi; chờ `LOGIN_STALL_TIME` |
| login (`ldap`) | Joi lỗi (`identifier`, `password`, `mode`, `otp`) | `400 INVALID_PAYLOAD`, **không** chờ (như router LDAP của Directus) |
| login | không thấy user, user không `active`, `provider` khác, sai mật khẩu | `401 INVALID_CREDENTIALS` |
| login | user có TFA, thiếu hoặc sai `otp` | `401 INVALID_OTP` |
| login | rate limiter lỗi (không phải hết lượt) | `503 SERVICE_UNAVAILABLE` (`service: authentication`, `reason: Rate limiter unreachable`) |
| refresh, logout | không có refresh token theo chế độ | `400 INVALID_PAYLOAD` (`The refresh token is required in either the payload or cookie`) |
| refresh | token không có, hết hạn, share ngoài khoảng ngày | `401 INVALID_CREDENTIALS` |
| refresh | user `suspended` | `401 USER_SUSPENDED` (xóa session, chờ `LOGIN_STALL_TIME`) |
| refresh | user không `active` khác | `401 INVALID_CREDENTIALS` (xóa session, chờ) |
| refresh, logout | provider của user không được đăng ký (gồm `saml`) | `503 INVALID_PROVIDER_CONFIG`, log `error` `Auth provider not configured` (FR-078) |
| refresh (OpenID, OAuth2) | IdP trả `invalid_grant` | `403 INVALID_TOKEN` |
| password/request | `email` không phải chuỗi | `400 INVALID_PAYLOAD` (`"email" field is required`) |
| password/request | `reset_url` ngoài `PASSWORD_RESET_URL_ALLOW_LIST` | `400 INVALID_PAYLOAD` (`URL "<url>" can't be used to reset passwords`) |
| password/reset | thiếu `token` hoặc `password` (không phải chuỗi) | `400 INVALID_PAYLOAD` (`"token" field is required`, `"password" field is required`) |
| password/reset | JWT hết hạn / sai | `401 TOKEN_EXPIRED` / `403 INVALID_TOKEN` |
| password/reset | `scope` sai, thiếu `hash`, user không `active`, `hash` không khớp | `403 FORBIDDEN` |
| password/reset | mật khẩu trái `auth_password_policy` | `400 FAILED_VALIDATION` (`extensions` như `@directus/validation`), kiểm sau bước user |
| tfa/generate | chưa đăng nhập | `401 INVALID_CREDENTIALS` |
| tfa/generate | user `default` thiếu `password` / sai mật khẩu | `400 INVALID_PAYLOAD` (`"password" is required`) / `401 INVALID_CREDENTIALS` |
| tfa/generate | đã bật TFA; user `default` không có email | `400 INVALID_PAYLOAD` (message như `TFAService.generateTFA`) |
| SSO bắt đầu | `redirect` không hợp lệ (`resolveLoginRedirect`) | `400 INVALID_PAYLOAD` (`URL "<redirect>" can't be used to redirect after login`) |

## 3. Response theo chế độ

| Route | `json` | `cookie` | `session` |
|-------|--------|----------|-----------|
| login `local`, refresh | body `{expires, refresh_token, access_token}` | body `{expires, access_token}` + cookie refresh | body `{expires}` + cookie session |
| login `ldap` | body `{access_token, expires, refresh_token}` | body `{access_token, expires}` + cookie refresh | body `{access_token, expires}` + cookie session |

- `expires` là số mili giây của `ACCESS_TOKEN_TTL`, hoặc `SESSION_COOKIE_TTL` ở `session`.
- Mặc định của login là `json`.
- refresh và logout: `mode` trong body; nếu không có thì `json` khi body có `refresh_token`, ngược lại `cookie`. Chế độ
  `session` lấy claim `session` của JWT trong cookie session; cookie không phải JWT của Directus thì coi như không có
  token.

## 4. Cookie

| Cookie | Đặt bằng | Thuộc tính |
|--------|----------|------------|
| `REFRESH_TOKEN_COOKIE_NAME` | `res.cookie(name, token, REFRESH_COOKIE_OPTIONS)` | `HttpOnly`, `Domain` = `REFRESH_TOKEN_COOKIE_DOMAIN`, `Max-Age` = `REFRESH_TOKEN_TTL`, `Expires`, `Path=/`, `Secure` khi `REFRESH_TOKEN_COOKIE_SECURE`, `SameSite` = `REFRESH_TOKEN_COOKIE_SAME_SITE` (`Lax`; rỗng thì `Strict`) |
| `SESSION_COOKIE_NAME` | `res.cookie(name, jwt, SESSION_COOKIE_OPTIONS)` | Như trên với `SESSION_COOKIE_*` |
| `openid.<p>`, `oauth2.<p>` | `res.cookie(name, jwt, {httpOnly: true, sameSite: 'lax', secure})` | Cookie phiên trình duyệt (không `Max-Age`), `Path=/` |

**Xóa cookie theo Express 4.21.2** (research R4): `clearCookie(res, name, options)` =
`res.cookie(name, '', { expires: new Date(1), path: '/', ...options })`. Với `REFRESH_COOKIE_OPTIONS` hoặc
`SESSION_COOKIE_OPTIONS`, header là cookie rỗng có `Max-Age=<TTL>` và `Expires` ở tương lai, đúng như Directus.
Xóa cookie trạng thái SSO (không truyền options) cho `Expires=Thu, 01 Jan 1970 00:00:00 GMT`.

Logout xóa cookie refresh và cookie session nếu request có gửi cookie đó. `authenticate` xóa cookie session khi nó là
token lỗi (§1).

## 5. SSO (OpenID, OAuth2)

| Bước | Kết quả |
|------|---------|
| `GET /auth/login/<p>` | Tính `redirect` (`resolveLoginRedirect`, mặc định `/`) và `callbackUrl` (`generateCallbackUrl`: origin của request khớp `AUTH_ALLOWED_PUBLIC_URLS`, ngược lại `PUBLIC_URL`) + `/auth/login/<p>/callback`. Đặt cookie trạng thái (§4) rồi `302` tới URL authorize với PKCE (`S256`, hoặc `plain` khi `PLAIN_CODE_CHALLENGE`), `state` = code challenge (OpenID thêm `nonce` = code challenge), `scope` (OpenID `openid profile email`, OAuth2 `email`), `access_type=offline`, `prompt=consent` khi `prompt`, `PARAMS`, `redirect_uri` |
| OpenID không dựng được URL | `302` tới `<PUBLIC_URL>/admin/login?reason=SERVICE_UNAVAILABLE` |
| `POST .../callback` | `303` tới `./callback?<URLSearchParams(form)>` |
| `GET .../callback`, cookie sai | OpenID: `302` tới `<PUBLIC_URL>/admin/login?reason=INVALID_CREDENTIALS`. OAuth2: `401 INVALID_CREDENTIALS` |
| `GET .../callback`, đăng nhập lỗi | xóa cookie trạng thái; `INVALID_TOKEN` khi chưa `prompt` thì `302` tới `./?redirect=<r>&prompt=true` (không có `redirect` thì `./?prompt=true`); có `redirect` thì `302` tới `<redirect bỏ query>?reason=<mã lỗi hoặc UNKNOWN_EXCEPTION>`; không có `redirect` thì ném lỗi (JSON) |
| `GET .../callback`, thành công | xóa cookie trạng thái. Token có `enforce_tfa` thì `redirect` thành `<PUBLIC_URL>/admin/tfa-setup` (thêm `redirect`, `provider` nếu có). Có `redirect`: đặt cookie session (`MODE=session`, mặc định) hoặc cookie refresh, rồi `302`. Không có `redirect`: `200 {data: {access_token, refresh_token, expires}}` |

Luồng bắt đầu ở một app và callback ở app kia phải thành công: cookie trạng thái ký bằng `SECRET` chung (Nguyên tắc VII).

## 6. `OPTIONS`

Trả `200`, header `Allow` và body giống nhau, như router Express 4 của Directus (research R3):

| Path | `Allow` |
|------|---------|
| `/auth` | `GET,HEAD` |
| `/auth/refresh`, `/auth/logout`, `/auth/password/request`, `/auth/password/reset`, `/auth/login` (khi có provider `default`), `/auth/login/<local hoặc ldap>`, `/users/me/tfa/generate` | `POST` |
| `/auth/login/<openid hoặc oauth2>` | `GET,HEAD` |
| `/auth/login/<openid hoặc oauth2>/callback` | `POST,GET,HEAD` |

Path khác dưới `/auth` trả 404.
