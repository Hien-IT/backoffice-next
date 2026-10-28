# Feature Specification: Quyền Import, Export theo policy, bỏ Share khỏi giao diện

**Feature Branch**: `025-policy-import-export` (làm trên `main` như 012–024, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=025-policy-import-export`)
**Created**: 2026-10-28
**Status**: Implemented 2026-10-28, ba lượt trên `main` (`e5e60405`, `b26cf4eb`, `c3306b34`, sửa `624d6ef9`, `0413f03c`, `7bbe1b95`, `ba4620e2`), CI 40589749926 (job web, E2E, deploy xanh; parity multi chập chờn sửa ở `109b39e8`), benchmark-items 40580246665 và benchmark-web 40580286006 xanh
**Input**: User description: "Feature 025: quyền import và export theo policy, hai action mới cùng cấp create, read,
update, delete; Backoffice bỏ share khỏi giao diện. [...] Lưu trữ: bảng hệ thống mới backoffice_permissions tạo bằng
migration riêng của Backoffice [...] Khác biệt với Directus, chủ dự án đã chấp nhận ngày 2026-10-28, ghi từ D-189 [...]"
(bản đầy đủ: lệnh `/speckit.specify` của 025 trong `SPECKIT-GUIDE.md` mục 6)

**Điều kiện trước `/speckit.plan`** (Governance):

- Không sửa constitution. Nguyên tắc II (3.2.0) cho phép migration riêng của Backoffice tạo bảng tiền tố `backoffice_`.
  Nguyên tắc III (API) và VI (giao diện giữ luồng của Directus app) cho phép khác biệt khi đã ghi theo Nguyên tắc X (ghi
  trong spec, nêu lý do, tech lead duyệt), như 023, 024 và D-130.
- Spec này mở rộng 022 và 024: toggle `bo_show_import`, `bo_show_export` của collection vẫn chặn mọi người; quyền theo
  policy chỉ xét khi toggle bật.
- Khác biệt D-189..D-189.7: chủ dự án chấp nhận 2026-10-28 (trước `/speckit.specify`); chủ dự án kiêm tech lead duyệt
  2026-10-28 sau `/speckit.plan`, cùng các quyết định thiết kế R1–R10 của research.md.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin cấp quyền Import, Export cho policy (Priority: P1) 🎯 MVP

Admin mở một policy trong Settings > Access Policies. Ma trận quyền có 6 cột: create, read, update, delete, import,
export. Admin bật import hay export cho từng collection như các action khác (bấm ô để đổi giữa không có quyền và toàn
quyền, nút All access hay No access của hàng), lưu policy. Quyền được lưu riêng, Directus không đọc.

**Why this priority**: lý do của feature. Không có bước này thì không ai có import, export (không seed dữ liệu).

**Independent Test**: tạo policy mới, bật import cho collection `A`, export cho collection `B`, lưu, tải lại trang; đọc
lại quyền qua API ghi quyền.

**Acceptance Scenarios**:

1. **Given** policy P không có quyền import, export nào, **When** admin bật export cho `B` và lưu, **Then** tải lại trang
   thấy ô export của `B` là toàn quyền, các ô khác không đổi.
2. **Given** như trên, **When** admin bấm All access của hàng `A` và lưu, **Then** cả 6 ô của hàng `A` có quyền (trừ
   action bị khóa của collection hệ thống, như hiện nay).
3. **Given** hàng `A` có quyền import, export và có dòng `share` cũ (tạo từ Directus), **When** admin bấm No access của
   hàng và lưu, **Then** 6 ô mất quyền, dòng `share` trong `directus_permissions` vẫn còn.
4. **Given** P có quyền import, export, **When** admin nhân bản P, **Then** policy mới có cùng quyền import, export
   (kể cả cấu hình Use custom).
5. **Given** P có quyền import, export, **When** admin xóa P qua Backoffice, **Then** các dòng quyền import, export của
   P bị xóa.
6. **Given** ma trận đang hiện, **When** admin xem, **Then** không còn cột share; hàng `directus_shares` vẫn hiện.

---

### User Story 2 - API kiểm quyền Import, Export theo policy (Priority: P1)

Người dùng không phải admin chỉ import, export được trên collection mà ít nhất một policy của họ cho phép. Áp cho mọi
collection, kể cả collection hệ thống. Admin luôn được. Toggle `bo_show_import`, `bo_show_export` tắt thì chặn mọi
người như 024.

**Why this priority**: yêu cầu chính; quyền chỉ có ý nghĩa khi API thực thi.

**Independent Test**: user U có policy P cho export trên `B` nhưng không cho `A`; gọi các đường export, import trên `A`,
`B` và trên `directus_users`; so với admin.

**Acceptance Scenarios**:

1. **Given** U có read trên `A` nhưng không có export trên `A`, **When** U gọi `GET /items/A?export=csv` hoặc
   `POST /utils/export/A`, **Then** API trả 403 `FORBIDDEN`, không trả file, không tạo file.
2. **Given** U có export trên `B` (và read), **When** U gọi `GET /items/B?export=json`, **Then** API trả file như
   Directus 11.17.4.
3. **Given** U có create, update trên `A` nhưng không có import, **When** U gửi file tới `POST /utils/import/A`,
   **Then** API trả 403 `FORBIDDEN`, không ghi item nào.
4. **Given** U có import trên `A` nhưng không có update, **When** U gửi file, **Then** API từ chối như hiện nay (kiểm
   tra create, update của import giữ nguyên).
5. **Given** U có hai policy, chỉ P2 cho export trên `B`, **When** U export `B`, **Then** được phép.
6. **Given** admin, **When** admin export, import trên bất kỳ collection nào có toggle bật, **Then** được phép mà không
   cần dòng quyền nào.
7. **Given** toggle `bo_show_export` của `B` tắt và U có export trên `B`, **When** U hay admin export `B`, **Then** 403
   `FORBIDDEN` (024 chặn trước).
8. **Given** U không có export trên `directus_users`, **When** U gọi `GET /users?export=csv`, **Then** 403 `FORBIDDEN`.
9. **Given** admin vừa đổi quyền export của P, **When** U gửi request sau khi lưu xong, **Then** mọi replica Backoffice
   áp quyền mới.

---

### User Story 3 - Web chỉ hiện Import, Export khi có quyền (Priority: P1)

Phần import, export ở sidebar của Content, Users, Files, Presets, Translations và nút export, import dashboard của
Insights chỉ hiện khi người dùng có quyền theo policy và toggle của collection (022) bật.

**Why this priority**: hệ quả trực tiếp của US2; nếu không thì người dùng bấm vào và nhận lỗi.

**Independent Test**: đăng nhập bằng U của US2 ở ba cấu hình E2E; mở các module; kiểm phần import, export.

**Acceptance Scenarios**:

1. **Given** U có export trên `B` nhưng không có import, **When** U mở `B` trong Content, **Then** sidebar có phần export
   (kể cả link tải trang dạng CSV), không có phần import.
2. **Given** U không có export trên `directus_users`, **When** U mở module Users, **Then** không có phần export.
3. **Given** U không có export trên `directus_dashboards`, **When** U mở Insights, **Then** nút export dashboard không
   dùng được; import dashboard chỉ có với admin (import vào collection hệ thống chỉ admin, như Directus, FR-007).
4. **Given** U có export trên `B` và toggle `bo_show_export` của `B` tắt, **When** U mở `B`, **Then** không có phần
   export (022).
5. **Given** U có export với định dạng chỉ `csv`, `json`, **When** U mở hộp export, **Then** chỉ thấy hai định dạng đó.
6. **Given** web nói chuyện với Directus 11.17.4 (cấu hình proxy tới Directus), **When** U có read trên `B` mở `B`,
   **Then** có phần export như Directus; admin mở policy thấy ma trận 4 cột create, read, update, delete (FR-034).

---

### User Story 4 - Use custom cho Import, Export (Priority: P2)

Admin bấm ô import hay export và chọn Use custom để giới hạn: bộ lọc dòng, field, định dạng file.

**Why this priority**: owner yêu cầu ngay bản đầu; bật/tắt (US1) đã dùng được trước.

**Independent Test**: policy P export `B` với bộ lọc `status = published`, field `id`, `title`, định dạng `csv`; U export
`B` theo các cách khác nhau.

**Acceptance Scenarios**:

1. **Given** cấu hình trên, **When** U export `B` dạng `csv`, **Then** file chỉ có dòng thỏa cả bộ lọc export và bộ lọc
   read, chỉ có field được cả export và read cho.
2. **Given** như trên, **When** U export dạng `json`, **Then** 403 `FORBIDDEN`.
3. **Given** như trên, **When** U xin rõ field ngoài giới hạn (`fields=id,secret`), **Then** 403 `FORBIDDEN`; xin `*`
   hoặc không chỉ định thì file chỉ có `id`, `title` (FR-015).
4. **Given** P import `A` với bộ lọc `status = draft`, field `title`, `status`, định dạng `csv`, **When** U gửi file CSV có
   một dòng `status = published`, **Then** cả file bị từ chối với 403 `FORBIDDEN`, không ghi item nào (FR-016).
5. **Given** như trên, **When** U gửi file có cột `author`, **Then** cả file bị từ chối.
6. **Given** như trên, **When** U gửi file JSON, **Then** 403 `FORBIDDEN`.
7. **Given** ô import hay export có Use custom, **When** admin xem ma trận, **Then** ô hiện trạng thái một phần như ô
   create, read có bộ lọc.

---

### User Story 5 - Bỏ share khỏi giao diện Backoffice (Priority: P2)

Backoffice không còn chỗ tạo, xem link chia sẻ: không có mục Shares ở trang item, không có trang `/shared/:id`, ma trận
quyền không có cột share. API `/shares` và đăng nhập bằng share giữ như Directus.

**Why this priority**: yêu cầu owner đi cùng thay đổi ma trận; không chặn US1–US4.

**Independent Test**: mở trang item của một collection; mở `/admin/shared/<id>` của một share có thật; gọi API `/shares`.

**Acceptance Scenarios**:

1. **Given** người dùng có quyền share trên `A` (dòng tạo từ Directus), **When** mở trang item của `A`, **Then** không
   có mục Shares ở sidebar.
2. **Given** một link `/admin/shared/<id>` còn hiệu lực, **When** mở trong Backoffice web, **Then** rơi vào trang not
   found như mọi đường không tồn tại (người chưa đăng nhập được đưa tới trang đăng nhập như hiện nay).
3. **Given** như trên, **When** client gọi `POST /shares/auth` hay `GET /shares` qua API Backoffice, **Then** kết quả
   giống Directus 11.17.4.

---

### User Story 6 - Chạy song song với Directus và mở rộng về sau (Priority: P1)

Directus 11.17.4 chạy cùng DB không đổi hành vi. Bảng quyền mới mở rộng được: thêm action khác về sau không cần đổi
schema.

**Why this priority**: Nguyên tắc II, III, IV; yêu cầu owner "mở rộng được, không ảnh hưởng Directus".

**Independent Test**: bộ đối chiếu và blackbox hiện có; dump schema, `directus_*` của DB sau migration; Directus đọc
`/permissions/me` với user có quyền import, export; xóa policy, collection qua Directus.

**Acceptance Scenarios**:

1. **Given** DB đã chạy migration của 025, **When** Directus 11.17.4 khởi động, chạy `migrate`, `schema snapshot`,
   `schema apply`, **Then** không lỗi, không xóa bảng mới, không đổi `directus_*`.
2. **Given** U có quyền import, export, **When** U gọi `GET /permissions/me` tới Directus, **Then** Directus trả 200
   như trước (không có `import`, `export`).
3. **Given** policy P có quyền import, export, **When** admin xóa P qua Directus, **Then** dòng mồ côi còn trong bảng
   mới nhưng không cho ai quyền; Backoffice vẫn chạy.
4. **Given** collection `A` có quyền import, export, **When** admin xóa `A` qua Directus rồi tạo lại `A`, **Then**
   [Inference] quyền cũ áp lại cho `A` mới (giới hạn đã chấp nhận, Edge Cases).
5. **Given** mọi request không phải import, export, **When** gửi tới hai app, **Then** status, body, header giống nhau
   (trừ D-189..D-189.7).
6. **Given** cần thêm action mới về sau, **When** khai báo action đó trong danh sách action của code, **Then** không cần
   migration đổi bảng.

---

### Edge Cases

- Người không có quyền read trên `A`: export vẫn 403 `FORBIDDEN` như hiện nay; lỗi do thiếu quyền export dùng cùng mã và
  câu với lỗi quyền collection (như FR-006 của 024), không lộ việc `A` tồn tại hay không.
- Toggle tắt và không có quyền export cùng lúc: một lỗi 403 `FORBIDDEN`.
- Export qua quan hệ (`GET /items/B?export=csv&fields=a.*` với `a` trỏ tới `A` không có export): chỉ xét collection của
  route, như 024 (đọc `A` qua quan hệ đã do quyền read quyết định).
- Tham số `export` trên request ghi tới `/items/<collection>` (`POST`, `PATCH`): xét quyền export như 024 xét toggle
  (FR-004 của 024), từ chối trước khi ghi.
- Import upsert: dòng có khóa chính đã tồn tại cần update như hiện nay; quyền import không thay create, update.
- Import vào collection hệ thống (`directus_dashboards`, `directus_users`...): chỉ admin, như Directus; không kiểm quyền
  `import`, request và lỗi giống Directus (FR-007).
- `SEARCH` có `export` trong body query (`/items/A`, `/users`, `/files`...): kiểm quyền export như `?export=` (FR-006).
- Directus app ở cấu hình proxy tới API mới: người không phải admin nhận 403 khi import, export cho tới khi admin cấp
  quyền qua Backoffice (Directus app không có giao diện cấp; D-189.1, CHK003).
- Thay đổi quyền import, export ghi `directus_activity`, `directus_revisions` với `collection = 'backoffice_permissions'`
  (cùng định dạng Directus, Nguyên tắc II); Activity của Directus app hiện các dòng này, mở item thì gọi
  `/items/backoffice_permissions` (admin Directus 200, D-189.5) (CHK008).
- Policy có `admin_access`: người dùng là admin, luôn có import, export.
- Public và share: cùng quy tắc với mọi policy (FR-011). Public là policy Public; share dùng policy của role trong
  share như Directus [Inference: `apps/api/src/permissions/lib/fetch-policies.ts`].
- Policy, collection bị xóa qua Directus: dòng mồ côi bỏ qua khi đọc. Tạo lại collection cùng tên thì quyền cũ áp lại
  (giới hạn chấp nhận, không có khóa ngoại tới `directus_policies` hay `directus_collections`).
- Admin Directus mở `backoffice_permissions` (bảng chưa quản lý) trong Data Model của Directus: đọc, sửa, xóa được qua
  `/items/backoffice_permissions` của Directus; "configure" bảng thì bảng vào snapshot (giới hạn như `backoffice_migrations`,
  D-181).
- Response cache dùng chung (`CACHE_ENABLED=true`): khi chạy cùng Directus, Backoffice có thể trả `/permissions/me` mà
  Directus đã cache (không có `import`, `export`) và ngược lại (D-189.2, chấp nhận). Mỗi lần ghi quyền import, export
  qua `/backoffice/permissions` xóa response cache như ghi `directus_permissions`: `clearCaches` giống
  `PermissionsService` của Directus, không xét `CACHE_AUTO_PURGE`, chỉ bỏ qua khi lời gọi truyền `autoPurgeCache: false`;
  nên bản `/permissions/me` cũ của cả hai app bị xóa ngay sau khi lưu (sửa câu 2026-10-28, đối chiếu
  `directus/api/src/services/permissions.ts:26`).
- Web nhận `/permissions/me` không có `import`, `export` (API là Directus: cấu hình E2E proxy tới Directus, request rơi
  vào Directus, hoặc cache của Directus): web theo luật Directus và ẩn hai cột import, export của ma trận (FR-034). (026: không còn trường hợp "rơi vào Directus"; hai lý do còn lại giữ.)
- Link share cũ do Directus app tạo (`/admin/shared/<id>`): ở shared-domain `/admin/` đi tới Backoffice web nên link
  không mở được (US5 kịch bản 2). (026: link mở được ở domain Directus bằng Directus app; trong Backoffice web vẫn not found, D-189.4.)
- Định dạng export, import mà hệ thống không hỗ trợ: lỗi như hiện nay, không đổi.
- "Download Page as CSV": không gọi API export, nên API không kiểm; Use custom không áp (FR-028). Không phải lộ dữ liệu
  mới: các dòng đó đã hiển thị bằng quyền read.

## Requirements *(mandatory)*

### Functional Requirements

**Lưu trữ và mở rộng**

- **FR-001**: Quyền import, export PHẢI lưu ở bảng hệ thống mới `backoffice_permissions`, tạo bằng migration riêng của
  Backoffice (runner `backoffice_migrations` của 022; chỉ `up`, chạy lại được, chạy được trên 7 vendor). Bảng có cùng
  các cột dữ liệu với `directus_permissions` (policy, collection, action, permissions, validation, presets, fields) và
  thêm `options` (JSON) cho cấu hình riêng của từng action. KHÔNG có khóa ngoại tới bảng `directus_*`.
- **FR-002**: KHÔNG ĐƯỢC ghi action `import`, `export` vào `directus_permissions`. Lý do: Directus 11.17.4 trả 500 ở
  `GET /permissions/me` khi gặp action lạ (bảng Đánh giá, dòng 1).
- **FR-003**: `action` là chuỗi. Danh sách action của bảng mới (hiện là `import`, `export`) và cấu hình của từng action
  (action gốc cần có, các phần Use custom được dùng, định dạng hợp lệ) PHẢI khai báo ở một chỗ trong code; thêm action
  về sau không cần đổi schema bảng.
- **FR-004**: Không seed dữ liệu. Sau khi cài, người không phải admin không có import, export cho tới khi admin cấp.
- **FR-005**: `backoffice_permissions` là collection hệ thống của Backoffice như `backoffice_migrations` (D-181): ẩn, không
  đọc ghi qua `/items`. Trong SchemaOverview dùng chung với Directus (002) bảng là bảng thường như Directus dựng (không
  `special`, không `note`, không dòng `directus_fields`); service của Backoffice tự ép kiểu JSON và csv (plan 2026-10-28,
  research R1).

**Kiểm quyền ở API**

- **FR-006**: Export PHẢI cần quyền `export` trên collection, ngoài quyền read hiện có. Áp cho: tham số `export` của mọi
  request trả item của một collection (`/items/<collection>`, `/items/<collection>/<id>`, endpoint hệ thống như
  `/users`, `/files`, `/dashboards`, kể cả request ghi có `export`), `export` trong body query của `SEARCH` ở mọi route
  nhận `SEARCH` (`/items/<collection>` và endpoint hệ thống như `/users`, `/files`, `/dashboards`, `/roles`,
  `/policies`, `/activity`: body query thay query string sau guard nên kiểm ở bước gán body query, một chỗ cho mọi
  route), và `POST /utils/export/<collection>`. Kiểm PHẢI chạy trước response cache dùng chung, như 024 (sửa khi analyze
  2026-10-28, C1; mở rộng khi checklist 2026-10-28, CHK015).
- **FR-007**: Import PHẢI cần quyền `import` trên collection, ngoài quyền create, update hiện có của import. Áp cho
  `POST /utils/import/<collection>`, kiểm trước khi đọc file. Collection hệ thống: chỉ admin import được, như Directus
  (`ImportService` từ chối người không phải admin, `apps/api/src/services/import-export.service.ts:225`); quyền
  `import` không áp và không kiểm cho collection hệ thống, nên request giống Directus (sửa khi analyze 2026-10-28, I1).
- **FR-008**: Bị từ chối do thiếu quyền import, export (kể cả định dạng, field, bộ lọc của Use custom): HTTP 403,
  `FORBIDDEN`, cùng câu với lỗi quyền collection (FR-006 của 024); không trả, không tạo file; không ghi item nào.
- **FR-009**: Thứ tự: toggle `bo_show_import`, `bo_show_export` của 024 tắt thì chặn mọi người; toggle bật thì xét quyền
  theo policy. Toggle vẫn chỉ áp cho collection người dùng (FR-010 của 024); quyền `export` theo policy áp cho mọi
  collection, kể cả collection hệ thống; quyền `import` chỉ áp cho collection người dùng (FR-007).
- **FR-010**: Admin luôn có import, export (vẫn bị toggle chặn).
- **FR-011**: Người dùng có nhiều policy: có quyền khi ít nhất một policy cho phép, như Directus. Với Use custom, bộ
  lọc, field và định dạng của mỗi policy đi cùng nhau, không gộp chéo (chủ dự án chọn B + C + D ngày 2026-10-28, thay bản
  "_or bộ lọc, hợp field, hợp định dạng" của lượt 1–3):
  (B) chỉ các dòng quyền cho phép định dạng đang xin được tính, nên định dạng của một policy không mở dòng của policy
  khác; (C) import: mỗi dòng của file phải khớp trọn bộ lọc và cột của ít nhất một dòng quyền, không thì từ chối cả file;
  (D) export: mỗi cặp (quyền read của collection × dòng quyền export) là một nhánh như khi Directus ghép quyền read của
  nhiều policy: dòng được xuất khi khớp ít nhất một cặp; field hiện trên dòng đó khi có trong một cặp khớp, không thì để
  trống; `*` là hợp field export mà người gọi đọc được. Vì vậy export không vượt quyền read và không vượt quyền export
  của từng policy. Public (policy Public) và share (policy của role trong share) theo cùng quy tắc:
  có import, export khi policy của họ cho phép (clarify 2026-10-28, câu 4).
- **FR-012**: Dòng quyền của policy hay collection không còn tồn tại PHẢI bị bỏ qua.
- **FR-013**: Đổi quyền import, export PHẢI có tác dụng từ request gửi sau khi lưu xong, trên mọi replica Backoffice.
- **FR-014**: Chỉ kiểm ở lớp HTTP của Backoffice, như 024: flow, extension, service nội bộ không bị chặn. `ExportService`
  không đổi; `ImportService.import` nhận thêm một hook tùy chọn kiểm từng dòng (mặc định không có, nên mọi chỗ gọi hiện
  có không đổi), có comment `// Backoffice (spec 025)` (plan 2026-10-28, research R3).

**Use custom**

- **FR-015**: Export Use custom PHẢI hỗ trợ: bộ lọc dòng (AND với bộ lọc của read), giới hạn field (giao với field của
  read), định dạng được phép (tập con của `csv`, `csv_utf8`, `json`, `xml`, `yaml`). Field xin trong request xử lý như
  read của Directus với field không được phép: xin rõ field ngoài giới hạn thì 403 `FORBIDDEN`; `*` hoặc không chỉ định
  thì file chỉ có field được phép (clarify 2026-10-28, câu 2). Field quan hệ `a.b` xét theo field gốc `a` (CHK024).
  "AND với read" là ghép từng cặp quyền read × dòng quyền export (FR-011 D, sửa 2026-10-28); nhờ vậy export không bao
  giờ cho nhiều hơn quyền read của người gọi (CHK023). Field xin trong `group` hoặc `aggregate` ngoài giới hạn cũng 403.
- **FR-016**: Import Use custom PHẢI hỗ trợ: bộ lọc dòng (mỗi dòng trong file phải thỏa), giới hạn field (cột được có
  trong file), định dạng được phép (tập con của `csv`, `json`). Một dòng vi phạm bộ lọc, hoặc file có cột ngoài giới
  hạn, thì cả file bị từ chối với 403 `FORBIDDEN`, không ghi item nào (import chạy trong một transaction như hiện nay;
  clarify 2026-10-28, câu 1).
- **FR-017**: Không chọn định dạng nào trong Use custom nghĩa là mọi định dạng hệ thống hỗ trợ. Bản đầu `options` chỉ
  có định dạng file; cấu hình khác (số dòng tối đa, kích thước file...) không thuộc spec này và thêm sau theo FR-003
  (clarify 2026-10-28, câu 3).

**`/permissions/me`**

- **FR-018**: `GET /permissions/me` của Backoffice PHẢI có thêm `import`, `export` cho mỗi collection, cùng dạng các
  action khác (`access`: `none`, `partial`, `full`; `fields`), kèm định dạng được phép để web chỉ hiện định dạng đó.
  Admin: `full` cho mọi collection. Người không phải admin: collection không có dòng nào ở `directus_permissions` không
  xuất hiện, như Directus, kể cả khi có dòng ở bảng mới (export cần read, import cần create, update; sửa khi analyze
  2026-10-28, U1). `permissions_me` của `/graphql/system` có cùng nội dung (clarify 2026-10-28, Q1).
- **FR-019**: `/permissions/me` chỉ phản ánh policy, không phản ánh toggle 024; web ghép hai nguồn. Response cache của
  `/permissions/me` giữ như Directus (D-189.2).

**Ghi quyền**

- **FR-020**: Backoffice PHẢI có endpoint riêng `/backoffice/permissions` (cùng dạng `/permissions`; tiền tố
  `/backoffice/` cho mọi endpoint riêng về sau) để đọc, tạo, sửa, xóa dòng `backoffice_permissions`. Ai có quyền tương
  ứng trên `directus_permissions` thì có quyền đó trên bảng mới (service kiểm quyền trên `directus_permissions` rồi ghi
  bảng mới; activity ghi người gọi). Mỗi lần ghi có activity, revisions như ghi `directus_permissions` (plan 2026-10-28,
  research R6).
- **FR-021**: Xóa policy qua Backoffice PHẢI xóa dòng của policy đó. Xóa collection qua Backoffice PHẢI xóa dòng của
  collection đó.

**Web: ma trận quyền**

- **FR-022**: Ma trận quyền của policy PHẢI có 6 cột theo thứ tự: create, read, update, delete, import, export. Không có
  cột share. Ô import của collection hệ thống bị khóa như action bị khóa hiện nay (FR-007). Danh sách action của API
  (`PERMISSION_ACTIONS` dùng cho `/permissions/me` của 5 action Directus) không đổi.
- **FR-023**: Dòng `share` đã có trong `directus_permissions` KHÔNG ĐƯỢC bị đổi hay xóa từ ma trận (kể cả nút No access
  của hàng). Hàng `directus_shares` vẫn hiện.
- **FR-024**: Nút All access, No access của hàng PHẢI gồm import, export.
- **FR-025**: Ô import, export của collection có toggle 024 tắt PHẢI hiện mờ kèm ghi chú (toggle tắt trong Data Model),
  vẫn sửa và lưu được.
- **FR-026**: Drawer Use custom của import, export PHẢI có ba phần: bộ lọc dòng, field, định dạng. Ô có Use custom hiện
  trạng thái một phần như action khác.
- **FR-027**: Lưu policy PHẢI lưu cả quyền import, export. Nhân bản policy PHẢI chép cả quyền import, export.

**Web: các module**

- **FR-028**: Phần import, export (sidebar của Content, Users, Files, Presets, Translations; export, import dashboard ở
  Insights) chỉ hiện khi `/permissions/me` cho quyền và toggle 022 bật; phần import của collection hệ thống chỉ hiện với
  admin (FR-007); hộp export chỉ liệt kê định dạng được phép. Link
  "Download Page as CSV" nằm trong phần export nên hiện theo quyền export, nhưng tạo file ở trình duyệt từ các dòng
  đang hiển thị (đã đọc bằng quyền read) và KHÔNG áp định dạng, bộ lọc, field của Use custom (clarify 2026-10-28, câu
  5).

**Web: bỏ share**

- **FR-029**: Bỏ mục Shares ở sidebar trang item và route `/shared/:id`. Không có trang thay thế. API `/shares` và đăng
  nhập bằng share giữ như Directus.

**Web: API không có quyền import, export**

- **FR-034**: Khi `/permissions/me` không có khóa `import`, `export` (API là Directus 11.17.4, hoặc response Directus đã
  cache), web PHẢI theo luật Directus: có export khi có read, có import khi có create và update và collection không phải
  hệ thống (admin luôn có); ma trận quyền ẩn hai cột
  import, export (không lưu được vào API không có endpoint của FR-020). Có khóa thì theo FR-028 (clarify 2026-10-28, Q2).

**Chạy song song và triển khai**

- **FR-030**: Không sửa `directus/`. Directus 11.17.4 chạy cùng DB không đổi hành vi (US6).
- **FR-035**: Request không thuộc D-189..D-189.7 PHẢI giống Directus 11.17.4 (status, body, header). Export, import có
  quyền đầy đủ (không Use custom) cho cùng file, cùng dữ liệu như Directus (sửa khi checklist 2026-10-28, CHK034).
- **FR-031**: Lb (compose shared-domain) và Ingress (Helm) PHẢI đưa `/permissions/me` và endpoint của FR-020 tới
  Backoffice, như `/extensions/sources/` của 020. Request import, export rơi vào Directus không bị chặn (D-189.1). (026: gỡ, FR-009; ở domain Backoffice mọi path tới BE.)
- **FR-032**: Tài liệu (quickstart của 025, `deploy/README.md`) PHẢI ghi: không seed, admin phân quyền lại sau khi cài;
  giới hạn khi chạy cùng Directus (D-189.1, D-189.2); share không còn trong giao diện. `design-system/docs/migration-guide.md`
  chỉ kiểm phần giao diện (sửa khi analyze 2026-10-28, T1).

**Test**

- **FR-033**: Unit API cho migration (chạy lại, nhiều process), service, ba điểm kiểm, Use custom (bộ lọc, field, định
  dạng, nhiều policy), `/permissions/me`, xóa policy, collection. Bộ đối chiếu ghi khác biệt D-189+ và giữ mọi request
  khác giống Directus với admin, user thường, public, share, static token; case Directus đọc `/permissions/me` và chạy
  `schema snapshot`, `diff` trên DB có bảng mới; profile parity `bootstrap` (Directus trên DB của Backoffice, migrate
  chéo) và job deploy (Directus khởi động trên DB có bảng) cho SC-003. Unit với action giả trong registry cho SC-006. E2E
  ba cấu hình (proxy tới Directus, proxy tới API mới, cross-site) cho ma trận, Use custom, nhân bản, import, export ở
  Content, Users, Files, Insights, phần share đã bỏ, và luật Directus khi API là Directus (FR-034). Deploy test cho định
  tuyến lb và cho quyền đổi ở replica này có tác dụng ở replica khác (FR-013) (sửa khi analyze 2026-10-28, G1, G2, G4).
  Migration trên 7 vendor: SQLite (unit), Postgres (parity đủ, deploy), MySQL (parity rút gọn của PR, migration chạy
  trong `bootstrap` của env), MSSQL, Oracle, CockroachDB (nightly), theo Nguyên tắc V (CHK030). (026: test định tuyến lb thành "trả ở domain Backoffice".)

### Key Entities

- **Quyền mở rộng của Backoffice** (`backoffice_permissions`): một dòng là một action của Backoffice cho một policy trên
  một collection. Thuộc tính: policy, collection, action (`import`, `export`, sau này thêm), bộ lọc dòng
  (`permissions`), field (`fields`), `validation`, `presets` (chưa dùng ở bản đầu, giữ cho action sau), cấu hình riêng
  của action (`options`; bản đầu chỉ có định dạng được phép, FR-017). Không khóa ngoại.
- **Danh sách action của Backoffice** (trong code): với mỗi action: action gốc cần có (export cần read; import cần
  create, update), phần Use custom được dùng, định dạng hợp lệ.
- **Policy** (`directus_policies`, không đổi): nhóm quyền gán cho role, user; quyền import, export gắn vào policy.
- **Toggle của collection** (`bo_show_import`, `bo_show_export`, spec 022, 024): không đổi; chặn mọi người khi tắt.

### Đánh giá hiện trạng và chạy song song với Directus 11.17.4

Đọc code ngày 2026-10-28, chưa chạy thử. Mục ghi [Inference] là suy ra từ code, plan PHẢI có test xác nhận.

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Directus gặp action lạ trong `directus_permissions` | Dựng sẵn 5 action rồi đọc `.access` của action đang duyệt; [Inference] action lạ làm `GET /permissions/me` và `permissions_me` trả 500 với người không phải admin | `directus/api/src/permissions/modules/fetch-accountability-collection-access/fetch-accountability-collection-access.ts:40-50` |
| 2 | Snapshot của Directus | Bỏ collection không có meta (`excludeUntracked`), nên `schema apply` không xóa bảng chưa quản lý | `directus/api/src/utils/get-snapshot.ts:27` |
| 3 | Migration riêng | Danh sách tĩnh, ghi `backoffice_migrations`, chạy dưới lock | `apps/api/src/database/backoffice-migrations/index.ts:15`, `run.ts` |
| 4 | Collection hệ thống của Backoffice | `backoffice_migrations` ẩn, nằm trong danh sách hệ thống và danh sách bỏ khỏi GraphQL | `libs/system-data/src/collections/collections.yaml:129`, `libs/system-data/src/collections/index.ts:19-24`, `apps/api/src/services/graphql/schema/index.ts:50` |
| 5 | Kiểm tra import hiện có | `validateAccess` create rồi update; chạy trong transaction | `apps/api/src/services/import-export.service.ts:228`, `:240`, `:348`, `:463` |
| 6 | Định dạng | Import: `application/json`, `text/csv`, `application/vnd.ms-excel`; export: json, xml, csv, csv_utf8, yaml | `apps/api/src/services/import-export.service.ts:253`, `:840-888` |
| 7 | Điểm chặn của 024 | Guard `?export=` trước `checkCacheMiddleware`; `assertToggle` ở import, export; `SEARCH` gán body query vào `req.sanitizedQuery` sau guard (`validateBatch`), 024 kiểm lại trong `search()`; `ImportService` từ chối người không phải admin với collection hệ thống | `apps/api/src/app-pipeline.ts:169-171`, `apps/api/src/middleware/collection-toggles-guard.ts`, `apps/api/src/controllers/utils.controller.ts:127`, `:177`; `apps/api/src/controllers/items.controller.ts:78-84`, `apps/api/src/middleware/validate-batch.ts:27`; `apps/api/src/services/import-export.service.ts:225` |
| 8 | `/permissions/me` của Backoffice | Bản port, 5 action từ `PERMISSION_ACTIONS` | `apps/api/src/controllers/permissions.controller.ts:104-116`, `libs/constants/src/permissions.ts:2` |
| 9 | Response cache | Khóa `hash({version, user, path, query})` giống Directus; request có Referer từ `PUBLIC_URL/admin` bỏ đọc cache khi `CACHE_AUTO_PURGE=false` nhưng vẫn ghi | `apps/api/src/utils/get-cache-key.ts`, `apps/api/src/utils/should-skip-cache.ts`, `apps/api/src/middleware/respond.ts:36-53` |
| 10 | Xóa response cache khi ghi | `ItemsService` xóa khi `CACHE_AUTO_PURGE=true` | `apps/api/src/utils/should-clear-cache.ts` |
| 11 | Xóa collection | Đang xóa dòng `directus_permissions` của collection | `apps/api/src/services/collections.service.ts:711` |
| 12 | Ma trận quyền (web) | 5 cột từ `editablePermissionActions`; ô đọc dòng o2m `permissions` của policy | `apps/web/src/interfaces/_system/system-permissions/app-permissions.ts:12`, `PermissionsRow.vue:51`, `SystemPermissions.vue:79`, `:147-186` |
| 13 | Drawer quyền | Tab theo action; action share có tab riêng | `apps/web/src/interfaces/_system/system-permissions/detail/PermissionsDetail.vue:64`, `:71` |
| 14 | Nhân bản policy | Chỉ chép `/permissions` | `apps/web/src/modules/settings/routes/policies/use-duplicate.ts:32` |
| 15 | Import, export ở web | Phần import theo `createAllowed` và toggle 022; dùng ở Content, Users, Files, Presets, Translations; Insights export `?export=json` và import `directus_dashboards`; "Download Page as CSV" là `saveAsCSV` của layout từ các dòng đã nạp (`apps/web/src/layouts/tabular/index.ts:17`), không gọi API | `apps/web/src/components/sidebar/ExportSidebarDetail.vue:532`, `apps/web/src/modules/content/routes/CollectionRoute.vue:141-142`, `UsersCollectionRoute.vue:344`, `FilesCollectionRoute.vue:610`, `PresetsCollectionRoute.vue:221`, `TranslationsCollectionRoute.vue:218`, `InsightsOverviewRoute.vue:126-128`, `:294` |
| 16 | Share ở web | Mục Shares ở trang item; route `/shared/:id`; route bắt mọi path là trang not found | `apps/web/src/modules/content/routes/ItemRoute.vue:819-824`, `apps/web/src/router/index.ts:91`, `:101` |
| 17 | Lb, Ingress | `api_pool` shared-domain có Directus; `/admin/` tới Backoffice web; `/extensions/sources/` tới `bo_pool`; Ingress có path riêng cho `/extensions/sources` | `deploy/compose/lb/shared-domain.conf:12`, `:48`, `:52`; `deploy/helm/backoffice/templates/ingress.yaml:32` (026: bỏ) |
| 18 | Parity | Normalizer `/collections`, `/fields`, OAS lọc theo tiền tố `backoffice_`; introspection lọc theo tên `backoffice_migrations`; dump chỉ lấy bảng `directus_*` | `tests/parity/src/normalizers.ts:42`, `:60`, `:71`, `:122`; `tests/parity/src/bootstrap/dump.ts:39` |
| 19 | E2E liên quan | Ma trận, policy, share | `apps/web-e2e/src/settings-permissions.spec.ts`, `settings-roles-policies.spec.ts`, `content-share.spec.ts`, `payload/comments-shares.spec.ts` |
| 20 | Dùng chung registry action giữa API và web | `apps/web/package.json` có một tham chiếu `@backoffice/*`; kiểm khi làm, nếu không dùng được trong Vite thì web giữ bản sao như `editablePermissionActions` (plan 2026-10-28, research R2) | `apps/web/package.json`, `apps/web/src/interfaces/_system/system-permissions/app-permissions.ts:12` |
| 21 | SchemaOverview dùng chung | Directus dựng từ mọi bảng, không `special` cho bảng không có `directus_fields`; Backoffice phải dựng giống (002) | `libs/system-data/src/collections/collections.yaml:127-128` (ghi chú của `backoffice_migrations`), `directus/api/src/utils/get-schema.ts` |
| 22 | Cộng dồn quyền nhiều policy | `mergePermissions('or', ...)` có sẵn | `apps/api/src/permissions/utils/merge-permissions.ts` |

**Kết luận** [Inference]: Directus không phải làm gì; `directus_*`, file, cấu hình của Directus không đổi. Directus vẫn
trả 200 cho import, export mà Backoffice từ chối, nên ở shared-domain việc chặn không đủ. (026: lb không còn gửi tới Directus.)

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021–024).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-189 | `GET /permissions/me` và `permissions_me` của `/graphql/system` | 5 action mỗi collection | Thêm `import`, `export` (kèm định dạng được phép) ở cả REST và GraphQL; schema GraphQL không đổi (kết quả là JSON) | Web cần quyền import, export; yêu cầu chủ dự án 2026-10-28 | khác (duyệt 2026-10-28) | — |
| D-189.1 | Import, export khi policy không cho (kể cả định dạng, field, bộ lọc của Use custom; export kể cả collection hệ thống và `SEARCH` có `export` trong body; import vào collection hệ thống giữ luật Directus: chỉ admin) | 200 khi có read (export) hoặc create, update (import) | 403 `FORBIDDEN`, không trả, không tạo file, không ghi item. Ở shared-domain request rơi vào Directus vẫn 200. Export được phép nhưng có Use custom: 200, file chỉ có dòng thỏa bộ lọc và field được phép, Directus trả mọi dòng của quyền read (CHK002). Directus app ở cấu hình proxy tới API mới: người không phải admin nhận 403 cho tới khi được cấp qua Backoffice (CHK003) | Yêu cầu chủ dự án 2026-10-28 | khác (duyệt 2026-10-28) | — (026: câu "Ở shared-domain" không còn áp dụng) |
| D-189.2 | Response cache của `/permissions/me` khi chạy cùng Directus | Ghi, đọc theo khóa chung | Giữ như Directus; Backoffice có thể trả bản Directus đã cache (không có `import`, `export`) và ngược lại | Chủ dự án chọn không đổi cache, chấp nhận lệch 2026-10-28 | khác (duyệt 2026-10-28) | — |
| D-189.3 | Ma trận quyền của policy | 5 cột có share | 6 cột create, read, update, delete, import, export; không có share; Use custom cho import, export; khi API là Directus: 4 cột, import, export theo luật Directus (FR-034) | Yêu cầu chủ dự án 2026-10-28 | khác (duyệt 2026-10-28) | — |
| D-189.4 | Share trong giao diện | Mục Shares ở trang item, trang `/admin/shared/:id` | Không có cả hai; link cũ rơi vào trang not found | Yêu cầu chủ dự án 2026-10-28 | khác (duyệt 2026-10-28) | — |
| D-189.5 | Bảng `backoffice_permissions` ở `/collections`, `/fields`, OAS, GraphQL | Bảng chưa quản lý (meta null), admin thấy qua `/items` | Collection hệ thống ẩn như `backoffice_migrations` | Nguyên tắc II, như D-181 | khác (duyệt 2026-10-28) | — |
| D-189.6 | Endpoint `/backoffice/permissions` đọc, ghi quyền import, export (FR-020) | Không có (404) | Có, cùng dạng `/permissions` | Ghi quyền ngoài `directus_permissions` (FR-002); path đề xuất khi plan 2026-10-28 | khác (duyệt 2026-10-28) | — |
| D-189.7 | Lb shared-domain, Ingress | — | `/permissions/me` (exact) và `/backoffice/` (prefix) tới Backoffice | Tránh Directus trả `/permissions/me` thiếu khóa hay 404 cho D-189.6 | khác (duyệt 2026-10-28) | — (026: gỡ, FR-009) |

