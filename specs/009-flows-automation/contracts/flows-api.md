# Contract: `/flows`, `/operations`, `/flows/trigger/:pk`, bộ máy flow (009)

Mốc: `controllers/flows.ts`, `controllers/operations.ts`, `flows.ts`, `services/flows.ts`, `services/operations.ts`
của Directus 11.17.4. Mọi route trả `{data, meta?}` qua `respond` (response cache dùng chung), lỗi `{errors:
[{message, extensions: {code, ...}}]}`.

## 1. `/flows` (`useCollection('directus_flows')`)

| Route | Service | Response |
|-------|---------|----------|
| `GET /trigger/:pk`, `POST /trigger/:pk` | `runWebhookFlow('<METHOD>-<pk>', { path, query, body, method, headers }, { accountability, schema })` | `res.locals.payload = result`: body là `result` **thô** (không bọc `{data}`); `204` khi `result` falsy (`undefined` khi `async` hoặc `return` không có, `null`, `0`, `''`, `false`); `res.locals.cache = false` khi `cacheEnabled` tắt |
| `POST /` | `createMany` (mảng) hoặc `createOne`; đọc lại `readMany`/`readOne` (`Forbidden` → `204`) | `200 {data}` |
| `GET /`, `SEARCH /` | `validateBatch('read')`; `readByQuery` + `MetaService.getMetaForQuery` | `{data, meta}` |
| `GET /:pk` | `readOne` | `{data}`; dòng không có → `403` |
| `PATCH /` | `validateBatch('update')`; `updateBatch`, `updateMany(keys, data)`, `updateByQuery` | `{data}`; `Forbidden` → `204` |
| `PATCH /:pk` | `updateOne` | `{data}` |
| `DELETE /`, `DELETE /:pk` | `deleteMany(body)`, `deleteMany(keys)`, `deleteByQuery`, `deleteOne` | `204` |

`:pk` của `/trigger` phải khớp `UUID_REGEX` (`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`) **không
phân biệt hoa thường** (route Express 4 của Directus mặc định `caseSensitive: false`); không khớp → `404
ROUTE_NOT_FOUND` (`Route /flows/trigger/<pk> doesn't exist.`) như Directus khi không route nào khớp; uuid viết hoa khớp
route nhưng không có handler `<METHOD>-<UUID HOA>` → `403` (đo ở `webhook.test.ts`).
`/trigger` không kiểm quyền: public accountability (`role: null`) vẫn chạy webhook; manual kiểm ở §3.

## 2. `/operations` (`useCollection('directus_operations')`)

Cùng bảng CRUD như `/flows` (không có `/trigger`). `OperationsService` gọi `reload()` sau mỗi ghi.

## 3. `runWebhookFlow` và handler manual

| Điều kiện | Kết quả | Log |
|-----------|---------|-----|
| Không có handler `<METHOD>-<id>` (flow không active, không phải webhook/manual, method khác, `operation` flow) | `403 FORBIDDEN` | warn `Couldn't find webhook or manual triggered flow with id "<METHOD>-<id>"` |
| Manual: `body.collection` thiếu | `403` | warn `Manual trigger requires "collection" to be specified in the payload` |
| Manual: `options.collections` rỗng | `403` | warn `There is no collections configured for this manual trigger` |
| Manual: collection không thuộc danh sách | `403` | warn `Specified collection must be one of: <a, b>.` |
| Manual: `requireSelection` (mặc định true) và `body.keys` không phải mảng | `403` | warn `Manual trigger requires "keys" to be specified in the payload` |
| Manual: `requireSelection` và `keys` rỗng | `403` | warn `Manual trigger requires at least one key to be specified in the payload` |
| Manual: không `accountability` | `403` | warn `Manual flows are only triggerable when authenticated` |
| Manual, non-admin: `fetchPermissions(read, [collection])` rỗng | `403` | warn `Triggering <collection> is not allowed` |
| Manual, non-admin, có `keys`: `readMany(keys, {fields: [primary]}, {emitEvents: false})` thiếu khóa (so chuỗi) | `403` | warn `Triggering keys <keys> is not allowed` |
| `async` | `{ result: undefined }` ngay → `204`; flow chạy nền | |
| Webhook `GET` với `options.cacheEnabled === false` | `cacheEnabled: false` → không cache | |

Thứ tự kiểm manual đúng như trên. Lỗi ném từ `executeFlow` (đồng bộ, `error_on_reject`) đi qua error handler chung
(`middleware/error-handler.ts`, nhận cả mảng): `DirectusError` → status, `code`, `message` của nó; mảng
`FailedValidationError` (`condition`) → `400` với một phần tử `errors[]` mỗi lỗi; mảng có status khác nhau → `500`;
giá trị khác (chuỗi, object thường như reject của `request`) → `500 INTERNAL_SERVER_ERROR`.

## 4. `executeFlow`

1. `database = context.database ?? getDatabase()`, `schema = context.schema ?? getSchema({database})` (webhook,
   manual có `context.schema`; schedule, filter, action không có nên gọi `getSchema`). Filter flow: `database` là
   transaction của request, nên log chạy và ghi của `item-*` rollback cùng request khi request lỗi.
