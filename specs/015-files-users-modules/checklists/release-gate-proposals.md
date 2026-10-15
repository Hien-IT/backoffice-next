# Đề xuất lời giải: release-gate 015

Ngày 2026-10-15. Mỗi dòng là đề xuất ngắn cho một mục của [release-gate.md](./release-gate.md); tác giả spec áp vào
spec/plan/contracts theo cột "Sửa ở" rồi đánh dấu `[x]`. Quy ước: Directus đã có hành vi thì **làm như Directus**
(Nguyên tắc VI); khác biệt mới chỉ khi a11y hoặc constitution buộc; [Unverified] kiểm ở T002.

## Phần 1. Conflict và quyết định phạm vi (ưu tiên)

| Mục | Đề xuất | Sửa ở |
|-----|---------|-------|
| CHK049 | FR-024 thêm `POST /files` (bản sao, trình chỉnh ảnh lưu mới) và `POST /assets/files|folder` (đọc zip qua POST) cho khớp contracts | FR-024 |
| CHK050 | Giữ: `system-input-password` chỉ đăng ký registry, không màn dùng; FR-086 ghi "5 interface có màn, 1 chỉ registry" | FR-081, FR-086 |
| CHK051 | FR-121 thêm "spec 012 D-44 cột Gỡ ở → sau 015, FR-024 của 012 → `/users/<id>` (D-86)" | FR-121, SC-010 |
| CHK052 | US3-3: đóng hộp → nạp lại → notice ở page header; D-83 ghi "sau khi đóng hộp" | US3-3, D-83 |
| CHK053 | SC-008 thêm "(axe không kiểm kéo thả; ngoại lệ FR-111 ghi ở handoff-checklist)" | SC-008 |
| CHK054 | Truy vết US6 bỏ FR-090 (FR-090 là phạm vi, không kịch bản); giữ 1–4 | Truy vết |
| CHK055 | Chốt: route `users-me` dùng `redirect: () => '/users/' + userStore.currentUser.id` (hàm, store đã hydrate trước router private của 012); data-model và R2 ghi cùng | FR-050, data-model §1, R2 |
| CHK056 | Chốt: `uploadFile` nhánh multipart gọi `uploadWithProgress` 013 (giữ file), `BoUpload` chuyển sang `uploadFiles`; R3 sửa | research R3 |
| CHK057 | Ghi FR-054: Directus users không có route not-found riêng (rơi về 404 app); 015 dùng cùng component với Files cho đồng nhất, là chi tiết hiển thị, không D-xx | FR-054, contracts/components |
| CHK058 | FR-117 là 10 (9 + `files-users-parity-ui` đã đếm?) → đếm lại: 9 spec như contracts §3; sửa FR-117 bỏ trùng | FR-117 |
| CHK059 | D-90 ghi rõ: "không có danh sách upload dở trong drawer; tiếp tục upload dở khi chọn lại file vẫn như Directus (FR-022)" | D-90 |
| CHK101 | Như CHK051 | FR-121 |
| CHK098 | FR-110/§7: ngoại lệ "sub-menu có thể gồm mục phẳng + cây lồng (Files: thư mục + 3 mục; Users: 4 mục + role)" | FR-110, layout-patterns §7 |

## Phần 2. Completeness, Clarity (làm như Directus, ghi thêm cho rõ)

