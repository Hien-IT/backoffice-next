# Contract: bộ đối chiếu, blackbox, cặp `graphql-nointro`, CI, E2E, benchmark (011)

Mẫu theo contracts/parity.md của 010. Mọi test mới chạy với cả hai app trên cùng DB (Nguyên tắc V).

## 1. Môi trường đối chiếu

| Thay đổi | Nội dung |
|----------|----------|
| `proxy/backoffice-routes.txt` | thêm `graphql`, **cùng task đăng ký controller** (app Directus gọi `/graphql` ở Insights và "Save as copy"; `404` làm panel hỏng) |
| `env/profile-blackbox.env` | thêm `LOG_STYLE=raw`, `LOG_LEVEL=info` (research R10: `redact.test.ts` đọc dòng http JSON) |
| profile `graphql-nointro` (cặp mới) | `directus-graphql-nointro`, `backoffice-api-graphql-nointro` với `env/profile-graphql-nointro.env`: `GRAPHQL_INTROSPECTION=false`, `GRAPHQL_QUERY_TOKEN_LIMIT=50`, `GRAPHQL_SCHEMA_CACHE_CAPACITY=2`, `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT=1`; cùng DB, Redis, namespace với cặp chính; đăng ký `config.ts profilePorts`, `docker.ts compose()`, `scripts/env.mjs ALL_PROFILES`; không `manualProfiles` |
| `request-set.ts` | thêm `POST /graphql { query: "{ __typename }" }`, `POST /graphql/system`, `GET /server/specs/graphql` cho `db-unchanged` |
| `server/errors.test.ts`, `server/methods.test.ts` | bỏ ca D-09.9 (`/graphql` 404) và D-15 (`OPTIONS /server/specs/graphql`) |
| `accepted-differences.ts` | xóa D-09.9, D-15 ở commit đóng feature (guard `removeAt: '011'`) |

## 2. Thư mục `tests/parity/src/graphql/`

| File | Suite | Nội dung |
|------|-------|----------|
| `helpers.ts` | — | `gql(app, scope, document, variables?, token?, method = 'POST')`; `introspection(app, scope, token)` = `getIntrospectionQuery({ descriptions: true, specifiedByUrl: true, directiveIsRepeatable: true, schemaDescription: true, inputValueDeprecation: true })`; `sdl(app, scope, token)`; `sameGql(document, users)` gửi tới hai app và `toEqual` body (nguyên văn, kể cả thứ tự), status, header cache; `graphqlEffects(fn)` dòng DB (bảng dữ liệu, `directus_activity`, `directus_revisions`, `directus_sessions`) với `comparable()` của 010; `warnLines` của 010; `userWithPolicy` của 004 |
| `schema.test.ts` | `reduced` (admin + một user), `full` | US4: introspection và SDL hai scope cho admin, user A (đọc một số field của hai collection), user B (đọc theo filter, create không read), user C (update và delete không read trên một collection, read trên quan hệ), public có policy đọc một collection, public không policy; so nguyên văn (SC-001); xóa cache chéo: tạo field ở Directus → introspection ở app mới đổi ngay và ngược lại; sửa quyền của user A ở app mới → Directus đổi (SC-005); collection tạm tên `Query`, field tên `1abc` → bị bỏ ở hai app, dòng log cảnh báo ở app mới; cặp `graphql-nointro`: `__schema` → `400`, `/server/specs/graphql` → `404`, document 60 token → `400` (SC-006); `GRAPHQL_SCHEMA_CACHE_CAPACITY=2`: ba user liên tiếp vẫn đúng |
| `read.test.ts` | `reduced`, `full` | US1: trên data model của 005 (`articles`, `categories`, `tags`, m2m, m2a): danh sách với `filter` (mọi toán tử theo kiểu, `_and`, `_or`, qua quan hệ, `_some`, `_none`, `_FUNC`), `sort`, `limit`, `offset`, `page`, `search`; lồng ba cấp có arg; `_by_id`, `_by_version` (có version của 008), singleton; `_aggregated` mọi hàm, `groupBy`, hàm ngày giờ; alias, fragment, inline fragment union, `__typename`, variables, `operationName`; `GET` với `variables`; user quyền một phần, public; so với REST tương đương như blackbox |
| `write.test.ts` | `reduced`, `full` | US2: `create_*_item(s)` với input lồng m2o, o2m (`create`, `update`, `delete`), m2m, m2a; `update_*_item(s)`, `update_*_batch`, `delete_*_item(s)`, `update_<singleton>`; selection sau mutation; `MAX_BATCH_MUTATION`; `FORBIDDEN`, `RECORD_NOT_UNIQUE`, validation trong `errors[]`; mutation ở app A, đọc ở app B; `GET` mutation `405`; flow event của 009 chạy; dòng DB so |
| `system.test.ts` | `reduced` (auth, ping, info), `full` | US3: `users`, `roles`, `files`, `activity` (không mutation), `collections*`, `fields*`, `relations*`; `auth_login` ba `mode` (cookie, `directus_sessions`), `auth_refresh`, `auth_logout`, token chéo; `auth_password_request`, `users_invite`, `users_register` (log D-23, D-27, D-28 ở app mới); `users_me`, `update_users_me`, `users_me_tfa_*`; `utils_*`; `create_fields_item` → DDL và `collections` ở app kia; `extensions`, `update_extensions_item` (D-37); `server_ping`, `server_info`, `server_health`, `server_specs_oas`, `server_specs_graphql` |
| `errors.test.ts` | `full` | US5: sai cú pháp, field không có, arg sai kiểu, scalar sai (`Date`, `BigInt`, `Hash`), nhiều operation không `operationName`, `operationName` lạ, `variables` JSON sai (`GET`), thiếu `query`, method `PUT`, `OPTIONS`, `HEAD`; lỗi resolver admin và user thường (message che); `extensions.errors[].path`, `locations` |
| `cache.test.ts` | `full` | US5 ca 3, 4: cặp `cache-redis` (005): `POST /graphql` lần hai HIT ở app kia, mutation không cache, response có `errors` không cache, `Cache-Control: no-store`; R-31 (hai document khác khoảng trắng → hai entry) |
| `e2e-app.test.ts` | `full` | chuỗi request của `stores/insights.ts` (một request `/graphql` gộp nhiều panel với alias, một `/graphql/system`, lỗi một panel → `400` với `path`) và `use-item.saveAsCopy` (`<alias>_by_id` với field quan hệ, m2a alias) |

