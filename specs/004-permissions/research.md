# Research: Phân quyền (004)

Mỗi mục gồm Quyết định, Lý do, Đã cân nhắc. Mốc so sánh là Directus 11.17.4 (api 35.2.0). Điều gì chưa đo thì ghi
`[Suy luận]` và có task kiểm sớm. Hai quyết định lớn đã chốt ở Clarifications của spec: port đủ engine đọc và ghi ở
004; kiểm app Directus qua reverse proxy bằng Playwright ở CI.

## R1. Thư viện và phiên bản

- **Quyết định**: Thêm vào catalog `pnpm-workspace.yaml` đúng bản của `directus/pnpm-workspace.yaml`: `snappy` 7.3.3
  (nén giá trị cache dữ liệu, `utils/compress.ts`), `ip-matching` 2.1.2 (`PoliciesService` kiểm `ip_access` bằng
  `getMatch`; `ipInNetworks` của `@backoffice/utils` đã dùng gói này thì giữ nguyên bản), `@types/wellknown` 0.5.8
  nếu chưa có. Dùng lại bản đã có: `joi` 18.2.6, `lodash-es`, `date-fns` 4.1.0, `wellknown` 0.5.0 (`PayloadService`,
  `validateQuery`, helper geometry), `nanoid` (`nanoid/non-secure` cho `generate-alias`), `knex` 3.1.0, `keyv`,
  `knex-mock-client` 3.0.2 (test). Không thêm `uuid` (Directus chỉ dùng trong migration), `geojson` (không phải
  dependency của api), `json2csv` (export, 005), `nodemailer`, `liquidjs` (không gửi email). Port từ
  `directus/packages/utils/shared` vào `@backoffice/utils` đúng các file mà engine và module quyền import (đã kiểm kê):
  `parse-filter` (`parseFilter`, `parsePreset`, 172 dòng), `parse-now`, `adjust-date`, `get-with-arrays`,
  `is-dynamic-variable`, `get-relation`, `get-relation-info`, `validate-payload`, `generate-joi` (390),
  `inject-function-results`, `functions`, `is-detailed-update-syntax`, `deep-map`, `deep-map-with-schema` (287),
  `get-filter-operators-for-type`, `get-functions-for-type`, `get-output-type-for-function`,
  `parse-filter-function-path`, `get-endpoint`, `compress` (342, nén JSON theo key cho cache dữ liệu), kèm test gốc.
  `apply-options-data`, `merge-filters`, `process-chunk` không được engine import nên không port. Danh sách chốt ở
  bảng ánh xạ của plan; task đầu của Phase 2 kiểm lại bằng import thực tế.
- **Lý do**: Cùng bản thì cùng hành vi: `generate-joi` quyết định message `FAILED_VALIDATION`; `parse-filter` quyết
  định cách giải biến động; `snappy` quyết định byte của giá trị `filter-context-*` mà hai app đọc chung (FR-014).
- **Đã cân nhắc**: Zod (bị loại: message khác Joi của Directus, Nguyên tắc III). Bỏ nén cache dữ liệu (bị loại: giá
  trị `filter-context-*` của app mới phải đọc được ở Directus và ngược lại).
- **Rủi ro**: `snappy` là module native (napi-rs) `[Suy luận]` có bản dựng sẵn cho musl; task build Docker image kiểm
  sớm như `argon2` ở 003.

## R2. `authenticate` cho mọi path, `sanitizeQuery` vào pipeline

- **Quyết định**: `app-pipeline.ts`: thay nhánh chọn theo path bằng `app.use(authenticate)` (sau `/server/ping`); xóa
  `middleware/public-accountability.ts` và test của nó (gỡ D-10, cảnh báo D-18). Thêm `app.use(sanitizeQueryMiddleware)`
  ngay sau `schema`, trước `cache`, đúng thứ tự `directus/api/src/app.ts:307-315` (`authenticate` → `schema` →
  `sanitizeQuery` → `requestCounter` → `cache`). `requestCounter` vẫn không port (telemetry, ngoài phạm vi từ 001).
  Port nguyên `middleware/sanitize-query.ts`, `utils/sanitize-query.ts`, `utils/validate-query.ts`, `utils/split-fields`
  và các util chúng import. `sanitizeQuery` giải biến động trong `filter` của request theo accountability (dùng
  `fetchPolicies`, `fetchDynamicVariableData`), nên phải đứng sau `authenticate` và `schema`.
