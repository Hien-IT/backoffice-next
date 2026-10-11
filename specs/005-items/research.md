# Research: Items (005)

Mỗi mục gồm Quyết định, Lý do, Đã cân nhắc. Mốc so sánh là Directus 11.17.4 (api 35.2.0). Điều gì chưa đo thì ghi
`[Suy luận]` và có task kiểm sớm. Các quyết định lớn đã chốt ở Clarifications của spec: cầu nối `websocket.event`
theo cùng điều kiện `WEBSOCKETS_*` như Directus; MySQL, SQLite theo tiền lệ 004; cặp chính giữ cache bật với
`CACHE_SKIP_ALLOWED=true` và bộ so sánh gửi `Cache-Control: no-store`; benchmark 10 triệu dòng; R-07 tái tạo; chỉ so
thông điệp bus, không dựng client WebSocket.

## R1. Thư viện và phiên bản

- **Quyết định**: Thêm vào catalog `pnpm-workspace.yaml` đúng bản của `directus/pnpm-workspace.yaml`: `json2csv` 5.0.7
  và `@types/json2csv` 5.0.7 (CSV của `ExportService.transform`), `js2xmlparser` 5.0.0 (XML), `eventemitter2` 6.4.9
  (`Emitter`). Dùng lại bản đã có: `js-yaml` 4.3.2 (catalog, bản vá bảo mật; Directus 4.1.1), `object-hash` 3.0.0
  (`getCacheKey`), `bytes` 3.1.2 (`CACHE_VALUE_MAX_SIZE`), `keyv`, `lodash-es`. Cho bộ test đối chiếu: `supertest`
  7.1.4 và `@types/supertest` (đã có trong catalog), thêm `json-to-graphql-query` 2.3.0 (`requestGraphQL` của blackbox,
  R6) và `seedrandom` 3.0.5 với `@types/seedrandom` 3.0.8 (`common/seed-functions.ts` của blackbox sinh giá trị theo
  seed). Không thêm `graphql-ws`, `ws` (phần WebSocket của blackbox bị bỏ, R6), `stream-json`, `papaparse`, `async`
  (`ImportService`, `exportToFile`, feature 010).
- **Lý do**: Cùng bản thì cùng byte: `json2csv` quyết định cách flatten và quote; `js2xmlparser` quyết định khai báo
  XML và thụt lề; `eventemitter2` quyết định thứ tự listener với wildcard. `js-yaml` 4.3.2 giữ bản vá như quyết định
  `joi` của 003; `[Suy luận]` `dump` không đổi giữa 4.1.1 và 4.3.2 cho kiểu dữ liệu của `data` (object, mảng, chuỗi,
  số, boolean, null, ngày dạng chuỗi); ca export YAML của FR-044 là phép đo, nếu lệch byte thì ghi khác biệt và hỏi
  chủ dự án.
- **Đã cân nhắc**: `@json2csv/plainjs` 7 (bản mới, có trong catalog Directus cho package khác): bị loại vì api khác và
  output khác `json2csv` 5. Viết CSV, XML tay: bị loại, không trùng byte.

## R2. Controller `/items` trong Nest và `respond(req, res)`

