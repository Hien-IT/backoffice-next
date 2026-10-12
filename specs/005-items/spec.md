# Feature Specification: Items (CRUD `/items`, response cache, export, event, bus `websocket.event`)

**Feature Branch**: `005-items`
**Created**: 2026-10-11
**Status**: Done
**Duyệt khác biệt**: tech lead đã duyệt gỡ D-09.3, D-11, D-12, D-30, thu hẹp D-26, D-29, rủi ro R-07 đến R-10, cách làm của `unhandled-rejection.ts` (như pm2) và các sửa bảng của spec 001, 003, 004 ngày 2026-10-12 (Nguyên tắc X; quy trình không có PR)
**Input**: User description: "Người dùng thao tác dữ liệu của mọi collection qua /items/:collection giống hệt Directus: đọc danh sách, đọc theo id, tạo, sửa, xóa từng cái hoặc hàng loạt, SEARCH, collection singleton. Engine đọc ghi (ItemsService, PayloadService, MetaService, run-ast, apply-query) và kiểm query đã port ở feature 004, nên feature này dùng lại, không port lại. Thêm: cache response khi CACHE_ENABLED=true (CACHE_TTL, CACHE_AUTO_PURGE, CACHE_STATUS_HEADER, Cache-Control, dùng chung key với Directus, gỡ D-11), xuất file qua query export (json, csv, xml, yaml, gỡ D-12), phát cùng tên event như Directus (items.create, items.update... và event của năm collection hệ thống, gỡ D-29 phần filter và action cho flow), và đẩy sự kiện lên kênh bus websocket.event của Directus (cùng format như directus/api/src/websocket/controllers/hooks.ts, gỡ D-30). Tham chiếu directus/api/src/controllers/items.ts, middleware/respond.ts, middleware/cache.ts, utils/get-cache-key.ts, services/import-export, emitter.ts. Tiêu chí chấp nhận: bộ blackbox test items, query và relational của Directus chạy qua trên app mới với Postgres, MySQL và SQLite."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/api/src` trừ khi ghi khác):

- Route: `controllers/items.ts`; middleware `collection-exists.ts` (đặt `req.collection`, `req.singleton`),
  `validate-batch.ts`, `respond.ts` (phần cache và export), `cache.ts` (trả response từ cache); thứ tự middleware trong
  `app.ts` (`authenticate` → `schema` → `sanitizeQuery` → `requestCounter` → `cache` → router).
- Cache: `cache.ts` (`getCache`, `setCacheValue`, `getCacheValue`), `utils/get-cache-key.ts`, `utils/get-cache-headers.ts`,
  `utils/should-skip-cache.ts`, `utils/permissions-cacheable.ts`, `utils/get-string-byte-size.ts`,
  `permissions/modules/fetch-policies-ip-access/`; `directus/packages/utils/shared/get-endpoint.ts`.
- Export: `services/import-export.ts` (`ExportService.transform`; `exportToFile` và `ImportService` thuộc `/utils`,
  feature 010), `directus/packages/utils/shared/get-date-time-formatted.ts`.
- Event: `emitter.ts`; chỗ phát event trong `services/items.ts` (`eventScope`, filter `*.create|update|delete`, action sau
  commit, `nestedActionEvents`, `emitEvents`, `bypassEmitAction`), `services/users.ts`, `roles.ts`, `policies.ts`,
  `access.ts`, `permissions.ts`, `activity.ts`, `revisions.ts`, `authentication.ts` (003).
- Bus: `websocket/controllers/hooks.ts` (`registerWebSocketEvents`, `registerAction`), `websocket/messages.ts`
  (`WebSocketEvent`), chỗ gọi trong `websocket/controllers/rest.ts`, `graphql.ts`, `server.ts` (chỉ khi
  `WEBSOCKETS_ENABLED=true`); bus `@directus/memory` (đã port ở 002).
- Collection hệ thống: `directus/packages/system-data` (`isSystemCollection`, `systemCollectionRows` có cờ
  `singleton`, `systemCollectionNames`).
- Biến môi trường: `directus/packages/env/src/constants/defaults.ts`, `directus-variables.ts` (`CACHE_*`,
  `WEBSOCKETS_*`).

**Đã có từ feature 001 đến 004** (trong `apps/api/src`): engine đọc, ghi đầy đủ (`ItemsService` gồm `readSingleton`,
`upsertSingleton`, `updateBatch`, `updateByQuery`, `deleteByQuery`, mọi lời gọi `emitter.emitFilter`, `emitAction` và
`shouldClearCache` giữ nguyên như Directus; `PayloadService`, `MetaService`, `get-ast-from-query`, `run-ast`,
`apply-query`, dialect helper); kiểm quyền đọc ghi (`processAst`, `processPayload`, `validateAccess`); `sanitizeQuery`
và `validateQuery` chạy trên mọi route (`export` đã nhận `csv`, `csv_utf8`, `json`, `xml`, `yaml`, giá trị khác trả
`400 INVALID_QUERY`); `validateBatch`; `authenticate` toàn cục; `useCollection`; `respond` chỉ có phần header
(`Cache-Control: no-cache`, `Vary`) và trả body; middleware `cache` chỉ gọi `getCache()`; `cache.ts` có `getCache`
(cache dữ liệu Keyv khi `CACHE_ENABLED=true`), `setCacheValue`, `getCacheValue` (nén như Directus), `clearSystemCache`,
bus `schemaChanged`; `Emitter` thế chỗ (cùng API, không phát); `useBus`; `fetchPoliciesIpAccess` (namespace
`policies-ip-access`); `DIRECTUS_COMPAT_VERSION = '11.17.4'`; `object-hash`, `bytes` đã là dependency. Chưa có:
`collectionExists`, route `/items`, `getCacheKey`, `getCacheControlHeader`, `shouldSkipCache`, `permissionsCacheable`,
`ExportService`, `Emitter` thật, cầu nối `websocket.event`; `CACHE_STATUS_HEADER`, `CACHE_VALUE_MAX_SIZE`,
`CACHE_SKIP_ALLOWED`, `CACHE_CONTROL_S_MAXAGE`, `WEBSOCKETS_*` còn ở nhóm "chưa hỗ trợ" (001).

**Bộ test blackbox liên quan** (`directus/tests/blackbox`, số ca `it`/`test` mỗi file):
`tests/db/routes/items/no-relation.test.ts` (48), `m2o.test.ts` (23), `o2m.test.ts` (28), `m2m.test.ts` (34),
`m2a.test.ts` (25), `relational-json.test.ts` (21), `json-fields.test.ts` (18), `singleton.test.ts` (5),
`case-when.test.ts` (1), `conceal-filter.test.ts` (6), `hash-filter.test.ts` (6) với seed `*.seed.ts`,
`seed-all-field-types.ts`, `seed-relational-fields.ts`; bộ sinh filter `tests/db/query/filter/index.ts`
(`CheckQueryFilters`, gọi từ m2o, o2m, m2m, m2a) và `tests/db/schema/<kiểu>/index.ts` (sinh filter và giá trị cho từng
kiểu field: string, text, integer, bigInteger, float, decimal, boolean, date, dateTime, time, timestamp, json, csv, hash,
uuid, alias, geometry); `tests/db/app/cache.test.ts` (6 ca × 4 cấu hình cache); `tests/db/routes/permissions/cache-purge.test.ts`
(1 ca × các thao tác ghi × 4 cấu hình). Hoãn: `tests/db/routes/items/version.test.ts` (query `version`, D-09.6, feature
008); `tests/db/schema/timezone/*.test.ts` (đổi `TZ` của process và kiểu field, feature 006);
`tests/common/assets/cache-revalidate.test.ts` (feature 007). Mọi seed tạo collection, field, relation qua
`CreateCollection`, `CreateField*` của `common/functions.ts` (`/collections`, `/fields`, `/relations`, feature 006).

## Clarifications

### Session 2026-10-11

- Q: Directus chỉ đăng ký cầu nối `websocket.event` khi `WEBSOCKETS_ENABLED=true` và có controller REST hoặc GraphQL;
  app mới (không mở WebSocket) đăng ký theo cùng điều kiện từ `.env` dùng chung, hay luôn đăng ký khi có bus Redis? → A:
  Chủ dự án cho biết không có node Directus nào bật WebSocket. Chọn cùng điều kiện như Directus (đọc
  `WEBSOCKETS_ENABLED`, `WEBSOCKETS_REST_ENABLED`, `WEBSOCKETS_GRAPHQL_ENABLED`): với cấu hình hiện tại cả hai bên đều
  không publish, nên không có khác biệt (D-30 gỡ, không thêm D-32); cầu nối vẫn được port và kiểm ở một cặp bật
  WebSocket (FR-045) để đúng khi đội vận hành bật sau này (FR-032, FR-050).
- Q (clarify): Bộ blackbox port chạy trên MySQL và SQLite ở đâu, khi tiêu chí chấp nhận là "chạy qua trên cả ba vendor"? →
  A: Như tiền lệ 004 (Nguyên tắc V): Postgres đủ bộ mỗi lần push; MySQL, SQLite bộ rút gọn mỗi lần push và đủ bộ ở
  workflow riêng (hằng tuần, bấm tay); đủ bộ PHẢI xanh ở cả ba vendor trước khi đóng feature (FR-041, SC-001).
- Q (clarify): Cặp app chính của môi trường đối chiếu (cache bật, cùng `CACHE_NAMESPACE`) so response thế nào khi request
  thứ hai sẽ `HIT` bản cache của app thứ nhất? → A: Giữ cache bật, đặt `CACHE_SKIP_ALLOWED=true` (biến có sẵn của
  Directus) trong env của cặp chính cho cả hai app; bộ so sánh gửi `Cache-Control: no-store` với mọi `GET` nên hai app
  đều tự tính và trả `Cache-Control: no-store`; header cache bình thường, `HIT` chéo và purge kiểm ở bốn cấu hình riêng
  của FR-042 (FR-043, SC-009).
- Q (clarify): Quy mô dữ liệu cho benchmark items? → A: Đúng constitution: 10 triệu dòng ở collection lớn nhất, nạp bằng
  bulk load, chỉ chạy ở workflow benchmark hằng tuần (FR-048, SC-006).
- Q (clarify): R-07 (payload của `users.create`, `users.update` mang `password` dạng rõ tới listener action và bus
  `websocket.event`) tái tạo hay lệch? → A: Tái tạo y hệt theo quy tắc 004; giữ R-07, tech lead duyệt khi đóng feature;
  không thêm khác biệt (FR-031, FR-032).
- Q (clarify): Có kiểm tới client WebSocket của Directus (nhận thay đổi do app mới ghi) hay chỉ so thông điệp bus? → A:
  Chỉ so chuỗi thông điệp `websocket.event` hai app đẩy lên Redis ở một cặp bật `WEBSOCKETS_ENABLED`; bỏ kịch bản client
  WebSocket (phần đẩy tới client là code của Directus; app mới không mở WebSocket, Nguyên tắc XI) (FR-033, FR-045,
  SC-005).
- Q (rà checklist `items-review.md`): Bộ blackbox items xen GraphQL và WebSocket trong cùng `it`; key cache không chứa
  `share`; `publish` bus không được chờ; `validateBatch` với singleton; bộ rút gọn đo thế nào? → A: Sửa spec theo
  checklist: FR-040 (GraphQL về Directus tới 011, bỏ khối WebSocket, hai lượt chạy, đường cơ sở theo vendor), R-09 và
  R-10 (tái tạo, đo), FR-003 (`validate-batch.ts:14`), FR-041 (rút gọn = mọi file với kiểu khóa `integer`), cùng FR-005,
  FR-006, FR-010, FR-012, FR-020, FR-031, FR-032, FR-042 đến FR-048, Assumptions.
- Q (rà nốt 7 mục còn mở của `items-review.md` trước `/speckit.implement`): giải được từ code Directus không? → A: Có:
  lô rỗng, tên collection trong path, quy tắc key cache (Edge Cases); `version` (FR-004, D-09.6, khẳng định riêng); quy
  tắc so khi Redis dừng theo FR-085 của 004 (FR-016); body và header của lỗi `500` export csv (FR-021); thuật ngữ (Key
  Entities). Chỗ còn ghi "dự kiến" đã đo ở T010, T025 và thay bằng số đo (T051).

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là client đang gọi Directus (`@directus/sdk`, app Directus, script tích hợp) đọc và ghi dữ
liệu của collection người dùng qua `/items`, đội vận hành bật response cache dùng chung Redis cho hai app, người dùng
tải dữ liệu ra file, và các client realtime nối vào Directus cần thấy thay đổi do app mới ghi.

### User Story 1 - CRUD mọi collection qua `/items/:collection` giống Directus (Priority: P1)

Client tạo, đọc (danh sách, theo id, `SEARCH`), sửa, xóa item của mọi collection người dùng, từng cái hoặc hàng loạt,
kể cả collection singleton, với cùng path, query, body, response, lỗi, header và tác động DB (dòng dữ liệu, activity,
revision) như Directus. Engine đọc ghi đã có từ feature 004; feature này chỉ thêm route.

**Why this priority**: `/items` là route được gọi nhiều nhất của Directus; không có nó, app mới chưa dùng được cho dữ
liệu người dùng (D-09.3). Mọi phần còn lại của feature (cache, export, event) bám vào route này.

**Independent Test**: Tạo collection người dùng qua API của Directus (có m2o, o2m, m2m, m2a, json, hash, conceal,
singleton), gửi cùng chuỗi request tới hai app bằng token admin và token user có quyền một phần. So status, body,
header và các dòng DB.

**Acceptance Scenarios**:

1. **Given** collection `articles` có quan hệ o2m `tags`, **When** `POST /items/articles` với payload lồng `tags`,
   **Then** trả `200` với item đọc lại theo `fields` của query; các dòng `articles`, `tags`, `directus_activity`,
   `directus_revisions` giống Directus; `POST` mảng trả mảng theo thứ tự FR-024 của 004.
2. **Given** `GET /items/articles?filter=...&sort=...&fields=*.*&meta=*`, **When** gọi ở hai app, **Then** cùng
   `data` (cùng thứ tự dòng) và cùng `meta.total_count`, `meta.filter_count`; `SEARCH /items/articles` với
   `body.query` và `body.keys` cho cùng kết quả như Directus.
3. **Given** `PATCH /items/articles` với mảng có khóa chính, với `{keys, data}` và với `{query, data}`, **When** gọi,
   **Then** mọi khóa được sửa trong một transaction, đọc lại bằng `readMany`, lỗi giữa chừng rollback cả lô; `DELETE
   /items/articles` với mảng, `{keys}`, `{query}` trả `204`.
4. **Given** collection singleton `settings_page`, **When** `GET /items/settings_page`, **Then** trả object (giá trị mặc
   định khi chưa có dòng), kèm `meta` khi query có `meta`; **When** `PATCH /items/settings_page` với payload, **Then** tạo hoặc sửa dòng duy
   nhất và trả lại nó; **When** `POST /items/settings_page` hoặc `PATCH /items/settings_page/1`, **Then** `404
   ROUTE_NOT_FOUND`, giống Directus.
5. **Given** collection không có trong schema, **When** gọi bất kỳ method nào của `/items/<c>` (kể cả admin), **Then**
   `403 FORBIDDEN` message `You don't have permission to access collection "<c>" or it does not exist. Queried in root.`;
   **Given** collection hệ thống (`/items/directus_users`), **Then** `403 FORBIDDEN` message `You don't have permission
   to access this.`, sau `collectionExists` và, với `SEARCH`, `PATCH /`, `DELETE /`, sau `validateBatch` (body sai ở ba
   route đó trả `400` trước), như thứ tự của `controllers/items.ts`.
6. **Given** user có quyền `create` nhưng không có quyền `read`, **When** tạo item, **Then** trả `204` không body (lần
   đọc lại bị `403`), như FR-041 của 004.
7. **Given** cùng request vượt `MAX_BATCH_MUTATION`, sai body (`validateBatch`), sai query (`400 INVALID_QUERY`), token
   sai, **When** gửi tới hai app, **Then** cùng lỗi theo thứ tự FR-005 của 004.

---

### User Story 2 - Bộ blackbox items, query, relational của Directus chạy qua trên app mới (Priority: P1)

Các file test items, query và relational của `directus/tests/blackbox` (danh sách ở đầu spec) được port sang bộ đối chiếu
và đạt với cả hai app trên Postgres, MySQL và SQLite. Đây là tiêu chí chấp nhận của feature.

**Why this priority**: Bộ test này là cách duy nhất kiểm chứng engine đọc ghi (port ở 004) trên dữ liệu người dùng với
đủ kiểu field, quan hệ và toán tử filter; 004 mới kiểm trên năm collection hệ thống.

**Independent Test**: Chạy bộ port với `TEST_DB=postgres`, `mysql`, `sqlite3`; mọi ca đạt ở cả hai app.

**Acceptance Scenarios**:

1. **Given** seed của `no-relation`, `m2o`, `o2m`, `m2m`, `m2a`, `relational-json`, `json-fields`, `singleton`,
   `case-when`, `conceal-filter`, `hash-filter` tạo qua API của Directus, **When** chạy từng file test với URL của app
   mới, **Then** 100% ca đạt, cùng kết quả như khi chạy với URL của Directus.
2. **Given** `CheckQueryFilters` sinh filter cho mọi toán tử của mọi kiểu field (`tests/db/schema/<kiểu>`), **When** chạy
   với app mới, **Then** tập dòng trả về khớp hàm kiểm của từng toán tử, trên cả ba vendor.
3. **Given** một ca đã fail trên chính Directus ở một vendor (lỗi có sẵn), **When** chạy bộ port, **Then** ca đó được bỏ
   qua theo vendor với ghi chú, không coi là lỗi của app mới (Assumptions).

---

### User Story 3 - Response cache dùng chung với Directus (Priority: P2)

Khi `CACHE_ENABLED=true`, mỗi response `GET` đủ điều kiện được lưu vào cache dữ liệu với cùng key, cùng giá trị, cùng
namespace như Directus, nên request tới app nào cũng có thể nhận bản cache do app kia ghi. Header `Cache-Control`,
`Vary` và header trạng thái cache (`CACHE_STATUS_HEADER`) giống Directus trong mọi trường hợp: trả từ cache, lưu mới,
bỏ qua cache (Referer của app, `Cache-Control: no-store` của client), giá trị quá lớn, quyền đọc có `$NOW`, export. Ghi
dữ liệu xóa cache theo `CACHE_AUTO_PURGE` (đã có từ 004, FR-083) nên bản cũ biến mất ở cả hai app.

**Why this priority**: Đội vận hành bật cache ở Directus thì app mới phải hành xử như một instance Directus nữa: không
trả dữ liệu cũ hơn Directus, không bỏ cache mà Directus đang dùng (Nguyên tắc IV). D-11 đã hẹn gỡ từ 001.

**Independent Test**: Xóa cache, gọi một `GET` ở Directus rồi đọc key trong Redis; xóa cache, gọi cùng request ở app
mới; so tập key và giá trị. Gọi ở app này rồi gọi lại ở app kia: `HIT`. Ghi ở app này, đọc ở app kia với
`CACHE_AUTO_PURGE=true` và `false`.

**Acceptance Scenarios**:

1. **Given** cache trống, `CACHE_STATUS_HEADER=x-cache-status`, **When** `GET /items/articles` ở Directus rồi ở app mới,
   **Then** lần đầu `x-cache-status: MISS` và Redis có key của Directus; lần sau ở app mới `HIT`, body giống hệt, không
   truy vấn DB; và ngược lại.
2. **Given** `CACHE_AUTO_PURGE=false`, **When** một response được lưu, **Then** `Cache-Control: public, max-age=<CACHE_TTL
   theo giây>, s-maxage=<CACHE_CONTROL_S_MAXAGE>` cho request không role, `private, ...` cho request có role, giống
   Directus; **Given** `CACHE_AUTO_PURGE=true`, **Then** `Cache-Control: no-cache` dù vẫn lưu.
3. **Given** `CACHE_AUTO_PURGE=true`, **When** `PATCH /items/articles/1` ở app mới, **Then** `GET` kế tiếp ở Directus là
   `MISS` với dữ liệu mới; **Given** `CACHE_AUTO_PURGE=false`, **Then** `GET` ở cả hai app vẫn `HIT` bản cũ tới hết
   `CACHE_TTL`, giống Directus.
4. **Given** request có header `Referer` bắt đầu bằng `<PUBLIC_URL>/admin`, **When** `CACHE_AUTO_PURGE=false` hoặc path
   thuộc collection trong `CACHE_AUTO_PURGE_IGNORE_LIST`, **Then** bỏ qua cache (`MISS`, `Cache-Control: no-store`);
   **When** `CACHE_AUTO_PURGE=true` và collection không bị bỏ qua, **Then** cache như request thường (`HIT` ở lần hai),
   đúng các ca của `cache.test.ts`.
5. **Given** `CACHE_SKIP_ALLOWED=true` và client gửi `Cache-Control: no-store`, **When** gọi, **Then** không đọc cache
   (`MISS`), header `no-store`, nhưng response vẫn được lưu (Directus `respond.ts` không xét `shouldSkipCache`), nên
   request kế tiếp không có header đó là `HIT`; **Given** `CACHE_SKIP_ALLOWED=false`, **Then** header của client bị bỏ qua.
6. **Given** quyền `read` của collection có filter dùng `$NOW`, **When** user đó gọi `GET`, **Then** không lưu cache
   (`Cache-Control: no-cache`); user khác không bị ảnh hưởng.
7. **Given** mọi thao tác ghi `/permissions`, `/policies`, `/roles`, `/access` của `cache-purge.test.ts`, **When** chạy ở
   app mới với bốn cấu hình (memory, redis × auto purge on, off), **Then** `GET` kế tiếp là `MISS` như Directus.
8. **Given** `GET /server/info`, `GET /server/specs/oas`, `GET /users`, `GET /roles/me`... (route của 001 đến 004),
   **When** `CACHE_ENABLED=true`, **Then** cũng được cache và trả header như Directus; D-11 được gỡ hẳn.

---

### User Story 4 - Xuất dữ liệu ra file bằng query `export` (Priority: P2)

Client thêm `?export=json|csv|csv_utf8|xml|yaml` vào bất kỳ request nào đi qua `respond` (chủ yếu `GET` và `SEARCH`
`/items`, nhưng cả `/users`, `/server/info`...) và nhận file đính kèm với cùng tên file, `Content-Type`, nội dung
từng byte như Directus. Response export không bao giờ được cache.

**Why this priority**: App Directus dùng chính query này cho nút "Download file" ở sidebar Export; script tích hợp dùng
để tải dữ liệu. D-12 đã hẹn gỡ từ 001.

**Independent Test**: Với mỗi định dạng, gọi cùng request (danh sách có quan hệ lồng, một item, singleton, danh sách
rỗng, `SEARCH`, `/users`, `/server/info`) ở hai app; so status, header và body (tên file chuẩn hóa phần thời gian).

**Acceptance Scenarios**:

1. **Given** `GET /items/articles?export=csv&fields=id,title,author.name,tags.tags_id.tag`, **When** gọi, **Then** `200`,
   `Content-Disposition: attachment; filename="articles <YYYYMMDD-HMS>.csv"`, cùng `Content-Type` và cùng nội dung như
   Directus. Đo ở T025, hai app như nhau: `text/csv; charset=utf-8`; tiêu đề
   `id,title,author.name,tags` (object lồng thành cột `a.b`, mảng giữ JSON trong ô). `csv_utf8` thêm BOM và cùng tên `.csv`.
2. **Given** `export=json`, **Then** body là JSON thụt lề bằng tab của `data`; `export=xml` là XML gốc `<data>`;
   `export=yaml` là YAML; `Content-Type` lần lượt `application/json`, `text/xml`, `text/yaml` (kèm charset như Directus).
3. **Given** `GET /server/info?export=json`, **Then** tên file `Export <YYYYMMDD-HMS>.json` (không có collection), nội
   dung là `data` của `/server/info`.
4. **Given** danh sách rỗng với `export=csv`, **Then** body rỗng, `200`; **Given** request không có payload (`204` khi
   không export) với `export=csv`, **Then** cùng kết quả như Directus (đo ở T025: `500` do lỗi
   `input.length`; `export=json` trả `200` với `null`).
5. **Given** `export=pdf`, **Then** `400 INVALID_QUERY` từ `validateQuery` (đã có từ 004).
6. **Given** `CACHE_ENABLED=true`, **When** gọi với `export`, **Then** không lưu, không trả từ cache; `Cache-Control:
   no-cache`.

---

### User Story 5 - Event phát ra giống Directus và đẩy lên bus `websocket.event` (Priority: P2)

App mới có emitter thật: mọi thao tác ghi phát filter event (trong transaction, có thể đổi payload) và action event (sau
commit) với cùng tên, meta và context như Directus: `items.create`, `<collection>.items.create`, `items.update`,
`items.delete`, `users.*`, `roles.*`, `policies.*`, `access.*`, `permissions.*`, `activity.*`, `revisions.*`, và các event
`auth.*` của 003. Cầu nối của Directus đưa action event thành thông điệp `websocket.event` trên bus dùng chung
(`{collection, action, key|keys, payload}`), nên instance Directus bật WebSocket đẩy được thay đổi do app mới ghi tới
client đang subscribe. Flow (009) sẽ đăng ký vào emitter này.

**Why this priority**: Không phát event thì client realtime không thấy dữ liệu app mới ghi (D-30), và feature 009 không
có gì để nối flow vào (D-29). Chi phí thấp vì mọi service đã giữ nguyên lời gọi emitter.

**Independent Test**: Ở cặp app bật `WEBSOCKETS_ENABLED`, subscribe kênh `websocket.event` trên Redis; chạy cùng chuỗi
thao tác ghi ở hai app; so chuỗi thông điệp.

**Acceptance Scenarios**:

1. **Given** `POST /items/articles` ở app mới, **Then** bus nhận `{"collection":"articles","action":"create","key":<id>,
   "payload":{...}}` như khi gọi ở Directus; `PATCH` nhiều khóa → `action: "update"`, `keys`; `DELETE` → `action:
   "delete"`, `keys`, `payload` là mảng khóa.
2. **Given** payload lồng tạo item ở collection liên quan, **When** ghi, **Then** phát thêm event của collection đó
   (`nestedActionEvents`) sau commit, cùng thứ tự như Directus.
3. **Given** `PATCH /users/:id`, **Then** bus nhận `{"collection":"directus_users","action":"update",...}`; không có
   thông điệp cho `directus_sessions` (loại trừ như Directus).
4. **Given** cặp app với `WEBSOCKETS_ENABLED=false` (cấu hình hiện tại của mọi node), **When** ghi ở app nào, **Then**
   không app nào publish lên kênh `websocket.event`, giống Directus.
5. **Given** listener action ném lỗi (test đơn vị), **When** ghi, **Then** request vẫn thành công và có dòng log `warn`
   `An error was thrown while executing action "<event>"`, giống Directus.

---

### User Story 6 - App Directus dùng module Content qua reverse proxy (Priority: P3)

Đội vận hành thêm `/items` vào danh sách route của proxy (FR-106 của 004). Người dùng mở module Content của app Directus
11.17.4, tạo, sửa, xóa item, tải file CSV từ sidebar Export; mọi request `/items` đi vào app mới và kết quả giống khi
đi vào Directus.

**Why this priority**: Là cổng E2E đã lập ở 004 (SC-008), mở rộng cho route mới; chạy sau khi US1, US4 xong.

**Independent Test**: Playwright chạy app Directus qua proxy ở CI với kịch bản trên; so dòng DB và file tải về với lần
chạy proxy trỏ mọi route về Directus.

**Acceptance Scenarios**:

1. **Given** collection `articles` (tạo qua API của Directus), **When** người dùng tạo một item, sửa, xóa, chọn nhiều
   item xóa hàng loạt trong module Content, **Then** mọi request `/items/*` tới app mới (log proxy có `$upstream_addr`
   của app mới) và dòng DB sau mỗi bước giống lần chạy đối chứng.
2. **Given** sidebar Export với "Download file", định dạng CSV, **When** bấm tải, **Then** file tải về (qua
   `GET /items/articles?export=csv&...&access_token=...`) giống file của lần chạy đối chứng (bỏ phần thời gian trong tên).

---

### Edge Cases

- `/items/<c>` với `<c>` không có trong schema: `403` message collection ở mọi method, kể cả admin và kể cả tên
  `directus_*` không có trong schema (`collectionExists` chạy trước kiểm collection hệ thống).
- Singleton: `GET /items/<singleton>/<pk>`, `DELETE /items/<singleton>`, `DELETE /items/<singleton>/<pk>` không bị chặn
  (Directus không có nhánh riêng); `PATCH /items/<singleton>` mà lần đọc lại bị `403` thì trả `403` (không `204`, vì
  Directus không bọc `readSingleton` trong `try`); `GET /items/<singleton>` khi bảng trống trả object giá trị mặc định của
  field (`meta` chỉ khi query có `meta`).
- `GET /items/<c>` có body JSON `{"keys": [...]}` (client gửi body với `GET`): đọc theo `keys` như `SEARCH`, giống Directus.
- `?version=<key>` trên `/items` trước feature 008: giữ D-09.6 theo FR-004 (`GET /:pk` và singleton: Directus `403` hoặc
  bản lưu, app mới `500`; danh sách: như nhau).
- Lô rỗng (theo `ItemsService` port nguyên, `services/items.ts`): `POST []` không ghi gì, đọc lại `readMany([])` →
  `200 {"data": []}`; `PATCH []` (`updateBatch`) → `200 {"data": []}`; `PATCH {"keys": [], "data": {...}}` (`updateMany`
  không kiểm số khóa) chạy câu `update` không khớp dòng nào, vẫn phát filter và action `items.update` với `keys: []` →
  `200 {"data": []}`; `PATCH {"query": ..., "data": ...}` không khớp dòng → `updateByQuery` trả `[]` sớm, không phát event
  → `200 {"data": []}`; `DELETE []`, `DELETE {"keys": []}` → `deleteMany([])` vẫn phát `items.delete` với `keys: []` →
  `204`; `DELETE {"query": ...}` không khớp → không phát → `204`. Khi bật WebSocket, hai action event rỗng ở trên thành
  thông điệp bus với `keys: []`.
- Tên collection trong path: router giải mã `%xx` (`decodeURIComponent`) trước khi `collectionExists` tra
  `schema.collections`, so khớp chính xác, phân biệt hoa thường (`/items/Articles` với collection `articles` → `403`).
  Chuỗi `%` sai (`/items/%E0%A4%A`): router ném lỗi không phải lỗi Directus nên error handler trả `500
  INTERNAL_SERVER_ERROR` (admin thấy message `Failed to decode param '%E0%A4%A'`); đã đo ở T010, hai app như nhau.
- Key cache (FR-011): `path` là pathname chưa giải mã của `originalUrl`, nên `/items/a` và `/items/a/` là hai key;
  `query` là `req.sanitizedQuery`: request không có query string có `{}`, có bất kỳ tham số nào (kể cả tham số lạ) thì
  thêm giá trị mặc định (`fields: ["*"]`...), nên `/items/a` và `/items/a?foo=1` khác key, còn `?foo=1` và `?bar=2` cùng
  key. Hai app dùng cùng code nên cùng key.
- Cache: `CACHE_ENABLED=false` thì không có header trạng thái cache dù đặt `CACHE_STATUS_HEADER`; giá trị vượt
  `CACHE_VALUE_MAX_SIZE` không lưu, header `no-cache`; `HIT` trả `200` với JSON đã lưu dù route gốc trả status hay
  `Content-Type` khác (chỉ route qua `respond` mới được lưu: `/metrics` không, `/server/health` đặt `cache = false`);
  request `export` luôn `MISS` vì không response export nào được lưu; `/auth/*` không bao giờ lưu.
- Cache và IP: khi một policy của user có `ip_access` khớp IP của request thì key có `ip`; danh sách `ip_access` lấy từ
  cache quyền `policies-ip-access` (xóa cùng cache quyền, FR-082 của 004).
- Cache và biến động: dữ liệu cho `$CURRENT_USER.<field>` đổi không xóa cache (FR-014 của 004), nên bản response cache
  cũng cũ tới hết TTL ở cả hai app.
- Redis không dùng được khi `CACHE_ENABLED=true`, `CACHE_STORE=redis`: lỗi đọc, ghi cache ghi log `warn` `[cache]` và
  tiếp tục như `MISS`; status và mã lỗi giống Directus đo trong cùng điều kiện, theo quy tắc so của FR-016
  (`src/items/cache-redis-down.test.ts`).
- `CACHE_STORE=memory`: cache của từng process; `schemaChanged` với `autoPurgeCache` xóa ở instance khác như 004
  (FR-084).
- Export với `SEARCH`, `POST`, `PATCH` (response có `data`): cũng xuất file, giống Directus; export với response `204`
  theo US4.4.
- Event: `emitEvents: false` (luồng nội bộ) không phát; action event phát sau commit nên lỗi rollback không phát;
  listener filter không có thì payload giữ nguyên; `emitAction` không chờ listener.
- Bus không có Redis (`useBus` local): thông điệp `websocket.event` chỉ ở trong process, không tới Directus, giống
  Directus một instance. Bus Redis nhưng Redis dừng giữa chừng: `publish` thất bại sau chuỗi kết nối lại, request đã
  trả xong, hệ quả theo R-10.
- Request bằng token share và request public cùng `path`, `query`: cùng key cache (R-09).
- `OPTIONS`, `HEAD`, dấu `/` cuối trên `/items/*`: như FR-049 của 004 (`Allow` theo thứ tự đăng ký của
  `controllers/items.ts`).
- Dấu `/` cuối với cache (CHK013, đo ở T032): `GET /items/<c>/` là key khác `GET /items/<c>` (pathname khác), nên lần đầu
  `MISS` rồi `HIT`, như nhau ở hai app.

### Truy vết user story và requirement

| Story | Kịch bản | Requirement chính |
|-------|----------|-------------------|
| US1 | 1 (ghi lồng), 2 (đọc, `SEARCH`, `meta`), 3 (hàng loạt), 4 (singleton), 5 (collection lạ, hệ thống), 6 (`204`), 7 (thứ tự lỗi) | FR-001 đến FR-006 |
| US2 | 1 (file items), 2 (`CheckQueryFilters`), 3 (lỗi có sẵn theo vendor) | FR-040, FR-041 |
| US3 | 1 (`HIT` chéo), 2 (`Cache-Control`), 3 (purge), 4 (Referer), 5 (`no-store`), 6 (`$NOW`), 7 (`cache-purge`), 8 (route cũ) | FR-010 đến FR-017, FR-042, FR-043 |
| US4 | 1 (csv), 2 (json, xml, yaml), 3 (không collection), 4 (rỗng, `204`), 5 (`400`), 6 (không cache) | FR-020, FR-021, FR-044 |
| US5 | 1 (format), 2 (lồng), 3 (năm collection), 4 (tắt WebSocket), 5 (listener lỗi) | FR-030 đến FR-033, FR-045, FR-050 |
| US6 | 1 (Content), 2 (export) | FR-046 |
| Mọi story | biến môi trường, chạy lại 001 đến 004, benchmark | FR-017, FR-047, FR-048, FR-050 |

## Requirements *(mandatory)*

### Functional Requirements

**Route `/items`**

- **FR-001**: App mới PHẢI có các route của `controllers/items.ts` với cùng middleware và thứ tự: `POST /:collection`
  (object hoặc mảng), `SEARCH /:collection` (`validateBatch('read')`, `body.keys`, `body.query`), `GET /:collection`,
  `GET /:collection/:pk`, `PATCH /:collection` (`validateBatch('update')`: mảng có khóa chính → `updateBatch`,
  `{keys, data}` → `updateMany`, `{query, data}` → `updateByQuery` với `query` qua `sanitizeQuery`), `PATCH
  /:collection/:pk`, `DELETE /:collection` (`validateBatch('delete')`: mảng, `{keys}`, `{query}` → `deleteByQuery`),
  `DELETE /:collection/:pk`. Mỗi route dùng `ItemsService` đã có với `accountability` và `schema` của request, đọc lại
  bằng `req.sanitizedQuery` (`readOne` cho một item, `readMany(keys)` cho nhiều), trả `204` không body khi lần đọc lại bị
  `403` hoặc không có payload; `GET`, `SEARCH` trả `{meta, data}` với `meta` của `MetaService`. Mọi quy tắc chung của
  FR-041 của 004 (transaction một lô, `validateAccess` trước khi ghi, `validateKeys`, `MAX_BATCH_MUTATION`) áp dụng
  nguyên. `SEARCH` không có body đọc như `GET`: body-parser 1.20.3 (bản `express.json` của Directus, app mới dùng
  cùng bản) luôn đặt `req.body = {}`, nên nhánh `Payload in body is required` của `validateBatch` không chạy qua HTTP
  (câu tương ứng ở FR-041 của 004 không khớp code; đã đo ở T010: `SEARCH /users` và `SEARCH /items/<c>` không body
  trả `200` ở cả hai app).
- **FR-002**: Middleware `collectionExists` PHẢI chạy đầu tiên trên mọi route `/items`: collection không có trong
  `req.schema.collections` → `403 FORBIDDEN` với message `You don't have permission to access collection "<c>" or it does
  not exist. Queried in root.` (cùng hàm tạo lỗi với `processAst`); nếu có thì đặt `req.collection` và `req.singleton`
  (cờ `singleton` của `systemCollectionRows` cho collection hệ thống, của schema cho collection người dùng). Sau đó mỗi
  handler PHẢI trả `403 FORBIDDEN` (message mặc định `You don't have permission to access this.`) khi collection là
  collection hệ thống (`isSystemCollection`), trước khi gọi service; với `SEARCH`, `PATCH /`, `DELETE /` bước này đứng
  sau `validateBatch` như router của Directus.
- **FR-003**: Singleton PHẢI giống Directus: `GET /:collection` → `readSingleton(req.sanitizedQuery)`, kèm `meta` khi
  query có `meta` (như danh sách);
  `PATCH /:collection` → `upsertSingleton(body)` rồi `readSingleton` (lỗi `403` của lần đọc lại trả `403`);
  `validateBatch('update')`, `validateBatch('delete')` bỏ qua kiểm body khi `req.singleton` (chỉ `SEARCH` và scope
  `read` vẫn kiểm; `validate-batch.ts:14`), nên body object của `PATCH /:collection` không bị `400`; `POST /:collection`
  và `PATCH /:collection/:pk` → `404 ROUTE_NOT_FOUND` với `path`; các route khác không có nhánh riêng.
- **FR-004**: Query và payload trên `/items` PHẢI hỗ trợ đủ như FR-040 của 004 (engine dùng chung, không port lại):
  `fields` (wildcard, lồng m2o, o2m, m2m, m2a, alias, hàm), `filter` (mọi toán tử, `_some`, `_none`, hàm ngày giờ, qua
  quan hệ, biến động), `search`, `sort`, `limit`, `offset`, `page`, `meta`, `aggregate`, `groupBy`, `deep`, `alias`,
  `backlink`, `export` (FR-020); ghi lồng mọi loại quan hệ; special field. Query `version`, `versionRaw` giữ D-09.6 tới
  008: Directus chỉ dùng `version` khác `main` ở `readOne` (`GET /:collection/:pk`) và `readSingleton`
  (`GET /<singleton>`), trả item theo bản lưu hoặc `403 FORBIDDEN` khi không có bản đó (`utils/versioning/handle-version.ts`);
  app mới ném lỗi thường ở hai chỗ đó nên trả `500 INTERNAL_SERVER_ERROR` (admin thấy message `versions are not
  available before feature 008`). Đọc danh sách và `version=main` không đổi gì ở cả hai app. Khác biệt này thuộc D-09.6;
  bộ đối chiếu khẳng định riêng kết quả từng app thay vì thêm entry `http`, để không che lỗi `500` thật (T015).
- **FR-005**: `OPTIONS`, `HEAD`, dấu `/` cuối trên `/items/*` PHẢI như FR-049 của 004: `/items/<c>` → `Allow:
  POST,SEARCH,GET,HEAD,PATCH,DELETE`; `/items/<c>/<pk>` → `GET,HEAD,PATCH,DELETE` (thứ tự đăng ký của
  `controllers/items.ts`; `OPTIONS` trả lời trước `collectionExists` nên collection lạ vẫn `200`; bảng ở
  contracts/items-api.md §3). `HEAD` trả header như `GET` không body và không đi qua cache (FR-010). Path không khớp
  (`/items`, `/items/a/b/c`) trả `404 ROUTE_NOT_FOUND`.
- **FR-006**: Thứ tự lỗi khi một request có nhiều lỗi PHẢI theo FR-005 của 004, với `collectionExists` ở bước route (sau
  `404` không khớp route, trước `validateBatch`); `export` sai giá trị là lỗi của `validateQuery` (bước 4), nên
  `GET /items/nope?export=pdf` trả `400 INVALID_QUERY`, không `403`.

**Response cache**

- **FR-010**: Middleware `cache` PHẢI chạy ở vị trí của Directus (sau `sanitizeQuery`, trước router) và làm như
  `middleware/cache.ts`: chỉ `GET` (và `/graphql`, feature 011); bỏ qua khi `CACHE_ENABLED` khác `true` hoặc không có cache
  dữ liệu; khi `shouldSkipCache` (FR-013) → đặt header `CACHE_STATUS_HEADER: MISS` (nếu biến có giá trị) và đi tiếp;
  tính key (FR-011), đọc giá trị; lỗi đọc → log `warn` `[cache] Couldn't read key <key>. <message>` và `MISS`; có giá trị →
  đọc `<key>__expires_at`, đặt `Cache-Control` theo TTL còn lại (FR-012), `Vary: Origin, Cache-Control`, header `HIT`, trả
  `200` với JSON đã lưu và không chạy route (không truy vấn DB, không activity); response `HIT` chỉ có các header do
  middleware này và lớp chung đặt (`Content-Type: application/json; charset=utf-8`, `Content-Length`, `ETag` yếu của
  Express, CORS, CSP, `X-Powered-By`), không có header riêng của route gốc; không có → header `MISS`, đi tiếp. `HEAD`
  và method khác `GET` không đi qua middleware này (không header trạng thái). Bộ đếm telemetry `api-requests cached`
  không port (Nguyên tắc XI, D-17); không có metric hay log `info` cho `HIT`/`MISS`, như Directus.
- **FR-011**: Key PHẢI tính như `getCacheKey`: `object-hash` của `{version, user, path, query[, ip]}` với `version` là
  `11.17.4` (`DIRECTUS_COMPAT_VERSION`, để trùng key với Directus), `user` là `accountability.user` hoặc `null`, `path` là
  pathname của `originalUrl`, `query` là `req.sanitizedQuery`, `ip` chỉ khi `accountability.ip` có và một policy của
  accountability có `ip_access` khớp IP (`fetchPoliciesIpAccess` + `ipInNetworks`). Phần GraphQL (`query`, `variables`)
  thuộc 011, phần `rawQuery` của `/flows/trigger` thuộc 009. Giá trị lưu bằng `setCacheValue` (nén như Directus) dưới
  namespace `CACHE_NAMESPACE` với TTL `CACHE_TTL`, kèm `<key>__expires_at` `{exp}`; key và giá trị app mới ghi PHẢI
  trùng key và giá trị Directus ghi cho cùng request (đo như FR-080 của 004).
- **FR-012**: `respond` PHẢI lưu response như Directus khi: method `GET` (hoặc `/graphql`), path không bắt đầu bằng
  `/auth`, `CACHE_ENABLED=true`, có cache dữ liệu, không có `export`, `res.locals.cache` khác `false`, kích thước
  JSON của payload không vượt `CACHE_VALUE_MAX_SIZE` (khi biến khác `false`), và `permissionsCacheable` (các permission
  `read` của `req.collection` không có filter chứa `$NOW`; không có `req.collection` thì cache được). Lỗi ghi cache → log
  `warn` `[cache] Couldn't set key <key>. <err>`, vẫn trả response. Header `Cache-Control` theo `getCacheControlHeader`:
  `no-store` khi `shouldSkipCache`; `no-cache` khi không lưu, khi TTL không xác định hoặc khi `CACHE_AUTO_PURGE=true`;
  nếu lưu: `public` (không role) hoặc `private` (có role), `max-age=<TTL giây, làm tròn>`, và `s-maxage=<CACHE_CONTROL_S_MAXAGE>`
  khi biến là số nguyên không âm (mặc định `0`; giá trị không phải số nguyên thì không có `s-maxage`); luôn `Vary:
  Origin, Cache-Control`. `CACHE_VALUE_MAX_SIZE` không parse được (`bytes.parse` trả `null`) thì không giới hạn, như
  Directus. Nhánh `res.locals.cacheInstance`, `cacheTTL` (cache riêng của assets 007; deployment ngoài phạm vi) PHẢI
  được port để dùng ở 007.
- **FR-013**: `shouldSkipCache` PHẢI giống Directus: (a) header `Referer` trỏ vào `<PUBLIC_URL>/admin` (so theo path khi
  `PUBLIC_URL` tương đối, theo chuỗi đầy đủ khi tuyệt đối) **và** (`CACHE_AUTO_PURGE=false` **hoặc** pathname bắt đầu bằng
  endpoint (`getEndpoint`) của một collection trong `CACHE_AUTO_PURGE_IGNORE_LIST`); (b) `CACHE_SKIP_ALLOWED=true` và
  header `Cache-Control` của request chứa `no-store`. `shouldSkipCache` chỉ bỏ bước đọc ở middleware `cache` và đổi
  header thành `no-store`; `respond` vẫn lưu theo FR-012.
- **FR-014**: Mọi route hiện có đi qua `respond` (`/server/info`, `/server/specs/oas`, năm endpoint của 004, `/auth`
  bị loại theo FR-012) PHẢI theo FR-010 đến FR-013; `/server/health` giữ `res.locals.cache = false` như Directus. D-11
  được gỡ ở mọi route, kể cả hai route của 001 và phần "nay áp cả cho năm endpoint" của 004.
- **FR-015**: Xóa cache dữ liệu khi ghi giữ nguyên FR-082, FR-083, FR-084 của 004 (`shouldClearCache`,
  `CACHE_AUTO_PURGE`, `CACHE_AUTO_PURGE_IGNORE_LIST`, `autoPurgeCache`, bus `schemaChanged`). Feature này không thêm điểm
  xóa.
- **FR-016**: Khi Redis không dùng được, app mới PHẢI cho cùng kết quả như Directus đo trong cùng điều kiện với
  `CACHE_ENABLED=true`, theo quy tắc so của FR-085 (004): cùng status và mã lỗi, hoặc cả hai không trả trong timeout
  của bộ đối chiếu (15 giây cho đọc, 20 giây cho ghi); cùng dòng log `warn` `[cache]`; dữ liệu đã ghi giữ nguyên. Thời
  gian chờ không so, vì phụ thuộc chuỗi kết nối lại của ioredis (004 đã đo: `/server/health` khi Redis down là "không
  trả" hoặc `500` tùy retry xong trước timeout, hai app như nhau). Ca này nằm trong `src/items/cache-redis-down.test.ts` (suite `cache`), cùng cách so với `redis-down.test.ts` của 002, 004.
  Đo ở T033 (Postgres, cặp `cache-redis`, mỗi app đo ngay sau khi chính nó làm nóng cache dùng chung như FR-085 của 004):
  `GET` khi Redis của cặp dừng không trả trong 15 giây ở cả hai app; không app nào ghi `[cache] Couldn't read key`, cả
  hai ghi `warn` `[cache] Error: connect ECONNREFUSED` từ event `error` của Keyv. Nếu không làm nóng riêng từng app thì
  kết quả phụ thuộc process nào ghi cache quyền sau cùng (app mới trả `500` sau 10,6 giây khi lớp nhớ của nó còn, Directus
  treo khi phải đọc Redis), nên bộ đối chiếu luôn làm nóng riêng.
- **FR-017**: `CACHE_STATUS_HEADER` (mặc định không có header), `CACHE_VALUE_MAX_SIZE` (`false`), `CACHE_SKIP_ALLOWED`
  (`false`), `CACHE_CONTROL_S_MAXAGE` (`0`) PHẢI được đọc với cùng tên, mặc định, ép kiểu như Directus và gỡ khỏi nhóm
  "chưa hỗ trợ" của 001.

**Export**

- **FR-020**: Khi `req.sanitizedQuery.export` có giá trị, `respond` PHẢI trả file như Directus trên mọi route đi qua
  `respond`, với mọi method có payload: status `200`; `Content-Disposition: attachment; filename="<tên>"` với tên là
  `<req.collection>` (hoặc `Export` khi không có) + dấu cách + `getDateTimeFormatted()` (`YYYYMMDD-HMS`, giờ không đệm số
  0, theo múi giờ của process) + `.json`, `.xml`, `.csv` (cả `csv_utf8`), `.yaml`; `Content-Type` lần lượt
  `application/json`, `text/xml`, `text/csv`, `text/csv; charset=utf-8`, `text/yaml` (Express thêm charset như ở
  Directus); body là `ExportService.transform(payload.data, format)`: JSON thụt lề tab (`null` khi không có `data`), XML
  gốc `data` (`js2xmlparser`), CSV `json2csv` với `flatten` phân cách `.`, có dòng tiêu đề, BOM khi `csv_utf8`, chuỗi rỗng
  khi không có dòng; YAML `js-yaml` `dump`. Thư viện và phiên bản dùng như Directus 11.17.4 để nội dung trùng từng byte.
  Export không bao giờ lưu hay đọc cache (FR-010 vẫn tính key nhưng không bao giờ `HIT`; FR-012 không lưu); header
  `Cache-Control: no-cache`. Không có giới hạn riêng cho export: số dòng theo `limit` của query (`limit=-1` lấy hết,
  `QUERY_LIMIT_MAX` của 004), toàn bộ nội dung dựng trong bộ nhớ, như Directus. `HEAD` với `export` trả header như `GET`
  không body.
- **FR-021**: Trường hợp lỗi PHẢI giống Directus đo trong cùng điều kiện. Đo ở T025 khi payload không có `data` (response `204`):
  `csv`, `csv_utf8` → `500 INTERNAL_SERVER_ERROR` (`input.length` của `undefined`); `json` → `200`, body `null`; `xml` →
  `200`, `<?xml version='1.0'?>\n<data>undefined</data>`; `yaml` → `200`, body rỗng; mỗi trường hợp có ca trong bộ đối
  chiếu (FR-044). Lỗi `500` của `csv` đi qua error handler
  (001): body `{"errors": [{"message": ..., "extensions": {"code": "INTERNAL_SERVER_ERROR"}}]}` với message của
  `TypeError` (đo ở T025: `Cannot read properties of undefined (reading 'length')`) khi accountability là admin, `An
  unexpected error occurred.` khi không; header `Content-Disposition: attachment; ...` và `Content-Type: text/csv` đặt
  trước khi lỗi vẫn giữ, vì `res.json` không đổi `Content-Type` đã có và `res.send` chỉ thêm `charset=utf-8`; stack chỉ
  ở log (`logger.error`), không so. Chỉ `transform` được port; `exportToFile`, `ImportService` (chạy nền, ghi `directus_files`, thông báo)
  thuộc `/utils/export`, `/utils/import` của feature 010 (D-09.8).

**Event**

- **FR-030**: `Emitter` PHẢI là port đầy đủ của `emitter.ts`: ba `EventEmitter2` (filter, action, init) với `wildcard`,
  `delimiter: '.'`, `ignoreErrors`; `emitFilter` chạy listener tuần tự, lấy kết quả khác `undefined` làm payload mới,
  context mặc định `{database, accountability: null, schema: null}`; `emitAction` gọi `emitAsync` không chờ, lỗi → hai
  dòng `warn` (`An error was thrown while executing action "<event>"` và lỗi); `emitInit`; `onFilter`, `onAction`,
  `onInit`, `off*`, `offAll`. Thay file thế chỗ của 004, giữ `useEmitter`.
- **FR-031**: Mọi event Directus phát trong các service đã port PHẢI được phát với cùng tên, `meta` và `context`: filter
  `items.create`, `<collection>.items.create` (và `update`, `delete`) trong transaction với `database: trx`; action sau
  commit với `meta` `{payload, key|keys, collection}` (`payload` của `delete` là mảng khóa); event lồng
  (`nestedActionEvents`) sau event chính; `<scope>.create|update|delete` với scope là tên collection hệ thống bỏ
  `directus_` (`users`, `roles`, `policies`, `access`, `permissions`, `activity`, `revisions`, `presets`; `settings` khi
  `SettingsService` kế thừa `ItemsService` ở 010); `auth.login`, `auth.jwt`,
  `auth.create`, `auth.update`, `authenticate` của 003; `emitEvents: false` và `bypassEmitAction` giữ nguyên. Không có
  listener nào ngoài cầu nối FR-032 trong feature này, nên response và dữ liệu ghi không đổi (kiểm bằng FR-047).
- **FR-032**: Cầu nối `websocket.event` PHẢI là port của `websocket/controllers/hooks.ts`: đăng ký `onAction` cho
  `items` và mọi tên trong `systemCollectionNames` bỏ `directus_` trừ `migrations`, `fields`, `relations`, `files`
  (hook riêng) và `sessions` (loại vì bảo mật): `<module>.create` → `{collection, action: 'create', key, payload}`
  (`payload` mặc định `{}`), `.update` → `{collection, action: 'update', keys, payload}`, `.delete` → `{collection,
  action: 'delete', keys, payload}` (`payload` mặc định `[]`); hook riêng `fields.*` (collection `directus_fields`),
  `files.upload` (như `create`), `files.update|delete`, `relations.*`, `items.sort` giữ nguyên để các feature 006, 007,
  010 phát là tự có. Mỗi thông điệp publish lên kênh `websocket.event` của bus dùng chung (002), cùng namespace với
  Directus. Điều kiện đăng ký PHẢI giống Directus (Clarifications): chỉ khi `WEBSOCKETS_ENABLED=true` và
  (`WEBSOCKETS_REST_ENABLED=true` hoặc `WEBSOCKETS_GRAPHQL_ENABLED=true`), đọc một lần khi khởi động từ `.env` dùng
  chung (đổi env cần khởi động lại); mặc định của Directus là `false`, `true`, `true`, nên trong thực tế điều kiện là
  `WEBSOCKETS_ENABLED`. App mới vẫn không mở WebSocket (Nguyên tắc XI). Với cấu hình hiện tại (mọi node tắt WebSocket)
  không bên nào publish. Lỗi `publish` (Redis không dùng được) PHẢI cho cùng kết quả như Directus (R-10): request vẫn
  trả như thường vì `publish` không được chờ; lỗi nổi lên như promise bị từ chối không ai bắt.
- **FR-033**: Thông điệp app mới publish cho một thao tác ghi PHẢI trùng thông điệp Directus publish cho cùng thao tác
  (SC-005), để instance Directus bật WebSocket chuyển tiếp được như khi ghi ở Directus; việc chuyển tiếp tới client là
  code của Directus, không kiểm trong feature này (Clarifications). `/server/info` của app mới vẫn trả `websocket:
  false` (Nguyên tắc XI, 001).

**Kiểm thử đối chiếu**

- **FR-040**: Bộ đối chiếu PHẢI port các file items, query, relational ở đầu spec (11 file test, seed, bộ sinh filter
  `tests/db/query/filter` và `tests/db/schema/<kiểu>` trừ `timezone`), copy nguyên và chạy nguyên bản hai lượt, một lượt
  với URL của app mới và một lượt với URL của Directus (lượt Directus chứng minh bản port trung thành), trên một cặp
  profile `blackbox` có env giống `directus/tests/blackbox/common/config.ts` (các khẳng định phụ thuộc
  `MAX_BATCH_MUTATION`, `QUERY_LIMIT_DEFAULT`, `MAX_RELATIONAL_DEPTH`); seed tạo
  collection, field, relation qua API của Directus (D-09.4) và tạo item qua API của app đang thử. Các ca xen GraphQL và
  WebSocket trong cùng `it`: khẳng định GraphQL (`requestGraphQL`) gửi về Directus tới feature 011 (D-09.9), khối
  WebSocket (`createWebSocketConn`, `createWebSocketGql`, `getMessages`) bỏ hẳn kèm ghi chú (Nguyên tắc XI, D-17); mọi
  khẳng định REST giữ nguyên, và tiêu chí chấp nhận "chạy qua trên app mới" áp cho phần REST. File hoãn:
  `version.test.ts` tới 008 (D-09.6); `timezone` tới 006; `cache-revalidate` tới 007 (ghi ở bảng "Phần port rút gọn tạm
  thời" của plan để feature sau nhận). Ca fail trên chính Directus ở một vendor được bỏ qua theo vendor kèm ghi chú
  (Assumptions), danh sách lưu trong bộ đối chiếu (một file theo vendor, có tên ca và lần chạy đối chứng) và là đường
  cơ sở của SC-001.
- **FR-041**: Bộ port PHẢI chạy trên Postgres ở mỗi lần push (đủ ba kiểu khóa chính `integer`, `uuid`, `string`); trên
  MySQL và SQLite: bộ rút gọn ở mỗi lần push, định nghĩa là mọi file test với một kiểu khóa chính (`integer`), nên mỗi
  file có đủ ca đọc, ghi, quan hệ và mọi kiểu field của `CheckQueryFilters` có mọi toán tử; đủ bộ (ba kiểu khóa) ở
  workflow riêng (hằng tuần, bấm tay), PHẢI xanh ở cả ba vendor trước khi đóng feature (tiêu chí chấp nhận; cách chia
  job như SC-001 của 004; Clarifications). Mỗi job CI dưới 60 phút; job chạy bộ port và job chạy bốn cấu hình cache
  (FR-042) đều chặn merge, như 004.
- **FR-042**: Bộ đối chiếu PHẢI port `tests/db/app/cache.test.ts` và `tests/db/routes/permissions/cache-purge.test.ts` với
  cả hai app ở bốn cấu hình (`CACHE_STORE` memory, redis × `CACHE_AUTO_PURGE` true, false; `CACHE_STATUS_HEADER`
  đặt; `CACHE_SKIP_ALLOWED=false`, ghi đè giá trị `true` của env vendor, và request không header như blackbox; collection bị bỏ qua của `cache.test.ts` có
  tên cố định đặt sẵn trong `CACHE_AUTO_PURGE_IGNORE_LIST` của cặp), và thêm ca dùng chéo: cùng key và giá trị với cache
  trống (so như FR-080 của 004); `HIT` chéo hai chiều; ghi ở app này xóa cache cho app kia (`CACHE_AUTO_PURGE=true`) và
  không xóa (`false`); `$NOW` không cache; `ip_access` khớp đưa `ip` vào key (policy có `ip_access` chứa IP mà app thấy
  từ mạng Docker, đọc từ `GET /users/me` hoặc log request trước khi đặt); `CACHE_SKIP_ALLOWED` (cặp chính);
  `CACHE_VALUE_MAX_SIZE` (một cặp đặt ngưỡng nhỏ, ví dụ `1kb`, với một response vượt ngưỡng); Referer của app; Redis
  không dùng được (FR-016). Mỗi cặp app trong một cấu hình PHẢI có cùng `CACHE_*`.
- **FR-043**: Bộ so sánh của môi trường đối chiếu chính PHẢI so response do từng app tự tính (không so bản cache do app
  kia ghi): env của cặp chính đặt `CACHE_SKIP_ALLOWED=true` cho cả hai app và bộ so sánh gửi header `Cache-Control:
  no-store` với mọi `GET`, `HEAD` (Clarifications); hai app khi đó trả `Cache-Control: no-store` và header trạng thái
  `MISS` như nhau (FR-013), các header này vẫn được so. Các request này vẫn ghi bản cache vào Redis dùng chung
  (FR-013). Điều này vô hại vì cặp chính có `CACHE_AUTO_PURGE=true`, nên mọi thao tác ghi đều xóa cache. Hệ quả: kỳ vọng `Cache-Control: no-cache` của các test 001 đến
  004 ở cặp chính trở thành `no-store` ở cả hai app (sửa kỳ vọng trong test, không phải khác biệt); ca từng né cache
  bằng query khác nhau giữa các lần gọi được giữ nguyên. Request không có header đó (ca FR-042, bốn cấu hình riêng) mới
  đi qua cache. Ghi chú D-11 trong README của bộ đối chiếu và `profile-cache-config.env` được sửa theo.
- **FR-044**: Bộ đối chiếu PHẢI có ca export cho mỗi định dạng (`json`, `csv`, `csv_utf8`, `xml`, `yaml`) × (danh sách
  có field quan hệ lồng m2o và o2m, một item, singleton, danh sách rỗng, `aggregate` với `groupBy`, `fields` có hàm
  (`year(date_created)`), `SEARCH`, `GET /users`, `GET /server/info`, response `204`, giá trị lạ `400`, tên collection có
  ký tự ngoài ASCII): so status, `content-type`, `content-disposition` (thay phần `YYYYMMDD-HMS` bằng dấu hiệu,
  cả trong phần `filename*=`), và body từng byte sau khi thay id, uuid và thời điểm sinh ngẫu nhiên bằng dấu hiệu theo kiểu
  (quy tắc so của 004 áp cho body dạng chuỗi).
- **FR-045**: Bộ đối chiếu PHẢI subscribe kênh `websocket.event` của Redis và so chuỗi thông điệp hai app phát cho cùng
  chuỗi thao tác ghi (tạo một, nhiều; sửa một, nhiều, lô, theo query; xóa một, nhiều, theo query; ghi lồng; singleton;
  năm collection hệ thống; `PATCH /users/me/track/page` phát một `users.update` với `keys: [<user>]`,
  `payload: {last_page}` vì Directus không tắt event ở luồng này): cùng số lượng, thứ tự, `collection`, `action`, `key|keys`,
  `payload` (chuẩn hóa id); chuỗi của một thao tác chốt sau khi response trả về cộng 2 giây không có thông điệp mới
  (event phát sau commit, không chờ listener); thông điệp tới sau mốc đó tính là lỗi. Ca này chạy ở một cặp riêng có
  `WEBSOCKETS_ENABLED=true`, `WEBSOCKETS_REST_ENABLED=true`
  cho cả hai app (cặp chính tắt WebSocket, nên ở đó kiểm "không bên nào publish"); không có client WebSocket
  (Clarifications). Unit test port cùng code:
  `get-cache-key.test.ts`, `get-cache-headers.test.ts`, `should-skip-cache.test.ts`, `permissions-cacheable.test.ts`,
  `import-export.test.ts`; các file Directus không có test (`emitter.ts`, `hooks.ts`, `respond.ts`, `cache.ts`,
  `collection-exists.ts`, `controllers/items.ts`) PHẢI có unit test mới cho từng nhánh ở FR-010, FR-012, FR-020, FR-030,
  FR-032.
- **FR-046**: Môi trường đối chiếu PHẢI thêm `items` vào danh sách route của proxy (`proxy/backoffice-routes.txt`) và bộ
  Playwright PHẢI thêm kịch bản module Content (US6: tạo, sửa, xóa, xóa hàng loạt, tải CSV từ sidebar Export với các
  lựa chọn mặc định của sidebar: định dạng CSV, mọi field, giới hạn mặc định) trên một collection tạo qua API của
  Directus; so dòng DB và file tải về (bỏ phần `YYYYMMDD-HMS` trong tên, thay id bằng dấu hiệu) với lần chạy đối chứng.
  Cổng chặn merge như SC-008 của 004.
- **FR-047**: Toàn bộ bộ đối chiếu của 001 đến 004 PHẢI chạy lại và đạt sau khi `respond`, middleware `cache` và
  `Emitter` đổi (ảnh hưởng mọi route), gồm cả ma trận quyền đầy đủ của `parity-matrix.yml` trước khi đóng feature.
  Entry `D-09.3`, `D-11`, `D-12`, `D-30` xóa khỏi `accepted-differences.ts`; `D-26`, `D-29` sửa theo bảng khác biệt.
- **FR-048**: Benchmark PHẢI thêm bộ items ở quy mô thiết kế (Nguyên tắc X, Clarifications): collection lớn nhất 10 triệu
  dòng nạp bằng bulk load, có m2o và o2m tới collection nhỏ hơn; kịch bản: `GET` danh sách có `filter`, `sort`, `limit`, `fields` lồng m2o;
  `GET /:pk` (id lấy xoay vòng từ một pool đọc trước); `POST` (dọn các dòng tạo ra sau mỗi lượt); `PATCH /:pk` (pool);
  `DELETE /:pk` (id tiêu thụ tuần tự từ dải riêng của mỗi app, đủ cho mọi lượt; hết dải là lỗi của benchmark, không
  phải kết quả); với user admin và user có filter quyền; hai chế độ: tươi (mọi request mang `Cache-Control: no-store`,
  đo engine và route) và `HIT` (lặp cùng `GET` không header, đo đường middleware cache và Redis; hai app đọc cùng bản
  cache do bên nào ghi trước nên chênh lệch phản ánh chi phí middleware, không phải nội dung). Ngưỡng 10% áp cho từng
  kịch bản ở từng chế độ. Chạy trong workflow benchmark hằng tuần, không chặn CI (quyết định của 003, 004).

**Biến môi trường**

- **FR-050**: App mới PHẢI đọc với cùng tên, mặc định, ép kiểu như Directus 11.17.4 và gỡ khỏi nhóm "chưa hỗ trợ":
  `CACHE_STATUS_HEADER`, `CACHE_VALUE_MAX_SIZE`, `CACHE_SKIP_ALLOWED`, `CACHE_CONTROL_S_MAXAGE` (FR-017);
  `WEBSOCKETS_ENABLED`, `WEBSOCKETS_REST_ENABLED`, `WEBSOCKETS_GRAPHQL_ENABLED` (chỉ đọc cho điều kiện đăng ký của
  FR-032; app mới vẫn không mở WebSocket, Nguyên tắc XI; các biến `WEBSOCKETS_*` khác vẫn ở nhóm "chưa hỗ trợ").

### Key Entities

- **Item**: một dòng của collection người dùng; khóa chính theo schema; field quan hệ lồng theo `directus_relations`.
- **Collection người dùng**: có trong `SchemaOverview`; cờ `singleton` quyết định route (FR-003); collection hệ thống
  (`directus_*`) không đi qua `/items`.
- **Bản cache response**: key (FR-011), giá trị (payload JSON đã nén), `__expires_at`; sống trong *cache dữ liệu* (thuật
  ngữ của 004, Key Entities) với TTL `CACHE_TTL`; chỉ có khi `CACHE_ENABLED=true`.
- **Thuật ngữ** (dùng đúng các tên này trong spec, plan, tasks): *response cache* là tính năng (FR-010 đến FR-016);
  *cache dữ liệu* là kho Keyv của 004 chứa nó; *bản cache response* là một cặp key `<hash>`, `<hash>__expires_at`
  trong kho đó; *môi trường đối chiếu chính* là bộ container của `env-up --vendor=<v>`; *cặp chính* là Directus 8155 và
  app mới 8156 trong môi trường đó; *cặp profile* là mọi cặp khác (`cache-*`, `websocket`, `sso`...).
- **File export**: response có `Content-Disposition`; tên `<collection|Export> <thời điểm>.<ext>`; nội dung sinh từ
  `data`.
- **Event**: filter (trong transaction, đổi được payload) và action (sau commit); tên `<scope>.<action>`, `meta`
  `{payload, key|keys, collection}`, `context` `{database, schema, accountability}`.
- **Thông điệp `websocket.event`**: `{collection, action, key}` (create) hoặc `{collection, action, keys, payload}`
  (update, delete) trên kênh `websocket.event` của bus Redis dùng chung.

## Khác biệt so với Directus *(mandatory)*

Thay đổi với bảng khác biệt của các feature trước:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-09.3 | Gỡ: `/items` làm ở feature này | FR-001 đến FR-006 |
| D-11 | Gỡ hẳn (cả `/server/info`, `/server/specs/oas` của 001 và năm endpoint của 004): response cache như Directus ở mọi route | FR-010 đến FR-017 |
| D-12 | Gỡ: `export` làm ở feature này (kiểm query đã gỡ ở 004) | FR-020, FR-021 |
| D-30 | Gỡ: thông điệp `websocket.event` phát như Directus, cùng điều kiện đăng ký `WEBSOCKETS_*` (Clarifications) | FR-032, FR-033 |
| D-29 | Thu hẹp: event `users.*`, `roles.*`, `policies.*`, `access.*`, `permissions.*` (filter và action) được phát như Directus; dòng này chỉ còn "flow có trigger event không chạy khi event phát ở app mới" tới 009 (hook extension vĩnh viễn ngoài phạm vi, đã có D-17, Nguyên tắc XI) | FR-030, FR-031 |
| D-26 | Thu hẹp như D-29 cho `auth.login`, `auth.jwt`, `auth.create`, `auth.update`, `authenticate` (service của 003 giữ nguyên lời gọi emitter nên phát ngay khi có emitter thật); phần flow tới 009 | FR-031 |

Sửa bảng của spec cũ đi cùng feature này: dòng D-09.3, D-11, D-12 trong spec 001; dòng D-26 trong spec 003; dòng D-29,
D-30 và cột D-11 của bảng "Thay đổi" trong spec 004. Entry tương ứng trong `tests/parity/accepted-differences.ts` theo
FR-047. Mọi dòng của mục này cần tech lead duyệt khi đóng feature (Nguyên tắc X).

Khác biệt mới:

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại | Gỡ khi |
|----|----------|------------------|---------|-------|------|--------|
| Không có | | | | | | |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. Tên kênh `websocket.event`, tên event (`items.create`...), tên file export mặc định `Export`, tiền tố log
  `[cache]`, tên header do `CACHE_STATUS_HEADER` quyết định đều giữ nguyên vì ảnh hưởng luồng hoặc không mang chữ
  "Directus" (Nguyên tắc IX).

**Rủi ro chấp nhận (tái tạo từ Directus)**: app mới làm giống Directus 11.17.4 kể cả các hành vi không an toàn dưới đây
(quy tắc của 004). Mỗi dòng cần tech lead duyệt khi đóng feature. Đường dẫn tính từ `directus/api/src`.

| Mã | Hành vi của Directus | Bằng chứng | Hệ quả |
|----|----------------------|------------|--------|
| R-07 | `meta.payload` của action event `*.create`, `*.update` là payload sau preset nhưng trước `processValues` (hash, conceal), nên `users.create`, `users.update` mang `password` dạng rõ, `token`, `tfa_secret` tới mọi listener action và lên bus `websocket.event` (chỉ `directus_sessions` bị loại; `directus_activity`, `directus_revisions` cũng được publish, payload của `revisions.create` đã che theo FR-092 của 004). Chủ dự án chọn tái tạo (Clarifications) | `services/items.ts:142,193,395` (`actionHookPayload = payloadWithPresets` trước `processValues('create')` ở dòng 219; tương tự `update` dòng 812); `websocket/controllers/hooks.ts:24` | Mật khẩu rõ đi qua Redis pub/sub và tới instance Directus bật WebSocket, tới client đã subscribe `directus_users` có quyền đọc (Directus lọc theo quyền đọc ở phía subscriber). Không ghi log |
| R-08 | Response cache khóa theo `user`, `path`, `query` (và `ip` khi khớp `ip_access`), không theo role hay policy; với `CACHE_AUTO_PURGE=false` (mặc định) mọi thao tác ghi dữ liệu không xóa cache | `utils/get-cache-key.ts`; `utils/should-clear-cache.ts` | Client đọc được dữ liệu cũ tới `CACHE_TTL` (mặc định 5 phút) sau khi ghi ở bất kỳ app nào; đây là thiết kế của Directus, ghi để đội vận hành biết |
| R-09 | Key cache không chứa `share`, `session`, `role`: request bằng token share có `user: null` nên cùng key với request public cùng `path`, `query`; `permissionsCacheable` không xét share | `utils/get-cache-key.ts:48` (`user: req.accountability?.user \|\| null`); `middleware/cache.ts` không có nhánh share | Request public có thể nhận bản cache do request share tạo (dữ liệu của item được share, chỉ khi public cũng được đọc collection đó với cùng query) và ngược lại, tới hết `CACHE_TTL`. Chỉ xảy ra khi `CACHE_ENABLED=true`; share có từ 010 nên ca đo thuộc 010 |
| R-10 | `registerAction` gọi `messenger.publish(...)` không `await`, không `catch`; khi Redis không dùng được, ioredis xếp lệnh vào hàng đợi offline rồi từ chối sau `maxRetriesPerRequest` (mặc định 20) lần kết nối lại; promise bị từ chối không ai bắt; code Directus không đăng ký `process.on('unhandledRejection')`, chỉ pm2 của image Directus bắt | `websocket/controllers/hooks.ts:191-193`; `packages/memory/src/bus/lib/redis.ts` (`publish` `await this.pub.publish`); `redis/lib/create-redis.ts` không đặt tùy chọn retry | Đo ở T044 (Postgres, cặp `cache-redis`): ghi khi Redis dừng trả `200` ở cả hai app; `publish` bị từ chối sau khoảng 10 giây (`MaxRetriesPerRequestError`) và không ai bắt. Image Directus chạy dưới `pm2-runtime`, pm2 ghi `You have triggered an unhandledRejection, ...` lên stderr và giữ process; app mới chạy `node` trần nên process thoát. Sửa: `apps/api/src/unhandled-rejection.ts` làm như pm2; nay hai app ghi cùng dòng log, không process nào thoát, không phải khởi động lại |

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4. Khi spec không nói rõ, làm như code Directus. Quy ước message lỗi và quy tắc so
  của bộ đối chiếu như Assumptions của 004.
- Cách hiểu "gỡ D-29 phần filter và action cho flow": emitter thật phát mọi filter và action event (để 009 nối flow);
  phần còn lại của D-29 (flow có trigger event chưa chạy) và D-26 tới 009; không có extension nào đăng ký là Nguyên tắc
  XI (D-17), không phải khác biệt mới. Tech lead xác nhận khi duyệt bảng khác biệt.
- Trong feature này không có listener nào ngoài cầu nối `websocket.event`, nên `emitFilter` trả payload nguyên và hành
  vi HTTP không đổi; FR-047 kiểm chứng.
- Seed của bộ blackbox tạo collection, field, relation qua API của Directus vì `/collections`, `/fields`, `/relations`
  thuộc 006 (như 004 đã làm với collection người dùng của ma trận quyền). Từ 006 chọn được app tạo seed bằng
  `PARITY_BLACKBOX_SETUP_APP` (mặc định Directus; `blackbox-full` hằng tuần chạy thêm lượt `backoffice`, FR-064 của 006). Helper `ClearCaches` của blackbox gọi
  `/utils/cache/clear` (010): bộ đối chiếu xóa cache bằng cách xóa key trong Redis (`flushSharedCaches` của 004).
- Blackbox của Directus chạy mỗi vendor hai instance (có và không cache, `TEST_NO_CACHE`); bộ đối chiếu dùng cặp app với
  cùng `CACHE_*` và cách so ở FR-043. Môi trường đối chiếu chính giữ `CACHE_ENABLED=true` như 003 và thêm
  `CACHE_SKIP_ALLOWED=true` (biến của Directus, chỉ trong env test); ca của 003, 004 từng né cache bằng query khác nhau
  (ghi chú D-11 trong README) có thể bỏ cách né đó.
- Ca của bộ blackbox fail trên chính Directus ở một vendor (ví dụ 4 lỗi có sẵn của MySQL ghi ở 001) được bỏ qua theo
  vendor với ghi chú tên ca và vendor trong bộ đối chiếu, như 003 đã làm với refresh đồng thời trên MySQL, MariaDB.
- Thư viện export dùng cùng tên và phiên bản như `directus/api/package.json` (`json2csv`, `js2xmlparser`, `js-yaml`) để
  nội dung trùng từng byte; emitter dùng `eventemitter2` như Directus.
- Benchmark items chạy ở workflow benchmark hằng tuần, không chặn CI; 10 triệu dòng nạp bằng bulk load (chủ dự án chọn,
  Clarifications); cách nạp và chỉ mục chọn khi lập plan.
- `requestCounter` (telemetry) không port (Nguyên tắc XI, D-17). GraphQL cache và `websocket.event` cho GraphQL thuộc 011;
  `rawQuery` của `/flows/trigger` trong key cache thuộc 009; cache riêng của assets (`cacheInstance`) dùng ở 007.
- Playwright E2E tạo collection bằng API của Directus; file CSV tải về so sau khi bỏ phần thời gian trong tên.
- Collection, field, relation và index của bộ blackbox và benchmark tạo được qua API của Directus 11.17.4
  (`/collections`, `/fields` với `schema.is_indexed`, `/relations`); nếu API không tạo được index thì benchmark tạo
  index bằng SQL trên host (không phải DDL của app mới, Nguyên tắc II không bị chạm) và ghi vào tasks.
- Quy tắc so body export (chuỗi): thay uuid, id tự tăng và thời điểm bằng dấu hiệu theo kiểu trước khi so từng byte;
  phần `YYYYMMDD-HMS` của tên file thay bằng dấu hiệu.
- Không có node Directus nào bật WebSocket trong triển khai hiện tại (chủ dự án, Clarifications), nên với `.env` thật
  cả hai bên đều không publish `websocket.event`. Cặp bật WebSocket cho FR-045, SC-005 là cặp riêng của môi trường đối
  chiếu (Directus hiện chạy `WEBSOCKETS_ENABLED=false`), không đổi cặp chính; cả hai app của cặp đó đọc cùng
  `WEBSOCKETS_*`; không dựng client WebSocket (Clarifications).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% ca port ở FR-040 đạt với cả hai app trên Postgres (mỗi lần push), và trên MySQL, SQLite (đủ bộ ở
  workflow riêng, bộ rút gọn mỗi lần push); ca bỏ qua theo vendor có ghi chú và không quá số ca fail trên chính Directus.
- **SC-002**: 100% request của bộ đối chiếu `/items` (US1, FR-001 đến FR-006, kể cả `OPTIONS`, `HEAD`, lỗi) cho cùng
  status, mã lỗi, message, body, các header bộ đối chiếu so (FR-104 của 001, thêm `content-disposition`, header của
  `CACHE_STATUS_HEADER`) và cùng thay đổi DB ở hai app.
- **SC-003**: Với cache trống và cùng request, tập key và giá trị hai app ghi vào Redis trùng nhau 100%; request lặp lại ở
  app kia là `HIT` với body giống hệt trong 100% của ít nhất 20 lần thử mỗi chiều; 100% ca của `cache.test.ts`,
  `cache-purge.test.ts` và các ca FR-042 đạt ở bốn cấu hình.
- **SC-004**: 100% ca export (FR-044) có body trùng từng byte và cùng header sau chuẩn hóa.
- **SC-005**: 100% chuỗi thao tác ghi của FR-045 cho cùng chuỗi thông điệp `websocket.event` ở hai app (cặp bật
  WebSocket), và 0 thông điệp từ cả hai app ở cặp tắt WebSocket.
- **SC-006**: Với dữ liệu quy mô thiết kế (FR-048), p95 latency và throughput của mỗi kịch bản items không tệ hơn Directus
  quá 10% (Nguyên tắc X) ở cả hai chế độ cache, đo ở workflow benchmark hằng tuần.
- **SC-007**: Đội vận hành dùng nguyên file `.env` của Directus; các biến ở FR-050 không còn trong dòng cảnh báo "biến chưa
  hỗ trợ".
- **SC-008**: 100% kịch bản Playwright của FR-046 đạt ở CI: module Content và tải CSV chạy qua proxy với `/items` vào
  app mới, DB và file giống lần chạy đối chứng.
- **SC-009**: Toàn bộ bộ đối chiếu của 001 đến 004 vẫn xanh (FR-047) với response cache bật ở cặp app chính
  (`CACHE_SKIP_ALLOWED=true`, bộ so sánh gửi `Cache-Control: no-store`, FR-043), không thêm khác biệt chấp nhận nào
  ngoài bảng ở trên.
