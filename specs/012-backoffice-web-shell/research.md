# Research: App web Backoffice (khung ứng dụng)

Mỗi mục: quyết định, lý do, phương án đã cân nhắc. Số liệu đo ngày 2026-10-14 trên `directus/` 11.17.4
(app 15.10.0, sdk 21.3.0) và trạng thái repo sau feature 011.

## R1. Thư viện và phiên bản

**Quyết định**: thêm vào catalog `pnpm-workspace.yaml` (nhóm "Web", cùng bản Directus 11.17.4 khi Directus có):

| Gói | Bản | Nguồn | Dùng cho |
|-----|-----|-------|----------|
| `reka-ui` | 2.8.2 | Directus catalog | DropdownMenu (menu avatar), Tooltip, Dialog, Select (chọn provider), Collapsible (sidebar) |
| `tailwindcss`, `@tailwindcss/vite` | 4.3.x (bản mới nhất 4.3 lúc cài) | mô tả plan | `@theme` token `--eh-*` |
| `@directus/sdk` | 21.3.0 | `directus/sdk/package.json` | client duy nhất (`rest`, `authentication('session')`) |
| `@vueuse/core` | 14.0.0 | Directus catalog | `useLocalStorage`, `useMediaQuery`, idle |
| `@unhead/vue` | 1.11.20 | Directus catalog | tiêu đề, favicon, meta, `html[lang]`, `body.class` như `app.vue` |
| `p-queue` | 8.1.0 | catalog đã có (009) | hàng đợi request tạm dừng khi refresh |
| `lodash-es` | 4.18.1 | catalog đã có | `merge` overrides theme |
| `date-fns` | 4.1.0 | catalog đã có | locale ngày giờ |
| `qrcode` | 1.5.4 | Directus catalog | QR `otpauth_url` ở `/tfa-setup` |
| `marked` 16.4.1, `dompurify` 3.3.2 | Directus catalog | `public_note` markdown (như directive `v-md`) |
| `js-yaml` | 4.3.2 | catalog đã có | chỉ script sync chuỗi dịch (devDependency) |
| `mitt` | 3.0.1 | Directus catalog | event bus `events.ts` (`tabIdle`, `tabActive`, `sessionExpired`) |
| `@directus/format-title` | 12.1.2 | `directus/packages/format-title` | nhãn provider như `stores/server.ts` |
| `@playwright/test` | 1.64.0 | catalog đã có | E2E |

Bỏ `axios` và `ofetch` ở app web: Directus app có hai client (`api.ts` axios, `sdk.ts` ofetch); FR-001 yêu cầu một
client. SDK với `globals.fetch` bọc `fetch` gốc đủ để gắn hàng đợi, `requestsStore`, và xử lý `401`.

[Unverified] `@directus/sdk@21.3.0` có trên npm registry: chưa kiểm tra được offline; nếu bản 21.3.0 không có,
dùng bản 21.x gần nhất và ghi vào Complexity Tracking (SDK là thư viện bên thứ ba, Nguyên tắc IX cho phép).

**Phương án bỏ**: viết client REST riêng (thêm code, lệch hành vi refresh của SDK); dùng `axios` như Directus
(hai client); Vuetify hay PrimeVue (không phải Reka UI, trái constitution VI).

## R2. Token design-system trong Tailwind 4 và theme tối

**Quyết định**:
- `apps/web/src/styles/tokens.css`: chép nguyên khối `:root` của `design-system/tokens/tokens.css` (ghi nguồn ở
  đầu file) và thêm khối `:root.dark` (hoặc `body.dark`) với bộ token tối **đề xuất tạm** (Q-5): nền
  `--eh-color-surface-default: #1f1f1f`, `--eh-color-surface-subtle: #141414`, chữ `--eh-color-text-primary:
  #f5f5f6`, `--eh-color-text-secondary: #a3adbf`, viền `--eh-color-border: #303030`, màu primary và trạng thái
  giữ nguyên. Các giá trị tối chỉ nằm trong file token (được phép có hex) và đổi ở một chỗ khi duyệt.
