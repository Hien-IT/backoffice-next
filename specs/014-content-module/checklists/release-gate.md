# Release-Gate Requirements Checklist: Module Content (014)

**Purpose**: Kiểm tra chất lượng yêu cầu (đủ, rõ, nhất quán, đo được, phủ kịch bản) của spec, plan, research,
data-model và contracts trước khi sinh tasks.md và implement. Đây là "unit test cho yêu cầu", không phải test hành vi.
**Created**: 2026-10-15
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [contracts/](../contracts/)
**Trọng tâm**: (1) preset, layout và bộ lọc dùng chung dữ liệu với Directus, (2) màn item, version và sidebar,
(3) hiệu năng 10 triệu dòng, a11y và design-system, (4) kiểm thử, bộ so payload và phạm vi. **Độ sâu**: cổng phát hành
(đủ edge case). **Người dùng checklist**: tech lead duyệt khác biệt và reviewer trước merge. Lời giải đề xuất cho từng
mục ở [release-gate-proposals.md](./release-gate-proposals.md).

## Requirement Completeness

- [x] CHK001 Có yêu cầu nêu body chính xác của lần ghi preset đầu tiên (`POST /presets`: những khóa nào, `layout` mặc định `tabular` có gửi không, `user`, `collection`) và của `PATCH` sau đó (chỉ khóa đổi hay cả preset cục bộ) để bộ so payload có mốc? [Completeness, Spec FR-011, data-model §2] (1)
- [x] CHK002 Có yêu cầu cho preset và bookmark trong phiên share (`ShareUser` không có `id`: Directus không nạp `/presets`, không ghi, layout mặc định)? [Gap, Spec FR-010, FR-084] (1)
- [x] CHK003 Có yêu cầu cho drawer `system-input-translated-string` (chọn chuỗi dịch có sẵn từ `/translations`, tạo chuỗi mới, giá trị lưu là `$t:<key>`) ngoài việc nêu tên ở FR-013 và D-73? [Gap, Spec FR-013, research R3] (1)
- [x] CHK004 Có yêu cầu cho giới hạn kích thước trang theo `queryLimit.max` của server (danh sách 25…1000 bị cắt, `usePageSize` của 013) và khi `max = -1`? [Gap, Spec FR-033] (1)
- [x] CHK005 Có yêu cầu cho độ rộng cột tối thiểu, độ rộng khi field mới thêm, và cách lưu khi kéo rồi bấm "ẩn cột" trong 350 ms debounce? [Gap, Spec FR-031] (1)
- [x] CHK006 Có yêu cầu cho bộ lọc, tìm kiếm và layout mà preset tạm của drawer chọn item kế thừa (preset của collection có `filter`/`search` đã lưu: drawer có áp chúng như `drawer-collection.vue` không, và chúng gộp với `filter` của interface ra sao)? [Completeness, Spec FR-029, FR-019] (1)
- [x] CHK007 Có yêu cầu cho độ sâu và nguồn của cây field trong bộ lọc nâng cao (quan hệ lồng nạp lười khi mở, field của collection hệ thống qua m2o như `directus_users`, hàm `year()`…`count()`, field `alias`/`presentation` bị loại) thay cho "tới độ sâu như Directus"? [Clarity, Spec FR-041, research R6] (1)
- [x] CHK008 Có yêu cầu cho `archive_value` null hoặc `unarchive_value` null trên collection có `archive_field` (bộ lọc hệ thống và nút archive làm gì)? [Gap, Spec FR-044, FR-055] (1)
- [x] CHK009 Có yêu cầu cho collection hệ thống không có route riêng (`directus_revisions`, `directus_sessions`…) khi gõ `/content/directus_x`: màn không tìm thấy như `collection.vue` (`isSystemCollection`)? [Gap, Spec FR-002, FR-009] (1)
- [x] CHK010 Có yêu cầu cho `cameraOptions` của map khi preset được dùng ở màn hình kích thước khác hoặc field hình học đổi (giữ, hay vừa dữ liệu lại), và cho `viewInfo` của calendar khi đổi collection? [Gap, Spec FR-036, FR-038] (1)
- [x] CHK011 Có yêu cầu cho xác nhận trước khi xóa nhóm kanban (xóa item thật của collection nhóm) và cho item còn trỏ tới nhóm bị xóa? [Gap, Spec FR-037] (1)
- [x] CHK012 Có yêu cầu cho thứ tự request khi kéo thẻ kanban đổi cột và vị trí (`/utils/sort` rồi `PATCH`, hay ngược) để bộ so payload so đúng chuỗi? [Completeness, Spec FR-037, contracts/tests §4] (1)
- [x] CHK013 Có yêu cầu cho vị trí, thời gian hiện, `aria-live` và nội dung của thông báo thành công/lỗi tại chỗ (D-66) ở màn item và màn collection thay cho "page header hoặc hộp thoại"? [Clarity, Spec FR-054, Assumptions, research R7] (2)
- [x] CHK014 Có yêu cầu cho nạp item khi đang ở version `draft` chưa tồn tại (`id '+'`: không gửi `version=`, form là bản chính) thay cho "form nạp GET …?version=<key>"? [Clarity, Spec FR-071] (2)
- [x] CHK015 Có yêu cầu ánh xạ quyền cho hộp so sánh version: promote cần quyền update item chính, tùy chọn "xóa version sau promote" cần quyền delete `directus_versions`, không có quyền thì nút ẩn hay khóa? [Gap, Spec FR-072] (2)
- [x] CHK016 Có yêu cầu nêu nguồn của `accountabilityScope` (`collection.meta.accountability` null nghĩa là gì) để quyết định mục Revisions có hiện không? [Clarity, Spec FR-080] (2)
- [x] CHK017 Có yêu cầu cho giá trị field quan hệ trong "Apply" của so sánh revision (khóa thô, o2m không có dữ liệu) và field user không đọc được trong `delta`? [Gap, Spec FR-081] (2)
- [x] CHK018 Có yêu cầu cho danh sách field và cách hiện của drawer tạo/sửa share (`directus_shares` qua `DrawerItem`: field `collection`, `item` ẩn và cố định, `password` không hiện lại) và cho quyền tạo share của role không được share? [Gap, Spec FR-083] (2)
- [x] CHK019 Có yêu cầu cho body `POST /flows/trigger/:id` ở màn collection khi flow có `requireSelection: false` và không có lựa chọn (`keys` rỗng hay bỏ), và cho kết quả flow trả về (hiện ở đâu)? [Clarity, Spec FR-089] (2)
- [x] CHK020 Có yêu cầu cho thanh công cụ live preview đầy đủ (ô URL chỉ đọc, kích thước `toggleFullscreen` 400×600, danh sách zoom 25–200 %, ô rộng/cao) thay cho "chọn kích thước màn hình (desktop, tablet, mobile)"? [Clarity, Spec FR-065] (2)
- [x] CHK021 Có yêu cầu cho phiên share khi mở `/content/<collection khác>` hoặc `/content` (chuyển về item được share, hay không tìm thấy) và cho `last_page` không ghi với share? [Gap, Spec FR-084] (2)
- [x] CHK022 Có yêu cầu cho `isSavable` khi form chỉ có thay đổi ở field user không được update (form 013 bỏ field đó khỏi `edits` hay API trả 403)? [Gap, Spec FR-052, FR-056] (2)
- [x] CHK023 Có yêu cầu cho `item_duplication_fields` rỗng hoặc null ở `saveAsCopy` (chỉ chép field phẳng) và cho collection có quan hệ nhưng không nằm trong danh sách đó? [Gap, Spec FR-053] (2)
- [x] CHK024 Có yêu cầu cho vùng thông báo thay đổi của bảng cho trình đọc màn hình (`aria-live` cho dòng số đếm, kết quả sắp xếp, trang mới) và cho `aria-sort` trên header? [Gap, Spec FR-115] (3)
- [x] CHK025 Có yêu cầu cho chế độ tối và `prefers-reduced-motion` ở phần của thư viện bên thứ ba (FullCalendar, MapLibre popup, kéo thả) theo `handoff-checklist.md`? [Gap, Spec FR-110, FR-116] (3)
- [x] CHK026 Có yêu cầu về nơi focus đi sau các hành động đổi màn (xóa item → danh sách, lưu và tạo tiếp → field đầu, đóng drawer so sánh → nút mở, xóa bookmark đang mở → route collection)? [Gap, Spec FR-053, FR-055, FR-005] (3)
- [x] CHK027 Có yêu cầu cho recipe design-system của notice tại chỗ (D-66), nút bookmark và menu version trong page header (Q-8) và tay cầm chia đôi (Q-6) đủ để design owner duyệt (vị trí, kích thước, trạng thái)? [Completeness, Spec Q-6, Q-8, FR-110] (3)
- [x] CHK028 Có yêu cầu cho E2E ba cấu hình dùng chung một DB: preset và bookmark của admin ghi ở cấu hình trước ảnh hưởng cấu hình sau (preset theo user + collection, không có `DATA_PREFIX`)? [Gap, Spec FR-120, contracts/tests §3] (4)
- [x] CHK029 Có yêu cầu cho request ra ngoài (tile OpenStreetMap, glyph, Mapbox) trong E2E: chặn bằng `route()` hay cho qua, và harness 012 (mọi request ngoài allowlist làm test thất bại) có phân biệt host ngoài không? [Gap, Spec FR-112, SC-005, SC-008] (4)
- [x] CHK030 Có yêu cầu cho cách "giả lập Mapbox" ở SC-005 (stub `api.mapbox.com` bằng Playwright `route()` hay chỉ browser test với mock)? [Clarity, Spec SC-005] (4)
- [x] CHK031 Có yêu cầu liệt kê 13 file test Directus của FR-124 và file đích tương ứng (như 013 FR-120) thay cho "các file test ở phần tham chiếu"? [Completeness, Spec FR-124] (4)
- [x] CHK032 Có yêu cầu cho tùy chọn "chạy nền" của nhập dữ liệu (khi nào hiện, lưu ở đâu, thông báo `import_upload_success` khác `import_data_success`)? [Gap, Spec FR-090] (2)
- [x] CHK033 Có yêu cầu cho bộ lọc và tìm kiếm trong hộp thoại xuất: sửa được bằng bộ lọc nâng cao như Directus (field `filter` của hộp thoại dùng `system-filter`) hay chỉ đọc? [Clarity, Spec FR-091] (2)

