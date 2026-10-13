---

description: "Danh sách task cho feature 008: Lịch sử thay đổi, content versioning, comment (/activity, /revisions, /versions, /comments)"
---

# Tasks: Lịch sử thay đổi, content versioning, comment (`/activity`, `/revisions`, `/versions`, `/comments`)

**Input**: Tài liệu thiết kế trong `/specs/008-activity-revisions-versions/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md`, `data-model.md`, `contracts/`, `quickstart.md`,
`checklists/history-review.md` (38 mục đã giải vào spec ngày 2026-10-13).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test. Test gốc của Directus đi kèm file port thì port theo, chạy đỏ trước rồi port code
  (research R10).
- Mọi endpoint thêm có test đối chiếu chạy với cả Directus 11.17.4 thật lẫn app mới, so status, body, header và dòng
  của 5 bảng qua `historyEffects` (research R6); bộ blackbox port chạy hai lượt theo app (R7).
- Điểm spec ghi "đo ở" (R-20, R-21, hash R2) đo trên Directus thật trong task test tương ứng; lệch thì dừng, ghi bằng
  chứng vào "Ghi chú khi làm" và hỏi tech lead (Assumptions của spec).

**Organization**: Task nhóm theo user story của spec. Phase 1 và 2 là nền chung: type, biến env, môi trường đối chiếu,
capture, service và util port nguyên, provider, job retention. Thứ tự story: US1 (activity, revisions) → US2
(versions) → US3 (revert qua app Directus) → US4 (comments) → US5 (retention) → US6 (blackbox, E2E, CI) → Polish
(benchmark, manifest, sổ khác biệt, đóng feature). US1 trước vì mọi story sau đều so dòng activity, revision.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task. Phase 1, 2 và Polish không có nhãn này.
- File port từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn nguồn>`. Mỗi task port ghi các cặp
  `{ "source", "dest" }` (source tính từ `directus/`) vào `tools/port-manifest/008-T###.json`, theo đúng ID task.
  Chạy `node tools/check-port-headers.mjs` sau khi ghi. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Port nguyên vẹn: giữ tên biến, thứ tự câu lệnh, message của Directus. Chỗ khác nguồn ghi `// Backoffice: <lý do>`
  (danh sách cho phép ở plan, Constitution Check I). Giới hạn tạm ghi `// ponytail: <giới hạn>, <khi nào nâng>`.
- **Không sửa service của feature trước** ngoài: thêm `revert` vào `revisions.service.ts`, thay bản thế chỗ
  `utils/versioning/handle-version.ts`, thêm factory vào `providers.ts`, rút `COLLECTIONS_WITHOUT_SERVICE_YET` và
  thêm `case` trong `utils/get-service.ts`, thêm mẫu vào `middleware/router-options.ts`, thêm `retentionSchedule`
  vào `app.ts`.
- **Luôn tái tạo hành vi Directus**, kể cả hành vi không an toàn (R-20, R-21). Phát hiện hành vi không an toàn mới
  thì thêm dòng R-xx vào spec kèm bằng chứng (ca test, request, kết quả đo trên Directus thật, ngày đo) và một ca thể
  hiện; không tự lệch.
- Không gửi email: `NotificationsService.sendEmail` ghi log cảnh báo thay bước gửi (D-33, contracts/history-api.md
  §3.2).
- Không đọc `useEnv()` ở cấp module trừ chỗ Directus làm thế (`schedules/retention.ts` tính timeframe lúc import, giữ
  nguyên).
- Tên biến, comment, commit viết tiếng Anh. Tài liệu viết tiếng Việt.
- Test viết trước và phải fail trước khi làm phần tương ứng.
- Quy trình merge thẳng `main`: mỗi nhóm task commit và push xong thì CI phải xanh; `pnpm run ci:local` khi Actions bị
  chặn.

## Quy ước đường dẫn

- API: `apps/api/src/**`. Libs: `libs/types/src/**`.
- Test đối chiếu: `tests/parity/src/**` (mới: `tests/parity/src/history/**`; blackbox port thêm vào
  `tests/parity/src/items/blackbox/**`). Danh sách khác biệt: `tests/parity/accepted-differences.ts`. Profile, env:
  `tests/parity/docker-compose.yml`, `tests/parity/env/**`.
- E2E app Directus: `tests/directus-app-e2e/**`. Reverse proxy: `tests/parity/proxy/**`.
- Benchmark: `tests/benchmark/**`. Công cụ: `tools/**`. CI: `.github/workflows/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/packages/*`, `directus/tests/blackbox/**`,
  `directus/app/src/**`.

## Tóm tắt

