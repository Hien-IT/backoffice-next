# Data model: Extensions (020)

Kiểu lấy từ `@directus/types` 15.0.3 (`Extension`, `ApiOutput`, `ExtensionSettings`, `HookConfig`, `EndpointConfig`,
`OperationApiConfig`, `AppExtensionConfigs`) hoặc chép từ `directus/packages/extensions` và `directus/api/src/extensions`
sang `@backoffice/extensions`, `@backoffice/types` (research R2). Bảng DB duy nhất là `directus_extensions` (đã có,
không đổi cấu trúc).

## 1. Extension (manifest) và ba nguồn

| Thực thể | Trường | Ghi chú |
|----------|--------|---------|
| `ExtensionManifest` (`package.json`) | `name`, `version`, `directus:extension { type, path (string hoặc {app, api}), source, host, hidden?, sandbox? {enabled, requestedScopes {request? {urls[], methods[]}, log?, sleep?}}, entries? (bundle), partial? }` | zod `shared/schemas/manifest.ts`; `host` bắt buộc; manifest sai → load lỗi (`handleExtensionError`) |
| `Extension` (đã resolve) | `path`, `name`, `version`, `host`, `type`, `entrypoint` (`string` hoặc `{app, api}`), `local` (module), `sandbox?`, `entries?` (`{name, type}[]`), `partial?` | `getExtensionDefinition` |
| Map theo nguồn | `local: Map<folder, Extension>` (`EXTENSIONS_PATH` hoặc `TEMP_PATH/extensions`), `registry: Map<versionId, Extension>` (`<path>/.registry`), `module: Map<packageName, Extension>` (`PACKAGE_FILE_LOCATION/package.json` dependencies) | `manager.extensions` = local, registry, module |
| Loại nạp | `hook`, `endpoint` (api); `operation` (hybrid: `entrypoint.api` + `.app`); `interface`, `display`, `layout`, `module`, `panel` (app); `bundle` (entries); `theme` liệt kê, không nạp (D-135) | |

## 2. Dòng `directus_extensions` (`ExtensionSettings`)

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| `id` | uuid | registry: id trên marketplace (tra `list({search: name})` khi `MARKETPLACE_REGISTRY`); khác: `randomUUID()` |
| `enabled` | boolean | dòng mới `true`; entry bundle mới theo cha |
| `folder` | string | local: tên thư mục; registry: versionId; module: tên package; entry bundle: `entry.name` |
| `source` | `'module' \| 'registry' \| 'local'` | |
| `bundle` | uuid \| null | id dòng cha của entry |

Luồng: `getExtensionsSettings()` lúc load (R6): chèn dòng thiếu (trong khóa Redis `extensions-settings` giữa các node
Backoffice, R-58), sync entries của bundle, legacy rename theo tên package; không xóa dòng của extension đã mất.
`updateOne(id, {enabled})`: bundle cha → mọi con; con → cha bật nếu có con bật; cha `partial === false` → 422.
`deleteOne(id)`: xóa dòng + dòng con. `install`: dòng cha + dòng con (bundle) rồi tải; `uninstall`: xóa dòng rồi xóa file.

## 3. `ApiOutput` (`GET /extensions`, GraphQL `extensions`)

```ts
{ id: string; bundle: string | null;
  meta: { id, enabled, folder, source, bundle };
  schema: Partial<Extension> | { name: string; type: ExtensionType } | null }   // null: thư mục không còn trên đĩa ("missing")
```

Entry bundle chỉ xuất hiện khi cha có trong output và `entry.name` nằm trong `parent.schema.entries`.

## 4. Context, event, tin reload, khóa

| Thực thể | Hình dạng |
|----------|-----------|
| `context` của hook/endpoint/operation | `{ services, env, database: Knex, emitter: Emitter (riêng của extension), logger, getSchema }`; `services` = namespace `apps/api/src/services/index.ts` + `MailService` (log) (D-141) |
| `register` của hook | `{ filter(event, handler), action(event, handler), init(event, handler), schedule(cron, handler), embed('head'\|'body', code \| () => string) }` |
| Endpoint | `(router: express.Router (Express 5), context) => void` hoặc `{ id, handler }`; mount `/<id>` |
| Operation (api) | `{ id, handler(options, context) }` → `flowManager.addOperation(id, handler)` |
| Event init | `app.before`, `middlewares.before`, `middlewares.after`, `routes.before`, `routes.custom.before`, `routes.custom.after`, `routes.after`, `app.after` với `{ app }` (research R3) |
| Action của manager | `extensions.load {extensions}`, `extensions.unload {extensions}`, `extensions.reload {extensions, added: string[], removed: string[]}`, `extensions.installed {extensions, versionId}`, `extensions.uninstalled {extensions, folder}` |
| Tin bus `extensions.reload` | `{ forceSync?: boolean, partialSync?: string, origin: processId }` trên namespace `REDIS_BUS_NAMESPACE ?? 'directus:bus'`; người nhận bỏ `origin` của mình, chỉ chuyển `forceSync` (boolean) và `partialSync` (string) |
| Tin bus `extensions-sync/<machineId>` | `{ ready: true }` |
| Khóa Redis | `directus:lock:extensions-sync/<sha256 machine-id>` (INCRBY/UNLINK; app mới xóa khóa cũ của máy mình lúc khởi động), `directus:lock:extensions-settings` (mới, R6), `directus-sync:clock:<tên extension>:<index>:<cron>` (schedule, có sẵn) |
| File trạng thái sync | `<extensionsPath>/.status` (rỗng khi SYNCING, xóa khi IDLE) |
| Bundle app | `TEMP_PATH/app-extensions/<chunk>`; `appExtensionChunks[0]` = `index.js`; chunk khác phải trong danh sách |
| Isolate sandbox | `{ memoryLimit: EXTENSIONS_SANDBOX_MEMORY, timeout: EXTENSIONS_SANDBOX_TIMEOUT }`; import duy nhất `directus:api` → `{ log, sleep, request }` theo `requestedScopes`; `request` trả `{status, statusText, headers, data}` |
| Tarball registry | `TEMP_PATH/marketplace/<versionId>/bin.tar.tgz` → `package/` → `<extPath>/.registry/<versionId>` (+ storage `EXTENSIONS_PATH/.registry/<versionId>` khi `EXTENSIONS_LOCATION`) |

