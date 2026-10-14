# Kiểm thử và cổng đóng Checklist: GraphQL (011)

**Purpose**: Kiểm chất lượng yêu cầu về bộ đối chiếu, blackbox, cặp `graphql-nointro`, E2E, benchmark và CI trong
spec.md và contracts/parity.md trước khi tạo tasks (unit test cho câu chữ của yêu cầu kiểm thử, không phải test)
**Created**: 2026-10-14
**Feature**: [spec.md](../spec.md), [contracts/parity.md](../contracts/parity.md), [plan.md](../plan.md)

## Requirement Completeness

- [x] CHK001 Cổng đóng feature (Assumptions: ba phần, phần nào đỏ cũng chặn) có được nêu thành một FR hoặc SC riêng
  thay vì chỉ ở Assumptions không? [Completeness, Spec §Assumptions]
- [x] CHK002 FR-061 có nêu rõ số ca GraphQL của 13 file blackbox cần đếm (hiện "số khối `it` chốt lại ở plan" nhưng
  plan chưa chốt) không? [Gap, Spec §Bộ test liên quan, SC-003]
- [x] CHK003 Có yêu cầu về cách port `redact.test.ts` (đọc log container, `LOG_STYLE=raw`) trong spec hay chỉ ở
  Clarifications và plan R10? [Completeness, Spec §FR-061, Research R10]
- [x] CHK004 Có yêu cầu về việc bỏ ca WebSocket trong `login.test.ts`, `refresh.test.ts` khi port (D-17) không?
  [Completeness, Spec §FR-061, Contract §3]
- [x] CHK005 Có yêu cầu về `health.test.ts` ở app mới (mục `email` của `server_health`, D-07) không? [Gap, Spec
  §FR-061, Plan §Rủi ro]
- [x] CHK006 Bộ đối chiếu FR-060 có nêu rõ các loại user cần chạy cho mỗi file (admin, quyền một phần, public, share)
  hay chỉ cho `schema.test.ts`? [Completeness, Spec §FR-060, Contract §2]
- [x] CHK007 Có yêu cầu về cặp `graphql-nointro` (biến, dùng chung DB và Redis, không vào `manualProfiles`) trong spec
  hay chỉ ở contract? [Gap, Contract §1]
- [x] CHK008 Có yêu cầu CI cho vendor (Postgres `full`, MySQL và SQLite `reduced`, còn lại nightly) áp cho
  `src/graphql` và năm file blackbox mới không? [Completeness, Spec §SC-003, Contract §5]

## Requirement Clarity

- [x] CHK009 "100% ca đạt, ca fail trên chính Directus được ghi chú như 005 đến 010" có định nghĩa cách ghi chú (tên
  ca, vendor, lý do) đủ để tech lead kiểm không? [Clarity, Spec §FR-061, Assumptions]
- [x] CHK010 "So dòng DB cho mutation" (FR-060, SC-004) có nêu tập bảng và cột so, cột được chuẩn hóa (id, thời gian,
  token) không? [Clarity, Spec §SC-004, Contract §2 helpers]
- [x] CHK011 Kịch bản E2E "Save as copy" có nêu collection, `item_duplication_fields` và cách so item tạo ra không?
  [Clarity, Spec §FR-063, Contract §6]
- [x] CHK012 Kịch bản Insights có nêu loại panel, collection và giá trị mong đợi để so giữa hai lượt không? [Clarity,
  Spec §FR-063, Contract §6]
- [x] CHK013 Benchmark FR-064 có nêu data model, kích thước seed, số kết nối và cách lấy mẫu (như `items.ts`) không?
  [Clarity, Spec §FR-064, Contract §7]
- [x] CHK014 "Thời gian sinh schema lần đầu chỉ ghi nhận" có nêu cách đo (xóa cache bằng gì, đo request nào) không?
  [Clarity, Spec §FR-064]

## Requirement Consistency

- [x] CHK015 Số file blackbox trong spec ("tám file đã port", "năm file chưa port") có khớp với Contract §3 và plan
  §Scale không? [Consistency]
- [x] CHK016 SC-003 "mười ba file blackbox" và FR-061 có khớp với danh sách file ở đầu spec (13 file có `requestGraphQL`)
  không? [Consistency, Spec §SC-003]
- [x] CHK017 Danh sách file `reduced` trong Contract §2 (`schema`, `read`, `write`, `system`) có nhất quán với
  SC-003 (MySQL, SQLite chạy rút gọn) và tiền lệ "ca đọc dòng DB chỉ SELECT trên MySQL/SQLite" không? [Consistency]
- [x] CHK018 Mọi chỗ của spec (SC-001, FR-041, Assumptions) đã đồng bộ "so nguyên văn kể cả thứ tự" sau clarify
  (định nghĩa cách so ở api-compat CHK008, không lặp ở đây). [Consistency, Spec §SC-001, FR-041]