- **Quyết định**: `controllers/items.controller.ts` là `@Controller('items')` với một handler mỗi route của
  `controllers/items.ts`, cùng thứ tự: `@Post(':collection')`, `@Search(':collection')`, `@Get(':collection')`,
  `@Get(':collection/:pk')`, `@Patch(':collection')`, `@Patch(':collection/:pk')`, `@Delete(':collection')`,
  `@Delete(':collection/:pk')`. Port `middleware/collection-exists.ts` nguyên vẹn (dùng `systemCollectionRows` của
  `@backoffice/system-data` và `createCollectionForbiddenError` đã có) và gọi bằng `runMiddleware` ở đầu mỗi handler,
  trước `validateBatch` (mẫu R3 của 004). `ItemsService`, `MetaService` lấy qua factory của `providers.ts` (`ItemsService`
  thêm factory `(options) => new ItemsService(options.collection, {...})`; hoặc `new ItemsService(req.collection, ...)`
  trực tiếp như Directus, chọn khi làm, cả hai đều là lớp đã có). `respond` đổi chữ ký thành `respond(req, res)` vì phần
  cache và export cần `req` (`method`, `originalUrl`, `sanitizedQuery`, `accountability`, `collection`); sửa 82 chỗ
  gọi `respond(res)` trong 7 controller của 001 đến 004 (`auth`, `server`, `users`, `roles`, `policies`, `access`,
  `permissions`) trong cùng task. `router-options.ts` thêm hai dòng:
  `^/items/[^/]+/?$` → `POST,SEARCH,GET,HEAD,PATCH,DELETE`; `^/items/[^/]+/[^/]+/?$` → `GET,HEAD,PATCH,DELETE`
  (thứ tự đăng ký của router Directus; `OPTIONS` trả lời trước `collectionExists` nên collection lạ vẫn `200`, giống
  Express 4). `/items` không có collection → `404` của Nest.
- **Lý do**: FR-001 đến FR-006; giữ code Directus đọc được từng dòng; `runMiddleware` đã dùng cho `validateBatch`.
- **Đã cân nhắc**: Guard hoặc interceptor Nest cho `collectionExists`: bị loại, khác thứ tự lỗi so với Directus
  (`validateBatch` chạy sau `collectionExists`) và không chạy lại test gốc. Giữ `respond(res)` và đọc `req` từ
  `res.req`: bị loại, `res.req` không có trong type của Express và khác file gốc.

## R3. Response cache: port nguyên bốn util và hai middleware

- **Quyết định**: Port nguyên vẹn, cùng đường dẫn, kèm test gốc: `utils/get-cache-key.ts` (bỏ nhánh `/flows/trigger`
  và `getGraphqlQueryAndVariables`, ghi `Backoffice:` chúng thuộc 009 và 011; `version` lấy từ `DIRECTUS_COMPAT_VERSION`
  thay `directus/version`), `utils/get-cache-headers.ts`, `utils/should-skip-cache.ts` (dùng `Url` của
  `apps/api/src/utils/url.ts` và `getEndpoint` của `@backoffice/utils`), `utils/permissions-cacheable.ts` (dùng
  `fetchPolicies`, `fetchPermissions` của 004), `utils/get-string-byte-size.ts`; thay `middleware/cache.ts` và
  `middleware/respond.ts` bằng bản đủ (bỏ `useBufferedCounter` của telemetry, D-17). Giá trị cache ghi bằng
  `setCacheValue` đã có (nén `compress`), `__expires_at` không truyền TTL nên lấy TTL mặc định của Keyv (`CACHE_TTL`),
  như Directus. `getCache().cache` đã tồn tại từ 002.
- **Lý do**: FR-010 đến FR-014. Key trùng Directus chỉ khi object đưa vào `object-hash` có cùng field, cùng thứ tự, cùng
  giá trị: `{version: '11.17.4', user, path, query: req.sanitizedQuery, ip?}`; `req.sanitizedQuery` đã là object
  frozen của `sanitizeQuery` port nguyên, nên các key con và thứ tự giống Directus. Ca "cùng key" của FR-042 là phép đo.
- **Đã cân nhắc**: Tự tính TTL còn lại từ Keyv (`ttl` của entry) thay `__expires_at`: bị loại, Directus ghi hai key và
  Redis dùng chung phải có cả hai để app kia tính `max-age` giống nhau.
- **Rủi ro**: `object-hash` băm cả `undefined` và thứ tự key của `sanitizedQuery`; nếu `sanitizeQuery` của app mới đặt
  một key `undefined` mà Directus không đặt (hoặc ngược lại) thì key lệch. Task đầu của gói cache đo key cho 10 query
  mẫu ở hai app trước khi port phần còn lại.

## R4. Bộ so sánh với cache dùng chung (Clarifications)

