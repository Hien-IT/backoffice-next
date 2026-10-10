---

description: "Danh sách task cho feature 003: Xác thực và phiên đăng nhập"
---

# Tasks: Xác thực và phiên đăng nhập

**Input**: Tài liệu thiết kế trong `/specs/003-auth-session/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test. Test gốc của Directus đi kèm file port thì port theo.
- Mọi endpoint mới có test đối chiếu chạy với cả Directus 11.17.4 thật lẫn app mới (research R11).

**Organization**: Task nhóm theo user story của spec. Phase 1 và 2 là nền chung: thư viện, hạ tầng test, các service
port rút gọn và bước `authenticate`.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task. Phase 1, 2 và Polish không có nhãn này.
- File port từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn nguồn>`. Mỗi task port ghi các cặp
  `{ "source", "dest" }` (source tính từ `directus/`) vào `tools/port-manifest/003-T###.json`, theo đúng ID task.
  Chạy `node tools/check-port-headers.mjs` sau khi ghi. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Chỗ khác nguồn ghi comment `// Backoffice: <lý do>`. Giới hạn tạm ghi comment `// ponytail: <giới hạn>, <khi nào nâng>`.
- Không đọc `useEnv()` ở cấp module (quy ước 001, research R15).
- Không phát event (`emitter`) ở mọi file port (D-26). Thay chỗ gọi bằng comment `// Backoffice: events not emitted
  (D-26)`.
- Tên biến, comment, commit viết tiếng Anh. Tài liệu viết tiếng Việt.
- Test viết trước và phải fail trước khi làm phần tương ứng.
- Quy trình merge thẳng `main` (memory của dự án): mỗi nhóm task commit và push xong thì CI phải xanh.

## Quy ước đường dẫn

- API: `apps/api/src/**`. Thư viện: `libs/<tên>/src/**`.
- Test đối chiếu: `tests/parity/src/**`. Danh sách khác biệt: `tests/parity/accepted-differences.ts`.
- Benchmark: `tests/benchmark/**`. Công cụ: `tools/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/packages/*`, `directus/tests/blackbox/**`.

## Tóm tắt

- Tổng số task: **72**
- Số task đánh dấu [P]: **38**
- MVP gợi ý: **User Story 1 + User Story 2 + User Story 3** (Phase 1 đến 5).

  Lý do không giao US1 một mình: access token sống 15 phút. Không có refresh (US2) thì sau 15 phút người dùng bị đăng
  xuất khi request rơi vào app mới. Không có bước `authenticate` (US3) thì app mới không chứng minh được nó nhận token
  của Directus.

| Phase | Số task |
|-------|---------|
| Phase 1: Setup | 9 |
| Phase 2: Foundational | 17 |
| Phase 3: User Story 1 - Đăng nhập, token dùng chéo | 6 |
| Phase 4: User Story 2 - Refresh và logout ở mọi instance | 5 |
| Phase 5: User Story 3 - Xác thực token ở route của 003 | 5 |
| Phase 6: User Story 4 - Chống dò mật khẩu, trạng thái user | 4 |
| Phase 7: User Story 5 - TFA | 2 |
| Phase 8: User Story 6 - Quên và đặt lại mật khẩu | 4 |
| Phase 9: User Story 7 - SSO OpenID, OAuth2, LDAP | 11 |
| Phase 10: Polish & Cross-Cutting Concerns | 9 |

Phase 9 có thể tách thành feature con nếu cần giữ mỗi lần merge nhỏ (SPECKIT-GUIDE §9).

---

## Phase 1: Setup (phụ thuộc, lib mới, hạ tầng test)

**Purpose**: Thêm phụ thuộc cùng bản Directus, lib `@backoffice/validation`, kiểu dùng chung, profile `sso` và helper
test đối chiếu cho luồng có trạng thái.

- [X] T001 Thêm vào `catalog:` của `pnpm-workspace.yaml`, đúng bản `directus/pnpm-workspace.yaml`: `jsonwebtoken: 9.0.3`,
  `'@types/jsonwebtoken': 9.0.10`, `argon2: 0.44.0`, `otplib: 12.0.1`, `openid-client: 5.7.1`, `ldapts: 8.1.3`,
  `joi: 18.0.1`, `flat: 6.0.1`. Thêm các gói này vào `apps/api/package.json` (types vào devDependencies). Chạy
  `pnpm install`, rồi `pnpm audit --prod --audit-level=high`; có cảnh báo mới thì ghi lại và báo trước khi đi tiếp
  (research R1).
- [X] T002 [P] Tạo `libs/validation` theo mẫu `libs/pressure`: `package.json` (`@backoffice/validation`, ESM, phụ thuộc
  `@backoffice/errors`, `@backoffice/types`, `joi`), `tsconfig*.json`, `vitest.config.ts` (coverage 80%). Port
  `directus/packages/validation/src/**` kèm test và `__snapshots__`. Thêm `"@backoffice/validation": "workspace:*"`
  vào `apps/api/package.json`. Chạy `node tools/check-package-names.mjs` và test của lib. Ghi manifest. (sau T001)
- [X] T003 [P] Port phần kiểu cần dùng sang `libs/types/src/`: `Item`, `PrimaryKey`, `MutationOptions`,
  `MutationTracker` từ `packages/types/src/items.ts`; `LoginResult` từ `authentication.ts`; `PayloadAction`, kiểu của
  `transformers` từ `payload.ts`; `UserIntegrityCheckFlag` từ `users.ts`. Export từ `libs/types/src/index.ts`. Mở rộng
  `libs/types/src/index.test.ts` cho các export mới. Ghi manifest.
- [X] T004 [P] Kiểm build image với `argon2` native: `docker build -f apps/api/Dockerfile .` sau T001, chạy container,
  gọi `node -e "require('argon2')"` trong đó. Lỗi thì sửa `apps/api/Dockerfile` (cài build tools ở stage builder như
  Directus) và ghi vào "Ghi chú khi làm" (research R1, rủi ro).
- [X] T005 [P] IdP giả lập: `tests/parity/idp/server.mjs`, chỉ dùng `node:http`, `node:crypto` (research R10).
  - Khóa RS256 sinh khi khởi động. Endpoint: `/.well-known/openid-configuration`, `/jwks`, `/authorize` (tự duyệt, trả
    `302` về `redirect_uri` với `code`, `state`; chọn user theo query `user`), `/token` (`authorization_code` với PKCE
    `S256` và `plain`; `refresh_token`; Basic hoặc `client_secret_post`), `/userinfo` (Bearer), `/health`.
  - Quản trị cho test: `POST /__users` (đặt claims theo `sub`), `POST /__refresh-error` (lần refresh kế tiếp trả
    `invalid_grant`), `POST /__reset`.
  - id_token có `iss`, `sub`, `aud`, `exp`, `iat`, `nonce`; issuer lấy từ env `IDP_ISSUER`.
  - Unit test `tests/parity/idp/server.test.mjs` (chạy trong target `test`, không cần Docker): discovery, PKCE đúng và
    sai, refresh, `invalid_grant`.