## Requirement Clarity

- [x] CHK034 "Cột mặc định 4 field hiện đầu (bỏ hidden, no-data, sắp theo tên field)": thứ tự thao tác (lấy 4 theo `meta.sort` rồi sắp tên, hay sắp tên rồi lấy 4) có được nêu đúng như `tabular/index.ts`? [Clarity, Spec FR-030] (1)
- [x] CHK035 "Ẩn khi chưa có số đếm hoặc 0" cho dòng số đếm: tabular và cards ẩn khi `!totalCount || !itemCount`, calendar/kanban/map chỉ khi null; spec gộp một câu có đúng không? [Clarity, Spec FR-024] (1)
- [x] CHK036 "Nhớ kết quả đếm theo (url, filter, search) trong phiên màn": phạm vi nhớ là mỗi lần mount layout (Directus `useMemoize` trong `useItems`), và nút làm mới có bỏ cache đếm không (Directus không)? [Ambiguity, Spec FR-023] (1)
- [x] CHK037 "Kéo đổi thứ tự cột" ở bảng: Directus `v-table` có hỗ trợ (`allowHeaderReorder`) hay chỉ đổi qua nút "+"? Nếu không có ở Directus thì là khác biệt cần mã D. [Ambiguity, Spec FR-031, research R4] (1)
- [x] CHK038 "`limit` 1000" của kanban và map, "giới hạn query của server hoặc 1000" của calendar: khi `queryLimit.max` nhỏ hơn 1000 thì kanban/map dùng gì (Directus kanban `layoutQuery.limit || 1000`, không cắt)? [Clarity, Spec FR-036 đến FR-038] (1)
- [x] CHK039 "Popup template khi rê" trên map và "bấm feature mở item (hoặc chọn)": với `selectMode` của drawer, bấm chọn thêm hay thay thế (`replace` khi không giữ Shift)? [Clarity, Spec FR-038, FR-029] (1)
- [x] CHK040 Tiêu đề tab của màn item: FR-051 ghi `<collection> | <tiêu đề>` (Directus), 012 FR-029 ghi `<tiêu đề trang> · <project>`; dạng cuối cùng (`bo_std | Title · Backoffice`) có được nêu? [Consistency, Spec FR-051, 012 FR-029] (2)
- [x] CHK041 "Lỗi khác hiện hộp thoại lỗi" ở lưu item: nội dung hộp (thông điệp `translateAPIError`, chi tiết, nút) có được quy định như `unexpectedError` của Directus? [Clarity, Spec FR-054, US2-4] (2)
- [x] CHK042 "Form chỉ đọc" khi không có quyền update: field vẫn mở menu "xem/chép giá trị thô"? nút lưu ẩn hay khóa? [Clarity, Spec FR-056, US2-8] (2)
- [x] CHK043 "Version global `draft` không đổi tên, không cho đặt key trùng": tạo version mới với key `draft` bị chặn bằng gì (nút khóa + tooltip `reserved_version_key`)? [Clarity, Spec FR-070] (2)
- [x] CHK044 "Chỉ hiện khác biệt" và "chọn field" của hộp so sánh: field không có khác biệt có chọn được không; mặc định chọn tất cả khác biệt? [Clarity, Spec FR-072, FR-081] (2)
- [x] CHK045 "Tab là `<tên collection> | <template>`" và "skeleton khi tải": skeleton của tiêu đề có kích thước/vị trí quy định ở recipe không? [Clarity, Spec FR-051, Q-8] (3)
- [x] CHK046 "Cuộn không rớt khung hình quá 100 ms" ở SC-011: cách đo (long task, `requestAnimationFrame`) có được nêu, hay nên bỏ vế này? [Measurability, Spec SC-011] (3)
- [x] CHK047 SC-003 chỉ có ngưỡng tuyệt đối trên runner chia sẻ (bài học benchmark: biến thiên hơn 10 % giữa các lần): có cần thêm tiêu chí tương đối với Directus app cùng kịch bản (constitution X, ≤ +10 %) không? [Clarity, Spec SC-003, FR-125] (3)
- [x] CHK048 "Mỗi thao tác gửi đúng một request danh sách (và không quá một request đếm khi điều kiện đếm đổi)": đổi trang có gửi request đếm không (Directus: không); sắp xếp: không; lọc: hai request đếm (`itemCount` thôi, `totalCount` chỉ khi `filterSystem` đổi)? [Clarity, Spec SC-003, FR-023] (3)
- [x] CHK049 "Bộ so payload chạy cùng kịch bản trên Directus app và app mới": spec FR-120 không nói chạy ở cấu hình nào; plan nói chỉ `proxy-api`. Spec có cần ghi? [Consistency, Spec FR-120, plan Testing] (4)
- [x] CHK050 SC-002 "0 lệch ngoài D-xx" khi so cây, cột, số đếm, trạng thái nút với Directus app: danh sách thuộc tính so (nhãn và thứ tự mục cây, header cột, chuỗi số đếm, `disabled` của từng nút) có được nêu để đo được? [Measurability, Spec SC-002] (4)
- [x] CHK051 Dòng "FR-085 đến FR-088: dự phòng", "FR-093, FR-094", "FR-104, FR-105" trong spec: có nên bỏ (013 để trống số, không ghi "dự phòng")? [Clarity, Spec Requirements] (4)

