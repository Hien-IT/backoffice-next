# Feature Specification: Phân quyền (users, roles, policies, access, permissions)

**Feature Branch**: `004-permissions`
**Created**: 2026-10-11
**Status**: Done
**Duyệt khác biệt**: tech lead đã duyệt D-27 đến D-31, R-01 đến R-06 và các sửa bảng của spec 001, 003 ngày 2026-10-11 (Nguyên tắc X; quy trình không có PR)
**Input**: User description: "App mới áp dụng đúng mô hình phân quyền của Directus 11: users, roles (có cây role lồng nhau), policies, access (gán policy cho role hoặc user), permissions theo collection và action (create, read, update, delete, share) với filter điều kiện, danh sách field, validation, preset, cùng các cờ admin_access, app_access, ip_access, enforce_tfa. Accountability của mỗi request được tính giống Directus, kể cả biến động $CURRENT_USER, $CURRENT_ROLE, $CURRENT_ROLES, $CURRENT_POLICIES, $NOW. Cung cấp các endpoint /users, /roles, /policies, /access, /permissions (gồm /permissions/me và /policies/me/globals), CRUD giống Directus. /users/invite tạo user trạng thái invited giống Directus nhưng không gửi email, chỉ ghi log. Kết quả phân quyền được cache dùng chung Redis với Directus. Tham chiếu directus/api/src/permissions và các service users, roles, policies, access, permissions. Tiêu chí chấp nhận: với cùng user và dữ liệu, mọi request đọc và ghi bị chặn hoặc cho phép giống hệt Directus."

**Tham chiếu Directus** (chỉ đọc):

- Module quyền: `directus/api/src/permissions/` gồm `cache.ts`, `lib/` (`fetch-policies`, `fetch-permissions`,
  `fetch-roles-tree`, `with-app-minimal-permissions`), `modules/` (`fetch-accountability-collection-access`,
  `fetch-accountability-policy-globals`, `fetch-allowed-collections`, `fetch-allowed-field-map`, `fetch-allowed-fields`,
  `fetch-global-access`, `fetch-inconsistent-field-map`, `fetch-policies-ip-access`, `process-ast`, `process-payload`,
  `validate-access`, `validate-remaining-admin`), `utils/` (`with-cache`, `fetch-raw-permissions`,
  `process-permissions`, `extract-required-dynamic-variable-context`, `fetch-dynamic-variable-data`,
  `get-permissions-for-share`, `fetch-share-info`, `merge-permissions`, `merge-fields`, `filter-policies-by-ip`,
  `default-permission`, `get-unaliased-field-key`).
- Quyền tối thiểu của app: `directus/packages/system-data/src/app-access-permissions/app-access-permissions.yaml`,
  `schema-access-permissions.yaml`.
- Biến động trong filter và preset: `directus/packages/utils/shared/parse-filter.ts` (`parseFilter`, `parsePreset`),
  `parse-now`, `adjust-date`, `get-with-arrays`.
- Quyền toàn cục và cây role: `directus/packages/utils/node/fetch-global-access/`, `fetch-roles-tree.ts`,
  `ip-in-networks.ts`.
- Route: `directus/api/src/controllers/users.ts`, `roles.ts`, `policies.ts`, `access.ts`, `permissions.ts`,
  `metrics.ts`, `server.ts`; middleware `authenticate.ts`, `validate-batch.ts`, `respond.ts`,
  `rate-limiter-registration.ts`.
- Service: `directus/api/src/services/users.ts`, `roles.ts`, `policies.ts`, `access.ts`, `permissions.ts`, `items.ts`,
  `payload.ts`, `meta.ts`, `mail/` (chỗ gửi mail), `cache.ts` (`clearSystemCache`),
  `utils/validate-user-count-integrity.ts`, `utils/fetch-user-count/`, `telemetry/utils/check-user-limits.ts`,
  `utils/get-accountability-for-token.ts`, `utils/get-accountability-for-role.ts`.
- Engine truy vấn mà kiểm quyền đọc gắn vào: `directus/api/src/database/get-ast-from-query/`, `database/run-ast/`
  (gồm `utils/apply-case-when.ts`), `utils/sanitize-query.ts`, `utils/validate-query.ts` (phạm vi: FR-040).
- Field và collection hệ thống: `directus/packages/system-data/src/fields/{users,roles,policies,access,permissions}.yaml`,
  `collections/collections.yaml` (5 collection này có `accountability: all`).

**Đã có từ feature 001 đến 003** (trong `apps/api/src`): `permissions/cache.ts` và `utils/with-cache.ts` (port đủ,
cùng namespace Redis và công thức key); 6 namespace cache `policies`, `raw-permissions`, `roles-tree`,
`global-access`, `global-access-roles`, `global-access-user`; `fetchPolicies` và `fetchRawPermissions` đọc thẳng bằng
Knex (chưa qua `AccessService`, `PermissionsService`, chưa có `withAppMinimalPermissions`); `fetchPermissions` chưa
giải biến động và chưa xử lý share; `createDefaultAccountability`, `filterPoliciesByIp`, `fetchAllowedFieldMap`,
`validateRemainingAdminCount`, `fetchUserCount`, `validateUserCountIntegrity`; middleware `authenticate` (port đủ)
nhưng chỉ chạy cho `/auth/*` và `POST /users/me/tfa/generate`, các path khác chạy `publicAccountability` (D-10, D-18);
`ItemsService` rút gọn (chỉ admin hoặc không accountability, field phẳng, lọc theo khóa chính, chưa có delete);
`PayloadService` chưa xử lý quan hệ; `UsersService` có tạo, sửa, đặt lại mật khẩu, chưa có đọc, xóa, mời, đăng ký;
`UsersController` chỉ có `POST /users/me/tfa/generate`. Chưa có `RolesService`, `PoliciesService`, `AccessService`,
`PermissionsService`.

**Bộ test blackbox liên quan** (`directus/tests/blackbox`): không có file riêng cho CRUD users, roles, policies,
access. `common/common.test.ts` tạo role, policy, access, user qua API (gồm `filter`, `fields`); `common/functions.ts`
(`CreateRole`, `CreateUser`, `CreatePolicy`, `CreatePermission` ghi lồng `permissions` qua `PATCH /policies/:id`,
`DeletePermission`) là fixture của mọi bộ test khác;
`tests/db/routes/permissions/check-item-permissions.test.ts` (`/permissions/me/:collection/:id?`);
`tests/db/routes/permissions/cache-purge.test.ts` (mọi thao tác ghi `/permissions` xóa cache dữ liệu, cần response
cache của feature 005); `tests/db/app/cache.test.ts` (`PATCH /users/me/track/page` không xóa cache);
`tests/common/auth/ldap.test.ts`, `login.test.ts`, `refresh.test.ts` (phần `/users/me` hoãn từ feature 003).

## Clarifications

### Session 2026-10-11

- Q: Directus kiểm quyền đọc ngay trong engine truy vấn (gắn filter quyền vào cây truy vấn, `CASE WHEN` cho field theo
  quyền) và kiểm quyền ghi theo từng tầng của payload lồng; engine này theo lộ trình thuộc feature 005. Feature 004 làm
  tới đâu? → A: Port đủ engine đọc và ghi lồng quan hệ ở feature 004, dùng cho năm collection hệ thống; gỡ luôn D-09.10
  (bật, tắt TFA). Feature 005 chỉ còn route `/items`, singleton, response cache, `export`, event, bus `websocket.event`
  và bộ blackbox items, query, relational (FR-040, FR-048).
- Q: Engine đọc, ghi port ở 004 được kiểm chứng thế nào khi bộ blackbox items, query, relational còn ở 005? → A: Port
  unit test của engine từ Directus (`get-ast-from-query`, `run-ast`, `apply-query`, `process-ast`, `process-payload`,
  `validate-access`, `parse-filter`, `payload`); parity trên năm collection hệ thống và field tùy biến (kể cả quan hệ)
  của `directus_users`; chạy lại toàn bộ parity của 003 với engine mới ngay ở 004 (thay cho hẹn ở 005). Blackbox
  items, query, relational vẫn ở 005 (FR-104, FR-105).
- Q: SC-008 (app Directus trỏ vào app mới) kiểm bằng tay hay tự động? → A: Tự động: thêm reverse proxy vào môi
  trường đối chiếu (định tuyến theo danh sách route ở câu dưới) và test Playwright chạy app Directus qua proxy ở CI,
  là cổng mới chặn merge (FR-106, SC-008).
- Q: Proxy định tuyến thế nào khi app Directus còn gọi các route chưa làm (`/collections`, `/settings`,
  `/extensions`... của 006, 008, 010)? → A: Định tuyến theo danh sách route đã làm: chỉ route của 001 đến 004
  (`/auth`, `/server`, `/metrics`, `/users`, `/roles`, `/policies`, `/access`, `/permissions`) về app mới; mọi path
  khác, kể cả `/admin`, về Directus. Mỗi feature sau thêm route của mình vào danh sách (FR-106).
- Q (khi lập plan): Ghi lồng và đọc lồng từ năm collection vào collection hệ thống chưa có service riêng (ví dụ
  `avatar` → `directus_files`) xử lý thế nào khi `getService()` của Directus trả service riêng? → A: Dùng
  `ItemsService` chung cho các collection đó tới khi feature tương ứng port service (D-31); `directus_*` không có
  service ở Directus vẫn bị cấm như Directus.
- Q (rà checklist): Key cache `global-access` của Directus không chứa IP, nên cờ `admin`, `app` tính ở request đầu tiên
  được dùng cho mọi IP (chặn `ip_access` của policy admin có thể bị vô hiệu). App mới làm gì? → A: Tái tạo y hệt (cùng
  key, cùng hành vi), ghi là rủi ro chấp nhận R-01, cần tech lead duyệt.
- Q (rà checklist): Gặp thêm hành vi Directus không an toàn trong lúc làm thì sao? → A: Luôn tái tạo; ghi vào bảng "Rủi ro
  chấp nhận" kèm bằng chứng (file, dòng của Directus); chỉ lệch khi chủ dự án yêu cầu (Assumptions).
- Q (rà checklist): Quy tắc phủ của ma trận quyền (SC-001)? → A: Tích đầy đủ năm chiều đã liệt kê ở FR-101 trên Postgres;
  bộ rút gọn trên MySQL, SQLite (mỗi giá trị của mỗi chiều ít nhất một lần); chia job CI để mỗi job dưới 60 phút.
- Q (khi analyze): Ma trận đủ 19.500 ô chạy lúc nào, khi chạy ở mọi lần push có thể vượt hạn mức phút GitHub Actions? →
  A: Mỗi lần push chạy một shard xoay vòng cộng bộ rút gọn; đủ ma trận chạy ở workflow riêng (hằng tuần và bấm tay), bắt
  buộc xanh trước khi đóng feature và trước mỗi lần nâng phiên bản Directus (SC-001).

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là client đang gọi Directus (gọi API bằng token của user, static token, share hoặc không
token), quản trị viên (quản lý user, role, policy, quyền qua API hoặc qua app Directus trỏ vào app mới) và đội vận hành
(chạy Directus và app mới song song sau một load balancer, cùng DB, Redis và file `.env`).

### User Story 1 - Mọi request chạy với đúng accountability như Directus (Priority: P1)

Mọi route của app mới (cũ và mới) nhận token theo cách của Directus và tính accountability giống Directus: user, role,
cây role từ gốc tới role của user, cờ `admin` và `app` tính lại từ policy ở mỗi request, IP, user agent, origin,
session, share. Request không token chạy với quyền public. Route có từ feature 001 (`/server/*`, `/metrics`) không còn
bỏ qua token (gỡ D-10).

**Why this priority**: Mọi quyết định cho phép hay chặn đều bắt đầu từ accountability. Tính sai ở bước này thì mọi
request sau đều sai. Đây cũng là điều kiện để gỡ D-10, D-18 đã hẹn từ feature 001.

**Independent Test**: Tạo các user có cấu hình khác nhau (không role, role lồng ba tầng, policy gắn trực tiếp vào user,
policy admin, policy có `ip_access`). Gọi `GET /users/me`, `GET /roles/me`, `GET /policies/me/globals`,
`GET /server/info`, `GET /server/health`, `GET /metrics` ở hai app với token của từng user, với static token, với
token share và không token. So status, body và header.

**Acceptance Scenarios**:

