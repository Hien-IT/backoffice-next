# Implementation Plan: Module Files và Users (thư viện file và danh bạ người dùng như Directus)

**Branch**: `015-files-users-modules` (trên `main`, không có branch riêng) | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-files-users-modules/spec.md`

## Summary

Thay khung module Files và Users của 012 (đích chuyển hướng D-72 của 014) bằng các màn thật: thư viện file với cây thư
mục trong sub-menu sidebar, thẻ thư mục trên layout cards, tải lên (hộp nhiều file, từ URL, kéo thả toàn cửa sổ, TUS
khi server bật), màn file với xem trước, thay file, chuyển thư mục, tải về, bản sao, chi tiết file; trình chỉnh ảnh
Cropper.js dùng chung với `file-image` (gỡ D-59); danh bạ user theo trạng thái và cây role, mời user (không email), màn
user thay trang hồ sơ cố định của 012 (gỡ D-48) với sáu interface `_system` còn nợ của 013 (gỡ D-57 phần 015), trong đó
`system-theme` xem trước đúng theme Directus từ dữ liệu rule chép tĩnh (Q1 = C). Không làm `/register` (Q2 = B). Kiểm
bằng E2E ba cấu hình trên bộ mẫu `bo_files`, `bo_users`, so payload ghi với Directus app, so pixel ảnh sau chỉnh.

Cách làm:

- Chép logic từ `directus/app/src` (route, `use-folders`, `get-folder-filter`, `delete-folder`, `upload-file(s)`,
  `stores/files`, `use-dialog-route`, `use-navigation` của users, sáu interface, `image-editor`) với ghi nguồn; viết lại
  giao diện bằng Reka UI + theme TailAdmin theo recipe nháp Q-13 đến Q-19 viết vào `design-system/docs/` trước khi code
  (R2 đến R7).
- Dùng lại 014: `use-preset`, `use-layout`, năm layout (cards thêm lại `extraSelection`, `prepend`), `use-item`,
  `use-permissions`, `SearchInput`, `components/sidebar/*`, `DrawerBatch`, `DrawerCollection`; 013: `BoForm`, `BoUpload`
  (mở rộng `fileId`, `uploadFiles`), `FilePreview`, `UserPopover`, `BoDrawer`; 012: khung, store, `use-tfa-setup` (mở
  rộng), `UserMenu`.
- Thư viện cùng bản Directus: `cropperjs` 1.6.2, `tus-js-client` 4.3.1 (R1).
- Test: Vitest `unit` + `browser` với API giả lập mở rộng (#97–#134); E2E Playwright chín spec ở ba cấu hình; bộ so
  payload `files`, `users` ở `proxy-api`; benchmark web thêm hai kịch bản (R9, R10).
- Bốn lượt commit (FR-123, R12): 1 Files, 2 trình chỉnh ảnh, 3 Users + interface, 4 quyền, đối chiếu, đóng.

Chi tiết: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/),
[quickstart.md](./quickstart.md).

## Technical Context

| Yêu cầu (prompt plan) | Ở feature 015 |
|-----------------------|---------------|
| Node 22, pnpm 10, Nx, `apps/web` Vue 3 script setup TS strict, Vite, Pinia, Vue Router | Giữ như 012–014 |
| Reka UI 2.8.2 + Tailwind CSS 4.3, theme `brand-*`, `gray-*` qua `@theme`, không hex, không palette | Giữ; khung cắt của Cropper.js và SVG xem trước theme nhận màu qua biến (`--theme--*` của Directus chỉ trong `ThemePreview`, inline từ dữ liệu; không phải class); chip role màu theo `status` bằng token (recipe Q-18) |
| Bố cục theo `layout-patterns.md`, component theo `component-specs.md` | Cây thư mục và cây role trong sub-menu L-3 (Q3 = A, §11 mới); page header L-5, panel L-4; recipe nháp Q-13 đến Q-19 trước khi code (FR-110) |
| Settings áp lên theme như `app.vue` | Không đổi (012); `system-theme-overrides` ghi khóa Directus, `OVERRIDE_MAP` 012 áp phần có ánh xạ (D-43, D-89) |
| vue-i18n từ `directus/app/src/lang` | Khóa `file_library`, `delete_folder_dialog.*`, `interfaces.system-token.*`, `editing_image`... đã sinh ở 012 (R11); overlay thêm `theme_applies_in_directus` (D-88) |
| `@directus/sdk` | Mọi request qua sdk (`requestEndpoint`); multipart `PATCH /files/:id`, blob `/assets/*` và zip qua `apiFetch` (013); TUS qua `tus-js-client` (XHR, `withCredentials`) tới `PUBLIC_URL` |
| Copy composable/utils, viết lại component bằng Reka UI | R2 đến R7; manifest `tools/port-manifest/015-T*.json` |
| Vitest + VTU; Playwright E2E với Directus thật và API mới | `contracts/tests.md` |
| GitHub Actions, coverage FE 60% | Job `quality`, `e2e-web`, `benchmark.yml` như 014; `check-bundle` `BUDGET_015` |

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23.3; trình duyệt như 012.

**Primary Dependencies**: đã có (012–014): vue 3.5, pinia 3, vue-router 4, vue-i18n 11, reka-ui 2.8.2, tailwindcss
4.3, @directus/sdk 21.3.0, @directus/utils 13.4.1, @directus/types 15.0.3, @vueuse/core 14, lodash-es, date-fns 4.1,
p-queue 8.1.0, nanoid, color 5.0.2, qrcode 1.5.4, vuedraggable 4.1.0. Thêm (R1): cropperjs 1.6.2, tus-js-client 4.3.1
(catalog đã có), `flat` 6.0.1 hoặc hàm làm phẳng riêng (T002).

**Storage**: không DB; Pinia (`presets.defaultPresets`, `server.info.uploads`, store `files`); state module-level
`useFolders`, `useNavigation`; localStorage `backoffice-require_tfa_setup` (012); dữ liệu tĩnh
`src/theme/theme-presets.json`; bộ mẫu `apps/web/fixtures/interfaces/snapshot/` thêm `folders`, `files`, `users`,
`roles`.

**Testing**: Vitest `unit` + `browser` (chromium) trong `apps/web`, coverage ≥ 60 % gộp; axe; Playwright `apps/web-e2e`
chín spec `files-*`, `users-*` ở `proxy-directus`, `proxy-api`, `cors`; payload `files.spec.ts`, `users.spec.ts` ở
`proxy-api`; parity `web` giữ `fixtures-seed.test.ts` (mở rộng seed); benchmark `web-files-users.ts`.

**Target Platform**: như 012 (image nginx tĩnh, cùng hoặc khác origin; storage `local` dùng chung volume `uploads`).

**Project Type**: Monorepo web. Chạm `apps/web` (src, fixtures, scripts, vite config), `apps/web-e2e`, `design-system/
docs` (recipe nháp, §7, §11), `tests/benchmark` (kịch bản mới), `.github/workflows/ci.yml` (bước perf, e2e), `pnpm-workspace.yaml`
(catalog), `tools/port-manifest`, `tools/check-package-names.mjs` (cropperjs web-only), spec 012 (D-40 Files/Users, D-44
"sau 015", D-48), 013 (D-57 sáu interface, D-59, FR-051/FR-054 mở rộng), 014 (D-72 phần 015).

**Performance Goals**: SC-007 (cây 500 thư mục < 500 ms, lưới 100 + 20 thẻ < 1 s, mở trình chỉnh ảnh 4000×3000 < 2 s,
số request mỗi thao tác; ngân sách cho Mac tham chiếu nhân `machineFactor()` của 014 trong CI); benchmark 10.000 file và
10.000 user ≤ +10 % p95 so Directus app (FR-118, không chặn); bundle chính ≤ ngân sách 014 + 20 KB gzip (R10).

**Constraints**:
- Chỉ API Directus ở `contracts/api-calls.md` (#97–#134 nối 014); 0 request ra ngoài (FR-115).
- Bắt đầu sửa `apps/web`, `apps/web-e2e`, `design-system/`, spec 012–014 chỉ khi phiên 014 báo đóng và push xong (quy
  tắc session 014, FR-122); commit chỉ đường dẫn của 015 cho tới khi đó.
- Không sửa `directus/`; file chép ghi `// Ported from directus/app/src/...`; không ghi `directus_fields`,
  `directus_relations`, `directus_collections`.
- Không hex, không palette ngoài theme trong class; màu dữ liệu (icon role, swatch overrides, SVG theme preview) chỉ
  inline từ giá trị runtime hoặc dữ liệu theme Directus.
- Không chọn ngầm giao diện: recipe nháp Q-13 đến Q-19 vào `design-system/docs/` trước (FR-110); design owner duyệt trước
  khi đóng (SC-008).
- Không email (mời, D-83), không `/register` (Q2 = B), không collab/AI (D-68, D-54); khung cắt chỉ chuột (ngoại lệ a11y
  FR-111).
- Mở rộng component `Bo*` và layout của 012–014 chỉ bằng prop tùy chọn; test của 012–014 giữ xanh; `ProfileRoute` 012
  xóa cùng `profile.spec.ts` viết lại.

**Scale/Scope**: 2 module × (route file + 3–4 route SFC + 4–5 component); dùng chung Files 6 SFC (`FilesNavigation`,
`FilesNavigationFolder`, `FolderPicker` ×2, `FilePreviewReplace`, `ImageEditor`); 6 interface (10 SFC); composable và
utils chép 9 (`use-folders`, `use-dialog-route`, `use-navigation`, `get-folder-filter`, `delete-folder`,
`collect-folder-ids`, `upload-file`, `upload-files`, `fetch-all`), store `files`, mở rộng 4 (`presets`, `server`,
`use-tfa-setup`, `BoUpload`), cards layout 2 SFC sửa, script sync theme + JSON, `rules-to-css-vars`. Ước lượng 6.500
dòng mới (≈ 3.000 chép), ≈ 45 file test, 9 spec E2E, 2 payload spec, 1 benchmark. `tasks.md` chia bốn lượt (R12).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` 2.0.0. Lần 1 (trước research) và lần 2 (sau design) không vi phạm.

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`; file chép ghi nguồn, manifest `015-T*.json`,
  `check-port-headers`; script `sync-theme-presets.mjs` chỉ đọc `directus/packages/themes`.
- [x] **II. Dùng chung DB**: PASS. Ghi chỉ qua API (`/files`, `/folders`, `/users`, `/presets`, `/utils/*`); dạng ghi
  (FormData multipart như `upload-file.ts`, `theme_*_overrides` cùng khóa Directus, preset mặc định chép từ
  `stores/presets.ts`) giữ để Directus đọc được (SC-004, SC-005).
- [x] **III. API giống hệt**: PASS. Không endpoint mới; cùng query và body như Directus app (`contracts/api-calls.md`);
  TUS cùng giao thức và metadata.
- [x] **IV. Chạy song song an toàn**: PASS. Không state server; localStorage chỉ `backoffice-`; upload dở theo
  fingerprint của tus trong trình duyệt như Directus.
- [x] **V. Kiểm thử đối chiếu**: PASS. Không endpoint mới ở API; đối chiếu ở mức màn: E2E ba cấu hình, bộ so payload,
  parity UI, so pixel ảnh (SC-006); seed đối chiếu `fixtures-seed.test.ts` mở rộng.
- [x] **VI. Kiến trúc**: PASS. Vue 3 Composition API, Reka UI; route, luồng, quyền theo Directus app; 768 px+;
  `vi-VN`/`en-US`; mỗi thay đổi có test.
- [x] **VII. Đa instance**: PASS. Build tĩnh; file lên storage dùng chung (volume `uploads` ở parity).
- [x] **VIII. Biến môi trường**: PASS. Không biến mới; `uploads` đọc từ `/server/info` (API phía 007 đã theo
  `TUS_*`, `FILES_*`).
- [x] **IX. Đổi thương hiệu**: PASS. Khóa localStorage `backoffice-`; `id` theme Directus (`Directus Default`...) giữ vì
  là dữ liệu trong DB (định danh tương thích); tên hiển thị dịch `theme_directus_default` của Directus giữ (tên sản phẩm
  bên thứ ba trong dữ liệu, như `@directus/sdk`); ghi ở "Cần xác nhận" nếu owner muốn đổi nhãn.
- [x] **X. Chất lượng**: PASS. Coverage 60 %, lint, typecheck, browser test, E2E, build image; benchmark hằng tuần; không
  email (D-83); D-83 đến D-90 trong spec, tech lead duyệt trước khi đóng (SC-010).
- [x] **XI. Ngoài phạm vi**: PASS. Không collab, AI, extension; drawer upload dở (D-90) để 018; `/register` để sau
  (Q2 = B).
- [x] **XII. Design-system**: PASS. Đã đọc `README.md`, `component-specs.md`, `layout-patterns.md`,
  `handoff-checklist.md`; theme qua `@theme`; không hex trong class; Q-13 đến Q-19 ghi ở spec, recipe nháp trước khi
  code, design owner duyệt trước khi đóng; branding không đổi; ngoại lệ a11y (khung cắt chỉ chuột) ghi FR-111 và
  `handoff-checklist.md`.

## Project Structure

### Documentation (this feature)

```text
specs/015-files-users-modules/
├── plan.md
├── research.md           # R1–R13
├── data-model.md         # route, thư mục, thư viện, tải lên, màn file, trình chỉnh ảnh, danh bạ, màn user, interface, theme data, bộ mẫu
├── quickstart.md
├── contracts/
│   ├── api-calls.md      # #97–#134, danh sách đóng cho E2E
│   ├── components.md     # component, composable, interface, theme data, E2E helpers
│   └── tests.md          # unit/browser, API giả lập, E2E, payload, benchmark, CI
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── fixtures/interfaces/{seed.mjs, export.mjs, snapshot/}   # bo_files (thư mục 3 cấp, 30 file, EXIF), bo_users (role con, user mỗi status, token, SSO)
├── scripts/{sync-theme-presets.mjs, check-bundle.mjs (BUDGET_015, LAZY_ONLY)}
├── src/
│   ├── modules/files.ts, modules/users.ts                 # route thật (thay placeholderRoutes)
│   ├── modules/files/
│   │   ├── routes/{FilesCollectionRoute,AddNewFile,FileItemRoute}.vue   # not-found: ContentNotFound (module="files")
│   │   └── components/{AddFolder,DeleteFolderDialog,FolderSection,FileInfoSidebarDetail}.vue
│   ├── modules/users/
│   │   ├── routes/{UsersCollectionRoute,UserItemRoute}.vue   # not-found: ContentNotFound (module="users")
│   │   ├── components/{UsersNavigation,NavigationRole,UserInfoSidebarDetail,UsersInvite}.vue
│   │   └── composables/use-navigation.ts
│   ├── components/files/{FilesNavigation,FilesNavigationFolder,FolderPicker,FolderPickerListItem,FilePreviewReplace,ImageEditor}.vue, BoUpload.vue (+fileId)
│   ├── interfaces/_system/
│   │   ├── system-language/{index.ts,SystemLanguage.vue}
│   │   ├── system-input-password/{index.ts,SystemInputPassword.vue}
│   │   ├── system-mfa-setup/{index.ts,SystemMfaSetup.vue}
│   │   ├── system-token/{index.ts,SystemToken.vue}
│   │   ├── system-theme/{index.ts,SystemTheme.vue,ThemePreview.vue}
│   │   └── system-theme-overrides/{index.ts,SystemThemeOverrides.vue,SystemThemeOverridesGroup.vue,SystemThemeOverridesRule.vue,types.ts}
│   ├── interfaces/file-image/FileImage.vue               # nút chỉnh ảnh (FR-045)
│   ├── layouts/cards/{Cards.vue,components/CardsHeader.vue}   # extraSelection, prepend, select-all
│   ├── composables/{use-folders,use-dialog-route,use-tfa-setup (+4 hàm)}.ts
│   ├── stores/{files.ts (mới), presets.ts (defaultPresets), server.ts (uploads, default_theme_*)}
│   ├── theme/{theme-presets.json, rules-to-css-vars.ts}
│   ├── utils/{get-folder-filter,delete-folder,collect-folder-ids,upload-file,upload-files,fetch-all}.ts
│   ├── layout/UserMenu.vue                               # link /users/<id>; routes/ProfileRoute.vue xóa
│   ├── test-utils/fetch.ts                               # mockFixtureApi #97–#134, FakeXMLHttpRequest cho tus
│   └── lang/overlay/*                                    # theme_applies_in_directus
apps/web-e2e/src/
├── {files-library,files-upload,files-item,files-image-editor,users-directory,users-item,users-tfa-token,files-users-permissions,files-users-parity-ui}.spec.ts
├── payload/{files,users}.spec.ts
└── helpers/{allowed-paths.ts (+#97..), files.ts, users.ts, directus-app.ts (+)}
tests/benchmark/src/web-files-users.ts
design-system/docs/{component-specs.md (Tier 3 nháp 015: Q-14, Q-15, Q-16, Q-18, Q-19), layout-patterns.md (§7 ngoại lệ Files/Users, §11 cây thư mục và cây role Q-13, Q-17)}
design-system/qa/handoff-checklist.md                      # ngoại lệ khung cắt chỉ chuột
tools/port-manifest/015-T*.json; tools/check-package-names.mjs (cropperjs)
pnpm-workspace.yaml                                        # catalog Web: cropperjs 1.6.2
specs/012-backoffice-web-shell/spec.md, specs/013-interfaces-displays/spec.md, specs/014-content-module/spec.md   # "đã gỡ ở 015", D-44 "sau 015"
```

**Structure Decision**: `modules/files/` và `modules/users/` giữ cấu trúc Directus (`routes/`, `components/`,
`composables/`) để so từng file; component dùng chung của file (navigation, picker, preview replace, image editor) đặt
ở `components/files/` cạnh `BoUpload`, `FilePreview` của 013; interface `_system` theo thư mục Directus để 016 thêm phần
còn lại; dữ liệu theme ở `src/theme/` cạnh `override-map.ts` của 012.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Không có vi phạm constitution. Rủi ro: cropperjs 1.6.2 là bản cuối của major 1 (2.x đổi API) [Đã kiểm 2026-10-16: `pnpm audit` không có advisory cho cropperjs và tus-js-client] | SC-006 (kết quả cắt bằng Directus) và D-59 | cropperjs 2 cho kết quả khác Directus; canvas tự viết mất tính năng |
| Dữ liệu rule theme chép tĩnh (`theme-presets.json`, ≈ 30 KB) thay vì import `@directus/themes` | Q1 = C: xem trước đúng màu theme Directus; `@directus/themes` là gói workspace kéo theo store và plugin của Directus | Import gói: không có trên npm theo bản 11.17.4 độc lập với app, và vi phạm "không chép runtime Directus" của 012; dữ liệu tĩnh có test so với nguồn (FR-121) |
| TUS trong trình duyệt cần XHR giả trong unit test | FR-022 (Clarifications TUS = A) | Chỉ test TUS ở E2E `proxy-api`: thiếu khi env parity tắt TUS [Đã kiểm T002 (CHK090): profile `app` không bật TUS; nhánh TUS kiểm ở unit] |
| Mock multipart `PATCH /files/:id` và zip trong `mockFixtureApi` | Trình chỉnh ảnh, thay file, tải nhiều file trong browser test | Chỉ E2E: chậm và không chạy trong `quality` |

## Phase 0, 1: kết quả

- research.md: R1 đến R13; [Unverified] kiểm ở T002: CSS của cropperjs, `fetchAll`/`FolderPicker` đã có ở 014?,
  `BoForm provide('values')`, store server `project.default_theme_*` và `auth.disableDefault`, `cssVar` của
  `@directus/utils/browser`, cách sinh JSON theme (tsx/jiti/regex), `DEFAULT_CHUNK_SIZE` của `@directus/constants`,
  env parity bật TUS, ảnh EXIF mẫu, ghi `uploaded_on` qua API, tên provider SSO ở env parity, `vi-VN.yaml` đủ khóa.
- data-model.md: route, thư mục, thư viện, tải lên, màn file, trình chỉnh ảnh, danh bạ, màn user, sáu interface, theme
  data, store, bộ mẫu.
- contracts/: `api-calls.md` (#97–#134), `components.md`, `tests.md`.
- quickstart.md: cài, seed, sync theme, test, E2E ba cấu hình, payload, benchmark, lint, build.
- Agent context: `CLAUDE.md` cập nhật bằng `update-agent-context.sh claude` (dòng Active Technologies 015).
