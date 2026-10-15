# Research: Module Files và Users (015)

Ngày 2026-10-15. Mỗi mục: quyết định, lý do, phương án bỏ. Directus tham chiếu 11.17.4 (`directus/app` 15.10.0,
`@directus/themes` trong `directus/packages/themes`, `@directus/utils` 13.4.1). Dòng [Unverified] đã kiểm ở T002 và các lượt sau (2026-10-16, ghi "Đã kiểm"); ban đầu kiểm ở task đầu lượt
1 (T002 như 013, 014); kết quả ghi lại vào file này.

## R1. Thư viện và phiên bản

**Quyết định**: cùng bản Directus 11.17.4 ở gói quyết định hành vi hoặc dữ liệu; thêm vào catalog `pnpm-workspace.yaml`
nhóm "Web" khi chưa có. Đã có: `p-queue` 8.1.0 (apps/web), `nanoid`, `lodash-es`, `color` 5.0.2, `@vueuse/core` 14,
`@directus/sdk` 21.3.0, `@directus/utils` 13.4.1, `@directus/types` 15.0.3, `reka-ui` 2.8.2.

| Gói | Bản (catalog Directus) | Giấy phép | Dùng cho | Ghi chú |
|-----|------------------------|-----------|----------|---------|
| `cropperjs` | 1.6.2 (`directus/pnpm-workspace.yaml`) | MIT | `ImageEditor` (FR-040 đến FR-044) | Cùng major và cùng option (`viewMode 1`, `autoCropArea 0.5`, `imageSmoothingQuality high`) để kích thước và điểm ảnh sau cắt bằng Directus (SC-006); CSS `cropper.css` của gói nạp trong chunk lười, biến màu khung cắt đè bằng token theme (recipe Q-16) [Đã kiểm: `cropperjs/dist/cropper.css` nạp lười cùng chunk của editor] |
| `tus-js-client` | 4.3.1 (đã có trong catalog, API dùng) | MIT | `uploadFile` khi `info.uploads.tus` (FR-022, Clarifications TUS = A) | Cùng option như `utils/upload-file.ts`: `chunkSize`, `metadata`, `removeFingerprintOnSuccess`, `onBeforeRequest` đặt `withCredentials`, `onShouldRetry` false, `findPreviousUploads`; endpoint `getRootPath() + 'files/tus'` → ở app mới là `PUBLIC_URL` của sdk |
| `flat` | 6.0.1 (catalog, API dùng) | BSD-3 | `rulesToCssVars` (R6) | Hoặc hàm làm phẳng 10 dòng; chọn ở T002 theo kích thước chunk |

**Không thêm**: `@directus/themes` (ESM `workspace:*`, kéo theo Pinia store và Vue plugin của Directus; chỉ cần dữ liệu
rule: R6), `decamelize` (một regex), `exifr` (API ghi `metadata`), `axios` (sdk + `apiFetch`), thư viện cây thư mục
(cây là `<ul>` lồng như 014 §9).

**Phương án bỏ**: cropperjs 2.x (API khác, kết quả cắt khác Directus → SC-006 đỏ); upload chia khối tự viết (TUS là
giao thức có máy chủ ở 007, client Directus dùng đã kiểm); thư viện zip phía client cho tải nhiều file (API đã có
`POST /assets/files`).

## R2. Route, sub-menu cây thư mục và cây role (Clarifications Q3 = A)

**Quyết định**:

- `modules/files.ts`, `modules/users.ts` thay `placeholderRoutes` bằng route chép từ `modules/files/index.ts` và
  `modules/users/index.ts` (data-model §1); component route là `() => import(...)` (chunk lười). `/users/me` giữ
  (`redirect` tới `/users/<id>` qua guard đọc store user; D-86); `UserMenu` trỏ `/users/<id>`.
