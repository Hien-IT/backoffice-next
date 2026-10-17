# Release-Gate Requirements Checklist: Trình chỉnh sửa Flows (017)

**Purpose**: Kiểm tra chất lượng yêu cầu (đủ, rõ, nhất quán, đo được, phủ kịch bản) của spec, plan, research,
data-model và contracts trước khi sinh tasks.md và implement. Đây là "unit test cho yêu cầu", không phải test hành vi.
**Created**: 2026-10-17
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [contracts/](../contracts/)
**Trọng tâm**: (1) canvas và staging: panel, nối/tháo, Save, lỗi giữa chừng, dữ liệu lạ; (2) drawer flow, trigger, drawer
operation và 15 operation; (3) log và nút chạy thủ công; (4) dùng chéo và kiểm thử: SC-002, bộ so payload và DB, E2E ba
cấu hình, bộ mẫu `bo_flows`, hiệu năng, bundle; (5) UI, a11y, design-system: Q-29 đến Q-33, ngoại lệ canvas, D-106.
**Độ sâu**: cổng phát hành (đủ edge case). **Người dùng checklist**: tác giả spec và reviewer (tự rà trước
`/speckit.tasks`). Mục chưa đánh dấu là việc cần sửa ở spec/plan trước tasks. Số trong ngoặc cuối dòng là trọng tâm.

## Requirement Completeness

- [ ] CHK001 Có yêu cầu nêu hiện gì khi `POST /flows` hoặc `PATCH /flows/:id` của drawer flow lỗi (hộp lỗi, drawer còn mở, giá trị giữ)? [Gap, Exception, Spec FR-012, FR-016] (2)
- [ ] CHK002 Có yêu cầu nêu hiện gì khi đổi trạng thái từ menu dòng (`PATCH {status}`) hoặc xóa flow từ bảng lỗi (badge giữ giá trị cũ, hộp lỗi, dòng còn)? [Gap, Exception, Spec FR-013, FR-014] (2)
- [ ] CHK003 Có yêu cầu nêu trạng thái DB và màn khi `PATCH /operations` (gỡ link) thành công nhưng `PATCH /flows/:id` của Save lỗi (link đã null trong DB, staging còn): lần Save sau có gửi lại đúng không, nạp lại hiện gì? [Gap, Recovery, Spec FR-030, Edge Cases] (1)
- [ ] CHK004 Có yêu cầu cho flow có `trigger` null hoặc trigger không đăng ký (tạo bằng API hoặc extension ở Directus): panel Trigger hiện gì, drawer tab 2 hiện gì, lưu có xóa `options` không? [Gap, Edge Case, Spec FR-012, FR-022] (1)(2)
- [ ] CHK005 Có yêu cầu cho mở `/settings/flows/<id>` của flow vừa tạo ở app kia sau khi đăng nhập (store chưa có → `beforeEnter` trả không tìm thấy tới khi tải lại trang, như Directus)? [Gap, Edge Case, Spec FR-001, research R2] (1)(4)
- [ ] CHK006 Có yêu cầu nêu bộ mẫu `bo_all_ops` an toàn khi chạy thật trong seed: `item-create`/`item-update`/`item-delete` đụng item nào, `request` gọi URL nào (mạng của CI), `notification` gửi cho ai (ảnh hưởng số chưa đọc của E2E khác), `mail` trên Directus 8155 (không SMTP), `exec` và giới hạn sandbox? [Gap, Spec FR-103, data-model §9] (4)
- [ ] CHK007 Có yêu cầu nêu cách cô lập số đếm log của `bo_all_ops` (badge 3) với spec khác chạy flow cùng job (manual, payload, cross-use)? [Gap, Spec FR-100, US4 Independent Test, contracts/tests §3] (3)(4)
- [ ] CHK008 Có yêu cầu nêu chữ en-US của notice D-106 (spec chỉ có câu tiếng Việt) và cách đổi "Backoffice" theo quy tắc thương hiệu? [Gap, Spec FR-041 `mail`, D-106] (2)(5)
- [ ] CHK009 Có yêu cầu cho nút sao chép (URL webhook, `copyable`) khi clipboard bị chặn hoặc không có (thông báo, fallback)? [Gap, Spec FR-022, US2-1] (5)
- [ ] CHK010 Có yêu cầu nêu chuỗi do người dùng nhập (tên flow, tên operation, `overview` từ options, JSON log) được hiện dạng chữ thuần, không HTML? [Gap, Security, Spec FR-022, FR-052] (1)(3)
- [ ] CHK011 Có yêu cầu nêu thứ tự focus và chuyển đổi chế độ khi Save thành công (về chế độ xem: focus vào đâu) và khi Clear Changes? [Gap, Spec FR-106, US2-9, US2-10] (5)
- [ ] CHK012 Có yêu cầu cho hộp Copy To khi flow đích không còn (bị xóa ở app khác) hoặc danh sách flow trong store cũ? [Gap, Edge Case, Spec FR-028] (1)

