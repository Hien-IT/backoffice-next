# Implementation Plan: API chặn tìm kiếm, Import, Export theo cài đặt của collection

**Branch**: `024-collection-toggles-api` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=024-collection-toggles-api`) | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-collection-toggles-api/spec.md`

## Summary

Ba cài đặt `bo_show_search`, `bo_show_import`, `bo_show_export` của spec 022 nay điều khiển cả API Backoffice: collection
tắt cài đặt nào thì mọi request HTTP của Backoffice vào phần đó (từ khóa `search` ở REST, body `query`, `deep._search`,
đối số `search` của GraphQL kể cả field lồng và mutation; `?export=` và `POST /utils/export`; `POST /utils/import`) nhận
403 `FORBIDDEN` cho mọi người gọi, kể cả admin (D-188..D-188.2); flow, extension và service nội bộ không đổi (FR-009);
Directus 11.17.4 cùng DB vẫn trả 200 (D-188, ở shared-domain request rơi vào Directus không bị chặn). Web: drawer chọn
item và ô "Search Filter" của `list-o2m`, `list-m2m` ẩn ô nhập từ khóa theo cài đặt của collection nhận từ khóa
(D-188.3). Không bảng, cột, migration, dependency mới; không sửa constitution.

Cách làm (chi tiết ở [research.md](./research.md)): một util `collection-toggles.ts` đọc ba cột từ cache schema trong
process (`localSchemaCache`, xóa theo bus `schemaChanged` như SchemaOverview của 002; R1) và một hàm
`assertCollectionToggles(collection, query, schema)` dùng chung cho REST và GraphQL (từ khóa gốc, `export`, đi `deep` theo
quan hệ; R2); middleware `collectionTogglesGuard` ngay trước `checkCacheMiddleware` chặn REST trước khi đọc response
cache và bỏ đọc cache cho document GraphQL có `search` (R3); resolver GraphQL kiểm sau khi biết tên collection thật và
trước khi ghi (R4); web: `showSearch`/`activeSearch` như Content cho DrawerCollection, `list-o2m`, `list-m2m` (R5); parity
file mới + D-188 `http` (R7); E2E đảo bước API và thêm drawer/o2m (R6); hai lượt (R10).

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict (cờ của `@directus/tsconfig`), Node.js 22 LTS, ESM, pnpm 10.27, Nx 23;
swc build cho `apps/api`; Vite cho `apps/web`.

**Primary Dependencies**: có sẵn, không thêm: NestJS 12 (Express 5), Knex 3.1, Keyv (cache của 002), `@backoffice/errors`
(`ForbiddenError`), `@backoffice/utils` (`getRelation`, `getRelationInfo`), graphql 16.12.0 (resolver, không đổi schema);
web: Vue 3.5, Reka UI 2.8.2, Tailwind CSS 4.3, `@directus/sdk` 21.3.0; test: Vitest 3.2.4, `knex-mock-client`, Playwright
1.64.0, autocannon.

**Storage**: không bảng, cột, migration, dòng `directus_*` mới; đọc ba cột `bo_show_*` của `directus_collections` (migration
`20261026A`, có mặt vì `start` kiểm tra migration riêng, FR-016 của 022); một key mới `collection-toggles` trong
`localSchemaCache` (Keyv memory, namespace `_schema`, xóa cùng SchemaOverview); không Redis key mới; response cache dùng
chung không đổi key.

**Testing**: Vitest unit (`apps/api`: `utils/collection-toggles`, `middleware/collection-toggles-guard`,
`middleware/cache` (cờ bỏ đọc), `controllers/items`, `controllers/utils`, `services/graphql/resolvers/query`, `mutation`;
`apps/web`: `DrawerCollection`, `ListO2M`, `ListM2M`); parity env chính (`items/collection-toggles.test.ts` Postgres full +
reduced sqlite3/mysql, `accepted-differences` D-188 `http`, case cache do Directus ghi trước, case flow `item-read` có từ
khóa ở `flows/operations.test.ts`); E2E `content-collection-toggles.spec.ts` (đảo bước API, thêm drawer và `list-o2m`)
ba cấu hình (proxy-directus mong 200, D-188); benchmark `benchmark-items` và `benchmark-web` hiện có (SC-006).

