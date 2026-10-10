# Feature Specification: Xác thực và phiên đăng nhập

**Feature Branch**: `003-auth-session`
**Created**: 2026-10-10
**Status**: Draft
**Input**: User description: "Người dùng đăng nhập vào app mới bằng email và mật khẩu đã có trong directus_users, nhận access token và refresh token giống hệt Directus (cùng SECRET, cùng payload JWT, cùng TTL ACCESS_TOKEN_TTL và REFRESH_TOKEN_TTL). Hỗ trợ ba chế độ json, cookie, session như Directus, với cùng tên cookie. Session lưu trong directus_sessions. Token cấp ở Directus dùng được ở app mới và ngược lại. Hỗ trợ: /auth/login, /auth/refresh, /auth/logout, /auth/password/request, /auth/password/reset, static token của user, xác thực hai lớp (TFA, /users/me/tfa/*), kiểm tra trạng thái user (active, suspended, invited), giới hạn đăng nhập sai (LOGIN_STALL_TIME, rate limiter dùng chung Redis). Đăng nhập SSO chỉ hỗ trợ OpenID Connect (Azure AD/Entra ID, Keycloak...) theo các biến AUTH_* giống Directus. Provider cấu hình driver ldap, oauth2 hoặc saml thì bị bỏ qua và ghi cảnh báo khi khởi động. /auth/password/request trả về giống Directus nhưng không gửi email, chỉ ghi log. Tham chiếu directus/api/src/auth, services/authentication.ts, controllers/auth.ts. Tiêu chí chấp nhận: bộ test blackbox auth của Directus chạy qua trên app mới, và token dùng chéo được giữa hai bên."

**Tham chiếu Directus** (chỉ đọc):

- Route: `directus/api/src/controllers/auth.ts` (`/auth/refresh`, `/auth/logout`, `/auth/password/*`, `GET /auth`),
  `directus/api/src/controllers/users.ts` (`/users/me/tfa/generate`, `/users/me/tfa/enable`, `/users/me/tfa/disable`,
  `/users/:pk/tfa/disable`).
- Đăng nhập: `directus/api/src/services/authentication.ts` (`login`, `refresh`, `updateStatefulSession`, `logout`,
  `verifyPassword`), `directus/api/src/auth.ts` (`registerAuthProviders`, `getAuthProvider`),
  `directus/api/src/auth/auth.ts`, `auth/drivers/local.ts`, `auth/drivers/openid.ts`, `auth/drivers/oauth2.ts`,
  `auth/drivers/ldap.ts`,
  `auth/utils/generate-callback-url.ts`, `auth/utils/resolve-login-redirect.ts`.
- Xác thực request: `directus/api/src/middleware/extract-token.ts`, `middleware/authenticate.ts`,
  `utils/get-accountability-for-token.ts`, `utils/jwt.ts`, `utils/verify-session-jwt.ts`, `utils/is-directus-jwt.ts`,
  `utils/get-secret.ts`, `permissions/lib/fetch-roles-tree.ts`, `permissions/modules/fetch-global-access`.
- TFA: `directus/api/src/services/tfa.ts`.
- Quên mật khẩu: `directus/api/src/services/users.ts` (`requestPasswordReset`, `resetPassword`, `checkPasswordPolicy`,
  `clearUserSessions`).
- Giới hạn đăng nhập sai: `directus/api/src/rate-limiter.ts`, `utils/stall.ts`, setting `auth_login_attempts`.
- Danh sách provider: `directus/api/src/utils/get-auth-providers.ts`.
- Biến môi trường: `directus/packages/env/src/constants/defaults.ts`, `directus-variables.ts`.
- Hằng số cookie: `directus/api/src/constants.ts` (`REFRESH_COOKIE_OPTIONS`, `SESSION_COOKIE_OPTIONS`,
  `DEFAULT_AUTH_PROVIDER`).

**Đã có từ feature 001 và 002**: `apps/api/src/middleware/extract-token.ts` (port đủ: query `access_token`, header
Bearer, session cookie, lỗi khi dùng hai cách); middleware `public-accountability.ts` đứng ở vị trí `authenticate` của
Directus, coi mọi request là public và cảnh báo một lần mỗi process khi request mang token (D-10, D-18 của spec 001);
`createDefaultAccountability`, `fetchPolicies`, `fetchPermissions`, `filterPoliciesByIp`, permissions cache (002),
`get-auth-providers.ts`, `get-ip-from-req`, `get-milliseconds`, `createRateLimiter` (store `memory` và `redis`), lỗi
`INVALID_CREDENTIALS`, `INVALID_OTP`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `USER_SUSPENDED`, `INVALID_PROVIDER(_CONFIG)`
trong `libs/errors`. Route `/auth` đang trả `404` (D-09.1). Các biến `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_*`,
`SESSION_COOKIE_*` (trừ `SESSION_COOKIE_NAME`), `LOGIN_STALL_TIME`, `PASSWORD_RESET_URL_ALLOW_LIST`, `AUTH_*` đang ở
nhóm "chưa hỗ trợ" và được cảnh báo khi khởi động. Feature này thêm bước xác thực thật cho route của chính nó và gỡ
D-09.1. D-10 và cảnh báo "token bị bỏ qua" của D-18 giữ nguyên tới feature 004.

**Bộ test blackbox auth của Directus** (`directus/tests/blackbox`): `tests/common/auth/login.test.ts`,
`tests/common/auth/refresh.test.ts`, `tests/common/auth/oauth-redirect.test.ts`, `oauth-multi-domain.test.ts`,
`tests/common/logger/redact.test.ts` (che cookie trong log), `ldap.test.ts` (cần container OpenLDAP). Phần GraphQL
và WebSocket của các file này (feature 011, Nguyên tắc XI) và `saml.test.ts` (Nguyên tắc XI) nằm ngoài phạm vi. Không
có test blackbox nào cho logout, quên mật khẩu, TFA, trạng thái user, `LOGIN_STALL_TIME`, giới hạn đăng nhập sai hay
OpenID; feature này tự viết test đối chiếu cho các luồng đó (FR-102).

## Clarifications

### Session 2026-10-10

- Q: Bật, tắt TFA (`/users/me/tfa/enable`, `/users/me/tfa/disable`, `/users/:pk/tfa/disable`) ghi qua
  `ItemsService.updateOne` theo quyền của user, cần lõi kiểm quyền và truy vấn của 004, 005. 003 làm tới đâu?
  → A: 003 chỉ làm `/users/me/tfa/generate` và đăng nhập bằng OTP; ba route bật, tắt dời sang feature 005, tới lúc đó
  trả `404` như các route `/users` khác (FR-051, D-09.10).
- Q: Dòng log thay cho email đặt lại mật khẩu có chứa link (kèm token) không? → A: Không. Chỉ ghi email người nhận và
  lý do không gửi (FR-062).
- Q: Refresh session của user LDAP, OAuth2 ở app mới xử lý thế nào? → A: App mới dùng chung `.env` với Directus, nên
  Directus có provider OAuth2, LDAP thì app mới cũng hỗ trợ đầy đủ như Directus (đăng nhập, callback, refresh). SAML vẫn
  bỏ qua. Làm luôn trong feature 003. Constitution sửa thành 1.3.0: Nguyên tắc XI chỉ còn SAML ngoài phạm vi (FR-070,
  FR-076, FR-077, D-24).
- Q: Benchmark auth dùng dữ liệu và tải cỡ nào, có chặn CI không? → A: Dữ liệu quy mô thiết kế (2.000 user, mỗi user có
  session), tải 2.000 kết nối đồng thời, đo `POST /auth/login`, `POST /auth/refresh` và một request mang token; chặn CI
  (SC-007).
- Q: D-10 (route `/server/*`, `/metrics` bỏ qua token) gỡ ở 003 tới mức nào? → A: Giữ D-10 tới feature 004 như đã
  hẹn; 003 chỉ xác thực token ở route của chính nó (US3, FR-030 đến FR-033).
- Q (khi lập plan): Session của user SAML (đăng nhập ở Directus) refresh hoặc logout ở app mới thì sao? → A: Làm đúng
  chữ Nguyên tắc XI: như Directus khi tắt SAML, trả `503 INVALID_PROVIDER_CONFIG`; app mới không đăng ký provider
  `saml` (FR-023, FR-078, D-24).

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là người dùng cuối và client đang gọi Directus (đăng nhập, giữ phiên, gọi API bằng
token), quản trị viên (cấu hình SSO) và đội vận hành (chạy Directus và app mới song song
sau một load balancer, cùng DB, Redis và file `.env`).

### User Story 1 - Đăng nhập bằng email và mật khẩu, token dùng chéo hai bên (Priority: P1)

Người dùng có tài khoản trong `directus_users` gửi email và mật khẩu tới `POST /auth/login` của app mới, chọn một
trong ba chế độ `json`, `cookie`, `session`. App mới trả access token, refresh token (hoặc cookie) và `expires` giống
hệt Directus. Token này dùng được ở mọi instance Directus và app mới. Token do Directus cấp cũng dùng được ở app mới.