1. **Given** user có role con `C` với cha `B`, ông `A`, **When** gọi `GET /roles/me`, **Then** trả cả ba role theo
   thứ tự từ gốc `A`, `B`, `C`, giống Directus; nếu user không được đọc `directus_roles` thì trả `[{id}]` cho từng role.
2. **Given** policy có `admin_access = true` chỉ gắn trực tiếp vào user (không qua role), **When** user gọi bất kỳ
   route nào, **Then** user được coi là admin, dù JWT có claim `admin_access: false` (cờ tính lại từ policy ở mỗi
   request).
3. **Given** policy `admin_access = true` vừa bị gỡ khỏi role của user ở Directus, **When** user gọi app mới với access
   token cũ còn hạn, **Then** user không còn quyền admin ngay ở request kế tiếp.
4. **Given** token hợp lệ của admin, **When** gọi `GET /server/info`, `GET /server/health`, `GET /metrics` ở app mới,
   **Then** trả giống Directus (thông tin dành cho user đăng nhập hoặc admin, chi tiết health cho admin, `/metrics`
   cho admin không cần `METRICS_TOKENS`). Không còn dòng log cảnh báo "token bị bỏ qua".
5. **Given** token sai chữ ký hoặc hết hạn, **When** gọi `/server/info` hoặc `/metrics`, **Then** trả `403
   INVALID_TOKEN` hoặc `401 TOKEN_EXPIRED` như Directus, thay vì trả như request public.
6. **Given** token share (role `null`, có `share`), **When** gọi `GET /users/me`, **Then** trả `{"data": {"share":
   "<id>"}}` giống Directus.
7. **Given** user bị chuyển từ role `A` sang role `B` ở Directus, **When** gọi app mới bằng access token cấp trước khi
   đổi (còn hạn), **Then** `role` và `roles` vẫn theo claim cũ (cây role của `A`), `admin`, `app` tính lại theo user và
   cây role `A`, giống Directus; sau khi refresh (token mới có `role: B`) thì theo `B`. Với static token, request kế tiếp
   dùng ngay `B`.

---

### User Story 2 - Quyền đọc và ghi được áp dụng giống hệt Directus (Priority: P1)

Quản trị viên đặt quyền cho từng collection và action (`create`, `read`, `update`, `delete`, `share`) với filter điều
kiện, danh sách field, validation và preset, có thể dùng biến động `$CURRENT_USER`, `$CURRENT_ROLE`, `$CURRENT_ROLES`,
`$CURRENT_POLICIES`, `$NOW`. Một user có nhiều policy (qua cây role, gắn trực tiếp, policy public). Với cùng user và
cùng dữ liệu, mỗi request đọc và ghi ở app mới bị chặn hoặc được cho phép giống hệt Directus: cùng status, cùng mã lỗi
và message, cùng dòng và field trả về, cùng dữ liệu ghi xuống DB.

**Why this priority**: Đây là tiêu chí chấp nhận của feature. Một chỗ cho phép sai là lỗ hổng bảo mật; một chỗ chặn
sai là người dùng không làm được việc khi request rơi vào app mới.

**Independent Test**: Chạy ma trận quyền (FR-101) ở hai app trên cùng DB: mỗi ô là một tổ hợp accountability, cấu hình
quyền, action và request. So status, body, và tác động DB (với request ghi).

**Acceptance Scenarios**:

1. **Given** user chỉ có quyền `read` `directus_users` với filter `{"id": {"_eq": "$CURRENT_USER"}}` và field
   `id, email`, **When** gọi `GET /users`, **Then** chỉ trả dòng của chính user với hai field đó; **When** gọi
   `GET /users?fields=password`, **Then** trả `403 FORBIDDEN` với message `You don't have permission to access field
   "password" in collection "directus_users" or it does not exist. Queried in root.`
2. **Given** user có hai policy cùng quyền `read` một collection: policy 1 không filter, field `id, name`; policy 2
   filter `status = published`, field `id, name, secret`, **When** đọc danh sách, **Then** mọi dòng được trả, và
   `secret` chỉ có giá trị ở dòng `published`, là `null` ở dòng khác, giống Directus.
3. **Given** quyền `read` filter `date_created _gte $NOW(-1 day)`, **When** đọc, **Then** tập dòng trả về giống
   Directus tại cùng thời điểm.
4. **Given** quyền `create` có preset `{"status": "draft"}` ở policy cha và `{"status": "review"}` ở policy role con,
   **When** tạo item không gửi `status`, **Then** item có `status = review` (policy sau thắng); **When** gửi
   `status = published`, **Then** payload thắng preset; validation của mọi policy đều phải đạt (AND), giống Directus.
5. **Given** quyền `update` filter theo `$CURRENT_USER.department`, **When** sửa item ngoài phòng ban của mình,
   **Then** trả `403 FORBIDDEN` với cùng message như Directus, và DB không đổi.
6. **Given** user không có quyền `read` một collection, **When** đọc một item theo id, **Then** trả `403 FORBIDDEN`
   message `You don't have permission to access collection "<c>" or it does not exist. Queried in root.`; **Given** user
   có quyền `read` nhưng filter loại dòng đó, **Then** message `You don't have permission to access this.`; cả hai dù
   item có tồn tại hay không, giống Directus (đo ở T055).
7. **Given** policy có `ip_access` không chứa IP của request, **When** user gửi request, **Then** permission của policy
   đó không được dùng (kể cả khi IP không xác định được); cờ `admin`, `app` theo bảng FR-016 (khác ở R-01, R-02), giống
   Directus.
8. **Given** user có `app_access` (qua policy), **When** gọi `GET /permissions`, **Then** kết quả có thêm các dòng
   quyền tối thiểu của app (`id: null`, `system: true`), giống Directus.

---

### User Story 3 - Quản trị role, policy, access và permission qua API (Priority: P1)

Quản trị viên (hoặc app Directus trỏ vào app mới) tạo, đọc, sửa, xóa role (kể cả cây role lồng nhau), policy (cờ
`admin_access`, `app_access`, `ip_access`, `enforce_tfa`), access (gán policy cho role, cho user, hoặc cho public) và
permission qua `/roles`, `/policies`, `/access`, `/permissions`, với cùng request, response, lỗi và tác động DB như
Directus. Thay đổi quyền ở app này có hiệu lực ngay ở app kia.

**Why this priority**: Không có các endpoint này thì quyền chỉ quản lý được ở Directus, và bộ fixture blackbox
(`CreateRole`, `CreatePolicy`, `CreatePermission`) không chạy được trên app mới.

**Independent Test**: Gửi cùng chuỗi request CRUD tới hai app (tạo role cha và con, tạo policy, gán policy, thêm
permission lồng trong policy, sửa, xóa). So response, các dòng `directus_roles`, `directus_policies`,
`directus_access`, `directus_permissions`, `directus_activity`, `directus_revisions`. Sau mỗi thao tác ghi ở một app,
gọi app kia bằng token của user bị ảnh hưởng: quyền mới có hiệu lực.

**Acceptance Scenarios**:

1. **Given** role `A` là cha của `B`, **When** đặt `parent` của `A` thành `B`, **Then** trả `400` message `A role
   cannot have a parent that is already a descendant of itself`; đặt `parent` của `A` thành `A` thì message `A role
   cannot be a parent of itself`.
2. **Given** role có user và role con, **When** xóa role, **Then** các dòng access của role bị xóa, preset của role bị
   xóa, user của role chuyển `status = suspended`, `role = null`, role con có `parent = null`, giống Directus.
3. **Given** policy `admin_access = true` là nguồn quyền admin duy nhất của mọi user `active`, **When** xóa policy đó,
   gỡ access của nó, hoặc đặt `admin_access = false`, **Then** trả `422 UNPROCESSABLE_CONTENT` message `Cannot remove
   the last admin user from the system`, DB không đổi.
4. **Given** `ip_access` chứa `*` hoặc giá trị không phải IP, dải IP, CIDR, **When** tạo hoặc sửa policy, **Then** trả
   `400` message `IP Access contains an incorrect value. Valid values are: IP addresses, IP ranges and CIDR blocks`.
5. **Given** `PATCH /policies/:id` với `{"permissions": {"create": [...], "update": [...], "delete": [...]}}` (cách
   `CreatePermission` của bộ blackbox), **When** gửi tới app mới, **Then** permission được tạo, sửa, xóa giống Directus
   (ghi lồng quan hệ, FR-040).
6. **Given** admin sửa permission ở Directus, **When** user gọi app mới ngay sau đó, **Then** app mới dùng quyền mới (cache
   quyền đã bị xóa ở cả hai app), và ngược lại.
7. **Given** `GET /permissions?limit=1`, **When** gọi ở hai app, **Then** cả hai trả toàn bộ dòng (Directus luôn dùng
   `limit: -1` cho `/permissions`) và cùng `meta`.

---

### User Story 4 - Quản lý user và hồ sơ của chính mình (Priority: P2)

Quản trị viên quản lý user qua `/users` (tạo, đọc, sửa, xóa, hàng loạt, `SEARCH`); user xem và sửa hồ sơ của mình qua
`/users/me` và ghi trang vừa xem qua `PATCH /users/me/track/page`. Các quy tắc riêng của `directus_users` giống
Directus: email duy nhất không phân biệt hoa thường, chính sách mật khẩu, hash argon2, che `password`, `token`,
`tfa_secret`, không xóa được admin cuối cùng, giới hạn số user, xóa session khi đổi trạng thái, email, mật khẩu.

**Why this priority**: Là phần CRUD còn lại của `/users` (D-09.2). Cần sau US1 đến US3 vì mọi request ghi `/users` đi
qua kiểm quyền.

**Independent Test**: Gửi cùng chuỗi request tới hai app với token admin và token user thường. So response, các dòng
`directus_users`, `directus_sessions`, `directus_activity`, `directus_revisions`.

**Acceptance Scenarios**:

1. **Given** user `a@example.com` đã có, **When** tạo user `A@Example.com`, **Then** trả `400 RECORD_NOT_UNIQUE` như
   Directus.
2. **Given** `auth_password_policy` trong settings, **When** tạo hoặc sửa user với mật khẩu không khớp, **Then** trả
   `400 FAILED_VALIDATION` message `Provided password doesn't match password policy`; mật khẩu khớp được lưu bằng hash
   argon2 đọc được ở Directus.
3. **Given** user có `password`, `token`, `tfa_secret`, **When** đọc user, **Then** ba field trả `**********` (hoặc
   `null` khi trống).
4. **Given** bất kỳ user nào (kể cả admin), **When** gửi `tfa_secret` trong payload sửa user, **Then** trả `400`
   message `You can't change the "tfa_secret" value manually`; user không phải admin gửi `provider` hoặc
   `external_identifier` thì trả lỗi tương ứng.
5. **Given** user có hai session, **When** đổi email hoặc mật khẩu qua `PATCH /users/me`, **Then** session khác session
   hiện tại bị xóa; **When** admin đổi `status` của user khác `active`, **Then** mọi session của user đó bị xóa.
6. **Given** admin là user admin `active` cuối cùng, **When** xóa chính mình hoặc chuyển `status` sang `suspended`,
   **Then** trả `422 UNPROCESSABLE_CONTENT` như US3.
7. **Given** `USERS_ADMIN_ACCESS_LIMIT=1` và đã có một admin `active`, **When** tạo admin `active` thứ hai, **Then** trả
   `403 LIMIT_EXCEEDED` với cùng `category` như Directus.
8. **Given** user đăng nhập, **When** gọi `PATCH /users/me/track/page` với `last_page`, **Then** trả `204`, cập nhật
   `last_page` mà không cần quyền, không ghi activity; thiếu `last_page` thì `400` message `"last_page" key is
   required`.

---

### User Story 5 - Mời user và tự đăng ký, không gửi email (Priority: P2)

Quản trị viên mời user qua `POST /users/invite`; người được mời đặt mật khẩu qua `POST /users/invite/accept`. Người
lạ tự đăng ký qua `POST /users/register` khi settings cho phép, và xác minh email qua `GET
/users/register/verify-email`. Luồng, response và dữ liệu ghi giống Directus, chỉ bước gửi email được thay bằng một
dòng log cảnh báo (Nguyên tắc X).

**Why this priority**: Là luồng phụ của quản lý user; ít request hơn CRUD nhưng vẫn phải chạy được khi request rơi vào
app mới.

