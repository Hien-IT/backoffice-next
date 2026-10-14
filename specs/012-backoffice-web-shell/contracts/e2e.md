# Contract: kiểm thử (unit, E2E, CI)

## 1. Unit (Vitest + Vue Test Utils + happy-dom, `apps/web/src/**/*.test.ts`)

| File test | Phủ | FR |
|-----------|-----|----|
| `router/guard.test.ts` | mọi nhánh `onBeforeEach` (first load, setup, public, chưa auth → redirect, hydrate, tfa ép 2 cách, tfa đã có), `onAfterEach` trackPage 500 ms | FR-013, FR-017, FR-018, FR-019 |
| `auth.test.ts` | login local/ldap/share, refresh (còn hạn, hết hạn, lỗi → SESSION_EXPIRED), logout 2 lý do, idle | FR-011, FR-014, FR-015 |
| `api/sdk.test.ts` | fetch bọc: queue pause ở `/auth/refresh`, requestsStore, không xử lý riêng `401` | FR-001 |
| `stores/user.test.ts` | `language` 3 nấc, `textDirection`, `trackPage`, share user | FR-061 |
| `stores/server.test.ts` | `providerOptions` (disableDefault, lọc SSO) | FR-040 |
| `stores/settings.test.ts`, `permissions.test.ts` | hydrate, dehydrate | FR-016 |
| `modules/index.test.ts` | `preRegisterCheck` 6 module × admin/partial/none; đăng ký/gỡ route | FR-022 |
| `layout/module-bar.test.ts` | `module_bar` null → mặc định; thứ tự, `enabled`, link nội bộ/ngoài; Settings cuối | FR-021 |
| `theme/use-theme-configuration.test.ts` | appearance 3 nguồn + prefers-color-scheme; merge overrides user lên settings | FR-063 |
| `theme/override-map.test.ts` | ánh xạ khóa, bỏ khóa lạ, bỏ `var(--theme--*)`, warn một lần | FR-063, D-43 |
| `lang/set-language.test.ts` | nạp JSON động, fallback en-US, `html[lang]`, `/translations` merge | FR-061, FR-062 |
| `scripts/sync-translations.test.ts` | chạy lại script = file commit; không "Directus" ngoài danh sách giữ; overlay gộp | FR-062, FR-080 |
| `head/use-app-head.test.ts` | title template, favicon 3 nấc, theme-color, project-color | FR-029 đến FR-032 |
| `components/*.test.ts` | BoInput label/for, error aria-describedby; BoButton loading/disabled; BoNotice icon+text; BoSelect keyboard | FR-065 |
| `routes/login.test.ts` | provider select hiện khi > 1; form theo driver; INVALID_OTP hiện OTP; SSO links URL; `?continue`, `?error&code`, `?reason=INVALID_OTP` | FR-010, FR-012, FR-041, FR-042 |
| `routes/reset-password.test.ts`, `accept-invite.test.ts` | hai nhánh, dòng liên hệ admin, email từ JWT | FR-050 đến FR-052 |
| `routes/profile.test.ts` | diff field, PATCH chỉ field đổi, lỗi theo field | FR-060 |
| `utils/generate-favicon.test.ts`, `jwt-payload.test.ts`, `get-asset-url.test.ts` | | |

Coverage `apps/web` ≥ 60% (ngưỡng đã có ở `vitest.config.ts`).

## 2. E2E (`apps/web-e2e`, Playwright 1.64)

### Cấu hình (biến `E2E_CONFIG`)

| `E2E_CONFIG` | `BASE_URL` | API | Trình duyệt | Ghi chú |
|--------------|-----------|-----|-------------|---------|
| `proxy-directus` | `http://127.0.0.1:8161` | Directus 11.17.4 (cùng origin qua proxy) | chromium, firefox, webkit × 768, 1280 | |
| `proxy-api` | `http://127.0.0.1:8162` | API mới (cùng origin qua proxy) | như trên | |
| `cors` | `http://localhost:8181` | API mới `http://127.0.0.1:8163` (khác site, CORS, `SameSite=None`) | chromium × 1280 | R3 |
| (dev) | `http://127.0.0.1:4200` | dev server Vite proxy `/` → `PUBLIC_URL` | chromium | không CI |

Biến thể `apiUrl` khác (cặp `sso` 8955/8956, cặp `setup`): `page.route('**/admin/config.json', ...)` trả `apiUrl`
khác trong cùng web container (R13); các cặp đó có `CORS_*` và `SESSION_COOKIE_*` trong env profile.

### Kịch bản (`apps/web-e2e/src/*.spec.ts`)

