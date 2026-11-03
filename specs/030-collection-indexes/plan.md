# Implementation Plan: Index ghép, index trigram và tạo index không khóa bảng cho collection người dùng

**Branch**: `030-collection-indexes` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=030-collection-indexes`) | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/030-collection-indexes/spec.md`

## Summary

Admin tạo và xóa index của một collection người dùng từ card "Indexes" trên trang collection của Data Model hoặc qua
`GET/POST/DELETE /backoffice/collections/:collection/indexes`: index B-tree ghép 1–8 cột (unique hoặc không) trên
Postgres, SQLite, MySQL và index GIN trigram trên `lower(col)` cho `?search=` trên Postgres; tạo không khóa bảng theo mặc
định (Postgres `CONCURRENTLY`, MySQL `INPLACE LOCK=NONE` với fallback); POST trả 202 và một job nền trong process đổi
dòng `backoffice_indexes` từ `creating` sang `ready`/`failed` (clarify Q1); xóa field/collection ở Backoffice gỡ index
trước (MySQL và SQLite giữ index thiếu cột nếu không, research R3); lỗi trùng unique ghép liệt kê từng field. Directus
không đổi gì: route mới 404 ở Directus, `/fields` không đổi, bảng `backoffice_*` đã có normalizer; D-210..D-210.4.

Cách làm (chi tiết ở [research.md](./research.md)): mở rộng `createIndex` của helper schema cho mảng cột và kiểu
trigram + `dropIndex` (R1); `pg_trgm` cài trong job, index trên `lower(col)` (R2, đã chạy thử); cascade trước
transaction của `deleteField` (R3); job nền + unique `name` thay khóa Redis + `failRunningIndexJobs()` trước
`database.destroy()` (R4); catalog theo vendor (R5); validate (R6); extractor trả mảng lỗi (R7); card độc lập sau BoForm,
BoSelect + BoSortableList, poll 5 s (R8); controller `backoffice/collections` + service extends ItemsService (R9);
migration `20261103A` và 7 danh sách cứng (R10); parity/deploy (R11), benchmark (R12), E2E (R13); hai lượt (R14).

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23; swc cho `apps/api`, Vite cho
`apps/web`.

**Primary Dependencies**: không gói mới. Có sẵn: NestJS 12, Knex 3.1 (`table.dropIndex`, raw DDL), Joi 18.3.1,
`@backoffice/errors` (`InvalidPayloadError`, `ForbiddenError`, `RecordNotUniqueError`), `@backoffice/system-data`
(`isSystemCollection`), helper schema theo dialect (`getHelpers(knex).schema`), ItemsService (activity/revision), terminus
(`server.ts`); web: Vue 3.5, Reka UI 2.8.2, Tailwind 4.3, `@directus/sdk` 21.3.0, BoTable/BoDialog/BoSelect/
BoSortableList/BoSwitch/BoButton/BoNotice/BoChip, `notify`; test: Vitest 3.2.4, knex-mock-client, supertest, Playwright
1.64.0, autocannon (deploy/benchmark).

**Storage**: bảng mới `backoffice_indexes` (9 cột, index `collection`, unique `name`; [data-model.md](./data-model.md))
qua migration riêng `20261103A` (up only, Knex, 7 vendor, chạy lại được, không FK); các index thật trên bảng người dùng
(`CREATE [UNIQUE] INDEX [CONCURRENTLY]`, `USING gin (lower(col) gin_trgm_ops)`, `CREATE EXTENSION pg_trgm`); không cột/dòng
mới trên `directus_*`; không Redis mới (loại trừ đua bằng unique `name`); không vào response cache (`res.locals.cache =
false`).

**Testing**: unit `apps/api` (migration, dialect helpers với mảng cột/trigram/dropIndex, service + catalog + job +
shutdown, cascade ở fields/collections service, extractor mảng lỗi, controller supertest) và `apps/web` (composable,
card browser test + axe, FieldsManagement dialog, overlay); parity `schema/indexes.test.ts` trên postgres/sqlite/mysql
(trigram chỉ postgres), `accepted-differences` D-210..D-210.4, normalizer, bootstrap cross, deploy `indexes.test.ts` (3
replica, SC-004, SIGTERM); E2E `settings-data-model-indexes.spec.ts` ba cấu hình; benchmark `?search=` ([contracts/tests.md](./contracts/tests.md)).

**Target Platform**: Linux `amd64` container (API); Postgres ≥ 13 (pg_trgm trusted), MySQL 8, SQLite; trình duyệt
desktop/tablet.

**Project Type**: BE (`apps/api`) + FE (`apps/web`, `apps/web-e2e`) + test (`tests/parity`, `tests/benchmark`) + deploy docs.