## 5. Web: registry, store, import map, inject

| Thực thể | Hình dạng |
|----------|-----------|
| `extensions: RefRecord<AppExtensionConfigs>` (`src/extensions.ts`) | `{ interfaces, displays, layouts, modules, panels, operations, themes }` mỗi cái `shallowRef([])`; nội bộ + extension, đã `translate` theo locale; `themes` luôn rỗng (D-135) |
| Registry tĩnh đổi thành có `register*` | `interfaces/index.ts`: `registerInterfaces(list)`, `getInterfaces()`, `getInterface(id)` (tương tự displays, layouts, panels, operations); `modules/index.ts`: `registerModules(list)` giữ `registeredModules`, `onHydrateModules`, `onDehydrateModules` |
| Bundle app | `${apiUrl}extensions/sources/index.js` export `interfaces[]`, `displays[]`, `layouts[]`, `modules[]`, `panels[]`, `operations[]`, `themes[]` |
| Import map (`index.html`) | `{"imports": {"vue": "/admin/assets/vue.<hash>.entry.js", "vue-router": …, "vue-i18n": …, "pinia": …, "@directus/extensions-sdk": "/admin/assets/extensions-sdk.<hash>.entry.js"}}` (tên file từ 2026-10-24, D-177; trước là `@directus_extensions-sdk.<hash>.entry.js`) (base `/admin/`) |
| Module `@directus/extensions-sdk` (`src/extensions/sdk.ts`) | re-export `@directus/composables` 11.4.1 (`useApi, useSdk, useStores, useExtensions, useCollection, useItems, useLayout, useSync, useFilterFields, useSizeClass, useElementSize, useCustomSelection, useGroupable, useGroupableParent, useShortcut, useSystem, createLayoutWrapper, translateShortcut, keyMap, systemKeys, sizeProps, isWritableProp`), `defineInterface/Display/Layout/Module/Panel/OperationApp/OperationApi/Hook/Endpoint/Theme` (identity), `getFieldsFromTemplate`, `getRelationType` |
| Inject (`directus-shim/use-system.ts`) | `'stores'` → `{ useAppStore, useCollectionsStore, useFieldsStore, useFlowsStore, useInsightsStore, useNotificationsStore, usePermissionsStore, usePresetsStore, useRelationsStore, useRequestsStore, useServerStore, useSettingsStore, useTranslationsStore, useUserStore }`; `'api'` → axios (`src/api/axios.ts`); `'sdk'` → `sdk` 012; `'extensions'` → `useExtensions()` |
| Store `extensions` (`stores/extensions.ts`, id `extensions`) | state `extensions: ApiOutput[]`, `loading`, `error`; computed `extensionIds`; actions `refresh(forceRefresh = true)` (so id extension app bật trước/sau → notice persist "reload required" với nút reload, D-66), `toggleState(id)` (`PATCH /extensions/:id {meta: {enabled: !enabled}}`), `install(extensionId, versionId)` (`POST /extensions/registry/install`), `uninstall(id)` (`DELETE /extensions/registry/uninstall/:id`), `reinstall(id)` (`POST /extensions/registry/reinstall {extension: id}`), `remove(id)` (`DELETE /extensions/:id`); mỗi action `await refresh()`; không hydrate |
| Thành viên store bổ sung (FR-079) | notifications: `queue`, `dialogs`, `previous`, `notifications`, `overlayIsActive`, `lastFour`, `setOverlayIsActive`, `add(raw) → id` (`notify`), `hide`, `remove`, `update`; `NoticeRaw` thêm `id?`, `icon?`, `closeable?`, `showReload?`, `progress?`, `loading?`, `alwaysShowText?`, `dismissIcon?`, `dismissText?`, `dismissAction?`; server: `info.extensions?: {limit: number \| null}`, `info.ai_enabled: false`, `info.mcp_enabled: false`; settings: `availableAiProviders: []`; app: `basemap` |
| `useExtension(type, id)` | mọi loại, đọc từ `extensions` |