**Cần xác nhận**:

- Không có (FR-018 và FR-034 chốt khi `/speckit.specify` 2026-10-28).

## Clarifications

### Session 2026-10-28 (chủ dự án, trước `/speckit.specify`)

- Q: Lưu quyền import, export ở đâu? → A: bảng riêng `backoffice_permissions`; không ghi `directus_permissions` vì
  Directus trả 500 với action lạ (FR-001, FR-002).
- Q: Có seed quyền cho policy hiện có không? → A: không; admin phân quyền lại (FR-004).
- Q: Bảng mở rộng được không? → A: action là chuỗi, có `options`, danh sách action trong code (FR-003).
- Q: Khóa ngoại tới `directus_policies`? → A: không; dòng mồ côi bỏ qua (FR-001, FR-012).
- Q: Collection hệ thống? → A: áp dụng (FR-006, FR-009). Q: Admin? → A: luôn có (FR-010). Q: Import cần gì? → A:
  `import` + `create` + `update` (FR-007). Q: Nhiều policy? → A: một policy cho là được (FR-011).
- Q: Use custom? → A: có: bộ lọc dòng, field, định dạng file (FR-015, FR-016).
- Q: Điểm chặn? → A: `?export=`, `/utils/export`, `/utils/import` như 024 (FR-006, FR-007).
- Q: Thứ tự với toggle 024? → A: toggle tắt chặn mọi người; bật thì xét policy (FR-009).
- Q: Web lấy quyền từ đâu? → A: `GET /permissions/me` (FR-018). Q: Response cache của `/permissions/me`? → A: giữ như
  Directus, chấp nhận lệch khi chạy cùng Directus (FR-019, D-189.2).
