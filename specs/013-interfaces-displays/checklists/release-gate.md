# Release-Gate Requirements Checklist: Bộ interfaces và displays (013)

**Purpose**: Kiểm tra chất lượng yêu cầu (đủ, rõ, nhất quán, đo được, phủ kịch bản) của spec, plan và contracts
trước khi sinh tasks.md và implement. Đây là "unit test cho yêu cầu", không phải test hành vi.
**Created**: 2026-10-15
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [contracts/](../contracts/)
**Trọng tâm**: (1) đọc options và tương thích dữ liệu với Directus, (2) form, quan hệ và drawer, (3) giao diện,
design-system và a11y, (4) kiểm thử, bộ mẫu và phạm vi chuyển sang 014/015/016. **Độ sâu**: cổng phát hành (đủ edge
case). **Người dùng checklist**: tech lead duyệt khác biệt và reviewer trước merge.

## Requirement Completeness

- [x] CHK001 Có yêu cầu nêu rõ nguồn của "mặc định component Directus" cho từng khóa options (ví dụ bảng mặc định theo interface, hay quy ước "giá trị trong `defineProps` của file `.vue` Directus") để người làm không phải đoán? [Completeness, Spec FR-005, Edge Cases] (1)
- [x] CHK002 Có yêu cầu cho khóa options lạ (không thuộc interface) ngoài "bỏ qua": chúng có được rơi xuống DOM như attribute (hành vi `v-bind` của Vue) hay phải lọc? [Gap, Spec FR-005] (1)
- [x] CHK003 Có yêu cầu cho prop component-only của Directus không nằm trong form options (`list.limit`, `headerPlaceholder`, `placeholder`; `select-dropdown-m2o.selectMode`; `input.dbSafe`; `input-code.altOptions`; `list-m2m.junctionFilter`) không, hay chúng ngoài phạm vi? [Completeness, Spec FR-020, FR-037, FR-042, FR-044] (1)
- [x] CHK004 Có yêu cầu cho dạng giá trị phát ra của `tags`, `select-multiple-*`, `select-multiple-checkbox-tree` trên field kiểu `csv` (mảng như Directus app, API tự nối) không? [Gap, Spec FR-027, FR-031, FR-033, FR-034] (1)
- [x] CHK005 Có yêu cầu nêu định dạng chuỗi chính xác của `datetime` theo từng kiểu (`date` = `YYYY-MM-DD`, `time` = `HH:mm:ss`, `dateTime` không múi giờ, `timestamp` ISO UTC) thay cho "chuỗi ISO"? [Clarity, Spec FR-025, data-model §3] (1)
- [x] CHK006 Có yêu cầu cho hành vi khi giá trị Directus đã lưu ở định dạng cũ hoặc khác loại mong đợi (block editor `version` cũ, map lưu GeoJSON trong field string, `list` là chuỗi JSON) ngoài "hiện cảnh báo"? [Coverage, Spec Edge Cases] (1)
- [x] CHK007 Có yêu cầu cho `system-raw-editor` (ngôn ngữ, mustache, chỉ đọc, ép kiểu) ngoài việc nêu tên ở FR-004? [Gap, Spec FR-004, FR-017] (2)
- [x] CHK008 Có yêu cầu cho hành động bỏ chọn item trong o2m theo `relation.meta.one_deselect_action` (`nullify` hay `delete`) và quyền tương ứng (`use-relation-permissions.ts`)? [Gap, Spec FR-041, FR-043] (2)
- [x] CHK009 Có yêu cầu ánh xạ rõ quyền (`create`, `read`, `update`, `delete` trên collection liên quan và collection nối) sang từng nút (tạo mới, chọn có sẵn, sửa, bỏ chọn, xóa, sắp xếp) cho mỗi loại quan hệ? [Clarity, Spec FR-041, US3-5] (2)
- [x] CHK010 Có yêu cầu cho thứ tự ưu tiên giữa `sort`/`sortDirection` của option và `sortField` của quan hệ ở `list-o2m` (cả sắp ban đầu lẫn kéo thả)? [Clarity, Spec FR-043] (2)
- [x] CHK011 Có yêu cầu cho preset nào cấp cột cho drawer chọn item (user, role, global; bookmark bị bỏ) và cột khi preset chỉ có layout khác bảng? [Clarity, Spec FR-046, D-58] (2)
- [x] CHK012 Có yêu cầu cho hộp xác nhận của flow thủ công (`requireConfirmation`, form từ `options.fields`, nút hủy), thông báo kết quả, lỗi khi flow thất bại, và việc làm mới item sau khi flow chạy (Directus nạp lại item; 013 không có màn chứa)? [Gap, Spec FR-057, FR-058, research R10] (2)
- [x] CHK013 Có yêu cầu cho store flows khi user không có quyền đọc `directus_flows` (Directus trả danh sách rỗng, không gọi API) và khi `GET /flows` lỗi? [Gap, Spec Assumptions (flows), research R10] (2)
- [x] CHK014 Có yêu cầu cho tải file thất bại (quá `FILES_MAX_UPLOAD_SIZE` `413`, kiểu bị server từ chối, mạng), tiến độ tải, hủy tải, và tải nhiều file một phần thành công? [Gap, Spec FR-050, FR-052, FR-053] (2)
- [x] CHK015 Có yêu cầu nói rõ nguồn "danh sách kiểu được phép của server" (`/server/info` `files.mimeTypeAllowList`) và cách gộp với `allowedMimeTypes` của option? [Clarity, Spec FR-053] (1)
- [x] CHK016 Có yêu cầu cho `map` khi không có `defaultView` (vùng nhìn mặc định, vừa dữ liệu) và khi settings có `basemaps` lỗi (style không tải được)? [Gap, Spec FR-063] (2)
- [x] CHK017 Có yêu cầu cho `translations` khi collection ngôn ngữ trống, `languageField` trỏ field đã xóa, hoặc `defaultLanguage` không có trong danh sách? [Gap, Spec FR-048] (2)
- [x] CHK018 Có yêu cầu cho `collection-item-dropdown` khi `selectedCollection` đã bị xóa, là singleton hoặc user không có quyền đọc? [Gap, Spec FR-049] (2)
- [x] CHK019 Có yêu cầu cho template (interface quan hệ, display `related-values`) tham chiếu field mà user không được đọc hoặc field đã bị xóa? [Gap, Spec FR-041, FR-074] (2)
- [x] CHK020 Có yêu cầu cho trạng thái loading, empty và lỗi tải của từng danh sách quan hệ và drawer (không item, `403`, `500`)? [Gap, Spec FR-043 đến FR-047] (2)
- [x] CHK021 Có yêu cầu cho nhóm "Social" của `select-icon` (Directus vẽ bằng Font Awesome brands, không phải Material Symbols): bộ icon, giấy phép, cách hiện tên `social:*` đã lưu ở display `icon`? [Gap, Spec FR-035, FR-074, plan R1] (1)
- [x] CHK022 Có yêu cầu cho popover user của display `user` (dữ liệu nạp thêm bằng `GET /users/:id`, quyền đọc user khác)? [Gap, Spec FR-074, contracts/api-calls] (2)
- [x] CHK023 Có yêu cầu cho link tới item (`enableLink`, `related-values`, `header` link nội bộ) khi route đích còn là khung trống của 012 (D-40) cho tới 014? [Gap, Spec FR-078, D-40] (4)
- [x] CHK024 Có yêu cầu nêu ai là design owner duyệt recipe nháp Q-1 đến Q-12 và tiêu chí duyệt (ảnh so TailAdmin, bảng tương phản) trước khi đóng 013? [Completeness, Spec FR-093, Clarifications] (3)
- [x] CHK025 Có yêu cầu cho thứ tự task "recipe trước, code sau" khi một interface dùng nhiều thành phần chưa có mẫu (ví dụ `list-m2m` cần Q-10, Q-11, Q-1)? [Completeness, Spec FR-093, plan R6] (3)

