# Research: Bộ interfaces và displays (013)

Ngày 2026-10-15. Mỗi mục: quyết định, lý do, phương án bỏ. Phiên bản Directus tham chiếu: 11.17.4
(`directus/app` 15.10.0, `directus/packages/utils` 13.4.1, `types` 15.0.3, `composables` 11.4.1). Dòng đánh dấu
[Unverified] chưa kiểm được trên npm hoặc chưa chạy thử; kiểm ở task đầu của đợt implement (như T002 của 012).

## R1. Thư viện và phiên bản

**Quyết định**: cùng bản Directus 11.17.4 ở mọi gói quyết định *định dạng dữ liệu lưu* (FR-064); thêm vào catalog
`pnpm-workspace.yaml` nhóm "Web".

| Gói | Bản | Giấy phép | Dùng cho | Ghi chú |
|-----|-----|-----------|----------|---------|
| `tinymce` + `@tinymce/tinymce-vue` | 6.8.6 + 6.3.0 | MIT | `input-rich-text-html` | TinyMCE 7 đổi sang GPL-2.0+/thương mại: **giữ 6.8.6, không nâng**. Nhánh 6 không còn được bảo trì [Unverified]: ghi rủi ro ở plan, chấp nhận vì cùng HTML đầu ra với Directus |
| `@editorjs/editorjs` 2.31.2 và 13 tool (`attaches` 1.3.2, `checklist` 1.6.0, `code` 2.9.3, `delimiter` 1.4.2, `embed` 2.7.6, `header` 2.8.8, `image` 2.10.3, `inline-code` 1.5.2, `nested-list` 1.4.3, `paragraph` 2.11.7, `quote` 2.7.6, `raw` 2.5.1, `table` 2.4.5, `underline` 1.2.1), `editorjs-toggle-block` 0.3.16 | như Directus catalog | Apache-2.0, MIT | `input-block-editor` | JSON block cùng `version`; ImageTool, AttachesTool, Alignment tune chép từ Directus |
| `codemirror` | 5.65.18 | MIT | `input-code`, `input-rich-text-md`, `system-raw-editor` | Giá trị option `language` lưu trong DB là tên mode CM5 (`htmlmixed`, `javascript`...), CM6 phải ánh xạ: bỏ CM6. Giữ `jsonlint-mod` 1.7.6 (MIT [Unverified]) để báo lỗi JSON như Directus (release-gate CHK041) |
| `vue-virtual-scroller` | 2.0.0-beta.8 | MIT (kiểm T002) | `select-icon` (cuộn ảo như Directus) | chép nguyên `select-icon.vue` (CHK042) |
| `@fortawesome/fontawesome-svg-core` + `@fortawesome/free-brands-svg-icons` | 6.7.2 | MIT (mã), CC BY 4.0 (icon) (kiểm T002: `(CC-BY-4.0 AND MIT)`) | nhóm Social của `select-icon`, tên `social:*` ở display `icon` và `BoIcon` (như `social-icon.vue`) | ghi công icon trong README của `apps/web` (CHK021) |
| `maplibre-gl` 1.15.3, `@mapbox/mapbox-gl-draw` 1.5.1, `@mapbox/mapbox-gl-draw-static-mode` 1.0.1, `wellknown` 0.5.0, `@turf/meta` (bản Directus catalog), `geojson` types | như Directus | BSD-3, ISC, MIT | `map` | `maplibre-gl` 1.x cũ nhưng là bản `mapbox-gl-draw` 1.5.1 chạy cùng ở Directus; nâng là việc của Directus. `@mapbox/mapbox-gl-geocoder` 5.1.2 nạp động chỉ khi settings có `mapbox_key` |
| `vuedraggable` | 4.1.0 | MIT | kéo đổi thứ tự (list, files, o2m, m2m, m2a, tree, collection-item-multiple) | dùng SortableJS; cách thay bằng phím: mục "lên/xuống" trong menu dòng (FR-094) |
| `color` | 5.0.2 | MIT | `select-color`, display `color` (tương phản) | |
| `@sindresorhus/slugify` | 2.2.1 | MIT | option `slug` của `input` | |
| `date-fns-tz` | 3.2.0 | MIT | option `tz` của `datetime` (interface và display) | `date-fns` 4.1.0 đã có |
| `micromustache` | 8.0.3 | MIT | template `{{ }}` (URL, autocomplete, filter, `formatted-json-value`) | đã có ở catalog (009) |
| `@directus/utils` | 13.4.1 | MIT | `validatePayload`, `parseFilter`, `getFieldsFromTemplate`, `getRelationType`, `toArray`, `deepMap`, `getEndpoint`, `mergeFilters`, `isDynamicVariable`, `parseNow` | gói npm, export `.` là build `shared` chạy được trong trình duyệt (Directus app dùng y vậy; joi đi kèm) [Unverified trên npm] |
| `@directus/types` | 15.0.3 | MIT | kiểu `Field`, `Relation`, `Filter`, `InterfaceConfig`, `DisplayConfig` (devDependency) | |
| `reka-ui` 2.8.2 (`@internationalized/date` đi kèm) | đã có | MIT | Calendar, TimeField, Slider, Tabs, Collapsible, Accordion, Checkbox, RadioGroup, Switch, Combobox, Dialog, Popover | `v-date-picker.vue` của Directus đã dùng Reka Calendar + TimeField: chép gần nguyên |
| `@vitest/browser` | 3.2.4 | MIT | test component trong chromium (R8) | provider playwright (đã có 1.64.0) [Unverified: coverage v8 ở browser mode] |
| `axe-core` | 4.11.x | MPL-2.0 | FR-122 trong test browser | đã có gián tiếp qua `@axe-core/playwright` 4.13.0 |

