# Contract: Reverse proxy và E2E app Directus (FR-106, SC-008)

Clarifications 2026-10-11 (Q2, Q3): app Directus 11.17.4 (app 15.10.0) chạy qua một reverse proxy định tuyến theo
danh sách route đã làm; Playwright kiểm ở CI và là cổng chặn merge.

## 1. Cách app Directus gọi API (đã đọc `directus/app/src`)

- `api.ts`: axios `baseURL = getRootPath()` (phần trước đoạn `admin` của `window.location`), `withCredentials: true`;
  không có header `Authorization`, không có header `X-Directus-*`. SDK: `createDirectus(getPublicURL())` (origin của
  trình duyệt), `authentication('session')`. Server `PUBLIC_URL` chỉ dùng cho `<base href="<path>/admin/">`.
- Đăng nhập: `POST /auth/login` `{ email, password, otp?, mode: 'session' }`; cookie `directus_session_token`;
  `POST /auth/refresh` `{ mode: 'session' }` ở lần điều hướng đầu và khi token sắp hết hạn.
- Query string: axios gửi `fields[]=a&fields[]=b`, `filter[_and][0][x][_eq]=...` (qs); SDK gửi `fields=a,b`,
  `filter=<JSON>`; URL dài thì dùng `SEARCH` với body `{ query }`.
- Nạp app (`hydrate.ts`): `/users/me?fields[]=*&fields[]=role.id`, `/policies/me/globals`, `/roles/me?fields[]=id`;
  khi `app_access`: `/permissions/me`, `/fields`; rồi `/collections`, `/relations`, `/settings`, `/presets` (ba lần,
  `limit=-1`), `/dashboards`, `/panels`, `/flows`, `/notifications` (`aggregate[count]=id`), `/translations`;
  `/extensions/sources/index.js` trước khi mount; `/server/info`, `/auth?sessionOnly`; sau mỗi điều hướng
  `PATCH /users/me/track/page`.
- Module User: `GET /roles?sort=name&fields[]=id,name,icon,parent`; `GET /users` với `limit=25`, `page`, `sort[]`,
  `fields`, `alias`, `search`, `filter`, `deep`; `GET /users?aggregate[countDistinct]=id` (hai lần); `GET /users/:pk`
  với `fields=*,role.*,avatar.id,avatar.modified_on`; `GET /permissions/me/directus_users/:pk`; `POST /users`,
  `PATCH /users/:pk`, `DELETE /users/:pk`, `PATCH /users` `{ keys, data }`, `DELETE /users` `[ids]`;
  `POST /users/invite` `{ email: [...], role }`; `POST /users/:pk/tfa/disable`; sidebar `GET /revisions`,
  `GET /comments`.
- Settings > Roles (cần `admin_access`): `GET /roles?limit=-1&fields[]=id,name,description,icon,users,children.name,children.id&deep[users][_aggregate][count]=id&deep[users][_groupBy][]=role&deep[users][_sort]=role&deep[users][_limit]=-1&sort=name`;
  `POST /roles { name }`; `GET /roles/:pk?deep={"users":{"_limit":0}}`; `PATCH /roles/:pk` với `policies: { create:
  [{ role, policy: { id } }], update, delete: [accessId] }`, `users: { create: [], update: [{ role, id }], delete }`,
  `parent`; `DELETE /roles/:pk`; trang Public: `GET /access?filter[_and]=[{role:{_null:true}},{user:{_null:true}}]&fields[]=id&limit=-1`,
  `POST /access [..]`, `PATCH /access [..]`, `DELETE /access [ids]`.
- Settings > Access Policies: `GET /policies?limit=-1&fields[]=id,name,icon,description,enforce_tfa,ip_access,app_access,admin_access,users,roles&deep...&sort=name`;
  `POST /policies { name, admin_access, app_access }` rồi `POST /permissions [quyền tối thiểu của app với policy]`
  khi `app_access` mà không `admin_access`; nhân bản: `GET /permissions?filter...&limit=-1&fields[]=...` rồi `POST
  /policies`, `POST /permissions [..]`; `GET /policies/:pk`; `GET /permissions?fields=*&filter={"_and":[{"policy":...}]}&page=0&limit=-1`;
  `PATCH /policies/:pk` với `permissions: { create, update, delete }`, `users`, `roles` (qua `directus_access`);
  `DELETE /policies/:pk`; `GET /permissions/me/directus_policies/:pk`, `GET /permissions/me/directus_roles/:pk`.
- Sau khi lưu role hoặc policy: `hydrate` lại `/users/me`, `/policies/me/globals`, `/roles/me`.

## 2. Reverse proxy (`tests/parity/proxy/`)

