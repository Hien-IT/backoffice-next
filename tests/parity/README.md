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
  | (chính)             | 8155     | 8156       | `env/<vendor>.env` + `env/extensions.env` (bộ extension mẫu, 020)     |
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
  | `web`               | —        | 8163       | `env/profile-web-cors.env` (web 8180, 8181; proxy 8161, 8162)         |
  | `extensions`        | 10655    | 10656      | `env/profile-extensions.env` (feature 020: prefix `extensions-ext`)   |

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
- `src/permissions/backoffice-permissions.test.ts` (spec 025): quyền `import`, `export` theo policy ở bảng
  `backoffice_permissions` (endpoint `/backoffice/permissions` chỉ có ở Backoffice). `GET /permissions/me` và
  `permissions_me` của `/graphql/system` có thêm hai khóa (D-189, `directus: {absent: true}`); import, export bị policy
  từ chối trả 403 ở Backoffice, 200 ở Directus (D-189.1, collection `parity_bo_perm_*`,
  `when.backofficeCode: FORBIDDEN`); Use custom (bộ lọc dòng, field, định dạng), xóa policy, collection kéo theo dòng.
  `normalizers.ts` bỏ bảng `backoffice_*` khỏi introspection, SDL; `parity.ts` không so ETag của `/permissions/me`.
  Deploy: `src/deploy/backoffice-permissions.test.ts` (quyền đổi ở replica này có tác dụng ngay ở replica khác; lb đưa
  `/permissions/me`, `/backoffice/*` tới Backoffice).

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
- `src/items/json-path.test.ts` (spec 023, bộ `full` và `reduced` trên mọi vendor): filter `json(field, path[, type])`
  qua `/items`, `SEARCH`, export, m2o, `[*]`, quyền trên field gốc. Directus trả 403 `FORBIDDEN` cho các request đó
  (D-184, `http` theo collection `parity_json_path_*`); Backoffice kiểm theo tập id mong đợi. Postgres chạy lại sau khi
  `ALTER` cột sang `jsonb` (`hostDb()` rồi xóa cache); SQLite cùng các case; vendor khác chỉ kiểm cổng vendor (400 có
  thông điệp). `sort=json(...)` và `fields=json(f, p, type)` so riêng từng app (D-184.2); permission có json path bị từ
  chối ở Backoffice (D-185). GraphQL `<f>_json` (D-186) ở `src/graphql/read.test.ts`, normalizer bỏ type
  `json_path_filter_operators` khỏi introspection/SDL; D-187 là phần web. Request đọc gửi `Cache-Control: no-store` vì
  key cache response dùng chung giữa hai app.
- `src/items/collection-toggles.test.ts` (spec 024, bộ `full` và `reduced` trên mọi vendor): `bo_show_search`,
  `bo_show_import`, `bo_show_export` tắt chặn API Backoffice. Request đọc (`GET`/`SEARCH /items`, `PATCH`/`DELETE` theo
  query không khớp dòng nào) gửi tới hai app, khác biệt chấp nhận là D-188 (`http`, collection `parity_toggles_*`,
  `when.backofficeCode: FORBIDDEN`); đường ghi, import, export, GraphQL (gốc, `_aggregated`, field lồng,
  `/graphql/system`, mutation) và `/users?deep` so riêng từng app (Backoffice trước, dữ liệu không đổi). Người gọi:
  admin, user (JWT và static token), share, public. Thêm case cache do Directus ghi trước (D-188.4) và case đổi cài đặt ở
  Directus không xóa cache tay (bus). File thêm alias o2m trên `directus_users` (chỉ dòng `directus_fields`), chạy một
  mình (`fileParallelism: false`). `flows/operations.test.ts` và `extensions/endpoints.test.ts` có case cài đặt tắt mà
  flow, endpoint extension vẫn chạy như Directus.
- Cặp chính đặt `CACHE_SKIP_ALLOWED=true`, `CACHE_STATUS_HEADER=x-cache-status`; `capture()` gửi
  `Cache-Control: no-store` cho `GET`, `HEAD` khi request chưa đặt, nên bộ so sánh luôn đọc mới ở cả hai app và so
  header `x-cache-status`.

