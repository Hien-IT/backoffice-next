# Implementation Plan: Đăng nhập bằng Passkey (WebAuthn) cho user local

**Branch**: `029-passkey-login` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=029-passkey-login`) | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/029-passkey-login/spec.md`

## Summary

User local (`provider = default`, `status = active`) đăng ký passkey trên trang user của mình (nhập lại mật khẩu, tối đa
10, discoverable + user verification) và đăng nhập app Backoffice bằng nút "Đăng nhập bằng Passkey" không email, mật
khẩu hay OTP; session tạo ra là session thường (cookie, `directus_sessions`, activity, `auth.login`) nên Directus app
cùng DB dùng được. Dữ liệu ở bảng hệ thống mới `backoffice_passkeys` (migration riêng `20261101A`), challenge một lần
5 phút trong kho dùng chung của các replica, RP ID và origin lấy từ `PUBLIC_URL` (chỉ nó; cross-site không có passkey),
đăng nhập sai đếm vào `auth_login_attempts`, admin xóa được passkey của user khác, xóa user xóa passkey. Directus không
đổi gì: endpoint mới dưới `/backoffice/` (404 ở Directus), bảng `backoffice_*` đã có normalizer; D-207..D-207.4.

Cách làm (chi tiết ở [research.md](./research.md)): `@simplewebauthn/server` + `browser` 14 (R1); tách
`consumeLoginAttempt`/`finishLogin` khỏi `AuthenticationService.login` và gọi lại (R2); `PasskeyService` + controller
`backoffice` (R3); kho challenge Redis `GETDEL`/`Map` key = challenge (R4); `getPasskeyRp()` từ `PUBLIC_URL`, tắt = 404 (R5);
migration + collection hệ thống ẩn + cascade ở `UsersService.deleteMany` (R6); web: `use-passkey-support` dò
`GET /backoffice/auth/passkey`, `loginWithPasskey` trong `auth.ts`, nút trong `LoginForm`, card `UserPasskeys` ngoài
BoForm (R7, R8); parity với authenticator giả trong Node, D-207 `doc` (R9); E2E chromium CDP với replica Backoffice
riêng cho đường passkey trong profile `web` (R10); hai lượt (R12).

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict (cờ của `@directus/tsconfig`), Node.js 22 LTS, ESM, pnpm 10.27, Nx 23;
swc build cho `apps/api` (không bundler, `node_modules` chép vào image); Vite cho `apps/web`.

**Primary Dependencies**: **mới** (chủ dự án duyệt 2026-11-01, ghim trong `catalog:`): `@simplewebauthn/server` 14.0.3
(API; MIT; ESM + CJS; Node >= 20; phụ thuộc `@peculiar/asn1-*`, `@peculiar/x509`, `@levischuck/tiny-cbor`,
`@hexagon/base64`, `reflect-metadata`, không native), `@simplewebauthn/browser` 14.0.0 (web; MIT; không phụ thuộc). Có
sẵn: NestJS 12, Knex 3.1, Joi 18.3.1, jsonwebtoken 9.0.3, nanoid, `useRedis()` (`SET PX`, `GETDEL`),
`@backoffice/errors`, otplib (không đụng); web: Vue 3.5, Reka UI 2.8.2, Tailwind CSS 4.3, `@directus/sdk` 21.3.0,
BoTable/BoDialog/BoMenu/BoInput/BoNotice/BoIcon; test: Vitest 3.2.4, knex-mock-client, supertest, Playwright 1.64.0,
`node:crypto` (authenticator giả).

**Storage**: bảng mới `backoffice_passkeys` (12 cột, index `user`, unique `credential_id`; [data-model.md](./data-model.md))
qua migration riêng `20261101A` (up only, Knex, 7 vendor, chạy lại được, không FK), `backoffice_migrations` ghi dòng;
không cột/dòng mới trên `directus_*`; Redis khóa `backoffice:passkey:<challenge>` (TTL 5 phút, lấy bằng `GETDEL`; `Map`
local khi không Redis); cột `bo_passkey` boolean nullable trên `directus_sessions` (cùng migration, D-207.5, phương án E);
response cache dùng chung không nhận GET passkey (`res.locals.cache = false`).

