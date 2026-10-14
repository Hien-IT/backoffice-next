# Đề xuất lời giải: release-gate 013

Ngày 2026-10-15. Mỗi dòng là đề xuất cho một mục của [release-gate.md](./release-gate.md); khi owner duyệt, sửa
spec/plan/contracts theo cột "Sửa ở" và đánh dấu `[x]`. Dòng có [Unverified] dựa trên kiến thức chưa kiểm lại
trong repo (giấy phép gói chưa cài trong `directus/node_modules`).

Quy ước chung đề xuất: chỗ nào Directus đã có hành vi thì **làm như Directus** (Nguyên tắc VI), chỉ ghi thêm vào
spec cho rõ; khác biệt mới chỉ khi a11y hoặc constitution buộc.

## Phần 1. Mục Conflict và Security (ưu tiên)

| Mục | Vấn đề | Đề xuất | Sửa ở |
|-----|--------|---------|-------|
| CHK039 | FR-040 nói "khi xem phiên bản thì như Directus" nhưng màn versions ở 014 (D-55) | Viết lại: interface quan hệ nhận prop `version` và xử lý như composable Directus (giá trị là mảng khóa khi có version), vì code chép đã có; kiểm bằng unit test; màn chọn và so sánh version ở 014 | FR-040, D-55 |
| CHK040 | FR-120 đếm 39 file, gồm 8 file `_system` đã dời (D-57) | Sửa thành 31 file: 25 của `interfaces/` (không tính `_system`) và 6 của `displays/` (đếm bằng `find` ngày 2026-10-15); 8 file `_system` đi cùng D-57 sang 015/016; `system-raw-editor` không có test Directus, viết test mới | FR-120, contracts/tests §4 |
| CHK041 | Plan bỏ `jsonlint-mod` → thông báo lỗi JSON khác Directus mà không có mã D | Giữ `jsonlint-mod` 1.7.6 như Directus (MIT [Unverified]); bỏ ý "dùng `JSON.parse`" ở research R1; không cần D | research R1, plan Dependencies |
| CHK042 | Plan bỏ `vue-virtual-scroller` cho `select-icon` (dùng `content-visibility`) | Giữ `vue-virtual-scroller` 2.0.0-beta.8 như Directus (MIT [Unverified]); chép nguyên `select-icon.vue`; bỏ `shortcut:` ở R1 | research R1 |
| CHK043 | FR-081 và contract lệch nhau về request ra ngoài | Liệt kê đóng ở cả hai: URL của `input-autocomplete-api`; tile `basemaps` hoặc OpenStreetMap; glyph `https://fonts.openmaptiles.org/...` (style gốc của Directus `basemap.ts`); style và geocoder Mapbox khi có `mapbox_key`; iframe embed của block editor (tool `embed`) và media của rich text | FR-081, contracts/api-calls #43–#44 |
| CHK044 | Contract có `PATCH /files/:id` (#46) "013 không gọi" | Xóa dòng #46; ghi nó ở D-59 (015) | contracts/api-calls |
| CHK045 | Cách thay kéo thả bằng phím (FR-094) là hành vi Directus không có | Thêm **D-60**: mục "Lên", "Xuống" trong menu dòng của danh sách kéo thả được (list, files, o2m, m2m, m2a, collection-item-multiple, tree view); lý do WCAG 2.1.1 (mức A) và Nguyên tắc XII; loại "khác"; chuỗi dịch overlay `en-US`/`vi-VN` | Khác biệt, FR-094 |
| CHK046 | Nhóm `meta.interface` null: spec để "đo ở plan", plan để "đo ở đợt A" | Chốt quy tắc ngay: làm **giống Directus** theo kết quả đo; task đầu đợt A đo trên Directus app (profile `app`) và ghi vào Edge Cases; khác Directus chỉ khi Directus ném lỗi chặn cả form (khi đó rơi về `group-raw` và ghi D-xx) | Edge Cases, plan R3 |
| CHK047 | `use24` mặc định khác nhau giữa interface và display chỉ nằm ở Edge Cases | Ghi rõ ở FR-025 (`use24` true) và FR-074 (`use24` false); giữ dòng Edge Cases | FR-025, FR-074 |
| CHK049 | Danh sách hằng màu miễn kiểm (Q-C) có thể lệch giữa spec, plan, tool | Một nguồn duy nhất: danh sách miễn trong `tools/check-raw-colors.mjs` (đường dẫn file + tên hằng); spec và plan chỉ trỏ tới đó | Q-C, plan Constraints |
| CHK073 | FR-066 nói không đưa giá trị masked/hash ra DOM; FR-017 cho xem/chép giá trị thô | Theo Directus: `masked` chỉ che khi hiển thị (giá trị là dữ liệu user đã được đọc qua API); menu "xem/chép giá trị thô" giữ như Directus. `input-hash` không đặt giá trị đã lưu vào ô nhập, nhưng menu giá trị thô hiện đúng chuỗi API trả (hash đã băm, không phải mật khẩu). Viết lại FR-066 cho đúng phạm vi này; không D | FR-066, FR-017 |
| CHK074 | HTML lưu trong rich text có thể chứa script khi mở lại | Cấu hình TinyMCE giống Directus (`extended_valid_elements`, `convert_urls: false`...), dựa vào lọc XSS sẵn có của TinyMCE 6 [Unverified mặc định bật]; hiển thị ở bảng qua `formatted-value` đã khử HTML (FR-074); ghi rủi ro chấp nhận như Directus | FR-060, Assumptions |
| CHK075 | `imageToken` nhúng token tĩnh vào URL ảnh | Rủi ro chấp nhận như Directus (admin tự chọn); ghi vào Assumptions | Assumptions |
| CHK076 | Autocomplete gửi chữ người dùng gõ tới URL ngoài | Như Directus (axios không gửi cookie khác origin): URL ngoài gọi bằng `fetch` với `credentials: 'omit'`, không header phiên; URL bắt đầu bằng `/` qua sdk; ghi Assumptions | FR-023 |
| CHK077 | TinyMCE 6.8.6 hết bảo trì [Unverified] | Theo dõi bằng `pnpm audit` và Dependabot có sẵn trong CI; xem lại khi Directus nâng TinyMCE hoặc có advisory mức high (cùng quy tắc với stream-json ở 010) | plan Complexity Tracking |
| CHK079 | Ghi công và chính sách tile OpenStreetMap | Hiện attribution `© OpenStreetMap contributors` như `basemap.ts`; tài liệu triển khai ghi: dùng nhiều thì đặt `basemaps` riêng trong settings (trách nhiệm người vận hành, như Directus) | FR-063, Assumptions |
| CHK089 | `formatted-json-value.handler` của Directus gọi `render()` ngược thứ tự | Áp quy tắc owner đã chọn ở BE (004): **tái hiện và ghi R-xx** cho FE; R-xx ghi khi đóng 013 | plan R4, spec (khi đóng) |

## Phần 2. Các mục còn lại

| Mục | Đề xuất | Sửa ở |
|-----|---------|-------|
| CHK001 | Nguồn mặc định = giá trị mặc định trong `defineProps`/`withDefaults` của file `.vue` Directus; khi component không có thì lấy `schema.default_value` của option; file chép giữ nguyên các mặc định này | FR-005 |
| CHK002 | Như Directus: không lọc; khóa lạ rơi xuống phần tử gốc như attribute (hành vi Vue) | FR-005 |
| CHK003 | Ngoài phạm vi: chỉ khóa lưu trong `meta.options` được đọc; prop component-only chỉ chép khi component khác của 013 truyền vào (hiện không có) | Assumptions |
| CHK004 | Field `csv`: phát mảng như Directus app; API nối thành chuỗi (`cast-csv`) | FR-027, FR-031, FR-033, FR-034 |
| CHK005 | Ghi dạng: `date` `YYYY-MM-DD`, `time` `HH:mm:ss`, `dateTime` `YYYY-MM-DDTHH:mm:ss`, `timestamp` ISO UTC có `Z` [Inference từ `v-date-picker.vue`; xác nhận bằng test port `datetime.test.ts`] | FR-025, data-model §3 |
| CHK006 | Làm theo từng component Directus (list: notice; map: lỗi kiểu hình học; code: hiện chuỗi; block editor: Editor.js tự đọc); bộ mẫu có ít nhất một giá trị lệch dạng cho list, map, code | Edge Cases, FR-100 |
| CHK007 | `system-raw-editor`: options `language` (`mustache` hoặc `plaintext`), `placeholder`, chỉ đọc khi `disabled`; dùng trong hộp sửa thô cho kiểu không phải object | FR-004 |
| CHK008 | o2m bỏ chọn theo `one_deselect_action`: `nullify` → `update` đặt khóa ngoại null, `delete` → `delete`; quyền theo `use-relation-permissions.ts` | FR-043 |
| CHK009 | Thêm bảng ngắn: tạo mới = `create` trên collection liên quan (m2m/m2a thêm `create` trên collection nối); chọn có sẵn = `update` trên collection nối hoặc khóa ngoại; bỏ chọn = `update` hoặc `delete` theo FR-043; sửa = `update` liên quan; sắp xếp = `update` field sort. Nguồn: `use-relation-permissions.ts` | FR-041 |
| CHK010 | Quan hệ có `sortField` → sắp và kéo theo `sortField`, bỏ qua option `sort`; không có → sắp ban đầu theo `sort`/`sortDirection`, không kéo | FR-043 |
| CHK011 | Preset như `usePreset` Directus: user rồi role rồi global (không bookmark); lấy `layout_query.tabular.fields` nếu có, nếu không thì 4 field hiện đầu như `layouts/tabular` | FR-046 |
| CHK012 | Chép `useRunManualFlow`: hộp xác nhận khi `requireConfirmation` (mô tả, form `options.fields`, hủy), thông báo thành công/lỗi như Directus; 013 phát sự kiện "đã chạy" để màn chứa (014) nạp lại item | FR-057 |
| CHK013 | Như Directus: không có quyền đọc `directus_flows` → danh sách rỗng, không gọi API; lỗi → rỗng, không chặn hydrate | FR-057, Assumptions |
| CHK014 | Như `v-upload.vue`: thanh tiến độ, thông báo lỗi qua `translateAPIError` (413, kiểu bị từ chối), tải nhiều file báo lỗi từng file; Directus không có nút hủy nên không thêm | FR-050, FR-053 |
| CHK015 | Nguồn: `/server/info` `files.mimeTypeAllowList` (thêm vào `serverStore` 012); `allowedMimeTypes` của option dùng làm `accept` và lọc thư viện; danh sách server dùng cho block editor như Directus | FR-053 |
| CHK016 | Như `map.vue`: không `defaultView` thì vừa dữ liệu nếu có, không thì vùng mặc định của Directus; style lỗi thì khung trống, vẫn vẽ được | FR-063, Edge Cases |
| CHK017 | Như Directus: không ngôn ngữ → không có form và có thông báo; `languageField` thiếu → dùng khóa chính; `defaultLanguage` không có → ngôn ngữ đầu | FR-048, Edge Cases |
| CHK018 | Như Directus: collection không còn hoặc không có quyền → lỗi tải hiện trong field, không ném lỗi; singleton bị loại khỏi lựa chọn từ đầu | FR-049, Edge Cases |
| CHK019 | Như `render-template.vue`: field không đọc được hoặc không còn → phần đó trống (`--` ở display) | Edge Cases |
| CHK020 | Như Directus: skeleton khi tải, `no_items` khi trống, notice lỗi qua `translateAPIError` | FR-046 |
| CHK021 | Thêm `@fortawesome/fontawesome-svg-core` và `@fortawesome/free-brands-svg-icons` 6.7.2 (bản Directus; mã MIT, icon CC BY 4.0 cần ghi công [Unverified]); ghi công trong README của `apps/web`; display `icon` và `BoIcon` vẽ được tên `social:*` như `v-icon` | FR-035, FR-074, research R1 |
| CHK022 | Thêm `GET /users/:id?fields=id,first_name,last_name,avatar.id,avatar.modified_on,role.name,status,email` vào contract; lỗi quyền thì popover hiện lỗi như Directus | FR-074, contracts/api-calls |
| CHK023 | Chấp nhận: link trỏ đúng route Directus; ở 013 route đó là khung của 012 (D-40) cho tới 014 | Assumptions |
| CHK024 | Design owner = owner dự án (bạn) trừ khi chỉ định khác; tiêu chí: theo quy ước `component-specs.md`, có trong bảng tương phản, đối chiếu ảnh với TailAdmin và luồng Directus (handoff checklist) | FR-093 |
| CHK025 | Thứ tự task: recipe nháp cho cả Q-1 đến Q-12 viết trong một task đầu đợt A, trước mọi task interface | plan Summary (đợt A) |
| CHK026 | Định nghĩa trong SC-001: "đọc được cấu hình" = SC-001 (dựng đủ, không lỗi) và SC-003 (mọi khóa có hiệu ứng kiểm được) | SC-001 |
| CHK027 | Danh sách đóng = khóa trong `index.ts` Directus; spec FR liệt kê lại; `registry.test.ts` lệch thì sửa spec cùng commit | FR-005, SC-003 |
| CHK028 | Quy tắc so: so sâu sau JSON round-trip (bỏ thứ tự khóa); bigInteger/decimal là chuỗi; `null` khác thiếu khóa; `undefined` là không thay đổi | FR-080 |
| CHK029 | Danh sách đóng: `time` và `id` của block editor; khoảng trắng và thứ tự thuộc tính HTML do trình duyệt chuẩn hóa | Assumptions |
| CHK030 | Như `useBatch`: mọi field trừ khóa chính; bật thì đặt `schema.default_value`; 013 chỉ dùng trong drawer sửa hàng loạt | FR-019 |
| CHK031 | `$version` = `null` ở 013 (chưa có màn versions) | FR-013 |
| CHK032 | Cấu hình khử HTML chép nguyên `sanitize.ts` | FR-062 |
| CHK033 | Giấy phép chấp nhận: MIT, Apache-2.0, BSD-2/3, ISC, OFL-1.1 (font), CC BY 4.0 (icon, có ghi công), MPL-2.0 (chỉ công cụ test); loại GPL, AGPL, thương mại | FR-064 |
| CHK034 | Danh sách thao tác bàn phím theo nhóm interface viết ở `contracts/tests.md` §5; SC-005 trỏ tới đó | SC-005, contracts/tests |
| CHK035 | Mục menu dòng "Lên", "Xuống" (D-60), khóa dịch overlay mới | FR-094 |
| CHK036 | TinyMCE (CSS nội dung theo token sáng/tối), CodeMirror (theme theo token), nút MapLibre theo token; nền bản đồ theo appearance như `basemap.ts` (có nhánh tối) | FR-095 |
| CHK037 | Lưới hai cột từ 768 px; drawer toàn bề rộng dưới `xl` (như L-4); chi tiết trong recipe Q-1, Q-10 | FR-011, Q-1, Q-10 |
| CHK038 | Viết lại hai câu dở trong contracts | contracts |
| CHK048 | Đã có lý do ở Notes của `requirements.md`; đánh dấu xong | — |
| CHK050 | Bảng truy vết đã phủ (US1 gồm FR-001 đến FR-019; FR-037 ở US5); đánh dấu xong | — |
| CHK051 | Mỗi file `expected.*.json` ghi nguồn (dòng code hoặc test Directus) cho từng giá trị; reviewer đối chiếu nguồn; E2E so payload ở 014 là xác nhận cuối | FR-100, SC-002 |
| CHK052 | Bộ mẫu không có field dùng `_system`: bỏ câu trừ trong SC-001 | SC-001 |
| CHK053 | Điều kiện đo: chromium trên CI, API giả lập đã có dữ liệu, lần dựng đầu, trung vị 3 lần < 1.000 ms | SC-004 |
| CHK054 | Ngoại lệ axe chỉ cho phần của thư viện bên thứ ba, ghi rule id và lý do trong file test, tech lead duyệt | SC-005 |
| CHK055 | Khóa thẩm mỹ: kiểm class, attribute hoặc style trên DOM | SC-003 |
| CHK056 | Thêm SC-008: recipe nháp Q-1 đến Q-12 được duyệt, bảng Q chuyển "Đóng", handoff checklist đạt | SC |
| CHK057 | Thêm SC-009: bản xuất seed ở hai API giống nhau sau chuẩn hóa (khác biệt thật ghi R-xx) | SC |
| CHK058 | Ghi cho tạo mới: mặc định áp, khóa chính sửa được, nút flow khóa, lọc chọn o2m khi cha chưa có khóa như Directus | FR-015, FR-043, FR-057 |
| CHK059 | Như Directus: lồng không giới hạn độ sâu, thay đổi của drawer con gom vào giá trị của field trong drawer cha | FR-040 |
| CHK060 | Lỗi lồng chỉ có ở `translations` như Directus; drawer item kiểm hợp lệ phía client trước khi gom | FR-018 |
| CHK061 | Đổi ngôn ngữ: dịch lại nhãn, ghi chú, options (`translateFields`), display định dạng lại | FR-006 |
| CHK062 | Như Directus: `direction` chỉ truyền ở chỗ Directus truyền (nhóm, translations, input `dir`, TinyMCE `directionality`) | FR-019 |
| CHK063 | Chỉ đọc: ẩn tạo, chọn, bỏ chọn; vẫn xem lớn, tải xuống, mở link như Directus | FR-041, FR-050 |
| CHK064 | `nonEditable` làm như code Directus chép (ví dụ rich text chỉ đọc); kiểm unit; màn so sánh ở 014 | D-55 |
| CHK065 | Như Directus: màu dữ liệu không đổi; bộ mẫu dùng màu đạt tương phản; ngoại lệ axe chỉ cho màu dữ liệu | Edge Cases, SC-005 |
| CHK066 | Như Directus: cắt chữ trong bảng, tags xuống dòng; không thêm giới hạn | Edge Cases |
| CHK067 | Như Directus (nạp cả cây); ghi rủi ro ở Assumptions, không thêm yêu cầu | Assumptions |
| CHK068 | Phân trang và đếm qua API như Directus; thời gian phụ thuộc API (benchmark 005) | Assumptions |
| CHK069 | bigInteger, decimal giữ chuỗi (không mất chính xác); float không hợp lệ không phát | FR-020 |
| CHK070 | Như Directus (`date-fns-tz`); `tz` không hợp lệ xử lý như Directus | FR-025, Edge Cases |
| CHK071 | Như Directus: giữ lựa chọn khi field nguồn đổi [Inference từ code, kiểm khi port] | Edge Cases |
| CHK072 | Hiện đủ bản ghi trùng như Directus; `allowDuplicates` chỉ ảnh hưởng bộ lọc chọn | FR-044 |
| CHK078 | Giữ ngân sách bundle ở plan (chi tiết hiện thực); spec đã có SC-004 | — |
| CHK080 | A11y của editor bên thứ ba như thư viện; liên kết nhãn bằng `aria-labelledby` khi thư viện cho phép; ngoại lệ axe theo CHK054 | FR-092 |
| CHK081 | Thành phần mới tắt transition khi `prefers-reduced-motion: reduce` (quy tắc 012); bản đồ dùng `jumpTo` thay `flyTo` | FR-094 |
| CHK082 | Seed geometry chỉ trên Postgres có PostGIS (`postgis/postgis` của `tests/parity`); ghi điều kiện ở FR-100 | FR-100 |
| CHK083 | Ghi Assumption: Directus ẩn interface `system: true` khỏi bộ chọn; nếu field người dùng vẫn trỏ tới (đặt qua API) thì hiện `interface_not_found` (D-57) | Assumptions |
| CHK084 | Thêm ghi chú vào prompt 014 trong `SPECKIT-GUIDE.md`: màn item, E2E ba cấu hình, so payload, layout drawer theo preset, `unsaved_changes`, màn versions (D-40, D-55, D-58) | SPECKIT-GUIDE §6 (014) |
| CHK085 | Tương tự cho prompt 015 (D-57 phần user, D-59) và 016 (D-56, D-57 phần còn lại) | SPECKIT-GUIDE §6 (015, 016) |
| CHK086 | Ghi điều kiện chọn dự phòng ở plan: task đầu đợt A kiểm các gói [Unverified]; thất bại thì dùng dự phòng đã nêu ở R1, R7, R8 | plan |
| CHK087 | Mở rộng `Bo*` của 012 chỉ bằng prop tùy chọn; test của 012 phải giữ xanh | plan R6 |
| CHK088 | Điều kiện bắt đầu implement: CI của 012 xanh | plan Summary |
| CHK090 | Giữ `recommendedDisplays` nguyên văn (dữ liệu cho 016), kể cả id không có | FR-001 |
| CHK091 | Thêm `BoTextOverflow` (chép `v-text-overflow`) vào danh sách component | plan Project Structure |
