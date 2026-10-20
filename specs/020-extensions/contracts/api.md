# Contract: API (REST, GraphQL, env, bus, khóa, sandbox SDK)

Mọi hành vi = Directus 11.17.4 trừ các mục ghi D-137, D-139, D-141 (spec "Khác biệt so với Directus"). Nguồn:
`directus/api/src/controllers/extensions.ts`, `services/extensions.ts`, `extensions/manager.ts`.

## 1. REST `/extensions` (thứ tự route như Directus; `useCollection('directus_extensions')`)

| # | Route | Quyền | Body / query | Trả về | Ghi chú |
|---|-------|-------|--------------|--------|---------|
| 1 | `GET /extensions` | theo ItemsService | — | `{data: ApiOutput[]}` | chờ `isReloading()`; `schema` thật (FR-031) |
| 2 | `GET /extensions/registry` | admin | `search`, `limit`, `offset`, `filter[type][_eq]` (trong `EXTENSION_TYPES`, khác → 403), `filter[by][_eq]`, `sort[0]` ∈ popular/recent/downloads; `sandbox=true` thêm khi `MARKETPLACE_TRUST=sandbox` | kết quả `list()` nguyên | đã có (010); lỗi registry → 503 `{service: 'marketplace', reason}` (`handleRegistryError`) |
| 3 | `GET /extensions/registry/account/:pk(uuid)` | admin | — | `account()` | đã có |
| 4 | `GET /extensions/registry/extension/:pk(uuid)` | admin | — | `describe()` | đã có |
| 5 | `POST /extensions/registry/install` | admin | `{extension, version}` (thiếu → 403) | 204 | `preInstall` (403 `LIMIT_EXCEEDED` khi `extensions.length + points >= EXTENSIONS_LIMIT`; `describe` lỗi → 500), tạo dòng, tải (503 marketplace/extensions), reload, broadcast `partialSync: .registry/<version>`, action `extensions.installed` |
| 6 | `POST /extensions/registry/reinstall` | admin | `{extension}` | 204 | 400 khi không phải `registry` hoặc là entry bundle |
| 7 | `DELETE /extensions/registry/uninstall/:pk(uuid)` | admin | — | 204 | 400 như trên; xóa dòng, xóa file local + remote, reload, broadcast, action `extensions.uninstalled` |
| 8 | `PATCH /extensions/:pk(uuid)` | admin | `{meta: {enabled?, …}}` (`meta` không phải object → 400 `"meta" is required`) | `{data: ApiOutput}` hoặc 204 khi `ExtensionReadError` bọc Forbidden | transaction; bundle cha ↔ con; cha `partial === false` → 422; sau commit `reload()` rồi broadcast (không chờ) |
| 9 | `DELETE /extensions/:pk(uuid)` | admin | — | 204 | xóa dòng + dòng con; không xóa file, không reload |
| 10 | `GET /extensions/sources/:chunk` | không | — | JS stream | `index.js` → chunk đầu; chunk khác phải trong `appExtensionChunks`, không thì 404 `ROUTE_NOT_FOUND`; dựng bundle lỗi lần đầu → `index.js` 404, lần sau → bản cũ (R-63); header `Content-Type: application/javascript; charset=UTF-8`, `Cache-Control` = `getCacheControlHeader(req, EXTENSIONS_CACHE_TTL, false, false)`, `Vary: Origin, Cache-Control`; luôn trả (D-137) |

Endpoint của extension: `/<id>/...` mount sau mọi route hệ thống, trước 404; đi qua authenticate, schema, sanitizeQuery,
cache như Directus (FR-016).

## 2. GraphQL (`/graphql/system`, admin)

- `extensions: [directus_extensions!]!` → `readAll()`; type `directus_extensions { bundle: String, name: String!, schema
  { type, local }, meta { enabled } }` như Directus (`system-admin.ts:262-280`); truy vấn có `name` lỗi "Cannot return null
  for non-nullable field directus_extensions.name" như Directus.
- `update_extensions_item(id: ID!, data: update_directus_extensions_input!): directus_extensions` → `updateOne` rồi
  `readOne`. Bỏ `ForbiddenError` của D-37 (`system-admin.ts:299-322`).

## 3. Biến môi trường (đọc như Directus; thêm vào `supported-variables.ts`)

