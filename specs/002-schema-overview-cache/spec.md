# Feature Specification: Schema overview và cache dùng chung

**Feature Branch**: `002-schema-overview-cache`
**Created**: 2026-10-10
**Status**: Draft
**Input**: User description: "API cần dựng được bức tranh schema (collections, fields, relations, kiểu dữ liệu, khóa chính, alias field) từ DB và các bảng directus_collections, directus_fields, directus_relations, giống hệt SchemaOverview của Directus (tham chiếu directus/api/src/utils/get-schema.ts và packages/schema). Schema được cache trong Redis với cùng cache key và namespace như Directus. Khi Directus hoặc app mới đổi schema, instance còn lại nhận tín hiệu qua cùng kênh bus của Directus và xóa cache. Hỗ trợ CACHE_SCHEMA, CACHE_NAMESPACE, CACHE_STORE và các biến cache khác giống Directus. Tiêu chí chấp nhận: thêm field ở Directus thì app mới thấy field đó ngay mà không cần khởi động lại, và ngược lại."

**Tham chiếu Directus** (chỉ đọc):

- Dựng schema: `directus/api/src/utils/get-schema.ts` (`getSchema`, `getDatabaseSchema`), `get-local-type.ts`,
  `get-default-value.ts`, `get-field-system-rows.ts`, `directus/api/src/services/relations.ts` (`readAll`),
  `directus/packages/schema`, `directus/packages/system-data`.
- Cache: `directus/api/src/cache.ts` (`getCache`, `clearSystemCache`, `setMemorySchemaCache`,
  `getMemorySchemaCache`), `directus/api/src/utils/freeze-schema.ts`, `directus/api/src/middleware/schema.ts`.
- Bus và lock: `directus/api/src/bus`, `directus/api/src/lock`, `directus/packages/memory` (bus Redis, kv,
  cache `multi`, cách mã hóa và nén message).
- Permissions cache: `directus/api/src/permissions/cache.ts`, `permissions/utils/with-cache.ts`.
- Biến môi trường: `directus/packages/env/src/constants/defaults.ts`, `directus-variables.ts`.

**Đã có từ feature 001**: `apps/api/src/schema/get-database-schema.ts` dựng SchemaOverview mới ở mỗi lần
gọi (như Directus với `CACHE_SCHEMA=false`), chỉ dùng cho `/server/specs/oas` (FR-049 của 001). Feature này
thêm cache, lock, bus và đưa bước dựng schema vào mọi request giống Directus. Feature này gỡ khác biệt D-20,
D-22 và thu hẹp D-13 của spec 001.

## Clarifications

### Session 2026-10-10

- Q: Schema cache có nằm trong Redis không? (Directus 11.17.4 giữ SchemaOverview trong bộ nhớ process, Redis
  chỉ dùng cho lock, bus và cache hệ thống.) → A: Làm đúng như Directus: schema trong bộ nhớ process, phối
  hợp qua lock và bus trên Redis, không thêm key Redis mới (FR-010).
- Q: Chiều "app mới đổi schema thì Directus thấy" được kiểm ở 002 bằng cách nào? → A: 002 làm thao tác xóa
  cache hệ thống (tương đương `clearSystemCache`); test đối chiếu gọi nó trong process app mới, không qua
  HTTP. Kiểm end-to-end qua API ở feature 006 (FR-020).
- Q: SC-003 "dựng đúng 1 lần" đo thế nào, khi Directus chỉ chia schema cho process đang chờ? → A: Mỗi process
  dựng tối đa 1 lần cho mỗi lần cache bị xóa; 20 request đồng thời tới trong lúc một process đang dựng thì
  toàn hệ thống dựng đúng 1 lần (SC-003).
- Q: Redis mất kết nối giữa chừng thì sao? → A: Giống Directus: cache còn thì chạy tiếp; cache trống thì
  request trả `500` sau khi kết nối Redis thử lại theo mặc định; có ca test cho cả hai trường hợp (FR-024).
- Q: Ngưỡng "thấy ngay" là bao lâu? → A: 1 giây: mọi request gửi từ 1 giây sau response của bên đổi schema
  thấy schema mới (SC-001).
- Q: Permissions cache dùng chung có thuộc 002 không? → A: Có: port cache hai lớp và `withCache` giống
  Directus, `fetchPolicies`/`fetchPermissions` của feature 001 đi qua cache này, gỡ D-22, benchmark
  `/server/specs/oas` chặn CI (FR-019, SC-005).

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là đội vận hành (chạy Directus và app mới song song trên cùng DB và Redis),
client gọi API (thấy dữ liệu theo schema hiện tại) và lập trình viên các feature sau (dùng SchemaOverview
làm nền cho items, permissions, GraphQL).

