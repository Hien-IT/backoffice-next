# Feature Specification: Lịch sử thay đổi, content versioning, comment (`/activity`, `/revisions`, `/versions`, `/comments`)

**Feature Branch**: `008-activity-revisions-versions`
**Created**: 2026-10-13
**Status**: Draft
**Input**: User description: "App mới ghi và cung cấp lịch sử thay đổi giống hệt Directus: /activity (ai làm gì, lúc nào, IP, user agent), /revisions (dữ liệu trước và sau, delta), khôi phục item về một revision, /versions (content versioning: tạo bản nháp, so sánh, promote về bản chính), /comments trên item. Áp dụng cấu hình ACTIVITY và REVISIONS giống Directus. Tham chiếu directus/api/src/services/activity.ts, revisions.ts, versions.ts, comments.ts. Tiêu chí chấp nhận: lịch sử do app mới ghi hiển thị đúng trong Directus, và version tạo ở bên này promote được ở bên kia."

**Tham chiếu Directus** (chỉ đọc, đường dẫn tính từ `directus/api/src` trừ khi ghi khác):

- Route: `controllers/activity.ts` (`GET /`, `SEARCH /`, `GET /:pk`), `controllers/revisions.ts` (`GET /`, `SEARCH /`,
  `GET /:pk`), `controllers/versions.ts` (CRUD, `GET /:pk/compare`, `POST /:pk/save`, `POST /:pk/promote`),
  `controllers/comments.ts` (CRUD); `middleware/respond.ts`,
  `validate-batch.ts`, `use-collection.ts`.
- Service: `services/activity.ts`, `services/revisions.ts` (mặc định `autoPurgeCache: false`,
  `bypassLimits: true`), `services/versions.ts` (`validateCreateData`, `getMainItem`, `verifyHash`, `getVersionSave`,
  `save`, `promote`, `mapDelta`), `services/comments.ts` (`createOne` với mention, `updateOne`, `deleteOne`),
  `services/notifications.ts` (`createOne`, `sendEmail`); `utils/versioning/handle-version.ts`, `split-recursive.ts`; `services/items.ts` (ghi `directus_activity`, `directus_revisions` theo
  `meta.accountability`, đã port ở 005).
- Dọn lịch sử: `schedules/retention.ts` (`handleRetentionJob`, khóa `schedule--data-retention`, job `retention`);
  biến mặc định `RETENTION_ENABLED=false`, `RETENTION_BATCH=500`, `RETENTION_SCHEDULE='0 0 * * *'`,
  `ACTIVITY_RETENTION='90d'`, `REVISIONS_RETENTION='90d'`, `FLOW_LOGS_RETENTION='90d'`
  (`directus/packages/env/src/constants/defaults.ts:156-161`).
- Hằng: `Action` (`create`, `update`, `delete`, `revert`, `version_save`, `comment`, `upload`, `login`, `logout`,
  `run`, `install`; `directus/packages/constants/src/activity.ts`); cột hệ thống
  (`directus/packages/system-data/src/fields/activity.yaml`, `revisions.yaml`, `versions.yaml`, `comments.yaml`);
  quyền tối thiểu app access cho `directus_activity` (read), `directus_comments` (read, create, update, delete)
  (`app-access-permissions.yaml`).
- App Directus (client của feature này): `composables/use-revisions.ts` (`GET /revisions` với `filter`, `aggregate`),
  `views/private/components/revisions-sidebar-detail.vue`, `comparison/use-comparison.ts` (`GET /versions/:id/compare`),
  `comparison-modal.vue` (`POST /versions/:id/promote`), `composables/use-versions.ts` (`GET /versions`,
  `POST /versions`, `POST /versions/:id/save`), `modules/content/components/version-menu.vue` (`PATCH`, `DELETE
  /versions/:id`), `comments-sidebar-detail.vue`, `comment-input.vue`, `comment-item.vue` (`/comments`),
  `modules/activity/routes/item.vue` (`GET /activity/:pk`), `modules/content/routes/item.vue` (`revert` đổ
  `revision.data` vào form rồi lưu qua `PATCH /items`, `?version=` khi mở bản nháp).
- Phiên bản thư viện của Directus 11.17.4: object-hash 3.0.0 (`hash` của version), joi 18.0.1 (app mới đang dùng
  18.2.6 từ 003), lodash-es, deep-diff (đã có từ 006).

**Đã có từ feature 001 đến 007** (trong `apps/api/src` và `libs/`): `ActivityService`, `RevisionsService` (chưa có
`revert`), ghi `directus_activity` (`action`, `user`, `collection`, `item`, `ip`, `user_agent`, `origin`,
`timestamp`) và `directus_revisions` (`activity`, `collection`, `item`, `data`, `delta`, `parent`) trong
`ItemsService` theo `meta.accountability` (`all`, `activity`, `null`) cho create, update, delete của item và collection
hệ thống đã có route; `login`, `logout` từ 003; `sanitizeQuery` đã đọc `version`, `versionRaw`;
`utils/versioning/handle-version.ts` là bản thế chỗ ném lỗi; `getService` chưa có `directus_versions` (`403`) và
`directus_comments` đi qua `ItemsService` chung (D-31); `MetaService`, `validateBatch`, `useCollection`, response
cache, `Emitter`, `scheduleSynchronizedJob`, `useLock`, `getMilliseconds`, `validateCron`; quyền tối thiểu app access;
`meta.versioning` của collection qua 006. Chưa có: route `/activity`, `/revisions`, `/versions`, `/comments`
(D-09.6), `VersionsService`, `CommentsService`,
`NotificationsService`, job `retention`, gửi email.

**Bộ test liên quan của Directus** (số khối `it`/`it.each`, `test` mỗi file): blackbox
`tests/blackbox/tests/db/routes/items/version.test.ts` (2: "version response", "version deadlocking", seed
`version.seed.ts`); unit `services/versions.test.ts` (3, `save` theo `meta.accountability`),
`utils/versioning/split-recursive.test.ts`, `schedules/retention.test.ts` (4); `merge-version-data.ts` không được
`api/src` dùng nên không port. Không có
test blackbox hay E2E cho `/activity`, `/revisions`, `/comments`.

## Clarifications

### Session 2026-10-13

- Q: Revert qua API (`POST /utils/revert/:revision`) làm ở 008 hay chờ 010? → A: Chờ 010 cùng cả `/utils`; 008 chỉ
  kiểm revert qua app Directus (`PATCH /items`, đã có từ 005). D-09.8 giữ nguyên (US3, FR-020, FR-021).
- Q: Comment có mention: gửi email như Directus ở 008 hay chỉ ghi thông báo? → A: Chỉ ghi dòng
  `directus_notifications`, không gửi email cho tới 010 (`MailService`, `EMAIL_*`); ghi khác biệt tạm D-33 (FR-042,
  bảng khác biệt).
