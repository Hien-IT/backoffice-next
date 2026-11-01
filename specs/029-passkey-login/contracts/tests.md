# Contract: Kiểm thử

## Unit (`apps/api`, Vitest)

| File | Kiểm |
|------|------|
| `database/backoffice-migrations/20261101A-create-backoffice-passkeys.test.ts` | version/name/thứ tự danh sách (`['20261026A','20261028A','20261101A']`), cột và null, index unique + index user, không FK, cột `directus_sessions.bo_passkey` nullable không default, chạy lại (bảng và cột), race (`hasTable`/`hasColumn` mock false) — như test 20261028A và 20261026A |
| `auth/passkey/rp.test.ts` | `PUBLIC_URL` `/`, `http://127.0.0.1:8056`, `https://bo.example.com/x/`, `http://localhost:8091` → null/null/`{bo.example.com, https://bo.example.com}`/`{localhost, http://localhost:8091}` |
| `auth/passkey/challenge-store.test.ts` | put/take một lần, hai `take` song song chỉ một nhận giá trị (local và Redis mock `getdel`), hết hạn theo `expires`, giới hạn 10.000 khóa local, purpose/user giữ nguyên |
| `services/passkey.service.test.ts` (mock `@simplewebauthn/server`, knex-mock-client) | thứ tự lỗi (challenge, dòng, user mồ côi, status, provider, verified false, counter lùi); đếm attempt chỉ khi có user; suspend; `finishLogin` gọi với `passkey: true`; đăng ký: 10 passkey, credential id > 255, trùng, name; admin/me quyền; `last_used`/`counter` cập nhật |
| `services/authentication.service.test.ts` (có sẵn) | xanh nguyên sau khi tách `consumeLoginAttempt`/`finishLogin`; thêm case `finishLogin({ passkey: true })` bỏ OTP và `enforce_tfa`, insert `bo_passkey: true`; `refresh` session mode chép `bo_passkey` sang dòng mới, dòng không dấu chép null |
| `permissions/modules/fetch-accountability-policy-globals/*.test.ts` (có sẵn) | policy bắt buộc + `session` có `bo_passkey` true → `enforce_tfa: false`; không `session`, `bo_passkey` null, policy không bắt buộc → như cũ, không truy vấn thêm khi policy không bắt buộc |
| `services/users.service.test.ts` | `deleteMany` xóa `backoffice_passkeys` của keys khi bảng có, bỏ qua khi không |
| `controllers/backoffice-passkeys.controller.test.ts` (supertest, Nest app test) | route table không đè `backoffice/permissions`; 401/403; cookie theo `mode`; `res.locals.cache === false` |

## Unit (`apps/web`)

| File | Kiểm |
|------|------|
| `composables/use-passkey-support.test.ts` | không WebAuthn → false; 404 → false; rp_id khác hostname → false; khớp → true; promise dùng lại |
| `auth.test.ts` | `loginWithPasskey` gọi options → startAuthentication (mock) → login mode session → refresh → hydrate; hủy → `PASSKEY_CANCELLED` |
| `routes/login/LoginForm.test.ts` | nút ẩn/hiện; hủy không lỗi; lỗi API hiện BoNotice; push sau thành công |
| `composables/use-passkeys.test.ts` | list/add/rename/remove/adminRemove gọi đúng endpoint và body; limit 10 |
| `modules/users/components/UserPasskeys.browser.test.ts` | hiện theo provider/isCurrentUser/isAdmin; empty; dialog hai bước; focus về trigger; axe không vi phạm serious |
| `lang/overlay.test.ts` (có sẵn) | key mới có ở cả hai ngôn ngữ, không shadow |

## Parity (`tests/parity`, env chính; `FULL_FILES` đủ, `REDUCED_FILES` phần 404 + một vòng đăng ký/đăng nhập)

