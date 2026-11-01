# Data Model: Đăng nhập bằng Passkey (WebAuthn) cho user local (029)

Một bảng hệ thống mới `backoffice_passkeys` và một cột `bo_passkey` trên `directus_sessions`, cả hai qua migration riêng
của Backoffice `20261101A` (Nguyên tắc II từ 3.2.0: bảng `backoffice_*`, cột `bo_*` trên `directus_*`); bảng không có dòng
`directus_fields`, cột `bo_passkey` có một dòng ẩn, chỉ đọc; không FK. Challenge sống trong kho dùng chung (Redis), không có trong DB.

## Bảng `backoffice_passkeys` (migration `20261101A`, "Create Backoffice Passkeys")

| Cột | Knex | Null | Ghi chú |
|-----|------|------|---------|
| `id` | `uuid` primary | không | UUID v4 sinh ở API (`randomUUID()`; collection hệ thống giữ v4, 027) |
| `user` | `uuid`, index | không | `directus_users.id`; không FK (Nguyên tắc II). Dòng mồ côi (DR xóa user) bị bỏ qua khi đọc và không đăng nhập được |
| `credential_id` | `string(255)`, unique | không | Credential ID base64url. `shortcut:` WebAuthn cho tới 1023 byte (≈1366 ký tự); authenticator thực tế dùng 16–64 byte; đăng ký với id dài hơn 255 ký tự bị 400 `INVALID_PAYLOAD` (ghi ở contract); nâng lên `text` + hash khi có authenticator cần |
| `public_key` | `text` | không | Khóa công khai COSE, base64url |
| `counter` | `bigInteger` default 0 | không | Bộ đếm chữ ký (uint32); chỉ kiểm lùi khi giá trị đã lưu > 0 (clarify câu 2) |
| `transports` | `json` | có | Mảng chuỗi do trình duyệt báo (`internal`, `hybrid`, `usb`, ...); đưa vào `excludeCredentials` |
| `name` | `string(100)` | không | Tên user đặt, 1–100 ký tự sau trim |
| `device_type` | `string(32)` | có | `singleDevice` hoặc `multiDevice` (thư viện báo) |
| `backed_up` | `boolean` default false | không | Passkey đồng bộ (iCloud, Google) hay không |
| `discoverable` | `boolean` default true | không | Luôn `true` ở 029 (resident key bắt buộc); giữ cột để sau này nhận loại khác không cần DDL |
| `date_created` | `timestamp` default `knex.fn.now()` | không | |
| `last_used` | `timestamp` | có | Cập nhật mỗi lần đăng nhập thành công |

Index: `backoffice_passkeys_user_index (user)`, `backoffice_passkeys_credential_id_unique (credential_id)`. Kiểu
`timestamp` theo helper dialect của bản port như `directus_sessions.expires` (không tz ở MySQL/SQLite, `timestamptz`
ở Postgres như migration DR dùng `table.timestamp`). Chạy lại được: `hasTable` → return; race không khóa: `createTable`
trong try/catch rồi kiểm `hasTable` (mẫu `20261028A`).

Vendor (sửa khi checklist 2026-11-01):

- Index unique `credential_id` `string(255)`: MySQL/MariaDB utf8mb4 1.020 byte < 3.072; MSSQL `nvarchar(255)` 510 byte <
  900; Oracle `varchar2(255)` trong giới hạn khóa.
- Cột `user`: từ khóa ở Postgres và Oracle; Knex trích dẫn định danh, như `directus_sessions.user` và
  `directus_activity.user` của Directus trên mọi vendor.
- `last_used` `timestamp` null: khai báo `.nullable()` rõ để MySQL 5.7 (`explicit_defaults_for_timestamp` tắt) không gán
  `NOT NULL DEFAULT CURRENT_TIMESTAMP` cho cột timestamp thứ hai; `date_created` dùng `defaultTo(knex.fn.now())`.
- `transports` `json`: Knex ánh xạ sang `nvarchar(max)` ở MSSQL, `clob` ở Oracle, `text` ở SQLite; đọc qua `JSON.parse`
  khi driver trả chuỗi (như `backoffice_permissions.permissions`).
