# Research: Ẩn hiện ô tìm kiếm, Import, Export theo collection và migration riêng (022)

Đọc code ngày 2026-10-26, chưa chạy thử. Mục ghi [Inference] hoặc [Unverified] là suy ra từ code, có task kiểm ở lượt
1.

## R1. Bộ chạy migration riêng: thư mục, bảng, lock

**Decision**: thư mục mới `apps/api/src/database/backoffice-migrations/` với `index.ts` (danh sách import tĩnh, mỗi
migration `{ version, name, up }`), `run.ts` (`runBackofficeMigrations(knex)`: chỉ `latest`), test và file migration.
Trạng thái trong bảng `backoffice_migrations` (`version` string(255) khóa chính, `name` string(255) not null,
`timestamp` default `knex.fn.now()`, cùng dạng seed `15-migrations.yaml` của Directus). Không đọc thư mục
(`readdir`): swc build ra `.js` cạnh nhau nhưng danh sách tĩnh thì không phụ thuộc tên file và không lọt vào regex
`^[0-9]+[A-Z]-` của `migrations/run.ts` và `port.test.ts` (thư mục khác nên hai file đó không đổi).

**Rationale**: `migrations/run.ts` là port nguyên văn và được so với Directus (`port.test.ts`, 101 file); thêm vào đó
là sửa bản port. Bảng riêng giữ `directus_migrations` nguyên (constitution II 3.2.0).

**Lock**: `useLock()` (`apps/api/src/lock/lib/use-lock.ts`) trả kv Redis namespace `REDIS_LOCK_NAMESPACE ??
'directus:lock'` khi có Redis, kv local khi không. `usingLock(key, cb)`: bản Redis gọi `redlock.using([key],
lockTimeout = 5000, cb)` (`libs/memory/src/kv/lib/redis.ts:154`), bản local chạy `cb()` ngay
(`libs/memory/src/kv/lib/local.ts:83`). Redlock thử lại 100 lần, cách 50 ± 20 ms (`redis.ts:72-75`): process chờ
quá khoảng 5–7 giây thì `usingLock` ném lỗi [Inference], `bootstrap` thoát 1, container khởi động lại và lần sau thấy
migration đã xong. [Unverified] `redlock.using` tự gia hạn lock trong khi callback chạy (API của
`@sesamecare-oss/redlock`); nếu không, migration dài hơn 5 giây có thể để process khác vào: kiểm ở lượt 1 bằng test ba
replica của deploy. Khóa: `backoffice-migrations`. Trình tự: đọc `backoffice_migrations` (tạo bảng nếu chưa có) →
nếu không thiếu thì về ngay (không lấy lock) → `usingLock` → đọc lại → chạy từng migration thiếu theo version, insert
dòng sau mỗi `up` → `flushCaches(true)` một lần như `migrations/run.ts` (`apps/api/src/cache.ts:96`).

**Alternatives considered**: ghi `directus_migrations` (bị chủ dự án bỏ 2026-10-26: `migrate:down` của Directus lỗi
`Couldn't find migration`, `run.ts:97-106`); thêm file `BO` vào thư mục 101 migration (sửa regex bản port); không lock
như Directus (chủ dự án chọn lock); lệnh CLI riêng (chủ dự án bỏ).

## R2. Nối vào `bootstrap`, `init` và kiểm tra lúc `start`

**Decision**:

- `cli/commands/bootstrap/index.ts`: nhánh Postgres/SQLite gọi `runBackofficeMigrations(database)` sau
  `runMigrations(database, 'latest')` ở cả hai nhánh (DB trống và DB đã cài), trước `database.destroy()`. Nhánh vendor
  khác (D-145, dòng 32-43): sau `bootstrapInstalled`, nếu `await migrationsValid(database)` thì chạy migration riêng;
  nếu không thì thoát 0 như nay và `start` dừng vì migration Directus thiếu (US3 kịch bản 6).
- `cli/commands/init/index.ts`: tự cài DB (`runMigrations(db, 'latest', false)` ở dòng 48, không qua `bootstrap`), nên
  sau đó gọi `runBackofficeMigrations(db)` một lần, để `init` rồi `start` chạy được không cần `bootstrap`; log của
  nó theo quy tắc chuẩn hóa FR-019 (`init.test.ts`).