## Requirement Consistency

- [x] CHK052 Edge Cases nói popup bị chặn "về chế độ chia đôi"; Directus (`item.vue`) khi `window.open` trả null không có dự phòng (chế độ `popup` giữ, khung ẩn). Đây là khác biệt chưa có mã D hay phải sửa Edge Cases? [Conflict, Spec Edge Cases, FR-066] (2)
- [x] CHK053 Edge Cases nói thao tác hàng loạt "API trả lỗi theo khóa; lựa chọn giữ"; `DELETE /items/:c` và `PATCH {keys}` của Directus chạy trong transaction (tất cả hoặc không). Có mâu thuẫn? [Conflict, Spec Edge Cases, FR-095, FR-096] (2)
- [x] CHK054 FR-120 nói mở rộng seed trên `bo_std` (versioning, archive, `display_template`, `preview_url`); 013 có test component và snapshot trên `bo_std`. Có yêu cầu bảo đảm test 013 không đổi (dùng collection mới cho 014), hay chấp nhận cập nhật snapshot 013? [Consistency, Spec FR-120, data-model §9] (4)
- [x] CHK055 FR-004 (cây trong sub-menu sidebar) và 012 FR-020/L-3 "sub-menu một cấp": spec 012 hoặc `layout-patterns.md` §7 có cần sửa câu "một cấp" cho module Content (Q2)? [Consistency, Spec FR-004, 012 FR-020] (3)
- [x] CHK056 D-69 liệt kê "tay cầm live preview" nhưng FR-115 không; contracts/layouts §5 có; ba chỗ có khớp nhau không? [Consistency, Spec D-69, FR-115, contracts/layouts §5] (3)
- [x] CHK057 FR-039 nói geocoder Mapbox "thêm ô tìm địa điểm" nhưng FR-112 và contracts #66 chỉ nhắc tile/style; request `api.mapbox.com/geocoding` có trong danh sách đóng không? [Consistency, Spec FR-039, FR-112, contracts/api-calls #66] (1)
- [x] CHK058 Spec FR-053 `saveAsCopy` "như use-item" nhưng không nói dùng GraphQL (`POST /graphql`); contracts #93 có. FR-112 "chỉ API Directus ở contracts" có bao `/graphql` chưa (012 FR-072 không cấm)? [Consistency, Spec FR-053, FR-112, contracts #93] (2)
- [x] CHK059 SC-001 yêu cầu firefox và webkit cho cấu hình cùng origin như 012; với 11 spec Content và job `e2e-web` giới hạn 75 phút, có cần quy định tập con cho firefox/webkit? [Consistency, Spec SC-001, contracts/tests §3] (4)
- [x] CHK060 FR-029 nói drawer chọn item "panel option layout trong drawer như `drawer-collection.vue`"; 013 `BoDrawer` không có slot sidebar (layout-patterns §8 "Deviation: no sidebar slot"). Có mâu thuẫn hay cần mở rộng `BoDrawer`? [Conflict, Spec FR-029, 013 layout-patterns §8] (1)
- [x] CHK061 Spec FR-023 "chỉ gọi lại itemCount khi collection, filter, search đổi"; contracts/layouts §3 `refresh()` gọi "items + hai đếm". Nút làm mới gọi lại đếm có đi ngược FR-023? [Consistency, Spec FR-023, contracts/layouts §3, CHK036] (1)