## Requirement Clarity

- [x] CHK026 "Đọc được cấu hình hiện có" được định nghĩa đo được (mọi khóa ở FR-020 đến FR-079 có hiệu ứng kiểm được) hay còn hiểu là "không lỗi khi mở"? [Clarity, Spec SC-001, SC-003] (4)
- [x] CHK027 Danh sách khóa options ở FR-020 đến FR-079 có được coi là danh sách đóng để đếm SC-003 không, và cách xử lý khi `registry.test.ts` phát hiện khóa Directus không có trong spec? [Clarity, Spec SC-003, contracts/registry §3] (1)
- [x] CHK028 "Cùng dạng và kiểu JSON với Directus" ở FR-080 có nêu cách so (thứ tự khóa, số nguyên lớn dạng chuỗi, `null` so với thiếu khóa, `undefined` khi không thay đổi)? [Clarity, Spec FR-080, SC-002] (1)
- [x] CHK029 "Phần không ổn định" được bỏ khi so giá trị (`time`, `id` block, HTML do trình duyệt chuẩn hóa) có là danh sách đóng không? [Clarity, Spec Assumptions, SC-002] (4)
- [x] CHK030 FR-019 "chế độ batch" có nêu field nào được bật batch (bỏ khóa chính, alias, quan hệ?) và giá trị khi bật là `schema.default_value` hay giá trị chung của các item? [Clarity, Spec FR-019, FR-046] (2)
- [x] CHK031 FR-013 nhắc `$version` trong ngữ cảnh điều kiện, trong khi versions thuộc 014 (D-55): giá trị `$version` ở 013 là gì? [Clarity, Spec FR-013, D-55] (2)
- [x] CHK032 FR-062 "khử HTML" cho block editor có nêu danh sách thẻ được giữ (bằng cấu hình DOMPurify của `sanitize.ts`), đặc biệt với tool `raw`? [Clarity, Spec FR-062] (1)
- [x] CHK033 "Thư viện có giấy phép tương thích dùng thương mại" (FR-064) có liệt kê giấy phép chấp nhận (MIT, Apache-2.0, BSD, ISC, MPL-2.0 cho công cụ test) và loại trừ (GPL)? [Clarity, Spec FR-064, plan R1] (1)
- [x] CHK034 SC-005 "mọi interface thao tác được chỉ bằng bàn phím" có danh sách thao tác chính cho mỗi interface để đo, hay chỉ nguyên tắc chung? [Measurability, Spec SC-005, FR-094] (3)
- [x] CHK035 FR-094 "kéo đổi thứ tự có cách thay bằng phím" có nêu cách cụ thể (mục menu lên/xuống, phím tắt) và nhãn dịch? [Clarity, Spec FR-094, plan R1] (3)
- [x] CHK036 FR-095 "overrides settings áp lên mọi interface" có nêu phần nào của editor bên thứ ba (nội dung iframe TinyMCE, CodeMirror, nút MapLibre) phải theo theme sáng/tối? [Clarity, Spec FR-095, plan R7] (3)
- [x] CHK037 Bề rộng drawer (Q-10), số cột lưới form ở 768 px (`half` thành `full`?) có được nêu cho màn hẹp không? [Clarity, Spec FR-011, Edge Cases (768 px), Q-1, Q-10] (3)
- [x] CHK038 Trong `contracts/api-calls.md` dòng #34 ("`meta`? không") và trong `contracts/registry.md` ("`setFieldValue`... dùng ở `header`? không") còn câu bỏ dở: có cần viết lại cho rõ? [Ambiguity, contracts] (4)