**Không thêm**: `cropperjs` (D-59);
`@directus/composables` (phụ thuộc axios; `useItems`, `useCollection`, `useCustomSelection` chép vào `apps/web`
với sdk, R5); `@backoffice/validation`/`@backoffice/utils` (lib BE, kéo theo Node API).

**Kết quả kiểm (T002, 2026-10-15)**: `pnpm view` cho mọi gói R1: đúng bản, giấy phép MIT, Apache-2.0 (Editor.js core),
BSD-3-Clause (maplibre-gl), ISC (mapbox-gl-draw, static-mode, geocoder), BSD (wellknown), MPL-2.0 (axe-core 4.14.0, chỉ
test), `(CC-BY-4.0 AND MIT)` (Font Awesome brands); `jsonlint-mod` 1.7.6 không có trường license trong package, repo
gốc `circlecell/jsonlint` là MIT (GitHub API). `@turf/meta` theo Directus là 7.2.0. `@directus/utils` 13.4.1 có build
`dist/{shared,browser,node}`; `shared` không import module Node nào và có đủ `validatePayload`, `parseFilter`,
`getFieldsFromTemplate`, `getRelationType`, `toArray`, `deepMap`, `getEndpoint`, `mergeFilters`, `isDynamicVariable`,
`parseNow`, `generateJoi`; chạy thử build Vite của `apps/web` làm ở T001. Không cần dự phòng.

**Sau CI đợt A (2026-10-16)**: `pnpm audit --prod --audit-level=high` (cổng `security`) chặn:
- `maplibre-gl` 1.15.3: XSS critical, vá ở 6.4.1 → dùng 6.14.0 (định dạng dữ liệu lưu không đổi: GeoJSON/WKT/`[lng, lat]`
  do code chép của Directus sinh).
- `js-yaml` < 4.3.2 và `joi` < 18.2.6 đến qua `@directus/utils` 13.4.1 → `overrides` trong `pnpm-workspace.yaml`.
- `tinymce` 6.8.6: bốn XSS high, chỉ vá ở 7.1.0/7.9.3 mà TinyMCE 7 là GPL (FR-064) → owner chọn (a) ngày 2026-10-15:
  giữ 6.8.6 như Directus, bốn GHSA high (GHSA-mh5m-5hw4-5c69, GHSA-vg35-5wq7-3x7w, GHSA-q742-qvgc-gc2f,
  GHSA-v98h-vmpc-fpqv) vào `auditConfig.ignoreGhsas` kèm lý do (tiền lệ sharp, axios ở 007); bỏ (b) TinyMCE 7 thương
  mại, (c) trình soạn HTML khác (HTML khác Directus). Advisory moderate GHSA-5359-pvf2-pw78 dưới ngưỡng `high` của CI.