- Tổng số task: **46**
- Số task đánh dấu [P]: **35**
- Một lượt implement, checkpoint sau mỗi phase.
- MVP gợi ý: **Phase 1 đến 4** (US1, US2): lịch sử app mới ghi hiển thị trong Directus, version tạo bên này promote
  bên kia. Feature chưa đóng được khi chưa xong US3 đến US6 và Polish.

---

## Phase 1: Setup (type, biến env, môi trường đối chiếu, capture)

**Purpose**: Type thiếu, 6 biến retention sang nhóm A, proxy và profile `retention`, capture 5 bảng, seed blackbox
(research R1, R6, R7, R9, contracts/parity.md §1).

- [X] T001 [P] `libs/types/src/`: port `versions.ts` (`ContentVersion`), `comments.ts` (`Comment`), `notifications.ts`
  (`Notification`) từ `directus/packages/types/src/`; export trong `libs/types/src/index.ts`;
  `libs/types/src/index.test.ts` thêm khẳng định export. Ghi manifest `tools/port-manifest/008-T001.json`.
- [X] T002 [P] `apps/api/src/config/supported-variables.ts`: ghi chú "Feature 008" (sáu biến retention không có trong
  `directus-variables.ts` nên không bao giờ bị cảnh báo, không vào nhóm A); `warn-unsupported-variables.test.ts` thêm
  ca sáu biến không bị báo và `EMAIL_*` vẫn bị báo (FR-052, research R9).
- [X] T003 [P] `tests/parity/proxy/backoffice-routes.txt` thêm `activity`, `revisions`, `versions`, `comments`;
  `tests/parity/src/proxy-conf.test.ts` và `tests/directus-app-e2e/src/routing.spec.ts` thêm ca bốn route tới app mới
  và `/utils`, `/notifications` vẫn tới Directus (contracts/parity.md §1, §5).
- [X] T004 [P] Cặp profile `retention`: `tests/parity/env/profile-retention.env` theo contracts/parity.md §1
  (`RETENTION_ENABLED=true`, `RETENTION_SCHEDULE=*/10 * * * * *`, `RETENTION_BATCH=3`, `ACTIVITY_RETENTION=2s`,
  `REVISIONS_RETENTION=1s`, `FLOW_LOGS_RETENTION=2s`, `SYNCHRONIZATION_STORE=redis`,
  `REDIS_BUS_NAMESPACE=parity-retention:bus`, `REDIS_LOCK_NAMESPACE=parity-retention:lock`,
  `CACHE_NAMESPACE=parity-retention`); `tests/parity/docker-compose.yml` thêm cặp theo mẫu `assets-stress` với chú
  thích "chỉ `retention.test.ts` bật, dùng chung DB"; `tests/parity/src/profiles.ts` ghi profile này là
  `manual: true` (không vào danh sách `env-up` chung); `vendors.test.ts` thêm ca profile có mặt và không nằm trong
  danh sách chung; `tests/parity/src/docker.ts` thêm `profileUp(name)`, `profileStop(name)` bọc `compose()` (+ test).
  Kiểm tay: `env-up --vendor=postgres --profiles=retention`, log hai app đăng ký job `retention` và xóa dòng mỗi
  10 s, rồi `env-down`.
- [X] T005 [P] `tests/parity/src/history/history-effects.ts` + `history-effects.test.ts`: `historyEffects(fn)` bắt dòng
  mới của `directus_activity`, `directus_revisions`, `directus_versions`, `directus_comments`,
  `directus_notifications` (id tự tăng: từ `maxId`; uuid: hiệu tập id) kể từ trước `fn`; `comparable()` theo FR-060
  (bỏ `id`, `timestamp`, `date_*`; `activity`, `parent` → chỉ số; `version` → `key`; `_date` trong `delta` → marker;
  giữ `ip`, `user_agent`, `origin`, `hash`); mở rộng từ `tests/parity/src/auth/db-effects.ts` (research R6).
- [X] T006 [P] Blackbox: copy nguyên `directus/tests/blackbox/tests/db/routes/items/version.seed.ts` vào
  `tests/parity/src/items/blackbox/tests/db/routes/items/`; `00-seed.test.ts` và `sequencer.ts` thêm seed `version`
  (seed qua `PARITY_BLACKBOX_SETUP_APP`, collection có `versioning: true`); `blackbox-shim.test.ts` thêm ca
  `CreateVersion`, `SaveVersion` gọi đúng URL. Ghi manifest (research R7, contracts/parity.md §3).

**Checkpoint**: `pnpm nx run-many -t test lint typecheck` xanh; `env-up` với profile `retention` lên; proxy đưa bốn
route về app mới (hiện `404` vì chưa có controller).

---

## Phase 2: Foundational (util, service, job port nguyên; provider; `getService`; `OPTIONS`)

