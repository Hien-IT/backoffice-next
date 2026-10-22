# Research: Extensions (020)

Ngày 2026-10-21. Mỗi mục: quyết định, lý do, phương án bỏ. Directus tham chiếu 11.17.4 (`directus/api` 35.2.0,
`directus/app` 15.10.0, `@directus/extensions` 3.0.25, `@directus/extensions-sdk` 17.1.4, `@directus/composables`
11.4.1, `@directus/constants` 14.3.0). Hành vi Directus lấy từ sáu báo cáo đọc mã nguồn (agent, 2026-10-21) và các lần
kiểm trực tiếp ghi ở bảng cuối; chưa chạy thử. Dòng ghi `file:dòng` là của Directus (`directus/api/src/...`,
`directus/app/src/...`) hoặc app mới (`apps/api/src/...`, `apps/web/src/...`).

Hai quyết định owner chốt khi plan (2026-10-21), ghi vào spec Clarifications:

- Shared dep của bundle app đi qua **import map** trong `index.html` của web, bundle API giữ bare specifier (R4). D-140
  (API nhúng manifest, hai image cùng commit) bỏ.
- `pinia` ghim **2.3.1** như Directus (R1).

## R1. Thư viện và phiên bản

**Quyết định** (mọi bản theo `directus/pnpm-workspace.yaml` 11.17.4, nhóm catalog "same versions as directus"):

| Gói | Bản | Ở đâu | Dùng cho |
|-----|-----|-------|----------|
| `rollup` | 4.59.0 | `apps/api` dependencies | dựng bundle app (R3). Lockfile gốc chỉ có `rollup@4.64.3` transitive |
| `rolldown` | 1.0.0-beta.31 | `apps/api` dependencies | `EXTENSIONS_ROLLDOWN=true` (FR-060); [Unverified] binding `linux-x64-musl` cho image alpine: T001 cài thử trong image, nếu thiếu thì bỏ `EXTENSIONS_ROLLDOWN` (ghi khác biệt) |
| `@rollup/plugin-virtual` 3.0.2, `@rollup/plugin-node-resolve` 16.0.3 | | `apps/api` dependencies | entry ảo và resolve `node_modules` của extension. Không cần `@rollup/plugin-alias` (R4: shared dep là external bare, không đổi tên) |
| `chokidar` | 5.0.0 | `apps/api` dependencies | `EXTENSIONS_AUTO_RELOAD` (FR-006) |
| `node-machine-id` | 1.1.12 | `apps/api` dependencies | khóa sync theo máy (R6) |
| `tar` | 7.5.19 (Directus 7.5.8; bản vá bảo mật, Kết quả T001) | `apps/api` dependencies | giải nén tarball registry (R7). Lockfile có `tar@6.2.1` qua `sqlite3` (auditConfig bỏ qua advisory của tar 6); tar 7 là gói riêng |
| `fs-extra` 11.3.2 (+ `@types/fs-extra` 11.0.4, đã có catalog) | | `apps/api` | `move`, `remove` của installation; `listFolders` |
| `glob-to-regexp` 0.4.1 (+ `@types/glob-to-regexp` 0.4.4) | | `apps/api` | scope `request.urls` của sandbox (R5) |
| `p-queue` 8.1.0, `isolated-vm` 5.0.3, `ky`, `encodeurl`, `zod`, `lodash-es`, `express` 5.2.1 | | đã có | |
| `pinia` | **2.3.1** (đổi catalog, đang 3.0.3) | `apps/web` | chunk `pinia` dùng chung: pinia 3 bỏ `defineStore({ id, ... })` (`pinia.d.ts` chỉ còn `defineStore(id, …)`), extension viết cho Directus có thể dùng dạng object. Owner chọn 2026-10-21. T100 kiểm `apps/web/src` không dùng API chỉ có ở pinia 3 (`grep defineStore(` cho thấy mọi store dùng `defineStore('id', …)`) |
| `vue` | giữ 3.5.43 (Directus 3.5.24, security patch của 012) | `apps/web` | lệch patch, cùng API |
| `@directus/composables` | 11.4.1 | `apps/web` dependencies | thân của `@directus/extensions-sdk` ở runtime (R4): `useApi`, `useStores`, `useSdk`, `useExtensions`, `useItems`, `useCollection`, `useLayout`, `useSync`, `useFilterFields`, `useSizeClass`, `useElementSize`, `useCustomSelection`, `useGroupable`, `useShortcut`, `useSystem` (`packages/composables/src/index.ts:1-12`); thêm vào danh sách `@directus/*` cho phép của `check-package-names` |
| `axios` | 1.15.0 (catalog có) | `apps/web` dependencies | `useApi()` (FR-081, owner duyệt lệch 012) |
| `semver` 7.7.3 (+ `@types/semver`) | | `apps/web` | `extension-metadata-compatibility.vue:15-41` `semver.satisfies(info.version, host_version)` |
| `@vueuse/router` | 14.0.0 (cùng `@vueuse/core` 14.0.0 đã có) | `apps/web` | `useRouteQuery` của `registry.vue:22-34` |
| `@directus/extensions-sdk` | 17.1.4 | devDependency của `tests/fixtures/extensions` (workspace riêng) | build bộ extension mẫu (R11) như người viết extension thật |

Không thêm: `@rollup/plugin-alias` (R4), `@directus/extensions` ở web (`define*` là identity, chép inline như 017/018),
`@directus/extensions-sdk` ở `apps/web` (kéo theo rollup, vue compiler; chunk dùng chung lấy thân từ
`@directus/composables` + module cục bộ, R4), `express@4` cạnh `express@5` (D-139, owner chọn B).

**Phương án bỏ**: port `@directus/composables` sang `@backoffice/composables` (12 composable, tốn công, extension
đã compile với API của gói công khai này); `pinia` 3 + ghi khác biệt (owner từ chối).

## R2. Lib `@backoffice/extensions` và types

**Quyết định**: thêm `libs/extensions` (`@backoffice/extensions`) port `directus/packages/extensions/src`:

- `shared/`: `constants/{pkg-key,shared-deps,languages}.ts` (`EXTENSION_PKG_KEY = 'directus:extension'`,
  `APP_SHARED_DEPS = ['@directus/extensions-sdk','vue','vue-router','vue-i18n','pinia']`,
  `API_SHARED_DEPS = ['directus','directus:api']`), `schemas/{options,manifest}.ts` (zod: `SplitEntrypoint`,
  `ExtensionSandboxRequestedScopes`, `ExtensionSandboxOptions`, `ExtensionOptionsBundleEntry`, `ExtensionManifest`;
  `host` bắt buộc), `define*` (identity).
- `node/`: `get-extensions.ts` (`getExtensionDefinition`, `resolveFsExtensions(root)` với `listFolders(root,
  {ignoreHidden: true})` nên `.registry` không bị đọc như local, manifest sai thì ném `The manifest of the extension
  "<f>" (<path>) is invalid.`; `resolveModuleExtensions(root)` đọc `dependencies` của `<root>/package.json` và giữ gói có
  `directus:extension`), `generate-extensions-entrypoint.ts` (R4).
- `libs/types/src/extensions/`: `Extension`, `ApiExtension`, `HybridExtension`, `BundleExtension`, `ExtensionSettings`,
  `ApiOutput`, `BundleConfig`, `HookConfig`, `RegisterFunctions`, `EndpointConfig`, `HookExtensionContext`,
  `EndpointExtensionContext`, `ExtensionManagerOptions`, `ExtensionsServices`; `ApiExtensionContext` hiện thiếu
  `emitter` → thêm.
