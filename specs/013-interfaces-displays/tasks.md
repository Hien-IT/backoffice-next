---

description: "Danh sách task cho feature 013: bộ interfaces và displays theo cấu hình field của Directus"
---

# Tasks: Bộ interfaces và displays theo cấu hình field của Directus

**Input**: Tài liệu thiết kế trong `/specs/013-interfaces-displays/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R12), `data-model.md`, `contracts/`
(`registry.md`, `api-calls.md`, `tests.md`), `quickstart.md`, `checklists/` (`requirements.md`, `release-gate.md`,
`release-gate-proposals.md`).

**Điều kiện bắt đầu**: CI của 012 xanh (thỏa thuận với session 012 cùng working tree, plan Constraints). Task cần môi
trường Docker của `tests/parity` (T004, T020) phải nhắn session 012 trước khi `env-up`/`env-down`.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có test cạnh file: `*.test.ts` (project `unit`, happy-dom) hoặc `*.browser.test.ts` (project `browser`,
  chromium) theo `contracts/tests.md` §1; coverage `apps/web` ≥ 60% gộp hai project.
- Feature không thêm hay sửa endpoint API nên không có test đối chiếu endpoint mới. Đối chiếu ở mức dữ liệu: bộ mẫu
  seed bằng API Directus thật, và `tests/parity/src/web/fixtures-seed.test.ts` chạy seed ở hai API, so bản xuất
  (SC-009). E2E và so payload với Directus app ở 014 (Clarifications Q-A).
- 31 file test Directus (FR-120) port thành test cùng tên, header `// Ported from directus/app/src/...`.
- Chỗ research đánh [Unverified]/[Inference] có task kiểm sớm (T002, T004, T005); kết quả ghi vào research.md.

**Organization**: Task nhóm theo user story của spec. Phase 1, 2 là nền chung (thư viện, recipe nháp, registry, store,
utils, form, render, bộ mẫu). Thứ tự: US1 (form, interface chuẩn và lựa chọn) → US2 (display) → US3 (quan hệ, drawer)
→ US4 (file) → US5 (editor nặng, bản đồ, repeater) → US6 (nhóm, presentation) → US7 (bộ mẫu đủ, đối chiếu seed, a11y,
hiệu năng, CI) → Polish. Bốn đợt commit lên `main` (plan Scale/Scope): A = Phase 1, 2, 3, 4, 8; B = Phase 5, 6;
C = Phase 7, 9; D = Phase 10.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Gốc đường dẫn: `apps/web/src/` viết tắt là `src/`. Interface ở `src/interfaces/<id>/` (`index.ts`, `<Id>.vue`, file
  con, test); display ở `src/displays/<id>/`. Id và tên thư mục đúng Directus (thư mục `presentation-header`, id `header`).
- File chép từ `directus/app/src` (hoặc `directus/packages/composables/src`) PHẢI có dòng đầu
  `// Ported from directus/<đường dẫn>` (SFC: comment trong `<script setup>`); mỗi task chép ghi các cặp
  `{ "source", "dest" }` vào `tools/port-manifest/013-T###.json`; chạy `node tools/check-port-headers.mjs`. KHÔNG sửa,
  xóa hay tạo file trong `directus/`.
- Logic chép giữ tên hàm, thứ tự, mặc định `defineProps`/`withDefaults`, message của Directus (FR-005); chỗ khác nguồn
  ghi `// Backoffice: <lý do>` (api → sdk, `getRootPath`/`getPublicURL` → `apiUrl`, key localStorage `backoffice-`, bỏ
  AI/collab, D-xx).
- Component giao diện viết bằng Reka UI + theme TailAdmin theo recipe nháp (T007): KHÔNG hex thô, KHÔNG palette ngoài
  theme (`check-raw-colors`); màu dữ liệu (choices, `colorOn`, `defaultColor`...) chỉ qua `style` từ giá trị runtime.
  Nút chỉ icon có `aria-label`; control có label liên kết; lỗi gắn `aria-describedby`, `aria-invalid`.
- Chuỗi giao diện dùng khóa Directus (`interfaces.*`, `displays.*`, `validationError.*`, khóa gốc); chuỗi mới (D-60)
  vào overlay cả `vi-VN` và `en-US`.
- Mỗi interface: test theo `contracts/tests.md` §5 (không sửa thì không phát; thiếu khóa dùng mặc định; mỗi khóa
  options có hiệu ứng kiểm được (SC-003); kịch bản sửa so `expected.<id>.json` (SC-002); `disabled`/`nonEditable`/
  `loading`; bàn phím) trên field của bộ mẫu qua `mockFixtureApi`.
- Sau mỗi phase: `pnpm nx run web:lint`, `web:typecheck`, `web:test`, `web:build` xanh.

---

## Phase 1: Setup (thư viện, kiểm [Unverified], test browser, recipe nháp)

**Purpose**: cài gói, kiểm giả định, cấu hình hai project Vitest, đo hành vi Directus còn mở, viết recipe nháp trước
mọi task giao diện (FR-093, CHK025).

- [ ] T001 `pnpm-workspace.yaml` catalog nhóm "Web" thêm gói research R1 với bản Directus: `tinymce: 6.8.6`,
  `@tinymce/tinymce-vue: 6.3.0`, `@editorjs/editorjs: 2.31.2` và 14 tool (`attaches` 1.3.2, `checklist` 1.6.0, `code`
  2.9.3, `delimiter` 1.4.2, `embed` 2.7.6, `header` 2.8.8, `image` 2.10.3, `inline-code` 1.5.2, `nested-list` 1.4.3,
  `paragraph` 2.11.7, `quote` 2.7.6, `raw` 2.5.1, `table` 2.4.5, `underline` 1.2.1), `editorjs-toggle-block: 0.3.16`,
  `codemirror: 5.65.18`, `jsonlint-mod: 1.7.6`, `maplibre-gl: 1.15.3`, `@mapbox/mapbox-gl-draw: 1.5.1`,
  `@mapbox/mapbox-gl-draw-static-mode: 1.0.1`, `@mapbox/mapbox-gl-geocoder: 5.1.2`, `wellknown: 0.5.0`, `@turf/meta`
  (bản Directus catalog), `vuedraggable: 4.1.0`, `vue-virtual-scroller: 2.0.0-beta.8`, `color: 5.0.2`,
  `@sindresorhus/slugify: 2.2.1`, `date-fns-tz: 3.2.0`, `@fortawesome/fontawesome-svg-core: 6.7.2`,
  `@fortawesome/free-brands-svg-icons: 6.7.2`, `@directus/utils: 13.4.1`, `@directus/types: 15.0.3` (dev),
  `@vitest/browser: 3.2.4` (dev), `axe-core` (4.11.x, dev); `micromustache` đã có. `apps/web/package.json` thêm theo
  `catalog:`; `pnpm install`; lockfile cập nhật.