- [x] CHK019 `cache.test.ts` chạy trên cặp `cache-redis` (Contract §2) có nhất quán với CI job `parity-cache` và
  `CACHE_FILES` của suite không? [Consistency, Contract §5]

## Acceptance Criteria Quality

- [x] CHK020 (gộp vào operations CHK016: khoảng chờ lan truyền `schemaChanged` cho SC-005.) [Measurability, Spec
  §SC-005]
- [x] CHK021 SC-006 có nêu giá trị `GRAPHQL_QUERY_TOKEN_LIMIT` và document dùng để kiểm (cặp `graphql-nointro`: 50
  token, document 60 token) trong spec không? [Measurability, Spec §SC-006, Contract §1]
- [x] CHK022 SC-007 có nêu kịch bản benchmark nào chặn và cách tính 10% (p95, throughput, số vòng) như 005 không?
  [Measurability, Spec §SC-007]
- [x] CHK023 SC-002 "100% request của bộ đối chiếu" có nêu cách đếm request (mỗi `sameGql` là một request?) không?
  [Measurability, Spec §SC-002]

## Scenario Coverage

- [x] CHK024 Bộ đối chiếu có kịch bản cho R-30: tasks T037 thêm ca "R-30" vào `schema.test.ts` (Postgres `full`);
  R-31 ở `cache.test.ts` (T035), R-32 ở benchmark (T042). Nhất quán với SC-005 xét ở operations CHK014. [Coverage,
  Spec §Rủi ro, Tasks T035, T037, T042]
- [x] CHK025 Có kịch bản chạy chéo cho `schemaChanged` phát từ cả hai chiều (Directus → app mới và ngược lại) trong
  FR-060 không? [Coverage, Spec §FR-060]
- [x] CHK026 Có kịch bản `GET /graphql` (query string) trong bộ đối chiếu không, dù FR-016 yêu cầu? [Coverage, Spec
  §FR-016, Contract §2]
- [x] CHK027 Có kịch bản flow theo event chạy từ mutation GraphQL (US2 kịch bản 6) trong `write.test.ts` không?
  [Coverage, Contract §2]

## Edge Case Coverage

- [x] CHK028 Có yêu cầu về dọn dẹp dữ liệu (collection tạm tên `Query`, item tạo bởi mutation) sau mỗi file để các
  suite khác và lần chạy sau không bị ảnh hưởng không? [Edge Case, Gap, Contract §2]
- [x] CHK029 Có yêu cầu về thứ tự chạy khi `schema.test.ts` tạo field (xóa cache schema của cả hai app) song song với
  file khác (shard CI) không? [Edge Case, Gap]
- [x] CHK030 Có yêu cầu về việc `LOG_STYLE=raw` của cặp blackbox không làm đổi kết quả các file blackbox khác đọc log
  (`mail.test.ts`) không? [Edge Case, Plan §Rủi ro]

## Dependencies & Assumptions

- [x] CHK031 Giả định "Directus của cặp blackbox không có SMTP nên `health.test.ts` không cần SMTP giả" có được kiểm
  với env hiện tại không? [Assumption, Research R10]
- [x] CHK032 Phụ thuộc vào seed của 005 (`articles`, `categories`, `tags`, m2a) cho `read.test.ts` và benchmark có
  ghi rõ tên seed và cách dựng lại không? [Dependency, Contract §2, §7]

## Notes

- CHK001 đến CHK005, CHK007: đã bổ sung vào spec ngày 2026-10-14 (FR-061 mở rộng, FR-065 cổng đóng, FR-060 cặp
  `graphql-nointro`, số ca blackbox ở đầu spec).
- CHK018 kiểm lại sau lần sửa spec ở `/speckit.clarify` (đã đổi SC-001, FR-041).
- Rà 2026-10-14 (trước implement), 23 mục còn lại:
  - Đạt sẵn, không sửa: CHK006, CHK008, CHK009 (tiền lệ 005–010), CHK010 (SC-004 + helpers), CHK011, CHK012, CHK013,
    CHK014 (contract §6, §7, T039, T041), CHK015, CHK016 (8 + 5 = 13 ở mọi tài liệu), CHK017 (T021), CHK019, CHK022
    (compare.ts của 005), CHK025, CHK026 (T019), CHK027 (T022), CHK030 (`mail.test.ts` lọc substring), CHK031 (D-07 của
    001), CHK032 (seed 005, `seed-items.ts`).
  - Sửa: CHK021 (FR-060 ghi giá trị 50 token, document 60 token), CHK023 (SC-002 cách đếm), CHK028 (tasks §Quy ước:
    dọn trong `afterAll`, collection tạm theo file), CHK029 (cùng quy ước: không tạo field trên seed 005).
