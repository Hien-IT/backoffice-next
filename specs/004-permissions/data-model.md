# Data model: Phân quyền (004)

Feature này không tạo bảng hay cột (Nguyên tắc II). Mọi bảng dưới đây là bảng hệ thống của Directus 11.17.4; định
nghĩa field và quan hệ lấy từ `directus/packages/system-data/src/{fields,relations}` (đã có trong SchemaOverview của
002). Cách ghi từng dòng nằm ở [contracts/db-writes.md](./contracts/db-writes.md); cache ở
[contracts/cache.md](./contracts/cache.md).

## 1. Thực thể và quan hệ

```text
directus_roles ──parent (m2o, tự tham chiếu)──► directus_roles
      ▲ role (m2o)                                   ▲ role (m2o, nullable)
directus_users                               directus_access ──policy (m2o, NOT NULL, ON DELETE CASCADE)──► directus_policies
      ▲ user (m2o, nullable)                         │                                                          ▲ policy (m2o, CASCADE)
      └──────────────────────────────────────────────┘                                                   directus_permissions
```

| Thực thể | Bảng | Cột feature này đọc hoặc ghi | Ghi chú |
|----------|------|------------------------------|---------|
| User | `directus_users` | mọi cột qua engine; riêng: `email` (duy nhất, không phân biệt hoa thường), `password` (`hash`, `conceal`), `token` (`conceal`, static token, duy nhất), `tfa_secret` (`conceal`, không ghi qua payload), `status`, `role`, `provider`, `external_identifier`, `auth_data`, `last_page`, `last_access` | Field tùy biến (kể cả quan hệ) do Directus tạo cũng đi qua engine |
| Role | `directus_roles` | `id`, `name`, `icon`, `description`, `parent`, `children` (o2m alias), `policies` (o2m alias tới `directus_access`), `users` (o2m alias) | Cây role: `fetchRolesTree` đi `parent` lên gốc |
| Policy | `directus_policies` | `id`, `name`, `icon`, `description`, `ip_access` (csv), `enforce_tfa`, `admin_access`, `app_access`, `permissions` (o2m alias), `users`, `roles` (o2m alias tới `directus_access`) | `ip_access` lưu dạng csv (`cast-csv`) |
| Access | `directus_access` | `id`, `role`, `user`, `policy`, `sort` | `role` và `user` đều `null` = policy public |
| Permission | `directus_permissions` | `id`, `collection`, `action`, `permissions` (json, filter), `validation` (json), `presets` (json), `fields` (csv), `policy` | Dòng quyền tối thiểu của app không có trong bảng (`id: null`, `system: true`) |
| Session | `directus_sessions` | `token`, `user`, `share` | Xóa khi đổi trạng thái, email, mật khẩu, xóa user (FR-053) |
| Activity, Revision | `directus_activity`, `directus_revisions` | như 003 | Ghi cho mọi thao tác có accountability trên năm collection (`accountability: all`) |
| Preset | `directus_presets` | `role` | Xóa theo role khi xóa role |
| Comment, Notification, Version | `directus_comments.user_updated`, `directus_notifications.sender`, `directus_versions.user_updated` | đặt `null` trước khi xóa user | Các khóa ngoại khác của user do DB xử lý (`SET NULL` hoặc `CASCADE` theo migration của Directus) |
| Settings | `directus_settings` | `auth_password_policy`, `public_registration`, `public_registration_verify_email`, `public_registration_role`, `public_registration_email_filter`, `project_name` | Đọc qua `SettingsService.readSingleton({ fields })` của 003 |
| Share | `directus_shares` | `collection`, `item`, `role`, `user_created` | `fetchShareInfo` (cache `share-info`) cho token share |

## 2. Accountability

Như `@directus/types` `Accountability`:

| Trường | Nguồn | Ghi chú |
|--------|-------|---------|
| `user` | claim `id` của JWT, hoặc user của static token, hoặc `null` | share: `null` |
| `role` | claim `role` hoặc `directus_users.role` | share và public: `null` |
| `roles` | `fetchRolesTree(role)` | từ gốc tới role của user; `[]` khi không có role |
| `admin`, `app` | `fetchGlobalAccess({ user, roles, ip })` | tính lại mỗi request từ `directus_access` + `directus_policies`, OR qua cây role và policy gắn vào user; `app ||= admin` |
| `ip`, `userAgent` (≤1024), `origin` | request | `ip` theo `IP_TRUST_PROXY`, `IP_CUSTOM_HEADER` |
| `session` | claim `session` | chế độ session |
| `share` | claim `share` | token share |

Không có trường `policies`: danh sách policy tính khi cần bằng `fetchPolicies` (cache `policies`).

## 3. Thứ tự và cách gộp quyền

1. **Policy của một accountability** (`fetchPolicies`): dòng `directus_access` có `role ∈ roles` (hoặc `role IS NULL AND
   user IS NULL` khi `roles = []`), cộng dòng `user = user`; lọc IP (`filterPoliciesByIp`: không có IP thì bỏ mọi policy
   có `ip_access`); sắp: role gốc → role con → policy gắn vào user và policy public (dòng không có `role`, giữ thứ tự
   đọc).
2. **Permission thô** (`fetchRawPermissions`): dòng `directus_permissions` của các policy đó, sắp theo vị trí policy; thêm
   quyền tối thiểu của app khi `app = true`.