- **Quyết định**: Mọi file `tests/parity/env/<vendor>.env` thêm `CACHE_SKIP_ALLOWED=true` và
  `CACHE_STATUS_HEADER=x-cache-status` (hai biến của Directus, chỉ ở env test). `parity.ts` `send()` thêm header mặc
  định `cache-control: no-store` cho request `GET`, `HEAD` khi request không tự đặt; `COMPARED_HEADERS` thêm
  `x-cache-status`, `content-disposition`. Hai app khi đó trả `Cache-Control: no-store`, `x-cache-status: MISS` cho mọi
  `GET` của bộ so sánh. Các fixture (`appRequest`, blackbox shim) không thêm header: cặp chính có
  `CACHE_AUTO_PURGE=true` nên mọi thao tác ghi xóa cache dùng chung, đọc sau ghi luôn mới. Ghi chú D-11 trong
  `tests/parity/README.md` và `profile-cache-config.env` sửa theo (profile này giữ `CACHE_ENABLED=false` vì
  `redis-down` cần, ghi lý do mới).
- **Lý do**: FR-043, SC-009; một dòng env và một header mặc định; mọi route của 001 đến 004 vẫn đi qua `getCacheKey`,
  `shouldSkipCache` ở cả hai app nên lệch ở đường cache lộ ra ngay trong bộ chính.
- **Đã cân nhắc**: Xóa key giữa hai lần gọi (B), tắt cache cặp chính (C): chủ dự án chọn A.

## R5. Bốn cấu hình cache và cặp bật WebSocket

- **Quyết định**: Thêm vào `tests/parity/docker-compose.yml` năm cặp profile, mỗi cặp một Directus và một Backoffice
  đọc `env/<vendor>.env` cộng `env/profile-<tên>.env`:

  | Profile | Cổng (Directus, Backoffice) | Env riêng |
  |---------|-----------------------------|-----------|
  | `cache-mem` | 9055, 9056 | `CACHE_ENABLED=true`, `CACHE_STORE=memory`, `CACHE_AUTO_PURGE=false`, `CACHE_NAMESPACE=parity-cache-mem` |
  | `cache-mem-purge` | 9155, 9156 | như trên, `CACHE_AUTO_PURGE=true`, namespace `parity-cache-mem-purge` |
  | `cache-redis` | 9255, 9256 | `CACHE_STORE=redis`, `CACHE_AUTO_PURGE=false`, namespace `parity-cache-redis`, `REDIS` trỏ service `redis-cache` riêng (cổng host 6109), `CACHE_VALUE_MAX_SIZE=1kb`, `WEBSOCKETS_ENABLED=true`, `WEBSOCKETS_REST_ENABLED=true` (R-10, R9) |
  | `cache-redis-purge` | 9355, 9356 | `CACHE_STORE=redis`, `CACHE_AUTO_PURGE=true`, namespace `parity-cache-redis-purge` |
  | `websocket` | 9455, 9456 | `WEBSOCKETS_ENABLED=true`, `WEBSOCKETS_REST_ENABLED=true`; cache, bus, namespace như cặp chính |

  Bốn cặp cache đặt `CACHE_STATUS_HEADER=x-cache-status`, `CACHE_SKIP_ALLOWED=false` (test gửi request không header
  như blackbox) và `CACHE_AUTO_PURGE_IGNORE_LIST=directus_activity,directus_presets,<collection bỏ qua của
  cache.test.ts>`; mỗi cặp có `REDIS_BUS_NAMESPACE`, `REDIS_LOCK_NAMESPACE`, `REDIS_PERMISSIONS_NAMESPACE` riêng như
  `cache-config` của 002 vì `CACHE_NAMESPACE` khác thì cache hệ thống khác, không nên chung bus `schemaChanged` với cặp
  chính. Cặp `websocket` dùng chung namespace và bus với cặp chính (như `multi`), test lọc thông điệp theo tên
  collection của lần chạy. `config.ts` `profilePorts` thêm năm dòng; `global-setup.ts` tự đặt URL theo bảng. Test của
  năm cặp `describe.skipIf` khi profile không chạy (mẫu `cache-config`). CI: job mới `parity-cache` (Postgres) chạy
  `env-up --profiles=cache-mem,cache-mem-purge,cache-redis,cache-redis-purge,websocket` và `PARITY_SUITE=cache` (file
  `src/items/cache*.test.ts`, `src/items/bus.test.ts`), tách khỏi job `parity` để mỗi job dưới 60 phút và dưới giới
  hạn bộ nhớ runner (`[Suy luận]` mỗi container Directus khoảng 200 MB RSS; job `parity` hiện có khoảng 20 container).
