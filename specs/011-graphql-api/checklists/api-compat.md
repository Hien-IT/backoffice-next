# Tương thích API và quyền Checklist: GraphQL (011)

**Purpose**: Kiểm chất lượng yêu cầu về schema theo user, scope, hiện diện type và mutation, lỗi, cache, SDL trong
spec.md và contracts/graphql-api.md trước khi tạo tasks (unit test cho câu chữ của spec, không phải test hệ thống)
**Created**: 2026-10-14
**Feature**: [spec.md](../spec.md), [contracts/graphql-api.md](../contracts/graphql-api.md),
[data-model.md](../data-model.md)

## Requirement Completeness

- [x] CHK001 Có yêu cầu cho mọi method tới `/graphql` (`GET`, `POST`, `OPTIONS`, `HEAD`, method khác) với status và
  header `Allow` cụ thể không, hay `OPTIONS`, `HEAD` còn là `[đo]`? [Completeness, Spec §FR-001, Contract §1]
- [x] CHK002 Có yêu cầu cho path con (`/graphql/<x>`, `/graphql/system/<x>`) chọn scope nào không? [Gap, Contract §1]
- [x] CHK003 Danh sách type, query, mutation sinh cho mỗi collection (data-model §3) có đủ `<c>_by_version` cho
  singleton (chỉ `version`) và `update_<c>` cho singleton không, và quy tắc "singleton không có `_by_id`,
  `_aggregated`" có ghi trong FR không? [Completeness, Spec §FR-010, FR-020]
- [x] CHK004 Yêu cầu hiện diện của từng thao tác hệ thống (§4 data-model, Contract §4) có nêu điều kiện cho mọi
  mục (admin, quyền collection, biến env, có `user` trong accountability) hay còn mục không có điều kiện? [Completeness,
  Spec §FR-030, FR-031]
- [x] CHK005 Có yêu cầu về hành vi khi `Query` không có field nào (public không policy: `_empty: Void`) trong spec,
  hay chỉ nằm ở research R12.3? [Gap, Spec §Edge Cases]
- [x] CHK006 Có yêu cầu về `__typename` và `extensions` của response (`FormattedExecutionResult`) không? [Completeness,
  Spec §FR-002, FR-013]
- [x] CHK007 Có yêu cầu về giới hạn `limit: -1`, `QUERY_LIMIT_MAX` và `MAX_BATCH_MUTATION` cho ghi lồng trong GraphQL
  không, hay chỉ "như REST"? [Completeness, Spec §FR-024, Edge Cases]

## Requirement Clarity

- [x] CHK008 "Khớp nguyên văn kể cả thứ tự" có định nghĩa rõ đối tượng so (JSON của introspection query nào, với
  tùy chọn nào; văn bản SDL) không? [Clarity, Spec §FR-041, SC-001, Assumptions]
- [x] CHK009 "Message rút gọn như `processError`" ở FR-002 và FR-051 có nêu đúng điều kiện (lỗi không phải
  `DirectusError` mới bị che; `FORBIDDEN` user thường vẫn thấy nguyên) không? [Clarity, Spec §FR-002, FR-051,
  Contract §5]
- [x] CHK010 FR-004 có nêu rõ khóa cache gồm gì (`query`, `variables`, user, role, ip, version) thay vì "theo quy tắc
  của 005" không? [Clarity, Spec §FR-004, Contract §2]
- [x] CHK011 "Operation `subscription` qua HTTP làm giống Directus" ở FR-047 có đủ cụ thể để viết test (status, body
  mong đợi) hay phụ thuộc vào phép đo chưa làm? [Ambiguity, Spec §FR-047, Research R12.2]
- [x] CHK012 Tên dành riêng và regex tên hợp lệ ở FR-046 có được liệt kê đầy đủ trong spec (không chỉ "như Directus")
  không? [Clarity, Spec §FR-046, Edge Cases]
- [x] CHK013 "Không nhất quán giữa các policy" (FR-040, US4 kịch bản 2) có định nghĩa hành vi cụ thể (type nullable,
  resolver trả null) ở FR, không chỉ ở Edge Cases không? [Clarity, Spec §FR-040]
- [x] CHK014 FR-043 có nêu `Content-Type` của SDL hay còn `[đo]`? [Ambiguity, Spec §FR-043, Contract §3]

## Requirement Consistency

- [x] CHK015 US1 kịch bản 4 nói field không được phép → `400 GRAPHQL_VALIDATION_EXCEPTION`, US2 kịch bản 4 nói mutation
  không quyền "không có trong schema, hoặc có nhưng bị từ chối `FORBIDDEN`": hai cách diễn đạt có nhất quán với
  quy tắc sinh schema theo quyền (FR-020, FR-040) không? [Consistency, Spec §US1, US2]
- [x] CHK016 Edge Cases nói `<c>_by_id` của item không được phép "trả `null` với lỗi `FORBIDDEN`... so nguyên văn" có
  mâu thuẫn với US1 kịch bản 2 ("`data` null kèm `errors` như Directus") không, và câu hỏi trong Edge Cases đã được
  trả lời chưa? [Conflict, Spec §Edge Cases, US1]
- [x] CHK017 FR-035 (`update_extensions_item` như `PATCH /extensions/:pk` → `403`) có nhất quán với D-37 của spec 010
  và Contract §6 không? [Consistency, Spec §FR-035]
- [x] CHK018 FR-042 nói `GRAPHQL_INTROSPECTION=false` tắt cả `server_specs_oas`: có đúng với mã Directus (chỉ
  `server_specs_graphql` và route SDL phụ thuộc biến này; `server_specs_oas` phụ thuộc `OPENAPI_ENABLED`) không?
  [Conflict, Spec §FR-042, Contract §4]
