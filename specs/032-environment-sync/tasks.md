---

description: "Danh sách task cho feature 032: đồng bộ cấu hình từ môi trường khác"
---

# Tasks: Đồng bộ cấu hình từ môi trường khác (kéo qua URL và token)

**Input**: Tài liệu thiết kế trong `/specs/032-environment-sync/`
**Prerequisites**: `plan.md`, `spec.md` (D-214, D-214.1, Q-49, năm mặc định, ba điểm Complexity Tracking, mười sửa câu
chữ của plan và mười chín sửa của checklist: duyệt 2026-11-14). Dùng thêm `research.md` (R1–R14), `data-model.md`,
`contracts/` (`api.md`, `web.md`, `tests.md`), `quickstart.md`, `checklists/` (requirements, api-compat, security,
data-safety).

**Điều kiện bắt đầu**: spec, plan, research, data-model, contracts, quickstart, checklists và tasks của 032 đã commit lên
`main` (`docs(032): ...`). Làm trên `main`, không branch; script `.specify` cần `SPECIFY_FEATURE=032-environment-sync`.
Checkout dùng chung với các phiên khác: `git add` theo đường dẫn, không `git add -A`/`.`, không `stash`, `reset`,
`checkout --`; không stage `apps/api/project.json`, `apps/web/project.json`; chỉ push khi `main` không có run CI đang
chạy. Không sửa file dưới `directus/`. Máy local: chạy test từng file, `--maxWorkers=1`; không dừng container của phiên
khác; với `-- <file>` thì `parity-tests:parity` cần `TEST_DB=<vendor>`; `env-up` lại sau khi sửa API hay web.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Endpoint mới: `GET /backoffice/sync`, `GET /backoffice/sync/state`, `POST /backoffice/sync/diff`,
  `POST /backoffice/sync/apply` (D-214, `doc`, test từng app: Directus 404). Không endpoint có sẵn nào đổi.
- Đối chiếu: `parity/sync/route.test.ts` trên cặp chính (Postgres, SQLite, MySQL); `diff`, `apply`, `refuse`,
  `no-trace` trên profile `sync` (chỉ Postgres, clarify 5); E2E ba cấu hình.
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).

**Organization**: Task nhóm theo user story, xếp theo ba lượt commit:
- **Lượt 1 (API chỉ đọc)** = Phase 1 (Setup), 2 (Foundational), 3 (US1 so sánh), 4 (US5 từ chối phía đọc, US6, đóng lượt).
- **Lượt 2 (API áp dụng)** = Phase 5 (US2 kéo dòng), 6 (US3 data model), 7 (US4 xóa), 8 (US5 từ chối phía ghi, đóng lượt).
- **Lượt 3 (Web)** = Phase 9 (US1 web), 10 (US2, US4 web), 11 (E2E), 12 (Polish, đóng lượt).

Mỗi lượt kết thúc bằng task "đóng lượt": lint, typecheck, test, build, parity hoặc E2E liên quan xanh; commit; push khi
`main` rảnh; CI xanh; `graphify update .`.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `sync/` = `apps/api/src/sync/`; `web/` = `apps/web/src/`;
  `ss/` = `apps/web/src/modules/settings/routes/sync/`; `e2e/` = `apps/web-e2e/src/`; `parity/` = `tests/parity/src/`.
- Code mới ghi ở đầu file `// Backoffice (spec 032)`; comment viết Directus là "DR" (Nguyên tắc IX).
- Nguồn trong parity: `backoffice-api` của cặp chính, gọi từ đích bằng `http://backoffice-api:8055`. Đích:
  `backoffice-api-sync` (10856) và `backoffice-api-sync-2` (10857), DB `backoffice_sync`, `ADMIN_TOKEN` của
  `env/profile-sync.env` (T002).

## Phase 1: Setup (chốt [Reported] và [Unverified] của research, môi trường test, kiểu; lượt 1)

**Purpose**: research không còn điểm chưa kiểm; có profile `sync` để chạy đối chiếu; có kiểu dùng chung.

- [x] T001 Kiểm tại chỗ (script dùng một lần trong scratchpad, không commit) và ghi "Kết quả T001" vào
      `specs/032-environment-sync/research.md`: (a) đọc lại mọi dòng [Reported] của R1–R13, sửa chỗ sai; (b) `redlock.using`
      của `libs/memory/src/kv/lib/redis.ts` với callback 20 giây trên Redis parity (cổng 6108): khóa có tự gia hạn không
      (R6); nếu không, ghi cách gia hạn cho T032; (c) thông điệp lỗi của `api/request/agent-with-ip-validation.ts` khi IP
      bị chặn và khi không tới được, để T012 phân biệt (R2); (d) tìm hàm tính quyền admin của một user không qua cache và
      nhận transaction (quanh `api/permissions/modules/fetch-global-access/` và `validate-remaining-admin/`) cho T038
      (R7); (e) FK `directus_operations.flow`, `directus_panels.dashboard`, `directus_operations.resolve/reject` có
      `ON DELETE CASCADE` hay không (migrations `20220429A-add-flows.ts`, `20210525A-add-insights.ts`) cho thứ tự xóa;
      (f) trên Postgres parity: trong một transaction ngoài, `applyDiff` tạo một collection rồi một insert lỗi → rollback,
      bảng không còn (R4); (g) `roles.service.ts:47-107` đúng như bảng "Xóa kèm" của data-model.
