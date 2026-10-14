---

description: "Danh sách task cho feature 012: app web Backoffice (khung ứng dụng, đăng nhập, bố cục, điều hướng)"
---

# Tasks: App web Backoffice (khung ứng dụng, đăng nhập, bố cục, điều hướng)

**Input**: Tài liệu thiết kế trong `/specs/012-backoffice-web-shell/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R13), `data-model.md`, `contracts/`
(`ui-routes.md`, `api-calls.md`, `e2e.md`), `quickstart.md`, `checklists/` (`requirements.md`, `release-gate.md`).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test (Vitest + Vue Test Utils + happy-dom), bảng ánh xạ ở `contracts/e2e.md` §1; coverage
  `apps/web` ≥ 60%.
- Feature không thêm hay sửa endpoint API, nên không có test đối chiếu API mới. Đối chiếu ở mức app: mọi spec E2E chạy
  ở ba cấu hình `E2E_CONFIG` (`proxy-directus` = API Directus 11.17.4 thật, `proxy-api` = API mới, `cors` = API mới
  khác site) với cùng kịch bản (`contracts/e2e.md` §2); lệch hành vi giữa hai API là lỗi của API (báo về feature
  003–010), lệch giữa app mới và Directus app (`tests/directus-app-e2e`) ghi vào "Ghi chú khi làm" và hỏi tech lead.
- Chỗ research đánh [Unverified]/[Inference] (R1 `@directus/sdk` 21.3.0 trên npm, R3 cookie `Secure` qua HTTP trên
  `localhost`/`127.0.0.1`, R7 export Reka UI, R8 gói font) có task kiểm sớm (T002, T004, T019, T070); kết quả ghi
  vào research.md.

**Organization**: Task nhóm theo user story của spec. Phase 1 và 2 là nền chung: thư viện, token, client SDK, store,
i18n, auth, router, component Tier 1, môi trường E2E (các story đều cần). Thứ tự story: US1 (đăng nhập, phiên) →
US2 (bố cục, điều hướng) → US3 (thương hiệu) → US4 (LDAP, SSO) → US5 (quên mật khẩu, lời mời, setup, share) → US6
(hồ sơ, theme, ngôn ngữ) → US7 (ba cấu hình, CI) → Polish. Bốn đợt commit lên `main`: A = Phase 1, 2; B = Phase 3, 4,
5; C = Phase 6, 7, 8; D = Phase 9, 10.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- File chép từ `directus/app/src` PHẢI có dòng đầu `// Ported from directus/app/src/<đường dẫn>` (SFC: comment trong
  `<script setup>`). Mỗi task chép ghi các cặp `{ "source", "dest" }` vào `tools/port-manifest/012-T###.json`; chạy
  `node tools/check-port-headers.mjs`. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Logic chép giữ tên hàm, thứ tự, message của Directus; chỗ khác nguồn ghi `// Backoffice: <lý do>` (api → sdk,
  `getRootPath` → `apiUrl`, key localStorage `backoffice-`, bỏ AI/extension/license).
- Component viết mới bằng Reka UI + token: KHÔNG hex thô, KHÔNG màu palette Tailwind ngoài `styles/tokens.css`
  (rule `no-raw-color`, T009). Mọi nút chỉ icon có `aria-label`; input có `label[for]`; lỗi gắn `aria-describedby`.
- Giá trị tạm cho Q-1 đến Q-7 chỉ đặt ở `styles/tokens.css`, `theme/override-map.ts`, `assets/logo-*.svg`; mỗi chỗ
  ghi `/* Q-n tạm */`.
- Test đặt cạnh file (`*.test.ts`); E2E ở `apps/web-e2e/src/*.spec.ts`. Chuỗi mới (overlay) phải có cả `vi-VN` và
  `en-US`.
- Sau mỗi phase: `pnpm nx run web:lint`, `web:typecheck`, `web:test`, `web:build` xanh; cuối Phase 2 và cuối mỗi
  đợt commit chạy E2E ba cấu hình (quickstart).

---

## Phase 1: Setup (thư viện, token, cấu hình build)

**Purpose**: cài gói, token Tailwind 4, lint, tài sản, khung build; chưa có hành vi.

- [X] T001 `pnpm-workspace.yaml` catalog nhóm "Web" thêm (research R1): `reka-ui: 2.8.2`, `tailwindcss` và
  `@tailwindcss/vite` 4.3.x mới nhất, `@directus/sdk: 21.3.0`, `@vueuse/core: 14.0.0`, `@unhead/vue: 1.11.20`,
  `qrcode: 1.5.4`, `@types/qrcode`, `marked: 16.4.1`, `dompurify: 3.3.2`, `mitt: 3.0.1` (Directus catalog),
  `@directus/format-title: 12.1.2` (bản của Directus 11.17.4), `material-symbols` (bản mới nhất),
  `@axe-core/playwright` (bản 4.x mới nhất, devDependency của `apps/web-e2e`, FR-067); ghi
  comment nguồn (Directus catalog / plan). `apps/web/package.json` thêm dependency theo `catalog:`; bỏ không dùng
  `axios` (chưa có ở web). `pnpm install`; lockfile cập nhật.
- [X] T002 Kiểm [Unverified] R1, R8: `pnpm view @directus/sdk@21.3.0 version`,
  `pnpm view @directus/format-title@12.1.2 version`, `pnpm view material-symbols version`;
  nếu thiếu dùng bản gần nhất và ghi vào `specs/012-backoffice-web-shell/research.md` (R1, R8) và `plan.md`
  Complexity Tracking. Ghi kết quả thực tế vào research.md dù đúng hay sai.
- [X] T003 [P] `apps/web/vite.config.ts`: thêm `tailwindcss()` plugin, `base: '/admin/'` giữ, dev proxy mọi path API
  (danh sách segment của `contracts/api-calls.md`: `auth|server|users|policies|roles|permissions|settings|collections|
  fields|relations|presets|translations|notifications|assets|shares|files`) sang `PUBLIC_URL` với
  `changeOrigin: false` (giữ cookie); `build.rollupOptions.output.manualChunks` tách `public`, `private`, `vendor`
  (R12). `apps/web/project.json` thêm target `sync-translations` (`node scripts/sync-translations.mjs`) và
  `lint` chạy `eslint src scripts`.
- [X] T004 [P] Kiểm export Reka UI 2.8.2 (R7): sau `pnpm install`, `grep -oE 'export \{[^}]*\}' node_modules/reka-ui/dist/index.d.ts | tr ',' '\n' | grep -E 'SelectRoot|DropdownMenuRoot|TooltipRoot|DialogRoot|CollapsibleRoot|Primitive'`; ghi tên export thật vào research.md R7 (bảng component).
- [X] T005 [P] `apps/web/src/styles/tokens.css`: chép khối `:root` của `design-system/tokens/tokens.css` nguyên văn
  (dòng đầu `/* Copied from design-system/tokens/tokens.css */`), thêm khối `:root.dark { ... }` với bộ token tối
  tạm (R2, `/* Q-5 tạm */`), và `--bo-navigation-background`, `--bo-header-background`, `--bo-sidebar-background`
  mặc định trỏ `--eh-color-surface-subtle`/`-default`.
- [X] T006 [P] `apps/web/src/styles/theme.css`: `@import "tailwindcss"; @custom-variant dark (&:where(.dark, .dark
  *)); @theme { ... }` ánh xạ đủ token màu, spacing, radius, font, cỡ chữ, shadow sang utility `eh-*` (bảng R2);
  `apps/web/src/styles/base.css`: reset tối thiểu, `:focus-visible` outline token, `.sr-only`, skip-link; test
  `apps/web/src/styles/theme.test.ts`: parse `theme.css` và khẳng định mọi `--eh-*` trong `tokens.css` có một dòng
  `@theme` tương ứng (không thiếu token); tính tương phản WCAG cho các cặp dùng trong app (chữ chính, chữ phụ, chữ
  trên nút chính, link, viền input, ở cả theme sáng và tối) với ngưỡng FR-067; các cặp đã ghi ở Q-8 dùng `it.fails`
  kèm `// Q-8` để test báo khi token được sửa, mọi cặp khác phải đạt.
- [X] T007 [P] Font (R8, R12): `apps/web/src/styles/fonts.css` với `@font-face` Noto Sans (hai weight, `/* Q-2 tạm */`,
  file woff2 tải vào `apps/web/public/fonts/`, ghi giấy phép OFL ở `apps/web/public/fonts/LICENSE.txt`) và Material
  Symbols Rounded từ gói `material-symbols` (import CSS của gói hoặc copy woff2 subset); `font-display: block` cho icon,
  `swap` cho chữ.
- [X] T008 [P] Tài sản thương hiệu (R11, `/* Q-7 tạm */`): `apps/web/src/assets/logo-light.svg`, `logo-dark.svg`
  (chữ "B" trong hình tròn, `fill="currentColor"`), `apps/web/public/favicon.svg`, `favicon.ico` (32 px);
  `apps/web/index.html`: `<link rel="icon" href="/admin/favicon.ico">`, `<meta name="theme-color">` trống (app đặt),
  `<div id="custom-css"></div>`? Không: `useHead` chèn style; giữ `<title>Backoffice</title>`.