- Q: App mới có chạy job dọn lịch sử (`retention`) hay để Directus dọn? → A: App mới chạy job giống Directus, cùng tên
  job và khóa `schedule--data-retention`; hai app cùng bật thì chỉ một bên dọn mỗi kỳ (US5, FR-050 đến FR-053).

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là người dùng app Directus (sidebar Revisions và Comments trên trang item, menu Version và
màn so sánh, module Activity), client gọi API (`@directus/sdk`, script), và đội vận hành cấu hình dọn lịch sử.

### User Story 1 - Lịch sử do app mới ghi hiển thị đúng trong Directus (Priority: P1)

Người dùng tạo, sửa, xóa item (hoặc file, user, collection hệ thống) qua app mới; sau đó mở item trong app Directus và
thấy ở sidebar Revisions ai làm gì, lúc nào, từ IP và trình duyệt nào, dữ liệu trước và sau, delta; module Activity
liệt kê cùng dòng. Ngược lại, lịch sử do Directus ghi đọc được qua `/activity`, `/revisions` của app mới với cùng
status, body, meta.

**Why this priority**: Là nửa đầu của tiêu chí chấp nhận; lịch sử là dữ liệu dùng chung, một dòng ghi sai là lệch vĩnh
viễn giữa hai app.

**Independent Test**: Chạy cùng chuỗi ghi ở hai app (với cùng `User-Agent`, `Origin`, qua proxy để cùng cách lấy IP),
so dòng `directus_activity`, `directus_revisions` (trừ `id`, `activity`, `timestamp`); đọc `/activity`, `/revisions`
với mọi dạng query của sidebar Directus ở cả hai app và so response.

**Acceptance Scenarios**:

1. **Given** collection có `accountability = all`, **When** sửa một item ở app mới, **Then** có một dòng
   `directus_activity` (`action = update`, `user`, `collection`, `item`, `ip`, `user_agent`, `origin`, `timestamp`) và
   một dòng `directus_revisions` (`data` là bản chụp sau khi sửa, `delta` là phần thay đổi, `activity` trỏ dòng trên)
   giống dòng Directus ghi cho cùng request, trừ `id`, `activity`, `timestamp`.
2. **Given** collection có `accountability = activity` hoặc `null`, **When** ghi item, **Then** chỉ có dòng activity,
   hoặc không có dòng nào, như Directus.
3. **Given** dòng lịch sử ghi bởi app mới, **When** mở item đó trong app Directus (qua proxy, mọi `/activity`,
   `/revisions` đi tới app mới), **Then** sidebar Revisions liệt kê đúng số dòng, người, thời gian, nội dung so sánh;
   module Activity hiển thị dòng với IP và user agent.
4. **Given** `GET /activity`, `SEARCH /activity`, `GET /activity/:pk`, `GET /revisions`, `SEARCH /revisions`,
   `GET /revisions/:pk` với `filter`, `fields` (gồm `activity.*`, `revisions.*`, `user.*`), `sort`, `limit`, `page`,
   `aggregate`, `meta`, **When** gửi tới hai app bằng admin và user có quyền một phần, **Then** status, body, `meta`
   giống nhau.
5. **Given** user không có quyền đọc `directus_revisions`, **When** gọi `/revisions`, **Then** `403` như Directus; user
   app access thấy `directus_activity` của chính mình theo quyền tối thiểu.
6. **Given** request có `Cache-Control: no-store` hoặc cache đang bật, **When** đọc `/activity`, `/revisions`, **Then**
   response cache dùng chung và header giống Directus.

---

### User Story 2 - Content versioning dùng chéo giữa hai app (Priority: P1)

Biên tập viên tạo bản nháp (version) của một item ở app này, lưu thay đổi dần vào bản nháp, xem item theo bản nháp
(`?version=`), so sánh với bản chính, rồi promote về bản chính ở app kia; hai app đọc cùng dòng `directus_versions`
và cùng `hash`, `delta`.

**Why this priority**: Là nửa sau của tiêu chí chấp nhận ("version tạo ở bên này promote được ở bên kia"); menu Version
của app Directus không dùng được nếu thiếu.

**Independent Test**: Port `version.test.ts`; chạy chuỗi tạo → save → compare → promote với mỗi bước xen kẽ giữa hai
app, cả hai chiều; so dòng `directus_versions`, item chính sau promote, activity và revision của `version_save` và
`update`.

**Acceptance Scenarios**:

1. **Given** collection bật `versioning`, **When** `POST /versions` với `key`, `name`, `collection`, `item`, **Then**
   dòng được tạo với `hash` của item chính (object-hash 3.0.0 trên cùng dữ liệu) giống Directus; `key = main`, thiếu
   field, collection chưa bật versioning, trùng `key` cho cùng item trả đúng lỗi (`400`, `422`, `403`) và message như
   Directus.
2. **Given** version đã có, **When** `POST /versions/:id/save` với delta (gồm field quan hệ o2m, m2m, m2a, dạng
   `create/update/delete`), **Then** `delta` lưu gộp với delta cũ, mỗi object trong delta mang `_user`, `_date` như
   Directus; collection `accountability = all` có thêm activity `version_save` và revision gắn `version`; response là
   item chính gộp delta.
3. **Given** version có delta, **When** `GET /items/:collection/:id?version=<key>` (có và không `versionRaw`,
   có `fields` lồng), **Then** body giống Directus (blackbox "version response"); item không tồn tại hoặc không có
   quyền đọc trả `403`.
4. **Given** version tạo và save ở app A, **When** `GET /versions/:id/compare` ở app B, **Then** `outdated`,
   `mainHash`, `current`, `main` giống khi gọi ở app A.
5. **Given** version tạo ở app A, **When** `POST /versions/:id/promote` với `mainHash` (và tùy chọn `fields`) ở app
   B, **Then** item chính được cập nhật như Directus (tách `defaultOverwrites`, event `items.promote`), activity
   `update` và revision được ghi; `mainHash` cũ trả `422` "Main item has changed since this version was last updated";
   không có delta trả `422` "No changes to promote"; thiếu `mainHash` trả `400`.
6. **Given** `PATCH /versions/:id` hoặc batch, **When** đổi `key`, `name`, **Then** chỉ hai field đó được nhận; `key`
   trùng hoặc `main` trả lỗi như Directus; `DELETE /versions/:id` xóa dòng, các revision `version_save` gắn nó bị xóa
   theo khóa ngoại (activity của chúng còn), và app kia không thấy version nữa.
