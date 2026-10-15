# Data model: Module Files và Users (015)

Kiểu lấy từ `@directus/types` 15.0.3 (`File`, `User`, `Role`, `Preset`, `Theme`, `Filter`) hoặc chép từ
`directus/app/src/types` (`folders.ts`: `FolderTarget`, `SpecialFolder`). Không có DB mới; mọi thứ là trạng thái trình
duyệt dựng từ API.

## 1. Route (FR-001, FR-050)

| Module | Tên | Path (dưới `/admin`) | Component | Props | Ghi chú |
|--------|-----|----------------------|-----------|-------|---------|
| files | `files-collection` | `/files` | `FilesCollectionRoute` | — | con `+` = `add-file` (`isFloatingView`, hộp `AddNewFile`) |
| files | `files-item` | `/files/:primaryKey` | `FileItemRoute` | `primaryKey` | |
| files | — | `/files/folders` | redirect `/files` | | |
| files | `folders-collection` | `/files/folders/:folder` | `FilesCollectionRoute` | `folder` | con `+` = `add-file-folder` |
| files | — | `/files/all\|mine\|recent` | `FilesCollectionRoute` | `special` | |
| files | `files-not-found` | `/files/:_(.+)+` | `FilesNotFound` | | |
| users | `users-active` | `/users` | `UsersCollectionRoute` | `status: 'active'` | |
| users | `users-suspended\|invited\|all` | `/users/suspended\|invited\|all` | `UsersCollectionRoute` | `status` (all: không) | |
| users | `users-me` | `/users/me` | guard → `/users/<currentUser.id>` | | D-86 |
| users | `users-item` | `/users/:primaryKey` | `UserItemRoute` | `primaryKey` | |
| users | — | `/users/roles` | redirect `/users` | | |
| users | `roles-collection` | `/users/roles/:role` | `UsersCollectionRoute` | `role` | |
| users | `roles-item-add` | `/users/roles/:role/+` | `UserItemRoute` | `primaryKey: '+'`, `role` | |
| users | `users-not-found` | `/users/:_(.+)+` | `UsersNotFound` | | |

Thứ tự khai báo như Directus để `/users/me`, `/users/roles/...`, `/users/suspended` khớp trước `:primaryKey`
(`users-me` đặt trước `users-item`).

## 2. Thư mục (`useFolders`, FR-005, FR-006)

| Trường | Kiểu | Nguồn |
|--------|------|-------|
| `folders` | `Folder[] \| null` (`{id, name, parent, children?}`) | `GET /folders` `sort=name` qua `fetchAll` |
| `nestedFolders` | `Folder[] \| null` | `nestFolders(folders)` (theo `parent`), cắt từ `rootFolder` nếu có |
| `openFolders` | `string[]` | module-level `['root']`; cục bộ khi `rootFolder` hoặc `local` |
| `loading` | boolean | |

Bộ lọc hệ thống `getFolderFilter(folder?, special?, currentUserId?)` → `{_and: [{type: {_nnull: true}}, ...]}` với
`folder._eq`/`folder._null`, `uploaded_by._eq` (mine), `uploaded_on._gt` (recent, `subDays(now, 5)` ISO).

`FolderPicker`: `modelValue: string | null`, `disabledFolders?: string[]`; cây riêng từ `GET /folders` `limit=-1`
`sort=name` (nạp một lần mỗi instance).

## 3. Màn thư viện (`FilesCollectionRoute`, FR-010 đến FR-018)

| Trạng thái | Kiểu | Ghi chú |
|------------|------|---------|
| preset | `use-preset('directus_files')` 014 | mặc định hệ thống `cards` (store `presets.defaultPresets`) |
| `selection` | `string[]` | id file |
| `folderSelection` | `string[]` | id thư mục con (→ `extraSelection` của cards) |
| `subfolders` | `Folder[]` | `folders.filter(parent === folder ?? null)`; rỗng khi `special` |
| `isTransitioning` | boolean | true khi đổi `folder`/`special` tới khi layout có items |
| `confirmDelete`, `batchEditActive`, `moveToDialogActive`, `moving`, `selectedFolder` | | |
| `showDropEffect`, `dragCounter`, `dragging` | | viền thả và class `dragging` |
| upload đang chạy | store `files.activeUploads` (`Map<id, {numberOfFiles, progress, done}>`), `isAnyUploadActive` | nạp lại khi về false |

Layout `cards` mở rộng: props `extraSelection: (string\|number)[]` (v-model), `hasPrependContent: boolean`, slot
`prepend`, emit `select-all`; `CardsHeader` đếm `selection.length + extraSelection.length`, bỏ chọn xóa cả hai.