- `@backoffice/utils`: shared `pluralize`, `numberGenerator`; node `listFolders`, `resolvePackage`, `pathToRelativeUrl`
  (đều thiếu, agent kiểm `libs/utils/src/node/index.ts`).
- `libs/constants/src/extensions.ts` đã có danh sách loại; `injection.ts` đã có bốn khóa inject.

**Lý do**: manager và web đều cần schema, hằng và entrypoint generator; cấu trúc lib giống Directus để
`tools/port-manifest` và `check-port-headers` ghi nguồn từng file.

## R3. Manager API: vòng đời, hook, endpoint, operation, bundle app

**Quyết định**: `apps/api/src/extensions/manager.ts` port `directus/api/src/extensions/manager.ts` (1045 dòng) cùng
`lib/{get-extensions,get-extensions-settings,wrap-embeds}.ts`, `lib/installation/*`, `lib/sync/*`, `lib/sandbox/**`
(R5–R7). Singleton `getExtensionManager()` (`extensions/index.ts`). Khác biệt so với Directus, có chủ đích:

| Chỗ | Directus | App mới | Lý do |
|-----|----------|---------|-------|
| `services` trong context (`manager.ts:962-969`, `:988-995`) | `import * as services from '../services/index.js'` (41 export) | `services/index.ts` thêm các export đang nằm ngoài index (`AuthenticationService`, `ExtensionsService` + `ExtensionReadError`, `GraphQLService`, `ServerService`, `SettingsService`, `SpecificationService`, `TFAService`, `UtilsService`; comment `index.ts:4-5` nói `ServerService` nạp module HTTP server → cấp object `services` cho extension bằng getter lười lúc đăng ký, không ở top-level import, tránh vòng import `manager → services → server.service → server → app → manager`); thêm `MailService` port với `send` chỉ log (D-33/D-34); `WebSocketService`, `DeploymentService`, `DeploymentProjectsService`, `DeploymentRunsService` không có (D-141) | Nguyên tắc XI; extension gọi `services.MailService` khá phổ biến |
| `database`, `getSchema`, `logger`, `env` | `getDatabase()`, `utils/get-schema.ts`, `useLogger`, `useEnv` | `database/index.ts:27`, `schema/get-database-schema.ts:23`, `logger/index.ts:18`, `@backoffice/env` | đã có |
| `emitter` của context | `this.localEmitter` (Emitter riêng) | như Directus (`emitter.ts` đã port đủ `onInit/offInit/emitInit`) | |
| `init` gỡ đăng ký | `emitter.offInit(name, handler)` (`manager.ts:911`: truyền tên extension thay event, listener không bao giờ bị gỡ) | `offInit(event, handler)` | lỗi Directus; init chỉ phát lúc khởi động nên không thấy khác biệt ngoài |
| Bundle app | chỉ khi `SERVE_APP` (`manager.ts:303-305`) | luôn dựng; `/extensions/sources/:chunk` trả luôn | app web là image riêng (D-137 ghi thêm) |
| `registerInternalOperations` | manager đọc `../operations/*/index.js` mỗi lần load | FlowManager 009 đã đăng ký 15 operation tĩnh ở `initialize()` (`flows.ts:103`); manager chỉ `addOperation`/`removeOperation` cho extension | giữ 009 |
| Khóa sync, dòng settings | xem R6 | | |

Vòng đời trong `app.ts` (`createApp`, 25-52): `extensionManager.initialize()` ngay trước `flowManager.initialize()`
(31) như Directus `app.ts:130-131`; `onServerShutdown(extensionManager.unload)` (gỡ hook, endpoint, operation, job
schedule, dispose isolate) trước `flowManager.unload`. Event init (FR-012), tại cùng vị trí Directus `app.ts`:

| Event | Directus | App mới |
|-------|----------|---------|
| `app.before`, `middlewares.before` | sau HSTS, trước logger (`app.ts:213-215`) | `createExpressApp` thành async, `await emitter.emitInit(...)` sau HSTS (`app-pipeline.ts:111`) |
| `middlewares.after`, `routes.before` | sau cache, trước `/auth` (`:317-319`) | sau `options.beforeRoutes` (`:164`), trước `createRouterOptions` |
| `routes.custom.before`, mount `endpointRouter`, `routes.custom.after` | sau `/versions`, trước 404 (`:378-380`) | `ExtensionsModule.onModuleInit` của Nest: chạy sau `registerRouter` và trước `registerRouterHooks` (404, error) của `nest.init()` (`@nestjs/core` 12.1.2 `nest-application.js:110-130`); gọi `express.use(getEndpointRouter())` ở đó |
| `routes.after` | sau error handler (`:385`) | sau `await nest.init()` (`app.ts:45`) |
| `app.after` | sau schedules (`:393`) | sau `startSchedules()` (`:47`) |

Payload `{ app }` là app Express 5 của `createExpressApp`. `cli.before/after`: app mới không có CLI (D-19 của 001), ghi
D-141.

Thứ tự đăng ký (release-gate CHK002): manager khởi tạo trước FlowManager nên filter extension chạy trước filter flow;
trong manager local → registry → module; sau reload filter extension đăng ký lại sau flow (R-62, như Directus).

Event filter/action (release-gate CHK004; Directus `directus/api/src/…` ↔ app mới `apps/api/src/…`, báo cáo agent
2026-10-21):

| Event | Loại | Directus | App mới |
|-------|------|----------|---------|
| `items.create` + `<coll>.items.create` (hoặc `<scope>.create` cho collection hệ thống) | F + A | `services/items.ts:156,390` | `items.service.ts:157,410` |
| `…update` / `…delete` / `…query` / `…read` | F (+ A trừ query) | `items.ts:732,942` / `1082,1161` / `502` / `548,564` | `items.service.ts:733,962` / `1083,1181` / `503` / `549,565` |
| `fields.create/update/delete` | F + A | `fields.ts:405,520,707` / `453,614,864` | `fields.service.ts:406,521,708` / `454,615,865` |
| `relations.delete` | A | `relations.ts:484` | `relations.service.ts:485` |
| `items.sort` | A | `utils.ts:144` | `utils.service.ts:145` |
| `items.promote` | F + A | `versions.ts:348,367` | `versions.service.ts:349,368` |
| `files.upload` | A | `files.ts:236`, `tus/server.ts:114` | `files.service.ts:237`, `tus/server.ts:115` |
| `auth.login` | F + A | `authentication.ts:111,76` | `authentication.service.ts:116,81` |
| `auth.jwt` | F | `authentication.ts:258,438` | `:265,446` |
| `auth.create` / `auth.update` | F | openid, oauth2, ldap, saml | openid, oauth2, ldap (SAML ngoài phạm vi) |
| `authenticate` | F | `middleware/authenticate.ts:30` | `middleware/authenticate.ts:32` |
| `request.error` / `request.not_found` | F | `middleware/error-handler.ts:90` / `controllers/not-found.ts:19` | `errors/error-handler.ts:91` / `errors/error-handler.filter.ts:23` |
| `database.error` | F | `database/errors/translate.ts:43` | `:44` |
| `response` | A | `server.ts:93` | `server.ts:85` |
| `server.start` / `server.stop` | A | `server.ts:194` / `:150` | `server.ts:179` / `:132` |
| `email.send` | F | `services/mail/index.ts:67` | **thêm ở 020** (`MailService.send`, rồi log) |
| `extensions.installed/uninstalled/load/unload/reload` | A | `extensions/manager.ts:242,261,309,326,376` | **thêm ở 020** (manager) |
| init (8 event) | init | `app.ts:213..393` | **thêm ở 020** (bảng trên) |
| `deployment.webhook*`, `websocket.*` | F/A | | ngoài phạm vi (XI, D-17) |