- **Lý do**: FR-042, FR-045; blackbox của Directus chạy bốn process `directus start` với env khác nhau
  (`cache.test.ts:60-90`), tương đương bốn cặp container.
- **Đã cân nhắc**: Khởi động lại một cặp với env khác giữa các nhóm ca: bị loại, `docker compose` không đổi env khi
  đang chạy, và các ca chạy tuần tự chậm hơn chạy song song bốn cặp.

## R6. Port bộ blackbox items, query, relational

- **Quyết định**: Thư mục `tests/parity/src/items/blackbox/` giữ nguyên cấu trúc của `directus/tests/blackbox` để
  diff với bản gốc đọc được:
  - `tests/db/routes/items/{no-relation,m2o,o2m,m2m,m2a,relational-json,json-fields,singleton,case-when,
    conceal-filter,hash-filter}.{test,seed}.ts`, `seed-all-field-types.ts`, `seed-relational-fields.ts`;
    `tests/db/query/{index,filter/index}.ts`; `tests/db/schema/**/index.ts` (trừ `timezone`); `common/seed-functions.ts`,
    `common/types.ts`, `common/variables.ts` (bỏ `DEFAULT_DB_TABLES`): copy nguyên, header `// Ported from`.
  - Sửa cơ học trong file test, mỗi chỗ có `// Backoffice:`: bỏ các khối WebSocket (`createWebSocketConn`,
    `createWebSocketGql`, `getMessages`, các `expect` trên `wsMessages*`): 6 chỗ ở `no-relation`, 4 ở `m2o`, 4 ở `o2m`
    (Nguyên tắc XI, D-17). Giữ nguyên mọi khẳng định REST và GraphQL.
  - Chạy trên cặp profile `blackbox` (9555, 9556), env `env/profile-blackbox.env` chép từ
    `directus/tests/blackbox/common/config.ts`, vì nhiều khẳng định phụ thuộc env đó (`MAX_BATCH_MUTATION=100`,
    `QUERY_LIMIT_DEFAULT=90`, `MAX_RELATIONAL_DEPTH=5`, không response cache). Quyết định khi làm T016.
  - Chỗ phải sửa ngoài khối WebSocket, mỗi chỗ có `// Backoffice:`: `case-when.seed.ts` tạo collection, relation và
    `case-when.test.ts` gọi `/comments` qua `getSetupUrl`; hai ca "Verify ... action hook run" của `no-relation.test.ts`
    đọc `tests_extensions_log` (extension test của Directus, D-17) bị bỏ; `00-seed.test.ts` xóa user, policy và
    collection của `case-when` trước mỗi lượt (bộ gốc chạy trên DB mới). Typecheck chỉ các shim (Directus không
    typecheck bộ blackbox: code gốc lỗi với cờ strict của `@directus/tsconfig`).
  - Shim `common/` thay cho bản gốc (alias `@common/*` trong `vitest.blackbox.config.ts`): `config.ts` với
    `getUrl(vendor)` trả URL của app đang thử (`PARITY_BLACKBOX_APP`, `backoffice` hoặc `directus`) và `getUrl` của
    Directus cho `functions.ts` phần collection, field, relation (`CreateCollection`, `CreateField*`, `CreateRelation`,
    `DeleteCollection`, `DeleteField` gọi Directus, D-09.4; `CreateItem`, `ReadItem`, `UpdateItem` gọi app đang thử);
    `transport.ts` chỉ có `requestGraphQL` trỏ về Directus (D-09.9; feature 011 đổi về app đang thử); `get-dbs-to-test`
    dùng bản của parity; `PRIMARY_KEY_TYPES` đọc `PARITY_BLACKBOX_PK_TYPES` (mặc định đủ ba kiểu) cho bộ rút gọn.
  - `00-seed.test.ts` chạy đầu tiên (sequencer tự viết, port `setup/sequencer.ts` rút gọn): tạo qua API của Directus
    role, policy, access, user có static token cho `USER.ADMIN`, `APP_ACCESS`, `API_ONLY`, `NO_ROLE` và `TESTS_FLOW`
    (thay `02_tests_flow.js` và `createRole()`, `createUser()` của `common.test.ts`; bỏ qua nếu đã có), rồi gọi
    `seedDBStructure()` của từng seed (như `seed-database.test.ts`, không có `sequencer-data.json`).
  - Chạy: `PARITY_SUITE=blackbox` trong `parity.mjs` chạy vitest hai lượt, `PARITY_BLACKBOX_APP=backoffice` rồi
    `directus`; seed xóa và tạo lại collection ở mỗi lượt (`DeleteCollection` đầu `seedDBStructure`) nên item của lượt
    trước không còn. Lượt `directus` chứng minh bản port trung thành (mọi ca phải đạt ở Directus).
  - CI: job `parity-blackbox` (Postgres, đủ) tách khỏi `parity`; MySQL, SQLite: job `parity` hiện có chạy thêm
    `PARITY_SUITE=blackbox` với `PARITY_BLACKBOX_PK_TYPES=integer` (bộ rút gọn: mọi file, mọi toán tử, một kiểu khóa);
    `parity-matrix.yml` thêm job `blackbox-full` cho `mysql`, `sqlite3` đủ ba kiểu khóa (hằng tuần, bấm tay, FR-041).
