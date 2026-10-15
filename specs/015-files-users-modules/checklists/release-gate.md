# Release-Gate Requirements Checklist: Module Files và Users (015)

**Purpose**: Kiểm tra chất lượng yêu cầu (đủ, rõ, nhất quán, đo được, phủ kịch bản) của spec, plan, research,
data-model và contracts trước khi sinh tasks.md và implement. Đây là "unit test cho yêu cầu", không phải test hành vi.
**Created**: 2026-10-15
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [contracts/](../contracts/)
**Trọng tâm**: (1) thư viện file: thư mục, tải lên, thay file, xóa thư mục; (2) trình chỉnh ảnh và so pixel; (3) màn
user, sáu interface `_system`, dữ liệu theme, TFA và token; (4) quyền, mời không email, kiểm thử ba cấu hình, bộ so
payload, hiệu năng, design-system. **Độ sâu**: cổng phát hành (đủ edge case). **Người dùng checklist**: tác giả spec
(tự rà trước `/speckit.tasks`). Lời giải đề xuất ngắn cho từng mục ở [release-gate-proposals.md](./release-gate-proposals.md).

## Requirement Completeness

- [x] CHK001 Có yêu cầu nêu preset mặc định hệ thống của `directus_files` và `directus_users` với giá trị chính xác (khóa `layout_options.cards`, `layout_query.cards`) để lần ghi `POST /presets` đầu tiên so được với Directus app? [Completeness, Spec FR-010, FR-060, research R3 [Unverified]]
- [x] CHK002 Có yêu cầu cho hành vi của thẻ thư mục ở các layout khác cards (tabular, calendar, kanban, map không có slot `prepend`: thư mục con không hiện như Directus)? [Gap, Spec FR-012, FR-013]
- [x] CHK003 Có yêu cầu cho nút "chọn tất cả" của layout cards khi có cả thư mục và file (chọn mọi thư mục con và mọi file trang hiện tại, hay chỉ một trong hai)? [Completeness, Spec FR-012, US1-4]
- [x] CHK004 Có yêu cầu cho giới hạn số file và kích thước khi kéo thả (`FILES_MAX_UPLOAD_SIZE`, `uploads.maxConcurrency` = 0 hoặc thiếu) và thông điệp khi một file bị từ chối? [Gap, Spec FR-021, Edge Cases]
- [x] CHK005 Có yêu cầu cho nội dung `Upload-Metadata` của TUS (những khóa nào của preset được gửi, mã hóa base64 theo giao thức) và cho `id` khi tiếp tục upload dở của file khác tên? [Completeness, Spec FR-022, data-model §4]
- [x] CHK006 Có yêu cầu cho thông báo tiến độ khi TUS (tiến độ theo byte) khác multipart (tiến độ XHR) để notice `upload_files_indeterminate` dùng cùng công thức? [Gap, Spec FR-021, FR-022]
- [x] CHK007 Có yêu cầu cho hộp `add_file` khi route `+` được mở trực tiếp bằng URL (không có lịch sử) và khi đóng trong lúc đang tải (tải tiếp hay hủy)? [Gap, Spec FR-020]
- [x] CHK008 Có yêu cầu cho thay file bằng TUS (`fileId` trong metadata `id`) khi server bật TUS, hay thay file luôn multipart? [Completeness, Spec FR-033, FR-022]
- [x] CHK009 Có yêu cầu cho "lưu bản sao" ở file không phải ảnh (video, PDF) và khi `filename_download` trùng (API tự đổi tên hay giữ)? [Gap, Spec FR-031, US2-7]
- [x] CHK010 Có yêu cầu cho menu thư mục trong cây khi user không có quyền update/delete `directus_folders` (ẩn từng mục hay cả menu, `actionsDisabled`)? [Gap, Spec FR-004, FR-100]
- [x] CHK011 Có yêu cầu cho xóa thư mục chế độ "chuyển" khi thư mục bị xóa là gốc (`parent` null): file và thư mục con về "File Library" (`folder: null`)? [Completeness, Spec FR-016]
- [x] CHK012 Có yêu cầu cho tải thư mục rỗng hoặc tải nhiều file vượt giới hạn zip của API (lỗi 4xx) và cho tên file khi `Content-Disposition` thiếu? [Edge Case, Spec FR-004, FR-014, Edge Cases]
- [x] CHK013 Có yêu cầu cho chi tiết file khi `uploaded_by` là user đã bị xóa hoặc không đọc được (403/404 của `GET /users/:id`): ẩn dòng, không hộp lỗi? [Gap, Spec FR-038]
- [x] CHK014 Có yêu cầu cho thứ tự và điều kiện của các nút page header màn file khi item mới (`isNew`: Directus không có route `+` cho file; `/files/+` là hộp tải lên) để không có trạng thái "file mới" trong form? [Clarity, Spec FR-030, FR-034]
- [x] CHK015 Có yêu cầu cho trình chỉnh ảnh với ảnh có `focal_point` ngoài kích thước ảnh (dữ liệu cũ) và với `custom_aspect_ratios` có `value` trùng tỉ lệ chuẩn? [Gap, Spec FR-042]
- [x] CHK016 Có yêu cầu cho "lưu thành file mới" từ `file-image` khi field `file-image` có option `folder` khác thư mục ảnh gốc (file mới vào thư mục nào)? [Gap, Spec FR-044, FR-045]
- [x] CHK017 Có yêu cầu cho trình chỉnh ảnh khi `type` là ảnh nhưng trình duyệt không giải mã được (HEIC, TIFF): lỗi tải ảnh hiện gì, nút lưu khóa? [Edge Case, Spec FR-041]
- [x] CHK018 Có yêu cầu cho cây role khi `GET /roles` bị 403 (user không đọc được `directus_roles`): sub-menu chỉ bốn mục trạng thái, nút mời ẩn? [Gap, Spec FR-052, FR-063]
- [x] CHK019 Có yêu cầu cho hộp mời khi `GET /roles` trả rỗng (không chọn được role: nút mời khóa hay gửi không `role`)? [Gap, Spec FR-063]
- [x] CHK020 Có yêu cầu cho email không hợp lệ trong hộp mời (lỗi `FAILED_VALIDATION` từ API hiện ở đâu) và cho email lặp trong cùng ô? [Gap, Spec FR-063]
- [x] CHK021 Có yêu cầu cho màn user khi `avatar` trỏ file đã xóa hoặc không đọc được (icon mặc định, không hộp lỗi) và cho `role` trỏ role đã xóa? [Edge Case, Spec FR-073, Edge Cases]
- [x] CHK022 Có yêu cầu cho `system-mfa-setup` khi xem user khác chưa có `tfa_secret` nhưng có khóa `require_tfa_setup` (chỉ có ở trình duyệt của user đó): admin thấy "tắt"? [Completeness, Spec FR-082]
- [x] CHK023 Có yêu cầu cho `system-token` khi user đang xem là chính mình và token mới được tạo: phiên hiện tại không đổi, token cũ bị thu hồi ngay (API) → ghi để E2E không dùng token cũ? [Gap, Spec FR-083]
- [x] CHK024 Có yêu cầu cho `system-theme` khi `theme_light` lưu id không có trong dữ liệu tĩnh (theme của extension hoặc bản Directus khác): mục nào được chọn, giá trị giữ nguyên khi lưu? [Gap, Spec FR-084, D-89]
- [x] CHK025 Có yêu cầu cho `system-theme-overrides` với rule kiểu không phải màu (`borderRadius`, `fontFamily`, số): ô text không swatch, vẫn ghi chuỗi như Directus (`type: 'color'` cho mọi rule)? [Clarity, Spec FR-085]
- [x] CHK026 Có yêu cầu cho xem trước theme (`ThemePreview`) gộp overrides của user đang sửa (chưa lưu) hay chỉ overrides đã lưu? [Completeness, Spec FR-084, research R6]
- [x] CHK027 Có yêu cầu cho `/users/me` khi chưa có store user (tải lại trang): guard chờ hydrate rồi mới chuyển hướng? [Gap, Spec FR-050, D-86]
- [x] CHK028 Có yêu cầu cho `UserMenu` khi user là share (không có id user thật): mục hồ sơ ẩn? [Gap, Spec FR-051, FR-103]
- [x] CHK029 Có yêu cầu cho `provider`, `external_identifier` khi tạo user mới bởi không admin (Directus cho sửa khi `isNew`)? [Completeness, Spec FR-070, FR-101]
- [x] CHK030 Có yêu cầu cho bộ mẫu `bo_users` user SSO: tên provider phải có trong `AUTH_PROVIDERS` của env parity để không lỗi khi Directus đọc, hay chỉ cần chuỗi? [Dependency, data-model §11 [Unverified]]
- [x] CHK031 Có yêu cầu cho E2E TFA của `users-tfa-token`: lấy secret từ response `generate` rồi sinh OTP bằng `otplib` phía test, và dọn `tfa_secret` sau test để không khóa admin? [Completeness, contracts/tests §3]
- [x] CHK032 Có yêu cầu cho recipe §11 cây thư mục/cây role: thụt cấp, chiều cao mục, menu "⋯" bàn phím, skeleton, tương phản ở trạng thái active, dưới `xl`? [Completeness, Spec Q-13, Q-17, FR-003, FR-052]