7. **Given** hai item dùng chung dòng quan hệ, **When** save delta sửa dòng chung ở cả hai version (blackbox "version
   deadlocking"), **Then** cả hai `save` xong trong timeout của file `version.test.ts` của Directus (số giây ghi ở
   T036 khi copy) và kết quả giống Directus.

---

### User Story 3 - Khôi phục item về một revision (Priority: P2)

Người dùng chọn một revision trong sidebar Revisions của app Directus và khôi phục item về dữ liệu của revision đó.
App Directus tính payload bằng hiệu giữa `data` của revision được chọn và `data` của revision liền trước (sắp theo `id`
giảm dần), cho chọn field, đổ vào form rồi lưu qua `PATCH /items`; nên thứ tự `id` và `data` của revision do app kia
ghi quyết định kết quả. Revert qua API
(`POST /utils/revert/:revision`) thuộc `/utils` của feature 010 (Clarifications).

**Why this priority**: Yêu cầu của mô tả; đường ghi đã có từ 005, feature này phải bảo đảm `data` của revision do app mới
ghi đủ để khôi phục và lịch sử sau revert giống Directus.

**Independent Test**: Tạo item, sửa hai lần ở app mới, revert về revision đầu bằng E2E app Directus qua proxy (lưu đi
tới app mới) và bằng `PATCH /items` với `data` của revision ở mỗi app; so item, activity, revision mới sinh.

**Acceptance Scenarios**:

1. **Given** revision có `data` ghi bởi app mới, **When** `PATCH /items/:collection/:id` với `data` đó ở app kia,
   **Then** item quay về dữ liệu của revision (kể cả field quan hệ không nằm trong `data` giữ nguyên) và sinh activity
   `update`, revision mới giống Directus.
2. **Given** revision ghi bởi app mới, **When** mở sidebar Revisions trong app Directus (qua proxy) và bấm Revert rồi
   Save, **Then** item quay về dữ liệu đó và lịch sử ghi thêm dòng `update` ở app mới.
3. **Given** revision không có `data` (revision của delete hoặc `version_save`), **When** xem trong sidebar Revisions,
   **Then** app Directus hiển thị giống như khi đọc từ Directus (so màn hình ở E2E, không giả định về nút Revert).

---

### User Story 4 - Comment trên item (Priority: P2)

Người dùng viết, sửa, xóa comment trên một item, nhắc tới người khác bằng `@<uuid>`; người được nhắc nhận thông báo
trong app Directus; comment viết ở app này thấy ở app kia.

**Why this priority**: Sidebar Comments của app Directus gọi `/comments`; không có thì sidebar lỗi.

**Independent Test**: Chạy cùng chuỗi `POST`, `PATCH`, `DELETE /comments` và các query của sidebar ở hai app; so
response, dòng `directus_comments`, `directus_notifications`.

**Acceptance Scenarios**:

1. **Given** user có quyền đọc item, **When** `POST /comments` với `collection`, `item`, `comment`, **Then** dòng
   `directus_comments` (`user_created`, `date_created`) được tạo, response theo `fields`; thiếu `comment`,
   `collection`, `item` trả `400` với reason như Directus; không đọc được item trả `403`; không đăng nhập trả `403`.
2. **Given** comment có `@<uuid>` của user đọc được item, **When** tạo comment, **Then** một dòng
   `directus_notifications` (`recipient`, `sender`, `subject` "You were mentioned in <collection>", `message` có trích
   comment với tên người được nhắc, link `PUBLIC_URL/admin/content/<collection>/<item>`, `collection`, `item`) giống
   Directus; user được nhắc không đọc được item thì không có dòng và có log cảnh báo; uuid không tồn tại trả `403`
   như Directus sau khi comment đã ghi (dòng comment, activity, revision vẫn còn; bộ đối chiếu so cả dòng còn lại).
3. **Given** `GET /comments` với `filter[collection]`, `filter[item]`, `sort=-date_created`, `fields`
   (`user_created.*`), `aggregate[count]`, `limit`, `offset`, **When** gọi ở hai app, **Then** response giống nhau;
   user chỉ có quyền tối thiểu app access thấy, sửa, xóa comment của mình (sidebar Comments của app Directus khi đó
   chỉ liệt kê comment của chính user; là hành vi Directus, không phải lỗi app mới).
4. **Given** comment ghi bởi app mới, **When** mở item trong app Directus, **Then** sidebar Comments hiển thị, sửa,
   xóa được comment và bộ đếm đúng.

---

### User Story 5 - Dọn lịch sử theo cấu hình (Priority: P2)

Đội vận hành bật `RETENTION_ENABLED`, đặt `RETENTION_SCHEDULE`, `RETENTION_BATCH`, `ACTIVITY_RETENTION`,
`REVISIONS_RETENTION`, `FLOW_LOGS_RETENTION` trong `.env` dùng chung; chỉ một tiến trình (của app nào cũng được) chạy
dọn mỗi kỳ, xóa theo lô, dừng khi lỗi, như Directus.

**Why this priority**: Yêu cầu "áp dụng cấu hình ACTIVITY và REVISIONS giống Directus"; chạy chung một job với Directus
nên sai lịch hoặc sai khóa làm xóa trùng hoặc xóa nhầm.

**Independent Test**: Seed activity, revision cũ và mới; bật retention với lịch mỗi phút ở app mới (Directus tắt) và
ngược lại; so dòng còn lại; chạy cùng lúc ở cả hai app và kiểm khóa `schedule--data-retention` chỉ cho một bên chạy.

**Acceptance Scenarios**:

1. **Given** `RETENTION_ENABLED=true` và lịch hợp lệ, **When** tới kỳ, **Then** xóa `directus_activity` có
   `timestamp` cũ hơn `ACTIVITY_RETENTION` (trừ `action = run`), `action = run` cũ hơn `FLOW_LOGS_RETENTION`, và
   `directus_revisions` cũ hơn `REVISIONS_RETENTION` theo `timestamp` của activity nối, chỉ khi `ACTIVITY_RETENTION`
   tắt hoặc lớn hơn `REVISIONS_RETENTION`; mỗi lô `RETENTION_BATCH` dòng; MySQL, MariaDB dùng hai bước như Directus.
2. **Given** `RETENTION_ENABLED=false` hoặc `RETENTION_SCHEDULE` không hợp lệ, **When** khởi động, **Then** không có
   job và không có cảnh báo khác Directus.
3. **Given** hai app cùng bật, **When** cùng tới kỳ, **Then** chỉ một tiến trình dọn (khóa `schedule--data-retention`
   và job đồng bộ `retention` dùng chung), lỗi xóa ghi log "Retention failed for Collection <tên>" và dừng collection
   đó.