- Slot `navigation` của `PrivateView` (012, 014 đã dùng cho `ContentNavigation`) nhận `FilesNavigation.vue` (chép
  `files-navigation.vue` + `files-navigation-folder.vue`) và `UsersNavigation.vue` (chép `navigation.vue` +
  `NavigationRole.vue` + `use-navigation.ts`). Cây dùng cùng mẫu DOM của 014 §9: nhóm là `<button aria-expanded>` +
  `<ul>` lồng, vai trò `tree`/`treeitem`, phím mũi tên; menu chuột phải của thư mục và role là `contextmenu` + nút
  "⋯" (`BoMenu`) để có đường bàn phím (như 014 D-69 cho menu header). Recipe Q-13, Q-17 ghi vào `layout-patterns.md`
  §11 (mới) trước khi code; §7 dòng "Module navigation" thêm Files và Users vào ngoại lệ.
- `useFolders` chép `composables/use-folders.ts` (state module-level: `folders`, `nestedFolders`, `openFolders`
  `['root']`, `fetchFolders` với `fetchAll` chép `utils/fetch-all.ts` nếu 014 chưa có [Đã kiểm T002: `fetchAll` đã có ở 014; ghi chú gốc:
  014 cho `FolderPicker` của Export? kiểm T002]); `useNavigation` của users chép nguyên (`groupBy` của lodash-es).
- `checkForSystem` và `get-item-route.ts` của 014 không đổi: `/content/directus_files|users` đã trỏ đúng route; chỉ
  đích đổi từ khung sang màn thật (D-72 gỡ phần 015).

**Phương án bỏ**: sub-menu một cấp với cây trong vùng nội dung (Q3 = B), cột điều hướng thứ hai (Q3 = C).

## R3. Danh sách file: preset, layout cards với thư mục, kéo thả, tải lên

**Quyết định**:

- `use-preset` và `use-layout` của 014 dùng nguyên; store `presets` thêm `defaultPresets` hệ thống chép từ
  `stores/presets.ts` Directus (`directus_files`: `cards` với `icon: insert_drive_file`, `title`, `imageSource: null`
  [Đã kiểm T002 (CHK001): chép nguyên `systemDefaults`; `directus_users` là `tabular`], `directus_users`: `cards` với `icon: account_circle`,
  `title`, `subtitle`, `imageSource: avatar`...) để `getPresetForCollection` trả đúng mặc định khi chưa có preset (012
  ghi chú "no system default presets" sửa theo).
- Layout `cards`: thêm lại `extraSelection` (v-model), slot `prepend`, prop `hasPrependContent`, event `select-all`
  đúng như `layouts/cards/cards.vue` và `components/header.vue` Directus (chép lại phần 014 đã bỏ, ghi chú đầu file
  sửa). `FolderSection.vue` (chép) dùng `Card.vue` của 014 với `icon="folder"`, `to`, `select-mode`.
- Màn thư viện chép `routes/collection.vue`: `getFolderFilter` (chép `utils/get-folder-filter.ts`, `subDays` của
  date-fns đã có), `folderSelection`, `isTransitioning`, `useMovetoFolder`, `downloadFiles` (`apiFetch` blob tới
  `/assets/:id?download` hoặc `POST /assets/files`), `useFileUpload` với bốn listener trên `window`; viền thả là bốn
  `div` cố định quanh `main` (token `border-brand-500`), notice `drop_to_upload` và tiến độ là `BoNotice` trong page
  header (D-66) với `aria-live=polite`.
- `uploadFile`/`uploadFiles`: chép `utils/upload-file.ts`, `utils/upload-files.ts` vào `src/utils/`; nhánh multipart
  của `uploadFile` gọi `uploadWithProgress` 013 (giữ file), `BoUpload` 013 chuyển sang gọi `uploadFiles` (chốt, CHK056); thêm prop `fileId` (thay file, `PATCH /files/:id` multipart hoặc TUS với `id`);
  store server đọc `uploads` (`tus`, `chunkSize`, `maxConcurrency`) từ `/server/info` (ghi chú D-41 ở `server.ts`
  sửa: `uploads` nay được đọc). Store `files` (đếm upload đang chạy) chép `stores/files.ts`.