### Test data model (feature 006)

- `src/schema-management/`: `/collections`, `/fields`, `/relations`, `/schema` trên cặp chính (bộ `full`; `crud` cả ở
  `reduced`). Đọc gửi tới hai app cùng lúc (`parity()`); ghi chạy nối tiếp trên cùng database với cùng tên
  (`ddl-scenario.ts`): Directus chạy chuỗi request, `ddl-capture.ts` chụp cột, index, khóa ngoại và ba bảng metadata, mô
  hình bị xóa qua Directus và database phải về đúng hình dạng cũ; rồi app mới chạy lại, chụp, xóa; hai bản chụp và từng
  response phải bằng nhau (`meta.id` thay bằng nhãn, danh sách `/fields`, `/relations` sắp lại vì Directus đọc không
  `ORDER BY`). `cleanupTables()` xóa lặp nhiều lượt vì bảng còn bị khóa ngoại trỏ tới thì `DROP TABLE` bị chặn.
- `cross-use.test.ts` dựng mô hình đầy đủ của 002 (`schema/fixture.ts`, nay nhận app) ở app này rồi dùng ở app kia;
  `sync-api.test.ts` (profile `multi`) đo thời gian app kia thấy thay đổi qua API (SC-005); `schema.test.ts` so snapshot
  từng byte, diff, apply.
- D-32: `DELETE /collections/<collection hệ thống>` không bao giờ gửi tới Directus (Directus xóa bảng của database dùng
  chung); `crud.test.ts` chỉ kiểm `403` của app mới.
- Blackbox: thêm `routes/collections`, `routes/fields`, `routes/schema`, `schema/timezone` và phần data model của
  `common/common.test.ts`. Node tự spawn của bản gốc là các cặp profile `schema-cache`, `schema-cache-nomsg`, `tz-asia`,
  `tz-america` (`env-up --profiles=blackbox,schema-cache,schema-cache-nomsg,tz-asia,tz-america`); shim `@common/config`
  ánh xạ `env[vendor].URL`, `env[vendor].TZ` sang cặp đó, `nodeUrl(profile, 1|2)` là app của lượt và app kia.
  `PARITY_BLACKBOX_SETUP_APP=backoffice` dựng seed qua app mới thay vì Directus (FR-064; lượt hằng tuần của
  `blackbox-full`). Khẳng định đọc `tests_extensions_log` (extension test của Directus) bị bỏ; event kiểm ở `bus`.

### Test files và assets (feature 007)

- `src/files/`: `/files`, `/folders`, `/assets`, zip, ghi lồng, ma trận transform, `/files/tus`, import URL, dùng chéo
  (`cross-use.test.ts`: ghi ở app này, đọc, tải, sửa, xóa ở app kia) và hai file e2e của Directus viết lại.
- Storage: `STORAGE_LOCATIONS=local,s3` ở env vendor. `local` là named volume `uploads` mount vào mọi container của hai
  app (một thư mục dùng chung), `s3` là MinIO. `PARITY_STORAGES` chọn location các test chạy qua (`local,s3` mặc định;
  CI chạy MySQL, SQLite chỉ `s3`). `storage-capture.ts` đọc object: `local` qua `docker compose exec directus`, `s3` qua
  `@aws-sdk/client-s3`.
- Upload sinh id ngẫu nhiên nên luồng ghi chạy `scenario()` (Directus rồi Backoffice) và so transcript sau khi thay id
  bằng nhãn; body nhị phân so bằng sha256. Request có transform dùng `parity(..., { sequential: true })`: gửi cùng lúc
  thì app này có thể stream object app kia đang ghi dở (R-17).
- `files-fixtures` (nginx) phục vụ `fixtures/files` cho import URL (`http://files-fixtures/...`: gzip, br, chuyển hướng,
  không `Content-Type`), thư mục `.data/files-runtime` (file 50 MB sinh lúc chạy, `env-up` tạo thư mục trước).