**Why this priority**: Đây là tiêu chí chấp nhận chính của feature và là điều kiện chạy song song (Nguyên tắc IV).
Request của một người dùng có thể đi vào bất kỳ instance nào; nếu một bên không nhận token của bên kia, người dùng
bị đăng xuất ngẫu nhiên.

**Independent Test**: Chạy Directus và app mới trên cùng DB, Redis và `SECRET`. Đăng nhập ở app mới bằng một user
có sẵn với mỗi chế độ. So response với cùng request gửi tới Directus (status, body, header `Set-Cookie`, dòng mới
trong `directus_sessions`, `directus_activity`, cột `last_access`). Dùng access token vừa nhận để gọi một endpoint cần
đăng nhập ở Directus: request được nhận là của user đó. Làm ngược lại với token do Directus cấp.

**Acceptance Scenarios**:

1. **Given** user `active` có email `admin@example.com` và mật khẩu đúng, **When** gọi `POST /auth/login` với
   `mode: "json"` (hoặc không có `mode`), **Then** trả `200` với `data.access_token`, `data.refresh_token`,
   `data.expires` (số mili giây của `ACCESS_TOKEN_TTL`), giống Directus.
2. **Given** cùng user, **When** đăng nhập với `mode: "cookie"`, **Then** body có `access_token` và `expires`, không
   có `refresh_token`; refresh token nằm trong cookie `REFRESH_TOKEN_COOKIE_NAME` (mặc định
   `directus_refresh_token`) với cùng thuộc tính `HttpOnly`, `Domain`, `Max-Age`, `Secure`, `SameSite` như Directus.
3. **Given** cùng user, **When** đăng nhập với `mode: "session"`, **Then** body chỉ có `expires` (số mili giây của
   `SESSION_COOKIE_TTL`); access token nằm trong cookie `SESSION_COOKIE_NAME` (mặc định `directus_session_token`) và
   có claim `session` trỏ tới dòng mới trong `directus_sessions`.
4. **Given** access token do app mới cấp, **When** giải mã, **Then** payload có đúng các claim của Directus (`id`,
   `role`, `app_access`, `admin_access`, `enforce_tfa` khi cần, `session` ở chế độ session, `iat`, `exp`,
   `iss: "directus"`), ký bằng `SECRET` cùng thuật toán, và `exp - iat` bằng TTL tương ứng.
5. **Given** access token, refresh token hoặc session cookie do Directus cấp, **When** dùng ở app mới, **Then** app
   mới nhận như token của chính nó; và ngược lại.
6. **Given** email viết hoa khác với dữ liệu (`Admin@Example.com`), **When** đăng nhập, **Then** thành công, vì email
   so sánh không phân biệt hoa thường giống Directus.
7. **Given** sai mật khẩu, email không tồn tại, thiếu `email` hoặc `password`, `email` sai định dạng, hoặc `mode` lạ,
   **When** đăng nhập, **Then** trả cùng status và mã lỗi như Directus (`401 INVALID_CREDENTIALS` hoặc
   `400 INVALID_PAYLOAD`) và cùng message.

---

### User Story 2 - Làm mới và kết thúc phiên ở bất kỳ instance nào (Priority: P1)

Client giữ phiên bằng `POST /auth/refresh` và kết thúc bằng `POST /auth/logout`, với refresh token trong body hoặc
trong cookie. Phiên tạo ở Directus refresh hoặc logout được ở app mới, và ngược lại. Logout ở một bên làm refresh
token đó hết hiệu lực ở cả hai bên.

**Why this priority**: Access token mặc định sống 15 phút. Nếu refresh chỉ chạy ở một bên, sau 15 phút người dùng bị
đăng xuất khi request refresh rơi vào instance kia.

**Independent Test**: Đăng nhập ở Directus ở mỗi chế độ. Gọi `POST /auth/refresh` ở app mới: nhận token mới, dòng
trong `directus_sessions` đổi giống khi Directus refresh. Gọi `POST /auth/logout` ở Directus với refresh token mới:
refresh ở app mới với token đó trả `401 INVALID_CREDENTIALS`. Lặp lại với vai trò hai bên đổi chỗ.

**Acceptance Scenarios**:

1. **Given** refresh token hợp lệ trong body (`mode` là `json` hoặc không có `mode` nhưng có `refresh_token`),
   **When** gọi `POST /auth/refresh`, **Then** trả access token mới, refresh token mới và `expires`; dòng session cũ
   được đổi token và hạn theo `REFRESH_TOKEN_TTL`, giống Directus.
2. **Given** refresh token trong cookie và không có `mode` (mặc định `cookie`), **When** refresh, **Then** cookie
   refresh mới được đặt và body có `access_token`, `expires`.
3. **Given** session cookie (chế độ `session`), **When** refresh, **Then** app mới làm giống Directus: dòng session cũ
   giữ thêm `SESSION_REFRESH_GRACE_PERIOD` (mặc định 10 giây) và trỏ `next_token` sang dòng mới; hai request refresh
   đồng thời với cùng session cũ (tới cùng một bên hoặc mỗi bên một request) nhận cùng session mới.
4. **Given** không có refresh token trong body lẫn cookie, **When** refresh hoặc logout, **Then** trả
   `400 INVALID_PAYLOAD` với cùng `reason` như Directus.
5. **Given** refresh token đã hết hạn, không tồn tại, hoặc đã logout, **When** refresh, **Then** trả
   `401 INVALID_CREDENTIALS`.
6. **Given** user của session không còn `active`, **When** refresh, **Then** dòng session bị xóa; trả
   `401 USER_SUSPENDED` nếu user `suspended`, `401 INVALID_CREDENTIALS` nếu trạng thái khác, giống Directus.
7. **Given** phiên hợp lệ, **When** gọi `POST /auth/logout`, **Then** dòng session bị xóa, ghi activity `logout`,
   cookie refresh và session (nếu request có gửi) bị xóa, response giống Directus.
8. **Given** session của share (`directus_shares`) do Directus tạo, **When** refresh ở app mới, **Then** token mới
   có claim `share`, `role: null`, không có `id`, và share hết hạn hoặc chưa tới `date_start` thì bị từ chối, giống
   Directus.

---

### User Story 3 - Route của feature này xác thực token như Directus (Priority: P1)

Mọi route của feature này (`/auth/*` và `POST /users/me/tfa/generate`, route duy nhất cần đăng nhập) nhận token theo
đúng cách của Directus: header
`Authorization: Bearer <token>`, query `access_token`, session cookie, và static token của user
(`directus_users.token`). Request có token hợp lệ chạy với quyền của user đó (user, role, cây role, `admin`, `app`);
request không có token chạy với quyền public. Các route đã có từ feature 001 (`/server/*`, `/metrics`, path lạ) vẫn
bỏ qua token như D-10 tới feature 004 (Clarifications).

**Why this priority**: Đây là bằng chứng phía app mới rằng access token, session cookie và static token do Directus cấp
được nhận đúng. Feature 004 mở rộng bước này ra mọi route và dựa vào accountability tính ở đây.

**Independent Test**: Gọi `POST /users/me/tfa/generate` của app mới và của Directus với từng loại token, với token hết
hạn, token sai chữ ký, token của bên kia và static token. So status, body và header. Gọi `/server/info` của app mới
với token: kết quả vẫn như request public (D-10).

**Acceptance Scenarios**:

1. **Given** access token hợp lệ trong header `Authorization: Bearer`, **When** gọi `POST /users/me/tfa/generate`,
   **Then** request chạy với accountability của user đó, giống Directus (secret sinh cho đúng user; thiếu `password`
   thì `400 INVALID_PAYLOAD` như Directus).
2. **Given** token trong query `access_token`, hoặc trong session cookie, **When** gọi route đó, **Then** kết quả giống
   khi dùng header.
3. **Given** token vừa trong header vừa trong query, **When** gọi bất kỳ route nào, **Then** trả `400 INVALID_PAYLOAD`
   với cùng `reason` như Directus (đã có từ feature 001). Session cookie không tính vào quy tắc này: có header hoặc query
   thì dùng chúng, bỏ qua cookie.
4. **Given** chuỗi không phải JWT của Directus (không có `iss: "directus"`), **When** dùng làm token, **Then** app
   mới coi là static token và tìm user `active` có `token` bằng chuỗi đó; không có thì trả
   `401 INVALID_CREDENTIALS`.
5. **Given** JWT hết hạn, **When** dùng, **Then** trả `401 TOKEN_EXPIRED`. **Given** JWT sai chữ ký hoặc thiếu claim
   `role`, `app_access`, `admin_access`, **When** dùng, **Then** trả `403 INVALID_TOKEN`. Message giống Directus.
6. **Given** session token mà dòng session đã bị xóa hoặc hết hạn, **When** dùng, **Then** trả
   `401 INVALID_CREDENTIALS`, và nếu token đến từ session cookie thì cookie bị xóa trong response, giống Directus.
7. **Given** access token của user đã bị chuyển sang `suspended` sau khi token được cấp, **When** dùng token đó trước
   khi hết hạn, **Then** app mới xử lý giống Directus (JWT không kiểm lại trạng thái user; chỉ static token và
   refresh kiểm trạng thái).