- Q: Ghi quyền? → A: endpoint riêng; quyền sửa như `directus_permissions`; activity, revisions (FR-020).
- Q: Cột share, dòng share cũ, hàng `directus_shares`? → A: bỏ cột; không đụng dòng cũ; vẫn hiện hàng (FR-022, FR-023).
- Q: Ô import, export khi toggle tắt? → A: hiện mờ có ghi chú, vẫn lưu được (FR-025).
- Q: Shares ở trang item, `/shared/:id`? → A: bỏ cả hai, không làm trang thay thế; API giữ (FR-029).
- Q: Lb, Ingress? → A: `/permissions/me` và endpoint mới về Backoffice; import, export rơi vào Directus không bị chặn
  (FR-031). (026: gỡ.)

### Session 2026-10-28 (chủ dự án, `/speckit.specify`)

- Q1: `permissions_me` của `/graphql/system` có thêm `import`, `export` như REST không? → A: có, giống REST (FR-018,
  D-189).
- Q2: Web nhận `/permissions/me` không có `import`, `export` (API là Directus hoặc bản Directus đã cache) thì xử lý sao?
  → A: theo luật Directus (export khi có read, import khi có create và update), ma trận ẩn hai cột import, export
  (FR-034, Edge Cases).

### Sửa câu chữ khi `/speckit.plan` (2026-10-28, research.md R14)

