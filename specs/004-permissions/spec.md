# Feature Specification: Phân quyền (users, roles, policies, access, permissions)

**Feature Branch**: `004-permissions`
**Created**: 2026-10-11
**Status**: Draft
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
   message `You don't have permission to access this.`, dù item có tồn tại hay không, giống Directus.
7. **Given** policy có `ip_access` không chứa IP của request, **When** user gửi request, **Then** policy đó bị bỏ qua
   khi tính quyền, giống Directus (kể cả khi IP không xác định được).
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
- Cây role có vòng (dữ liệu hỏng do ghi thẳng DB): báo lỗi giống Directus (`Recursion encountered`).
- Không xác định được IP của request: `fetchPolicies` bỏ mọi policy có `ip_access`, nhưng cờ admin và app vẫn tính cả
  policy đó (hai chỗ của Directus xử lý khác nhau, app mới giữ nguyên).
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
- Batch vượt `MAX_BATCH_MUTATION`: `400` message `Exceeded max batch mutation limit`.
- Mời lại user đã `invited` cùng role với `invite_url` ngoài allow list: không có lỗi URL vì lỗi này chỉ được ném ở bước
  ghi, mà trường hợp này không ghi gì; Directus vẫn gửi mail, app mới ghi log (D-27). Trả `204`.
- Policy bị xóa: dòng access và permission của nó bị DB xóa theo khóa ngoại `ON DELETE CASCADE`, không ghi activity cho
  các dòng đó, giống Directus.
- Field quan hệ trỏ tới collection user không được đọc: bị bỏ qua khi mở rộng `*`, không báo lỗi; hỏi đích danh thì
  `403`.

## Requirements *(mandatory)*

### Functional Requirements

**Accountability cho mọi request**

- **FR-001**: Middleware `authenticate` PHẢI chạy cho mọi request ở cùng vị trí như Directus (sau `extractToken` và rate
  limiter, trước schema và route). App mới PHẢI bỏ `publicAccountability` và dòng log "token bị bỏ qua" (gỡ D-10,
  D-18 phần cảnh báo).
- **FR-002**: Accountability PHẢI có cùng các trường và giá trị như Directus: `user`, `role`, `roles` (cây role từ gốc
  tới role của user, rỗng khi không có role), `admin`, `app`, `ip`, `userAgent` (cắt 1024 ký tự), `origin`, `session`,
  `share`. `admin` và `app` PHẢI tính lại từ policy ở mỗi request (cây role và policy gắn vào user, gộp bằng OR, lọc
  theo IP), không lấy từ claim JWT.
- **FR-003**: Token share PHẢI cho accountability `role: null`, `roles: []`, `user: null`, `share: <id>`. Quyền `read`
  của share PHẢI tính như `getPermissionsForShare` (giao quyền của người tạo share và role của share, sinh filter trỏ
  về item được share qua quan hệ); action khác dùng policy public.
- **FR-004**: Các route đã có PHẢI dùng accountability như Directus: `/server/info` (thêm thông tin khi có user,
  `version` khi có user), `/server/health` (chi tiết cho admin), `/metrics` (admin, hoặc header `Metrics <token>` khớp
  `METRICS_TOKENS`), `/server/specs/oas` (theo quyền đọc), `/auth/*` và `/users/me/tfa/generate` (như feature 003).

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
  cache.
- **FR-015**: Accountability `admin` PHẢI bỏ qua kiểm quyền như Directus, trừ kiểm collection tồn tại (collection
  không có thì `403` cả với admin). Accountability `null` (luồng nội bộ) PHẢI bỏ qua kiểm quyền.

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
  user không phải admin.

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

**Endpoint**

- **FR-040**: Năm endpoint PHẢI hỗ trợ đủ query và payload như Directus (Clarifications): `fields` (wildcard, field
  quan hệ lồng nhau m2o, o2m, m2m, m2a, alias), `filter` (mọi toán tử, kể cả `_some`, `_none`, hàm ngày giờ, filter qua
  quan hệ), `search`, `sort`, `limit`, `offset`, `page`, `meta`, `aggregate`, `groupBy`, `deep`, `alias`, `backlink`;
  payload ghi lồng quan hệ (tạo, sửa, xóa, gỡ item liên quan trong cùng transaction, kiểm quyền từng tầng); special field
  (`uuid`, `hash`, `conceal`, `cast-json`, `date-created`, `date-updated`, `user-created`, `user-updated`...). Query PHẢI
  được kiểm như `sanitizeQuery`, `validateQuery` trên mọi route (trả `400 INVALID_QUERY` như Directus). Engine này
  dùng chung cho mọi collection; feature 005 chỉ thêm route `/items`, singleton, response cache, `export`, event và bus
  `websocket.event`.
