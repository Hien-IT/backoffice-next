# Release-Gate Requirements Checklist: Insights, Activity, Notifications (018)

**Purpose**: Kiểm tra chất lượng yêu cầu (đủ, rõ, nhất quán, đo được, phủ kịch bản) của spec, plan, research,
data-model, contracts và tasks trước khi implement. Đây là "unit test cho yêu cầu", không phải test hành vi.
**Created**: 2026-10-17
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [contracts/](../contracts/), [tasks.md](../tasks.md)
**Trọng tâm** (số trong ngoặc cuối dòng): (1) tương thích Directus: dùng chéo, GraphQL gộp, biến dùng chung, quirk R-53
đến R-55; (2) UI, a11y, design-system: biểu đồ, bảng sr-only, chuông, drawer, tile, Q-34 đến Q-39, ngoại lệ chỉ chuột;
(3) kiểm thử và bộ mẫu: E2E ba cấu hình, bộ so payload và DB, độ ổn định dữ liệu; (4) lỗi và trạng thái biên: lỗi
panel, lỗi Save, quyền, phiên hết hạn, dữ liệu lạ; (5) hiệu năng và bundle: FR-108, FR-109, chunk `apexcharts`.
**Độ sâu**: cổng phát hành (đủ edge case). **Người dùng checklist**: tác giả spec, tự rà trước `/speckit.implement`;
lời giải từng mục ở [release-gate-proposals.md](./release-gate-proposals.md); owner yêu cầu áp toàn bộ (2026-10-17), đã
áp vào spec, plan, research, data-model, contracts, tasks nên mọi mục `[x]`.

## Requirement Completeness

- [x] CHK001 Có yêu cầu nêu trạng thái DB, staging và chế độ sửa khi một trong ba request Save (`POST`/`PATCH`/`DELETE /panels`, gửi song song) lỗi còn các request kia đã ghi? [Gap, Recovery, Spec FR-028, US3-5] (1)(4)
- [x] CHK002 Có yêu cầu nêu hiện gì khi `POST`/`PATCH /dashboards` của hộp dashboard, `DELETE` một dashboard hoặc xóa hàng loạt lỗi (hộp còn mở, dòng còn, hộp lỗi)? [Gap, Exception, Spec FR-011, FR-012] (4)
- [x] CHK003 Có yêu cầu nêu hiện gì khi `PATCH`/`DELETE /notifications` hoặc `GET /notifications` của drawer lỗi (badge, lựa chọn, danh sách)? [Gap, Exception, Spec FR-071] (4)
- [x] CHK004 Có yêu cầu cho panel `relational-variable` khi `GET /items` lấy item hiển thị lỗi hoặc khóa đã chọn không còn (item bị xóa)? [Gap, Edge Case, Spec FR-052] (4)
- [x] CHK005 Có yêu cầu cho mở `/insights/<id>/<panelKey>` với `panelKey` không có trong store, hoặc panel có `type` lạ? [Gap, Edge Case, Spec FR-001, FR-030] (4)
- [x] CHK006 Có yêu cầu nêu người không có quyền `update` trên `directus_panels` vào thẳng `/insights/<id>/+` hoặc `/insights/<id>/<panelKey>` thì thấy gì? [Gap, Security, Spec FR-001, US3-1] (4)
- [x] CHK007 Có yêu cầu cho biểu đồ và metric khi giá trị nhóm null, giá trị aggregate null, hoặc số trả về dạng chuỗi (`sum`/`avg` của Postgres)? [Gap, Edge Case, Spec FR-042, FR-047..FR-050] (1)(4)
- [x] CHK008 Có yêu cầu nêu locale định dạng số (dấu thập phân vi-VN/en-US) cho metric, metric-list và nhãn biểu đồ, để SC-002 so được giữa hai app? [Gap, Clarity, Spec FR-042, SC-002] (1)(3)
- [x] CHK009 Có yêu cầu nêu múi giờ của nhóm thời gian time-series (field `timestamp` vs `dateTime`, giờ người dùng vs server)? [Gap, Spec FR-050] (1)
- [x] CHK010 Có yêu cầu nêu cách hiện `message` markdown của thông báo: link ngoài/trong app, `target`, ảnh, HTML bị loại? [Gap, Security, Spec FR-074] (2)(4)
- [x] CHK011 Có yêu cầu nêu `text` của panel `label` và `displayTemplate` của panel `list` hiện dạng chữ thuần hay markdown/HTML (chống XSS)? [Gap, Security, Spec FR-045, FR-046] (2)(4)
- [x] CHK012 Có yêu cầu nêu bình luận có mention trên dashboard tạo thông báo với đích nào và nút mở thông báo đó dẫn tới đâu? [Gap, Coverage, Spec FR-020, FR-072] (1)
- [x] CHK013 Có yêu cầu nêu tên file tải về khi xuất dashboard, và nội dung khi phần chọn có dashboard 0 panel? [Gap, Spec FR-013] (1)
- [x] CHK014 Có yêu cầu cho drawer activity khi `user` null (user đã xóa) hoặc `GET /activity/:pk` lỗi/không có quyền? [Gap, Edge Case, Spec FR-063] (4)
- [x] CHK015 Có yêu cầu nêu chuông và drawer thông báo với phiên share (người xem share không có user)? [Gap, Spec FR-070] (4)
- [x] CHK016 Có yêu cầu nêu `/activity` cho người không có quyền đọc `directus_activity` (role không có app access tối thiểu)? [Gap, Security, Spec FR-060, US5-5] (4)