## 4. Tải lên (`uploadFile`, FR-022 đến FR-024)

```ts
uploadFile(file, { onProgressChange?, onChunkedUpload?, notifications?, preset?: Partial<File>, fileId?, requirePreviousUpload? })
uploadFiles(files, { onProgressChange?(percentages[]), onChunkedUpload?, notifications?, preset?, folder?, maxConcurrency? })
```

Nhánh TUS khi `serverStore.info.uploads?.tus === true`: `Upload(file, { endpoint: <PUBLIC_URL>/files/tus, chunkSize:
uploads.chunkSize ?? DEFAULT_CHUNK_SIZE (@directus/constants [Unverified: gói có trong catalog? nếu không, hằng 8 MiB
chép], metadata: {...preset, id?, filename_download, type}, removeFingerprintOnSuccess: true, onBeforeRequest:
withCredentials, onShouldRetry: false, onAfterResponse: id ??= 'Directus-File-Id' })`; `findPreviousUploads` → resume;
thành công `GET /files/:id`. Nhánh multipart: FormData (preset rồi `file`) → `POST /files` hoặc `PATCH /files/:fileId`
với tiến độ XHR (`upload-with-progress` 013). Store server thêm `info.uploads?: {chunkSize, maxConcurrency, tus}`.

## 5. Màn file (`FileItemRoute`, FR-030 đến FR-039)

`use-item<File>('directus_files', primaryKey)` 014; `fieldsDenyList` 13 field (spec FR-030); `to` = thư mục của item;
hộp `moveToDialogActive` với `selectedFolder` đặt lại theo `item.folder`; `editActive` (trình chỉnh ảnh). Chi tiết file
(`FileInfoSidebarDetail`): `size` (`formatFilesize`), `fileLink` (`getAssetUrl(id)`), ba mốc ngày `{short, long}`,
`userCreated`/`userModified` (`GET /users/:id` `fields=id,email,first_name,last_name,role` → `{id, name, link}`),
`folder` (`GET /folders/:id` `fields=id,name`), `imageMetadata` (`metadata.ifd0.Make/Model`, `exif.FNumber/
ExposureTime/FocalLength/ISO|ISOSpeedRatings`).

## 6. Trình chỉnh ảnh (`ImageEditor`, FR-040 đến FR-046)

| Trạng thái | Kiểu | Ghi chú |
|------------|------|---------|
| `imageData` | `Pick<File, 'type'\|'filesize'\|'filename_download'\|'folder'\|'width'\|'height'\|'focal_point_x'\|'focal_point_y'>` | `GET /files/:id` |
| `imageURL` | `/assets/:id?<nanoid>` | nonce mới sau lưu |
| `cropperInstance` | `Cropper \| null` | option như R5 |
| `localDragMode` | `'move' \| 'crop' \| 'focal_point'` | |
| `aspectRatio` | number (`NaN` = tự do) | menu: custom (settings), 16/9, 3/2, 5/4, 7/5, 1, NaN, gốc |
| `newDimensions` | `{width, height}` | từ event `crop` (throttle 50 ms), hoán đổi khi xoay ±90 |
| `cropping` | boolean | hủy → `clear()` |
| `hasEdits` | boolean | `getData()` khác `{0,0,0,0,rotate 0, scale 1,1}` hoặc `cropping` |
| `saving`, `loading`, `error` | | |

Ghi: `PATCH /files/:id` FormData (`focal_point_x`, `focal_point_y` nếu có; `file` blob tên `filename_download`,
`type` gốc) hoặc JSON `{focal_point_x, focal_point_y}`; `POST /files` FormData (`folder`, `file`) khi lưu mới.
Emit: `update:modelValue`, `refresh`, `new-file(id)`.

## 7. Danh bạ user (`UsersCollectionRoute`, FR-060 đến FR-066)

Preset `use-preset('directus_users')` (mặc định `cards`); bộ lọc hệ thống `mergeFilters(roleFilter, statusFilter)`;
`canInviteUsers = !auth.disableDefault && createAllowed && rolesReadAllowed`; `UsersInvite`: `emails: string`
(tách `/,|\n/`, trim, bỏ rỗng), `roles: {text, value}[]` (`GET /roles` khi mở), `roleSelected` (prop `role` hoặc phần
tử đầu), `uniqueValidationErrors: APIError[]` (`extensions.code === 'RECORD_NOT_UNIQUE'`, `extensions.invalid` = email).

`useNavigation(initialRole)`: `roles: BasicRole[]` (`{id, name, icon, parent, children?}`) module-level từ `GET /roles`
`fields=id,name,icon,parent` `sort=name`; `roleTree` (`groupBy parent`); `openRoles: string[]` dùng chung, tự thêm role
đang xem và các cha.

