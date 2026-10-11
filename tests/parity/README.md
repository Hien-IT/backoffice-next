# Parity tests

So sánh response của Backoffice API với Directus 11.17.4 trên cùng database, Redis và storage (FR-101..105). Mỗi request
được gửi cho cả hai app; status, bộ header của FR-104 và body phải giống nhau, trừ các khác biệt được chấp nhận trong
[`accepted-differences.ts`](accepted-differences.ts).

## Chạy

```bash
pnpm nx run parity-tests:env-up --vendor=postgres
```

```bash
pnpm nx run parity-tests:parity --vendor=postgres --output-style=static
```

```bash
pnpm nx run parity-tests:env-down --vendor=postgres
```

- `--vendor`: `postgres`, `postgres10`, `mysql`, `mysql5`, `maria`, `mssql`, `oracle`, `cockroachdb`, `sqlite3`. Đặt
  `TEST_DB` và thắng biến có sẵn. Mỗi vendor một compose project `parity-<vendor>`, cấu hình chung cho cả hai app ở
  `env/<vendor>.env`.
- `PARITY_SUITE=full` (mặc định): mọi file test. `PARITY_SUITE=reduced`: chỉ
  `src/server/{ping,health,info,errors,methods,conditional}.test.ts`, `src/schema/overview.test.ts` và
  `src/auth/{login,login-db,refresh,logout,password}.test.ts` và
  `src/permissions/{matrix-reduced,accountability,users,roles,write-rules}.test.ts`, bỏ các ca cần dừng container hoặc
  profile riêng. `PARITY_SUITE=matrix`: ma trận quyền (xem dưới). `PARITY_SUITE=blackbox` và `PARITY_SUITE=cache`:
  feature 005 (xem dưới).
- Profile riêng (chỉ dùng ở `full`), bật bằng
  `env-up --profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso,user-limits,app`:

  | Profile             | Directus | Backoffice | Cấu hình                                                              |
  | ------------------- | -------- | ---------- | --------------------------------------------------------------------- |
  | (chính)             | 8155     | 8156       | `env/<vendor>.env`                                                    |
  | `ratelimit`         | 8255     | 8256       | `env/profile-ratelimit.env`                                           |
  | `cors-hsts`         | 8355     | 8356       | `env/profile-cors-hsts.env`                                           |
  | `pressure`          | 8455     | 8456       | `env/profile-pressure.env`                                            |
  | `metrics`           | 8555     | 8556       | `env/profile-metrics.env`                                             |
  | `cache-config`      | 8755     | 8756       | `env/profile-cache-config.env`                                        |
  | `multi`             | —        | 8157       | `env/<vendor>.env` (instance Backoffice thứ hai của cặp chính)        |
  | `sso`               | 8955     | 8956       | `env/profile-sso.env` (IdP giả lập 6110, OpenLDAP 6109)               |
  | `user-limits`       | 8855     | 8856       | `env/profile-user-limits.env` (`USERS_*_ACCESS_LIMIT` thấp)           |
  | `app`               | —        | —          | reverse proxy nginx 8160 trước cặp chính (`proxy/`)                   |
  | `cache-mem`         | 9055     | 9056       | `env/profile-cache-mem.env` (bộ `cache`, feature 005)                 |
  | `cache-mem-purge`   | 9155     | 9156       | `env/profile-cache-mem-purge.env`                                     |
  | `cache-redis`       | 9255     | 9256       | `env/profile-cache-redis.env` (Redis riêng `redis-cache` 6111)        |
  | `cache-redis-purge` | 9355     | 9356       | `env/profile-cache-redis-purge.env`                                   |
  | `websocket`         | 9455     | 9456       | `env/profile-websocket.env` (`WEBSOCKETS_ENABLED=true`)               |
  | `blackbox`          | 9555     | 9556       | `env/profile-blackbox.env` (bộ `blackbox`, env của Directus blackbox) |

  Database dùng cổng host 6100–6107, Redis 6108, MinIO 8881.

- Chạy một file: `pnpm nx run parity-tests:parity --vendor=postgres -- src/server/info.test.ts`.
- So với một API đang chạy ngoài Docker: đặt `BACKOFFICE_URL` (hoặc `DIRECTUS_URL`) trước khi chạy.
- Unit test của chính bộ so sánh (không cần Docker): `pnpm nx test parity-tests`.

### Test schema và cache dùng chung (feature 002)

- `src/schema/`: so SchemaOverview hai bên (`overview`), đồng bộ schema và quyền (`sync`), dựng schema một lần
  (`build-once`), giá trị permissions cache (`permissions-cache`), tập lệnh Redis (`redis-trace`), Redis mất
  (`redis-down`).
- `src/redis.ts`:
  - `decodeMessage` đọc message và giá trị của `@directus/memory` (gzip khi có header gzip);
  - `flushSharedCaches` xóa permissions cache, cache response của Directus và schema trong bộ nhớ của mọi process;
  - `traceRedis` ghi mọi lệnh qua `MONITOR`; `containerAddress` cho IP container để lọc theo app.