- Cặp `assets-limit` (MIME allow list, giới hạn upload, TUS hết hạn mặc định, nút revalidate của blackbox
  `cache-revalidate`) và `assets-stress` (một transform mỗi lúc, timeout 100 ms, TUS hết hạn 2 s,
  `ASSETS_CACHE_TTL=1h`): `env-up --profiles=assets-limit,assets-stress`. TUS ghi vào location đầu: ca S3 chạy trên
  `cors-hsts` (`STORAGE_LOCATIONS=s3,local`).
- Ma trận transform (`transform-matrix.test.ts`): Directus sinh, xóa file phát sinh, app mới sinh lại, so status,
  Content-Type, byte, tên object; rồi Directus đọc lại không ghi object mới. AVIF chỉ trùng byte khi app mới chạy amd64
  (compose ghim `platform: linux/amd64`). Chạy riêng:
  `PARITY_STORAGES=local,s3 npx vitest run -c vitest.parity.config.ts src/files/transform-matrix.test.ts`.
- Blackbox: `common/assets/*`, `routes/files/{storage,tus}`, `routes/collections/files`; shim `getStorages()` (tên
  `minio` là `s3`), `paths.cwd` là `fixtures`, `nodeUrl('assets-limit' | 'assets-stress', 1)` thay hai node tự spawn.
- Profile `app`: sau `env-up` tạo lại container, restart `proxy` (nginx giữ IP cũ của upstream).

### Test lịch sử, versions, comments (feature 008)

- `src/history/`: `/activity`, `/revisions`, `/versions` (gồm `?version=` ở `version-read.test.ts`), `/comments`, dùng
  chéo (`cross-use.test.ts`: revert, comment và thông báo ghi ở app này dùng ở app kia), chuỗi request của các màn lịch
  sử trong app Directus (`e2e-app.test.ts`) và job dọn lịch sử (`retention.test.ts`).
- `history-effects.ts`: `historyEffects(fn)` bắt dòng mới của `directus_activity`, `directus_revisions`,
  `directus_versions`, `directus_comments`, `directus_notifications`; `comparable()` thay id bằng nhãn, thời gian bằng
  `<time>`, liên kết giữa các dòng (`activity`, `parent`, `version`) bằng chỉ số hoặc `key`. Luồng ghi chạy `scenario()`
  và so cả response lẫn dòng lịch sử.
- `helpers.ts` `same()`: `parity()` báo lỗi với mọi khác biệt chưa được chấp nhận. Trong lúc làm, file `history` so
  không có entry tạm D-09.6 (nó chấp nhận mọi khác biệt của bốn route); feature 009 trở đi làm tương tự với D-09.x của
  mình. Request gửi `User-Agent`, `Origin` giống nhau (`BROWSER`) để so `user_agent`, `origin`, `ip` từng cột.
- Cặp `retention` (`RETENTION_SCHEDULE=*/10 * * * * *`, dọn lịch sử cũ hơn 2 s): dùng chung DB nên KHÔNG đưa vào
  `env-up --profiles`; `retention.test.ts` tự `profileUp('retention')`, `profileStop('retention')`, đếm tiến trình giữ
  khóa `schedule--data-retention` bằng `redis-cli monitor` trong container `redis`. Cặp có namespace bus, lock riêng.
- `bus.test.ts` (cặp `websocket`) thêm `versions.*` và `items.promote`; thời gian trong message thành `<time>`.

### Test flows (feature 009)

- `src/flows/`: CRUD `/flows`, `/operations` (`crud.test.ts`), webhook, manual, event, 15 operation, log chạy
  (`logs.test.ts`), nạp lại qua bus hai chiều (`reload.test.ts`), chuỗi request của màn Flows trong app Directus
  (`e2e-app.test.ts`) và flow theo lịch (`schedule.test.ts`).
- `helpers.ts`: `seedFlow()` tạo flow và operation qua API của một app rồi chờ `RELOAD_WAIT`; `settled()` tạo flow
  webhook thăm dò và chờ cả hai app trả lời nó (event flow bị lỡ nếu event tới giữa `unload` và `load` của một lần nạp
  lại); `same()` là `parity()` báo lỗi với mọi khác biệt chưa được chấp nhận (D-09.7 đã gỡ khi đóng 009, như D-09.6 ở
  008); `flowEffects()` là `historyEffects()` cho dòng activity `run` và revision của flow.
