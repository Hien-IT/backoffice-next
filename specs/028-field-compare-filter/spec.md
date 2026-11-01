# Feature Specification: Lọc item bằng cách so sánh hai field của cùng collection

**Feature Branch**: `028-field-compare-filter` (làm trên `main` như 012–027, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=028-field-compare-filter`)
**Created**: 2026-11-01
**Status**: Lượt 1 (API REST, D-203, D-204) implement 2026-11-01 trên `main`; lượt 2 (web) và 3 (GraphQL) chờ (spec và
clarify 2026-11-01, 5 câu; plan 2026-11-01: research R1–R12, data-model, contracts, quickstart; D-203..D-206 duyệt
2026-11-01, chủ dự án kiêm tech lead; checklist api-compat và analyze 2026-11-01, phát hiện đã sửa; tasks 41 task ba
lượt)
**Input**: User description: "Feature 028: filter so sánh hai field của cùng collection (field-compare-filter). Bối cảnh:
filter của Directus 11.17.4 và Backoffice chỉ so field với giá trị cố định hoặc biến động ($NOW, $CURRENT_USER,
$CURRENT_ROLE, $CURRENT_ROLES, $CURRENT_POLICIES); không có cách lọc item mà một field so với field khác của cùng item,
ví dụ total > paid_amount (số với số) hay date_updated > date_published (ngày với ngày). [...] Cú pháp trong query: giá
trị động $FIELD(<tên field>) ở vế phải, cùng dạng với $NOW [...] Phạm vi đã chốt (chủ dự án 2026-11-01): hai field cùng
collection, không qua quan hệ; 6 toán tử so sánh; hai field phải cùng nhóm kiểu; khác nhóm thì API trả 400 và UI chỉ liệt
kê field cùng nhóm; [...] Chỉ dùng ở filter của trang Content [...] Khác biệt với Directus ghi từ D-203 [...]" (bản đầy
đủ: lệnh `/speckit.specify` của 028 trong `SPECKIT-GUIDE.md` mục 6)

**Điều kiện trước `/speckit.plan`** (Governance):

- Không sửa constitution: Nguyên tắc III cho phép khác biệt API khi đã ghi theo Nguyên tắc X (ghi trong spec, nêu lý do,
  tech lead duyệt). Không thêm bảng, cột, migration hay dependency (Nguyên tắc II giữ nguyên).
- Khác biệt D-203..D-206: chủ dự án kiêm tech lead duyệt 2026-11-01 (sau `/speckit.plan`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lọc item bằng so sánh hai field qua API (Priority: P1) 🎯 MVP

Một client (app khác, script, `@directus/sdk`) gọi `GET /items/<collection>` với một điều kiện mà vế phải là một field
khác của cùng item, ví dụ `total` lớn hơn `paid_amount`, hoặc `date_updated` sau `date_published`, và nhận đúng các
item khớp. Export theo cùng bộ lọc cũng ra đúng các item đó.

**Why this priority**: API là nền của mọi chỗ dùng; UI (US2) và GraphQL (US3) chỉ là client của cùng điều kiện.

**Independent Test**: seed collection `bo_field_compare` có `total`, `paid_amount` (số), `date_published`,
`date_updated` (ngày giờ), `title`, `slug` (chuỗi), `active`, `featured` (boolean), `owner`, `reviewer` (uuid), vài
dòng có null; gọi `/items` với `filter[total][_gt]=$FIELD(paid_amount)` trên Postgres, MySQL và SQLite.

**Acceptance Scenarios**:

1. **Given** item có `total` 100 và `paid_amount` 60, item có 50 và 60, **When** gọi `/items` lọc `total` `_gt`
   `$FIELD(paid_amount)`, **Then** chỉ trả item 100/60; `meta.filter_count` bằng số item khớp.
2. **Given** item có `date_updated` sau `date_published` và item ngược lại, **When** lọc `date_updated` `_gt`
   `$FIELD(date_published)`, **Then** chỉ trả item có cập nhật sau khi đăng.
3. **Given** sáu toán tử `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte`, **When** dùng từng toán tử với `$FIELD(b)`,
   **Then** kết quả bằng tập item mà biểu thức `a <toán tử> b` đúng theo SQL của vendor đó.
4. **Given** item có `paid_amount` null, **When** lọc `total` `_gt` `$FIELD(paid_amount)` hay `_neq`, **Then** item đó
   không khớp (như SQL), request vẫn 200.
5. **Given** cùng bộ lọc, **When** gọi `?export=csv`, `/utils/export/<collection>` hoặc `SEARCH /items` với body,
   **Then** file và kết quả chỉ chứa các item khớp.
6. **Given** request không dùng `$FIELD`, **When** gọi bất kỳ endpoint nào, **Then** kết quả giống hệt Directus 11.17.4
   (bộ đối chiếu hiện có không đổi).

---

### User Story 2 - Người dùng thêm dòng lọc "field a so với field b" trên trang Content (Priority: P1)

Trên `/content/<collection>`, người dùng mở bộ lọc, chọn field `total`, toán tử "Greater than", rồi trong ô giá trị bấm
nút chọn field và chọn `paid_amount` (menu chỉ liệt kê field số). Dòng lọc hiện "Total › Greater than › Paid Amount".
Danh sách chỉ còn item khớp. Người dùng lưu bookmark, mở lại sau vẫn đúng.

**Why this priority**: lý do chủ dự án hỏi tính năng này (2026-11-01).

**Independent Test**: trên collection mẫu, làm luồng trên bằng chuột và bàn phím ở ba cấu hình E2E; lưu bookmark, tải
lại trang, mở bookmark; ở cấu hình proxy tới Directus ghi lại kết quả Directus trả.

**Acceptance Scenarios**:

1. **Given** dòng lọc trên field số với toán tử so sánh, **When** người dùng mở ô giá trị, **Then** có nút chọn field;
   menu liệt kê các field cùng nhóm kiểu của collection (trừ chính field a), có nhãn đọc được cho screen reader.
2. **Given** người dùng chọn field b, **When** dòng lọc hiện lại, **Then** ô giá trị là chip tên hiển thị của field b
   (không hiện chuỗi `$FIELD(...)`), bấm chip đổi được field b hoặc trở lại nhập giá trị thường.
3. **Given** toán tử không phải một trong sáu toán tử so sánh (ví dụ Contains, In), **When** người dùng mở ô giá trị,
   **Then** không có nút chọn field.
4. **Given** người dùng gõ tay `$FIELD(paid_amount)` vào ô giá trị, **When** rời ô, **Then** ô nhận giá trị (không báo
   lỗi mẫu số) và hiện thành chip như khi chọn từ menu.
5. **Given** dòng lọc đã thêm, **When** lưu bookmark rồi mở lại, **Then** dòng lọc (field a, toán tử, field b) còn
   nguyên và danh sách lọc đúng.
6. **Given** người dùng chỉ dùng bàn phím, **When** thêm dòng lọc so sánh hai field, **Then** mọi bước làm được.
7. **Given** cấu hình E2E proxy tới Directus, **When** áp bộ lọc có `$FIELD`, **Then** kết quả là hành vi Directus đo ở
   lượt 1 (D-203.1), test ghi nhận đúng hành vi đó.

---

### User Story 3 - Lọc so sánh hai field qua GraphQL (Priority: P2)

Một client GraphQL gửi query `items` với điều kiện tương đương US1 và nhận cùng tập item như REST.

**Why this priority**: chủ dự án 2026-11-01: GraphQL cùng feature, làm ở lượt 3.

**Independent Test**: cùng dữ liệu US1, gửi query GraphQL cho từng toán tử và nhóm kiểu, so tập id với REST.

**Acceptance Scenarios**:

1. **Given** field số, ngày giờ, chuỗi, boolean, uuid, **When** gửi điều kiện so với field b của cùng nhóm, **Then** tập
   item bằng REST với cùng điều kiện.
2. **Given** field b khác nhóm kiểu hoặc không tồn tại, **When** gửi query, **Then** lỗi GraphQL có thông báo rõ, không
   lộ giá trị.
3. **Given** introspection và SDL của `/graphql` và `/graphql/system`, **When** so với Directus, **Then** ngoài phần
   thêm cho tính năng này (bị bộ đối chiếu bỏ qua như D-186), còn lại giống hệt.

---

### User Story 4 - Quyền, kiểu và những chỗ không cho dùng (Priority: P1)

Điều kiện so sánh hai field tuân theo quyền đọc trên cả hai field; sai kiểu hay sai field báo lỗi rõ; permission không
chấp nhận `$FIELD`; ngoài trang Content không có nút chọn field.

**Why this priority**: an toàn dữ liệu (field b không có quyền đọc không được dò qua field a) và chạy song song với
Directus (Nguyên tắc III, IV).

**Independent Test**: user chỉ có quyền đọc `total` gửi `total _eq $FIELD(paid_amount)`; lưu permission có `$FIELD`;
mở DrawerCollection, Settings > Policies, Insights.

**Acceptance Scenarios**:

1. **Given** user không có quyền đọc `paid_amount`, **When** lọc `total` so với `$FIELD(paid_amount)`, **Then** nhận
   cùng lỗi như khi lọc trực tiếp trên `paid_amount`; không có dòng nào trả về.
2. **Given** permission của user có điều kiện hàng, **When** user lọc so sánh hai field, **Then** chỉ thấy item vừa
   khớp vừa thuộc quyền.
3. **Given** `total` (số) so với `$FIELD(title)` (chuỗi), hoặc `$FIELD(khong_ton_tai)`, hoặc `$FIELD(author.age)` (qua
   quan hệ), **When** gọi `/items`, **Then** 400 với thông báo nêu rõ hai field phải cùng nhóm kiểu / field không có /
   không hỗ trợ qua quan hệ; không chạy query.
4. **Given** admin tạo hoặc sửa permission (`/permissions` REST, GraphQL `directus_permissions`, `/backoffice/permissions`)
   với điều kiện hàng hoặc validation chứa `$FIELD`, **When** lưu, **Then** 400 với thông báo rõ, permission không đổi.
5. **Given** DrawerCollection, bộ lọc permission/policy, validation và conditions của field, flow, Insights, Settings >
   Presets, module Files, Users, Activity, **When** người dùng mở ô giá trị của một dòng lọc, **Then** không có nút chọn
   field (chuỗi `$FIELD` gõ tay vẫn qua ô như một chuỗi và API so hai field theo FR-001; sửa khi checklist
   2026-11-01).
6. **Given** tên field b chứa ký tự lạ (dấu nháy, `;`, `--`, khoảng trắng), **When** lọc, **Then** tên chỉ được tra
   trong schema, không thành câu lệnh; không có trong schema thì 400.

---

### Edge Cases

- Field a và field b là cùng một field (`total _eq $FIELD(total)`): hợp lệ, khớp mọi dòng `total` không null (không
  chặn, không có giá trị riêng).
- `_eq`/`_neq` với một vế null: không khớp như SQL (`NULL = x` và `NULL <> x` đều không đúng; clarify 2026-11-01 câu 4,
  không thêm điều kiện IS NULL); `_null`/`_nnull` với chuỗi `$FIELD(...)`: 400 "_null has to be a boolean" như
  Directus (sửa khi analyze 2026-11-01, I2).
- Nhóm kiểu: số = `integer`, `bigInteger`, `float`, `decimal`; ngày giờ = `date`, `dateTime`, `timestamp`; chuỗi =
  `string`, `text`; `boolean`; `uuid`. `time`, `hash`, `json`, `csv`, `geometry.*`, `alias`, `binary` không nằm trong
  nhóm nào: 400 ở cả hai vế. Field m2o dùng cột khóa ngoại của nó với kiểu lưu trong schema (`user_created` uuid so với
  `assignee` uuid; clarify 2026-11-01 câu 1).
- So `integer` với `decimal` (mọi vendor ép về số) và `string` với `text`: được; `date` với `timestamp`, `dateTime` với
  `timestamp`: 400 như khác nhóm, vì SQLite lưu ngày giờ dạng text nên so chéo cho kết quả khác Postgres/MySQL (clarify
  2026-11-01 câu 1).
- So chuỗi: phân biệt hoa thường theo collation của cột ở từng vendor (MySQL mặc định không phân biệt), như `_eq` với
  giá trị thường hiện nay; không ép LOWER.
- Chuỗi nguyên văn `$FIELD(x)` làm giá trị thường (một field chuỗi có đúng giá trị đó): không còn lọc được, như `$NOW`
  ở Directus (D-203); `$FIELD()`, `$FIELD(author.age)`, `$FIELD(a b)`: 400 rõ lý do (analyze I1); chuỗi không có dạng
  `$FIELD(...)` (`$FIELD`, `$FIELD(a` không đóng ngoặc, `$field(a)`) là giá trị thường.
- `$FIELD(b)` trong `_in`, `_between`, `_contains`, `_starts_with`... : giá trị thường như hiện nay (chuỗi), không có
  nghĩa đặc biệt; UI không hiện nút chọn field ở các toán tử đó.
- Field a kiểu `uuid`, `boolean` hay chuỗi (`string`, `text`): bảng toán tử của Directus cho kiểu đó chỉ có `_eq`,
  `_neq` (không `_gt`...), nên với `$FIELD` cũng chỉ hai toán tử đó (400 như hiện nay cho toán tử khác, ở cả hai app;
  sửa khi plan 2026-11-01, research R2; chuỗi thêm khi implement lượt 1, T002). Sáu toán tử đủ cho số và ngày giờ.
- Field a là hàm (`year(published_at)`, `json(...)`) với `$FIELD`: 400 "chỉ trên field thường" (sửa khi plan
  2026-11-01, research R1).
- `$FIELD(b)` ở `deep` (filter của field quan hệ trong `fields`): cùng cơ chế với filter lồng qua quan hệ của FR-005
  (field b thuộc collection của filter đó), không test riêng (sửa khi checklist 2026-11-01).
- Bookmark cũ có `$FIELD(b)` mà field b bị xóa hay đổi tên: API 400 (field không có); UI hiện chip với key thô và trạng
  thái lỗi, người dùng đổi field hoặc xóa dòng (clarify 2026-11-01 câu 5).
- Permission đã có `$FIELD` ghi tay ở Directus (D-204 không chặn được): ở Backoffice điều kiện hàng chạy như so sánh hai
  field; ở Directus so với chuỗi nguyên văn. Như D-185 của 023.
- Bookmark có `$FIELD` mở trên Directus app: Directus so field với chuỗi nguyên văn `'$FIELD(b)'`: cột chuỗi 0 dòng
  (`_neq`: mọi dòng), cột số 400, cột timestamp/boolean/uuid 500 với thông điệp SQL của Postgres (T002 2026-11-01; SQLite
  ở T009).
- Response cache dùng chung với Directus (005): request có `$FIELD` có key riêng theo query; từ 026 request của người
  dùng chỉ tới domain Backoffice nên Directus không trả lại entry đó. [Inference]
- Hiệu năng: so hai cột không dùng index B-tree của cột; collection lớn quét bảng. Không tạo index, không có ngưỡng
  benchmark riêng (ghi ở Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: API PHẢI nhận ở vế phải của một điều kiện filter giá trị động `$FIELD(<tên field>)` nghĩa là "giá trị của
  field đó trên cùng item", cùng dạng với `$NOW(...)`: `filter[total][_gt]=$FIELD(paid_amount)` và JSON
  `{"total": {"_gt": "$FIELD(paid_amount)"}}`. Mọi chuỗi bắt đầu bằng `$FIELD(` và kết thúc bằng `)` là giá trị
  động; phần trong ngoặc (bỏ khoảng trắng hai đầu) phải là key của một field trong collection của field a, không có dấu
  chấm (không qua quan hệ), ngoặc, dấu phẩy hay khoảng trắng: sai thì 400 `INVALID_QUERY` nêu rõ lý do (rỗng, qua quan
  hệ, ký tự lạ). Chuỗi khác (`$field(b)`, `$FIELD`, `$FIELD(b` không đóng ngoặc) là chuỗi thường (sửa khi analyze
  2026-11-01, I1).
- **FR-002**: Chỉ sáu toán tử `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte` hiểu `$FIELD`; ở toán tử khác chuỗi đó là giá
  trị thường như hiện nay.
- **FR-003**: Hai field PHẢI cùng nhóm kiểu: số (`integer`, `bigInteger`, `float`, `decimal`, so chéo được trong nhóm),
  chuỗi (`string`, `text`, so chéo được), ngày giờ (`date`, `dateTime`, `timestamp`: chỉ so khi cùng kiểu lưu),
  `boolean`, `uuid`; field m2o thuộc nhóm theo kiểu cột khóa ngoại của nó (m2o tới users là `uuid`) (clarify
  2026-11-01 câu 1). Khác nhóm, ngày giờ khác kiểu lưu, field b không có trong collection, field b có dấu chấm, hoặc một
  vế thuộc kiểu ngoài năm nhóm: 400 `INVALID_QUERY` với thông báo nêu hai field và lý do (sửa khi checklist
  2026-11-01); không chạy query. Field b không có trong collection: 403 `FORBIDDEN` "...or it does not exist" cho mọi
  user kể cả admin, như Directus trả cho filter key không tồn tại, vì bước kiểm đường dẫn chạy trước kiểm kiểu (FR-006;
  sửa khi plan 2026-11-01, research R3; đo ở lượt 1: admin cũng 403). Tên sai dạng (rỗng, dấu chấm, khoảng trắng)
  không vào bước kiểm đường dẫn nên vẫn 400 rõ lý do.
- **FR-004**: So sánh là so sánh cột với cột của SQL chuẩn trên mọi vendor Directus hỗ trợ (Postgres, MySQL/MariaDB,
  SQLite, MSSQL, Oracle, CockroachDB, Redshift; sửa khi checklist 2026-11-01), không dùng hàm riêng dialect; một vế null thì không khớp với mọi toán tử trong
  sáu toán tử.
- **FR-005**: `$FIELD` PHẢI dùng được ở mọi chỗ dùng chung query của items: `GET /items`, `SEARCH /items`, export
  (`?export=`, `/utils/export`), `meta.filter_count`, aggregate, lồng trong `_and`, `_or`, và lồng qua quan hệ
  (`{ order: { total: { _gt: "$FIELD(paid_amount)" } } }`: field b thuộc collection sau quan hệ, cùng collection với
  field a); qua các guard 024/025 như filter thường. Vì engine filter dùng chung, `$FIELD` cũng chạy ở endpoint
  collection hệ thống (`/users`, `/files`, `/activity`...) và ở mọi service gọi engine (flow `item-read`, export);
  spec không gate, parity chỉ đo `/items` (sửa khi checklist 2026-11-01, CHK002, CHK012).
- **FR-006**: Quyền: field b PHẢI được kiểm quyền đọc như một filter key thứ hai trên cùng collection; thiếu quyền đọc
  field b thì cùng lỗi như lọc trực tiếp trên field b (403 `FORBIDDEN` như Directus cho filter key không có quyền; không
  phải 400 "field không có"; clarify 2026-11-01 câu 2), không lộ giá trị; điều kiện hàng của permission vẫn áp dụng.
- **FR-007**: Tên field b chỉ được tra trong schema của collection và đưa vào câu lệnh dưới dạng định danh cột đã kiểm
  (cùng cách với field a); không ghép chuỗi người dùng vào SQL.
- **FR-008**: `/graphql` PHẢI có điều kiện tương đương FR-001..FR-004 cho field số, ngày giờ, chuỗi, boolean, uuid, cùng
  kết quả với REST: trong input `<collection>_filter`, mỗi field thuộc năm nhóm có thêm field `<field>_field` kiểu input
  dùng chung `field_compare_operators { _eq, _neq, _gt, _gte, _lt, _lte: field_ref }` với `field_ref { field: String! }`
  (key của field b), ánh xạ về `{ <field>: { <op>: "$FIELD(<b>)" } }` của REST (clarify 2026-11-01 câu 3; giá trị
  bọc trong `field_ref` thay vì String vì bước ánh xạ không có schema để phân biệt với một field thật tên `<f>_field`,
  sửa khi plan 2026-11-01, research R5). Ví dụ `filter: { total_field: { _gt: { field: "paid_amount" } } }`. Các `*_filter_operators` dùng chung và `/graphql/system`
  không đổi; bộ đối chiếu bỏ các field `*_field` và hai type `field_compare_operators`, `field_ref` khỏi
  introspection/SDL như D-186.
- **FR-009**: Request không dùng `$FIELD` PHẢI giống hệt Directus 11.17.4 (status, body, header), kể cả giá trị chuỗi
  bắt đầu bằng `$` khác; bộ đối chiếu và blackbox hiện có không đổi.
- **FR-010**: Bookmark/preset lưu điều kiện có `$FIELD(b)` vào `directus_presets` như mọi điều kiện khác (không thêm cột
  hay bảng); mở lại ở Backoffice cho cùng kết quả.
- **FR-011**: API PHẢI trả 400 `INVALID_PAYLOAD` (sửa khi checklist 2026-11-01) khi tạo hoặc sửa permission
  (`/permissions` REST, GraphQL `directus_permissions`, `/backoffice/permissions`) có `permissions` (điều kiện hàng)
  hoặc `validation` chứa `$FIELD`, như D-185 của 023. Chỉ
  permission: `/fields`, `/flows`, `/operations` KHÔNG kiểm khi lưu (chạy trong JS trên dữ liệu, chuỗi `$FIELD` chỉ là
  chuỗi ở cả hai app).
- **FR-012**: Trang Content (`/content/<collection>`: bộ lọc ở page header, bookmark, preset) PHẢI cho thêm dòng lọc so
  sánh hai field: ở sáu toán tử so sánh, ô giá trị có nút chọn field mở menu các field cùng nhóm kiểu của collection
  (trừ field a; tên hiển thị của field, thêm key trong ngoặc khi hai field trùng tên hiển thị; clarify 2026-11-01 câu
  5); chọn xong ô giá trị là chip tên hiển thị của field b; bấm chip đổi field hoặc về nhập giá trị thường; gõ tay
  `$FIELD(b)` vẫn nhận và hiện thành chip. Nhãn en-US và vi-VN.
- **FR-013**: Mọi chỗ khác dùng bộ lọc (DrawerCollection, permission/policy, validation và conditions của field, flow,
  Insights, Settings > Presets, module Files, Users, Activity, bộ lọc của mục Export) KHÔNG có nút chọn field; dòng lọc
  có sẵn `$FIELD` ở các chỗ đó hiện chuỗi thường; chuỗi `$FIELD(b)` gõ tay ở đó vẫn tới API và được so hai field theo
  FR-001 (D-206 chỉ là giao diện; sửa khi checklist 2026-11-01).
- **FR-014**: Bookmark có field b không còn tồn tại (xóa hay đổi tên): API 400 theo FR-003; UI hiện chip với key thô ở
  trạng thái lỗi, bấm chip chọn lại field hoặc xóa dòng (clarify 2026-11-01 câu 5).
- **FR-015**: UI PHẢI theo design-system (Nguyên tắc XII): nút chọn field và chip ghép từ recipe Q-7 (popover bộ lọc),
  BoMenu và chip của dòng lọc hiện có, không component mới (chủ dự án kiêm design owner chốt 2026-11-01); nhãn liên
  kết, bàn phím, focus-visible, trạng thái lỗi.
- **FR-016**: Test: unit API (sáu toán tử, năm nhóm kiểu, null, khác nhóm 400, field không có, qua quan hệ 400, quyền
  field b, permission bị từ chối) trên Postgres, MySQL, SQLite; bộ đối chiếu ở proxy-api ghi D-203..D-206 và đo hành vi
  Directus với cùng request và bookmark (lượt 1), chứng minh FR-009; GraphQL so với REST; E2E Content ở ba cấu hình gồm
  bước bàn phím và bookmark; không thêm case benchmark.

### Key Entities

- **Điều kiện so sánh hai field**: field a (bên trái), toán tử (một trong sáu), field b (vế phải, cùng collection, cùng
  nhóm kiểu). Nằm trong `filter` của query dưới dạng giá trị `$FIELD(b)`, lưu được trong bookmark/preset.
- **Nhóm kiểu**: năm nhóm (số, ngày giờ, chuỗi, boolean, uuid) suy từ kiểu field trong schema; không lưu ở đâu.
- **Bookmark/preset** (`directus_presets`, dùng chung với Directus): cột `filter` chứa điều kiện như mọi điều kiện khác.

### Đánh giá hiện trạng và chạy song song với Directus 11.17.4

Đọc code ngày 2026-11-01, chưa chạy thử. Mục ghi [Inference] là suy ra từ code, plan PHẢI có test xác nhận; mục
[Unverified] đo ở lượt 1.

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Giá trị động hiện có | `$NOW`, `$CURRENT_USER`, `$CURRENT_ROLE`, `$CURRENT_ROLES`, `$CURRENT_POLICIES`; `parseDynamicVariable` không có nhánh khác, chuỗi lạ đi qua nguyên vẹn | `libs/utils/src/shared/parse-filter.ts:142`, `directus/packages/utils/shared/is-dynamic-variable.ts` |
| 2 | Validate giá trị filter | `validateFilterPrimitive` nhận chuỗi, nên `$FIELD(b)` qua được ở cả hai app | `apps/api/src/utils/validate-query.ts:133` |
| 3 | Áp toán tử | `applyWhere` ép `compareValue = cast(compareValue)` theo kiểu field a trước khi so; `castToNumber('$FIELD(b)')` ném 400 "Invalid numeric value", ngày đi qua `helpers.date.parse`; vế trái đã qua `getColumn` với alias bảng | `apps/api/src/database/run-ast/lib/apply-query/filter/operator.ts:139`, `:195`, `:115` |
| 4 | Directus với `$FIELD(b)` | [Unverified] field chuỗi: so với chuỗi nguyên văn, 0 dòng; field số: 400 `Invalid numeric value` (cùng `castToNumber`); field ngày: tùy `helpers.date.parse` của vendor. Đo ở lượt 1 | `directus/api/src/database/run-ast/lib/apply-query/filter/operator.ts` (cùng mã) |
| 5 | Quyền đọc trên filter key | `flattenFilter` chỉ lấy key, không lấy giá trị; không sửa thì field b không bị kiểm quyền [Inference] | `apps/api/src/permissions/modules/process-ast/utils/flatten-filter.ts:5`, `extract-paths-from-query.ts:26` |
| 6 | Chặn permission | `assertNoJsonPathFilter` của D-185 là chỗ chặn khi lưu permission | `apps/api/src/services/permissions.service.ts:204` |
| 7 | GraphQL | `string_filter_operators._eq` là String; number/date/boolean là Float/Date/Boolean nên chuỗi `$FIELD` không vào được; 023 thêm input `json_path_filter_operators` và `<f>_json`, rewrite trước `sanitizeQuery` | `apps/api/src/services/graphql/schema/read.ts:125`, `:190`, `:208`, `:251`, `:438`, `:529`; `utils/replace-funcs.ts:13` |
| 8 | Ô giá trị của bộ lọc web | `isValueValid` chỉ cho qua biến động của `@directus/utils` (5 prefix cố định) và `{{ }}`; pattern số/uuid từ chối `$FIELD(b)` ở field số | `apps/web/src/interfaces/_system/system-filter/InputComponent.vue:9`, `:67`, `:114` |
| 9 | Chỗ đặt nút chọn field | Nút biến `{{ }}` của dòng lọc | `apps/web/src/interfaces/_system/system-filter/InputGroup.vue:265` |
| 10 | Bật riêng cho Content | 023 bật `include-json-path` ở CollectionRoute và DrawerCollection; 028 chỉ CollectionRoute | `apps/web/src/modules/content/routes/CollectionRoute.vue:426`, `DrawerCollection.vue:216` |
| 11 | Toán tử mới thay cho giá trị động | Không chọn: Directus cho toán tử lạ qua `validateFilter` (nhánh `default`) và `applyOperator` không thêm điều kiện nào → bookmark dùng chung hiện toàn bộ dòng ở Directus app [Inference]; dạng `{ _eq: { _field: 'b' } }` bị Directus 400 nhưng không vào được GraphQL và ô nhập web | `apps/api/src/utils/validate-query.ts:72`, `operator.ts:197` |
| 12 | Dữ liệu và schema | Không thêm bảng, cột, migration, dependency; `directus_presets.filter` là JSON tự do | — |
| 13 | Bộ đối chiếu đọc mã D | Bảng "Khác biệt so với Directus" (cột `Mã` đầu, `Gỡ ở` cuối) | `tests/parity/src/spec-differences.ts` |

**Kết luận** [Inference]: Directus không phải làm gì; DB, Redis, file, cấu hình không đổi. Directus chỉ thấy bookmark có
giá trị nó không hiểu (0 dòng hoặc 400 khi mở, đo ở lượt 1); từ 026 request của người dùng không tới Directus.

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021–023).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-203 | Giá trị `$FIELD(b)` ở vế phải của `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte` (`/items`, `SEARCH`, export; cùng engine nên cả endpoint collection hệ thống, aggregate và service gọi engine, parity chỉ đo `/items`: sửa khi checklist 2026-11-01) | Chuỗi thường (T002, Postgres): field số 400 `INVALID_QUERY` "Invalid numeric value"; field chuỗi 200 so với chuỗi nguyên văn (`_eq` 0 dòng, `_neq` mọi dòng); field timestamp, boolean, uuid: Postgres 500 `INTERNAL_SERVER_ERROR` với thông điệp SQL; SQLite 200 so text (0 dòng, `_neq` mọi dòng); MySQL 8 timestamp 500, boolean và uuid 200; `/utils/export` 204 rồi job lỗi ngầm; vendor nightly chưa đo | So field a với field b của cùng item; khác nhóm kiểu, field không có, qua quan hệ: 400; chuỗi nguyên văn `$FIELD(...)` không còn lọc được như giá trị thường (như `$NOW`) | Yêu cầu chủ dự án 2026-11-01 | khác (duyệt 2026-11-01) | — |
| D-203.1 | Bookmark/preset có `$FIELD` mở ở Directus app | Không có nút chọn field; gõ tay `$FIELD(b)` được ở field chuỗi, là chuỗi thường (analyze I4) | Lưu vào `directus_presets` dùng chung (T002: `POST /presets` 200 ở Directus); Directus app mở bookmark đó gửi cùng filter và nhận kết quả của D-203 cột Directus (400 với field số, 500 với ngày/boolean/uuid, 0 dòng với chuỗi) | Chủ dự án 2026-11-01: chấp nhận | khác (duyệt 2026-11-01) | — |
| D-204 | Permission có điều kiện hàng hoặc validation chứa `$FIELD` | Lưu được (lượt 1: 200); request của role đó chạy với chuỗi thường | 400 `INVALID_PAYLOAD` khi lưu (REST, GraphQL, `/backoffice/permissions`); chỉ permission, không kiểm `/fields`, `/flows`, `/operations`; bộ đối chiếu: entry `http` D-185 (cùng endpoint và mã) nhận khác biệt, D-204 là `doc` | Như D-185: tránh một permission làm hỏng mọi request của role | khác (duyệt 2026-11-01) | — |
| D-205 | GraphQL `/graphql` | Input `<collection>_filter` chỉ có `<field>` và `<field>_func` | Thêm `<field>_field: field_compare_operators` (sáu toán tử, giá trị `field_ref { field }` là key field b; sửa khi plan 2026-11-01) cho field số, ngày giờ, chuỗi, boolean, uuid, ánh xạ về `$FIELD(b)`; introspection và SDL khác ở các field `*_field` và hai type `field_compare_operators`, `field_ref`, bộ đối chiếu bỏ chúng như D-186 | Chủ dự án 2026-11-01: GraphQL cùng feature | khác (duyệt 2026-11-01) | — |
| D-206 | Nút chọn field trong ô giá trị của dòng lọc | Không có | Chỉ ở bộ lọc của trang Content; DrawerCollection, permission, validation, flow, Insights, Presets, Files, Users, Activity không có | Chủ dự án 2026-11-01: chỉ trang Content | khác (duyệt 2026-11-01) | — |

**Cần xác nhận**: không có (chủ dự án 2026-11-01, cùng lượt duyệt D-203..D-206): so chuỗi theo collation của cột
ở từng vendor, không ép LOWER (Assumptions); nút chọn field + chip ghép từ recipe Q-7, BoMenu và chip dòng lọc, không
component mới (FR-015, chủ dự án kiêm design owner).

## Clarifications

### Session 2026-11-01 (chủ dự án, `/speckit.clarify`)

- Q: Hai field cùng nhóm nhưng khác kiểu lưu (integer với decimal, date với timestamp, string với text) có so được không? → A: Số và chuỗi so chéo trong nhóm (vendor ép số; string với text); ngày giờ chỉ so cùng kiểu lưu (date với date, dateTime với dateTime, timestamp với timestamp) vì SQLite lưu text nên so chéo lệch vendor; field m2o dùng kiểu cột khóa ngoại (m2o tới users là uuid).
- Q: User không có quyền đọc field b gửi `total _gt $FIELD(paid_amount)` thì API trả gì? → A: Cùng lỗi như lọc thẳng trên field b (field b qua cùng bước kiểm quyền như một filter key, 403 `FORBIDDEN` như Directus trả cho filter key không có quyền đọc); không coi như field không có.
- Q: Điều kiện so hai field đưa vào schema `/graphql` theo dạng nào? → A: Input riêng: mỗi field thuộc năm nhóm có thêm `<field>_field: field_compare_operators { _eq, _neq, _gt, _gte, _lt, _lte: String }` (giá trị là key của field b), như `<field>_json` của 023; một type mới, các `*_filter_operators` dùng chung không đổi; bộ đối chiếu bỏ các field `*_field` và type đó như D-186.
- Q: `_neq` khi một vế null (total 100, paid_amount null): item có khớp không? → A: Không khớp, như SQL (`a <> b` với một vế NULL không đúng), giống `_neq` với giá trị thường hiện nay và giống nhau mọi vendor; không thêm điều kiện IS NULL.
- Q: Chip ở ô giá trị và menu chọn field hiện tên gì của field b? → A: Tên hiển thị của field (như dòng lọc hiện field a); hai field trùng tên hiển thị thì menu thêm key trong ngoặc; field b đã bị xóa hay đổi tên: chip hiện key thô ở trạng thái lỗi, bấm để chọn lại.

### Duyệt 2026-11-01 (chủ dự án kiêm tech lead, sau `/speckit.plan`)

- D-203, D-203.1, D-204, D-205 (giá trị `field_ref`), D-206: duyệt hết. Collation theo cột, mẫu design-system ghép từ
  Q-7: chốt cùng lượt.

### Kết quả T001, T002, T009 khi implement lượt 1 (2026-11-01)

- T001: `knex.ref` ở vế phải của `where` in ra định danh, không binding (research R1).
- T002: Directus với `$FIELD` theo vendor ở cột Directus của D-203 (Postgres, SQLite, MySQL 8 đo bằng script tạm).
- Field b không có: 403 `FORBIDDEN` cho cả admin (FR-003, research R3); field m2o là cột khóa ngoại nên so được với
  field cùng nhóm (`total _eq $FIELD(customer)` với FK integer, clarify câu 1).
- Bộ đối chiếu: D-204 là `doc` vì entry `http` D-185 (cùng endpoint, cùng mã `INVALID_PAYLOAD`) khớp trước.
- Parity xanh trên Postgres 16, SQLite, MySQL 8 (T009); MySQL so chuỗi không phân biệt hoa thường.

### Sửa khi `/speckit.analyze` (2026-11-01, chủ dự án: sửa hết, I1 theo cách a)

- I1: mọi `$FIELD(...)` là giá trị động; tên rỗng, qua quan hệ hay ký tự lạ → 400 rõ (FR-001, Edge Cases, research
  R1, contracts/api.md, data-model, tasks T003).
- I2: `_null`/`_nnull` với `$FIELD` là 400 như Directus (Edge Cases).
- C1: T041 chạy `benchmark-items` cho SC-006. C2: T007 thêm aggregate và đối chứng `$NOW`, `$CURRENT_USER`, `$FIELD(`
  sai dạng. I3: T002 đo thêm SQLite, D-203 ghi vendor đo. I4: D-203.1 cột Directus.

### Sửa khi `/speckit.checklist` api-compat (2026-11-01, checklists/api-compat.md)

- CHK002: FR-005, D-203 ghi phạm vi engine dùng chung (collection hệ thống, aggregate, service), parity chỉ đo `/items`.
- CHK012: FR-005 lọc lồng qua quan hệ, Edge Case `deep` cùng cơ chế.
- CHK019: mã lỗi `INVALID_QUERY` (FR-003), `INVALID_PAYLOAD` (FR-011).
- CHK022: FR-004 thêm Redshift. CHK026: FR-013 dẫn FR-001 thay vì FR-011.

### Sửa câu chữ khi `/speckit.plan` (2026-11-01, research R1, R2, R3, R5)

- FR-008, D-205, data-model: giá trị GraphQL là `field_ref { field }` thay vì String (R5).
- FR-003: user không phải admin nhận 403 trước 400 khi field b không có hoặc không có quyền (R3).
- Edge Cases: `uuid`/`boolean` chỉ `_eq`/`_neq` (R2); field a là hàm: 400 (R1).

Chưa hỏi (giữ mặc định, ghi ở Edge Cases và "Cần xác nhận"): so chuỗi theo collation của vendor; mẫu design-system cho nút chọn field và chip (design owner chốt ở plan/analyze như C1 của 023).

## Assumptions

- Số khác kiểu lưu (`integer` với `decimal`, `float`) so theo luật ép số của vendor (như so số với giá trị thường hiện
  nay); test có một cặp chéo cho nhóm số và nhóm chuỗi trên Postgres, MySQL, SQLite.
- `$FIELD` chỉ có nghĩa ở vế phải; `$FIELD(a)` ở vị trí key không được hỗ trợ (key vẫn là tên field như hiện nay).
- Không tạo index và không đặt ngưỡng benchmark cho lọc so sánh hai field (Directus không có tính năng này để so); SC-006
  chỉ giữ ngưỡng của benchmark hiện có.
- Người dùng gọi thẳng domain Directus với `$FIELD` nhận kết quả Directus (D-203); từ 026 lb không gửi request Backoffice
  tới Directus.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Người dùng thêm được dòng lọc "Total › Greater than › Paid Amount" trên trang Content trong dưới 1 phút,
  bằng chuột và bằng bàn phím, và thấy đúng các item khớp.
- **SC-002**: 100% kịch bản của US1 và US4 đúng trên Postgres, MySQL và SQLite ở CI mỗi lần push; MariaDB, MSSQL, Oracle,
  CockroachDB qua nightly là bổ sung.
- **SC-003**: 0 test đối chiếu, blackbox và E2E hiện có bị đổi kết quả (request không dùng `$FIELD` giống Directus).
- **SC-004**: REST và GraphQL trả cùng tập item cho 100% điều kiện mẫu của US3.
- **SC-005**: Trên 100% lượt E2E ở `proxy-api` và `cors`, luồng US2 làm được bằng bàn phím và bookmark mở lại cho cùng
  kết quả; ở `proxy-directus` test ghi nhận đúng hành vi Directus đo ở lượt 1 (D-203.1).
- **SC-006**: Scenario benchmark hiện có của Backoffice không tệ hơn Directus quá 10% (Nguyên tắc X).
- **SC-007**: User không có quyền đọc field b nhận lỗi trong 100% trường hợp của US4 kịch bản 1; không request nào trả
  dòng.