- [ ] T002 Kiểm [Unverified] của R1, R8: `pnpm view <gói>@<bản> version license` cho mọi gói T001 (ghi giấy phép:
  `jsonlint-mod`, `vue-virtual-scroller`, Font Awesome mã MIT + icon CC BY 4.0, TinyMCE 6 MIT); test tạm import
  `validatePayload`, `parseFilter`, `getFieldsFromTemplate` từ `@directus/utils` trong Vite build của `apps/web` (build
  trình duyệt chạy, joi vào chunk); gói không có hoặc giấy phép ngoài FR-064 thì dùng dự phòng của R1 và ghi vào
  `specs/013-interfaces-displays/research.md` mục R1 "Kết quả kiểm".
- [ ] T003 `apps/web/vitest.config.ts` chuyển sang `test.projects`: `unit` (happy-dom, `src/**/*.test.ts`, bỏ
  `*.browser.test.ts`) và `browser` (`@vitest/browser`, provider playwright, chromium headless,
  `src/**/*.browser.test.ts`); coverage v8 gộp, ngưỡng 60% (thử v8 ở browser mode, không được thì istanbul cho cả hai và
  ghi R8); `apps/web/project.json` thêm target `test:unit`, `test` chạy cả hai; `.github/workflows/ci.yml` job test web
  cài `pnpm exec playwright install chromium` (cache như `e2e-web`); một `src/test-utils/browser.smoke.browser.test.ts`
  dựng một component để kiểm cấu hình.
- [ ] T004 Đo trên Directus app 11.17.4 (profile `app` của `tests/parity`, nhắn session 012 trước): field nhóm có
  `meta.interface` null (`special: alias,no-data,group`) trong form item: field con có hiện không, có lỗi console không.
  Ghi kết quả vào `specs/013-interfaces-displays/spec.md` Edge Cases (dòng "Field nhóm có `meta.interface` null") và
  research R3; khác Directus chỉ khi Directus ném lỗi chặn form (khi đó D-xx).
- [ ] T005 Kiểm WebGL cho MapLibre 1.15.3 trong chromium headless của project `browser` (dựng map trống,
  `--use-gl=swiftshader`/`--enable-unsafe-swiftshader`); không được thì quyết định mock `maplibre-gl` cho test
  component và chỉ test thật `utils/geometry`; ghi research R7.
- [ ] T006 `tools/check-raw-colors.mjs`: danh sách miễn duy nhất (Q-C, CHK049) gồm đường dẫn file và tên hằng màu dữ
  liệu Directus (`src/interfaces/select-color/presets.ts` 9 màu, `src/displays/color/index.ts` `defaultColor
  #B0BEC5`, các hằng tương tự phát hiện khi chép); test `tools/check-raw-colors.test.mjs` thêm ca miễn và ca hex ngoài
  danh sách vẫn bị chặn.
- [ ] T007 Recipe nháp "nháp (013)" cho Q-1 đến Q-12 (research R6) trong `design-system/docs/component-specs.md` (Tier 3:
  Combobox, MultiSelect, Radio, CheckboxGroup, CheckboxTree, DatePicker, Slider, Rating, Chip, TagsInput, Tabs,
  Accordion, Detail, Divider có tiêu đề, ColorPicker, IconPicker, EditorFrame, khung bản đồ, Table đơn giản, Upload,
  ảnh xem trước, Lightbox, ValueNull, UserPopover, menu "N items") và `design-system/docs/layout-patterns.md` §8 (lưới
  form hai cột từ 768 px, `half`/`full`/`fill`, nhãn kèm menu, chấm sửa, ghi chú, lỗi tổng hợp; `BoDrawer` `w-[640px]`
  nháp, toàn bề rộng dưới `xl`); cặp màu mới vào bảng tương phản `design-system/docs/migration-guide.md`; mỗi recipe
  theo quy ước `component-specs.md` (Reka primitive, state, bàn phím, dark).
- [ ] T008 [P] `src/stores/server.ts` (012) thêm `info.files.mimeTypeAllowList` từ `/server/info` (FR-053) và hàm
  `parseGlobalMimeTypeAllowList` chép từ Directus; test `src/stores/server.test.ts` thêm ca.

**Checkpoint**: gói cài, giả định đã kiểm, `web:test` chạy được hai project, recipe nháp có trước mọi task giao diện.

---

## Phase 2: Foundational (registry, store, utils, form, render, bộ mẫu)

**Purpose**: nền mà mọi story cần. Chưa có interface/display cụ thể nào ngoài `system-raw-editor`.

### Registry và mặc định theo kiểu

- [ ] T009 `src/interfaces/types.ts`, `src/displays/types.ts` (kiểu `InterfaceConfig`, `DisplayConfig` từ
  `@directus/types`, props chung theo `contracts/registry.md` §1, §2); `src/interfaces/index.ts`,
  `src/displays/index.ts` (`import.meta.glob('./*/index.ts', { eager: true })` cộng `./_system/*/index.ts`, sắp theo
  id, `getInterface(id)`, `getDisplay(id)`, danh sách); test `src/interfaces/index.test.ts` port từ
  `directus/app/src/interfaces/index.test.ts` (thứ tự).
- [ ] T010 [P] Chép `src/utils/get-default-interface-for-type.ts`, `src/utils/get-default-display-for-type.ts` (FR-002)
  + test bảng đủ kiểu.
- [ ] T011 `src/interfaces/registry.test.ts` (contracts/registry §3): đọc trực tiếp `directus/app/src/interfaces/<id>/
  index.ts` và `directus/app/src/displays/<id>/index.ts` (parse tĩnh như `sync-translations.test.ts`), với mỗi config
  đã đăng ký so `id`, `types`, `localTypes`, `group`, `relational`, `hideLabel`, `hideLoader`, `autoKey`,
  `recommendedDisplays` và tập khóa options (kể cả `{standard, advanced}` và hàm options gọi với vài `field.type`);
  ca "đủ 40 + `system-raw-editor` và 18" bật ở T089.

### Store

- [ ] T012 Chép phần còn lại của `src/stores/fields.ts` từ `directus/app/src/stores/fields.ts`: `parseField` (`name`
  từ `formatTitle` hoặc `fields.<collection>.<field>` của `meta.translations`), `translateFields` (dịch `$t:` trong
  `note`, `options`, `display_options`, `validation_message`), `getField`, `getFieldsForCollection`,
  `getPrimaryKeyFieldForCollection`, `getFieldGroupChildren`; gọi `translateFields` khi đổi ngôn ngữ trong
  `src/lang/set-language.ts` (FR-006); test `src/stores/fields.test.ts`.
- [ ] T013 [P] `src/stores/collections.ts` (`getCollection`, `visibleCollections`, `allCollections`,
  `translateCollections`), `src/stores/relations.ts` (`getRelationsForField`, `getRelationsForCollection`,
  `getRelationForField`), `src/stores/presets.ts` (`getPresetForCollection`: user → role → global, không bookmark)
  chép từ Directus; test cho từng store.