## Requirement Clarity

- [x] CHK017 "Chỉ panel có `{{ field }}` và truy vấn thay đổi" (FR-054) có nêu panel không truy vấn nhưng dùng biến trong options (ví dụ `displayTemplate`, `label.text`) cập nhật hiển thị thế nào? [Clarity, Spec FR-054, US4-2] (1)
- [x] CHK018 Zoom-to-fit có nêu padding và phần header bị trừ, và hành vi ở 768 px khi panel chi tiết là drawer? [Clarity, Spec FR-022] (2)
- [x] CHK019 "Bo góc theo tile kề" (FR-023) có giá trị bo góc đo được (từ recipe Q-34) và quy tắc "chạm" (cùng cạnh, góc)? [Clarity, Spec FR-023, Q-34] (2)
- [x] CHK020 "Nhàn rỗi" của Auto Refresh (US2-5) có định lượng (thời gian, sự kiện tab ẩn/hiện) không? [Clarity, Spec US2-5] (1)
- [x] CHK021 "Mờ khi nạp lại" (FR-021) có thuộc tính hiển thị cụ thể (độ mờ, có chặn tương tác) không? [Clarity, Spec FR-021] (2)
- [x] CHK022 "Collection singleton" của FR-072 có nguồn xác định (metadata collection) không? [Clarity, Spec FR-072] (1)
- [x] CHK023 FR-105 "cùng dữ liệu" của biểu đồ có quy tắc so cho số thập phân (`toFixed` ra chuỗi ở bar-chart, ×100 ở pie khi có `decimals`)? [Clarity, Spec FR-105, SC-002] (1)(3)
- [x] CHK024 "Tile là vùng có nhãn" và "bảng sr-only" (FR-106) có nêu tên vai trò/landmark và nội dung `<caption>` khi panel tắt header? [Clarity, Spec FR-106] (2)

## Requirement Consistency

