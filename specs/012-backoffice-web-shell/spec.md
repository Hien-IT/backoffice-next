# Feature Specification: App web Backoffice (khung ứng dụng, đăng nhập, bố cục, điều hướng)

**Feature Branch**: `012-backoffice-web-shell`
**Created**: 2026-10-14
**Status**: Done
**Duyệt khác biệt**: owner duyệt ngày 2026-10-14 D-39 đến D-49 (D-49: ẩn link Documentation mặc định
thay cho mục "Cần xác nhận" về URL docs); owner duyệt D-50 và các làm rõ của checklist release-gate ngày
2026-10-14; owner chọn D-51 (giá trị mặc định Directus của `project_name`, `project_color` coi như trống) ngày
2026-10-14; owner chọn design-system TailAdmin (constitution 2.0.0, D-47 sửa, D-52) ngày 2026-10-15; owner chọn D-53 (bỏ bước
license BSL ở `/setup`), bổ sung D-52 (đăng xuất không hỏi xác nhận, nút `sign_out` ở màn không có quyền vào app)
và FR-012 (`unexpected_error` như Directus) ngày 2026-10-15.
**Input**: User description: "Xây app web quản trị mới mang tên Backoffice thay cho Directus app, giữ nguyên luồng sử dụng. Mọi chữ Directus mà người dùng thấy (tiêu đề, logo, favicon, trang đăng nhập, chuỗi dịch, tên mặc định khi project_name trống) đổi thành Backoffice. Nếu settings trong DB đã có tên dự án, logo hoặc màu riêng thì dùng các giá trị đó, giống Directus. Người dùng đăng nhập bằng email và mật khẩu, TFA, LDAP hoặc SSO (OpenID Connect, OAuth2), rồi được giữ phiên bằng refresh token. Đăng xuất, quên mật khẩu, nhận lời mời (giữ màn hình như Directus; vì hệ thống không gửi email nên hiện thêm hướng dẫn liên hệ admin), cập nhật hồ sơ, theme sáng/tối, ngôn ngữ vi-VN và en-US (dùng chuỗi dịch của Directus). Bố cục gồm thanh module bên trái, thanh điều hướng, vùng nội dung và sidebar bên phải như Directus. Các route giống Directus (/admin/content, /admin/files, /admin/users, /admin/insights, /admin/activity, /admin/settings). App chỉ gọi API theo đúng chuẩn Directus, nên chạy được với cả Directus thật lẫn API mới chỉ bằng cách đổi URL. Hỗ trợ desktop và tablet từ 768px trên Chrome, Edge, Firefox, Safari bản mới. Phần nhìn (màu, chữ, khoảng cách, bo góc, component) theo bộ design-system/ của dự án; màu, logo trong settings áp lên trên design-system như Directus (project_color tô nền logo, trang đăng nhập, trang share, favicon; theme sáng/tối tùy chỉnh trong settings đè màu tương ứng); những chỗ design-system chưa chốt (màu primary, font, màu trạng thái, theme tối) ghi thành câu hỏi mở. Tham chiếu directus/app/src (router, auth, stores, views) và design-system/. Tiêu chí chấp nhận: đăng nhập vào Directus thật và vào API mới đều chạy, điều hướng giữa các module giống Directus."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/app/src` trừ khi ghi khác):

- Khởi động và router: `main.ts`, `app.vue` (`useHead`: tiêu đề `Directus`, mẫu `%s · %projectName`, `projectName`
  mặc định `Directus`; `--project-color` từ `project_color` hoặc `--theme--primary`; meta `theme-color`,
  `msapplication-TileColor` từ `project_color` hoặc `#6644ff`; favicon: `public_favicon` → sinh từ `project_color` →
  `/favicon.ico`; `htmlAttrs` `lang`, `dir`; class `dark`/`light` trên `body`; `custom_css` vào `#custom-css`; màn
  `hydrating`; màn lỗi `unexpected_error` với nút tải lại), `router.ts` (history ở `<root>admin/`; route public
  `/`, `/setup`, `/login`, `/reset-password`, `/register`, `/accept-invite`, `/logout`, `/shared/:id`; route
  `/tfa-setup` (`track: false`); `private-404` cho path lạ; guard `onBeforeEach`: lần tải đầu gọi `refresh`, nạp
  `serverStore` khi `info.project` null, chưa `setupCompleted` thì về `/setup`, route private chưa đăng nhập thì về
  `/login?redirect=<fullPath>`, đã đăng nhập thì `hydrate`; ép `/tfa-setup` khi `enforce_tfa` mà `tfa_secret` null
  hoặc khi localStorage `directus-require_tfa_setup` trùng id user; `onAfterEach`: `trackPage` sau 500 ms cho route
  private không `track: false`), `hydrate.ts` (`hydrate`: user trước, rồi `permissions` + `fields`, rồi các store còn
  lại, rồi `setLanguage(userStore.language)`; `dehydrate`), `modules/index.ts` (đăng ký route `/<module.id>` cho
  module qua `preRegisterCheck(user, permissions)`), `constants.ts` (`MODULE_BAR_DEFAULT`: `content`, `visual`
  (tắt), `users`, `files`, `insights`, `deployments` (tắt), link `docs` tới `https://docs.directus.io`;
  `DEFAULT_AUTH_PROVIDER = 'local'`, `DEFAULT_AUTH_DRIVER = 'default'`, `AUTH_SSO_DRIVERS = ['oauth2', 'openid',
  'saml']`, `SDK_AUTH_REFRESH_BEFORE_EXPIRES = 10_000`), `idle.ts` (tab rảnh thì dừng tự refresh).
- Xác thực: `auth.ts` (`login`: email + password + `otp` qua `/auth/login[/<provider>]` với `mode: 'session'`
  (SDK), LDAP qua `identifier`; share qua `/shares/auth`; sau login gọi `sdk.refresh()`, nạp lại `serverStore`,
  `hydrate`; `refresh`: còn hạn thì chỉ `GET /users/me?fields=id`, hết hạn thì `/auth/refresh`, lỗi thì `logout`
  với `reason=SESSION_EXPIRED`; `logout`: `/auth/logout` chỉ khi người dùng tự bấm, `dehydrate`, về
  `/login?reason=`), `api.ts` (axios với `baseURL`, hàng đợi request, `requests`
  store), `sdk.ts`, `routes/login/login.vue` (tiêu đề `sign_in`; chọn provider khi có hơn một; `ContinueAs` khi đã
  đăng nhập; `LdapForm` cho driver `ldap`; `LoginForm` cho `default`/`local`; `SsoLinks`; link `/register` khi
  `public_registration`; notice `authenticated`/`not_authenticated`/`logoutReason.<reason>`),
  `routes/login/components/login-form/*` (email, password, nút `sign_in`, link `forgot_password`; lỗi
  `INVALID_OTP` thì hiện ô OTP; lỗi khác dịch qua `translateAPIError`), `sso-links.vue` (link
  `<root>auth/login/<provider>?redirect=<root>admin/login?continue`; icon, nhãn `log_in_with`; `?reason=INVALID_OTP`
  khi về thì hỏi OTP rồi gửi lại với provider gốc trong localStorage; `sessionStorage` `sso_otp_attempted`),
  `routes/login/components/continue-as.vue`, `routes/logout.vue`, `routes/reset-password/*` (`request.vue`:
  `POST /auth/password/request` rồi notice `password_reset_sent`; `reset.vue`: `?token=` → `POST
  /auth/password/reset`), `routes/accept-invite.vue` (`?token=` → email từ payload JWT, ô mật khẩu, `POST
  /users/invite/accept`, notice `account_created_successfully`, nút `sign_in`), `routes/tfa-setup.vue`
  (`useTFASetup`: `POST /users/me/tfa/generate` với mật khẩu, QR `otpauth_url`, `POST /users/me/tfa/enable`;
  redirect an toàn qua `useSafeRedirect`), `routes/setup/setup.vue` (`POST /server/setup` tạo admin khi
  `setupCompleted=false`), `routes/shared/shared.vue` (đăng nhập share bằng mật khẩu), `routes/private-not-found.vue`,
  `composables/use-safe-redirect.ts`, `utils/jwt-payload.ts`, `types/login.ts` (`AuthProvider { name, driver, icon,
  label }`).
- Store: `stores/server.ts` (`GET /server/info` → `info.project` gồm `project_name`, `project_descriptor`,
  `project_logo`, `project_color`, `default_language`, `default_appearance`, `default_theme_light`,
  `default_theme_dark`, `theme_light_overrides`, `theme_dark_overrides`, `public_foreground`, `public_background`,
  `public_favicon`, `public_note`, `custom_css`, `public_registration`; `setupCompleted`, `websocket`, `version`;
  `GET /auth?sessionOnly` → `auth.providers`, `auth.disableDefault`; `providerOptions` bỏ driver SSO, thêm
  `default_provider` khi không `disableDefault`), `stores/user.ts` (`GET /users/me` với field cố định kể cả `role`,
  `policies`, `app_access`, `admin_access`, `enforce_tfa`, `tfa_secret`, `appearance`, `theme_*`, `language`,
  `last_page`; `language`: user → `default_language` → `en-US`; `textDirection`; `trackPage`: `PATCH /users/me/track/page`
  `last_page`), `stores/settings.ts` (`GET /settings`, `module_bar`, `project_url`), `stores/permissions.ts`
  (`GET /permissions/me`), `stores/requests.ts`, `stores/notifications.ts`, `@directus/stores` `useAppStore`
  (`authenticated`, `hydrated`, `hydrating`, `accessTokenExpiry`, `error`, `navbarOpen`, `sidebarOpen`,
  `fullScreen`).
- Giao diện: `views/public/public-view.vue` (cột trái: logo trên nền `project_color` hoặc logo Directus, `project_name`,
  `project_descriptor` hoặc `application`, nội dung, notice; cột phải: ảnh hoặc video `public_background`, hoa văn
  mặc định, `public_foreground`, `public_note` markdown), `views/private/private-view/components/*`
  (`private-view-root`, `private-view-nav` (thanh điều hướng, tên dự án `private-view-nav-project-name`),
  `private-view-header-bar` (tiêu đề, icon, action), `private-view-main`, `private-view-sidebar` (sidebar phải, gập
  mở), `private-view-no-app-access` (user không `app_access`), `private-view-resize-handle`),
  `views/private/components/module-bar.vue` (`settings.module_bar` hoặc `MODULE_BAR_DEFAULT`, lọc module đã đăng ký
  và `enabled`, link `url` nội bộ hoặc ngoài), `module-bar-logo.vue` (`project_logo` từ `/assets/<id>` hoặc logo
  Directus; link `project_url`; thanh tiến trình khi hàng đợi request còn việc), `module-bar-avatar.vue` (avatar,
  menu hồ sơ `/users/me`, đăng xuất `/logout`), `skip-menu.vue`, `composables/use-theme-configuration.ts`
  (`appearance`: user → `default_appearance` → `auto` theo `prefers-color-scheme`; `theme_light`/`theme_dark` và
  `*_overrides` gộp user lên settings), `@directus/themes` `ThemeProvider`, `styles/*`.
- Module (chỉ lấy id, tên, icon, route gốc và `preRegisterCheck`): `modules/content` (`content`, `$t:content`, `box`),
  `modules/files` (`files`, `$t:file_library`, `folder`, cần đọc `directus_files`), `modules/users` (`users`,
  `$t:user_directory`, `people_alt`, cần đọc `directus_users`; route `:primaryKey` dùng cho `/users/me`),
  `modules/insights` (`insights`, `$t:insights`, `insights`, cần đọc `directus_dashboards`), `modules/activity`
  (`activity`, `hidden: true`, `$t:activity`, `notifications`), `modules/settings` (`settings`, `$t:settings`,
  `settings`, chỉ admin; `''` → `/settings/data-model`), `modules/visual`, `modules/deployment` (Nguyên tắc XI).