- [X] T006 Profile `sso` của môi trường đối chiếu (research R10, R11).
  - `tests/parity/docker-compose.yml`, profile `sso`:
    - `idp`: `node:22-alpine`, mount `./idp`, lệnh `node /idp/server.mjs`, cổng `6110:9000`, healthcheck `wget /health`;
    - `directus-sso` (8955) và `backoffice-api-sso` (8956) theo mẫu cặp `ratelimit`, `env_file` vendor +
      `./env/profile-sso.env`, `depends_on` `idp` healthy.
  - `tests/parity/env/profile-sso.env`:
    - `PUBLIC_URL=http://127.0.0.1:8955`, `AUTH_ALLOWED_PUBLIC_URLS=http://localhost:8955/api`;
    - `AUTH_PROVIDERS=oidc,local2,saml` (provider `oauthmock`, `github`, `ldap` và service `ldap` thêm ở T062, sau
      khi constitution 1.3.0 được duyệt);
    - `oidc`: driver `openid`, `ISSUER_URL=http://idp:9000`, `ALLOW_PUBLIC_REGISTRATION`, `DEFAULT_ROLE_ID`,
      `ROLE_MAPPING` (json), `GROUP_CLAIM_NAME`, `SYNC_USER_INFO`;
    - `saml`: như `directus/tests/blackbox/common/config.ts`;
    - `local2`: driver `local`.
  - Role cố định `d70c0943-5b55-4c5d-a613-f539a27a57f5` (như blackbox) tạo trong fixture trước khi chạy test SSO.
  - Thêm `sso` vào `ALL_PROFILES` (`tests/parity/scripts/env.mjs`), `compose()` (`src/docker.ts`), kiểu `Profile` và bảng
    cổng (`src/config.ts`), URL trong `src/global-setup.ts`, `src/profiles.ts`.
  - `.github/workflows/ci.yml`: dòng `postgres` của matrix `parity` thêm `sso` vào `profiles`; `nightly.yml` cũng vậy.
- [X] T007 [P] `tests/parity/src/parity.ts`, `src/normalizers.ts`: thêm `set-cookie` vào `COMPARED_HEADERS` và hook
  `normalize?: (res) => res` vào `ParityRequest` (research R11):
  - `normalizeSetCookie`: tách từng cookie; giá trị thành `<empty>`, `<jwt>`, `<token64>` hoặc giữ nguyên; giữ
    `Max-Age`, `Domain`, `Path`, `HttpOnly`, `Secure`, `SameSite`; `Expires` thành `<past>` hoặc `<future>`;
  - `normalizeTokens`: thay `access_token` bằng claims đã giải mã (bỏ `iat`, `exp`, thêm `ttl = exp - iat`),
    `refresh_token` bằng `<token64>` khi đúng 64 ký tự `A-Za-z0-9_-`;
  - `normalizeLocation`: thay giá trị `state`, `nonce`, `code_challenge`, `code` bằng dấu hiệu.
  - Unit test `src/normalizers.test.ts` cho cả ba hàm, kể cả cookie rỗng có `Max-Age` (research R4).
- [X] T008 [P] Helper luồng có trạng thái trong `tests/parity/src/auth/` (research R6, R11). Thêm `ldapts`, `otplib`,
  `jsonwebtoken` (`catalog:`) vào `tests/parity/package.json`.
  - `fixtures.ts`: tạo qua API Directus (`directus-api.ts`) role, policy (admin, app, không app), user (mỗi trạng thái),
    static token, share; `setSettings()` có `restore()`; tên user có hậu tố theo app để mỗi bên có fixture riêng.
  - `scenario.ts`: `scenario(steps)` chạy lần lượt với Directus rồi với app mới, trả transcript đã chuẩn hóa và so;
    `matrix(issue, use)` chạy 4 cặp issuer × consumer.
  - `db-effects.ts`: `captureDbEffects(userId, fn)` đọc bằng knex trên host (chỉ SELECT) dòng mới của
    `directus_sessions`, `directus_activity`, `directus_revisions` và dòng user; chuẩn hóa theo research R6.
  - `tokens.ts`: `decodeJwt`, `signResetToken(email, passwordHash)` (dùng `SECRET` của env và `getSimpleHash` chép
    từ `libs/utils`), `totp(secret)`.
  - Unit test `src/auth/helpers.test.ts` cho phần không cần Docker (chuẩn hóa, so transcript, token).
- [X] T009 `tests/parity/src/suite.ts`: thêm `src/auth/**/*.test.ts` vào `FULL`; thêm `src/auth/login.test.ts`,
  `refresh.test.ts`, `logout.test.ts`, `password.test.ts` vào `REDUCED`. Test SSO dùng `describe.runIf` theo profile
  `sso` (`profileUrls()`). (sau T008)

---

## Phase 2: Foundational (util, service port rút gọn, registry provider, `authenticate`)

**Purpose**: Có đủ phần dùng chung cho mọi user story: JWT, cookie, cache quyền, phần ghi DB như Directus, registry
provider với driver `local`, bước `authenticate`.

**⚠️ CRITICAL**: Chưa xong phase này thì không làm user story nào.

**Điều kiện**: constitution 1.3.0 (Phase 9: OAuth2, LDAP) đã được tech lead duyệt ngày 2026-10-10.

- [X] T010 [P] Port `directus/packages/utils/node/fetch-roles-tree.ts` và `fetch-global-access/**` (kèm test) sang
  `libs/utils/src/node/`. Export từ `libs/utils/src/node/index.ts`. Ghi manifest.
- [X] T011 [P] Port sang `apps/api/src/utils/` kèm test gốc: `jwt.ts`, `get-secret.ts`, `is-directus-jwt.ts`,
  `verify-session-jwt.ts`, `stall.ts`, `is-url-allowed.ts`, `generate-hash.ts`, `encrypt.ts`. Ghi manifest.
- [X] T012 [P] `apps/api/src/constants.ts`: thêm `DEFAULT_AUTH_PROVIDER = 'default'`, getter `REFRESH_COOKIE_OPTIONS`,
  `SESSION_COOKIE_OPTIONS` (giá trị như `directus/api/src/constants.ts:66-80`, research R15). Thêm
  `apps/api/src/utils/clear-cookie.ts` (`// Backoffice:` cách xóa cookie của Express 4.21.2, research R4) và test so
  header với chuỗi mong đợi (cookie rỗng, `Max-Age`, `Expires` tương lai; không options thì `Expires` 1970).
- [X] T013 [P] Port `directus/api/src/types/auth.ts`, `types/rolemap.ts` sang `apps/api/src/types/`. Ghi manifest.
- [X] T014 Port `permissions/lib/fetch-roles-tree.ts` và `permissions/modules/fetch-global-access/fetch-global-access.ts`
  sang `apps/api/src/permissions/`, dùng `withCache` của 002 (namespace `roles-tree`, `global-access`,
  `global-access-roles`, `global-access-user`). Test: key và giá trị cache đúng như hàm gốc với mock Redis. Ghi
  manifest. (sau T010)
- [X] T015 [P] Port `database/helpers/date/**` (đủ dialect, kèm test nếu có) và phần `formatUUID` của
  `database/helpers/schema/**` (lớp gốc và dialect override `formatUUID`; comment `ponytail:` phần còn lại ở 006) sang
  `apps/api/src/database/helpers/`. Sửa `getHelpers` (`database/helpers/index.ts`) trả thêm `date`, `schema`. Test
  `writeTimestamp`, `formatUUID` theo vendor. Ghi manifest.
