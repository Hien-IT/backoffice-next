# Contract: Biến môi trường của feature 003

Tên, mặc định và cách ép kiểu giống Directus 11.17.4 (`libs/env`, port nguyên `directus/packages/env`). Các biến dưới
đây chuyển từ nhóm C ("chưa hỗ trợ", có cảnh báo) sang nhóm A ("hỗ trợ") trong
`apps/api/src/config/supported-variables.ts` (FR-090). Không thêm biến `BACKOFFICE_*`.

## 1. Chuyển sang nhóm A

| Biến (mẫu regex) | Mặc định | Dùng ở |
|------------------|----------|--------|
| `ACCESS_TOKEN_TTL` | `15m` | TTL access token, `expires` |
| `REFRESH_TOKEN_TTL` | `7d` | Hạn dòng session, `Max-Age` cookie refresh |
| `REFRESH_TOKEN_COOKIE_NAME` | `directus_refresh_token` | Tên cookie refresh |
| `REFRESH_TOKEN_COOKIE_DOMAIN` | không có | `Domain` |
| `REFRESH_TOKEN_COOKIE_SECURE` | `false` | `Secure` |
| `REFRESH_TOKEN_COOKIE_SAME_SITE` | `lax` | `SameSite` (rỗng thì `strict`) |
| `SESSION_COOKIE_TTL` | `1d` | TTL token chế độ `session`, hạn session mới khi refresh `session`, `Max-Age` |
| `SESSION_COOKIE_DOMAIN`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAME_SITE` | không có, `false`, `lax` | Thuộc tính cookie session. `SESSION_COOKIE_NAME` đã ở nhóm A từ 001 |
| `SESSION_REFRESH_GRACE_PERIOD` | `10s` (code dự phòng 10000 ms) | Grace period khi refresh `session` |
| `LOGIN_STALL_TIME` | `500` | Thời gian chờ tối thiểu (FR-040) |
| `PASSWORD_RESET_URL_ALLOW_LIST` | không có | Kiểm `reset_url` |
| `HASH_.+` | không có (mặc định của argon2) | Tham số `argon2.hash` (`HASH_RAW` bị bỏ như Directus) |
| `USERS_ADMIN_ACCESS_LIMIT`, `USERS_APP_ACCESS_LIMIT`, `USERS_API_ACCESS_LIMIT` | `Infinity` | Kiểm số user khi ghi `directus_users` (`validateUserCountIntegrity`) |
| `MAX_BATCH_MUTATION` | `Infinity` | Số item tối đa mỗi lần ghi của `ItemsService` |
| `CACHE_AUTO_PURGE_IGNORE_LIST` | `directus_activity,directus_presets` | Collection không xóa cache khi ghi (`shouldClearCache`) |
| `AUTH_PROVIDERS` | `''` | Danh sách provider |
| `AUTH_DISABLE_DEFAULT` | `false` | Tắt `/auth/login` của provider `default` |
| `AUTH_ALLOWED_PUBLIC_URLS` | không có | Chọn callback URL theo origin |
| `AUTH_.+_DRIVER`, `AUTH_.+_CLIENT_ID`, `AUTH_.+_CLIENT_SECRET`, `AUTH_.+_SCOPE`, `AUTH_.+_AUTHORIZE_URL`, `AUTH_.+_ACCESS_URL`, `AUTH_.+_PROFILE_URL`, `AUTH_.+_IDENTIFIER_KEY`, `AUTH_.+_EMAIL_KEY`, `AUTH_.+_FIRST_NAME_KEY`, `AUTH_.+_LAST_NAME_KEY`, `AUTH_.+_ALLOW_PUBLIC_REGISTRATION`, `AUTH_.+_DEFAULT_ROLE_ID`, `AUTH_.+_SYNC_USER_INFO`, `AUTH_.+_ICON`, `AUTH_.+_LABEL`, `AUTH_.+_PARAMS`, `AUTH_.+_ISSUER_URL`, `AUTH_.+_ISSUER_DISCOVERY_MUST_SUCCEED`, `AUTH_.+_CLIENT_HTTP_.+`, `AUTH_.+_AUTH_REQUIRE_VERIFIED_EMAIL`, `AUTH_.+_CLIENT_URL`, `AUTH_.+_BIND_DN`, `AUTH_.+_BIND_PASSWORD`, `AUTH_.+_USER_DN`, `AUTH_.+_USER_ATTRIBUTE`, `AUTH_.+_USER_SCOPE`, `AUTH_.+_MAIL_ATTRIBUTE`, `AUTH_.+_FIRST_NAME_ATTRIBUTE`, `AUTH_.+_LAST_NAME_ATTRIBUTE`, `AUTH_.+_GROUP_DN`, `AUTH_.+_GROUP_ATTRIBUTE`, `AUTH_.+_GROUP_SCOPE`, `AUTH_.+_REDIRECT_ALLOW_LIST`, `AUTH_.+_COOKIE_SECURE` | như Directus | Provider `local`, `openid`, `oauth2`, `ldap` (các mẫu có trong `directus-variables.ts`, trừ `IDP`, `SP`) |

Biến của provider không nằm trong `directus-variables.ts`, ví dụ `AUTH_<P>_MODE`, `AUTH_<P>_ROLE_MAPPING`,
`AUTH_<P>_GROUP_CLAIM_NAME`, `AUTH_<P>_LOGIN_TIMEOUT`, `AUTH_<P>_CLIENT_PRIVATE_KEYS`,
`AUTH_<P>_CLIENT_TOKEN_ENDPOINT_AUTH_METHOD`, `AUTH_<P>_PLAIN_CODE_CHALLENGE`, `AUTH_<P>_REQUIRE_VERIFIED_EMAIL`: vẫn được
đọc từ process (`createEnv` đọc mọi biến), không được cảnh báo (không phải biến Directus), và không có hậu tố `_FILE`
(giống Directus, vì `_FILE` chỉ áp dụng cho biến trong danh sách).

## 2. Vẫn ở nhóm C (cảnh báo khi khởi động)

| Biến | Lý do |
|------|-------|
| `AUTH_.+_IDP.+`, `AUTH_.+_SP.+` | Chỉ driver `saml` dùng (Nguyên tắc XI) |
| `EMAIL_*` | Không gửi email (Nguyên tắc X) |
| `EMAIL_VERIFICATION_TOKEN_TTL`, `REGISTER_STALL_TIME`, `USER_INVITE_TOKEN_TTL`, `USER_INVITE_URL_ALLOW_LIST`, `USER_REGISTER_URL_ALLOW_LIST` | Đăng ký, mời user (feature 004) |
| `RATE_LIMITER_REGISTRATION_*`, `RATE_LIMITER_EMAIL_*` | Như 001 (004, email) |

## 3. Cảnh báo một instance (dòng 5 của `contracts/startup.md` 001)

Lý do `RATE_LIMITER_STORE is "memory"` nay được ghi khi `RATE_LIMITER_STORE` là `memory` (kể cả mặc định), không còn
phụ thuộc `RATE_LIMITER_ENABLED` hay `RATE_LIMITER_GLOBAL_ENABLED`. Lý do là bộ đếm đăng nhập sai luôn chạy (FR-041).