### User Story 1 - Schema đồng bộ giữa Directus và app mới mà không khởi động lại (Priority: P1)

Quản trị viên thêm, sửa hoặc xóa field, collection hay relation trên Directus. Ngay sau khi Directus trả
response thành công, mọi instance app mới dùng schema mới cho mọi request gửi tới từ 1 giây sau đó (SC-001),
không cần khởi động lại.
Chiều ngược lại cũng đúng: khi app mới đổi schema, mọi instance Directus dùng schema mới.

**Why this priority**: Đây là tiêu chí chấp nhận của feature và là điều kiện chạy song song an toàn
(Nguyên tắc IV). Nếu một bên giữ schema cũ, nó đọc sai cột, bỏ sót field mới hoặc lỗi khi truy vấn.

**Independent Test**: Chạy Directus và hai instance app mới trên cùng DB và Redis, cache schema bật (mặc
định). Gọi `/server/specs/oas` ở app mới để làm ấm cache. Thêm một field vào collection mà public đọc được
qua `POST /fields/<collection>` của Directus. Gọi lại `/server/specs/oas` ở cả hai instance app mới: tài
liệu có field mới. Chiều ngược lại: đổi schema trực tiếp trên DB, gọi thao tác xóa cache hệ thống trong process app mới
(FR-020), rồi gọi lại `/server/specs/oas` ở Directus: tài liệu có thay đổi đó.

**Acceptance Scenarios**:

1. **Given** app mới đã cache schema, **When** Directus thêm field `rating` vào collection `articles` và
   trả `200`, **Then** mọi request gửi từ 1 giây sau đó tới mọi instance app mới thấy `rating` trong schema
   (ví dụ trong `/server/specs/oas` khi public đọc được `articles`).
2. **Given** app mới đã cache schema, **When** Directus xóa một field, đổi kiểu một field, tạo hoặc xóa
   collection, tạo hoặc xóa relation, **Then** mọi request gửi từ 1 giây sau đó tới app mới phản ánh đúng
   thay đổi đó.
3. **Given** Directus đã cache schema và schema trên DB đã đổi, **When** app mới chạy thao tác xóa cache
   hệ thống (FR-020), **Then** mọi request gửi từ 1 giây sau đó tới Directus thấy thay đổi đó.
4. **Given** Directus thay đổi quyền (policy, permission, access, role, user) hoặc gọi
   `POST /utils/cache/clear`, **When** Directus phát tín hiệu xóa cache hệ thống, **Then** app mới cũng xóa
   cache schema và permissions cache của nó, giống một instance Directus khác.
5. **Given** cấu hình không có Redis (bus và lock chỉ trong process), **When** Directus đổi schema, **Then**
   app mới không nhận tín hiệu (giống hai instance Directus không có Redis), và cảnh báo "chỉ an toàn khi
   chạy một instance" của feature 001 vẫn được ghi khi khởi động.

---

### User Story 2 - SchemaOverview giống hệt Directus (Priority: P1)

Với cùng DB và cùng cấu hình, SchemaOverview app mới dựng ra giống hệt SchemaOverview của Directus 11.17.4:
cùng danh sách collection, khóa chính, singleton, note, sort field, accountability; cùng danh sách field với
kiểu dữ liệu, kiểu DB, giá trị mặc định, nullable, generated, precision, scale, special, note, validation,
alias, searchable; cùng danh sách relation. Mọi feature sau (items, permissions, GraphQL, OpenAPI) dựa vào
bức tranh này nên phải đúng từng giá trị.

**Why this priority**: Schema sai một giá trị thì mọi endpoint dựa vào nó trả khác Directus. Hai bên còn
trao đổi nguyên SchemaOverview qua bus (FR-012), nên schema do bên này dựng phải dùng được ở bên kia.

**Independent Test**: Trên DB của bộ test đối chiếu (gồm collection người dùng có đủ loại field: số, chuỗi,
ngày giờ, JSON, uuid, geometry, alias o2m, m2m, m2a, translations, presentation, group, field `no-data`,
bảng không khóa chính, bảng có dấu cách, bảng trong `DB_EXCLUDE_TABLES`), lấy SchemaOverview của Directus
(qua message `schemaCache--done` trên bus) và của app mới, rồi so sánh toàn bộ cây giá trị.