## 6. Màn Settings

| Màn | Route | Dữ liệu |
|-----|-------|---------|
| Extensions | `settings-extensions` `/settings/extensions` | store `extensions`; `regular` (`bundle === null`) nhóm theo `schema.type` (`undefined` → `missing`, thứ tự API); con của bundle = entries có `bundle === cha.id`; dòng: tên `schema.name ?? meta.folder`, chip `schema.version`, trạng thái `enabled`/`disabled`/`partial` (bundle có con bật không đủ), link marketplace khi `source === 'registry' && !bundle`; menu: enable/disable (bundle: `_all`; partial: cả hai), uninstall (chỉ registry), missing: reinstall (registry), remove; `stateLocked` chỉ khi `import.meta.env.DEV` và loại app; icon loại: interface `design_services`, display `label`, layout `dataset`, module `web`, panel `analytics`, theme `palette`, hook `webhook`, endpoint `api`, operation `flowsheet`, bundle `hub`, missing `warning` |
| Marketplace registry | `marketplace-registry` `/settings/marketplace` | query `page` (1), `search`, `type`, `sort` (`popular`/`recent`/`downloads`) qua `useRouteQuery`; đổi search/sort/type → page 1; `GET /extensions/registry?search&limit=10&offset&filter[type][_eq]&sort` → `meta.filter_count`, `data[]` (`id, name, description, type, publisher {username, github_name, verified}, total_downloads, last_updated, license, sandbox`); `ceil(filter_count / 10)` trang; chip `installed` khi `extensionIds` có id |
| Marketplace extension | `marketplace-extension` `/settings/marketplace/extension/:extensionId` | `GET /extensions/registry/extension/:id` → `{ id, name, description, readme, type, versions[{version, host_version, publish_date, file_count, unpacked_size, bundled[], license, maintainers}], publisher, downloads[], total_downloads, homepage, repository, bugs }`; `latestVersion = versions[0]`; cài `POST /extensions/registry/install {extension, version}`; khóa nút khi `extensions.length >= serverStore.info.extensions.limit` (R-60); tương thích `semver.satisfies(info.version, host_version)` |
| Marketplace account | `marketplace-account` `/settings/marketplace/account/:accountId` | `GET /extensions/registry/account/:id` (`username, github_name, github_avatar_url, github_bio, github_location, github_company, github_blog, verified`) + `GET /extensions/registry?limit=6&offset&filter[by][_eq]`; số trang `Math.round` (R-60) |

## 7. Kiểm kê shim 77 component (FR-075, FR-076)

Nguồn: báo cáo agent 2026-10-21 đọc `directus/app/src/components/register.ts` và từng SFC (props, emits, slot, expose
đầy đủ nằm ở `fixtures/directus-components.json` sinh bởi script R8; bảng này chỉ ghi cách làm). Cách làm: **bọc** =
shim bọc `Bo*` sẵn có và map tên; **mở rộng** = thêm prop/slot/emit vào `Bo*` (mặc định giữ hành vi cũ) rồi bọc;
**mới** = viết mới trên Reka UI + token (recipe Q-44); **cùng hợp đồng** = re-export, chỉ đổi tên đăng ký.

