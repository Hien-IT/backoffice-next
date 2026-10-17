# Contract: component, composable, registry và dữ liệu mới của 017

Mọi component `<script setup lang="ts">`, Reka UI, `modelValue`/`update:modelValue`, theo `component-specs.md`; file
chép có header `// Ported from directus/app/src/...` và manifest `tools/port-manifest/017-T###.json`. Đường dẫn Directus
tính từ `directus/app/src/modules/settings/routes/flows/` trừ khi ghi khác.

## 1. Module, route, overview, drawer flow

| Component / composable | Nguồn Directus | Props / API | Emit | Ghi chú |
|------------------------|----------------|-------------|------|---------|
| `modules/settings.ts` (khối `flows`) | `modules/settings/index.ts:207-247` | data-model §1 | | `beforeEnter` tra store |
| `FlowsOverviewRoute.vue` | `overview.vue` | — | | `BoTable` 4 cột, `BoMenu` dòng, `BoDialog` xóa, `FlowDrawer`; `PrivateView fill` |
| `FlowDrawer.vue` | `flow-drawer.vue` | `primaryKey = '+'`, `active`, `startTab = 'flow_setup'` | `cancel`, `done(id)` | `BoDrawer persistent`, `BoTabs vertical`, `BoFancySelect` trigger, `BoForm` options |
| `triggers.ts` | `triggers.ts` | `triggers: TriggerDefinition[]`, `getTrigger(id)` | | `publicURL → getApiUrl()` |

## 2. Trang flow, canvas, drawer operation

| Component / composable | Nguồn Directus | Props / API | Emit | Ghi chú |
|------------------------|----------------|-------------|------|---------|
| `FlowRoute.vue` | `flow.vue` (template, header, dialogs) | `primaryKey` | | `PrivateView fill`; `RouterView` không tên với `:operation`, `:existing-operation-keys`, `:flow`, `@save`, `@cancel`; `DetailPanel` mục Logs |
| `use-flow-editor.ts` | `flow.vue` (script) | `useFlowEditor(flow: Ref<FlowRaw>)` → data-model §6 | | test 12 kịch bản SC-006; dữ liệu vòng: không request (T002) |
| `components/workspace/BoWorkspace.vue` | `components/v-workspace/v-workspace.vue` | `tiles: Panel[]`, `editMode`, `gridSize = 18` | `update(id, {x,y})` | kích thước +25 ô khi sửa; slot tile |
| `components/workspace/BoWorkspaceTile.vue` | `v-workspace-tile.vue` | `tile`, `editMode`, `draggable`, `showOptions`, `resizable = false` | `move`, `edit`, `duplicate`, `delete`, `copy` | nhãn `(x-1:y-1)` khi kéo; pencil, `BoMenu`; `data-pos-x/y` |
| `operations/throw-error/error-codes.ts` | `directus/packages/errors/src/codes.ts` | `ErrorCode` enum | | test so `libs/errors/src/codes.ts` |
| `components/FlowOperation.vue` | `components/operation.vue` | `panel`, `flow`, `editMode`, `type?: 'resolve' \| 'reject'`, `isHovered`, `subdued`, `arrowInfo` | `create(type)`, `arrow-move`, `arrow-stop`, `flow-status`, `edit` | tay cầm `<button>` 32 px; header `brand`/`orange`; chân Trigger |
| `components/OptionsOverview.vue` | `components/options-overview.vue` | `panel`, `flow`, `currentOperation` | | `<dl>` nội suy chữ; nút sao chép khi `copyable` và `isCopySupported` (`use-clipboard`, notice D-45) |
| `components/FlowArrows.vue` | `components/arrows/arrows.vue` | `panels`, `arrowInfo`, `editMode`, `hoveredPanelId`, `subdued`, `size` | | SVG `aria-hidden`, lớp `stroke-brand-500`/`stroke-orange-500`, reject nét đứt |
| `arrows/lib/*`, `arrows/utils/*`, `arrows/types.ts` | cùng tên | như Directus | | chép nguyên + 9 `.test.ts` |
| `constants.ts` | `constants.ts` | | | chép nguyên |
| `components/CopyToDialog.vue` | `flow.vue:751-776` | `open`, `flows: FlowRaw[]` (trừ hiện tại) | `confirm(flowId)`, `cancel` | notice `no_other_flows_copy` |
| `OperationDetail.vue` | `components/operation-detail.vue` | `primaryKey`, `operationId`, `operation`, `existingOperationKeys: string[]`, `flow` | `save(op)`, `cancel` | `useDialogRoute`; Name, Key (`BoInput dbSafe`), `BoFancySelect` 15 loại, `ExtensionOptions type="operation"`; D-106 cho `mail` |
| `ExtensionOptions.vue` (016, mở rộng) | — | + `type: 'interface' \| 'display' \| 'operation'`, `collection?`, `field?` | | không `useFieldDetailStore` khi `operation` |

