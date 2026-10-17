# Data model: Trình chỉnh sửa Flows (017)

Kiểu lấy từ `@directus/types` 15.0.3 (`FlowRaw`, `OperationRaw`, `TriggerType`, `OperationAppConfig`, `DeepPartial<Field>`)
hoặc chép từ `directus/app/src/modules/settings/routes/flows/` (`arrows/types.ts`: `Panel`, `Vector2`, `ArrowInfo`).
Không có DB mới; mọi thứ là trạng thái trình duyệt dựng từ API và ghi qua API 009.

## 1. Route (FR-001)

| Tên | Path (dưới `/admin/settings`) | Component | Props / guard | Ghi chú |
|-----|-------------------------------|-----------|---------------|---------|
| `settings-flows-collection` | `flows` | `FlowsOverviewRoute` | | thay `Frame` (D-92 gỡ) |
| `settings-flows-item` | `flows/:primaryKey` | `FlowRoute` | `primaryKey`; `beforeEnter`: không có trong `flowsStore.flows` → `notFound(to)` (016) | `RouterView` không tên vẽ con |
| `settings-flows-operation` | `flows/:primaryKey/:operationId` | `OperationDetail` | `primaryKey`, `operationId` (`+` = mới, id thật hoặc id tạm `_…`); `meta.isFloatingView` | `useDialogRoute` |

`preRegisterCheck`: `user.admin_access === true` (012 giữ). `get-item-route.ts`: `directus_flows → /settings/flows`
không đổi.

## 2. Store flows (012, FR-005)

`flows: FlowRaw[]` (`GET /flows?fields[]=*&fields[]=operations.*`, không quyền → `[]`); `hydrate()`, `dehydrate()`,
`getManualFlowsForCollection`, `isActiveFlow`. 017 gọi `hydrate()` sau `POST /flows`, `PATCH /flows/:id`,
`DELETE /flows/:id`, `POST /operations` (Copy To). Không thêm hàm.

## 3. Flow và Operation (bảng `directus_flows`, `directus_operations`)

| Trường | Kiểu | Ghi chú |
|--------|------|---------|
| Flow `id` | uuid | |
| `name` | string | bắt buộc ở drawer |
| `icon` | string \| null | mặc định `bolt` khi tạo |
| `color` | string \| null | mặc định null; inline style trên bảng và panel |
| `description` | string \| null | |
| `status` | `active` \| `inactive` | mặc định `active`; menu bảng và chân panel Trigger đổi |
| `trigger` | `event` \| `webhook` \| `schedule` \| `operation` \| `manual` \| null | drawer tab 2 |
| `accountability` | `all` \| `activity` \| null | mặc định `all`; log chỉ khi `all` |
| `options` | JSON theo trigger (§4) | reset `{}` khi đổi trigger; `{type}` khi đổi `type` của event |
| `operation` | uuid \| null | operation đầu (resolve của Trigger) |
| `operations` | `OperationRaw[]` | o2m, nạp cùng store |
| Operation `id` | uuid | id tạm client `_<nanoid>` |
| `name` | string \| null | placeholder = tên loại |
| `key` | string | db-safe, `slugify(name, '_')`, duy nhất trong flow (client); DB không unique |
| `type` | string | 15 id có sẵn hoặc lạ |
| `position_x`, `position_y` | integer NOT NULL | ô lưới 1-based; con resolve `(x+18, y)`, reject `(x+18, y+16)`, không cha `(15, 15)`; nhân bản `+2/+2` |
| `options` | JSON theo loại (§5) | `{...defaults, ...options}` khi Done |
| `resolve`, `reject` | uuid \| null, unique | một cha mỗi điểm nhận |
| `flow` | uuid | |
| `date_created`, `user_created` | | bỏ khi so |

## 4. Trigger definition (`triggers.ts`, FR-012)

`{ id: TriggerType, name, icon, description, overview(options, {flow}) → {label, text, copyable?}[], options: DeepPartial<Field>[] | (options) => DeepPartial<Field>[] }`