| # | `v-*` | Backoffice | Cách làm | Phải bắc cầu |
|---|-------|------------|----------|--------------|
| 1 | VAvatar | `BoAvatar` (avatarId/name) | mới | hợp đồng khác hẳn: slot default, `tile`, `round`, `border` (string → `--v-avatar-border-color`), 4 cỡ, `clickable` (root `button`) |
| 2 | VBadge | — | mới | `value`, `dot`, `left`, `bottom`, `icon`, `bordered`, `disabled`; dùng cho badge số (Q-38 có) |
| 3 | VBreadcrumb | `PageHeader` nhận `breadcrumb` nhưng không vẽ (D-101) | mới | `items[{to, name, disabled, icon}]` → `RouterLink` |
| 4 | VButton | `BoButton` (`variant`) | mở rộng + bọc | map `kind`/`secondary`/`warning`/`danger` → `variant`; thêm `autofocus`, `rounded`, `outlined`, `icon` (boolean), `active`/`exact`/`query`/`value` (item-group), `dashed`, `tile`, `align`, `download`, `target`, `href`, 4 cỡ, `tooltip`; emit `click` (không khi loading); slot `prepend-outer`, `loading`, `append-outer`, default `{active, toggle}`; `useGroupable({group: 'item-group'})` |
| 5–8 | VCardActions, VCardSubtitle, VCardText, VCardTitle | — | mới (template) | `VCardTitle` root `.type-label` |
| 9 | VCard | — | mới | `disabled`, `tile` |
| 10 | VCheckbox | `BoCheckbox` (boolean), `BoCheckboxGroup`, `BoSwitch` | mở rộng + bọc | model `boolean \| string[] \| null` với `value`; `indeterminate` (+ `update:indeterminate`), `iconOn/Off/Indeterminate`, `block`, `customValue` (+ input, `update:value`, `blur:custom-input`), `autofocusCustomInput`, `nonEditable`, `checked`; slot `prepend`, default, `append` |
| 11 | VCheckboxTree | `BoCheckboxTree` | mở rộng + bọc | `search` (prop thay ô tìm nội bộ), `showSelectionOnly`, `nonEditable`, `openGroups`; `group-toggle` trả `GroupableInstance`; mặc định `[]` |
| 12 | VChip | `BoChip` (`text`) | mở rộng + bọc | default slot thay `text`; `active`/`update:active` (unmount khi tắt), `close`/`closeIcon` → `removable`, emit `close(event)`, `click`, `outlined`, `label`, `clickable`, 4 cỡ |
| 13 | VDetail | `BoDetail` (`title`) | mở rộng + bọc | `label` → `title`; model `undefined` = tự quản + `startOpen`; slot `activator {active, enable, disable, toggle}`, `title` |
| 14 | VDialog | `BoDialog` (title bắt buộc, `v-model:open`) | mới (Reka Dialog, cùng phần của BoDialog) | không tiêu đề; `placement` left/right/center, `persistent` (Esc không đóng), `keepBehind`, `applyShortcut` (`apply` emit), `keepMounted`, `esc`; slot `activator {on}`; focus trap; `#dialog-outlet` thêm vào `index.html` |
| 15 | VDivider | `BoDivider` | mở rộng + bọc | `large`, slot `icon`, default bọc `.type-text` |
| 16 | VError | inline ở `CollectionRoute.vue` | mới | `error` → hộp mã + message |
| 17 | VFancySelect | `BoFancySelect` | mở rộng + bọc | `itemText`, `itemValue`, `itemDescription`, mục `{divider: true}` |
| 18 | VFieldTemplate | `SystemDisplayTemplate` (khác) | mới | `tree`, `loadPathLevel`, `depth`, `nullable`, chip sửa được; `v-model` |
| 19 | VCollectionFieldTemplate | như 18 | mới (trên 18) | `collection`, `placeholder`, `disabled` |
| 20 | VFieldList | `FieldList` | cùng hợp đồng | — |
| 21 | VForm | `BoForm` | mở rộng + bọc | `inline`; `collabContext` nhận và bỏ qua (D-141); interface từ registry động |
| 22 | VHover | — | mới | slot default `{hover}`, `openDelay`, `closeDelay`, `tag` |
| 23 | VHighlight | inline (`NotificationItem`, `RolesCollectionRoute`) | mới (rút từ inline) | `query`, `text` |
| 24 | VIcon | `BoIcon` (`size`) | mở rộng + bọc | `filled`, `sup`, `left`, `right`, `disabled`, `clickable` (+ `click`), `color` (`--v-icon-color`), 4 cỡ → `size`; RTL đảo icon theo `textDirection`; 20 icon custom + social đã có |
| 25 | VImage | — | mới | `src` bắt buộc, `inheritAttrs: false` → `<img>` |
| 26 | VIconFile | inline ở `Card.vue` | mới (rút) | `ext` |
| 27 | VInfo | `BoInfo` | mở rộng + bọc | `center`, `type: 'primary'` |
| 28 | VInput | `BoInput` | mở rộng + bọc | `nonEditable`, `clickable` (+ `click`), `prefix`/`suffix`, `fullWidth`, `nullable` (null khi rỗng), `slug`/`slugSeparator`, `hideArrows`/`min`/`max`/`step` (nút tăng giảm, `Number` cho type number), `active`, `dbSafe`, `trim`, `small`, `integer`, `float`, `maxLength`; emit `keydown`, `focus`, `keydown:space`, `keydown:enter`; slot `prepend-outer`, `prepend`, `input`, `append`, `append-outer` (`{value, disabled}`); `inheritAttrs: false` (attrs → input, class → root) |
| 29 | VItemGroup | — | mới (`useGroupableParent`, scope `item-group`) | `mandatory`, `max`, `multiple`, `v-model` |
| 30 | VItem | — | mới (`useGroupable`) | `value`, `scope`, `active`, `watch`; slot `{active, toggle}` |
| 31 | VListGroup | inline (`FolderPicker`, `ContentNavigation`) | mới | `multiple`, `to`, `active`, `exact`, `query`, `disabled`, `clickable` (+ `click`), `scope`, `value`, `dense`, `open`, `collapseOnChange`, `arrowPlacement`; slot `activator {active}`, default (`ul`) |
| 32–34 | VListItemContent, VListItemHint, VListItemIcon | — | mới (template) | `center` |
| 35 | VRemove | `BoRemove` | mở rộng + bọc | `button` (nút chữ thay icon) |
| 36 | VListItem | — | mới (`useGroupable` scope `v-list`) | `block`, `grow`, `dense`, `to`/`href`/`download` (RouterLink/a/button/li), `disabled`, `nonEditable`, `clickable`, `active`, `dashed`, `exact`, `query`, `value`, `nav`, `activator`; emit `click` |
| 37 | VList | inline ul/li | mới (`useGroupableParent`) | `v-model`, `nav`, `dense`, `multiple`, `mandatory`, `scope`; emit `toggle` |
| 38 | VMenu | `BoMenu` (items) | mới trên `BoPopover` (component dùng chung mới, Reka Popover; Q-44) | slot `activator`/default `{toggle, active, activate, deactivate}`; `placement` (Popper) → `side`/`align`; `closeOnClick`, `closeOnContentClick`, `attached`, `showArrow`, `arrowPlacement`, `arrowPadding`, `disabled`, `trigger` (`hover`/`click`/`keyDown`), `delay`, `offsetX/Y`, `fullHeight`, `seamless`, `keepBehind`, `noFocusReturn`, `invert`; expose `{activator, id, activate, deactivate}` (directive `context-menu` dùng); `#menu-outlet` thêm vào `index.html` |
| 39 | VDrawer | `BoDrawer` | mở rộng + bọc | `sidebarResizeable`, `sidebarLabel`; `applyShortcut` undefined → `meta+enter`; slot đã đủ (thêm `title:prepend` của Bo không ảnh hưởng) |
| 40 | VNotice | `BoNotice` | mở rộng + bọc | `center`, `multiline`, `indentContent`, `icon: false` ẩn, slot `title` |
| 41 | VOverlay | Reka overlay bên trong dialog | mới | `active`, `absolute`, `clickable` (+ `click`), slot default khi active |
| 42 | VPagination | `BoPagination` (`label` bắt buộc, ẩn khi ≤ 1 trang) | mở rộng + bọc | `label` mặc định `$t('pagination')`; `totalVisible` undefined → không nút trang; `showFirstLast` mặc định `false`; hiện cả khi 1 trang |
| 43 | VProgressCircular | `BoProgressCircular` | mở rộng + bọc | 4 cỡ, slot default, emit `animationiteration` |
| 44 | VProgressLinear | `BoProgressLinear` | mở rộng + bọc | `absolute`, `bottom`, `fixed`, `rounded`, `top`, `colorful`, slot `{value}`, `animationiteration` |
| 45 | VRadio | `BoRadio` (nhóm `items`) | mới (một radio) | `value`, `v-model`, `label`/slot `label`, `disabled`, `nonEditable`, `iconOn/Off`, `block` |
| 46 | VResizeable | `SplitPanel` (khác) | mới | `width`, `minWidth`, `maxWidth`, `defaultWidth`, `disabled`, `options {snapZones, alwaysShowHandle, disableTransition}`; emit `update:width`, `dragging`, `transitionEnd`; kéo chuột (như Directus) + bàn phím trên tay cầm (XII) |
| 47 | VSelect | `BoSelect`, `BoMultiSelect`, `BoCombobox` | mở rộng (`BoSelect` thêm `children`/nhóm, divider, `itemColor`, `itemIcon`) + bọc theo mode | `item*` key mapping, `multiple`, `groupSelectable` (+ `group-toggle`), `mandatory`, `fullWidth`, `nonEditable`, `showDeselect` (→ `update:modelValue(null)`), `allowOther` (→ `BoCombobox`), `closeOnContentClick`, `inline`, `attached`, `showArrow`, `label`, `allItemsTranslation`, `itemCountTranslation`, `multiplePreviewThreshold`, `placement`, `menuFullHeight`; slot `preview`, `prepend`, `append` |
| 48 | VSheet | — | mới (template) | — |
| 49 | VSkeletonLoader | inline animate-pulse | mới | 7 `type` |
| 50 | VSlider | `BoSlider` | mở rộng + bọc | `nonEditable`, `showThumbLabel`, `showTicks`, `alwaysShowValue` mặc định `true`, model mặc định `0`; emit `change`; slot `prepend`, `thumb-label type-text` (tên slot có dấu cách, giữ nguyên), `append` |
| 51, 52, 54, 55 | VTabItem, VTab, VTabsItems, VTabs | `BoTabs` (một component) | mới (4 component, groupable `v-tabs`, `v-tabs-items`, provide `v-tabs-vertical`) | model mảng `(string\|number)[]`, `vertical`, `disabled`; slot `{active, toggle}` |
| 53 | VTable | `BoTable` (`columns`/`rows`/`rowKey`) | mở rộng + bọc | map `headers`→`columns` (`{text, value}`→`{label, key}`), `items`→`rows`, `itemKey`→`rowKey`, `update:headers`/`update:items`, slot `header.<value>`/`item.<value>` (`{header}`/`{item}` ↔ `{column}`), `header-context-menu`; thêm `selectionUseKeys` (Directus mặc định chọn **object dòng**; shim đổi khóa ↔ object), `inline`, `clickable`, emit `item-selected`, slot `footer`, `rowHeight` 48, `manual-sort` |
| 56 | VTemplateInput | — | mới (contenteditable) | `captureGroup`, `triggerCharacter`, `items`, `multiline`, `placeholder`; emit `trigger`, `deactivate`, `up`, `down`, `enter` |
| 57 | VTextarea | `BoTextarea` | mở rộng + bọc | `nonEditable`, `autofocus`, `fullWidth`, `nullable`, `expandOnFocus`, `trim`; slot `prepend`, `append`; attrs → textarea |
| 58 | VTextOverflow | `BoTextOverflow` (title) | mở rộng + bọc | `highlight`, `placement`; tooltip qua directive `v-tooltip` khi bị cắt |
| 59 | VUpload | `BoUpload` | mở rộng + bọc | emit `start(controller)`, expose `abort`; shim tự mở `DrawerFiles` khi `fromLibrary` và dialog URL khi `fromUrl` (Bo phát `library`) |
| 60 | VDatePicker | `BoDatePicker` | cùng hợp đồng (+ `timezone` của Bo không bắt buộc) | — |
| 61 | VEmojiPicker | — | mới | emit `emoji-selected`; thư viện như Directus (kiểm T005) |
| 62 | VWorkspace | `BoWorkspace` | mở rộng + bọc | `resizable`, slot default `{tile, gridSize}` (vẽ tile mặc định), 6 emit (`update`, `move`, `delete`, `duplicate`, `edit`, `preview`); `inject('main-element')` |
| 63 | VWorkspaceTile | `BoWorkspaceTile` | mở rộng + bọc | `color`, `note`, `preview` emit, `resizable` mặc định `true`; `AppTile` type |
| 64 | VErrorBoundary | `ErrorBoundary` | cùng hợp đồng | — |
| 65–67 | TransitionBounce, TransitionDialog, TransitionExpand | — | mới | CSS bằng token (`--transition`, `--medium`); `TransitionExpand` port `expand-methods.ts` (8 emit) |
| 68 | RenderDisplay | `RenderDisplay` | cùng hợp đồng | registry động |
| 69 | RenderTemplate | `RenderTemplate` | cùng hợp đồng | registry động |
| 70 | ExportSidebarDetail | `ExportSidebarDetail` | cùng hợp đồng | — |
| 71 | SidebarDetail | `SidebarDetail` | cùng hợp đồng | trong popover `DetailPanel` (D-128); không tooltip rail |
| 72 | UserPopover | `UserPopover` | cùng hợp đồng | — |
| 73 | ValueNull | `ValueNull` | cùng hợp đồng | — |
| 74 | DrawerCollection | `DrawerCollection` | mở rộng + bọc | chuyển mọi slot của caller tới drawer (Bo chỉ `sidebar`) |
| 75 | DrawerFiles | `DrawerFiles` | cùng hợp đồng (Bo có thêm `active`) | — |
| 76 | DrawerItem | `DrawerItem` | mở rộng + bọc | `overlay` (`modal`, `popover` → Directus ép `drawer`: nhận và bỏ qua), `popoverProps`, `version`; `preventCancelWithEdits` mặc định `false` |
| 77 | DrawerBatch | `DrawerBatch` | cùng hợp đồng | — |