2. `keyedData = { $trigger: data, $last: data, $accountability: context.accountability ?? null, $env }`;
   `context.flow ??= flow`.
3. Lặp từ `flow.operation`: `executeOperation` → `keyedData[key] = data`, `$last = data`, `steps.push`.
4. `accountability !== null`: `ActivityService` (không accountability, `knex: database`, `schema`) `createOne({action:
   'run', user, collection: 'directus_flows', ip, user_agent, origin, item: flow.id})`; `=== 'all'`:
   `RevisionsService.createOne({activity, collection, item, data: {steps: redact(values), data: redact(keys, values)}})`.
5. Ném `$last` khi (`manual`|`webhook`) và `!async` và `error_on_reject === true` và bước cuối reject; hoặc `event`
   `filter` và bước cuối reject.
6. Trả `keyedData` (`return === '$all'`), `get(keyedData, return)` (micromustache), hoặc undefined.

## 5. `executeOperation`

| Bước | Hành vi |
|------|---------|
| Type chưa đăng ký | warn `Couldn't find operation <type>`; `{successor: null, status: 'unknown', data: null, options: null}` |
| `type === 'log'` | option data = `redactObject(keyedData, {keys: danh sách §6 data-model})` |
| Thay thế | `options = applyOptionsData(operation.options, optionData)` |
| Gọi handler | `handler(options, { services, env: useEnv(), database: getDatabase(), logger, getSchema, data: keyedData, accountability: null, ...context })` |
| Kiểm | `JSON.stringify(result ?? null)` (ném → nhánh reject); `deepMap(result, undefined → null)` |
| Resolve | `{successor: operation.resolve, status: 'resolve', data: result ?? null, options}` |
| Reject | `Error` → `delete error.stack`, `data = error`; chuỗi → `isValidJSON ? parseJSON : chuỗi`; khác → `error ?? null`; `{successor: operation.reject, status: 'reject', data, options}` |

## 6. Trigger handler (`load`)

| Trigger | Đăng ký | Dữ liệu, context khi chạy |
|---------|---------|---------------------------|
| `event` `filter` | `emitter.onFilter(event, handler)` mỗi event | `executeFlow(flow, {payload, ...meta}, {accountability, database: context.database, getSchema: () => context.schema})`; giá trị trả về thay payload |
| `event` `action` | `emitter.onAction(event, handler)` | `executeFlow(flow, meta, {accountability, database: getDatabase(), getSchema: () => context.schema})`; lỗi do `emitAction` log warn |
| `schedule` | `scheduleSynchronizedJob(flow.id, cron, cb)` khi `validateCron`; không hợp lệ: warn `Couldn't register cron trigger. Provided cron is invalid: <cron>` | `executeFlow(flow)`; lỗi `logger.error` |
| `operation` | `operationFlowHandlers[flow.id]` | `executeFlow(flow, data, context)` từ `runOperationFlow`; không có: warn `Couldn't find operation triggered flow with id "<id>"`, trả null |
| `webhook` | `webhookFlowHandlers['<METHOD>-<id>']`; `options.return ??= '$last'` | §3 |
| `manual` | `webhookFlowHandlers['POST-<id>']`; `options.return = '$last'` | §3 |

Tên event từ scope: `items.create|update|delete` × `collections` → `<collection>.<scope>` (user) hoặc
`<collection bỏ directus_>.<action>` (hệ thống); không có `collections` → không event; scope khác giữ nguyên.
`unload`: `offFilter`, `offAction`, `job.stop()`; xóa mọi bảng handler; `isLoaded = false`.

## 7. Nạp lại

- `reload()`: `bus.publish('flows', {type: 'reload'})`.
- Subscriber: `reloadQueue.add(unload → load)` khi `isLoaded`, else warn `Flows have to be loaded before they can
  be reloaded`.
- `runOperationFlow`, `runWebhookFlow`: `if (reloadQueue.pending > 0) await reloadQueue.onIdle()`.
- Dòng mới của app mới (D-18): `Backoffice: SYNCHRONIZATION_STORE is not redis; scheduled flows run on every
  instance` (warn, cuối `load`, chỉ khi có trigger `schedule` đăng ký).

## 8. `getService`

| Collection | Service |
|------------|---------|
| `directus_flows` | `FlowsService` (mới; bỏ khỏi `COLLECTIONS_WITHOUT_SERVICE_YET`) |
| `directus_operations` | `OperationsService` (mới; bỏ khỏi `COLLECTIONS_WITHOUT_SERVICE_YET`) |

## 9. `OPTIONS`, `HEAD`, cache

`router-options` khối Feature 009: `/flows` (`GET, POST, PATCH, DELETE, SEARCH`), `/flows/:pk` (`GET, PATCH,
DELETE`), `/flows/trigger/:pk` (`GET, POST`), `/operations`, `/operations/:pk`. `HEAD` theo `GET`. Response cache
theo `CACHE_*`; key của `/flows/trigger/:id` gồm `rawQuery` theo `options.cacheQueryParams` (005).