4. **Given** biến `RETENTION_*`, `ACTIVITY_RETENTION`, `REVISIONS_RETENTION`, `FLOW_LOGS_RETENTION` đặt trong `.env`,
   **When** khởi động app mới, **Then** chúng thuộc nhóm "đã hỗ trợ" (không còn cảnh báo chưa hỗ trợ).

---

### User Story 6 - Bộ test của Directus và E2E app Directus chạy qua trên app mới (Priority: P2)

Bộ blackbox `version.test.ts`, unit `versions.test.ts`, `split-recursive.test.ts`, `retention.test.ts` được port và đạt ở cả hai app; Playwright E2E app Directus qua proxy cho sidebar Revisions (xem,
so sánh, revert), sidebar Comments (viết, nhắc, sửa, xóa), menu Version (tạo, save, so sánh, promote, đổi tên, xóa),
module Activity.

**Why this priority**: Kiểm chứng diện rộng theo vendor; là cổng đóng feature.

**Independent Test**: Chạy bộ port với `TEST_DB=postgres`, `mysql`, `sqlite3` mỗi lần push, vendor còn lại ở
`nightly.yml`.

**Acceptance Scenarios**:

1. **Given** bộ port, **When** chạy với app mới là mục tiêu, **Then** 100% ca đạt, ca fail trên chính Directus được
   ghi chú như 005 đến 007.
2. **Given** E2E Playwright, **When** `/activity`, `/revisions`, `/versions`, `/comments` đi tới app mới, **Then** mọi thao tác ở trên hoàn tất và màn hình hiển thị như khi đi tới Directus.

---

### Edge Cases

- Version `save` không kiểm quyền cập nhật item chính (chỉ `promote` kiểm): user có quyền đọc version ghi được delta
  vào version của item mình không sửa được (rủi ro R-20, tái tạo).
- `?version=` không `versionRaw`: app áp delta trong transaction rồi rollback để đọc; khóa dòng quan hệ dùng chung giữa
  hai item (blackbox "version deadlocking"); trên SQLite, transaction này giữ pool như R-12 (đo).
- `promote` kiểm `mainHash` rồi mới cập nhật, không khóa: hai promote đồng thời cùng `mainHash` đều có thể qua kiểm
  (rủi ro R-21, tái tạo).
- `mapDelta`: field `user-updated`, `date-updated` ở object có khóa chính lấy `_user`, `_date`; `user-created`,
  `date-created` ở object chưa có khóa; `_user`, `_date` không trả về client; `delta` thêm khóa chính của item.
- `compare` với version không có delta trả `current` chỉ có khóa chính; `main` đọc theo quyền của người gọi (field bị
  cấm không có).
- Item chính đã bị xóa (version còn vì không có khóa ngoại): `compare`, `save`, `promote`, `?version=` trả `403` vì
  `getMainItem` không đọc được; collection tắt `versioning` sau khi version tồn tại: `save`, `promote`, đọc
  `?version=` vẫn chạy (Directus chỉ kiểm `versioning` lúc tạo).
- `GET /activity/:pk`, `GET /revisions/:pk`, `GET /versions/:pk`, `GET /comments/:pk` của dòng không có (kể cả vừa bị
  retention xóa) trả `403` vì `readOne` ném `Forbidden`; nhánh `data: null` của controller Directus không tới được.
- `RevisionsService.revert` (route ở 010) cập nhật bằng `ItemsService` chung của `revision.collection`, kể cả collection
  hệ thống (ví dụ `directus_files`), không qua `getService`, như Directus (đọc ở T012).
- Comment: regex mention chỉ bắt uuid v4; tên người được nhắc lấy bằng `UsersService` không accountability (đọc được
  mọi user); nhắc chính mình vẫn tạo thông báo; comment rỗng chuỗi trả `400`.
- `RevisionsService` ghi với `autoPurgeCache: false`, `bypassLimits: true`: tạo revision không xóa data cache và không
  giới hạn số dòng; `/revisions` vẫn chịu `QUERY_LIMIT_MAX`.
- Retention: `ACTIVITY_RETENTION` nhỏ hơn `REVISIONS_RETENTION` thì không có task revision; revision vẫn mất cùng
  activity của nó qua khóa ngoại CASCADE khi activity bị dọn (không có revision mồ côi); "tắt" một mốc nghĩa là đặt giá
  trị không phải thời lượng (ví dụ `false`, rỗng) để `getMilliseconds` trả `undefined` và task đó bị bỏ qua, vì mặc
  định `90d` không có cách tắt khác.
- Lỗi xóa ở một collection: log lỗi, dừng vòng lô của collection đó, task còn lại vẫn chạy, khóa vẫn được xóa cuối job
  (như `break` của Directus).
- Khóa `schedule--data-retention` còn trong 10 phút (tiến trình trước chết giữa chừng) thì kỳ này bỏ qua, như Directus.

### Truy vết user story và requirement

| Story | Acceptance scenario | FR | SC |
|-------|---------------------|----|----|
| US1 | 1–6 | FR-001 đến FR-004, FR-010 đến FR-013 | SC-001, SC-002 |
| US2 | 1–7 | FR-001, FR-030 đến FR-039 | SC-003 |
| US3 | 1–3 | FR-020, FR-021 | SC-002, SC-006 |
| US4 | 1–4 | FR-040 đến FR-044 | SC-002, SC-004 |
| US5 | 1–4 | FR-050 đến FR-053 | SC-005 |
| US6 | 1–2 | FR-060 đến FR-063 | SC-001, SC-004, SC-006 |

## Requirements *(mandatory)*

### Functional Requirements

**Route và hành vi chung**

- **FR-001**: App mới PHẢI phục vụ mọi route của `controllers/activity.ts`, `revisions.ts`, `versions.ts`,
  `comments.ts`, cùng thứ tự middleware (`useCollection`, `validateBatch`, `respond`), cùng status, body, header và
  lỗi với Directus 11.17.4, gồm `OPTIONS`, `HEAD` qua `router-options` với mẫu `/activity*`, `/revisions*`,
  `/versions*`, `/comments*`; `/utils` (gồm `POST /utils/revert/:revision`) vẫn thuộc D-09.8 (Clarifications).
- **FR-002**: Quyền trên `directus_activity`, `directus_revisions`, `directus_versions`, `directus_comments` PHẢI áp
  như Directus qua engine của 004, gồm quyền tối thiểu app access (`directus_activity` read dòng của chính mình;
  `directus_comments` read, update (chỉ field `comment`), delete dòng do mình tạo, create với `comment` không null).
  Quyền tối thiểu không gồm `directus_versions` và `directus_revisions`: user thường cần policy cấp read (để dùng
  `?version=` và menu Version), create, update, delete trên `directus_versions` và read trên `directus_revisions`
  (sidebar Revisions) như Directus; `save`, `promote` thêm kiểm quyền ở FR-033, FR-035.