## Acceptance Criteria Quality

- [x] CHK062 US1-3 "preset được lưu tự động sau 450 ms với cùng dạng Directus ghi": có mẫu body kỳ vọng (fixture) hay chỉ dựa vào bộ so payload? [Measurability, Spec US1-3, SC-004] (1)
- [x] CHK063 US3-1 "JSON lưu bằng với Directus (cùng khóa, cùng thứ tự)": thứ tự khóa trong JSON có phải tiêu chí (Directus `_and` mảng có thứ tự; khóa object không có thứ tự ngữ nghĩa)? [Clarity, Spec US3-1, SC-004] (1)
- [x] CHK064 SC-005 "request /items và layout_options ghi ra của mỗi layout trùng Directus (test component)": mốc Directus lấy từ đâu (fixture tay, hay ghi từ Directus app qua proxy)? [Measurability, Spec SC-005] (1)
- [x] CHK065 US5-5 "promote … tùy chọn xóa version sau promote": kết quả kiểm là dòng `directus_versions` biến mất và item chính đổi; có nêu cả activity `version_promote`? [Completeness, Spec US5-5] (2)
- [x] CHK066 SC-006 "100 % thao tác kéo thả có đường bàn phím kiểm trong test": danh sách thao tác kéo thả đóng (8 mục ở contracts/layouts §5) có được spec trỏ tới? [Measurability, Spec SC-006, FR-115] (3)
- [x] CHK067 SC-010 "D-67 đến D-73 được tech lead duyệt": D-69, D-73 đã duyệt (Q5); D-67, D-68, D-70, D-71, D-72 là hệ quả XI/D-40, có cần duyệt riêng không? [Clarity, Spec SC-010] (4)