- [x] CHK025 Quyền của Export không nhất quán: header khóa khi không `create` (US1-5), còn menu dòng không gated (FR-012): đây là đúng nguồn Directus và có ghi ở "Cần xác nhận" không? [Consistency, Spec US1-5, FR-012] (1)
- [x] CHK026 Request xuất của app (SDK, `apiFetch`) và của Directus app (axios, `window.open`) khác dạng query (`fields=` vs `fields[]=`): FR-101 có nêu so theo nghĩa (`canonicalPath`) như 017 không? [Consistency, Spec FR-013, FR-101] (1)(3)
- [x] CHK027 FR-005 ghi trạng thái nạp của drawer thông báo là "`BoTable loading`/skeleton": có khớp nguồn Directus (`notifications-drawer.vue`) không? [Consistency, Spec FR-005, FR-071] (2)
- [x] CHK028 D-108 chọn màu mặc định `brand-500` trong khi Q-35 (bảng màu biểu đồ) còn mở: hai chỗ có mâu thuẫn với XII "không tự chọn" không? [Conflict, Spec D-108, Q-35] (2)
- [x] CHK029 Bộ mẫu `bo_dash_all` có panel `variable`/`relational-variable` mà không panel nào dùng biến: SC-002 so gì cho hai panel này (giá trị mặc định, ô chọn rỗng)? [Consistency, Spec SC-002, data-model §12] (1)(3)
- [x] CHK030 Spec FR-109 không có số cho chunk lười, plan/R12 có (`apexcharts` ≤ 170 KB "chốt sau đo"): ngân sách nào là yêu cầu? [Consistency, Spec FR-109, plan R12] (5)
- [x] CHK031 SC-001 chỉ nêu `insights-edit` chạy firefox/webkit; FR-100, contracts/tests §3 và tasks T085, T096 nêu độ rộng khác nhau: danh sách project mỗi spec có thống nhất không? [Consistency, Spec SC-001, FR-100] (3)
- [x] CHK032 Chế độ sửa dùng staging chung của store (Copy To sang dashboard khác, Clear bỏ cả bản sao): guard sửa dở (`hasEdits`) có chặn rời trang khi chỉ có bản sao sang dashboard khác không, và có ghi là hành vi Directus? [Consistency, Spec FR-028, Edge Cases] (1)

## Acceptance Criteria Quality

- [x] CHK033 SC-002 so dữ liệu biểu đồ với "mốc từ response GraphQL của Directus app" chứ không với biểu đồ Directus vẽ: tiêu chí có đủ để nói "hiển thị đúng" (cùng nhóm, cùng thứ tự, cùng chuỗi) không? [Measurability, Spec SC-002, FR-105] (1)(3)
- [x] CHK034 SC-003 "3 giá trị mỗi biến" có nêu giá trị cụ thể cho `vars_author` (user nào có `bo_content`)? [Measurability, Spec SC-003, data-model §12] (3)
- [x] CHK035 SC-007/FR-108 đo với API giả lập trả ngay: có tiêu chí nào cho trường hợp thật (Directus/API mới) hay ghi rõ là ngoài phạm vi? [Measurability, Spec FR-108] (5)
- [x] CHK036 SC-004 (c) "20 dòng đầu của bảng activity" có quy tắc khi nhiều dòng cùng `timestamp` (thứ tự không xác định) và khi E2E khác ghi activity song song? [Measurability, Spec SC-004] (3)
- [x] CHK037 SC-008 có nêu ai duyệt và mốc thời gian cho Q-36 (chặn T082) khác với Q-34, Q-35, Q-37 đến Q-39 (duyệt khi đóng)? [Acceptance, Spec SC-008, tasks T004, T082] (2)

## Scenario Coverage

- [x] CHK038 Có yêu cầu cho Copy To sang dashboard mà người dùng không có quyền tạo panel (Save lỗi một phần)? [Coverage, Exception, Spec FR-026] (4)
- [x] CHK039 Có yêu cầu cho thông báo mới đến trong lúc drawer đang mở (danh sách, badge)? [Coverage, Spec FR-071, FR-073] (1)
- [x] CHK040 Có yêu cầu cho phiên hết hạn khi Auto Refresh đang chạy (request 401 theo chu kỳ)? [Coverage, Recovery, Spec US2-5, Edge Cases] (4)
- [x] CHK041 Có yêu cầu cho panel bị xóa ở app khác trong lúc đang sửa nó (Save `PATCH` 403/404)? [Coverage, Exception, Spec FR-028] (1)(4)
- [x] CHK042 Có yêu cầu cho người dùng có quyền đọc dashboard nhưng chỉ đọc một phần collection mà panel truy vấn (lỗi quyền từng phần trong GraphQL)? [Coverage, Spec FR-041, Edge Cases] (1)(4)

