---

description: "Danh sách task cho feature 005: Items (CRUD /items, response cache, export, event, bus websocket.event)"
---

# Tasks: Items (CRUD `/items`, response cache, export, event, bus `websocket.event`)

**Input**: Tài liệu thiết kế trong `/specs/005-items/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md`, `data-model.md`, `contracts/`, `quickstart.md`,
`checklists/items-review.md`.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test. Test gốc của Directus đi kèm file port thì port theo (research R13).
- Mọi endpoint thêm hoặc sửa có test đối chiếu chạy với cả Directus 11.17.4 thật lẫn app mới (research R9); `/items`
  thêm bộ blackbox port chạy hai lượt theo app (research R6).

**Organization**: Task nhóm theo user story của spec. Phase 1 và 2 là nền chung: thư viện, env, profile, bộ so sánh,
`respond(req, res)`, `collectionExists`. Thứ tự story theo research R14: US1 (route) → US2 (blackbox) → US4 (export)
→ US3 (cache) → US5 (event, bus) → US6 (E2E) → Polish. US4 đứng trước US3 vì cùng ưu tiên P2 và `respond` nhận nhánh
export trước, nhánh cache sau (cùng một file, hai bước).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task. Phase 1, 2 và Polish không có nhãn này.
- File port từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn nguồn>`. Mỗi task port ghi các cặp
  `{ "source", "dest" }` (source tính từ `directus/`) vào `tools/port-manifest/005-T###.json`, theo đúng ID task.
  Chạy `node tools/check-port-headers.mjs` sau khi ghi. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Port nguyên vẹn: giữ tên biến, thứ tự câu lệnh, message của Directus. Chỗ khác nguồn ghi `// Backoffice: <lý do>`.
  Giới hạn tạm ghi `// ponytail: <giới hạn>, <khi nào nâng>`.
- **Không sửa service nào**: mọi lời gọi `emitter.emitFilter`, `emitAction` và `shouldClearCache` đã có từ 004; feature
  này chỉ thay `emitter.ts` bằng bản thật.
- **Luôn tái tạo hành vi Directus**, kể cả hành vi không an toàn (R-07 đến R-10, Clarifications). Phát hiện hành vi
  không an toàn mới thì thêm dòng R-xx vào spec kèm bằng chứng và một ca thể hiện; không tự lệch.
- Không đọc `useEnv()` ở cấp module (quy ước 001). Biến Directus mới đọc thì chuyển sang nhóm A trong cùng task.
- Tên biến, comment, commit viết tiếng Anh. Tài liệu viết tiếng Việt.
- Test viết trước và phải fail trước khi làm phần tương ứng (với file port: test gốc port trước, chạy đỏ, rồi port code).
- Quy trình merge thẳng `main`: mỗi nhóm task commit và push xong thì CI phải xanh; `pnpm run ci:local` khi Actions bị
  chặn.

## Quy ước đường dẫn

- API: `apps/api/src/**`. Catalog: `pnpm-workspace.yaml`.
- Test đối chiếu: `tests/parity/src/**` (mới: `tests/parity/src/items/**`, bộ blackbox port ở
  `tests/parity/src/items/blackbox/**`). Danh sách khác biệt: `tests/parity/accepted-differences.ts`. Profile và env:
  `tests/parity/docker-compose.yml`, `tests/parity/env/**`.
- E2E app Directus: `tests/directus-app-e2e/**`. Reverse proxy: `tests/parity/proxy/**`.
- Benchmark: `tests/benchmark/**`. Công cụ: `tools/**`. CI: `.github/workflows/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/packages/*`, `directus/tests/blackbox/**`.

## Tóm tắt

- Tổng số task: **54**
- Số task đánh dấu [P]: **29**
- Một lượt implement (dưới ngưỡng 60 của research R14), có checkpoint sau mỗi phase; FR-047 (chạy lại 001 đến 004)
  chạy sau Phase 6 (cache) và lần cuối ở Polish.
- MVP gợi ý: **Phase 1 đến 4** (US1, US2): `/items` đầy đủ với bộ blackbox items, query, relational qua ở cả hai app.
  Feature chưa đóng được khi chưa xong US3, US4, US5 (gỡ D-11, D-12, D-30).

| Phase | Số task |
|-------|---------|
| 1 Setup | 7 |
| 2 Foundational | 2 |
| 3 US1 `/items` | 6 |
| 4 US2 blackbox | 7 |
| 5 US4 export | 6 |
| 6 US3 cache | 10 |
| 7 US5 event, bus | 7 |
| 8 US6 E2E | 2 |
| 9 Polish | 7 |

---

## Phase 1: Setup (phụ thuộc, env, profile, bộ so sánh)

**Purpose**: Thêm thư viện cùng bản Directus, chuyển bảy biến sang nhóm A, dựng năm cặp profile và sửa bộ so sánh cho
cache dùng chung (Clarifications, research R1, R4, R5).

- [X] T001 Thêm vào `catalog:` của `pnpm-workspace.yaml` đúng bản `directus/pnpm-workspace.yaml`: `json2csv: 5.0.7`,
  `'@types/json2csv': 5.0.7`, `js2xmlparser: 5.0.0`, `eventemitter2: 6.4.9`, `json-to-graphql-query: 2.3.0`,
  `seedrandom: 3.0.5`, `'@types/seedrandom': 3.0.8`. `apps/api/package.json`: `json2csv`, `js2xmlparser`, `js-yaml`,
  `eventemitter2` (types vào devDependencies). `tests/parity/package.json`: `supertest`, `@types/supertest`,
  `json-to-graphql-query`, `seedrandom`, `@types/seedrandom`. Chạy `pnpm install`, `pnpm audit --prod
  --audit-level=high`; ghi kết quả audit vào "Ghi chú khi làm" (research R1).
- [X] T002 [P] `apps/api/src/config/supported-variables.ts`: chuyển sang nhóm A theo contracts/config.md §1
  (`CACHE_STATUS_HEADER`, `CACHE_VALUE_MAX_SIZE`, `CACHE_SKIP_ALLOWED`, `CACHE_CONTROL_S_MAXAGE`, `WEBSOCKETS_ENABLED`,
  `WEBSOCKETS_REST_ENABLED`, `WEBSOCKETS_GRAPHQL_ENABLED`) với comment `// Feature 005`. Sửa
  `apps/api/src/config/supported-variables.test.ts` (bảy biến không còn cảnh báo; `WEBSOCKETS_REST_AUTH` vẫn cảnh báo)
  và §5 của `specs/001-platform-foundation/contracts/config.md`.
- [X] T003 [P] Env profile của môi trường đối chiếu (contracts/config.md §3; env của cặp chính đổi ở T037): tạo
  `tests/parity/env/profile-cache-mem.env`, `profile-cache-mem-purge.env`, `profile-cache-redis.env`,
  `profile-cache-redis-purge.env` (research R5: `CACHE_ENABLED=true`, `CACHE_STORE`, `CACHE_AUTO_PURGE`,
  `CACHE_STATUS_HEADER=x-cache-status`, `CACHE_SKIP_ALLOWED=false` (ghi đè `true` của env vendor từ T037),
  `CACHE_NAMESPACE`, `REDIS_BUS_NAMESPACE`, `REDIS_LOCK_NAMESPACE`,
  `REDIS_PERMISSIONS_NAMESPACE` riêng, `CACHE_AUTO_PURGE_IGNORE_LIST=directus_activity,directus_presets,test_cache_ignored`,
  `cache-redis` thêm `CACHE_VALUE_MAX_SIZE=1kb`, `REDIS` trỏ `redis-cache`, `WEBSOCKETS_ENABLED=true`,
  `WEBSOCKETS_REST_ENABLED=true` để đo R-10) và `profile-websocket.env`
  (`WEBSOCKETS_ENABLED=true`, `WEBSOCKETS_REST_ENABLED=true`); sửa ghi chú D-11 trong `profile-cache-config.env`
  (giữ `CACHE_ENABLED=false` vì `redis-down`).