## Requirement Clarity

- [x] CHK033 "Viền thả bốn cạnh quanh vùng nội dung" có nêu rõ phần tử neo (`main` hay toàn `PrivateView`), độ dày, token màu và cách không chặn click? [Clarity, Spec FR-021, Q-14]
- [x] CHK034 "Notice tiến độ tại chỗ" có nêu vị trí (page header), nội dung từng trạng thái (đếm done/total, phần trăm), lúc gỡ, và `aria-live`? [Clarity, Spec FR-021, FR-113]
- [x] CHK035 "Cùng major Directus" cho cropperjs có chốt là 1.6.2 (bản catalog Directus) trong spec, không chỉ ở research? [Clarity, Spec FR-124, research R1]
- [x] CHK036 "Điểm ảnh sau khi giải mã bằng nhau, dung sai 0" có nêu cách giải mã (canvas `drawImage` + `getImageData` trên cùng chromium) và định dạng so (RGBA từng byte) để test viết đúng? [Clarity, Spec SC-006]
- [x] CHK037 "Dòng kích thước WxH → W'xH'" có nêu định dạng số theo locale (`n()`) và chuỗi cho SVG đúng như `dimensionsString` của Directus? [Clarity, Spec FR-042, US5-1]
- [x] CHK038 "Chip role có class theo `status`" có ánh xạ màu cụ thể (token theo từng status: active, invited, draft, suspended, archived) hay để recipe Q-18 quyết? [Clarity, Spec FR-073]
- [x] CHK039 "Ngôn ngữ đổi ngay" sau lưu user của mình có nêu chuỗi hành động (hydrate store user → watcher 012 đổi locale → fields/collections hydrate) và điều kiện `language` null (về `default_language`)? [Clarity, Spec FR-072]
- [x] CHK040 "Form user `max-w-5xl` với hộp user phía trên" có nêu hộp user cùng bề ngang form hay full-width? [Clarity, Spec FR-079, Q-18]
- [x] CHK041 "Dữ liệu tĩnh chép từ `@directus/themes` 11.17.4" có nêu nội dung file sinh (`id`, `name`, `appearance`, `rules`), đường dẫn, và cách giữ đồng bộ (script + test) trong spec thay vì chỉ ở research? [Clarity, Spec FR-084, D-89, FR-121]
- [x] CHK042 "Dòng ghi chú 'áp dụng ở Directus app'" có nêu khóa dịch, vị trí (dưới danh sách theme) và hai ngôn ngữ? [Clarity, Spec FR-084, D-88, FR-112]
- [x] CHK043 "Link chấp nhận lời mời lấy từ log API là việc vận hành" có nêu rõ trong spec rằng Backoffice không hiển thị token và E2E chỉ kiểm user `invited`? [Clarity, Spec FR-063, Clarifications]
- [x] CHK044 "Lưới cards 100 thẻ + 20 thẻ thư mục vẽ dưới 1 giây" có nêu điều kiện (ảnh thẻ là PNG giả cố định, không tải mạng; mount bằng `createApp`, `PERF=1`) để đo lặp lại được? [Measurability, Spec SC-007]
- [x] CHK045 "Mở trình chỉnh ảnh 4000×3000 dưới 2 giây sau khi ảnh tải xong" có nêu mốc bắt đầu (sự kiện `load` của `img`) và mốc kết thúc (Cropper `ready`)? [Measurability, Spec SC-007]
- [x] CHK046 "Số request mỗi thao tác" có liệt kê đủ cho: mở thư mục (danh sách + đếm + thư mục con từ cache), tải lên xong (nạp lại danh sách 1 lần, đếm?), mở màn user (item + roles cache + request của `list-m2m` policies và `file` avatar)? [Clarity, Spec SC-007]
- [x] CHK047 "Trang không tìm thấy trong module với sub-menu" có nêu component dùng chung với 014 (`ContentNotFound` kiểu module) hay file riêng, và tiêu đề/thông điệp? [Clarity, Spec FR-001, FR-054]
- [x] CHK048 "`PATCH /files/:id` với `fields=folder.name`" có nêu notice dùng `response.data.folder.name` và chuỗi khi `folder` null ("File Library") để bộ so payload so cả query? [Clarity, Spec FR-034]

