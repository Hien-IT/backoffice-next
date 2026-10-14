# Implementation Plan: GraphQL (`/graphql`, `/graphql/system`)

**Branch**: `011-graphql-api` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-graphql-api/spec.md`

## Summary

App mới phục vụ `/graphql` (scope `items`) và `/graphql/system` (scope `system`) giống hệt Directus 11.17.4: schema
sinh động từ `SchemaOverview` và quyền của từng user bằng `graphql-compose` (port nguyên `services/graphql`), query,
mutation, aggregate, quan hệ lồng, filter, cùng tên type, field, arg; type `Subscription` giữ trong schema, không có
transport WebSocket (D-17); `/server/specs/graphql[/:scope]` trả SDL (gỡ D-15); cache schema LRU mỗi instance xóa qua
bus `schemaChanged`; response cache dùng chung với Directus cho `POST /graphql`; bốn biến `GRAPHQL_*` sang nhóm A.
Gỡ D-09.9. Không có khác biệt mới.

Cách làm:

- Port nguyên, cùng đường dẫn, kèm 8 file test gốc: `services/graphql/**` trừ `subscription.ts`, `middleware/graphql.ts`,
  `utils/get-graphql-type.ts`, `utils/get-graphql-query-and-variables.ts`, phần `GraphQLSpecsService` của
  `services/specifications.ts` (R2). Thêm `mnemonist`, `async-mutex` như Directus (R1, owner chọn 2026-10-14). Thêm `graphql`
  16.12.0, `graphql-compose` 9.1.0.
- `GraphqlController` Nest với `@All` theo hai scope, `parseGraphQL` qua `runMiddleware`, `respond` (R3);
  `ServerController` thêm `specs/graphql` (R4); resolver hệ thống dùng service của 003 đến 010 (R8).
- Bộ đối chiếu `tests/parity/src/graphql/` (7 file) với introspection và SDL so nguyên văn, cặp `graphql-nointro`;
  blackbox: phần GraphQL của 8 file đã port đi tới app đang thử, port nguyên 5 file còn lại với `LOG_STYLE=raw` cho
  cặp blackbox; Playwright `graphql.spec.ts`; benchmark `graphql.ts` (R9 đến R11, contracts/parity.md).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

| Yêu cầu | Ở feature 011 |
|---------|---------------|
| Node 22, pnpm 10, Nx, `apps/api` NestJS strict | Giữ như 001 đến 010; thêm hai gói Directus đang dùng (R1) |
| Knex với dialect như Directus | Không truy vấn mới: mọi resolver gọi service đã có (engine 004/005, service hệ thống 003 đến 010) |
| Cache, bus Redis cùng key và kênh Directus | Response cache `POST /graphql` cùng khóa (`query`, `variables`); `schemaChanged` dùng chung xóa cache schema; không key mới |
| Validate giống Directus | `validate` của `graphql` với `specifiedRules` (+ `NoSchemaIntrospectionCustomRule`); engine kiểm payload như REST |
| Port từ `directus/api/src`, ghi đường dẫn gốc | Bảng ánh xạ bên dưới; manifest `tools/port-manifest/011-T*.json`; guard `check-port-headers` |
| Thư viện nội bộ `@backoffice/*` | `types`, `errors`, `env`, `utils`, `constants`, `system-data`, `schema-builder` (test) dùng như có |
| Env port từ `packages/env` | Không biến mới; bốn biến sang nhóm A (R6) |
| Mỗi service Directus một provider, controller mỏng | Factory `GraphQLService` trong `providers.ts`; `GraphqlController` chỉ chạy `parseGraphQL`, gọi `execute`, `respond` (R3) |
| Vitest; test đối chiếu từ `directus/tests/blackbox` | R9, R10; 5 file blackbox copy, 2 file common sửa, 8 unit port |
| GitHub Actions, coverage BE 80% | contracts/parity.md §5 |

**Language/Version**: TypeScript 5.9.3 (strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS, ESM, pnpm 10.27.0,
Nx 23.3.

**Primary Dependencies**:
- Đã có: NestJS 12 (Express 5.2.1), knex 3.1.0, argon2 0.44.0, nanoid, object-hash 3.0.0, lodash-es, date-fns,
  `ItemsService` và engine (`getAstFromQuery`, `runAst`,
  `sanitizeQuery`, `validateQuery`, `getRelatedCollection`), `reduceSchema`, `fetchAllowedFieldMap`,
  `fetchInconsistentFieldMap`, `fetchAccountabilityPolicyGlobals`, `fetchAccountabilityCollectionAccess`,
  `createDefaultAccountability`, `AuthenticationService`, `UsersService`, `TFAService`, `UtilsService`,
  `RevisionsService`, `CollectionsService`, `FieldsService`, `RelationsService`, `ServerService`,
  `SpecificationService` (OAS), `ExtensionsService.readAll`, `getService`, `getCache`, `clearSystemCache`, `useBus`,
  `registrationRateLimiter`, `getSecret`, `getIPFromReq`, `generateHash`, `jwt`, `isDirectusJWT`, `respond`,
  `runMiddleware`, `REFRESH_COOKIE_OPTIONS`, `SESSION_COOKIE_OPTIONS`, `DIRECTUS_COMPAT_VERSION`.
- Thêm: graphql 16.12.0, graphql-compose 9.1.0 (R1). Bộ test: json-to-graphql-query 2.3.0 (đã có).

**Storage**: DB và Redis dùng chung, không DDL, không key mới. Cache schema trong bộ nhớ mỗi instance (LRU 100, xóa
qua bus). Không file.

**Testing**:
- Vitest 3.2.4: 8 file test gốc (81 ca) port cạnh code; test mới cho controller, middleware, schema cache, hàng đợi,
  `specs/graphql`, `get-cache-key` nhánh GraphQL, `supported-variables`, `router-options` (contracts/parity.md §4).
  Coverage 80% `apps/api`.
- `tests/parity/src/graphql/` 7 file (§2); blackbox 8 file chạy lại + 5 file port (§3); cặp `graphql-nointro` (§1).
- `tests/directus-app-e2e/src/graphql.spec.ts`, `routing.spec.ts` sửa (§6).
- `tests/benchmark/src/graphql.ts`, job `benchmark-graphql` (§7).

**Target Platform**: Container Linux (`node:22-alpine`), nhiều replica cạnh Directus. Không gói native mới.

**Project Type**: Monorepo web (Nx). Chạm `apps/api`, `tests/parity`, `tests/directus-app-e2e`, `tests/benchmark`,
CI, catalog pnpm.

**Performance Goals**:
- SC-007: `list`, `by_id`, `aggregated`, `introspection` (cache), `create` p95 và req/s không tệ hơn Directus quá
  10%; đo hằng tuần, không chặn CI (quyết định 003). Thời gian sinh schema lần đầu chỉ ghi số.

**Constraints**:
- Introspection và SDL so nguyên văn kể cả thứ tự (Clarifications): cùng bản `graphql`, `graphql-compose`, cùng
  thứ tự gọi `addFields` như Directus; không sắp lại ở bộ so.
- Type `Subscription` có trong schema, `subscribe` không bao giờ chạy qua HTTP (FR-047); không `graphql-ws`, không
  nâng cấp WebSocket (D-17).
- Không gửi email: `auth_password_request`, `users_invite`, `users_register` gọi service đã ghi log (D-23, D-27, D-28).
- Express 5 wildcard `*splat` cho `router.use` của Directus; `OPTIONS`, `HEAD` đi vào `parseGraphQL` (đo R12).
- Mọi file port ghi `// Ported from directus/...`; manifest `tools/port-manifest/011-T*.json`.
- `graphql` vào `backoffice-routes.txt` cùng task đăng ký controller (app Directus gọi ở Insights).

**Scale/Scope**:
- Port khoảng 4.300 dòng `services/graphql` (không `subscription.ts` 132 dòng), 80 dòng middleware, 55 dòng
  `get-graphql-type`, 20 dòng `get-graphql-query-and-variables`, 25 dòng `GraphQLSpecsService`; test gốc khoảng 1.900
  dòng; controller Nest khoảng 80 dòng; blackbox copy 5 file (khoảng 900 dòng) + 2 file sửa; mới khoảng 2.500 dòng
  test đối chiếu, 60 dòng compose/env, 250 dòng Playwright, 250 dòng benchmark. `tasks.md` chia bốn đợt commit theo phase (A: Phase 1, 2 = thư
  viện, env, cặp `graphql-nointro`, toàn bộ port `services/graphql`, middleware, controller, helper; B: Phase 3–5 =
  đọc, ghi, hệ thống và 13 file blackbox; C: Phase 6, 7 = introspection, SDL, lỗi, cache; D: Phase 8, 9 = E2E,
  benchmark, CI, đóng feature).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.4.0. Kết quả dưới đây là lần 2, sau research, data model và contracts
(lần 1 trước research: không vi phạm; mục XI chạm subscription đã được owner quyết ở Clarifications).

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`. Mọi file port ghi `// Ported from directus/...` (bảng
  ánh xạ, manifest `011-T*.json`). Chỗ khác nguồn ghi `Backoffice:`: `subscribe` giữ chỗ trong `read.ts`, LRU và hàng
  `update_extensions_item` ném `Forbidden`, `redact.test.ts` đọc log container.
- [x] **II. Dùng chung DB**: PASS. Không DDL, không migration, không truy vấn mới; mọi ghi qua service của 003 đến
  010 với cùng định dạng.
- [x] **III. API giống hệt**: PASS. Route, method, status, mã lỗi, body, header cache, SDL như Directus
  (contracts/graphql-api.md); introspection so nguyên văn (SC-001). D-09.9, D-15 gỡ; không khác biệt mới; R-30 đến
  R-32 tái tạo, bằng chứng đo ở bộ đối chiếu.
- [x] **IV. Chạy song song an toàn**: PASS. Token `auth_login` dùng chéo (003); response cache cùng khóa; cache schema
  xóa qua `schemaChanged` dùng chung; không giả định instance duy nhất.
- [x] **V. Kiểm thử đối chiếu**: PASS. 7 file `src/graphql/`, 13 file blackbox, cặp `graphql-nointro`; Postgres đủ
  bộ mỗi lần push, MySQL, SQLite rút gọn, còn lại nightly (SC-002, SC-003).
- [x] **VI. Kiến trúc**: PASS. Một controller mỏng; `GraphQLService` một factory provider; Knex qua engine; mỗi thay
  đổi có test.
- [x] **VII. Đa instance**: PASS. Cache schema trong process được dựng lại từ DB và xóa qua bus Redis trên mọi
  instance (1.2.0 cho phép, nhắc đích danh 011); hàng đợi sinh schema là của mỗi instance như Directus; khởi động
  chỉ đọc (cache tạo rỗng, subscribe bus).
- [x] **VIII. Biến môi trường**: PASS. Không biến mới; bốn `GRAPHQL_*` sang nhóm A; `WEBSOCKETS_GRAPHQL_*` chỉ cảnh
  báo (R6).
- [x] **IX. Đổi thương hiệu**: PASS. Tên type GraphQL (kể cả `directus_*`), scalar, query, mutation, enum, mã lỗi,
  description giữ nguyên; `server_info`, `server_specs_oas` đã đổi như 001. Dòng log mới ghi "Backoffice:".
- [x] **X. Chất lượng và vận hành**: PASS. Coverage 80%. Benchmark hằng tuần (ngoại lệ 003). Playwright là cổng
  chặn. Không gửi email (D-23, D-27, D-28 qua service). Gỡ D-09.9, D-15 và R-30 đến R-32 cần tech lead duyệt trước
  khi đóng feature; bảng của spec 001 sửa theo.
- [x] **XI. Ngoài phạm vi**: PASS, đã hỏi trước. Subscription: owner chọn giữ type trong schema, không transport
  (Clarifications); WebSocket, extension manager (`update_extensions_item`), AI/MCP, deployment vẫn ngoài phạm vi;
  hành vi bằng Directus khi WebSocket tắt.

## Project Structure

### Documentation (this feature)

```text
specs/011-graphql-api/
├── plan.md              # File này
├── research.md          # Phase 0: R1–R12
├── data-model.md        # Phase 1: schema theo user, scope, type, thao tác hệ thống, document → Query, lỗi, env
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── graphql-api.md       # /graphql, /graphql/system, /server/specs/graphql, cache, hiện diện, lỗi
│   └── parity.md            # môi trường, bộ đối chiếu, blackbox, unit, CI, Playwright, benchmark
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

Chỉ liệt kê phần thêm hoặc sửa. Cấu trúc chung giữ như plan 001 đến 010.

```text
backoffice-next/
├── pnpm-workspace.yaml                         # SỬA: catalog graphql, graphql-compose
├── apps/api/package.json                       # SỬA: 2 gói
├── apps/api/src/
│   ├── app.module.ts, providers.ts             # SỬA: GraphqlController; factory GraphQLService
│   ├── controllers/graphql.controller.ts (+ test)   # MỚI ← controllers/graphql.ts (Nest, @All hai scope)
│   ├── controllers/server.controller.ts (+ test)   # SỬA: GET /specs/graphql/:scope?
│   ├── middleware/graphql.ts (+ test)          # MỚI ← middleware/graphql.ts (parseGraphQL)
│   ├── middleware/router-options.ts (+ test)   # SỬA: /server/specs/graphql khi GRAPHQL_INTROSPECTION
│   ├── services/graphql/
│   │   ├── index.ts                            # MỚI ← services/graphql/index.ts
│   │   ├── schema-cache.ts (+ test)            # MỚI ← schema-cache.ts
│   │   ├── schema/{index,read,write,get-types,parse-args,parse-query}.ts (+ parse-query.test, index.test)   # MỚI ← schema/* (read: Subscription giữ chỗ)
│   │   ├── resolvers/{query,mutation,system,system-global,system-admin,get-collection-type,get-field-type,get-relation-type}.ts (+ query.test)   # MỚI ← resolvers/*
│   │   ├── types/{bigint,date,geojson,hash,string-or-float,void}.ts   # MỚI ← types/*
│   │   ├── utils/{add-path-to-validation-error,aggregate-query,dedupe-resolvers,filter-replace-m2a,process-error,replace-fragments,replace-funcs,sanitize-gql-schema}.ts (+ 6 test gốc)   # MỚI ← utils/*
│   │   └── errors/{execution,format,index,validation}.ts   # MỚI ← errors/*
│   ├── services/specifications.service.ts (+ test)   # SỬA: GraphQLSpecsService, field graphql
│   ├── services/index.ts                       # SỬA
│   ├── utils/get-graphql-type.ts               # MỚI ← utils/get-graphql-type.ts
│   ├── utils/get-graphql-query-and-variables.ts   # MỚI ← utils/get-graphql-query-and-variables.ts
│   ├── utils/get-cache-key.ts (+ test)         # SỬA: nhánh /graphql
│   └── config/supported-variables.ts (+ test)  # SỬA: khối Feature 011
├── specs/001-platform-foundation/contracts/config.md   # SỬA: nhóm A, C
├── tests/parity/
│   ├── docker-compose.yml, env/profile-graphql-nointro.env   # SỬA, MỚI: cặp graphql-nointro
│   ├── env/profile-blackbox.env                # SỬA: LOG_STYLE=raw, LOG_LEVEL=info
│   ├── src/{config,docker,suite}.ts, scripts/env.mjs, src/vendors.test.ts   # SỬA: profile, file lists
│   ├── src/request-set.ts, src/server/{errors,methods}.test.ts   # SỬA
│   ├── proxy/backoffice-routes.txt, src/proxy-conf.test.ts   # SỬA: graphql
│   ├── accepted-differences.ts                 # SỬA: xóa D-09.9, D-15 (đóng feature)
│   ├── README.md                               # SỬA: mục 011
│   ├── src/graphql/                            # MỚI (contracts/parity.md §2)
│   │   ├── helpers.ts
│   │   └── {schema,read,write,system,errors,cache,e2e-app}.test.ts
│   └── src/items/blackbox/
│       ├── common/{transport,config}.ts        # SỬA: requestGraphQL tới host
│       ├── tests/common/auth/{login,refresh}.test.ts   # MỚI (copy, bỏ WebSocket)
│       ├── tests/common/logger/redact.test.ts  # MỚI (copy, logs() thay TestLogger)
│       └── tests/db/routes/server/{ping,health}.test.ts   # MỚI (copy, bỏ SMTP)
├── tests/directus-app-e2e/src/graphql.spec.ts  # MỚI (R11); routing.spec.ts SỬA
├── tests/benchmark/src/graphql.ts              # MỚI; project.json SỬA
├── tools/port-manifest/011-T*.json             # MỚI
├── tools/ci-local.sh                           # SỬA: graphql-nointro
├── .github/workflows/{ci,nightly,benchmark}.yml   # SỬA (contracts/parity.md §5)
└── specs/001-platform-foundation/spec.md       # SỬA: D-09.9, D-15
```

**Structure Decision**: Theo 001 đến 010: file của `directus/api/src` vào cùng đường dẫn trong `apps/api/src`
(`services/graphql/` giữ nguyên cây con, không hậu tố `.service.ts` vì là thư mục module như Directus); controller
có hậu tố `.controller.ts`. Blackbox thêm vào cây `tests/parity/src/items/blackbox/`. Test đối chiếu mới đặt trong
`tests/parity/src/graphql/`.

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/api/src`) | Đích (`apps/api/src`) | Ghi chú |
|----------------------------|------------------------|---------|
| `services/graphql/index.ts` | `services/graphql/index.ts` | Nguyên; `useEnv` của `@backoffice/env` |
| `services/graphql/schema-cache.ts` | cùng | Nguyên |
| `services/graphql/schema/index.ts` | cùng | Nguyên (type `GraphQLParams` từ `apps/api/src/types`) |
| `services/graphql/schema/read.ts` | cùng | `createSubscriptionGenerator` → hàm giữ chỗ ném lỗi (Backoffice, FR-047) |
| `services/graphql/schema/{write,get-types,parse-args,parse-query}.ts` (+ `parse-query.test.ts`) | cùng | Nguyên |
| `services/graphql/resolvers/*.ts` (+ `query.test.ts`) | cùng | import service `.service.js`; `update_extensions_item` → `ForbiddenError` (D-37) |
| `services/graphql/types/*.ts` | cùng | Nguyên |
| `services/graphql/utils/*.ts` (+ 6 test) | cùng | Nguyên |
| `services/graphql/errors/*.ts` | cùng | `createError` của `@backoffice/errors` |
| `services/graphql/subscription.ts` | — | Không port (D-17) |
| `middleware/graphql.ts` | `middleware/graphql.ts` | Nguyên |
| `controllers/graphql.ts` | `controllers/graphql.controller.ts` | Nest `@All` (R3); test mới |
| `controllers/server.ts` (`/specs/graphql`) | `controllers/server.controller.ts` | Thêm handler |
| `services/specifications.ts` (`GraphQLSpecsService`) | `services/specifications.service.ts` | Thêm lớp |
| `utils/get-graphql-type.ts` | `utils/get-graphql-type.ts` | Nguyên |
| `utils/get-graphql-query-and-variables.ts` | `utils/get-graphql-query-and-variables.ts` | Nguyên; `get-cache-key.ts` thêm nhánh |
| `tests/blackbox/tests/common/auth/{login,refresh}.test.ts`, `common/logger/redact.test.ts`, `db/routes/server/{ping,health}.test.ts` | `tests/parity/src/items/blackbox/tests/...` | Copy (contracts/parity.md §3) |

### Phần không port hoặc hoãn

| Phần | Lý do | Thay ở |
|------|-------|--------|
| `services/graphql/subscription.ts`, `websocket/controllers/graphql.ts`, `graphql-ws` | Nguyên tắc XI, D-17 | type `Subscription` giữ chỗ trong schema |
| `ExtensionsService.updateOne` qua `update_extensions_item` | Nguyên tắc XI, D-37 | `ForbiddenError` |
| Màn hình GraphQL của app web mới | FE | sau |

## Complexity Tracking

Không có vi phạm constitution. Ghi nhận cần tech lead duyệt khi đóng feature (Nguyên tắc X): gỡ D-09.9, D-15; R-30
đến R-32 với bằng chứng đo.

Ngoại lệ đã duyệt của 001 đến 010 vẫn áp dụng: benchmark hằng tuần thay vì chặn CI (003); store `memory` với cảnh
báo một instance (001); D-08.

Rủi ro đã biết, theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| Thứ tự type trong introspection của app mới khác Directus do thứ tự `Object.values(schema.collections)` của `SchemaOverview` hoặc thứ tự `addFields` khi port | SC-001 so nguyên văn đỏ dù client không bị ảnh hưởng | Directus ổn định giữa hai lần khởi động (R12.5 đo 2026-10-14, cùng SHA); nếu app mới lệch, sửa thứ tự `SchemaOverview` (cùng nguồn `getSchema` của 002, `overview.test.ts` đã so) hoặc thứ tự gọi trong file port, không sắp lại ở bộ so |
| `@All('*splat')` của Nest trên Express 5 không khớp `/graphql` gốc hoặc nuốt `/graphql/system` | ca scope đỏ | Test controller với supertest ở task đầu nhóm B; dự phòng `@All(['', '*splat'])` hoặc một handler với `req.path` tự chia scope |
| `Query` rỗng cho public không policy | introspection public đỏ | Đã đo (R12.3): Directus thêm `_empty: Void`; port nguyên nên giống |
| `redact.test.ts`: log container có dòng của request khác chen vào, hoặc `LOG_STYLE=raw` đổi format các file blackbox khác đọc log | ca redact đỏ ngẫu nhiên | lọc theo `/auth/refresh`, `/graphql/system` và mốc thời gian như test gốc; `mail.test.ts` lọc theo substring, không phụ thuộc format |
| `health.test.ts` kiểm `email` trong `server_health` của admin: Directus có `EMAIL_*` mặc định (sendmail) nên có mục `email`, app mới không (D-07) | ca health đỏ ở app mới | so theo D-07 như `src/server/health.test.ts` của 001 (entry `doc`/`http` đã có) |
| Cache schema theo `role_user` không thấy policy đổi trực tiếp trong DB | SC-005 đỏ nếu test sửa DB thô | bộ đối chiếu đổi quyền qua API (phát `schemaChanged`); R-30 ghi nhận |
| `graphql-compose` 9.1.0 kéo `graphql` peer: pnpm catalog phải trùng để không có hai bản `graphql` (lỗi "Cannot use GraphQLSchema from another module") | app không khởi động | catalog pin 16.12.0; `pnpm why graphql` ở task thư viện |
| Guard `accepted-differences` đỏ khi xóa D-09.9, D-15 trước khi spec `Done` | CI đỏ | xóa trong commit đóng feature (tiền lệ 007 đến 010) |
| Nhánh tạo từ 28191d6, main đã có f9e5ca9 (phiên 010 báo) | conflict khi push | rebase lên main trước commit đầu |