- [X] T004 `tests/parity/docker-compose.yml`: năm cặp profile `cache-mem` (9055, 9056), `cache-mem-purge` (9155, 9156),
  `cache-redis` (9255, 9256, kèm service `redis-cache` cổng host 6111 để dừng trong `redis-down`), `cache-redis-purge`
  (9355, 9356), `websocket` (9455, 9456), mẫu `cache-config`; `tests/parity/scripts/env.mjs` thêm vào `ALL_PROFILES`;
  `tests/parity/src/config.ts` `profilePorts` thêm năm dòng và `cacheRedisPort` (global-setup và profiles.ts tự nhận).
  Test trong `tests/parity/src/vendors.test.ts`: cổng không trùng, cổng của compose khớp `config.ts`, mỗi cặp có file env.
  (sau T003)
- [X] T005 [P] Bộ so sánh, phần export (contracts/parity-blackbox.md §4): `COMPARED_HEADERS` thêm `content-disposition`;
  `tests/parity/src/normalizers.ts` thay `\d{8}-\d{1,6}` trong `content-disposition` bằng `<timestamp>`; test trong
  `normalizers.test.ts`. Phần cache của bộ so sánh làm ở T037.
- [X] T006 [P] `tests/parity/src/suite.ts`: suite `blackbox` (`BLACKBOX_FILES`, chạy bằng
  `src/items/blackbox/vitest.blackbox.config.ts` của T016) và `cache` (`CACHE_FILES`:
  `src/items/{cache-blackbox,cache-cross,cache-redis-down,bus}.test.ts`); `FULL_FILES` thêm `src/items/{crud,export}.test.ts`;
  `REDUCED_FILES` thêm `src/items/crud.test.ts`; `parseSuite` nhận năm giá trị. `tests/parity/scripts/parity.mjs`:
  suite `blackbox` chạy vitest hai lượt với `PARITY_BLACKBOX_APP=backoffice` rồi `directus`, dừng ở lượt đầu lỗi;
  `tests/parity/project.json` thêm target `parity-blackbox`, `parity-cache`. Test trong `src/vendors.test.ts` (đã có
  test chọn suite).
- [X] T007 [P] `tests/parity/proxy/backoffice-routes.txt` thêm `items` (sinh lại `nginx.conf` bằng
  `scripts/proxy-conf.mjs`; `proxy-conf.test.ts` thêm ca `/items/x` về app mới, `/items` không có collection cũng về
  app mới).

**Checkpoint**: `pnpm nx run-many -t test lint typecheck` xanh; `env-up --profiles=cache-mem,...,websocket` lên đủ
mười container và `global-setup` đặt URL năm cặp.

---

## Phase 2: Foundational (`respond(req, res)`, `collectionExists`)

**Purpose**: Hai thay đổi mọi story đều cần.

- [X] T008 `apps/api/src/middleware/respond.ts`: đổi chữ ký thành `respond(req: Request, res: Response)` (giữ nội dung
  header như 004, chưa cache, chưa export; comment nêu T028, T036 thay đủ); sửa 82 chỗ gọi `respond(res)` → `respond(req,
  res)` trong `apps/api/src/controllers/{auth,server,users,roles,policies,access,permissions}.controller.ts` (grep
  `respond(res)` phải về 0); `respond.test.ts` sửa theo. Chạy `pnpm nx run api:test`, rồi `parity --vendor=postgres`
  (suite `full`) để chắc không route nào đổi hành vi (research R2).
- [X] T009 [P] Port `apps/api/src/middleware/collection-exists.ts` từ `directus/api/src/middleware/collection-exists.ts`
  (dùng `systemCollectionRows` của `@backoffice/system-data`, `createCollectionForbiddenError` của
  `permissions/modules/process-ast/utils/validate-path/create-error.ts`); test mới
  `apps/api/src/middleware/collection-exists.test.ts` (không có param; collection lạ → `403` đúng message; collection
  người dùng singleton và không; collection hệ thống lấy cờ từ `systemCollectionRows`). Ghi manifest.

**Checkpoint**: `api:test` xanh, `parity` Postgres `full` xanh với `respond` mới.

---

## Phase 3: User Story 1 - CRUD mọi collection qua `/items/:collection` giống Directus (Priority: P1) 🎯 MVP

**Goal**: Route `/items` đầy đủ trên engine 004 (contracts/items-api.md).

**Independent Test**: spec US1; `crud.test.ts` đạt ở Postgres, MySQL, SQLite.

### Tests for User Story 1

- [X] T010 [P] [US1] `tests/parity/src/items/crud.test.ts`: `scenario()` + `startFlow` của 004 trên collection tạo bằng
  `createUserCollection` (có o2m, m2o, singleton): US1.1 đến US1.7 (tạo lồng, `POST` mảng, `GET` có `filter`, `sort`,
  `fields=*.*`, `meta=*`, `SEARCH` với `body.query` và `body.keys`, `PATCH` ba dạng, `DELETE` ba dạng, singleton bốn
  route, collection lạ và hệ thống ở mọi method, `204` khi không quyền đọc, thứ tự lỗi, `OPTIONS`, `HEAD`, dấu `/` cuối,
  mảng rỗng và `{keys: []}` (CHK001), `?version=x` (CHK004), tên collection có chữ hoa (CHK006)); so response, activity,
  revision, dòng DB. Ghi kết quả đo của CHK001, CHK004, CHK006 vào spec (Edge Cases) khi xanh.
- [X] T011 [P] [US1] `apps/api/src/controllers/items.controller.test.ts`: supertest qua app Nest trên SQLite
  (`createDirectusDb()` như `roles.controller.test.ts`, tạo một bảng người dùng và một singleton bằng knex kèm dòng
  `directus_collections`, `directus_fields`): tám route, singleton (`404` của `POST` và `PATCH /:pk`, `PATCH /` upsert),
  `403` collection lạ trước `validateBatch`, `403` collection hệ thống, `204` khi đọc lại `403`, `404` cho `/items` và
  `/items/a/b/c`, `OPTIONS` hai path.
- [X] T012 [P] [US1] `tests/parity/src/request-set.ts`, `db-unchanged.test.ts`, `readonly-account.test.ts`: thêm request
  đọc của contracts/parity-blackbox.md §4 (`GET /items/<c>` ba accountability, `GET
  /items/<c>/<pk>`, `SEARCH` không body, `OPTIONS`, `/items/nope`, `/items/directus_users`) với collection tạo trước khi
  chụp DB (`createUserCollection` qua Directus).

### Implementation for User Story 1

- [X] T013 [US1] Port `apps/api/src/controllers/items.controller.ts` từ `directus/api/src/controllers/items.ts`: Nest
  `@Controller('items')`, tám handler cùng thứ tự (research R2), `collectionExists` và `validateBatch` qua
  `runMiddleware`, kiểm `isSystemCollection` trước body, singleton theo FR-003, đọc lại bằng `req.sanitizedQuery`,
  `respond(req, res)`; `apps/api/src/providers.ts` thêm factory `ItemsService` nhận `collection`; `app.module.ts` đăng
  ký controller (không `useCollection`). Ghi manifest. (sau T008, T009, T011 đỏ)