- **FR-041**: `/users`, `/roles`, `/policies`, `/access`, `/permissions` PHẢI có cùng route CRUD như Directus: `POST /`
  (object hoặc mảng), `GET /`, `SEARCH /` (body `query` ghi đè query string, `keys`), `GET /:pk`, `PATCH /` (mảng có
  khóa chính, `{keys, data}`, `{query, data}`), `PATCH /:pk`, `DELETE /` (mảng khóa, `{keys}`, `{query}`), `DELETE
  /:pk`; kiểm body theo `validateBatch`; đọc lại sau khi ghi và trả `204` không body khi lần đọc lại bị `403`; trả `204`
  khi không có payload; giới hạn `MAX_BATCH_MUTATION`.
- **FR-042**: Các khác nhau giữa năm controller PHẢI giữ nguyên: `SEARCH /users`, `SEARCH /roles` bỏ qua `keys`;
  `/policies`, `/access` dùng `keys` khi có; `/permissions` luôn đọc với `limit: -1` (cả `meta`); `GET /:pk` của
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
- **FR-047**: Route lạ của năm controller (ví dụ `GET /access/me`) PHẢI trả giống Directus.
- **FR-048**: `POST /users/me/tfa/enable` (cần `secret`, `otp`), `POST /users/me/tfa/disable` (cần `otp`) và `POST
  /users/:pk/tfa/disable` (chỉ admin) PHẢI giống Directus: kiểm OTP như `TFAService`, ghi `tfa_secret` qua engine ghi
  với accountability của người gọi (nên người không phải admin cần quyền `update` field `tfa_secret` như ở Directus),
  cùng lỗi (`TFA Secret is already set for this user`, `User "<id>" doesn't have TFA enabled`, `"otp" is invalid`,
  `401` khi không đăng nhập, `403` khi không phải admin). Gỡ D-09.10. Secret sinh ở một app bật được ở app kia.

**Quy tắc riêng của `directus_users`**

- **FR-050**: Email PHẢI được kiểm định dạng và tính duy nhất không phân biệt hoa thường (trong cùng lô và với DB),
  trả `FAILED_VALIDATION` hoặc `RECORD_NOT_UNIQUE` như Directus; sửa `email` cho nhiều khóa một lúc trả
  `RECORD_NOT_UNIQUE`.
- **FR-051**: Mật khẩu PHẢI kiểm theo `auth_password_policy` và hash bằng argon2 với `HASH_*` khi tạo, sửa; `password`,
  `token`, `tfa_secret` PHẢI trả `**********` khi có giá trị, `null` khi trống. Static token (`token`) đặt qua `/users`
  PHẢI dùng được để gọi Directus và app mới.
- **FR-052**: Payload có `tfa_secret` PHẢI bị từ chối với mọi người; `provider`, `external_identifier` bị từ chối với
  người không phải admin; khi được đổi thì `auth_data` về `null`; message giống Directus.
- **FR-053**: Sau khi sửa: `status` khác `active` xóa mọi session của user; đổi `email` hoặc `password` xóa session trừ
  session hiện tại; đổi `role` xóa cache hệ thống và cache quyền. Sau khi xóa user: đặt `null` cho
  `directus_comments.user_updated`, `directus_notifications.sender`, `directus_versions.user_updated` trước khi xóa, và
  xóa session của user.
- **FR-054**: Kiểm toàn vẹn số user PHẢI giống `validateUserCountIntegrity` cho mọi thao tác ghi user, role, policy,
  access có cờ ở Directus: còn ít nhất một admin `active` (`422 UNPROCESSABLE_CONTENT`), và giới hạn
  `USERS_ADMIN_ACCESS_LIMIT`, `USERS_APP_ACCESS_LIMIT`, `USERS_API_ACCESS_LIMIT` (`403 LIMIT_EXCEEDED` với `category`
  `Active Admin users`, `Active App users`, `Active API users`).

**Mời user và đăng ký**

- **FR-060**: `POST /users/invite` PHẢI kiểm body như Directus (`email` là email hoặc mảng email, `role` uuid v4,
  `invite_url` uri), kiểm `invite_url` theo `USER_INVITE_URL_ALLOW_LIST`, và với mỗi email: chưa có thì tạo user
  `status = invited` với role (cần quyền `create`); đã `invited` với role khác thì đổi role; trạng thái khác thì không làm
  gì. Trả `204`.
