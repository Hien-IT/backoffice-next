# Contract: Web (Settings > Extensions)

Theo `design-system/docs/component-specs.md` (Button, Modal, Chip, Notice, Upload drop zone) và recipe Q-41 (hàng
extension). Không component mới ngoài `ExtensionUploadDialog.vue`; không route mới.

## Nút Upload

- Ở slot `actions` của `PrivateView` trên `/settings/extensions`: `BoButton` variant primary, icon `upload`, text
  `$t('upload_extension')`; `v-if="available"` từ `useExtensionUpload()` (GET `/backoffice/extensions/upload` 200;
  404 ở Directus → ẩn, FR-019).
- Bàn phím: nút trong thứ tự tab của header; mở dialog bằng Enter/Space.

## Dialog `ExtensionUploadDialog.vue`

| Phần | Hành vi |
|------|---------|
| Tiêu đề | `$t('upload_extension')`; mô tả `$t('upload_extension_copy')` (chỉ gói `.tgz` của `npm pack`; chạy trong máy chủ) |
| Chọn file | vùng kéo thả + `<input type="file" accept=".tgz,.tar.gz,application/gzip,application/x-gzip">` gắn `<label>`; một file; tên và kích thước file đã chọn hiện dưới vùng; nút "Browse" |
| Kiểm trước khi gửi | `file.size === 0` → `$t('files_are_empty')`; `maxUploadSize` và `file.size > maxUploadSize` → `$t('upload_extension_too_large', { max })`; phần mở rộng không phải `.tgz`/`.tar.gz` → `$t('upload_extension_wrong_type')` |
| Gửi | `BoButton` "Upload" disabled khi chưa chọn hoặc đang gửi; `aria-busy` + `BoProgressCircular` khi đang gửi; Escape/đóng bị chặn khi đang gửi |
| Lỗi API | `BoNotice` type error trong dialog với `translateAPIError(error)` (reason của 400/413/403/503); file vẫn chọn, gửi lại được |
| Thành công | `extensionsStore.refresh()`, `notify({ title: $t('upload_extension_success', { name }) })`, đóng dialog, focus về nút Upload |
| a11y | `role="dialog"` của BoDialog, `aria-describedby` mô tả, lỗi `role="alert"`, input có label, không vi phạm axe serious |
| Chuỗi từ gói | `name`, `version`, reason lỗi hiện bằng text binding (`{{ }}`/`:text`), không `v-html` (checklist 2026-11-04) |

## Hàng extension

- `ExtensionItem.vue`: `BoChip` `$t('extension_source_upload')` ("Uploaded" / "Đã tải lên") size sm sau chip version khi
  `meta.source === 'upload'`; tên là `schema.name` (từ `package.json`), không phải tên file; không link Marketplace.
- `ExtensionItemOptions.vue`: Uninstall mở cho `upload` (`uninstallLocked = !['registry','upload'].includes(source)`);
  không Reinstall; Missing: Remove (có sẵn). Gỡ không có hộp thoại xác nhận, như gỡ gói registry ở Directus app và ở
  020 (implement 2026-11-04: không có dialog xác nhận nào có sẵn).

## Chuỗi overlay (khối "Spec 031" en-US / vi-VN)

| Key | en-US | vi-VN |
|-----|-------|-------|
| `upload_extension` | Upload extension | Tải extension lên |
| `upload_extension_copy` | Upload a package built with `npm pack` (.tgz). The extension runs on the server with the rights of the API process; only upload packages you trust. | Tải lên gói đóng bằng `npm pack` (.tgz). Extension chạy trên máy chủ với quyền của tiến trình API; chỉ tải gói bạn tin cậy. |
| `upload_extension_browse` | Choose a .tgz file | Chọn file .tgz |
| `upload_extension_drop` | Drop a .tgz file here | Thả file .tgz vào đây |
| `upload_extension_wrong_type` | Only .tgz or .tar.gz packages are accepted. | Chỉ nhận gói .tgz hoặc .tar.gz. |
| `upload_extension_too_large` | The file is larger than the upload limit ({max}). | File lớn hơn giới hạn tải lên ({max}). |
| `upload_extension_success` | Extension "{name}" installed. | Đã cài extension "{name}". |
| `extension_source_upload` | Uploaded | Đã tải lên |

## Test

- Unit (`unit` project): `use-extension-upload.test.ts` (probe 200/404, upload FormData, lỗi dịch); `ExtensionsRoute.test.ts`
  (nút theo `available`); `ExtensionItem.test.ts`/`ExtensionItemOptions.test.ts` (chip, menu cho `upload`).
- Browser (`browser` project): `ExtensionUploadDialog.browser.test.ts` với axe: chọn file, lỗi, gửi (fetch mock), đóng.
- `test-utils/fetch.ts` KNOWN_REQUESTS: GET/POST `/backoffice/extensions/upload`.