**Acceptance Scenarios**:

1. **Given** DB có collection `articles` với khóa chính `id`, field `title` (chuỗi, mặc định `untitled`),
   `price` (decimal 10,2), relation m2o `author` tới `directus_users`, **When** app mới dựng schema,
   **Then** từng giá trị của collection, field và relation giống Directus.
2. **Given** field có `special` thuộc nhóm alias (`alias`, `o2m`, `m2m`, `m2a`, `o2a`, `files`, `translations`),
   **When** dựng schema, **Then** field alias có `type: 'alias'`, `alias: true`, `dbType: null`;
   field có `special` chứa `no-data` không có trong schema, giống Directus.
3. **Given** bảng không có khóa chính, tên có dấu cách, hoặc nằm trong `DB_EXCLUDE_TABLES`, **When** dựng
   schema, **Then** bảng đó bị bỏ qua và log `warn` hoặc `trace` giống Directus.
4. **Given** collection hệ thống `directus_*`, **When** dựng schema, **Then** thông tin collection, field và
   relation hệ thống lấy từ dữ liệu hệ thống của Directus 11.17.4.
5. **Given** cả 6 loại DB Directus hỗ trợ, **When** dựng schema trên cùng dữ liệu mẫu, **Then** kết quả giống
   Directus trên DB đó. Postgres, MySQL, SQLite kiểm ở mỗi lần push. MariaDB, MSSQL, Oracle, CockroachDB kiểm
   khi lịch chạy hằng đêm được bật lại (đang tắt, Complexity Tracking của 001).

---

### User Story 3 - Nhiều instance khởi động cùng lúc dựng schema một lần (Priority: P2)

Khi nhiều instance (Directus và app mới) cùng cần schema lúc cache trống (khởi động đồng loạt, hoặc ngay
sau khi schema đổi), chỉ một process dựng schema từ DB. Các process khác chờ và nhận kết quả qua bus, giống
cơ chế của Directus.

**Why this priority**: Dựng schema tốn nhiều truy vấn. Nếu mọi instance cùng dựng sau mỗi lần đổi schema,
DB chịu tải dồn. Directus đã có cơ chế này, app mới phải tham gia cùng cơ chế để không phá nó.

**Independent Test**: Xóa cache bằng tín hiệu `schemaChanged`, rồi gửi đồng thời request tới Directus và
nhiều instance app mới trong lúc một process đang dựng schema. Đếm số message `schemaCache--done` (mỗi lần dựng
phát đúng 1 message): chỉ một process dựng schema. Request tới sau khi lần dựng đó đã xong có thể làm process của nó dựng lại một
lần, giống Directus (SC-003).

**Acceptance Scenarios**:

1. **Given** cache schema trống ở mọi instance, **When** nhiều request tới cùng lúc ở nhiều instance,
   **Then** chỉ process giữ lượt đầu của khóa `schemaCache--preparing` dựng schema; các process khác nhận
   schema qua message `schemaCache--done`.
2. **Given** process đang dựng schema bị lỗi (ví dụ DB mất kết nối), **When** nó phát `schemaCache--done`
   với schema rỗng, **Then** các process đang chờ thử lại (tối đa 3 lần). Nếu DB vẫn lỗi, request trả `500`
   giống Directus. Nếu DB đã ổn, process thử lại tự dựng schema.
3. **Given** không nhận được message trong `CACHE_SCHEMA_SYNC_TIMEOUT` mili giây, **When** hết thời gian chờ,
   **Then** process thử lại giống Directus.

---

### User Story 4 - Cấu hình cache giống Directus (Priority: P2)

Đội vận hành dùng nguyên các biến `CACHE_*` và `REDIS_*` của Directus. App mới đọc đúng tên, đúng mặc định
và có cùng tác dụng như Directus với các phần cache thuộc feature này.

**Why this priority**: Nguyên tắc VIII. Một bộ cấu hình cho cả hai app.

**Independent Test**: Chạy test với `CACHE_SCHEMA` (`true`, `false`), `CACHE_NAMESPACE` và các
`REDIS_*_NAMESPACE` tùy chỉnh; kiểm tra key và kênh trên Redis giống Directus cùng cấu hình. `CACHE_STORE=redis`
(env đối chiếu) kiểm bằng test đối chiếu; `CACHE_STORE=memory` kiểm bằng unit test, vì env đối chiếu dùng chung
Redis.