**Testing**: Vitest unit `apps/api` (migration, `rp`, `challenge-store`, `passkey.service` với `vi.mock('@simplewebauthn/
server')`, `authentication.service` có sẵn xanh nguyên, `users.service`, controller supertest) và `apps/web`
(`use-passkey-support`, `auth`, `LoginForm`, `use-passkeys`, `UserPasskeys.browser` + axe, overlay); parity env chính
`auth/passkey.test.ts` với `auth/webauthn-fake.ts` (P-256, attestation `none`, assertion ký) trong `FULL_FILES` và một
phần `REDUCED_FILES`, cookie passkey gửi tới Directus (SC-007), `accepted-differences` D-207..D-207.4 `doc`, normalizer
regex; E2E `users-passkey.spec.ts`, `login-passkey.spec.ts` chromium (CDP virtual authenticator) ở `proxy-api` qua
`http://localhost:8162` (replica `backoffice-api-passkey`, R10), `proxy-directus`/`cors` kiểm ẩn; deploy suite thêm case
đăng ký ở replica A đăng nhập ở B ([contracts/tests.md](./contracts/tests.md)).

**Target Platform**: Linux `amd64` container (API); trình duyệt desktop/tablet có WebAuthn (Chrome, Edge, Safari 16+,
Firefox 122+ cho passkey đồng bộ); E2E lễ thật chỉ chromium.

**Project Type**: BE (`apps/api`) + FE (`apps/web`, `apps/web-e2e`) + test (`tests/parity`) + deploy docs.

**Performance Goals**: scenario benchmark hiện có không tệ hơn Directus quá 10 % (login mật khẩu chỉ thêm hai lời gọi
hàm nội bộ, không query mới); đăng nhập passkey thêm một đọc kho challenge + một đọc `backoffice_passkeys` + một update
so với login local, không đo riêng (Assumptions); SC-004 độ trễ lần sai ≈ `LOGIN_STALL_TIME` như mật khẩu.

**Constraints**: không sửa `directus/` (I); chỉ bảng `backoffice_*`, migration riêng, không FK (II); endpoint có sẵn
giống Directus, endpoint mới dưới `/backoffice/` ghi D-207, giao diện D-207.4 (III, X); `SECRET`/cookie/session như
Directus, challenge và rate limiter trên Redis dùng chung (IV, VII); parity cho mọi endpoint mới (V); không biến env mới,
`PUBLIC_URL` đã có (VIII); comment "DR", `Backoffice (spec 029, D-207)` ở file port (IX); coverage BE ≥ 80 %, FE ≥ 60 %
(X); card/bảng/dialog từ recipe có sẵn, token theme, trạng thái và bàn phím đủ (XII); không mã lỗi mới (overlay spread
nông).

**Scale/Scope**: API 1 migration + 6 file mới (`rp.ts`, `challenge-store.ts`, `passkey.service.ts`, controller, hai
test helper) + 7 file sửa (`authentication.service.ts`, `users.service.ts`, `app.module.ts`, `providers.ts`,
`collections.yaml`, GraphQL `schema/index.ts`, `backoffice-migrations/index.ts`); web 4 file mới (`use-passkey-support`,
`use-passkeys`, `UserPasskeys.vue`, tests) + 6 sửa (`auth.ts`, `LoginForm.vue`, `UserItemRoute.vue`, overlay ×2,
`vite.config.ts`, `test-utils/fetch.ts`); parity 2 mới + 5 sửa; E2E 2 spec mới + 3 helper/compose/proxy sửa; docs 6
file; D-207..D-207.4.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.4.0). Mark PASS, or VIOLATION with a row in Complexity
Tracking.