**Phương án bỏ**: TinyMCE 7 (giấy phép GPL); Tiptap/ProseMirror thay TinyMCE (HTML khác, mất tương thích
`toolbar`, `customFormats`, `tinymceOverrides`); CodeMirror 6 (ánh xạ mode); Leaflet thay MapLibre (không có draw cùng
định dạng); viết kéo thả bằng tay (nhiều code hơn `vuedraggable`).

## R2. Kiến trúc: registry interface/display và vị trí file

**Quyết định**:

- `apps/web/src/interfaces/<id>/{index.ts,<Id>.vue}` và `apps/web/src/displays/<id>/{index.ts,<Id>.vue}` theo đúng id
  Directus (thư mục `presentation-header` giữ id `header`). `index.ts` là object `InterfaceConfig`/`DisplayConfig`
  (kiểu từ `@directus/types`) chép từ Directus: `id`, `name`, `icon`, `types`, `localTypes`, `group`, `relational`,
  `hideLabel`, `hideLoader`, `autoKey`, `recommendedDisplays`, `options` (giữ nguyên mảng/hàm để 016 dùng lại; D-56:
  013 không vẽ form options), `component`, `fields`, `handler`.
- `interfaces/index.ts`, `displays/index.ts`: `import.meta.glob('./*/index.ts', { eager: true })`, sắp theo id,
  `getInterface(id)`, `getDisplay(id)` trả config hoặc `undefined` (thay `useExtension`). Không đăng ký component
  toàn cục; `FormFieldInterface` và `RenderDisplay` dùng `<component :is="config.component">`.
- Component nặng (TinyMCE, Editor.js, CodeMirror, MapLibre) là `defineAsyncComponent` để tách chunk (R12).
- `_system`: chỉ `interfaces/_system/system-raw-editor` (FR-004).
- Mỗi file chép ghi `// Ported from directus/app/src/...`, manifest `tools/port-manifest/013-T*.json`.

**Phương án bỏ**: đăng ký `app.component('interface-<id>')` như Directus (mất kiểm kiểu, khó tree-shake); gộp
interface vào một file lớn (khó so với Directus theo thư mục).

## R3. Form theo metadata (tương đương `v-form`)

**Quyết định**: chép `components/v-form/*`, `form-field*.vue`, `validation-errors.vue` và utils (`get-form-fields`,
`apply-conditions`, `push-group-options-down`, `validate-item`, `clear-hidden-fields-by-condition`,
`get-default-values-from-fields`, `format-validation-structure`) thành `apps/web/src/components/form/` (`BoForm.vue`,
`FormField.vue`, `FormFieldLabel.vue`, `FormFieldMenu.vue`, `FormFieldInterface.vue`, `FormFieldRawEditor.vue`,
`ValidationErrors.vue`, `utils/`). Bỏ: `use-ai-tools`, `collabContext`, chỉ báo collab (D-54); giữ prop
`comparison*` nhưng không có UI so sánh (D-55).

- Options: `v-bind="field.meta.options"` vào props của interface; mặc định ở `defineProps` bằng giá trị mặc định
  của component Directus (không phải của form options; Edge Cases). Option khai báo lệch kiểu (`allowOther`,
  `userLanguage` dạng `string`) khai `Boolean` ở prop.
- Giá trị: `BoForm` nhận `initialValues`, `modelValue` (chỉ phần sửa), phát `update:modelValue`; `FormField`
  bỏ khỏi phần sửa khi bằng giá trị ban đầu (`emitValue`). Thêm computed `hasEdits` lộ ra qua `defineExpose` cho
  FR-084.
