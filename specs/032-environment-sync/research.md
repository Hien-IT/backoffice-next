# Research: Đồng bộ cấu hình từ môi trường khác (032)

Đọc code ngày 2026-11-14, chưa chạy thử. Nhãn của từng mục:

- [Verified]: tôi đọc đúng dòng trong lượt này.
- [Reported]: một agent đọc code báo lại kèm `file:dòng`, tôi chưa đọc lại; T001 kiểm trước khi viết code.
- [Inference]: suy ra từ code, có task đo ở lượt 1.
- [Unverified]: chưa có căn cứ, T001 thử trước khi viết code.

## R1. Phía nguồn: hai thao tác chỉ đọc, không dùng các endpoint REST có sẵn

**Hiện trạng**: `/server/info` chỉ trả `version` = Directus 11.17.4 [Verified] (`apps/api/src/services/server.service.ts:121`);
phiên bản Backoffice ở `apps/api/src/version.ts:3` [Verified]; migration đã chạy: `checkMigrations(db)` trả `completed`,
`boCompleted` (`apps/api/src/database/validate-migrations.ts:65-90`) và `completedBackofficeMigrations(knex)`
(`apps/api/src/database/backoffice-migrations/index.ts:30-33`) [Reported]. Vì FR-005 cần so phiên bản và migration, nguồn
buộc phải là một Backoffice có feature này.

**Decision**: nguồn phục vụ hai thao tác GET chỉ admin: `GET /backoffice/sync` (thông tin instance, cũng là probe của
web) và `GET /backoffice/sync/state?groups=…` (trạng thái cấu hình của các nhóm). Đích gọi hai thao tác đó rồi tự chạy
**cùng một hàm** `readState()` trên DB của mình để so.

**Rationale**: (1) nguồn đã phải có feature, nên thêm một GET không tốn gì; (2) hai bên đọc bằng cùng một hàm nên cùng
cách tuần tự hóa (ngày giờ, JSON, boolean), không lệch do đường đọc khác nhau; (3) field mã hóa bị loại ngay ở nguồn,
giá trị che `**********` không rời nguồn; (4) một request thay cho khoảng 15 endpoint và một request index cho mỗi
collection; (5) dữ liệu không tin cậy chỉ có một hình dạng để kiểm.

**Alternatives**: đọc `/flows`, `/roles`, `/permissions`, `/backoffice/collections/:c/indexes`… như guide ghi lúc đầu:
bị bác vì năm lý do trên. Sửa câu chữ spec ở plan (D-214 gồm thao tác "đọc trạng thái").

## R2. Gọi HTTP sang nguồn

**Hiện trạng**: `getAxios()` tạo một instance `axios.create({ httpAgent, httpsAgent })`, không đặt `maxRedirects`, không
đặt `timeout` (`apps/api/src/request/index.ts:18`) [Reported]; agent kiểm IP lúc `lookup` và hủy socket khi bị chặn
(`agent-with-ip-validation.ts:28-50`) [Reported]; danh sách chặn mặc định `['0.0.0.0', '169.254.169.254']` [Verified]
(`libs/env/src/constants/defaults.ts:134`), `0.0.0.0` chặn mọi địa chỉ của chính máy (`is-denied-ip.ts:20-22`, `:38-40`)
[Reported]. Ba nơi đang dùng: import file, operation request, sandbox [Reported].

**Decision**: gọi nguồn bằng `getAxios()` với cấu hình từng request: `timeout: 30_000`, `maxRedirects: 0`,
`maxContentLength: 100 MB`, `validateStatus: () => true`, header `Authorization: Bearer <token>`. URL: chỉ `http:` và
`https:`, không có user/password trong URL, bỏ `/` cuối, giữ đường dẫn con. Trả lời 3xx là lỗi "nguồn chuyển hướng".
Lỗi của axios không bao giờ được log hay gắn vào `cause` (nó mang header và URL); chỉ ném lỗi đã làm sạch.