- [x] CHK019 Tên route trong spec (`/server/specs/graphql[/:scope]`) và contract (`/server/specs/graphql/items`) có
  thống nhất về giá trị mặc định `items` không? [Consistency, Spec §FR-043, Contract §3]
- [x] CHK020 Quy tắc cache `POST /graphql` (FR-004) có nhất quán với quy tắc "response có `errors` không cache" ở
  US5 kịch bản 2 và Contract §2 không? [Consistency]

## Acceptance Criteria Quality

- [x] CHK021 SC-001 có liệt kê đủ cấu hình user để so (ba cấu hình quyền, public có và không policy) và chúng có khớp
  với danh sách user trong contracts/parity.md §2 (`schema.test.ts`: user A, B, C) không? [Measurability, Spec
  §SC-001]
- [x] CHK022 SC-002 "ngoài khác biệt đã ghi (D-17, D-23, D-27, D-28, D-37)" có nêu rõ phần nào của response GraphQL
  được bỏ qua cho mỗi D (ví dụ D-37: body của `update_extensions_item`) không? [Measurability, Spec §SC-002]
- [x] CHK023 Có tiêu chí đo được cho "mô tả type có chữ Directus so sau khi đổi thương hiệu" (danh sách chỗ đổi, cách
  so) không? [Measurability, Spec §Cần xác nhận, Assumptions]

## Scenario Coverage

- [x] CHK024 Có yêu cầu cho token share (`getPermissionsForShare`) trên `/graphql` không, dù FR-060 nhắc "token share"
  trong bộ đối chiếu? [Coverage, Gap, Spec §FR-060]
- [x] CHK025 Có yêu cầu cho `auth_login` với `otp` (TFA bật) và `mode: session` trong GraphQL không? [Coverage, Spec
  §US3 kịch bản 2]
- [x] CHK026 Có yêu cầu cho query `version` ở field quan hệ lồng và `<c>_by_version` trên collection hệ thống
  (scope `system` không có `_by_version`) không? [Coverage, Spec §FR-010]
- [x] CHK027 Có yêu cầu cho `search` kết hợp quyền đọc theo filter trong GraphQL không? [Coverage, Spec §US1]

## Edge Case Coverage

- [x] CHK028 Có yêu cầu cho collection có tên trùng tên query hệ thống trong scope `system` (ví dụ collection người
  dùng `users` không vào scope `system`, nhưng collection `directus_server`?) hay trùng tên mutation global không?
  [Edge Case, Gap]
- [x] CHK029 Có yêu cầu cho field tên `_empty`, `__typename` hoặc tên bắt đầu `__` (GraphQL dành riêng) không? [Edge
  Case, Spec §FR-046]
- [x] CHK030 Có yêu cầu về `GRAPHQL_QUERY_TOKEN_LIMIT` giá trị 0 hoặc không phải số không? [Edge Case, Gap]
- [x] CHK031 Có yêu cầu cho document chỉ có fragment, hoặc `operationName` trỏ tới operation không tồn tại không?
  [Edge Case, Spec §US5]

## Dependencies & Assumptions

- [x] CHK032 Giả định "cùng `SchemaOverview` thì thứ tự type trùng Directus" có được nêu và có kế hoạch kiểm (R12.5)
  không? [Assumption, Plan §Rủi ro]
- [x] CHK033 Phụ thuộc vào hành vi của `graphql` 16.12.0 và `graphql-compose` 9.1.0 (message validation, thứ tự) có
  ghi trong spec hay chỉ ở plan? [Dependency, Spec §Assumptions]

## Notes

- CHK001, CHK002, CHK005, CHK011, CHK014: đã đo trên Directus 11.17.4 ngày 2026-10-14 (research R12) và ghi vào
  FR-001, FR-043, FR-047, Edge Cases, contract §1, §3, §4.
- CHK003: `/speckit.analyze` 2026-10-14 (I1) phát hiện FR-010 sai về singleton (`_by_version(version!)` vẫn có cho
  singleton; chỉ `_by_id`, `_aggregated` không có); đã sửa FR-010 và data-model §3.
- CHK016 và CHK018 là mâu thuẫn hoặc sai so với mã Directus; đã sửa spec ngày 2026-10-14 (Edge Cases `_by_id`,
  FR-042 chỉ tắt `server_specs_graphql`).
- Rà 2026-10-14 (trước implement), 25 mục còn lại:
  - Đạt sẵn, không sửa: CHK004 (contract §4), CHK006 (FR-002, FR-013), CHK007 (Edge Cases), CHK015 (US1, US2 nhất quán
    với schema theo quyền), CHK017, CHK019, CHK020, CHK026 (FR-010 mới), CHK027 (T019), CHK028 (scope tách nên collection
    người dùng không vào `system`; không có xung đột tên), CHK030 (`libs/env` ép kiểu number cho hai biến có trong
    type-map; giá trị không hợp lệ ghi ở Edge Cases là không hỗ trợ), CHK032 (R12.5 đo), CHK033 (Assumptions).
  - Sửa spec: CHK008 (Assumptions nêu `getIntrospectionQuery` và tùy chọn), CHK009 (FR-002 nêu đúng điều kiện che
    lỗi), CHK010 (FR-004 liệt kê khóa cache), CHK012 (FR-046 trỏ danh sách ở Edge Cases), CHK013 (FR-040 nêu field
    không nhất quán), CHK021 (SC-001 liệt kê A, B, C, share), CHK022 (SC-002 nêu phần bỏ qua từng D), CHK023 (đọc mã:
    description không có chữ Directus), CHK024 (FR-040 token share; T019, T029), CHK025 (FR-032 `otp`; T025), CHK029
    (Edge Cases tên `__x`; T029), CHK031 (T034 document chỉ fragment).
