# Đề xuất lời giải: release-gate 014

Ngày 2026-10-15. **Owner duyệt toàn bộ ngày 2026-10-15; đã áp (xem Notes của release-gate.md).** Mỗi dòng là đề xuất cho một mục của [release-gate.md](./release-gate.md); khi owner duyệt, sửa
spec/plan/contracts theo cột "Sửa ở" và đánh dấu `[x]`. Dòng có [Unverified] dựa trên đọc code Directus chưa chạy
thử hoặc gói chưa cài; kiểm ở task đầu lượt 1 (T002/T003).

Quy ước chung đề xuất: chỗ nào Directus đã có hành vi thì **làm như Directus** (Nguyên tắc VI), chỉ ghi thêm vào
spec cho rõ; khác biệt mới chỉ khi a11y hoặc constitution buộc (như 013).

## Phần 1. Mục Conflict, Security và quyết định phạm vi (ưu tiên)

| Mục | Vấn đề | Đề xuất | Sửa ở |
|-----|--------|---------|-------|
| CHK052 | Popup bị chặn: spec "về chia đôi", Directus không dự phòng | **Như Directus**: không dự phòng; `window.open` trả null thì chế độ `popup` giữ, khung xem trước ẩn, nút xem trước vẫn bật để người dùng đổi chế độ; sửa Edge Cases | Edge Cases, FR-066 |
| CHK053 | Hàng loạt "lỗi theo khóa" vs transaction của API | Sửa Edge Cases: API chạy trong transaction, lỗi thì không item nào đổi; hộp lỗi hiện thông điệp API; lựa chọn giữ; không có "lỗi theo khóa" | Edge Cases |
| CHK054 | Seed 014 sửa `bo_std` làm lệch test 013 | Collection mới **`bo_content`** (versioning, archive `status`, `display_template`, `preview_url`, `sort_field`, 30 item) và folder `bo_folder` cho cây; `bo_std` giữ nguyên; preset/bookmark/version/share/comment seed trên `bo_content`; E2E dùng `bo_content` cho màn, `bo_std` chỉ cho form 013 | FR-120, data-model §9, contracts/tests §3 |
| CHK060 | Drawer chọn item cần panel option layout nhưng `BoDrawer` không có slot sidebar | Như Directus: `drawer-collection.vue` có `#sidebar` với `LayoutSidebarDetail` + option; mở rộng `BoDrawer` bằng slot `sidebar` tùy chọn (panel phải 240 px trong drawer, dưới `xl` thành mục gập ở đầu body) và cập nhật recipe §8; test 013 không đổi | FR-029, research R4, layout-patterns §8 |
| CHK088 | Iframe live preview | Chép đúng thuộc tính của `live-preview.vue` (T003 đọc: `sandbox`, `allow`, `referrerpolicy` nếu có); ghi Assumptions "URL do admin cấu hình, rủi ro như Directus"; bỏ [Unverified] ở FR-069 sau T003 | FR-069, Assumptions |
| CHK089 | Dữ liệu người dùng trong HTML | Ghi một dòng FR-110b: mọi chuỗi dữ liệu (tên bookmark sau `translate`, tiêu đề template, nhãn nhóm, tag, comment) vẽ bằng text binding; chỉ comment đi qua DOMPurify không tag để chèn `<mark>`; `help`/`text` markdown của interface đã khử ở 013 | FR-110 |
| CHK040 | Tiêu đề tab | Ghi rõ: `useHead` của màn đặt `<collection> \| <tiêu đề>` rồi `titleTemplate` của 012 thêm ` · <project_name \|\| Backoffice>`; singleton: `<collection> · project`; E2E kiểm chuỗi cuối | FR-051 |
| CHK049 | Cấu hình chạy bộ so payload | Ghi vào FR-120: E2E ở ba cấu hình; bộ so payload chỉ ở `proxy-api` (body không phụ thuộc cấu hình; Directus app ở 8155 cùng DB) | FR-120 |
| CHK059 | Firefox/webkit cho 11 spec | SC-001: chromium 768 và 1280 ở cả ba cấu hình cho mọi spec Content; firefox-1280 và webkit-1280 chỉ `content-tabular`, `content-item`, `content-filter-bookmark` (ba spec lõi); ghi lý do thời gian job; cors chỉ chromium-1280 như 012 | SC-001, contracts/tests §3 |
| CHK028 | Preset admin rò giữa ba cấu hình | Mỗi spec xóa preset và bookmark của admin trên collection nó dùng trong `beforeEach` qua `AdminApi` (`DELETE /presets` theo filter user + collection); bookmark tạo trong E2E đặt tên `${DATA_PREFIX}-…`; ghi vào contracts/tests §3 | contracts/tests §3, FR-120 |
| CHK029, CHK030 | Request ngoài trong E2E; "Mapbox giả lập" | E2E: `page.route('**/*', …)` chặn mọi host ngoài `webUrl`/`apiUrl`/`localhost` bằng `abort()` trừ danh sách FR-112 được stub (`tile.openstreetmap.org` → PNG 1×1, `fonts.openmaptiles.org` → 204, `api.mapbox.com` → style JSON tối thiểu và geocoding rỗng); harness 012 chỉ kiểm path trên `apiUrl`, giữ; SC-005 "giả lập" = stub này | FR-112, SC-005, contracts/tests §3 |
| CHK047, CHK048 | SC-003 tuyệt đối trên runner chia sẻ; đếm request | SC-003 thêm vế tương đối: cùng kịch bản trên Directus app (8155/admin) đo cùng lúc, app mới không chậm hơn Directus app quá 10 % p95 (X); ngưỡng tuyệt đối giữ làm mục tiêu, không chặn; bảng request: đổi trang = 1 danh sách, 0 đếm; sắp xếp = 1, 0; lọc/tìm = 1 danh sách + 1 `itemCount` (+1 `totalCount` chỉ khi archive đổi); đổi collection = 1 + 2 | SC-003, contracts/tests §5 |
| CHK046 | Vế cuộn của SC-011 | Bỏ vế "cuộn không rớt khung hình"; giữ thời gian vẽ 1000 × 10 < 2 s; thêm: cuộn 10 lần `scrollBy(0, 2000)` không ném lỗi và không vẽ lại toàn bảng (đếm `onUpdated` ≤ 1) | SC-011 |
| CHK036, CHK061, CHK098 | Memo đếm và nút làm mới | Như Directus: `useMemoize` theo instance; `refresh()` gọi `getItemCount`/`getTotalCount` → trả cache nếu khóa không đổi [Inference từ `use-items.ts`; T003 chạy thử trên Directus app]. Nếu Directus hiện số đếm cũ sau làm mới: tái tạo và ghi **R-38**; FR-023 ghi "memo theo instance layout, không xóa khi làm mới"; contracts §3 ghi chú | FR-023, contracts/layouts §3, spec R |
| CHK037 | Kéo đổi thứ tự cột | T003 kiểm `v-table` (`allowHeaderReorder` prop). Có → chép; không → bỏ "kéo đổi thứ tự cột", giữ "Chuyển trái/phải" trong menu header là khác biệt a11y gộp vào D-69 (không phải Directus) [Unverified] | FR-031, D-69 |
| CHK100 | Đổi layout khi ở bookmark role/global | Sửa US3-5: "đổi layout ở preset (không bookmark) role/global → tạo preset mới của user"; ở bookmark role/global → không lưu, chỉ "tạo bookmark" (FR-012, FR-015); hai câu không mâu thuẫn sau khi tách | US3-5 |
| CHK067 | Duyệt D-67, D-68, D-70–D-72 | Ghi ở "Duyệt khác biệt": tech lead duyệt gộp các hệ quả XI/D-40 cùng Q5 (2026-10-15); SC-010 giữ | spec đầu, SC-010 |

