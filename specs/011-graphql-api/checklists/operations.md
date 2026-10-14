# Vận hành đa instance Checklist: GraphQL (011)

**Purpose**: Kiểm chất lượng yêu cầu về cache schema trong process, bus `schemaChanged`, biến môi trường và hiệu năng
sinh schema trong spec.md, plan.md và data-model.md trước khi tạo tasks
**Created**: 2026-10-14
**Feature**: [spec.md](../spec.md), [data-model.md](../data-model.md), [research.md](../research.md)

## Requirement Completeness

- [x] CHK001 Có yêu cầu về hành vi khi Redis không cấu hình (bus local, cache schema chỉ xóa trong instance) được nêu
  ở FR-044 và có nhất quán với cảnh báo một instance của 001 không? [Completeness, Spec §FR-044]
- [x] CHK002 Có yêu cầu về hành vi khi Redis mất kết nối giữa chừng (bus ngắt: cache schema cũ tồn tại tới khi nào)
  không? [Gap, Spec §FR-044]
- [x] CHK003 Có yêu cầu về việc khởi động chỉ đọc (cache rỗng, subscribe bus, không sinh schema trước) cho nhiều
  replica cùng lúc không? [Completeness, Plan §VII, Gap trong spec]
- [x] CHK004 Có yêu cầu về SIGTERM khi đang sinh schema hoặc đang chờ trong hàng đợi (request dở phải xong hay bị hủy)
  không? [Gap, Constitution VII]
- [x] CHK005 Có yêu cầu về log và metric cho GraphQL (đếm request `/graphql` trong metric chung, log lỗi resolver
  nội bộ, log cảnh báo tên không hợp lệ) với tên và mức cụ thể không? [Completeness, Spec §FR-053, FR-054]
- [x] CHK006 Có yêu cầu về giới hạn bộ nhớ của cache schema (100 entry × kích thước schema cho data model lớn) hoặc
  cách theo dõi không? [Gap, Spec §FR-044]

## Requirement Clarity

- [x] CHK007 "Xóa toàn bộ khi nhận `schemaChanged`" có nêu rõ danh sách sự kiện phát `schemaChanged` ở app mới (service
  nào, kể cả `utils/cache/clear?system`) để kiểm đủ không? [Clarity, Spec §FR-044, Research R5]
- [x] CHK008 Khóa cache `scope_type_role_user` có được nêu với giá trị khi public (`undefined`) và khi token share
  (`role`, `user` null) không? [Clarity, Data-model §1]
- [x] CHK009 `GRAPHQL_SCHEMA_CACHE_CAPACITY` "không có mặc định ở Directus, code dùng 100" có nêu cách đọc khi biến
  không phải số không? [Clarity, Spec §FR-005, Data-model §7]
- [x] CHK010 "Mỗi instance sinh tối đa N schema cùng lúc, request còn lại chờ" có nêu hành vi khi hàng đợi dài (không
  timeout, như Directus) không? [Clarity, Spec §FR-045, US5 kịch bản 4]
- [x] CHK011 "Kiểm cache lần hai sau khi vào semaphore" có được nêu là yêu cầu (không chỉ ở research R5) không?
  [Clarity, Spec §FR-045]

## Requirement Consistency

- [x] CHK012 FR-044 (cache trong process) có viện dẫn đúng điều kiện của Nguyên tắc VII 1.2.0 (dựng lại từ DB hoặc
  Redis, xóa qua bus trên mọi instance) không? [Consistency, Spec §FR-044, Constitution VII]
- [x] CHK013 FR-005 (bốn biến `GRAPHQL_*` sang nhóm A) có nhất quán với contracts/config.md của 001 và với
  `WEBSOCKETS_GRAPHQL_ENABLED` đã ở nhóm A từ 005 không? [Consistency, Spec §FR-005, Research R6]
- [x] CHK014 R-30 (cache không xóa khi đổi DB trực tiếp) có nhất quán với SC-005 ("đổi ở một app thấy ngay ở app kia")
  bằng cách giới hạn SC-005 cho thay đổi qua API không? [Consistency, Spec §SC-005, R-30]
- [x] CHK015 Thay `mnemonist`, `async-mutex` bằng `lru-cache`, `p-queue` (plan R1) có được ghi ở spec như khác nguồn
  cần tech lead duyệt (Nguyên tắc X) hay chỉ trong header file? [Consistency, Plan §Complexity]

## Acceptance Criteria Quality

