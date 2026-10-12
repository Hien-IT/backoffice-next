# Formal Requirements Review Checklist: Quản lý data model (DDL theo vendor, metadata; snapshot, diff, apply)

**Purpose**: Kiểm chất lượng yêu cầu (đầy đủ, rõ, nhất quán, đo được) của spec 006 ở hai nhóm rủi ro nhất trước khi
chia task. Không kiểm cài đặt. Mỗi mục là một câu hỏi về nội dung spec (và contracts của plan khi spec dẫn chiếu); mục
không đạt thì sửa spec rồi mới chạy `/speckit.tasks`.
**Created**: 2026-10-12
**Feature**: [spec.md](../spec.md)
**Depth**: Formal (cổng trước `/speckit.tasks`, người rà thứ hai). **Focus**: B DDL theo vendor và metadata (FR-010 đến
FR-032, US1, US2, Edge Cases, contracts/ddl.md), C snapshot, diff, apply, hash, dùng chéo (FR-040 đến FR-043, US3, US4,
contracts/snapshot.md).
**Ngoài phạm vi checklist này**: hợp đồng HTTP của bốn nhóm route (thứ tự lỗi, `OPTIONS`, multipart), xóa cache và
event, kiểm thử đối chiếu, CI, E2E, benchmark (nhóm A, D, E; rà ở lượt sau nếu cần).

**Ghi chú ưu tiên**: `[P1]` là mục dễ làm sai tiêu chí chấp nhận ("data model tạo ở app này dùng được ở app kia") hoặc
có rủi ro với DB dùng chung nếu để mơ hồ; nên giải quyết trước. Mục `[Gap]`, `[Ambiguity]` đã đối chiếu với spec,
contracts và báo cáo đọc code Directus 11.17.4 khi viết checklist; chỗ nào checklist chưa chắc hành vi của Directus thì
câu hỏi chỉ yêu cầu spec nêu rõ, không khẳng định hành vi.

## B. DDL theo vendor và metadata (FR-010 đến FR-032, US1, US2, Edge Cases)

### B1. Tạo bảng, cột, index

- [x] CHK001 (đã giải: Edge Cases "gen_random_uuid()", FR-020 phần lỗi: lỗi DB `500` chưa ánh xạ) [P1] Yêu cầu về default `gen_random_uuid()` (`ALLOWED_DB_DEFAULT_FUNCTIONS`) có nêu kết quả mong đợi trên vendor
  không có hàm đó (MySQL, SQLite, MSSQL: lỗi DB dịch qua `translateDatabaseError` hay tạo cột không default), để ma
  trận FR-060 trên MySQL, SQLite có ca chấp nhận thay vì "như Directus" chung chung? [Gap, Vendor, Spec §FR-020, SC-003]
- [x] CHK002 (đã giải: US1 thêm `binary`, `unknown` và `is_generated` chỉ đọc; FR-060 liệt kê kiểu) Danh sách kiểu ở US1 (chuỗi, văn bản, số nguyên... geometry) có khớp đủ `KNEX_TYPES` + `TYPES` mà FR-020 dẫn chiếu
  (US1 thiếu `binary`; `unknown` và cột `is_generated` chỉ đọc), và spec có nói rõ kiểu nào thuộc ma trận DDL, kiểu nào
  chỉ đọc? [Completeness, Spec §US1, FR-020, FR-060]
- [x] CHK003 (đã giải: FR-020: null → 255 trừ MSSQL `text`, chuỗi chuyển thẳng cho Knex) Giá trị `max_length` null (không phải MSSQL) và `max_length` dạng chuỗi (Joi của controller cho phép số, chuỗi,
  null) có được nêu kết quả (độ dài mặc định của Knex, hay lỗi) để ca đối chiếu viết được? [Clarity, Spec §FR-020]
- [x] CHK004 (đã giải: FR-020: cùng `true` tạo cả hai; khóa chính không tạo thêm (`addColumnToTable`)) Trường hợp `is_unique` và `is_indexed` cùng `true` trên một cột (hai index hay một), và `is_unique` trên cột khóa
  chính, có được nêu? [Coverage, Spec §FR-020, contracts/ddl.md §2]