- [x] T002 [P] Profile parity `sync` theo mẫu profile `bootstrap` (research R13): `tests/parity/docker-compose.yml` thêm
      `backoffice-api-sync`, `backoffice-api-sync-2` dựng từ anchor `<<: *app` như `backoffice-api` (cùng build, image,
      lệnh), `env_file` = `env/${TEST_DB}.env`, `env/${PARITY_EXTENSIONS_ENV:-extensions}.env` (cùng extension và cùng
      `MIGRATIONS_PATH` với cặp chính) và một file mới `env/profile-sync.env` (`DB_HOST: postgres-sync`, `DB_DATABASE`,
      mật khẩu DB, `ADMIN_TOKEN` riêng); `environment` đè `DB_DATABASE: backoffice_sync`, Redis db 12,
      `CACHE_NAMESPACE: parity-sync`, `PUBLIC_URL: http://localhost:10856`; cổng 10856 và 10857; **không** dùng
      `MIGRATIONS_PATH` của profile `bootstrap` (khác danh sách migration thì FR-005 từ chối mọi lượt; analyze E1); và một
      Postgres riêng `postgres-sync` (cổng 6116, DB `backoffice_sync` do image tạo; làm 2026-11-14 thay cho thêm DB vào
      `postgres-bootstrap`, vì init SQL chỉ chạy trên volume mới); node 2 chờ node 1 healthy (bootstrap không có khóa);
      `tests/parity/scripts/env.mjs`
      (`ALL_PROFILES`), `parity/config.ts` (cổng; nếu `profilePorts` bắt buộc khóa `directus` thì thêm hằng số riêng
      `syncPorts` như `bootstrapCrossPort`), `parity/docker.ts`, `parity/global-setup.ts`, `parity/suite.ts` (`src/sync/**`
      trong FULL, `src/sync/route.test.ts` trong REDUCED và FULL). `env-up --vendor=postgres --profiles=sync` chạy được.
- [x] T003 [P] Route giả trong `tests/parity/registry/server.mjs`: `/sync-fake/mismatch/backoffice/sync` (phiên bản
      Backoffice khác), `/sync-fake/redirect/backoffice/sync` (302 sang host khác), `/sync-fake/shape/backoffice/sync` và
      `/state` (JSON sai hình dạng), `/sync-fake/slow/backoffice/sync` (trả lời sau 35 giây); mọi route yêu cầu header
      `Authorization` như nguồn thật.
- [x] T004 [P] Kiểu `sync/types.ts`: `GroupKey`, `GROUP_KEYS`, `SyncInfo`, `SyncState`, `RowState`, `SyncRow` (gồm
      `depends`, `cascade`, `selectable`, `reason`, `impact`), `SyncResult` (gồm `indexes`, `warnings`) theo data-model.md.

**Checkpoint**: research không còn [Reported] hay [Unverified] chưa xử lý; `env-up` profile `sync` lên hai node đích;
`tsc` của `apps/api` xanh. Sau T014: `GET /backoffice/sync` của `backoffice-api` và `backoffice-api-sync` trả cùng
`migrations` và cùng danh sách extension (analyze E1).

## Phase 2: Foundational (registry nhóm, đọc trạng thái, gọi nguồn, hai GET)

**Purpose**: cả nguồn và đích đọc được trạng thái cấu hình bằng cùng một hàm; đích gọi được nguồn an toàn. Chưa so sánh.

**⚠️ CRITICAL**: chưa xong Phase 2 thì không bắt đầu user story nào.

### Tests (MANDATORY) ⚠️

- [x] T005 [P] `sync/groups.test.ts`: đủ mười nhóm; mỗi `kind` có bảng, khóa so khớp, cột bỏ qua đúng bảng "Nhóm, loại
      dòng, khóa so khớp" của data-model; đồ thị phụ thuộc không vòng; thứ tự xóa là ngược thứ tự tạo.
- [x] T006 [P] `sync/state.test.ts` (DB SQLite tạm như các test service hiện có; tìm helper trong `api/__utils__` hoặc
      `api/services/backoffice-indexes.service.test.ts`): mỗi nhóm trả đúng bảng và cột; bỏ cột của data-model; bỏ field
      settings có special `encrypt`, `conceal`, `hash` (lấy từ schema, không ghi cứng tên); preset chỉ `user` và `role`
      null; link chỉ `user` null; index chỉ `ready`; operations nằm trong flow, panels trong dashboard; ngày giờ là chuỗi;
      `groups` giới hạn đúng nhóm được đọc.
- [x] T007 [P] `sync/source.test.ts` (axios giả): `normalizeUrl` bỏ `/` cuối, giữ đường dẫn con, từ chối không
      http/https và `user:pass@`; 401 → 400 "rejected the token"; 403; 404 ở `/backoffice/sync` → "does not support"; mọi
      3xx (kể cả cùng host) → 503; timeout → 503; trả lời > 100 MB → 503; sai hình dạng → 503; bảng và cột lạ trong
      `state` bị bỏ (FR-006); IP bị chặn → 400 "not allowed" (theo T001c); lỗi ném ra không chứa URL, token, nội dung trả
      lời của nguồn, không có `cause`; token chỉ ở header `Authorization`.