- **Lý do**: FR-001, FR-004, FR-040. Mọi route của Directus (kể cả `/server/*`, `/metrics`, path lạ) đều đi qua
  `sanitizeQuery`, nên D-12 thu hẹp còn `export` (xử lý trong `respond`, 005).
- **Đã cân nhắc**: Chỉ chạy `sanitizeQuery` cho năm controller (bị loại: `?limit=abc` tới `/server/info` ở Directus trả
  `400 INVALID_QUERY`; giữ D-12 rộng thêm một feature trong khi code đã có).

## R3. Controller Nest cho năm endpoint

- **Quyết định**:
  - Năm controller: `users.controller.ts` (mở rộng file 003), `roles.controller.ts`, `policies.controller.ts`,
    `access.controller.ts`, `permissions.controller.ts`. Route khai báo đúng thứ tự đăng ký của file gốc
    (contracts/permissions-api.md §1): route `me` trước `:pk`; `@Search()` của Nest 12 (`RequestMethod.SEARCH`, đã
    có; Express 5.2.1 và `router` 2.2.0 nhận method `SEARCH`); `@Post` có `@HttpCode(200)` như 003.
  - `validateBatch`, `useCollection` port thành hàm async gọi ở đầu handler (`await validateBatch('read')(req)`), thay
    cho middleware Express: biến đổi cơ học như 003 làm với router của driver, không phụ thuộc cách Nest khớp path
    cho middleware. Lỗi ném ra đi qua `ErrorHandlerFilter` như mọi route.
  - `GET /:pk` của `/users`, `/policies`, `/access`, `/permissions`: `req.path.endsWith('me')` thì không đọc gì và
    gọi `respond(res)` không payload → `204` không body. Ở Directus `next()` chuyển sang `respond` đứng sau trong cùng
    route (đã đọc `controllers/access.ts:83-98`, `users.ts:127-141`), nên không rơi xuống `notFoundHandler`
    (contracts §1 dòng 5).
  - `OPTIONS`: thêm bảng contracts §3 vào `middleware/router-options.ts`.
  - Service vào controller qua factory trong `providers.ts` (`UsersService` đã có; thêm `RolesService`,
    `PoliciesService`, `AccessService`, `PermissionsService`, `MetaService`). Engine, `getService`, service lồng dùng
    `new` trực tiếp như Directus.
- **Lý do**: Quy ước 001 (controller mỏng, logic ở service) và 003 (handler object thay router). Thứ tự route quyết
  định `Allow` và route nào khớp.
- **Đã cân nhắc**: Mount năm router Express của Directus nguyên vẹn trước Nest (bị loại: lệch quy ước; `respond` và
  `asyncHandler` của Directus dựa vào `next(err)`). Nest middleware `forRoutes` cho `validateBatch` (bị loại: cách khớp
  path của Nest middleware khác router Express, phải đo thêm).

## R4. Port engine đọc và ghi