## Requirement Consistency

- [x] CHK049 FR-024 (danh sách ghi của tải lên) và contracts #114–#120 có cùng tập request (FR-024 thiếu `POST /files` của `saveAsCopy` và `ImageEditor`? contracts có) ? [Consistency, Spec FR-024, FR-039, contracts/api-calls]
- [x] CHK050 FR-081 nói `system-input-password` "không có màn dùng ở 015" trong khi `users.yaml` dùng `input-hash` cho `password`: có chỗ nào khác của spec còn ngụ ý dùng nó ở form user hay đăng ký (US4-5 đã sửa)? [Consistency, Spec FR-081, US4-5, FR-086]
- [x] CHK051 Spec đầu ("Tham chiếu Directus") đã bỏ `register.vue` nhưng "Ngoài phạm vi" ghi D-44 giữ: cột "Gỡ ở" của D-44 ở spec 012 ghi "sau 015" có nằm trong FR-121 và SC-010? [Consistency, Spec FR-090, FR-121, SC-010]
- [x] CHK052 D-83 (notice mời) nói "sau khi đóng" còn FR-063 nói "thành công thì đóng và nạp lại danh sách" rồi notice: thứ tự đóng → nạp lại → notice có thống nhất ở US3-3? [Consistency, Spec D-83, FR-063, US3-3]
- [x] CHK053 FR-046/FR-111 (khung cắt chỉ chuột) và FR-042 ("phím tắt không bắt buộc") có mâu thuẫn với SC-008 "axe 0 vi phạm" không (axe không bắt kéo thả: ghi rõ)? [Consistency, Spec FR-046, FR-111, SC-008]
- [x] CHK054 "Truy vết" US5 → FR-040 đến FR-046 và SC-006; US7 → FR-110 đến FR-125: FR-090 (register) thuộc US6 nhưng không còn kịch bản kiểm; bảng truy vết còn đúng? [Consistency, Spec Truy vết]
- [x] CHK055 Data-model §1 đặt `users-me` trước `users-item`; FR-050 nói "giữ và chuyển hướng": cách chuyển hướng (route `redirect` hàm, hay guard) có thống nhất giữa spec, data-model và research R2? [Consistency, Spec FR-050, data-model §1, research R2]
- [x] CHK056 Research R3 nói `BoUpload` "bỏ `upload-with-progress.ts` nếu trùng" còn data-model §4 nói nhánh multipart dùng `upload-with-progress` 013: chọn một? [Conflict, research R3, data-model §4]
- [x] CHK057 contracts/components §2 ghi `UsersNotFound` "như Files" nhưng Directus users module không có route not-found (dùng 404 chung của app): spec FR-054 có nêu đó là bổ sung (khác biệt nhỏ) hay chép từ Files? [Consistency, Spec FR-054, contracts/components]
- [x] CHK058 Plan "Scale/Scope" ước 6.500 dòng và 9 spec E2E; contracts/tests §3 liệt kê 9; FR-117 liệt kê 10 tên (`files-users-permissions` + `files-users-parity-ui` + 8)? Đếm lại cho khớp. [Consistency, Spec FR-117, contracts/tests §3, plan]
- [x] CHK059 D-90 (upload dở) và FR-022 (`findPreviousUploads` tiếp tục): tiếp tục tự động khi chọn lại cùng file có mâu thuẫn với "không có danh sách upload dở"? Ghi rõ hai thứ khác nhau. [Consistency, Spec D-90, FR-022]