3. **Giải biến động** (`processPermissions` → `parseFilter`, `parsePreset`) trên `permissions`, `validation`, `presets`.
4. **Dùng**:
   - đọc: `getCases` gộp filter của các permission cùng collection, action thành `_or` (filter rỗng = mọi dòng); field là
     hợp; field chỉ có ở permission có filter thành `CASE WHEN`;
   - ghi: `validation` của mọi permission AND với quy tắc field; `presets` gộp nông theo thứ tự policy, payload ghi đè;
   - share: `mergePermissions('intersection' | 'and' | 'or')`.

## 4. Token không lưu DB

| Token | Payload | Sống | Dùng ở |
|-------|---------|------|--------|
| Token mời | JWT HS256 `{ email, scope: "invite" }`, `iss: directus`, ký `SECRET` | `USER_INVITE_TOKEN_TTL` (7d) | `POST /users/invite/accept`; link `<invite_url | PUBLIC_URL/admin/accept-invite>?token=` (chỉ trong log của app mới, không có token, D-27) |
| Token xác minh | JWT HS256 `{ email, scope: "pending-registration" }`, `iss: directus` | `EMAIL_VERIFICATION_TOKEN_TTL` (7d) | `GET /users/register/verify-email?token=`; link `<verification_url | PUBLIC_URL/users/register/verify-email>?token=` |
| Access, refresh, session, static, share | như 003 | | mọi route |

## 5. Trạng thái

### User (`directus_users.status`)

```text
POST /users/invite ──► invited ──POST /users/invite/accept (mật khẩu, token)──► active
POST /users/register (verify_email = true) ──► unverified ──GET /users/register/verify-email──► active
POST /users/register (verify_email = false) ──► active
xóa role của user ──► suspended (role = null)
PATCH /users/:pk { status } ──► bất kỳ (draft, suspended, archived, active...); khác active thì xóa mọi session
```

- Chỉ `active` đăng nhập được (003). Đếm giới hạn user chỉ tính `active`.
- `invited` mời lại: đổi `role` nếu khác; trạng thái khác: không đổi.
- `unverified` đăng ký lại: không tạo, chỉ ghi lại log xác minh.

### Role, policy, access khi xóa

```text
DELETE role ─► xóa directus_access (role) ─► xóa directus_presets (role) ─► users: status = suspended, role = null
            ─► children: parent = null ─► xóa role ─► kiểm còn admin (422 nếu hết) ─► xóa cache
DELETE policy ─► xóa policy (DB cascade: directus_access, directus_permissions) ─► kiểm còn admin ─► xóa cache
DELETE access ─► xóa dòng ─► kiểm còn admin, giới hạn user ─► xóa cache
```

### Cờ kiểm toàn vẹn (`UserIntegrityCheckFlag`, chạy trong transaction sau khi ghi)

| Thao tác | Cờ |
|----------|----|
| Tạo user `status` thiếu hoặc `active` | `UserLimits` |
| Sửa user: `role` | `All`; `status = active` → `UserLimits`; `status` khác → `All` |
| Xóa user | `validateRemainingAdminUsers({ excludeUsers })` trước khi xóa |
| Sửa role `parent`, xóa role | `All` |
| Sửa policy `admin_access` | `RemainingAdmins` (+ `All` khi đặt `true`); `app_access` → `UserLimits` |
| Xóa policy | `All` |
| Tạo access | `UserLimits`; sửa, xóa access | `All` |

## 6. Redis (dùng chung với Directus)

| Key hoặc kênh | Ai ghi | Nội dung |
|---------------|--------|----------|
| `permissions:<ns>-<hash>` với `ns ∈ {policies, roles-tree, raw-permissions, global-access, global-access-roles, global-access-user, policies-ip-access, share-info}` | `withCache` (002) | Giá trị JSON giống Directus; TTL `CACHE_SYSTEM_TTL`; namespace `REDIS_PERMISSIONS_NAMESPACE` |
| `<CACHE_NAMESPACE>:filter-context-<CURRENT_USER | CURRENT_ROLE | CURRENT_ROLES | CURRENT_POLICIES>-<hash>` | `fetchDynamicVariableData`, khi `CACHE_ENABLED` | Dữ liệu field của biến động, nén như `setCacheValue`; TTL `CACHE_TTL` |
| `<CACHE_NAMESPACE>:*` (cache dữ liệu, response cache của Directus) | app mới chỉ **xóa** (FR-083) | Directus ghi; app mới chưa đọc (D-11) |
| `<CACHE_NAMESPACE>_system:*` | `clearSystemCache` (002) | xóa ở các điểm FR-082 |
| Kênh `schemaChanged`, `multi-cache` | `clearSystemCache`, `@backoffice/memory` | như 002 |
| `rlflx:<ip>` (limiter đăng ký, prefix theo `RATE_LIMITER_REGISTRATION_*`) | `POST /users/register` | khi `RATE_LIMITER_STORE=redis` |

## 7. Trạng thái trong process (dựng lại được, Nguyên tắc VII)

| Thứ | Dựng từ | Xóa qua |
|-----|---------|---------|
| Lớp local của cache quyền (100 key) | Redis hoặc DB | kênh `multi-cache` |
| SchemaOverview (002) | DB | kênh `schemaChanged` |
| Instance rate limiter đăng ký | env, tạo ở request đầu | — (số đếm ở Redis khi store `redis`) |