**Acceptance Scenarios**:

1. **Given** `CACHE_SCHEMA=false`, **When** mỗi request tới, **Then** app mới dựng schema mới từ DB, không
   dùng lock hay bus để dựng, giống Directus.
2. **Given** `CACHE_NAMESPACE=myapp` và `CACHE_STORE=redis`, **When** app mới ghi hoặc xóa cache hệ thống,
   **Then** key trên Redis nằm trong namespace `myapp_system`, `myapp_lock` giống Directus.
3. **Given** `REDIS_BUS_NAMESPACE`, `REDIS_LOCK_NAMESPACE`, `REDIS_PERMISSIONS_NAMESPACE` đặt giá trị riêng,
   **When** chạy, **Then** app mới dùng đúng các namespace đó; khi không đặt thì dùng `directus:bus`,
   `directus:lock`, `permissions`.
4. **Given** `CACHE_SCHEMA_FREEZE_ENABLED` bật hoặc tắt, **When** code trong app lấy schema, **Then** nhận bản
   đóng băng (không sửa được) hoặc bản sao sửa được, giống Directus.
5. **Given** Redis không truy cập được và `CACHE_STORE=redis`, **When** có request đầu tiên đi qua bước `cache`
   (lúc Directus tạo các instance Keyv), **Then** log `warn`
   có tiền tố `[system-cache]`, `[deployment-cache]`, `[lock-cache]` (và `[cache]` khi `CACHE_ENABLED=true`)
   giống Directus (gỡ D-20).

---

### Edge Cases

- Thay đổi schema làm thẳng trên DB (DDL hoặc ghi `directus_fields` bằng SQL), không qua Directus hay app
  mới: không bên nào phát tín hiệu, cả hai giữ schema cũ tới khi có tín hiệu xóa cache hoặc khởi động lại.
  Giống Directus.
- Redis mất kết nối (FR-024): khi cache schema còn trong bộ nhớ, request chạy bình thường, nhưng tín hiệu
  `schemaChanged` phát trong lúc đó bị mất (pub/sub không lưu lại) và instance giữ schema cũ tới tín hiệu kế
  tiếp. Khi cache schema trống, bước tăng khóa `schemaCache--preparing` lỗi sau khi kết nối Redis thử lại theo
  mặc định, và request trả `500`, tới khi Redis trở lại. Giống Directus; không thêm cơ chế bù hay dựng schema
  không cần khóa.
- Process nhận request đầu tiên sau khi lần dựng của process khác đã xong (khóa đã bị xóa, message
  `schemaCache--done` đã phát) không có schema trong bộ nhớ: nó nhận lượt `1` và tự dựng lại. Giống Directus;
  app mới không luôn nghe `schemaCache--done` để tránh việc này.
- Bộ đếm của khóa `schemaCache--preparing` đạt `CACHE_SCHEMA_MAX_ITERATIONS`: khóa bị xóa để tránh kẹt,
  giống Directus.
- Process dựng schema bị tắt giữa chừng (SIGTERM, crash) trước khi phát `schemaCache--done`: process chờ
  hết `CACHE_SCHEMA_SYNC_TIMEOUT` rồi thử lại, giống Directus.
- `CACHE_STORE=memory` nhưng có cấu hình Redis: bus và lock vẫn dùng Redis (Directus chọn theo việc có cấu
  hình Redis hay không, không theo `CACHE_STORE`); cache hệ thống nằm trong bộ nhớ từng process.
- `CACHE_STORE=memory` và `CACHE_AUTO_PURGE=true`: khi nhận `schemaChanged` (trừ khi message có
  `autoPurgeCache: false`), cache response bị xóa, giống Directus. Cache response chưa có tới feature 005
  nên ở feature này thao tác này không có gì để xóa.
- Schema lớn: message trên bus từ 1000 byte trở lên được nén theo cách của Directus; app mới đọc được
  message nén do Directus gửi và ngược lại.
- Message trên bus do bên kia gửi có trường lạ hoặc rỗng: xử lý giống Directus (buffer rỗng coi như
  không có giá trị).
- DB mất kết nối khi cache schema đang có: request dùng schema trong cache; lỗi chỉ xảy ra ở bước truy vấn
  dữ liệu, giống Directus.

## Requirements *(mandatory)*

### Functional Requirements

**Dựng SchemaOverview**