- [X] T014 [US1] `apps/api/src/middleware/router-options.ts`: hai dòng `/items` theo contracts/items-api.md §3;
  `router-options.test.ts` thêm ca. (sau T013)
- [X] T015 [US1] Sổ khác biệt: entry `D-09.3` của `tests/parity/accepted-differences.ts` đổi sang `kind: 'doc'` (không
  còn che response nào của `/items`); guard bắt mọi mã của bảng 001 phải còn tới khi 005 `Done`, nên entry xóa hẳn ở
  T054, như D-09.2 ở 004. Không thêm entry `http` cho `version` (một entry theo `INTERNAL_SERVER_ERROR` trên
  `GET /items/*` sẽ che lỗi `500` thật): ca `version` của T010 khẳng định riêng kết quả từng app (Directus `403`, app
  mới `500`, FR-004) ngoài bộ so sánh. Chạy `guard-differences` (`accepted-differences.test.ts`). (sau T010, T013)

**Checkpoint**: T010 đạt ở Postgres (`full`), MySQL và SQLite (`reduced`); T011, T012 xanh.

---

## Phase 4: User Story 2 - Bộ blackbox items, query, relational của Directus chạy qua trên app mới (Priority: P1)

**Goal**: Bộ blackbox port chạy nguyên bản hai lượt (app mới, Directus) trên ba vendor (research R6,
contracts/parity-blackbox.md §1 đến §3, §6).

**Independent Test**: `PARITY_SUITE=blackbox parity --vendor=postgres|mysql|sqlite3` xanh cả hai lượt.

- [X] T016 [US2] Harness `tests/parity/src/items/blackbox/`: `vitest.blackbox.config.ts` (root `tests/parity`, alias
  `@common`, `@utils`, `globalSetup` của parity, `fileParallelism: false`, sequencer `00-seed.test.ts` trước,
  `testTimeout` 60 s); `sequencer.ts` (rút gọn từ `setup/sequencer.ts`); shim `common/config.ts` (`getUrl` theo
  `PARITY_BLACKBOX_APP` trong cặp `blackbox`, `getSetupUrl()` là Directus của cặp, `config.envs` đọc
  `env/profile-blackbox.env`), `common/get-dbs-to-test.ts` (của parity), `common/transport.ts` (`requestGraphQL` về
  Directus, D-09.9), `common/types.ts` (bỏ type WebSocket), `common/functions.ts` (copy; hàm data model, role, user,
  policy, permission, version gọi `getSetupUrl`; `CreateItem`, `ReadItem`, `UpdateItem` gọi app đang thử). Cặp profile
  `blackbox` (9555, 9556, `env/profile-blackbox.env` chép env của `directus/tests/blackbox/common/config.ts`) trong
  `docker-compose.yml`, `scripts/env.mjs`, `src/config.ts`. `src/items/blackbox/tsconfig.json` typecheck các shim
  (bundler resolution); thư mục loại khỏi typecheck chính vì code copy không qua được cờ strict, như ở Directus.
  `known-failures.ts` chưa cần (lượt Directus trên Postgres đạt đủ). (sau T006)
- [X] T017 [P] [US2] Copy nguyên kèm header `// Ported from directus/tests/blackbox/...`: `common/seed-functions.ts`,
  `common/types.ts`, `common/variables.ts` (bỏ `DEFAULT_DB_TABLES`; `PRIMARY_KEY_TYPES` đọc `PARITY_BLACKBOX_PK_TYPES`),
  `tests/db/query/index.ts`, `tests/db/query/filter/index.ts`, `tests/db/schema/index.ts` và 18 thư mục
  `tests/db/schema/<kiểu>/index.ts` (trừ `timezone`) vào `tests/parity/src/items/blackbox/`. Ghi manifest. (sau T016)
- [X] T018 [P] [US2] Copy nguyên 11 seed `tests/db/routes/items/*.seed.ts`, `seed-all-field-types.ts`,
  `seed-relational-fields.ts` và `00-seed.test.ts` (mới: tạo qua Directus role, policy, access, user có static token cho
  `USER.ADMIN`, `APP_ACCESS`, `API_ONLY`, `NO_ROLE`, `TESTS_FLOW` nếu chưa có; xóa collection, user, policy của
  `case-when` từ lượt trước; rồi gọi `seedDBStructure()` của từng seed như `seed-database.test.ts`). `case-when.seed.ts`
  tạo collection, relation qua `getSetupUrl`; `case-when.test.ts` gọi `/comments` (008) qua `getSetupUrl`. Ghi manifest. (sau T016)
- [X] T019 [P] [US2] Copy `no-relation.test.ts`, `m2o.test.ts`, `o2m.test.ts`: bỏ 6, 4, 4 khối WebSocket
  (`createWebSocketConn`, `createWebSocketGql`, `getMessages`, `expect` trên `wsMessages*`, `conn.close`,
  `client.dispose`) mỗi chỗ một dòng `// Backoffice: WebSocket assertions removed (Principle XI, D-17)`; bỏ import
  tương ứng; giữ mọi khẳng định REST và GraphQL. Đã bỏ 328, 294, 296 dòng (25, 14, 14 chỗ) và hai ca đọc
  `tests_extensions_log` của `no-relation` (extension, D-17). Ghi manifest kèm số khối đã bỏ. (sau T016)
- [X] T020 [P] [US2] Copy nguyên `m2m.test.ts`, `m2a.test.ts`, `relational-json.test.ts`, `json-fields.test.ts`,
  `singleton.test.ts`, `case-when.test.ts`, `conceal-filter.test.ts`, `hash-filter.test.ts`. Ghi manifest. (sau T016)
- [X] T021 [US2] Chạy `PARITY_SUITE=blackbox` trên Postgres đủ ba kiểu khóa, rồi MySQL và SQLite (đủ và
  `PARITY_BLACKBOX_PK_TYPES=integer`): ca fail ở lượt `directus` ghi vào `known-failures.ts` theo vendor kèm lần chạy
  đối chứng; ca fail chỉ ở lượt `backoffice` là lỗi của app mới, sửa engine hoặc route (ghi R-xx nếu là hành vi
  Directus). Ghi thời gian mỗi lượt vào "Ghi chú khi làm". (sau T017 đến T020)
- [X] T022 [US2] CI: `.github/workflows/ci.yml` job `parity-blackbox` (Postgres, `env-up --vendor=postgres`,
  `PARITY_SUITE=blackbox`, timeout 60 phút, log container, `env-down`, vào `needs` của `publish`); job `parity` cho
  `mysql`, `sqlite3` thêm bước `PARITY_SUITE=blackbox PARITY_BLACKBOX_PK_TYPES=integer`;
  `.github/workflows/parity-matrix.yml` thêm job `blackbox-full` (matrix `mysql`, `sqlite3`, đủ ba kiểu khóa);
  `tools/ci-local.sh` thêm bước blackbox. (sau T021)

**Checkpoint**: SC-001 (Postgres đủ mỗi lần push; MySQL, SQLite rút gọn); `blackbox-full` chạy xanh một lần.

---

## Phase 5: User Story 4 - Xuất dữ liệu ra file bằng query `export` (Priority: P2)

