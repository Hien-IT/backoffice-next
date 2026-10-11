---

description: "Danh sách task cho feature 004: Phân quyền (users, roles, policies, access, permissions)"
---

# Tasks: Phân quyền (users, roles, policies, access, permissions)

**Input**: Tài liệu thiết kế trong `/specs/004-permissions/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md`, `data-model.md`, `contracts/`, `quickstart.md`,
`checklists/permissions-review.md`.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Mọi thay đổi có unit test. Test gốc của Directus đi kèm file port thì port theo (FR-104, research R15).
- Mọi endpoint thêm hoặc sửa có test đối chiếu chạy với cả Directus 11.17.4 thật lẫn app mới (research R13).

**Organization**: Task nhóm theo user story của spec. Phase 1 và 2 là nền chung: thư viện, engine đọc và ghi, module
quyền, năm service, pipeline. US2 (ma trận quyền, P1) đứng sau US3 và US4 vì ma trận cần route CRUD của cả năm
collection.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong).
- **[US#]**: user story của task. Phase 1, 2, 10 và Polish không có nhãn này.
- File port từ `directus/` PHẢI có dòng đầu `// Ported from directus/<đường dẫn nguồn>`. Mỗi task port ghi các cặp
  `{ "source", "dest" }` (source tính từ `directus/`) vào `tools/port-manifest/004-T###.json`, theo đúng ID task.
  Chạy `node tools/check-port-headers.mjs` sau khi ghi. KHÔNG sửa, xóa hay tạo file trong `directus/`.
- Port nguyên vẹn: giữ tên biến, thứ tự câu lệnh, message của Directus để so được khi nâng phiên bản. Chỗ khác nguồn ghi
  `// Backoffice: <lý do>`. Giới hạn tạm ghi `// ponytail: <giới hạn>, <khi nào nâng>`.
- **Khác 003**: giữ nguyên mọi lời gọi `emitter.emitFilter`, `emitter.emitAction` của file gốc; `emitter.ts` là stub
  không phát (D-29, research R8). Không xóa lời gọi.
- **Luôn tái tạo hành vi Directus**, kể cả hành vi không an toàn (Clarifications). Phát hiện hành vi không an toàn mới
  thì thêm dòng R-xx vào bảng "Rủi ro chấp nhận" của spec kèm bằng chứng file và dòng, và một ca thể hiện trong bộ đối
  chiếu; không tự lệch.
- Không đọc `useEnv()` ở cấp module (quy ước 001). Biến Directus mới đọc thì chuyển sang nhóm A trong cùng task.
- Tên biến, comment, commit viết tiếng Anh. Tài liệu viết tiếng Việt.
- Test viết trước và phải fail trước khi làm phần tương ứng (với file port: test gốc port trước, chạy đỏ, rồi port code).
- Quy trình merge thẳng `main`: mỗi nhóm task commit và push xong thì CI phải xanh; `pnpm run ci:local` khi Actions bị
  chặn.

## Quy ước đường dẫn

- API: `apps/api/src/**`. Thư viện: `libs/<tên>/src/**`.
- Test đối chiếu: `tests/parity/src/**` (mới: `tests/parity/src/permissions/**`). Danh sách khác biệt:
  `tests/parity/accepted-differences.ts`.
- E2E app Directus: `tests/directus-app-e2e/**`. Reverse proxy: `tests/parity/proxy/**`.
- Benchmark: `tests/benchmark/**`. Công cụ: `tools/**`. CI: `.github/workflows/**`.
- Nguồn tham chiếu (chỉ đọc): `directus/api/src/**`, `directus/packages/*`, `directus/tests/blackbox/**`.

## Tóm tắt

- Tổng số task: **86**
- Số task đánh dấu [P]: **44**
- Feature lớn (research R16): chia **hai lượt implement** trên cùng branch.
  - Lượt 1: Phase 1 đến 4 (Setup, Foundational, US1, US3), 47 task.
  - Lượt 2: Phase 5 đến 11 (US4, US2, US5, US6, US7, E2E app Directus, Polish), 39 task.
- MVP gợi ý: **Phase 1 đến 5** (US1, US3, US4): năm endpoint CRUD với engine kiểm quyền đầy đủ, fixture blackbox chạy
  được trên app mới. Feature chưa đóng được khi chưa xong US2 (tiêu chí chấp nhận: ma trận quyền).

| Phase | Số task |
|-------|---------|
| Phase 1: Setup | 9 |
| Phase 2: Foundational (engine, module quyền, service, pipeline) | 25 |
| Phase 3: User Story 1 - Accountability cho mọi request (P1) | 4 |
| Phase 4: User Story 3 - Quản trị role, policy, access, permission (P1) | 9 |
| Phase 5: User Story 4 - Quản lý user và hồ sơ (P2) | 7 |
| Phase 6: User Story 2 - Ma trận quyền đọc và ghi (P1) | 7 |
| Phase 7: User Story 5 - Mời và đăng ký (P2) | 4 |
| Phase 8: User Story 6 - Client xem quyền của mình (P2) | 3 |
| Phase 9: User Story 7 - Cache dùng chung (P3) | 4 |
| Phase 10: E2E app Directus qua reverse proxy (FR-106, SC-008) | 7 |
| Phase 11: Polish & Cross-Cutting Concerns | 7 |

---

## Phase 1: Setup (phụ thuộc, lib, cấu hình, hạ tầng test)

**Purpose**: Thêm phụ thuộc cùng bản Directus, port các hàm `@directus/utils` mà engine dùng, chuyển biến môi trường
sang nhóm A, và dựng helper test đối chiếu cho phân quyền.

- [X] T001 Thêm vào `catalog:` của `pnpm-workspace.yaml` đúng bản `directus/pnpm-workspace.yaml`: `snappy: 7.3.3`,
  `ip-matching: 2.1.2`, `'@types/wellknown': 0.5.8` (nếu chưa có). Thêm `snappy`, `ip-matching` vào
  `apps/api/package.json` (types vào devDependencies). Chạy `pnpm install`, `pnpm audit --prod --audit-level=high`;
  build image `docker build -f apps/api/Dockerfile .` để kiểm `snappy` (native) chạy trên alpine; ghi kết quả vào
  "Ghi chú khi làm" (research R1).
- [X] T002 [P] Port sang `libs/utils/src/shared/` kèm test gốc từ `directus/packages/utils/shared/`: `parse-filter.ts`
  (`parseFilter`, `parsePreset`), `parse-now.ts`, `adjust-date.ts`, `get-with-arrays.ts`, `is-dynamic-variable.ts`.
  Export từ `libs/utils/src/shared/index.ts`. Ghi manifest. (sau T001)
- [X] T003 [P] Port sang `libs/utils/src/shared/` kèm test gốc: `validate-payload.ts`, `generate-joi.ts`,
  `inject-function-results.ts`, `functions.ts`, `is-detailed-update-syntax.ts`. Message Joi phải giống Directus
  (`@backoffice/validation` của 003). Export. Ghi manifest. (sau T001)
- [X] T004 [P] Port sang `libs/utils/src/shared/` kèm test gốc: `get-relation-info.ts`, `deep-map.ts`,
  `deep-map-with-schema.ts`, `get-filter-operators-for-type.ts`, `get-functions-for-type.ts`,
  `get-output-type-for-function.ts`, `parse-filter-function-path.ts`, `get-endpoint.ts`, `compress.ts` (nén JSON theo
  key). Export. Ghi manifest. (sau T001)
- [X] T005 [P] `libs/types/src/`: port đủ `services.ts` (`MutationOptions`, `QueryOptions`, `AbstractServiceOptions`...),
  `users.ts`, `events.ts` từ `directus/packages/types/src/` và các kiểu engine dùng còn thiếu (query, permissions,
  accountability `share`, `CollectionAccess`, `Globals`, `GlobalAccess`). Chạy `pnpm nx run-many -t typecheck`. Ghi
  manifest.
- [X] T006 [P] `apps/api/src/config/supported-variables.ts`: chuyển sang nhóm A theo contracts/config.md §1
  (`USER_INVITE_TOKEN_TTL`, `USER_INVITE_URL_ALLOW_LIST`, `USER_REGISTER_URL_ALLOW_LIST`, `REGISTER_STALL_TIME`,
  `EMAIL_VERIFICATION_TOKEN_TTL`, `RATE_LIMITER_REGISTRATION_*`, `QUERY_LIMIT_DEFAULT`, `QUERY_LIMIT_MAX`,
  `MAX_RELATIONAL_DEPTH`, `RELATIONAL_BATCH_SIZE`, `MAX_JSON_QUERY_DEPTH`); đổi mẫu
  `RATE_LIMITER_(?!REGISTRATION_|EMAIL_).+` thành `RATE_LIMITER_(?!EMAIL_).+`. Sửa
  `apps/api/src/config/supported-variables.test.ts` và §5 của `specs/001-platform-foundation/contracts/config.md`.
- [X] T007 [P] Helper đối chiếu cho phân quyền:
  - `tests/parity/src/directus-api.ts`: thêm `appRequest(app: 'directus' | 'backoffice', method, path, body?)` (đăng
    nhập admin của từng app, cache token); giữ `directusRequest` cũ gọi `appRequest('directus', ...)`.
  - `tests/parity/src/permissions/fixtures.ts`: port `CreateRole`, `CreateUser`, `CreatePolicy`, `CreatePermission`
    (ghi lồng `permissions` qua `PATCH /policies/:id`), `DeletePermission` từ `directus/tests/blackbox/common/functions.ts`
    với tham số `app`; thêm cây role ba tầng, policy theo cờ (`admin_access`, `app_access`, `ip_access`,
    `enforce_tfa`), access gắn role, user, public, user theo trạng thái, static token, share (qua API Directus, như T035
    của 003), field tùy biến và collection người dùng (qua `/collections`, `/fields` của Directus), `cleanup()`.
  - Unit test phần không cần Docker trong `tests/parity/src/permissions-helpers.test.ts`.
- [X] T008 [P] `tests/parity/src/permissions/matrix.ts`: sinh ô ma trận FR-101 từ năm danh sách giá trị (không viết
  tay), nhóm theo (accountability, cấu hình permission, `ip_access`) thành 650 nhóm fixture, mỗi nhóm 30 ô (5 action × 6
  collection); bộ request cố định theo action (FR-101 mục 4); chọn shard bằng `PARITY_MATRIX_SHARD=<i>/<n>`; hàm
  `eachChoice()` cho bộ rút gọn (mỗi giá trị của mỗi chiều ít nhất một lần, action `read`, `update`, collection
  `directus_users`). Unit test: đúng 19.500 ô, shard phủ đủ và không trùng, `eachChoice` phủ đủ giá trị
  (`tests/parity/src/permissions-matrix.test.ts`).
- [X] T009 `tests/parity/src/suite.ts`: thêm `src/permissions/**/*.test.ts` vào `FULL_FILES` trừ `matrix.test.ts` và
  `matrix-reduced.test.ts` (Postgres đã chạy shard của ma trận đủ); thêm
  `src/permissions/{matrix-reduced,users,roles,write-rules}.test.ts` vào `REDUCED_FILES`. Thêm target
  `parity-matrix` vào `tests/parity/project.json` (chạy `src/permissions/matrix.test.ts` với `PARITY_MATRIX_SHARD`).
  (sau T007, T008)

**Checkpoint**: `pnpm nx run-many -t test lint typecheck` xanh; lib utils có đủ hàm engine cần.

---

## Phase 2: Foundational (engine đọc và ghi, module quyền, năm service, pipeline)

**Purpose**: Port engine của Directus (Clarifications Q1) và module quyền; thay `ItemsService`, `PayloadService` rút gọn
của 003; `authenticate` cho mọi path; `sanitizeQuery` vào pipeline. Mọi user story dùng phần này.

**⚠️ CRITICAL**: Chưa xong phase này thì không làm user story nào. Kết thúc bằng T034 (chạy lại bộ 001 đến 003).

- [X] T010 [P] Port `database/helpers/{capabilities,number,sequence,fn}/**` (gồm `fn/json/parse-function.ts`, đủ dialect,
  kèm test gốc) sang `apps/api/src/database/helpers/`. Sửa `apps/api/src/database/helpers/index.ts`: `getHelpers()` trả
  `{ date, st, schema, sequence, number, capabilities }`, thêm `getFunctions(knex, schema)`, đúng ánh xạ dialect của
  Directus. Ghi manifest. (sau T004)
- [X] T011 [P] Port đủ `database/helpers/schema/**` (mọi dialect, `utils/prep-query-params.ts`, cả phương thức DDL) và
  `database/helpers/geometry/**` (đủ phương thức `asText`, `fromGeoJSON`, `intersects*`, `collect`...) kèm test gốc, thay
  bản rút gọn của 003 (`formatUUID`) và 001 (`supported`). Ghi manifest. (sau T001)
- [X] T012 [P] Port sang `apps/api/src/` kèm test gốc: `types/ast.ts`, `utils/split-fields.ts`,
  `utils/calculate-field-depth.ts`, `utils/get-field-relational-depth.ts`, `utils/get-column-path.ts`,
  `utils/get-collection-from-alias.ts`, `utils/parse-filter-key.ts`, `utils/parse-numeric-string.ts`,
  `utils/filter-items.ts`, `utils/get-accountability-for-role.ts`. Ghi manifest. (sau T002)
- [X] T013 [P] `apps/api/src/emitter.ts` (`// Backoffice:` stub, research R8): `emitFilter(event, payload, meta,
  context)` trả `payload`, `emitAction(...)` không làm gì, cùng chữ ký với `directus/api/src/emitter.ts`. Test
  `apps/api/src/emitter.test.ts`.
- [X] T014 [P] `apps/api/src/cache.ts`: thêm `setCacheValue`, `getCacheValue` như `directus/api/src/cache.ts:150-170`;
  port `utils/compress.ts` (`snappy` + `compress` của T004). Test: giá trị nén giống byte với vector lấy từ Directus (gửi tới
  Directus của môi trường đối chiếu một request có permission dùng `$CURRENT_USER.<field>`, đọc giá trị
  `filter-context-*` trong Redis, chép vào test cùng đầu vào), và đọc lại được. Ghi manifest. (sau T001, T004)
- [X] T015 [P] Port sang `apps/api/src/permissions/utils/` kèm test gốc: `default-permission.ts`, `merge-fields.ts`,
  `merge-permissions.ts`, `get-unaliased-field-key.ts`, `process-permissions.ts`,
  `extract-required-dynamic-variable-context.ts`. Ghi manifest. (sau T002)
- [X] T016 Port sang `apps/api/src/permissions/modules/` kèm test gốc: `fetch-allowed-fields`, `fetch-allowed-collections`,
  `fetch-inconsistent-field-map`, `fetch-policies-ip-access` (`withCache('policies-ip-access')`),
  `fetch-accountability-collection-access`, `fetch-accountability-policy-globals`,
  `validate-remaining-admin/validate-remaining-admin-users.ts`. Ghi manifest. (sau T015)
- [X] T017 Port `permissions/modules/process-ast/**` (17 file: `process-ast.ts`, `lib/*`, `utils/*` gồm
  `validate-path/*`) kèm 18 file test gốc sang `apps/api/src/permissions/modules/process-ast/`. Message lỗi giữ nguyên
  (contracts/permissions-api.md §5). Ghi manifest. (sau T012, T016)
- [X] T018 Port `database/get-ast-from-query/**` (6 file) kèm 6 file test gốc sang
  `apps/api/src/database/get-ast-from-query/`. Ghi manifest. (sau T012, T016)
- [X] T019 Port `database/run-ast/lib/apply-query/**` (`index.ts`, `filter/*`, `add-join.ts`, `sort.ts`, `search.ts`,
  `aggregate.ts`, `pagination.ts`, `join-filter-with-cases.ts`, `get-filter-path.ts`, `get-operation.ts`, `mock.ts`)
  kèm test gốc sang `apps/api/src/database/run-ast/lib/apply-query/`. Ghi manifest. (sau T010, T011, T012)
- [X] T020 Port phần còn lại của `database/run-ast/**` (`run-ast.ts`, `types.ts`, `README.md`, `lib/get-db-query.ts`,
  `lib/parse-current-level.ts`, `modules/fetch-permitted-ast-root-fields.ts`, `utils/*` gồm `apply-case-when.ts`,
  `merge-with-parent-items.ts`, `generate-alias.ts`) kèm test gốc. Giữ vòng import của Directus (research R4). Ghi
  manifest. (sau T017, T018, T019)
- [X] T021 Port `permissions/modules/process-payload/**` và `permissions/modules/validate-access/**` (gồm
  `lib/validate-item-access.ts`, `lib/validate-collection-access.ts`) kèm test gốc. Ghi manifest. (sau T003, T020)
- [X] T022 Thay `apps/api/src/services/payload.service.ts` bằng bản port đủ của `directus/api/src/services/payload.ts`
  (`processM2O`, `processA2O`, `processO2M` (mảng và `{create, update, delete}`), ghi geometry, `processJsonFunctionResults`,
  import động `get-service`). Thay test bằng `directus/api/src/services/payload.test.ts` (929 dòng), giữ các ca riêng của
  003 còn đúng. Xóa stub `Promise<never>` và comment "feature 005". Ghi manifest. (sau T010, T011, T013)
- [X] T023 Thay `apps/api/src/services/items.service.ts` bằng bản port đủ của `directus/api/src/services/items.ts`
  (1.249 dòng: `getKeysByQuery`, `upsert*`, `updateBatch`, `updateByQuery`, `deleteOne`, `deleteMany`, `deleteByQuery`,
  `upsertSingleton`, `processAst`, `processPayload`, `validateAccess`, `resetAutoIncrementSequence`, emitter stub).
  Nhánh `query.version` khác `main`: ném `Error('versions are not available before feature 008')` với `// ponytail:`
  (research R4). Xóa `notAvailable`, `assertNoPermissionChecks`, `assertFlatPayload`, `keysOfFilter` và mọi chữ "feature
  005" trong header của `items.service.ts`, `settings.service.ts`, `tfa.service.ts`, `users.controller.ts`. Thay test
  bằng `directus/api/src/services/items.test.ts`, giữ ca 003 còn đúng. Ghi manifest. (sau T020, T021, T022)
- [X] T024 [P] Port `directus/api/src/services/access.ts` sang `apps/api/src/services/access.service.ts`; test mới
  `access.service.test.ts` (`knex-mock-client`): cờ toàn vẹn (`UserLimits` khi tạo, `All` khi sửa, xóa), điểm xóa cache
  (luôn xóa cache dữ liệu vì không chuyển `opts`, FR-082). Ghi manifest. (sau T023)
- [X] T025 [P] Port `services/policies.ts` sang `apps/api/src/services/policies.service.ts` (kiểm `ip_access` bằng
  `ip-matching`, chỉ xóa cache quyền khi tạo, xóa cache khi sửa bốn cờ, cờ toàn vẹn); test mới `policies.service.test.ts`
  (giá trị `ip_access` hợp lệ và không hợp lệ, message lỗi, bảng FR-082). Ghi manifest. (sau T023)
- [X] T026 [P] Port `services/permissions.ts` sang `apps/api/src/services/permissions.service.ts` (`readByQuery` thêm
  quyền tối thiểu của app, `getItemPermissions`, xóa cache ở mọi thao tác ghi); test mới `permissions.service.test.ts`.
  Ghi manifest. (sau T023)
- [X] T027 Port `services/presets.ts` sang `apps/api/src/services/presets.service.ts` và `services/roles.ts` sang
  `apps/api/src/services/roles.service.ts` (`validateRoleNesting`, xóa dây chuyền trong một transaction, xóa cache)
  kèm `roles.test.ts` gốc. Ghi manifest. (sau T024)
- [X] T028 Port `utils/get-service.ts` sang `apps/api/src/utils/get-service.ts` với ba nhóm của research R6 (service đã
  có; `ItemsService` chung cho collection hệ thống chưa port service, `// Backoffice:` D-31; `ForbiddenError` cho
  `directus_*` còn lại). Test mới `get-service.test.ts`. Ghi manifest. (sau T024 đến T027)
- [X] T029 Thay bản rút gọn của 002, 003 trong `apps/api/src/permissions/`: `lib/fetch-policies.ts` (qua
  `AccessService`), `utils/fetch-raw-permissions.ts` (qua `PermissionsService`, `lib/with-app-minimal-permissions.ts`),
  `lib/fetch-permissions.ts` (biến động, share), `utils/fetch-dynamic-variable-data.ts` (cache dữ liệu
  `filter-context-*`, T014), `utils/fetch-share-info.ts` (`withCache('share-info')`), `utils/get-permissions-for-share.ts`;
  kèm test gốc (`fetch-permissions`, `fetch-policies`, `with-app-minimal-permissions`, `fetch-dynamic-variable-data`,
  `get-permissions-for-share`). Key cache giữ đúng công thức của 002 (contracts/cache.md §1, R-01). Ghi manifest. (sau
  T014, T026, T028)
- [X] T030 Port `services/meta.ts` sang `apps/api/src/services/meta.service.ts` kèm `meta.test.ts` gốc (499 dòng). Ghi
  manifest. (sau T019, T021)
- [X] T031 Port `utils/sanitize-query.ts`, `utils/validate-query.ts` sang `apps/api/src/utils/` kèm test gốc. Ghi
  manifest. (sau T029)
- [X] T032 Port `middleware/sanitize-query.ts`, `middleware/validate-batch.ts` (thành hàm async
  `validateBatch(scope)(req)`, `// Backoffice:` research R3), `middleware/use-collection.ts` (hàm) sang
  `apps/api/src/middleware/`, kèm `validate-batch.test.ts` gốc chuyển sang hàm. Ghi manifest. (sau T031)
- [X] T033 Pipeline (research R2, FR-001, FR-005):
  - `apps/api/src/app-pipeline.ts`: thay nhánh chọn theo path bằng `app.use(authenticate)` cho mọi path (sau
    `/server/ping`); thêm `sanitizeQuery` ngay sau `schema`, trước `checkCacheMiddleware`; xóa
    `apps/api/src/middleware/public-accountability.ts` và test của nó (D-10, cảnh báo D-18).
  - Sửa `apps/api/src/app-pipeline.test.ts` (bỏ ca cảnh báo "token bị bỏ qua"; thêm ca token tới `/server/info`,
    `?limit=abc` → `400 INVALID_QUERY`).
  - `tests/parity/accepted-differences.ts`: D-12 thu hẹp còn `export` (`excludeEndpoints` hoặc `directus` matcher theo
    query `export`); chạy `src/accepted-differences.test.ts`. (sau T032)
- [X] T034 Checkpoint (FR-105): chạy toàn bộ unit test, rồi `pnpm nx run parity-tests:parity --vendor=postgres` (bộ
  `full` của 001 đến 003, kể cả `src/auth/**`) và `reduced` trên MySQL, SQLite. Sửa lỗi do engine mới cho tới khi xanh;
  ca nào đổi kết quả do D-10, D-12 được gỡ thì sửa test cho đúng Directus. Ghi số ca và thời gian vào "Ghi chú khi làm".
  (sau T033)

**Checkpoint**: engine đủ, mọi request có accountability thật; bộ đối chiếu 001 đến 003 xanh trên ba vendor.

---

## Phase 3: User Story 1 - Mọi request chạy với đúng accountability như Directus (Priority: P1) 🎯 MVP

**Goal**: Token được nhận ở mọi route; `/users/me`, `/roles/me`, `/policies/me/globals` giống Directus; route của 001
xử lý token như Directus.

**Independent Test**: spec US1.

### Tests for User Story 1

- [X] T035 [P] [US1] `tests/parity/src/permissions/accountability.test.ts`: US1.1 đến US1.7 (cây role ba tầng, admin qua
  policy gắn user, gỡ admin khi token còn hạn, đổi role khi token còn hạn và với static token, share `GET /users/me`),
  với token JWT ba chế độ, static token, share, không token. Dùng `scenario()` khi đổi dữ liệu.
- [X] T036 [P] [US1] Sửa `tests/parity/src/server/errors.test.ts` (bỏ `/users` khỏi danh sách "chưa làm"; token sai tới
  route 001 nay `401`/`403` như Directus) và thêm `tests/parity/src/permissions/server-routes.test.ts`: `/server/info`,
  `/server/health`, `/metrics`, `/server/specs/oas` với token admin, user thường, token sai, token hết hạn (US1.4, US1.5,
  FR-004), path trước `authenticate` (`/`, `/robots.txt`, `/server/ping`) bỏ qua token sai.

### Implementation for User Story 1

- [X] T037 [US1] Route `me`:
  - `apps/api/src/controllers/users.controller.ts`: `GET /users/me` (share → `{share}`, không user → `401`, `FORBIDDEN`
    khi đọc → `{id}`) dùng `UsersService.readOne` và `req.sanitizedQuery`.
  - `apps/api/src/controllers/roles.controller.ts` (mới): `GET /roles/me` (FR-044).
  - `apps/api/src/controllers/policies.controller.ts` (mới): `GET /policies/me/globals` (FR-046).
  - Đăng ký trong `apps/api/src/app.module.ts`; factory `RolesService`, `PoliciesService` trong `providers.ts`;
    `Allow` của ba path trong `middleware/router-options.ts`.
  - Test controller supertest trên SQLite (`createDirectusDb()`): `apps/api/src/controllers/{roles,policies}.controller.test.ts`
    và ca mới trong `users.controller.test.ts`. (sau T034)
- [X] T038 [US1] `tests/parity/accepted-differences.ts`: D-10 thêm `excludeEndpoints` phủ mọi route (giữ entry tới khi
  004 Done vì guard bắt mã 001); D-09.2 loại `GET /users/me`, `GET /roles/me`, `GET /policies/me/globals`. Sửa cột "App
  mới" của D-10 trong `specs/001-platform-foundation/spec.md` ("từ feature 004 mọi route xử lý token như Directus").
  Chạy guard. (sau T035 đến T037)

**Checkpoint**: T035, T036 đạt trên Postgres; T035 đạt trên MySQL, SQLite.

---

## Phase 4: User Story 3 - Quản trị role, policy, access và permission qua API (Priority: P1)

**Goal**: CRUD `/roles`, `/policies`, `/access`, `/permissions` giống Directus, gồm ghi lồng và các quy tắc riêng.

**Independent Test**: spec US3.

### Tests for User Story 3

- [X] T039 [P] [US3] `tests/parity/src/permissions/roles.test.ts`: CRUD mọi dạng (`POST` một và mảng, `GET`, `SEARCH` bỏ
  qua `keys`, `GET /:pk` không có nhánh `me`, `PATCH` mảng, `{keys,data}`, `{query,data}`, `DELETE` mảng, `{keys}`,
  `{query}`), US3.1 (hai message vòng), US3.2 (xóa dây chuyền, so DB bằng `captureDbEffects`), ghi lồng `users`,
  `policies`, `children`, `OPTIONS`, lỗi `validateBatch`, `MAX_BATCH_MUTATION`.
- [X] T040 [P] [US3] `tests/parity/src/permissions/policies.test.ts`: CRUD, US3.4 (`ip_access` hợp lệ, `*`, mask, kiểu
  sai), US3.5 (`PATCH /policies/:id` với `permissions: {create, update, delete}`), US3.3 (xóa policy admin cuối, đặt
  `admin_access=false` → `422`, DB không đổi), `SEARCH` có `keys`, `GET /policies/me` (`204`, FR-047).
- [X] T041 [P] [US3] `tests/parity/src/permissions/access.test.ts`: CRUD, dòng public (`role`, `user` đều `null`), cả
  `role` và `user`, gỡ access của policy admin cuối → `422`, `GET /access/me` → `204`.
- [X] T042 [P] [US3] `tests/parity/src/permissions/permissions.test.ts`: CRUD và batch, US3.7 (`limit` luôn `-1`, `meta`),
  US2.8 (user `app` thấy quyền tối thiểu của app, `id: null`), `GET /permissions/<pk kết thúc bằng me>` → `204`.
- [X] T043 [P] [US3] `tests/parity/src/permissions/blackbox-common.test.ts`: port phần `createRole()` (3 ca) của
  `directus/tests/blackbox/common/common.test.ts` lên `scenario()`, fixture chạy bằng API của từng app (FR-100).

### Implementation for User Story 3

- [X] T044 [US3] `apps/api/src/controllers/roles.controller.ts`, `access.controller.ts`: đủ route CRUD theo thứ tự đăng
  ký của `directus/api/src/controllers/{roles,access}.ts` (contracts/permissions-api.md §1), `@Search()`,
  `@HttpCode(200)` cho `POST`, `validateBatch` dạng hàm, đọc lại sau ghi (`FORBIDDEN` → `204`), `MetaService` cho
  danh sách, nhánh `endsWith('me')` của access trả `204` (FR-047). Test controller supertest. Ghi manifest. (sau T037)
- [X] T045 [US3] `apps/api/src/controllers/policies.controller.ts`, `permissions.controller.ts`: đủ route CRUD như T044;
  `/permissions` luôn `limit: -1` (cả `meta`), `req.singleton`. Factory `AccessService`, `PermissionsService`,
  `MetaService` trong `providers.ts`; đăng ký controller. Test controller supertest. Ghi manifest. (sau T044)
- [X] T046 [US3] `apps/api/src/middleware/router-options.ts`: `Allow` của `/roles`, `/policies`, `/access`,
  `/permissions` và path con theo contracts/permissions-api.md §3; test `router-options.test.ts`. (sau T045)
- [X] T047 [US3] `tests/parity/accepted-differences.ts`: D-09.2 loại route của `/roles`, `/policies`, `/access`,
  `/permissions` (trừ `/permissions/me*`, US6). Sửa tới khi T039 đến T043 đạt; chạy guard. (sau T039 đến T046)

**Checkpoint**: Lượt 1 xong. T039 đến T043 đạt trên Postgres; `roles.test.ts` đạt trên MySQL, SQLite. Commit, push, CI
xanh trước lượt 2.

---

## Phase 5: User Story 4 - Quản lý user và hồ sơ của chính mình (Priority: P2)

**Goal**: CRUD `/users`, `PATCH /users/me`, `track/page`, bật tắt TFA; quy tắc riêng của `directus_users`.

**Independent Test**: spec US4.

### Tests for User Story 4

- [X] T048 [P] [US4] `tests/parity/src/permissions/users.test.ts`: CRUD mọi dạng, `SEARCH` bỏ qua `keys`, US4.1 đến US4.8,
  FR-053 (admin đổi mật khẩu user khác; user tự đổi bằng token `json` mất mọi session; chế độ `session` giữ session hiện
  tại), FR-052, FR-054 (`422`; `LIMIT_EXCEEDED` ở profile mới `user-limits`), static token đặt qua `/users` dùng được ở
  cả hai app (FR-051), chính sách mật khẩu rỗng, bọc `/.../`, regex sai (FR-051), `status` ngoài danh sách lựa chọn
  (FR-055), `GET /users/some` → `204`. Profile `user-limits` tạo trong task này:
  - cặp `directus-user-limits` (8855), `backoffice-api-user-limits` (8856) trong `tests/parity/docker-compose.yml`, theo
    mẫu cặp `ratelimit`; `tests/parity/env/profile-user-limits.env`: `USERS_ADMIN_ACCESS_LIMIT=2`,
    `USERS_APP_ACCESS_LIMIT=3`, `USERS_API_ACCESS_LIMIT=2`;
  - thêm vào `ALL_PROFILES` (`scripts/env.mjs`), `src/config.ts`, `src/profiles.ts`, `src/global-setup.ts`, và danh sách
    profile của dòng Postgres trong `.github/workflows/ci.yml`;
  - ca giới hạn đếm user `active` hiện có, tạo thêm tới khi vượt từng giới hạn, chạy tuần tự, dọn ở `afterAll`.
- [X] T049 [P] [US4] `tests/parity/src/permissions/tfa-toggle.test.ts`: FR-048 (secret sinh ở bên này bật ở bên kia theo
  hai chiều, lỗi `TFA Secret is already set...`, `"otp" is invalid`, user chưa bật TFA, `/users/:pk/tfa/disable` không
  phải admin → `403`, user không admin cần quyền `update` field `tfa_secret`). Sửa `tests/parity/src/auth/tfa.test.ts`
  (ba route không còn `404`).
- [X] T050 [P] [US4] `blackbox-common.test.ts`: thêm phần `createUser()` (4 ca). Chạy lại nguyên bản các khẳng định
  `/users/me` của `tests/parity/src/auth/{sso-ldap,login,refresh}.test.ts` đã kiểm qua Directus ở 003, đổi về app mới
  (FR-100).

### Implementation for User Story 4

- [X] T051 [US4] `apps/api/src/services/users.service.ts`: port phần còn lại của `directus/api/src/services/users.ts`
  trừ mời và đăng ký: `deleteMany` (`validateRemainingAdminUsers`, đặt `null` ba khóa ngoại, xóa session), đúng
  `updateMany` theo FR-053; port các ca còn thiếu của `users.test.ts` gốc. Ghi manifest. (sau T034)
- [X] T052 [US4] `apps/api/src/controllers/users.controller.ts`: đủ route CRUD như T044, `PATCH /users/me`,
  `PATCH /users/me/track/page` (`UsersService` không accountability, `autoPurgeCache: false`), nhánh `endsWith('me')` →
  `204`; `Allow` trong `router-options.ts`; test controller supertest. (sau T045, T051)
- [X] T053 [US4] `apps/api/src/services/tfa.service.ts`: port `enableTFA`, `disableTFA`; route `POST /users/me/tfa/enable`,
  `POST /users/me/tfa/disable`, `POST /users/:pk/tfa/disable` trong `users.controller.ts` (thứ tự và dấu `/` cuối như
  file gốc); test. Sửa ô "Gỡ khi" của D-09.10 trong `specs/003-auth-session/spec.md` thành `004`, xóa entry D-09.10 khỏi
  `tests/parity/accepted-differences.ts`; chạy guard. Ghi manifest. (sau T052)
- [X] T054 [US4] `tests/parity/accepted-differences.ts`: D-09.2 loại mọi route `/users` đã làm. Sửa tới khi T048 đến T050
  đạt. (sau T048 đến T053)

**Checkpoint**: năm endpoint có đủ CRUD; fixture blackbox chạy được trên app mới (MVP).

---

## Phase 6: User Story 2 - Quyền đọc và ghi được áp dụng giống hệt Directus (Priority: P1)

**Goal**: Ma trận quyền tích đầy đủ (FR-101) đạt 100% (SC-001).

**Independent Test**: spec US2; SC-001.

### Tests for User Story 2

- [X] T055 [P] [US2] `tests/parity/src/permissions/read-rules.test.ts`: US2.1, US2.2 (`CASE WHEN`), US2.3 (`$NOW(-1 day)`,
  dữ liệu cách xa ranh giới), US2.6, US2.7, US2.8, FR-020 đến FR-023 (field quan hệ không được đọc bị bỏ khi mở rộng
  `*`, thứ tự mặc định khi không `sort`, `meta` cho người không admin), FR-016 (bảng lọc IP).
- [X] T056 [P] [US2] `tests/parity/src/permissions/write-rules.test.ts`: US2.4, US2.5, FR-030 đến FR-035 (preset theo thứ
  tự policy, validation AND, `_submitted`, field không cho phép, ghi lồng kiểm từng tầng theo FR-037, tự sửa `role`, sửa
  và xóa khóa không tồn tại theo FR-036), FR-017 (bảng gộp), FR-005 (thứ tự
  lỗi khi nhiều lỗi), ghi nhiều item nguyên tử, so DB bằng `captureDbEffects`.
- [X] T057 [P] [US2] `tests/parity/src/permissions/query.test.ts`: FR-040 trên năm endpoint với admin và user có quyền một
  phần: `fields` (wildcard, lồng m2o, o2m, alias), `filter` (mọi nhóm toán tử, `_some`, `_none`, hàm ngày giờ, qua quan
  hệ), `search`, `sort`, `limit`, `offset`, `page`, `meta`, `aggregate`, `groupBy`, `deep`, `backlink`, cú pháp `qs` và
  JSON, `SEARCH` với `body.query`; các ca `400 INVALID_QUERY` của `validateQuery`.

### Implementation for User Story 2

- [X] T058 [US2] `tests/parity/src/permissions/matrix.test.ts`: chạy các ô của shard hiện tại (`PARITY_MATRIX_SHARD`), ô
  đọc bằng `parity()`, ô ghi bằng `scenario()` + `captureDbEffects`, kèm ca riêng FR-035, US1.7, R-01. Đo thời gian một
  nhóm fixture, chọn số shard `n` để mỗi shard dưới 60 phút, ghi `n` và tổng phút của một lần chạy đủ vào "Ghi chú khi làm".
  (sau T008, T047, T054)
- [X] T059 [US2] `tests/parity/src/permissions/matrix-reduced.test.ts`: ô của `eachChoice()` (T008), chạy trong bộ
  `reduced` trên MySQL, SQLite. (sau T058)
- [X] T060 [US2] CI cho ma trận (SC-001, Clarifications khi analyze):
  - `.github/workflows/ci.yml`: job `parity-matrix-rotating` (Postgres, timeout 60 phút, `api:build` + `env-up` như job
    `parity`) chạy một shard `PARITY_MATRIX_SHARD=$(( ${{ github.run_number }} % n + 1 ))/n` (bash) mỗi lần push; thêm vào `needs` của
    `publish`.
  - `.github/workflows/parity-matrix.yml` (mới): `workflow_dispatch` và lịch hằng tuần; job `parity-matrix`
    (`strategy.matrix.shard: [1..n]`, `fail-fast: false`, timeout 60 phút) chạy đủ mọi shard; không chặn `publish`.
  - `tools/ci-local.sh`: bước chạy một shard; thêm lệnh chạy đủ ma trận vào `quickstart.md` §1. (sau T058)
- [X] T061 [US2] Sửa engine, module quyền, service cho tới khi T055 đến T059 đạt 100% trên ba vendor. Mỗi lệch do hành vi
  Directus không an toàn: tái tạo và thêm R-xx vào spec (quy ước); mỗi lệch khác: sửa app mới, không chuẩn hóa trong
  test. Ghi danh sách lỗi đã sửa vào "Ghi chú khi làm". (sau T055 đến T059)

**Checkpoint**: SC-001 đạt; tiêu chí chấp nhận của feature có bằng chứng.

---

## Phase 7: User Story 5 - Mời user và tự đăng ký, không gửi email (Priority: P2)

**Goal**: `/users/invite`, `/users/invite/accept`, `/users/register`, `/users/register/verify-email` giống Directus, log
thay email.

**Independent Test**: spec US5.

- [X] T062 [P] [US5] `tests/parity/src/permissions/invite-register.test.ts`: US5.1 đến US5.8, token mời và token xác minh
  ký ở bên này dùng ở bên kia theo hai chiều (test tự ký token theo định dạng Directus vì không có email), thời gian chờ
  `REGISTER_STALL_TIME` ở đúng nhánh (SC-009), mọi dòng của bảng lỗi token ở FR-062, FR-064, mời nhiều email có email
  lỗi ở giữa (FR-060), log `warn` có email, không có token. Limiter đăng ký mặc định bật và dùng
  chung Redis ở môi trường đối chiếu (`RATE_LIMITER_STORE=redis`): mỗi ca gửi header `X-Forwarded-For` riêng (ví dụ
  `10.44.<số ca>.1`; `IP_TRUST_PROXY` mặc định `true` nên `req.ip` lấy từ header) để có bộ đếm `rlflx:<ip>` riêng; ca
  `429` dùng một IP riêng, gửi 6 lần trong 60 giây ở hai app xen kẽ, so status và `Retry-After`. Đổi settings đăng ký thì trả lại ở
  `afterAll`.
- [X] T063 [US5] `apps/api/src/services/users.service.ts`: port `inviteUrl`, `inviteUser`, `acceptInvite`; thay
  `mailService.send` bằng log `warn` theo research R9 (D-27); test ca gốc của `users.test.ts` (mời, mời lại, đổi role,
  `acceptInvite` lỗi). Ghi manifest. (sau T051)
- [X] T064 [US5] Port `registerUser`, `verifyRegistration` (log thay email, D-28) và
  `middleware/rate-limiter-registration.ts` (limiter tạo ở request đầu, đọc env trong hàm, research R11) kèm test. Ghi
  manifest. (sau T063)
- [X] T065 [US5] Route `POST /users/invite`, `POST /users/invite/accept`, `POST /users/register` (sau `checkRateLimit`),
  `GET /users/register/verify-email` (chuyển hướng) trong `users.controller.ts`, `Allow` trong `router-options.ts`, test
  controller. Thêm entry `doc` D-27, D-28 (feature `004`) vào `tests/parity/accepted-differences.ts`; chạy guard. Sửa tới
  khi T062 đạt. (sau T052, T064)

---

## Phase 8: User Story 6 - Client xem quyền của chính mình (Priority: P2)

**Goal**: `/permissions/me`, `/permissions/me/:collection/:pk?`, `/policies/me/globals` giống Directus.

**Independent Test**: spec US6.

- [X] T066 [P] [US6] `tests/parity/src/permissions/me.test.ts`: US6.1 đến US6.5 với các user của ma trận (admin, user
  quyền một phần, public, share, policy có `enforce_tfa` qua role cha và gắn user, policy `enforce_tfa` bị lọc IP),
  singleton `directus_settings`.
- [X] T067 [P] [US6] `tests/parity/src/permissions/check-item-permissions.test.ts`: port
  `directus/tests/blackbox/tests/db/routes/permissions/check-item-permissions.{test,seed}.ts` (collection người dùng tạo
  qua API Directus, permission tạo bằng fixture `CreatePermission` của từng app).
- [X] T068 [US6] `apps/api/src/controllers/permissions.controller.ts`: `GET /permissions/me`
  (`fetchAccountabilityCollectionAccess`, `403` khi không user, role, share), `GET /permissions/me/:collection/:pk?`
  (`getItemPermissions`), đăng ký trước `GET /:pk` như file gốc; `Allow`; test controller. D-09.2 loại hai route này.
  Sửa tới khi T066, T067 đạt. (sau T045)

---

## Phase 9: User Story 7 - Cache quyền dùng chung Redis với Directus (Priority: P3)

**Goal**: Cùng key, cùng giá trị, cùng điểm xóa cache với Directus (FR-080 đến FR-085, SC-003, SC-004).

**Independent Test**: spec US7.

- [X] T069 [P] [US7] `tests/parity/src/schema/permissions-cache.test.ts`: so key và giá trị của đủ 8 namespace (thêm
  `policies-ip-access` nay không bỏ qua, `share-info`) và `filter-context-*` (khi `CACHE_ENABLED=true`) sau cùng request ở
  mỗi app, cache trống trước mỗi lần (SC-004).
- [X] T070 [P] [US7] `tests/parity/src/permissions/cache-cross.test.ts`: mỗi dòng bảng FR-082 (kể cả qua ghi lồng) ở mỗi
  app, kiểm key `permissions:*` và `<CACHE_NAMESPACE>:*` bị xóa; SC-003: request tới app kia từ 200 ms sau response dùng
  quyền mới, 20 lần mỗi chiều; FR-083 (`track/page` không xóa cache dữ liệu).
- [X] T071 [P] [US7] `tests/parity/src/redis-down.test.ts`: thêm ca FR-085 (request cần quyền và thao tác ghi quyền khi
  Redis không dùng được) so status, mã lỗi với Directus; DB sau thao tác ghi giống nhau.
- [X] T072 [US7] Unit test FR-084 trong `apps/api/src/permissions/cache.test.ts` và `apps/api/src/cache.test.ts` (store
  `memory`, không Redis: xóa cache của chính process, phát `schemaChanged` local). Sửa app mới tới khi T069 đến T072 đạt.

---

## Phase 10: E2E app Directus qua reverse proxy (FR-106, SC-008)

**Purpose**: Cổng CI mới: app Directus 11.17.4 chạy qua proxy (route 001 đến 004 vào app mới) làm được mọi thao tác quản
trị user, role, policy, quyền với cùng tác động DB như khi chỉ có Directus (contracts/proxy-e2e.md).

- [X] T073 Reverse proxy: `tests/parity/proxy/backoffice-routes.txt` (`auth`, `server`, `metrics`, `users`, `roles`,
  `policies`, `access`, `permissions`), `tests/parity/proxy/nginx.conf.template`, `tests/parity/scripts/proxy-conf.mjs`
  (sinh `nginx.conf`, unit test trong `tests/parity/src/proxy-conf.test.ts`), service `proxy` (profile `app`,
  `nginx:1.27-alpine`, cổng `8160`, log có `$upstream_addr`) trong `tests/parity/docker-compose.yml`; thêm `app` vào
  `ALL_PROFILES` (`scripts/env.mjs`), `src/config.ts`, `src/profiles.ts`, `src/global-setup.ts`.
- [X] T074 [P] Dự án `tests/directus-app-e2e` theo mẫu `apps/web-e2e`: `project.json` (target `e2e`),
  `playwright.config.ts` (`BASE_URL` bắt buộc, chromium, `retries: 1` ở CI), `package.json` (`@playwright/test`, `knex`,
  `pg` qua `catalog:`), `tsconfig.json`; helper `src/helpers/login.ts`, `src/helpers/db-rows.ts` (chụp và chuẩn hóa dòng
  mới của bảy bảng, như `db-effects` của 003), `src/helpers/proxy-log.ts`. Thêm vào `pnpm-workspace.yaml` nếu cần.
- [X] T075 `tests/directus-app-e2e/src/login.spec.ts` và `routing.spec.ts`: đăng nhập qua proxy, app nạp xong; mọi request
  tới route trong danh sách đi vào app mới, route khác vào Directus. Ghi các route app gọi ngoài contracts/proxy-e2e.md §1
  vào "Ghi chú khi làm". (sau T073, T074, T054)
- [X] T076 [P] `tests/directus-app-e2e/src/users.spec.ts`: tạo, sửa, mời, xóa user qua module User; chạy với `BASE_URL`
  proxy rồi Directus, so dòng DB. (sau T075, T065)
- [X] T077 [P] `tests/directus-app-e2e/src/roles.spec.ts`: tạo role, đặt `parent`, gán policy, xóa. So DB như T076. (sau
  T075)
- [X] T078 [P] `tests/directus-app-e2e/src/policies.spec.ts`: tạo policy app access, thêm permission có filter
  `$CURRENT_USER`, field một phần, preset; gán user; đổi tên; xóa. So DB như T076. (sau T075)
- [X] T079 `.github/workflows/ci.yml`: job `e2e-directus-app` (timeout 30 phút; `api:build`, `env-up --vendor=postgres
  --profiles=app`, `playwright install --with-deps chromium` trong `tests/directus-app-e2e`, `nx run
  directus-app-e2e:e2e`, log container khi lỗi, `env-down`), thêm vào `needs` của `publish`; `tools/ci-local.sh` thêm
  bước. (sau T076 đến T078)

---

## Phase 11: Polish & Cross-Cutting Concerns

- [X] T080 [P] `tests/parity/src/request-set.ts`, `db-unchanged.test.ts`, `readonly-account.test.ts` (FR-091): thêm
  `GET`/`SEARCH` của năm endpoint, route `me`, `OPTIONS`, request bị chặn trước bước ghi (contracts/db-writes.md §7) với
  static token của một user tạo trước khi chụp DB.
- [X] T081 [P] `tests/parity/src/observability/logs.test.ts` (FR-092): sau mời, đăng ký, xác minh, bật tắt TFA, đổi mật
  khẩu, log của app mới không chứa mật khẩu, static token, `tfa_secret`, OTP, token mời, token xác minh; revision có
  `**********` ở field `conceal`.
- [X] T082 [P] Benchmark SC-006 (research R14): `tests/benchmark/src/seed-permissions.ts`, `tests/benchmark/src/permissions.ts`,
  target `permissions` trong `tests/benchmark/project.json`, job `benchmark-permissions` trong
  `.github/workflows/benchmark.yml` (hằng tuần, bấm tay, không chặn `publish`). Chạy một lần; ghi số liệu vào "Ghi chú
  khi làm".
- [X] T083 [P] Đồng bộ bảng khác biệt (research R10): `specs/001-platform-foundation/spec.md` (D-09.6 thêm query `version`;
  D-11 nay gồm `GET` của năm endpoint; D-12 chỉ còn `export`); `tests/parity/accepted-differences.ts` thêm entry `doc`
  D-29, D-30, D-31 (feature `004`); chạy guard.
- [X] T084 [P] `SPECKIT-GUIDE.md`: sửa bảng lộ trình và prompt của feature 005 (005 không còn port engine; chỉ `/items`,
  singleton, response cache, `export`, event, bus `websocket.event`, blackbox items, query, relational) theo Assumptions
  của spec.
- [X] T085 Chạy quickstart.md §1 đến §3 trên môi trường đối chiếu; sửa quickstart nếu lệch. Cập nhật
  `tests/parity/README.md` (profile `app`, `appRequest`, ma trận và shard, proxy). Chạy `graphify update .`.
- [ ] T086 Đóng feature: CI xanh mọi job (gồm `parity-matrix-rotating`, `e2e-directus-app`), một lần chạy đủ
  `parity-matrix.yml` xanh (SC-001), coverage ≥ 80% cho `apps/api`,
  `libs/utils`, `libs/types`; xóa entry D-09.2, D-10 khỏi `tests/parity/accepted-differences.ts`; `spec.md`
  `Status: Done`; tech lead duyệt D-27 đến D-31, R-01 đến R-06 và các sửa bảng 001, 003 (Nguyên tắc X); cập nhật memory
  dự án. (sau tất cả)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: không phụ thuộc. T002 đến T008 sau T001 (T005 đến T008 không cần T001 nhưng chạy sau để có lockfile
  ổn định). T009 sau T007, T008.
- **Foundational (Phase 2)**: sau Phase 1. Chặn mọi user story. Chuỗi chính: T012, T015 → T016 → T017, T018 → T019 → T020
  → T021 → T023 → T024 đến T027 → T028 → T029 → T031 → T032 → T033 → T034.
- **US1 (Phase 3)**: sau T034.
- **US3 (Phase 4)**: sau US1 (controller `roles`, `policies` tạo ở T037).
- **US4 (Phase 5)**: sau T034; T052 sau T045 (dùng chung khuôn controller).
- **US2 (Phase 6)**: sau US3 và US4 (ma trận cần CRUD của năm collection).
- **US5 (Phase 7)**: sau T051, T052.
- **US6 (Phase 8)**: sau T045.
- **US7 (Phase 9)**: sau US3, US4.
- **E2E (Phase 10)**: sau US3, US4, US5 (kịch bản mời user).
- **Polish (Phase 11)**: sau mọi story; T086 cuối cùng.

### Within Each User Story

- Test viết trước và fail trước khi làm.
- Service trước controller; controller trước `accepted-differences.ts`.
- Story xong khi test đối chiếu đạt trên Postgres (và MySQL, SQLite với file trong `REDUCED`).

### Parallel Opportunities

- Phase 1: T002 đến T008 song song sau T001.
- Phase 2: T010 đến T015 song song; T017 và T018 song song; T024 đến T026 song song; T030 song song với chuỗi T028 → T029.
- Test của mỗi story (đánh dấu [P]) viết song song.
- Sau lượt 1: US4, US6 làm song song; US5, US7 song song sau US4; Phase 10 song song với US2 khi đủ người.

---

## Parallel Example: Phase 2

```bash
# Nền song song sau Phase 1:
Task: "T010 helpers capabilities, number, sequence, fn"
Task: "T011 helpers schema, geometry"
Task: "T012 types/ast.ts và util query"
Task: "T013 emitter stub"
Task: "T014 setCacheValue, getCacheValue, compress"
Task: "T015 permissions utils"

# Service song song sau T023:
Task: "T024 AccessService"
Task: "T025 PoliciesService"
Task: "T026 PermissionsService"
```

## Parallel Example: User Story 3

```bash
Task: "T039 roles.test.ts"
Task: "T040 policies.test.ts"
Task: "T041 access.test.ts"
Task: "T042 permissions.test.ts"
Task: "T043 blackbox-common.test.ts (createRole)"
```

---

## Implementation Strategy

### Lượt 1 (Phase 1 đến 4)

1. Phase 1: Setup.
2. Phase 2: Foundational. Commit theo nhóm (lib, helper, module quyền, engine, service, pipeline); T034 phải xanh.
3. Phase 3: US1. Phase 4: US3.
4. **STOP and VALIDATE**: T035, T036, T039 đến T043 đạt trên Postgres; T035, `roles.test.ts` đạt trên MySQL, SQLite.
   Commit, push, CI xanh.

### Lượt 2 (Phase 5 đến 11)

1. US4 (MVP: năm endpoint đủ CRUD).
2. US2: ma trận tích đầy đủ (shard xoay vòng mỗi push, đủ ma trận ở `parity-matrix.yml`); đây là tiêu chí chấp nhận.
3. US5, US6, US7.
4. Phase 10: E2E app Directus, cổng CI mới.
5. Polish, đóng feature (T086).

---

## Notes

- Test đối chiếu luồng ghi dùng `scenario()` với fixture riêng mỗi app (`appRequest`); luồng chỉ đọc có thể tạo
  fixture qua Directus.
- Môi trường đối chiếu bật `CACHE_ENABLED=true`, `CACHE_AUTO_PURGE=true`: đọc trạng thái để so từ DB, không qua
  `GET` của Directus khi dữ liệu vừa ghi bằng knex (bài học T044 của 003); gọi `flushSharedCaches()` giữa hai lần chụp khi
  so giá trị tính toán.
- Trên SQLite của CI Linux, test không ghi DB từ host; fixture tạo qua API.
- Directus chạy giả lập amd64 trên máy arm64: test thời gian (T062) chỉ tin kết quả trên CI.
- Ma trận (T058) có thể tốn nhiều phút CI; theo dõi hạn mức GitHub Actions (đã bị chặn vì hạn mức ngày 2026-10-11).

## Ghi chú khi làm

- T001: thêm `snappy` 7.3.3, `ip-matching` 2.1.2 vào catalog và `apps/api`. `pnpm audit --prod --audit-level=high` không đổi
  so với trước (không có cảnh báo mới). Image `apps/api/Dockerfile` build được; trong container `require('snappy')` nén
  được và `ip-matching` chạy.
- T002 đến T004: code gốc của Directus không qua typecheck strict của repo ở hai chỗ: `functions.ts` và
  `get-output-type-for-function.ts` khai báo `Record<FieldFunction, ...>` nhưng thiếu khóa `json`; thêm ép kiểu
  `// Backoffice:` (giá trị lúc chạy giữ nguyên). `parse-filter.test.ts` truyền accountability thiếu field: thêm
  `as Parameters<typeof parseFilter>[1]`. `deep-map-with-schema.test.ts` import `getRelation` tương đối thay vì tự import
  package. 435 test của `@backoffice/utils` đạt, coverage đủ ngưỡng.
- T005: chỉ port `AbstractService` của `services.ts`; phần còn lại của file mô tả service cho extension và cần kiểu của
  `graphql`, `nodemailer`, `archiver` (ngoài phạm vi). `users.ts`, `events.ts` port đủ. Kiểu engine cần (đã quét 192 file
  sẽ port) chỉ thiếu `AbstractService`, `ActionHandler`, `FilterHandler`, `InitHandler`, `RegisterUserInput`, `Role`,
  `User`.
- T006: `MAX_RELATIONAL_DEPTH` không thuộc `DIRECTUS_VARIABLES` (chỉ có trong defaults), nên không đưa vào nhóm A (test
  bắt mọi mẫu nhóm A phải là biến Directus); nó chưa bao giờ bị cảnh báo và vẫn được đọc. Sửa
  `warn-unsupported-variables.test.ts` (limiter đăng ký không còn ở nhóm C).
- T007: `directus-api.ts` có `appRequest(app, ...)`; `directusRequest` giữ chữ ký cũ (gọi `appRequest('directus', ...)`).
  `fixtures.ts` nhận app làm fixture; `cleanup()` xóa qua Directus, bỏ dòng access đã mất theo policy (cascade).
- T009: thêm bộ `matrix` (`PARITY_SUITE=matrix`, target `parity-tests:parity-matrix`); `full` loại `matrix.test.ts` và
  `matrix-reduced.test.ts` qua `exclude` (giữ `configDefaults.exclude`). Checkpoint Phase 1: typecheck, lint của 20
  project và test của `api`, `utils`, `types`, `parity-tests` (87 ca) đạt.
- T010, T011: thêm `database/helpers/dialects.test.ts` (snapshot SQL của `fn`, `st`, `number`, `capabilities`, `sequence`,
  `schema` cho bảy dialect, 371 snapshot) vì Directus chỉ có test cho vài helper; giữ coverage `apps/api` trên 80%.
- T014: test byte so với giá trị Directus ghi vào `filter-context-*` cần môi trường đối chiếu, chuyển sang test đối chiếu
  cache của T069; unit test chỉ kiểm vòng nén, giải nén và `setCacheValue`/`getCacheValue`.
- T022, T023: `services/index.ts` chỉ export các service đã có (access, activity, items, meta, payload, permissions,
  policies, presets, revisions, roles, users); export `server`, `auth`, `specs`, `settings`, `tfa` kéo theo `app.module` và
  làm hỏng mock DB của test service. `handleVersion` là stub ném `Error` (ponytail, 008).
- T024: Directus đặt `reason` của `UnprocessableContentError` là "Cannot remove the last admin user from the system.",
  `message` có tiền tố "Can't process content. " (đã ghi ở Assumptions của spec và contracts §5). Cache: `clearSystemCache`
  gọi một lần mỗi thao tác ghi; cache dữ liệu luôn xóa vì `opts` không chuyển tiếp (FR-082).
- T029: `fetch-share-info.ts` đọc qua `ItemsService('directus_shares')` (`SharesService` thuộc feature sau, D-31).
- T031: `validate-query.ts` dựng schema Joi lúc gọi lần đầu và dựng lại khi `QUERY_LIMIT_MAX` đổi (Directus dựng lúc
  import; repo cấm `useEnv()` ở cấp module). `@ts-ignore` của Directus đổi thành `@ts-expect-error` theo lint.
- T032: không đổi `validate-batch`, `use-collection` thành hàm như R3; giữ nguyên middleware của Directus và thêm
  `utils/run-middleware.ts` (gọi middleware Express trong controller NestJS, resolve khi `next()`, reject khi
  `next(err)`), ít sửa code gốc hơn.
- T033: `authenticate` chạy cho mọi path trừ `/server/ping`, nên test pipeline mock kết nối DB mặc định (Directus cũng
  mở kết nối mỗi request). D-12 thành entry `doc` (chỉ còn `export`, không request đối chiếu nào gửi); D-10 giữ tới T038.
  Manifest chung `tools/port-manifest/004-T010-T033.json` (221 file); bỏ `public-accountability.ts` khỏi `T020.json`.
  Checkpoint: typecheck, lint, `check-port-headers` (893 file) đạt; `apps/api` 188 file, 1.983 test đạt, coverage
  85,22 / 86,42 / 88,8 / 85,22; `@backoffice/utils` 435 test đạt.
- T034: bộ `full` trên Postgres 326 ca, 7 phút 47 giây; 6 ca đỏ đều là ca khẳng định khác biệt cũ (D-10: token sai ở
  `/nope`, `POST /server/ping`, `/server/health`, `/metrics`; D-12: `/metrics?limit=abc`): app mới nay trả giống
  Directus, đã sửa test theo Directus (`server/errors`, `health`, `info`, `oas`, `observability/metrics`). Chạy lại năm
  file: 44 ca đạt. `reduced` trên MySQL, SQLite chạy cùng checkpoint cuối lượt 1 (một lần dựng môi trường mỗi vendor).
- T036: `/server/info` cho user đăng nhập thiếu nhánh của Directus (`mcp_enabled`, `files`, `rateLimit`, `queryLimit`,
  `websocket`, `uploads`...; 001 ghi "làm ở 003" nhưng chưa làm): port vào `server.service.ts`, kèm
  `utils/get-allowed-log-levels.ts` và `FILE_UPLOADS` (getter) trong `constants.ts`. `/server/specs/oas` cho user đăng
  nhập lộ mô tả trong `components.schemas` đã đổi thương hiệu từ 001: mở rộng D-02 (sửa bảng 001 và bảng của spec này,
  cần tech lead duyệt ở T086).
- T037 đến T046: controller Nest cho `/roles`, `/policies`, `/access`, `/permissions` theo đúng thứ tự route của router
  Directus; `useCollection` gắn bằng `AppModule.configure`; `validateBatch` qua `runMiddleware`; `/permissions/me*` để
  US6. Fixture SQLite thêm bảng `directus_presets` (xóa role xóa preset). Admin luôn có `app` (`app ||= admin ||
  app_access`), nên đọc `/permissions` của admin cũng nối quyền tối thiểu của app (không có `id`).
- T039 đến T043: helper `tests/parity/src/permissions/flow.ts` (mỗi app chạy cùng các bước bằng admin của nó, ghi response,
  dòng DB, activity, revision; id thay bằng nhãn). Directus `keys.sort()` trong `updateMany`, `deleteMany` nên thứ tự
  activity theo UUID ngẫu nhiên: so activity, revision như tập hợp. `total_count` khác nhau vì fixture tạo lần lượt ở
  hai app: dùng `meta=filter_count`. Ca admin cuối (US3.3) kiểm trước rằng admin khởi tạo là admin `active` duy nhất
  (`last-admin.ts`), nếu không thì báo lỗi thay vì để Directus xóa policy admin. `MAX_BATCH_MUTATION` chưa có profile
  (giá trị mặc định `Infinity`), chưa kiểm ở T039.
- T035: Directus của môi trường đối chiếu bật response cache (`CACHE_ENABLED=true`), khóa theo user, path, query (không
  theo token hay role): sau khi đổi role, gọi `/roles/me` bằng static token cùng query với lần gọi JWT trước đó thì
  Directus trả lại response cũ. Đây là D-11 (005), không phải accountability; các lần gọi của US1.7 dùng query khác nhau.
  `/server/health` của admin có `observedValue` theo thời gian nên ETag khác theo độ dài body: so mọi thứ trừ ETag.
- Checkpoint lượt 1 (Postgres, máy local): bộ `full` 47 file, 386 ca đạt (1 todo), 8 phút 2 giây. MySQL, SQLite chạy
  `reduced` (gồm `accountability`, `roles`) trên CI sau khi push.
- CI của lượt 1 (`cf3395c` trên `main`) không chạy: GitHub Actions từ chối mọi job ("recent account payments have
  failed or your spending limit needs to be increased"), cả lần chạy đóng 003 trước đó. Chạy thay ở máy local: MySQL
  `reduced` 14 file, 140 ca đạt (18 bỏ qua theo vendor); SQLite `reduced` mọi file của lượt 1 đạt.
- T051: `deleteMany` của `UsersService` port nguyên bản; fixture SQLite thêm `directus_comments`,
  `directus_notifications`, `directus_versions` (chỉ cột khóa ngoại tới user) và cột `last_page` của `directus_users`.
- T052, T053: `users.controller.ts` đủ route theo thứ tự router Directus (trừ mời, đăng ký của US5); `TFAService` thêm
  `enableTFA`, `disableTFA` (ghi `tfa_secret` qua `ItemsService` với quyền của user). Bỏ entry D-09.10, sửa ô "Gỡ khi" của
  D-09.10 trong spec 003 thành `004`; D-09.2 chỉ còn `POST /users/invite`, `/users/invite/accept`, `/users/register`,
  `GET /users/register/verify-email` (US5) và `/permissions/me*` (US6).
- T048: profile `user-limits` (8855, 8856) thêm vào compose, `env/profile-user-limits.env`, `config.ts` (global-setup và
  `profiles.ts` đọc từ đây), `ALL_PROFILES`, CI. Ca giới hạn: Directus chạy trước rồi đặt `suspended` cho user của nó để
  app mới bắt đầu từ cùng số đếm.
- T063 đến T065: `inviteUser`, `acceptInvite`, `registerUser`, `verifyRegistration` port nguyên bản; chỗ gửi mail thay
  bằng `warn` `[email] Invitation email to "<email>" ...` / `Verification email ...` (không token, không link; vì vậy
  không port `inviteUrl` và phần ký token xác minh). Limiter đăng ký tạo ở request đầu (R11). Fixture SQLite thêm
  `public_registration_role`, `public_registration_email_filter`. Entry `doc` D-27, D-28.
- T068: `GET /permissions/me`, `GET /permissions/me/:collection/:pk?` (Nest: hai path cho tham số tùy chọn của Express 4).
  D-09.2 không còn khớp request nào (`excludeEndpoints: ['*']`), giữ tới khi 004 Done như D-10.
- T062, T066, T067 (Postgres): `invite-register` 14 ca, `me` và `check-item-permissions` 11 ca đạt. Token tự ký theo
  định dạng Directus được gắn nhãn trong transcript; helper `flow.nameExact()` cho OTP.
- T055 đến T057: `read-rules` (8 ca), `write-rules` (4), `query` (15: năm endpoint × admin, user một phần, public; mỗi ca
  khoảng 40 query gồm qs, JSON, hàm, `_some`, `_none`, `deep`, `aggregate`, `SEARCH`, 13 query sai) đạt trên Postgres.
  Đo được: không có quyền `read` thì đọc theo id trả message "access collection ... Queried in root." (không phải
  "access this."); "access this." chỉ khi có quyền mà filter loại dòng. Đã sửa câu chữ US2.6 của spec theo Directus.
- T058: harness `matrix-harness.ts`: mỗi nhóm dựng fixture một lần ở Directus (policy 25 dòng quyền cho năm collection ×
  năm action; `directus_users-custom` dùng chung dòng quyền của `directus_users`, khác ở field tùy biến trong request);
  ô đọc, share so bằng `parity()` trên đích dùng chung; ô tạo, sửa, xóa chạy ở từng app trên đích riêng, so response và
  dòng ghi. Hai lỗi harness đã gặp: tên theo app phải cùng độ dài (`backoffice` dài hơn `directus` làm local-part email
  quá 64 ký tự chỉ ở một bên) và hai dòng `directus_access` cùng `sort` trả về theo thứ tự UUID ngẫu nhiên. Đo: 65
  nhóm khoảng 2,1 đến 2,8 phút trên máy local (Directus chạy giả lập amd64), cả ma trận khoảng 25 phút; chọn n = 4
  cho CI (`parity-matrix-rotating`, `parity-matrix.yml`).
- T069 đến T072: key cache dữ liệu của Directus có dạng `sets:namespace:<CACHE_NAMESPACE>:<CACHE_NAMESPACE>:<key>`
  (Keyv); giá trị `filter-context-*` giống từng byte (`expires` của Keyv tùy thời điểm). Directus ghi thêm một entry
  `raw-permissions` từ `permissionsCacheable()` của bước `respond` (response cache, D-11). FR-082 với
  `CACHE_AUTO_PURGE=true`: mọi lệnh ghi qua engine đều xóa cache dữ liệu (FR-083), trừ `track/page`. FR-085: entry của
  cache quyền chỉ nằm trong bộ nhớ của process ghi sau cùng (`CacheMulti.set` báo process khác bỏ key), nên ca Redis
  down đo từng app sau khi chính app đó làm nóng; khi đó hai app như nhau (đọc đã nóng trả `403`; lệnh ghi ghi dòng rồi
  treo ở bước xóa cache).
- T073, T074: proxy nginx (`proxy/`, `scripts/proxy-conf.mjs` sinh `nginx.conf` lúc `env-up`, test
  `src/proxy-conf.test.ts`), profile `app` (cổng 8160, `PROXY_URL` ở global-setup); dự án `tests/directus-app-e2e`
  (Playwright, helper đăng nhập, chụp dòng DB, đọc log proxy).
- T080, T081, T083, T084: `request-set.ts` thêm request của năm endpoint với JWT admin ký sẵn và static token của user
  tạo trước khi chụp DB; ca log FR-092; bảng 001 (D-09.6, D-11, D-12) và entry `doc` D-29 đến D-31; `SPECKIT-GUIDE.md`
  (005 không port lại engine).
- T081: log HTTP của cả hai app ghi nguyên URL và `query` của `GET /users/register/verify-email?token=<JWT>`
  (`redactQuery` của Directus chỉ che `access_token`): giữ như Directus, ghi rủi ro R-06, FR-092 loại trừ dòng này; test
  kiểm token chỉ nằm ở đúng dòng đó ở cả hai app. Cần tech lead duyệt ở T086.
- T085: quickstart §1 (bộ đầy đủ Postgres, ma trận), §2 (từng bước, hai app như nhau), §3 (5 spec E2E) đạt. Sửa
  quickstart: URL có `[...]` cần `curl -g`.
- T082: `tests/benchmark/src/{seed-permissions,permissions}.ts`, target `benchmark:permissions`, job
  `benchmark-permissions`. Mốc so là Directus không response cache (`directus-noresponsecache`, D-11). Lần chạy
  trên máy dev (5 vòng, khoảng 20 phút; Directus chạy giả lập amd64 nên chậm hơn thật): `GET /users/me` p95 982 / 284
  ms, 69 / 293 req/s; `GET /permissions/me` 449 / 175 ms, 166 / 621 req/s; `GET /users?filter[status][_eq]=active`
  757 / 316 ms, 61 / 247 req/s (Directus / app mới), cả ba `ok`. Bước dọn đăng nhập lại vì lần chạy dài hơn
  `ACCESS_TOKEN_TTL`.
- T059: bộ rút gọn đạt trên MySQL (169) và SQLite (168). Trên DB mới id permission nhỏ (2, 3, 204) trùng `sort`, status
  HTTP: flow chỉ gán nhãn số ở vị trí id (key `id`, phần tử mảng, cả chuỗi, đoạn path). Dọn fixture dùng `SEARCH` (danh
  sách id dài vượt cỡ URL).
- CI lần đầu sau khi repo public: test `@backoffice/env` (mock `node:fs`) hỏng vì `getEndpoint` của `@backoffice/utils`
  kéo `system-data` đọc YAML lúc import; `loadYaml` lấy `fs` qua `process.getBuiltinModule`. Hai ca Redis down: chờ đủ
  subscriber của bus trước khi publish `schemaChanged`; `/server/health` khi Redis down là "không trả" hoặc `500` tùy
  retry của ioredis có xong trước timeout không, hai app như nhau.
- T058, T061: ma trận đủ trên Postgres (10 shard × 65 nhóm, mỗi shard thêm hai ca FR-035, R-01): 670 ca đạt, tổng
  khoảng 30 phút (1,6 đến 5,1 phút mỗi shard; shard chậm khi Directus giả lập amd64 bị tải). Không cần sửa engine.
- T075 đến T079: app Directus qua proxy: 5 spec đạt (đăng nhập, định tuyến, users, roles, policies), mỗi spec chạy
  qua proxy rồi chỉ Directus và so dòng DB. Ghi nhận khi viết: admin chưa đặt project owner thì app hiện hộp nhắc
  BSL ở mọi trang; "Remind Later" chỉ đặt cookie `license-banner-dismissed` (bị xóa mỗi lần đăng nhập) nên test đặt
  cookie này sau khi đăng nhập, không bấm chấp nhận điều khoản. App mở `last_page` sau khi đăng nhập: test xóa
  `last_page` của admin trước mỗi lượt. Lưu ở Directus là "save and quit". Route app gọi vào app mới khi nạp và mở
  Settings: `/auth`, `/auth/login`, `/auth/refresh`, `/server/info`, `/users/me`, `/users`, `/roles`, `/roles/me`,
  `/policies`, `/policies/me/globals`, `/permissions/me`, `PATCH /users/me/track/page` (khớp contracts/proxy-e2e.md §1).