**Independent Test**: Mời một email mới, một email đã `invited` với role khác, một email đã `active` ở hai app. So
response, dòng `directus_users`, và log. Ký token mời ở app mới, dùng ở Directus và ngược lại. Lặp lại với đăng ký
khi tắt, bật đăng ký, bật xác minh email, email không khớp bộ lọc.

**Acceptance Scenarios**:

1. **Given** email chưa có, **When** admin gọi `POST /users/invite` với `email`, `role`, **Then** trả `204`, tạo user
   `status = invited` với role đó, và ghi một dòng log `warn` có email người nhận, không có token hay link.
2. **Given** user đã `invited` với role khác, **When** mời lại, **Then** role của user được đổi; **Given** user đã
   `active`, **When** mời, **Then** không đổi gì, vẫn trả `204`.
3. **Given** `invite_url` không thuộc `USER_INVITE_URL_ALLOW_LIST`, **When** mời user mới, **Then** trả `400` message
   `URL "<url>" can't be used to invite users`.
4. **Given** token mời do Directus ký (scope `invite`), **When** gọi `POST /users/invite/accept` ở app mới với mật khẩu
   hợp lệ, **Then** user chuyển `active` với mật khẩu mới; token hết hạn trả `401 TOKEN_EXPIRED`; user không còn
   `invited` trả `400 INVALID_INVITE`; và ngược lại với token do app mới ký.
5. **Given** `public_registration = false`, **When** gọi `POST /users/register`, **Then** trả `403 FORBIDDEN` ngay,
   không chờ, giống Directus; **Given** bật đăng ký và bật xác minh email, **When** đăng ký email mới, **Then** tạo user
   `status = unverified` với role `public_registration_role`, ghi log thay email xác minh, trả `204` sau ít nhất
   `REGISTER_STALL_TIME`.
6. **Given** email đã tồn tại với trạng thái khác `unverified`, **When** đăng ký, **Then** trả `204` sau cùng thời gian
   chờ như email mới, không lộ việc email đã có.
7. **Given** quá `RATE_LIMITER_REGISTRATION_POINTS` lần đăng ký trong `RATE_LIMITER_REGISTRATION_DURATION` giây từ một
   IP, **When** đăng ký tiếp, **Then** trả `429 REQUESTS_EXCEEDED` với header `Retry-After`, bộ đếm dùng chung qua
   Redis khi `RATE_LIMITER_STORE=redis`.
8. **Given** token xác minh hợp lệ, **When** mở `GET /users/register/verify-email?token=...`, **Then** user chuyển
   `active` và trình duyệt được chuyển hướng tới `/admin/users/<id>`; token sai định dạng thì chuyển hướng tới
   `/admin/login`.

---

### User Story 6 - Client xem quyền của chính mình (Priority: P2)

App Directus (và app web của feature 012) gọi `GET /permissions/me`, `GET /permissions/me/:collection/:pk?`, `GET
/policies/me/globals` để biết user được làm gì và có bị bắt TFA không. Kết quả ở app mới giống hệt Directus.

**Why this priority**: App dùng các route này để ẩn, hiện nút và chặn người dùng chưa bật TFA. Sai ở đây làm giao diện
sai dù API vẫn chặn đúng.

**Independent Test**: Port `check-item-permissions.test.ts` và gọi ba route ở hai app với các user của ma trận quyền.

**Acceptance Scenarios**:

1. **Given** admin, **When** gọi `GET /permissions/me`, **Then** mọi collection trong schema (gồm collection hệ thống)
   có mọi action `{"access": "full", "fields": ["*"]}`.
2. **Given** user có quyền `read` với filter và quyền `create` không filter, **When** gọi `GET /permissions/me`,
   **Then** `read.access = "partial"`, `create.access = "full"`, action khác `{"access": "none"}`, `fields` là hợp các
   field, `presets` gộp theo thứ tự policy.
3. **Given** user không đăng nhập, **When** gọi `GET /permissions/me` hoặc `GET /permissions/me/:collection/:pk`,
   **Then** trả `403 FORBIDDEN`; gọi `GET /policies/me/globals` thì trả `200` với `{"data": {"app_access": false}}`.
4. **Given** một policy (qua role cha hoặc gắn vào user, sau khi lọc IP) có `enforce_tfa = true`, **When** gọi `GET
   /policies/me/globals`, **Then** `enforce_tfa: true`.
5. **Given** singleton mà user được `update` một số field có preset, **When** gọi `GET /permissions/me/<singleton>`,
   **Then** `update` có `fields` và `presets` giống Directus.

---

### User Story 7 - Cache quyền dùng chung Redis với Directus (Priority: P3)

Kết quả tính quyền (policy của user, cây role, cờ admin và app, permission thô, thông tin share) được cache với cùng
key, cùng giá trị, cùng namespace Redis như Directus. Bên nào ghi cache thì bên kia đọc được; bên nào xóa thì bên kia
cũng mất bản cũ (kể cả bản trong bộ nhớ process).

**Why this priority**: Đã có nền từ feature 002; feature này thêm các namespace và điểm xóa cache còn thiếu. Hiệu năng
của mọi request phụ thuộc vào cache này.

**Independent Test**: Xóa cache, gọi một request ở Directus, rồi đọc các key `permissions:*` trong Redis; xóa cache,
gọi cùng request ở app mới; so tập key và giá trị. Sửa role, policy, access, permission, user ở một app, kiểm key bị
xóa và app kia tính lại quyền ở request kế tiếp.

**Acceptance Scenarios**:

1. **Given** cùng accountability, **When** mỗi app tính quyền từ cache trống, **Then** hai app ghi cùng tập key với cùng
   giá trị.
2. **Given** cache do Directus ghi, **When** app mới cần cùng kết quả, **Then** app mới dùng bản trong cache, không đọc
   DB.
3. **Given** thao tác ghi làm Directus xóa cache quyền (bảng ở FR-082), **When** thao tác đó chạy ở app mới, **Then**
   app mới cũng xóa cache và phát cùng thông điệp bus, để Directus bỏ bản trong bộ nhớ process.

---

### Edge Cases

- User không có role: có policy public (dòng access `role` và `user` đều `null`) cộng policy gắn trực tiếp vào user.
- Request không token: cờ `admin`, `app` luôn `false`; quyền theo policy public.
- Cây role có vòng (dữ liệu hỏng do ghi thẳng DB): `fetchRolesTree` ném lỗi thường `Recursion encountered: ...`, nên mọi
  request mang token của user có role trong vòng (kể cả đăng nhập, refresh, static token) trả `500 INTERNAL_SERVER_ERROR`
  với message mặc định (không lộ chi tiết vì chưa có accountability admin), giống Directus. Request không token không bị
  ảnh hưởng.
- Không xác định được IP của request: `fetchPolicies` bỏ mọi policy có `ip_access`, nhưng cờ admin và app vẫn tính cả
  policy đó (FR-016, R-02).
- Cùng user gọi từ IP được phép rồi từ IP bị cấm khi policy admin có `ip_access`: cờ `admin` của lần đầu được dùng lại
  (FR-016, R-01).
- Claim `enforce_tfa` trong JWT lúc đăng nhập chỉ xét policy của role trực tiếp; `/policies/me/globals` xét mọi policy
  sau khi lọc IP. Giữ nguyên cả hai.
- Đọc theo id một item không tồn tại và một item không có quyền: cùng `403`.
- Tạo item rồi đọc lại bị `403` (có quyền `create` nhưng không có quyền `read`): trả `204` không body.
- Thứ tự lỗi: người không phải admin bị `403` trước lỗi kiểm dữ liệu của service (email trùng, mật khẩu yếu, URL mời
  không hợp lệ), giống Directus.
- `PATCH /users/me` khi không đăng nhập: `401 INVALID_CREDENTIALS`. `GET /roles/me` không đăng nhập: `403`.
- `GET /users/me` khi user không được đọc chính mình: trả `{"data": {"id": "<id>"}}`.
- Biến động trỏ tới field không có (`$CURRENT_USER.not_exist`): giải thành `null` như Directus.
- `$NOW` với điều chỉnh sai cú pháp: dùng thời điểm hiện tại như Directus.
- Batch vượt `MAX_BATCH_MUTATION`: `400` message `Exceeded max batch mutation limit of <n>`.
- Mời lại user đã `invited` cùng role với `invite_url` ngoài allow list: không có lỗi URL vì lỗi này chỉ được ném ở bước
  ghi, mà trường hợp này không ghi gì; Directus vẫn gửi mail, app mới ghi log (D-27). Trả `204`.
- Policy bị xóa: dòng access và permission của nó bị DB xóa theo khóa ngoại `ON DELETE CASCADE`, không ghi activity cho
  các dòng đó, giống Directus.
- Field quan hệ trỏ tới collection user không được đọc: bị bỏ qua khi mở rộng `*`, không báo lỗi; hỏi đích danh thì
  `403`.

### Truy vết user story và requirement

| Story | Kịch bản | Requirement chính |
|-------|----------|-------------------|
| US1 | 1 (cây role), 2, 3 (cờ admin), 4, 5 (route 001), 6 (share), 7 (đổi role) | FR-001 đến FR-005, FR-016, FR-044 |
| US2 | 1 (field), 2 (`CASE WHEN`), 3 (`$NOW`), 4 (preset, validation), 5 (`$CURRENT_USER.<field>`), 6 (`403` khi đọc), 7 (IP), 8 (quyền tối thiểu của app) | FR-010 đến FR-037, FR-073 |
| US3 | 1 (vòng role), 2 (xóa role), 3 (admin cuối), 4 (`ip_access`), 5 (ghi lồng permission), 6 (cache chéo), 7 (`limit: -1`) | FR-040 đến FR-042, FR-054, FR-070 đến FR-073, FR-082 |
| US4 | 1 (email), 2 (mật khẩu), 3 (che field), 4 (field cấm), 5 (session), 6 (admin cuối), 7 (giới hạn user), 8 (`track/page`) | FR-043, FR-048, FR-050 đến FR-055, FR-092 |
| US5 | 1 đến 3 (mời), 4 (nhận lời mời), 5, 6 (đăng ký, thời gian chờ), 7 (limiter), 8 (xác minh) | FR-060 đến FR-064, SC-009 |
| US6 | 1, 2 (`/permissions/me`), 3 (không đăng nhập), 4 (`enforce_tfa`), 5 (singleton) | FR-017, FR-045, FR-046 |
| US7 | 1 (cùng key), 2 (dùng cache của bên kia), 3 (xóa cache) | FR-080 đến FR-085 |

## Requirements *(mandatory)*

### Functional Requirements

**Accountability cho mọi request**

- **FR-001**: Middleware `authenticate` PHẢI chạy cho mọi request ở cùng vị trí như Directus (sau `extractToken` và rate
  limiter, trước schema và route). App mới PHẢI bỏ `publicAccountability` và dòng log "token bị bỏ qua" (gỡ D-10,
  D-18 phần cảnh báo).
- **FR-002**: Accountability PHẢI có cùng các trường và giá trị như Directus: `user`, `role`, `roles` (cây role từ gốc
  tới role của user, rỗng khi không có role), `admin`, `app`, `ip`, `userAgent` (cắt 1024 ký tự), `origin`, `session`,
  `share`. Nguồn của từng trường như `getAccountabilityForToken`:
  - JWT: `user`, `role` lấy từ claim `id`, `role`, giữ nguyên tới khi token hết hạn hoặc được refresh, kể cả khi role của
    user đã đổi trong DB; `session`, `share` từ claim cùng tên;
  - static token: `user`, `role` đọc từ `directus_users` (user `active` có `token` khớp) ở mỗi request;
  - mọi loại: `roles` là cây role của `role`; `admin`, `app` tính lại ở mỗi request bằng `fetchGlobalAccess` (cây role và
    policy gắn vào user, gộp bằng OR, lọc IP theo FR-016), không lấy claim `admin_access`, `app_access` của JWT;
  - `ip` theo `getIPFromReq` (đã có từ 001): `req.ip` theo `IP_TRUST_PROXY`, thay bằng header `IP_CUSTOM_HEADER` khi
    header đó là IP hợp lệ, bỏ tiền tố `::ffff:`; `null` khi không có.
- **FR-003**: Token share PHẢI cho accountability `role: null`, `roles: []`, `user: null`, `share: <id>`. Quyền `read`
  của share PHẢI tính như `getPermissionsForShare` (giao quyền của người tạo share và role của share, sinh filter trỏ
  về item được share qua quan hệ); action khác dùng policy public.