- **Quyết định**: Port nguyên vẹn, cùng đường dẫn, kèm test gốc (FR-104):
  - `database/get-ast-from-query/**` (dựng AST từ query theo quyền: mở rộng `*`, bỏ quan hệ không đọc được, a2o);
  - `database/run-ast/**` (`run-ast.ts`, `lib/get-db-query.ts`, `lib/apply-query/**` (filter, search, sort,
    aggregate, limit, offset, hàm ngày giờ, quan hệ, `_some`/`_none`), `utils/apply-case-when.ts`,
    `merge-with-parent-items`, `get-column*`, `generate-alias`, đọc o2m theo lô `RELATIONAL_BATCH_SIZE`);
  - `services/items.ts` thay bản rút gọn của 003 (xóa `notAvailable`, `assertNoPermissionChecks`,
    `assertFlatPayload`, `keysOfFilter`); `services/payload.ts` thay bản rút gọn (`processM2O`, `processA2O`,
    `processO2M`, geometry ghi, hàm JSON); `services/meta.ts`; `utils/get-service.ts` (R6); `utils/*` mà chúng import
    (bảng ánh xạ của plan).
  - Nhánh `query.version` (versions, 008) trong `readOne`, `readMany`, `readSingleton`: `VersionsService` và
    `utils/versioning/handle-version.ts` chưa có, nên ném `Error('versions are not available before feature 008')` với
    comment `ponytail:`; ghi vào dòng D-09.6 của bảng 001 (xem R10). Không có `/items` route (005), nên engine ở 004
    chỉ được gọi qua năm controller, `fetchDynamicVariableData`, `validateItemAccess`, `getPermissionsForShare`,
    `MetaService` và các service của 003.
  - Kích thước (đã kiểm kê): `get-ast-from-query` 6 file, 650 dòng (test 6 file, 1.337); `run-ast` 30 file, 2.672
    dòng (test 16 file, 2.632); `items.ts` 1.249, `payload.ts` 1.096, `meta.ts` 90; util engine import khoảng 20 file,
    1.000 dòng (`sanitize-query` 303, `validate-query` 248, `get-column-path` 102, `transaction` 99 (đã có),
    `calculate-field-depth` 79, `split-fields` 36, `filter-items` 36, `parse-filter-key`, `parse-numeric-string`,
    `get-collection-from-alias`, `get-field-relational-depth`, `get-service` 88, `get-accountability-for-role` 47);
    `types/ast.ts` 117.
  - Vòng import của Directus (`run-ast` → `payload` → `get-service` (import động) → `items` → `run-ast`; `helpers/fn`
    → `run-ast`) giữ nguyên: module ESM, lớp dùng khi gọi chứ không khi nạp, và Directus chạy đúng với cùng cấu trúc.
    Không đưa engine vào DI của Nest (R3).
- **Lý do**: Clarifications Q1. Kiểm quyền đọc của Directus nằm trong `get-ast-from-query` (field được phép) và
  `run-ast` (`CASE WHEN`, filter `_or` của cases), không tách ra được. Port nguyên vẹn giữ SQL sinh ra giống Directus
  trên mọi vendor (Nguyên tắc VI).
- **Đã cân nhắc**: Port một phần (chỉ field phẳng; bị loại: trái Q1 và không chạy được fixture `CreatePermission`).
  Viết lại gọn hơn (bị loại: SQL phải giống từng vendor; benchmark ≤10%).

## R5. Helper theo dialect

- **Quyết định**: Port đủ `database/helpers/{fn,geometry,schema,number,sequence,date}` cho mọi dialect, kèm test, kể cả
  phương thức DDL của `schema` chưa dùng tới 006 (file nhỏ, cắt ra còn tốn hơn giữ). `getHelpers()` trả đủ năm nhóm.
- **Lý do**: `run-ast` gọi `schema.applyLimit/applyOffset/preprocessBindings/addInnerSortFieldsToQuery/getColumn...`,
  `fn.year()...`, `st.asGeoJSON()`, `number.*`; `PayloadService` gọi `st.fromGeoJSON`, `sequence.resetAutoIncrement`.
  Mỗi vendor một cách sinh SQL; port lẻ thì lệch.
- **Đã cân nhắc**: Chỉ port Postgres, MySQL, SQLite (bị loại: nightly MSSQL, Oracle, CockroachDB đã có từ 001; thiếu
  dialect thì `getHelpers` lỗi khi khởi động).

## R6. `getService()` khi chưa có mọi service

- **Quyết định**: Port `utils/get-service.ts` giữ cấu trúc `switch` của Directus (23 collection hệ thống có service
  riêng; `directus_*` khác → `ForbiddenError`; collection người dùng → `ItemsService`), với ba nhóm:
  - service đã có hoặc port ở 004: `directus_access`, `directus_activity`, `directus_permissions`, `directus_policies`,
    `directus_presets` (port `services/presets.ts`, 8 dòng, vì `RolesService.deleteMany` gọi nó), `directus_revisions`,
    `directus_roles`, `directus_users`;
  - collection có service riêng ở Directus nhưng chưa port (`directus_files`, `folders`, `comments`, `notifications`,
    `shares`, `translations`, `dashboards`, `panels`, `flows`, `operations`, `versions`, `settings`, `deployments`,
    `deployment_projects`, `deployment_runs`): trả `ItemsService` chung (D-31, gỡ dần ở 007–010 khi service đó được
    port; `SettingsService` của 001 không kế thừa `ItemsService`, chuyển ở 010);
  - `directus_*` còn lại (`sessions`, `migrations`, `fields`, `collections`, `relations`, `extensions`...): `ForbiddenError`
    như Directus.