- `apps/web/src/styles/theme.css`: `@import "tailwindcss"; @theme { --color-eh-action-primary:
  var(--eh-color-action-primary); ... --spacing-eh-4: var(--eh-spacing-4); --radius-eh-md: var(--eh-radius-md);
  --font-eh-body: var(--eh-font-family-body); --text-eh-sm: var(--eh-font-size-sm); --shadow-eh-sm:
  var(--eh-shadow-sm); }` → utility `bg-eh-action-primary`, `text-eh-text-primary`, `p-eh-4`, `rounded-eh-md`,
  `font-eh-body`, `text-eh-sm`, `shadow-eh-sm`. Tên utility giữ tiền tố `eh-` (constitution XII).
- Không chép `design-system/tailwind.config.js`; không dùng `gray-*`, `sky-*`; lint rule (R9) chặn hex và palette.
- Chế độ tối theo class trên `<html>` (`dark`/`light`) đặt bởi `useHead` như Directus; `@custom-variant dark
  (&:where(.dark, .dark *))` của Tailwind 4 để `dark:` utility bám class.

**Ánh xạ override Directus → token (Q-6, tối thiểu)**: `theme_light_overrides` / `theme_dark_overrides` là
`DeepPartial<Theme['rules']>` của `@directus/themes` (khóa `primary`, `background`, `foreground`, `foregroundSubdued`,
`borderColor`, `success`, `warning`, `danger`, `borderRadius`, `fonts.sans.fontFamily`, `navigation.background`,
`header.background`, `sidebar.background`...). Ánh xạ ở `src/theme/override-map.ts`:

| Khóa Directus | Token `--eh-*` |
|---------------|----------------|
| `primary` | `--eh-color-action-primary` |
| `background` | `--eh-color-surface-default` |
| `backgroundNormal`, `backgroundSubdued` | `--eh-color-surface-subtle` |
| `foreground`, `foregroundAccent` | `--eh-color-text-primary` |
| `foregroundSubdued` | `--eh-color-text-secondary` |
| `borderColor` | `--eh-color-border` |
| `success`, `warning`, `danger` | `--eh-color-status-success`, `-warning`, `-danger` |
| `borderRadius` | `--eh-radius-md` |
| `fonts.sans.fontFamily` | `--eh-font-family-body` |
| `navigation.background`, `header.background`, `sidebar.background` | biến cục bộ `--bo-navigation-background`, `--bo-header-background`, `--bo-sidebar-background` (mặc định trỏ token surface) |

Khóa khác bỏ qua (D-43). Giá trị `var(--theme--*)` hay `color-mix(... var(--theme--*))` trong overrides không
dịch được: bỏ qua với một dòng `console.warn` (một lần mỗi khóa).

**Phương án bỏ**: port `@directus/themes` (bộ biến `--theme--*` riêng, trái XII); sinh token tối tự động bằng
`color-mix` (khó duyệt, kết quả không kiểm soát).

## R3. Client API, phiên và khác origin

**Quyết định**: `src/api/sdk.ts` (chép ý `directus/app/src/sdk.ts`): `createDirectus(apiUrl, { globals: { fetch
} }).with(authentication('session', { credentials: 'include', msRefreshBeforeExpires: 10_000 })).with(rest({
credentials: 'include' }))`. `fetch` bọc: tăng giảm `requestsStore`, chờ hàng đợi (`p-queue`, tạm dừng khi path
`/auth/refresh` như Directus), và với response `401` ngoài `/auth/*` gọi `logout({ reason: SESSION_EXPIRED })`
(chỗ Directus làm ở interceptor axios). `apiUrl` lấy từ `config.json` (001), không từ `window.location` như
`getPublicURL` (app và API có thể khác origin).

Link SSO (FR-041): `${apiUrl}/auth/login/${provider}?redirect=${origin}/admin/login?continue` (Directus dùng
`getRootPath()`; ở đây origin của app).

Khác origin (Clarifications): không có gì đổi ở app; cookie đi kèm nhờ `credentials: 'include'`. API cần
`CORS_ENABLED=true`, `CORS_ORIGIN=<origin app>`, `CORS_CREDENTIALS=true`, `SESSION_COOKIE_SAME_SITE=None`,
`SESSION_COOKIE_SECURE=true` (tất cả đã có ở `supported-variables.ts` nhóm hỗ trợ). E2E cấu hình (3) không cần
HTTPS: app ở `http://localhost:<port>`, API ở `http://127.0.0.1:<port>` là hai site khác nhau (IP và host) nên
cookie phải `SameSite=None`, và Chromium coi `localhost`, `127.0.0.1` là origin tin cậy nên nhận cookie `Secure`
qua HTTP. [Inference] dựa trên định nghĩa "potentially trustworthy origin" của W3C Secure Contexts; kiểm lại
khi dựng profile (T-E2E). Firefox và WebKit không chạy cấu hình (3) (spec FR-090). Spec FR-071 (3) sửa cho khớp.

