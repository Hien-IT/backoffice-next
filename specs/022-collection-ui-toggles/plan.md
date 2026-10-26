# Implementation Plan: Ẩn hiện ô tìm kiếm, Import, Export theo collection và migration riêng của Backoffice

**Branch**: `022-collection-ui-toggles` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=022-collection-ui-toggles`) | **Date**: 2026-10-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-collection-ui-toggles/spec.md`

## Summary

Ba cột boolean `bo_show_search`, `bo_show_import`, `bo_show_export` trên `directus_collections` (mặc định bật, null =
bật) và ba dòng `directus_fields` (interface boolean, nhãn en-US/vi-VN) để form collection của cả Backoffice và
Directus app có ba toggle. Trang Content của Backoffice đọc `meta.bo_*`: tắt tìm kiếm thì ẩn ô nhập từ khóa (giữ nút
bộ lọc, không gửi từ khóa của preset/bookmark); tắt Import hoặc Export thì ẩn phần tương ứng của mục Import/Export; áp
dụng cho mọi người dùng; API không đổi (D-179). Cột và dòng do **migration riêng của Backoffice** tạo: thư mục
`apps/api/src/database/backoffice-migrations/` (danh sách tĩnh), trạng thái trong bảng hệ thống `backoffice_migrations`,
chạy trong `bootstrap` trên mọi vendor sau khi migration Directus đã đủ, dưới lock `useLock().usingLock`, kiểm tra lúc
`start`, không lệnh CLI, không `down` (D-180, constitution 3.2.0). Backoffice coi `backoffice_migrations` là collection
hệ thống (ẩn, 403 ở `/items`, không vào snapshot); Directus thấy nó như bảng chưa quản lý (D-181). Directus 11.17.4
chạy chung không cần file hay cấu hình mới.

Cách làm (chi tiết ở [research.md](./research.md)): runner + lock (R1), nối `bootstrap`/`init`/`start` (R2), migration
`20261026A` (R3), collection hệ thống ở API và web (R4), ba component web (R5), parity dump/log/normalize và test ba
replica trong suite deploy (R6), E2E ba cấu hình (R7), unit test (R8), ba lượt lên `main` (R11).

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict (cờ của `@directus/tsconfig`), Node.js 22 LTS, ESM, pnpm 10.27, Nx 23;
swc build cho `apps/api`; Vite cho `apps/web`.

**Primary Dependencies**: có sẵn, không thêm: Knex 3.1 (`pg`, `sqlite3` và các driver khác của image), `@backoffice/memory`
(kv Redis với `@sesamecare-oss/redlock` 1.4.0, kv local), `@backoffice/system-data`, `@backoffice/env`, NestJS 12 (không
dùng cho CLI), Vue 3.5, Pinia, Reka UI 2.8.2, Tailwind CSS 4.3, `@directus/sdk` 21.3.0, `@directus/types` 15.0.3,
`@directus/utils` 13.4.1; test: Vitest 3.2.4, `knex-mock-client`, Playwright 1.64.0.

**Storage**: bảng mới `backoffice_migrations` (version, name, timestamp); ba cột `bo_*` boolean nullable default true
trên `directus_collections`; ba dòng `directus_fields`; khóa Redis `backoffice-migrations` trong namespace
`REDIS_LOCK_NAMESPACE` (mặc định `directus:lock`), kv của `useLock()`; `flushCaches(true)` sau khi áp migration riêng.
`directus_migrations` không đổi.

**Testing**: Vitest unit (`apps/api`: runner và migration trên SQLite in-memory, `validate-migrations.test.ts`,
`bootstrap`; `libs/system-data`; `apps/web`: `SearchInput`, `ExportSidebarDetail`, `CollectionRoute`, browser project
axe); parity profile `bootstrap` (Postgres đủ, SQLite rút gọn: dump, cross, CLI output với quy tắc log mới); env parity
chính (request-set `/collections`, `/fields` normalize D-181, blackbox collections/fields/schema, GraphQL SDL); deploy
(3 replica + 1 Directus: một dòng mỗi migration, standalone và kind qua service/Job `bootstrap`); E2E
`content-collection-toggles.spec.ts` ba cấu hình với admin và user thường; vendor khác qua parity matrix hằng đêm.

