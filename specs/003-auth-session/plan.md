# Implementation Plan: Xác thực và phiên đăng nhập

**Branch**: `003-auth-session` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-auth-session/spec.md`

## Summary

App mới cấp và nhận token giống hệt Directus 11.17.4. Token dùng chéo được vì hai bên dùng chung `SECRET`,
`directus_sessions`, Redis và cùng thư viện, cùng bản (research R1). Phạm vi:

- `/auth/login` (provider `default`, provider `local` có tên, LDAP), `/auth/refresh`, `/auth/logout` ở ba chế độ
  `json`, `cookie`, `session`;
- `/auth/password/request` (không gửi email; log không có token), `/auth/password/reset`;
- `GET /auth`;
- SSO OpenID Connect và OAuth2: bắt đầu, callback, refresh với IdP;
- `/users/me/tfa/generate` và đăng nhập bằng OTP. Bật, tắt TFA làm ở 005 (Q1 = C);
- bộ đếm đăng nhập sai dùng chung Redis, `LOGIN_STALL_TIME`;
- bước `authenticate` của Directus, chỉ cho route của feature này. Route của 001 giữ D-10 tới 004 (Q D-10 = C).

Provider `saml` không được đăng ký: khởi động có cảnh báo; refresh và logout của user SAML trả
`503 INVALID_PROVIDER_CONFIG`, như Directus khi tắt SAML (Q SAML khi lập plan).

Cách làm:

- Port nguyên `auth.ts`, `auth/**`, `middleware/authenticate.ts`, các util JWT và phần permissions cần thiết.
- Route chuyển thành controller Nest mỏng: `AuthController`, và `UsersController` với một route (research R3).
- Phần ghi `directus_users`, `directus_activity`, `directus_revisions` cần `ItemsService`, `PayloadService`,
  `UsersService`. 003 port rút gọn các service này, đúng đường dẫn sẽ có ở 004, 005; nhánh chưa port thì ném lỗi
  (research R5).
- Header `Set-Cookie` khi xóa cookie tái tạo theo Express 4.21.2 của Directus (research R4).

Test đối chiếu:

- port phần REST của bộ blackbox auth;
- thêm runner kịch bản cho các luồng có trạng thái;
- ma trận dùng chéo token;
- so dữ liệu DB của từng luồng;
- profile `sso` với IdP giả lập và OpenLDAP;
- benchmark 2.000 kết nối chặn CI (Q Benchmark = B).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (bộ cờ strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS, ESM, pnpm
10.27.0, Nx 23.3. Giữ như 001, 002.

**Primary Dependencies**:
- Đã có: NestJS 12.1 (Express 5.2.1, body parser của Nest tắt), knex 3.1.0, ioredis 5.8.2, `rate-limiter-flexible`
  7.2.0, `cookie-parser` 1.4.7, `nanoid` 5.1.16, `body-parser` 1.20.3, `ms`, `lodash-es`.
- Thêm vào catalog, cùng bản Directus 11.17.4: `jsonwebtoken` 9.0.3 (`@types/jsonwebtoken` 9.0.10), `argon2` 0.44.0,
  `otplib` 12.0.1, `openid-client` 5.7.1, `ldapts` 8.1.3, `joi` 18.0.1, `flat` 6.0.1 (research R1).
- Lib mới `@backoffice/validation` (port `directus/packages/validation`). Validate bằng Joi như file gốc.

**Storage**:
- DB dùng chung. Đọc và ghi theo [data-model.md](./data-model.md) và [contracts/db-writes.md](./contracts/db-writes.md):
  `directus_sessions`, `directus_activity`, `directus_revisions`, một số cột `directus_users`.
- Redis dùng chung: key bộ đếm đăng nhập sai `rlflx:<userId>`; namespace permissions cache `roles-tree`, `global-access`,
  `global-access-roles`, `global-access-user`.
- Không có key hay kênh Redis nào mà Directus không dùng.

**Testing**:
- Vitest 3.2.4: test port từ Directus (driver `local`, `openid`, `oauth2`, `ldap`; `authenticate`, `jwt`, `stall`,
  `get-accountability-for-token`, `resolve-login-redirect`, `generate-callback-url`, `is-url-allowed`, `validate-keys`,
  `fetch-roles-tree`, `fetch-global-access`, `@backoffice/validation`), phần áp dụng của `authentication.test.ts`,
  `users.test.ts`, `payload.test.ts`, `items.test.ts`, và test mới cho phần `Backoffice:` (chọn path ở R2,
  `clear-cookie`, lọc `saml`).
- `tests/parity`:
  - Postgres full: profile `sso` mới (IdP giả lập, OpenLDAP, cặp 8955/8956);
  - MySQL và SQLite reduced: thêm `login`, `login-db`, `refresh`, `logout`, `password`;
  - runner `scenario()`, `matrix()` và helper `db-effects` (research R11).
- `tests/benchmark`: script `auth.ts` với 2.000 kết nối, job CI `benchmark-auth` (research R12).

**Target Platform**: Container Linux, nhiều replica cạnh Directus sau load balancer, không sticky session. Giữ như 001.

**Project Type**: Monorepo web (Nx). Feature này chỉ chạm BE: `apps/api`, `libs/validation` (mới), `libs/utils`,
`libs/types`, `tests/parity`, `tests/benchmark`, CI.

**Performance Goals**:
- SC-003: mọi response của `/auth/login` ở các nhánh có chờ trả sau ít nhất `LOGIN_STALL_TIME`; trung vị "email không
  có" và "sai mật khẩu" lệch không quá 50 ms.
- SC-007: với 2.000 user, 2.000 kết nối đồng thời, p95 và req/s của `POST /auth/login`, `POST /auth/refresh`,
  `POST /users/me/tfa/generate` (đo bước xác thực) không tệ hơn Directus quá 10%. Cổng chặn CI.
- Các endpoint của 001, 002 giữ ngưỡng cũ.

**Constraints**:
- Chỉ ghi DB trong các luồng ở contracts/db-writes.md. Khởi động không ghi gì.
- Không thêm biến `BACKOFFICE_*`. Không gửi email.
- Route của 001 vẫn bỏ qua token (D-10) tới 004.
- Message, status, header `Set-Cookie` giống Directus; Express 5 phải cho kết quả như Express 4.21.2 (R4).

**Scale/Scope**:
- Quy mô thiết kế 2.000 user đồng thời (Nguyên tắc X).
- Khoảng 60 file port hoặc mới trong `apps/api/src` (kèm test port), 1 lib mới, khoảng 20 file test đối chiếu và
  helper, 1 profile compose mới, 1 job CI mới.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.3.0 (sửa Nguyên tắc XI khi clarify 003; tech lead đã duyệt 2026-10-10). Kiểm lần
1 trước research: không có vi phạm chưa giải thích. Kết quả dưới đây là lần 2, sau research, data model và contracts.

- [x] **I. Directus chỉ đọc**: PASS.
  - Không sửa `directus/`.
  - Mọi file port ghi `// Ported from directus/...` (bảng ánh xạ bên dưới).
  - Chỗ khác nguồn ghi `Backoffice:` trong comment: lọc `saml`, chọn path ở R2, `clear-cookie`, lỗi ở nhánh chưa port.
- [x] **II. Dùng chung DB**: PASS.
  - Không DDL, không migration.
  - Dòng ghi giống Directus, theo luồng của Directus ([contracts/db-writes.md](./contracts/db-writes.md)). SC-005 so trên
    Postgres, MySQL, SQLite.
  - `db-unchanged` và `readonly-account` sửa theo FR-081: request không ghi DB vẫn không đổi DB và chạy với tài khoản
    chỉ đọc.
- [x] **III. API giống hệt**: PASS.
  - Route, query, body, status, mã lỗi, message, tên và thuộc tính cookie, redirect như Directus
    ([contracts/auth-api.md](./contracts/auth-api.md)).
  - Express 5 khác Express 4 ở `clearCookie`; xử lý ở R4 và kiểm bằng so `Set-Cookie`.
  - Khác biệt còn lại đều ở bảng của spec: D-09.10, D-10 (giữ), D-23 đến D-26.
- [x] **IV. Chạy song song an toàn**: PASS.
  - Cùng `SECRET`, cách ký JWT, `directus_sessions`.
  - Cùng key bộ đếm đăng nhập sai và namespace permissions cache.
  - Cookie trạng thái SSO ký bằng `SECRET`, nên callback rơi vào instance khác vẫn chạy.
  - Ma trận dùng chéo (FR-101) kiểm cả 4 cặp.
- [x] **V. Kiểm thử đối chiếu**: PASS.
  - Mọi endpoint mới có test đối chiếu (research R11). Bộ blackbox auth port phần REST.
  - Phần cần `/users/me` (004) kiểm qua Directus.
  - Benchmark auth chặn CI.
- [x] **VI. Kiến trúc**: PASS.
  - Controller Nest mỏng. Service Directus thành provider factory như 001.
  - Registry provider và hạ tầng giữ dạng hàm như Directus.
  - Knex, không ORM. Mỗi thay đổi có test.
  - Service port rút gọn đặt đúng đường dẫn để 004, 005 làm tiếp (bảng "Phần port rút gọn").
- [x] **VII. Đa instance**: PASS.
  - Trạng thái trong process dựng lại được từ env hoặc IdP: registry provider, client OpenID và OAuth2, instance
    limiter.
  - Số đếm đăng nhập sai nằm trong Redis khi store `redis`. Store `memory` thì đếm theo process, như Directus; cảnh
    báo một instance áp dụng cả khi `RATE_LIMITER_ENABLED=false` (FR-041, contracts/config.md §3). Dòng 8 của
    Complexity Tracking 001 vẫn áp dụng.
  - Khởi động chỉ đọc. Client Redis của limiter đóng khi SIGTERM.
- [x] **VIII. Biến môi trường**: PASS. Biến chuyển sang nhóm A theo [contracts/config.md](./contracts/config.md). Không
  có biến mới. Biến chỉ SAML dùng vẫn được cảnh báo.
- [x] **IX. Đổi thương hiệu**: PASS.
  - Giữ: issuer JWT `directus`, `directus_refresh_token`, `directus_session_token`, `openid.<p>`, `oauth2.<p>`, provider
    `default`, đường dẫn `/admin/*` trong redirect.
  - Đổi: issuer TFA mặc định `Backoffice` (D-25). Log mới nói "Backoffice".
- [x] **X. Chất lượng và vận hành**: PASS.
  - Coverage 80% cho `apps/api`, `libs/validation`, `libs/utils`, `libs/types`.
  - Benchmark auth chặn CI.
  - Không gửi email: log thay cho email không có token (FR-062).
  - Mọi khác biệt ghi ở spec; cần tech lead duyệt D-23 đến D-26 và D-09.10.
- [x] **XI. Ngoài phạm vi**: PASS theo constitution 1.3.0: OpenID, OAuth2, LDAP trong phạm vi; SAML không đăng ký, hành
  vi như Directus khi tắt SAML (FR-078, đã hỏi khi lập plan). Không có WebSocket auth, GraphQL auth (011), extension
  (event không phát, D-26).

## Project Structure

### Documentation (this feature)

```text
specs/003-auth-session/
├── plan.md              # File này
├── research.md          # Phase 0: R1–R16
├── data-model.md        # Phase 1: bảng đọc và ghi, token, trạng thái, Redis, trạng thái process
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── auth-api.md        # route, lỗi, chế độ, cookie (Express 4), SSO, OPTIONS
│   ├── db-writes.md       # dòng ghi của từng luồng
│   ├── config.md          # biến chuyển nhóm A, biến còn nhóm C, cảnh báo một instance
│   └── startup-logs.md    # bước khởi động 16b, 16c và log
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

Chỉ liệt kê phần thêm hoặc sửa. Cấu trúc chung giữ như plan 001, 002.

```text
backoffice-next/
├── pnpm-workspace.yaml                         # catalog: jsonwebtoken, argon2, otplib, openid-client, ldapts, joi, flat
├── libs/
│   ├── validation/                             # MỚI @backoffice/validation ← packages/validation/src (+ test, snapshot)
│   ├── types/src/{items,authentication,payload,users}.ts   # MỚI/SỬA: Item, PrimaryKey, MutationOptions, LoginResult,
│   │                                                       #   PayloadAction, UserIntegrityCheckFlag
│   └── utils/src/node/{fetch-roles-tree.ts, fetch-global-access/**}   # MỚI ← packages/utils/node (+ test)
├── apps/api/src/
│   ├── auth.ts                                 # MỚI ← api/src/auth.ts (bỏ qua saml, R9)
│   ├── auth/auth.ts                            # MỚI ← api/src/auth/auth.ts
│   ├── auth/drivers/{index,local,openid,oauth2,ldap}.ts    # MỚI (+ test gốc); router thành object handler (R3)
│   ├── auth/utils/{generate-callback-url,resolve-login-redirect}.ts   # MỚI (+ test gốc)
│   ├── controllers/auth.controller.ts          # MỚI ← api/src/controllers/auth.ts
│   ├── controllers/users.controller.ts         # MỚI ← api/src/controllers/users.ts (chỉ POST /me/tfa/generate)
│   ├── services/authentication.service.ts      # MỚI ← services/authentication.ts (không phát event)
│   ├── services/tfa.service.ts                 # MỚI ← services/tfa.ts (generateTFA, verifyOTP)
│   ├── services/{items,payload,users}.service.ts   # MỚI, rút gọn (R5)
│   ├── services/{activity,revisions}.service.ts    # MỚI
│   ├── services/settings.service.ts            # SỬA: readSingleton({ fields })
│   ├── middleware/authenticate.ts              # MỚI ← middleware/authenticate.ts
│   ├── middleware/router-options.ts            # SỬA: OPTIONS của /auth/*, /users/me/tfa/generate
│   ├── app-pipeline.ts                         # SỬA: chọn authenticate hoặc publicAccountability theo path (R2)
│   ├── app.module.ts, providers.ts             # SỬA: 2 controller, factory của service mới
│   ├── startup/run-startup-checks.ts           # SỬA: registerAuthProviders ở bước 16b
│   ├── config/supported-variables.ts           # SỬA: contracts/config.md §1
│   ├── config/warn-single-instance.ts          # SỬA: lý do RATE_LIMITER_STORE luôn áp dụng
│   ├── constants.ts                            # SỬA: DEFAULT_AUTH_PROVIDER, getter REFRESH/SESSION_COOKIE_OPTIONS
│   ├── types/{auth,rolemap}.ts                 # MỚI ← api/src/types
│   ├── utils/{jwt,get-secret,is-directus-jwt,verify-session-jwt,get-accountability-for-token,stall,
│   │          is-url-allowed,generate-hash,encrypt,transaction,validate-keys,validate-user-count-integrity}.ts  # MỚI
│   ├── utils/clear-cookie.ts                   # MỚI Backoffice: clearCookie của Express 4.21.2 (R4)
│   ├── utils/fetch-user-count/**               # MỚI
│   ├── telemetry/utils/{check-user-limits,should-check-user-limits}.ts   # MỚI
│   ├── permissions/lib/fetch-roles-tree.ts     # MỚI (withCache 'roles-tree')
│   ├── permissions/modules/fetch-global-access/fetch-global-access.ts    # MỚI
│   ├── permissions/modules/validate-remaining-admin/validate-remaining-admin-count.ts   # MỚI
│   ├── database/errors/{translate.ts, dialects/*}   # MỚI
│   └── database/helpers/{date/**, schema/**, index.ts}   # MỚI date; schema chỉ formatUUID; SỬA getHelpers
├── tests/parity/
│   ├── docker-compose.yml                      # SỬA: profile sso (idp 6110, ldap 6109, directus-sso 8955, backoffice-api-sso 8956)
│   ├── env/profile-sso.env                     # MỚI: provider oidc, oauthmock, github, ldap, local2, saml
│   ├── idp/server.mjs                          # MỚI: IdP OpenID/OAuth2 giả lập (R10)
│   ├── accepted-differences.ts                 # SỬA: R11
│   ├── package.json                            # SỬA: ldapts, otplib, jsonwebtoken
│   ├── scripts/env.mjs                         # SỬA: ALL_PROFILES thêm sso
│   └── src/
│       ├── docker.ts, config.ts, global-setup.ts, profiles.ts   # SỬA: profile sso
│       ├── suite.ts                            # SỬA: src/auth/** vào full; 4 file vào reduced
│       ├── parity.ts, normalizers.ts           # SỬA: so set-cookie, hook normalize, token, Location
│       ├── request-set.ts, db-unchanged.test.ts, readonly-account.test.ts   # SỬA: request auth không ghi DB
│       ├── observability/logs.test.ts          # SỬA: che cookie chế độ cookie, session (port redact.test.ts)
│       ├── schema/permissions-cache.test.ts    # SỬA: namespace roles-tree, global-access*
│       ├── startup/auth-providers.test.ts      # MỚI: cảnh báo saml, tên default, driver lạ (contracts/startup-logs.md)
│       └── auth/
│           ├── fixtures.ts, scenario.ts, db-effects.ts, tokens.ts   # MỚI: helper (R6, R11)
│           ├── login.test.ts, login-db.test.ts, refresh.test.ts, logout.test.ts   # US1, US2 (port blackbox)
│           ├── authenticate.test.ts, token-matrix.test.ts           # US3, FR-101
│           ├── user-status.test.ts, login-attempts.test.ts, stall.test.ts   # US4, SC-003, SC-004
│           ├── tfa.test.ts, password.test.ts, shares.test.ts        # US5, US6, FR-021
│           └── providers.test.ts, sso-openid.test.ts, sso-oauth2.test.ts, sso-ldap.test.ts   # US7
├── tests/benchmark/
│   ├── src/auth.ts, src/seed-auth.ts           # MỚI: R12
│   └── project.json, package.json              # SỬA: target auth; jsonwebtoken, knex, pg
└── .github/workflows/ci.yml                    # SỬA: parity Postgres bật sso; job benchmark-auth
```

**Structure Decision**:
- Theo cấu trúc 001, 002: package Directus thành lib cùng tên dưới `libs/`; file của `directus/api/src` vào cùng đường dẫn
  trong `apps/api/src`; service và controller có hậu tố `.service.ts`, `.controller.ts` như 001.
- Router của driver không thành controller riêng: handler nằm trong file driver, `AuthController` gọi chúng (R3).
- Test đối chiếu mới đặt trong `tests/parity/src/auth/`.

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/`) | Đích | Ghi chú |
|---------------------|------|---------|
| `packages/validation/src/**` | `libs/validation/src/**` | Nguyên vẹn, kèm test |
| `packages/types/src/{items,authentication,payload,users}.ts` | `libs/types/src/*.ts` | Phần dùng ở 003 |
| `packages/utils/node/fetch-roles-tree.ts`, `fetch-global-access/**` | `libs/utils/src/node/` | Nguyên vẹn, kèm test |
| `api/src/auth.ts` | `apps/api/src/auth.ts` | `saml` không tạo instance, log `[mới]` (R9) |
| `api/src/auth/auth.ts`, `auth/drivers/{local,openid,oauth2,ldap}.ts`, `auth/utils/*` | cùng đường dẫn | Router thành object handler (R3); không phát event (D-26); dùng `clear-cookie` (R4); kèm test gốc |
| `api/src/controllers/auth.ts` | `apps/api/src/controllers/auth.controller.ts` | Nest; lọc `saml` khỏi `GET /auth` |
| `api/src/controllers/users.ts` (`/me/tfa/generate`) | `apps/api/src/controllers/users.controller.ts` | Một route |
| `api/src/middleware/authenticate.ts` | cùng đường dẫn | Không phát event `authenticate`; dùng `clear-cookie` |
| `api/src/services/authentication.ts` | `services/authentication.service.ts` | Không phát `auth.login`, `auth.jwt` |
| `api/src/services/tfa.ts` | `services/tfa.service.ts` | `generateTFA`, `verifyOTP`; issuer `Backoffice` (D-25) |
| `api/src/services/{items,payload,users,activity,revisions}.ts` | `services/*.service.ts` | Rút gọn (R5) |
| `api/src/utils/{jwt,get-secret,is-directus-jwt,verify-session-jwt,get-accountability-for-token,stall,is-url-allowed,generate-hash,encrypt,transaction,validate-keys,validate-user-count-integrity}.ts`, `utils/fetch-user-count/**` | cùng đường dẫn | Nguyên vẹn, kèm test gốc |
| `api/src/telemetry/utils/{check-user-limits,should-check-user-limits}.ts` | cùng đường dẫn | Nguyên vẹn |
| `api/src/permissions/lib/fetch-roles-tree.ts`, `modules/fetch-global-access/*`, `modules/validate-remaining-admin/*` | cùng đường dẫn | Dùng `withCache` của 002 |
| `api/src/database/errors/**`, `database/helpers/date/**` | cùng đường dẫn | Nguyên vẹn |
| `api/src/database/helpers/schema/**` | cùng đường dẫn | Chỉ `formatUUID` (006 làm tiếp) |
| `api/src/constants.ts` (`DEFAULT_AUTH_PROVIDER`, `REFRESH_COOKIE_OPTIONS`, `SESSION_COOKIE_OPTIONS`) | `apps/api/src/constants.ts` | Getter (R15) |
| `api/src/types/{auth,rolemap}.ts` | `apps/api/src/types/` | Nguyên vẹn |
| `tests/blackbox/tests/common/auth/{login,refresh,oauth-redirect,oauth-multi-domain,ldap}.test.ts` | `tests/parity/src/auth/*.test.ts` | Phần REST, port lên `parity()` và `scenario()` |
| `tests/blackbox/tests/common/logger/redact.test.ts` (ca cookie) | `tests/parity/src/observability/logs.test.ts` | Thêm ca |

### Phần port rút gọn tạm thời

| Phần | Ở feature 003 | Thay ở |
|------|---------------|--------|
| Bước `authenticate` | Chỉ path `/auth/*`, `/users/me/tfa/generate`; path khác giữ `publicAccountability` (D-10) | 004 |
| `ItemsService` | CRUD field phẳng; accountability `null` hoặc admin; activity và revision như Directus; không kiểm quyền, không quan hệ lồng, không query engine | 005 |
| `PayloadService` | `processValues`, `transformers`, `processDates`, `processGeometries`, `prepareDelta`; không `processM2O/A2O/O2M`, `processAggregates` | 005 |
| `UsersService` | `createOne`, `updateOne`, `updateMany`, quên và đặt lại mật khẩu; chưa có mời, đăng ký, xóa, đọc | 004 |
| `TFAService` | `generateTFA`, `verifyOTP`; route bật, tắt TFA trả 404 (D-09.10) | 005 |
| `SettingsService` | `readProjectInfo` (001), `readSingleton({ fields })` | 005, 010 |
| `database/helpers/schema` | `formatUUID` | 006 |
| Event `auth.*`, `authenticate`, `items.*`, `users.*` | Không phát (D-26) | 009 (phần flow) |
| Share | Chỉ refresh session của share có sẵn; `/shares/auth` ở 010 | 010 |

## Complexity Tracking

Không có vi phạm mới. Các ngoại lệ đã duyệt của 001, 002 vẫn áp dụng, nhất là dòng 8 của 001: store `memory` và cảnh
báo một instance, nay gồm cả bộ đếm đăng nhập sai. Constitution 1.3.0 (Nguyên tắc XI: OAuth2, LDAP vào phạm vi) đã được
tech lead duyệt ngày 2026-10-10 (chủ dự án xác nhận; quy trình không có PR). Các khác biệt D-09.10, D-23 đến D-26 cần
tech lead duyệt trước khi đóng feature (Nguyên tắc X, T072).

`joi` dùng 18.2.6 thay vì 18.0.1 của Directus: bản vá bảo mật (advisory high GHSA-6h2x-m376-mqjq), cùng cách xử lý
`nanoid` ở 001. API `joi` dùng trong `libs/validation` không đổi giữa hai bản; test gốc của Directus chạy qua.

Rủi ro đã biết, theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| Express 5 khác Express 4.21.2 ở chỗ chưa đo (ngoài `clearCookie`) | Lệch header hoặc body ở route auth | So `set-cookie`, `location`, body của mọi ca (R4, R11). Lệch thì sửa ở app, không chuẩn hóa trong test |
| `ItemsService` rút gọn cho định dạng khác Directus trên MySQL hoặc SQLite (ngày giờ, JSON, boolean) | Directus đọc dữ liệu app mới ghi bị lệch | `db-effects` so trên cả 3 vendor của mỗi lần push (SC-005) |
| Benchmark 2.000 kết nối: hàng đợi argon2 (4 luồng), timeout của autocannon, request dở lúc hết vòng | Cổng benchmark đỏ dù hai app tương đương | Task đầu của phần benchmark đo thử và chọn `duration` hoặc `amount` (R12) |
| CI dài thêm: test thời gian chờ khoảng 100 giây, profile `sso`, job benchmark mới | Chạm timeout 60 phút của job | Test thời gian chờ chỉ ở Postgres full; benchmark auth chạy job riêng; theo dõi thời gian ở lần chạy đầu |
| IdP giả lập khác IdP thật | Lỗi với Azure AD hoặc Keycloak thật không lộ ra | Hai app dùng cùng `openid-client` 5.7.1 nên khác biệt nếu có là ở IdP; tài liệu cấu hình giữ như Directus |
| Image `cleanstart/openldap` không kéo được | Không chạy được test LDAP | Dự phòng `osixia/openldap:1.5.0` (R10) |
| `argon2` cần build native khi image không có bản dựng sẵn | Build Docker lỗi | Task build image kiểm sớm (R1) |
| Thu hẹp D-10 làm lộ khác biệt đang bị che ở test cũ | Test cũ đỏ | Chạy `accepted-differences.test.ts` và toàn bộ test 001, 002 sau khi sửa |
| Directus chạy giả lập amd64 trên máy arm64 | Test thời gian chờ chập chờn ở máy dev | Cổng là CI amd64; dùng `parityStable` như 001 |
| Test đổi `auth_login_attempts`, `auth_password_policy` trên DB dùng chung | Ảnh hưởng test khác | Chạy tuần tự, trả lại giá trị ở `afterAll` |