| id | icon | Option fields (tên: kiểu/interface; điều kiện) | Overview |
|----|------|------------------------------------------------|----------|
| `event` | `anchor` | `type` select-radio `filter`/`action`; `scope` select-multiple-dropdown (danh sách theo `type`, có vạch); `collections` system-collections csv (chỉ đọc khi scope không `items.*`; `includeSystem` false khi chỉ `items.promote`/`items.sort`); `return` select-radio `$last`/`$all` allowOther (chỉ `filter`) | Type, Scope, Collections (`--`) |
| `webhook` | `link` | `method` GET/POST (GET); `async` toggle required (false); `error_on_reject` (ẩn khi async); `return` (`$last`, ẩn khi async); `cacheEnabled` (true, ẩn khi không GET); `cacheQueryParams` tags (ẩn khi cache tắt/không GET) | Method, URL `${getApiUrl()}/flows/trigger/${id}` copyable |
| `schedule` | `schedule` | `cron` input placeholder `* * 1 * * *` | Interval |
| `operation` | `bolt` | `return` | (rỗng) |
| `manual` | `touch_app` | `collections`; `async` (false); `error_on_reject` (ẩn khi async); `location` `both`/`collection`/`item` (`both`); `requireSelection` (true, ẩn khi `item`); vạch `confirmation_dialog` `quiz`; `requireConfirmation` (false); `confirmationDescription` system-input-translated-string (ẩn khi không xác nhận); `fields` system-inline-fields (ẩn khi không xác nhận) | mô tả, Collections |

## 5. Operation definition (`operations/<id>/index.ts`, FR-041)

`OperationAppConfig = { id, name, icon, description, overview(options, {flow}) → {label, text, copyable?}[] | null, options: DeepPartial<Field>[] | (options) => DeepPartial<Field>[] | null }`

PERM = `permissions` string `select-dropdown` mặc định `$trigger`, choices "From Trigger"/"Public Role"/"Full Access"
(`$trigger`/`$public`/`$full`), `allowOther`.

| id | icon | options (thứ tự) | overview |
|----|------|------------------|----------|
| `condition` | `rule` | fn: `filter` json input-code JSON full (template `$trigger.category._eq Example`) | condition_rules |
| `exec` | `code` | fn: `code` string input-code javascript full, default `module.exports = async function(data) {…}` | `[]` |
| `item-create` | `add` | `collection` system-collection half required; PERM half; `emitEvents` boolean half false; `payload` json input-code full | Collection, Payload |
| `item-delete` | `delete` | `collection`; PERM half; `emitEvents`; `key` csv tags half `vpn_key`; `query` json input-code full (template `filter.status._eq active`) | Collection, Key (`join(', ')` / `--`) |
| `item-read` | `visibility` | PERM **full**; `collection`; `key`; `query`; `emitEvents` (nhãn khóa `item-create.emit_events`) | Collection, Key |
| `item-update` | `edit` | `collection`; PERM half; `emitEvents`; `key`; `payload`; `query` | Collection, Key |
| `json-web-token` | `key` | fn(`operation`): `operation` select sign/verify/decode full; sign → `payload` json input-multiline monospace, `secret` input, `options` json input-code; verify → `token`, `secret`, `options`; decode → `token`, `options` | Operation |
| `log` | `terminal` | `message` input full, note `operation_variables_note` | Message |
| `mail` | `mail` | fn(`type`): `to` tags; `subject` input; `cc`, `bcc`, `replyTo` tags; `type` select half (`markdown`); `template` input half (chỉ template); `body` text full (`input-rich-text-html` khi wysiwyg, else `-md`; ẩn khi template); `data` json input-code full (chỉ template). **D-106**: `BoNotice info` đầu form | Subject, To, Type, (CC, BCC, Reply-To) |
| `notification` | `notifications` | `recipient` tags half; PERM half; `subject` input full; `message` input-rich-text-md full; `collection` system-collection half; `item` input half | Subject, Message |
| `request` | `link` | `method` select half GET/POST/PATCH/DELETE allowOther (GET); `url` input half; `headers` json list full (`header`, `value` required half); `body` text input-multiline monospace full | URL, Method |
| `sleep` | `schedule` | `milliseconds` integer input full `{min 0, type integer, placeholder 1000}` | Milliseconds |
| `throw-error` | `error` | fn: `code` select `Object.values(ErrorCode)` (`operations/throw-error/error-codes.ts`, chép) allowOther placeholder `INTERNAL_SERVER_ERROR`; `status` select 400…500 chuỗi allowOther placeholder `500`; `message` input placeholder "An unexpected error occurred." | Code, Status, Message |
| `transform` | `move_down` | `json` json input-code full (template `$accountability.user` / `$last`) | JSON |
| `trigger` | `flag` | fn(`iterationMode`): `flow` select half `bolt` placeholder `a_flow_uuid` choices = store flows `trigger === 'operation'`; `iterationMode` json select half parallel/serial/batch (`parallel`); `batchSize` integer half (10) chỉ batch; `payload` json input-code full | Flow (id thô) |

