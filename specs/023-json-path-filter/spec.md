# Feature Specification: Lọc item theo path trong field json

**Feature Branch**: `023-json-path-filter` (làm trên `main` như 012–022, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=023-json-path-filter`)
**Created**: 2026-10-27
**Status**: Implemented 2026-10-27, ba lượt trên `main` (`7412cb45`..`9033b7d7`), CI 40404290750 và 40423967360 xanh,
benchmark-items 40423999222 và benchmark-web 40415449804 xanh; T055 (nightly vendor khác) để chủ dự án quyết định (spec
và clarify 2026-10-27; plan 2026-10-27: research R1–R16, data-model, contracts, quickstart; D-184..D-187 duyệt
2026-10-27, chủ dự án kiêm tech lead; C1: form path + kiểu ghép từ recipe Q-7, Input, Select)
**Input**: User description: "Feature 023: filter theo path trong field json (json-path-filter). Bối cảnh: field kiểu json
(cột json hoặc jsonb) hiện chỉ filter được _null/_nnull. API trả 400 "Invalid filter key" cho key json(field, path) trong
filter; FieldList có mục "functions.json" nhưng gửi json(field) không có path nên cũng 400. Directus 11.17.4 giống vậy.
Ví dụ: field transaction_data = {"Amount": 6000, ...}; người dùng cần lọc item có Amount = 6000. Mục tiêu: lọc item theo
giá trị tại một path trong field json; field vẫn là json, schema và dữ liệu không đổi, chạy song song với Directus. [...]
Khác biệt với Directus, chủ dự án đã chấp nhận ngày 2026-10-27, ghi từ D-184 [...]" (bản đầy đủ: lệnh
`/speckit.specify` của 023 trong `SPECKIT-GUIDE.md` mục 6)

**Điều kiện trước `/speckit.plan`** (Governance):

- Không sửa constitution: Nguyên tắc III cho phép khác biệt API khi đã ghi theo Nguyên tắc X (ghi trong spec, nêu lý do,
  tech lead duyệt). Không thêm bảng, cột hay migration (Nguyên tắc II giữ nguyên).
- Khác biệt D-184..D-187: chủ dự án kiêm tech lead duyệt 2026-10-27 (sau `/speckit.plan`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lọc item theo giá trị trong field json qua API (Priority: P1) 🎯 MVP

Một client (app khác, script, `@directus/sdk`) gọi `GET /items/<collection>` với bộ lọc trên một path trong field json,
ví dụ `Amount` của `transaction_data` bằng 6000, và nhận đúng các item khớp. Export theo cùng bộ lọc cũng ra đúng các
item đó.

**Why this priority**: chủ dự án 2026-10-27: "nếu API có hỗ trợ là được rồi". UI (US2) chỉ là một client của API này.

**Independent Test**: seed collection có field json `transaction_data` với các giá trị `Amount` 6000, 7000, "6000" (chuỗi),
thiếu `Amount`, null; gọi `/items` với bộ lọc Number `Amount` = 6000 trên Postgres (cột json, cột jsonb) và SQLite.

**Acceptance Scenarios**:

1. **Given** item có `transaction_data.Amount` = 6000 và item có 7000, **When** gọi `/items` lọc `Amount` kiểu Number
   bằng 6000, **Then** chỉ trả item có 6000, `meta.filter_count` bằng số item khớp.
2. **Given** item thiếu `Amount`, item có `transaction_data` null, item có `Amount` là chuỗi "abc", **When** lọc như trên,
   **Then** các item đó không khớp và request vẫn trả 200 (không lỗi cả query).
3. **Given** path lồng nhau `dimensions.width` và path có chỉ số `items[0].sku`, **When** lọc theo các path đó, **Then**
   kết quả đúng như khi đọc giá trị bằng `fields=json(field, path)`.
4. **Given** mảng `items` có nhiều phần tử, **When** lọc `items[*].sku` kiểu Text bằng "A", **Then** item có ít nhất một
   phần tử với `sku` = "A" khớp.
5. **Given** cùng bộ lọc, **When** gọi `/items/<collection>?export=csv` hoặc `/utils/export/<collection>`, **Then** file
   chỉ chứa các item khớp.
6. **Given** request không dùng path json, **When** gọi bất kỳ endpoint nào, **Then** kết quả giống hệt Directus 11.17.4
   (bộ đối chiếu hiện có không đổi).

---

### User Story 2 - Người dùng lọc theo path json trên trang Content (Priority: P1)

Trên `/content/<collection>`, người dùng mở bộ lọc, chọn field json "Transaction Data", chọn mục "JSON path", gõ path
`Amount`, chọn kiểu Number, chọn toán tử Equals và nhập 6000. Danh sách chỉ còn các item khớp. Người dùng lưu thành
bookmark và mở lại sau vẫn đúng.

**Why this priority**: lý do người dùng hỏi tính năng này (ảnh chụp filter "functions.json (Transaction Data) Contains 1"
bị lỗi).

**Independent Test**: trên collection mẫu có field json, làm luồng trên bằng chuột và bằng bàn phím ở ba cấu hình E2E;
lưu bookmark, tải lại trang, mở bookmark.

**Acceptance Scenarios**:

1. **Given** collection có field json, **When** người dùng mở danh sách field của bộ lọc, **Then** dưới field json có mục
   "JSON path" (vi-VN "Đường dẫn JSON"), không còn nhãn thô `functions.json`.
2. **Given** người dùng chọn "JSON path", **When** gõ path và chọn kiểu, **Then** dòng điều kiện hiện tên field, path và
   kiểu, và chỉ cho chọn toán tử của kiểu đó (Text như field chuỗi, Number như field số, Boolean như field boolean).
3. **Given** path sai cú pháp (ví dụ `items[`), **When** người dùng xác nhận, **Then** ô path báo lỗi tại chỗ, không gửi
   request.
4. **Given** điều kiện đã thêm, **When** người dùng lưu bookmark rồi mở lại, **Then** điều kiện (field, path, kiểu, toán tử,
   giá trị) còn nguyên và danh sách lọc đúng.
5. **Given** field json qua quan hệ m2o (ví dụ `order` → `transaction_data`), **When** người dùng chọn path json của field
   đó, **Then** danh sách lọc theo item liên quan.
6. **Given** người dùng chỉ dùng bàn phím, **When** thêm điều kiện path json, **Then** mọi bước (chọn field, gõ path, chọn
   kiểu, toán tử, giá trị) làm được và có nhãn đọc được cho screen reader.

---

### User Story 3 - Lọc theo path json trong drawer chọn item (Priority: P2)

Khi chọn item liên quan (interface m2o, o2m, m2m mở DrawerCollection), người dùng dùng bộ lọc của drawer để lọc theo path
json giống trang Content.

**Why this priority**: chủ dự án chọn thêm phạm vi này 2026-10-27; dùng lại UI của US2.

**Independent Test**: mở drawer chọn item của một collection có field json, lọc theo path, chọn item.

**Acceptance Scenarios**:

1. **Given** drawer chọn item của collection có field json, **When** người dùng thêm điều kiện path json, **Then** danh sách
   trong drawer lọc đúng và chọn item như bình thường.

---

### User Story 4 - Lọc theo path json qua GraphQL (Priority: P2)

Client GraphQL gọi `/graphql` với điều kiện tương đương (field json, path, kiểu, toán tử, giá trị) và nhận cùng kết quả như
REST.

**Why this priority**: chủ dự án chọn thêm phạm vi này 2026-10-27; Nguyên tắc III giữ REST và GraphQL tương đương.

**Independent Test**: cùng dữ liệu của US1, so kết quả query GraphQL với REST.

**Acceptance Scenarios**:

1. **Given** dữ liệu của US1, **When** query GraphQL lọc `Amount` kiểu Number bằng 6000, **Then** trả cùng các item như
   REST.
2. **Given** user không dùng tính năng, **When** so introspection và SDL của Backoffice với Directus, **Then** chỉ khác ở
   các field `*_json` của input `<collection>_filter` và type `json_path_filter_operators` (D-186), bộ đối chiếu bỏ đúng
   hai thứ đó rồi so phần còn lại nguyên văn.

---

### User Story 5 - Quyền, vendor không hỗ trợ và chỗ không cho dùng (Priority: P1)

Lọc theo path json tuân theo quyền như filter thường; vendor DB không hỗ trợ báo lỗi rõ; filter của permission không chấp
nhận path json.

**Why this priority**: an toàn dữ liệu và chạy song song với Directus (Nguyên tắc III, IV).

**Independent Test**: user không có quyền đọc field json gửi bộ lọc path; chạy trên MySQL; lưu permission có path json.

**Acceptance Scenarios**:

1. **Given** user không có quyền đọc `transaction_data`, **When** lọc theo path của field đó, **Then** nhận cùng lỗi như khi
   lọc trực tiếp trên field không có quyền.
2. **Given** permission của user có điều kiện hàng (row filter), **When** user lọc theo path json, **Then** chỉ thấy item
   vừa khớp path vừa thuộc quyền.
3. **Given** DB là MySQL/MariaDB, MSSQL, Oracle, CockroachDB hoặc Redshift, **When** gửi bộ lọc path json, **Then** nhận 400 với
   thông báo nêu rõ vendor không hỗ trợ lọc theo path json.
4. **Given** admin tạo hoặc sửa permission (`/permissions` REST hoặc GraphQL) với điều kiện hàng hoặc validation chứa path
   json, **When** lưu, **Then** nhận 400 với thông báo rõ, permission không đổi.
5. **Given** path chứa ký tự lạ (dấu nháy, `;`, `--`), **When** lọc, **Then** giá trị path chỉ được dùng làm dữ liệu, không
   thành câu lệnh; kết quả là không khớp hoặc 400 nếu sai cú pháp.

---

### Edge Cases

- Field không phải kiểu json với key path json: 400 như hiện nay (`Invalid filter key`).
- Path trỏ tới object hoặc mảng (không phải giá trị đơn) với kiểu Text/Number/Boolean: không khớp.
- Number chỉ khớp số JSON; chuỗi số `"6000"` không khớp Number (khớp Text "6000"). Boolean chỉ khớp `true`/`false` JSON.
- Toán tử `_null` trên path: khớp khi field null, path không có, giá trị JSON `null`, hoặc giá trị khác kiểu đã chọn
  (FR-004); `_nnull` ngược lại (sửa khi analyze 2026-10-27).
- `[*]` với mọi toán tử, kể cả phủ định và `_null`, nghĩa là "có ít nhất một phần tử thỏa toán tử" (như cách Directus lọc
  qua quan hệ nhiều dòng mặc định là `_some`); mảng rỗng hoặc không phải mảng thì không khớp. "Không phần tử nào là A"
  không diễn tả được trong phạm vi này.
- Nhiều `[*]` trong một path (ví dụ `a[*].b[*].c`): 400, chỉ hỗ trợ một `[*]`.
- Key json có dấu chấm hoặc ký tự đặc biệt trong tên (ví dụ `"a.b"`): theo cú pháp path hiện có của `json(field, path)`
  cho `fields`; không thêm cú pháp mới; tên khóa chứa `)` không hỗ trợ (400, như `json()` hiện có; sửa khi checklist
  2026-10-27).
- Permission đã có sẵn chứa path json (ghi tay ở Directus, D-185 không chặn được): ở Directus request của role đó lỗi
  403; ở Backoffice điều kiện hàng chạy như lọc theo path thường (cùng bộ lọc), cho tới khi sửa hoặc xóa permission đó
  (sửa khi checklist 2026-10-27; sửa theo T002 2026-10-27).
- Cột `jsonb` tạo tay và cột `json` do app tạo đều là field kiểu json, đều phải lọc được.
- Bookmark có path json mở trên Directus app: Directus trả 403 `FORBIDDEN` (D-184.1, chấp nhận; đo ở T002).
- Ở chế độ shared-domain (lb có cả Directus), request có path json rơi vào Directus nhận 403 (D-184, chấp nhận, không
  thêm định tuyến). (026: chế độ shared-domain đã bỏ; ở domain Backoffice mọi request tới BE; gọi thẳng domain Directus vẫn 403.)
- Settings > Presets mở một bookmark có path json: điều kiện hiện đọc được (field, path, kiểu); không có mục thêm path json
  mới ở màn này.
- Validation của field, filter của panel Insights: không có mục "JSON path" (FR-015); flow không có danh sách field của
  bộ lọc (condition là ô code), nên không áp dụng; API không chặn khi lưu (FR-011). Key path json ghi tay qua API ở flow condition hay validation của field chạy
  như Directus: condition đi nhánh reject, validation báo lỗi field, vì key không có trong dữ liệu.
- Hàm `count` của field json (độ dài mảng) giữ nguyên như hiện nay.
- `sort=json(field, path[, type])` và `fields=json(field, path, type)` (D-184.2, sửa khi checklist 2026-10-27): ở Directus,
  `sort=json(f, p)` không chạy hết đường request (kiểm quyền path đọc tên field là `"f, p"` → 403 `FORBIDDEN`, đo ở
  T002) và `fields=json(f, p, type)` đọc path `"p, type"` → giá trị null; ở Backoffice, sort chạy
  (giá trị có kiểu khi có `type`, sort số đúng thứ tự) và `fields` ba tham số trả giá trị có kiểu, chuẩn hóa về JSON
  (boolean → `true`/`false`, number → số) giống nhau trên Postgres và SQLite. `[*]` vẫn bị từ chối ở `fields`/`sort`;
  aggregate và groupBy theo path ngoài phạm vi.
- Giá trị Text `true`, `false`, `null` gửi qua query string bị đổi kiểu như với field chuỗi hiện nay (`parseFilter`);
  muốn lọc chuỗi `"true"` thì gửi `filter` JSON với chuỗi (sửa khi plan 2026-10-27).
- Response cache dùng chung với Directus (feature 005, cùng key cho cùng request và user): request có path json có key
  riêng, không đụng cache của request khác. Hệ quả khi bật cache [Inference từ code của 005; thấy khi implement lượt 1]:
  response 200 của Backoffice cho một request có path json (filter, sort, `fields` có type) có thể được Directus trả lại
  từ cache cho cùng request và user, và response 200 của Directus cho `fields=json(f, p, type)` (giá trị null) có thể
  được Backoffice trả lại; response lỗi (403 của Directus) không vào cache. Không đổi khác biệt D-184, D-184.2 (sửa khi
  implement lượt 1 2026-10-27).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: API PHẢI nhận trong `filter` một điều kiện trên field kiểu json gồm: field, path, kiểu giá trị (Text, Number,
  Boolean), toán tử và giá trị. Field, path và kiểu PHẢI nằm trong query (để bookmark, URL, SDK giữ được). Key là hàm
  `json(field, path, type)` với `type` ∈ `text`, `number`, `boolean`, mở rộng `json(field, path)` đang có cho `fields` và
  `sort`; thiếu `type` thì là `text`. Ví dụ `filter={"json(transaction_data, Amount, number)":{"_eq":6000}}`. `type`
  lạ: 400. Path có `[` `]` phải gửi `filter` dạng JSON (query string `?filter={...}` hoặc body), vì dạng ngoặc
  `filter[key][op]=` của query string cắt ngoặc vuông trong tên key; app web và SDK gửi JSON (sửa khi plan 2026-10-27).
- **FR-002**: Path PHẢI dùng cùng cú pháp với `json(field, path)` của `fields` (`Amount`, `a.b`, `items[0].sku`), thêm
  `[*]` (một lần trong path) nghĩa là có ít nhất một phần tử của mảng thỏa toán tử, với mọi toán tử kể cả phủ định
  (`items[*].sku _neq "A"` khớp khi có phần tử sku ≠ A) và `_null` (khớp khi có phần tử thiếu path, null hoặc khác kiểu đã chọn; sửa khi analyze 2026-10-27); mảng rỗng
  hoặc không phải mảng thì không khớp với mọi toán tử. Độ sâu path tối đa `MAX_JSON_QUERY_DEPTH` (mặc định 10, `[*]`
  tính 1) như `json()` hiện có (sửa khi checklist 2026-10-27).
- **FR-003**: Toán tử theo kiểu: Text dùng các toán tử của field chuỗi, Number dùng các toán tử của field số, Boolean dùng
  các toán tử của field boolean (theo bảng toán tử của Directus cho từng kiểu). Toán tử không thuộc kiểu: 400. Key
  field json **không có** hàm vẫn chỉ có `_null`/`_nnull` như Directus (sửa khi checklist 2026-10-27).
- **FR-004**: Kiểu đã chọn là kiểu của giá trị JSON, so khớp nghiêm: Number chỉ khớp số JSON (chuỗi `"6000"` không khớp
  Number, chỉ khớp Text `"6000"`), Boolean chỉ khớp `true`/`false` JSON, Text chỉ khớp chuỗi JSON. Dòng không có path,
  có giá trị JSON khác kiểu đã chọn, hoặc field null PHẢI là không khớp (trừ `_null`), và KHÔNG ĐƯỢC làm lỗi cả request.
  "Giá trị có kiểu" của một dòng là giá trị tại path khi đúng kiểu, còn lại là không có; `_null` khớp đúng khi không có
  (field null, path không có, JSON `null`, hoặc khác kiểu), `_nnull` khớp phần còn lại; `_empty`/`_nempty` của Text như
  field chuỗi (không có hoặc chuỗi rỗng) (sửa khi plan 2026-10-27).
- **FR-005**: Lọc theo path PHẢI dùng được ở mọi chỗ dùng chung query của items: `GET /items`, `SEARCH /items`, export
  (`?export=`, `/utils/export`), `meta.filter_count`, và lồng trong `_and`, `_or`.
- **FR-006**: Lọc theo path PHẢI dùng được trên field json của collection hiện tại và qua quan hệ m2o. Qua o2m, m2m, m2a:
  ngoài phạm vi (không bảo đảm, không test).
- **FR-007**: `/graphql` PHẢI có điều kiện lọc tương đương FR-001..FR-004 cho field json, cùng kết quả với REST: trong
  input `<collection>_filter`, mỗi field json có thêm field `<field>_json` kiểu input dùng chung
  `json_path_filter_operators { path: String!, text: string_filter_operators, number: number_filter_operators, boolean:
  boolean_filter_operators }` (đúng một trong `text`, `number`, `boolean`; thiếu hoặc thừa: lỗi GraphQL), ánh xạ về
  `json(field, path, type)` như Directus ánh xạ `<field>_func`. Ví dụ
  `filter: { transaction_data_json: { path: "Amount", number: { _eq: 6000 } } }`. `<field>_func` (`count`) giữ nguyên;
  `/graphql/system` không đổi.
- **FR-008**: Vendor: Postgres (cột `json` và `jsonb`) và SQLite PHẢI hỗ trợ. MySQL/MariaDB, MSSQL, Oracle, CockroachDB,
  Redshift (hai vendor sau dùng chung helper Postgres, phân biệt theo client; sửa khi checklist 2026-10-27) PHẢI trả 400
  với thông báo nêu rõ lọc theo path json không hỗ trợ trên vendor đó.
- **FR-009**: Quyền PHẢI như filter thường trên field gốc (field json của collection đích, sau quan hệ m2o nếu có; sửa
  khi checklist 2026-10-27): thiếu quyền đọc field json thì cùng lỗi như lọc field đó trực tiếp; điều kiện hàng của
  permission vẫn áp dụng.
- **FR-010**: Field, path và giá trị PHẢI chỉ được truyền vào DB dưới dạng tham số (binding), không ghép vào câu lệnh;
  `type`, toán tử và `[*]` chỉ chọn dạng câu lệnh từ danh sách cố định (sửa khi checklist 2026-10-27). Path sai cú pháp:
  400 với thông báo nêu path.
- **FR-011**: API PHẢI trả 400 khi tạo hoặc sửa permission (REST và GraphQL của `directus_permissions`) có `permissions`
  (điều kiện hàng) hoặc `validation` chứa điều kiện path json. Chỉ permission: `/fields` (validation của field),
  `/flows`, `/operations` (filter của trigger, condition) KHÔNG kiểm key path json khi lưu, như Directus; hai chỗ này chạy
  bộ lọc trong JS trên dữ liệu (không thành SQL), key path json chỉ là key không có trong dữ liệu ở cả hai app.
- **FR-012**: Request không dùng điều kiện path json PHẢI giống hệt Directus 11.17.4 (status, body, header); bộ đối chiếu
  và blackbox hiện có không đổi.
- **FR-013**: Trang Content (`/content/<collection>`: bộ lọc ở page header, bookmark, preset) và DrawerCollection PHẢI cho
  thêm điều kiện path json: dưới mỗi field json có mục "JSON path" (en-US) / "Đường dẫn JSON" (vi-VN); chọn mục này thì
  nhập path, chọn kiểu (Text, Number, Boolean), rồi chọn toán tử và giá trị như các điều kiện khác. Bộ lọc riêng của mục
  Export trong detail panel của trang Content không có mục này (giữ hàng đã lưu) (sửa khi plan 2026-10-27).
- **FR-014**: Dòng điều kiện path json PHẢI hiện field, path và kiểu; sửa được path và kiểu sau khi thêm; path sai cú pháp
  báo lỗi tại chỗ.
- **FR-015**: Mọi chỗ khác dùng danh sách field của bộ lọc (permission/policy, validation và điều kiện của field,
  Insights, Settings > Presets khi thêm điều kiện mới, module Files, Users, Activity, bộ lọc của mục Export; flow không
  có danh sách này, sửa khi analyze 2026-10-27) KHÔNG ĐƯỢC hiện mục "JSON path" (hết nhãn thô
  `functions.json` gây lỗi 400); mục `count` của field json giữ nguyên.
- **FR-016**: Bookmark/preset lưu điều kiện path json vào `directus_presets` như mọi điều kiện khác (không thêm cột hay
  bảng); mở lại ở Backoffice cho cùng kết quả.
- **FR-017**: UI PHẢI theo design-system (Nguyên tắc XII): nhãn liên kết với ô nhập, dùng được bằng bàn phím, trạng thái
  lỗi, focus-visible. Form path + kiểu (bước 2 trong popover bộ lọc) chưa có mẫu riêng trong design-system: chủ dự án
  (design owner) quyết định 2026-10-27 ghép từ recipe Q-7 (popover bộ lọc), Input và Select của
  `design-system/docs/component-specs.md`, ghi thêm gạch đầu dòng "JSON path form" vào Q-7 (sửa khi analyze 2026-10-27).
- **FR-018**: Test: unit API cho Postgres (cột json, jsonb) và SQLite (mọi kiểu, toán tử, `[*]`, path lồng, thiếu path,
  khác kiểu, m2o, quyền, permission bị từ chối, vendor không hỗ trợ); bộ đối chiếu ở proxy-api ghi khác biệt D-184..D-187
  và chứng minh FR-012; E2E Content và drawer ở ba cấu hình (proxy tới Directus, proxy tới API mới, cross-site), gồm bước
  bàn phím (ở proxy tới Directus, Apply cho lỗi API D-184.1: layout hiện lỗi `FORBIDDEN` và nút "Reset Page Preferences" như DR app; sửa khi plan 2026-10-27, câu chữ sửa khi implement lượt 2); GraphQL so với
  REST; benchmark lọc theo path trên seed 10 triệu dòng.

### Key Entities

- **Điều kiện lọc theo path json**: field json gốc (có thể qua m2o), path, kiểu giá trị (Text, Number, Boolean), toán tử,
  giá trị. Nằm trong `filter` của query dưới key `json(field, path, type)`, lưu được trong bookmark/preset.
- **Bookmark/preset** (`directus_presets`, dùng chung với Directus): cột `filter` chứa điều kiện như mọi điều kiện khác;
  không đổi cấu trúc.
- **Field json** (`directus_fields` kiểu json; cột `json` hoặc `jsonb` trên Postgres, text trên SQLite): không đổi.

### Đánh giá hiện trạng và chạy song song với Directus 11.17.4

Đọc code ngày 2026-10-27; SQL thử bằng test tạm với Knex `pg` (không kết nối DB). Mục ghi [Inference] là suy ra từ code,
plan PHẢI có test xác nhận.

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Field json tạo trên Postgres | Cột `json` (không phải `jsonb`); cột `jsonb` tạo tay vẫn đọc là field `json` | `apps/api/src/services/fields.service.ts:955`, `apps/api/src/schema/get-local-type.ts:72-73` |
| 2 | Toán tử filter của field json | Chỉ `null`, `nnull` | `getFilterOperatorsForType` (`@directus/utils`, `libs/utils`) |
| 3 | Key `json(metadata, color)` trong filter | Cả request: 403 `FORBIDDEN` ở bước kiểm quyền path (tên field đọc ra là `"metadata, color"`), kể cả admin; riêng `applyFilter`: 400 `Invalid filter key`; file giống hệt Directus (đo ở T002 trên Directus 11.17.4) | `apps/api/src/utils/parse-filter-key.ts:9` |
| 4 | Sort và `fields` với `json()` | `fields=json(f, p)`: chạy (blackbox `json-fields`); `sort=json(f, p)`: `applySort` sinh `order by "products"."metadata"::json->$1 desc`, nhưng cả đường request trả 403 `FORBIDDEN` ở kiểm quyền path (`parseFilterKey` đọc tên field `"f, p"`; D-184.2; đo ở T002) (sửa khi analyze 2026-10-27) | `apps/api/src/database/helpers/fn/dialects/postgres.ts:82-85`, `apps/api/src/permissions/modules/process-ast/utils/extract-paths-from-query.ts:34` |
| 5 | Mục `functions.json` ở UI | Hiện vì `getFunctionsForType('json')` = `['count', 'json']`, gửi `json(field)` không path → 400 `requires json(field, path) format`; Directus app giống vậy; en-US của Directus thiếu nhãn | `apps/web/src/components/FieldList.vue:177`, `:280`; `apps/api/src/database/helpers/fn/json/parse-function.ts:48`; `directus/app/src/components/v-field-list/VFieldListItem.vue:45` |
| 6 | Tách key trong filter | `key.split('.')` hỏng với path có dấu chấm | `apps/api/src/database/run-ast/lib/apply-query/filter/operator.ts:35` |
| 7 | So sánh trên kiểu `json` của Postgres | Không có toán tử `=`; cần lấy giá trị dạng text rồi ép kiểu an toàn [Inference] | — |
| 8 | Hàm `json()` theo vendor | Có cho postgres (kể cả cockroachdb, redshift), mysql, sqlite, mssql, oracle | `apps/api/src/database/helpers/fn/dialects/*.ts`, `fn/index.ts:2-8` |
| 9 | Directus khi lưu permission | Không kiểm key của filter khi lưu [Inference] | `directus/api/src/services/permissions.ts` |
| 9.1 | Flow condition, validation của field | Chạy `validatePayload` (joi, trong JS) trên dữ liệu, không thành SQL; key lạ = không khớp | `directus/api/src/operations/condition/index.ts:20`, `directus/api/src/permissions/modules/process-payload/process-payload.ts:118` |
| 10 | Lb chế độ shared-domain | `api_pool` có `directus:8055` và `backoffice-api`; Helm Service `-api` chọn pod theo label pool dùng chung; separate-domain chỉ Backoffice | `deploy/compose/lb/shared-domain.conf:10-13`, `deploy/helm/backoffice/templates/ingress.yaml` (026: bỏ; pool chỉ replica BE) |
| 11 | Dữ liệu và schema | Không thêm bảng, cột, migration; `directus_presets.filter` là JSON tự do | — |

**Kết luận** [Inference]: Directus không phải làm gì; DB, Redis, file không đổi. Directus chỉ thấy bookmark có điều kiện
nó không hiểu (400 khi mở) và nhận 400 cho request có path json nếu lb gửi tới nó. (026: lb không còn gửi tới Directus.)

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021, 022).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-184 | Lọc theo path trong field json (`/items`, export, `SEARCH`) | 403 `FORBIDDEN` (tên field `"field, path, type"` không tồn tại; T002) | Lọc theo field, path, kiểu trên Postgres và SQLite; vendor khác 400 với thông báo riêng. Ở shared-domain, request rơi vào Directus vẫn nhận 403 (không thêm định tuyến ở lb) | Yêu cầu chủ dự án 2026-10-27 | khác (duyệt 2026-10-27) | — (026: câu "Ở shared-domain" không còn áp dụng; gọi thẳng domain Directus vẫn 403) |
| D-184.2 | `sort=json(field, path[, type])`, `fields=json(field, path, type)` | `sort`: 403 `FORBIDDEN` (kiểm quyền path); `fields` ba tham số: 200, giá trị null (T002) | `sort` chạy (có kiểu khi có `type`); `fields` ba tham số trả giá trị có kiểu, chuẩn hóa JSON | Hệ quả của D-184 (cùng parser `json(...)`); checklist 2026-10-27 CHK002, CHK026 | khác (duyệt 2026-10-27) | — |
| D-184.1 | Bookmark/preset có path json mở ở Directus app | Không tạo được | Lưu vào `directus_presets` dùng chung; Directus app mở bookmark đó nhận 403 | Chủ dự án 2026-10-27: chấp nhận | khác (duyệt 2026-10-27) | — |
| D-185 | Permission có filter chứa path json | Lưu được (200, T002); request của role đó lỗi 403 | 400 khi lưu; chỉ permission, không kiểm `/fields`, `/flows`, `/operations` | Tránh làm hỏng mọi request của role ở cả hai app; clarify 2026-10-27 câu 5 | khác (duyệt 2026-10-27) | — |
| D-186 | GraphQL | Input `<collection>_filter` của field json chỉ có `<field>_func` (`count`) | Thêm `<field>_json: json_path_filter_operators` (path, text/number/boolean) ánh xạ về `json(field, path, type)`; introspection và SDL khác ở các field `*_json` và type `json_path_filter_operators` (kể cả collection hệ thống có field json chạm tới từ scope items qua quan hệ), bộ đối chiếu bỏ hai thứ đó và bỏ so ETag của introspection/SDL | Chủ dự án 2026-10-27: thêm GraphQL; clarify 2026-10-27 chọn input có kiểu | khác (duyệt 2026-10-27) | — |
| D-187 | Mục hàm `json` trong danh sách field của bộ lọc | Hiện ở mọi chỗ với nhãn thô `functions.json`, gửi `json(field)` → 400 | Chỉ ở Content và drawer chọn item, nhãn "JSON path"/"Đường dẫn JSON", nhập path và kiểu; chỗ khác ẩn | Chủ dự án 2026-10-27: chỉ dùng ở filter của Content (và drawer) | khác (duyệt 2026-10-27) | — |

**Cần xác nhận**:

- Câu hỏi mở theo Nguyên tắc XII (design-system chưa có mẫu cho form path + kiểu trong popover bộ lọc): đã chốt
  2026-10-27, chủ dự án (design owner) chọn ghép từ recipe Q-7, Input, Select (FR-017).
- D-185 (đề xuất của Claude 2026-10-27, nằm trong lệnh specify chủ dự án đã chạy) được giữ ở phạm vi permission
  tại `/speckit.clarify` câu 5; câu chữ cuối duyệt sau plan cùng D-184..D-187.

## Clarifications

### Session 2026-10-27 (chủ dự án, trước `/speckit.specify`)

- Q: Giữ field json hay đổi sang jsonb/cột riêng? → A: giữ field json, schema và dữ liệu không đổi, chạy song song với
  Directus.
- Q: Vendor nào? → A: Postgres và SQLite; vendor khác trả 400 (FR-008).
- Q: Kiểu giá trị tại path xác định thế nào? → A: người dùng chọn trong UI: Text, Number, Boolean (FR-001, FR-003).
- Q: Nhập path thế nào? → A: gõ tay, cùng cú pháp `json(field, path)` (FR-002, FR-013).
- Q: Phạm vi thêm? → A: field json qua m2o, phần tử bất kỳ của mảng `[*]`, GraphQL, drawer chọn item (FR-002, FR-006,
  FR-007, US3).
- Q: Bookmark có path json mở ở Directus app bị 400? → A: chấp nhận (D-184.1).
- Q: Dùng ở đâu? → A: chỉ filter của Content (và drawer chọn item) (FR-013, FR-015, D-187).
- Q: Request có path json: Directus 400, Backoffice 200? → A: đồng ý ghi khác biệt (D-184).
- Q: Ở shared-domain, lb có thể gửi request tới Directus (400). Thêm định tuyến? → A: không; "nếu API có hỗ trợ là được
  rồi" (D-184). (026: không còn.)

### Session 2026-10-27 (chủ dự án, `/speckit.clarify`)

- Q: Cú pháp key trong `filter` mang kiểu giá trị: A `json(field, path, type)`, B ba hàm `json_text/number/boolean`, C
  kiểu ở tầng toán tử? → A: A, `json(field, path, type)`, thiếu `type` là `text` (FR-001).
- Q: `[*]` với `_neq`, `_nin`, `_null`: A một phần tử thỏa toán tử (như `_some`), B phủ định = không phần tử nào (như
  `_none`), C cấm phủ định với `[*]`? → A: A, một nghĩa cho mọi toán tử; mảng rỗng không khớp (FR-002).
- Q: Number có khớp chuỗi số `"6000"` không: A nghiêm (chỉ số JSON), B lỏng (cả chuỗi dạng số)? → A: A, nghiêm; Boolean
  cũng chỉ `true`/`false` JSON (FR-004).
- Q: GraphQL nhận điều kiện path json theo hình dạng nào: A field `<field>_json` với input dùng chung
  `json_path_filter_operators`, B lồng vào `<field>_func`, C scalar `JSON`? → A: A; parity bỏ `*_json` và type đó
  (FR-007, D-186).
- Q: API có từ chối path json trong flow condition và validation của field không: A không (chỉ UI ẩn, như Directus), B
  chặn khi lưu `/fields`, `/flows`, `/operations`? → A: A; D-185 chỉ áp dụng cho permission (FR-011, FR-015).
- Text và hoa thường: không hỏi, đã rõ: Text dùng đúng bộ toán tử của field chuỗi (`_eq` phân biệt, `_ieq`, `_icontains`
  không), kể cả đặc thù theo vendor như field chuỗi hiện nay (Assumptions).

### Duyệt 2026-10-27 (chủ dự án kiêm tech lead)

- D-184, D-184.1, D-185, D-186, D-187: duyệt sau `/speckit.plan`, gồm các câu chữ sửa khi plan ở dưới. D-184.2: duyệt
  sau `/speckit.checklist` api-compat (cùng ngày).

### Kết quả T001, T002 khi implement lượt 1 (2026-10-27)

- T002 trên Directus 11.17.4 (env parity Postgres): filter `json(...)` (2 hoặc 3 tham số) và `sort=json(...)` trả **403
  `FORBIDDEN`** (không phải 400 như ghi trước đó): bước kiểm quyền path đọc `"field, path[, type]"` là tên field, kể cả
  admin; `fields=json(f, p, number)` 200 giá trị null; `json(f)` 400 `INVALID_QUERY`; `POST /permissions` có path json
  200. Đã sửa D-184, D-184.1, D-184.2, D-185, Edge Cases, bảng Đánh giá hiện trạng #3; khác biệt không đổi về bản chất.

### Sửa khi `/speckit.analyze` (2026-10-27)

- C1 (Nguyên tắc XII): chủ dự án (design owner) quyết định form path + kiểu ghép từ recipe Q-7, Input, Select (FR-017,
  Cần xác nhận). H1: SC-005 tách theo cấu hình E2E. I1: dòng #4 của Đánh giá hiện trạng theo D-184.2. I2: `_null` gồm
  giá trị khác kiểu (Edge Cases, FR-002). A1: SC-006 so với Directus. G1: SC-002 nêu cách kiểm vendor khác. L1: US5-3
  thêm Redshift. L3: FR-015, Edge Cases bỏ flow (không có danh sách field).

### Sửa khi `/speckit.checklist` api-compat (2026-10-27, checklists/api-compat.md)

- D-184.2 (`sort`/`fields` với `json(...)`), FR-002 (độ sâu), FR-003 (key json không hàm), FR-008 (Redshift), FR-009
  (m2o), FR-010 (type, toán tử, `[*]` từ danh sách cố định), Edge Cases (`)` trong tên khóa, permission có sẵn chứa path
  json), Assumptions (phiên bản Postgres, SQLite); research R1: `convert-wildcards` giữ hành vi Directus.

### Sửa câu chữ khi `/speckit.plan` (2026-10-27, research.md R16)

- FR-001: path có `[` `]` gửi `filter` dạng JSON (`qs` cắt ngoặc vuông trong tên key). FR-004: định nghĩa "giá trị có
  kiểu", `_null`/`_nnull`/`_empty`. FR-013: bộ lọc của mục Export không có mục "JSON path". FR-018: E2E ở proxy tới
  Directus mong lỗi D-184.1. Edge Cases: `fields`/`sort` với `type`, giá trị Text `true`/`false`/`null`. D-186: collection
  hệ thống chạm tới từ scope items, bỏ so ETag.

### Sửa khi implement (2026-10-27)

- Lượt 2: kiểu ở form là Select (`BoSelect`) theo C1; SC-005 và mục Testing: ở `proxy-directus` layout hiện lỗi
  `FORBIDDEN` và nút "Reset Page Preferences" như DR app (trước ghi "bảng giữ nguyên").
- Lượt 3: input `<field>_json` thiếu hoặc thừa kiểu (`text`, `number`, `boolean`) trả `INVALID_QUERY`; filter của
  mutation chỉ lọc item trả về, mutation update vẫn cần `ids` như DR.

## Assumptions

- Dữ liệu lưu số dưới dạng chuỗi (`"Amount": "6000"`) thì người dùng chọn Text, hoặc sửa dữ liệu; API không tự ép kiểu
  (FR-004).
- Text so sánh như field chuỗi: `_eq` phân biệt hoa thường, `_ieq`, `_icontains` không phân biệt.
- Postgres từ 10 (profile parity `postgres10`; không dùng jsonpath của PG 12), SQLite có JSON1 (`json_type`, `json_each`,
  `json_valid`; bản bundled của package `sqlite3` là 3.44) (sửa khi checklist 2026-10-27).
- Lọc theo path không dùng được index thường; admin tự tạo index nếu cần (ngoài phạm vi), ghi cách làm trong quickstart.
- Người dùng gọi qua lb shared-domain có thể nhận 403 từ Directus; muốn chắc chắn thì gọi qua domain riêng của Backoffice
  (chế độ separate-domain) hoặc qua Backoffice trực tiếp. (026: ở domain Backoffice luôn tới BE.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Người dùng thêm được điều kiện "Transaction Data › Amount (Number) = 6000" trên trang Content trong dưới 1
  phút và thấy đúng các item khớp.
- **SC-002**: 100% kịch bản của US1 và US5 đúng trên Postgres (cột json, cột jsonb) và SQLite; vendor còn lại trả 400 có
  thông báo: bắt buộc bằng unit test theo client (T006) và parity MySQL của bộ `reduced` ở CI mỗi PR; MariaDB, MSSQL,
  Oracle, CockroachDB qua nightly là bổ sung (sửa khi analyze 2026-10-27).
- **SC-003**: 0 test đối chiếu, blackbox và E2E hiện có bị đổi kết quả (request không dùng tính năng giống Directus).
- **SC-004**: REST và GraphQL trả cùng tập item cho 100% điều kiện mẫu của US4.
- **SC-005**: Trên 100% lượt E2E ở `proxy-api` và `cors`, luồng US2 làm được bằng bàn phím và bookmark mở lại cho cùng
  kết quả; ở `proxy-directus` (API là Directus), Apply báo lỗi API: layout hiện `FORBIDDEN` và nút "Reset Page Preferences" như DR app
  (D-184.1) (sửa khi analyze 2026-10-27; câu chữ sửa khi implement lượt 2).
- **SC-006**: Scenario benchmark hiện có của Backoffice không tệ hơn Directus quá 10% (Nguyên tắc X; sửa khi analyze
  2026-10-27); thời gian trả trang đầu khi lọc theo path trên
  seed 10 triệu dòng được đo, có và không có index do admin tạo, và ghi vào research.