| Mục | Đề xuất | Sửa ở |
|-----|---------|-------|
| CHK001 | Chép nguyên `defaultPresets` của `stores/presets.ts` Directus vào data-model §3 và §7 (giá trị đúng khi code, T002) | data-model, FR-010, FR-060 |
| CHK002 | FR-013 thêm: thư mục con chỉ hiện ở layout cards (slot `prepend`); layout khác không hiện, như Directus | FR-013 |
| CHK003 | FR-012: "chọn tất cả" = mọi thư mục con + mọi file trang hiện tại (Directus: `select-all` → `folderSelection = subfolders`, cards `selectAll()` chọn items) | FR-012 |
| CHK004 | Edge Cases: không giới hạn ở client; 413/lỗi kiểu hiện từng file (`BoUpload` 013), file khác tiếp tục; `maxConcurrency` ≤ 0 → không giới hạn | Edge Cases, FR-021 |
| CHK005 | FR-022: metadata = preset + `filename_download` + `type` (+ `id` khi `fileId`), tus-js-client mã hóa base64; không `id` khi file mới | FR-022 |
| CHK006 | FR-021: tiến độ mỗi file là phần trăm (TUS: byte, multipart: XHR), trung bình như `uploadFiles` | FR-021 |
| CHK007 | FR-020: mở trực tiếp → hộp trên thư viện (route cha vẽ cùng); đóng khi đang tải → tải tiếp nền (Directus không hủy), danh sách nạp lại khi xong | FR-020 |
| CHK008 | FR-033: thay file theo nhánh của `uploadFile` (TUS với `id` khi bật, multipart khi tắt), như Directus | FR-033 |
| CHK009 | FR-031: mọi kiểu file; tên trùng API tự xử lý (`filename_disk` mới), `filename_download` giữ | FR-031 |
| CHK010 | FR-004: menu vẫn hiện; hành động lỗi 403 → hộp lỗi (Directus không kiểm quyền thư mục trong menu); `actionsDisabled` chỉ dùng ở drawer chọn file | FR-004 |
| CHK011 | FR-016: `parent` null → `folder: null` / `parent: null` ("File Library") | FR-016 |
| CHK012 | Edge Cases: zip rỗng vẫn tải; lỗi 4xx → hộp lỗi với body JSON; tên mặc định `unknown-<time>` / `folder-unknown-<time>.zip` | Edge Cases |
| CHK013 | FR-038: `GET /users/:id` lỗi → bỏ dòng, không hộp lỗi (Directus `finally` không bắt: ghi là làm giống, lỗi nuốt) | FR-038 |
| CHK014 | FR-030: không có trạng thái mới (`isNew` luôn false; `/files/+` là hộp tải); bỏ nhắc `isNew` ở FR-034 | FR-030, FR-034 |
| CHK015 | FR-042: focal ngoài ảnh → khung đặt theo giá trị (Cropper kẹp); custom trùng chuẩn → icon `crop_square` như Directus | FR-042 |
| CHK016 | FR-044: file mới vào thư mục của ảnh gốc (`imageData.folder`), không theo option field, như Directus | FR-044 |
| CHK017 | Edge Cases: ảnh không giải mã → `img` lỗi → notice lỗi, nút lưu khóa | Edge Cases |
| CHK018 | FR-052: 403 `/roles` → `unexpectedError` như Directus (hộp lỗi) — hoặc ẩn? Giữ Directus: hộp lỗi; nút mời đã ẩn vì `rolesReadAllowed` false | FR-052 |
| CHK019 | FR-063: không role → select rỗng, gửi không `role` (API dùng mặc định) | FR-063 |
| CHK020 | FR-063: `FAILED_VALIDATION` → hộp lỗi (`unexpectedError`); email lặp → API xử lý | FR-063 |
| CHK021 | Edge Cases: avatar lỗi → icon; role đã xóa → `role` null → chip ẩn | Edge Cases |
| CHK022 | FR-082: xem user khác chỉ theo `tfa_secret` (khóa localStorage là của trình duyệt khác) | FR-082 |
| CHK023 | FR-083: ghi "token cũ mất hiệu lực ngay; phiên cookie không đổi"; E2E dùng token mới | FR-083 |
| CHK024 | FR-084: id lạ → không mục nào active, giữ giá trị (không gửi) | FR-084 |
| CHK025 | FR-085: mọi rule lá là ô text (`type: 'color'`), swatch chỉ khi parse được màu | FR-085 |
| CHK026 | FR-084: như Directus `theme-preview.vue`: overrides lấy từ `useThemeConfiguration` (đã lưu), không từ form | FR-084 |
| CHK027 | FR-050: guard chạy sau hydrate (router private của 012 đã chờ); ghi | FR-050 |
| CHK028 | FR-051: share user → `UserMenu` không mục hồ sơ (012 đã vậy? kiểm, ghi) | FR-051 |
| CHK029 | FR-070: user mới → `provider`, `external_identifier` sửa được (chỉ readonly khi `!isNew && !isAdmin`) | FR-070 |
| CHK030 | data-model §11: user SSO giả dùng `provider` của profile `sso` env parity [Unverified T002]; không cần đăng nhập | data-model §11 |
| CHK031 | contracts/tests §3: `otplib` sinh OTP từ secret; `afterEach` xóa `tfa_secret` qua `POST /users/:id/tfa/disable` admin | contracts/tests §3 |
| CHK032 | Recipe §11 viết đủ các mục (như §9 của 014) | layout-patterns §11 |
| CHK033 | FR-021: bốn `div` `fixed` theo bbox của `<main>`, `border-2 border-brand-500`, `pointer-events-none`, `aria-hidden` | FR-021, Q-14 |
| CHK034 | FR-021: `BoNotice` trong page header, `aria-live="polite"`, nội dung `upload_files_indeterminate` + `%`, gỡ khi xong | FR-021 |
| CHK035 | FR-124: "cropperjs 1.6.2" | FR-124 |
| CHK036 | SC-006: giải mã bằng canvas `drawImage` → `getImageData`, so RGBA từng byte, cùng chromium; ghi | SC-006 |
| CHK037 | FR-042: chuỗi như `dimensionsString` (dùng `n()`), SVG → "SVG → PNG WxH" | FR-042 |
| CHK038 | Q-18 quyết màu chip theo status (đề xuất: active `success`, invited `warning`, draft `gray`, suspended `error`, archived `gray` nhạt) | Q-18 |
| CHK039 | FR-072: chuỗi hành động như Directus `setLang` + `userStore.hydrate`; `language` null → `default_language` | FR-072 |
| CHK040 | FR-079: hộp user cùng bề ngang form (`max-w-5xl`) | FR-079 |
| CHK041 | FR-084 ghi đường dẫn `src/theme/directus-themes.json`, nội dung, script + test | FR-084 |
| CHK042 | FR-112: overlay `theme_applies_in_directus` (en-US "Theme choice applies in the Directus app", vi-VN tương ứng), dưới danh sách | FR-112, FR-084 |
| CHK043 | FR-063 đã ghi; thêm "không hiển thị token" | FR-063 |
| CHK044 | SC-007: ảnh thẻ là data-URL PNG 1×1, `createApp`, `PERF=1` | SC-007 |
| CHK045 | SC-007: từ `load` của `img` tới `ready` của Cropper | SC-007 |
| CHK046 | SC-007: bảng request: mở thư mục = 1 + 1 (+0 folders); tải xong = 1 danh sách + 1 đếm? (Directus `refresh()` → cả hai) → ghi "1 + 1"; màn user = 1 item + 0 roles (cache) + 1 `/access` (policies) + 1 `/files` (avatar) | SC-007 |
| CHK047 | FR-001/FR-054: dùng `ContentNotFound` 014 với prop module (sub-menu theo module) | FR-001, FR-054 |
| CHK048 | FR-034 đã ghi; thêm "query `fields=folder.name` so trong payload" | FR-034 |