- `database/validate-migrations.ts`: `checkMigrations` thêm `boCompleted`, `boMissing`, `boExtra` (đọc
  `backoffice_migrations` qua `knex.schema.hasTable` rồi `select version`; không có bảng = chưa chạy gì);
  `validateMigrations` (gọi từ `startup/run-startup-checks.ts:43`) dừng với thông điệp riêng
  `Backoffice migrations do not match. Missing: …; unknown: …` và gợi ý `node cli.js bootstrap`; `migrationsValid`
  (CLI `load-extensions.ts:18`, cổng của nhánh D-145 trong `bootstrap`) chỉ xét migration Directus như Directus (sửa sau
  CI 40294646712: tính cả migration riêng làm `bootstrap` trên MySQL không bao giờ chạy chúng).
- `database migrate:latest|up|down` và `database install` không đổi (output so với Directus ở `cli.test.ts`); sau
  `database install` + `migrate:latest` thủ công, `start` báo thiếu migration riêng và chỉ sang `bootstrap`
  (quickstart).

**Rationale**: `bootstrap` là nơi image chạy mỗi lần khởi động (`apps/api/Dockerfile:75`), chế độ chung và độc lập
(Helm Job, compose service một lần) đều qua nó; không có lệnh CLI riêng theo quyết định chủ dự án.

## R3. Migration `20261026A-add-collection-ui-toggles`

**Decision**: `up(knex)`: với mỗi cột `bo_show_search`, `bo_show_import`, `bo_show_export`: `hasColumn` rồi
`alterTable('directus_collections', t => t.boolean(col).defaultTo(true))` (nullable); rồi nếu chưa có dòng
`directus_fields` (`collection = directus_collections`, `field = col`) thì insert `{ collection, field, special:
'cast-boolean', interface: 'boolean', width: 'half', translations: [{ language: 'en-US', translation }, { language:
'vi-VN', translation }] }` (object cho cột json như migration Directus `20201029C-remove-system-fields.ts:1650` insert
`options` object; `translations` là cột json của `directus_fields`). Không `down`. `sort` null: field không có sort
đứng sau mọi field hệ thống, vào card cuối của form collection (D-150) [Inference từ `getFieldsForCollection` sắp theo
`meta.system` rồi `meta.sort`]. `note` null (một chuỗi, không dịch được cho cả hai app; FR-002 sửa câu chữ: chỉ nhãn).

| Cột | en-US | vi-VN |
|-----|-------|-------|
| `bo_show_search` | Show Search | Hiện ô tìm kiếm |
| `bo_show_import` | Show Import | Hiện Import |
| `bo_show_export` | Show Export | Hiện Export |

**Rationale**: `special: cast-boolean` để MySQL/SQLite (tinyint/int) trả `true`/`false` trong `meta` ở cả hai app
(PayloadService đọc `directus_fields.special`); nếu thiếu, `0 !== false` là true và web không ẩn. `boolean().defaultTo(true)`
chạy trên 7 vendor như migration Directus `20211118A-add-notifications.ts`, `20231010A-add-extensions.ts`.
`hasColumn` cho trường hợp schema apply đã tạo cột (spec edge case, FR-014).

**Alternatives considered**: tạo qua API fields (cách A, chủ dự án bỏ); thêm divider `bo_*` alias để gom ba toggle
(thêm dòng `directus_fields` không có cột: ngoài phạm vi constitution II "dòng `directus_fields` của các cột đó";
có thể hỏi chủ dự án sau nếu vị trí cuối form không ổn; lượt 3: chủ dự án chọn tiêu đề chỉ ở web, D-182).

## R4. `backoffice_migrations` là collection hệ thống (D-181)

**Decision**:

- `libs/system-data/src/collections/collections.yaml`: thêm dòng `collection: backoffice_migrations`, `hidden: true`,
  `note: Backoffice migrations` (chuỗi, không `$t:`). Nhờ đó `systemCollectionRows` có nó với `system: true`, nên:
  `GET /collections` trả meta hệ thống (`collections.service.ts:332`), `/items/backoffice_migrations` bị 403
  (`items.controller.ts:40,91,124,142,183` dùng `isSystemCollection`), `DELETE /collections/backoffice_migrations` bị từ
  chối (`collections.service.ts:629`), snapshot bỏ qua (`get-snapshot.ts` `excludeSystem`), schema overview có nó như
  mọi bảng (`get-database-schema.ts:131-135`).
