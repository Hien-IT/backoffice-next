# Contract: Tests (FR-018, Nguyên tắc V, X)

## Unit (`apps/api`, Vitest, knex-mock-client)

| File                                                | Case                                                                                                   |
|-----------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| `utils/collection-toggles.test.ts`                  | miss → một `select`; `false`, `0`, `null`, `true`, `1`; hit không query; `hasSearchOff`; `assertToggle` ném đúng lỗi quyền collection (message, `Queried in root`/`"<path>"`); `assertCollectionToggles`: `search` rỗng/khoảng trắng, `export`, `deep` o2m, m2o, a2o (`field:collection`, `field__collection`), quan hệ không có, collection hệ thống |
| `middleware/collection-toggles-guard.test.ts`       | `/items/A`, `/items/A/1`, `POST`/`PATCH /items/A?search=` và `?export=` (trước controller), `/users?deep=...`, `/graphql` (cờ chỉ khi `hasSearchOff` và có `search`), `/parity-endpoint-demo/items?search=` và `/server/info` → `next()`, `/items/A?search=` rỗng |
| `middleware/cache.test.ts`                          | `res.locals.skipCacheRead` → MISS + `next()` không đọc Keyv                                            |
| `controllers/items.controller.test.ts`              | `SEARCH` body `query.search` 403; `PATCH`/`DELETE` theo query 403, không gọi service; toggle bật như cũ |
| `controllers/utils.controller.test.ts`              | import 403 trước busboy; export 403; export bật + body `query.search` tắt → 403                        |
| `services/graphql/resolvers/query.test.ts`          | gốc, `_aggregated`, field lồng (`deep`) → `ForbiddenError`; `/graphql/system` gốc không chặn           |
| `services/graphql/resolvers/mutation.test.ts`       | `create_*_items(search)` → lỗi trước `createMany`; không `search` như cũ                                |

## Unit (`apps/web`)

| File                                   | Case                                                                                  |
|----------------------------------------|---------------------------------------------------------------------------------------|
| `components/drawers/DrawerCollection.test.ts` | meta `false`: `SearchInput` nhận `show-search=false`, layout nhận `search=null`; `true`/`null` như cũ |
| `interfaces/list-o2m/ListO2M.test.ts`  | meta `false` + `enableSearchFilter`: không ô search, `query.search` không có           |
| `interfaces/list-m2m/ListM2M.test.ts`  | như trên theo junction                                                                 |

## Parity (`tests/parity`, cặp chính Postgres; reduced sqlite3, mysql)

| File                                       | Nội dung                                                                                              |
|--------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `src/items/collection-toggles.test.ts` (mới) | collection per-run; mọi dòng của contracts/api.md §1–§3 với admin, user thường, share (đăng nhập share theo `auth/shares.test.ts`), public (policy của `schema/helpers.ts` `getPublicPolicy`) và static token (user của `permissions/fixtures.ts` `createUser`): D-188 `http` (Directus 200/204, Backoffice 403 hay GraphQL `errors` FORBIDDEN), Backoffice kiểm status, câu lỗi quyền collection, dữ liệu không đổi; endpoint hệ thống (analyze C1): collection per-run có m2o `owner` → `directus_users` và alias o2m trên `directus_users` (chỉ dòng `directus_fields` và `directus_relations.one_field`, không DDL bảng hệ thống; file chạy một mình vì `fileParallelism: false` ở `vitest.parity.config.ts:10`), `GET /users?deep[<alias>][_search]=x` và `/graphql/system` `users { <alias>(search: "x") { id } }`; FR-013 (analyze G1): `PATCH /collections` ở Directus, không xóa cache tay, request sau tới Backoffice 403; §1 dòng "giống Directus", §4 toggle bật/null: `assertParity`; US5-2 cache: Directus ghi trước, Backoffice 403 / `errors`; `afterAll` bật lại cài đặt, xóa alias và quan hệ trên `directus_users`, xóa cache |
| `src/flows/operations.test.ts`             | `item-read` với `query.search` trên collection tắt: hai app cùng dữ liệu (FR-009)                     |
| `src/extensions/endpoints.test.ts` (profile `extensions`) | `bo_ext_items` tắt ba cài đặt: `GET /parity-endpoint-demo/items?search=x&export=csv` giống ở hai app, bật lại sau (FR-009, SC-004) |
| `accepted-differences.ts`                  | D-188 `http` (`endpoints` theo `parity_toggles_*`, `GET /users`, `POST /graphql`, `POST /graphql/system`, `when.backofficeCode: 'FORBIDDEN'`), D-188.1..D-188.4 `doc` |
| `src/suite.ts`                             | thêm file mới vào danh sách reduced và full                                                            |
| Blackbox, `graphql/{schema,read,write,cache}.test.ts`, `items/cache-*.test.ts` | không đổi (không dùng `search` trên collection tắt; schema GraphQL không đổi) |

## E2E (`apps/web-e2e`, ba cấu hình × admin, reader)

| Test (trong `content-collection-toggles.spec.ts`)        | proxy-api, cors                                         | proxy-directus (D-188) |
|-----------------------------------------------------------|----------------------------------------------------------|------------------------|
| both false: bước API                                      | `?search=`, `?export=csv`, `POST /utils/export`, `POST /utils/import` → 403, item không tăng | 200 như nay |
| drawer chọn item của `bo_content` tắt search (US4-1, US4-2) | không `searchbox`, nút Filter, bảng tải; Tab + Enter mở popover | như nhau (giao diện) |
| `list-o2m` có "Search Filter", collection con tắt search (US4-4) | không ô search trong field `children`, bảng 11 dòng | như nhau |

## Benchmark

`benchmark-items`, `benchmark-web` hiện có, không scenario mới (SC-006: ≤ 10 % so với Directus).

## Vendor khác

MariaDB, MSSQL, Oracle, CockroachDB qua `nightly.yml` (chạy tay) như 022, 023.