- Hai app dùng chung permissions cache và trao đổi schema qua bus. Test so kết quả tính toán của hai app phải gọi
  `flushSharedCaches()` giữa hai lần chụp, nếu không app sau đọc giá trị app trước vừa ghi và che lỗi của chính nó.
- `src/schema/capture.ts`: lấy SchemaOverview của một app từ message `schemaCache--done` mà nó phát khi dựng schema, và
  phát lại message đó cho app kia.
- `src/schema/clear-system-cache.ts`: `clearSystemCacheIn(service)` chạy `clearSystemCache()` của bản build trong
  container app mới, không qua HTTP (chiều "app mới đổi schema" cho tới feature 006).
- Cả hai app trả GET từ cache response dùng chung khi `CACHE_ENABLED=true` (feature 005, D-11 đã gỡ). Env vendor đặt
  `CACHE_SKIP_ALLOWED=true`, `CACHE_STATUS_HEADER=x-cache-status`, và `capture()` gửi `Cache-Control: no-store` cho
  `GET`, `HEAD` khi request không tự đặt: mọi lần đọc của bộ so sánh là đọc mới ở cả hai app (vẫn ghi cache), header
  `x-cache-status` được so (FR-043). Helper `oasComponent` vẫn xóa cache trước khi đọc OAS, vì `schemaChanged` không xóa
  cache response nằm trên Redis. Các cấu hình cache khác chạy ở năm cặp của bộ `cache` (`src/items/cache-*.test.ts`).

### Test đăng nhập và phiên (feature 003)

- `src/auth/`: đăng nhập, refresh, logout, share, TFA, đặt lại mật khẩu, trạng thái user, bộ đếm đăng nhập sai,
  `LOGIN_STALL_TIME` (chỉ Postgres full), ma trận token, SSO OpenID, OAuth2, LDAP (profile `sso`).
- Luồng có trạng thái không dùng `parity()` (một refresh token không được gửi cho hai app cùng lúc):
  - `scenario()` chạy cùng các bước ở Directus rồi ở Backoffice, mỗi app một fixture (`createUserPerApp`), rồi so hai
    bản ghi sau khi `alias()` thay id, email bằng nhãn;
  - `matrix()` cấp token ở một app và dùng ở app kia, đủ 4 cặp;
  - `captureDbEffects()` đọc từ host (chỉ `SELECT`) dòng session, activity, revision, user mà một bước ghi.
- Fixture (user, role, policy, setting) tạo qua API Directus (`src/auth/fixtures.ts`), vì `/users` tới feature 004 mới
  có ở app mới; `setSettings()` trả hàm khôi phục.
- `src/auth/flows.ts`: đăng nhập theo chế độ, gửi lại token theo chế độ (`withToken`), lấy cookie. `src/auth/sso.ts`: đi
  qua IdP giả lập (`tests/parity/idp/server.mjs`); `src/auth/tokens.ts`: token đặt lại mật khẩu tự ký, OTP.
- Directus bật `CACHE_ENABLED` ở môi trường này: đọc trạng thái user từ DB, không qua `GET /users/:id` (cache cũ).

### Test phân quyền (feature 004)

- `src/permissions/`: accountability, CRUD `/users`, `/roles`, `/policies`, `/access`, `/permissions`, mời, đăng ký,
  TFA, `/permissions/me`, quy tắc đọc ghi, query, cache dùng chéo, port blackbox (`createRole()`, `createUser()`,
  `check-item-permissions`).
- Fixture của luồng ghi tạo bằng API của chính app đang thử (`appRequest(app, ...)` ở `src/directus-api.ts`,
  `src/permissions/fixtures.ts` nhận app làm tham số); fixture chỉ đọc tạo qua Directus. `cleanup()` xóa qua Directus.
- `src/permissions/flow.ts`: mỗi app chạy cùng các bước bằng admin của nó; response, dòng DB, activity, revision ghi vào
  transcript, id thay bằng nhãn (`name()`, `nameExact()` cho OTP). Activity, revision so như tập hợp vì Directus sắp
  khóa (`keys.sort()`). Tên theo app nên cùng độ dài (ma trận dùng `dir`, `bac`).
- Ma trận quyền (FR-101): `src/permissions/matrix.ts` sinh 650 nhóm (accountability × cấu hình quyền × `ip_access`), mỗi
  nhóm 30 ô; `matrix-harness.ts` chạy một nhóm. `PARITY_MATRIX_SHARD=<i>/<n>` chọn shard
  (`pnpm nx run parity-tests:parity-matrix --vendor=postgres`); không đặt thì chạy đủ. `matrix-reduced.test.ts`
  (`eachChoice()`) chạy trong bộ `reduced`.
- Profile `app`: `scripts/proxy-conf.mjs` sinh `proxy/nginx.conf` từ `proxy/backoffice-routes.txt` lúc `env-up`; log có
  `$upstream_addr`. Playwright ở `tests/directus-app-e2e` (`BASE_URL=http://127.0.0.1:8160`).
