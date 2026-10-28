---

description: "Danh sách task cho feature 027: khóa chính uuid tự sinh dùng UUID v7"
---

# Tasks: Khóa chính uuid tự sinh dùng UUID v7

**Input**: Tài liệu thiết kế trong `/specs/027-uuid-v7-primary-keys/`
**Prerequisites**: `plan.md`, `spec.md` (D-192 và rủi ro CHK019 duyệt 2026-10-29; constitution 3.4.0). Dùng thêm
`research.md` (R1–R11, kết quả đo), `data-model.md`, `contracts/` (`api.md`, `tests.md`), `quickstart.md`,
`checklists/requirements.md`, `checklists/api-compat.md`.

**Điều kiện bắt đầu**: spec, plan, tasks 027 cùng constitution 3.4.0, `.specify/templates/plan-template.md` và
`SPECKIT-GUIDE.md` đã commit lên `main` (commit `docs(027): spec, plan, tasks; constitution 3.4.0`). Dòng "planned" của
027 trong `CLAUDE.md` đã nằm trong commit `0739a375` của phiên khác. Làm trên `main`, không branch; script `.specify` cần
`SPECIFY_FEATURE=027-uuid-v7-primary-keys`. Checkout dùng chung với các phiên khác: `git add` theo đường dẫn, không
`git add -A`/`.`, không `stash`, `reset`, `checkout --`; không stage `apps/api/project.json`, `apps/web/project.json`;
trước khi push xem phiên nào đang chạy cùng checkout (`ListAgents`) và báo theo quy tắc chung checkout; push khi `main`
không có run CI đang chạy (push hủy run cũ). Không sửa file dưới `directus/`. Máy local: chạy test từng file,
`--maxWorkers=1`; không dừng container của phiên khác.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Hành vi đổi ở mọi endpoint tạo item của collection người dùng (`POST /items`, `PATCH` singleton, `/graphql` mutation
  tạo, `/utils/import`, flow `item-create`). Đối chiếu: `parity/items/uuid-v7.test.ts` (mới, D-192 `doc`: so từng app
  riêng), case `item-create` của `parity/flows/operations.test.ts`; bộ đối chiếu và blackbox hiện có không đổi (SC-005).
- Unit test viết trước và chạy đỏ rồi mới sửa code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).
- Không có task riêng cho: id cũ không đổi khi khởi động (bảo đảm bởi FR-007: không migration), id không trùng giữa
  replica (Assumptions, CHK025), đồng hồ máy lùi (bộ đếm của thư viện, research R2); đường extension đo qua cùng
  `ItemsService` (SC-001) (sửa khi analyze 2026-10-29).

**Organization**: một lượt commit (research R10): Phase 2 (transformer), Phase 3–6 (US1–US4, test đối chiếu), Phase 7
(tài liệu, đóng lượt). T018 (nightly cho vendor khác) do chủ dự án quyết định.

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/src/`; `parity/` = `tests/parity/src/`.
- Comment code ghi Directus là "DR" (constitution IX). File port sửa giữ header nguồn và ghi
  `// Backoffice (spec 027, D-192): ...` tại chỗ sửa.