| Biến | Mặc định | Dùng |
|------|----------|------|
| `EXTENSIONS_PATH` | `./extensions` | thư mục local; prefix trên storage khi có `EXTENSIONS_LOCATION` |
| `EXTENSIONS_LOCATION` | — | tên storage location; khi có, local = `TEMP_PATH/extensions` và sync lúc khởi động/partialSync |
| `EXTENSIONS_MUST_LOAD` | `false` | lỗi nạp → `process.exit(1)` |
| `EXTENSIONS_AUTO_RELOAD` | `false` | chokidar; debounce add 500, change 650, unlink 2000 ms |
| `EXTENSIONS_SANDBOX_MEMORY` | `100` (MB) | `memoryLimit` isolate |
| `EXTENSIONS_SANDBOX_TIMEOUT` | `1000` (ms) | `timeout` evaluate/evalClosure/callReference |
| `EXTENSIONS_LIMIT` | — | giới hạn cài; `/server/info.extensions.limit` (đã có) |
| `EXTENSIONS_ROLLDOWN` | `false` | rolldown thay rollup khi dựng bundle |
| `EXTENSIONS_CACHE_TTL` | — | `Cache-Control` của `/sources` (đã có) |
| `MARKETPLACE_REGISTRY` | `https://registry.directus.io` | registry (đã có) |
| `MARKETPLACE_TRUST` | `sandbox` | `sandbox=true` ở list và download (đã có ở list) |
| `PACKAGE_FILE_LOCATION` | `.` | gốc đọc `package.json` cho nguồn `module` |
| `TEMP_PATH` | `./node_modules/.directus` | `extensions/` (cache sync), `app-extensions/` (bundle), `marketplace/` (tarball) |
| `SERVE_APP` | | vẫn cảnh báo; không ảnh hưởng bundle (D-137) |

## 4. Bus và khóa (namespace như 002)

| Kênh / khóa | Payload | Ai gửi / giữ |
|-------------|---------|--------------|
| `extensions.reload` | `{forceSync?, partialSync?, origin}` | install/uninstall (`partialSync`), `updateOne` (không options), node khác reload với `forceSync`/`partialSync` nhận được |
| `extensions-sync/<machineId>` | `{ready: true}` | process sync xong (chỉ có ý nghĩa khi nhiều process một máy) |
| `flows` | như 009 | sau add/remove operation |
| `directus:lock:extensions-sync/<machineId>` | INCRBY/UNLINK | process sync; app mới UNLINK khóa cũ của mình lúc khởi động |
| `directus:lock:extensions-settings` | INCRBY/UNLINK, chờ ≤ 30 s | node Backoffice khi tạo dòng settings mới (R-58) |
| `directus-sync:clock:<tên>:<index>:<cron>` | SynchronizedClock | hook `schedule` (đã có) |

## 5. Event

- Init (`emitInit`, payload `{app}`): `app.before`, `middlewares.before`, `middlewares.after`, `routes.before`,
  `routes.custom.before`, `routes.custom.after`, `routes.after`, `app.after`.
- Action của manager: `extensions.load`, `extensions.unload`, `extensions.reload`, `extensions.installed`,
  `extensions.uninstalled` (payload ở data-model §4).
- Filter/action đã phát ở 003–011 (bảng đầy đủ Directus ↔ app mới ở research R3: `items.*`, `<scope>.*`, `fields.*`,
  `relations.delete`, `items.sort`, `items.promote`, `files.upload`, `auth.login`, `auth.jwt`, `auth.create/update`,
  `authenticate`, `request.error`, `request.not_found`, `database.error`, `response`, `server.start/stop`). Thêm ở 020:
  `email.send` (filter, trong `MailService.send` trước khi log). Không phát (XI): `websocket.*`, `deployment.webhook*`.

## 6. Context cấp cho extension

```ts
{ services, env, database: Knex, emitter: Emitter /* riêng */, logger, getSchema }
```

`services`: mọi export của `apps/api/src/services/index.ts` sau khi thêm `AuthenticationService`, `ExtensionsService`,
`ExtensionReadError`, `GraphQLService`, `ServerService`, `SettingsService`, `SpecificationService`, `TFAService`,
`UtilsService`, `MailService` (log). Không có: `WebSocketService`, `DeploymentService`, `DeploymentProjectsService`,
`DeploymentRunsService` (D-141).

## 7. Sandbox SDK `directus:api`

| Hàm | Scope | Kiểm tra | Lỗi |
|-----|-------|----------|-----|
| `log(message: string)` | `log` | string | `No permission to access "log"` |
| `sleep(ms: number)` | `sleep` | number | `No permission to access "sleep"` |
| `request(url, {method?, body?, headers?})` | `request` | url string; `globToRegExp(scope.urls[i]).test(url)`; method ∈ `scope.methods` | `No permission to access "request"`, `No permission to request "<url>"`, `No permission to use request method "<m>"` |

Hook sandboxed: chỉ `filter(event, handler)` (payload duy nhất, kết quả copy làm payload mới) và `action`. Endpoint
sandboxed: `router.get/post/put/patch/delete(path, handler({url, headers, body}) → {status, body})`. Operation sandboxed:
`handler(options)` copy kết quả. Import khác `directus:api` → `Imports other than "directus:api" are prohibited in API
extension sandboxes`.

## 8. Express cho endpoint và `init` (D-139)

Router/app Express 5.2.1; `req.query` = `qs.parse` như Directus; khác biệt liệt kê ở spec D-139; fixture
`parity-endpoint-express4` ghi nhận lỗi có chủ đích trong `accepted-differences.ts` (entry `D-139`).

## 9. `/server/health`

Không đổi. Readiness lần đầu do `listen` sau `createApp` (gồm sync + nạp + dựng bundle). Reload sau đó không chặn.