- `isSystemCollection` của `libs/system-data/src/collections/index.ts` (đang return false khi không có tiền tố
  `directus_`): bỏ điều kiện tiền tố hoặc thêm `backoffice_`; test `index.test.ts` "should have all collections start
  with directus_" sửa thành "directus_ hoặc backoffice_".
- Không thêm yaml field hệ thống (`fields/backoffice-migrations.yaml`): cột của bảng có meta null ở cả hai app, nên
  `GET /fields` của hai app giống nhau hơn; snapshot bỏ field meta null (`excludeUntracked`).
- Web: `stores/collections.ts` `isSystemCollection` thêm tiền tố `backoffice_` và `COLLECTIONS_DENY_LIST` thêm
  `backoffice_migrations` (như `directus_migrations`, dòng 25-35, 113: ngoài `crudSafeSystemCollections`; Data Model
  không liệt kê nó, `CollectionsRoute.vue`, sửa khi implement lượt 3);
  `utils/get-item-route.ts` `isSystemCollection` thêm tiền tố `backoffice_` để `/content/backoffice_migrations` ra
  ContentNotFound như `/content/directus_collections` (E2E `settings-data-model.spec.ts:246`).

**Khác biệt với Directus (D-181)**: Directus trả `backoffice_migrations` với `meta: null` trong `GET /collections`
(`directus/api/src/services/collections.ts:382-391`), cho admin đọc qua `/items`, Data Model của Directus app liệt
kê trong bảng chưa quản lý (`collections.vue:108`). Backoffice: meta hệ thống, 403 ở `/items`, không có trong danh sách
của Data Model. Spec FR-017 và US4 kịch bản 6 theo đây (sửa lại khi implement lượt 2 và lượt 3).

**GraphQL** [Unverified]: `/graphql` (items) của cả hai app có type `backoffice_migrations` vì bảng có khóa chính và nằm
trong schema overview; nếu Backoffice xếp nó vào `/graphql/system` theo `isSystemCollection` thì SDL hai app lệch →
parity graphql (so SDL nguyên văn) báo; lượt 1 kiểm, và nếu lệch thì ghi vào D-181 kèm normalize hoặc đưa lựa chọn tiền
tố `directus_` cho GraphQL. Tìm: `grep -rn "startsWith('directus_')\|isSystemCollection" apps/api/src/services/graphql`.

**Alternatives considered**: `DB_EXCLUDE_TABLES` ở cả hai app (chủ dự án bỏ: muốn Backoffice coi là bảng hệ thống);
ẩn khỏi Data Model (không giống `directus_migrations`, Directus app liệt kê nó trong nhóm System Collections).

## R5. Web: `SearchInput`, `ExportSidebarDetail`, `CollectionRoute`

**Decision**:

- `components/SearchInput.vue`: prop `showSearch` (mặc định `true`) cạnh `showFilter`. Khi tắt: không render nút
  search, `<input>`, nút xóa; pill `w-11`; `activate()` về ngay (không focus input vì không có); `onFilterOpen` không
  focus input khi đóng popover; `role="search"` giữ vì nút bộ lọc vẫn là bộ lọc của danh sách [Inference: test a11y
  axe ở browser project sẽ báo nếu `role=search` không có control]. Test `SearchInput.test.ts` thêm case.
- `components/sidebar/ExportSidebarDetail.vue`: prop `showImport`, `showExport` (mặc định `true`). Phần import
  (`v-if="createAllowed"`, dòng 519) thành `v-if="createAllowed && showImport"`; `<BoDivider />` cuối phần import chỉ
  khi còn phần export; phần export (nút Export, link CSV, dòng 585-608) `v-if="showExport"`; dialog export và error
  dialog giữ (không mở được khi ẩn). Test thêm case.
- `modules/content/routes/CollectionRoute.vue`: từ `currentCollection.value?.meta` (kiểu `Collection['meta']` của
  `@directus/types` không có khóa `bo_*` → đọc qua `Record<string, unknown>`):
  `showSearch = meta?.bo_show_search !== false`, `showImport`, `showExport` tương tự;
  `activeSearch = showSearch ? search : null` thay `search` ở `:search` của layout wrapper (dòng 336) và của
  `ExportSidebarDetail` (dòng 555); `SearchInput` nhận `:show-search="showSearch"`; `ExportSidebarDetail`
  `v-if="showImport || showExport"` với `:show-import`, `:show-export`. `search.value` (preset) không bị xóa (FR-004);
  `clearFilters` giữ. Test `CollectionRoute.test.ts` thêm 3 case (ẩn search, ẩn import/export, không gửi search).