Event lồng (`collections`, `relations`, `fields`, `import-export`, `apply-diff`, `generate-translations`) đã port ở
006–010.

Endpoint (FR-015): `endpointRouter = Router()` của Express 5; `scopedRouter` mount ở `/${routeName}`; gỡ bằng lọc
`endpointRouter.stack` (router@2.2.0 đọc `stack` mỗi request, `router/index.js:70,166`, nên cách này vẫn đúng). D-139:
xem R12.

Hook `schedule` (FR-013): `scheduleSynchronizedJob(`${name}:${scheduleIndex}`, cron, cb)` của `utils/schedule.ts:13`
dùng `SynchronizedClock(`${id}:${rule}`)` → khóa `directus-sync:clock:<tên>:<index>:<cron>`, cùng Directus.

Reload (FR-007): `reloadQueue` PQueue concurrency 1, `if (reloadQueue.size > 0) return` (bỏ yêu cầu khi đã có một chờ,
options của yêu cầu bị bỏ mất, như Directus `manager.ts:338-398`); action `extensions.reload {extensions, added,
removed}` (tên theo `path`). Log cùng nội dung.

Reload hỏng (release-gate CHK008): giữ `process.exit(1)` khi sync lỗi; job reload ném thì app mới gọi `reject` của
`reloadPromise` (Directus không gọi nên `GET /extensions` treo, R-64). Bundle lỗi (CHK007): như Directus, chỉ warn,
`appExtensionChunks` giữ giá trị cũ (R-63).

**Phương án bỏ**: mount `endpointRouter` qua `options.beforeRoutes` (extension che được route hệ thống, khác Directus);
chèn layer vào `express.router.stack` sau `nest.init()` (chạm nội bộ router).

## R4. Bundle app, shared dep qua import map, nạp ở web

**Quyết định**:

- API dựng bundle như `generateExtensionBundle` (`manager.ts:569-614`): entry ảo của `generateExtensionsEntrypoint`
  (`import X from './<đường dẫn tương đối tới entrypoint.app>'`, bundle: `import {interfaces as interfaceBundle0, …}`,
  `export const interfaces = [...]` cho 7 loại; extension tắt bị bỏ; entry bundle chỉ giữ mục có dòng settings `enabled`
  cùng `source`, `folder = entry.name`, `bundle = id`), plugins `virtual` + `nodeResolve({browser: true})`,
  `external: APP_SHARED_DEPS` (bare specifier giữ nguyên, **không alias**), `format: 'es'`, `dir:
  TEMP_PATH/app-extensions`; `appExtensionChunks` = tên các chunk; `index.js` → chunk đầu (entry).
- Web (`apps/web/vite.config.ts`, chưa có khối `build`) thêm plugin `backoffice-extensions-build` (`apply: 'build'`) như
  `directus-extensions-build` (`app/vite.config.js:136-154`): `rollupOptions.input = { index, ...5 shared dep (key thay
  `/` bằng `_`) }`, `output.entryFileNames: 'assets/[name].[hash].entry.js'`, `preserveEntrySignatures: 'exports-only'`;
  và ở `generateBundle` (`enforce: 'post'`) chèn `<script type="importmap">{"imports":{"vue":"/admin/assets/vue.<hash>.entry.js", "vue-router": …, "vue-i18n": …, "pinia": …, "@directus/extensions-sdk": …}}</script>` vào `index.html` trước
  script module đầu tiên (Vite 7 `config.js:24208-24213` cảnh báo và tự dời importmap lên trước; chèn sau build-html
  nên không bị cảnh báo). Mục `@directus/extensions-sdk` trỏ tới module cục bộ `src/extensions/sdk.ts`: re-export
  `@directus/composables`, `defineInterface/Display/Layout/Module/Panel/OperationApp/OperationApi/Hook/Endpoint`
  (identity), `defineTheme` (identity, D-135), `getFieldsFromTemplate`, `getRelationType` của `@directus/utils`
  (`packages/extensions-sdk/src/index.ts:1-24`). Chunk entry dùng chung instance `vue`, `pinia`… với app (cùng module
  graph, như `shared-deps.ts:1-5` giải thích).
- Web nạp: `src/extensions.ts` port `app/src/extensions.ts` (`loadExtensions`: `import(/* @vite-ignore */
  `${getApiUrl()}extensions/sources/index.js`)` — Directus dùng `getRootPath()` cùng origin; app mới dùng URL API của
  `config.json` để chạy cả cross-site; lỗi → `console.warn("Couldn't load extensions")`; `registerExtensions(app)`;
  `onHydrateExtensions`/`onDehydrateExtensions`; `useExtensions()`; `useAllModules()`), gọi ở `main.ts` theo thứ tự
  Directus `main.ts:52-59`: `loadExtensions` → `registerShims(app)` (R8) → `registerExtensions(app)` → `useSystem(app)`
  → `app.use(router)` cuối cùng. `hydrate.ts:77` đổi `onHydrateModules()` thành `onHydrateExtensions()`.
- Cross-site/domain riêng: bundle tải từ origin API → `script-src` của CSP web phải có origin đó. `docker/csp.awk` thêm
  origin của `PUBLIC_URL` vào `script-src` khi `PUBLIC_URL` là URL tuyệt đối (web-image test mở rộng); dev `vite.config`
  không có CSP. API trả module với CORS của middleware `cors` (đã port) vì `import()` cross-origin cần
  `Access-Control-Allow-Origin`. Vite dev (`import.meta.env.DEV`): plugin cũng chèn import map ở `transformIndexHtml`
  (serve) với `/admin/@id/<dep>` [Unverified: T143 kiểm trên Vite 7; không được thì dev không nạp extension và ghi
  quickstart].
- Registry lúc chạy (FR-064): `interfaces/index.ts`, `displays`, `layouts`, `panels`, `operations` đổi mảng hằng thành
  mảng được `register<Type>(list)` thay sau khi nạp (giữ `get<Type>s()`/`get<Type>(id)` cho mọi chỗ đang gọi);
  `modules/index.ts` nhận danh sách nội bộ + extension (có `preRegisterCheck`); `composables/use-extension.ts` mở rộng
  cho mọi loại; `stores/insights.ts:21-32` đọc panel từ registry động; `system-modules/modules.ts:37-51`
  `useAllModules` lấy từ `extensions.ts` như Directus (`extensions.ts:84-91,109-111`), giữ `OUT_OF_SCOPE_MODULES`
  (D-130). Không đăng ký component toàn cục `interface-<id>`… (Directus `interfaces/index.ts:14-22`): app mới render
  bằng `<component :is>` từ registry (`FormFieldInterface.vue:37-44`, `RenderDisplay.vue:21,28`).
- CSP cho import map (release-gate CHK033): import map là script inline; `script-src 'self' 'unsafe-eval'` của image web
  chặn nó [Inference: HTML spec "prepare the script element" kiểm CSP inline cho mọi loại script; T143 kiểm bằng
  Playwright]. `docker/40-config.sh` đọc nội dung `<script type="importmap">` trong `index.html` lúc container khởi động,
  tính `sha256` (base64) và `csp.awk` thêm `'sha256-…'` vào `script-src`; không `'unsafe-inline'`. Dev Vite không có CSP.