- FR-005: SchemaOverview dùng chung giữ bản Directus dựng, service ép kiểu. FR-014: `ImportService` nhận hook tùy chọn.
  FR-020, D-189.6, D-189.7: path `/backoffice/permissions`, service kiểm quyền trên `directus_permissions`. Bảng Đánh
  giá: dòng 20–22.

### Duyệt 2026-10-28 (chủ dự án kiêm tech lead)

- D-189, D-189.1..D-189.7 (kể cả path `/backoffice/permissions` và định tuyến lb/Ingress) và các quyết định thiết kế
  R1–R10 của research.md (bảng không `directus_fields`, `rowGuard` tùy chọn của `ImportService`, service với bản sao
  accountability admin, lưu hai nguồn ở web, bỏ share): duyệt sau `/speckit.plan`, trước `/speckit.tasks`. (026: định tuyến lb/Ingress gỡ.)

### Sửa khi `/speckit.checklist` api-compat (2026-10-28, checklists/api-compat.md, chủ dự án duyệt áp)

- CHK002, CHK003: D-189.1 thêm export có Use custom (200, nội dung khác) và Directus app ở cấu hình proxy tới API mới.
  CHK008: Edge Case về dòng activity, revisions. CHK015: `SEARCH` ở mọi route (FR-006, Edge Cases). CHK023, CHK024:
  FR-015 (read đã cộng dồn, field `a.b`). CHK030: FR-033 (7 vendor). CHK031, CHK032: Assumptions (kiểu cột, hỏng giữa
  chừng). CHK034: FR-035 mới. CHK035: SC-002. CHK007: phạm vi `jsonPointer` của D-189 (research R11, tasks).