- Không biến env mới (VIII). Không DDL, không migration (II). Không thêm dependency (`uuid` 11.1.0 đã có).
- Regex kiểm (data-model.md): v7 `^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, v4 cùng mẫu với
  `4` ở ký tự thứ 15.
- Lệnh: `pnpm nx run api:test -- <file>`; `pnpm nx run parity-tests:test -- <file>` (test của bộ so sánh, không Docker);
  `pnpm nx run parity-tests:env-up --vendor=<v>` rồi `TEST_DB=<v> pnpm nx run parity-tests:parity -- <file>` (khi có
  `--` để lọc file, cờ `--vendor` không tới `scripts/parity.mjs`: test đọc DB host theo `TEST_DB`, mặc định Postgres;
  sửa khi implement 2026-10-29).
- Image API của env parity là `hiennd23/backoffice-api:local`; dựng lại sau khi sửa code bằng
  `docker build --platform linux/amd64 -f apps/api/Dockerfile -t hiennd23/backoffice-api:local .` từ gốc repo. Không
  dùng `pnpm nx run api:container` ở máy này: `push: true` cục bộ của chủ dự án trong `apps/api/project.json` sẽ đẩy
  image lên Docker Hub.

## Phase 1: Setup

Không có task: không project, dependency hay cấu hình mới; các điểm [Inference] còn lại (thứ tự trên MySQL, MariaDB,
Oracle, CockroachDB) chốt bằng chính test đối chiếu ở T007 và T018.

---

## Phase 2: Foundational (transformer `uuid`)

**Purpose**: một chỗ sửa dùng chung cho US1 (v7), US2 (giữ giá trị client), US3 (hệ thống giữ v4).

**⚠️ CRITICAL**: chưa xong Phase 2 thì không chạy test đối chiếu của user story nào.

### Tests (MANDATORY) ⚠️

- [X] T001 Thêm `describe('uuid (spec 027, D-192)')` vào `api/services/payload.service.test.ts` theo contracts/tests.md
      §Unit: `new PayloadService(<collection>, { knex: db, schema: { collections: {}, relations: [] } })` rồi gọi
      `service.transformers['uuid']!({ action, value, payload: {}, accountability: null, specials: ['uuid'], helpers,
      overwriteDefaults: undefined })`: (a) collection `test`, `action: 'create'`, `value` là `undefined`, `null`, `''` →
      khớp regex v7; (b) `directus_roles`, `directus_files`, `backoffice_permissions` → khớp regex v4; (c)
      `backoffice_items` (không có trong danh sách hệ thống) → v7; (d) `value` là một UUID v4 và một UUID v7 có sẵn → trả
      đúng `value`; (e) `action: 'update'` và `'read'` với `value` có và `null` → trả đúng `value`; (f) 10 000 lần gọi tạo
      liên tiếp trên `test` (SC-002) → mỗi kết quả lớn hơn kết quả trước khi so chuỗi; (g) `processValues('create', [{}, {}, {}])`
      trên schema `new SchemaBuilder().collection('test', (c) => { c.field('id').uuid().primary(); c.field('code').uuid();
      }).build()` → ba `id` và ba `code` khớp v7, `id` tăng theo thứ tự mảng. Chạy
      `pnpm nx run api:test -- src/services/payload.service.test.ts`: case (a), (c), (f), (g) đỏ; 12 case transformer có
      sẵn xanh.

### Implementation

- [X] T002 Sửa transformer `uuid` trong `api/services/payload.service.ts:86-91` theo research R1: đổi `async uuid(...)`
      thành `uuid: async ({ action, value }) => { if (action === 'create' && !value) return isSystemCollection(this.collection)
      ? randomUUID() : uuidv7(); return value; }`, thêm `import { v7 as uuidv7 } from 'uuid';` và
      `import { isSystemCollection } from '@backoffice/system-data';`, comment
      `// Backoffice (spec 027, D-192): DR always generates randomUUID() (v4); user collections get a UUID v7, system
      collections keep v4 (POST /users/invite accepts a v4 role only).` ngay trên transformer. Không đổi type
      `Transformers`, `processField`, `processValues`. Chạy lại T001 (xanh) và
      `pnpm nx run api:test -- src/services/items.service.test.ts src/services/payload.service.test.ts` (không đổi kết quả
      ngoài case mới).

**Checkpoint**: unit xanh; dựng lại image `hiennd23/backoffice-api:local` (lệnh ở Quy ước) trước Phase 3.

---

## Phase 3: User Story 1 - Item mới của collection người dùng nhận id v7 theo thứ tự tạo (Priority: P1) 🎯 MVP

**Goal**: mọi đường tạo item của collection người dùng qua Backoffice sinh UUID v7 tăng dần (FR-001..FR-003).

**Independent Test**: `parity/items/uuid-v7.test.ts` phần US1 trên Postgres: Backoffice v7, Directus v4, thứ tự sắp theo
id trùng thứ tự tạo.

### Tests (MANDATORY) ⚠️

- [X] T003 [US1] Tạo `parity/items/uuid-v7.test.ts` (header: `// Spec 027 (D-192): ...`). Fixture per-run tạo qua Directus
      (`createUserCollection` của `parity/permissions/fixtures.ts:221` với `{ primaryKey: 'uuid' }`, `appRequest('directus',
      ...)` của `parity/directus-api.ts:39` cho field và quan hệ): collection chính `parity_uuid7_<run>` (`title` string,
      `code` uuid có `meta.special: ['uuid']`, m2o `folder` → `directus_folders`), collection con khóa uuid có m2o `parent`
      về collection chính và alias o2m `children`, junction khóa uuid cho alias m2m `files` → `directus_files` (một file nhỏ
      tải qua Directus trong `beforeAll`), alias m2a `blocks` qua junction khóa uuid (`item`, `collection`) tới collection
      con và `directus_folders`, hai singleton khóa uuid (một cho mỗi app, vì DB dùng chung), collection
      `parity_uuid7_<run>_order`. Case US1 (contracts/tests.md case 1–4, 8): `POST` một item và mảng 3 item ở mỗi app
      (Backoffice `id`, `code` khớp v7, mảng `data` trùng thứ tự gửi và id tăng dần; Directus khớp v4; phần body còn lại
      giống nhau sau khi bỏ `id`, `code`); `create_<c>_item`, `create_<c>_items` qua `POST /graphql` và
      `POST /utils/import/<c>` CSV (không cột id; cột id rỗng) ở Backoffice → v7; item lồng: con o2m, dòng junction m2m và dòng junction m2a
      → v7; `PATCH` singleton của Backoffice lần đầu → v7 (singleton của Directus → v4); 30 item tạo lần lượt ở Backoffice
      vào collection `_order`, `GET ?sort=id&fields=title&limit=-1` với `Cache-Control: no-store` trùng thứ tự tạo khi
      vendor (`getDbsToTest()` của `parity/get-dbs-to-test.ts`) khác `mssql`, khác thứ tự tạo khi là `mssql` (research
      R5). `afterAll`: `cleanup()` của fixtures, xóa file.