- Ngôn ngữ: `lang/index.ts`, `lang/set-language.ts` (nạp `translations/<lang>.yaml`, đặt `lang` trên `html`, nạp
  translations của `directus_translations`, locale date-fns), `lang/available-languages.yaml`,
  `lang/translations/en-US.yaml` (3.031 dòng), `vi-VN.yaml` (1.267 dòng, thiếu thì rơi về `en-US`),
  `lang/translate-api-error.ts` (`errors.<CODE>`), `date-formats.yaml`.
- API Directus mà app gọi (đã có ở app mới): `GET /server/info` (001), `GET /auth?sessionOnly`, `POST
  /auth/login[/:provider]`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/password/request`, `POST
  /auth/password/reset`, `GET /auth/login/:provider` (chuyển hướng SSO), `POST /users/me/tfa/generate`, `POST
  /users/me/tfa/enable` (003), `GET|PATCH /users/me`, `POST /users/invite/accept`, `GET /permissions/me` (004),
  `GET /assets/:id` (007), `GET /settings` (010), `POST /server/setup` (010), `POST /shares/auth` (010), `GET
  /notifications` (010), `GET /translations` (010), `GET /collections`, `GET /fields`, `GET /relations` (006), `GET
  /presets` (010).

**Đã có từ feature 001 đến 011**: `apps/web` là khung tối thiểu (001): Vue 3.5, Pinia, Vue Router, vue-i18n với
`i18n/en-US.ts`, `vi-VN.ts`; `runtime-config.ts` đọc `config.json` (`apiUrl`) lúc chạy; container nginx riêng với
`docker/40-config.sh`; router chỉ có một route trống ("Business routes start with feature 012"); test Vitest với
happy-dom; cổng CI lint, typecheck, coverage 60%, E2E khói. Toàn bộ API mà app web cần (danh sách trên) đã có và đã
đối chiếu với Directus. `tests/directus-app-e2e` chạy app Directus 11.17.4 qua reverse proxy của môi trường đối chiếu
(profile `app`, `login.spec.ts`, `routing.spec.ts`...). Chưa có: mọi màn hình, store, luồng xác thực, bố cục, branding,
theme, i18n theo Directus, token design-system trong `apps/web`, E2E cho app mới.

**Bộ test liên quan của Directus** (đếm bằng grep ngày 2026-10-14): `router.test.ts` (guard), `hydrate.test.ts`,
`idle.test.ts`, `routes/login/login.test.ts`, `stores/user.test.ts`, `stores/server.test.ts`,
`stores/settings.test.ts`, `stores/permissions.test.ts`, `lang/translations.test.ts`,
`views/private/private-view/components/*.test.ts` (header bar, main, action button, icon), `views/private/components/
skip-menu.test.ts`. Các test này viết cho component của Directus nên không port nguyên văn; dùng làm danh sách hành
vi cần kiểm (FR-090).

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là người quản trị và người dùng app (có `app_access`) đang dùng app Directus, chuyển sang
app Backoffice với cùng tài khoản, cùng DB và cùng thói quen; và người vận hành triển khai app với URL API là Directus
thật hoặc API mới.

Phạm vi feature này là **khung ứng dụng**: đăng nhập và phiên, bố cục, thanh module, điều hướng giữa các module,
branding, theme, ngôn ngữ, hồ sơ cá nhân. Nội dung bên trong từng module (danh sách collection, bảng item, thư viện
file, danh bạ user, dashboard, nhật ký, các trang settings) thuộc các feature sau; ở feature này mỗi route module hiện
khung với tiêu đề module và trạng thái trống (xem Assumptions, D-40).

### User Story 1 - Đăng nhập bằng email, mật khẩu, TFA và giữ phiên (Priority: P1)

Người dùng mở `/admin`, được đưa tới `/admin/login`, nhập email và mật khẩu (và mã OTP khi tài khoản bật TFA), vào app.
Phiên được giữ bằng refresh token: tải lại trang, mở tab mới hay để app mở quá hạn access token đều không phải đăng
nhập lại; hết hạn phiên thì về trang đăng nhập với lý do; bấm đăng xuất thì kết thúc phiên ở server.

**Why this priority**: Không đăng nhập được thì không có gì chạy; là tiêu chí chấp nhận đầu tiên của mô tả.

**Independent Test**: Cùng một bản build, đổi `apiUrl` trong `config.json` lần lượt sang Directus thật và API mới;
E2E đăng nhập, tải lại, chờ quá hạn access token, đăng xuất; so dòng `directus_sessions` và `directus_activity`.

**Acceptance Scenarios**:

1. **Given** user active có mật khẩu, không TFA, **When** nhập đúng email và mật khẩu rồi gửi, **Then** app gọi
   `POST /auth/login` với `mode: session`, nhận cookie phiên, gọi `/users/me`, `/settings`, `/permissions/me` và vào
   trang `last_page` của user hoặc `/admin/content` khi trống; `directus_sessions` có dòng mới như khi đăng nhập ở
   Directus app.
2. **Given** user bật TFA, **When** gửi email và mật khẩu đúng, **Then** API trả `INVALID_OTP`, app hiện thêm ô OTP
   (giữ email và mật khẩu đã nhập); nhập đúng OTP thì vào app; nhập sai thì báo lỗi dịch theo mã lỗi.
3. **Given** sai mật khẩu, user suspended, hoặc user không có `app_access`, **When** gửi, **Then** app hiện đúng
   thông báo dịch từ mã lỗi (`INVALID_CREDENTIALS`, `USER_SUSPENDED`...) như Directus; user đăng nhập được nhưng không
   `app_access` thấy màn "không có quyền vào app" với nút đăng xuất như Directus.
4. **Given** đã đăng nhập, **When** tải lại trang hoặc mở `/admin/users` ở tab mới, **Then** app gọi `/auth/refresh`
   trên lần tải đầu, không hiện trang đăng nhập; **When** access token còn hạn, **Then** chỉ xác nhận phiên bằng
   `GET /users/me?fields=id`; **When** sắp hết hạn, **Then** gọi `/auth/refresh` trước mốc 10 giây như Directus;
   tab rảnh thì không tự refresh, hoạt động lại thì refresh.
5. **Given** phiên bị thu hồi ở server (xóa dòng session, đổi mật khẩu ở nơi khác), **When** app gọi `refresh()` lần
   kế tiếp khi tab hoạt động lại sau khi rảnh, **Then** app về `/admin/login?reason=SESSION_EXPIRED` và hiện lý do;
   không gọi `/auth/logout`; khi tải lại trang thì về `/admin/login?redirect=...` không lý do (`firstRefresh`, như
   Directus). Request thường trả `401` không đăng xuất (như `api.ts` 11.17.4, owner chọn
   2026-10-14).
6. **Given** đã đăng nhập, **When** bấm đăng xuất ở menu avatar, **Then** app gọi `/auth/logout`, xóa trạng thái, về
   `/admin/login?reason=SIGN_OUT`; `directus_sessions` không còn dòng đó.
7. **Given** user mở route private khi chưa đăng nhập, **When** vào `/admin/settings/project`, **Then** về
   `/admin/login?redirect=/settings/project`; sau đăng nhập quay lại đúng route (chỉ chấp nhận redirect nội bộ).
8. **Given** role có `enforce_tfa` mà user chưa có `tfa_secret`, **When** đăng nhập, **Then** app ép tới
   `/admin/tfa-setup`: nhập mật khẩu, quét QR `otpauth_url`, nhập OTP để bật, rồi quay lại route trước.

---

### User Story 2 - Bố cục và điều hướng giữa các module như Directus (Priority: P1)

Sau đăng nhập, người dùng thấy bố cục Directus: thanh module bên trái (logo, các module, avatar), thanh điều hướng
(tên dự án, nội dung điều hướng của module), thanh tiêu đề, vùng nội dung và sidebar bên phải gập mở được. Bấm từng
module đổi URL thành `/admin/content`, `/admin/files`, `/admin/users`, `/admin/insights`, `/admin/activity`,
`/admin/settings` như Directus; module hiện theo `module_bar` trong settings và theo quyền.

**Why this priority**: Là tiêu chí chấp nhận thứ hai của mô tả và là khung cho mọi feature FE sau.

**Independent Test**: E2E với admin, user có quyền một phần, user chỉ có quyền `directus_files`; so URL, module hiện
trên thanh, tiêu đề trang, với cùng tài khoản trên Directus app qua proxy.

**Acceptance Scenarios**:

1. **Given** admin và settings `module_bar` null, **When** vào app, **Then** thanh module hiện theo thứ tự mặc định
   của Directus trừ link Documentation (ẩn, D-49): Content, Users, Files, Insights; Settings luôn ở cuối (admin);
   Visual và Deployments không hiện (tắt mặc định); bấm từng module đổi URL tương ứng và tiêu đề trang (`<module> · <project>`).
2. **Given** settings `module_bar` có thứ tự và `enabled` tùy chỉnh (kể cả link nội bộ `/activity` và link ngoài),
   **When** vào app, **Then** thanh module theo đúng cấu hình đó như Directus; link ngoài mở tab mới.
3. **Given** user không admin, chỉ có quyền đọc `directus_files`, **When** vào app, **Then** thanh module có cùng tập
   module như Directus app với cùng user (có Files; không có Insights, Settings; Users hiện hay không theo
   `/permissions/me` như Directus); `/admin/insights` gõ tay hiện trang 404 private của app như Directus;
   `/admin/activity` vẫn mở được (module ẩn khỏi thanh nhưng có route).
4. **Given** đang ở một module, **When** gập thanh điều hướng hoặc sidebar, tải lại trang, **Then** trạng thái gập
   mở được giữ như Directus (localStorage với tiền tố `backoffice-`); bề rộng từ 768 px trở lên hiện đủ ba cột,
   sidebar phải gập mặc định ở dưới ngưỡng Directus dùng.
5. **Given** đang ở `/admin/files`, **When** tải lại, **Then** sau 500 ms app ghi `last_page` qua `PATCH /users/me/track/page`
   như Directus; mở `/admin` lần sau về đúng `last_page`.
6. **Given** route lạ `/admin/khong-co`, **When** đã đăng nhập, **Then** trang 404 private có thanh module; chưa đăng
   nhập thì về đăng nhập trước.
7. **Given** API không truy cập được khi tải app, **When** `GET /server/info` lỗi, **Then** màn lỗi "unexpected_error"
   với chi tiết lỗi và nút tải lại như Directus.

---

### User Story 3 - Thương hiệu Backoffice và branding từ settings (Priority: P1)

Người dùng không thấy chữ hay logo Directus ở bất kỳ đâu trong app: tiêu đề tab, logo thanh module, logo trang đăng
nhập, favicon, chuỗi dịch, tên mặc định khi `project_name` trống đều là Backoffice. Nếu settings có `project_name`,
`project_logo`, `project_color`, `public_*`, `custom_css` thì app dùng đúng như Directus.

**Why this priority**: Nguyên tắc IX; là yêu cầu đầu tiên của mô tả.

**Independent Test**: E2E với settings mặc định (DB mới) và với settings đã đặt đủ branding; chụp DOM và tìm chuỗi
"Directus" (phân biệt dữ liệu người dùng); so với Directus app cùng settings.

**Acceptance Scenarios**:

1. **Given** `project_name` trống hoặc là giá trị mặc định `Directus` của DB (D-51), **When** mở trang đăng nhập và trang trong app, **Then** tiêu đề tab là
   `Sign in · Backoffice`/`Content · Backoffice`, tên dự án hiện `Backoffice`, logo Backoffice (sáng/tối theo theme),
   favicon Backoffice; `otpauth_url` ở `/tfa-setup` có issuer `Backoffice` (API 003, D-25).
2. **Given** settings có `project_name`, `project_descriptor`, `project_logo`, `project_color`, **When** mở trang đăng
   nhập, **Then** logo lấy từ `/assets/<project_logo>` trên nền `project_color`, tên và mô tả dự án đúng; thanh module
   dùng cùng logo, bấm logo mở `project_url` nếu có; meta `theme-color` là `project_color`; favicon sinh từ
   `project_color` khi không có `public_favicon`, dùng `/assets/<public_favicon>` khi có.
3. **Given** `public_background` (ảnh hoặc video), `public_foreground`, `public_note` (markdown), **When** mở trang
   đăng nhập, quên mật khẩu, nhận lời mời, share, **Then** cột phải hiện như Directus; không có thì hoa văn mặc định.
4. **Given** `custom_css` trong settings, **When** vào app, **Then** CSS được chèn như Directus.
5. **Given** mọi chuỗi dịch `en-US` và `vi-VN` của Directus có chữ "Directus", **When** app hiển thị, **Then** đã thay
   bằng "Backoffice" (ví dụ `directus_version`, thông báo chào mừng), trừ chuỗi nhắc tới bảng hay API `directus_*`.

---

### User Story 4 - Đăng nhập LDAP và SSO (OpenID Connect, OAuth2) (Priority: P2)

Khi API cấu hình provider LDAP, OpenID hoặc OAuth2, trang đăng nhập hiện ô chọn provider (LDAP, local) và các nút
"Đăng nhập với <provider>" như Directus. SSO chuyển hướng tới `/auth/login/<provider>` của API rồi quay về
`/admin/login?continue`; lỗi SSO và bước OTP sau SSO xử lý như Directus.

**Why this priority**: Mô tả yêu cầu; không chặn luồng chính (local).

**Independent Test**: Môi trường đối chiếu đã có LDAP (003) và provider OpenID/OAuth2 giả (003) ở cặp `sso`; E2E chạy
từ app ở cấu hình khác origin, lần lượt trỏ `apiUrl` tới Directus `sso` và API mới `sso`.

**Acceptance Scenarios**:

1. **Given** `GET /auth?sessionOnly` trả provider `ldap`, **When** chọn provider đó, **Then** form đổi sang
   `identifier` + mật khẩu, gửi `POST /auth/login/<provider>` với `mode: session`; `AUTH_DISABLE_DEFAULT=true` thì
   không có lựa chọn local và provider đầu tiên được chọn sẵn.
2. **Given** provider `openid` hoặc `oauth2`, **When** bấm nút provider, **Then** trình duyệt tới
   `<apiUrl>/auth/login/<provider>?redirect=<origin>/admin/login?continue`; về với `?continue` thì app refresh và vào
   app; về với `?error&code=<CODE>` thì hiện lỗi dịch theo mã; về với `?reason=INVALID_OTP` thì hiện ô OTP và gửi lại
   với provider đã lưu.
3. **Given** provider `saml` có trong danh sách (Directus thật), **When** mở trang đăng nhập, **Then** vẫn hiện nút
   như Directus (app không lọc; API mới không trả `saml`, D-24).

---

### User Story 5 - Quên mật khẩu, đặt lại mật khẩu, nhận lời mời, thiết lập lần đầu (Priority: P2)

Màn hình giữ như Directus. Vì hệ thống không gửi email (Nguyên tắc X, D-23, D-27), màn quên mật khẩu và nhận lời mời
hiện thêm hướng dẫn liên hệ quản trị viên để nhận link.

**Why this priority**: Mô tả yêu cầu; dùng ít hơn đăng nhập.

**Independent Test**: E2E: gửi yêu cầu quên mật khẩu, lấy token từ log cảnh báo của API mới hoặc từ email giả của
Directus, mở link, đặt mật khẩu mới, đăng nhập; mời user qua API, lấy token, nhận lời mời.

**Acceptance Scenarios**:

1. **Given** trang `/admin/reset-password` không token, **When** nhập email và gửi, **Then** `POST
   /auth/password/request`, notice `password_reset_sent` như Directus, kèm một dòng hướng dẫn liên hệ quản trị viên
   (chuỗi mới, có bản `vi-VN` và `en-US`); lỗi hiện dịch theo mã.
2. **Given** `/admin/reset-password?token=<t>`, **When** nhập mật khẩu mới và gửi, **Then** `POST
   /auth/password/reset`, notice thành công, nút về đăng nhập; token hết hạn thì báo lỗi theo mã.
3. **Given** `/admin/accept-invite?token=<t>`, **When** mở, **Then** email đọc từ payload token hiện sẵn (không sửa),
   nhập mật khẩu, `POST /users/invite/accept`, notice `account_created_successfully`, nút đăng nhập; kèm dòng hướng
   dẫn liên hệ quản trị viên khi token không hợp lệ.
4. **Given** DB chưa có user nào (`setupCompleted=false`), **When** mở `/admin`, **Then** về `/admin/setup` để tạo admin
   qua `POST /server/setup` như Directus (010); đã có user thì `/admin/setup` về đăng nhập.
5. **Given** `/admin/shared/<uuid>`, **When** mở, **Then** trang đăng nhập share (mật khẩu nếu share có) trên
   PublicView với branding; thành công thì vào route item của share (khung module content, D-40).

---

### User Story 6 - Hồ sơ cá nhân, theme sáng tối, ngôn ngữ (Priority: P2)

Người dùng mở hồ sơ từ menu avatar (`/admin/users/me`), sửa tên, email, mật khẩu, avatar, ngôn ngữ, giao diện
(sáng/tối/tự động); đổi xong app áp ngay như Directus.

**Why this priority**: Mô tả yêu cầu; là phần duy nhất của module Users trong feature này.

**Independent Test**: E2E đổi ngôn ngữ sang `vi-VN`, đổi `appearance`, tải lại, so với Directus app cùng user.

**Acceptance Scenarios**:

1. **Given** user ở `/admin/users/me`, **When** sửa `first_name`, `last_name`, `email`, `password`, `avatar`,
   `language`, `appearance`, `theme_light_overrides`, `theme_dark_overrides` rồi lưu, **Then** `PATCH /users/me` với
   đúng field đã đổi; lỗi validation hiện theo field; email trùng báo `RECORD_NOT_UNIQUE` dịch.
2. **Given** `language` của user null và `default_language` của settings là `vi-VN`, **When** vào app, **Then** giao
   diện tiếng Việt với chuỗi `vi-VN` của Directus, chuỗi thiếu rơi về `en-US`; `html[lang]` đúng; định dạng ngày theo
   locale; đổi `language` thì áp ngay không tải lại.
3. **Given** `appearance = auto`, **When** hệ điều hành đổi sáng/tối, **Then** app đổi theo; `appearance` của user
   đè `default_appearance` của settings; class `dark`/`light` trên `html` (Directus đặt trên `body`, D-43).
4. **Given** `theme_light_overrides` ở settings và ở user, **When** áp, **Then** gộp như `use-theme-configuration.ts`
   (`merge({}, user, settings)`: khóa trùng thì settings thắng, owner chọn giữ như Directus 2026-10-14); chỉ
   các khóa có biến theme tương ứng được áp (D-43, FR-063), khóa khác bỏ qua.

---

### User Story 7 - Chạy với Directus thật và API mới, E2E ở cả hai (Priority: P2)

Người vận hành triển khai một image, đổi `apiUrl` để trỏ sang Directus thật hoặc API mới; E2E chạy cùng bộ kịch bản
ở ba cấu hình của FR-071.

**Why this priority**: Là tiêu chí chấp nhận của mô tả và cổng đóng feature.

**Independent Test**: Pipeline chạy Playwright ở ba cấu hình của FR-071 (API Directus, API mới cùng origin, API mới khác origin).

**Acceptance Scenarios**:

1. **Given** bộ E2E (US1 đến US6), **When** chạy ở ba cấu hình của FR-071, **Then** 100% ca đạt ở cả ba; app không gọi route
   nào ngoài danh sách API Directus ở phần tham chiếu (kiểm bằng ghi lại request trong E2E).
2. **Given** Chrome, Edge, Firefox, Safari bản ổn định mới nhất, bề rộng 768 px và 1280 px, **When** chạy E2E
   đăng nhập và điều hướng ở hai cấu hình cùng origin, **Then** đạt ở mọi tổ hợp CI hỗ trợ (chromium, firefox, webkit,
   kênh `msedge` khi có); cấu hình khác origin chỉ chạy chromium ở 1280 px (cookie cross-site chỉ cần kiểm một engine).

---

### Edge Cases

- `apiUrl` khác origin với app: app vẫn dùng mode `session`; API phải có `SESSION_COOKIE_SAME_SITE=None`,
  `SESSION_COOKIE_SECURE=true` (trình duyệt chỉ nhận cookie `SameSite=None` qua HTTPS), `CORS_ENABLED=true`,
  `CORS_ORIGIN` chứa origin của app, `CORS_CREDENTIALS=true`; thiếu một trong các biến này thì đăng nhập thành công
  nhưng các request kế tiếp trả `401` như ở Directus app (tài liệu triển khai ghi rõ, FR-075).
  Triển khai khuyến nghị vẫn là cùng origin sau reverse proxy (`/admin` → app, còn lại → API).
- Lần tải đầu chưa có cookie: `/auth/refresh` trả `401`/`403`; app bỏ qua lỗi và hiện đăng nhập, không hiện lý do
  `SESSION_EXPIRED` (như Directus, `firstRefresh`).
- `GET /settings` với user không admin trả ít field (theo quyền); `module_bar` null thì dùng mặc định;
  `project_logo` trỏ file đã xóa thì ảnh lỗi, thanh module rơi về logo Backoffice.
- `last_page` trỏ route không còn quyền: vào trang 404 private như Directus.
- `redirect` trong `/login?redirect=` là URL ngoài: bỏ, về trang mặc định (`useSafeRedirect`).
- Hai tab cùng đăng xuất: tab thứ hai nhận `401` khi `/auth/logout` → vẫn về đăng nhập, không lặp.
- `prefers-color-scheme` đổi khi `appearance` không `auto`: không đổi.
- Chuỗi `vi-VN` thiếu (1.267 so với 3.031 dòng): rơi về `en-US` từng khóa, không hiện khóa thô.
- `public_registration` bật: link đăng ký hiện ở trang đăng nhập như Directus; `/admin/register` là trang public
  "chưa có sẵn" (không chuyển hướng về đăng nhập) tới khi 015 thêm form (Clarifications, D-44).
- `project_color` không hợp lệ (chuỗi lạ): trình duyệt bỏ qua, app không ném lỗi.
- `public_background` là video: `autoplay muted loop` như Directus; trình duyệt chặn thì chỉ hiện khung.
- Người dùng share (`share` trong `/users/me`): không có `app_access` đầy đủ, không ghi `last_page`, không ép TFA
  (như guard của Directus).
- Bề rộng dưới 768 px: không hỗ trợ (mô tả); app vẫn không vỡ bố cục nghiêm trọng nhưng không kiểm.
- `websocket: false` từ `/server/info`: không có tính năng realtime, giống Directus khi `WEBSOCKETS_ENABLED=false`
  (Nguyên tắc XI).
- App extension (`/extensions/sources/index.js`): app không nạp (D-17, D-37), giống Directus không cài extension.

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| US1 | 1–8 | FR-001 đến FR-004, FR-010 đến FR-019 | SC-001, SC-004 |
| US2 | 1–7 | FR-020 đến FR-029, FR-067 | SC-002, SC-003 |
| US3 | 1–5 | FR-030 đến FR-038 | SC-005 |
| US4 | 1–3 | FR-040 đến FR-043 | SC-001 |
| US5 | 1–5 | FR-050 đến FR-055 | SC-001 |
| US6 | 1–4 | FR-060 đến FR-066 | SC-006 |
| US7 | 1–2 | FR-070 đến FR-075, FR-080 đến FR-084, FR-090 đến FR-093 | SC-001, SC-007, SC-008, SC-009 |

## Requirements *(mandatory)*

### Functional Requirements

**Khởi động, cấu hình, API**

- **FR-001**: App PHẢI được phục vụ ở đường dẫn gốc `/admin/` (history của router như Directus: `<root>admin/`), build
  một lần cho mọi môi trường, đọc `apiUrl` từ `config.json` lúc chạy (001). Mọi lệnh gọi mạng PHẢI đi qua một client
  duy nhất có `baseURL = apiUrl`, gửi cookie (`withCredentials`), có hàng đợi tạm dừng trong lúc refresh như `api.ts`
  của Directus. Như Directus 11.17.4, client KHÔNG có interceptor `401`: phiên mất chỉ được phát hiện khi `refresh()`
  lỗi (FR-014) và đăng xuất với lý do `SESSION_EXPIRED` (owner chọn 2026-10-14).
- **FR-002**: App CHỈ ĐƯỢC gọi các route và tham số có trong API Directus 11.17.4 (danh sách ở phần tham chiếu).
  KHÔNG có route riêng của API mới; KHÔNG dựa vào header hay field chỉ API mới có. Cùng một build PHẢI chạy với
  Directus 11.17.4 thật và với API mới chỉ bằng cách đổi `apiUrl`.
- **FR-003**: Khi `GET /server/info` hoặc bước nạp dữ liệu ban đầu lỗi, app PHẢI hiện màn lỗi với tiêu đề
  `unexpected_error`, chi tiết lỗi và nút tải lại như `app.vue` của Directus.
- **FR-004**: Biến môi trường chỉ app web cần (nếu có) PHẢI mang tiền tố `BACKOFFICE_` (001, FR-015); feature này
  không thêm biến nào ngoài `apiUrl` đã có.

**Xác thực và phiên**

- **FR-010**: Trang `/admin/login` PHẢI có: tiêu đề `sign_in`; ô chọn provider khi `providerOptions` có hơn một mục
  (local + LDAP); form email và mật khẩu cho driver `default`/`local`; form `identifier` và mật khẩu cho `ldap`; nút
  SSO cho driver `oauth2`, `openid` (và `saml` nếu API trả); link quên mật khẩu; khối "tiếp tục với tư cách" khi đã
  đăng nhập; notice `not_authenticated` / `authenticated` / `logoutReason.<reason>` như `login.vue` của Directus; link
  đăng ký chỉ khi `public_registration`, trỏ tới `/register` là trang public "chưa có sẵn" với link về đăng nhập
  (form thuộc 015, D-44).
- **FR-011**: Đăng nhập local PHẢI gọi `POST /auth/login` (hoặc `/auth/login/<provider>` khi provider khác `local`)
  với `{ email, password, otp?, mode: 'session' }`; LDAP với `{ identifier, password, otp?, mode: 'session' }`; sau
  đó gọi `POST /auth/refresh` (mode session) để lấy `expires`, nạp lại server store và nạp dữ liệu app như `auth.ts`.
- **FR-012**: Khi API trả `INVALID_OTP`, form PHẢI hiện ô OTP (6 ký tự) giữ nguyên email và mật khẩu; mã lỗi khác
  PHẢI dịch qua khóa `errors.<CODE>` của chuỗi dịch Directus, không có bản dịch thì hiện `unexpected_error` như
  `translateAPIError` của Directus (owner chọn 2026-10-15). Riêng `/setup` hiện message của API như `setup.vue`.
- **FR-013**: Lần tải đầu, app PHẢI thử `POST /auth/refresh` trước khi quyết định route (bỏ qua lỗi); route private
  khi chưa đăng nhập PHẢI về `/login?redirect=<fullPath>`; sau đăng nhập PHẢI đi tới `redirect || last_page ||
  '/content'` bằng `router.push` như `login-form.vue` (router chỉ nhận path của app nên URL ngoài thành path nội bộ
  và rơi vào 404 private, không rời app). Riêng `/tfa-setup` kiểm `?redirect=` qua `POST /utils/resolve-redirect`
  như `useSafeRedirect` (contracts/api-calls #31); lỗi thì về `last_page` hoặc `/login`.
- **FR-014**: App PHẢI tự làm mới phiên như Directus: lưu `accessTokenExpiry`; trước khi hết hạn 10 giây gọi
  `/auth/refresh`; còn hạn thì xác nhận bằng `GET /users/me?fields=id`; dừng khi tab rảnh (idle như `idle.ts`) và
  refresh ngay khi tab hoạt động lại; refresh lỗi → đăng xuất với `SESSION_EXPIRED`.
- **FR-015**: Đăng xuất do người dùng bấm PHẢI gọi `POST /auth/logout` (mode session) rồi xóa mọi store và về
  `/login?reason=SIGN_OUT`; đăng xuất do hết phiên KHÔNG gọi `/auth/logout`, về `/login?reason=SESSION_EXPIRED`.
- **FR-016**: Sau đăng nhập, app PHẢI nạp theo thứ tự của `hydrate.ts`: `GET /users/me` (cùng danh sách field như
  `stores/user.ts`, kèm `/policies/me/globals`, `/roles/me`), rồi song song `GET /permissions/me` và `GET /fields`, rồi
  song song `GET /settings`, `GET /collections`, `GET /relations`, `GET /presets`, `GET /notifications` (chỉ các
  store này; store flows, insights, AI, extensions không nạp, D-45), rồi đặt ngôn ngữ; user không `app_access` PHẢI
  thấy màn "không có quyền vào app" với nút đăng xuất.
- **FR-017**: Guard route PHẢI ép `/tfa-setup` khi `enforce_tfa` của user là true mà `tfa_secret` null, hoặc khi
  localStorage `backoffice-require_tfa_setup` bằng id user; đã có `tfa_secret` mà vào `/tfa-setup` thì về
  `last_page`. Trang `/tfa-setup` PHẢI chạy `POST /users/me/tfa/generate` (mật khẩu) → QR từ `otpauth_url` và
  `secret` → `POST /users/me/tfa/enable` (`otp`, `secret`) như `use-tfa-setup.ts`.
- **FR-018**: Sau mỗi điều hướng tới route private không `track: false`, app PHẢI ghi `last_page` bằng `PATCH
  /users/me/track/page` (như `stores/user.ts` 11.17.4) sau 500 ms như `onAfterEach`; không ghi cho user share.
- **FR-019**: Chưa `setupCompleted` (từ `/server/info`) thì mọi route PHẢI về `/setup`; trang `/setup` gọi `POST
  /server/setup` như Directus rồi đăng nhập; đã setup thì `/setup` về `/login`.

**Bố cục và điều hướng**

- **FR-020**: Bố cục private PHẢI theo `design-system/docs/layout-patterns.md` (TailAdmin, Nguyên tắc XII 2.0.0, D-52):
  sidebar trái có logo và tên dự án, các module có icon và nhãn chữ, menu con của module (slot điều hướng của module),
  thu gọn được, menu user (avatar) và chuông thông báo dưới logo (D-127); header ở đầu vùng nội dung có nút mở hoặc thu
  gọn sidebar rồi page header (icon, tiêu đề, slot action) trên cùng một hàng (D-127), sau đó là nội dung; panel chi
  tiết là popover mở từ nút ở cuối page header (đóng khi vào trang, slot chi tiết, D-128). Trạng thái gập mở
  PHẢI lưu localStorage với tiền tố `backoffice-` (thay `directus-`, Nguyên tắc IX). Có menu bỏ qua tới nội dung
  (skip menu) cho bàn phím.
- **FR-021**: Danh sách module của sidebar PHẢI lấy `settings.module_bar` (hoặc mặc định như `MODULE_BAR_DEFAULT`), lọc `enabled` và
  module đã đăng ký, bỏ link Documentation mặc định (FR-081, D-49), hiện link nội bộ (`url` bắt đầu `/`) và link
  ngoài (mở tab mới); Settings luôn ở cuối cho admin;
  nhãn chữ của module (tooltip khi sidebar thu gọn); module đang mở được đánh dấu bằng màu và trạng thái `aria-current`,
  không chỉ bằng màu.
- **FR-022**: Module PHẢI đăng ký như `modules/index.ts`: `content` (mọi user), `files` (admin hoặc đọc
  `directus_files`), `users` (admin hoặc đọc `directus_users`), `insights` (admin hoặc đọc `directus_dashboards`),
  `activity` (ẩn khỏi thanh, có route), `settings` (admin). `visual`, `deployments`, AI, marketplace KHÔNG đăng ký
  (Nguyên tắc XI, D-17), giống Directus khi các tính năng đó tắt.
- **FR-023**: Route PHẢI là `/admin/content`, `/admin/files`, `/admin/users`, `/admin/insights`, `/admin/activity`,
  `/admin/settings` (và `/admin/settings` chuyển tới `/admin/settings/data-model` như Directus). Mỗi route module ở
  feature này PHẢI hiện bố cục private với icon, tên module ở thanh tiêu đề, tên module trong tiêu đề tab, và trạng
  thái trống nói rõ nội dung thuộc feature sau (D-40); các route con của module (`:primaryKey`, `folders/:folder`...)
  PHẢI khớp và hiện cùng khung để `last_page` và link từ Directus không rơi vào 404.
- **FR-024**: Route `/admin/users/me` PHẢI hiện trang hồ sơ (FR-060) (đã gỡ ở 015: màn user `/users/<id>`, D-48; `/users/me` bỏ như Directus); menu user dưới logo
  sidebar PHẢI có hồ sơ và đăng xuất (mục đích như `module-bar-avatar.vue`, vị trí theo `layout-patterns.md`, D-52,
  D-127).
- **FR-025**: Path không khớp PHẢI hiện trang 404 private trong bố cục (đã đăng nhập) như `private-not-found.vue`.
- **FR-026**: Vùng logo của sidebar PHẢI hiện `project_logo` từ `/assets/<id>` hoặc logo Backoffice và tên dự án
  (`project_name` hoặc `Backoffice`), bấm mở `project_url` nếu có, và chạy thanh tiến trình khi hàng đợi request còn
  việc như `module-bar-logo.vue`; `project_url` chỉ dùng khi scheme là `http` hoặc `https`, giá trị khác bỏ qua
  (logo không thành link). Menu con của module trống ở feature này.
- **FR-027**: Mọi phần tử điều hướng PHẢI dùng được bằng bàn phím (Tab, Enter, Esc đóng menu) và có nhãn truy cập
  (`aria-label` cho nút chỉ có icon) theo `design-system/docs/component-specs.md`.
- **FR-028**: Bố cục PHẢI hiển thị đủ từ bề rộng 768 px, không cuộn ngang, với breakpoint của design-system
  (TailAdmin, `layout-patterns.md`, owner chọn 2026-10-15): từ `xl` (1280 px) sidebar nằm trong bố cục (mở 290 px, thu
  gọn thành rail 90 px); dưới `xl` sidebar là drawer có lớp phủ; panel chi tiết là popover ở mọi bề rộng (D-128).
  Biên 768 và 1280 px được kiểm như các bề rộng khác; zoom 200% (tương đương dưới 768 px) ngoài phạm vi.
- **FR-029**: Tiêu đề tab PHẢI theo mẫu `<tiêu đề trang> · <project_name || Backoffice>`; `html[lang]` và `dir`
  theo ngôn ngữ user.

**Thương hiệu và branding từ settings**

- **FR-030**: Mọi chữ "Directus" người dùng thấy PHẢI là "Backoffice": tiêu đề mặc định, tên dự án mặc định, logo
  (thanh module, trang public, sáng và tối), favicon mặc định, meta `theme-color` mặc định (dùng màu primary của
  design-system thay `#6644ff`), chuỗi dịch (FR-080), key localStorage và sessionStorage (`directus-*` →
  `backoffice-*`). Dữ liệu từ API (`project_name` là "Directus" do người dùng đặt) giữ nguyên.
- **FR-031**: `project_color` từ `/server/info` PHẢI đặt biến `--project-color` và CHỈ dùng cho: nền logo (thanh
  module và trang public), trang public (đăng nhập, quên mật khẩu, nhận lời mời, setup, share), favicon sinh động, meta
  `theme-color`, `msapplication-TileColor`. `project_color` KHÔNG đổi màu primary của app (Nguyên tắc XII); màu
  primary chỉ đổi qua khóa `primary` của `theme_light_overrides`/`theme_dark_overrides` (FR-063, như Directus). Không
  có `project_color` thì dùng màu primary của design-system.
- **FR-032**: Favicon PHẢI theo thứ tự của Directus: `/assets/<public_favicon>` → sinh từ `project_color` (có
  hoặc không có chữ cái tùy có `project_logo`) → favicon Backoffice.
- **FR-033**: Trang public PHẢI có hai cột như `public-view.vue`: cột trái logo, `project_name`, `project_descriptor`
  (hoặc `application`), nội dung, notice; cột phải `public_background` (ảnh hoặc video) hoặc hoa văn mặc định,
  `public_foreground`, `public_note` (markdown, đã khử HTML nguy hiểm như Directus).
- **FR-034**: `custom_css` PHẢI được chèn vào trang như Directus (`#custom-css`).
- **FR-035**: Sau đăng nhập, app PHẢI nạp lại `/server/info` để lấy branding theo quyền (như `login` của Directus).
- **FR-036**: Logo và favicon Backoffice PHẢI là tài sản của dự án (SVG sáng, tối; `favicon.ico`), không dùng tài sản
  của Directus.
- **FR-037**: `/server/info` thiếu `project` (API lỗi quyền) thì app PHẢI hiện giá trị mặc định Backoffice, không ném
  lỗi.
- **FR-038**: Trình duyệt hỗ trợ: Chrome, Edge, Firefox, Safari hai bản ổn định mới nhất; không hỗ trợ IE và trình
  duyệt di động dưới 768 px.

**LDAP và SSO**

- **FR-040**: `GET /auth?sessionOnly` PHẢI nạp cùng `/server/info` khi khởi động; `providerOptions` tính như
  `stores/server.ts` (bỏ driver SSO, thêm `default_provider` khi không `disableDefault`); `AUTH_DISABLE_DEFAULT=true`
  thì provider đầu tiên được chọn sẵn và không có lựa chọn local.
- **FR-041**: Nút SSO PHẢI dẫn tới `<apiUrl>/auth/login/<provider>?redirect=<origin>/admin/login?continue` như
  `sso-links.vue` (icon và nhãn theo provider; nhãn `log_in_with`), lưu provider đã bấm vào localStorage
  (`backoffice-sso-provider`), và khi về `?continue` thì refresh và vào app.
- **FR-042**: Về từ SSO với `?error&code=<CODE>` thì hiện lỗi dịch theo mã; với `?reason=INVALID_OTP` thì hiện ô OTP
  trong khối SSO, gửi lại qua provider đã lưu với `otp` và cờ `sessionStorage` `sso_otp_attempted` như Directus.
- **FR-043**: Đăng nhập LDAP PHẢI dùng form `identifier` và xử lý `INVALID_OTP`, lỗi như local (FR-012).

**Quên mật khẩu, lời mời, setup, share**

- **FR-050**: `/reset-password` không token PHẢI gọi `POST /auth/password/request` với `email`; thành công hiện
  `password_reset_sent`; có token thì form mật khẩu mới gọi `POST /auth/password/reset` với `token`, `password`.
- **FR-051**: `/accept-invite?token=` PHẢI đọc `email` từ payload JWT của token (không xác minh chữ ký, như
  `jwt-payload.ts`), hiện email khóa, nhập mật khẩu, gọi `POST /users/invite/accept`, thành công hiện
  `account_created_successfully` và nút `sign_in`.
- **FR-052**: Hai màn trên PHẢI hiện thêm một dòng hướng dẫn liên hệ quản trị viên để nhận link đặt lại mật khẩu
  hoặc lời mời, vì hệ thống không gửi email (chuỗi mới `contact_admin_for_link` với bản `vi-VN`, `en-US`); dòng này là
  khác biệt D-42.
- **FR-053**: `/setup` PHẢI gọi `POST /server/setup` với các field như Directus (`setup.vue`) rồi đăng nhập admin vừa
  tạo.
- **FR-054**: `/shared/:id` PHẢI hiện trang đăng nhập share (mật khẩu khi share yêu cầu) gọi `POST /shares/auth`
  với `mode: session`, rồi refresh và mở route item của share như Directus (`shared.vue`); route item hiện khung
  content (D-40).
- **FR-055**: `/logout` PHẢI chạy đăng xuất (FR-015) và hiện vòng chờ như `logout.vue`.

**Hồ sơ, theme, ngôn ngữ**

- **FR-060**: Trang hồ sơ `/users/me` PHẢI là form với các field: `first_name`, `last_name`, `email`, `password`
  (ô mới, không hiện giá trị), `avatar` (chọn file qua `POST /files` của 007 hoặc giữ nguyên), `language`
  (`en-US`, `vi-VN` và mọi mã trong `available-languages.yaml`), `appearance` (`auto`, `light`, `dark`),
  `theme_light_overrides`, `theme_dark_overrides` (JSON); lưu bằng `PATCH /users/me` chỉ với field đã đổi; lỗi
  validation gắn với field; `title`, `description`, `location`, `tags` và các field còn lại của user thuộc feature
  module Users (D-40).
- **FR-061**: Ngôn ngữ PHẢI tính như `stores/user.ts`: `language` của user → `default_language` của settings →
  `en-US`; đổi là áp ngay (`setLanguage`): nạp chuỗi của ngôn ngữ, đặt `html[lang]`, nạp `GET /translations` theo
  ngôn ngữ, đặt locale ngày giờ.
- **FR-062**: Chuỗi dịch PHẢI lấy từ `directus/app/src/lang/translations/en-US.yaml` và `vi-VN.yaml` 11.17.4 bằng
  script sao chép và thay thương hiệu chạy một lần; file sinh ra commit trong `apps/web` với đường dẫn gốc ở đầu
  file (không sửa file trong `directus/`); chuỗi riêng của Backoffice nằm ở file overlay gộp lên sau; test kiểm
  tra file sinh khớp nguồn (chạy lại script không tạo khác biệt). Thiếu khóa thì rơi về `en-US`; app chỉ đóng gói
  hai ngôn ngữ này ở feature này, ngôn ngữ khác chọn trong hồ sơ thì rơi về `en-US` (D-46).
- **FR-063**: Theme PHẢI tính như `use-theme-configuration.ts`: `appearance` user → `default_appearance` → `auto`
  theo `prefers-color-scheme` (theo dõi thay đổi); class `dark`/`light` trên `html` (Directus đặt trên `body`; đặt
  trên `html` để utility `dark:` của Tailwind 4 bám được, không ảnh hưởng người dùng, D-43); theme design-system là
  mặc định; `theme_light_overrides`/`theme_dark_overrides` của user rồi của settings (settings thắng khi trùng khóa, như
  Directus) đè các biến theme có ánh xạ (`primary` → `--color-brand-500`, trạng thái → `--color-success-500`,
  `--color-warning-500`, `--color-error-500`, `fonts.sans.fontFamily` → `--font-outfit`; khóa không ánh xạ bỏ qua, D-43). `default_theme_light`, `theme_light`,
  `default_theme_dark`, `theme_dark` (tên theme Directus) KHÔNG đổi giao diện (D-43).
- **FR-064**: Theme tối PHẢI theo cách TailAdmin làm (class `dark:` trên các màu của theme, nền `gray-900`), không dùng
  mã hex thô trong component.
- **FR-065**: Giao diện (màu, chữ, khoảng cách, bo góc, shadow, component) PHẢI theo `design-system/` (Nguyên tắc
  XII 2.0.0): theme TailAdmin `design-system/tokens/theme.css` chép vào `@theme` của Tailwind 4 với tên gốc (`brand-*`,
  `gray-*`, `success-*`...); component theo
  `docs/component-specs.md` (Reka UI, `<script setup lang="ts">`, `modelValue`, trạng thái focus-visible, disabled,
  invalid, loading, empty; nhãn và lỗi gắn control). Component Tier 1 feature này cần: Button, Input, Select,
  Checkbox, Tooltip, Popover (menu avatar), Dialog (lỗi), Tag/Badge (notice).
- **FR-066**: `project_color` KHÔNG đè màu primary của theme (`--color-brand-500`, Nguyên tắc XII).
- **FR-067**: Các màn của feature (public, bố cục private, khung module, hồ sơ, 404) PHẢI đạt WCAG 2.1 AA: không có vi
  phạm mức `serious` hay `critical` khi quét tự động bằng axe-core; đi hết luồng đăng nhập, đổi module, mở menu
  avatar, đăng xuất chỉ bằng bàn phím với thứ tự focus hợp lý, focus nhìn thấy được, focus trả về nơi mở sau khi
  đóng menu hay dialog; lỗi đăng nhập và lỗi field được đọc (`role=alert` hoặc `aria-live`); tương phản chữ ≥ 4.5:1
  (chữ lớn ≥ 3:1), thành phần giao diện ≥ 3:1. Cặp token của design-system chưa đạt (Q-8) là ngoại lệ tạm có ghi
  rõ, không được thêm cặp mới.

**Triển khai, môi trường, chạy hai backend**

- **FR-070**: Image app web (001) PHẢI phục vụ app ở `/admin/` với fallback SPA; `config.json` ghi lúc khởi động
  container từ biến đã có ở 001.
- **FR-071**: Môi trường đối chiếu (`tests/parity`) PHẢI thêm profile `web` chạy app mới với ba cấu hình: (1)
  reverse proxy `/admin` → app mới, còn lại → Directus; (2) reverse proxy `/admin` → app mới, còn lại → API mới
  (cùng DB, Redis); (3) app mới ở origin riêng gọi API mới khác origin (hai site khác nhau trên máy chạy test, ví dụ
  `localhost` và `127.0.0.1`, không cần HTTPS vì trình duyệt coi hai host này là tin cậy) với các biến cookie và CORS
  ở FR-075; để E2E chạy cả ba (FR-090).
- **FR-072**: App KHÔNG gọi `/websocket`, `/extensions/sources/*`, `/mcp`, `/ai`, `/deployments` (Nguyên tắc XI);
  `websocket` trong `/server/info` chỉ dùng để ẩn tính năng.
- **FR-073**: App KHÔNG gửi header hay tham số nào ngoài những gì Directus app gửi (không dùng `Authorization`
  vì mode session; `Cache-Control: no-store` chỉ ở những request Directus app cũng bỏ cache).
- **FR-075**: App PHẢI chạy được khi `apiUrl` khác origin: mọi request gửi cookie (`credentials: include`), không có
  cấu hình cookie riêng ở app; tài liệu triển khai (`apps/web/README` hoặc docs của 019) PHẢI liệt kê các biến API cần
  đặt (`SESSION_COOKIE_SAME_SITE=None`, `SESSION_COOKIE_SECURE=true`, `CORS_ENABLED=true`, `CORS_ORIGIN`,
  `CORS_CREDENTIALS=true`) và nêu rõ cần HTTPS.
- **FR-074**: Tải lần đầu (bundle chính, chưa tính font) PHẢI hoàn tất tới màn đăng nhập trong 3 giây trên kết nối
  10 Mbps, cache lạnh (đo ở CI bằng Playwright, SC-008).

**Thương hiệu trong chuỗi dịch và tài sản**

- **FR-080**: Chuỗi dịch có chữ "Directus" PHẢI thay bằng "Backoffice" bằng script của FR-062 (không sửa tay),
  trừ các chuỗi nhắc tới định danh kỹ thuật `directus_*`, `@directus/*`, URL `directus.io` (giữ nguyên và ghi vào
  danh sách cần xác nhận).
- **FR-081**: Link Documentation mặc định (mục `{ type: 'link', id: 'docs' }` của `MODULE_BAR_DEFAULT`, `url`
  `https://docs.directus.io`) KHÔNG hiện trên thanh module: bỏ khỏi bản mặc định của app, và khi `settings.module_bar`
  đã lưu (Directus lưu cả mảng khi admin sửa thanh module) có mục `id: 'docs'` với đúng URL mặc định đó thì cũng không
  hiện. Mục `docs` mà admin đã đổi `url`, và mọi link khác, vẫn hiện như Directus. App không ghi lại `module_bar`
  (dữ liệu dùng chung giữ nguyên, D-49).
- **FR-082**: Không một chuỗi "Directus" nào xuất hiện trong DOM của E2E với DB mới (SC-005), trừ giá trị từ API.
- **FR-083**: Tài sản ASCII `DIRECTUS_LOGO` trong console: bỏ (không in gì).
- **FR-084**: Tên package `@backoffice/web` giữ như 001.

**Kiểm thử**

- **FR-090**: E2E Playwright (`apps/web-e2e`, đã có từ 001, mở rộng) PHẢI phủ US1 đến US6 và chạy ở ba cấu hình của FR-071 (API
  Directus cùng origin, API mới cùng origin, API mới khác origin; cấu hình khác origin chỉ cần chromium) trên chromium, firefox, webkit ở hai bề rộng 768 px và 1280 px; kênh `msedge` khi runner có; ghi lại
  mọi request để khẳng định FR-002.
- **FR-091**: Unit test (Vitest, happy-dom) PHẢI phủ: guard router (các nhánh của `onBeforeEach`), auth
  (`login`, `refresh`, `logout`, idle), store user (ngôn ngữ, `trackPage`), store server (`providerOptions`), theme
  (`appearance`, gộp overrides, ánh xạ token), thay thương hiệu trong chuỗi dịch, module bar (lọc và thứ tự), thay
  thế chuỗi; coverage `apps/web` ≥ 60% (Nguyên tắc X).
- **FR-092**: Kiểm tra tự động KHÔNG có mã hex thô và màu palette Tailwind trong `apps/web/src/**/*.vue`
  (lint rule hoặc script), trừ file token.
- **FR-093**: `tests/directus-app-e2e` hiện có giữ nguyên (Directus app qua proxy) để so hành vi; không sửa.

### Key Entities *(include if feature involves data)*

- **Phiên (session)**: cookie `directus_session_token` do API cấp ở mode session; app giữ `accessTokenExpiry`,
  `authenticated`, `hydrated`; không lưu token trong localStorage.
- **Người dùng hiện tại**: kết quả `GET /users/me` (danh sách field của Directus); quyết định ngôn ngữ, theme,
  `last_page`, `app_access`, `admin_access`, `enforce_tfa`, `tfa_secret`, `role`, `policies`, `share`.
- **Thông tin dự án (server info)**: `project` của `/server/info` (branding công khai, `default_language`,
  `default_appearance`, `theme_*_overrides`, `public_*`, `custom_css`, `public_registration`), `setupCompleted`,
  `websocket`, `version`.
- **Settings**: `GET /settings` sau đăng nhập (`module_bar`, `project_url`, branding đầy đủ theo quyền).
- **Provider xác thực**: `{ name, driver, icon, label }` từ `GET /auth?sessionOnly` và cờ `disableDefault`.
- **Module**: `{ id, name ($t:), icon, hidden, routes, preRegisterCheck }`; thứ tự và bật tắt từ `module_bar`.
- **Ngôn ngữ**: mã `xx-YY`; gói chuỗi `en-US`, `vi-VN` đã đổi thương hiệu; translations từ `directus_translations`.
- **Theme**: `appearance` (`auto`|`light`|`dark`), theme TailAdmin sáng và tối, overrides theo khóa Directus có
  ánh xạ.

## Khác biệt so với Directus *(mandatory)*

Mã tiếp theo sau D-38 (010; 011 không thêm). Khác biệt API đã ghi ở các spec trước (D-17, D-23, D-24, D-25, D-27,
D-37...) áp dụng qua API mới, không lặp ở đây.

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|------|
| D-39 | Chữ, logo, favicon, tiêu đề, tên dự án mặc định, meta `theme-color` mặc định, chuỗi dịch, key localStorage/sessionStorage | `Directus`, logo Directus, `#6644ff`, `directus-*` | `Backoffice`, logo Backoffice, màu primary design-system, `backoffice-*` | Nguyên tắc IX | đổi thương hiệu | — |
| D-40 | Nội dung bên trong module Content, Files, Users (trừ `/users/me`), Insights, Activity, Settings và route con | Đầy đủ | Khung bố cục với tiêu đề module và trạng thái trống; route con khớp để không 404 | Feature này chỉ là khung; mỗi module là feature riêng (Clarifications) | ngoài phạm vi (tạm thời) | 014 Content (và item của share): **đã gỡ ở 014**; 015 Files, Users, 016 Settings **đã gỡ ở 016** (trừ `/settings/flows`: khung tới 017, D-92 của 016), 018 Insights, Activity **đã gỡ ở 018** |
| D-41 | Module Visual editor, Deployments, AI, Marketplace, System logs, notifications realtime, collaborative editing, app extension | Có khi bật | Không đăng ký, không nạp; giống Directus khi tính năng tắt | Nguyên tắc XI, D-17 | ngoài phạm vi; app extension và Marketplace gỡ ở 020 (2026-10-21) | — |
| D-42 | Dòng hướng dẫn ở quên mật khẩu và nhận lời mời | Không có | Thêm một dòng "liên hệ quản trị viên để nhận link" | Mô tả feature; Nguyên tắc X (không gửi email) | khác | — |
| D-43 | Theme: tên theme (`Directus Default`, `Minimal`, `Color Match`), bộ biến `--theme--*`, overrides theo khóa Directus | `@directus/themes` | Theme TailAdmin của design-system; tên theme bỏ qua; chỉ overrides có ánh xạ sang biến theme được áp, khóa khác bỏ qua; class theme đặt trên `html` thay vì `body` | Nguyên tắc XII | khác | — |
| D-44 | Route `/register` (đăng ký công khai, xác minh email) | Có khi `public_registration` | Link hiện như Directus; `/register` là trang public "chưa có sẵn" với link về đăng nhập, không có form | Thuộc feature module Users; cần luồng xác minh email (D-28) | ngoài phạm vi | — (owner 2026-10-20: bỏ, không làm form đăng ký; trước đó "sau 015", Q2 = B) |
| D-45 | Dữ liệu nạp sau đăng nhập: store flows, insights, AI, extensions; drawer thông báo; sidebar chi tiết (thông tin, bình luận, revision...); tìm kiếm toàn cục | Có | Không nạp, không hiện; `GET /notifications` vẫn gọi để đếm | Thuộc feature module tương ứng | ngoài phạm vi | 013 (store flows: hydrate cho nút flow thủ công của `header`, `presentation-links`: **đã gỡ ở 013**), 014 (sidebar chi tiết item: **đã gỡ ở 014**, gồm revisions, comments, shares, flows, layout, archive, refresh, xuất/nhập), 017 (trình chỉnh sửa flows: **đã gỡ ở 017**), 018 (store insights, drawer thông báo: **đã gỡ ở 018**). Còn lại (owner 2026-10-20): store AI ngoài phạm vi vĩnh viễn (Nguyên tắc XI); store extensions có từ 020 (2026-10-21); Directus 11.17.4 không có tìm kiếm toàn cục trong `directus/app/src`, mục đó bỏ |
| D-46 | Ngôn ngữ đóng gói | Hơn 60 ngôn ngữ | `en-US`, `vi-VN`; ngôn ngữ khác trong hồ sơ rơi về `en-US` | Mô tả feature | khác | — |
| D-47 | Giao diện (màu, chữ, khoảng cách, bo góc, component) | Theme Directus | Design-system TailAdmin (`brand-*`, `gray-*`, font Outfit) | Nguyên tắc XII 2.0.0; owner chọn TailAdmin 2026-10-15 | khác | — |
| D-52 | Bố cục khung | Thanh module chỉ icon, thanh điều hướng riêng, thanh tiêu đề, avatar và đăng xuất ở thanh module, sidebar phải | Sidebar TailAdmin có nhãn (module + menu con), header có menu user (hồ sơ, đăng xuất), page header trong vùng nội dung, panel chi tiết phải (vị trí menu user, page header và panel đổi ở D-127, D-128); route, luồng và hành vi giữ như Directus ; đăng xuất ở menu user đi thẳng `/logout`, không có hộp `sign_out_confirm`; màn không có quyền vào app dùng nút `sign_out` thay cho `switch_user` (cùng đích `/logout`) | Nguyên tắc XII 2.0.0 (design-system quyết định bố cục khung); owner chọn 2026-10-15 | khác | — |
| D-48 | Trang hồ sơ `/users/me` | Form đầy đủ theo metadata field của `directus_users` | Form cố định với field ở FR-060 | Form theo metadata thuộc feature Users | ngoài phạm vi (tạm thời) | 015: **đã gỡ ở 015** (`/users/me` chuyển tới màn user `/users/<id>`, form theo metadata, D-86) |
| D-49 | Link Documentation mặc định trên thanh module (`docs` → `https://docs.directus.io`) | Hiện (mặc định và khi `module_bar` đã lưu có mục này) | Ẩn ở cả hai trường hợp; mục `docs` đã đổi `url` và link khác vẫn hiện; không sửa dữ liệu `module_bar` (FR-081) | Nguyên tắc IX: không dẫn người dùng Backoffice tới tài liệu Directus; owner chọn 2026-10-14 | đổi thương hiệu | — |
| D-51 | `project_name = 'Directus'`, `project_color = '#6644FF'` (giá trị mặc định cột mà Directus ghi vào mọi DB; API không cho đặt null) | Hiện "Directus", màu tím | Coi là chưa đặt khi hiển thị: tên `Backoffice`, màu primary design-system; không ghi DB; giá trị khác admin đặt vẫn dùng | Nguyên tắc IX; SC-005 với DB do Directus tạo; owner chọn 2026-10-14 | đổi thương hiệu | — |
| D-50 | Video `public_background` khi trình duyệt bật `prefers-reduced-motion: reduce` | `autoplay muted loop` luôn | Không autoplay (hiện khung đầu, có nút phát); không reduce thì như Directus | WCAG 2.2.2 (mức A) mà FR-067 yêu cầu; owner chọn 2026-10-14 | khác | — |
| D-53 | Bước license ở `/setup` (thông báo BSL, link đăng ký license, ô `setup_accept_license`, khóa `license` trong payload) | Có | Không có; form chỉ có thông tin admin và dự án, payload không có `license` | Nguyên tắc IX, XI: không dẫn người dùng Backoffice tới license Directus; owner chọn 2026-10-15 | đổi thương hiệu | — |
| D-126 | Trang `/shared/:id` sau khi đăng nhập share | Màn xem item chỉ-đọc riêng (`routes/shared/components/share-item.vue`, một `v-form` trong `shared-view.vue`), tiêu đề theo tên collection | Mở trang item của module Content trong session share (`SharedRoute.vue`), không có màn chỉ-đọc riêng | Owner 2026-10-20: bỏ màn chỉ-đọc, không port | khác | — |
| D-127 | Vị trí menu user, chuông và tiêu đề trang | Avatar và chuông ở cuối thanh module; header bar (tiêu đề, action) trong `main` | Menu user (avatar, tên) và chuông dưới logo sidebar (rail 90 px: chỉ avatar 40 px, chuông gom vào avatar thành badge, owner 2026-10-21; rail giữ mở rộng khi menu user hoặc popup chuông mở; dưới `xl` chuông ở cuối header vì sidebar là drawer đóng); header ở đầu `main` (sticky) gồm nút sidebar rồi page header (tiêu đề, action) trên một hàng; tiêu đề vẫn là `main h1` | Owner 2026-10-20 (thay vị trí header của D-52, FR-070/D-107 của 018) | khác | — |
| D-128 | Panel chi tiết bên phải | Cột sidebar phải trong bố cục, kéo đổi cỡ, dải icon khi gập | Popover (Reka) mở từ nút ở cuối page header ở mọi bề rộng, rộng 333 px, đóng khi vào trang; Esc hoặc click ngoài đóng, focus về nút; dialog mở từ panel không đóng popover; nút chỉ hiện khi trang có slot chi tiết; bỏ kéo đổi cỡ (`ResizeHandle.vue` gỡ) | Owner 2026-10-20 | khác | — |
| D-151 | Viền control của form (input, select, textarea, checkbox, radio, khung code/map, dropzone) và track toggle khi tắt | Viền theo theme Directus | Màu TailAdmin: viền `gray-300` / dark `gray-700`, track `gray-200` / dark `white/10`; bỏ quyết định C-2 (gray-500, 3:1), dưới 3:1 được chấp nhận (`design-system/docs/migration-guide.md`, component-specs) | Giống TailAdmin, owner 2026-10-22 | khác | — |
| D-152 | Nền trang (light) | Nền theo theme đang chọn; theme Color Match: `color-mix(in srgb, #FFFFFF, var(--theme--primary) 7%)` | Luôn là `color-mix(in srgb, var(--color-white), var(--project-color) 5%)` trên `body` (`styles/base.css`), như nền Color Match nhưng 5% thay vì 7% để chữ brand-500 giữ 4.5:1 (4.53:1 với màu project mặc định; màu project quá tối vẫn có thể hụt); dark giữ `gray-900` (Directus không có Color Match dark); `project_color` thêm vai trò này (layout-patterns §5, CLAUDE.md) | Owner 2026-10-22 | khác | — |
| D-157 | Vị trí danh sách module (cấp 1) | Thanh module dọc (icon) bên trái, điều hướng của module ở cột thứ hai | Thanh tab ngang trên cùng (`AppTopBar.vue`, `ModuleTabs.vue`): logo, tab module theo `module_bar` (tab `Extensions` có menu, D-144), chuông, menu user; sidebar chỉ còn điều hướng của module đang mở (tiêu đề module + action + slot `navigation`), ẩn được bằng nút ☰ (bỏ rail 90 px), không có sidebar khi trang không có điều hướng; dưới `xl` tab cuộn ngang và điều hướng là drawer; layout-patterns §2 | Menu 3 cấp khó đọc, owner 2026-10-22 | khác | — |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Chuỗi dịch nhắc tới `directus_*`, `@directus/sdk`, `directus.io` (ví dụ hướng dẫn trong settings) và tên theme
  `theme_directus_default|minimal|colormatch` (nhãn của dữ liệu `theme_light`/`theme_dark` trong DB; 012 không hiện
  vì D-43 bỏ chọn theme): giữ nguyên, liệt kê trong báo cáo của script thay thương hiệu (FR-080).