## 3. Registry operation (`apps/web/src/operations/`)

| File | Nguồn | Export | Ghi chú |
|------|-------|--------|---------|
| `index.ts` | `directus/app/src/operations/index.ts` (glob → tĩnh) | `operations: OperationAppConfig[]`, `getOperation(id)` | sắp theo `id`; không extension |
| `<id>/index.ts` ×15 | `directus/app/src/operations/<id>/index.ts` | `default: OperationAppConfig` | `defineOperationApp` = identity (chép từ `@directus/extensions` hoặc inline); `throw-error` dùng `error-codes.ts` (chép, test so `libs/errors/src/codes.ts`); `trigger` dùng `useFlowsStore` |
| `registry.test.ts` | — | | so với `fixtures/interfaces/directus-registry.json` (`operations` do script trích) |
| `scripts/extract-directus-registry.mjs` (+) | — | | trích `operations` (tĩnh và hàm với bộ đối số mẫu) |

## 4. Logs

| Component | Nguồn | Props | Emit | Ghi chú |
|-----------|-------|-------|------|---------|
| `components/LogsSidebarDetail.vue` | `components/logs-sidebar-detail.vue` | `flow` | | `SidebarDetail id="logs" icon="fact_check"` badge `abbreviateNumber`; `BoProgressLinear` khi nạp; `useRevisions(... {action:'run', full:true})`; `RevisionsDateGroup`; toggle; `BoPagination` |
| `components/LogsDrawer.vue` | `components/logs-drawer.vue` | `open`, `revision`, `flow` | `update:open` | `BoDrawer` không `persistent`; `<ol>` bước; `BoDetail` Options/Payload/Accountability; `<pre>` JSON |

## 5. Overlay i18n, bundle, port manifest

- `lang/overlay/en-US.ts`, `vi-VN.ts`: `operations_mail_not_sent_notice` (D-106).
- `scripts/check-bundle.mjs`: `BUDGET_017 = BUDGET_016 + 20 * 1024`; `LAZY_BUDGETS_017` = FlowRoute (canvas) 60 KB,
  operations registry 25 KB, LogsDrawer 15 KB.
- `tools/port-manifest/017-T###.json` (một file mỗi task chép): `constants.ts`, `triggers.ts`, `arrows/**` (18 file), `operations/**/index.ts` (16
  file), `v-workspace*.vue` → `BoWorkspace*.vue`, `flow.vue` → `use-flow-editor.ts` + `FlowRoute.vue`,
  `operation-detail.vue`, `operation.vue`, `options-overview.vue`, `logs-*.vue`, `flow-drawer.vue`, `overview.vue`.

## 6. E2E helpers (`apps/web-e2e/src/helpers`)

| Helper | Làm gì |
|--------|--------|
| `allowed-paths.ts` | + #178–#184 |
| `flows.ts` | `openFlow(page, name)`, `dragPanel(page, key, {dx, dy})` (mouse down/move steps 8/up trên header panel), `linkHandle(page, fromKey, type, toKey)`, `readGrid(page)` → `{key, x, y}[]` từ `data-pos-x`, `data-pos-y` của `[data-panel-key]`, `countArrows(page)` → `{resolve, reject}` theo lớp `path`, `openOperation(page, key)` (pencil) |
| `db-rows.ts` | `FLOWS_TABLES = ['directus_flows', 'directus_operations']`; chuẩn hóa `id`, `date_created`, `user_created`; ánh xạ `flow` → name, `operation`/`resolve`/`reject` → key |
| `directus-app.ts` (+) | `openDirectusFlow(page, id)`, `readDirectusGrid(page)` (`.v-workspace-tile` → biến CSS `--pos-x`, `--pos-y`), `countDirectusArrows(page)` (`svg path.resolve|.reject`) |
| `payload.ts` (+) | `normalizeFlowsBody`: thay 5 ký tự ngẫu nhiên của key `_[a-z0-9]{5}$` bằng `*`, sắp `operations.create/update` theo `key`, `delete` theo key ánh xạ |
| `fixtures.ts` (+) | `FLOWS = { all: 'bo_all_ops', webhook: 'bo_webhook', schedule: 'bo_schedule', child: 'bo_child', event: 'bo_event', orphan: 'bo_orphan' }` |