- Lưới: `grid grid-cols-2 gap-x-6 gap-y-5`; `full`/`fill` = `col-span-2`, `half-left` = `col-start-1`, `half-right`
  = `col-start-2`; `fill` thêm `-mx-4 md:-mx-6` khi form rộng hơn 726 px (ResizeObserver, như `with-fill`). Recipe
  nháp Q-1 (R6).
- `stores/fields.ts`: chép phần còn lại của `parseField`/`translateFields` (`name` = `formatTitle` hoặc
  `fields.<collection>.<field>` từ `meta.translations`, dịch `$t:` trong `note`, `options`, `display_options`,
  `validation_message`), `getField`, `getFieldsForCollection`, `getPrimaryKeyFieldForCollection`; cập nhật khi đổi
  ngôn ngữ như Directus (`translateFields` trong `setLanguage`).
- Nhóm `meta.interface` null: Directus vẽ `interface-group-standard` không tồn tại. Đo ngày 2026-10-15 (T004, Directus
  app 11.17.4 production ở cổng 8155 của `tests/parity`, collection tạm `bo_probe_013` đã xóa): nhóm và field con không
  hiện, không lỗi, không cảnh báo console. App mới: `BoForm` bỏ qua field nhóm không có interface cùng field con, không
  cảnh báo (CHK046: giống Directus, không cần D-xx).

**Phương án bỏ**: viết form mới không chép (mất `apply-conditions` và `validate-item` vốn là hành vi cần giống).

## R4. Display, template, field cần nạp thêm

**Quyết định**: `apps/web/src/components/render/{RenderDisplay,RenderTemplate,ValueNull}.vue` chép từ
`views/private/components/`; utils chép: `adjust-fields-for-displays`, `render-string-template`
(`renderPlainStringTemplate`, `renderDisplayStringTemplate`), `format-date` (dùng khóa `date-fns_*` đã có trong
`translations/en-US.json` từ `date-formats.yaml`, 9 khóa), `format-filesize`, `get-item-route`,
`get-related-collection`, `readable-mime-type`, `get-default-display-for-type`, `get-default-interface-for-type`;
composable `use-alias-fields`, `use-template-data` (header). `handler` của 10 display chép nguyên để 014 dùng cho CSV
(FR-072). Trạng thái null dùng `ValueNull` (`--`, Q-12).

`formatted-json-value.handler` của Directus gọi `render(v, options.format)` ngược thứ tự tham số so với component:
chép nguyên (cùng kết quả sai) và ghi R-xx ở spec khi đóng (quy tắc "tái hiện và ghi R" của 004, owner duyệt cho FE
ngày 2026-10-15, CHK089).

## R5. Quan hệ, drawer, tải file

**Quyết định**:

- Chép `composables/use-relation-{m2o,o2m,m2m,m2a,single,multiple,permissions}.ts` (api → sdk) và từ
  `directus/packages/composables/src`: `use-items.ts` (phân trang, `search`, `filter`, `sort`, `fields`, đếm bằng
  `aggregate`), `use-collection.ts`, `use-custom-selection.ts`; `use-preset.ts` của app chỉ phần đọc `fields`
  (cột của bảng drawer, D-58).
- `stores/relations.ts`: thêm `getRelationsForField`, `getRelationsForCollection`; `stores/collections.ts`:
  `getCollection`, `visibleCollections`, `display_template`; `stores/flows.ts` mới (R10); `stores/presets.ts` giữ
  hydrate + `getPresetForCollection`.
- Drawer: `components/drawers/{DrawerItem,DrawerCollection,DrawerBatch,DrawerFiles}.vue` chép từ
  `views/private/components/`. `DrawerCollection` chỉ dạng bảng (D-58): `BoTable` + ô tìm kiếm + phân trang; cột từ
  preset `layout_query.tabular.fields` hoặc 4 field đầu như `layouts/tabular`. `BoDrawer` = Reka `Dialog` dạng panel
  phải (recipe nháp Q-10; dưới `xl` chiếm toàn bề rộng như L-4).