- **Lý do**: Ghi lồng từ payload của năm collection vào các collection nhóm hai (ví dụ `avatar` của user tạo lồng
  `directus_files`) đi qua service riêng ở Directus; ở app mới chưa có service đó. Ca này hiếm và không nằm trong
  ma trận quyền (fixture tạo file qua Directus khi cần), nhưng là khác biệt nên ghi.
- **Đã cân nhắc**: Ném lỗi khi gặp collection nhóm hai (bị loại: `PATCH /roles/:id` với `users` lồng, hay app Directus
  đọc `avatar.id` của user qua `directus_files` đều phải chạy).

## R7. Cache dữ liệu: ghi biến động, xóa khi ghi

- **Quyết định**: Port `setCacheValue`, `getCacheValue` (+ `*WithExpiry`, `*WithTTL` nếu `respond` của 005 cần thì để
  005), `utils/compress.ts` (snappy + `compress` của `@backoffice/utils`) vào `cache.ts` của 002. `fetchDynamicVariableData`
  dùng chúng với key `filter-context-*` (contracts/cache.md §2). Mọi điểm xóa cache dữ liệu ở contracts/cache.md §3
  gọi `this.cache.clear()` như Directus (`getCache().cache` của 002 đã là Keyv trên `CACHE_STORE`, namespace
  `CACHE_NAMESPACE`), dù app mới chưa đọc response cache (D-11).
- **Lý do**: FR-014, FR-083, Nguyên tắc IV: Directus đang bật `CACHE_ENABLED=true` (env đối chiếu), ghi ở app mới mà
  không xóa thì Directus trả dữ liệu cũ. 003 đã xóa cache dữ liệu khi đổi `role` theo cùng cách.
- **Đã cân nhắc**: Bỏ cache `filter-context-*` ở app mới (bị loại: hai app cho kết quả khác nhau trong `CACHE_TTL` khi
  field của user đổi).

## R8. Emitter: stub không phát

- **Quyết định**: Thêm `apps/api/src/emitter.ts` (`Backoffice:`): `emitFilter(event, payload, meta, context)` trả
  `payload` nguyên, `emitAction` không làm gì, `emitInit` không có. `ItemsService`, `PayloadService` và năm service
  giữ nguyên mọi lời gọi `emitter.emitFilter/emitAction` của Directus (D-29). Feature 009 thay stub bằng port
  `emitter.ts` thật mà không sửa service.
- **Lý do**: `items.ts` có hơn chục chỗ gọi emitter, `emitFilter` có thể đổi payload; bỏ từng chỗ như 003 làm với
  `authentication.ts` sẽ phải sửa lại ở 009 và làm file khác xa bản gốc, khó so khi nâng phiên bản Directus.
- **Đã cân nhắc**: Bỏ lời gọi như 003 (bị loại: lý do trên; 003 chỉ có 3 chỗ). Port emitter thật ngay (bị loại:
  extension và flow ngoài phạm vi; stub là 15 dòng).

## R9. Email mời và xác minh: log thay gửi

- **Quyết định**: Trong `UsersService.inviteUser` và `registerUser`, thay `mailService.send(...)` bằng một dòng
  `logger.warn` theo mẫu của `requestPasswordReset` (003, FR-062): `[email] Invitation email to <email> was not sent:
  email is out of scope (D-27)` và tương tự cho xác minh (D-28). Không có token, không có link, không có `MailService`.
  Thứ tự câu lệnh còn lại (kiểm URL, tạo hoặc sửa user, chờ `REGISTER_STALL_TIME`) giữ nguyên.
- **Lý do**: Nguyên tắc X; link mời trong log cho phép chiếm tài khoản (Clarifications 003). Ở Directus `send` chạy
  nền và lỗi chỉ được log, nên response không đổi.

## R10. Sổ khác biệt (`accepted-differences.ts`, bảng của spec cũ)