- Cặp `flows-schedule` (`*/2 * * * * *`, store đồng bộ Redis): dùng chung DB nên KHÔNG đưa vào `env-up --profiles`;
  `schedule.test.ts` tự bật, tắt cặp và đếm lần chạy mỗi nhịp (mỗi nhịp đúng một lần ở hai app).
- Request của operation `request` đi tới `http://files-fixtures/`: `IMPORT_IP_DENY_LIST` mặc định chặn IP của chính
  container nên Directus không gọi được `directus:8055`.
- Blackbox `tests/db/routes/flows/webhook.test.ts` chạy trên cặp `cache-mem` (`nodeUrl('cache-mem', 1)`), nên
  `parity-blackbox` có `cache-mem` trong `--profiles`.

Image Directus chỉ có bản amd64; trên máy arm64 nó chạy giả lập nên chậm, các ca phụ thuộc thời gian dùng `parityStable`
để thử lại.

### Test collection hệ thống còn lại (feature 010)

- `src/system/`: một file cho mỗi nhóm route (`settings`, `setup`, `presets`, `notifications`, `translations`,
  `insights`, `shares`, `extensions`, `utils-misc`, `import-export`) và chuỗi request của app Directus
  (`e2e-app.test.ts`). `helpers.ts` có `same()` (bỏ D-09.8, D-14 khi feature còn mở), `systemEffects()` (dòng mới của
  bảng hệ thống), `snap()` chỉ thay giá trị trùng nguyên id (id tự tăng nhỏ không thay chuỗi con).
- Registry giả `registry` (`registry/server.mjs`, luôn chạy, cổng host 6113): `GET /version`, `/extensions`,
  `/extensions/:id`, `/accounts/:id` từ `registry/fixtures/`, và `POST|GET /v1/owner` đếm báo cáo chủ dự án. Mọi
  `env/<vendor>.env` trỏ `MARKETPLACE_REGISTRY` và `COMPLIANCE_URL` tới nó. Registry giả không có download: Directus cài
  extension thì ghi dòng `directus_extensions` rồi trả `503` (dòng ở lại), app mới trả `503` không ghi (D-37).
- Cặp `setup` (Postgres riêng cổng 6112, app 10455/10456, không có admin): `setup.test.ts` và Playwright `setup.spec.ts`
  xóa user, role, policy, access do setup ghi giữa các lượt. Có trong `--profiles` của Postgres `full` và E2E.
- Blackbox `tests/db/mail/mail.test.ts`: app mới không gửi mail, ghi một dòng `warn`
  `Backoffice: mail sending is out of scope` cho mỗi mail Directus sẽ gửi (D-33).
- Sau `env-up` trên máy local, nếu container `directus` được tạo lại thì khởi động lại `proxy` (nginx giữ IP cũ).

### App web (feature 012)

- Profile `web` (`env-up --vendor=postgres --profiles=app,setup,sso,web`): ba cấu hình E2E của `apps/web-e2e`
  (`E2E_CONFIG`): `proxy-directus` (`http://127.0.0.1:8161`, `proxy/web-directus.conf`: `/admin/` → `backoffice-web`,
  còn lại → Directus), `proxy-api` (`http://127.0.0.1:8162`, `proxy/web-api.conf`: còn lại → API mới), `cors`
  (`http://localhost:8181` gọi `http://127.0.0.1:8163`, CORS, cookie `SameSite=None; Secure`, `ACCESS_TOKEN_TTL=30s`).
  `backoffice-web` 8180 là container web trực tiếp (`config.json` `apiUrl` `/`). Hai proxy web phân giải upstream mỗi
  request (`resolver` Docker), không cần restart khi container được tạo lại.
- Image `hiennd23/backoffice-web:local`: `env-up` build khi thiếu
  (`docker build -f apps/web/Dockerfile -t hiennd23/backoffice-web:local .` từ gốc repo); CI nạp từ artifact `images`.

### Test GraphQL (feature 011)