**Hệ quả**: địa chỉ mạng nội bộ gọi được (đúng nhu cầu stg/uat/prod); `localhost` của chính đích bị chặn theo mặc định.
Không biến môi trường mới: ba hằng số trên nằm trong code.

**Alternatives**: thêm biến `BACKOFFICE_SYNC_TIMEOUT`: bị bác (không ai yêu cầu; hằng số đủ cho đợt đầu).

## R3. Phần Data model: dùng lại diff và apply của schema

**Hiện trạng**: `getSnapshotDiff(current, after)` (`apps/api/src/utils/get-snapshot-diff.ts:7`) [Verified]; kiểu
`SnapshotDiff` có `collections`, `fields`, `systemFields`, `relations`, mỗi phần tử mang `diff` (`libs/types/src/snapshot.ts:33-54`)
[Reported]; `applyDiff(current, diff, { database?, schema? })` nhận transaction ngoài (`apply-diff.ts:38-42`) và
`transaction()` dùng lại transaction có sẵn, không savepoint (`utils/transaction.ts:19-20`) [Reported]; `validateSnapshot`
từ chối khác phiên bản Directus hoặc khác vendor [Verified] (`validate-snapshot.ts:67-89`); snapshot giữ nguyên `meta` của
collection [Verified] (`sanitize-schema.ts:22`).

**Decision**: nhóm `schema` của state là `getSnapshot()` bỏ `systemFields`. Đích tính `getSnapshotDiff(đích, nguồn)`, đổi
từng phần tử thành một dòng (`collection:<tên>`, `field:<collection>.<field>`, `relation:<collection>.<field>`), lọc các
mảng theo dòng được tick rồi gọi `applyDiff` với transaction của lượt áp dụng. Collection chỉ có ở nguồn mang theo mọi
field mới của nó (như `applyDiff` vốn làm), nên field của collection đó không là dòng riêng. `validateSnapshot` chạy
không `force`: khác vendor thì nhóm này bị từ chối, các nhóm khác vẫn chạy (clarify 5).

**Không gồm**: `systemFields` (cờ index trên field hệ thống). FR-007 chỉ nói collection người dùng.

**[Inference]**: ba cột `bo_show_*` (022) nằm trong `meta` nên đi theo dòng collection. T010 đo.

## R4. Một transaction cho cả cấu trúc và dòng trên Postgres

**Hiện trạng**: mọi ghi của `ItemsService` chạy trong `transaction(this.knex)` nên dùng lại transaction ngoài truyền qua
option `knex` (`items.service.ts:54-57`) [Reported]. `applyDiff` cũng vậy (R3).

**Decision**: lượt áp dụng mở một transaction, chạy `applyDiff` rồi mọi ghi dòng trong đó, commit một lần. Trên Postgres
DDL nằm trong transaction, nên lỗi ở bất kỳ bước nào hoàn tác cả cấu trúc lẫn dòng [Inference, T011 đo bằng một dòng lỗi
sau khi đã tạo collection]. Sau `applyDiff`, đọc lại schema bằng `getSchema({ database: trx, bypassCache: true })` cho
các service chạy sau.

**Hệ quả với spec**: FR-025 nói "thay đổi cấu trúc đã chạy mà không hoàn tác được thì liệt kê". Trên Postgres không còn
gì để liệt kê; câu đó chỉ áp cho vendor DDL tự commit (MySQL), ghi "chưa đo".

**Rủi ro**: transaction giữ khóa bảng của các collection bị đổi tới khi commit; request khác vào các bảng đó phải chờ.

## R5. Tác dụng phụ chạy trước commit: phải chạy lại sau commit

**Hiện trạng** [Reported]:

- `applyDiff` gọi `flushCaches()` rồi phát các action ngay sau `transaction()` của nó (`apply-diff.ts:363-371`);
  `clearSystemCache` phát `schemaChanged` lên bus (`cache.ts:121`). Với transaction ngoài, việc này xảy ra trước commit.