- [x] I. PASS: không sửa `directus/`; `authentication.service.ts`, `users.service.ts`, `local.ts` giữ `Ported from`;
  file mới ghi "Backoffice (spec 029)".
- [x] II. PASS: bảng `backoffice_passkeys` và cột `bo_passkey` trên `directus_sessions` (cột `bo_*` được phép, như 022)
  qua migration riêng `20261101A` (up only, Knex, 7 vendor, `hasTable`/`hasColumn`, không FK), ghi `backoffice_migrations`, chạy bởi `bootstrap`/`init`, kiểm ở `start` (có sẵn); không DDL/dòng mới trên
  `directus_*`; session/activity/last_access ghi đúng dạng Directus; id v4.
- [x] III. PASS với D-207 (route mới chỉ Backoffice, 404 ở Directus), D-207.1 (bảng `backoffice_*`, normalizer có sẵn),
  D-207.2 (xóa user xóa passkey), D-207.3 (passkey không `enforce_tfa`), D-207.5 (`/policies/me/globals` với phiên passkey,
  entry `doc`, kiểm từng app); mọi endpoint có sẵn không đổi (unit 003 + parity
  `auth/*` xanh nguyên).
- [x] IV. PASS: cùng `SECRET`, `jwt.sign` như login local, `directus_sessions` dùng chung; rate limiter Redis có sẵn;
  challenge trong Redis; không state trong process khi có Redis (local chỉ cho một instance, như `useStore`).
- [x] V. PASS: `auth/passkey.test.ts` cho mọi route mới (Directus 404, Backoffice luồng đủ với authenticator giả),
  login/refresh/logout có sẵn qua suite cũ; cookie passkey kiểm trên Directus.
- [x] VI. PASS: provider NestJS `PasskeyService`, controller mỏng, Knex trực tiếp; Vue 3 Composition API, composable
  + component.
- [x] VII. PASS: không config FE mới; challenge và session dùng chung qua Redis/DB; migration dưới lock
  `backoffice-migrations` có sẵn; E2E/deploy dùng replica thứ hai cho đường passkey; SIGTERM không đổi.
- [x] VIII. PASS: không biến env mới; `PUBLIC_URL` đã nhóm A; tắt passkey khi `PUBLIC_URL` không tuyệt đối (log warn).
- [x] IX. PASS: chuỗi "Backoffice" ở rpName mặc định (như TFA `project_name || 'Backoffice'`); comment "DR".
- [x] X. PASS: tiếng Việt cho spec/plan, tiếng Anh cho code; coverage; không email; D-207..D-207.4 trong spec, chủ dự án
  kiêm tech lead duyệt sau plan; benchmark không đổi; log pino.
- [x] XI. PASS: không SAML, websocket, AI; passkey cho LDAP/SSO ngoài phạm vi.
- [x] XII. PASS: đọc `design-system/README.md`, `component-specs.md` (Card :290, Table :272/:854, Modal :242, Button :93,
  Q-19 TFA :1607), `layout-patterns.md` (§5, §8), `handoff-checklist.md`; card/bảng/menu/dialog/empty từ recipe, token
  theme, trạng thái đủ, bàn phím, nhãn liên kết; câu hỏi mở (icon `passkey`, thời gian relative) ở "Cần xác nhận" của
  spec, chốt ở analyze.

**Re-check sau Phase 1 và sau checklist**: không đổi; không vi phạm. D-207..D-207.5, hai dependency, replica passkey và
phương án E: chủ dự án duyệt 2026-11-01 (spec, mục "Duyệt 2026-11-01").

## Project Structure

### Documentation (this feature)