**Purpose**: Toàn bộ logic Directus có trước controller: `splitRecursive`, `handleVersion`, `VersionsService`,
`CommentsService`, `NotificationsService`, `RevisionsService.revert`, job retention (research R3, R5, R10).

- [ ] T007 [P] Port `utils/versioning/split-recursive.ts` + `split-recursive.test.ts` (10 ca) từ
  `directus/api/src/utils/versioning/` vào `apps/api/src/utils/versioning/`. Ghi manifest.
- [ ] T008 Thay bản thế chỗ `apps/api/src/utils/versioning/handle-version.ts` bằng bản port
  `directus/api/src/utils/versioning/handle-version.ts` (import `VersionsService`, `ItemsService` động như gốc,
  `transaction`, `deepMapWithSchema` của `@backoffice/utils`); `handle-version.test.ts` mới: `versionRaw` gộp delta,
  `readByQuery` rỗng → `403`, nhánh transaction gọi `updateOne` với `skipTracking`, `emitEvents: false`,
  `overwriteDefaults`, rồi `rollback`, `createdIDs` làm `null` khóa m2o, o2m, khóa chính (contracts/versions.md §6).
  Sau T007, T009. Ghi manifest.
- [ ] T009 [P] Port `services/versions.ts` + `versions.test.ts` (3 ca `save` theo `meta.accountability`) từ
  `directus/api/src/services/` vào `apps/api/src/services/versions.service.ts`, `versions.service.test.ts`; import
  `CollectionsService` động như gốc; `objectHash` (object-hash 3.0.0), Joi, `deepMapWithSchema`, `getHelpers`,
  `getCache`, `shouldClearCache`, `emitter`, `validateAccess` của app; thêm ca unit mới: `validateCreateData` mọi
  nhánh lỗi, `createMany` trùng key, `updateMany` chỉ `key`/`name`, `mapDelta` với `user-updated`/`date-created`,
  `promote` (hash lệch, không delta, `fields`). Ghi manifest (contracts/versions.md).
- [ ] T010 [P] Port `services/comments.ts` vào `apps/api/src/services/comments.service.ts`; `comments.service.test.ts`
  mới (mock knex, `UsersService`, `NotificationsService`, `validateAccess`): thứ tự lỗi `403`/`400` của
  contracts/history-api.md §3.1, mention có quyền → `createOne` của notifications với `subject`, `message` đúng mẫu,
  không quyền → `logger.warn` đúng câu và không tạo, uuid không tồn tại → lỗi ném ra sau khi comment đã tạo,
  `uniq` mention, `updateOne`/`deleteOne` đòi user. Ghi manifest.
- [ ] T011 [P] Port `services/notifications.ts` vào `apps/api/src/services/notifications.service.ts`: giữ `createOne`,
  `sendEmail` tới bước `user['email'] && email_notifications === true`, thay khối `MailService` bằng
  `logger.warn('Backoffice: mail sending is out of scope; notification <id> for <email> not sent')` (`// Backoffice:
  D-33`), không import `md`, `MailService`; `notifications.service.test.ts`: user bật email → một dòng warn, không
  gọi mail; user tắt → không log; `recipient` rỗng → không đọc user. Ghi manifest (FR-042).
- [ ] T012 [P] `apps/api/src/services/revisions.service.ts`: thêm `revert(pk)` port từ `services/revisions.ts`
  (đọc revision theo quyền, `Forbidden` khi không có, `InvalidPayload` "Revision doesn't contain data to revert to",
  `updateOne` của service theo `getService(collection)`); `revisions.service.test.ts` mới: ba nhánh và mặc định
  `autoPurgeCache: false`, `bypassLimits: true`. Ghi manifest (FR-020).
- [ ] T013 `apps/api/src/utils/get-service.ts`: `case 'directus_versions'` → `VersionsService`, `'directus_comments'`
  → `CommentsService`, `'directus_notifications'` → `NotificationsService`; rút ba tên khỏi
  `COLLECTIONS_WITHOUT_SERVICE_YET` (chỉ `directus_comments`, `directus_notifications` có trong danh sách);
  `get-service.test.ts` sửa; `apps/api/src/providers.ts` thêm factory `VersionsService`, `CommentsService`,
  `NotificationsService`, `ActivityService`, `RevisionsService`; `apps/api/src/services/index.ts` export ba service
  mới. Sau T009 đến T012 (FR-003, contracts/history-api.md §4).
