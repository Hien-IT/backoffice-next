# Contract: kiểm thử (R9, R10)

## 1. Vitest trong `apps/web` (như 013, 014)

| Project | File | Dùng cho |
|---------|------|----------|
| `unit` (happy-dom) | `src/**/*.test.ts` | `use-folders` (`nestFolders`, cây lồng, vòng `parent`), `get-folder-filter` (4 nhánh, ngày `recent`), `delete-folder` (thứ tự request move/delete), `upload-file`/`upload-files` (multipart: FormData thứ tự preset rồi `file`; TUS: `XMLHttpRequest` giả → header `Tus-Resumable`, `Upload-Metadata`, resume), `use-dialog-route`, `use-navigation` (users: `roleTree`, `openRoles`), `use-tfa-setup` mở rộng (4 hàm mới, khóa localStorage), `rules-to-css-vars`, `directus-themes` (sinh = nguồn), store `presets.defaultPresets`, store `server.uploads`, route của hai module (thứ tự, redirect `/users/me`), `lang/keys.test.ts` mở rộng, sáu interface (`SystemToken`: tạo/tạo lại/xóa và request; `SystemMfaSetup`: ba luồng với mock; `SystemLanguage`; `SystemInputPassword`; `SystemThemeOverrides`: `set`/`unset` gỡ nhóm rỗng; `SystemTheme`: mục và giá trị) |
| `browser` (chromium) | `src/**/*.browser.test.ts` | thư viện với thẻ thư mục + `extraSelection` (chọn tất cả, đếm), kéo thả toàn cửa sổ (DataTransfer giả, viền, notice), màn file (xem trước, thay file, chuyển, chi tiết EXIF), `ImageEditor` (ảnh PNG cố định: cắt/xoay/flip/tỉ lệ/focal → FormData của `PATCH`; lưu mới → `POST`), `file-image` nút chỉnh, danh bạ (sub-menu cây role, bộ lọc hệ thống), màn user (hộp user, form với sáu interface, archive, xóa chính mình → logout), `ThemePreview` (biến `--theme--*` inline), `SystemThemeOverrides` (swatch), axe sáng/tối trên 8 màn (SC-008), `PERF=1`: cây 500 thư mục, lưới 100 + 20, mở trình chỉnh ảnh 4000×3000 (`machineFactor()`) |

Coverage v8 gộp ≥ 60 %.

## 2. API giả lập (`test-utils/fetch.ts`, `mockFixtureApi`)

Mở rộng theo `contracts/api-calls.md` #97–#134: `/folders` CRUD trong bộ nhớ (cây), `/files` lọc theo `folder`,
`uploaded_by`, `uploaded_on`, `type`; `POST /files` multipart (ghi lại FormData, trả `File` mới có `id`), `PATCH
/files/:id` JSON và multipart (ghi `focal_point_*`, `width/height` giả), `GET /assets/:id` (PNG cố định, nonce bỏ qua),
`POST /assets/files|folder/:id` (blob zip giả + `Content-Disposition`), `/users/invite` (tạo user `invited`; email trùng
→ `RECORD_NOT_UNIQUE` với `extensions.invalid`), `/users/*/tfa/*`, `/utils/random/string`, `/roles` với `parent`,
`/server/info` thêm `uploads` và `project.default_theme_*`; TUS: lớp `FakeXMLHttpRequest` tối thiểu cho tus-js-client
(POST tạo → `Location`, PATCH offset → `Upload-Offset`, HEAD). `assertOnlyKnownRequests` chặn path ngoài danh sách.
Snapshot thêm `folders.json`, `files.json`, `users.json`, `roles.json` (data-model §11).

## 3. E2E `apps/web-e2e` (ba cấu hình, SC-001)