- Hộp `add_file` theo route `+`: `useDialogRoute` chép (`isOpen` theo `route.matched`), `BoDialog` với `BoUpload`
  `multiple fromUrl folder accept`.

**Phương án bỏ**: vùng thả chỉ trong `BoUpload` (Directus nhận thả toàn cửa sổ); tải tuần tự (Directus dùng
`maxConcurrency`).

## R4. Màn file, thay file, chuyển thư mục, chi tiết file

**Quyết định**: chép `routes/item.vue` thành `FileItemRoute.vue` trên `use-item` 014 (`directus_files`), bỏ collab
(D-68); `FilePreviewReplace.vue` chép (`FilePreview` 013 + nút "thay file" + hộp `BoUpload fileId`); `FolderPicker.vue`
và `FolderPickerListItem.vue` chép (cây chọn một, `disabledFolders`); `FileInfoSidebarDetail.vue` chép trên
`SidebarDetail` 014 (dl/dt/dd, `UserPopover` 013, `readableMimeType`, `formatFilesize`, `localizedFormat` có sẵn);
`saveAsCopyAndNavigate` chép (lấy blob `/assets/:id` qua `apiFetch`, `uploadFile` với preset); tải về là `<a download>`
tới `/assets/:id?download=` (sdk `getAssetUrl` 013). Breadcrumb và nút quay lại theo `folder` của item.

**Phương án bỏ**: tái dùng `ItemRoute` của Content với slot (khác header, không có `fieldsDenyList`, không có xem trước
và trình chỉnh ảnh; màn file của Directus là file riêng).

## R5. Trình chỉnh ảnh (D-59 gỡ)

**Quyết định**: `components/files/ImageEditor.vue` chép `image-editor.vue` trên `BoDrawer` (013, `persistent`,
slot `actions`), Cropper.js 1.6.2 nạp lười (`import('cropperjs')` khi mở, CSS kèm), toolbar là nhóm `<button>` có
nhãn (`BoTooltip`), menu tỉ lệ là `BoMenu`, `custom_aspect_ratios` từ store settings; `save()`/`saveAsNew()` chép
nguyên (FormData qua `apiFetch` `PATCH /files/:id` và `POST /files`; sdk `uploadFiles` không cho `PATCH` nên dùng
`apiFetch` như `BoUpload` 013). Khung cắt và điểm focal chỉ chuột (Clarifications: D-87 bỏ); ngoại lệ a11y ghi
`qa/handoff-checklist.md`. `file-image` 013 thêm nút `tune` mở `ImageEditor` với `id` của file, `createAllowed` từ
`useCollectionPermissions('directus_files')`, `refresh` nạp lại xem trước với `cacheBuster`, `new-file` đặt giá trị
field (FR-045). Test: browser project với ảnh PNG cố định trong `test-utils`, mock `PATCH` ghi lại FormData; E2E
SC-006 so `width`, `height`, focal và điểm ảnh giải mã (`page.evaluate` vẽ hai ảnh vào canvas rồi so `ImageData`).

**Phương án bỏ**: cropperjs 2 (R1); trình chỉnh ảnh tự viết trên canvas (mất tỉ lệ, xoay, flip của Cropper và khác
kết quả Directus).

## R6. Sáu interface `_system` và dữ liệu theme (Q1 = C, D-88, D-89)

**Quyết định**:

- `system-language`: `BoSelect` với `available-languages.json` của 012 (en-US, vi-VN; mã lạ hiện thô D-46) và mục
  `default_language` khi `includeProjectDefault`.