- **FR-061**: Mỗi chỗ Directus gửi email mời (user mới và user còn `invited`), app mới PHẢI ghi một dòng log `warn` có
  email người nhận và lý do không gửi, không có token hay link, và không làm request thất bại (giống FR-062 của feature
  003).
- **FR-062**: Token mời PHẢI là JWT `{email, scope: "invite"}` ký bằng `SECRET`, issuer `directus`, sống
  `USER_INVITE_TOKEN_TTL`. `POST /users/invite/accept` PHẢI nhận token của cả hai app, kiểm scope, trạng thái
  `invited`, chính sách mật khẩu, rồi đặt mật khẩu và `status = active` không qua accountability; lỗi giống Directus.
- **FR-063**: `POST /users/register` PHẢI qua rate limiter đăng ký (`RATE_LIMITER_REGISTRATION_*`, mặc định bật, 5 lần
  mỗi 60 giây mỗi IP), kiểm body và `verification_url` theo `USER_REGISTER_URL_ALLOW_LIST`, đọc
  `public_registration`, `public_registration_verify_email`, `public_registration_role`,
  `public_registration_email_filter`, và chờ `REGISTER_STALL_TIME` ở đúng các nhánh Directus chờ (email không khớp bộ
  lọc, email đã có, đăng ký xong; nhánh tắt đăng ký và `verification_url` sai trả ngay). User đã có với trạng thái
  `unverified` thì không tạo lại, chỉ làm lại bước gửi email xác minh. Email xác minh được thay bằng log như FR-061. Token xác minh là JWT `{email, scope: "pending-registration"}` sống
  `EMAIL_VERIFICATION_TOKEN_TTL`.
- **FR-064**: `GET /users/register/verify-email` PHẢI chuyển hướng như Directus (`/admin/users/<id>` khi thành công,
  `/admin/login` khi token sai định dạng) và trả lỗi như Directus với token sai scope hoặc user không còn
  `unverified`.

**Quy tắc riêng của role, policy, access, permission**

- **FR-070**: Sửa `parent` của role PHẢI kiểm vòng như `validateRoleNesting` (hai message ở US3), rồi xóa cache hệ
  thống và cache quyền. Xóa role PHẢI làm đúng thứ tự trong một transaction: xóa access của role, xóa preset của role,
  chuyển user của role sang `suspended` và `role = null`, đặt `parent = null` cho role con, xóa role, kiểm toàn vẹn,
  xóa cache. Các bước này chạy với accountability của người gọi như Directus.
- **FR-071**: `ip_access` của policy PHẢI được kiểm như Directus (`null`, `[]`, hoặc mảng IP, dải IP, CIDR; không
  `*`, không mask). Tạo policy chỉ xóa cache quyền; sửa `admin_access`, `app_access`, `ip_access`, `enforce_tfa` xóa
  cache hệ thống và cache quyền; xóa policy luôn xóa cache.
- **FR-072**: Dòng access PHẢI chấp nhận `role`, `user`, cả hai hoặc không cái nào (policy public), chỉ `policy` bắt
  buộc. Mọi thao tác ghi access PHẢI xóa cache hệ thống và cache quyền.
- **FR-073**: `GET /permissions` với accountability `app = true` PHẢI thêm quyền tối thiểu của app, lọc theo `filter`
  của request. Mọi thao tác ghi permission PHẢI xóa cache hệ thống, cache quyền và cache dữ liệu.

**Cache quyền**

- **FR-080**: Các hàm Directus bọc `withCache` PHẢI được cache với cùng namespace, cùng tham số đưa vào hash, cùng giá
  trị: `policies`, `roles-tree`, `raw-permissions`, `global-access`, `global-access-roles`, `global-access-user`,
  `policies-ip-access`, `share-info`. Key và giá trị app mới ghi PHẢI giống hệt key và giá trị Directus ghi cho cùng
  lời gọi, kể cả chỗ Directus không đưa IP vào hash.
- **FR-081**: Kho cache PHẢI giống Directus: có Redis thì cache hai lớp (bộ nhớ process tối đa 100 key, Redis namespace
  `REDIS_PERMISSIONS_NAMESPACE`, mặc định `permissions`, TTL `CACHE_SYSTEM_TTL`), không Redis thì bộ nhớ process tối đa
  500 key. Mỗi lần ghi, xóa PHẢI phát thông điệp bus như `@directus/memory` để mọi instance bỏ bản trong bộ nhớ.
