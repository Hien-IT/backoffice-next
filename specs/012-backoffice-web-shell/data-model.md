# Data model: App web Backoffice (khung ứng dụng)

App web không có DB riêng. Mọi dữ liệu là kết quả của API Directus (đọc) và trạng thái phía client (Pinia,
localStorage). Kiểu dữ liệu lấy từ `@directus/sdk` / `@directus/types` 11.17.4 khi có; dưới đây chỉ ghi field app
dùng.

## 1. Trạng thái client (Pinia)

### `appStore` (`stores/app.ts`, chép từ `@directus/stores`)

| Field | Kiểu | Nguồn | Ghi chú |
|-------|------|-------|---------|
| `authenticated` | boolean | login/refresh/logout | |
| `hydrated`, `hydrating` | boolean | `hydrate()` | màn chờ khi `hydrating` |
| `accessTokenExpiry` | number (ms epoch) | `expires` của `/auth/login`, `/auth/refresh` | refresh trước 10 s |
| `error` | Error \| null | lỗi nạp | màn lỗi FR-003 |
| `navbarOpen`, `sidebarOpen`, `fullScreen` | boolean | UI | |

### `serverStore` (`GET /server/info`, `GET /auth?sessionOnly`)

`info.project`: `project_name`, `project_descriptor`, `project_logo` (uuid file), `project_color` (chuỗi CSS),
`default_language`, `default_appearance` (`light`|`dark`|`auto`), `default_theme_light`, `default_theme_dark`
(bỏ qua, D-43), `theme_light_overrides`, `theme_dark_overrides` (object), `public_foreground` (uuid),
`public_background` (`{ id, type }`), `public_favicon` (uuid), `public_note` (markdown), `custom_css`,
`public_registration` (boolean). `info.setupCompleted`, `info.websocket` (`false` → ẩn realtime), `info.version`.
`auth.providers[]`: `{ name, driver, icon?, label? }`; `auth.disableDefault`. `providerOptions` (computed, R6).

### `userStore` (`GET /users/me?fields=*,role.id`, `GET /policies/me/globals`, `GET /roles/me?fields=id`)

`currentUser`: `id`, `first_name`, `last_name`, `email`, `avatar` (`{ id }`), `language`, `appearance`,
`theme_light`, `theme_dark` (bỏ qua), `theme_light_overrides`, `theme_dark_overrides`, `last_page`, `tfa_secret`
(null hay chuỗi), `enforce_tfa`, `app_access`, `admin_access`, `role.id`, `roles[]`, `status`; hoặc `{ share, ... }`
cho user share. Computed `language` (user → `default_language` → `en-US`), `textDirection`.

### `settingsStore` (`GET /settings`)

`module_bar` (JSON: `[{ type: 'module', id, enabled } | { type: 'link', id, name, icon, url, enabled }]` hoặc null),
`project_url`, cùng các field branding (dự phòng khi `/server/info` thiếu).

### `permissionsStore` (`GET /permissions/me`)

`permissions`: `{ [collection]: { [action]: { access: 'none'|'partial'|'full', fields, ... } } }`; dùng cho
`preRegisterCheck` của module.

### `requestsStore`

`queue: string[]` (id request đang chạy), `queueHasItems` → thanh tiến trình ở logo.

### `notificationsStore` (`GET /notifications?filter[recipient][_eq]=$CURRENT_USER&filter[status][_eq]=inbox&...`)

`unread: number` (chỉ đếm ở 012).

### Store chỉ nạp (`collections`, `fields`, `relations`, `presets`, `translations`)

Giữ mảng kết quả `GET /collections`, `/fields`, `/relations`, `/presets?filter...`, `/translations` như Directus
để 013+ dùng; không có logic ở 012.

### `sidebarStore`, `navBarStore` (`layout/stores/`)

`collapsed` (localStorage `backoffice-sidebar-collapsed`), `size` (`backoffice-sidebar-size`, mặc định 333),
`navbarCollapsed`/`navbarSize` tương tự (`backoffice-navbar-*`).

## 2. Thực thể miền

### Phiên (session)

Cookie `directus_session_token` do API đặt (mode `session`); app không đọc được (HttpOnly). Trạng thái client:
`authenticated` + `accessTokenExpiry`. Vòng đời: `login` → `authenticated=true`, `expires` → `refresh` định kỳ →
`logout` (SIGN_OUT: gọi `/auth/logout`; SESSION_EXPIRED: không gọi) → `authenticated=false`, `dehydrate`.