- [x] T008 [P] `api/services/backoffice-sync.service.test.ts`: `info()` lấy `BACKOFFICE_VERSION`,
      `DIRECTUS_COMPAT_VERSION`, vendor, hai danh sách migration đã sắp xếp; `compareInfo` báo khác phiên bản, khác danh
      sách migration (nêu số mục khác), khác vendor (chỉ đánh dấu nhóm `schema`); khóa áp dụng: cờ trong process trả 503
      ngay cho lượt thứ hai cùng process (analyze E2).
- [x] T009 [P] `api/controllers/backoffice-sync.controller.test.ts` (supertest, mẫu `backoffice-indexes.controller.test.ts`):
      `GET /backoffice/sync` và `GET /backoffice/sync/state` 401 không token, 403 user thường, 200 admin; `groups` lạ →
      400 `INVALID_QUERY`; `res.locals.cache === false`.

### Implementation

- [x] T010 `sync/groups.ts`: registry tĩnh theo data-model (bảng, khóa so khớp, cột bỏ qua, phụ thuộc, xóa kèm, thứ tự).
- [x] T011 `sync/state.ts`: `readState(groups, { knex, schema, accountability })` (R1, R9, R10): `schema` =
      `getSnapshot()` bỏ `systemFields`; các nhóm khác đọc qua `ItemsService` với accountability của người gọi; extension
      lấy tên gói và tên entry từ extension manager cùng `enabled` của dòng; kết quả qua `JSON.parse(JSON.stringify())`.
- [x] T012 `sync/source.ts`: `normalizeUrl`, `fetchInfo(url, token)`, `fetchState(url, token, groups)` qua `getAxios()`
      với `timeout: 30_000`, `maxRedirects: 0`, `maxContentLength` và `maxBodyLength` 100 MB, `validateStatus: () => true`;
      kiểm hình dạng (Joi) và lọc theo registry; ánh xạ lỗi theo bảng của contracts/api.md; không log URL, token, lỗi axios.
- [x] T013 `api/services/backoffice-sync.service.ts`: `info()`, `state(groups)`, `compareInfo(source, target)`; dùng
      `checkMigrations` (`api/database/validate-migrations.ts`) và `completedBackofficeMigrations`.
- [x] T014 `api/controllers/backoffice-sync.controller.ts`: `GET /backoffice/sync`, `GET /backoffice/sync/state` (admin,
      `res.locals.cache = false`, `respond`); đăng ký trong `api/app.module.ts` (controllers) và `api/providers.ts`; chạy
      T005–T009 xanh.

**Checkpoint**: unit `sync/**`, service, controller xanh; `curl` `GET /backoffice/sync` ở `backoffice-api-sync` trả
`SyncInfo`.

## Phase 3: User Story 1 - Kết nối nguồn và xem so sánh (Priority: P1, lượt 1) 🎯 MVP

**Goal**: `POST /backoffice/sync/diff` trả bảng so sánh mười nhóm với bốn trạng thái, phụ thuộc, xóa kèm, `impact` và
`hash`; không ghi gì ở hai bên.

**Independent Test**: `parity/sync/diff.test.ts`; `curl` của quickstart "Bằng API" (phần diff).

### Tests for User Story 1 (MANDATORY) ⚠️

- [x] T015 [P] [US1] `sync/diff.test.ts`: bốn trạng thái cho từng `kind`; khóa so khớp theo data-model (clarify 4); hai
      dòng cùng khóa ở một bên → dòng sau `selectable: false` `sync_duplicate_key`; `depends` của từng loại; `cascade` của
      collection, policy, role, folder theo bảng "Xóa kèm"; `selectable: false` cho role và policy admin `target_only`
      (clarify 1), field settings trỏ file thiếu (clarify 2), field mã hóa (clarify 3), extension một bên; `impact`;
      collection `source_only` mang field mới của nó; dòng `same` không mang giá trị; thay đổi chỉ ở giá trị bỏ qua
      không đổi `hash`; khác vendor → nhóm `schema` báo lỗi riêng, nhóm khác vẫn có dòng.
- [x] T016 [P] [US1] `api/controllers/backoffice-sync.controller.test.ts` thêm: `POST /backoffice/sync/diff` body sai →
      400; service giả trả dòng → 200 `{ data: { hash, source, groups, rows } }`; lỗi của service đi qua nguyên.
- [x] T017 [US1] `parity/sync/diff.test.ts` (profile `sync`, `describe.skipIf`): seed ở nguồn và đích theo
      contracts/tests.md §2b; mỗi nhóm đủ bốn trạng thái; `GET /backoffice/sync/state` của nguồn không chứa `**********`;
      dump số dòng các bảng cấu hình hai bên trước và sau diff không đổi (FR-015); nguồn là node thứ hai cùng DB
      (`http://backoffice-api-sync-2:8055` gọi từ `backoffice-api-sync`) → mọi dòng `same` (analyze E3; gọi chính tên
      của node bị `IMPORT_IP_DENY_LIST` chặn, T001c); dọn seed ở `afterAll`.

### Implementation for User Story 1

- [x] T018 [US1] `sync/diff.ts`: `diffStates(source, target, groups, { knex, schema })` → `SyncRow[]` với `depends`,
      `cascade`, `selectable`, `reason`, `impact` (đếm qua `knex`); nhóm `schema` qua `getSnapshotDiff` và
      `validateSnapshot` không `force` (R3); `hash` = `getVersionedHash({ source, target })` trên giá trị đã bỏ cột bỏ qua
      (R14).