```text
specs/029-passkey-login/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (R1–R12)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output: api.md, web.md, tests.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
pnpm-workspace.yaml                                              # catalog: @simplewebauthn/server 14.0.3, @simplewebauthn/browser 14.0.0 (spec 029)
apps/api/
├── package.json                                                 # + @simplewebauthn/server
└── src/
    ├── auth/passkey/
    │   ├── rp.ts (+ .test.ts)                                   # getPasskeyRp(): rpId/origin từ PUBLIC_URL, null = tắt (R5)
    │   ├── challenge-store.ts (+ .test.ts)                      # putChallenge/takeChallenge nguyên tử (Redis GETDEL | Map), TTL 5 phút (R4)
    │   └── index.ts
    ├── services/
    │   ├── passkey.service.ts (+ .test.ts, mới)                 # options/verify đăng ký + đăng nhập, list/rename/delete, admin, limit 10 (R3)
    │   ├── authentication.service.ts (+ .test.ts)              # tách consumeLoginAttempt(), finishLogin({ passkey }) (R2, D-207.3); bo_passkey ở insert và refresh (R13)
    ├── permissions/modules/fetch-accountability-policy-globals/ # enforce_tfa false cho phiên passkey (R13, D-207.5)
    │   ├── users.service.ts (+ .test.ts)                        # deleteMany: xóa backoffice_passkeys theo user (R6, D-207.2)
    │   └── index.ts                                             # export PasskeyService
    ├── controllers/
    │   ├── backoffice-passkeys.controller.ts (+ .test.ts, mới)  # @Controller('backoffice'): auth/passkey/*, users/me/passkeys*, users/:pk/passkeys* (R3)
    │   └── ...
    ├── app.module.ts, providers.ts                              # đăng ký controller + service factory (như 025)
    ├── database/backoffice-migrations/
    │   ├── 20261101A-create-backoffice-passkeys.ts (+ .test.ts, mới)  # bảng + cột directus_sessions.bo_passkey
    │   ├── 20261028A-create-backoffice-permissions.test.ts      # danh sách version
    │   └── index.ts                                             # BACKOFFICE_MIGRATIONS + createBackofficePasskeys
    ├── services/graphql/schema/index.ts                         # SYSTEM_DENY_LIST + backoffice_passkeys
    └── startup/run-startup-checks.ts                            # warn khi passkey tắt vì PUBLIC_URL (R5)
libs/system-data/src/collections/collections.yaml                # backoffice_passkeys hidden (+ index.test.ts)
apps/web/
├── package.json, vite.config.ts                                 # + @simplewebauthn/browser; API_PATHS + backoffice; optimizeDeps
└── src/
    ├── auth.ts (+ .test.ts)                                     # loginWithPasskey() (R7); router/guard.ts không đổi (R13)
    ├── composables/
    │   ├── use-passkey-support.ts (+ .test.ts, mới)             # browserSupportsWebAuthn && GET /backoffice/auth/passkey && rp_id === hostname
    │   └── use-passkeys.ts (+ .test.ts, mới)                    # list/add(options→startRegistration→save)/rename/remove/adminRemove
    ├── routes/login/LoginForm.vue (+ .test.ts)                  # nút passkey (R7)
    ├── modules/users/
    │   ├── components/UserPasskeys.vue (+ .browser.test.ts, mới) # card, BoTable, dialogs (R8)
    │   └── routes/UserItemRoute.vue                             # <UserPasskeys> sau <BoForm>
    ├── lang/overlay/en-US.ts, vi-VN.ts                          # passkey_* (contracts/web.md)
    └── test-utils/fetch.ts                                      # KNOWN_REQUESTS
apps/web-e2e/src/
├── login-passkey.spec.ts, users-passkey.spec.ts (mới)           # chromium, CDP WebAuthn (R10)
└── helpers/config.ts, login.ts, allowed-paths.ts                # passkeyWebUrl, login baseUrl, request mới
tests/parity/
├── docker-compose.yml, proxy/web-api.conf                       # service backoffice-api-passkey (PUBLIC_URL http://localhost:8162) + 2 location (R10)
├── accepted-differences.ts                                      # D-207..D-207.4 (doc)
└── src/
    ├── suite.ts                                                 # + auth/passkey.test.ts
    ├── auth/webauthn-fake.ts (mới), auth/passkey.test.ts (mới)  # R9
    ├── normalizers.ts (+ .test.ts)                              # BACKOFFICE_TABLE, SDL regex + passkeys
    ├── deploy/backoffice-migrations.test.ts, deploy/passkey.test.ts (mới)   # danh sách; replica A/B
    └── bootstrap/cross.test.ts                                  # bảng backoffice_passkeys
deploy/README.md                                                 # mục "Passkey (spec 029)" + câu ở standalone
design-system/docs/component-specs.md                            # recipe Q-xx Passkeys
specs/012-backoffice-web-shell/{spec.md,contracts/api-calls.md}, specs/015-files-users-modules/spec.md   # "(029: ...)"
tests/parity/README.md, CLAUDE.md, SPECKIT-GUIDE.md             # 029, D-207..D-207.4
```