- [ ] T014 [P] `src/stores/flows.ts` mới chép `directus/app/src/stores/flows.ts` (chỉ `hydrate`: không quyền đọc
  `directus_flows` → rỗng, không gọi API; lỗi → rỗng; `GET /flows` như contracts/api-calls #33; `getManualFlowsForCollection`,
  `isActiveFlow`); thêm vào `src/hydrate.ts` và `dehydrate`; test `src/stores/flows.test.ts`, `src/hydrate.test.ts`
  thêm ca.

### Utils và composable chép

- [ ] T015 [P] Chép utils hiển thị: `src/utils/render-string-template.ts` (`renderPlainStringTemplate`,
  `renderDisplayStringTemplate`), `src/utils/adjust-fields-for-displays.ts`, `src/utils/get-related-collection.ts`,
  `src/utils/get-item-route.ts`, `src/utils/readable-mime-type.ts`, `src/utils/format-filesize.ts`,
  `src/utils/format-date.ts` (+ `date-fns-tz`, khóa `date-fns_*` đã có), `src/utils/get-fields-from-template.ts` (hoặc
  dùng `@directus/utils`), `src/utils/replace-url-access-token.ts`, `src/utils/selective-clone.ts`; test cho từng file.
- [ ] T016 [P] Chép composable: `src/composables/use-alias-fields.ts`, `src/composables/use-custom-selection.ts` (từ
  `directus/packages/composables/src`, kèm test port `use-custom-selection.test.ts`), `src/composables/use-template-data.ts`
  (api → sdk); test.