**Target Platform**: Linux `amd64` container (API), trình duyệt desktop/tablet (Chrome, Edge, Firefox, Safari).

**Project Type**: BE (`apps/api`) + FE (`apps/web`, `apps/web-e2e`) + test (`tests/parity`).

**Performance Goals**: scenario benchmark hiện có không tệ hơn Directus quá 10 % (SC-006): request đọc items thêm một
lần tra map trong process (cache miss: một `select` nhỏ trên `directus_collections`); khi có collection tắt tìm kiếm,
request GraphQL có chữ `search` không được trả từ cache ở Backoffice (R3, D-188.4, giới hạn ghi `ponytail:`).

**Constraints**: không sửa `directus/` (I); không DDL, không migration (II); API/GraphQL giống Directus trừ D-188..D-188.4
(III, V: `http` entry theo collection `parity_toggles_*`); chặn chỉ ở lớp HTTP, không sửa `ItemsService`, `ImportService`,
`ExportService` (FR-009); không biến env mới (VIII); comment code ghi "DR" (IX); coverage BE ≥ 80 %, FE ≥ 60 % (X); không
UI mới, chỉ ẩn ô có sẵn (XII).

**Scale/Scope**: API 2 file mới (`utils/collection-toggles.ts`, `middleware/collection-toggles-guard.ts`) + 6 file sửa
(`app-pipeline.ts`, `middleware/cache.ts`, `controllers/items.controller.ts`, `controllers/utils.controller.ts`,
`services/graphql/resolvers/query.ts`, `mutation.ts`) + test; web 3 file sửa (`DrawerCollection.vue`, `ListO2M.vue`,
`ListM2M.vue`) + test; parity 1 file mới + 3 sửa; E2E 1 spec sửa; docs 5 file; D-188..D-188.4.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.2.0). Mark PASS, or VIOLATION with
a row in Complexity Tracking.

- [x] I. PASS: không file nào trong `directus/` đổi; các file port sửa (`cache.ts`, `items.controller.ts`,
  `utils.controller.ts`, `query.ts`, `mutation.ts`, `app-pipeline.ts`) giữ header nguồn và ghi comment
  `// Backoffice (spec 024, D-188)` tại chỗ sửa; hai file mới là của Backoffice.
- [x] II. PASS: không bảng, cột, migration; đọc cột `bo_*` của migration 20261026A (3.2.0); DB dùng được với Directus
  11.17.4 không đổi.
- [x] III. PASS với D-188..D-188.4 ghi trong spec (chấp nhận 2026-10-27, câu chữ duyệt sau plan): mọi request không bị
  chặn giữ path, query, response, status, header, cookie như Directus (FR-011); request bị chặn 403 `FORBIDDEN` cùng
  thân lỗi của `ForbiddenError`.
- [x] IV. PASS: không state riêng trong process ngoài cache schema đã có (xóa theo bus `schemaChanged` trên mọi replica,
  R1); response cache chung không đổi key; không lock, không bus mới.
- [x] V. PASS: parity `items/collection-toggles.test.ts` (D-188 `http`, đối chứng `assertParity` khi toggle bật), kể cả
  endpoint hệ thống có từ khóa qua quan hệ (`GET /users` `deep`, `/graphql/system` field lồng; thêm khi analyze
  2026-10-27, C1), case cache, đổi cài đặt ở Directus không xóa cache tay, flow, extension; blackbox không đổi
  (contracts/tests.md).
- [x] VI. PASS: không service mới; util + middleware ở `apps/api/src/{utils,middleware}`, kiểm trong controller và
  resolver (controller mỏng: một dòng gọi hàm dùng chung); Vue 3 Composition API, computed nhỏ.
- [x] VII. PASS: không ảnh hưởng khởi động; cache toggles trong process rebuild từ DB và xóa qua bus Redis trên mọi
  instance như SchemaOverview (002); FE không cấu hình mới.