- **FR-003**: `getService` PHẢI trả `VersionsService` cho `directus_versions`, `CommentsService` cho
  `directus_comments` và `NotificationsService` cho `directus_notifications` ở mọi đường ghi (route riêng, ghi lồng
  qua `/items`, `/users`), như Directus.
- **FR-004**: Response cache, `meta` (`total_count`, `filter_count`), `Emitter` và cầu nối websocket PHẢI làm như các
  route item (005). Event của collection hệ thống mang scope là tên bỏ tiền tố: `activity.create`,
  `revisions.create`, `versions.create|update|delete`, `comments.create|update|delete`,
  `notifications.create` (không phải `items.*`); riêng `items.promote` và `<collection>.items.promote` là tên cố
  định (FR-038).

**Activity và revisions**

- **FR-010**: Mọi đường ghi của app mới (item, file, folder, user, role, policy, permission, access, collection hệ
  thống khác đã có route, login, logout, version save; revert và promote đi qua `update` nên không có `action`
  riêng) PHẢI ghi `directus_activity` và `directus_revisions` với cùng giá trị từng cột như Directus cho cùng
  request: `action`, `user`, `collection`, `item`, `ip` (theo `IP_TRUST_PROXY`, `IP_CUSTOM_HEADER`), `user_agent`,
  `origin`, `timestamp`; revision có `data` (với `update`: bản chụp toàn bộ field không quan hệ của item sau khi ghi,
  không chỉ field trong payload; với `create`: payload tạo, không có khóa chính tự sinh), `delta` (payload đã
  `prepareDelta`), `parent`, `version`, `activity` (đo ở T028).
- **FR-011**: `ActivityService`, `RevisionsService` PHẢI là `ItemsService` trên hai collection với các mặc định của
  Directus (`RevisionsService`: `autoPurgeCache: false`, `bypassLimits: true` ở mọi `create*`, `update*`).
- **FR-012**: `GET`, `SEARCH /activity` PHẢI hỗ trợ `readSingleton` khi `req.singleton`, `readMany` khi body có `keys`,
  còn lại `readByQuery`; `/revisions` chỉ `readByQuery`; `GET /:pk` của dòng không có trả `403` (`readOne` ném
  `Forbidden`), như Directus.
- **FR-013**: Field quan hệ `activity.revisions`, `revisions.activity`, `revisions.parent`, `revisions.version`,
  `activity.user` PHẢI đọc được qua `fields` lồng và `filter` lồng như Directus (dùng cho `use-revisions.ts`);
  `activity.user` là m2o tới `directus_users`, mở rộng `user.*` theo quyền đọc `directus_users` của người gọi (không
  có quyền thì chỉ thấy id), như Directus.

**Revert**

- **FR-020**: `data` của revision do app mới ghi PHẢI đủ để khôi phục item bằng `PATCH /items/:collection/:id`
  (bản chụp toàn bộ field không quan hệ, cùng kiểu và định dạng như Directus, vì app Directus lấy payload từ hiệu
  `data` của hai revision liền kề) ở cả hai app; `RevisionsService.revert`
  được port (dùng cho `/utils/revert` ở 010 và GraphQL ở 011) nhưng chưa có route.
- **FR-021**: Revert qua `PATCH /items` PHẢI sinh activity `update` và revision mới như một `PATCH` thường (không dùng
  `action = revert`), như Directus 11.17.4.

**Versions**

- **FR-030**: `VersionsService` PHẢI port đủ `services/versions.ts`: kiểm payload tạo (joi: `key` bắt buộc, `name`
  cho phép null, `collection`, `item` bắt buộc; `main` bị cấm), kiểm quyền đọc item (`403`), kiểm `meta.versioning`
  (`422`), kiểm trùng `key` bằng service không accountability (`422`), `hash` bằng object-hash 3.0.0 của item chính đọc
  theo quyền người gọi. Vì `hash`, `mainHash` phụ thuộc tập field người gọi thấy, người tạo version và người gọi
  `compare`/`promote` thấy field khác nhau sẽ có `outdated = true` dù item không đổi (hành vi Directus); SC-003 đo với
  cùng user ở hai app.
- **FR-031**: `createMany` PHẢI chặn trùng `key-collection-item` trong cùng payload (`422`); `updateMany` chỉ nhận
  `key`, `name`, chặn `main` và trùng key với version khác (`422`).
- **FR-032**: `readOne` và `getVersionSave` PHẢI trả `delta` đã qua `mapDelta` (`deepMapWithSchema` với
  `mapNonExistentFields`, `detailedUpdateSyntax`): bỏ `_user`, `_date`, thay vào field `user-updated`,
  `date-updated` (object có khóa chính) hoặc `user-created`, `date-created` (object chưa có); thêm khóa chính của
  item. `readByQuery`, `readMany` (`GET /versions`, `SEARCH`, đọc lại sau `POST` mảng) trả `delta` thô còn `_user`,
  `_date`, như Directus; bộ đối chiếu so cả hai dạng.
- **FR-033**: `POST /versions/:pk/save` PHẢI làm như `save`: `prepareDelta` của `PayloadService`; theo
  `meta.accountability` ghi activity `version_save` (service không accountability, có `ip`, `user_agent`, `origin`
  của người gọi) và revision (`data` và `delta` cùng là delta, `version` trỏ version) khi `all`; gắn `_user`, `_date`
  (theo `helpers.date.writeTimestamp`) vào mỗi object (không vào mảng) của delta mới mà không `isEqual` với object
  tại cùng đường dẫn của delta cũ (save lại cùng nội dung thì giữ `_date` cũ); gộp vào delta cũ bằng `assign`; cập nhật `delta` bằng
  service admin; xóa data cache theo `shouldClearCache`; response là item chính gộp delta.
- **FR-034**: `GET /versions/:pk/compare` PHẢI trả `{ outdated, mainHash, current, main }` với `current` là delta cộng
  khóa chính và `main` là item chính đọc theo quyền người gọi.
- **FR-035**: `POST /versions/:pk/promote` PHẢI làm như `promote`: `400` khi `mainHash` không phải chuỗi; kiểm quyền
  update item (`403`); `422` khi không có delta hoặc hash lệch; `splitRecursive` tách `rawDelta` và
  `defaultOverwrites`; lọc theo `fields` nếu có (`pick` khóa cấp một của `rawDelta`, khóa không có trong delta bị bỏ
  qua không lỗi); `emitFilter` rồi `updateOne` với `overwriteDefaults`, `emitAction`
  `items.promote`; response là khóa item.