- [ ] T014 [P] Port `schedules/retention.ts` + `retention.test.ts` (4 ca) từ `directus/api/src/schedules/` vào
  `apps/api/src/schedules/`; `useLock()` của app cho `lock.get/set/delete`; `onServerShutdown(() => job.stop())`
  (`// Backoffice:` như `schedules/tus.ts`); thêm ca unit: `handleRetentionJob` bỏ qua khi khóa còn trong 10 phút,
  MySQL hai bước, lỗi xóa → `logger.error` và `break` nhưng task sau vẫn chạy và khóa bị xóa, không gọi `getSchema`
  (FR-053); `apps/api/src/app.ts` gọi `retentionSchedule()` sau `tusSchedule()`; `app.test.ts` thêm ca thứ tự. Ghi
  manifest (FR-050, FR-051, research R5).
- [ ] T015 [P] `apps/api/src/middleware/router-options.ts` + test: thêm mẫu `/activity`, `/revisions`, `/versions`,
  `/comments` (và `/:pk`, `/:pk/compare|save|promote`) cho `OPTIONS` như các route item (FR-001).

**Checkpoint**: `pnpm nx run api:test` xanh (test gốc port: versions 3, split-recursive 10, retention 4; test mới
T008, T010 đến T015); coverage `apps/api` không giảm dưới 80%.

---

## Phase 3: User Story 1 - Lịch sử do app mới ghi hiển thị đúng trong Directus (Priority: P1) 🎯 MVP

**Goal**: `/activity`, `/revisions` đọc giống Directus; dòng app mới ghi (mọi đường ghi đã có) trùng từng cột với
Directus; app Directus hiển thị được.

**Independent Test**: `tests/parity/src/history/activity.test.ts`, `revisions.test.ts` xanh trên Postgres (hai lượt
`full`), MySQL, SQLite (`reduced`); kiểm tay quickstart §2.

### Tests for User Story 1

- [ ] T016 [P] [US1] `tests/parity/src/history/activity.test.ts` (`reduced`, `full`): `GET /activity`, `SEARCH` (`keys`,
  `query`), `GET /:pk` (có, không có → `403`), `fields` lồng `user.*`, `revisions.*`, `filter` lồng, `sort`, `limit`,
  `page`, `aggregate`, `meta`; admin, user tối thiểu app access (chỉ dòng của mình), public (`403`); `OPTIONS`,
  `HEAD`; cache (`Cache-Control: no-store` và không); dòng do mỗi app ghi khi create, update, delete item user, item
  `directus_files`, `directus_users` (gồm `accountability = activity`, `null`) so qua `historyEffects` với cùng
  `User-Agent`, `Origin`, `ip` tuyệt đối (FR-010, FR-060; US1.1, 1.2, 1.4, 1.5, 1.6).
- [ ] T017 [P] [US1] `tests/parity/src/history/revisions.test.ts` (`reduced`, `full`): đúng query của
  `directus/app/src/composables/use-revisions.ts` (count với `aggregate`, trang với `fields` activity lồng, `sort=-id`),
  `GET /:pk`, `SEARCH`, quyền (user không có read `directus_revisions` → `403`), revision của ghi lồng (`parent`),
  revision `data` là toàn bộ field không quan hệ sau khi sửa một field (FR-010, FR-013, US1.4).
- [ ] T018 [P] [US1] `apps/api/src/controllers/activity.controller.test.ts` (supertest qua app Nest, mock service): ba
  handler, `readSingleton`/`readMany`/`readByQuery` theo `req.singleton` và `body.keys`, `meta`, `SEARCH` qua
  `validateBatch('read')`.
- [ ] T019 [P] [US1] `apps/api/src/controllers/revisions.controller.test.ts`: `GET /`, `SEARCH /` qua
  `validateBatch('read')` rồi `readByQuery`, `GET /:pk`, không có `readMany`.

### Implementation for User Story 1

- [ ] T020 [P] [US1] `apps/api/src/controllers/activity.controller.ts` port từ `directus/api/src/controllers/activity.ts`
  theo mẫu `folders.controller.ts` (research R4; contracts/history-api.md §1). Ghi manifest.
- [ ] T021 [P] [US1] `apps/api/src/controllers/revisions.controller.ts` port từ `controllers/revisions.ts`
  (contracts/history-api.md §2). Ghi manifest.
- [ ] T022 [US1] `apps/api/src/app.module.ts`: đăng ký hai controller (thứ tự bảng chữ cái) và
  `useCollection('directus_activity')`, `useCollection('directus_revisions')`; `app.test.ts`,
  `app-pipeline.test.ts` thêm ca. Chạy T016, T017 trên Postgres, MySQL, SQLite; ghi số ca vào "Ghi chú khi làm".

**Checkpoint**: US1 xanh; app Directus qua proxy (`env-up --profiles=app`) mở sidebar Revisions và module Activity
với dòng do app mới ghi (quickstart §2).

---