## Non-Functional Requirements

- [x] CHK043 CSS mặc định của `apexcharts` (tooltip, legend, toolbar) có yêu cầu ghi đè bằng token và chế độ tối, và có nêu không dùng màu ngoài theme trong CSS đó? [NFR, XII, Spec Q-35, plan Complexity Tracking] (2)
- [x] CHK044 Ghi chú panel (`note`) chỉ hiện ở tooltip: có yêu cầu để bàn phím và trình đọc màn hình tới được không? [NFR, a11y, Spec FR-020] (2)
- [x] CHK045 Biểu đồ nhiều chuỗi (line `grouping`, time-series) có yêu cầu phân biệt chuỗi không chỉ bằng màu và tương phản màu chuỗi với nền? [NFR, a11y, XII, Spec FR-106, Q-35] (2)
- [x] CHK046 Thay đổi số chưa đọc có được thông báo cho trình đọc màn hình (`aria-live`) hay chỉ đổi `aria-label`? [NFR, a11y, Spec FR-070, Q-38] (2)
- [x] CHK047 Giá trị biến đưa vào filter qua `applyOptionsData` (chuỗi người dùng nhập ở panel `variable`) có yêu cầu nêu là JSON hóa an toàn, không chèn được cú pháp GraphQL? [NFR, Security, Spec FR-053] (1)(4)
- [x] CHK048 Màn 768 px có yêu cầu cho lưới dashboard ở chế độ sửa (tay cầm resize trên màn cảm ứng/không), drawer panel và drawer thông báo toàn màn? [NFR, Coverage, Spec Edge Cases] (2)
- [x] CHK049 Ngân sách bundle có nêu chỗ đo (`check-bundle.mjs`, gzip) và hành động khi `apexcharts` vượt (ví dụ nạp lười theo loại panel)? [NFR, Spec FR-109, plan R12] (5)

## Dependencies & Assumptions

- [x] CHK050 Giả định "API GraphQL aggregate/group giống Directus" có test parity 011 phủ đúng dạng panel gửi (`groupBy` hàm ngày `year(date)`, `_func` trong filter, `/graphql/system`)? [Assumption, Spec Assumptions, research bảng kiểm] (1)
- [x] CHK051 Giả định `applyOptionsData` của `@directus/utils` 13.4.1 giống bản Directus 11.17.4 có cách kiểm (so mã hoặc test port)? [Assumption, Spec FR-053, tasks T001] (1)
- [x] CHK052 Bộ mẫu có cô lập số liệu của `bo_dash_all` (count `bo_content`) khỏi E2E khác tạo/xóa item `bo_content` (Activity, Content, flows) chạy cùng job? [Dependency, Spec FR-103, SC-002] (3)
- [x] CHK053 Badge 3 thông báo của admin có ổn định khi E2E khác tạo thông báo cho admin (comment mention 014, flow `notification` 017, payload)? [Dependency, Spec US6 Independent Test, FR-103] (3)
- [x] CHK054 Thêm bảy spec E2E và ba payload spec có ước lượng thời gian so với giới hạn 100 phút của job `e2e-web`? [Dependency, Spec FR-100, contracts/tests §6] (3)(5)
- [x] CHK055 Ngôn ngữ `vi-VN` thiếu khóa (panel, activity, notifications) rơi về `en-US`: có ghi danh sách khóa thiếu hay chỉ giả định? [Assumption, plan R10] (2)
