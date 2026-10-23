# Contract: Web (bundle, import map, SDK, shim, Settings)

## 1. Nạp bundle

- URL: `${apiUrl}extensions/sources/index.js` (`apiUrl` của `config.json`, tuyệt đối khi cross-site), `import(/* @vite-ignore */ …)`
  ở `main.ts` trước `registerShims` → `registerExtensions` → `useSystem` → `app.use(router)`.
- Lỗi tải: `console.warn("Couldn't load extensions")`, app chạy không extension.
- Module export: `interfaces`, `displays`, `layouts`, `modules`, `panels`, `operations`, `themes` (mảng).
- CSP (image web, `docker/csp.awk`): `script-src 'self' 'unsafe-eval' 'sha256-<hash import map>' <origin của PUBLIC_URL
  khi tuyệt đối>`; hash tính lúc container khởi động từ `index.html` (`40-config.sh`); API trả module với CORS (`cors`
  middleware, cùng cấu hình SDK cross-site của 012).
- Shim: `directus-shim/register.ts` import động chỉ khi bundle có ít nhất một extension app; app không extension không
  tải shim.

## 2. Import map (`index.html`, sinh lúc build)

```html
<script type="importmap">{"imports":{
  "vue":"/admin/assets/vue.<hash>.entry.js",
  "vue-router":"/admin/assets/vue-router.<hash>.entry.js",
  "vue-i18n":"/admin/assets/vue-i18n.<hash>.entry.js",
  "pinia":"/admin/assets/pinia.<hash>.entry.js",
  "@directus/extensions-sdk":"/admin/assets/extensions-sdk.<hash>.entry.js"}}</script>
```

Đứng trước mọi `<script type="module">`/`modulepreload`. Plugin Vite `backoffice-extensions-build`: `rollupOptions.input`
thêm 5 entry (tên entry bỏ npm scope rồi `/`→`_`, nên `@directus/extensions-sdk` là `extensions-sdk`, D-177; trước 2026-10-24 là `@directus_extensions-sdk`), `entryFileNames: 'assets/[name].[hash].entry.js'`, `preserveEntrySignatures: 'exports-only'`,
`generateBundle` (post) chèn import map vào asset `index.html`. Dev: `transformIndexHtml` chèn import map trỏ
`/admin/@id/<dep>` [T143].

## 3. Module `@directus/extensions-sdk` (`src/extensions/sdk.ts`)

Export: `useApi`, `useSdk`, `useStores`, `useExtensions`, `useCollection`, `useItems`, `useLayout`, `useSync`,
`useFilterFields`, `useSizeClass`, `sizeProps`, `useElementSize`, `useCustomSelection`, `useCustomSelectionMultiple`,
`useGroupable`, `useGroupableParent`, `useShortcut`, `keyMap`, `systemKeys`, `translateShortcut`, `useSystem`,
`createLayoutWrapper`, `isWritableProp` (từ `@directus/composables` 11.4.1); `defineInterface`, `defineDisplay`,
`defineLayout`, `defineModule`, `definePanel`, `defineOperationApp`, `defineOperationApi`, `defineHook`,
`defineEndpoint`, `defineTheme` (identity); `getFieldsFromTemplate`, `getRelationType` (`@directus/utils`).

## 4. Inject (`useSystem(app)`)

| Khóa | Giá trị |
|------|---------|
| `'stores'` | 14 factory (data-model §5) |
| `'api'` | axios instance: `baseURL = getApiUrl()`, `withCredentials: true`, interceptor request (`requestsStore.startRequest`, chờ `requestQueue`, `await sdk.getToken()`), response/error (`endRequest`) — port `app/src/api.ts` |
| `'sdk'` | `sdk` của `api/sdk.ts` |
| `'extensions'` | `useExtensions()` |

## 5. Đăng ký toàn cục (`registerShims(app)`)

