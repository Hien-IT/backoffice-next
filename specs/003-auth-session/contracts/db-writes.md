# Contract: Dữ liệu ghi vào DB (003)

Mỗi dòng dưới đây là thứ app mới ghi cho một request, giống Directus 11.17.4 cùng request (FR-080, FR-082, SC-005).
"Giá trị sinh ngẫu nhiên" (token, `id` tự tăng, uuid, thời điểm, salt của hash) khác nhau giữa hai bên; test so kiểu,
định dạng và khoảng thời gian của chúng (research R6). Ngày giờ ghi bằng `Date` của JS qua knex (hoặc qua
`helpers.date.writeTimestamp` ở special `date-created`), như Directus, nên định dạng trên từng vendor giống nhau.

## 1. Đăng nhập thành công (`local`, `ldap`, SSO)

Thứ tự như `AuthenticationService.login`:

1. (SSO, LDAP) tạo hoặc cập nhật user theo §6, §7.
2. `INSERT directus_sessions`: `token` = `nanoid(64)`, `user`, `expires` = lúc này + `REFRESH_TOKEN_TTL`, `ip`,
   `user_agent` (đã cắt 1024), `origin` (cột nào `undefined` thì không ghi). Chế độ `session` cũng dùng
   `REFRESH_TOKEN_TTL` cho hạn của dòng này, như Directus.
3. `DELETE directus_sessions WHERE expires < now`.
4. `INSERT directus_activity` qua `ActivityService.createOne`: `action: login`, `user`, `ip`, `user_agent`, `origin`,
   `collection: directus_users`, `item: <user id>`, `timestamp` do special `date-created`.
5. `UPDATE directus_users SET last_access = now`.
6. Redis: bộ đếm của user về 0 (khi `auth_login_attempts` khác `null`).

Đăng nhập thất bại không ghi DB, trừ khi user bị khóa (§3).

## 2. Refresh

| Chế độ | Ghi |
|--------|-----|
| `json`, `cookie` | `UPDATE directus_sessions SET token = <next_token hoặc nanoid(64)>, expires = now + REFRESH_TOKEN_TTL WHERE token = <cũ>` |
| `session`, lần đầu | `UPDATE ... SET next_token = <mới>, expires = now + SESSION_REFRESH_GRACE_PERIOD WHERE token = <cũ> AND next_token IS NULL RETURNING next_token`; có dòng thì `INSERT` session mới (`user`, `share`, `expires` = now + `SESSION_COOKIE_TTL`, `ip`, `user_agent`, `origin`); không có dòng thì đọc lại `next_token` |
| `session`, đã có `next_token` | `UPDATE ... SET expires = now + SESSION_COOKIE_TTL WHERE token = <next_token>` |

Sau đó: `UPDATE directus_users SET last_access = now` (khi là user), rồi `DELETE directus_sessions WHERE user = <user>
AND share = <share> AND expires < now`. Port nguyên câu `update(..., ['next_token'])`, kể cả việc trên MySQL kết quả là
số dòng chứ không phải mảng: hai bên cùng hành vi vì cùng code và cùng knex.

User không `active`: `DELETE directus_sessions WHERE token = <cũ>` rồi trả lỗi.

## 3. Khóa user khi hết lượt đăng nhập sai

1. `UPDATE directus_users SET status = 'suspended' WHERE id = <user>`.
2. `INSERT directus_activity`: `action: update`, `user: <user>`, `ip`, `user_agent`, `origin`,
   `collection: directus_users`, `item: <user>`.
3. `INSERT directus_revisions`: `activity`, `collection: directus_users`, `item`,
   `data = prepareDelta(user đã đọc lúc đăng nhập)`. Đây là các cột `id, first_name, last_name, email, password, status,
   role, tfa_secret, provider, external_identifier, auth_data`; `password`, `tfa_secret` che thành `**********`;
   `status` vẫn là `active`, giống Directus. `delta = {"status":"suspended"}`.
4. Redis: bộ đếm của user về 0.

Rồi luồng đăng nhập chạy tiếp như Directus (bước kiểm mật khẩu và OTP vẫn chạy).

## 4. Logout

`INSERT directus_activity` (`action: logout`, như §1 bước 4), rồi `DELETE directus_sessions WHERE token = <refresh
token>`. Chỉ khi session nối được với một user. Session của share không bị xóa, giống Directus.

## 5. Đặt lại mật khẩu

`UsersService.updateOne(<user>, { password, status: 'active' })`, accountability mặc định của request với `admin: true`:

1. Kiểm `auth_password_policy` (lỗi giữ lại tới sau bước kiểm quyền, như `preMutationError`).
2. `UPDATE directus_users SET password = <argon2 theo HASH_*>, status = 'active'` (trong transaction).
3. `INSERT directus_activity`: `action: update`, `user: null`, `ip`, `user_agent`, `origin`, `collection`, `item`.
4. `INSERT directus_revisions`:
   - `data` = snapshot đọc lại của mọi field không quan hệ của user (`getRelationsForCollection` loại `role`, `avatar` và
     các o2m), qua `processValues('read')` rồi `prepareDelta`: `password`, `tfa_secret`, `token` thành `**********`,
     JSON parse, boolean ép kiểu, ngày giờ theo `processDates`;
   - `delta` = `{"password":"**********","status":"active"}`.
5. `DELETE directus_sessions WHERE user = <user>` (mọi session, vì accountability không có `session`).

## 6. SSO tạo user (OpenID, OAuth2, LDAP)

`UsersService.createOne(payload)`, accountability `null`:
- kiểm email trùng không phân biệt hoa thường (`RECORD_NOT_UNIQUE`, driver đổi thành `INVALID_PROVIDER`);
- `INSERT directus_users` với `id` = uuid (special `uuid`, `formatUUID` theo vendor), `provider`, `first_name`,
  `last_name`, `email`, `external_identifier`, `role`, `auth_data` (chuỗi JSON `{"refreshToken": ...}` khi IdP trả
  refresh token); cột khác lấy mặc định của DB;
- không có activity hay revision.

## 7. SSO cập nhật user

`UsersService.updateOne(<user>, payload)`, accountability `null`:

| Trường trong payload | Khi nào | Tác động thêm |
|----------------------|---------|---------------|
| `auth_data` | OpenID, OAuth2 (mỗi lần đăng nhập; refresh khi IdP trả refresh token mới) | — |
| `role` | `ROLE_MAPPING` (OpenID, OAuth2) hoặc `GROUP_DN` (LDAP) | kiểm còn admin (`validateRemainingAdminCount`), rồi `clearSystemCache()` (002) |
| `first_name`, `last_name`, `email` | `SYNC_USER_INFO` | kiểm email trùng; `DELETE directus_sessions WHERE user = <user>` (mọi session) |

Không có activity hay revision. LDAP gọi `updateOne` cả khi payload rỗng; khi đó không có câu `UPDATE`.

## 8. Không bao giờ ghi

- `directus_users.tfa_secret` (ghi ở 005), `directus_users.token`.
- Bảng, cột, index (Nguyên tắc II).
- Bất kỳ bảng nào khi khởi động (Nguyên tắc VII).