Prop "nhận rồi bỏ qua" được phép (FR-076; contract test có danh sách `IGNORED` kèm lý do, vẫn kiểm tên/kiểu/mặc định):
`DrawerItem.overlay` khi khác `drawer` (Directus cũng ép `drawer`), `DrawerItem.popoverProps`, `VForm.collabContext`
(D-141), `VDrawer.sidebarResizeable` nếu recipe Q-45 không cho đổi cỡ sidebar drawer.

Tổng: cùng hợp đồng 13; mở rộng + bọc 30; mới 34 (gồm `BoPopover` dùng chung, dialog không tiêu đề, 4 component tab,
9 list/item-group). Thêm vào `apps/web/index.html`: `<div id="dialog-outlet"></div>`, `<div id="menu-outlet"></div>`
(Teleport của extension viết cho Directus).

Component không đăng ký toàn cục ở Directus (không shim): `PrivateViewHeaderBarActionButton`, `select-list-item`,
`table-row`, `v-drawer-header`, `form-field*`.

### View (FR-073, FR-074)

| View | Props | Slot | Shim |
|------|-------|------|------|
| `PrivateView` | `title`, `icon`, `iconColor`, `showBack`, `backTo`, `sidebarShadow`, `showHeaderShadow`; `inheritAttrs: false` (chỉ `class`) | `navigation`, `title-outer:prepend` (chỉ khi không `showBack`/`icon`), `title-outer:append`, `title:prepend`, `title:append`, `title`, `headline`, `actions:prepend`, `actions`, `actions:append`, `sidebar`, default; `provide('main-element')` | bọc `layout/PrivateView.vue`: `showBack`/`backTo` → `back`; `headline` → `headline-append`; `title-outer:append` → `title-append`; thêm `title-outer:prepend`, `title:prepend`, `title:append`, `actions:prepend`, `actions:append` vào `PageHeader` (mở rộng); `provide('main-element')` = phần tử cuộn của `MainContent`; `sidebar` → `DetailPanel` bọc `AccordionRoot` (SidebarDetail cần) |
| `PublicView` | `wide` | default, `notice` | bọc `layout/PublicView.vue` + `wide` |
| `SharedView` | `title`, `inline` | `title` (mặc định `h1.type-title` với `title` hoặc `$t('share_access_page')`), default | mới trên `PublicView` (BO dùng PublicView cho trang share) |

