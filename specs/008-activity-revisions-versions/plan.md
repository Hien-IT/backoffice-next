# Implementation Plan: Lịch sử thay đổi, content versioning, comment (`/activity`, `/revisions`, `/versions`, `/comments`)

**Branch**: `008-activity-revisions-versions` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-activity-revisions-versions/spec.md`

## Summary

App mới có `/activity`, `/revisions`, `/versions` (CRUD, `compare`, `save`, `promote`, đọc item `?version=`),
`/comments` (CRUD, mention sinh `directus_notifications`) giống hệt Directus 11.17.4, ghi `directus_activity`,
`directus_revisions`, `directus_versions`, `directus_comments`, `directus_notifications` bằng cùng dòng, và chạy job dọn
lịch sử `retention` với cùng tên job, cùng khóa Redis và cùng biến `RETENTION_*`, `ACTIVITY_RETENTION`,
`REVISIONS_RETENTION`, `FLOW_LOGS_RETENTION`; nên lịch sử app mới ghi hiển thị đúng trong app Directus và version tạo ở
app này promote được ở app kia. Gỡ D-09.6, thu hẹp D-31; thêm D-33 (không gửi email khi được nhắc, ghi log cảnh báo
như Nguyên tắc X). Revert qua API (`/utils/revert`) và email chờ 010 (Clarifications).

Cách làm:

- Port nguyên, cùng đường dẫn, kèm test gốc: `VersionsService`, `CommentsService`, `NotificationsService` (bước gửi
  mail thay bằng log cảnh báo), `RevisionsService.revert`, `utils/versioning/{handle-version,split-recursive}`,
  `schedules/retention`; `ActivityService`, `RevisionsService`, `ItemsService` (ghi activity, revision, `skipTracking`,
  `onItemCreate`, `overwriteDefaults`), `sanitizeQuery` (`version`, `versionRaw`), `validateAccess`, `fetchRolesTree`,
  `fetchGlobalAccess`, `Url`, `userName`, `isValidUuid`, `shouldClearCache`, `transaction`, `getMilliseconds`,
  `scheduleSynchronizedJob`, `useLock`, `deepMapWithSchema` đã có từ 002 đến 007 (research R1, R3).
- Bốn controller Nest mỏng theo mẫu 007 (`activity`, `revisions`, `versions`, `comments`), `useCollection` trong
  `app.module.ts`, `validateBatch` qua `runMiddleware`; `getService` thêm `directus_versions`, `directus_comments`,
  `directus_notifications`; `handle-version.ts` bản thế chỗ thay bằng bản port (R2, R4, contracts/history-api.md,
  versions.md).
- Job `retention` đăng ký sau `tusSchedule` trong `app.ts`, dừng khi SIGTERM; 6 biến sang nhóm A (R5, R9).
- Bộ đối chiếu: `tests/parity/src/history/` so response và dòng của 5 bảng qua `historyEffects` (mở rộng
  `auth/db-effects.ts`), dùng chéo hai chiều, cặp profile `retention`; port blackbox `version.test.ts` + seed, unit
  `versions.test.ts`, `split-recursive.test.ts`, `retention.test.ts`; Playwright `history.spec.ts`; benchmark
  `history.ts`, job `benchmark-history` (R6 đến R8, contracts/parity.md).

Chi tiết quyết định: [research.md](./research.md). Dữ liệu: [data-model.md](./data-model.md). Contract:
[contracts/](./contracts/). Cách kiểm tra: [quickstart.md](./quickstart.md).

## Technical Context

Stack theo prompt của chủ dự án và cách feature này đáp ứng:

| Yêu cầu | Ở feature 008 |
|---------|---------------|
| Node 22, pnpm 10, Nx, `apps/api` NestJS strict | Giữ như 001 đến 007; không thư viện mới (R1) |
| Knex với dialect như `directus/api/src/database/helpers` | Không DDL; retention dùng `helpers.date.parse`, `helpers.schema.isOneOfClients(['mysql'])` (hai bước MySQL, MariaDB); `save` dùng `helpers.date.writeTimestamp`; `handleVersion` dùng `transaction` + rollback |
| Cache, bus Redis cùng key và kênh Directus | Khóa `schedule--data-retention` qua `useLock()` (`directus:lock`), clock job `retention` qua `directus-sync` khi `SYNCHRONIZATION_STORE=redis`; `save` xóa data cache theo `shouldClearCache`; `RevisionsService` `autoPurgeCache: false`; không key mới (R5) |
| Validate bằng Joi hoặc Zod giống Directus | Joi `versionCreateSchema`, `versionUpdateSchema` của Directus giữ nguyên; kiểm `comment`, `collection`, `item` tay như Directus; `mainHash` kiểm trong controller |
| Port từ `directus/api/src`, ghi đường dẫn gốc | Bảng ánh xạ bên dưới; manifest `tools/port-manifest/008-T*.json`; guard `check-port-headers` |
| Thư viện nội bộ `@backoffice/*` | `@backoffice/types` thêm `versions.ts`, `comments.ts`, `notifications.ts` (port `packages/types`); `deepMapWithSchema` từ `@backoffice/utils` |
| Env port từ `packages/env`, không đổi tên biến | Không biến mới; 6 biến retention sang nhóm A (R9) |
| Mỗi service Directus một provider, controller mỏng | `VersionsService`, `CommentsService`, `NotificationsService`, `ActivityService`, `RevisionsService` qua `ServiceFactory` trong `providers.ts`; bốn controller chỉ parse, chạy middleware, gọi service, `respond` (R4) |
| Vitest; test đối chiếu copy từ `directus/tests/blackbox`; Compose Postgres, MySQL, SQLite, Redis | R6 đến R8, contracts/parity.md; 1 file blackbox + seed; 3 file unit gốc; profile `retention` |
| GitHub Actions, coverage BE 80% | contracts/parity.md §4; R10 |

**Language/Version**: TypeScript 5.9.3 (bộ cờ strict của `@directus/tsconfig` 4.0.0), Node.js 22 LTS, ESM, pnpm
10.27.0, Nx 23.3. Giữ như 001 đến 007.

**Primary Dependencies**:
- Đã có: NestJS 12 (Express 5.2.1), knex 3.1.0, object-hash 3.0.0 (`hash` của version, cùng bản Directus), joi 18.2.6
  (Directus 18.0.1; cùng message cho `string().required()`, `allow(null)`, R1), lodash-es (`assign`, `get`, `isEqual`,
  `isPlainObject`, `pick`, `uniq`), cron 4.3.4, `@backoffice/memory` (`useLock`), `@backoffice/utils`
  (`deepMapWithSchema`, `toBoolean`), `@backoffice/errors`, `ItemsService`, `PayloadService` (`prepareDelta`),
  `MetaService`, `UsersService`, `CollectionsService`, `validateAccess`, `fetchRolesTree`, `fetchGlobalAccess`,
  `Emitter`, `respond`, `validateBatch`, `useCollection`, `runMiddleware`, `ServiceFactory`, `transaction`, `Url`,
  `userName`, `isValidUuid`, `shouldClearCache`, `getMilliseconds`, `scheduleSynchronizedJob`, `validateCron`,
  `onServerShutdown`, `getHelpers`.
- Thêm: không có (R1).

**Storage**:
- DB dùng chung; không DDL, không migration. Ghi `directus_activity`, `directus_revisions`, `directus_versions`,
  `directus_comments`, `directus_notifications` như Directus ([data-model.md](./data-model.md)); job retention xóa
  `directus_activity`, `directus_revisions` theo lô.
- Redis dùng chung: khóa `schedule--data-retention` (`directus:lock`), clock `retention` (`directus-sync`, khi bật);
  data cache xóa khi `save` và khi ghi comment, version (như `ItemsService`); không key mới.

**Testing**:
- Vitest 3.2.4: test gốc port kèm code (`versions.service` 3, `split-recursive` 10, `schedules/retention` 4); test mới
  cho bốn controller (supertest qua app Nest), `CommentsService` (mention, quyền, log), `NotificationsService` (không
  gửi mail, log cảnh báo), `RevisionsService.revert`, `handleVersion` (raw và transaction rollback), `getService`,
  `supported-variables` (R10). Coverage 80% `apps/api`.
- `tests/parity/src/history/` (R6): `history-effects.ts`, `activity`, `revisions`, `versions`, `version-read`,
  `comments`, `cross-use`, `retention`, `e2e-app` (query của app Directus). Blackbox thêm `version.test.ts`,
  `version.seed.ts` (R7, [contracts/parity.md](./contracts/parity.md)).
- `tests/directus-app-e2e/src/history.spec.ts` (R8); `routing.spec.ts`, `backoffice-routes.txt` sửa.
- `tests/benchmark/src/{history,seed-history}.ts`, job `benchmark-history` (R8).

**Target Platform**: Container Linux (`node:22-alpine`), nhiều replica cạnh Directus sau load balancer. Giữ như 001.

**Project Type**: Monorepo web (Nx). Chạm `apps/api`, `libs/types`, `tests/parity`, `tests/directus-app-e2e`,
`tests/benchmark`, CI.

**Performance Goals**:
- SC-006: `revisions-sidebar` (query của `use-revisions.ts` có `aggregate`), `activity-list` (admin, user thường),
  `version-save`, `item-version-read`; p95 và req/s không tệ hơn Directus quá 10%; đo hằng tuần, không chặn CI (quyết
  định 003).
- SC-005: 0 lần dọn trùng trong 10 kỳ khi hai app cùng bật retention.

**Constraints**:
- `hash`, `mainHash` trùng giữa hai app: cùng object-hash 3.0.0 trên item chính đọc bằng cùng engine; kiểu dữ liệu
  theo vendor đo sớm (R2); lệch → bằng chứng và tech lead (Assumptions).
- Không thêm biến môi trường; không email (D-33, Nguyên tắc X); `/utils`, GraphQL không chạm (D-09.8, D-09.9).
- Mọi file port ghi `// Ported from directus/...`; manifest `tools/port-manifest/008-T*.json`.
- Thứ tự controller: `activity`, `comments`, `revisions`, `versions` không trùng tiền tố route nào đã có.

**Scale/Scope**:
- Port khoảng 450 dòng service (versions 434, comments 179, notifications 70, revisions +15), 170 dòng util versioning,
  145 dòng retention, 590 dòng controller (→ Nest), 320 dòng test gốc; 3 file type; blackbox copy 1 test + 1 seed
  (khoảng 500 dòng); mới khoảng 1.600 dòng test đối chiếu và capture, 100 dòng profile/compose, 250 dòng Playwright,
  250 dòng benchmark. Nhỏ hơn 007; một `tasks.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Đối chiếu `.specify/memory/constitution.md` v1.4.0. Kết quả dưới đây là lần 2, sau research, data model và contracts
(lần 1 trước research không có vi phạm; không đổi sau Phase 1).

- [x] **I. Directus chỉ đọc**: PASS. Không sửa `directus/`. Mọi file port ghi `// Ported from directus/...` (bảng ánh
  xạ, manifest `008-T*.json`). Chỗ khác nguồn ghi `Backoffice:`: controller Nest, `NotificationsService.sendEmail`
  (log thay gửi), `stop()` job retention khi shutdown, blackbox `version.seed.ts` đọc URL qua shim.
- [x] **II. Dùng chung DB**: PASS. Không DDL, không migration; ghi 5 bảng qua service port nguyên (SC-003 so dòng);
  retention xóa theo cùng điều kiện và lô; khởi động không ghi gì (job chạy theo cron).
- [x] **III. API giống hệt**: PASS. Route, middleware, Joi, status, mã lỗi, `reason`, `meta`, `403` cho dòng
  không có, như Directus (contracts). D-09.6 gỡ, D-31 thu hẹp; D-33 là hành vi Nguyên tắc X (không gửi email) như D-23; R-20, R-21
  tái tạo, bằng chứng đo ở bộ đối chiếu.
- [x] **IV. Chạy song song an toàn**: PASS. Khóa retention cùng key `schedule--data-retention` trên `directus:lock`,
  clock `directus-sync` khi bật; `_date` của delta lấy từ DB helper; không state trong process.
- [x] **V. Kiểm thử đối chiếu**: PASS. Mỗi route có `activity`, `revisions`, `versions`, `version-read`, `comments`;
  dùng chéo `cross-use`; `retention` ở cặp profile riêng; blackbox `version.test.ts` hai lượt; Postgres đủ bộ mỗi lần
  push, MySQL, SQLite rút gọn, còn lại nightly (FR-061).
- [x] **VI. Kiến trúc**: PASS. Bốn controller mỏng; năm service là lớp Directus qua `ServiceFactory`; Knex, không
  ORM; mỗi thay đổi có test (R10).
- [x] **VII. Đa instance**: PASS. Job retention đồng bộ qua Redis khi `SYNCHRONIZATION_STORE=redis` và khóa Redis
  trong mọi trường hợp (một tiến trình chạy); khởi động chỉ đọc; `stop()` khi SIGTERM. Clock `memory` mặc định là hành
  vi Directus (ngoại lệ ghi ở 007).
- [x] **VIII. Biến môi trường**: PASS. Không biến mới; 6 biến sang nhóm A (R9).
- [x] **IX. Đổi thương hiệu**: PASS. Giữ tên job `retention`, khóa `schedule--data-retention`, giá trị `action`, link
  `/admin/content/...`, tiêu đề thông báo (dữ liệu dùng chung với app Directus). Log cảnh báo email ghi "Backoffice".
- [x] **X. Chất lượng và vận hành**: PASS. Coverage 80%. Benchmark hằng tuần (ngoại lệ đã duyệt ở 003). Playwright là
  cổng chặn (004). Không gửi email: luồng chạy đúng, bỏ bước gửi, ghi log cảnh báo (D-33). Gỡ D-09.6, thu hẹp D-31,
  D-33, R-20, R-21 cần tech lead duyệt trước khi đóng feature; bảng của spec 001, 004 sửa theo.
- [x] **XI. Ngoài phạm vi**: PASS. Không gửi email (D-33); không GraphQL (011), không WebSocket (cầu nối 005 giữ
  nguyên), không extension; không `/utils` (010).

## Project Structure

### Documentation (this feature)

```text
specs/008-activity-revisions-versions/
├── plan.md              # File này
├── research.md          # Phase 0: R1–R11
├── data-model.md        # Phase 1: activity, revision, version, comment, notification, retention, event
├── quickstart.md        # Phase 1: cách chạy và kiểm tra
├── contracts/
│   ├── history-api.md       # /activity, /revisions, /comments, mention, notification, lỗi
│   ├── versions.md          # /versions, compare, save, promote, ?version=, hash, delta, event
│   └── parity.md            # môi trường, bộ đối chiếu, blackbox, retention, CI, Playwright, benchmark
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

Chỉ liệt kê phần thêm hoặc sửa. Cấu trúc chung giữ như plan 001 đến 007.

```text
backoffice-next/
├── libs/types/src/{versions,comments,notifications}.ts + index.ts   # MỚI ← packages/types/src/
├── apps/api/src/
│   ├── app.ts                                  # SỬA: retentionSchedule sau tusSchedule
│   ├── app.module.ts, providers.ts             # SỬA: 4 controller, useCollection; factory Versions, Comments, Notifications, Activity, Revisions
│   ├── schedules/retention.ts (+ test gốc)     # MỚI ← schedules/retention.ts (+ stop() khi shutdown)
│   ├── services/versions.service.ts (+ test gốc)       # MỚI ← services/versions.ts
│   ├── services/comments.service.ts (+ test)           # MỚI ← services/comments.ts
│   ├── services/notifications.service.ts (+ test)      # MỚI ← services/notifications.ts (sendEmail: log cảnh báo)
│   ├── services/revisions.service.ts (+ test)          # SỬA: revert
│   ├── services/index.ts                       # SỬA
│   ├── utils/versioning/handle-version.ts (+ test)     # SỬA: thay bản thế chỗ bằng bản port
│   ├── utils/versioning/split-recursive.ts (+ test gốc)   # MỚI ← utils/versioning/split-recursive.ts
│   ├── utils/get-service.ts (+ test)           # SỬA: directus_versions, directus_comments, directus_notifications
│   ├── controllers/activity.controller.ts (+ test)     # MỚI ← controllers/activity.ts (Nest)
│   ├── controllers/revisions.controller.ts (+ test)    # MỚI ← controllers/revisions.ts
│   ├── controllers/versions.controller.ts (+ test)     # MỚI ← controllers/versions.ts
│   ├── controllers/comments.controller.ts (+ test)     # MỚI ← controllers/comments.ts
│   ├── middleware/router-options.ts (+ test)   # SỬA: mẫu /activity, /revisions, /versions, /comments
│   └── config/supported-variables.ts (+ test)  # SỬA: khối Feature 008
├── tests/parity/
│   ├── docker-compose.yml, env/profile-retention.env   # SỬA, MỚI: cặp retention (chỉ retention.test.ts bật)
│   ├── src/{profiles,docker}.ts, src/vendors.test.ts, src/proxy-conf.test.ts   # SỬA: profile thủ công, profileUp/Stop
│   ├── src/items/bus.test.ts, src/startup/     # SỬA: event versions.*, items.promote; khởi động retention
│   ├── proxy/backoffice-routes.txt             # SỬA: activity, revisions, versions, comments
│   ├── accepted-differences.ts                 # SỬA: xóa D-09.6, thu hẹp D-31, thêm D-33 (đóng feature)
│   ├── README.md                               # SỬA: mục 008
│   ├── src/history/                            # MỚI (contracts/parity.md §2)
│   │   ├── history-effects.ts
│   │   └── {activity,revisions,versions,version-read,comments,cross-use,retention,e2e-app}.test.ts
│   └── src/items/blackbox/tests/db/routes/items/{version.test.ts,version.seed.ts}   # MỚI (copy)
├── tests/directus-app-e2e/src/history.spec.ts  # MỚI (R8); routing.spec.ts SỬA
├── tests/benchmark/src/{history,seed-history}.ts   # MỚI; project.json SỬA
├── tools/port-manifest/008-T*.json             # MỚI
├── tools/ci-local.sh                           # SỬA
├── .github/workflows/{ci,parity-matrix,nightly,benchmark}.yml   # SỬA (contracts/parity.md §4)
├── specs/001-platform-foundation/spec.md       # SỬA: D-09.6
└── specs/004-permissions/spec.md               # SỬA: D-31
```

**Structure Decision**:
- Theo cấu trúc 001 đến 007: file của `directus/api/src` vào cùng đường dẫn trong `apps/api/src`; service và
  controller có hậu tố `.service.ts`, `.controller.ts`; `utils/versioning/` giữ cây con như gốc.
- Blackbox 008 thêm vào cây `tests/parity/src/items/blackbox/` (cùng shim, cùng seed `articles`, `tags`, `links`,
  `sections`) như 005 đến 007.
- Test đối chiếu mới đặt trong `tests/parity/src/history/`.

### Bảng ánh xạ file port (nguồn → đích)

| Nguồn (`directus/`) | Đích | Ghi chú |
|---------------------|------|---------|
| `api/src/services/versions.ts` (+ test) | `apps/api/src/services/versions.service.ts` | Nguyên |
| `api/src/services/comments.ts` | `apps/api/src/services/comments.service.ts` | Nguyên; test mới |
| `api/src/services/notifications.ts` | `apps/api/src/services/notifications.service.ts` | `sendEmail` dừng trước `MailService`, log cảnh báo (D-33); test mới |
| `api/src/services/revisions.ts` (`revert`) | `apps/api/src/services/revisions.service.ts` | Thêm hàm; test mới |
| `api/src/utils/versioning/handle-version.ts` | `apps/api/src/utils/versioning/handle-version.ts` | Thay bản thế chỗ; test mới |
| `api/src/utils/versioning/split-recursive.ts` (+ test) | `apps/api/src/utils/versioning/split-recursive.ts` | Nguyên |
| `api/src/schedules/retention.ts` (+ test) | `apps/api/src/schedules/retention.ts` | + `stop()` khi shutdown |
| `api/src/controllers/{activity,revisions,versions,comments}.ts` | `apps/api/src/controllers/*.controller.ts` | Nest; test mới |
| `packages/types/src/{versions,comments,notifications}.ts` | `libs/types/src/` | Nguyên |
| `tests/blackbox/tests/db/routes/items/version.{test,seed}.ts` | `tests/parity/src/items/blackbox/tests/db/routes/items/` | Copy nguyên; sửa ở contracts/parity.md §3 |

### Phần không port hoặc hoãn

| Phần | Lý do | Thay ở |
|------|-------|--------|
| `controllers/utils.ts` (`POST /revert/:revision` và các route `/utils` khác) | Clarifications, D-09.8 | 010 |
| `services/mail/*`, bước `mailService.send` của `NotificationsService` | Nguyên tắc X, XI; D-33 | 010 (route `/notifications`), gửi email ngoài phạm vi |
| `utils/versioning/merge-version-data.ts` | `api/src` không dùng | — |
| GraphQL `revert`, `versions`, `comments` | D-09.9 | 011 |
| `FLOW_LOGS_RETENTION` cho flow | Flows thuộc 009; job vẫn dọn `action = run` do Directus ghi | 009 |

## Complexity Tracking

Không có vi phạm mới. Ngoại lệ đã duyệt của 001 đến 007 vẫn áp dụng: benchmark hằng tuần thay vì chặn CI (003); store
`memory` với cảnh báo một instance (001); clock `SYNCHRONIZATION_STORE=memory` mặc định làm mỗi instance tự chạy job
đồng bộ (007; retention có thêm khóa Redis nên vẫn một tiến trình dọn). Gỡ D-09.6, thu hẹp D-31, D-33, R-20, R-21 cần
tech lead duyệt trước khi đóng feature (Nguyên tắc X).

Rủi ro đã biết, theo dõi trong tasks:

| Rủi ro | Ảnh hưởng | Cách xử lý |
|--------|-----------|------------|
| `hash` lệch giữa hai app do kiểu dữ liệu theo vendor (ngày giờ, số thập phân, JSON) trong item chính | SC-003 đỏ | Task đo đầu gói versions: tạo version ở Directus, `compare` ở app mới và ngược lại trên 3 vendor, mọi kiểu field của `seed-all-field-types`; lệch → bằng chứng, tech lead (Assumptions) |
| `handleVersion` không `versionRaw` giữ transaction rồi rollback: SQLite pool một kết nối (R-12), MySQL khóa dòng quan hệ chung (blackbox "deadlocking") | Treo hoặc `500` | Blackbox `version.test.ts` chạy mỗi lần push; ca đo trên SQLite ở `version-read.test.ts` |
| `_date` của delta: `helpers.date.writeTimestamp` trả `Date`, Directus lưu vào JSON `delta` theo `JSON.stringify` | Chuỗi khác múi giờ | So dòng `directus_versions.delta` ở `versions.test.ts`; cặp `tz-asia`, `tz-america` của 006 chạy thêm ca này |
| Thứ tự ghi activity, revision của `save` (service không accountability nhưng mang `ip`, `user_agent`) | Dòng lệch | So qua `historyEffects` trong `versions.test.ts` |
| Mention: `UsersService.readOne` của user không tồn tại ném lỗi (Directus `403`) trước khi tạo thông báo | Lỗi khác mã | Ca "uuid không tồn tại" trong `comments.test.ts` so status và dòng |
| Cặp profile `retention` dùng chung DB với mọi cặp và xóa lịch sử cũ hơn 2 s mỗi 10 s | Suite khác đỏ ngẫu nhiên vì mất activity, revision | Chỉ `retention.test.ts` bật và tắt cặp (`profileUp`, `profileStop`); không vào `env-up` chung; namespace bus, lock riêng; job không gọi `getSchema` (R-19) |
| Guard `accepted-differences` đỏ khi xóa `D-09.6` trước khi spec `Done` | CI đỏ | Xóa entry trong commit đóng feature (tiền lệ 007) |
| `directus_notifications` ghi qua `NotificationsService` khi tạo comment từ `/items/directus_comments` hoặc ghi lồng | Khác Directus nếu `getService` thiếu | `getService` thêm ba collection; test `get-service.test.ts` |
