# Contract: TUS, storage, env, startup (007)

## 1. `/files/tus` (chỉ khi `TUS_ENABLED=true`)

`TusController` đăng ký trước `FilesController`. Mỗi handler: `checkFileAccess` (port `controllers/tus.ts`) →
`createTusServer({schema: req.schema, accountability: req.accountability})` → `server.handle(req, res)` → `cleanup()`.
`@tus/server` ghi thẳng `res` (không qua `respond`).

| Method + path | `checkFileAccess` |
|---------------|-------------------|
| `POST /files/tus` | action `create`; `Upload-Metadata` parse bằng `Metadata.parse` (lỗi → `INVALID_METADATA` status của `@tus/utils`); `metadata.id` → action `update`, `primaryKeys=[id]`; mọi key metadata là field của `directus_files` (trừ `id`) vào `fields` |
| `PATCH /files/tus/:id` | `update` |
| `DELETE /files/tus/:id` | `delete` |
| `OPTIONS`, `HEAD /files/tus/:id` | `read` |

`Server` options: `path:'/files/tus'`, `datastore: TusDataStore`, `locker: getTusLocker()`, `maxSize =
FILES_MAX_UPLOAD_SIZE` khi có, `generateUrl = PUBLIC_URL + '/files/tus/' + id`, `relativeLocation` khi `PUBLIC_URL`
bắt đầu `http`, `allowedHeaders`, `exposedHeaders` từ CORS env, `onUploadFinish` (data-model.md §8), header
`Directus-File-Id`. Khi `TUS_ENABLED=false`: không controller, request rơi vào `/files/:pk` như Directus.

Data store, locker, hết hạn: data-model.md §8. TUS chỉ dùng location đầu của `STORAGE_LOCATIONS`; driver không
`supportsTus` → `Error` (không xảy ra với `local`, `s3`).

## 2. Lịch dọn và synchronization

- `utils/schedule.ts` thêm `scheduleSynchronizedJob(id, rule, cb)` (port): `CronJob` của `cron` 4.3.4;
  `SynchronizedClock(`${id}:${rule}`)`.set(nextTimestamp)` qua `setGreaterThan`; chỉ chạy `cb` khi set được.
- `synchronization.ts` (port): `SYNCHRONIZATION_STORE=redis` → ioredis với script Lua `setGreaterThan`, key
  `${SYNCHRONIZATION_NAMESPACE ?? 'directus-sync'}:clock:tus-cleanup:<cron>`; else store bộ nhớ process (mỗi instance tự
  chạy, như Directus; dọn idempotent).
- `schedules/tus.ts` (port): khi `TUS_ENABLED` và cron hợp lệ → `scheduleSynchronizedJob('tus-cleanup',
  TUS_CLEANUP_SCHEDULE, cleanUpExpiredUploads)`; gọi ở startup sau `registerAuthProviders`; `stop()` khi shutdown
  (tiền lệ `schedules/metrics.ts`).

## 3. Storage

- `getStorage()` lười (001): `validateEnv(['STORAGE_LOCATIONS'])` → `registerDrivers` → `registerLocations`
  (`getConfigFromEnv('STORAGE_<LOC>_')` camelCase + `tus:{enabled, chunkSize}`). Driver `local`, `s3` của
  `libs/storage-driver-*` (port nguyên, đủ `TusDriver`). Không đổi.
- Startup: `validateStorageDrivers()` (dừng, exit 1, log location + driver + danh sách hỗ trợ; D-16) rồi
  `validateStorage()`. Không đổi; kiểm lại bằng `startup/*.test.ts` với nhiều location và với `gcs` (FR-071, SC-006).
- Health `storage:<loc>:responseTime`, `/server/info` `uploads` (001): không đổi; kiểm với hai location.

## 4. Biến môi trường sang nhóm A (`supported-variables.ts`, khối `// Feature 007`)

```
FILES_MIME_TYPE_ALLOW_LIST, FILES_MAX_UPLOAD_SIZE, FILES_DELETE_ORIGINAL_ON_MOVE, FILES_MAX_UPLOAD_CONCURRENCY,
FILE_METADATA_ALLOW_LIST,
ASSETS_CACHE_TTL, ASSETS_CACHE_REVALIDATE, ASSETS_TRANSFORM_MAX_CONCURRENT, ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION,
ASSETS_TRANSFORM_MAX_OPERATIONS, ASSETS_TRANSFORM_TIMEOUT, ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL,
ASSETS_CONTENT_SECURITY_POLICY.*,
TUS_ENABLED, TUS_CHUNK_SIZE, TUS_UPLOAD_EXPIRATION, TUS_CLEANUP_SCHEDULE,
IMPORT_IP_DENY_LIST, SYNCHRONIZATION_STORE, SYNCHRONIZATION_NAMESPACE,
STORAGE_.+_FORCE_PATH_STYLE, STORAGE_.+_CONNECTION_TIMEOUT, STORAGE_.+_SOCKET_TIMEOUT, STORAGE_.+_MAX_SOCKETS,
STORAGE_.+_KEEP_ALIVE
```

Giữ nhóm C: `IMPORT_TIMEOUT`, `IMPORT_MAX_CONCURRENCY` (010), `STORAGE_.+_{CONTAINER_NAME,ACCOUNT_NAME,ACCOUNT_KEY,
KEY_FILENAME,...}` của driver ngoài phạm vi. `warnSingleInstance` không đổi.

## 5. Import từ URL: kiểm IP

`request/index.ts` (`getAxios`: axios với `httpAgent`, `httpsAgent` bọc `agentWithIpValidation`),
`agent-with-ip-validation.ts` (IP literal kiểm trước khi nối; hostname kiểm ở `lookup` của socket, hủy socket khi bị
chặn), `is-denied-ip.ts` (`IMPORT_IP_DENY_LIST`: `0.0.0.0` = mọi interface nội bộ; dải `a-b`, CIDR, địa chỉ; cấu hình
lỗi → chặn). Port nguyên kèm 27 test gốc.
