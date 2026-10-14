# Implementation Plan: Bộ interfaces và displays theo cấu hình field của Directus

**Branch**: `013-interfaces-displays` (trên `main`, không có branch riêng) | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-interfaces-displays/spec.md`

## Summary

Thêm vào `apps/web` bộ dựng form theo metadata (chép `v-form` của Directus), 40 interface và 18 display cùng id,
cùng `types` và cùng khóa options với Directus 11.17.4, bộ hiển thị giá trị và template (`RenderDisplay`,
`RenderTemplate`), các drawer (item, chọn item dạng bảng, sửa hàng loạt, chọn file) và tải file, để field cấu hình ở
Directus hiện và nhập đúng ở app mới và giá trị ghi ra cùng dạng với Directus. Không có màn hình mới: kiểm bằng
test component trên bộ mẫu xuất từ DB do Directus tạo; màn item và E2E là 014.

Cách làm:

- Chép logic (form, điều kiện, validation, composable quan hệ, utils hiển thị, geometry, editor plugin) từ
  `directus/app/src` với ghi nguồn; viết lại giao diện bằng Reka UI + Tailwind 4 theo recipe nháp Tier 3 viết vào
  `design-system/docs/` trước khi code (R2, R3, R6).
- Thư viện quyết định định dạng dữ liệu giữ đúng bản Directus: TinyMCE 6.8.6 (MIT), Editor.js 2.31.2, CodeMirror
  5.65.18, MapLibre 1.15.3 + Mapbox GL Draw 1.5.1, vuedraggable 4.1.0 (R1); editor nặng tách chunk (R12).
- Test: Vitest hai project (`unit` happy-dom, `browser` chromium) với API giả lập đọc bộ mẫu; seed script chạy
  được ở hai API và được đối chiếu trong `tests/parity` (R8).

Chi tiết: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/),
[quickstart.md](./quickstart.md).

## Technical Context

| Yêu cầu (prompt plan) | Ở feature 013 |
|-----------------------|---------------|
| Node 22, pnpm 10, Nx, `apps/web` Vue 3 script setup TS strict, Vite, Pinia, Vue Router | Giữ như 012 |
| Reka UI 2.8.2 + Tailwind CSS 4.3, theme `brand-*`, `gray-*` qua `@theme`, không hex, không palette | Giữ; màu *dữ liệu* (choices, colorOn...) áp inline style, hằng của Directus miễn `check-raw-colors` (Q-C) |
| Bố cục theo `layout-patterns.md`, component theo `component-specs.md` | Recipe nháp Tier 3 cho Q-1 đến Q-12 viết trước khi code (R6, FR-093) |
| Settings áp lên theme như `app.vue` | Không đổi (012); TinyMCE, CodeMirror, MapLibre nhận token qua CSS đè (R7) |
| vue-i18n từ `directus/app/src/lang` | Khóa `interfaces.*`, `displays.*`, `date-fns_*` đã sinh; thiếu thì thêm vào script sync (R9) |
| `@directus/sdk` | Mọi request qua sdk, kể cả multipart (R5) |
| Copy composable/utils, viết lại component bằng Reka UI | R3, R4, R5; manifest `tools/port-manifest/013-T*.json` |
| Vitest + VTU; Playwright E2E với Directus thật và API mới | Vitest `unit` + `browser`; E2E ở 014 (Clarifications Q-A); seed đối chiếu ở `tests/parity` profile `web` |
| GitHub Actions, coverage FE 60% | Job `test-web` thêm chromium; coverage gộp hai project |

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23.3; trình duyệt như 012.

**Primary Dependencies**: đã có (012): vue 3.5, pinia 3, vue-router 4, vue-i18n 11, reka-ui 2.8.2, tailwindcss 4.3,
@directus/sdk 21.3.0, @vueuse/core 14, date-fns 4.1.0, marked, dompurify, lodash-es, nanoid, @directus/format-title.
Thêm (R1): tinymce 6.8.6, @tinymce/tinymce-vue 6.3.0, @editorjs/* (14 gói), editorjs-toggle-block 0.3.16,
codemirror 5.65.18, maplibre-gl 1.15.3, @mapbox/mapbox-gl-draw 1.5.1 (+ static-mode 1.0.1, geocoder 5.1.2 nạp
động), wellknown 0.5.0, @turf/meta, vuedraggable 4.1.0, color 5.0.2, @sindresorhus/slugify 2.2.1, date-fns-tz 3.2.0,
micromustache 8.0.3, jsonlint-mod 1.7.6, vue-virtual-scroller 2.0.0-beta.8, @fortawesome/fontawesome-svg-core +
@fortawesome/free-brands-svg-icons 6.7.2, @directus/utils 13.4.1, @directus/types 15.0.3 (dev), @vitest/browser 3.2.4 (dev), axe-core
4.11 (dev).

**Storage**: không DB; Pinia; localStorage `backoffice-{m2m,o2m}-column-widths-<collection>-<field>`; bộ mẫu JSON
commit trong `apps/web/fixtures/interfaces/snapshot/`.

**Testing**: Vitest project `unit` (happy-dom) và `browser` (chromium qua Playwright) trong `apps/web`; coverage ≥
60% gộp; axe trong browser test; `tests/parity/src/web/fixtures-seed.test.ts` chạy seed ở hai API và so bản xuất.

**Target Platform**: như 012 (image nginx tĩnh, cùng hoặc khác origin).

**Project Type**: Monorepo web. Chạm `apps/web` (src, fixtures, vitest config, project.json), `design-system/docs`
(recipe nháp), `tests/parity/src/web`, `.github/workflows/ci.yml` (job `test-web`), `pnpm-workspace.yaml`,
`tools/port-manifest`, `tools/check-raw-colors.mjs` (danh sách miễn), spec 012 (D-45).

**Performance Goals**: SC-004 form 50 field < 1 s, bảng 100×10 < 1 s (browser test, R8); bundle chính + ≤ 120 KB
gzip, editor nặng tách chunk (R12).

**Constraints**:
- Chỉ API Directus ở `contracts/api-calls.md`; request ra ngoài là danh sách đóng của FR-081.
- Bắt đầu implement chỉ khi CI của 012 xanh (thỏa thuận giữa hai session cùng working tree, CHK088).
- Không sửa `directus/`; file chép ghi `// Ported from directus/app/src/...`.
- Không hex, không palette ngoài theme trong class; màu dữ liệu chỉ qua inline style từ giá trị runtime; hằng
  Directus (`#B0BEC5`, 9 preset) trong danh sách miễn của `tools/check-raw-colors.mjs`, nguồn duy nhất (Q-C, CHK049).
