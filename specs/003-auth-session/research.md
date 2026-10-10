# Research: Xác thực và phiên đăng nhập (003)

Mỗi mục gồm Quyết định, Lý do, Đã cân nhắc. Mốc so sánh là Directus 11.17.4 (api 35.2.0). Điều gì chưa đo thì ghi
`[Suy luận]` và có task kiểm sớm.

## R1. Thư viện và phiên bản

- **Quyết định**: Thêm vào catalog `pnpm-workspace.yaml` đúng bản của `directus/pnpm-workspace.yaml`:
  `jsonwebtoken` 9.0.3 (`@types/jsonwebtoken` 9.0.10), `argon2` 0.44.0, `otplib` 12.0.1, `openid-client` 5.7.1,
  `ldapts` 8.1.3, `joi` 18.0.1, `flat` 6.0.1. Dùng lại bản đã có: `nanoid` 5.1.16 (bản vá của 5.1.6, cùng bảng chữ và
  độ dài), `cookie-parser` 1.4.7, `rate-limiter-flexible` 7.2.0, `ms`, `body-parser` 1.20.3. Port
  `directus/packages/validation` (244 dòng: `FailedValidationError`, `joiValidationErrorItemToErrorExtensions`) thành
  `@backoffice/validation`. Validate payload bằng Joi như file gốc (`local.ts`, `ldap.ts`), không dùng Zod.
- **Lý do**: Token, hash, OTP và message lỗi phải giống từng byte hoặc từng chữ: message Joi
  (`"email" must be a valid email`), cách ký JWT, định dạng hash argon2 (`$argon2id$v=19$m=65536,t=3,p=4$...`), secret
  và URL `otpauth://` của otplib, cách openid-client 5 dựng URL authorize và kiểm callback. Cùng bản thì cùng hành vi
  mà không cần test lại từng thư viện.
- **Đã cân nhắc**: openid-client 6 (API khác hẳn, không còn `Issuer`, `generators`), Joi 17 hoặc Zod (message khác),
  `bcrypt` (hash khác định dạng). Đều bị loại.
- **Rủi ro**: `argon2` là native module. Directus build trên `node:22-alpine`; `argon2` 0.44 có bản dựng sẵn cho glibc
  và musl `[Suy luận]`. Task build Docker image kiểm sớm. `pnpm audit` chạy trong CI như 001; có cảnh báo thì nâng
  bản vá và ghi lại như `nanoid`, `proxy-addr` của 001.

## R2. Bước `authenticate` chỉ chạy cho route của feature này (Q D-10 = C)

- **Quyết định**: Port `middleware/authenticate.ts`, `utils/get-accountability-for-token.ts`, `utils/jwt.ts`,
  `verify-session-jwt.ts`, `is-directus-jwt.ts`, `get-secret.ts` nguyên vẹn (trừ event `authenticate`, D-26). Ở đúng vị
  trí `app.use(authenticate)` của `directus/api/src/app.ts` (sau `/server/ping`, trước `schema`), `app-pipeline.ts`
  chọn theo path:
  - `^/auth(/|$)` và `^/users/me/tfa/generate/?$` (không phân biệt hoa thường, như router Express) đi qua
    `authenticate`;
  - mọi path khác giữ `publicAccountability` của 001 (D-10, kèm cảnh báo "token bị bỏ qua" của D-18).
  Có comment `ponytail:` ghi giới hạn này và nói feature 004 thay bằng `app.use(authenticate)` cho mọi path.
- **Lý do**: Ở Directus, bước `authenticate` chạy cho mọi route, kể cả `/auth/*`. Ví dụ: `POST /auth/refresh` kèm
  session cookie đã hết hạn trả `401 TOKEN_EXPIRED` trước khi tới route. Route mới phải giống điều đó. Các route của
  001 giữ D-10 tới 004 (Clarifications).
- **Đã cân nhắc**: Chạy `authenticate` cho mọi path ngay ở 003 (bị loại: trái câu trả lời Q D-10). Kiểm token riêng
  trong controller TFA (bị loại: khác thứ tự lỗi của Directus và phải viết lại ở 004).

## R3. Route Nest cho provider động