8. **Given** token bất kỳ (đúng hoặc sai), **When** gọi `/server/info`, `/server/health`, `/server/specs/oas`,
   `/metrics` hoặc path lạ của app mới, **Then** app mới vẫn trả như request public và ghi cảnh báo "token bị bỏ qua"
   một lần mỗi process, như D-10 và D-18 của feature 001, tới feature 004.

---

### User Story 4 - Chống dò mật khẩu và kiểm trạng thái user (Priority: P2)

Chỉ user `active` đăng nhập được. Mọi lần đăng nhập thất bại mất ít nhất `LOGIN_STALL_TIME` mili giây để kẻ tấn công
không phân biệt được email có tồn tại hay không. Sau số lần sai theo setting `auth_login_attempts`, user bị chuyển
sang `suspended`. Bộ đếm số lần sai dùng chung giữa Directus và app mới khi rate limiter dùng Redis.

**Why this priority**: Bảo mật. Nếu hai app đếm riêng, kẻ tấn công có gấp đôi số lần thử bằng cách đánh vào cả hai.

**Independent Test**: Với `RATE_LIMITER_STORE=redis`, `auth_login_attempts=3`, gửi lần lượt mật khẩu sai xen kẽ tới
Directus và app mới. User bị `suspended` đúng ở lần thử giống khi chỉ có Directus. Đo thời gian response của lần
đăng nhập sai với email có và không có trong DB.

**Acceptance Scenarios**:

1. **Given** user ở trạng thái `invited`, `draft`, `suspended` hoặc `archived` với mật khẩu đúng, **When** đăng nhập,
   **Then** trả `401 INVALID_CREDENTIALS`, giống Directus.
2. **Given** user có `provider` khác `default` (ví dụ tạo bằng SSO), **When** đăng nhập bằng email và mật khẩu ở
   `/auth/login`, **Then** trả `401 INVALID_CREDENTIALS`.
3. **Given** `LOGIN_STALL_TIME=500`, **When** đăng nhập thất bại vì bất kỳ lý do nào (email không có, mật khẩu sai,
   payload sai, user không active, OTP sai), **Then** response trả về sau ít nhất 500 mili giây tính từ lúc nhận
   request. Đăng nhập thành công cũng chờ như vậy, giống Directus.
4. **Given** setting `auth_login_attempts` là `N` và rate limiter dùng chung Redis, **When** tổng số lần đăng nhập sai
   ở cả hai app vượt `N`, **Then** user bị chuyển `suspended`, có activity `update` và revision ghi `status:
   suspended`, giống Directus; bộ đếm reset về 0 sau lần đăng nhập thành công hoặc khi user bị khóa.
5. **Given** `auth_login_attempts` là `null`, **When** đăng nhập sai nhiều lần, **Then** không khóa user.
6. **Given** `auth_login_attempts` khác `null` và rate limiter không truy cập được (Redis lỗi), **When** đăng nhập, **Then** trả
   `503 SERVICE_UNAVAILABLE` với cùng `reason` như Directus.

---

### User Story 5 - Xác thực hai lớp (TFA) (Priority: P2)

Người dùng đã bật TFA đăng nhập ở app mới bằng mật khẩu và mã OTP. Người dùng sinh secret TFA ở app mới
(`/users/me/tfa/generate`). TFA bật ở Directus dùng được ở app mới và ngược lại, vì cùng lưu
`directus_users.tfa_secret`. Các route bật và tắt TFA (`/users/me/tfa/enable`, `/users/me/tfa/disable`,
`/users/:pk/tfa/disable`) làm ở feature 005 (Clarifications); tới lúc đó người dùng bật, tắt TFA qua Directus.

**Why this priority**: Nhiều tài khoản quản trị bắt buộc TFA (`enforce_tfa` trong policy). Không hỗ trợ đăng nhập bằng
OTP thì các tài khoản này không đăng nhập được qua app mới.

**Independent Test**: Sinh secret ở app mới, bật TFA ở Directus bằng secret đó, đăng nhập ở app mới bằng OTP sinh từ
secret. Tắt TFA ở Directus rồi đăng nhập lại ở app mới không cần OTP. Kiểm user thuộc policy `enforce_tfa` chưa bật
TFA nhận claim `enforce_tfa: true`.

**Acceptance Scenarios**:

1. **Given** user provider `default` chưa bật TFA, **When** gọi `POST /users/me/tfa/generate` với mật khẩu đúng,
   **Then** trả `secret` và `otpauth_url` có định dạng như Directus; DB không đổi.
2. **Given** `secret` do app mới sinh, **When** bật TFA ở Directus bằng `secret` đó và OTP đúng, **Then** Directus
   nhận, và đăng nhập ở app mới bằng OTP sinh từ `secret` đó thành công.
3. **Given** user đã bật TFA, **When** đăng nhập không có `otp`, **Then** trả `401 INVALID_OTP`; với `otp` sai cũng
   `401 INVALID_OTP`; với `otp` đúng thì thành công.
4. **Given** request không đăng nhập, thiếu `password`, sai mật khẩu, TFA đã bật, user `default` không có email, hoặc
   user SSO gọi generate (không cần `password`), **When** gọi `POST /users/me/tfa/generate`, **Then** cho cùng kết
   quả (status, mã lỗi, message) như Directus.
5. **Given** user chưa bật TFA và thuộc ít nhất một policy có `enforce_tfa: true` (qua role), **When** đăng nhập,
   **Then** access token có `enforce_tfa: true`, giống Directus.
6. **Given** feature 005 chưa xong, **When** gọi `POST /users/me/tfa/enable`, `POST /users/me/tfa/disable` hoặc
   `POST /users/:pk/tfa/disable` ở app mới, **Then** trả `404 ROUTE_NOT_FOUND` như các route `/users` chưa làm (D-09.10).

---

### User Story 6 - Quên và đặt lại mật khẩu (Priority: P3)

Người dùng gửi email tới `POST /auth/password/request`. App mới trả về giống Directus nhưng không gửi email, chỉ ghi
log. Người dùng (hoặc admin) có token đặt lại mật khẩu gọi `POST /auth/password/reset` để đổi mật khẩu.

**Why this priority**: Luồng này cần cho app web (feature 012), nhưng hệ thống không gửi email (Nguyên tắc X), nên
giá trị chính là trả về đúng như Directus và đặt lại được mật khẩu bằng token hợp lệ.

**Independent Test**: Gọi `POST /auth/password/request` với email có, email không có, user không active, user SSO,
`reset_url` ngoài `PASSWORD_RESET_URL_ALLOW_LIST`: so status, body, thời gian trả về với Directus; kiểm tra có log và
không có email nào được gửi. Gọi `POST /auth/password/reset` với token do Directus sinh (hoặc ký bằng `SECRET` theo
cùng định dạng): mật khẩu đổi, mọi session của user bị xóa, đăng nhập được bằng mật khẩu mới ở cả hai app.

**Acceptance Scenarios**:

1. **Given** email của user `active`, provider `default`, **When** gọi `POST /auth/password/request`, **Then** trả như
   Directus (không body), sau ít nhất 500 mili giây, không gửi email, ghi một dòng log `warn` (FR-062).
2. **Given** email không có, user không `active`, hoặc user SSO, **When** request, **Then** trả như Directus (Directus
   bắt lỗi `FORBIDDEN` ở controller, ghi log và trả thành công), sau ít nhất 500 mili giây.
3. **Given** thiếu `email` hoặc `email` không phải chuỗi, hoặc `reset_url` không nằm trong
   `PASSWORD_RESET_URL_ALLOW_LIST`, **When** request, **Then** trả `400 INVALID_PAYLOAD` với cùng `reason`.
4. **Given** token đặt lại hợp lệ (scope `password-reset`, ký bằng `SECRET`, chưa hết hạn 1 ngày, hash khớp mật khẩu
   hiện tại), **When** gọi `POST /auth/password/reset` với mật khẩu mới thỏa `auth_password_policy`, **Then** mật khẩu
   được lưu dạng argon2, user thành `active`, mọi session của user bị xóa, có activity và revision giống Directus.
5. **Given** token đã dùng (mật khẩu đã đổi nên hash không khớp), sai scope, hết hạn, sai chữ ký, hoặc user không
   `active`, **When** reset, **Then** trả cùng lỗi như Directus (`403 FORBIDDEN`, `401 TOKEN_EXPIRED`,
   `403 INVALID_TOKEN`).
6. **Given** mật khẩu mới không thỏa `auth_password_policy`, **When** reset, **Then** trả
   `400 FAILED_VALIDATION` với cùng `extensions` như Directus, và mật khẩu không đổi.

---

### User Story 7 - Đăng nhập SSO bằng OpenID Connect, OAuth2 và LDAP (Priority: P3)

Đội vận hành cấu hình provider OpenID Connect (Azure AD/Entra ID, Keycloak...), OAuth2 (GitHub, Google...) hoặc LDAP
(Active Directory, OpenLDAP) bằng đúng các biến `AUTH_*` đang dùng cho Directus. Với OpenID và OAuth2, người dùng đăng
nhập qua `/auth/login/<provider>` ở app mới, được chuyển tới IdP, quay về `/auth/login/<provider>/callback`, và nhận
phiên giống Directus. Với LDAP, người dùng gửi `identifier` và mật khẩu tới `POST /auth/login/<provider>`. Provider cấu
hình driver `saml` bị bỏ qua, có cảnh báo khi khởi động.

