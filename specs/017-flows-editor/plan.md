# Implementation Plan: Trình chỉnh sửa Flows (danh sách, trigger, canvas operation, log chạy)

**Branch**: `017-flows-editor` (trên `main`, không có branch riêng) | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-flows-editor/spec.md`

## Summary

Thay khung `/settings/flows(/*)` của 012 (D-92) bằng trình chỉnh sửa flows của Directus 11.17.4: bảng flow với menu
đổi trạng thái/sửa/xóa, drawer flow hai tab với năm trigger, trang flow dạng canvas lưới 18 px (panel Trigger và
operation 14×14 ô, mũi tên SVG resolve/reject, kéo panel, kéo nối, nút "+", nhân bản, Copy To, xóa, staging và một
`PATCH /flows/:id` khi Save), drawer operation với 15 operation có sẵn (registry tĩnh, form options qua
`ExtensionOptions`), mục Logs (nhóm ngày, lọc thất bại, phân trang) và drawer log từng bước từ `/revisions`. Nút chạy
thủ công giữ của 014; 017 nối hai đầu bằng E2E. Tiêu chí: flow tạo ở app mới mở và sửa được trên Directus app 8155 và
ngược lại (SC-002) qua E2E dùng chéo và bộ so DB `directus_flows`, `directus_operations`.

Cách làm:

- Chép logic từ `directus/app/src/modules/settings/routes/flows/` (`constants.ts`, `triggers.ts`, `arrows/*` kể cả
  test, staging và `saveChanges` của `flow.vue` thành `use-flow-editor.ts`, kéo panel của `v-workspace*.vue`) và
  `directus/app/src/operations/*` (15 operation, registry tĩnh) với ghi nguồn; viết lại giao diện bằng Reka UI + theme
  TailAdmin theo recipe nháp Q-29 đến Q-33 viết vào `design-system/docs/` trước khi code (R3, R5, R6, R7).
- Dùng lại: `BoTable`, `BoMenu`, `BoDialog`, `BoDrawer`, `BoTabs vertical`, `BoFancySelect`, `BoForm`, `BoDetail`,
  `BoNotice`, interface 013 (`input-code`, `select-*`, `tags`, `list`, …), `ExtensionOptions` (mở rộng `type
  operation`), `use-revisions`, `RevisionsDateGroup`, `use-edits-guard`, `use-dialog-route`, `use-shortcut`,
  `useCollectionPermissions`, `getDefaultValuesFromFields`, `translate`, store flows (`hydrate` sau ghi), nút chạy thủ
  công của 014 nguyên vẹn.
- Không thư viện mới; `ErrorCode` chép vào `operations/throw-error/error-codes.ts` (nguồn `directus/packages/errors/src/codes.ts`, test so `libs/errors/src/codes.ts`; web không phụ thuộc lib workspace) (R1). Màu nhánh: resolve `brand-500`, reject
  `orange-500` (Clarifications); canvas chỉ chuột như Directus, ngoại lệ a11y ghi và duyệt (FR-106).
- Test: Vitest `unit` (use-flow-editor 12 kịch bản, arrows lib port, registry so nguồn qua fixture trích) + `browser`
  (overview, drawer flow, canvas, drawer operation, logs, axe, perf); Playwright sáu spec `settings-flows-*` ở ba cấu
  hình; bộ so payload `flows` và bộ so DB ở `proxy-api`; dùng chéo trên Directus app (R9). Bốn lượt commit (R11).

Chi tiết: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/),
[quickstart.md](./quickstart.md).

## Technical Context

| Yêu cầu (prompt plan) | Ở feature 017 |
|-----------------------|---------------|
| Node 22, pnpm 10, Nx, `apps/web` Vue 3 script setup TS strict, Vite, Pinia, Vue Router | Giữ như 012–016 |
| Reka UI 2.8.2 + Tailwind CSS 4.3, theme `brand-*`, `gray-*` qua `@theme`, không hex, không palette | Giữ; mũi tên và tay cầm `stroke-brand-500`/`stroke-orange-500` (tối `-400`); màu flow (`color`) và icon là giá trị runtime inline (như icon collection 016); lưới nền `gray-100`/`gray-800` |
| Bố cục theo `layout-patterns.md`, component theo `component-specs.md` | Canvas trong `PrivateView fill` (D-99) cuộn hai chiều; page header L-5, panel L-4 với mục Logs; drawer `BoDrawer` tab dọc cho drawer flow (Q-22); drawer operation nổi trên canvas qua `RouterView` con; recipe Q-29..Q-33 trước khi code (FR-107) |
| Settings áp lên theme như `app.vue` | Không đổi (012) |
| vue-i18n từ `directus/app/src/lang` | Khóa `flows`, `triggers.*`, `operations.*`… đã sinh ở 012 (R10); một khóa overlay mới `operations_mail_not_sent_notice` (D-106) |
| `@directus/sdk` | Mọi request qua `requestEndpoint`; `GET /revisions` qua `use-revisions` |
| Copy composable/utils, viết lại component bằng Reka UI | R2–R8; manifest `tools/port-manifest/T0xx.json`; `check-port-headers` |
| Vitest + VTU; Playwright E2E với Directus thật và API mới | `contracts/tests.md`; dùng chéo điều khiển Directus app bằng `helpers/directus-app.ts` (R9) |
| GitHub Actions, coverage FE 60% | Job `quality`, `e2e-web` (ma trận ba cấu hình) như 016; `check-bundle` `BUDGET_017` |
| Phần riêng 017 (prompt) | Port đúng danh sách file nêu trong prompt (R2–R7); canvas lưới CSS + SVG, không node-graph (R1, R3); `ExtensionOptions type operation` (R5); dùng lại 014 (R6, FR-060); E2E/payload/DB/fixture (R9); recipe trước code (FR-107); không sửa `apps/api` (kiểm xong: nested PATCH đã có parity, R-bảng cuối research) |

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23.3; trình duyệt như 012.

**Primary Dependencies**: đã có (012–016): vue 3.5, pinia 3, vue-router 4, vue-i18n 11, reka-ui 2.8.2, tailwindcss
4.3, @directus/sdk 21.3.0, @directus/types 15.0.3, @directus/utils 13.4.1, @vueuse/core 14, lodash-es, nanoid,
@sindresorhus/slugify, codemirror 5.65.18, date-fns. Thêm: không (R1; `ErrorCode` chép,
không phụ thuộc `@backoffice/errors`).

**Storage**: không DB; Pinia store flows (012) không đổi API (`hydrate` gọi sau mỗi ghi); trạng thái canvas là `ref`
trong `use-flow-editor.ts` (staging); không localStorage mới; bộ mẫu `apps/web/fixtures/interfaces/snapshot/` mở rộng
`flows.json`, thêm `operations.json` (bo_flows).

**Testing**: Vitest `unit` + `browser` (chromium) trong `apps/web`, coverage ≥ 60 % gộp; axe; test port 9 file arrows;
Playwright `apps/web-e2e` sáu spec `settings-flows-*` ở `proxy-directus`, `proxy-api`, `cors`; payload `flows.spec.ts`
và bộ so DB ở `proxy-api`; dùng chéo (SC-002) ở `proxy-api` (`DIRECTUS_APP_SPECS`); parity `web`
`fixtures-seed.test.ts` mở rộng seed.

**Target Platform**: như 012 (image nginx tĩnh, cùng hoặc khác origin).

**Project Type**: Monorepo web. Chạm `apps/web` (src, fixtures, scripts), `apps/web-e2e`,
`design-system/docs` (recipe Q-29..Q-33), `design-system/qa/handoff-checklist.md` (ngoại lệ a11y canvas),
`.github/workflows/ci.yml` (nếu cần), `tools/port-manifest`, spec 014 (D-72 phần `directus_flows`), 016 (D-92),
`SPECKIT-GUIDE.md`, `CLAUDE.md` (Active Technologies).

**Performance Goals**: FR-108 / SC-007 (canvas 50 operation < 500 ms; `generateArrows` 50 panel < 8 ms; drawer
operation < 200 ms; log 10 dòng < 300 ms; số request mỗi thao tác); bundle chính ≤ `BUDGET_016` + 20 KB gzip; chunk
canvas ≤ 60 KB, registry ≤ 25 KB, drawer log ≤ 15 KB (R12).

**Constraints**:
- Chỉ API Directus ở `contracts/api-calls.md` (#178–#184 nối 016); 0 request ra ngoài (FR-110).
- Không sửa `directus/`; file chép ghi `// Ported from directus/app/src/...`; không sửa `apps/api` (kiểm xong, FR-111).
- Không hex, không palette ngoài theme trong class; màu flow inline từ runtime.
- Không chọn ngầm giao diện: recipe nháp Q-29..Q-33 trước (FR-107); design owner duyệt trước khi đóng (SC-008).
- Canvas chỉ chuột như Directus (Clarifications): ngoại lệ a11y ghi trong `handoff-checklist.md`, tech lead duyệt.
- Không extension, AI, WebSocket, email thật (D-34, D-106), snackbar (D-45).
- Mở rộng component của 013–016 chỉ bằng prop thêm (`ExtensionOptions type operation`); test cũ giữ xanh.

**Scale/Scope**: 1 module (3 route SFC: overview, flow, operation detail) + ≈ 12 component (FlowDrawer, Operation,
OptionsOverview, Arrows, BoWorkspace, BoWorkspaceTile, LogsSidebarDetail, LogsDrawer, CopyToDialog) + composable
`use-flow-editor.ts` + `triggers.ts` + `constants.ts` + 9 file arrows lib + 15 operation + registry + script trích mở
rộng + overlay 1 khóa. Ước lượng 4.500 dòng mới (≈ 2.000 chép), ≈ 30 file test, 6 spec E2E, 1 payload spec, bộ so DB
mở rộng. `tasks.md` chia bốn lượt (R11).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` 2.0.0. Lần 1 (trước research) và lần 2 (sau design) không vi phạm.

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`; file chép ghi nguồn, manifest `T0xx.json`,
  `check-port-headers`; script trích registry chỉ đọc `directus/app/src/operations`.
- [x] **II. Dùng chung DB**: PASS. Ghi chỉ qua `/flows`, `/operations`, `/flows/trigger/:id` (009); body và thứ tự
  request chép từ Directus (SC-005) để `directus_flows`, `directus_operations` ghi ra bằng Directus (SC-002).
- [x] **III. API giống hệt**: PASS. Không endpoint mới; cùng query và body (`contracts/api-calls.md`).
- [x] **IV. Chạy song song an toàn**: PASS. Không state server; staging chỉ trong trang; store nạp lại sau ghi.
- [x] **V. Kiểm thử đối chiếu**: PASS. Không endpoint mới; đối chiếu ở mức màn: E2E ba cấu hình, bộ so payload, bộ so
  DB, dùng chéo trên Directus app (SC-002, SC-003); parity 009 đã có cho `PATCH /flows` lồng và `/revisions`.
- [x] **VI. Kiến trúc**: PASS. Vue 3 Composition API, Reka UI; route, luồng theo Directus app; 768 px+; `vi-VN`/`en-US`.
- [x] **VII. Đa instance**: PASS. Build tĩnh; không state server.
- [x] **VIII. Biến môi trường**: PASS. Không biến mới.
- [x] **IX. Đổi thương hiệu**: PASS. Notice D-106 viết "Backoffice"; khóa i18n Directus giữ; dữ liệu DB không đổi.
- [x] **X. Chất lượng**: PASS. Coverage 60 %, lint, typecheck, browser test, E2E, build image; không email (D-34,
  D-106); D-105, D-106, R-43..R-47 trong spec, tech lead duyệt trước khi đóng (SC-010).
- [x] **XI. Ngoài phạm vi**: PASS. Không extension (registry tĩnh, type lạ chỉ hiển thị), AI (D-54), WebSocket.
- [x] **XII. Design-system**: PASS. Đã đọc `README.md`, `component-specs.md`, `layout-patterns.md`,
  `handoff-checklist.md`; theme qua `@theme`; không hex trong class; Q-29..Q-33 ghi ở spec, recipe nháp trước khi
  code, design owner duyệt trước khi đóng; ngoại lệ a11y canvas (chỉ chuột, owner chọn) ghi trong checklist và được
  tech lead duyệt — xem Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/017-flows-editor/
├── plan.md
├── research.md           # R1–R12 + bảng kiểm
├── data-model.md         # route, store, flow/operation, trigger và operation definition, staging, log, bộ mẫu
├── quickstart.md
├── contracts/
│   ├── api-calls.md      # #178–#184, danh sách đóng cho E2E
│   ├── components.md     # component, composable, registry, E2E helpers
│   └── tests.md          # unit/browser, API giả lập, E2E, payload, bộ so DB, dùng chéo, perf, CI
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── fixtures/interfaces/{seed.mjs, export.mjs, snapshot/flows.json, snapshot/operations.json, directus-registry.json}
├── scripts/{extract-directus-registry.mjs (+operations), check-bundle.mjs (BUDGET_017, LAZY_BUDGETS_017)}
├── src/
│   ├── modules/settings.ts                                # route flows thật (D-92 gỡ)
│   ├── modules/settings/routes/flows/
│   │   ├── FlowsOverviewRoute.vue                         # overview.vue
│   │   ├── FlowRoute.vue                                  # flow.vue (template) + RouterView drawer operation
│   │   ├── FlowDrawer.vue                                 # flow-drawer.vue
│   │   ├── OperationDetail.vue                            # components/operation-detail.vue
│   │   ├── use-flow-editor.ts (+ .test.ts)                # staging, getTrees, saveChanges, onLink, isLoner (flow.vue)
│   │   ├── triggers.ts (+ .test.ts), constants.ts
│   │   ├── components/{Operation,OptionsOverview,Arrows,CopyToDialog,LogsSidebarDetail,LogsDrawer}.vue
│   │   ├── arrows/lib/{create-line,find-best-position,generate-arrows,generate-path}.ts (+ .test.ts)
│   │   ├── arrows/utils/{generate-corner,get-points,is-point-in-panel,min-max-point,range}.ts (+ .test.ts)
│   │   ├── arrows/types.ts
│   │   └── perf.browser.test.ts
│   ├── components/workspace/{BoWorkspace,BoWorkspaceTile}.vue   # v-workspace*.vue (018 mở rộng)
│   ├── operations/throw-error/error-codes.ts (+ .test.ts)   # ErrorCode chép (R1)
│   ├── operations/{index.ts, registry.test.ts, condition, exec, item-create, item-delete, item-read, item-update, json-web-token, log, mail, notification, request, sleep, throw-error, transform, trigger}/index.ts
│   ├── modules/settings/routes/data-model/field-detail/shared/ExtensionOptions.vue   # + type 'operation', collection?/field?
│   ├── lang/overlay/{en-US,vi-VN}.ts                       # operations_mail_not_sent_notice (D-106)
│   ├── test-utils/fetch.ts                                # KNOWN_REQUESTS #178–#184
│   └── utils/get-item-route.ts                            # comment
apps/web-e2e/src/
├── {settings-flows-overview,settings-flows-editor,settings-flows-operations,settings-flows-logs,settings-flows-manual,settings-flows-cross-use}.spec.ts
├── settings-parity-ui.spec.ts (+ flows)
├── payload/flows.spec.ts, payload/baselines/flows-*.json   # mốc body ghi của Directus app (T002)
└── helpers/{allowed-paths.ts (+#178..#184), flows.ts (kéo thả, đọc lưới), db-rows.ts (+FLOWS_TABLES), directus-app.ts (+flows)}
apps/web-e2e/playwright.config.ts                          # core specs + settings-flows-editor; DIRECTUS_APP_SPECS + cross-use
design-system/docs/{component-specs.md (Tier 3 (017): Q-30, Q-31, Q-32, Q-33), layout-patterns.md (§13 canvas flow Q-29)}
design-system/qa/handoff-checklist.md                      # ngoại lệ a11y canvas
tools/port-manifest/T0xx.json
specs/014-*/spec.md (D-72), specs/016-*/spec.md (D-92)     # "đã gỡ ở 017"
SPECKIT-GUIDE.md, CLAUDE.md
```

**Structure Decision**: `modules/settings/routes/flows/` giữ cấu trúc Directus (route SFC ở gốc, `components/`,
`arrows/lib|utils`) để so từng file; `operations/` ở gốc `src` như Directus (`app/src/operations`) cạnh `interfaces/`,
`displays/`; `BoWorkspace*` ở `components/workspace/` vì 018 (Insights) dùng lại; `use-flow-editor.ts` là composable
mới tách từ `flow.vue` để test unit (Directus để trong SFC).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Không có vi phạm constitution. Ngoại lệ a11y: kéo panel, kéo nối/tháo và nút "+" trên canvas chỉ bằng chuột/pointer, cảm ứng không bảo đảm (XII yêu cầu bàn phím); vẫn tới được bằng phím: pencil, menu tile, select trạng thái Trigger, nút header, drawer (spec FR-106) | Owner chọn B (Clarifications 2026-10-17): giữ y Directus; canvas không có danh sách tuyến tính để áp menu Lên/Xuống như D-69/D-96 | Menu panel Move/Connect/Detach (phương án A): thêm UI không có ở Directus, lệch parity UI; owner từ chối. Ghi ngoại lệ trong `handoff-checklist.md`, tech lead duyệt (SC-008) |
| Tách `use-flow-editor.ts` khỏi `FlowRoute.vue` (Directus để trong SFC) | 12 kịch bản staging/Save so JSON với Directus (SC-006) cần gọi hàm không mount DOM | Test qua browser test mount cả canvas: chậm, khó cô lập body Save |
| `BoWorkspace*` là component chung thay vì nằm trong flows | 018 (Insights) dùng cùng `v-workspace` của Directus (resize, zoom) | Chép hai lần ở 017 và 018 |
| Script trích registry mở rộng cho operations (thay import trực tiếp từ `directus/`) | Test so nguồn FR-044 không được import `directus/app/src` vào bundle test của web (alias vào mã Directus kéo theo `@/` của Directus) | Import trực tiếp: lỗi resolve `@/stores/flows` của operation `trigger` |

## Phase 0, 1: kết quả

- research.md: R1 đến R12; bảng kiểm 2026-10-17 (đọc mã nguồn): nested `PATCH /flows` có parity 009, `use-revisions`
  đủ, `ExtensionOptions` cần prop mới, `ErrorCode` chép (lib workspace cần build), `getApiUrl` thay `getPublicURL`, allowlist
  bắt đầu #178, `RouterView` không tên. T002 (lượt 1): chạy tay bốn luồng trên Directus app 8155 và lưu body làm mốc
  (`payload/baselines/flows-*.json`) trước khi viết bộ so payload; kiểm dữ liệu vòng có treo Directus không (D-105).
- Release-gate 52 mục (`checklists/release-gate.md`) áp toàn bộ 2026-10-17 (owner): lời giải ở
  `checklists/release-gate-proposals.md`; spec thêm US2-12, US5-4, R-47, chín Edge Cases; FR-010, FR-108 về 0 request
  khi vào danh sách.
- data-model.md: route, store, Flow/Operation, trigger definition, operation definition, staging, body Save, log, bộ mẫu.
- contracts/: `api-calls.md` (#178–#184), `components.md`, `tests.md`.
- quickstart.md: cài, seed, trích registry, test, E2E ba cấu hình, payload, bộ so DB, dùng chéo, lint, build, đóng.
- Agent context: `CLAUDE.md` cập nhật bằng `update-agent-context.sh claude` khi plan xong (dòng 017 soạn ở quickstart
  §Đóng).