**Goal**: `respond` trả file cho `export` trên mọi route (contracts/export.md); gỡ D-12.

**Independent Test**: spec US4; `export.test.ts` đạt.

### Tests for User Story 4

- [X] T023 [P] [US4] Port `apps/api/src/services/import-export.service.test.ts` từ
  `directus/api/src/services/import-export.test.ts` (chỉ phần `transform`; phần `exportToFile`, import bỏ với ghi chú
  010). Ghi manifest.
- [X] T024 [P] [US4] `apps/api/src/middleware/respond.test.ts`: ca export từng định dạng (header `Content-Disposition`
  với tên `<collection> <YYYYMMDD-HMS>` và `Export ...` khi không collection, `Content-Type`, body qua `transform`,
  `200` khi không payload với `json` → `null`, `csv` → ném lỗi, `Cache-Control: no-cache`, `HEAD`).
- [X] T025 [P] [US4] `tests/parity/src/items/export.test.ts`: ma trận FR-044 (5 định dạng × 12 nguồn) so status,
  `content-type`, `content-disposition` chuẩn hóa, body từng byte sau chuẩn hóa (quy tắc Assumptions); ghi kết quả đo
  của xml, yaml với payload `204` và của `500` csv (CHK020) vào contracts/export.md §3 và spec FR-021.

### Implementation for User Story 4

- [X] T026 [US4] Port `apps/api/src/services/import-export.service.ts` (`ExportService`: constructor và `transform`) từ
  `directus/api/src/services/import-export.ts`; export từ `services/index.ts`; factory trong `providers.ts` (dùng ở
  `respond`). Ghi manifest. (sau T023 đỏ)
- [X] T027 [US4] `apps/api/src/middleware/respond.ts`: nhánh export của `directus/api/src/middleware/respond.ts`
  (`getDateTimeFormatted` của `@backoffice/utils`, `res.attachment`, `Content-Type` theo định dạng, `transform`), đặt sau
  phần header (nhánh cache đến ở T036). Ghi manifest (nguồn `middleware/respond.ts`, cùng file đích, task T036 bổ sung).
  (sau T024 đỏ, T026)
- [X] T028 [US4] `tests/parity/src/request-set.ts` thêm `GET /items/<c>?export=csv` và `?export=json`. Sổ khác biệt:
  xóa entry `D-12`; dòng D-12 trong `specs/001-platform-foundation/spec.md` và dòng D-12
  của bảng "Thay đổi" trong `specs/004-permissions/spec.md` ghi "Gỡ ở 005"; chạy guard. (sau T025 xanh)

**Checkpoint**: T023 đến T025 xanh; SC-004.

---

## Phase 6: User Story 3 - Response cache dùng chung với Directus (Priority: P2)

**Goal**: Middleware `cache` và `respond` lưu, trả, bỏ qua cache như Directus với cùng key (contracts/cache.md); gỡ
D-11.

**Independent Test**: spec US3; `cache-blackbox.test.ts`, `cache-cross.test.ts` đạt ở năm cặp.

### Tests for User Story 3

- [X] T029 [P] [US3] Port test gốc vào `apps/api/src/utils/`: `get-cache-key.test.ts`, `get-cache-headers.test.ts`,
  `should-skip-cache.test.ts`, `permissions-cacheable.test.ts` từ `directus/api/src/utils/` (sửa mock `directus/version`
  thành `DIRECTUS_COMPAT_VERSION`, bỏ ca flow trigger với ghi chú 009). Ghi manifest.
- [X] T030 [P] [US3] `apps/api/src/middleware/cache.test.ts` (thay bản 12 dòng): method khác `GET`, `CACHE_ENABLED=false`,
  skip → `MISS`, lỗi đọc → `warn` + `MISS`, `HIT` (header, body, route không chạy, chỉ header của middleware và
  Express), `MISS`; `respond.test.ts` thêm ca lưu theo từng điều kiện FR-012 (a đến g), lỗi ghi → `warn`, bảng
  `Cache-Control` của contracts/cache.md §5, `cacheInstance`/`cacheTTL`.
- [X] T031 [P] [US3] `tests/parity/src/items/cache-blackbox.test.ts`: port `directus/tests/blackbox/tests/db/app/cache.{test,seed}.ts`
  và `tests/db/routes/permissions/cache-purge.{test,seed}.ts` lên bốn cặp (`describe.each` bốn profile ×
  `APP_NAMES`, `describe.skipIf` khi profile không chạy; seed qua Directus của cặp; collection bỏ qua tên
  `test_cache_ignored`); giữ khẳng định gốc (`x-cache-status`). Ghi manifest.
- [X] T032 [P] [US3] `tests/parity/src/items/cache-cross.test.ts` (FR-042). Mọi fixture của bốn cặp cache (collection,
  field, policy, permission, user) tạo qua Directus của chính cặp đó (`profileUrls(profile).directusUrl`). Lý do: cặp
  có bus và namespace quyền riêng, `cache-redis` còn có Redis riêng, nên tạo qua cặp chính thì cache schema và cache
  quyền của cặp không bị xóa. Các ca: cùng key và giá trị với cache trống (xóa
  `sets:namespace:<CACHE_NAMESPACE>:*` như `flushSharedCaches` của `tests/parity/src/redis.ts`, gọi một app, đọc key
  bằng ioredis, so với app kia); `HIT` chéo hai chiều 20 lần; purge
  chéo ở `cache-redis-purge` và không purge ở `cache-redis`; `$NOW` trong quyền đọc; `ip_access` khớp (IP đọc từ log
  request đầu) → key khác; `CACHE_SKIP_ALLOWED` ở cặp chính (request `no-store` vẫn ghi key, đọc key trong Redis ngay
  sau đó); ở `cache-redis` (`CACHE_SKIP_ALLOWED=false`), request có `Cache-Control: no-store` vẫn nhận `HIT` ở cả hai app
  (US3.5, nhánh `false`); `GET /server/health` gọi chéo hai app không bao giờ `HIT` và không có key trong Redis (FR-014);
  `CACHE_VALUE_MAX_SIZE=1kb` ở `cache-redis`; Referer
  `<PUBLIC_URL>/admin` với `CACHE_AUTO_PURGE` false và true; `HEAD`; dấu `/` cuối (CHK013, ghi kết quả vào spec).
- [X] T033 [P] [US3] `tests/parity/src/items/cache-redis-down.test.ts` (mới, suite `cache`): ca `CACHE_ENABLED=true` ở cặp `cache-redis` (dừng
  `redis-cache`, `GET` ở hai app: status, thời gian, log `[cache] Couldn't read key`; bật lại, `MISS` rồi `HIT`); ghi dung
  sai đo được vào spec FR-016 (CHK012).

### Implementation for User Story 3

- [X] T034 [US3] Port vào `apps/api/src/utils/`: `get-cache-key.ts` (bỏ `getFlowManager`, `getGraphqlQueryAndVariables`
  với `// Backoffice:` 009, 011; `version` = `DIRECTUS_COMPAT_VERSION`), `get-cache-headers.ts`, `should-skip-cache.ts`
  (`Url` của `utils/url.ts`, `getEndpoint` của `@backoffice/utils`), `permissions-cacheable.ts`, `get-string-byte-size.ts`
  từ `directus/api/src/utils/`. Ghi manifest. (sau T029 đỏ)
- [X] T035 [US3] Thay `apps/api/src/middleware/cache.ts` bằng port đủ của `directus/api/src/middleware/cache.ts` (bỏ
  `useBufferedCounter`, ghi chú D-17). Ghi manifest. (sau T030 đỏ, T034)