## Requirement Clarity

- [ ] CHK013 Webhook URL có một dạng duy nhất? Spec viết `<PUBLIC_URL>/flows/trigger/<id>` (US2-1), `<PUBLIC_URL>flows/trigger/<id>` (FR-012), "`PUBLIC_URL` của `/server/info`" (Edge Cases, Assumptions), còn research R7 và data-model §4 dùng `getApiUrl()`: nguồn và dấu `/` nào là đúng, ở cấu hình `cors` hiện origin nào? [Ambiguity, Conflict, Spec US2-1, FR-012, Edge Cases] (2)
- [ ] CHK014 "Badge số đếm rút gọn" có quy tắc rút gọn cụ thể (ví dụ 1.2K, theo locale) không? [Clarity, Spec US4-1] (3)
- [ ] CHK015 Định dạng `HH:mm (x ago)` có nêu theo locale vi-VN/en-US và múi giờ người dùng không? [Clarity, Spec US4-2] (3)
- [ ] CHK016 Màu chấm trạng thái log "khác = `gray`" và skeleton 3 dòng của danh sách log có nguồn Directus, hay là lựa chọn của app (khi đó là khác biệt cần ghi)? [Clarity, Assumption, Spec FR-004, FR-052] (3)(5)
- [ ] CHK017 Điều kiện của "Show Failed Only" có chốt (bước cuối `reject` hay có bước bất kỳ `reject`)? data-model §8 còn [Unverified]. [Ambiguity, Spec US4-3, data-model §8] (3)
- [ ] CHK018 Placeholder và fallback của `throw-error` ("An unexpected error occurred.", `INTERNAL_SERVER_ERROR`, `500`) có nguồn kiểm được (lib `@backoffice/errors` hay `@directus/errors`), để overview của hai app bằng nhau? [Clarity, Assumption, Spec FR-041] (2)(4)
- [ ] CHK019 "Canvas rộng thêm 25 ô" và "kích thước SVG = biên panel xa nhất + 100" có đơn vị rõ (ô hay px) và áp ở cả hai trục? [Clarity, Spec US2-3, FR-021] (1)
- [ ] CHK020 Thứ tự khóa của body Save có được nêu là phần của so sánh, hay bộ so bỏ thứ tự khóa (FR-101 nói "thứ tự khóa" được chuẩn hóa; research R4 lại giữ thứ tự)? [Clarity, Spec FR-101, research R4] (4)

## Requirement Consistency