- `src/graphql/`: `read`, `write`, `system`, `schema` (introspection và SDL so nguyên văn, kể cả thứ tự), `errors`,
  `cache` (cặp `cache-redis-purge`, chạy trong suite `cache`), `e2e-app` (request của Insights và "Save as copy").
  `helpers.ts`: `sameGql()` gửi cùng document tới hai app (bỏ D-09.9, D-15 khi feature còn mở), mặc định
  `Cache-Control: no-store` vì `POST /graphql` cũng được cache; `createGraphqlModel(prefix)` dựng data model riêng mỗi
  file (m2o, o2m, m2m, m2a, singleton, versioning); `createGraphqlUsers()` tạo user A, B, C với policy riêng.
- Cặp `graphql-nointro` (cổng 10555/10556, cùng DB, Redis, namespace với cặp chính): `GRAPHQL_INTROSPECTION=false`,
  `GRAPHQL_QUERY_TOKEN_LIMIT=50`, `GRAPHQL_SCHEMA_CACHE_CAPACITY=2`, `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT=1`. Có
  trong `--profiles` của Postgres `full`.
- Blackbox: `requestGraphQL` gửi tới app đang thử; thêm `tests/common/auth/{login,refresh}`,
  `tests/common/logger/redact` (đọc log container thay `TestLogger`; cặp `blackbox` chạy `LOG_STYLE=raw`,
  `LOG_LEVEL=info`), `tests/db/routes/server/{ping,health}` (không SMTP giả).
- Lưu ý khi tạo data model qua API của Directus: field `json` không có `meta` bị `POST /collections` từ chối
  (`FAILED_VALIDATION collection, field`), cho `meta: { special: ['cast-json'] }`; `/versions` cần
  `meta.versioning: true` trên collection.

### Khởi tạo DB, migration và CLI (spec 021)

- Profile `bootstrap` (`env-up --vendor=postgres --profiles=bootstrap`, hoặc `--vendor=sqlite3`): Directus
  `directus-bootstrap` (10755) và Backoffice `backoffice-api-bootstrap` (10756) mỗi app bootstrap một DB **trống** bằng
  CMD của image (Postgres `postgres-bootstrap` cổng 6114: `directus_bootstrap`, `backoffice_bootstrap`, thêm
  `directus_partial`, `backoffice_partial`; SQLite: file `.data/bootstrap/<db>.db`), cùng `env/profile-bootstrap.env`.
  `directus-on-backoffice-db` (10757) chạy Directus trên DB của Backoffice. Owner report đi tới `registry-bootstrap`
  (6115). Mỗi DB một Redis db (10, 11; test dùng thêm 12, 13, 14) và namespace riêng.
- `global-setup` chụp trạng thái ngay sau bootstrap vào `.data/bootstrap/baseline.json` (một lần mỗi env; `env-up` xóa
  thư mục); `src/bootstrap/schema.test.ts` chỉ đọc file đó.
- `src/bootstrap/`: `schema` (bảng, cột, khóa, index, hàng sau FR-107, 101 migration, owner report, bí mật, thời gian),
  `cross` (khởi động lại DB đã cài, custom migration `fixtures/migrations/ok` qua `BOOTSTRAP_MIGRATIONS_DIR`, migrate
  chéo hai app, cache, migration bị từ chối), `partial` (DB cài dở), `cli` (mọi lệnh CLI hai app, so mã thoát, output,
  log), `init` (trả lời từng prompt qua `interactive()`), `vendor` (cổng D-145, chỉ `TEST_DB=mysql`, trên cặp chính).
  Chuẩn hóa: `src/bootstrap/normalize.ts` (đúng danh sách FR-107 của spec 021).
- Chạy riêng khi env đã lên: `TEST_DB=postgres pnpm exec vitest run -c vitest.parity.config.ts src/bootstrap`.
  `cli.test.ts` khoảng 5 phút. Máy có `DOCKER_DEFAULT_PLATFORM=linux/amd64`: bật `postgres-bootstrap` và
  `registry-bootstrap` với platform gốc.
- Deploy độc lập: `DEPLOY_MODE=standalone pnpm nx run parity-tests:deploy` (compose `docker-compose.standalone.yml`,
  `src/deploy/standalone.test.ts`, nhánh standalone của `compose.test.ts`); `DEPLOY_PROJECT` đổi tên project khi máy đã
  có môi trường `bo-deploy`.

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