**Why this priority**: SSO cần cho người dùng doanh nghiệp. App mới dùng chung `.env` với Directus, nên provider nào
Directus đang chạy (trừ SAML) thì app mới cũng phải chạy, nếu không người dùng SSO bị đăng xuất khi request rơi vào app
mới (Clarifications).

**Independent Test**: Chạy một IdP OpenID Connect thử nghiệm và một server OpenLDAP thử nghiệm (container cục bộ, như bộ
blackbox của Directus dùng cho LDAP), cấu hình cùng `AUTH_*` cho cả hai app. Đi hết luồng SSO của mỗi driver ở app mới:
user mới được tạo hoặc user cũ được cập nhật giống Directus; phiên nhận được refresh và dùng được ở Directus, và ngược
lại. Đặt thêm một provider `saml`: app mới khởi động, ghi cảnh báo, và `GET /auth` không liệt kê provider đó.

**Acceptance Scenarios**:

1. **Given** `AUTH_PROVIDERS=keycloak`, `AUTH_KEYCLOAK_DRIVER=openid` và các biến bắt buộc (`CLIENT_ID`,
   `CLIENT_SECRET` hoặc `CLIENT_PRIVATE_KEYS` với `private_key_jwt`, `ISSUER_URL`), **When** gọi
   `GET /auth/login/keycloak?redirect=<url>`, **Then** app mới đặt cookie `openid.keycloak` và chuyển hướng tới IdP
   với cùng tham số (PKCE, `state`, `nonce`, `scope`, `prompt`, `redirect_uri`) như Directus.
2. **Given** `AUTH_GITHUB_DRIVER=oauth2` với `CLIENT_ID`, `CLIENT_SECRET`, `AUTHORIZE_URL`, `ACCESS_URL`, `PROFILE_URL`,
   **When** gọi `GET /auth/login/github?redirect=<url>`, **Then** app mới đặt cookie `oauth2.github` và chuyển hướng tới
   `AUTHORIZE_URL` với cùng tham số như Directus (`scope` mặc định `email`, `redirect_uri` tính theo `PUBLIC_URL` và
   `AUTH_ALLOWED_PUBLIC_URLS`).
3. **Given** IdP trả về callback hợp lệ, **When** `GET` (hoặc `POST`, chuyển thành `GET` với `303`)
   `/auth/login/<provider>/callback`, **Then** user được tìm theo `external_identifier` (không phân biệt hoa thường),
   được tạo hoặc cập nhật (`auth_data`, role theo `ROLE_MAPPING`, thông tin theo `SYNC_USER_INFO`) giống Directus, và
   phiên được trả theo `AUTH_<PROVIDER>_MODE` (mặc định `session`): cookie rồi chuyển hướng tới `redirect`, hoặc JSON
   khi không có `redirect`.
4. **Given** `AUTH_LDAP_DRIVER=ldap` với `CLIENT_URL`, `BIND_DN`, `BIND_PASSWORD`, `USER_DN`, **When** gọi
   `POST /auth/login/ldap` với `identifier` và `password` đúng (và `mode`, `otp` như đăng nhập thường), **Then** user
   được tìm theo DN trong `external_identifier`, được tạo hoặc cập nhật (role theo nhóm ở `GROUP_DN` khớp tên role, thông
   tin theo `SYNC_USER_INFO`) giống Directus, và response giống router LDAP của Directus (khác `/auth/login` ở chế độ
   `session`: body có cả `access_token`). Sai mật khẩu, không thấy user, hoặc tài
   khoản bị khóa trên LDAP (`userAccountControl`) trả `401 INVALID_CREDENTIALS`.
5. **Given** user chưa có và `ALLOW_PUBLIC_REGISTRATION` tắt, hoặc (OpenID) `REQUIRE_VERIFIED_EMAIL` bật mà email chưa
   xác minh, **When** callback, **Then** đăng nhập bị từ chối giống Directus (chuyển hướng tới `redirect` kèm `reason`,
   hoặc lỗi khi không có `redirect`).
6. **Given** `redirect` không hợp lệ (không khớp `PUBLIC_URL` hoặc `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST`, hoặc dạng
   `//host`), **When** bắt đầu SSO, **Then** trả `400 INVALID_PAYLOAD`.
7. **Given** user SSO có TFA hoặc policy `enforce_tfa`, **When** SSO thành công, **Then** xử lý OTP và chuyển hướng
   tới `/admin/tfa-setup` giống Directus.
8. **Given** phiên SSO đang có (tạo ở Directus hoặc app mới), **When** refresh ở app mới, **Then** app mới làm giống
   Directus: OpenID và OAuth2 làm mới refresh token với IdP khi `auth_data` có `refreshToken` (IdP trả `invalid_grant`
   thì `403 INVALID_TOKEN`); LDAP kiểm lại tài khoản trên LDAP (bị khóa thì `401 INVALID_CREDENTIALS`).
9. **Given** `AUTH_PROVIDERS` có provider driver `saml`, **When** app mới khởi động, **Then** mỗi provider đó có một
   dòng log `warn` nêu tên provider và driver, app vẫn chạy, provider không được đăng ký và không có route
   `/auth/login/<provider>`.
10. **Given** các provider đã cấu hình, **When** gọi `GET /auth` (kể cả `?sessionOnly`), **Then** trả danh sách
    provider (`name`, `label`, `driver`, `icon`) và `disableDefault` giống Directus, trừ provider `saml`.

---

### Edge Cases

- `SECRET` không đặt: Directus sinh secret ngẫu nhiên cho từng process, nên token không dùng chéo được giữa các
  instance. App mới làm giống vậy và giữ cảnh báo "`SECRET` ngẫu nhiên không dùng chéo với Directus" của feature 001
  (D-18).
- Hai bên lệch đồng hồ: `exp`, `iat` của JWT và `expires` của session so với giờ hệ thống của instance nhận request,
  giống Directus. Không thêm dung sai.
- Refresh đồng thời ở chế độ `json` hoặc `cookie` với cùng refresh token: request đến sau không tìm thấy token cũ và
  trả `401 INVALID_CREDENTIALS`, giống Directus. Chế độ `session` có grace period (US2.3).
- Session hết hạn được dọn: khi đăng nhập, mọi session hết hạn bị xóa; khi refresh, session hết hạn của cùng user (hoặc
  share) bị xóa, giống Directus.
- User bị xóa trong lúc còn session: refresh trả `401 INVALID_CREDENTIALS`.
- Đổi mật khẩu bằng reset ở một bên: mọi session của user bị xóa, refresh ở bên kia thất bại. Access token đã cấp vẫn
  dùng được tới khi hết hạn (trừ token chế độ `session`, vì dòng session đã bị xóa).
- Static token trùng nhau giữa hai user, hoặc user có static token nhưng không `active`: xử lý theo đúng truy vấn của
  Directus (lấy dòng đầu tiên của user `active`).
- `AUTH_DISABLE_DEFAULT=true`: không có route `/auth/login` cho provider `default`, `GET /auth` trả
  `disableDefault: true`.
- `AUTH_PROVIDERS` có tên `default`: Directus dừng process với log `error`; app mới làm giống vậy.
- Provider thiếu `DRIVER` hoặc driver lạ: log `warn` giống Directus, provider bị bỏ qua.
- Provider OpenID thiếu biến bắt buộc, hoặc `ROLE_MAPPING` là mảng: lỗi khi khởi động giống Directus.
  `ISSUER_DISCOVERY_MUST_SUCCEED` (mặc định bật) và IdP không truy cập được lúc khởi động: process thoát, giống
  Directus.
- User có session tạo ở Directus với provider SAML (bị bỏ qua ở app mới), refresh hoặc logout ở app mới: trả
  `503 INVALID_PROVIDER_CONFIG` như Directus khi provider không được cấu hình (FR-078). Cũng vậy với provider trong
  `directus_users.provider` không còn trong `AUTH_PROVIDERS` (ở cả hai app).
- Luồng SSO OpenID hoặc OAuth2 bắt đầu ở một bên rồi callback rơi vào bên kia (load balancer không dùng sticky
  session, Nguyên tắc VII): thành công như khi chạy trọn ở một bên, vì cookie `openid.<provider>`, `oauth2.<provider>`
  ký bằng `SECRET` chung và có cùng nội dung.
- LDAP hoặc IdP không truy cập được khi đăng nhập hoặc refresh: lỗi giống driver của Directus
  (`503 SERVICE_UNAVAILABLE` hoặc `401 INVALID_CREDENTIALS`).
- Request refresh hoặc logout với token trong cả body và cookie: chọn theo `mode` và quy tắc của Directus
  (`getCurrentMode`).
- Session cookie chứa chuỗi không phải JWT của Directus khi refresh ở chế độ `session`: coi như không có refresh token
  (`400 INVALID_PAYLOAD`), giống Directus.
- `User-Agent` dài hơn 1024 ký tự: cắt còn 1024 trước khi lưu, giống Directus.
- IP lưu trong session và activity lấy theo `IP_TRUST_PROXY`, `IP_CUSTOM_HEADER` giống Directus.