- **FR-004**: Các route đã có PHẢI dùng accountability như Directus: `/server/info` (thêm thông tin khi có user,
  `version` khi có user), `/server/health` (chi tiết cho admin), `/metrics` (admin, hoặc header `Metrics <token>` khớp
  `METRICS_TOKENS`), `/server/specs/oas` (theo quyền đọc), `/auth/*` và `/users/me/tfa/generate` (như feature 003).
  Các path Directus trả lời trước bước `authenticate` (`GET /`, `GET /robots.txt`, `GET /server/ping`) vẫn không đọc
  token.
- **FR-005**: Khi một request có nhiều lỗi, lỗi trả về PHẢI theo thứ tự các bước của Directus: (1) `extractToken`: token
  gửi bằng hai cách → `400 INVALID_PAYLOAD`; (2) rate limiter → `429`; (3) `authenticate`: token sai hoặc hết hạn →
  `401`/`403`; (4) `sanitizeQuery`, `validateQuery` → `400 INVALID_QUERY`; (5) route: không khớp → `404
  ROUTE_NOT_FOUND`, kiểm body (`validateBatch`, Joi) → `400 INVALID_PAYLOAD`, kiểm đăng nhập của route (`401`, `403`);
  (6) service: kiểm quyền → `403`; (7) lỗi kiểm dữ liệu để dành (`preMutationError`: email, mật khẩu, URL) → `400`; (8)
  ghi DB (lỗi DB đã dịch); (9) kiểm toàn vẹn số user → `422 UNPROCESSABLE_CONTENT` hoặc `403 LIMIT_EXCEEDED`.

**Policy, permission và biến động**

- **FR-010**: Danh sách policy của một accountability PHẢI tính như `fetchPolicies`: dòng `directus_access` có `role`
  thuộc cây role (hoặc, khi không có role, dòng `role` và `user` đều `null`), cộng dòng có `user` là user hiện tại; bỏ
  policy có `ip_access` không khớp IP (bỏ cả khi không xác định được IP); sắp theo thứ tự role cha, role con, rồi policy
  gắn vào user và policy public.
- **FR-011**: Khớp IP PHẢI giống `ipInNetworks`: IP đơn, CIDR, dải `a-b`; `ip_access` `null` hoặc rỗng là không giới
  hạn. Cờ `admin`, `app` PHẢI theo `fetchGlobalAccess` (khi không có IP thì không bỏ policy), kể cả chỗ khác biệt với
  FR-010.
- **FR-012**: Permission của một accountability PHẢI là các dòng `directus_permissions` thuộc các policy ở FR-010, sắp
  theo thứ tự policy; khi `app = true` PHẢI thêm đúng bộ quyền tối thiểu của app trong
  `app-access-permissions.yaml` và `schema-access-permissions.yaml` của 11.17.4 (`policy: null`, `system: true`,
  `fields: ["*"]` khi YAML không ghi).
- **FR-013**: Biến động PHẢI được giải trong `permissions` (filter), `validation`, `presets` của permission và trong
  `validation` của `directus_fields`, theo đúng quy tắc `parseFilter`, `parsePreset`: `$CURRENT_USER`, `$CURRENT_ROLE`,
  `$CURRENT_ROLES`, `$CURRENT_POLICIES`, dạng có field (`$CURRENT_USER.a.b`, đi qua mảng và quan hệ), `$NOW` và
  `$NOW(<điều chỉnh>)`; ép `'true'`, `'false'`, `'null'`; đổi giá trị đơn thành `_eq`; xử lý `_in`, `_nin`,
  `_between`, `_nbetween`, toán tử geometry, `_and`, `_or` như Directus.
- **FR-014**: Dữ liệu cho biến động có field PHẢI đọc như `fetchDynamicVariableData` (đọc không qua kiểm quyền, chỉ các
  field được nhắc tới). Khi `CACHE_ENABLED=true`, dữ liệu này PHẢI được cache trong cache dữ liệu với cùng key
  `filter-context-<biến>-<hash>`, cùng namespace và TTL như Directus, để hai app cho cùng kết quả trong thời gian
  cache. Như Directus, giá trị này KHÔNG bị xóa khi field của user, role, policy đổi; chỉ mất khi hết `CACHE_TTL` hoặc khi
  cache dữ liệu bị xóa (FR-082, FR-083). Trong khoảng đó cả hai app cùng dùng giá trị cũ.
- **FR-015**: Accountability `admin` PHẢI bỏ qua kiểm quyền như Directus, trừ kiểm collection tồn tại (collection
  không có thì `403` cả với admin). Accountability `null` (luồng nội bộ) PHẢI bỏ qua kiểm quyền.
- **FR-016**: Lọc IP PHẢI giống Directus ở từng nơi dùng, kể cả chỗ không nhất quán (rủi ro chấp nhận R-01, R-02):

  | Nơi dùng | Hàm Directus | Lọc IP | Khi `ip` là `null` | Cache |
  |----------|--------------|--------|--------------------|-------|
  | Policy dùng cho permission, `GET /permissions/me`, `enforce_tfa` của `GET /policies/me/globals` | `fetchPolicies` → `filterPoliciesByIp` | Có | Bỏ mọi policy có `ip_access` | `policies`, có `ip` trong hash |
  | Cờ `admin`, `app` của accountability; claim `admin_access`, `app_access` lúc đăng nhập (003) | `fetchGlobalAccess` | Có, ở lớp `global-access-roles`, `global-access-user` | Không bỏ policy | `global-access` **không** có `ip` trong hash (R-01) |
  | Claim `enforce_tfa` lúc đăng nhập (003) | Truy vấn policy của role trực tiếp | Không | — | Không cache |
- **FR-017**: Khi một accountability có nhiều permission cùng collection và action (từ nhiều policy), cách gộp PHẢI giống
  Directus. Đây là nguồn duy nhất về quy tắc gộp:

  | Phần | Cách gộp | Chỗ dùng |
  |------|----------|----------|
  | Filter đọc (`permissions`) | OR; filter rỗng hoặc `null` là mọi dòng | FR-021 |
  | Field đọc | Hợp; field chỉ có ở permission có filter thành `CASE WHEN` theo filter đó; `*` là mọi field | FR-022 |
  | Filter khi sửa, xóa | Item phải đọc được qua OR các filter của action đó | FR-031, FR-032 |
  | `validation` | AND giữa mọi permission của action, cộng quy tắc field | FR-030 |
  | `presets` | Gộp nông theo thứ tự policy (FR-010), policy sau ghi đè, payload ghi đè preset | FR-030 |
  | `GET /permissions/me` | `access`: `none` → `full`, thành `partial` khi có filter không rỗng; `fields` hợp (`*` thắng); `presets` gộp nông | FR-045 |
  | Share | `mergePermissions('intersection')` giữa quyền của người tạo share và của role share, rồi AND với filter sinh từ item | FR-003 |

**Kiểm quyền đọc**

- **FR-020**: Field PHẢI được kiểm như `processAst`: `*` chỉ mở rộng thành các field được đọc; field quan hệ trỏ tới
  collection không được đọc bị bỏ qua khi mở rộng `*`; field hỏi đích danh mà không được đọc trả `403` với đúng message
  của Directus (một field, nhiều field, collection, kèm `Queried in root` hoặc đường dẫn). Field dùng trong `filter`,
  `sort` (kể cả khi `update`, `delete` theo query) PHẢI có quyền `read`.
- **FR-021**: Dòng được đọc PHẢI là các dòng khớp ít nhất một filter của các permission `read` (filter rỗng hoặc
  `null` là mọi dòng), AND với `filter` của request, ở mọi tầng quan hệ.
- **FR-022**: Field chỉ được cho phép bởi permission có filter PHẢI trả `null` ở dòng không khớp filter đó (cùng kết quả
  với `CASE WHEN` của Directus). Field được cho phép bởi permission không filter luôn có giá trị.
- **FR-023**: Đọc theo id không ra dòng nào PHẢI trả `403 FORBIDDEN` message `You don't have permission to access
  this.`; đọc danh sách không ra dòng trả `[]`; `meta` (`total_count`, `filter_count`) PHẢI tính giống Directus cho
  user không phải admin: đếm theo filter quyền (`getCases`), `total_count` là đếm với filter rỗng, dùng `countDistinct`
  theo khóa chính khi có join, như `MetaService`.
- **FR-024**: Danh sách không có `sort` PHẢI theo thứ tự mặc định của Directus (`getAllowedSort`): trường đầu của
  `groupBy` nếu có; nếu không, `sort_field` của quan hệ (khi đọc lồng o2m), hoặc trường sort của collection, hoặc khóa
  chính; với người không phải admin, trường đó không được đọc thì dùng field được đọc đầu tiên, không được đọc field nào
  thì không sắp. Body của danh sách so theo đúng thứ tự này.

**Kiểm quyền ghi**

- **FR-030**: Tạo item PHẢI kiểm như `processPayload` cho từng tầng của payload: không có permission `create` thì `403`
  collection; key không thuộc `fields` (khi không có `*`) thì `403` field; áp preset theo thứ tự policy (policy sau
  ghi đè, payload ghi đè preset, gộp nông); kiểm validation của mọi permission cộng quy tắc field (`_nnull` cho field
  không nullable, `_submitted` khi tạo mà field không có giá trị mặc định, `directus_fields.validation`) bằng AND; lỗi
  trả `400 FAILED_VALIDATION` với cùng danh sách lỗi như Directus.
- **FR-031**: Sửa item PHẢI kiểm `validateAccess` trên các khóa với các field trong payload (item phải đọc được qua filter
  của permission `update` và mọi field phải được phép trên mọi item), rồi `processPayload` như FR-030 (preset cũng áp
  khi sửa). Message `403` PHẢI giống Directus (`You don't have permission to perform "<action>" for collection ...`
  hoặc `... for the field(s) ...`).
- **FR-032**: Xóa item PHẢI kiểm `validateAccess` với action `delete`. Sửa và xóa theo `query` PHẢI tìm khóa bằng lần đọc
  không kiểm quyền rồi kiểm từng khóa, giống Directus.
- **FR-033**: Thứ tự kiểm PHẢI giống `ItemsService`: kiểm quyền trước, rồi mới ném lỗi kiểm dữ liệu của service (lỗi
  để dành `preMutationError`), ghi DB, kiểm toàn vẹn số user trong cùng transaction.
- **FR-034**: Action `share` PHẢI được lưu, đọc và kiểm như action khác; dùng ở `GET /permissions/me/:collection/:pk`
  (feature này) và khi tạo share (feature 010).
- **FR-035**: Như Directus, không có quy tắc cứng nào chặn user tự sửa `role`, `status` hay policy gắn vào chính mình
  (qua `PATCH /users/me`, `PATCH /users/:pk` hoặc ghi lồng vào `directus_access`); chỉ permission quyết định. Quy tắc
  cứng duy nhất là FR-052 (`tfa_secret`, `provider`, `external_identifier`). Ma trận FR-101 PHẢI có ca user được
  `update` field `role` của chính mình (filter `$CURRENT_USER`) và ca không được.
- **FR-036**: Sửa hoặc xóa khóa không tồn tại PHẢI giống Directus: người không phải admin bị `validateAccess` trả `403`
  cùng message như khóa không có quyền (không lộ việc khóa có tồn tại); admin không bị lỗi, câu lệnh ảnh hưởng 0 dòng
  nhưng vẫn ghi activity cho từng khóa (Directus tạo activity theo danh sách khóa), `PATCH /:pk` đọc lại bị `403` nên trả
  `204`, `DELETE` trả `204`.
- **FR-037**: Ghi lồng PHẢI kiểm quyền ở từng tầng bằng service của collection ở tầng đó (`getService`) với accountability
  của người gọi, nên mỗi tầng cần quyền theo việc nó làm: tạo item liên quan → `create`; sửa → `update`; gỡ liên kết o2m
  với `one_deselect_action: nullify` (mặc định, ví dụ `roles.users`, `roles.children`) → `update` field khóa ngoại của
  item con; với `one_deselect_action: delete` (`roles.policies`, `users.policies`, `policies.roles`, `policies.users`
  qua `directus_access`; `policies.permissions`) → `delete` item con.

**Endpoint**

