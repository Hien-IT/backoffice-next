# Data model: Xác thực và phiên đăng nhập (003)

Feature này không tạo bảng hay cột (Nguyên tắc II). Mọi bảng dưới đây là bảng hệ thống của Directus 11.17.4. Cách ghi
từng dòng nằm ở [contracts/db-writes.md](./contracts/db-writes.md).

## 1. Bảng đọc và ghi

| Bảng | Đọc | Ghi (luồng) |
|------|-----|-------------|
| `directus_users` | `id`, `first_name`, `last_name`, `email`, `password`, `status`, `role`, `tfa_secret`, `provider`, `external_identifier`, `auth_data`, `token`; với snapshot revision: mọi cột không quan hệ | `last_access` (đăng nhập, refresh); `status` (khóa user, đặt lại mật khẩu); `password` (đặt lại mật khẩu); `auth_data`, `role`, `first_name`, `last_name`, `email` (SSO cập nhật); dòng mới (SSO tạo user) |
| `directus_sessions` | `token`, `user`, `share`, `expires`, `next_token` | Thêm (đăng nhập; refresh chế độ `session`), đổi `token` + `expires` (refresh `json`/`cookie`), đổi `next_token` + `expires` (grace period), xóa (logout, user không `active` khi refresh, đặt lại mật khẩu, SSO đổi email, dọn session hết hạn) |
| `directus_activity` | `id` (lấy khóa vừa thêm) | Thêm: `login`, `logout`, `update` (khóa user, đặt lại mật khẩu) |
| `directus_revisions` | — | Thêm: khóa user, đặt lại mật khẩu |
| `directus_settings` | `auth_login_attempts`, `auth_password_policy`, `project_name` | — |
| `directus_roles` | `id`, `parent` (cây role); `name` (LDAP: nhóm khớp tên role) | — |
| `directus_access`, `directus_policies` | `role`, `user`, `policy`; `admin_access`, `app_access`, `ip_access`, `enforce_tfa` | — |
| `directus_shares` | `id`, `date_start`, `date_end` (refresh session của share) | — |

`directus_users` có `accountability` mặc định (`all`), nên lần ghi có accountability tạo cả activity và revision.
`directus_activity` và `directus_revisions` có `accountability: null`, nên việc ghi chúng không tạo activity con.

## 2. Token, cookie và secret

| Thứ | Định dạng | Sống | Lưu ở |
|-----|-----------|------|-------|
| Access token | JWT HS256 ký bằng `SECRET`, `iss: "directus"`. Claim theo thứ tự: `id`, `role`, `app_access`, `admin_access`, `enforce_tfa` (khi cần), `session` (chế độ `session`), rồi `iat`, `exp`, `iss`. Share: `role: null`, `app_access: false`, `admin_access: false`, `share`, không có `id` | `ACCESS_TOKEN_TTL` (15m); chế độ `session`: `SESSION_COOKIE_TTL` (1d) | Không lưu |
| Refresh token | Chuỗi `nanoid(64)` (bảng chữ `A-Za-z0-9_-`) | `REFRESH_TOKEN_TTL` (7d); refresh chế độ `session`: `SESSION_COOKIE_TTL` | `directus_sessions.token` |
| Cookie refresh | `REFRESH_TOKEN_COOKIE_NAME` (`directus_refresh_token`) = refresh token | `Max-Age` = `REFRESH_TOKEN_TTL` | Trình duyệt |
| Cookie session | `SESSION_COOKIE_NAME` (`directus_session_token`) = access token có claim `session` | `Max-Age` = `SESSION_COOKIE_TTL` | Trình duyệt |
| Static token | Chuỗi bất kỳ không phải JWT của Directus | Không hết hạn | `directus_users.token` (đặt qua Directus tới 004) |
| Token đặt lại mật khẩu | JWT `{ email, scope: "password-reset", hash }`, `hash` = `getSimpleHash('' + password_hash)` | 1 ngày | Không lưu |
| Cookie trạng thái SSO | `openid.<provider>` hoặc `oauth2.<provider>` = JWT `{ verifier, redirect, prompt, otp, callbackUrl }` | `AUTH_<PROVIDER>_LOGIN_TIMEOUT` (5m) | Trình duyệt, `HttpOnly`, `SameSite=Lax`, `Secure` theo `AUTH_<PROVIDER>_COOKIE_SECURE` |
| Secret TFA | base32 do `otplib` sinh; URL `otpauth://totp/<issuer>:<account>?...` | — | `directus_users.tfa_secret` (ghi ở 005; 003 chỉ sinh) |
| `SECRET` thiếu | `nanoid(32)` cho từng process | Tới khi process dừng | Bộ nhớ process |

## 3. Trạng thái

### User (`directus_users.status`)

- Chỉ `active` đăng nhập, refresh, dùng static token được. `invited`, `draft`, `suspended`, `archived` thì bị từ chối.
- `active` → `suspended`: khi hết lượt `auth_login_attempts` (FR-041). Feature này không có chiều ngược lại: mở khóa
  làm qua Directus (`/users` ở 004).
- Đặt lại mật khẩu yêu cầu user đang `active` và ghi lại `status: active`.
- User SSO mới lấy `status` mặc định của cột (`active`).

### Session (`directus_sessions`)

```text
đăng nhập ──► [hợp lệ] ──refresh json/cookie──► [hợp lệ, token mới, hạn mới]
                │
                ├─refresh session──► [cũ: next_token, hạn = grace] + [mới: hạn SESSION_COOKIE_TTL]
                │                       └─ refresh lại cũ trong grace ──► trả cùng session mới, kéo dài hạn của nó
                ├─logout / đặt lại mật khẩu / SSO đổi email / user không active khi refresh ──► [xóa]
                └─hết hạn ──► [bị dọn ở lần đăng nhập kế tiếp (mọi user) hoặc refresh kế tiếp (cùng user/share)]
```

## 4. Redis (dùng chung với Directus)

| Key hoặc kênh | Ai ghi | Nội dung |
|---------------|--------|----------|
| `<RATE_LIMITER_KEY_PREFIX>:<userId>` (mặc định `rlflx:<userId>`) | Bộ đếm đăng nhập sai, khi `RATE_LIMITER_STORE=redis` | Số lượt đã dùng; không hết hạn (`duration: 0`); về 0 sau đăng nhập thành công hoặc khi khóa user |
| Permissions cache, namespace `roles-tree`, `global-access`, `global-access-roles`, `global-access-user` | `withCache` của 002 | Giống giá trị Directus ghi (mảng id role; `{ app, admin }`) |
| Kênh `schemaChanged`, `multi-cache` | `clearSystemCache` của 002, khi SSO đổi `role` của user | Như 002 |

## 5. Trạng thái trong process (dựng lại được, Nguyên tắc VII)

| Thứ | Dựng từ | Ghi chú |
|-----|---------|---------|
| Registry provider (`Map<name, AuthDriver>`) | Env khi khởi động | Giống Directus. Không có provider `saml` |
| Client OpenID, OAuth2 | Discovery của IdP (OpenID) hoặc env (OAuth2) | Tạo lại khi process khởi động |
| Client LDAP (bind) | Env | Kết nối khi cần |
| Instance bộ đếm đăng nhập sai | Env, tạo ở lần đăng nhập đầu | Số đếm nằm trong Redis khi store `redis` |
| Secret ngẫu nhiên khi thiếu `SECRET` | `nanoid(32)` | Cảnh báo của 001 (D-18) |
