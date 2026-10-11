# Contract: Cache quyền và các điểm xóa cache (004)

Mốc: Directus 11.17.4. Cache quyền (`permissions/cache.ts`, `with-cache.ts`) đã port ở 002. Feature này thêm namespace
còn thiếu và mọi điểm xóa cache mà service của Directus gọi (FR-080 đến FR-083, SC-003, SC-004).

## 1. Namespace của cache quyền

Key Redis: `<REDIS_PERMISSIONS_NAMESPACE | permissions>:<ns>-<getSimpleHash(JSON.stringify(args))>`. Lớp local: LRU 100
key (có Redis) hoặc 500 key (không Redis). TTL Redis: `CACHE_SYSTEM_TTL` (không đặt thì không hết hạn).

| `ns` | Hàm Directus | `args` đưa vào hash | Giá trị | Có từ |
|------|--------------|---------------------|---------|-------|
| `policies` | `fetchPolicies` | `{ roles, user, ip }` | `string[]` id policy đã sắp | 002 |
| `raw-permissions` | `fetchRawPermissions` | `{ policies, action?, collections? (sorted), accountability: { app }?, bypassMinimalAppPermissions? }` | `Permission[]` | 002 (004 thêm `withAppMinimalPermissions`, đọc qua `PermissionsService`) |
| `roles-tree` | `fetchRolesTree` | `{ start }` | `string[]` | 003 |
| `global-access` | `fetchGlobalAccess` | `{ user, roles, ip }` (`ip` lấy từ tham số context, mọi chỗ gọi của Directus không truyền nên không vào hash) | `{ app, admin }` | 003 |
| `global-access-roles` | `fetchGlobalAccessForRoles` | `{ roles, ip }` | `{ app, admin }` | 003 |
| `global-access-user` | `fetchGlobalAccessForUser` | `{ user, ip }` | `{ app, admin }` | 003 |
| `policies-ip-access` | `fetchPoliciesIpAccess` | `{ user, roles }` | `string[][]` | 004 (dùng ở `getCacheKey` của response cache, 005; port cùng module) |
| `share-info` | `fetchShareInfo` | `{ shareId }` | `{ collection, item, role, user_created: { id, role } }` | 004 |

Giữ nguyên chỗ Directus không đưa IP vào hash của `global-access` (FR-080): kết quả `admin`, `app` của một cặp
`user, roles` được dùng lại cho mọi IP cho tới khi cache bị xóa, như Directus.

## 2. Cache dữ liệu cho biến động

Chỉ khi `CACHE_ENABLED=true` (có `getCache().cache`, Keyv trên `CACHE_STORE`, namespace `CACHE_NAMESPACE`):

| Key | Hash của | Giá trị |
|-----|----------|---------|
| `filter-context-CURRENT_USER-<hash>` | `{ user, fields }` | `UsersService.readOne(user, { fields })` không accountability |
| `filter-context-CURRENT_ROLE-<hash>` | `{ role, fields }` | `RolesService.readOne` |
| `filter-context-CURRENT_ROLES-<hash>` | `{ roles, fields }` | `RolesService.readMany` |
| `filter-context-CURRENT_POLICIES-<hash>` | `{ policies, fields }` | `PoliciesService.readMany` (`id` luôn có) |

Ghi bằng `setCacheValue` (nén), đọc bằng `getCacheValue`, TTL `CACHE_TTL` (cùng hàm của `cache.ts`, port ở feature này).
`fields` là tập field mà `extractRequiredDynamicVariableContext` thu từ `permissions`, `validation`, `presets` của mọi
permission của accountability (và `validation` của `directus_fields` khi ghi).

## 3. Điểm xóa cache (FR-082, FR-083)

Ký hiệu: **S** = `clearSystemCache()` (cache hệ thống `<CACHE_NAMESPACE>_system`, schema trong process, cache quyền,
bus `schemaChanged`); **P** = chỉ `clearPermissionCache()`; **D** = `cache.clear()` của cache dữ liệu (`CACHE_NAMESPACE`,
response cache của Directus; app mới xóa dù không đọc, D-11); **A** = `shouldClearCache`: xóa D khi
`CACHE_AUTO_PURGE=true`, collection không trong `CACHE_AUTO_PURGE_IGNORE_LIST` và lệnh không có `autoPurgeCache: false`.

| Service | Thao tác | Xóa | Điều kiện |
|---------|----------|-----|-----------|
| `ItemsService` (mọi collection) | create, update, delete | A | sau khi ghi, ngoài transaction |
| `AccessService` | createOne | S + D | luôn (sau create) |
| | updateMany, deleteMany | S + D | luôn |
| `PoliciesService` | createOne | P | luôn |
| | updateMany | S + D | khi payload có `admin_access`, `app_access`, `ip_access` hoặc `enforce_tfa` |
| | deleteMany | S + D | luôn |
| `PermissionsService` | createOne, createMany, updateBatch, updateMany, upsertMany, deleteMany | S + D | luôn |
| `RolesService` | updateMany | S + D | khi payload có `parent` |
| | deleteMany | S + D | luôn |
| `UsersService` | updateMany | S + D | khi `role` thay đổi (đã có từ 003) |
| `SharesService` (010) | update, delete | P | — |
| `PATCH /users/me/track/page` | updateOne với `autoPurgeCache: false` | không | — |

`createMany`, `updateBatch`, `updateByQuery`, `deleteByQuery`, `deleteOne` của lớp con gọi `createOne`, `updateMany`,
`deleteMany` của lớp con, nên cũng đi qua các điểm trên. Ghi lồng quan hệ vào năm collection từ payload của collection
khác đi qua `getService()` nên cũng vậy.

## 4. Thông điệp bus

- `schemaChanged` (kênh `<REDIS_BUS_NAMESPACE | directus:bus>`): như 002, phát trong `clearSystemCache`.
- `multi-cache`: `@backoffice/memory` phát ở mỗi `set`, `delete`, `clear` của cache quyền để instance khác bỏ bản local.

## 5. Kiểm (SC-003, SC-004, FR-102)

- `permissions-cache.test.ts` (002, mở rộng): với cùng accountability và cache trống, tập key `permissions:*` và giá
  trị hai app ghi trùng nhau cho 8 namespace.
- Ca dùng chéo: ghi ở A, request đầu tiên ở B dùng quyền mới (20 lần mỗi chiều); kiểm key `permissions:*` và
  `<CACHE_NAMESPACE>:*` bị xóa sau mỗi thao tác ở bảng §3.
