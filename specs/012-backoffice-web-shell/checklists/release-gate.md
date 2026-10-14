# Release-Gate Requirements Checklist: App web Backoffice (khung ứng dụng)

**Purpose**: Kiểm tra chất lượng yêu cầu (đủ, rõ, nhất quán, đo được, phủ kịch bản) của spec, plan và contracts
trước khi sang tasks và implement. Đây là "unit test cho yêu cầu", không phải test hành vi.
**Created**: 2026-10-14
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [contracts/](../contracts/)
**Trọng tâm**: (A) xác thực và phiên, (B) giao diện và design-system, (C) thương hiệu và i18n, (D) kiểm thử và
triển khai. **Độ sâu**: cổng phát hành (đầy đủ edge case). **Người dùng checklist**: tech lead duyệt khác biệt
và reviewer trước merge.

## Requirement Completeness

- [ ] CHK001 Có yêu cầu cho mọi trạng thái đăng nhập của user (`active`, `suspended`, `invited`, `draft`, `archived`) hay chỉ `suspended` và không `app_access`? [Completeness, Spec US1-3, FR-012] [Gap]
- [ ] CHK002 Có yêu cầu cho hành vi khi `GET /auth?sessionOnly` lỗi hoặc trả danh sách provider rỗng trong khi `/server/info` thành công không? [Gap, Spec FR-040]
- [ ] CHK003 Có yêu cầu cho giới hạn đăng nhập sai (rate limit `429`, `LOGIN_STALL_TIME`) ở phía app: thông báo, không lặp gửi, không lộ lý do? [Gap, Spec FR-012]
- [ ] CHK004 Có yêu cầu cho thứ tự ưu tiên khi vừa có `?redirect=` vừa có `last_page` sau đăng nhập không? [Completeness, Spec FR-013]
- [ ] CHK005 Có yêu cầu cho `/tfa-setup` khi `POST /users/me/tfa/generate` trả lỗi mật khẩu sai hoặc user đã có `tfa_secret` (API `400`)? [Gap, Spec FR-017]
- [ ] CHK006 Có yêu cầu cho hồ sơ share (`share` trong `/users/me`) ở từng màn private: thanh module, avatar, hồ sơ, đăng xuất có hiện không? [Gap, Spec Edge Cases "Người dùng share"]
- [ ] CHK007 Có yêu cầu cho trạng thái loading, empty và lỗi của từng vùng bố cục (thanh module khi `settings` chưa về, nav khi không có nội dung, sidebar trống) không? [Gap, Spec FR-020, FR-023]
- [ ] CHK008 Có yêu cầu cho nội dung sidebar phải ở 012 (trống, hay có mục "Thông tin" như Directus) và nút gập ở đâu không? [Completeness, Spec FR-020, D-45]
- [ ] CHK009 Có yêu cầu cho nội dung slot điều hướng của từng module ở 012 (trống hoàn toàn hay có danh sách tĩnh) không? [Completeness, Spec FR-026, contracts/ui-routes §4]
- [ ] CHK010 Có yêu cầu cho avatar người dùng (ảnh từ `/assets`, chữ cái đầu khi không có, lỗi tải) ở thanh module không? [Gap, Spec FR-024]
- [ ] CHK011 Có yêu cầu cho `public_note` về giới hạn HTML được phép (link mở tab mới? ảnh?) và khử script, hay chỉ "đã khử HTML nguy hiểm như Directus"? [Clarity, Spec FR-033]
- [ ] CHK012 Có yêu cầu cho `custom_css` về phạm vi áp (cả trang public hay chỉ private) và thứ tự với override theme không? [Gap, Spec FR-034, FR-063]
- [ ] CHK013 Có yêu cầu cho danh sách "giữ nguyên" khi thay thương hiệu là danh sách đóng (từng khóa) hay chỉ mẫu (`directus_*`, `@directus`, `directus.io`)? [Completeness, Spec FR-080, research R4]
- [ ] CHK014 Có yêu cầu cho chuỗi overlay riêng của Backoffice: danh sách khóa, bản `vi-VN` và `en-US` bắt buộc cùng lúc, ai duyệt nội dung tiếng Việt? [Gap, Spec FR-052, research R4]
- [ ] CHK015 Có yêu cầu cho ngôn ngữ RTL (user chọn `ar-SA`, `he-IL`) ở 012: `dir=rtl` áp bố cục hay chỉ attribute? [Gap, Spec FR-029, FR-061, D-46]
- [ ] CHK016 Có yêu cầu cho `GET /translations` khi user không có quyền đọc `directus_translations` (`403`) hay collection trống? [Gap, Spec FR-061]
- [ ] CHK017 Có yêu cầu cho hành vi `config.json` thiếu, sai JSON, hoặc `apiUrl` không hợp lệ ở app (màn lỗi hay về `/`)? [Gap, Spec FR-001, plan Constraints]
- [ ] CHK018 Có yêu cầu cho cách E2E tạo và dọn dữ liệu (user hạn chế, share, settings) để ba cấu hình không ảnh hưởng nhau và không ảnh hưởng `tests/directus-app-e2e` cùng DB? [Completeness, contracts/e2e §2]
- [ ] CHK019 Có yêu cầu cho nguồn token quên mật khẩu và lời mời trong E2E với API Directus thật (ký lại bằng `SECRET`) được ghi là giả định cần kiểm, kể cả payload JWT chính xác? [Completeness, research R9] [Assumption]