Registry: `operations/index.ts` export `operations: OperationAppConfig[]` sắp theo `id`; `getOperation(id)`.

## 6. Canvas và staging (`use-flow-editor.ts`, FR-020 đến FR-031)

Kích thước canvas (ô lưới, hai trục): sửa `(x + width + 25) × 18` px, xem `(x + width − 1) × 18` px; panel ghi
`data-pos-x`, `data-pos-y`. Save lỗi: staging giữ (R-47). Hằng số (`constants.ts`): `GRID_SIZE = 18`; `PANEL_WIDTH = PANEL_HEIGHT = 14`; `ATTACHMENT_OFFSET = (0, 3·18)`;
`RESOLVE_OFFSET = (14·18, 10·18)`; `REJECT_OFFSET = (14·18, 12·18)`.

| Trạng thái | Kiểu | Ghi chú |
|------------|------|---------|
| `editMode` | boolean | ban đầu `operations.length === 0 \|\| !!operationId` |
| `stagedFlow` | `Partial<Pick<FlowRaw,'status'\|'operation'>>` | chân Trigger, nối/tháo Trigger, xóa operation đầu |
| `stagedPanels` | `Partial<OperationRaw>[]` | operation mới (`_id`) và sửa đổi gộp theo `id` |
| `panelsToBeDeleted` | `string[]` | id thật đã xóa |
| `parentId`, `attachType` | string \| null, `resolve` \| `reject` | khi bấm "+" |
| `hoveredPanelId`, `arrowInfo` | | nút gợi ý và mũi tên đang kéo |
| `hasEdits` | computed | `stagedPanels.length > 0 \|\| panelsToBeDeleted.length > 0` (R-44) |
| `panels` | `Panel[]` | `$trigger` (1,1, không kéo, `resolve = flow.operation`) + operations với sửa đổi; `loner` theo chuỗi cha |

Hàm: `stageOperation(op)` (mới → id tạm, link cha, vị trí; có sẵn → gộp), `duplicateOperation(id)`, `copyTo(id,
flowId)` (`POST /operations` ngay), `deleteOperation(id)` (R-43), `onDrag(panelId, {x,y})` (throttle 20 ms),
`onLink(from, type, to | null)` (từ chối vòng, gỡ link cũ của đích), `getTrees()` (`Set` đã thăm → lỗi D-105),
`saveChanges()`, `clearChanges()`.

Body Save (`PATCH /flows/:id`):

```json
{
  "status": "<stagedFlow.status nếu có>",
  "operations": {
    "create": [ { "name", "key", "type", "position_x", "position_y", "options", "resolve": { …cây con… } | null, "reject": … } ],
    "update": [ { "id", …trường đổi…, "resolve": { "id" | cây } | null, "reject": … } ],
    "delete": [ "<id>" ]
  },
  "operation": "<id operation đầu>" | { …cây mới… } | null
}
```

