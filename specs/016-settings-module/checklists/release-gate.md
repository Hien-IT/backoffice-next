# Release-Gate Requirements Checklist: Module Settings (016)

**Purpose**: Kiểm tra chất lượng yêu cầu (đủ, rõ, nhất quán, đo được, phủ kịch bản) của spec, plan, research,
data-model và contracts trước khi sinh tasks.md và implement. Đây là "unit test cho yêu cầu", không phải test hành vi.
**Created**: 2026-10-16
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [contracts/](../contracts/)
**Trọng tâm**: (1) data model và DDL: drawer field, store và alteration, junction, xóa, lỗi giữa chừng; (2) quyền và ma
trận: policy, quyền tối thiểu, Public, quan hệ lồng, ranh giới admin; (3) dùng chéo và kiểm thử: SC-002, SC-003, bộ so
payload và DB, E2E ba cấu hình, hiệu năng, bundle; (4) UI, a11y, design-system: Q-20 đến Q-27, D-96, Project,
Appearance, presets, translations. **Độ sâu**: cổng phát hành (đủ edge case). **Người dùng checklist**: tác giả spec
(tự rà trước `/speckit.tasks`). Lời giải đề xuất ngắn cho từng mục ở
[release-gate-proposals.md](./release-gate-proposals.md).

## Requirement Completeness