- **Quyết định**:
  - D-09.2 (001): thu hẹp dần bằng `excludeEndpoints` khi từng route xong (cách T032 của 003); xóa hẳn khi 004 Done
    (guard yêu cầu mã của 001 còn trong danh sách tới lúc đó).
  - D-10 (001): sau khi `authenticate` chạy cho mọi path (Phase 2), `excludeEndpoints` phủ mọi route đã có; xóa khi
    Done. Sửa cột "App mới" của dòng D-10 trong bảng 001: "Từ feature 004 mọi route xử lý token như Directus" (tiền lệ:
    003 đã sửa dòng này).
  - D-09.10 (003): sửa ô "Gỡ khi" của dòng D-09.10 trong spec 003 từ `005` thành `004` (sửa văn bản của spec Done,
    tiền lệ 003 sửa bảng 001); `removeAt: '004'`; xóa entry khi ba route TFA xong.
  - D-11 (001): sửa cột "Hạng mục" thêm `GET`/`SEARCH` của năm endpoint; giữ `removeAt: '005'`. Harness đã loại
    header `cache-control`, `x-cache-status` theo D-11.
  - D-12 (001): sửa cột "App mới" thành "từ 004 chỉ còn `export`"; giữ `removeAt: '005'`.
  - D-09.6 (001, `/versions`): thêm "và query `version` của mọi route đọc" (R4).
  - Mới trong bảng của spec 004: D-27, D-28, D-29, D-30 (`kind: 'doc'`), D-31 (`doc`, R6, thêm vào spec khi lập plan).
  - `errors.test.ts` (001): bỏ `/users` khỏi danh sách "chưa làm"; ca token sai nay trả `401`/`403` như Directus.
- **Lý do**: Guard `accepted-differences.test.ts` (FR-101 của 001) đối chiếu `removeAt` với ô "Gỡ khi" của spec gốc và
  bắt mọi mã 001 còn hiệu lực phải có trong danh sách.

## R11. Biến môi trường

- **Quyết định**: Theo contracts/config.md: chuyển sang nhóm A `USER_INVITE_*`, `USER_REGISTER_URL_ALLOW_LIST`,
  `REGISTER_STALL_TIME`, `EMAIL_VERIFICATION_TOKEN_TTL`, `RATE_LIMITER_REGISTRATION_*`, `QUERY_LIMIT_DEFAULT`,
  `QUERY_LIMIT_MAX`, `MAX_RELATIONAL_DEPTH`, `RELATIONAL_BATCH_SIZE`, `MAX_JSON_QUERY_DEPTH`. Đọc env trong hàm, không ở cấp module (quy ước
  001; `check-user-limits` của 003 đã làm vậy; `rate-limiter-registration.ts` của Directus tạo limiter ở cấp module →
  tạo ở request đầu như limiter đăng nhập sai của 003). Cập nhật §5 của `specs/001-platform-foundation/contracts/config.md`
  và test `supported-variables.test.ts`.
- **Lý do**: Nguyên tắc VIII; FR-095.

## R12. Reverse proxy và Playwright cho app Directus (FR-106, SC-008)