Không có ở Directus 11.17.4: slot `splitView`, inject `sidebar-open` (spec FR-074 đã sửa).

### Directive (FR-078)

| Directive | Giá trị | Arg / modifier | Shim |
|-----------|---------|----------------|------|
| `click-outside` | handler hoặc `{handler, middleware, events = ['pointerdown'], disabled}` | — | port; listener trên `document.documentElement`, `composedPath()` |
| `context-menu` | tên template ref có expose `activate`, `deactivate`, `id` (VMenu) | — | port; `contextmenu` → `activate`; `pointerdown` ngoài menu → `deactivate` |
| `focus` | truthy `focus()`, falsy `blur()` | — | port |
| `prevent-focusout` | boolean | — | port (`focusout` preventDefault + stopPropagation) |
| `input-auto-width` | — | — | port (shadow div đo `scrollWidth`) |
| `md` | string hoặc `{value, target}` | — | `md(value, {target})` của `utils/markdown.ts` (mở rộng tùy chọn `target`) |
| `tooltip` | string (falsy = không) | arg placement `top/bottom/left/right`; modifier `top/right/bottom/left/start/end/instant/inverted/monospace` | port với một `#tooltip` chung gắn `body`, delay 500 ms (125 ms khi disabled), RTL theo `textDirection`, style bằng token (z-index theme) |