- [x] VIII. PASS: không biến môi trường mới.
- [x] IX. PASS: không chuỗi mới cho người dùng (lỗi là `ForbiddenError` có sẵn); comment "DR".
- [x] X. PASS: coverage qua unit test (contracts/tests.md); hiệu năng: một tra map mỗi request, benchmark hiện có; log
  pino không đổi (403 ghi như lỗi quyền hiện nay); không email; khác biệt D-188..D-188.4 trong spec.
- [x] XI. PASS: không chạm mục ngoài phạm vi.
- [x] XII. PASS: đã đọc `design-system/README.md`, `docs/component-specs.md`, `docs/layout-patterns.md`,
  `qa/handoff-checklist.md`; không component, màu hay bố cục mới: chỉ ẩn ô nhập từ khóa có sẵn bằng prop `showSearch`
  của `SearchInput` (022) và `v-if` của `list-o2m`/`list-m2m`; nút bộ lọc giữ tên đọc được; không câu hỏi mở.

Post-design re-check (sau Phase 1): không đổi; "Sửa spec khi plan" (research R11) là câu chữ FR-012, FR-013, FR-014, D-188
và Edge Cases, áp vào spec cùng commit plan.

## Project Structure

### Documentation (this feature)

```text
specs/024-collection-toggles-api/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (R1–R11)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output: api.md, web.md, tests.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/src/
├── utils/collection-toggles.ts (+ .test.ts)                    # getCollectionToggles (cache), assertToggle, assertCollectionToggles (R1, R2)
├── middleware/collection-toggles-guard.ts (+ .test.ts)         # path → collection gốc, kiểm REST trước cache; cờ skipCacheRead cho /graphql (R2, R3)
├── middleware/cache.ts (+ .test.ts)                            # return next() khi res.locals.skipCacheRead (R3)
├── app-pipeline.ts                                             # app.use(collectionTogglesGuard) trước checkCacheMiddleware
├── controllers/items.controller.ts (+ .test.ts)                # SEARCH sau validateBatch, PATCH/DELETE theo query (R2)
├── controllers/utils.controller.ts (+ .test.ts)                # import: assertToggle trước busboy; export: toggle + query body (R2)
└── services/graphql/resolvers/
    ├── query.ts (+ .test.ts)                                   # assertCollectionToggles trước gql.read (R4)
    └── mutation.ts (+ .test.ts)                                # sau khi bỏ hậu tố, trước upsert/service (R4)
apps/web/src/
├── components/drawers/DrawerCollection.vue (+ .test.ts)        # showSearch, activeSearch, :show-search (R5)
├── interfaces/list-o2m/ListO2M.vue (+ .test.ts)                # showSearch theo relatedCollection.meta (R5)
└── interfaces/list-m2m/ListM2M.vue (+ .test.ts)                # showSearch theo junctionCollection.meta (R5)
apps/web-e2e/src/
└── content-collection-toggles.spec.ts                          # đảo bước API (403 ở proxy-api, cors; 200 ở proxy-directus), drawer, list-o2m (R6)
tests/parity/
├── accepted-differences.ts                                     # D-188 (http), D-188.1..D-188.4 (doc)
└── src/
    ├── suite.ts                                                # + items/collection-toggles.test.ts (reduced, full)
    ├── items/collection-toggles.test.ts (mới)                  # R7
    └── flows/operations.test.ts                                # case item-read có search trên collection tắt (FR-009)
specs/022-collection-ui-toggles/spec.md                         # ghi chú "sửa bởi 024" ở FR-008, FR-009
deploy/README.md, tests/parity/README.md, CLAUDE.md, SPECKIT-GUIDE.md   # D-188, 024
specs/024-collection-toggles-api/spec.md                        # câu chữ R11
```

**Structure Decision**: không project Nx mới, không lib mới; util và middleware ở đúng lớp của bản port (`utils/`,
`middleware/`), chỗ kiểm là controller và resolver (lớp HTTP, FR-009); parity ở `tests/parity`; E2E trong
`apps/web-e2e` như 014–023.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Không có vi phạm: D-188, D-188.1, D-188.2, D-188.3, D-188.4 là khác biệt API ghi trong spec theo Nguyên tắc X (chủ dự án chấp
nhận 2026-10-27, duyệt câu chữ sau plan); không sửa constitution.
