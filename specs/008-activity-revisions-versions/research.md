# Research: Lịch sử thay đổi, content versioning, comment (008)

Mỗi mục gồm Quyết định, Lý do, Đã cân nhắc. Mốc so sánh là Directus 11.17.4 (api 35.2.0). Điều gì chưa đo thì ghi
`[Suy luận]` và có task kiểm sớm. Quyết định lớn đã chốt ở Clarifications của spec: revert API chờ 010; không gửi email
khi được nhắc (D-33); app mới chạy job retention. Đường dẫn Directus tính từ `directus/api/src` trừ khi ghi khác.

## R1. Thư viện: không thêm gì

- **Quyết định**: Dùng bản đã có: object-hash 3.0.0 (`hash`, `mainHash`), joi 18.2.6 (schema tạo và sửa version),
  lodash-es, cron 4.3.4, `@backoffice/utils` (`deepMapWithSchema`, `toBoolean`), `@backoffice/memory` (`useLock`).
  Port ba file type `versions.ts`, `comments.ts`, `notifications.ts` từ `directus/packages/types/src` vào
  `libs/types` (chưa có).
- **Lý do**: Mọi phụ thuộc của bốn service và job retention đã có từ 002 đến 007. object-hash cùng bản là điều kiện của
  tiêu chí "promote được ở bên kia" (`mainHash` so bằng tuyệt đối).
- **Đã cân nhắc**: Joi 18.0.1 đúng bản Directus: không cần, 003 đã chọn 18.2.6 (vá bảo mật) và message của
  `string().required()`, `allow(null)`, `object().unknown(false)` không đổi giữa hai bản `[Suy luận]`; ca lỗi `400` của
  `versions.test.ts` so message để xác nhận.

## R2. `hash` và `mainHash` trùng giữa hai app

- **Quyết định**: `createOne`, `verifyHash`, `compare` đọc item chính bằng `ItemsService.readOne(item)` (không
  `fields`, theo quyền người gọi) rồi `objectHash(mainItem)`, đúng như Directus. Task đầu gói versions đo trên 3 vendor
  với collection `seed-all-field-types` (006): tạo version ở Directus, gọi `compare` ở app mới và ngược lại, kỳ vọng
  `outdated = false`.
- **Lý do**: Hai app dùng cùng engine đọc (004, 005), cùng `PayloadService` ép kiểu ngày giờ, JSON, số theo vendor, nên
  object đưa vào hash giống nhau. Điểm nghi ngờ duy nhất là kiểu trả về theo driver (ví dụ `bigint`, `decimal` dạng
  chuỗi, `Date` vs chuỗi ISO) nếu `processValues` của app mới và Directus khác ở một dialect; đo sớm thay vì suy luận.
- **Đã cân nhắc**: Tính hash trên JSON chuẩn hóa riêng: bị loại, khác Directus và phá tiêu chí chấp nhận.

## R3. `handleVersion`, `save`, `promote`: port nguyên trên `ItemsService` đã có

- **Quyết định**: Thay bản thế chỗ `utils/versioning/handle-version.ts` bằng bản port; `ItemsService` của 005 đã có
  `skipTracking`, `onItemCreate`, `overwriteDefaults`, `emitEvents`, `autoPurgeCache` và gọi `handleVersion` ở
  `readOne`, `readSingleton`; `sanitizeQuery`, `validateQuery` đã nhận `version`, `versionRaw`. `save` dùng
  `PayloadService.prepareDelta`, `ActivityService`, `RevisionsService` không accountability, `helpers.date.writeTimestamp`,
  `shouldClearCache`; `promote` dùng `splitRecursive`, `validateAccess`, `emitter.emitFilter/emitAction`.
- **Lý do**: Toàn bộ điểm móc đã được port ở 005 đúng vì ItemsService của Directus phụ thuộc chúng; chỉ thiếu hàm gọi.
- **Đã cân nhắc**: Đọc version bằng cách gộp delta thô ở mọi trường hợp (bỏ transaction rollback): bị loại, khác kết quả
  với field quan hệ và `mapNonExistentFields` (blackbox "version response" đọc `author.name`, `tags.*_id.tag` qua
  delta). Rủi ro pool SQLite (R-12) và khóa MySQL giữ như Directus; blackbox "version deadlocking" là ca kiểm.

## R4. Bốn controller Nest mỏng