- Tên cookie `directus_session_token`, `directus_refresh_token` và key `sso_otp_attempted`: giữ (Nguyên tắc IX, cookie
  là của API).
- Tiêu đề `Content-Disposition` khi tải file từ app: không có ở feature này.

## Câu hỏi mở về design-system (Nguyên tắc XII)

Ngày 2026-10-15 owner chuyển design-system sang TailAdmin (constitution 2.0.0), nên Q-1 đến Q-6 và Q-8 đã có lời giải
từ theme TailAdmin; Q-7 đóng 2026-10-20.

| Mã | Câu hỏi | Trạng thái |
|----|---------|------------|
| Q-1 | Màu primary chuẩn | Đóng: `brand-500` `#465FFF` của TailAdmin |
| Q-2 | Font và thang chữ | Đóng: Outfit (`font-outfit`, OFL) với Noto Sans dự phòng cho tiếng Việt (Outfit không có subset vietnamese); thang `text-theme-*`, `text-title-*` và thang mặc định Tailwind |
| Q-3 | Nghĩa của màu trạng thái | Đóng: `success-*`, `warning-*`, `error-*`, `blue-light-*` (info) của TailAdmin, kèm icon và chữ |
| Q-4 | Thang radius và chiều cao control | Đóng: thang mặc định Tailwind như TailAdmin (`rounded-lg`, input `h-11`) |
| Q-5 | Theme tối | Đóng: theo TailAdmin (`dark:`, nền `gray-900`) |
| Q-6 | Ánh xạ override Directus | Đóng: FR-063 (`primary`, trạng thái, font) |
| Q-7 | Logo và favicon Backoffice | Đóng 2026-10-20 (owner duyệt): giữ chữ "B" (`assets/logo-*.svg`, `favicon.*`) |
| Q-8 | Tương phản token | Đóng theo bảng tương phản của `design-system/docs/migration-guide.md`; cặp dưới 4.5:1 (nếu có) ghi ở đó và là ngoại lệ của `a11y.spec.ts` |