- **FR-036**: Đọc item với `?version=` PHẢI port `handle-version.ts`: `versionRaw` gộp delta thô vào item đã đọc;
  không `versionRaw` áp delta bằng service admin trong transaction (`emitEvents: false`, `autoPurgeCache: false`,
  `skipTracking: true`, `overwriteDefaults`, gom `onItemCreate`), đọc lại theo quyền người gọi, rollback, rồi bỏ khóa
  của dòng tạo tạm trong kết quả (`deepMapWithSchema` với `createdIDs`); version không có hoặc item không đọc được
  trả `403`. `?version=main` đọc item chính (không tra version); `version` trên danh sách (`GET /items/:collection`,
  `readByQuery`) bị bỏ qua; chỉ `readOne` và `readSingleton` xử lý, như Directus.
- **FR-037**: `hash`, `delta` (JSON), `date_created`, `user_created`, `date_updated`, `user_updated` PHẢI ghi với
  cùng kiểu và định dạng như Directus trên từng vendor, để version tạo ở app này so sánh và promote được ở app kia với
  cùng `mainHash`.
- **FR-038**: Event `items.promote` và `<collection>.items.promote` PHẢI phát với cùng payload, meta, context như
  Directus (filter trước `updateOne`, action sau).
- **FR-039**: Mọi lỗi của versions PHẢI trùng code và `reason` với Directus (bảng trong `contracts/` của plan).

**Comments**

- **FR-040**: `CommentsService` PHẢI port `services/comments.ts`: `createOne`, `updateOne`, `deleteOne` trả `403` khi
  không có `accountability.user`; `createOne` kiểm theo thứ tự: user đăng nhập (`403`) → `comment` → `collection` →
  `item` (`400` với reason như Directus, lỗi đầu tiên gặp) → quyền đọc item (`validateAccess`, `403`).
- **FR-041**: Mention `@<uuid v4>` PHẢI xử lý như Directus: với mỗi uuid duy nhất, dựng accountability của người được
  nhắc (`fetchRolesTree`, `fetchGlobalAccess`), kiểm quyền đọc item; có quyền thì tạo `directus_notifications`
  (`recipient`, `sender`, `subject`, `message` với trích comment đã thay mention bằng `<em>tên</em>` hoặc
  `@Unknown User`, link `PUBLIC_URL/admin/content/<collection>/<item>`, `collection`, `item`); không có quyền thì
  log warn "User <id> doesn't have proper permissions to receive notification for this item." và bỏ qua; lỗi khác
  ném ra. Thông báo tạo bằng `NotificationsService` không accountability (không kiểm quyền tạo
  `directus_notifications` của người viết), `sender` là người viết. Regex không phân biệt hoa thường nhưng `uniq` và bảng tên
  thì có: cùng uuid viết hoa và viết thường là hai mention (hai thông báo), bản viết hoa in `@Unknown User` (đo ở
  T010, unit test). Bản viết hoa được đọc bằng `UsersService.readOne` ngoài `try` của vòng: Postgres (cột uuid so
  không phân biệt hoa thường) tìm thấy user; MySQL, SQLite (`char(36)`) không tìm thấy nên trả `403` sau khi comment và
  thông báo đầu đã ghi, như Directus (đo ở CI của T030).
- **FR-042**: `NotificationsService` PHẢI được port cho FR-041 (`createOne` ghi dòng rồi `sendEmail`); `sendEmail`
  chạy tới bước quyết định gửi (user có `email` và `email_notifications = true`) rồi ghi một dòng log cảnh báo thay
  cho bước gửi, không đọc `EMAIL_*`, không lỗi (Nguyên tắc X; D-33, Clarifications) cho tới feature 010. Dòng log:
  mức `warn`, nội dung "Backoffice: mail sending is out of scope; notification "<subject>" for <email> not sent", một dòng
  mỗi thông báo; không thuộc bộ so log khởi động của 003.
- **FR-043**: Quyền tối thiểu app access của `directus_comments` PHẢI áp như `app-access-permissions.yaml`: đọc, xóa
  comment do mình tạo, sửa chỉ field `comment` của comment do mình tạo (field khác `403`), tạo với `comment` không
  null; quyền rộng hơn đến từ policy của user. `updateOne`, `deleteOne` không xử lý lại mention.
- **FR-044**: Ghi `directus_comments` PHẢI tạo activity, revision như Directus (collection hệ thống có
  `accountability`).

**Dọn lịch sử (retention)**

- **FR-050**: Khi `RETENTION_ENABLED=true` và `RETENTION_SCHEDULE` là cron hợp lệ, app mới PHẢI (Clarifications) đăng ký job đồng bộ
  `retention` (`scheduleSynchronizedJob`, cùng tên và cùng khóa với Directus) chạy `handleRetentionJob` như
  `schedules/retention.ts`: khóa `schedule--data-retention` với hạn 10 phút, xóa theo lô `RETENTION_BATCH` qua
  subquery (MySQL, MariaDB lấy id trước), cập nhật khóa sau mỗi lô, log lỗi và dừng collection đó, xóa khóa khi xong.
- **FR-051**: Task dọn PHẢI đúng như Directus: `directus_activity` `action != run` theo `ACTIVITY_RETENTION`,
  `action = run` theo `FLOW_LOGS_RETENTION`, `directus_revisions` nối `directus_activity` theo `REVISIONS_RETENTION`
  chỉ khi `ACTIVITY_RETENTION` tắt (giá trị không phải thời lượng, ví dụ `false` hoặc rỗng, `getMilliseconds` trả
  `undefined`) hoặc lớn hơn `REVISIONS_RETENTION`; task không có thời lượng bị bỏ qua; mốc so là `helpers.date.parse(now - timeframe)`.
- **FR-052**: Biến `RETENTION_ENABLED`, `RETENTION_BATCH`, `RETENTION_SCHEDULE`, `ACTIVITY_RETENTION`,
  `REVISIONS_RETENTION`, `FLOW_LOGS_RETENTION` PHẢI được đọc với cùng mặc định và không bị cảnh báo "chưa hỗ trợ";
  không thêm biến mới (Nguyên tắc VIII). Directus không liệt kê sáu biến này trong `directus-variables.ts`, nên chúng
  chưa bao giờ bị cảnh báo và không cần vào nhóm A (như `TUS_*` ở 007; đo ở T002).
- **FR-053**: Job PHẢI không gọi dựng schema (`getSchema`, tránh tăng tỉ lệ R-19); kiểm bằng unit test mock.

**Kiểm thử**