### Sửa khi `/speckit.analyze` (2026-10-28, chủ dự án duyệt áp)

- C1: `SEARCH /items/<c>` có `export` trong body query lọt guard (body thay query string sau guard) → kiểm ở controller
  (FR-006, Edge Cases). I1: import vào collection hệ thống chỉ admin như Directus, không kiểm quyền `import`, ô import
  của collection hệ thống bị khóa, web chỉ hiện import hệ thống cho admin (FR-007, FR-009, FR-022, FR-028, FR-034, US3
  kịch bản 3, Edge Cases). O1: sửa E2E hiện có chuyển lên lượt 1 (tasks). U1: `/permissions/me` không liệt kê
  collection chỉ có dòng ở bảng mới (FR-018). U2: quyền sửa bảng mới ở mức collection (Assumptions). G1, G2, G4: test
  action giả, profile `bootstrap` + job deploy, deploy test nhiều replica (FR-033). G3: đường `/backoffice/permissions`
  vào danh sách request E2E cùng lượt ma trận (tasks). T1: tài liệu ở `deploy/README.md` (FR-032).

### Session 2026-10-28 (chủ dự án, `/speckit.clarify`)

- Q: File import có dòng vi phạm bộ lọc dòng hoặc có cột ngoài giới hạn field thì xử lý sao? → A: từ chối cả file: 403
  `FORBIDDEN`, không ghi item nào (FR-016).
