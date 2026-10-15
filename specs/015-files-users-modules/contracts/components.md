# Contract: component và composable mới của 015

Mọi component `<script setup lang="ts">`, Reka UI, `modelValue`/`update:modelValue`, theo `component-specs.md`; file
chép có header `// Ported from directus/app/src/...` và manifest `tools/port-manifest/015-T*.json`.

## 1. Files

| Component / composable | Nguồn Directus | Props / API | Emit | Ghi chú |
|------------------------|----------------|-------------|------|---------|
| `modules/files.ts` | `modules/files/index.ts` | route data-model §1 | | `preRegisterCheck` 012 |
| `modules/files/routes/FilesCollectionRoute.vue` | `routes/collection.vue` | `folder?`, `special?: 'all'\|'mine'\|'recent'` | | layout wrapper 014, `RouterView name="addNew"` |
| `modules/files/routes/AddNewFile.vue` | `routes/add-new.vue` | `folder?` | `upload` | `BoDialog` + `BoUpload` |
| `modules/files/routes/FileItemRoute.vue` | `routes/item.vue` | `primaryKey` | | |
| `modules/content/routes/ContentNotFound.vue` (mở rộng) | `routes/not-found.vue` (files) | + `module?` (mặc định `content`) | | dùng cho Files và Users, không có `FilesNotFound.vue` |
| `modules/files/components/AddFolder.vue` | `components/add-folder.vue` | `parent?`, `disabled?` | | |
| `modules/files/components/DeleteFolderDialog.vue` | `components/delete-folder-dialog.vue` | `modelValue`, `folders`, `allFolders` | `done` | radio `BoRadio` |
| `modules/files/components/FolderSection.vue` | `components/folder-section.vue` | `subfolders`, `anySelection?`, v-model `selection` | | `Card` của 014 |
| `modules/files/components/FileInfoSidebarDetail.vue` | `components/file-info-sidebar-detail.vue` | `file`, `isNew` | | `SidebarDetail` 014 |
| `components/files/FilesNavigation.vue` | `views/private/components/files-navigation.vue` | `rootFolder?`, `currentFolder?`, `currentSpecial?`, `customTargetHandler?`, `localOpenFolders?`, `actionsDisabled?` | | slot `navigation`; cũng dùng trong `DrawerFiles` 013 nếu drawer chưa có cây (T002, CHK075) |
| `components/files/FilesNavigationFolder.vue` | `files-navigation-folder.vue` | `folder`, `currentFolder?`, `actionsDisabled?`, `clickHandler?` | | menu đổi tên/chuyển/tải/xóa |
| `components/files/FolderPicker.vue`, `FolderPickerListItem.vue` | `folder-picker.vue`, `FolderPickerListItem.vue` | `modelValue: string\|null`, `disabledFolders?` | `update:modelValue` | |
| `components/files/FilePreviewReplace.vue` | `file-preview-replace.vue` | props của `FilePreview` + `disabled?` | `click`, `replace` | |
| `components/files/ImageEditor.vue` | `image-editor.vue` | `id`, `modelValue?`, `createAllowed?` | `update:modelValue`, `refresh`, `new-file` | `BoDrawer`, cropperjs lười |
| `components/files/BoUpload.vue` (mở rộng) | `v-upload.vue` | + `fileId?` | | dùng `uploadFiles` |
| `composables/use-folders.ts` | `composables/use-folders.ts` | `useFolders(rootFolder?, local?)`, `nestFolders` | | |
| `composables/use-dialog-route.ts` | `composables/use-dialog-route.ts` | `useDialogRoute()` | | |
| `utils/get-folder-filter.ts`, `utils/delete-folder.ts`, `utils/collect-folder-ids.ts`, `utils/upload-file.ts`, `utils/upload-files.ts`, `utils/fetch-all.ts` (nếu chưa có) | cùng tên | | | |
| `stores/files.ts` | `stores/files.ts` | `upload()` → `{start, finish, progress, done, uploading}`, `isAnyUploadActive` | | |
| `layouts/cards` (mở rộng) | `layouts/cards/cards.vue`, `components/header.vue` | + `extraSelection`, `hasPrependContent`, slot `prepend`, emit `select-all`, `update:extraSelection` | | |
| `stores/presets.ts` (mở rộng) | `stores/presets.ts` | `defaultPresets` cho `directus_files`, `directus_users` | | |
| `stores/server.ts` (mở rộng) | `stores/server.ts` | `info.uploads`, `info.project.default_theme_light\|dark` | | |

## 2. Users