| File | Kiểm |
|------|------|
| `auth/webauthn-fake.ts` (mới) | authenticator giả: tạo credential P-256, attestation `none`, assertion ký; dùng cho file dưới |
| `auth/passkey.test.ts` (mới) | (1) mọi route: Directus 404 `ROUTE_NOT_FOUND`; (2) Backoffice: 401 không xác thực, 403 LDAP user, 403 non-admin `:pk`, 400 body sai, 401 mật khẩu sai khi options, static token được nhận như TFA, `/items/backoffice_passkeys` 403, GraphQL không có type, OAS không có `/backoffice/`, origin sai → 400/401; (3) đăng ký → danh sách → đăng nhập `mode: session|json|cookie` → dòng `directus_sessions`, activity `login`, `last_access`, `counter`/`last_used`; (4) TFA bật và role `enforce_tfa`: đăng nhập passkey không OTP, token không `enforce_tfa` (giải mã JWT), `GET /policies/me/globals` và `policies_me_globals` với cookie passkey: Backoffice `false`, Directus `true` (D-207.5 `doc`, kiểm từng app; sửa khi analyze 2026-11-01), sau `POST /auth/refresh` (xoay token) vẫn `false`, cookie của đăng nhập mật khẩu cùng user: `true` ở cả hai; (5) challenge dùng lại, hết hạn (chờ hoặc xóa trong Redis), hai `login` song song cùng challenge → đúng một 200, challenge đăng ký dùng cho đăng nhập → 401, counter lùi → 401 và `auth_login_attempts` giảm; N lần → `suspended`; credential lạ → 401 không đếm, độ trễ ≈ stall; (6) cookie passkey gửi tới Directus: `POST /auth/refresh`, `GET /users/me` 200 (SC-007); (7) đổi tên, xóa, admin xóa, xóa user → 0 dòng; (8) passkey tắt: cặp parity có `PUBLIC_URL` tuyệt đối nên không đo; unit test lo |
| `accepted-differences.ts` | D-207..D-207.5 (`doc`; D-207.5 kiểm từng app trong `auth/passkey.test.ts`, sửa khi analyze 2026-11-01) |
| `normalizers.ts` (+ `.test.ts`) | `BACKOFFICE_TABLE`, regex SDL thêm `passkeys` |
| `deploy/backoffice-migrations.test.ts`, `bootstrap/cross.test.ts` | danh sách migration + bảng `backoffice_passkeys` ở dump |
| `spec-differences` | D-207.x đọc được từ bảng của spec |

## E2E (`apps/web-e2e`, chromium; firefox/webkit skip)

| Spec | Cấu hình | Kiểm |
|------|----------|------|
| `users-passkey.spec.ts` | `proxy-api` (mở `http://localhost:8162`) | CDP virtual authenticator; user mới (fixture) đăng nhập mật khẩu → trang user của mình → card trống → thêm (mật khẩu sai → lỗi; đúng → tên gợi ý → lưu) → dòng hiện → đổi tên → xóa; LDAP user: card ẩn; admin mở trang user khác: chỉ nút xóa; axe trên card và dialog; `expect.poll` API danh sách |
| `login-passkey.spec.ts` | `proxy-api` (`http://localhost:8162`) | sau khi có passkey: đăng xuất → nút hiện → bấm → vào `/content`; user có TFA: không hỏi OTP; role enforce_tfa: không tới `tfa-setup`, cả sau khi tải lại trang và sau khi xóa `localStorage`; đăng xuất rồi đăng nhập mật khẩu: tới `tfa-setup`; hủy (authenticator ảo `automaticPresenceSimulation: false` rồi Esc) → form nguyên |
| cả hai | `proxy-directus`, `cors` | nút login và card không có (`toHaveCount(0)`), không lỗi console, không request lạ |
| `a11y.spec.ts` (có sẵn) | thêm trang user với card | 

Hạ tầng E2E: service `backoffice-api-passkey` + hai `location` trong `tests/parity/proxy/web-api.conf` (research R10);
helper `passkeyWebUrl` và `login(page, user, { baseUrl })`.

## Deploy (`tests/parity/src/deploy`)

Bộ 3 replica + 1 Directus có sẵn: thêm một case đăng ký ở replica A (gọi thẳng) và đăng nhập ở replica B với
authenticator giả (challenge trong Redis dùng chung), cookie dùng được qua lb.

## Không có

Benchmark riêng (SC giữ ngưỡng hiện có); test vendor nightly riêng (migration chạy ở bootstrap/nightly như 022/025).