Trước đó `PATCH /operations` `[{ "id", "resolve": null }, { "id", "reject": null }]` cho link cũ sẽ nối lại.

## 7. Mũi tên (`arrows/*`)

`Panel = { id, x, y, width, height, resolve?, reject?, loner?, parent? }`; `ArrowInfo = { id, type, pos }` khi kéo;
`generateArrows(panels, {arrowInfo, editMode, hoveredPanelId, size, parentPanels})` → `{ id, type: 'resolve' |
'reject', d: string, loner, isHint }[]`; `createLine(from, to, panels)` → điểm gấp khúc (thẳng / L-Z / vòng);
`generatePath(points)` → `d` với góc bo và đầu ">" 8 px; `getPoints(panel, offset)` → `(x-1)*18 + offset`. Test port
nguyên 9 file.

## 8. Log (`/revisions`, FR-050 đến FR-055)

Dòng: `{ id, activity: { action: 'run', timestamp, user, ip, user_agent, origin }, data: { steps: [{ operation, key,
status: 'resolve' | 'reject' | string, options }], data: { $trigger, $accountability, $last, [key]: … } }, delta }`.
Trạng thái lần chạy = `steps.at(-1)?.status` (`use-revisions.ts:171`); nhóm theo ngày (`RevisionsDateGroup`); icon
`check_circle` khi `resolve`, `cancel` khi khác; "Show Failed Only" lọc client trên trang hiện tại giữ `status ===
'reject'` (`logs-sidebar-detail.vue:54-62`); `data` null hoặc thiếu `steps` → không bước. Badge `abbreviateNumber`. Drawer: bước Trigger (`flow.options`, `data.$trigger`,
`data.$accountability`) + từng bước (`options`, `data.data[key]`).

## 9. Bộ mẫu `bo_flows` (FR-103)

| Flow | Trigger | Options | Operations | Dùng ở |
|------|---------|---------|------------|--------|
| `bo-flow`, `bo-flow-content`, `bo-flow-item` | manual | của 013/014 | không | giữ |
| `bo_all_ops` | manual | `bo_content`, `both`, `requireSelection true`, `requireConfirmation true`, field `reason` required | 15 operation: resolve `condition` (`$trigger.body.reason _neq fail`; `$trigger` của manual = `{path, query, body, method, headers}`, `controllers/flows.ts:22-28` Directus, body chứa giá trị hộp xác nhận cùng `collection`, `keys`) → `log` → `transform` → `sleep` (10) → `json-web-token` (sign, secret literal) → `item-read` (`bo_content` key 1) → `exec` (trả `{}`) → `trigger` (`bo_child`); reject của `condition` → `throw-error`; reject của `log` (không bao giờ chạy) → `item-create` → `item-update` → `item-delete` → `request` (`http://127.0.0.1/`) → `mail` → `notification`; vị trí trải ngang (x tăng 18) và xuống (y+16) | US2, US3, US4, perf, parity UI |
| `bo_webhook` | webhook | GET, `cacheEnabled true` | `transform → log` | US1 overview, parity UI |
| `bo_schedule` | schedule | `0 0 * * * *`, `status inactive` | `log` | US1 (badge inactive, panel mờ) |
| `bo_child` | operation | `return $last` | `log` | `trigger.flow` select |
| `bo_event` | event | `action`, `items.create`, `bo_content` | `log` | US1 drawer event |
| `bo_orphan` | manual | `bo_std`, `location item` | `log` không nối (panel lẻ), `bo-unknown` type lạ | Edge Cases |

Không E2E nào chạy `bo_all_ops`. Seed thử lại trigger tối đa 10 × 500 ms khi API chưa nạp flow. Log mẫu: `bo_all_ops` chạy 3 lần trong seed (`POST /flows/trigger/:id {collection: 'bo_content', keys: [1], reason}`;
lần 3 với `reason: 'fail'` làm `condition` reject → `throw-error`). Snapshot `operations.json` ghi `key`, `type`, `position_x/y`,
`options`, `resolve`/`reject` theo `key`, `flow` theo tên.
