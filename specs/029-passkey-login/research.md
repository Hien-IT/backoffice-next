# Research: Đăng nhập bằng Passkey (WebAuthn) cho user local (029)

Đọc code ngày 2026-11-01, chưa chạy thử. Mục ghi [Inference] là suy ra từ code, có task kiểm ở lượt 1; mục
[Unverified] là hành vi thư viện hay trình duyệt chưa thử, thử ở T001/T002 trước khi viết code.

## R1. Thư viện WebAuthn: `@simplewebauthn/server` 14.0.3 và `@simplewebauthn/browser` 14.0.0

**Decision**: thêm hai gói vào `catalog:` của `pnpm-workspace.yaml` (ghim đúng phiên bản, comment "spec 029, MIT,
không có bản tương ứng ở Directus"), `@simplewebauthn/server` cho `apps/api`, `@simplewebauthn/browser` cho `apps/web`.
Kiểu dữ liệu (`RegistrationResponseJSON`, `AuthenticationResponseJSON`, `PublicKeyCredentialCreationOptionsJSON`...)
xuất từ chính gói server/browser từ bản 11 (gói `@simplewebauthn/types` dừng ở 12.0.0, không dùng).

**Rationale**: `npm view` 2026-11-01: server 14.0.3 (`engines.node >= 20`, MIT, `exports` có cả `./esm/index.js` lẫn
`./script/index.js`; phụ thuộc `@peculiar/asn1-*`, `@peculiar/x509`, `@levischuck/tiny-cbor`, `@hexagon/base64`,
`reflect-metadata`, không gói native nên không cần `onlyBuiltDependencies`); browser 14.0.0 (MIT, không phụ thuộc).
`apps/api` là ESM thuần (`"type": "module"`, swc `module.type: es6`, không bundler, `node_modules` chép vào image) nên
một gói ESM/CJS kép nạp bình thường [Inference]. Tự viết xác minh attestation/assertion (CBOR, COSE, chữ ký) là rủi
ro bảo mật không đáng (chủ dự án duyệt 2026-11-01).

**API dùng** [Unverified, tên option theo tài liệu bản 13/14; T001 cài gói và chạy một vòng đăng ký + đăng nhập giả
lập trong Vitest trước khi viết service]:

- `generateRegistrationOptions({ rpName, rpID, userID: Uint8Array, userName, userDisplayName, attestationType: 'none',
  excludeCredentials: [{ id, transports }], authenticatorSelection: { residentKey: 'required', userVerification:
  'required' } })` → options JSON (có `challenge` base64url).
- `verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin, expectedRPID, requireUserVerification:
  true })` → `{ verified, registrationInfo: { credential: { id, publicKey: Uint8Array, counter, transports },
  credentialDeviceType, credentialBackedUp } }`.
- `generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: [] })` (discoverable: không
  gửi danh sách credential).
- `verifyAuthenticationResponse({ response, expectedChallenge, expectedOrigin, expectedRPID, credential: { id,
  publicKey, counter, transports }, requireUserVerification: true })` → `{ verified, authenticationInfo: { newCounter,
  credentialDeviceType, credentialBackedUp } }`.
- Web: `browserSupportsWebAuthn()`, `startRegistration({ optionsJSON })`, `startAuthentication({ optionsJSON })`; hủy
  hộp thoại ném `WebAuthnError`/`DOMException` tên `NotAllowedError`.

**Kết quả T001** (2026-11-01): `pnpm-lock.yaml` thêm `@simplewebauthn/server@14.0.3` và 22 gói phụ thuộc (dựng tay từ
HEAD vì `pnpm install` lật peer `typescript` của `vue` sang 6.0.3, bẫy đã biết; `pnpm install --frozen-lockfile` qua);
`pnpm audit --prod`: không advisory nào qua cây này. Tên trường đúng như trên: `generateRegistrationOptions({ rpName,
rpID, userName, userID: Uint8Array, attestationType, authenticatorSelection, excludeCredentials })`, kết quả đăng ký
`registrationInfo.{ credential: { id, publicKey, counter, transports }, credentialDeviceType, credentialBackedUp }`,
`verifyAuthenticationResponse({ ..., credential })` → `authenticationInfo.newCounter`; `options.user.id` là base64url của
`userID`. Thư viện tự ném khi counter lùi (`newCounter <= counter` với một trong hai > 0), thiếu UV khi
`requireUserVerification`, origin khác `expectedOrigin`. Bài thử nằm ở `tests/parity/src/auth/webauthn-fake.test.ts`
(authenticator giả T020 + thư viện thật, 4 test xanh) thay cho `pk/spike.test.ts` tạm.

**Alternatives considered**: `fido2-lib` (ít bảo trì, API cũ), `passport-fido2-webauthn` (gắn passport, không có
trong app), tự viết (bác vì bảo mật).

## R2. Chỗ cắt `AuthenticationService.login`: hai hàm dùng chung, login mật khẩu không đổi hành vi

**Hiện trạng** (`apps/api/src/services/authentication.service.ts:59-327`): `login(providerName, payload, options)` =
`getUserID` (:100) → đọc user (:108) → filter `auth.login` pending (:116) → `status !== 'active' || provider !==
providerName` → `InvalidCredentialsError` (:131) → limiter `auth_login_attempts` (:143-197: `consume(user.id)`, hết
lượt thì `suspended` + activity + revision, lỗi kho thì 503 "Rate limiter unreachable") → `provider.login` (:199, chỗ
user được xác minh) → OTP (:207-224) → roles, `globalAccess`, `tokenPayload` (:226-238) → `enforce_tfa` khi role bắt
buộc và chưa có `tfa_secret` (:241-256) → `refreshToken = nanoid(64)` (:258), `session` (:262) → filter `auth.jwt`
(:265) → `jwt.sign` với TTL theo `session` (:281-286) → insert `directus_sessions` + dọn hết hạn (:288-297) → activity
LOGIN khi có accountability (:299-309) → `last_access` (:311) → `emitStatus('success')` (:313) → reset limiter (:315)
→ `stall` (:319) → `{ accessToken, refreshToken, expires, id }` (:321). `emitStatus` (:75-96) phát `auth.login` action
với `{ payload, status, user, provider, error }`.

**Decision**: tách hai phần thành phương thức public của `AuthenticationService` (comment `Backoffice (spec 029,
D-207)`, giữ `Ported from`), `login` gọi lại chúng nên hành vi mật khẩu/LDAP/SSO không đổi:

```ts
/** :143-197 nguyên văn. Trả về allowedAttempts để finishLogin reset limiter. */
async consumeLoginAttempt(user: Pick<User, 'id' | 'status'>, ctx: { emitStatus; updatedPayload; timeStart }): Promise<number | null>;

/** :207-326: OTP, roles, token, session, activity, last_access, success, reset, stall. */
async finishLogin(user, updatedPayload, options: {
	providerName: string; session?: boolean; otp?: string; allowedAttempts: number | null; timeStart: number; emitStatus;
	/** Backoffice (spec 029, D-207.3): passkey = hai yếu tố, bỏ OTP và cờ enforce_tfa. */
	passkey?: boolean;
}): Promise<LoginResult>;
```

Trong `finishLogin`, `passkey: true` bỏ hai khối OTP (:207-224) và khối `enforce_tfa` (:241-256), và insert
`directus_sessions` thêm `bo_passkey: true` (R13); mọi dòng khác chạy như cũ. Bỏ cờ `enforce_tfa` trong token **không
đủ** cho D-207.3 (sửa khi checklist 2026-11-01): router của app (`apps/web/src/router/guard.ts:81`, bản DR
`directus/app/src/router.ts:191`) chuyển tới `/tfa-setup` theo `enforce_tfa` của `GET /policies/me/globals`
(`stores/user.ts:75`, DR `stores/user.ts:73`) và `tfa_secret === null` của `/users/me`, không đọc token; `refresh`
(:416-421) cũng không đặt cờ. Cách giải: R13 (phương án E). `emitStatus` được tạo trong `login` và trong `PasskeyService.login` với cùng chữ ký (provider `default`, payload
`{ passkey: true, mode }` theo clarify câu 3; `auth.login` filter pending cũng chạy cho passkey để flow chặn đăng nhập
vẫn chặn được).

**Rationale**: một chỗ sửa trong file port, không chép 120 dòng tạo session; unit test 003 (`authentication.service
.test.ts`) và parity `auth/*` phải xanh nguyên (SC-003). `verifyPassword(userID, password)` (:580-604) dùng lại cho
"nhập lại mật khẩu khi thêm passkey" như `POST /users/me/tfa/generate` (`users.controller.ts:329-366`).

**Alternatives considered**: driver `PasskeyAuthDriver` đăng ký như provider (bác: `user.provider` phải bằng
`providerName` ở :131, `GET /auth` sẽ liệt kê provider mới, D-207 rộng hơn); gọi `login('default', payload)` với
payload đặc biệt và `LocalAuthDriver.login` nhận cờ bỏ kiểm mật khẩu (bác: đụng driver port, dễ mở lỗ hổng bỏ mật
khẩu).

## R3. Endpoint dưới `/backoffice/` và controller

**Decision**: controller mới `apps/api/src/controllers/backoffice-passkeys.controller.ts`, `@Controller('backoffice')`
(Nest cho hai controller cùng tiền tố; `BackofficePermissionsController` là `backoffice/permissions`), đăng ký ở
`app.module.ts` `controllers` và service ở `providers.ts` `serviceProviders` như 025 (`backoffice-permissions.controller.ts:15`,
`app.module.ts:66-67`, `providers.ts:200-205`). Route (chi tiết ở [contracts/api.md](./contracts/api.md)):

| Route | Ai | Việc |
|-------|----|------|
| `GET /backoffice/auth/passkey` | public | `{ data: { rp_id } }` khi passkey bật; 404 `RouteNotFound` khi `PUBLIC_URL` không tuyệt đối hay hostname là IP (R5). Web dùng làm tín hiệu "API là Backoffice và RP ID khớp hostname của trang" |
| `POST /backoffice/auth/passkey/login/options` | public | challenge đăng nhập (discoverable, `allowCredentials: []`) |
| `POST /backoffice/auth/passkey/login` | public | body `{ response, mode? }`; cookie/json như `/auth/login` |
| `GET /backoffice/users/me/passkeys` | session | danh sách của mình |
| `POST /backoffice/users/me/passkeys/options` | session | body `{ password }` → challenge đăng ký |
| `POST /backoffice/users/me/passkeys` | session | body `{ response, name }` → lưu |
| `PATCH /backoffice/users/me/passkeys/:id` | session | `{ name }` |
| `DELETE /backoffice/users/me/passkeys/:id` | session | xóa của mình |
| `GET /backoffice/users/:pk/passkeys` | admin | danh sách của user khác |
| `DELETE /backoffice/users/:pk/passkeys/:id` | admin | xóa của user khác |

Kiểm quyền như TFA: không `accountability.user` → `InvalidCredentialsError` (401); `:pk` không `accountability.admin`
→ `ForbiddenError` (`users.controller.ts:419-437`); user `provider !== 'default'` → `ForbiddenError` ở mọi route
`users/me/passkeys*` (FR-016). Body validate bằng Joi như `local.ts:54-59` (`response` object, `name` string 1–100,
`mode` valid `cookie|json|session`). Mọi response GET đặt `res.locals['cache'] = false` để `respond` không ghi response
cache dùng chung (`middleware/respond.ts:45`; cache middleware áp lên mọi GET, `middleware/cache.ts:19`).

Login: `PasskeyService.login(response, mode)` làm theo thứ tự: tìm challenge trong kho theo `clientDataJSON.challenge`
(R4; không có hay hết hạn → lỗi chung) → giải mã `response.id` → đọc dòng `backoffice_passkeys` + user (`id, status,
role, provider, tfa_secret, email, first_name, last_name`) → không có dòng, user không có (mồ côi), `status !== 'active'`
hay `provider !== 'default'` → `emitStatus('fail')`, `stall`, `InvalidCredentialsError`, **không đếm** (như login local:
`:131` chạy trước limiter `:143`; sửa khi analyze 2026-11-01, H1) → `consumeLoginAttempt(user)` → `verifyAuthenticationResponse` (R1); `verified ===
false` hay ném → fail + stall + `InvalidCredentialsError` → cập nhật `counter`, `last_used` → `finishLogin(user,
payload, { passkey: true, session: mode === 'session', ... })`. Controller viết cookie và payload y hệt `local.ts:88-100`
(cùng `refreshCookieOptions()`, `sessionCookieOptions()` của `constants.ts:115-137`). Thời gian `stall` tính từ đầu
request như login local nên lần sai và credential lạ cùng độ trễ (SC-004).

**Alternatives considered**: đặt dưới `/auth/passkey` (bác: D-189.6 quy ước `/backoffice/` cho endpoint chỉ Backoffice,
và `/auth/login/:provider` của DR trùng dạng đường dẫn).

## R4. Kho challenge: Redis `GETDEL` hoặc `Map` trong process, key là chính challenge

**Hiện trạng**: `Kv` không có TTL theo key (`libs/memory/src/kv/types/class.ts`); `CacheConfigRedis.ttl` có
(`libs/memory/src/cache/types/config.ts:52`), `CacheConfigLocal.maxKeys` có (:21); `apps/api/src/utils/store.ts`
(`useStore`) đã dựng cache Redis-khi-có/local-khi-không nhưng bọc mọi thao tác trong một lock chung.

**Decision**: `apps/api/src/auth/passkey/challenge-store.ts`:

```ts
const TTL = 5 * 60 * 1000;
type Pending = { purpose: 'login' | 'register'; user?: string; expires: number };
const PREFIX = 'backoffice:passkey:';
// Redis khi redisConfigAvailable(): useRedis().set(PREFIX + challenge, JSON, 'PX', TTL) / useRedis().getdel(PREFIX + challenge)
// Không Redis (một instance): Map<string, Pending>, tối đa 10.000 khóa, xóa khóa cũ nhất khi đầy
export async function putChallenge(challenge: string, pending: Omit<Pending, 'expires'>): Promise<void>;
/** Lấy và xóa nguyên tử (một lần, kể cả hai request đồng thời); hết hạn theo `expires` → undefined. */
export async function takeChallenge(challenge: string): Promise<Pending | undefined>;
```

Lấy-và-xóa phải nguyên tử (FR-025, sửa khi checklist 2026-11-01; khối code sửa khi analyze 2026-11-01, M1): `Cache`
của `@backoffice/memory` chỉ có `get` và `delete` riêng, nên `takeChallenge` dùng thẳng `useRedis().getdel('backoffice:passkey:' + challenge)` khi có Redis (giá
trị JSON, `set` bằng `useRedis().set(key, json, 'PX', TTL)`), và một `Map` trong process khi không (đọc rồi `delete`
trong cùng một tick, không `await` ở giữa; giới hạn 10.000 khóa, xóa khóa cũ nhất khi đầy). Hai nhánh nằm trong
`challenge-store.ts`, không qua `createCache`. Người gọi kiểm `purpose` (và `user` với đăng ký) sau khi lấy: sai thì lỗi
chung, challenge đã bị hủy.

Key là chuỗi `challenge` do thư viện sinh (32 byte ngẫu nhiên, base64url) nên không cần id riêng: lúc xác minh server
đọc `challenge` từ `clientDataJSON` của response trước khi gọi thư viện. `expires` nằm trong giá trị để kho local (không
TTL) cũng hết hạn đúng; Redis TTL chỉ là dọn rác. Namespace cố định `backoffice:passkey` (không biến env mới, Nguyên tắc
VIII; không dùng `directus:` vì Directus không đọc). Không Redis = một instance, như `useStore` và rate limiter memory.

**Alternatives considered**: `useStore` (bác: lock chung cho mọi thao tác); kho lock `useLock()` (bác: không TTL,
rác tích lũy); lưu challenge trong DB (bác: thêm bảng/cột và dọn dẹp).

## R5. RP ID và origin từ `PUBLIC_URL` (clarify câu 1)

**Hiện trạng**: `PUBLIC_URL` mặc định `/` (`libs/env/src/constants/defaults.ts:12`); `resolveLoginRedirect`
(`auth/utils/resolve-login-redirect.ts:16-70`) đã ném lỗi khi `PUBLIC_URL` không tuyệt đối (SSO cần tuyệt đối);
`run-startup-checks.ts:61` chỉ cảnh báo.

**Decision**: `apps/api/src/auth/passkey/rp.ts`: `getPasskeyRp(): { rpId, origin } | null` = `new URL(env.PUBLIC_URL)`
khi tuyệt đối, `rpId = url.hostname`, `origin = url.origin`; trả `null` khi không tuyệt đối hoặc hostname là địa chỉ IP
(WebAuthn không nhận IP làm RP ID [Unverified, kiểm ở T002 trên Chrome]); `localhost` hợp lệ. `null` → mọi route passkey
trả 404 `RouteNotFound` và một dòng log `warn` lúc khởi động ("passkey login disabled: PUBLIC_URL must be an absolute
URL with a host name"). `expectedOrigin = origin` duy nhất; `rpName = settings.project_name || 'Backoffice'` như
`TFAService.generateTFA` (`tfa.service.ts:33-64`). Tài liệu `deploy/README.md` thêm mục "Passkey (spec 029)" sau mục
"Chạy cạnh Directus: hai domain" (:199) và một câu ở mục standalone (:333): `PUBLIC_URL` phải là domain thật có HTTPS,
đổi domain là đăng ký lại; Helm không cần giá trị mới (`values.yaml:82-85` chỉ có `domain.publicUrl`).

**Alternatives considered**: Origin trong `CORS_ORIGIN` (chủ dự án bác, clarify câu 1); biến `BACKOFFICE_PASSKEY_RP_ID`
(bác: không cần, Nguyên tắc VIII).

**Kết quả T002** (2026-11-01, Playwright chromium của `apps/web-e2e`): trang `http://localhost:<port>` với `rp.id =
'localhost'` tạo và dùng được credential discoverable (`userHandle` có); `http://127.0.0.1:<port>` với `rp.id =
'127.0.0.1'` → `SecurityError: This is an invalid domain.` Giữ quyết định tắt passkey khi hostname là IP.

## R6. Bảng `backoffice_passkeys`, migration `20261101A`, collection hệ thống ẩn

**Decision** (chi tiết cột ở [data-model.md](./data-model.md)): migration
`apps/api/src/database/backoffice-migrations/20261101A-create-backoffice-passkeys.ts` theo mẫu `20261028A` (`hasTable`
→ `createTable` trong try/catch cho race không khóa, không FK), thêm vào `BACKOFFICE_MIGRATIONS` (`index.ts:16`) và ba
chỗ ghim danh sách: `20261028A-...test.ts` (`['20261026A','20261028A']`), `tests/parity/src/deploy/backoffice-migrations
.test.ts:30`, `tests/parity/src/bootstrap/cross.test.ts:250-265`. `collections.yaml` thêm `backoffice_passkeys` `hidden:
true` (sau :134); `isSystemCollection` nhận tiền tố `backoffice_` sẵn (`libs/system-data/src/collections/index.ts:19`) nên
`/items/backoffice_passkeys` 403 (`items.controller.ts:41`); GraphQL `SYSTEM_DENY_LIST` thêm tên (`services/graphql/
schema/index.ts:42-54`); parity `normalizers.ts` `BACKOFFICE_TABLE` (:117) và hai regex SDL (:284, :287) thêm `passkeys`;
`bootstrap/dump.ts:37` đã lọc theo tiền tố `directus_` nên dump không cần sửa (kiểm bằng test có sẵn).

Đọc ghi: Knex trực tiếp trong `PasskeyService` (không `ItemsService`): bảng không có `directus_fields`, không quyền
theo policy, không activity/revision (như `directus_sessions`); ít code hơn `BackofficePermissionsService` (cần
accountability admin giả). Id sinh bằng `randomUUID()` (v4, collection hệ thống, 027). Xóa theo user: trong
`UsersService.deleteMany` (`users.service.ts:318-338`) ngay sau `clearUserSessions(keys)`, có `hasTable` như
`policies.service.ts:100-111` (D-207.2). `updateMany` đổi `provider` không đụng passkey (Edge Cases: dòng giữ, không dùng
được).

**Alternatives considered**: `ItemsService` với accountability admin như 025 (bác: không cần quyền theo policy, không
cần cache clear); FK tới `directus_users` (bác: Nguyên tắc II, DR xóa user không biết bảng).

## R7. Web: tín hiệu "passkey dùng được", `auth.ts`, nút login

**Hiện trạng**: không có cờ "API là Directus" (025 suy từ `/permissions/me` có `import`,
`stores/permissions.ts:39-45`; `use-duplicate.ts:68-79` dò 404). `auth.ts:34-82` `login()` có nhánh `identifier` gửi
`RestCommand` tự tạo rồi `sdk.refresh()`; `LoginForm.vue:67-107` chuyển hướng `redirectQuery || last_page || '/content'`,
map lỗi `INVALID_PAYLOAD` → `INVALID_CREDENTIALS`.

**Decision**:

- `apps/web/src/composables/use-passkey-support.ts`: một promise theo module (gọi một lần mỗi phiên app, làm lại khi
  đổi `apiUrl`): `browserSupportsWebAuthn()` && `GET /backoffice/auth/passkey` (qua `apiFetch`, 404/lỗi → `false`) &&
  `rp_id === window.location.hostname` → `passkeyAvailable: Ref<boolean>`. Dùng ở nút login và card.
- `auth.ts` thêm `loginWithPasskey(): Promise<void>`: `POST .../login/options` → `startAuthentication({ optionsJSON })`
  → `POST .../login` body `{ response, mode: 'session' }` (RestCommand như nhánh `identifier`) → `sdk.refresh()` → cùng
  khối sau thành công (:76-82). Hủy (`NotAllowedError`) ném lỗi có `code: 'PASSKEY_CANCELLED'` để form bỏ qua.
- Màn hình bắt cài TFA (D-207.3, FR-004): **không sửa web**. `GET /policies/me/globals` trả `enforce_tfa: false` cho
  phiên passkey (R13), nên `router/guard.ts:81` và `TfaSetupRoute.vue:83` giữ nguyên. (Phương án dấu `localStorage` ghi
  khi checklist 2026-11-01 bị chủ dự án bác cùng ngày: user tự đặt dấu được.)
- `LoginForm.vue`: dưới nút Sign In một `BoButton variant="secondary" full-width icon="passkey"` `v-if="passkeyAvailable"`
  (chuỗi `passkey_sign_in`), `loading` riêng; lỗi API hiện qua `BoNotice` như sai mật khẩu (API trả `INVALID_CREDENTIALS`
  nên không cần chuỗi mới); hủy → không gì. Nút nằm ngoài `<form>` để Enter vẫn gửi form mật khẩu.
- Gọi API mới thêm vào `apps/web-e2e/src/helpers/allowed-paths.ts` và `KNOWN_REQUESTS` (`test-utils/fetch.ts:110`);
  `API_PATHS` của `vite.config.ts:8-9` chưa có `backoffice` → thêm (025 chạy dev qua `apiUrl` tuyệt đối nên chưa lộ).

**Alternatives considered**: trường mới trong `/server/info` (bác: khác Directus ở endpoint có sẵn, phải thêm D và
normalizer); dựa vào `hasBackofficeActions` (bác: chỉ có sau khi đăng nhập).

## R8. Web: card "Passkeys" trên trang user

**Hiện trạng**: `UserItemRoute.vue:369-438` là cột `flex flex-col gap-8` với hộp user rồi `<BoForm card>`; không có khối
ngoài form; `layout-patterns.md:376-378`: card chỉ chứa BoForm, khối khác đứng ngoài. D-182 là divider tổng hợp trong
`formFields` (`FieldsRoute.vue:98-132`) nên không hợp với một danh sách. Mẫu hộp thoại mật khẩu: `SystemMfaSetup.vue:244-301`
(BoDialog, form id `${formId}-password`, nút submit ngoài form qua `:form`, `BoNotice` lỗi); nhánh admin :304-337
(`admin_disable_tfa_text`, nút `danger`). Thành phần: không có `BoCard`/`BoEmpty`; Card là recipe class
(`component-specs.md:290-299`), bảng Tier 1 `BoTable` với slot `item-append` cho hành động dòng (:854-895), `BoInfo` cho
trạng thái trống, `BoDialog` footer outline + primary/danger (:242-258).

**Decision**: `apps/web/src/modules/users/components/UserPasskeys.vue` (+ `use-passkeys.ts`), đặt ngay sau `<BoForm>`
ở `UserItemRoute.vue:437` trong cùng cột (cùng `formColumn`), `v-if="!isNew && passkeyAvailable && item.provider ===
'default' && (isCurrentUser || userStore.isAdmin)"`:

- Khung: recipe Card (`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]`), header
  `BoIcon name="passkey"` + `h3` "Passkeys" + mô tả, body `border-t`.
- Danh sách: `BoTable` cột `name`, `date_created`, `last_used` (display datetime relative như Directus), `item-append` =
  BoMenu (`passkey_rename`, `passkey_delete` danger) cho user của mình, chỉ nút xóa (icon, `aria-label`) cho admin xem
  người khác; `caption` sr-only; trống → slot `empty` với icon, tiêu đề `passkey_none`, mô tả `passkey_none_hint`.
- Nút "Thêm passkey" (`passkey_add`) ở header, chỉ của mình, `disabled` khi `rows.length >= 10` với `title`/mô tả
  `passkey_limit`.
- Hộp thoại thêm (một `BoDialog`, hai bước như Q-19): bước mật khẩu (`BoInput type=password autocomplete=current-password`,
  nút `next`) → `POST .../options` → `startRegistration` → bước tên (`BoInput` với tên gợi ý `passkey_default_name`
  theo `navigator.userAgentData?.platform || navigator.platform`, nút `save`) → `POST .../passkeys`. Hủy ở trình duyệt
  → đóng hộp thoại, không lỗi. Lỗi API → `BoNotice` `translateAPIError`.
- Đổi tên: `BoDialog` một ô tên. Xóa: `BoDialog` xác nhận thứ tự D-76 (Cancel trước, Delete `danger`); admin thấy câu
  `passkey_admin_delete_text`.
- Chuỗi mới (flat, overlay en-US + vi-VN, prefix `passkey_`): `passkey_sign_in`, `passkeys`, `passkeys_description`,
  `passkey_add`, `passkey_name`, `passkey_default_name`, `passkey_rename`, `passkey_delete`, `passkey_delete_confirm`,
  `passkey_admin_delete_text`, `passkey_none`, `passkey_none_hint`, `passkey_limit`, `passkey_never_used`,
  `passkey_last_used`, `passkey_created`, `passkey_enter_password`. Không mã lỗi mới (overlay là spread nông, không
  nhận `errors.*`): API dùng `INVALID_CREDENTIALS`, `INVALID_PAYLOAD`, `FORBIDDEN` có sẵn.
- Card là `div` thường (không landmark) như card form D-150; `h3` để trình đọc màn hình nhảy tới.

**Nguyên tắc XII**: card, bảng, menu, dialog, empty đều ghép từ recipe có sẵn; không component mới ngoài
`UserPasskeys.vue`. Điểm cần design owner gật ở analyze: icon `passkey` của Material Symbols và cách hiện "lần dùng cuối"
(relative time) — ghi ở "Cần xác nhận" của spec.

## R9. Parity: D-207 là `doc`, test từng app bằng `appRequest`, authenticator giả trong Node

**Hiện trạng**: route chỉ Backoffice của 025 là entry `kind: 'doc'` (D-189.6, `accepted-differences.ts:494-499`) và test
gọi từng app bằng `appRequest('backoffice', ...)` rồi `at('directus', ...)` mong 404
(`permissions/backoffice-permissions.test.ts:7, :165`). `parity()` so hai app một lúc chỉ hợp với endpoint có ở cả hai.
Bộ test suite liệt kê file ở `suite.ts` `REDUCED_FILES`/`FULL_FILES`.

**Decision**: `tests/parity/src/auth/passkey.test.ts` (vào `FULL_FILES`, và `REDUCED_FILES` phần 404 + luồng ngắn):

1. Mỗi route mới: Directus 404 `ROUTE_NOT_FOUND`; Backoffice 401/403/400 theo contract (không session, provider LDAP,
   admin giả, body sai).
2. Đăng ký và đăng nhập thật với **authenticator giả trong Node** `tests/parity/src/auth/webauthn-fake.ts`: khóa EC
   P-256 bằng `node:crypto` (`generateKeyPairSync('ec', { namedCurve: 'prime256v1' })`), `attestationObject` CBOR
   `{ fmt: 'none', attStmt: {}, authData }` và khóa COSE (map `1:2, 3:-7, -1:1, -2:x, -3:y`) mã hóa bằng một encoder
   CBOR tối thiểu viết tay (~40 dòng: map, text, bytes, int âm/dương), `authData = sha256(rpId) || flags(UP|UV|AT) ||
   counter || aaguid(16×0) || credIdLen || credId || coseKey`; assertion ký `authData || sha256(clientDataJSON)` bằng
   ECDSA SHA-256 (DER, như thư viện mong). Qua đó kiểm: session cookie trả về, `directus_sessions` có dòng, activity
   `login`, `last_access`, `counter`/`last_used` tăng, challenge dùng lại → lỗi chung, counter lùi → lỗi chung và
   `auth_login_attempts` giảm, user `suspended` sau N lần, LDAP user 403, admin xóa, xóa user xóa passkey.
3. Session dùng chéo: cookie từ đăng nhập passkey ở Backoffice gửi `POST /auth/refresh` và `GET /users/me` tới
   **Directus** (`capture(directusUrl, ...)` với header Cookie) → 200 (SC-007, FR-030).
4. `accepted-differences.ts`: D-207 (`doc`, route chỉ Backoffice), D-207.1 (`doc`, normalizer có sẵn), D-207.2 (`doc`),
   D-207.3 (`doc`), D-207.4 (`doc`, giao diện). Spec sửa câu chữ FR-030 và bảng D-207: `doc` thay vì `http` (ghi ở
   "Sửa câu chữ khi /speckit.plan").

`apps/api` unit test không dùng authenticator giả: `vi.mock('@simplewebauthn/server')` cho `verify*` và kiểm luồng
(thứ tự lỗi, limiter, kho challenge một lần, `finishLogin` với `passkey: true` không hỏi OTP và không set `enforce_tfa`,
`login` mật khẩu không đổi: snapshot số lần gọi knex/emitter so với test 003 hiện có).

**Alternatives considered**: chỉ test qua E2E chromium (bác: Nguyên tắc V, parity phải có cho endpoint mới); dùng
`@simplewebauthn/server` để tạo response giả (không có API đó).

## R10. E2E: authenticator ảo CDP chỉ chromium, replica Backoffice riêng cho đường passkey ở profile `web`

**Hiện trạng**: `playwright.config.ts:30-44`: project `chromium|firefox|webkit` × `768|1280`; `cors` chỉ chromium-1280;
skip theo trình duyệt `test.skip(browserName !== 'chromium', ...)` (`perf.spec.ts:11`), `context.newCDPSession(page)`
(:13). URL: `proxy-directus` `http://127.0.0.1:8161`, `proxy-api` `http://127.0.0.1:8162`, `cors` `http://localhost:8181`
→ API `127.0.0.1:8163` (`helpers/config.ts:8-13`). Cặp chính: cả Directus lẫn Backoffice có `PUBLIC_URL=http://localhost:8155`
(`tests/parity/env/postgres.env:3`, dùng chung cho parity), nên RP ID của Backoffice là `localhost`, origin
`http://localhost:8155`; trang ở `127.0.0.1:8162` → hostname khác → nút ẩn; trang ở `http://localhost:8162` → RP ID khớp
nhưng origin khác cổng → xác minh 401. **Không cấu hình E2E hiện có chạy được lễ passkey thật.**

**Decision**:

- Profile `web` của `tests/parity/docker-compose.yml` thêm service `backoffice-api-passkey` (cùng image, cùng env file
  và DB/Redis với `backoffice-api`, chỉ khác `PUBLIC_URL: http://localhost:8162`); `proxy/web-api.conf` thêm
  `location ^~ /backoffice/auth/passkey` và `location ~ ^/backoffice/users/[^/]+/passkeys` trỏ tới replica đó, phần còn
  lại giữ `backoffice-api`. Đây cũng là bài kiểm tra nhiều instance thật: challenge và session do replica passkey tạo,
  request sau đó do replica chính phục vụ (cùng Redis, cùng `SECRET`).
- Spec E2E `login-passkey.spec.ts` và `users-passkey.spec.ts` (`@core` không gắn): `test.skip(browserName !==
  'chromium')`; ở `proxy-api` mở trang bằng URL tuyệt đối `http://localhost:8162/admin/...` (helper mới
  `passkeyWebUrl` trong `helpers/config.ts`; `login()` helper nhận `baseUrl`), CDP `WebAuthn.enable`,
  `WebAuthn.addVirtualAuthenticator({ options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
  hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })`
  [Unverified: tên option theo tài liệu CDP, T002 thử]; luồng US2 (thêm với mật khẩu, đổi tên, xóa), US1 (đăng xuất,
  đăng nhập bằng nút, vào `/content`, TFA bật không hỏi OTP), US3 (admin xóa của user khác), a11y axe trên card và dialog.
- Ở `proxy-directus` (API là Directus → 404) và `cors` (hostname `localhost` ≠ RP ID... thực tế `PUBLIC_URL`
  `127.0.0.1:8163` là IP → API trả 404) các spec chỉ kiểm nút và card ẩn.
- Cookie: `SESSION_COOKIE_SAME_SITE` mặc định `strict`, trang và API cùng origin qua proxy nên không đổi.

**Kết quả T002**: `WebAuthn.enable` + `WebAuthn.addVirtualAuthenticator({ options: { protocol: 'ctap2', transport:
'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })`
chạy đúng tên option; `WebAuthn.getCredentials` trả credential đã tạo.

**Alternatives considered**: đổi `PUBLIC_URL` của `backoffice-api` chính sang `http://localhost:8162` (bác: dùng chung env
với Directus cho parity, lệch `/server/specs/oas` và redirect); E2E chỉ ở `dev` (bác: không có trong CI); nới origin
theo cổng (bác: clarify câu 1).

## R13. Phiên passkey nhớ ở server: cột `bo_passkey` trên `directus_sessions` (phương án E, chủ dự án chọn 2026-11-01)

**Hiện trạng**: `fetchAccountabilityPolicyGlobals(accountability, ctx)` (`apps/api/src/permissions/modules/
fetch-accountability-policy-globals/fetch-accountability-policy-globals.ts:6`) trả `enforce_tfa: !!result` từ một truy vấn
`directus_policies.enforce_tfa` theo policy của accountability; hai chỗ gọi: `GET /policies/me/globals`
(`controllers/policies.controller.ts:104`) và GraphQL `policies_me_globals` (`services/graphql/resolvers/system.ts:396`).
Với token kiểu session (app web chỉ dùng chế độ này), `accountability.session` = `directus_sessions.token`
(`utils/get-accountability-for-token.ts:28-30`), và `verifySessionJWT` đã đọc dòng đó mỗi request. `refresh` ở chế độ
session tạo **dòng mới** khi xoay token (`updateStatefulSession`, `authentication.service.ts:535-543`, insert `token, user,
share, expires, ip, user_agent, origin`); `select` của `refresh` liệt kê cột rõ (:339-345). `directus_sessions` không có
cột trống dùng được (`token, user, expires, ip, user_agent, origin, share, next_token`). Hiến pháp II cho phép migration
riêng thêm cột `bo_*` vào bảng `directus_*` (022: ba cột trên `directus_collections`, mẫu `20261026A`: `hasColumn` →
`alterTable` trong try/catch).

**Decision**:

1. Migration `20261101A` (cùng file với bảng `backoffice_passkeys`) thêm `directus_sessions.bo_passkey` boolean nullable,
   không default, một dòng `directus_fields` ẩn và chỉ đọc (sửa 2026-11-01: Data Model hiện "Database Only" khi không có). Null = không phải passkey (dòng Directus tạo).
2. `finishLogin({ passkey: true })` insert `bo_passkey: true`; `refresh` `select` thêm `session_bo_passkey: 's.bo_passkey'`
   và `updateStatefulSession` insert thêm `bo_passkey: sessionRecord['session_bo_passkey'] ?? null` (dòng mới giữ dấu);
   nhánh cập nhật tại chỗ (:429-433, chế độ không session) không đổi vì dòng giữ nguyên.
3. `fetchAccountabilityPolicyGlobals`: `Pick` thêm `'session'`; sau khi tính `result`, nếu `result` và
   `accountability.session` thì `knex('directus_sessions').select('bo_passkey').where({ token: session }).first()`; `true`
   → `enforce_tfa: false`. Chỉ thêm một truy vấn ở trường hợp policy bắt buộc TFA (hiếm, một lần mỗi hydrate). Comment
   `Backoffice (spec 029, D-207.5)`, giữ `Ported from`.
4. Không đổi gì ở web; `auth.ts` không ghi dấu nào.
5. Response cache dùng chung (`middleware/cache.ts`, khóa `getCacheKey` theo user, path, query; không theo phiên): phiên
   passkey ghi `false` thì phiên mật khẩu cùng user đọc lại `false` (E2E lượt 2 bắt được). Middleware
   `passkeySessionCacheGuard` (trước `checkCacheMiddleware`): khi token là token phiên và path là
   `/policies/me/globals` hay document `/graphql/system` có `policies_me_globals`, tra `bo_passkey` của dòng phiên;
   `true` → `skipCacheRead` và `cache = false`. Phiên mật khẩu, token JSON, static token giữ cache như DR.

**Vì sao không có lỗ hổng**: dòng `bo_passkey = true` chỉ do `finishLogin({ passkey: true })` tạo, tức sau khi assertion
được xác minh; user có mật khẩu không tạo được. Token `json`/`cookie` không có `session` → như Directus. Hook `authenticate`
của extension bỏ `session` → như Directus (an toàn). Directus không đọc cột → Directus app vẫn bắt cài TFA (điểm 3 duyệt).

**Parity**: D-207.5 là entry `doc` (sửa khi analyze 2026-11-01, H3: `AcceptedDifference.when` chỉ có `directusStatus`,
`directusCode`, `backofficeCode`, `accepted-differences.ts:16`, `parity.ts:340-342`; một entry `http` chỉ theo jsonPointer
sẽ chấp nhận khác biệt `enforce_tfa` của mọi phiên). `auth/passkey.test.ts` gửi cookie phiên passkey tới từng app bằng
`appRequest`/`capture` và kiểm Backoffice `false`, Directus `true`; `parity()` của `GET /policies/me/globals` với phiên
mật khẩu giữ so sánh chặt (test có sẵn `auth/*` xanh nguyên). `GET /fields/directus_sessions` của hai app giống nhau (cùng đọc cột từ DB, như `bo_show_*` của
022); snapshot bỏ bảng hệ thống (`get-snapshot.ts:29`); dump `bootstrap` bỏ cột `bo_*` (`dump.ts`, D-180).

**Alternatives considered**: dấu trong Redis theo token (mất khi xóa cache hay restart không persistence, phải chép khi
xoay token ở hai chỗ); claim JWT (`refresh` dựng lại payload từ dòng phiên nên vẫn cần cột hay Redis); "có passkey là đạt
TFA" (làm yếu đăng nhập mật khẩu); dấu `localStorage` (user tự đặt được, chủ dự án bác); bắt cài TFA một lần (bỏ phần
D-207.3, chủ dự án không chọn).

## R11. Rủi ro và điểm kiểm sớm

| # | Rủi ro | Kiểm ở |
|---|--------|--------|
| 1 | Tên option/kết quả của `@simplewebauthn/server` 14 khác ghi ở R1 | T001: cài, chạy vòng đăng ký + đăng nhập với authenticator giả (R9) trong Vitest `apps/api` |
| 2 | Chrome từ chối RP ID là IP hoặc option CDP khác tên | T002: thử `WebAuthn.addVirtualAuthenticator` ở `dev` trước khi viết spec |
| 3 | `nanoid`/`randomUUID` và `Uint8Array` `userID` trong Node 22 ESM | T001 |
| 3b | Hai request cùng challenge (hai replica) cùng qua | `GETDEL` Redis (R4); parity gửi song song hai `login` cùng challenge, đúng một 200 |
| 3c | `bo_passkey` mất khi xoay token hoặc `select` của `refresh` thiếu cột | Unit `authentication.service`: refresh session mode giữ `bo_passkey`; parity: tải lại trang sau làm mới vẫn `enforce_tfa: false` |
| 4 | Cache response dùng chung ghi GET passkey | `res.locals['cache'] = false` ở mọi GET mới; unit test kiểm `respond` không gọi `setCacheValue` |
| 5 | Không Redis ở nhiều replica → challenge lạc replica | Ghi ở README (như rate limiter memory); deploy suite 3 replica chạy với Redis |
| 6 | Hai controller cùng tiền tố `backoffice` ở Nest | T003: test e2e Nest `supertest` route table |
| 7 | Replica passkey trong profile `web` làm CI `e2e-web` nặng hơn | Một container thêm, cùng image; đo thời gian job ở lượt 2 |
| 8 | `pnpm audit` với cây `@peculiar/*` | Chạy `pnpm audit` ở T001; nếu có GHSA, ghi `auditConfig.ignoreGhsas` với lý do như tinymce |

## R12. Hai lượt

- **Lượt 1 (API)**: catalog + gói, migration `20261101A` (bảng + cột `bo_passkey`) + test + ba danh sách,
  `fetchAccountabilityPolicyGlobals` + `refresh` giữ dấu (R13), `collections.yaml`, GraphQL deny list,
  normalizer regex, `rp.ts`, `challenge-store.ts`, `PasskeyService`, controller, tách `consumeLoginAttempt`/`finishLogin`,
  `UsersService.deleteMany`, unit test, `webauthn-fake.ts` + `auth/passkey.test.ts`, `accepted-differences` D-207..D-207.4,
  `supported-variables` (không đổi: `PUBLIC_URL` đã nhóm A), `deploy/README.md`, compose profile `web` (service + proxy
  conf, để lượt 2 chạy được ngay), allowed-paths (chuẩn bị). Commit khi lint, unit API, parity `auth/*` + `passkey` xanh.
- **Lượt 2 (Web)**: catalog + gói browser, `use-passkey-support.ts`, `auth.ts`, `LoginForm.vue`, `use-passkeys.ts`,
  `UserPasskeys.vue`, `UserItemRoute.vue`, overlay en-US/vi-VN, `KNOWN_REQUESTS`, `API_PATHS`, `optimizeDeps`, unit +
  browser test (a11y), E2E hai spec ba cấu hình, `design-system/docs/component-specs.md` recipe "Q-xx Passkeys" (card,
  bảng, dialog), spec 012/015 ghi "(029: ...)", đóng spec (Status, duyệt D-207..D-207.4), CLAUDE.md, SPECKIT-GUIDE.md.