## Scenario Coverage

- [x] CHK068 Có kịch bản cho đổi collection khi đang có lựa chọn, đang kéo thả, hoặc đang có request chưa về (hủy, xóa lựa chọn, không ghi preset nhầm collection)? [Coverage, Spec FR-022, FR-025] (1)
- [x] CHK069 Có kịch bản cho user chỉ có quyền đọc một phần field (`fields` không chứa field của preset role/global): cột bị bỏ, sắp xếp theo field không đọc được, bộ lọc trên field không đọc được (API 403)? [Coverage, Spec FR-103, FR-041] (1)
- [x] CHK070 Có kịch bản cho lưu item khi version bị xóa ở nơi khác, hoặc item chính bị xóa khi đang mở (403/404 khi lưu, hộp lỗi, giữ thay đổi)? [Coverage, Spec FR-054, FR-071] (2)
- [x] CHK071 Có kịch bản cho comment, share, version của item mới chưa lưu (`+`): sidebar ẩn hoàn toàn hay hiện rỗng? [Coverage, Spec FR-008] (2)
- [x] CHK072 Có kịch bản cho live preview khi URL đổi theo thay đổi chưa lưu (template dùng field đang sửa: Directus dùng dữ liệu đã lưu, không phải `edits`)? [Coverage, Spec FR-063] (2)
- [x] CHK073 Có kịch bản cho xuất khi `fields` của layout chứa field quan hệ lồng (`author.name`) và khi không có field nào (export rỗng bị chặn)? [Coverage, Spec FR-091] (2)
- [x] CHK074 Có kịch bản cho người dùng ở bookmark của role/global đổi layout rồi tạo bookmark mới (bản mới là của mình, `role` null)? [Coverage, Spec FR-012, FR-015] (1)
- [x] CHK075 Có kịch bản cho bàn phím trong cây collection (mũi tên, Enter mở nhóm, Esc đóng ô tìm) và cho ô tìm cây không khớp gì? [Coverage, Spec FR-004, FR-115] (3)