- `FlowsService` và `OperationsService` gọi `getFlowManager().reload()` sau mỗi ghi [Verified] (`flows.service.ts:15`,
  `:24`, `:36`); `reload()` chỉ phát `flows` lên bus (`flows.ts:111-114`), bên nhận đọc bằng `getDatabase()`
  (`flows.ts:166`), tức thấy dữ liệu trước commit.
- `ItemsService` xóa cache ngay sau transaction của từng thao tác (`items.service.ts:426`, `:942`, `:1161`).
- `AccessService.clearCaches()` bỏ qua `autoPurgeCache` (`access.service.ts:31`, `:48`, `:61`).
- `ExtensionsService.updateOne` gọi `reload().then(broadcast)` không chờ (`extensions.service.ts:346-348`).

**Decision**: sau commit, lượt áp dụng chạy một lần: `clearSystemCache()` (`cache.ts:102`) và `clearCache()` của
permissions (`permissions/cache.ts:45`) [Verified hai hàm tồn tại]; `getFlowManager().reload()` nếu nhóm flows có ghi;
reload và broadcast của extension manager nếu nhóm extensions có ghi. Flow và operation được ghi bằng `ItemsService`
trực tiếp trên `directus_flows`, `directus_operations` (vẫn có activity và revision), không qua `FlowsService`, để không
phát N lần reload vô ích; việc `FlowsService.deleteMany` làm thêm (đặt `resolve`/`reject` về null trước khi xóa,
`flows.service.ts:31`) được làm tay.

**Kiểm**: parity có hai node đích trên cùng DB; sau khi áp dụng qua node 1, node 2 phải phục vụ collection mới và chạy
flow mới (FR-029).

## R6. Khóa: mỗi lúc một lượt áp dụng

**Hiện trạng**: `useLock().usingLock(key, fn)`; bản Redis là `redlock.using([key], 5000, fn)` với `retryCount: 100`,
`retryDelay: 50` [Verified] (`libs/memory/src/kv/lib/redis.ts:66-78`, `:153-155`); bản local chỉ chạy callback, không loại
trừ (`local.ts:83-85`) [Reported]. Nơi đang dùng: `backoffice-migrations/run.ts:46` [Reported].

**Decision**: `usingLock('backoffice-sync-apply', …)` cộng một cờ trong process. Cờ trong process cho lỗi ngay khi cùng
process đang áp dụng (cũng là loại trừ duy nhất khi không có Redis, tức chỉ một instance). Với Redis, lượt thứ hai chờ
tối đa khoảng 5 giây rồi nhận 503 `SERVICE_UNAVAILABLE` (`service: 'sync'`, reason "Another sync is being applied").

**[Unverified]**: `redlock.using` có tự gia hạn khóa khi callback chạy lâu hơn 5 giây hay không. T001 thử với callback
20 giây; nếu không gia hạn thì lượt áp dụng tự gia hạn theo chu kỳ.

**Nguyên tắc VII**: cờ trong process không phải nguồn loại trừ duy nhất khi có nhiều instance; Redis là nguồn đó.

## R7. Bảo vệ admin

**Hiện trạng**: `PoliciesService` đặt cờ kiểm số admin còn lại khi đổi `admin_access` hoặc xóa (`policies.service.ts:72-81`,
`:101`); `AccessService` và `RolesService` cũng đặt cờ; kiểm chạy trong transaction của thao tác
(`items.service.ts:318-322`, `:1126-1131`) [Reported]. `fetchGlobalAccess` có cache [Verified]
(`permissions/modules/fetch-global-access/fetch-global-access.ts:15`). Role và policy Administrator do `createAdmin` tạo
không truyền id, nên id là uuid ngẫu nhiên, khác nhau giữa các môi trường bootstrap riêng (`utils/create-admin.ts:31-67`)
[Reported]; policy public có id cố định (`migrations/20240806A-permissions-policies.ts:65`) [Reported].

