# Đề xuất lời giải: release-gate 016

Ngày 2026-10-16. Mỗi dòng là đề xuất ngắn cho một mục của [release-gate.md](./release-gate.md); tác giả spec áp vào
spec/plan/contracts theo cột "Sửa ở" rồi đánh dấu `[x]`. Quy ước: Directus đã có hành vi thì **làm như Directus**
(Nguyên tắc VI); khác biệt mới chỉ khi a11y hoặc constitution buộc; [Unverified] kiểm ở T002 (task đầu lượt 1).
Dữ kiện đã kiểm khi viết file này (2026-10-16, đọc mã nguồn): `v-input.vue` `dbSafe` (keydown chỉ `a-z0-9_` và khoảng
trắng; input thay khoảng trắng bằng `_`, bỏ dấu NFD, xóa ký tự ngoài `[a-zA-Z0-9_]`); snapshot tải là
`JSON.stringify(response body, null, 2)` tên `snapshot.json`; xóa collection folder: API đặt `group: null` cho con
(`api/src/services/collections.ts:643`); tạo policy gửi `{...permission, policy}` nên có `system: true`; interface
Directus có `preview` SVG (`interfaces/input/index.ts:233`), registry 013 bỏ phần lớn; API mới chặn mất admin cuối bằng
`UnprocessableContentError` (`validate-remaining-admin-count.ts`); `BoTabs` 013 chưa có `orientation`; `BoInput` chưa có
`dbSafe`; `system-theme` 015 chưa có option `appearance`; `collections.yaml` có 29 mục.

Kết quả T002 (2026-10-16) đổi lời giải của CHK007, CHK010, CHK014, CHK022, CHK040, CHK041, CHK075, CHK076, CHK086;
lời giải mới ở `research.md` mục "Kết quả kiểm T002" và spec; bảng dưới giữ đề xuất gốc.

## Phần 1. Conflict, số đếm và phạm vi (ưu tiên)