## Acceptance Criteria Quality

- [x] CHK060 SC-002 năm thuộc tính có liệt kê đủ nút của hai module (tải thư mục, tạo thư mục, mời, chỉnh ảnh, thay file) và cách lấy "ẩn" (không có trong DOM vs `hidden`)? [Measurability, Spec SC-002]
- [x] CHK061 SC-004 có nêu chuẩn hóa cho multipart (tên field theo thứ tự, tên file, `type`, kích thước blob; không bytes) trong spec hay chỉ ở contracts/tests §4? [Measurability, Spec SC-004, FR-120]
- [x] CHK062 SC-005 "10 thao tác mẫu" cho sáu interface có liệt kê 10 thao tác đó (ngôn ngữ null/vi, theme mỗi id, overrides thêm/xóa khóa, token tạo/xóa, TFA bật/tắt) để test viết được? [Measurability, Spec SC-005]
- [x] CHK063 SC-006 có nêu ảnh mẫu (PNG 400×300 trong bộ mẫu, không nén mất dữ liệu) và thao tác chính xác (cắt 200×100 tại (10,20) qua `setData`, xoay -90) đủ để lặp lại trên Directus app bằng Playwright? [Measurability, Spec SC-006, data-model §11]
- [x] CHK064 SC-007 có nêu cách đo "cây 500 thư mục" (nguồn dữ liệu giả, 3 cấp, `openFolders` mở hết hay đóng) và "nạp lại đúng 1 lần" (đếm `GET /files` sau khi `isAnyUploadActive` về false)? [Measurability, Spec SC-007]
- [x] CHK065 SC-008 liệt kê 8 màn axe: có khớp với danh sách màn ở FR-111 và gồm hộp thoại (mời, TFA, xóa thư mục) ở trạng thái mở? [Measurability, Spec SC-008, FR-111]
- [x] CHK066 SC-010 có nêu D-87 đã bỏ (không cần duyệt) và danh sách D cần duyệt là D-83 đến D-90 trừ D-87? [Consistency, Spec SC-010, Khác biệt]
- [x] CHK067 FR-118 benchmark 10.000 file/user "≤ +10 % p95" có nêu phép đo (trang đầu cards, đổi trang, lọc) và số lần (11, p95) như 014 để so sánh được? [Measurability, Spec FR-118, contracts/tests §5]