**Decision**: (1) role, policy, liên kết đi qua `RolesService`, `PoliciesService`, `AccessService` để các kiểm tra sẵn có
chạy; (2) cuối transaction, tính lại quyền admin của người đang thao tác bằng truy vấn qua transaction (không qua cache);
mất quyền thì ném lỗi và hoàn tác; (3) theo clarify 1, dòng chỉ có ở đích là policy có `admin_access`, hoặc role (kể cả
qua role cha) nối với một policy như vậy, có `selectable: false`.

## R8. Hệ quả của xóa, để ghi đúng vào hộp xác nhận

- Xóa role [Verified dòng 47, 86; phần còn lại Reported] (`roles.service.ts:47-107`): xóa liên kết và preset của role,
  user của role thành `status: 'suspended'`, `role: null`, role con mất cha. Spec nói "user mất role": sửa thành "user bị
  đình chỉ và mất role".
- Xóa policy: permission của policy bị xóa theo FK `ON DELETE CASCADE` [Verified]
  (`migrations/20240806A-permissions-policies.ts:168`); `PoliciesService.deleteMany` xóa cả dòng `backoffice_permissions`
  (`policies.service.ts:108-110`) [Reported].
- Xóa folder: `FoldersService` không có override xóa; `directus_files.folder` là `ON DELETE SET NULL`, tức file về gốc;
  `directus_folders.parent` là FK không `onDelete` (`migrations/20210519A-add-system-fk-triggers.ts:17-25`,
  `seeds/06-folders.yaml:13-17`) [Reported]. [Inference] Xóa folder cha còn folder con sẽ lỗi ở DB, nên folder con phải
  được tick cùng (xóa, hoặc đổi cha) và xóa theo thứ tự con trước.
- Xóa collection, field: mất dữ liệu; dòng mang số item của collection ở đích.

## R9. Field settings và giá trị che

Bốn field có special `encrypt`: `ai_openai_api_key`, `ai_anthropic_api_key`, `ai_google_api_key`,
`ai_openai_compatible_api_key` (`libs/system-data/src/fields/settings.yaml:762`, `:807`, `:838`, `:907`) [Verified dòng
762; ba dòng còn lại Reported]; không field settings nào có `conceal` hay `hash` [Reported]. `encrypt` trả `**********`
khi đọc có accountability, mã hóa khi ghi (`payload.service.ts:174-200`) [Reported]. `mapbox_key` là chuỗi thường
[Verified] (`settings.yaml:494`).

**Decision**: `readState()` đọc với accountability của admin và bỏ mọi field có special `encrypt`, `conceal` hoặc `hash`,
lấy theo `directus_fields` của schema (không ghi cứng tên). Dòng settings của field đó vẫn hiện với `selectable: false`
(clarify 3). Field settings là m2o tới `directus_files`, `directus_folders`, `directus_roles` được nhận biết qua relation
của schema: file phải có ở đích; folder và role phải có ở đích hoặc được tick (clarify 2).

## R10. Dòng, khóa so khớp và ghi

Kiểu khóa chính [Reported]: uuid cho flows, operations, roles, policies, access, translations, dashboards, panels,
folders, extensions, `backoffice_indexes`; số tự tăng cho permissions, presets [Verified seed] và
`backoffice_permissions`. Tên index sinh từ loại, collection và các field (`backoffice-indexes.service.ts:99`,
`utils/get-default-index-name.ts:17-34`), nên cùng tên là cùng định nghĩa: index không có trạng thái "khác nhau"
[Reported]. Id của dòng extension là ngẫu nhiên với nguồn local và upload (`get-extensions-settings.ts:113`) [Reported],
nên khớp theo tên (clarify 4). `TranslationsService` từ chối trùng `key` + `language` (`translations.service.ts:21-45`)
[Reported].