- [X] T016 [P] Port `database/errors/translate.ts` và `dialects/*` (kèm test gốc) sang `apps/api/src/database/errors/`.
  Ghi manifest.
- [X] T017 [P] Port kèm test gốc: `utils/transaction.ts`, `utils/validate-keys.ts`,
  `utils/validate-user-count-integrity.ts`, `utils/fetch-user-count/**`, `telemetry/utils/check-user-limits.ts`,
  `telemetry/utils/should-check-user-limits.ts`,
  `permissions/modules/validate-remaining-admin/validate-remaining-admin-count.ts`. Ghi manifest. (sau T003)
- [X] T018 Port rút gọn `services/payload.ts` sang `apps/api/src/services/payload.service.ts` (research R5): đủ 13
  `transformers`, `processValues`, `processField`, `processGeometries`, `processDates`, `prepareDelta`. Gọi tới
  `processM2O`, `processA2O`, `processO2M`, `processAggregates` thì ném `Error('... is not available before feature
  005')`, có comment `ponytail:`. Port các ca của `directus/api/src/services/payload.test.ts` áp dụng cho phần này.
  Ghi manifest. (sau T011, T015)
- [X] T019 Port rút gọn `services/items.ts` sang `apps/api/src/services/items.service.ts`: `createOne`, `createMany`
  (khóa chính bằng `returning`, dự phòng `max`), `readOne`, `readMany`, `readSingleton` (field phẳng), `updateOne`,
  `updateMany` (activity, revision, snapshot không quan hệ, `validateUserCountIntegrity`, `translateDatabaseError`,
  `transaction`). Accountability không phải admin, payload lồng quan hệ, query có `filter`/`deep`/`aggregate` thì ném
  lỗi như T018. Thêm `services/activity.service.ts`, `services/revisions.service.ts` (lớp con, như Directus). Port các ca
  áp dụng của `items.test.ts`; thêm test cho snapshot và revision với `knex-mock-client`. Ghi manifest. (sau T016,
  T017, T018)
- [X] T020 `apps/api/src/services/settings.service.ts`: thêm `readSingleton({ fields })` cùng SQL với
  `readProjectInfo` (`ORDER BY id LIMIT 1`, mặc định theo schema khi không có dòng). Test với `knex-mock-client`.
  (sau T019)
- [X] T021 Port rút gọn `services/users.ts` sang `apps/api/src/services/users.service.ts`: `createOne`, `updateOne`,
  `updateMany`, `checkUniqueEmails`, `checkPasswordPolicy` (dùng `@backoffice/validation`), `clearUserSessions`,
  `getUserByEmail`, `clearCaches` (gọi `clearSystemCache` của 002). Port các ca áp dụng của `users.test.ts`. Ghi
  manifest. (sau T002, T019, T020)
- [X] T022 Port `services/tfa.ts` sang `apps/api/src/services/tfa.service.ts`: `verifyOTP`, `generateTFA`; issuer mặc
  định `Backoffice` (`// Backoffice:` D-25); `enableTFA`, `disableTFA` không port (comment `ponytail:` FR-051, 005).
  Test: secret và `otpauth_url` có định dạng của `otplib`, issuer theo `project_name`. Ghi manifest. (sau T019)
- [X] T023 Registry provider (research R9): port `directus/api/src/auth.ts` sang `apps/api/src/auth.ts`, `auth/auth.ts`,
  `auth/drivers/index.ts`, `auth/drivers/local.ts` (lớp `LocalAuthDriver`; handler login viết ở T029).
  - Driver `saml` không tạo instance, log `warn` `[mới]` (contracts/startup-logs.md §1).
  - Gọi `registerAuthProviders()` ở bước 16b của `apps/api/src/startup/run-startup-checks.ts`, sau `validateStorage`.
  - Test: tên `default` thì thoát mã 1; thiếu driver, driver lạ thì `warn`; `saml` thì `warn` và `getAuthProvider('saml')`
    ném `INVALID_PROVIDER_CONFIG`; `AUTH_DISABLE_DEFAULT`.
  - Ghi manifest. (sau T021)
- [X] T024 Port `utils/get-accountability-for-token.ts` (kèm test gốc) và `middleware/authenticate.ts` (kèm
  `authenticate.test.ts` gốc, bỏ ca event `authenticate`) sang `apps/api/src/`. `authenticate` dùng `clearCookie` của
  T012. Ghi manifest. (sau T011, T012, T014)
- [X] T025 `apps/api/src/app-pipeline.ts`: ở chỗ `app.use(publicAccountability)`, chọn `authenticate` cho path khớp
  `^/auth(/|$)` hoặc `^/users/me/tfa/generate/?$` (không phân biệt hoa thường), `publicAccountability` cho path khác;
  comment `ponytail:` (D-10, 004). Cập nhật comment đầu file. Test bằng supertest: token sai tới `/auth/x` trả lỗi (JWT ký sai: `403 INVALID_TOKEN` như Directus),
  tới `/server/info` vẫn public và có cảnh báo; không token thì cả hai public. (sau T024)
- [X] T026 [P] `apps/api/src/config/supported-variables.ts`: chuyển biến của contracts/config.md §1 sang nhóm A; biến
  §2 giữ nhóm C. `apps/api/src/config/warn-single-instance.ts`: lý do `RATE_LIMITER_STORE is "memory"` không còn
  phụ thuộc `RATE_LIMITER_ENABLED` (contracts/config.md §3). Sửa test của hai file theo.

**Checkpoint**: `pnpm nx run-many -t test lint typecheck` xanh; app khởi động với `.env` của môi trường đối chiếu.

---

## Phase 3: User Story 1 - Đăng nhập bằng email và mật khẩu, token dùng chéo (Priority: P1) 🎯 MVP

**Goal**: `POST /auth/login` (và `/auth/login/<local>`) trả token, cookie, dòng DB giống Directus ở ba chế độ.

**Independent Test**: spec US1. Đăng nhập ở app mới với mỗi chế độ, so với Directus; dùng access token của app mới ở
`GET /users/me` của Directus.

### Tests for User Story 1

- [X] T027 [P] [US1] `tests/parity/src/auth/login.test.ts`: port phần REST của
  `directus/tests/blackbox/tests/common/auth/login.test.ts` (4 user, sai mật khẩu, email không có, email sai định dạng,
  thiếu mật khẩu) lên `parity()` với `normalizeTokens`, `normalizeSetCookie`. Thêm: ba chế độ (body, `Set-Cookie`,
  claims, `ttl`), email khác hoa thường, `mode` lạ, `otp` không phải chuỗi, `/auth/login/local2`, `AUTH_DISABLE_DEFAULT`
  thì `404` (unit test), access token của app mới dùng được ở `GET /users/me` của Directus.
- [X] T028 [P] [US1] `tests/parity/src/auth/login-db.test.ts`: `scenario()` + `captureDbEffects()` cho đăng nhập ba chế
  độ (contracts/db-writes.md §1): session, activity `login`, `last_access`, dọn session hết hạn. Thêm file này vào
  `REDUCED` của `suite.ts`.