- [x] CHK005 (đã giải: FR-020: SQLite tạo index thường, response không đổi) `concurrentIndexCreation` trên vendor không hỗ trợ tạo index đồng thời (SQLite) có được nêu là tạo index thường với
  cùng response, hay lỗi? [Clarity, Vendor, Spec §FR-020, contracts/ddl.md §2]
- [x] CHK006 (đã giải: Edge Cases: không kiểm trước, lỗi DB; helper chỉ migration dùng) Giới hạn độ dài tên collection và field theo vendor (`getTableNameMaxLength`, `getColumnNameMaxLength`: 64, MSSQL và
  Oracle 128) và kết quả khi vượt (lỗi DB dịch, hay chặn trước) có được nêu, bên cạnh Edge Case về tên index dài? [Gap,
  Vendor, Spec §Edge Cases, FR-010]
- [x] CHK007 (đã giải: Edge Cases: tạo được, `/fields`, `/items` trả `403`, như Directus) [P1] Kết quả cho tên collection có khoảng trắng, chữ hoa, ký tự ngoài ASCII, và bảng không có khóa chính có được nêu
  (Directus chỉ chặn `directus_` và `/`; `getSchema` bỏ qua bảng có khoảng trắng và bảng không khóa chính, nên
  `POST /collections` có thể thành công rồi collection không đọc được qua `/fields`, `/items`)? [Coverage, Edge Case,
  Spec §FR-010, FR-011, US1.6]
- [x] CHK008 (đã giải: FR-011, Edge Cases `DB_EXCLUDE_TABLES`) Phạm vi của `DB_EXCLUDE_TABLES` có được nêu nhất quán cho cả đọc collection (FR-011), đọc field và relation (qua
  schema), snapshot (FR-040) và apply (collection bị loại nhưng có trong snapshot → tạo lại → lỗi "đã tồn tại"?), hay chỉ
  FR-011? [Consistency, Spec §FR-011, FR-040, FR-042]
- [x] CHK009 (đã giải: FR-010: `meta.sort` client ưu tiên (lodash `merge`), cả `createField`) Quy tắc `sort` của `directus_fields` khi tạo collection kèm field và khi tạo field lẻ có nêu thứ tự ưu tiên giữa
  `meta.sort` client gửi và giá trị tự tính (vị trí + 1 theo `group`; `max(sort) + 1`), để so dòng metadata không lệch?
  [Ambiguity, Spec §FR-010, FR-020]
- [x] CHK010 (đã giải: contracts/ddl.md §2, §6: image `postgis/postgis` của 001; thiếu → lỗi DB) Điều kiện tiên quyết của geometry theo vendor (PostGIS trên Postgres của môi trường đối chiếu; `point` MySQL; `text`
  SQLite) và kết quả khi thiếu (lỗi DB như Directus) có được ghi ở Assumptions hoặc contracts? [Assumption, Dependency,
  Spec §US1, FR-020, contracts/ddl.md §2]

### B2. Sửa, xóa và dọn

- [x] CHK011 (đã giải: FR-022: `isEqual` toàn bộ object cột; apply dùng `sanitizeColumn`) "Chỉ alter khi cột khác" (FR-022) có định nghĩa "khác" theo tập thuộc tính nào (các key `schema` được so; `comment`,
  `data_type` theo vendor có tính không), để ca "PATCH cùng giá trị → không DDL ở cả hai app" viết được? [Clarity, Spec
  §FR-022]
- [x] CHK012 (đã giải: Edge Cases: dùng `field` của body, đọc lại theo URL) Kết quả khi body `PATCH /fields/:collection/:field` mang `field` khác tham số URL (Directus không có đường đổi tên;
  `field` là khóa định danh) có được nêu (lỗi, bỏ qua, hay tạo metadata cho tên mới không có cột)? [Ambiguity, Edge
  Case, Spec §FR-022]
