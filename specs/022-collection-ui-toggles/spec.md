# Feature Specification: Ẩn hiện ô tìm kiếm, Import, Export theo collection và migration riêng của Backoffice

**Feature Branch**: `022-collection-ui-toggles` (làm trên `main` như 012–021, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=022-collection-ui-toggles`)
**Created**: 2026-10-26
**Status**: Planned (10 câu hỏi đã chốt với chủ dự án 2026-10-26; constitution 3.2.0 đã sửa 2026-10-26; D-179..D-181
duyệt 2026-10-26, chủ dự án kiêm tech lead)
**Input**: User description: "hỗ trợ tôi viết speckit làm tính năng mở rộng cho backoffice, với chức năng thêm 2 trường
mới vào directus_collections để cấu hình ẩn hiện khung search và ẩn hiện nút inport export, thêm xem có thể chạy song
song với directus cũ"

**Điều kiện trước `/speckit.plan`** (Governance):

- Constitution 3.2.0 (MINOR), đã sửa 2026-10-26 theo yêu cầu chủ dự án (kiêm tech lead), commit cùng spec này:
  - Nguyên tắc II hiện cấm "thêm bảng, cột hay migration hệ thống riêng của Backoffice". Thêm ngoại lệ: Backoffice ĐƯỢC
    có bảng hệ thống `backoffice_migrations` và migration riêng ghi vào bảng đó; migration riêng ĐƯỢC thêm cột tiền tố
    `bo_` vào bảng `directus_*` và dòng `directus_fields` của các cột đó; KHÔNG ĐƯỢC ghi `directus_migrations`. D-145
    (021) sửa: migration riêng chạy trên mọi vendor.
  - Nguyên tắc VII ("bootstrap không có lock, như Directus"): thêm ngoại lệ, migration riêng chạy dưới lock.
- Khác biệt so với Directus D-179, D-180, D-181: chủ dự án kiêm tech lead duyệt 2026-10-26 (sau `/speckit.plan`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin ẩn ô tìm kiếm của một collection (Priority: P1)

Admin mở Settings > Data Model > một collection, tắt "Hiện ô tìm kiếm" rồi lưu. Mọi người dùng, kể cả admin, mở
collection đó trong Content không còn thấy ô nhập từ khóa ở page header; nút bộ lọc vẫn còn và mở bộ lọc như hiện nay.

**Why this priority**: một trong các yêu cầu chính; collection ít dòng hoặc chỉ xem theo bộ lọc không cần tìm kiếm.

**Independent Test**: tắt cài đặt trên collection `bo_content`, mở `/content/bo_content` bằng admin và bằng user thường:
không có ô nhập từ khóa, nút bộ lọc vẫn dùng được; collection khác vẫn có ô tìm kiếm.

**Acceptance Scenarios**:

1. **Given** collection A có "Hiện ô tìm kiếm" tắt, **When** admin hay user thường mở `/content/A`, **Then** page header
   không có ô nhập từ khóa và vẫn có nút bộ lọc, có số bộ lọc đang bật.
2. **Given** như trên, **When** người dùng bấm nút bộ lọc, thêm một điều kiện, **Then** danh sách lọc như hiện nay.
3. **Given** collection A có "Hiện ô tìm kiếm" tắt và bookmark của A có từ khóa, **When** người dùng mở bookmark, **Then**
   danh sách không lọc theo từ khóa đó, bộ lọc của bookmark vẫn áp dụng và bookmark không bị sửa.
4. **Given** admin bật lại cài đặt, **When** người dùng tải lại trang, **Then** ô tìm kiếm hiện lại như hiện nay.

---

### User Story 2 - Admin ẩn Import, Export của một collection (Priority: P1)

Admin tắt riêng "Hiện Import" hoặc "Hiện Export" cho một collection. Detail panel của trang Content collection đó không
còn phần tương ứng. Tắt cả hai thì không còn mục Import/Export.

**Why this priority**: yêu cầu chính; tránh nhập hay xuất hàng loạt từ màn hình không dành cho việc đó.

**Independent Test**: trên `bo_content`, tắt lần lượt Import, Export, cả hai; mở detail panel bằng admin và user thường.

**Acceptance Scenarios**:

1. **Given** "Hiện Import" tắt, "Hiện Export" bật, **When** mở detail panel, **Then** mục Import/Export chỉ có nút Export
   và link tải CSV của trang hiện tại; không có chọn file, tùy chọn chạy nền, nút Import.
2. **Given** "Hiện Export" tắt, "Hiện Import" bật, **When** mở detail panel, **Then** mục chỉ có phần Import; không có
   nút Export và link tải CSV của trang hiện tại.
3. **Given** cả hai tắt, **When** mở detail panel, **Then** không có mục Import/Export; layout, archive, refresh, flows
   giữ nguyên thứ tự.
4. **Given** cài đặt tắt, **When** người dùng có quyền gọi thẳng API import, export của A, **Then** API chạy như Directus
   (FR-008).

---

### User Story 3 - Migration riêng của Backoffice, tự chạy khi khởi động (Priority: P1)

Backoffice có bộ migration riêng, ghi vào bảng hệ thống `backoffice_migrations`, không ghi `directus_migrations`. Mỗi lần
container Backoffice khởi động, `bootstrap` chạy migration Directus như hiện nay (Postgres, SQLite) rồi chạy migration
riêng còn thiếu, trên mọi vendor, dưới một lock. Migration đầu tiên thêm ba cột vào `directus_collections` và định nghĩa
trường để form có nhãn. Về sau thêm migration chỉ là thêm file. Không có lệnh CLI riêng.

**Why this priority**: US1, US2 cần ba cột; chủ dự án cần nhiều migration riêng về sau.

**Independent Test**: profile `bootstrap` (DB trống) và DB parity hiện có: khởi động Backoffice, kiểm tra ba cột, dòng
định nghĩa trường, dòng `backoffice_migrations`, `directus_migrations` không đổi; khởi động ba replica cùng lúc.

**Acceptance Scenarios**:

1. **Given** DB chưa có bảng `backoffice_migrations`, **When** container Backoffice khởi động, **Then** bảng được tạo, ba
   cột có, mọi dòng `directus_collections` hiện có là mặc định (hiện), `directus_migrations` không đổi.
2. **Given** DB MySQL, MSSQL, Oracle hay CockroachDB do Directus cài và migrate, **When** container Backoffice khởi động,
   **Then** migration riêng chạy như trên Postgres; người vận hành không làm gì thêm.
3. **Given** ba cột đã có (ví dụ do schema apply tạo), **When** migration chạy, **Then** không lỗi và không tạo trùng.
4. **Given** ba replica khởi động cùng lúc trên DB chưa migrate, **When** `bootstrap` chạy, **Then** chỉ một replica chạy
   migration, các replica khác chờ rồi thấy migration đã xong; không replica nào ghi trùng.
5. **Given** DB chưa chạy đủ migration riêng, **When** chỉ chạy `start` (không `bootstrap`), **Then** API dừng và báo
   migration riêng thiếu, giống migration Directus thiếu.
6. **Given** DB chưa cài hoặc còn thiếu migration Directus (vendor ngoài Postgres, SQLite, Directus chưa migrate xong),
   **When** container Backoffice khởi động, **Then** migration riêng không chạy và Backoffice báo lỗi giống hiện nay
   (spec 021).

---

### User Story 4 - Chạy song song với Directus 11.17.4 trên cùng DB (Priority: P1)

Sau migration, Directus 11.17.4 chạy cùng DB vẫn khởi động, đăng nhập, đọc và sửa collection, tạo collection mới,
snapshot/diff/apply, migrate như trước, không cần file hay cấu hình mới. Directus app hiện ba cài đặt trong form
collection như mọi trường khác; Content của Directus app vẫn hiện ô tìm kiếm và Import/Export.

**Why this priority**: Nguyên tắc II và IV; Directus hỏng thì không triển khai được chế độ chạy chung.

**Independent Test**: profile parity sau migration, chạy lại bộ đối chiếu và blackbox collections/fields/schema với cả
hai app; mở Directus app, sửa một collection, tạo một collection mới.

**Acceptance Scenarios**:

1. **Given** migration riêng đã chạy, **When** Directus 11.17.4 khởi động, **Then** Directus chạy bình thường mà không cần
   file, biến môi trường hay cấu hình nào mới.
2. **Given** migration riêng đã chạy, **When** gọi `GET /collections` ở Directus và ở Backoffice, **Then** hai response
   giống nhau trừ dòng `backoffice_migrations` (D-181); `meta` của mọi collection có ba khóa mới.
3. **Given** migration riêng đã chạy, **When** tạo collection bằng Directus app, **Then** ba cài đặt nhận mặc định (hiện).
4. **Given** migration riêng đã chạy, **When** admin đổi cài đặt trong Directus app, **Then** Backoffice áp dụng giá trị
   mới.
5. **Given** migration riêng đã chạy, **When** chạy `migrate:latest`, `migrate:up`, `migrate:down` của Directus, **Then**
   kết quả như DB chưa có migration riêng, vì `directus_migrations` không có dòng của Backoffice.
6. **Given** migration riêng đã chạy, **When** admin mở Data Model, **Then** Backoffice không liệt kê
   `backoffice_migrations` (khóa hiển thị D-118 của nó trùng với `directus_migrations`; sửa khi implement lượt 3,
   2026-10-26), còn Directus app liệt kê nó trong nhóm bảng chưa quản lý (meta null).

---

### Edge Cases

- Giá trị null được hiểu là hiện.
- Collection hệ thống (`directus_*`, `backoffice_*`) và collection folder không có trang Content; Files, Users,
  Activity, Settings không đổi.
- DrawerCollection (chọn item liên quan) vẫn có ô tìm kiếm, kể cả khi collection đích tắt cài đặt.
- Cài đặt đổi khi người dùng đang mở trang: áp dụng ở lần tải collections tiếp theo.
- Ẩn ô nhập từ khóa không để lại khoảng trống hay điểm focus thừa; nút bộ lọc vẫn có tên đọc được cho screen reader.
- Admin Directus bấm cấu hình `backoffice_migrations` trong Data Model của Directus app: bảng có dòng
  `directus_collections`; Backoffice vẫn coi nó là collection hệ thống; migration riêng chạy lại PHẢI không lỗi (FR-014).
- Admin Directus xóa bảng `backoffice_migrations` (Data Model của Directus app, hoặc `DELETE
  /collections/backoffice_migrations` ở Directus; Backoffice từ chối lệnh này, D-181): replica đang chạy không ảnh
  hưởng; `start` của Backoffice sau đó báo thiếu migration riêng (FR-016); `bootstrap` lần sau tạo lại bảng và chạy
  lại migration (FR-014). Test đối chiếu KHÔNG ĐƯỢC gửi lệnh xóa này tới Directus trên DB dùng chung.
- Replica giữ lock bị dừng giữa chừng: lock hết hạn, replica sau chạy lại migration còn thiếu (FR-014 cho phép chạy lại).
- Replica chờ lock quá lâu (redlock thử 100 lần cách 50 ms, `libs/memory/src/kv/lib/redis.ts:72-74`): `bootstrap` dừng
  với lỗi, container khởi động lại, lần sau thấy migration đã xong [Inference].
- Rollback: không có lệnh down; muốn gỡ thì làm tay trên DB (xóa cột, dòng `directus_fields`, dòng
  `backoffice_migrations`), ghi trong quickstart.
- Nâng Directus lên bản sau 11.17.4: kiểm tra lại không có cột `bo_*` hay bảng `backoffice_*` trùng tên [Inference: hiện
  Directus không dùng các tên này].

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Mỗi collection PHẢI có ba cài đặt trong dòng `directus_collections`: "Hiện ô tìm kiếm", "Hiện Import",
  "Hiện Export", bật/tắt, mặc định bật.
- **FR-002**: Admin PHẢI sửa được ba cài đặt trong form collection của Settings > Data Model, cùng chỗ với các tùy chọn
  collection khác, nhãn en-US và vi-VN (không có ghi chú: `directus_fields.note` là một chuỗi, không dịch được cho cả
  hai app; sửa khi plan 2026-10-26). Ở app web Backoffice, ba cài đặt nằm trong một card có tiêu đề "Content: Search,
  Import, Export" / "Content: tìm kiếm, Import, Export" (D-182, chủ dự án 2026-10-26).
- **FR-003**: Khi "Hiện ô tìm kiếm" tắt, trang Content của collection KHÔNG ĐƯỢC hiện ô nhập từ khóa và PHẢI giữ nút bộ
  lọc (cùng popover, cùng badge số bộ lọc).
- **FR-004**: Khi "Hiện ô tìm kiếm" tắt, trang KHÔNG ĐƯỢC gửi từ khóa lấy từ preset, bookmark hay URL; preset giữ
  nguyên; bộ lọc vẫn áp dụng.
- **FR-005**: Khi "Hiện Import" tắt, mục Import/Export KHÔNG ĐƯỢC có phần import (chọn file, chạy nền, nút Import). Khi
  "Hiện Export" tắt, mục KHÔNG ĐƯỢC có nút Export và link tải CSV của trang hiện tại. Cả hai tắt thì không có mục.
- **FR-006**: Cài đặt áp dụng cho mọi người dùng, kể cả admin.
- **FR-007**: Giá trị null được hiểu là bật.
- **FR-008**: Ba cài đặt chỉ là giao diện. API (`search`, `export`, `/utils/import`, `/utils/export`) KHÔNG ĐƯỢC đổi;
  quyền vẫn do permission quyết định (Nguyên tắc III).
- **FR-009**: Phạm vi là trang collection của module Content trong Backoffice web. DrawerCollection, module khác và
  Directus app không đổi.
- **FR-010**: Directus 11.17.4 chạy cùng DB đã migrate PHẢI làm được mọi việc như trước: khởi động, đăng nhập, đọc,
  tạo, sửa, xóa collection, snapshot/diff/apply, `migrate:latest|up|down`; không cần file, biến môi trường hay cấu hình
  mới.
- **FR-011**: Với cùng DB, `GET /collections`, `GET /fields/directus_collections` và GraphQL tương ứng của Backoffice
  PHẢI giống Directus, trừ collection `backoffice_migrations` (D-181) (đối chiếu ở proxy-api).
- **FR-012**: Backoffice PHẢI có bộ migration riêng: file trong thư mục riêng (không chung thư mục 101 migration port từ
  Directus), trạng thái trong bảng `backoffice_migrations` (`version`, `name`, `timestamp`, cùng dạng
  `directus_migrations`). Backoffice KHÔNG ĐƯỢC ghi hay xóa dòng nào trong `directus_migrations`.
- **FR-013**: `bootstrap` (và `init`, vì `init` tự cài DB rồi `start`; sửa khi analyze 2026-10-26) PHẢI tạo
  `backoffice_migrations` nếu chưa có rồi chạy mọi migration riêng chưa chạy, theo thứ tự version, sau khi migration
  Directus đã đủ, trên mọi vendor (sửa D-145: Backoffice vẫn chỉ cài và migrate Directus trên Postgres, SQLite).
  Migration Directus chưa đủ thì không chạy migration riêng. Không có lệnh CLI riêng; `database install`,
  `database migrate:*` không chạy migration riêng (output giữ giống Directus).
- **FR-014**: Mỗi migration riêng PHẢI có `up` chỉ dùng knex, chạy được trên 7 vendor, chạy lại được trên DB đã có thay
  đổi của nó (bỏ qua bảng, cột, dòng đã có). Không có `down`.
- **FR-015**: Migration riêng PHẢI chạy dưới lock dùng chung (Redis khi có cấu hình Redis, trong process khi không có):
  mỗi lúc chỉ một process chạy; process khác chờ lock rồi đọc lại `backoffice_migrations`.
- **FR-016**: Khởi động API (`start`) PHẢI kiểm tra mọi migration riêng đã chạy; thiếu thì dừng và báo rõ, giống
  migration Directus thiếu. Dòng lạ trong `backoffice_migrations` (DB của bản Backoffice mới hơn) cũng dừng và báo rõ.
- **FR-017**: Backoffice PHẢI coi `backoffice_migrations` là collection hệ thống như `directus_migrations`: có trong danh
  sách collection hệ thống của API (meta hệ thống, ẩn), không truy cập được qua `/items`, ngoài
  `crudSafeSystemCollections` như `directus_migrations`, không có trong danh sách của Data Model (sửa khi implement lượt
  3, 2026-10-26: khóa hiển thị D-118 trùng với `directus_migrations`), `/content/backoffice_migrations` là not found,
  không vào snapshot.
- **FR-018**: Tên cột Backoffice thêm vào bảng `directus_*` PHẢI có tiền tố `bo_`; tên bảng riêng PHẢI có tiền tố
  `backoffice_`.
- **FR-019**: Test: unit cho ẩn hiện và bộ chạy migration (SQLite); E2E Content ba cấu hình (proxy tới Directus, proxy
  tới API mới, cross-site) với admin và user thường, gồm bước bàn phím (Tab tới nút bộ lọc, Enter mở popover, SC-004)
  và bước gọi API khi cài đặt tắt (`?search=`, `?export=` vẫn 200, FR-008); profile `bootstrap` (chạy migration, chạy
  lại, `start` không `bootstrap` dừng với thông điệp rồi `bootstrap` phục hồi; so dump với Directus bỏ qua
  `backoffice_migrations`, cột `bo_*` và dòng `directus_fields` của chúng); suite deploy (ba replica cùng lúc, một dòng
  mỗi migration; sửa khi analyze 2026-10-26); bộ đối chiếu và blackbox collections/fields/schema trên DB đã migrate (bỏ
  qua `backoffice_migrations`); vendor khác chạy hằng đêm.
  Quy tắc chuẩn hóa thêm vào FR-107 của 021 (sửa khi plan 2026-10-26): khi so output CLI và log `bootstrap`/`init` với
  Directus, bỏ các dòng của migration riêng (`Running Backoffice migrations...`, `Backoffice migrations are up to
  date`, `Applying <tên migration riêng>...`); khi so output `schema snapshot`, so snapshot đã parse và bỏ các field
  `bo_*` của bảng `directus_*` (snapshot của DB Backoffice có ba field này, D-180; thêm khi implement 2026-10-26).

### Key Entities

- **Cài đặt hiển thị của collection** (dòng `directus_collections`): thêm `bo_show_search`, `bo_show_import`,
  `bo_show_export`, boolean, mặc định `true`, cho phép null.
- **Định nghĩa trường** (ba dòng `directus_fields` của `directus_collections`): interface boolean, nhãn dịch en-US/vi-VN,
  độ rộng half. Cả Backoffice và Directus app đọc để vẽ form, nên API giữ giống nhau (FR-011).
- **Migration riêng của Backoffice** (bảng hệ thống `backoffice_migrations`): một dòng mỗi migration riêng đã chạy;
  Directus không đọc, không ghi. Migration đầu tiên `20261026A`: thêm ba cột và ba định nghĩa trường.

### Đánh giá chạy song song với Directus 11.17.4

Đọc code `directus/` ngày 2026-10-26; chưa chạy thử trên DB thật. Mục ghi [Inference] là suy ra từ code, plan PHẢI có
test xác nhận.

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Directus nạp schema từ `directus_collections` | Chỉ chọn `collection`, `singleton`, `note`, `sort_field`, `accountability`; cột thêm không ảnh hưởng schema cache và permission | `directus/api/src/utils/get-schema.ts:129-131` |
| 2 | `GET /collections` của Directus | Đọc `directus_collections` qua ItemsService không giới hạn field, nên `meta` có khóa mới [Inference] | `directus/api/src/services/collections.ts:319-329` |
| 3 | User thường đọc được cài đặt | Quyền app-access đọc `directus_collections` với `fields: ['*']` | `directus/packages/system-data/src/app-access-permissions/index.ts:10`, `schema-access-permissions.yaml:4` |
| 4 | Directus tạo hoặc sửa collection | ItemsService chỉ giữ field có trong schema; dòng mới lấy default của DB [Inference] | `directus/api/src/services/items.ts:218`, `:811` |
| 5 | Migration Directus (`migrate:latest`, `migrate:up`, `migrate:down`, kiểm tra lúc khởi động) | Chỉ đọc `directus_migrations`; Backoffice không ghi bảng này nên không đổi | `directus/api/src/database/index.ts:306-312`, `directus/api/src/database/migrations/run.ts` |
| 6 | Bảng `backoffice_migrations` trong API Directus | Bảng không có dòng `directus_collections` được trả về với `meta: null` (admin thấy, user thường không có quyền); khác Backoffice (D-181) | `directus/api/src/services/collections.ts:382-391` |
| 7 | Bảng `backoffice_migrations` trong Directus app | Data Model liệt kê bảng có schema mà không có meta (bảng chưa quản lý) | `directus/app/src/modules/settings/routes/data-model/collections/collections.vue:108` |
| 8 | Bảng `backoffice_migrations` trong snapshot | Directus bỏ vì `meta === null`; Backoffice bỏ vì là collection hệ thống | `directus/api/src/utils/get-snapshot.ts:59-61`, `:71-74` |
| 9 | Ba cột trong snapshot | Có dòng `directus_fields` nên vào snapshot như trường người dùng [Inference] | `directus/api/src/utils/get-snapshot.ts:59-61` |
| 10 | Directus app | Form collection vẽ mọi field của `directus_collections`, nên hiện ba cài đặt; Content của Directus app không đọc | `directus/app/src/modules/settings/routes/data-model/fields/fields.vue:138-144` |
| 11 | Trùng tên ở bản Directus sau | Directus không dùng tiền tố `bo_` hay `backoffice_` [Inference] | FR-018 |

**Kết luận** [Inference]: chạy song song được và không phải làm gì ở phía Directus: migration Directus, file, biến môi
trường giữ nguyên. Directus thấy ba cột (ba cài đặt trong form collection, không có tác dụng ở Content của Directus app)
và bảng `backoffice_migrations` trong danh sách bảng chưa quản lý của admin.

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-179 | Ô tìm kiếm trang Content | Luôn hiện | Ẩn ô nhập từ khóa khi `bo_show_search` tắt, giữ nút bộ lọc | Yêu cầu chủ dự án 2026-10-26 | khác (duyệt 2026-10-26) | — |
| D-179 | Import, Export trang Content | Luôn hiện | Ẩn phần import khi `bo_show_import` tắt; ẩn Export và link CSV khi `bo_show_export` tắt | Yêu cầu chủ dự án 2026-10-26 | khác (duyệt 2026-10-26) | — |
| D-179.1 | Directus app với ba trường | Không có | Hiện ba cài đặt trong form collection, không áp dụng ở Content của Directus app | Không sửa `directus/` (Nguyên tắc I) | khác (duyệt 2026-10-26) | — |
| D-180 | Migration riêng | Chỉ migration Directus và custom, trong `directus_migrations` | Bộ migration riêng trong `backoffice_migrations`, chạy trong `bootstrap` và `init` trên mọi vendor dưới lock; không có lệnh CLI | Clarifications 2026-10-26; constitution 3.2.0, sửa D-145 | khác (duyệt 2026-10-26) | — |
| D-181 | `backoffice_migrations` trong API | Bảng chưa quản lý: `GET /collections` trả `meta: null`, admin đọc được qua `/items`, có type trong `/graphql` và tag, path, schema trong `/server/specs/oas` (admin), Data Model liệt kê, `DELETE /collections/backoffice_migrations` xóa bảng | Collection hệ thống: meta hệ thống, ẩn, không truy cập qua `/items`, không có trong GraphQL (`SYSTEM_DENY_LIST` như `directus_migrations`, research T001) và OAS (không có tag hệ thống tĩnh), không có trong danh sách của Data Model (khóa hiển thị D-118 trùng với `directus_migrations`), xóa bị từ chối | Chủ dự án 2026-10-26: coi như bảng `directus_*` | khác (duyệt 2026-10-26) | — |
| D-182 | Tiêu đề nhóm ba cài đặt trong form collection | Ba cài đặt sau đường kẻ hệ thống (divider không tiêu đề) ở cuối form | Card riêng có tiêu đề "Content: Search, Import, Export" (vi-VN "Content: tìm kiếm, Import, Export"), icon `tune`; app web tự thêm divider, DB không có dòng divider (Nguyên tắc II chỉ cho dòng `directus_fields` của cột `bo_*`) | Chủ dự án 2026-10-26: card ba toggle cần tiêu đề, chỉ làm ở web | khác (duyệt 2026-10-26) | — |

**Cần xác nhận**:

- Không có.

## Clarifications

### Session 2026-10-26 (chủ dự án, `/speckit.specify`)

- Q: Các trường tạo bằng cách nào (A qua API fields, B migration riêng Backoffice, C API tự tạo khi khởi động)? → A: B,
  migration riêng Backoffice; kéo theo sửa Nguyên tắc II (constitution 3.2.0).
- Q: Tắt "Hiện ô tìm kiếm" thì ẩn những gì? → A: chỉ ẩn ô nhập từ khóa, vẫn hiện nút bộ lọc (FR-003).
- Q: Có cần bảng migration riêng không? → A: có; Backoffice sẽ có nhiều migration riêng và không đụng gì vào Directus
  cũ: không ghi `directus_migrations`, Directus không cần file hay cấu hình mới (FR-012..FR-016).
- Q: Admin có bị ẩn giống user thường không? → A: ẩn với mọi người, kể cả admin (FR-006).
- Q: Import và Export dùng một cài đặt hay hai? → A: hai cài đặt riêng, `bo_show_import` và `bo_show_export` (FR-001,
  FR-005).
- Q: DrawerCollection có theo cài đặt ẩn ô tìm kiếm không? → A: không, chỉ trang Content (FR-009).
- Q: Nhiều replica khởi động cùng lúc thì migration riêng chạy thế nào? → A: lock qua Redis (FR-015).
- Q: Tắt Export thì link tải CSV của trang hiện tại có ẩn không? → A: ẩn cả nút Export và link CSV (FR-005).
- Q: Migration riêng có lệnh CLI không? → A: không, chỉ chạy trong `bootstrap`; không có `down` (FR-013, FR-014).
- Q: `backoffice_migrations` hiện trong Data Model thế nào? → A: Backoffice coi nó là bảng hệ thống như các bảng
  `directus_*` (FR-017, D-181).

### Duyệt 2026-10-26 (chủ dự án kiêm tech lead)

- D-179 (giao diện Content), D-180 (migration riêng), D-181 (`backoffice_migrations` là collection hệ thống) và dòng
  "Directus app với ba trường": duyệt sau `/speckit.plan`, gồm các câu chữ sửa khi plan ở dưới.

### Sửa câu chữ khi `/speckit.plan` (2026-10-26, research.md "Sửa spec khi plan")

- FR-002: chỉ nhãn, không ghi chú. FR-017, US4 kịch bản 6: ẩn khỏi Data Model như `directus_migrations`. FR-019: quy
  tắc chuẩn hóa log của migration riêng (FR-107 của 021).

### Sửa khi `/speckit.analyze` (2026-10-26)

- Bảng "Khác biệt" theo dạng cột `Mã` … `Gỡ ở` mà `tests/parity/src/spec-differences.ts` đọc; dòng Directus app thành
  D-179.1. Edge case: admin Directus xóa bảng `backoffice_migrations`. FR-013: `init` cũng chạy migration riêng.
  FR-019: bước bàn phím và bước API trong E2E, case `start` không `bootstrap`, ba replica ở suite deploy.

### Khi implement lượt 2 (2026-10-26)

- Sửa lại câu chữ FR-017, US4 kịch bản 6 và D-181 viết khi plan: Data Model (cả Directus app,
  `directus/app/src/modules/settings/routes/data-model/collections/collections.vue:111-112`) liệt kê mọi collection
  hệ thống, kể cả `directus_migrations`; `COLLECTIONS_DENY_LIST` chỉ loại khỏi `crudSafeSystemCollections`
  (`directus/app/src/stores/collections.ts:66-67`). "Như `directus_migrations`" nghĩa là `backoffice_migrations` nằm
  trong nhóm System Collections, đúng câu trả lời của chủ dự án ("xem như các bảng `directus_*`").

### Khi implement lượt 3 (2026-10-26, chủ dự án)

- Q: Sau lượt 2, nhóm System Collections của Data Model có hai dòng cùng tên "backoffice_migrations": `directus_migrations`
  hiển thị theo D-118 và bảng thật (CI 40298326039, `settings-parity-ui.spec.ts`). Xử lý thế nào? → A: Data Model của
  Backoffice không liệt kê bảng thật; API vẫn coi nó là collection hệ thống (D-181). Sửa FR-017, US4-6, D-181 viết khi
  implement lượt 2.

- Q: Card ba toggle trong form collection không có tiêu đề (`$system_divider` của form, research "Kết quả lượt 2").
  Thêm tiêu đề bằng migration riêng (dòng divider `bo_*`, phải sửa constitution) hay chỉ ở web? → A: chỉ ở web
  Backoffice (D-182), tiêu đề "Content: Search, Import, Export" / "Content: tìm kiếm, Import, Export". Directus app giữ
  nguyên.
- Q: Directus app có cần tiêu đề không? → A: không, Directus app không có chức năng này; ba toggle vẫn hiện ở cuối form
  collection của Directus app, không tiêu đề, không có tác dụng (D-179.1 giữ nguyên).

### Khi implement lượt 1 (2026-10-26, chủ dự án)

- Q: Coi `backoffice_migrations` là bảng hệ thống ở API thì Directus vẫn có nó ở `/graphql` (introspection, SDL) và OAS
  của admin, Backoffice không (GraphQL đặt tên type hệ thống bằng cách cắt `directus_`, OAS lấy tag hệ thống từ spec
  tĩnh). Giữ ở API hay chỉ ở web? → A: giữ ở cả API như đã duyệt; D-181 thêm GraphQL và OAS; parity normalize
  introspection, SDL và OAS (bỏ mọi thứ mang tên `backoffice_migrations`).

## Assumptions

- Mặc định là hiện, để collection hiện có và collection do Directus tạo không đổi.
- Cài đặt là tùy chọn giao diện, không phải kiểm soát quyền.
- Chỉ áp dụng cho Content của Backoffice; `directus/` chỉ đọc nên Directus app không đổi hành vi.
- Người dùng khác thấy thay đổi ở lần tải collections tiếp theo, giống các tùy chọn collection khác.
- Image Backoffice chạy `bootstrap` mỗi lần khởi động (`apps/api/Dockerfile:75`, chạy chung và chạy độc lập), nên
  migration riêng tự chạy, người vận hành không làm gì thêm (FR-013).
- Chạy nhiều replica cần Redis (Nguyên tắc VII), nên lock trong process khi không có Redis chỉ dùng cho một instance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin đổi được mỗi cài đặt của một collection trong dưới 1 phút; người dùng thấy kết quả ở lần mở trang
  tiếp theo.
- **SC-002**: Collection chưa đổi cài đặt có giao diện Content như hiện nay: 0 test E2E Content hiện có bị đổi.
- **SC-003**: Trên DB đã migrate, 0 test đối chiếu và blackbox collections/fields/schema hiện có thất bại ở cả Directus
  và Backoffice.
- **SC-004**: Trên 100% lượt E2E (ba cấu hình × admin và user thường), phần đã tắt không xuất hiện, nút bộ lọc và phần
  còn lại dùng được bằng bàn phím.
- **SC-005**: Response `GET /collections` của Backoffice và Directus giống nhau trên cùng DB đã migrate, trừ
  `backoffice_migrations`.
- **SC-006**: Migration riêng chạy lần đầu và chạy lại không lỗi trên 7 vendor (Postgres, SQLite ở mọi PR; vendor khác
  hằng đêm); ba replica khởi động cùng lúc cho đúng một dòng mỗi migration; `directus_migrations` giống hệt trước và sau.