- **Quyết định**: `activity.controller.ts` (`GET /`, `SEARCH /`, `GET /:pk`; `readSingleton` khi `req.singleton`,
  `readMany` khi body `keys`), `revisions.controller.ts` (`GET /`, `SEARCH /` qua `validateBatch('read')`, `GET /:pk`),
  `versions.controller.ts` (`POST /`, `GET /`, `SEARCH /`, `GET /:pk`, `PATCH /`, `PATCH /:pk`, `DELETE /`,
  `DELETE /:pk`, `GET /:pk/compare`, `POST /:pk/save`, `POST /:pk/promote`), `comments.controller.ts` (CRUD như
  `folders`). `useCollection` cho bốn collection trong `app.module.ts`; mỗi controller lấy service qua
  `ServiceFactory`; `respond()` thay `next()`; `@HttpCode(200)` cho `POST`; lỗi `Forbidden` sau khi ghi trả `204` như
  mẫu `folders.controller.ts`. Thứ tự đăng ký: thêm theo bảng chữ cái; không route nào trùng tiền tố.
- **Lý do**: Mẫu 007 (research R4) đã chạy cho 4 controller tương tự; `GET /:pk/compare` đứng trước `GET /:pk` trong
  Directus không cần thiết ở Nest vì `/:pk/compare` có hai segment.
- **Đã cân nhắc**: Một controller "history" gộp bốn route: bị loại, `useCollection` theo router và kiểm test theo file
  gốc dễ hơn khi tách.

## R5. Job retention: port nguyên, một khóa Redis, dừng khi SIGTERM

- **Quyết định**: Port `schedules/retention.ts` (hằng `ACTIVITY_RETENTION_TIMEFRAME` v.v. tính lúc import từ
  `useEnv()`, như Directus), đăng ký trong `app.ts` sau `tusSchedule` trước `metricsSchedule` (thứ tự của `createApp`
  Directus: `retention` sau `tus`); `onServerShutdown(() => job.stop())` như `schedules/tus.ts`. Khóa qua `useLock()`
  (`lock.get/set/delete` key `schedule--data-retention`), hạn 10 phút; lô `RETENTION_BATCH`; MySQL, MariaDB lấy id
  trước (`helpers.schema.isOneOfClients(['mysql'])` bao cả MariaDB như Directus). Job không gọi `getSchema`.
  Môi trường đối chiếu: cặp `retention` có namespace bus và lock riêng; chỉ `retention.test.ts` bật và tắt cặp này
  (qua `compose()` của `docker.ts`), vì cặp dùng chung DB và sẽ xóa lịch sử của mọi suite khác nếu chạy thường trực.
- **Lý do**: Cùng tên job `retention` thì clock `directus-sync` chung với Directus khi `SYNCHRONIZATION_STORE=redis`;
  cùng khóa thì khi mỗi instance tự chạy (store `memory`) vẫn chỉ một tiến trình xóa, kể cả Directus.
- **Đã cân nhắc**: Không chạy job ở app mới (chọn B ở Clarifications): bị loại bởi owner. Chạy bằng `cron` riêng không
  qua `scheduleSynchronizedJob`: bị loại, mất clock chung.

## R6. Bộ đối chiếu `tests/parity/src/history/`

- **Quyết định**: `history-effects.ts` mở rộng `auth/db-effects.ts`: bắt dòng mới của `directus_activity`,
  `directus_revisions`, `directus_versions`, `directus_comments`, `directus_notifications` kể từ `maxId` trước request
  (uuid: theo tập id trước), dạng so sánh bỏ `id`, `timestamp`, `date_created`, `date_updated`, `activity` → chỉ số
  activity, `parent` → chỉ số revision, `version` → khóa `key`; `ip` giữ (cả hai app qua proxy nhận cùng
  `X-Forwarded-For`), `user_agent`, `origin` giữ. Các file test: `activity` (US1 đọc, quyền, `meta`, singleton,
  `keys`), `revisions` (query của `use-revisions.ts`, `fields` lồng), `versions` (CRUD, lỗi, `save`, `compare`,
  `promote`, `fields`, hash R2, delta `_user`/`_date`, R-20, R-21 đo), `version-read` (`?version=`, `versionRaw`,
  singleton, `fields` lồng, SQLite), `comments` (CRUD, quyền tối thiểu, mention 4 ca, D-33 log), `cross-use` (FR-062
  hai chiều), `retention` (cặp profile), `e2e-app` (đúng chuỗi request của sidebar Revisions, Comments, menu Version).