## Scenario Coverage

- [x] CHK068 Có kịch bản cho user chỉ có quyền đọc `directus_files` một phần (bộ lọc quyền theo `uploaded_by`): thư mục con vẫn hiện dù không có file đọc được, `mine` và `all` giống nhau? [Coverage, Spec FR-100, FR-102]
- [x] CHK069 Có kịch bản cho thư viện ở `cors` (khác origin): `<a download>` tới `/assets/:id` khác origin (trình duyệt bỏ `download`, mở tab mới) và `fetch` zip với cookie `SameSite=None`? [Coverage, Spec FR-014, FR-035, US7]
- [x] CHK070 Có kịch bản cho mở `/files/:id` của file chưa có `type` (upload TUS dở) hoặc file bị xóa giữa chừng (404 sau khi mở)? [Coverage, Edge Cases]
- [x] CHK071 Có kịch bản cho đổi role của chính mình thành role không có `app_access` rồi lưu (Directus: hydrate thất bại → màn không có quyền của 012)? [Coverage, Spec FR-072, Edge Cases]
- [x] CHK072 Có kịch bản cho user `invited` mở màn của mình (chưa có mật khẩu: không đăng nhập được, ngoài phạm vi) — ghi rõ để không bị hiểu là luồng cần test? [Coverage, Clarifications]
- [x] CHK073 Có kịch bản cho `system-token` với user không có quyền update field `token` (API 403): ô vẫn hiện nút tạo hay khóa theo `disabled` từ `BoForm` quyền field? [Coverage, Spec FR-083, FR-101]
- [x] CHK074 Có kịch bản cho màn user ở `vi-VN` (nhãn field hệ thống dịch từ `fields.directus_users.*`, ngày `last_access`) trong `files-users-permissions` lượt `vi-VN`? [Coverage, Spec FR-117, FR-074]
- [x] CHK075 Có kịch bản cho drawer chọn file (`DrawerFiles` 013) sau 015: vẫn không có cây thư mục trong drawer như Directus (`drawer-files.vue` có `FilesNavigation` với `customTargetHandler`!) — spec FR-019 có xét? [Coverage, Spec FR-019, Gap]