- **FR-060**: Bộ đối chiếu PHẢI so status, body, header và dòng `directus_activity`, `directus_revisions`,
  `directus_versions`, `directus_comments`, `directus_notifications` của hai app cho mọi route ở FR-001 kể cả lỗi.
  Tập so: dòng DB bỏ `id`, `timestamp`, `date_created`, `date_updated`, khóa ngoại tới dòng có `id` tự tăng
  (`activity`, `parent`) so qua dòng đích; `version` so qua `key`; `_date` trong `delta` và `date_*` so sau khi thay
  bằng marker (chỉ so có hay không và dạng ISO); `hash` so bằng tuyệt đối; bộ đối chiếu gửi cùng `User-Agent`,
  `Origin` cho hai app; `ip` so bằng tuyệt đối vì cả hai app nhận request từ cùng địa chỉ của bộ chạy test (gửi
  thẳng) hoặc cùng `X-Forwarded-For` (qua proxy); ca `IP_TRUST_PROXY` đã có ở 001.
- **FR-061**: Bộ blackbox, unit ở đầu spec PHẢI được port và đạt ở cả hai app trên Postgres, MySQL, SQLite mỗi lần
  push; vendor còn lại ở `nightly.yml`, như tiền lệ 004 đến 007. Bộ đối chiếu mới chia `reduced` (Postgres, MySQL,
  SQLite mỗi lần push: một ca mỗi route, dùng chéo, `?version=`, mention) và `full` (Postgres mỗi lần push, vendor
  còn lại nightly: mọi ca lỗi, quyền, R-20, R-21, retention, e2e-app).
- **FR-062**: PHẢI có kiểm tra chéo cả hai chiều: ghi ở app này đọc ở app kia (activity, revision, comment,
  notification); version tạo và save ở app này, compare và promote ở app kia; revert revision của app kia; retention
  bật ở một app dọn dòng do app kia ghi; chạy đồng thời hai app bật retention chỉ một bên dọn.
- **FR-063**: PHẢI có Playwright E2E app Directus qua reverse proxy cho sidebar Revisions (xem, so sánh, revert),
  sidebar Comments (viết có mention, sửa, xóa, bộ đếm), menu Version (tạo, save, xem bản nháp, so sánh, promote, đổi
  tên, xóa), module Activity (danh sách, chi tiết), chuông thông báo của user được nhắc (đọc qua `/notifications` của
  Directus, dòng do app mới ghi), với `/activity`, `/revisions`, `/versions`, `/comments` đi tới app mới (`/utils`,
  `/notifications` vẫn tới Directus); và benchmark ở hai app cho `GET /revisions` (query của sidebar, có
  `aggregate`), `GET /activity` (admin và user thường), `POST /versions/:id/save`, `GET /items/:c/:id?version=` trên
  seed 2.000 item × 20 revision × 1 version có delta, 50 kết nối (đọc) và 10 kết nối (`save`), ở workflow benchmark
  hằng tuần, không chặn CI.

### Key Entities

- **Activity**: một dòng `directus_activity`: hành động (`action`), ai (`user`), trên gì (`collection`, `item`), lúc nào
  (`timestamp`), từ đâu (`ip`, `user_agent`, `origin`); có nhiều revision.
- **Revision**: một dòng `directus_revisions` gắn một activity: bản chụp item sau thay đổi (`data`), phần thay đổi
  (`delta`), revision cha (`parent`, cho ghi lồng), version (khi là `version_save`).
- **Version** (bản nháp, content version): một dòng `directus_versions` của một item: `key` (không được là `main`),
  `name`, `hash` của bản chính lúc tạo hoặc so sánh, `delta` tích lũy (mỗi object thay đổi mang `_user`, `_date`),
  người và thời điểm tạo, sửa.
- **Comment**: một dòng `directus_comments` trên một item: nội dung, người và thời điểm tạo, sửa; mention `@<uuid>`
  sinh **Notification** (`directus_notifications`: người nhận, người gửi, tiêu đề, nội dung, collection, item).
- **Cấu hình dọn lịch sử**: `RETENTION_*`, `ACTIVITY_RETENTION`, `REVISIONS_RETENTION`, `FLOW_LOGS_RETENTION` dùng
  chung trong `.env`; một job đồng bộ `retention` và khóa `schedule--data-retention` chung giữa hai app.

## Khác biệt so với Directus *(mandatory)*

Thay đổi với bảng khác biệt của các feature trước:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-09.6 | Gỡ: `/activity`, `/revisions`, `/versions`, `/comments` làm ở feature này | FR-001 đến FR-044 |
| D-31 | Thu hẹp: bỏ `directus_comments`, `directus_notifications` khỏi danh sách collection hệ thống đi qua `ItemsService` chung | FR-003, FR-042 |

Giữ nguyên: D-09.8 (`/utils`, gồm `POST /utils/revert/:revision`, chờ 010; Clarifications). Sửa bảng của spec cũ đi
cùng feature này: dòng D-09.6 trong spec 001, dòng D-31 trong spec 004; entry tương ứng trong
`tests/parity/accepted-differences.ts`; `tests/parity/proxy/backoffice-routes.txt` thêm `activity`, `revisions`,
`versions`, `comments`. Mọi dòng cần tech lead duyệt khi đóng feature (Nguyên tắc X).

Khác biệt mới:

| Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) |
|----------|------------------|---------|-------|-----------------------------------------------|
| D-33: email khi được nhắc trong comment | `NotificationsService.createOne` gọi `sendEmail` (`MailService`, `EMAIL_*`) khi user có `email` và `email_notifications = true` | Ghi dòng `directus_notifications`; luồng `sendEmail` chạy tới bước gửi rồi ghi log cảnh báo thay vì gửi (như D-23) cho tới feature 010 (`/notifications`, `EMAIL_*`, `MailService`) | Owner chọn ở Clarifications 2026-10-13; `EMAIL_*` thuộc nhóm chưa hỗ trợ; gửi email là phạm vi của 010; người dùng vẫn thấy thông báo trong app Directus | ngoài phạm vi (tạm, gỡ ở 010) |

**Rủi ro chấp nhận (tái tạo từ Directus)**: như quy tắc của 004 đến 007. Bằng chứng tối thiểu cho mỗi R-xx trước khi
đóng feature: tên ca test đối chiếu tái tạo, request gửi, kết quả đo trên Directus 11.17.4 thật và ngày đo, ghi vào cột
"Bằng chứng"; cần tech lead duyệt khi đóng feature. Hai dòng dưới là dự kiến theo đọc code, chưa đo.