## 8. Màn user (`UserItemRoute`, FR-070 đến FR-079)

`use-item<User>('directus_users', primaryKey, null, { fields: ['*', 'role.*', 'avatar.id', 'avatar.modified_on'] })`;
`user = {...item, role: item.role?.id}` làm giá trị ban đầu; `edits.role = props.role` khi có; `fieldsDenyList` 7 field;
`fieldsFiltered` đặt `meta.readonly = true` cho `provider`, `external_identifier` khi không mới và không admin;
`avatarSrc = getAssetUrl(avatar.id, { imageKey: 'system-medium-cover', cacheBuster: avatar.modified_on })`;
`title = userName(item) | adding_user | loading`; `isArchived`, `archiveAllowed` từ `use-item` (`archive_field` của
`directus_users` = `status`, `archive_value` `archived`, `unarchive_value` `draft`). `provide('discardAllChanges')`,
`provide('refresh')`.

Chuyển trạng thái `status` (dữ liệu, như Directus): `draft` ↔ `active` ↔ `suspended`; `invited` (do mời) → `active`
(chấp nhận lời mời, ngoài 015) ; `archived` qua nút archive; `unverified` (đăng ký, ngoài 015). App không kiểm chuyển
trạng thái, chỉ dropdown.

## 9. Sáu interface `_system` (FR-080 đến FR-086)

| Id | types | Props vào (ngoài chuẩn 013 `value`, `disabled`, emit `input`) | Request | Giá trị ghi |
|----|-------|---------------------------------------------------------------|---------|-------------|
| `system-language` | string | `includeProjectDefault` | — | mã ngôn ngữ hoặc null |
| `system-input-password` | string, text | `placeholder`, `autofocus`, `autocomplete` | — | chuỗi |
| `system-mfa-setup` | text | `primaryKey` | `/users/me/tfa/generate\|enable\|disable`, `/users/:pk/tfa/disable` | không qua form (API ghi `tfa_secret`) |
| `system-token` | hash | `primaryKey`, `collection` | `GET /utils/random/string`, `PATCH <endpoint>/<pk> {token}` | không qua form |
| `system-theme` | string | `appearance`, `includeNull` | — | `id` theme (`Directus Default`, `Directus Minimal`, `Directus Color Match`) hoặc null |
| `system-theme-overrides` | json | `appearance` | — | `DeepPartial<Theme['rules']>` (`setWith`/`unset`, gỡ nhóm rỗng) |

Dữ liệu theme `theme/directus-themes.json`: `{ light: Theme[], dark: Theme[] }`, `Theme = {id, name, appearance,
rules}`; `rulesToCssVars(rules)` → `Record<'--theme--<kebab--path>', string|number>`.

## 10. localStorage và store

| Khóa / store | Dùng | Ghi chú |
|--------------|------|---------|
| `backoffice-require_tfa_setup` | id user SSO đang chờ thiết lập TFA | 012, dùng lại |
| store `presets.defaultPresets` | preset hệ thống `directus_files`, `directus_users` | mới |
| store `server.info.uploads` | TUS, chunk, concurrency | mới |
| store `files` | upload đang chạy | mới (chép) |
| `useFolders` state | thư mục, trạng thái mở | module-level, trong bộ nhớ |
| `useNavigation` (users) state | role, trạng thái mở | module-level |

## 11. Bộ mẫu (FR-116)

| Tập | Nội dung | Tạo qua |
|-----|----------|---------|
| `bo_files` | thư mục `bo-fixtures` (013) + `bo-fixtures/sub` + `bo-fixtures/sub/deep`; 30 file: PNG (có ảnh 400×300 cho SC-006), JPEG có EXIF, PDF, MP4 ngắn, TXT; 1 file do `bo-editor` tải; 1 file `uploaded_on` 10 ngày trước (sửa qua `PATCH /files/:id` với `uploaded_on`? [Unverified: API cho ghi `uploaded_on`; nếu không, `recent` kiểm bằng file mới tải]) | `POST /folders`, `POST /files` multipart (seed.mjs) |
| `bo_users` | role `bo-editor`, `bo-viewer` (013) + `bo-sub` (parent `bo-editor`); user mỗi `status` (`bo-active`, `bo-suspended`, `bo-invited` qua `POST /users/invite`, `bo-draft`, `bo-archived`); user có `token`; user `provider` ≠ default cho luồng SSO | `POST /roles`, `POST /users`, `POST /users/invite` |

Snapshot export thêm `folders.json`, `files.json` (bỏ `tus_*`, chuẩn hóa ngày), `users.json` (bỏ `token`, `tfa_secret`,
`password`), `roles.json`.
