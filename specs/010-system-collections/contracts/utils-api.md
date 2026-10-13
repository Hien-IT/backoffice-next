# Contract: `/utils` (010)

Chuẩn là Directus 11.17.4 `controllers/utils.ts`, `services/utils.ts`, `services/import-export.ts`,
`utils/generate-translations.ts`. Router `/utils` không có `useCollection`. Thứ tự route như Directus.

## 1. `GET /random/string`

| Bước | Hành vi |
|------|---------|
| joi | `{ length: number integer min 1 max 500 default 32 }`, `allowUnknown: true`; lỗi → `400 INVALID_QUERY` với `reason` = joi message |
| kết quả | `res.json({ data: nanoid(length) })`; không kiểm đăng nhập (R-27) |

## 2. `POST /hash/generate`, `POST /hash/verify`

| Route | Kiểm | Kết quả |
|-------|------|---------|
| `generate` | `!body?.string` → `400 INVALID_PAYLOAD` `"string" is required` | `{ data: await generateHash(string) }` (argon2, tham số của `utils/generate-hash.ts`) |
| `verify` | thiếu `string` → `400` `"string" is required`; thiếu `hash` → `400` `"hash" is required` | `{ data: await argon2.verify(hash, string) }`; argon2 ném lỗi → `400` `Invalid "hash" or "string"` |

## 3. `POST /sort/:collection`

| Bước | Hành vi |
|------|---------|
| `collectionExists` | collection không có → `403` (`ForbiddenError`) như middleware Directus |
| joi | `{ item: string\|number required, to: string\|number required }` → `400 INVALID_PAYLOAD` |
| `UtilsService.sort` | `sort_field` từ `directus_collections` (hoặc `systemCollectionRows`); không có → `400` `Collection "<c>" doesn't have a sort field`; non-admin: `validateAccess(update, collection)` rồi `fetchAllowedFields`: field sort không được phép → `403`; điền sort cho dòng null (max + 1 lần lượt); có trùng → đánh lại 1..n theo sort; đặt `item` = sort của `to`; dời khoảng giữa bằng `decrement`/`increment`; `shouldClearCache(cache, undefined, collection)` → `cache.clear()`; `emitAction(['items.sort', '<c>.items.sort'], { collection, item, to })` |
| kết quả | `200` không body |

## 4. `POST /revert/:revision`

`RevisionsService.revert(revision)` (008) rồi `respond` (`204`). Lỗi của `revert` giữ nguyên (`403` revision không
có, `422` revision không có `data`).

## 5. `POST /import/:collection`

| Bước | Hành vi |
|------|---------|
| `collectionExists` | `403` |
| content type | `req.is('multipart/form-data') === false` → `415 UNSUPPORTED_MEDIA_TYPE` (`mediaType` = header, `where` = `Content-Type header`) |
| busboy | `Busboy({ headers })` (thêm `content-type: application/octet-stream` khi thiếu); sự kiện `file` → `ImportService.import(collection, mimeType, fileStream, { background: toBoolean(query.background) })`; xong → `200` không body; lỗi → `next(err)` |
| `import` | non-admin + collection hệ thống → `403`; `validateAccess(create)`, `validateAccess(update)`; mimetype ∉ `application/json`, `text/csv`, `application/vnd.ms-excel` → `415` (`where` = `file import`); bộ đếm `useStore(IMPORT_EXPORT_NAMESPACE, { ttl: IMPORT_TIMEOUT })`: `importCount >= IMPORT_MAX_CONCURRENCY` → `429 LIMIT_EXCEEDED` category `Concurrent import`; else `+1`; JSON → `importJSON`, CSV → `importCSV`; `background` → trả ngay, `.then` thông báo thành công, `.catch` log + thông báo thất bại, `.finally` `-1`; không `background` → `await`, `finally -1`, lỗi ném ra |
| `importJSON` | `StreamArray.withParser()`, mỗi phần tử `getService(collection, { knex: trx }).upsertOne(value, { bypassLimits: true? })` theo `services/import-export.ts:340-452`; lỗi gom (`rows` theo index) tới `MAX_IMPORT_ERRORS` |
| `importCSV` | `Papa.parse(stream, { header: true, dynamicTyping: true, ... })`, dòng → `set()` theo đường dẫn khóa `a.b`; như trên theo `453-640` |

`[Suy luận]` chi tiết `upsertOne` options, cách dựng `rows` của lỗi và thứ tự `transaction`: port nguyên từ
`import-export.ts`, kiểm bằng 37 unit test gốc (`import-export.test.ts`) và bộ đối chiếu `import-export.test.ts`.