- Không chọn ngầm giao diện: recipe nháp Q-1 đến Q-12 ghi vào `design-system/docs/` trước (FR-093).
- Không AI, collab, extension, màn so sánh, form options, chỉnh ảnh (D-54 đến D-59); thêm đổi thứ tự bằng phím (D-60).
- Không ghi `directus_fields`, `directus_relations`, `directus_collections`; request ghi chỉ FR-054.

**Scale/Scope**: 40 interface (≈ 60 SFC kể cả component con), 18 display, 7 component form, 3 component render, 4
drawer + `BoDrawer` + `BoUpload` + `FileLightbox`, ≈ 18 component `Bo*` mới (R6), 7 composable quan hệ + 3 chép từ
`@directus/composables`, 4 store mở rộng + 1 store mới, ≈ 25 utils chép, 12 recipe nháp, 1 seed + 1 export script,
≈ 55 file test (31 port + mới), 1 parity test. Ước lượng 14.000 dòng mới (≈ 6.000 chép). `tasks.md` chia bốn đợt
commit: A (kiểm gói [Unverified] và chọn dự phòng nếu cần (R1, R7, R8; CHK086), đo nhóm `meta.interface` null trên
Directus, recipe nháp Q-1 đến Q-12, thư viện, fields store, form, display/template, interface chuẩn, lựa chọn, nhóm,
presentation, bộ mẫu + API giả lập), B (quan hệ, drawer, file, translations, flows store), C (editor nặng, bản đồ,
list, browser test, axe, perf, parity seed, CI), D (đóng: manifest, recipe duyệt, spec D-xx/R-xx, memory).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` 2.0.0. Lần 1 (trước research) và lần 2 (sau design) không vi phạm.

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`; seed script chỉ gọi API; file chép ghi nguồn, manifest
  `013-T*.json`, guard `check-port-headers`.