## Requirements *(mandatory)*

### Functional Requirements

**Đăng nhập bằng email và mật khẩu**

- **FR-001**: App mới PHẢI có `POST /auth/login` (provider `default`, trừ khi `AUTH_DISABLE_DEFAULT=true`) và
  `POST /auth/login/<provider>` cho mỗi provider driver `local` trong `AUTH_PROVIDERS`. Payload PHẢI được kiểm theo
  cùng quy tắc và cùng message như Directus: `email` là email hợp lệ và bắt buộc, `password` bắt buộc, `mode` thuộc
  `json`, `cookie`, `session` (mặc định `json`), `otp` là chuỗi, cho phép key lạ.
- **FR-002**: App mới PHẢI tìm user theo email không phân biệt hoa thường, chỉ cho đăng nhập khi `status` là `active`
  và `provider` trùng tên provider, và kiểm mật khẩu bằng hash argon2 trong `directus_users.password`. Mọi lý do thất
  bại về danh tính PHẢI trả cùng một lỗi `401 INVALID_CREDENTIALS` như Directus.
- **FR-003**: Thứ tự các bước PHẢI giống `AuthenticationService.login`: tìm user, kiểm trạng thái và provider, trừ
  lượt ở bộ đếm đăng nhập sai (FR-041), kiểm mật khẩu, kiểm OTP (FR-053), tính quyền, ký token, ghi DB. Nhờ đó mỗi tổ
  hợp đầu vào cho cùng response và cùng tác động lên bộ đếm, DB như Directus.
- **FR-004**: Response PHẢI theo `mode` giống Directus: `json` trả `access_token`, `refresh_token`, `expires`;
  `cookie` trả `access_token`, `expires` và đặt cookie `REFRESH_TOKEN_COOKIE_NAME`; `session` trả `expires` và đặt cookie
  `SESSION_COOKIE_NAME` chứa access token. Thuộc tính cookie (`HttpOnly`, `Domain`, `Max-Age`, `Expires`, `Path`,
  `Secure`, `SameSite`) PHẢI lấy từ `REFRESH_TOKEN_COOKIE_*`, `SESSION_COOKIE_*` với cùng mặc định như Directus.
- **FR-005**: Khi đăng nhập thành công, app mới PHẢI: thêm một dòng `directus_sessions` (refresh token ngẫu nhiên 64 ký
  tự cùng bảng chữ như Directus, `user`, `expires` = lúc này + `REFRESH_TOKEN_TTL`, `ip`, `user_agent` cắt còn 1024 ký
  tự, `origin`); xóa mọi session đã hết hạn; ghi activity `login`; cập nhật `last_access`; đưa bộ đếm đăng nhập sai
  của user về 0 (khi `auth_login_attempts` khác `null`).

**Access token**

- **FR-010**: Access token PHẢI là JWT ký bằng `SECRET` với cùng thuật toán (HS256, mặc định của `jsonwebtoken`), issuer `directus`, thời hạn
  `ACCESS_TOKEN_TTL` (hoặc `SESSION_COOKIE_TTL` ở chế độ `session`), và đúng các claim của Directus: `id`, `role`,
  `app_access`, `admin_access`, `enforce_tfa` (chỉ khi user chưa bật TFA và một policy gắn với role của user có
  `enforce_tfa: true`, đúng truy vấn của Directus), `session` (chế độ `session`), `share` (session của share). `app_access`
  và `admin_access` PHẢI tính từ cây role và mọi policy áp dụng cho user, lọc theo IP (`ip_access`), giống
  `fetchRolesTree` và `fetchGlobalAccess`. `expires` trong response là số mili giây của TTL.
- **FR-011**: Khi `SECRET` không đặt, app mới PHẢI sinh secret ngẫu nhiên cho từng process như Directus và giữ cảnh
  báo của feature 001 (D-18).

**Làm mới và kết thúc phiên**

- **FR-020**: `POST /auth/refresh` và `POST /auth/logout` PHẢI chọn chế độ và nguồn refresh token giống Directus:
  `mode` trong body; nếu không có thì `json` khi body có `refresh_token`, ngược lại `cookie`. Chế độ `session` lấy
  claim `session` của JWT trong session cookie. Không có token thì trả `400 INVALID_PAYLOAD` với cùng `reason`.
- **FR-021**: Refresh PHẢI làm đúng `AuthenticationService.refresh`: chỉ nhận session chưa hết hạn, share trong khoảng
  `date_start`, `date_end`; user không `active` thì xóa session và trả `USER_SUSPENDED` hoặc `INVALID_CREDENTIALS`
  (sau `LOGIN_STALL_TIME`); gọi bước refresh của provider (FR-074, FR-077; provider không được đăng ký thì `503 INVALID_PROVIDER_CONFIG`, FR-078); dùng `next_token` nếu có, ngược lại sinh
  token mới; ở `json` và `cookie` đổi token và hạn (`REFRESH_TOKEN_TTL`) của dòng cũ; ở `session` giữ dòng cũ thêm
  `SESSION_REFRESH_GRACE_PERIOD`, ghi `next_token` và tạo dòng mới hạn `SESSION_COOKIE_TTL`, để các refresh đồng thời
  (ở một hoặc hai app) nhận cùng session mới; token của share có `share`, `role: null`, `app_access` và
  `admin_access` là `false`, không có `id`; cập nhật `last_access`; xóa session hết hạn của cùng user hoặc share.
- **FR-022**: Logout PHẢI tìm session nối với user (session của share không bị xóa, giống Directus), gọi bước logout
  của provider, ghi activity `logout`, xóa dòng session, xóa cookie refresh và cookie session mà request có gửi, và
  trả response giống Directus.
- **FR-024**: Mọi chỗ Directus xóa cookie (logout, bước `authenticate`, callback SSO) PHẢI cho header `Set-Cookie`
  giống `res.clearCookie` của Express 4.21.2 mà Directus dùng: cookie rỗng, `Path=/`, và khi xóa bằng tùy chọn của
  cookie refresh hoặc session thì vẫn giữ `Max-Age` bằng TTL và `Expires` ở tương lai (thêm khi xử lý checklist).
- **FR-023**: Logout của user thuộc provider không được đăng ký ở app mới (gồm `saml`, FR-070) PHẢI trả lỗi như Directus
  khi provider không được cấu hình (FR-078).

**Xác thực request**

- **FR-030**: App mới PHẢI có bước `authenticate` giống Directus, áp dụng cho mọi route của feature này (`GET /auth`,
  `/auth/*`, `POST /users/me/tfa/generate`), để token sai gửi kèm các route này bị từ chối như Directus. Với JWT của Directus (`iss: "directus"`): kiểm chữ ký và hạn, kiểm có đủ claim `role`,
  `app_access`, `admin_access`; nếu có claim `session` thì kiểm dòng session (token, user, share, chưa hết hạn); gán
  `user`, `role`, `roles`, `admin`, `app`, `session`, `share`. Với chuỗi khác: coi là static token, tìm user `active`
  có `token` bằng chuỗi đó.
- **FR-031**: Lỗi PHẢI giống Directus: JWT hết hạn `401 TOKEN_EXPIRED`; JWT sai hoặc thiếu claim `403 INVALID_TOKEN`;
  lỗi khác khi kiểm JWT `503 SERVICE_UNAVAILABLE`; static token không khớp hoặc session không còn
  `401 INVALID_CREDENTIALS`. Khi lỗi `INVALID_CREDENTIALS` hoặc `INVALID_TOKEN` đến từ session cookie, response PHẢI
  xóa cookie đó.
- **FR-032**: Các route đã có từ feature 001 (`/server/info`, `/server/health`, `/server/specs/oas`, `/metrics`, path
  lạ) PHẢI giữ hành vi D-10 (bỏ qua token, trả như request public) và cảnh báo "token bị bỏ qua" (FR-044 của feature
  001) tới feature 004. Feature 004 áp dụng bước `authenticate` cho mọi route và gỡ D-10.
- **FR-033**: Bước `authenticate` của feature này PHẢI là cùng một bước mà feature 004 sẽ áp dụng cho mọi route (cùng
  vị trí trong pipeline của Directus), không phải một cách kiểm token riêng cho route TFA.
- **FR-034**: `OPTIONS` tới route của feature này PHẢI trả `200`, header `Allow` và body như router Express của
  Directus (`/auth` → `GET,HEAD`; route chỉ `POST` → `POST`; bắt đầu SSO → `GET,HEAD`; callback SSO →
  `POST,GET,HEAD`). `HEAD` tới route `GET` chạy như `GET` không có body. Path không có route trả `404`, giống Directus
  (thêm khi xử lý checklist).

**Trạng thái user, thời gian chờ và giới hạn đăng nhập sai**

- **FR-040**: Mọi nhánh mà Directus chờ `LOGIN_STALL_TIME` (mặc định `500` mili giây) PHẢI chờ như vậy ở app mới:
  đăng nhập thành công, lỗi payload, lỗi danh tính, trạng thái, provider, mật khẩu, OTP, và lỗi refresh do trạng thái
  user. Nhánh Directus không chờ (ví dụ `503` của rate limiter) thì app mới cũng không chờ.