- **Lý do**: FR-040, FR-041, SC-001. Các ca xen REST, GraphQL và WebSocket trong cùng `it` (ví dụ
  `no-relation.test.ts:160-215`), nên không tách được bằng `describe`; GraphQL về Directus giữ được khẳng định (cùng DB,
  cache dùng chung bị xóa khi ghi); WebSocket ngoài phạm vi vĩnh viễn nên bỏ hẳn. Chạy nguyên file với URL từng app
  rẻ hơn nhiều so với viết lại 220 ca thành `scenario()` (cách của 004 chỉ dùng cho 7 ca).
- **Đã cân nhắc**: `scenario()` cho mọi ca: bị loại vì khối lượng. Chạy GraphQL về Directus bằng `requestGraphQL`
  gửi `Cache-Control: no-store`: không cần, `CACHE_AUTO_PURGE=true`. Giữ khối WebSocket và trỏ về cặp `websocket`: bị
  loại theo Clarifications (không kiểm tới client WebSocket).
- **Rủi ro**: Ca fail trên chính Directus ở MySQL (001 ghi 4 lỗi có sẵn, chưa rõ có thuộc items không): lượt
  `directus` lộ ra; bỏ qua theo vendor bằng `it.skipIf` kèm ghi chú (Assumptions của spec). Thời gian: `[Suy luận]`
  khoảng 660 ca mỗi lượt (220 × 3 kiểu khóa), 5 đến 10 phút mỗi lượt trên CI.

## R7. Export: chỉ `transform`

- **Quyết định**: `services/import-export.service.ts` chứa lớp `ExportService` với constructor
  (`knex`, `accountability`, `schema`) và `transform()` port nguyên; `exportToFile`, `getHeadingsForCsvExport`,
  `ImportService` ghi `Backoffice:` thuộc feature 010 (`/utils/export`, `/utils/import`). `respond.ts` dùng
  `getDateTimeFormatted` của `@backoffice/utils` và `res.attachment()` của Express (cùng gói `content-disposition` ở
  Express 4 của Directus và Express 5 của app mới, nên cùng cách quote tên file; ca FR-044 so header).
