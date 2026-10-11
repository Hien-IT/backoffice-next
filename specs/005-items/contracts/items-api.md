# Contract: `/items/:collection` (005)

Nguồn: `directus/api/src/controllers/items.ts`, `middleware/collection-exists.ts`, `middleware/validate-batch.ts`.
Mọi quy tắc chung (body `validateBatch`, `SEARCH`, `MAX_BATCH_MUTATION`, `validateKeys`, đọc lại sau ghi, `204`) theo
FR-041 của 004 (`specs/004-permissions/contracts/permissions-api.md`).

## 1. Route

Thứ tự đăng ký (quyết định `Allow` và khớp route). Mỗi handler: `collectionExists` → (`validateBatch`) → kiểm
collection hệ thống → service → `respond(req, res)`.

| # | Method | Path | Middleware | Body | Service | Response |
|---|--------|------|------------|------|---------|----------|
| 1 | `POST` | `/:collection` | `collectionExists` | object hoặc mảng | `createOne` / `createMany` rồi `readOne` / `readMany(keys, sanitizedQuery)` | `200 {data}`; `204` khi đọc lại `403`; singleton → `404 ROUTE_NOT_FOUND` |
| 2 | `SEARCH` | `/:collection` | `collectionExists`, `validateBatch('read')` | `{query?, keys?}` | `readSingleton` (singleton) / `readMany(keys)` / `readByQuery`; `MetaService.getMetaForQuery` | `200 {meta, data}` |
| 3 | `GET` | `/:collection` | `collectionExists` | (body `keys` nếu client gửi) | như 2 | `200 {meta, data}` |
| 4 | `GET` | `/:collection/:pk` | `collectionExists` | — | `readOne(pk, sanitizedQuery)` | `200 {data}` |
| 5 | `PATCH` | `/:collection` | `collectionExists`, `validateBatch('update')` | mảng có pk / `{keys, data}` / `{query, data}`; singleton: object | singleton: `upsertSingleton` rồi `readSingleton`; mảng → `updateBatch`; `keys` → `updateMany`; `query` → `sanitizeQuery(body.query)` rồi `updateByQuery`; rồi `readMany(keys, sanitizedQuery)` | `200 {data}`; `204` khi đọc lại `403` (không áp cho singleton: `403`) |
| 6 | `PATCH` | `/:collection/:pk` | `collectionExists` | object | `updateOne` rồi `readOne` | `200 {data}`; `204` khi `403`; singleton → `404` |
| 7 | `DELETE` | `/:collection` | `collectionExists`, `validateBatch('delete')` | mảng / `{keys}` / `{query}` | `deleteMany` / `deleteByQuery(sanitizeQuery(body.query))` | `204` |
| 8 | `DELETE` | `/:collection/:pk` | `collectionExists` | — | `deleteOne` | `204` |

`validateBatch` với singleton: `validate-batch.ts:14` bỏ qua kiểm body khi method khác `SEARCH`, scope khác `read` và
`req.singleton` (đã port ở 004), nên body object của `PATCH /:collection` và body rỗng của `DELETE /:collection` không
bị `400`; ca singleton của blackbox kiểm.

## 2. `collectionExists`

| Điều kiện | Kết quả |
|-----------|---------|
| Không có `req.params.collection` | `next()` |
| `collection` không thuộc `req.schema.collections` | `403 FORBIDDEN`, message `You don't have permission to access collection "<c>" or it does not exist. Queried in root.` |
| Có | `req.collection = <c>`; `req.singleton` = cờ `singleton` của `systemCollectionRows` (collection hệ thống) hoặc `schema.collections[c].singleton ?? false` |

Sau đó mỗi handler: `isSystemCollection(collection)` → `403 FORBIDDEN` (`You don't have permission to access this.`)
trước khi đọc body.

## 3. `OPTIONS`, `HEAD`, dấu `/` cuối (FR-005, `router-options.ts`)

| Path | `Allow` |
|------|---------|
| `/items/<c>`, `/items/<c>/` | `POST,SEARCH,GET,HEAD,PATCH,DELETE` |
| `/items/<c>/<pk>`, `/items/<c>/<pk>/` | `GET,HEAD,PATCH,DELETE` |
| `/items`, `/items/`, `/items/a/b/c` | không có route → `404 ROUTE_NOT_FOUND` |

`OPTIONS` trả lời trước `collectionExists` (router Express 4 của Directus), nên collection lạ vẫn `200`. `HEAD` như `GET`
không body.

## 4. Thứ tự lỗi (FR-006)

Theo FR-005 của 004: (1) `extractToken` `400`; (2) rate limiter `429`; (3) `authenticate` `401`/`403`; (4)
`sanitizeQuery`, `validateQuery` `400 INVALID_QUERY` (cả `export` sai giá trị); (5) route: không khớp `404`;
`collectionExists` `403`; `validateBatch` `400 INVALID_PAYLOAD`; collection hệ thống `403`; singleton `404`; (6)
service: kiểm quyền `403`, `validateKeys` `403`, `MAX_BATCH_MUTATION` `400`; (7) lỗi dữ liệu `400 FAILED_VALIDATION`,
`RECORD_NOT_UNIQUE`...; (8) lỗi DB đã dịch.

## 5. Query (FR-004)

Như FR-040 của 004, cộng `export` (contracts/export.md). `version`, `versionRaw`: D-09.6 tới 008 (hành vi hiện tại của
`ItemsService` port ở 004 giữ nguyên, đo trong `crud.test.ts`).

## 6. Dữ liệu ghi

Như contracts/db-writes.md của 004 cho collection người dùng: dòng của collection (và collection liên quan khi ghi
lồng), `directus_activity` (khi có accountability), `directus_revisions` (khi collection có `accountability` khác
`null` trong `directus_collections`), xóa cache dữ liệu theo `shouldClearCache`.