## Requirement Clarity

- [ ] CHK020 "Giữ phiên bằng refresh token" có được định nghĩa rõ là mode `session` (cookie) chứ không phải `refresh_token` trong body/localStorage, và lý do chọn ghi ở đâu? [Clarity, Spec Input vs FR-011, Assumptions]
- [ ] CHK021 Mốc "trước khi hết hạn 10 giây" có nêu rõ hành vi khi `expires` nhỏ hơn 10 giây hoặc lớn hơn 24 ngày (giới hạn `setTimeout`) không? [Clarity, Spec FR-014, research R3]
- [ ] CHK022 "Tab rảnh" (idle) có ngưỡng thời gian và sự kiện cụ thể (giống `idle.ts` bao nhiêu phút) không? [Clarity, Spec FR-014]
- [ ] CHK023 "Chỉ chấp nhận redirect nội bộ" có định nghĩa nội bộ là path bắt đầu `/` không chứa `//`, hay theo `useSafeRedirect` gọi API nào? [Clarity, Spec FR-013]
- [ ] CHK024 "Đủ từ bề rộng 768 px" có nêu rõ ba cột ở 768 đến `lg` (922 px) trông thế nào: nav là drawer, sidebar drawer, vùng chính chiếm toàn bộ? Hai mô tả (FR-028 và contracts/ui-routes §4) có cùng số liệu không? [Clarity, Consistency, Spec FR-028]
- [ ] CHK025 "Trạng thái trống nói rõ nội dung thuộc feature sau" có nội dung chuỗi cụ thể và có nêu số feature trong UI không (tránh lộ số feature nội bộ cho người dùng cuối)? [Clarity, Spec FR-023, D-40]
- [ ] CHK026 "Không truyền đạt trạng thái chỉ bằng màu" có liệt kê chỗ áp: module đang chọn (`aria-current` + dấu), notice (icon + chữ), lỗi field (chữ + `aria-invalid`)? [Clarity, Spec FR-021, FR-065]
- [ ] CHK027 "Theme tối PHẢI có đủ token tương ứng" có liệt kê tập token tối bắt buộc (surface, text, border; primary và status giữ nguyên?) để kiểm được không? [Clarity, Spec FR-064, research R2]
- [ ] CHK028 "Mọi chữ Directus người dùng thấy" có định nghĩa bao gồm `alt` ảnh, `title` tooltip, `aria-label`, console warning, tên file tải về không? [Clarity, Spec FR-030, FR-082]
- [ ] CHK029 "Chuỗi nhắc tới bảng hay API `directus_*` giữ nguyên" có nêu cách xử lý chuỗi hỗn hợp (một câu vừa có "Directus" thương hiệu vừa có `directus_users`) không? [Ambiguity, Spec US3-5, FR-080]
- [ ] CHK030 "Trình duyệt bản mới" được chốt là "hai bản ổn định mới nhất tại thời điểm phát hành feature": thời điểm phát hành là ngày merge hay ngày đóng spec? [Clarity, Spec FR-038, Assumptions]
- [ ] CHK031 "Kênh `msedge` khi runner có" có tiêu chí xác định runner có Edge và hành vi khi không có (bỏ qua, không fail) không? [Clarity, Spec FR-090, contracts/e2e §2]
- [ ] CHK032 Ngưỡng "3 giây trên 10 Mbps cache lạnh" có nêu điểm bắt đầu/kết thúc đo (navigation start đến login form visible) và máy đo (runner CI) không? [Measurability, Spec FR-074, SC-008]