| Spec | Story | Nội dung |
|------|-------|----------|
| `files-library.spec.ts` | US1 | cây thư mục, mục đặc biệt, thẻ thư mục, chọn gộp, tạo/đổi tên/chuyển/tải/xóa thư mục (hai chế độ), trạng thái trống, `@core` |
| `files-upload.spec.ts` | US2 | hộp `+` nhiều file, từ URL (stub `route()`), kéo thả 2 file, tiến độ, TUS khi API bật (`proxy-api`: `TUS_ENABLED` của env parity [Unverified: env parity bật TUS? nếu không, nhánh TUS chỉ unit]) |
| `files-item.spec.ts` | US2 | xem trước, sửa metadata, lưu kiểu, chuyển thư mục, tải về, thay file, bản sao, xóa, chi tiết file, `@core` |
| `files-image-editor.spec.ts` | US5 | cắt + xoay PNG 400×300, lưu đè, lưu mới; từ `file-image` của `bo_std`; SC-006 so pixel với Directus app (`proxy-api`) |
| `users-directory.spec.ts` | US3 | sub-menu trạng thái + cây role, bộ lọc hệ thống, mời (2 email, trùng), tạo từ route role, xóa hàng loạt |
| `users-item.spec.ts` | US4 | hộp user, sửa hồ sơ của mình (ngôn ngữ đổi ngay), role/policy, archive, xóa chính mình → logout, `/users/me` redirect, `@core` |
| `users-tfa-token.spec.ts` | US4 | token tạo/tạo lại/xóa (dùng token mới sau tạo lại); TFA bật/tắt (secret đọc từ response `generate`, OTP sinh bằng `otplib` phía test; `afterEach` tắt TFA của user test bằng admin `POST /users/:id/tfa/disable`, CHK031), admin tắt TFA user khác, SSO: khóa localStorage + đăng xuất |
| `files-users-permissions.spec.ts` | US6 | `bo-editor`, `bo-viewer`: `disabled`/ẩn theo bảng US6-3; lượt `vi-VN` |
| `files-users-parity-ui.spec.ts` | US7 | SC-002 năm thuộc tính so với Directus app, ba user; chỉ `proxy-api` |

Điều kiện: seed `bo_files`, `bo_users` trước (bước `web:fixtures`); dữ liệu ghi có `DATA_PREFIX`, mỗi spec dọn phần mình
tạo (thư mục, file, user, preset của admin trên `directus_files`/`directus_users` ở `beforeEach`); `allowed-paths.ts`
#97–#134; `pageerror`, `console.error`, missing-key làm test thất bại; host ngoài abort, trừ stub nhập từ URL
(`files.example` → PNG). Trình duyệt: chromium-768/1280 ở ba cấu hình; firefox-1280 và webkit-1280 chỉ `@core`
(`files-library`, `files-item`, `users-item`); spec điều khiển Directus app (`files-users-parity-ui`, payload) chỉ
chromium-1280 qua `DIRECTUS_APP_SPECS` của `playwright.config.ts` (014); `openSidebar` dưới `xl`; khôi phục preset
seed sau khi đổi layout.

## 4. Bộ so payload (`apps/web-e2e/src/payload/{files,users}.spec.ts`, SC-004)

Như 014 §4 (`recordWrites` + `normalize`), lọc thêm `/files`, `/folders`, `/users`, `/assets`, `/utils/random`; chuẩn
hóa multipart: so tên field theo thứ tự, tên file, `type`, kích thước blob (không so bytes); nonce `/assets/:id?x` bỏ.
Kịch bản: tải 1 file qua hộp, thay file, chuyển thư mục (một và hàng loạt), tạo/đổi tên/xóa thư mục (move), lưu
metadata, bản sao, xóa; tạo user, sửa, archive, mời 2 email, token tạo/xóa, TFA bật/tắt (secret đọc từ response),
xóa hàng loạt. Khác biệt thật → R-xx trong spec.

## 5. Benchmark màn (`tests/benchmark/src/web-files-users.ts`, FR-118)

Target `benchmark:web` thêm hai kịch bản: thư viện với 10.000 file trong một thư mục (seed bằng `POST /files` multipart
1 KB, song song 20) và danh bạ 10.000 user; đo trang đầu cards, đổi trang, lọc `type`/`status`; so với Directus app ≤
+10 % p95; không chặn CI.

## 6. Cổng CI

Như 014 §6, cộng: `web perf` thêm ba test perf của 015; `check-bundle` với `BUDGET_015`; `e2e-web` thêm chín spec và hai
payload spec; `web:fixtures` seed mở rộng; `directus-themes.test.ts` trong `quality`.
