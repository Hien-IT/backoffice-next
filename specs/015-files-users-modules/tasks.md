---

description: "Danh sách task cho feature 015: module Files và Users (thư viện file và danh bạ người dùng như Directus)"
---

# Tasks: Module Files và Users (thư viện file và danh bạ người dùng như Directus)

**Input**: Tài liệu thiết kế trong `/specs/015-files-users-modules/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R13), `data-model.md`, `contracts/`
(`api-calls.md` #97–#134, `components.md`, `tests.md`), `quickstart.md`, `checklists/` (`requirements.md`,
`release-gate.md` đã áp, `release-gate-proposals.md`).

**Điều kiện bắt đầu**: phiên 014 báo "đã đóng" và CI xanh ở commit cuối của 014 (T001). Trước đó chỉ sửa
`specs/015-*`. Dùng chung checkout `main` với session khác: `git add` theo đường dẫn, không `git add -A`; `git pull
--rebase` trước khi push; không push khi CI của session khác đang chạy; nhắn session khác trước
`parity-tests:env-up`/`env-down`; E2E local chạy tuần tự trên DB chung (R13).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có test cạnh file: `*.test.ts` (project `unit`, happy-dom) hoặc `*.browser.test.ts` (project `browser`,
  chromium) theo `contracts/tests.md` §1; coverage `apps/web` ≥ 60 % gộp.
- Feature không thêm hay sửa endpoint API nên không có test đối chiếu endpoint mới. Đối chiếu ở mức màn: E2E ba cấu
  hình (`contracts/tests.md` §3), bộ so payload `files`, `users` ở `proxy-api` (§4), so pixel ảnh sau chỉnh (SC-006),
  parity UI (SC-002); `fixtures-seed.test.ts` của 013 giữ xanh với bộ mẫu mở rộng.
- Chỗ research/data-model đánh [Unverified] có task kiểm sớm (T002, T003); kết quả ghi vào research.md và spec.

**Organization**: Task nhóm theo user story của spec, xếp theo bốn lượt commit (FR-123, R12): **Lượt 1** = Phase 1, 2,
3 (US1), 4 (US2); **Lượt 2** = Phase 5 (US5 trình chỉnh ảnh); **Lượt 3** = Phase 6 (US3), 7 (US4); **Lượt 4** = Phase 8
(US6), 9 (US7), 10 (Polish). Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới
xanh, commit, push, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Gốc đường dẫn: `apps/web/src/` viết tắt `src/`; `apps/web-e2e/src/` viết tắt `e2e/`; `apps/web/fixtures/interfaces/`
  viết tắt `fixtures/`. Màn Files ở `src/modules/files/`, màn Users ở `src/modules/users/`, component file dùng chung ở
  `src/components/files/`, interface ở `src/interfaces/_system/<id>/`.
- File chép từ `directus/app/src` (hoặc `directus/packages/themes`) PHẢI có dòng đầu `// Ported from directus/<đường
  dẫn>` (SFC: comment trong `<script setup>`); mỗi task chép ghi các cặp `{ "source", "dest" }` vào
  `tools/port-manifest/015-T###.json`; chạy `pnpm run check-port-headers`. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Component Vue KHÔNG chép nguyên (VI, XII): chép logic trong `<script setup>`, viết lại template theo recipe
  design-system bằng Reka UI. File `.ts` chép nguyên được. Chỗ khác nguồn ghi `// Backoffice: <lý do>` (api → sdk,
  `notify` → `useNotices` D-66, khóa localStorage `backoffice-`, bỏ collab D-68).
- Giao diện theo recipe nháp (T006, T007): KHÔNG hex thô, KHÔNG palette ngoài theme (`check-raw-colors`); màu dữ liệu
  (icon role, swatch overrides, SVG xem trước theme) chỉ qua `style` từ giá trị runtime. Nút chỉ icon có `aria-label`;
  control có label liên kết; khung cắt chỉ chuột là ngoại lệ ghi nhận (FR-111).
- Chuỗi giao diện dùng khóa Directus; chuỗi mới chỉ `theme_applies_in_directus` vào overlay `vi-VN` và `en-US` (T025).
- Dữ liệu E2E: `bo_files`, `bo_users` (T020); `bo_std`, `bo_content` không đổi; tên do test tạo theo `DATA_PREFIX`;
  mỗi spec dọn thư mục, file, user, preset của admin nó tạo ở `beforeEach`/`afterEach`; spec điều khiển Directus app
  (payload, parity-ui) vào `DIRECTUS_APP_SPECS` (chỉ chromium-1280).
- Spec E2E đổi preset qua giao diện: trong `afterEach` chờ khoảng 600 ms rồi `page.close()` trước khi khôi phục preset
  (tự lưu preset debounce 450 ms ghi sau bước khôi phục nếu trang còn mở; R13).
- Sau mỗi phase: `pnpm nx run web:lint`, `web:typecheck`, `web:test`, `web:build` xanh.

---

## Phase 1: Setup (điều kiện vào, thư viện, kiểm [Unverified], recipe nháp)

**Purpose**: xác nhận 014 đóng, cài gói, kiểm các giả định đọc từ code Directus, viết recipe nháp trước mọi task giao
diện (FR-110, SC-008).

- [x] T001 Xác nhận điều kiện bắt đầu (CHK097): tin nhắn phiên 014 "đã đóng", CI xanh ở commit cuối của 014 (`gh run
      list --branch main`), `git log` thấy các commit `docs(015)` đã lên `origin/main`; ghi run id vào
      `specs/015-files-users-modules/research.md` R12; không sửa `apps/web` trước khi xong task này
- [x] T002 Kiểm [Unverified] của research R1, R3, R6, R9 và CHK001/030/075/077/090/092/094 bằng lệnh và đọc code:
      `pnpm view cropperjs@1.6.2 license dist` (có `dist/cropper.css`?), `pnpm audit --prod --audit-level=high`;
      `grep` `fetchAll`/`FolderPicker` trong `src/` (014 có chưa), `provide('values'` trong `src/components/form/`,
      `default_theme`/`disableDefault` trong `src/stores/server.ts`, `cssVar` trong `node_modules/@directus/utils/dist/browser`,
      `DEFAULT_CHUNK_SIZE` trong `@directus/constants` (catalog?), `TUS_ENABLED`/provider SSO trong
      `tests/parity/docker-compose.yml` và `tests/parity/env/*.env`, cây thư mục trong `src/components/drawers/DrawerFiles.vue`,
      `defaultPresets` chính xác từ `directus/app/src/stores/presets.ts`; thử `PATCH /folders/:id {parent: <con>}`
      trên Directus 8155 (vòng cha-con, CHK077); ghi kết quả và quyết định vào `research.md` (mục "Kết quả kiểm T002")
      và sửa spec/data-model chỗ tương ứng
- [x] T003 Kiểm cách sinh dữ liệu theme (R6, D-89): thử import động bốn file `directus/packages/themes/src/themes/{light,dark}/*.ts`
      bằng `tsx` (có trong devDependencies?) so với regex `defineTheme({...})`; chọn cách; ghi vào `research.md` R6
- [x] T004 Thêm `cropperjs: 1.6.2` vào catalog nhóm Web của `pnpm-workspace.yaml` (tus-js-client 4.3.1, p-queue 8.1.0 đã
      có), `cropperjs`, `tus-js-client` vào `apps/web/package.json`, `cropperjs` vào danh sách web-only của
      `tools/check-package-names.mjs`; `pnpm install`; `pnpm nx run web:build` xanh
- [x] T005 [P] Thêm test smoke thư viện `src/test-utils/libraries.smoke.browser.test.ts` (mở rộng file 014): Cropper.js
      1.6.2 khởi tạo trên ảnh PNG 2×2 và `getData()` mặc định, `tus-js-client` `Upload` dựng được với `XMLHttpRequest`
      giả, CSS `cropper.css` nạp được
- [x] T006 [P] Viết recipe nháp Files vào `design-system/docs/layout-patterns.md` §11 "Folder tree and role tree in the
      sub-menu (nháp, 015)" (Q-13, Q-17: thụt cấp, `<button aria-expanded>` + `<ul>` lồng, mục đặc biệt, vạch chia, menu
      "⋯" bàn phím, skeleton, active, dưới `xl`) và sửa §7 dòng "Module navigation" thêm ngoại lệ Files và Users
      (CHK098); recipe `component-specs.md` Tier 3 nháp 015: "Folder cards and drop zone" (Q-14), "File page and file
      details" (Q-15), "Image editor" (Q-16)
- [x] T007 [P] Viết recipe nháp Users vào `design-system/docs/component-specs.md` Tier 3 nháp 015: "User box" (Q-18,
      màu chip theo status như CHK038), "Invite dialog, TFA dialogs, token input, theme picker, theme overrides tree"
      (Q-19); thêm ngoại lệ "khung cắt chỉ chuột" vào `design-system/qa/handoff-checklist.md`; tạo
      `specs/015-files-users-modules/design-review/README.md` theo mẫu 014 (bảng Q-13 đến Q-19, màn để xem)