- Admin không có ngoại lệ (FR-006). DrawerCollection không đổi (FR-009).

**Rationale**: `SearchInput` đã có prop `showFilter` cùng kiểu; `ExportSidebarDetail` đã tách import theo
`createAllowed`; `usePreset` cấp `search` nên che ở điểm dùng là đủ.

## R6. Parity: dump, CLI output, đối chiếu `/collections`, `/fields`

**Decision**:

- `tests/parity/src/bootstrap/dump.ts`: bảng `backoffice_*` đã bị lọc (chỉ `directus_`); bỏ cột `bo_*` khỏi
  `tables[].columns` và bỏ dòng `directus_fields` có `field` bắt đầu `bo_` khỏi `rows` (comment D-180). Bảng
  `directus_migrations` giữ nguyên 101 dòng (test hiện có vẫn đúng).
- `tests/parity/src/bootstrap/normalize.ts` (FR-107 của 021: thêm quy tắc = sửa spec trước): spec 022 FR-019 thêm quy
  tắc "bỏ dòng log của migration riêng" (`Running Backoffice migrations...`, `Applying <tên>...` của migration riêng,
  `Backoffice migrations are up to date`); `normalizeLogs` áp cho output `bootstrap` và `init` của `cli.test.ts`,
  `init.test.ts`, `partial.test.ts`.
- `tests/parity/src/normalizers.ts` `normalizeBody`: với `/collections`, `SEARCH /collections` bỏ phần tử có
  `collection` bắt đầu `backoffice_`; với `/fields` bỏ phần tử có `collection` bắt đầu `backoffice_` (D-181, hai app
  khác nhau ở đúng các phần tử này). `tests/parity/accepted-differences.ts`: thêm `D-180` (kind `doc`) và `D-181`
  (kind `doc`, lý do: normalize ở `normalizers.ts`), `accepted-differences.test.ts` kiểm id có trong spec 022.
- Env parity chính: service `backoffice-api` chạy CMD của image (`bootstrap` rồi `start`, `docker-compose.yml:249`),
  nên sau `env-up` DB chung có ba cột, ba dòng `directus_fields` và bảng `backoffice_migrations`; mọi suite (blackbox
  collections/fields/schema, GraphQL, web) chạy trên DB đó. Vendor MySQL/MSSQL/Oracle/Cockroach: nhánh D-145 chạy
  migration riêng (R2) → cùng trạng thái.
- `db-unchanged.test.ts` chụp sau khi API đã `start` → không đổi.
- Ba replica cùng lúc: suite deploy (`REPLICAS = 3`, image CMD) đã khởi động ba replica song song; thêm test trong
  `tests/parity/src/deploy/` kiểm `backoffice_migrations` có đúng một dòng mỗi migration, ba replica healthy, log có
  đúng một `Applying Add Collection UI Toggles...` [Inference: hai replica chờ lock rồi thấy đã xong]; chế độ
  standalone: service `bootstrap` chạy, replica chỉ `start` (kiểm tra qua) — `standalone.test.ts` giữ.
- Blackbox collections/fields/schema (`directus/tests/blackbox` port): chạy trên DB đã migrate; nếu một test đếm field
  của `directus_collections` hoặc so toàn bộ `GET /collections` thì normalize ở trên lo [Unverified: xem khi chạy].

## R7. E2E web ba cấu hình

**Decision**: spec mới `apps/web-e2e/src/content-collection-toggles.spec.ts`: `AdminApi` PATCH
`/collections/bo_content` `{ meta: { bo_show_search: false } }` (mẫu `settings-permissions.spec.ts:42`), mở
`/content/bo_content` bằng admin và bằng user thường (mẫu user của `content-permissions.spec.ts`), kiểm: không có
`textbox` tìm kiếm, nút `Filter` còn và mở popover; bookmark có search không gửi `search=` (kiểm request qua
`helpers/requests.ts`); tắt `bo_show_import`: mục Import/Export không có `Import Data`; tắt `bo_show_export`: không có
`Export Items` và `Download Page as CSV`; cả hai tắt: không có nút `Import / Export` (mẫu `content-export-import.spec.ts`
`openSidebar`); `afterEach` PATCH về `null`. Cấu hình proxy-to-Directus: Directus trả `meta.bo_*` từ cột (DB chung đã
migrate), nên cùng spec chạy được. `/content/backoffice_migrations` → not found (thêm vào case của
`settings-data-model.spec.ts:246`). Data Model: form `bo_content` có ba toggle, bật tắt và lưu (PATCH payload có
`bo_show_*`), ở cả ba cấu hình.