- Shim nạp lười (release-gate CHK032): `main.ts` import động `directus-shim/register.ts` chỉ khi bundle có ít nhất một
  extension app (kiểm mảng export), nên app không có extension không tải shim; bundle chính thêm ≤ 3 KB gzip (loader +
  import map).
- Error boundary (FR-067): bọc `ErrorBoundary.vue` (đã có) ở `FormFieldInterface`, `RenderDisplay`, wrapper layout,
  tile panel, form option của `ExtensionOptions`, `RouterView` của module.

**Lý do**: import map tách build web khỏi build API (D-140 bỏ, owner 2026-10-21): tên chunk có hash giữ cache
`immutable` của 019; bundle giữ bare specifier nên chạy ở mọi origin; trình duyệt hỗ trợ (Chrome 89, Firefox 108,
Safari 16.4) nằm trong phạm vi VI.

**Phương án bỏ**: API đọc `dist/assets` của web như Directus (hai image riêng); manifest nhúng vào build API (D-140,
hỏng ở domain riêng vì import tuyệt đối `/admin/assets/...` resolve theo origin API); tên chunk cố định không hash
(mất `immutable`).

## R5. Sandbox

**Quyết định**: port nguyên 17 file `lib/sandbox/**`: entrypoint (`$0.deref()` export mặc định; hook → `filter`,
`action` qua host function; endpoint → `registerRoute(path, method, handler)` với router `get/post/put/patch/delete`
mount ở `/${name}`; operation → `registerOperation(id, handler)` = `flowManager.addOperation`), host reference
(`applySync`/`apply` với `copy: true`), `register/*` (kiểm `Reference.typeof`, `TypeError` cùng thông điệp;
`callReference` với `timeout = EXTENSIONS_SANDBOX_TIMEOUT`, `RangeError` → log "Extension sandbox has reached the memory
limit" + `process.abort()`), SDK `directus:api` (`log` cần scope `log`, `sleep` cần `sleep`, `request` cần `request` +
URL khớp `globToRegExp(scope)` + method trong `permissions.methods`; `getAxios()` của `request/index.ts:8`; `wrap`
trả `{result, error}` và ném lại trong isolate). `new ivm.Isolate({memoryLimit, onCatastrophicError → process.abort()})`,
`process.env` chỉ `NODE_ENV`, chỉ import `directus:api`. Mẫu ivm đã có ở `operations/exec/index.ts:28-64`.

**Lý do**: FR-020..FR-026; `isolated-vm` 5.0.3 đã có từ 009.

## R6. Sync từ `EXTENSIONS_LOCATION`, khóa theo máy, dòng `directus_extensions`

**Quyết định**: port `lib/sync/{sync,status,tracker,utils}.ts`:

- `syncExtensions({forceSync, partialSync, skipSync})`: trả ngay khi `skipSync`; không `forceSync` mà đang có file
  `.status` thì bỏ qua; `machineKey = extensions-sync/<sha256 machine-id>`; `lock.increment(machineKey)` (`Kv.increment`
  đã có, `INCRBY` trên `directus:lock:…`); process không phải số 1 chờ tin `{ready: true}` trên kênh cùng tên; copy từ
  `storage.location(EXTENSIONS_LOCATION)` prefix `EXTENSIONS_PATH` (so `modified`/`size`, `PQueue` 1000), xóa thư mục
  local không còn trên remote (`SyncFileTracker.cleanup`); `finally`: publish ready, `lock.delete`, `.status` IDLE.
  Đường dẫn local khi có `EXTENSIONS_LOCATION` là `TEMP_PATH/extensions` (`get-extensions-path.ts` đã port; `TEMP_PATH`
  mặc định `./node_modules/.directus`, trong image là `/directus/node_modules/.directus`, thuộc `node`).
- `machineId` trong container: `node-machine-id` 1.1.12 chạy `( cat /var/lib/dbus/machine-id /etc/machine-id || hostname
  ) | head -n 1` (`index.js:15`), image `node:22.23.3-alpine3.24` không có hai file đó (agent kiểm image OrbStack và
  container parity) → id = sha256(hostname = container id) → mỗi pod một khóa, mỗi pod tự sync. Không có chuyện một pod
  sync, pod khác đọc đĩa trống (Edge Cases của spec: giải tỏa).
- Khóa không có TTL (`UNLINK` khi xong): process chết giữa chừng rồi container cùng hostname khởi động lại (pod k8s giữ
  tên) → `increment` trả 2 → chờ mãi, pod không bao giờ ready. App mới chạy **một** process mỗi container (Directus chạy
  PM2 cluster nên mới cần khóa theo máy) → ở `initialize()` (`forceSync: true`) xóa khóa cũ của chính máy mình trước
  khi `increment`. Không ảnh hưởng Directus (khác hostname, khác khóa).
- `get-extensions-settings.ts`: port nguyên (dòng mới `enabled: true`, id registry tra qua `list({search: name})` của
  registry khi `MARKETPLACE_REGISTRY`, legacy rename theo tên package, bundle entries sync theo `enabled` của cha; dòng
  của extension đã biến mất **không** bị xóa dù comment nói ngược, giữ như Directus). `directus_extensions` không có
  unique `(source, folder)` (`migrations/20240204A-marketplace.ts:79-87`) nên N node khởi động cùng lúc có thể cùng chèn
  dòng cho một extension local mới → app mới bọc bước tạo dòng trong khóa Redis `extensions-settings` (`useLock`
  increment/delete, thử mỗi 250 ms tối đa 30 s; quá hạn: log cảnh báo "extensions settings lock timed out", xóa khóa
  (có thể kẹt do process chết khi giữ) và tạo dòng không khóa) và đọc lại dòng sau khi giữ khóa; không chặn được node
  Directus khởi động cùng lúc (R-58, "Cần xác nhận").
- Ràng buộc (release-gate CHK057): một process Node mỗi container (D-19 của 001); xóa khóa sync cũ lúc khởi động chỉ an
  toàn khi đó; PM2 hay nhiều process trong một container không hỗ trợ (ghi deploy README).

**Lý do**: FR-040..FR-043; khóa cũ và dòng trùng là hai lỗi thật khi chạy nhiều pod (US2).

**Phương án bỏ**: đặt TTL cho khóa (Kv không có `expire`, và Directus không đặt); bỏ khóa theo máy (khác Directus khi
có nhiều process).

## R7. Registry: cài, cài lại, gỡ; `/extensions`; GraphQL

**Quyết định**:

- `extensions/registry/download.ts` port `@directus/extensions-registry` `download(versionId, requireSandbox,
  {registry})` (GET `/version` rồi GET `/download/<id>[?sandbox=true]`, trả `ReadableStream`).
- `lib/installation/manager.ts` port: `TEMP_PATH/marketplace/<id>/bin.tar.tgz`, `tar.extract({file, cwd})`, đọc
  `package/package.json` + `ExtensionManifest.parseAsync`, ghi lên `EXTENSIONS_LOCATION` prefix
  `EXTENSIONS_PATH/.registry/<id>` khi có, `fs-extra.move` vào `<extPath>/.registry/<id>`; lỗi tải → 503
  `{service: 'marketplace', reason: 'Could not download the extension'}`, lỗi khác → 503 `{service: 'extensions', reason:
  'Failed to extract the extension or write it to storage'}`; `uninstall(folder)` xóa remote + local.