- **Quyết định**: `AuthController` (Nest, `@Controller('auth')`) có các route cố định: `GET /auth`, `POST refresh`,
  `POST logout`, `POST password/request`, `POST password/reset`, `POST login` (provider `default`, trừ khi
  `AUTH_DISABLE_DEFAULT`). Thêm 4 route động: `POST login/:provider`, `GET login/:provider`,
  `POST login/:provider/callback`, `GET login/:provider/callback`. Controller tìm provider trong `AUTH_PROVIDERS` theo
  thứ tự khai báo, so tên không phân biệt hoa thường (như `router.use('/login/<name>')` của Express). Rồi controller gọi
  handler của driver theo bảng:

  | Driver | `POST login/:p` | `GET login/:p` | `POST login/:p/callback` | `GET login/:p/callback` |
  |--------|-----------------|----------------|--------------------------|-------------------------|
  | `local`, `ldap` | login | 404 | 404 | 404 |
  | `openid`, `oauth2` | 404 | bắt đầu SSO | `303` sang GET | callback |

  Không có provider hoặc ô 404 thì ném `RouteNotFoundError`, như request rơi qua router con của Directus. Handler của
  mỗi driver port từ hàm `createXAuthRouter` vào cùng file driver (một object handler thay cho `Router`), giữ thứ tự
  câu lệnh và log. `UsersController` chỉ có `POST /users/me/tfa/generate`. `OPTIONS` tới các path này trả `Allow`
  như router Express 4: `/auth` → `GET,HEAD`; `refresh`, `logout`, `password/*`, `login`, `login/<local|ldap>`,
  `/users/me/tfa/generate` → `POST`; `login/<openid|oauth2>` → `GET,HEAD`; `login/<openid|oauth2>/callback` →
  `POST,GET,HEAD`. Phần này thêm vào `middleware/router-options.ts` của 001, dựng từ danh sách provider đã đăng ký.
- **Lý do**: Giữ quy ước của 001: route là controller Nest mỏng, logic ở service, lỗi đi qua filter chung. Bảng trên
  tái tạo đúng các trường hợp router Express của Directus trả hoặc không trả (đã đọc `controllers/auth.ts` và router
  của từng driver).
- **Đã cân nhắc**: Mount nguyên `authRouter` Express trước route Nest (bị loại: lệch quy ước controller của 001, và
  `OPTIONS` của router Express 5 chưa được đo so với Express 4).

## R4. Express 5 (app mới) khác Express 4.21.2 (Directus) ở cookie

- **Quyết định**: Thêm `utils/clear-cookie.ts` (`Backoffice:`): `res.cookie(name, '', { expires: new Date(1),
  path: '/', ...options })`. Đây đúng là `res.clearCookie` của Express 4.21.2: đã đọc mã nguồn trên unpkg, hàm này
  `merge({ expires: new Date(1), path: '/' }, options)` rồi gọi `res.cookie`, và `res.cookie` tính lại `expires` từ
  `maxAge`. Mọi chỗ Directus gọi `res.clearCookie` (logout, `authenticate`, callback SSO) dùng helper này. Body của
  `POST` callback SSO parse bằng `body-parser` 1.20.3 `urlencoded({ extended: false })` (bản Express 4.21.2 kèm), như
  001 làm với JSON.
- **Lý do**: Express 5.2.1 `res.clearCookie` xóa `maxAge` và luôn đặt `Expires` ở quá khứ. Còn Directus truyền
  `REFRESH_COOKIE_OPTIONS` có `maxAge`, nên header thật của Directus khi logout là cookie rỗng với `Max-Age=<TTL>` và
  `Expires` ở tương lai. Dùng `res.clearCookie` của Express 5 sẽ lệch header `Set-Cookie` mà spec yêu cầu so
  (SC-001, ghi chú cho 003 ở research R4 của 001). `res.cookie` (gói `cookie` 0.7.x ở cả hai bản) và body của
  `res.redirect` giống nhau ở hai bản (đã so mã nguồn).
- **Đã cân nhắc**: Dùng `res.clearCookie` của Express 5 rồi ghi khác biệt (bị loại: lệch Directus mà sửa được với 3
  dòng). Cài Express 4 cho riêng route auth (bị loại: Nest 12 chỉ chạy Express 5).

## R5. Phần ghi `directus_users`, activity, revision khi chưa có `ItemsService` (005)