- [X] T004 [P] [US1] Thêm `'src/items/uuid-v7.test.ts'` vào `REDUCED_FILES` và vào mẫu
      `'src/items/{crud,export,json-path,collection-toggles,uuid-v7}.test.ts'` của `FULL_FILES` trong `parity/suite.ts`;
      chạy `pnpm nx run parity-tests:test -- src/vendors.test.ts` (sửa kỳ vọng danh sách file nếu test đó liệt kê).
- [X] T005 [P] [US1] Trong case `item-create` của `parity/flows/operations.test.ts:188` (collection khóa uuid ở `:36-42`):
      kiểm key do flow tạo khớp v7 ở Backoffice và v4 ở Directus (đọc từ response của từng app trước khi so transcript).
- [X] T006 [P] [US1] Thêm vào `tests/parity/accepted-differences.ts`: `{ id: 'D-192', feature: '027', kind: 'doc', reason:
      'Generated special uuid values of user collections are UUID v7 at Backoffice, v4 at Directus; system collections keep
      v4; batch create responses follow the id order (spec 027).' }`; chạy
      `pnpm nx run parity-tests:test -- src/accepted-differences.test.ts`.

### Implementation for User Story 1

- [X] T007 [US1] Chạy và làm xanh (sửa code, không sửa test): `pnpm nx run parity-tests:env-up --vendor=postgres` rồi
      `pnpm nx run parity-tests:parity --vendor=postgres -- src/items/uuid-v7.test.ts src/flows/operations.test.ts`; lặp
      lại với `--vendor=sqlite3` và `--vendor=mysql` (bộ `reduced`). Ghi thứ tự sắp đo được trên MySQL, SQLite, Postgres
      vào "Kết quả lượt 1" của `specs/027-uuid-v7-primary-keys/research.md`; nếu MySQL không theo thứ tự tạo thì dừng, sửa
      bảng R5, FR-011 và báo chủ dự án.

**Checkpoint (MVP)**: Backoffice sinh v7 ở mọi đường tạo của collection người dùng.

---

## Phase 4: User Story 2 - Giá trị có sẵn và giá trị client gửi không đổi (Priority: P1)

**Goal**: id client gửi, id có sẵn và giá trị khi sửa item giữ nguyên (FR-005, FR-006, FR-007).

**Independent Test**: case US2 của `parity/items/uuid-v7.test.ts` giống Directus.