| Component / composable | Nguồn Directus | Props / API | Emit | Ghi chú |
|------------------------|----------------|-------------|------|---------|
| `modules/users.ts` | `modules/users/index.ts` | route data-model §1 | | `/users/me` redirect (D-86) |
| `modules/users/routes/UsersCollectionRoute.vue` | `routes/collection.vue` | `role?`, `status?` | | |
| `modules/users/routes/UserItemRoute.vue` | `routes/item.vue` | `primaryKey`, `role?` | | `provide('discardAllChanges' \| 'refresh')` |
| `modules/users/components/UsersNavigation.vue`, `NavigationRole.vue` | `components/navigation.vue`, `NavigationRole.vue` | `currentRole?`; `role`, `currentRole?` | `click({role})` | menu "sửa role" (admin) |
| `modules/users/components/UserInfoSidebarDetail.vue` | `components/user-info-sidebar-detail.vue` | `user`, `isNew?` | | |
| `modules/users/components/UsersInvite.vue` | `views/private/components/users-invite.vue` | `modelValue`, `role?` | `update:modelValue` | dòng D-83 |
| `modules/users/composables/use-navigation.ts` | `composables/use-navigation.ts` | `useNavigation(initialRole)` → `{roles, roleTree, openRoles, loading}` | | |
| `layout/UserMenu.vue` (sửa) | `module-bar-avatar.vue` | link `/users/<id>` | | `ProfileRoute.vue` xóa |
| `composables/use-tfa-setup.ts` (mở rộng) | `composables/use-tfa-setup.ts` | + `disableTFA`, `adminDisableTFA(pk)`, `requestTFASetup`, `cancelTFASetup` | | |

## 3. Interface `_system` (`interfaces/_system/<id>/{index.ts, <Name>.vue}`)

| Id | Component | Nguồn | Phụ thuộc |
|----|-----------|-------|-----------|
| `system-language` | `SystemLanguage.vue` | `system-language/system-language.vue` | `BoSelect`, `lang/available-languages.json` |
| `system-input-password` | `SystemInputPassword.vue` | `system-input-password/input-password.vue` | `BoInput` |
| `system-mfa-setup` | `SystemMfaSetup.vue` | `system-mfa-setup/system-mfa-setup.vue` | `use-tfa-setup`, `BoCheckbox`, `BoDialog`, `qrcode` |
| `system-token` | `SystemToken.vue` | `system-token/system-token.vue` | `BoInput`, `BoDialog`, `useClipboard` |
| `system-theme` | `SystemTheme.vue`, `ThemePreview.vue` | `system-theme/*.vue` | `theme/directus-themes.json`, `theme/rules-to-css-vars.ts` |
| `system-theme-overrides` | `SystemThemeOverrides.vue`, `SystemThemeOverridesGroup.vue`, `SystemThemeOverridesRule.vue`, `types.ts` | `system-theme-overrides/*` | `directus-themes.json`, `color`, `BoAccordion`? (nhóm gập là `<button aria-expanded>` như Directus) |

Registry 013 (`interfaces/index.ts`) thêm sáu id; `registry.test.ts` cập nhật số lượng; option `appearance` của field
`theme_*` trong `users.yaml` truyền vào prop `appearance`.

## 4. Theme data (`apps/web/src/theme/`)

| File | Nội dung |
|------|----------|
| `directus-themes.json` | `{light: Theme[], dark: Theme[]}` sinh bởi `scripts/sync-directus-themes.mjs` từ `directus/packages/themes/src/themes/**` (header ghi nguồn + ngày) |
| `rules-to-css-vars.ts` | `rulesToCssVars(rules): Record<string, string\|number>` (làm phẳng `--`, kebab-case) |
| `directus-themes.test.ts` | file sinh khớp nguồn (chạy lại script trong test, so JSON); ba theme sáng, một tối; `rulesToCssVars` cho 3 mẫu bằng kết quả Directus (chép từ `@directus/themes` test nếu có) |

## 5. E2E helpers (`apps/web-e2e/src/helpers/`)

`files.ts`: `openFolder(page, name)`, `uploadViaDialog(page, paths[])`, `dropFiles(page, paths[])` (DataTransfer qua
`page.evaluate`), `selectCard(page, title)`, `openImageEditor(page)`; `users.ts`: `openUser(page, email)`,
`inviteUsers(page, emails, role)`, `toggleTfa(page, ...)`; `allowed-paths.ts` thêm #97–#134; `directus-app.ts` thêm
helper cho Directus app (thư mục, mời, token) cho bộ so payload.