## 6. `POST /export/:collection`

| Bước | Hành vi |
|------|---------|
| `collectionExists` | `403` |
| body | `!body.query` → `400` `"query" is required`; `!body.format` → `400` `"format" is required` |
| query | `sanitizeQuery(body.query, schema, accountability)` |
| nền | `ExportService.exportToFile(collection, sanitizedQuery, format, { file: body.file })` không await; `respond` → `204` |
| `exportToFile` | `createTmpFile()`; transaction: `service = getService(collection, { knex: trx })`; `sort` thêm khóa chính; `totalCount` qua `aggregate count`; `count = min(totalCount, limit)` khi `limit > -1`; lô `EXPORT_BATCH_SIZE`, `limit` lô cuối theo `requestedLimit`; CSV: `fields ?? ['*']` → `parseFields` → `getHeadingsForCsvExport`; `appendFile(tmp, transform(result, format, { includeHeader: batch === 0, includeFooter: last, fields }))`; `FilesService.uploadOne(createReadStream(tmp), { ...file, title, filename_download, type })`; thông báo thành công (`collection: directus_files`, `item: <id>`, link `PUBLIC_URL/admin/files/<id>`); lỗi → log `Couldn't export <c>: <msg>` + thông báo thất bại; `finally` cleanup |
| MIME | `csv` `text/csv`; `csv_utf8` `text/csv; charset=utf-8`; `json` `application/json`; `xml` `text/xml`; `yaml` `text/yaml`; format khác → `ServiceUnavailableError` của `transform` (đã có) trong nền (log + thông báo thất bại) |

## 7. `POST /translations/generate`

| Bước | Hành vi |
|------|---------|
| admin | `!accountability?.admin` → `403` |
| `generateTranslations(body, { knex, schema, accountability })` | port nguyên (zod `fromZodError` → `400 INVALID_PAYLOAD`; tạo collection ngôn ngữ, collection translations, field, relation trong transaction; `emitter`) |
| cache | `clearSystemCache({ forced: true })`; lỗi → `logger.error(..., 'Failed to clear system cache after translation changes')`, không lỗi response |
| kết quả | `{ data: result }` qua `respond` |

## 8. `POST /cache/clear`

`UtilsService.clearCache({ system })` với `system = 'system' in query && (query.system === '' || Boolean(query.system))`;
non-admin → `403`; `system` → `clearSystemCache({ forced: true })` (schema, quyền; bus tới app kia); luôn
`cache?.clear()`; `200` không body.

## 9. `POST /resolve-redirect`

`!body?.redirect` → `400` `"redirect" is required`; `provider` không phải chuỗi → `400` `"provider" must be a
string`; `resolveLoginRedirect(redirect, { provider })` (003) → `{ data }`; lỗi → `400` `Invalid "redirect" provided`.

## 10. Lỗi

Mọi lỗi dùng lớp của `@backoffice/errors` với cùng `code`, `status`, `reason`/`extensions` như Directus
(`INVALID_QUERY`, `INVALID_PAYLOAD`, `FORBIDDEN`, `UNSUPPORTED_MEDIA_TYPE`, `LIMIT_EXCEEDED`, `FAILED_VALIDATION` với
`rows`, `SERVICE_UNAVAILABLE`).

## 11. Dòng DB và tác dụng phụ

| Route | Ghi |
|-------|-----|
| `sort` | cột sort của collection (knex thô, không activity, revision; R-26) |
| `revert` | item + `directus_activity` `update`, `directus_revisions` (008) |
| `import` | item qua `upsertOne` (activity, revision theo `accountability`), thông báo khi `background` |
| `export` | `directus_files` + file trong storage + thông báo |
| `translations/generate` | `directus_collections`, `directus_fields`, `directus_relations` + bảng thật (006) |
| `cache/clear` | không ghi DB; xóa Redis cache, bus `schemaChanged`/quyền |

## 12. `router-options` (khối Feature 010, phần utils)

| Mẫu | Allow |
|-----|-------|
| `/utils/random/string` | `GET,HEAD` |
| `/utils/hash/(generate\|verify)` | `POST` |
| `/utils/sort/<collection>` | `POST` |
| `/utils/revert/<revision>` | `POST` |
| `/utils/(import\|export)/<collection>` | `POST` |
| `/utils/translations/generate` | `POST` |
| `/utils/cache/clear` | `POST` |
| `/utils/resolve-redirect` | `POST` |

Tính từ thứ tự route của `controllers/utils.ts` (T004); `/utils`, `/utils/sort` (thiếu collection) không khớp route → `404`. `utils-misc.test.ts` so `OPTIONS` với Directus thật.