**Performance Goals**: scenario benchmark hiện có không tệ hơn Directus quá 10 % (không query mới trên đường đọc/ghi
item; extractor chỉ chạy khi có lỗi 23505, tra `backoffice_indexes` chỉ ở MySQL khi tên không khớp mẫu); SC-004 ghi < 2
s trong lúc tạo không khóa; `?search=` với trigram đo Backoffice-only, ghi nhận.

**Constraints**: không sửa `directus/` (I); chỉ bảng `backoffice_*`, migration riêng, không FK (II); endpoint có sẵn
giống Directus, route mới dưới `/backoffice/` ghi D-210, giao diện D-210.4 (III, X); không state quan trọng trong process
(trạng thái job ở DB; job chết thì dòng nói rõ) (IV, VII); parity mọi route mới (V); không biến env mới (VIII); comment
"DR", `Backoffice (spec 030, D-210)` ở file port (IX); coverage BE ≥ 80 %, FE ≥ 60 % (X); card/bảng/dialog từ recipe có
sẵn, trạng thái và bàn phím đủ (XII); không mã lỗi mới (409 của spec thành 400 `INVALID_PAYLOAD`, xem "Sửa câu chữ spec").

**Scale/Scope**: API 1 migration + 5 file mới (`backoffice-indexes.service.ts`, `backoffice-indexes/catalog.ts`,
`backoffice-indexes/jobs.ts`, controller, test helpers) + 12 file sửa (`helpers/schema/types.ts`, `dialects/postgres.ts`,
`dialects/mysql.ts`, `utils/get-default-index-name.ts`, `fields.service.ts`, `collections.service.ts`,
`errors/translate.ts`, `errors/dialects/{postgres,mysql,sqlite}.ts`, `items.service.ts`, `server.ts`, `app.module.ts`,
`providers.ts`, `graphql/schema/index.ts`, `backoffice-migrations/index.ts`, `collections.yaml`); web 2 file mới
(`use-collection-indexes.ts`, `CollectionIndexes.vue`) + 5 sửa (`FieldsRoute.vue`, `FieldsManagement.vue`, overlay ×2,
`test-utils/fetch.ts`); parity 2 mới + 6 sửa; deploy test 1 mới; E2E 1 spec + `allowed-paths`; benchmark 1 sửa; docs 5
file; D-210..D-210.4.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.4.0). Mark PASS, or VIOLATION with a row in Complexity
Tracking.

- [x] I. PASS: không sửa `directus/`; `fields.service.ts`, `collections.service.ts`, `items.service.ts`, helper dialect,
  extractor, `server.ts` giữ `Ported from`, mỗi chỗ sửa ghi `Backoffice (spec 030, D-210)`; file mới ghi "Backoffice (spec
  030)".
- [x] II. PASS: bảng `backoffice_indexes` qua migration riêng `20261103A` (up only, Knex, 7 vendor, `hasTable`, không FK),
  ghi `backoffice_migrations`, chạy bởi `bootstrap`/`init`, kiểm ở `start`; index thật trên bảng người dùng là DDL mà
  Directus cũng cho phép qua `is_indexed`/`is_unique`, không DDL trên `directus_*`; DB vẫn dùng được bởi Directus không
  cần file/config mới (index là ràng buộc DB bình thường).
- [x] III. PASS với D-210 (route chỉ Backoffice, 404 ở Directus), D-210.1 (`/fields` giữ nguyên), D-210.2 (bảng
  `backoffice_*`, normalizer có sẵn), D-210.3 (cascade khi xóa field/collection), D-210.4 (lỗi trùng từng field; Directus
  trả một mục); mọi endpoint có sẵn không đổi đường/response (unit 005/006 + parity `items`, `schema-management` xanh nguyên).
- [x] IV. PASS: không state quan trọng trong process: trạng thái job ở DB (`status`), loại trừ đua bằng unique `name`;
  `Set` job đang chạy chỉ để đánh dấu `failed` khi SIGTERM; mất process thì GET suy `failed` sau 1 giờ (FR-009).
- [x] V. PASS: `schema/indexes.test.ts` cho ba route mới (Directus 404, Backoffice luồng đủ trên ba vendor), `/fields`,
  `/items` ghi trùng hai app, cascade; deploy 3 replica.
- [x] VI. PASS: provider NestJS `BackofficeIndexesService`, controller mỏng, Knex trực tiếp cho DDL; Vue 3 Composition
  API, composable + component.
- [x] VII. PASS: không config FE mới; migration dưới lock `backoffice-migrations` có sẵn; job nền chạy trên replica nhận
  request, trạng thái ở DB nên replica khác thấy; SIGTERM: job đánh dấu `failed` trước khi pool đóng (sửa `server.ts`
  `onSignal`), không chờ DDL lâu (SERVER_SHUTDOWN_TIMEOUT 1 s); không cache process mới.