- **Lý do**: Tiền lệ 003 (`db-effects`) đã so activity và revision theo chỉ số; mở rộng rẻ hơn viết capture mới.
- **Đã cân nhắc**: So bằng `db-snapshot` toàn bảng: bị loại, chậm và không đọc được dòng nào lệch.

## R7. Blackbox `version.test.ts`

- **Quyết định**: Copy `version.test.ts`, `version.seed.ts` vào `tests/parity/src/items/blackbox/tests/db/routes/items/`;
  `CreateVersion`, `SaveVersion` đã có trong `common/functions.ts` của shim; seed tạo `articles`, `users`, `links`,
  `tags`, `sec_num`, `sec_text` với `versioning: true` qua app setup (`PARITY_BLACKBOX_SETUP_APP`), chạy hai lượt
  (Directus, app mới) như 005 đến 007.
- **Lý do**: Là bộ test Directus duy nhất của feature; "version deadlocking" là ca duy nhất kiểm khóa dòng quan hệ
  chung.
- **Đã cân nhắc**: Không có.

## R8. Playwright và benchmark

- **Quyết định**: `history.spec.ts`: trên collection có `versioning` và `accountability = all` (tạo qua app Directus
  như `data-model.spec.ts`): sửa item → sidebar Revisions có dòng, mở so sánh, Revert, Save; Comments: viết comment có
  mention (chọn user từ gợi ý), sửa, xóa, bộ đếm; menu Version: tạo, sửa field, lưu bản nháp, xem bản nháp, so sánh,
  promote, đổi tên, xóa; module Activity: danh sách và chi tiết có IP, user agent. Benchmark `history.ts`:
  `revisions-sidebar`, `activity-list` (admin, user thường có quyền tối thiểu), `version-save`,
  `item-version-read`; `seed-history.ts` tạo collection versioning, 2.000 item, mỗi item 20 revision, 1 version có
  delta; job `benchmark-history` cùng mẫu `benchmark-files`.
- **Lý do**: Spec FR-063, SC-006; tiền lệ 004 đến 007.
- **Đã cân nhắc**: Benchmark ghi comment: bị loại, chi phí giống `POST /items` đã đo ở 005.

## R9. Biến môi trường sang nhóm A

- **Quyết định**: `RETENTION_ENABLED`, `RETENTION_BATCH`, `RETENTION_SCHEDULE`, `ACTIVITY_RETENTION`,
  `REVISIONS_RETENTION`, `FLOW_LOGS_RETENTION` vào khối "Feature 008" của `supported-variables.ts`. `EMAIL_*` giữ nhóm
  C (010).
- **Lý do**: FR-052; mặc định đã có trong `libs/env` (port `defaults.ts`).
- **Đã cân nhắc**: Không có.

## R10. Test đơn vị và coverage

- **Quyết định**: Port `versions.test.ts` (3 ca `save` theo `accountability`, mock knex như Directus),
  `split-recursive.test.ts`, `retention.test.ts` (4 ca schedule). Viết mới: bốn controller (supertest qua app Nest như
  `folders.controller.test.ts`), `comments.service.test.ts` (mention: không quyền → log, uuid không hợp lệ, không đăng
  nhập `403`), `notifications.service.test.ts` (user có `email_notifications` → log cảnh báo, không gọi mail),
  `revisions.service.test.ts` (`revert` lỗi `403`, `400`, gọi `updateOne`), `handle-version.test.ts` (raw, rollback,
  `createdIDs`), `get-service.test.ts`, `supported-variables.test.ts`.
- **Lý do**: Nguyên tắc VI (mỗi thay đổi có test), X (80%).
- **Đã cân nhắc**: Không có.

## R11. Dọn D-09.6, D-31 và thêm D-33

- **Quyết định**: Khi đóng feature: xóa entry `D-09.6`, thu hẹp `D-31` (bỏ `directus_comments`,
  `directus_notifications` khỏi `COLLECTIONS_WITHOUT_SERVICE_YET`), thêm `D-33` kind `doc` (như D-23: "No mention
  email: a warning log line") trong `tests/parity/accepted-differences.ts`; sửa dòng tương ứng ở spec 001, 004.
- **Lý do**: Guard `accepted-differences.test.ts` so `removeAt` với spec; tiền lệ 007 làm ở commit đóng feature.
- **Đã cân nhắc**: Không có.