- **FR-041**: App mới PHẢI có bộ đếm đăng nhập sai giống Directus: tạo bằng cấu hình `RATE_LIMITER_*` (store, key
  prefix, kết nối Redis) với `duration: 0`, số lượt bằng setting `auth_login_attempts`, key là id user; chạy cả khi
  `RATE_LIMITER_ENABLED=false`. Với `RATE_LIMITER_STORE=redis`, key và giá trị PHẢI giống Directus để hai app đếm
  chung. Hết lượt thì chuyển user sang `suspended`, ghi activity `update` và revision với delta `{status: "suspended"}`,
  đặt bộ đếm về 0. Lỗi rate limiter khác PHẢI trả `503 SERVICE_UNAVAILABLE` (`Rate limiter unreachable`). Với
  `RATE_LIMITER_STORE=memory`, mỗi process đếm riêng như Directus; cảnh báo "chỉ an toàn khi chạy một instance" của
  feature 001 áp dụng cả khi `RATE_LIMITER_ENABLED=false` (chỉnh khi lập plan: bộ đếm này luôn chạy). Rate limiter
  theo IP và rate limiter toàn cục của 001 (khi bật) áp dụng cho mọi route của feature này, trước bộ đếm theo user,
  giống Directus.
- **FR-042**: User `invited`, `draft`, `suspended`, `archived` PHẢI không đăng nhập được, không refresh được, và không
  dùng được static token, giống Directus.

**Xác thực hai lớp (TFA)**

- **FR-050**: `POST /users/me/tfa/generate` PHẢI: trả `401 INVALID_CREDENTIALS` khi chưa đăng nhập; với user provider
  `default` bắt buộc `password` và kiểm mật khẩu; từ chối khi TFA đã bật hoặc user `default` không có email; trả
  `secret` và `otpauth_url` với cùng định dạng secret và URL như Directus (tên tài khoản là email, hoặc
  `external_identifier`, hoặc `user_<id>`; issuer là `project_name` của settings, hoặc `Backoffice` khi trống, D-25).
  Bước này không ghi DB.
- **FR-051**: `POST /users/me/tfa/enable`, `POST /users/me/tfa/disable`, `POST /users/:pk/tfa/disable` KHÔNG thuộc
  feature này. Các route này ghi `tfa_secret` qua `ItemsService.updateOne` theo quyền của user (kiểm quyền `update`,
  revision theo quyền đọc), nên làm ở feature 005. Tới lúc đó app mới trả `404 ROUTE_NOT_FOUND` (D-09.10).
- **FR-053**: Khi đăng nhập user đã bật TFA, thiếu `otp` hoặc `otp` sai PHẢI trả `401 INVALID_OTP`. Thuật toán OTP
  (TOTP, độ dài mã, bước thời gian, cửa sổ chấp nhận) và cách sinh secret PHẢI giống thư viện Directus dùng, để secret
  sinh ở bên này dùng được ở bên kia.

**Quên và đặt lại mật khẩu**

- **FR-060**: `POST /auth/password/request` PHẢI: kiểm `email` là chuỗi (`400 INVALID_PAYLOAD`); kiểm `reset_url` theo
  `PASSWORD_RESET_URL_ALLOW_LIST` (`400 INVALID_PAYLOAD`); với user `active` provider `default` thì sinh token đặt lại
  (JWT `{email, scope: "password-reset", hash}` ký bằng `SECRET`, hạn 1 ngày, issuer `directus`, hash tính từ mật
  khẩu hiện tại như Directus) và link (`reset_url` hoặc `PUBLIC_URL/admin/reset-password`, thêm `?token=`); KHÔNG gửi
  email, ghi log `warn` (FR-062); các lỗi khác (user không có, không `active`, SSO) được ghi log và trả thành công như
  controller của Directus. Mọi nhánh sau bước kiểm `reset_url` PHẢI trả sau ít nhất 500 mili giây (giá trị cố định của
  Directus, không theo `LOGIN_STALL_TIME`).
- **FR-061**: `POST /auth/password/reset` PHẢI: kiểm `token`, `password` là chuỗi; kiểm JWT (lỗi `TOKEN_EXPIRED`,
  `INVALID_TOKEN` như Directus); `scope` khác `password-reset` hoặc thiếu hash thì `403 FORBIDDEN`; user không `active`
  hoặc hash không khớp mật khẩu hiện tại thì `403 FORBIDDEN`; mật khẩu không thỏa `auth_password_policy` thì
  `400 FAILED_VALIDATION` với cùng `extensions`, theo cùng thứ tự kiểm như Directus; thành công thì lưu mật khẩu (hash
  argon2 cùng tham số Directus dùng), `status: active`, ghi activity và revision như Directus (accountability mặc định
  với quyền admin), và xóa mọi session của user. Token do Directus sinh PHẢI dùng được ở app mới và ngược lại.
- **FR-062**: Dòng log `warn` thay cho email đặt lại mật khẩu PHẢI có email người nhận và lý do không gửi. Dòng log
  KHÔNG ĐƯỢC chứa token hay link đặt lại mật khẩu, ở mọi mức log. Người dùng cần đặt lại mật khẩu thì liên hệ admin.

**SSO (OpenID Connect, OAuth2, LDAP) và danh sách provider**

- **FR-070**: Khi khởi động, app mới PHẢI đọc `AUTH_PROVIDERS` và `AUTH_<PROVIDER>_*` giống `registerAuthProviders`:
  đăng ký provider driver `local`, `openid`, `oauth2`, `ldap`; provider driver `saml` bị bỏ qua với một dòng log `warn`
  cho mỗi provider (nêu tên và driver); thiếu driver hoặc driver lạ thì log `warn` như Directus; tên `default` thì log
  `error` và dừng process như Directus.
- **FR-071**: Provider OpenID PHẢI đọc cùng các biến như Directus: `CLIENT_ID`, `CLIENT_SECRET`,
  `CLIENT_PRIVATE_KEYS`, `CLIENT_TOKEN_ENDPOINT_AUTH_METHOD`, `CLIENT_*` (tùy chọn client khác), `CLIENT_HTTP_*`,
  `ISSUER_URL`, `ISSUER_DISCOVERY_MUST_SUCCEED`, `SCOPE`, `PARAMS`, `PLAIN_CODE_CHALLENGE`, `IDENTIFIER_KEY`,
  `ALLOW_PUBLIC_REGISTRATION`, `REQUIRE_VERIFIED_EMAIL`, `DEFAULT_ROLE_ID`, `ROLE_MAPPING`, `GROUP_CLAIM_NAME`,
  `SYNC_USER_INFO`, `MODE`, `LOGIN_TIMEOUT`, `COOKIE_SECURE`, `REDIRECT_ALLOW_LIST`, `LABEL`, `ICON`, cùng
  `AUTH_ALLOWED_PUBLIC_URLS`, với cùng mặc định, cùng kiểm cấu hình khi khởi động và cùng lỗi như Directus.
- **FR-072**: `GET /auth/login/<provider>` của OpenID và OAuth2 PHẢI kiểm `redirect` như `resolveLoginRedirect`
  (`400 INVALID_PAYLOAD` khi không hợp lệ), tính callback URL như `generateCallbackUrl`, đặt cookie `openid.<provider>`
  hoặc `oauth2.<provider>` (JWT chứa verifier, redirect, prompt, otp, callbackUrl, hạn `LOGIN_TIMEOUT` mặc định 5 phút)
  và chuyển hướng tới IdP với cùng tham số; OpenID không dựng được URL thì chuyển về
  `PUBLIC_URL/admin/login?reason=SERVICE_UNAVAILABLE`, giống Directus.
- **FR-073**: `/auth/login/<provider>/callback` của OpenID và OAuth2 PHẢI làm đúng driver tương ứng của Directus: `POST`
  chuyển thành `GET` với `303`; cookie sai thì OpenID chuyển về `/admin/login?reason=INVALID_CREDENTIALS`, OAuth2 trả
  `401 INVALID_CREDENTIALS`; đổi code lấy token, đọc claims và userinfo (OpenID) hoặc profile (OAuth2); tìm user theo
  `external_identifier`; tạo user (khi được đăng ký công khai và email đạt yêu cầu) hoặc cập nhật `auth_data`, role,
  thông tin user với cùng payload như Directus; rồi đi qua luồng đăng nhập chung (FR-002 đến FR-005, FR-041, FR-053);
  `invalid_grant` khi chưa `prompt` thì chuyển hướng lại với `prompt=true`; lỗi khác chuyển về `redirect` kèm `reason`;
  `enforce_tfa` thì chuyển tới `/admin/tfa-setup`; trả phiên theo `MODE` (mặc định `session`). Như Directus, khi
  `SYNC_USER_INFO` bật thì mỗi lần đăng nhập SSO xóa mọi session cũ của user (vì payload có `email`), và khi payload có
  `role` thì xóa cache hệ thống (`clearSystemCache`) ở mỗi lần đăng nhập (contracts/db-writes.md §7).