- [x] **II. Dùng chung DB**: PASS. App web không chạm DB; mọi ghi qua API Directus (`POST /files`,
  `/files/import`, `/flows/trigger/:id`, và lần lưu item của màn chứa ở 014). Seed tạo collection `bo_*` qua API như
  admin, trong môi trường đối chiếu.
- [x] **III. API giống hệt**: PASS. App chỉ gọi API Directus với cùng query (fields, filter, search, aggregate,
  meta) như Directus app (`contracts/api-calls.md`); không endpoint mới.
- [x] **IV. Chạy song song an toàn**: PASS. Không state server; localStorage chỉ độ rộng cột.
- [x] **V. Kiểm thử đối chiếu**: PASS. Không endpoint mới ở API. Đối chiếu ở mức dữ liệu: seed chạy ở Directus và
  API mới trong `tests/parity` và so bản xuất; giá trị interface phát ra so với giá trị mong đợi lấy từ Directus
  (bộ mẫu); so payload trên màn thật ở 014.
- [x] **VI. Kiến trúc**: PASS. Vue 3 Composition API, Reka UI; hành vi form, điều kiện, validation, quan hệ chép
  từ Directus app; 768 px+; `vi-VN`/`en-US`; mỗi thay đổi có test.
- [x] **VII. Đa instance**: PASS. Build tĩnh; không thêm state.
- [x] **VIII. Biến môi trường**: PASS. Không biến mới.
- [x] **IX. Đổi thương hiệu**: PASS. D-39 cho khóa localStorage; id interface/display, tên option, tên cookie giữ
  nguyên (định danh tương thích).
- [x] **X. Chất lượng**: PASS. Coverage 60%, lint, typecheck, browser test, build image trong CI; không email; khác
  biệt D-54 đến D-60 và R-xx (R4) trong spec chờ tech lead duyệt.
- [x] **XI. Ngoài phạm vi**: PASS. Không AI/MCP (bỏ `use-ai-tools`, `system-mcp-prompts-collection-validation`),
  không collab/WebSocket, không extension interface/display.
- [x] **XII. Design-system**: PASS. Đã đọc `README.md`, `component-specs.md`, `layout-patterns.md`,
  `handoff-checklist.md`; theme qua `@theme`; không hex trong class; Q-1 đến Q-12 ghi ở spec và xử lý bằng recipe
  nháp trước khi code (Clarifications), design owner duyệt trước khi đóng.

## Project Structure

### Documentation (this feature)