**Checkpoint**: gói cài xong, kết quả T002/T003 ghi trong research, recipe nháp có trước khi code giao diện.

---

## Phase 2: Foundational (utils, store, upload, cây thư mục, cards, API giả lập, bộ mẫu)

**Purpose**: phần nền mà mọi story dùng; không có story nào bắt đầu trước khi xong.

### Utils, store, upload

- [x] T010 [P] Chép `src/utils/get-folder-filter.ts` (từ `app/src/utils/get-folder-filter.ts`), `src/utils/collect-folder-ids.ts`,
      `src/utils/delete-folder.ts` (api → sdk `requestEndpoint`), `src/types/folders.ts` (`FolderTarget`,
      `SpecialFolder`); test `get-folder-filter.test.ts` (4 nhánh, `recent` = `subDays(now, 5)` ISO),
      `delete-folder.test.ts` (thứ tự request move/delete, `parent` null về gốc CHK011); manifest `015-T010.json`
- [x] T011 [P] Chép `src/composables/use-folders.ts` (state module-level `folders`, `nestedFolders`, `openFolders`
      `['root']`, `fetchFolders` qua `fetchAll` của 014 hoặc chép `src/utils/fetch-all.ts` theo T002); test
      `use-folders.test.ts` (`nestFolders` 3 cấp, vòng `parent` không treo, `rootFolder`/`local`, nạp một lần, lỗi một
      trang → `unexpectedError` CHK083); manifest
- [x] T012 [P] Chép `src/stores/files.ts` (`upload()` → `{start, finish, progress, done, uploading}`,
      `isAnyUploadActive`) và test `files.test.ts`; manifest
- [x] T013 Mở rộng `src/stores/server.ts`: đọc `uploads` (`chunkSize`, `maxConcurrency`, `tus`) và
      `project.default_theme_light|dark` từ `/server/info` (sửa ghi chú D-41 ở đầu file: `uploads` nay được đọc); test
      `server.test.ts` thêm hai trường
- [x] T014 Chép `src/utils/upload-file.ts` và `src/utils/upload-files.ts`: nhánh TUS (`import('tus-js-client')` động,
      endpoint `<PUBLIC_URL>/files/tus`, metadata = preset + `filename_download` + `type` (+ `id` khi `fileId`),
      `chunkSize` server hoặc hằng chép, `removeFingerprintOnSuccess`, `withCredentials`, `onShouldRetry` false,
      `Directus-File-Id`, `findPreviousUploads`, xong `GET /files/:id`), nhánh multipart gọi `uploadWithProgress` 013
      (`POST /files` hoặc `PATCH /files/:fileId`, CHK056); `uploadFiles` với `p-queue` (`maxConcurrency` ≤ 0 = vô hạn,
      CHK004); test `upload-file.test.ts` (FormData thứ tự preset rồi `file`; TUS với `FakeXMLHttpRequest`: header
      `Tus-Resumable`, `Upload-Metadata`, resume), `upload-files.test.ts` (tiến độ gộp, hàng đợi); manifest
- [x] T015 Mở rộng `src/components/files/BoUpload.vue`: prop `fileId` (thay file), gọi `uploadFiles`/`uploadFile`
      (bỏ đường tải riêng), giữ API 013 (`multiple`, `fromUrl`, `folder`, `accept`, "chọn từ thư viện"); cập nhật
      `BoUpload.test.ts` (allowlist thêm `PATCH /files/:id`, CHK091) và ghi chú đầu file; test 013 khác giữ xanh
- [x] T016 [P] Chép `src/composables/use-dialog-route.ts` và test (`isOpen` theo `route.matched`); manifest

### Cây thư mục, picker, cards

- [x] T017 Chép `src/components/files/FilesNavigation.vue` và `FilesNavigationFolder.vue` (logic từ
      `files-navigation.vue`, `files-navigation-folder.vue`; template theo §11: `tree`/`treeitem`, `<button aria-expanded>`,
      `<ul>` lồng, mũi tên/Enter như `ContentNavigation` 014, mục đặc biệt, vạch chia, skeleton; menu thư mục =
      `contextmenu` + nút "⋯" `BoMenu` với đổi tên, chuyển, tải (`POST /assets/folder/:id` qua `apiFetch`, blob,
      `Content-Disposition` hoặc `folder-unknown-<time>.zip`), xóa; hộp `BoDialog` đổi tên và chuyển; `actionsDisabled`,
      `customTargetHandler`, `rootFolder`, `localOpenFolders`); test `FilesNavigation.test.ts` (props, click → router,
      mục đặc biệt active) và `FilesNavigation.browser.test.ts` (bàn phím, menu, hộp đổi tên gửi `PATCH /folders/:id`);
      manifest
- [x] T018 [P] Chép `src/components/files/FolderPicker.vue` và `FolderPickerListItem.vue` (`modelValue`,
      `disabledFolders` chỉ khóa chính nó CHK077, cây riêng `GET /folders limit=-1 sort=name` một lần mỗi instance
      CHK099, cha mở sẵn); test `FolderPicker.test.ts`; nếu T002 thấy 014 đã có `FolderPicker` cho Export thì hợp
      nhất thay vì chép; manifest
- [x] T019 Mở rộng `src/layouts/cards/Cards.vue` và `components/CardsHeader.vue`: thêm lại `extraSelection` (v-model),
      `hasPrependContent`, slot `prepend`, emit `select-all` (header: đếm `selection + extraSelection`, bỏ chọn xóa cả
      hai) đúng như `layouts/cards/cards.vue` và `header.vue` Directus (CHK003); sửa ghi chú đầu file 014; bốn layout
      khác nhận `extraSelection` không dùng; cập nhật `Cards.browser.test.ts` (thẻ `prepend` trước thẻ item, đếm chọn
      gộp, `select-all`); test 014 giữ xanh
- [x] T020 [P] Mở rộng `src/stores/presets.ts`: `defaultPresets` hệ thống `directus_files`, `directus_users` chép nguyên
      từ `directus/app/src/stores/presets.ts` (CHK001), `getPresetForCollection` trả mặc định khi không có preset; sửa
      ghi chú đầu file 012; test `presets.test.ts`

### Bộ mẫu, API giả lập, E2E harness, chuỗi dịch

- [x] T021 Mở rộng `fixtures/seed.mjs` và `fixtures/lib.mjs`: tập `bo_files` (thư mục `bo-fixtures/sub/deep`; 30 file:
      PNG gồm `bo-edit.png` 400×300, JPEG có EXIF tạo bằng `sharp().withMetadata({ exif })` CHK095 (thêm `sharp`
      bản catalog vào devDependencies của `apps/web` vì pnpm không resolve gói của `apps/api`), PDF, MP4 ngắn,
      TXT; 1 file do `bo-editor` tải; 1 file `uploaded_on` cũ nếu API cho ghi, không thì bỏ) và `bo_users` (role
      `bo-sub` parent `bo-editor`; user `bo-active`, `bo-suspended`, `bo-draft`, `bo-archived`, `bo-invited` qua
      `POST /users/invite`; user có `token`; user SSO với `provider` theo T002 CHK030); `seed.mjs --clean` dọn; mở rộng
      `fixtures/export.mjs` ghi `folders.json`, `files.json` (bỏ `tus_*`, chuẩn hóa ngày), `users.json` (bỏ `token`,
      `tfa_secret`, `password`), `roles.json`; chạy hai lần cho file giống nhau; `fixtures/README.md` mục 015
- [x] T022 Chạy seed trên Directus 8155 và API mới 8156 rồi `tests/parity/src/web/fixtures-seed.test.ts` xanh (seed
      mở rộng qua hai API cho cùng snapshot); sau seed xóa cache `?system` ở 8156 và 8163