## Phần 2. Các mục còn lại

| Mục | Đề xuất | Sửa ở |
|-----|---------|-------|
| CHK001 | Ghi: lần đầu `POST /presets` với toàn bộ preset cục bộ (`collection`, `layout` (`tabular` nếu chưa đổi), `layout_query`, `layout_options`, `filter`, `search`, `refresh_interval`, `user`; không `id`, không `bookmark`); sau đó `PATCH /presets/:id` với toàn bộ preset cục bộ (Directus `savePreset(localPreset)`), không chỉ khóa đổi; bộ so payload xác nhận | FR-011, data-model §2 |
| CHK002 | Phiên share: store presets không hydrate, `getPresetForCollection` trả null → preset cục bộ `{layout: 'tabular'}` không ghi; cây không có bookmark; ghi FR-084 | FR-084, FR-010 |
| CHK003 | Chép `system-input-translated-string` nguyên: ô nhập + nút mở drawer danh sách `/translations` (tìm, chọn → giá trị `$t:<key>`, tạo mới qua store translations `create`); 016 dùng lại | FR-013, research R3, data-model §8 |
| CHK004 | Ghi: danh sách kích thước trang lọc `≤ queryLimit.max` (`usePageSize` 013), `-1` = không cắt | FR-033 |
| CHK005 | Như `v-table`: tối thiểu như Directus (T003 đọc hằng), cột mới 144; ẩn cột trong debounce: ghi widths rồi fields như Directus (không bảo vệ thêm) | FR-031 |
| CHK006 | Như `drawer-collection.vue` (T003 đọc): preset tạm lấy cả `filter`/`search` đã lưu của collection làm `filterUser` ban đầu; `filterSystem` = `filter` của interface; ghi FR-029 | FR-029 |
| CHK007 | Chép `v-field-list`: cây nạp lười khi mở nút quan hệ, không giới hạn độ sâu, gồm collection hệ thống qua quan hệ, hàm theo kiểu field (`year`, `month`, `week`, `day`, `weekday`, `hour`, `minute`, `second`, `count`), loại `alias` không quan hệ và `presentation`; ghi FR-041 | FR-041, research R6 |
| CHK008 | Như Directus: `archive_value` null → bộ lọc `{field: {_neq: null}}` và nút archive ghi null; không chặn thêm | FR-044 |
| CHK009 | Ghi FR-009: `/content/<directus_*>` không có route riêng → màn không tìm thấy (`isSystemCollection`) | FR-009 |
| CHK010 | Như Directus: `cameraOptions` giữ nguyên (không vừa lại) trừ khi đổi field hình học; `viewInfo` theo collection (preset riêng) | FR-036, FR-038 |
| CHK011 | T003 đọc `kanban.vue`: có hộp xác nhận thì chép; không thì thêm `BoDialog` xác nhận (xóa item thật) và ghi **D-74** (khác, an toàn dữ liệu) | FR-037 |
| CHK012 | Chép thứ tự của `change()`: `changeManualSort` (`/utils/sort`) trước, rồi `PATCH` field nhóm; bộ so payload so theo chuỗi có thứ tự | FR-037, contracts/tests §4 |
| CHK013 | Ghi FR-054b: `useNotices` = `BoNotice` xếp chồng dưới page header (`role="status"`, `aria-live="polite"`), tự ẩn 5 s, nút đóng; lỗi không tự ẩn; dùng cho lưu, xóa, archive, bản sao, chép link, export bắt đầu, import xong, flow | FR-054, Assumptions, recipe Q-8 |
| CHK014 | Ghi FR-071: version `+` không gửi `version=`; `?version=draft` khi chưa có → form là bản chính, lưu tạo version rồi save | FR-071 |
| CHK015 | Chép `comparison-modal.vue`: nút promote khóa khi không có quyền update item chính; ô "xóa sau promote" chỉ khi `deleteVersionsAllowed`; ghi FR-072 | FR-072 |
| CHK016 | Chép `useCollection`: `accountabilityScope = meta.accountability` (null → không Revisions); ghi FR-080 | FR-080 |
| CHK017 | Như Directus: "Apply" ghi giá trị thô của field đã chọn vào `edits` (m2o = khóa, o2m/m2m không có trong delta); field không đọc được không có trong `delta` nên không hiện | FR-081 |
| CHK018 | Chép `shares-sidebar-detail.vue`: `DrawerItem` `directus_shares` với `edits` sẵn `{collection, item}`, hai field đó ẩn qua `fields` lọc; `password` là hash, interface `input-hash` 013 không hiện lại; role không có quyền share → mục Shares ẩn (FR-083 đã có) | FR-083 |
| CHK019 | Chép `use-flows.ts runManualFlow` (T003): body `{collection, keys}` với `keys` = selection (có thể rỗng) ở collection, `[pk]` ở item, cộng giá trị form xác nhận; kết quả = notice D-66 như 013 | FR-089 |
| CHK020 | Chép `live-preview.vue` nguyên thanh công cụ: ô URL (menu khi nhiều URL), nút nạp lại, nút kích thước (`toggleFullscreen` 400×600 ↔ toàn khung), ô rộng/cao, zoom 25/50/75/100/150/200 %, mở cửa sổ, menu hiển thị; sửa FR-065 | FR-065 |
| CHK021 | Như Directus: phiên share chỉ có quyền của share; `/content` và collection khác → không có collection trong cây → `no_collections`/không tìm thấy; `track/page` không gọi cho share (012) | FR-084 |
| CHK022 | Form 013 không phát `edits` cho field readonly; nếu người dùng dán qua raw editor thì API trả 403 → hộp lỗi; ghi Edge Cases | Edge Cases |
| CHK023 | Như `saveAsCopy`: `item_duplication_fields` rỗng → query chỉ `<pk>`; bản sao = `edits` + mặc định; quan hệ ngoài danh sách không chép | FR-053 |
| CHK024 | Thêm FR-115b: dòng số đếm là `role="status" aria-live="polite"`; header cột `aria-sort`; đổi trang thông báo "Trang n" | FR-115 |
| CHK025 | Thêm FR-110c: dark mode và `motion-reduce` cho FullCalendar (biến `--fc-*`), popup MapLibre, chuyển động kéo thả và split panel; kiểm trong axe browser test ở `html.dark` | FR-110, FR-116 |
| CHK026 | Như Directus + handoff: xóa → route collection (focus vào tiêu đề trang), lưu và tạo tiếp → `autofocus` field đầu, đóng hộp so sánh → nút mở, xóa bookmark → route collection; ghi FR-115c | FR-115 |
| CHK027 | Recipe nháp Q-6, Q-8 ghi: notice stack (vị trí, 5 s), split button lưu, nút bookmark 3 trạng thái, menu version, tay cầm chia đôi; design owner duyệt trước lượt 1 code các màn đó | Q-6, Q-8, research R10 |
| CHK031 | Liệt kê 13 file (phần tham chiếu đã có) → FR-124 trỏ tới bảng và file đích: `version-menu.test.ts` → `VersionMenu.test.ts`, `kanban.test.ts` → `Kanban.browser.test.ts`, `calendar/options.test.ts` → `CalendarOptions.test.ts`, `drawer-batch.test.ts` (013 đã port), `export-sidebar-detail.test.ts`, `flow-sidebar-detail.test.ts`, `refresh-sidebar-detail.test.ts`, `search-input.test.ts`, `use-flows.test.ts`, `use-versions.test.ts`, `use-item/index.test.ts`, `use-comparison.test.ts`, `use-items.test.ts` (013 đã port) | FR-124 |
| CHK032 | Chép hộp thoại nhập của Directus (T003): có công tắc "chạy nền" (`background`), lưu trong trạng thái hộp; thông báo hai khóa như Directus | FR-090 |
| CHK033 | Như Directus: bộ lọc trong hộp xuất là `system-filter` sửa được, tìm kiếm là ô nhập; "bỏ được" = xóa giá trị | FR-091 |
| CHK034 | Ghi đúng: lọc `hidden`/`no-data` theo thứ tự `meta.sort`, lấy 4 đầu, rồi `.sort()` tên field (Directus) | FR-030 |
| CHK035 | Tách FR-024 theo layout như `showingCount` của từng `index.ts` | FR-024 |
| CHK038 | Như Directus: calendar `queryLimit.max` hoặc 1000; kanban `layoutQuery.limit \|\| 1000`; map `limit` preset mặc định 1000; không cắt theo `max` (API tự cắt, Directus vậy) | FR-036–FR-038 |
| CHK039 | Chép `handleClick`/`handleSelect`: `replace` = không giữ Shift/Ctrl; selectMode một → thay thế | FR-038, FR-029 |
| CHK041 | Chép `unexpectedError`: `BoDialog` tiêu đề `unexpected_error`, text `translateAPIError`, chi tiết gập (`VError` → khối mã), nút `done`; dùng chung cho mọi lỗi không validation | FR-054 |
| CHK042 | Như Directus: form `disabled` vẫn có menu field (xem/chép giá trị thô), nút lưu `disabled` + tooltip `not_allowed` | FR-056 |
| CHK043 | Chép `version-menu.vue`: ô key có tooltip `reserved_version_key`, nút tạo khóa | FR-070 |
| CHK044 | Chép `use-comparison`: chỉ field khác biệt có checkbox, mặc định chọn tất cả; "chỉ hiện khác biệt" là công tắc hiển thị | FR-072, FR-081 |
| CHK045 | Recipe Q-8: skeleton tiêu đề `h-7 w-64` như drawer 013; sr-only tiêu đề | Q-8 |
| CHK050 | SC-002 ghi danh sách so: (a) nhãn và thứ tự mục cây (kể cả nhóm và bookmark), (b) text header cột, (c) chuỗi số đếm, (d) `disabled` của nút tạo/xóa/archive/sửa hàng loạt/lưu/xóa item, (e) mục sidebar hiện; thu bằng `innerText`/`aria-disabled` ở hai app | SC-002 |
| CHK051 | Bỏ ba dòng "dự phòng"; số FR để trống như 013 | Requirements |
| CHK055 | Sửa `layout-patterns.md` §7 dòng "Module navigation": "một cấp, trừ module Content: cây nhiều cấp (014 §9)"; spec 012 không sửa (FR-020 trỏ tài liệu) | layout-patterns §7 (lượt 1), spec 012 Assumptions |
| CHK056 | Thêm "tay cầm live preview" vào FR-115; contracts đã có | FR-115 |
| CHK057 | Thêm "geocoding Mapbox khi có key" vào FR-112 (contracts #66 đã có) | FR-112 |
| CHK058 | Ghi FR-053: `saveAsCopy` dùng `POST /graphql` (`/graphql/system` với collection hệ thống) như Directus; FR-112 trỏ contracts (có #93); `allowed-paths` thêm | FR-053, FR-112 |
| CHK062 | Thêm fixture `expected.content.json` (data-model §9) với body preset kỳ vọng cho US1-3 viết tay từ Directus app (ghi lại bằng DevTools một lần, nguồn ghi rõ); bộ so payload là xác nhận cuối | US1-3, data-model §9 |
| CHK063 | Ghi: so sâu sau JSON round-trip, thứ tự mảng giữ (`_and`, `_or`), thứ tự khóa object không tính | US3-1, SC-004 |
| CHK064 | Mốc = ghi từ Directus app qua Playwright (bộ so payload, kịch bản "đổi option layout") cho `layout_options`; request `/items` so với mẫu trong test component viết tay từ `index.ts` Directus (nguồn dòng code) | SC-005 |
| CHK065 | Thêm: activity `version_promote`? (API 008 ghi `items.promote` event; activity action `update`): so dòng `directus_activity` của item chính sau promote | US5-5 |
| CHK066 | FR-115 trỏ bảng contracts/layouts §5 (8 mục) là danh sách đóng | FR-115, SC-006 |
| CHK068 | Chép Directus: đổi collection → `selection = []`, `useItems.reset()`, abort request; `use-preset` `initLocalPreset` theo collection mới; kéo thả đang dở bị hủy bởi unmount; ghi Edge Cases | Edge Cases |
| CHK069 | Như Directus: cột không đọc được bị lọc khi dựng (`fieldsStore.getField` null); sắp xếp theo field không đọc được → API 403 → trạng thái lỗi của layout với nút đặt lại tùy chọn; bộ lọc chỉ liệt kê field đọc được (`FieldList` theo quyền) | FR-103, Edge Cases |
| CHK070 | Như Directus: lưu trả 403/404 → hộp lỗi, thay đổi giữ; version bị xóa → `getVersions` sau lưu không còn → về bản chính; ghi Edge Cases | Edge Cases |
| CHK071 | Như Directus (`v-if="isNew === false && actualPrimaryKey"`): sidebar không có mục nào ở item mới; ghi FR-008 | FR-008 |
| CHK072 | Như Directus: URL từ `use-template-data` (dữ liệu đã lưu), đổi sau khi lưu; ghi FR-063 | FR-063 |
| CHK073 | Như Directus: field lồng xuất được (API làm phẳng); không field → nút xuất khóa; ghi FR-091 | FR-091 |
| CHK074 | Đã có ở FR-015 (bookmark role/global → "tạo bookmark"); thêm kịch bản E2E `content-filter-bookmark` | contracts/tests §3 |
| CHK075 | Thêm FR-004b: cây là `tree`/`treeitem` ARIA hoặc danh sách lồng với nút `aria-expanded`; mũi tên lên/xuống di chuyển mục, trái/phải đóng/mở, Enter mở; ô tìm không khớp → "không có kết quả" sr-only | FR-004, recipe Q-1 |
| CHK076 | Như Directus: `+bookmark` NaN → `getBookmark` null → `bookmark_doesnt_exist`; bookmark của collection khác → vẫn mở với collection trong URL (Directus không kiểm) → ghi Edge Cases "như Directus"; xóa ở tab khác → tab này lưu sẽ 403 → hộp lỗi | Edge Cases |
| CHK077 | Như Directus: rời trang trước 450 ms mất thay đổi; lỗi ghi preset → `unexpectedError` hộp lỗi; ghi Edge Cases | Edge Cases |
| CHK078 | Như `useCollectionPermissions.sortAllowed` (update field sort): không có → kéo ẩn, menu Lên/Xuống ẩn | FR-032 |
| CHK079 | Như FullCalendar/Directus: item không có ngày bắt đầu không hiện; kết thúc trước bắt đầu → FullCalendar không cho kéo (revert); ghi Edge Cases | Edge Cases |
| CHK080 | Như Directus: bbox lỗi → MapLibre ném → `geojsonError`/fitBounds bỏ qua (try/catch như `map.vue`); cluster với đường/vùng: MapLibre chỉ cụm điểm | Edge Cases |
| CHK081 | Như Directus: không giới hạn độ dài (API `MAX_PAYLOAD_SIZE`); mention user thiếu → giữ `@uuid`; xóa comment đang sửa → ô sửa đóng | Edge Cases |
| CHK082 | Chép `share-item.vue` (hết hạn/hết lượt: chữ phụ `expired`/`uses_left`); `navigator.clipboard` không có → notice lỗi `share_copy_link_error` | FR-083 |
| CHK083 | Như Directus: 413 → `unexpectedError`; hủy = đóng hộp (XHR abort); mất quyền → 403 hộp lỗi | Edge Cases |
| CHK084 | Như Directus: client khóa theo `queryLimit.max`; server từ chối vẫn có thể xảy ra (giới hạn đổi) → hộp lỗi | Edge Cases |
| CHK085 | Như 012: 401 → `refresh()` thất bại → về đăng nhập với lý do; thay đổi chưa lưu mất (Directus vậy); ghi Edge Cases | Edge Cases |
| CHK086 | Như Directus (không ảo hóa cây); thêm vào SC-011: cây 300 collection + 100 bookmark vẽ < 500 ms trong browser test | SC-011 |
| CHK087 | Ghi vào SC-012 mới: chunk chính ≤ ngân sách 013 + 60 KB gzip; chunk lười: calendar, map layout, kanban, cards, split panel + live preview, hộp so sánh, system-filter; `check-bundle.mjs` kiểm | SC, research R14 |
| CHK090 | Thêm FR-115d: hộp xác nhận focus vào nút hủy (hoặc nút đầu không phá hủy), `aria-describedby` nội dung, Esc hủy (Reka Dialog) | FR-115 |
| CHK091 | Thêm vào contracts/tests §3: `content-permissions` chạy một lần với `vi-VN` (đổi ngôn ngữ user) kiểm số đếm và ngày nhóm | contracts/tests §3 |
| CHK092 | Đã có T002 kiểu 013 trong plan Complexity Tracking; thêm vào tasks: nếu gói không đạt, chọn dự phòng trong cùng task | plan (đủ) |
| CHK093 | Task T003 lượt 1: diff `apps/web/src/composables/use-items.ts` với nguồn, kiểm sdk `signal` (`requestEndpoint` → `fetch` init) | research R5, tasks |
| CHK094 | T0xx lượt 4: đọc `seed-items.ts` (collection `bench_articles`?, field `status`, `date_created` index) và `tests/benchmark/docker-compose.yml`; thêm hai service web; ghi kết quả vào research R14 | research R14 |
| CHK095 | Tasks lượt 4 dành 1 task riêng cho helper Directus app mỗi nhóm kịch bản (bộ lọc, version, comment, share); ước lượng 2 ngày; kịch bản không driver được (kéo thả tile như 010) thì ghi "không so, chỉ E2E app mới" | contracts/tests §4, tasks |
| CHK096 | Ghi vào tasks.md phần "Điều kiện bắt đầu" như 013 (CI 013 xanh, `git pull --rebase`, không push khi CI khác chạy, nhắn session kia trước `env-up`) | tasks |
| CHK097 | E2E 012 harness đã chặn missing key; thêm unit `lang/keys.test.ts`: mọi khóa `$t('…')` tĩnh trong `modules/content`, `layouts`, `components/sidebar` tồn tại trong `en-US.json` | contracts/tests §1 |
| CHK099 | Ghi Edge Cases: kanban cuộn ngang trong khung layout (`overflow-x-auto`), map và calendar co theo khung; trang không cuộn ngang (FR-116) | Edge Cases |
| CHK101 | Bảng FR-002 đã đủ 10 (users, files, dashboards, activity, settings, collections, roles, presets, translations, flows); D-72 ghi "Gỡ ở 015 (users, files), 016 (settings, collections, roles, presets, translations, flows), 018 (dashboards, activity)" | D-72 |