- **FR-040**: Năm endpoint PHẢI hỗ trợ đủ query và payload như Directus (Clarifications): `fields` (wildcard, field
  quan hệ lồng nhau m2o, o2m, m2m, m2a, alias), `filter` (mọi toán tử, kể cả `_some`, `_none`, hàm ngày giờ, filter qua
  quan hệ), `search`, `sort`, `limit`, `offset`, `page`, `meta`, `aggregate`, `groupBy`, `deep`, `alias`, `backlink`;
  payload ghi lồng quan hệ (tạo, sửa, xóa, gỡ item liên quan trong cùng transaction, kiểm quyền từng tầng); special field
  (`uuid`, `hash`, `conceal`, `cast-json`, `date-created`, `date-updated`, `user-created`, `user-updated`...). Query PHẢI
  được kiểm như `sanitizeQuery`, `validateQuery` trên mọi route (trả `400 INVALID_QUERY` như Directus). Engine này
  dùng chung cho mọi collection; feature 005 chỉ thêm route `/items`, singleton, response cache, `export`, event và bus
  `websocket.event`. Cú pháp query chấp nhận như Directus: query string parse bằng `qs` với `QUERYSTRING_MAX_PARSE_DEPTH`,
  `QUERYSTRING_ARRAY_LIMIT` (001); `fields`, `sort` là chuỗi phân tách bằng dấu phẩy hoặc mảng; `filter`, `deep`,
  `alias`, `aggregate` là chuỗi JSON hoặc object (ký hiệu ngoặc vuông); `SEARCH` nhận cùng các tham số trong
  `body.query`.
- **FR-041**: `/users`, `/roles`, `/policies`, `/access`, `/permissions` PHẢI có cùng route CRUD như Directus: `POST /`
  (object hoặc mảng), `GET /`, `SEARCH /` (body `query` ghi đè query string, `keys`), `GET /:pk`, `PATCH /` (mảng có
  khóa chính, `{keys, data}`, `{query, data}`), `PATCH /:pk`, `DELETE /` (mảng khóa, `{keys}`, `{query}`), `DELETE
  /:pk`; kiểm body theo `validateBatch`; đọc lại sau khi ghi và trả `204` không body khi lần đọc lại bị `403`; trả `204`
  khi không có payload; giới hạn `MAX_BATCH_MUTATION`. Chi tiết PHẢI giống Directus:
  - ghi nhiều item (`POST` mảng, `PATCH` mảng, `{keys, data}`, `{query, data}`, `DELETE` theo lô) chạy trong một
    transaction; `validateAccess` kiểm mọi khóa trước khi ghi, nên một khóa bị chặn thì cả lô bị từ chối, không ghi gì;
    lỗi giữa chừng thì rollback cả lô;
  - đọc lại sau ghi dùng `req.sanitizedQuery`: một item bằng `readOne` (không ra dòng → `403` → `204`); nhiều item bằng
    `readMany(keys)`, thứ tự theo FR-024 chứ không theo thứ tự trong body, không ra dòng nào thì trả `{ "data": [] }`;
  - `SEARCH /`: thiếu body → `400 INVALID_PAYLOAD` `Payload in body is required`; body chỉ nhận `keys` (mảng chuỗi
    hoặc số) và `query` (object), key khác → `400` với message Joi; có `body.query` thì query string bị bỏ, `body.query`
    qua `sanitizeQuery`, `validateQuery` (`400 INVALID_QUERY`);
  - khóa chính sai kiểu (`PATCH /policies/me`, chuỗi không phải uuid, khóa không phải số nguyên ở collection khóa số) →
    `403 FORBIDDEN` (`validateKeys`) trước bước kiểm quyền.
- **FR-042**: Các khác nhau giữa năm controller PHẢI giữ nguyên: `SEARCH /users`, `SEARCH /roles` bỏ qua `keys`;
  `/policies`, `/access` dùng `keys` khi có; `/permissions` đọc với `limit: -1` ở `GET /` và `SEARCH /` (cả `meta`,
  cả khi `SEARCH` có `keys`), còn `GET /:pk` và đọc lại sau ghi dùng query của request như controller khác; `GET /:pk` của
  `/users`, `/policies`, `/access`, `/permissions` bỏ qua path kết thúc bằng `me`.
- **FR-043**: `GET /users/me` (share trả `{share}`; không đăng nhập trả `401 INVALID_CREDENTIALS`; bị `403` khi đọc
  thì trả `{id}`), `PATCH /users/me` (sửa chính mình theo quyền của mình, không có đường lui khi `403`), `PATCH
  /users/me/track/page` (cần đăng nhập, cần `last_page`, ghi không qua kiểm quyền, không ghi activity, không xóa cache dữ
  liệu) PHẢI giống Directus.
- **FR-044**: `GET /roles/me` PHẢI đọc các role trong cây role của user với `limit: -1`; không user và không role trả
  `403`; bị `403` khi đọc thì trả `[{id}]`.
- **FR-045**: `GET /permissions/me` PHẢI trả kết quả của `fetchAccountabilityCollectionAccess` (admin: mọi collection,
  mọi action `full`, `fields: ["*"]`; người khác: chỉ collection có permission, `none`, `partial`, `full`, hợp field,
  gộp preset); không user, không role, không share trả `403`. `GET /permissions/me/:collection/:pk?` PHẢI trả kết quả
  của `getItemPermissions` (`update`, `delete`, `share`; singleton chưa có dòng thì `update` kiểm như `create`; singleton
  được `update` thì thêm `fields`, `presets`).
- **FR-046**: `GET /policies/me/globals` PHẢI trả `{app_access, admin_access, enforce_tfa}` (`enforce_tfa` đúng khi một
  policy ở FR-010 có `enforce_tfa = true`); không user và không role, hoặc gặp `403`, trả `200` với `{"app_access":
  false}`.
- **FR-047**: `GET /users/<pk>`, `GET /policies/<pk>`, `GET /access/<pk>`, `GET /permissions/<pk>` với `<pk>` kết thúc
  bằng `me` mà không khớp route riêng (ví dụ `GET /access/me`, `GET /users/some`) PHẢI trả `204` không body như Directus
  (handler bỏ qua và chuyển sang `respond`, `controllers/access.ts:83-98`). `GET /roles/<pk>` không có nhánh này. Path
  không khớp route nào của năm controller (ví dụ `GET /users/a/b`) trả `404 ROUTE_NOT_FOUND`.
- **FR-048**: `POST /users/me/tfa/enable` (cần `secret`, `otp`), `POST /users/me/tfa/disable` (cần `otp`) và `POST
  /users/:pk/tfa/disable` (chỉ admin) PHẢI giống Directus: kiểm OTP như `TFAService`, ghi `tfa_secret` qua engine ghi
  với accountability của người gọi (nên người không phải admin cần quyền `update` field `tfa_secret` như ở Directus),
  cùng lỗi (`TFA Secret is already set for this user`, `User "<id>" doesn't have TFA enabled`, `"otp" is invalid`,
  `401` khi không đăng nhập, `403` khi không phải admin). Gỡ D-09.10. Secret sinh ở một app bật được ở app kia. Ca
  người không phải admin có và không có quyền `update` field `tfa_secret` nằm ở bộ đối chiếu TFA (FR-103), không thuộc ma
  trận FR-101.
- **FR-049**: `OPTIONS` tới mọi path của năm controller PHẢI trả header `Allow` như router Express 4 của Directus (method
  của mọi route khớp path theo thứ tự đăng ký, `HEAD` sau `GET`; không route nào khớp → `404`); `HEAD` trả như `GET`
  không body; path có hay không có dấu `/` cuối khớp như nhau (Express không bật strict routing), kể cả các route khai
  báo có dấu `/` cuối như `/users/me/tfa/generate/`, `/users/me/tfa/enable/`. Bảng `Allow` ở
  contracts/permissions-api.md §3.

**Quy tắc riêng của `directus_users`**

- **FR-050**: Email PHẢI được kiểm định dạng và tính duy nhất không phân biệt hoa thường (trong cùng lô và với DB),
  trả `FAILED_VALIDATION` hoặc `RECORD_NOT_UNIQUE` như Directus; sửa `email` cho nhiều khóa một lúc trả
  `RECORD_NOT_UNIQUE`.
- **FR-051**: Mật khẩu PHẢI kiểm theo `auth_password_policy` và hash bằng argon2 với `HASH_*` khi tạo, sửa; `password`,
  `token`, `tfa_secret` PHẢI trả `**********` khi có giá trị, `null` khi trống. Static token (`token`) đặt qua `/users`
  PHẢI dùng được để gọi Directus và app mới. `auth_password_policy` rỗng thì không kiểm; giá trị bọc trong `/.../` thì
  bỏ hai dấu `/`; regex sai cú pháp thì lỗi `500 INTERNAL_SERVER_ERROR` sau bước kiểm quyền, như Directus. Chính sách áp
  dụng cho mọi đường đặt mật khẩu: tạo, sửa (kể cả `PATCH /users/me`), nhận lời mời, đăng ký, đặt lại mật khẩu (003).
- **FR-052**: Payload có `tfa_secret` PHẢI bị từ chối với mọi người; `provider`, `external_identifier` bị từ chối với
  người không phải admin; khi được đổi thì `auth_data` về `null`; message giống Directus.
- **FR-053**: Sau khi sửa: `status` khác `active` xóa mọi session của các user bị sửa; nếu không, đổi `email` hoặc
  `password` xóa mọi session của các user bị sửa trừ session có `token` bằng claim `session` của request (chỉ có khi
  request dùng chế độ `session`). Hệ quả, giống Directus: admin sửa user khác thì mọi session của user đó bị xóa; user tự
  đổi mật khẩu bằng token chế độ `json` hoặc `cookie` cũng mất mọi session, kể cả refresh token đang dùng. Đổi `role`
  xóa cache theo FR-082. Sau khi xóa user: đặt `null` cho
  `directus_comments.user_updated`, `directus_notifications.sender`, `directus_versions.user_updated` trước khi xóa, và
  xóa session của user. Các khóa ngoại khác tới `directus_users` (ví dụ `user_created`, `uploaded_by`) do ràng buộc của DB
  (migration của Directus, `SET NULL` hoặc `CASCADE`) xử lý, như Directus.
- **FR-054**: Kiểm toàn vẹn số user PHẢI giống `validateUserCountIntegrity` cho mọi thao tác ghi user, role, policy,
  access có cờ ở Directus: còn ít nhất một admin `active` (`422 UNPROCESSABLE_CONTENT`), và giới hạn
  `USERS_ADMIN_ACCESS_LIMIT`, `USERS_APP_ACCESS_LIMIT`, `USERS_API_ACCESS_LIMIT` (`403 LIMIT_EXCEEDED` với `category`
  `Active Admin users`, `Active App users`, `Active API users`).
- **FR-055**: Như Directus, API không có quy tắc chuyển trạng thái cho `status` của user: field này chỉ có danh sách lựa
  chọn ở giao diện (`draft`, `invited`, `unverified`, `active`, `suspended`, `archived`), không có validation ở API, nên
  mọi giá trị được ghi nếu có quyền. Hệ quả của `status` nằm ở FR-053 (session), FR-054 (chỉ đếm `active`), đăng nhập
  (003: chỉ `active`), mời và đăng ký (FR-060 đến FR-064).

**Mời user và đăng ký**

- **FR-060**: `POST /users/invite` PHẢI kiểm body như Directus (`email` là email hoặc mảng email, `role` uuid v4,
  `invite_url` uri), kiểm `invite_url` theo `USER_INVITE_URL_ALLOW_LIST`, và với mỗi email: chưa có thì tạo user
  `status = invited` với role (cần quyền `create`); đã `invited` với role khác thì đổi role; trạng thái khác thì không làm
  gì. Trả `204`. Thứ tự như Directus: kiểm body (Joi, `400`); lỗi `invite_url` được để dành và ném ở lần ghi đầu tiên
  (sau kiểm quyền); các email xử lý lần lượt, mỗi lần ghi một transaction riêng, nên lỗi ở email thứ `k` dừng vòng lặp
  và các email trước đó đã được tạo hoặc sửa (và đã ghi log) vẫn giữ. Số email mỗi request chỉ bị giới hạn bởi
  `MAX_BATCH_MUTATION` (các lần ghi dùng chung một bộ đếm); không có giới hạn tốc độ riêng.