- [X] T036 [US3] `apps/api/src/middleware/respond.ts`: nhánh cache (điều kiện lưu, `setCacheValue` hai key,
  `getCacheControlHeader`, `cacheInstance`, `cacheTTL`, `CACHE_VALUE_MAX_SIZE`, `permissionsCacheable`), hoàn tất port
  của `middleware/respond.ts`. Ghi manifest. Cùng task: `apps/api/src/controllers/server.controller.ts` đặt
  `res.locals['cache'] = false` trong handler `GET /server/health` trước `respond`, như
  `directus/api/src/controllers/server.ts:88` (FR-014); thêm test vào `server.controller.test.ts`. (sau T030 đỏ, T034)
- [X] T037 [US3] Bật so sánh cache ở cặp chính (FR-043, research R4), cùng một commit:
  - Thêm `CACHE_SKIP_ALLOWED=true`, `CACHE_STATUS_HEADER=x-cache-status` vào chín file `tests/parity/env/<vendor>.env`.
  - `tests/parity/src/parity.ts` `send()`: header mặc định `cache-control: no-store` cho `GET`, `HEAD` khi request chưa
    đặt; `COMPARED_HEADERS` thêm `x-cache-status`; test trong `parity.test.ts`.
  - Sửa kỳ vọng `no-cache` của test 001 đến 004 thành `no-store` ở mọi cặp đọc `env/<vendor>.env` (cặp chính và các
    cặp profile `ratelimit`, `cors-hsts`, `metrics`, `sso`, `user-limits`...); grep `'no-cache'` trong
    `tests/parity/src/**` và ghi các file đã sửa vào "Ghi chú khi làm".
  Sau đó chạy `parity` Postgres `full` và `reduced` MySQL, SQLite (FR-047 lần một); chạy T031, T032, T033 với năm cặp. Ghi vào "Ghi chú khi làm" các key đo được của 10
  query mẫu (research R3). (sau T035, T036)
- [X] T038 [US3] CI và sổ sách: `.github/workflows/ci.yml` job `parity-cache` (Postgres, `env-up
  --profiles=cache-mem,cache-mem-purge,cache-redis,cache-redis-purge,websocket`, `PARITY_SUITE=cache`, timeout 45 phút,
  vào `needs` của `publish`); `tools/ci-local.sh` thêm bước; xóa entry `D-11`; dòng D-11 trong
  `specs/001-platform-foundation/spec.md` và dòng D-11 của bảng "Thay đổi" trong `specs/004-permissions/spec.md` ghi
  "Gỡ ở 005"; ghi chú D-11 trong `tests/parity/README.md` sửa theo FR-043; chạy guard. (sau T037)

**Checkpoint**: SC-003; job `parity-cache` xanh; `full` của 001 đến 004 xanh với cache bật.

---

## Phase 7: User Story 5 - Event phát ra giống Directus và đẩy lên bus `websocket.event` (Priority: P2)

**Goal**: `Emitter` thật và cầu nối bus theo điều kiện `WEBSOCKETS_*` (contracts/events-bus.md); gỡ D-30, thu hẹp
D-26, D-29.

**Independent Test**: spec US5; `bus.test.ts` đạt ở cặp `websocket` và 0 thông điệp ở cặp chính.

### Tests for User Story 5

- [X] T039 [P] [US5] `apps/api/src/emitter.test.ts` (thay bản stub): `emitFilter` chạy listener tuần tự và lấy kết quả
  khác `undefined`, context mặc định, `emitAction` không chờ và `warn` hai dòng khi listener ném, `emitInit`, wildcard
  `items.*`, `off*`, `offAll`.
- [X] T040 [P] [US5] `apps/api/src/websocket/controllers/hooks.test.ts`: ánh xạ `items.create|update|delete` và
  `users.update` thành thông điệp (payload mặc định `{}`, `[]`), không đăng ký `sessions`, `migrations`, hook riêng
  `fields.*`, `files.upload`, `relations.delete`, `items.sort`, đăng ký một lần (`actionsRegistered`), `publish` lên
  `useBus()` kênh `websocket.event`; test điều kiện đăng ký trong `apps/api/src/app.test.ts` (ba tổ hợp `WEBSOCKETS_*`).
- [X] T041 [P] [US5] `tests/parity/src/items/bus.test.ts` (FR-045): subscriber ioredis trên kênh bus của cặp
  `websocket` (đọc cách `@backoffice/memory` đặt tên kênh và mã hóa thông điệp trong `libs/memory/src/bus/lib/redis.ts`),
  chuỗi thao tác của contracts/events-bus.md §5 ở từng app, chốt sau response + 2 giây, so sau chuẩn hóa id; cặp chính:
  0 thông điệp.

### Implementation for User Story 5

- [X] T042 [US5] Thay `apps/api/src/emitter.ts` bằng port đủ của `directus/api/src/emitter.ts` (`eventemitter2`); giữ
  `useEmitter`, `default`. Ghi manifest. (sau T039 đỏ)
- [X] T043 [US5] `apps/api/src/websocket/messages.ts` (type `WebSocketEvent` thuần, ghi chú không zod) và port
  `apps/api/src/websocket/controllers/hooks.ts` từ `directus/api/src/websocket/controllers/hooks.ts`; `apps/api/src/app.ts`
  gọi `registerWebSocketEvents()` sau khi Nest init khi `toBoolean(WEBSOCKETS_ENABLED)` và
  (`toBoolean(WEBSOCKETS_REST_ENABLED)` hoặc `toBoolean(WEBSOCKETS_GRAPHQL_ENABLED)`), comment trỏ
  `websocket/controllers/rest.ts:18`, `graphql.ts:26`, `server.ts:104`. Ghi manifest. (sau T040 đỏ, T042)
- [X] T044 [US5] `tests/parity/src/items/cache-redis-down.test.ts`: ca R-10 ở cặp `cache-redis` (có `redis-cache` riêng và bật
  `WEBSOCKETS_ENABLED` theo T003). Tạo collection qua Directus của cặp; dừng `redis-cache`; ghi một item ở từng app;
  kiểm request trả `200`. Chờ hết chuỗi kết nối lại của ioredis, đo process còn sống (`/server/ping`) và đọc log. Bật lại
  `redis-cache`. Ở `afterAll`, dù ca đạt hay lỗi: nếu một app không trả `/server/ping` thì chạy
  `docker compose -p parity-<vendor> restart` hai service của cặp, rồi chờ `/server/ping` của cả hai (tối đa 120 giây).
  Ghi kết quả vào spec R-10 và bỏ nhãn `[Suy luận]`, kể cả việc có phải khởi động lại hay không. (sau T033, T043)
- [X] T045 [US5] Sổ khác biệt (research R10): xóa entry `D-30`; sửa `reason` của `D-26`, `D-29` (giữ `removeAt: '009'`);
  dòng D-26 trong `specs/003-auth-session/spec.md` và dòng D-29, D-30 trong `specs/004-permissions/spec.md` thu hẹp hoặc
  gỡ theo bảng của spec 005; chạy guard. (sau T041 xanh)

**Checkpoint**: SC-005; T039 đến T041 xanh; `parity-cache` (có cặp `websocket`) xanh.

---

## Phase 8: User Story 6 - App Directus dùng module Content qua reverse proxy (Priority: P3)