- [X] T009 [P] Lint: `tools/eslint/no-raw-color.mjs` (rule ESLint: báo lỗi hex `#[0-9a-fA-F]{3,8}`, `rgb(`, `hsl(`,
  và class palette Tailwind trong `.vue`, `.css`, `.ts` dưới `apps/web/src`, trừ `styles/tokens.css`) + test
  `tools/eslint/no-raw-color.test.mjs` (hai ca đúng, bốn ca sai); `eslint.config.js` đăng ký rule cho `apps/web`.
- [X] T010 [P] `apps/web/src/constants.ts` (Ported từ `constants.ts`): `MODULE_BAR_DEFAULT` giữ các mục `visual`,
  `deployments` (`enabled: false`, không đăng ký module nên bị lọc như Directus) và bỏ mục link `docs` (`// Backoffice:
  D-49`), `DIRECTUS_DOCS_URL = 'https://docs.directus.io'` (dùng để lọc bản đã lưu, FR-081),
  `DEFAULT_AUTH_PROVIDER`, `DEFAULT_AUTH_DRIVER`, `AUTH_SSO_DRIVERS`, `SDK_AUTH_REFRESH_BEFORE_EXPIRES`,
  `BREAKPOINTS` (`sm` 576, `lg` 922, `xl` 1152 px, từ `_breakpoints.scss`), `RTL_LANGUAGES`; manifest
  `tools/port-manifest/012-T010.json`.

**Checkpoint**: `pnpm nx run web:build` xanh với Tailwind 4; `web:lint` chạy rule mới; research R1, R7, R8 đã ghi
kết quả kiểm.

---

## Phase 2: Foundational (client, store, i18n, auth, router, component, môi trường E2E)

**Purpose**: nền mà mọi story cần. Không story nào bắt đầu trước khi xong phase này.

### Client API và store

- [X] T011 `apps/web/src/api/sdk.ts` (Ported từ `sdk.ts` + `api.ts`, R3): `createSdk(apiUrl)` → `createDirectus(apiUrl,
  { globals: { fetch: wrappedFetch } }).with(authentication('session', { credentials: 'include',
  msRefreshBeforeExpires: SDK_AUTH_REFRESH_BEFORE_EXPIRES })).with(rest({ credentials: 'include' }))`;
  `wrappedFetch`: `requestsStore.startRequest/endRequest`, `requestQueue` (p-queue `concurrency 5, intervalCap 5,
  interval 500`) tạm dừng khi path `/auth/refresh`, `resumeQueue()`, `replaceQueue()`; (owner 2026-10-14: không xử lý `401`, như Directus) response `401` ở path không
  bắt đầu `/auth/` → `emitter.emit('sessionExpired')` (auth.ts nghe và logout, tránh import vòng). Export `sdk`
  (singleton gán ở `main.ts`), `requestEndpoint(path, options)`. `apps/web/src/api/sdk.test.ts`: queue pause/resume,
  requestsStore đếm, `401` phát sự kiện, `401` ở `/auth/login` không phát, `credentials: 'include'` có trong request.
- [X] T012 [P] `apps/web/src/events.ts` (Ported từ `events.ts`, dùng `mitt` (T001) như Directus): `Events.tabIdle`,
  `tabActive`, `sessionExpired`.
- [X] T013 [P] Store nền (Ported, R6): `apps/web/src/stores/app.ts` (từ `@directus/stores` `useAppStore`: 7 field ở
  data-model §1), `stores/requests.ts`, `stores/server.ts` (`info`, `auth`, `providerOptions`, `hydrate` gọi
  `/server/info` và `/auth?sessionOnly` qua `sdk.request(requestEndpoint(...))`; bỏ `mcp_enabled`, `ai_enabled`),
  `stores/permissions.ts`; `formatTitle` từ `@directus/format-title` (T001); test `stores/server.test.ts`
  (`providerOptions`: disableDefault, lọc SSO, nhãn qua `formatTitle`; `project` null hoặc thiếu field → `info.project`
  giữ null, không ném (C2, FR-037)), `stores/permissions.test.ts`; manifest `012-T013.json`.
- [X] T014 [P] `apps/web/src/stores/user.ts` (Ported): `hydrate` (`/users/me?fields=*,role.id`, `/policies/me/globals`,
  `/roles/me?fields=id`), `dehydrate`, `hydrateAdditionalFields`, `trackPage` (`PATCH /users/me { last_page }`, bỏ
  qua share), `language` (user → `default_language` → `en-US`), `textDirection`; `stores/user.test.ts` (3 nấc ngôn
  ngữ, rtl, trackPage, share); manifest `012-T014.json`.