- [x] T023 Mở rộng `src/test-utils/fetch.ts` (`mockFixtureApi`, `KNOWN_REQUESTS` #97–#134): `/folders` CRUD trong bộ
      nhớ, `/files` lọc theo `folder`/`uploaded_by`/`uploaded_on`/`type`, `POST /files` multipart (ghi FormData, trả
      file mới), `PATCH /files/:id` JSON và multipart (ghi `focal_point_*`), `GET /assets/:id` PNG cố định bỏ nonce,
      `POST /assets/files|folder/:id` zip giả + `Content-Disposition`, `/users/invite` (user `invited`; email trùng →
      `RECORD_NOT_UNIQUE` với `extensions.invalid`), `/users/*/tfa/*`, `/utils/random/string`, `/roles` có `parent`,
      `/server/info` thêm `uploads` và `project.default_theme_*`; `FakeXMLHttpRequest` tối thiểu cho tus (POST →
      `Location`, PATCH → `Upload-Offset`, HEAD); `src/test-utils/fixtures.ts` nạp snapshot mới; test `fetch.test.ts`
- [x] T024 [P] Mở rộng E2E harness: `e2e/helpers/allowed-paths.ts` thêm #97–#134; `e2e/helpers/files.ts`
      (`openFolder`, `uploadViaDialog`, `dropFiles` bằng DataTransfer qua `page.evaluate`, `selectCard`,
      `openImageEditor`, `clearFixtureFiles`), `e2e/helpers/users.ts` (`openUser`, `inviteUsers`, `toggleTfa` với
      `otplib`, `clearFixtureUsers`); `e2e/helpers/directus-app.ts` thêm helper thư mục, mời, token cho Directus app;
      `apps/web-e2e/playwright.config.ts` thêm `files-users-parity-ui` và `payload/{files,users}` vào
      `DIRECTUS_APP_SPECS`; `otplib` vào devDependencies của `apps/web-e2e` nếu chưa có
- [x] T025 [P] Chuỗi dịch: mở rộng `src/lang/keys.test.ts` cho `src/modules/files`, `src/modules/users`,
      `src/components/files`, `src/interfaces/_system/system-*`; thêm `theme_applies_in_directus` vào
      `src/lang/overlay/en-US.ts` và `vi-VN.ts` (CHK042); `overlay.test.ts` cập nhật

**Checkpoint**: nền xong; US1 và US2 bắt đầu.

---

## Phase 3: User Story 1 - Thư viện file: cây thư mục, danh sách theo layout, điều hướng (Priority: P1) 🎯 MVP

**Goal**: `/files`, `/files/folders/:id`, `/files/all|mine|recent` với sub-menu cây thư mục, thẻ thư mục trên cards,
chọn gộp, tạo/đổi tên/chuyển/tải/xóa thư mục, trạng thái trống (FR-001 đến FR-019).

**Independent Test**: E2E `files-library.spec.ts` trên `bo_files` ở ba cấu hình; request `/files` (fields, filter gộp,
sort, limit, page) và dòng `directus_presets` so với Directus app.

### Tests cho User Story 1

- [x] T030 [P] [US1] Test `src/modules/files.test.ts`: bảng route (data-model §1: tên, path, props `folder`/`special`,
      redirect `/files/folders`, con `+`, not-found), `preRegisterCheck` giữ 012
- [x] T031 [P] [US1] Test `src/modules/files/routes/FilesCollectionRoute.browser.test.ts` trên `mockFixtureApi`: tiêu
      đề và breadcrumb theo `folder`/`special`, bộ lọc hệ thống gộp (`_and` với `type._nnull` + `folder`), thẻ thư mục
      chỉ khi không `special`/`search`/`filter`, `isTransitioning`, chọn gộp và đếm, nút theo lựa chọn, trạng thái
      trống hai dạng, xóa thư mục hai chế độ (thứ tự request), chuyển thư mục hàng loạt, tải nhiều file (`POST
      /assets/files`), axe sáng/tối
- [x] T032 [P] [US1] Test `src/modules/files/components/{AddFolder,DeleteFolderDialog,FolderSection}.test.ts`:
      `POST /folders {name, parent}` (gốc = null), radio mặc định `move`, nút danger, `done`; thẻ thư mục `select-mode`

### Implementation cho User Story 1

- [x] T033 [US1] Viết `src/modules/files.ts`: route thật thay `placeholderRoutes` (`component: () => import(...)`,
      `AddNewFile` ở `components: { addNew }` với `meta.isFloatingView`, redirect, not-found dùng `ContentNotFound` 014
      với prop module CHK047); thêm prop tùy chọn `module` (mặc định `content`, chọn sub-menu theo module) vào
      `src/modules/content/routes/ContentNotFound.vue` (file hiện không có prop), test của 014 giữ xanh; manifest
      `015-T033.json`
- [x] T034 [P] [US1] Chép `src/modules/files/components/AddFolder.vue` (`BoDialog`, `BoInput` autofocus, Enter = lưu,
      `POST /folders`, `fetchFolders`, `router.push` thư mục mới; nút `create_new_folder` khóa với tooltip
      `not_allowed`), `DeleteFolderDialog.vue` (`BoRadio` `move_content`/`delete_content`, `moveAndDelete`/`recursiveDelete`,
      `done`), `FolderSection.vue` (`Card` 014, `icon=folder`, `to`, `select-mode`); manifest
- [x] T035 [US1] Chép `src/modules/files/routes/FilesCollectionRoute.vue` (logic `routes/collection.vue`: `usePreset`,
      `useLayout`, `getFolderFilter`, `subfolders`, `folderSelection` ↔ `extraSelection`, `isTransitioning`,
      `useMovetoFolder`, `batchDeleteFiles`, `onFolderDeleteDone`, `downloadFiles` qua `apiFetch`, `clearFilters`,
      `refresh`, watch `folders` nạp lại trừ lần đầu; template: `PrivateView` với slot `navigation` = `FilesNavigation`,
      page header L-5 (breadcrumb, tiêu đề, `layout-actions-*`, `SearchInput`, `AddFolder`, nút chuyển/xóa/sửa/tải/thêm
      theo FR-011), layout `prepend` = `FolderSection`, slot `no-results`/`no-items`, `RouterView name="addNew"`,
      `DrawerBatch`, panel: Layout + `layout-sidebar-*` + Export/Import (FR-018)); màn không tìm thấy là
      `ContentNotFound` với `module="files"` (T033), không có `FilesNotFound.vue`; manifest
- [x] T036 [US1] E2E `e2e/files-library.spec.ts` (`@core`): cây và mục đặc biệt, thẻ thư mục, chọn gộp và đếm,
      tạo/đổi tên/chuyển/tải/xóa thư mục (hai chế độ, so dòng DB qua API), trạng thái trống và xóa bộ lọc, 768 px
      không cuộn ngang trang, `openSidebar` dưới `xl`, khôi phục preset seed; chạy ba cấu hình xanh

**Checkpoint**: US1 chạy độc lập; thư viện duyệt được, thư mục quản lý được.

---

## Phase 4: User Story 2 - Tải lên, màn file: xem trước, metadata, di chuyển, xóa, thay file, tải về (Priority: P1)

**Goal**: hộp tải lên theo route `+`, kéo thả toàn cửa sổ, TUS/multipart, màn `/files/:id` với xem trước, thay file,
chuyển thư mục, tải về, bản sao, xóa, chi tiết file, Revisions, Comments (FR-020 đến FR-039).

**Independent Test**: E2E `files-upload.spec.ts`, `files-item.spec.ts`; bộ so payload `files.spec.ts` ở `proxy-api`.

### Tests cho User Story 2

- [x] T040 [P] [US2] Test `src/modules/files/routes/AddNewFile.test.ts` (mở theo route `+`, đóng → `router.push`,
      `BoUpload` props, `upload` emit) và `FilesCollectionRoute.browser.test.ts` phần kéo thả (DataTransfer giả:
      viền hiện/tắt, `data-dropzone`, notice `drop_to_upload` và tiến độ `aria-live`, lọc `type` rỗng, nạp lại 1 lần
      khi xong, `maxConcurrency` 5 → ≤ 5 request đồng thời)
- [x] T041 [P] [US2] Test `src/modules/files/routes/FileItemRoute.browser.test.ts`: header (nút quay lại, breadcrumb theo
      `folder`, tiêu đề `loading`→`title`), `fieldsDenyList` không hiện trong form, lưu chỉ field đổi, lưu và ở lại nạp
      lại, bản sao (`GET /assets` → `POST /files` với preset đúng CHK009), chuyển thư mục (`PATCH` với
      `fields=folder.name`, notice), tải về href, xóa → `router.replace`, `unsaved_changes` Keep trước, chi tiết file
      (dl, EXIF 5 trường, link, chép id; `GET /users/:id` 404 → bỏ dòng CHK013), Revisions/Comments 014 hiện, axe
- [x] T042 [P] [US2] Test `src/components/files/FilePreviewReplace.test.ts` (nút thay ẩn khi `disabled`, hộp
      `replace_file` với `BoUpload fileId fromUrl accept`, `replace` emit) và `FileInfoSidebarDetail.test.ts` (ngày
      ngắn/dài, `formatFilesize`, `readableMimeType`, folder link, thiếu dữ liệu → ẩn dòng)

### Implementation cho User Story 2

- [x] T043 [P] [US2] Chép `src/modules/files/routes/AddNewFile.vue` (`useDialogRoute`, `BoDialog`, `BoUpload multiple
      fromUrl folder accept` từ `parseGlobalMimeTypeAllowList(info.files.mimeTypeAllowList)`, nút `done`, mở trực tiếp
      bằng URL vẽ trên thư viện, đóng khi đang tải thì tải tiếp CHK007); manifest
- [x] T044 [US2] Thêm kéo thả toàn cửa sổ vào `FilesCollectionRoute.vue` (`useFileUpload`: bốn listener `window` qua
      `useEventListener`, `dragCounter`, `data-dropzone`, viền bốn `div fixed` theo bbox `<main>` `border-2
      border-brand-500 pointer-events-none aria-hidden`, notice `drop_to_upload` và tiến độ `BoNotice` `aria-live=polite`
      trong page header CHK033/034, `uploadFiles` với `{ folder }` và `maxConcurrency`, store `files`, nạp lại khi
      `isAnyUploadActive` về false)
- [x] T045 [P] [US2] Chép `src/components/files/FilePreviewReplace.vue` (`FilePreview` 013 + nút "thay file" + hộp
      `BoUpload fileId`), `src/modules/files/components/FileInfoSidebarDetail.vue` (`SidebarDetail` 014, dl/dt/dd,
      `UserPopover`, EXIF 5 trường CHK085, chép id qua `useClipboard`); manifest
- [x] T046 [US2] Chép `src/modules/files/routes/FileItemRoute.vue` (logic `routes/item.vue` trên `use-item` 014:
      `fieldsDenyList`, `to`, breadcrumb, `saveAndQuit`/`saveAndStay`/`saveAsCopyAndNavigate`/`deleteAndQuit`,
      `useMovetoFolder` với `fields=folder.name` và notice `file_moved`, `revert`, `useShortcut meta+s`,
      `useEditsGuard`; bỏ collab; template: page header với nút xóa, chuyển, tải về (`<a download>`) (nút chỉnh ảnh
      chưa vẽ ở lượt 1, T053 thêm cùng lúc nối `ImageEditor`), lưu + `SaveOptions` (khóa `save-and-add-new`;
      `save-as-copy` khi có create), `FilePreviewReplace`, `BoForm` `max-w-5xl`, hộp `unsaved_changes` Keep trước,
      panel: `FileInfoSidebarDetail`, `RevisionsSidebarDetail`, `CommentsSidebarDetail`); `isNew` luôn false CHK014;
      manifest
- [x] T047 [US2] E2E `e2e/files-upload.spec.ts`: hộp `+` ba file, từ URL (stub `files.example` → PNG), kéo thả hai file
      (viền, notice, tiến độ), tải xong danh sách nạp lại, file sai kiểu lỗi từng file; nhánh TUS khi env parity bật
      (T002) kiểm header `Tus-Resumable` ở `proxy-api`; `e2e/files-item.spec.ts` (`@core`): sửa metadata, lưu kiểu,
      chuyển thư mục, tải về, thay file, bản sao, xóa, chi tiết file, revisions; ba cấu hình xanh
- [x] T048 [US2] Bộ so payload `e2e/payload/files.spec.ts` (`proxy-api`, `DIRECTUS_APP_SPECS`): tải 1 file qua hộp,
      thay file, chuyển thư mục (một và hàng loạt), tạo/đổi tên/xóa thư mục (move), lưu metadata, bản sao, xóa; chuẩn
      hóa multipart (tên field thứ tự, tên file, `type`, kích thước) và nonce `/assets`; khác biệt thật → R-xx vào spec
- [ ] T049 [US2] Đóng lượt 1: `web:lint`, `typecheck`, `test` (coverage ≥ 60 %), `build` + `check-bundle` (tus là chunk
      lười: `BUDGET_015`, marker `Tus-Resumable` trong `LAZY_ONLY` của `apps/web/scripts/check-bundle.mjs`),
      `check-port-headers`, `guard-directus` (SC-003), E2E 012–014 + `files-*` ba cấu hình xanh (SC-001, SC-009),
      payload `files` xanh (SC-004); `git pull --rebase`; commit
      `feat(015): files library, folders, upload and file page (wave 1)`; push khi không có CI khác đang chạy; theo
      dõi CI, sửa đỏ; `graphify update .`

**Checkpoint**: Lượt 1 xong; module Files dùng được trừ chỉnh ảnh.

---

## Phase 5: User Story 5 - Chỉnh ảnh dùng chung (Priority: P2) — Lượt 2

**Goal**: `ImageEditor` trên Cropper.js 1.6.2 cho màn file và `file-image` (FR-040 đến FR-046, D-59 gỡ).

**Independent Test**: browser test với PNG cố định ghi lại FormData; E2E `files-image-editor.spec.ts` và so pixel với
Directus app (SC-006).

### Tests cho User Story 5

- [x] T050 [P] [US5] Test `src/components/files/ImageEditor.browser.test.ts` (ảnh PNG 400×300 cố định trong
      `src/test-utils/`): mở → `GET /files/:id` đúng `fields`, ảnh `/assets/:id?<nonce>`, toolbar ba chế độ, xoay,
      lật, menu tỉ lệ (custom trước vạch chia, icon theo tỉ lệ CHK015), dòng kích thước `n()` và SVG CHK037, hủy cắt,
      `hasEdits`; lưu: cắt+xoay → `PATCH /files/:id` FormData (`file` tên `filename_download`, `type`), focal → JSON,
      cả hai → FormData gồm focal; lưu mới → `POST /files` với `folder` gốc CHK016; lỗi `img` → notice, lưu khóa
      CHK017; đóng hủy Cropper; axe; bẫy focus
- [x] T051 [P] [US5] Test `src/interfaces/file-image/FileImage.test.ts` thêm: nút `tune` hiện khi ảnh + update
      `directus_files`, mở `ImageEditor`, `refresh` nạp lại `cacheBuster`, `new-file` đặt giá trị

### Implementation cho User Story 5

- [x] T052 [US5] Chép `src/components/files/ImageEditor.vue` (logic `image-editor.vue`: `useImage`, `useCropper`,
      `save`, `saveAsNew`, `dimensionsString`, `aspectRatioIcon`, `dragMode`, `cropping`, `localDragMode`; Cropper.js
      và CSS nạp lười khi mở; `apiFetch` cho FormData; nonce `nanoid`; `custom_aspect_ratios` từ store settings;
      template `BoDrawer persistent` với toolbar `<button>` có nhãn + `BoTooltip`, menu tỉ lệ `BoMenu`, slot `actions`
      nút lưu + menu "lưu thành file mới" khi `createAllowed`, màu khung Cropper qua token trong `cropper.css` đè);
      khung cắt chỉ chuột (FR-046); manifest `015-T052.json`
- [x] T053 [US5] Nối `ImageEditor` vào `FileItemRoute.vue` (thêm nút `tune` khi `type` chứa `image` và update; `refresh` → `refresh()`; `new-file` → `/files/<id>`) và vào `src/interfaces/file-image/FileImage.vue`
      (nút chỉnh, `createAllowed` từ `useCollectionPermissions('directus_files')`, nạp lại xem trước với
      `cacheBuster`, `new-file` → `emit('input', id)`); cập nhật ghi chú FR-051/FR-054 của 013 trong spec 013 ("mở
      rộng ở 015") và `interfaces/registry.test.ts` nếu đếm request
- [x] T054 [US5] E2E `e2e/files-image-editor.spec.ts`: cắt 200×100 tại (10,20) qua `setData` (`page.evaluate`) và xoay
      -90° `bo-edit.png`, lưu đè → `width`/`height`/focal qua API; lưu mới → file mới trong cùng thư mục; từ
      `file-image` của `bo_std`; ở `proxy-api` chạy cùng thao tác trên Directus app (8155) và so pixel sau giải mã
      (canvas `getImageData`, RGBA từng byte) + ba trường (SC-006, `DIRECTUS_APP_SPECS`); ba cấu hình xanh
- [ ] T055 [US5] Đóng lượt 2: cổng như T049 (SC-001, SC-003, SC-006, SC-009; `LAZY_ONLY` thêm `cropper-container`;
      chunk cropperjs ≤ 60 KB gzip CHK088);
      commit `feat(015): shared image editor for the file page and file-image (wave 2)`; push; CI; `graphify update .`

**Checkpoint**: Lượt 2 xong; D-59 gỡ.

---

## Phase 6: User Story 3 - Danh bạ user: danh sách theo trạng thái và role, tạo, mời (Priority: P1) — Lượt 3

**Goal**: `/users`, `/users/suspended|invited|all`, `/users/roles/:id`, sub-menu bốn mục + cây role, mời user không
email, tạo từ route role, xóa hàng loạt (FR-050 đến FR-066).

**Independent Test**: E2E `users-directory.spec.ts`; payload `users.spec.ts` phần mời và xóa.

### Tests cho User Story 3

- [x] T060 [P] [US3] Test `src/modules/users.test.ts`: bảng route (data-model §1, `users-me` trước `users-item`,
      `redirect` hàm trả `/users/<id>` từ store, user share → không có id), `preRegisterCheck`
- [x] T061 [P] [US3] Test `src/modules/users/composables/use-navigation.test.ts` (`roleTree` theo `parent`,
      `openRoles` tự thêm cha, nạp một lần, 403 → `unexpectedError` CHK018) và
      `src/modules/users/components/UsersNavigation.browser.test.ts` (bốn mục `exact`, vạch chia, skeleton, cây role
      gập mở, bàn phím, menu "sửa role" chỉ admin → `/settings/roles/:id`)
- [x] T062 [P] [US3] Test `src/modules/users/routes/UsersCollectionRoute.browser.test.ts`: tiêu đề/breadcrumb theo
      `status`/`role`, bộ lọc hệ thống gộp, `canInviteUsers` ba điều kiện, nút tạo tới `/users/roles/:id/+`, xóa hàng
      loạt (chứa mình → `logout`), trạng thái trống hai dạng với `create_user` chỉ `active`/không status, axe;
      `UsersInvite.test.ts`: tách email, `GET /roles` khi mở, mặc định phần tử đầu, ẩn select khi có `role`, không
      role → gửi không `role` CHK019, `RECORD_NOT_UNIQUE` tại chỗ, lỗi khác hộp lỗi, thứ tự đóng → nạp lại → notice
      D-83

### Implementation cho User Story 3

- [x] T063 [US3] Viết `src/modules/users.ts`: route thật (data-model §1; `users-me` `redirect` hàm CHK055; not-found
      `ContentNotFound` với prop module CHK057); sửa `src/layout/UserMenu.vue` link hồ sơ `/users/<id>` (share user
      không có mục CHK028) và `UserMenu.test.ts`; manifest `015-T063.json`
- [x] T064 [P] [US3] Chép `src/modules/users/composables/use-navigation.ts`, `components/UsersNavigation.vue`,
      `NavigationRole.vue` (template theo §11; menu "sửa role" admin = `contextmenu` + nút "⋯" tới
      `/settings/roles/:id`, D-85); manifest
- [x] T065 [P] [US3] Chép `src/modules/users/components/UsersInvite.vue` (`BoDialog`, `BoTextarea`, `BoSelect`, notice
      lỗi trùng tại chỗ, emit đóng; màn gọi notice D-83 sau nạp lại); manifest
- [x] T066 [US3] Chép `src/modules/users/routes/UsersCollectionRoute.vue` (logic `routes/collection.vue`: `usePreset`
      `directus_users`, `roleFilter`/`statusFilter`, `canInviteUsers`, `useBatch` với `logout` khi xóa mình,
      `useLinks`, `useBreadcrumb`; template như FR-061, FR-064, FR-065; `UsersInvite` + notice
      `contact_admin_for_link`); manifest
- [x] T067 [US3] E2E `e2e/users-directory.spec.ts`: sub-menu và cây role (`bo-editor` > `bo-sub`), bộ lọc theo
      status/role, mời 2 email + 1 trùng (user `invited` xuất hiện, notice), tạo từ route role (form có `role`), xóa
      hàng loạt, trạng thái trống; ba cấu hình xanh

**Checkpoint**: US3 chạy độc lập.

---

## Phase 7: User Story 4 - Màn user: hồ sơ, role và policy, trạng thái, token, TFA, theme, ngôn ngữ (Priority: P1) — Lượt 3

**Goal**: `/users/:id`, `/users/roles/:id/+`, `/users/me` với hộp user, form theo `users.yaml`, sáu interface
`_system`, dữ liệu theme tĩnh; thay `ProfileRoute` 012 (FR-070 đến FR-086, D-48, D-57 phần 015, D-88, D-89).

**Independent Test**: test component sáu interface với mock; E2E `users-item.spec.ts`, `users-tfa-token.spec.ts`;
payload `users.spec.ts`; so `/users/me` với Directus app `/users/<id>`.

### Tests cho User Story 4

- [x] T070 [P] [US4] Test `src/theme/directus-themes.test.ts` (file sinh bằng nguồn khi chạy lại script; 3 theme sáng,
      1 tối; `id`, `name`, `appearance`, `rules`) và `src/theme/rules-to-css-vars.test.ts` (3 mẫu: lồng `fonts.display`
      → `--theme--fonts--display--font-family`, số, chuỗi `var(`)
- [x] T071 [P] [US4] Test sáu interface: `SystemLanguage.test.ts` (mục mặc định dự án khi `includeProjectDefault`, mã lạ
      hiện thô), `SystemInputPassword.test.ts` (nút mắt, `autocomplete`), `SystemMfaSetup.browser.test.ts` (ba luồng
      mật khẩu/SSO/admin với mock `use-tfa-setup`, OTP 6 số mới bật, focus ô OTP, `cancel_tfa_setup`, xem user khác chỉ
      theo `tfa_secret` CHK022), `SystemToken.test.ts` (tạo → `GET /utils/random/string` + `PATCH {token}`, notice, chép;
      tạo lại hộp danger; xóa → `PATCH {token: null}` + `refresh`; user mới khóa; 403 → `VError` CHK073; token mất khi
      unmount CHK084), `SystemTheme.browser.test.ts` (danh sách theo `appearance`, `includeNull`, id lạ → không active
      CHK024, `ThemePreview` đặt biến `--theme--*` inline từ rule + overrides đã lưu CHK026, dòng
      `theme_applies_in_directus`), `SystemThemeOverrides.browser.test.ts` (cây nhóm, `$root`, ô text mọi rule lá
      CHK025, swatch chỉ khi parse được, `set`/`unset` gỡ nhóm rỗng, không object → cây rỗng CHK082)
- [x] T072 [P] [US4] Test `src/composables/use-tfa-setup.test.ts` thêm `disableTFA`, `adminDisableTFA`,
      `requestTFASetup` (ghi khóa `backoffice-require_tfa_setup` rồi `logout`), `cancelTFASetup` (xóa khóa, `hydrate`)
- [x] T073 [P] [US4] Test `src/modules/users/routes/UserItemRoute.browser.test.ts`: nạp với `fields=*,role.*,avatar.*`,
      `edits.role` từ prop, hộp user (avatar `system-medium-cover` + `cacheBuster`, lỗi → icon, chip theo status,
      email ở cả hộp và form CHK102), `fieldsDenyList`, `provider`/`external_identifier` readonly theo
      `isNew`/`isAdmin` CHK029, lưu chỉ field đổi, `setLang` + `hydrate` khi là mình (CHK039), `saveAndStay` ở `+` →
      `router.replace`, `saveAndAddNew`, archive/unarchive (`status`), xóa mình → `logout`, `unsaved_changes`, panel
      "Thông tin" (chép id, `last_page` link, `last_access`), Revisions/Comments, `max-w-5xl` + hộp cùng bề ngang
      CHK040, axe; `UserInfoSidebarDetail.test.ts`

### Implementation cho User Story 4

- [x] T074 [P] [US4] Viết `apps/web/scripts/sync-directus-themes.mjs` (cách theo T003) sinh
      `src/theme/directus-themes.json` (`{light, dark}`; header ghi nguồn và ngày) và `src/theme/rules-to-css-vars.ts`
      (làm phẳng `--`, kebab-case bằng regex; `flat` nếu T002 chọn); chạy script, commit JSON; thêm target
      `web:sync-themes` vào `apps/web/project.json`; thêm ngoại lệ đường dẫn `src/theme/directus-themes.json` (dữ liệu
      sinh, `id` theme "Directus Default"... là định danh lưu DB, IX) vào `apps/web/scripts/check-brand.mjs` kèm test ở
      `check-brand.test.ts`; manifest ghi nguồn `directus/packages/themes/src/themes/**`
- [x] T075 [P] [US4] Mở rộng `src/composables/use-tfa-setup.ts`: `disableTFA` (`POST /users/me/tfa/disable {otp}`),
      `adminDisableTFA(pk)` (`POST /users/:pk/tfa/disable`), `requestTFASetup` (khóa + `logout`), `cancelTFASetup`;
      sửa ghi chú đầu file 012
- [x] T076 [P] [US4] Chép `src/interfaces/_system/system-language/{index.ts,SystemLanguage.vue}` (`BoSelect`,
      `available-languages.json`, mục `default_language` null) và `system-input-password/{index.ts,SystemInputPassword.vue}`
      (`BoInput` + nút mắt); manifest
- [x] T077 [P] [US4] Chép `src/interfaces/_system/system-token/{index.ts,SystemToken.vue}` (`BoInput` readonly, ba icon
      `BoButton` có nhãn, hai `BoDialog` danger, `useClipboard`, `inject('refresh')`, `getEndpoint`; token chỉ trong
      state, không log CHK084); manifest
- [x] T078 [US4] Chép `src/interfaces/_system/system-mfa-setup/{index.ts,SystemMfaSetup.vue}` (`BoCheckbox` khối,
      ba `BoDialog`, QR bằng `qrcode` 012, `inject('values')` theo T002 (dự phòng `provide('values', item)` ở màn user
      CHK092), `inject('discardAllChanges')`, `requireTfaSetup` chỉ khi xem mình CHK022); manifest
- [x] T079 [US4] Chép `src/interfaces/_system/system-theme/{index.ts,SystemTheme.vue,ThemePreview.vue}` (radio
      `BoRadio`/`RadioGroup` với ô xem trước SVG 200×140 chép từ `theme-preview.vue`, biến inline từ
      `rulesToCssVars(merge(rules, overrides đã lưu))` CHK026, `includeNull` với theme mặc định dự án từ store server,
      nhãn theme qua `translate(theme.name)` với khóa `theme_directus_*` của file dịch 012 nên hiện "Backoffice
      Default"... trong khi `id` ghi DB giữ "Directus Default"... (D-88, test khẳng định cả hai), dòng
      `theme_applies_in_directus`) và `system-theme-overrides/{index.ts,SystemThemeOverrides.vue,SystemThemeOverridesGroup.vue,SystemThemeOverridesRule.vue,types.ts}`
      (nhóm gập `<button aria-expanded>`, ô text + swatch với `color` và `cssVar`/`getComputedStyle` theo T002,
      `setWith`/`unset`, `lang=en-US dir=ltr`); đăng ký sáu id trong `src/interfaces/index.ts`, cập nhật
      `registry.test.ts` (số đếm hiện có + 6, FR-086); manifest
- [x] T080 [P] [US4] Chép `src/modules/users/components/UserInfoSidebarDetail.vue` (`SidebarDetail` 014, khóa + chép,
      `last_page` `RouterLink`, `last_access`); manifest
- [x] T081 [US4] Chép `src/modules/users/routes/UserItemRoute.vue` (logic `routes/item.vue` trên `use-item` 014 với
      `fields`, `user` thu `role.id`, `edits.role`, `fieldsDenyList`, `fieldsFiltered` readonly, `avatarSrc`, `title`,
      `setLang`, `refreshCurrentUser`, `saveAndQuit`/`Stay`/`AddNew`/`AsCopy`, `deleteAndQuit` với `logout`,
      `toggleArchive`, `revert`, `provide('discardAllChanges' | 'refresh' | 'values')`, `useShortcut` hai phím; bỏ
      collab; template: page header FR-071, hộp user Q-18 (`BoAvatar` lớn, chip theo status) cùng bề ngang `max-w-5xl`,
      `BoForm`, hộp `unsaved_changes`, panel FR-074); xóa `src/routes/ProfileRoute.vue` + `ProfileRoute.test.ts` và
      cập nhật `src/router/*` nếu còn tham chiếu; manifest
- [x] T082 [US4] E2E `e2e/users-item.spec.ts` (`@core`): hộp user, sửa hồ sơ của mình (ngôn ngữ đổi ngay sang vi-VN rồi
      trả lại), role/policies, archive, tạo user từ `/users/+` và `roles/:id/+`, xóa user khác, xóa chính mình (user
      tạm) → logout, `/users/me` → `/users/<id>`; viết lại `e2e/profile.spec.ts` trên màn user (giữ kịch bản 012 còn
      hợp lệ); `e2e/users-tfa-token.spec.ts`: token tạo/tạo lại/xóa (dùng token mới gọi API), TFA bật/tắt với
      `otplib`, admin tắt TFA user khác, SSO: khóa localStorage + đăng xuất, `afterEach` tắt TFA bằng admin CHK031; ba
      cấu hình xanh
- [x] T083 [US4] Bộ so payload `e2e/payload/users.spec.ts` (`proxy-api`): tạo user, sửa (kể cả `language`, `theme_light`,
      overrides thêm/xóa khóa), archive, mời 2 email, token tạo/xóa, TFA bật/tắt (secret từ response), xóa hàng loạt;
      SC-005 10 thao tác; khác biệt thật → R-xx
- [ ] T084 [US4] Đóng lượt 3: cổng như T049 (SC-001, SC-003, SC-004, SC-005, SC-009; `LAZY_ONLY` không cần thêm; chunk
      màn user gồm theme JSON ≤ 15 KB gzip);
      spec 012 FR-024 và D-48 ghi "đã gỡ ở 015", D-44 "sau 015"; spec 013 D-57 phần sáu interface "đã gỡ ở 015";
      commit `feat(015): users directory, user page, system interfaces and theme data (wave 3)`; push; CI;
      `graphify update .`

**Checkpoint**: Lượt 3 xong; hai module đầy đủ trừ đối chiếu quyền và parity.

---

## Phase 8: User Story 6 - Tìm kiếm, bộ lọc, preset, xuất nhập, hàng loạt, quyền (Priority: P2) — Lượt 4

**Goal**: phần dùng lại 014 chạy đúng trên hai collection hệ thống; quyền theo bảng US6-3; `/register` giữ 012
(FR-090, FR-100 đến FR-103).

**Independent Test**: E2E `files-users-permissions.spec.ts` với ba user và lượt `vi-VN`.

### Tests cho User Story 6

- [x] T090 [P] [US6] Test `src/modules/files/routes/FilesCollectionRoute.browser.test.ts` và
      `UsersCollectionRoute.browser.test.ts` thêm: tìm kiếm + bộ lọc nâng cao gộp `_and` với bộ lọc hệ thống, preset ghi
      (`search`, `filter` không gồm hệ thống, `layout_*`) sau 450 ms, nút bookmark, Export/Import với bộ lọc gộp, nhập
      CSV → `POST /utils/import/directus_users`; quyền `bo-viewer`/`bo-editor` qua mock `/permissions/me`: nút
      khóa/ẩn theo bảng US6-3, không gửi `GET /roles` khi không `canInviteUsers`

### Implementation cho User Story 6

- [x] T091 [US6] Rà và sửa hai màn danh sách cho đúng FR-100 đến FR-102 (tooltip `not_allowed`, ẩn đúng chỗ Directus
      ẩn, `useItemPermissions` cho nút của màn item, panel ẩn dòng thiếu dữ liệu); kiểm `/register` vẫn là trang 012
      (FR-090) và `password-invite.spec.ts` giữ đích
- [x] T092 [US6] E2E `e2e/files-users-permissions.spec.ts`: `bo-editor` (quyền một phần: thư mục con vẫn hiện CHK068),
      `bo-viewer` (chỉ đọc: 13 nút của SC-002 (d) khóa/ẩn), lượt `vi-VN` cho `users-item` (nhãn field, ngày); tìm
      kiếm + bộ lọc + bookmark + xuất CSV + nhập CSV trên cả hai module; ba cấu hình xanh

**Checkpoint**: US6 xong.

---

## Phase 9: User Story 7 - Đối chiếu với Directus app, E2E ba cấu hình (Priority: P2) — Lượt 4

**Goal**: parity UI năm thuộc tính, bộ so payload đủ, benchmark, recipe duyệt (FR-110 đến FR-125).

**Independent Test**: `files-users-parity-ui.spec.ts` ở `proxy-api`; `benchmark:web` chạy tay một lần.

### Tests cho User Story 7

- [x] T095 [US7] E2E `e2e/files-users-parity-ui.spec.ts` (`proxy-api`, `DIRECTUS_APP_SPECS`): với ba user, thu
      `innerText`/`aria-disabled` của (a) sub-menu, (b) tiêu đề + breadcrumb, (c) số đếm và số chọn, (d) 13 nút, (e)
      mục panel ở `/files`, `/files/folders/<sub>`, `/files/<ảnh>`, `/users`, `/users/roles/<bo-editor>`, `/users/<bo-active>`
      trên hai app; 0 lệch ngoài D-xx (SC-002)

### Implementation cho User Story 7

- [ ] T096 [P] [US7] Benchmark `tests/benchmark/src/web-files-users.ts`: seed 10.000 file (multipart 1 KB, song song
      20) vào một thư mục và 10.000 user; ba phép đo (trang đầu cards, đổi trang, lọc `type`/`status`), 11 lần, p95,
      so Directus app ≤ +10 %; nối vào target `benchmark:web` (`tests/benchmark/project.json`) và `benchmark.yml`;
      chạy tay một lần bằng `gh workflow run benchmark.yml -f job=benchmark-web`, ghi kết quả vào `research.md` R10
- [x] T097 [P] [US7] Perf browser test `src/modules/files/perf.browser.test.ts` (cây 500 thư mục 3 cấp mở hết < 500 ms
      × `machineFactor()`; lưới 100 + 20 thẻ với data-URL 1×1 < 1 s; thả 20 file `maxConcurrency` 5 → ≤ 5 đồng thời,
      nạp lại 1 lần) và `src/modules/users/perf.browser.test.ts` (màn user: request đúng bảng SC-007; mở
      `ImageEditor` 4000×3000 < 2 s từ `load` tới `ready` đặt ở `src/components/files/ImageEditor.perf.browser.test.ts`);
      thêm vào bước `web perf` của `.github/workflows/ci.yml`
- [x] T098 [US7] Đối chiếu recipe nháp với code (như T098 của 014): sửa recipe Q-13 đến Q-19 theo code đã dựng ("Built:",
      "Deviation", "Open"), cập nhật `design-review/README.md`; gửi design owner; bảng Q của spec cập nhật trạng thái

---

## Phase 10: Polish & đóng feature — Lượt 4

- [x] T100 [P] Rà a11y: axe sáng/tối trên 8 màn + 3 hộp thoại mở (SC-008) trong browser test; `qa/handoff-checklist.md`
      đạt (ngoại lệ khung cắt ghi rõ)
- [x] T101 [P] Bundle: `BUDGET_015` trong `scripts/check-bundle.mjs`, `LAZY_ONLY` đủ (`cropper-container`,
      `Tus-Resumable`), ngân sách chunk lười (cropperjs ≤ 60, tus ≤ 25, theme ≤ 15 KB gzip) kiểm bằng test của script
- [x] T102 [P] Coverage `apps/web` ≥ 60 % gộp; bổ sung test cho file dưới 50 %
- [x] T103 Cập nhật spec 015: bảng "Trạng thái khác biệt" D-83 đến D-90 với file đã làm, R-xx mới (nếu có) từ T048,
      T083, T095; `research.md` các mục [Unverified] → kết quả; spec 012 (D-40 Files/Users, D-48 "đã gỡ ở 015", D-44
      "sau 015", FR-024), 013 (D-57 sáu interface, D-59, FR-051/FR-054), 014 (D-72 phần 015) ghi theo FR-121;
      `CLAUDE.md` mục "Recent Changes" thêm dòng 015; `SPECKIT-GUIDE.md` ghi chú từ 015 cho 016 (interface `_system`
      còn lại, "sửa role" D-85) và 018 (D-90 upload dở)
- [ ] T104 Đóng lượt 4: cổng như T049 + `e2e-web` ba cấu hình đủ 9 spec + 2 payload + parity (SC-001 đến SC-004,
      SC-007, SC-009); `benchmark.yml` chạy tay
      xanh; commit `feat(015): permissions, parity, benchmark and closing (wave 4)`; push; CI xanh; `graphify update .`;
      tech lead duyệt D-83 đến D-90 (SC-010); design owner duyệt Q-13 đến Q-19 (SC-008)

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): T001 chặn mọi task khác (không sửa `apps/web` trước khi 014 đóng); T002–T007 sau T001; T005–T007
  song song.
- Phase 2 (Foundational): sau Phase 1; chặn mọi story. T010, T011, T012, T016 song song; T013 trước T014; T014 trước
  T015; T017 sau T011; T018 sau T011; T019 độc lập; T020 độc lập; T021 → T022; T023 sau T021; T024, T025 song song.
- Phase 3 (US1) và Phase 4 (US2): sau Phase 2; US2 dùng `FilesCollectionRoute` của US1 (T044 sửa T035) và
      `FileItemRoute` cần `FilePreviewReplace` (T045); T049 đóng lượt 1.
- Phase 5 (US5): sau lượt 1 (T046 có cờ tạm cho nút chỉnh ảnh); T055 đóng lượt 2.
- Phase 6 (US3) và Phase 7 (US4): sau lượt 2 (độc lập với Files về code, chung store/presets và harness của Phase 2);
  US4 cần T063 (route) của US3; T084 đóng lượt 3.
- Phase 8 (US6), 9 (US7), 10: sau lượt 3; T104 đóng feature.

### User Story Dependencies

- US1 → không phụ thuộc story khác (MVP).
- US2 → US1 (màn thư viện cho kéo thả, route `+`).
- US5 → US2 (màn file) và 013 `file-image`.
- US3 → Phase 2; độc lập với US1/US2.
- US4 → US3 (route users, cây role trong sub-menu của màn user).
- US6 → US1–US4 (quyền và phần dùng lại trên cả hai module).
- US7 → tất cả.

### Within Each User Story

Test trước (viết test đỏ), rồi utils/composable → component → route → E2E → payload; mỗi task chép kèm manifest và
header nguồn; sau mỗi phase chạy bốn cổng.

### Parallel Opportunities

- Phase 1: T005, T006, T007.
- Phase 2: T010, T011, T012, T016, T018, T019, T020, T024, T025.
- US1: T030, T031, T032 (test); T034 cùng T033.
- US2: T040, T041, T042 (test); T043, T045 cùng nhau.
- US5: T050, T051.
- US3: T060, T061, T062; T064, T065.
- US4: T070–T073; T074, T075, T076, T077, T080.
- US7: T096, T097; Polish T100–T102.

## Parallel Execution Examples

```text
Lượt 1, Phase 2 (sau T001–T007):
  song song: T010 get-folder-filter/delete-folder | T011 use-folders | T012 store files | T016 use-dialog-route | T019 cards | T020 presets
  rồi: T013 server store → T014 upload-file(s) → T015 BoUpload
  rồi: T017 FilesNavigation (cần T011) | T018 FolderPicker (cần T011) | T021 seed → T022 parity seed → T023 mock API | T024 harness | T025 lang

Lượt 3, Phase 7 (US4):
  song song: T070 theme tests | T071 interface tests | T072 tfa tests | T073 route test
  song song: T074 sync themes | T075 use-tfa-setup | T076 language+password | T077 token | T080 UserInfo
  rồi: T078 mfa (cần T075) → T079 theme + overrides (cần T074) → T081 UserItemRoute → T082 E2E → T083 payload → T084 đóng lượt
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 → Phase 2 → Phase 3 (US1): thư viện duyệt được, thư mục quản lý được, E2E `files-library` xanh ba cấu hình.
2. Dừng và kiểm: so cây thư mục, thẻ thư mục, số đếm với Directus app trên cùng DB.

### Incremental Delivery

1. Lượt 1 (US1 + US2): thư viện + tải lên + màn file → commit, CI.
2. Lượt 2 (US5): trình chỉnh ảnh dùng chung → commit, CI.
3. Lượt 3 (US3 + US4): danh bạ, mời, màn user, sáu interface, dữ liệu theme, bỏ `ProfileRoute` → commit, CI.
4. Lượt 4 (US6 + US7 + Polish): quyền, parity, benchmark, a11y, bundle, tài liệu, duyệt → commit, CI, đóng.

## Ghi chú khi làm

- 2026-10-16: T001 theo quyết định owner (bắt đầu trước "014 closed", ranh giới ghi ở research "Kết quả kiểm T002,
  T003"); T002/T003 xong, kết quả ở research; preset mặc định `directus_users` là `tabular` (spec sửa); nhãn theme cần
  owner chốt lại trước T079.
- Phase 2 (2026-10-16):
  - `uploadFile` multipart đi qua SDK (`uploadFiles` POST, `updateFile` PATCH, như `BoUpload` 013) thay cho
    `uploadWithProgress`: test `BoUpload` giả lập `fetch`; tiến độ multipart theo file xong, TUS theo byte. TUS kiểm
    bằng `vi.mock('tus-js-client')` thay cho `FakeXMLHttpRequest`.
  - `use-dialog-route` không giữ route chờ hiệu ứng đóng (`BoDialog` không có hook `leave`).
  - `systemDefaults` của Directus có sáu collection (files, users, activity, roles, policies, presets), chép đủ.
  - Cây dùng chung `composables/use-tree-keyboard.ts` cho cây thư mục, picker và cây role (cây 014 giữ bản riêng).
  - Bộ mẫu 015 dùng cây thư mục riêng `bo-files` > `bo-files-sub` > `bo-files-deep` (không thêm vào `bo-fixtures` để
    snapshot 013 không đổi); snapshot thêm `folders.json`, `files.directory.json`, `roles.json`,
    `users.directory.json` ở cuối; `bo-invited` tạo bằng `POST /users` với `status: invited` (không gọi
    `/users/invite` để seed không phụ thuộc gửi email).
  - T024: allowlist (#97–#134, chặn `DELETE /users/me`) và `helpers.spec.ts` xong; `helpers/files.ts` viết cùng
    T036; helper Directus app (`directus-app.ts`) và `DIRECTUS_APP_SPECS` của `playwright.config.ts` để T048 (sau khi
    014 báo đóng).
  - T025: overlay `theme_applies_in_directus` chuyển sang T079 (lượt 3).
- Phase 3 và 4 (2026-10-16):
  - Test chạy ở project `unit` (happy-dom) thay cho `*.browser.test.ts`: `FilesCollectionRoute.test.ts` (kéo thả với
    DataTransfer giả), `FileItemRoute.test.ts`, `folder-dialogs.test.ts` (AddFolder, DeleteFolderDialog,
    FolderSection). Bản sao, hộp `unsaved_changes` và revisions được kiểm ở E2E `files-item.spec.ts`. axe của màn file
    để T104.
  - FR-037: xóa ở màn file về `/files` như Directus (`useItem.remove` đặt item null nên `to` là thư viện); spec đã sửa.
  - `FileItemRoute` truyền `fields` cho `BoForm`, không truyền `collection`. Lý do: `BoForm` ưu tiên `collection` nên
    sẽ hiện lại các field của `fieldsDenyList` (giống Directus).
  - Màn không tìm thấy là `ContentNotFound` với prop `module` (`content`, `files`, `users`) và điều hướng của module đó.
    Không có `FilesNotFound.vue`.
  - `FileInfoSidebarDetail` giữ file của lần gọi trước `await`. Lỗi `pageerror` khi rời trang trong lúc đọc user được
    E2E bắt.
  - Hộp `+` tự đóng khi tải xong (Directus `@input="close"`); E2E kiểm theo hành vi đó.
  - T047: import từ URL đọc `http://files-fixtures/photo.jpg` của môi trường parity (API tải URL ở phía server, stub
    trình duyệt `files.example` không tới được). File sai kiểu chưa có E2E vì `mimeTypeAllowList` mặc định là `*/*`.
    Nhánh TUS chưa chạy E2E vì profile `app` không bật TUS (T002). Cả hai để T104.
  - `playwright.config.ts`: `CONTENT_NOT_CORE` mở rộng cho `files-*` và `users-*` (ngoài chromium chỉ chạy `@core`).
  - E2E `files-*` chạy xanh ở cấu hình dev: chromium-768/1280, và `@core` trên firefox-1280/webkit-1280 qua Vite dev
    server. Ba cấu hình proxy/cors chạy ở CI vì `apps/web/dist` thuộc 014 và không được build lại.
  - T048 hoãn tới khi 014 báo đóng (cần `directus-app.ts` và `DIRECTUS_APP_SPECS`).