- [x] CHK013 (đã giải: FR-020: bảng mã của `translateDatabaseError`; chỉ `updateField` dịch; còn lại `500`, so status và mã) Lỗi DB khi đổi kiểu có dữ liệu không chuyển được (ví dụ chuỗi → số) có nêu mã lỗi mong đợi theo `translateDatabaseError`
  cho từng vendor, hay ghi rõ "so cùng mã và message hai app, không chốt trước"? [Measurability, Vendor, Spec §FR-022,
  US1.4]
- [x] CHK014 (đã giải: FR-023: danh sách không dọn) Danh sách phần KHÔNG dọn khi xóa field (filter, `validation`, `conditions`, `display_template`, preset
  `layout_query` còn nhắc tên field; permission `filter` dùng field) có được nêu rõ là để nguyên như Directus, để tester
  không mong đợi dọn? [Coverage, Spec §FR-023]
- [x] CHK015 (đã giải: FR-013: `shares`, `versions` cascade; `comments`, `notifications` để nguyên) Khi xóa collection, cách xử lý các bảng hệ thống khác có tham chiếu (`directus_shares`, `directus_versions`,
  `directus_comments`, `directus_notifications`, `directus_dashboards`/`panels`) có được nêu (dọn qua cascade khóa ngoại
  của schema hệ thống, hay để nguyên như Directus), vì FR-013 chỉ liệt kê bốn bảng và `directus_relations`? [Gap, Spec
  §FR-013, FR-060]
- [x] CHK016 (đã giải: FR-013 D-32 (`DELETE` chặn `403`), FR-012 R-11 (`PATCH` như Directus); `POST` mảng rollback cả lô (US1.6)) [P1] Yêu cầu cho thao tác ghi nhắm vào chính collection hệ thống (`PATCH /collections/directus_users` sửa metadata,
  `DELETE /collections/directus_*`, `POST /collections` mảng có tên `directus_`) có được nêu (chặn ở đâu, mã lỗi), khi
  FR-024 chỉ nói về field hệ thống và US1.6 chỉ nói tên bắt đầu `directus_` lúc tạo? [Gap, Safety, Spec §FR-012, FR-013,
  FR-024]
- [x] CHK017 (đã giải: FR-024, FR-040: đủ vòng đời, có trong snapshot) Với cột người dùng thêm vào collection hệ thống (Clarifications), spec có nêu đủ vòng đời (sửa, xóa cột đó được như
  field thường; quan hệ từ cột đó tới collection người dùng; cột đó xuất hiện trong `/fields/directus_users` và
  snapshot), không chỉ "thêm ... PHẢI làm như Directus"? [Completeness, Spec §FR-024, FR-040]
- [x] CHK018 (đã giải: FR-024: hai message, tên index) `systemFields` chỉ cho `is_indexed`: spec có nêu `is_unique`, `is_nullable`, `default_value` của cột gốc bị từ chối ở
  cả `PATCH /fields` (zod) lẫn `apply` (`validateApplyDiff`) với cùng message, và index trên cột gốc tên theo
  `generateIndexName` như index thường? [Consistency, Spec §FR-024, FR-042]

### B3. Quan hệ

- [x] CHK019 (đã giải: FR-030: không dịch, `500`) Lỗi khi tạo khóa ngoại thất bại ở DB (kiểu cột khác kiểu khóa chính đích ngoài trường hợp `alterType` của MySQL; dòng
  mồ côi đang có; khóa đích không unique) có nêu mã lỗi mong đợi hoặc quy tắc "so cùng mã hai app"? [Gap, Vendor, Spec
  §FR-030]
- [x] CHK020 (đã giải: FR-031: chỉ `on_delete`, `on_update`, `meta`; m2a không DDL) Sửa relation (FR-031) có nêu được đổi `related_collection` hay chỉ `schema.on_delete`, `on_update`, `meta`, và kết quả
  khi `PATCH` một relation m2a (không khóa ngoại) với `schema`? [Clarity, Spec §FR-031]
- [x] CHK021 (đã giải: FR-032: mọi khóa ngoại, relation hệ thống có `schema` khi FK tồn tại) Quy tắc đọc relation (FR-032) có nêu cách ghép khi khóa ngoại trong DB trỏ tới bảng không có trong schema (bị
  `DB_EXCLUDE_TABLES` hoặc không khóa chính), và relation hệ thống (`systemRelationRows`) có `schema` hay `null`?
  [Coverage, Spec §FR-032, FR-011]