- **Lý do**: FR-020, FR-021; D-12.
- **Đã cân nhắc**: Port cả `exportToFile`: bị loại, cần `FilesService`, `NotificationsService` (007, 010).

## R8. Emitter thật và cầu nối `websocket.event`

- **Quyết định**: Thay `emitter.ts` thế chỗ bằng port nguyên `directus/api/src/emitter.ts` (`eventemitter2`), giữ
  `useEmitter`, `default`; `emitter.test.ts` viết mới (filter tuần tự, payload thay thế, action lỗi → hai dòng `warn`,
  `off*`). Port `websocket/controllers/hooks.ts` cùng đường dẫn, bỏ import `WebSocketEvent` zod của
  `websocket/messages.ts` bằng type thuần `WebSocketEvent` trong `apps/api/src/websocket/messages.ts` (ghi `Backoffice:`
  chỉ là type, không có zod). Điểm gọi: `app.ts` sau khi Nest init, `registerWebSocketEvents()` khi
  `toBoolean(WEBSOCKETS_ENABLED)` và (`toBoolean(WEBSOCKETS_REST_ENABLED)` hoặc `toBoolean(WEBSOCKETS_GRAPHQL_ENABLED)`),
  comment trỏ `websocket/controllers/rest.ts:18`, `graphql.ts:26`, `server.ts:104` (Clarifications). Không có file
  `websocket/index.ts`, không controller WebSocket.
- **Lý do**: FR-030 đến FR-033; mọi service đã giữ lời gọi emitter nên không sửa service nào.
- **Đã cân nhắc**: Bọc `emitter` trong provider Nest: bị loại, Directus dùng singleton module; service port gọi
  `emitter` trực tiếp.

## R9. Test đối chiếu mới trong `tests/parity/src/items/`

- **Quyết định**: Thư mục `src/items/` (ngoài `blackbox/`):
  - `crud.test.ts`: `scenario()` + `flow` của 004 cho US1 (tạo lồng, hàng loạt, `SEARCH`, singleton, collection lạ,
    hệ thống, `204`, thứ tự lỗi, `OPTIONS`, `HEAD`, dấu `/`), collection tạo qua `createUserCollection` của
    `permissions/fixtures.ts`; so response, activity, revision, dòng DB (`db-effects`).
  - `export.test.ts`: ma trận định dạng × nguồn của FR-044; chuẩn hóa `content-disposition` (phần thời gian) và body
    (id, ngày).
  - `cache-blackbox.test.ts`: port `tests/db/app/cache.test.ts` và `cache-purge.test.ts` chạy trên bốn cặp R5, mỗi ca
    với từng app của cặp (`describe.each(APP_NAMES)`), giữ khẳng định gốc (`x-cache-status`); seed `cache.seed.ts`,
    `cache-purge.seed.ts` qua Directus của cặp.
  - `cache-cross.test.ts`: các ca dùng chéo FR-042 (cùng key và giá trị: xóa namespace trong Redis, gọi một app, đọc
    key, so với app kia; `HIT` chéo; purge chéo; `$NOW`; `ip_access` → `ip`; `CACHE_SKIP_ALLOWED`;
    `CACHE_VALUE_MAX_SIZE` đo ở cặp `cache-redis` bằng response lớn hơn ngưỡng đặt trong env của cặp đó; Referer).
  - `bus.test.ts`: subscribe `websocket.event` bằng ioredis trên namespace bus của cặp `websocket`, chạy chuỗi thao tác
    ghi FR-045 ở từng app, so chuỗi thông điệp (chuẩn hóa id); ở cặp chính kiểm 0 thông điệp.
  - `request-set.ts` thêm request đọc `/items/<collection>` (có `export`) cho `db-unchanged`, `readonly-account`.
  - `src/items/cache-redis-down.test.ts` (mới, suite `cache`) có hai ca ở cặp `cache-redis`. Cặp này có service `redis-cache` riêng (cổng host 6109,
    `REDIS` của cặp trỏ tới), nên dừng được mà không ảnh hưởng cặp khác. Ca thứ nhất là cache dữ liệu khi Redis dừng
    (FR-016, T033). Ca thứ hai là R-10, `publish` bus khi Redis dừng (T044). Cặp `cache-config` giữ `CACHE_ENABLED=false`.
  - `blackbox-common.test.ts` của 004 giữ nguyên (fixture riêng theo app).