- **Quyết định**:
  - App Directus gọi API bằng đường dẫn tương đối cùng origin (`api.ts`: `baseURL = getRootPath()`, `withCredentials`;
    SDK `createDirectus(getPublicURL())` lấy từ `window.location`, không đọc `PUBLIC_URL` của server), xác thực bằng
    cookie `directus_session_token` (`mode: 'session'`), gửi `fields[]=...`, `filter[_and][0]...` (qs) hoặc JSON (SDK),
    và dùng `SEARCH` khi URL dài. Nên proxy đặt trước **cặp chính** 8155/8156 là đủ, không cần cặp riêng;
    `PUBLIC_URL=http://127.0.0.1:8155` chỉ ảnh hưởng `<base href="/admin/">` (path, không đổi).
  - `tests/parity/docker-compose.yml`, profile `app`: service `proxy` (`nginx:1.27-alpine`, cổng host `8160`), cấu hình
    `tests/parity/proxy/nginx.conf` sinh từ danh sách route `tests/parity/proxy/backoffice-routes.txt` (một tên mỗi
    dòng: `auth`, `server`, `metrics`, `users`, `roles`, `policies`, `access`, `permissions`; script
    `tests/parity/scripts/proxy-conf.mjs` dựng `location ~ ^/(a|b|...)(/|$)` → `backoffice-api:8055`); `location /` →
    `directus:8055` (`/admin`, `/admin/assets/*`, `/extensions/sources/*`, `/collections`, `/fields`, `/relations`,
    `/settings`, `/presets`, `/notifications`, `/translations`, `/dashboards`, `/panels`, `/flows`, `/files`,
    `/assets`, `/revisions`, `/comments`, `/utils/*` và mọi path khác). `proxy_set_header Host $host`,
    `X-Forwarded-*`; cookie đi qua nguyên vẹn vì cùng origin. Mỗi feature sau thêm tên route vào danh sách.
  - Playwright: dự án Nx mới `tests/directus-app-e2e` (`@playwright/test` 1.64.0 đã có trong catalog, mẫu
    `apps/web-e2e`), target `e2e`, `BASE_URL`. Kịch bản (FR-106), user `admin@example.com` (module Settings đòi
    `admin_access`): đăng nhập; module User: tạo user (role, email, mật khẩu), sửa, xóa, mời user (dialog Invite, trả
    `204`); Settings > Roles: tạo role con của role có sẵn (`PATCH /roles/:pk` với `parent`), gán policy cho role
    (`policies: {create: [{role, policy: {id}}]}`); Settings > Access Policies: tạo policy (POST `/policies` rồi POST
    `/permissions` quyền tối thiểu của app), thêm permission có filter, field, preset qua giao diện
    (`PATCH /policies/:pk` với `permissions: {create, update, delete}`), gán cho user, sửa, xóa. Mỗi kịch bản chạy hai
    lần: `BASE_URL` = proxy 8160 (API vào app mới) và `BASE_URL` = Directus 8155 (mốc); helper `db-rows.ts` (knex trên
    host, chỉ SELECT) chụp dòng `directus_users`, `directus_roles`, `directus_policies`, `directus_access`,
    `directus_permissions`, `directus_activity`, `directus_revisions` sinh ra ở mỗi lần, chuẩn hóa như `db-effects`
    của 003 rồi so. Kiểm thêm: request từ trình duyệt tới route trong danh sách đi vào app mới (log nginx `upstream`).
  - CI: job mới `e2e-directus-app` (`api:build`, `env-up --vendor=postgres --profiles=app`, `playwright install
    --with-deps chromium`, `nx run directus-app-e2e:e2e`, timeout 30 phút), thêm vào `needs` của `publish`;
    `tools/ci-local.sh` thêm bước.
- **Lý do**: Clarifications Q2, Q3. Playwright và chromium đã có ở job `e2e`. Mốc so DB là Directus thuần, không cần
  proxy thứ hai.
- **Đã cân nhắc**: Traefik (bị loại: nginx đủ, cấu hình tĩnh). Mock API (bị loại: SC-008 đòi app thật). Cặp
  Directus/app mới riêng cho profile (bị loại: app gọi URL tương đối).
- **Rủi ro**: App Directus 15.10 gọi route ngoài danh sách (`/extensions/sources/index.js` lúc nạp, `/fields`,
  `/collections`...); theo quy tắc A mọi path khác về Directus nên không chặn test. Thời gian CI thêm khoảng 5 đến 8
  phút `[Suy luận]`. Khi app Directus gọi `GET /users/:pk?fields=*,role.*,avatar.id,avatar.modified_on`, engine đọc
  lồng `directus_files` qua `ItemsService` chung (D-31, chỉ đọc nên giống Directus).

## R13. Test đối chiếu: fixture, ma trận, bộ rút gọn