- [x] T019 [US1] `api/services/backoffice-sync.service.ts` `diff({ url, token, groups })` theo trình tự của contracts/api.md;
      `api/controllers/backoffice-sync.controller.ts` `POST /backoffice/sync/diff` (Joi); chạy T015–T017 xanh.

**Checkpoint**: parity `diff.test.ts` xanh; không dòng nào ở hai DB đổi sau diff.

## Phase 4: User Story 5 (phía đọc) + User Story 6 + đóng lượt 1 (Priority: P1/P2)

**Goal**: mọi đường từ chối trước khi đọc dữ liệu trả đúng mã; không dấu vết; Directus 404; khác biệt ghi đủ; lượt 1 lên
`main`.

### Tests (MANDATORY) ⚠️

- [x] T020 [P] [US5] `parity/sync/refuse.test.ts` phần đọc: nguồn là Directus (`http://directus:8055`) → 400 "does not
      support"; token sai → 400 (không 401); URL không tới được → 503; `http://localhost:8055` → 400 "not allowed"; route
      giả `mismatch` → 400 kèm hai phiên bản; `redirect` → 503; `shape` → 503; `slow` → 503 sau khoảng 30 giây; user
      thường ở đích → 403; không lỗi nào chứa token hay host nguồn.
- [x] T021 [P] [US6] `parity/sync/route.test.ts` (cặp chính; REDUCED và FULL; Postgres, SQLite, MySQL): bốn route tại
      Directus → 404 `ROUTE_NOT_FOUND`; Backoffice `GET /backoffice/sync` admin 200 với `directus: '11.17.4'`, user thường
      403, không token 401; `/server/specs/oas` của Backoffice không chứa `/backoffice/sync` (FR-037, analyze E5).
- [x] T022 [P] [US5] `parity/sync/no-trace.test.ts` phần đọc: sau các lượt diff, token nguồn và chuỗi
      `backoffice-api:8055` không có trong log của hai node đích (`serviceLogs` của `parity/bootstrap/cli.ts` hoặc
      `logs` của `parity/docker.ts`), trong `directus_activity`, `directus_revisions` của DB đích.

### Implementation

- [x] T023 [P] [US6] `tests/parity/accepted-differences.ts`: D-214 và D-214.1, `kind: 'doc'`, `feature: '032'`, `reason`
      theo bảng spec; `tests/parity/README.md` mục 032 (profile `sync`, cổng, cách chạy).
- [x] T024 [P] `.github/workflows/ci.yml`: thêm `sync` vào danh sách profile của job `parity` Postgres (hai shard).
- [x] T025 [US1] Đo SC-006 một lần (script trong scratchpad, không commit): seed 200 collection, 100 flow, 2.000 permission ở
      nguồn, đo thời gian `POST /backoffice/sync/diff`; ghi "Kết quả lượt 1" vào research.md; chỉnh SC-006 nếu cần.
- [x] T026 Chạy `pnpm nx run api:lint`, `api:typecheck`, `api:test` (`--maxWorkers=1`; target `test` chặn ngưỡng
      coverage 80 % qua `vitest.shared.ts:26-32`, analyze U1), `api:build`; parity
      `sync/route.test.ts` trên Postgres và SQLite, `sync/{diff,refuse,no-trace}.test.ts` trên profile `sync`,
      `accepted-differences.test.ts`; sửa tới xanh.
- [ ] T027 Đóng lượt 1: `git add` theo đường dẫn (`apps/api`, `tests/parity`, `.github/workflows/ci.yml`,
      `specs/032-environment-sync`), commit `feat(api): compare config with another Backoffice environment (spec 032,
      D-214)` kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push khi `main` rảnh; theo dõi CI
      (quality, guard-differences, parity Postgres/SQLite/MySQL, blackbox, deploy), sửa job đỏ; `graphify update .`; ghi
      mã commit và run CI vào spec Status.

**Checkpoint**: lượt 1 trên `main`, CI xanh.

## Phase 5: User Story 2 - Kéo các dòng đã chọn về đích (Priority: P1, lượt 2)

**Goal**: `POST /backoffice/sync/apply` tạo và sửa dòng của chín nhóm ngoài data model trong một transaction dưới khóa;
việc sau commit chạy một lần; index chạy sau commit.

**Independent Test**: `parity/sync/apply.test.ts` phần 1.

### Tests for User Story 2 (MANDATORY) ⚠️

- [ ] T028 [P] [US2] `sync/apply.test.ts` phần dòng: khóa được giữ trước khi đọc lại hai bên và so hash (một thay đổi ở
      đích giữa diff và lúc lấy khóa vẫn bị bắt; analyze E2); thứ tự tạo của data-model; flow mới với FK vòng (flow
      `operation: null` → operations `resolve/reject` null → cập nhật `resolve/reject` → cập nhật `flow.operation`); sửa
      flow thêm, sửa, xóa operation (dashboard, panel cũng vậy); flow giữ `status` của nguồn (FR-019); dòng khớp theo id
      giữ id nguồn, khớp theo khóa tự nhiên có id mới; `user_created`, `date_created` và tương tự không chép, đích tự ghi
      (FR-024); settings được tạo khi đích chưa có dòng; extension chỉ đổi `enabled`; dòng không chọn không bị gọi ghi; việc
      sau commit gọi đúng một lần và chỉ cho nhóm có ghi; lỗi ở việc sau commit → kết quả có `warnings`, không ném; index
      tạo và xóa sau commit, lỗi index vào `indexes[].error`, không hoàn tác.