- [x] CHK022 (đã giải: US2.1: phạm vi ghi rõ, `on_delete` dữ liệu thuộc 005) Hậu quả `on_delete` của Directus với dữ liệu khi xóa item (CASCADE xóa dòng con, SET NULL) chỉ là hành vi DB; spec có
  ghi rõ feature này không kiểm `on_delete` qua `/items` (thuộc 005) mà chỉ so khóa ngoại tạo ra? [Scope, Spec §US2.1,
  FR-060]

### B4. Đo được

- [x] CHK023 (đã giải: FR-060: tập thuộc tính theo `columnInfo`, index, khóa ngoại; không so collation) SC-003 "100% thuộc tính so sánh" có liệt kê đủ tập thuộc tính (FR-060 nêu kiểu, nullable, default, khóa chính, unique,
  index, khóa ngoại, tên; chưa nêu `max_length`, `numeric_precision`, `numeric_scale`, `has_auto_increment`, `comment`,
  `is_generated`, `on_update`, `on_delete`, collation) để SC-003 đo được và không tranh cãi lúc đóng feature?
  [Measurability, Spec §SC-003, FR-060]
- [x] CHK024 (đã giải: US1.4: số dòng và giá trị cột bằng nhau, cùng status và mã khi lỗi) "Giữ dữ liệu khi Directus giữ" (US1.4) có được chuyển thành tiêu chí so được (số dòng và giá trị cột sau alter bằng
  nhau hai app, kể cả SQLite tạo lại bảng)? [Measurability, Spec §US1.4, FR-022]

## C. Snapshot, diff, apply, hash, dùng chéo (FR-040 đến FR-043, US3, US4)

- [x] CHK025 (đã giải: FR-040, FR-024: field người dùng của collection hệ thống có trong `fields`, `relations`) [P1] Spec có nêu rõ snapshot chứa field người dùng và relation của chúng trên collection hệ thống (collection hệ thống
  không nằm trong `collections` nhưng field có `meta.system` khác `true` vẫn vào `fields`), và apply ở app kia tạo được
  chúng, để tiêu chí "và ngược lại" phủ cả trường hợp Clarifications cho phép? [Coverage, Spec §FR-040, FR-042, FR-024]
- [x] CHK026 (đã giải: US3.1: gửi `Cache-Control: no-store`) [P1] US3.1 và SC-004 so snapshot lấy ở hai app: spec có yêu cầu phép so bỏ qua response cache dùng chung (gửi
  `Cache-Control: no-store` hoặc xóa cache), vì `GET /schema/snapshot` được cache và app B có thể trả bản của app A
  (`HIT`), làm phép so vô nghĩa? [Consistency, Spec §US3.1, SC-004, SC-006, FR-050]
- [x] CHK027 (đã giải: Edge Cases: `postColumnChange`, `flushCaches` không chạy; schema cũ ở hai app) Trạng thái cache hai app sau khi `apply` lỗi giữa chừng (transaction rollback nhưng DDL tự commit trên MySQL;
  `flushCaches` chỉ chạy sau transaction thành công) có được nêu (schema trong process còn cũ ở cả hai app tới lần xóa
  kế tiếp, như Directus)? [Gap, Edge Case, Spec §FR-042, Edge Cases]
- [x] CHK028 (đã giải: FR-043: khác vendor với `force` ngoài phạm vi kiểm) Snapshot khác vendor với `force` (ví dụ snapshot Postgres apply lên MySQL) có được nêu là ngoài phạm vi kiểm hoặc "như
  Directus, không chốt kết quả", khi FR-043 chỉ nói "cùng vendor, không cần force"? [Scope, Spec §FR-043, US4.2]
