# Contract: `/collections`, `/fields`, `/relations`, `/schema` (006)

Mốc là `controllers/{collections,fields,relations,schema}.ts` của Directus 11.17.4. Mọi route đi qua pipeline của
001 đến 005 (`authenticate` → `schema` → `sanitizeQuery` → `cache` → `routerOptions`) rồi handler Nest, kết thúc
bằng `respond(req, res)` (cache ghi, `export`, `204` khi không payload).

## 1. Route

| Route | Middleware trong handler | Service | Response | Ghi chú |
|-------|--------------------------|---------|----------|---------|
| `POST /collections` | — | `createOne` hoặc `createMany` (body mảng) | `{data}` đọc lại; `204` nếu đọc lại `Forbidden` | query `concurrentIndexCreation` |
| `GET /collections`, `SEARCH /collections` | `validateBatch('read')` | `readMany(body.keys)` hoặc `readByQuery()` (không nhận query) | `{data, meta}` (`MetaService.getMetaForQuery('directus_collections', {})`) | |
| `GET /collections/:collection` | — | `readOne` | `{data}` | |
| `PATCH /collections` | — | `updateBatch` (body phải là mảng) | `{data}` đọc lại; `204` khi `Forbidden` | chỉ `meta` |
| `PATCH /collections/:collection` | — | `updateOne` | như trên | |
| `DELETE /collections/:collection` | — | `deleteOne` | `204` | |
| `GET /fields` | — | `readAll()` | `{data}` | lọc theo quyền đọc |
| `GET /fields/:collection` | `validateCollection` | `readAll(collection)` | `{data}` | |
| `GET /fields/:collection/:field` | `validateCollection` | `readOne` | `{data}` (`null` khi không có) | |
| `POST /fields/:collection` | `validateCollection`, Joi `newFieldSchema` | `createField` | `{data}` đọc lại; `204` khi `Forbidden` | `concurrentIndexCreation` |
| `PATCH /fields/:collection` | `validateCollection`, body mảng, `systemFieldUpdateSchema` (zod) cho field hệ thống | `updateFields` (tuần tự, không transaction) | `{data: [...]}`; `204` khi `Forbidden` | |
| `PATCH /fields/:collection/:field` | `validateCollection`, Joi `updateSchema` (zod cho field hệ thống) | `updateField` | `{data}`; `204` khi `Forbidden` | `field` mặc định theo URL |
| `DELETE /fields/:collection/:field` | `validateCollection`; field hệ thống → `403` | `deleteField` | `204` | |
| `GET /relations` | — | `readAll()` | `{data}` | |
| `GET /relations/:collection` | — | `readAll(collection)` | `{data}` | |
| `GET /relations/:collection/:field` | — | `readOne` | `{data}` | |
| `POST /relations` | Joi `newRelationSchema` (`collection`, `field` bắt buộc; `schema.on_delete` ∈ NO ACTION, SET NULL, SET DEFAULT, CASCADE, RESTRICT) | `createOne` | `{data}` đọc lại; `204` khi `Forbidden` | |
| `PATCH /relations/:collection/:field` | Joi `updateRelationSchema` | `updateOne` | `{data}`; `204` khi `Forbidden` | |
| `DELETE /relations/:collection/:field` | — | `deleteOne` | `204` | |
| `GET /schema/snapshot` | — | `snapshot()` | `{data: snapshot}`; `?export=yaml` thành file | admin |
| `POST /schema/diff` | `schemaMultipartHandler` | `diff(snapshot, {force: 'force' in req.query})` | `{data: {hash, diff}}`; `204` khi không khác | admin |
| `POST /schema/apply` | `schemaMultipartHandler` | `apply({hash, diff}, {force: toBoolean(req.query.force)})` | `204` | admin |

`validateCollection` là `collectionExists` đã port ở 005 (Directus import cùng file với tên đó): collection không có
trong schema → `403 FORBIDDEN` (message của `createCollectionForbiddenError`). `/fields`, `/relations` có
`useCollection('directus_fields' | 'directus_relations')`; `/collections`, `/schema` không có (`req.collection`
`undefined`).

## 2. `schemaMultipartHandler` (`controllers/schema.ts:27-100`)