- [x] CHK016 SC-005 có nêu khoảng thời gian chấp nhận cho lan truyền `schemaChanged` qua Redis không? [Measurability,
  Spec §SC-005]
- [x] CHK017 R-32 (sinh schema tốn CPU) có tiêu chí đo (thời gian sinh lần đầu cho data model của bộ đối chiếu,
  ngưỡng ghi nhận) đủ để "bằng chứng" được chấp nhận không? [Measurability, Spec §R-32, FR-064]
- [x] CHK018 US5 kịch bản 4 ("nhiều request đồng thời... không lỗi") có số request, số user và kết quả đo được không?
  [Measurability, Spec §US5]

## Scenario Coverage

- [x] CHK019 Có yêu cầu cho nhiều replica app mới cùng nhận `schemaChanged` (mỗi replica tự xóa; không instance nào
  bỏ sót) không? [Coverage, Spec §FR-044]
- [x] CHK020 Có yêu cầu cho thay đổi quyền từ Directus khi app mới đang giữ schema trong cache của user đó (chiều
  Directus → app mới) không? [Coverage, Spec §US4 kịch bản 4]
- [x] CHK021 Có yêu cầu cho `utils_cache_clear` qua GraphQL xóa cache schema của chính instance và instance khác không?
  [Coverage, Spec §FR-035, FR-044]

## Edge Case Coverage

- [x] CHK022 Có yêu cầu cho `GRAPHQL_SCHEMA_GENERATION_MAX_CONCURRENT=0` hoặc âm không? [Edge Case, Gap]
- [x] CHK023 Có yêu cầu cho lỗi khi sinh schema (ví dụ `buildSchema` ném): lỗi lan ra response nào, cache có lưu
  lỗi không, request sau có thử lại không? [Edge Case, Gap, Plan §Rủi ro]
- [x] CHK024 Có yêu cầu cho `schemaChanged` tới giữa lúc một schema đang được sinh (schema cũ được cache sau khi
  xóa) không? [Edge Case, Gap]

## Dependencies & Assumptions

- [x] CHK025 Giả định "hai app cùng `GRAPHQL_*`, `CACHE_*` qua `.env` chung" (Assumptions) có nêu hậu quả khi lệch
  (ví dụ `GRAPHQL_INTROSPECTION` khác nhau giữa hai app) không? [Assumption, Spec §Assumptions]
- [x] CHK026 Phụ thuộc vào `clearSystemCache` của 002 phát `schemaChanged` cho mọi đường ghi (kể cả ghi lồng qua
  GraphQL mutation trên `users`, `roles`) có được nêu và kiểm không? [Dependency, Spec §FR-025, FR-044]

## Notes

- CHK002, CHK004, CHK023, CHK024 là chỗ spec im lặng; quyết định mặc định là "như Directus" nhưng cần ghi rõ để test
  biết kỳ vọng.
- CHK015: đã ghi vào spec ngày 2026-10-14 (mục "Lệch có chủ đích so với mã gốc" trong Khác biệt).
- Rà 2026-10-14 (trước implement), 25 mục còn lại:
  - Đạt sẵn, không sửa: CHK001 (FR-044), CHK005 (FR-053, FR-054, T017 ca metric), CHK007 (FR-044 + research R5),
    CHK011 (FR-045), CHK012, CHK013 (T002), CHK020 (T029 hai chiều), CHK026 (FR-025, T025).
  - Sửa spec: CHK002 (Edge Cases: bus mất kết nối), CHK003 (FR-044: khởi động không sinh schema), CHK004 (Edge Cases:
    SIGTERM), CHK006 (R-32 nêu bộ nhớ, T042 đo RSS), CHK008 (FR-044 khóa cho public và share), CHK009, CHK022 (Edge
    Cases: giá trị không hợp lệ không hỗ trợ), CHK010 (FR-045 không timeout), CHK014 (SC-005 "qua API"), CHK016 (SC-005
    khoảng chờ bus như 002, 004), CHK017 (R-32 cột bằng chứng, T042), CHK018 (US5 kịch bản 4 có số), CHK019 (FR-060 cặp
    `multi`; T029), CHK021 (T025 `utils_cache_clear` xóa cache schema app kia), CHK023 (FR-045, Edge Cases: lỗi sinh
    schema), CHK024 (R-30 ghi `schemaChanged` giữa lúc sinh), CHK025 (Assumptions: lệch env là lỗi vận hành).
- 2026-10-14: owner chọn port nguyên `mnemonist`, `async-mutex`; CHK015 không còn mục lệch cần duyệt.