### Implementation for User Story 1

- [X] T029 [US1] Port `AuthenticationService.login` sang `apps/api/src/services/authentication.service.ts` (cả bộ đếm
  đăng nhập sai, khóa user, OTP, `enforce_tfa`, research R7). Limiter tạo ở lần gọi đầu. Không phát `auth.login`,
  `auth.jwt`. Port handler login của `createLocalAuthRouter` vào `apps/api/src/auth/drivers/local.ts`. Port các ca
  `login` của `directus/api/src/services/authentication.test.ts`. Thêm unit test: rate limiter lỗi thì trả `503` và
  không chờ `LOGIN_STALL_TIME`. Ghi manifest. (sau T014, T022, T023)
- [X] T030 [US1] `apps/api/src/controllers/auth.controller.ts` (`@Controller('auth')`): `POST login` (provider
  `default`, `404` khi `AUTH_DISABLE_DEFAULT`) và `POST login/:provider` cho driver `local` (so tên không phân biệt hoa
  thường theo thứ tự `AUTH_PROVIDERS`, FR-079; driver khác hoặc không có thì `RouteNotFoundError`). Đăng ký
  controller và factory `AuthenticationService` trong `app.module.ts`, `providers.ts`. Test controller bằng supertest.
  (sau T029)
- [X] T031 [US1] `apps/api/src/middleware/router-options.ts`: `OPTIONS` của `/auth/login` và `/auth/login/<local>` trả
  `Allow: POST` (FR-034). Test. (sau T030)
- [X] T032 [US1] `tests/parity/accepted-differences.ts`: xóa D-09.1; D-10 loại `/auth` và `/auth/*` (nếu không, D-10
  che mọi ca Directus trả `401` ở route auth). Chạy `accepted-differences.test.ts` cùng T027, T028 trên Postgres, MySQL,
  SQLite; mọi khác biệt lộ ra phải sửa ở app. (sau T030, T031)

**Checkpoint**: Đăng nhập ở app mới giống Directus; token của app mới dùng được ở Directus.

---

## Phase 4: User Story 2 - Làm mới và kết thúc phiên ở bất kỳ instance nào (Priority: P1)

**Goal**: `POST /auth/refresh`, `POST /auth/logout` cho phiên của cả hai app.

**Independent Test**: spec US2.

### Tests for User Story 2

- [X] T033 [P] [US2] `tests/parity/src/auth/refresh.test.ts`: port phần REST của
  `directus/tests/blackbox/tests/common/auth/refresh.test.ts` lên `scenario()`. Thêm: thiếu token, token hết hạn hoặc
  đã logout, user `suspended` (`USER_SUSPENDED`) và trạng thái khác, refresh chéo hai chiều ở ba chế độ, refresh đồng
  thời chế độ `session` một request mỗi app nhận cùng session mới (US2.3, đạt cả ít nhất 10 lần thử), `captureDbEffects()` (contracts/db-writes.md
  §2).
- [X] T034 [P] [US2] `tests/parity/src/auth/logout.test.ts`: logout ba chế độ, `Set-Cookie` xóa cookie (cookie rỗng
  còn `Max-Age`, FR-024), logout ở bên này làm refresh ở bên kia `401`, activity `logout`, thiếu token `400`.
- [X] T035 [P] [US2] `tests/parity/src/auth/shares.test.ts`: share tạo qua Directus, session lấy bằng
  `POST /shares/auth` của Directus, refresh ở app mới (claims `share`, `role: null`), share hết hạn hoặc chưa tới
  `date_start` thì `401`; logout của share không xóa session (contracts/db-writes.md §4).

### Implementation for User Story 2

- [X] T036 [US2] Port `refresh`, `updateStatefulSession`, `logout`, `verifyPassword` vào
  `apps/api/src/services/authentication.service.ts`, kèm các ca tương ứng của `authentication.test.ts`. Ghi manifest.
  (sau T029)
- [X] T037 [US2] `apps/api/src/controllers/auth.controller.ts`: `POST refresh`, `POST logout` (port `getCurrentMode`,
  `getCurrentRefreshToken`, xóa cookie bằng `clearCookie`); `OPTIONS` `Allow: POST` cho hai path trong
  `router-options.ts`. Test supertest. (sau T036)

**Checkpoint**: Phiên tạo ở bên nào cũng refresh và logout được ở bên kia.

---

## Phase 5: User Story 3 - Route của feature này xác thực token như Directus (Priority: P1)

**Goal**: `POST /users/me/tfa/generate` nhận token theo mọi cách của Directus; route của 001 giữ D-10.

**Independent Test**: spec US3.

### Tests for User Story 3

- [X] T038 [P] [US3] `tests/parity/src/auth/authenticate.test.ts`: US3.1 đến US3.8 trên `POST /users/me/tfa/generate`
  (Bearer, `access_token`, cookie session, static token, hai cách cùng lúc, JWT hết hạn, sai chữ ký, thiếu claim,
  session đã xóa kèm xóa cookie, user bị khóa sau khi có token) và token bất kỳ tới `/server/info`, `/metrics`, path lạ
  vẫn như public (D-10).
- [X] T039 [P] [US3] `tests/parity/src/auth/token-matrix.test.ts`: `matrix()` cho mọi loại token của FR-101 (access
  token ba chế độ, refresh token, cookie session, static token, token đặt lại mật khẩu tự ký, session của share) theo 4 cặp; token bị thu
  hồi ở một bên bị bên kia từ chối ở request kế tiếp (SC-002).

### Implementation for User Story 3

- [X] T040 [US3] `apps/api/src/controllers/users.controller.ts` (`@Controller('users')`): `POST me/tfa/generate`, port
  từ `directus/api/src/controllers/users.ts:330-369`, dùng `TFAService` (T022) và `verifyPassword` (T036). Đăng ký
  trong `app.module.ts`, `providers.ts`. `OPTIONS` `Allow: POST` trong `router-options.ts`. Test supertest. (sau T036)
- [X] T041 [US3] `tests/parity/accepted-differences.ts`: D-10 loại thêm `/users/me/tfa/generate`; D-09.2
  loại `/users/me/tfa/generate`; thêm D-09.10 (`/users/me/tfa/enable`, `/users/me/tfa/disable`, `/users/*/tfa/disable`,
  gỡ ở 005) và D-25 (`jsonPointer` `/data/otpauth_url` khi `project_name` trống). Chạy `accepted-differences.test.ts`
  và toàn bộ test 001, 002; lỗi lộ ra sau khi thu hẹp D-10 thì sửa ở app. (sau T040)
- [X] T042 [US3] `tests/parity/src/request-set.ts`: thêm `POST /users/me/tfa/generate` với token sai vào bộ request chung
  (để `db-unchanged`, `readonly-account` dùng). (sau T040)

**Checkpoint**: MVP xong (US1 đến US3): đăng nhập, giữ phiên, nhận token chéo hai bên.

---

## Phase 6: User Story 4 - Chống dò mật khẩu và kiểm trạng thái user (Priority: P2)

