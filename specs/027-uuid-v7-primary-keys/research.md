# Research: Khóa chính uuid tự sinh dùng UUID v7

Đọc code và đo ngày 2026-10-29 (`apps/api`, `libs/system-data`, `tests/parity`, `tests/benchmark`, Knex 3.1.0, gói
`uuid` 11.1.0). Mỗi mục: Decision, Rationale, Alternatives. Mục ghi [Inference] là suy ra từ code hoặc tài liệu, có task
test xác nhận.

## R1. Chỗ chọn bộ sinh (FR-001, FR-004, FR-006)

**Decision**: chỉ sửa transformer `uuid` trong `apps/api/src/services/payload.service.ts:86-91`. Đổi method
`async uuid({ action, value })` thành arrow function để đọc `this.collection` của PayloadService:

```ts
// Backoffice (spec 027, D-192): DR always generates randomUUID() (v4); user collections get a UUID v7, system
// collections keep v4 (POST /users/invite accepts a v4 role only).
uuid: async ({ action, value }) => {
	if (action === 'create' && !value) return isSystemCollection(this.collection) ? randomUUID() : uuidv7();
	return value;
},
```

Thêm hai import: `v7 as uuidv7` từ `uuid`, `isSystemCollection` từ `@backoffice/system-data`. Điều kiện sinh
(`action === 'create' && !value`) giữ như DR, nên giá trị client gửi, sửa item và đọc item không đổi (FR-005, FR-006).

**Rationale**: `transformers` là field của class (`payload.service.ts:76`), nên arrow function trong đó có `this` là
PayloadService; method shorthand thì `this` là chính object `transformers`. Không đổi type `Transformers`
(`payload.service.ts:36-46`) và không đổi 12 lời gọi transformer trực tiếp trong `payload.service.test.ts` (port từ test
của DR). `this.collection` là collection của item đang xử lý: `processValues` đọc field của `this.collection`
(`payload.service.ts:226`), và ItemsService tạo PayloadService với `this.collection` (`items.service.ts:198`).

**Alternatives**: (a) thêm `collection` vào context của transformer ở `processField` (`payload.service.ts:350`, gợi ý
của lệnh plan): phải sửa type `Transformers` và thêm field vào 12 lời gọi trong test, hoặc để field tùy chọn và tự quyết
khi thiếu; (b) chọn bộ sinh trong `processField` theo `special === 'uuid'`: tách logic của một special ra hai chỗ;
(c) sinh id ở `ItemsService.createOne`: bỏ sót field special uuid không phải khóa chính (FR-001); (d) default ở DB
(`uuidv7()` của Postgres 18): chỉ một vendor, Directus 11.17.4 không tạo default cho khóa "Generated UUID".

## R2. Bộ sinh UUID v7 (FR-001, FR-003, FR-007)

**Decision**: `v7()` của gói `uuid` 11.1.0: đã là dependency chạy của `apps/api` (`apps/api/package.json`,
`dependencies.uuid: catalog:`, catalog `pnpm-workspace.yaml:167`), đã dùng ở migration port nguyên văn
`apps/api/src/database/migrations/20250613A-add-project-id.ts:3` (DR dùng đúng hàm này ở
`directus/api/src/database/migrations/20250613A-add-project-id.ts:2`). Không thêm dependency.

**Rationale**:

- Gói giữ trạng thái mốc mili giây và bộ đếm ở mức module (`apps/api/node_modules/uuid/dist/esm/v7.js:3`, `:17-27`):
  cùng mili giây thì tăng bộ đếm, đồng hồ lùi thì giữ mốc cũ và tăng bộ đếm. Một process chỉ nạp một bản module, nên
  mọi PayloadService trong process dùng chung một trạng thái: id tăng dần theo thứ tự sinh (FR-003).
- Kết quả là chữ thường, dạng 8-4-4-4-12, ký tự thứ 15 là `7` (đo ở mục "Kết quả đo").
- Phần ngẫu nhiên đủ lớn để nhiều replica sinh cùng mili giây không trùng (US4 kịch bản 5) [Inference]: mỗi id có 48 bit
  mốc thời gian, bộ đếm 32 bit (khởi tạo ngẫu nhiên khi sang mili giây mới) và 42 bit ngẫu nhiên (`v7.js:32-62`).
- Node 22 chỉ có `randomUUID()` (v4), không có hàm sinh v7.

