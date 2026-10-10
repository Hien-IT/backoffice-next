# Contract: Khởi động và log của feature 003

Bổ sung cho `specs/001-platform-foundation/contracts/startup.md` và `observability.md`. Message giữ nguyên tiếng Anh như
Directus; message không có ở Directus đánh dấu `[mới]`.

## 1. Bước khởi động mới

| # | Bước | Khi | Mức log | Message | Mã thoát |
|---|------|-----|---------|---------|----------|
| 16b | Đăng ký provider (`registerAuthProviders`) | `AUTH_PROVIDERS` có tên `default` | error | `Cannot override "default" auth provider.` | 1 |
| 16b | | Provider thiếu `AUTH_<P>_DRIVER` | warn | `Missing driver definition for "<name>" auth provider.` | — |
| 16b | | Driver không phải `local`, `openid`, `oauth2`, `ldap`, `saml` | warn | `Invalid "<driver>" auth driver.` | — |
| 16b `[mới]` | | Driver `saml` | warn | `Auth provider "<name>" uses the "saml" driver, which is not supported by Backoffice; the provider is ignored.` | — |
| 16b | | OpenID, OAuth2, LDAP thiếu biến bắt buộc | error | `Invalid provider config` (lỗi `INVALID_PROVIDER_CONFIG` không bắt, process thoát như Directus) | 1 |
| 16b | | `ROLE_MAPPING` là mảng (OpenID, OAuth2) | error | `[OpenID] Expected a JSON-Object as role mapping, got an Array instead. Make sure you declare the variable with 'json:' prefix.` (OAuth2 cùng câu với `[OAuth2]`) | 1 |
| 16c | Tải metadata OpenID (không chặn, sau khi tạo provider) | Discovery lỗi | error | `[OpenID] Failed to fetch provider config` | — |
| 16c | | Discovery lỗi và `ISSUER_DISCOVERY_MUST_SUCCEED` khác `false` | error | `AUTH_<P>_ISSUER_DISCOVERY_MUST_SUCCEED is enabled and discovery failed, exiting` | 1 |

Dòng 16c chạy song song với các bước sau, như Directus: process có thể đã lắng nghe rồi mới thoát. Bước 16b chỉ đọc
cấu hình và gọi mạng tới IdP, không ghi DB (Nguyên tắc VII).

Dòng 5 (cảnh báo một instance): xem [config.md](./config.md) §3.

## 2. Log khi chạy

| Khi | Mức | Message |
|-----|-----|---------|
| `getAuthProvider` không thấy provider (refresh, logout, kiểm mật khẩu) | error | `Auth provider not configured` |
| `/auth/login` cho provider không có router (Directus: `Couldn't create login router for auth provider "<name>"`) | warn | Không xảy ra ở app mới: provider `saml` không được đăng ký, nên không có router để thiếu |
| `password/request` gặp lỗi khác `INVALID_PAYLOAD` (user không có, không `active`, SSO) | warn | `[email] <lỗi>` (kèm object lỗi), như controller Directus |
| `password/request` cho user hợp lệ `[mới]` | warn | `[email] Password reset email to "<email>" was not sent: Backoffice does not send email.` Không có token, không có link (FR-062) |
| Lỗi của driver | warn | Như Directus: `[OpenID] ...`, `[OAuth2] ...`, `[LDAP] ...` (ví dụ `[OpenID] Invalid grant`, `[OAuth2] Couldn't verify OAuth2 cookie`, `[LDAP] Failed to find bind user record`) |
| Nhận token ở route của 001 (D-10, tới 004) | warn lần đầu, debug các lần sau | Giữ nguyên `Request carried credentials, ...` của 001 |

Mọi log HTTP vẫn che `authorization`, `cookie`, `set-cookie`, `access_token` như 001.