- `services/extensions.service.ts` thay bản rút gọn bằng port đủ `services/extensions.ts`: `preInstall` (`describe`
  không bắt lỗi → 500 như Directus; `LimitExceededError({category: 'Extensions'})` khi
  `manager.extensions.length + points >= EXTENSIONS_LIMIT`, `points = version.bundled.length ?? 1`), `install` (tạo dòng
  rồi `manager.install`, không transaction như Directus: dòng còn lại khi tải lỗi, R-59 "Cần xác nhận"), `uninstall`,
  `reinstall` (lỗi 400 `Cannot uninstall/reinstall extensions that were not installed via marketplace`, `… sub extensions of
  bundles separately`), `readAll` (chờ `isReloading()`; bundle entries thành `schema {name, type}` khi có trong
  `parent.schema.entries`), `readOne`, `updateOne` (transaction; `"meta" is required`; `checkBundleAndSyncStatus`: 422
  `Unable to toggle status of an entry for a bundle marked as non partial`; sau commit `reload().then(broadcast)` không
  chờ), `deleteOne` (xóa dòng + dòng con, không xóa file, không reload), `ExtensionReadError`.
- Controller: bỏ `NO_INSTALL` và các nhánh 503/403 (FR-036); `PATCH /:pk` (`ExtensionReadError` bọc Forbidden → 204);
  `DELETE /:pk`; `/sources/:chunk` trả chunk trong whitelist, luôn (không theo `SERVE_APP`), header `Content-Type:
  application/javascript; charset=UTF-8`, `Cache-Control` của `getCacheControlHeader(req, EXTENSIONS_CACHE_TTL, false,
  false)`, `Vary: Origin, Cache-Control`, body pipe stream.
- GraphQL `services/graphql/resolvers/system-admin.ts:299-322`: `update_extensions_item` gọi `updateOne` rồi `readOne`.
- `config/supported-variables.ts` thêm `EXTENSIONS_MUST_LOAD`, `EXTENSIONS_AUTO_RELOAD`, `EXTENSIONS_SANDBOX_MEMORY`,
  `EXTENSIONS_SANDBOX_TIMEOUT`, `EXTENSIONS_LIMIT`, `EXTENSIONS_ROLLDOWN`, `PACKAGE_FILE_LOCATION`; `SERVE_APP` vẫn
  cảnh báo (app mới không phục vụ app, bundle luôn dựng).
- GraphQL `directus_extensions.name: NonNull(String)` (`system-admin.ts:266`) mà `readAll` không trả `name`: truy vấn có
  `name` lỗi "Cannot return null for non-nullable field"; port nguyên, parity có ca này (release-gate CHK006).
- Giải nén: `tar.extract({file, cwd})` mặc định như Directus; node-tar mặc định bỏ `/` đầu và từ chối `..`
  (`preservePaths: false`) [Inference từ tài liệu tar 7]; unit test với tarball độc (đường dẫn tuyệt đối, `..`, symlink ra
  ngoài) xác nhận không ghi ra ngoài thư mục tạm; không checksum, không giới hạn kích thước (R-68).
- `request` của sandbox dùng `getAxios()` của 007 (`agentWithIpValidation`) nên `IMPORT_IP_DENY_LIST` áp như Directus.
- Quirk giữ như Directus (ghi R-60 "Cần xác nhận"): Directus app đếm `GET /extensions` (gồm dòng con) `>= limit` để khóa
  nút Install (`extension-install.vue:34-43`), server đếm extension cấp 1; `account.vue:43` dùng `Math.round` cho số
  trang.
- Gỡ D-37: hai entry trong `tests/parity/accepted-differences.ts:220-240`; sửa `tests/parity/src/system/extensions.test.ts:88-135`,
  `graphql/system.test.ts:151-163`, `tests/directus-app-e2e/src/system.spec.ts:243-283`,
  `controllers/extensions.controller.test.ts:163,205`.

**Lý do**: FR-031..FR-039; nguyên tắc III.

## R8. Shim: component, view, directive, inject, CSS (FR-073..FR-082)

**Quyết định** (cấu trúc; kiểm kê chi tiết ở `data-model.md` §7 khi báo cáo agent kiểm kê về):

- Thư mục `apps/web/src/directus-shim/`: `components/V<Name>.vue` (77), `views/{PrivateView,PublicView,SharedView}.vue`,
  `directives/*.ts` (7), `register.ts` (`registerShims(app)`: `app.component` với tên PascalCase của
  `app/src/components/register.ts` — Vue resolve cả kebab-case — và `app.directive`), `use-system.ts` port
  `composables/use-system.ts` (provide `STORES_INJECT` với 14 factory, `API_INJECT`, `SDK_INJECT`, `EXTENSIONS_INJECT`),
  `styles/theme-vars.css` (R9).
- Shim bọc `Bo*` khi có cặp (31): giữ đủ props/emits/slots/expose của Directus; phần `Bo*` thiếu thì **bổ sung vào
  `Bo*`** (prop thêm, mặc định giữ hành vi cũ, test 012–018 xanh) chứ không nhét logic vào shim. Thiếu nhiều nhất:
  `v-select` (23 prop), `v-button` (21), `v-input` (18), `v-menu` (18; slot `activator` ↔ `trigger` của `BoMenu`, D-127
  đã thêm `v-model:open`), `v-chip`, `v-checkbox`, `v-table` (`headers`/`items`/`itemKey`).
- Component chưa có (≈ 35: `VList*` 6, `VCard*` 5, `VTab/VTabItem/VTabsItems`, `VBreadcrumb`, `VBadge`, `VError`,
  `VHover`, `VHighlight`, `VImage`, `VIconFile`, `VItemGroup`/`VItem`, `VOverlay`, `VResizeable`, `VSheet`,
  `VSkeletonLoader`, `VTemplateInput`, `VFieldTemplate`, `VCollectionFieldTemplate`, `VEmojiPicker`, 3 `Transition*`,
  `SidebarDetail`) viết mới trên Reka UI + token theo recipe Q-44; `VEmojiPicker` dùng gói Directus dùng (kiểm T111).
- `PrivateView` shim bọc `layout/PrivateView.vue` (props `title, icon, iconColor, breadcrumb, back, tabTitle, fill`;
  slot `navigation`, `title`, `headline-append`, `title-append`, `actions`, `sidebar`): ánh xạ `show-back`/`back-to` →
  `back`, `headline` → `headline-append`, `title-outer:prepend/append`, `actions:prepend/append`, `splitView` theo Q-45;
  `sidebar` vào `DetailPanel` popover (D-128). `PublicView`, `SharedView` bọc `layout/PublicView.vue` và trang share 012.
- Inject: `useStores()` trả 14 factory (`useAppStore … useUserStore`, không `useFilesStore`); bổ sung thành viên thiếu
  (agent so hai bên): `notifications` thiếu `dialogs`, `queue`, `previous`, `notifications`, `overlayIsActive`,
  `lastFour`, `setOverlayIsActive`, `add`, `hide`, `remove`, `update` → `add` gọi `notify()` của `use-notices.ts` (notice
  tại chỗ, D-66; `NoticeRaw` mở rộng thêm `id`, `icon`, `closeable`, `showReload`, `progress`, `loading`,
  `alwaysShowText`, `dismissIcon`, `dismissText`, `dismissAction` để nút "Reload now" của store extensions chạy được);
  `server` thiếu kiểu `info.extensions`, `info.ai_enabled`/`mcp_enabled` (luôn `false`, D-17); `settings` thiếu
  `availableAiProviders` (trả `[]`, XI); `app` hydrate thiếu `basemap` (đặt như Directus `hydrate.ts:82`).
  `useApi()` = axios port `app/src/api.ts` (`axios.create({baseURL: getApiUrl(), withCredentials: true})`, `requestQueue`
  đã có ở `api/sdk.ts:14`, `onRequest` chờ slot + `sdk.getToken()`, `requestsStore.start/endRequest`); `useSdk()` =
  `sdk` của 012; `useExtensions()` = R4.