- [ ] T017 [P] Chép `src/composables/use-items.ts` và `src/composables/use-collection.ts` từ
  `directus/packages/composables/src` (axios/`useApi` → sdk; query `fields`, `sort`, `limit`, `page`, `search`,
  `filter`; đếm `aggregate[count]`/`countDistinct` như Directus, contracts/api-calls #34, #35); port test
  `use-items.test.ts`, `use-collection.test.ts`.

### Form theo metadata (FR-010 đến FR-019)

- [ ] T018 Chép utils form vào `src/components/form/utils/`: `get-form-fields.ts`, `apply-conditions.ts` (`$version` =
  `null`, FR-013), `push-group-options-down.ts`, `update-field-widths.ts`, `validate-item.ts` (`validatePayload` của
  `@directus/utils`), `clear-hidden-fields-by-condition.ts`, `get-default-values-from-fields.ts`,
  `format-validation-structure.ts`; port test Directus có sẵn của các utils này; test thêm cho luật khớp sau cùng
  thắng, mảng options thay cả mảng, `clear_hidden_value_on_save` trong nhóm.
- [ ] T019 Base form component theo recipe Q-1: `src/components/form/BoForm.vue` (chép `v-form.vue`, bỏ
  `use-ai-tools`, collab (D-54); `values` provide; `emitValue` bỏ khi bằng ban đầu; `hasEdits` qua `defineExpose`
  (FR-084); batch mode như `useBatch`, mọi field trừ khóa chính (FR-019); `autofocus`; `direction`; divider hệ thống;
  `no_visible_fields`), `FormField.vue`, `FormFieldLabel.vue` (chấm sửa, `*`, ẩn, raw toggle), `FormFieldMenu.vue`
  (bảy mục và điều kiện tắt như `form-field-menu.vue`; menu giá trị thô như Directus, FR-066), `FormFieldInterface.vue`
  (props contracts/registry §1, `interface_not_found`, skeleton trừ `hideLoader`, hộp lỗi `unexpected_error`),
  `FormFieldRawEditor.vue` (`BoDialog`, ép kiểu), `ValidationErrors.vue` (`validation_errors_notice`, cuộn tới field,
  "(hidden)", "(Hidden in {group})", `validation_message` với tooltip gốc); test component cho FR-010 đến FR-019 (US1
  scenario 2–7) trên field giả lập.
- [ ] T020 `src/interfaces/_system/system-raw-editor/` chép `directus/app/src/interfaces/_system/system-raw-editor`
  (CodeMirror 5, `language` `mustache`|`plaintext`, `placeholder`, chỉ đọc khi `disabled`, FR-004); CSS CodeMirror theo
  token sáng/tối (FR-095); test mới (Directus không có).

### Render display và template (FR-070, FR-071)

- [ ] T021 Theo recipe Q-12: `src/components/BoTextOverflow.vue` (chép `v-text-overflow`), `src/components/render/
  ValueNull.vue`, `RenderDisplay.vue` (null → `--`, display không có → text, lỗi → text), `RenderTemplate.vue` (tách
  `{{ }}`, display theo field hoặc mặc định, mảng cho `related-values`/`formatted-value`/`formatted-json-value`/
  `translations`, `$thumbnail`, `field:collection` của m2a, `translate`); test với display giả.

### Bộ mẫu và API giả lập (FR-100, contracts/tests §2, §3)

- [ ] T022 `apps/web/fixtures/interfaces/seed.mjs` (REST, token admin, idempotent: xóa rồi tạo collection `bo_*` theo
  data-model §6: `bo_std`, `bo_groups`, `bo_rel`, `bo_rel_target`, `bo_junction_*`, `bo_m2a_a`, `bo_m2a_b`, `bo_tree`,
  `bo_translations`, `bo_languages`; folder `bo-fixtures` và file mẫu (ảnh PNG, SVG, PDF); role/policy/user `bo-editor`
  (quyền một phần), `bo-viewer` (chỉ đọc); item có giá trị do Directus ghi, kể cả giá trị lệch dạng cho list, map, code
  (CHK006); field `geometry.*` chỉ khi DB là Postgres có PostGIS) và `export.mjs` (snapshot chuẩn hóa: id ổn định
  `bo-<n>`, thời gian, `meta.id`), target Nx `web:fixtures`; `fixtures/interfaces/README.md`. Field của từng interface
  và display thêm dần ở task của story (mỗi task interface thêm field của nó vào seed).
- [ ] T023 Chạy `web:fixtures` lần đầu trên Directus thật (profile `app`, nhắn session 012 trước), commit
  `apps/web/fixtures/interfaces/snapshot/*.json` và `meta.json`; chạy lại sau mỗi đợt có field mới.
- [ ] T024 `src/test-utils/fixtures.ts` (`loadSnapshot`, `fieldsOf`, `itemOf`, `expected`), `src/test-utils/fetch.ts`
  thêm `mockFixtureApi(snapshot, { user })` (route contracts/tests §3, lọc trong bộ nhớ `_eq`, `_neq`, `_in`, `_nin`,
  `_null`, `_nnull`, `_or`, `_and`, `search`, `limit`, `page`, `sort`, `fields` lồng một cấp, `aggregate[count]`;
  `POST /files`, `/files/import`, `/flows/trigger/:id` ghi lại) và `assertOnlyKnownRequests(calls)` (danh sách
  `contracts/api-calls.md` + 012); test `src/test-utils/fetch.test.ts`.
- [ ] T025 `apps/web/fixtures/interfaces/snapshot.test.ts`: mỗi interface id và display id có ít nhất một field trong
  `fields.json` (ca đủ bật ở T089); mỗi `expected.<id>.json` có trường `source` cho từng giá trị (CHK051).

**Checkpoint**: form dựng được field giả với `system-raw-editor`, render template chạy, bộ mẫu và API giả lập sẵn sàng.

---

## Phase 3: User Story 1 - Form nhập liệu theo cấu hình field (Priority: P1) 🎯 MVP

**Goal**: form dựng từ cấu hình field của bộ mẫu với mọi interface chuẩn và lựa chọn (FR-020 đến FR-037 trừ `list`),
đúng options, độ rộng, điều kiện, validation, menu field.

**Independent Test**: `src/components/form/BoForm.fixture.test.ts` dựng `bo_std` từ bộ mẫu, khẳng định DOM và giá
trị phát ra theo US1 scenario 1–7.

### Component cơ sở (theo recipe T007)

- [ ] T026 [P] [US1] `src/components/BoTextarea.vue`, `BoCheckbox.vue`, `BoSwitch.vue`, `BoRadio.vue` (RadioGroup) theo
  `component-specs.md` (Textarea, Checkbox, Toggle) và recipe nháp Radio; test.
- [ ] T027 [P] [US1] `src/components/BoCombobox.vue` (Reka Combobox, cho phép "khác"), `BoMultiSelect.vue` (chip trong
  ô, `previewThreshold`), `BoCheckboxGroup.vue` (lưới, "hiện thêm"), `BoCheckboxTree.vue` (logic chép
  `v-checkbox-tree`, `valueCombining`); test.
- [ ] T028 [P] [US1] `src/components/BoDatePicker.vue` chép `directus/app/src/components/v-date-picker/*` (Reka
  Calendar, TimeField, `@internationalized/date`, `use24`, `includeSeconds`, theo kiểu `date`/`time`/`dateTime`/
  `timestamp`); test.
- [ ] T029 [P] [US1] `src/components/BoSlider.vue` (Reka Slider, nhãn giá trị, ticks), `BoChip.vue`, `BoTagsInput.vue`;
  test.
- [ ] T030 [P] [US1] `src/components/BoColorPicker.vue` (Popover, RGB/HSL, thanh trượt, input màu của trình duyệt,
  cảnh báo tương phản thấp), `BoIconPicker.vue` (nhóm theo `icons.json`, tìm kiếm, `vue-virtual-scroller`);
  `src/components/BoIcon.vue` (012) vẽ thêm tên `social:*` bằng Font Awesome brands như `social-icon.vue`; test.

### Interface chuẩn, chữ, số, ngày (mỗi task: chép `index.ts` + `.vue`, thêm field vào seed T022, test theo §5)

- [ ] T031 [P] [US1] `src/interfaces/input/` (FR-020: options theo kiểu số/khác, `masked`, `clear`, `slug` với
  `@sindresorhus/slugify`, `trim`, bộ đếm, integer/float, bigInteger/decimal giữ chuỗi; chép logic `v-input.vue`
  liên quan); port `input/index.test.ts`, `input/input.test.ts`.
- [ ] T032 [P] [US1] `src/interfaces/input-multiline/` (FR-021) và `src/interfaces/input-hash/` (FR-022, không đặt giá
  trị đã lưu vào ô, `value_securely_stored`); port `input-hash.test.ts`.
- [ ] T033 [P] [US1] `src/interfaces/input-autocomplete-api/` (FR-023: micromustache `{{value}}`, URL ngoài bằng
  `fetch` `credentials: 'omit'` không header phiên, URL `/` qua sdk, throttle/debounce, `resultsPath`/`textPath`/
  `valuePath`); test cả hai loại URL và kết quả không phải mảng.
- [ ] T034 [P] [US1] `src/interfaces/boolean/` (FR-024) và `src/interfaces/slider/` (FR-026); test.
- [ ] T035 [P] [US1] `src/interfaces/datetime/` (FR-025: `tz` với `date-fns-tz`, định dạng chuỗi theo kiểu, `use24`
  mặc định `true`); port `datetime.test.ts`; xác nhận dạng chuỗi theo kiểu và sửa FR-025 nếu khác [Inference].
- [ ] T036 [P] [US1] `src/interfaces/tags/` (FR-027: xử lý trim → hoa thường → khoảng trắng → sắp → bỏ trùng,
  `allowCustom`, chế độ biến khi `rawEditorEnabled`, field `csv` phát mảng); port `tags.test.ts`.
- [ ] T037 [P] [US1] `src/interfaces/input-code/` (FR-028: CodeMirror 5 + `import-codemirror-mode.ts`, danh sách
  `language` từ `CodeMirror.modeInfo`, `jsonlint-mod`, json parse/null/`{{ biến }}`, nút `template`; CSS theo token);
  port `input-code.test.ts`.

### Interface lựa chọn

- [ ] T038 [P] [US1] `src/interfaces/select-dropdown/` (FR-030) và `src/interfaces/select-multiple-dropdown/` (FR-031);
  test.
- [ ] T039 [P] [US1] `src/interfaces/select-radio/` (FR-032, `allowOther` khai `string` đọc như boolean) và
  `src/interfaces/select-multiple-checkbox/` (FR-033); port `select-radio.test.ts`, `select-multiple-checkbox.test.ts`.
- [ ] T040 [P] [US1] `src/interfaces/select-multiple-checkbox-tree/` (FR-034); test.
- [ ] T041 [P] [US1] `src/interfaces/select-icon/` (FR-035, `icons.json` chép, nhóm Social, `vue-virtual-scroller`);
  port `select-icon.test.ts`; ghi công icon Font Awesome trong `apps/web/README.md`.
- [ ] T042 [P] [US1] `src/interfaces/select-color/` (FR-036, `presets` 9 màu trong danh sách miễn T006, `opacity`,
  `color` 5.0.2, `var(--x)`); port `select-color.test.ts`.

### Kiểm story

- [ ] T043 [US1] `src/components/form/BoForm.fixture.test.ts`: dựng `bo_std` từ bộ mẫu với `mockFixtureApi`: US1
  scenario 1–7 (input options, null/không có interface, hai điều kiện cùng khớp, `half` → `half-right`, sửa rồi đặt
  lại, `FAILED_VALIDATION` hai field, menu field của field bắt buộc), tạo mới `primaryKey = '+'` (FR-015), không sửa
  thì 0 thay đổi; `assertOnlyKnownRequests`.
- [ ] T044 [US1] Cập nhật bộ mẫu (T022, T023) với mọi tổ hợp options của T031 đến T042 và `expected.<id>.json` (có
  `source`); `snapshot.test.ts` đạt cho các id của US1.

**Checkpoint**: US1 kiểm được độc lập; MVP = form với interface chuẩn và lựa chọn.

---

## Phase 4: User Story 2 - Hiển thị giá trị theo display (Priority: P1)

**Goal**: 18 display đúng `display_options`, mặc định theo kiểu, dạng chữ `handler`, field nạp thêm (FR-070 đến
FR-079).

**Independent Test**: `src/displays/displays.fixture.test.ts` vẽ giá trị của bộ mẫu bằng 18 display, so chuỗi hiển thị
và `handler` với giá trị mong đợi (US2 scenario 1–5).

- [ ] T045 [P] [US2] `src/displays/boolean/`, `src/displays/color/` (`defaultColor` trong danh sách miễn, viền tương
  phản), `src/displays/icon/` (`filled`, `color` chỉ hex, `social:*`), `src/displays/hash/`, `src/displays/raw/`,
  `src/displays/filesize/`, `src/displays/mime-type/`; port `boolean.test.ts`, `color.test.ts`, `icon.test.ts`,
  `hash.test.ts`; test cho id còn lại.
- [ ] T046 [P] [US2] `src/displays/formatted-value/` (FR-074, FR-076: `conditionalFormatting` luật sau cùng thắng, so
  theo kiểu, `masked`, `translate` ẩn, `format` theo locale, DOMPurify khử HTML) và `src/displays/formatted-json-value/`
  (`handler` tái hiện thứ tự `render()` của Directus, ghi chú R-xx cho T102); port `formatted-value.test.ts`; test.
- [ ] T047 [P] [US2] `src/displays/labels/` (`format` true, `showAsDot`, `choices`; `handler` tra thêm choices của
  interface, FR-079) và `src/displays/rating/` (`simple`, `interfaceOptions.maxValue`); theo recipe Q-4, Q-5; port `rating.test.ts`; test.
- [ ] T048 [P] [US2] `src/displays/datetime/` (relative cập nhật 60 s, `strict`, `round`, `tz` tooltip, `use24` mặc
  định `false`; chép `use-datetime.vue`); test cả `en-US` và `vi-VN` (FR-075).
- [ ] T049 [P] [US2] `src/displays/collection/`, `src/displays/file/`, `src/displays/image/` (`circle`; ảnh
  `system-small-cover` + `cacheBuster`, lỗi tải → icon/nhãn đuôi, FR-077); test.
- [ ] T050 [P] [US2] `src/displays/user/` (`display`, `circle`) và `src/components/render/UserPopover.vue` (Popover
  theo recipe Q-12, `GET /users/:id?fields=...` contracts/api-calls #49, lỗi quyền hiện như Directus); test.
- [ ] T051 [US2] `src/displays/related-values/` ("N item(s)" + menu + link `getItemRoute`, m2o trực tiếp, `fields` theo
  template, `handler` dùng handler lồng) và `src/displays/translations/` (chọn ngôn ngữ theo `userLanguage`/
  `defaultLanguage`, menu tiến độ); test với quan hệ của bộ mẫu.
- [ ] T052 [US2] `src/displays/displays.fixture.test.ts`: US2 scenario 1–5 trên bộ mẫu, `handler` của 10 display
  (FR-072), `adjustFieldsForDisplays` và alias (FR-073); cập nhật seed (T022, T023) với field của mỗi display và
  `display_options`.

**Checkpoint**: US1 + US2 dùng được: form và hiển thị giá trị.

---

## Phase 5: User Story 3 - Quan hệ m2o, o2m, m2m, m2a, tree view, translations (Priority: P1)

**Goal**: interface quan hệ gom thay đổi đúng dạng `{create, update, delete}` hoặc khóa/object, quyền theo
`use-relation-permissions.ts`, drawer item, chọn item dạng bảng, sửa hàng loạt (FR-040 đến FR-049, D-58, D-60).

**Independent Test**: test component trên `bo_rel`, `bo_tree`, `bo_translations` với `mockFixtureApi` cho `admin`,
`bo-editor`, `bo-viewer`: request đọc, giá trị phát ra, nút theo quyền (US3 scenario 1–5).

- [ ] T053 [P] [US3] Chép `src/composables/use-relation-m2o.ts`, `use-relation-o2m.ts`, `use-relation-m2m.ts`,
  `use-relation-m2a.ts`, `use-relation-single.ts`, `use-relation-multiple.ts` (prop `version` như Directus, FR-040),
  `use-relation-permissions.ts` (bảng quyền FR-041, `one_deselect_action`); port `use-relation-multiple.test.ts`,
  `use-relation-permissions.test.ts`.
- [ ] T054 [P] [US3] `src/components/BoTable.vue` (recipe Q-11: cột, chọn một/nhiều, sort, resize, khoảng cách
  compact/cozy/comfortable 29/43/58, empty `no_items`, `aria-busy`) và `src/components/drawers/BoDrawer.vue` (Reka
  Dialog dạng panel phải, recipe Q-10, focus trap, Esc, focus về nút mở, toàn bề rộng dưới `xl`); test browser cho focus.
- [ ] T055 [US3] `src/components/drawers/DrawerItem.vue` chép `drawer-item.vue` (tạo/sửa item liên quan hoặc dòng nối,
  `junction-field`, `related-primary-key`, `circular-field`, `junction-field-location`, kiểm hợp lệ phía client trước
  khi gom (FR-018), hỏi trước khi bỏ thay đổi (FR-084), lồng không giới hạn (FR-040)); test.
- [ ] T056 [US3] `src/components/drawers/DrawerCollection.vue` chép `drawer-collection.vue` dạng bảng (D-58): cột từ
  preset `layout_query.tabular.fields` hoặc 4 field hiện đầu, `use-items`, tìm kiếm, phân trang, chọn một/nhiều, bộ lọc
  của interface (`mergeFilters`), trạng thái tải/trống/lỗi (FR-046); test.
- [ ] T057 [US3] `src/components/drawers/DrawerBatch.vue` chép `drawer-batch.vue` (form batch, `stage-on-save`); port
  `drawer-batch.test.ts`.
- [ ] T058 [US3] Menu dòng "Lên", "Xuống" cho danh sách kéo thả (D-60, FR-094): `src/components/BoSortableList.vue`
  bọc `vuedraggable` + menu dòng; khóa overlay `src/lang/overlay/{en-US,vi-VN}.ts`; test bàn phím.
- [ ] T059 [P] [US3] `src/interfaces/select-dropdown-m2o/` (FR-042: template, `enableCreate`, `enableSelect`, `filter`
  điền `{{ field }}` từ `values`, `enableLink`, thông báo cấu hình); port `select-dropdown-m2o.test.ts`.
- [ ] T060 [US3] `src/interfaces/list-o2m/` (FR-043: list/table, `tableSpacing`, `fields`, `limit`, `sort` so với
  `sortField`, `enableSearchFilter`, `enableLink`, bỏ chọn theo `one_deselect_action`, sửa hàng loạt, độ rộng cột
  `backoffice-o2m-column-widths-*`); port `list-o2m.test.ts`.
- [ ] T061 [US3] `src/interfaces/list-m2m/` (FR-044: như o2m cộng `junctionFieldLocation`, `allowDuplicates`, singleton
  cảnh báo, `backoffice-m2m-column-widths-*`); port `list-m2m.test.ts`.
- [ ] T062 [US3] `src/interfaces/list-m2a/` (FR-045: tạo/thêm theo collection, bỏ singleton, `prefix`, page sizes);
  test.
- [ ] T063 [US3] `src/interfaces/list-o2m-tree-view/` (FR-047: `NestedDraggable`, `item-preview`, thay đổi lồng,
  `itemsMoved`, quan hệ không đệ quy thì thông báo); test.
- [ ] T064 [US3] `src/interfaces/translations/` (FR-048: `translation-form.vue`, `language-select.vue`, ngôn ngữ đầu/thứ
  hai, chia đôi > 960 px, tiến độ, `badge`, `direction`, lỗi `field.lang.subfield`, edge ngôn ngữ trống/thiếu); port
  `translation-form.test.ts`.
- [ ] T065 [P] [US3] `src/interfaces/collection-item-dropdown/` và `src/interfaces/collection-item-multiple-dropdown/`
  (FR-049, edge collection không còn/không quyền); port `collection-item-multiple-dropdown.test.ts`.
- [ ] T066 [US3] `src/interfaces/relations.fixture.test.ts`: US3 scenario 1–5 trên bộ mẫu với ba user (bảng quyền
  FR-041, chỉ đọc vẫn mở link), payload `{create, update, delete}` so `expected.*.json`; cập nhật seed (T022, T023) với
  mọi quan hệ và item mẫu.

**Checkpoint**: quan hệ và drawer chạy độc lập trên bộ mẫu.

---

## Phase 6: User Story 4 - File, ảnh, nhiều file (Priority: P2)

**Goal**: tải từ máy, thư viện, URL, xem lớn, tải xuống, sửa thông tin, bỏ chọn (FR-050 đến FR-054; D-59 không có chỉnh
ảnh).

**Independent Test**: test component `file`, `file-image`, `files` trên `bo_rel`: request `POST /files` có `folder`,
`POST /files/import` có `filterMimeType`, giá trị field (US4 scenario 1–2).

- [ ] T067 [P] [US4] `src/components/files/BoUpload.vue` chép `v-upload.vue` (kéo thả, chọn file, từ URL, từ thư viện,
  tiến độ, lỗi `translateAPIError` `413`/kiểu bị từ chối, nhiều file báo lỗi từng file, `accept`; recipe Q-11),
  `FileLightbox.vue`, `FilePreview.vue` (chép); test (multipart qua sdk).
- [ ] T068 [US4] `src/components/drawers/DrawerFiles.vue` chép `drawer-files.vue` (lọc mime, folder, bộ lọc của
  interface); port `drawer-files.test.ts`.
- [ ] T069 [P] [US4] `src/interfaces/file/` (FR-050: thumbnail `system-small-cover` + `cacheBuster`, SVG không biến
  đổi, sửa thông tin qua `DrawerItem` trên `directus_files`, tải xuống, bỏ chọn, chỉ đọc vẫn xem và tải); test.
- [ ] T070 [P] [US4] `src/interfaces/file-image/` (FR-051: `crop`, `letterbox`, `system-large-cover`/`contain`, xem lớn,
  lỗi tải theo mã, không nút chỉnh ảnh D-59, `allowedMimeTypes` mặc định `image/*`); test.
- [ ] T071 [US4] `src/interfaces/files/` (FR-052: tải nhiều, sắp xếp ghi sort `index + 1`, menu dòng mở tab/tải xuống,
  "Lên"/"Xuống" D-60); test.
- [ ] T072 [US4] `src/interfaces/files.fixture.test.ts`: US4 scenario 1–2, `assertOnlyKnownRequests` chỉ cho ghi FR-054;
  cập nhật seed (T022, T023) với `file`, `file-image`, `files` và `expected.*.json`.

**Checkpoint**: file và ảnh chạy độc lập.

---

## Phase 7: User Story 5 - Rich text, markdown, block editor, bản đồ, repeater (Priority: P2)

**Goal**: giá trị cùng định dạng Directus: HTML, markdown, block JSON, GeoJSON/WKT/`[lng, lat]`, mảng object (FR-037,
FR-060 đến FR-066).

**Independent Test**: test browser mỗi interface: nạp giá trị Directus đã ghi, không sửa thì không phát; sửa theo kịch
bản thì giá trị phát ra bằng `expected.*.json` (US5 scenario 1–4).

- [ ] T073 [P] [US5] `src/components/BoEditorFrame.vue` (recipe Q-8: viền `FIELD`, thanh công cụ, bộ đếm `softLength`)
  dùng chung cho editor; test.
- [ ] T074 [US5] `src/interfaces/input-rich-text-html/` chép `index.ts`, `.vue`, `toolbar-default.ts`, `use*.ts`
  (image, media, link, pre, inline code, code), `get-editor-styles.ts` (biến theo token sáng/tối, FR-095); TinyMCE 6.8.6
  tự host skin (`public/` hoặc Vite `?url`), cấu hình như Directus (`extended_valid_elements`, `convert_urls: false`,
  `paste_data_images: false`, `link_default_protocol`, `ui_mode`, `directionality`), `tinymceOverrides`, `customFormats`,
  tên toolbar cũ, `imageToken` qua `replaceUrlAccessToken`, URL ảnh `apiUrl` + `assets/<id>.<ext>`; `defineAsyncComponent`;
  port `useImage.test.ts`; `input-rich-text-html.browser.test.ts`.
- [ ] T075 [P] [US5] `src/interfaces/input-rich-text-md/` (FR-061: CodeMirror markdown, `edits.ts`, phím tắt, preview qua
  `utils/markdown.ts`, `customSyntax`, chèn ảnh có `imageToken`); test + browser test.
- [ ] T076 [US5] `src/interfaces/input-block-editor/` chép `tools.ts`, `plugins.ts`, `sanitize.ts` (nguyên),
  `alignment.ts`, `use-file-handler.ts`, `bus.ts` (FR-062: `tools`, bỏ ảnh/tệp khi không đọc được `directus_files`,
  `fileURL`/`url` từ `apiUrl`, accept theo `mimeTypeAllowList`); port `input-block-editor.test.ts`,
  `sanitize.test.ts`; browser test.
- [ ] T077 [US5] `src/utils/geometry/` chép `directus/app/src/utils/geometry/*` (`getGeometryFormatForType`, serialize
  GeoJSON/WKT/`[lng, lat]`, gộp Multi*), `basemap.ts` (OpenStreetMap + attribution, nhánh tối, `basemaps` settings,
  Mapbox khi `mapbox_key`); test đủ 6 kiểu hình học × định dạng.
- [ ] T078 [US5] `src/interfaces/map/` (FR-063: `map.vue`, `style.ts`, `defaultView` hoặc vừa dữ liệu, draw giới hạn
  theo kiểu con, nút vừa dữ liệu/điều hướng/vị trí, geocoder nạp động, `jumpTo` khi reduce motion (FR-094), khung theo
  recipe Q-9); test (thật hoặc mock theo T005) + browser test nếu WebGL chạy.
- [ ] T079 [US5] `src/interfaces/list/` (FR-037: `fields`, `template`, `addLabel`, `sort`, drawer form con `primaryKey
  '+'`, bắt buộc chặn lưu, hỏi bỏ thay đổi, cảnh báo không phải mảng, "Lên"/"Xuống" D-60); test.
- [ ] T080 [US5] Cập nhật seed (T022, T023) với field và giá trị Directus của T074 đến T079 (kể cả giá trị lệch dạng) và
  `expected.*.json`; `src/interfaces/rich.fixture.browser.test.ts` US5 scenario 1–4.

**Checkpoint**: editor nặng, bản đồ, repeater chạy; chunk tách (R12).

---

## Phase 8: User Story 6 - Nhóm field và presentation (Priority: P2)

**Goal**: nhóm (accordion, detail, raw, tabs) và presentation (divider, header, links, notice) như Directus, flow thủ
công (FR-055 đến FR-059).

**Independent Test**: test component trên `bo_groups`: trạng thái mở, tab đang chọn, nút link/flow (US6 scenario 1–3).

- [ ] T081 [P] [US6] `src/components/BoTabs.vue`, `BoAccordion.vue`, `BoDetail.vue`, `BoDivider.vue` theo recipe Q-6
  (Reka Tabs, Accordion, Collapsible; reduce motion); test.
- [ ] T082 [P] [US6] `src/interfaces/group-accordion/` (`accordionMode`, `start`, Shift+bấm, mục có lỗi tự mở) và
  `src/interfaces/group-detail/` (`start`, `headerIcon`, `headerColor`, chấm sửa, tooltip lỗi, tự mở); port
  `group-accordion.test.ts`, `group-detail.test.ts`.
- [ ] T083 [P] [US6] `src/interfaces/group-raw/` và `src/interfaces/group-tabs/` (`fillWidth`, tab đầu có lỗi,
  `direction`); xử lý nhóm `meta.interface` null theo kết quả T004; port `group-raw.test.ts`.
- [ ] T084 [P] [US6] `src/interfaces/presentation-divider/` (FR-056) và `src/interfaces/presentation-notice/` (FR-059,
  markdown khử HTML); test.
- [ ] T085 [US6] `src/composables/use-run-manual-flow.ts` chép `useRunManualFlow`/`useInjectRunManualFlow` (bản mặc
  định khi màn chứa không cung cấp: `POST /flows/trigger/:id` `{ collection, keys }`, hộp xác nhận `requireConfirmation`
  với `BoForm` từ `options.fields`, thông báo thành công/lỗi, sự kiện "đã chạy"); test.
- [ ] T086 [US6] `src/interfaces/presentation-header/` (id `header`, FR-057: `header.vue`, `helper-text.vue` DOMPurify,
  `useTemplateData`, link `/` nội bộ, menu "Actions", nút flow khóa khi `'+'`/`nonEditable`); port `header.test.ts`,
  `helper-text.test.ts`.
- [ ] T087 [US6] `src/interfaces/presentation-links/` (FR-058: nạp field quan hệ của URL bằng `GET` item, flow chỉ khi
  `isActiveFlow`); port `presentation-links.test.ts`.
- [ ] T088 [US6] `src/interfaces/groups.fixture.test.ts`: US6 scenario 1–3 trên `bo_groups` (nhóm lồng, readonly đẩy
  xuống, header hai link); cập nhật seed (T022, T023).

**Checkpoint**: mọi interface của 40 id đã có; form đủ bố cục.

---

## Phase 9: User Story 7 - Đọc đúng cấu hình và dữ liệu do Directus tạo (Priority: P2)

**Goal**: bộ mẫu đủ, mọi collection dựng không lỗi, giá trị không sửa không phát, đối chiếu seed ở hai API, a11y, hiệu
năng, CI (US7, SC-001 đến SC-007, SC-009).

**Independent Test**: `pnpm nx run web:test` đạt toàn bộ test fixture; `tests/parity/src/web/fixtures-seed.test.ts`
đạt trên profile `web`.

- [ ] T089 [US7] `apps/web/fixtures/interfaces/all.fixture.test.ts` (bật ca "đủ id" của T011, T025): với mọi collection `bo_*` và ba user, dựng
  `BoForm` và bảng (`BoTable` + `RenderDisplay`) từ bộ mẫu: 0 `interface_not_found`, 0 lỗi/cảnh báo Vue (bắt
  `app.config.warnHandler`), không sửa thì 0 thay đổi (US7 scenario 1–2, SC-001, SC-002).
- [ ] T090 [US7] Kiểm SC-003: script `apps/web/fixtures/interfaces/options-coverage.test.ts` lấy tập khóa options từ
  registry (T011) và đối chiếu với danh sách khóa có test (tên test chứa `option:<id>.<key>`), thiếu thì thất bại.
- [ ] T091 [US7] `tests/parity/src/web/fixtures-seed.test.ts` (contracts/tests §7): chạy `seed.mjs` + `export.mjs` vào
  Directus và API mới của profile `web` (namespace bus/lock riêng nếu cần, bài học R-19), chuẩn hóa, so; khác biệt thật
  ghi R-xx (SC-009); thêm vào job parity hiện có.
- [ ] T092 [P] [US7] `src/components/form/a11y.browser.test.ts` (FR-122, SC-005): `axe-core` trên form `bo_std`,
  `bo_groups`, `bo_rel` và bảng 18 display ở sáng và `html.dark`; ngoại lệ chỉ cho thư viện bên thứ ba và màu dữ liệu,
  ghi rule id + lý do.
- [ ] T093 [P] [US7] `src/components/form/keyboard.browser.test.ts`: thao tác bàn phím theo `contracts/tests.md` §5.6
  cho mỗi nhóm interface (SC-005, FR-094).
- [ ] T094 [P] [US7] `src/components/form/perf.browser.test.ts` (SC-004): form 50 field, bảng 100×10, trung vị 3 lần <
  1.000 ms.
- [ ] T095 [US7] `apps/web/scripts/check-bundle.mjs` (012) thêm ngân sách: chunk chính + ≤ 120 KB gzip so với 012, chunk
  tinymce, editorjs, codemirror, maplibre tách riêng (R12); target `web:check-bundle` trong CI.
- [ ] T096 [US7] `.github/workflows/ci.yml`: job test web chạy hai project (T003), parity `web` gồm `fixtures-seed`;
  chạy `pnpm run ci:local` (tools/ci-local.sh) xanh.

**Checkpoint**: tiêu chí chấp nhận "đọc được cấu hình hiện có" đo được trên bộ mẫu Directus.

---

## Phase 10: Polish & đóng feature

- [ ] T097 [P] Recipe nháp Q-1 đến Q-12 cập nhật theo code thực tế; gửi design owner (owner dự án) duyệt theo
  `design-system/qa/handoff-checklist.md`; ảnh so TailAdmin và luồng Directus lưu ở
  `specs/013-interfaces-displays/design-review/`; bảng Q của spec chuyển "Đóng" kèm tên recipe (SC-008).
- [ ] T098 [P] Chuỗi dịch: chạy `pnpm nx run web:sync-translations`, thêm khóa thiếu vào danh sách sync (R9), khóa
  overlay D-60 đủ `vi-VN`/`en-US`; báo cáo đổi thương hiệu không có chuỗi "Directus" mới hiện ra (FR-091).
- [ ] T099 [P] `node tools/check-port-headers.mjs` và `tools/guard-directus-unchanged.mjs` xanh; manifest
  `tools/port-manifest/013-T*.json` đủ cho mọi task chép.
- [ ] T100 [P] `apps/web/README.md`: ghi công icon Font Awesome (CC BY 4.0), tile OpenStreetMap (attribution, chính sách
  dùng tile: đặt `basemaps` riêng khi dùng nhiều), TinyMCE 6 (MIT, theo dõi CVE).
- [ ] T101 Rà các mục [Inference]/[Unverified] còn lại trong spec, research (định dạng `datetime`, giữ lựa chọn khi
  field nguồn của `filter` đổi, lọc XSS của TinyMCE): đánh dấu đã kiểm hoặc ghi R-xx/D-xx.
- [ ] T102 `specs/013-interfaces-displays/spec.md`: ghi R-xx cho `formatted-json-value.handler` (tái hiện lỗi Directus,
  quy tắc 004) và các R-xx phát hiện khi làm (T091, T101); dòng "Duyệt khác biệt" chờ tech lead duyệt D-54 đến D-60 và
  Q-C; `tests/parity/accepted-differences.ts` nếu có R-xx mới ở parity.
- [ ] T103 `quickstart.md` chạy lại từ đầu (seed, test unit/browser, parity seed, lint, build); sửa chỗ lệch.
- [ ] T104 Cập nhật `CLAUDE.md` (Recent Changes 013), memory dự án, `pnpm exec graphify update .`.
- [ ] T105 Commit đợt D lên `main` (`git diff --cached --stat` trước, `git pull --rebase`), nhắn session đang chạy song
  song, theo dõi CI tới xanh; spec Status "Done" khi owner duyệt đóng.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): bắt đầu khi CI 012 xanh. T004, T023 cần Docker env (nhắn session 012). T007 phải xong trước mọi
  task tạo component giao diện (T019 trở đi).
- Phase 2 (Foundational): phụ thuộc Phase 1; CHẶN mọi story. T022 → T023 → T024 → T025.
- Phase 3 (US1): sau Phase 2. Phase 4 (US2): sau Phase 2, độc lập với US1 trừ T049/T051 dùng `BoTable` của US3 khi kiểm
  bảng (T052 dùng bảng đơn giản tạm nếu US3 chưa xong).
- Phase 5 (US3): sau Phase 2; dùng `BoCheckbox`, `BoCombobox` của US1 (T026, T027).
- Phase 6 (US4): sau US3 (dùng `DrawerItem`, `BoTable`, `BoSortableList`).
- Phase 7 (US5): sau Phase 2; `list` (T079) dùng `BoSortableList` (T058) và `DrawerItem` (T055).
- Phase 8 (US6): sau Phase 2; `header` dùng `use-template-data` (T016).
- Phase 9 (US7): sau mọi story (cần đủ 40 interface, 18 display).
- Phase 10: sau Phase 9.

### User Story Dependencies

- US1 (P1): chỉ cần Phase 2. US2 (P1): chỉ cần Phase 2. US3 (P1): cần component cơ sở của US1. US4 (P2): cần US3.
  US5 (P2): `list` cần US3. US6 (P2): chỉ cần Phase 2. US7 (P2): cần tất cả.

### Within Each User Story

- Component cơ sở (theo recipe) trước interface dùng nó; interface trước test fixture của story; seed và snapshot cập
  nhật cuối story.

### Parallel Opportunities

- Phase 1: T008 song song T003–T007.
- Phase 2: T010, T013, T014, T015, T016, T017 song song sau T009.
- US1: T026–T030 song song; T031–T042 song song (mỗi interface một thư mục) sau component nó cần.
- US2: T045–T050 song song.
- US3: T053, T054, T059, T065 song song; T060–T064 tuần tự theo drawer.
- US6: T081–T084 song song.
- US7: T092–T094 song song.

---

## Parallel Execution Examples

```text
# US1 sau khi có component cơ sở:
T031 src/interfaces/input/            T032 src/interfaces/input-multiline/, input-hash/
T033 src/interfaces/input-autocomplete-api/   T034 src/interfaces/boolean/, slider/
T038 src/interfaces/select-dropdown/, select-multiple-dropdown/   T042 src/interfaces/select-color/

# US2:
T045 boolean, color, icon, hash, raw, filesize, mime-type   T046 formatted-value, formatted-json-value
T047 labels, rating   T048 datetime   T049 collection, file, image   T050 user + UserPopover

# US6:
T082 group-accordion, group-detail   T083 group-raw, group-tabs   T084 presentation-divider, presentation-notice
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1, 2 (đủ nền, recipe nháp, bộ mẫu).
2. Phase 3 (US1): form với interface chuẩn và lựa chọn trên `bo_std`.
3. Dừng, kiểm `BoForm.fixture.test.ts`; commit nếu xanh.

### Incremental Delivery

- Đợt A = Phase 1, 2, 3 (US1), 4 (US2), 8 (US6): form, display, nhóm, presentation; commit + CI xanh.
- Đợt B = Phase 5 (US3), 6 (US4): quan hệ, drawer, file.
- Đợt C = Phase 7 (US5), 9 (US7): editor nặng, bản đồ, repeater, bộ mẫu đủ, parity seed, a11y, hiệu năng, CI.
- Đợt D = Phase 10: recipe duyệt, R-xx, docs, đóng.
- Mỗi đợt: `git diff --cached --stat` trước commit, `git pull --rebase`, push, theo dõi CI, nhắn session song song.

---

## Ghi chú khi làm

(Ghi kết quả kiểm [Unverified], quyết định của owner và lệch so với Directus phát hiện khi làm, theo từng đợt.)