**Goal**: Trạng thái user, `LOGIN_STALL_TIME`, bộ đếm đăng nhập sai dùng chung (code đã có ở T029; phase này kiểm và
sửa).

**Independent Test**: spec US4.

- [X] T043 [P] [US4] `tests/parity/src/auth/user-status.test.ts`: user `invited`, `draft`, `suspended`, `archived`, user
  provider khác `default` (US4.1, US4.2); static token của user không `active` (FR-042).
- [X] T044 [P] [US4] `tests/parity/src/auth/login-attempts.test.ts`: `auth_login_attempts = 3` (đặt qua Directus,
  `restore()` ở `afterAll`), sai xen kẽ hai app, user bị khóa đúng ở cùng lần thử như khi chỉ chạy Directus (SC-004);
  activity và revision của lần khóa (contracts/db-writes.md §3); `null` thì không khóa; key `rlflx:<userId>` trên Redis
  giống nhau ở hai bên.
- [X] T045 [P] [US4] `tests/parity/src/auth/stall.test.ts` (chỉ Postgres full, timeout riêng): mọi nhánh của FR-040 trả
  sau ít nhất `LOGIN_STALL_TIME`; 50 lần tuần tự mỗi loại, trung vị "email không có" và "sai mật khẩu" lệch không quá
  50 ms ở mỗi app (SC-003).
- [X] T046 [US4] Sửa `apps/api/src/services/authentication.service.ts` cho tới khi T043 đến T045 đạt; ghi khác biệt tìm
  được vào "Ghi chú khi làm". (sau T043, T044, T045)

---

## Phase 7: User Story 5 - Xác thực hai lớp (Priority: P2)

**Goal**: Đăng nhập bằng OTP, `generate`, `enforce_tfa` giống Directus. Bật, tắt TFA làm ở 005.

**Independent Test**: spec US5.

- [X] T047 [P] [US5] `tests/parity/src/auth/tfa.test.ts`: US5.1 đến US5.6. Secret sinh ở app mới bật ở Directus
  (`/users/me/tfa/enable` của Directus), đăng nhập ở app mới bằng `totp(secret)`; thiếu hoặc sai OTP `401 INVALID_OTP`;
  lỗi của `generate` (chưa đăng nhập, thiếu hoặc sai mật khẩu, đã bật, không email, user SSO); `enforce_tfa` trong token;
  ba route bật, tắt ở app mới trả `404` (D-09.10).
- [X] T048 [US5] Sửa `services/tfa.service.ts`, `services/authentication.service.ts`, `controllers/users.controller.ts`
  cho tới khi T047 đạt. (sau T047)

---

## Phase 8: User Story 6 - Quên và đặt lại mật khẩu (Priority: P3)

**Goal**: `/auth/password/request` (không gửi email), `/auth/password/reset`.

**Independent Test**: spec US6.

### Tests for User Story 6

- [X] T049 [P] [US6] `tests/parity/src/auth/password.test.ts`: US6.1 đến US6.6. `request` với email có, không có, user
  không `active`, SSO, thiếu email, `reset_url` ngoài allow list (status, body, thời gian ≥ 500 ms); log của app mới có
  dòng `[email] Password reset email to ...` và không có token (FR-062); `reset` với token tự ký (T008), mọi lỗi,
  `auth_password_policy` (đặt qua Directus, `restore()`), sau khi đổi thì mọi session bị xóa và đăng nhập được ở cả hai
  app; `captureDbEffects()` (contracts/db-writes.md §5).

### Implementation for User Story 6

- [X] T050 [US6] Port `requestPasswordReset`, `resetPassword` vào `apps/api/src/services/users.service.ts`: bước gửi mail
  thay bằng log `warn` `[mới]` có email, không có token hay link (`// Backoffice:` FR-062, Nguyên tắc X). Unit test:
  token ký đúng định dạng của Directus (spy `jwt.sign`), log không chứa token. Ghi manifest. (sau T021)
- [X] T051 [US6] `apps/api/src/controllers/auth.controller.ts`: `POST password/request` (bắt lỗi khác `INVALID_PAYLOAD`,
  log `[email] <lỗi>`, trả `204`), `POST password/reset`; `OPTIONS` `Allow: POST`. Test supertest. (sau T050)
- [X] T052 [US6] `tests/parity/accepted-differences.ts`: D-23 (`kind: 'doc'`). Chạy T049 trên Postgres, MySQL, SQLite.
  (sau T051)

---

## Phase 9: User Story 7 - SSO OpenID Connect, OAuth2, LDAP (Priority: P3)

**Goal**: Provider `openid`, `oauth2`, `ldap` chạy như Directus; `saml` bị bỏ qua; `GET /auth`.

**Independent Test**: spec US7 với profile `sso`.

**Điều kiện**: đạt (constitution 1.3.0 duyệt ngày 2026-10-10).

### Tests for User Story 7

- [X] T053 [P] [US7] `tests/parity/src/auth/providers.test.ts`: `GET /auth` (kể cả `?sessionOnly`), app mới không liệt kê
  `saml` (D-24); `/auth/login/saml` `404`; refresh và logout của user SAML (fixture tạo qua Directus với
  `provider: 'saml'`, fixture riêng để điều kiện của D-24 không che ca refresh khác) trả `503 INVALID_PROVIDER_CONFIG`
  ở app mới (FR-078); `OPTIONS` của mọi path ở contracts/auth-api.md §6; `HEAD /auth` trả như `GET` không có body,
  `HEAD /auth/login/oidc` trả `302` và đặt cookie `openid.oidc` như Directus (FR-034).
- [X] T054 [P] [US7] `tests/parity/src/auth/sso-oauth2.test.ts`: port `oauth-redirect.test.ts`, `oauth-multi-domain.test.ts`
  của blackbox (provider `github`, `Host` `localhost:8955` cho ca subpath) lên `parity()` với `normalizeLocation`; luồng
  đủ với `oauthmock` (tạo user, cập nhật, `MODE=json`, cookie sai `401`, `invalid_grant` khi refresh `403`); bắt đầu ở
  app này, callback ở app kia (cả hai chiều); so `Set-Cookie` của callback: xóa cookie trạng thái (`Expires` 1970) và
  đặt cookie theo `MODE` (FR-024, contracts/auth-api.md §4).
- [X] T055 [P] [US7] `tests/parity/src/auth/sso-openid.test.ts`: provider `oidc`: bắt đầu (cookie `openid.oidc`, tham số
  authorize), callback `GET` và `POST` (`303`), tạo user, đăng ký công khai tắt hoặc email chưa xác minh, `ROLE_MAPPING`,
  `SYNC_USER_INFO` (xóa session cũ, contracts/db-writes.md §7), `enforce_tfa` chuyển `/admin/tfa-setup`, `invalid_grant`
  chuyển `prompt=true`, refresh với IdP, callback chéo hai chiều (SC-008); so `Set-Cookie` của callback: xóa cookie
  trạng thái (`Expires` 1970) và đặt cookie session hoặc refresh theo `MODE` (FR-024, contracts/auth-api.md §4).