**Target Platform**: Linux `amd64` container (image API `/backoffice`), trình duyệt desktop/tablet (Chrome, Edge,
Firefox, Safari).

**Project Type**: BE (`apps/api`, `libs/system-data`) + FE (`apps/web`, `apps/web-e2e`) + test (`tests/parity`).

**Performance Goals**: migration riêng dưới 1 giây trên DB parity (một `ALTER TABLE` ba cột, ba insert); replica chờ
lock không quá cửa sổ retry của redlock (~5–7 giây) [Inference R1]; trang Content không thêm request (meta đã có
trong store collections); SC-001..SC-006 của spec.

**Constraints**: không sửa `directus/` (I); không sửa `migrations/run.ts` và 101 file port (II, `port.test.ts`);
không ghi `directus_migrations` (II 3.2.0); lock dùng chung (VII 3.2.0); API/GraphQL giống Directus trừ D-181 (III, V:
normalize + accepted-differences); không biến env mới (VIII); comment code ghi "DR" (IX); coverage BE ≥ 80 %, FE ≥ 60 %
(X); theme và component-specs của `design-system/` cho prop mới của hai component (XII).

**Scale/Scope**: 1 migration riêng, 1 runner, 3 file CLI/startup sửa, 1 yaml + 1 hàm `libs/system-data`, 3 component
web + 2 util/store, 1 spec E2E mới + 1 case thêm, 4 file parity sửa + 1 test deploy mới, `deploy/README.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.2.0). Mark PASS, or VIOLATION with
a row in Complexity Tracking.

- [x] I. PASS: không file nào trong `directus/` đổi; không có file port mới (runner và migration là code Backoffice,
  header ghi spec 022 và D-180; `bootstrap`, `validate-migrations.ts` giữ header port).
- [x] II. PASS theo ngoại lệ 3.2.0: migration riêng trong `backoffice-migrations/`, bảng `backoffice_migrations`, chỉ
  cột `bo_*` trên `directus_collections` và dòng `directus_fields` của chúng; `up` chỉ knex, chạy lại được, 7 vendor;
  `bootstrap` chạy trên mọi vendor sau migration Directus; kiểm tra lúc `start`; không ghi `directus_migrations`; DB
  dùng được với Directus 11.17.4 không cần file hay cấu hình (R1–R4). Không `down` (chủ dự án, FR-014).
- [x] III. PASS với D-181 ghi trong spec: REST/GraphQL giống Directus trừ collection `backoffice_migrations` (meta hệ
  thống thay vì null, 403 ở `/items`); normalize ở `normalizers.ts` + `accepted-differences.ts` (R6). GraphQL SDL
  [Unverified R4] kiểm lượt 1.
- [x] IV. PASS: lock qua kv Redis của `useLock()` (namespace chung với Directus), `flushCaches(true)` xóa cache hai app
  qua Redis; không state trong process (runner đọc bảng sau khi lấy lock).
- [x] V. PASS: parity `bootstrap` (dump, cross, CLI), request-set `/collections` `/fields`, blackbox, GraphQL, deploy 3
  replica, E2E ba cấu hình (contracts/tests.md).
- [x] VI. PASS: không service mới; code trong `apps/api/src/database`, `cli`; Vue 3 Composition API, prop mới trên
  component có sẵn.
- [x] VII. PASS theo ngoại lệ 3.2.0: migration riêng trong `bootstrap` dưới lock Redis, mỗi lúc một process; `start`
  chỉ đọc và kiểm tra; FE không đổi cấu hình; standalone: service/Job `bootstrap` chạy, replica `start`.
- [x] VIII. PASS: không biến môi trường mới; `REDIS_LOCK_NAMESPACE`, `DB_EXCLUDE_TABLES` là biến Directus.
- [x] IX. PASS: comment "DR"; nhãn toggle là chuỗi của Backoffice (không có trong Directus); bảng `backoffice_*`, cột
  `bo_*` là tên mới, không đổi tên gì của Directus.
- [x] X. PASS: coverage qua unit test R8; hiệu năng không đổi (không request thêm); log pino cho migration riêng;
  không email; khác biệt D-179..D-181 trong spec (chờ duyệt).
- [x] XI. PASS: không chạm mục ngoài phạm vi.
- [x] XII. PASS: prop mới không thêm style; pill `w-11` là class có sẵn của `SearchInput`; không hex, không palette
  ngoài theme; không màn hình mới; `design-system/docs/component-specs.md` không cần thêm mục (không component mới).

Post-design re-check (sau Phase 1): không đổi; "Sửa spec khi plan" (research cuối) là câu chữ FR-002, FR-017, FR-019,
US4 kịch bản 6, áp vào spec cùng commit plan.

## Project Structure

### Documentation (this feature)

```text
specs/022-collection-ui-toggles/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (R1–R12, sửa spec khi plan)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output: migrations.md, web.md, tests.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/src/
├── database/
│   ├── backoffice-migrations/                       # mới (D-180)
│   │   ├── index.ts                                 # BACKOFFICE_MIGRATIONS: danh sách tĩnh { version, name, up }
│   │   ├── run.ts                                   # runBackofficeMigrations(knex): bảng, lock, latest, flushCaches
│   │   ├── run.test.ts                              # SQLite in-memory
│   │   ├── 20261026A-add-collection-ui-toggles.ts   # ba cột bo_*, ba dòng directus_fields (R3)
│   │   └── 20261026A-add-collection-ui-toggles.test.ts
│   ├── validate-migrations.ts                       # sửa: boMissing/boExtra, thông điệp, migrationsValid (R2)
│   └── validate-migrations.test.ts                  # sửa
├── cli/commands/bootstrap/index.ts                  # sửa: gọi runner ở hai nhánh Postgres/SQLite và nhánh D-145
├── cli/commands/init/index.ts                       # sửa: gọi runner sau runMigrations latest (init tự cài DB)
└── (migrations/run.ts, 101 file, port.test.ts: KHÔNG đổi)
libs/system-data/src/collections/
├── collections.yaml                                 # + backoffice_migrations (hidden, note)
├── index.ts                                         # isSystemCollection: tiền tố directus_ hoặc backoffice_
└── index.test.ts                                    # sửa test tiền tố
apps/web/src/
├── components/SearchInput.vue (+ .test.ts)          # prop showSearch
├── components/sidebar/ExportSidebarDetail.vue (+ .test.ts)   # prop showImport, showExport
├── modules/content/routes/CollectionRoute.vue (+ .test.ts)   # meta.bo_*, activeSearch, v-if
├── stores/collections.ts                            # isSystemCollection + backoffice_, COLLECTIONS_DENY_LIST
└── utils/get-item-route.ts                          # isSystemCollection + backoffice_
apps/web-e2e/src/
├── content-collection-toggles.spec.ts               # mới (R7)
└── settings-data-model.spec.ts                      # + /content/backoffice_migrations not found
tests/parity/
├── accepted-differences.ts                          # + D-180, D-181 (doc)
└── src/
    ├── normalizers.ts                               # /collections, /fields: bỏ backoffice_* (D-181)
    ├── bootstrap/dump.ts                            # bỏ cột bo_* và dòng directus_fields bo_* (D-180)
    ├── bootstrap/normalize.ts                       # bỏ dòng log migration riêng (FR-019)
    ├── bootstrap/cross.test.ts                      # + bảng backoffice_migrations, chạy lại bootstrap
    └── deploy/backoffice-migrations.test.ts         # mới: 3 replica, một dòng mỗi migration
deploy/README.md                                     # mục "Migration riêng của Backoffice"
specs/022-collection-ui-toggles/spec.md              # câu chữ FR-002, FR-017, FR-019, US4-6 (research cuối)
```

**Structure Decision**: thư mục migration riêng tách khỏi `database/migrations` (bản port so với Directus); không
project Nx mới; parity và deploy ở `tests/parity` như 019–021; E2E trong `apps/web-e2e` như 014.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Không có vi phạm: II và VII đi theo ngoại lệ 3.2.0 (chủ dự án yêu cầu 2026-10-26); D-179..D-181 là khác biệt ghi trong
spec theo X, chờ duyệt.