`REDUCED_FILES` thêm `src/graphql/{schema,read,write,system}.test.ts`; `FULL_FILES` thêm `src/graphql/**/*.test.ts`;
`CACHE_FILES` thêm `src/graphql/cache.test.ts`. `reduced` chạy MySQL, SQLite mỗi lần push; `full` Postgres mỗi lần
push, vendor còn lại nightly.

## 3. Blackbox (research R10)

| File | Việc |
|------|------|
| `common/transport.ts` | `requestGraphQL` gửi tới `host` của test (app đang thử) |
| `common/config.ts` | bỏ `getDirectusUrl` nếu không còn dùng |
| `tests/db/routes/items/{no-relation,o2m,m2m,m2o,m2a,singleton}.test.ts`, `fields/crud.test.ts`, `collections/crud.test.ts` | không sửa nội dung; chạy lại, 100% ca đạt ở `PARITY_BLACKBOX_APP=backoffice` |
| `tests/common/auth/login.test.ts`, `refresh.test.ts` | copy; bỏ ca WebSocket (D-17, như items) |
| `tests/common/logger/redact.test.ts` | copy; `TestLogger` → `logs()` của `docker.ts` theo `PARITY_BLACKBOX_APP`, lọc dòng kể từ mốc; bỏ `spawn` |
| `tests/db/routes/server/ping.test.ts`, `health.test.ts` | copy; bỏ SMTP giả (`health` so theo D-07) |
| `suite.ts` `BLACKBOX_FILES` | thêm năm file |
| CI job `parity-blackbox` | không đổi profile |

## 4. Unit test port (FR-062)

`aggregate-query.test.ts` (17), `filter-replace-m2a.test.ts` (15), `dedupe-resolvers.test.ts` (13),
`parse-query.test.ts` (13), `resolvers/query.test.ts` (9), `replace-fragments.test.ts` (6), `process-error.test.ts`
(4), `sanitize-gql-schema.test.ts` (4) port nguyên cạnh code (`@directus/schema-builder` → `@backoffice/schema-builder`,
`vi.mock` đường dẫn app). Test mới (Directus không có): `graphql.controller.test.ts` (supertest: method, `GET`
mutation, thiếu query, scope theo path), `middleware/graphql.test.ts`, `schema-cache.test.ts` (LRU, `schemaChanged`),
`schema/index.test.ts` (khóa cache, hàng đợi), `server.controller.test.ts` (`specs/graphql`), `get-cache-key.test.ts`
(nhánh GraphQL), `supported-variables.test.ts`, `router-options.test.ts`. Coverage 80% `apps/api`.

## 5. CI

| Job | Thay đổi |
|-----|----------|
| `parity` Postgres `full` | `--profiles` thêm `graphql-nointro`; `cache-redis` đã có ở job `parity-cache` (thêm `src/graphql/cache.test.ts` vào `CACHE_FILES`) |
| `parity` MySQL, SQLite `reduced` | file `reduced` mới chạy trên cặp chính, không profile mới |
| `parity-blackbox` | năm file thêm vào `BLACKBOX_FILES` |
| `e2e-directus-app` | `graphql.spec.ts`, `routing.spec.ts` sửa |
| `nightly.yml` | vendor còn lại chạy `full` gồm `src/graphql` |
| `benchmark.yml` | job `benchmark-graphql` (hằng tuần, ngoại lệ 003) |
| `ci-local.sh` | `graphql-nointro` vào profiles Postgres |

## 6. Playwright `tests/directus-app-e2e/src/graphql.spec.ts` (research R11)

| Kịch bản | Bước | Kiểm |
|----------|------|------|
| Insights với panel GraphQL | tạo dashboard; thêm panel Metric `count` trên `articles`, panel List trên `articles` hiển thị `category.name`, panel Metric trên `directus_users`; mở dashboard | giá trị ba panel bằng lượt Directus; `proxyLog` cho thấy `/graphql`, `/graphql/system` tới app mới |
| Save as copy | collection có `item_duplication_fields` (`title`, `category`, `tags`); mở item, "Save as copy" | item mới có cùng `title`, `category`, `tags` ở hai lượt; request `POST /graphql` tới app mới |
| `routing.spec.ts` | thêm `/admin/insights/<id>` có panel GraphQL | `graphql` trong danh sách route tới app mới |

## 7. Benchmark `tests/benchmark/src/graphql.ts`

Kịch bản (admin và user quyền một phần; fresh và cache như `items.ts`): `list` (`articles(filter, sort, limit) { id
title category { name } }`), `by_id`, `aggregated` (`count`, `groupBy status`), `introspection` (admin, fresh, schema
đã cache), `create_articles_item`. Cổng 10% (SC-007). Thêm đo một lần: `utils_cache_clear` rồi một request
introspection (thời gian sinh schema lần đầu), chỉ in. Job `benchmark-graphql` trong `benchmark.yml`, `project.json`
target `graphql`.