- `Content-Type: application/json`: body đã parse; rỗng → `400 INVALID_PAYLOAD` "No data was included in the body".
- Không phải multipart → `415 UNSUPPORTED_MEDIA_TYPE`.
- Multipart (busboy): đúng một file; mimetype `application/json` → `parseJSON`; khác → `js-yaml.load`; lỗi parse →
  `400` "The provided JSON/YAML is invalid"; hai file → `400` "More than one file..."; không file → `400` "No file was
  included in the body". Kết quả đặt vào `res.locals['uploadedSnapshot']` hoặc `req.body` như gốc.
- Giới hạn kích thước: như Directus (busboy không đặt `limits`; `MAX_PAYLOAD_SIZE` chỉ áp cho JSON qua `jsonBody`).

## 3. `OPTIONS`, `HEAD`, dấu `/` cuối (`router-options.ts`)

Thêm theo thứ tự mount của Directus (`collections`, `fields` trước `items`; `relations`, `schema` sau):

| Mẫu | `Allow` |
|-----|---------|
| `^/collections/?$` | `POST,GET,HEAD,SEARCH,PATCH` |
| `^/collections/[^/]+/?$` | `GET,HEAD,PATCH,DELETE` |
| `^/fields/?$` | `GET,HEAD` |
| `^/fields/[^/]+/?$` | `GET,HEAD,POST,PATCH` |
| `^/fields/[^/]+/[^/]+/?$` | `GET,HEAD,PATCH,DELETE` |
| `^/relations/?$` | `GET,HEAD,POST` |
| `^/relations/[^/]+/?$` | `GET,HEAD` |
| `^/relations/[^/]+/[^/]+/?$` | `GET,HEAD,PATCH,DELETE` |
| `^/schema/snapshot/?$` | `GET,HEAD` |
| `^/schema/(diff\|apply)/?$` | `POST` |

`[Suy luận]` thứ tự method trong `Allow` theo thứ tự đăng ký của router Express 4; task đo bằng `OPTIONS` tới Directus
trước khi viết (mẫu 004, 005).

## 4. Thứ tự lỗi

1. `authenticate` (`401`), `schema`, `sanitizeQuery` (`400 INVALID_QUERY`), cache.
2. `validateCollection` (`403`) — trước Joi và trước kiểm admin của service.
3. `validateBatch` (`GET`/`SEARCH /collections`), body mảng (`PATCH /collections`, `PATCH /fields/:c`:
   `400` "Submitted body has to be an array"), Joi (`400 INVALID_PAYLOAD` với message của Joi), zod field hệ thống
   (`400` "Only \"schema.is_indexed\" may be modified for system fields"), field hệ thống ở `DELETE` (`403`).
4. Service: không admin → `403 FORBIDDEN`; tên, trùng, kiểu (`400 INVALID_PAYLOAD`, message của gốc: "Collection name
   can't start with \"directus_\"", "The collection name can't contain a slash", "Collection \"x\" already exists",
   "Field \"x\" already exists in collection \"y\"", "Alias type cannot be changed", "Illegal type passed: x"...);
   lỗi DB dịch qua `translateDatabaseError` (`400 RECORD_NOT_UNIQUE`, `VALUE_TOO_LONG`, `NOT_NULL_VIOLATION`...);
   `schema` util: `400 INVALID_PAYLOAD` với message của `validateSnapshot`, `validateApplyDiff`
   (contracts/snapshot.md §3).
5. `MAX_BATCH_MUTATION` không áp cho ba route này (service dùng `bypassLimits` khi ghi `directus_fields`).

## 5. Quyền đọc (FR-002)

- `/collections`: non-admin thấy collection trong `fetchAllowedCollections('read')` và collection cha (`group`) của
  chúng; `readOne` dùng `validateAccess`.
- `/fields`: non-admin thấy field trong `fields` của permission đọc (`*` hoặc danh sách); `GET /fields/:c` với
  collection không được đọc → `403`; `readOne` cần quyền đọc field đó.
- `/relations`: `filterForbidden` theo collection, `one_allowed_collections`, field, `one_field`.
- `/schema/*`: admin, nếu không `403`.

## 6. Response cache

`GET` của bốn nhóm route được cache như mọi `GET` (005): key `getCacheKey` (`user`, `path`, `query`), header theo
`CACHE_AUTO_PURGE`; `permissionsCacheable(req.collection)` với `directus_fields`, `directus_relations` hoặc
`undefined`. Bộ đối chiếu gửi `Cache-Control: no-store` mặc định (R4 của 005) nên hai app đều `MISS`.