- Directive: port `app/src/directives/{click-outside,context-menu,focus,prevent-focusout,input-auto-width,markdown,
  tooltip}.ts`; `v-md` dùng `utils/markdown.ts` `md()` mở rộng tùy chọn `target` (readme marketplace dùng
  `v-md="{ value, target: '_blank' }"`); `v-tooltip` dùng cùng phần tử tooltip gắn vào `body` như Directus, style theo
  token.
- Contract test (FR-092): script `apps/web/scripts/extract-directus-components.mjs` dùng `@vue/compiler-sfc` (có qua
  `@vitejs/plugin-vue`) + `typescript` đọc `defineProps`/`withDefaults`/`defineEmits`/`defineExpose` và các `<slot
  name=…>` của từng SFC trong `directus/app/src/components`, `views`, `directives` → `fixtures/directus-components.json`
  (commit; test so lại với nguồn như `extract-directus-registry`); Vitest `directus-shim/contract.test.ts` so
  `props` (tên, kiểu, mặc định), `emits`, slot (quét template shim) của từng shim với JSON. Test browser + axe từng
  shim (FR-093).

**Lý do**: FR-075..FR-082; phương án A của owner.

**Phương án bỏ**: chép CSS Directus (D-136); đăng ký shim dưới tên khác và map lúc nạp bundle (extension dùng thẳng
`<v-input>` trong template đã compile).

## R9. `--theme--*` và class toàn cục (Q-46)

**Quyết định**: `directus-shim/styles/theme-vars.css` khai báo 45 biến `--theme--*` của `directus/packages/themes`
(danh sách ở `data-model.md` §8) dưới `:root` và `.dark` bằng `var(--color-brand-500)`… (ánh xạ có sẵn của 012 cho
`primary`, `background`, `foreground`; phần còn lại theo recipe Q-46) và class `.type-label`, `.type-note`,
`.type-text`, `.type-title`, `.form-grid` (+ `.full/.half/.half-left/.half-right/.fill`) chép cấu trúc từ
`_type-styles.scss` và `form-grid` với token. `theme_light_overrides`/`theme_dark_overrides` đè theo cơ chế 012.

**Phương án bỏ**: nạp theme Directus (`@directus/themes`, sinh biến lúc chạy; D-135).

## R10. Màn Settings > Extensions, Marketplace, store extensions

**Quyết định**: port `modules/settings/routes/extensions/*` (nhóm `groupBy(regular, 'schema.type')`, nhóm `undefined`
→ `missing`; `ExtensionItem` với chip version, trạng thái `enabled`/`disabled`/`partial`, link registry, bundle con
lồng; `extension-item-options` menu: `enable`/`disable` (bundle: `enable_all`/`disable_all`, partial: cả hai),
`uninstall` (khóa khi không phải `registry`), dòng `missing`: `reinstall`, `remove`; **không hộp xác nhận**, như
Directus), `marketplace/{registry,extension,account}.vue` + components (`InlineFilter`, `ExtensionListItem`,
`MetadataItem`, banner, readme `v-md`, metadata, install, compatibility bằng `semver`, sparkline apexcharts), store
`stores/extensions.ts` (`extensions`, `loading`, `error`, `extensionIds`, `refresh(force)`, `toggleState`, `install`,
`uninstall`, `reinstall`, `remove`; không hydrate, chỉ hai màn dùng), route ở `modules/settings.ts` (`settings-extensions`,
`marketplace`, `marketplace-registry`, `marketplace-account/:accountId`, `marketplace-extension/:extensionId`), mục
sub-menu `SettingsNavigation.vue` nhóm 4 (`storefront` marketplace, `category` extensions; gỡ D-93).

Sửa spec theo nguồn (agent 2026-10-21): Directus 11.17.4 **không** có chọn phiên bản (`latestVersion = versions.at(0)`,
`extension-metadata.vue:20`), **không** có nhãn sandbox ở app, **không** hộp xác nhận; FR-086, US6, Q-42, Q-43 bỏ ba
mục đó. "Reload required" sau bật tắt (store `refresh` so id extension app trước/sau) là snackbar persist với nút
"Reload now" ở Directus → app mới là notice tại chỗ persist với nút reload (D-66), cùng khóa i18n `reload_required`,
`extension_reload_required_copy`, `extension_reload_now`.

Khóa i18n: tất cả có trong `en-US.json` (trừ `page_help_marketplace_extension`, không dùng); 24 khóa thiếu ở `vi-VN.json`
(`disable_all`, `enable_all`, `enabled_dev_tooltip`, `extension_readme_missing`, `install_extension`, `installed`,
`manage`, `n_files`, `no_description`, `no_extensions`, `no_extensions_copy`, `open_in_marketplace`,
`partially_enabled`, `reached_maximum_number_of_extensions`, `reinstall`, `repository`, `search_extensions`,
`uninstall`, `uninstall_locked`, `verified`, `extension_panels`, `extension_themes`, `extension_operations`,
`settings_ai`/`settings_system_logs` không dùng) → `lang/overlay/vi-VN.ts` như 018 R10; `lang/keys.test.ts:11-21` thêm
thư mục mới. Test ghim D-93 phải đổi: `modules/settings.test.ts:76-83`, `SettingsNavigation.test.ts:26-37`,
`apps/web-e2e/src/settings-parity-ui.spec.ts:77-78`; `requests.spec.ts:43` (không gọi `/extensions`) đổi; allow-list
`allowed-paths.ts` và `KNOWN_REQUESTS` (`test-utils/fetch.ts:110`) thêm #204.. (018 kết thúc #203).

## R11. Bộ extension mẫu, parity, E2E, acceptance, benchmark

**Quyết định**:

- `tests/fixtures/extensions/` là workspace pnpm riêng (`@backoffice/extension-fixtures`, private) với
  `@directus/extensions-sdk` 17.1.4 devDependency; mỗi extension một package `src/` + `dist/` commit (build bằng
  `directus-extension build` như người dùng thật; test `fixtures-build.test.ts` build lại và so byte như các script
  sync). Tên khớp fixture của fake registry (`tests/parity/registry/fixtures/list.json`: `parity-interface-color`,
  `parity-display-badge`, `parity-operation-slack`, `parity-bundle-tools`, `parity-hook-audit`, id `e0000000-…-0001..5`)
  + thêm `parity-endpoint-demo`, `parity-layout-grid`, `parity-module-report`, `parity-panel-counter`, bản sandboxed
  `parity-hook-sandbox`, `parity-endpoint-sandbox`, `parity-operation-sandbox`, và `parity-endpoint-express4` (dùng
  cú pháp Express 4 để parity bắt D-139). Hook mẫu chỉ chạm collection riêng `bo_ext_items`, `bo_ext_log` (seed tạo) để
  không đổi kết quả các suite khác. Mỗi extension app dùng nhiều `v-*`, directive, `useApi`, `useStores`.
- Fake registry (`tests/parity/registry/server.mjs`) thêm `GET /download/:versionId[?sandbox=true]` trả tarball npm
  (`npm pack` của fixture, commit `.tgz` cùng `dist`).