| Mục | Đề xuất | Sửa ở |
|-----|---------|-------|
| CHK055 | Đếm lại: comments (o2m, mới), `bo_categories` (mới) + junction, junction files, junction blocks (m2a tới `bo_categories` và `bo_s_tags` có sẵn), junction translations, `languages` = 7 collection; SC-002 ghi "7 collection sinh" và liệt kê | SC-002, US3 Independent Test |
| CHK056 | SC-003 ghi "3 permission (read all, create custom, update custom); delete và share không có dòng" | SC-003, US4 Independent Test |
| CHK057 | Chốt sáu thao tác một nơi (SC-003): tạo item; đọc danh sách; sửa item của mình; sửa item người khác bị chặn (403); xóa bị chặn (nút ẩn và API 403); field ngoài `fields` không hiện; US4, FR-102, tests §5 trỏ về SC-003 | SC-003, US4, FR-102, contracts/tests §5 |
| CHK049 | 13 màn; SC-004 liệt kê | SC-004 |
| CHK048 | Liệt kê 14 nút: tạo folder, tạo collection, xóa collection (màn collection), lưu collection, tạo field, next, finish, lưu field, tạo role, mời, xóa role, tạo policy, nhân bản policy, tạo preset | SC-004 |
| CHK058 | FR-106 là nguồn; SC-008 ghi "13 màn của SC-004 và 4 drawer/hộp: drawer tạo collection, drawer field (hai chế độ tính một), drawer quyền, hộp xóa collection" | FR-106, SC-008 |
| CHK037 | FR-020 ghi "mọi mục của `collections.yaml` (29 mục, gồm 8 vạch và `sort`, `group`, `collapse` ẩn)" | FR-020 |
| CHK062 | Rà lại: thêm vào FR-087 `PATCH /presets` (batch) và `PATCH /translations` đã có; FR-029 thêm `GET /fields` (#139); FR-018 thêm `PATCH /collections/:c` (#159 guard và menu); contracts giữ số | FR-018, FR-029, FR-087 |
| CHK063 | FR-083 ghi: trình sửa preset dùng cùng ba interface (`system-input-translated-string`, `select-icon`, `select-color`) với `BookmarkAdd`, không dùng component `BookmarkAdd` | FR-083, data-model §10 |
| CHK064 | Giữ; FR-081 thêm "(layout options của 014: `layout-options-<id>`)" | FR-081 |
| CHK065 | Plan/research thêm: `system-theme` 015 nhận prop `appearance` (Directus option `appearance` của `index.ts`); 016 thêm option và test | FR-071, research R4, contracts/components §4 |
| CHK103 | Đối chiếu: FR-042 và bảng có cùng 18 id; ghi "`system-collections`, `system-inline-fields` đăng ký và có test, chưa có màn dùng (017)" | FR-042, Key Entities |
| CHK104 | Ghi ở Phạm vi: "thông tin hệ thống" của mô tả = dòng "Backoffice" (D-95) và snapshot schema; Directus 11.17.4 không có màn thông tin hệ thống riêng (system logs ngoài phạm vi, D-93) | Spec Phạm vi, Clarifications |
| CHK105 | Ghi ở Phạm vi: "giới hạn file" = nhóm `files_and_thumbnails` (`storage_asset_transform`, `storage_asset_presets`, `storage_default_folder`); giới hạn dung lượng là env `FILES_MAX_UPLOAD_SIZE` (VIII), không có ở settings | Spec Phạm vi, US5 |
| CHK059 | FR-109 thêm hai ngân sách chunk lười của R12 | FR-109 |
| CHK061 | Truy vết thêm dòng "FR-001 đến FR-006: mọi story" | Truy vết |
| CHK066 | Assumptions thêm "seed `bo_settings` chạy sau `bo_users` (015)"; data-model §15 ghi thứ tự | Assumptions, data-model §15 |

## Phần 2. Data model và DDL

| Mục | Đề xuất | Sửa ở |
|-----|---------|-------|
| CHK001 | Chép `preview` SVG của mọi interface Directus vào `index.ts` 013 bằng script registry (dữ liệu, không component); thiếu → icon của interface (như Directus khi không có `preview`); màu SVG qua `currentColor`/biến theme | FR-033, research R4 |
| CHK002 | Định nghĩa db-safe theo `v-input.vue` (đoạn đầu file này); `BoInput` thêm prop `dbSafe`; độ dài tối đa không kiểm ở client (Directus không), API báo lỗi | FR-014, FR-015, FR-033, FR-035, contracts/components |
| CHK003 | Như Directus: không kiểm client; API trả lỗi → hộp lỗi, drawer/hộp còn mở (tạo collection: `catch` của `new-collection.vue`) | Edge Cases |
| CHK004 | Như API: con về gốc (`group: null`); hộp xóa folder không cảnh báo thêm (Directus không); cây nạp lại | US1-5, Edge Cases |
| CHK005 | Như Directus: cùng hộp `delete_collection_are_you_sure`, không cảnh báo thêm; ghi rõ "xóa bảng thật" ở Edge Cases | US1-3, Edge Cases |
| CHK006 | Giữ R-40 (như Directus): hộp lỗi của bước lỗi; không liệt kê bước đã ghi; dọn tay qua danh sách collection; ghi ở R-40 "ảnh hưởng" | R-40, FR-041 |
| CHK007 | Như Directus: hộp lỗi API, hộp nhân bản đóng (`duplicateActive` tắt sau `finally`) [Unverified] kiểm T002 | FR-024 |
| CHK008 | Như Directus: không hỏi, `$reset` store; ghi ở FR-030 | FR-030 |
| CHK009 | FR-016: "file `snapshot.json` = body `{data}` của `GET /schema/snapshot`, JSON thụt 2 dấu cách"; tải nhiều lần trình duyệt tự đặt tên | FR-016 |
| CHK010 | Chép mặc định của `system-collections-translations` (dialog) [Unverified] T002 đọc file và ghi giá trị vào FR-028 | FR-028 |
| CHK011 | Như Directus (API `/utils/translations/generate` quyết); lỗi → hộp lỗi trong drawer | FR-028, Edge Cases |
| CHK012 | Skeleton như 014 cho danh sách (cây 6 dòng, bảng `BoTable loading`), ma trận (`BoProgressLinear`), drawer field (skeleton theo `loading` của store); lỗi nạp → `showUnexpectedError` như Directus; ghi một FR chung | FR-006 (mới: trạng thái nạp/lỗi) |
| CHK013 | Như Directus `fieldsStore.updateField`: lạc quan và hoàn tác khi lỗi + hộp lỗi | FR-023 |
| CHK038 | "Vào nhóm" = vào group liền trước trong cùng danh sách (giống cây collection và `indent` của `BoSortableList`); không có group liền trước → mục khóa | FR-022, D-96 |
| CHK039 | FR-021 ghi "`fill` hiện như `full` ở lưới, khác nhau chỉ ở form item" | FR-021 |
| CHK040 | FR-033: "`suffix` = phần id sau tiền tố nhóm (`presentation-divider` → `divider`), như `field-configuration.vue`" [Unverified] T002 | FR-033 |
| CHK041 | Một bộ đếm mỗi collection (như Directus `fieldsStore`: biến module-level) [Unverified] T002; ghi data-model §5 | data-model §5 |
| CHK042 | Đánh [Unverified] ở Edge Cases; T002 so dòng `directus_relations` của field translations ở hai app | Edge Cases, research R7 |
| CHK043 | Viết lại: "Collection người dùng không có field `meta.system`; chỉ collection `directus_*` có field khóa" | Edge Cases |
| CHK044 | FR-041: mỗi bước tuần tự; trong bước 2, 3, 4, 5 lặp tuần tự theo thứ tự khóa (`junction`, `related`; `corresponding`, `junctionCurrent`, `junctionRelated`, `sort`, `oneCollectionField`; `m2o`, `o2m`) như `store/index.ts` [Unverified] T002 | FR-041, contracts/tests §4 |
| CHK060 | Chuyển `swapThreshold` sang research R3; FR-012 chỉ nêu hành vi | FR-012 |
| CHK073 | Như Directus: không theo dõi thay đổi; store cũ tới lần nạp sau (vào lại route); ghi Edge Cases | Edge Cases |
| CHK075 | Như Directus: `startEditing` không tìm thấy → field rỗng với key; ghi Edge Cases và thêm test [Unverified] T002 | Edge Cases, FR-030 |
| CHK076 | Như Directus: `localType` lấy giá trị thô; không có alteration → như standard [Unverified] T002 | Edge Cases |
| CHK077 | Theo `field-detail-advanced-relationship-*.vue`: related collection, junction, FK khóa khi có sẵn; `sort_field`, trigger, `corresponding` sửa được | FR-039, US3-7 |
| CHK078 | Thêm kịch bản vào US2 (thêm field `bo_note` vào `directus_users`) và test E2E; dọn ở `afterAll` | US2, FR-019 |
| CHK083 | Cây dùng `BoTextOverflow` (013), tiêu đề `formatTitle`; không thêm | FR-010 |
| CHK084 | Như Directus: không kiểm; API/DB lỗi → hộp lỗi; ghi Edge Cases | Edge Cases |
| CHK085 | `readyToSave` sai khi `one_allowed_collections` rỗng (`missingConfiguration` m2a); gõ tay singleton: API quyết | FR-032, Edge Cases |
| CHK086 | Như Directus: không chặn; form collection hiện giá trị cũ, `system-field` báo `collection_field_not_setup` [Unverified] | Edge Cases |
| CHK087 | Cuộn tự động của vuedraggable (`scroll: true` mặc định) trong vùng cuộn của màn | research R3 |
| CHK099 | Thêm vào T002: kiểm `collectionsStore` có `directus_*` và `fieldsStore` có `meta.system` | research R2, R7 |
| CHK102 | T002 chạy lại `extract-directus-registry.mjs`; diff fixture phải chỉ thêm 18 `_system`, 4 `optionsKind: component`, `preview`; test 013 cập nhật cùng commit | research R4 |

## Phần 3. Quyền và ma trận

| Mục | Đề xuất | Sửa ở |
|-----|---------|-------|
| CHK014 | Như Directus: chỉ loại chính nó; vòng do API quyết (không kiểm) → ghi Edge Cases, R-43 nếu API nhận vòng [Unverified] T002 | Edge Cases, R-xx |
| CHK015 | Như Directus: hộp lỗi API (`UNPROCESSABLE_CONTENT`), form giữ thay đổi; ghi Edge Cases cho ba trường hợp | Edge Cases, FR-052, FR-055 |
| CHK016 | FR-055 thêm `use-edits-guard`, Ctrl/Cmd+S, Ctrl/Cmd+Shift+S như FR-052 | FR-055 |
| CHK017 | Như Directus: `validationErrors` của `useItem` hiện ở `ValidationErrors` đầu form (013); không đánh dấu dòng ma trận | FR-059 |
| CHK018 | Như Directus: `input-code` JSON báo lỗi cú pháp tại chỗ, giá trị không hợp lệ không phát; nút lưu drawer giữ trạng thái | US4-8 |
| CHK019 | Như Directus: tags tự do, không kiểm client; API kiểm khi đăng nhập | US4-5 |
| CHK020 | Như Directus: trang `+` không có (tạo qua hộp rồi tới trang); ghi rõ `primaryKey` luôn có thật; ma trận bỏ qua `+` chỉ là phòng hờ | FR-056 |
| CHK021 | Như Directus: `Promise.all`; lỗi → hộp lỗi; nạp lại phản ánh phần đã ghi | FR-053, Edge Cases |
| CHK022 | Như Directus `useItem`: lỗi 403/404 → `showUnexpectedError`, form rỗng [Unverified] T002; nếu 014 đã có màn không tìm thấy cho item thì dùng | FR-052 |
| CHK045 | Ghi FR-057: "chọn hết field ở drawer lưu danh sách rõ, chip thành custom (như Directus)" | FR-057, US4-8 |
| CHK046 | Như Directus (lỗi so sánh): dòng app tối thiểu nối thêm nhưng `getPermission` lấy dòng có `policy`; hiển thị một chip; ghi rõ | Edge Cases |
| CHK047 | US4-5: "mỗi dòng gửi đủ khóa của `appAccessMinimalPermissions` gồm `system: true` cộng `policy`" | US4-5, research R5 |
| CHK074 | Như Directus: ghi sau thắng; store settings gộp lạc quan rồi `serverStore.hydrate`; ghi Edge Cases | Edge Cases |
| CHK079 | Route đã đăng ký theo phiên: Directus không gỡ route giữa phiên; API trả 403 → hộp lỗi; sau đăng nhập lại module biến mất; ghi Edge Cases | Edge Cases |
| CHK080 | US4-5 thêm: `users` (list-m2m, `junctionFilter user _nnull`) và số đếm danh sách gồm gán trực tiếp | US4-4, US4-5 |
| CHK088 | Tooltip hiện id collection (Directus: tên hiện là id, tooltip là tên hiển thị) — đã như vậy; không thêm | FR-056 |
| CHK092 | Assumptions thêm: "ẩn module là UX; API (004) chặn ghi Settings với người không admin; E2E `settings-permissions` kiểm API 403" | Assumptions, FR-061 |
| CHK096 | FR-108 thêm: ma trận 300 collection × 5 < 1 s; cây field drawer quyền nạp lười (`useFieldTree`) | FR-108 |
| CHK097 | Thêm T004: tạo policy với permission lồng ở API mới, so DB; lệch → task sửa `apps/api` trong 016 (lượt 3) với parity 004 cập nhật | research R6, Assumptions |

## Phần 4. Dùng chéo, kiểm thử, hiệu năng

| Mục | Đề xuất | Sửa ở |
|-----|---------|-------|
| CHK023 | Spec sửa settings chạy `test.describe.serial` trong worker riêng (`fullyParallel: false` cho file), khôi phục settings ở `afterAll`; spec khác không đọc branding | FR-100, contracts/tests §3 |
| CHK024 | Bộ so payload sắp request song song theo `(method, path, body)` trước khi so | FR-101, contracts/tests §4 |
| CHK025 | Assumptions: "SC-002, SC-003 đo trên Postgres (env parity); DDL vendor khác do parity 006" | Assumptions |
| CHK026 | Ghi rõ: không benchmark web cho Settings (màn quản trị, dữ liệu nhỏ); perf trong browser test đủ | FR-108 |
| CHK031 | Như 014: xem trước dùng `limit` của layout (25), đếm qua `aggregate` như `use-items` | FR-081 |
| CHK050 | Mốc kết thúc: `loading` của store về false và tab Schema vẽ xong (`nextTick`) | FR-108 |
| CHK051 | Thêm: mở drawer field có sẵn = 1 `GET /fields/:c/:f`; trang role = 1 role + `list-m2m` policies (1 trang + 1 đếm) + `list-o2m` users (1 + 1); danh sách preset = 1 danh sách + 1 đếm + 1 panel | FR-108 |
| CHK067 | Bảng giá trị điền trong contracts/tests §5 (title chuỗi, body HTML, tags 2 thẻ, author admin, comments 1 dòng mới, categories 2, attachments 1 file mẫu, blocks 1 mỗi collection, translations en-US + vi-VN, group_seo 1 field con) | SC-002, contracts/tests §5 |
| CHK068 | SC-003: đo HTTP status (API) và DOM (`aria-disabled`, có/không trong DOM) | SC-003 |
| CHK069 | contracts/tests §4 thêm bảng kịch bản → request (#157–#177), mỗi request ít nhất một kịch bản | SC-005, contracts/tests §4 |
| CHK070 | SC-006 liệt kê 20 kịch bản: 7 quan hệ (m2o, file, o2m, m2m, files, m2a, translations) × (collection có/chưa có) = 14, + standard × 2 kiểu, presentation, group, m2o tự quan hệ, translations ngôn ngữ có sẵn = 20 | SC-006 |
| CHK072 | SC-010: "tech lead duyệt ghi ở bảng trạng thái khác biệt của spec như 015 T103" | SC-010 |
| CHK081 | Như Directus: interface/layout không đăng ký → interface mặc định (013 FR-003) và notice ở trình sửa preset; thêm vào kịch bản chiều ngược | FR-102, Edge Cases |
| CHK100 | Thêm T003: chạy tay trên Directus app 8155 bốn luồng ghi (tạo collection, field m2m, policy với quyền, preset) và lưu body làm mốc trước khi viết bộ so | research, contracts/tests §4 |
| CHK101 | T001 chặn đầu như 015: tin nhắn 015 "đã đóng" + CI xanh | FR-111 |

## Phần 5. UI, a11y, design-system

| Mục | Đề xuất | Sửa ở |
|-----|---------|-------|
| CHK027 | Focus: sau tạo collection → tiêu đề màn collection (`h1` `tabindex=-1`); xóa field → dòng kế tiếp hoặc nút `create_field`; đóng drawer → phần tử mở; lưu preset/xóa role → tiêu đề danh sách | FR-106 |
| CHK028 | Lưới thẻ interface là `radiogroup` (mũi tên, Enter/Space chọn), khung cấu hình nhận focus vào ô key | FR-033, FR-106, Q-22 |
| CHK029 | Thông báo: "<tên> chuyển tới vị trí <i>/<n>" và "<tên> vào nhóm <g>"; dùng chuỗi `BoSortableList` 013 đã có (D-60) | FR-106 |
| CHK030 | Như 014 CHK025: MapLibre và FullCalendar dùng lớp tối của 014; `motion-reduce` tắt hiệu ứng kéo | FR-106 |
| CHK032 | Như Directus: hiện rõ (ô `input` monospace); không D-xx | US5-1 |
| CHK033 | Như Directus: không lọc scheme ở client [Unverified] T002 đọc `module-bar.vue`; nếu Directus lọc thì làm theo; ghi D-xx nếu chặn `javascript:` vì XII/a11y | FR-074, FR-003 |
| CHK034 | Như Directus: ô trống + nút sửa; lỗi → hộp lỗi trong drawer | FR-073 |
| CHK035 | Như Directus/012: user có `appearance` riêng thì không đổi; null thì theo dự án sau `serverStore.hydrate` | FR-071 |
| CHK036 | Như API: (key, language) không unique ở 11.17.4? [Unverified] T002; khóa i18n trùng: chuỗi tùy chỉnh dùng tiền tố `$t:` nên không đè khóa app | FR-086, Edge Cases |
| CHK052 | Recipe Q-23 đề xuất: all = nền `success-50` chữ `success-700` icon `check`; none = viền `gray-300` chữ `gray-500` icon `block`; custom = nền `warning-50` chữ `warning-700` icon `rule`; chữ action luôn hiện, sr-only mức | Q-23 |
| CHK053 | 768 px: tab dọc thành `BoTabs` ngang cuộn được trên đầu drawer (Q-22, Q-23) | Edge Cases, Q-22 |
| CHK054 | FR-003: "chữ 'Backoffice' tĩnh, không dịch, không lấy `project_name`" | FR-003 |
| CHK071 | SC-008: liệt kê năm nơi của D-96 | SC-008 |
| CHK082 | US6-2: scope user hiện tên user; preset không `bookmark` sửa được như mọi preset (Directus không phân biệt) | US6-2 |
| CHK089 | Như Directus: không kiểm; `settings` có `locked` từ mặc định | FR-074 |
| CHK090 | Như Directus: không kiểm client; API lưu JSON | US5-1 |
| CHK091 | Như Directus: lỗi biên dịch message → vue-i18n cảnh báo, giữ chuỗi thô; E2E bỏ qua cảnh báo này | FR-086, Edge Cases |
| CHK093 | Assumptions: "`custom_css`, template, link `module_bar` là nội dung admin tin cậy, chèn như Directus (012 FR-034)" | Assumptions |
| CHK094 | Theo bảng tương phản `migration-guide.md`; mục mờ dùng `gray-500` trên `white`, `gray-400` trên `gray-900` | FR-106, Q-20, Q-24 |
| CHK095 | Như component-specs: nút icon tối thiểu 32×32 px (`size-8`), tay kéo cùng cỡ | FR-106 |
| CHK098 | Plan/research R8: "`BoTabs` thêm prop `orientation` (013 chưa có), test bàn phím mũi tên lên/xuống" | research R8, contracts/components |
