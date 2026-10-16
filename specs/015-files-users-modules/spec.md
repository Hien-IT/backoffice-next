# Feature Specification: Module Files và Users (thư viện file và danh bạ người dùng như Directus)

**Feature Branch**: `015-files-users-modules` (làm trên `main` như 012–014, không tạo branch vì dùng chung working tree
với session 014 đang đóng; 015 chỉ sửa `specs/015-*` cho tới khi 014 báo đóng và CI của 014 xanh)
**Created**: 2026-10-15
**Status**: Draft
**Input**: User description: "Module Files: thư viện file theo thư mục, tải lên (kéo thả, nhiều file, từ URL), xem trước,
sửa metadata, chỉnh sửa ảnh (cắt, xoay), di chuyển và xóa, lọc và tìm kiếm. Module Users: danh sách user theo role, tạo
user, mời user (không gửi email), sửa hồ sơ, đổi role và policy, khóa user, tạo static token, bật tắt TFA. Luồng và quyền
giống Directus. Tham chiếu directus/app/src/modules/files và users. Giao diện theo design-system/ (TailAdmin: theme,
component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: các
luồng chính của hai module chạy giống Directus. Ghi chú từ 013 (đưa vào spec 015): làm interface _system của
directus_users (system-language, system-theme, system-theme-overrides, system-mfa-setup, system-token,
system-input-password, D-57) và trình chỉnh ảnh (image-editor.vue, PATCH /files/:id multipart) dùng chung cho màn file và
nút chỉnh ảnh của interface file-image (D-59). Ghi chú từ 014 (đưa vào spec 015): /content/directus_users và
/content/directus_files (và item của chúng) đang chuyển hướng sang /users, /files là khung module của 012 (D-72,
checkForSystem trong apps/web/src/modules/content.ts, bảng accessibleSystemCollections của utils/get-item-route.ts); 015
thay khung bằng màn thật, giữ route. Danh sách file và user dùng lại phần đã có của 014: năm layout (src/layouts,
use-layout), SearchInput + system-filter, preset/bookmark (use-preset), panel chi tiết (components/sidebar/*: layout,
xuất/nhập, revisions, comments, shares), DrawerCollection theo layout của preset, DrawerBatch, recipe nháp Q-2 đến Q-12
của component-specs.md và §8–§10 của layout-patterns.md (chờ design owner duyệt ở 014). CardsHeader bỏ extraSelection và
Cards bỏ slot prepend (chỉ module Files dùng): 015 thêm lại. Interface _system còn lại của 015 như ghi chú 013 (D-57)."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/app/src` trừ khi ghi khác):

- Module Files: `modules/files/index.ts` (route `files-collection`, `add-file` (`+`, hộp thoại nổi), `files-item`,
  `folders` → `/files`, `folders-collection` (`folders/:folder`, con `add-file-folder`), `all`, `mine`, `recent`;
  `preRegisterCheck` đọc `directus_files`), `routes/collection.vue` (preset `directus_files`, `getFolderFilter`,
  `folderSelection`, kéo thả cả cửa sổ, tải nhiều file, xóa thư mục, chuyển thư mục, tải về, sửa hàng loạt),
  `routes/add-new.vue` (hộp `add_file` với `v-upload` `multiple from-url`), `routes/item.vue` (form `directus_files`
  với `fieldsDenyList`, xem trước và thay file, trình chỉnh ảnh, chuyển thư mục, tải về, lưu thành bản sao qua
  `uploadFile` với preset), `routes/not-found.vue`, `components/add-folder.vue`, `delete-folder-dialog.vue`
  (`move` hoặc `delete`), `folder-section.vue` (thẻ thư mục trên lưới cards), `file-info-sidebar-detail.vue`.
- Dùng chung của Files: `views/private/components/files-navigation.vue`, `files-navigation-folder.vue` (menu chuột
  phải: đổi tên, chuyển, tải thư mục zip, xóa), `folder-picker.vue`, `FolderPickerListItem.vue`,
  `file-preview-replace.vue`, `file-preview.vue`, `file-lightbox.vue` (013 đã port), `image-editor.vue` (Cropper.js),
  `composables/use-folders.ts` (`nestFolders`, trạng thái mở dùng chung), `utils/get-folder-filter.ts` (`type` không
  null; `folder` bằng hoặc null; `mine` theo `uploaded_by`; `recent` 5 ngày), `utils/delete-folder.ts`
  (`moveAndDelete`, `recursiveDelete`), `utils/collect-folder-ids.ts`, `utils/upload-file.ts` (TUS khi
  `info.uploads.tus`, không thì multipart), `utils/upload-files.ts` (`p-queue` theo `uploads.maxConcurrency`),
  `stores/files.ts` (đếm upload đang chạy), `utils/get-asset-url.ts` (`getFilesUrl`, `getFolderUrl`),
  `composables/use-mime-type-filter.ts`, `types/folders.ts`; `layouts/cards/cards.vue` và
  `layouts/cards/components/header.vue` (`extraSelection`, slot `prepend`, `selectAll`).
- Module Users: `modules/users/index.ts` (route `users-active` (`''`), `users-suspended`, `users-invited`, `users-all`,
  `users-item`, `roles` → `/users`, `roles-collection` (`roles/:role`), `roles-item-add` (`roles/:role/+`);
  `preRegisterCheck` đọc `directus_users`), `routes/collection.vue` (preset `directus_users`, bộ lọc hệ thống theo
  `role` và `status`, mời, tạo, xóa hàng loạt kèm đăng xuất nếu xóa chính mình), `routes/item.vue` (hộp user với avatar
  `system-medium-cover`, form với `fieldsDenyList`, `provider`/`external_identifier` chỉ đọc với không admin, archive
  qua `archive_field`, lưu rồi `setLang`/`hydrate` khi là user hiện tại, xóa chính mình thì đăng xuất),
  `components/navigation.vue`, `NavigationRole.vue` (cây role theo `parent`, menu "sửa role" cho admin),
  `composables/use-navigation.ts`, `components/user-info-sidebar-detail.vue`;
  `views/private/components/users-invite.vue` (`POST /users/invite` với `email[]`, `role`; lỗi `RECORD_NOT_UNIQUE`);
  `views/private/components/module-bar-avatar.vue` (link hồ sơ `/users/<id>`).
- Interface hệ thống (`interfaces/_system`): `system-language` (`availableLanguages`, `includeProjectDefault`),
  `system-theme` (+ `theme-preview.vue`), `system-theme-overrides` (+ `SystemThemeOverridesGroup.vue`,
  `system-theme-overrides-rule.vue`, `types.ts`), `system-mfa-setup` (luồng mật khẩu và luồng SSO, admin tắt TFA
  của user khác), `system-token` (`GET /utils/random/string`, `PATCH` ngay, hộp xác nhận tạo lại và xóa),
  `system-input-password`; `composables/use-tfa-setup.ts` (`adminDisableTFA`, `requestTFASetup`, `cancelTFASetup`,
  khóa localStorage `require_tfa_setup`).
- Field hệ thống: `directus/packages/system-data/src/fields/users.yaml`, `files.yaml` (interface, `readonly`,
  `hidden`, `special`, nhóm và divider).

**Dùng lại từ 012–014** (không viết lại): khung app, `PrivateView`, `PublicView`, `DetailPanel`, `UserMenu`, store
user/settings/server/permissions/presets/fields (012); `BoForm`, interface `file`, `file-image`, `files`, `tags`,
`input-hash`, `select-dropdown-m2o`, `list-m2m`, `presentation-divider`, `BoUpload` (multipart, từ URL, thư viện),
`FilePreview`, `FileLightbox`, `DrawerFiles`, `DrawerItem`, `UserPopover`, `BoDrawer`, `BoDialog`, `BoTable`,
`BoMenu` (013); năm layout và `use-layout`, `use-items`, `use-preset`, `SearchInput` + `system-filter`,
`components/sidebar/*` (Layout, Export/Import, Revisions, Comments, Shares, Refresh), `DrawerCollection`, `DrawerBatch`,
`use-item`, `use-edits-guard`, `SaveOptions`, `use-tfa-setup` (012, mở rộng ở 015), `user-name`, `format-filesize`,
`readable-mime-type`, `get-asset-url`, `use-mime-type-filter` (014).

## User Scenarios & Testing *(mandatory)*

Người dùng là admin và người dùng app (có `app_access`, quyền đọc `directus_files` hoặc `directus_users`) đang dùng
module Files và Users của Directus app với cùng DB, nay làm cùng việc trên app Backoffice: duyệt thư viện file theo thư
mục, tải lên, xem, sửa, chỉnh ảnh, chuyển, xóa, tải về; xem danh bạ user theo trạng thái và role, tạo, mời, sửa hồ sơ,
đổi role và policy, khóa, tạo token, bật tắt TFA. File, thư mục, user, preset, revision, comment tạo ở app này hiện đúng
ở app kia.

Phạm vi: mọi route của hai module (`/files`, `/files/+`, `/files/folders/:folder`, `/files/folders/:folder/+`,
`/files/all|mine|recent`, `/files/:primaryKey`; `/users`, `/users/suspended|invited|all`, `/users/roles/:role`,
`/users/roles/:role/+`, `/users/:primaryKey`), thay khung D-40 của 012 và đích chuyển hướng D-72 của 014;
trang hồ sơ đầy đủ thay form cố định của 012 (D-48); sáu interface `_system` của `directus_users` (D-57); trình chỉnh
ảnh dùng chung với `file-image` (D-59); E2E ba cấu hình. Ngoài phạm vi: trang đăng ký công khai `/register` (D-44 giữ,
owner chọn 2026-10-15, Clarifications Q2), màn Settings của role và policy (016, link tới khung 012 như D-71), drawer
thông báo và danh sách upload đang chạy (018, D-45), snackbar (D-66), AI, collab, extension (XI, D-41), gửi email (X: mời
ghi log ở API, D-36).

### User Story 1 - Thư viện file: cây thư mục, danh sách theo layout, điều hướng (Priority: P1)

Người dùng vào module Files, thấy cây thư mục trong sub-menu của sidebar (thư mục gốc "File Library", thư mục lồng,
ba mục "All files", "My files", "Recent files"), bấm một thư mục và thấy thư mục con dạng thẻ phía trên danh sách file ở
layout đã lưu (mặc định cards), chọn file và thư mục, mở file, tạo, đổi tên, chuyển, tải về, xóa thư mục.

**Why this priority**: Là màn mở đầu của mọi luồng file; thư mục là cấu trúc của thư viện.

**Independent Test**: E2E trên bộ mẫu `bo_files` (thư mục lồng 3 cấp, 30 file ảnh/PDF/video, một file do user khác
tải): mở `/files`, so cây thư mục và thẻ thư mục con với Directus app, vào `/files/folders/:id`, `all`, `mine`,
`recent`; so request `/files` (fields, filter hệ thống gộp với bộ lọc user, sort, limit, page) và dòng
`directus_presets` ghi ra với Directus app.

**Acceptance Scenarios**:

1. **Given** thư mục lồng ba cấp, **When** mở `/files`, **Then** sub-menu hiện cây như `files-navigation.vue`: mục gốc
   "File Library" (`folder_special`) mở sẵn, thư mục có con gập mở, thư mục đang xem và các cha tự mở, trạng thái mở
   dùng chung toàn app; dưới vạch chia có "All files", "My files", "Recent files"; bấm thư mục tới
   `/files/folders/:id`.
2. **Given** `/files/folders/:id` của thư mục có 2 thư mục con và 10 file, không tìm kiếm, không bộ lọc, **When** mở,
   **Then** page header có breadcrumb "File Library" và tiêu đề là tên thư mục; danh sách là layout của preset
   `directus_files` (mặc định cards với `icon` và `title` như `stores/presets.ts`); phần `prepend` của layout cards có 2
   thẻ thư mục (icon `folder`, tên, link tới thư mục) trước các thẻ file; bộ lọc hệ thống là `type` không null và
   `folder` bằng id; có tìm kiếm hoặc bộ lọc thì không hiện thẻ thư mục.
3. **Given** `/files/all|mine|recent`, **When** mở, **Then** tiêu đề `all_files|my_files|recent_files`, không thẻ thư
   mục; `mine` lọc `uploaded_by` là user hiện tại, `recent` lọc `uploaded_on` lớn hơn 5 ngày trước, `all` chỉ `type`
   không null.
4. **Given** đang chọn 2 thẻ thư mục và 1 file, **When** nhìn header của layout cards, **Then** số lượng chọn là 3
   (`extraSelection` gộp với `selection`), nút "chọn tất cả" chọn cả thư mục con; nút xóa ở page header mở hộp xóa thư
   mục với hai lựa chọn (chuyển nội dung lên thư mục cha rồi xóa, hoặc xóa đệ quy); các nút chuyển thư mục, sửa hàng
   loạt, tải về ẩn khi có thư mục trong lựa chọn.
5. **Given** nút "tạo thư mục" ở page header (khóa khi không có quyền tạo `directus_folders`), **When** nhập tên và lưu,
   **Then** `POST /folders` với `name` và `parent` là thư mục hiện tại (null ở gốc), cây nạp lại và chuyển tới thư mục
   mới; menu chuột phải (và nút tương đương bàn phím) của thư mục trong cây có đổi tên (`PATCH /folders/:id` `name`),
   chuyển (chọn thư mục đích, không cho chọn chính nó, `PATCH` `parent`), tải thư mục (`POST /assets/folder/:id` zip,
   tên từ `Content-Disposition`), xóa (hộp như kịch bản 4; xóa thư mục đang xem thì về thư mục cha).
6. **Given** không có file và thư mục con, **When** mở thư mục, **Then** trạng thái trống `file_count 0` với nút
   "add_file" (khóa khi không có quyền tạo); có bộ lọc mà không khớp thì `no_results` với nút xóa bộ lọc.

---

### User Story 2 - Tải lên, màn file: xem trước, metadata, di chuyển, xóa, thay file, tải về (Priority: P1)

Người dùng tải file lên bằng nút "+" (hộp thoại chọn nhiều file, từ URL) hoặc kéo thả vào bất kỳ đâu trên màn thư
viện; mở một file thấy xem trước lớn, form metadata, mục "Chi tiết file" trong panel; sửa và lưu, chuyển thư mục, tải
về, thay file, lưu thành bản sao, xóa.

**Why this priority**: Tải lên và sửa metadata là việc chính của thư viện; màn file là đích của mọi thẻ.

**Independent Test**: E2E: tải 3 file qua hộp thoại và 2 file bằng kéo thả vào `/files/folders/:id`, nhập từ URL
(server mẫu stub bằng `route()`), mở một ảnh, sửa `title`, `tags`, `description`, chuyển thư mục, thay file, lưu bản
sao, tải về, xóa; so body `POST /files` (multipart và `/files/import`), `PATCH /files/:id`, `PATCH /files` (hàng loạt)
với Directus app; so dòng `directus_files` sau mỗi bước.

**Acceptance Scenarios**:

1. **Given** `/files/folders/:id/+` (hoặc `/files/+`), **When** mở, **Then** hộp thoại `add_file` nổi trên danh sách với
   `BoUpload` `multiple`, `fromUrl`, `folder` là thư mục hiện tại, `accept` từ `info.files.mimeTypeAllowList`; đóng
   (nút "done", Esc, backdrop) về route thư mục và nạp lại danh sách; file tải xong thì danh sách nạp lại.
2. **Given** kéo file từ máy vào cửa sổ ở màn thư viện, **When** đang kéo, **Then** viền thả hiện quanh vùng nội dung
   và thông báo `drop_to_upload` (notice tại chỗ, D-66); thả thì tải từng file vào thư mục hiện tại với số luồng
   `uploads.maxConcurrency`, tiến độ `upload_files_indeterminate` (done/total, phần trăm) cập nhật tại chỗ, xong thì nạp
   lại danh sách; kéo vào vùng `data-dropzone` của `BoUpload` thì vùng đó nhận, viền ngoài tắt; mục kéo không phải file
   bị bỏ qua.
3. **Given** server bật TUS (`info.uploads.tus`, `chunkSize`), **When** tải file, **Then** dùng upload chia khối tới
   `/files/tus` với metadata như `upload-file.ts` (`filename_download`, `type`, preset `folder`), `withCredentials`,
   tiếp tục upload dở nếu có (`findPreviousUploads`), nhận `id` từ header `Directus-File-Id`, xong thì `GET /files/:id`;
   server tắt TUS thì `POST /files` multipart với `onUploadProgress` như 013.
4. **Given** `/files/:id` của một ảnh, **When** mở, **Then** page header có nút quay lại, breadcrumb "File Library" (link
   tới thư mục của file), tiêu đề `title`, nút xóa, chuyển thư mục, tải về (`/assets/:id?download`), chỉnh ảnh (chỉ
   `type` bắt đầu `image` và có quyền update), lưu với menu tùy chọn (lưu và ở lại, lưu bản sao; "lưu và thêm mới"
   khóa); nội dung là `FilePreview` với nút "thay file" (hộp `BoUpload` có `fileId`, `fromUrl`; thay xong nạp lại) rồi
   `BoForm` của `directus_files` bỏ các field `type`, `width`, `height`, `filesize`, `created_on`, `uploaded_by`,
   `uploaded_on`, `modified_by`, `modified_on`, `duration`, `folder`, `charset`, `embed`; panel có "Chi tiết file"
   (kiểu, kích thước ảnh, thời lượng, dung lượng, charset, embed, ngày tạo, chủ sở hữu, ngày tải, ngày sửa, người sửa
   với `UserPopover`, link mở file tab mới, link thư mục, nút chép id; nhóm EXIF: máy, khẩu độ, tốc độ, tiêu cự, ISO khi
   `metadata.ifd0/exif` có), Revisions (khi có quyền), Comments.
5. **Given** đã sửa `title` và `tags`, **When** lưu, **Then** `PATCH /files/:id` chỉ với field đã sửa và về thư mục
   của file; lưu và ở lại thì nạp lại item và Revisions; Ctrl/Cmd+S lưu và ở lại; rời trang khi có thay đổi thì hộp
   `unsaved_changes` (Keep Editing trước, D-76).
6. **Given** nút chuyển thư mục, **When** chọn thư mục đích và bấm "move", **Then** `PATCH /files/:id` với `folder` và
   `fields=folder.name`, notice `file_moved` với tên thư mục (hoặc "File Library"); ở màn thư viện với lựa chọn nhiều
   file thì `PATCH /files` với `keys` và `data.folder`, rồi chuyển tới thư mục đích.
7. **Given** "lưu bản sao", **When** chạy, **Then** app lấy `GET /assets/:id` (blob), tải lên file mới với preset gồm
   các field không `hidden`/`readonly` của item cộng `folder`, `storage` và các sửa chưa lưu như `saveAsCopyAndNavigate`,
   rồi tới `/files/<id mới>`; tải về nhiều file ở thư viện dùng `POST /assets/files` với `{ ids }` (zip), một file
   dùng `/assets/:id`.
8. **Given** xóa file ở màn file hoặc nhiều file ở thư viện, **When** xác nhận, **Then** `DELETE /files/:id` hoặc
   `DELETE /files` với mảng id; về thư mục (màn file) hoặc nạp lại (thư viện); lựa chọn xóa.

---

### User Story 3 - Danh bạ user: danh sách theo trạng thái và role, tạo, mời (Priority: P1)

Người dùng vào module Users, thấy sub-menu với "Active users", "Suspended users", "Invited users", "All users" và cây
role (role lồng theo `parent`), bấm một role thấy user của role đó ở layout đã lưu (mặc định bảng: avatar, tên, họ, email, role), tạo
user mới (có sẵn role khi đi từ route role), mời user bằng danh sách email và role.

**Why this priority**: Danh sách theo trạng thái và role là màn mở đầu; tạo và mời là luồng quản trị hằng ngày.

**Independent Test**: E2E trên bộ mẫu `bo_users` (3 role lồng hai cấp, user ở bốn trạng thái, user SSO với
`provider` khác `default`): mở `/users`, `/users/suspended|invited|all`, `/users/roles/:id`; so sub-menu, tiêu đề,
request `/users` (bộ lọc hệ thống `status`, `role`), dòng `directus_presets` với Directus app; mời 2 email, so body
`POST /users/invite` và dòng `directus_users` (status `invited`) với Directus app.

**Acceptance Scenarios**:

1. **Given** 3 role, role B là con của A, **When** mở `/users`, **Then** sub-menu có bốn mục trạng thái (icon `group`,
   `group_off`, `person_add`, `folder_shared`), vạch chia, cây role theo tên (`GET /roles` `fields=id,name,icon,parent`
   `sort=name`): A gập mở chứa B, role đang xem và cha tự mở; admin có menu chuột phải "sửa role" trỏ
   `/settings/roles/:id` (khung 012 tới 016, D-85); tiêu đề `active_users`, không breadcrumb.
2. **Given** `/users/roles/:id`, **When** mở, **Then** breadcrumb "User Directory", tiêu đề tên role; bộ lọc hệ thống
   `role._eq`; `/users/suspended|invited` lọc `status._eq`; `/users/all` không bộ lọc hệ thống, tiêu đề `all_users`;
   layout của preset `directus_users` (mặc định `tabular` theo `stores/presets.ts`: cột avatar, first_name, last_name,
   email, role, sắp theo email; T002).
3. **Given** quyền tạo `directus_users` và đọc `directus_roles`, `auth.disableDefault` tắt, **When** bấm "mời", **Then**
   hộp `invite_users`: ô nhiều dòng email (phân tách bằng dấu phẩy hoặc xuống dòng), chọn role (`GET /roles`
   `fields=id,name` `sort=name`, mặc định role đầu; ẩn khi đi từ route role), nút "invite" khóa khi trống; gửi
   `POST /users/invite` `{ email: [...], role }`; thành công thì đóng hộp, nạp lại danh sách, rồi notice ở page header
   "hệ thống không gửi email, liên hệ quản trị viên để nhận link" (D-83, thứ tự: đóng → nạp lại → notice); lỗi `RECORD_NOT_UNIQUE` hiện tại chỗ
   (`email_already_invited` với email, hoặc `validationError.unique`), lỗi khác qua hộp lỗi; `auth.disableDefault` bật
   hoặc thiếu quyền thì không có nút mời.
4. **Given** nút "+" (khóa khi không có quyền tạo), **When** bấm ở `/users/roles/:id`, **Then** tới
   `/users/roles/:id/+` và form có sẵn `role`; ở route khác tới `/users/+`.
5. **Given** không có user khớp, **When** mở, **Then** trạng thái trống `user_count 0` với `no_status_users_copy` (theo
   trạng thái) hoặc `no_users_copy`, nút "create_user" khi được mời và ở `active` hoặc không có trạng thái; có bộ lọc
   thì `no_results` với nút xóa bộ lọc.
6. **Given** chọn nhiều user, **When** xóa hàng loạt, **Then** `DELETE /users` với mảng id; nếu có chính mình thì đăng
   xuất; sửa hàng loạt mở `DrawerBatch` `directus_users`.

---

### User Story 4 - Màn user: hồ sơ, role và policy, trạng thái, token, TFA, theme, ngôn ngữ (Priority: P1)

Người dùng mở một user (hoặc hồ sơ của mình từ menu avatar) và thấy hộp user (avatar, tên, chức danh, email, địa
điểm, chip role màu theo trạng thái) rồi form theo metadata của `directus_users` với các interface hệ thống: ngôn ngữ,
TFA, theme sáng/tối và overrides, trạng thái, role, policy, token; sửa, lưu, archive (khóa), xóa.

**Why this priority**: Là màn hồ sơ và màn quản trị user; chứa sáu interface `_system` còn nợ từ 013.

**Independent Test**: Test component cho sáu interface với mock API (request allowlist như 013); E2E: mở
`/users/:id`, sửa tên, email, mật khẩu, avatar, ngôn ngữ, theme, overrides, status, role, policies, tạo token, bật rồi
tắt TFA; so body `PATCH /users/:id`, `POST /users/me/tfa/*`, `POST /users/:id/tfa/disable`, `GET /utils/random/string`
với Directus app.

**Acceptance Scenarios**:

1. **Given** `/users/:id`, **When** mở, **Then** page header có nút quay lại, breadcrumb "User Directory", tiêu đề là
   `userName(item)` (`adding_user` khi mới), nút xóa, archive (chỉ khi `archive_field` của collection và không mới;
   icon `unarchive` khi đã archive; hộp xác nhận), lưu với menu tùy chọn (lưu và ở lại, lưu và thêm mới, lưu bản sao,
   bỏ thay đổi); hộp user chỉ khi không mới: avatar `system-medium-cover` với `cacheBuster` `avatar.modified_on` (icon
   `account_circle` khi không có hoặc lỗi), tên và `title`, email, `location`, chip tên role có class theo `status`;
   form `BoForm` với field của `directus_users` trừ `id`, `last_page`, `created_on`, `created_by`, `modified_by`,
   `modified_on`, `last_access`; `provider` và `external_identifier` chỉ đọc với không admin khi sửa; item nạp với
   `fields=*,role.*,avatar.id,avatar.modified_on`; panel có "Thông tin" (khóa với nút chép, `last_page` là link,
   `last_access`), Revisions, Comments.
2. **Given** sửa `first_name`, `language`, `appearance` của chính mình, **When** lưu, **Then** `PATCH /users/:id` chỉ
   field đã sửa; vì là user hiện tại thì store user nạp lại, ngôn ngữ đổi ngay (store fields và collections nạp lại
   như `setLang`), theme đổi ngay; lưu rồi về `/users`; lưu và ở lại ở item mới thì `router.replace` tới id mới.
3. **Given** field `tfa_secret` (`system-mfa-setup`) của chính mình, user mật khẩu, **When** bật, **Then** hộp ba bước
   như 012 `use-tfa-setup`: mật khẩu → `POST /users/me/tfa/generate` → QR và secret → OTP 6 số →
   `POST /users/me/tfa/enable`; tắt: OTP → `POST /users/me/tfa/disable`; user SSO: bật ghi khóa localStorage
   `backoffice-require_tfa_setup` = id rồi đăng xuất (thiết lập ở lần đăng nhập sau như 012), đang chờ thì có hộp hủy
   thiết lập; xem user khác: chỉ admin tắt được (`POST /users/:id/tfa/disable`, hộp `admin_disable_tfa_text`), ô bật
   khóa khi user đó chưa bật.
4. **Given** field `token` (`system-token`) của user đã có, **When** bấm tạo, **Then** `GET /utils/random/string` rồi
   `PATCH /users/:id` `{ token }` ngay (không chờ lưu form), ô hiện token dạng text với nút chép và notice "đã lưu, chép
   ngay"; đã có token (`value` là `****`) thì nút "tạo lại" có hộp xác nhận, nút xóa có hộp xác nhận (`PATCH` `token:
   null` rồi nạp lại item); user mới thì ô khóa với notice `new_user_disabled_notice`.
5. **Given** `password` (`input-hash` của 013), `language`
   (`system-language`: danh sách `availableLanguages` của app, mục "mặc định dự án" khi `includeProjectDefault`),
   `status` (dropdown `draft|invited|unverified|active|suspended|archived`), `role` (m2o với template), `policies`
   (m2m `directus_access`), `theme_light_overrides`/`theme_dark_overrides` (`system-theme-overrides`: cây nhóm gập mở
   theo khóa theme Directus, ô nhập với placeholder là mặc định và swatch màu, xóa giá trị thì gỡ khóa và nhóm rỗng),
   `theme_light`/`theme_dark` (`system-theme`, xem trước đúng màu theme Directus, Q1 = C), **When** sửa và lưu, **Then** giá trị ghi ra bằng
   Directus app với cùng thao tác (bộ so payload).
6. **Given** menu avatar ở header, **When** chọn hồ sơ, **Then** mở `/users/<id user hiện tại>` như
   `module-bar-avatar.vue`; không có route `/users/me` riêng, như Directus (D-86 bỏ, owner 2026-10-16); form cố định của 012 bỏ (D-48 gỡ).
7. **Given** xóa chính mình ở màn user, **When** xác nhận, **Then** `DELETE /users/:id` rồi đăng xuất; xóa user khác
   thì về `/users`; archive thì `PATCH` `status: archived` rồi về `/users`, bỏ archive thì ở lại.

---

### User Story 5 - Chỉnh ảnh dùng chung (Priority: P2)

Người dùng bấm "chỉnh" trên màn file ảnh (hoặc nút chỉnh ảnh của interface `file-image`, D-59) và thấy drawer chỉnh
ảnh: di chuyển, cắt theo tỉ lệ (tùy chỉnh từ settings, 16:9, 3:2, 5:4, 7:5, vuông, tự do, gốc), xoay, lật ngang, lật
dọc, điểm focal, đặt lại, kích thước mới; lưu đè file (hoặc lưu thành file mới) và xem thay đổi.

**Why this priority**: Nợ của 013 (D-59); không chặn các luồng khác.

**Independent Test**: Test component với mock `/files/:id` và `PATCH /files/:id` multipart, kiểm body FormData (`file`
blob với tên `filename_download` và `type`, `focal_point_x/y`) và `POST /files` khi lưu mới; E2E: cắt và xoay một ảnh
PNG, so `width`/`height`, điểm focal trong `directus_files` và điểm ảnh sau giải mã với Directus app cùng thao tác
(cùng Cropper.js và cùng tham số; không so bytes).

**Acceptance Scenarios**:

1. **Given** ảnh raster có quyền update, **When** mở trình chỉnh, **Then** drawer tiêu đề `editing_image`, phụ đề cảnh
   báo `changes_are_permanent`, ảnh nạp từ `/assets/:id?<nonce>` (bỏ cache), `GET /files/:id` lấy `type`, `filesize`,
   `filename_download`, `folder`, `width`, `height`, `focal_point_x/y`; thanh công cụ: chế độ di chuyển/cắt/điểm focal,
   xoay -90°, lật ngang, lật dọc, menu tỉ lệ (gồm `custom_aspect_ratios` của settings), đặt lại, dòng kích thước
   "WxH → W'xH'" (SVG hiện "SVG → PNG"), nút hủy cắt/hủy chọn khi đang cắt; nút lưu khóa khi không có thay đổi.
2. **Given** đã cắt và xoay, **When** lưu, **Then** canvas kết quả (`imageSmoothingQuality: high`) thành blob đúng
   `type`, gửi `PATCH /files/:id` multipart với `file`; có chọn điểm focal thì gửi kèm `focal_point_x/y`; chỉ điểm focal
   thì `PATCH` JSON `focal_point_x/y`; xong thì đóng, nạp lại item, ảnh nạp lại với nonce mới.
3. **Given** có quyền tạo, **When** chọn "lưu thành file mới", **Then** `POST /files` multipart với `folder` của ảnh và
   `file`, đóng và tới `/files/<id mới>` (ở `file-image`: chọn file mới vào field).
4. **Given** `file-image` của 013, **When** có quyền update file, **Then** nút chỉnh ảnh hiện và mở cùng drawer; lưu
   xong nạp lại xem trước (D-59 gỡ).
5. **Given** chỉ bàn phím, **When** mở trình chỉnh ảnh, **Then** mọi nút thanh công cụ, menu tỉ lệ và nút lưu dùng
   được bằng bàn phím; khung cắt và điểm focal chỉ kéo bằng chuột như Directus (ngoại lệ a11y ghi ở FR-111, Clarifications
   2026-10-15).

---

### User Story 6 - Tìm kiếm, bộ lọc, preset, xuất nhập, hàng loạt, quyền (Priority: P2)

Người dùng tìm và lọc file hoặc user bằng thanh tìm kiếm và bộ lọc nâng cao của 014, đổi layout và tùy chọn (lưu vào
preset `directus_files`/`directus_users`), xuất và nhập, sửa hàng loạt; người chưa có quyền chỉ thấy phần được phép.

**Why this priority**: Dùng lại phần 014; quyền là ràng buộc của tiêu chí "giống Directus".

**Independent Test**: E2E với ba user (`admin`, `bo-editor` có quyền một phần, `bo-viewer` chỉ đọc) ở cả hai module:
so `disabled`/ẩn của các nút tạo, mời, xóa, sửa hàng loạt, chuyển thư mục, chỉnh ảnh, tải thư mục, tạo thư mục; preset
và bookmark; xuất CSV và nhập CSV; `/register` vẫn là trang "chưa có sẵn" của 012.

**Acceptance Scenarios**:

1. **Given** thanh tìm kiếm và bộ lọc nâng cao, **When** gõ "logo" và thêm điều kiện `type` chứa `image`, **Then**
   request `/files` có `search` và `filter` gộp `_and` với bộ lọc hệ thống (thư mục) như `mergeFilters`; preset lưu
   `search`, `filter` (không gồm bộ lọc hệ thống), `layout`, `layout_query`, `layout_options` sau 450 ms; nút bookmark
   như 014 (FR-015 của 014) cho cả hai collection.
2. **Given** panel của màn thư viện hoặc danh bạ, **When** mở, **Then** có Layout (chọn layout và option), mục
   `layout-sidebar-*`, Export/Import (collection `directus_files`/`directus_users`, bộ lọc gộp, tìm kiếm); nhập CSV
   user 10 dòng thì `POST /utils/import/directus_users` và danh sách nạp lại.
3. **Given** `bo-viewer` chỉ đọc, **When** mở hai module, **Then** nút tạo, mời, xóa, sửa hàng loạt, tạo thư mục,
   chuyển thư mục, thay file, chỉnh ảnh khóa hoặc ẩn như Directus (`useCollectionPermissions`, `useItemPermissions`);
   không có quyền đọc `directus_files` hoặc `directus_users` thì module không có trong sidebar (`preRegisterCheck` của
   012) và route trả màn không có quyền của 012.
4. **Given** `public_registration` bật, **When** mở link đăng ký ở trang đăng nhập, **Then** vẫn tới trang public "chưa
   có sẵn" của 012 (D-44 giữ, Q2); 015 không làm form đăng ký.

---

### User Story 7 - Đối chiếu với Directus app, E2E ba cấu hình (Priority: P2)

Mọi luồng trên chạy ở ba cấu hình API (proxy tới Directus thật, proxy tới API mới, khác origin) và so với Directus app
trên cùng DB; recipe design-system cho màn chưa có mẫu được viết trước khi code.

**Why this priority**: Là tiêu chí chấp nhận.

**Independent Test**: Job `e2e-web` với spec `files-*.spec.ts`, `users-*.spec.ts`; bộ so payload
mở rộng cho `/files`, `/folders`, `/users`, `/users/invite`, `/utils/random/string`, `/users/*/tfa/*`;
bộ so UI (như `content-parity-ui.spec.ts`) cho sub-menu, tiêu đề, số đếm, `disabled` của nút, mục panel.

**Acceptance Scenarios**:

1. **Given** bộ mẫu `bo_files` và `bo_users` seed qua Directus REST, **When** chạy E2E song song hai app cho ba user,
   **Then** 0 lệch ngoài D-xx ở năm thuộc tính của SC-002.
2. **Given** cùng kịch bản ghi, **When** so body, **Then** 100% bằng sau chuẩn hóa (SC-004); lệch thật ghi R-xx.
3. **Given** recipe Q-13 đến Q-19, **When** đóng feature, **Then** design owner đã duyệt (SC-008).

### Edge Cases

- Thư mục có vòng `parent` (dữ liệu hỏng): `nestFolders` của Directus bỏ qua thư mục không về gốc; app làm giống, không
  treo; thư mục không tồn tại ở `/files/folders/:id`: tiêu đề "File Library", danh sách trống (Directus không 404).
- File `type` null (đang tải TUS dở): bộ lọc hệ thống `type._nnull` ẩn; danh sách upload dở thuộc 018.
- Kéo thả khi không có quyền tạo: Directus vẫn nhận thả và API trả 403 → hộp lỗi; app làm giống (không chặn trước).
- Thả nhiều file vượt `uploads.maxConcurrency`: hàng đợi; một file lỗi (kiểu không cho phép, 413): lỗi từng file, các
  file khác tiếp tục như `uploadFiles`.
- Nhập từ URL bị `IMPORT_IP_DENY_LIST` chặn: lỗi API hiện trong hộp (013).
- Thay file bằng file khác `type`: API cập nhật `type`, `width`, `height`; xem trước nạp lại; chỉnh ảnh ẩn nếu không
  còn là ảnh.
- Chỉnh ảnh SVG: Cropper vẽ canvas → lưu thành PNG nhưng gửi `type` gốc như Directus (dòng kích thước ghi "SVG → PNG");
  giữ hành vi, không sửa; ảnh rất lớn: canvas theo giới hạn trình duyệt, lỗi `toBlob` null → `unexpectedError`.
- Xóa thư mục chế độ "chuyển": file và thư mục con chuyển lên `parent` bằng `PATCH /files`, `PATCH /folders` với
  `keys`; chế độ "xóa đệ quy": gỡ `parent` của thư mục con trong tập, `DELETE /files` theo `folder._in`, rồi
  `DELETE /folders`; lỗi giữa chừng để nguyên phần đã làm như Directus (không transaction ở client).
- Tải thư mục rỗng hoặc nhiều file: zip theo API (007); `Content-Disposition` thiếu → tên `folder-unknown-<time>.zip`.
- User không có role (`role` null): chip role ẩn; cây role không có mục nào active.
- Role bị xóa khi đang ở `/users/roles/:id`: tiêu đề rỗng, danh sách trống (Directus không 404).
- Mời email đã tồn tại: `RECORD_NOT_UNIQUE` tại chỗ, email khác trong cùng lượt vẫn được tạo như API.
- Đổi `status` thành `suspended` cho chính mình rồi lưu: API cho phép; phiên vẫn còn tới khi hết hạn như Directus.
- Đổi `role` của chính mình mất quyền admin: sau lưu store user nạp lại, module Settings biến mất; Directus làm vậy.
- Tắt TFA của chính mình khi `enforce_tfa` của role bật: API cho tắt, lần đăng nhập sau bị ép thiết lập (012).
- User SSO bấm bật TFA: đăng xuất ngay (Directus), thay đổi chưa lưu của form mất → gọi `discardAllChanges` trước như
  `enableSSO`.
- Tạo token khi form đang có thay đổi chưa lưu: `PATCH` chỉ `token` ngay; thay đổi khác vẫn chờ lưu như Directus.
- `theme_light_overrides` có khóa không thuộc cây theme (do Directus bản khác ghi): cây không hiện khóa đó, giữ nguyên khi
  lưu (chỉ ghi phần sửa) như Directus (`setWith` trên clone).
- `language` là mã không có trong app (D-46): dropdown hiện mã thô, lưu giữ nguyên; giao diện rơi về `en-US`.
- `/users/me` gõ tay: khớp `/users/:primaryKey` với khóa `me` như Directus (không có route riêng, D-86 bỏ).
- Lưới cards với thư mục con nhưng `select-mode` (có lựa chọn file): thẻ thư mục cũng vào chế độ chọn
  (`selectMode = selection.length > 0 || anySelection`), bấm thẻ chọn thay vì mở.
- Màn hẹp 768 px: panel là drawer (L-4); drawer chỉnh ảnh chiếm toàn màn; sub-menu cây thư mục cuộn trong sidebar.
- Phiên hết hạn giữa chừng (401 khi tải lên nhiều file): các file còn lại lỗi, về đăng nhập như 012.

- Quyền đọc file một phần (bộ lọc theo `uploaded_by`): thư mục con vẫn hiện (cây từ `/folders` riêng), `mine` và
  `all` hiện cùng tập theo bộ lọc quyền của API (CHK068).
- Ở cấu hình khác origin: `<a download>` tới `/assets/:id` khác origin bị trình duyệt bỏ `download` và mở tab mới như
  Directus; zip tải bằng `fetch` với `credentials: include` qua `apiFetch` (CHK069).
- Mở `/files/:id` của file bị xóa sau khi mở: thao tác tiếp theo 404 → nạp lại → màn không tìm thấy (CHK070).
- Đổi role của chính mình thành role không có `app_access` rồi lưu: hydrate thất bại → màn không có quyền của 012
  (CHK071).
- Thư mục cùng tên cùng cấp: cây và picker hiện cả hai, phân biệt bằng id, không xử lý thêm (CHK076).
- Phiên hết hạn giữa TUS (401 ở chunk): `onError` → hộp lỗi và về đăng nhập như 012; fingerprint giữ nên chọn lại file
  sau đăng nhập thì tiếp tục (CHK079).
- Ảnh gốc bị thay ở tab khác khi drawer chỉnh ảnh đang mở: lưu đè kết quả cũ, không khóa, như Directus (CHK080).
- Xóa hàng loạt user đang đăng nhập ở nơi khác: API xóa session, app không xử lý thêm (CHK081).
- `GET /folders` nhiều trang: skeleton tới khi `fetchAll` xong; một trang lỗi → `unexpectedError`, cây rỗng (CHK083).
- Tải thư mục rỗng vẫn nhận zip; API từ chối (4xx) → hộp lỗi với body JSON (CHK012).
- Ảnh có `type` ảnh nhưng trình duyệt không giải mã (HEIC, TIFF): `img` lỗi → notice lỗi trong drawer, nút lưu khóa
  (CHK017).
- Avatar trỏ file đã xóa → icon mặc định; `role` trỏ role đã xóa → `role` null → chip ẩn (CHK021).

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| US1 | 1–6 | FR-001 đến FR-006, FR-010 đến FR-019 | SC-001, SC-002, SC-007 |
| US2 | 1–8 | FR-020 đến FR-024, FR-030 đến FR-039 | SC-001, SC-004 |
| US3 | 1–6 | FR-050 đến FR-055, FR-060 đến FR-066 | SC-001, SC-002, SC-004 |
| US4 | 1–7 | FR-070 đến FR-079, FR-080 đến FR-086 | SC-001, SC-004, SC-005 |
| US5 | 1–5 | FR-040 đến FR-046 | SC-001, SC-004, SC-006 |
| US6 | 1–4 | FR-100 đến FR-103 (FR-090 là phạm vi, không có kịch bản) | SC-001, SC-002, SC-004 |
| US7 | 1–3 | FR-110 đến FR-125 | SC-002 đến SC-010 |

## Requirements *(mandatory)*

### Functional Requirements

**Route và điều hướng của Files**

- **FR-001**: Module `files` PHẢI thay route khung của 012 bằng các route của `modules/files/index.ts`:
  `/files` (`files-collection`, con `+` = `add-file` là hộp thoại nổi trên danh sách), `/files/:primaryKey`
  (`files-item`), `/files/folders` → `/files`, `/files/folders/:folder` (`folders-collection`, con `+` =
  `add-file-folder`), `/files/all`, `/files/mine`, `/files/recent` (prop `special`); route không khớp → màn không tìm
  thấy trong module với sub-menu (`ContentNotFound` của 014 với prop module, CHK047); `preRegisterCheck` giữ của 012.
- **FR-002**: `checkForSystem` của 014 và `accessibleSystemCollections` giữ nguyên: `/content/directus_files` và item
  của nó chuyển tới `/files` và `/files/:id`, nay là màn thật (D-72 gỡ phần Files).
- **FR-003**: Sub-menu của module Files ở sidebar PHẢI là cây thư mục như `files-navigation.vue` (ngoại lệ L-3 mở rộng
  như 014 cho module Content, Clarifications Q3 của 014 áp dụng, recipe Q-13): mục gốc "File Library" (icon
  `folder_special`, active khi không có thư mục và không `special`), thư mục có con gập mở (`aria-expanded`), thư mục
  đang xem và các cha tự mở, trạng thái mở dùng chung toàn app (`useFolders.openFolders`, giá trị đầu `['root']`),
  vạch chia, ba mục "All files" (`file_copy`), "My files" (`folder_shared`), "Recent files" (`history`) active theo
  `special`; skeleton 4 dòng khi đang nạp lần đầu; bàn phím như FR-004b của 014 (tree, mũi tên, Enter).
- **FR-004**: Mỗi thư mục trong cây PHẢI có menu chuột phải và nút tương đương bàn phím (ẩn khi `actionsDisabled`, chỉ
  dùng ở drawer chọn file; menu không kiểm quyền thư mục trước, hành động bị API từ chối thì hộp lỗi như Directus,
  CHK010; tải thư mục chỉ có ở menu này, không gộp với nút tải về của page header, CHK100) với
  bốn mục như `files-navigation-folder.vue`: đổi tên (hộp với ô tên, `PATCH /folders/:id` `name`, nạp lại cây), chuyển
  (hộp với `FolderPicker` khóa chính nó, `PATCH /folders/:id` `parent`), tải thư mục (`POST /assets/folder/:id` với
  `download`, lưu blob theo `Content-Disposition`), xóa (`DeleteFolderDialog`, FR-016; xóa xong `router.replace` tới
  thư mục cha hoặc `/files`).
- **FR-005**: Thư mục PHẢI nạp một lần cho cả app bằng `GET /folders` `sort=name` qua `fetchAll` (`limit -1` theo trang
  như Directus), dựng cây `nestFolders`; `fetchFolders` gọi lại sau tạo, đổi tên, chuyển, xóa; danh sách file nạp lại khi
  danh sách thư mục đổi (trừ lần nạp đầu).
- **FR-006**: `FolderPicker` PHẢI là cây thư mục chọn một (mục gốc "File Library" = null), nạp `GET /folders`
  `limit=-1` `sort=name` (cache riêng mỗi instance, khác cache `useFolders` của cây; có thể lệch sau khi tạo thư mục
  tới khi mở lại picker, chấp nhận như Directus, CHK099), thư mục cha của giá trị hiện tại mở sẵn, `disabledFolders`
  không chọn được (chỉ khóa chính nó, không khóa con, như Directus; chuyển vào con tạo vòng → API từ chối hay nhận kiểm
  T002, nhận thì tái tạo và ghi R-xx, CHK077); dùng ở chuyển file, chuyển thư mục và `file`/`files` interface của 013
  nếu chúng chưa có.

**Danh sách file và thư mục**

- **FR-010**: Màn thư viện PHẢI dựng trên `use-layout` và preset `directus_files` của 014 (`layout`, `layoutOptions`,
  `layoutQuery`, `filter`, `search`, `resetPreset`), bộ lọc hệ thống `getFolderFilter(folder, special, currentUserId)`
  gộp với bộ lọc user bằng `mergeFilters` (`filter-user`, `filter-system` truyền riêng cho `system-filter`); preset mặc
  định khi chưa có là `defaultPresets` của `stores/presets.ts` Directus chép nguyên (store `presets` của 014 thêm; giá
  trị `layout_options.cards`, `layout_query.cards` đúng từng khóa, kiểm T002, CHK001); lựa chọn xóa khi rời hoặc đổi
  route.
- **FR-011**: Page header PHẢI có: breadcrumb "File Library" (chỉ khi tiêu đề khác "File Library"), tiêu đề (tên thư
  mục, `all_files|my_files|recent_files`, hoặc `file_library`), icon `folder`, nút hành động của layout
  (`layout-actions-*`), ô tìm kiếm với bộ lọc (`SearchInput` `directus_files`), nút tạo thư mục (FR-015), và khi có lựa
  chọn: chuyển thư mục (chỉ file, khóa khi không có update), xóa (file hoặc thư mục; khóa khi thiếu quyền delete
  tương ứng), sửa hàng loạt (chỉ file, `DrawerBatch`), tải về (chỉ file); nút tải lên (`add`, tới route `+`, khóa khi
  không có create).
- **FR-012**: Layout `cards` PHẢI nhận lại `extraSelection` (v-model) và slot `prepend` với `hasPrependContent` như
  `layouts/cards/cards.vue` và `header.vue` của Directus: số lượng chọn ở header là `selection + extraSelection`, nút
  "chọn tất cả" phát `select-all` để màn thư viện chọn mọi thư mục con đồng thời layout `selectAll()` chọn mọi file
  của trang hiện tại (CHK003), bỏ chọn xóa cả hai; `select-mode` bật khi có
  thư mục được chọn; bốn layout còn lại nhận `extraSelection` không dùng (như Directus).
- **FR-013**: Thư mục con PHẢI hiện bằng `FolderSection` trong slot `prepend` của layout khi không `special`, không
  `search`, không `filter`: mỗi thư mục là `Card` của layout cards với `icon: folder`, tiêu đề tên, link
  `/files/folders/:id`, `select-mode` khi có lựa chọn thư mục hoặc file; đang chuyển route (`isTransitioning`) thì
  layout ở trạng thái đang nạp và không hiện thẻ thư mục cũ; chỉ layout cards có slot `prepend`, bốn layout khác không
  hiện thư mục con như Directus (CHK002).
- **FR-014**: Xóa hàng loạt file PHẢI là hộp `batch_delete_confirm` (n) → `DELETE /files` với mảng id, nạp lại; chuyển
  thư mục hàng loạt là hộp với `FolderPicker` → `PATCH /files` `{ keys, data: { folder } }`, rồi tới thư mục đích (nếu
  khác null) và nạp lại; tải về: một file `GET /assets/:id?download`, nhiều file `POST /assets/files` body `{ ids }`
  (zip), tên từ `Content-Disposition` hoặc `unknown-<time>`; lỗi HTTP → hộp lỗi với body JSON.
- **FR-015**: Tạo thư mục PHẢI là hộp `create_folder` với ô tên (autofocus, Enter = lưu), `POST /folders` `{ name,
  parent }` (`parent` null ở gốc hoặc `root`), nạp lại cây và chuyển tới thư mục mới; nút khóa với tooltip
  `not_allowed` khi không có quyền tạo `directus_folders`.
- **FR-016**: Hộp xóa thư mục PHẢI như `delete-folder-dialog.vue`: tiêu đề `delete_folder`, đoạn
  `delete_folder_dialog.content_behavior`, radio `move_content` (mặc định) | `delete_content`, nút xóa kiểu danger;
  `move`: với mỗi thư mục, `GET /folders?filter[parent][_eq]` và `GET /files?filter[folder][_eq]` (`fields=id`,
  `limit=-1`) rồi `PATCH /folders` và `PATCH /files` với `keys` về `parent` của thư mục (null khi thư mục ở gốc: về
  "File Library", CHK011), sau đó `DELETE /folders`;
  `delete`: gom id đệ quy (`collectAllFolderIds`), `PATCH /folders` gỡ `parent` của thư mục con trong tập, `GET /files`
  `folder._in` rồi `DELETE /files`, rồi `DELETE /folders`; ở thư viện, xóa thư mục kèm file đã chọn thì `DELETE /files`
  các file đó sau khi xong; lựa chọn xóa, cây nạp lại.
- **FR-017**: Trạng thái trống PHẢI như kịch bản US1-6; nút xóa bộ lọc đặt `filter` và `search` về null.
- **FR-018**: Panel L-4 của thư viện PHẢI có Layout (`LayoutSidebarDetail` + `layout-options-*`), `layout-sidebar-*`,
  Export/Import với collection `directus_files`, `layoutQuery`, bộ lọc gộp và `search`; không có Archive, Refresh,
  Flows (Directus không có ở màn này).
- **FR-019**: `DrawerCollection`, `DrawerFiles` của 013/014 khi chọn `directus_files` PHẢI giữ hành vi 014 (layout
  theo preset); `drawer-files.vue` của Directus có cây thư mục (`FilesNavigation` với `customTargetHandler`,
  `actionsDisabled`): kiểm `DrawerFiles` 013 ở T002, nếu chưa có thì 015 thêm cây thư mục vào `DrawerFiles` (CHK075).

**Tải lên**

- **FR-020**: Hộp `add_file` PHẢI mở theo route `+` (`useDialogRoute`: đóng là `router.push` về route thư mục), nội
  dung `BoUpload` `multiple` `fromUrl` `folder` `accept` (từ `info.files.mimeTypeAllowList` qua
  `parseGlobalMimeTypeAllowList`), nút "done"; mỗi file tải xong phát `upload` để màn thư viện nạp lại; mở trực tiếp
  bằng URL thì hộp vẽ trên thư viện (route cha vẽ cùng); đóng khi đang tải thì tải tiếp ở nền như Directus (không hủy),
  danh sách nạp lại khi xong (CHK007).
- **FR-021**: Kéo thả toàn cửa sổ PHẢI như `useFileUpload` của `collection.vue`: lắng `dragenter|dragover|dragleave|drop`
  trên `window`, chỉ khi `dataTransfer.types` có `Files`, đếm `dragCounter`, viền thả bốn cạnh quanh vùng nội dung và
  notice `drop_to_upload` (icon `cloud_upload`, tại chỗ, D-66) khi bắt đầu kéo ngoài vùng `data-dropzone`; vào vùng
  `data-dropzone` thì tắt viền; thả: lọc file có `type`, notice tiến độ `upload_files_indeterminate` `{ done, total }`
  và phần trăm (phần trăm mỗi file: TUS theo byte, multipart theo XHR; gộp trung bình như `uploadFiles`, CHK006),
  `uploadFiles` với preset `{ folder }` và `maxConcurrency` từ `info.uploads` (≤ 0 hoặc thiếu = không giới hạn,
  CHK004), store đếm upload đang chạy (`isAnyUploadActive`); xong thì gỡ notice, phát `upload`, nạp lại danh sách (khi
  `isAnyUploadActive` từ true về false). Viền thả là bốn `div` `fixed` theo khung của `<main>`, `border-2
  border-brand-500`, `pointer-events-none`, `aria-hidden` (CHK033); notice là `BoNotice` trong page header với
  `aria-live="polite"`, nội dung `upload_files_indeterminate` + phần trăm, gỡ khi xong (CHK034); mục kéo không phải
  file (thư mục, `type` rỗng) bị bỏ qua không thông báo (CHK078); không giới hạn số file ở client, file bị API từ chối
  (413, kiểu) hiện lỗi từng file như `BoUpload` 013, file khác tiếp tục (CHK004).
- **FR-022**: `uploadFile` PHẢI port `utils/upload-file.ts`: `info.uploads.tus` bật → `tus-js-client` tới `files/tus`
  (`chunkSize` từ server hoặc `DEFAULT_CHUNK_SIZE`, metadata = mọi khóa của preset + `filename_download` + `type` (+
  `id` chỉ khi `fileId`; tus-js-client mã hóa base64 theo giao thức, CHK005), `removeFingerprintOnSuccess`, `withCredentials`, `onShouldRetry` false, `fileInfo.id` từ header
  `Directus-File-Id`, tiếp tục upload dở, thành công thì `GET /files/:id`); tắt → multipart `POST /files` hoặc
  `PATCH /files/:id` (`fileId`) với `onUploadProgress`; `BoUpload` của 013 PHẢI dùng hàm này (thêm `fileId` cho thay
  file, FR-033) và store server PHẢI đọc `uploads` từ `/server/info`.
- **FR-023**: `uploadFiles` PHẢI port `utils/upload-files.ts` (`p-queue` với `concurrency = maxConcurrency` hoặc vô
  hạn, tiến độ từng file, notice thành công khi `notifications`).
- **FR-024**: Danh sách request ghi của tải lên và tải về (nguồn chuẩn: `contracts/api-calls.md` #114–#122): `POST /files` (multipart: tải lên, bản sao FR-031, trình
  chỉnh ảnh lưu mới FR-044), `PATCH /files/:id` (multipart, thay file và trình chỉnh ảnh), `POST /files/import` (từ
  URL), `POST|PATCH|HEAD|DELETE /files/tus` (TUS), `POST /assets/files` và `POST /assets/folder/:id` (zip, chỉ đọc
  nhưng là POST); không request ghi khác (CHK049).

**Màn file**

- **FR-030**: Màn `/files/:id` PHẢI dùng `use-item` của 014 với `directus_files` (không có trạng thái item mới: `/files/+`
  là hộp tải lên, `isNew` luôn false, CHK014) (`isNew`, `edits`, `hasEdits`, `item`,
  `permissions`, `save`, `remove`, `refresh`, `validationErrors`), page header như kịch bản US2-4 (nút quay lại
  `/files`, breadcrumb tới thư mục của file), tiêu đề `item.title` (`loading` khi đang nạp), `fieldsDenyList` như
  `item.vue`, form khóa khi không có update; Ctrl/Cmd+S lưu và ở lại; `use-edits-guard`; item không tồn tại → màn
  không tìm thấy với sub-menu.
- **FR-031**: Lưu: `saveAndQuit` (lưu rồi về thư mục của file hoặc `/files`), `saveAndStay` (nạp lại item và
  Revisions), `saveAsCopy` (kịch bản US2-7: `GET /assets/:id` blob, `uploadFile` với preset các field không
  `hidden`/`readonly` cộng `folder`, `storage` và `edits`, notice `item_create_success`, tới item mới; áp cho mọi kiểu
  file; `filename_download` giữ, tên trên đĩa do API đặt, CHK009), `discardAndStay`;
  `SaveOptions` khóa `save-and-add-new` luôn và `save-as-copy` khi không có create.
- **FR-032**: Xem trước PHẢI là `FilePreview` của 013 (ảnh, video, audio, PDF, khác) với nút "thay file" dưới xem trước
  (ẩn khi không có update); hộp `replace_file` với `BoUpload` `fileId` `fromUrl` `accept`; thay xong nạp lại item.
- **FR-033**: Thay file PHẢI đi qua `uploadFile` với `fileId`: TUS với metadata `id` khi server bật, multipart
  `PATCH /files/:id` khi tắt (như Directus, CHK008), không đổi `id`; `BoUpload` nhận
  `fileId` (013 ghi chú chưa có vì FR-054 của 013; 015 thêm và bổ sung danh sách FR-024).
- **FR-034**: Nút chuyển thư mục PHẢI mở hộp `move_to_folder` với `FolderPicker` (giá trị đầu là `folder` của item),
  `PATCH /files/:id` `{ folder }` với query `fields=folder.name` (bộ so payload so cả query), notice `file_moved` với
  `response.data.folder.name` hoặc "File Library" khi null (icon `folder_move`), nạp lại (CHK048).
- **FR-035**: Nút tải về PHẢI là link `href=/assets/:id?download` với `download=filename_download`.
- **FR-036**: Nút chỉnh ảnh PHẢI hiện khi `item.type` chứa `image` và có update; mở `ImageEditor` (FR-040).
- **FR-037**: Xóa PHẢI là hộp `delete_are_you_sure` (Keep/Hủy trước, D-76) → `DELETE /files/:id` → `router.replace`
  về `/files` (`use-item` của Directus xóa `item` nên `to` không còn thư mục; kiểm khi code T046); nút khóa khi không có
  delete.
- **FR-038**: Panel PHẢI có "Chi tiết file" (`FileInfoSidebarDetail`, kịch bản US2-4: `readableMimeType`, `n(width) ×
  n(height)`, `duration`, `formatFilesize`, `charset`, `embed`, ngày `created_on`/`uploaded_on`/`modified_on` dạng ngắn
  với tooltip dạng dài, chủ sở hữu và người sửa qua `GET /users/:id` `fields=id,email,first_name,last_name,role` với
  `UserPopover` và link `/users/:id` (request lỗi 403/404 → bỏ dòng, không hộp lỗi, CHK013), link mở file tab mới
  (`/assets/:id`), link thư mục (`GET /folders/:id` `fields=id,
  name`; `open_folder` với tên hoặc "File Library"), nút chép id (`copy_id_success|fail`), nhóm EXIF sau vạch chia: chỉ
  năm trường máy, khẩu độ, tốc độ, tiêu cự, ISO; không hiện trường khác của `metadata` như GPS, CHK085),
  Revisions (`isNew` false và `revisionsAllowed`; `revert` gộp vào `edits`), Comments (`isNew` false).
- **FR-039**: Danh sách request của màn file (nguồn chuẩn: `contracts/api-calls.md` #97–#122): `GET /files/:id`, `GET /folders/:id`, `GET /users/:id`,
  `GET /assets/:id`, `PATCH /files/:id`, `DELETE /files/:id`, `POST /files` (bản sao), Revisions và Comments như 014.

**Trình chỉnh ảnh (dùng chung, D-59)**

- **FR-040**: `ImageEditor` PHẢI là `BoDrawer` (`persistent`, `title=editing_image`, phụ đề `changes_are_permanent`,
  hủy = đóng, apply = lưu) với props `id`, `modelValue`, `createAllowed`, emit `refresh`, `new-file`; port
  `image-editor.vue` trên Cropper.js (cùng major với Directus 11.17.4, `autoCrop: false`, `autoCropArea: 0.5`,
  `viewMode: 1`, `dragMode: move`, `toggleDragModeOnDblclick: false`, `crop` throttle 50 ms cập nhật kích thước mới,
  xoay 90°/-180° hoán đổi rộng cao).
- **FR-041**: Mở PHẢI `GET /files/:id` với `fields=type,filesize,filename_download,folder,width,height,focal_point_x,
  focal_point_y`, ảnh `/assets/:id?<nanoid>`; đóng thì hủy Cropper và xóa trạng thái; lỗi nạp → notice lỗi.
- **FR-042**: Thanh công cụ PHẢI có: ba chế độ `move|crop|focal_point` (focal: khung vuông 10% bề rộng tối thiểu 16 px
  đặt tại điểm focal hiện có hoặc giữa, tỉ lệ 1), xoay -90°, lật ngang (`scaleY`), lật dọc (`scaleX`) như Directus,
  menu tỉ lệ (`custom_aspect_ratios` của settings trước vạch chia, rồi 16:9, 3:2, 5:4, 7:5, vuông, tự do (`NaN`), gốc)
  với icon theo tỉ lệ (`crop_16_9`...; custom trùng tỉ lệ chuẩn → `crop_square` như Directus; điểm focal ngoài ảnh →
  Cropper kẹp khung, CHK015), đặt lại (`reset` + về `move`), dòng kích thước đúng chuỗi `dimensionsString` của Directus
  (số theo `n()` của locale; SVG: "SVG → PNG WxH", CHK037), nút hủy cắt/hủy chọn khi đang cắt; mọi nút là `button` có
  nhãn/tooltip, phím tắt không bắt buộc.
- **FR-043**: Lưu PHẢI như `save()` của Directus: `hasEdits` = dữ liệu Cropper khác mặc định hoặc đang cắt; điểm focal
  chỉ lưu khi ở chế độ focal và đang chọn (tâm khung, làm tròn), `clear()` trước khi kiểm thay đổi ảnh; thay đổi ảnh →
  `getCroppedCanvas({ imageSmoothingQuality: 'high' }).toBlob(type)` → `PATCH /files/:id` FormData (`focal_point_x/y`
  nếu có, rồi `file` với tên `filename_download`); chỉ focal → `PATCH` JSON; xong: `refresh`, về `move`, nonce mới,
  đóng; lỗi → hộp lỗi, giữ drawer.
- **FR-044**: "Lưu thành file mới" (menu phụ của nút lưu, chỉ khi `createAllowed`) PHẢI `POST /files` FormData với
  `folder` là thư mục của ảnh gốc (`imageData.folder`, không theo option `folder` của field, CHK016) và `file`, phát
  `new-file(id)`, đóng; màn file đi tới `/files/:id`; `file-image` đặt giá trị field.
- **FR-045**: `file-image` của 013 PHẢI có nút chỉnh ảnh (tooltip `edit`, icon `tune`) khi có quyền update
  `directus_files` và file là ảnh, mở cùng `ImageEditor`; lưu xong nạp lại xem trước với `cacheBuster` (gỡ D-59; FR-051
  và FR-054 của 013 cập nhật: thêm `PATCH /files/:id` multipart và `POST /files` vào danh sách ghi khi dùng nút này).
- **FR-046**: Khung cắt và điểm focal chỉ kéo bằng chuột như Directus (owner chọn 2026-10-15, không có ô nhập số);
  ngoại lệ a11y ghi rõ ở FR-111 và SC-008; các nút thanh công cụ vẫn dùng được bằng bàn phím (FR-042).

**Route và điều hướng của Users**

- **FR-050**: Module `users` PHẢI thay route khung của 012 bằng các route của `modules/users/index.ts`: `/users`
  (`users-active`, `status=active`), `/users/suspended`, `/users/invited`, `/users/all`, `/users/:primaryKey`,
  `/users/roles` → `/users`, `/users/roles/:role`, `/users/roles/:role/+` (item mới với `role`); không có route
  `/users/me` riêng (route `redirect` của 012 bỏ, như Directus; owner 2026-10-16, D-86 bỏ; CHK027, CHK055); `preRegisterCheck` giữ của 012; `checkForSystem` chuyển
  `/content/directus_users` tới đây (D-72 gỡ phần Users).
- **FR-051**: `UserMenu` của 012 PHẢI trỏ hồ sơ tới `/users/<id>` như `module-bar-avatar.vue`; user share không có mục
  hồ sơ (kiểm 012 đã vậy, CHK028); `ProfileRoute` của 012 bỏ (D-48 gỡ), E2E `profile.spec.ts` chuyển sang màn user.
- **FR-052**: Sub-menu PHẢI như `navigation.vue`: bốn mục trạng thái (`active_users` `group`, `suspended_users`
  `group_off`, `invited_users` `person_add`, `all_users` `folder_shared`, `exact`), vạch chia khi có role hoặc đang nạp,
  skeleton 4 dòng khi nạp, cây role từ `useNavigation` (`GET /roles` `fields=id,name,icon,parent` `sort=name`, nạp một
  lần cho cả app, cây theo `parent` bằng `groupBy`, 403 → hộp lỗi như Directus và cây rỗng (nút mời đã ẩn vì không đọc
  được role, CHK018), role đang xem và các cha tự mở, trạng thái mở dùng chung); mục role
  là `NavigationRole` (icon role, tên qua `translate`, có con thì gập mở), bấm tới `/users/roles/:id`; bàn phím như
  FR-003.
- **FR-053**: Admin PHẢI có menu chuột phải (và nút tương đương) trên role với mục "sửa role" tới
  `/settings/roles/:id` (khung 012 tới 016, D-85).
- **FR-054**: Route không khớp trong module → màn không tìm thấy với sub-menu, dùng cùng component `ContentNotFound`
  của 014 với prop module (sub-menu theo module; Directus users không có route not-found riêng mà rơi về 404 của app,
  đây là chi tiết hiển thị, không ghi D-xx, CHK057); item không tồn tại hoặc không đọc được → cùng màn (CHK047).
- **FR-055**: `getItemRoute('directus_users', id)` và `getCollectionRoute` của 014 giữ `/users/:id`, `/users`; link
  user ở `UserPopover`, displays `user`, comments trỏ màn này.

**Danh sách user và mời**

- **FR-060**: Màn danh bạ PHẢI dựng trên `use-layout` và preset `directus_users` (mặc định là `defaultPresets` của
  `stores/presets.ts` Directus chép nguyên, `tabular`, CHK001, T002), bộ lọc hệ thống
  `mergeFilters(roleFilter, statusFilter)` (`{_and: [{role: {_eq}}]}`, `{_and: [{status: {_eq}}]}`) truyền riêng và gộp
  với bộ lọc user; lựa chọn xóa khi rời hoặc đổi route.
- **FR-061**: Page header PHẢI có: breadcrumb "User Directory" (chỉ khi có `role`), tiêu đề (`<status>_users`,
  `all_users`, hoặc tên role), icon `people_alt`, nút hành động layout, ô tìm kiếm với bộ lọc (`directus_users`), khi có
  lựa chọn: xóa (hộp `batch_delete_confirm`, khóa khi không có delete), sửa hàng loạt (`DrawerBatch`); nút mời (FR-063)
  khi `canInviteUsers`; nút tạo (`add`, tới `/users/roles/:role/+` hoặc `/users/+`, khóa khi không có create).
- **FR-062**: Xóa hàng loạt PHẢI `DELETE /users` với mảng id; nếu chứa id user hiện tại thì `logout()` ngay sau; không
  thì nạp lại, xóa lựa chọn, đóng hộp.
- **FR-063**: `canInviteUsers` = `auth.disableDefault` tắt và có create `directus_users` và read `directus_roles`; hộp
  `UsersInvite` như kịch bản US3-3: `POST /users/invite` `{ email: string[], role }` (email tách bằng `,` hoặc xuống
  dòng, trim, bỏ rỗng), `role` từ `GET /roles` `fields=id,name` `sort=name` (mặc định phần tử đầu; không có ô chọn khi
  đi từ route role; không có role nào thì select rỗng và gửi không `role`, CHK019), lỗi `RECORD_NOT_UNIQUE` tại chỗ
  (`email_already_invited` `{ email: extensions.invalid }` hoặc `validationError.unique` một lần), lỗi khác kể cả
  `FAILED_VALIDATION` của email sai qua hộp lỗi, email lặp trong ô do API xử lý (CHK020); thành công thì đóng hộp, nạp
  lại danh sách, rồi notice ở page header `contact_admin_for_link` (chuỗi overlay của 012) vì không có email (D-83);
  Backoffice không hiển thị token mời và không có đường riêng để user được mời vào app (link trong log API là việc vận
  hành; E2E chỉ kiểm lời mời tạo user `invited` và notice, Clarifications 2026-10-15, CHK043).
- **FR-064**: Trạng thái trống PHẢI như kịch bản US3-5 (`no_items` khi không `loadingItemCount`; `no_results` với bộ
  lọc).
- **FR-065**: Panel PHẢI có Layout, `layout-sidebar-*`, Export/Import (`directus_users`, bộ lọc gộp `?? undefined`,
  `search ?? undefined`).
- **FR-066**: Danh sách request ghi của danh bạ (nguồn chuẩn: `contracts/api-calls.md` #123–#134): `DELETE /users`, `POST /users/invite`, `PATCH /users` (hàng loạt qua
  `DrawerBatch`), `/presets`, `/utils/import/directus_users`, `/utils/export`; không request ghi khác.

**Màn user**

- **FR-070**: Màn `/users/:primaryKey` (và `/users/roles/:role/+`) PHẢI dùng `use-item` với `directus_users`, query
  `fields=*,role.*,avatar.id,avatar.modified_on`, `edits.role` đặt trước từ prop `role` khi mới; giá trị ban đầu của form
  là item với `role` thu về `role.id`; `fieldsDenyList` = `id`, `last_page`, `created_on`, `created_by`, `modified_by`,
  `modified_on`, `last_access`; `provider` và `external_identifier` đặt `readonly` khi không mới và không admin (user
  mới thì sửa được, CHK029); form
  khóa khi không mới và không có update; `provide('discardAllChanges')` và `provide('refresh')` cho interface con;
  `use-edits-guard`; Ctrl/Cmd+S lưu và ở lại, Ctrl/Cmd+Shift+S lưu và thêm mới.
- **FR-071**: Page header PHẢI như kịch bản US4-1: tiêu đề `userName(item)` (`loading`, `adding_user`), nút xóa (hộp
  `delete_are_you_sure`; xóa chính mình → `remove()` rồi `logout()`; khác → `router.replace` `/users`), archive (chỉ khi
  `collectionInfo.meta.archive_field` và không mới; tooltip `archive|unarchive|not_allowed`; hộp xác nhận kiểu warning;
  archive xong về `/users`, bỏ archive ở lại), lưu với `SaveOptions` (khóa `save-and-add-new` và `save-as-copy` khi
  không có create).
- **FR-072**: Sau lưu PHẢI `setLang` (nếu là user hiện tại và `language` mới, hoặc `default_language` khi null, khác
  locale: nạp lại store fields và collections) rồi `refreshCurrentUser` (`userStore.hydrate()` khi là user hiện tại;
  watcher của 012 đổi locale và theme theo store, CHK039); `saveAndQuit` về `users-active`, `saveAndStay` ở item mới `router.replace` tới id mới, không thì nạp lại item
  và Revisions; `saveAndAddNew` tới `/users/+`; `saveAsCopy` tới id mới.
- **FR-073**: Hộp user (không mới) PHẢI như kịch bản US4-1 (skeleton khi nạp; avatar `getAssetUrl(avatar.id,
  { imageKey: 'system-medium-cover', cacheBuster: avatar.modified_on })`, `alt=avatar`, lỗi ảnh → icon; tên + `, title`;
  email với icon `alternate_email` (email hiện ở cả hộp và form như Directus, CHK102); `location` với `place`; chip
  role với class `status`, màu theo recipe Q-18); hộp user cùng bề ngang form `max-w-5xl` (CHK040); recipe Q-18.
- **FR-074**: Panel PHẢI có "Thông tin" (`UserInfoSidebarDetail`: `key` = id với nút chép khi hỗ trợ, `last_page` là
  `RouterLink`, `last_access` dạng ngày ngắn), Revisions (không mới, `revisionsAllowed`), Comments (không mới).
- **FR-075**: Form PHẢI hiện các field của `users.yaml` với interface của 013 đã có (`input`, `input-hash` cho
  `password`, `file` cho `avatar`, `input-multiline`, `tags`, `presentation-divider`, `select-dropdown` cho
  `text_direction`, `appearance`, `status`, `provider`, `boolean` cho `email_notifications`, `select-dropdown-m2o` cho
  `role`, `list-m2m` cho `policies` tới `directus_access`) và sáu interface mới (FR-080 đến FR-086); nhóm và divider
  (`preferences_divider`, `theming_divider`, `admin_divider` với `title` `$t:fields.directus_users.admin_options`),
  `hidden` (`auth_data`) và `readonly` theo metadata; field `theme_*` nhận `appearance` từ form như Directus (option
  `appearance` của field).
- **FR-076**: Lưu PHẢI `PATCH /users/:id` (hoặc `POST /users` khi mới) chỉ với field đã sửa; lỗi `FAILED_VALIDATION`,
  `RECORD_NOT_UNIQUE` hiện tại field (013); mật khẩu không gửi khi trống.
- **FR-077**: Danh sách request của màn user (nguồn chuẩn: `contracts/api-calls.md` #102–#106, #123–#131): `GET /users/:id`, `PATCH /users/:id`, `POST /users`, `DELETE /users/:id`,
  `GET /roles`, `GET /access`/`GET /policies` (list-m2m), `GET /files` (avatar), `GET /utils/random/string`,
  `POST /users/me/tfa/generate|enable|disable`, `POST /users/:id/tfa/disable`, Revisions, Comments; không request khác.
- **FR-078**: Archive ở `directus_users` dùng `archive_field = status`, `archive_value = archived`,
  `unarchive_value = draft` của collection hệ thống như `use-item` 014.
- **FR-079**: Màn user PHẢI đạt bố cục form của 014 (`max-w-5xl`, D-82) với hộp user phía trên cùng bề ngang (CHK040).

**Interface `_system` của `directus_users` (D-57, phần 015)**

- **FR-080**: `system-language` (`types: string`, `system: true`, không option): dropdown `BoSelect` với
  `availableLanguages` của app (en-US, vi-VN; mã khác hiện thô, D-46), mục đầu "mặc định dự án" (`fields.directus_settings.
  default_language`, giá trị null) khi `includeProjectDefault`; placeholder `language_placeholder`; `disabled`.
- **FR-081**: `system-input-password` (`types: string|text`, option `placeholder`): `BoInput` `type=password|text` với
  nút mắt (`show_password|hide_password`), `autocomplete=new-password` mặc định, `autofocus`; không có màn dùng
  ở 015 (form đăng ký để lại, Q2) nhưng vẫn port cho đủ bộ D-57; trong form user, `password` vẫn là `input-hash` theo
  metadata (CHK050: 5 interface có màn dùng, 1 chỉ có trong registry).
- **FR-082**: `system-mfa-setup` (`types: text`): ô kiểu checkbox khối hiện `enabled|disabled` với icon `launch`, khóa khi
  `disabled` hoặc (không phải chính mình và chưa bật); `effectiveTFAEnabled` theo `tfa_secret` (từ `inject('values')`
  của form hoặc store user) và khóa `require_tfa_setup` cho SSO chỉ khi xem chính mình (xem user khác chỉ theo
  `tfa_secret` vì khóa nằm ở trình duyệt của user đó, CHK022); secret TFA chỉ hiện trong hộp, không log, không vào URL
  (CHK084); ba hộp như `system-mfa-setup.vue`: bật (SSO:
  `sso_tfa_setup_notice` → `requestTFASetup` = gọi `discardAllChanges`, ghi localStorage, `logout()`; mật khẩu:
  `enter_password_to_enable_tfa` → `generateTFA(true)` → QR canvas + secret + OTP → `enableTFA`), tắt (chính mình: OTP →
  `disableTFA`; khác: `admin_disable_tfa_text` → `adminDisableTFA(pk)` = `POST /users/:pk/tfa/disable`), hủy thiết lập
  SSO đang chờ (`cancel_tfa_setup_notice` → xóa khóa, `hydrate`); `use-tfa-setup` của 012 PHẢI mở rộng với
  `disableTFA`, `adminDisableTFA`, `requestTFASetup`, `cancelTFASetup`, `requireTfaSetup` (khóa `backoffice-require_tfa_setup`,
  D-39); OTP 6 số mới bật nút; lỗi `VError` tại chỗ; focus vào ô OTP khi QR hiện.
- **FR-083**: `system-token` (`types: hash`): ô readonly `type=password` (hoặc text khi vừa tạo) với placeholder
  `value_securely_saved|placeholder`; icon chép (khi vừa tạo và hỗ trợ clipboard), tạo/tạo lại (`add|refresh`, ẩn khi
  `disabled` hoặc user mới), xóa (`clear` khi có token và không `disabled`, else `vpn_key`); tạo: `GET /utils/random/string`
  rồi `PATCH <endpoint>/<primaryKey>` `{ token }` (`getEndpoint(collection)`), hiện token và notice `token_saved_notice`
  + `token_saved_copy`; tạo lại: hộp `regenerate_confirm_*` kiểu danger; xóa: hộp `remove_confirm_*` → `PATCH`
  `{ token: null }` rồi `inject('refresh')`; user mới: khóa + notice `new_user_disabled_notice`; giá trị `****` từ API
  nghĩa là đã có token; focus chọn hết text, blur bỏ chọn; token cũ mất hiệu lực ngay khi tạo lại, phiên cookie hiện
  tại không đổi (E2E dùng token mới, CHK023); nút tạo hiện khi field không `disabled`, API trả 403 thì `VError` tại
  chỗ (CHK073); token chỉ giữ trong state component, không log, không vào URL, mất khi rời màn (CHK084).
- **FR-084**: `system-theme` (`types: string`, prop `appearance`, `includeNull`): danh sách theme Directus của
  `appearance` (`@directus/themes`: Directus Default, Minimal, Color Match... cùng `id` và `name`) dạng radio, mỗi mục có
  ô xem trước là port của `theme-preview.vue` (SVG khung app với biến `--theme--*` của theme đó cộng overrides đã lưu
  của user từ `useThemeConfiguration` như Directus, không phải giá trị đang sửa trong form, CHK026; `rulesToCssVars`)
  để xem trước đúng màu Directus (Q1 = C, D-88); rule của từng theme là dữ liệu tĩnh `src/theme/directus-themes.json`
  (`{light, dark}` với `id`, `name`, `appearance`, `rules`) sinh bởi `scripts/sync-directus-themes.mjs` từ
  `directus/packages/themes` 11.17.4 và có test so với nguồn (D-89, FR-121, CHK041); giá trị null thì chọn theme đầu;
  giá trị là id không có trong dữ liệu thì không mục nào active và giá trị giữ nguyên khi lưu (CHK024); `includeNull`
  thêm mục đầu `default_sync_with_project` (null) xem trước bằng theme mặc định của dự án (`default_theme_light|dark`
  từ `/server/info`); nhãn mỗi theme qua khóa dịch `theme_directus_*` của file dịch 012 nên hiện "Backoffice Default"...,
  `id` ghi DB giữ "Directus Default"... (định danh tương thích, IX; D-88; Clarifications 2026-10-15); chọn theme không
  đổi giao diện Backoffice (D-43), kèm dòng ghi chú dưới danh sách với khóa overlay `theme_applies_in_directus` (en-US và
  vi-VN, CHK042).
- **FR-085**: `system-theme-overrides` (`types: json`, prop `appearance`): cây nhóm gập mở từ rule của theme Directus
  mặc định theo `appearance` (dữ liệu tĩnh chép từ `@directus/themes`, D-89): nhóm `$root` (rule không lồng) rồi nhóm
  theo khóa, mỗi rule lá là ô text (`type: 'color'` cho mọi rule như Directus, kể cả `borderRadius`, `fontFamily`, số,
  CHK025) với placeholder là giá trị mặc định và swatch chỉ khi giá trị parse được thành màu (`color`, `var(--...)`
  resolve được, `color-mix(`); giá trị không phải object → cây rỗng, không ném lỗi, lưu giữ nguyên (CHK082); nhập = `setWith(clone(value), path, v)`, xóa = `unset` rồi gỡ nhóm rỗng lên trên; `lang=
  en-US dir=ltr`; chỉ khóa có ánh xạ sang token design-system (D-43) đổi giao diện Backoffice khi lưu, khóa khác vẫn lưu
  cho Directus.
- **FR-086**: Sáu interface PHẢI đăng ký trong registry 013 với cùng `id`, `name`, `icon`, `types`, `system`, `options`
  như Directus; test registry của 013 cập nhật (số interface hiện có của `registry.test.ts`, đếm ở T002, + 6);
  `system-input-password` chỉ có trong registry (CHK050).

**Đăng ký công khai (D-44)**

- **FR-090**: `/register` PHẢI giữ nguyên trang public "chưa có sẵn" của 012 và link đăng ký ở trang đăng nhập; 015
  không làm form đăng ký (owner chọn 2026-10-15, Q2); D-44 của 012 còn mở, cột "Gỡ ở" đổi thành "sau 015".

**Quyền**

- **FR-100**: Quyền PHẢI lấy từ `useCollectionPermissions`/`useItemPermissions` của 014 cho `directus_files`,
  `directus_folders`, `directus_users`, `directus_roles`; nút khóa với tooltip `not_allowed` hoặc ẩn đúng chỗ Directus
  ẩn (bảng ở kịch bản US6-3); không gửi request mà user không có quyền (ví dụ `GET /roles` cho mời chỉ khi
  `canInviteUsers`).
- **FR-101**: User không admin sửa user khác: `provider`, `external_identifier` chỉ đọc; TFA chỉ tắt được bởi admin;
  token tạo được khi có update (API kiểm quyền field).
- **FR-102**: Field không đọc được (quyền một phần): `BoForm` bỏ như 013; panel "Chi tiết file"/"Thông tin" ẩn dòng thiếu
  dữ liệu.
- **FR-103**: Share user (`share` trong `/users/me`): không có hai module (như 012).

**Chung: design-system, truy cập, ngôn ngữ, hiệu năng, test**

- **FR-110**: Mọi màn PHẢI dùng token và recipe của `design-system/` (XII): `PrivateView`, page header L-5, panel L-4,
  sub-menu L-3 (ngoại lệ cho Files và Users như Content: sub-menu gồm mục phẳng và cây lồng cùng lúc, Files = cây thư
  mục + ba mục đặc biệt, Users = bốn mục trạng thái + cây role; ghi vào `layout-patterns.md` §7 và §11 khi 014 mở khóa
  tài liệu, CHK098), `BoDialog` cho mọi hộp xác nhận (nút an toàn trước, D-76), `BoDrawer` cho trình chỉnh ảnh, layout
  cards với thẻ thư mục (recipe Q-3 mở rộng); màn chưa có mẫu ghi Q-13 đến Q-19, recipe nháp vào `design-system/docs/`
  trước khi code, design owner duyệt trước khi đóng.
- **FR-111**: WCAG 2.1 AA như 012 FR-067 và 014: axe 0 vi phạm serious/critical; cây thư mục và cây role có vai trò
  `tree`; menu chuột phải có nút bàn phím tương đương; viền thả và tiến độ tải có `aria-live`; drawer chỉnh ảnh bẫy
  focus; ô QR có mô tả văn bản (secret); mọi nút icon có nhãn; thẻ thư mục trong lưới là link cộng ô chọn riêng như
  thẻ file của 014, viền thả `aria-hidden` (CHK086); skeleton tôn trọng `prefers-reduced-motion`, Cropper không có
  chuyển động (CHK087). Ngoại lệ ghi nhận (owner, 2026-10-15): khung cắt và
  điểm focal của trình chỉnh ảnh chỉ kéo bằng chuột như Directus, không có đường bàn phím; axe không bắt được, ghi ở
  `qa/handoff-checklist.md`.
- **FR-112**: Chuỗi dịch lấy từ file sinh của 012 (`file_library`, `all_files`, `my_files`, `recent_files`,
  `drop_to_upload`, `upload_files_indeterminate`, `delete_folder_dialog.*`, `invite_users`, `email_already_invited`,
  `interfaces.system-token.*`, `sso_tfa_setup_notice`, `editing_image`, `changes_are_permanent`...);
  thiếu thì chạy lại script sinh; chuỗi riêng vào overlay: D-83 dùng `contact_admin_for_link` đã có, D-88 thêm
  `theme_applies_in_directus` (en-US "The theme is saved to your profile. The Backoffice look does not change.", vi-VN
  "Theme được lưu vào hồ sơ. Giao diện Backoffice không đổi."; owner 2026-10-16: không nêu tên app khác) (CHK042).
- **FR-113**: Thông báo thành công/lỗi là notice tại chỗ (D-66) tới 018; không snackbar.
- **FR-114**: Không collab, không AI (D-41, D-54, D-68): bỏ `CollabIndicatorHeader`, `ComparisonModal` chế độ `collab`,
  hộp `unsaved_changes_collab` của hai màn item.
- **FR-115**: Danh sách request được phép trong E2E = FR-024, FR-039, FR-066, FR-077 cộng của 012/014; 0 request ra
  ngoài (`route()` stub server nhập từ URL).
- **FR-116**: Bộ mẫu `bo_files` (thư mục lồng, ≥ 30 file nhiều kiểu, ảnh có EXIF, file của user khác, file 5 ngày
  trước) và `bo_users` (3 role lồng, user mỗi trạng thái, user SSO, user có token và TFA) seed qua Directus REST bằng
  script của 013 mở rộng, snapshot commit; `bo_std`, `bo_content` không đổi; sau seed xóa cache `?system` trên cả hai
  API (bài học 014).
- **FR-117**: Test: unit/component cho sáu interface, `ImageEditor` (mock Cropper hoặc browser project), `FolderPicker`,
  `FilesNavigation`, `UsersNavigation`, `DeleteFolderDialog`, `UsersInvite`, `FileInfoSidebarDetail`, `uploadFile`
  (TUS và multipart), layout cards với `extraSelection`/`prepend`; E2E `files-library`, `files-upload`, `files-item`,
  `files-image-editor`, `users-directory`, `users-item`, `users-tfa-token`, `files-users-permissions`,
  `files-users-parity-ui` (9 spec, khớp `contracts/tests.md` §3, CHK058) ở ba cấu hình (bảng trình duyệt như SC-001;
  spec cũng điều khiển Directus app, tức payload và parity-ui, chỉ chạy chromium-1280 qua `DIRECTUS_APP_SPECS` của
  `playwright.config.ts` như 014 làm ngày 2026-10-15 vì giới hạn 100 phút của job); payload suite mở rộng; lượt `vi-VN`
  của `files-users-permissions` gồm nhãn field và ngày của `users-item` (CHK074); E2E dùng `openSidebar` dưới `xl`,
  khôi phục preset seed sau khi đổi layout hoặc tìm, chạy tuần tự trên DB chung (bài học 014).
- **FR-118**: Benchmark: thêm kịch bản `files` và `users` vào benchmark web hằng tuần (thư viện 10.000 file trong một
  thư mục, danh bạ 10.000 user; ba phép đo trang đầu cards, đổi trang, lọc; 11 lần, p95, như `contracts/tests.md` §5,
  CHK067); không chặn CI.
- **FR-119**: Bundle: `ImageEditor` (Cropper.js), `tus-js-client`, `system-theme-overrides` là chunk lười; ngân sách
  chunk chính của 014 + 20 KB gzip; chunk lười: cropperjs + CSS ≤ 60 KB, tus ≤ 25 KB, dữ liệu theme ≤ 15 KB gzip
  (CHK088); `scripts/check-bundle.mjs`.
- **FR-120**: Chuẩn hóa payload khi so với Directus app như 013/014 (id, thời gian, nonce của `/assets`, thứ tự
  multipart); khác biệt thật ghi R-xx.
- **FR-121**: `graphify update .` sau mỗi lượt code; tài liệu `design-system/docs/`, spec 012/013/014 (D-40, D-48,
  D-57, D-59, D-72 ghi "đã gỡ ở 015" phần tương ứng; D-44 cột "Gỡ ở" ghi "sau 015"; FR-024 của 012 ghi hồ sơ là
  `/users/<id>`, `/users/me` bỏ như Directus) sửa khi 014 mở khóa (CHK051, CHK101).
- **FR-122**: Không sửa file trong `directus/`; không sửa `apps/web`, `apps/web-e2e` trước khi 014 báo đóng (quy tắc
  session 014, 2026-10-15).
- **FR-123**: Chia lượt commit (như Q3 của 014): lượt 1 Files (US1, US2), lượt 2 trình chỉnh ảnh + `file-image` (US5),
  lượt 3 Users + sáu interface (US3, US4, US6 phần user), lượt 4 quyền, payload suite, parity UI,
  benchmark (US6, US7); mỗi lượt commit lên `main` với CI xanh.
- **FR-124**: Thư viện mới: `cropperjs` 1.6.2 (bản catalog Directus 11.17.4, CHK035), `tus-js-client` 4.3.1 (cùng
  phiên bản Directus),
  `p-queue` (đã có ở 009 API; FE thêm cùng phiên bản); phiên bản chốt ở plan; `exifr`/metadata không cần (API đã ghi
  `metadata`).
- **FR-125**: Mọi D-xx mới và R-xx được tech lead duyệt trước khi đóng; Q1, Q2 của Clarifications đã có (owner,
  2026-10-15).

### Key Entities *(include if feature involves data)*

- **File** (`directus_files`): `id`, `storage`, `filename_disk`, `filename_download`, `title`, `type`, `folder`,
  `uploaded_by`, `uploaded_on`, `modified_by`, `modified_on`, `charset`, `filesize`, `width`, `height`, `duration`,
  `embed`, `description`, `location`, `tags`, `metadata` (EXIF `ifd0`, `exif`), `focal_point_x/y`, `tus_id`,
  `tus_data`; bytes ở storage (007); derived assets `<id>__<hash>.<ext>` bị API xóa khi thay nội dung.
- **Folder** (`directus_folders`): `id`, `name`, `parent`; cây theo `parent`; không có quyền riêng ngoài CRUD.
- **User** (`directus_users`): các field của `users.yaml`; `role` (m2o `directus_roles`), `policies` (m2m qua
  `directus_access`), `status`, `provider`, `external_identifier`, `tfa_secret`, `token` (API trả `****`), `theme_*`,
  `language`, `appearance`, `last_page`, `last_access`.
- **Role** (`directus_roles`): `id`, `name`, `icon`, `parent` (cây); chỉ đọc ở 015 (sửa ở 016).
- **Preset** (`directus_presets`) của `directus_files` và `directus_users`: như 014; mặc định `cards` (files) và
  `tabular` (users) theo `systemDefaults` của Directus.
- **Lời mời**: user mới `status: invited` với `email`, `role`; token mời chỉ có trong log API (D-36).
- **Khóa localStorage**: `backoffice-require_tfa_setup` (id user SSO đang chờ thiết lập TFA, 012), trạng thái mở cây
  thư mục và cây role chỉ trong bộ nhớ (như Directus).

## Khác biệt so với Directus *(mandatory)*

Mã tiếp theo sau D-82 (014). D-39, D-41, D-47, D-52, D-66, D-68, D-76, D-82 áp dụng cho mọi màn của 015, không lặp.
Gỡ ở 015: D-40 (phần Files, Users), D-48 (012; D-44 giữ, Q2); D-57 (sáu interface), D-59 (013); D-72 (phần `directus_files`,
`directus_users`, 014).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|------|
| D-83 | Hộp mời user sau khi gửi | Đóng, danh sách nạp lại; email mời do server gửi | Thêm notice tại chỗ "hệ thống không gửi email, liên hệ quản trị viên để nhận link" (`contact_admin_for_link`) | Nguyên tắc X; API ghi log thay vì gửi (D-36 của 010); cùng cách D-42 | khác | — |
| D-85 | Menu "sửa role" trong cây role (admin) | Trang Settings role | Trỏ khung Settings của 012 (D-40) | 016 chưa có (như D-71) | ngoài phạm vi (tạm thời) | 016 |
| ~~D-86~~ | Route `/users/me` | Không có (menu avatar trỏ `/users/<id>`) | Bỏ (owner 2026-10-16): như Directus, không có route riêng; route `redirect` của 012 gỡ | — | — | — |
| D-88 | Interface `system-theme` (chọn theme Directus) | Chọn theme đổi giao diện app ngay; nhãn "Directus Default", "Directus Minimal", "Directus Color Match" | Danh sách và xem trước như Directus (Q1 = C); nhãn qua khóa dịch `theme_directus_*` của file dịch 012 nên hiện "Backoffice Default"...; `id` ghi DB giữ "Directus Default"...; chọn theme không đổi giao diện Backoffice, có dòng ghi chú "áp dụng ở Directus app" | D-43: Backoffice chỉ có theme TailAdmin; owner chọn C 2026-10-15 | khác | — |
| D-89 | Nguồn rule theme cho `system-theme` và `system-theme-overrides` | `@directus/themes` lúc chạy | Rule của mọi theme Directus 11.17.4 là dữ liệu tĩnh chép vào `apps/web` (cùng `id`, khóa `--theme--*`), có test so với gói gốc; overrides: chỉ khóa có ánh xạ (D-43) đổi giao diện Backoffice | `@directus/themes` không phải dependency của `apps/web`; dữ liệu ghi ra giữ nguyên khóa Directus | khác | — |
| D-90 | Danh sách upload TUS dở trong drawer thông báo | Có (`tusResumableUploadsChanged`) | Không có danh sách; việc tiếp tục upload dở khi chọn lại cùng file (`findPreviousUploads`, FR-022) vẫn như Directus, là hai thứ khác nhau (CHK059) | Drawer thông báo thuộc 018 (D-45) | ngoài phạm vi (tạm thời) | 018 |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Khóa localStorage `backoffice-require_tfa_setup` (D-39, 012) dùng chung với `system-mfa-setup`: hai app không chia sẻ
  localStorage nên SSO user bật TFA ở app này chỉ bị ép thiết lập ở app này (Directus cũng theo app, không theo DB).

**Trạng thái khác biệt (T103, lượt 4, 2026-10-16)**:

| Mã | Đã làm trong code | Duyệt |
|----|-------------------|-------|
| D-83 | `modules/users/components/UsersInvite.vue` phát `invited`; `modules/users/routes/UsersCollectionRoute.vue` nạp lại rồi hiện notice `contact_admin_for_link` | Duyệt (owner, 2026-10-16) |
| D-85 | `modules/users/components/UsersNavigation.vue`: menu "sửa role" (chuột phải và nút dòng) tới `/settings/roles/:id` | Duyệt (owner, 2026-10-16) |
| D-86 | Bỏ: `modules/users.ts` không còn route `users-me`; `layout/UserMenu.vue` trỏ thẳng `/users/<id>` | Bỏ (owner, 2026-10-16), như Directus |
| D-88 | `interfaces/_system/system-theme/`: danh sách và xem trước như Directus; nhãn "Backoffice …" qua overlay `lang/overlay/*` trên khóa `theme_directus_*`, `id` ghi DB giữ "Directus …"; dòng `theme_applies_in_directus` nói theme lưu vào hồ sơ và không đổi giao diện Backoffice, không nêu tên app khác (owner 2026-10-16) | Duyệt (owner, 2026-10-16) |
| D-89 | `theme/directus-themes.json` sinh bằng `scripts/sync-directus-themes.mjs` (target `web:sync-themes`), `theme/directus-themes.test.ts` so với nguồn | Chờ tech lead (SC-010) |
| D-90 | Không có danh sách upload dở; `utils/upload-file.ts` vẫn `findPreviousUploads` khi chọn lại cùng file (FR-022) | Duyệt (owner, 2026-10-16) |

Bộ so payload `files` và `users` (T048, T083) khớp Directus app; hai chỗ khác chỉ là thời điểm preset tự lưu (đã có bộ
`presets` của 014) và chuỗi token ngẫu nhiên. Hành vi số đếm sau xóa hàng loạt là R-38 của 014.

| Mã | Rủi ro | Nguồn và bằng chứng | Ảnh hưởng | Duyệt |
|----|--------|---------------------|-----------|-------|
| R-39 | Chuyển thư mục vào con của chính nó tạo vòng: API nhận `PATCH /folders/:a {parent: <con của a>}`, picker chỉ khóa chính thư mục đó | Directus 11.17.4 trả 200 (research CHK077); app mới làm giống (`components/files/FolderPicker.vue`), `nestFolders` bỏ qua thư mục không về gốc | Nhánh thư mục trong vòng biến khỏi cây; vẫn mở được bằng link. Tái tạo | Duyệt (owner, 2026-10-16) |

## Câu hỏi mở về design-system (Nguyên tắc XII)

Như 014: recipe nháp vào `design-system/docs/` trước khi code (sau khi 014 mở khóa tài liệu), design owner duyệt trước
khi đóng 015. Q-2 đến Q-12 của 014 dùng lại (bảng, cards, tìm kiếm và bộ lọc, page header, panel, revisions, comments,
xuất nhập, hàng loạt).

| Mã | Câu hỏi | Trạng thái |
|----|---------|------------|
| Q-13 | Cây thư mục lồng + ba mục đặc biệt trong sub-menu Files (như §9 của Content): thụt cấp, icon gập mở, menu chuột phải (đổi tên, chuyển, tải, xóa) và nút bàn phím tương đương, skeleton | Đóng: design owner duyệt 2026-10-16 |
| Q-14 | Lưới cards của Files: thẻ thư mục (icon, không ảnh; link + ô chọn riêng như thẻ file 014) trước thẻ file, chọn gộp thư mục và file (số đếm ở header), viền thả bốn cạnh (`aria-hidden`) và notice `drop_to_upload`, notice tiến độ tải nhiều file | Đóng: design owner duyệt 2026-10-16, đổi tên ô chọn thẻ thành \"Select <tên thẻ>\" (đã làm) |
| Q-15 | Màn file: khung xem trước lớn với nút "thay file", form bên dưới (`max-w-5xl`), mục "Chi tiết file" dạng `dl` trong panel với nhóm EXIF, nút chép id | Đóng: design owner duyệt 2026-10-16 |
| Q-16 | Trình chỉnh ảnh: drawer toàn màn, vùng ảnh với Cropper, thanh công cụ (ba chế độ, xoay, lật, menu tỉ lệ, đặt lại, dòng kích thước, hủy cắt), nút lưu với menu "lưu thành file mới" | Đóng: design owner duyệt 2026-10-16 |
| Q-17 | Sub-menu Users: bốn mục trạng thái, vạch chia, cây role lồng với icon role, menu "sửa role" (admin) | Đóng: design owner duyệt 2026-10-16 |
| Q-18 | Màn user: hộp user (avatar lớn, tên + chức danh, email, địa điểm, chip role màu theo trạng thái: đề xuất active `success`, invited `warning`, draft `gray`, suspended `error`, archived `gray` nhạt) cùng bề ngang form; mục "Thông tin" trong panel | Đóng: design owner duyệt 2026-10-16 |
| Q-19 | Hộp mời user (textarea email, select role, notice lỗi trùng, dòng D-83); hộp TFA ba bước (mật khẩu, QR + secret + OTP, tắt bằng OTP, admin tắt, hủy thiết lập SSO); ô token (readonly với ba icon, notice đã lưu); chọn theme (radio có ô xem trước SVG theo theme Directus, Q1 = C); cây overrides theme (nhóm gập mở, ô nhập với swatch) | Đóng: design owner duyệt 2026-10-16 |

## Clarifications

### Session 2026-10-15

- Q1: `system-theme` (`theme_light`, `theme_dark`) hiện gì khi Backoffice chỉ có theme TailAdmin (D-43)? Lựa chọn:
  A = danh sách tên theme Directus không xem trước; B = ẩn hai field; C = port `theme-preview.vue` với rule từng theme
  Directus để xem trước đúng màu Directus. → C (owner, 2026-10-15): FR-084, D-88, D-89, Q-19.
- Q2: Trang đăng ký công khai `/register` (D-44 của 012 giao cho 015; mô tả feature không nêu) có thuộc 015 không?
  Lựa chọn: A = thuộc 015 (form, màn "kiểm tra email" cộng dòng liên hệ quản trị viên); B = để sau, giữ trang "chưa có
  sẵn" của 012; C = chỉ khi không cần xác minh email. → B (owner, 2026-10-15): không làm trang đăng ký ở 015; FR-090,
  D-44 giữ với "Gỡ ở: sau 015".
- Q3: Cây thư mục (Files) và cây role (Users) đặt ở đâu trong khung TailAdmin? → A: Cây lồng trong sub-menu của sidebar
  như Content (owner chọn 2026-10-15, cùng ngoại lệ 014 Q2); ghi ngoại lệ vào `layout-patterns.md` §7 (FR-003,
  FR-052, FR-110, Q-13, Q-17).
- Q: Khung cắt và điểm focal của trình chỉnh ảnh có đường bàn phím (ô nhập số) không? → A: Không; chỉ chuột như
  Directus, ghi ngoại lệ a11y (FR-046, FR-111, SC-008); đề xuất D-87 bỏ.
- Q: Tải lên chia khối (TUS) có thuộc 015 không? → A: Có, như Directus: TUS khi `info.uploads.tus` bật, multipart khi
  tắt (FR-022, FR-124 thêm `tus-js-client`); không D-xx mới.
- Q: Nhãn theme trong `system-theme` (file dịch 012 đổi "Directus" thành "Backoffice") hiện thế nào? → A: Nhãn theo
  file dịch ("Backoffice Default"...), `id` lưu DB giữ "Directus Default"... (owner, 2026-10-15; FR-084, D-88);
  `src/theme/directus-themes.json` là ngoại lệ của `check-brand` (dữ liệu sinh).
- Q: So kết quả chỉnh ảnh với Directus app bằng gì? → A: `width`, `height`, `focal_point_x/y` và điểm ảnh sau giải
  mã bằng nhau; không so bytes (SC-006, US5 Independent Test).
- Q: Sau khi mời user mà không có email (D-36), Backoffice làm gì để user được mời vào app? → A: Chỉ notice
  `contact_admin_for_link` (D-83); link chấp nhận lời mời lấy từ log API là việc vận hành; không thêm đường riêng,
  không E2E cho bước vào app của user được mời (FR-063).

## Assumptions

- `cropperjs` cùng major với Directus 11.17.4 để bytes ảnh sau cắt giống nhau ở cùng trình duyệt; `tus-js-client` cùng
  phiên bản; phiên bản chốt ở plan. API mới (007) hỗ trợ `/files/tus`, `POST /assets/files`, `POST /assets/folder/:id`
  (đã thấy ở `assets.controller.ts`); `/server/info` trả `uploads` như Directus (plan kiểm).
- Email mời chỉ ghi log ở API mới (`users.service.ts`, D-36); trang đăng ký không thuộc 015 (Q2).
- Rule theme của `@directus/themes` 11.17.4 (mọi theme sáng và tối) chép thành dữ liệu tĩnh trong `apps/web` bằng
  script có test so với gói gốc (như script sinh chuỗi dịch của 012); `rulesToCssVars` port lại (hàm nhỏ).
- `BoUpload` của 013 nhận thêm `fileId` và chuyển sang `uploadFile` dùng chung; danh sách ghi FR-054 của 013 mở rộng
  tương ứng (ghi "đã mở rộng ở 015").
- `use-tfa-setup` của 012 mở rộng, không viết lại; `useTFASetup` nhận `initialEnabled` như Directus.
- Store `presets` của 014 đã có preset mặc định của `directus_files`, `directus_users` (port `stores/presets.ts`); thiếu
  thì bổ sung đúng giá trị Directus.
- Layout cards: thêm lại `extraSelection`, `prepend`, `hasPrependContent`, `selectAll` đúng như code Directus (ghi chú
  đầu file `Cards.vue`, `CardsHeader.vue` của 014 sửa theo).
- Thư mục nạp cả danh sách (`limit -1` qua `fetchAll`) như Directus; thư viện 10.000 thư mục không trong tiêu chí.
- Hiệu năng: ngưỡng tuyệt đối trong SC đặt cho máy tham chiếu (Mac Apple M-series của developer) theo quyết định owner
  ngày 2026-10-15 (014 research R14, `contracts/tests.md`): test perf trong trình duyệt nhân ngân sách với
  `machineFactor()` của `apps/web/src/test-utils/perf.ts` (khối lượng DOM + JS cố định, trung vị 5 lần, chia cho
  `REFERENCE_MS`, không nhỏ hơn 1); bước CI `PERF=1` vẫn gate, chạy Vue ở chế độ production và mount bằng `createApp`
  như 014.
- Thông báo (tiến độ tải, kéo thả, lời mời, chép id) là notice tại chỗ (D-66).
- E2E ở `proxy-api` seed lại `bo_files`, `bo_users` giữa hai lượt so payload; storage `local` dùng chung volume
  `uploads` (007) để file tải ở app này mở được ở app kia.
- Chuỗi của `delete_folder_dialog.*`, `interfaces.system-token.*`, `sso_tfa_setup_notice`, `cancel_tfa_setup*` có trong
  `en-US.yaml` của Directus 11.17.4 (file sinh của 012 lấy toàn bộ).
- Tài liệu ngoài `specs/015-*` (design-system, spec 012/013/014, `CLAUDE.md`, `SPECKIT-GUIDE.md`) chỉ sửa sau khi 014
  mở khóa working tree.

- Env parity bật `TUS_ENABLED=true` cho API mới và Directus ở profile `app` để E2E `files-upload` ở `proxy-api` đi
  nhánh TUS; chưa bật thì thêm ở compose (kiểm T002, CHK090).
- Test `BoUpload` của 013 cập nhật allowlist thêm `PATCH /files/:id`; spec 013 FR-051, FR-054 ghi "mở rộng ở 015" (FR-121,
  CHK091).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% kịch bản E2E của US1 đến US7 đạt ở ba cấu hình API (Directus thật, API mới cùng origin, API mới khác
  origin) trên chromium 768 và 1280; cùng origin thêm firefox-1280 và webkit-1280 cho ba spec lõi (`files-library`,
  `files-item`, `users-item`); cors chỉ chromium-1280; spec điều khiển Directus app (payload, parity-ui) chỉ
  chromium-1280 (`DIRECTUS_APP_SPECS`, giới hạn 100 phút của job, như 014); "các luồng chính của hai module chạy giống Directus" = SC-001 và
  SC-004.
- **SC-002**: Với bộ mẫu, so với Directus app trên cùng DB cho ba user (`admin`, `bo-editor`, `bo-viewer`) bằng E2E
  song song, 0 lệch ngoài D-xx ở năm thuộc tính: (a) nhãn và thứ tự mục sub-menu (thư mục, mục đặc biệt, trạng thái,
  role), (b) tiêu đề và breadcrumb, (c) chuỗi dòng số đếm và số lượng chọn, (d) `disabled`/ẩn của nút tạo, mời, xóa,
  sửa hàng loạt, chuyển thư mục, tải về, tải thư mục, chỉnh ảnh, thay file, tạo thư mục, đổi tên thư mục, lưu, archive
  (13 nút; "ẩn" = không có trong DOM), (e) mục panel hiện; thu bằng `innerText` và `aria-disabled` (CHK060).
- **SC-003**: 0 file trong `directus/` bị sửa; trong E2E, 0 request tới route ngoài FR-115 và 0 request ra ngoài.
- **SC-004**: 100% body ghi (`/files` tạo, sửa, thay, bản sao, xóa, hàng loạt; `/files/import`; `/folders`; `/users`
  tạo, sửa, xóa, hàng loạt; `/users/invite`; `/users/*/tfa/*`; `/utils/random/string` + `PATCH`
  token; `/presets`; `/utils/import`, `/utils/export`) của kịch bản E2E bằng body Directus app gửi cho cùng kịch bản
  sau chuẩn hóa (FR-120; multipart so tên field theo thứ tự, tên file, `type`, kích thước blob, không so bytes; nonce
  `/assets/:id?x` bỏ, CHK061).
- **SC-005**: Sáu interface `_system`: với bộ mẫu, giá trị ghi ra (`language`, `tfa_secret` qua API, `token`,
  `theme_light`, `theme_dark`, `theme_light_overrides`, `theme_dark_overrides`) bằng Directus app cho 10 thao tác mẫu:
  ngôn ngữ null → vi-VN, chọn mỗi theme (3 sáng, 1 tối), overrides thêm một khóa, overrides xóa khóa (gỡ nhóm rỗng),
  token tạo, token xóa, TFA bật, TFA tắt (CHK062); test component với mock API, request đúng allowlist.
- **SC-006**: Trình chỉnh ảnh: cắt 200×100 tại (10, 20) (đặt qua `setData` của Cropper bằng `page.evaluate` ở cả hai
  app) và xoay -90° ảnh mẫu `bo-edit.png` 400×300 của bộ mẫu cho `width`, `height`, `focal_point_x/y` trong
  `directus_files` bằng Directus app và điểm ảnh sau khi giải mã bằng nhau (canvas `drawImage` → `getImageData`, so RGBA
  từng byte, dung sai 0, trên cùng chromium); không so bytes hay hash của file (Clarifications 2026-10-15, CHK036,
  CHK063).
- **SC-007**: Hiệu năng (ngân sách cho máy tham chiếu, nhân `machineFactor()` trên CI như 014 R14; trung vị 3 lần,
  chromium, bước `PERF=1`, mount bằng `createApp`): cây 500 thư mục ba cấp mở hết vẽ dưới 500 ms; lưới cards 100 thẻ
  (ảnh là data-URL PNG 1×1, không tải mạng) + 20 thẻ thư mục vẽ dưới 1 giây; thả 20 file 1 MB với `maxConcurrency` 5
  không quá 5 request đồng thời và danh sách nạp lại đúng 1 lần sau khi xong (đếm `GET /files`); mở trình chỉnh ảnh
  4000×3000 dưới 2 giây từ sự kiện `load` của `img` tới `ready` của Cropper; số request mỗi thao tác: mở thư mục = 1
  danh sách + 1 đếm (+ 0 folders), tải xong = 1 danh sách + 0 đếm (đếm qua `fetchAggregate` có `useMemoize` như
  `use-items` của Directus, R-38 của 014; sửa 2026-10-16 theo T097), đổi trang = 1 danh sách, mở màn user = 1 item +
  2 `/access` (trang policies và đếm của `list-m2m`) + 2 `/files/<avatar>` (interface `file` và DrawerItem chưa mở, như
  `overlay-item.vue`) + 1 `/roles/<role>` (`select-dropdown-m2o`), không có `GET /roles` danh sách (đo ở T097, giống
  Directus); folders và roles nạp một
  lần mỗi phiên app, đổi qua lại Files ↔ Users không nạp lại (CHK044, CHK045, CHK046, CHK064, CHK089).
- **SC-008**: Recipe Q-13 đến Q-19 được design owner duyệt, `qa/handoff-checklist.md` đạt trước khi đóng 015; axe 0 vi
  phạm serious/critical trên thư viện (hai layout cards và tabular), màn file, drawer chỉnh ảnh, danh bạ, màn user với
  ba hộp TFA, hộp mời, hộp xóa thư mục ở trạng thái mở, ở sáng và tối (danh sách màn khớp FR-111; axe không kiểm
  kéo thả nên ngoại lệ khung cắt chỉ chuột của FR-111 không làm SC này đỏ; ghi ở `qa/handoff-checklist.md`).
- **SC-009**: Coverage `apps/web` ≥ 60%; lint, typecheck, unit, E2E ba cấu hình, build image xanh; chunk chính ≤ ngân
  sách 014 + 20 KB gzip; 0 màu thô ngoài danh sách miễn.
- **SC-010**: D-83 đến D-90 (D-86, D-87 đã bỏ, không cần duyệt) và R-xx (nếu có) được tech lead duyệt (CHK066); D-40 (Files, Users), D-48, D-57 (sáu interface), D-59,
  D-72 (phần 015) ghi "đã gỡ ở 015" và D-44 ghi "sau 015" ở spec gốc.