- Parity env (`tests/parity/docker-compose.yml`, `env/*.env`): cặp chính (8155/8156) và `multi` (8157) đặt
  `EXTENSIONS_LOCATION=s3`; `minio-init` chép `tests/fixtures/extensions/dist/*` vào bucket `directus` prefix
  `extensions/` trước khi Directus khởi động (sync `forceSync` lúc khởi động nạp đủ). Profile mới `extensions`
  (cặp 10655/10656, `EXTENSIONS_PATH=./extensions-ext` để tách prefix, `EXTENSIONS_LIMIT=3`, `MARKETPLACE_TRUST=sandbox`)
  cho cài/cài lại/gỡ/limit và `EXTENSIONS_MUST_LOAD`; thêm ở bốn chỗ (compose, `ALL_PROFILES`, `compose()` của
  `docker.ts`, `profilePorts`) và README. Suite `tests/parity/src/extensions/{list,toggle,install,hooks,endpoints,
  operations,sources,graphql}.test.ts` vào `FULL_FILES` (`suite.ts:33-55`); so REST, GraphQL, DB (`directus_extensions`,
  `bo_ext_log`), log hook (grep container log). Cross-node: `multi` (BO 8156 + 8157 + Directus 8155): cài ở một node, ba
  node thấy (publish `extensions.reload` thật qua bus chung).
- E2E web: `settings-extensions.spec.ts`, `settings-marketplace.spec.ts`, `extensions-app-{interface,display,layout,
  panel,operation,module}.spec.ts` ở ba cấu hình; payload `payload/extensions.spec.ts` và bộ so DB
  `EXTENSIONS_TABLES = ['directus_extensions']` ở `proxy-api`; dùng chéo trên Directus app 8155 (cùng bộ extension qua
  `EXTENSIONS_LOCATION`). Cấu hình `cors`: csp.awk tự thêm origin API vào `script-src` (R4), không cần biến thêm.
- Acceptance (`tests/parity/src/deploy/extensions.test.ts`, FR-051): compose 3 BE + Directus với
  `EXTENSIONS_LOCATION=s3` (`.env.example`), fake registry thêm vào compose deploy chỉ khi `DEPLOY_EXTENSIONS_REGISTRY`
  (test bật); ca: cài qua Directus → `/parity-endpoint-demo` ở ba replica 200 trong 10 s; gỡ qua BE → 404 mọi node;
  tắt hook ở node A, tạo item qua node B không chạy hook; schedule 5 lượt = 5 lần (đếm `bo_ext_log`); `index.js` từ
  replica 1 và chunk nó import từ replica 2 cùng nội dung; scale 3 → 5 (`compose up --scale`) và gọi endpoint ngay khi
  healthy. Kind (`ci/kind-test.sh`): `deps.yaml` ConfigMap thêm `EXTENSIONS_LOCATION=s3` (kind có MinIO,
  `kind-test.sh:28`), bước cài qua Directus pod và gọi `/parity-endpoint-demo` qua Ingress; `test-template.sh` bộ
  `good` thêm `EXTENSIONS_LOCATION`, `expect_fail` khi thiếu với HPA bật.
- Benchmark: `tests/benchmark/src/web-extensions.ts` đo lần mở app đầu (ba APPS) với bộ extension mẫu, `webSlower`;
  gộp `signIn`/`track`/`p95`/`usual` thành module chung như ghi chú `shortcut:` ở `web-files-users.ts:174-175`; bước
  mới trong job `benchmark-web` với `if: ${{ !cancelled() }}`.

**Kết quả (T191, 2026-10-22)**, p95 Directus / Backoffice:

- SC-006, run 39717477240 (`a66d7916`, `benchmark-web`): mở app lần đầu với bộ extension mẫu: Directus app 1348 ms,
  web → Directus 976 ms, web → API 957 ms, đạt.
- SC-005, không extension: `benchmark` run 39722342806 (`bcb6d2c8`, kiểm tra `/extensions` rỗng ở hai app qua) đạt:
  `/server/ping` 30,6 / 25,6 ms, `/server/health` 311 / 277 ms, `/server/info` 217 / 203 ms, `/server/specs/oas`
  227 / 210 ms. `benchmark-auth`, `-permissions`, `-items`, `-history`, `-flows`, `-graphql` đạt ở run 39717477240.
  `benchmark-files` đỏ ở run đó (`files-list` user 426 / 560 ms), chạy lại run 39726413518 đạt (420 / 454 ms,
  `files-upload` 375 / 388 ms). Ba ca còn đỏ đã đỏ ở run 39167500790 (2026-10-18, `12b7246e`, trước 020) và các run
  ngày 19: `system` presets-list (646 / 948 ms), `schema` `user, no-store` (ca đỏ đổi theo từng run; lần này
  `/collections` 667 / 752 ms, `/relations` 567 / 771 ms), `web-files-users` "files: next page" web → Directus
  (89 / 126 ms; không đổi code web gọi Directus). 020 không thêm gì trên đường request của các ca này (chỉ
  `emitInit` lúc khởi động, router endpoint sau route Nest).
- Xử lý 2026-10-22 (owner): đo CPU/request (run 39755111256) cho thấy API mới tốn ít CPU hơn Directus và đọc Redis ngang
  nhau ở presets-list và dashboards-panels; ca đỏ là p95 đo ở ~90% tải. Tiêu chí đổi: CPU/request ≤ Directus +10% và
  p95 ở 50% req/s (FR-113 và R18 của spec 001).
- Web "files: next page" (owner 2026-10-22): bên đỏ đổi qua lại giữa web → Directus và web → API với cùng request, và
  chỉ hai bên web đi qua nginx. App Directus giờ đo qua `bench-proxy-directus-app` (8173, cùng cấu hình nginx) để ba
  bên chịu cùng một chặng mạng (`9ac42bdf`).
- Kết quả 2026-10-23 với tiêu chí mới: benchmark-system (run 39820055551) đạt 6/6, gồm presets-list; benchmark-schema
  (run 39823743161) còn đỏ `/collections` và `/relations` của user no-store vì p95 đo thời gian xử lý một loạt request
  dồn đầu mỗi giây. Owner chọn giãn đều request và thêm ngưỡng 10 ms (R18 của spec 001, sửa 2026-10-23).
- Run đầu lộ lỗi script: `run.ts` gọi `GET /extensions` không token (403 ở hai app), sửa ở `bcb6d2c8`.

**Lý do**: FR-090..FR-096, SC-001..SC-006.

## R12. Express 5 cho endpoint và hook `init` (D-139)

**Quyết định**: Router/app Express 5.2.1; `query parser` đã là hàm `qs.parse` chép từ Directus
(`app-pipeline.ts:40-45`) nên `req.query` giống Directus; `strict routing`/`case sensitive routing` Directus không đặt
(mặc định) → giữ mặc định. Danh sách D-139 (ghi vào spec; nguồn: `express@5.2.1` `lib/*.js`, `router@2.2.0`,
`path-to-regexp@8.4.2`; mục cú pháp path đã đo ở T042 bằng `parity-endpoint-express4(-path)` ngày 2026-10-21, kết quả
từng mục ở bảng D-139 của spec; khác dự kiến: `res.send(status)` trả 200 với body là số, không 500):

1. Cú pháp path (path-to-regexp 8): `*` phải có tên (`/*splat`), `?` và `+` sau param không còn, không regex trong
   chuỗi (`/:pk(uuid)`), nhóm tùy chọn viết `{/:param}`; `app.use('/x/*')` cũ ném lỗi khi đăng ký.
2. API đã bỏ: `req.param()`, `res.sendfile()` (còn `res.sendFile`), `app.del()`, `res.json(status, obj)`, `res.send(status)`,
   `res.redirect('back')`, `res.jsonp(status, obj)`.