**Goal**: Playwright module Content và tải CSV qua proxy (contracts/parity-blackbox.md §7).

**Independent Test**: spec US6; `items.spec.ts` đạt ở job `e2e-directus-app`.

- [X] T046 [US6] `tests/directus-app-e2e/src/items.spec.ts`: `beforeAll` tạo collection `e2e_articles` (`title`,
  `body`) qua API của Directus; `bothRuns`: tạo item ở `/admin/content/e2e_articles/+` (chờ `POST /items/e2e_articles`),
  sửa (`PATCH`), xóa, tạo hai item rồi chọn cả hai và xóa hàng loạt (`DELETE` mảng), sidebar Export → CSV → "Download
  file" → `page.waitForEvent('download')`, lưu file; so dòng DB và nội dung file hai lượt (bỏ `<timestamp>`, thay id);
  `afterAll` xóa collection. (sau T015, T028)
- [X] T047 [P] [US6] `tests/directus-app-e2e/src/routing.spec.ts`: khẳng định `/items/*` tới app mới (`$upstream_addr`),
  gồm `GET /items/e2e_articles?export=csv&access_token=...`. (sau T007)

**Checkpoint**: SC-008; job `e2e-directus-app` xanh.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T048 [P] Benchmark items (research R11, contracts/parity-blackbox.md §8): `tests/benchmark/src/seed-items.ts`
  (collection qua API Directus với `is_indexed`; 10 triệu dòng bằng `INSERT ... SELECT generate_series` qua knex;
  200.000 dòng cho `DELETE` chia hai dải; user có policy filter `status = published`; pool id), `tests/benchmark/src/items.ts`
  (5 kịch bản × 2 user × 2 chế độ, mẫu `permissions.ts`, `compare.ts` 10%), target `items` trong
  `tests/benchmark/project.json`, job `benchmark-items` trong `.github/workflows/benchmark.yml` (timeout 120 phút). Chạy
  một lần; ghi thời gian seed, đĩa, số liệu vào "Ghi chú khi làm"; nếu runner không chứa nổi, báo chủ dự án
  (Assumptions).
- [X] T049 [P] `tests/benchmark/src/{run,auth,permissions}.ts`: tham chiếu Directus cặp chính với header
  `Cache-Control: no-store` (cặp chính có `CACHE_SKIP_ALLOWED=true`) thay `directus-noresponsecache`; xóa service
  `directus-noresponsecache` khỏi `tests/benchmark/docker-compose.yml` và ghi chú D-11 trong các file đó (research R10).
- [X] T050 [P] `tests/parity/src/observability/logs.test.ts`: log `warn` `[cache] Couldn't set key` và `Couldn't read key`
  không chứa token hay nội dung payload; log khi listener action lỗi đúng hai dòng (FR-030); dòng log HTTP của request
  `export` có `access_token` trong URL chỉ như Directus (R-06 của 004).
- [X] T051 [P] `specs/005-items/spec.md`: thay các chỗ "dự kiến" bằng số đo của T010, T025, T032, T033 (chuỗi `%` sai
  trong path, message `TypeError` của lỗi `500` export csv, export xml và yaml khi không có payload, charset của
  `Content-Type` export, R-10 nếu T044 đã đo); nếu số đo khác dự kiến thì sửa luôn ca kiểm và ghi vào "Ghi chú khi
  làm"; `checklists/items-review.md` ghi một dòng Notes về lần cập nhật này.
- [X] T052 Chạy quickstart.md §1 đến §3 trên môi trường đối chiếu; sửa quickstart nếu lệch. Cập nhật
  `tests/parity/README.md` (mục "Test items (feature 005)": suite `blackbox` hai lượt, `PARITY_BLACKBOX_*`, năm cặp,
  `known-failures.ts`, header `no-store` của bộ so sánh). Chạy `graphify update .`. (sau T048 đến T051)
- [X] T053 Chạy lại đủ `parity-matrix.yml` (ma trận quyền 004 và `blackbox-full`) với `respond`, `cache`, `Emitter` mới
  (FR-047, SC-001, SC-009); ghi kết quả vào "Ghi chú khi làm". (sau T052)
- [X] T054 Đóng feature: CI xanh mọi job (`quality`, `guard-*`, `parity` ba vendor, `parity-blackbox`, `parity-cache`,
  `parity-matrix-rotating`, `e2e-directus-app`, `docker`, `security`), coverage ≥ 80% `apps/api`; `benchmark-items` đã
  chạy; không còn entry `removeAt: '005'` trong `accepted-differences.ts`; `spec.md` `Status: Done`; tech lead duyệt
  bảng khác biệt (D-09.3, D-11, D-12, D-30 gỡ; D-26, D-29 thu hẹp), R-07 đến R-10 và các sửa bảng 001, 003, 004 (Nguyên
  tắc X); cập nhật memory dự án. (sau tất cả)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 trước (lockfile); T002, T003, T005, T006, T007 song song; T004 sau T003.
- **Foundational (Phase 2)**: T008 sau T001 (chạy parity cần env); T009 song song với T008.
- **US1 (Phase 3)**: sau Phase 2. T010 đến T012 song song, viết trước; T013 sau T011 đỏ; T014 sau T013; T015 sau T010, T013.
- **US2 (Phase 4)**: sau US1 (bộ blackbox gọi `/items`) và T006. T016 trước; T017 đến T020 song song; T021 sau; T022 sau
  T021.
- **US4 (Phase 5)**: sau Phase 2 (không cần US1, nhưng T025 dùng collection của T010 nên đặt sau US1). T023 đến T025 song
  song; T026 sau T023; T027 sau T024, T026; T028 sau T025.
- **US3 (Phase 6)**: sau US4 (cùng file `respond.ts`) và T003 đến T006. T029 đến T033 song song; T034 sau T029; T035,
  T036 sau T030, T034; T037 sau T035, T036; T038 sau T037.
- **US5 (Phase 7)**: sau Phase 2 và T003, T004 (cặp `websocket`); độc lập với US3, US4 về code (chỉ `emitter.ts`,
  `websocket/**`, `app.ts`). T039 đến T041 song song; T042 sau T039; T043 sau T040, T042; T044 sau T033, T043; T045 sau
  T041.
- **US6 (Phase 8)**: sau US1 (route) và US4 (export); T047 chỉ cần T007.
- **Polish (Phase 9)**: T048 đến T051 song song sau các story liên quan (T048 sau US1, US3; T049 sau T037; T050 sau US3,
  US5; T051 sau T010, T025, T032, T033); T052 sau T048 đến T051; T053 sau T052; T054 sau tất cả.

### Within Each User Story

- Test viết trước và fail trước khi làm phần tương ứng.
- Port test gốc → port code → test đối chiếu → sổ khác biệt.
- Story xong (checkpoint xanh) mới sang story sau, trừ US5 có thể làm song song với US3, US4.

### Parallel Opportunities

- Phase 1: T002, T003, T005, T006, T007 song song.
- US2: T017 đến T020 (bốn nhóm file copy) song song.
- US3: T029 đến T033 (năm file test) song song, rồi T034.
- US5 song song với US3, US4 nếu có hai người.
- Polish: T048 đến T051 song song.

---

## Parallel Example: User Story 2

```bash
# Sau T016 (harness), copy bốn nhóm file cùng lúc:
Task: "T017 copy seed-functions, types, variables, query/**, schema/**"
Task: "T018 copy 11 seed, seed-all-field-types, seed-relational-fields, 00-seed.test.ts"
Task: "T019 copy no-relation, m2o, o2m (bỏ khối WebSocket)"
Task: "T020 copy m2m, m2a, relational-json, json-fields, singleton, case-when, conceal-filter, hash-filter"
```