- Q: Export xin field ngoài giới hạn thì xử lý sao? → A: như read của Directus: xin rõ field không được phép thì 403
  `FORBIDDEN`; `*` hoặc không chỉ định thì chỉ lấy field được phép (FR-015).
- Q: Bản đầu `options` của Use custom có cấu hình nào ngoài định dạng file? → A: chỉ định dạng file; cấu hình khác (số
  dòng tối đa, kích thước file...) để spec sau theo FR-003 (FR-017).
- Q: Public và share có được cấp import, export không? → A: cùng quy tắc với mọi policy: có khi policy của họ cho phép
  (FR-011, Edge Cases).
- Q: Link "Download Page as CSV" tạo file ở trình duyệt từ các dòng đang hiển thị, không qua API export; theo luật nào?
  → A: hiện cùng phần export theo quyền export, không áp Use custom (định dạng, bộ lọc, field) vì chỉ gói lại dữ liệu đã
  đọc bằng quyền read (FR-028, Edge Cases).

## Assumptions

- `validation`, `presets` của bảng mới chưa dùng ở bản đầu.
- Quyền sửa `backoffice_permissions` (FR-020) kiểm ở mức collection trên `directus_permissions` (create, read, update,
  delete); bộ lọc theo item của quyền trên `directus_permissions` không áp cho bảng mới. Hiện chỉ admin vào Settings nên
  rủi ro thấp (sửa khi analyze 2026-10-28, U2).
