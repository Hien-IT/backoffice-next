---

description: "Danh sách task cho feature 029: đăng nhập bằng Passkey (WebAuthn) cho user local"
---

# Tasks: Đăng nhập bằng Passkey (WebAuthn) cho user local

**Input**: Tài liệu thiết kế trong `/specs/029-passkey-login/`
**Prerequisites**: `plan.md`, `spec.md` (D-207..D-207.5, hai dependency, replica passkey, phương án E duyệt 2026-11-01).
Dùng thêm `research.md` (R1–R13), `data-model.md`, `contracts/` (`api.md`, `web.md`, `tests.md`), `quickstart.md`,
`checklists/security.md`, `checklists/api-compat.md`.

**Điều kiện bắt đầu**: spec, plan, checklist 029 đã commit lên `main` (`502cbcf2`, `6cce056a`, `be0b4e03`). Làm trên
`main`, không branch; script `.specify` cần `SPECIFY_FEATURE=029-passkey-login`. Checkout dùng chung với các phiên khác:
`git add` theo đường dẫn, không `git add -A`/`.`, không `stash`, `reset`, `checkout --`; không stage
`apps/api/project.json`, `apps/web/project.json`; push theo quy tắc checkout dùng chung (hỏi phiên đang giữ vai trò push
nếu có, `ListAgents`; chỉ push khi `main` không có run CI đang chạy, vì push hủy run cũ). Không sửa file dưới `directus/`.
Máy local: chạy test từng file, `--maxWorkers=1`; không dừng container của phiên khác; với `-- <file>` thì
`parity-tests:parity` cần `TEST_DB=<vendor>`.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Endpoint mới: mọi route dưới `/backoffice/auth/passkey*` và `/backoffice/users/*/passkeys*` (D-207, `doc`, test từng
  app bằng `appRequest`). Endpoint đổi hành vi: `GET /policies/me/globals`, GraphQL `policies_me_globals` với phiên
  passkey (D-207.5, `http` có điều kiện), `DELETE /users` (D-207.2, tác động DB). Đối chiếu: `parity/auth/passkey.test.ts`
  với authenticator giả `webauthn-fake.ts`; blackbox và parity `auth/*` hiện có không đổi; E2E ba cấu hình.
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).

**Organization**: Task nhóm theo user story, xếp theo hai lượt commit (research R12): **Lượt 1 (API)** = Phase 1, 2,
3 (US2 API), 4 (US1 API), 5 (US4), 6 (US3 API), 7 (US5 + đóng lượt); **Lượt 2 (Web)** = Phase 8 (US2 web), 9 (US1 web),
10 (US3 web), 11 (E2E US1/US2/US3/US5), 12 (Polish + đóng lượt). API của US2 (đăng ký) đi trước API của US1 (đăng nhập)
vì không có passkey đã đăng ký thì không đăng nhập được. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck,
test, build, parity/E2E liên quan xanh, commit, push khi `main` rảnh, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `pk/` = `apps/api/src/auth/passkey/`; `mig/` =
  `apps/api/src/database/backoffice-migrations/`; `web/` = `apps/web/src/`; `e2e/` = `apps/web-e2e/src/`; `parity/` =
  `tests/parity/src/`; `cl/` = `specs/029-passkey-login/`.
- Comment code ghi Directus là "DR" (constitution IX). File port sửa giữ header nguồn và ghi `// Backoffice (spec 029,
  D-207)` (hoặc `D-207.5` ở `fetch-accountability-policy-globals.ts`, `D-207.2` ở `users.service.ts`). File mới ghi
  `// Backoffice (spec 029): ...` ở đầu.
- Mã lỗi: chỉ `INVALID_CREDENTIALS`, `INVALID_PAYLOAD`, `FORBIDDEN`, `ROUTE_NOT_FOUND`, `SERVICE_UNAVAILABLE` có sẵn.
- Log: không ghi challenge, `response` của authenticator, public key (FR-007).

## Phase 1: Setup (chốt [Unverified] của research, lượt 1)

**Purpose**: cài gói và chốt ba điểm chưa thử trước khi viết code; kết quả có thể đổi tên option ở R1, cách E2E ở R10.