## Edge Case Coverage

- [x] CHK076 Có yêu cầu cho `?bookmark=` không phải số (`NaN`), bookmark của collection khác với `:collection` trong URL, và bookmark bị xóa ở tab khác? [Edge Case, Spec FR-016] (1)
- [x] CHK077 Có yêu cầu cho rời trang trước khi debounce 450 ms ghi preset (mất thay đổi, như Directus) và cho lỗi ghi preset (403, mạng: im lặng hay thông báo)? [Edge Case, Spec FR-011] (1)
- [x] CHK078 Có yêu cầu cho field sort (`sort_field`) không đọc được hoặc không update được: sắp xếp tay ẩn, kéo khóa? [Edge Case, Spec FR-032] (1)
- [x] CHK079 Có yêu cầu cho calendar khi field bắt đầu rỗng ở nhiều item (không hiện), và khi kéo sự kiện sang ngày mà field kết thúc trước field bắt đầu? [Edge Case, Spec FR-036] (1)
- [x] CHK080 Có yêu cầu cho map khi `cameraOptions.bbox` lưu ở preset không hợp lệ (ngoài phạm vi), và khi `clusterData` bật với feature kiểu đường/vùng? [Edge Case, Spec FR-038] (1)
- [x] CHK081 Có yêu cầu cho comment rất dài, nhiều mention, mention user đã bị xóa (`/users` trả thiếu), và xóa comment đang sửa? [Edge Case, Spec FR-082] (2)
- [x] CHK082 Có yêu cầu cho share với `date_end` đã qua hoặc `max_uses` đạt hiển thị trong danh sách (dấu hiệu hết hạn như `share-item.vue`) và cho chép link khi `navigator.clipboard` không có (HTTP không bảo mật)? [Edge Case, Spec FR-083] (2)
- [x] CHK083 Có yêu cầu cho import file rất lớn (quá `MAX_PAYLOAD_SIZE`/`FILES_MAX_UPLOAD_SIZE` → 413), import hủy giữa chừng, và import khi user mất quyền `create` sau khi mở? [Edge Case, Spec FR-090] (2)
- [x] CHK084 Có yêu cầu cho xuất tải về bị server từ chối vì vượt `queryLimit.max` dù spec khóa ở client (`-1` khi `max = -1`)? [Edge Case, Spec FR-091] (2)
- [x] CHK085 Có yêu cầu cho phiên hết hạn giữa chừng (401 khi lưu, khi tự lưu preset, khi làm mới định kỳ): 012 chọn "nhận ra khi refresh thất bại"; thay đổi chưa lưu có mất không? [Edge Case, Spec FR-054, FR-099, 012 FR-001] (2)