- Lượt 2 (2026-10-16):
  - `ImageEditor` giữ instance Cropper trong `ref` sâu như Directus (`hasEdits` đọc `getData()` qua proxy). Cropper.js
    và CSS nạp lười: chunk 12 KB gzip, entry không đổi (238,6 KB). `vite.config.ts` thêm `cropperjs`, `tus-js-client`
    vào `optimizeDeps.include`.
  - `BoDrawer` thêm prop `flush` (rộng hết màn, thân không padding). `BoMenu` thêm `active` (`menuitemradio`, dấu
    check) và `divider`. Công cụ đang chọn dùng kiểu segmented control của TailAdmin (nền trắng, `gray-800`) vì
    `brand-500` trên `brand-50` không đủ tương phản (axe). Ghi lại khi so recipe Q-16 ở T097.
  - Ảnh có `crossorigin="use-credentials"` để cấu hình cors giữ cookie phiên và canvas không bị "tainted".
  - Xoay sau khi cắt: ảnh lưu giữ khung cắt như trên màn hình (200×100), dòng kích thước swap theo Directus
    ("-> 100x200"). E2E so pixel với Directus app xác nhận hai bên giống nhau.
  - `files-image-editor.spec.ts` vào `DIRECTUS_APP_SPECS` (chỉ chromium-1280). So pixel chỉ chạy ở `proxy-api`.
  - `createAllowed`/`updateAllowed` của `file-image` lấy từ `useRelationPermissionsM2O` như Directus (tasks ghi
    `useCollectionPermissions`).