- **FR-001**: App mới PHẢI dựng SchemaOverview từ schema DB (qua inspector của `@backoffice/schema`, port từ
  `directus/packages/schema`), bảng `directus_collections`, `directus_fields`, `directus_relations` và dữ
  liệu hệ thống của Directus 11.17.4, với cùng thuật toán như `getDatabaseSchema` của Directus.
- **FR-002**: Mỗi collection trong SchemaOverview PHẢI có `collection`, `primary`, `singleton`, `note`,
  `sortField`, `accountability`, `fields` với cùng giá trị và cùng quy tắc mặc định như Directus (ví dụ
  `accountability` là `all` khi không có dòng trong `directus_collections`).
- **FR-003**: Mỗi field PHẢI có `field`, `defaultValue`, `nullable`, `generated`, `type`, `dbType`,
  `precision`, `scale`, `special`, `note`, `validation`, `alias`, `searchable` với cùng giá trị như Directus,
  gồm cách suy ra kiểu nội bộ từ kiểu DB và `special`, cách đọc giá trị mặc định theo từng loại DB, và cách
  parse `validation` dạng chuỗi JSON.
- **FR-004**: Field alias (có `special` thuộc nhóm alias của Directus) PHẢI có trong schema dù không có cột
  DB. Field trong `directus_fields` không có cột và không phải alias PHẢI bị bỏ qua. Field có `special` chứa
  `no-data` PHẢI bị bỏ qua.
- **FR-005**: Bảng không có khóa chính, tên có dấu cách, hoặc nằm trong `DB_EXCLUDE_TABLES` PHẢI bị bỏ qua
  với cùng mức log và cùng message như Directus.
- **FR-006**: `relations` PHẢI giống kết quả `RelationsService.readAll` (bỏ qua kiểm tra quyền) của Directus:
  cùng thứ tự, cùng `collection`, `field`, `related_collection`, `schema` (foreign key trên DB) và `meta`.
- **FR-007**: Collection, field và relation hệ thống PHẢI lấy từ `@backoffice/system-data` (port nguyên
  `directus/packages/system-data`), giống Directus 11.17.4. Danh sách auth provider của `directus_users.provider`
  nằm trong `options`, không thuộc SchemaOverview; phần này kiểm ở feature 006 (`/fields`). (Chỉnh khi phân
  tích: `getDatabaseSchema` chỉ chép `special`, `note`, `validation`, `searchable` từ dòng field.)
- **FR-008**: SchemaOverview PHẢI giống hệt của Directus trên cùng DB, cùng cấu hình: so sánh sâu từng giá trị
  và thứ tự relation, không có ngoại lệ. Ở feature này xác nhận trên Postgres, MySQL, SQLite; các vendor còn
  lại theo US2.5.

**Cache schema và đồng bộ khi dựng**

- **FR-010**: Khi `CACHE_SCHEMA` là `true` (mặc định), mỗi process PHẢI giữ SchemaOverview đã dựng trong bộ
  nhớ và dùng lại cho các request sau tới khi nhận tín hiệu xóa (FR-016).
  SchemaOverview KHÔNG ĐƯỢC lưu vào Redis hay kho dùng chung nào khác, giống Directus 11.17.4. Redis chỉ
  dùng để phối hợp giữa các process: khóa dựng schema (FR-011), message `schemaCache--done` (FR-012), tín
  hiệu `schemaChanged` (FR-016) và cache hệ thống `<CACHE_NAMESPACE>_system` (FR-017).
- **FR-011**: Khi cache trống, app mới PHẢI dùng cùng khóa `schemaCache--preparing` trong lock store dùng
  chung (Redis, namespace `REDIS_LOCK_NAMESPACE`, mặc định `directus:lock`) như Directus: tăng bộ đếm; process
  nhận giá trị `1` dựng schema; các process khác chờ message `schemaCache--done`.
- **FR-012**: Process dựng schema PHẢI phát message `schemaCache--done` trên bus với nội dung `{ schema }`
  (schema là `null` khi dựng lỗi) rồi xóa khóa, giống Directus. Process chờ PHẢI nhận được schema do Directus
  dựng, và Directus PHẢI nhận được schema do app mới dựng: cùng cách mã hóa JSON, cùng ngưỡng và cách nén
  của `directus/packages/memory`.
- **FR-013**: Process chờ PHẢI dừng chờ sau `CACHE_SCHEMA_SYNC_TIMEOUT` mili giây (mặc định `10000`) và thử
  lại; sau 3 lần thử PHẢI báo lỗi với cùng message như Directus. Khi bộ đếm đạt
  `CACHE_SCHEMA_MAX_ITERATIONS` (mặc định `100`) khóa PHẢI bị xóa, giống Directus.