- [X] T056 [P] [US7] `tests/parity/src/auth/sso-ldap.test.ts`: port `directus/tests/blackbox/tests/common/auth/ldap.test.ts`
  (seed bằng `ldapts`; phần `/users/me` gọi ở Directus với token của app mới); thêm role theo nhóm (`GROUP_DN`), refresh
  kiểm lại LDAP, payload sai không chờ, chế độ `session` có `access_token` trong body.
- [X] T057 [P] [US7] `tests/parity/src/startup/auth-providers.test.ts`: chạy app mới trên host (`runApi`) với provider
  `saml`, tên `default`, driver lạ, thiếu driver, OpenID thiếu biến, `ROLE_MAPPING` là mảng, IdP không truy cập được
  với `ISSUER_DISCOVERY_MUST_SUCCEED` mặc định và `false`; so message, mức log, mã thoát với contracts/startup-logs.md §1.

### Implementation for User Story 7

- [X] T058 [P] [US7] Port `auth/utils/generate-callback-url.ts`, `auth/utils/resolve-login-redirect.ts` (kèm test gốc)
  sang `apps/api/src/auth/utils/`. Ghi manifest.
- [X] T059 [US7] Port `auth/drivers/openid.ts` (kèm `openid.test.ts` gốc, bỏ ca event): lớp `OpenIDAuthDriver` và
  handler bắt đầu, callback (thay `createOpenIDAuthRouter`, research R3), `clearCookie`, `urlencoded` của `body-parser`
  1.20.3 cho `POST` callback (research R4). Ghi manifest. (sau T023, T029, T058)
- [X] T060 [P] [US7] Port `auth/drivers/oauth2.ts` (kèm `oauth2.test.ts` gốc) như T059. Ghi manifest. (sau T023, T029,
  T058)
- [X] T061 [P] [US7] Port `auth/drivers/ldap.ts` (kèm `ldap.test.ts` gốc, gồm ca `userAccountControl`): lớp
  `LDAPAuthDriver` và handler login (không chờ khi lỗi payload; chế độ `session` có `access_token`). Ghi manifest.
  (sau T023, T029)
- [X] T062 [US7] Bước đầu: thêm vào profile `sso` (T006) service `ldap` (`cleanstart/openldap:latest`, cổng `6109:389`,
  healthcheck `ldapsearch` như `directus/tests/blackbox/docker-compose.yml`; kéo không được thì `osixia/openldap:1.5.0`,
  ghi lại theo research R10), `depends_on` `ldap` healthy cho cặp `sso`, và provider `oauthmock` (driver `oauth2`, URL của
  `idp`, `IDENTIFIER_KEY=sub`, `MODE=json`), `github`, `ldap` (như `directus/tests/blackbox/common/config.ts`, LDAP trỏ
  `ldap://ldap:389`; `AUTH_GITHUB_REDIRECT_ALLOW_LIST`) vào `AUTH_PROVIDERS` của `env/profile-sso.env`. Sau đó
  `apps/api/src/controllers/auth.controller.ts`: `GET /auth` (lọc `saml`, D-24), `GET login/:provider`,
  `POST login/:provider` (thêm driver `ldap`), `POST` và `GET login/:provider/callback` theo bảng research R3; đăng ký
  driver `openid`, `oauth2`, `ldap` trong `auth.ts`; `router-options.ts` thêm path SSO (FR-034). Test supertest cho bảng
  route. (sau T059, T060, T061)
- [X] T063 [US7] `tests/parity/accepted-differences.ts`: D-24 gồm `GET /auth` (phần tử `saml`), `* /auth/login/saml*`, và
  `POST /auth/refresh`, `POST /auth/logout` khi session thuộc user `provider: 'saml'`, chỉ khi app mới trả
  `503 INVALID_PROVIDER_CONFIG`; D-26 (`kind: 'doc'`). Chạy T053 đến T057 trên profile `sso`. (sau T062)

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T064 [P] Benchmark auth, bước đo thử (research R12, rủi ro): chạy autocannon 2.000 kết nối với `POST /auth/login`
  trên môi trường benchmark, xem request còn dở lúc hết vòng có bị tính là lỗi không, và chọn `duration` hay `amount`.
  Ghi kết quả vào "Ghi chú khi làm".
- [X] T065 Benchmark auth (SC-007): `tests/benchmark/src/seed-auth.ts` (role, policy qua API Directus; 2.000 user
  `default` chung một hash; 2.000 user provider `benchmark`; lô session mỗi vòng, bằng knex trên Postgres) và
  `tests/benchmark/src/auth.ts` (3 endpoint, 2.000 kết nối, `timeout` 120 s, ngữ cảnh theo kết nối, `compare.ts`, cổng
  10%). Dùng nguyên quy tắc lỗi của `compare.ts`: lỗi ở bất kỳ vòng nào thì endpoint không đạt; T064 chọn `amount` thì
  quy tắc này vẫn giữ. Thêm target `auth` vào `tests/benchmark/project.json`, phụ thuộc `jsonwebtoken`, `knex`, `pg` vào
  `tests/benchmark/package.json`. (sau T064, Phase 3 đến 5)
- [ ] T066 `.github/workflows/ci.yml`: job `benchmark-auth` (sau `parity`, song song `benchmark`, timeout 60 phút,
  `BENCH_ROUNDS=5`), là điều kiện của `publish`. Ghi thời gian chạy thật vào "Ghi chú khi làm". (sau T065)
- [X] T067 [P] `tests/parity/src/db-unchanged.test.ts`, `readonly-account.test.ts`: thêm request auth không ghi DB
  (`GET /auth`, đăng nhập sai, refresh với token sai, `password/request` với email không có, TFA với token sai) theo
  FR-081. Chạy trên Postgres full.
- [X] T068 [P] `tests/parity/src/observability/logs.test.ts`: port ca cookie của
  `directus/tests/blackbox/tests/common/logger/redact.test.ts` (đăng nhập chế độ `json` không có cookie trong log; chế
  độ `cookie`, `session` thì `cookie`/`set-cookie` bị che). Thêm FR-063: sau khi chạy đăng nhập, refresh, TFA, đặt lại
  mật khẩu và SSO, log của app mới không chứa giá trị token, refresh token, mật khẩu, OTP, secret TFA nào đã dùng.
- [X] T069 [P] `tests/parity/src/schema/permissions-cache.test.ts`: so thêm key và giá trị của `roles-tree`,
  `global-access`, `global-access-roles`, `global-access-user` sau một request có token ở mỗi app (research R8).
- [X] T070 Chạy quickstart.md §1 đến §3 trên môi trường đối chiếu và `dev/directus-reference`; sửa quickstart nếu lệch.
- [X] T071 Đồng bộ tài liệu: bảng khác biệt của spec 001 (D-09.1 gỡ ở 003; D-10, D-18 giữ tới 004) và
  `specs/001-platform-foundation/contracts/startup.md` (dòng 5, bước 16b, 16c); `README` của `tests/parity` (profile
  `sso`, helper mới); chạy `graphify update .`.
- [ ] T072 Đóng feature: CI xanh mọi job (gồm `benchmark-auth`), coverage ≥ 80%; `spec.md` `Status: Done`; ghi kết quả
  benchmark và CI run vào "Ghi chú khi làm"; tech lead duyệt D-09.10, D-23 đến D-26. (sau tất cả)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: không phụ thuộc. T002, T003 sau T001.