- [x] CHK029 (đã giải: FR-042: mọi vendor, chỉ khóa chính và khóa ngoại `char`/`varchar` 36) Quy tắc ép `char(36)`/`varchar(36)` → `uuid` khi apply tạo collection mới có nêu phạm vi vendor (chỉ nơi có kiểu
  `uuid` thật hay mọi vendor) và chỉ áp cho khóa chính, khóa ngoại? [Clarity, Spec §Edge Cases, FR-042]
- [x] CHK030 (đã giải: FR-040: nội dung sau parse bằng JSON; byte đo và ghi) `GET /schema/snapshot?export=yaml` có yêu cầu trùng từng byte với Directus (như JSON ở US4.1) hay chỉ cùng nội dung sau
  parse, khi `js-yaml` của app mới là 4.3.2 còn Directus 4.1.1 (rủi ro R1 của 005 chưa đo)? [Measurability, Spec §FR-040,
  US4.1]
- [x] CHK031 (đã giải: FR-041: JSON theo `MAX_PAYLOAD_SIZE`, multipart không giới hạn) Giới hạn kích thước đầu vào của `/schema/diff`, `/schema/apply` (JSON theo `MAX_PAYLOAD_SIZE`; multipart không giới hạn
  như busboy mặc định) có được nêu ở spec, hay chỉ ở contracts/schema-api.md §2? [Gap, NFR, Spec §FR-041]
- [x] CHK032 (đã giải: FR-042: không hỏi lại, không dry-run) Spec có ghi rõ `apply` có thể xóa bảng có dữ liệu (diff `D` collection, field) không hỏi lại, không dry-run, như
  Directus, để đội vận hành và tester biết? [Gap, Safety, Spec §FR-042, US4.3]
- [x] CHK033 (đã giải: FR-042 dẫn contracts/snapshot.md §3) Thứ tự lỗi của `validateApplyDiff` (tạo đã có / xóa không có cho collection, field, systemField, relation, rồi
  "hash does not match") có được spec dẫn tới contracts/snapshot.md §3 để ca "hash lệch trả cùng lỗi chi tiết" (US4.3) đo
  được? [Traceability, Spec §US4.3, FR-042]
- [x] CHK034 (đã giải: Edge Cases: key thiếu → thuộc tính bị xóa, thứ tự key không tạo diff) Kỳ vọng khi `diff` nhận snapshot có `collections` trùng `meta` nhưng khác thứ tự key hoặc thiếu key tùy chọn (client
  tự soạn YAML) có được nêu (diff `E` giả hay không, như Directus)? [Coverage, Spec §FR-041]

## Chung

- [x] CHK035 (đã giải: bảng "Truy vết user story và requirement" thêm trước Requirements) Spec 006 chưa có bảng "Truy vết user story và requirement" như 005; có cần bổ sung để FR-024, FR-032, FR-043, FR-050
  gắn với story và SC tương ứng (ví dụ FR-043 ↔ US4.3, SC-006)? [Traceability, Gap]
- [x] CHK036 (đã giải: Key Entities: mục "Thuật ngữ schema") Từ "schema" được dùng cho ba nghĩa (phần `schema` của field và relation, schema DB trong process, route `/schema`);
  Key Entities có nên định nghĩa hoặc spec dùng "cấu trúc cột", "SchemaOverview", "snapshot" nhất quán? [Consistency,
  Spec §Key Entities]

## Notes

- Rà ngày 2026-10-12 bằng cách đọc code Directus 11.17.4 (`services/collections.ts`, `fields.ts`, `relations.ts`,
  `controllers/fields.ts`, `utils/get-snapshot.ts`, `get-snapshot-diff.ts`, `apply-diff.ts`, `validate-diff.ts`,
  `database/errors/*`, migration `add-shares`, `add-content-versioning`). Mọi mục đã giải; spec thêm D-32, R-11, bảng
  truy vết, 8 Edge Case, mở rộng FR-010 đến FR-013, FR-020 đến FR-024, FR-030 đến FR-032, FR-040 đến FR-043, FR-060.
- D-32 dựa trên đọc code, chưa đo trên Directus thật; task đầu của gói B đo trên DB bỏ đi.
- Mỗi lần chạy `/speckit.checklist` tạo file mới; checklist nhóm A, D, E (nếu cần) đặt tên khác.