## Requirement Consistency

- [ ] CHK033 FR-016 (nạp `collections`, `fields`, `relations`, `presets`, `notifications` sau đăng nhập) có nhất quán với D-45 (không nạp store flows, insights) và với contracts/api-calls (#21–#26) về đúng tập request? [Consistency, Spec FR-016, D-45]
- [ ] CHK034 Thứ tự nạp ở FR-016 (user → permissions → settings...) có khớp với research R5 (user → permissions + fields song song → còn lại) không? [Consistency, Spec FR-016, research R5]
- [ ] CHK035 FR-010 (link đăng ký trỏ trang "chưa có sẵn") có nhất quán với D-44 và với contracts/ui-routes §1 (`RegisterNotAvailableRoute` là route public) không? [Consistency, Spec FR-010, D-44]
- [ ] CHK036 FR-031 (`project_color` không đổi màu primary) có nhất quán với research R2 nơi override `primary` của settings ánh xạ sang `--eh-color-action-primary` (đổi primary)? Hai nguồn đổi primary này có được phân biệt rõ không? [Conflict, Spec FR-031, FR-063, research R2]
- [ ] CHK037 FR-030 (meta `theme-color` mặc định là màu primary design-system) có nhất quán với contracts/ui-routes §6 (giá trị tính của `--eh-color-action-primary`) và với Q-1 chưa duyệt không? [Consistency, Spec FR-030]
- [ ] CHK038 Key localStorage ở data-model §3 (`backoffice-sidebar-collapsed`...) có nhất quán với FR-020 (tiền tố `backoffice-`) và với việc giữ `sso_otp_attempted` trong "Cần xác nhận"? [Consistency, Spec FR-020, data-model §3]
- [ ] CHK039 FR-071 ba cấu hình, contracts/e2e §2 (bảng `E2E_CONFIG`) và research R10/R13 (số container web: hai hay bốn) có cùng một mô hình không? [Consistency, Spec FR-071, research R10, R13]
- [ ] CHK040 SC-001 ("ba cấu hình") và US7 kịch bản 2 (bốn trình duyệt × hai bề rộng) có nhất quán với contracts/e2e §2 (cấu hình `cors` chỉ chromium × 1280) không? [Consistency, Spec SC-001, US7]
- [ ] CHK041 FR-062 (chỉ đóng gói `en-US`, `vi-VN`) có nhất quán với FR-060 (`language` chọn từ mọi mã trong `available-languages`) và với hành vi "rơi về `en-US`" được ghi ở D-46? [Consistency, Spec FR-060, FR-062, D-46]
- [ ] CHK042 FR-060 (avatar qua `POST /files`) có nhất quán với SC-009 (danh sách request ghi được phép) và contracts/api-calls #30 không? [Consistency, Spec FR-060, SC-009]
- [ ] CHK043 Spec dùng cả "trang 404 private" và "trang không tìm thấy private"; contracts dùng `PrivateNotFoundRoute`: thuật ngữ có thống nhất không? [Consistency, Terminology]

## Acceptance Criteria Quality

- [ ] CHK044 SC-002 "vẽ xong khung trong dưới 1 giây sau khi dữ liệu đã nạp" có cách đo khách quan (sự kiện nào, công cụ nào) không? [Measurability, Spec SC-002]
- [ ] CHK045 SC-003 (5/5 người dùng nội bộ dưới 1 phút) có quy trình, người thực hiện và thời điểm (trước merge hay sau) được ghi không? [Measurability, Spec SC-003]
- [ ] CHK046 SC-005 "so sánh ảnh chụp, khác biệt chỉ ở phần design-system" có tiêu chí đạt/không đạt đo được, hay chỉ lưu artifact (contracts/e2e nói "không chặn")? [Measurability, Spec SC-005, contracts/e2e §2]
- [ ] CHK047 SC-004 "3 lần thời gian sống của access token" có nêu cách E2E rút ngắn `ACCESS_TOKEN_TTL` (env profile) để kiểm trong thời gian CI không? [Measurability, Spec SC-004]
- [ ] CHK048 SC-006 "100% chuỗi của các màn trong feature có bản `vi-VN` hoặc rơi về `en-US`" có cách phát hiện khóa thô (regex khóa chưa dịch trong DOM) được ghi không? [Measurability, Spec SC-006]
- [ ] CHK049 Mỗi FR về giao diện (FR-020 đến FR-029) có ít nhất một kịch bản chấp nhận hoặc test ở contracts/e2e tham chiếu tới không? [Traceability, Spec bảng truy vết]
- [ ] CHK050 Các FR-080 đến FR-084 (thương hiệu trong chuỗi dịch) có tiêu chí chấp nhận riêng ngoài SC-005 (ví dụ số chuỗi được thay, số chuỗi giữ) không? [Measurability, Spec FR-080]

## Scenario Coverage

- [ ] CHK051 Có kịch bản cho SSO với `AUTH_<PROVIDER>_MODE=json` (như `oidcstrict`, `oauthmock` trong env `sso`): app xử lý `?continue` thế nào khi provider không đặt cookie session? [Coverage, Spec FR-041, research R10] [Gap]
- [ ] CHK052 Có kịch bản cho SSO đăng ký công khai bị tắt (`ALLOW_PUBLIC_REGISTRATION=false`) → về `?error&code=INVALID_PROVIDER`/`INVALID_CREDENTIALS` không? [Coverage, Spec FR-042]
- [ ] CHK053 Có kịch bản cho nhiều tab: tab A đăng xuất, tab B đang chờ refresh; tab B đổi ngôn ngữ, tab A không tải lại? [Coverage, Spec Edge Cases "Hai tab"] [Gap]
- [ ] CHK054 Có kịch bản cho mất mạng tạm thời giữa phiên (request lỗi mạng, không `401`): app giữ phiên hay đăng xuất? [Coverage, Exception Flow] [Gap]
- [ ] CHK055 Có kịch bản cho API trả `/server/info` của Directus bản khác 11.17.4 (field thiếu/thừa) và app vẫn chạy? [Coverage, Spec FR-037] [Gap]
- [ ] CHK056 Có kịch bản cho `module_bar` chứa id module không tồn tại hoặc link `url` rỗng/không hợp lệ? [Coverage, Spec FR-021, Edge Case]
- [ ] CHK057 Có kịch bản cho user mất quyền giữa phiên (admin thu hồi `directus_files`): thanh module cập nhật khi nào (chỉ sau hydrate lại)? [Coverage, Spec FR-022] [Gap]
- [ ] CHK058 Có kịch bản cho `enforce_tfa` bật trong khi user đang ở `/tfa-setup` với mật khẩu sai nhiều lần (rate limit) không? [Coverage, Spec FR-017] [Gap]
- [ ] CHK059 Có kịch bản cho đổi mật khẩu ở hồ sơ làm session hiện tại hết hạn hay không (Directus giữ session)? Yêu cầu có nêu? [Coverage, Spec FR-060] [Gap]
- [ ] CHK060 Có kịch bản cho theme override không hợp lệ (JSON sai ở hồ sơ, giá trị màu không hợp lệ từ settings) ở cả nhập và áp không? [Coverage, Spec FR-060, FR-063, data-model §2]
- [ ] CHK061 Có kịch bản cho `prefers-reduced-motion` (video nền `autoplay`, transition) không? [Coverage, Accessibility] [Gap]
- [ ] CHK062 Có kịch bản cho người dùng chỉ bàn phím đi hết luồng đăng nhập → đổi module → mở menu avatar → đăng xuất (thứ tự focus, focus trap trong menu/dialog, focus trở về sau đóng) không? [Coverage, Spec FR-027]
- [ ] CHK063 Có kịch bản cho screen reader: thông báo lỗi đăng nhập được đọc (`aria-live`), tiêu đề trang đổi khi đổi module được thông báo? [Coverage, Accessibility] [Gap]
- [ ] CHK064 Có kịch bản cho ngôn ngữ của trang public trước đăng nhập (chưa có user): theo `default_language` của `/server/info` hay trình duyệt? [Coverage, Spec FR-061] [Gap]
- [ ] CHK065 Có kịch bản cho `/shared/:id` với share hết hạn, hết lượt, sai mật khẩu, và share không mật khẩu (tự đăng nhập)? [Coverage, Spec FR-054]
- [ ] CHK066 Có kịch bản cho Directus thật bật `WEBSOCKETS_ENABLED=true` (`/server/info.websocket` là object): app vẫn ẩn realtime và không kết nối? [Coverage, Spec FR-072]

## Edge Case Coverage

- [ ] CHK067 Có yêu cầu cho giá trị biên của `project_color` (rỗng, `transparent`, `var(...)`, chuỗi có dấu `;` gây hỏng `<style>`) khi chèn vào CSS? [Edge Case, Spec FR-031] [Gap]
- [ ] CHK068 Có yêu cầu cho `custom_css` chứa `</style>` hoặc rất lớn (giới hạn kích thước)? [Edge Case, Spec FR-034] [Gap]
- [ ] CHK069 Có yêu cầu cho `project_name` rất dài hoặc chứa HTML ở tiêu đề tab, nav, trang public (cắt chữ, escape)? [Edge Case, Spec FR-029, FR-033]
- [ ] CHK070 Có yêu cầu cho `last_page` trỏ route public (`/login`) hoặc chứa query độc hại (`javascript:`)? [Edge Case, Spec FR-018]
- [ ] CHK071 Có yêu cầu cho token `?token=` ở `/accept-invite` không phải JWT (payload không parse được) → thông báo gì, có dòng liên hệ admin? [Edge Case, Spec FR-051, FR-052]
- [ ] CHK072 Có yêu cầu cho `module_bar` của settings cũ (trước migration `visual`) thiếu mục `visual`/`deployments`: app xử lý giống Directus (migration 20250224A thêm mục) không? [Edge Case, Spec FR-021] [Gap]
- [ ] CHK073 Có yêu cầu cho localStorage bị chặn (Safari private, quota) với `useLocalStorage`: app không lỗi, mặc định dùng giá trị trong bộ nhớ? [Edge Case, Spec FR-020] [Gap]
- [ ] CHK074 Có yêu cầu cho cookie bị trình duyệt chặn (third-party cookie policy ở cấu hình khác origin, Safari ITP): thông báo lỗi nào, tài liệu triển khai có nêu? [Edge Case, Spec FR-075, research R3] [Gap]
- [ ] CHK075 Có yêu cầu cho đồng hồ máy khách lệch với server khi tính `accessTokenExpiry` (dùng `expires` tương đối, không dùng `exp` tuyệt đối)? [Edge Case, Spec FR-014]
- [ ] CHK076 Có yêu cầu cho bề rộng đúng 768 px và đúng 922 px (biên breakpoint) không cuộn ngang, và zoom trình duyệt 200% (WCAG reflow 320 px tương đương) có nằm ngoài phạm vi được ghi rõ không? [Edge Case, Spec FR-028] [Gap]

## Non-Functional Requirements

- [ ] CHK077 Có yêu cầu bảo mật cho XSS từ dữ liệu settings (`public_note`, `custom_css`, `project_name`, `project_url` với scheme `javascript:`) và từ chuỗi `translations` của DB không? [Security, Spec FR-033, FR-034, FR-026] [Gap]
- [ ] CHK078 Có yêu cầu CSP hoặc giới hạn nguồn script/style cho app tĩnh (nginx header) không, hay để 019? [Security] [Gap]
- [ ] CHK079 Có yêu cầu về dữ liệu nhạy cảm trong log trình duyệt và trace Playwright (mật khẩu, OTP, token trong URL `?token=` có bị ghi vào artifact CI không)? [Security, contracts/e2e] [Gap]
- [ ] CHK080 Có yêu cầu hiệu năng cho số request khi khởi động (hydrate ≤ N request, song song) và kích thước bundle tối đa (R12 nói 350 KB gzip, spec không nói)? [Performance, Spec FR-074, research R12] [Consistency]
- [ ] CHK081 Có yêu cầu về font self-host (Noto Sans, Material Symbols): kích thước, `font-display`, giấy phép, và ảnh hưởng tới SC-008 không? [Performance, research R8, R12] [Gap]
- [ ] CHK082 Có yêu cầu truy cập (WCAG mức nào: AA?) được nêu làm chuẩn cho FR-027, FR-065, tương phản màu của token tạm? [Accessibility] [Gap]
- [ ] CHK083 Có yêu cầu quan sát phía client (ghi lỗi JS không bắt được, `console.error` trong E2E làm test fail) không? [Observability] [Gap]
- [ ] CHK084 Có yêu cầu tương thích phiên bản: app chạy với Directus 11.17.4 "thật"; có nêu hành vi với 11.17.x khác hoặc 11.18 (không hỗ trợ, cảnh báo) không? [Compatibility, Spec FR-002] [Gap]

## Dependencies & Assumptions

- [ ] CHK085 Giả định `@directus/sdk` 21.3.0 có trên npm được đánh dấu [Unverified] với phương án dự phòng và nơi ghi khác biệt nếu dùng bản khác? [Assumption, plan Complexity Tracking, research R1]
- [ ] CHK086 Giả định Chromium nhận cookie `Secure` qua HTTP trên `localhost`/`127.0.0.1` được đánh dấu [Inference] và có task kiểm sớm trước khi dựng CI? [Assumption, research R3]
- [ ] CHK087 Giả định các cặp `sso`, `setup` thêm `CORS_*`, `SESSION_COOKIE_*` không làm lệch bộ đối chiếu 003, 010 đã được nêu và cần kiểm (header CORS xuất hiện trong so sánh header)? [Assumption, research R10, R13] [Risk]
- [ ] CHK088 Phụ thuộc vào gói font `material-symbols` (tên, subset, giấy phép OFL) được ghi [Unverified] với dự phòng? [Dependency, research R8]
- [ ] CHK089 Phụ thuộc vào export thực của Reka UI 2.8.2 (`SelectRoot`, `DropdownMenuRoot`...) có task kiểm đầu tiên và nơi ghi kết quả? [Dependency, research R7, quickstart]
- [ ] CHK090 Các câu hỏi mở Q-1 đến Q-7 có người chịu trách nhiệm trả lời, hạn, và quy tắc "giá trị tạm chỉ ở token" được nêu để tasks không chờ? [Assumption, Spec Q-1..Q-7, plan Constraints]
- [ ] CHK091 Giả định "feature này chỉ là khung" có được phản ánh ở mọi nơi (SC-003 nhiệm vụ "mở Files, mở Settings" chỉ cần thấy khung)? [Assumption, Spec SC-003, D-40]
- [ ] CHK092 Phụ thuộc vào `tests/directus-app-e2e` helper (`login.ts`, `db-rows.ts`) được chép sang `apps/web-e2e` thay vì import chéo: có ghi lý do và cách đồng bộ khi helper gốc đổi? [Dependency, contracts/e2e §2]

## Ambiguities & Conflicts

- [ ] CHK093 "Trang share" trong Input (áp `project_color`) và FR-054 (chỉ bước đăng nhập share ở 012) có mâu thuẫn với kỳ vọng người dùng về trang xem share không; đã ghi rõ ở D-40? [Ambiguity, Spec Input, FR-054]
- [ ] CHK094 Tên "API mới" / "app mới" / "Backoffice API" dùng lẫn trong spec, plan, contracts: có một thuật ngữ chuẩn không? [Terminology]
- [ ] CHK095 Research R4 nói chuỗi `theme_directus_*` giữ "Directus" (tên theme là dữ liệu) nhưng FR-030 nói mọi chữ Directus người dùng thấy đổi: tên theme có hiện ở 012 không (D-43 bỏ chọn theme)? Mâu thuẫn có được giải quyết? [Conflict, research R4, Spec FR-030, D-43]
- [ ] CHK096 contracts/api-calls #26 (`/notifications` query) ghi "đo khi port" và dấu `?`: yêu cầu còn mở này có task riêng không? [Ambiguity, contracts/api-calls]
- [ ] CHK097 contracts/e2e §4 "nếu quá 25 phút, firefox/webkit chỉ chạy ở lượt `proxy-api`" làm SC-001/US7-2 (bốn trình duyệt ở ba cấu hình) không còn đúng: quyết định này cần ghi vào spec trước hay để implement? [Conflict, contracts/e2e §4, Spec US7]
- [ ] CHK098 FR-073 ("không gửi header ngoài những gì Directus app gửi") và việc SDK có thể thêm header riêng (`Content-Type`, không `X-Requested-With`): có danh sách header cho phép để kiểm không? [Ambiguity, Spec FR-073]
- [ ] CHK099 FR-083 (bỏ `DIRECTUS_LOGO` ASCII trong console) là yêu cầu về "không in gì" hay "in logo Backoffice": đã rõ? [Clarity, Spec FR-083]
- [x] CHK100 "Cần xác nhận" ghi URL docs mặc định giữ `docs.directus.io`: có nêu ai xác nhận và khi nào đổi, tránh phát hành với link Directus trên thanh module của app Backoffice? [Ambiguity, Spec Cần xác nhận, FR-081] — Đã xử lý 2026-10-14: owner chọn ẩn (FR-081, D-49).

## Notes

- Mục đánh `[Gap]` là yêu cầu chưa có; khi xử lý, thêm FR hoặc ghi "ngoài phạm vi, feature N" vào spec thay vì để
  trống. Mục `[Conflict]`/`[Consistency]` cần sửa một trong hai nguồn, ưu tiên spec là nguồn chuẩn.
- Đề nghị xử lý trước `/speckit.tasks`: CHK033, CHK034, CHK036, CHK039, CHK040, CHK095, CHK097 (mâu thuẫn giữa
  spec, research và contracts); CHK077, CHK082 (bảo mật, truy cập chưa có chuẩn); CHK086, CHK087 (giả định ảnh
  hưởng CI).
- Mỗi lần chạy `/speckit.checklist` tạo file mới; file này không ghi đè `requirements.md`.