## Edge Case Coverage

- [x] CHK076 Có yêu cầu cho thư mục có tên trùng cùng cấp (API cho phép): cây và breadcrumb hiện cả hai, `FolderPicker` phân biệt bằng gì? [Edge Case, Spec FR-003, FR-006]
- [x] CHK077 Có yêu cầu cho chuyển thư mục vào chính thư mục con của nó (vòng): `FolderPicker` khóa chính nó nhưng không khóa con; API có từ chối? [Edge Case, Spec FR-004, Edge Cases]
- [x] CHK078 Có yêu cầu cho kéo thả một thư mục từ máy (DataTransfer có mục kiểu rỗng): bỏ qua như Directus (`file.type` rỗng) và thông báo? [Edge Case, Spec FR-021]
- [x] CHK079 Có yêu cầu cho tải lên khi phiên hết hạn giữa TUS (401 ở PATCH chunk): `onError` → về đăng nhập, upload dở giữ fingerprint để tiếp tục sau đăng nhập? [Edge Case, Spec FR-022, Edge Cases]
- [x] CHK080 Có yêu cầu cho trình chỉnh ảnh khi ảnh gốc bị thay (thay file) trong lúc drawer mở ở tab khác: lưu đè kết quả cũ (như Directus, không khóa)? [Edge Case, Spec FR-043]
- [x] CHK081 Có yêu cầu cho xóa hàng loạt user gồm user có token/TFA đang đăng nhập ở tab khác (API xóa session) — không cần xử lý ở app; ghi rõ? [Edge Case, Spec FR-062]
- [x] CHK082 Có yêu cầu cho `theme_light_overrides` quá lớn hoặc không phải object (chuỗi, mảng): cây hiện rỗng, không ném lỗi, lưu giữ nguyên? [Edge Case, Spec FR-085]
- [x] CHK083 Có yêu cầu cho `GET /folders` rất nhiều trang (`fetchAll` phân trang): skeleton tới khi xong, lỗi một trang → `unexpectedError` và cây một phần? [Edge Case, Spec FR-005, research R2]

## Non-Functional Requirements

- [x] CHK084 Có yêu cầu bảo mật cho token hiển thị dạng text sau khi tạo (không ghi log, không vào URL, xóa khỏi DOM khi rời màn) và cho secret TFA trong `<output>`? [Security, Spec FR-082, FR-083, Gap]
- [x] CHK085 Có yêu cầu cho ảnh xem trước và EXIF (`metadata`) chứa dữ liệu nhạy cảm (GPS): Directus không hiện GPS; spec FR-038 chỉ liệt kê 5 trường — ghi rõ không hiện trường khác? [Security, Spec FR-038]
- [x] CHK086 Có yêu cầu a11y cho thẻ thư mục trong lưới (link + ô chọn: hai thành phần tương tác trong một thẻ) và cho viền thả (chỉ trang trí, `aria-hidden`)? [Accessibility, Spec FR-111, Q-14]
- [x] CHK087 Có yêu cầu cho `prefers-reduced-motion` ở chuyển động của Cropper (không có) và skeleton (có)? [Accessibility, Spec FR-111]
- [x] CHK088 Có ngân sách bundle cụ thể cho chunk lười mới (cropperjs ≈ ?, tus ≈ ?, theme JSON ≈ 30 KB) hay chỉ chunk chính? [Performance, Spec FR-119, research R10]
- [x] CHK089 Có yêu cầu cho số request khi mở trang thư viện lần đầu (folders 1 lần cho cả app, roles 1 lần) và khi đổi giữa Files ↔ Users nhiều lần (không nạp lại)? [Performance, Spec FR-005, FR-052, SC-007]

## Dependencies & Assumptions