**Alternatives**: (a) tự viết v7 bằng `crypto.getRandomValues` và `Date.now()`: thêm code, phải tự lo bộ đếm trong cùng
mili giây; (b) gói `uuidv7` hoặc tương tự: dependency mới, trái ý chủ dự án; (c) `crypto.randomUUID()` rồi ghi đè 6
byte đầu bằng thời gian: không tăng dần trong cùng mili giây.

## R3. Nhận biết collection hệ thống (FR-004, clarify)

**Decision**: `isSystemCollection(collection)` của `@backoffice/system-data`
(`libs/system-data/src/collections/index.ts:19-24`), cùng helper mà `items.controller.ts:5`, `:41` đang dùng. Hàm trả
`true` cho collection trong danh sách hệ thống: `directus_*` và `backoffice_migrations`, `backoffice_permissions`
(`libs/system-data/src/collections/collections.yaml:129`, `:134`). Collection người dùng là mọi collection còn lại.

**Rationale**: không tự viết danh sách mới (lệnh plan); người dùng không tạo được collection bắt đầu bằng `directus_`
(`apps/api/src/services/collections.service.ts:75-76`), nên mọi `directus_*` đi qua PayloadService là hệ thống. Collection
người dùng tên `backoffice_<x>` không có trong danh sách nên nhận v7, đúng Edge Cases của spec. Field người dùng thêm vào
collection hệ thống đi theo collection nên giữ v4 (clarify trước specify).

**Alternatives**: (a) kiểm tiền tố `directus_`: bỏ sót `backoffice_*` hệ thống; (b) kiểm tiền tố `directus_` và
`backoffice_`: sai với collection người dùng tên `backoffice_<x>`; (c) đọc cờ hệ thống từ SchemaOverview: SchemaOverview
không có cờ này, và helper đã có.

## R4. Mọi đường tạo item đi qua transformer (FR-002, clarify câu 2)

**Decision**: không sửa chỗ nào khác. `processValues('create')` chỉ được gọi ở `ItemsService.createOne`
(`items.service.ts:221`); các đường tạo item đều tới đó:

| Đường                                   | Gọi                                                                                  | Nguồn                                                                 |
|-----------------------------------------|--------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| REST `POST /items/:c` (một item, mảng)  | `createOne`, `createMany` (vòng lặp tuần tự gọi `createOne` theo thứ tự mảng)        | `items.service.ts:448-457`                                            |
| `PATCH /items/:c` singleton chưa có item | `upsertSingleton` → `createOne`                                                      | `items.service.ts:1241-1250`                                          |
| GraphQL `create_<c>_item(s)`            | `createOne`, `createMany`                                                            | `services/graphql/resolvers/mutation.ts:55`, `:72`                    |
| `POST /utils/import/:c`                 | `upsertOne` (dòng không có khóa → `createOne`)                                       | `services/import-export.service.ts:354-375`, `:471-505`; `items.service.ts:984` |
| Flow `item-create`                      | `createMany`                                                                         | `operations/item-create/index.ts:45`                                  |
| Extension                               | `services.ItemsService` của host, cùng class                                         | `tests/fixtures/extensions/parity-endpoint-demo/src/index.js:15` (cách dùng) |
| Item lồng (o2m, m2m, m2a, m2o)          | `getService(<collection liên quan>)` → service của chính collection đó, PayloadService riêng | `payload.service.ts:600`, `:701`, `:804`; `utils/get-service.ts`  |

Item lồng nhận giá trị theo collection của chính nó vì mỗi service có PayloadService của collection đó (clarify câu 2):
junction là collection người dùng nên v7; `directus_files`, `directus_users`, `directus_folders` qua `FilesService`,
`UsersService`, `FoldersService` (đều `extends ItemsService` với tên hệ thống) nên v4.

**Rationale**: một chỗ sửa phủ mọi đường; `createMany` tuần tự nên id của một lô tăng theo thứ tự mảng (US1 kịch bản 2).

**Ngoài phạm vi, không đổi**: field uuid không có special `uuid` mà có default ở DB `gen_random_uuid()`
(`ALLOWED_DB_DEFAULT_FUNCTIONS`, `apps/api/src/constants.ts:106`): DB sinh v4 như hiện nay; khóa uuid "manual": client
phải gửi. Ghi vào Edge Cases của spec (R11).

## R5. Thứ tự sắp theo vendor (FR-011)

**Decision**: ghi bảng dưới làm giới hạn cho feature phân trang con trỏ sau; test đối chiếu mới kiểm thứ tự trên mọi
vendor nó chạy (R7): PR CI chạy Postgres, MySQL, SQLite (`.github/workflows/ci.yml`, ma trận parity); MariaDB, MSSQL,
Oracle, CockroachDB, Postgres 10 chạy ở `nightly.yml:29` (chạy tay, chủ dự án quyết định, như T055 của 023).