**Phương án bỏ**: mode `json` khi khác origin (token trong localStorage, khác Directus app, bị XSS); proxy dev
server bắt buộc cùng origin (owner chọn hỗ trợ khác origin).

## R4. Chuỗi dịch và thay thương hiệu

**Quyết định**: script `apps/web/scripts/sync-translations.mjs` (Node, `js-yaml`):
1. Đọc `directus/app/src/lang/translations/{en-US,vi-VN}.yaml` và `available-languages.yaml`.
2. Thay `Directus` → `Backoffice` trong giá trị chuỗi, trừ chuỗi khớp danh sách giữ: `directus_`, `@directus`,
   `directus.io`, `Directus BSL` (giấy phép, 1 dòng), `theme_directus_*` (tên theme, dữ liệu `theme_light` trong
   DB, D-43 bỏ qua nhưng chuỗi giữ để không lệch), `directus_version`? (khóa giữ, giá trị "Directus Version" →
   "Backoffice Version"). `en-US.yaml` có 19 dòng chứa "Directus", `vi-VN.yaml` 0 dòng.
3. Ghi `apps/web/src/lang/translations/en-US.json`, `vi-VN.json` (JSON để Vite nạp không cần loader YAML) với
   dòng đầu trong file `.meta.json` ghi nguồn và hash; ghi `src/lang/available-languages.json`.
4. Báo cáo các chuỗi giữ nguyên ra stdout (danh sách "cần xác nhận" của spec).
Test `sync-translations.test.ts`: chạy lại script vào thư mục tạm, so bằng với file đã commit (không lệch);
không còn "Directus" ngoài danh sách giữ. Overlay `src/lang/overlay/{en-US,vi-VN}.ts` thêm khóa riêng
(`contact_admin_for_link`, `module_placeholder`, `register_not_available`), gộp sau khi nạp.

Nạp theo yêu cầu (`import()` động từng JSON) như `set-language.ts`; `en-US` nạp sẵn.

**Phương án bỏ**: nạp YAML lúc build từ `directus/` (Clarifications: không); `@intlify/unplugin-vue-i18n` (thêm
plugin cho hai file).

## R5. Router, guard, module

**Quyết định**: chép `directus/app/src/router.ts` thành `src/router/index.ts` (ghi nguồn) với: `createWebHistory('/admin/')`
(không `getRootPath`), cùng danh sách route public, `tfa-setup`, `private-404`; `onBeforeEach`, `onAfterEach`
giữ nguyên logic (đổi key localStorage `backoffice-require_tfa_setup`). Module đăng ký tĩnh ở `src/modules/index.ts`
(`defineModule` thu gọn: `id`, `name`, `icon`, `hidden`, `routes`, `preRegisterCheck`) với sáu module; `routes`
của mỗi module ở 012 là `[{ path: '', component: ModulePlaceholder }, { path: ':pathMatch(.*)*', component:
ModulePlaceholder }]` (khớp route con, FR-023), riêng `users` thêm `{ path: 'me', component: Profile }` trước,
`settings` có redirect `'' → data-model` rồi placeholder. `registerModules` thêm route `/${id}` sau khi hydrate và
gỡ khi dehydrate như Directus.

`hydrate.ts` chép và rút gọn: user → permissions + fields (song song) → settings, collections, relations, presets,
notifications (song song) → `setLanguage`. Store nào 013+ cần đầy đủ thì 013+ chép tiếp; ở 012 các store
collections, fields, relations, presets, translations chỉ `hydrate` (GET và giữ), không có `translateCollections`,
`getField`... (D-45).

## R6. Store và composable chép từ Directus