- **FR-074**: Khi đăng nhập lại hoặc refresh user OpenID hoặc OAuth2 có `auth_data.refreshToken`, app mới PHẢI làm mới
  token với IdP và lưu refresh token mới vào `auth_data` như Directus; `invalid_grant` trả `403 INVALID_TOKEN`.
- **FR-075**: `GET /auth` PHẢI trả `data` (danh sách `name`, `label`, `driver`, `icon`, lọc `sessionOnly` như
  Directus) và `disableDefault`, không có provider `saml`.
- **FR-076**: Provider OAuth2 PHẢI đọc cùng các biến như Directus: `CLIENT_ID`, `CLIENT_SECRET`, `CLIENT_*`,
  `AUTHORIZE_URL`, `ACCESS_URL`, `PROFILE_URL`, `SCOPE`, `PARAMS`, `PLAIN_CODE_CHALLENGE`, `IDENTIFIER_KEY`,
  `EMAIL_KEY`, `FIRST_NAME_KEY`, `LAST_NAME_KEY`, `ALLOW_PUBLIC_REGISTRATION`, `DEFAULT_ROLE_ID`, `ROLE_MAPPING`,
  `GROUP_CLAIM_NAME`, `SYNC_USER_INFO`, `MODE`, `LOGIN_TIMEOUT`, `COOKIE_SECURE`, `REDIRECT_ALLOW_LIST`, `LABEL`, `ICON`,
  với cùng mặc định và cùng kiểm cấu hình khi khởi động như Directus.
- **FR-077**: Provider LDAP PHẢI đọc cùng các biến như Directus: `CLIENT_URL`, `CLIENT_*` (ví dụ `socketPath`, TLS),
  `BIND_DN`, `BIND_PASSWORD`, `USER_DN`, `USER_ATTRIBUTE` (mặc định `cn`), `USER_SCOPE` (mặc định `one`),
  `MAIL_ATTRIBUTE`, `FIRST_NAME_ATTRIBUTE`, `LAST_NAME_ATTRIBUTE`, `GROUP_DN`, `GROUP_ATTRIBUTE` (mặc định `member`),
  `GROUP_SCOPE`, `DEFAULT_ROLE_ID`, `SYNC_USER_INFO`, `LABEL`, `ICON`. `POST /auth/login/<provider>` PHẢI kiểm payload
  (`identifier`, `password` bắt buộc, `mode`, `otp`) và đi qua luồng đăng nhập chung giống driver LDAP của Directus:
  kiểm bind user, tìm user theo thuộc tính (có escape giá trị), lấy nhóm và role, tạo hoặc cập nhật user, kiểm mật khẩu
  bằng bind với DN của user, từ chối tài khoản có cờ khóa trong `userAccountControl`, chuyển lỗi LDAP thành
  `INVALID_CREDENTIALS` hoặc `SERVICE_UNAVAILABLE` như Directus. Refresh PHẢI kiểm lại tài khoản trên LDAP như Directus.
- **FR-078**: App mới KHÔNG đăng ký provider `saml`. Refresh và logout session của user thuộc provider `saml` (hoặc
  provider không có trong `AUTH_PROVIDERS`) PHẢI trả `503 INVALID_PROVIDER_CONFIG` và log `error`
  `Auth provider not configured`, giống Directus khi provider đó không được cấu hình (Nguyên tắc XI: hành vi như
  Directus khi tính năng tắt). Session không bị xóa, như Directus.
- **FR-079**: Tên provider trong path `/auth/login/<provider>` PHẢI so không phân biệt hoa thường, chọn provider đầu
  tiên khớp theo thứ tự `AUTH_PROVIDERS`, như router Express của Directus (thêm khi xử lý checklist).

**Dữ liệu ghi vào DB**

- **FR-080**: Mọi dòng app mới ghi (`directus_sessions`, `directus_activity`, `directus_revisions`, các cột
  `directus_users`: `last_access`, `status`, `password`, `auth_data`, user mới tạo bằng SSO) PHẢI có cùng
  định dạng như Directus ghi cho cùng request (kiểu ngày giờ, JSON, uuid, hash argon2, giá trị `action`, `collection`,
  `item`, `ip`, `user_agent`, `origin`).
- **FR-081**: App mới chỉ ghi DB trong các luồng của feature này và chỉ vào các bảng, cột ở FR-080. Test
  `db-unchanged` và `readonly-account` của bộ test đối chiếu PHẢI được sửa theo: DB không đổi với mọi request ngoài các
  luồng này; với tài khoản DB chỉ có quyền đọc, mọi request không ghi DB (gồm `GET /auth`, đăng nhập sai, refresh với
  token sai) vẫn chạy không lỗi `500` (chỉnh khi lập plan: test này chỉ chạy app mới, không có Directus để so luồng
  ghi).
- **FR-082**: Các lần ghi `directus_users` của feature này (đặt lại mật khẩu, khóa user, SSO) PHẢI cho cùng dòng
  `directus_users`, `directus_activity`, `directus_revisions` như `UsersService` của Directus với cùng accountability
  (có activity và revision khi Directus ghi; không có khi accountability là `null` như luồng SSO), dù endpoint
  `/users` và `/items` chưa có (feature 004, 005).

**Biến môi trường**

- **FR-090**: App mới PHẢI hỗ trợ với cùng tên, mặc định và cách ép kiểu như Directus 11.17.4: `SECRET`,
  `ACCESS_TOKEN_TTL` (`15m`), `REFRESH_TOKEN_TTL` (`7d`), `REFRESH_TOKEN_COOKIE_NAME` (`directus_refresh_token`),
  `REFRESH_TOKEN_COOKIE_DOMAIN`, `REFRESH_TOKEN_COOKIE_SECURE` (`false`), `REFRESH_TOKEN_COOKIE_SAME_SITE` (`lax`),
  `SESSION_COOKIE_TTL` (`1d`), `SESSION_COOKIE_NAME` (`directus_session_token`), `SESSION_COOKIE_DOMAIN`,
  `SESSION_COOKIE_SECURE` (`false`), `SESSION_COOKIE_SAME_SITE` (`lax`), `SESSION_REFRESH_GRACE_PERIOD` (`10s`),
  `LOGIN_STALL_TIME` (`500`), `PASSWORD_RESET_URL_ALLOW_LIST`, `HASH_*` (tham số argon2 khi đặt lại mật khẩu),
  `USERS_ADMIN_ACCESS_LIMIT`, `USERS_APP_ACCESS_LIMIT`, `USERS_API_ACCESS_LIMIT` (kiểm số user khi ghi `directus_users`)
  (hai nhóm này thêm khi lập plan), `AUTH_PROVIDERS`, `AUTH_DISABLE_DEFAULT` (`false`),
  `AUTH_ALLOWED_PUBLIC_URLS`, và `AUTH_<PROVIDER>_*` của provider `local`, `openid`, `oauth2`, `ldap`. Các biến này PHẢI được gỡ khỏi
  nhóm "chưa hỗ trợ" của feature 001. `AUTH_<PROVIDER>_*` của provider `saml` (gồm `AUTH_<PROVIDER>_IDP*`,
  `AUTH_<PROVIDER>_SP*`) chỉ có cảnh báo ở FR-070.
- **FR-091**: `USER_INVITE_*`, `USER_REGISTER_URL_ALLOW_LIST`, `REGISTER_STALL_TIME`, `EMAIL_VERIFICATION_TOKEN_TTL`
  vẫn thuộc feature 004 và vẫn được cảnh báo như hiện nay.

**Kiểm thử đối chiếu**

- **FR-100**: Phần REST của `login.test.ts`, `refresh.test.ts`, `oauth-redirect.test.ts`, `oauth-multi-domain.test.ts`
  (provider OAuth2 `github`, không gọi ra ngoài), `ldap.test.ts` (container OpenLDAP như bộ blackbox), và các ca che
  cookie của `redact.test.ts` PHẢI được port sang bộ test đối chiếu (cùng cách port tay lên `parity()` như feature 001,
  002) và chạy với cả Directus và app mới. Ca nào gọi `/users/me` (feature 004) thì kiểm token bằng endpoint đã có ở
  app mới, và chạy lại nguyên bản ở feature 004.
- **FR-101**: Bộ test PHẢI có ma trận dùng chéo: mỗi loại token (access token chế độ `json`, `cookie`, `session`;
  refresh token; session cookie; static token; token đặt lại mật khẩu) cấp ở bên này dùng được ở bên kia, theo cả
  hai chiều. Ở app mới, access token, session cookie và static token được kiểm qua `POST /users/me/tfa/generate`
  (route duy nhất cần đăng nhập ở feature này); ở Directus, qua cùng route đó. Ma trận có cả luồng SSO OpenID và
  OAuth2 bắt đầu ở bên này, callback ở bên kia, theo cả hai chiều. Secret TFA sinh ở app mới bật được ở Directus, và TFA bật ở Directus dùng được khi đăng nhập ở app mới.
- **FR-102**: Bộ test PHẢI có ca đối chiếu cho logout, quên và đặt lại mật khẩu, đăng nhập với TFA và
  `/users/me/tfa/generate`, trạng thái user,
  `LOGIN_STALL_TIME`, bộ đếm đăng nhập sai dùng chung qua Redis, cảnh báo provider `saml` bị bỏ qua, luồng OpenID và
  OAuth2 với một IdP thử nghiệm chạy cục bộ, và luồng LDAP (đăng nhập, refresh, tài khoản bị khóa) với OpenLDAP.
