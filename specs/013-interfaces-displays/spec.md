# Feature Specification: Bộ interfaces và displays theo cấu hình field của Directus

**Feature Branch**: `013-interfaces-displays` (làm trên `main` như 012, không tạo branch vì dùng chung working tree)
**Created**: 2026-10-15
**Status**: Draft
**Duyệt release-gate**: owner duyệt toàn bộ đề xuất của `checklists/release-gate-proposals.md` ngày 2026-10-15 (D-60, R-xx
cho lỗi `formatted-json-value.handler` của Directus, design owner là owner dự án).
**Duyệt khác biệt**: tech lead duyệt ngày 2026-10-15 D-54 đến D-66 (D-65: giữ cách sửa, không tái tạo; D-61: tạm chưa
cài, lựa chọn TinyMCE vẫn chờ owner), R-34 đến R-37, ngoại lệ axe của SC-005 và danh sách miễn màu dữ liệu (Q-C).
**Input**: User description: "App web cần bộ interface (ô nhập dữ liệu) và display (cách hiển thị giá trị) tương đương Directus, để form và bảng hiển thị đúng theo cấu hình field trong directus_fields (interface, options, display, display_options). Interfaces: input, textarea, code, rich text HTML, markdown, block editor, hash, boolean, datetime, slider, select (dropdown, radio, checkbox, multi, icon, color, tree), tags, file, image, files, map, list (repeater), quan hệ m2o, o2m, m2m, m2a, tree view, translations, nhóm field (accordion, detail, raw, tabs), presentation (divider, header, links, notice), autocomplete từ API. Displays tương ứng. Đọc đúng options đã lưu bởi Directus, để field cấu hình ở Directus hiển thị đúng ở app mới. Tham chiếu directus/app/src/interfaces và displays. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: mọi interface và display có sẵn trong Directus đều có bản tương ứng, và đọc được cấu hình hiện có."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/app/src` trừ khi ghi khác):

- Interface (40 thư mục, không tính `_system`): `interfaces/index.ts` (đăng ký `interface-<id>`, sắp theo id),
  `interfaces/<id>/index.ts` (`defineInterface`: `id`, `name`, `icon`, `types`, `localTypes`, `group`, `relational`,
  `hideLabel`, `hideLoader`, `autoKey`, `recommendedDisplays`, `options`), file `.vue` cùng thư mục.
  Id: `boolean`, `collection-item-dropdown`, `collection-item-multiple-dropdown`, `datetime`, `file`, `file-image`,
  `files`, `group-accordion`, `group-detail`, `group-raw`, `group-tabs`, `input`, `input-autocomplete-api`,
  `input-block-editor`, `input-code`, `input-hash`, `input-multiline`, `input-rich-text-html`, `input-rich-text-md`,
  `list`, `list-m2a`, `list-m2m`, `list-o2m`, `list-o2m-tree-view`, `map`, `presentation-divider`, `header` (thư mục
  `presentation-header`), `presentation-links`, `presentation-notice`, `select-color`, `select-dropdown`,
  `select-dropdown-m2o`, `select-icon`, `select-multiple-checkbox`, `select-multiple-checkbox-tree`,
  `select-multiple-dropdown`, `select-radio`, `slider`, `tags`, `translations`.
- Interface hệ thống (28, `interfaces/_system/*`, `system: true`): dùng cho màn settings, cấu hình field, hồ sơ user và
  form options của interface/display (`system-input-translated-string`, `system-display-template`,
  `system-raw-editor`, `system-filter`, `system-fields`, `system-folder`...). Phạm vi: xem FR-004.
- Display (18): `displays/index.ts`, `displays/<id>/index.ts` (`defineDisplay`: `types`, `localTypes`, `fields`,
  `options`, `handler`), file `.vue`. Id: `boolean`, `collection`, `color`, `datetime`, `file`, `filesize`,
  `formatted-json-value`, `formatted-value`, `hash`, `icon`, `image`, `labels`, `mime-type`, `rating`, `raw`,
  `related-values`, `translations`, `user`.
- Form: `components/v-form/v-form.vue`, `v-form/utils/get-form-fields.ts`, `utils/apply-conditions.ts`,
  `utils/push-group-options-down.ts`, `components/form-field.vue`, `form-field-label.vue`, `form-field-menu.vue`,
  `form-field-interface.vue`, `form-field-raw-editor.vue`, `validation-errors.vue`, `utils/validate-item.ts`,
  `utils/clear-hidden-fields-by-condition.ts`, `utils/get-default-values-from-fields.ts`,
  `composables/use-edits-guard.ts`, `stores/fields.ts` (`parseField`, `translateFields`).
- Mặc định theo kiểu: `utils/get-default-interface-for-type.ts`, `utils/get-default-display-for-type.ts`.
- Hiển thị giá trị: `views/private/components/render-display.vue`, `render-template.vue`, `value-null.vue`,
  `utils/render-string-template.ts`, `utils/adjust-fields-for-displays.ts`, `composables/use-alias-fields.ts`,
  `utils/format-date.ts`, `components/use-datetime.vue`, `utils/format-filesize.ts`, `lang/date-formats.yaml`.
- Quan hệ: `composables/use-relation-m2o.ts`, `use-relation-o2m.ts`, `use-relation-m2m.ts`, `use-relation-m2a.ts`,
  `use-relation-single.ts`, `use-relation-multiple.ts`, `use-relation-permissions.ts`,
  `views/private/components/drawer-item.vue`, `drawer-collection.vue`, `drawer-files.vue`, `drawer-batch.vue`,
  `file-lightbox.vue`, `image-editor.vue`, `components/v-upload.vue`, `utils/get-item-route.ts`.
- Bản đồ: `utils/geometry/index.ts`, `utils/geometry/basemap.ts` (mặc định OpenStreetMap raster; Mapbox khi settings
  có `mapbox_key`; danh sách `basemaps` trong settings).
- Chuỗi dịch: `lang/translations/en-US.yaml` mục `interfaces:`, `displays:`, `validationError:`, `operators:`,
  `field_options:`, khóa gốc `interface_not_found`, `no_visible_fields`, `unsaved_changes`, `edit_raw_value`...

**Đã có từ feature 001 đến 012**: API đầy đủ cho mọi lời gọi của interface và display (`/items`, `/fields`,
`/relations`, `/collections`, `/permissions/me` (004, 005, 006); `/files`, `/files/import`, `/folders`, `/assets`
(007); `/flows/trigger/:id` (009); `/settings` (010)). `apps/web` (012) có khung TailAdmin, đăng nhập, store `server`,
`user`, `settings`, `permissions`, `fields` (chỉ nạp thô `/fields`, phần `parseField` để lại cho 013+), component
Tier 1 (`BoButton`, `BoInput`, `BoSelect`, `BoDialog`, `BoMenu`, `BoNotice`, `BoTooltip`, `BoAvatar`, `BoIcon`,
`BoProgress*`), tiện ích `translate-object-values`, `get-asset-url`, `user-name`, `markdown`, `get-date-fns-locale`,
chuỗi dịch `en-US`/`vi-VN` sinh từ Directus 11.17.4 (đã gồm mục `interfaces`, `displays`, `validationError`). Chưa có:
form theo metadata, mọi interface, mọi display, drawer chọn item, tải file trong form.

**Bộ test liên quan của Directus** (đếm ngày 2026-10-15: 39 file `*.test.ts` trong `interfaces/` và `displays/`, trong
đó 8 file thuộc `_system` đi cùng D-57; 013 port 31 file, FR-120):
`interfaces/index.test.ts`, `input/*.test.ts`, `datetime`, `input-code`, `input-hash`, `input-block-editor` (cả
`sanitize.test.ts`), `input-rich-text-html/useImage.test.ts`, `list-m2m`, `list-o2m`, `select-dropdown-m2o`,
`collection-item-multiple-dropdown`, `translations/translation-form.test.ts`, `group-accordion`, `group-detail`,
`group-raw`, `presentation-header` (`header`, `helper-text`), `presentation-links`, `select-color`, `select-icon`,
`select-multiple-checkbox`, `select-radio`, `tags`, các test của `displays/*` và `_system/*`. Không port nguyên văn
(viết cho component Directus); dùng làm danh sách hành vi cần kiểm (FR-120).

## User Scenarios & Testing *(mandatory)*

Người dùng là admin và người dùng app đã cấu hình collection, field ở Directus (interface, options, display,
display_options, điều kiện, validation, nhóm field) và nay mở cùng dữ liệu bằng app Backoffice. Họ cần thấy form và
giá trị giống như ở Directus app, nhập liệu giống như ở Directus app, và dữ liệu app mới ghi phải đọc lại đúng ở
Directus app.

Phạm vi: bộ interface, bộ display, bộ dựng form theo metadata (tương đương `v-form`), bộ hiển thị giá trị
(tương đương `render-display`, `render-template`), các drawer mà interface quan hệ và file cần. Feature này không có
màn hình mới: màn item, danh sách collection và E2E với dữ liệu thật thuộc 014 (D-40, Clarifications Q-A). Ở 013 mọi
story kiểm bằng test component, với cấu hình field, quan hệ và giá trị lấy từ DB do Directus tạo (FR-100).

### User Story 1 - Form nhập liệu theo cấu hình field (Priority: P1)

Người dùng mở một item; form hiện từng field bằng interface đã chọn ở Directus, với đúng options, độ rộng, thứ tự,
nhóm, ghi chú, field ẩn, chỉ đọc, bắt buộc, điều kiện và giá trị mặc định. Người dùng sửa giá trị, thấy dấu đã sửa,
lỗi validation, và menu field (xem, sửa, chép, dán giá trị thô, về mặc định, hoàn tác, xóa giá trị).

**Why this priority**: Form là nơi mọi interface sống; không có form thì không kiểm được interface nào.

**Independent Test**: Test component dựng form từ cấu hình field của bộ mẫu (FR-100) có mọi interface nhóm chuẩn và
lựa chọn (FR-020 đến FR-037), mỗi interface vài bộ options; khẳng định DOM và giá trị phát ra theo hành vi Directus.

**Acceptance Scenarios**:

1. **Given** field có `meta.interface = 'input'`, `options = {placeholder, iconLeft, softLength: 10, trim: true,
   font: 'monospace'}`, **When** mở form, **Then** ô nhập có placeholder, icon trái, font monospace, bộ đếm hiện khi còn
   ≤ 20% độ dài; rời ô thì giá trị bị cắt khoảng trắng.
2. **Given** field `meta.interface` null hoặc id không có (ví dụ interface của extension), **When** mở form, **Then**
   cả hai đều dùng interface mặc định theo kiểu (FR-002) như `get-form-fields.ts` Directus; `interface_not_found` chỉ
   hiện khi interface mặc định đó cũng không có.
3. **Given** `meta.conditions` có hai luật cùng khớp, **When** giá trị khác trong form đổi, **Then** luật khớp sau cùng
   quyết định `hidden`, `readonly`, `required`, `options` như Directus.
4. **Given** field `half` liền sau một field `half` hiện, **When** vẽ form, **Then** hai field nằm một hàng (trái, phải);
   field `full`, `fill` chiếm cả hàng.
5. **Given** người dùng sửa rồi đặt lại đúng giá trị ban đầu, **When** đọc giá trị form, **Then** field đó không còn
   trong danh sách thay đổi (không gửi lên API).
6. **Given** API trả lỗi `FAILED_VALIDATION` cho hai field, **When** lưu, **Then** form hiện thông báo lỗi tổng hợp,
   bấm từng lỗi cuộn tới field, field hiện thông điệp (`validation_message` nếu có, kèm thông điệp gốc ở tooltip).
7. **Given** field bắt buộc, **When** mở menu field, **Then** các mục và trạng thái bật tắt giống `form-field-menu.vue`.

---

### User Story 2 - Hiển thị giá trị theo display (Priority: P1)

Ở bảng và ở template hiển thị (tiêu đề item, giá trị quan hệ, header), mỗi giá trị hiện bằng display và
display_options đã cấu hình ở Directus; field không có display thì dùng display mặc định theo kiểu.

**Why this priority**: Bảng của mọi module (014 đến 018) dùng display; sai display là sai dữ liệu người dùng thấy.

**Independent Test**: Test component vẽ giá trị của bộ mẫu bằng 18 display và các tổ hợp options; so chuỗi hiển thị
và dạng chữ (handler) với kết quả mong đợi lấy từ hành vi Directus (cùng ngôn ngữ, cùng múi giờ).

**Acceptance Scenarios**:

1. **Given** display `datetime` với `relative: true, strict: true, round: 'floor'`, **When** hiện ô, **Then** chuỗi
   giống Directus ở cùng ngôn ngữ và tự cập nhật mỗi 60 giây.
2. **Given** display `formatted-value` với `conditionalFormatting` hai luật cùng khớp, **When** hiện ô, **Then** màu,
   nền, icon, chữ lấy theo luật sau cùng có giá trị như Directus.
3. **Given** display `labels` với `choices` có màu, `showAsDot: true`, **When** hiện ô, **Then** chỉ có chấm màu và
   tooltip là chữ của lựa chọn.
4. **Given** display `related-values` với template `{{ name }} ({{ category.name }})` trên field m2m, **When** hiện ô,
   **Then** hiện "N items" mở danh sách, mỗi dòng là template đã điền và link tới item.
5. **Given** giá trị null, **When** hiện ô, **Then** hiện `--` (ValueNull); display id không có thì hiện giá trị thô.

---

### User Story 3 - Quan hệ m2o, o2m, m2m, m2a, tree view, translations (Priority: P1)

Người dùng chọn item liên quan, tạo item mới lồng trong form, sửa item liên quan, bỏ liên kết, sắp thứ tự; mọi thay
đổi được gom vào giá trị của field theo đúng dạng Directus gửi lên API khi lưu item cha.

**Why this priority**: Phần lớn collection thật có quan hệ; dạng payload sai làm hỏng dữ liệu dùng chung.

**Independent Test**: Test component với quan hệ của bộ mẫu: m2o, o2m (list và table), m2m, m2a, tree view (quan hệ
đệ quy), translations; API giả lập trả dữ liệu đã ghi lại từ Directus; khẳng định request đọc và giá trị
`{create, update, delete}` phát ra.

**Acceptance Scenarios**:

1. **Given** m2o với `template`, `enableCreate`, `enableSelect`, `filter` có `{{ field }}`, **When** bấm chọn,
   **Then** drawer chọn item của collection liên quan có bộ lọc đã điền giá trị form; chọn xong field hiện template.
2. **Given** o2m layout `table` với `fields`, `tableSpacing`, `limit: 5`, `enableSearchFilter`, **When** có hơn 10
   item, **Then** có ô tìm kiếm, phân trang, độ rộng cột lưu lại theo field.
3. **Given** m2m: chọn hai item có sẵn, tạo một item mới, bỏ một item, **When** lưu item cha, **Then** giá trị gửi lên
   là `{ create: [...], update: [...], delete: [...] }` giống Directus.
4. **Given** translations với `languageField`, `defaultLanguage`, `userLanguage`, **When** mở form, **Then** ngôn ngữ
   đầu và thứ hai, thanh tiến độ mỗi ngôn ngữ, chế độ chia đôi (rộng hơn 960 px) giống Directus.
5. **Given** user không có quyền `create` trên collection liên quan, **When** mở field, **Then** nút tạo mới ẩn hoặc
   khóa như Directus.

---

### User Story 4 - File, ảnh, nhiều file (Priority: P2)

Người dùng tải file từ máy, chọn từ thư viện, nhập từ URL, xem ảnh lớn, tải xuống, sửa thông tin file, bỏ
chọn; `folder`, `allowedMimeTypes`, `crop`, `letterbox`, `limit` được áp.

**Why this priority**: Phổ biến nhưng phụ thuộc API file đã có (007); xếp sau form và quan hệ.

**Independent Test**: Test component với `file`, `file-image`, `files`; tải file, chọn từ thư viện, nhập URL; khẳng định
request (`POST /files` có `folder`, `POST /files/import` có `filterMimeType`) và giá trị field.

**Acceptance Scenarios**:

1. **Given** `file-image` với `folder` và `allowedMimeTypes: ['image/png']`, **When** tải ảnh, **Then** file vào đúng
   folder, chỉ nhận PNG, ảnh hiện bằng preset `system-large-cover` (`crop: true`) hoặc `system-large-contain`.
2. **Given** `files` với `limit: 3` và collection nối có field sort, **When** kéo đổi thứ tự, **Then** field sort được
   ghi `index + 1` như Directus.

---

### User Story 5 - Soạn thảo nội dung giàu: rich text, markdown, block editor, code, bản đồ, repeater (Priority: P2)

Người dùng soạn HTML, markdown, block, code, vẽ hình học trên bản đồ, nhập danh sách lặp; giá trị lưu có cùng định dạng
với Directus để mở lại ở Directus app không đổi.

**Why this priority**: Ít field hơn nhưng định dạng dữ liệu phức tạp; sai định dạng là mất nội dung.

**Independent Test**: Mỗi interface: nạp giá trị do Directus ghi (bộ mẫu), không sửa thì không phát thay đổi; sửa thì
giá trị phát ra đúng dạng JSON/HTML/WKT như Directus (so với giá trị mong đợi trong bộ mẫu).

**Acceptance Scenarios**:

1. **Given** `input-rich-text-html` với `toolbar` tùy chọn, `imageToken`, **When** chèn ảnh từ thư viện, **Then** URL
   ảnh có dạng `<public url>assets/<id>.<ext>` kèm `access_token` như Directus.
2. **Given** `input-block-editor` với `tools: ['header','image','table']`, **When** lưu, **Then** giá trị là
   `{ time, version, blocks }` đã khử HTML nguy hiểm; không có block thì null.
3. **Given** `map` trên field `string`, **When** vẽ một điểm, **Then** giá trị lưu là WKT; field `json` lưu GeoJSON;
   field `csv` lưu `[lng, lat]`.
4. **Given** `list` với `fields`, `template`, `sort`, **When** thêm hai mục, **Then** giá trị là mảng object; field con
   bắt buộc trống thì không lưu được mục.

---

### User Story 6 - Nhóm field và presentation (Priority: P2)

Field nhóm (accordion, detail, raw, tabs) gom field con; presentation (divider, header, links, notice) hiện tiêu đề,
ghi chú, nút link hoặc chạy flow thủ công.

**Why this priority**: Ảnh hưởng bố cục form, ít ảnh hưởng dữ liệu.

**Independent Test**: Test component với nhóm lồng nhau và đủ bốn presentation của bộ mẫu; khẳng định trạng thái mở,
tab đang chọn, nút.

**Acceptance Scenarios**:

1. **Given** `group-accordion` `accordionMode: true`, `start: 'first'`, **When** mở form, **Then** chỉ mục đầu mở; lỗi
   validation ở mục khác thì mục đó mở.
2. **Given** `header` với `links` gồm một link URL `/content/...{{ id }}` và một link flow, **When** mở item đã có,
   **Then** có menu "Actions" hai mục; link nội bộ điều hướng trong app; flow chạy qua `POST /flows/trigger/:id`; item
   mới (`+`) thì nút flow bị khóa.
3. **Given** nhóm `readonly`, **When** vẽ form, **Then** mọi field con chỉ đọc (đẩy option xuống như Directus).

---

### User Story 7 - Đọc đúng cấu hình và dữ liệu do Directus tạo (Priority: P2)

Field cấu hình ở Directus và giá trị Directus đã ghi hiện đúng ở app mới. Bộ mẫu (FR-100) lấy từ DB do Directus tạo là
đầu vào của mọi test component. E2E với Directus app và ba cấu hình API (FR-071 của 012) chạy ở 014, khi có màn item
(Clarifications Q-A).

**Why this priority**: Là tiêu chí chấp nhận của mô tả ("đọc được cấu hình hiện có") và cổng đóng feature.

**Independent Test**: Script seed tạo collection mẫu bằng API Directus thật rồi xuất `fields`, `relations`,
`collections`, item và file mẫu thành bộ fixture commit trong repo; test component nạp toàn bộ bộ mẫu.

**Acceptance Scenarios**:

1. **Given** bộ mẫu đủ 40 interface và 18 display, **When** dựng form và bảng cho mọi collection mẫu trong test,
   **Then** 0 field hiện `interface_not_found`, 0 lỗi hoặc cảnh báo Vue, mọi khẳng định DOM đạt.
2. **Given** giá trị Directus đã ghi cho mọi interface, **When** dựng form và không sửa, **Then** form không phát thay
   đổi nào; sửa theo kịch bản thì giá trị phát ra bằng giá trị mong đợi trong bộ mẫu.
3. **Given** script seed, **When** chạy lại với API mới, **Then** bộ fixture xuất ra giống bản chạy với Directus (trừ
   id và thời gian), để fixture không phụ thuộc API nào sinh ra.

---

### Edge Cases

- `meta.options` thiếu khóa: dùng giá trị mặc định của component Directus (không phải mặc định của form options), ví
  dụ `boolean.colorOn` → màu primary, `slider.maxValue` → 100, `datetime.use24` → true ở interface nhưng display
  `datetime.use24` → false.
- Options có kiểu khai báo lệch của Directus: `select-radio.allowOther` và `translations.userLanguage` khai báo
  `string` nhưng lưu `true`/`false`: đọc như boolean.
- Option tham chiếu interface id cũ không còn (`text-input`, `code`, `toggle` ở form options): chỉ ảnh hưởng màn cấu
  hình field (016), không ảnh hưởng hiển thị.
- `display = 'badge'` (Directus `select-radio` gợi ý `badge` nhưng không có display này): hiện giá trị thô như
  Directus khi display không có.
- Field nhóm có `meta.interface` null: Directus vẽ `interface-group-standard` không tồn tại. Đo ngày 2026-10-15 trên
  Directus app 11.17.4 (bản production, form tạo item): nhóm và mọi field con không hiện, không lỗi, không cảnh báo
  console; field ngoài nhóm hiện bình thường. App mới làm giống: không vẽ nhóm và field con, không cảnh báo (T004).
- Chuỗi `$t:key` trong `note`, `options`, `display_options`, `validation_message`, nhãn field
  (`meta.translations`): dịch như Directus; không có khóa thì hiện chuỗi gốc bỏ tiền tố như Directus.
- Giá trị không đúng dạng (ví dụ `list` không phải mảng, `map` sai loại hình học, JSON hỏng ở `input-code`, block editor
  `version` cũ): làm theo từng component Directus (list: notice; map: lỗi kiểu hình học; code: hiện chuỗi; block
  editor: Editor.js tự đọc), không ném lỗi, không ghi đè giá trị; bộ mẫu có ít nhất một giá trị lệch dạng cho list,
  map, code (FR-100).
- `map` chỉ báo lỗi sai loại hình học với field `geometry.*` (vẽ giới hạn theo kiểu con của field, như `map.vue`); field
  `json`/`string` có giá trị khác `geometryType` thì không báo lỗi, như Directus.
- `map` không có `defaultView`: vừa dữ liệu nếu có, không thì vùng mặc định của `map.vue` Directus; style nền lỗi thì
  khung trống, vẫn vẽ được.
- `translations`: collection ngôn ngữ trống → không có form, thanh ngôn ngữ trống, không thông báo (như `translations.vue`
  Directus 11.17.4); `languageField` trỏ field
  không còn → dùng khóa chính; `defaultLanguage` không có trong danh sách → ngôn ngữ đầu.
- `collection-item-dropdown`: `selectedCollection` không còn hoặc không có quyền đọc → lỗi tải hiện trong field, không ném
  lỗi; singleton bị loại khỏi lựa chọn như Directus.
- Template (interface quan hệ, `related-values`, `header`) tham chiếu field user không đọc được hoặc field không còn:
  phần đó trống (`--` ở display) như `render-template.vue`.
- `filter` có `{{ field }}` mà field nguồn đổi sau khi đã chọn: giữ lựa chọn như Directus [Inference từ code, kiểm khi
  port].
- Giá trị dài (chuỗi rất dài, nhiều tags, nhiều lựa chọn): như Directus (cắt chữ trong bảng, tags xuống dòng); không
  thêm giới hạn.
- `tz` không hợp lệ, trình duyệt khác múi giờ, giờ chuyển mùa: xử lý như Directus (`date-fns-tz`).
- Interface ném lỗi khi vẽ: hộp lỗi bọc từng field hiện `unexpected_error`, các field khác vẫn dùng được.
- Collection quan hệ là singleton hoặc chưa cấu hình quan hệ: thông báo như Directus (`select-dropdown-m2o`,
  `list-m2m`, `list-m2a`).
- `input-autocomplete-api` với URL ngoài: gọi thẳng URL đó với `credentials: 'omit'`, không header phiên (như axios của
  Directus); URL bắt đầu bằng `/` gọi qua API với phiên đăng nhập; lỗi mạng thì không có gợi ý, không chặn nhập.
- Bản đồ không tải được tile (mạng chặn OpenStreetMap): khung bản đồ trống, nhập liệu vẫn được (vẽ, xóa).
- Màn hình hẹp (768 px): lưới form vẫn hai cột (Q-1); drawer chiếm toàn bề rộng dưới `xl` như L-4 (Q-10).
- Translations không chia đôi khi bề rộng ≤ 960 px.
- Field là hash: ô nhập không bao giờ chứa hash đã lưu; có giá trị thì placeholder `value_securely_stored` (FR-066).
- Màu từ dữ liệu (choices, `colorOn`, `defaultColor`, `conditionalFormatting`) là giá trị người dùng nhập: áp nguyên
  (inline style) như Directus, kể cả hex; không phải token của theme (Q-C). Tương phản thấp do màu dữ liệu chấp nhận
  như Directus; bộ mẫu dùng màu đạt tương phản; ngoại lệ axe chỉ cho màu dữ liệu (SC-005).

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| US1 | 1–7 | FR-001 đến FR-019, FR-020 đến FR-036 | SC-001, SC-003, SC-005 |
| US2 | 1–5 | FR-002, FR-003, FR-070 đến FR-079 | SC-001, SC-004 |
| US3 | 1–5 | FR-040 đến FR-049 | SC-002 |
| US4 | 1–2 | FR-050 đến FR-054 | SC-002 |
| US5 | 1–4 | FR-037, FR-060 đến FR-066 | SC-002 |
| US6 | 1–3 | FR-055 đến FR-059 | SC-001 |
| US7 | 1–3 | FR-080 đến FR-084, FR-090 đến FR-095, FR-100, FR-120 đến FR-123 | SC-001, SC-002, SC-006 đến SC-009 |

## Requirements *(mandatory)*

### Functional Requirements

**Đăng ký, mặc định, đọc options**

- **FR-001**: App PHẢI có một bản tương ứng cho mỗi interface id (40) và display id (18) ở phần tham chiếu, cùng id,
  cùng `types`/`localTypes`, cùng nhãn (`name` qua chuỗi dịch) và icon, để danh sách sau này (016) và việc tra theo id
  khớp Directus. `recommendedDisplays` giữ nguyên văn (dữ liệu cho 016), kể cả id không có (`badge`).
- **FR-002**: `meta.interface` null hoặc rỗng PHẢI dùng interface mặc định theo kiểu như
  `get-default-interface-for-type.ts` (`input` cho alias, bigInteger, binary, decimal, float, integer, string, uuid,
  unknown; `boolean`; `datetime` cho date, dateTime, time, timestamp; `input-code` cho json; `input-multiline` cho
  text; `tags` cho csv; `input-hash` cho hash; `map` cho geometry và `geometry.*`). `meta.display` null PHẢI dùng
  display mặc định như `get-default-display-for-type.ts` (`formatted-value` cho bigInteger, decimal, float, integer,
  string, text, uuid, hash; `boolean`; `datetime`; `labels` cho csv; `raw` cho còn lại).
- **FR-003**: Interface id không đăng ký PHẢI được thay bằng interface mặc định theo kiểu như `get-form-fields.ts`
  Directus; `interface_not_found` chỉ hiện khi interface mặc định cũng không có (như `form-field-interface.vue`). Display
  id không có PHẢI hiện giá trị dạng chữ (như `render-display.vue`). Interface và display của extension Directus không được nạp (D-41).
- **FR-004**: Trong 28 interface `_system`, 013 chỉ làm `system-raw-editor` (trình sửa thô của menu field, FR-017):
  options `language` (`mustache` hoặc `plaintext`), `placeholder`, chỉ đọc khi `disabled`; dùng trong hộp sửa thô cho
  kiểu không phải object. 27 interface còn lại làm ở feature có màn dùng chúng (D-57, Clarifications Q-B).
- **FR-005**: Mọi khóa options và display_options mà Directus 11.17.4 định nghĩa (liệt kê ở FR-020 đến FR-079) PHẢI được
  đọc từ giá trị đã lưu trong `directus_fields`; app không ghi `directus_fields`. Danh sách khóa là danh sách đóng lấy
  từ `index.ts` Directus; test registry (contracts/registry §3) lệch thì sửa spec cùng commit. Khóa thiếu dùng mặc định
  trong `defineProps`/`withDefaults` của file `.vue` Directus; component không có mặc định thì lấy
  `schema.default_value` của option; file chép giữ nguyên các mặc định này. Khóa lạ không lọc: rơi xuống phần tử gốc
  như attribute (hành vi Vue, như Directus).
- **FR-006**: Chuỗi `$t:` trong `meta.note`, `options`, `display_options`, `validation_message`, và nhãn field từ
  `meta.translations` PHẢI dịch như `stores/fields.ts` (`parseField`, `translateFields`); nhãn mặc định là
  `formatTitle(field)`. Đổi ngôn ngữ khi form đang mở thì dịch lại nhãn, ghi chú, options và display định dạng lại.

**Form theo metadata (tương đương `v-form`)**

- **FR-010**: Thứ tự field: theo `meta.group`, `meta.sort`, `meta.id` như `get-form-fields.ts`; bỏ field có tiền tố
  `$`; field hệ thống (`meta.system`) đứng trước field người dùng, ngăn bằng divider chỉ hiện khi cả hai nhóm có field
  hiện.
- **FR-011**: Độ rộng `half`, `half-left`, `half-right`, `full`, `fill` như `updateFieldWidths` (field `half` liền sau
  field `half` hiện thành `half-right`); bề rộng form lớn hơn 726 px thì có cột `fill` như Directus.
- **FR-012**: `meta.hidden` ẩn field; `meta.readonly`, `schema.is_generated`, `disabled`, `loading` khóa field; khóa
  chính tự tăng hoặc `special: uuid` chỉ đọc trừ khi tạo mới; `meta.required` có dấu `*`.
- **FR-013**: `meta.conditions` PHẢI áp như `apply-conditions.ts` (luật khớp sau cùng thắng; `rule` đánh giá trên giá
  trị form gộp `schema.default_value`, có `$version` (= `null` ở 013, chưa có màn versions); đè `hidden`, `readonly`, `required`, `options` (mảng thay cả
  mảng)); `clear_hidden_value_on_save` đưa field bị ẩn về mặc định hoặc null khi lưu, kể cả field trong nhóm đó.
- **FR-014**: Nhóm: `readonly`/`required` của nhóm đẩy xuống field con như `push-group-options-down.ts`; field nhóm vẽ
  bằng interface nhóm (FR-055) với form con theo `meta.group`.
- **FR-015**: Giá trị: form nhận giá trị ban đầu và chỉ phát ra phần đã sửa; giá trị sửa bằng giá trị ban đầu (hoặc mặc
  định khi tạo mới) thì bỏ khỏi phần đã sửa; giá trị mặc định lấy từ `schema.default_value` (bỏ chuỗi mặc định của
  khóa chính số, như `get-default-values-from-fields.ts`). Tạo mới (`primaryKey = '+'`): mặc định áp, khóa chính sửa
  được (FR-012), nút flow khóa (FR-057), lọc chọn o2m khi cha chưa có khóa như Directus (FR-043).
- **FR-016**: Nhãn field như `form-field-label.vue`: tên, chấm "đã sửa" có tooltip `edited`, dấu bắt buộc, chỉ báo ẩn,
  nút bật trình sửa thô; ghi chú `meta.note` render markdown, link mở tab mới. Interface có `hideLabel` thì không có
  nhãn (giữ khoảng trống trừ độ rộng `full`/`fill`).
- **FR-017**: Menu field như `form-field-menu.vue`: `edit_raw_value`/`view_raw_value`, `copy_raw_value`,
  `paste_raw_value`, `reset_to_default`, `undo_changes`, `clear_value`, cùng điều kiện bật tắt; trình sửa thô là hộp
  thoại, ép kiểu khi lưu (number, boolean, JSON) như `form-field-raw-editor.vue`.
- **FR-018**: Lỗi validation: thông báo tổng hợp `validation_errors_notice` liệt kê `tên field: thông điệp`, bấm thì cuộn
  tới field, có biến thể "(hidden)" và "(Hidden in {group})"; thông điệp theo `validationError.<type>`,
  `RECORD_NOT_UNIQUE` → `validationError.unique`; `validation_message` thay thông điệp gốc khi có (gốc ở tooltip);
  validation phía client như `validate-item.ts` (bắt buộc, `meta.validation`, mảng quan hệ rỗng coi là null). Lỗi lồng
  chỉ có ở `translations` như Directus; drawer item kiểm hợp lệ phía client trước khi gom thay đổi.
- **FR-019**: Form hỗ trợ `autofocus` (field hiện đầu tiên không chỉ đọc), `direction` (rtl; chỉ truyền ở chỗ Directus
  truyền: nhóm, translations, `dir` của input, `directionality` của TinyMCE), chế độ batch như `useBatch` (mọi field
  như Directus, kể cả khóa chính; ô chọn ở nhãn bật field, bật thì đặt `schema.default_value`) cho drawer sửa hàng loạt (FR-046), skeleton khi đang tải (trừ `hideLoader`),
  mỗi field bọc hộp lỗi riêng (`unexpected_error`), thông báo `no_visible_fields` khi không có field hiện.

**Interface nhóm chuẩn, chữ, số, ngày** (options là khóa trong `meta.options`; mặc định trong ngoặc)

- **FR-020** `input` (string, uuid, bigInteger, integer, float, decimal, text): integer, float: `min`, `max`, `step`
  (1), `placeholder`, `iconLeft`, `iconRight`, `font` (`sans-serif`); kiểu khác: `placeholder`, `iconLeft`,
  `iconRight`, `softLength`, `font`, `trim` (false), `masked` (false), `clear` (false), `slug` (false). Hành vi: ô
  `password` khi `masked`, `number` cho integer/float; `clear` tắt thì chuỗi rỗng thành null; bộ đếm còn lại theo
  `softLength` hoặc `schema.max_length` (hiện khi ≤ 20%, cảnh báo < 10%, nguy hiểm < 5%); `slug` lọc phím và slugify
  với `-`; `trim` khi rời ô; integer làm tròn xuống, float đổi `,` thành `.`; bigInteger, decimal giữ dạng chuỗi (không
  mất chính xác khi vượt `Number.MAX_SAFE_INTEGER`); float không hợp lệ không phát.
- **FR-021** `input-multiline` (text): `placeholder`, `softLength`, `trim`, `font`, `clear`; bộ đếm tính xuống dòng
  là một ký tự.
- **FR-022** `input-hash` (hash): `placeholder`, `masked`; không hiện hash đã lưu; có giá trị thì placeholder
  `value_securely_stored` và icon khóa; phát chuỗi gốc người dùng gõ (server băm).
- **FR-023** `input-autocomplete-api` (string, text): `url` (điền `{{value}}`), `resultsPath`, `textPath`,
  `valuePath`, `trigger` (`throttle`|`debounce`), `rate` (500), `placeholder`, `font`, `iconLeft`, `iconRight`; URL
  bắt đầu bằng `/` gọi qua API có phiên, URL khác gọi trực tiếp với `credentials: 'omit'` và không header phiên; kết quả
  không phải mảng thì không gợi ý; thiếu `url` hiện cảnh báo.
- **FR-024** `boolean`: `label` (`$t:interfaces.boolean.label_default`, rơi về `enabled`), `iconOn`
  (`check_box`), `iconOff` (`check_box_outline_blank`), `colorOn`, `colorOff`; null hiện trạng thái không xác định.
- **FR-025** `datetime` (dateTime, date, time, timestamp): `relative`, `format` (`long`|`short`|mẫu tr35), `includeSeconds`,
  `use24` (mặc định `true` ở interface; display mặc định `false`, FR-074), `tz` (chỉ timestamp: hiện và nhập theo múi
  giờ), `suffix`, `strict`, `round`; phát chuỗi hoặc null: `date` `YYYY-MM-DD`, `time` `HH:mm:ss`, `dateTime`
  `YYYY-MM-DDTHH:mm:ss`, `timestamp` `Date.toISOString()` (có mili giây và `Z`, ví dụ `2024-03-15T07:30:45.000Z`; có `tz` thì hiện theo
  múi giờ và phát `fromZonedTime(...).toISOString()`); giây là `00` khi tắt `includeSeconds` (đã kiểm ở T036); giá trị
  không hợp lệ hiện trống, vẫn có nút xóa, không cảnh báo (như Directus).
- **FR-026** `slider` (integer, float): `minValue` (0), `maxValue` (100), `stepInterval` (1), `alwaysShowValue`.
- **FR-027** `tags` (json, csv): `presets`, `placeholder`, `alphabetize`, `allowCustom` (true), `whitespace`
  (`-`|`_`|`''`), `capitalization` (`uppercase`|`lowercase`|`auto-format`), `iconLeft`, `iconRight`
  (`local_offer`); thêm bằng Enter, dấu phẩy, rời ô; xử lý trim → hoa thường → khoảng trắng → sắp xếp → bỏ trùng;
  `allowCustom` tắt thì bỏ giá trị ngoài presets; giá trị chuỗi dạng biến (`{{...}}`) khi bật trình sửa thô thì chỉ
  đọc, có nút xóa. Field `csv` (ở đây và FR-031, FR-033, FR-034): phát mảng như Directus app, API nối thành chuỗi.
- **FR-028** `input-code` (string, json, text, geometry): `language` (không cho json; danh sách mode như CodeMirror
  `modeInfo`, mặc định `plaintext`), `lineNumber` (true), `lineWrapping` (false), `template` (nút điền mẫu); json:
  phát JSON đã parse, rỗng là null, JSON hỏng không phát, chuỗi đúng mẫu `{{ biến }}` phát nguyên chuỗi; báo lỗi cú
  pháp JSON như Directus (`jsonlint-mod`).

**Interface lựa chọn**

- **FR-030** `select-dropdown` (string, integer, float, decimal, bigInteger): `choices` (`{text, value, icon?, color?}`),
  `allowOther`, `allowNone`, `icon`, `placeholder` (mặc định `select_an_item`); lựa chọn có icon thì lựa chọn không icon,
  không màu nhận `icon` chung; `choices` đổi mà giá trị không còn trong đó thì phát null.
- **FR-031** `select-multiple-dropdown` (json, csv): `choices`, `allowOther`, `allowNone`, `placeholder`, `icon`,
  `previewThreshold` (3); mảng phát ra sắp theo thứ tự `choices`, giá trị tự nhập đứng cuối.
- **FR-032** `select-radio` (string, integer, float, bigInteger): `choices`, `iconOn` (`radio_button_checked`), `iconOff`
  (`radio_button_unchecked`), `color`, `allowOther` (ô "khác").
- **FR-033** `select-multiple-checkbox` (json, csv): `choices` (cho phép `disabled` từng lựa chọn), `allowOther`,
  `color`, `iconOn`, `iconOff`, `itemsShown` (8, có "hiện thêm"); bố cục lưới theo số lựa chọn và độ rộng field.
- **FR-034** `select-multiple-checkbox-tree` (json, csv): `choices` lồng (`{text, value, children}`), `valueCombining`
  (`all`|`branch`|`leaf`|`indeterminate`|`exclusive`, mặc định `all`); tìm kiếm khi hơn 10 gốc; bật "chỉ hiện đã chọn".
- **FR-035** `select-icon` (string): bộ icon và nhóm như `icons.json` của Directus kèm nhóm Social (icon thương hiệu
  Font Awesome, vẽ như `social-icon.vue`; ghi công icon theo giấy phép của chúng); tìm kiếm; cuộn ảo như Directus; phát
  tên icon hoặc null.
- **FR-036** `select-color` (string): `opacity` (false), `presets` (`{name, color}`, mặc định 9 màu của Directus);
  nhập hex, RGB/HSL (RGBA/HSLA khi `opacity`), thanh trượt, bộ chọn màu của trình duyệt, cảnh báo tương phản thấp;
  phát `#RRGGBB` hoặc `#RRGGBBAA`; nhận `var(--x)` như gõ; nhập sai phát null.
- **FR-037** `list` (json, repeater): options `fields` (`{field, name, type, meta: {width, required, note, interface,
  options, display, display_options}}`), `template`, `addLabel`, `sort`; mảng object, rỗng là null; kéo đổi thứ tự
  (tắt khi có `sort`, khi đó sắp theo `sort`); sửa từng mục trong drawer có form con; field con bắt buộc trống thì không
  lưu mục; hỏi trước khi bỏ thay đổi chưa lưu; giá trị không phải mảng thì cảnh báo.

**Interface quan hệ**

- **FR-040**: Dạng giá trị như `use-relation-single.ts` và `use-relation-multiple.ts`: m2o là khóa, object thay đổi
  (tạo hoặc sửa lồng) hoặc null; o2m, m2m, m2a, files, translations là `{ create, update, delete }`, cả ba rỗng thì
  không có thay đổi. Interface quan hệ nhận prop `version` và xử lý như composable Directus (giá trị là mảng khóa khi có
  version); màn chọn và so sánh version ở 014 (D-55). Lồng không giới hạn độ sâu như Directus: thay đổi của drawer con
  gom vào giá trị của field trong drawer cha.
- **FR-041**: Option `filter` của interface quan hệ PHẢI điền `{{ field }}` bằng giá trị form hiện tại rồi áp như
  Directus; template hiển thị rơi về `display_template` của collection rồi `{{ khóa chính }}`; quyền lấy từ
  `/permissions/me` như `use-relation-permissions.ts`: tạo mới = `create` trên collection liên quan (m2m, m2a thêm
  `create` trên collection nối); chọn có sẵn = `update` trên collection nối hoặc trên khóa ngoại; bỏ chọn = `update`
  hoặc `delete` theo FR-043; sửa = `update` trên collection liên quan; sắp xếp = `update` field sort. Form chỉ đọc
  (`disabled`): ẩn tạo, chọn, bỏ chọn; vẫn xem lớn, tải xuống; link tới item chỉ mở được khi `nonEditable` (với
  `disabled` icon hiện nhưng không là link), như Directus.
- **FR-042** `select-dropdown-m2o` (m2o): `template`, `enableCreate` (true), `enableSelect` (true), `filter`,
  `enableLink` (false); bấm mở drawer chọn khi `enableSelect`, nếu không thì drawer tạo/sửa; thông báo khi quan hệ chưa
  cấu hình, collection singleton, không có template, tắt cả tạo lẫn chọn.
- **FR-043** `list-o2m` (o2m): `layout` (`list`|`table`), `tableSpacing` (`cozy`; chiều cao hàng 29/43/58), `fields`,
  `template`, `enableCreate`, `enableSelect`, `limit` (15), `filter`, `sort`, `sortDirection` (`+`), `enableSearchFilter`
  (table, hiện khi hơn 10 item), `enableLink`; quan hệ có `sortField` thì sắp và kéo theo `sortField` (bỏ qua option
  `sort`), kéo khi mọi item trên một trang và có quyền sửa; không có `sortField` thì sắp ban đầu theo
  `sort`/`sortDirection`, không kéo; chọn item có sẵn lọc bỏ item đã thuộc item khác như Directus; bỏ chọn theo
  `relation.meta.one_deselect_action`: `nullify` → `update` đặt khóa ngoại null, `delete` → `delete`.
- **FR-044** `list-m2m` (m2m): như FR-043 cộng `junctionFieldLocation` (`bottom`), `allowDuplicates` (false); sửa qua
  drawer trên collection nối; table có chọn nhiều để sửa hàng loạt (FR-046); dữ liệu đã có bản trùng thì hiện đủ như
  Directus (`allowDuplicates` chỉ ảnh hưởng bộ lọc chọn).
- **FR-045** `list-m2a` (m2a): `enableSelect`, `enableCreate`, `limit` (15), `allowDuplicates`, `prefix` (template trên
  collection nối); tạo mới và thêm có sẵn theo từng collection cho phép (bỏ singleton); template mỗi collection là
  `display_template` của nó hoặc khóa chính.
- **FR-046**: Drawer dùng chung: drawer item (tạo, sửa item liên quan hoặc dòng nối, có form theo FR-010 đến FR-019),
  drawer chọn item của một collection (luôn dạng bảng: cột theo preset như `usePreset` Directus (user rồi role rồi
  global, không bookmark), lấy `layout_query.tabular.fields` nếu có, không thì 4 field hiện đầu như `layouts/tabular`;
  tìm kiếm, phân trang, chọn một hoặc nhiều, bộ lọc của interface; layout khác của preset và bộ lọc nâng
  cao ở 014, D-58), drawer sửa hàng loạt (form chế độ batch, gom vào thay đổi), drawer chọn file (FR-050). Độ rộng cột của
  bảng trong interface lưu ở localStorage theo collection và field (khóa đổi tiền tố `backoffice-`, D-39). Trạng thái
  như Directus: skeleton khi tải, `no_items` khi trống, notice lỗi qua `translateAPIError` (`403`, `500`).
- **FR-047** `list-o2m-tree-view` (o2m đệ quy): `displayTemplate`, `enableCreate`, `enableSelect`, `filter`; kéo thả
  giữa các cấp, thay đổi con lồng trong `create`/`update` của cha như Directus; đổi cấp bằng bàn phím qua menu dòng
  "Thụt vào", "Thụt ra" (D-60); quan hệ không đệ quy thì thông báo.
- **FR-048** `translations`: `languageField`, `languageDirectionField` (mặc định `direction` khi collection ngôn ngữ có
  field đó), `defaultLanguage`, `userLanguage`, `defaultOpenSplitView`; nạp toàn bộ ngôn ngữ (sắp theo field sort, rồi
  `languageField`, rồi khóa chính); tiến độ mỗi ngôn ngữ; chia đôi khi rộng hơn 960 px và có hơn một ngôn ngữ; form mỗi
  ngôn ngữ có `badge` tên ngôn ngữ, `direction` theo ngôn ngữ; lỗi validation theo dạng `field.lang.subfield`.
- **FR-049** `collection-item-dropdown` (json, giá trị `{key, collection}`) và `collection-item-multiple-dropdown`
  (json, mảng `{key, collection}`, rỗng là null, kéo đổi thứ tự): `selectedCollection`, `template`, `filter`.

**Interface file**

- **FR-050** `file` (uuid, m2o tới `directus_files`): `folder`, `filter`, `enableCreate`, `enableSelect`,
  `allowedMimeTypes`; tải từ máy, chọn từ thư viện (drawer file có lọc kiểu và bộ lọc), nhập từ URL (`POST /files/import`
  với `folder` và `filterMimeType`), sửa thông tin file (drawer item trên `directus_files`), tải xuống, bỏ chọn; ảnh xem
  trước bằng preset `system-small-cover` có `cacheBuster`; SVG không biến đổi. Tải như `v-upload.vue`: thanh tiến độ,
  lỗi qua `translateAPIError` (`413`, kiểu bị từ chối), tải nhiều file báo lỗi từng file; không có nút hủy (Directus
  không có).
- **FR-051** `file-image`: như FR-050 cộng `crop` (true), `letterbox` (false); ảnh `system-large-cover` hoặc
  `system-large-contain`; xem lớn, lỗi tải ảnh hiện thông điệp theo mã lỗi; nút chỉnh ảnh chưa có (D-59).
- **FR-052** `files` (m2m tới `directus_files`): `folder`, `template`, `filter`, `enableCreate`, `enableSelect`, `limit`
  (15), `allowedMimeTypes`; tải nhiều file; sắp xếp ghi field sort `index + 1`; menu mỗi dòng mở tab mới, tải xuống.
- **FR-053**: Tải file dùng `POST /files` (multipart) với `folder` của option. Danh sách kiểu được phép của server lấy
  từ `/server/info` `files.mimeTypeAllowList` (thêm vào store server của 012) và dùng cho block editor như Directus;
  `allowedMimeTypes` của option dùng làm `accept` và lọc thư viện.
- **FR-054**: Danh sách request ghi do interface tự gửi (ngoài lần lưu item của màn chứa): `POST /files`,
  `POST /files/import`, `POST /flows/trigger/:id` (FR-057); không có request ghi khác.

**Interface nhóm và presentation**

- **FR-055**: `group-accordion` (`accordionMode` true, `start` `closed`|`first`|`opened` khi tắt accordionMode; Shift+bấm
  mở/đóng hết khi tắt accordionMode; mục có lỗi tự mở), `group-detail` (`start` `open`|`closed`, `headerIcon`,
  `headerColor`; có chấm đã sửa và tooltip lỗi; tự mở khi có lỗi), `group-raw` (không khung), `group-tabs` (`fillWidth`;
  tab mặc định là field hiện đầu tiên, chuyển tới tab đầu có lỗi; theo `direction`).
- **FR-056** `presentation-divider`: `title`, `color`, `icon`, `inlineTitle`.
- **FR-057** `header` (id `header`): `title`, `subtitle` (template trên giá trị form, có nạp dữ liệu quan hệ), `color`,
  `icon`, `help` (HTML đã khử), `helpDisplayMode` (`inline`|`modal`), `enableHelpTranslations`,
  `helpTranslationsString`, `links` (`label`, `icon`, `type` normal|primary|info|success|warning|danger, `actionType`
  url|flow, `url` có `{{ }}`, `flow`); URL bắt đầu bằng `/` điều hướng trong app, khác thì link ngoài; một link là nút,
  nhiều link là menu "Actions"; nút flow chạy flow thủ công như `useRunManualFlow` Directus (hộp xác nhận khi
  `requireConfirmation`: mô tả, form từ `options.fields`, hủy; thông báo thành công hoặc lỗi), phát sự kiện "đã chạy" để
  màn chứa (014) nạp lại item; khóa khi item mới hoặc `nonEditable`. Store flows như Directus: không có quyền đọc
  `directus_flows` thì danh sách rỗng, không gọi API; lỗi thì rỗng, không chặn hydrate.
- **FR-058** `presentation-links`: `links` như FR-057; nạp field quan hệ của URL bằng `GET` item hiện tại; nút flow chỉ
  hiện khi flow đang bật.
- **FR-059** `presentation-notice`: `color` (`normal`|`info`|`success`|`warning`|`danger`), `icon` (`info`), `text`
  (markdown).

**Interface soạn thảo giàu và bản đồ**

- **FR-060** `input-rich-text-html` (text): `toolbar` (mặc định và danh sách nút như Directus, tên cũ `link`, `media`,
  `code`, `image`, `pre`, `inlinecode` ánh xạ sang nút tương ứng), `font`, `folder`, `imageToken`, `softLength`,
  `customFormats`, `tinymceOverrides`; chèn ảnh (URL, alt, kích thước khi `storage_asset_transform = all`, lazy, preset),
  media (video, embed), link (url, chữ, title, tab mới), sửa mã nguồn; phát HTML hoặc null; HTML lưu giữ nguyên như
  Directus (không chuẩn hóa thêm). Cấu hình TinyMCE giống Directus (`extended_valid_elements`, `convert_urls: false`...),
  dựa vào lọc XSS sẵn có của TinyMCE khi mở lại HTML (chưa cài: TinyMCE 6.8.6 có advisory XSS high, chỉ vá ở bản GPL; chờ owner,
  research R1; field dùng interface này tạm hiện bằng interface mặc định theo kiểu); hiển thị trong bảng qua
  `formatted-value` đã khử HTML.
- **FR-061** `input-rich-text-md` (text): `toolbar`, `placeholder`, `folder`, `imageToken`, `softLength`, `editorFont`,
  `previewFont`, `defaultView` (`editor`|`preview`), `customSyntax` (`{name, icon, prefix, suffix, box}`); phím tắt như
  Directus; xem trước markdown đã khử HTML; chèn ảnh `![..](<asset url>[?access_token=imageToken])`.
- **FR-062** `input-block-editor` (json): `placeholder`, `font`, `tools` (mặc định header, nestedlist, code, image,
  paragraph, checklist, quote, underline; lựa chọn thêm embed, attaches, table, inlinecode, delimiter, toggle,
  alignment, raw), `bordered` (true), `folder`; giá trị `{time, version, blocks}`, không block thì null; mọi chuỗi trong
  block khử HTML với cấu hình chép nguyên `sanitize.ts`; block ảnh/tệp có `fileId`, `fileURL`, `url` như Directus; bỏ công cụ ảnh, tệp khi
  user không đọc được `directus_files`.
- **FR-063** `map` (geometry, `geometry.*`, json, string, text, csv): options `defaultView` (`center`, `zoom`,
  `bearing`, `pitch`), `geometryType`; định dạng lưu: json và `geometry*` là GeoJSON, string/text là WKT, csv là
  `[lng, lat]`; vẽ giới hạn theo kiểu con của field; nhiều hình gộp thành Multi*; nền bản đồ theo settings `basemaps`,
  mặc định OpenStreetMap như Directus (attribution `© OpenStreetMap contributors`), nền tối khi appearance tối như
  `basemap.ts`, tìm địa điểm chỉ khi có `mapbox_key`; nút vừa dữ liệu, điều hướng, vị trí.
- **FR-064**: Thư viện soạn thảo PHẢI cho ra cùng định dạng dữ liệu với thư viện Directus dùng ở 11.17.4 (TinyMCE 6.8.6,
  Editor.js 2.31.2, CodeMirror 5.65.18, MapLibre 1.15.3, Mapbox GL Draw 1.5.1; chọn ở plan), giấy phép tương thích dùng
  thương mại (Nguyên tắc XII, như việc bỏ PrimeVue): chấp nhận MIT, Apache-2.0, BSD-2/3, ISC, OFL-1.1 (font), CC BY 4.0
  (icon, có ghi công), MPL-2.0 (chỉ công cụ test); loại GPL, AGPL, giấy phép thương mại.
- **FR-065**: HTML và markdown do người dùng nhập khi hiển thị (ghi chú field, notice, help, xem trước markdown) PHẢI
  khử HTML nguy hiểm như Directus (DOMPurify).
- **FR-066**: `input-hash` không đặt giá trị đã lưu vào ô nhập; `masked` (`input`, display `formatted-value`) chỉ che khi
  hiển thị. Menu "xem/chép giá trị thô" giữ như Directus: hiện đúng giá trị API trả cho user (với `hash` là chuỗi đã
  băm), vì user đó đã đọc được giá trị qua API.

**Display**

- **FR-070**: Bộ hiển thị giá trị (tương đương `render-display`): null hoặc undefined → `--`; display có lỗi → giá trị
  chữ; nhận `display_options`, `interface`, `interfaceOptions`, `type`, `collection`, `field`.
- **FR-071**: Bộ hiển thị template (tương đương `render-template`): tách `{{ đường.dẫn }}`, mỗi field dùng display của nó
  hoặc mặc định theo kiểu; `related-values`, `formatted-value`, `formatted-json-value`, `translations` nhận cả mảng, display
  khác vẽ từng phần tử; hỗ trợ `$thumbnail` và dạng `field:collection` của m2a; chữ thường qua `translate`.
- **FR-072**: Mỗi display có hàm dạng chữ (`handler`) như Directus khi Directus có (collection, datetime, filesize,
  formatted-json-value, formatted-value, labels, mime-type, related-values, translations, user) để dùng cho template chữ và
  xuất CSV (014).
- **FR-073**: Field cần nạp thêm cho display (`fields` của display: file, image `id,type,title,modified_on`; user
  `id,avatar.id,avatar.modified_on,email,first_name,last_name`; related-values và translations theo template) PHẢI tính
  như `adjust-fields-for-displays.ts`, kể cả alias khi một field gốc xuất hiện nhiều lần (`use-alias-fields.ts`).
- **FR-074** Options từng display:
  `boolean` (`labelOn`, `labelOff`, `iconOn` `check`, `iconOff` `close`, `colorOn`, `colorOff`; icon, nhãn, màu chỉ áp khi
  đủ cặp); `collection` (`icon` false); `color` (`defaultColor` `#B0BEC5`; viền khi tương phản < 1.1); `datetime`
  (`relative`, `format` `long`, `includeSeconds`, `use24` (mặc định `false`, khác interface), `tz`, `suffix` true, `strict`, `round`; tooltip múi giờ;
  cập nhật mỗi 60 s khi relative); `file`, `filesize`, `hash`, `raw` (không option); `formatted-json-value` (`format`
  template micromustache, nhiều phần tử thì menu "N items"); `formatted-value` (`format`, `font`, `bold`, `italic`,
  `prefix`, `suffix`, `color`, `background`, `icon`, `border`, `masked`, `conditionalFormatting` `{operator, value, color,
  background, text, icon}`, `translate` ẩn); `icon` (`filled`, `color` chỉ áp khi là hex; tên icon thương hiệu trong danh sách `social-icons` của
  Directus (tên trần như `docker`, `_` đổi thành `-`) vẽ như `v-icon`); `image` (`circle`); `labels`
  (`format` true, `showAsDot`, `choices` `{text, value, icon, color, foreground, background}`); `mime-type`
  (`showAsExtension`); `rating` (`simple`; số sao theo `interfaceOptions.maxValue` hoặc 5); `related-values` (`template`;
  o2m, m2m, m2a, translations, files hiện "N item(s)" có menu và link, m2o hiện trực tiếp); `translations` (`template`,
  `languageField`, `defaultLanguage`, `userLanguage`; menu từng bản dịch có tiến độ); `user` (`display`
  `avatar`|`name`|`both`, `circle`; popover user nạp `GET /users/:id` với field như `user-popover.vue`, lỗi quyền thì
  hiện lỗi như Directus).
- **FR-075**: Định dạng ngày giờ PHẢI dùng khóa `date-fns_*` và locale như `format-date.ts`, kết quả giống Directus ở
  `en-US` và `vi-VN`.
- **FR-076**: So sánh của `conditionalFormatting` theo kiểu field (chuỗi, `parseFloat`, `BigInt`, `parseInt`) như
  Directus; số định dạng theo locale khi `format`.
- **FR-077**: Ảnh của display dùng `/assets/:id` với preset `system-small-cover` và `cacheBuster` `modified_on`; lỗi tải
  thì hiện icon hoặc nhãn đuôi file như Directus.
- **FR-078**: Link tới item trong display và interface PHẢI theo `get-item-route.ts` (route Directus của module
  content, users, files).
- **FR-079**: Display `labels` tra `choices` của display; dạng chữ tra thêm `choices` của interface như `handler` Directus.

**Tương thích dữ liệu và API**

- **FR-080**: Giá trị mỗi interface phát ra PHẢI cùng dạng và kiểu JSON với Directus cho cùng thao tác (chuỗi, số, ISO,
  mảng, object, `{create, update, delete}`, GeoJSON/WKT, block JSON, HTML). Quy tắc so: so sâu sau JSON round-trip (bỏ
  thứ tự khóa); bigInteger, decimal là chuỗi; `null` khác thiếu khóa; `undefined` là không thay đổi.
- **FR-081**: App chỉ gọi API theo chuẩn Directus (danh sách ở phần tham chiếu và 012). Request ra ngoài là danh sách
  đóng: URL của `input-autocomplete-api`; tile theo `basemaps` hoặc OpenStreetMap mặc định; glyph
  `https://fonts.openmaptiles.org/...` (style gốc của `basemap.ts`); style và geocoder Mapbox khi settings có
  `mapbox_key`; iframe embed của block editor (tool `embed`) và media của rich text.
- **FR-082**: Chạy được với Directus thật và API mới chỉ bằng đổi `apiUrl` (như 012). Ở 013 chỉ kiểm phần dữ liệu (seed
  chạy ở hai API, SC-009); test component dùng API giả lập, nên kiểm đầy đủ bằng E2E ba cấu hình ở 014.
- **FR-083**: Không sửa file trong `directus/`; không ghi `directus_fields`, `directus_relations`, `directus_collections`.
- **FR-084**: Form PHẢI cho biết có thay đổi chưa lưu hay không, để màn chứa (014) hỏi `unsaved_changes` như
  `use-edits-guard.ts`; drawer của interface (repeater, item lồng) tự hỏi trước khi bỏ thay đổi như Directus.

**Chuỗi dịch**

- **FR-090**: Nhãn, ghi chú, thông điệp của interface, display, form dùng khóa Directus (`interfaces.*`, `displays.*`,
  `validationError.*`, `operators.*`, khóa gốc) từ chuỗi đã sinh ở 012; thiếu `vi-VN` thì rơi về `en-US` từng khóa
  (quy tắc Clarifications 012).
- **FR-091**: Chuỗi có chữ "Directus" mà interface hoặc display hiện ra PHẢI qua bước đổi thương hiệu của 012 (D-39).

**Giao diện (Nguyên tắc XII)**

- **FR-092**: Control dùng công thức có sẵn ở `component-specs.md` (Input, Textarea, Select, Checkbox, Toggle, Badge,
  Alert, Dropdown menu, Modal, Avatar, Table, Tooltip, Button) và panel của `layout-patterns.md`; đủ state focus-visible,
  disabled, invalid, loading, empty; label và lỗi liên kết với control (`for`, `aria-describedby`, `aria-invalid`).
- **FR-093**: Thành phần chưa có mẫu trong design-system (Q-1 đến Q-12) PHẢI có recipe nháp (Tier 3, đánh dấu "nháp")
  trong `design-system/docs/component-specs.md` (và `layout-patterns.md` cho lưới form, drawer) trước khi code thành
  phần đó, dựng từ token và công thức có sẵn (`FIELD`, `FOCUS`...); cặp màu mới vào bảng tương phản của
  `migration-guide.md`. Code theo bản nháp; design owner (owner dự án, trừ khi chỉ định khác) duyệt trước khi đóng 013
  theo `qa/handoff-checklist.md` (quy ước `component-specs.md`, bảng tương phản, đối chiếu ảnh với TailAdmin và luồng
  Directus); chỉnh sửa chỉ đổi recipe và class.
- **FR-094**: Mọi interface dùng được bằng bàn phím (chọn, mở và đóng drawer, Esc đóng, focus trở về nút mở; danh sách
  thao tác theo nhóm interface ở `contracts/tests.md` §5); danh sách kéo đổi thứ tự được có mục "Lên", "Xuống" trong menu
  dòng (D-60, khóa dịch overlay `en-US`/`vi-VN`); trạng thái không chỉ bằng màu; transition tắt khi
  `prefers-reduced-motion: reduce` (quy tắc 012), bản đồ dùng `jumpTo` thay `flyTo`. Editor bên thứ ba (TinyMCE,
  Editor.js, CodeMirror, MapLibre) giữ a11y của thư viện, liên kết nhãn bằng `aria-labelledby` khi thư viện cho phép.
- **FR-095**: Sáng, tối và overrides settings áp lên mọi interface và display như khung 012, kể cả editor bên thứ ba
  (CSS nội dung TinyMCE, theme CodeMirror, nút MapLibre theo token); giá trị màu lấy từ dữ liệu (Edge Cases) áp nguyên.

**Kiểm thử**

- **FR-100**: Bộ mẫu PHẢI có: script seed tạo collection mẫu qua API Directus thật (mỗi interface và display với các tổ
  hợp options chính, quan hệ đủ loại, nhóm lồng, điều kiện, validation, ngôn ngữ, file mẫu, item có giá trị do Directus
  ghi), và bản xuất `fields`, `relations`, `collections`, item, file, `permissions/me` của vài user (admin, user quyền
  một phần) commit thành fixture. Script chạy được với cả hai API; 014 dùng lại script cho E2E. Field `geometry.*` chỉ
  seed trên Postgres có PostGIS (`postgis/postgis` của `tests/parity`). Mỗi giá trị trong `expected.*.json` ghi nguồn
  (dòng code hoặc test Directus); reviewer đối chiếu nguồn; E2E so payload ở 014 là xác nhận cuối.
- **FR-120**: Hành vi trong 31 file test Directus (25 ở `interfaces/` không tính `_system`, 6 ở `displays/`, đếm ngày
  2026-10-15) PHẢI có test tương ứng ở `apps/web` (unit hoặc component); 8 file của `_system` đi cùng D-57;
  `system-raw-editor` không có test Directus nên viết test mới.
- **FR-121**: Test component nạp toàn bộ bộ mẫu (US7) và ghi lại mọi request mà interface gửi qua API giả lập để kiểm
  FR-054, FR-081. E2E ở ba cấu hình của 012 và so payload ghi với Directus app chạy ở 014 trên màn item với cùng bộ mẫu
  (Clarifications Q-A); 013 không thêm E2E.
- **FR-122**: Kiểm khả năng truy cập tự động (axe) trên form và bảng mẫu dựng trong test, ở sáng và tối.
- **FR-123**: Coverage `apps/web` ≥ 60%; cổng lint, typecheck, kiểm màu thô (`tools/check-raw-colors.mjs`) như 012.

### Key Entities *(include if feature involves data)*

- **Field**: từ `GET /fields`: `collection`, `field`, `type`, `schema` (`default_value`, `max_length`, `is_nullable`,
  `is_generated`, `is_primary_key`, `has_auto_increment`), `meta` (`interface`, `options`, `display`,
  `display_options`, `special`, `width`, `hidden`, `readonly`, `required`, `group`, `sort`, `note`, `conditions`,
  `validation`, `validation_message`, `translations`, `system`).
- **Relation**: từ `GET /relations`: m2o, o2m, m2m (collection nối, `junction_field`, `sort_field`), m2a
  (`one_allowed_collections`, `one_collection_field`), translations.
- **Collection**: `meta.display_template`, `meta.singleton`, `meta.sort_field`, icon, tên dịch.
- **Giá trị form**: giá trị ban đầu, phần đã sửa, lỗi validation (`{collection, field, type, ...}`).
- **Thay đổi quan hệ**: `{ create: object[], update: object[], delete: key[] }`.
- **Định nghĩa interface/display**: id, kiểu hỗ trợ, nhãn, icon, cờ (`hideLabel`, `hideLoader`, `group`, `relational`),
  mặc định của options, hàm dạng chữ, field cần nạp thêm.
- **Quyền**: `/permissions/me` theo collection và action (create, read, update, delete).

## Khác biệt so với Directus *(mandatory)*

Mã tiếp theo sau D-53 (012). D-39 (thương hiệu, khóa localStorage `backoffice-*`), D-41 (AI, collaborative editing,
extension), D-47 (giao diện TailAdmin) áp dụng cho mọi interface và display, không lặp ở đây.

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|------|
| D-54 | Công cụ AI trong form (`use-ai-tools`), chỉ báo người cùng sửa (collab) trong nhãn và interface | Có khi bật AI, WebSocket | Không có; như Directus khi tắt | Nguyên tắc XI (D-41) | ngoài phạm vi | — |
| D-55 | Chế độ so sánh (`comparisonMode`, `comparisonSide`) của form và interface | Có (revisions, versions) | Interface nhận prop và làm theo code Directus chép (kể cả `nonEditable`, ví dụ rich text chỉ đọc), kiểm bằng unit test; màn chọn và so sánh version chưa có | Màn revisions/versions thuộc sidebar item | ngoài phạm vi (tạm thời) | 014 |
| D-56 | Form options của interface và display (`options` dạng component: `list`, `map`; `system-interface-options`, `system-display-options`) | Có ở màn cấu hình field | Chưa có; chỉ đọc options đã lưu | Màn cấu hình field thuộc Settings | ngoài phạm vi (tạm thời) | 016 |
| D-57 | 27 interface `_system` (trừ `system-raw-editor`) | Có | Chưa có; field dùng chúng hiện bằng interface mặc định theo kiểu (FR-003) cho tới feature có màn dùng | Owner chọn 2026-10-15 (Q-B): làm cùng màn dùng chúng | ngoài phạm vi (tạm thời) | 015: `system-language`, `system-theme`, `system-theme-overrides`, `system-mfa-setup`, `system-token`, `system-input-password`; 016: còn lại trừ `system-mcp-prompts-collection-validation` (AI, D-41, không làm) |
| D-58 | Layout và bộ lọc của drawer chọn item (`drawer-collection.vue`) | Layout theo preset của user (table, cards, calendar, kanban, map), thanh bộ lọc | Luôn dạng bảng (cột theo preset hoặc mặc định), tìm kiếm, phân trang, bộ lọc của interface | Layout và bộ lọc thuộc module Content; owner chọn 2026-10-15 | ngoài phạm vi (tạm thời) | 014 |
| D-60 | Đổi thứ tự bằng bàn phím trong danh sách kéo thả (`list`, `files`, `list-o2m`, `list-m2m`, `list-m2a`, `collection-item-multiple-dropdown`, `list-o2m-tree-view`) | Chỉ kéo bằng chuột | Thêm mục "Lên", "Xuống" trong menu dòng (tree view thêm "Thụt vào", "Thụt ra" để đổi cha); kéo bằng chuột giữ như Directus | WCAG 2.1.1 (mức A), Nguyên tắc XII; owner duyệt 2026-10-15 | khác | — |
| D-59 | Chỉnh ảnh (cắt, xoay, lật, tỉ lệ, điểm focal) trong `file-image` (`image-editor.vue`, `PATCH /files/:id` multipart) | Có khi có quyền sửa file | Chưa có nút chỉnh ảnh | Thay nội dung file thật, dùng chung với màn file của module Files; owner chọn 2026-10-15 | ngoài phạm vi (tạm thời) | 015 |
| D-61 | Interface `input-rich-text-html` (TinyMCE) | TinyMCE 6.8.6 | Chưa cài; field dùng nó hiện bằng interface mặc định theo kiểu (textarea) | TinyMCE 6.8.6 có 4 advisory XSS high, chỉ vá ở TinyMCE 7 (GPL, FR-064); cổng `pnpm audit` của CI chặn; chờ owner chọn (research R1) | ngoài phạm vi (tạm thời) | khi owner chọn |
| D-62 | Thư viện bản đồ | maplibre-gl 1.15.3 | maplibre-gl 6.14.0 | 1.15.3 có advisory XSS critical (vá ở 6.4.1); định dạng hình học lưu không đổi (GeoJSON, WKT, `[lng, lat]`), chunk bản đồ lớn hơn (496 KB gzip, tải lười) | khác | — |
| D-63 | Field có interface ẩn nhãn (`hideLabel`, ví dụ mục accordion) | Không có nhãn | Có nhãn `sr-only` liên kết với control | WCAG 1.3.1/4.1.2 (axe `label`, FR-122) | khác | — |
| D-64 | `input-block-editor` bị unmount trước khi Editor.js sẵn sàng | Ném lỗi (`on is not a function`) | Bỏ qua phần khởi tạo còn lại | Lỗi của Directus làm hỏng form khi đóng nhanh; không đổi dữ liệu | khác | — |
| D-65 | `list-o2m-tree-view` sửa một dòng sau khi có item bị chuyển đi | Lấy nhầm dòng (trộn chỉ số của danh sách đã lọc với `displayItems`) | Lấy đúng dòng trong danh sách đã lọc | Tái tạo sẽ ghi sai dữ liệu; tech lead chọn giữ cách sửa (2026-10-15) | khác | — |
| D-66 | Thông báo thành công/lỗi (chạy flow, tải file, nhập từ URL, lỗi tải item liên quan) | Snackbar của store notifications | Notice tại chỗ (`BoNotice`) trong interface hoặc hộp thoại | Store notifications và snackbar thuộc 018 (D-45) | ngoài phạm vi (tạm thời) | 018 |

**Rủi ro chấp nhận (tái tạo từ Directus)**: theo quy tắc của 004 (owner chọn tái tạo hành vi Directus và ghi R),
áp cho FE từ 2026-10-15 (release-gate CHK089). Các dòng dưới tìm từ đọc code Directus 11.17.4 và có test ở app mới;
tech lead duyệt ngày 2026-10-15.

| Mã | Hành vi của Directus | Bằng chứng | Hệ quả |
|----|----------------------|------------|--------|
| R-34 | Handler dạng chữ của display `formatted-json-value` gọi `render(value, format)` ngược thứ tự so với component | `displays/formatted-json-value/index.ts`; test `DisplayFormattedJsonValue.test.ts` | Xuất CSV và template chữ khác chuỗi hiện trong bảng; object có `format` ném `TypeError` |
| R-35 | `header` có đúng một link và link đó là URL nội bộ (`/...`) thì không vẽ nút (`primaryLink.href \|\| primaryLink.flow` sai vì link nội bộ chỉ có `to`) | `interfaces/presentation-header/header.vue:167,249`; test `InterfaceHeader.test.ts` | Link nội bộ duy nhất không bấm được; hai link trở lên thì có trong menu |
| R-36 | `list` có option `sort` thì `sortBy` chạy trên mọi giá trị: giá trị không phải mảng biến thành các dòng giá trị của nó, không hiện cảnh báo `incompatible_data` | `interfaces/list/list.vue:105,109`; test `InterfaceList.test.ts` "with `sort` set" | Dữ liệu lệch dạng hiện như các dòng rác; thêm dòng thì ghi đè (có cảnh báo console) |
| R-37 | `list-m2a` hiện "Create New" khi có ít nhất một collection cho tạo, nhưng menu liệt kê mọi collection cho phép (`allowedCollections`), kể cả collection không có quyền `create` | `interfaces/list-m2a/list-m2a.vue`; test `relations.fixture.test.ts` (bo-editor) | User chọn collection không có quyền tạo; API trả 403 khi lưu |

**Đã xác nhận** (tech lead, 2026-10-15; giữ nguyên):

- Mặc định dữ liệu có hex trong code của Directus (`select-color.presets` 9 màu, `color.defaultColor` `#B0BEC5`) là giá
  trị dữ liệu, giữ nguyên để giống Directus; tech lead đồng ý cho các hằng này đi qua `check-raw-colors` (Q-C).
  Cách miễn chỉ có một: đánh dấu cuối dòng `raw-color-allowed: Directus data default (Q-C)` mà `tools/check-raw-colors.mjs`
  đã hỗ trợ (grep được), áp cho `select-color` presets, `color.defaultColor` và hằng tương tự (T006).
- Preset mặc định tên `purple` `#6644FF` là màu thương hiệu Directus nhưng là dữ liệu người dùng chọn: giữ.

## Câu hỏi mở về design-system (Nguyên tắc XII)

`component-specs.md` xếp interface và display vào Tier 3 ("câu hỏi mở trong spec của feature khi TailAdmin không có
mẫu"). Cách xử lý (Clarifications 2026-10-15): recipe nháp cho từng mục viết vào `design-system/docs/` trước khi code
(FR-093); design owner duyệt trước khi đóng 013; mục đã duyệt chuyển trạng thái "Đóng" kèm tên recipe.

| Mã | Câu hỏi | Trạng thái |
|----|---------|------------|
| Q-1 | Lưới form: độ rộng `half`/`full`/`fill`, khoảng cách hàng, nhãn field kèm menu, chấm đã sửa, ghi chú, thông báo lỗi tổng hợp | Mở: chờ recipe nháp |
| Q-2 | Combobox (autocomplete API, chọn có "khác"), chọn nhiều (chip trong ô), radio, nhóm checkbox lưới, cây checkbox | Mở: chờ recipe nháp (radio là "khi cần" ở Tier 1) |
| Q-3 | Bộ chọn ngày giờ (lịch, giờ 12/24, giây, múi giờ) | Mở: chờ recipe nháp |
| Q-4 | Slider, rating sao, thanh tiến độ bản dịch | Mở: chờ recipe nháp |
| Q-5 | Tags/chip (nhập, xóa), chip `labels` với màu dữ liệu, chấm màu | Mở: chờ recipe nháp (chỉ có Badge) |
| Q-6 | Tabs, accordion, khối detail có tiêu đề, divider có tiêu đề và icon | Mở: chờ recipe nháp |
| Q-7 | Bộ chọn màu, bộ chọn icon (lưới, tìm kiếm) | Mở: chờ recipe nháp |
| Q-8 | Khung trình soạn code, rich text (thanh công cụ), markdown (editor/preview), block editor | Mở: chờ recipe nháp |
| Q-9 | Khung bản đồ (nút điều khiển, vẽ) | Mở: chờ recipe nháp |
| Q-10 | Drawer chọn item và sửa item lồng: bề rộng, tiêu đề, nút lưu; khác panel chi tiết `w-[333px]` (L-4) | Mở: chờ recipe nháp |
| Q-11 | Danh sách quan hệ trong form (dạng list và table, kéo đổi thứ tự, menu dòng), file/ảnh (vùng thả file, ảnh xem trước, xem lớn) | Mở: chờ recipe nháp (file upload chỉ có tên ở Tier 2) |
| Q-12 | Giá trị null `--`, popover user, menu "N items" của display | Mở: chờ recipe nháp |

## Clarifications

### Session 2026-10-15

- Q-A: Màn nào chứa form và bảng ở 013 (màn item tối thiểu và E2E, hay chỉ component)? → A: Chỉ component, form,
  display, drawer; kiểm bằng test component với bộ mẫu lấy từ DB do Directus tạo; màn item, E2E ba cấu hình và so
  payload với Directus app dời sang 014 (US7, FR-100, FR-121, SC-001, SC-002).
- Q-B: 28 interface `_system` làm ở đâu? → A: Ở feature có màn dùng chúng (015, 016); 013 chỉ làm
  `system-raw-editor` (FR-004, D-57).
- Q: Drawer chọn item dùng layout nào? → A: Luôn dạng bảng (cột theo preset hoặc mặc định, tìm kiếm, phân trang,
  chọn một/nhiều); layout theo preset và bộ lọc nâng cao ở 014 (FR-046, D-58).
- Q: Trình chỉnh ảnh của `file-image` làm ở đâu? → A: Ở 015 (module Files); 013 không có nút chỉnh ảnh (FR-051,
  FR-054, D-59).
- Q: Xử lý Q-1 đến Q-12 (thành phần chưa có mẫu design-system) thế nào? → A: Viết recipe nháp vào
  `design-system/docs/` trước khi code, code theo nháp, design owner duyệt trước khi đóng 013 (FR-093).
- Q: Lời giải các mục release-gate (91 mục)? → A: Owner duyệt toàn bộ đề xuất của
  `checklists/release-gate-proposals.md`: làm như Directus ở mọi chỗ Directus có hành vi; thêm D-60; giữ `jsonlint-mod`
  và `vue-virtual-scroller`; tái hiện lỗi `formatted-json-value.handler` của Directus và ghi R-xx khi đóng (quy tắc 004);
  design owner là owner dự án.
- Q-C (tech lead xác nhận 2026-10-15): hằng màu dữ liệu của Directus trong code (Cần xác nhận) được miễn kiểm màu thô, ghi
  danh sách trong `check-raw-colors`.

## Assumptions

- Màn danh sách collection, layout (table, cards, calendar, kanban, map), bộ lọc, bookmark, sidebar item (revisions,
  comments, flows), xuất CSV thuộc 014; 013 cung cấp form, display, template và drawer để 014 đến 018 dùng.
- Chế độ batch của form có ở 013 vì `list-o2m`/`list-m2m` dạng table cần drawer sửa hàng loạt; màn sửa hàng loạt nhiều
  item của module Content thuộc 014.
- Thư viện và phiên bản đã chốt ở plan (research R1); yêu cầu là cùng định dạng dữ liệu (FR-064).
- Giá trị lưu không cần giống Directus từng byte ở chỗ thư viện tự sinh (`time` của block editor, `id` của block,
  khác biệt do trình duyệt khi trình soạn chuẩn hóa HTML); so sánh bỏ các phần này (US7).
- Bản đồ dùng tile OpenStreetMap mặc định như Directus (request ra ngoài được phép, FR-081).
- Người dùng chuyển từ Directus app; không có dữ liệu cấu hình field tạo riêng cho app mới.
- Prop component-only của Directus không nằm trong `meta.options` (`list.limit`, `headerPlaceholder`,
  `select-dropdown-m2o.selectMode`, `input.dbSafe`, `input-code.altOptions`, `list-m2m.junctionFilter`) ngoài phạm vi:
  chỉ khóa lưu trong DB được đọc.
- Danh sách phần không ổn định khi so giá trị là đóng: `time` và `id` của block editor; khoảng trắng và thứ tự thuộc
  tính HTML do trình duyệt chuẩn hóa.
- Link tới item trỏ đúng route Directus; ở 013 các route đó là khung của 012 (D-40) cho tới 014.
- Rủi ro chấp nhận như Directus: `imageToken` nhúng token tĩnh vào URL ảnh (admin tự chọn); HTML do người khác ghi
  trong rich text dựa vào lọc của TinyMCE; tile OpenStreetMap mặc định (dùng nhiều thì người vận hành đặt `basemaps`
  riêng, tài liệu triển khai ghi rõ); `list-o2m-tree-view` nạp cả cây; drawer chọn item trên collection rất lớn phụ
  thuộc thời gian phân trang và đếm của API (benchmark 005).
- Directus ẩn interface `system: true` khỏi bộ chọn; field người dùng vẫn trỏ tới interface `_system` (đặt qua API)
  thì hiện bằng interface mặc định theo kiểu (FR-003, D-57).
- Store flows được nạp từ 013 (chỉ `hydrate`, `GET /flows`) để nút flow thủ công của `header` và
  `presentation-links` chạy; thu hẹp D-45 của 012 (research R10). Trình chỉnh sửa flows vẫn là 017.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 40/40 interface id và 18/18 display id có bản tương ứng; với bộ mẫu (FR-100), test component dựng form
  và bảng cho mọi collection mẫu với 0 field hiện `interface_not_found`, 0 lỗi hoặc cảnh báo Vue, 100% khẳng định DOM
  đạt. "Đọc được cấu hình hiện có" = SC-001 và SC-003.
- **SC-002**: Với mọi giá trị Directus đã ghi trong bộ mẫu, form không sửa thì phát 0 thay đổi; mỗi interface có ít nhất
  một kịch bản sửa mà giá trị phát ra bằng giá trị mong đợi (sau khi bỏ phần không ổn định ở Assumptions). So payload
  với Directus app trên màn thật là SC của 014.
- **SC-003**: 100% khóa options và display_options liệt kê ở FR-020 đến FR-079 có ít nhất một test đọc giá trị đã lưu
  và kiểm hiệu ứng của nó (khóa thẩm mỹ như `font`, `bordered`, `iconLeft`: kiểm class, attribute hoặc style trên DOM).
- **SC-004**: Form 50 field vẽ xong trong dưới 1 giây sau khi dữ liệu đã nạp; bảng 100 hàng × 10 cột có display vẽ xong
  trong dưới 1 giây. Điều kiện đo: chromium trên CI, API giả lập đã có dữ liệu, lần dựng đầu, trung vị 3 lần,
  chạy riêng một bước CI không coverage (`PERF=1`); trong lượt test có coverage, số đo phản ánh tải của máy CI.
- **SC-005**: axe 0 vi phạm mức serious/critical trên form và bảng mẫu ở sáng và tối; mọi interface thao tác được chỉ
  bằng bàn phím theo danh sách thao tác ở `contracts/tests.md` §5 (kiểm trong test component). Ngoại lệ axe chỉ cho phần
  của thư viện bên thứ ba và màu dữ liệu, ghi rule id và lý do trong file test; tech lead duyệt
  2026-10-15 hai ngoại lệ của `a11y.browser.test.ts` (attribution MapLibre, màu dữ liệu inline).
- **SC-006**: Coverage `apps/web` ≥ 60%; lint, typecheck, unit, E2E hiện có của 012, build image xanh; 0 màu thô ngoài
  danh sách miễn (Q-C).
- **SC-007**: 0 file trong `directus/` bị sửa; trong test, 0 request ghi ngoài danh sách FR-054 và 0 request ra ngoài
  ngoài FR-081.
- **SC-008**: Recipe nháp Q-1 đến Q-12 được design owner duyệt, bảng Q chuyển "Đóng", `qa/handoff-checklist.md` đạt
  trước khi đóng 013.
- **SC-009**: Bản xuất của script seed (FR-100) ở Directus và ở API mới giống nhau sau chuẩn hóa (US7-3); khác biệt thật
  ghi R-xx.