3. `req.query` là getter chỉ đọc (`request.js:217`): gán `req.query = …` ném `TypeError`.
4. `req.host` giữ cả port (`request.js:405`); `req.body` `undefined` khi không có body parser (Directus `{}`).
5. Handler async bị reject được chuyển sang `next(err)` (`router/lib/layer.js:119-128`); Directus treo request.
6. `express.urlencoded` mặc định `extended: false`.

Hook `init` nhận `{ app }` là app Express 5 (cùng danh sách). `parity-endpoint-express4` dùng mục 1–3 để test parity
ghi nhận lỗi 500/404 có chủ đích (entry D-139 trong `accepted-differences.ts`).

**Phương án bỏ**: `express@4` alias cạnh 5 (owner từ chối, clarify B); chuyển đổi path tự động (không đủ tin cậy).

**Đổi 2026-10-21 (owner chọn cách 2)**: extension registry thật `dirserve` (route `/*`) không nạp trên Express 5 nên
endpoint chuyển sang Express 4.21.2: `express4` (alias `npm:express@4.21.2`) tạo một app với settings của Directus
(`trust proxy`, `query parser`), `req.body` mặc định `{}`; app đó được gắn như một middleware thường (không `use(app)`:
sự kiện `mount` của Express 4 làm request/response kế thừa của Express 5 và mất hàm riêng), đặt prototype Express 4
trước khi chạy (middleware query của Express 4 chạy trước `init`) và trả prototype cũ khi request ra khỏi app. Router
endpoint và router của sandbox (`register/route.ts`) là `express4.Router()`. Đo trên hai fixture và `dirserve`: mục 1–6
giống Directus. Hook `init` vẫn nhận app Express 5. `path-to-regexp` 0.1.12 của Express 4 override lên 0.1.13.

## R13. Nhiều instance, compose, Helm

**Quyết định**:

- Compose (`deploy/compose/.env.example`): `EXTENSIONS_LOCATION=s3` (prefix `extensions/` trong bucket `directus`,
  `EXTENSIONS_PATH` mặc định); `lb/shared-domain.conf`: thêm `upstream bo_pool` (chỉ `backoffice-api:8055 resolve`) và
  `location ^~ /extensions/sources/ { error_page 502 504 = @retry_bo; proxy_pass http://bo_pool; }` + `@retry_bo`;
  `separate-domain.conf` không đổi (`bo_pool` đã chỉ có BE). `deploy/README.md:91-102,122-130` thêm mục extension.
- Helm: Service mới `<release>-api-only` (selector `backoffice.selector` + `component: api`, không nhãn pool) và path
  Ingress `/extensions/sources` (Prefix) trước `/` trỏ tới nó; `_checks.tpl` thêm reason "EXTENSIONS_LOCATION is empty
  while api.replicas > 1 or autoscaling is on" trừ khi `extensions.inImage: true` (values, mặc định `false`); HPA bật
  mặc định nên `ci/deps.yaml` ConfigMap và bộ `good` của `test-template.sh` phải thêm `EXTENSIONS_LOCATION`; NOTES.txt
  dòng extension.
- Readiness (FR-048): `createApp` xong (gồm `initialize()` sync + nạp + dựng bundle) mới `listen` (`server.ts:29,169`),
  nên probe `/server/health` và `/server/ping` chỉ trả lời sau khi nạp xong; không cần cờ mới. Reload sau đó không chặn
  request, như Directus.
- Rollout: không còn ràng buộc cùng commit (D-140 bỏ); FR-049 giữ.

## R14. Ba lượt (Clarifications)

| Lượt | Nội dung | Mốc xanh |
|------|----------|----------|
| 1 | R1–R3, R5–R7 (trừ cài/gỡ: controller vẫn 503, entry D-37 thu hẹp còn `install`, `reinstall`, `uninstall`), R12, R13, Settings > Extensions chỉ đọc + bật tắt + notice "reload required" (`NoticeRaw` mở rộng chuyển từ R8 sang lượt 1), task đầu kiểm D-139 bằng `parity-endpoint-express4` và cập nhật bảng, parity `extensions` (trừ install), acceptance | `quality`, `parity`, `deploy`, `deploy-k8s` |
| 2 | Task đầu: hạ `pinia` 2.3.1 + chạy toàn bộ test web; R4 (gồm CSP hash), R8, R9, bộ extension app mẫu, E2E `extensions-app-*`, contract test, benchmark | + `e2e-web` |
| 3 | cài/cài lại/gỡ (API + Marketplace), fake registry download, profile `extensions`, gỡ hẳn D-37, D-93 | tất cả |

## Bảng kiểm 2026-10-21

| Điều | Kết quả | Cách kiểm |
|------|---------|-----------|
| `app-pipeline.ts` đã chép `query parser` qua `qs` | Có (`:40-45`) | đọc file |
| Express 5.2.1 mặc định `query parser` `simple`, nhận `extended` | Có (`lib/application.js:97`, `lib/utils.js:171-176`) | đọc node_modules |
| `req.query` getter, `req.host` getter, `res.sendFile`, `app.param` còn; `req.param`, `res.sendfile`, `app.del` không có | Có / không có | grep `lib/*.js` |
| Vite 7 dời importmap lên trước module script | Có (`chunks/config.js:24208-24213`) | grep vite |
| Image API: `pnpm deploy --prod` (bỏ devDependencies), `mkdir dist/extensions`, user `node` uid 1000 | Có (`Dockerfile:28-33,45`) | đọc file |
| CSP web đã có `script-src 'self' 'unsafe-eval'` | Có (`csp.awk:16`) | đọc file |
| Kind có MinIO | Có (`kind-test.sh:28`, `deps.yaml:93`) | grep |
| `tests/parity` có `@aws-sdk/client-s3` | Có (`package.json:12`) | grep |
| Fake registry không có `/download` | Đúng (`server.mjs:55-75`) | agent |
| `requests.spec.ts:43` cấm `/extensions` | Đúng | agent |
| `rolldown` musl binding | Có (Kết quả T001) | T001 |
| Import map trong Vite dev (`/@id/`) | [Unverified] | T143 |
| Cú pháp path-to-regexp 8 | [Unverified] theo README | T042 |

Chưa kiểm: không chạy mã nào, không build image; kiểm kê 77 component chờ báo cáo agent (bổ sung ở `data-model.md`).

## Kết quả T001 (2026-10-21)

- `rolldown` 1.0.0-beta.31 và `rollup` 4.59.0 nạp được trong `node:22.23.3-alpine3.24` linux/amd64 (binding musl có;
  `npm i` trong container, `import('rolldown')` trả hàm). Giữ `EXTENSIONS_ROLLDOWN`.
- `node-machine-id` 1.1.12 trong container alpine không có `/etc/machine-id`, `/var/lib/dbus/machine-id`: trả
  sha256(hostname) (khớp `echo -n $(hostname) | sha256sum`). Mỗi container một khóa sync (R6 đúng).
- Image `hiennd23/backoffice-api:local` (019): user `node` uid 1000 sở hữu `/directus`, `/directus/node_modules`,
  `/directus/extensions`; tạo được `node_modules/.directus/{extensions,app-extensions,marketplace}`.
- `pnpm audit --prod --audit-level=high` xanh. `tar` 7.5.8 (bản Directus) có 3 advisory mức moderate
  (GHSA-vmf3-w455-68vh, GHSA-w8wr-v893-vjvp, GHSA-gvwx-54wh-qm9j, sửa ở 7.5.16–7.5.18) → dùng **tar 7.5.19** (bản vá
  bảo mật, như joi 18.2.6 của 003; tar không quyết định định dạng dữ liệu dùng chung). Các gói mới khác không có
  advisory.