**Payload suite** (`helpers/payload.ts`, so payload với Directus app ở proxy-api): form collection của Directus app cũng
có ba field (cùng dòng `directus_fields`), nên PATCH giống nhau; không thêm case.

## R8. Unit test API

**Decision**: `backoffice-migrations/run.test.ts` và `20261026A-add-collection-ui-toggles.test.ts` trên SQLite
in-memory (mẫu `seeds/run.test.ts`): tạo `directus_collections`, `directus_fields` tối thiểu; chạy `up` hai lần
(không trùng), kiểm cột, dòng, `backoffice_migrations`; runner: tạo bảng, chạy thiếu, bỏ qua đã chạy, gọi
`flushCaches(true)` một lần (mock `../../cache.js`), lock: mock `useLock` trả kv local và kiểm thứ tự "đọc lại sau
lock" bằng một migration giả. `validate-migrations.test.ts`: thêm `schema.hasTable` vào db giả; case thiếu/lạ của
`backoffice_migrations`. `bootstrap/index.test.ts` (nếu có) và `assert-vendor`: nhánh vendor khác gọi
`runBackofficeMigrations` khi `migrationsValid`. `libs/system-data` `collections/index.test.ts` sửa test tiền tố.

## R9. Nâng Directus sau 11.17.4 và tên trùng

[Inference] Directus 11.17.4 không có cột `bo_*` hay bảng `backoffice_*`; `tools/generate-migration-list.mjs` và
`port.test.ts` chỉ nhìn `directus/`. Khi ghim bản Directus mới, task nâng cấp PHẢI grep `bo_` và `backoffice_` trong
`directus/api/src/database/migrations` mới. Ghi vào `deploy/README.md` mục nâng cấp (nếu có) hoặc quickstart.

## R10. Tài liệu và CI

- `deploy/README.md`: mục "Migration riêng của Backoffice" (bootstrap tự chạy, lock, vendor khác, rollback tay, D-181,
  `DB_EXCLUDE_TABLES` không cần).
- CI: không job mới; parity profile `bootstrap` (Postgres đủ, SQLite rút gọn) và deploy (3 replica) đã chạy mỗi PR;
  vendor khác hằng đêm (parity matrix).
- `accepted-differences.test.ts` đọc bảng "Khác biệt" của spec 022: giữ cột `Hạng mục` bắt đầu bằng `D-1xx`.

## R11. Ba lượt lên `main`

1. BE: runner + lock, migration `20261026A`, `bootstrap`/`init`, kiểm tra lúc `start`, system-data, unit test,
   parity `dump.ts`/`normalize.ts`/`normalizers.ts`/accepted-differences, spec FR-019 quy tắc log, deploy test ba
   replica. Cổng: parity `bootstrap` + deploy xanh.
2. FE: `SearchInput`, `ExportSidebarDetail`, `CollectionRoute`, store và route guard, unit + E2E
   `content-collection-toggles`, `settings-data-model` case. Cổng: e2e-web ba cấu hình xanh.
3. Đối chiếu đầy đủ trên DB đã migrate (blackbox collections/fields/schema, GraphQL SDL), `deploy/README.md`, kết quả
   [Unverified] của R1, R4 ghi vào research; vendor khác qua parity matrix hằng đêm.

## R12. Điều chưa kiểm được khi khảo sát

- `redlock.using` có tự gia hạn không (R1) → test ba replica và đọc `@sesamecare-oss/redlock`.
- Vị trí ba toggle trong form collection D-150 (card cuối) → chụp màn hình lượt 2; nếu chủ dự án muốn gom riêng thì
  hỏi lại (divider `bo_*`, R3).
- GraphQL SDL với `backoffice_migrations` (R4).

## Kết quả T001 (2026-10-26)

