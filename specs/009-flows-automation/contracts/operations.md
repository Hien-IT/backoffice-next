# Contract: 15 operation có sẵn (009)

Mốc: `directus/api/src/operations/<id>/index.ts` của Directus 11.17.4. Mỗi operation là `defineOperationApi({id,
handler})`; `handler(options, context)` với `context = { services, env, database, logger, getSchema, data,
accountability, flow, schema?, ...context của trigger }`. Option đã qua `applyOptionsData` (chuỗi `{{ a.b }}` → giá
trị; cả chuỗi chỉ là `{{ x }}` → giá trị thô, object giữ object; object/mảng trong chuỗi dài → `JSON.stringify`).
Kết quả undefined → `null` trong dữ liệu flow. Lỗi ném → nhánh reject với `data` theo contracts/flows-api.md §5.

| id | Option | Hành vi | Kết quả | Lỗi (reject) |
|----|--------|---------|---------|--------------|
| `condition` | `filter` | `parseFilter(filter, accountability, undefined, true)` rồi `validatePayload(filter, data, {requireAll: true})` | `null` | mảng `FailedValidationError` (một mỗi `details`, `extensions` từ `joiValidationErrorItemToErrorExtensions`); filter không parse được → `null` (resolve) |
| `exec` | `code` | isolate `{memoryLimit: FLOWS_RUN_SCRIPT_MAX_MEMORY}`; jail: `global`, `process = {env: $env}`, `module = {exports: null}`, `console.{log,info,warn,error,trace,debug}` → logger (`log` → `info`; 1 tham số: giá trị, nhiều: mảng); `eval(code, {timeout})`; `evalClosure('return module.exports($0.data)', [{data: sieveFunctions(data)}], {result: {reference, promise}, timeout})`; `copy()`; release + dispose | giá trị trả về của script | lỗi cú pháp, `Script execution timed out.`, `Array buffer allocation failed` (bộ nhớ), `module.exports` không phải hàm, hàm ném, ``memoryLimit` must be a number`, ``timeout` must be a 32-bit number` |
| `item-create` | `collection`, `payload`, `emitEvents`, `permissions` | accountability theo `permissions`; `ItemsService(collection).createMany(toArray(optionToObject(payload)), {emitEvents})` | mảng khóa; `null` khi không payload | lỗi của `ItemsService` (`403`, `400`...) |
| `item-read` | `collection`, `key`, `query`, `emitEvents`, `permissions` | `sanitizeQuery(optionToObject(query) ?? {}, schema, accountability)`; không key → `readByQuery`; 1 key → `readOne`; nhiều → `readMany` | item, mảng item | như trên |
| `item-update` | `collection`, `key`, `payload`, `query`, `emitEvents`, `permissions` | payload mảng → `updateBatch`; không key → `updateByQuery`; 1 → `updateOne`; nhiều → `updateMany` | khóa hoặc mảng khóa; `null` khi không payload | như trên |
| `item-delete` | `collection`, `key`, `query`, `emitEvents`, `permissions` | không key → `deleteByQuery`; 1 → `deleteOne`; nhiều → `deleteMany` | khóa hoặc mảng khóa | như trên |
| `json-web-token` | `operation` (`sign`, `verify`, `decode`), `payload`, `token`, `secret`, `options` | jsonwebtoken 9.0.3 | token; payload; payload giải mã | `Undefined JSON Web Token payload`, `... secret`, `... token`, `Undefined "Operation" for JSON Web Token`, lỗi jsonwebtoken (`invalid signature`, `jwt expired`...) |
| `log` | `message` | `logger.info(optionToString(message))`; option data đã che | undefined → `null` | — |
| `mail` | `to`, `type`, `subject`, `body`, `template`, `data`, `cc`, `bcc`, `replyTo` | `useFlowsEmailRateLimiter(flow.id)`; dựng `mailObject` như Directus; **D-34**: `logger.warn('Backoffice: mail sending is out of scope; flow mail "<subject>" to <to> not sent')` thay `MailService.send` | undefined → `null` | `EmailLimitExceededError` (`429`, `extensions {points, duration, message}` từ env) khi vượt hạn |
| `notification` | `recipient`, `subject`, `message`, `permissions`, `collection`, `item` | accountability theo `permissions` (`$full` → null); `NotificationsService.createMany(toArray(recipient).map(...))` với `sender = accountability?.user ?? null`; `message`, `collection`, `item` qua `optionToString` hoặc null | mảng khóa | lỗi `ItemsService`; mỗi người nhận có email → dòng D-33 |
| `request` | `url`, `method`, `body`, `headers[] {header, value}` | headers → object; thêm `Content-Type: application/json` khi chưa có và body là object hoặc chuỗi JSON; `getAxios()({url: encodeUrl(url), method, data: body, headers})` | `{status, statusText, headers, data}` | response lỗi → chuỗi JSON `{status, statusText, headers, data}` (parse thành object); lỗi khác (mạng, IP bị chặn) → `Error` |
| `sleep` | `milliseconds` | `setTimeout(Number(milliseconds))` | undefined → `null` | — |
| `throw-error` | `code`, `status`, `message` | `createError(code ?? 'INTERNAL_SERVER_ERROR', message ?? 'An unexpected error occurred.', parseInt(status) || 500)`; `throw new error()` | — | lỗi đó (`name = DirectusError`, `code` viết hoa, `status`) |
| `transform` | `json` | `optionToObject(json)` | object/mảng/giá trị | `parseJSON` lỗi với chuỗi không phải JSON |
| `trigger` | `flow`, `payload`, `iterationMode` (`serial`, `batch`, `parallel` mặc định), `batchSize` (10) | `payload` mảng: chạy `runOperationFlow(flow, item, omit(context, 'data'))` theo mode; khác: một lần | mảng kết quả hoặc kết quả | flow đích không có → `null` + warn; lỗi của flow đích (ném từ `executeFlow`, ví dụ filter) |

`permissions` của `item-*`, `notification`: `$trigger` hoặc rỗng → accountability của context; `$full` →
`getAccountabilityForRole('system')` (admin; `notification`: null); `$public` → `getAccountabilityForRole(null)`;
khác → `getAccountabilityForRole(<uuid role>)` (role không có → accountability rỗng, không lỗi).

Đăng ký: `apps/api/src/operations/index.ts` liệt kê 15 config theo thứ tự tên thư mục; `FlowManager.initialize()`
gọi `addOperation(config.id, config.handler)` cho từng config trước `load()`.
