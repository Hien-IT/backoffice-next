# Implementation Plan: Quản lý data model (`/collections`, `/fields`, `/relations`, `/schema`)

**Branch**: `006-schema-management` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-schema-management/spec.md`

## Summary

App mới có bốn nhóm route `/collections`, `/fields`, `/relations`, `/schema` giống hệt Directus 11.17.4: tạo, sửa, xóa
bảng, cột, khóa ngoại thật trong DB bằng cùng Knex và cùng dialect helper, ghi metadata vào `directus_collections`,
`directus_fields`, `directus_relations` bằng cùng dòng; snapshot, diff, apply cùng định dạng và cùng hash; sau mỗi
thay đổi xóa cache hệ thống và response cache trên mọi instance của hai app qua bus `schemaChanged` (002) và phát
event như Directus (005). Gỡ D-09.4. Tiêu chí chấp nhận: data model dựng ở app này mở được và dùng bình thường ở app
kia (snapshot bằng nhau, CRUD item, app Directus).

Cách làm:

- Port nguyên vẹn, cùng đường dẫn, kèm test gốc: `CollectionsService`, `FieldsService` (+ `fields/*`),
  `RelationsService`, `SchemaService`, bảy util snapshot/diff/apply, `schemaMultipartHandler`; bổ sung phần thiếu nhỏ
  (`ALLOWED_DB_DEFAULT_FUNCTIONS`, `addFieldFlag`, `readableStreamToString`, `flushCaches`, type `Collection`,
  `Snapshot*`); thêm `deep-diff`, `busboy`, `zod` cùng bản Directus (research R1, R3, R4). Dialect helper đã đủ (001, 004).
- Bốn controller Nest mỏng theo thứ tự route gốc; `collectionExists` (005) làm `validateCollection`; `router-options`
  thêm 10 mẫu (R2, contracts/schema-api.md).
- Bộ đối chiếu: so DDL nối tiếp trên cùng DB với cùng tên (Clarifications, R5); dùng chéo hai chiều trên fixture 002
  mở rộng và xóa cache qua API (R6); port 8 file blackbox với bốn cặp profile mới cho `schema-cache` và `TZ` (R7); cờ
  `PARITY_BLACKBOX_SETUP_APP` (FR-064); Playwright module Data Model, Content (R9); benchmark năm route đọc hằng tuần
  (R10); constitution 1.4.0 cho DDL trên bảng hệ thống (R11).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

Stack theo prompt của chủ dự án (SPECKIT-GUIDE) và cách feature này đáp ứng:

| Yêu cầu | Ở feature 006 |
|---------|---------------|
| Node 22, pnpm 10, Nx, `apps/api` NestJS strict | Giữ như 001 đến 005 |
| Knex với dialect như `directus/api/src/database/helpers` | DDL qua `getHelpers()` đã port (001, 004): `schema`, `st` (geometry), `date`; không viết SQL tay (contracts/ddl.md) |
| Cache, bus Redis cùng key và kênh Directus | `clearSystemCache`, `flushCaches`, `shouldClearCache`, bus `schemaChanged`, lock `system-cache-lock` (002, 005); không key mới (R8) |
| Validate bằng Joi hoặc Zod giống Directus | Joi của bốn controller và `validateSnapshot`, `validateApplyDiff` giữ nguyên; `zod` 4.1.12 cho `systemFieldUpdateSchema` (R1) |
| Port từ `directus/api/src`, ghi đường dẫn gốc | Bảng ánh xạ file port; manifest `tools/port-manifest/006-T*.json`; guard `check-port-headers` |
| Thư viện nội bộ `@backoffice/*` | `@backoffice/types` thêm `collection.ts`, `snapshot.ts`; `@backoffice/utils` thêm `addFieldFlag`, `readableStreamToString` |
| Env port từ `packages/env`, không đổi tên biến | Không biến mới; `DB_EXCLUDE_TABLES` thuộc nhóm A (R8) |
| Mỗi service Directus một provider, controller mỏng | `CollectionsService`, `FieldsService`, `RelationsService`, `SchemaService` qua `ServiceFactory` trong `providers.ts`; bốn controller chỉ parse, gọi service, `respond` (R2) |
| Vitest; test đối chiếu copy từ `directus/tests/blackbox`; Compose Postgres, MySQL, SQLite, Redis | R5 đến R7, contracts/parity.md; 8 file blackbox port; 4 cặp profile mới |
| GitHub Actions, coverage BE 80% | contracts/parity.md §4; R12 |

**Language/Version**: TypeScript 5.9.3 (bộ cờ strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS, ESM, pnpm
10.27.0, Nx 23.3. Giữ như 001 đến 005.

**Primary Dependencies**:
- Đã có: NestJS 12 (Express 5), knex 3.1.0, `@backoffice/schema` (inspector: `tableInfo`, `columnInfo`, `foreignKeys`),
  `@backoffice/system-data` (`systemCollectionRows`, `systemFieldRows`, `systemRelationRows`, `isSystemField`),
  `@backoffice/constants` (`KNEX_TYPES`, `TYPES`, `DEFAULT_NUMERIC_PRECISION`, `_SCALE`), `@backoffice/utils`
  (`getRelations`, `toArray`, `getSimpleHash`, `parseJSON`, `toBoolean`), `@backoffice/errors`
  (`UnsupportedMediaTypeError` có sẵn), `@backoffice/env`, joi 18.2.6, js-yaml 4.3.2, object-hash 3.0.0, lodash-es,
  wellknown 0.5.0, knex-mock-client 3.0.2, `@backoffice/schema-builder`; dialect helper `database/helpers/{schema,
  geometry,sequence,number,date,fn,capabilities}` với mọi phương thức ba service gọi; `getDefaultIndexName`,
  `translateDatabaseError`, `shouldClearCache`, `clearSystemCache`, `getSchema` (`schema/get-database-schema.ts`),
  `getSystemFieldRowsWithAuthProviders`, `getDefaultValue`, `getLocalType`, `ItemsService`, `PayloadService`,
  `MetaService`, `Emitter` thật, `respond`, `collectionExists`, `validateBatch`, `runMiddleware`, `ServiceFactory`.
- Thêm vào catalog, cùng bản Directus (R1): `deep-diff` 1.0.2 + `@types/deep-diff` 1.0.5, `busboy` 1.6.0 +
  `@types/busboy` 1.5.4, `zod` 4.1.12.
- Không thêm: multer, thư viện diff khác, CLI.

**Storage**:
- DB dùng chung; feature này chạy DDL trên bảng người dùng, cột người dùng trong bảng hệ thống và index trên cột hệ
  thống (Clarifications, Nguyên tắc II 1.4.0); không đổi cột gốc, không migration. Ghi `directus_collections`,
  `directus_fields`, `directus_relations` và dọn `directus_presets`, `directus_revisions`, `directus_activity`,
  `directus_permissions` như Directus ([data-model.md](./data-model.md) §7).
- Redis dùng chung: chỉ các key và kênh đã có (`system-cache-lock`, `schemaChanged`, response cache, permissions
  cache); không key mới.

**Testing**:
- Vitest 3.2.4: 13 file test gốc port kèm code (khoảng 6.300 dòng) + `test-utils/knex.ts`, `__utils__/schemas.ts`;
  test mới cho `RelationsService`, bốn controller (supertest qua app Nest), `flushCaches`, `router-options` (R12).
  Coverage 80% `apps/api`.
- `tests/parity/src/schema-management/` (R5, R6): `crud`, `ddl`, `ddl-capture`, `relations`, `schema`, `cross-use`,
  `sync-api`; `ddl-capture`, `ddl-scenario`; `request-set`, `normalizers`, `blackbox-common` sửa. Blackbox thêm 8 file vào
  `src/items/blackbox/` với shim mở rộng (`URL`, `TZ`, `nodeUrl`, `PARITY_BLACKBOX_SETUP_APP`) và bốn profile
  `schema-cache`, `schema-cache-nomsg`, `tz-asia`, `tz-america` (R7, [contracts/parity.md](./contracts/parity.md)).
- `tests/directus-app-e2e`: `data-model.spec.ts`, `routing.spec.ts`, `backoffice-routes.txt` (R9).
- `tests/benchmark`: `schema.ts`, `seed-schema.ts`, job `benchmark-schema` (R10).

**Target Platform**: Container Linux, nhiều replica cạnh Directus sau load balancer, không sticky session. Giữ như 001.

**Project Type**: Monorepo web (Nx). Chạm `apps/api`, `libs/{types,utils}` (chỉ thêm file port nhỏ), `tests/parity`,
`tests/directus-app-e2e`, `tests/benchmark`, CI, catalog, constitution.

**Performance Goals**:
- SC-007: `GET /collections`, `/fields`, `/relations`, `/schema/snapshot`, `POST /schema/diff` với admin và user một
  phần trên 200 collection, 3.000 field, 300 relation; p95 và req/s không tệ hơn Directus quá 10%; đo hằng tuần,
  không chặn CI (quyết định 003).
- SC-005: thay đổi schema ở app này thấy ở app kia trong 1 giây (ngưỡng SC-001 của 002).
- Không đo thao tác ghi DDL (Clarifications).

**Constraints**:
- DDL và metadata phải trùng Directus trên từng vendor: so cấu trúc DB (inspector) và ba bảng metadata, nối tiếp trên
  cùng DB với cùng tên (FR-060).
- Snapshot và `hash` trùng từng byte: `version` lấy từ `DIRECTUS_COMPAT_VERSION`, cùng `object-hash`, cùng sắp xếp.
- Không thêm biến môi trường; `TZ` của hai cặp profile là biến hệ điều hành.
- Mọi file port ghi `// Ported from directus/...`; manifest `tools/port-manifest/006-T*.json`.
- Tái tạo cả hành vi không an toàn của Directus (không khóa DDL, `updateFields` không transaction, DDL tự commit trên
  MySQL).
- Constitution 1.4.0 (Nguyên tắc II) phải được tech lead duyệt trước khi đóng feature.

**Scale/Scope**:
- Port khoảng 2.900 dòng service, 1.100 dòng util, 700 dòng controller (→ Nest), 150 dòng type, và 6.300 dòng test
  gốc; blackbox copy khoảng 3.900 dòng + seed; mới khoảng 1.800 dòng test đối chiếu, 300 dòng shim và profile, 250
  dòng Playwright, 250 dòng benchmark. Lớn hơn 005 (gần bằng 004); tách `tasks.md` thành hai phần theo research R13
  nếu vượt khoảng 60 task.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.4.0 (ban hành 2026-10-12 theo Clarifications của feature này; lần 1
đối chiếu v1.3.0 ghi một vi phạm chữ của Nguyên tắc II, nay đã giải bằng bản 1.4.0, xem Complexity Tracking). Kết quả
dưới đây là lần 2, sau research, data model và contracts.

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`. Mọi file port ghi `// Ported from directus/...` (bảng ánh
  xạ bên dưới, manifest `tools/port-manifest/006-T*.json`). Chỗ khác nguồn ghi `Backoffice:`: `version` →
  `DIRECTUS_COMPAT_VERSION` (ba util), đường dẫn `getSchema`, `getSystemFieldRowsWithAuthProviders`, controller Nest,
  `schemaMultipartHandler` qua `runMiddleware`, một `if` chặn collection hệ thống ở đầu `deleteOne` (D-32), khối
  `tests_extensions_log` và `spawn` bỏ trong blackbox.
- [x] **II. Dùng chung DB**: PASS (v1.4.0). DDL chỉ trên bảng người dùng qua API collections/fields/relations, cột
  người dùng thêm vào collection hệ thống và index trên cột hệ thống (được phép từ 1.4.0, như Directus). Không đổi
  cột gốc, không xóa bảng hệ thống (D-32), không migration; khởi động không ghi gì. Dòng metadata giống Directus vì
  đi qua service port nguyên (SC-003 so trên từng vendor).
- [x] **III. API giống hệt**: PASS. Route, middleware, Joi, zod, status, mã lỗi, message, header, `OPTIONS`, `204`,
  multipart như Directus (contracts/schema-api.md, snapshot.md). D-09.4 gỡ. Một khác biệt mới D-32
  (`DELETE /collections/directus_<x>` trả `403` thay vì xóa bảng hệ thống như Directus; Nguyên tắc II, ghi ở spec,
  `accepted-differences.ts`, cần tech lead duyệt) và rủi ro tái tạo R-11 (`PATCH /collections/directus_<x>` tạo dòng
  metadata như Directus).
- [x] **IV. Chạy song song an toàn**: PASS. Cùng `clearSystemCache`, `flushCaches`, `shouldClearCache` và bus
  `schemaChanged` (002, 005); `sync-api.test.ts` kiểm hai chiều và response cache. Không state mới trong process;
  không lock mới (Directus không khóa DDL).
- [x] **V. Kiểm thử đối chiếu**: PASS. Mỗi route có `crud.test.ts`; DDL và metadata có `ddl`, `relations`; snapshot
  có `cross-use` và blackbox `schema.test.ts`; 8 file blackbox port hai lượt; Postgres đủ mỗi lần push, MySQL, SQLite
  rút gọn mỗi lần push và đủ hằng tuần, còn lại nightly (FR-061).
- [x] **VI. Kiến trúc**: PASS. Bốn controller mỏng; bốn service là lớp Directus, factory trong `providers.ts`; Knex,
  không ORM; mỗi thay đổi có test (R12).
- [x] **VII. Đa instance**: PASS. Schema trong process dựng lại từ DB và bị xóa qua bus (002); không cache mới; khởi
  động chỉ đọc; cặp `schema-cache-nomsg` chỉ là môi trường test tái tạo Directus không bus.
- [x] **VIII. Biến môi trường**: PASS. Không biến mới; `DB_EXCLUDE_TABLES` thuộc `DB_.+` nhóm A; `TZ` là biến hệ điều hành.
- [x] **IX. Đổi thương hiệu**: PASS. Giữ key `directus` trong snapshot, message `...directus version...`, tên event,
  tên bảng, tên index và khóa ngoại (định dạng dữ liệu và tên kỹ thuật dùng chung). Không nhãn người dùng mới.
- [x] **X. Chất lượng và vận hành**: PASS. Coverage 80%. Benchmark hằng tuần (ngoại lệ đã duyệt ở 003). Playwright là
  cổng chặn (004). Không gửi email. Khác biệt (gỡ D-09.4) và constitution 1.4.0 cần tech lead duyệt trước khi đóng
  feature; bảng của spec 001, 004, 005 sửa theo (R11).
- [x] **XI. Ngoài phạm vi**: PASS. Không extension (khẳng định `tests_extensions_log` của blackbox bỏ), không CLI
  (Clarifications), không GraphQL (về Directus tới 011), không WebSocket.

## Project Structure

### Documentation (this feature)

```text
specs/006-schema-management/
├── plan.md              # File này
├── research.md          # Phase 0: R1–R13
├── data-model.md        # Phase 1: collection, field, relation, snapshot, diff, bảng hệ thống ghi, cache, event
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── schema-api.md        # route, middleware, OPTIONS, thứ tự lỗi, quyền đọc, cache
│   ├── ddl.md               # ánh xạ kiểu, tên index và khóa ngoại, sửa xóa, bảng hệ thống, vendor
│   ├── snapshot.md          # snapshot, diff, apply, hash, dùng chéo
│   └── parity.md            # test đối chiếu, blackbox, profile, CI, Playwright, benchmark
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

Chỉ liệt kê phần thêm hoặc sửa. Cấu trúc chung giữ như plan 001 đến 005.

```text
backoffice-next/
├── pnpm-workspace.yaml                         # catalog: deep-diff, @types/deep-diff, busboy, @types/busboy, zod
├── libs/
│   ├── types/src/{collection,snapshot}.ts      # MỚI ← packages/types/src/{collection,snapshot}.ts; index.ts SỬA
│   └── utils/src/
│       ├── shared/add-field-flag.ts (+ test)   # MỚI ← packages/utils/shared/add-field-flag.ts
│       └── node/readable-stream-to-string.ts (+ test)   # MỚI ← packages/utils/node/readable-stream-to-string.ts
├── apps/api/
│   ├── package.json                            # SỬA: deep-diff, busboy, zod
│   └── src/
│       ├── constants.ts                        # SỬA: ALLOWED_DB_DEFAULT_FUNCTIONS
│       ├── cache.ts (+ test)                   # SỬA: flushCaches
│       ├── app.module.ts, providers.ts         # SỬA: 4 controller; factory Collections, Fields, Relations, Schema
│       ├── middleware/router-options.ts (+ test)   # SỬA: 10 mẫu (contracts/schema-api.md §3)
│       ├── services/collections.service.ts (+ test gốc)   # MỚI ← services/collections.ts
│       ├── services/fields.service.ts (+ test gốc)        # MỚI ← services/fields.ts
│       ├── services/fields/{build-collection-and-field-relations,get-collection-meta-updates,get-collection-relation-list}.ts (+ test gốc)   # MỚI
│       ├── services/relations.service.ts (+ test mới)     # MỚI ← services/relations.ts
│       ├── services/schema.service.ts (+ test gốc)        # MỚI ← services/schema.ts
│       ├── services/index.ts                   # SỬA
│       ├── utils/{get-snapshot,get-snapshot-diff,apply-diff,validate-snapshot,validate-diff,sanitize-schema,get-versioned-hash}.ts (+ test gốc)   # MỚI
│       ├── test-utils/knex.ts, __utils__/schemas.ts       # MỚI ← test-utils/knex.ts, __utils__/schemas.ts (chỉ test)
│       ├── controllers/collections.controller.ts (+ test)  # MỚI ← controllers/collections.ts (Nest)
│       ├── controllers/fields.controller.ts (+ test)       # MỚI ← controllers/fields.ts
│       ├── controllers/relations.controller.ts (+ test)    # MỚI ← controllers/relations.ts
│       ├── controllers/schema.controller.ts (+ test)       # MỚI ← controllers/schema.ts (schemaMultipartHandler giữ nguyên)
│       └── config/supported-variables.ts       # không đổi (ghi chú 006: không biến mới)
├── tests/parity/
│   ├── docker-compose.yml                      # SỬA: 4 cặp profile (contracts/parity.md §3)
│   ├── env/profile-{schema-cache,schema-cache-nomsg,tz-asia,tz-america}.env   # MỚI
│   ├── proxy/backoffice-routes.txt             # SỬA: collections, fields, relations, schema
│   ├── accepted-differences.ts                 # SỬA: xóa D-09.4
│   ├── README.md                               # SỬA: mục 006
│   ├── src/{suite,config,global-setup,request-set,normalizers}.ts   # SỬA
│   ├── src/schema/clear-system-cache.ts        # SỬA: comment
│   ├── src/schema/fixture.ts                   # SỬA: tham số app, thêm folder, m2a, presentation, group, geometry, archive, sort
│   ├── src/permissions/blackbox-common.test.ts # SỬA: phần hoãn của common.test.ts
│   ├── src/schema-management/                  # MỚI (contracts/parity.md §1)
│   │   ├── ddl-capture.ts, ddl-scenario.ts
│   │   └── {crud,ddl,ddl-capture,relations,schema,cross-use,sync-api}.test.ts
│   └── src/items/blackbox/
│       ├── common/{config,functions}.ts (+ config.test.ts)   # SỬA: URL, TZ, nodeUrl, PARITY_BLACKBOX_SETUP_APP, TEST_NO_CACHE
│       └── tests/db/{routes/collections/**,routes/fields/**,routes/schema/**,schema/timezone/**}   # MỚI (8 file test + seed)
├── tests/directus-app-e2e/src/data-model.spec.ts   # MỚI (R9); routing.spec.ts SỬA
├── tests/benchmark/src/{schema,seed-schema}.ts     # MỚI (R10); project.json, docker-compose.yml SỬA
├── tools/port-manifest/006-T*.json             # MỚI
├── tools/ci-local.sh                           # SỬA
├── .github/workflows/{ci,parity-matrix,benchmark}.yml   # SỬA (contracts/parity.md §4)
├── .specify/memory/constitution.md             # SỬA: 1.4.0, Nguyên tắc II (R11); plan-template.md dòng II
├── specs/001-platform-foundation/spec.md       # SỬA: D-09.4
└── specs/{004-permissions,005-items}/spec.md   # SỬA: Assumptions về seed (FR-064)
```

**Structure Decision**:
- Theo cấu trúc 001 đến 005: file của `directus/api/src` vào cùng đường dẫn trong `apps/api/src`; service và
  controller có hậu tố `.service.ts`, `.controller.ts`; `services/fields/` giữ cây con như gốc.
- Blackbox 006 thêm vào cây `tests/parity/src/items/blackbox/` (cùng shim, cùng cặp `blackbox`) thay vì thư mục mới,
  tránh hai bản shim.
- Test đối chiếu mới đặt trong `tests/parity/src/schema-management/`; fixture 002 dùng lại qua tham số app.

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/`) | Đích | Ghi chú |
|---------------------|------|---------|
| `api/src/services/collections.ts` (+ test) | `apps/api/src/services/collections.service.ts` | Nguyên; import `getSchema` từ `schema/` |
| `api/src/services/fields.ts` (+ test), `services/fields/*.ts` (+ test) | `apps/api/src/services/fields.service.ts`, `services/fields/` | Nguyên; `systemFieldRows` từ `schema/get-field-system-rows.ts` |
| `api/src/services/relations.ts` | `apps/api/src/services/relations.service.ts` | Nguyên; test mới |
| `api/src/services/schema.ts` (+ test) | `apps/api/src/services/schema.service.ts` | Nguyên |
| `api/src/utils/{get-snapshot,get-snapshot-diff,apply-diff,validate-snapshot,validate-diff,sanitize-schema,get-versioned-hash}.ts` (+ test) | `apps/api/src/utils/` | `version` → `DIRECTUS_COMPAT_VERSION` ở ba file |
| `api/src/controllers/{collections,fields,relations,schema}.ts` | `apps/api/src/controllers/*.controller.ts` | Nest; test mới |
| `api/src/test-utils/knex.ts`, `__utils__/schemas.ts` | `apps/api/src/test-utils/knex.ts`, `__utils__/schemas.ts` | Chỉ cho test |
| `api/src/constants.ts` (`ALLOWED_DB_DEFAULT_FUNCTIONS`), `cache.ts` (`flushCaches`) | `apps/api/src/constants.ts`, `cache.ts` | Thêm hàm, hằng |
| `packages/types/src/{collection,snapshot}.ts` | `libs/types/src/` | Nguyên |
| `packages/utils/shared/add-field-flag.ts` (+ test), `utils/node/readable-stream-to-string.ts` (+ test) | `libs/utils/src/{shared,node}/` | Nguyên |
| `tests/blackbox/tests/db/routes/{collections,fields,schema}/**`, `tests/db/schema/timezone/**` | `tests/parity/src/items/blackbox/tests/db/...` | Copy nguyên; sửa ở contracts/parity.md §2 |
| `tests/blackbox/common/common.test.ts` (phần data model) | `tests/parity/src/permissions/blackbox-common.test.ts` | Thêm vào file 004 |

### Phần không port hoặc hoãn

| Phần | Lý do | Thay ở |
|------|-------|--------|
| `utils/apply-snapshot.ts` (+ test) | Chỉ CLI gọi; CLI ngoài phạm vi (Clarifications) | — |
| Extension `action-verify-schema`, bảng `tests_extensions_log` của blackbox | Nguyên tắc XI, D-17 | — |
| GraphQL `/graphql/system` trong blackbox | Về Directus qua shim | 011 |
| `POST /utils/cache/clear`, `POST /utils/sort` | Về Directus (blackbox, proxy) | 010 |
| Node `CACHE_SCHEMA=false` của blackbox (`TEST_NO_CACHE`) | Shim bỏ qua; bus dùng chung xóa schema | — |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (Đã giải) Nguyên tắc II bản 1.3.0: DDL trên bảng hệ thống (`ALTER TABLE directus_users ADD COLUMN <field người dùng>`, `CREATE INDEX` trên cột hệ thống qua `schema.is_indexed`, `systemFields` của apply) | Directus cho phép và app Directus, bộ blackbox `change-fields.test.ts`, ma trận quyền 004 dựa vào đó; chủ dự án chọn làm như Directus (Clarifications, FR-024). Constitution 1.4.0 ban hành 2026-10-12 (trước khi implement, theo `/speckit.analyze` C1): Nguyên tắc II cấm cột gốc, xóa bảng hệ thống và migration, cho phép cột người dùng và index như Directus (R11) | Từ chối (B, C): thêm khác biệt D-32, D-33; data model có field như vậy không tạo hoặc apply được ở app mới, trái tiêu chí "và ngược lại" |

Các ngoại lệ đã duyệt của 001 đến 005 vẫn áp dụng: benchmark hằng tuần thay vì chặn CI (003); store `memory` với cảnh
báo một instance (001); bus local khi không có Redis (002). Gỡ D-09.4 và D-32 cần tech lead duyệt trước khi đóng
feature (Nguyên tắc X).

Rủi ro đã biết, theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| Helper hoặc util thiếu lộ ra khi typecheck ba service (ngoài danh sách R3) | Gói A chậm | Task đầu: port ba service rồi typecheck, port bổ sung theo lỗi, mỗi file một manifest |
| Truy vấn index theo vendor của `db-snapshot.ts` không đủ (`unique`, thứ tự cột) | `ddl.test.ts` so sai | Task đo trên Postgres, MySQL, SQLite với một bảng mẫu trước khi viết ma trận (R5) |
| Snapshot lệch do `getLocalType` hoặc inspector của app mới khác Directus ở một vendor | SC-004, SC-006 đỏ | `cross-use` chạy sớm ở gói C; lệch là lỗi của 002 hoặc `@backoffice/schema`, sửa ở đó |
| Blackbox 8 file thêm 5–10 phút mỗi lượt; 8 container thêm ở `parity-blackbox` | Job dài, bộ nhớ runner | Profile chỉ bật ở `parity-blackbox` và `blackbox-full`; bốn file tự bỏ qua khi vắng profile |
| Ca timezone chọn `TZ` theo offset máy chạy test | Lệch cặp profile | Shim ném lỗi rõ khi `TZ` khác hai giá trị; runner CI là UTC |
| Ca fail trên chính Directus ở một vendor | Lượt `directus` đỏ | `it.skipIf` theo vendor kèm ghi chú (Assumptions) |
| `updateFields` không transaction, MySQL tự commit DDL | Ca "lỗi giữa chừng" để lại trạng thái dở | So trạng thái dở hai bên, dọn bằng `dropCollections` ở `afterAll` |
| Guard `accepted-differences` đỏ khi xóa `D-09.4` trước khi spec `Done` | CI đỏ | Xóa entry trong commit đóng feature (R11) |
| D-32 (`DELETE /collections/directus_*` của Directus xóa bảng hệ thống) | Đã đo ở T010: Directus xóa bảng, D-32 giữ | — |
| Benchmark seed 3.000 field qua API chậm | Job dài | Seed một lần, đo; chỉnh quy mô nếu quá 15 phút (Assumptions của spec) |