- `counter` `bigInteger`: uint32 vừa mọi vendor; driver Postgres/MySQL trả chuỗi cho bigint, đọc bằng `Number()`.

Số dòng: tối đa 10 một user (FR-014, kiểm ở service trước khi insert, không constraint DB). Xóa: theo `id` (của mình
hoặc admin), theo `user` khi xóa user (`UsersService.deleteMany`, D-207.2).

## Cột `directus_sessions.bo_passkey` (cùng migration `20261101A`, D-207.5, phương án E)

| Cột | Knex | Null | Ghi chú |
|-----|------|------|---------|
| `bo_passkey` | `boolean` | có, không default | `true` chỉ do đăng nhập passkey của Backoffice ghi; `refresh` chép sang dòng phiên mới khi xoay token; Directus ghi phiên để null (= không phải passkey). `GET /policies/me/globals` của Backoffice trả `enforce_tfa: false` khi dòng phiên của token có `true`. Một dòng `directus_fields` (boolean, `cast-boolean`, ẩn, chỉ đọc, nhãn en-US/vi-VN) để Data Model không hiện "Database Only"; `GET /fields/directus_sessions` của hai app giống nhau (cùng DB) |

Chạy lại được: `hasColumn` → `alterTable` trong try/catch (mẫu `20261026A`). Gỡ tay: `ALTER TABLE directus_sessions DROP
COLUMN bo_passkey` (xem Assumptions của spec).

## Challenge (kho `backoffice:passkey`, không DB)

| Khóa | Giá trị | Hạn |
|------|---------|-----|
| chuỗi `challenge` (base64url 32 byte do thư viện sinh) | `{ purpose: 'login' \| 'register', user?: uuid (chỉ register), expires: epoch ms }` | 5 phút (`expires` trong giá trị, Redis TTL 5 phút dọn rác); lấy là xóa (một lần) |

## Quan hệ với bảng có sẵn (chỉ đọc hoặc ghi như login local)

| Bảng | Dùng |
|------|------|
| `directus_users` | đọc `id, status, role, provider, tfa_secret, email, first_name, last_name, password` (mật khẩu chỉ khi thêm passkey); ghi `last_access`, `status = 'suspended'` khi hết lượt (như login local) |
| `directus_sessions` | insert một dòng như login local (`token, user, expires, ip, user_agent, origin`) cộng `bo_passkey = true`; `refresh` giữ cột qua dòng mới; `/policies/me/globals` đọc cột theo `accountability.session` |
| `directus_activity` (+ `directus_revisions` khi suspend) | `login` như login local; `update` khi suspend (như login local) |
| `directus_settings` | `auth_login_attempts` (giới hạn), `project_name` (rpName) |
| `directus_policies`/`directus_access` | `app_access`, `admin_access` của token như login local; `enforce_tfa` **không** đọc khi tạo token passkey (D-207.3) và trả `false` ở `/policies/me/globals` cho phiên passkey (D-207.5) |

## Trạng thái và chuyển trạng thái

Passkey không có trạng thái riêng (không "khóa", clarify câu 2). Vòng đời: tạo (đăng ký của chính user, cần mật khẩu)
→ dùng (counter tăng, `last_used`) → đổi tên → xóa (user, admin, hoặc xóa user). User đổi `provider` khỏi `default`,
`status` khác `active`: passkey nằm im (không đăng nhập được, không hiện); quay lại thì dùng tiếp.

## Ví dụ dòng

```json
{
  "id": "7b3f2b1e-5c0a-4a4b-9f0e-2d1c3e4f5a6b",
  "user": "2d6b8f10-0c4e-4b5a-8d7e-9a1b2c3d4e5f",
  "credential_id": "pQECAyYgASFYIK…",
  "public_key": "pQECAyYgASFYIK…(COSE)…",
  "counter": 3,
  "transports": ["internal", "hybrid"],
  "name": "MacBook Pro (Touch ID)",
  "device_type": "multiDevice",
  "backed_up": true,
  "discoverable": true,
  "date_created": "2026-11-01T09:12:33.000Z",
  "last_used": "2026-11-01T10:05:01.000Z"
}
```