- **Quyết định**: Port **rút gọn** các service, đúng tên và đường dẫn sẽ có ở 004, 005. Chỉ port những nhánh mà luồng
  của 003 chạy qua:
  - `services/items.service.ts`: `createOne`, `createMany` (lấy khóa chính bằng `returning`, dự phòng `max(id)` như
    Directus), `readOne`, `readMany`, `readSingleton` (field phẳng, không lọc, không quan hệ), `updateOne`, `updateMany`.
    Activity và revision ghi như `updateMany` của Directus: snapshot gồm các field không quan hệ, dùng
    `getRelationsForCollection` (đã có ở `@backoffice/utils`), qua `prepareDelta`. Có `validateUserCountIntegrity`,
    `translateDatabaseError`, `transaction`.
  - `services/payload.service.ts`: `transformers` (đủ 13 special), `processValues`, `processField`,
    `processGeometries`, `processDates`, `prepareDelta`. Chưa có `processM2O`, `processA2O`, `processO2M`,
    `processAggregates`, hàm JSON.
  - `services/users.service.ts`: `createOne`, `updateOne`, `updateMany`, `checkUniqueEmails`, `checkPasswordPolicy`,
    `clearUserSessions`, `getUserByEmail`, `requestPasswordReset` (không gửi mail, FR-062), `resetPassword`,
    `clearCaches`.
  - `services/activity.service.ts`, `services/revisions.service.ts`: lớp con của `ItemsService` như Directus.
  - `services/tfa.service.ts`: `verifyOTP`, `generateTFA` (`enableTFA`, `disableTFA` ở 005, FR-051).
  - `services/settings.service.ts`: thêm `readSingleton({ fields })`, cùng SQL như `readProjectInfo` của 001
    (`ORDER BY id LIMIT 1`, mặc định theo schema khi không có dòng).
  Mỗi nhánh chưa port ném `Error('<tên> is not available before feature 005')`. Các nhánh đó gồm accountability không
  phải admin cần kiểm quyền, payload lồng quan hệ, và query có `filter`, `deep`, `aggregate`. Comment `ponytail:` nêu
  giới hạn. Cần thêm `database/helpers/date` (port đủ), `database/helpers/schema` (chỉ `formatUUID`, phần còn lại ở
  006), `database/errors/**` (đủ 5 dialect), `utils/{transaction,validate-keys,validate-user-count-integrity}.ts`,
  `utils/fetch-user-count/**`, `telemetry/utils/{check,should-check}-user-limits.ts`,
  `permissions/modules/validate-remaining-admin`.
- **Các nhánh 003 chạy qua** (đã đọc code Directus):
  1. Đăng nhập, logout: `ActivityService.createOne` (accountability `null`; `timestamp` qua special `date-created`).
  2. Khóa user khi hết lượt: `knex.update({status: 'suspended'})`, rồi activity `update`, rồi
     `RevisionsService.createOne` với `data = prepareDelta(user)` (user lúc đó vẫn `active`, giống Directus) và
     `delta = { status: 'suspended' }`.
  3. Đặt lại mật khẩu: `UsersService.updateOne(id, { password, status: 'active' })`, accountability mặc định với
     `admin: true`. Đi qua hash argon2 (`HASH_*`), activity `update`, revision (snapshot, delta có `password` che thành
     `**********`), `validateUserCountIntegrity` (cờ `UserLimits`), rồi xóa mọi session của user.
  4. SSO tạo user: `UsersService.createOne` (accountability `null`, nên không có activity hay revision): kiểm email
     trùng, `uuid` cho `id`, `RecordNotUnique` thành `InvalidProviderError`.
  5. SSO cập nhật user: `UsersService.updateOne` (accountability `null`). Có `email` (`SYNC_USER_INFO`) thì xóa mọi
     session của user. Có `role` (`ROLE_MAPPING`, `GROUP_DN`) thì kiểm số admin còn lại và gọi `clearSystemCache` của 002.
     LDAP luôn gọi `updateOne`, kể cả payload rỗng.
- **Lý do**: FR-082 cần cùng dòng DB như Directus mà `/users`, `/items` chưa có. Port đúng đường dẫn giúp 004, 005 làm
  tiếp chứ không viết lại. Ném lỗi rõ ở nhánh chưa port tránh cho feature sau âm thầm dùng bản thiếu.