## Clarifications

### Session 2026-10-14

- Q: Feature này chỉ là khung ứng dụng hay gồm cả nội dung module? → A: Chỉ khung (route module hiện bố cục,
  tiêu đề và trạng thái trống). Nội dung module theo lộ trình `SPECKIT-GUIDE.md` mục 5: 013 interfaces và displays,
  014 Content (kể cả trang item của share), 015 Files và Users (kể cả `/register`, hồ sơ đầy đủ), 016 Settings, 017
  Flows, 018 Insights, Activity, Notifications (D-40, D-44, D-45, D-48).
- Q: Chuỗi dịch `en-US`, `vi-VN` lấy từ Directus bằng cách nào? → A: Script chạy một lần, commit file đã sinh vào
  `apps/web` (ghi đường dẫn gốc ở đầu file); chuỗi riêng của Backoffice (ví dụ `contact_admin_for_link`) ở file
  overlay; test kiểm tra file sinh khớp nguồn và không còn chữ "Directus" ngoài danh sách giữ nguyên (FR-062, FR-080).
- Q: App và API có cần cùng origin không (cookie phiên mode `session`)? → A: Hỗ trợ cả khác origin: app giữ mode
  `session` như Directus; khi API khác origin, vận hành đặt `SESSION_COOKIE_SAME_SITE=None`,
  `SESSION_COOKIE_SECURE=true`, `CORS_ENABLED=true`, `CORS_ORIGIN=<origin app>`, `CORS_CREDENTIALS=true` ở API (tài
  liệu triển khai); E2E chạy thêm một cấu hình khác origin (FR-001, FR-071, FR-090, SC-001).