Kiểu cột: FieldsService tạo cột bằng `table[field.type](field.field)` (`apps/api/src/services/fields.service.ts:956`),
tức `table.uuid(name)` không tùy chọn, rồi `column.primary().notNullable()` cho khóa chính (`:997-998`); không default ở
DB; kiểu cột do Knex 3.1.0 quyết định. Image của env parity: `tests/parity/docker-compose.yml:72-148` (`mysql:8`,
`mysql:5`, `mariadb:11.4`, `mcr.microsoft.com/mssql/server:2022-latest`, `gvenzl/oracle-xe:21-slim-faststart`,
`cockroachdb/cockroach:latest-v24.3`).

| Vendor                   | Kiểu cột (Knex 3.1.0)                                   | `ORDER BY id` với v7                                    | Nguồn                                                                                     | Trạng thái                      |
|--------------------------|---------------------------------------------------------|---------------------------------------------------------|-------------------------------------------------------------------------------------------|---------------------------------|
| Postgres 16 (và 10)      | `uuid` (`pg-columncompiler.js:128-133`)                 | Theo thứ tự tạo; `id > x` trả đúng các dòng kế tiếp     | Đo 2026-10-29 trên 16.15 (mục "Kết quả đo")                                               | 16 đã đo; 10 ở nightly          |
| SQLite                   | `char(36)` (`lib/schema/columncompiler.js:280-283`)     | Theo thứ tự tạo                                          | Đo 2026-10-29 (sqlite3 5.1.7)                                                              | Đã đo; PR CI                    |
| MySQL 8, MySQL 5         | `char(36)` (cột cơ sở, không ghi đè)                    | [Inference] theo thứ tự tạo                              | Chuỗi hex chữ thường cùng độ dài, gạch nối cùng vị trí; collation mặc định xếp `0-9` trước `a-f` | PR CI (MySQL 8); MySQL 5 không chạy ở CI (`nightly.yml:29` không có `mysql5`) |
| MariaDB                  | `char(36)` (Knex dùng client mysql)                     | [Inference] như MySQL                                    | Như trên; Directus không tạo kiểu `UUID` riêng của MariaDB                                | Nightly                         |
| Oracle                   | `char(36)` (`oracledb-columncompiler.js:58-59`)         | [Inference] theo thứ tự tạo với `NLS_SORT=BINARY` mặc định | Như trên                                                                                  | Nightly                         |
| CockroachDB              | `uuid` (`crdb-columncompiler.js:4-10`, không default vì không truyền `primaryKey`) | [Inference] theo thứ tự tạo (so 16 byte) | Không tìm thấy tài liệu nói rõ cách so UUID                                    | Nightly                         |
| MSSQL                    | `uniqueidentifier` (`mssql-columncompiler.js:179-180`)  | **Không** theo thứ tự tạo                                | Tài liệu Microsoft: 6 byte cuối quan trọng nhất khi so ([SqlGuid.CompareTo](https://learn.microsoft.com/en-us/dotnet/api/system.data.sqltypes.sqlguid.compareto), [Comparing GUID and uniqueidentifier values](https://learn.microsoft.com/en-us/dotnet/framework/data/adonet/sql/comparing-guid-and-uniqueidentifier-values)); mốc thời gian của v7 ở 6 byte đầu. [Unverified] Thứ tự đầy đủ byte 10–15, 8–9, 6–7, 4–5, 0–3 theo bài đo của [dbi-services](https://www.dbi-services.com/blog/why-uuidv7-does-not-reduce-fragmentation-in-sql-server/) | Tài liệu; nightly xác nhận      |

Giới hạn khác cho feature phân trang con trỏ (spec FR-011, Edge Cases): id v4 có sẵn, id do Directus sinh và id client
gửi không theo thời gian; giữa nhiều replica chỉ theo mili giây của đồng hồ từng máy; sau khi process khởi động lại, bộ
đếm bắt đầu lại từ đồng hồ máy.

**Alternatives**: (a) kéo image MySQL, MariaDB, MSSQL, Oracle, CockroachDB về máy để đo ngay: cần bạn cho phép tải
image; nightly đã có sẵn các vendor đó; (b) không kiểm thứ tự trong test: trái FR-011.

## R6. Validator UUID trong luồng hai app (FR-010)

**Decision**: không sửa validator nào. Kết quả rà:

| Chỗ                                                            | Kiểm phiên bản | Ảnh hưởng                                                                    |
|----------------------------------------------------------------|----------------|-------------------------------------------------------------------------------|
| `isValidUuid` (`apps/api/src/utils/is-valid-uuid.ts`, bản DR)  | Không          | Khóa v7 qua `validateKeys` (`validate-keys.ts:22`)                            |
| `UUID_REGEX` (`constants.ts:140`, `middleware/router-options.ts:68-86`) | Không | Route của flow, share, extension (collection hệ thống)                       |
| GraphQL: kiểu `uuid` → `GraphQLID` (`utils/get-graphql-type.ts:50-51`) | Không | Không kiểm định dạng                                                          |
| Joi `role` của `POST /users/invite` (`controllers/users.controller.ts:29`, DR `users.ts:287`) | Chỉ `uuidv4` | Role là collection hệ thống nên vẫn v4 (R3); đã thử: id v7 bị từ chối |
| Web app, `@directus/sdk`, Directus app                         | Không tìm thấy | `grep` 2026-10-29 trên `apps/web/src`, `apps/web-e2e/src`, `directus/app/src` không có kiểm phiên bản |
| Client ngoài, extension bên thứ ba (ngoài luồng của hai app)   | Tùy thư viện   | Đã thử 2026-10-29: `validate` của gói `uuid` 8.3.2, 9.0.1 trả `false` cho id v7; `uuid` 11.1.0 và Joi 18.2.6 (`guid()`, `uuid()`) nhận. Chủ dự án chấp nhận 2026-10-29 (checklist CHK019) |

Directus 11.17.4 tự ghi một UUID v7 vào `directus_settings.project_id` (migration `20250613A`), nên giá trị v7 trong DB
dùng chung không lạ với Directus.

Với v7, 8 ký tự đầu của id là mốc thời gian, chỉ đổi khoảng mỗi 65 giây. `grep` 2026-10-29 trên `apps/api/src`,
`apps/web/src`, `libs/*/src`, `directus/app/src`, `directus/api/src`: không có code nào cắt phần đầu id item để làm khóa
hay tên (các `slice(0, n)`, `split('-')[0]` tìm thấy là tên file migration, ngôn ngữ, log).

**Test ghim v4 có sẵn**: `cli/commands/security/security.test.ts:21`, `cli/commands/init/index.test.ts:34`,
`tests/parity/src/bootstrap/cli.test.ts:170` kiểm key, secret của CLI, không phải id item: giữ nguyên.

## R7. Test đối chiếu (Nguyên tắc V, SC-001..SC-006)

**Decision**:

- File mới `tests/parity/src/items/uuid-v7.test.ts`, thêm vào `REDUCED_FILES` và mẫu `FULL_FILES`
  (`tests/parity/src/suite.ts:3-17`, `:43-47`) nên chạy trên Postgres, MySQL, SQLite ở PR CI và các vendor khác ở
  nightly. Case ở [contracts/tests.md](./contracts/tests.md).
- `tests/parity/src/flows/operations.test.ts` (case `item-create`, collection khóa uuid ở `:36-42`): kiểm id do flow tạo
  là v7 ở Backoffice, v4 ở Directus.
- `tests/parity/accepted-differences.ts`: D-192 `kind: 'doc'`, feature `027`. Test so từng app riêng (như D-188.1,
  D-188.2 của 024), không đi qua bộ so sánh response, vì id tự sinh vốn khác nhau giữa hai app.

**Rationale**: các test ghi có sẵn thay id do flow tạo bằng nhãn theo thứ tự tạo
(`tests/parity/src/permissions/flow.ts:1-3`, `:86-91`), nên đổi phiên bản không làm đổi transcript; đọc o2m trong
`items/crud.test.ts:124` đã sắp riêng vì khóa ngẫu nhiên, và Directus vẫn sinh v4 ngẫu nhiên. Blackbox seed giá trị uuid
bằng v5 cố định (`items/blackbox/common/seed-functions.ts:4`), không sinh qua API.

**Alternatives**: (a) entry D-192 `http` cho bộ so sánh: không có request nào so `data.id` tự sinh giữa hai app, vì id
ngẫu nhiên ở cả hai; (b) thêm fixture extension có endpoint tạo item: phải build lại bộ extension mẫu; đường extension
dùng chung `ItemsService` (R4), nên unit test transformer cộng các case REST, GraphQL, import, flow là đủ (giới hạn ghi ở
contracts/tests.md).

## R8. Unit test và hiệu năng (Nguyên tắc X, SC-007)

**Decision**: unit test trong `apps/api/src/services/payload.service.test.ts` (case ở contracts/tests.md); không thêm
scenario benchmark.

**Rationale**: scenario `create` của benchmark-items tạo item ở `bench_articles` có khóa số tự tăng
(`tests/benchmark/src/seed-items.ts:31`, `items.ts:60-68`), nên không đo việc sinh UUID; đo riêng chi phí bộ sinh (mục
"Kết quả đo"): v7 thêm khoảng 0,2 micro giây mỗi id so với `randomUUID()`, nhỏ so với một request ghi DB tính bằng mili
giây [Inference]. benchmark-items hiện có vẫn là cổng của SC-007.

**Alternatives**: thêm scenario tạo item khóa uuid vào benchmark-items: tốn thời gian CI, và so v7 của Backoffice với v4
của Directus trên index B-tree, tức so cách ghi index chứ không so code.

## R9. Tài liệu

**Decision**: spec (R11, duyệt D-192 sau plan), `CLAUDE.md` (một dòng "planned" ở Active Technologies lúc plan; Recent
Changes lúc đóng feature), `tests/parity/README.md` (mục "Test items": file mới), `SPECKIT-GUIDE.md` (trạng thái 027).

Không ghi D-192 vào `design-system/docs/migration-guide.md`: file đó là hướng dẫn chuyển giao diện sang TailAdmin, mục
"Decisions" chỉ có quyết định giao diện (C-1, C-2, L-1..L-4, B-1; nhắc D-158, D-172, D-176), không có mã D nào của API
(D-184..D-189 không có ở đó). D-192 không đổi giao diện.

Không chạy `.specify/scripts/bash/update-agent-context.sh`: script giữ 2 dòng đầu của mục "Recent Changes" trong
`CLAUDE.md` và bỏ các dòng còn lại (`update-agent-context.sh:457`); dòng Active Technologies ghi tay như plan 024.

## R10. Chia lượt

**Decision**: một lượt: transformer + unit test, test đối chiếu (file mới, flows, accepted-differences, suite),
tài liệu, kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, commit, push theo quy tắc chung checkout, CI xanh,
`graphify update .`). Chạy `nightly.yml` cho MariaDB, MSSQL, Oracle, CockroachDB là task riêng, chủ dự án quyết định.

## Kết quả đo (2026-10-29, máy local Apple Silicon)

Bộ sinh, Node 22.23.1, `uuid` 11.1.0, 1 000 000 lần mỗi hàm, 3 vòng sau 200 000 lần khởi động:

| Vòng | `randomUUID()` | `v7()`    |
|------|----------------|-----------|
| 1    | 29 ns/op       | 237 ns/op |
| 2    | 27 ns/op       | 227 ns/op |
| 3    | 81 ns/op       | 225 ns/op |

Mẫu: `01a183b8-b2e6-702d-b7a6-950461f9dfd4`, phiên bản 7, chữ thường.

Thứ tự sắp, bảng tạo bằng Knex `table.uuid('id').primary()` như FieldsService, 5 000 id v7 (4 000 sinh liền, 1 000 sinh
cách nhau một vòng event loop), chèn theo thứ tự xáo trộn, đọc `ORDER BY id`:

| DB                        | Kiểu cột    | Số mốc mili giây khác nhau | `ORDER BY id` = thứ tự tạo | Bước `id > ids[2500]` |
|---------------------------|-------------|----------------------------|----------------------------|-----------------------|
| SQLite (sqlite3 5.1.7)    | `char(36)`  | 19                         | Đúng                       | (không đo)            |
| Postgres 16.15 (container tạm từ image `postgres:16-alpine` có sẵn, đã xóa) | `uuid` | 20 | Đúng | 2501, 2502, 2503 |

## R11. Sửa spec khi plan (câu chữ, áp vào spec cùng commit plan)

- Bảng "Đánh giá hiện trạng" dòng 12: bỏ [Inference], dẫn `tests/parity/src/permissions/flow.ts` (id thay bằng nhãn).
- Thêm dòng hiện trạng: kiểu cột uuid theo vendor (R5); Directus tự ghi v7 vào `project_id` (R6); scenario `create` của
  benchmark-items dùng khóa số (R8).
- FR-011: dẫn kết quả R5 (Postgres, SQLite đã đo; MSSQL không theo thứ tự tạo; vendor khác kiểm ở CI).
- Edge Cases: field uuid không có special `uuid` mà có default `gen_random_uuid()` ở DB vẫn nhận v4 do DB sinh; khóa uuid
  "manual" vẫn do client gửi (R4).
- SC-007: ghi rõ scenario `create` hiện có không đo việc sinh UUID; chi phí bộ sinh đo riêng ở research R8.