- (a) `@sesamecare-oss/redlock` 1.4.0: `using` chạy routine "in the context of an auto-extending lock" (README dòng
  68), gia hạn khi còn dưới `automaticExtensionThreshold` = 500 ms (`src/index.ts:62`); gia hạn hỏng thì `signal`
  báo hủy. Vậy `usingLock` của `@backoffice/memory` (gọi `redlock.using`) đủ cho migration dài hơn 5 giây; R1 giữ
  nguyên, không cần `acquireLock` + `extend`.
- (b) `apps/api/src/services/graphql/schema/index.ts:187-190` tách scope bằng `isSystemCollection` y như Directus
  (`directus/api/src/services/graphql/schema/index.ts:185-188`). Sau khi `libs/system-data` nhận `backoffice_`,
  `backoffice_migrations` sang `/graphql/system` ở Backoffice, còn Directus (tiền tố `directus_`) giữ nó ở `/graphql`
  như collection chưa quản lý. SDL hai app lệch ở type này ở cả hai endpoint → D-181 thêm GraphQL; T025 normalize SDL
  (bỏ type `backoffice_migrations` và các field/query của nó ở cả hai bên) trong `tests/parity/src/graphql`.
- (b, khi làm T022) scope `system` đặt tên type bằng `collection.substring(9)` (cắt `directus_`,
  `apps/api/src/services/graphql/schema/index.ts:209,250,275,310`) và resolver ghép lại `directus_${name}`
  (`resolvers/query.ts:18`, `mutation.ts:17`): `backoffice_migrations` sẽ thành type `e_migrations` không truy vấn
  được. Sửa: thêm `backoffice_migrations` vào `SYSTEM_DENY_LIST` (`schema/index.ts:42`), như Directus làm với
  `directus_migrations`; Backoffice không có nó ở cả `/graphql` lẫn `/graphql/system`, Directus có ở `/graphql` (admin).
  Ghi vào dòng D-181 của spec.

## Kết quả lượt 1 (2026-10-26, env parity Postgres local)

- T018: profile `bootstrap` trên DB trống: 72 test đạt, 3 bỏ qua. Migration riêng chạy ở `backoffice-api-bootstrap`
  (DB trống) và ở `backoffice-api` (DB do Directus cài) mất khoảng 0,1 giây (log pino 06.392 → 06.508). Hai chỗ phải
  sửa khi chạy: `indexesOf` của Postgres trả mọi index của schema (`backoffice_migrations_pkey`) → `dump.ts` chỉ giữ
  index của bảng `directus_*`; `schema snapshot` của DB Backoffice có ba field `bo_*` → `cli.test.ts` so snapshot đã
  parse, bỏ field `bo_*` của bảng `directus_*` (spec FR-019). Suite deploy (T017) để CI chạy.
- T024 (gửi `Cache-Control: no-store`; không có header này thì app thứ hai trả response của app thứ nhất từ cache
  dùng chung): `GET /items/backoffice_migrations` Backoffice 403, Directus 200; `GET /collections/backoffice_migrations`
  Backoffice `meta.system true, hidden true`, Directus `meta: null`; `DELETE /collections/backoffice_migrations` ở
  Backoffice 403 `FORBIDDEN` (không gửi tới Directus). Collection tạo ở Directus có `bo_show_* = true` ở cả hai app;
  PATCH `bo_show_search: false` ở Backoffice, Directus đọc `false`; `GET /fields/directus_collections/bo_show_search`:
  `type boolean`, `interface boolean`, `special ["cast-boolean"]`, nhãn en-US/vi-VN.
- SDL: trên DB có một collection người dùng, SDL `/server/specs/graphql` của Directus sau `withoutBackofficeSdl` bằng
  từng byte SDL của Backoffice. Trên DB không có collection người dùng hai SDL còn khác ở `Query`/`Mutation` rỗng
  (Backoffice in placeholder `_empty: Void`, Directus có field của `backoffice_migrations`); `schema.test.ts` luôn tạo
  collection trước khi so nên không gặp.