- [ ] T029 [P] [US2] `api/controllers/backoffice-sync.controller.test.ts` thêm: `POST /backoffice/sync/apply` body sai →
      400; 200 `{ data: SyncResult }`.
- [ ] T030 [US2] `parity/sync/apply.test.ts` phần 1 (profile `sync`): tick flow (webhook), policy + permission + quyền
      import, field settings, translation, preset global, dashboard + panel, folder, bật/tắt một extension có ở cả hai
      bên → áp dụng → ở đích đúng như nguồn; trigger webhook của flow chạy ở **cả hai node** đích (FR-029); activity và
      revision mang user admin của đích (FR-028); dump các dòng không tick trước và sau không đổi (SC-002); tick một index
      → kết quả `creating`, sau đó `ready`.

### Implementation for User Story 2

- [ ] T031 [US2] `sync/apply.ts` `applyRows(trx, rows, ctx)`: ghi theo nhóm qua service với `{ knex: trx, accountability,
      schema }`: `RolesService`, `PoliciesService`, `AccessService`, `PermissionsService`, `BackofficePermissionsService`,
      `SettingsService` (tạo nếu chưa có), `TranslationsService`, `PresetsService`, `DashboardsService`, `PanelsService`,
      `FoldersService`, `ExtensionsService` (`enabled`); flow và operation bằng `ItemsService` trên `directus_flows`,
      `directus_operations` (Complexity Tracking, R5). `afterCommit(written)`: `clearSystemCache()`, `clearCache()` của
      permissions, `getFlowManager().reload()`, reload và broadcast của extension manager, rồi index qua
      `BackofficeIndexesService.create/remove` từng cái; mỗi bước `try/catch` → `warnings`.
- [ ] T032 [US2] `api/services/backoffice-sync.service.ts` `apply({ url, token, hash, groups, selected })` theo trình tự của
      contracts/api.md: kiểm body, `fetchInfo` và `compareInfo`, **giữ khóa** `useLock().usingLock('backoffice-sync-apply')`
      cộng cờ trong process (503 ngay khi cùng process; gia hạn theo T001b), đọc lại hai bên, `diffStates`, so `hash`,
      kiểm `selected` (tồn tại, `selectable`, `depends`, `cascade`), transaction, commit, nhả khóa, `afterCommit`; một dòng
      log `info` không tên nguồn. Controller `POST /backoffice/sync/apply` (Joi). Chạy T028–T030 xanh.

**Checkpoint**: parity `apply.test.ts` phần 1 xanh.

## Phase 6: User Story 3 - Kéo data model (Priority: P1, lượt 2)

**Goal**: collection, field, relation được tick đi qua `applyDiff` trong cùng transaction với phần dòng.

**Independent Test**: `parity/sync/apply.test.ts` phần 2.

### Tests for User Story 3 (MANDATORY) ⚠️

- [ ] T033 [P] [US3] `sync/apply.test.ts` phần schema: lọc `SnapshotDiff` theo dòng chọn (collection, field, relation);
      collection `source_only` mang field mới của nó; `applyDiff` nhận `database: trx`; schema đọc lại bằng
      `getSchema({ database: trx, bypassCache: true })` trước khi ghi dòng; field mà collection chưa có ở đích và không
      được chọn → 400 trước khi ghi.
- [ ] T034 [US3] `parity/sync/apply.test.ts` phần 2: tick collection `parity_sync_a` (3 field, 1 relation tới collection có
      ở hai bên) → tạo item ở **cả hai node** đích; tick riêng một field mới của collection có ở hai bên → chỉ field đó thêm;
      ba cột `bo_show_*` của collection đi theo (xác nhận R3).

### Implementation for User Story 3

- [ ] T035 [US3] `sync/apply.ts` `applySchema(trx, rows, snapshots)`: lọc diff, `applyDiff(current, diff, { database:
      trx })`, đọc lại schema; chạy T033–T034 xanh.

**Checkpoint**: parity `apply.test.ts` phần 1–2 xanh.

## Phase 7: User Story 4 - Xóa ở đích (Priority: P2, lượt 2)

**Goal**: dòng `target_only` được tick bị xóa theo chiều ngược phụ thuộc, cùng các dòng xóa kèm; role và policy admin
không xóa được; người gọi không tự khóa mình.

**Independent Test**: `parity/sync/apply.test.ts` phần 3.

### Tests for User Story 4 (MANDATORY) ⚠️

- [ ] T036 [P] [US4] `sync/apply.test.ts` phần xóa: thứ tự xóa của data-model (con trước, operations sau khi đặt
      `resolve/reject` null); `selected` thiếu một dòng trong `cascade` → 400; dòng `selectable: false` → 400; người gọi mất
      quyền admin sau khi ghi → 400 "remove your own admin access" và rollback; folder có folder con `changed` không tick →
      400.