- [X] T015 [P] `apps/web/src/stores/settings.ts` (Ported: `hydrate` bỏ qua share, `updateSettings` không notify),
  `stores/notifications.ts` (chỉ `unread` đếm qua `GET /notifications` với query đo từ `stores/notifications.ts`
  Directus; ghi query thật vào `contracts/api-calls.md` #26), `stores/collections.ts`, `fields.ts`, `relations.ts`,
  `presets.ts`, `translations.ts` (mỗi file: state mảng + `hydrate` + `dehydrate`, ghi `// Backoffice: only
  hydrate/dehydrate; feature 013+ ports the rest`); test `stores/settings.test.ts`, `stores/notifications.test.ts`;
  manifest `012-T015.json`.

### i18n

- [X] T016 `apps/web/scripts/sync-translations.mjs` (R4): đọc `directus/app/src/lang/translations/{en-US,vi-VN}.yaml`,
  `available-languages.yaml` bằng `js-yaml`; thay `Directus` → `Backoffice` trong giá trị chuỗi trừ giá trị khớp
  `KEEP = [/directus_/, /@directus/, /directus\.io/, /Directus BSL/]` và khóa `theme_directus_*`; ghi
  `apps/web/src/lang/translations/en-US.json`, `vi-VN.json`, `available-languages.json`, `translations.meta.json`
  (`{ source: "directus/app/src/lang/translations", version: "11.17.4", sha256: {...}, kept: [khóa giữ] }`); in
  bảng khóa giữ ra stdout. Chạy script, commit kết quả. `apps/web/scripts/sync-translations.test.ts`: chạy hàm sync
  vào thư mục tạm và so bằng từng byte với file commit; khẳng định không còn `Directus` ngoài `kept`; khẳng định
  `kept` ⊆ danh sách "Cần xác nhận" của spec (đọc spec.md). Manifest `012-T016.json` (source yaml → dest json).
- [X] T017 [P] `apps/web/src/lang/overlay/en-US.ts`, `vi-VN.ts`: `contact_admin_for_link`, `module_placeholder`
  (`{ feature }` không hiện số feature cho người dùng: dùng câu chung "Nội dung của mục này sẽ có ở phiên bản sau"),
  `register_not_available`, `skip_to_content`, `skip_to_navigation`, `open_navigation`, `open_sidebar`; test
  `lang/overlay.test.ts`: hai file cùng tập khóa.
- [X] T018 `apps/web/src/lang/index.ts` (Ported từ `lang/index.ts`: `createAppI18n`, `i18n`, `loadedLanguages`,
  `translateAPIError(error | code)` đọc `errors.<CODE>`), `lang/set-language.ts` (Ported: `import()` JSON động, merge
  overlay, `html[lang]`, `translationsStore.loadTranslations(lang)` → `GET /translations?filter[language][_eq]=
  <lang>&limit=-1&fields=key,value`, `loadDateFNSLocale`), `utils/get-date-fns-locale.ts` (Ported, chỉ `en-US`,
  `vi` + fallback), xóa `src/i18n/*` cũ (001) và cập nhật `main.ts`, `App.test.ts`; test `lang/set-language.test.ts`
  (nạp động, fallback en-US khi thiếu khóa và khi ngôn ngữ không đóng gói, `/translations` 403 bỏ qua, `html[lang]`),
  `lang/translate-api-error.test.ts`; manifest `012-T018.json`.

### Auth, hydrate, router

- [X] T019 Kiểm [Inference] R3 trước khi dựng E2E: script tạm trong scratchpad dùng Playwright chromium mở
  `http://localhost:<p>` gọi `fetch('http://127.0.0.1:<q>/set', { credentials: 'include' })` tới server node nhỏ đặt
  cookie `SameSite=None; Secure` rồi gọi lại và kiểm cookie được gửi; ghi kết quả (đạt/không) vào research.md R3. Nếu
  không đạt: cấu hình (3) chuyển sang HTTPS tự ký ở proxy (ghi vào research, cập nhật T046, spec FR-071).
- [X] T020 `apps/web/src/auth.ts` (Ported, R6): `login({ credentials, provider, share })` (email/identifier/share, `mode:
  'session'`, sau đó `sdk.refresh()`, `serverStore.hydrate()`, `hydrate()`), `refresh({ navigate })` (còn hạn →
  `readMe({ fields: ['id'] })`; hết hạn → `sdk.refresh()`; lỗi → `logout(SESSION_EXPIRED)`; `finally resumeQueue`),
  `logout({ navigate, reason })`, `LogoutReason`; nghe `Events.sessionExpired` (T011), `tabIdle`/`tabActive` (T021);
  `auth.test.ts` (login 3 kiểu, refresh 3 nhánh, logout 2 lý do, idle); manifest `012-T020.json`.
- [X] T021 [P] `apps/web/src/idle.ts` (Ported nguyên: `startIdleTracking`, `stopIdleTracking`, ngưỡng như Directus) +
  `idle.test.ts` (chép ý `idle.test.ts` Directus với fake timers); manifest `012-T021.json`.
- [X] T022 `apps/web/src/hydrate.ts` (Ported, R5): thứ tự FR-016 (user → permissions + fields → settings, collections,
  relations, presets, notifications → `setLanguage`), `dehydrate`, `appStore.error` khi lỗi; `hydrate.test.ts` (thứ tự
  gọi, user không `app_access` không nạp store khác, lỗi → `error`); manifest `012-T022.json`.
- [X] T023 `apps/web/src/modules/index.ts` (Ported từ `modules/index.ts`): `defineModule`, `registerModules(modules)` →
  `registeredModules`, `onHydrateModules` (preRegisterCheck, `router.addRoute({ name: id, path: '/'+id, children })`),
  `onDehydrateModules`; sáu file `modules/{content,files,users,insights,activity,settings}.ts` với `id`, `name`,
  `icon`, `hidden`, `preRegisterCheck` chép từ `modules/*/index.ts` và `routes` theo `contracts/ui-routes.md` §2
  (placeholder `ModulePlaceholder.vue` tạo ở T037; ở task này import động để không chặn); `modules/index.test.ts`
  (6 module × admin/partial/none, add/remove route); manifest `012-T023.json`.
- [X] T024 `apps/web/src/router/index.ts` + `router/guard.ts` (Ported từ `router.ts`): `createAppRouter()` với
  `createWebHistory('/admin/')`, danh sách route public và private theo `contracts/ui-routes.md` §1–2 (component
  route import động `() => import('../routes/...')`, các file tạo ở phase story; tạm `RouteStub.vue` cho route chưa
  có), `onBeforeEach`, `onAfterEach` (`trackPage` 500 ms), key `backoffice-require_tfa_setup`; `router/guard.test.ts`
  (mọi nhánh §3 của contracts/ui-routes: 10 ca); thay `router/index.ts` cũ của 001; manifest `012-T024.json`.
- [X] T025 `apps/web/src/main.ts`: `loadRuntimeConfig` → `createSdk(apiUrl)` → `createPinia`, `createAppRouter`,
  `createAppI18n`, `createHead` (`@unhead/vue`) → `app.provide('apiUrl')`, `startIdleTracking` → mount; import
  `styles/{tokens,theme,base,fonts}.css`; `App.vue` tạm: `RouterView` + màn `hydrating` + màn lỗi (hoàn thiện ở
  T039); `App.test.ts` cập nhật.

### Component Tier 1 (Reka UI, token)

- [X] T026 [P] `apps/web/src/components/BoIcon.vue` (Material Symbols theo `name`, prop `size` sm/md/lg → token cỡ chữ,
  `aria-hidden` mặc định, `label` → `role=img aria-label`), `BoProgressCircular.vue`, `BoProgressLinear.vue`
  (`indeterminate`, `role=progressbar`); test `components/BoIcon.test.ts`.
- [X] T027 [P] `BoButton.vue` (`variant` primary/secondary/ghost/danger, `icon` chỉ-icon bắt buộc `ariaLabel`,
  `loading` (spinner + `aria-busy`, disabled), `disabled`, `to`/`href` → `RouterLink`/`a`, `type`), `BoInput.vue`
  (`modelValue`, `type`, `label`, `placeholder`, `autocomplete`, `autofocus`, `disabled`, `invalid`, `error` →
  `aria-invalid`, `aria-describedby`, id tự sinh `useId`), `BoNotice.vue` (`type`, icon + slot, `role=status`/`alert`
  khi danger); test `BoButton.test.ts`, `BoInput.test.ts` (label for/id, error liên kết, invalid), `BoNotice.test.ts`.
- [X] T028 [P] `BoSelect.vue` (Reka `Select*` theo export thật T004; `modelValue`, `items: {text,value}[]`, `label`,
  bàn phím mở/chọn/Esc), `BoTooltip.vue` (Reka `Tooltip*`), `BoMenu.vue` (Reka `DropdownMenu*`, slot trigger, `items`
  với `to`/`onSelect`, focus trở về trigger khi đóng), `BoDialog.vue` (Reka `Dialog*`, `title`, slot, focus trap);
  test `BoSelect.test.ts` (chọn bằng bàn phím), `BoMenu.test.ts` (Esc đóng, focus trả về).
- [X] T029 [P] `BoSkipMenu.vue` (Ported ý từ `skip-menu.vue`: hai link `#main-content`, `#navigation`, hiện khi
  focus), `BoAvatar.vue` (ảnh `/assets/<id>?key=system-medium-cover` qua `getAssetUrl`, fallback icon `account_circle`
  như `module-bar-avatar.vue` (spec "Làm rõ từ checklist release-gate"), `alt` tên); `utils/get-asset-url.ts` (Ported, dùng `apiUrl`), `utils/jwt-payload.ts` (Ported), `utils/translate-object-
  values.ts` (Ported), `utils/markdown.ts` (`marked` + `dompurify`, chỉ cho phép thẻ cơ bản, link `rel=noopener
  target=_blank`); test `utils/get-asset-url.test.ts`, `utils/jwt-payload.test.ts`, `utils/markdown.test.ts` (khử
  `<script>`, `javascript:`); manifest `012-T029.json`.

### Môi trường E2E (để story kiểm được ngay)

- [X] T030 `tests/parity/docker-compose.yml` profile `web` (R10, R13): `backoffice-web` (build `apps/web/Dockerfile`,
  image `hiennd23/backoffice-web:local`, `PUBLIC_URL=/`, port `8180:8080`), `proxy-web-directus` (nginx
  `./proxy/web-directus.conf`, `8161:80`), `proxy-web-api` (`./proxy/web-api.conf`, `8162:80`),
  `backoffice-api-web-cors` (image api local, env `postgres.env` + `profile-web-cors.env`, `8163:8055`),
  `backoffice-web-cors` (`PUBLIC_URL=http://127.0.0.1:8163`, `8181:8080`); healthcheck như các dịch vụ khác;
  `depends_on` directus healthy. File `tests/parity/proxy/web-directus.conf`, `web-api.conf` (location `/admin/` →
  `backoffice-web:8080`, `/` → upstream; `proxy_set_header Host`, `X-Forwarded-*`). `tests/parity/env/profile-web-cors.env`
  (`CACHE_NAMESPACE=parity-web-cors`, `PUBLIC_URL=http://127.0.0.1:8163`, `CORS_ENABLED=true`,
  `CORS_ORIGIN=http://localhost:8181`, `CORS_CREDENTIALS=true`, `SESSION_COOKIE_SAME_SITE=None`,
  `SESSION_COOKIE_SECURE=true`, `REFRESH_TOKEN_COOKIE_SAME_SITE=None`, `REFRESH_TOKEN_COOKIE_SECURE=true`,
  `ACCESS_TOKEN_TTL=30s` để kiểm SC-004 trong thời gian CI, CHK047).
  `tests/parity/scripts/env.mjs`: `web` vào `ALL_PROFILES`; khi `--profiles` có `web` và chưa có image web local thì
  in hướng dẫn build. `tests/parity/README.md` bảng profile thêm `web`.
- [X] T031 [P] `apps/web-e2e/playwright.config.ts`: đọc `E2E_CONFIG` (`proxy-directus` | `proxy-api` | `cors` |
  không đặt = dev), `BASE_URL`; projects `chromium-768`, `chromium-1280`, `firefox-768`, `firefox-1280`, `webkit-768`,
  `webkit-1280` (viewport `768×1024`, `1280×800`); với `cors` chỉ `chromium-1280`; project `msedge-1280` khi
  `PLAYWRIGHT_MSEDGE=1` (`channel: 'msedge'`); `workers: 1`, `timeout 120_000`, trace on failure. `apps/web-e2e/src/
  helpers/`: `api.ts` (gọi API admin bằng `request` fixture với `apiUrl` của cấu hình: login JSON mode lấy token,
  tạo/xóa user, role, policy, share, PATCH settings, upload file), `config.ts` (`apiUrl`, `directusUrl`, `webUrl`,
  `isCors` từ env), `requests.ts` (fixture `test` mở rộng: ghi `page.on('request')` và sau mỗi test khẳng định mọi
  path thuộc danh sách của `contracts/api-calls.md` (32 route, kể cả `POST /utils/resolve-redirect` và `PATCH /users/me/track/page`) chép vào
  `helpers/allowed-paths.ts`, và fail khi có `pageerror`, `console.error` hoặc cảnh báo khóa dịch thiếu (CHK083)), `tokens.ts` (ký JWT invite
  và password-reset bằng `SECRET` của `tests/parity/env/postgres.env`, payload như Directus `services/users.ts`
  `inviteUser` và `requestPasswordReset`; dùng `jsonwebtoken` catalog), `login.ts` (điền form app Backoffice),
  `db-rows.ts` (chép từ `tests/directus-app-e2e/src/helpers/db-rows.ts` ghi nguồn). Xóa `src/smoke.spec.ts` (ping
  không còn), thay bằng `src/smoke.spec.ts` mới: mở `/admin/` → chuyển `/admin/login`, có tiêu đề `Sign in ·
  Backoffice`.
- [X] T032 Chạy thử nền: build image web, `env-up --vendor=postgres --profiles=app,setup,sso,web`, chạy
  `smoke.spec.ts` ở ba cấu hình (quickstart); sửa compose/proxy tới khi xanh. Ghi cổng thực tế vào README nếu đổi.

**Checkpoint**: `web:test` xanh (ngưỡng 60% luôn bật trong `vitest.shared.ts`; mỗi task Phase 2 kèm test của chính
nó nên ngưỡng phải giữ ngay; nếu một task làm coverage tụt tạm thì task kế tiếp trong cùng nhóm [P] phải bù trước
khi sang nhóm khác); E2E smoke xanh ba cấu hình.

---

## Phase 3: User Story 1 - Đăng nhập local, TFA và giữ phiên (Priority: P1) 🎯 MVP

**Goal**: `/admin` → `/login`, đăng nhập email + mật khẩu (+OTP), vào app, giữ phiên qua reload và hết hạn access
token, hết phiên về login với lý do, đăng xuất; ép `/tfa-setup`; user không `app_access` thấy màn riêng.

**Independent Test**: `apps/web-e2e/src/login.spec.ts` ở ba cấu hình; so dòng `directus_sessions`.

- [X] T033 [P] [US1] `apps/web/src/layout/PublicView.vue` (viết mới theo `public-view.vue`, contracts/ui-routes §5:
  cột trái logo (`project_logo` → `/assets`, else `logo-light/dark.svg` theo `html.dark`; nền `project_color`), tên,
  mô tả, slot, slot `notice`; cột phải nền ảnh/video/hoa văn token, `public_foreground`, `public_note` qua
  `utils/markdown`; hai cột từ `sm` (576 px) như Directus nên luôn hai cột ở 768 px trở lên); `layout/PublicView.test.ts` (3 nhánh logo, note khử HTML,
  video `muted autoplay loop playsinline`).
- [X] T034 [P] [US1] `apps/web/src/routes/login/LoginForm.vue` (email, password, OTP hiện khi `INVALID_OTP`, nút
  `sign_in` loading, link `forgot_password` → `/reset-password`, lỗi qua `translateAPIError` trong `BoNotice`
  `role=alert`, giữ email/password khi hiện OTP, `autocomplete` đúng), `routes/login/ContinueAs.vue` (tên user, nút
  `continue_as`, link `sign_out`); test `routes/login/LoginForm.test.ts` (gửi đúng payload qua `login`, INVALID_OTP
  → ô OTP, lỗi khác → notice, Enter gửi).
- [X] T035 [US1] `apps/web/src/routes/login/LoginRoute.vue` (Ported logic từ `login.vue`: `driver`/`provider` từ
  `providerOptions`, `BoSelect` khi > 1, `ContinueAs` khi `authenticated`, `LoginForm` cho `default`/`local`,
  `LdapForm` và `SsoLinks` cắm ở US4 (tạm slot trống), notice `authenticated`/`not_authenticated`/
  `logoutReason.<reason>`, link `/register` khi `public_registration`, `useHead({ title: t('sign_in') })`, xử lý
  `?continue` (gọi `refresh` rồi về `last_page`), `?redirect` qua `useSafeRedirect`); `composables/use-safe-redirect.ts`
  (Ported); test `routes/login/LoginRoute.test.ts` (select hiện khi >1, `?continue`, `?reason`); manifest `012-T035.json`.
- [X] T036 [P] [US1] `apps/web/src/routes/LogoutRoute.vue` (gọi `logout()` on mount, `BoProgressCircular`),
  `routes/TfaSetupRoute.vue` + `composables/use-tfa-setup.ts` (Ported: bước mật khẩu → `POST /users/me/tfa/generate`
  → QR bằng `qrcode.toDataURL(otpauth_url)` + `secret` dạng chữ → OTP → `POST /users/me/tfa/enable` → `redirect`
  an toàn hoặc `last_page`; `authenticated === false` → `/login`); test `routes/TfaSetupRoute.test.ts` (3 bước, lỗi mật
  khẩu sai); manifest `012-T036.json`.
- [X] T037 [P] [US1] `apps/web/src/layout/NoAppAccess.vue` (thông điệp `no_app_access_copy`? dùng khóa Directus
  `no_app_access` + `no_app_access_copy`, nút `sign_out`) và `modules/ModulePlaceholder.vue` tối thiểu (tiêu đề module,
  `module_placeholder`; bố cục đầy đủ ở US2) để guard có đích sau đăng nhập; `routes/PrivateNotFoundRoute.vue` tối
  thiểu; test `layout/NoAppAccess.test.ts`.
- [X] T038 [US1] Gắn vào `App.vue`: `RouterView` trong `PublicView`/`PrivateView` do route tự chọn; màn `hydrating`
  (`BoProgressCircular` toàn màn, `aria-busy`), màn lỗi (`unexpected_error`, `unexpected_error_copy`, chi tiết lỗi
  trong `<pre>`, nút `reload_page`); `App.test.ts` (3 trạng thái).
- [X] T039 [US1] `apps/web-e2e/src/login.spec.ts` (contracts/e2e §2): đúng/sai mật khẩu; TFA (tạo user có `tfa_secret`
  qua API: `POST /users` rồi `POST /users/me/tfa/generate|enable` bằng token user, OTP tính bằng `otplib` thêm vào
  `apps/web-e2e/package.json` từ catalog); `suspended`; không `app_access` (policy không `app_access`) → màn riêng +
  đăng xuất; `?redirect=/settings/project` nội bộ và `?redirect=https://evil.test` bị bỏ; reload giữ phiên; hết hạn:
  xóa dòng `directus_sessions` qua `db-rows` → tab ẩn rồi hiện lại → `/login?reason=SESSION_EXPIRED`, tải lại → `/login?redirect=` không lý do (như Directus, FR-001); đăng xuất → dòng session
  mất, `?reason=SIGN_OUT`; `enforce_tfa` role → `/tfa-setup` hoàn tất rồi về route. Chạy ba cấu hình; ghi chú lệch
  nếu có vào "Ghi chú khi làm".
- [X] T040 [US1] Kiểm coverage và lint sau US1: `pnpm nx run web:test` đạt ≥ 60% (không hạ ngưỡng); `web:lint` 0 lỗi
  `no-raw-color`.

**Checkpoint**: Đăng nhập, giữ phiên, đăng xuất chạy với Directus thật và API mới; E2E login xanh ba cấu hình.
Đợt commit A có thể gồm Phase 1–3 nếu muốn MVP sớm (plan ghi A = Phase 1, 2).

---

## Phase 4: User Story 2 - Bố cục và điều hướng giữa các module (Priority: P2 trong thứ tự làm, P1 trong spec)

**Goal**: bố cục bốn vùng, thanh module theo `module_bar` và quyền, sáu route module với khung, gập mở lưu
localStorage, `last_page`, 404 private, màn lỗi API.

**Independent Test**: `apps/web-e2e/src/navigation.spec.ts` với admin, user hạn chế; so với Directus app.

- [X] T041 [P] [US2] `apps/web/src/layout/stores/sidebar.ts`, `nav-bar.ts` (Ported, key `backoffice-sidebar-collapsed`,
  `backoffice-sidebar-size`, `backoffice-nav-bar-collapsed`, `backoffice-nav-bar-size`; `useLocalStorage` bọc try/catch
  khi storage bị chặn → giá trị mặc định trong bộ nhớ), `composables/use-media-query.ts` (`useMediaQuery` của vueuse
  cho `lg`, `xl`); test `layout/stores/sidebar.test.ts`, `nav-bar.test.ts`; manifest `012-T041.json`.
- [X] T042 [P] [US2] `apps/web/src/layout/ModuleBar.vue` (logic Ported từ `module-bar.vue`: `module_bar` ??
  `MODULE_BAR_DEFAULT`, lọc `enabled` và `registeredModules`, bỏ mục `type: 'link', id: 'docs'` có
  `url === DIRECTUS_DOCS_URL` (FR-081, D-49), link nội bộ/ngoài (`target=_blank rel=noopener`),
  Settings cuối cho admin; nút `BoButton icon` + `BoTooltip`, `aria-current="page"` + dấu đậm khi active, `nav
  aria-label="modules"`), `layout/ModuleBarLogo.vue` (Ported: `project_logo` hoặc `logo-light.svg`, link `project_url` chỉ khi scheme
  http(s) (FR-026),
  `BoProgressLinear` khi `queueHasItems`), `layout/ModuleBarAvatar.vue` (`BoAvatar` + `BoMenu`: `profile` → `/users/me`,
  `sign_out` → `/logout`); test `layout/ModuleBar.test.ts` (null → mặc định, thứ tự, enabled, link, settings cuối,
  id lạ bị bỏ, `docs` mặc định bị ẩn cả khi có trong `module_bar` đã lưu, `docs` đổi `url` vẫn hiện),
  `layout/ModuleBarLogo.test.ts` (gồm ca `project_url` `javascript:` bị bỏ); manifest
  `012-T042.json`.
- [X] T043 [P] [US2] `apps/web/src/layout/NavBar.vue` (`aside id="navigation"`, `ProjectName.vue` (tên `project_name`
  || `Backoffice`), slot, gập mở, drawer dưới `lg` dùng Reka `Dialog` modal (focus trap,
  Esc đóng, nút đóng có `aria-label`)), `layout/HeaderBar.vue` (nút mở nav dưới `lg` `aria-label open_navigation`, `BoIcon`,
  `h1` tiêu đề, slot actions, nút mở sidebar), `layout/MainContent.vue` (`main id="main-content" tabindex=-1`),
  `layout/Sidebar.vue` (Reka `Collapsible`, `aside aria-label`, slot, nút gập), `layout/ResizeHandle.vue` (kéo đổi
  `size`, bàn phím mũi tên ±16 px, `role=separator aria-orientation=vertical`); test `layout/HeaderBar.test.ts`,
  `layout/Sidebar.test.ts`.
- [X] T044 [US2] `apps/web/src/layout/PrivateView.vue` (ghép: `BoSkipMenu`, `ModuleBar`, `NavBar`, `HeaderBar`,
  `MainContent`, `Sidebar`; `NoAppAccess` khi `app_access === false`; props `title`, `icon`; slots `navigation`,
  `actions`, `sidebar`; `useHead({ title })`; grid 3 cột ≥ `xl`, sidebar gập ≥ `lg`, drawer < `lg`; không cuộn
  ngang), `modules/ModulePlaceholder.vue` hoàn thiện (icon, tên module, empty state `module_placeholder` với `BoIcon`),
  `routes/PrivateNotFoundRoute.vue` hoàn thiện (trong `PrivateView`, `page_not_found`); test
  `layout/PrivateView.test.ts` (3 breakpoint bằng mock `useMediaQuery`, no app access).
- [X] T045 [US2] `apps/web/src/theme/use-app-head.ts` phần tiêu đề (Ported từ `app.vue` `useHead`: `titleTemplate
  '%s · %projectName'`, `projectName` = `project_name` ?? `Backoffice`, `htmlAttrs lang/dir`); gọi ở `App.vue`; test
  `theme/use-app-head.test.ts` (tiêu đề mặc định và có `project_name`). (Favicon, theme-color, style ở US3.)
- [X] T046 [US2] `apps/web-e2e/src/navigation.spec.ts`: admin mặc định (thứ tự Content, Users, Files, Insights, Settings
  cuối; không có link Documentation, D-49; Visual/Deployments vắng; 6 URL; tiêu đề `<Module> · Backoffice`); `module_bar` tùy
  chỉnh qua `PATCH /settings` (khôi phục `null` sau test); user chỉ đọc `directus_files` (role + policy tạo qua API):
  thiếu Users, Insights, Settings; `/admin/users` → 404 private; `/admin/activity` mở; gập nav/sidebar giữ sau reload
  ở 1280; ở 768 nav là drawer mở/đóng bằng bàn phím; `last_page` ghi sau điều hướng và dùng khi mở `/admin`; 404;
  `page.route` abort `/server/info` → màn lỗi + nút tải lại; `page.route('**/server/info')` trả `{ data: {
  setupCompleted: true } }` không `project` → trang đăng nhập hiện tên `Backoffice`, không màn lỗi (FR-037). So thứ
  tự module với Directus app tại
  `http://127.0.0.1:8160/admin` (profile `app`) trong cùng test (đọc `.module-bar` của Directus) và khẳng định bằng
  nhau sau khi bỏ link Documentation khỏi danh sách của Directus (D-49); `module_bar` tùy chỉnh có mục `docs` với URL
  mặc định → app mới không hiện, Directus app hiện.

**Checkpoint**: Điều hướng giống Directus app ở ba cấu hình; lint, test, coverage xanh.

---

## Phase 5: User Story 3 - Thương hiệu Backoffice và branding từ settings (Priority: P1)

**Goal**: không còn "Directus" trong UI; `project_color`, logo, favicon, nền, ghi chú, `custom_css` từ settings áp như
Directus.

**Independent Test**: `apps/web-e2e/src/branding.spec.ts` với settings mặc định và settings đầy đủ.

- [X] T047 [P] [US3] `apps/web/src/utils/generate-favicon.ts` (Ported từ `generate-favicon.ts`, thay path SVG của
  Directus bằng chữ "B" `/* Q-7 tạm */`), test `utils/generate-favicon.test.ts` (data URL thay đổi theo màu và cờ
  `withLogo`); manifest `012-T047.json`.
- [X] T048 [US3] `apps/web/src/theme/use-app-head.ts` hoàn thiện (Ported phần còn lại của `app.vue`): `style`
  `:root { --project-color: <project_color ?? var(--eh-color-action-primary)> }` với `project_color` được lọc
  (`CSS.supports('color', value)` theo spec "Làm rõ từ checklist release-gate", CHK067: giá trị lạ → màu primary), `meta theme-color`, `msapplication-TileColor`
  (`project_color` ?? giá trị tính `getComputedStyle(document.documentElement).getPropertyValue('--eh-color-action-primary')`),
  `link icon` ba nấc, `style#custom-css` từ `custom_css` (escape `</style`), `html.class dark|light` (T057 cấp
  `darkMode`); test bổ sung `theme/use-app-head.test.ts` (favicon 3 nấc, theme-color 2 nấc, project_color lạ, custom
  css escape).
- [X] T049 [P] [US3] Rà thương hiệu trong mã: `apps/web/src/**` không chứa chuỗi `Directus` ngoài comment `Ported from`
  và `translations/*.json` đã lọc; script `apps/web/scripts/check-brand.mjs` (grep, bỏ qua comment/manifest) chạy
  trong target `lint`; test `scripts/check-brand.test.ts`. `App.vue` không in `DIRECTUS_LOGO` (FR-083).
- [X] T050 [US3] `apps/web-e2e/src/branding.spec.ts`: (a) settings mặc định: ở `/login`, `/content`, `/users/me`
  `document.title` và `body.innerText` không chứa `Directus`, favicon href `/admin/favicon.ico`, logo `img[alt]` là
  `Backoffice`; (b) PATCH settings: upload logo + background + favicon qua `POST /files`, `project_name`,
  `project_descriptor`, `project_color='#336699'` (giá trị test), `public_note` markdown có link, `custom_css`
  (`.e2e-marker{display:none}`), `project_url`: khẳng định logo src `/assets/<id>`, nền logo = màu, `meta[name=
  theme-color]`, `link[rel=icon]` `/assets/<favicon>`, note render `<a>` không `<script>`, css áp (phần tử ẩn), link
  logo thanh module `href=project_url`; (c) chụp ảnh `/login` của app mới và của Directus app (proxy 8160) lưu
  artifact `test-results/branding-*.png` (không so, SC-005 ghi "không chặn"); khôi phục settings và xóa file.

**Checkpoint**: Đợt commit B = Phase 3, 4, 5.

---

## Phase 6: User Story 4 - Đăng nhập LDAP và SSO (Priority: P2)

**Goal**: chọn provider LDAP, nút SSO OpenID/OAuth2, luồng `?continue`, `?error&code`, OTP sau SSO.

**Independent Test**: `apps/web-e2e/src/sso.spec.ts` trên cặp `sso` (IdP giả, OpenLDAP) với cả hai API.

- [X] T051 [P] [US4] `apps/web/src/routes/login/LdapForm.vue` (identifier + password + OTP khi `INVALID_OTP`, gửi
  `login({ credentials: { identifier, password, otp }, provider })`), test `routes/login/LdapForm.test.ts`.
- [X] T052 [US4] `apps/web/src/routes/login/SsoLinks.vue` (Ported logic từ `sso-links.vue`: lọc `AUTH_SSO_DRIVERS`,
  link `${apiUrl}/auth/login/${name}?redirect=${origin}/admin/login?continue`, nhãn `log_in_with` + `label ||
  formatTitle(name)`, icon provider (`BoIcon` theo `icon` hoặc mặc định `login`), lưu `backoffice-sso-provider` khi
  bấm, nhánh `?reason=INVALID_OTP`: làm đúng như `sso-links.vue` dòng 60–140 (đọc trước khi
  code; ghi cách gửi OTP vào research R3); `sessionStorage sso_otp_attempted`), cắm vào `LoginRoute.vue` cùng `LdapForm`; test
  `routes/login/SsoLinks.test.ts` (URL đúng, lọc driver, INVALID_OTP hiện OTP, lỗi `?error&code`); manifest
  `012-T052.json`.
- [X] T053 [US4] Env cặp `sso` thêm CORS và cookie cho cấu hình khác origin: `tests/parity/env/profile-sso.env` thêm
  `CORS_ENABLED=true`, `CORS_ORIGIN=http://localhost:8181`, `CORS_CREDENTIALS=true`, `SESSION_COOKIE_SAME_SITE=None`,
  `SESSION_COOKIE_SECURE=true`, `AUTH_ALLOWED_PUBLIC_URLS=http://localhost:8955/api,http://localhost:8181` (Directus
  chỉ chấp nhận `redirect` thuộc `PUBLIC_URL` hoặc danh sách này; giữ giá trị cũ của 003 để bộ parity `sso` không
  lệch); chạy lại `pnpm nx run parity-tests:parity --vendor=postgres` phần `sso` của 003 và
  xác nhận không lệch (header CORS giống nhau ở hai app vì cùng env); nếu bộ so header bắt `access-control-*`, thêm
  vào danh sách header bỏ qua của `tests/parity/src/...` với ghi chú feature 012.
- [X] T054 [US4] `apps/web-e2e/src/sso.spec.ts`: với `page.route('**/admin/config.json')` trỏ `apiUrl` cặp `sso`
  (`http://127.0.0.1:8955` Directus, `8956` API mới; ở cấu hình `cors` web `localhost:8181`): select có `Default`,
  `Local2`, `Ldap`; LDAP login với user fixture của 003 (`tests/parity/src/auth/sso-ldap.test.ts` cho tên user, mật
  khẩu); OIDC: bấm nút → IdP giả (`tests/parity/idp/server.mjs` trang chấp thuận) → về `?continue` → trong app;
  `oauthmock` (mode `json`: đo hành vi app Directus với provider `MODE=json` và khẳng định app mới giống: ghi vào
  research R3); `?error&code=INVALID_PROVIDER` hiện lỗi dịch; INVALID_OTP sau SSO (user OIDC bật TFA qua API). Chạy ở
  `proxy-directus`? Cặp `sso` không nằm sau proxy: spec chạy ở cấu hình `cors` với hai `apiUrl` (Directus sso, API sso);
  ghi rõ trong file.

---

## Phase 7: User Story 5 - Quên mật khẩu, đặt lại, nhận lời mời, setup, share (Priority: P2)

**Goal**: bốn màn public còn lại với dòng liên hệ admin, `/setup` trên DB rỗng, đăng nhập share.

**Independent Test**: `apps/web-e2e/src/password-invite.spec.ts`.

- [X] T055 [P] [US5] `apps/web/src/routes/reset-password/ResetPasswordRoute.vue`, `RequestForm.vue` (`POST
  /auth/password/request`, notice `password_reset_sent` + `contact_admin_for_link`, link `/login`), `ResetForm.vue`
  (`?token=`, mật khẩu mới, `POST /auth/password/reset`, notice thành công, nút `sign_in`); test
  `routes/reset-password/ResetPasswordRoute.test.ts` (2 nhánh, dòng liên hệ, lỗi dịch).
- [X] T056 [P] [US5] `apps/web/src/routes/AcceptInviteRoute.vue` (Ported logic từ `accept-invite.vue`: email từ
  `jwtPayload(token).email` (token không parse → notice lỗi + `contact_admin_for_link`), `BoInput` email disabled,
  mật khẩu, `POST /users/invite/accept`, `account_created_successfully`, nút `sign_in`); `routes/RegisterNotAvailableRoute.vue`
  (`PublicView`, `register_not_available`, link `/login`); test `routes/AcceptInviteRoute.test.ts`; manifest
  `012-T056.json`.
- [X] T057 [P] [US5] `apps/web/src/routes/SetupRoute.vue` (Ported logic từ `routes/setup/setup.vue`: đọc field và
  payload `POST /server/setup` như Directus (đo file), sau đó `login` với email/mật khẩu vừa tạo; đã `setupCompleted`
  → `/login`); test `routes/SetupRoute.test.ts`; manifest `012-T057.json`.
- [X] T058 [US5] `apps/web/src/routes/SharedRoute.vue` (Ported logic từ `routes/shared/shared.vue` phần đăng nhập:
  `GET /shares/info/:id`, notice `usesLeft`, form mật khẩu nếu `password`, `login({ share: true, credentials: { share,
  password } })`, sau đó `router.push('/content/<collection>/<item>')` (khung module), `share_access_not_found`,
  hết hạn/hết lượt theo lỗi API); test `routes/SharedRoute.test.ts` (4 nhánh); manifest `012-T058.json`.
- [X] T059 [US5] Env cặp `setup` thêm CORS/cookie như T053 (`tests/parity/env/profile-setup.env` hoặc file env của cặp
  setup); chạy lại bộ `setup` của 010 xác nhận không lệch.
- [X] T060 [US5] `apps/web-e2e/src/password-invite.spec.ts`: quên mật khẩu (notice + dòng liên hệ admin; với API mới
  kiểm log container có dòng cảnh báo bằng `docker logs` qua `child_process` khi `E2E_CONFIG !== 'proxy-directus'`);
  đặt lại với token ký bởi `helpers/tokens.ts` rồi đăng nhập bằng mật khẩu mới; mời user qua `POST /users/invite`
  (API mới và Directus đều không gửi mail trong env), token ký lại, nhận lời mời, đăng nhập; token hỏng → notice lỗi +
  dòng liên hệ; `/setup` với `apiUrl` cặp `setup` (`page.route config.json`): tạo admin, vào app; share: tạo share có
  mật khẩu qua API cho một item của collection test, mở `/admin/shared/<id>`, sai mật khẩu → lỗi, đúng → URL
  `/admin/content/...` khung.

**Checkpoint**: Đợt commit C = Phase 6, 7, 8.

---

## Phase 8: User Story 6 - Hồ sơ, theme sáng tối, ngôn ngữ (Priority: P2)

**Goal**: `/users/me` sửa tên, email, mật khẩu, avatar, ngôn ngữ, giao diện, overrides; theme và ngôn ngữ áp ngay.

**Independent Test**: `apps/web-e2e/src/profile.spec.ts`.

- [X] T061 [P] [US6] `apps/web/src/theme/override-map.ts` (R2, `/* Q-6 tạm */`): `OVERRIDE_MAP`, `overridesToCss(overrides,
  scope)` → chuỗi `:root{...}` / `:root.dark{...}`; bỏ khóa không ánh xạ và giá trị chứa `var(--theme--` hay ký tự
  ngoài `/^[#a-zA-Z0-9(),.%\s"'-]+$/` (CHK060, CHK077) với `console.warn` một lần mỗi khóa; test
  `theme/override-map.test.ts` (12 ca).
- [X] T062 [US6] `apps/web/src/theme/use-theme-configuration.ts` (Ported từ `use-theme-configuration.ts`: `appearance`,
  `darkMode` theo `prefers-color-scheme` khi `auto`, merge overrides user lên settings), nối vào `use-app-head.ts`
  (`html.class`, `<style id="theme-overrides">` từ `overridesToCss`); test `theme/use-theme-configuration.test.ts`
  (3 nguồn appearance, đổi media query, merge); manifest `012-T062.json`.
- [X] T063 [US6] `apps/web/src/routes/ProfileRoute.vue` (`PrivateView` title `profile`; form `BoInput` first_name,
  last_name, email, password (type password, trống), `BoAvatar` + `input type=file` → `POST /files` (multipart qua
  `sdk.request(uploadFiles(formData))`) → `avatar`, `BoSelect` language (từ `available-languages.json`), `BoSelect`
  appearance (`auto|light|dark` nhãn `$t`), hai `textarea` JSON overrides (parse khi lưu, lỗi gắn field); lưu: diff với
  `currentUser` → `PATCH /users/me` chỉ field đổi → `userStore.hydrate()` → `setLanguage` nếu `language` đổi; lỗi
  `FAILED_VALIDATION`/`RECORD_NOT_UNIQUE` gắn field theo `extensions.field`; nút lưu loading); test
  `routes/ProfileRoute.test.ts` (diff, chỉ field đổi, lỗi gắn field, JSON sai).
- [X] T064 [US6] `apps/web-e2e/src/profile.spec.ts`: đổi tên (thấy ở menu avatar); email trùng admin → lỗi; đổi mật
  khẩu → đăng xuất → đăng nhập mật khẩu mới (khôi phục cuối test); `language=vi-VN` → nhãn module tiếng Việt ngay và
  sau reload; `appearance=dark` → `html.dark`; `auto` + `page.emulateMedia({ colorScheme })` đổi theo; overrides
  `{"primary":"#aa0000"}` (giá trị test) → `getComputedStyle(root).getPropertyValue('--eh-color-action-primary')`
  đổi; dòng `document.body.innerText` không có khóa thô dạng `^[a-z_]+$` ở hai ngôn ngữ (SC-006).

---

## Phase 9: User Story 7 - Ba cấu hình, request allowlist, hiệu năng, CI (Priority: P2)

**Goal**: toàn bộ E2E chạy ba cấu hình trên ba engine ở CI; không request ngoài danh sách; màn đăng nhập < 3 s.

**Independent Test**: job `e2e-web` xanh.

- [ ] T065 [US7] `apps/web-e2e/src/requests.spec.ts` + fixture `helpers/requests.ts` áp cho mọi spec (import `test` từ
  helper): sau mỗi test khẳng định mọi URL tới `apiUrl` khớp `allowed-paths.ts`; thêm ca riêng: đăng nhập + 6 module +
  hồ sơ → chỉ các path #1–#30; khẳng định không có request tới `/websocket`, `/extensions`, `/graphql`, `/items`.
  `apps/web-e2e/src/a11y.spec.ts` (FR-067): quét `AxeBuilder` với tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` trên
  `/login`, `/reset-password`, `/accept-invite`, `/tfa-setup`, `/content`, `/users/me`, 404, ở theme sáng và tối;
  không có vi phạm `serious`/`critical` ngoài rule `color-contrast` trên đúng các phần tử dùng cặp token Q-8 (lọc theo
  selector, ghi lý do); ca bàn phím: Tab từ đầu trang đăng nhập điền form, Enter đăng nhập, Tab tới thanh module, Enter
  mở Files, mở menu avatar bằng Enter, Esc đóng và focus về nút avatar, chọn đăng xuất; mỗi bước khẳng định
  `document.activeElement` và focus nhìn thấy được.
- [ ] T066 [US7] `apps/web-e2e/src/perf.spec.ts` (chromium): CDP `Network.emulateNetworkConditions` 10 Mbps, cache
  tắt, đo từ `goto('/admin/login')` tới form visible < 3000 ms; bundle: đọc `dist/` sau build và khẳng định chunk chính
  gzip ≤ 350 KB (script `apps/web/scripts/check-bundle.mjs` chạy ở target `web:check-bundle` sau `build`; test
  `apps/web/scripts/check-bundle.test.mjs` với dist giả); không cuộn ngang: `document.documentElement.scrollWidth <= innerWidth` ở 768 và 1280
  trên `/login`, `/content`, `/users/me`.
- [ ] T067 [US7] `.github/workflows/ci.yml`: job `e2e-web` thay `e2e` (`needs: docker`; tải artifact `images`, tag
  `hiennd23/backoffice-web:local`, `backoffice-api:local`; `env-up --vendor=postgres --profiles=app,setup,sso,web`;
  `playwright install --with-deps chromium firefox webkit`; ba bước `web-e2e:e2e` với `E2E_CONFIG`/`BASE_URL`; upload
  `apps/web-e2e/test-results` và log compose khi lỗi; `env-down`); `publish.needs` thêm `e2e-web`; `quality` đã chạy
  `web:lint` (gồm `no-raw-color`, `check-brand`), thêm `web:check-bundle`. Đẩy lên `main` và xem `gh run watch`; sửa
  tới khi xanh (memory: workflow merge main).
- [ ] T068 [US7] `apps/web/README.md` (mới): cấu hình `PUBLIC_URL`/`config.json`, chạy cùng origin sau proxy và khác
  origin với bảng biến API bắt buộc (FR-075: `CORS_ENABLED`, `CORS_ORIGIN`, `CORS_CREDENTIALS`,
  `SESSION_COOKIE_SAME_SITE=None`, `SESSION_COOKIE_SECURE=true`, cần HTTPS ngoài localhost), lệnh sync dịch, lệnh
  E2E ba cấu hình (quickstart).

---

## Phase 10: Polish & đóng feature

- [ ] T069 [P] Manifest và header: mọi `tools/port-manifest/012-T*.json` đủ; `node tools/check-port-headers.mjs`,
  `node tools/guard-directus-unchanged.mjs` xanh.
- [ ] T070 [P] Cập nhật research.md với kết quả thực tế của T002, T004, T019, T052 (OTP sau SSO), T054 (mode json),
  T015 (query notifications); cập nhật `contracts/api-calls.md` #26 và `contracts/ui-routes.md` nếu lệch.
- [ ] T071 [P] `specs/012-backoffice-web-shell/spec.md`: mục "Ghi chú khi làm" (lệch phát hiện, cách xử lý), trạng
  thái `Done` và dòng "Duyệt khác biệt" khi tech lead duyệt D-39 đến D-48 (quy trình không PR: ghi ngày duyệt);
  `checklists/release-gate.md` đánh dấu mục đã xử lý.
- [ ] T072 [P] `CLAUDE.md` mục Recent Changes thêm dòng 012; `SPECKIT-GUIDE.md` không sửa prompt (giữ); memory cá
  nhân cập nhật trạng thái dự án (012 Done) sau khi CI xanh.
- [ ] T073 `graphify update .` sau khi code xong (CLAUDE.md), commit `graphify-out/` nếu thay đổi.
- [ ] T074 Kiểm cuối: `pnpm nx run-many -t lint typecheck test build --projects=web,web-e2e`; E2E ba cấu hình xanh;
  `web:test` coverage ≥ 60% in ra; không hex thô (`web:lint`); `git status` sạch trên `main`.
- [ ] T075 Phiên dùng thử SC-003 sau khi CI xanh (không chặn đóng feature): 5 người dùng nội bộ quen Directus làm
  nhiệm vụ "đăng nhập, mở Files, mở Settings, mở hồ sơ, đăng xuất" không hướng dẫn trên môi trường `proxy-api`;
  ghi thời gian từng người và vướng mắc vào mục "Ghi chú khi làm" của `specs/012-backoffice-web-shell/tasks.md`.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (US5) → Phase 8
  (US6) → Phase 9 (US7) → Phase 10.
- US2, US3 phụ thuộc US1 (cần đăng nhập để vào bố cục). US4, US5 chỉ phụ thuộc Phase 2 và `PublicView` (T033), có
  thể làm song song với US2, US3 bởi người khác. US6 phụ thuộc US2 (PrivateView) và T048 (head). US7 phụ thuộc mọi
  spec E2E.
- Trong phase: task [P] cùng nhóm làm song song; task không [P] theo thứ tự ID.

## Parallel Execution Examples

- Phase 1: T003, T004, T005, T006, T007, T008, T009, T010 song song sau T001.
- Phase 2: T012–T015 song song; T016 → T017/T018; T020 sau T011, T012; T021 song song T020; T026–T029 song song;
  T030, T031 song song với nhóm component.
- Phase 3: T033, T034, T036, T037 song song; T035 sau T033, T034; T038 sau T035, T037; T039 cuối.
- Phase 4: T041, T042, T043 song song; T044 sau cả ba; T045 song song T044; T046 cuối.
- Phase 6, 7: T051 ∥ T052; T055 ∥ T056 ∥ T057; T053 ∥ T059.

## Implementation Strategy

- MVP = Phase 1–3: đăng nhập, phiên, đăng xuất với hai API (tiêu chí chấp nhận thứ nhất). Có thể commit đợt A sau
  Phase 3 nếu cần demo sớm.
- Mỗi phase đóng bằng lint, typecheck, test, build; cuối mỗi đợt commit chạy E2E ba cấu hình trước khi push `main`
  và theo dõi CI bằng `gh run watch`.
- Giá trị tạm Q-1 đến Q-7: khi design owner trả lời, chỉ sửa `tokens.css`, `override-map.ts`, `logo-*.svg`; không
  mở lại task.

## Ghi chú khi làm

(Điền trong lúc implement: lệch với Directus app, kết quả kiểm [Unverified], quyết định nhỏ.)

Đợt A (2026-10-14):

- T002, T004, T019: kết quả ghi ở research R1, R3, R7, R8 (mọi gói có trên npm; export Reka UI đúng tên; cookie
  `SameSite=None; Secure` qua HTTP giữa `localhost` và `127.0.0.1` đạt trên chromium 151).
- T007: gói `material-symbols` chỉ có font variable 5,4 MB nên dùng `@material-symbols/font-400` (Rounded 572 KB);
  Noto Sans lấy từ `@fontsource/noto-sans` (OFL) thay vì tải tay woff2 (research R8).
- T009: kiểm màu thô viết thành script `tools/check-raw-colors.mjs` (+ test) chạy trong `web:lint`, thay rule ESLint:
  ESLint không đọc `.css` và khối `<style>` (FR-092 cho phép "lint rule hoặc script").
- T003: không dùng `manualChunks`; route và module import động đã tách chunk public, private, module (R12). Đo kích
  thước bundle ở T032/perf.
- `@directus/format-title` thêm vào `ALLOWED_DIRECTUS_PACKAGES` của `tools/check-package-names.mjs` (thư viện bên thứ
  ba như `@directus/sdk`).
- Pinia 3 bỏ dạng `defineStore({ id, ... })` của Directus: store chép dùng `defineStore('id', { ... })`, logic giữ.
- Lệch tài liệu với Directus 11.17.4 (đọc mã nguồn):
  - `trackPage` gọi `PATCH /users/me/track/page`, không phải `PATCH /users/me`: đã sửa spec FR-018, SC-009, US2-5 và
    contracts/api-calls (#14, #32). API mới có route này.
  - `api.ts` của Directus 11.17.4 KHÔNG có interceptor `401` → đăng xuất (spec FR-001, US1-5 ghi "như `api.ts`"):
    owner chọn làm như Directus (2026-10-14): bỏ xử lý `401` ở client, phiên mất chỉ phát hiện khi `refresh()` lỗi;
    spec FR-001, US1-5, SC-004, edge case khác origin và contracts đã sửa.
  - `translateAPIError` của Directus trả `unexpected_error` khi không có khóa `errors.<CODE>` (spec FR-012 ghi "hiện
    message gốc"): app làm như Directus; spec cần sửa câu này khi đóng feature.
  - `useSafeRedirect` gọi `POST /utils/resolve-redirect` (đã thêm contracts #31, release-gate CHK023).
- T015: `stores/translations.ts` chỉ có `loadTranslations` như Directus (không `hydrate`); query `/translations` và
  `/presets` theo `fetchAll` của Directus (`limit=-1` hoặc phân trang theo `queryLimit.max`); contracts #25 đã sửa.
- T016: chuỗi giấy phép là "Directus BSL 1.1" với dấu cách không ngắt, nên mẫu giữ là `/Directus\sBSL/`; 7 khóa giữ
  (`directus_bsl`, 3 `theme_directus_*`, 3 chuỗi MCP nhắc `directus_*`); hai mô tả có chữ thường "directus user" không
  đổi (FR-082 chỉ tìm "Directus").
- T018: vue-i18n 11 bỏ `silentTranslationWarn` ở chế độ composition: dùng `missingWarn`/`fallbackWarn` tắt và handler
  `missing` in `[i18n] missing key:` một lần khi khóa không có ở en-US (E2E fail theo dòng này).
- T029: trong happy-dom DOMPurify bỏ sót node sau một `<script>` đã xóa (test markdown tách từng ca); [Inference] lỗi
  của happy-dom, kiểm lại trong trình duyệt thật ở E2E (US3).
- T030: cặp `backoffice-api-web-cors` có bus/lock namespace riêng (`parity-web-cors:*`): spec E2E phải đổi dữ liệu qua
  API của chính cấu hình đó (`AdminApi` với `apiUrl`), thay đổi schema từ cặp chính không tới cache của cặp này.
- T031: smoke tạm khẳng định URL `/admin/login` và tiêu đề chứa "Backoffice"; tiêu đề `Sign In · Backoffice` kiểm ở
  `login.spec.ts` khi head có (T039). Route #5 cho phép thêm `/auth/login/:provider/callback` (trình duyệt đi qua
  IdP, không phải request của app). ESLint của `apps/web/src` dùng `globals.browser`.
- T032: `env-up --profiles=app,setup,sso,web` lên trong 1 phút 49 giây (image API dùng lại); smoke và helpers.spec đạt
  ở `proxy-directus`, `proxy-api` (chromium 768, 1280) và `cors` (chromium 1280). Firefox, WebKit chưa chạy local
  (máy chỉ có chromium); chạy ở job CI `e2e-web` (đợt C). Bundle chính 126 KB gzip (R12: ≤ 350 KB).

Đợt B (2026-10-14):

- D-51 (owner chọn): DB do Directus tạo luôn có `project_name = 'Directus'`, `project_color = '#6644FF'` (mặc định
  cột, API không cho null), nên "DB mới" của US3-1/SC-005 không bao giờ có `project_name` trống; server store coi hai
  giá trị này là chưa đặt (`withoutDirectusDefaults`), chỉ khi hiển thị. `check-brand.mjs` bỏ qua dòng có
  `brand-allowed:`.
- US2-3 sửa: user chỉ đọc `directus_files` có thanh module giống Directus app với cùng user (E2E so trực tiếp); 404
  kiểm bằng `/admin/insights`.
- Directus 11 giữ dòng `directus_sessions` cũ (grace period sau refresh) nên E2E kiểm đăng xuất bằng `/auth/refresh`
  với cookie của trang thay vì đếm dòng.
- Môi trường parity chạy `CACHE_ENABLED`: `/users/me` (và `last_page`) có thể trả từ cache; E2E xóa cache data
  (`POST /utils/cache/clear`) trước khi kiểm `last_page`. Directus app cũng chịu hành vi này.
- Role `enforce_tfa` cần quyền `update` `directus_users.tfa_secret` của chính user, nếu không `POST
  /users/me/tfa/enable` trả 403 ở cả hai API (fixture `ownTfa`).
- Dưới `lg` thanh module nằm trong drawer điều hướng như Directus; helper E2E `moduleBar()` mở drawer khi cần.
- `PublicView` hiện cột phải từ `sm` (576 px) như Directus; `?continue` xử lý ở `ContinueAs` như Directus
  (`login.vue` không xử lý); `?redirect` ở `/login` đi thẳng `router.push` (FR-013), `useSafeRedirect` chỉ ở
  `/tfa-setup`. Nút "Sign Out" của màn không có quyền vào app là link `/logout` (Directus: `switch_user`).
- Thanh module: lọc `enabled` chỉ áp cho module như Directus (link luôn hiện); `module_bar` đã lưu dùng nguyên thứ tự.
- Menu avatar: hồ sơ + đăng xuất (FR-024), không có hộp xác nhận đăng xuất như Directus; `/users/me` tạm dùng
  `ModulePlaceholder` tới US6.
- E2E đợt B chạy local: chromium 768 + 1280 ở `proxy-api`, `proxy-directus`, chromium 1280 ở `cors`: 21/21 đạt mỗi
  lượt. Firefox, WebKit chạy ở CI (đợt C).

Đợt C (2026-10-14):

- T053: Directus kiểm `redirect` của SSO theo `PUBLIC_URL` hoặc `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST` (không phải
  `AUTH_ALLOWED_PUBLIC_URLS` như task ghi); `AUTH_ALLOWED_PUBLIC_URLS` chọn URL callback theo origin của request. Env
  `sso` thêm `CORS_*`, `SESSION_COOKIE_SAME_SITE=None`, `SESSION_COOKIE_SECURE=true`, `AUTH_ALLOWED_PUBLIC_URLS` thêm
  `http://127.0.0.1:8956` (callback về đúng API mới), `AUTH_OIDC_REDIRECT_ALLOW_LIST` và
  `AUTH_OAUTHMOCK_REDIRECT_ALLOW_LIST` = `http://localhost:8181/admin/login`. Triển khai khác origin cần các biến này
  (tài liệu triển khai, FR-075). Bộ parity sso của 003 chạy lại: chỉ `providers.test.ts` OPTIONS đổi (CORS trả preflight
  204 ở cả hai app trước khi định tuyến), test sửa theo; `setup.test.ts` "without project_owner" lệch `project_status`
  local cả khi bỏ thay đổi env (không do 012, theo dõi ở CI).
- T054: SSO E2E chỉ chạy ở cấu hình `cors`; bước authorize của IdP chạy trong test (route trên `GET
  /auth/login/oidc` của API, IdP 127.0.0.1:6110), trình duyệt nhận redirect tới callback. User SSO/LDAP được tạo sẵn;
  đồng bộ user info đưa user về `AUTH_*_DEFAULT_ROLE_ID`, fixture `fixedRole` tạo role đó khi thiếu và gắn policy
  app_access. API Directus trả lỗi SSO bằng `?reason=<CODE>` (không phải `?error&code`), app xử lý cả hai.
- T060: `/setup` E2E chạy với API mới của cặp `setup` (10456) ở cấu hình `cors`, DB setup dọn lại sau test (Directus
  `/server/setup` đã có ở bộ parity 010). Màn setup bỏ bước license BSL của Directus (payload không có `license`; cả
  hai API không đọc), cần owner xác nhận. Lời mời: user `invited` tạo qua `POST /users` (không gọi `/users/invite`
  để Directus không thử gửi mail).
- T062: owner chọn thứ tự gộp override như Directus (`merge({}, user, settings)`, settings thắng); spec US6-4, FR-063
  đã sửa. Scope sáng là `:root.light` (light override không lọt sang theme tối).
- T063/T064: quyền tối thiểu của app trong Directus 11.17.4 không cho user đọc `theme_*_overrides` hay sửa dòng của
  mình: hồ sơ chỉ lưu và áp override khi role có quyền đó (fixture `updateSelf`). Chuỗi vi-VN thiếu ở trang hồ sơ
  (`appearance_*`, `fields.directus_users.appearance`, `theme_*_overrides`, `default_sync_with_project`, `invalid_input`)
  rơi về en-US (FR-062); có thể thêm vào overlay nếu owner muốn.
- CI job `e2e` cũ chỉ chạy `smoke.spec.ts` tới khi job `e2e-web` (Phase 9) có.
- E2E đợt C local: chromium 768 + 1280 ở `proxy-api`, `proxy-directus` (32 đạt, 11 bỏ qua có chủ ý: sso và setup chỉ
  chạy ở `cors`), `cors` 43/43.