- **Lý do**: FR-040 đến FR-047, SC-002 đến SC-005, SC-009.
- **Đã cân nhắc**: Gộp cache-cross vào cache-blackbox: giữ tách để file port không có khẳng định ngoài bản gốc.

## R10. Sổ khác biệt và bảng của spec cũ

- **Quyết định**: `accepted-differences.ts`: xóa `D-09.3`, `D-11`, `D-12`, `D-30`; sửa `reason` của `D-26`, `D-29`
  (giữ `removeAt: '009'`): "events are emitted since 005; event-triggered flows run from 009". Spec 001: dòng D-09.3
  (bản đồ) và D-11, D-12 ghi "Gỡ ở 005"; spec 003: dòng D-26 thu hẹp; spec 004: dòng D-29, D-30 và dòng D-11 của bảng
  "Thay đổi". `benchmark/src/run.ts`: bỏ ghi chú D-11, `/server/info` và OAS so với Directus cặp chính qua header
  `Cache-Control: no-store` (R11), `directus-noresponsecache` xóa khỏi compose benchmark nếu không còn ai dùng
  (`permissions.ts` cũng chuyển sang header). Guard `accepted-differences.test.ts` sẽ đỏ khi spec 005 `Status: Done` mà
  entry `removeAt: '005'` còn, nên xóa entry trong commit đóng feature.
- **Lý do**: FR-047, bảng khác biệt của spec.

## R11. Benchmark items (SC-006, 10 triệu dòng)

- **Quyết định**: `tests/benchmark/src/{items,seed-items}.ts`, target `benchmark:items`, job `benchmark-items` trong
  `benchmark.yml` (hằng tuần, bấm tay, không chặn CI). Seed (Postgres): tạo qua API của Directus collection
  `bench_categories` (100 dòng) và `bench_articles` (field `title` string, `status` string có index, `body` text,
  `category` m2o có index, `date_created`), alias o2m `categories.articles`; nạp 10 triệu dòng bằng một câu
  `INSERT INTO bench_articles ... SELECT ... FROM generate_series(1, 10000000)` qua knex trên host (không cần thư viện
  COPY), thêm 200.000 dòng dành cho `DELETE` (mỗi app một dải id). Kịch bản autocannon (mẫu `permissions.ts`: warm-up,
  `BENCH_ROUNDS` lượt xen kẽ, throughput 50 kết nối rồi p95 ở 80% req/s của Directus, so bằng `compare.ts`):
  `GET /items/bench_articles?filter[status][_eq]=published&sort=-date_created&limit=25&fields=id,title,category.name`;
  `GET /items/bench_articles/<id>` (id lấy từ pool); `POST`; `PATCH /<id>`; `DELETE /<id>` (id tiêu thụ tuần tự từ dải
  của app); mỗi kịch bản với admin và với user có policy `read` filter `status = published`, `fields` một phần. Hai chế
  độ: tươi (header `Cache-Control: no-store`, cặp chính có `CACHE_SKIP_ALLOWED=true` sau R4) và `HIT` (không header,
  lặp cùng `GET`). So với Directus cặp chính.
- **Lý do**: FR-048, Clarifications (10 triệu); `generate_series` nạp vài phút, không thêm dependency.
- **Đã cân nhắc**: `pg-copy-streams`: bị loại, thêm dependency. Nạp qua API: bị loại, quá chậm.
- **Rủi ro**: Đĩa runner (`[Suy luận]` 2 đến 3 GB cho bảng và index); thời gian seed. Task đo lần chạy đầu ghi vào
  tasks; nếu không chứa nổi, chủ dự án chọn lại (Assumptions của spec).

