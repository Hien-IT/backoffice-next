# Contract: `/versions`, `?version=`, hash, delta, event (008)

Mốc: `controllers/versions.ts`, `services/versions.ts`, `utils/versioning/{handle-version,split-recursive}.ts` của
Directus 11.17.4. `useCollection('directus_versions')`.

## 1. Route

| Route | Service | Response |
|-------|---------|----------|
| `POST /` | `createMany` (mảng) hoặc `createOne`; đọc lại `readMany`/`readOne` (`Forbidden` → `204`) | `200 {data}` |
| `GET /`, `SEARCH /` | `validateBatch('read')`; `readSingleton` nếu `req.singleton`, `readMany(keys)`, `readByQuery` | `{data, meta}` |
| `GET /:pk` | `readOne` (delta qua `mapDelta`) | `{data}`; dòng không có → `403` |
| `PATCH /` | `validateBatch('update')`; `updateBatch`, `updateMany`, `updateByQuery` | `{data}`; `Forbidden` → `204` |
| `PATCH /:pk` | `updateOne` | `{data}` |
| `DELETE /`, `DELETE /:pk` | `validateBatch('delete')`; `deleteMany`, `deleteByQuery`, `deleteOne` | `204` |
| `GET /:pk/compare` | `readOne` → `verifyHash` → `getMainItem` | `{data: {outdated, mainHash, current, main}}` |
| `POST /:pk/save` | `readOne`, `getMainItem`, `save(pk, body)` | `{data: assign(mainItem, delta)}` |
| `POST /:pk/promote` | kiểm `mainHash` chuỗi; `promote(pk, mainHash, fields?)` | `{data: <khóa item>}` |

## 2. Lỗi

| Điều kiện | Status | code | reason |
|-----------|--------|------|--------|
| Tạo: Joi `key` (string, required), `name` (string, null), `collection` (string, required), `item` (string, required); field lạ | 400 | `INVALID_PAYLOAD` | message Joi |
| Tạo hoặc sửa `key = main` | 400 | `INVALID_PAYLOAD` | `"main" is a reserved version key` |
| Tạo: không đọc được item (`validateAccess` read) | 403 | `FORBIDDEN` | |
| Tạo: collection không bật versioning | 422 | `UNPROCESSABLE_CONTENT` | `Content Versioning is not enabled for collection "<c>"` |
| Tạo: trùng key (kiểm bằng service không accountability) | 422 | `UNPROCESSABLE_CONTENT` | `Version "<key>" already exists for item "<item>" in collection "<c>"` |
| `createMany`: không phải mảng | 400 | `INVALID_PAYLOAD` | `Input should be an array of items` |
| `createMany`: trùng key trong payload | 422 | `UNPROCESSABLE_CONTENT` | `Cannot create multiple versions on "<item>" in collection "<c>" with the same key "<key>"` |
| `updateMany`: field ngoài `key`, `name` | 400 | `INVALID_PAYLOAD` | message Joi |
| `updateMany`: nhiều version về cùng key | 422 | `UNPROCESSABLE_CONTENT` | `Cannot update multiple versions on "<item>" in collection "<c>" to the same key "<key>"` |
| `updateMany`: key trùng version khác | 422 | `UNPROCESSABLE_CONTENT` | `Version "<key>" already exists for item "<item>" in collection "<c>"` |
| `promote`: `mainHash` không phải chuỗi | 400 | `INVALID_PAYLOAD` | `"mainHash" field is required` |
| `promote`: không có quyền update item | 403 | `FORBIDDEN` | |
| `promote`: không có delta | 422 | `UNPROCESSABLE_CONTENT` | `No changes to promote` |
| `promote`: hash lệch | 422 | `UNPROCESSABLE_CONTENT` | `Main item has changed since this version was last updated` |
| `?version=` không có version hoặc item không đọc được | 403 | `FORBIDDEN` | |

Thứ tự kiểm khi tạo: Joi → `main` → quyền đọc item → versioning → trùng key → hash → ghi.

## 3. `hash`

`objectHash(await new ItemsService(collection, {accountability, knex, schema}).readOne(item))` (object-hash 3.0.0,
không tùy chọn). Dùng lúc tạo (`hash`), `compare` và `promote` (`mainHash`). Đọc theo quyền người gọi: user thấy
field khác nhau có hash khác nhau, như Directus.

## 4. `save` (FR-033)

1. `version = super.readOne(key)` (delta thô).
2. `revisionDelta = payloadService.prepareDelta(delta)` (`PayloadService` trên `directus_versions`).
3. Nếu `schema.collections[collection].accountability !== null`: `ActivityService` (không accountability) tạo
   `{action: 'version_save', user, collection, ip, user_agent, origin, item}`; nếu `all`: `RevisionsService` tạo
   `{activity, version: key, collection, item, data: revisionDelta, delta: revisionDelta}`.
4. `date = new Date(helpers.date.writeTimestamp(new Date().toISOString()))`; với mỗi object trong `revisionDelta`
   (không gắn vào mảng) chưa bằng `get(existingDelta, path)`: `_user = accountability.user`, `_date = date`.
5. `finalDelta = assign({}, existingDelta, revisionDelta)`; `ItemsService('directus_versions', {accountability admin})
   .updateOne(key, {delta: finalDelta})`.
6. `shouldClearCache(cache, undefined, collection)` → `cache.clear()`.
7. Trả `finalDelta`; controller trả `assign(mainItem, finalDelta)`.

## 5. `mapDelta` (readOne, getVersionSave)

`delta[primary] = item`; `deepMapWithSchema(delta, fn, {collection, schema}, {mapNonExistentFields: true,
detailedUpdateSyntax: true})`: bỏ `_user`, `_date`; object có khóa chính: `user-updated` ← `_user`, `date-updated`
← `_date`; object chưa có: `user-created`, `date-created`; field có trong object giữ; còn lại bỏ.

## 6. `?version=<key>` khi đọc item (`handleVersion`)

- `versionRaw`: `readByQuery(queryWithKey)` (rỗng → `403`), `getVersionSave(key, collection, item)` (delta đã
  `mapDelta`), trả `Object.assign(original, delta)`.
- Không `versionRaw`: `getVersionSave(..., mapDelta=false)` (không có → `403`); trong `transaction`: `ItemsService`
  admin `updateOne(key, rawDelta, {emitEvents: false, autoPurgeCache: false, skipTracking: true, overwriteDefaults,
  onItemCreate})`, `ItemsService` người gọi `readByQuery(queryWithKey)`, `trx.rollback()`; kết quả qua
  `deepMapWithSchema` đặt `null` cho khóa thuộc `createdIDs` (m2o, a2o, o2m, khóa chính).
- `readSingleton` với `version`: khóa chính là dòng đầu của bảng.
- `splitRecursive(delta)`: tách `_user`, `_date` thành `defaultOverwrites` cùng hình với `rawDelta`.

## 7. `promote`

`readOne(version)` (thô) → `validateAccess` update item → không delta `422` → `verifyHash` → `splitRecursive` →
`pick(rawDelta, fields)` nếu có → `emitFilter(['items.promote', '<c>.items.promote'], payload, {collection, item,
version}, {database, schema, accountability})` → `itemsService.updateOne(item, payload, {overwriteDefaults})` →
`emitAction` cùng tên với `{payload, collection, item: updatedKey, version}` → trả khóa.
