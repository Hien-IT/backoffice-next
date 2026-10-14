# Contract: API Directus mà app web gọi (FR-002)

Danh sách đóng. E2E ghi lại mọi request và thất bại nếu có path ngoài bảng (helper `assertOnlyKnownRequests`).
Mọi request gửi `credentials: 'include'`; không `Authorization`. Base: `apiUrl` từ `config.json`.

| # | Method | Path | Khi nào | Body / query | Ghi chú |
|---|--------|------|---------|--------------|---------|
| 1 | GET | `/server/info` | khởi động, sau login | — | `project`, `setupCompleted`, `websocket` |
| 2 | GET | `/auth?sessionOnly` | khởi động | — | providers, `disableDefault` |
| 3 | POST | `/auth/login` | login local | `{ email, password, otp?, mode: 'session' }` | |
| 4 | POST | `/auth/login/:provider` | login local2 / ldap | `{ email \| identifier, password, otp?, mode: 'session' }` | |
| 5 | GET (navigation) | `/auth/login/:provider?redirect=<origin>/admin/login?continue` | nút SSO | — | trình duyệt rời app |
| 6 | POST | `/auth/refresh` | lần tải đầu, sau login, sắp hết hạn, tab hoạt động lại | `{ mode: 'session' }` | SDK |
| 7 | POST | `/auth/logout` | người dùng đăng xuất | `{ mode: 'session' }` | không gọi khi SESSION_EXPIRED |
| 8 | POST | `/auth/password/request` | quên mật khẩu | `{ email }` | |
| 9 | POST | `/auth/password/reset` | đặt lại | `{ token, password }` | |
| 10 | POST | `/users/invite/accept` | nhận lời mời | `{ token, password }` | |
| 11 | POST | `/server/setup` | `/setup` | như `setup.vue` Directus | |
| 12 | GET | `/users/me?fields=*,role.id` | hydrate | — | |
| 13 | GET | `/users/me?fields=id` | refresh khi token còn hạn | — | |
| 14 | PATCH | `/users/me` | `trackPage`, hồ sơ | `{ last_page }` / field đã đổi | |
| 15 | POST | `/users/me/tfa/generate` | `/tfa-setup` | `{ password }` | `secret`, `otpauth_url` |
| 16 | POST | `/users/me/tfa/enable` | `/tfa-setup` | `{ otp, secret }` | |
| 17 | GET | `/policies/me/globals` | hydrate | — | `app_access`, `admin_access`, `enforce_tfa` |
| 18 | GET | `/roles/me?fields=id` | hydrate | — | |
| 19 | GET | `/permissions/me` | hydrate | — | |
| 20 | GET | `/settings` | hydrate (không cho share) | — | |
| 21 | GET | `/collections` | hydrate | — | giữ cho 013+ |
| 22 | GET | `/fields` | hydrate | — | |
| 23 | GET | `/relations` | hydrate | — | |
| 24 | GET | `/presets` | hydrate | như `stores/presets.ts` | |
| 25 | GET | `/translations` | `setLanguage` | `filter[language][_eq]=<lang>&limit=-1&fields=key,value` | |
| 26 | GET | `/notifications` | hydrate | `filter={"_and":[{"recipient":{"_eq":<id user>}},{"status":{"_eq":"inbox"}}]}&aggregate[count]=id` | như `stores/notifications.ts` (`refreshUnreadCount`, bỏ qua khi `currentUser` không có `id`) |
| 27 | GET | `/assets/:id` | logo, favicon, nền, avatar | `?key=system-medium-cover` cho avatar như `module-bar-avatar.vue` | ảnh, không fetch JSON |
| 28 | GET | `/shares/info/:id` | `/shared/:id` | — | |
| 29 | POST | `/shares/auth` | share login | `{ share, password?, mode: 'session' }` | |
| 30 | POST | `/files` | avatar hồ sơ | multipart | |
| 31 | POST | `/utils/resolve-redirect` | `/tfa-setup` có `?redirect=` | `{ redirect, provider? }` | như `useSafeRedirect`; chỉ đọc |

Không gọi: `/websocket`, `/extensions/*`, `/mcp`, `/ai`, `/deployments`, `/graphql` (ở 012), `/items/*` (ở 012).

## Lỗi

Mọi lỗi API `{ errors: [{ message, extensions: { code, ... } }] }` → `translateAPIError(code)` = `$t('errors.' +
code)` nếu có khóa, không thì `message`. `401` ở request ngoài `/auth/*` → `logout(SESSION_EXPIRED)`. Lỗi mạng ở
khởi động → màn lỗi FR-003.