## Phase 4: User Story 2 - Content versioning dùng chéo giữa hai app (Priority: P1)

**Goal**: `/versions` đủ route; `?version=`; version tạo và save ở app này compare và promote được ở app kia với cùng
`mainHash`.

**Independent Test**: `versions.test.ts`, `version-read.test.ts` xanh; blackbox `version.test.ts` hai lượt (T036) có
thể chạy sớm để kiểm.

### Tests for User Story 2

- [ ] T023 [P] [US2] `tests/parity/src/history/versions.test.ts` (`reduced`, `full`): CRUD và mọi dòng lỗi của
  contracts/versions.md §2 (so `reason`); `GET /versions` danh sách trả delta thô có `_user`, `_date` còn `GET /:pk`
  đã map (FR-032); `save` (field đơn, o2m/m2m/m2a dạng `create/update/delete`, gộp, `_user`/`_date`, save lại cùng
  nội dung giữ `_date`), activity `version_save` và revision gắn `version` theo `accountability` (so qua
  `historyEffects`); `compare`; `promote` (có `fields`, `fields` lạ, hash cũ `422`, không delta `422`, không quyền
  `403`); **đo hash R2**: với `seed-all-field-types` của 006 trên 3 vendor, tạo version ở Directus, `compare` ở app
  mới và ngược lại, kỳ vọng `outdated = false` (lệch → dừng, ghi bằng chứng, hỏi tech lead); **đo R-20, R-21** theo
  bảng Rủi ro của spec, ghi bằng chứng và ngày vào spec; item chính bị xóa → `403`; tắt `versioning` sau khi tạo vẫn
  `save`, `promote` (Edge Cases); `DELETE` xóa revision gắn version (US2.6).
- [ ] T024 [P] [US2] `tests/parity/src/history/version-read.test.ts` (`reduced`, `full`): `?version=` có/không
  `versionRaw`, `fields` lồng theo blackbox "version response", `?version=main`, `version` trên danh sách bị bỏ qua,
  singleton, version không có `403`, user không có read `directus_versions` `403`, ca SQLite transaction rollback
  (FR-036).
- [ ] T025 [P] [US2] `apps/api/src/controllers/versions.controller.test.ts`: 11 handler của contracts/versions.md §1,
  `mainHash` không chuỗi `400`, `Forbidden` sau tạo → `204`, `compare` ghép `current` có khóa chính, `save` trả
  `assign(mainItem, delta)`.
- [ ] T026 [P] [US2] `tests/parity/src/items/bus.test.ts` thêm ca: `versions.create|update|delete`, `items.promote`
  và `<collection>.items.promote` qua cầu nối `websocket.event` với cùng payload ở hai app (FR-004, FR-038).

### Implementation for User Story 2

- [ ] T027 [US2] `apps/api/src/controllers/versions.controller.ts` port từ `controllers/versions.ts` (Nest, 11 route,
  `assign` của lodash-es cho `save`); `app.module.ts` đăng ký và `useCollection('directus_versions')`. Chạy T023 đến
  T026; ghi kết quả đo hash, R-20, R-21 vào spec và "Ghi chú khi làm". Ghi manifest.

**Checkpoint**: US2 xanh trên Postgres, MySQL, SQLite; kiểm tay quickstart §3 hai chiều.

---

## Phase 5: User Story 3 - Khôi phục item về một revision (Priority: P2)

**Goal**: `data` của revision app mới ghi đủ để app Directus revert (hiệu `data` hai revision liền kề) và `PATCH
/items` với `data` ở app kia sinh lịch sử giống Directus.

**Independent Test**: ca revert trong `cross-use.test.ts` và `e2e-app.test.ts` xanh.

- [ ] T028 [P] [US3] `tests/parity/src/history/cross-use.test.ts` phần revert (`reduced`): tạo item, sửa hai lần ở app
  A; ở app B tính payload như `comparison-modal.vue` (hiệu `data` revision đầu với revision trước, chọn một field)
  rồi `PATCH /items`; so item, activity `update`, revision mới ở hai chiều (FR-020, FR-021, US3.1).
- [ ] T029 [P] [US3] `tests/parity/src/history/e2e-app.test.ts` phần Revisions (`full`): đúng chuỗi request của
  `revisions-sidebar-detail.vue`, `use-revisions.ts`, `use-comparison.ts` chế độ revision (count, trang, đọc revision
  được chọn và revision trước, `PATCH`), so response ở hai app; revision không có `data` (delete, `version_save`) đọc
  giống nhau (US3.2, US3.3).

**Checkpoint**: US3 xanh; app Directus qua proxy Revert rồi Save trên dòng do app mới ghi (quickstart §2 bước 3).

---

## Phase 6: User Story 4 - Comment trên item (Priority: P2)