| Mã | Hành vi của Directus | Bằng chứng | Hệ quả |
|----|----------------------|------------|--------|
| R-20 | `VersionsService.save` không kiểm quyền cập nhật item chính; `delta` được ghi bằng service admin; chỉ `promote` gọi `validateAccess('update')` | `services/versions.ts` (`save`, `promote`); đo 2026-10-13 (T023, `versions.test.ts` "R-20"): user có read trên item và read, update trên `directus_versions`, không update trên item, gọi `POST /versions/:id/save`: `200` ở Directus 11.17.4 và app mới, delta được lưu, item chính không đổi | User chỉ có quyền đọc item và quyền đọc, sửa `directus_versions` vẫn lưu được delta vào bản nháp (không đổi bản chính). Tái tạo (FR-033) |
| R-21 | `promote` kiểm `mainHash` rồi `updateOne`, không khóa item; `save` ghi `delta` bằng `assign` sau khi đọc delta cũ ngoài transaction | `services/versions.ts` (`promote`, `save`); đo 2026-10-13 (T023, `versions.test.ts` "R-21"): hai `promote` cùng `mainHash` gửi đồng thời tới cùng app: Directus 11.17.4 trả `200, 200` (cả hai qua kiểm hash), app mới lần đo đó `200, 422`; kết quả tùy thời điểm ở cả hai app, ca test chấp nhận cả hai cặp | Hai promote hoặc hai save đồng thời trên cùng version có thể đều qua kiểm, bản sau thắng. Tái tạo (FR-033, FR-035) |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. Link `PUBLIC_URL/admin/content/...` trong thông báo, tiêu đề "You were mentioned in ...", tên job
  `retention`, khóa `schedule--data-retention`, giá trị `action` giữ nguyên vì là dữ liệu, tên kỹ thuật dùng chung với
  app Directus và Directus (Nguyên tắc IX).

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4. Khi spec không nói rõ, làm như code Directus. Quy ước message lỗi và quy tắc so
  của bộ đối chiếu như Assumptions của 004 đến 007.
- "Hiển thị đúng trong Directus" (tiêu chí chấp nhận) nghĩa là: dòng `directus_activity`, `directus_revisions`,
  `directus_versions`, `directus_comments` do app mới ghi trùng từng cột với dòng Directus ghi cho cùng request (trừ
  `id`, thời điểm, khóa ngoại tới `id` tự tăng), và E2E app Directus qua proxy hiển thị, so sánh, revert, promote được
  với chúng (FR-060, FR-063).
- "Promote được ở bên kia" nghĩa là `hash` của version và `mainHash` của `compare` tính ở hai app trùng nhau cho cùng
  item: cùng object-hash 3.0.0, cùng cách đọc item chính (cùng engine 004, 005) và cùng kiểu dữ liệu trả về theo vendor
  (FR-037). Nếu đo thấy lệch do kiểu dữ liệu (ví dụ số thập phân, ngày giờ theo vendor), ghi bằng chứng và đưa tech
  lead quyết trước khi đóng feature.
- Revert qua API (`POST /utils/revert/:revision`) thuộc 010 cùng `/utils`; app Directus revert qua `PATCH /items` đã
  có từ 005 (Clarifications). GraphQL (`revert`, `versions`, `comments` mutation) thuộc 011.
- Tiền đề dùng chung `.env` (Nguyên tắc VIII): hai app cùng `RETENTION_*`, `ACTIVITY_RETENTION`,
  `REVISIONS_RETENTION`, `FLOW_LOGS_RETENTION`, `PUBLIC_URL`, `IP_TRUST_PROXY`, `IP_CUSTOM_HEADER`; cùng namespace
  bus, lock để khóa retention là chung. Nếu khác (`RETENTION_SCHEDULE` khác nhau, chỉ một app bật) là ngoài phạm vi,
  không kiểm. Với `SYNCHRONIZATION_STORE=memory` (mặc định) mỗi instance tự chạy cron tới kỳ, khóa Redis
  `schedule--data-retention` quyết định instance nào dọn.
- Mặc định của Directus giữ nguyên: `RETENTION_ENABLED=false`, `RETENTION_BATCH=500`, `RETENTION_SCHEDULE='0 0 * * *'`,
  `ACTIVITY_RETENTION='90d'`, `REVISIONS_RETENTION='90d'`, `FLOW_LOGS_RETENTION='90d'`.
- `FLOW_LOGS_RETENTION` áp cho `action = run` dù flows thuộc 009, vì job dọn là một và dòng `run` do Directus ghi.
- Collection hệ thống chưa có route (D-09.7, D-09.8) ghi activity, revision khi được ghi lồng qua `ItemsService`
  chung như hiện nay; không mở rộng ở feature này. `directus_notifications` đi qua `NotificationsService` (D-31 thu
  hẹp) chỉ ở đường ghi lồng và mention; route `/notifications` vẫn tới Directus tới 010.
- Môi trường đối chiếu đã có proxy, cặp app chính; E2E dùng cùng cách chạy Playwright như 007 (Chrome cài sẵn).
- Ca của bộ blackbox, unit fail trên chính Directus ở một vendor được bỏ qua kèm ghi chú tên ca, như 005 đến 007.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% ca của bộ blackbox, unit port (US6) đạt ở cả hai app trên Postgres, MySQL, SQLite trước khi đóng
  feature; vendor còn lại đạt ở một lượt `nightly.yml` bấm tay hoặc được ghi chú theo Assumptions.
- **SC-002**: 100% request của bộ đối chiếu `/activity`, `/revisions`, `/versions`, `/comments` (kể cả lỗi, `OPTIONS`, `HEAD`) cho cùng status, body, header ở hai app, ngoài khác biệt đã ghi (D-33).
- **SC-003**: 100% dòng `directus_activity`, `directus_revisions`, `directus_versions`, `directus_comments` do app mới
  ghi trong bộ đối chiếu trùng từng cột (theo tập so FR-060) với dòng Directus ghi cho cùng request; 100% version tạo
  và save ở một app có `compare.outdated = false` và promote thành công ở app kia với `mainHash` lấy từ app kia.
- **SC-004**: 100% comment có mention trong bộ đối chiếu sinh dòng `directus_notifications` trùng (trừ `id`,
  `timestamp`) với Directus, kể cả ca người được nhắc không có quyền.
- **SC-005**: Với dữ liệu seed cố định, sau một kỳ retention số dòng còn lại ở mỗi collection bằng nhau khi job chạy ở
  app mới và khi chạy ở Directus; hai app cùng bật chỉ một tiến trình dọn mỗi kỳ: trong 10 kỳ, Redis `MONITOR` trên namespace
  lock của cặp đối chiếu ghi đúng 10 lần đặt khóa `schedule--data-retention` thành công và số dòng bị xóa bằng số dòng quá hạn (0 lần xóa
  trùng).
- **SC-006**: 100% kịch bản E2E app Directus (FR-063) qua app mới hoàn tất với cùng số bước và màn hình như qua
  Directus; ở mỗi kịch bản benchmark, p95 latency và throughput của app mới không tệ hơn Directus quá 10%, như tiền lệ
  005 đến 007.
