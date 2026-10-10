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
  `src/auth/{login,login-db,refresh,logout,password}.test.ts`, bỏ các ca cần dừng container hoặc profile riêng.
- Profile riêng (chỉ dùng ở `full`), bật bằng
  `env-up --profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso`:

  | Profile        | Directus | Backoffice | Cấu hình                                                       |
  | -------------- | -------- | ---------- | -------------------------------------------------------------- |
  | (chính)        | 8155     | 8156       | `env/<vendor>.env`                                             |
  | `ratelimit`    | 8255     | 8256       | `env/profile-ratelimit.env`                                    |
  | `cors-hsts`    | 8355     | 8356       | `env/profile-cors-hsts.env`                                    |
  | `pressure`     | 8455     | 8456       | `env/profile-pressure.env`                                     |
  | `metrics`      | 8555     | 8556       | `env/profile-metrics.env`                                      |
  | `cache-config` | 8755     | 8756       | `env/profile-cache-config.env`                                 |
  | `multi`        | —        | 8157       | `env/<vendor>.env` (instance Backoffice thứ hai của cặp chính) |
  | `sso`          | 8955     | 8956       | `env/profile-sso.env` (IdP giả lập 6110, OpenLDAP 6109)        |

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
- Directus trả GET từ cache response khi `CACHE_ENABLED=true` (D-11). Helper `oasComponent` xóa cache này trước khi đọc
  OAS, vì `schemaChanged` không xóa cache response nằm trên Redis.

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
- `src/auth/flows.ts`: đăng nhập theo chế độ, gửi lại token theo chế độ (`withToken`), lấy cookie. `src/auth/sso.ts`:
  đi qua IdP giả lập (`tests/parity/idp/server.mjs`); `src/auth/tokens.ts`: token đặt lại mật khẩu tự ký, OTP.
- Directus bật `CACHE_ENABLED` ở môi trường này: đọc trạng thái user từ DB, không qua `GET /users/:id` (cache cũ).

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
`parity (postgres, …)`, `parity (mysql, …)`, `parity (sqlite3, …)`, `benchmark`, `docker`, `e2e`, `security`, `semgrep`.