- [ ] T037 [US4] `parity/sync/apply.test.ts` phần 3: tick xóa một flow và một collection có dữ liệu của đích → biến mất
      cùng permission và preset của collection; dòng `target_only` khác không đổi; policy admin của đích không có trong dòng
      tick được; tick một thay đổi làm admin đích mất quyền → 400, không đổi.

### Implementation for User Story 4

- [ ] T038 [US4] `sync/apply.ts`: `deleteRows(trx, rows, ctx)` theo chiều ngược (qua cùng các service; xóa role qua
      `RolesService` để user bị đình chỉ như sửa tay); `assertCallerAdmin(trx, accountability)` bằng hàm của T001d trước
      commit; chạy T036–T037 xanh.

**Checkpoint**: parity `apply.test.ts` phần 1–3 xanh.

## Phase 8: User Story 5 (phía ghi) + User Story 6 (Directus cùng DB) + đóng lượt 2 (Priority: P1/P2)

**Goal**: so sánh cũ, hai lượt cùng lúc, lỗi giữa chừng đều không để lại gì; không dấu vết sau áp dụng; lượt 2 lên `main`.

### Tests (MANDATORY) ⚠️

- [ ] T039 [P] [US5] `parity/sync/refuse.test.ts` phần ghi: sửa một flow ở nguồn sau diff rồi apply → 400 "out of date",
      đích không đổi; sửa ở đích sau diff → 400 như vậy; hai lượt apply cùng lúc vào **cùng một node** → một 200, một 503
      ngay (cờ trong process); vào **hai node** → một 200, lượt kia 503 hoặc 400 "out of date", không ghi gì (FR-026,
      analyze I1); thu hồi token nguồn giữa diff và apply → 400, đích không đổi (analyze E3); `selected` thiếu phụ
      thuộc → 400, không ghi; một dòng lỗi khi ghi sau khi đã tạo collection → collection không còn ở đích (SC-004).
- [ ] T040 [P] [US5] `parity/sync/no-trace.test.ts` phần ghi: sau các lượt apply, token và host nguồn không có trong log,
      activity, revision của đích.
- [ ] T040a [P] [US6] (thêm khi analyze 2026-11-14, C1) `parity/sync/directus-cross.test.ts` (profile `sync`): nguồn là
      `backoffice-api-sync` (seed một flow và một collection bằng `ADMIN_TOKEN` của `env/profile-sync.env`), đích là
      `backoffice-api` của cặp chính (chung DB và Redis với `directus`, response cache bật), URL nguồn
      `http://backoffice-api-sync:8055`; áp dụng → tại `directus`: `GET /flows/:id` và `GET /collections/<c>` 200, tạo
      item trong collection 200, `PATCH` tên flow 200; đọc lại cùng flow ở `directus` sau một lượt áp dụng thứ hai đổi tên
      flow từ nguồn → thấy tên mới (cache của Directus đã xóa; FR-029, US6 kịch bản 3, SC-007); `afterAll` xóa flow và
      collection qua Directus.

### Implementation

- [ ] T041 [P] `deploy/README.md` mục "Đồng bộ cấu hình giữa các môi trường (spec 032)" theo FR-040 và quickstart: cùng
      phiên bản, mạng giữa môi trường, `IMPORT_IP_DENY_LIST`, token riêng và đổi sau khi dùng, khuyên https, flow giữ
      `status`, `{{$env.X}}` với `FLOWS_ENV_ALLOW_LIST`, xóa role đình chỉ user, khóa áp dụng.
- [ ] T042 Chạy `pnpm nx run api:lint`, `api:typecheck`, `api:test` (`--maxWorkers=1`; chặn ngưỡng coverage 80 %),
      `api:build`; parity
      `sync/**` (gồm `directus-cross.test.ts`) trên profile `sync` và `sync/route.test.ts` trên Postgres, SQLite; sửa tới
      xanh.
- [ ] T043 Đóng lượt 2: `git add` theo đường dẫn (`apps/api`, `tests/parity`, `deploy/README.md`,
      `specs/032-environment-sync`), commit `feat(api): apply config pulled from another Backoffice environment (spec 032,
      D-214)` kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push khi `main` rảnh; theo dõi CI,
      sửa job đỏ; `graphify update .`; ghi mã commit và run CI vào spec Status.

**Checkpoint**: lượt 2 trên `main`, CI xanh.

## Phase 9: User Story 1 - Trang, probe, form kết nối, bảng so sánh, phần web (Priority: P1, lượt 3)

**Goal**: Settings có mục "Đồng bộ môi trường" khi API là Backoffice; trang kết nối, so sánh và hiện bảng theo nhóm với
chi tiết dòng.

**Independent Test**: unit và browser test; E2E ở Phase 11.

### Tests for User Story 1 (MANDATORY) ⚠️

- [ ] T044 [P] [US1] `web/composables/use-environment-sync.test.ts` (mẫu `use-extension-upload.test.ts`): 200 →
      `available`; 404, lỗi mạng → không; một probe cho mỗi URL API; `_resetEnvironmentSync()` cho test.
- [ ] T045 [P] [US1] `web/modules/settings/components/SettingsNavigation.test.ts` thêm: link `/settings/sync` ở cuối nhóm 1
      khi `available`, không có khi không.