- [x] VIII. PASS: không biến env mới; `concurrentIndexCreation` là query param có sẵn của Directus.
- [x] IX. PASS: comment "DR"; chuỗi "Backoffice" trong mô tả card; mã lỗi, tên bảng `directus_*` giữ.
- [x] X. PASS: tiếng Việt cho spec/plan, tiếng Anh cho code; coverage; không email; D-210..D-210.4 trong spec, chủ dự án
  kiêm tech lead duyệt sau plan; benchmark `?search=` Backoffice-only ghi nhận; log pino cho job (bắt đầu/xong/lỗi, không
  ghi dữ liệu).
- [x] XI. PASS: không snapshot/apply cho index, không partial/expression/hash/BRIN, không vendor ngoài phạm vi đo.
- [x] XII. PASS: đọc `design-system/README.md`, `component-specs.md` (Card, Table, Modal, Button, SortableList D-60,
  Select, Switch), `layout-patterns.md` §8 (card sau form như 029), `handoff-checklist.md`; card/bảng/dialog/sortable từ
  recipe, token theme, trạng thái (loading/empty/error/creating), bàn phím (menu Move up/down của BoSortableList), nhãn
  liên kết; câu hỏi mở (card cuối trang thay vì ngay sau D-182; icon `database`) ở "Cần xác nhận" của spec, chốt ở analyze.

**Re-check sau Phase 1**: không đổi; không vi phạm. D-210..D-210.4, hai điểm Complexity Tracking và các sửa câu chữ spec
dưới đây: chủ dự án duyệt 2026-11-03 (spec, mục "Duyệt 2026-11-03").

## Project Structure

### Documentation (this feature)

```text
specs/030-collection-indexes/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (R1–R14)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output: api.md, web.md, tests.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/src/
├── database/
│   ├── helpers/schema/types.ts                                  # CreateIndexOptions.type, createIndex(field: string | string[]), dropIndex (R1)
│   ├── helpers/schema/dialects/postgres.ts, mysql.ts (+ .test.ts) # mảng cột; Postgres trigram gin (R1, R2)
│   ├── errors/translate.ts, errors/dialects/{postgres,mysql,sqlite}.ts (+ .test.ts)  # mảng RecordNotUniqueError, tra backoffice_indexes ở MySQL (R7)
│   └── backoffice-migrations/
│       ├── 20261103A-create-backoffice-indexes.ts (+ .test.ts, mới)
│       ├── 20261101A-create-backoffice-passkeys.test.ts, ../validate-migrations.test.ts   # danh sách version (R10)
│       └── index.ts                                             # BACKOFFICE_MIGRATIONS + createBackofficeIndexes
├── utils/get-default-index-name.ts (+ .test.ts)                 # type 'trgm' (R1)
├── services/
│   ├── backoffice-indexes.service.ts (+ .test.ts, mới)          # extends ItemsService: list(+catalog), create(202 + job), remove, dropForField, deleteForCollection (R4, R6, R9)
│   ├── backoffice-indexes/catalog.ts (+ .test.ts, mới)          # listIndexNames theo vendor (R5)
│   ├── backoffice-indexes/jobs.ts (+ .test.ts, mới)             # runIndexJob, running Set, failRunningIndexJobs (R4)
│   ├── fields.service.ts (+ .test.ts)                           # deleteField: dropForField trước transaction (R3, D-210.3)
│   ├── collections.service.ts (+ .test.ts)                      # deleteOne: xóa dòng backoffice_indexes (R3)
│   ├── items.service.ts (+ .test.ts)                            # mảng lỗi từ translateDatabaseError (R7)
│   ├── graphql/schema/index.ts                                  # SYSTEM_DENY_LIST + backoffice_indexes
│   └── index.ts                                                 # export BackofficeIndexesService
├── controllers/backoffice-indexes.controller.ts (+ .test.ts, mới)  # @Controller('backoffice/collections'): :collection/indexes (R9)
├── app.module.ts, providers.ts                                  # controller + useCollection + factory (như 025/029)
└── server.ts (+ .test.ts)                                       # onSignal: failRunningIndexJobs() trước database.destroy() (R4)
libs/system-data/src/collections/collections.yaml (+ index.test.ts)   # backoffice_indexes hidden
apps/web/src/
├── composables/use-collection-indexes.ts (+ .test.ts, mới)      # list/create/remove/indexesOf, available (404 → false), poll 5 s, toast (R8)
├── modules/settings/routes/data-model/
│   ├── components/CollectionIndexes.vue (+ .browser.test.ts, mới)   # card, BoTable, dialog thêm (BoSelect + BoSortableList), dialog xóa (R8)
│   ├── FieldsRoute.vue (+ .test.ts)                             # <CollectionIndexes> sau <BoForm>, v-if !isSystem
│   └── fields/FieldsManagement.vue (+ .test.ts)                 # hộp thoại xóa field: dòng "These indexes will be dropped" (FR-019a)
├── lang/overlay/en-US.ts, vi-VN.ts                              # khối Spec 030 (contracts/web.md)
└── test-utils/fetch.ts                                          # KNOWN_REQUESTS 229–231
apps/web-e2e/src/
├── settings-data-model-indexes.spec.ts (mới)                    # ba cấu hình (R13)
└── helpers/allowed-paths.ts                                     # 229–231
tests/parity/
├── accepted-differences.ts                                      # D-210 (doc), D-210.1 (doc), D-210.2 (doc), D-210.3 (doc), D-210.4 (http)
└── src/
    ├── suite.ts                                                 # REDUCED_FILES + schema/indexes.test.ts
    ├── schema/indexes.test.ts (mới)                             # R11
    ├── normalizers.ts (+ .test.ts)                              # BACKOFFICE_TABLE + indexes, SDL regex
    ├── bootstrap/cross.test.ts, deploy/backoffice-migrations.test.ts   # danh sách version, hasTable
    └── deploy/indexes.test.ts (mới)                             # 3 replica, SC-004, SIGTERM
tests/benchmark/src/items.ts                                     # case SEARCH_LIST có/không trigram (R12)
deploy/README.md                                                 # mục "Index của collection (spec 030)": pg_trgm, timeout, gỡ tay, ngoài snapshot
design-system/docs/component-specs.md                            # recipe Q-xx Collection indexes
specs/006-schema-management/spec.md, specs/016-settings-module/spec.md   # "(030: ...)"
tests/parity/README.md, CLAUDE.md, SPECKIT-GUIDE.md             # 030, D-210..D-210.4
```