- Q: Link đăng ký ở trang đăng nhập khi `public_registration` bật, trong khi `/register` chưa có ở 012? → A: Giữ
  link như Directus, không làm form ở 012. Vì path lạ là route private (chưa đăng nhập sẽ bị đẩy về `/login` thành
  vòng lặp), `/register` ở 012 là một trang public trên PublicView báo "chưa có sẵn" với link về đăng nhập; 015 thay
  bằng form thật (FR-010, D-44); E2E kiểm link hiện và đích là trang này.
- Q: Chuẩn truy cập cho các màn của 012? → A: WCAG 2.1 AA (FR-067): quét tự động mỗi màn, đi hết luồng chính bằng
  bàn phím, tương phản token đo bằng test; cặp token của design-system không đạt (đo 2026-10-14) ghi ở Q-8, không tự
  đổi (Nguyên tắc XII).
- Q: SC-003 (5 người dùng thử) xử lý thế nào? → A: Làm sau khi CI xanh, ghi kết quả vào "Ghi chú khi làm" của
  tasks.md, không chặn đóng feature.
- Q: SC-005 có so ảnh chụp với Directus app làm cổng không? → A: Không; ảnh chụp chỉ để tham khảo (artifact), cổng
  là các khẳng định trên DOM.

### Làm rõ từ checklist release-gate (2026-10-14, owner duyệt)