- **Foundational (Phase 2)**: sau Phase 1. Chặn mọi user story.
- **US1 (Phase 3)**: sau Phase 2.
- **US2 (Phase 4)**: sau T029 (US1) vì dùng chung `authentication.service.ts`.
- **US3 (Phase 5)**: sau T036 (US2) vì route TFA dùng `verifyPassword`.
- **US4, US5 (Phase 6, 7)**: sau US1; US5 sau US3 (route `generate`).
- **US6 (Phase 8)**: sau Phase 2 và T030 (controller có sẵn).
- **US7 (Phase 9)**: sau US1.
- **Polish (Phase 10)**: T064 đến T066 sau US1 đến US3; còn lại sau mọi story.

### Within Each User Story

- Test viết trước và fail trước khi làm.
- Service trước controller; controller trước `accepted-differences.ts`.
- Story xong khi test đối chiếu đạt trên Postgres (và MySQL, SQLite với file trong `REDUCED`).

### Parallel Opportunities

- Phase 1: T002 đến T005, T007, T008 song song sau T001.
- Phase 2: T010 đến T013, T015 đến T017, T026 song song; chuỗi T018 → T019 → T020 → T021 → T023 tuần tự.
- Test của mỗi story (đánh dấu [P]) viết song song.
- US6 và US7 làm song song với US4, US5 khi đủ người.

---

## Parallel Example: User Story 7