- **Đã cân nhắc**: Port đủ `ItemsService` và run-ast ngay (bị loại: là phạm vi của 005, gấp nhiều lần 003). Ghi bằng
  knex thẳng trong `AuthenticationService` (bị loại: lệch định dạng revision, kiểu ngày giờ, JSON theo vendor, và phải
  viết lại ở 005).

## R6. So dữ liệu DB hai bên (SC-005)

- **Quyết định**: Helper test `db-effects.ts` đọc (chỉ SELECT, bằng knex trên host) các dòng mới của
  `directus_sessions`, `directus_activity`, `directus_revisions` và dòng `directus_users` của user test, trước và sau mỗi
  kịch bản. Giá trị sinh ngẫu nhiên đổi thành dấu hiệu kiểu: token 64 ký tự, `id` tự tăng, uuid, thời điểm (ghi lại
  là trong khoảng của kịch bản), hash argon2 (kiểm tiền tố và tham số), cùng `user_agent` và `ip` do test đặt. `data`,
  `delta` của revision so sau khi parse JSON, không so thứ tự key. Thứ tự key vẫn giữ như Directus vì cùng thứ tự
  field, nhưng không phải điều kiện của test.
- **Lý do**: Directus đọc revision bằng parse JSON, nên thứ tự key không đổi hành vi. So kiểu và định dạng ngày giờ
  theo từng vendor là chỗ dễ lệch nhất (Postgres, MySQL, SQLite ở bộ reduced).
- **Đã cân nhắc**: So từng byte (bị loại: thời điểm và token luôn khác).

## R7. Bộ đếm đăng nhập sai dùng chung

- **Quyết định**: Port như `services/authentication.ts`: `createRateLimiter('RATE_LIMITER', { duration: 0 })` (hàm có
  từ 001), `points` gán từ `auth_login_attempts` ở mỗi lần đăng nhập, key là id user. Key trên Redis là
  `<keyPrefix>:<userId>`, mặc định `rlflx:<userId>`, cùng prefix với limiter IP của 001. Limiter tạo ở lần đăng nhập
  đầu, không tạo lúc import module (như hằng số của 001: không đọc cấu hình trước bước kiểm khởi động). Client Redis
  của limiter đóng khi SIGTERM (`onServerShutdown`, đã có ở 001). Cảnh báo một instance (dòng 5 của
  `contracts/startup.md` 001) với lý do `RATE_LIMITER_STORE is "memory"` nay áp dụng cả khi `RATE_LIMITER_ENABLED=false`,
  vì bộ đếm này luôn chạy.
- **Lý do**: Cùng key và cùng giá trị thì hai app đếm chung (SC-004). Thời điểm tạo limiter không thay đổi gì ở API.
- **Đã cân nhắc**: Tạo limiter lúc import như Directus (bị loại: đọc env trước bước kiểm khởi động, trái quy ước của
  001).

## R8. Cache quyền: thêm namespace

- **Quyết định**: Port `permissions/lib/fetch-roles-tree.ts` (`withCache('roles-tree')`) và
  `permissions/modules/fetch-global-access/fetch-global-access.ts` (`global-access`, `global-access-roles`,
  `global-access-user`) bằng `withCache` của 002. Hàm gốc port vào `libs/utils/src/node/` (`fetch-roles-tree.ts`,
  `fetch-global-access/**`, kèm test). `permissions-cache.test.ts` của 002 so thêm key và giá trị của 4 namespace này.
- **Lý do**: `getAccountabilityForToken` và `login`/`refresh` gọi hai hàm này ở mỗi request. Cache dùng chung giữ chi
  phí như Directus (SC-007) và để xóa cache ở một bên có hiệu lực ở bên kia (002).

## R9. Đăng ký provider khi khởi động

- **Quyết định**: Port `auth.ts` (`registerAuthProviders`, `getAuthProvider`). Gọi ở bước mới 16b, sau `validateStorage`,
  như thứ tự `createApp` của Directus. Khác Directus ở một chỗ: driver `saml` không được tạo instance; log `warn`
  `[mới]` một dòng cho mỗi provider đó và bỏ qua (FR-070, FR-078). Provider `saml` vì vậy không có trong registry, và
  refresh hay logout của user SAML đi vào nhánh `getAuthProvider` của Directus: log `error`
  `Auth provider not configured`, trả `503 INVALID_PROVIDER_CONFIG` (Q SAML khi lập plan). Mọi nhánh khác giữ như
  Directus:
  - thiếu driver hoặc driver lạ thì log `warn`;
  - tên `default` thì log `error` và `process.exit(1)`;
  - constructor của OpenID, OAuth2, LDAP ném `InvalidProviderConfigError` khi thiếu biến bắt buộc;
  - OpenID tải metadata ngay sau khi tạo (không chặn), và `process.exit(1)` khi lỗi mà
    `ISSUER_DISCOVERY_MUST_SUCCEED` không phải `false`.
  `GET /auth` dùng `getAuthProviders()` (đã có ở 001, giữ nguyên vì `get-field-system-rows.ts` cũng dùng), rồi controller
  lọc bỏ provider `saml` (D-24).
