# Implementation Plan: Phân quyền (users, roles, policies, access, permissions)

**Branch**: `004-permissions` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-permissions/spec.md`

## Summary

App mới tính accountability và áp quyền giống hệt Directus 11.17.4 cho mọi request, và cung cấp `/users`, `/roles`,
`/policies`, `/access`, `/permissions` (CRUD, `/users/me*`, `/users/invite*`, `/users/register*`, TFA bật tắt,
`/roles/me`, `/policies/me/globals`, `/permissions/me*`). Theo Clarifications, feature này port **toàn bộ engine đọc và
ghi** của Directus (`get-ast-from-query`, `run-ast`, `ItemsService`, `PayloadService`, `MetaService`, helper theo
dialect) vì kiểm quyền đọc nằm trong engine; feature 005 chỉ còn `/items`, singleton, response cache, `export`,
event và bus `websocket.event`.

Cách làm:

- Port nguyên vẹn, cùng đường dẫn, kèm test gốc: module `permissions/**` còn thiếu, engine, năm service, util query
  (`sanitize-query`, `validate-query`, `validate-batch`, `get-service`), helper dialect, và các hàm của
  `@directus/utils` mà chúng import (research R1, R4, R5).
- `authenticate` chạy cho mọi path; `sanitizeQuery` vào pipeline sau `schema` (R2). Gỡ D-10, D-18 (cảnh báo), D-09.2,
  D-09.10; thu hẹp D-12 còn `export`.
- Năm controller Nest mỏng theo đúng thứ tự route của file gốc; `validateBatch`, `useCollection` thành hàm gọi trong
  handler; `@Search()` (R3).
- Emitter stub không phát (D-29, R8); email mời và xác minh thay bằng log (D-27, D-28, R9); `getService` trả
  `ItemsService` cho collection hệ thống chưa có service riêng (D-31, R6).
- Cache: thêm namespace `policies-ip-access`, `share-info`; `filter-context-*` trong cache dữ liệu (snappy); xóa cache
  dữ liệu dùng chung ở mọi điểm Directus xóa (R7).

Test đối chiếu: thư mục `tests/parity/src/permissions/` (ma trận quyền FR-101, CRUD, route riêng, mời, đăng ký, TFA,
cache dùng chéo, port `common.test.ts` và `check-item-permissions.test.ts`), chạy lại bộ 003 (R13); unit test port
(R15); reverse proxy + Playwright cho app Directus, cổng chặn merge mới (R12); benchmark hằng tuần (R14).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (bộ cờ strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS, ESM, pnpm
10.27.0, Nx 23.3. Giữ như 001 đến 003.

**Primary Dependencies**:
- Đã có: NestJS 12.1.2 (Express 5.2.1, `router` 2.2.0, nhận `SEARCH`), knex 3.1.0, ioredis 5.8.2, keyv 5.5.3,
  `@keyv/redis`, joi 18.2.6, jsonwebtoken 9.0.3, argon2 0.44.0, otplib 12.0.1, date-fns 4.1.0, wellknown 0.5.0,
  lodash-es, nanoid, rate-limiter-flexible 7.2.0, knex-mock-client 3.0.2, `@playwright/test` 1.64.0, autocannon 8.
- Thêm vào catalog, cùng bản Directus: `snappy` 7.3.3 (nén giá trị cache dữ liệu), `ip-matching` 2.1.2 (kiểm
  `ip_access`), `@types/wellknown` 0.5.8 (research R1).
- Lib: `@backoffice/utils` thêm khoảng 22 file port từ `packages/utils/shared` (`parse-filter`, `generate-joi`,
  `validate-payload`, `deep-map-with-schema`, `compress`...); `@backoffice/types` thêm type của engine (`services.ts`,
  `users.ts`, `events.ts` đủ hơn); `@backoffice/system-data` đã có quyền tối thiểu của app.
- Không thêm `nodemailer`, `liquidjs` (không gửi email), `json2csv` (005), `uuid`, `geojson`.

**Storage**:
- DB dùng chung, không DDL. Bảng đọc và ghi theo [data-model.md](./data-model.md) §1 và
  [contracts/db-writes.md](./contracts/db-writes.md): năm collection, `directus_sessions`, `directus_activity`,
  `directus_revisions`, `directus_presets`, `directus_comments`, `directus_notifications`, `directus_versions`,
  `directus_settings`, `directus_shares`, và mọi collection ghi lồng.
- Redis dùng chung ([contracts/cache.md](./contracts/cache.md)): 8 namespace cache quyền (`permissions:*`),
  `filter-context-*` và xóa `<CACHE_NAMESPACE>:*` (cache dữ liệu), cache hệ thống + bus `schemaChanged`,
  `multi-cache`, limiter đăng ký `rlflx:*`. Không có key hay kênh nào Directus không dùng.

**Testing**:
- Vitest 3.2.4: test port từ Directus (`get-ast-from-query`, `run-ast`, helper, `permissions/**`, `items`, `payload`,
  `meta`, `users`, `roles`, `sanitize-query`, `validate-query`, `validate-batch`, `@directus/utils`) và test mới cho
  năm controller, ba service không có test gốc, `emitter`, `get-service` (research R15).
- `tests/parity`: thư mục `src/permissions/` (research R13); Postgres `full` thêm profile `app`; MySQL, SQLite
  `reduced` thêm `matrix-reduced`, `users`, `roles`, `write-rules`; `request-set` thêm request đọc của 004;
  `errors.test.ts`, `permissions-cache.test.ts`, `accepted-differences.ts` sửa theo research R10.
- `tests/directus-app-e2e`: Playwright qua reverse proxy, job CI `e2e-directus-app` chặn merge
  ([contracts/proxy-e2e.md](./contracts/proxy-e2e.md)).
- `tests/benchmark`: `permissions.ts`, `seed-permissions.ts`, job `benchmark-permissions` hằng tuần (research R14).

**Target Platform**: Container Linux, nhiều replica cạnh Directus sau load balancer, không sticky session. Giữ như 001.

**Project Type**: Monorepo web (Nx). Feature này chạm BE và test: `apps/api`, `libs/utils`, `libs/types`,
`tests/parity`, `tests/directus-app-e2e` (mới), `tests/benchmark`, CI.

**Performance Goals**:
- SC-006: với 2.000 user, cây role ba tầng, mỗi user ba policy, permission có biến động: p95 và req/s của
  `GET /users/me`, `GET /permissions/me`, `GET /users` (user không admin) không tệ hơn Directus quá 10%; đo hằng tuần
  (quyết định 2026-10-11 của 003, không chặn CI).
- SC-003: quyền mới có hiệu lực ở request đầu tiên sang app kia (cache dùng chung).
- Các endpoint của 001 đến 003 giữ ngưỡng cũ.

**Constraints**:
- Chỉ ghi DB qua `ItemsService` theo luồng của Directus (contracts/db-writes.md). Khởi động không ghi gì.
- Không gửi email; log thay email không có token hay link. Không thêm biến `BACKOFFICE_*`.
- Response cache vẫn chưa đọc (D-11) nhưng PHẢI xóa cache dữ liệu dùng chung khi ghi (FR-083).
- Message, status, header, thứ tự lỗi giống Directus (contracts/permissions-api.md).
- Mọi file port ghi `// Ported from directus/...` (manifest `tools/port-manifest/004-T*.json`).

**Scale/Scope**:
- Quy mô thiết kế 2.000 user đồng thời, collection lớn nhất 10 triệu dòng (Nguyên tắc X).
- Port khoảng 12 đến 13 nghìn dòng (engine 3.300, helper 2.200, `permissions` còn thiếu 2.000, service 2.500 thêm,
  util query 1.000, `@directus/utils` 1.600, controller 1.100 → Nest) và khoảng 11 nghìn dòng test gốc; mới khoảng
  3 đến 4 nghìn dòng test đối chiếu, 600 dòng proxy và Playwright, 300 dòng benchmark. Gấp 3 đến 4 lần 003; tách
  `tasks.md` theo research R16 nếu vượt khoảng 60 task.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.3.0. Kiểm lần 1 trước research: không có vi phạm chưa giải thích. Kết
quả dưới đây là lần 2, sau research, data model và contracts.

- [x] **I. Directus chỉ đọc**: PASS.
  - Không sửa `directus/`. Mọi file port ghi `// Ported from directus/...` (bảng ánh xạ bên dưới, manifest
    `tools/port-manifest/004-T*.json`).
  - Chỗ khác nguồn ghi `Backoffice:` trong comment: `emitter.ts` stub, log thay email, `getService` nhóm hai, nhánh
    `version`, `validateBatch`/`useCollection` dạng hàm, controller Nest.
- [x] **II. Dùng chung DB**: PASS.
  - Không DDL, không migration. Dòng ghi giống Directus vì đi qua `ItemsService`, `PayloadService` port nguyên
    (contracts/db-writes.md); SC-005 so trên Postgres, MySQL, SQLite.
  - `db-unchanged`, `readonly-account` mở rộng theo FR-091.
- [x] **III. API giống hệt**: PASS.
  - Route, thứ tự khớp, query (`sanitizeQuery`, `validateQuery`), body (`validateBatch`), status, mã lỗi, message,
    header, `OPTIONS` như Directus (contracts/permissions-api.md).
  - Khác biệt còn lại đều ở bảng của spec: D-27 đến D-31 (mới), D-11, D-12 (thu hẹp), D-09.6 (query `version`).
- [x] **IV. Chạy song song an toàn**: PASS.
  - Cùng `SECRET`, JWT, cache quyền (8 namespace, cùng key và giá trị), `filter-context-*`, điểm xóa cache hệ thống
    và cache dữ liệu, bus `schemaChanged`, `multi-cache` (contracts/cache.md).
  - Quyền đổi ở bên này có hiệu lực ở bên kia ngay (SC-003); kiểm bằng `cache-cross.test.ts`.
- [x] **V. Kiểm thử đối chiếu**: PASS.
  - Mọi route mới có test đối chiếu (research R13); ma trận quyền (FR-101); port `common.test.ts` (phần role, user),
    `check-item-permissions.test.ts`; `cache-purge.test.ts` và `cache.test.ts` của app cần response cache nên ở 005.
  - Chạy lại bộ 003 với engine mới (FR-105).
  - Postgres full, MySQL và SQLite reduced mỗi lần push; nightly giữ như 001.
- [x] **VI. Kiến trúc**: PASS.
  - Năm controller Nest mỏng; service Directus thành lớp cùng tên, factory trong `providers.ts` cho controller; engine
    và helper giữ dạng hàm và lớp như Directus (research R3, R4).
  - Knex, không ORM. Mỗi thay đổi có test (R15).
- [x] **VII. Đa instance**: PASS.
  - Trạng thái trong process: lớp local của cache quyền (xóa qua `multi-cache`), schema (002), instance limiter đăng
    ký (số đếm ở Redis khi store `redis`). Không có state quan trọng khác.
  - Khởi động chỉ đọc. Không có lock hay cron mới.
- [x] **VIII. Biến môi trường**: PASS. Biến chuyển sang nhóm A theo [contracts/config.md](./contracts/config.md);
  không có biến mới; `RATE_LIMITER_EMAIL_*`, `EMAIL_*` vẫn nhóm C.
- [x] **IX. Đổi thương hiệu**: PASS.
  - Giữ: scope JWT `invite`, `pending-registration`, issuer `directus`, đường dẫn `/admin/accept-invite`,
    `/admin/users/<id>`, `/admin/login`, `/users/register/verify-email`, namespace `permissions`, key
    `filter-context-*`, tên collection `directus_*`, mã lỗi, message.
  - Đổi: log mới nói "Backoffice" (D-03); không có nhãn người dùng mới.
- [x] **X. Chất lượng và vận hành**: PASS.
  - Coverage 80% cho `apps/api`, `libs/utils`, `libs/types`.
  - Benchmark hằng tuần (ngoại lệ đã duyệt ở 003). Playwright app Directus là cổng chặn mới.
  - Không gửi email: log không có token (FR-061, FR-063). Mọi khác biệt ghi ở spec; cần tech lead duyệt D-27 đến
    D-31 trước khi đóng feature.
- [x] **XI. Ngoài phạm vi**: PASS. Không gửi email (D-27, D-28); không có WebSocket, GraphQL (011), extension
  (emitter stub, D-29), AI/MCP. Flow theo event thuộc 009.

## Project Structure

### Documentation (this feature)

```text
specs/004-permissions/
├── plan.md              # File này
├── research.md          # Phase 0: R1–R16
├── data-model.md        # Phase 1: thực thể, accountability, thứ tự gộp quyền, token, trạng thái, Redis
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── permissions-api.md   # route, body, query, lỗi, OPTIONS, response của năm endpoint
│   ├── db-writes.md         # dòng ghi của từng luồng
│   ├── cache.md             # 8 namespace, filter-context-*, điểm xóa cache, bus
│   ├── config.md            # biến chuyển nhóm A, biến còn nhóm C
│   └── proxy-e2e.md         # route app Directus gọi, reverse proxy, dự án Playwright, job CI
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

Chỉ liệt kê phần thêm hoặc sửa. Cấu trúc chung giữ như plan 001 đến 003.

```text
backoffice-next/
├── pnpm-workspace.yaml                         # catalog: snappy, ip-matching, @types/wellknown
├── libs/
│   ├── utils/src/shared/{parse-filter,parse-now,adjust-date,get-with-arrays,is-dynamic-variable,get-relation,
│   │       get-relation-info,validate-payload,generate-joi,inject-function-results,functions,
│   │       is-detailed-update-syntax,deep-map,deep-map-with-schema,get-filter-operators-for-type,
│   │       get-functions-for-type,get-output-type-for-function,parse-filter-function-path,get-endpoint,compress}.ts
│   │                                           # MỚI ← packages/utils/shared (+ test gốc); index.ts SỬA
│   └── types/src/{services,users,events,ast?}.ts   # SỬA/MỚI: MutationOptions, QueryOptions, User..., type engine
├── apps/api/src/
│   ├── emitter.ts                              # MỚI Backoffice: stub emitFilter/emitAction (R8)
│   ├── cache.ts                                # SỬA: setCacheValue, getCacheValue (+WithExpiry/TTL nếu cần), compress
│   ├── utils/compress.ts                       # MỚI ← utils/compress.ts (snappy)
│   ├── app-pipeline.ts                         # SỬA: app.use(authenticate) mọi path; sanitizeQuery sau schema (R2)
│   ├── middleware/public-accountability.ts     # XÓA (D-10, D-18)
│   ├── middleware/sanitize-query.ts            # MỚI ← middleware/sanitize-query.ts
│   ├── middleware/validate-batch.ts            # MỚI ← middleware/validate-batch.ts (hàm async, R3)
│   ├── middleware/use-collection.ts            # MỚI ← middleware/use-collection.ts (hàm)
│   ├── middleware/rate-limiter-registration.ts # MỚI ← middleware/rate-limiter-registration.ts (limiter tạo khi gọi)
│   ├── middleware/router-options.ts            # SỬA: Allow của năm endpoint (contracts §3)
│   ├── database/get-ast-from-query/**          # MỚI ← database/get-ast-from-query (6 file + 6 test)
│   ├── database/run-ast/**                     # MỚI ← database/run-ast (30 file + 16 test, README)
│   ├── database/helpers/{fn,geometry,schema,number,sequence,capabilities}/**   # MỚI/SỬA ← đủ dialect (+ test)
│   ├── database/helpers/index.ts               # SỬA: getHelpers đủ 6 nhóm, getFunctions
│   ├── types/ast.ts                            # MỚI ← types/ast.ts
│   ├── permissions/lib/with-app-minimal-permissions.ts            # MỚI
│   ├── permissions/lib/{fetch-permissions,fetch-policies}.ts      # SỬA: đủ như Directus (biến động, share, AccessService)
│   ├── permissions/modules/{fetch-accountability-collection-access,fetch-accountability-policy-globals,
│   │       fetch-allowed-collections,fetch-allowed-fields,fetch-inconsistent-field-map,fetch-policies-ip-access,
│   │       process-ast/**,process-payload/**,validate-access/**}/   # MỚI (+ test gốc)
│   ├── permissions/modules/validate-remaining-admin/validate-remaining-admin-users.ts   # MỚI
│   ├── permissions/utils/{default-permission,extract-required-dynamic-variable-context,fetch-dynamic-variable-data,
│   │       fetch-share-info,get-permissions-for-share,get-unaliased-field-key,merge-fields,merge-permissions,
│   │       process-permissions}.ts            # MỚI (+ test gốc); fetch-raw-permissions.ts SỬA (PermissionsService, app minimal)
│   ├── services/items.service.ts               # THAY ← services/items.ts đầy đủ (+ items.test.ts gốc)
│   ├── services/payload.service.ts             # THAY ← services/payload.ts đầy đủ (+ payload.test.ts gốc)
│   ├── services/users.service.ts               # SỬA ← services/users.ts đủ: delete, invite, accept, register, verify (log thay mail)
│   ├── services/{roles,policies,access,permissions,meta,presets}.service.ts   # MỚI ← services/*.ts (+ test gốc hoặc mới)
│   ├── services/tfa.service.ts                 # SỬA: enableTFA, disableTFA
│   ├── services/settings.service.ts            # giữ (D-31 cho getService)
│   ├── controllers/users.controller.ts         # SỬA ← controllers/users.ts đủ route
│   ├── controllers/{roles,policies,access,permissions}.controller.ts   # MỚI ← controllers/*.ts
│   ├── app.module.ts, providers.ts             # SỬA: 4 controller mới, factory Roles/Policies/Access/Permissions/Meta
│   ├── utils/{sanitize-query,validate-query,split-fields,calculate-field-depth,get-field-relational-depth,
│   │       get-column-path,get-collection-from-alias,parse-filter-key,parse-numeric-string,filter-items,
│   │       get-service,get-accountability-for-role}.ts   # MỚI ← utils/*.ts (+ test gốc)
│   ├── config/supported-variables.ts           # SỬA: contracts/config.md §1
│   └── types/express.d.ts                      # giữ (sanitizedQuery, collection, singleton đã có)
├── tests/parity/
│   ├── docker-compose.yml                      # SỬA: profile app (service proxy 8160)
│   ├── proxy/{nginx.conf.template,backoffice-routes.txt}   # MỚI; scripts/proxy-conf.mjs MỚI
│   ├── accepted-differences.ts                 # SỬA: research R10
│   ├── src/directus-api.ts                     # SỬA: appRequest(app, ...)
│   ├── src/{suite,request-set,errors,config,profiles,global-setup}.ts   # SỬA
│   ├── src/schema/permissions-cache.test.ts    # SỬA: 8 namespace, filter-context
│   └── src/permissions/
│       ├── fixtures.ts, matrix.ts              # MỚI: fixture per-app, bảng ô FR-101
│       ├── accountability.test.ts, read-rules.test.ts, write-rules.test.ts, matrix.test.ts, matrix-reduced.test.ts
│       ├── users.test.ts, roles.test.ts, policies.test.ts, access.test.ts, permissions.test.ts, query.test.ts
│       ├── me.test.ts, invite-register.test.ts, tfa-toggle.test.ts, cache-cross.test.ts
│       └── blackbox-common.test.ts, check-item-permissions.test.ts   # port từ tests/blackbox
├── tests/directus-app-e2e/                     # MỚI: project.json, playwright.config.ts, package.json, tsconfig.json
│   └── src/{helpers/{login,db-rows,proxy-log}.ts, login.spec.ts, users.spec.ts, roles.spec.ts, policies.spec.ts, routing.spec.ts}
├── tests/benchmark/
│   ├── src/{permissions,seed-permissions}.ts   # MỚI (R14)
│   └── project.json                            # SỬA: target permissions
├── tools/port-manifest/004-T*.json             # MỚI: header check
├── tools/ci-local.sh                           # SỬA: bước e2e-directus-app
├── .github/workflows/ci.yml                    # SỬA: parity postgres thêm profile app; job e2e-directus-app; publish.needs
├── .github/workflows/benchmark.yml             # SỬA: job benchmark-permissions
├── specs/001-platform-foundation/spec.md       # SỬA: dòng D-09.6, D-10, D-11, D-12 (R10); contracts/config.md §5
└── specs/003-auth-session/spec.md              # SỬA: ô "Gỡ khi" của D-09.10 → 004 (R10)
```

**Structure Decision**:
- Theo cấu trúc 001 đến 003: file của `directus/api/src` vào cùng đường dẫn trong `apps/api/src`; service và
  controller có hậu tố `.service.ts`, `.controller.ts`; package Directus thành lib cùng tên dưới `libs/`.
- Engine, helper và module quyền là hàm và lớp thuần, không vào DI của Nest; chỉ service mà controller dùng có factory
  (research R3, R4).
- Test đối chiếu mới đặt trong `tests/parity/src/permissions/`; E2E app Directus là dự án Nx riêng
  `tests/directus-app-e2e` (mẫu `apps/web-e2e`).

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/`) | Đích | Ghi chú |
|---------------------|------|---------|
| `packages/utils/shared/{parse-filter,parse-now,adjust-date,get-with-arrays,is-dynamic-variable,get-relation,get-relation-info,validate-payload,generate-joi,inject-function-results,functions,is-detailed-update-syntax,deep-map,deep-map-with-schema,get-filter-operators-for-type,get-functions-for-type,get-output-type-for-function,parse-filter-function-path,get-endpoint,compress}.ts` | `libs/utils/src/shared/` | Nguyên vẹn, kèm test gốc (R1) |
| `packages/types/src/{services,users,events,...}.ts` | `libs/types/src/` | Phần engine và năm service cần |
| `api/src/types/ast.ts` | `apps/api/src/types/ast.ts` | Nguyên vẹn |
| `api/src/database/get-ast-from-query/**` | cùng đường dẫn | Nguyên vẹn, kèm 6 test (R4) |
| `api/src/database/run-ast/**` | cùng đường dẫn | Nguyên vẹn, kèm 16 test, README (R4) |
| `api/src/database/helpers/{capabilities,date,fn,geometry,number,schema,sequence}/**`, `helpers/index.ts` | cùng đường dẫn | Đủ dialect, kèm 13 test; `date` và `formatUUID` đã có (R5) |
| `api/src/utils/{sanitize-query,validate-query,split-fields,calculate-field-depth,get-field-relational-depth,get-column-path,get-collection-from-alias,parse-filter-key,parse-numeric-string,filter-items,get-accountability-for-role,compress}.ts` | `apps/api/src/utils/` | Nguyên vẹn, kèm test gốc |
| `api/src/utils/get-service.ts` | `apps/api/src/utils/get-service.ts` | Ba nhóm (R6, D-31) |
| `api/src/utils/versioning/*` | không port | Nhánh `version` ném lỗi tới 008 (R4) |
| `api/src/cache.ts` (`setCacheValue`, `getCacheValue`) | `apps/api/src/cache.ts` | Thêm vào bản 002 (R7) |
| `api/src/emitter.ts` | `apps/api/src/emitter.ts` | Stub `Backoffice:` (R8, D-29) |
| `api/src/permissions/lib/with-app-minimal-permissions.ts`, `modules/{fetch-accountability-collection-access,fetch-accountability-policy-globals,fetch-allowed-collections,fetch-allowed-fields,fetch-inconsistent-field-map,fetch-policies-ip-access,process-ast,process-payload,validate-access}/**`, `modules/validate-remaining-admin/validate-remaining-admin-users.ts`, `utils/{default-permission,extract-required-dynamic-variable-context,fetch-dynamic-variable-data,fetch-share-info,get-permissions-for-share,get-unaliased-field-key,merge-fields,merge-permissions,process-permissions}.ts` | cùng đường dẫn | Nguyên vẹn, kèm 39 test; `withCache` của 002 |
| `api/src/permissions/lib/{fetch-permissions,fetch-policies}.ts`, `utils/fetch-raw-permissions.ts` | cùng đường dẫn | Thay bản rút gọn của 002, 003 bằng bản đủ (AccessService, PermissionsService, biến động, share, app minimal) |
| `api/src/services/items.ts`, `payload.ts` | `services/{items,payload}.service.ts` | Thay bản rút gọn của 003; kèm test gốc |
| `api/src/services/{meta,roles,policies,access,permissions,presets}.ts` | `services/*.service.ts` | Nguyên vẹn; test gốc có cho `meta`, `roles`; test mới cho ba service còn lại |
| `api/src/services/users.ts` | `services/users.service.ts` | Thêm `deleteMany`, `inviteUrl`, `inviteUser`, `acceptInvite`, `registerUser`, `verifyRegistration`; `mailService.send` → log (R9) |
| `api/src/services/tfa.ts` | `services/tfa.service.ts` | Thêm `enableTFA`, `disableTFA` |
| `api/src/middleware/{sanitize-query,validate-batch,use-collection,rate-limiter-registration}.ts` | cùng đường dẫn | `validate-batch`, `use-collection` thành hàm async (R3); limiter tạo khi gọi (R11) |
| `api/src/controllers/{users,roles,policies,access,permissions}.ts` | `controllers/*.controller.ts` | Nest, cùng thứ tự route (R3); test mới |
| `tests/blackbox/common/common.test.ts` (`createRole()`, `createUser()`), `common/functions.ts` (`CreateRole`, `CreateUser`, `CreatePolicy`, `CreatePermission`, `DeletePermission`) | `tests/parity/src/permissions/{blackbox-common.test.ts,fixtures.ts}` | Port lên `parity()`, `scenario()` |
| `tests/blackbox/tests/db/routes/permissions/check-item-permissions.{test,seed}.ts` | `tests/parity/src/permissions/check-item-permissions.test.ts` | Collection người dùng tạo qua Directus |

### Phần port rút gọn tạm thời (sau feature này)

| Phần | Ở feature 004 | Thay ở |
|------|---------------|--------|
| `respond` | Chỉ `Cache-Control: no-cache`, `Vary`; không đọc response cache, không `export` (D-11, D-12) | 005 |
| `middleware/cache.ts` | Chỉ gọi `getCache()` | 005 |
| `/items`, `collectionExists`, singleton qua route | Chưa có (D-09.3) | 005 |
| Query `version` | Ném lỗi (D-09.6 mở rộng) | 008 |
| `emitter` | Stub không phát (D-29) | 009 |
| `getService` nhóm hai | `ItemsService` chung (D-31) | 007 đến 010 |
| `SettingsService` | Không kế thừa `ItemsService` (001) | 010 |
| `SharesService` (`share-info`, xóa cache khi sửa share) | Chỉ đọc share qua `ItemsService` | 010 |
| `MailService` | Không có; log thay email (D-23, D-27, D-28) | — |
| `requestCounter` | Không port (telemetry) | — |

## Complexity Tracking

Không có vi phạm mới. Các ngoại lệ đã duyệt của 001 đến 003 vẫn áp dụng: benchmark chạy hằng tuần thay vì chặn CI
(003, chủ dự án chọn 2026-10-11; benchmark SC-006 đi cùng); store `memory` với cảnh báo một instance (001 dòng 8, nay
gồm limiter đăng ký); bus và lock local khi không có Redis (002). Các khác biệt D-27 đến D-31 và việc sửa dòng D-09.6,
D-10, D-11, D-12 (001), D-09.10 (003) cần tech lead duyệt trước khi đóng feature (Nguyên tắc X).

Rủi ro đã biết, theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| `snappy` cần build native trên alpine | Build Docker lỗi | Task build image kiểm sớm (R1); dự phòng `[Suy luận]`: bản dựng sẵn musl của napi-rs |
| Engine port nguyên nhưng SQL lệch theo vendor (MySQL, SQLite ở `reduced`) | Ma trận quyền đỏ ở một vendor | Test gốc của helper dialect; `matrix-reduced` chạy mỗi push; nightly cho vendor còn lại |
| Vòng import ESM (`run-ast` ↔ `payload` ↔ `get-service` ↔ `items`, `helpers/fn` ↔ `run-ast`) hỏng khi build bằng swc hoặc vitest | Lỗi "cannot access before initialization" | Giữ import động của Directus (`get-service` trong `payload`); unit test engine chạy sớm ở Phase 2 (R4) |
| Ma trận quyền làm Postgres full vượt 60 phút | Job `parity` quá hạn | Task đầu của Phase 5 đo thời gian; tách job CI theo thư mục nếu cần (R13) |
| Guard `accepted-differences` đỏ khi sửa bảng 001, 003 hoặc `removeAt` (D-09.10) | CI đỏ | Sửa spec và entry trong cùng commit (R10); xóa D-09.2, D-10, D-09.10 khi đóng feature |
| Nest khớp route khác Express 4 (`/users/me` vs `/:pk`, `endsWith('me')`, trailing slash của `/me/tfa/generate/`) | `404`/`403` lệch | Test controller supertest + parity `OPTIONS`, route lạ (R3, R15) |
| App Directus gọi route ngoài dự kiến qua proxy | Playwright đỏ không do app mới | Quy tắc A: mọi path lạ về Directus; `routing.spec.ts` kiểm upstream (R12) |
| Response cache của Directus (`CACHE_ENABLED=true`) trả bản cũ trong test cross-app | Ca đỏ giả | Ghi qua API (cache bị xóa); đọc trạng thái từ DB như 003; `flushSharedCaches()` khi so giá trị tính toán |
| Biến động `$CURRENT_USER.<field>` cache `filter-context-*` trong `CACHE_TTL` | Hai app lệch khi field đổi trong TTL | Giống Directus (cùng key); test xóa cache trước khi so |
| Khối lượng gấp 3 đến 4 lần 003 | `tasks.md` dài, nhiều vòng sửa | Tách theo R16; chạy test đối chiếu sau mỗi gói, không đợi cuối feature |