- **FR-014**: Khi `CACHE_SCHEMA=false`, mỗi lần cần schema app mới PHẢI dựng mới từ DB, không dùng cache,
  khóa hay message `schemaCache--done`.
- **FR-015**: `CACHE_SCHEMA_FREEZE_ENABLED` (mặc định `false`) PHẢI có cùng tác dụng như Directus: bật thì trả
  bản schema đóng băng; tắt thì trả bản sao sửa được.

**Tín hiệu đổi schema qua bus**

- **FR-016**: Khi có cấu hình Redis, app mới PHẢI đăng ký kênh `schemaChanged` trên bus dùng chung
  (namespace `REDIS_BUS_NAMESPACE`, mặc định `directus:bus`). Khi nhận tín hiệu, app mới PHẢI xóa schema
  trong bộ nhớ và cache schema cục bộ (`<CACHE_NAMESPACE>_schema`, trong bộ nhớ); nếu `CACHE_STORE=memory`,
  `CACHE_AUTO_PURGE=true` và message không có `autoPurgeCache: false` thì xóa cả cache response, giống
  Directus.
- **FR-017**: App mới PHẢI có thao tác xóa cache hệ thống tương đương `clearSystemCache` của Directus, làm
  đúng thứ tự: dùng khóa `system-cache-lock` trong lock cache (`<CACHE_NAMESPACE>_lock`, TTL 10 giây) để xóa
  cache hệ thống (`<CACHE_NAMESPACE>_system`) khi chưa có ai đang xóa (hoặc khi bị ép), xóa schema trong bộ
  nhớ và cache schema cục bộ, xóa permissions cache (FR-019), rồi phát `schemaChanged` với
  `{ autoPurgeCache }`.
- **FR-018**: Tín hiệu do app mới phát PHẢI làm Directus xóa cache giống tín hiệu do một instance Directus
  khác phát, và ngược lại: cùng tên kênh, cùng namespace, cùng nội dung message.
- **FR-019**: App mới PHẢI dùng permissions cache giống Directus: khi có Redis là cache hai lớp (bộ nhớ, tối
  đa 100 key, và Redis namespace `REDIS_PERMISSIONS_NAMESPACE`, mặc định `permissions`, TTL theo
  `CACHE_SYSTEM_TTL`) có kênh xóa `multi-cache`; khi không có Redis là cache bộ nhớ tối đa 500 key. Key, cách
  băm key và giá trị PHẢI giống Directus để hai bên đọc ghi lẫn nhau. Các hàm đọc policy và permission đã có
  từ feature 001 PHẢI đi qua cache này (gỡ D-22).
- **FR-020**: Ở feature này, thao tác xóa cache hệ thống (FR-017) PHẢI gọi được từ code trong process app
  mới, không qua HTTP. App mới KHÔNG mở route mới cho thao tác này. Bộ test đối chiếu gọi thao tác này trong
  process app mới để kiểm chiều "app mới đổi schema thì Directus thấy". Khi các thao tác đổi schema qua API
  có ở feature 006 (`/fields`, `/collections`, `/relations`, `/schema`) và `POST /utils/cache/clear` có ở
  feature 010, các thao tác đó PHẢI dùng thao tác này, và chiều ngược lại được kiểm lại qua API.

**Bước dựng schema trong request**

- **FR-021**: Mọi request tới route nằm sau bước `schema` của Directus (mọi route trừ `/`, `/robots.txt`,
  `/server/ping`, vốn đứng trước bước này ở cả hai app) PHẢI lấy SchemaOverview theo FR-010 đến FR-015 trước
  khi vào route, giống middleware `schema` của Directus. Lỗi khi lấy schema trả lỗi giống Directus
  (`500 INTERNAL_SERVER_ERROR`).
- **FR-022**: Riêng `/server/health` giữ khác biệt D-13 của feature 001: không dựng schema, để probe phản ánh
  đúng trạng thái DB. D-13 thu hẹp lại chỉ còn `/server/health`; `/metrics`, path lạ và các route khác dựng
  schema như Directus.
- **FR-023**: `/server/specs/oas` PHẢI dùng SchemaOverview của request (có cache) thay vì dựng mới mỗi lần
  (thay FR-049 của feature 001).