- **Lý do**: Giống thứ tự và lỗi khởi động của Directus. Lọc ở controller để danh sách provider trong option của field
  `directus_users.provider` (feature 006) vẫn giống Directus.

## R10. IdP và LDAP trong môi trường test

- **Quyết định**:
  - IdP giả lập viết tay: `tests/parity/idp/server.mjs`, chỉ dùng `node:http` và `node:crypto`, ký RS256 bằng khóa
    sinh khi khởi động. Chạy bằng image `node:22-alpine`, mount script, không build. Có discovery, `jwks`, `authorize`
    (tự duyệt, chọn user theo tham số test thêm vào), `token` (`authorization_code` với PKCE `S256`/`plain`,
    `refresh_token`), `userinfo` (dùng cho cả profile OAuth2). Có endpoint quản trị cho test: đặt claims của user, buộc
    refresh trả `invalid_grant`. Dùng cho provider `openid` và `oauth2`.
  - LDAP: image `cleanstart/openldap:latest` như `directus/tests/blackbox/docker-compose.yml`. Test seed bằng `ldapts`
    như `ldap.test.ts` của blackbox (base DN, `ou=users`, user, nhóm).
  - SAML: không có IdP. Chỉ cần Directus khởi động với metadata tĩnh lấy từ `common/config.ts` của blackbox, để kiểm
    D-24 và FR-078.
- **Lý do**: Test cần điều khiển claims, nhóm, lỗi `invalid_grant` theo từng ca, và cần khởi động nhanh. Cả hai app dùng
  cùng `openid-client` 5.7.1, nên test đo hành vi phía client, không đo IdP.
- **Đã cân nhắc**: Keycloak (bị loại: khởi động 30 đến 60 giây, cấu hình realm dài, khó buộc lỗi theo ca),
  `navikt/mock-oauth2-server` (bị loại: JVM, khó buộc `invalid_grant` theo ca). Nhánh khóa tài khoản qua
  `userAccountControl` không kiểm được trên OpenLDAP (thuộc tính của Active Directory), nên kiểm bằng unit test port từ
  `ldap.test.ts` của Directus.
- **Rủi ro**: `cleanstart/openldap` không kéo được thì dùng `osixia/openldap:1.5.0` và đổi DN seed `[Suy luận]`.

## R11. Test đối chiếu cho luồng có trạng thái