- [X] T008 [US2] Thêm vào `parity/items/uuid-v7.test.ts` (contracts/tests.md case 5): `POST` có `id` là UUID v4 và UUID
      v7 do test sinh (mỗi app một id riêng vì DB dùng chung) → lưu đúng id ở cả hai app; `POST` có `id: 'not-a-uuid'` →
      `assertParity(await parity(...))` (không ghi gì); import CSV có cột id mang giá trị → giữ id đó; `PATCH` item (id v4
      và v7) không có `code` → `id`, `code` không đổi; `PATCH` với `code: null` → `code` là `null` ở cả hai app (không
      sinh lại). Chạy như T007 trên Postgres, SQLite, MySQL.

---

## Phase 5: User Story 3 - Collection hệ thống giữ UUID v4 như Directus (Priority: P1)

**Goal**: collection hệ thống giữ v4, kể cả field người dùng thêm vào và item lồng (FR-004).

**Independent Test**: case US3 của `parity/items/uuid-v7.test.ts`: id v4 ở Backoffice, mời người dùng được ở hai app.

- [X] T009 [US3] Thêm vào `parity/items/uuid-v7.test.ts` (contracts/tests.md case 6, case 3 phần m2o): Backoffice
      `POST /roles`, `/policies`, `/folders` → id khớp v4; `POST /items/<chính>` với `folder: { name }` lồng → item v7,
      folder v4; `POST /users/invite` với `role` là role vừa tạo ở Backoffice, gửi tới Backoffice và tới Directus → không
      lỗi validate role (cách mời ở Directus như `parity/observability/logs.test.ts:222`). `afterAll` xóa user được mời,
      role, policy, folder. Chạy như T007 trên Postgres, SQLite, MySQL.

---

## Phase 6: User Story 4 - Chạy song song với Directus 11.17.4 (Priority: P1)

**Goal**: hai app đọc ghi chéo item v4 và v7; ngoài id tự sinh, request và response giống Directus (FR-009, FR-010,
FR-012).

**Independent Test**: case US4 của `parity/items/uuid-v7.test.ts` và bộ hiện có không đổi kết quả.

- [X] T010 [US4] Thêm vào `parity/items/uuid-v7.test.ts` (contracts/tests.md case 7): item v7 do Backoffice tạo và item
      v4 do Directus tạo; `parity()` với `Cache-Control: no-store` cho `GET /items/<c>/<id>`, `GET ?filter[id][_eq]=`,
      `GET ?filter[id][_in]=`, `GET ?sort=-id`, quan hệ o2m của item đó → `assertParity`; `PATCH`, `DELETE` item của app kia
      ở mỗi app → thành công, dữ liệu sau đó giống nhau. Chạy như T007 trên Postgres, SQLite, MySQL.
- [X] T011 [US4] SC-005 (local: Postgres 10 file xanh, blackbox items và query trên Backoffice xanh, `crud` trên SQLite và
      MySQL xanh; bộ blackbox đầy đủ và bộ `reduced` đầy đủ do CI chạy): chạy bộ hiện có trên Postgres và xác nhận không đổi kết quả: `parity/items/{crud,export,json-path,
      collection-toggles}.test.ts`, `parity/flows/operations.test.ts`, `parity/permissions/{users,roles,write-rules,
      invite-register}.test.ts`, `parity/graphql/write.test.ts`, `parity/system/import-export.test.ts`, blackbox items
      (`PARITY_SUITE=blackbox`, cần `env-up --profiles=blackbox`); bộ `reduced` trên SQLite và MySQL.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T012 [P] Cập nhật `specs/027-uuid-v7-primary-keys/spec.md`: dòng Status (Implemented, commit, run CI), kết quả thứ tự
      theo vendor vào FR-011 nếu khác research R5; `specs/027-uuid-v7-primary-keys/research.md` "Kết quả lượt 1" (local,
      CI) và "Kết quả benchmark" (T016). Nếu T018 chưa chạy, ghi trong bảng R5 rằng MariaDB, MSSQL, Oracle, CockroachDB
      vẫn ở mức tài liệu và suy luận (sửa khi analyze 2026-10-29).
- [X] T013 [P] Thêm vào mục "Test items" của `tests/parity/README.md` một dòng cho `src/items/uuid-v7.test.ts` (spec 027,
      bộ `full` và `reduced`; D-192 `doc`, so từng app riêng; thứ tự sắp kiểm theo vendor, MSSQL khác thứ tự tạo).