- T025 lần 1 (request-set, schema, schema-management, GraphQL): 8 đỏ, đều do D-181. (1) SchemaOverview dùng chung qua
  Redis có `note: "Backoffice migrations"` ở Backoffice, null ở Directus → bỏ `note` khỏi dòng yaml (Directus không có
  dòng `directus_collections` nên note null). (2) ETag của `/collections`, `/graphql`, `/graphql/system`, route SDL:
  body Directus dài hơn nên phần độ dài khác → `compare()` bỏ so ETag khi body thô một bên có `backoffice_migrations`
  hoặc khi `HEAD` route SDL (không có body). (3) Introspection admin: graphql-js xếp `types` theo thứ tự duyệt từ
  `Query`, mà field đầu của `Query` ở Directus là `backoffice_migrations` → sau khi lọc vẫn lệch thứ tự → trong trường
  hợp đó `compare()` so `types` theo tên. Hệ quả: với admin, thứ tự `types` của introspection không còn được so; với
  user không có quyền trên bảng này vẫn so nguyên văn.
- T025 lần 2–3: route SDL trả `application/octet-stream` (file `.graphql`) nên `compare()` so sha256 → so dạng text sau
  `withoutBackofficeSdl`; `system.test.ts` so danh sách path OAS lấy qua GraphQL → bỏ `/items/backoffice_*` ở hai bên;
  scope `system` của Directus có `Subscription.backoffice_migrations_mutated` và hai type đi kèm → lọc cả introspection
  `/graphql/system` (thứ tự còn lại khớp, không cần sắp). Kết quả: request-set, schema, schema-management, GraphQL trên
  Postgres local 128 đạt, 24 bỏ qua (profile khác).

## Sau CI lượt 1 (2026-10-26)

- CI 40294646712: (1) `cleanstart/openldap:latest` lên 2.7.2 không đọc được `slapd.conf` (không do 022; phiên 021 ghim
  2.7.1 theo digest, `3d559222`); (2) `migrationsValid()` tính cả migration riêng nên nhánh D-145 của `bootstrap` không
  bao giờ chạy chúng trên MySQL → trả `migrationsValid()` về chỉ migration Directus (`9914401a`); (3) log deploy dạng
  pretty → test deploy đếm theo chuỗi.
- CI 40298326039: các service Backoffice chung một DB mà không chung lock (profile `schema-cache-nomsg` tắt Redis,
  `web-cors` namespace riêng) cùng chạy migration riêng → `CREATE TABLE backoffice_migrations` trùng `pg_type` → container
  thoát. Sửa (`764c4e01`): bảng, cột `bo_*`, dòng `backoffice_migrations` kiểm lại sau lỗi; dòng `directus_fields` trùng
  của một field `bo_*` bị xóa, giữ id nhỏ nhất. Kiểm local với profile của job blackbox: 9 service Backoffice chạy, 2
  service cùng áp migration, DB còn 1 dòng `20261026A` và 3 dòng `directus_fields`. Introspection scope `system` trên
  MySQL: `types` so theo tên khi không phải Postgres/SQLite.

## Kết quả lượt 2 (2026-10-26, local)

- Web unit (`unit` + `browser`, có axe cho trang Content với `bo_show_*` tắt): 4406 đạt.
- E2E `content-collection-toggles.spec.ts` ở `proxy-api`: 9/9 đạt; ở `proxy-directus` (cùng các case
  `settings-data-model.spec.ts`): 18 đạt. Bốn chỗ sửa khi chạy: reader mở layout cards nên đợi nút bộ lọc; tên mục
  "Auto Refresh"; reset toggle về `null` làm switch của Data Model hiện tắt → reset về `true`; export
  CSV không phải JSON → đọc `api.bytes`.
- Data Model: Directus app liệt kê mọi collection hệ thống, kể cả `directus_migrations`; `COLLECTIONS_DENY_LIST` chỉ loại
  khỏi `crudSafeSystemCollections`. Vì vậy lượt 2 đưa `backoffice_migrations` vào nhóm System Collections như
  `directus_migrations`; lượt 3 bỏ nó khỏi danh sách (xem "Kết quả lượt 3").
- Vị trí ba toggle (R12, xem trên app web local với API Backoffice, Settings > Data Model > một collection): một card
  riêng không có tiêu đề, cuối form, sau card "Duplication"; "Show Search" và "Show Import" cùng hàng, "Show Export" hàng
  dưới, mỗi ô nửa chiều rộng, checkbox "Enabled" bật sẵn. Card không tiêu đề vì ba dòng `directus_fields` không phải
  field hệ thống: `getFormFields` (port của DR `v-form/utils/get-form-fields.ts`) chèn `$system_divider` (divider không
  tiêu đề) giữa field hệ thống và field người dùng, và form card (D-150) mở card mới ở mỗi divider.