- `system-input-password`: `BoInput` + nút mắt (không có màn dùng ở 015, port cho đủ bộ D-57).
- `system-mfa-setup`: port trên `use-tfa-setup` 012 mở rộng (`disableTFA` `POST /users/me/tfa/disable`,
  `adminDisableTFA` `POST /users/:pk/tfa/disable`, `requestTFASetup` ghi khóa `backoffice-require_tfa_setup` rồi
  `logout`, `cancelTFASetup`); giá trị form lấy từ `inject('values')` mà `BoForm` 013 cung cấp [Đã kiểm T002: BoForm `provide('values')`, không cần dự phòng] và `discardAllChanges`, `refresh` do màn user `provide`; QR bằng `qrcode` 1.5.4 (012).
- `system-token`: port nguyên; `PATCH <getEndpoint(collection)>/<pk>` qua sdk; `useClipboard` của 012/013.
- `system-theme` (C): `ThemePreview.vue` chép `theme-preview.vue` (SVG 200×140 với biến `--theme--*` đặt inline bằng
  `rulesToCssVars(theme.rules)` cộng overrides của user đã gộp bằng `lodash-es` `merge`); danh sách theme theo
  `appearance`; `includeNull` thêm mục `default_sync_with_project` với theme mặc định dự án (`default_theme_light|dark`
  của `/server/info`; store server 012 đã có `auth.disableDefault` (FR 012), `project.default_theme_*` thêm ở 015
  (CHK093).
- `system-theme-overrides`: port ba SFC; `type: 'color'` cho mọi rule lá như Directus; swatch dùng `color` 5.0.2 và
  `cssVar` chép từ `@directus/utils/browser` [Đã kiểm T002: `cssVar` có trong `@directus/utils/browser` 13.4.1; ghi chú gốc về dự phòng:
  `getComputedStyle(document.documentElement).getPropertyValue`, CHK094].
- Dữ liệu rule: script `apps/web/scripts/sync-directus-themes.mjs` đọc bốn file `directus/packages/themes/src/themes/
  {light,dark}/*.ts` (import động qua `tsx`/`jiti` hoặc regex `defineTheme({...})` → chọn ở T002), ghi
  `apps/web/src/theme/directus-themes.json` (`{ light: Theme[], dark: Theme[] }` với `id`, `name`, `appearance`,
  `rules`); test `directus-themes.test.ts` so file sinh với nguồn (như script sync chuỗi dịch 012, FR-121). Kích
  thước: ~840 dòng TS → JSON ~30 KB, nạp lười cùng chunk màn user (R10). `rulesToCssVars` port 10 dòng (làm phẳng
  với `--`, decamelize bằng regex `/([a-z\d])([A-Z])/g`).
- Overrides của user vẫn áp lên theme Backoffice qua `OVERRIDE_MAP` của 012 (D-43); `ThemePreview` chỉ dùng để xem
  trước theme Directus (D-88 ghi dòng chú thích).

**Phương án bỏ**: import `@directus/themes` (R1); cây overrides tự thiết kế (dữ liệu ghi ra phải cùng khóa Directus).

## R7. Danh bạ user, mời, màn user

**Quyết định**: `UsersCollectionRoute.vue` chép `routes/collection.vue` (bộ lọc hệ thống `role`/`status`,
`canInviteUsers` từ `serverStore.auth.disableDefault` [Đã kiểm T002: store 012 có `auth.disableDefault`; ghi chú gốc:
`disableDefault` → có], `UsersInvite.vue` chép với `BoDialog`, `BoTextarea`, `BoSelect`, notice lỗi tại chỗ, dòng
D-83 sau khi đóng); `UserItemRoute.vue` chép `routes/item.vue` trên `use-item` 014 (`fields=*,role.*,avatar.id,
avatar.modified_on`, `edits.role` từ prop, `fieldsDenyList`, readonly `provider`/`external_identifier`, `setLang`,
`refreshCurrentUser`, archive qua `archive_field` của `directus_users` trong store collections, xóa chính mình →
`logout`), hộp user (recipe Q-18) với `BoAvatar` 012 cỡ lớn, `UserInfoSidebarDetail.vue` chép; `ProfileRoute` 012 xóa,
`profile.spec.ts` viết lại trên màn user. `BoForm` nhận các field hệ thống của `directus_users` từ store fields (012
hydrate `/fields`), gồm `list-m2m` tới `directus_access` (013) và `select-dropdown-m2o` role.

**Phương án bỏ**: giữ `ProfileRoute` cố định của 012 song song (hai màn hồ sơ, D-48 không gỡ).

## R8. Quyền

**Quyết định**: `useCollectionPermissions`/`useItemPermissions` 014 cho bốn collection hệ thống; nút khóa/ẩn theo
bảng US6-3; `preRegisterCheck` giữ 012. Field hệ thống chỉ đọc theo `users.yaml`/`files.yaml` do store fields cung cấp
(`meta.readonly`), `BoForm` 013 tôn trọng. `token`: ô cho phép tạo khi field không `disabled` (API tự kiểm quyền).

## R9. Kiểm thử (`contracts/tests.md`)

**Quyết định**: như 014: Vitest `unit` + `browser` với `mockFixtureApi` mở rộng (#97 trở đi: `/folders` CRUD, `/files`
multipart và `PATCH` multipart, `/files/tus` tối thiểu [Đã kiểm: test TUS ở unit với `vi.mock('tus-js-client')`; ghi chú gốc:
browser project với `page.route`-style mock bằng `msw`? không: dùng `fetch` mock của `test-utils/fetch.ts`, tus dùng
XHR → bọc `XMLHttpRequest` giả trong test; chọn ở T002], `/users/invite`, `/users/*/tfa/*`, `/utils/random/string`,
`/assets/folder/:id`, `/assets/files`); bộ mẫu `bo_files` (thư mục `bo-fixtures` của 013 mở rộng: 3 cấp, 30 file, EXIF
từ ảnh mẫu `tests/parity/fixtures`? [Đã kiểm T021: không có ảnh sẵn; seed tạo `bo-exif.jpg` bằng `sharp`; ghi chú gốc:
`withMetadata` ở seed]) và `bo_users` (role `bo-editor`, `bo-viewer` 013 + role con `bo-sub`, user mỗi trạng thái, user
SSO giả `provider: 'bo-sso'`? — `provider` phải là provider có cấu hình để đăng nhập; chỉ cần dữ liệu nên đặt
`provider: 'oidc'` của env parity `sso` [Đã kiểm T002 (CHK030): provider `oidc`]); E2E chín spec ở
ba cấu hình, bộ so payload thêm `files.spec.ts`, `users.spec.ts`; parity UI `files-users-parity-ui.spec.ts` chỉ
`proxy-api`; benchmark web thêm `files`, `users`.

## R10. Hiệu năng và bundle

**Quyết định**: chunk lười: `ImageEditor` + cropperjs + CSS, `tus-js-client` (import động trong `uploadFile` khi
`uploads.tus`), `directus-themes.json` + `ThemePreview` + `system-theme-overrides` (nạp cùng màn user); chunk chính
≤ ngân sách 014 + 20 KB (`BUDGET_015` trong `check-bundle.mjs`, `LAZY_ONLY` thêm `cropper-container`, `tus-js-client`
marker `Tus-Resumable`). Perf browser test (`PERF=1`, `machineFactor()` của 014): cây 500 thư mục < 500 ms, lưới 100 +
20 thẻ < 1 s, mở trình chỉnh ảnh 4000×3000 < 2 s sau khi ảnh tải; số request như SC-007.

## R11. Chuỗi dịch

**Quyết định**: khóa của Files, Users, sáu interface, trình chỉnh ảnh đã có trong `en-US.json`/`vi-VN.json` sinh ở
012 (sinh từ toàn bộ `en-US.yaml`) [Đã kiểm 2026-10-16: `vi-VN.json` có 1 trên 14 khóa `interfaces.system-token.*`; 13 khóa còn lại hiện tiếng Anh qua `fallbackLocale` en-US, như 012; ghi chú gốc:
`delete_folder_dialog.*`; thiếu thì rơi về en-US theo cơ chế fallback của vue-i18n, chấp nhận; `keys.test.ts` chỉ
kiểm en-US (CHK096)]; `lang/keys.test.ts` mở rộng cho
`modules/files`, `modules/users`, `interfaces/_system/system-*`; chuỗi riêng D-83 dùng `contact_admin_for_link` đã có
trong overlay; D-88 thêm một khóa overlay `theme_applies_in_directus` (en-US, vi-VN).

## R12. Bốn lượt commit (FR-123) và điều kiện

| Lượt | Nội dung | Điều kiện vào |
|------|----------|---------------|
| 1 | T001 xác nhận 014 đóng (tin nhắn của phiên 014 "đã đóng" + CI xanh commit cuối, CHK097), R1 kiểm T002, recipe nháp Q-13 đến Q-16, route Files, cây thư mục, store presets mặc định, cards `extraSelection`/`prepend`, thư viện, thư mục CRUD, tải lên (TUS + multipart), màn file, chi tiết file, E2E `files-library`, `files-upload`, `files-item` | 014 báo đóng (CI xanh commit cuối) và push xong (quy tắc session 014) |
| 2 | `ImageEditor`, nút chỉnh ảnh của `file-image`, E2E `files-image-editor`, SC-006 | lượt 1 xanh |
| 3 | recipe Q-17 đến Q-19, route Users, cây role, danh bạ, mời, màn user, sáu interface, dữ liệu theme, bỏ `ProfileRoute`, E2E `users-directory`, `users-item`, `users-tfa-token` | lượt 2 xanh |
| 4 | quyền, payload suite, parity UI, benchmark, a11y, perf, bundle, ghi "đã gỡ ở 015" ở spec 012/013/014, design review README | lượt 3 xanh |

Mỗi lượt: commit lên `main`, CI xanh (`quality`, `e2e-web`, `docker`), `graphify update .`.

## Kết quả kiểm T002, T003 (2026-10-16)

- **Điều kiện vào (T001)**: phiên 014 báo `apps/web` rảnh (code 014 xong ở `7aa6591`) nhưng chưa đóng; CI run
  38773514217 còn chạy. Chủ dự án cho bắt đầu lượt 1 ngay với ranh giới: không push tới khi run đó xong; không sửa
  `apps/web-e2e/src/content-*.spec.ts`, `src/payload/*`, `helpers/{requests,content,directus-app,payload}.ts` tới khi 014
  báo "014 closed"; push theo giao thức hai phiên (hỏi trước, chờ OK).
- **R1**: `cropperjs` 1.6.2 MIT trên npm. `tus-js-client` 4.3.1 có trong catalog. `@directus/constants` không có trong
  catalog: `DEFAULT_CHUNK_SIZE` chép hằng `8_388_608` vào `upload-file.ts` (ghi nguồn `packages/constants/src/files.ts`).
- **R2/R3**: `src/utils/fetch-all.ts` đã có (014), dùng lại; `FolderPicker` chưa có, chép mới.
- **R6**: `BoForm` đã `provide('values', values)`; store server đã có `project.default_theme_light|dark` và
  `auth.disableDefault`; `cssVar` có trong `@directus/utils/browser` 13.4.1. Dữ liệu theme sinh bằng `jiti` (có trong
  `node_modules/.bin`; T003), import động bốn file theme Directus.
- **Nhãn theme (khác giả định của D-88)**: file dịch `en-US.json` của 012 giữ nguyên "Directus Default", "Directus
  Minimal", "Directus Color Match" cho ba khóa `theme_directus_*` (script sync giữ tên này); `vi-VN.json` không có ba khóa
  (rơi về en-US). Lựa chọn (a) của owner ("nhãn Backoffice Default") dựa trên giả định sai; cần owner chốt lại trước
  lượt 3 (T079): giữ nhãn như file dịch hiện có, hay thêm overlay đổi thành "Backoffice ...".
- **CHK001**: `systemDefaults` của Directus: `directus_files` = `cards` (`layout_query.cards.sort ['-uploaded_on']`,
  `layout_options.cards` `{icon: 'insert_drive_file', title: '{{ title }}', subtitle: '{{ type }} • {{ filesize }}',
  size: 4, imageFit: 'crop'}`); `directus_users` = **`tabular`** (`sort ['email']`, `fields ['avatar', 'first_name',
  'last_name', 'email', 'role']`, `widths` 36/200/200/300/200), không phải `cards` như spec ghi trước đây; spec FR-060,
  US3-2 và data-model §7 sửa theo. Preset trống gộp với `defaultPreset` (`icon: 'bookmark'`...) bằng `merge`.
- **CHK030**: profile `sso` có provider `oidc`; user SSO giả của `bo_users` dùng `provider: 'oidc'`.
- **CHK075**: `DrawerFiles` của 013 đã có chọn thư mục (select với cùng đích như cây, ghi chú đầu file); giữ, không thêm
  cây vào drawer.
- **CHK077**: Directus 11.17.4 nhận `PATCH /folders/:a {parent: <con của a>}` (200, tạo vòng); app làm giống (picker
  chỉ khóa chính thư mục đó), `nestFolders` bỏ qua thư mục không về gốc. Ghi R-39 khi tech lead duyệt.
- **CHK090**: profile `app` không bật TUS (`TUS_ENABLED` chỉ có ở `profile-blackbox`, `profile-cors-hsts`);
  `/server/info` của cả hai API không trả `uploads` khi TUS tắt. Nhánh TUS kiểm ở unit (XHR giả); E2E đi nhánh multipart.
  `uploads` thiếu → không TUS, `maxConcurrency` không giới hạn (như Directus).
- **Bộ mẫu**: `uploaded_on` ghi được qua `PATCH /files/:id`; seed đặt một file 10 ngày trước để kiểm `recent`.
- **Registry**: `registry.test.ts` so registry của app với `directus-registry.json`, không đếm cố định; T079 thêm sáu id
  vào phần so sánh (không có con số cần sửa).

## R13. Lưu ý từ phiên 014 (2026-10-15)

- Dưới `xl` panel chi tiết là drawer đóng: E2E gọi `openSidebar(page)` (`helpers/content.ts`); khi drawer mở, `main`
  ẩn với `getByRole`.
- Spec E2E đổi layout hoặc gõ tìm kiếm phải khôi phục preset seed (`clearAdminPresets`); E2E local chạy tuần tự trên
  DB chung; sau seed xóa cache `?system` ở 8156 và 8163.
- Perf: ngân sách cho Mac tham chiếu nhân `machineFactor()`; mount bằng `createApp`, Vue production (`PERF=1`).
- E2E điều khiển Directus app (payload, parity-ui) chỉ chạy chromium-1280 qua `grepInvert` với `DIRECTUS_APP_SPECS`
  trong `playwright.config.ts` (014, 2026-10-15): sáu project đẩy `e2e-web` quá 100 phút; 015 làm giống.
- Spec E2E đổi preset qua giao diện (layout, tìm kiếm, bộ lọc, cột) phải đóng trang trước khi khôi phục preset trong
  `afterEach`: chờ khoảng 600 ms rồi `page.close()`; nếu không, lần tự lưu preset có debounce 450 ms ghi sau bước khôi
  phục và làm bẩn spec và cấu hình sau (lỗi làm đỏ phần lớn spec content ở CI của 014, 2026-10-15).
- `benchmark.yml` có input `workflow_dispatch` `job` (ví dụ `benchmark-web`) để chạy riêng một job benchmark (014).
- Firefox ghi lỗi tải font bị hủy vào console (bỏ qua như 014); nginx cần `.mjs` là JavaScript.