- 77 component với tên PascalCase của `directus/app/src/components/register.ts` (data-model §7); 3 view
  `PublicView`, `PrivateView` (async), `SharedView`.
- 7 directive: `click-outside`, `context-menu`, `focus`, `prevent-focusout`, `input-auto-width`, `md`, `tooltip`.
- `index.html`: `#dialog-outlet`, `#menu-outlet`.
- CSS: `directus-shim/styles/theme-vars.css` (173 `--theme--*` + biến thường + `.type-*`, `.form-grid`).

## 6. Registry lúc chạy

| Registry | Hàm | Dùng bởi |
|----------|-----|----------|
| `interfaces/index.ts` | `registerInterfaces(list)`, `getInterfaces()`, `getInterface(id)` | `FormFieldInterface`, `SystemInterface`, `ExtensionOptions`, chọn interface Data Model |
| `displays/index.ts` | `registerDisplays`, `getDisplays`, `getDisplay` | `RenderDisplay`, chọn display |
| `layouts/index.ts` | `registerLayouts`, `getLayouts`, `getLayout` | `use-layout.ts`, chọn layout Content |
| `panels/index.ts` | `registerPanels`, `getPanels`, `getPanel` | `stores/insights.ts`, `PanelConfiguration` |
| `operations/index.ts` | `registerOperations`, `getOperations`, `getOperation` | `OperationDetail`, canvas flows |
| `modules/index.ts` | `registerModules(list)` → `{registeredModules, onHydrateModules, onDehydrateModules}` | `AppSidebar`, `system-modules` (`useAllModules`) |
| `extensions.ts` | `loadExtensions`, `registerExtensions(app)`, `onHydrateExtensions`, `onDehydrateExtensions`, `useExtensions`, `useAllModules` | `main.ts`, `hydrate.ts` |

Mọi chỗ render extension bọc `ErrorBoundary` (FR-067).

## 7. Store `extensions` và màn Settings

API gọi (thêm vào `allowed-paths.ts`, `KNOWN_REQUESTS` từ #204):

| # | Method | Path | Màn |
|---|--------|------|-----|
| 204 | GET | `/extensions` | Extensions, Marketplace (chip installed) |
| 205 | PATCH | `/extensions/:id` | Extensions (toggle) |
| 206 | DELETE | `/extensions/:id` | Extensions (remove missing) |
| 207 | DELETE | `/extensions/registry/uninstall/:id` | Extensions |
| 208 | POST | `/extensions/registry/reinstall` | Extensions (missing) |
| 209 | POST | `/extensions/registry/install` | Marketplace extension |
| 210 | GET | `/extensions/registry` | Marketplace registry, account |
| 211 | GET | `/extensions/registry/extension/:id` | Marketplace extension |
| 212 | GET | `/extensions/registry/account/:id` | Marketplace account |
| 213 | GET | `/extensions/sources/index.js` (+ chunk) | khởi động app |
| — | GET | `/server/info` (đã có) | limit, version |

Route: `settings-extensions` (`/settings/extensions`), `marketplace` → `marketplace-registry` (`''`),
`marketplace-account` (`account/:accountId`), `marketplace-extension` (`extension/:extensionId`); `preRegisterCheck`
admin của module settings; sub-menu nhóm 4: `storefront` `marketplace`, `category` `extensions`.

Notice "reload required" (D-66): `notify({id: 'reload-required', type: 'warning', persist: true, title:
t('reload_required'), text: t('extension_reload_required_copy'), dismissIcon: 'refresh', dismissText:
t('extension_reload_now'), dismissAction: () => window.location.reload(), alwaysShowText: true})` khi tập id extension
app bật đổi sau `refresh`.

## 8. i18n

Khóa Directus đã có trong `en-US.json`; overlay `vi-VN.ts` thêm 23 khóa (research R10); `lang/keys.test.ts` thêm thư
mục `modules/settings/routes/extensions`, `modules/settings/routes/marketplace`, `directus-shim`.