## Non-Functional Requirements

- [x] CHK086 Hiệu năng cây collection với hàng trăm collection và bookmark (render, ô tìm): có ngưỡng hay chấp nhận như Directus? [Gap, Spec FR-004] (3)
- [x] CHK087 Ngân sách bundle cho route Content (chunk chính + ≤ 60 KB theo plan) có ghi ở spec và `check-bundle.mjs` không, và chunk nào buộc phải lười (calendar, map, kanban, split panel, so sánh)? [Completeness, plan Performance Goals, research R14] (3)
- [x] CHK088 Bảo mật: iframe live preview nhúng URL do admin cấu hình (`preview_url`): thuộc tính `sandbox`/`allow` có được quy định sau khi đọc `live-preview.vue` ([Unverified] ở FR-069), và rủi ro chấp nhận như Directus có ghi ở Assumptions? [Security, Spec FR-069] (2)
- [x] CHK089 Bảo mật: HTML trong comment, tên bookmark (`$t:`), tiêu đề template (`RenderTemplate`) và nhãn nhóm kanban là dữ liệu người dùng: yêu cầu khử/escape có nêu cho từng chỗ (comment có; còn lại)? [Security, Spec FR-082, FR-013, FR-051, FR-037] (2)
- [x] CHK090 a11y: hộp thoại xác nhận (xóa, archive, hàng loạt, rời trang) có yêu cầu focus ban đầu vào nút an toàn (Hủy) và `aria-describedby` nội dung? [Gap, Spec FR-055, FR-057, FR-095] (3)
- [x] CHK091 i18n: chuỗi số đếm dùng `n()` theo locale, ngày nhóm revision/comment theo `date-fns_*` và `vi-VN`: có yêu cầu kiểm ở cả hai ngôn ngữ (E2E 012 chạy `en-US`)? [Coverage, Spec FR-024, FR-080, FR-111] (3)

## Dependencies & Assumptions

- [x] CHK092 `@directus/vue-split-panel` 0.8.9 và `json-to-graphql-query` chưa kiểm trên npm (giấy phép, ESM): có task kiểm sớm và phương án dự phòng đủ rõ (plan Complexity Tracking)? [Assumption, research R1, plan] (4)
- [x] CHK093 Giả định `use-items.ts` của 013 là bản chép đủ (`filterSystem`, memo đếm, abort) và sdk nhận `signal`: có task kiểm trước khi dựa vào (research R5)? [Assumption, research R5] (1)
- [x] CHK094 Giả định compose benchmark thêm được hai service web và seed 10 triệu dòng của 005 có collection phù hợp (field có index, `status`): có xác nhận với `seed-items.ts`? [Assumption, research R14, contracts/tests §5] (3)
- [x] CHK095 Giả định helper Directus app (`tests/directus-app-e2e/src/helpers/app.ts`) đủ cho 8 kịch bản payload (bộ lọc nâng cao, version, comment, share trên Directus app chưa có helper): có task viết thêm và ước lượng thời gian? [Assumption, contracts/tests §4] (4)
- [x] CHK096 Điều kiện bắt đầu (CI 013 xanh, khóa working tree) và quy tắc push (pull --rebase, không push khi CI khác chạy) có ghi trong plan/tasks để hai session cùng làm không giẫm nhau? [Assumption, plan Constraints, research R15] (4)
- [x] CHK097 Giả định chuỗi dịch `layouts.*` và các khóa sidebar đã sinh đủ: có task kiểm "0 missing key" trong E2E cho mọi màn mới (harness 012 đã chặn)? [Assumption, research R13] (3)

