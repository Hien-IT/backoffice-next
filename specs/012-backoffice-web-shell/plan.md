# Implementation Plan: App web Backoffice (khung ứng dụng, đăng nhập, bố cục, điều hướng)

**Branch**: `012-backoffice-web-shell` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-backoffice-web-shell/spec.md`

## Summary

Dựng khung app web Backoffice trong `apps/web` thay cho khung ping của 001: đăng nhập local (TFA), LDAP, SSO
(OpenID, OAuth2), giữ phiên mode `session` qua `@directus/sdk`, đăng xuất, quên mật khẩu, nhận lời mời, setup,
share login, `/tfa-setup`; bố cục Directus (thanh module, nav, header, main, sidebar) với sáu module ở dạng khung;
branding Backoffice và branding từ settings; theme sáng/tối theo token `--eh-*`; chuỗi dịch `en-US`, `vi-VN` sinh từ
Directus; hồ sơ `/users/me`. App chỉ gọi API Directus (32 route, `contracts/api-calls.md`) nên chạy với Directus
thật và API mới chỉ bằng `apiUrl`.

Cách làm:

- Chép logic (router, guard, auth, hydrate, store, composable, utils) từ `directus/app/src` với ghi nguồn; viết mới
  component và bố cục bằng Reka UI 2.8.2 + Tailwind 4 `@theme` trên token design-system (R2, R6, R7).
- Một client: `@directus/sdk` 21.3.0 với `fetch` bọc hàng đợi, `requestsStore` (R3).
- Script sinh chuỗi dịch một lần, commit, overlay cho chuỗi riêng, test chống lệch (R4).
- E2E Playwright ở `apps/web-e2e` với ba cấu hình (proxy → Directus, proxy → API mới, khác site CORS) trên
  chromium, firefox, webkit; profile `web` của `tests/parity` (R9, R10, contracts/e2e.md).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

| Yêu cầu (prompt plan) | Ở feature 012 |
|-----------------------|---------------|
| Node 22, pnpm 10, Nx, `apps/web` Vue 3 script setup TS strict, Vite, Pinia, Vue Router | Giữ như 001; thêm gói ở R1 |
| Reka UI 2.8.2 + Tailwind CSS 4.3, token `--eh-*` qua `@theme`, utility `eh-*`, không hex, không palette | R2; lint `no-raw-color` (R9) |
| Component theo `component-specs.md` | R7: `Bo*` Tier 1, state đủ, label/lỗi liên kết, bàn phím |
| Settings áp lên token như `app.vue` | `--project-color`, override map (R2), `useHead` (contracts/ui-routes.md §6) |
| vue-i18n với file dịch từ `directus/app/src/lang`, đổi Directus → Backoffice | R4: script + JSON commit + overlay |
| Gọi API bằng `@directus/sdk` | R3: client duy nhất |
| Copy composable/utils từ `directus/app/src`, viết lại component bằng Reka UI | R6, R7; manifest `tools/port-manifest/012-T*.json` |
| Vitest + VTU; Playwright với Directus thật và API mới | contracts/e2e.md |
| GitHub Actions, coverage FE 60% | contracts/e2e.md §4 |

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23.3. Trình duyệt: hai bản
ổn định mới nhất của Chrome, Edge, Firefox, Safari (ES2023, CSS `color-mix`, `@property` không cần).

**Primary Dependencies**:
- Đã có (catalog): vue 3.5.43, vite 7.3.0, pinia 3.0.3, vue-router 4.6.3, vue-i18n 11.1.12, @vue/test-utils 2.4.6,
  happy-dom 20.8.9, @playwright/test 1.64.0, vue-tsc 3.1.3, p-queue 8.1.0, lodash-es 4.18.1, date-fns 4.1.0,
  js-yaml 4.3.2.
- Thêm (R1): reka-ui 2.8.2, tailwindcss + @tailwindcss/vite 4.3.x, @directus/sdk 21.3.0, @vueuse/core 14.0.0,
  @unhead/vue 1.11.20, qrcode 1.5.4, marked 16.4.1, dompurify 3.4.17 (Directus 3.3.2; vá GHSA-mrv2-3pqr-j5jr, owner 2026-10-23), mitt 3.0.1, @directus/format-title 12.1.2,
  material-symbols (font, R8).
- Bỏ: axios, ofetch ở app web.

**Storage**: không DB riêng; Pinia + localStorage (`backoffice-*`, data-model §3); cookie phiên do API đặt.

**Testing**: Vitest (happy-dom) coverage ≥ 60%; Playwright `apps/web-e2e` ba cấu hình × (chromium, firefox,
webkit) × (768, 1280); profile `web` của `tests/parity`; `tests/directus-app-e2e` giữ nguyên để đối chiếu.

**Target Platform**: Container nginx tĩnh ở `/admin/` (image 001), một image mọi môi trường (`config.json`);
chạy cùng origin sau reverse proxy hoặc khác origin (CORS, `SameSite=None`).

**Project Type**: Monorepo web (Nx). Chạm `apps/web`, `apps/web-e2e`, `tests/parity` (compose, proxy, env),
CI, catalog pnpm, `tools/eslint`, `tools/port-manifest`.

**Performance Goals**: SC-008 màn đăng nhập < 3 s ở 10 Mbps cache lạnh (bundle chính gzip ≤ 350 KB, R12); đổi
module < 1 s sau hydrate (SC-002).

**Constraints**:
- Chỉ 32 route API của `contracts/api-calls.md` (E2E ghi request, FR-002).
- Không sửa `directus/`; file chép ghi `// Ported from directus/app/src/...`.
- Không hex, không palette Tailwind ngoài `styles/tokens.css` (lint).
- Giá trị tạm cho Q-1 đến Q-7 chỉ nằm trong `tokens.css`, `override-map.ts`, `assets/logo-*.svg` (đổi một chỗ).
- Không WebSocket, extension, AI, deployment, visual (XI).
- Không gửi email: màn quên mật khẩu, lời mời có dòng liên hệ admin (D-42).