## Requirement Consistency

- [x] CHK039 FR-040 nói "khi xem phiên bản nội dung thì như Directus" trong khi D-55 dời màn versions sang 014: yêu cầu có mâu thuẫn hay cần ghi "nhận prop `version`, chưa có màn"? [Conflict, Spec FR-040, D-55] (4)
- [x] CHK040 FR-120 nói 39 file test Directus, gồm 8 file của `_system` mà D-57 dời sang 015/016: con số và phạm vi port có nhất quán? [Conflict, Spec FR-120, FR-004, D-57] (4)
- [x] CHK041 Plan R1 bỏ `jsonlint-mod` (báo lỗi JSON bằng `JSON.parse`): thông điệp và vị trí lỗi khác Directus mà chưa có mã D-xx; có cần ghi khác biệt hoặc giữ thư viện? [Conflict, Spec FR-028, plan R1] (1)
- [x] CHK042 Plan R1 bỏ `vue-virtual-scroller` cho `select-icon` (dùng `content-visibility`): có ảnh hưởng hành vi nhìn thấy (cuộn, nhảy tới nhóm) cần ghi D-xx không? [Consistency, Spec FR-035, plan R1] (3)
- [x] CHK043 FR-081 liệt kê request ra ngoài (autocomplete, tile, embed) nhưng `contracts/api-calls.md` không có embed (iframe YouTube, Vimeo) và geocoder/style Mapbox khi có `mapbox_key`: hai nơi có khớp? [Consistency, Spec FR-081, contracts/api-calls #43, #44] (1)
- [x] CHK044 FR-054 không có `PATCH /files/:id`, `contracts/api-calls.md` có dòng #46 ghi "013 không gọi": có nên bỏ dòng này khỏi contract để tránh hiểu nhầm? [Consistency, Spec FR-054, contracts/api-calls #46, D-59] (4)
- [x] CHK045 FR-094 (cách thay kéo thả bằng phím) là hành vi Directus không có: có cần ghi vào bảng khác biệt theo Nguyên tắc X ("mọi khác biệt")? [Consistency, Spec FR-094, Khác biệt] (3)
- [x] CHK046 Edge case "Field nhóm có `meta.interface` null" để "đo ở bước plan", plan R3 lại để "đo ở đợt A": yêu cầu cuối cùng (giống Directus hay rơi về `group-raw`) có được chốt trước khi chia task? [Ambiguity, Spec Edge Cases, plan R3] (2)
- [x] CHK047 `datetime.use24` mặc định `true` ở interface nhưng `false` ở display: hai mặc định khác nhau có được nêu ở cả FR-025 và FR-074, không chỉ ở Edge Cases? [Consistency, Spec FR-025, FR-074, Edge Cases] (1)
- [x] CHK048 Spec nhắc phiên bản thư viện (FR-064) trong khi checklist requirements.md ghi "không có chi tiết hiện thực": lý do ngoại lệ có đủ rõ để reviewer không yêu cầu bỏ? [Consistency, Spec FR-064, checklists/requirements.md Notes] (4)
- [x] CHK049 Lời giải Q-C (miễn kiểm màu thô cho hằng màu dữ liệu) đang là mặc định chưa được owner xác nhận: spec, plan (Constraints) và `check-raw-colors` có cùng một danh sách hằng? [Consistency, Spec Clarifications Q-C, plan Constraints] (3)
- [x] CHK050 Bảng truy vết US/FR/SC có phủ FR-001 đến FR-006 (US1, US2, US7) và FR-037 đúng story (US5 repeater)? [Traceability, Spec Truy vết] (4)

## Acceptance Criteria Quality

- [x] CHK051 SC-002 dựa trên "giá trị mong đợi viết tay từ hành vi Directus" (`expected.<interface>.json`): có yêu cầu về cách lập và người duyệt các giá trị này, để test không chỉ kiểm lại giả định của chính mình? [Measurability, Spec SC-002, data-model §6] (4)
- [x] CHK052 SC-001 trừ field dùng interface `_system`: bộ mẫu có field như vậy không, và nếu không thì câu trừ có cần thiết? [Clarity, Spec SC-001, D-57] (4)
- [x] CHK053 SC-004 "dưới 1 giây" có nêu điều kiện đo (máy CI, chromium, sau khi dữ liệu đã nạp, lần đầu hay lần thứ hai) và chính sách thử lại (plan nói 2 lần) có được đưa vào spec? [Measurability, Spec SC-004, contracts/tests §6] (4)
- [x] CHK054 SC-005 axe "0 vi phạm serious/critical" có nêu cách xử lý ngoại lệ từ thư viện bên thứ ba (TinyMCE, MapLibre) không sửa được? [Measurability, Spec SC-005, FR-122] (3)
- [x] CHK055 SC-003 "ít nhất một test đọc giá trị đã lưu và kiểm hiệu ứng" có định nghĩa "hiệu ứng" cho khóa chỉ ảnh hưởng thẩm mỹ (`font`, `bordered`, `iconLeft`)? [Measurability, Spec SC-003] (4)
- [x] CHK056 Có tiêu chí đóng 013 cho phần thiết kế (recipe nháp đã duyệt, bảng Q chuyển "Đóng") được ghi như một SC hoặc điều kiện Done? [Gap, Spec FR-093, Q-1 đến Q-12] (3)
- [x] CHK057 US7-3 (seed ở hai API ra cùng bản xuất) có SC tương ứng, hay chỉ nằm ở contracts/tests §7? [Traceability, Spec US7, SC] (4)

## Scenario Coverage

- [x] CHK058 Kịch bản tạo mới (`primaryKey = '+'`) có được nêu cho từng nhóm (mặc định, PK chỉ đọc, nút flow khóa, quan hệ chưa có PK cha khi lọc o2m)? [Coverage, Spec FR-012, FR-015, FR-057, FR-043] (2)
- [x] CHK059 Kịch bản lồng nhiều cấp (drawer item trong drawer item, m2o trong translations, o2m trong m2m) có yêu cầu về cách gom thay đổi và giới hạn độ sâu? [Coverage, Spec FR-040, FR-046] (2)
- [x] CHK060 Kịch bản lỗi validation trả về cho field lồng (`translations` dạng `field.lang.subfield`, quan hệ trong drawer) ngoài translations có được nêu? [Coverage, Spec FR-018, FR-048] (2)
- [x] CHK061 Kịch bản đổi ngôn ngữ giao diện khi form đang mở (nhãn, ghi chú `$t:`, định dạng ngày của display relative) có yêu cầu? [Coverage, Spec FR-006, FR-075] (1)
- [x] CHK062 Kịch bản `direction: rtl` có được nêu cho editor (TinyMCE `directionality`, CodeMirror, markdown), map và lưới form? [Coverage, Spec FR-019] (3)
- [x] CHK063 Kịch bản user chỉ có quyền đọc (form `disabled`) có được nêu cho interface quan hệ và file (ẩn nút, vẫn xem lớn, vẫn tải xuống)? [Coverage, Spec FR-012, FR-041, FR-050] (2)
- [x] CHK064 Kịch bản `nonEditable` (Directus dùng cho so sánh, D-55) có yêu cầu ở 013 hay chỉ là prop truyền qua? [Coverage, Spec D-55, contracts/registry §1] (2)

## Edge Case Coverage

- [x] CHK065 Màu dữ liệu tương phản thấp (chip `labels` nền nhạt chữ nhạt, `formatted-value` màu chữ trùng nền tối): có yêu cầu a11y riêng hay chấp nhận như Directus và ghi ngoại lệ axe? [Edge Case, Spec Edge Cases (màu dữ liệu), FR-095, SC-005] (3)
- [x] CHK066 Giá trị rất dài (chuỗi 10.000 ký tự trong `formatted-value`, mảng 500 tags, 1.000 lựa chọn `select-dropdown`) có giới hạn hiển thị hoặc yêu cầu hiệu năng? [Edge Case, Gap] (3)
- [x] CHK067 `list-o2m-tree-view` nạp toàn bộ cây (`limit -1`): có yêu cầu cho cây lớn (ví dụ 5.000 nút) theo quy mô thiết kế của constitution X? [Edge Case, Spec FR-047, Constitution X] (2)
- [x] CHK068 Drawer chọn item trên collection rất lớn (constitution X: tới 10 triệu bản ghi): đếm `aggregate[count]`, tìm kiếm, phân trang có yêu cầu thời gian phản hồi hoặc hành vi khi chậm? [Edge Case, Spec FR-046, Constitution X] (2)
- [x] CHK069 Giá trị số biên (bigInteger vượt `Number.MAX_SAFE_INTEGER`, decimal nhiều chữ số, float `NaN`) có yêu cầu cho `input`, `slider`, display `formatted-value`? [Edge Case, Spec FR-020, FR-026, FR-076] (1)
- [x] CHK070 Múi giờ (`tz` không hợp lệ, trình duyệt khác múi giờ server, giờ chuyển mùa) có yêu cầu cho `datetime` interface và display? [Edge Case, Spec FR-025, FR-074] (1)
- [x] CHK071 Hai field cùng dùng `{{ field }}` trong `filter` mà field nguồn đổi sau khi đã chọn item: yêu cầu có nêu là giữ hay xóa lựa chọn không còn khớp? [Edge Case, Spec FR-041] (2)
- [x] CHK072 Giá trị trùng trong `files`/`m2m` khi `allowDuplicates` tắt mà dữ liệu Directus đã có trùng: hành vi hiển thị và sửa? [Edge Case, Spec FR-044] (2)

## Non-Functional Requirements

- [x] CHK073 Có yêu cầu bảo mật cho menu "xem/chép giá trị thô" trên field `masked` và `hash` (FR-066 nói không đưa ra DOM, FR-017 cho chép giá trị thô)? [Security, Conflict, Spec FR-017, FR-066] (1)
- [x] CHK074 Có yêu cầu cho HTML lưu trong `input-rich-text-html` khi hiển thị lại ở editor (script, `on*` attribute trong dữ liệu do người khác ghi) ngoài "giữ nguyên như Directus"? [Security, Spec FR-060, FR-065] (1)
- [x] CHK075 `imageToken` (token tĩnh nhúng vào URL ảnh trong nội dung) có được ghi là rủi ro chấp nhận như Directus và cảnh báo cho admin? [Security, Assumption, Spec FR-060, FR-061] (1)
- [x] CHK076 `input-autocomplete-api` gửi chữ người dùng gõ tới URL bên ngoài: có yêu cầu về dữ liệu gửi đi (không cookie, không header phiên) và thông báo cho admin? [Security, Spec FR-023, Edge Cases] (1)
- [x] CHK077 TinyMCE 6.8.6 hết bảo trì [Unverified ở plan]: có yêu cầu theo dõi CVE (pnpm audit, Dependabot) và điều kiện xem lại? [Security, Dependency, plan Complexity Tracking] (1)
- [x] CHK078 Có yêu cầu kích thước tải (chunk editor nặng chỉ tải khi cần, ngân sách bundle chính) ở spec, hay chỉ ở plan R12? [Performance, Gap, plan R12] (3)
- [x] CHK079 Tile OpenStreetMap mặc định: có yêu cầu ghi công (attribution) và tuân chính sách dùng tile của OSM (giới hạn lưu lượng) cho triển khai thật? [Compliance, Gap, Spec FR-063, Assumptions] (1)
- [x] CHK080 Có yêu cầu a11y cho editor bên thứ ba (TinyMCE, Editor.js, CodeMirror, MapLibre): nhãn liên kết, focus trap, thoát bằng phím, hay chấp nhận như thư viện và ghi ngoại lệ? [Accessibility, Spec FR-092, FR-094] (3)
- [x] CHK081 Có yêu cầu `prefers-reduced-motion` cho thành phần mới (accordion, drawer, tabs, bản đồ bay tới vị trí)? [Accessibility, Gap, Spec FR-092] (3)

## Dependencies & Assumptions

- [x] CHK082 Bộ mẫu cần kiểu `geometry.*` (PostGIS): giả định "seed chạy trên Postgres có PostGIS của `tests/parity`" và hành vi khi vendor khác (SQLite không có geometry gốc) có được ghi? [Dependency, Spec FR-100, data-model §6] (4)
- [x] CHK083 Giả định "user collection không dùng interface `_system`" (D-57 chỉ ảnh hưởng `directus_*`) đã được kiểm (Directus ẩn `system: true` khỏi bộ chọn) và ghi vào spec? [Assumption, Spec D-57] (4)
- [x] CHK084 Những việc 013 chuyển sang 014 (màn item, E2E ba cấu hình, so payload với Directus app, layout drawer theo preset, `unsaved_changes` ở màn chứa) đã được ghi ở nơi 014 sẽ đọc (SPECKIT-GUIDE prompt 014 hoặc D-40, D-55, D-58)? [Dependency, Spec Clarifications Q-A, D-58] (4)
- [x] CHK085 Những việc chuyển sang 015 (D-57 phần user, D-59 chỉnh ảnh) và 016 (D-56, D-57 phần còn lại) đã được ghi ở prompt hoặc bảng của các feature đó? [Dependency, Spec D-56, D-57, D-59] (4)
- [x] CHK086 Giả định các gói `[Unverified]` (`@directus/utils` 13.4.1 chạy trong trình duyệt, `@vitest/browser` 3.2.4, coverage v8 ở browser, WebGL cho MapLibre) có phương án dự phòng ghi trong spec hoặc plan và điều kiện chọn dự phòng? [Assumption, plan R1, R7, R8] (4)
- [x] CHK087 Thành phần `Bo*` Tier 1 của 012 (`BoSelect`, `BoInput`, `BoMenu`, `BoDialog`) có được giả định mở rộng (đa chọn, icon, nhóm) mà không làm hỏng màn 012; yêu cầu tương thích ngược có được ghi? [Dependency, plan R6] (3)
- [x] CHK088 Thứ tự với 012: 013 chỉ implement khi CI 012 xanh (thỏa thuận giữa hai session) có cần ghi vào plan như điều kiện bắt đầu? [Dependency, Gap] (4)

## Ambiguities & Conflicts

- [x] CHK089 `formatted-json-value.handler` của Directus gọi `render()` ngược thứ tự tham số (plan R4: chép nguyên, ghi R-xx): quyết định "tái hiện lỗi" đã được owner duyệt cho FE như quy tắc R-xx của BE chưa? [Ambiguity, plan R4] (1)
- [x] CHK090 `select-radio` gợi ý display `badge` không tồn tại: ngoài Edge Cases, có cần quy định danh sách `recommendedDisplays` giữ nguyên (cho 016) hay lọc id không có? [Ambiguity, Spec Edge Cases, FR-001] (1)
- [x] CHK091 Tên thành phần trong plan (`BoTextOverflow` ở contracts/registry §2) không có trong danh sách component của plan: có thiếu hay đổi tên? [Ambiguity, plan Project Structure, contracts/registry §2] (4)

## Notes

- 2026-10-15: owner duyệt toàn bộ lời giải ở [release-gate-proposals.md](./release-gate-proposals.md); đã áp vào spec,
  plan, research, contracts và `SPECKIT-GUIDE.md` (prompt 014, 015, 016). 91/91 mục xong.

- Đánh dấu `[x]` khi mục đã được xử lý (sửa spec/plan/contracts, hoặc ghi rõ "chấp nhận như Directus" với lý do).
- Mục có `[Conflict]` hoặc `[Security]` nên xử lý trước khi sinh tasks.md; mục `[Gap]` khác có thể ghi thành
  Assumption nếu chấp nhận.
- Nhãn (1) đến (4) là nhóm trọng tâm ở đầu file.