- [ ] CHK021 Vào `/settings/flows` có gọi `hydrate()` không? FR-010 nói có, FR-108 tính 1 `GET /flows`, research R2 và R12 quyết định 0 request như Directus (plan ghi sửa ở T001). [Conflict, Spec FR-010, FR-108, research R2] (2)(4)
- [ ] CHK022 Khóa i18n của notice D-106 thống nhất? Spec FR-041 ghi `operations.mail.not_sent_notice`, research R5/R10 và contracts ghi `operations_mail_not_sent_notice` (overlay phẳng). [Conflict, Spec FR-041, research R5] (2)(5)
- [ ] CHK023 Ngân sách bundle thống nhất? Spec FR-109 chỉ có chunk canvas ≤ 60 KB; research R12 và contracts thêm registry ≤ 25 KB và drawer log ≤ 15 KB. [Consistency, Spec FR-109, research R12] (4)
- [ ] CHK024 Spec FR-106 và Complexity Tracking của plan có cùng danh sách việc vẫn phải tới được bằng phím (pencil, menu tile, select trạng thái Trigger, drawer, nút header) và cùng nơi ghi ngoại lệ (`qa/handoff-checklist.md`)? [Consistency, Spec FR-106, plan Complexity Tracking] (5)
- [ ] CHK025 Hộp nào là `persistent`: FR-006 nói chỉ drawer flow và drawer operation; drawer log (US4-4) và hộp Copy To có được nêu rõ cùng quy tắc? [Consistency, Spec FR-006, FR-052] (5)
- [ ] CHK026 Màu "chính/phụ" (US2 intro: `brand-500`/`orange-500`) có được áp nhất quán ở US2-2, FR-022, FR-023, FR-052, Q-29, Q-30 và cho icon log ở US4-2? [Consistency, Spec US2, US4-2, Q-29] (5)
- [ ] CHK027 Bảng truy vết còn khớp FR sau Clarifications (FR-025, FR-026 bỏ đường bàn phím; FR-106 đổi; SC-008 đổi)? [Traceability, Spec Truy vết] (5)
- [ ] CHK028 Danh sách request của spec (FR-016, FR-032, FR-045, FR-054) khớp `contracts/api-calls.md` #178–#184 (gồm `PATCH /flows/:id` của pencil Trigger, `POST /operations` Copy To, request "created" của `use-revisions`)? [Consistency, Spec FR-110, contracts/api-calls] (4)

## Acceptance Criteria Quality

- [ ] CHK029 "Sai số 0 ô" của SC-002 có cách quy đổi vị trí ở Directus app (lớp, thuộc tính style hay transform của tile) được nêu đủ để đo được? [Measurability, Assumption, Spec SC-002, contracts/components §6] (4)
- [ ] CHK030 "Kéo panel 60 fps" (FR-108) đo bằng gì: chỉ thời gian `generateArrows` mỗi khung < 8 ms hay cả khung vẽ? [Measurability, Spec FR-108] (4)
- [ ] CHK031 SC-004 (b) "tên/loại của mọi panel" và (c) "chuỗi `<dl>` overview của 15 panel và 5 trigger" có nêu cách bỏ phần khác biệt được phép (D-106 notice, màu)? [Measurability, Spec SC-004] (4)
- [ ] CHK032 SC-006 "12 kịch bản mẫu so JSON với Directus" có nêu nguồn mốc Directus (T002 ghi tay trên 8155) và cách chuẩn hóa id tạm và 5 ký tự ngẫu nhiên? [Measurability, Spec SC-006, research R9] (1)(4)
- [ ] CHK033 Ngoại lệ a11y canvas có tiêu chí duyệt đo được (ai duyệt, ghi ở đâu, trước mốc nào) trong SC-008 và SC-010? [Acceptance Criteria, Spec SC-008, SC-010] (5)

## Scenario Coverage

- [ ] CHK034 Có kịch bản cho người sửa flow mà không có quyền `create`/`update` trên `directus_operations` (admin luôn có; nhưng admin bị gỡ giữa phiên đã ghi) và cho người không admin mở URL `/settings/flows` trực tiếp? [Coverage, Spec Edge Cases, FR-001] (2)
- [ ] CHK035 Có kịch bản thay đổi `trigger.flow` khi flow con (trigger `operation`) bị xóa hoặc đổi trigger: select hiện id thô, overview hiện gì? [Coverage, Edge Case, Spec FR-041 `trigger`] (2)
- [ ] CHK036 Có kịch bản cho nhiều lần "+" liên tiếp trước khi Save (id tạm lồng, con của operation mới) và cho sửa operation tạm (`_…`) qua pencil? [Coverage, Spec US2-5, FR-027, FR-029] (1)
- [ ] CHK037 Có kịch bản nối reject của operation vào điểm nhận đang có cha resolve (gỡ link cũ) và nối Trigger vào operation đang có cha? [Coverage, Spec US2-6, FR-026] (1)
- [ ] CHK038 Có kịch bản cho chạy flow manual với `async true` (không chờ kết quả) và `error_on_reject` (lỗi trả về nút) ở US5? [Coverage, Spec US5, FR-012 `manual`] (3)
- [ ] CHK039 Có kịch bản Logs khi chạy flow trong lúc trang flow đang mở (không tự nạp, FR-055): người dùng làm mới bằng cách nào? [Coverage, Spec FR-055] (3)