**Scale/Scope**: khoảng 16 route, 6 module khung, 11 store, 12 component `Bo*`, 12 component bố cục, 1 script
sync, 2 file JSON dịch (~3.000 + 1.300 khóa), ~25 file unit test, 8 spec E2E, 5 dịch vụ compose, 1 job CI. Ước
lượng 6.000 dòng mới (trong đó ~1.500 chép từ Directus) + JSON dịch. `tasks.md` chia bốn đợt commit: A (token,
component, client, i18n, store, router, auth, public routes), B (bố cục, module, branding, theme, hồ sơ), C (E2E,
profile `web`, CI), D (đóng feature: manifest, README, spec).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.5.0. Kết quả lần 2 (sau research, data model, contracts); lần 1
trước research không vi phạm.

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`; script sync chỉ đọc YAML; file chép ghi nguồn
  (R6), manifest `012-T*.json`, guard `check-port-headers`.
- [x] **II. Dùng chung DB**: PASS. App web không chạm DB; mọi ghi qua API Directus (`PATCH /users/me`, `POST
  /auth/*`, `/users/invite/accept`, `/server/setup`, `/shares/auth`, `/files`).
- [x] **III. API giống hệt**: PASS. App chỉ gọi API Directus với cùng body, query, mode như Directus app
  (contracts/api-calls.md); chạy được với Directus thật (SC-001).
- [x] **IV. Chạy song song an toàn**: PASS. Phiên là cookie của API dùng chung; không state server.
- [x] **V. Kiểm thử đối chiếu**: PASS. Không endpoint mới ở API. Đối chiếu ở mức app: E2E chạy cùng kịch bản
  với API Directus và API mới (cấu hình 1, 2), và `tests/directus-app-e2e` cho Directus app cùng dữ liệu
  (branding.spec so ảnh, không chặn).
- [x] **VI. Kiến trúc**: PASS. Vue 3 Composition API, Reka UI, Pinia, Vue Router; luồng màn hình, route, hành vi
  theo Directus app; 768 px+, 4 trình duyệt; `vi-VN`, `en-US` chép từ `directus/app/src/lang`; mỗi thay đổi có test.
- [x] **VII. Đa instance**: PASS. Build tĩnh, `config.json` lúc chạy (001), không state process; khác origin hỗ trợ
  qua biến API đã có (R3).
- [x] **VIII. Biến môi trường**: PASS. Không biến mới; `PUBLIC_URL` → `apiUrl` (001); `CORS_*`,
  `SESSION_COOKIE_*` là biến Directus đã hỗ trợ ở API.
- [x] **IX. Đổi thương hiệu**: PASS. D-39: tiêu đề, logo, favicon, chuỗi dịch, key localStorage; giữ tên cookie,
  `directus_*`, URL docs mặc định (cần xác nhận), `sso_otp_attempted`.
- [x] **X. Chất lượng**: PASS. Coverage 60%, lint, typecheck, E2E, build image trong CI; không gửi email; khác biệt
  D-39 đến D-48 trong spec chờ tech lead duyệt khi merge.
- [x] **XI. Ngoài phạm vi**: PASS. Không websocket, extension, AI, deployment, visual, SAML (nút SAML chỉ hiện khi
  Directus thật trả provider, app không gọi gì thêm).
- [x] **XII. Design-system**: PASS. Đã đọc `README.md`, `component-specs.md`, `handoff-checklist.md`; token qua
  `@theme` giữ `eh-*`; lint chặn hex/palette; component Tier 1 theo quy ước; Q-1 đến Q-7 ghi ở spec, giá trị tạm
  gói ở token (R2, R11); branding settings áp lên token như `app.vue`.

## Project Structure

### Documentation (this feature)

```text
specs/012-backoffice-web-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ui-routes.md      # route, guard, bố cục, head
│   ├── api-calls.md      # 32 route API app gọi (FR-002)
│   └── e2e.md            # unit, E2E ba cấu hình, profile web, CI
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── index.html                      # title Backoffice, lang từ app
├── public/
│   ├── config.json                 # dev: { apiUrl: "/" }
│   ├── favicon.ico, favicon.svg    # Backoffice (R11)
│   └── fonts/                      # Noto Sans (Q-2 tạm), Material Symbols Rounded subset (R8)
├── scripts/
│   └── sync-translations.mjs       # R4 (target Nx web:sync-translations)
├── src/
│   ├── main.ts                     # loadRuntimeConfig → createSdk(apiUrl) → pinia, router, i18n, head → mount
│   ├── App.vue                     # useAppHead, hydrating, error view, RouterView, custom-css
│   ├── runtime-config.ts           # giữ (001)
│   ├── constants.ts                # Ported: MODULE_BAR_DEFAULT, DEFAULT_AUTH_*, AUTH_SSO_DRIVERS, BREAKPOINTS
│   ├── api/
│   │   ├── sdk.ts                  # Ported từ sdk.ts + api.ts: client duy nhất, fetch bọc, queue
│   │   └── request.ts              # requestEndpoint helper
│   ├── auth.ts                     # Ported: login, refresh, logout, LogoutReason
│   ├── hydrate.ts                  # Ported, rút gọn
│   ├── idle.ts                     # Ported
│   ├── router/
│   │   ├── index.ts                # Ported router.ts: routes, onBeforeEach, onAfterEach
│   │   └── guard.ts                # tách guard để test
│   ├── modules/
│   │   ├── index.ts                # defineModule, registerModules (Ported modules/index.ts)
│   │   ├── content.ts files.ts users.ts insights.ts activity.ts settings.ts
│   │   └── ModulePlaceholder.vue
│   ├── stores/                     # app, server, user, settings, permissions, requests, notifications,
│   │                               # collections, fields, relations, presets, translations (Ported)
│   ├── lang/
│   │   ├── index.ts                # createAppI18n, translateAPIError (Ported lang/index.ts)
│   │   ├── set-language.ts         # Ported
│   │   ├── available-languages.json
│   │   ├── translations/{en-US,vi-VN}.json + .meta.json   # sinh bởi script, commit
│   │   └── overlay/{en-US,vi-VN}.ts                        # chuỗi riêng Backoffice
│   ├── theme/
│   │   ├── use-theme-configuration.ts  # Ported
│   │   ├── override-map.ts             # R2 (Q-6)
│   │   └── use-app-head.ts             # Ported phần useHead của app.vue
│   ├── styles/
│   │   ├── tokens.css              # chép design-system/tokens/tokens.css + khối .dark (Q-5)
│   │   ├── theme.css               # @import tailwindcss; @theme eh-*; @custom-variant dark
│   │   ├── fonts.css
│   │   └── base.css                # reset, focus-visible, skip-link
│   ├── components/                 # BoButton BoInput BoSelect BoNotice BoTooltip BoMenu BoDialog BoIcon
│   │                               # BoProgressCircular BoProgressLinear BoSkipMenu BoAvatar
│   ├── layout/
│   │   ├── PrivateView.vue PublicView.vue NoAppAccess.vue
│   │   ├── ModuleBar.vue ModuleBarLogo.vue ModuleBarAvatar.vue
│   │   ├── NavBar.vue ProjectName.vue HeaderBar.vue MainContent.vue Sidebar.vue ResizeHandle.vue
│   │   └── stores/{sidebar,nav-bar}.ts   # Ported
│   ├── routes/
│   │   ├── login/{LoginRoute.vue, LoginForm.vue, LdapForm.vue, SsoLinks.vue, ContinueAs.vue}
│   │   ├── LogoutRoute.vue SetupRoute.vue TfaSetupRoute.vue
│   │   ├── reset-password/{ResetPasswordRoute.vue, RequestForm.vue, ResetForm.vue}
│   │   ├── AcceptInviteRoute.vue RegisterNotAvailableRoute.vue SharedRoute.vue
│   │   ├── PrivateNotFoundRoute.vue
│   │   └── ProfileRoute.vue
│   ├── composables/{use-tfa-setup,use-safe-redirect,use-media-query}.ts   # Ported
│   ├── utils/{generate-favicon,get-asset-url,jwt-payload,translate-object-values,get-date-fns-locale,markdown}.ts
│   └── assets/{logo-light.svg,logo-dark.svg}
├── vite.config.ts                  # base /admin/, tailwind plugin, proxy mọi path API → PUBLIC_URL (dev)
├── vitest.config.ts                # giữ
├── Dockerfile, nginx.conf, docker/40-config.sh   # giữ (001)
└── project.json                    # targets: serve, build, test, lint, typecheck, sync-translations

apps/web-e2e/
├── playwright.config.ts            # projects theo E2E_CONFIG (contracts/e2e.md §2)
└── src/{login,navigation,branding,sso,password-invite,profile,requests,perf}.spec.ts, helpers/

tests/parity/
├── docker-compose.yml              # + backoffice-web, backoffice-web-cors, backoffice-api-web-cors, proxy-web-*
├── proxy/{web-directus.conf,web-api.conf}
├── env/profile-web-cors.env, profile-sso.env (+CORS), profile setup (+CORS)
└── scripts/env.mjs                 # profile web

tools/eslint/no-raw-color.mjs       # R9
tools/port-manifest/012-T*.json
.github/workflows/ci.yml            # job e2e-web
pnpm-workspace.yaml                 # catalog nhóm Web
```

**Structure Decision**: giữ `apps/web` của 001 và mở rộng theo cây trên (thư mục theo vai trò, tên file PascalCase
cho SFC, kebab cho ts như Directus app); `apps/web-e2e` dùng lại (R9); môi trường E2E trong `tests/parity` như
các feature trước.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Không có vi phạm constitution. Ghi chú: bộ token tối, ánh xạ override, logo chữ "B" là giá trị tạm cho Q-1 đến Q-7 (XII cho phép ghi câu hỏi mở, không cấm giá trị tạm trong token) | App cần chạy và có theme tối để kiểm | Chờ duyệt trước khi code: chặn toàn bộ feature |
| `@directus/sdk` 21.3.0 chưa xác nhận có trên npm (R1, [Unverified]) | Client chuẩn, cùng bản Directus app | Viết client riêng: thêm code, lệch refresh |

## Phase 0, 1: kết quả

- research.md: R1 đến R13, hai chỉnh sửa spec (FR-071 (3) không cần HTTPS; FR-090 dùng `apps/web-e2e`).
- data-model.md: store, thực thể, localStorage, cấu hình.
- contracts/: `ui-routes.md`, `api-calls.md`, `e2e.md`.
- quickstart.md: dev, sync dịch, unit, E2E ba cấu hình, kiểm tra tay.
- Agent context: `CLAUDE.md` cập nhật bằng `.specify/scripts/bash/update-agent-context.sh claude`.