```bash
# Viết test song song:
Task: "T053 providers.test.ts"
Task: "T054 sso-oauth2.test.ts"
Task: "T055 sso-openid.test.ts"
Task: "T056 sso-ldap.test.ts"
Task: "T057 startup/auth-providers.test.ts"

# Port driver song song (sau T058):
Task: "T060 oauth2.ts"
Task: "T061 ldap.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Phase 1: Setup.
2. Phase 2: Foundational. Commit khi checkpoint xanh.
3. Phase 3, 4, 5.
4. **STOP and VALIDATE**: T027, T028, T033 đến T035, T038, T039 đạt trên Postgres; T027, T028, T033, T034 đạt trên MySQL
   và SQLite.
5. Đến đây app mới đăng nhập, giữ phiên và nhận token chéo với Directus.

### Incremental Delivery

1. Setup + Foundational: lib, service port rút gọn, registry, `authenticate`; CI xanh.
2. + US1 + US2 + US3: MVP.
3. + US4 + US5: chống dò mật khẩu, TFA.
4. + US6: quên và đặt lại mật khẩu.
5. + US7: SSO.
6. + Polish: benchmark 2.000 kết nối chặn CI, đóng feature.

---

## Notes

- Test đối chiếu luồng có trạng thái dùng `scenario()`: mỗi app có fixture riêng, không gửi cùng một refresh token cho
  hai app cùng lúc (research R11).
- Test đổi `directus_settings` chạy tuần tự và trả lại giá trị cũ.
- Trên SQLite của CI Linux, test không ghi DB từ host; fixture tạo qua API Directus (FR-103).
- Directus chạy giả lập amd64 trên máy arm64: test thời gian (T045) chỉ tin kết quả trên CI.

## Ghi chú khi làm

- T001: `joi` lên 18.2.6 thay vì 18.0.1 của Directus (advisory high GHSA-6h2x-m376-mqjq; tiền lệ `nanoid` ở 001).
  Thêm `date-fns` 4.1.0 và `wellknown` 0.5.0 (cùng phiên bản Directus) cho helper ngày giờ và `PayloadService`.
- T004: image build được, `argon2.hash` chạy trong container; không cần sửa `apps/api/Dockerfile`.
- T005, T008: unit test của IdP giả lập ở `tests/parity/src/idp.test.ts`, của helper luồng ở
  `tests/parity/src/auth-helpers.test.ts` (chạy trong target `test` có sẵn, không cần Docker).
- T017: `check-user-limits` đọc env trong hàm (Directus đọc ở cấp module; quy ước của repo cấm `useEnv` cấp module).
- T019, T026: `ItemsService` đọc `MAX_BATCH_MUTATION`, `shouldClearCache` đọc `CACHE_AUTO_PURGE_IGNORE_LIST`; hai biến
  này chuyển sang nhóm A cùng các biến của contracts/config.md §1.
- T021: thêm `createAuthDb()` vào `apps/api/test/directus-db.ts` (bảng `directus_*` mà service auth ghi, trên SQLite).
- T025: JWT ký bằng secret khác tới `/auth/*` trả `403 INVALID_TOKEN` như Directus (static token không tồn tại mới là
  `401 INVALID_CREDENTIALS`). Test của pipeline mock `getDatabase` vì vitest nạp `knex.mjs` (không có `knex.default`);
  Node chạy bản CJS nên `knex.default` của `database/index.ts` (giống Directus) vẫn đúng.
- T026: test `warn-unsupported-variables` đổi biến mẫu nhóm C từ `AUTH_PROVIDERS` sang `EMAIL_TRANSPORT`. Danh sách nhóm
  A trong `specs/001-platform-foundation/contracts/config.md` §5 có thêm biến của 003 (như 002 đã làm).
- T029: port cả `refresh`, `updateStatefulSession`, `logout`, `verifyPassword` cùng lúc với `login` (một lần biến đổi
  file gốc); T036 còn lại phần test và controller. `updatedPayload`, `customClaims` giữ tên như Directus (bằng payload
  gốc vì không có filter event, D-26) để dễ so với bản gốc khi nâng phiên bản.
- T030: Nest trả `201` cho `@Post`; route auth đặt `@HttpCode(200)` như Directus. Handler login của driver tự tạo
  `AuthenticationService` như router gốc, nên factory trong `providers.ts` để tới T037 (refresh, logout dùng nó).
- T032: guard `accepted-differences.test.ts` đòi D-09.1 còn trong danh sách tới khi 003 Done. Thay vì xóa, D-09.1 có
  `excludeEndpoints` (trường mới) loại route đã làm: `/auth/login*` ở T032; T037 thêm `refresh`, `logout`; T051 thêm
  `password/*`; US7 thêm `GET /auth` và callback; xóa hẳn khi mọi route `/auth` đã làm. D-10 loại `/auth`, `/auth/*`.
  `snapshotOf` bỏ `X-Powered-By` (D-01) như `parity()`.
- T033: refresh đồng thời chế độ `session` (US2.3) bỏ qua trên MySQL, MariaDB: không có `UPDATE ... RETURNING`, nên
  chính Directus cũng tạo hai session khi hai request cùng lúc (`updatedSession.length` không phải mảng). Helper luồng
  dùng chung ở `tests/parity/src/auth/flows.ts`.
- T035: share cần collection người dùng (khóa ngoại tới `directus_collections`); test tạo collection tạm qua API
  Directus rồi xóa.
- T036: `authentication.test.ts` gốc chỉ có ca `login`; `refresh`, `logout` được phủ bằng test supertest trên SQLite
  (`apps/api/src/controllers/auth.controller.test.ts`) và test đối chiếu.
- T039: ma trận gồm access token ba chế độ và session bị logout ở bên cấp; refresh chéo, logout chéo, share nằm ở
  T033 đến T035; token đặt lại mật khẩu tự ký đưa vào `password.test.ts` (Phase 8, khi có route).
- T041: `endpoints` của khác biệt nhận `*` ở giữa path (`/users/*/tfa/disable`). Ô "Gỡ khi" của D-26 trong spec ghi
  `009` (phần "flow" đã ở cột Loại) để guard đọc được. Normalizer giữ dạng base32 của `secret` TFA và `otpauth_url`.
- Semgrep (CI): `encrypt.ts` gọi `createDecipheriv` với `authTagLength: 16` (`Backoffice:`; tag do `getAuthTag` sinh
  luôn 16 byte nên giá trị Directus đã mã hóa vẫn giải được, tag bị cắt thì bị từ chối). `.semgrepignore` bỏ
  `**/*.test.ts` (secret JWT viết cứng trong test là dương tính giả).
- T044: trạng thái user đọc từ DB, không qua `GET /users/:id` của Directus (env đối chiếu bật `CACHE_ENABLED`, response
  cache trả bản cũ vì khóa user ghi thẳng bằng knex, không xóa cache).
- T046, T048: không phải sửa service; T043 đến T045, T047 đạt ngay trên Postgres (T045 chạy cục bộ cũng đạt, kết quả
  chính thức lấy từ CI).
- T047: bật TFA ở Directus cần quyền sửa `directus_users` (quyền tối thiểu của app chỉ cho đọc), nên user của ca này có
  role admin.
- T050: không ký token và không dựng link đặt lại (chỉ dùng cho email); unit test "spy `jwt.sign`" thay bằng ca
  đối chiếu: token tự ký theo định dạng Directus được cả hai app nhận (`password.test.ts`), và log không có token.
- `captureDbEffects`: cột ngày trong JSON `data`, `delta` của revision cũng thành `<date>`. `compose()` của
  `tests/parity/src/docker.ts` có `maxBuffer` 256 MB (log của môi trường chạy lâu vượt 1 MB, `ENOBUFS`).
- T058 đến T061: router của driver thành object handler (`login`, `callbackPost`, `callback`) bằng biến đổi cơ học
  từ file gốc; controller gọi `respond` khi handler chưa trả lời (redirect tự trả lời). Test gốc chạy qua (openid 51,
  oauth2 58, ldap 64 ca), chỉ đổi chỗ lấy handler từ `router.stack` và bỏ ca event (D-26).
- T055: callback openid luôn chuyển hướng (kể cả khi không có `redirect`, `resolveLoginRedirect` cho `/`), nên không
  có ca trả JSON. OAuth2 trả `401` khi cookie trạng thái sai, openid chuyển về `/admin/login?reason=...`: hai bên
  giống Directus.
- T054: IdP giả lập chỉ trả `id_token` khi scope có `openid` (như IdP thật); `oauthCallback` của openid-client từ
  chối `id_token`.
- T056: `AUTH_LDAP_GROUP_DN` thêm vào `env/profile-sso.env` (cấu hình blackbox không có) cho ca role theo nhóm. Lần
  đăng nhập LDAP đầu tạo user, nên ca gửi cùng lúc tới hai app đăng nhập trước một lần ở Directus (tránh hai app
  cùng tạo một user).
- T063: D-24 gồm danh sách provider của `GET /auth` (kèm `etag`), `/auth/login/saml*`, và refresh, logout khi app mới
  trả `INVALID_PROVIDER_CONFIG` (`when.backofficeCode`, trường mới). D-09.1 loại mọi route `/auth` (guard gỡ khi 003
  Done). Harness chuẩn hóa body text của redirect như header `Location` và `auth_data.refreshToken`.
- T064: đọc mã autocannon 8.0.0: `Client#destroy` gỡ listener `error` trước khi hủy kết nối, nên request còn dở lúc
  hết `duration` bị bỏ, không tính là lỗi hay timeout; giữ `duration` như `run.ts`. `timeout` 120 s cho hàng đợi
  đăng nhập (argon2 4 luồng và `LOGIN_STALL_TIME`).
- T064 (đo thử cục bộ): ở 2.000 kết nối, máy arm64 với Directus chạy giả lập qua Docker Desktop không trả được request
  nào trong 10 s, nên số liệu chỉ lấy từ CI; không có lỗi nào được tính dù hàng nghìn request còn dở (xác nhận cách
  đọc mã ở trên). autocannon reset `context` mỗi lần duyệt hết `requests` (ở đây là mỗi request), nên trạng thái để
  ngoài context: user và access token xoay vòng, refresh token qua một hàng đợi (request lấy một, response trả token
  mới). Khi `overallRate` nhỏ hơn số kết nối, autocannon giảm số kết nối xuống bằng `overallRate`: pha đo p95 chạy
  với ít kết nối, pha thông lượng đủ 2.000.
- T065: seed ở `tests/benchmark/src/seed-auth.ts` (xóa user, session, activity đã tạo khi xong); số kết nối đổi được
  bằng `BENCH_CONNECTIONS` (mặc định 2.000) để đo thử cục bộ.
- T067: thêm vào bộ request chung `GET /auth`, đăng nhập và `password/request` với email không có (không chạm bộ đếm
  đăng nhập sai), refresh với token không có.
- T070: §3.4 của quickstart thêm lệnh `ldapadd` tạo user thử (OpenLDAP của profile khởi động trống); `env-up` của §1
  bật mọi profile của bộ `full`. Test `errors.test.ts` của 001 bỏ `/auth` khỏi danh sách "chưa làm".
- T070: chạy quickstart §2 trên cặp chính của môi trường đối chiếu (Directus 8155, app mới 8156) thay cho
  `dev/directus-reference` (cùng image, cùng cấu hình); §3 thêm bước tạo role mặc định của provider SSO, LDAP (test tạo
  rồi xóa role này).
- Bộ đối chiếu `full` trên Postgres chạy cục bộ: 40 file, 325 ca đạt (trước khi bỏ `/auth` khỏi ca "chưa làm" của
  `errors.test.ts`), rồi các file đổi ở Phase 10 đạt 34/34.
- CI (run 38074801197): discovery OpenID của `backoffice-api-sso` quá 3,5 s (timeout mặc định của openid-client) khi
  runner đang khởi động mọi container, app thoát như Directus với `ISSUER_DISCOVERY_MUST_SUCCEED` mặc định. Profile
  `sso` đặt `AUTH_OIDC*_ISSUER_DISCOVERY_MUST_SUCCEED=false` và `AUTH_OIDC*_CLIENT_HTTP_TIMEOUT=10000` (chung cho hai
  app; discovery lỗi thì thử lại ở lần đăng nhập đầu). Ca thoát khi discovery lỗi vẫn được kiểm ở
  `startup/auth-providers.test.ts`.
- CI (run 38077738639): ca "Redis down" của `server/health.test.ts` (001) phụ thuộc thứ tự file: Directus chạy bước
  schema cả ở `/server/health` (D-13), nên khi test trước đã xóa schema trong bộ nhớ thì nó trả `500` ngay thay vì
  chờ Redis. Test nay gọi `/server/info` ở cả hai app trước khi tắt Redis, đúng điều kiện lúc đo trên Directus.