- **FR-024**: Khi Redis không truy cập được trong lúc chạy, app mới PHẢI xử lý giống Directus: dùng schema còn
  trong bộ nhớ nếu có; nếu cache trống thì để lỗi của bước tăng khóa `schemaCache--preparing` (sau khi kết nối
  Redis thử lại theo cùng tùy chọn mặc định như Directus) trả thành `500 INTERNAL_SERVER_ERROR`. App mới KHÔNG
  ĐƯỢC tự dựng schema khi không lấy được khóa. Bộ test PHẢI có ca kiểm cả hai trường hợp.

**Biến môi trường và cache hệ thống**

- **FR-030**: App mới PHẢI hỗ trợ với cùng tên, mặc định và cách ép kiểu như Directus 11.17.4: `CACHE_SCHEMA`
  (`true`), `CACHE_SCHEMA_MAX_ITERATIONS` (`100`), `CACHE_SCHEMA_SYNC_TIMEOUT` (`10000`),
  `CACHE_SCHEMA_FREEZE_ENABLED` (`false`), `CACHE_SYSTEM_TTL` (không mặc định, không hết hạn),
  `CACHE_DEPLOYMENT_TTL` (5 giây khi không đặt), `CACHE_NAMESPACE` (`system-cache`), `CACHE_STORE`
  (`memory`), `CACHE_AUTO_PURGE` (`false`), `REDIS_BUS_NAMESPACE`, `REDIS_LOCK_NAMESPACE`,
  `REDIS_PERMISSIONS_NAMESPACE`. Các biến này PHẢI bị gỡ khỏi danh sách "biến chưa hỗ trợ" của feature 001.
- **FR-031**: App mới PHẢI tạo cache hệ thống (`_system`), cache deployment (`_deployment`), cache schema
  cục bộ (`_schema`, luôn trong bộ nhớ) và lock cache (`_lock`) với cùng namespace, TTL và store như
  `getCache` của Directus, kể cả khi `CACHE_ENABLED=false`, và log lỗi với cùng tiền tố (gỡ D-20).
- **FR-032**: Các biến cache response (`CACHE_AUTO_PURGE_IGNORE_LIST`, `CACHE_CONTROL_S_MAXAGE`,
  `CACHE_STATUS_HEADER`, `CACHE_VALUE_MAX_SIZE`, `CACHE_SKIP_ALLOWED`) vẫn thuộc feature 005 (D-11 của feature
  001); ở feature này chúng vẫn chỉ được cảnh báo khi khởi động. `CACHE_TTL` đã hỗ trợ từ 001 (TTL của instance
  `cache`); việc dùng biến này cho cache response làm ở 005.
- **FR-033**: App mới KHÔNG ĐƯỢC tạo key hay kênh Redis nào mà Directus 11.17.4 không dùng cho cùng mục đích,
  và KHÔNG ĐƯỢC ghi vào DB (Nguyên tắc II).

**Kiểm thử đối chiếu**

- **FR-040**: Bộ test đối chiếu PHẢI có ca so SchemaOverview của app mới với của Directus trên DB mẫu nêu ở
  User Story 2, trên Postgres, MySQL, SQLite ở mỗi lần push. Các vendor còn lại chạy cùng `nightly.yml` khi
  lịch được bật lại.
- **FR-041**: Bộ test đối chiếu PHẢI có ca chạy Directus và ít nhất hai instance app mới trên cùng DB và
  Redis, kiểm tra cả hai chiều đồng bộ schema (User Story 1) và cơ chế dựng một lần (User Story 3).

### Key Entities

- **SchemaOverview**: bức tranh schema của toàn hệ thống: map collection và danh sách relation. Không lưu
  trong DB; dựng từ DB và giữ trong bộ nhớ process.
- **Collection overview**: một bảng có khóa chính, kèm metadata từ `directus_collections` và map field.
- **Field overview**: một cột DB hoặc một field alias, kèm kiểu nội bộ, kiểu DB và metadata từ
  `directus_fields`.
- **Relation**: một liên kết giữa hai collection, gồm foreign key DB (nếu có) và metadata từ
  `directus_relations`.
- **Khóa dựng schema**: bộ đếm `schemaCache--preparing` trong lock store dùng chung, chọn process dựng schema.
  Lock store (`REDIS_LOCK_NAMESPACE`, kv của `@backoffice/memory`) giữ khóa dựng schema. Lock cache (Keyv
  `<CACHE_NAMESPACE>_lock`) chỉ giữ `system-cache-lock`. Đây là hai kho khác nhau.