- [ ] T046 [P] [US1] `ss/use-sync.test.ts` phần so sánh: chuyển `phase` (`idle` → `comparing` → `compared`, lỗi về
      `idle`); gửi `url`, `token`, `groups` trong body; `url` và `token` bị xóa khi unmount; không ghi `localStorage`,
      `sessionStorage`; lọc theo trạng thái.
- [ ] T047 [P] [US1] `ss/SyncRoute.test.ts`: các `phase`; lỗi API hiện chuỗi dịch từ `reason`; lệch phiên bản hiện hai
      phiên bản; nhóm thu gọn và mở; mở chi tiết dòng; ô token có `type="password"`, `autocomplete="off"` và không hiện
      lại giá trị sau khi gửi (FR-034, analyze E4); `web/test-utils/fetch.ts` KNOWN_REQUESTS thêm bốn route.

### Implementation for User Story 1

- [ ] T048 [P] [US1] `web/composables/use-environment-sync.ts` (mới): probe `GET /backoffice/sync` theo contracts/web.md.
- [ ] T049 [P] [US1] `web/lang/overlay/en-US.ts`, `vi-VN.ts`: khối `// Spec 032 (D-214)` với các key của contracts/web.md
      ("Environment Sync" / "Đồng bộ môi trường").
- [ ] T050 [US1] `web/modules/settings.ts`: route `settings-sync` (`/settings/sync`) trước `settings-not-found`;
      `SettingsNavigation.vue`: link `{ icon: 'sync_alt', name: t('settings_sync'), to: '/settings/sync' }` cuối nhóm 1
      khi `available`.
- [ ] T051 [US1] `ss/use-sync.ts` (mới): trạng thái trong `ref` của trang, gọi `diff` bằng `requestEndpoint`, lọc.
- [ ] T052 [US1] `ss/components/SyncConnectForm.vue` (BoInput `type="url"`, BoInput `type="password"`
      `autocomplete="off"`, danh sách BoCheckbox nhóm, BoButton So sánh, BoNotice lỗi), `SyncGroup.vue` (BoDetail chứa
      BoTable `showSelect: 'none'`, cột tick tự vẽ qua slot, chip trạng thái có chữ, cột lý do), `SyncRowDetail.vue`
      (BoDialog bảng Field, Nguồn, Đích; JSON trong `<pre>`).
- [ ] T053 [US1] `ss/SyncRoute.vue` (mới): PrivateView với `#navigation` SettingsNavigation, BoTabs lọc trạng thái có số
      dòng, danh sách SyncGroup; chạy T044–T047 xanh.

**Checkpoint**: unit web xanh; mục menu hiện ở `proxy-api` local, ẩn ở `proxy-directus`.

## Phase 10: User Story 2 + User Story 4 - Chọn, xác nhận, kết quả, phần web (Priority: P1/P2, lượt 3)

**Goal**: tick dòng và nhóm với tick kèm và xóa kèm; hộp xác nhận liệt kê đủ; áp dụng và hiện kết quả.

### Tests (MANDATORY) ⚠️

- [ ] T054 [P] [US2] `ss/use-sync.test.ts` phần chọn: tick dòng tick kèm `depends` chưa `same`; bỏ tick bỏ dòng phụ thuộc;
      ô nhóm chỉ chọn dòng `changed` và `source_only` tick được, `indeterminate` khi chọn một phần, không chọn dòng
      `target_only`; dòng `selectable: false` không chọn được; tick xóa tự tick và khóa dòng trong `cascade`.
- [ ] T055 [P] [US4] `ss/SyncRoute.test.ts` thêm hộp xác nhận: số tạo, sửa, xóa theo nhóm; tên dòng xóa và dòng xóa kèm;
      `impact` (item, user bị đình chỉ, permission, file); flow sẽ bật; câu không hoàn tác; nút danger khi có xóa; hủy không
      gửi; lỗi "out of date" có nút So sánh lại; kết quả có `warnings` hiện BoNotice warning.
- [ ] T056 [US1] `ss/SyncRoute.browser.test.ts` (project `browser`, axe): không vi phạm serious ở `idle`, `compared`, hộp
      xác nhận mở, `done`; bàn phím: tick dòng, tick nhóm, mở chi tiết, áp dụng, focus trở về nút đã mở hộp thoại.

### Implementation

- [ ] T057 [US2] `ss/use-sync.ts` + `ss/components/SyncGroup.vue`: logic chọn theo T054; nút "Áp dụng (n)" ở slot
      `#actions` của `SyncRoute.vue`.
- [ ] T058 [US4] `ss/components/SyncConfirmDialog.vue` (mới) theo contracts/web.md; gửi `apply` với `url`, `token`, `hash`,
      `groups`, `selected`.
- [ ] T059 [US2] `ss/components/SyncResult.vue` (mới): số theo nhóm, tên đã xóa, bảng index, `warnings`; `notify`; tải lại
      các store bị ảnh hưởng (collections, fields, relations, permissions, settings, flows); chạy T054–T056 xanh.

**Checkpoint**: unit và browser web xanh.

## Phase 11: E2E ba cấu hình (US1, US2, US4, US6)

- [ ] T060 [P] `e2e/helpers/allowed-paths.ts`: bốn route của `/backoffice/sync`; `e2e/helpers/config.ts`: URL nguồn
      trong mạng Docker (`http://backoffice-api-sync:8055`), URL seed từ máy chạy test (`http://localhost:10856`), token từ
      `tests/parity/env/profile-sync.env`.
