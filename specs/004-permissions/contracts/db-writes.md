# Contract: Dữ liệu ghi vào DB (004)

Mỗi dòng dưới đây là thứ app mới ghi cho một request, giống Directus 11.17.4 cùng request (FR-090, SC-005). Giá trị
sinh ngẫu nhiên (uuid, `id` tự tăng, thời điểm, salt của hash, token) khác nhau giữa hai bên; test so kiểu, định dạng
và khoảng thời gian (research R6 của 003, helper `db-effects`). Mọi lần ghi đi qua `ItemsService` đầy đủ (engine của
feature này): special field, activity, revision, kiểm toàn vẹn, xóa cache như Directus.

## 1. Quy tắc chung của `ItemsService` (áp cho năm collection và mọi collection ghi lồng)

1. `processPayload` (kiểm quyền, preset, validation) cho từng tầng; `PayloadService.processValues('create' | 'update')`
   (special: `uuid`, `hash`, `conceal`, `cast-boolean`, `cast-json`, `cast-csv`, `date-created`, `date-updated`,
   `user-created`, `user-updated`, `role-created`, `role-updated`, `m2o`, `o2m`, `m2m`, `m2a`...).
2. Trong một transaction: `processM2O`/`processA2O` (ghi cha trước, lấy khóa), `INSERT`/`UPDATE` dòng chính,
   `processO2M` (ghi con sau: tạo, sửa, gỡ hoặc xóa theo `relation.meta.one_deselect_action`), activity, revision.
3. Activity: một dòng mỗi item (`action` `create` | `update` | `delete`, `user`, `ip`, `user_agent`, `origin`,
   `collection`, `item`), khi có accountability và không `skipTracking`.
4. Revision: khi collection có `accountability: all` (năm collection đều vậy) và có activity: `activity`,
   `collection`, `item`, `data` (snapshot đọc lại, field không quan hệ, `conceal` thành `**********`), `delta`
   (payload đã xử lý), `parent` (revision của item cha khi ghi lồng), `version` `null`.
5. `validateUserCountIntegrity` theo cờ của data-model.md §5, trong cùng transaction, sau khi ghi.
6. Sau transaction: `shouldClearCache` (A) và các điểm S, P, D của contracts/cache.md §3.
7. Không có accountability (`track/page`, nhận lời mời, đăng ký, xác minh, `fetchDynamicVariableData`): không activity,
   không revision.

## 2. `/users`

| Luồng | Ghi |
|-------|-----|
| `POST /users` | kiểm email (định dạng, duy nhất không phân biệt hoa thường, cả trong lô), `checkPasswordPolicy`; `INSERT directus_users` (`id` uuid, `password` argon2 `HASH_*`, `status` mặc định `active` theo DB), cờ `UserLimits` khi `status` thiếu hoặc `active`; activity `create`; revision |
| `PATCH /users/:pk`, `PATCH /users`, `PATCH /users/me` | từ chối `tfa_secret` (mọi người), `provider`, `external_identifier` (không admin); đổi `provider`/`external_identifier` thì `auth_data = null`; `UPDATE directus_users`; activity `update`; revision; sau đó: `status ≠ active` → `DELETE directus_sessions WHERE user IN keys`; đổi `email` hoặc `password` → `DELETE directus_sessions WHERE user IN keys AND token ≠ <session của request>`; đổi `role` → S + D |
| `PATCH /users/me/track/page` | `UPDATE directus_users SET last_page` (không accountability): không activity, không revision, không xóa cache |
| `DELETE /users/:pk`, `DELETE /users` | `validateRemainingAdminUsers({ excludeUsers: keys })` (ném sau kiểm quyền); `UPDATE directus_comments SET user_updated = NULL WHERE user_updated IN keys`; `UPDATE directus_notifications SET sender = NULL ...`; `UPDATE directus_versions SET user_updated = NULL ...`; `DELETE directus_users`; activity `delete` mỗi item; `DELETE directus_sessions WHERE user IN keys`. Khóa ngoại khác theo DDL của Directus (`SET NULL`, `CASCADE`) |
| `POST /users/invite` | mỗi email: chưa có → `createOne({ email, role, status: 'invited' })` (như `POST /users`, kèm `preMutationError` của `invite_url`); đã `invited` khác role → `updateOne(id, { role })`; khác → không ghi. Log `warn` thay email (D-27) |
| `POST /users/invite/accept` | `UsersService` không accountability `.updateOne(id, { password, status: 'active' })`: hash argon2, `checkPasswordPolicy`, cờ `UserLimits`; không activity; xóa session của user (đổi mật khẩu; không có session hiện tại) |
| `POST /users/register` | mới: `createOne({ email, password, role: public_registration_role, status: verify ? 'unverified' : 'active', first_name, last_name })` không accountability; đã `unverified`: không ghi (log lại); khác: không ghi |
| `GET /users/register/verify-email` | `updateOne(id, { status: 'active' })` không accountability; cờ `UserLimits` |
| `POST /users/me/tfa/enable` | `ItemsService('directus_users', accountability của request).updateOne(user, { tfa_secret })`: kiểm quyền `update` field `tfa_secret` (không admin phải có quyền); activity, revision (delta `tfa_secret: **********`) |
| `POST /users/me/tfa/disable`, `POST /users/:pk/tfa/disable` | `updateOne(user, { tfa_secret: null })` qua `ItemsService` với accountability của request; activity, revision |