- Định dạng không được phép dùng lỗi 403 `FORBIDDEN` (không phải lỗi định dạng không hỗ trợ).
- Kiểu cột do Knex chọn theo vendor, như khi migration của Directus tạo `directus_permissions` (`json`, `uuid` ở MySQL,
  MSSQL, Oracle); tên index tự sinh dài 54 ký tự, trong giới hạn 128 byte của Oracle 12.2+ [Inference] (CHK031).
- Migration hỏng giữa chừng (bảng đã có, index chưa có): `up` chạy lại thấy bảng thì dừng, nên sửa tay như mọi migration
  riêng (Nguyên tắc II: rollback làm tay trên DB), ghi ở `deploy/README.md` (CHK032).
- Directus app (cấu hình proxy tới API mới) không có giao diện import, export theo policy; admin dùng Backoffice để phân
  quyền.
- Chi phí kiểm quyền thêm nhỏ so với import, export [Inference]; đo bằng benchmark hiện có.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sau khi admin lưu quyền, 100% request import, export gửi tới Backoffice từ lúc đó theo đúng quyền mới (cho
  hoặc 403), ở mọi replica, với admin, user thường, public, share, static token.
- **SC-002**: 0 test đối chiếu, blackbox, E2E hiện có đổi kết quả ngoài các khác biệt D-189..D-189.7, các bước share
  được bỏ theo FR-029 và bước cấp quyền import, export thêm vào setup vì không seed (FR-004, CHK035).
- **SC-003**: Directus 11.17.4 trên DB đã chạy migration của 025: 0 lỗi khi khởi động, `migrate`, `schema snapshot`,
  `schema apply`, `GET /permissions/me` cho user có quyền import, export.
- **SC-004**: Trên 100% lượt E2E (ba cấu hình × admin và user thường), phần import, export ở Content, Users, Files,
  Insights hiện đúng theo quyền và toggle; ma trận không có share, có 6 cột khi API là Backoffice và 4 cột khi API là
  Directus (FR-034).
- **SC-005**: Admin cấp import, export cho một collection trong một policy bằng không quá 3 thao tác (mở policy, bấm ô,
  lưu).
- **SC-006**: Thêm một action mới vào danh sách action không cần migration đổi bảng (kiểm bằng test unit dùng action giả).
- **SC-007**: Scenario benchmark hiện có của Backoffice không tệ hơn Directus quá 10% (Nguyên tắc X).
