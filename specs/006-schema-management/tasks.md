---

description: "Danh sách task cho feature 006: Quản lý data model (/collections, /fields, /relations, /schema)"
---

# Tasks: Quản lý data model (`/collections`, `/fields`, `/relations`, `/schema`)

**Input**: Tài liệu thiết kế trong `/specs/006-schema-management/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md`, `data-model.md`, `contracts/`, `quickstart.md`,
`checklists/schema-review.md`.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test. Test gốc của Directus đi kèm file port thì port theo, chạy đỏ trước rồi port code
  (research R12).
- Mọi endpoint thêm hoặc sửa có test đối chiếu chạy với cả Directus 11.17.4 thật lẫn app mới (research R5, R6); DDL so
  nối tiếp trên cùng DB với cùng tên (Clarifications); bốn nhóm route thêm bộ blackbox port chạy hai lượt theo app (R7).

**Organization**: Task nhóm theo user story của spec. Phase 1 và 2 là nền chung: thư viện, type, util thiếu, profile,
bộ so sánh, ba service và `router-options`. Thứ tự story theo research R13: US1 (collection, field) → US2 (relation) →
US4 (snapshot, diff, apply) → US3 (dùng chéo, xóa cache qua API, E2E) → US5 (blackbox) → Polish. US4 đứng trước US3
vì US3 so snapshot hai app (cần route `/schema/snapshot`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task. Phase 1, 2 và Polish không có nhãn này.
- File port từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn nguồn>`. Mỗi task port ghi các cặp
  `{ "source", "dest" }` (source tính từ `directus/`) vào `tools/port-manifest/006-T###.json`, theo đúng ID task.
  Chạy `node tools/check-port-headers.mjs` sau khi ghi. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Port nguyên vẹn: giữ tên biến, thứ tự câu lệnh, message của Directus. Chỗ khác nguồn ghi `// Backoffice: <lý do>`
  (danh sách cho phép ở plan, Constitution Check I). Giới hạn tạm ghi `// ponytail: <giới hạn>, <khi nào nâng>`.
- **Không sửa service của feature trước**; chỉ thêm `flushCaches` vào `cache.ts` và factory vào `providers.ts`.
- **Luôn tái tạo hành vi Directus**, kể cả hành vi không an toàn (R-11), trừ D-32 (chặn xóa collection hệ thống,
  Nguyên tắc II). Phát hiện hành vi không an toàn mới thì thêm dòng R-xx vào spec kèm bằng chứng và một ca thể hiện;
  không tự lệch.
- Không đọc `useEnv()` ở cấp module (quy ước 001) trừ chỗ Directus làm thế và đã có tiền lệ (`systemFieldRows` của
  `fields.ts:53` đọc env qua `getSystemFieldRowsWithAuthProviders`, như 002).
- Tên biến, comment, commit viết tiếng Anh. Tài liệu viết tiếng Việt.
- Test viết trước và phải fail trước khi làm phần tương ứng.
- Quy trình merge thẳng `main`: mỗi nhóm task commit và push xong thì CI phải xanh; `pnpm run ci:local` khi Actions bị
  chặn.

## Quy ước đường dẫn

- API: `apps/api/src/**`. Libs: `libs/types/src/**`, `libs/utils/src/**`. Catalog: `pnpm-workspace.yaml`.
- Test đối chiếu: `tests/parity/src/**` (mới: `tests/parity/src/schema-management/**`; blackbox port thêm vào
  `tests/parity/src/items/blackbox/**`). Danh sách khác biệt: `tests/parity/accepted-differences.ts`. Profile và env:
  `tests/parity/docker-compose.yml`, `tests/parity/env/**`.
- E2E app Directus: `tests/directus-app-e2e/**`. Reverse proxy: `tests/parity/proxy/**`.
- Benchmark: `tests/benchmark/**`. Công cụ: `tools/**`. CI: `.github/workflows/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/packages/*`, `directus/tests/blackbox/**`.

## Tóm tắt

- Tổng số task: **58**
- Số task đánh dấu [P]: **35**
- Một lượt implement (dưới ngưỡng 60 của research R13), checkpoint sau mỗi phase.
- MVP gợi ý: **Phase 1 đến 4** (US1, US2): bốn nhóm route trừ `/schema`, DDL và metadata so bằng Directus trên Postgres,
  MySQL, SQLite. Feature chưa đóng được khi chưa xong US4, US3, US5 (snapshot, dùng chéo, blackbox) và constitution 1.4.0.

---

## Phase 1: Setup (thư viện, type, util thiếu, profile, bộ so sánh)

**Purpose**: Thêm ba thư viện cùng bản Directus, port phần nhỏ còn thiếu của libs và `apps/api`, dựng bốn cặp profile,
sửa suite và proxy (research R1, R3, R7, contracts/parity.md §3, §4).

- [X] T001 Thêm vào `catalog:` của `pnpm-workspace.yaml` đúng bản `directus/pnpm-workspace.yaml`: `deep-diff: 1.0.2`,
  `'@types/deep-diff': 1.0.5`, `busboy: 1.6.0`, `'@types/busboy': 1.5.4`, `zod: 4.1.12`. `apps/api/package.json`:
  `deep-diff`, `busboy`, `zod` (types vào devDependencies); `libs/types/package.json`: `@types/deep-diff` (type
  `SnapshotDiff` dùng `Diff` của deep-diff). Chạy `pnpm install`, `pnpm audit --prod --audit-level=high`; ghi kết quả
  vào "Ghi chú khi làm" (research R1).
- [X] T002 [P] Port `libs/types/src/collection.ts` từ `directus/packages/types/src/collection.ts` (`Collection`,
  `ApiCollection`, `CollectionMeta` dùng của `@backoffice/system-data` nếu Directus import từ `@directus/system-data`)
  và `libs/types/src/snapshot.ts` từ `packages/types/src/snapshot.ts` (`Snapshot`, `SnapshotField`, `SnapshotRelation`,
  `SnapshotSystemField`, `SnapshotWithHash`, `SnapshotDiff`, `SnapshotDiffWithHash`, `DiffKind`); export trong
  `libs/types/src/index.ts`; `libs/types/src/index.test.ts` thêm khẳng định export. Ghi manifest.
- [X] T003 [P] Port `libs/utils/src/shared/add-field-flag.ts` và `add-field-flag.test.ts` từ
  `directus/packages/utils/shared/`, `libs/utils/src/node/readable-stream-to-string.ts` và test từ
  `directus/packages/utils/node/`; export trong `index.ts` của `shared` và `node`. Ghi manifest.
- [X] T004 [P] `apps/api/src/constants.ts` thêm `ALLOWED_DB_DEFAULT_FUNCTIONS` (port dòng `directus/api/src/constants.ts:111`);
  `apps/api/src/cache.ts` thêm `flushCaches()` (port `directus/api/src/cache.ts:91`: `clearSystemCache` rồi
  `cache.clear()`), sửa comment đầu file; `apps/api/src/cache.test.ts` thêm ca `flushCaches` (gọi cả hai, thứ tự). Ghi
  manifest.
- [X] T005 [P] Port `apps/api/src/test-utils/knex.ts` từ `directus/api/src/test-utils/knex.ts` (`createMockKnex`,
  `resetKnexMocks`, `setupSystemCollectionMocks`) và `apps/api/src/__utils__/schemas.ts` từ
  `directus/api/src/__utils__/schemas.ts` (`snapshotApplyTestSchema`); hai thư mục này vào `coverage.exclude` của
  `apps/api/vitest.config.ts`. Ghi manifest.
- [X] T006 [P] Tạo `tests/parity/env/profile-schema-cache.env`, `profile-schema-cache-nomsg.env`, `profile-tz-asia.env`,
  `profile-tz-america.env` theo contracts/parity.md §3 (`schema-cache`: `CACHE_ENABLED=true`, `CACHE_AUTO_PURGE=true`,
  `CACHE_SCHEMA=true`, `CACHE_STORE=memory`, `CACHE_NAMESPACE=directus-schema-cache`, ba namespace Redis riêng;
  `schema-cache-nomsg`: thêm `REDIS_ENABLED=false`, `SYNCHRONIZATION_STORE=memory`, bỏ `REDIS`; `tz-*`: chỉ `TZ`). Phía
  Backoffice của hai cặp `schema-cache*` ghi đè `CACHE_NAMESPACE` (`...2`, `...4`) bằng `environment:` trong compose ở
  T007 (gốc `schema-cache.test.ts:29-40, 132-142`).
- [X] T007 `tests/parity/docker-compose.yml`: bốn cặp profile `schema-cache` (9655, 9656), `schema-cache-nomsg` (9755,
  9756), `tz-asia` (9855, 9856), `tz-america` (9955, 9956), mẫu cặp `blackbox` (hai env file: vendor + `profile-blackbox.env`
  + env profile mới); `tests/parity/scripts/env.mjs` thêm vào `ALL_PROFILES`; `tests/parity/src/config.ts`
  `profilePorts` thêm bốn dòng. Test trong `tests/parity/src/vendors.test.ts`: cổng không trùng, khớp compose, mỗi cặp
  có file env. (sau T006)
- [X] T008 [P] `tests/parity/src/suite.ts`: `FULL_FILES` thêm `src/schema-management/**/*.test.ts`; `REDUCED_FILES` thêm
  `src/schema-management/crud.test.ts`; kiểm `BLACKBOX_FILES` (hoặc `include` của
  `src/items/blackbox/vitest.blackbox.config.ts`) đã bao `tests/db/routes/{collections,fields,schema}/**` và
  `tests/db/schema/timezone/**`, nếu chưa thì thêm. Test trong `src/vendors.test.ts`.
- [X] T009 [P] `tests/parity/proxy/backoffice-routes.txt` thêm `collections`, `fields`, `relations`, `schema` (sinh lại
  `nginx.conf` bằng `scripts/proxy-conf.mjs`); `proxy-conf.test.ts` thêm ca `/collections`, `/fields/x`, `/relations/x/y`,
  `/schema/snapshot` về app mới, `/utils/sort/x` vẫn về Directus.
- [X] T010 [P] Đo D-32 trên Directus thật: dựng một cặp DB + Directus bỏ đi (ví dụ `docker compose -p d32` với
  `tests/parity/docker-compose.yml`, vendor sqlite3 là nhanh nhất), gọi `DELETE /collections/directus_notifications`
  bằng admin, ghi status và trạng thái bảng (`sqlite_master`) vào dòng D-32 của spec (thay `[Chưa đo]`) và "Ghi chú khi
  làm"; nếu Directus chặn (`403`) thì xóa D-32 khỏi spec, plan, `accepted-differences.ts` và không thêm `if` ở T015, làm giống.
  Không chạy trên DB đối chiếu.

**Checkpoint**: `pnpm nx run-many -t test lint typecheck` xanh; `env-up --vendor=postgres
--profiles=blackbox,schema-cache,schema-cache-nomsg,tz-asia,tz-america` lên đủ 10 container và `global-setup` đặt URL
bốn cặp mới.

---

## Phase 2: Foundational (ba service, `sanitize-schema`, provider, `router-options`)

**Purpose**: Mọi story đều cần ba service port nguyên và factory của chúng (research R3).

- [X] T011 [P] Port `apps/api/src/utils/sanitize-schema.ts` và `sanitize-schema.test.ts` từ `directus/api/src/utils/`
  (`sanitizeCollection`, `sanitizeField`, `sanitizeRelation`, `sanitizeSystemField`, `sanitizeColumn`; `FieldsService`
  cần `sanitizeColumn`). Ghi manifest.
- [X] T012 [P] Port `apps/api/src/services/fields/build-collection-and-field-relations.ts`,
  `get-collection-meta-updates.ts`, `get-collection-relation-list.ts` và ba test gốc từ
  `directus/api/src/services/fields/`. Ghi manifest.
- [X] T013 Port `apps/api/src/services/relations.service.ts` từ `directus/api/src/services/relations.ts` (import
  `getSchema` từ `../schema/get-database-schema.js`, `getDefaultIndexName`, `systemRelationRows`; chỗ khác nguồn ghi
  `// Backoffice:`). Viết mới `apps/api/src/services/relations.service.test.ts` (không có test gốc; dùng
  `knex-mock-client` và `@backoffice/schema-builder`): `403` không admin; `400` thiếu `collection`, `field`, collection
  và field không tồn tại, field là khóa chính, `related_collection` không tồn tại, đã có relation; `createOne` sinh
  `foreign(...)` với tên `getDefaultIndexName('foreign', ...)`, `onDelete`, `onUpdate`; m2a không DDL; `alterType` trên
  MySQL; ItemsService của `directus_relations` không `accountability`; `updateOne` `dropForeign` rồi tạo lại với
  `constraintName`, không đổi `related_collection`; `deleteOne` xóa FK khi có, xóa meta thô, action `relations.delete`;
  `stitchRelations` (FK không meta, meta không FK); `clearSystemCache` được gọi. Ghi manifest.
- [X] T014 Port `apps/api/src/services/fields.service.test.ts` từ `directus/api/src/services/fields.test.ts` (sửa đường dẫn
  mock: `getSchema` → `../schema/get-database-schema.js`, `test-utils`), chạy đỏ; rồi port `apps/api/src/services/fields.service.ts`
  từ `directus/api/src/services/fields.ts` (zod `systemFieldUpdateSchema` export; `getSystemFieldRowsWithAuthProviders`,
  `getDefaultValue`, `getLocalType` từ `../schema/`; `ALLOWED_DB_DEFAULT_FUNCTIONS`, `ALIAS_TYPES` từ `../constants.js`;
  `sanitizeColumn` từ T011; `RelationsService` từ T013). Test gốc xanh. Ghi manifest. (sau T011, T012, T013)
- [X] T015 Port `apps/api/src/services/collections.service.test.ts` từ `directus/api/src/services/collections.test.ts`,
  chạy đỏ; rồi port `apps/api/src/services/collections.service.ts` từ `directus/api/src/services/collections.ts`. Thêm ở
  đầu `deleteOne`, sau kiểm admin: `if (isSystemCollection(collectionKey)) throw new ForbiddenError();` với
  `// Backoffice: D-32, Nguyên tắc II; Directus drops the system table (spec 006)`; thêm ca test D-32 (không
  `dropTable`, không `readByQuery`). Typecheck toàn `apps/api`: helper hoặc util còn thiếu thì port bổ sung trong task
  này, ghi vào "Ghi chú khi làm". Ghi manifest. (sau T014; và sau T010: chỉ thêm `if` D-32 khi T010 xác nhận Directus
  xóa bảng; nếu Directus chặn thì không thêm `if`, bỏ D-32 khỏi spec, plan, contracts/ddl.md §5, research R11)
- [X] T016 `apps/api/src/providers.ts`: factory `CollectionsService`, `FieldsService`, `RelationsService` theo mẫu
  `PermissionsService` (`useFactory: (db) => (opts) => new XService({ knex: db(), ...opts })`); `apps/api/src/services/index.ts`
  export ba service; `providers.test.ts` (nếu có) thêm ba factory. (sau T015)
- [X] T017 [P] Đo `OPTIONS` tới Directus của cặp chính cho 10 path ở contracts/schema-api.md §3 (`/collections`,
  `/collections/x`, `/fields`, `/fields/x`, `/fields/x/y`, `/relations`, `/relations/x`, `/relations/x/y`,
  `/schema/snapshot`, `/schema/diff`), ghi `Allow` thật vào contract và "Ghi chú khi làm"; thêm 10 mẫu vào
  `apps/api/src/middleware/router-options.ts` theo thứ tự mount của Directus (`collections`, `fields` trước `items`;
  `relations`, `schema` sau); `router-options.test.ts` thêm ca cho từng mẫu và dấu `/` cuối.

**Checkpoint**: `pnpm nx run api:test` xanh (13 file test gốc của Phase 2 và test mới), `api:typecheck` xanh, coverage
`apps/api` ≥ 80%.

---

## Phase 3: User Story 1 - Tạo, sửa, xóa collection và field thường, có bảng và cột thật (Priority: P1) 🎯 MVP

**Goal**: `/collections`, `/fields` giống Directus; DDL và metadata trùng Directus trên từng vendor (FR-001 đến FR-003,
FR-010 đến FR-013, FR-020 đến FR-024, FR-060).

**Independent Test**: `parity --vendor=postgres` suite `full` với `src/schema-management/{crud,ddl}.test.ts`; `reduced` ở
MySQL, SQLite.

### Tests for User Story 1

- [X] T018 [P] [US1] `tests/parity/src/schema-management/ddl-capture.ts`: `captureModel(db, collections)` theo
  contracts/parity.md §1 (`columnInfo`, `foreignKeys` của `@backoffice/schema`, index, ba bảng metadata bỏ `id`); tách
  truy vấn index theo vendor của `tests/parity/src/db-snapshot.ts` thành hàm dùng chung `indexesOf(db, table)`. Đo trên
  Postgres, MySQL, SQLite với một bảng mẫu có unique, index, FK tạo qua API Directus (`ddl-capture.test.ts`: tên,
  cột, `unique` đúng ở ba vendor); ghi kết quả vào "Ghi chú khi làm" (research R5, rủi ro).
- [X] T019 [P] [US1] `tests/parity/src/schema-management/ddl-scenario.ts`: `ddlScenario(name, steps, { collections })`
  chạy nối tiếp Directus → chụp → xóa qua Directus → so `snapshot(db)` với trước → app mới → chụp → xóa → so; so hai
  bản chụp và từng response bằng `parity()` (contracts/parity.md §1). `tests/parity/src/normalizers.ts` thêm normalizer
  `meta.id` của field, relation → `<id>`; `normalizers.test.ts` thêm ca.
- [X] T020 [P] [US1] `tests/parity/src/schema-management/crud.test.ts` (`scenario()` + `flow` của 004, collection
  `parity_sm_*`): US1.1 đến US1.8 phần HTTP; lỗi tên (`directus_`, `/`, rỗng, trùng), `fields` không phải mảng, kiểu lạ,
  alias ↔ không alias, khóa chính nullable, field hệ thống (`PATCH` key lạ → `400` message zod, `DELETE` → `403`),
  non-admin `403` và đọc theo quyền một phần (collection cha của group, `fields` của permission); `PATCH /fields/:c`
  hàng loạt lỗi ở phần tử thứ hai (phần tử đầu giữ, Edge Cases); body `PATCH /fields/:c/:f` có `field` khác URL;
  `PATCH /collections/directus_users` meta (R-11, dọn dòng sau ca); `DELETE /collections/directus_users` chỉ gọi ở app
  mới → `403` (D-32, `accepted-differences`); `SEARCH`, `OPTIONS`, `HEAD`, dấu `/` cuối; `GET /collections?limit=1` bỏ
  qua query nhưng `?limit=abc` → `400`.
- [X] T021 [US1] `tests/parity/src/schema-management/ddl.test.ts` (dùng T018, T019): ma trận FR-060 cho mỗi kiểu của
  `TYPES` (14 `KNEX_TYPES` kể cả `binary`, `hash`, `csv`, `geometry` và 6 kiểu con) × tùy chọn (`default_value` gồm
  `now()`, `CURRENT_TIMESTAMP`, `CURRENT_TIMESTAMP(3)`, `gen_random_uuid()` (lỗi `500` ở vendor không có hàm),
  `is_nullable`, `is_unique`, `is_indexed`, cả hai, `max_length` null và chuỗi, `numeric_precision/scale`), ba kiểu khóa
  chính, folder, cột người dùng trong `directus_users` (tạo, sửa, xóa), `PATCH /fields/directus_users/email`
  `is_indexed` bật rồi tắt, `concurrentIndexCreation` (kể cả SQLite), sửa kiểu có dữ liệu (string → text, integer →
  float, string → integer lỗi: so status và mã), sửa `max_length`, nullable, default, unique, index; xóa field; xóa
  collection có preset, permission (`fields` CSV), activity, revision (có `parent`), relation, `item_duplication_fields`,
  group con, share, version; tên có khoảng trắng và chữ hoa (Edge Cases); tên dài 70 ký tự (`500`). Mỗi ca kiểm DB về
  bằng snapshot trước.
- [X] T022 [P] [US1] `apps/api/src/controllers/collections.controller.test.ts` (supertest qua app Nest như
  `items.controller.test.ts`, service mock): thứ tự route, `validateBatch` cho `GET`/`SEARCH`, body mảng cho `PATCH /`,
  `concurrentIndexCreation`, `204` khi đọc lại `Forbidden`, `DELETE` → `204`, `meta` từ `MetaService`.
- [X] T023 [P] [US1] `apps/api/src/controllers/fields.controller.test.ts`: `validateCollection` trước Joi (`403` collection
  lạ), Joi `newFieldSchema`, `updateSchema`, zod cho field hệ thống (message), body mảng, `field` mặc định theo URL,
  `DELETE` field hệ thống `403`, `204` khi `Forbidden`, `concurrentIndexCreation`.


### Implementation for User Story 1

- [X] T024 [US1] `apps/api/src/controllers/collections.controller.ts` port từ `directus/api/src/controllers/collections.ts`
  (Nest, `ServiceFactory<CollectionsService>`, `MetaService`, `runMiddleware(validateBatch('read'))`, `respond(req, res)`;
  không `useCollection`); đăng ký trong `apps/api/src/app.module.ts`. T022 xanh. Ghi manifest. (sau T016)
- [X] T025 [US1] `apps/api/src/controllers/fields.controller.ts` port từ `directus/api/src/controllers/fields.ts`
  (`runMiddleware(collectionExists)` làm `validateCollection` ở các route có `:collection`, Joi `newFieldSchema`,
  `updateSchema` giữ nguyên, `systemFieldUpdateSchema` từ service, `isSystemField` của `@backoffice/system-data`);
  `app.module.ts` thêm `useCollection('directus_fields')` cho controller này. T023 xanh. Ghi manifest. (sau T016)
- [X] T026 [P] [US1] `tests/parity/src/request-set.ts` thêm `GET /collections`, `GET /fields` (ba biến thể token) cho
  `db-unchanged`, `readonly-account`; `GET /relations`, `GET /schema/snapshot` thêm ở T030, T037 (route chưa có thì
  `404` làm `db-unchanged` đỏ). `tests/parity/accepted-differences.ts` thêm entry `D-32` (`DELETE /collections/directus_*`,
  app mới `403`, không `removeAt`); `accepted-differences.test.ts` và `spec-differences.ts` nhận D-32 từ bảng của spec 006.
- [X] T027 [US1] Chạy `parity --vendor=postgres` suite `full` (T020, T021 và toàn bộ 001 đến 005), `--vendor=mysql`,
  `sqlite3` suite `reduced`; sửa lệch; ca fail trên chính Directus ở một vendor → `it.skipIf(vendor)` kèm ghi chú tên ca
  (Assumptions). Ghi số ca và thời gian vào "Ghi chú khi làm". (sau T024, T025, T026)

**Checkpoint**: US1 xanh ở ba vendor; `db-unchanged`, `readonly-account` xanh với hai request mới.

---

## Phase 4: User Story 2 - Quan hệ và alias field (Priority: P1)

**Goal**: `/relations` giống Directus; khóa ngoại, metadata, dọn khi xóa trùng Directus (FR-021, FR-023, FR-030 đến
FR-032).

**Independent Test**: `parity --vendor=postgres` với `src/schema-management/relations.test.ts`.

### Tests for User Story 2

- [X] T028 [P] [US2] `tests/parity/src/schema-management/relations.test.ts` (`ddlScenario`): m2o với mỗi `on_delete`
  (NO ACTION, SET NULL, SET DEFAULT, CASCADE, RESTRICT) và `on_update`; o2m (`one_field`); m2m qua junction như
  `CreateFieldM2M` của blackbox; m2a (`one_allowed_collections`, `one_collection_field`, không FK); translations
  (o2m tới junction có m2o `languages`); files (m2o tới `directus_files`); presentation (`special: no-data`), group và
  field con; m2o từ cột người dùng của `directus_users` tới collection người dùng; lỗi: field là khóa chính, đã có
  relation, `related_collection` lạ (`400`), kiểu cột lệch khóa chính đích và dòng mồ côi (`500`, so status và mã);
  `PATCH` đổi `on_delete` (FK tạo lại, tên `constraintName`), `PATCH` m2a chỉ meta; `DELETE` relation (FK mất, meta mất,
  không activity); xóa field m2o (relation và o2m đối diện mất), xóa field o2m (`one_field = null`); `GET /relations`
  với non-admin theo `filterForbidden`; `OPTIONS`, `HEAD`. Mỗi ca kiểm DB về bằng snapshot trước.
- [X] T029 [P] [US2] `apps/api/src/controllers/relations.controller.test.ts`: Joi `newRelationSchema` (`collection`,
  `field` bắt buộc; `on_delete` ngoài danh sách → `400`), `updateRelationSchema`, `204` khi `Forbidden`, `DELETE` →
  `204`, thứ tự route.

### Implementation for User Story 2

- [X] T030 [US2] `apps/api/src/controllers/relations.controller.ts` port từ `directus/api/src/controllers/relations.ts`;
  `app.module.ts` thêm `useCollection('directus_relations')`; `tests/parity/src/request-set.ts` thêm `GET /relations`
  (ba biến thể token). T029 xanh. Ghi manifest. (sau T016)
- [X] T031 [US2] Chạy `parity --vendor=postgres` `full`, `mysql`, `sqlite3` `reduced` (thêm `relations.test.ts` vào
  `REDUCED_FILES` nếu dưới 2 phút); sửa lệch; ghi chú. (sau T028, T030)

**Checkpoint**: US1 và US2 xanh ở ba vendor; `db-unchanged` xanh với `GET /relations`.

---

## Phase 5: User Story 4 - Snapshot, diff, apply cùng format với Directus (Priority: P2)

**Goal**: `/schema/snapshot`, `/schema/diff`, `/schema/apply` giống Directus, cùng hash (FR-040 đến FR-043).

**Independent Test**: `parity --vendor=postgres` với `src/schema-management/schema.test.ts`; blackbox `schema.test.ts`
ở US5.

### Tests and ports for User Story 4

- [X] T032 [P] [US4] Port `apps/api/src/utils/get-versioned-hash.ts`, `validate-snapshot.ts`, `validate-diff.ts` và ba
  test gốc từ `directus/api/src/utils/` (`version` của `directus/version` → `DIRECTUS_COMPAT_VERSION`, ghi
  `// Backoffice:`; `TYPES` từ `@backoffice/constants`, `DatabaseClients` từ `@backoffice/types`, `ALIAS_TYPES` từ
  `../constants.js`). Test gốc xanh với `'11.17.4'`. Ghi manifest.
- [X] T033 [P] [US4] Port `apps/api/src/utils/get-snapshot.ts` (+ test 452 dòng; `version` → `DIRECTUS_COMPAT_VERSION`,
  `getSchema` từ `../schema/get-database-schema.js`) và `get-snapshot-diff.ts` (+ test 877 dòng) từ
  `directus/api/src/utils/`. Ghi manifest.
- [X] T034 [US4] Port `apps/api/src/utils/apply-diff.ts` và `apply-diff.test.ts` (849 dòng; dùng `__utils__/schemas.ts`
  của T005) từ `directus/api/src/utils/` (`flushCaches` của T004, `getHelpers`, ba service, `transaction`, `getSchema`,
  `useLogger`). Không port `apply-snapshot.ts` (research R4). Ghi manifest. (sau T032, T033)
- [X] T035 [US4] Port `apps/api/src/services/schema.service.ts` và `schema.service.test.ts` từ
  `directus/api/src/services/schema.{ts,test.ts}`; `providers.ts` thêm factory `SchemaService`; `services/index.ts`.
  Ghi manifest. (sau T034)
- [X] T036 [P] [US4] `apps/api/src/controllers/schema.controller.test.ts` (supertest): `GET /snapshot` admin và non-admin
  (`403`); `POST /diff` và `/apply` với JSON (rỗng → `400` "No data was included in the body"), content type khác →
  `415`, multipart một file JSON (mimetype `application/json`) và YAML (mimetype khác), hai file → `400`, không file →
  `400`, YAML hỏng → `400`; `force`: `/diff?force=false` bật, `/apply?force=false` tắt; `204` khi diff rỗng và sau apply.
- [X] T037 [US4] `apps/api/src/controllers/schema.controller.ts` port từ `directus/api/src/controllers/schema.ts`
  (`schemaMultipartHandler` nguyên vẹn, chạy qua `runMiddleware`; busboy đọc `req` thô vì app Nest `bodyParser: false`;
  `readableStreamToString` từ `@backoffice/utils/node`; `js-yaml` `load`; `parseJSON`, `toBoolean` của
  `@backoffice/utils`); `app.module.ts` đăng ký (không `useCollection`); `tests/parity/src/request-set.ts` thêm
  `GET /schema/snapshot` (ba biến thể token). T036 xanh. Ghi manifest. (sau T035)
- [X] T038 [US4] `tests/parity/src/schema-management/schema.test.ts` (parity, cặp chính, gửi `Cache-Control: no-store`):
  trên mô hình của `schema/fixture.ts` (002): `GET /schema/snapshot` JSON trùng từng byte hai app, `?export=yaml` nội
  dung sau parse bằng JSON và đo byte (ghi kết quả; lệch thì ghi khác biệt và hỏi chủ dự án); `POST /schema/diff` với
  snapshot của app kia → `204`; sửa mô hình ở một app rồi `diff` ở cả hai → cùng `{hash, diff}`; `apply` ở app kia →
  `204` và snapshot trùng; `apply` với hash cũ → `400` message của `validateApplyDiff` (từng loại: tạo đã có, xóa không
  có, systemField kind sai, path sai, hash lệch); `apply` tạo collection có khóa chính `varchar(36)` → `uuid`; `apply`
  xóa collection có dữ liệu; snapshot sai `version`, `directus` 11.16.0, `vendor` sai (có và không `force`); multipart
  YAML và JSON; non-admin `403`; `systemFields` bật index `directus_users.email` rồi tắt; `DB_EXCLUDE_TABLES` không kiểm
  (ghi chú). (sau T037)

**Checkpoint**: `api:test` xanh với 7 util và `SchemaService`; `parity` Postgres `full` xanh; `db-unchanged` xanh với
`GET /schema/snapshot`.

---

## Phase 6: User Story 3 - Data model dùng chéo giữa hai app (Priority: P1, sau US4 vì cần `/schema/snapshot`)

**Goal**: Mô hình dựng ở app này dùng được ở app kia; thay đổi ở app mới thấy ngay ở Directus (FR-043, FR-050, FR-051,
FR-062, FR-063; SC-004, SC-005).

**Independent Test**: `parity --vendor=postgres` với `cross-use.test.ts`, `sync-api.test.ts` (profile `multi`);
Playwright `data-model.spec.ts`.

### Tests for User Story 3

- [X] T039 [US3] `tests/parity/src/schema/fixture.ts` (002): `createFixture(vendor, app = 'directus')` dùng
  `appRequest(app, ...)`; thêm folder (`parity_overview_folder` với `parity_overview_types` đặt `meta.group`), m2a
  (`parity_overview_blocks` + junction `one_allowed_collections`), presentation (divider), group (`detail-group` có
  field con), geometry (`geometry.Point`), `archive_field`, `archive_value`, `unarchive_value`, `sort_field` cho
  `parity_overview_types`; `dropFixture` dọn theo thứ tự ngược. Test của 002 (`overview.test.ts`, `sync.test.ts`) vẫn
  xanh với mặc định `directus`.
- [X] T040 [P] [US3] `tests/parity/src/schema-management/cross-use.test.ts`: mỗi chiều (A → B): `createFixture(vendor, A)`;
  `GET /schema/snapshot` hai app (`no-store`) bằng nhau; `POST /schema/diff` ở B → `204`; CRUD item lồng qua `/items`
  của B (m2m, translations, m2a; `files` chỉ đọc relation vì `/files` thuộc 007); xóa field archive và sort ở B →
  `directus_collections.archive_field`, `sort_field` về `null` (US3.5); xóa mô hình ở B; `snapshot(db)` bằng trước.
  Chạy cả hai chiều (`directus → backoffice`, `backoffice → directus`). (sau T039)
- [X] T041 [P] [US3] `tests/parity/src/schema-management/sync-api.test.ts` (`describe.runIf(BACKOFFICE_URL_2)`, mẫu
  `backofficeFollows` của `schema/sync.test.ts` nhưng ngược chiều): thêm field, đổi kiểu, xóa field, tạo collection và
  relation, xóa, `POST /schema/apply` ở app mới → `oasComponent` của Directus và Backoffice-2 thấy trong 1 giây, in
  `[SC-005]`; ca response cache: `GET /fields/<c>` ở Directus không header hai lần (`x-cache-status` `MISS` rồi `HIT`),
  `PATCH /fields/<c>/<f>` ở app mới, `GET` kế tiếp ở Directus `MISS` với dữ liệu mới (cặp chính
  `CACHE_AUTO_PURGE=true`). Sửa comment `tests/parity/src/schema/clear-system-cache.ts` (006 đã có route).
- [X] T042 [P] [US3] `tests/parity/src/items/bus.test.ts` (005) thêm chuỗi thao tác `POST /collections`,
  `POST /fields/:c`, `PATCH /fields/:c/:f`, `POST /relations`, `PATCH /relations/:c/:f`, `DELETE /relations/:c/:f`,
  `DELETE /fields/:c/:f`, `DELETE /collections/:c` ở cặp `websocket`, so chuỗi thông điệp `websocket.event` hai app
  (`collections.*`, `fields.*`, `relations.*`; FR-051); ở cặp chính kiểm 0 thông điệp.
- [X] T043 [P] [US3] `tests/directus-app-e2e/src/data-model.spec.ts` (`bothRuns`, contracts/parity.md §5): Data Model
  tạo collection, field string, dropdown, m2o tới `directus_users`, translations qua wizard, group, divider, kéo thả
  thứ tự field (`PATCH /fields/:c` mảng), xóa field, xóa collection; Content tạo item có bản dịch; cài đặt
  `archive_field` rồi lọc archive; so `changesSince` và so `GET /schema/snapshot` trực tiếp Directus (8155) với qua
  proxy (bỏ collection của lượt kia). `routing.spec.ts` thêm khẳng định `collections`, `fields`, `relations`, `schema`
  tới app mới.
- [X] T044 [US3] Chạy `env-up` với profile `multi`, `app`, `websocket`; `parity` Postgres `full`, `parity-cache` (bus),
  `directus-app-e2e:e2e`; sửa lệch; ghi số đo SC-005. (sau T040 đến T043)

**Checkpoint**: Hai chiều dùng chéo xanh; SC-005 ≤ 1 giây; E2E xanh.

---

## Phase 7: User Story 5 - Bộ blackbox data model của Directus chạy qua trên app mới (Priority: P2)

**Goal**: 8 file blackbox và phần hoãn của `common.test.ts` đạt ở cả hai app; cờ chọn app seed (FR-061, FR-064).

**Independent Test**: `parity-blackbox --vendor=postgres` hai lượt với 5 profile; `reduced` + blackbox `integer` ở MySQL,
SQLite.

- [X] T045 [US5] Shim `tests/parity/src/items/blackbox/common/config.ts`: `getUrl(vendor, overrideEnv)` nhận
  `overrideEnv[vendor].URL` → trả nó; `overrideEnv[vendor].TZ` → URL app đang thử của cặp `tz-asia` (`Asia/Seoul`) hoặc
  `tz-america` (`America/Sao_Paulo`), giá trị khác → ném lỗi nêu hai giá trị cho phép; thêm `nodeUrl(profile, n)` (`n = 1`
  app đang thử, `n = 2` app kia); `getSetupUrl()` đọc `PARITY_BLACKBOX_SETUP_APP` (`directus` mặc định, `backoffice`);
  `functions.ts`: `DisableTestCachingSetup` giữ nguyên, comment ghi `TEST_NO_CACHE` bị bỏ qua (research R7). Test
  `config.test.ts` cho ánh xạ (vitest unit trong `tests/parity`).
- [X] T046 [P] [US5] Port `tests/parity/src/items/blackbox/tests/db/routes/collections/crud.test.ts` từ
  `directus/tests/blackbox/tests/db/routes/collections/crud.test.ts`: bỏ các khẳng định `tests_extensions_log` ("Verify
  ... action hook run", `// Backoffice: extension test, D-17`); GraphQL giữ (về Directus qua shim). Ghi manifest.
  (sau T045)
- [X] T047 [P] [US5] Port `routes/collections/schema-cache.test.ts`: thay `spawn`, `env1`, `env2` bằng
  `{ [vendor]: { URL: nodeUrl('schema-cache', 1) } }`, `nodeUrl('schema-cache', 2)` và `schema-cache-nomsg` cho khối
  không messenger; `describe.skipIf` khi vắng `DIRECTUS_URL_SCHEMA_CACHE`; giữ khẳng định gốc. Ghi manifest. (sau T045)
- [X] T048 [P] [US5] Port `routes/fields/crud.{test,seed}.ts` (bỏ khẳng định `tests_extensions_log` và `sleep(1000)`) và
  `routes/fields/change-fields.{test,seed}.ts` (nguyên). Ghi manifest. (sau T045)
- [X] T049 [P] [US5] Port `routes/schema/schema.{test,seed}.ts`: `version` của `api/package.json` → hằng `'35.2.0'` với
  `// Backoffice:` (chỉ dùng ở ca `403`), type `Snapshot` từ `@backoffice/types`; `.attach('file')` multipart giữ. Ghi
  manifest. (sau T045)
- [X] T050 [P] [US5] Port `schema/timezone/timezone.{test,seed}.ts`, `timezone-changed-node-tz-asia.{test,seed}.ts`,
  `timezone-changed-node-tz-america.{test,seed}.ts`: `getUrl(vendor, env)` giữ nguyên (shim ánh xạ `TZ`);
  `describe.skipIf` khi vắng `DIRECTUS_URL_TZ_ASIA`/`_TZ_AMERICA`. Ghi manifest. (sau T045)
- [X] T051 [P] [US5] `tests/parity/src/permissions/blackbox-common.test.ts` (004) thêm phần `createCollection()`,
  `createField()`, `createFieldM2O()`, `createFieldO2M()`, `deleteField()` (bốn ca), `deleteCollection()` của
  `directus/tests/blackbox/common/common.test.ts` chạy với fixture riêng theo app (sửa comment "thuộc 006").
- [X] T052 [US5] `tests/parity/src/items/blackbox/00-seed.test.ts`: gọi `seedDBStructure()` của các seed mới; xóa
  collection của 006 (`test_*` của từng seed) ở đầu mỗi lượt; `sequencer.ts` nếu cần thứ tự (schema seed trước test).
  (sau T046 đến T050)
- [ ] T053 [US5] CI: `.github/workflows/ci.yml` job `parity-blackbox` `env-up --profiles=blackbox,schema-cache,
  schema-cache-nomsg,tz-asia,tz-america`; job `parity` MySQL, SQLite giữ `PARITY_BLACKBOX_PK_TYPES=integer` (bốn file
  mới tự bỏ qua); `.github/workflows/parity-matrix.yml` job `blackbox-full` thêm profile và thêm lượt
  `PARITY_BLACKBOX_SETUP_APP=backoffice` (FR-064); `tools/ci-local.sh` bước `parity-blackbox` thêm profile. Chạy
  `parity-blackbox --vendor=postgres` hai lượt và `--vendor=mysql`, `sqlite3` rút gọn; ca fail trên chính Directus →
  `it.skipIf` kèm ghi chú; ghi thời gian mỗi lượt. (sau T052)

**Checkpoint**: Bộ blackbox 005 + 006 xanh hai lượt ở Postgres; rút gọn xanh ở MySQL, SQLite; `blackbox-full` bấm tay
xanh với `PARITY_BLACKBOX_SETUP_APP=backoffice`.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T054 [P] Benchmark (research R10, contracts/parity.md §6): `tests/benchmark/src/seed-schema.ts` (200 collection ×
  15 field + m2o, 100 alias o2m, policy user đọc 50 collection một phần, qua API Directus), `tests/benchmark/src/schema.ts`
  (năm kịch bản × admin, user × tươi, `HIT`; `POST /schema/diff` chỉ admin tươi), target `benchmark:schema` trong
  `tests/benchmark/project.json`, job `benchmark-schema` trong `.github/workflows/benchmark.yml` (hằng tuần, bấm tay).
  Chạy một lần, ghi kết quả và thời gian seed vào "Ghi chú khi làm"; quá 15 phút thì giảm quy mô và ghi vào Assumptions
  của spec.
- [X] T055 [P] `tests/parity/README.md` thêm mục "Test data model (006)" (suite, profile, cờ `PARITY_BLACKBOX_SETUP_APP`,
  cách chạy DDL nối tiếp); comment `getSetupUrl` của shim và `profile-blackbox.env` sửa theo; kiểm `quickstart.md`
  chạy đúng từng dòng.
- [X] T056 [P] Spec cũ: `specs/001-platform-foundation/spec.md` dòng D-09.4 ghi "Gỡ ở 006"; `specs/004-permissions/spec.md`
  và `specs/005-items/spec.md` Assumptions về seed qua API Directus ghi "từ 006 chọn được app bằng
  `PARITY_BLACKBOX_SETUP_APP`"; `SPECKIT-GUIDE.md` bảng lộ trình nếu có cột trạng thái.
- [X] T057 Constitution 1.4.0 (đã làm ngày 2026-10-12 theo `/speckit.analyze` C1, trước implement): Nguyên tắc II
  cho phép cột người dùng trong collection hệ thống và index trên cột hệ thống qua API như Directus, cấm đổi cột gốc,
  xóa bảng hệ thống và migration; Sync Impact Report ghi lý do (Clarifications 006, D-32);
  `.specify/templates/plan-template.md` dòng II và phiên bản; `SPECKIT-GUIDE.md` mục II. Chủ dự án xác nhận (quy trình
  không PR).
- [ ] T058 Đóng feature: chạy `parity-matrix.yml` (bốn shard), `blackbox-full` (MySQL, SQLite, cả hai `SETUP_APP`) và
  `nightly.yml` bấm tay (`workflow_dispatch`, 8 vendor; ca fail trên chính Directus ở vendor nào thì `it.skipIf` kèm ghi
  chú) xanh; coverage `apps/api` ≥ 80%; xóa entry `D-09.4` khỏi `tests/parity/accepted-differences.ts`; spec 006 `Status:
  Done`, dòng "Duyệt khác biệt" (D-09.4 gỡ, D-32, R-11, constitution 1.4.0); `graphify update .`; cập nhật
  `CLAUDE.md` mục Recent Changes. (sau T053 đến T057)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: không phụ thuộc; T007 sau T006; T010 (đo D-32) chỉ cần Docker.
- **Phase 2 (Foundational)**: sau T001 đến T005; T014 sau T011, T012, T013; T015 sau T014 và T010; T016 sau T015; T017 độc lập.
  CHẶN mọi story.
- **Phase 3 (US1)**: sau Phase 2. T021 sau T018, T019; T024, T025 sau T016; T027 cuối.
- **Phase 4 (US2)**: sau Phase 2 (độc lập với US1 về code, nhưng `ddlScenario` của T019 cần có); T031 cuối.
- **Phase 5 (US4)**: sau Phase 2; T034 sau T032, T033; T035 sau T034; T037 sau T035; T038 sau T037 và sau US1, US2 (dùng
  fixture 002 qua API, cần `/collections`, `/fields`, `/relations` ở app mới cho chiều ngược).
- **Phase 6 (US3)**: sau US1, US2, US4. T040 sau T039; T044 cuối.
- **Phase 7 (US5)**: sau US1, US2, US4 (blackbox `schema.test.ts`); T046 đến T050 sau T045; T052 sau T046 đến T050; T053
  sau T052.
- **Phase 8 (Polish)**: T054 đến T057 song song sau US3; T058 sau tất cả.

### Within Each User Story

- Test đối chiếu và test controller viết trước, đỏ, rồi controller.
- Test gốc port trước, đỏ, rồi code (T011 đến T015, T032 đến T035).
- Mỗi story kết thúc bằng một lượt `parity` đủ ở Postgres và rút gọn ở MySQL, SQLite.

### Parallel Opportunities

- Phase 1: T002 đến T006, T008, T009, T010 song song sau T001.
- Phase 2: T011, T012, T013 song song; T017 song song với cả phase.
- US1: T018, T019, T020, T022, T023 song song; T024, T025 song song.
- US2: T028, T029 song song; US2 có thể chạy song song với US1 sau T019.
- US4: T032, T033 song song; T036 song song với T034, T035.
- US3: T040 đến T043 song song sau T039.
- US5: T046 đến T051 song song sau T045.
- Polish: T054 đến T057 song song.

---

## Parallel Example: User Story 1

```bash
# Test và công cụ viết trước, song song:
Task: "ddl-capture.ts và đo index ba vendor (T018)"
Task: "ddl-scenario.ts và normalizer meta.id (T019)"
Task: "crud.test.ts (T020)"
Task: "collections.controller.test.ts (T022)"
Task: "fields.controller.test.ts (T023)"

# Rồi hai controller song song:
Task: "collections.controller.ts (T024)"
Task: "fields.controller.ts (T025)"
```

## Parallel Example: User Story 5

```bash
# Sau shim T045, sáu file port song song:
Task: "collections/crud.test.ts (T046)"
Task: "collections/schema-cache.test.ts (T047)"
Task: "fields/crud + change-fields (T048)"
Task: "schema/schema (T049)"
Task: "timezone ×3 (T050)"
Task: "blackbox-common phần data model (T051)"
```

---

## Implementation Strategy

### MVP (Phase 1 đến 4)

1. Phase 1, 2: thư viện, type, ba service với test gốc xanh, factory, `OPTIONS`.
2. US1: `/collections`, `/fields`; DDL và metadata so bằng Directus trên ba vendor; D-32 đo.
3. US2: `/relations`; năm loại quan hệ và alias.
4. **DỪNG và kiểm**: `parity` Postgres `full`, MySQL và SQLite `reduced` xanh; app Directus qua proxy dựng được
   collection, field, quan hệ (kiểm tay theo quickstart §2).

### Phần còn lại (Phase 5 đến 8)

1. US4: snapshot, diff, apply; `schema.test.ts` đối chiếu.
2. US3: dùng chéo hai chiều, xóa cache qua API, bus, E2E.
3. US5: blackbox 8 file, bốn cặp profile, cờ `SETUP_APP`, CI.
4. Polish: benchmark, README, spec cũ, constitution 1.4.0, đóng feature.

---

## Notes

- [P] = khác file, không phụ thuộc task chưa xong.
- [US#] để truy vết task về story.
- Mỗi story kiểm độc lập được bằng suite của nó; commit sau mỗi task hoặc nhóm task; dừng ở checkpoint để kiểm.
- D-32 và R-11 là hai điểm duy nhất app mới không làm hoặc làm y hệt hành vi không an toàn của Directus; mọi chỗ khác
  tái tạo.
- Tránh: task mơ hồ, hai task cùng sửa một file song song, phụ thuộc chéo story làm mất tính độc lập.

## Ghi chú khi làm

- T001: `pnpm audit --prod --audit-level=high` exit 0; không advisory nào cho `deep-diff`, `busboy`, `zod`.
- T005: `apps/api/src/__utils__/schemas.ts` đổi `as CollectionsOverview` thành `as unknown as CollectionsOverview`
  (`// Backoffice:`): Directus không typecheck `src/__utils__` (`tsconfig.prod.json`), fixture thiếu `searchable`.
  `test-utils/**`, `__utils__/**` loại khỏi coverage.
- T007: cặp `schema-cache-nomsg` đặt thêm `RATE_LIMITER_STORE=memory` vì `REDIS_ENABLED=false`; `SYNCHRONIZATION_STORE`
  chưa có trong nhóm A của app mới (chỉ cảnh báo khi khởi động, như mọi biến chưa hỗ trợ).
- T011 đến T015: test gốc của Directus không được typecheck ở Directus (`tsconfig.prod.json` loại `*.test.ts`); hai file
  không qua cờ strict (`fields.service.test.ts`, `sanitize-schema.test.ts`: fixture thiếu `searchable`) nằm trong
  `exclude` của `apps/api/tsconfig.json`, vitest vẫn chạy. `PATCH /relations` của Directus đọc `collection`,
  `related_collection` từ body ở `alterType`: body thiếu chúng ném `TypeError` (500), app Directus luôn gửi đủ; ca ở
  `relations.service.test.ts`. Controller `/relations` có `validateCollection` ở `GET /:c`, `GET /:c/:f`, `PATCH`,
  `DELETE` (contracts/schema-api.md §1 sửa theo).
- T017: `OPTIONS` đo trên Directus 11.17.4 khớp contracts/schema-api.md §3; `/schema`, `/schema/x` → 404.
- Checkpoint Phase 2: `api:test` 212 file, 2.365 test xanh, coverage 85,1%; typecheck, lint xanh (cảnh báo
  `database/index.ts:186` có từ trước).
- T018: `ddl-capture` đọc đúng unique, index, khóa ngoại trên Postgres (`[T018] postgres indexes`); MySQL, SQLite đo
  khi chạy bộ đủ của hai vendor (T027).
- T019, T021, T028: `ddlScenario` lọc khác biệt đã chấp nhận như `parity()` (D-01 `X-Powered-By`); `D-09.4` chuyển
  thành entry `doc` vì entry `http` với `location: { any: true }` che mọi response của bốn route. Sắp lại danh sách
  `/fields`, `/relations` vì `readAll` không `ORDER BY` (thứ tự vật lý khác giữa hai lượt nối tiếp).
  `cleanupTables` lặp nhiều lượt: bảng còn bị khóa ngoại trỏ tới thì `DROP TABLE` bị chặn.
- T021 (phát hiện, ghi Edge Cases của spec): xóa collection khi bảng khác còn khóa ngoại trỏ tới → Postgres chặn
  `DROP TABLE`, Directus `500`, không dọn gì; app mới y hệt.
- T024 (thay đổi so với plan): `GET /collections?meta=*` không có `meta` vì controller gọi
  `getMetaForQuery('directus_collections', {})`, như Directus.
- T038: snapshot JSON và YAML trùng từng byte trên Postgres (`[T038] postgres YAML snapshot bytes equal: true`).
- T041: SC-005 đo 30 đến 41 ms (ngưỡng 1 giây) cho thêm, đổi, xóa field, tạo collection, relation, apply.
- T042: bus giống nhau sau khi chuẩn hóa id tự tăng của `directus_fields`, `directus_relations` (key, `item`, `data.id`
  của revision, `key` trong payload action của relation).
- T043: `data-model.spec.ts` đạt (57 giây hai lượt); app lưu field rồi mới tạo relation, collection phụ, nên spec đợi
  app tự đóng drawer. `routing.spec.ts` không sửa: đọc `backoffice-routes.txt`, đã thấy `/collections`, `/fields`,
  `/relations` tới app mới.
- T051 (thay đổi so với plan): phần data model của `common.test.ts` port vào cây blackbox
  (`items/blackbox/common/common.test.ts`), dùng helper của shim như bản gốc, thay vì `permissions/blackbox-common.test.ts`.
- `tests/parity`: `js-yaml` thêm vào devDependencies (đọc YAML của snapshot).
- T010 (2026-10-12): Directus 11.17.4 SQLite dựng riêng (`docker run`, xóa sau khi đo): `DELETE
  /collections/directus_notifications` bằng admin → `204`, bảng mất khỏi `sqlite_master`, `directus_fields` của nó
  về 0 → D-32 giữ, T015 thêm `if`. `PATCH /collections/directus_users` `{meta: {note}}` → `200`, `GET /collections` có
  hai entry `directus_users` → R-11 xác nhận.
- T027, T031 (2026-10-12): `src/schema-management` xanh ở Postgres, MySQL (chạy local) và SQLite (71 ca đạt, 5 bỏ qua:
  `sync-api` cần profile `schema-cache`; ddl 9,6 s, cross-use 8,3 s, relations 8,5 s, schema 7,1 s, crud 5,2 s,
  ddl-capture 0,8 s). `relations.test.ts` thêm vào `REDUCED_FILES`. Khác theo vendor, cả hai app như nhau: MySQL ghi tên
  bảng tạm `#sql-…` vào thông báo lỗi, SQLite ghi `_knex_temp_alterN` (cả hai được chuẩn hóa); SQLite có
  `constraint_name: null` và cho `DROP TABLE` khi còn khóa ngoại trỏ tới (`204`, Postgres `500`); MySQL đọc lại cột
  uuid tạo bởi apply là `varchar` (target ghi `char`) nên diff sau apply không rỗng, test so model của hai app sau
  apply thay vì so với target. R-12 (SQLite): xóa field m2o treo tới hết pool ở cả hai app, ca này bỏ qua trên SQLite.
  CI SQLite: `data.db` do container (uid 1000) tạo với quyền 0644, runner không ghi được (`SQLITE_READONLY` ở blackbox
  `collections/crud`, `fields/crud`); `env.mjs` chạy `chmod 666` trong container sau `env-up`.

- T044 (2026-10-12): CI run 38241190044 ở `5b1f945` xanh mọi job: `parity` Postgres `full` hai shard (9, 11 phút, gồm
  profile `multi`), `parity-cache` (7 phút, bus), `e2e-directus-app` (7 phút, profile `app`, gồm `data-model.spec.ts`);
  SC-005 xem T041.
- T053: cùng run, `parity-blackbox` lượt Directus 15 phút, lượt app mới 11 phút; `parity` MySQL rút gọn 11 phút, SQLite
  rút gọn 7 phút (sau khi sửa quyền `data.db`).
- T054 lần đầu (run 38241267853, 200 collection, seed 76 s, 3.098 field, 199 relation): snapshot 2,5 MB vượt
  `MAX_PAYLOAD_SIZE` mặc định 1 MB, `POST /schema/diff` trả `400` ở cả hai app (đo local); `GET /schema/snapshot`,
  `GET /fields` tươi với 50 kết nối xếp hàng quá timeout 10 giây ở cả hai app (local: Directus không trả response nào
  trong 5 giây, app mới p50 4 giây). Chỉnh: 60 collection (928 field, 59 relation, seed 18 s local), snapshot và diff
  5 kết nối. `benchmark-items` (feature 005) cùng run lệch một dòng 10,6% (user, cached); các dòng khác đạt.
- T053 `blackbox-full` (run 38242839809): lượt `SETUP_APP=directus` xanh ở MySQL, SQLite; lượt `SETUP_APP=backoffice`
  463 ca đỏ ở cả hai vendor vì `requestGraphQL` gửi tới `getSetupUrl()` (app mới chưa có GraphQL, `404`); sửa thành
  `getDirectusUrl()`, chạy lại local SQLite (seed bằng app mới, 3 file): 150 ca đạt.
- T058 nightly lần đầu (run 38241348869, 8 vendor đỏ): file 006 xanh ở SQLite; ở vendor khác đỏ vì (1) dây chuyền
  của môi trường: Redis mất kết nối giữa bộ (Directus `MaxRetriesPerRequestError`, login `500`), `cross-use` và các
  file sau đó đỏ ở mọi vendor; (2) MariaDB ghi bảng tạm `#sql-alter-1-c` (normalizer sửa); (3) MSSQL tự đặt tên PK
  `PK__<bảng>__<16 hex ngẫu nhiên>` (`captureModel` chuẩn hóa); (4) CockroachDB: Directus `500` khi đổi kiểu cột trong
  transaction (ca diff, apply bỏ qua); (5) Oracle: harness đăng nhập DB sai (`ORA-01017`). MySQL 5.7: Directus không
  cài được (`ER_INVALID_DEFAULT` ở migration `uploaded_on`). File của 001 đến 005 đỏ ở mọi vendor trừ SQLite
  (`auth/providers`, `observability/metrics`, `redis-down`, `db-unchanged`, `startup/*`, `permissions/*`).
- T058 hướng C (chủ dự án chọn 2026-10-12): sửa môi trường để file 006 chạy sạch ở mọi vendor, lỗi của 001 đến 005
  ghi lại cho đợt parity đủ vendor. Gốc dây chuyền Redis: `redis-down.test.ts` dừng Redis rồi `hostDbEnv` ném lỗi
  (vendor chưa hỗ trợ), `afterAll` gọi `stopApi(undefined)` và không bật lại Redis; sửa: `hostDbEnv` trước khi dừng,
  `afterAll` luôn bật lại. Oracle: harness nối `XE`, hai app nối `XEPDB1` (`env/oracle.env`); sửa sang `XEPDB1`.
  MySQL 5.7 bỏ khỏi ma trận nightly (Directus không khởi động). `blackbox-full` lượt seed bằng app mới: còn 1 ca
  (`case-when`, `/comments` của feature 008 gửi qua `getSetupUrl()`), sửa sang `getDirectusUrl()`.
  `benchmark-schema` xanh ở run 38249657090 (60 collection); `benchmark-auth` (feature 003) lệch một dòng
  (`POST /auth/refresh` p95 1.339 so với 925 ms), run trước xanh.
(Điền khi thực hiện: kết quả audit T001, helper thiếu T015, `Allow` thật T017, kết quả đo index T018, bằng chứng D-32
T010, số ca và thời gian T027, T031, T044, T053, byte YAML T038, số đo SC-005 T044, kết quả benchmark T054.)
