# Feature Specification: API chặn tìm kiếm, Import, Export theo cài đặt của collection

**Feature Branch**: `024-collection-toggles-api` (làm trên `main` như 012–023, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=024-collection-toggles-api`)
**Created**: 2026-10-27
**Status**: Implemented 2026-10-27, hai lượt trên `main` (`48b6f82f`, `44c44dd4`, `10556348`), CI 40534561817 xanh
(25/25), benchmark-items 40534659010, benchmark-graphql 40534690242, benchmark-web 40541712241 xanh (spec và clarify
2026-10-27; plan 2026-10-27: research R1–R11, data-model, contracts, quickstart; D-188..D-188.4 và câu lỗi FR-006 duyệt
2026-10-27, chủ dự án kiêm tech lead)
**Input**: User description: "Feature 024: mở rộng 022, API Backoffice chặn tìm kiếm, import, export theo ba cài đặt của
collection. Bối cảnh: 022 thêm bo_show_search, bo_show_import, bo_show_export vào directus_collections (migration
20261026A) nhưng chỉ ẩn giao diện trang Content; FR-008 của 022 giữ API như Directus nên người dùng có quyền vẫn gọi thẳng
API được. Mục tiêu: tắt cài đặt nào thì API Backoffice chặn phần đó trên collection đó; spec này sửa FR-008 và FR-009 của
022. [...] Khác biệt với Directus, chủ dự án đã chấp nhận ngày 2026-10-27, ghi từ D-188 [...]" (bản đầy đủ: lệnh
`/speckit.specify` của 024 trong `SPECKIT-GUIDE.md` mục 6)

**Điều kiện trước `/speckit.plan`** (Governance):

- Không sửa constitution: Nguyên tắc III cho phép khác biệt API khi đã ghi theo Nguyên tắc X (ghi trong spec, nêu lý do,
  tech lead duyệt), như 023. Không thêm bảng, cột hay migration (Nguyên tắc II giữ nguyên): dùng ba cột của migration
  `20261026A` (spec 022).
- Spec này sửa FR-008 ("ba cài đặt chỉ là giao diện") và FR-009 (DrawerCollection không theo cài đặt) của spec 022; khi
  implement, spec 022 ghi chú "sửa bởi 024" ở hai FR đó.
- Khác biệt D-188..D-188.4: chủ dự án kiêm tech lead duyệt 2026-10-27 (sau `/speckit.plan` và checklist api-compat).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - API từ chối tìm kiếm trên collection đã tắt "Hiện ô tìm kiếm" (Priority: P1) 🎯 MVP

Admin tắt "Hiện ô tìm kiếm" của collection A (spec 022). Từ request tiếp theo, mọi client (app khác, script,
`@directus/sdk`, Directus app ở cấu hình proxy tới API mới) gọi API Backoffice để tìm kiếm trên A đều bị từ chối, kể cả
admin. Đọc A không có từ khóa vẫn chạy như hiện nay.

**Why this priority**: lý do của feature: 022 chỉ ẩn ô tìm kiếm, người dùng có quyền vẫn gọi thẳng API (FR-008 của 022).

**Independent Test**: tắt cài đặt trên collection `bo_content`; gọi REST và GraphQL có và không có từ khóa bằng admin, user
thường, share; so với collection khác còn bật.

**Acceptance Scenarios**:

1. **Given** A tắt "Hiện ô tìm kiếm", **When** admin hay user thường gọi `GET /items/A?search=abc`, **Then** API trả 403
   `FORBIDDEN` và không trả dữ liệu.
2. **Given** như trên, **When** gọi `SEARCH /items/A` với từ khóa trong body, hoặc `GET /items/A` có từ khóa kèm
   `aggregate`, `groupBy`, **Then** API trả 403 `FORBIDDEN`.
3. **Given** như trên, **When** gọi `/graphql` với query `A(search: "abc")` hoặc `A_aggregated(search: "abc")`, **Then**
   response có lỗi `FORBIDDEN` cho field đó; schema GraphQL (introspection, SDL) không đổi.
4. **Given** như trên, **When** gọi `GET /items/A` không có từ khóa hoặc với `search=` rỗng, **Then** API trả 200 giống
   Directus 11.17.4.
5. **Given** A bật lại cài đặt, hoặc cài đặt là null, **When** gọi `GET /items/A?search=abc`, **Then** API trả 200 giống
   Directus 11.17.4.
6. **Given** A tắt "Hiện ô tìm kiếm" và B có quan hệ o2m tới A, **When** gọi `GET /items/A/<id>?search=abc`,
   `PATCH /items/A` với body `{"query": {"search": "abc"}, "data": {...}}`, `GET /items/B?deep[<o2m>][_search]=abc`,
   GraphQL `B { <o2m>(search: "abc") { id } }`, mutation `create_A_items(data: [...], search: "abc")` hay
   `POST /utils/export/A` với từ khóa trong body query, **Then** API trả 403 `FORBIDDEN` (GraphQL: lỗi ở field đó) và
   không đổi dữ liệu: mutation không tạo item nào (FR-017).

---

### User Story 2 - API từ chối export trên collection đã tắt "Hiện Export" (Priority: P1)

Admin tắt "Hiện Export" của A. Mọi cách xuất dữ liệu A qua HTTP của Backoffice đều bị từ chối: tải file theo tham số
`export` và export chạy nền ra thư viện file.

**Why this priority**: yêu cầu chính; tránh xuất hàng loạt dữ liệu của collection không dành cho việc đó.

**Independent Test**: tắt cài đặt trên `bo_content`; gọi các đường export với admin và user thường; đọc thường vẫn chạy.

**Acceptance Scenarios**:

1. **Given** A tắt "Hiện Export", **When** gọi `GET /items/A?export=csv` (hoặc json, csv_utf8, xml, yaml) hay
   `GET /items/A/<id>?export=json`, **Then** API trả 403 `FORBIDDEN`, không trả file.
2. **Given** như trên, **When** gọi `POST /utils/export/A`, **Then** API trả 403 `FORBIDDEN`, không tạo file trong thư
   viện file.
3. **Given** như trên, **When** gọi `GET /items/A` không có `export`, **Then** API trả 200 giống Directus.

---

### User Story 3 - API từ chối import trên collection đã tắt "Hiện Import" (Priority: P1)

Admin tắt "Hiện Import" của A. Gọi import file vào A qua HTTP của Backoffice bị từ chối; tạo item từng cái hay theo lô
bằng `POST /items/A` vẫn chạy (đó không phải import).

**Why this priority**: yêu cầu chính; tránh nhập hàng loạt vào collection không dành cho việc đó.

**Independent Test**: tắt cài đặt trên `bo_content`; gửi file CSV, JSON tới `/utils/import/bo_content`; đếm item trước và
sau.

**Acceptance Scenarios**:

1. **Given** A tắt "Hiện Import", **When** gửi file tới `POST /utils/import/A`, **Then** API trả 403 `FORBIDDEN` và A không
   có item mới.
2. **Given** như trên, **When** gọi `POST /items/A` với một item hay một mảng item, **Then** API chạy như Directus.

---

### User Story 4 - Drawer chọn item theo cài đặt tìm kiếm (Priority: P2)

Người dùng sửa item có quan hệ tới A (ví dụ m2o) và mở drawer chọn item (DrawerCollection). Khi A tắt "Hiện ô tìm kiếm",
drawer không có ô nhập từ khóa, vẫn có nút bộ lọc, và danh sách tải được (không gửi từ khóa nên không bị 403).

**Why this priority**: hệ quả của US1: nếu drawer vẫn gửi từ khóa thì drawer của A báo lỗi. Sửa FR-009 của 022.

**Independent Test**: tắt cài đặt trên `bo_content`; mở drawer chọn item `bo_content` từ một collection có quan hệ tới nó,
bằng admin và user thường, ở ba cấu hình E2E.

**Acceptance Scenarios**:

1. **Given** A tắt "Hiện ô tìm kiếm", **When** mở drawer chọn item của A, **Then** drawer không có ô nhập từ khóa, có nút
   bộ lọc với số bộ lọc đang bật, danh sách tải không lỗi.
2. **Given** như trên và preset/bookmark của A có từ khóa, **When** mở drawer, **Then** drawer không gửi từ khóa, bộ lọc
   của preset vẫn áp dụng, preset không bị sửa.
3. **Given** collection B còn bật cài đặt, **When** mở drawer của B, **Then** drawer như hiện nay.
4. **Given** A tắt "Hiện ô tìm kiếm" và một field o2m hay m2m tới A dùng interface `list-o2m`/`list-m2m` có "Search
   Filter" bật, **When** mở item chứa field đó, **Then** danh sách liên quan không có ô nhập từ khóa, bộ lọc vẫn có, danh
   sách tải không lỗi (FR-014).

---

### User Story 5 - Chạy song song và không ảnh hưởng chỗ khác (Priority: P1)

Directus 11.17.4 chạy cùng DB không đổi hành vi. Flow, extension, collection hệ thống, và mọi request không bị chặn giữ
nguyên như hiện nay. Response cache dùng chung với Directus không làm lọt request bị chặn.

**Why this priority**: Nguyên tắc II, III, IV; request khác lệch Directus là lỗi.

**Independent Test**: bộ đối chiếu và blackbox hiện có trên DB mà mọi collection bật cài đặt; thêm case cache do Directus
ghi trước; flow "Read Data" có từ khóa trên collection đã tắt.

**Acceptance Scenarios**:

1. **Given** mọi collection bật cài đặt (mặc định), **When** chạy bộ đối chiếu và blackbox hiện có, **Then** 0 test đổi
   kết quả.
2. **Given** A tắt "Hiện ô tìm kiếm" và response cache bật, **When** Directus trả và ghi cache cho `GET /items/A?search=abc`
   rồi cùng request gửi tới Backoffice, **Then** Backoffice trả 403, không trả response trong cache.
3. **Given** A tắt cả ba cài đặt, **When** flow có operation đọc A với từ khóa, hay endpoint của extension gọi service
   items, import, export trên A, **Then** chạy như hiện nay (không bị chặn).
4. **Given** A tắt cài đặt, **When** gọi cùng request tới Directus 11.17.4, **Then** Directus trả 200 như trước (D-188).

---

### Edge Cases

- Cài đặt null hoặc DB chưa có cột (chưa chạy migration `20261026A`): hiểu là bật, không chặn.
- `search=` rỗng: không phải tìm kiếm (bước làm sạch query bỏ chuỗi rỗng), không chặn. Từ khóa chỉ có khoảng trắng vẫn là
  tìm kiếm (bước làm sạch giữ nguyên chuỗi), bị chặn.
- Request có cả từ khóa và `export` trên collection tắt cả hai: một lỗi 403 `FORBIDDEN`.
- Người dùng không có quyền đọc A, hay A không tồn tại: vẫn 403 `FORBIDDEN` như hiện nay; lỗi chặn cùng mã và cùng câu
  với lỗi quyền collection (FR-006) nên không lộ việc A có tồn tại và tắt cài đặt hay không.
- Collection singleton: cùng quy tắc.
- Document GraphQL có nhiều field: chỉ field tìm kiếm trên A bị lỗi, các field khác vẫn có dữ liệu (cách GraphQL trả lỗi
  từng field, như lỗi quyền hiện nay) [Inference: `apps/api/src/services/graphql/index.ts:66-80`].
- Admin đổi cài đặt (ở Backoffice hay Directus app): request gửi sau khi lưu xong bị chặn hay hết bị chặn trên mọi replica
  Backoffice (FR-013). Sửa thẳng bằng SQL thì cần xóa cache (`/utils/cache/clear` hay lệnh `cache clear`) như mọi thay
  đổi schema khác.
- Chế độ shared-domain: lb gửi request tới Directus thì không bị chặn (D-188); muốn chặn đủ thì dùng standalone hoặc
  separate-domain. (026: chế độ shared-domain đã bỏ; ở domain Backoffice mọi request tới BE.)
- Directus app ở cấu hình proxy tới API mới: tìm kiếm, export, import của A trong Directus app nhận lỗi 403 (D-188).
- Bookmark có từ khóa trong `directus_presets` dùng chung: Backoffice (Content, drawer) không gửi từ khóa; Directus app ở
  cấu hình proxy tới API mới mở bookmark đó nhận 403.
- Collection hệ thống (`directus_*`, `backoffice_*`): không bị chặn.
- Từ khóa qua quan hệ (`deep._search`, field quan hệ GraphQL) xét cài đặt của collection đích, không phải collection gốc
  (FR-017). `filter` có `_some`, `_none` hay điều kiện trên field quan hệ không phải tìm kiếm, không bị chặn.
- Export qua quan hệ (`GET /items/B?export=csv&fields=a.*` với A tắt export): không chặn, chỉ xét collection của route;
  đọc A qua `/items/A` vẫn được phép nên đây không phải đường lộ dữ liệu mới (sửa khi checklist 2026-10-27, CHK016).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ba cài đặt `bo_show_search`, `bo_show_import`, `bo_show_export` của spec 022 PHẢI điều khiển cả giao diện
  và API Backoffice: tắt cài đặt nào thì ẩn phần giao diện đó (022) và API Backoffice từ chối phần đó trên collection đó.
  Sửa FR-008 của 022. Nhãn ba toggle giữ nguyên.
- **FR-002**: Khi `bo_show_search` tắt, API PHẢI từ chối `GET` và `SEARCH /items/<collection>` có từ khóa tìm kiếm khác
  rỗng (trong query string hoặc body của `SEARCH`), kể cả khi kèm `aggregate`, `groupBy`.
- **FR-003**: Khi `bo_show_search` tắt, `/graphql` PHẢI trả lỗi cho query `<collection>` và `<collection>_aggregated` có đối
  số `search` khác rỗng. Schema GraphQL (introspection, SDL) KHÔNG ĐƯỢC đổi.
- **FR-004**: Khi `bo_show_export` tắt, API PHẢI từ chối `GET /items/<collection>` và `GET /items/<collection>/<id>` có
  tham số `export` (mọi định dạng), và `POST /utils/export/<collection>`; không trả file, không tạo file. Tham số `export`
  trên request ghi tới `/items/<collection>` (`POST`, `PATCH`, `PATCH :id`, áp cho phần đọc lại kết quả) bị từ chối
  trước khi ghi (sửa khi analyze 2026-10-27, U1).
- **FR-005**: Khi `bo_show_import` tắt, API PHẢI từ chối `POST /utils/import/<collection>` trước khi ghi item nào.
  `POST /items/<collection>` không đổi.
- **FR-006**: Request bị chặn PHẢI nhận đúng lỗi mà người không có quyền đọc collection nhận hiện nay: HTTP 403,
  `errors[0].extensions.code` = `FORBIDDEN`, câu "You don't have permission to access collection "<collection>" or it
  does not exist. Queried in root." (khi chặn qua quan hệ: `Queried in "<path>"` của mức đó); GraphQL trả lỗi đó trong
  `errors`. Nhờ vậy người không có quyền không phân biệt được collection tồn tại và đang tắt cài đặt (sửa khi checklist
  2026-10-27, CHK009).
- **FR-007**: Chặn áp dụng cho mọi người gọi: admin, user thường, share, public, static token.
- **FR-008**: Giá trị null hoặc không có cột PHẢI được hiểu là bật (như FR-007 của 022).
- **FR-009**: Chỉ chặn ở lớp HTTP (REST, GraphQL) của Backoffice. Flow, extension (kể cả endpoint HTTP của extension
  đọc `search` từ request của nó, và hook), service nội bộ đọc, import, export KHÔNG ĐƯỢC bị chặn; file port nguyên văn
  từ Directus giữ nguyên (sửa khi checklist 2026-10-27, CHK026).
- **FR-010**: Collection hệ thống không bị chặn.
- **FR-011**: Request không bị chặn PHẢI giống Directus 11.17.4 (status, body, header), kể cả khi collection tắt cài đặt
  khác (ví dụ đọc không từ khóa trên collection tắt tìm kiếm). Ngoại lệ duy nhất là header cache của FR-012 (D-188.4).
- **FR-012**: Request bị chặn KHÔNG ĐƯỢC nhận response từ response cache dùng chung với Directus, và KHÔNG ĐƯỢC ghi vào
  cache. Để giữ điều này cho GraphQL (cache được đọc trước khi parse document), khi có ít nhất một collection tắt tìm
  kiếm, Backoffice không đọc cache cho document GraphQL có từ `search` (vẫn ghi khi không lỗi); body giống hệt, chỉ
  header cache khác (MISS, `Cache-Control` TTL đầy đủ; D-188.4). Không collection nào tắt tìm kiếm thì cache như
  Directus (sửa khi plan 2026-10-27, research R3; thu hẹp khi checklist 2026-10-27, CHK023; giới hạn ghi `ponytail:`
  trong code).
- **FR-013**: Đổi cài đặt (ở Backoffice hay Directus) PHẢI có tác dụng từ request gửi sau khi lưu xong, trên mọi replica
  Backoffice. Backoffice đọc ba cài đặt từ cache schema trong process của mỗi replica, xóa theo bus `schemaChanged` như
  SchemaOverview (002), nên lưu collection ở app nào cũng được (cả hai app xóa cache hệ thống và phát `schemaChanged`
  trên bus dùng chung); sửa thẳng bằng SQL thì phải xóa cache như mọi thay đổi schema (clarify 2026-10-27, câu 3; câu
  chữ sửa khi plan 2026-10-27, research R1).
- **FR-014**: Web: DrawerCollection PHẢI theo `bo_show_search` của collection đích như trang Content (FR-003, FR-004 của
  022): ẩn ô nhập từ khóa, giữ nút bộ lọc, không gửi từ khóa lấy từ preset, bookmark; preset giữ nguyên. Sửa FR-009 của
  022. Drawer mà extension dùng (qua shim của spec 020) theo cùng quy tắc. Interface `list-o2m`, `list-m2m` có tùy chọn
  "Search Filter" (`enableSearchFilter`) PHẢI ẩn ô nhập từ khóa khi collection nhận từ khóa tắt `bo_show_search` (bộ lọc
  giữ nguyên): `list-o2m` là collection liên quan, `list-m2m` là collection trung gian (request có `search` đi tới
  collection trung gian; sửa khi plan 2026-10-27, research R5); tùy chọn của interface không đổi (clarify 2026-10-27,
  câu 2).
- **FR-015**: Không thêm bảng, cột, migration; không sửa `directus/`. Directus 11.17.4 chạy cùng DB không đổi hành vi.
- **FR-016**: Tài liệu (quickstart của 024, `deploy/README` hoặc migration-guide) PHẢI ghi: tắt toggle là ẩn giao diện và
  chặn API Backoffice; ở shared-domain request tới Directus không bị chặn. (026: không còn; gọi thẳng domain Directus không bị chặn.)
- **FR-017**: Ngoài FR-002, FR-003, mọi từ khóa tìm kiếm khác rỗng nhắm vào collection tắt `bo_show_search` qua HTTP
  của Backoffice PHẢI bị từ chối như FR-006, gồm: `GET /items/<collection>/<id>`; `PATCH`, `DELETE /items/<collection>`
  theo query (body `query.search`); `search` trong query string của request ghi tới `/items/<collection>` (`POST`,
  `PATCH`, `PATCH :id`, áp cho phần đọc lại kết quả), từ chối trước khi ghi (sửa khi checklist 2026-10-27, CHK014); `_search` trong `deep` của REST khi collection đích của quan hệ tắt tìm kiếm; đối số
  `search` ở mọi field GraphQL (kể cả field quan hệ lồng) có collection đích tắt tìm kiếm; body query của
  `POST /utils/export/<collection>` (kể cả khi `bo_show_export` bật) (chủ dự án 2026-10-27). Mutation GraphQL
  `create_<collection>_items`, `update_<collection>_items` nhận đối số `search` (kế thừa đối số của query đọc, áp cho
  phần đọc lại kết quả): có `search` khác rỗng trên collection tắt tìm kiếm thì PHẢI bị từ chối trước khi ghi, không
  tạo, không sửa item nào (clarify 2026-10-27, câu 1).
- **FR-018**: Test: unit cho từng đường chặn và đường không chặn; bộ đối chiếu `items`, `utils`, `graphql` ghi khác biệt
  D-188 (Directus 200, Backoffice 403) và giữ mọi request khác giống Directus, với admin, user thường, share, public và
  static token; bộ đối chiếu cho endpoint hệ thống có từ khóa qua quan hệ tới collection tắt tìm kiếm (`GET /users` với
  `deep._search`, field lồng của `/graphql/system`; Nguyên tắc V); case đổi cài đặt ở Directus rồi gọi Backoffice mà
  không xóa cache tay (FR-013); case response cache do Directus ghi trước; case flow và extension (sửa khi analyze
  2026-10-27, C1, G1, G2); E2E Content và DrawerCollection ba cấu hình (proxy tới Directus, proxy tới API mới, cross-site)
  với admin và user thường; đảo bước API của `apps/web-e2e/src/content-collection-toggles.spec.ts` (đang chờ 200 theo
  FR-008 của 022).

### Key Entities

- **Cài đặt hiển thị của collection** (spec 022, dòng `directus_collections`): `bo_show_search`, `bo_show_import`,
  `bo_show_export`, boolean, mặc định `true`, null = bật. Không đổi dữ liệu; nay điều khiển cả API.
- **Request bị chặn**: request HTTP tới Backoffice vào một trong các đường ở FR-002..FR-005, FR-017 trên collection tắt
  cài đặt tương ứng; nhận 403 `FORBIDDEN`, không đọc cache, không ghi cache, không đổi dữ liệu.

### Đánh giá hiện trạng và chạy song song với Directus 11.17.4

Đọc code ngày 2026-10-27, chưa chạy thử. Mục ghi [Inference] là suy ra từ code, plan PHẢI có test xác nhận.

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Test E2E theo FR-008 của 022 | Bước "the API still searches and exports" chờ 200 cho `?search=`, `?export=csv` trên `bo_content` | `apps/web-e2e/src/content-collection-toggles.spec.ts:143-157` |
| 2 | Đọc items REST | `SEARCH` và `GET :collection` dùng chung `readHandler`; `GET :collection/:pk` riêng | `apps/api/src/controllers/items.controller.ts:77-120` |
| 3 | Tham số `export` | Xử lý trong `respond` (json, csv, csv_utf8, xml, yaml) cho mọi route gọi `respond`; không ghi cache khi có `export` | `apps/api/src/middleware/respond.ts:39-44`, `:78-110` |
| 4 | Import, export chạy nền | `POST /utils/import/:collection`, `POST /utils/export/:collection` | `apps/api/src/controllers/utils.controller.ts:121`, `:169` |
| 5 | Từ khóa rỗng | Chuỗi rỗng bị bỏ; chuỗi chỉ khoảng trắng giữ nguyên | `apps/api/src/utils/sanitize-query.ts:77-80` |
| 6 | Đường tìm kiếm khác | `PATCH`, `DELETE /items/:collection` theo `query` trong body; `deep` qua `sanitizeDeep` | `apps/api/src/controllers/items.controller.ts:161`, `:221`; `apps/api/src/utils/sanitize-query.ts:96-99` |
| 7 | GraphQL | Đối số `search` ở query collection, `_aggregated` và field quan hệ; mutation `create_*_items`, `update_*_items` kế thừa đối số của query đọc nên cũng nhận `search` | `apps/api/src/services/graphql/schema/read.ts:673`, `:702`, `:799`; `write.ts:58-60` |
| 7.1 | Chỗ khác ở web gửi `search` lên collection người dùng | `list-o2m`, `list-m2m` với tùy chọn `enableSearchFilter`; `collection-item-dropdown`, panel `list`, trang share không gửi | `apps/web/src/interfaces/list-o2m/ListO2M.vue:68`, `:163`; `apps/web/src/composables/use-relation-multiple.ts:407`, `:486` |
| 7.2 | Xóa cache khi lưu collection | Cả hai app xóa cache hệ thống và phát `schemaChanged` trên bus dùng chung | `apps/api/src/cache.ts:102-121`, `apps/api/src/services/collections.service.ts:249` |
| 8 | Response cache | Kiểm cache cho GET và `/graphql` chạy trước mọi route; key giống Directus (005), nên [Inference] response do Directus ghi có thể được trả trước khi tới bước chặn | `apps/api/src/app-pipeline.ts:167`, `apps/api/src/middleware/cache.ts:19-28` |
| 9 | Đọc cài đặt | SchemaOverview chỉ chọn 5 cột của `directus_collections`, không có `bo_show_*` | `directus/api/src/utils/get-schema.ts:129-131` |
| 10 | DrawerCollection | Lấy từ khóa từ preset và luôn hiện ô tìm kiếm; drawer của shim dùng lại component này | `apps/web/src/components/drawers/DrawerCollection.vue:60`, `:204`; `apps/web/src/directus-shim/components/DrawerCollection.vue:6` |
| 11 | Content (022) | `showSearch`, `activeSearch` theo `bo_show_search !== false` | `apps/web/src/modules/content/routes/CollectionRoute.vue:140-144` |
| 12 | Lb chế độ shared-domain | `api_pool` có `directus:8055` | `deploy/compose/lb/shared-domain.conf:12` (026: bỏ) |

**Kết luận** [Inference]: Directus không phải làm gì; DB, Redis, file không đổi. Directus vẫn trả 200 cho request mà
Backoffice chặn, nên ở shared-domain việc chặn không đủ. (026: lb không còn gửi tới Directus.)

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021–023).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-188 | Tìm kiếm trên collection tắt `bo_show_search` (REST `search`, body `query.search`, `deep._search`, GraphQL `search` kể cả field quan hệ, kể cả đi từ endpoint hệ thống `/users`, `/graphql/system`) | 200, tìm như thường | REST 403 `FORBIDDEN` cho mọi người gọi, kể cả admin; GraphQL HTTP 200 với `errors[].extensions.code = FORBIDDEN` cho field đó, field khác vẫn có dữ liệu; schema GraphQL không đổi; đường ghi (`PATCH`/`DELETE` theo query, `?search=` trên request ghi, mutation) từ chối trước khi ghi, không đổi dữ liệu. Ở shared-domain request rơi vào Directus vẫn 200 (không thêm định tuyến ở lb); Directus app ở cấu hình proxy tới API mới nhận 403 | Yêu cầu chủ dự án 2026-10-27 (026: câu "Ở shared-domain" không còn áp dụng) | khác (duyệt 2026-10-27) | — |
| D-188.1 | Export trên collection tắt `bo_show_export` (`export` của `/items`, `POST /utils/export`) | 200, trả hoặc tạo file | 403 `FORBIDDEN`, không trả, không tạo file | Yêu cầu chủ dự án 2026-10-27 | khác (duyệt 2026-10-27) | — |
| D-188.2 | Import trên collection tắt `bo_show_import` (`POST /utils/import`) | 200, nhập item | 403 `FORBIDDEN`, không nhập item | Yêu cầu chủ dự án 2026-10-27 | khác (duyệt 2026-10-27) | — |
| D-188.3 | Drawer chọn item và ô "Search Filter" của `list-o2m`, `list-m2m` với collection tắt `bo_show_search` | Luôn có ô tìm kiếm | Ẩn ô nhập từ khóa, giữ nút bộ lọc, không gửi từ khóa của preset (sửa FR-009 của 022) | Hệ quả của D-188, chủ dự án 2026-10-27 | khác (duyệt 2026-10-27) | — |
| D-188.4 | Header cache của document GraphQL có từ `search` khi có ít nhất một collection tắt tìm kiếm | Đọc response cache (HIT, `Cache-Control` TTL còn lại) | Không đọc cache (MISS, `Cache-Control` TTL đầy đủ); body giống hệt; vẫn ghi cache khi không lỗi | Giữ FR-012 (cache đọc trước khi parse document), sửa khi checklist 2026-10-27 CHK003 | khác (duyệt 2026-10-27) | — |

**Cần xác nhận**:

- Không có (D-188.4 và câu thông báo của FR-006 duyệt 2026-10-27 cùng D-188..D-188.3).

## Clarifications

### Session 2026-10-27 (chủ dự án, trước `/speckit.specify`)

- Q: Ở shared-domain lb có Directus trong pool, request rơi vào Directus không bị chặn. Xử lý? → A: chấp nhận như 023,
  không thêm định tuyến ở lb, ghi giới hạn vào spec (D-188, FR-016). (026: không còn.)
- Q: FR-009 của 022 giữ ô tìm kiếm trong DrawerCollection; API chặn thì drawer lỗi. Chọn? → A: drawer theo cài đặt
  (FR-014, D-188.3).
- Q: Admin có bị chặn không? → A: có, như FR-006 của 022 (FR-007).
- Q: Mã lỗi? → A: 403 `FORBIDDEN` (FR-006).
- Q: Chặn ở lớp nào? → A: chỉ HTTP; flow, extension, service nội bộ không bị chặn (FR-009).
- Q: GraphQL? → A: chặn đối số `search`, schema không đổi (FR-003).
- Q: Nhãn ba toggle? → A: giữ nguyên, không thêm migration (FR-001, FR-015).

### Session 2026-10-27 (chủ dự án, `/speckit.specify`)

- Q: Ngoài `GET`/`SEARCH /items/:collection`, GraphQL cấp gốc và `/utils/import`, `/utils/export`, còn từ khóa ở
  `GET :id`, `PATCH`/`DELETE` theo query, `deep._search`, field quan hệ GraphQL, body query của `/utils/export`. Chặn thế
  nào? → A: chặn mọi đường (FR-017, US1 kịch bản 6, D-188).

### Session 2026-10-27 (chủ dự án, `/speckit.clarify`)

- Q: Mutation GraphQL `create_<A>_items`, `update_<A>_items` nhận đối số `search` (áp cho phần đọc lại kết quả). Khi A tắt
  tìm kiếm và mutation có `search` khác rỗng thì xử lý sao? → A: từ chối trước khi ghi: 403 `FORBIDDEN`, không tạo, không
  sửa item nào (FR-017).
- Q: Interface `list-o2m`, `list-m2m` có tùy chọn "Search Filter" gửi `search` lên collection liên quan; collection đó tắt
  tìm kiếm thì người dùng nhận 403. Xử lý ở web? → A: ẩn ô nhập từ khóa theo cài đặt của collection liên quan, giữ bộ lọc,
  cùng quy tắc với DrawerCollection (FR-014, US4 kịch bản 4, D-188.3).
- Q: FR-013: Backoffice đọc ba cài đặt thế nào để đổi ở app nào cũng có tác dụng trên mọi replica? → A: từ cache hệ thống
  dùng chung, xóa theo `schemaChanged` như mọi meta collection; sửa thẳng SQL thì xóa cache (FR-013, Edge Cases).
### Sửa câu chữ khi `/speckit.plan` (2026-10-27, research.md R11)

- FR-012: GraphQL không đọc cache cho document có từ `search`. FR-013: cache schema trong process, xóa theo bus. FR-014:
  `list-m2m` theo collection trung gian. D-188: GraphQL 200 với `errors` FORBIDDEN. Assumptions: resolver riêng của scope
  system, REST endpoint hệ thống có `deep`.

### Duyệt 2026-10-27 (chủ dự án kiêm tech lead)

- D-188, D-188.1, D-188.2, D-188.3, D-188.4 và câu lỗi quyền collection của FR-006 (checklist CHK009): duyệt sau
  `/speckit.plan` và checklist api-compat, trước `/speckit.tasks`.

### Sửa khi `/speckit.checklist` api-compat (2026-10-27, checklists/api-compat.md)

- D-188: đường ghi không đổi dữ liệu (CHK002). D-188.4 mới: header cache GraphQL (CHK003, CHK023). FR-006: câu của lỗi
  quyền collection (CHK009). FR-009: endpoint HTTP của extension (CHK026). FR-011: ngoại lệ D-188.4. FR-012: chỉ khi có
  collection tắt tìm kiếm. FR-017: `?search=` trên request ghi (CHK014). Edge Cases: export qua quan hệ (CHK016).
  contracts/tests.md: share, extension, `/users?deep` chỉ unit (CHK027–CHK029).

### Sửa khi `/speckit.analyze` (2026-10-27)

- C1 (Nguyên tắc V): endpoint hệ thống có từ khóa qua quan hệ tới collection tắt tìm kiếm (`GET /users` với
  `deep._search`, field lồng của `/graphql/system`) có test đối chiếu, không chỉ unit (FR-018, Assumptions, D-188; đảo
  checklist CHK029). G1: case đổi cài đặt ở Directus không xóa cache tay (FR-018, SC-001). I1: Assumptions dùng câu lỗi
  quyền collection. G2: public và static token (FR-018, SC-001). U1: `export` trên request ghi (FR-004). I2: bảng
  khác biệt liền một khối.

- Rà khi clarify (không hỏi): share và public đã bị chặn theo FR-007, trang share của web không gửi `search`; mutation
  GraphQL nhận `search` do kế thừa đối số của query đọc (`apps/api/src/services/graphql/schema/write.ts:58-60`);
  interface `collection-item-dropdown` và panel `list` không gửi `search`.

## Assumptions

- Cài đặt là cấu hình của từng collection, không phải permission: không vào bảng quyền, không đổi `/permissions/me`.
- Lỗi chặn dùng câu của lỗi quyền collection (FR-006), nên client hiện có xử lý như lỗi quyền (sửa khi analyze
  2026-10-27, I1).
- Người dùng gọi qua lb shared-domain có thể không bị chặn; muốn chắc chắn thì dùng standalone hoặc separate-domain. (026: ở domain Backoffice luôn tới BE.)
- Bước kiểm tra cài đặt thêm vào mỗi request đọc items; chi phí nhỏ so với truy vấn DB [Inference], đo bằng benchmark
  hiện có.
- Resolver riêng của scope `/graphql/system` (`users_me`, `server_specs`...) không kiểm `deep` vào collection người dùng
  qua quan hệ do admin tự thêm; REST endpoint hệ thống (`/users`, `/files`...) có `deep._search` và field lồng của
  query collection hệ thống trên `/graphql/system` (`users { <quan hệ>(search: ...) }`) vào collection người dùng thì có
  kiểm và có test đối chiếu (sửa khi plan 2026-10-27, research R2, R4; test đối chiếu thêm khi analyze 2026-10-27, C1).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sau khi admin lưu cài đặt tắt (ở Backoffice hay Directus, không xóa cache tay), 100% request ở US1–US3 gửi
  tới Backoffice từ lúc đó nhận 403 `FORBIDDEN`, ở mọi replica, cho admin, user thường, share, public và static token
  (sửa khi analyze 2026-10-27, G1, G2).
- **SC-002**: 0 test đối chiếu, blackbox và E2E hiện có đổi kết quả khi mọi collection bật cài đặt, trừ bước API của
  `content-collection-toggles.spec.ts` được đảo theo spec này.
- **SC-003**: 0 response từ cache lọt cho request bị chặn trong case Directus ghi cache trước.
- **SC-004**: 100% case flow và extension trên collection tắt cài đặt chạy như khi bật.
- **SC-005**: Trên 100% lượt E2E (ba cấu hình × admin và user thường), drawer chọn item của collection tắt tìm kiếm không
  có ô nhập từ khóa, tải danh sách không lỗi, nút bộ lọc dùng được bằng bàn phím.
- **SC-006**: Scenario benchmark hiện có của Backoffice không tệ hơn Directus quá 10% (Nguyên tắc X).