- [ ] T061 [P] `.github/workflows/ci.yml` job `e2e-web`: thêm profile `sync` vào lệnh `env-up`; kiểm các API của
      `proxy-api` và `cors` gọi được `backoffice-api-sync` trong cùng mạng compose.
- [ ] T062 `e2e/settings-sync.spec.ts` (mới) theo contracts/tests.md §4: `proxy-directus` không có mục, `/admin/settings/sync`
      là not-found; `proxy-api`, `cors`: seed flow và collection ở nguồn → So sánh → tick → Áp dụng → hộp xác nhận → kết
      quả → thấy trong Flows và Data Model; tải lại trang thì form trống; flow chỉ ở đích → tick xóa → hộp xác nhận nêu tên,
      nút danger → flow biến mất; axe ở `compared`; `afterAll` dọn mọi thứ đã kéo ở đích và seed ở nguồn.
- [ ] T063 Chạy E2E local ba cấu hình (chromium) theo `apps/web-e2e/README`; sửa tới xanh (bài học: đăng nhập mở
      `last_page`; `env-up` lại sau khi sửa web).

**Checkpoint**: E2E ba cấu hình xanh local.

## Phase 12: Polish + đóng lượt 3

- [ ] T064 [P] `design-system/docs/component-specs.md`: recipe `### Environment sync page (Q-49; spec 032, D-214.1, no
      Directus counterpart)` ngay trước `## Acceptance criteria`, theo contracts/web.md, kết bằng dòng "Built: …".
- [ ] T065 [P] `specs/016-settings-module/spec.md`: ghi chú "(032: mục Đồng bộ môi trường trong menu Settings, chỉ khi API
      là Backoffice)" ở phần menu Settings.
- [ ] T066 [P] `CLAUDE.md`: dòng 032 ở Active Technologies → "implemented" với commit và CI; Recent Changes thêm 032;
      `SPECKIT-GUIDE.md` mục 032: Trạng thái và bài học.
- [ ] T067 Đóng spec: `specs/032-environment-sync/spec.md` Status "Done 2026-11-xx, ba lượt (commit, CI)"; bảng "Đánh giá
      hiện trạng" các dòng [Inference] → [Verified] với kết quả T001 và parity; `checklists/requirements.md` ghi chú.
- [ ] T068 Chạy `pnpm nx run web:lint`, `web:typecheck`, `web:test` (unit và browser, chặn ngưỡng coverage 60 %;
      analyze U1), `web:build`, E2E ba cấu hình; sửa tới xanh.
- [ ] T069 Đóng lượt 3: `git add` theo đường dẫn (`apps/web`, `apps/web-e2e`, `.github/workflows/ci.yml`,
      `design-system`, `specs`, `CLAUDE.md`, `SPECKIT-GUIDE.md`), commit `feat(web): environment sync page in Settings
      (spec 032, D-214)` kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push khi `main` rảnh;
      theo dõi CI (web, e2e-web, parity, deploy), sửa job đỏ; `graphify update .`; ghi mã commit và run CI vào spec Status.

**Checkpoint**: lượt 3 trên `main`, CI xanh, spec đóng.

## Dependencies & Execution Order

- **Phase 1 → 2**: T001 chốt R2, R6, R7 cho T012, T032, T038; T002 cho mọi parity của profile `sync`; T003 cho T020;
  T004 cho mọi file `sync/*`.
- **Phase 2 → 3**: T010–T014 trước mọi story (chưa đọc được trạng thái thì không so được).
- **US1 (3)** trước **US5 phía đọc (4)** (từ chối trên luồng diff đã chạy). **US6** (T021, T023) chỉ cần Phase 2;
  T040a cần T032 (apply) nên ở lượt 2.
- **Lượt 2** chỉ bắt đầu sau T027 (lượt 1 trên `main`, CI xanh). **US2 (5)** trước **US3 (6)** (dùng chung
  transaction và `afterCommit`), **US4 (7)** sau 5 (xóa dùng cùng service), **US5 phía ghi (8)** cuối lượt 2.
- **Lượt 3** chỉ bắt đầu sau T043. **Phase 9** trước 10; **Phase 11** sau 9–10; **Phase 12** cuối.
- Trong mỗi story: test ([P]) viết trước và đỏ → implementation → parity hoặc E2E.

## Parallel Example: Phase 2

```text
Song song: T005, T006, T007, T008, T009 (test đỏ) → T010 → T011 ∥ T012 → T013 → T014
```

## Parallel Example: User Story 1 (API)

```text
Song song: T015, T016 (test đỏ) → T018 → T019 → T017 (parity)
```

## Parallel Example: User Story 1 (web)

```text
Song song: T044, T045, T046, T047 (test đỏ) → T048 ∥ T049 → T050 → T051 → T052 → T053
```

## Implementation Strategy

- **MVP** = Phase 1–4: admin gọi `POST /backoffice/sync/diff` và thấy hai môi trường lệch ở đâu, không ghi gì; mọi đường
  từ chối và không dấu vết đã có; Directus 404.
- Tăng dần: lượt 2 thêm áp dụng (dòng, data model, xóa, từ chối phía ghi); lượt 3 thêm trang web, E2E, polish.
- Ba lượt commit; mỗi lượt kết thúc bằng CI xanh trước khi sang lượt sau.