**Goal**: `/comments` CRUD, quyền tối thiểu, mention sinh `directus_notifications`, không email (D-33).

**Independent Test**: `comments.test.ts` xanh; quickstart §4.

### Tests for User Story 4

- [ ] T030 [P] [US4] `tests/parity/src/history/comments.test.ts` (`reduced`, `full`): CRUD, thứ tự lỗi
  contracts/history-api.md §3.1, không đăng nhập `403`, không đọc được item `403`, query của
  `comments-sidebar-detail.vue` (count, danh sách, `user_created.*`), user tối thiểu (thấy, sửa `comment`, xóa của
  mình; sửa field khác `403`; sửa comment người khác `403`), mention: có quyền (dòng notification so trừ `id`,
  `timestamp`), không quyền (không dòng, log warn ở cả hai app), uuid không tồn tại (`403` sau khi comment đã ghi, dòng
  còn), nhắc chính mình, hai mention trùng; D-33: user có `email_notifications` → dòng warn ở app mới, không lỗi;
  activity, revision của comment (FR-040 đến FR-044, US4.1 đến 4.3).
- [ ] T031 [P] [US4] `apps/api/src/controllers/comments.controller.test.ts`: 8 handler như `folders.controller.test.ts`,
  `Forbidden` sau tạo → `204`.

### Implementation for User Story 4

- [ ] T032 [US4] `apps/api/src/controllers/comments.controller.ts` port từ `controllers/comments.ts`; `app.module.ts`
  đăng ký và `useCollection('directus_comments')`. Chạy T030, T031. Ghi manifest.
- [ ] T033 [US4] `tests/parity/src/history/cross-use.test.ts` phần comment và notification (`reduced`): comment ghi ở A
  đọc, sửa, xóa ở B; notification do A ghi đọc qua `/notifications` của Directus; cả hai chiều (FR-062).

**Checkpoint**: US4 xanh; sidebar Comments của app Directus qua proxy hiển thị, sửa, xóa comment của app mới.

---

## Phase 7: User Story 5 - Dọn lịch sử theo cấu hình (Priority: P2)

**Goal**: Job `retention` của app mới dọn đúng như Directus, chỉ một tiến trình mỗi kỳ.

**Independent Test**: `retention.test.ts` xanh trên cặp `retention`; quickstart §5.

- [ ] T034 [US5] `tests/parity/src/history/retention.test.ts` (`full`, `sequential: true`, chạy cuối suite `history`):
  `beforeAll` `profileUp('retention')` và chờ `/server/health` hai app; `afterAll` `profileStop('retention')` kể cả
  khi `beforeAll` lỗi (tiền lệ 006). Seed dòng activity (`update`, `run`), revision cũ/mới bằng `hostDb` (sửa
  `timestamp`), chờ một kỳ 10 s, so dòng còn lại trong ba cảnh: chỉ app mới chạy (dừng container Directus của cặp),
  chỉ Directus chạy (dừng container app mới), cả hai chạy 10 kỳ (100 s; Redis `MONITOR` trên namespace
  `parity-retention:lock` đếm đúng 10 lần đặt khóa `schedule--data-retention` thành công, số dòng xóa bằng số dòng
  quá hạn, SC-005); dòng của suite khác không bị chạm vì cặp chỉ sống trong file này; `ACTIVITY_RETENTION` nhỏ hơn
  `REVISIONS_RETENTION` không có task revision; nhánh lỗi xóa chỉ kiểm ở unit test T014 (không dựng được trên DB thật,
  ghi chú trong test) (US5.1 đến 5.3).
- [ ] T035 [P] [US5] `tests/parity/README.md` mục 008 (cặp `retention`, suite `history`, cách đo khóa) và
  `tests/parity/src/startup/` thêm ca khởi động: `RETENTION_SCHEDULE` không hợp lệ không đăng ký job, không cảnh báo
  khác Directus; 6 biến không còn trong cảnh báo "chưa hỗ trợ" (US5.2, US5.4).

**Checkpoint**: US5 xanh; log hai app trong cặp `retention` cho thấy một bên dọn mỗi phút.

---

## Phase 8: User Story 6 - Bộ test của Directus và E2E app Directus chạy qua trên app mới (Priority: P2)

**Goal**: Blackbox `version.test.ts` hai lượt, e2e-app đủ bốn màn, Playwright, CI.

**Independent Test**: CI `parity`, `parity-blackbox`, E2E xanh trên push.