**Decision**: bảng đầy đủ ở [data-model.md](./data-model.md). Tóm tắt: dòng khớp theo id được tạo ở đích với đúng id của
nguồn; dòng khớp theo khóa tự nhiên được tạo không truyền id. `date_created`, `user_created` và tương tự không được so
và không được chép: special của đích tự ghi người tạo là admin đang thao tác (sửa FR-024, xem plan). Operation nằm trong
dòng flow, panel nằm trong dòng dashboard (không là dòng riêng). Flow mới: tạo flow với `operation: null`, tạo
operations với `resolve`/`reject` null, cập nhật `resolve`/`reject`, rồi cập nhật `flow.operation` (FK vòng).

**Index**: `BackofficeIndexesService.create` chèn dòng `creating` và chạy job không chờ (`:89-150`), `remove` từ chối khi
đang `creating` (`:286-290`) [Reported]. Vì job chạy ngoài transaction, tạo và xóa index chạy **sau commit**; lỗi của
từng index báo riêng, không hoàn tác phần đã commit. State chỉ gồm index `ready`.

## R11. Không để lại URL và token

**Hiện trạng** [Reported]: pino-http log method, url, query, params, header (đã che `authorization`, `cookie`), không log
body (`logger/index.ts:85-181`, `pino-std-serializers@7.1.0/lib/req.js:70-92`); response cache chỉ đọc và ghi GET hoặc
`/graphql` (`middleware/cache.ts:19`, `respond.ts:39`); không middleware nào ghi activity cho request.

**Decision**: URL và token chỉ đi trong body của `POST`, không bao giờ ở query; mọi route đặt `res.locals.cache = false`;
module sync không gọi logger với URL, token hay lỗi axios; lỗi trả về không lặp lại URL. Token sai ở nguồn trả **400**
`INVALID_PAYLOAD` ở đích, không 401 (401 ở đích nghĩa là phiên của chính admin hết hạn và web sẽ đăng xuất). Parity tìm
token và host nguồn trong log container, activity, revision.

Mã lỗi: chỉ dùng lớp có sẵn [Verified] (`libs/errors`): `InvalidPayloadError`, `ForbiddenError`,
`InvalidCredentialsError`, `ServiceUnavailableError`. Không mã 409.

## R12. Web

**Hiện trạng** [Reported]: menu Settings là mảng tĩnh bốn nhóm, không link nào có điều kiện
(`SettingsNavigation.vue:17-36`); route khai ở `modules/settings.ts` (`settings-extensions` dòng 211-215); khung trang là
`PrivateView` với slot `#navigation`, `#actions` (`ExtensionsRoute.vue:46-55`); probe mẫu
`composables/use-extension-upload.ts:8-55`; `ComparisonModal` nhận `collection`, `primaryKey`, `mode` và vẽ hai `BoForm`
(`ComparisonModal.vue:27-35`, `:292-334`), không vẽ được danh sách field bất kỳ; `BoTable` không có hàng mở rộng, không
nhóm, `disabled` chỉ ở mức cả bảng [Verified `BoTable.vue:53`, `:134`], có slot `header.<key>`, `item.<key>`;
`BoCheckbox` có `indeterminate` (`BoCheckbox.vue:20-31`); `BoDetail` (thu gọn), `BoDialog` với nút danger
(`CollectionIndexes.vue:296-298`); chuỗi riêng ở `lang/overlay/en-US.ts`, `vi-VN.ts`; `layout-patterns.md` không có mẫu
nhiều bước hay bảng so sánh; Q-48 là recipe cuối trong `component-specs.md` (dòng 2061), Q-49 đặt ngay trước
`## Acceptance criteria` (dòng 2089).

**Decision**: không sửa `BoTable`: mỗi nhóm là một `BoDetail` chứa `BoTable` với `showSelect: 'none'` và một cột checkbox
tự vẽ qua slot (`BoCheckbox` từng dòng, checkbox nhóm có `indeterminate` ở header), vì cần tắt tick theo từng dòng.
Chi tiết dòng là component mới vẽ hai cột giá trị; không dùng `ComparisonModal`. URL và token là `ref` trong composable
của trang, không vào store, `localStorage` hay `sessionStorage`. Ô token `type="password"`, `autocomplete="off"`;
trình duyệt vẫn có thể đề nghị lưu, không kiểm soát hết được (sửa FR-034). Bố cục đề xuất ở
[contracts/web.md](./contracts/web.md), chờ design owner trả lời Q-49.