- [X] T001 Thêm `@simplewebauthn/server: 14.0.3` vào `catalog:` của `pnpm-workspace.yaml` (comment "spec 029, MIT; không
      có bản tương ứng ở Directus") và `"@simplewebauthn/server": "catalog:"` vào `apps/api/package.json` và
      `devDependencies` của `tests/parity/package.json`; `pnpm install
      --frozen-lockfile=false`; `pnpm audit` (có GHSA thì ghi `auditConfig.ignoreGhsas` với lý do, như tinymce). Viết test
      tạm `pk/spike.test.ts` (xóa ở T016): tạo credential P-256 bằng `node:crypto`, dựng attestation `none` và assertion
      (bản nháp của `webauthn-fake.ts`, T020), gọi `generateRegistrationOptions` → `verifyRegistrationResponse` →
      `generateAuthenticationOptions` → `verifyAuthenticationResponse` với `rpID: 'localhost'`, `expectedOrigin:
      'http://localhost:8162'`, `requireUserVerification: true`; ghi tên option/kết quả thật và kiểu `userID`
      (`Uint8Array`) vào "Kết quả T001" ở `cl/research.md` R1, sửa `cl/contracts/api.md` nếu tên trường khác. Làm
      2026-11-01: bài thử gộp vào `parity/auth/webauthn-fake.test.ts` (T020), không tạo `pk/spike.test.ts`.
- [X] T002 [P] Thử trong Playwright chromium (script tạm ở scratchpad, không commit) CDP `WebAuthn.enable` +
      `WebAuthn.addVirtualAuthenticator({ options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
      hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })` trên một trang
      `http://localhost:<port>` gọi `navigator.credentials.create` với `rp.id = 'localhost'` và với `rp.id = '127.0.0.1'`
      (mong: localhost được, IP bị `SecurityError`); ghi "Kết quả T002" vào `cl/research.md` R5 (IP) và R10 (tên option
      CDP), sửa `cl/contracts/tests.md` nếu khác.

## Phase 2: Foundational (migration, RP, kho challenge, tách login, D-207.5)

**Purpose**: phần lõi dùng chung cho mọi story; không có nó thì không endpoint nào chạy.

**⚠️ CRITICAL**: chưa xong Phase 2 thì không bắt đầu user story nào.

### Tests (MANDATORY) ⚠️

- [X] T003 [P] Tạo `mig/20261101A-create-backoffice-passkeys.test.ts` theo mẫu `mig/20261028A-create-backoffice-permissions
      .test.ts` (SQLite `:memory:` + `runSeed`): version `20261101A`, name "Create Backoffice Passkeys", danh sách
      `BACKOFFICE_MIGRATIONS` = `['20261026A','20261028A','20261101A']`; cột và null của `backoffice_passkeys` theo
      `cl/data-model.md` (`id` uuid PK, `user` uuid not null, `credential_id` string(255) not null, `public_key` text,
      `counter` bigint default 0, `transports` json null, `name` string(100), `device_type` string(32) null, `backed_up`
      bool default false, `discoverable` bool default true, `date_created` timestamp default now, `last_used` timestamp
      null); index `backoffice_passkeys_user_index` và unique `backoffice_passkeys_credential_id_unique` qua
      `sqlite_master`; không FK; cột `directus_sessions.bo_passkey` boolean nullable không default; chạy lại không lỗi và
      giữ dòng/cột; race: `hasTable` và `hasColumn` mock `false` một lần → `up` không ném. Sửa assertion danh sách ở
      `mig/20261028A-create-backoffice-permissions.test.ts`, `parity/deploy/backoffice-migrations.test.ts:30`,
      `parity/bootstrap/cross.test.ts:250-265` (thêm bảng và cột). Chạy đỏ.
- [X] T004 [P] Tạo `pk/rp.test.ts`: `getPasskeyRp()` với `PUBLIC_URL` `/` → null; `http://127.0.0.1:8056` → null (IP, theo
      T002); `https://bo.example.com/x/` → `{ rpId: 'bo.example.com', origin: 'https://bo.example.com' }`;
      `http://localhost:8091` → `{ rpId: 'localhost', origin: 'http://localhost:8091' }`; `https://[::1]:8443` → null.
      Chạy đỏ.
- [X] T005 [P] Tạo `pk/challenge-store.test.ts`: `putChallenge`/`takeChallenge` với kho local (không Redis): lấy một lần
      (lần hai `undefined`), hai `take` cùng lúc (`Promise.all`) chỉ một có giá trị, hết hạn theo `expires` (fake timers),
      giới hạn 10.000 khóa (khóa cũ nhất bị loại), `purpose`/`user` giữ nguyên; với Redis giả (`ioredis-mock` hoặc mock
      `useRedis` có `set`/`getdel`): `set(key, json, 'PX', 300000)` và `getdel` được gọi, key có tiền tố
      `backoffice:passkey:`. Chạy đỏ.
- [X] T006 [P] Thêm vào `api/services/authentication.service.test.ts`: `login` mật khẩu không đổi (mọi test hiện có xanh;
      số lần gọi knex/emitter như cũ); `finishLogin(user, payload, { passkey: true, session: true, ... })`: không gọi
      `TFAService.verifyOTP` dù `tfa_secret` có, không query `enforce_tfa`, token không có `enforce_tfa`, insert
      `directus_sessions` có `bo_passkey: true`, activity LOGIN, `last_access`, `auth.login` success với `provider:
      'default'` và payload `{ passkey: true, mode }`, reset limiter; `finishLogin({ passkey: false })` với `tfa_secret` và
      không `otp` → `InvalidOtpError` như cũ; `consumeLoginAttempt` suspend khi hết lượt và ném 503 khi limiter lỗi (như
      :143-197); `refresh` chế độ session với `record.session_bo_passkey = true` → dòng phiên mới có `bo_passkey: true`,
      với null → null; nhánh không session không đổi. Chạy đỏ.
- [X] T007 [P] Thêm vào `api/permissions/modules/fetch-accountability-policy-globals/fetch-accountability-policy-globals
      .test.ts`: policy bắt buộc + `accountability.session` có dòng `bo_passkey = true` → `enforce_tfa: false`; dòng
      `bo_passkey` null → `true`; không `session` (token json) → `true` và không query `directus_sessions`; policy không
      bắt buộc → `false` và không query `directus_sessions`. Chạy đỏ.

### Implementation

- [X] T008 Tạo `mig/20261101A-create-backoffice-passkeys.ts` (`version`, `name`, `up`: `hasTable` → `createTable` trong
      try/catch rồi kiểm lại; `hasColumn('directus_sessions','bo_passkey')` → `alterTable` trong try/catch, mẫu
      `20261026A`; không FK; comment đầu file nêu D-207.1, D-207.5) và thêm vào `BACKOFFICE_MIGRATIONS` ở `mig/index.ts`.
      T003 xanh.
- [X] T009 [P] Khai báo collection hệ thống ẩn: `libs/system-data/src/collections/collections.yaml` thêm
      `backoffice_passkeys` `hidden: true` với comment (403 `/items`, không GraphQL, ghi qua `/backoffice/users/*/passkeys`),
      test ở `libs/system-data/src/collections/index.test.ts` (như D-181); `api/services/graphql/schema/index.ts`
      `SYSTEM_DENY_LIST` thêm `'backoffice_passkeys'`; `parity/normalizers.ts` `BACKOFFICE_TABLE` (:117) và hai regex SDL
      (:284, :287) thêm `passkeys`, case mới ở `parity/normalizers.test.ts`.
- [X] T010 [P] Tạo `pk/rp.ts` (`getPasskeyRp()` theo R5: `URL` tuyệt đối, hostname không phải IPv4/IPv6 → `{ rpId, origin
      }`, khác → null; memo theo `PUBLIC_URL`) và `pk/index.ts`; `api/startup/run-startup-checks.ts` log `warn` một lần
      khi `getPasskeyRp() === null` ("passkey login disabled: PUBLIC_URL must be an absolute URL with a host name").
      T004 xanh.
- [X] T011 [P] Tạo `pk/challenge-store.ts` theo R4: `TTL = 5 * 60 * 1000`; Redis: `useRedis().set('backoffice:passkey:' +
      challenge, JSON, 'PX', TTL)` và `getdel`; local: `Map` + xóa trong cùng tick + giới hạn 10.000; `takeChallenge` trả
      `undefined` khi `expires < Date.now()`; lỗi Redis ném `ServiceUnavailableError({ service: 'passkey' })`. T005 xanh.
- [X] T012 Sửa `api/services/authentication.service.ts` (R2, R13; comment `Backoffice (spec 029, D-207)`): tách
      `consumeLoginAttempt(user, ctx)` (:143-197) và `finishLogin(user, updatedPayload, options)` (:207-326) thành
      phương thức public; `login` gọi lại hai hàm (hành vi không đổi); trong `finishLogin`, `options.passkey` bỏ khối OTP
      và khối `enforce_tfa`, insert `directus_sessions` thêm `bo_passkey: options.passkey ? true : null`; `refresh`
      `select` thêm `session_bo_passkey: 's.bo_passkey'`, `updateStatefulSession` insert thêm `bo_passkey:
      sessionRecord['session_bo_passkey'] ?? null`. T006 xanh, mọi test cũ của file xanh.
- [X] T013 Sửa `api/permissions/modules/fetch-accountability-policy-globals/fetch-accountability-policy-globals.ts` (R13,
      comment `Backoffice (spec 029, D-207.5)`): `Pick` thêm `'session'`; khi `result` và `accountability.session`: đọc
      `bo_passkey` của dòng `directus_sessions` theo token, `true` → `enforce_tfa: false`. T007 xanh;
      `api/controllers/policies.controller.ts` và `api/services/graphql/resolvers/system.ts` không đổi (cùng hàm).

**Checkpoint**: migration + collection ẩn + RP + kho challenge + login tách + D-207.5 xong; `pnpm nx run api:test` xanh.

## Phase 3: User Story 2 - Đăng ký và quản lý passkey của chính mình, phần API (Priority: P1, lượt 1)

**Goal**: user local có session tạo, xem, đổi tên, xóa passkey của mình qua `/backoffice/users/me/passkeys*`; nhập lại
mật khẩu trước khi lấy challenge; tối đa 10; discoverable + user verification; user khác `default` bị 403.

**Independent Test**: unit service/controller với `@simplewebauthn/server` mock; parity (T021) đăng ký thật bằng
authenticator giả rồi đọc dòng `backoffice_passkeys`.

### Tests for User Story 2 (MANDATORY) ⚠️

- [X] T014 [P] [US2] Tạo `api/services/passkey.service.test.ts` (`vi.mock('@simplewebauthn/server')`, `knex-mock-client`,
      mock `pk/challenge-store`, mock `AuthenticationService.verifyPassword`): `registrationOptions(user, password)`: sai
      mật khẩu → `InvalidCredentialsError` không gọi limiter; `provider !== 'default'` → `ForbiddenError`; đủ 10 → 
      `InvalidPayloadError` "maximum of 10 passkeys"; options có `rp.id` từ `getPasskeyRp`, `rp.name` = `project_name ||
      'Backoffice'`, `user.id` = uuid dạng `Uint8Array` (theo T001), `excludeCredentials` = mọi credential của user với
      `transports`, `residentKey: 'required'`, `userVerification: 'required'`, `attestationType: 'none'`; challenge lưu
      `{ purpose: 'register', user }`; `register(user, response, name)`: challenge thiếu/sai purpose/user khác → 400,
      `verified === false` → 400, UV thiếu → 400, credential id > 255 ký tự → 400, trùng `credential_id` → 400, `name` rỗng
      hay > 100 → 400, lưu đúng cột (base64url, `counter`, `transports`, `device_type`, `backed_up`, `discoverable: true`),
      trả dòng công khai (không `credential_id`, `public_key`, `counter`); `list(user)` sắp `date_created` tăng;
      `rename(user, id, name)` id không của user → `ForbiddenError`; `remove(user, id)` cùng quy tắc; `listForAdmin(pk)`
      user `provider` khác → `[]`; `removeForAdmin(pk, id)` id không thuộc pk → `ForbiddenError`. Chạy đỏ.
- [X] T015 [P] [US2] Tạo `api/controllers/backoffice-passkeys.controller.test.ts` (Nest `Test.createTestingModule` +
      supertest, mock service): bảng route của `@Controller('backoffice')` không đè `backoffice/permissions` (cả hai
      controller trong module test, `GET /backoffice/permissions` vẫn tới controller 025); không `accountability.user` →
      401 ở mọi route `users/me/*`; `users/:pk/*` không admin → 403; `GET` đặt `res.locals.cache === false`; body Joi:
      `password` string required, `response` object required, `name` string 1–100, `mode` valid; passkey tắt
      (`getPasskeyRp` null) → 404 `ROUTE_NOT_FOUND` ở mọi route. Chạy đỏ.

### Implementation for User Story 2

- [X] T016 [US2] Tạo `api/services/passkey.service.ts` (`PasskeyService`, Knex trực tiếp, `randomUUID()` cho id; hàm của
      T014; `rpName` đọc `directus_settings.project_name` như `TFAService.generateTFA`; log `info` đăng ký/xóa với user id
      và passkey id) và export ở `api/services/index.ts`; factory trong `api/providers.ts` `serviceProviders` như
      `BackofficePermissionsService` (:200-205). Xóa `pk/spike.test.ts` của T001. T014 xanh.
- [X] T017 [US2] Tạo `api/controllers/backoffice-passkeys.controller.ts` `@Controller('backoffice')` với
      `users/me/passkeys` (GET, POST), `users/me/passkeys/options` (POST), `users/me/passkeys/:id` (PATCH, DELETE),
      `users/:pk/passkeys` (GET), `users/:pk/passkeys/:id` (DELETE) theo `cl/contracts/api.md` (401/403/404, Joi,
      `res.locals.cache = false`, `respond`); đăng ký ở `api/app.module.ts` `controllers`. T015 xanh (phần users).

**Checkpoint**: đăng ký và quản lý qua API chạy với unit test; chưa có đăng nhập.

## Phase 4: User Story 1 - Đăng nhập app Backoffice bằng passkey, phần API (Priority: P1, lượt 1) 🎯 MVP

**Goal**: `POST /backoffice/auth/passkey/login/options` + `/login` tạo session y hệt login local theo `mode`; không OTP,
không `enforce_tfa`; `GET /backoffice/auth/passkey` trả `rp_id`.

**Independent Test**: unit service (thứ tự lỗi) + controller (cookie theo `mode`); parity (T021) đăng nhập thật với
credential của T014/T021, so dòng `directus_sessions`, activity, cookie với login mật khẩu.

### Tests for User Story 1 (MANDATORY) ⚠️

- [X] T018 [US1] Thêm vào `api/services/passkey.service.test.ts`: `loginOptions()` lưu challenge `{ purpose: 'login' }`,
      `allowCredentials: []`, `userVerification: 'required'`, `rpId`; `login(response, mode, accountability)` theo thứ tự:
      challenge thiếu/hết hạn/purpose `register` → `InvalidCredentialsError` + `emitStatus('fail')` + `stall`, không đếm;
      `response.id` không có dòng → lỗi chung không đếm; dòng có nhưng user không có (mồ côi) → lỗi chung không đếm;
      `status !== 'active'` hay `provider !== 'default'` → lỗi chung, **không** đếm (`consumeLoginAttempt` không được
      gọi, như `authentication.service.ts:131`; user `invited` không bị chuyển `suspended`);
      `verified === false`, UV thiếu, `newCounter <= counter` khi `counter > 0` → lỗi chung + đếm; `newCounter === 0` khi
      `counter === 0` → qua (passkey đồng bộ); thành công → update `counter`, `last_used`, gọi `finishLogin(user,
      { passkey: true, mode }, { passkey: true, session: mode === 'session', providerName: 'default', ... })`; `auth.login`
      filter pending chạy với payload `{ passkey: true, mode }`; kho challenge ném 503 → 503. Thêm vào
      `api/controllers/backoffice-passkeys.controller.test.ts`: `GET /backoffice/auth/passkey` → `{ data: { rp_id } }`;
      `POST .../login/options` 200 không cần session; `POST .../login` `mode` `json` → `{ expires, access_token,
      refresh_token }`, `cookie` → cookie `REFRESH_TOKEN_COOKIE_NAME` + `access_token`, `session` → cookie
      `SESSION_COOKIE_NAME` + `{ expires }` (so với `local.ts:88-100`), body thiếu `response` → 400 sau stall. Chạy đỏ.

### Implementation for User Story 1

- [X] T019 [US1] Thêm `loginOptions()` và `login()` vào `api/services/passkey.service.ts` (R3; `emitStatus` cùng chữ ký
      với `login` của `AuthenticationService`, `timeStart` từ đầu request, `stall(LOGIN_STALL_TIME)` ở mọi nhánh lỗi;
      đọc `challenge` từ `clientDataJSON` của `response` trước khi gọi thư viện) và ba route `auth/passkey`,
      `auth/passkey/login/options`, `auth/passkey/login` vào `api/controllers/backoffice-passkeys.controller.ts`
      (accountability mặc định như `local.ts:62-80`: ip, userAgent cắt 1024, origin; cookie và payload theo `mode`).
      T018 xanh; `api/controllers/auth.controller.ts` không đổi.

**Checkpoint**: MVP API: đăng ký rồi đăng nhập bằng passkey tạo session dùng được cho mọi endpoint.

## Phase 5: User Story 4 - An toàn, giới hạn và nhiều instance (Priority: P1, lượt 1)

**Goal**: chứng minh bằng parity trên hai app thật: đếm attempt, suspend, stall, challenge một lần/đồng thời/hết hạn,
counter lùi, không lộ user, session dùng chéo với Directus, D-207.5.

**Independent Test**: `parity/auth/passkey.test.ts` trên env Postgres (`TEST_DB=postgres`), bộ `reduced` trên MySQL,
SQLite.

### Tests for User Story 4 (MANDATORY) ⚠️

- [X] T020 [P] [US4] Tạo `parity/auth/webauthn-fake.ts` (R9): `createFakeAuthenticator({ rpId, origin })` với khóa EC
      P-256 (`generateKeyPairSync('ec', { namedCurve: 'prime256v1' })`), `register(options)` → `RegistrationResponseJSON`
      (clientDataJSON `webauthn.create`, attestation CBOR `{ fmt: 'none', attStmt: {}, authData }`, COSE key map
      `{1:2, 3:-7, -1:1, -2:x, -3:y}`, flags UP|UV|AT, counter 0, credential id 32 byte, transports `['internal']`),
      `authenticate(options, { counter?, uv? = true })` → `AuthenticationResponseJSON` (chữ ký ECDSA SHA-256 DER trên
      `authData || sha256(clientDataJSON)`), encoder CBOR tối thiểu (map, text, bytes, int) và base64url; unit test
      `parity/auth/webauthn-fake.test.ts` kiểm bằng `@simplewebauthn/server` (devDependency của `tests/parity`) với
      `verifyRegistrationResponse`/`verifyAuthenticationResponse`. Chạy xanh trước khi dùng.
- [X] T021 [US4] Tạo `parity/auth/passkey.test.ts` (`appRequest`, `at('directus')`, `createUser`, `createRole`,
      `setSettings`, `hostDb`; `webauthn-fake`): (1) mọi route mới: Directus 404 `ROUTE_NOT_FOUND`; (2) Backoffice 401
      không xác thực, 403 user LDAP (`provider: 'ldap'`), 403 non-admin `GET /backoffice/users/:pk/passkeys`, 400 body
      sai, 401 mật khẩu sai ở options, static token của user local được nhận ở `GET .../me/passkeys` (như TFA);
      `GET/POST /items/backoffice_passkeys` → 403 ở Backoffice (Directus: bảng chưa quản lý, chỉ ghi nhận), GraphQL
      `/graphql/system` introspection không có type `backoffice_passkeys`; `GET /server/specs/oas` không có đường dẫn
      `/backoffice/`; origin sai (authenticator giả ký `http://evil.localhost`) → đăng ký 400, đăng nhập 401; (3) đăng ký → `GET .../me/passkeys` một dòng → đăng nhập `mode` `session`, `json`,
      `cookie`: cookie/body như `/auth/login` cùng mode của cùng user (so khóa và thuộc tính cookie), dòng
      `directus_sessions` (có `bo_passkey = 1/true`), activity `login`, `last_access`, `counter` = 1, `last_used` khác
      null; (4) user có `tfa_secret` và role `enforce_tfa`: đăng nhập không OTP, JWT không `enforce_tfa`, `GET
      /policies/me/globals` và `POST /graphql/system { policies_me_globals { enforce_tfa } }` với cookie passkey gửi tới
      từng app (`appRequest`/`capture`): Backoffice `false`, Directus `true` (D-207.5 `doc`), sau `POST /auth/refresh` vẫn
      `false`, cookie đăng nhập mật khẩu cùng user
      `true` ở cả hai và `parity()` khớp; (5) challenge dùng lại → 401, hết hạn (xóa khóa `backoffice:passkey:*` bằng
      client ioredis tới Redis của env parity) → 401, hai `login` song song cùng challenge → đúng một 200, challenge đăng ký dùng cho
      đăng nhập → 401, counter lùi (`authenticate` với `counter` nhỏ hơn) → 401 và `auth_login_attempts` giảm (đo qua số
      lần sai tới `suspended`), `uv: false` → 401; N lần sai (`auth_login_attempts = 3`) → `status = 'suspended'` + activity
      update như dò mật khẩu; user `invited` có passkey (đổi status bằng API) đăng nhập passkey → 401, status vẫn
      `invited`; credential lạ → 401 không đếm, độ trễ ≈ `LOGIN_STALL_TIME` (chênh ≤ 10 % so với sai mật
      khẩu); (6) cookie passkey gửi tới Directus: `POST /auth/refresh` 200, `GET /users/me` 200, `POST /auth/logout` 204
      (SC-007); (7) `PATCH` đổi tên, `DELETE` của mình, admin `GET`/`DELETE` của user khác, `DELETE /users/:id` ở
      Backoffice → 0 dòng `backoffice_passkeys` của user (D-207.2); `DELETE /users/:id` ở Directus → dòng còn, đăng nhập
      bằng passkey đó → 401; (8) mọi test `parity/auth/*` hiện có xanh nguyên. Thêm file vào `FULL_FILES` và phần (1),
      (3) vào `REDUCED_FILES` của `parity/suite.ts`. Chạy đỏ tới khi T016–T019 xong.
- [X] T022 [P] [US4] Thêm vào `tests/parity/accepted-differences.ts`: D-207 (`doc`, route chỉ Backoffice), D-207.1
      (`doc`), D-207.2 (`doc`), D-207.3 (`doc`), D-207.4 (`doc`), D-207.5 (`doc`, kiểm từng app ở T021 phần 4; `when`
      không có điều kiện theo request nên không dùng `http`);
      `parity/spec-differences` đọc được sáu mã từ `cl/spec.md` (test có sẵn).

### Implementation for User Story 4

- [X] T023 [US4] Rà `api/services/passkey.service.ts` theo T021: mọi nhánh lỗi đăng nhập đi qua `stall`; đếm attempt chỉ
      khi có user; log không ghi challenge/response/public key; `credential_id` tra bằng unique index (không quét); kho
      challenge lỗi → 503. T021 phần (1)–(6) xanh trên Postgres.

**Checkpoint**: parity passkey xanh Postgres; `reduced` xanh MySQL và SQLite.

## Phase 6: User Story 3 - Admin xóa passkey của user khác, phần API (Priority: P2, lượt 1)

**Goal**: admin xem/xóa passkey của user khác (route `:pk` đã có ở T017); xóa user xóa passkey.

**Independent Test**: unit `users.service` cascade; parity T021 phần (7).

### Tests for User Story 3 (MANDATORY) ⚠️

- [X] T024 [P] [US3] Thêm vào `api/services/users.service.test.ts`: `deleteMany(keys)` xóa `backoffice_passkeys` `whereIn
      user` sau `clearUserSessions` khi `hasTable` true, bỏ qua khi false; `deleteOne` đi qua `deleteMany`. Chạy đỏ.

### Implementation for User Story 3

- [X] T025 [US3] Sửa `api/services/users.service.ts` `deleteMany` (:335, comment `Backoffice (spec 029, D-207.2)`): sau
      `clearUserSessions(keys)`, `if (await this.knex.schema.hasTable('backoffice_passkeys')) await
      this.knex('backoffice_passkeys').whereIn('user', keys).delete()`. T024 xanh; T021 phần (7) xanh.

**Checkpoint**: API đủ cho US1–US4; US3 API xong.

## Phase 7: User Story 5 - Chạy song song với Directus (Priority: P2) + đóng lượt 1

**Goal**: môi trường parity có replica passkey cho E2E lượt 2; tài liệu vận hành; bootstrap/deploy; commit lượt 1.

**Independent Test**: `pnpm nx run parity-tests:env-up --profile web` lên đủ service; `parity/bootstrap`, `parity/deploy`
xanh.

- [X] T026 [P] [US5] Sửa `tests/parity/docker-compose.yml` profile `web`: service `backoffice-api-passkey` (cùng image,
      `env_file`, DB, Redis, volume với `backoffice-api`; `PUBLIC_URL: http://localhost:8162`; healthcheck `/server/ping`;
      `depends_on` như `backoffice-api`) và `tests/parity/proxy/web-api.conf`: `location ^~ /backoffice/auth/passkey` và
      `location ~ ^/backoffice/users/[^/]+/passkeys` → `backoffice-api-passkey:8055`, phần còn lại giữ nguyên;
      `proxy-web-api` `depends_on` thêm service mới. Ghi chú đầu khối (R10). Kiểm local: `env-up --profile web`, `curl
      http://localhost:8162/backoffice/auth/passkey` → `{ data: { rp_id: 'localhost' } }`, `curl
      http://127.0.0.1:8162/backoffice/auth/passkey` cũng 200 (RP ID theo API, web tự ẩn theo hostname).
- [X] T027 [P] [US5] Tài liệu vận hành: `deploy/README.md` mục mới "## Passkey (spec 029)" sau "Chạy cạnh Directus: hai
      domain" (:199): `PUBLIC_URL` tuyệt đối với tên miền (không IP), HTTPS trừ localhost, đổi domain = đăng ký lại,
      không biến env mới, Redis cho nhiều replica, gỡ tay (`DROP TABLE backoffice_passkeys`, `ALTER TABLE directus_sessions
      DROP COLUMN bo_passkey`, xóa dòng `20261101A` trong `backoffice_migrations`); một câu ở mục standalone (:333) và
      mục "Migration riêng của Backoffice (spec 022)" (:411) thêm `20261101A`; `tests/parity/README.md` thêm
      `auth/passkey`, replica passkey của profile `web`, D-207..D-207.5.
- [X] T028 [P] [US5] Thêm `parity/deploy/passkey.test.ts` vào bộ deploy (3 replica + 1 Directus qua lb): đăng ký passkey
      (authenticator giả, `webauthn-fake`) gọi thẳng replica A, lấy challenge đăng nhập ở A, xác minh ở replica B → 200
      (challenge trong Redis dùng chung); cookie dùng được qua lb và qua Directus. Thêm vào danh sách của suite deploy.
- [ ] T029 Đóng lượt 1: `pnpm nx run-many -t lint,typecheck -p api,system-data,parity-tests`; `pnpm nx run api:test`;
      `pnpm nx run system-data:test`; `TEST_DB=postgres pnpm nx run parity-tests:parity -- auth/passkey auth/login
      auth/refresh auth/logout auth/tfa auth/login-attempts permissions/backoffice-permissions`; bộ `reduced` trên MySQL và
      SQLite; `pnpm nx run parity-tests:bootstrap` (profile `bootstrap`: migration chạy, chạy lại, dump không đổi) và
      `parity-tests:deploy` nếu máy đủ; `pnpm nx run api:build`; sau khi push, chạy `gh workflow run benchmark.yml -f
      job=benchmark-auth` (Nguyên tắc X: auth không tệ hơn Directus quá 10 %, vì `AuthenticationService.login` được tách)
      và ghi kết quả vào `cl/spec.md` Status; cập nhật `cl/spec.md` Status ("lượt 1 ... commit ..."),
      `cl/research.md` "Kết quả T001/T002"; `git add` theo đường dẫn (không hai `project.json`); commit
      `feat(api): passkey login, registration and management endpoints (spec 029, lượt 1)` với trailer Co-Authored-By;
      push khi `main` rảnh; theo dõi CI (`quality`, `parity` Postgres/MySQL/SQLite, `bootstrap`, `deploy`) xanh, sửa đỏ;
      `graphify update .`.

**Checkpoint lượt 1**: API đầy đủ trên `main`, CI xanh; app web chưa có nút.

## Phase 8: User Story 2 - Đăng ký và quản lý passkey của chính mình, phần web (Priority: P1, lượt 2)

**Goal**: card "Passkeys" trên trang user của mình: danh sách, thêm (mật khẩu → trình duyệt → tên), đổi tên, xóa, giới
hạn 10, ẩn với provider khác `default`.

**Independent Test**: unit + browser test với `@simplewebauthn/browser` mock và API mock (`KNOWN_REQUESTS`); E2E T046.

### Tests for User Story 2 (MANDATORY) ⚠️

- [ ] T030 [P] [US2] Tạo `web/composables/use-passkey-support.test.ts`: không `PublicKeyCredential` → `false`; `GET
      /backoffice/auth/passkey` 404 → `false`; 200 với `rp_id` khác `location.hostname` → `false`; khớp → `true`; gọi hai
      lần chỉ một request; đổi `apiUrl` làm lại. Chạy đỏ.
- [ ] T031 [P] [US2] Tạo `web/composables/use-passkeys.test.ts` (mock `sdk.request`, mock `startRegistration`): `load()`
      `GET /backoffice/users/me/passkeys`; `add(password, name)`: `POST .../options` body `{ password }` → `startRegistration({
      optionsJSON })` → `POST .../passkeys` body `{ response, name }`; hủy (`NotAllowedError`) → không request thứ ba, không
      lỗi; mật khẩu sai → `error` là lỗi SDK; `rename(id, name)` PATCH; `remove(id)` DELETE; `loadForUser(pk)` GET
      `/backoffice/users/:pk/passkeys`; `removeForUser(pk, id)`; `atLimit` khi 10. Chạy đỏ.
- [ ] T032 [P] [US2] Tạo `web/modules/users/components/UserPasskeys.browser.test.ts` (vitest browser, axe): ẩn khi
      `passkeyAvailable` false, `provider` khác `default`, hay không phải mình và không admin; trạng thái trống (`passkey_none`,
      nút thêm); bảng với 2 dòng (cột tên, ngày tạo, lần dùng cuối "Never used"); nút thêm `disabled` + mô tả khi 10;
      dialog thêm: bước mật khẩu (label "Password", `autocomplete=current-password`, submit `next`), lỗi `BoNotice
      role=alert`, bước tên với giá trị gợi ý, `save`; đổi tên; xóa với xác nhận (nút Cancel trước, Delete `danger`), focus
      về trigger sau khi đóng; admin xem người khác: không nút thêm/đổi tên, có nút xóa `aria-label`, câu
      `passkey_admin_delete_text`; axe không vi phạm serious/critical; mọi thao tác bằng bàn phím (Tab, Enter, Esc). Chạy đỏ.
- [ ] T033 [P] [US2] Thêm vào `web/modules/users/routes/UserItemRoute.test.ts` (hoặc tạo nếu chưa có, mount với router
      và store giả): trang user mới (`+`) không render `UserPasskeys`; trang user có id render với `user-id`, `provider`,
      `is-current-user` đúng cho chính mình và cho user khác. Chạy đỏ.

### Implementation for User Story 2

- [ ] T034 [US2] Thêm `@simplewebauthn/browser: 14.0.0` vào `catalog:` và `apps/web/package.json`; `pnpm install`;
      `apps/web/vite.config.ts`: `API_PATHS` thêm `backoffice`, `optimizeDeps.include` thêm `@simplewebauthn/browser`.
- [ ] T035 [P] [US2] Tạo `web/composables/use-passkey-support.ts` theo `cl/contracts/web.md` (promise theo module,
      `browserSupportsWebAuthn()`, `apiFetch('/backoffice/auth/passkey')`, so `rp_id` với `location.hostname`, làm lại khi
      `setApiUrl`). T030 xanh.
- [ ] T036 [P] [US2] Tạo `web/composables/use-passkeys.ts` (`load`, `add`, `rename`, `remove`, `loadForUser`,
      `removeForUser`, `loading`, `error`, `atLimit`; `requestEndpoint`; `startRegistration` của `@simplewebauthn/browser`;
      hủy → trả `false`, không lỗi). T031 xanh.
- [ ] T037 [US2] Tạo `web/modules/users/components/UserPasskeys.vue` theo `cl/contracts/web.md` và research R8: card recipe,
      header với `BoIcon name="passkey"` + `h3` + mô tả + nút thêm, `BoTable` (`caption` sr-only, slot `item-append` BoMenu
      hoặc nút xóa, slot `empty`), `BoDialog` thêm hai bước (form id `${id}-password`, `${id}-name`, nút submit ngoài form
      qua `:form`, mẫu `SystemMfaSetup.vue:244-301`), dialog đổi tên, dialog xóa (thứ tự D-76, câu admin), `BoNotice` lỗi
      qua `translateAPIError`, tên gợi ý `passkey_default_name` với `navigator.userAgentData?.platform ||
      navigator.platform`; lần dùng cuối/ngày tạo hiện relative (dùng display datetime hiện có với `relative: true`); chỉ
      class token theme (`tools/check-raw-colors.mjs` qua). T032 xanh.
- [ ] T038 [US2] Sửa `web/modules/users/routes/UserItemRoute.vue`: sau `<BoForm>` (:437) thêm `<UserPasskeys v-if="!isNew"
      :user-id="primaryKey" :provider="item?.provider ?? null" :is-current-user="item?.id === currentUserId" />` trong cùng
      cột `gap-8`; không đổi `fieldsDenyList`. T033 xanh.
- [ ] T039 [P] [US2] Thêm chuỗi `passkey_*` vào `web/lang/overlay/en-US.ts` và `web/lang/overlay/vi-VN.ts` theo bảng
      `cl/contracts/web.md` (nhóm comment `// Spec 029 (D-207.4)`), cùng `passkey_sign_in` cho US1. `web/lang/overlay.test.ts`
      xanh.
- [ ] T040 [P] [US2] Danh sách request đóng: `web/test-utils/fetch.ts` `KNOWN_REQUESTS`, `e2e/helpers/allowed-paths.ts`
      (id tiếp theo), `specs/012-backoffice-web-shell/contracts/api-calls.md` thêm 10 request của `cl/contracts/web.md`.

**Checkpoint**: card Passkeys chạy với API thật ở dev (`PUBLIC_URL` dev trỏ đúng origin, quickstart "Cấu hình dev").

## Phase 9: User Story 1 - Đăng nhập app Backoffice bằng passkey, phần web (Priority: P1, lượt 2)

**Goal**: nút "Đăng nhập bằng Passkey" trên form login; hủy không lỗi; lỗi như sai mật khẩu; chuyển hướng như login.

**Independent Test**: unit `auth.ts`, `LoginForm`; E2E T047.

### Tests for User Story 1 (MANDATORY) ⚠️

- [ ] T041 [P] [US1] Thêm vào `web/auth.test.ts`: `loginWithPasskey()` gọi `POST /backoffice/auth/passkey/login/options`
      → `startAuthentication({ optionsJSON })` (mock) → `POST /backoffice/auth/passkey/login` body `{ response, mode:
      'session' }` → `sdk.refresh()` → `appStore.authenticated`, `serverStore.hydrate`, `hydrate()` như `login()`; hủy
      (`NotAllowedError`) → ném `{ code: 'PASSKEY_CANCELLED' }`, không request thứ hai; lỗi API ném nguyên. Chạy đỏ.
- [ ] T042 [P] [US1] Thêm vào `web/routes/login/LoginForm.test.ts`: nút `passkey_sign_in` chỉ khi `passkeyAvailable`;
      nằm ngoài `<form>` (Enter trong ô mật khẩu vẫn gửi form mật khẩu); bấm → `loginWithPasskey` → `router.push`
      (`redirect` query, `last_page`, `/content`); `PASSKEY_CANCELLED` → không `BoNotice`, focus về nút; lỗi
      `INVALID_CREDENTIALS` → `BoNotice` cùng chuỗi với sai mật khẩu; `loading` khóa cả hai nút. Chạy đỏ.

### Implementation for User Story 1

- [ ] T043 [US1] Thêm `loginWithPasskey()` vào `web/auth.ts` (RestCommand như nhánh `identifier` :59-70, khối sau thành
      công :76-82 dùng chung; không ghi gì vào `localStorage`). T041 xanh.
- [ ] T044 [US1] Sửa `web/routes/login/LoginForm.vue`: `usePasskeySupport()`, `BoButton variant="secondary" full-width
      icon="passkey"` dưới `<form>`, `loggingInWithPasskey`, xử lý hủy/lỗi/chuyển hướng theo `cl/contracts/web.md`. T042
      xanh; `web/router/guard.ts` không đổi (D-207.5 do API).

**Checkpoint**: đăng nhập bằng passkey từ app web chạy ở dev.

## Phase 10: User Story 3 - Admin xóa passkey của user khác, phần web (Priority: P2, lượt 2)

**Goal**: nhánh admin của card (đã viết ở T037) được kiểm riêng.

- [ ] T045 [US3] Rà nhánh admin trong `web/modules/users/components/UserPasskeys.vue` theo T032: chỉ danh sách + nút xóa với
      `aria-label`, câu `passkey_admin_delete_text`, không dialog mật khẩu; user khác `provider` khác `default` → card ẩn
      (API trả `[]` nhưng card ẩn theo `provider` của item). T032 nhánh admin xanh.

## Phase 11: E2E ba cấu hình (US1, US2, US3, US5; lượt 2)

**Goal**: lễ passkey thật trên chromium ở `proxy-api` (`http://localhost:8162`, replica T026); ẩn ở `proxy-directus` và
`cors`.

**Independent Test**: `E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- --project chromium-1280 passkey`, rồi
`proxy-directus`, `cors` (không chạy hai cấu hình cùng lúc).

- [ ] T046 [P] [US5] Helpers: `e2e/helpers/config.ts` thêm `passkeyWebUrl` (`proxy-api` → `http://localhost:8162`, khác →
      `webUrl`); `e2e/helpers/login.ts` `login(page, user, { baseUrl? })` và `resetLastPage` không đổi; helper mới
      `e2e/helpers/webauthn.ts`: `addVirtualAuthenticator(page)` (CDP `WebAuthn.enable` + `addVirtualAuthenticator` với
      option của T002, trả `authenticatorId`), `setUserVerified(page, id, bool)`, `removeVirtualAuthenticator`; skip chung
      `test.skip(browserName !== 'chromium', 'WebAuthn virtual authenticator is chromium only')`.
- [ ] T047 [US2] Tạo `e2e/users-passkey.spec.ts` (gồm cả nhánh admin của US3): fixture user local (`fixtures.user`), đăng nhập mật khẩu tại
      `passkeyWebUrl`, `openOwnPage`, card trống → thêm với mật khẩu sai (lỗi, không hộp thoại trình duyệt) → đúng → tên
      gợi ý → lưu → dòng hiện → `expect.poll(api GET /backoffice/users/:id/passkeys)` 1 dòng → đổi tên → xóa; user LDAP
      (`fixtures.user` với `provider: 'ldap'`): card ẩn; admin mở trang user khác: chỉ nút xóa, xóa được; axe trên card
      và dialog; ở `proxy-directus` và `cors`: `expect(card).toHaveCount(0)`, không lỗi console, không request lạ.
- [ ] T048 [US1] Tạo `e2e/login-passkey.spec.ts`: trong `beforeAll` đăng ký passkey qua UI như T047 (cùng authenticator
      ảo của context, `test.describe.configure({ mode: 'serial' })`), đăng xuất → nút hiện →
      bấm → vào `/content`; user có TFA (`tfa_secret: TFA_SECRET`): không ô OTP; role `enforce_tfa` (policy) chưa có TFA:
      không tới `/tfa-setup`, tải lại trang vẫn không, xóa `localStorage` vẫn không; đăng xuất, đăng nhập mật khẩu → tới
      `/tfa-setup`; hủy (`setUserVerified(false)` hoặc Esc) → form nguyên; `proxy-directus`/`cors`: nút
      `toHaveCount(0)`.
- [ ] T049 [US5] Thêm trang user có card Passkeys vào `e2e/a11y.spec.ts` (chromium, `proxy-api`); chạy ba cấu hình lần
      lượt trên máy local (`env-up --profile web` với replica T026) và sửa flake; ghi thời gian job `e2e-web` để so ở CI.

## Phase 12: Polish & Cross-Cutting (lượt 2)

- [ ] T050 [P] `design-system/docs/component-specs.md` thêm recipe "Q-xx Passkeys (spec 029)": card + BoTable + BoMenu +
      BoDialog hai bước, icon `passkey`, thời gian relative, trạng thái và a11y; `design-system/qa/handoff-checklist.md`
      không đổi.
- [ ] T051 [P] Ghi chú "(029: ...)" ở `specs/012-backoffice-web-shell/spec.md` (login) và
      `specs/015-files-users-modules/spec.md` (trang user); `CLAUDE.md` dòng 029 cập nhật (implemented, D-207..D-207.5);
      `SPECKIT-GUIDE.md` mục 029 trạng thái và lệnh implement đã chạy.
- [ ] T052 Đóng spec: `cl/spec.md` Status "Implemented 2026-xx-xx, hai lượt trên main (commit ...), CI ..."; bảng D giữ
      "duyệt 2026-11-01"; `cl/research.md` kết quả T001/T002; `cl/quickstart.md` lệnh test đúng tên target.
- [ ] T053 Đóng lượt 2: `pnpm nx run-many -t lint,typecheck -p web,web-e2e`; `pnpm nx run web:test:unit`; `pnpm nx run
      web:test:browser -- passkey UserPasskeys`; E2E ba cấu hình (T049); `pnpm nx run web:build`; `git add` theo đường dẫn;
      commit `feat(web): passkey sign-in button and Passkeys card (spec 029, lượt 2)` + commit docs nếu tách; push khi
      `main` rảnh; CI (`quality`, `e2e-web` ba cấu hình × trình duyệt, `parity`) xanh, sửa đỏ; `graphify update .`.

## Dependencies & Execution Order

### Phase

- Lượt 1: Phase 1 (T001 ‖ T002) → Phase 2 (T003–T007 đỏ ‖, rồi T008 → T009 ‖ T010 ‖ T011 → T012 → T013) → Phase 3 (US2
  API: T014 ‖ T015 → T016 → T017) → Phase 4 (US1 API: T018 → T019) → Phase 5 (US4: T020 ‖ T022 bất kỳ lúc nào sau Phase 2;
  T021 cần T016–T019; T023 theo T021) → Phase 6 (US3 API: T024 → T025) → Phase 7 (T026 ‖ T027 ‖ T028 → T029 đóng lượt 1).
- Lượt 2: Phase 8 (US2 web: T030–T033 đỏ ‖; T034 → T035 ‖ T036 → T037 → T038 (T033 xanh); T039 ‖ T040) → Phase 9 (US1 web: T041 ‖
  T042 → T043 → T044) → Phase 10 (T045) → Phase 11 (T046 → T047 → T048 → T049) → Phase 12 (T050 ‖ T051 → T052 → T053).
  Cần lượt 1 trên `main` (API của env E2E là Backoffice mới, replica T026).

### User story

- US2 API (P1, lượt 1): cần Phase 2. US1 API (P1): cần US2 API (có credential để đăng nhập) và Phase 2.
- US4 (P1, lượt 1): cần US1 và US2 API; T020, T022 không cần gì ngoài Phase 2.
- US3 API (P2, lượt 1): T017 (route admin) + T025 (cascade); độc lập với US4.
- US5 (P2): T026–T028 chỉ cần Phase 2 (để replica khởi động được) — làm song song với Phase 3–6 nếu khác người.
- US2 web, US1 web, US3 web (lượt 2): cần lượt 1; US1 web cần US2 web (phải có passkey để đăng nhập trong E2E).

### Trong một story

- Test trước (chạy đỏ) → file mới → file sửa → chạy xanh → task đóng lượt.
- T012 trước T019 (`finishLogin`); T013 trước T021 phần (4); T011 trước T016/T019 (kho challenge).
- T034 trước T035/T036 (gói browser); T037 trước T038; T039 trước mọi browser test (key i18n).
- T026 trước T047/T048 (`http://localhost:8162`).

## Parallel Example

```bash
# Lượt 1:
#   T001 ‖ T002; rồi T003 ‖ T004 ‖ T005 ‖ T006 ‖ T007 (đỏ); T008; T009 ‖ T010 ‖ T011; T012 → T013
#   T014 ‖ T015 → T016 → T017 → T018 → T019; T020 ‖ T022 ‖ T026 ‖ T027 ‖ T028 bất kỳ lúc nào sau Phase 2
#   T021 → T023; T024 → T025; T029
# Lượt 2:
#   T030 ‖ T031 ‖ T032 ‖ T033 (đỏ); T034; T035 ‖ T036 ‖ T039 ‖ T040; T037 → T038; T041 ‖ T042 → T043 → T044; T045
#   T046 → T047 → T048 → T049; T050 ‖ T051 → T052 → T053
```

## Implementation Strategy

### MVP (lượt 1)

1. T001, T002: chốt tên option của thư viện, CDP, RP ID là IP.
2. Phase 2: migration + cột `bo_passkey`, RP, kho challenge, tách login, D-207.5.
3. US2 API → US1 API: đăng ký rồi đăng nhập.
4. US4: parity với authenticator giả, D-207.5 (`doc`, kiểm từng app), suspend, stall, session chéo Directus.
5. US3 API, US5: cascade, replica passkey, README.
6. T029: commit, CI. Dừng được ở đây: API dùng qua SDK/curl (quickstart), app web chưa có nút.

### Tăng dần

- Lượt 2: web (card, nút), E2E ba cấu hình, recipe design-system, đóng spec.

## Notes

- 53 task, 30 có [P]; 2 lượt; US2 16 task (API 4 + web 11 + E2E 1), US1 7 (API 2 + web 4 + E2E 1), US4 4, US3 3,
  US5 5; không nhãn 18 (Setup 2, Foundational 11, đóng lượt 1, Polish 4 gồm đóng lượt 2).
- Không benchmark (plan); hai dependency mới đã duyệt; migration `20261101A` tạo bảng và cột (D-207.1, D-207.5).
- Nếu T001 cho thấy `@simplewebauthn/server` 14 đổi tên trường (`credential` vs `authenticator`, `userID` dạng chuỗi):
  cập nhật R1, `cl/contracts/api.md` và T014/T018 trước khi viết T016/T019.
- Nếu T002 cho thấy Chrome nhận RP ID là IP: giữ quyết định tắt với IP (an toàn, R5), chỉ sửa câu chữ R5.
- Nếu replica T026 làm `env-up --profile web` quá chậm trên CI: thay bằng đổi `PUBLIC_URL` của `backoffice-api` chỉ ở
  job `e2e-web` (env riêng), ghi lại R10; không nới origin (clarify câu 1).