Mỗi dòng đóng một mục `checklists/release-gate.md`. "Như Directus" là hành vi đọc trong `directus/app/src` 11.17.4.

- **Lỗi và giới hạn** (CHK001, CHK003, CHK005, CHK058, CHK065): mọi lỗi API ở các form (đăng nhập, TFA, share,
  quên mật khẩu, lời mời, hồ sơ) hiện qua `translateAPIError` (FR-012; `/setup` hiện message của API như Directus), kể cả `REQUESTS_EXCEEDED` (`429`),
  sai mật khẩu ở `/tfa-setup`, share hết hạn hoặc hết lượt; không có xử lý riêng như Directus. Nút gửi ở trạng thái
  `loading` trong lúc chờ nên không gửi lặp.
- **Khởi động** (CHK002, CHK017, CHK055, CHK084): `/server/info` và `/auth?sessionOnly` gọi song song
  (`Promise.all` như `stores/server.ts`); một trong hai lỗi thì màn lỗi FR-003; danh sách provider rỗng thì chỉ có
  local. `config.json` thiếu hay sai thì `apiUrl = '/'` (001); `apiUrl` sai thì request lỗi → màn lỗi FR-003. App chỉ
  hỗ trợ Directus 11.17.4; bản khác không kiểm, không cảnh báo; field thiếu ở `/server/info` dùng mặc định (FR-037).