## R13. Môi trường kiểm thử

**Hiện trạng**: profile `bootstrap` có `postgres-bootstrap` (cổng 6114) và `backoffice-api-bootstrap` trên DB riêng với
`ADMIN_TOKEN` tĩnh [Verified] (`tests/parity/env/profile-bootstrap.env`, `env/bootstrap-init.sql`,
`src/config.ts:82-128`); suite theo profile tự bỏ qua khi profile không chạy (`describe.skipIf(!profileUrls(...))`,
`src/bootstrap/init.test.ts:53`) [Reported]; CI liệt kê profile ở `ci.yml:106`, `:113` (parity Postgres) và `:372`
(e2e-web) [Reported]; env parity không đặt `IMPORT_IP_DENY_LIST` [Verified]; service `registry` là server Node
(`tests/parity/registry/server.mjs`) [Verified compose dòng 174-188]; replica thêm cho E2E đã có tiền lệ
(`backoffice-api-passkey`, 029) [Reported].

**Decision**: profile mới `sync`, chỉ Postgres: `backoffice-api-sync` (cổng 10856) và `backoffice-api-sync-2` (10857)
cùng DB `backoffice_sync` trên `postgres-bootstrap` (thêm profile `sync` cho service Postgres đó và một dòng
`CREATE DATABASE`), Redis db 12. Hai node dựng từ anchor `x-app` của cặp chính (cùng extension, cùng `MIGRATIONS_PATH`)
cộng một file `env/profile-sync.env` cho DB và `ADMIN_TOKEN`; không lấy `MIGRATIONS_PATH` của profile `bootstrap`, vì
danh sách migration khác thì FR-005 từ chối mọi lượt (sửa khi analyze 2026-11-14, E1). Parity: nguồn là `backoffice-api` của cặp chính (URL trong
mạng Docker `http://backoffice-api:8055`), đích là `backoffice-api-sync`; dữ liệu ghi vào DB `backoffice_sync` nên cặp
chính không bẩn. E2E: ngược lại, nguồn là `backoffice-api-sync`, đích là API đang được web dùng (DB chính), spec dọn sau
khi chạy. Server `registry` thêm vài route giả `/sync-fake/<ca>/backoffice/sync` cho các ca lệch phiên bản, chuyển hướng,
trả lời chậm, sai hình dạng. Một file nhỏ `sync/route.test.ts` (Directus 404, Backoffice 200 admin, 403 user) chạy trên
cặp chính ở cả ba vendor của bộ rút gọn (Nguyên tắc V); phần còn lại chỉ chạy khi profile `sync` bật.

**Alternatives**: dùng thẳng `backoffice-api-bootstrap` làm đích: bị bác vì suite `bootstrap` so dump của DB đó.

## R14. Hash của so sánh

`getVersionedHash(item)` = `object-hash({ item, version })` [Reported] (`utils/get-versioned-hash.ts:3-7`).

**Decision**: `hash = getVersionedHash({ source: stateNguồn, target: stateĐích })` trên đúng các nhóm đã so. Lượt áp dụng
đọc lại hai bên, tính lại, khác thì 400 `INVALID_PAYLOAD` "The comparison is out of date, compare again". Không lưu gì
giữa hai request (FR-003, FR-022). Máy chủ là nơi quyết định: lượt áp dụng tự tính lại diff, kiểm từng dòng trong
`selected` có tồn tại, tick được và đủ phụ thuộc; web tự tick kèm chỉ là tiện ích.

## Kết quả T001 (2026-11-14, đọc code)