- Tải file: `BoUpload.vue` chép `v-upload.vue` (kéo thả, chọn file, từ URL, từ thư viện) gửi `POST /files`
  multipart qua `fetch` của sdk (`sdk.request(uploadFiles(formData))`), `POST /files/import`; `FileLightbox.vue`
  chép. `ImageEditor` không chép (D-59).
- Khóa localStorage độ rộng cột: `backoffice-m2m-column-widths-<collection>-<field>` (D-39).

**Phương án bỏ**: dùng `@directus/composables` npm (kéo axios, `useApi` inject); drawer theo layout preset (014).

## R6. Thành phần cơ sở mới và recipe nháp (Q-1 đến Q-12, FR-093)

**Quyết định**: viết recipe "nháp (013)" vào `design-system/docs/component-specs.md` mục Tier 3 và
`layout-patterns.md` §8 (lưới form, drawer) *trước* task code của thành phần đó; cặp màu mới vào bảng tương phản
`migration-guide.md`. Thành phần `Bo*` mới trong `apps/web/src/components/`:

| Q | Thành phần | Primitive Reka / nguồn | Ghi chú recipe |
|---|-----------|------------------------|----------------|
| Q-1 | lưới `BoForm`, `FormFieldLabel` (menu, chấm sửa, `*`, ẩn), ghi chú, `ValidationErrors` | — (Tailwind), Dropdown menu recipe có sẵn | `grid-cols-2`, nhãn `text-theme-sm font-medium`, chấm `bg-warning-500` |
| Q-2 | `BoCombobox` (autocomplete, allowOther), `BoMultiSelect` (chip trong ô), `BoRadio`, `BoCheckboxGroup` (lưới), `BoCheckboxTree` | Combobox, RadioGroup, Checkbox; tree chép `v-checkbox-tree` logic | Select/Checkbox recipe có sẵn làm gốc |
| Q-3 | `BoDatePicker` | Calendar, TimeField (chép `v-date-picker.vue`) | popover theo Dropdown menu recipe |
| Q-4 | `BoSlider`, `BoRating` (display), thanh tiến độ bản dịch | Slider; `BoProgressLinear` có sẵn | |
| Q-5 | `BoChip`, `BoTagsInput` | — | Badge recipe làm gốc; màu dữ liệu inline style |
| Q-6 | `BoTabs`, `BoAccordion`, `BoDetail` (collapsible có tiêu đề), `BoDivider` | Tabs, Accordion, Collapsible | detail panel §7 làm gốc |
| Q-7 | `BoColorPicker`, `BoIconPicker` | Popover; input màu native của trình duyệt | |
| Q-8 | khung editor (`BoEditorFrame`: viền `FIELD`, thanh công cụ, bộ đếm) | — | TinyMCE skin: dùng `skin: 'oxide'` + CSS đè biến màu sang token [Unverified mức đè được] |
| Q-9 | khung bản đồ | — | nút điều khiển theo Button recipe |
| Q-10 | `BoDrawer` | Dialog | `w-[640px]` nháp, dưới `xl` toàn màn |
| Q-11 | `BoTable` (đơn giản: cột, hàng, chọn, sort, resize), danh sách quan hệ, `BoUpload` (vùng thả), ảnh xem trước, `FileLightbox` | Table recipe có sẵn | |
| Q-12 | `ValueNull`, `UserPopover`, menu "N items" | Tooltip, Popover | |

Thứ tự (CHK025): một task đầu đợt A viết recipe nháp cho cả Q-1 đến Q-12, trước mọi task interface. Mở rộng `Bo*` của
012 (CHK087) chỉ bằng prop tùy chọn; test của 012 phải giữ xanh. Thêm `BoTextOverflow` (chép `v-text-overflow`,
CHK091).

**Phương án bỏ**: chờ design owner trả lời trước khi code (Clarifications: owner chọn nháp trước); dùng component
TailAdmin thật (không có mẫu cho các mục này).

## R7. Editor nặng, bản đồ, định dạng dữ liệu