- **FR-061**: Mỗi chỗ Directus gửi email mời (user mới và user còn `invited`), app mới PHẢI ghi một dòng log `warn` có
  email người nhận và lý do không gửi, không có token hay link, và không làm request thất bại (giống FR-062 của feature
  003).
- **FR-062**: Token mời PHẢI là JWT `{email, scope: "invite"}` ký bằng `SECRET`, issuer `directus`, sống
  `USER_INVITE_TOKEN_TTL`. `POST /users/invite/accept` PHẢI nhận token của cả hai app, kiểm scope, trạng thái
  `invited`, chính sách mật khẩu, rồi đặt mật khẩu và `status = active` không qua accountability; lỗi giống Directus:

  | Trường hợp của `token` (`POST /users/invite/accept`) | Kết quả |
  |-------------------------------------------------------|---------|
  | Thiếu `token` hoặc `password` | `400 INVALID_PAYLOAD` (Joi) |
  | Hết hạn | `401 TOKEN_EXPIRED` |
  | Sai chữ ký, sai định dạng, sai issuer | `403 INVALID_TOKEN` |
  | Scope khác `invite` | `403 FORBIDDEN` |
  | User không còn `invited` (hoặc không có) | `400 INVALID_INVITE` `This invite is no longer valid.` |
  | Mật khẩu không khớp chính sách | `400 FAILED_VALIDATION` |
- **FR-063**: `POST /users/register` PHẢI qua rate limiter đăng ký (`RATE_LIMITER_REGISTRATION_*`, mặc định bật, 5 lần
  mỗi 60 giây mỗi IP), kiểm body và `verification_url` theo `USER_REGISTER_URL_ALLOW_LIST`, đọc
  `public_registration`, `public_registration_verify_email`, `public_registration_role`,
  `public_registration_email_filter`, và chờ `REGISTER_STALL_TIME` ở đúng các nhánh Directus chờ (email không khớp bộ
  lọc, email đã có, đăng ký xong; nhánh tắt đăng ký và `verification_url` sai trả ngay). User đã có với trạng thái
  `unverified` thì không tạo lại, chỉ làm lại bước gửi email xác minh. Email xác minh được thay bằng log như FR-061. Token xác minh là JWT `{email, scope: "pending-registration"}` sống
  `EMAIL_VERIFICATION_TOKEN_TTL`.
- **FR-064**: `GET /users/register/verify-email` PHẢI trả như Directus:

  | Trường hợp của `token` | Kết quả |
  |------------------------|---------|
  | Không phải chuỗi hoặc chuỗi rỗng (ví dụ `?token=`, lặp tham số `token`) | `302` tới `/admin/login` |
  | Thiếu, sai chữ ký, sai định dạng | `403 INVALID_TOKEN` (JSON, không chuyển hướng) |
  | Hết hạn | `401 TOKEN_EXPIRED` |
  | Scope khác `pending-registration` | `403 FORBIDDEN` |
  | User không còn `unverified` | `400 INVALID_PAYLOAD` `Invalid verification code` |
  | Hợp lệ | User thành `active`, `302` tới `/admin/users/<id>` |

**Quy tắc riêng của role, policy, access, permission**

- **FR-070**: Sửa `parent` của role PHẢI kiểm vòng như `validateRoleNesting` (hai message ở US3), rồi xóa cache theo
  FR-082. Xóa role PHẢI làm đúng thứ tự trong một transaction: xóa access của role, xóa preset của role, chuyển user của
  role sang `suspended` và `role = null`, đặt `parent = null` cho role con, xóa role, kiểm toàn vẹn; sau đó xóa cache
  theo FR-082. Các bước này chạy với accountability của người gọi như Directus.
- **FR-071**: `ip_access` của policy PHẢI được kiểm như Directus (`null`, `[]`, hoặc mảng IP, dải IP, CIDR; không
  `*`, không mask). Xóa cache theo FR-082.
- **FR-072**: Dòng access PHẢI chấp nhận `role`, `user`, cả hai hoặc không cái nào (policy public), chỉ `policy` bắt
  buộc. Xóa cache theo FR-082.
- **FR-073**: `GET /permissions` với accountability `app = true` PHẢI thêm quyền tối thiểu của app, lọc theo `filter`
  của request. Xóa cache theo FR-082.

**Cache quyền**

- **FR-080**: Các hàm Directus bọc `withCache` PHẢI được cache với cùng namespace, cùng tham số đưa vào hash, cùng giá
  trị: `policies`, `roles-tree`, `raw-permissions`, `global-access`, `global-access-roles`, `global-access-user`,
  `policies-ip-access`, `share-info`. Key và giá trị app mới ghi PHẢI giống hệt key và giá trị Directus ghi cho cùng
  lời gọi, kể cả chỗ Directus không đưa IP vào hash. Tham số đưa vào hash PHẢI giữ đúng thứ tự field, kiểu và giá trị
  như Directus (số khác chuỗi, `null` khác `[]` và khác thiếu field, thứ tự mảng giữ nguyên, `collections` đã sắp), như
  quy tắc R5 của 002 (contracts/cache.md §1). Giá trị hai bên so sau khi parse JSON (ngày là chuỗi ISO).
- **FR-081**: Kho cache PHẢI giống Directus: có Redis thì cache hai lớp (bộ nhớ process tối đa 100 key, Redis namespace
  `REDIS_PERMISSIONS_NAMESPACE`, mặc định `permissions`, TTL `CACHE_SYSTEM_TTL`), không Redis thì bộ nhớ process tối đa
  500 key. Mỗi lần ghi, xóa PHẢI phát thông điệp bus như `@directus/memory` để mọi instance bỏ bản trong bộ nhớ.
- **FR-082**: Đây là nguồn duy nhất về điểm xóa cache của năm collection (thuật ngữ ở Key Entities). App mới PHẢI xóa
  đúng các loại cache Directus xóa, sau khi transaction ghi đã commit:

  | Thao tác | Cache hệ thống + cache schema + cache quyền (`clearSystemCache`, bus `schemaChanged`) | Chỉ cache quyền | Cache dữ liệu |
  |----------|------|------|------|
  | Tạo, sửa, xóa access | Có | — | Có |
  | Tạo policy | — | Có | — |
  | Sửa policy có `admin_access`, `app_access`, `ip_access` hoặc `enforce_tfa` trong payload | Có | — | Có |
  | Sửa policy không có bốn field trên | — | — | — |
  | Xóa policy | Có | — | Có |
  | Mọi thao tác ghi permission | Có | — | Có |
  | Sửa role có `parent` trong payload; xóa role | Có | — | Có |
  | Sửa user có `role` trong payload | Có | — | Có |

  Cột "Cache dữ liệu" áp dụng khi `CACHE_ENABLED=true` và lệnh không có `autoPurgeCache: false` (riêng access luôn xóa,
  vì `AccessService` không chuyển tùy chọn của lệnh), không phụ thuộc `CACHE_AUTO_PURGE`. Bảng áp dụng cả khi thao tác tới gián tiếp qua ghi lồng (ví dụ `PATCH /policies/:id` với
  `permissions`, `PATCH /roles/:id` với `users` hoặc `policies`), vì ghi lồng đi qua service riêng của collection đó
  (`getService`), như Directus.
- **FR-083**: Ngoài FR-082, mọi thao tác ghi qua engine (mọi collection) PHẢI xóa cache dữ liệu như `shouldClearCache`:
  khi `CACHE_AUTO_PURGE=true`, trừ collection trong `CACHE_AUTO_PURGE_IGNORE_LIST` và lệnh có `autoPurgeCache: false`
  (`PATCH /users/me/track/page`). App mới xóa cache dữ liệu dùng chung dù chính nó chưa trả response từ cache (D-11), để
  Directus không trả dữ liệu cũ sau khi ghi ở app mới (Nguyên tắc IV; cùng cách 003 đã làm khi đổi `role` của user).
- **FR-084**: Khi `CACHE_STORE=memory` hoặc không cấu hình Redis, app mới PHẢI làm như Directus: cache dữ liệu và lớp
  bộ nhớ của cache quyền là riêng từng process; FR-082, FR-083 chỉ xóa được cache của chính process; instance khác chỉ
  được báo qua bus `schemaChanged` (bus local khi không có Redis), và chỉ xóa cache dữ liệu khi store `memory` với
  `CACHE_AUTO_PURGE=true`. Cấu hình này đã có cảnh báo một instance (001); FR-102 và SC-003 chỉ áp dụng khi dùng chung
  Redis.
- **FR-085**: Khi Redis không dùng được lúc đọc, ghi hoặc xóa cache quyền, cache dữ liệu, app mới PHẢI cho cùng kết quả
  (status, mã lỗi) như Directus đo trong cùng điều kiện (cùng `@backoffice/memory`, cùng cấu hình ioredis). Bước xóa
  cache chạy sau khi transaction đã commit, nên dữ liệu đã ghi được giữ dù bước xóa lỗi (rủi ro chấp nhận R-03). Bộ
  đối chiếu thêm ca này vào `redis-down.test.ts` của 002.

**Dữ liệu ghi vào DB**

- **FR-090**: Mọi thao tác ghi năm collection qua API PHẢI ghi `directus_activity` và `directus_revisions` giống
  Directus (có khi có accountability, không có khi accountability là `null` như nhận lời mời, đăng ký, xác minh,
  `track/page`), cùng định dạng (uuid, ngày giờ, JSON, hash argon2, `action`, `collection`, `item`, `ip`,
  `user_agent`, `origin`).
- **FR-091**: Test `db-unchanged` và `readonly-account` của bộ test đối chiếu PHẢI được sửa theo: DB không đổi với mọi
  request đọc; với tài khoản DB chỉ đọc, mọi request đọc của feature này vẫn chạy không lỗi `500`.
- **FR-092**: Giá trị nhạy cảm PHẢI được che như Directus: `password`, `token`, `tfa_secret` (special `conceal`) thành
  `**********` (hoặc `null` khi trống) trong response và trong `data`, `delta` của revision (`prepareDelta` đọc qua
  `processValues('read')`); activity không chứa payload. Log của app mới KHÔNG được chứa mật khẩu, static token,
  `tfa_secret`, OTP, token mời, token xác minh hay link chứa chúng, trừ `token` trong URL của
  `GET /users/register/verify-email` ở dòng log HTTP, như Directus (R-06); dòng log thay email (FR-061, FR-063) chỉ có
  email người nhận, như quyết định FR-062 của 003; log request che header `authorization`, cookie như 001.

**Biến môi trường**

- **FR-095**: App mới PHẢI hỗ trợ với cùng tên, mặc định và cách ép kiểu như Directus 11.17.4:
  `USER_INVITE_TOKEN_TTL` (`7d`), `USER_INVITE_URL_ALLOW_LIST`, `USER_REGISTER_URL_ALLOW_LIST`, `REGISTER_STALL_TIME`
  (`750`), `EMAIL_VERIFICATION_TOKEN_TTL` (`7d`), `RATE_LIMITER_REGISTRATION_ENABLED` (`true`),
  `RATE_LIMITER_REGISTRATION_POINTS` (`5`), `RATE_LIMITER_REGISTRATION_DURATION` (`60`), `QUERY_LIMIT_DEFAULT`
  (`100`), `QUERY_LIMIT_MAX`, `MAX_RELATIONAL_DEPTH` (`10`), `RELATIONAL_BATCH_SIZE` (`25000`), `MAX_JSON_QUERY_DEPTH`
  (`10`). Các biến này PHẢI được gỡ khỏi nhóm "chưa hỗ trợ" của feature 001 (`MAX_RELATIONAL_DEPTH` không thuộc danh
  sách biến của Directus nên chưa bao giờ bị cảnh báo; chỉ cần được đọc).

**Kiểm thử đối chiếu**

- **FR-100**: Bộ test đối chiếu PHẢI port: phần `createRole()` (3 ca) và `createUser()` (4 ca) của
  `common/common.test.ts`; các fixture `CreateRole`, `CreateUser`, `CreatePolicy`, `CreatePermission`,
  `DeletePermission` của `common/functions.ts` (chạy được với cả hai app); `check-item-permissions.test.ts`; và chạy lại
  nguyên bản các khẳng định `/users/me` của `ldap.test.ts`, `login.test.ts`, `refresh.test.ts` đã hoãn từ feature 003
  (FR-100 của 003). Phần `createCollection()`, `createField()`, `createFieldM2O()`, `createFieldO2M()`, `createItem()`,
  `deleteField()`, `deleteCollection()` của `common.test.ts` cần `/collections`, `/fields`, `/items` (D-09.3, D-09.4)
  nên port ở feature 006. `cache-purge.test.ts` và `tests/db/app/cache.test.ts` cần response cache (D-11) nên port ở
  feature 005.