| Nguồn `directus/app/src` | Đích `apps/web/src` | Sửa |
|--------------------------|---------------------|-----|
| `stores/server.ts` | `stores/server.ts` | `api.get` → `sdk.request`; bỏ `mcp_enabled`, `ai_enabled` |
| `stores/user.ts` | `stores/user.ts` | giữ `hydrate` (`/users/me`, `/policies/me/globals`, `/roles/me`), `trackPage`, `language`, `textDirection` |
| `stores/settings.ts` | `stores/settings.ts` | giữ `hydrate`, `updateSettings`; bỏ `setOwner`, AI |
| `stores/permissions.ts` | `stores/permissions.ts` | nguyên |
| `stores/requests.ts` | `stores/requests.ts` | nguyên |
| `stores/notifications.ts` | `stores/notifications.ts` | chỉ `hydrate` (đếm chưa đọc), không drawer |
| `stores/collections.ts`, `fields.ts`, `relations.ts`, `presets.ts`, `translations.ts` | cùng tên | chỉ `hydrate`/`dehydrate` |
| `@directus/stores` `useAppStore` | `stores/app.ts` | chép phần dùng: `authenticated`, `hydrated`, `hydrating`, `accessTokenExpiry`, `error`, `navbarOpen`, `sidebarOpen`, `fullScreen` |
| `auth.ts` | `auth.ts` | `api` → `sdk`; bỏ cookie `license-banner-dismissed`; share login giữ |
| `idle.ts` | `idle.ts` | nguyên |
| `hydrate.ts` | `hydrate.ts` | R5 |
| `composables/use-theme-configuration.ts` | `theme/use-theme-configuration.ts` | nguyên; thêm `applyOverrides` theo R2 |
| `composables/use-tfa-setup.ts` | `composables/use-tfa-setup.ts` | `api` → `sdk` |
| `composables/use-safe-redirect.ts` | `composables/use-safe-redirect.ts` | nguyên |
| `utils/generate-favicon.ts`, `get-asset-url.ts`, `jwt-payload.ts`, `translate-object-values.ts`, `get-date-fns-locale.ts` | `utils/` | `getRootPath` → `apiUrl` |
| `lang/index.ts` (`translateAPIError`), `set-language.ts` | `lang/` | R4 |
| `views/private/private-view/stores/sidebar.ts`, `nav-bar.ts` | `layout/stores/` | key localStorage thêm tiền tố `backoffice-` |
| `constants.ts` (`MODULE_BAR_DEFAULT`, `DEFAULT_AUTH_*`, `AUTH_SSO_DRIVERS`, `SDK_AUTH_REFRESH_BEFORE_EXPIRES`, `BREAKPOINTS`) | `constants.ts` | bỏ `DIRECTUS_LOGO` |

Mỗi file ghi `// Ported from directus/app/src/...` và manifest `tools/port-manifest/012-T*.json` như các feature
trước (guard `check-port-headers`).

## R7. Component và bố cục bằng Reka UI

**Quyết định**: viết mới (không chép SFC của Directus) với token và Tier 1 của `component-specs.md`:

| Component | Reka UI | Ghi chú |
|-----------|---------|---------|
| `BoButton` | không (native `button`/`RouterLink`) | `variant` primary/secondary/ghost, `icon`, `loading`, `disabled`, `aria-label` bắt buộc khi chỉ icon |
| `BoInput` | không (`input`) | `modelValue`, `type`, `invalid`, `error` (`aria-describedby`), `label` (`for`) |
| `BoSelect` | `SelectRoot/Trigger/Content/Item` | chọn provider; `modelValue` |
| `BoNotice` | không | `type` info/success/warning/danger, icon + chữ (không chỉ màu) |
| `BoTooltip` | `TooltipRoot/Trigger/Content` | module bar |
| `BoMenu` | `DropdownMenuRoot/Trigger/Content/Item` | avatar |
| `BoDialog` | `DialogRoot/...` | lỗi hệ thống, xác nhận |
| `BoIcon` | không | Material Symbols theo tên (R8) |
| `BoProgressCircular`, `BoProgressLinear` | không | hydrating, logo loading |
| `BoSkipMenu` | không | như `skip-menu.vue` |
| Layout: `ModuleBar`, `ModuleBarLogo`, `ModuleBarAvatar`, `NavBar` (+ `ProjectName`), `HeaderBar`, `MainContent`, `Sidebar`, `PrivateView`, `PublicView`, `NoAppAccess`, `ResizeHandle` | `CollapsibleRoot` cho sidebar | breakpoint `lg` 57.625rem (922px), `xl` 72rem như `BREAKPOINTS` của Directus; dưới `lg` nav là drawer |