| File | Kịch bản | Spec |
|------|----------|------|
| `login.spec.ts` | local đúng/sai, TFA (user có `tfa_secret` tạo qua API, OTP tính bằng `otplib` trong test), suspended, không app_access, `?redirect=` nội bộ/ngoài, tải lại giữ phiên, hết hạn (xóa dòng `directus_sessions` → tải lại → login với reason), đăng xuất (dòng session mất) | US1 |
| `navigation.spec.ts` | admin: thanh module mặc định, 6 URL, tiêu đề tab; `module_bar` tùy chỉnh (PATCH `/settings` rồi khôi phục); user chỉ `directus_files`: thiếu Users/Insights/Settings, `/users` → 404 private, `/activity` mở; gập nav/sidebar giữ sau reload; `last_page` ghi và dùng lại; 404; API chết (`page.route` abort `/server/info`) → màn lỗi | US2 |
| `branding.spec.ts` | settings mặc định: không "Directus" trong `document.body.innerText` và `title` ở login, content, profile; settings đầy đủ (PATCH `/settings` với logo upload, color, note, background, custom_css, favicon): logo, màu nền logo, `theme-color`, favicon href, note, css; ảnh chụp so với Directus app (`tests/directus-app-e2e` chạy cùng settings) chỉ lưu artifact, không chặn | US3 |
| `sso.spec.ts` | provider select có LDAP; LDAP login (user từ fixture OpenLDAP của 003); OIDC qua IdP giả (trang IdP tự động chấp thuận) về `?continue`; OAuth2 `oauthmock`; `?error&code=` hiện lỗi; INVALID_OTP sau SSO (user OIDC có tfa) | US4 |
| `password-invite.spec.ts` | quên mật khẩu (notice + dòng liên hệ admin), đặt lại với token ký bằng `SECRET` (helper), nhận lời mời (user `invited` tạo qua `POST /users/invite`, token ký lại), setup trên cặp `setup` (DB rỗng), share login (share tạo qua API) | US5 |
| `profile.spec.ts` | đổi tên, email trùng → lỗi, mật khẩu (đăng nhập lại bằng mật khẩu mới), language vi-VN áp ngay + sau reload, appearance dark/light/auto (emulate `prefers-color-scheme`), overrides JSON đổi `--eh-color-action-primary` | US6 |
| `requests.spec.ts` | mọi spec dùng fixture ghi request; sau mỗi test so với `contracts/api-calls.md` (path pattern); không request ngoài danh sách | FR-002, SC-001 |
| `a11y.spec.ts` | axe-core WCAG 2.1 AA trên 7 màn × sáng/tối; ngoại lệ chỉ cho cặp token Q-8; ca đi hết luồng bằng bàn phím | FR-067 |
| `perf.spec.ts` | chromium: CDP throttling 10 Mbps, cache lạnh → login visible < 3 s; không cuộn ngang ở 768 và 1280 | SC-008 |

Mỗi spec dọn dữ liệu đã tạo (user, share, settings) bằng API admin và `db-rows` helper của
`tests/directus-app-e2e` (chuyển sang `tests/e2e-helpers`? Không: copy hai file helper vào `apps/web-e2e/src/helpers`
để tránh phụ thuộc chéo project).

## 3. Môi trường đối chiếu (`tests/parity`)

- Compose: dịch vụ `backoffice-web`, `backoffice-web-cors`, `backoffice-api-web-cors`, `proxy-web-directus`,
  `proxy-web-api` (profile `web`), file `proxy/web-directus.conf`, `proxy/web-api.conf` (tĩnh),
  `env/profile-web-cors.env`; `profile-sso.env`, cặp `setup` thêm `CORS_*`, `SESSION_COOKIE_*`.
- `scripts/env.mjs`: `web` vào `ALL_PROFILES`; build image web khi `--profiles` có `web`.
- README: bảng profile thêm `web` (8161, 8162, 8163, 8180, 8181).

## 4. CI (`.github/workflows/ci.yml`)

- `quality`: đã chạy lint, typecheck, test (coverage 60%), build của `web`; thêm bước `pnpm nx run web:lint`
  bắt rule `no-raw-color` (nếu Nx lint của web đã gồm thì không thêm).
- `e2e-web` (thay `e2e`): `needs: docker`; `env-up --vendor=postgres --profiles=app,setup,sso,web` (image web từ
  artifact `images`, tag lại `hiennd23/backoffice-web:local`); `playwright install --with-deps chromium firefox
  webkit`; chạy `web-e2e:e2e` ba lần với `E2E_CONFIG=proxy-directus|proxy-api|cors`; upload `test-results` và log
  container khi lỗi; `env-down`.
- `publish` `needs` thêm `e2e-web`.
- Thời gian: hai lượt × 6 project + một lượt chromium; mục tiêu < 25 phút. Nếu quá, chia job theo cấu hình (matrix), không bỏ trình duyệt (SC-001).