- **FR-101**: Bộ test PHẢI có ma trận quyền chạy với cả hai app trên cùng DB. Ma trận là **tích đầy đủ** của năm chiều
  sau (Clarifications); mỗi ô có một cấu hình fixture và một bộ request cố định theo action:
  1. Accountability (10): không token; user không role; user role một tầng không `app_access`; user role một tầng có
     `app_access`; user role lồng ba tầng (permission đặt ở role gốc, giữa, lá); user có policy gắn trực tiếp (không qua
     role); admin qua policy của role; admin qua policy gắn user; static token của user role một tầng; token share (share
     do Directus tạo trên một collection người dùng).
  2. Cấu hình permission của collection và action trong ô (13): không có; đủ quyền (filter rỗng, `fields: ["*"]`); filter
     so với hằng; `$CURRENT_USER`; `$CURRENT_ROLE`; `$CURRENT_ROLES`; `$CURRENT_POLICIES`; `$CURRENT_USER.<quan hệ>.<field>`;
     `$NOW(-1 day)`; danh sách field một phần; validation; preset; hai policy cùng collection và action với field và filter
     khác nhau.
  3. `ip_access` của policy mang permission (5): `null`; IP đơn khớp; IP đơn không khớp; dải `a-b` khớp; CIDR không khớp.
  4. Action (5): `create` (`POST` một item), `read` (`GET` danh sách với `fields=*` và `GET /:pk`), `update`
     (`PATCH /:pk`), `delete` (`DELETE /:pk`), `share` (`GET /permissions/me/<collection>/<pk>`).
  5. Collection (6): `directus_users` (field hệ thống); `directus_users` (field tùy biến thêm qua API của Directus, gồm m2o
     tới một collection người dùng); `directus_roles`; `directus_policies`; `directus_access`; `directus_permissions`.

  Ngoài tích trên, ma trận PHẢI có các ca riêng của FR-035 (tự sửa `role`), US1.7 (đổi role khi token còn hạn) và R-01
  (cùng user gọi từ IP được phép rồi từ IP bị cấm khi policy admin có `ip_access`).
- **FR-102**: Bộ test PHẢI có ca dùng chéo cache: thay đổi quyền ở bên này có hiệu lực ở bên kia theo cả hai chiều, và
  so tập key `permissions:*` hai app ghi (mở rộng `src/schema/permissions-cache.test.ts` của feature 002).
- **FR-103**: Bộ test PHẢI có ca đối chiếu cho mời, nhận lời mời, đăng ký, xác minh email, rate limiter đăng ký, token
  mời và token xác minh dùng chéo hai chiều, bật và tắt TFA (secret sinh ở bên này bật ở bên kia, theo cả hai chiều),
  và query trên năm endpoint với user admin và user có quyền một phần: mỗi tham số của FR-040 (`fields` wildcard, lồng
  m2o, o2m, alias; `filter` mỗi nhóm toán tử (so sánh, chuỗi, `_in`/`_between`, `_null`/`_empty`, `_some`/`_none`, hàm
  ngày giờ, qua quan hệ, `_and`/`_or`); `search`; `sort` (tăng, giảm, qua quan hệ); `limit`, `offset`, `page`; `meta`;
  `aggregate`; `groupBy`; `deep`; `alias`; `backlink`) ít nhất một ca mỗi endpoint, cả cú pháp `qs` và JSON, cả `SEARCH`,
  và mỗi lỗi `400 INVALID_QUERY` của `validateQuery` ít nhất một ca.
- **FR-104**: Unit test của engine trong Directus PHẢI được port cùng với code (Clarifications): `database/get-ast-from-query`,
  `database/run-ast` (gồm `apply-query`, `apply-case-when`), `permissions/modules/process-ast`, `process-payload`,
  `validate-access`, `permissions/utils/*`, `services/payload`, `services/items`, `packages/utils/shared/parse-filter`
  và các file liên quan. Các nhánh năm collection hệ thống không chạm tới (m2a, hàm ngày giờ, aggregate, geometry) PHẢI
  được phủ bằng unit test này.
- **FR-105**: Toàn bộ bộ test đối chiếu của feature 003 PHẢI chạy lại và đạt sau khi `ItemsService`, `PayloadService`,
  `UsersService` rút gọn của 003 được thay bằng engine đầy đủ (thay cho hẹn "feature 005 thay phần ghi này" trong
  Assumptions của spec 003). Đường cơ sở: mọi ca đạt ở lần chạy cuối của 003 phải đạt; ca 003 bỏ qua theo vendor (refresh
  đồng thời chế độ `session` trên MySQL, MariaDB) giữ nguyên bỏ qua; ca đổi kết quả vì gỡ D-09.10, D-10, D-12 được sửa
  theo hành vi Directus, không coi là lỗi.
- **FR-106**: Môi trường đối chiếu PHẢI có một reverse proxy định tuyến theo danh sách route đã làm: `/auth`,
  `/server`, `/metrics`, `/users`, `/roles`, `/policies`, `/access`, `/permissions` (và các path con) về app mới; mọi
  path khác, kể cả `/admin` và các route chưa làm (D-09.3 đến D-09.9), về Directus (Clarifications). Danh sách này là
  một file cấu hình trong môi trường đối chiếu mà mỗi feature sau bổ sung. Bộ test Playwright PHẢI chạy app Directus
  11.17.4 qua proxy này ở CI: đăng nhập, mở module User, tạo, sửa, xóa một user; mở Settings > Access Policies và
  Roles, tạo role con của role có sẵn, tạo policy với permission (có filter, field, preset), gán policy cho role và cho
  user, sửa, xóa; so dòng DB với cùng thao tác khi proxy trỏ về Directus. Test này là cổng chặn merge (Clarifications).

### Key Entities

- **User** (`directus_users`): người dùng; thêm cho feature này: `role`, `status` (`active`, `invited`, `draft`,
  `suspended`, `archived`, `unverified`), `token` (static token), `last_page`, các field hồ sơ và field tùy biến.
- **Role** (`directus_roles`): nhóm user, có `parent` tạo cây role lồng nhau; role con thừa hưởng policy của mọi role
  tổ tiên.
- **Policy** (`directus_policies`): gói quyền với cờ `admin_access`, `app_access`, `ip_access` (danh sách IP, dải,
  CIDR), `enforce_tfa`.
- **Access** (`directus_access`): gán một policy cho một role, một user, hoặc public (cả hai `null`); có `sort`.
- **Permission** (`directus_permissions`): thuộc một policy; `collection`, `action` (`create`, `read`, `update`,
  `delete`, `share`), `permissions` (filter), `validation`, `presets`, `fields`.
- **Accountability**: danh tính của một request (FR-002), không lưu DB.
- **Quyền tối thiểu của app**: bộ permission cố định trong code Directus 11.17.4, thêm cho user có `app_access`.
- **Các loại cache** (dùng đúng tên này trong spec, plan, tasks):
  - *Cache quyền*: kết quả các hàm `withCache` (8 namespace), key `permissions:<namespace>-<hash>` trong Redis cộng lớp
    bộ nhớ process (FR-080, FR-081); xóa bằng `clearCache` của `permissions/cache.ts`.
  - *Cache hệ thống*: Keyv `<CACHE_NAMESPACE>_system` của `getCache().systemCache`; xóa trong `clearSystemCache`.
  - *Cache schema*: SchemaOverview trong process và trong `localSchemaCache` (002); xóa trong `clearSystemCache` và qua bus
    `schemaChanged`.
  - *Cache dữ liệu*: Keyv `getCache().cache` (namespace `CACHE_NAMESPACE`, store `CACHE_STORE`), chỉ có khi
    `CACHE_ENABLED=true`; chứa response cache của Directus (app mới chưa đọc, D-11) và `filter-context-*` (FR-014).
  - `clearSystemCache` xóa cache hệ thống, cache schema, cache quyền và phát `schemaChanged`; không xóa cache dữ liệu.
- **Token mời, token xác minh**: JWT scope `invite`, `pending-registration`, không lưu DB.

## Khác biệt so với Directus *(mandatory)*

Thay đổi với bảng khác biệt của các feature trước:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-09.2 | Gỡ: `/users`, `/roles`, `/policies`, `/access`, `/permissions` làm ở feature này (trừ D-09.10) | FR-041 đến FR-073 |
| D-02 | Mở rộng: mô tả trong `components.schemas` (user đăng nhập thấy schema của collection hệ thống) cũng đổi thương hiệu | FR-004, Nguyên tắc IX |
| D-10 | Gỡ: mọi route xử lý token như Directus | FR-001, FR-004 |
| D-18 | Bỏ dòng cảnh báo "token bị bỏ qua"; giữ phần log khởi động | FR-001 |
| D-09.10 | Gỡ: bật, tắt TFA làm ở feature này (Clarifications) | FR-048 |
| D-11 | Giữ tới 005; nay áp cả cho `GET` của năm endpoint (không cache response, `Cache-Control: no-cache`). Gỡ ở 005 | Clarifications |
| D-12 | Thu hẹp: kiểm query (`sanitizeQuery`, `validateQuery`) làm ở feature này trên mọi route; chỉ còn `export` (xuất file) tới 005. Gỡ ở 005 | FR-040 |

Sửa bảng của spec cũ đi cùng feature này: ô "Gỡ khi" của D-09.10 trong spec 003 thành `004` (T053); dòng D-09.6, D-11,
D-12 trong spec 001 theo bảng trên (T083); cột "App mới" của D-10 trong spec 001 (T038). Entry D-09.2, D-10 xóa khỏi
`tests/parity/accepted-differences.ts` khi feature Done. Mọi dòng của hai bảng ở mục này, cùng bảng "Rủi ro chấp nhận",
cần tech lead duyệt khi đóng feature (Nguyên tắc X, T086).

Khác biệt mới:

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại | Gỡ khi |
|----|----------|------------------|---------|-------|------|--------|
| D-27 | Email mời user (`POST /users/invite`) | Gửi email chứa link mời qua `EMAIL_*` | Không gửi, ghi log `warn` có email người nhận, không có token hay link (FR-061). Response và dữ liệu ghi giống Directus | Nguyên tắc X | ngoài phạm vi | — |
| D-28 | Email xác minh đăng ký (`POST /users/register`) | Gửi email chứa link xác minh | Không gửi, ghi log như D-27 (FR-063). Response, thời gian chờ và dữ liệu ghi giống Directus | Nguyên tắc X | ngoài phạm vi | — |
| D-29 | Event `users.*`, `roles.*`, `policies.*`, `access.*`, `permissions.*` (filter và action, `create`, `update`, `delete`) | Phát cho extension và flow | Không phát; từ feature 005 phát như Directus, chỉ còn flow theo event chưa chạy (thu hẹp ở 005) | Extension ngoài phạm vi (Nguyên tắc XI); flow theo event thuộc feature 009 | ngoài phạm vi (flow: tạm thời) | 009 |
| D-30 | Thông điệp bus `websocket.event` khi ghi năm collection | Instance Directus bật WebSocket đẩy thay đổi tới client đang subscribe | App mới không đẩy; client realtime nối vào Directus không thấy thay đổi user, role, policy, access, permission do app mới ghi | Bus `websocket.event` làm ở feature 005 (Clarifications); Gỡ ở 005 | ngoài phạm vi (tạm thời) | 005 |
| D-31 | Ghi lồng từ payload của năm collection vào collection hệ thống có service riêng chưa port. Quan hệ hệ thống của năm collection chỉ với tới `directus_files` (`directus_users.avatar`, m2o); các collection khác (`folders`, `comments`, `notifications`, `shares`, `translations`, `dashboards`, `panels`, `flows`, `operations`, `versions`, `settings`) chỉ với tới qua field quan hệ do quản trị viên thêm vào năm collection | Đi qua service riêng của collection đó (`FilesService`...) với kiểm tra và tác động riêng | Đi qua `ItemsService` chung (kiểm quyền, activity, revision như mọi collection; không có kiểm tra riêng của service đó). Đọc lồng không khác | Service riêng thuộc feature 007 đến 010 (Clarifications khi lập plan) | ngoài phạm vi (tạm thời) | 010 |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. Scope JWT `invite`, `pending-registration`, issuer `directus`, đường dẫn `/admin/accept-invite`,
  `/admin/users/<id>`, `/admin/login`, `/users/register/verify-email` trong link và chuyển hướng, namespace Redis
  `permissions`, tên cache `filter-context-*` giữ nguyên vì ảnh hưởng luồng (Nguyên tắc IX).