```text
specs/013-interfaces-displays/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── registry.md       # contract InterfaceConfig/DisplayConfig, props, emits, mặc định theo kiểu
│   ├── api-calls.md      # request mà form, interface, display, drawer gửi (FR-054, FR-081)
│   └── tests.md          # hai project Vitest, bộ mẫu, API giả lập, axe, perf, parity seed, CI
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── fixtures/interfaces/
│   ├── seed.mjs                    # tạo collection bo_* qua REST (R8.2)
│   ├── export.mjs                  # xuất snapshot/*.json, chuẩn hóa id/thời gian
│   ├── snapshot/                   # commit: collections, fields, relations, items.*, files, permissions.*
│   └── README.md
├── src/
│   ├── interfaces/
│   │   ├── index.ts                # glob eager, getInterface(id), danh sách sắp theo id
│   │   ├── types.ts                # InterfaceConfig (từ @directus/types), props chung
│   │   ├── <id>/index.ts + <Id>.vue (+ component con, utils, *.test.ts)   # 40 thư mục
│   │   └── _system/system-raw-editor/
│   ├── displays/
│   │   ├── index.ts                # getDisplay(id)
│   │   └── <id>/index.ts + <Id>.vue (+ *.test.ts)                         # 18 thư mục
│   ├── components/
│   │   ├── form/{BoForm,FormField,FormFieldLabel,FormFieldMenu,FormFieldInterface,FormFieldRawEditor,ValidationErrors}.vue
│   │   ├── form/utils/{get-form-fields,apply-conditions,push-group-options-down,validate-item,clear-hidden-fields-by-condition,get-default-values-from-fields,format-validation-structure}.ts
│   │   ├── render/{RenderDisplay,RenderTemplate,ValueNull,UserPopover}.vue
│   │   ├── drawers/{BoDrawer,DrawerItem,DrawerCollection,DrawerBatch,DrawerFiles}.vue
│   │   ├── files/{BoUpload,FileLightbox,FilePreview}.vue
│   │   └── Bo{TextOverflow,Checkbox,Radio,Switch,Textarea,Combobox,MultiSelect,CheckboxGroup,CheckboxTree,DatePicker,Slider,Chip,TagsInput,Tabs,Accordion,Detail,Divider,ColorPicker,IconPicker,Table,EditorFrame}.vue
│   ├── composables/{use-relation-m2o,use-relation-o2m,use-relation-m2m,use-relation-m2a,use-relation-single,use-relation-multiple,use-relation-permissions,use-items,use-collection,use-custom-selection,use-alias-fields,use-template-data,use-preset,use-run-manual-flow}.ts
│   ├── stores/{fields,collections,relations,presets}.ts (mở rộng), flows.ts (mới)
│   ├── utils/{adjust-fields-for-displays,render-string-template,format-date,format-filesize,get-item-route,get-related-collection,readable-mime-type,get-default-display-for-type,get-default-interface-for-type,get-fields-from-template,geometry/*,replace-url-access-token,...}.ts
│   ├── test-utils/{fetch.ts (+ mockFixtureApi), fixtures.ts, browser.ts}
│   └── lang/translations/*.json    # thêm khóa nếu sync thiếu (R9)
├── vitest.config.ts                # projects: unit (happy-dom), browser (chromium)
└── project.json                    # targets: fixtures (seed+export), test (hai project)

design-system/docs/component-specs.md   # Tier 3 recipe nháp (013) cho Q-1..Q-12
design-system/docs/layout-patterns.md   # §8 lưới form, drawer
design-system/docs/migration-guide.md   # cặp màu mới
tests/parity/src/web/fixtures-seed.test.ts
tools/port-manifest/013-T*.json
tools/check-raw-colors.mjs              # danh sách miễn hằng dữ liệu Directus (Q-C)
.github/workflows/ci.yml                # test-web cài chromium
pnpm-workspace.yaml                     # catalog nhóm Web: gói R1
specs/012-backoffice-web-shell/spec.md  # D-45 thu hẹp (R10)
```

**Structure Decision**: thư mục `interfaces/<id>` và `displays/<id>` giữ đúng tên Directus để so từng file; component
dùng chung đặt theo vai trò trong `components/` như 012 (`Bo*` cho control cơ sở, PascalCase cho SFC, kebab cho ts).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Không có vi phạm constitution. Ghi chú rủi ro: TinyMCE 6.8.6 (MIT) không còn được bảo trì [Unverified]; TinyMCE 7 là GPL/thương mại. Theo dõi bằng `pnpm audit` và Dependabot trong CI; xem lại khi Directus nâng TinyMCE hoặc có advisory mức high (như stream-json ở 010, CHK077) | Cùng HTML đầu ra và cùng khóa option với Directus 11.17.4 | Tiptap: HTML khác, mất `toolbar`/`customFormats`/`tinymceOverrides` đã lưu |
| `@directus/utils` 13.4.1 và `@vitest/browser` 3.2.4 chưa xác nhận trên npm; coverage v8 ở browser mode chưa thử [Unverified] | `validatePayload`/`parseFilter` giống Directus; editor và a11y cần trình duyệt thật | Chép `validatePayload` (joi) vào app: nhiều code; chỉ happy-dom: không kiểm được editor, focus, axe |
| MapLibre cần WebGL trong chromium headless CI [Unverified] | `map` interface | Mock `maplibre-gl` trong test (dự phòng, R7) |

## Phase 0, 1: kết quả

- research.md: R1 đến R12; bổ sung spec khi commit plan: D-45 (012) thu hẹp, `GET /flows` và `aggregate[count]`
  vào contracts, hai mục đo ở đợt A (nhóm interface null, `formatted-json-value.handler`).
- data-model.md: field đã parse, relation info, giá trị thay đổi quan hệ, config registry, trạng thái form, bộ mẫu,
  localStorage.
- contracts/: `registry.md`, `api-calls.md`, `tests.md`.
- quickstart.md: cài, seed bộ mẫu, test unit/browser, parity seed, lint.
- Agent context: `CLAUDE.md` cập nhật bằng `.specify/scripts/bash/update-agent-context.sh claude`.