- [ ] T036 [US6] Blackbox: copy nguyên `directus/tests/blackbox/tests/db/routes/items/version.test.ts` vào
  `tests/parity/src/items/blackbox/tests/db/routes/items/`; chạy `parity-blackbox --vendor=postgres` hai lượt
  (`PARITY_BLACKBOX_APPS=directus,backoffice`), rồi MySQL, SQLite; ca "version deadlocking" phải xong trong timeout của
  file; ca fail trên chính Directus ghi chú theo Assumptions. Ghi manifest (FR-061, SC-001).
- [ ] T037 [P] [US6] `tests/parity/src/history/e2e-app.test.ts` phần Comments, Version, Activity (`full`): chuỗi request
  của `comments-sidebar-detail.vue`, `comment-input.vue`, `use-versions.ts`, `version-menu.vue`, `comparison-modal.vue`
  chế độ version (`compare`, `promote` có `fields`), `modules/activity/routes/item.vue`; so response ở hai app.
- [ ] T038 [P] [US6] `tests/parity/src/history/cross-use.test.ts` hoàn thiện (`full`): activity, revision của mọi
  collection hệ thống đã có route ghi ở A đọc ở B; version tạo+save ở A, compare+promote ở B và ngược lại với mọi kiểu
  field; retention bật ở cặp `retention` dọn dòng do app kia ghi (FR-062).
- [ ] T039 [P] [US6] `tests/directus-app-e2e/src/history.spec.ts` (Playwright, Chrome cài sẵn như 007): bốn kịch bản
  của contracts/parity.md §5 (Revisions xem, so sánh, Revert, Save; Comments viết có mention, sửa, xóa, bộ đếm, chuông
  của user được nhắc; Version tạo, save, xem bản nháp, so sánh, promote chọn field, đổi tên, xóa; Activity danh sách,
  chi tiết IP, user agent); helper tạo collection versioning + accountability `all` theo `data-model.spec.ts`
  (FR-063, SC-006).
- [ ] T040 [US6] CI: `.github/workflows/ci.yml` (`parity` thêm suite `history`; KHÔNG thêm `retention` vào
  `--profiles`, `retention.test.ts` tự bật cặp; `env-down` cuối job đã hạ mọi profile;
  `parity-blackbox` thêm `version`; E2E thêm `history.spec.ts`), `parity-matrix.yml`, `nightly.yml` như `parity`;
  `tools/ci-local.sh` theo; chạy đủ `pnpm run ci:local` rồi push và theo dõi `gh run` tới xanh (contracts/parity.md
  §4).

**Checkpoint**: CI xanh trên push: `quality`, `parity` (Postgres `full`, MySQL, SQLite `reduced`), `parity-blackbox`,
E2E.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T041 [P] `tests/benchmark/src/seed-history.ts` (collection versioning + accountability `all`, 2.000 item, 20
  revision mỗi item qua `PATCH`, 1 version `draft` có delta) và `tests/benchmark/src/history.ts`: `revisions-sidebar`,
  `activity-list` (admin, user tối thiểu), `version-save` (pool id, 10 kết nối), `item-version-read` (50 kết nối),
  ngưỡng 10% như `files.ts`; `tests/benchmark/project.json` target; `compare.test.ts` thêm ca (FR-063, SC-006).
- [ ] T042 [P] `.github/workflows/benchmark.yml` job `benchmark-history` theo mẫu `benchmark-files`; chạy cục bộ 3 vòng
  trên Postgres, ghi p95, req/s và thời gian job vào "Ghi chú khi làm".
- [ ] T043 [P] Manifest và header: kiểm `tools/port-manifest/008-T*.json` đủ cho T001, T006 đến T012, T014, T020, T021,
  T027, T032, T036; `node tools/check-port-headers.mjs` xanh; mọi chỗ `// Backoffice:` thuộc danh sách của plan
  (Constitution Check I).
- [ ] T044 [P] Tài liệu: `specs/001-platform-foundation/spec.md` dòng D-09.6 (gỡ ở 008), `specs/004-permissions/spec.md`
  dòng D-31 (thu hẹp: bỏ `directus_comments`, `directus_notifications`); `CLAUDE.md` mục 008 (đã có từ plan, kiểm
  lại); `specs/008-activity-revisions-versions/quickstart.md` kiểm lại lệnh.
- [ ] T045 Coverage và chất lượng: `pnpm nx run-many -t test lint typecheck`, coverage `apps/api` ≥ 80% (ghi số),
  `pnpm audit --prod --audit-level=high` không advisory mới, `graphify update .`.
- [ ] T046 Đóng feature (sau T040 đến T045, tech lead duyệt gỡ D-09.6, thu hẹp D-31, D-33, R-20, R-21):
  `tests/parity/accepted-differences.ts` xóa entry `D-09.6`, sửa `D-31`, thêm `D-33` (kind `doc`, như `D-23`);
  `spec.md` Status `Done` + dòng "Duyệt khác biệt" với ngày; commit `chore(008): close feature
  008-activity-revisions-versions`, push `main`, CI (gồm `guard-differences`) xanh; cập nhật memory dự án.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 đến T006 song song (T003, T004 cùng chạm `tests/parity/src/vendors.test.ts`: làm nối
  tiếp hoặc một người).