- [X] T014 [P] Cập nhật `CLAUDE.md`: dòng 027 ở Active Technologies từ "planned" thành "implemented" (ngày, commit, run
      CI); thêm dòng 027 đầu mục Recent Changes (giữ nguyên dòng của phiên khác); cập nhật trạng thái 027 trong
      `SPECKIT-GUIDE.md` mục 6.
- [X] T015 Đóng lượt: `pnpm nx run-many -t lint,typecheck -p api parity-tests`; `pnpm nx run api:test` (coverage BE
      ≥ 80 %); `pnpm nx run api:build`; `pnpm nx run parity-tests:test`; `git add` theo đường dẫn
      (`apps/api/src/services/payload.service.ts`, `apps/api/src/services/payload.service.test.ts`,
      `tests/parity/src/items/uuid-v7.test.ts`, `tests/parity/src/suite.ts`, `tests/parity/src/flows/operations.test.ts`,
      `tests/parity/accepted-differences.ts`, `tests/parity/README.md`, `specs/027-uuid-v7-primary-keys/`, `CLAUDE.md`,
      `SPECKIT-GUIDE.md`; kiểm `git diff --cached --stat`); commit
      `feat(027): generate UUID v7 for special uuid fields of user collections (D-192)`; push theo quy tắc chung checkout
      (Điều kiện bắt đầu); CI xanh (`parity` Postgres và các shard, sqlite3 và mysql `reduced`, `guard-differences`);
      `graphify update .`.
- [X] T016 SC-007: sau T015, `gh workflow run benchmark.yml -f job=benchmark-items`; ghi run và kết quả vào
      "Kết quả benchmark" của `specs/027-uuid-v7-primary-keys/research.md` (scenario `create` dùng khóa số nên chỉ kiểm
      không lùi; research R8).
- [X] T017 Commit tài liệu kết quả của T012, T014, T016 (`docs(027): close the UUID v7 spec (CI <run>, benchmark <run>)`),
      push theo quy tắc chung checkout.
- [X] T018 **Bỏ qua** (chủ dự án 2026-10-29: đo ở feature phân trang con trỏ; bảng R5 giữ mức tài liệu và suy luận cho
      MariaDB, MSSQL, Oracle, CockroachDB). (Chủ dự án quyết định) `gh workflow run nightly.yml` (MariaDB, MSSQL, Oracle, CockroachDB, Postgres 10, MySQL,
      SQLite); ghi thứ tự sắp đo được của từng vendor vào bảng R5 của `specs/027-uuid-v7-primary-keys/research.md`; vendor
      nào khác dự đoán thì sửa FR-011 và báo chủ dự án.

---

## Dependencies & Execution Order

### Phase

- T001 → T002 → dựng lại image → Phase 3 (T003; T004, T005, T006 song song) → T007 → Phase 4 (T008) → Phase 5 (T009) →
  Phase 6 (T010, T011) → Phase 7 (T012, T013, T014 song song) → T015 → T016 → T017. T018 sau T015, khi chủ dự án quyết.

### User story

- US1–US3 cần Phase 2 (một transformer). US4 cần US1 (fixture và item v7 của T003).
- `parity/items/uuid-v7.test.ts` dùng chung: T003 → T008 → T009 → T010 theo thứ tự.

### Trong một story

- Unit test trước (chạy đỏ), rồi code; test đối chiếu chạy sau khi dựng lại image.

## Parallel Example

```bash
# Sau T003:
T004 suite.ts | T005 flows/operations.test.ts | T006 accepted-differences.ts

# Phase 7:
T012 spec, research | T013 tests/parity/README.md | T014 CLAUDE.md, SPECKIT-GUIDE.md
```

## Implementation Strategy

### MVP

1. Phase 2 → transformer và unit test. **Dừng và kiểm**: `api:test` xanh; `POST /items/<c>` ở Backoffice trả id v7.
2. Phase 3 (US1) → test đối chiếu US1 xanh trên Postgres, SQLite, MySQL.

### Phần còn lại

3. Phase 4–6 (US2–US4) → cùng file test, mỗi phase chạy lại ba vendor.
4. Phase 7 → tài liệu, đóng lượt, benchmark; T018 khi chủ dự án quyết.
