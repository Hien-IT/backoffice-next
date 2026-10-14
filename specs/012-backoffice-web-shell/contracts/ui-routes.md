# Contract: route và bố cục của app web

Base path `/admin/` (Vite `base`, `createWebHistory('/admin/')`). Mọi route public dùng `PublicView`; route private
dùng `PrivateView` (thanh module, nav, header, main, sidebar). Nguồn: `directus/app/src/router.ts`, `modules/*/index.ts`.

## 1. Route public (`meta.public = true`)

| Path | Tên | Thành phần | Hành vi |
|------|-----|------------|---------|
| `/` | — | redirect | `setupCompleted` ? `/login` : `/setup` |
| `/setup` | `setup` | `SetupRoute` | đã setup → `/login`; form admin đầu tiên → `POST /server/setup` → `login` |
| `/login` | `login` | `LoginRoute` | props `logoutReason` (`?reason=`), `ssoErrorCode` (`?error&code=`); `?continue` → refresh rồi vào app; `?redirect=` nội bộ |
| `/reset-password` | `reset-password` | `ResetPasswordRoute` | không token: form email (`POST /auth/password/request`) + dòng `contact_admin_for_link`; `?token=`: form mật khẩu (`POST /auth/password/reset`) |
| `/accept-invite` | `accept-invite` | `AcceptInviteRoute` | `?token=`: email từ payload JWT (khóa), mật khẩu, `POST /users/invite/accept`; dòng `contact_admin_for_link` khi lỗi token |
| `/register` | `register` | `RegisterNotAvailableRoute` | trang "chưa có sẵn" + link `/login` (D-44, 015 thay form) |
| `/logout` | `logout` | `LogoutRoute` | `logout({ reason: SIGN_OUT })`, vòng chờ |
| `/shared/:id(uuid)` | `shared` | `SharedRoute` | `GET /shares/info/:id`; form mật khẩu nếu `password`; `POST /shares/auth` (`mode: session`) → refresh → `/content/<collection>/<item>` (khung) |

## 2. Route private

| Path | Tên | Thành phần | Điều kiện |
|------|-----|------------|-----------|
| `/tfa-setup` | `tfa-setup` (`meta.track=false`) | `TfaSetupRoute` | ép khi `enforce_tfa && tfa_secret === null` hoặc localStorage `backoffice-require_tfa_setup === user.id`; có `tfa_secret` → `last_page` |
| `/content`, `/content/:pathMatch(.*)*` | module `content` | `ModulePlaceholder` | mọi user app |
| `/files`, `/files/:pathMatch(.*)*` | module `files` | `ModulePlaceholder` | admin hoặc đọc `directus_files` |
| `/users/me` | `users-me` | `ProfileRoute` | mọi user app |
| `/users`, `/users/:pathMatch(.*)*` | module `users` | `ModulePlaceholder` | admin hoặc đọc `directus_users` |
| `/insights`, `/insights/:pathMatch(.*)*` | module `insights` | `ModulePlaceholder` | admin hoặc đọc `directus_dashboards` |
| `/activity`, `/activity/:pathMatch(.*)*` | module `activity` (`hidden`) | `ModulePlaceholder` | mọi user app |
| `/settings` | module `settings` | redirect `/settings/data-model` | admin |
| `/settings/:pathMatch(.*)*` | module `settings` | `ModulePlaceholder` | admin |
| `/:_(.+)+` | `private-404` | `PrivateNotFoundRoute` | đã đăng nhập; chưa thì guard về `/login?redirect=` |

`ModulePlaceholder`: `PrivateView` với `title = $t(module.name)`, `icon = module.icon`, nội dung là empty state
`module_placeholder` (chuỗi overlay) nêu feature kế tiếp. Tiêu đề tab `<title> · <project_name || Backoffice>`.

## 3. Guard (`onBeforeEach`, chép từ Directus)

1. Lần đầu: `refresh({ navigate: false })` bỏ qua lỗi.
2. `serverStore.info.project === null` → `serverStore.hydrate()`; lỗi → `appStore.error` (màn lỗi).
3. `!setupCompleted` → `/setup` (trừ khi đang ở đó).
4. Route không public: chưa `hydrated` → nếu `authenticated` thì `hydrate()` rồi tiếp (`/tfa-setup` với user đã
   có `tfa_secret` → `last_page`), không thì `/login?redirect=<fullPath>`.
5. Đã hydrate, user không phải share: ép `/tfa-setup` (bảng trên).
6. `onAfterEach`: route private không `track=false` → `trackPage` sau 500 ms (`PATCH /users/me { last_page }`).

## 4. Bố cục `PrivateView`

```
┌──────┬───────────────┬──────────────────────────────┬──────────┐
│Module│ NavBar        │ HeaderBar (icon, title, acts)│ Sidebar  │
│Bar   │ ProjectName   ├──────────────────────────────┤ (gập mở)│
│logo  │ <slot nav>    │ <slot default>               │ <slot>   │
│mods  │               │                              │          │
│avatar│               │                              │          │
└──────┴───────────────┴──────────────────────────────┴──────────┘
```

- Breakpoint (như `BREAKPOINTS` Directus): `lg` 57.625rem (922 px), `xl` 72rem (1152 px). ≥ `xl`: ba cột; `lg`
  đến `xl`: sidebar gập mặc định; 768 px đến `lg`: nav là drawer (nút ở header), sidebar drawer. Không cuộn ngang.
- `ModuleBar`: `ModuleBarLogo` (link `project_url`, thanh tiến trình khi `queueHasItems`), nút module (icon +
  tooltip, `aria-current="page"` khi active), `ModuleBarAvatar` (menu: `$t:profile` → `/users/me`, `$t:sign_out`
  → `/logout`).
- `SkipMenu`: liên kết "tới nội dung", "tới điều hướng" hiện khi focus.
- `NoAppAccess`: khi `currentUser.app_access === false`: thông điệp + nút đăng xuất.

## 5. `PublicView`

Cột trái (max 28.125rem): khối logo (`project_logo` từ `/assets/<id>` hoặc `logo-light.svg`/`logo-dark.svg` theo
theme; nền `project_color` nếu có), `project_name || 'Backoffice'`, `project_descriptor || $t('application')`, slot
nội dung, slot `notice`. Cột phải: `public_background` (ảnh `background-image` hoặc `<video autoplay muted loop>`)
hoặc hoa văn token; `public_foreground` ảnh; `public_note` markdown (`marked` + `dompurify`).

## 6. Head (`useHead`, như `app.vue`)

- `title`: tiêu đề trang; `titleTemplate` `%s · %projectName`; `projectName = project_name ?? 'Backoffice'`.
- `style`: `:root { --project-color: <project_color ?? var(--eh-color-action-primary)> }` + overrides theme (R2).
- `meta`: `theme-color`, `msapplication-TileColor` = `project_color ?? <giá trị tính của --eh-color-action-primary>`.
- `link[rel=icon]`: `/assets/<public_favicon>` → `generateFavicon(project_color, !project_logo)` → `/admin/favicon.ico`.
- `htmlAttrs`: `lang`, `dir`, `class` `dark|light`. `bodyAttrs` không dùng (Tailwind variant bám `html.dark`).
- `custom_css` chèn `<style id="custom-css">`.