## 8. `--theme--*` (FR-080, Q-46)

Quy tắc tên: `--theme--` + đường dẫn trong rules nối bằng `--`, camelCase → kebab (`rules-to-css-vars.ts`, đã port ở
`apps/web/src/theme/rules-to-css-vars.ts`). 173 tên theo schema `ThemeSchema`, chia nhóm; shim khai báo tất cả dưới
`:root` và `html.dark` trong `directus-shim/styles/theme-vars.css`, giá trị là `var(--color-*)`/`var(--text-*)`… của
theme TailAdmin theo recipe Q-46 (ánh xạ sẵn của 012 cho `primary`, `background`, `foreground`, `danger` giữ):

| Nhóm | Số | Tên |
|------|----|-----|
| Gốc | 12 | `border-radius`, `border-width`, `foreground`, `foreground-subdued`, `foreground-accent`, `background`, `background-normal`, `background-accent`, `background-subdued`, `border-color`, `border-color-accent`, `border-color-subdued` |
| Màu | 20 | `primary`, `secondary`, `success`, `warning`, `danger` × `''`, `-background`, `-subdued`, `-accent` |
| Font | 8 | `fonts--{display,sans,serif,monospace}--{font-family,font-weight}` |
| Navigation | 30 | `navigation--{background,background-accent,border-width,border-color}`, `navigation--project--{background,foreground,font-family,border-width,border-color}`, `navigation--modules--{background,border-width,border-color}`, `navigation--modules--button--{foreground,foreground-hover,foreground-active,background,background-hover,background-active}`, `navigation--list--icon--{foreground,foreground-hover,foreground-active}`, `navigation--list--{foreground,foreground-hover,foreground-active,background,background-hover,background-active,font-family}`, `navigation--list--divider--{border-color,border-width}` |
| Header | 9 | `header--{background,border-width,border-color,box-shadow}`, `header--headline--{foreground,font-family}`, `header--title--{foreground,font-family,font-weight}` |
| Form | 17 | `form--{column-gap,row-gap}`, `form--field--label--{foreground,font-family,font-weight}`, `form--field--input--{background,background-subdued,foreground,foreground-subdued,border-color,border-color-hover,border-color-focus,box-shadow,box-shadow-hover,box-shadow-focus,height,padding}` |
| Sidebar | 34 | `sidebar--{background,foreground,font-family,border-width,border-color}`, `sidebar--section--toggle--icon--{foreground,…-hover,…-active}`, `sidebar--section--toggle--{foreground,…-hover,…-active,background,…-hover,…-active,font-family,border-width,border-color}`, `sidebar--section--form--{column-gap,row-gap}`, `sidebar--section--form--field--label--{foreground,font-family,font-weight}`, `sidebar--section--form--field--input--{12 như form}` |
| Public | 24 | `public--{background,foreground,foreground-accent}`, `public--art--{background,primary,secondary,speed}`, `public--form--{column-gap,row-gap}`, `public--form--field--label--{3}`, `public--form--field--input--{12}` |
| Popover | 3 | `popover--menu--{background,border-radius,box-shadow}` |
| Banner | 16 | `banner--{background,padding,border-radius}`, `banner--avatar--{background,foreground,border-radius}`, `banner--headline--{foreground,font-family,font-weight}`, `banner--title--{3}`, `banner--subtitle--{3}`, `banner--art--foreground` |