Reka UI 2.8.2 export kiểm tại `node_modules/reka-ui/dist/index.d.ts` khi cài (constitution XII); nếu tên khác
(ví dụ `SelectRoot` vs `Select`), sửa theo bản cài.

## R8. Icon

**Quyết định**: Material Symbols Rounded font (như Directus; tên icon `box`, `folder`, `people_alt`, `insights`,
`notifications`, `settings`, `help`, `lock`, `lock_open`... là dữ liệu trong `module_bar` và module). Gói
`material-symbols` (npm, font variable, bản mới nhất lúc cài, OFL) nạp subset Rounded 400 qua `@font-face` trong
`styles/fonts.css`; `BoIcon` render `<span class="material-symbols-rounded" aria-hidden="true">{{ name }}</span>`
với `font-size` theo token `--eh-font-size-*`. Không chép `directus/app/src/assets/fonts/material-symbols.woff2`
(tài sản Directus, FR-036 áp cho logo; font là OFL nhưng gói npm sạch hơn).

[Unverified] tên gói `material-symbols` và cách nạp subset: kiểm khi cài; phương án dự phòng
`@material-symbols/font-400`.

## R9. Lint, test, coverage

**Quyết định**:
- ESLint: thêm rule tùy chỉnh `no-raw-color` (script `tools/eslint/no-raw-color.mjs`) cho `*.vue`, `*.css` ngoài
  `styles/tokens.css`: chặn `#[0-9a-f]{3,8}`, `rgb(`, `hsl(`, và class Tailwind palette (`(bg|text|border|ring)-
  (gray|zinc|slate|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|
  purple|fuchsia|pink|rose)-\d+`) (FR-092).
- Vitest + `@vue/test-utils` + happy-dom (đã có); `fetch` stub bằng `vi.stubGlobal('fetch', ...)` trả `Response`;
  không msw. Test theo FR-091; coverage 60% (`vitest.config.ts` đã đặt).
- E2E: dùng lại project `apps/web-e2e` (đã có từ 001, Nx `web-e2e:e2e`) thay vì tạo `tests/web-e2e`; spec FR-090
  sửa tên. Playwright projects: `chromium`, `firefox`, `webkit` × viewport 768 và 1280 (6 project) cho cấu hình (1)
  và (2); cấu hình (3) chỉ `chromium`; `msedge` project bật khi `PLAYWRIGHT_MSEDGE=1` (runner có Edge).
  Helper ghi lại mọi request (`page.on('request')`) và so với danh sách path của `contracts/api-calls.md` (FR-002).
- Dữ liệu E2E: tài khoản admin của env parity, user hạn chế tạo qua API (`helpers` của `tests/directus-app-e2e`
  dùng lại: `login.ts`, `db-rows.ts`), token quên mật khẩu và lời mời đọc từ log container của API mới
  (`docker logs`, như `mail.test.ts` của 010) hoặc từ `directus_users.token`? Không: Directus không lưu token mời
  trong DB; với cấu hình (1) (API Directus) đọc email giả? Directus không gửi được mail trong env → lấy token bằng
  cách ký lại JWT với `SECRET` của env (test helper, cùng payload Directus dùng: `{ email, scope: 'invite' }` /
  `{ email, scope: 'password-reset', hash }`), như blackbox của Directus làm ở `users/invite`.

## R10. Môi trường đối chiếu: profile `web`

**Quyết định**: `tests/parity/docker-compose.yml` thêm:
- `backoffice-web` (build `apps/web/Dockerfile`, image `hiennd23/backoffice-web:local`, profile `web`,
  `PUBLIC_URL=/`), port 8180.
- `proxy-web-directus` (nginx, profile `web`, port 8161): `/admin/` → `backoffice-web:8080`, còn lại → `directus:8055`.
- `proxy-web-api` (nginx, profile `web`, port 8162): `/admin/` → `backoffice-web:8080`, còn lại →
  `backoffice-api:8055`.