- Chủ dự án 2026-10-26: thêm tiêu đề, chỉ ở web (D-182). `FieldsRoute.vue` truyền `fields` cho `BoForm` thay cho
  `collection`: các field của `directus_collections` cộng một divider `bo_content_toggles_divider` (không có trong DB)
  với tiêu đề từ overlay `collection_content_toggles` và icon `tune`. Chủ dự án 2026-10-27: card đặt ngay trên
  Duplication, nên form coi divider và ba toggle là field hệ thống, `sort` của divider = `sort` của `duplication_divider`
  − 0,5, ba toggle − 0,25 (giữ thứ tự theo `id`); không còn `$system_divider` vì không còn field người dùng. Không có
  toggle `bo_show_*` (DB chưa chạy migration) thì form như cũ.

## Kết quả lượt 3 (2026-10-26)

- T042 (env parity Postgres local, DB đã có migration riêng): blackbox `routes/collections`, `routes/fields`,
  `routes/schema`, `db/schema` (cùng `00-seed`) 310/310 đạt ở Backoffice và 310/310 ở Directus; không phải sửa
  normalize. Phần GraphQL của T042 là lượt chạy của lượt 1 (request-set, schema, schema-management, GraphQL: 128 đạt).
- CI 40298326039, `settings-parity-ui.spec.ts` (proxy-api): cây Data Model của Backoffice có thêm `directus_migrations`.
  Test đổi khóa hiển thị `backoffice_*` (D-118) về `directus_*` trước khi so, nên bảng thật `backoffice_migrations` thành
  một `directus_migrations` thứ hai. Với web của lượt 2, nhóm System Collections có hai dòng cùng hiện
  "backoffice_migrations" (theo code `display-collection-key.ts`). Chủ dự án chọn bỏ bảng thật khỏi danh sách của
  Data Model (`CollectionsRoute.vue`); unit `CollectionsRoute.test.ts` và E2E `settings-data-model.spec.ts` kiểm. Run này
  chỉ có code lượt 1, nên không có kết quả cho web lượt 2 và lượt 3.
- CI 40308977164 (`173403ae`, ba lượt và sửa Data Model): xanh hết sau khi chạy lại `quality` (lần 1 đỏ ở hai test
  browser chạy local đạt: `Kanban.browser.test.ts` "a viewer gets no card or column menus", flake đã biết, và
  `keyboard.browser.test.ts` đổi độ rộng cột). Không có job MySQL (CI tạm chỉ Postgres, SQLite; bật lại sau
  đó cùng ngày).
- T043: `parity-matrix` 40320127600 xanh (4 shard ma trận quyền Postgres, `blackbox-full` SQLite với seed của cả hai
  app); vendor khác bỏ theo chủ dự án. `benchmark-web` 40320123598 xanh; trang Content (items 10 triệu dòng): request
  list + count bằng nhau ở Directus app, web → Directus và web → API (trang đầu 1 + 1, trang sau 1 + 0, sort 2 + 0,
  lọc preset 1 + 2), p95 web → API trang đầu 1021 ms (mục tiêu 2000 ms): ba toggle không thêm request.
- D-182 (tiêu đề card ba toggle): unit `FieldsRoute.test.ts` 6/6 (case mới: card cuối có tiêu đề và đúng ba toggle);
  unit Data Model, lang, Content, sidebar 239 đạt; axe trang collection đạt; xem trên app web local với API Backoffice:
  card "Content: Search, Import, Export" có icon, ba toggle bên dưới, không còn card trống. E2E
  `content-collection-toggles.spec.ts` thêm kiểm tiêu đề en-US và vi-VN, chạy ở CI.

## Sửa spec khi plan (2026-10-26)

- FR-002: "nhãn en-US và vi-VN" (bỏ "ghi chú": `directus_fields.note` là một chuỗi, không dịch được cho cả hai app).
- FR-017 và US4 kịch bản 6: Backoffice ẩn `backoffice_migrations` khỏi Data Model như `directus_migrations` (danh sách
  loại trừ của app), không hiện trong nhóm hệ thống.
- FR-019: thêm quy tắc chuẩn hóa log của migration riêng khi so output CLI với Directus (FR-107 của 021 đòi ghi quy tắc
  trong spec).