- TinyMCE: chép `toolbar-default.ts`, `use*.ts` (image, media, link, pre, inline code, code), `get-editor-styles.ts`
  (đổi biến `--theme--*` sang token design-system); `base_url` trỏ `tinymce` trong bundle (Vite `?url` cho skin, hoặc
  chép `tinymce/skins` vào `public/`), `license_key: 'gpl'` không áp dụng (6.x MIT). URL ảnh: `getPublicURL()` →
  `apiUrl` + `assets/<id>.<ext>`; `imageToken` qua `replaceUrlAccessToken` chép.
- Editor.js: chép `tools.ts`, `plugins.ts`, `sanitize.ts`, `alignment.ts`, `use-file-handler.ts`, `bus.ts`;
  `fileURL`/`url` dựng từ `apiUrl` (Directus dùng `getPublicURL()`).
- CodeMirror 5: `import-codemirror-mode.ts` chép (import động `codemirror/mode/<mode>/<mode>.js`); danh sách
  `language` từ `CodeMirror.modeInfo` như Directus; theme: CSS đè `.CodeMirror` bằng token.
- Markdown: chép `input-rich-text-md` + `edits.ts`; xem trước qua `utils/markdown.ts` (012, marked + DOMPurify).
- Map: chép `utils/geometry/*` (định dạng theo kiểu field: GeoJSON, WKT, `[lng, lat]`), `map/style.ts`, basemap
  từ `settingsStore.settings.basemaps` hoặc OpenStreetMap; WebGL cần cho MapLibre: test browser chạy chromium với
  `--use-gl=swiftshader` hoặc `--enable-unsafe-swiftshader` (T005: WebGL có sẵn trong chromium headless local, không cần cờ; CI Linux: test bản đồ tự bỏ qua nếu không có WebGL); nếu không dựng được map trong CI thì test
  chỉ phần serialize (`utils/geometry`) và mock `maplibre-gl` cho component.
- Hash/masked: `input` masked = `type="password"`, `input-hash` không bao giờ đặt giá trị cũ vào DOM (FR-066).

## R8. Kiểm thử: hai project Vitest, bộ mẫu, API giả lập, axe, hiệu năng

**Quyết định**:

1. `apps/web/vitest.config.ts` chuyển sang `test.projects`: `unit` (happy-dom, mọi `*.test.ts` như hiện nay) và
   `browser` (`@vitest/browser`, provider playwright, chromium headless, file `*.browser.test.ts`) cho TinyMCE,
   Editor.js, CodeMirror, MapLibre, axe (FR-122), đo thời gian SC-004 và bàn phím/focus. Coverage v8 gộp cả hai
   project, ngưỡng 60% giữ [Unverified: v8 ở browser mode; dự phòng `istanbul`]. CI: job `test-web` cài chromium
   của Playwright (đã có cho e2e-web).
2. Bộ mẫu (FR-100): `apps/web/fixtures/interfaces/seed.mjs` (tạo collection `bo_*` qua REST: `/collections`,
   `/fields`, `/relations`, `/folders`, `/files`, `/items`, `/roles`, `/policies`, `/users`; idempotent, xóa rồi tạo),
   `export.mjs` (ghi `snapshot/{collections,fields,relations,items.<collection>,files,permissions.<user>}.json`,
   chuẩn hóa id/thời gian bằng ánh xạ id ổn định `bo-<n>`), chạy bằng `pnpm nx run web:fixtures -- --api <url>
   --token <t>` trên profile `app` của `tests/parity` (Directus thật qua proxy). Snapshot commit; test
   `fixtures/snapshot.test.ts` kiểm tính đủ (mỗi interface id và display id xuất hiện ít nhất một field).
3. API giả lập trong test: mở rộng `test-utils/fetch.ts` bằng `mockFixtureApi(snapshot, user)`: trả `/fields`,
   `/relations`, `/collections`, `/permissions/me`, `/items/:collection` (lọc trong bộ nhớ: `_eq`, `_neq`, `_in`,
   `_nin`, `_null`, `_or`, `_and`, `search` trên chuỗi, `limit`, `page`, `sort`, `fields` (chọn và lồng một cấp),
   `aggregate[count]`), `/files`, `/assets/:id` (blob trống), ghi lại mọi request (`calls()` có sẵn). `shortcut:` chỉ
   toán tử các interface dùng; nâng khi 014 cần.