- **Message bus**: `schemaCache--done` (`{ schema }`), `schemaChanged` (`{ autoPurgeCache }`), `multi-cache`
  (xóa permissions cache), trao đổi giữa mọi instance Directus và app mới.
- **Cache hệ thống, lock cache, permissions cache**: kho key-value dùng chung trên Redis (hoặc bộ nhớ khi
  `CACHE_STORE=memory` hoặc không có Redis), cùng namespace với Directus.

## Khác biệt so với Directus *(mandatory)*

Feature này không thêm khác biệt mới. Thay đổi với bảng khác biệt của feature 001:

| Mã | Thay đổi | Lý do |
|----|----------|-------|
| D-13 | Thu hẹp: chỉ còn `/server/health` không dựng schema. `/metrics`, path lạ và route khác dựng schema và trả `500` như Directus khi DB mất kết nối và `CACHE_SCHEMA=false` | FR-021, FR-022 |
| D-20 | Gỡ | FR-031 |
| D-22 | Gỡ. Benchmark `/server/specs/oas` so với Directus cấu hình mặc định và chặn CI | FR-019, FR-023 |

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có. Mọi tên khóa, kênh và namespace trong feature này giữ nguyên như Directus (Nguyên tắc IX).

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4 (api 35.2.0). Mọi giá trị mặc định lấy từ
  `directus/packages/env/src/constants/defaults.ts` và các giá trị dự phòng trong code Directus.
- Không có endpoint nào trả SchemaOverview trực tiếp. Client thấy schema mới qua các endpoint dựa vào schema;
  ở feature này là `/server/specs/oas`. Test đối chiếu so SchemaOverview trực tiếp bằng cách đọc message
  `schemaCache--done` của Directus trên bus.
- "Ngay" nghĩa là mọi request gửi từ 1 giây sau khi bên đổi schema trả response (SC-001). Directus phát
  `schemaChanged` mà không chờ việc phát xong, nên request gửi sát ngay sau response chưa chắc đã thấy schema
  mới; ngưỡng 1 giây chừa chỗ cho khoảng trễ này trên runner CI.
- Không có Redis thì mọi bus, lock, cache chỉ trong process; chạy nhiều instance khi đó là cấu hình không an
  toàn, đã có cảnh báo từ feature 001. Feature này không thêm cơ chế khác.
- Cache response (`CACHE_ENABLED`) thuộc feature 005; thay đổi quyền (xóa cache khi đổi policy, permission)
  ở phía app mới thuộc feature 004; thay đổi schema qua API của app mới thuộc feature 006.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sau khi Directus trả response thành công cho một thao tác đổi schema, 100% request gửi tới
  mọi instance app mới từ 1 giây sau đó trở đi thấy schema mới, không cần khởi động lại. Chiều ngược lại
  đạt cùng ngưỡng.
- **SC-002**: SchemaOverview của app mới giống 100% của Directus trên DB mẫu của bộ test đối chiếu, trên
  Postgres, MySQL, SQLite ở mỗi lần push. Các vendor còn lại được xác nhận khi lịch chạy hằng đêm được bật lại.
- **SC-003**: Với mỗi lần cache schema bị xóa, mỗi process (Directus hoặc app mới) dựng schema từ DB tối đa
  1 lần. Khi 20 request đồng thời phân bố trên Directus và các instance app mới tới trong lúc một process
  đang dựng schema, schema chỉ được dựng từ DB đúng 1 lần trên toàn hệ thống.
- **SC-004**: Đội vận hành dùng nguyên các biến `CACHE_*` và `REDIS_*` của Directus; không dòng cấu hình nào
  phải thêm hoặc đổi, và tập key và kênh app mới dùng trên Redis là tập con của tập Directus dùng với cùng
  cấu hình.
- **SC-005**: p95 latency và throughput của `/server/specs/oas` không tệ hơn Directus cấu hình mặc định quá 10%
  với cùng tải, và benchmark này chặn CI (gỡ D-22).
- **SC-006**: Khi chỉ app mới chạy (Directus tắt) và phục vụ mọi request của bộ test, kể cả các request dựng
  schema, bản chụp schema và dữ liệu mọi bảng trước và sau giống nhau 100%. Thay đổi DB trong test đồng bộ schema
  do Directus hoặc SQL của test tạo, và được dọn sau test. (Chỉnh khi lập plan: Directus ghi `directus_activity`
  khi đổi schema, nên chụp trước và sau toàn bộ bộ test luôn lệch; research R11.)