- **FR-082**: App mới PHẢI xóa cache ở đúng các điểm Directus xóa (`clearSystemCache`: cache hệ thống, schema trong
  process, cache quyền, thông điệp bus `schemaChanged`): tạo, sửa, xóa access; tạo policy (chỉ cache quyền), sửa
  policy (bốn cờ), xóa policy; mọi thao tác ghi permission; sửa `parent` role, xóa role; sửa `role` của user.

**Dữ liệu ghi vào DB**

- **FR-090**: Mọi thao tác ghi năm collection qua API PHẢI ghi `directus_activity` và `directus_revisions` giống
  Directus (có khi có accountability, không có khi accountability là `null` như nhận lời mời, đăng ký, xác minh,
  `track/page`), cùng định dạng (uuid, ngày giờ, JSON, hash argon2, `action`, `collection`, `item`, `ip`,
  `user_agent`, `origin`).
- **FR-091**: Test `db-unchanged` và `readonly-account` của bộ test đối chiếu PHẢI được sửa theo: DB không đổi với mọi
  request đọc; với tài khoản DB chỉ đọc, mọi request đọc của feature này vẫn chạy không lỗi `500`.

**Biến môi trường**

- **FR-095**: App mới PHẢI hỗ trợ với cùng tên, mặc định và cách ép kiểu như Directus 11.17.4:
  `USER_INVITE_TOKEN_TTL` (`7d`), `USER_INVITE_URL_ALLOW_LIST`, `USER_REGISTER_URL_ALLOW_LIST`, `REGISTER_STALL_TIME`
  (`750`), `EMAIL_VERIFICATION_TOKEN_TTL` (`7d`), `RATE_LIMITER_REGISTRATION_ENABLED` (`true`),
  `RATE_LIMITER_REGISTRATION_POINTS` (`5`), `RATE_LIMITER_REGISTRATION_DURATION` (`60`). Các biến này PHẢI được gỡ khỏi
  nhóm "chưa hỗ trợ" của feature 001.

**Kiểm thử đối chiếu**

- **FR-100**: Bộ test đối chiếu PHẢI port `common/common.test.ts`, các fixture của `common/functions.ts` (chạy được với
  cả hai app), `check-item-permissions.test.ts`, và chạy lại nguyên bản các khẳng định `/users/me` của `ldap.test.ts`,
  `login.test.ts`, `refresh.test.ts` đã hoãn từ feature 003 (FR-100 của 003). `cache-purge.test.ts` và
  `tests/db/app/cache.test.ts` cần response cache (D-11) nên port ở feature 005.
- **FR-101**: Bộ test PHẢI có ma trận quyền chạy với cả hai app trên cùng DB, gồm ít nhất: loại accountability (không
  token, user không role, role một tầng, role lồng ba tầng, policy gắn vào user, admin qua role, admin qua user, `app`
  có và không, static token, token share); cấu hình permission (không có, đủ quyền, filter thường, filter với từng biến
  động và `$NOW(...)`, danh sách field một phần và `*`, validation, preset, nhiều policy khác field và filter cùng một
  collection); `ip_access` (khớp, không khớp, dải, CIDR); action `create`, `read`, `update`, `delete`, `share`; trên năm
  collection hệ thống và trên field tùy biến (kể cả field quan hệ) thêm vào `directus_users` qua API của Directus.
- **FR-102**: Bộ test PHẢI có ca dùng chéo cache: thay đổi quyền ở bên này có hiệu lực ở bên kia theo cả hai chiều, và
  so tập key `permissions:*` hai app ghi (mở rộng `src/schema/permissions-cache.test.ts` của feature 002).
- **FR-103**: Bộ test PHẢI có ca đối chiếu cho mời, nhận lời mời, đăng ký, xác minh email, rate limiter đăng ký, token
  mời và token xác minh dùng chéo hai chiều, bật và tắt TFA (secret sinh ở bên này bật ở bên kia, theo cả hai chiều),
  và query đủ loại (FR-040) trên năm endpoint với user admin và user có quyền một phần.

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
- **Cache quyền**: key `permissions:<namespace>-<hash>` trong Redis và bản trong bộ nhớ process (FR-080, FR-081).
- **Token mời, token xác minh**: JWT scope `invite`, `pending-registration`, không lưu DB.

## Khác biệt so với Directus *(mandatory)*