- [x] CHK090 Giả định "API mới hỗ trợ `/files/tus`, `POST /assets/files`, `POST /assets/folder/:id`" có kèm điều kiện env parity bật `TUS_ENABLED` cho E2E `proxy-api`? [Assumption, Assumptions, contracts/tests §3 [Unverified]]
- [x] CHK091 Giả định "`BoUpload` nhận `fileId`" có xét test 013 của `BoUpload` (FR-054 của 013 cấm `PATCH /files/:id`) và cách cập nhật spec 013 (FR-051, FR-054 "mở rộng ở 015")? [Dependency, Assumptions, FR-045]
- [x] CHK092 Giả định "`BoForm` cung cấp `inject('values')`" cho `system-mfa-setup` có được kiểm ở T002, và dự phòng nếu không (truyền `primaryKey` + đọc item qua `provide` riêng)? [Assumption, research R6 [Unverified]]
- [x] CHK093 Phụ thuộc vào store server đọc `project.default_theme_light|dark` và `auth.disableDefault`: 012 đã có chưa (ghi rõ chỗ sửa)? [Dependency, research R6, R7 [Unverified]]
- [x] CHK094 Phụ thuộc `cssVar` của `@directus/utils/browser`: có trong 13.4.1 không; dự phòng ghi? [Dependency, research R6 [Unverified]]
- [x] CHK095 Giả định "ảnh JPEG có EXIF sẵn trong repo" cho bộ mẫu: nguồn và giấy phép ảnh; nếu tạo bằng `sharp` thì seed cần `sharp` (dependency dev của fixtures)? [Assumption, research R9, data-model §11]
- [x] CHK096 Giả định "`vi-VN.yaml` đủ khóa" có kiểm bằng `keys.test.ts` hay chấp nhận fallback en-US (ghi là chấp nhận)? [Assumption, research R11]
- [x] CHK097 Giả định "chỉ sửa `apps/web` khi 014 đóng" có nêu cách biết (thông báo của phiên 014 + CI xanh commit cuối) và ảnh hưởng tới thứ tự task lượt 1? [Dependency, Spec FR-122, research R12]

## Ambiguities & Conflicts

- [x] CHK098 "Cây lồng trong sub-menu" (Q3 = A) với sub-menu Users có 4 mục trạng thái + cây role: hai nhóm trong một sub-menu (vạch chia) có mâu thuẫn với L-3 "một cấp" khi role không lồng? Ghi ngoại lệ đủ cho cả hai module. [Ambiguity, Spec FR-052, FR-110]
- [x] CHK099 "Thư mục nạp một lần cho cả app" (FR-005) và "`FolderPicker` nạp một lần mỗi instance" (data-model §2) — hai cache khác nhau có thể lệch sau tạo thư mục: Directus cũng vậy; ghi rõ chấp nhận? [Ambiguity, Spec FR-005, FR-006]
- [x] CHK100 "Nút tải về ở thư viện ẩn khi có thư mục trong lựa chọn" (FR-011) nhưng menu thư mục có "tải thư mục": hai đường tải khác nhau — ghi rõ không gộp. [Ambiguity, Spec FR-004, FR-011]
- [x] CHK101 D-86 "`/users/me` giữ": ở Directus, menu avatar trỏ `/users/<id>`; 012 FR-024 đã ghi `/users/me` là route hồ sơ — spec 012 cần sửa FR-024 khi đóng 015 (FR-121 chưa liệt kê)? [Conflict, Spec D-86, FR-121]
- [x] CHK102 "Hộp user chỉ khi không mới" + "`fieldsDenyList` 7 field": `email` nằm ở hộp user và cũng trong form (Directus hiện cả hai) — ghi rõ để không bị coi là trùng. [Ambiguity, Spec FR-073, FR-075]

## Notes

- 2026-10-15: toàn bộ 102 mục đã áp theo `release-gate-proposals.md` vào spec (FR, SC, Edge Cases, Assumptions, Q-14,
  Q-18, D-90, truy vết), research (R3, R6, R11, R12, R13), data-model (§1, §3, §7, §11), contracts (components, tests);
  mục kèm [Unverified] (CHK001, CHK030, CHK075, CHK077, CHK090, CHK092, CHK094) chốt ở T002. Mỗi chỗ sửa ghi mã CHK.

- Mục chưa đạt cần sửa spec/plan trước `/speckit.tasks`; lời giải đề xuất ngắn ở `release-gate-proposals.md`.
- Mục [Unverified] kiểm ở T002 (lượt 1) như 013, 014; không chặn tasks.
- Tác giả spec tự rà; khác biệt mới (nếu có) thêm vào D-91 trở đi và chờ tech lead.