- Lượt 3 (2026-10-16):
  - Sáu interface `_system`, dữ liệu theme (`sync-directus-themes.mjs`, `directus-themes.json`, `rules-to-css-vars`)
    và `use-tfa-setup` do một agent con làm song song (T070–T072, T074–T079). Ba interface theme/mfa nạp lười: các
    chunk khoảng 8,5 KB gzip. Nhãn theme theo lựa chọn (a) của owner: overlay en-US/vi-VN đổi ba khóa
    `theme_directus_*` thành "Backoffice …", `id` ghi DB giữ "Directus …" (D-88); dòng ghi chú
    `theme_applies_in_directus` theo owner (2026-10-16): "Theme được lưu vào hồ sơ. Giao diện Backoffice không đổi."
    (en-US tương ứng), không nêu tên Directus; bỏ ngoại lệ `data-brand-allowed` của `branding.spec`.
  - `UsersNavigation` gộp `navigation.vue` và `NavigationRole.vue` thành cây phẳng (§11), như `FilesNavigation`.
  - `UserMenu` trỏ hồ sơ tới `/users/<id>`; `ProfileRoute` 012 đã xóa, `profile.spec.ts` viết lại trên màn user (lưu
    bằng "Save and Stay").
  - Mock `POST /users/invite` theo Directus `UsersService.inviteUser`: user đã có thì bỏ qua (không lỗi), user
    `invited` đổi role; `RECORD_NOT_UNIQUE` chỉ từ DB nên test tự trả lời.
  - Mock mở rộng m2o hệ thống `directus_users.role`, `directus_users.avatar` (không đưa vào `GET /relations`).
  - Hợp đồng API thêm dòng 135 `GET /roles/<id>` (field role của form) và 136 `GET /access` (field policies), như
    Directus.
  - Xóa hàng loạt rồi danh sách nạp lại nhưng số đếm giữ giá trị cũ: `use-items` memo hóa aggregate như Directus
    (`useMemoize`), nên E2E không kiểm "No Results" sau khi xóa.
  - T048, T083: bộ so payload `payload/files.spec.ts` (thư mục, màn file, tải lên + thay file, chuyển hàng loạt) và
    `payload/users.spec.ts` (tạo, sửa appearance + archive, mời, token, xóa hàng loạt) khớp Directus app ở `proxy-api`.
    Bỏ qua `/presets` (bộ presets riêng của 014) và thay token ngẫu nhiên bằng `<token>`. TFA không so payload (secret
    sinh mỗi lần), đã có E2E `users-tfa-token.spec.ts`. SSO TFA chỉ có browser test (E2E không đăng nhập được user SSO).
  - `AdminApi` gửi `Cache-Control: no-store`; `files-item` chờ PATCH trước khi đọc lại (đỏ ở CI 38787246409).