## Parallel Example: User Story 3

```bash
# Viết năm file test trước khi port code:
Task: "T029 port get-cache-key.test.ts, get-cache-headers.test.ts, should-skip-cache.test.ts, permissions-cacheable.test.ts"
Task: "T030 cache.test.ts, respond.test.ts (ca cache)"
Task: "T031 cache-blackbox.test.ts"
Task: "T032 cache-cross.test.ts"
Task: "T033 redis-down.test.ts (ca CACHE_ENABLED=true)"
```

---

## Implementation Strategy

### MVP (Phase 1 đến 4)

1. Setup và Foundational: thư viện, env, năm cặp profile, bộ so sánh, `respond(req, res)`, `collectionExists`.
2. US1: route `/items`; `crud.test.ts` xanh ba vendor.
3. US2: bộ blackbox hai lượt xanh trên Postgres; rút gọn trên MySQL, SQLite; job CI.
4. **DỪNG và kiểm**: SC-001, SC-002; commit, push, CI xanh.

### Phần còn lại (Phase 5 đến 9)

5. US4 export (gỡ D-12) → US3 cache (gỡ D-11, chạy lại 001 đến 004) → US5 event, bus (gỡ D-30, thu hẹp D-26, D-29).
6. US6 E2E, Polish (benchmark, README, quickstart, ma trận đầy đủ, đóng feature).

---

## Notes

- [P] = khác file, không phụ thuộc task chưa xong.
- Mỗi task port ghi manifest `tools/port-manifest/005-T###.json` và chạy `node tools/check-port-headers.mjs`.
- Commit sau mỗi task hoặc nhóm task; đẩy lên `main` khi checkpoint xanh.
- Dừng ở bất kỳ checkpoint nào để kiểm story độc lập.

## Ghi chú khi làm

- T001: `pnpm audit --prod --audit-level=high` không có advisory mới từ `json2csv`, `js2xmlparser`, `eventemitter2`,
  `js-yaml` (14 advisory, đều có từ trước và đã nằm trong `auditConfig.ignoreGhsas` hoặc dưới ngưỡng). Parity thêm `uuid`
  11.1.0 (`seed-functions.ts` của blackbox dùng `v5`) và `@backoffice/utils` (`getFilterOperatorsForType`), ngoài danh
  sách của T001.
- T008: 82 lời gọi `respond(res)` trong 7 controller đổi thành `respond(req, res)` (`return` hoặc `await`); `respond`
  thành hàm `async` ngay từ bây giờ vì bản đủ của Directus là `async` (T027, T036). Unit test API: 194 file, 2.069 ca
  đạt, coverage 85,9%.
- T007 commit cùng T013: thêm `items` vào proxy khi `/items` chưa có sẽ làm app Directus qua proxy nhận `404`.
- T010 đến T014: `crud.test.ts` 9 ca đạt trên Postgres local. Hai lỗi tìm được và đã sửa: `path` trong lỗi `404` của
  singleton phải là path của router con (`/<singleton>`, Directus gắn router ở `/items`); test thiếu `deep` ở `SEARCH`
  có `keys` (o2m không sắp theo khóa uuid ngẫu nhiên). Đo được: `SEARCH` không body trả `200` (body-parser 1.20.3 luôn
  đặt `req.body = {}`; câu "thiếu body → `400`" ở FR-041 của 004 không đúng); path `%` sai trả `500` `Failed to decode
  param`; `meta` của singleton chỉ có khi query có `meta`. `createUserCollection` nhận khóa uuid và meta;
  `flow.activity()` nhận danh sách collection.
- T016 đến T020 (Postgres local, ba kiểu khóa): lượt `backoffice` 9.579 ca đạt, 10 bỏ qua. Lượt `directus` đầu tiên
  bị ngắt giữa chừng vì `db-unchanged.test.ts` chạy song song dừng mọi container; seed blackbox thêm admin vào cùng
  database nên ca `DELETE /users/<admin>` của request set (chờ lỗi "admin cuối") xóa thật admin. `db-unchanged` nay
  dừng sớm khi có hơn một policy admin; quickstart ghi thứ tự chạy (CI không bị vì blackbox Postgres là job riêng).
- Sửa 001: `src/server/errors.test.ts` bỏ `/items/directus_users` khỏi danh sách "chưa làm → 404" (CI đỏ ở 333ac75),
  thêm ca `403 FORBIDDEN` ở cả hai app.
- T023: test mới, không phải port (`import-export.test.ts` của Directus không có ca `transform`), nên không có
  manifest. Kết quả thật của thư viện: `js2xmlparser` 5.0.0 bọc mỗi dòng của mảng trong một phần tử `data` con;
  `json2csv` 5.0.7 thêm cột `author` riêng khi một dòng có object `null` ở field mà dòng khác có object.
- T026: không thêm factory ở `providers.ts`: `respond` là hàm thường và gọi `new ExportService(...)` như Directus;
  `ExportService` export từ `services/index.ts`.
- T024 đến T027: unit test API 197 file, 2.109 ca đạt, coverage 86,1%. `server.controller.test.ts` thêm
  `sanitizedQuery: {}` vào request giả (middleware thật luôn đặt).
- T025: 56 ca đạt trên Postgres local (11 nguồn × 5 định dạng, một ca `400`). Bỏ ca `fields` có hàm trên
  `date_created`: dùng field `published` kiểu `timestamp`. `normalizeContentDisposition` thay cả mốc thời gian trong
  `filename*=` (tên ngoài ASCII), vì hai request có thể rơi vào hai giây khác nhau. Giá trị đo ghi ở contracts/export.md §3
  và FR-021.
- T028: guard `accepted-differences.test.ts` bắt mọi mã của bảng 001 còn trong danh sách tới khi 005 `Done`, nên entry
  `D-12` giữ tới T054 (chỉ sửa comment), như D-09.3 ở T015.
- T021: CI của 294938d: MySQL và SQLite chạy `reduced` rồi blackbox khóa `integer` đều xanh (bước blackbox 256 giây ở
  MySQL, 156 giây ở SQLite, cả hai lượt). Postgres local đủ ba kiểu khóa: 804 giây cho hai lượt, mỗi lượt 9.579 ca đạt.
  Job `parity-blackbox` đỏ lần đầu vì `@backoffice/utils` chưa build: target `parity-blackbox`, `parity-cache` thêm
  `dependsOn: ["^build"]`. `blackbox-full` của `parity-matrix.yml` chạy ở T053.
- T029, T034: test port giữ nguyên hash của Directus (mock version `1.2.3` qua `DIRECTUS_COMPAT_VERSION`), nên key của
  app mới bằng key Directus cho cùng request. Bỏ ca GraphQL (011) và flow trigger (009) cùng code của chúng.
- T030, T035, T036: `cache.test.ts` 11 ca, `respond.test.ts` 24 ca; `server.controller.ts` đặt `res.locals.cache = false`
  ở `/server/health`. Manifest T036 không có: T027 đã ghi cùng nguồn và đích.
- T031: `/utils/cache/clear` và `/presets` (010) gửi tới Directus của cặp; collection bỏ qua tên `test_cache_ignored`;
  mỗi ca làm rỗng collection qua Directus trước (`CACHE_VALUE_MAX_SIZE=1kb` ở `cache-redis`). Ca `updateBatch` lấy đúng
  5 id đầu như bản gốc: response tạo hàng loạt của `/permissions` có thêm quyền tối thiểu của app (không có `id`).