**Structure Decision**: không project Nx mới, không lib mới; API ở lớp của bản port (service + controller mỏng như 025,
helper schema mở rộng tại chỗ, không chép logic concurrent của 6 dialect); job nền là một module nhỏ cạnh service, không
worker/queue; parity ở `tests/`; E2E trong `apps/web-e2e` như 014–029.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Không có vi phạm. Hai điểm chủ dự án cần gật cùng lượt duyệt D-210..D-210.4:

| Điểm | Lý do | Cách đơn giản hơn bị bác |
|------|-------|--------------------------|
| Sửa `server.ts` `onSignal` (file port) để đánh dấu job `failed` trước `database.destroy()` | `onServerShutdown` chạy sau khi pool đóng và chỉ 1 s (`shutdown.ts:10-25`, `server.ts:120-129`); không có chỗ nào khác chạy trước pool đóng | Để dòng `creating` tới khi GET suy `failed` sau 1 giờ: chấp nhận được nhưng người dùng chờ 1 giờ sau mỗi deploy; chờ DDL xong: pool đóng sau 1 s, không giữ được |
| `translateDatabaseError` trả mảng lỗi và nhận `knex` (file port, 3 caller) | D-210.4 cần một mục mỗi field; MySQL chỉ cho tên index nên phải tra `backoffice_indexes` | Một mục `field: "a, b"`: không đọc được bằng máy, form web không gắn lỗi vào field |

## Sửa câu chữ spec khi `/speckit.plan` (2026-11-03)

- FR-010: "khóa dùng chung như migration riêng" → "ràng buộc duy nhất trên tên index trong `backoffice_indexes`" (R4:
  đúng cả khi không Redis; kho `local` không loại trừ gì).
- FR-008a/FR-009, Assumptions, US3 kịch bản 6: SIGTERM không chờ job; job đang chạy được đánh dấu `failed` "Server
  shutdown" trước khi pool đóng (R4); quy tắc 1 giờ chỉ cho replica chết không SIGTERM.
- FR-011 và US2 kịch bản 2: `pg_trgm` không cài được → dòng `failed` với thông điệp nêu lệnh (job nền), không 400 (R2).
- FR-013, Edge Cases, data-model: "409" khi dòng đang `creating` → 400 `INVALID_PAYLOAD` "Index is still being created"
  (không mã lỗi mới, Nguyên tắc III/X).
- FR-018, US1: card "Indexes" là card độc lập **sau** BoForm (cuối trang, sau Duplication), không "ngay sau card D-182"
  (BoForm không có slot, R8); ghi "Cần xác nhận" cho design owner.
- Bảng D: D-210, D-210.1, D-210.2, D-210.3 là entry `doc` (route/bảng chỉ Backoffice, test từng app bằng `appRequest` như
  D-189.6, D-207); D-210.4 `http`.
- FR-005/data-model: `missing` là `null` trên MSSQL/Oracle (không kiểm catalog, ngoài phạm vi đo).