- **Quyết định**:
  - Request không trạng thái (lỗi đăng nhập, `GET /auth`, `OPTIONS`, kiểm `redirect`) dùng `parity()` có sẵn, thêm:
    - so header `set-cookie`: tên, giá trị phân loại thành rỗng, JWT hoặc token, và thuộc tính `Max-Age`, `Domain`,
      `Path`, `HttpOnly`, `Secure`, `SameSite`; `Expires` chỉ so là quá khứ hay tương lai;
    - hook `normalize` cho body và `location`: JWT giải mã rồi so claim trừ `iat`, `exp`; kiểm `exp - iat`; tham số
      `state`, `nonce`, `code_challenge` thay bằng dấu hiệu.
  - Luồng có trạng thái (refresh, logout, khóa user, đặt lại mật khẩu, SSO) dùng runner `scenario()` mới. Cùng một chuỗi
    bước chạy lần lượt với Directus rồi với app mới; mỗi bên có fixture riêng, giống nhau trừ email và id. Runner ghi
    transcript (status, body và header đã chuẩn hóa, dữ liệu DB đã chuẩn hóa theo R6) rồi so hai transcript.
  - Dùng chéo (FR-101) dùng runner `matrix()`: token cấp ở A, dùng ở B, theo cả 4 cặp.
  - Fixture (user, role, policy, static token, settings, share) tạo qua API Directus (FR-103) bằng `directus-api.ts`. Test
    không ghi DB từ host, nên chạy được cả trên SQLite của CI Linux.
  - Bộ đếm sai và thời gian chờ chạy tuần tự (`fileParallelism: false` đã có). Test đổi `auth_login_attempts` thì trả
    lại giá trị cũ ở `afterAll`.
  - `suite.ts`: thêm `src/auth/**` vào full. Reduced (MySQL, SQLite) thêm `login`, `login-db`, `refresh`, `logout`, `password`, vì
    định dạng ngày giờ và JSON khác theo vendor. Test SSO cần profile `sso`, chạy trên Postgres full và nightly.
  - `accepted-differences.ts`:
    - xóa D-09.1;
    - D-09.2 bỏ `/users/me/tfa/generate`, thêm D-09.10 (gỡ ở 005);
    - D-10 thu hẹp, loại `/auth`, `/auth/*`, `/users/me/tfa/generate`;
    - thêm D-23 (`doc`), D-24 (`http`, `GET /auth` và route provider `saml`), D-25 (`http`, `otpauth_url`), D-26
      (`doc`).
  - `db-unchanged` và `readonly-account` thêm các request auth không ghi DB: `GET /auth`, đăng nhập sai, refresh với
    token sai, `password/request` với email không có, TFA với token sai.
- **Lý do**: `parity()` gửi hai request cùng lúc. Gửi cùng một refresh token cho hai app thì một bên luôn thất bại. Khác
  biệt D-10 hiện đang che mọi ca Directus trả `401`, gồm cả đăng nhập sai, nên phải thu hẹp.
- **Đã cân nhắc**: Chạy nguyên bộ blackbox bằng supertest với hai URL (bị loại: chưa có runner; fixture của blackbox
  cần `/users`, `/roles`, `/policies` của app mới, tới 004 mới có).

## R12. Benchmark auth với 2.000 kết nối (SC-007, Q Benchmark = B)

- **Quyết định**:
  - Script riêng `tests/benchmark/src/auth.ts`, dùng lại `compare.ts`. Chạy trong job CI mới `benchmark-auth` (sau
    `parity`, song song với `benchmark`, timeout 60 phút), so Directus chính (8155) với app mới (8156).
  - Seed bằng knex trên host (benchmark chỉ chạy Postgres):
    - một role có một policy `app_access`, tạo qua API Directus;
    - 2.000 user `default` dùng chung một hash argon2, lấy từ một user tạo qua Directus rồi chép;
    - 2.000 user provider `benchmark` (không cần mật khẩu);
    - mỗi vòng đo một lô session mới.
  - Ba endpoint, mỗi kết nối có ngữ cảnh riêng qua `requests[].setupRequest` và `onResponse` của autocannon:
    - `POST /auth/login`: user thứ i;
    - `POST /auth/refresh` chế độ `json`: token xoay vòng theo response;
    - `POST /users/me/tfa/generate`: access token ký sẵn bằng `SECRET`, user provider `benchmark`, trả `200` không cần
      mật khẩu và không ghi DB. Đây là cách đo chi phí bước xác thực, vì ở 003 đây là route duy nhất cần đăng nhập
      (Q D-10).
  - `connections: 2000`, `timeout: 120` giây, giữ cách đo của 001 (req/s ở pha thông lượng, p95 ở tốc độ cố định bằng
    80% req/s của Directus) và ngưỡng 10%.
  - Cả hai app chạy với cùng cấu hình mặc định: `UV_THREADPOOL_SIZE` mặc định 4, pool DB mặc định, `LOGIN_STALL_TIME`
    500.
- **Lý do**: Người dùng chọn tải 2.000 kết nối đồng thời và chặn CI. Đăng nhập bị giới hạn bởi argon2 chạy trên thread
  pool (4 luồng) và thời gian chờ 500 ms ở cả hai app, nên so sánh vẫn công bằng. Hàng đợi khoảng 2.000 / req/s giây,
  cần `timeout` lớn để không tính thành lỗi.
- **Rủi ro**:
  - Autocannon có tính request còn dở lúc hết vòng là lỗi không `[Suy luận]`. Task đầu của phần benchmark kiểm việc
    này; nếu có thì đo theo `amount` thay cho `duration`.
  - p95 ở pha thông lượng có thể tới hàng chục giây, nhưng cổng không dùng p95 của pha này.
  - Thêm khoảng 25 phút CI cho job mới.