**Structure Decision**: không project Nx mới, không lib mới (web không dùng `@backoffice/*`; API code nằm ở lớp của bản
port: service + controller mỏng như 025, hàm dùng chung trong `AuthenticationService` thay vì chép); parity ở `tests/`;
E2E trong `apps/web-e2e` như 014–028; replica passkey chỉ trong profile `web` của parity env, không đụng deploy/compose.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Không có vi phạm. Hai điểm chủ dự án đã gật cùng lượt duyệt D-207..D-207.5 (2026-11-01):

| Điểm | Lý do | Cách đơn giản hơn bị bác |
|------|-------|--------------------------|
| Hai dependency mới (`@simplewebauthn/*`) | Xác minh attestation/assertion (CBOR, COSE, ECDSA/RSA, origin/rpId) tự viết là rủi ro bảo mật | Tự viết: bác (bảo mật); gói khác ít bảo trì |
| Replica `backoffice-api-passkey` + 2 `location` trong profile `web` | Cặp parity chính dùng `PUBLIC_URL=http://localhost:8155` chung với Directus, E2E mở `127.0.0.1:8162`; không cấu hình nào hiện có chạy được lễ passkey thật (R10) | Đổi `PUBLIC_URL` của `backoffice-api`: lệch Directus trong parity; nới origin theo cổng: trái clarify câu 1 |

## Sửa sau `/speckit.checklist` (2026-11-01, checklists/security.md, checklists/api-compat.md)

- R2/R7/R13: bỏ cờ `enforce_tfa` trong token không đủ; sau khi chủ dự án bác dấu trong trình duyệt (user tự đặt được),
  chọn phương án E (2026-11-01): cột `bo_passkey` trên `directus_sessions`, `refresh` giữ dấu,
  `fetchAccountabilityPolicyGlobals` trả `enforce_tfa: false` cho phiên passkey (D-207.5); web không đổi; Directus app
  vẫn bắt cài TFA (D-207.3).
- R4: `takeChallenge` nguyên tử (Redis `GETDEL`, `Map` local), không qua `createCache`.
- data-model: ràng buộc theo vendor; contracts: UV thiếu → 400/401, challenge sai mục đích, log không ghi dữ liệu khóa.

## Sửa câu chữ spec khi `/speckit.plan` (2026-11-01)

- FR-030 và bảng D-207: bộ đối chiếu ghi D-207 là entry `doc` (route chỉ Backoffice, test từng app bằng `appRequest`
  như D-189.6), không `http` (R9).
- FR-031: E2E lễ thật ở `proxy-api` mở trang tại `http://localhost:8162` (RP ID `localhost`, origin của replica
  `backoffice-api-passkey`), không phải `127.0.0.1:8162` (R10).
- "Cần xác nhận": thêm icon `passkey` của Material Symbols và cách hiện "lần dùng cuối" (relative) cho design owner.
- Assumptions: challenge key là chính chuỗi challenge (không id riêng); namespace Redis `backoffice:passkey`.