## R12. Playwright: module Content và tải CSV (FR-046)

- **Quyết định**: `tests/directus-app-e2e/src/items.spec.ts`: `beforeAll` tạo collection `e2e_articles` (field `title`
  string, `body` text) qua API của Directus; kịch bản `bothRuns`: mở `/admin/content/e2e_articles/+`, điền, lưu (chờ
  `POST /items/e2e_articles`); mở item, sửa, lưu (`PATCH`); xóa; tạo hai item rồi chọn cả hai ở danh sách và xóa hàng
  loạt (`DELETE /items/e2e_articles` với mảng); mở sidebar Export, chọn CSV, "Download file", bấm tải, bắt
  `page.waitForEvent('download')` (app gọi `GET /items/e2e_articles?export=csv&...&access_token=...`), lưu file; so dòng
  DB (`changesSince`) và nội dung file hai lượt sau khi bỏ phần thời gian trong tên. `routing.spec.ts` thêm khẳng định
  `/items/*` tới app mới (`$upstream_addr`). `proxy/backoffice-routes.txt` thêm `items`.
- **Lý do**: FR-046, SC-008; app Directus dùng `api.getUri({ url: /items/<c>, params: { export, ... } })` cho
  "Download file" (`export-sidebar-detail.vue:360-390`).
- **Đã cân nhắc**: Kiểm xuất file nền ("Start export", `/utils/export`): thuộc 010.

## R13. Unit test

- **Quyết định**: Port kèm code: `utils/get-cache-key.test.ts`, `get-cache-headers.test.ts`, `should-skip-cache.test.ts`,
  `permissions-cacheable.test.ts`, `services/import-export.test.ts` (phần `transform`; phần `exportToFile`, import bỏ,
  ghi chú). Viết mới: `middleware/respond.test.ts` (thay bản 24 dòng: lưu cache theo từng điều kiện FR-012, header theo
  bảng contracts/cache.md, export từng định dạng, `204`), `middleware/cache.test.ts` (thay bản 12 dòng: HIT, MISS, skip,
  lỗi đọc, `CACHE_ENABLED=false`), `middleware/collection-exists.test.ts`, `controllers/items.controller.test.ts`
  (supertest qua app Nest như `roles.controller.test.ts`: route, singleton, hệ thống, `404`, thứ tự lỗi),
  `emitter.test.ts` (thay bản stub), `websocket/controllers/hooks.test.ts` (ánh xạ event → thông điệp, loại trừ
  `sessions`, điều kiện đăng ký), `router-options.test.ts` thêm `/items`. Coverage 80% cho `apps/api`.
- **Lý do**: FR-045 (phần unit), Nguyên tắc X.

## R14. Thứ tự làm và tách nhỏ

- **Quyết định**: Gói A (route): R2, test controller, `crud.test.ts`, request-set, proxy route. Gói B (blackbox): R6
  harness, port file, job CI, bộ rút gọn. Gói C (event, bus): R8, `bus.test.ts`, cặp `websocket`, env `WEBSOCKETS_*`.
  Gói D (cache, export): R3, R7, R4, R5, cache tests, export tests, `redis-down`, env `CACHE_*`. Gói E (sổ sách): R10,
  spec cũ, README, Playwright R12, benchmark R11, đóng feature. Gói A trước vì mọi gói khác cần `/items`; D sau A và B
  vì đổi `respond` chạm mọi route (chạy lại toàn bộ bộ đối chiếu sau D, FR-047). Nếu `tasks.md` vượt khoảng 60 task,
  tách thành hai phần (A+B+C, D+E) theo mục của SPECKIT-GUIDE như 004.
- **Lý do**: Giảm số lần chạy lại bộ đối chiếu đầy đủ; mỗi gói có cổng kiểm riêng.