## R13. Log

- **Quyết định**: Log của Directus port nguyên (`[OpenID] ...`, `[OAuth2] ...`, `[LDAP] ...`,
  `Auth provider not configured`, `Missing driver definition for "<name>" auth provider.`, `Invalid "<driver>" auth
  driver.`, `Cannot override "default" auth provider.`, `[email] <lỗi>` khi `password/request` gặp lỗi khác
  `INVALID_PAYLOAD`). Log `[mới]`:
  - dòng cảnh báo provider `saml` khi khởi động;
  - dòng `warn` thay cho email đặt lại mật khẩu: có email, không có token hay link (FR-062).
  Che token và cookie trong log đã có từ 001 (`req.headers.authorization`, `req.headers.cookie`, `set-cookie`,
  `access_token`). Không có metric mới, vì Directus không có metric cho auth.
- **Lý do**: Nguyên tắc X, IX. Danh sách message ở [contracts/startup-logs.md](./contracts/startup-logs.md).

## R14. TFA, token đặt lại mật khẩu, share

- **Quyết định**:
  - OTP và secret dùng `otplib` 12.0.1 `authenticator` mặc định (TOTP SHA1, 6 số, 30 giây, cửa sổ mặc định), như
    Directus. Issuer là `project_name`, hoặc `Backoffice` (D-25).
  - Token đặt lại mật khẩu ký như Directus (`{ email, scope: 'password-reset', hash: getSimpleHash('' + password) }`,
    `1d`, issuer `directus`). Test tự ký token cùng định dạng: đọc hash hiện tại từ DB, dùng `SECRET` của env, vì cả
    hai app không gửi email.
  - Refresh session của share: fixture tạo share qua API Directus, đăng nhập share qua `POST /shares/auth` của Directus
    (route của 010), refresh ở app mới.
- **Lý do**: FR-053, FR-061, FR-021, FR-101.

## R15. Cookie và hằng số đọc env

- **Quyết định**: `REFRESH_COOKIE_OPTIONS` và `SESSION_COOKIE_OPTIONS` của `directus/api/src/constants.ts` thành getter
  trong `apps/api/src/constants.ts`, như `RESUMABLE_UPLOADS` của 001. Giá trị giống Directus: `httpOnly`, `domain`,
  `maxAge` từ TTL, `secure`, `sameSite` mặc định `strict` khi biến rỗng. `DEFAULT_AUTH_PROVIDER = 'default'`.
- **Lý do**: Không đọc cấu hình lúc import (quy ước 001), giá trị như Directus.

## R16. Biến môi trường

- **Quyết định**: Chuyển sang nhóm A (đang dùng):
  - `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `REFRESH_TOKEN_COOKIE_*`;
  - `SESSION_COOKIE_TTL`, `SESSION_COOKIE_DOMAIN`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAME_SITE`,
    `SESSION_REFRESH_GRACE_PERIOD`;
  - `LOGIN_STALL_TIME`, `PASSWORD_RESET_URL_ALLOW_LIST`, `HASH_.+`, `USERS_*_ACCESS_LIMIT`;
  - `AUTH_PROVIDERS`, `AUTH_ALLOWED_PUBLIC_URLS`, `AUTH_DISABLE_DEFAULT`, và mọi mẫu `AUTH_.+_*` của
    `directus-variables.ts` trừ `AUTH_.+_IDP.+`, `AUTH_.+_SP.+` (chỉ SAML dùng).
  Vẫn ở nhóm C:
  - `AUTH_.+_IDP.+`, `AUTH_.+_SP.+`, `EMAIL_*`;
  - `EMAIL_VERIFICATION_TOKEN_TTL`, `REGISTER_STALL_TIME`, `USER_INVITE_*`, `USER_REGISTER_URL_ALLOW_LIST` (004).
  Một provider SAML vì vậy cho 2 loại dòng log: dòng "biến chưa hỗ trợ" chung của 001 (liệt kê `AUTH_SAML_IDP_*`...)
  và đúng 1 dòng cảnh báo provider (SC-006).
- **Lý do**: Nguyên tắc VIII. Biến app mới không đọc thì phải nằm ở nhóm C.
