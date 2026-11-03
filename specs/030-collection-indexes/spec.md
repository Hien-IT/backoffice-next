# Feature Specification: Index ghép, index trigram và tạo index không khóa bảng cho collection người dùng

**Feature Branch**: `030-collection-indexes` (làm trên `main` như 012–029, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=030-collection-indexes`)
**Created**: 2026-11-03
**Status**: Done 2026-11-04. Implemented 2026-11-03 in two waves on `main` (lượt 1 API ec580989, lượt 2 web 6fff21c3;
fixes 8a2d35ae deadlock D-209, bb454653 Data Model list, de3e57b4 benchmark, 70745ac2 + 047862ee D-209 option C; owner UI
changes 8f2c180e card above Collection Setup + collapsible guidance, 60b1b5b7 trigram wording, e616067c long names wrap);
CI 41664812576 and 41676339727 green (quality, parity postgres/sqlite/mysql, blackbox, e2e three configurations, deploy
`indexes.test.ts` on 3 replicas with SIGTERM, bootstrap); benchmark-items 41649731384, 41664889475, 41676382806 (FR-024
below; gate `PATCH update (user)` flaky: CPU +14,7 % on run 2, equal on run 3 with p95 noise on both apps; run 4
41698545792 green). (spec,
clarify 5 câu, plan 2026-11-03; D-210..D-210.4 duyệt 2026-11-03)
**Input**: User description: "Feature 030: admin tạo và xóa index của một collection người dùng trong Backoffice: index
B-tree ghép nhiều cột (unique hoặc không) trên Postgres, SQLite, MySQL; index trigram GIN cho tìm kiếm trên Postgres;
tạo không khóa bảng khi vendor cho phép. Bối cảnh: Directus 11.17.4 và Backoffice chỉ tạo index trên một cột qua
schema.is_unique / schema.is_indexed của field [...]; tìm kiếm ?search= của hai app là LOWER(col) LIKE '%x%' trên mọi
cột chuỗi nên B-tree không giúp, chỉ index GIN trigram trên lower(col) (pg_trgm) của Postgres mới dùng được. Đây là tính
năng chỉ của Backoffice (như 022, 025, 029). Phạm vi đã chốt (chủ dự án 2026-11-03): 1. Hai loại index btree và trigram
[...]. 2. Field phải là cột thật [...], tối đa 8 field. 3. Tên tự sinh [...]. 4. Bảng hệ thống mới backoffice_indexes
qua migration riêng [...]. 5. Tạo không khóa bảng theo mặc định [...]. 6. pg_trgm [...]. 7. Xóa index, xóa field, xóa
collection, dòng mồ côi [...]. 8. Chỉ admin. 9. Lỗi trùng unique ghép liệt kê từng field. 10. Web: card "Indexes" trên
trang collection của Data Model [...]. Khác biệt với Directus ghi từ D-210 [...]" (bản đầy đủ: lệnh `/speckit.specify`
của 030 trong `SPECKIT-GUIDE.md` mục 6)

**Điều kiện trước `/speckit.plan`** (Governance):

- Không sửa constitution: bảng `backoffice_indexes` đi qua migration riêng của Backoffice (Nguyên tắc II từ 3.2.0: chỉ
  bảng tiền tố `backoffice_`, chỉ `up`, mọi vendor, chạy lại được, không FK tới bảng `directus_*`); khác biệt API và giao
  diện ghi theo Nguyên tắc X (bảng "Khác biệt so với Directus", tech lead duyệt).
- Không dependency mới, không biến môi trường mới. Lệnh DDL đi qua các helper theo vendor đã có của 006 (tạo index một
  cột, tạo không khóa bảng); feature này mở rộng chúng cho nhiều cột và kiểu trigram.
- Khác biệt D-210..D-210.4: chủ dự án kiêm tech lead duyệt 2026-11-03 sau `/speckit.plan`, cùng hai điểm Complexity
  Tracking của plan (sửa `onSignal` của `server.ts` cho SIGTERM; `translateDatabaseError` trả mảng lỗi và nhận `knex`) và
  7 sửa câu chữ spec của plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin tạo index ghép (unique hoặc không) cho một collection (Priority: P1) 🎯 MVP

Admin mở Settings > Data Model > một collection người dùng, thấy card "Indexes" liệt kê các index do Backoffice tạo,
bấm thêm, chọn hai field `provider` và `provider_subject` theo thứ tự, bật "Unique", lưu. Index ghép được tạo trên DB,
dòng mới hiện trong card với tên tự sinh. Từ đó mọi bản ghi trùng cặp giá trị này bị từ chối ở cả hai app (Backoffice
và Directus) vì ràng buộc nằm ở DB. Cùng việc làm được qua API cho script và CI.

**Why this priority**: Đây là nhu cầu gốc của chủ dự án (unique theo hai cột như `passenger_auth_identities (provider,
provider_subject)`); Directus không có cách nào ngoài SQL tay. Có riêng US1 đã dùng được.

**Independent Test**: Tạo index unique ghép trên một collection có sẵn, thử ghi hai bản ghi trùng cặp giá trị qua
`/items` ở hai app: lần hai bị từ chối ở cả hai; xóa index thì ghi được.

**Acceptance Scenarios**:

1. **Given** admin ở trang collection `bo_indexes_test` có field `provider`, `provider_subject`, `note`, **When** thêm
   index với hai field đầu, loại btree, unique bật, **Then** API trả 202, card hiện một dòng tên
   `bo_indexes_test_provider_provider_subject_unique`, fields "provider, provider_subject", loại btree, unique, trạng
   thái `creating` rồi `ready` (trên collection nhỏ trong vòng vài giây); DB có index unique đúng thứ tự cột.
2. **Given** index unique ghép ở kịch bản 1 đã `ready`, **When** tạo bản ghi `(a, 1)` rồi `(a, 1)` lần nữa qua API Backoffice,
   **Then** lần hai trả lỗi "không duy nhất" nêu cả hai field; cùng request ở API Directus cũng bị từ chối (lỗi của DB).
3. **Given** index btree không unique với ba field, **When** tạo, **Then** tên kết thúc `_index`, dữ liệu trùng vẫn ghi
   được.
4. **Given** đã có index cùng tập field, cùng loại, cùng cờ unique, **When** tạo lại, **Then** 400 "index đã có", không
   tạo gì thêm.
5. **Given** payload có field alias, field quan hệ nhiều-nhiều, field không tồn tại, field trùng nhau hoặc hơn 8 field,
   **When** tạo, **Then** 400 với lý do, không DDL.
6. **Given** collection hệ thống (`directus_users`, `backoffice_permissions`), **When** tạo index, **Then** 403 (như
   DDL của Data Model với collection hệ thống).
7. **Given** user không phải admin, **When** gọi tạo, liệt kê hay xóa, **Then** 403; card không hiện ở trang collection
   (trang đó chỉ admin thấy, như Data Model).
8. **Given** tên tự sinh dài hơn giới hạn của vendor, **When** tạo, **Then** tên được cắt theo quy tắc hiện có của
   Backoffice cho index một cột, không lỗi; tên hiện trong card là tên thật trên DB.

---

### User Story 2 - Admin tạo index trigram cho tìm kiếm trên Postgres (Priority: P2)

Admin thấy tìm kiếm ở trang Content của một collection lớn chậm. Trên Postgres, admin thêm index loại "trigram" cho
field `name`; từ đó `?search=` dùng index và nhanh hơn với từ khóa từ 3 ký tự. Trên MySQL và SQLite, lựa chọn trigram
không hiện và API từ chối.

**Why this priority**: Là loại index duy nhất giúp tìm kiếm của Directus/Backoffice (so khớp chuỗi con không phân biệt
hoa thường trên mọi cột chuỗi); có sau US1 vì cần phần mở rộng `pg_trgm` của Postgres.

**Independent Test**: Trên Postgres, tạo index trigram cho `name` của collection seed, kế hoạch thực thi của câu tìm
kiếm dùng index; trên MySQL/SQLite API trả 400.

**Acceptance Scenarios**:

1. **Given** Postgres, phần mở rộng `pg_trgm` chưa cài nhưng user DB được phép cài, **When** tạo index trigram cho
   `name`, **Then** phần mở rộng được cài, index `<collection>_name_trgm` được tạo trên biểu thức chữ thường của cột,
   card hiện loại trigram.
2. **Given** Postgres, user DB không được phép cài `pg_trgm`, **When** tạo, **Then** dòng chuyển `failed` với thông điệp nêu lệnh để
   DBA chạy; không tạo gì.
3. **Given** MySQL hoặc SQLite, **When** gửi loại trigram, **Then** 400 nêu "chỉ Postgres"; card không có lựa chọn
   trigram (API báo vendor không hỗ trợ).
4. **Given** index trigram đã có, **When** tìm kiếm `?search=abc` trên collection đó ở Backoffice, **Then** kết quả
   giống hệt khi chưa có index (cùng câu tìm kiếm, cùng thứ tự); kế hoạch thực thi dùng index.
5. **Given** field loại không phải string/text (số, ngày, json, uuid) hoặc hai field, **When** tạo trigram, **Then**
   400.

---

### User Story 3 - Tạo index không khóa bảng đang dùng (Priority: P2)

Admin tạo index trên một collection nhiều triệu dòng trong giờ làm việc. Trên Postgres và MySQL, người dùng khác vẫn
ghi được vào collection trong lúc index đang tạo; trên SQLite việc tạo khóa bảng như bình thường. Admin có thể tắt chế
độ này để tạo nhanh hơn ngoài giờ.

**Why this priority**: Không có nó, tạo index trên bảng lớn chặn ghi của mọi người dùng ở cả hai app; cùng tùy chọn
`concurrentIndexCreation` mà Backoffice đã có cho index một cột.

**Independent Test**: Trong bộ kiểm thử triển khai 3 replica, tạo index trên collection seed lớn trong lúc một tiến
trình ghi liên tục: ghi không bị chặn quá ngưỡng; tắt tùy chọn thì ghi bị chờ.

**Acceptance Scenarios**:

1. **Given** Postgres, bảng lớn, **When** tạo index với mặc định, **Then** API trả 202 ngay với dòng ở trạng thái
   `creating`; các request ghi vào bảng trong lúc tạo vẫn trả về trong ngưỡng SC-004; khi xong dòng chuyển `ready`
   (card poll thấy trong vòng 5 giây); index có trên DB.
2. **Given** MySQL, **When** tạo với mặc định, **Then** Backoffice thử cách không khóa; vendor từ chối (kiểu cột, engine)
   thì tự tạo theo cách thường và vẫn thành công.
3. **Given** `?concurrentIndexCreation=false`, **When** tạo, **Then** tạo theo cách thường trên mọi vendor.
4. **Given** Postgres, tạo không khóa bị gián đoạn (mất kết nối, dữ liệu trùng với unique), **When** job nhận lỗi,
   **Then** index dở dang (INVALID) bị xóa, dòng chuyển `failed` với thông điệp lỗi; card hiện lỗi, cho xóa dòng và
   tạo lại.
6. **Given** replica đang chạy job nhận SIGTERM giữa chừng, **When** admin mở card sau đó, **Then** dòng là `failed`
   "Server shutdown" (job đánh dấu trước khi kết nối DB đóng, không chờ DDL xong; sửa khi plan 2026-11-03); replica
   chết không SIGTERM: dòng `creating` quá 1 giờ mà index không có (hoặc INVALID) trên DB hiện `failed` "tiến trình tạo
   đã dừng"; cả hai trường hợp xóa dòng và tạo lại được; index INVALID còn lại bị dọn khi xóa dòng.
5. **Given** hai admin tạo cùng index trên hai replica cùng lúc, **When** cả hai gửi, **Then** đúng một thành công,
   request kia 400 "index đã có".

---

### User Story 4 - Xóa index, xóa field hay collection, index mất ngoài hệ thống (Priority: P1)

Admin xóa một index từ card: index biến mất khỏi DB và danh sách. Admin xóa một field đang nằm trong index: index đó
bị gỡ trước, cột xóa sau, danh sách không còn nó. Khi Directus (hoặc DBA) xóa cột, bảng hay index ngoài Backoffice,
card đánh dấu dòng "missing" và cho xóa dòng.

**Why this priority**: Không có cascade thì xóa field thất bại hoặc để lại index thiếu cột (MySQL) và dòng mồ côi;
phải có cùng US1 để dữ liệu không hỏng.

**Independent Test**: Tạo index ghép, xóa một field của nó ở Backoffice: cột mất, index mất, dòng mất; xóa cột cùng
field ở Directus: dòng còn nhưng `missing: true`, xóa được.

**Acceptance Scenarios**:

1. **Given** index ở US1, **When** bấm xóa và xác nhận, **Then** DB không còn index, card không còn dòng; ghi trùng lại
   được.
2. **Given** index ghép `(provider, provider_subject)`, **When** xóa field `provider` ở Backoffice (Data Model hoặc
   API), **Then** hộp thoại Data Model nêu tên index sẽ bị gỡ; sau xác nhận index bị gỡ trước, cột xóa thành công trên
   Postgres, SQLite, MySQL; dòng `backoffice_indexes` mất (activity delete, FR-016a).
3. **Given** collection có hai index, **When** xóa collection ở Backoffice, **Then** hai dòng mất (bảng đã mất kéo theo
   index).
4. **Given** Directus xóa field `provider` (hoặc DBA `DROP INDEX`), **When** admin mở card ở Backoffice, **Then** dòng
   hiện trạng thái "missing"; xóa dòng được; Backoffice không tự tạo lại.
5. **Given** dòng missing, **When** tạo lại index cùng field, **Then** 400 "index đã có" cho tới khi dòng cũ bị xóa
   (tên trùng).

---

### User Story 5 - Chạy song song với Directus 11.17.4 (Priority: P2)

Index do Backoffice tạo là ràng buộc thật trên DB chung: Directus app và API Directus tôn trọng chúng (lỗi trùng), hiển
thị field như trước, không cần cấu hình, migration hay file nào. Directus không thấy card, không có endpoint, và
`/fields` của hai app vẫn giống nhau.

**Why this priority**: Nguyên tắc chạy song song; không có nó thì bộ đối chiếu đỏ.

**Independent Test**: Bộ đối chiếu chạy mọi request `/fields`, `/collections`, `/items`, `?search=` ở hai app sau khi
tạo index ghép: giống nhau trừ các mã D-210.x.

**Acceptance Scenarios**:

1. **Given** index ghép unique ở US1, **When** `GET /fields/<collection>` ở hai app, **Then** hai cột liên quan vẫn
   `is_unique: false`, `is_indexed: false` ở cả hai (D-210.1).
2. **Given** endpoint index của Backoffice, **When** gọi ở Directus, **Then** 404 (D-210).
3. **Given** `backoffice_indexes` trên DB, **When** Directus liệt kê collection, **Then** nó là bảng chưa quản lý như
   `backoffice_passkeys`; Backoffice: collection hệ thống ẩn (403 `/items`, không GraphQL, ngoài Data Model) (D-210.2).
4. **Given** index unique ghép, **When** ghi trùng ở Directus, **Then** Directus từ chối theo cách của nó (lỗi DB);
   Backoffice trả `RECORD_NOT_UNIQUE` với từng field (D-210.4).
5. **Given** mọi suite đối chiếu, blackbox và E2E hiện có, **When** chạy sau feature, **Then** không test nào đổi kết
   quả.

### Edge Cases

- Index unique ghép trên dữ liệu đang trùng: DB từ chối trong job; dòng chuyển `failed` với thông điệp "không duy
  nhất" nêu field và giá trị trùng (lỗi vendor chuyển như FR-016); index dở dang trên Postgres bị dọn (US3 kịch bản 4);
  admin sửa dữ liệu, xóa dòng `failed`, tạo lại.
- Cột `text` trên MySQL, `json`/`geometry` trên mọi vendor trong index btree: 400 nêu field và kiểu (FR-001a), không
  dòng, không job.
- Field `string` có độ dài lớn trên MySQL (vượt giới hạn khóa index của engine): lỗi vendor chuyển thành 400 với thông
  điệp của vendor, không dòng.
- Thứ tự field có ý nghĩa: `(a, b)` và `(b, a)` là hai index khác nhau (tên khác, mục đích khác), cả hai tạo được.
- Field khóa chính trong index ghép: cho phép (ví dụ `(tenant, id)`); khóa chính một mình không tạo được (đã có ràng
  buộc, 400).
- Field đã bật `is_unique`/`is_indexed` một cột: vẫn được vào index ghép; hai cơ chế độc lập, tên khác nhau.
- Đổi tên tự sinh trùng với index có sẵn trên DB do tay hoặc do Directus tạo (cùng tên): API 400 "tên đã có trên DB",
  không ghi đè.
- Collection đổi tên: Directus và Backoffice không đổi tên collection (không có tính năng), nên tên index không lệch.
- Xóa field khi dòng index đã missing: bỏ qua lỗi "index không tồn tại" khi gỡ, vẫn xóa dòng và xóa cột.
- Tạo không khóa bảng trên Postgres trong lúc một transaction dài đang mở trên bảng: job chờ transaction đó; dòng ở
  `creating` cho tới khi xong (không timeout riêng dưới 1 giờ).
- Xóa dòng đang `creating` (admin bấm xóa): từ chối 400 `INVALID_PAYLOAD` "Index is still being created" (không mã lỗi
  mới; sửa khi plan 2026-11-03) cho tới khi job xong hoặc dòng bị coi là bỏ dở (FR-009).
- Xóa field hay collection trong lúc một index của nó đang `creating`: 400 như trên; sau khi `ready`/`failed` thì
  cascade FR-014.
- Tạo trên replica A, liệt kê ở replica B ngay sau: dòng đọc từ DB, không cache, nên thấy ngay.
- Tắt `pg_trgm` sau khi đã có index trigram: DBA xóa extension kéo theo index, dòng thành missing; Backoffice không
  cài lại tự động trừ khi tạo index trigram mới.
- Tìm kiếm với từ khóa ngắn hơn 3 ký tự trên collection có index trigram: kết quả không đổi; Postgres có thể quét
  bảng (Assumptions).
- Snapshot và `schema/apply`: không chứa index của feature này; áp snapshot lên môi trường khác không tạo và không xóa
  chúng; apply xóa một field có index thì cascade như US4 kịch bản 2.
- Response cache dùng chung: endpoint index chỉ admin, GET theo collection không vào cache (như `/fields` của 006);
  `?search=` sau khi có index không đổi khóa cache.
- Vendor ngoài Postgres, SQLite, MySQL (MSSQL, Oracle, CockroachDB, MariaDB): btree ghép có thể chạy qua cùng helper
  nhưng chưa đo; trigram 400; ghi Assumptions, nightly không bắt buộc xanh cho suite mới.

## Requirements *(mandatory)*

### Functional Requirements

**Tạo và liệt kê**

- **FR-001**: Admin PHẢI tạo được index cho một collection người dùng với: danh sách field theo thứ tự (1–8 field, không
  trùng, mỗi field là cột thật của collection: không alias, không o2m/m2m/m2a/presentation/group), loại `btree` hoặc
  `trigram`, cờ unique (chỉ btree). Collection hệ thống (`directus_*`, `backoffice_*`) bị từ chối 403.
- **FR-001a**: Kiểu field cho index btree (clarify 2026-11-03): `string`, `integer`, `bigInteger`, `float`, `decimal`,
  `boolean`, `uuid`, `date`, `time`, `dateTime`, `timestamp`, `hash` trên mọi vendor; `text` chỉ trên Postgres và
  SQLite; `json`, `geometry`, `csv`/alias và mọi kiểu khác 400 nêu field và kiểu; MySQL với `text` 400 (không tham số
  prefix).
- **FR-002**: Loại `trigram` CHỈ nhận đúng một field kiểu `string` hoặc `text`, không unique, và chỉ trên Postgres; vendor
  khác trả 400 nêu "chỉ Postgres"; field kiểu khác 400.
- **FR-003**: Tên index PHẢI tự sinh theo quy tắc hiện có của Backoffice cho index một cột, mở rộng cho nhiều field:
  `<collection>_<field1>_<field2>…_unique` (unique), `…_index` (btree thường), `<collection>_<field>_trgm` (trigram); cắt
  theo giới hạn tên của vendor bằng cùng cách; người dùng không đặt tên.
- **FR-004**: Hai index cùng collection, cùng tập field theo thứ tự, cùng loại, cùng cờ unique là trùng: 400, không DDL.
  Tên tự sinh trùng với index đã có trên DB nhưng không có dòng của Backoffice: 400 "tên đã có", không ghi đè.
- **FR-005**: Liệt kê index của một collection PHẢI trả: tên, fields theo thứ tự, loại, unique, ngày tạo, trạng thái
  (`creating`, `ready`, `failed`, kèm `error` khi `failed`) và cờ `missing` khi dòng `ready` mà index không còn trên DB
  (`null` trên vendor không kiểm catalog: MSSQL, Oracle)
  (đối chiếu catalog của vendor theo tên); thứ tự theo ngày tạo tăng dần. Kèm thông tin vendor cho giao diện: có trigram
  không, có tạo không khóa bảng không.
- **FR-006**: Chỉ index do Backoffice tạo (có dòng trong `backoffice_indexes`) được liệt kê; index tạo tay hoặc index một
  cột của `/fields` không hiện.
- **FR-007**: Chỉ admin (`admin_access`) được liệt kê, tạo, xóa; user khác 403; không qua quyền của policy.

**Tạo không khóa bảng**

- **FR-008**: Mặc định tạo không khóa bảng: Postgres tạo theo cách không chặn ghi (ngoài transaction); MySQL thử cách
  không khóa và tự quay về cách thường khi vendor từ chối; SQLite tạo thường. `?concurrentIndexCreation=false` tắt, như
  tạo field có index của 006.
- **FR-008a**: Tạo index là job nền (clarify 2026-11-03): sau khi kiểm payload và trùng (FR-010), API ghi dòng với
  trạng thái `creating` và trả 202 kèm dòng; job chạy trên replica nhận request (không hàng đợi, không Redis job); xong
  thì dòng chuyển `ready`; lỗi thì `failed` với thông điệp lỗi (`error`). Dòng `creating` hoặc `failed` không phải là
  index dùng được: ghi trùng chưa bị chặn cho tới khi `ready`.
- **FR-009**: Trên Postgres, job bị lỗi giữa chừng PHẢI dọn index dở dang (INVALID) rồi đặt `failed`. Khi replica nhận
  SIGTERM, mọi job đang chạy được đánh dấu `failed` "Server shutdown" trước khi kết nối DB đóng (không chờ DDL; sửa khi
  plan 2026-11-03). Dòng `creating` quá 1 giờ mà index không có hoặc INVALID trên DB (replica chết không SIGTERM) được
  liệt kê là `failed` "tiến trình tạo đã dừng"; trên Postgres một index đang build `CONCURRENTLY` cũng là INVALID, nên
  quy tắc 1 giờ chỉ áp khi `pg_stat_progress_create_index` không có dòng cho index đó (build còn chạy thì vẫn
  `creating`; sửa khi analyze 2026-11-03, U1);
  xóa dòng dọn index INVALID nếu còn. Dòng `failed` xóa được và tạo lại được (tên không còn bị coi là trùng khi dòng
  cũ đã xóa).
- **FR-010**: Hai request tạo cùng index trên hai replica cùng lúc: đúng một thành công, request kia 400 trùng; loại trừ
  bằng ràng buộc duy nhất trên tên index trong `backoffice_indexes` (đúng cả khi không có Redis; sửa khi plan
  2026-11-03, thay "khóa dùng chung").

**Phần mở rộng trigram**

- **FR-011**: Trước index trigram đầu tiên, Backoffice PHẢI cài phần mở rộng `pg_trgm` nếu chưa có (lệnh idempotent);
  không có quyền thì dòng chuyển `failed` với thông điệp nêu lệnh để DBA chạy (job nền; sửa khi plan 2026-11-03), không
  tạo index.
- **FR-012**: Index trigram PHẢI đặt trên đúng biểu thức mà tìm kiếm và filter `_icontains` của Backoffice/Directus dùng
  (chữ thường của cột), để chúng dùng được index; câu tìm kiếm và kết quả không đổi. Planner có dùng hay không do Postgres
  quyết định: với `?search=` ở bảng lớn thì không (FR-024), nên nhãn và hướng dẫn trong dialog nói "contains" (chủ dự
  án 2026-11-03 sau benchmark).

**Xóa và cascade**

- **FR-013**: Xóa index: gỡ index trên DB rồi xóa dòng; index đã mất trên DB (missing) thì chỉ xóa dòng, không lỗi; tên
  không thuộc collection đó → 403 (như xóa item không có).
- **FR-014**: Xóa field ở Backoffice (API `/fields`, Data Model, `schema/apply`): mọi index có field đó PHẢI bị gỡ và xóa
  dòng trước khi xóa cột, trên mọi vendor. Xóa collection ở Backoffice: xóa mọi dòng của collection đó.
- **FR-015**: Directus xóa field/collection hoặc DBA xóa index: dòng ở lại, liệt kê trả `missing: true`; Backoffice KHÔNG
  tự tạo lại.

**Lỗi trùng**

- **FR-016**: Ghi vi phạm unique ghép qua Backoffice (REST, import) PHẢI trả `RECORD_NOT_UNIQUE` với từng field của
  index (mỗi field một mục lỗi, như Directus trả cho unique một cột); GraphQL trả mục đầu (field thứ nhất) vì
  `formatError` của Directus gộp mọi mảng lỗi thành một, kể cả lỗi validate (giữ nguyên văn; sửa khi implement
  2026-11-03); lỗi unique một cột không đổi; trên Postgres, SQLite và MySQL (sửa khi analyze 2026-11-03, I1).

**Dữ liệu**

- **FR-016a**: Tạo, đổi trạng thái (`ready`/`failed`) và xóa index PHẢI ghi `directus_activity` (và revision) trên
  collection `backoffice_indexes` như mọi collection hệ thống đi qua ItemsService (clarify 2026-11-03): action create
  bởi admin gọi, update bởi cùng user khi job kết thúc, delete khi xóa (kể cả cascade FR-014, ghi user đang xóa field).
- **FR-017**: Bảng hệ thống `backoffice_indexes` tạo bằng migration riêng của Backoffice (Nguyên tắc II: chỉ `up`, chạy
  lại được, 7 vendor, không FK): `id` (uuid v4 như collection hệ thống, 027), `collection`, `name`, `fields` (JSON mảng
  theo thứ tự), `type` (`btree` | `trigram`), `unique` (boolean), `status` (`creating` | `ready` | `failed`), `error` (text, null),
  `date_created`. Collection hệ thống ẩn: 403 `/items`,
  ngoài GraphQL, ngoài Data Model, như `backoffice_passkeys`; `bootstrap`/`init` chạy migration, `start` kiểm.

**Giao diện**

- **FR-018**: Trang collection của Settings > Data Model có card "Indexes" là card độc lập đặt giữa danh sách field và
  các card Collection Setup (chủ dự án 2026-11-03 sau khi xem UI; card D-182 nằm trong form không chèn được): bảng tên / fields / loại / unique / trạng thái (`creating` với vòng xoay, `ready`, `failed` với thông điệp lỗi) và
  cờ `missing`, nút thêm, nút xóa từng dòng với xác nhận; khi có dòng `creating` card poll liệt kê mỗi 5 giây tới khi
  không còn (dừng khi rời trang);
  card chỉ ở web (không dòng `directus_fields`), ẩn khi API là Directus (liệt kê trả 404).
- **FR-019**: Hộp thoại thêm: một ô chọn thêm field (chỉ cột thật của collection chưa có trong danh sách) vào một danh
  sách sắp xếp được (kéo thả bằng chuột, menu dòng "Move up"/"Move down" và xóa dòng cho bàn phím, thông báo vị trí mới
  cho screen reader; clarify 2026-11-03); thứ tự danh sách là thứ tự cột; loại (trigram chỉ hiện khi API báo hỗ trợ; chọn trigram thì chỉ một field và tắt unique), công tắc unique,
  công tắc "không khóa bảng" bật sẵn khi API báo hỗ trợ; một mục đóng mở (BoDetail, đóng sẵn) đầu hộp thoại chứa ghi chú giải
  thích index, thứ tự field, unique, trigram, không khóa bảng và trạng thái nền (chủ dự án 2026-11-03); lỗi của API hiện trong hộp thoại; 202 thì đóng, dòng `creating` hiện
  trong danh sách, toast "đang tạo" (D-172); chuyển `ready`/`failed` thì toast tương ứng khi trang còn mở.
- **FR-019a**: Hộp thoại xác nhận xóa field của Data Model (016) PHẢI liệt kê tên các index của feature này có field đó
  (một dòng "Các index sau sẽ bị gỡ: …"), chỉ khi API là Backoffice và danh sách khác rỗng; không chặn xóa (clarify
  2026-11-03). Xóa collection không đổi hộp thoại (bảng mất kéo theo index).
- **FR-020**: Card và hộp thoại làm được bằng bàn phím, nhãn và lỗi gắn với control, không vi phạm axe serious; chuỗi
  en-US và vi-VN ở overlay.

**Đối chiếu, kiểm thử, tài liệu**

- **FR-021**: Suite đối chiếu `schema/indexes` chạy trên Postgres, SQLite, MySQL: endpoint mới 404 ở Directus (D-210);
  `/fields`, `/collections`, `/items`, `?search=` giống nhau ở hai app sau khi có index; lỗi trùng khác theo D-210.4;
  trigram chỉ khi Postgres; dump của profile `bootstrap` có `backoffice_indexes`.
- **FR-022**: E2E `settings-data-model-indexes` ở ba cấu hình: `proxy-directus` card ẩn; `proxy-api`, `cors` tạo index
  ghép unique, ghi trùng thấy lỗi, xóa index; a11y axe.
- **FR-023**: Bộ kiểm thử triển khai 3 replica có một ca: tạo index trên collection seed trong lúc ghi liên tục (US3
  kịch bản 1).
- **FR-024**: Benchmark thêm một dòng `?search=` trên seed 10M dòng có và không có index trigram, đo Backoffice-only như
  023; số đo ghi vào spec, không là success criteria.
  Đo lần 1 (benchmark-items 41649731384, 2026-11-03, 10M dòng, từ khóa `icle 4242`): không index 0,5 req/s, p95 2439 ms
  (1 kết nối, seq scan); có index trigram trên `title`, `status`, `body`: planner vẫn seq scan vì từ khóa chứa trigram có
  ở mọi dòng (`icl`, `cle`), 50 kết nối đều timeout. Thử trên 2M dòng cùng câu của app (`ORDER BY id LIMIT 25`): từ khóa
  chọn lọc (`1999999`) dùng BitmapOr trên ba index, 852 ms → 4 ms. Bài học: trigram chỉ giúp khi từ khóa có trigram hiếm;
  benchmark đổi sang `4242424`, EXPLAIN theo câu thật, tải theo plan (đo lần 2 ghi bên dưới).
  Đo lần 2 (benchmark-items 41664889475, 047862ee, 10M dòng, từ khóa `4242424`, 1 kết nối): không index 0,3 req/s, p95
  3770 ms; có index trigram trên ba cột 0,3 req/s, p95 3805 ms; cả hai plan là quét theo khóa chính (`ORDER BY id LIMIT
  25`, planner ước lượng ~2000 dòng khớp nên không chọn BitmapOr). Kết luận: ở 10M dòng index trigram không tăng tốc
  `?search=` của engine (OR mọi cột chuỗi + sort khóa chính); có lợi với filter `_icontains` một cột (Bitmap Index Scan
  khi thử) và với bảng nhỏ hơn (2M dòng: 4 ms). Cùng run: gate CPU `PATCH update (user)` +14,7 % (lần 1 +5 %), các hàng
  khác đạt. Đo lần 3 (41676382806, 60b1b5b7): 3801 ms không index, 3832 ms có index, cùng plan; gate `PATCH update (user)`
  CPU 6,558 so với 6,582 ms (bằng nhau), p95 76,6 so với 42,1 ms (Directus cũng 117,7 ms ở `DELETE (user)`): nhiễu runner.
  Lần 4 (41698545792, 205e3b5e) xanh toàn bộ: `PATCH update (user)` CPU 8,99 so với 9,16 ms, p95 11,9 so với 11,5 ms.
- **FR-025**: deploy/README ghi: `pg_trgm` và quyền cài, gỡ tay (xóa bảng và dòng migration), timeout của reverse proxy
  khi tạo index lâu, index không nằm trong snapshot.
- **FR-101**: Bảng "Khác biệt so với Directus" có cột `Mã` đầu, `Gỡ ở` cuối để `tests/parity/src/spec-differences.ts`
  đọc; D-210..D-210.3 là entry `doc` (route và bảng chỉ Backoffice, test từng app), D-210.4 entry `http` (sửa khi plan
  2026-11-03).

### Key Entities

- **Index** (`backoffice_indexes`): một index DB do Backoffice tạo cho một collection người dùng: tên (duy nhất trên DB),
  danh sách field theo thứ tự, loại (btree, trigram), cờ unique, trạng thái lưu (`creating` → `ready` | `failed`,
  kèm thông điệp lỗi), ngày tạo; trạng thái `missing` tính lúc đọc từ catalog của vendor, không lưu. Thuộc một collection (không FK); nhiều index một collection; chỉ Backoffice đọc ghi.
- **Collection, Field** (`directus_collections`, `directus_fields`, có sẵn): chỉ collection người dùng và field là cột
  thật mới vào index; xóa field/collection ở Backoffice kéo theo index.
- **Vendor**: Postgres (btree ghép, trigram, tạo không khóa), MySQL (btree ghép, tạo không khóa với fallback), SQLite
  (btree ghép, tạo thường); vendor khác ngoài phạm vi đo.

### Đánh giá hiện trạng và chạy song song với Directus 11.17.4

Đọc code ngày 2026-11-03, chưa chạy thử. Mục ghi [Inference] là suy ra từ code, plan PHẢI có test xác nhận; mục
[Unverified] thử ở research của plan.

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Index một cột hiện có | `is_unique`/`is_indexed` của field tạo `column.unique`/`column.index` với tên từ `generateIndexName('unique'\|'index', collection, field)`; không có chỗ cho nhiều cột hay kiểu khác | `apps/api/src/services/fields.service.ts:1001`–`:1016` |
| 2 | Helper tạo index theo vendor | `createIndex(collection, field, { unique, attemptConcurrentIndex })`: Postgres `CREATE INDEX CONCURRENTLY`, MySQL `ALGORITHM=INPLACE LOCK=NONE` rồi fallback, SQLite thường; `concurrentIndexCreation` đọc ở controller `/fields` | `apps/api/src/database/helpers/schema/types.ts:24`, `dialects/postgres.ts:60`–`:78`, `dialects/mysql.ts:100`–`:120`, `dialects/sqlite.ts:216`, `apps/api/src/controllers/fields.controller.ts:50` |
| 3 | Migration gọi helper ngoài transaction | `20251028A`, `20260113A` gọi `helpers.schema.createIndex(..., { attemptConcurrentIndex: true })` | `apps/api/src/database/migrations/20251028A-add-retention-indexes.ts:27` |
| 4 | Câu tìm kiếm | `LOWER(??) LIKE ?` với `%x%` cho field `string`/`text`; index trigram phải trên biểu thức chữ thường [Inference] | `apps/api/src/database/run-ast/lib/apply-query/search.ts:80` |
| 5 | Lỗi trùng Postgres | Lấy nhóm ngoặc đầu của `detail` làm một `field`; unique ghép ra `"a, b"` | `apps/api/src/database/errors/dialects/postgres.ts:37`–`:45` |
| 6 | Lỗi trùng MySQL | Suy field từ tên index; tên `t_a_b_unique` ra field sai [Inference] | `apps/api/src/database/errors/dialects/mysql.ts` |
| 7 | Directus có index ghép không | Không: `/fields` chỉ `is_unique`/`is_indexed` một cột; snapshot không có index; app không có màn hình | `directus/api/src/services/fields.ts`, `directus/app/src/modules/settings/routes/data-model` |
| 8 | Migration riêng và collection hệ thống ẩn | Mẫu `20261101A` (`hasTable`, try/catch); khai báo ẩn ở `collections.yaml` | `apps/api/src/database/backoffice-migrations/20261101A-create-backoffice-passkeys.ts`, `libs/system-data/src/collections/collections.yaml` |
| 9 | Khóa dùng chung | `useLock().usingLock(...)` của migration riêng 022 | `apps/api/src/lock/lib/use-lock.ts` |
| 10 | Chỗ đặt card | Card D-182 trong trang collection của Data Model; probe 404 để ẩn như passkey | `apps/web/src/modules/settings/routes/data-model/FieldsRoute.vue`, `apps/web/src/composables/use-passkey-support.ts` |
| 11 | Bộ đối chiếu đọc mã D | Cột `Mã` đầu, `Gỡ ở` cuối; D-209 đã dùng ở spec 005 (2026-11-03) | `tests/parity/src/spec-differences.ts:29`–`:36`, `specs/005-items/spec.md:634` |
| 12 | Xóa cột có index ghép theo vendor | [Unverified] Postgres bỏ index; MySQL bỏ cột khỏi index và giữ phần còn lại; SQLite dựng lại bảng qua Knex. Vì vậy FR-014 gỡ trước trên mọi vendor | tài liệu vendor, kiểm ở research |
| 13 | `pg_trgm` | [Unverified] trusted extension từ Postgres 13: chủ DB cài được không cần superuser; managed DB thường cho phép | tài liệu Postgres, kiểm ở research |

**Kết luận** [Inference]: Directus không phải làm gì; Redis, file, cấu hình Directus không đổi; DB thêm một bảng
`backoffice_*` Directus không đọc và các index thật mà Directus tôn trọng như mọi ràng buộc DB.

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021–029).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-210 | Endpoint index của collection dưới `/backoffice/` (liệt kê, tạo, xóa; D-189.6) | 404 | Có, admin only; tạo trả 202 và chạy nền (clarify 2026-11-03); bộ đối chiếu: entry `doc`, test từng app bằng `appRequest` (Directus 404; sửa khi plan 2026-11-03) | Yêu cầu chủ dự án 2026-11-03: unique nhiều cột và index tìm kiếm | khác (duyệt 2026-11-03) | — |
| D-210.1 | `GET /fields` với cột nằm trong index ghép | `is_unique: false`, `is_indexed: false` (introspection một cột) | Giữ nguyên như Directus; index ghép chỉ hiện ở card Indexes và endpoint D-210; entry `doc` | Không đổi introspection để hai app giống nhau | khác (duyệt 2026-11-03) | — |
| D-210.2 | Bảng `backoffice_indexes` trong `GET /collections`, OAS, GraphQL introspection/SDL, Data Model | Bảng chưa quản lý | Collection hệ thống ẩn (403 `/items`, không GraphQL, ngoài Data Model); bộ đối chiếu bỏ `backoffice_*` như 022, 025, 029 | Nguyên tắc II (migration riêng) | khác (duyệt 2026-11-03) | — |
| D-210.3 | Xóa field hay collection | Chỉ DDL của field/collection; cột trong index ghép do DB xử lý | Gỡ mọi index có field đó và xóa dòng `backoffice_indexes` trước (hộp thoại xóa field của Data Model nêu tên index, clarify 2026-11-03); Directus xóa để lại dòng mồ côi, Backoffice liệt kê `missing: true`; entry `doc` | Không FK (Nguyên tắc II); MySQL giữ index thiếu cột nếu không gỡ trước | khác (duyệt 2026-11-03) | — |
| D-210.4 | Lỗi ghi trùng trên unique ghép (REST, import; GraphQL trả mục đầu ở cả hai app như `formatError` của Directus) | Postgres: một mục `RECORD_NOT_UNIQUE` với `field` là chuỗi "a, b"; SQLite: "a, b" tương tự; MySQL: field suy từ tên index | Một mục `RECORD_NOT_UNIQUE` cho từng field của index ở REST và import; GraphQL mục đầu với field thứ nhất; unique một cột không đổi; bộ đối chiếu: entry `http` | Lỗi của Directus không đọc được bằng máy với unique ghép | khác (duyệt 2026-11-03) | — |

**Cần xác nhận** (chủ dự án kiêm tech lead và design owner, cùng lượt duyệt D-210):

- Card "Indexes" ghép từ card độc lập của 029 (UserPasskeys), BoTable, BoDialog, BoSelect (ô thêm field), BoSortableList
  (danh sách field theo thứ tự, D-131) và BoSwitch có sẵn; không component mới; đặt cuối trang collection sau card
  Duplication (research R8); icon `database` của Material Symbols (design owner).
- Thông điệp 400 khi `pg_trgm` không cài được nêu nguyên văn lệnh cho DBA (chuỗi en-US/vi-VN).

## Clarifications

### Session 2026-11-03 (chủ dự án, `/speckit.clarify`)

- Q: POST tạo index trên bảng lớn (Postgres không khóa bảng) có thể mất nhiều phút: request chờ hay trả 202? → A: Trả 202
  và tạo trong job nền; dòng có trạng thái `creating` / `ready` / `failed`; card poll tới khi hết `creating`.
- Q: Tạo và xóa index có ghi vào Activity không? → A: Ghi như `backoffice_permissions` (mặc định của ItemsService, 025):
  create, delete và update khi job đổi trạng thái `ready`/`failed`; revision kèm theo như mọi collection hệ thống.
- Q: Hộp thoại thêm index chọn và sắp thứ tự field bằng gì? → A: Danh sách kéo thả (BoSortableList, D-131: kéo bằng
  chuột, menu dòng "Move up"/"Move down" cho bàn phím, vùng thông báo), field thêm vào danh sách từ một ô chọn; thứ tự
  trong danh sách là thứ tự cột.
- Q: Trên MySQL, field `text`, `json`, `geometry` trong index btree ghép? → A: Từ chối 400 nêu loại field; không có
  tham số prefix. `json`, `geometry` 400 trên mọi vendor; `text` chỉ vào index btree trên Postgres và SQLite.
- Q: Xóa một field đang nằm trong index ghép: hộp thoại xác nhận có báo trước không? → A: Có, hộp thoại xóa field của
  Data Model liệt kê tên các index sẽ bị gỡ (chỉ khi API là Backoffice); API xóa field không hỏi, cascade luôn.

### Sửa câu chữ khi `/speckit.plan` (2026-11-03, research R1–R14)

- FR-010: khóa Redis → ràng buộc duy nhất trên `backoffice_indexes.name` (R4).
- FR-008a, FR-009, US3 kịch bản 6, Assumptions: SIGTERM không chờ job; job đang chạy thành `failed` "Server shutdown"
  trước khi pool đóng (R4).
- FR-011, US2 kịch bản 2: `pg_trgm` không cài được → dòng `failed` nêu lệnh, vì tạo là job nền (R2; đã chạy thử: chủ DB
  cài được trên Postgres 13).
- Edge Cases, FR-013: 409 → 400 `INVALID_PAYLOAD` "Index is still being created" (không mã lỗi mới).
- FR-018, US1: card Indexes là card độc lập sau BoForm (cuối trang), không chèn được ngay sau card D-182 (R8).
- FR-005: `missing` là `null` trên MSSQL/Oracle (R5).
- Bảng D: D-210..D-210.3 entry `doc`, D-210.4 entry `http` (R11).

### Duyệt 2026-11-03 (chủ dự án kiêm tech lead và design owner, sau `/speckit.plan`)

- D-210..D-210.4 duyệt; hai điểm Complexity Tracking (sửa `server.ts` `onSignal`, chữ ký `translateDatabaseError`) duyệt;
  7 sửa câu chữ spec khi plan chấp nhận; icon `database` chấp nhận. Sau khi xem UI (2026-11-03): card Indexes đặt giữa
  danh sách field và Collection Setup (thay vì cuối trang), hộp thoại Add index có ghi chú giải thích và hướng dẫn.

### Sửa khi `/speckit.analyze` (2026-11-03, chủ dự án: sửa HIGH và MEDIUM)

- U1 (HIGH): FR-009 quy tắc 1 giờ trên Postgres chỉ áp khi `pg_stat_progress_create_index` không có build đang chạy
  (index đang build `CONCURRENTLY` cũng INVALID).
- I1: FR-016 và D-210.4 gồm cả SQLite.
- C1, C2, C3: tasks thêm assert activity (FR-016a), case `/utils/import` ở parity (D-210.4), 400 khi xóa collection
  đang `creating`.
- LOW: FR-018 `missing` là cờ; FR-013 tên lạ → 403; FR-005 thứ tự liệt kê.

## Assumptions

- Tối đa 8 field một index; tên cắt theo quy tắc của helper hiện có (Postgres 63, MySQL 64 ký tự).
- Trigram không unique, một field `string`/`text`; từ khóa dưới 3 ký tự có thể không dùng index (hành vi của Postgres),
  kết quả không đổi. `?search=` nối OR một `LIKE` cho mỗi cột chuỗi tìm được của collection, nên planner chỉ bỏ quét
  bảng khi **mọi** cột chuỗi đó có index trigram (một index chỉ giúp câu lọc trên đúng cột ấy); benchmark FR-024 tạo
  index trên cả ba cột chuỗi của seed (ghi khi implement 2026-11-03).
- MySQL: `string` dài vượt giới hạn khóa của engine → lỗi vendor thành 400 (job `failed` với thông điệp của vendor).
- Tạo index là job nền trên replica nhận request (clarify 2026-11-03): 202 ngay, không hàng đợi dùng chung, không
  chạy lại tự động khi replica dừng; ngưỡng coi dòng `creating` là bỏ dở: 1 giờ. Xóa index (DROP) vẫn đồng bộ (nhanh
  trên mọi vendor).
- Job nền không giữ khóa Redis (loại trừ đua bằng unique `name`, FR-010); SIGTERM đánh dấu job đang chạy `failed`
  "Server shutdown" trước khi pool DB đóng, không chờ DDL (shutdown của bản port đóng pool sau 1 giây; sửa khi plan
  2026-11-03); replica chết không SIGTERM: dòng ở lại `creating` và được coi là bỏ dở theo FR-009.
- Job giữ một kết nối của pool DB trong suốt thời gian tạo (pool mặc định 10): nhiều index tạo cùng lúc trên một replica
  làm chậm request khác; không giới hạn riêng (ghi deploy/README).
- Không emit `schemaChanged` sau khi tạo/xóa index: SchemaOverview không chứa index; `/fields` không đổi (D-210.1).
- Index không vào snapshot, diff, `schema/apply`; không đổi tên; không partial (WHERE), biểu thức tùy ý, hash, BRIN,
  INCLUDE, DESC/NULLS; không gợi ý index tự động; không index trên collection hệ thống (Ngoài phạm vi).
- MSSQL, Oracle, CockroachDB, MariaDB: btree ghép đi qua cùng helper nhưng chưa đo (nightly thủ công); trigram 400.
- Không `down`: gỡ tay bằng xóa index trên DB, bảng `backoffice_indexes` và dòng migration trong `backoffice_migrations`
  (Nguyên tắc II); deploy/README ghi.
- Số đo benchmark `?search=` chỉ ghi nhận, không ngưỡng.
- Activity của `backoffice_indexes` hiện trong module Activity như các collection hệ thống khác (lọc theo collection);
  không màn hình riêng.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin tạo được index unique ghép từ card trong dưới 1 phút bằng chuột và bằng bàn phím; 100% kịch bản US1
  đúng ở E2E `proxy-api` và `cors`, card ẩn ở `proxy-directus`.
- **SC-002**: Sau khi có index unique ghép, 100% lần ghi trùng cặp giá trị bị từ chối ở cả hai app; Backoffice trả lỗi
  nêu đủ các field trong 100% lần thử trên Postgres và MySQL.
- **SC-003**: 0 test đối chiếu, blackbox và E2E hiện có đổi kết quả; `/fields`, `/collections`, `/items`, `?search=`
  giống Directus như trước (US5).
- **SC-004**: Trong bộ kiểm thử triển khai 3 replica trên Postgres, POST tạo index trên collection seed trả 202 trong
  dưới 2 giây; trong lúc dòng `creating`, request ghi vào collection đó trả về trong dưới 2 giây ở 100% lần thử; dòng
  chuyển `ready` trước khi suite kết thúc; với tùy chọn tắt, ghi bị chờ tới khi tạo xong (quan sát được).
- **SC-005**: Trên Postgres, tìm kiếm trên collection có index trigram trả đúng tập kết quả như khi không có index trong
  100% lần thử; kế hoạch thực thi dùng index với từ khóa từ 3 ký tự.
- **SC-006**: Xóa field nằm trong index ghép thành công trên Postgres, SQLite, MySQL trong 100% lần thử, không để lại
  index hay dòng; cột xóa ở Directus hiện `missing` trong lần liệt kê kế tiếp.
- **SC-007**: `bootstrap` trên Postgres và SQLite tạo bảng và chạy lại không lỗi; `start` trên các vendor của CI không
  báo thiếu migration sau khi bảng có.
- **SC-008**: Hai request tạo cùng index trên hai replica cùng lúc: đúng một thành công trong 100% lần thử.
- **SC-009**: Card "Indexes" và hộp thoại không có vi phạm axe mức serious trở lên; mọi thao tác làm được bằng bàn phím.