- **Quyết định**:
  - `tests/parity/src/directus-api.ts` mở rộng thành `appRequest(app, ...)`: từ 004, fixture tạo được qua API của
    từng app (FR-103 của 003 hết hiệu lực). Khi so luồng ghi: fixture riêng cho mỗi app (`createUserPerApp` của 003);
    khi chỉ so đọc: tạo qua Directus.
  - Thư mục mới `tests/parity/src/permissions/`: `fixtures.ts` (role cây ba tầng, policy theo cờ, access role/user/public,
    permission theo mẫu, user theo trạng thái, static token, share; field tùy biến và collection người dùng tạo qua
    `/fields`, `/collections` của Directus, xóa ở `afterAll`), `matrix.test.ts` (FR-101, bảng ô: accountability ×
    cấu hình × action × collection; so bằng `parity()` cho đọc và `scenario()` + `captureDbEffects` cho ghi),
    `accountability.test.ts` (US1), `read-rules.test.ts` (US2: `CASE WHEN`, `$NOW`, field quan hệ), `write-rules.test.ts`
    (preset, validation AND, `validateAccess`), `users.test.ts`, `roles.test.ts`, `policies.test.ts`, `access.test.ts`,
    `permissions.test.ts` (CRUD, route riêng, `SEARCH`, batch, `OPTIONS`), `query.test.ts` (FR-040 trên năm endpoint),
    `invite-register.test.ts`, `tfa-toggle.test.ts`, `me.test.ts` (`/permissions/me`, `/policies/me/globals`,
    `/roles/me`), `cache-cross.test.ts` (SC-003, SC-004), `blackbox-common.test.ts` (port `createRole()`, `createUser()`
    của `common.test.ts`), `check-item-permissions.test.ts` (port). Mở rộng `schema/permissions-cache.test.ts` cho 8
    namespace.
  - `request-set.ts`: thêm `GET`/`SEARCH` của năm endpoint và route `me` với static token của một user fixture tạo
    trước khi chụp DB (`db-unchanged` chạy không có Directus; static token không ghi DB), `OPTIONS`, và các request bị
    chặn trước bước ghi (contracts/db-writes.md §7).
  - Ma trận FR-101 là tích đầy đủ (Clarifications rà checklist): 10 × 13 × 5 × 5 × 6 = 19.500 ô. `matrix.ts` sinh ô từ
    năm danh sách giá trị (không viết tay); ô nhóm theo (accountability, cấu hình permission, `ip_access`) thành 650 nhóm
    fixture, mỗi nhóm dựng fixture một lần rồi chạy 30 ô (5 action × 6 collection). Ô đọc dùng `parity()`; ô ghi dùng
    `scenario()` với fixture riêng mỗi app và dọn dữ liệu sau ô. `PARITY_MATRIX_SHARD=<i>/<n>` chọn nhóm theo chỉ số để
    chia job CI. Mỗi push, job `parity-matrix-rotating` (Postgres) chạy một shard `run_number % n + 1`; workflow
    `parity-matrix.yml` (hằng tuần, bấm tay) chạy đủ `n` shard song song và phải xanh trước khi đóng feature, trước mỗi
    lần nâng Directus (Clarifications khi analyze). `n` chọn sau khi đo ở task đầu của Phase 6 để mỗi shard dưới 60 phút. `matrix-reduced.test.ts` (MySQL, SQLite) chọn ô sao cho mỗi giá trị của mỗi chiều xuất hiện
    ít nhất một lần, chỉ action `read`, `update`, collection `directus_users`.
  - Profile `user-limits` (cặp 8855/8856, `USERS_*_ACCESS_LIMIT` nhỏ) cho ca `LIMIT_EXCEEDED`: giới hạn đọc từ env nên
    cần cặp app riêng; test đếm user `active` hiện có rồi tạo thêm tới khi vượt.
  - Limiter đăng ký mặc định bật và dùng chung Redis: mỗi ca đăng ký gửi `X-Forwarded-For` riêng để có bộ đếm riêng.
  - `suite.ts`: `src/permissions/**` trừ `matrix.test.ts`, `matrix-reduced.test.ts` vào `full`; `reduced`
    thêm `matrix-reduced`, `users`, `roles`, `write-rules`.
  - Ca cross-app dùng `flushSharedCaches()` giữa hai lần chụp khi so giá trị tính toán (002); với response cache của
    Directus (`CACHE_ENABLED=true`, `CACHE_AUTO_PURGE=true` trong env đối chiếu): ghi qua API nên cache được xóa; đọc
    trạng thái từ DB như 003 (T044).
  - Chạy lại toàn bộ `src/auth/**` (FR-105) không sửa, trừ các ca đã kiểm `/users/me` qua Directus: đổi về app mới
    (FR-100 của 003).
- **Lý do**: FR-100 đến FR-105, SC-001, SC-005. Fixture qua API của chính app được kiểm là cách duy nhất so luồng ghi
  lồng (`CreatePermission`).
- **Rủi ro**: 19.500 ô, mỗi ô ít nhất hai request (một mỗi app), ô ghi thêm dựng và dọn fixture: `[Suy luận]` vài giờ
  chạy tuần tự, nên phải chia nhiều shard; mỗi lần push tốn nhiều phút GitHub Actions (repo private, đã từng bị chặn vì
  hạn mức ngày 2026-10-11). Task đầu của Phase 5 đo thời gian một nhóm fixture rồi chốt số shard; nếu tổng phút vượt hạn
  mức thì báo chủ dự án trước khi bật job.