| Thứ | Giá trị |
|-----|---------|
| Service compose | `proxy`, profile `app`, image `nginx:1.27-alpine`, cổng host `8160` → container `80` |
| Upstream | `backoffice-api:8055` (cặp chính 8156 trên host), `directus:8055` (8155) |
| Danh sách route về app mới | `tests/parity/proxy/backoffice-routes.txt`: `auth`, `server`, `metrics`, `users`, `roles`, `policies`, `access`, `permissions` (mỗi feature sau thêm dòng: 005 `items`, 006 `collections`, `fields`, `relations`, `schema`, 007 `files`, `folders`, `assets`, 008 `activity`, `revisions`, `versions`, `comments`, 009 `flows`, `operations`, 010 `settings`, `presets`, `notifications`, `shares`, `translations`, `dashboards`, `panels`, `utils`, `extensions`, 011 `graphql`) |
| Cấu hình | `nginx.conf` sinh bởi `tests/parity/scripts/proxy-conf.mjs` từ danh sách: `location ~ ^/(auth\|server\|metrics\|users\|roles\|policies\|access\|permissions)(/\|$) { proxy_pass http://backoffice-api:8055; }`, `location / { proxy_pass http://directus:8055; }` |
| Header | `proxy_set_header Host $host; X-Forwarded-For $proxy_add_x_forwarded_for; X-Forwarded-Proto $scheme`; `proxy_http_version 1.1`; không ghi đè `Set-Cookie` (cùng origin `127.0.0.1:8160`) |
| Log | `access_log` có `$upstream_addr` để test kiểm route nào vào app nào |

`IP_TRUST_PROXY=true` (mặc định Directus) nên IP của accountability là IP thật của trình duyệt ở cả hai app.

## 3. Dự án Playwright `tests/directus-app-e2e`

- `project.json` (Nx): target `e2e` (`@nx/playwright:playwright`), `implicitDependencies: ["api"]`;
  `playwright.config.ts`: `BASE_URL` bắt buộc (không `webServer`), `chromium`, `retries: 1` ở CI, `trace:
  retain-on-failure`; `package.json` có `@playwright/test`, `knex`, `pg` (catalog).
- `src/helpers/login.ts`: đăng nhập `admin@example.com` / `password` qua giao diện; `src/helpers/db-rows.ts`: chụp
  dòng mới của bảy bảng (knex host 6100, chỉ SELECT), chuẩn hóa (uuid, id tự tăng, thời điểm, salt → dấu hiệu;
  JSON parse) như `db-effects` của 003; `src/helpers/proxy-log.ts`: đọc log nginx qua `docker logs`.
- Kịch bản (mỗi kịch bản chạy với `BASE_URL=http://127.0.0.1:8160` rồi `http://127.0.0.1:8155`, so hai bộ dòng DB):

| Spec | Bước | Request chính |
|------|------|---------------|
| `login.spec.ts` | Đăng nhập, app nạp xong, mở module User | `POST /auth/login`, `/users/me`, `/policies/me/globals`, `/roles/me`, `/permissions/me` → app mới; `/collections`, `/fields`... → Directus |
| `users.spec.ts` | Tạo user (first name, email, mật khẩu, role), lưu; sửa last name; mời một email (dialog Invite); xóa user | `POST /users`, `PATCH /users/:pk`, `POST /users/invite`, `DELETE /users/:pk`, `GET /users` (tabular) |
| `roles.spec.ts` | Tạo role; mở role, đặt `parent` = role có sẵn, gán policy, lưu; xóa role | `POST /roles`, `PATCH /roles/:pk` (`parent`, `policies: { create }`), `DELETE /roles/:pk` |
| `policies.spec.ts` | Tạo policy app access; thêm permission cho `directus_users` (read với filter `$CURRENT_USER`, field một phần, preset); gán user; sửa tên; xóa | `POST /policies`, `POST /permissions`, `PATCH /policies/:pk` (`permissions: { create, update, delete }`, `users`), `DELETE /policies/:pk` |
| `routing.spec.ts` | Sau `login.spec`: mọi request tới route trong danh sách có `$upstream_addr` là app mới; route khác là Directus | log nginx |

- Kết quả (SC-008): 100% spec đạt; dòng DB hai lần chạy giống nhau sau chuẩn hóa; mỗi spec dọn dữ liệu nó tạo.

## 4. CI

- `.github/workflows/ci.yml`: job `e2e-directus-app` (`runs-on: ubuntu-latest`, `timeout-minutes: 30`): checkout,
  node 22, `pnpm install`, `pnpm nx run api:build`, `env-up --vendor=postgres --profiles=app`, `playwright install
  --with-deps chromium` (thư mục `tests/directus-app-e2e`), `pnpm nx run directus-app-e2e:e2e`, log container khi
  lỗi, `env-down`. `publish.needs` thêm `e2e-directus-app`.
- `tools/ci-local.sh`: bước `e2e-directus-app` sau `e2e`.
- `nightly.yml`: không thêm (chỉ Postgres).