**Rủi ro chấp nhận (tái tạo từ Directus)**: app mới làm giống Directus 11.17.4 kể cả các hành vi không an toàn dưới đây
(Clarifications, Assumptions). Mỗi dòng cần tech lead duyệt khi đóng feature (Nguyên tắc X). Đường dẫn tính từ
`directus/api/src`.

| Mã | Hành vi của Directus | Bằng chứng | Hệ quả |
|----|----------------------|------------|--------|
| R-01 | Key cache `global-access` không chứa IP: mọi chỗ gọi truyền context `{ knex }`, nên `ip` trong hash là `undefined`. Cờ `admin`, `app` tính ở request đầu tiên của một cặp user, cây role được dùng cho mọi IP tới khi cache quyền bị xóa | `permissions/modules/fetch-global-access/fetch-global-access.ts:14-18`; `utils/get-accountability-for-token.ts:39,61`; `services/authentication.ts:221` | Policy admin hoặc app có `ip_access`: request từ IP bị cấm có thể nhận `admin: true` (hoặc IP được phép bị từ chối) cho tới lần xóa cache kế tiếp. Lớp bộ nhớ process không có TTL; Redis theo `CACHE_SYSTEM_TTL` (mặc định không hết hạn) |
| R-02 | Khi request không có IP, `fetchPolicies` bỏ mọi policy có `ip_access` nhưng `fetchGlobalAccess` vẫn tính chúng vào `admin`, `app` | `permissions/utils/filter-policies-by-ip.ts`; `directus/packages/utils/node/fetch-global-access/` | User có thể là admin nhưng không có permission thường của policy đó. Chỉ xảy ra khi Express không xác định được `req.ip` |
| R-03 | Xóa cache sau khi ghi quyền chạy sau commit; nếu bước xóa lỗi (Redis không dùng được), dữ liệu đã ghi vẫn giữ và bản quyền cũ có thể còn trong lớp bộ nhớ process của instance khác (không TTL) tới lần xóa kế tiếp | `services/{access,policies,permissions,roles,users}.ts` (`clearCaches` sau `super.*`); `permissions/cache.ts` (lớp local chỉ có `maxKeys`) | Quyền đã thu hồi có thể còn hiệu lực ở instance khác trong sự cố Redis |
| R-04 | Kiểm "còn ít nhất một admin" chạy trong transaction sau khi ghi, không khóa dòng: hai thao tác đồng thời (hai admin cùng xóa hoặc hạ quyền nhau, hai request cùng tạo admin sát giới hạn) có thể cùng đạt `[Suy luận: tùy mức cô lập của DB, Postgres mặc định READ COMMITTED]` | `utils/validate-user-count-integrity.ts`; lời gọi trong `services/items.ts` (`createOne`, `updateMany`, `deleteMany`) | Hệ thống có thể còn 0 admin `active`, hoặc vượt `USERS_*_ACCESS_LIMIT`. Không có ca kiểm tự động (không tái tạo ổn định được) |
| R-05 | `withCache` đọc, tính rồi ghi mà không kiểm phiên bản: một request tính quyền từ dữ liệu cũ, ghi vào cache ngay sau lần xóa của thao tác đổi quyền, sẽ để lại bản cũ tới lần xóa kế tiếp | `permissions/utils/with-cache.ts` | Quyền cũ có thể còn hiệu lực sau khi đổi quyền (hiếm, cần hai request chen đúng lúc). Không có ca kiểm tự động |
| R-06 | Dòng log HTTP ghi nguyên URL và `query` của request; `redactQuery` chỉ che `access_token`, nên `GET /users/register/verify-email?token=<JWT>` để lại token xác minh trong log (đo ở T081, cả hai app) | `logger/index.ts` (serializer `req`); `logger/redact-query.ts` | Người đọc được log có thể kích hoạt tài khoản đăng ký chưa xác minh trong thời hạn `EMAIL_VERIFICATION_TOKEN_TTL` |

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4 (api 35.2.0). Khi spec không nói rõ, làm như code Directus.
- Chuỗi lỗi ghi trong spec sau `400 INVALID_PAYLOAD`, `400 INVALID_QUERY`, `422 UNPROCESSABLE_CONTENT` là `reason`; message
  đầy đủ có tiền tố của lớp lỗi (`Invalid payload. <reason>.`, `Invalid query. <reason>.`,
  `Can't process content. <reason>.`), như `@directus/errors`. `403 FORBIDDEN` có `reason` thì message là `reason`.
- Hành vi không an toàn của Directus phát hiện trong lúc làm cũng được tái tạo (Clarifications): người phát hiện thêm
  một dòng vào bảng "Rủi ro chấp nhận" (mã R-xx, bằng chứng file và dòng, hệ quả) và ca thể hiện trong bộ đối chiếu; chỉ
  lệch khi chủ dự án yêu cầu, khi đó ghi thành khác biệt D-xx.
- Directus và app mới dùng cùng `SECRET`, DB, Redis và `.env`. Môi trường đối chiếu dùng Redis chung, `CACHE_ENABLED=true`
  như feature 003, `RATE_LIMITER_STORE=redis`.
- Log thay email (D-27, D-28) không chứa token hay link, giống quyết định FR-062 của feature 003: link trong log cho
  phép chiếm tài khoản. Người được mời qua app mới nhận link bằng cách admin mời lại từ Directus khi Directus có cấu hình
  email.
- `RATE_LIMITER_EMAIL_*` vẫn ở nhóm "chưa hỗ trợ": ở Directus, giới hạn này chỉ chặn bước gửi mail chạy nền (lỗi chỉ
  được log), không đổi response, mà app mới không gửi mail.
- Quyền `share` chỉ được kiểm ở `GET /permissions/me/:collection/:pk` trong feature này; tạo share và đăng nhập bằng share
  thuộc feature 010. Session share có sẵn (do Directus tạo) dùng được ở app mới theo FR-003.
- GraphQL cho năm collection (`/graphql/system`) thuộc feature 011 (D-09.9). WebSocket ngoài phạm vi (Nguyên tắc XI).
- Feature 004 lớn hơn ước lượng ban đầu vì nhận engine truy vấn và ghi của 005 (Clarifications). Nếu `tasks.md` vượt
  khoảng 60 task, tách thành các phần nhỏ khi chạy `/speckit.tasks` (theo mục 9 của SPECKIT-GUIDE), không đổi spec.
- Bảng lộ trình trong SPECKIT-GUIDE và prompt của feature 005 cần sửa theo Clarifications (005 không còn port engine).
- Fixture của test đối chiếu tạo dữ liệu bằng API của chính app được kiểm (fixture riêng cho mỗi app như feature 003)
  khi so luồng ghi; tạo bằng API của Directus khi chỉ so luồng đọc.
- Collection người dùng (để thêm field quan hệ cho `directus_users` trong ma trận quyền) được tạo bằng API của Directus,
  vì `/collections`, `/fields` thuộc feature 006.
- Benchmark chạy trong workflow benchmark hằng tuần (không chặn CI, như quyết định 2026-10-11 của feature 003).
- Không giới hạn độ sâu cây role, số policy mỗi user, số permission mỗi policy hay số dòng access: như Directus, các
  truy vấn quyền dùng `limit: -1`. Quy mô thiết kế được đo ở SC-006 (cây ba tầng, ít nhất ba policy mỗi user).
- Quy tắc so của bộ đối chiếu (áp cho SC-001 đến SC-005): thứ tự key trong object JSON bỏ qua; thứ tự phần tử mảng giữ
  nguyên (là một phần của hành vi, FR-024); giá trị sinh ngẫu nhiên (uuid, id tự tăng, token, salt và hash argon2) thay
  bằng dấu hiệu theo kiểu; thời điểm chỉ kiểm nằm trong khoảng thời gian của ca; JSON trong revision so sau khi parse;
  header theo danh sách FR-104 của 001; ca dùng `$NOW` đặt dữ liệu cách ranh giới so sánh ít nhất 1 giờ để hai app gọi
  cách nhau vài giây vẫn cho cùng tập dòng.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% ô của ma trận quyền (FR-101) cho cùng status, mã lỗi, message, body (trừ giá trị sinh ngẫu nhiên,
  theo quy tắc chuẩn hóa của bộ đối chiếu), cùng các header mà bộ đối chiếu so (FR-104 của 001: `content-type`,
  `cache-control`, `vary`, `etag`, `allow`, `location`, `retry-after`, `set-cookie`, `access-control-*`, CSP, COOP,
  HSTS; trừ khác biệt đã chấp nhận) và cùng thay đổi DB ở Directus và app mới:
  - Postgres, mỗi lần push: một shard của tích đầy đủ, xoay vòng theo số lần chạy CI, cộng bộ rút gọn;
  - Postgres, tích đầy đủ (mọi shard, mỗi shard dưới 60 phút): workflow riêng chạy hằng tuần và bấm tay, PHẢI xanh trước
    khi đóng feature và trước mỗi lần nâng phiên bản Directus (Clarifications);
  - MySQL, SQLite: bộ rút gọn ở mỗi lần push, trong đó mỗi giá trị của mỗi chiều FR-101 xuất hiện ít nhất một lần, với
    action `read` và `update` trên `directus_users`;
  - MSSQL, Oracle, CockroachDB: tích đầy đủ theo lịch đêm (Nguyên tắc V; lịch đêm đang tắt theo quyết định của 001).
- **SC-002**: 100% ca port ở FR-100 và FR-103 đạt với cả hai app.
- **SC-003**: Sau một thao tác ghi role, policy, access, permission hoặc role của user ở một app, request gửi tới app
  kia từ 200 ms sau khi response trả về dùng quyền mới, trong 100% của ít nhất 20 lần thử mỗi chiều. 200 ms là thời gian
  cho thông điệp bus `multi-cache`, `schemaChanged` tới instance kia: Directus cũng xóa bản trong bộ nhớ process của
  instance khác một cách bất đồng bộ (cùng khoảng chờ với `flushSharedCaches` của bộ đối chiếu).
- **SC-004**: Với cùng accountability và cache trống, tập key `permissions:*` và giá trị hai app ghi trùng nhau 100%.
- **SC-005**: Với mỗi luồng ghi (CRUD năm collection kể cả ghi lồng, xóa dây chuyền khi xóa role, xóa policy, bật tắt
  TFA, `track/page`, mời, nhận lời mời, đăng ký, xác minh), các dòng app mới ghi giống 100% dòng Directus ghi cho cùng
  request, trừ giá trị sinh ngẫu nhiên (id, token, thời điểm, salt của hash).
- **SC-006**: Với dữ liệu quy mô thiết kế (2.000 user, cây role ba tầng, mỗi user ít nhất ba policy, permission dùng
  biến động), p95 latency và throughput của `GET /users/me`, `GET /permissions/me` và `GET /users` (user không phải
  admin, có filter quyền) không tệ hơn Directus quá 10% (Nguyên tắc X), đo ở workflow benchmark hằng tuần.
- **SC-007**: Đội vận hành dùng nguyên file `.env` của Directus: không thêm hoặc đổi dòng cấu hình nào; các biến ở FR-095
  không còn trong dòng cảnh báo "biến chưa hỗ trợ".
- **SC-008**: 100% kịch bản Playwright của FR-106 đạt ở CI: app Directus 11.17.4 chạy qua reverse proxy (route của
  001 đến 004 vào app mới, còn lại vào Directus) mở được module User và màn hình quyền (Settings > Access Policies,
  Roles), thực hiện được thêm, sửa, xóa user, role, policy, quyền, và DB sau mỗi kịch bản giống khi proxy trỏ mọi route
  về Directus (trừ giá trị sinh ngẫu nhiên).
- **SC-009**: Mọi nhánh chờ của `POST /users/register` (FR-063) trả sau ít nhất `REGISTER_STALL_TIME`. Trên 20 lần thử mỗi
  nhánh, trung vị thời gian trả về của hai app lệch nhau không quá 50 mili giây.