## Ambiguities & Conflicts

- [x] CHK098 "Nút làm mới gọi lại đếm" (contracts) và "memo đếm" (FR-023): nếu Directus trả số đếm cũ sau làm mới trong cùng phiên màn thì đó là hành vi tái tạo (R-xx) hay sửa? [Ambiguity, Spec FR-023, CHK036, CHK061] (1)
- [x] CHK099 "Màn hẹp 768 px: layout map và kanban dùng đủ bề rộng": kanban nhiều cột cuộn ngang trong khung hay trang? (FR-116 cấm cuộn ngang trang) [Ambiguity, Spec Edge Cases, FR-116] (3)
- [x] CHK100 "Đổi layout thì ghi vào preset của user (tạo mới nếu đang dùng preset role/global)": với bookmark role/global đang mở, đổi layout không tự lưu (FR-012) — hai câu có mâu thuẫn trong trường hợp bookmark? [Ambiguity, Spec US3-5, FR-012] (1)
- [x] CHK101 D-72 nói đích chuyển hướng là khung 012 "cho tới 015, 016, 018" nhưng `getSystemCollectionRoute` không có `directus_activity`? (có: `/activity`, 018) và `directus_dashboards` (`/insights`, 018): bảng FR-002 và D-72 có liệt kê đủ 10 collection? [Ambiguity, Spec FR-002, D-72] (4)

## Notes

- Đánh dấu `[x]` khi mục đã được xử lý (sửa spec/plan/contracts, hoặc ghi rõ "chấp nhận như Directus" với lý do).
- Mục có `[Conflict]` hoặc `[Security]` nên xử lý trước khi sinh tasks.md; mục `[Gap]` khác có thể ghi thành
  Assumption nếu chấp nhận.
- Nhãn (1) đến (4) là nhóm trọng tâm ở đầu file.
- 2026-10-15: owner duyệt toàn bộ lời giải ở [release-gate-proposals.md](./release-gate-proposals.md); đã áp vào spec
  (Edge Cases, FR-004b, FR-008, FR-009, FR-011, FR-013, FR-023, FR-024, FR-029 đến FR-033, FR-036 đến FR-038, FR-041,
  FR-044, FR-051, FR-053, FR-054, FR-054b, FR-056, FR-063 đến FR-072, FR-080 đến FR-084, FR-089 đến FR-091, FR-103,
  FR-110b, FR-110c, FR-112, FR-115 đến FR-115d, FR-120, FR-124, SC-001 đến SC-003, SC-005, SC-006, SC-011, SC-012,
  D-72, D-74, Assumptions), data-model §2, §9, contracts/tests §1, §3 đến §5, contracts/layouts §3, research R2, R4,
  R15. 101/101 mục xong. Mục cần kiểm trên code Directus là task T003 (CHK011, 019, 032, 037, 060, 088, 093) và T004
  (CHK036, đo trên Directus app) của lượt 1; `layout-patterns.md` §7 (CHK055) đã sửa ở 781dd25, spec 012 sửa ở T099.
- 2026-10-15 `/speckit.analyze`: 13 vấn đề (G1 singleton `bo_singleton` vào seed T023, A1 cách kiểm xuất ≥ 2500 ở T078,
  O1, O2, G2, U1, I1–I5, D1, CQ1) đã sửa vào tasks, plan, spec, research, contracts và file này.