## 3. `/roles`

| Luồng | Ghi |
|-------|-----|
| `POST /roles` | `INSERT directus_roles` (`id` uuid); activity, revision; ghi lồng `policies` (o2m tới `directus_access`), `users`, `children` theo §1 |
| `PATCH /roles/:pk`, `PATCH /roles` | có `parent`: `validateRoleNesting` (self, descendant) trước; `UPDATE`; activity, revision; cờ `All`; S + D |
| `DELETE /roles/:pk`, `DELETE /roles` | trong một transaction: `AccessService.deleteByQuery({ filter: { role: { _in: keys } } }, { bypassLimits: true })`; `PresetsService.deleteByQuery({ filter: { role: { _in: keys } } })`; `UsersService.updateByQuery({ filter: { role: { _in: keys } } }, { status: 'suspended', role: null })` (activity, revision cho từng user, cờ `All`); `RolesService.updateByQuery({ filter: { parent: { _in: keys } } }, { parent: null })`; `DELETE directus_roles` (activity `delete`); kiểm còn admin; S + D. Mọi bước chạy với accountability của người gọi (không admin phải có quyền tương ứng) |

## 4. `/policies`

| Luồng | Ghi |
|-------|-----|
| `POST /policies` | kiểm `ip_access` (`null`, `[]`, mảng IP/dải/CIDR; `*`, mask → `400`); `INSERT directus_policies` (`ip_access` lưu csv); ghi lồng `permissions` (o2m: tạo, sửa, xóa dòng `directus_permissions`), `roles`, `users` (o2m tới `directus_access`); activity, revision (kể cả của dòng con, `parent` trỏ revision cha); P |
| `PATCH /policies/:pk`, `PATCH /policies` | kiểm `ip_access`; `UPDATE`; ghi lồng như trên (cách `CreatePermission` của blackbox); cờ theo data-model §5; S + D khi đổi bốn cờ |
| `DELETE /policies/:pk`, `DELETE /policies` | `DELETE directus_policies` (DB cascade `directus_access`, `directus_permissions`, không activity cho dòng cascade); activity `delete`; cờ `All`; S + D |

## 5. `/access`

| Luồng | Ghi |
|-------|-----|
| `POST /access` | `INSERT directus_access` (`id` uuid; `role`, `user` tùy ý, `policy` bắt buộc theo DB `NOT NULL`); activity, revision; cờ `UserLimits`; S + D |
| `PATCH /access…` | `UPDATE`; activity, revision; cờ `All`; S + D |
| `DELETE /access…` | `DELETE`; activity; cờ `All`; S + D |

## 6. `/permissions`

| Luồng | Ghi |
|-------|-----|
| `POST`, `PATCH`, `DELETE` | `INSERT`/`UPDATE`/`DELETE directus_permissions` (`permissions`, `validation`, `presets` lưu JSON; `fields` csv); activity, revision; S + D ở mọi thao tác |

## 7. Request không ghi DB (bổ sung `db-unchanged`, `readonly-account`, FR-091)

`GET`/`SEARCH` của năm endpoint (admin, user thường, public), `GET /users/me`, `GET /roles/me`,
`GET /policies/me/globals`, `GET /permissions/me`, `GET /permissions/me/<c>/<pk>`, `OPTIONS`, mọi request bị chặn
`403`/`401`/`400`/`404`/`422` trước bước ghi, `POST /users/register` với email đã có (chỉ chờ), `POST /users/invite` cho
user `active`.