- Hai app của môi trường này bật response cache dùng chung (khóa theo user, path, query): ca đổi role khi token còn hạn
  dùng query khác nhau giữa các lần gọi, vì request của fixture (`appRequest`) không gửi `no-store`.

### Test items (feature 005)

- `src/items/crud.test.ts`, `export.test.ts`: `/items` và `?export=` trên cặp chính (bộ `full`; `crud` cả ở `reduced`).
- Bộ `blackbox` (`pnpm nx run parity-tests:parity-blackbox --vendor=<vendor>`, cần `env-up --profiles=blackbox`): bản
  copy của `directus/tests/blackbox` (items, query, relational) ở `src/items/blackbox/`, chạy hai lượt trên cặp
  `blackbox`: `PARITY_BLACKBOX_APP=backoffice` rồi `directus`. Setup (data model, role, user, GraphQL, `/comments`) luôn
  qua Directus của cặp (`getSetupUrl()`), request được thử qua app của lượt (`getUrl()`).
  `PARITY_BLACKBOX_PK_TYPES=integer` chạy bộ rút gọn (MySQL, SQLite ở CI). Chưa cần `known-failures.ts`: lượt `directus`
  đạt đủ trên Postgres, MySQL, SQLite. Seed thêm admin vào cùng database, nên chạy bộ này sau `full`; `db-unchanged`
  dừng sớm khi thấy hơn một policy admin.
- Bộ `cache` (`pnpm nx run parity-tests:parity-cache --vendor=postgres`, cần `env-up` với năm profile cache và
  `websocket`): port `cache.test.ts`, `cache-purge.test.ts` của Directus lên bốn cặp cache (`cache-blackbox`), ca dùng
  chéo key và giá trị (`cache-cross`), Redis của cặp dừng và R-10 (`cache-redis-down`), thông điệp `websocket.event`
  (`bus`). Fixture của cặp cache tạo qua Directus của cặp; sau khi đổi schema gọi `POST /utils/cache/clear?system` ở
  Directus của mọi cặp (mỗi cặp một bus).
- Cặp chính đặt `CACHE_SKIP_ALLOWED=true`, `CACHE_STATUS_HEADER=x-cache-status`; `capture()` gửi
  `Cache-Control: no-store` cho `GET`, `HEAD` khi request chưa đặt, nên bộ so sánh luôn đọc mới ở cả hai app và so
  header `x-cache-status`.

Image Directus chỉ có bản amd64; trên máy arm64 nó chạy giả lập nên chậm, các ca phụ thuộc thời gian dùng `parityStable`
để thử lại.

## Đọc báo cáo

Khi khác, test báo endpoint, vị trí (status, header hoặc JSON pointer), giá trị của Directus và của API mới, ví dụ:

```text
GET /server/info: 1 unaccepted difference(s)
  body /project/project_color
    Directus:   "#6644FF"
    Backoffice: "#000000"
```

## Thêm khác biệt được chấp nhận

1. Thêm dòng vào bảng "Khác biệt so với Directus" trong `specs/<feature>-*/spec.md` (mã `D-xx`, lý do, cột "Gỡ khi" nếu
   là tạm thời).
2. Thêm mục vào `accepted-differences.ts` với cùng `id`, `feature` là số của spec đó, `removeAt` khớp cột "Gỡ khi".
   - `kind: 'http'`: khác biệt trong response; khai báo `endpoints` (`'GET /path'`, `'* /path'`, tiền tố `'/path/*'`
     hoặc `'*'`), `location` (`{ status: true }`, `{ header }`, `{ jsonPointer }` chuỗi hoặc RegExp, `{ any: true }`),
     giá trị hai bên (`directus`, `backoffice`) và `when` nếu chỉ áp dụng khi Directus trả status hoặc mã lỗi nhất định.
   - `kind: 'doc'`: khác biệt ngoài HTTP (log, package, migration, khởi động); bộ so sánh bỏ qua.
3. `src/accepted-differences.test.ts` kiểm tra mỗi mục có trong bảng của đúng spec, `removeAt` khớp, và fail khi spec
   của feature `removeAt` đã `Status: Done` mà mục vẫn còn: lúc đó xoá mục và sửa API cho giống Directus.

## CI và quy trình merge

Workflow `.github/workflows/ci.yml` chạy test đối chiếu ở job `parity`, trên pull request và mỗi lần push `main`. Dự án
merge thẳng vào `main` (repo private gói GitHub Free không có branch protection): sau mỗi lần push, xem kết quả bằng
`gh run list --branch main` và sửa job đỏ ở commit tiếp theo. Khi repo có gói hỗ trợ branch protection, bật "Require
status checks to pass before merging" cho `main` với các check: `guard-directus`, `quality`, `guard-differences`,
`parity (postgres, …)`, `parity (mysql, …)`, `parity (sqlite3, …)`, `docker`, `e2e`, `security`, `semgrep`. Hai job
benchmark (`benchmark`, `benchmark-auth`) chạy ở workflow `Benchmark` (hằng tuần và bấm tay), không chặn merge.