Thay đổi với bảng khác biệt của các feature trước:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-09.2 | Gỡ: `/users`, `/roles`, `/policies`, `/access`, `/permissions` làm ở feature này (trừ D-09.10) | FR-041 đến FR-073 |
| D-10 | Gỡ: mọi route xử lý token như Directus | FR-001, FR-004 |
| D-18 | Bỏ dòng cảnh báo "token bị bỏ qua"; giữ phần log khởi động | FR-001 |
| D-09.10 | Gỡ: bật, tắt TFA làm ở feature này (Clarifications) | FR-048 |
| D-11 | Giữ tới 005; nay áp cả cho `GET` của năm endpoint (không cache response, `Cache-Control: no-cache`) | Clarifications |
| D-12 | Thu hẹp: kiểm query (`sanitizeQuery`, `validateQuery`) làm ở feature này trên mọi route; chỉ còn `export` (xuất file) tới 005 | FR-040 |

Khác biệt mới:

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại | Gỡ khi |
|----|----------|------------------|---------|-------|------|--------|
| D-27 | Email mời user (`POST /users/invite`) | Gửi email chứa link mời qua `EMAIL_*` | Không gửi, ghi log `warn` có email người nhận, không có token hay link (FR-061). Response và dữ liệu ghi giống Directus | Nguyên tắc X | ngoài phạm vi | — |
| D-28 | Email xác minh đăng ký (`POST /users/register`) | Gửi email chứa link xác minh | Không gửi, ghi log như D-27 (FR-063). Response, thời gian chờ và dữ liệu ghi giống Directus | Nguyên tắc X | ngoài phạm vi | — |
| D-29 | Event `users.*`, `roles.*`, `policies.*`, `access.*`, `permissions.*` (filter và action, `create`, `update`, `delete`) | Phát cho extension và flow | Không phát | Extension ngoài phạm vi (Nguyên tắc XI); flow theo event thuộc feature 009 | ngoài phạm vi (flow: tạm thời) | 009 |
| D-30 | Thông điệp bus `websocket.event` khi ghi năm collection | Instance Directus bật WebSocket đẩy thay đổi tới client đang subscribe | App mới không đẩy; client realtime nối vào Directus không thấy thay đổi user, role, policy, access, permission do app mới ghi | Bus `websocket.event` làm ở feature 005 (Clarifications) | ngoài phạm vi (tạm thời) | 005 |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. Scope JWT `invite`, `pending-registration`, issuer `directus`, đường dẫn `/admin/accept-invite`,
  `/admin/users/<id>`, `/admin/login`, `/users/register/verify-email` trong link và chuyển hướng, namespace Redis
  `permissions`, tên cache `filter-context-*` giữ nguyên vì ảnh hưởng luồng (Nguyên tắc IX).

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4 (api 35.2.0). Khi spec không nói rõ, làm như code Directus.
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

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% ô của ma trận quyền (FR-101) cho cùng status, mã lỗi, message, body (trừ giá trị sinh ngẫu nhiên)
  và cùng thay đổi DB ở Directus và app mới, trên Postgres, MySQL và SQLite ở mỗi lần push.
- **SC-002**: 100% ca port ở FR-100 và FR-103 đạt với cả hai app.
- **SC-003**: Sau một thao tác ghi role, policy, access, permission hoặc role của user ở một app, request đầu tiên gửi
  tới app kia sau khi response trả về dùng quyền mới, trong 100% của ít nhất 20 lần thử mỗi chiều.
- **SC-004**: Với cùng accountability và cache trống, tập key `permissions:*` và giá trị hai app ghi trùng nhau 100%.
- **SC-005**: Với mỗi luồng ghi (CRUD năm collection, mời, nhận lời mời, đăng ký, xác minh), các dòng app mới ghi
  giống 100% dòng Directus ghi cho cùng request, trừ giá trị sinh ngẫu nhiên (id, token, thời điểm, salt của hash).
- **SC-006**: Với dữ liệu quy mô thiết kế (2.000 user, cây role ba tầng, mỗi user ít nhất ba policy, permission dùng
  biến động), p95 latency và throughput của `GET /users/me`, `GET /permissions/me` và `GET /users` (user không phải
  admin, có filter quyền) không tệ hơn Directus quá 10% (Nguyên tắc X), đo ở workflow benchmark hằng tuần.
- **SC-007**: Đội vận hành dùng nguyên file `.env` của Directus: không thêm hoặc đổi dòng cấu hình nào; các biến ở FR-095
  không còn trong dòng cảnh báo "biến chưa hỗ trợ".
- **SC-008**: App Directus 11.17.4 trỏ vào app mới (qua load balancer chung) mở được module User và màn hình quyền
  (Settings > Access Policies, Roles) và thực hiện được thêm, sửa, xóa user, role, policy, quyền như khi trỏ vào
  Directus.