- [x] CHK001 Có yêu cầu nêu nguồn ảnh xem trước của thẻ interface ở chế độ đơn giản (Directus `preview` SVG trong `index.ts`; registry 013 chỉ giữ ở vài interface) và cách hiện khi thiếu (icon thay thế)? [Gap, Spec FR-033, US3-1] (1)
- [x] CHK002 Có yêu cầu định nghĩa "db-safe" cho ô key collection, folder, field, khóa chính, junction (ký tự cho phép, chữ thường, thay khoảng trắng, độ dài tối đa) khi `BoInput` của 013 chưa có chế độ này? [Gap, Spec FR-014, FR-015, FR-033, FR-035] (1)
- [x] CHK003 Có yêu cầu cho tên collection hoặc field bắt đầu bằng `directus_` hoặc trùng từ khóa SQL (API từ chối: hiện lỗi ở đâu, drawer có còn mở)? [Gap, Spec Edge Cases, FR-015] (1)
- [x] CHK004 Có yêu cầu nêu điều gì xảy ra với collection con khi xóa một folder có con (`meta.group` của con: API gỡ, giữ trỏ tới folder đã xóa, hay chặn xóa)? [Gap, Spec FR-013, US1-5] (1)
- [x] CHK005 Có yêu cầu cho nội dung hộp xóa bảng chưa quản lý (DROP bảng thật, mất dữ liệu) khác hay giống hộp xóa collection thường? [Gap, Spec US1-3, FR-013] (1)
- [x] CHK006 Có yêu cầu cho cách báo người dùng biết bước nào của `save()` đã ghi khi một bước giữa chừng lỗi (R-40: drawer đóng), và cách dọn junction/collection đã tạo dở? [Gap, Recovery, Spec FR-041, R-40] (1)
- [x] CHK007 Có yêu cầu cho nhân bản field sang collection đã có field cùng tên (API 4xx: hộp lỗi, hộp nhân bản còn mở)? [Gap, Spec FR-024] (1)
- [x] CHK008 Có yêu cầu cho thoát drawer field (Esc, hủy, backdrop) khi đã sửa mà chưa lưu: hỏi `unsaved_changes` hay bỏ ngay như Directus? [Gap, Spec FR-030] (1)
- [x] CHK009 Có yêu cầu nêu nội dung file snapshot (cả response `{data}` hay chỉ `data`) và tên file khi tải nhiều lần? [Clarity, Spec FR-016] (1)
- [x] CHK010 Có yêu cầu cho kiểu và giá trị mặc định của `seedLanguages`, `createLanguagesCollection` trong drawer bật translations, và danh sách field đủ điều kiện (string/text, không khóa chính)? [Completeness, Spec FR-028] (1)
- [x] CHK011 Có yêu cầu cho drawer bật translations khi collection ngôn ngữ chọn đã tồn tại nhưng thiếu khóa chính `code`? [Gap, Spec FR-028] (1)
- [x] CHK012 Có yêu cầu nêu trạng thái nạp và lỗi nạp của danh sách collection, lưới field, danh sách role, danh sách policy, ma trận, trình sửa preset (skeleton, hộp lỗi, màn trống)? [Gap, Spec FR-017, FR-050, FR-056] (1)(2)(4)
- [x] CHK013 Có yêu cầu cho cách hiện lỗi API của từng `PATCH /fields/:c/:f` từ menu field (ẩn, bề rộng): hoàn tác lạc quan hay giữ? [Gap, Spec FR-023] (1)
- [x] CHK014 Có yêu cầu cho chặn sửa `parent` của role thành con hoặc cháu của chính nó (bộ lọc chỉ loại chính nó, tạo vòng)? [Gap, Spec US4-2, FR-052] (2)
- [x] CHK015 Có yêu cầu cho lỗi "phải còn ít nhất một admin" khi bỏ `admin_access` của policy cuối, xóa role/policy admin cuối, hoặc gỡ chính mình khỏi role admin (API có kiểm; app hiện gì)? [Gap, Exception, Spec FR-052, FR-055] (2)
- [x] CHK016 Có yêu cầu cho hộp `unsaved_changes` và phím tắt ở trang policy (FR-055 không nêu `use-edits-guard` như FR-052 của role)? [Gap, Spec FR-055] (2)
- [x] CHK017 Có yêu cầu cho lỗi xác thực của một permission trong `PATCH /policies/:id` lồng (API 400 với `path` trỏ tới dòng): hiện ở ma trận, ở drawer, hay chỉ hộp lỗi? [Gap, Exception, Spec FR-059] (2)
- [x] CHK018 Có yêu cầu cho ô JSON `presets` không hợp lệ trong drawer quyền (nút lưu khóa, thông báo)? [Gap, Spec US4-8] (2)
- [x] CHK019 Có yêu cầu nêu định dạng hợp lệ của `ip_access` (IP, CIDR, dải) và có kiểm ở client không? [Clarity, Spec US4-5] (2)
- [x] CHK020 Có yêu cầu cho ma trận khi policy là `+` (mới, chưa lưu) trên trang policy: bảng rỗng, thêm collection được không, `app_access` minimal hiện không? [Gap, Spec FR-056] (2)
- [x] CHK021 Có yêu cầu nêu Public role xử lý thế nào khi một trong ba request `/access` song song lỗi (đã ghi một phần) và giá trị form sau nạp lại? [Gap, Recovery, Spec FR-053] (2)
- [x] CHK022 Có yêu cầu cho trạng thái `/settings/roles/:id` khi role không tồn tại (404: màn không tìm thấy hay form rỗng)? [Gap, Spec FR-052] (2)
- [x] CHK023 Có yêu cầu nêu cách cô lập E2E sửa `directus_settings` (singleton dùng chung) với spec khác chạy song song trong cùng job (branding, `module_bar` đổi giữa chừng)? [Gap, Spec FR-100, data-model §15] (3)
- [x] CHK024 Có yêu cầu nêu thứ tự so payload cho request song song (ba request `/access`, hai `POST /relations` của `user_*`) để bộ so không đỏ vì thứ tự? [Gap, Spec FR-101, SC-005] (3)
- [x] CHK025 Có yêu cầu nêu vendor DB của SC-002, SC-003 (chỉ Postgres ở env parity) và có ghi rằng DDL trên vendor khác dựa vào parity 006? [Gap, Spec SC-002, Assumptions] (3)
- [x] CHK026 Có yêu cầu benchmark web hằng tuần cho Settings (như 014, 015) hay ghi rõ không cần? [Gap, Spec FR-108] (3)
- [x] CHK027 Có yêu cầu nêu focus đi đâu sau các hành động đổi màn (tạo collection → màn collection, xóa field, đóng drawer field, lưu preset → danh sách, xóa role)? [Gap, Spec FR-006, FR-106] (4)
- [x] CHK028 Có yêu cầu bàn phím cho lưới thẻ interface ở chế độ đơn giản (mũi tên giữa thẻ, Enter chọn, focus vào khung cấu hình chèn dưới hàng)? [Gap, Spec FR-033, FR-106] (4)
- [x] CHK029 Có yêu cầu nêu nội dung thông báo `aria-live` khi di chuyển collection/field bằng menu D-96 (ví dụ "đã chuyển X vào nhóm Y, vị trí 2/5")? [Clarity, Spec FR-106, D-96] (4)
- [x] CHK030 Có yêu cầu chế độ tối và `prefers-reduced-motion` cho phần bên thứ ba ở 016 (bản đồ `map` options, xem trước layout calendar/map trong trình sửa preset, kéo thả)? [Gap, Spec FR-106, US6-2] (4)
- [x] CHK031 Có yêu cầu cho xem trước layout trong trình sửa preset với collection 10 triệu dòng (giới hạn trang, không đếm toàn bảng)? [Gap, Spec FR-081] (3)(4)
- [x] CHK032 Có yêu cầu nêu cách hiện `mapbox_key` và các giá trị dạng bí mật trong form Project (hiện rõ như Directus hay che)? [Gap, Security, Spec US5-1] (4)
- [x] CHK033 Có yêu cầu cho URL của link `module_bar` (scheme `javascript:`, `data:`) và `report_bug_url`/`report_feature_url` khi hiện ở sidebar và sub-menu? [Gap, Security, Spec FR-074, FR-003] (4)
- [x] CHK034 Có yêu cầu cho trạng thái `system-owner` khi `project_owner` trống (dự án chưa đăng ký) và khi `POST /settings/owner` lỗi? [Gap, Spec FR-073] (4)
- [x] CHK035 Có yêu cầu cho Appearance khi đổi `default_appearance` của dự án mà user hiện tại có `appearance` riêng (giao diện có đổi ngay không)? [Gap, Spec US5-5, FR-071] (4)
- [x] CHK036 Có yêu cầu cho translations khi key đã có ở ngôn ngữ đó (`RECORD_NOT_UNIQUE`?) và khi key trùng khóa i18n có sẵn của app (ưu tiên nào)? [Gap, Spec FR-086] (4)