### Provider xác thực

`{ name: string; driver: 'default'|'local'|'ldap'|'oauth2'|'openid'|'saml'; icon?: string; label?: string }`.
Phân loại: `providerOptions` (local + ldap, hiện ở `BoSelect`), SSO (`AUTH_SSO_DRIVERS`, hiện nút link).

### Module

```ts
interface ModuleDefinition {
  id: 'content'|'files'|'users'|'insights'|'activity'|'settings';
  name: string;        // '$t:content'...
  icon: string;        // Material Symbols name
  hidden?: boolean;    // activity
  routes: RouteRecordRaw[];
  preRegisterCheck?: (user: CurrentUser, permissions: Permissions) => boolean;
}
```

`registeredModules` (shallowRef) = module qua `preRegisterCheck`; thanh module = `module_bar` (hoặc
`MODULE_BAR_DEFAULT`) lọc `enabled` và có trong `registeredModules`, cộng Settings cuối cho admin.

### Ngôn ngữ

`Language = 'en-US' | 'vi-VN' | <mã khác trong available-languages>`; `messages[lang]` = JSON sinh (R4) + overlay;
`loadedLanguages: string[]`. `setLanguage(lang)`: nạp JSON, `i18n.global.locale = lang`, `html[lang]`, `GET
/translations?filter[language][_eq]=<lang>&limit=-1` → `mergeLocaleMessage`, locale date-fns.

### Theme

```ts
type Appearance = 'auto' | 'light' | 'dark';
interface ThemeState {
  appearance: Appearance;          // user → settings → 'auto'
  darkMode: boolean;               // appearance giải theo prefers-color-scheme khi auto
  lightOverrides: Record<string, unknown>;  // merge(settings.theme_light_overrides, user.theme_light_overrides)
  darkOverrides: Record<string, unknown>;
}
```

Áp: `html.class = darkMode ? 'dark' : 'light'`; `<style id="theme-overrides">` sinh từ `override-map.ts` (R2) cho
`:root` (sáng) và `:root.dark` (tối); `:root { --project-color: <project_color> | var(--eh-color-action-primary) }`.

### Hồ sơ (form `/users/me`)

| Field | Kiểu | Validation client | API |
|-------|------|-------------------|-----|
| `first_name`, `last_name` | string \| null | — | `PATCH /users/me` |
| `email` | string | định dạng email (HTML `type=email`) | `PATCH /users/me` (lỗi `RECORD_NOT_UNIQUE` dịch) |
| `password` | string | không rỗng khi gửi; không hiện giá trị cũ | `PATCH /users/me` chỉ khi nhập |
| `avatar` | uuid file \| null | file ảnh | `POST /files` (multipart) rồi `PATCH /users/me { avatar }` |
| `language` | mã ngôn ngữ \| null | trong `available-languages` | `PATCH /users/me` |
| `appearance` | `auto`\|`light`\|`dark` \| null | enum | `PATCH /users/me` |
| `theme_light_overrides`, `theme_dark_overrides` | JSON \| null | JSON hợp lệ (parse) | `PATCH /users/me` |

Chỉ field đã đổi được gửi (diff với `currentUser`). Lỗi `FAILED_VALIDATION` gắn vào field theo
`extensions.field`.

## 3. localStorage / sessionStorage (tiền tố `backoffice-`)

| Key | Giá trị | Tương ứng Directus |
|-----|---------|--------------------|
| `backoffice-require_tfa_setup` | id user | `directus-require_tfa_setup` |
| `backoffice-sidebar-collapsed`, `backoffice-sidebar-size` | boolean, number | `sidebar-collapsed`, `sidebar-size` |
| `backoffice-navbar-collapsed`, `backoffice-navbar-size` | boolean, number | nav-bar store |
| `backoffice-sso-provider` | tên provider | localStorage trong `sso-links.vue` |
| `sso_otp_attempted` (sessionStorage) | `'1'` | giữ nguyên tên (Cần xác nhận) |

Không lưu token, email hay mật khẩu.

## 4. Cấu hình lúc chạy

`config.json`: `{ apiUrl: string }` (001). `apiUrl` là base của SDK và của `getAssetUrl`, link SSO. Không có biến
mới.