## Phần 3. Acceptance, Coverage, Edge, NFR, Assumptions

| Mục | Đề xuất | Sửa ở |
|-----|---------|-------|
| CHK060 | SC-002 (d) liệt kê 13 nút; "ẩn" = không có trong DOM | SC-002 |
| CHK061 | SC-004 ghi chuẩn hóa multipart như contracts §4 | SC-004 |
| CHK062 | SC-005 liệt kê 10 thao tác (ngôn ngữ null→vi-VN, 3 theme sáng + 1 tối, overrides thêm + xóa khóa, token tạo + xóa, TFA bật + tắt) | SC-005 |
| CHK063 | SC-006 thêm ảnh `bo-edit.png` 400×300 trong bộ mẫu; thao tác qua `setData` của Cropper ở cả hai app (`page.evaluate`) | SC-006, data-model §11 |
| CHK064 | SC-007: 500 thư mục 3 cấp, tất cả mở; "1 lần" = đếm `GET /files` | SC-007 |
| CHK065 | SC-008 khớp FR-111, gồm 3 hộp thoại mở | SC-008 |
| CHK066 | SC-010: "D-83 đến D-90 (D-87 đã bỏ)" | SC-010 |
| CHK067 | FR-118: như contracts §5 (11 lần, p95, 3 phép đo) | FR-118 |
| CHK068 | Edge Cases: quyền một phần → thư mục con vẫn hiện (folders riêng), `mine`/`all` theo filter quyền của API | Edge Cases |
| CHK069 | US7/FR-035: ở `cors`, `<a download>` khác origin mở tab (như Directus); zip `fetch` với `credentials: include` (sdk `apiFetch`) | FR-035, FR-014 |
| CHK070 | Edge Cases: 404 sau khi mở → màn không tìm thấy khi nạp lại | Edge Cases |
| CHK071 | Edge Cases: mất `app_access` → hydrate → màn không có quyền 012 | Edge Cases |
| CHK072 | Clarifications ghi "user invited vào app: ngoài phạm vi" (đã có); đủ | — |
| CHK073 | FR-083: nút tạo hiện khi field không `disabled`; 403 → `VError` tại chỗ (như Directus) | FR-083 |
| CHK074 | FR-117: lượt `vi-VN` gồm `users-item` nhãn và ngày | FR-117 |
| CHK075 | FR-019: kiểm `DrawerFiles` 013 có cây thư mục chưa; nếu chưa, 015 thêm `FilesNavigation` với `customTargetHandler` vào `DrawerFiles` (Directus có) → FR-019 sửa, contracts/components thêm | FR-019 |
| CHK076 | Edge Cases: tên trùng hiện cả hai, phân biệt bằng id (không xử lý thêm) | Edge Cases |
| CHK077 | Edge Cases: picker khóa chính nó, không khóa con (như Directus); vòng → API từ chối? [Unverified] → T002; nếu API nhận, tái tạo (R-xx) | Edge Cases |
| CHK078 | FR-021 đã ghi "mục kéo không phải file bị bỏ qua"; thêm "không thông báo" | FR-021 |
| CHK079 | Edge Cases: 401 giữa TUS → `onError` → hộp lỗi/về đăng nhập (012); fingerprint giữ → tiếp tục khi chọn lại | Edge Cases |
| CHK080 | Edge Cases: không khóa, lưu đè (như Directus) | Edge Cases |
| CHK081 | Edge Cases: ghi "API xóa session; app không xử lý" | Edge Cases |
| CHK082 | Edge Cases: không phải object → cây rỗng, lưu giữ | Edge Cases |
| CHK083 | Edge Cases: lỗi `fetchAll` → `unexpectedError`, cây rỗng | Edge Cases |
| CHK084 | FR-083/FR-082 thêm: không log, không URL; token chỉ trong state component, mất khi unmount; secret TFA chỉ trong hộp | FR-082, FR-083 |
| CHK085 | FR-038: chỉ 5 trường EXIF, không GPS | FR-038 |
| CHK086 | Q-14: thẻ thư mục = link + checkbox riêng (như thẻ file 014); viền `aria-hidden` | Q-14, FR-111 |
| CHK087 | FR-111: skeleton `motion-reduce`; Cropper không chuyển động | FR-111 |
| CHK088 | FR-119: ngân sách chunk lười: cropperjs + CSS ≤ 60 KB gzip, tus ≤ 25 KB, theme JSON ≤ 15 KB gzip | FR-119 |
| CHK089 | SC-007: folders và roles nạp 1 lần mỗi phiên app (module-level), đổi module không nạp lại | SC-007 |
| CHK090 | Assumptions: env parity bật `TUS_ENABLED=true` cho API mới và Directus ở profile `app` (nếu chưa: thêm ở compose, kiểm T002) | Assumptions |
| CHK091 | Assumptions ghi: test `BoUpload` 013 cập nhật (allowlist thêm `PATCH /files/:id`); spec 013 FR-051, FR-054 "mở rộng ở 015" | Assumptions, FR-121 |
| CHK092 | R6 ghi dự phòng: nếu `BoForm` không `provide('values')`, màn user `provide('values', item)` | research R6 |
| CHK093 | R6/R7 ghi: 012 store server có `auth.disableDefault` (FR 012); `project.default_theme_*` thêm ở 015 | research R6 |
| CHK094 | R6 ghi dự phòng `getComputedStyle` (đã có) | — |
| CHK095 | data-model §11: tạo JPEG EXIF bằng `sharp` (đã là dependency API) trong seed, không ảnh ngoài | data-model §11 |
| CHK096 | R11: chấp nhận fallback en-US; `keys.test.ts` chỉ kiểm en-US | research R11 |
| CHK097 | R12 ghi: điều kiện = tin nhắn phiên 014 "đã đóng" + CI xanh; task lượt 1 bắt đầu bằng T001 "xác nhận 014 đóng" | research R12 |
| CHK099 | FR-006: hai cache như Directus, chấp nhận lệch tới khi mở lại picker | FR-006 |
| CHK100 | FR-011: ghi "tải thư mục chỉ qua menu cây" | FR-011 |
| CHK102 | FR-073: email hiện ở cả hộp và form như Directus | FR-073 |
