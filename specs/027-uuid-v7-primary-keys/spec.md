# Feature Specification: Khóa chính uuid tự sinh dùng UUID v7

**Feature Branch**: `027-uuid-v7-primary-keys` (làm trên `main` như 012–026, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=027-uuid-v7-primary-keys`)
**Created**: 2026-10-29
**Status**: Draft (spec và clarify 2026-10-29; constitution 3.4.0 2026-10-29; plan 2026-10-29: research R1–R11, đo thứ
tự sắp trên Postgres 16 và SQLite, data-model, contracts, quickstart; checklist api-compat, D-192 duyệt, tasks và analyze
2026-10-29)
**Input**: User description: "Feature 027: khóa chính uuid do API Backoffice tự sinh dùng UUID v7 thay cho v4. Bối cảnh:
khi tạo collection với khóa chính "Generated UUID" [...], DB không tự sinh id; API sinh id lúc tạo item bằng transformer
uuid của PayloadService [...], hiện là randomUUID() của node:crypto = v4; id client gửi sẵn được giữ nguyên. Lý do (chủ
dự án 2026-10-29): chuẩn bị cho phân trang dạng con trỏ (cursor, keyset) ở feature sau [...]. 027 chỉ đổi cách sinh id,
không làm phân trang con trỏ. [...] Phạm vi đã chốt (chủ dự án 2026-10-29): chỉ field có special uuid không có giá trị
của collection do người dùng tạo, gồm cả field không phải khóa chính; collection hệ thống (directus_*, backoffice_*) giữ
v4 như Directus, kể cả field special uuid người dùng thêm vào collection hệ thống. [...] Luôn bật, không thêm biến môi
trường [...]. Khác biệt với Directus ghi từ D-192 [...]; Nguyên tắc II sửa ở bước 0 (constitution 3.4.0) [...]" (bản đầy
đủ: lệnh `/speckit.specify` của 027 trong `SPECKIT-GUIDE.md` mục 6)

**Điều kiện trước `/speckit.plan`** (Governance):

- Sửa constitution: Nguyên tắc II ghi "Dữ liệu app mới ghi ra (users, sessions, activity, revisions, files, hash mật khẩu
  argon2, uuid, ngày giờ, JSON) PHẢI có định dạng giống hệt Directus". UUID v7 cùng dạng chuỗi nhưng khác ký tự version,
  nên chủ dự án chốt 2026-10-29 sửa câu này: MINOR 3.3.0 → 3.4.0, bước 0 của 027 trong `SPECKIT-GUIDE.md`. Đã sửa
  2026-10-29 sau `/speckit.clarify` (constitution 3.4.0, Nguyên tắc II, ý ngoại lệ UUID v7).
- Không thêm bảng, cột, migration, biến môi trường hay dependency (Nguyên tắc II, VIII giữ nguyên phần còn lại).
- Khác biệt D-192: chủ dự án kiêm tech lead duyệt 2026-10-29 (sau `/speckit.plan` và checklist api-compat), kèm rủi ro
  client ngoài kiểm id bằng mẫu phiên bản 1–5 (CHK019).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Item mới của collection người dùng nhận id v7 theo thứ tự tạo (Priority: P1) 🎯 MVP

Admin tạo collection A với khóa chính "Generated UUID" (hoặc A đã có từ trước với khóa chính đó). Người dùng, app
Backoffice, `@directus/sdk`, script hay Directus app ở cấu hình proxy tới API mới tạo item ở A qua API Backoffice mà
không gửi id. Id nhận về là UUID v7. Trên cùng một instance Backoffice, item tạo sau có id lớn hơn item tạo trước, nên
sắp theo id ra thứ tự tạo.

**Why this priority**: lý do của feature: chuẩn bị cho phân trang dạng con trỏ ở feature sau, cần id tăng theo thời gian
tạo.

**Independent Test**: tạo collection có khóa chính uuid; tạo item lần lượt và theo lô qua REST, GraphQL, import, flow;
kiểm ký tự version của id là `7` và thứ tự sắp theo id trùng thứ tự tạo.

**Acceptance Scenarios**:

1. **Given** A có khóa chính "Generated UUID", **When** gọi `POST /items/A` không có id, **Then** `data.id` là UUID v7
   (chuỗi 36 ký tự chữ thường dạng 8-4-4-4-12, ký tự thứ 15 là `7`) và DB lưu đúng giá trị đó.
2. **Given** như trên, **When** gọi `POST /items/A` với một mảng nhiều item không có id, **Then** mỗi item nhận một UUID
   v7 khác nhau, tăng dần theo thứ tự trong mảng.
3. **Given** như trên, **When** tạo nhiều item lần lượt trên cùng một instance Backoffice rồi gọi
   `GET /items/A?sort=id`, **Then** thứ tự trả về trùng thứ tự tạo, trừ trên MSSQL (FR-011; sửa khi analyze 2026-10-29).
4. **Given** như trên, **When** tạo item qua mutation `create_A_item`, `create_A_items` của `/graphql`, qua
   `POST /utils/import/A` (file không có cột id hoặc cột id rỗng), qua operation tạo item của flow, hoặc qua extension
   dùng service items, **Then** id cũng là UUID v7.
5. **Given** A có thêm field `code` kiểu uuid không phải khóa chính, đặt "Generate and Save UUID" khi tạo field,
   **When** tạo item không gửi `code`, **Then** `code` là UUID v7.
6. **Given** collection người dùng B có quan hệ o2m tới A, hoặc m2m tới A qua junction J có khóa chính uuid, **When**
   tạo item B cùng các item A lồng trong một request, **Then** item A lồng và dòng J mới đều nhận UUID v7.
7. **Given** A là singleton có khóa chính uuid và chưa có item, **When** gọi `PATCH /items/A` lần đầu, **Then** item
   được tạo có id là UUID v7.
8. **Given** B có field m2m tới `directus_files` qua junction J2, hoặc field m2a qua junction J3, J2 và J3 có khóa chính
   uuid, **When** tạo item B kèm dòng junction mới, **Then** dòng J2, J3 mới nhận UUID v7 vì junction là collection
   người dùng; item lồng ở đầu kia nhận giá trị theo collection của chính nó.

---

### User Story 2 - Giá trị có sẵn và giá trị client gửi không đổi (Priority: P1)

Id do client gửi, id đã có trong DB và giá trị khi sửa item giữ nguyên như hiện nay. Feature chỉ đổi giá trị mà API tự
sinh.

**Why this priority**: client hiện có (import dữ liệu với id cố định, đồng bộ giữa hệ thống) không được hỏng (Nguyên tắc
III).

**Independent Test**: tạo item với id client chọn (v4, v7, phiên bản khác), sửa item cũ, đọc dữ liệu cũ; so với Directus
11.17.4.

**Acceptance Scenarios**:

1. **Given** A có khóa chính "Generated UUID", **When** gọi `POST /items/A` với `id` là một UUID hợp lệ bất kỳ phiên
   bản, **Then** item lưu đúng id đó, giống Directus 11.17.4.
2. **Given** như trên, **When** gửi id không phải UUID hợp lệ, **Then** API trả lỗi giống Directus 11.17.4.
3. **Given** item đã có trong A (id v4 hay v7), **When** gọi `PATCH /items/A/<id>` có hay không có field special uuid
   trong body, **Then** id và các field special uuid không bị sinh lại.
4. **Given** A có item v4 tạo trước khi bật feature, **When** Backoffice khởi động bản mới, **Then** không có id nào bị
   đổi, không có migration hay bước chuyển đổi dữ liệu.

---

### User Story 3 - Collection hệ thống giữ UUID v4 như Directus (Priority: P1)

Item của collection hệ thống (users, roles, policies, files, folders, flows, operations, dashboards, panels, shares,
versions, comments...) tạo qua API Backoffice vẫn nhận UUID v4, giống Directus 11.17.4. Field special uuid mà người dùng
thêm vào collection hệ thống cũng giữ v4.

**Why this priority**: `POST /users/invite` của cả hai app chỉ nhận role là UUID v4; role có id v7 sẽ làm mời người dùng
lỗi ở cả Backoffice lẫn Directus. Dữ liệu hệ thống giữ giống Directus (Nguyên tắc II).

**Independent Test**: tạo role, policy, folder, file, flow qua Backoffice; kiểm ký tự version là `4`; mời người dùng với
role vừa tạo ở cả hai app.

**Acceptance Scenarios**:

1. **Given** Backoffice chạy bản mới, **When** tạo item ở collection hệ thống bất kỳ có field special uuid (ví dụ
   `POST /roles`, `/policies`, `/folders`, `/files`, `/flows`, `/dashboards`), **Then** id là UUID v4.
2. **Given** role R tạo qua Backoffice, **When** gọi `POST /users/invite` với `role` = id của R trên Backoffice và trên
   Directus 11.17.4, **Then** cả hai app chấp nhận role như với role do Directus tạo.
3. **Given** admin thêm vào `directus_users` một field kiểu uuid có "Generate and Save UUID", **When** tạo user không gửi
   field đó, **Then** giá trị là UUID v4.
4. **Given** collection người dùng B có field m2o tới collection hệ thống (`directus_files` hoặc `directus_folders`),
   **When** tạo item B cùng item lồng (file hoặc folder) trong một request, **Then** item B nhận v7 và item lồng nhận v4.
   Test đối chiếu dùng folder vì tạo folder lồng không cần tải file; file theo cùng quy tắc (sửa khi analyze 2026-10-29).

---

### User Story 4 - Chạy song song với Directus 11.17.4 (Priority: P1)

Backoffice và Directus 11.17.4 cùng DB đọc, ghi lẫn nhau như trước. Ngoài giá trị id API tự sinh ở collection người
dùng, mọi request và response của Backoffice vẫn giống Directus.

**Why this priority**: Nguyên tắc II, III, IV: hai app phải dùng chung DB an toàn.

**Independent Test**: test đối chiếu items, GraphQL, import hiện có chạy trên bản mới; thêm case đọc, sửa, xóa chéo item
v4 và v7 giữa hai app.

**Acceptance Scenarios**:

1. **Given** A có item v7 do Backoffice tạo, **When** Directus 11.17.4 đọc, lọc (`_eq`, `_in`), sắp, sửa, xóa item đó
   hoặc dùng nó trong quan hệ, **Then** Directus chạy như với item v4.
2. **Given** A có item v4 do Directus tạo, **When** Backoffice đọc, lọc, sắp, sửa, xóa, **Then** chạy như hiện nay.
3. **Given** cùng request tới hai app, **When** so response, **Then** chỉ khác ở giá trị id API tự sinh (ký tự version
   và giá trị) và thứ tự mảng của response tạo theo lô, vốn đi theo id; route, status, cấu trúc, lỗi, header, schema
   GraphQL và OAS giống nhau (sửa khi checklist 2026-10-29).
4. **Given** Directus 11.17.4 tạo item ở A, **When** Backoffice đang chạy bản mới, **Then** Directus vẫn sinh UUID v4;
   Directus không cần đổi file, biến môi trường hay cấu hình.
5. **Given** nhiều replica Backoffice cùng tạo item ở A, **When** đọc lại, **Then** mọi id là UUID v7 và không trùng.

### Edge Cases

- "Không có giá trị" hiểu như điều kiện sinh id hiện nay: field thiếu trong payload, `null` hoặc chuỗi rỗng.
- Nhiều id sinh trong cùng một mili giây trên một instance: vẫn tăng dần theo thứ tự sinh.
- Đồng hồ máy lùi (chỉnh NTP): id trong một instance vẫn tăng dần; mốc thời gian chứa trong id có thể lệch khỏi giờ thật
  một khoảng nhỏ.
- Nhiều replica: hai id sinh cùng mili giây ở hai máy không có thứ tự xác định; đồng hồ lệch giữa các máy làm thứ tự giữa
  replica lệch theo độ lệch đó.
- Một bảng có lẫn v4 (dữ liệu cũ, item do Directus tạo, id client gửi) và v7: sắp theo id không ra thứ tự tạo cho phần
  v4. Feature phân trang con trỏ sau phải xử lý (FR-011).
- Đọc không khác giữa hai app: cùng DB và cùng query thì cùng giá trị, cùng thứ tự; chỉ response của request tạo khác,
  vì mỗi app tự sinh id (sửa khi checklist 2026-10-29).
- Danh sách không có `sort` mặc định sắp theo khóa chính, như Directus. Id v7 bắt đầu bằng `01` tới 2039-09-07, nên khi
  sắp tăng dần, item do Backoffice tạo đứng trước gần như mọi item v4, ở cả Directus app và web Backoffice (sửa khi
  checklist 2026-10-29).
- Item tạo lồng (o2m, m2m, m2a): giá trị theo collection của chính item, không theo collection gốc của request. File,
  user tạo lồng giữ v4; junction của m2m, m2a là collection người dùng nên nhận v7 (FR-002).
- Collection người dùng có tên bắt đầu bằng `backoffice_` mà không nằm trong danh sách collection hệ thống: là collection
  người dùng, nhận v7.
- Import có cột id: dòng có id giữ id đó; dòng có id rỗng nhận v7.
- Revisions, activity, versions lưu id dưới dạng chuỗi: không đổi cách lưu.
- Field uuid không có special `uuid` mà có default `gen_random_uuid()` ở DB: DB sinh v4 như hiện nay; khóa uuid "manual"
  vẫn do client gửi (ngoài FR-001; sửa khi plan, research R4).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Khi tạo item ở collection người dùng qua API Backoffice, mỗi field có special `uuid` không có giá trị PHẢI
  nhận UUID v7 (RFC 9562), dạng chuỗi 36 ký tự chữ thường 8-4-4-4-12, áp cho khóa chính và field không phải khóa chính.
- **FR-002**: FR-001 PHẢI áp cho mọi đường tạo item của Backoffice: REST (`POST`, `PATCH` singleton tạo item đầu tiên,
  item lồng trong quan hệ), GraphQL `/graphql` (mutation tạo), `POST /utils/import`, flow (operation tạo item) và
  extension dùng service items. Với item tạo lồng (o2m, m2m, m2a), mỗi item nhận giá trị theo collection của chính nó,
  không theo collection gốc của request: junction là collection người dùng nên nhận v7, kể cả junction nối tới
  collection hệ thống; item lồng thuộc collection hệ thống nhận v4 (FR-004).
- **FR-003**: Các UUID v7 sinh trong cùng một instance Backoffice PHẢI tăng dần theo thứ tự sinh, kể cả trong cùng một
  mili giây và trong một lô nhiều item. "Tăng dần" là so chuỗi chữ thường, tương đương so 16 byte (sửa khi checklist
  2026-10-29).
- **FR-004**: Collection hệ thống (danh sách collection hệ thống của Backoffice: `directus_*` và `backoffice_*` trong danh
  sách) PHẢI giữ UUID v4 như Directus 11.17.4, kể cả field special `uuid` do người dùng thêm vào.
- **FR-005**: Giá trị client gửi PHẢI giữ nguyên, không kiểm hay đổi phiên bản; kiểm UUID hợp lệ và lỗi như Directus
  11.17.4.
- **FR-006**: Sửa item PHẢI không sinh lại giá trị field special `uuid`, như hiện nay.
- **FR-007**: Không đổi id đã có, không có migration, không đổi default ở DB, không thêm bảng, cột, biến môi trường hay
  dependency.
- **FR-008**: Hành vi luôn bật, không có cấu hình tắt.
- **FR-009**: Ngoài giá trị id API tự sinh ở collection người dùng, request và response của Backoffice PHẢI giống Directus
  11.17.4: route, status, cấu trúc, lỗi, header, schema GraphQL, OAS. Response tạo theo lô (`POST` mảng,
  `create_<c>_items`) đọc lại item theo khóa chính như Directus, nên thứ tự mảng đi theo id: ở Backoffice trùng thứ tự
  gửi, ở Directus theo id v4 ngẫu nhiên (D-192; sửa khi checklist 2026-10-29).
- **FR-010**: Directus 11.17.4 cùng DB PHẢI đọc, lọc, sắp, sửa, xóa và dùng trong quan hệ được item có id v7; Backoffice
  làm được như vậy với id v4. Không validator nào trong luồng của hai app được từ chối giá trị v7 sinh ra ở collection
  người dùng; plan rà mọi validator UUID có ghim phiên bản.
- **FR-011**: Spec và research PHẢI ghi giới hạn cho feature phân trang con trỏ sau: id v4 đã có, id do Directus sinh và
  id client gửi không theo thời gian; giữa nhiều replica chỉ theo thứ tự mili giây của đồng hồ từng máy; thứ tự sắp của
  cột uuid trên từng vendor (Postgres, MySQL, MariaDB, SQLite, MSSQL, Oracle, CockroachDB) do plan kiểm và ghi kết quả.
  Kết quả ở research R5 (sửa khi plan 2026-10-29): Postgres 16 và SQLite đã đo đúng thứ tự tạo; MSSQL
  (`uniqueidentifier`) không theo thứ tự tạo theo tài liệu Microsoft; MySQL, MariaDB, Oracle, CockroachDB kiểm bằng test
  đối chiếu trên CI.
- **FR-012**: Spec 001–026 và code giữ nguyên ngoài chỗ sinh giá trị cho field special `uuid`; Directus không đổi file,
  biến môi trường hay cấu hình.

### Key Entities

- **Field special uuid**: field có cờ special `uuid`: khóa chính "Generated UUID" khi tạo collection, hoặc field kiểu
  uuid đặt "Generate and Save UUID". API sinh giá trị khi tạo item nếu field không có giá trị.
- **Collection hệ thống**: collection trong danh sách hệ thống của Backoffice (`directus_*`, `backoffice_migrations`,
  `backoffice_permissions`). Giữ UUID v4.
- **Collection người dùng**: mọi collection không phải collection hệ thống. Nhận UUID v7.
- **UUID v7**: UUID có 48 bit đầu là mốc thời gian Unix tính bằng mili giây, ký tự version `7`, phần còn lại là bộ đếm
  và số ngẫu nhiên; cùng dạng chuỗi với UUID v4.

### Đánh giá hiện trạng và chạy song song với Directus 11.17.4

Đọc code ngày 2026-10-29. Mục ghi [Inference] là suy ra từ code, plan PHẢI có test xác nhận.

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Khóa chính "Generated UUID" | Tạo cột uuid với `special: ['uuid']`, ẩn, chỉ đọc; DB không có default | `apps/web/src/modules/settings/routes/data-model/NewCollection.vue:123-130`; `directus/app/src/modules/settings/routes/data-model/new-collection.vue:159` |
| 2 | Field uuid không phải khóa chính | Tùy chọn "Generate and Save UUID" khi tạo đặt special `uuid` | `apps/web/src/modules/settings/routes/data-model/field-detail/advanced/AdvancedSchema.vue:168-179` |
| 3 | Chỗ sinh giá trị | Transformer `uuid` trả `randomUUID()` (v4) khi tạo và chưa có giá trị; giữ giá trị khác | `apps/api/src/services/payload.service.ts:86-91`; `directus/api/src/services/payload.ts:84-88` |
| 4 | Đường gọi transformer | Chạy cho mọi field có special khi xử lý payload; `processValues('create')` chỉ được gọi ở bước tạo item | `apps/api/src/services/payload.service.ts:337-363`; `apps/api/src/services/items.service.ts:221` |
| 5 | Nhận biết collection hệ thống | `directus_*` và `backoffice_*` có trong danh sách hệ thống | `libs/system-data/src/collections/index.ts:19-24`; `libs/system-data/src/collections/collections.yaml:129`, `:134` |
| 6 | Tên collection người dùng | Không tạo được collection bắt đầu bằng `directus_` | `apps/api/src/services/collections.service.ts:75-76` |
| 7 | Validator không kiểm phiên bản | Kiểm dạng 8-4-4-4-12, bỏ qua ký tự version | `apps/api/src/utils/is-valid-uuid.ts`, `apps/api/src/utils/validate-keys.ts:22`, `apps/api/src/constants.ts:140` |
| 8 | Validator ghim v4 | `role` của invite chỉ nhận uuidv4; đã thử 2026-10-29: id v7 lỗi "must be a valid GUID" | `apps/api/src/controllers/users.controller.ts:29`; `directus/api/src/controllers/users.ts:287` |
| 9 | Collection hệ thống có special uuid | `id` của 18 collection: access, comments, dashboards, deployments, deployment_projects, deployment_runs, extensions, files, flows, folders, operations, panels, policies, roles, shares, translations, users, versions | `directus/packages/system-data/src/fields/*.yaml` |
| 10 | Sinh v7 tăng dần trong một process | Gói `uuid` 11.1.0 giữ mốc mili giây và bộ đếm; đã thử 2026-10-29: 20 000 id sắp đúng thứ tự sinh | `apps/api/node_modules/uuid/dist/esm/v7.js:17-27` |
| 11 | Test ghim v4 | Chỉ key, secret của CLI, không phải id item | `apps/api/src/cli/commands/security/security.test.ts:21`, `apps/api/src/cli/commands/init/index.test.ts:34`, `tests/parity/src/bootstrap/cli.test.ts:170` |
| 12 | Test đối chiếu items | Dùng collection khóa uuid; đọc o2m có sort vì khóa ngẫu nhiên; id do flow tạo được thay bằng nhãn theo thứ tự tạo trước khi so (sửa khi plan) | `tests/parity/src/items/crud.test.ts:28-45`, `:124`; `tests/parity/src/permissions/flow.ts:1-3`, `:86-91` |
| 13 | Default ở DB | Chỉ cho `gen_random_uuid()`; không dùng cho khóa "Generated UUID" | `apps/api/src/constants.ts:106` |
| 14 | Web sinh khóa chính | Không; id tạm `_<nanoid>` của Insights được API thay | `apps/web/src/stores/insights.ts:489` |
| 15 | Kiểu cột uuid theo vendor (thêm khi plan) | `uuid` (Postgres, CockroachDB), `char(36)` (MySQL, MariaDB, SQLite, Oracle), `uniqueidentifier` (MSSQL); không default ở DB | `apps/api/src/services/fields.service.ts:956`, `:997-998`; Knex 3.1.0 (research R5) |
| 16 | Directus và UUID v7 (thêm khi plan) | Directus 11.17.4 tự ghi một UUID v7 vào `directus_settings.project_id` | `directus/api/src/database/migrations/20250613A-add-project-id.ts:2` |
| 17 | Benchmark tạo item (thêm khi plan) | Scenario `create` của benchmark-items dùng `bench_articles` khóa số tự tăng, không đo việc sinh UUID | `tests/benchmark/src/seed-items.ts:31`, `tests/benchmark/src/items.ts:60-68` |

**Kết luận** [Inference]: Directus không phải làm gì; DB, Redis, file không đổi. UUID v7 cùng dạng chuỗi nên hai app đọc
ghi lẫn nhau được. Validator ghim v4 duy nhất tìm thấy nằm ở collection hệ thống (role của invite), nên giữ v4 ở collection
hệ thống tránh được lỗi đó.

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021–026).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-192 | Giá trị API tự sinh cho field special `uuid` của collection người dùng (khóa chính "Generated UUID" và field "Generate and Save UUID") khi tạo item | UUID v4 ngẫu nhiên | UUID v7, tăng dần theo thứ tự sinh trong một instance; cùng dạng chuỗi 36 ký tự; id chứa thời điểm tạo tới mili giây (chấp nhận 2026-10-29); response tạo theo lô (`POST` mảng, `create_<c>_items`) đọc lại theo khóa chính nên giữ thứ tự gửi, Directus theo id v4 ngẫu nhiên; client kiểm id bằng mẫu phiên bản 1–5 từ chối id v7 (chấp nhận 2026-10-29, CHK019; sửa khi checklist và analyze 2026-10-29). Collection hệ thống giữ v4; id client gửi giữ nguyên | Chuẩn bị phân trang dạng con trỏ, chủ dự án 2026-10-29; Nguyên tắc II sửa ở constitution 3.4.0 | khác (duyệt 2026-10-29) | — |

**Cần xác nhận**:

- Không có. Đã chốt 2026-10-29: thời điểm tạo chứa trong id v7 (clarify); client ngoài và extension của bên thứ ba kiểm
  id bằng mẫu chỉ nhận phiên bản 1–5 sẽ từ chối id v7 do Backoffice sinh, ví dụ hàm `validate` của gói `uuid` 8.3.2 và
  9.0.1 (bản 11.1.0 và Joi 18.2.6 nhận; web, E2E của dự án và Directus app không có hàm kiểm như vậy): chủ dự án chấp
  nhận cùng lúc duyệt D-192 (checklist api-compat CHK019).

## Clarifications

### Session 2026-10-29 (chủ dự án, trước `/speckit.specify`)

- Q: Phạm vi collection? → A: chỉ field special `uuid` không có giá trị của collection do người dùng tạo; collection hệ
  thống giữ v4 (FR-001, FR-004, US3).
- Q: Field special `uuid` không phải khóa chính? → A: theo cùng quy tắc với khóa chính (FR-001, US1 kịch bản 5).
- Q: Field special `uuid` người dùng thêm vào collection hệ thống? → A: giữ v4 (FR-004, US3 kịch bản 3).
- Q: Bật thế nào? → A: luôn bật, không thêm biến môi trường (FR-008).
- Q: Sửa constitution hay chỉ ghi khác biệt? → A: sửa Nguyên tắc II, MINOR 3.3.0 → 3.4.0, bước 0 trước plan (Governance).
- Q: Lý do? → A: chuẩn bị phân trang dạng con trỏ ở feature sau; 027 không làm phân trang (FR-011).

### Session 2026-10-29 (chủ dự án, `/speckit.clarify`)

- Q: UUID v7 chứa thời điểm tạo item tới mili giây; collection không có field ngày tạo nay lộ thời điểm tạo cho ai đọc
  được id. Chấp nhận không? → A: chấp nhận, không thêm cảnh báo riêng ngoài spec (Assumptions, D-192).
- Q: Item tạo lồng trong một request (o2m, m2m, m2a) nhận giá trị theo collection nào? → A: theo collection của chính
  item: junction là collection người dùng nên nhận v7, kể cả junction tới collection hệ thống; file, user tạo lồng
  nhận v4 (FR-002, US1 kịch bản 6 và 8, US3 kịch bản 4).

### Sửa khi `/speckit.checklist` api-compat (2026-10-29, checklists/api-compat.md)

- D-192, FR-009, US4 kịch bản 3: thứ tự mảng của response tạo theo lô đi theo id (CHK003). Edge Cases: đọc không khác
  giữa hai app (CHK009); danh sách mặc định sắp theo khóa chính, item v7 đứng trước item v4 (CHK010). FR-003: cách so
  "tăng dần" (CHK024). Assumptions: căn cứ không trùng giữa replica (CHK025). "Cần xác nhận" và Assumptions: client ngoài
  kiểm id bằng mẫu phiên bản 1–5 (CHK019, chủ dự án chấp nhận 2026-10-29).

### Duyệt 2026-10-29 (chủ dự án kiêm tech lead)

- D-192 duyệt, kèm rủi ro client ngoài kiểm id bằng mẫu phiên bản 1–5 (CHK019).

### Sửa khi `/speckit.analyze` (2026-10-29)

- C1: SC-001 ghi đường extension đo qua cùng `ItemsService`, không có case riêng. C2: SC-002 tách 10 000 id ở unit test
  và thứ tự trên DB; T001 đo 10 000 lần gọi. I1: US3 kịch bản 4 nói file hoặc folder, test dùng folder. I2: US1 kịch bản
  3 và SC-002 trừ MSSQL. C3: fixture của T003 thêm m2a. I3: dòng D-192 bỏ "Cần xác nhận". I4: CHK005 ghi ngày duyệt.
  U1: không thêm task cho id cũ khi khởi động (FR-007), không trùng giữa replica (Assumptions, CHK025), đồng hồ lùi (thư
  viện, research R2). U2: T012 ghi trạng thái bảng R5 nếu T018 không chạy.

## Assumptions

- Phân trang dạng con trỏ ngoài phạm vi; 027 chỉ đổi cách sinh giá trị.
- Id v7 không trùng giữa replica: mỗi id có bộ đếm 32 bit khởi tạo ngẫu nhiên khi sang mili giây mới và 42 bit ngẫu
  nhiên (research R2); không thêm test deploy (sửa khi checklist 2026-10-29).
- Client ngoài kiểm id bằng mẫu chỉ nhận phiên bản 1–5 phải đổi sang mẫu nhận mọi phiên bản; chủ dự án chấp nhận
  2026-10-29 (CHK019).
- Id v7 cho biết thời điểm tạo item tới mili giây, kể cả ở collection không có field ngày tạo: chủ dự án chấp nhận
  (clarify 2026-10-29).
- Chi phí sinh UUID v7 nhỏ so với một lần ghi DB [Inference]; đo bằng benchmark items hiện có.
- Thứ tự tăng dần chỉ bảo đảm trong một instance; giữa replica dựa vào đồng hồ đã đồng bộ (NTP) của các máy.
- Extension và flow tạo item qua service items của Backoffice; extension tự ghi thẳng DB bằng Knex thì tự lo giá trị như
  hiện nay.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% item tạo qua mọi đường ở US1 (REST, GraphQL, import, flow, extension, item lồng, singleton) mà field
  special `uuid` không có giá trị nhận UUID v7. Đường extension không có case riêng: extension dùng cùng `ItemsService`
  (research R4, R7), nên được đo qua unit test transformer và các case REST, GraphQL, import, flow (sửa khi analyze
  2026-10-29).
- **SC-002**: Với 10 000 id sinh lần lượt và theo lô trên một instance, thứ tự so theo id trùng 100% thứ tự sinh (unit
  test); trên DB, thứ tự sắp theo id trùng thứ tự tạo trên mọi vendor trừ MSSQL (FR-011; sửa khi analyze 2026-10-29).
- **SC-003**: 100% item tạo ở collection hệ thống có field special `uuid` qua Backoffice nhận UUID v4; mời người dùng với
  role do Backoffice tạo thành công ở cả hai app.
- **SC-004**: 0 id client gửi bị đổi; 0 id có sẵn bị đổi; 0 field special `uuid` bị sinh lại khi sửa item.
- **SC-005**: 0 test đối chiếu, blackbox và E2E hiện có đổi kết quả, ngoài các chỗ so giá trị id tự sinh được ghi theo
  D-192.
- **SC-006**: Case đọc, lọc, sắp, sửa, xóa chéo item v4 và v7 giữa hai app đạt 100%.
- **SC-007**: Scenario benchmark items hiện có của Backoffice không tệ hơn Directus quá 10% (Nguyên tắc X). Scenario
  `create` hiện có dùng khóa số nên không đo việc sinh UUID; chi phí bộ sinh đo riêng ở research R8 (sửa khi plan).