- Cấu hình (3): `backoffice-api-web-cors` (profile `web`, port 8163, env `profile-web-cors.env`:
  `CORS_ENABLED=true`, `CORS_ORIGIN=http://localhost:8180`, `CORS_CREDENTIALS=true`,
  `SESSION_COOKIE_SAME_SITE=None`, `SESSION_COOKIE_SECURE=true`, `PUBLIC_URL=http://127.0.0.1:8163`) và
  `backoffice-web-cors` (port 8181, `PUBLIC_URL=http://127.0.0.1:8163`). Playwright mở `http://localhost:8181`.
- Profile `sso` chạy cùng để có LDAP, OIDC, OAuth2 (API ở 8955/8956 với `PUBLIC_URL` riêng): kịch bản SSO và
  `/setup` của E2E chạy từ `backoffice-web-cors` với `apiUrl` ghi đè bằng `page.route('**/admin/config.json')` (R13),
  không thêm container web. `profile-sso.env` và env cặp `setup` thêm `CORS_*`, `SESSION_COOKIE_*` (bộ parity 003,
  010 so header: kiểm `accepted-differences` hoặc bỏ header CORS khỏi so sánh; task riêng).
- SSO từ `http://localhost:8181`: Directus chỉ chấp nhận `redirect` thuộc `PUBLIC_URL` hoặc
  `AUTH_ALLOWED_PUBLIC_URLS`, nên `profile-sso.env` thêm `http://localhost:8181` vào `AUTH_ALLOWED_PUBLIC_URLS`
  (giữ `http://localhost:8955/api` của 003; cả hai app đọc cùng file nên bộ parity `sso` không lệch).
- Tổng: hai container web (`backoffice-web` sau hai proxy, `backoffice-web-cors` cho cấu hình 3), một API thêm
  (`backoffice-api-web-cors`), hai proxy.
- `scripts/env.mjs`: `web` vào `ALL_PROFILES`; `proxy-web-*` không cần `proxy-conf.mjs` (nginx tĩnh).
- CI: job `e2e-web` thay job `e2e` hiện tại (dùng image từ job `docker`): `env-up --vendor=postgres
  --profiles=app,setup,sso,web`, chạy `web-e2e:e2e` ba lần với `BASE_URL`/`E2E_CONFIG` khác nhau; `e2e` cũ (ping
  smoke) gộp vào.

## R11. Tài sản thương hiệu và favicon

**Quyết định**: `apps/web/public/favicon.ico` (+ `favicon.svg`), `src/assets/logo-light.svg`, `logo-dark.svg`:
chữ "B" trong hình tròn, màu `currentColor` để tô bằng token primary (Q-7, tạm). `generateFavicon(color,
withLetter)` chép từ Directus (vẽ canvas chữ cái đầu `project_name`? Directus vẽ hình vuông bo góc màu
`project_color` và logo trắng khi không có `project_logo`): giữ logic, thay path SVG của Directus bằng chữ "B".

## R12. Hiệu năng tải đầu (SC-008)

**Quyết định**: Vite chia chunk theo route (public, private, modules), `vue-i18n` chỉ gói `en-US`; font Material
Symbols subset Rounded (~300 KB woff2) tải `font-display: block`; Noto Sans self-host (Q-2 tạm) hai weight. Mục
tiêu bundle chính gzip ≤ 350 KB. Đo bằng Playwright (`performance.timing`) ở E2E với throttling `10 Mbps` qua CDP
(chromium), ghi số, chặn khi > 3 s.

## R13. Script tạo tài khoản ở `/setup` và profile `setup`

**Quyết định**: E2E `/setup` dùng profile `setup` đã có (010: cặp riêng với Postgres riêng, DB rỗng): web
container thứ tư? Không: cấu hình (3) với `apiUrl` trỏ `backoffice-api-setup` qua `config.json` ghi đè bằng
`page.route('**/admin/config.json')` (như smoke test hiện có) — một web container, nhiều API. Áp dụng cùng cách
cho SSO (R10): chỉ `backoffice-web` và `backoffice-web-cors`; mọi biến thể `apiUrl` làm bằng `page.route` của
Playwright. CORS ở các cặp `sso`, `setup` thêm vào env profile tương ứng.

## Khác biệt phát hiện khi research (bổ sung spec)

- FR-071 (3): không cần HTTPS tự ký; dùng hai site `localhost`/`127.0.0.1` (R3). Spec sửa.
- FR-090: project E2E là `apps/web-e2e` (đã có), không tạo `tests/web-e2e`. Spec sửa.
- Không có khác biệt mới với Directus.