## R14. Benchmark (SC-006)

- **Quyết định**: `tests/benchmark/src/permissions.ts` và `seed-permissions.ts` (knex trên host, Postgres): 2.000 user
  `active`, cây role ba tầng (gốc → 10 nhánh → 100 lá), mỗi user ít nhất ba policy (hai qua cây role, một gắn trực tiếp),
  permission có `$CURRENT_USER`, `$CURRENT_ROLES`, `$NOW(-1 day)`; đo `GET /users/me`, `GET /permissions/me`,
  `GET /users?filter[status][_eq]=active&limit=25` với static token của user không admin; 50 kết nối, p95 ở 80% req/s
  của Directus, ngưỡng 10%, 5 vòng, dùng `compare.ts`; job `benchmark-permissions` trong `benchmark.yml` (hằng tuần,
  bấm tay). Cache quyền trống trước mỗi vòng (`flushSharedCaches`) để đo cả đường tính lại.
- **Lý do**: SC-006 đòi dữ liệu quy mô thiết kế, không đòi 2.000 kết nối (khác SC-007 của 003); giữ cách đo của 001.

## R15. Unit test port (FR-104)

- **Quyết định**: Port cùng file nguồn: `database/get-ast-from-query/**/*.test.ts` (6 file, 1.337 dòng),
  `database/run-ast/**/*.test.ts` (16 file, 2.632), `database/helpers/**/*.test.ts` (13 file, 1.355),
  `permissions/**/*.test.ts` (39 file, 4.954), `services/{items,payload,meta,users,roles}.test.ts` (190, 929, 499, 485,
  147; `items.test.ts`, `payload.test.ts`, `users.test.ts` thay bản của 003), `utils/{sanitize-query,validate-query}.test.ts`
  (420, 86), `middleware/validate-batch.test.ts` (111, đổi sang hàm async, R3), test của `@directus/utils` đã port.
  Directus không có test cho `PoliciesService`, `AccessService`, `PermissionsService` hay năm controller
  (`validate-user-count-integrity.test.ts` chỉ là `test.todo`). Test dùng `knex-mock-client` như Directus. Test mới
  (`Backoffice:`): `controllers/{users,roles,policies,access,permissions}.controller.test.ts` (supertest trên SQLite
  với `createDirectusDb()` của 003) cho thứ tự route, `endsWith('me')`, `SEARCH`, `204`, `OPTIONS`, lỗi Joi của
  `validateBatch`; `services/{policies,access,permissions}.service.test.ts` (ip_access, cờ toàn vẹn, điểm xóa cache);
  `emitter.test.ts`; `utils/get-service.test.ts` (ba nhóm của R6).
- **Lý do**: Năm collection hệ thống không chạm m2a, aggregate, geometry, hàm ngày giờ; unit test gốc phủ các nhánh đó
  tới khi 005 có blackbox items. Coverage 80% (Nguyên tắc X).

## R16. Thứ tự làm và tách nhỏ

- **Quyết định**: Một branch, một spec; `tasks.md` chia theo gói: (2) nền (lib utils, helper, emitter, env, cache,
  module quyền thuần hàm có unit test); (3) US1 (authenticate mọi path, engine đọc, `UsersService.readOne`, `/users/me`,
  `/roles/me`, `/policies/me/globals`, `/permissions/me`, route 001 với token); (4) US2 (engine ghi, `processPayload`,
  `validateAccess`, ma trận); (5) US3, US4 (controller CRUD, service riêng); (6) US5 (mời, đăng ký), US6, US7; (7)
  proxy + Playwright; (8) benchmark, docs, sổ khác biệt. Nếu `tasks.md` vượt khoảng 60 task thì `/speckit.tasks` tách
  thành hai lượt implement (nền + US1, US2 trước; phần còn lại sau) trên cùng branch, như mục 9 của SPECKIT-GUIDE.
- **Lý do**: Engine đọc là điều kiện của mọi route; engine ghi là điều kiện của fixture per-app. Ước lượng: khoảng 12
  đến 13 nghìn dòng port (không tính test), gấp 3 đến 4 lần 003.