- **Phase 2 (Foundational)**: sau Phase 1. T007, T009, T010, T011, T012, T014, T015 song song; T008 sau T007, T009;
  T013 sau T009 đến T012. CHẶN mọi story.
- **Phase 3 (US1)**: sau Phase 2. T016 đến T019 song song; T020, T021 song song; T022 cuối.
- **Phase 4 (US2)**: sau US1 (dùng `historyEffects` đã chạy thật, `app.module.ts` đã có mẫu). T023 đến T026 song
  song; T027 cuối.
- **Phase 5 (US3)**: sau US1. T028, T029 song song.
- **Phase 6 (US4)**: sau Phase 2 (độc lập với US2). T030, T031 song song; T032 rồi T033.
- **Phase 7 (US5)**: sau Phase 2 và T004. T034 rồi T035 (song song được với US2 đến US4).
- **Phase 8 (US6)**: T036 sau US2; T037 sau US2, US4; T038 sau US2, US4, US5; T039 sau US1 đến US4; T040 sau tất cả
  story.
- **Phase 9 (Polish)**: T041 đến T044 song song sau US6; T045 sau T041 đến T044; T046 cuối.

### Within Each User Story

- Test đối chiếu và test controller viết trước, đỏ, rồi controller.
- Test gốc port trước, đỏ, rồi code (T007, T009, T014).
- Mỗi story kết thúc bằng một lượt `parity` đủ ở Postgres và rút gọn ở MySQL, SQLite.
- Mục spec ghi "đo ở `versions.test.ts`" (R-20, R-21, hash R2) được đo trong T023 và ghi lại vào spec ngay trong task
  đó.

### Parallel Opportunities

- Phase 1: 6 task song song.
- Phase 2: T007, T009, T010, T011, T012, T014, T015 song song.
- US1: T016 đến T019 song song; T020, T021 song song.
- US2: T023 đến T026 song song.
- US3: T028, T029 song song; US3, US4, US5 song song với nhau sau Phase 2 (US3 sau US1).
- US6: T037, T038, T039 song song.
- Polish: T041 đến T044 song song.

---

## Parallel Example: User Story 2

```bash
# Test viết trước, song song:
Task: "versions.test.ts CRUD, lỗi, save, compare, promote, đo hash, R-20, R-21 (T023)"
Task: "version-read.test.ts ?version=, versionRaw, singleton (T024)"
Task: "versions.controller.test.ts 11 handler (T025)"
Task: "bus.test.ts versions.*, items.promote (T026)"
# Rồi:
Task: "versions.controller.ts + app.module.ts (T027)"
```

## Parallel Example: Phase 2

```bash
Task: "split-recursive.ts + test gốc (T007)"
Task: "versions.service.ts + test gốc (T009)"
Task: "comments.service.ts + test (T010)"
Task: "notifications.service.ts + test (T011)"
Task: "revisions.service.ts revert + test (T012)"
Task: "schedules/retention.ts + test gốc + app.ts (T014)"
Task: "router-options.ts mẫu mới (T015)"
# Rồi: handle-version.ts (T008), get-service.ts + providers.ts (T013)
```

## Implementation Strategy

### MVP (Phase 1 đến 4)

1. Phase 1, 2: nền (type, env, profile, capture, service và job port nguyên).
2. US1: hai controller đọc, so dòng ghi của mọi đường ghi hiện có; app Directus hiển thị lịch sử của app mới.
3. US2: `/versions` đủ route, `?version=`, đo hash và hai rủi ro; promote chéo hai chiều.
4. Dừng, kiểm quickstart §2, §3: đã đạt cả hai tiêu chí chấp nhận của spec.

### Phần còn lại (Phase 5 đến 9)

- US3, US4, US5 song song với nhau; US6 gom blackbox, e2e-app, Playwright, CI; Polish gồm benchmark, manifest, sổ
  khác biệt và đóng feature (tech lead duyệt).

## Notes

- `[P]` = file khác nhau, không phụ thuộc task chưa xong.
- Commit sau mỗi nhóm task xanh; push `main`; theo dõi CI.
- Ca blackbox hoặc đối chiếu fail trên chính Directus: ghi chú tên ca và bỏ qua theo Assumptions, không sửa Directus.
- `directus/` chỉ đọc; `tools/check-port-headers.mjs` chặn file port thiếu header.

## Ghi chú khi làm

(trống, điền khi thực hiện)