- Lượt 4 (2026-10-16):
  - T095 `files-users-parity-ui.spec.ts`: sáu màn × ba user khớp Directus app ở `proxy-api` (sub-menu, tiêu đề,
    breadcrumb, số đếm, trạng thái nút, mục panel). Màn user mà user không đọc được: Directus hiện form "Adding User",
    app mới hiện màn không tìm thấy (FR-054, CHK047), nên màn đó chỉ so cho admin.
  - T092: "Download Page as CSV" khóa ở danh bạ và thư viện, giống Directus (không truyền `onDownload`); xuất CSV đi qua
    hộp "Export Items".
  - T097 (agent con): ba perf test qua với `PERF=1`. File của trình chỉnh ảnh là
    `components/files/perf.browser.test.ts` vì mẫu exclude của vitest chỉ khớp đúng tên `perf.browser.test.ts`. SC-007
    sửa theo số request đo được (giống Directus).
  - T100: `modules/files-users.a11y.browser.test.ts` (10 màn và hộp thoại, sáng/tối) qua; icon avatar dự phòng đổi
    sang `gray-500` (tương phản). `a11y.spec.ts` chờ `networkidle` trước khi quét trang user.
  - T101: `LAZY_BUDGETS_015` trong `check-bundle.mjs` (cropperjs 11,9 KB, tus 15,5 KB, theme 3,2 KB gzip).
  - T098: recipe Q-13 đến Q-19 có dòng Built/Deviation/Open; chờ design owner duyệt (SC-008).
  - T096 (agent con) đã viết: `tests/benchmark/src/web-files-users.ts`, target `benchmark:web-files-users`, bước mới
    trong job `benchmark-web` của `benchmark.yml`; typecheck và lint qua. Chưa chạy: môi trường benchmark dùng chung cổng
    6100/6108/8155/8156 với môi trường parity đang chạy. Kết quả ghi vào research R10 sau lần chạy CI đầu tiên.
  - T104 chưa xong: push bị chặn trong phiên tự chạy (chế độ auto), nên CI và `benchmark.yml` chưa chạy; tech lead
    duyệt D-83 đến D-90 và design owner duyệt Q-13 đến Q-19 là việc của người.
  - 2026-10-16 owner duyệt Q-13 đến Q-19 (Q-14 đổi: ô chọn thẻ tên "Select <tên thẻ>" qua `aria-labelledby` ở
    `layouts/cards/components/Card.vue`), D-83, D-85, D-88, D-90, R-39 và màn user không có quyền đọc (FR-054); còn D-86,
    D-89, push và CI.
- T004: `tools/check-package-names.mjs` chỉ kiểm gói `@directus/*`, cropperjs không cần thêm; `sharp` (catalog) thêm
  vào devDependencies của `apps/web` cho T021.