- **Phiên** (CHK021, CHK022, CHK053, CHK054, CHK057, CHK059, CHK075): hẹn giờ refresh do `@directus/sdk`
  (`msRefreshBeforeExpires: 10_000`) như Directus app; `expires` nhỏ hơn 10 giây thì refresh ngay lần kế. Tab rảnh
  khi 5 phút không có `pointermove`, `pointerdown`, `keydown` hoặc khi tab bị ẩn (`idle.ts`). `accessTokenExpiry =
  Date.now() + expires` (tương đối, không đọc `exp`). Request thường lỗi mạng: không đăng xuất; `/auth/refresh` lỗi
  bất kỳ (kể cả mạng): đăng xuất `SESSION_EXPIRED` như `auth.ts`. Không đồng bộ ngôn ngữ, theme giữa các tab; thu
  hồi quyền hay đổi mật khẩu giữa phiên chỉ có hiệu lực khi hydrate lại hoặc ở lần `refresh()` kế tiếp (FR-001).
- **Người dùng share** (CHK006): như guard Directus: không ép TFA, không ghi `last_page`, không gọi `/settings`; thanh
  module, avatar và menu dùng chung bố cục private với các module mà quyền share cho phép.
- **Bố cục** (CHK007, CHK008, CHK010, CHK056, CHK072): bố cục private chỉ vẽ sau hydrate (màn chờ `hydrating`), nên
  không có trạng thái loading theo vùng; slot điều hướng và sidebar trống ở 012 (D-45), nút gập sidebar ở thanh tiêu
  đề, nút mở nav ở thanh tiêu đề dưới `lg`. Avatar: ảnh `/assets/<avatar>?key=system-medium-cover` khi có, icon
  `account_circle` khi không có hoặc ảnh lỗi. `module_bar` đã lưu dùng nguyên (không gộp mục mặc định thiếu như
  `visual`), id module không đăng ký bị bỏ, link giữ nguyên `url`.