## Requirement Clarity

- [x] CHK037 "25 field và vạch" của `collections.yaml` ở FR-020 có khớp số dòng thực của yaml 11.17.4 (29 mục gồm vạch và 3 field ẩn)? [Clarity, Spec FR-020] (1)
- [x] CHK038 "Vào nhóm" của lưới field có nêu đích (group liền trước, group đang mở, hay chọn từ danh sách) như "vào folder liền trước" của cây collection? [Clarity, Spec FR-022, FR-012, D-96] (1)(4)
- [x] CHK039 "Bề rộng `fill` dừng ở…" và "ở lưới chỉ là nhãn" (research R3) có được nêu ở FR-021 để không hiểu `fill` khác `full` ở lưới? [Clarity, Spec FR-021, research R3] (1)
- [x] CHK040 Danh sách interface có `autoKey` (presentation, group) và quy tắc sinh key `<suffix>-<nanoid6>` có nêu `suffix` lấy từ đâu (phần sau `-` của id)? [Clarity, Spec FR-033] (1)
- [x] CHK041 "Chỉ áp response mới nhất" của `updateFields` có nêu khóa phân biệt (bộ đếm theo collection hay toàn cục) khi kéo hai collection khác nhau liên tiếp? [Clarity, Spec FR-022, data-model §5] (1)
- [x] CHK042 Câu Edge Case "`meta` bị ghi đè ngay sau bởi `update`" về `translations.ts:362` là quan sát đã kiểm hay suy luận (đánh [Unverified])? [Ambiguity, Spec Edge Cases, research R7] (1)
- [x] CHK043 Edge Case "Field `meta.system` trong collection người dùng (không có)" có diễn đạt rõ ý (không xảy ra, hay xảy ra khi nào)? [Clarity, Spec Edge Cases] (1)
- [x] CHK044 Thứ tự sáu bước của `save()` có nêu bước nào chạy tuần tự, bước nào song song (Directus `for…await` trong từng nhóm) để bộ so payload có mốc? [Clarity, Spec FR-041, US3-6] (1)(3)
- [x] CHK045 Mức "all" của chip và "chọn hết field → danh sách rõ" của drawer có nêu hệ quả: chọn hết field ở drawer làm chip thành "custom", không phải "all" (như Directus)? [Clarity, Spec FR-057, US4-8] (2)
- [x] CHK046 "Hàng app tối thiểu luôn được nối thêm" có nêu cách hiện khi policy đã có permission trùng collection/action với minimal (hai dòng hay gộp)? [Clarity, Spec Edge Cases, FR-057] (2)
- [x] CHK047 "Tạo bằng `POST /permissions` mảng minimal" có nêu khóa nào gửi (Directus gửi cả `system: true`?) để bộ so payload và DB khớp? [Clarity, Spec US4-5, research R5] (2)(3)
- [x] CHK048 SC-004 "14 nút" có liệt kê đủ 14 tên nút (danh sách hiện có 8 loại)? [Measurability, Spec SC-004] (3)
- [x] CHK049 SC-004 "tiêu đề và breadcrumb của 12 màn" có khớp số màn của phạm vi (collections, collection, roles, role, Public, policies, policy, project, appearance, presets, preset, translations, translation = 13)? [Measurability, Spec SC-004] (3)
- [x] CHK050 FR-108 "mở drawer field có sẵn dưới 300 ms sau `GET /fields/:c/:f`" có nêu mốc kết thúc (tab đầu vẽ xong, skeleton tắt)? [Clarity, Spec FR-108] (3)
- [x] CHK051 "Số request mỗi thao tác" của FR-108 có nêu cho drawer field, trang role, danh sách preset (hiện chỉ màn collection, kéo thả, trang policy)? [Completeness, Spec FR-108, SC-007] (3)
- [x] CHK052 Recipe Q-23 "chip ba mức với icon và màu" có nêu icon từng mức (Directus: `check`, `block`, `rule`?) và chữ sr-only? [Clarity, Spec Q-23, FR-106] (4)
- [x] CHK053 "Drawer field và drawer quyền chiếm toàn màn" ở 768 px có nêu cột tab dọc gập thành gì (tab ngang, menu)? [Clarity, Spec Edge Cases, Q-22] (4)
- [x] CHK054 Dòng "Backoffice" cuối sub-menu (D-95) có nêu là chữ tĩnh không dịch và không lấy `project_name`? [Clarity, Spec FR-003, D-95] (4)