- **FR-103**: User, role, policy và static token dùng trong test PHẢI được tạo qua API của Directus (DB dùng chung),
  vì `/users`, `/roles`, `/policies` chưa có ở app mới tới feature 004.

### Key Entities

- **User** (`directus_users`): người đăng nhập. Các cột dùng ở feature này: `email`, `password` (hash argon2),
  `status`, `role`, `provider`, `external_identifier`, `auth_data`, `tfa_secret`, `token` (static token),
  `last_access`.
- **Session** (`directus_sessions`): một refresh token hoặc một phiên chế độ `session`: `token`, `user` hoặc `share`,
  `expires`, `ip`, `user_agent`, `origin`, `next_token`.
- **Access token**: JWT ký bằng `SECRET`, issuer `directus`, không lưu trong DB.
- **Token đặt lại mật khẩu**: JWT scope `password-reset`, chứa email và hash của mật khẩu hiện tại, sống 1 ngày.
- **Auth provider**: cấu hình từ `AUTH_PROVIDERS` và `AUTH_<PROVIDER>_*`; `default` là provider email/mật khẩu.
- **Bộ đếm đăng nhập sai**: key theo id user trong rate limiter (`RATE_LIMITER_*`), dùng chung qua Redis khi
  `RATE_LIMITER_STORE=redis`.
- **Activity và revision** (`directus_activity`, `directus_revisions`): bản ghi `login`, `logout`, `update` mà các
  luồng của feature này ghi giống Directus.

## Khác biệt so với Directus *(mandatory)*

Thay đổi với bảng khác biệt của feature 001:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-09 | Gỡ D-09.1 (`/auth`). Tách `/users/me/tfa/generate` khỏi D-09.2 (làm ở feature này). Thêm D-09.10: `/users/me/tfa/enable`, `/users/me/tfa/disable`, `/users/:pk/tfa/disable`, gỡ khi 005. Các route `/users` còn lại vẫn trả `404` tới feature 004 | FR-001 đến FR-075, FR-051 |
| D-10 | Giữ tới feature 004 cho các route đã có từ 001. Route mới của feature này (`/auth/*`, `POST /users/me/tfa/generate`) xử lý token như Directus | FR-030 đến FR-033 |

Khác biệt mới:

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại | Gỡ khi |
|----|----------|------------------|---------|-------|------|--------|
| D-23 | Email đặt lại mật khẩu (`POST /auth/password/request`) | Gửi email chứa link đặt lại qua `EMAIL_*` | Không gửi, ghi log `warn` có email người nhận, không có token hay link (FR-062). Response và thời gian trả về giống Directus | Nguyên tắc X | ngoài phạm vi | — |
| D-24 | Provider driver `saml` | Đăng ký provider, có route `/auth/login/<provider>`, có trong `GET /auth` | Bỏ qua, log `warn` khi khởi động; route trả `404`; không có trong `GET /auth`. Refresh và logout session của user SAML trả `503 INVALID_PROVIDER_CONFIG` như Directus khi tắt SAML (FR-078); hệ thống có user SAML phải định tuyến `/auth/*` của họ về Directus | Nguyên tắc XI (1.3.0) | ngoài phạm vi | — |
| D-25 | Issuer trong `otpauth_url` khi `project_name` trống | `Directus` | `Backoffice` | Nguyên tắc IX (nhãn issuer TFA được liệt kê) | đổi thương hiệu | — |
| D-26 | Event `auth.login`, `auth.jwt`, `auth.create`, `auth.update`, `authenticate` (filter và action) | Phát cho extension và flow | Không phát | Extension ngoài phạm vi (Nguyên tắc XI); flow theo event thuộc feature 009 | ngoài phạm vi (flow: tạm thời) | 009 (phần flow) |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. JWT issuer `directus`, tên cookie `directus_refresh_token`, `directus_session_token`, `openid.<provider>`,
  `oauth2.<provider>`, tên provider `default`, đường dẫn `/admin/reset-password`, `/admin/login`, `/admin/tfa-setup` trong link và chuyển
  hướng giữ nguyên vì ảnh hưởng luồng (Nguyên tắc IX).

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4 (api 35.2.0). Mặc định lấy từ `directus/packages/env/src/constants/defaults.ts`
  và code Directus.
- Directus và app mới dùng cùng `SECRET`, cùng DB, cùng Redis. Không đặt `SECRET` thì token không dùng chéo được, kể cả
  giữa hai instance Directus.
- Bộ test blackbox không chạy trực tiếp được với app mới (chưa có runner trỏ vào hai URL); các ca được port tay lên
  `parity()` như feature 001, 002. "Bộ test blackbox auth chạy qua" nghĩa là mọi ca port ở FR-100 đạt.
- Môi trường đối chiếu dùng `RATE_LIMITER_STORE=redis` và Redis chung, nên bộ đếm đăng nhập sai dùng chung. Với store
  `memory`, mỗi process đếm riêng, giống Directus.
- Luồng OpenID và OAuth2 được kiểm với một IdP thử nghiệm chạy cục bộ trong môi trường test; LDAP với container
  OpenLDAP như bộ blackbox của Directus. Azure AD/Entra ID, Keycloak, GitHub, Active Directory thật chỉ cần đúng các biến
  `AUTH_*` như Directus, không chạy trong CI.
- Các phần sau không thuộc feature này: đăng nhập và token qua GraphQL (011); xác thực WebSocket (Nguyên tắc XI);
  `/shares/auth` (010; refresh session của share có sẵn trong DB thì thuộc feature này, FR-021); `/users/me`,
  `/users/register`, `/users/invite`, `/users/invite/accept` và đặt static token cho user (004).
- Feature này ghi `directus_users`, `directus_activity`, `directus_revisions` cho đúng các luồng ở FR-082 mà chưa có
  `ItemsService` đầy đủ; feature 005 thay phần ghi này bằng service chung và chạy lại test đối chiếu của feature này.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% ca test port ở FR-100 cho cùng status, body (trừ token sinh ngẫu nhiên) và header `Set-Cookie`
  (tên, thuộc tính, trừ thời điểm `Expires`) ở Directus và app mới.
- **SC-002**: 100% ca của ma trận dùng chéo (FR-101) đạt theo cả hai chiều: token cấp ở một bên được bên kia nhận, và
  token bị thu hồi (logout, đặt lại mật khẩu, user bị khóa) ở một bên bị bên kia từ chối từ request kế tiếp.
- **SC-003**: Mọi response của `POST /auth/login` ở các nhánh của FR-040 trả sau ít nhất `LOGIN_STALL_TIME`. Trên 50 lần thử mỗi loại, trung vị
  thời gian trả về của "email không tồn tại" và "sai mật khẩu" lệch nhau không quá 50 mili giây.
- **SC-004**: Với `auth_login_attempts = N` và đăng nhập sai xen kẽ giữa Directus và app mới, user bị khóa đúng ở lần thử
  bị khóa khi chỉ chạy Directus.
- **SC-005**: Với mỗi luồng ghi DB (đăng nhập, refresh ba chế độ, logout, khóa user, đặt lại mật khẩu, SSO), các
  dòng app mới ghi giống 100% dòng Directus ghi cho cùng request, trừ giá trị sinh ngẫu nhiên (id, token, thời điểm,
  salt của hash). Đạt trên Postgres, MySQL, SQLite ở mỗi lần push. `data`, `delta` của revision so sau khi parse JSON,
  không so thứ tự key.
- **SC-006**: Đội vận hành dùng nguyên file `.env` của Directus: không thêm hoặc đổi dòng cấu hình nào; mỗi provider bị
  bỏ qua cho đúng 1 dòng cảnh báo provider khi khởi động và app vẫn chạy. Biến chỉ SAML dùng (`AUTH_<P>_IDP*`,
  `AUTH_<P>_SP*`) vẫn được liệt kê trong dòng "biến chưa hỗ trợ" chung của 001; dòng đó không tính là cảnh báo provider.
- **SC-007**: Với dữ liệu quy mô thiết kế (2.000 user `active`, mỗi user có một session còn hạn) và tải 2.000 kết nối
  đồng thời, p95 latency và throughput của `POST /auth/login`, `POST /auth/refresh` (chế độ `json`) và một request
  mang access token không tệ hơn Directus quá 10% với cùng dữ liệu và cùng cấu hình (Nguyên tắc X). Request mang token
  là `POST /users/me/tfa/generate` của user provider khác `default` (trả `200`, không ghi DB), vì đây là route duy nhất
  cần đăng nhập ở feature này. Mọi response khác `2xx` và mọi request quá 120 giây tính là lỗi; một vòng có lỗi thì vòng
  đó không đạt. Benchmark này chặn CI.
- **SC-008**: Người dùng đi hết luồng SSO của mỗi driver (OpenID, OAuth2, LDAP) ở app mới với IdP hoặc LDAP thử nghiệm,
  rồi refresh và dùng phiên đó ở Directus, và ngược lại: 100% kịch bản của User Story 7 đạt.