Thêm 11 tên app Directus dùng mà theme không khai (`--theme--banner--foreground`, `--theme--banner--foreground-subdued`,
`--theme--card--shadow`, `--theme--foreground-normal`, `--theme--form--field--input--foreground-accent`,
`--theme--form--field--input--line-height`, `--theme--form--field--input--opacity-disabled`,
`--theme--popover--menu--foreground`, `--theme--primary-75`, `--theme--primary-foreground`, `--theme--shadow`) và các
biến thường của `_variables.scss` extension hay dùng: `--transition`, `--fast`, `--medium`, `--slow`,
`--header-bar-height`, `--content-padding`, `--input-height-md/lg/xl`, `--focus-ring-*`, bảng màu
`--{purple,pink,blue,green,yellow,orange,red,primary,secondary,success,warning,danger}{,-10,-25,-50,-75,-90,-110,-125,-150,-175,-190}`,
`--foreground-inverted`, `--background-inverted`, `--background-normal-alt`, `--background-highlight`, `--background-input`,
`--background-subdued`, `--overlay-color`, `--shadow-color`. Class: `.type-title` (1rem, display font, `foreground-accent`),
`.type-label` (0.875rem, label font), `.type-text` (0.8125rem), `.type-note` (0.75rem, italic, `foreground-subdued`),
`.form-grid` (2 cột `[start] minmax(0,1fr) [half] minmax(0,1fr) [full]`, gap `--theme--form--row-gap`/`--column-gap`,
`container-type: inline-size`, con `.full/.half/.half-left/.half-right/.half-space/.fill`, `.with-fill`, mốc 31.25rem).

## 9. Bộ extension mẫu (FR-090; danh sách chuẩn)

Fake registry (`tests/parity/registry/fixtures/{list,describe}.json`) có sẵn `…0001..0005`; thêm các mục `…0006..0013`
cho extension cần cài qua marketplace trong test, kèm tarball ở `GET /download/:versionId`. `parity-endpoint-express4` có
một route cho mỗi mục D-139.

| Package (`tests/fixtures/extensions/<name>`) | Loại | Dùng | Registry id |
|-----|------|------|-------------|
| `parity-hook-audit` | hook | `filter('items.create')` thêm `audited: true` cho `bo_ext_items`; action ghi `bo_ext_log` chỉ khi request có header `x-bo-ext-trace` hoặc chạm `bo_ext_*`; `init('routes.custom.before')` header `x-bo-ext: 1`; `schedule('* * * * *')` ghi `bo_ext_log {kind: 'tick'}` chỉ khi env `BO_EXT_SCHEDULE=1` (profile `extensions`); `embed('head', '<!-- parity -->')` | `…0005` |
| `parity-endpoint-demo` | endpoint | `GET /` `{ok: true, accountability: req.accountability?.user}`, `POST /echo` body | mới `…0006` |
| `parity-endpoint-express4` | endpoint | `router.get('/items/:id?')`, `router.use('/x/*')`, `req.param('id')`, `res.sendfile` (D-139) | `…0007` |
| `parity-operation-slack` | operation (api + app) | `handler({ text })` trả `{ sent: text }`; app: `options` 1 field | `…0003` |
| `parity-interface-color` | interface | `v-input`, `v-select` (nhóm), `v-menu`, `v-tooltip`, `useApi().get('/server/info')`, `useStores().useUserStore()` | `…0001` |
| `parity-display-badge` | display | `v-chip`, `v-icon` | `…0002` |
| `parity-layout-grid` | layout | `useItems`, `useLayout`, `v-table` (`selectionUseKeys` tắt), `v-pagination` | `…0008` |
| `parity-module-report` | module | `private-view` (navigation, actions, sidebar với `sidebar-detail`), `v-list`, `v-breadcrumb`, `v-dialog`, `preRegisterCheck` admin | `…0009` |
| `parity-panel-counter` | panel | `v-progress-circular`, options component tùy biến | `…0010` |
| `parity-bundle-tools` | bundle | 1 interface + 1 hook + 1 operation (entries), `partial: true` | `…0004` |
| `parity-hook-sandbox`, `parity-endpoint-sandbox`, `parity-operation-sandbox` | sandboxed | `request` tới `http://files-fixtures:80/...` (scope), `log`, `sleep`; một bản quá bộ nhớ/thời gian/URL ngoài scope bật bằng options | `…0011..0013` |

Build bằng `directus-extension build` 17.1.4 (commit `dist/` + `.tgz` cho fake registry); `src/` giữ để đọc.
Collection mẫu `bo_ext_items`, `bo_ext_log` do `apps/web/fixtures/interfaces/seed.mjs` tạo (dùng chung seed 013).