## Requirement Consistency

- [x] CHK055 SC-002 "4 collection sinh" có khớp số collection mà 10 field của US3 sinh ra (comments, categories, junction categories, junction files, junction blocks, junction translations, languages: 7)? [Conflict, Spec SC-002, US3 Independent Test] (1)(3)
- [x] CHK056 SC-003 "5 permission" có khớp US4 Independent Test (read all, create custom, update custom; delete none, share none = 3 dòng)? [Conflict, Spec SC-003, US4] (2)(3)
- [x] CHK057 Sáu thao tác của SC-003 có khớp danh sách ở US4 Independent Test, FR-102 (b) và `contracts/tests.md` §5? [Consistency, Spec SC-003, FR-102] (2)(3)
- [x] CHK058 Danh sách màn axe ở FR-106 và SC-008 ("12 màn và 4 drawer/hộp") có khớp nhau và khớp CHK049? [Consistency, Spec FR-106, SC-008] (3)(4)
- [x] CHK059 Ngân sách chunk lười ở research R12 (drawer field 80 KB, ma trận 40 KB) có được nêu ở FR-109 (hiện chỉ nêu dữ liệu quyền 10 KB)? [Consistency, Spec FR-109, research R12] (3)
- [x] CHK060 FR-012 còn nhắc `swapThreshold 0.3` (chi tiết cài đặt) trong khi FR-022 không; có nên chuyển sang plan cho đồng nhất? [Consistency, Spec FR-012] (1)
- [x] CHK061 Bảng truy vết có FR-061 đến FR-063 trong dải US4 và FR-100 đến FR-115 trong US7; FR-001 đến FR-006 thuộc US1 nhưng phục vụ mọi story — có ghi rõ? [Traceability, Spec Truy vết] (3)
- [x] CHK062 Số thứ tự request contracts (#137–#177) có khớp danh sách FR-018, FR-029, FR-043, FR-054, FR-060, FR-077, FR-087 (mỗi request ghi một lần, không thiếu `PATCH /presets` batch, `PATCH /translations`)? [Consistency, contracts/api-calls, Spec FR-110] (3)
- [x] CHK063 Spec nói trình sửa preset "ba ô dùng chung component với `BookmarkAdd`" (FR-083) nhưng data-model §10 mô tả form cục bộ tám field; cách dùng chung có rõ (component con hay chỉ cùng interface)? [Consistency, Spec FR-083, data-model §10] (4)
- [x] CHK064 Ghi chú 014 "màn presets dùng lại layout options của 014" có khớp FR-081 (panel `layout-options-*` của layout đang xem trước)? [Consistency, Spec Input, FR-081] (4)
- [x] CHK065 FR-071 dùng `system-theme` với prop `appearance` nhưng `index.ts` của 015 chưa có option `appearance`; spec và plan có nêu phần mở rộng này? [Consistency, Spec FR-071, Assumptions] (4)
- [x] CHK066 Bộ mẫu `bo_s_role` là con của `bo-editor` (015): phụ thuộc chéo bộ mẫu có ghi ở Assumptions và có thứ tự seed? [Consistency, data-model §15, Spec FR-103] (3)

## Acceptance Criteria Quality

- [x] CHK067 SC-002 "mở được … và tạo được item điền đủ 10 field mà không sửa gì" có nêu giá trị điền cho từng field (đặc biệt m2a, translations, files) để đo được? [Measurability, Spec SC-002] (1)(3)
- [x] CHK068 SC-003 "cùng kết quả" có nêu đo bằng gì (HTTP status của request, DOM: nút khóa, field ẩn) cho từng thao tác? [Measurability, Spec SC-003] (2)(3)
- [x] CHK069 SC-005 có nêu danh sách kịch bản ghi cụ thể (bao nhiêu kịch bản, mỗi request ghi được kích hoạt ít nhất một lần)? [Measurability, Spec SC-005] (3)
- [x] CHK070 SC-006 "20 kịch bản mẫu" có liệt kê (10 localType × có/chưa có collection liên quan; presentation/group/standard không có collection liên quan)? [Measurability, Spec SC-006] (1)(3)
- [x] CHK071 SC-008 "đường bàn phím D-96 có test" có nêu phạm vi (cây collection, lưới field, `system-modules`, `system-fields`, options `list`)? [Measurability, Spec SC-008, D-96] (4)
- [x] CHK072 SC-010 có nêu ai duyệt R-40 đến R-42 (tech lead) và tiêu chí "duyệt" (ghi ở spec như 015 T103)? [Measurability, Spec SC-010] (3)

## Scenario Coverage

- [x] CHK073 Có kịch bản thay đổi schema đồng thời (admin khác hoặc Directus app tạo/xóa field khi màn collection đang mở; store cũ tới khi nạp lại)? [Coverage, Gap, Spec Edge Cases] (1)
- [x] CHK074 Có kịch bản hai admin sửa cùng policy hoặc cùng `directus_settings` ở hai app (ghi sau thắng, gộp lạc quan của store settings)? [Coverage, Gap] (2)(4)
- [x] CHK075 Có kịch bản mở `/settings/data-model/:collection/:field` trực tiếp bằng URL cho field không tồn tại (store `startEditing` khi không tìm thấy)? [Coverage, Gap, Spec FR-030] (1)
- [x] CHK076 Có kịch bản `?type=` không hợp lệ (ví dụ `?type=foo`) ở route field mới? [Coverage, Edge, Spec FR-027] (1)
- [x] CHK077 Có kịch bản sửa field có sẵn kiểu quan hệ (m2m có sẵn): tab Relationship khóa gì, đổi được `sort_field`, trigger? [Coverage, Spec FR-039, US3-7] (1)
- [x] CHK078 Có kịch bản collection hệ thống: thêm field người dùng vào `directus_users` (II cho phép) qua drawer, relation tới collection người dùng? [Coverage, Spec FR-019] (1)
- [x] CHK079 Có kịch bản user không admin gõ `/settings/...` sau khi mất quyền admin giữa phiên (module biến mất, route hiện gì)? [Coverage, Spec FR-061, Edge] (2)
- [x] CHK080 Có kịch bản policy gán trực tiếp cho user (không qua role) hiện ở trang policy (`users` list-m2m) và đếm ở danh sách? [Coverage, Spec US4-4, US4-5] (2)
- [x] CHK081 Có kịch bản chiều ngược của SC-002/SC-003 với dữ liệu Directus tạo mà app mới chưa hỗ trợ (interface extension, layout extension trong preset)? [Coverage, Spec FR-102 (c), Edge] (3)
- [x] CHK082 Có kịch bản trình sửa preset cho preset của user khác (scope user) và preset không có `bookmark` (preset layout tự lưu)? [Coverage, Spec US6-2] (4)

## Edge Case Coverage

- [x] CHK083 Có yêu cầu cho collection có tên dài hoặc ký tự Unicode (đã db-safe) trong cây và tiêu đề (`formatTitle`, cắt chữ)? [Edge Case, Spec FR-010] (1)(4)
- [x] CHK084 Có yêu cầu cho junction name đạt giới hạn độ dài tên bảng của DB (Postgres 63 ký tự) khi `${a}_${b}` dài? [Edge Case, Gap, Spec US3-5] (1)
- [x] CHK085 Có yêu cầu cho m2a khi danh sách `related_collections` rỗng (readyToSave sai?) và khi chọn singleton bằng cách gõ tay? [Edge Case, Spec FR-032, Edge Cases] (1)
- [x] CHK086 Có yêu cầu cho xóa field đang là `sort_field` hoặc `archive_field` của collection (form collection còn trỏ)? [Edge Case, Gap, Spec FR-025] (1)
- [x] CHK087 Có yêu cầu cho lưới 200 field khi kéo một field xa (cuộn tự động trong drawer/màn)? [Edge Case, Spec FR-108] (1)(4)
- [x] CHK088 Có yêu cầu cho ma trận khi collection có tên trùng sau `formatTitle` (tooltip phân biệt bằng id)? [Edge Case, Spec FR-056] (2)
- [x] CHK089 Có yêu cầu cho `module_bar` chứa id module trùng hoặc thiếu `settings` (khóa)? [Edge Case, Spec FR-074] (4)
- [x] CHK090 Có yêu cầu cho `custom_aspect_ratios`, `basemaps`, `storage_asset_presets` với giá trị sai (tỉ lệ 0, URL rỗng): kiểm ở client hay để API? [Edge Case, Spec US5-1] (4)
- [x] CHK091 Có yêu cầu cho translation `value` rất dài hoặc có cú pháp i18n (`{n}`, `@:`) khi gộp vào vue-i18n (lỗi biên dịch message)? [Edge Case, Spec FR-086] (4)

## Non-Functional Requirements

- [x] CHK092 Có yêu cầu nêu rõ ẩn module ở client không phải ranh giới bảo mật (API chặn người không admin ở mọi endpoint ghi của Settings)? [Security, Assumption, Spec FR-061] (2)
- [x] CHK093 Có yêu cầu cho mức tin cậy của `custom_css` và template `report_error_url` do admin nhập (chèn vào trang như Directus; không lọc)? [Security, Spec FR-071, FR-076] (4)
- [x] CHK094 Có yêu cầu tương phản cho chip quyền ba mức, mục mờ (collection ẩn), dòng "Backoffice" mờ ở chế độ sáng và tối (WCAG AA)? [Accessibility, Spec Q-23, Q-24, FR-106] (4)
- [x] CHK095 Có yêu cầu kích thước vùng chạm/nhấn tối thiểu cho tay kéo và nút menu dòng ở 768 px? [Accessibility, Gap, Spec FR-106] (4)
- [x] CHK096 Có yêu cầu hiệu năng cho ma trận khi policy có rất nhiều permission (ví dụ 300 collection × 5) và cho cây field của drawer quyền (quan hệ sâu)? [Performance, Spec FR-108] (2)(3)

## Dependencies & Assumptions

- [x] CHK097 Giả định API mới nhận quan hệ lồng trong `PATCH /roles|policies` (R6) có task kiểm trước khi code US4 và có đường xử lý nếu lệch (sửa API trong 016 hay feature khác)? [Assumption, Spec Assumptions, research R6] (2)
- [x] CHK098 Giả định `BoTabs` có hướng dọc (Reka Tabs `orientation`) có ghi là phần mở rộng của 016 (013 chưa có)? [Assumption, plan, research R8] (4)
- [x] CHK099 Giả định store collections của 012 có dòng hệ thống và fields có `meta.system` (R7) có task kiểm? [Assumption, research R2, R7] (1)
- [x] CHK100 Giả định hành vi Directus lấy từ đọc mã nguồn (research đầu file) có task chạy thử trên Directus app 8155 cho các luồng ghi DDL trước khi viết bộ so payload? [Assumption, research] (3)
- [x] CHK101 Phụ thuộc 015 (đóng, `UsersInvite` prop `role`, `use-folders`, `system-theme`) và điều kiện bắt đầu (FR-111) có task chặn đầu? [Dependency, Spec FR-111] (3)
- [x] CHK102 Fixture `directus-registry.json` có đủ 18 `_system` và 4 options component (R4 [Unverified]); nếu sinh lại thì test registry của 013 có đổi kỳ vọng nào khác? [Dependency, research R4] (1)

## Ambiguities & Conflicts

- [x] CHK103 FR-042 nói 18 interface; bảng Key Entities và FR-042 có liệt kê đủ 18 id giống nhau (không thiếu `system-collections`, `system-inline-fields` vốn chỉ đăng ký sẵn cho 017)? [Consistency, Spec FR-042, Key Entities] (1)
- [x] CHK104 Phạm vi "thông tin hệ thống" của mô tả feature được đáp ứng bằng gì (chỉ dòng "Backoffice" D-95, mục snapshot)? Có ghi rõ là thu hẹp so với mô tả? [Ambiguity, Spec Input, D-95] (4)
- [x] CHK105 "Giới hạn file" của mô tả feature (cài đặt dự án) ứng với field nào của `directus_settings` (Directus 11.17.4 không có field giới hạn dung lượng; `FILES_MAX_UPLOAD_SIZE` là env)? Có ghi rõ? [Ambiguity, Spec Input, US5] (4)

## Notes

- Đã áp toàn bộ đề xuất 2026-10-16 (owner chọn "áp toàn bộ"): spec (FR-007 mới, FR-003, FR-006, FR-012 đến
  FR-109, US1 đến US6, Edge Cases, Assumptions, SC-002 đến SC-010, Q-22, Q-23, R-40, truy vết), research (R13 mới,
  R2 đến R8), data-model (§5, §6, §10, §15), contracts (`tests.md` §3 đến §5, `components.md` §5b), plan. Mục còn [Unverified] kiểm ở T002, T004, T003; kết quả lệch thì T002 bỏ dấu `[x]` của mục đó cho tới khi spec sửa xong.

- Đánh `[x]` khi spec/plan/contracts đã sửa theo đề xuất (hoặc ghi lý do giữ nguyên) ở
  [release-gate-proposals.md](./release-gate-proposals.md).
- Số trong ngoặc cuối dòng là trọng tâm: (1) data model và DDL, (2) quyền và ma trận, (3) dùng chéo và kiểm thử, (4) UI,
  a11y, design-system.
- Chạy lại `/speckit.tasks` sau khi áp đề xuất.