4. Đối chiếu seed ở hai API (US7-3): `tests/parity/src/web/fixtures-seed.test.ts` chạy `seed.mjs` + `export.mjs`
   vào Directus và API mới của profile `web`, so hai bản xuất sau chuẩn hóa (chạy trong job parity hiện có).
5. Test port từ 31 file test Directus (FR-120; 8 file `_system` đi cùng D-57): mỗi file → một `*.test.ts` cùng tên trong thư mục interface/display;
   ghi nguồn trong header; manifest.
6. Hiệu năng SC-004: `form.browser.test.ts` dựng 50 field, `table.browser.test.ts` 100×10, đo `performance.now()`
   với ngưỡng 1.000 ms trên trung vị 3 lần dựng (SC-004).
7. Axe: `axe-core` `run(document)` trong browser test cho form mẫu và bảng mẫu ở `html.dark` và sáng; 0 vi phạm
   `serious`/`critical` (SC-005).

**Phương án bỏ**: Playwright component testing (`@playwright/experimental-ct-vue`, thêm bộ công cụ khác Vitest);
chỉ happy-dom (editor không chạy, không đo được a11y/focus thật); E2E ở 013 (Clarifications Q-A).

## R9. Chuỗi dịch

Khóa đã có từ script sync của 012 (`interfaces.*`, `displays.*`, `validationError.*`, `operators.*`, khóa gốc
`interface_not_found`, `no_visible_fields`, `edit_raw_value`..., `date-fns_*`). Thiếu thì bổ sung vào danh sách của
`sync-translations.mjs` (không viết tay). Chuỗi `$t:` trong options/display_options/note dịch bằng
`translate-object-values.ts` (012) trong `fields.ts` (`translateFields`) và `RenderTemplate` (`translate`). Kiểm
báo cáo đổi thương hiệu khi thêm khóa (FR-091).

## R10. Flow thủ công từ `header` và `presentation-links`

**Quyết định**: thêm `stores/flows.ts` (chép, chỉ `hydrate`: `GET /flows?fields=id,status,trigger,options,
accountability,...` như Directus) vào `hydrate` của 012 để `isActiveFlow` và nút flow hoạt động; `header` dùng
`useInjectRunManualFlow` chép từ Directus với bản mặc định (khi màn chứa không cung cấp) gọi
`POST /flows/trigger/:id` với `{ collection, keys: [primaryKey] }`, hiện hộp xác nhận có form khi
`options.requireConfirmation` (form từ `options.fields`, dùng `BoForm`). Điều này thu hẹp D-45 (flows store được nạp
ở 013): sửa spec 012 bảng D-45 "Gỡ ở" và spec 013 Assumptions, thêm `GET /flows` vào contracts.

## R11. Khác biệt phát hiện khi research (bổ sung spec)

- D-45 (012): store flows nạp từ 013 (R10); spec 012 cập nhật khi commit plan.
- FR-081/`contracts/api-calls.md`: thêm `GET /flows`, `GET /items/:collection?aggregate[count]=*` (đếm của
  `useItems`), `GET /presets` đã có (012).
- Edge Cases: hành vi nhóm `meta.interface` null đo ở đợt A (R3).
- `formatted-json-value.handler` thứ tự tham số (R4): R-xx khi đóng.

## R12. Hiệu năng và kích thước bundle

Chunk tách bằng `defineAsyncComponent`: tinymce (~450 KB gzip), editorjs + tool (~150 KB), codemirror + mode (~120
KB), maplibre (~230 KB) chỉ tải khi form có field dùng chúng; bundle chính giữ ngân sách 350 KB gzip của 012 (R12
của 012) + ≤ 120 KB cho form, display, drawer, Reka primitives mới [Unverified, đo ở đợt C]. SC-004 đo ở R8.