- (a) Các dòng [Reported] đã đọc lại khi dùng tới; sai lệch ghi ở mục tương ứng dưới đây.
- (b) R6 [Verified]: `Redlock.using` tự gia hạn khóa trước khi hết hạn (`automaticExtensionThreshold` 500 ms,
  `@sesamecare-oss/redlock/src/index.ts:545-584`), nên khóa giữ suốt lượt áp dụng dù dài hơn 5 giây. Bên chờ thử 100 lần
  cách 50 ms (cộng jitter), tức khoảng 5–7 giây, rồi ném `ExecutionError`; T032 ánh xạ lỗi đó sang 503.
- (c) R2 [Verified]: IP bị chặn ném `Error('Requested domain "<host>" resolves to a denied IP address')`
  (`agent-with-ip-validation.ts:12`), lúc tạo kết nối (IP literal) hoặc qua `socket.destroy` sau `lookup`. Mục `0.0.0.0`
  của `IMPORT_IP_DENY_LIST` chặn **mọi địa chỉ của các network interface của máy** (`is-denied-ip.ts:20-22`,
  `addLocalNetworkInterfaces`), không chỉ `localhost`: trong Docker, một node gọi chính tên của nó cũng bị chặn. Hệ quả:
  ca "nguồn là chính đích" của T017 dùng node thứ hai cùng DB (`backoffice-api-sync-2`) làm nguồn.
- (d) R7 [Verified]: `@backoffice/utils/node` có `fetchRolesTree(role, { knex })`, `fetchGlobalAccessForRoles(roles, {
  knex, ip })`, `fetchGlobalAccessForUser(user, { knex, ip })` không qua cache (bản có cache ở
  `permissions/modules/fetch-global-access/fetch-global-access.ts:15`). T038 đọc `directus_users.role` qua transaction,
  dựng cây role rồi gọi hai hàm đó.
- (e) [Verified]: `directus_operations.flow` và `directus_panels.dashboard` là `ON DELETE CASCADE`
  (`20220429A-add-flows.ts:32`, `20210525A-add-insights.ts:16`); `directus_operations.resolve`, `reject` là FK không
  `onDelete` (`:30-31`), nên phải đặt về null trước khi xóa operation.
- (f) R4 [Verified đọc code]: mọi DDL và ghi của `applyDiff` đi qua `trx` khi truyền `database` (`apply-diff.ts:43-58`,
  `:213-302`), kể cả lần đọc schema cuối (`:366`); không có kết nối riêng. Hoàn tác thật trên Postgres đo ở T039.
- (g) [Verified]: `RolesService.deleteMany` (`roles.service.ts:47-107`) đúng như bảng "Xóa kèm".

## Kết quả lượt 1 (2026-11-14)

- Parity trên Postgres, profile `sync`: `route.test.ts` (3), `diff.test.ts` (4), `refuse.test.ts` (8), `no-trace.test.ts`
  (1) xanh lần chạy đầu. Hai node đích báo cùng danh sách migration với cặp chính (E1 đạt).
- T025, SC-006: nguồn có 100 flow, 2.000 permission (cùng 33 collection của DB parity chính) → `POST /backoffice/sync/diff`
  trả 2.184 dòng, 1,1 MB, trong 440 ms ở máy local (Docker giả lập amd64). Mốc 30 giây của SC-006 không cần chỉnh; chưa
  đo với 200 collection người dùng.

## Việc của T001 (trước khi viết code)

1. Đọc lại mọi mục [Reported] ở trên.
2. Thử `redlock.using` với callback 20 giây (R6).
3. Đọc thông điệp lỗi của `agent-with-ip-validation.ts` để phân biệt "địa chỉ bị chặn" với "không tới được" (R2).
4. Tìm hàm tính quyền admin không qua cache, nhận transaction (R7).
5. Xác nhận FK `directus_panels.dashboard` và `directus_operations.flow` có `ON DELETE CASCADE` hay không (thứ tự xóa).