- T032: key và giá trị giống từng byte (trừ `expires` của Keyv); `HIT` chéo 20 lần; `$NOW` và `CACHE_VALUE_MAX_SIZE`
  không lưu ở cả hai; `ip_access` khớp cho key khác và vẫn `HIT` chéo; `/server/health` không lưu; `HEAD` không đọc
  không lưu; dấu `/` cuối là key khác (CHK013, ghi vào spec). Đổi schema phải gọi `POST /utils/cache/clear?system` ở
  Directus của mọi cặp (không có `?system` chỉ xóa cache dữ liệu).
- T033, T044 (đo, Postgres): đọc khi `redis-cache` dừng, mỗi app ngay sau khi chính nó làm nóng cache dùng chung: cả hai
  không trả trong 15 giây. R-10: ghi trả `200` ở cả hai; `publish` bị từ chối sau khoảng 10 giây; Directus chạy dưới
  `pm2-runtime` nên process sống, app mới (`node` trần) thoát. Sửa: `apps/api/src/unhandled-rejection.ts` làm như pm2;
  sau sửa hai app sống, không phải khởi động lại. Ghi vào spec FR-016 và R-10.
- `redis-cache` đổi cổng host 6109 → 6111 (6109 là LDAP, 6110 là IdP); `vendors.test.ts` kiểm mọi cổng host của compose.
- CI 294938d: `parity (postgres, full)` đỏ ở `src/schema/redis-trace.test.ts` (002): MONITOR của ioredis lấy dòng
  MONITOR làm reply ("Command queue state error") khi bus nhiều lệnh. `traceRedis()` nay chạy `redis-cli monitor` trong
  container `redis`.
- T037: chín file `env/<vendor>.env` thêm hai biến; `capture()` gửi `no-store` mặc định; không test nào của 001 đến 004
  phải đổi kỳ vọng `no-cache` (`/server/health` không lưu nên vẫn `no-cache`, `/metrics` không qua `respond`).
- T038: entry `D-11` đổi sang `kind: 'doc'` và giữ tới T054 (guard), như D-12. Job `parity-cache` vào `needs` của
  `publish`.
- T039 đến T043: emitter port đủ (9 ca); `registerWebSocketBridge()` trong `app.ts` (4 ca điều kiện); `hooks.test.ts`
  9 ca. `bus.test.ts`: mỗi thao tác ghi, hai app phát cùng chuỗi `websocket.event` (activity, revision, rồi item; cả
  `password` dạng rõ của `users.create`, R-07) sau khi thay khóa serial (`directus_activity`, `directus_revisions`,
  `directus_permissions`, `parent` của revision) và uuid; cặp chính không có thông điệp.
- T045: entry `D-30` xóa (mã của bảng 004, guard chỉ giữ mã của bảng 001); `D-26`, `D-29` đổi `reason` còn phần flow.
- T046, T047: helper E2E nhận thêm bảng collection người dùng (`bothRuns(..., tables)`); export tải về bắt qua popup của
  `window.open`.
- T048, T049: `tests/benchmark/src/{seed-items,items}.ts`, target `benchmark:items`, job `benchmark-items`; benchmark bỏ
  service `directus-noresponsecache`, mọi request gửi `Cache-Control: no-store` tới Directus cặp chính.
- T050: ca dòng log HTTP của `?export=json&access_token=` (cặp `metrics`); log app mới trong lúc Redis dừng không có
  token hay payload. Log hai dòng khi listener action lỗi kiểm ở `emitter.test.ts` (không có listener nào ném ở app).
- Kiểm local (Postgres, 2026-10-12): bộ `cache` 157/157 (234 giây); bộ `full` 541/545 rồi 3 ca lỗi chạy lại đạt: hai ca
  `schema/permissions-cache.test.ts` mang kỳ vọng D-11 (app mới nay cũng ghi `policies-ip-access` và `raw-permissions`
  như Directus, đã sửa), ca TFA lệch cửa sổ OTP (chạy lại hai lần đạt); E2E 7/7 qua proxy. Lưu ý local: tạo lại container
  `backoffice-api` sau khi proxy đã chạy làm nginx giữ IP cũ, phải khởi động lại `proxy`.
- T052: quickstart §1 chạy theo từng lệnh ở trên (lệnh bộ `cache` đổi sang target `parity-cache`); §2 đúng như ghi
  (`MISS` ở app mới rồi `HIT` ở Directus, `Content-Disposition` và file CSV); README của bộ đối chiếu có mục feature 005.
- T021, T053 (700ecfb): `parity-matrix.yml` xanh: bốn shard ma trận quyền 004 (334 đến 411 giây) với `respond`,
  `cache`, `Emitter` mới; `blackbox-full` đủ ba kiểu khóa, cả hai lượt: MySQL 819 giây, SQLite 490 giây (bước blackbox).
  CI 700ecfb xanh mọi job: `parity-blackbox` (Postgres) 913 giây, `parity-cache` 411 giây, `parity` Postgres `full`
  911 giây, MySQL, SQLite `reduced` kèm blackbox `integer` 372 và 487 giây, `e2e-directus-app` 350 giây.
- T048 lần chạy đầu (benchmark.yml, 700ecfb, runner GitHub): seed 304 giây, `bench_articles` 1,37 GiB kèm index, đĩa
  còn 82 GB; job 2.299 giây. Đọc từ cache (`HIT`) và ghi của admin đạt, app mới nhanh hơn ở mọi dòng. Đọc tươi lỗi ở cả
  hai app: danh sách sắp theo `date_created` không có index nên mỗi request sắp 5 triệu dòng, quá timeout 10 giây của
  autocannon, rồi đọc theo id xếp hàng sau các truy vấn đó. Sửa seed: index `date_created` (research R11, contracts §8).
  `POST` của user: p95 380 so với 311 ms (+22%) dù req/s cao hơn; job `benchmark` của 001: `/server/health` p95 311 so
  với 271 ms (+15%). Chạy lại sau khi sửa để xem hai dòng này là nhiễu hay thật.
- T048 lần chạy thứ hai (cca48ad, index `date_created`): seed 213 giây, 1,74 GiB kèm index; job 2.203 giây; 14/14 dòng
  đạt ngưỡng 10%, app mới có req/s cao hơn ở mọi dòng và p95 thấp hơn ở 13 dòng (`POST` của user 203 so với 193 ms). Job
  `benchmark` của 001 đỏ hai lần ở `/server/health` (p95 +15%, +17%): ngoài phạm vi 005, đã tách thành task riêng.
- T054: CI xanh mọi job ở 700ecfb, d6e72b7; `parity-matrix.yml` xanh (T053); coverage `apps/api` 86,3% dòng; tech lead
  duyệt ngày 2026-10-12 gỡ D-09.3, D-11, D-12, D-30, thu hẹp D-26, D-29, R-07 đến R-10, cách làm của
  `unhandled-rejection.ts` và các sửa bảng 001, 003, 004; xóa entry D-09.3, D-11, D-12 cùng lúc với `Status: Done`; sửa
  các comment còn mô tả cache response là của riêng Directus.
- (ghi file đã sửa ở T037, thời gian lượt blackbox T021, key đo được T037, số liệu R-10 T044, seed và số liệu
  benchmark T048, kết quả T053 tại đây)