## Edge Case Coverage

- [ ] CHK040 Có yêu cầu cho operation có `options` null hoặc không phải object (dữ liệu cũ) ở overview và drawer? [Edge Case, Gap, Spec FR-022, FR-040] (1)(2)
- [ ] CHK041 Có yêu cầu cho flow rất lớn (vượt 50 operation của perf) hoặc vị trí rất xa (canvas vài nghìn px): cuộn, mũi tên, hiệu năng? [Edge Case, Spec FR-108] (1)
- [ ] CHK042 Có yêu cầu cho log có `data` null hoặc `steps` không có (revision của flow không phải lần chạy, hoặc dữ liệu cũ)? [Edge Case, Gap, Spec US4] (3)
- [ ] CHK043 Có yêu cầu cho flow có `accountability` đổi từ `all` sang `null` khi đã có log (log cũ vẫn hiện)? [Edge Case, Spec US4-5] (3)
- [ ] CHK044 Có yêu cầu cho tên flow rất dài trong bảng, tiêu đề trang và panel (cắt dòng, tooltip)? [Edge Case, Gap, Spec US1-1, FR-022] (5)

## Non-Functional Requirements

- [ ] CHK045 Màn 768 px: có yêu cầu cho cách thao tác canvas trên máy tính bảng cảm ứng (pointer `touch`: kéo panel và kéo nối có hỗ trợ không, như Directus)? [Gap, Spec Edge Cases, constitution thiết bị] (1)(5)
- [ ] CHK046 Chế độ tối: có yêu cầu cho nền lưới, viền panel, mũi tên mờ và JSON `<pre>` ở chế độ tối trong spec (không chỉ Q-29)? [Completeness, Spec Q-29, Q-32] (5)
- [ ] CHK047 Có yêu cầu về dữ liệu nhạy cảm trong drawer log (payload, `$accountability`, options đã resolve có thể chứa token đã redact): chỉ admin, hiện nguyên chuỗi `--redacted--`? [Security, Spec Edge Cases, US4-4] (3)

## Dependencies & Assumptions

- [ ] CHK048 Giả định "Playwright kéo thả pointer events chạy trên webkit" có phương án ghi rõ khi flake (chỉ chromium cho kéo nối) và có ảnh hưởng SC-001 không? [Assumption, Spec Assumptions, SC-001] (4)
- [ ] CHK049 Giả định seed chạy `bo_all_ops` 3 lần trên cả hai app trong parity `fixtures-seed` có điều kiện chờ API nạp flow (bus reload) được nêu, và cách so snapshot bỏ log? [Assumption, Spec FR-103, research R9] (4)
- [ ] CHK050 Phụ thuộc `@backoffice/errors` vào web (lib Node workspace) có ghi điều kiện dùng được trong trình duyệt (chỉ enum, không import Node) và kiểm ở bundle? [Dependency, research R1] (2)

## Ambiguities & Conflicts

- [ ] CHK051 "Cần xác nhận" còn mục nào chưa chốt (RTL, `trigger-detail.vue`, request "created", chuỗi literal) và ai xác nhận trước khi đóng? [Ambiguity, Spec Khác biệt] (5)
- [ ] CHK052 D-105 còn [Unverified] (Directus có treo với vòng không): nếu T002 thấy Directus không treo, spec ghi lại thế nào (bỏ D-105, làm giống)? [Ambiguity, Spec D-105, Edge Cases] (1)

## Notes

- Đánh `[x]` khi spec/plan đã sửa cho mục đó; ghi lời giải ngắn sau mục hoặc ở file đề xuất riêng như 016
  (`release-gate-proposals.md`) nếu owner muốn duyệt gộp.
- Mục có `[Conflict]` (CHK013, CHK021, CHK022) nên sửa trước `/speckit.tasks` vì sinh task sai.