- **Thương hiệu và chuỗi** (CHK011, CHK013, CHK028, CHK029): `public_note` qua `marked` rồi `DOMPurify` cấu hình mặc
  định như `v-md`. "Chữ người dùng thấy" gồm text DOM, `title`, `alt`, `aria-label`, tooltip, tiêu đề tab; console
  theo FR-083; tên file tải về không có ở 012. Danh sách giữ nguyên là danh sách đóng do script FR-062 in ra và ghi
  trong `translations/*.meta.json`: chuỗi chứa `directus_`, `@directus`, `directus.io` được giữ cả câu (chuỗi hỗn hợp
  không thay từng phần).
- **CSS từ settings** (CHK012, CHK067, CHK068, CHK069): `custom_css` chèn ở mọi trang (public và private) sau token và
  override theme như `app.vue`, không giới hạn kích thước, nội dung đặt bằng text của `<style>`. `project_color` chỉ
  được dùng khi `CSS.supports('color', value)`, không thì dùng màu primary của design-system (an toàn hơn Directus,
  không đổi hiển thị với giá trị hợp lệ). `project_name` hiển thị bằng nội suy text (Vue escape), cắt `…` bằng CSS khi
  dài.
- **Ngôn ngữ** (CHK014, CHK015, CHK016, CHK064): trước đăng nhập ngôn ngữ là `default_language` của `/server/info`
  rồi `en-US`. `dir` theo ngôn ngữ thật sự được nạp (`en-US`, `vi-VN` đều `ltr`), nên user chọn `ar-SA` vẫn `ltr`
  (D-46). `GET /translations` lỗi (`403`) hay rỗng thì bỏ qua như `set-language.ts`. Chuỗi overlay có đủ `en-US` và
  `vi-VN` (test kiểm), nội dung tiếng Việt do owner duyệt khi review.
- **Trạng thái trống của module** (CHK025): chuỗi overlay `module_placeholder` không nêu số feature (ví dụ "Nội dung
  của module này sẽ có ở bản cập nhật sau").
- **Hồ sơ và theme** (CHK060): JSON override sai ở hồ sơ báo lỗi ở field, không gửi; giá trị màu sai từ settings hay
  user được ghi vào biến CSS và trình duyệt bỏ qua, không ném lỗi.
- **Redirect và `last_page`** (CHK023, CHK070): theo FR-013; `last_page` chỉ được ghi cho route private (FR-018); giá
  trị lạ (`javascript:`, `/login`) qua `router.push` thành path của app.
- **Lời mời** (CHK071): token không phải JWT thì email trống và form gửi lên API, lỗi API hiện kèm dòng
  `contact_admin_for_link` (FR-052).
- **Video nền** (CHK061): D-50; transition của app tắt khi `prefers-reduced-motion: reduce`.
- **Bảo mật** (CHK077, CHK078, CHK079): không `v-html` với dữ liệu API hay chuỗi dịch, trừ `public_note` đã qua
  `DOMPurify`; `project_url` theo FR-026. CSP là việc của triển khai (feature 019), không ở 012. Trace Playwright chỉ
  giữ khi lỗi (`retain-on-failure`) và chỉ chứa tài khoản, token của môi trường test.
- **Hiệu năng** (CHK032, CHK044, CHK080, CHK081): SC-008 đo từ `navigationStart` tới khi nút `sign_in` hiện, trên
  chromium của runner CI với CDP 10 Mbps; bundle chính gzip ≤ 350 KB (R12); khởi động gọi đúng các request của
  contracts/api-calls #1, #2, #6. SC-002 đo từ click module tới khi tiêu đề module hiện ở thanh tiêu đề. Font
  (`font-display: block`, giấy phép OFL) không tính vào FR-074.
- **Kiểm thử** (CHK018, CHK019, CHK031, CHK047, CHK048, CHK083, CHK092, CHK098): ba cấu hình E2E chạy tuần tự trên
  cùng DB, dữ liệu tạo ra có tiền tố theo `E2E_CONFIG` và được dọn ở `afterAll`, không chạm dữ liệu của
  `tests/directus-app-e2e`. Token mời và đặt lại mật khẩu ký bằng `SECRET` với payload và `issuer: 'directus'` như
  `users.ts` của Directus (đã đọc mã nguồn). Project `msedge` chỉ chạy khi `PLAYWRIGHT_MSEDGE=1`, không có thì bỏ qua.
  Cặp `backoffice-api-web-cors` đặt `ACCESS_TOKEN_TTL` ngắn (30 giây) để kiểm SC-004 trong thời gian CI. vue-i18n
  `missingWarn` ghi `console.warn`; E2E fail khi có `pageerror`, `console.error` hoặc cảnh báo khóa thiếu. Header cho
  phép: `Content-Type`, `Accept` do SDK đặt; E2E khẳng định không có `Authorization`. Helper chép từ
  `tests/directus-app-e2e` ghi nguồn ở đầu file, không đồng bộ tự động.
- **Thuật ngữ** (CHK043, CHK094): "trang 404 private" (`PrivateNotFoundRoute`); "API mới" là `apps/api` của dự án,
  "app mới" là `apps/web`, "Directus thật" là image `directus/directus:11.17.4`.
- **Mốc và người trả lời** (CHK030, CHK090): "hai bản ổn định mới nhất" tính tại ngày đóng feature; design owner trả
  lời Q-1 đến Q-8 trước khi đóng 012, giá trị tạm chỉ nằm ở token (plan Constraints).
- **Khác** (CHK051, CHK096): provider SSO `MODE=json` không có xử lý riêng ở app (như Directus app); E2E chỉ dùng
  provider mode session. Query `/notifications` theo contracts/api-calls #26.

### Session 2026-10-15

- Q: Phần nhìn và bố cục khung? → A: Design-system TailAdmin (constitution 2.0.0), shell `xl` 1280 px, màu thay thế
  đạt AA trong theme, trang public là card giữa trên nền toàn trang (D-47, D-52).
- Q: Bước license BSL ở `/setup`? → A: Bỏ (D-53).
- Q: Đăng xuất không hỏi xác nhận, nút `sign_out` thay `switch_user` ở màn không có quyền vào app? → A: Đồng ý (D-52).
- Q: Lỗi chưa có bản dịch hiện gì? → A: `unexpected_error` như Directus (FR-012).
- Q: Khóa thiếu trong vi-VN của Directus (trang hồ sơ: `appearance_*`, `fields.directus_users.appearance`,
  `theme_*_overrides`, `default_sync_with_project`, `fields.directus_settings.default_language`, `invalid_input`)?
  → A: Giữ như Directus, rơi về en-US (FR-062); không thêm vào overlay. Các feature sau làm theo cùng quy tắc.

## Assumptions

- Feature này là khung ứng dụng; nội dung của sáu module là feature 013 đến 018 theo `SPECKIT-GUIDE.md` (D-40, Clarifications). Tiêu chí chấp nhận "điều hướng
  giữa các module giống Directus" hiểu là: URL, thanh module, quyền hiện module, tiêu đề, bố cục; không phải nội dung
  module.
- App dùng mode đăng nhập `session` (cookie) như Directus app ở cả cùng origin và khác origin (Clarifications,
  FR-075); app không có cấu hình cookie riêng.
- `/register` và trang hồ sơ đầy đủ thuộc feature module Users; `/shared/:id` chỉ có bước đăng nhập share ở đây.
- Chuỗi dịch lấy từ Directus 11.17.4 bằng script sao chép và thay thương hiệu chạy một lần, kết quả commit; build
  không phụ thuộc thư mục `directus/` (Clarifications).
- Design-system là bộ đề xuất; các giá trị tạm ở bảng Q-1 đến Q-7 chỉ để chạy, đổi ở token khi được duyệt.
- "Bản mới" của trình duyệt là hai bản ổn định mới nhất tại thời điểm phát hành feature.
- Avatar trong hồ sơ dùng `POST /files` đã có ở 007; không có cắt ảnh.
- App không nạp app extension, không có telemetry, không có banner license (Directus có `license-banner.vue`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cùng một bản build, ở ba cấu hình của FR-071 (API Directus thật, API mới cùng origin, API mới khác
  origin), bộ E2E đăng nhập
  (local có và không TFA, quên mật khẩu, nhận lời mời, setup, share), giữ phiên, đăng xuất đạt 100% ở cả ba
  (cấu hình khác origin chỉ trên chromium); kịch bản LDAP và SSO chạy ở cấu hình khác origin với hai API của cặp
  `sso` (Directus thật và API mới) vì cặp này không nằm sau reverse proxy; mọi request của app đều thuộc danh sách
  API Directus (0 request ngoài danh sách).
- **SC-002**: Với admin, user có quyền một phần và user chỉ đọc file, tập module hiện trên thanh và URL khi bấm từng
  module trùng với Directus app (cùng tài khoản, cùng settings) trong 100% ca E2E; mỗi lần đổi module vẽ xong khung
  trong dưới 1 giây sau khi dữ liệu đã nạp.
- **SC-003**: Người dùng quen Directus hoàn thành nhiệm vụ "đăng nhập, mở Files, mở Settings, mở hồ sơ, đăng xuất"
  không cần hướng dẫn trong dưới 1 phút (kiểm tra với 5 người dùng nội bộ, 5/5 đạt). Làm sau khi CI xanh, không chặn
  đóng feature (Clarifications).
- **SC-004**: Để app mở 3 lần thời gian sống của access token (mặc định `ACCESS_TOKEN_TTL` 15 phút) mà không phải
  đăng nhập lại; thu hồi phiên ở server thì về trang đăng nhập với lý do ở lần `refresh()` kế tiếp (tab hoạt động lại có lý
  do; tải lại trang thì không có lý do như Directus, FR-001).
- **SC-005**: Với DB mới (settings mặc định của Directus, D-51), DOM của mọi trang trong E2E không chứa chuỗi "Directus" (0 lần); với
  settings đã đặt branding, logo, tên, mô tả, màu, favicon, nền, ghi chú, `custom_css` đều áp đúng, kiểm bằng khẳng
  định trên DOM (nguồn ảnh, màu nền logo, `theme-color`, favicon, ghi chú đã khử HTML, CSS có hiệu lực). Ảnh chụp
  so với Directus app chỉ lưu làm tài liệu tham khảo, không phải cổng (Clarifications).
- **SC-006**: Đổi ngôn ngữ sang `vi-VN` áp ngay (không tải lại), 100% chuỗi của các màn trong feature có bản
  `vi-VN` hoặc rơi về `en-US` (0 khóa thô); đổi `appearance` áp ngay; cả hai được giữ sau khi tải lại.
- **SC-007**: Coverage `apps/web` ≥ 60%; lint, typecheck, unit, E2E (ba cấu hình), build image đều xanh; 0 mã hex
  thô hoặc màu palette Tailwind trong component.
- **SC-008**: Màn đăng nhập hiển thị trong dưới 3 giây trên kết nối 10 Mbps cache lạnh; bố cục không cuộn ngang ở
  768 px và 1280 px trên chromium, firefox, webkit (và `msedge` khi có).
- **SC-009**: Không có file nào trong `directus/` bị sửa; không có request ghi ngoài `PATCH /users/me`, `PATCH /users/me/track/page`, `POST
  /auth/*`, `POST /users/invite/accept`, `POST /server/setup`, `POST /shares/auth`, `POST /files` trong E2E
  (`POST /utils/resolve-redirect` chỉ đọc, được phép).
