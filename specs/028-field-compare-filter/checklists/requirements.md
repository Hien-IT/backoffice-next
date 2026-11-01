# Specification Quality Checklist: Lọc item bằng cách so sánh hai field của cùng collection

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-01
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Lượt kiểm 1 (2026-11-01): đạt.
- Theo quy ước của dự án (spec 021–023), spec ghi đường dẫn file và endpoint ở bảng "Đánh giá hiện trạng" và bảng "Khác
  biệt so với Directus" để đối chiếu với Directus (Nguyên tắc V, X). Phần yêu cầu và tiêu chí không chọn cách cài đặt;
  cú pháp `$FIELD(b)` là giao diện API (FR-001), không phải chi tiết cài đặt.
- Không có marker [NEEDS CLARIFICATION]: tám điểm mở ghi ở "Cần xác nhận" để `/speckit.clarify` chốt (nhóm kiểu, `_neq`
  với null, collation, quyền field b, dạng GraphQL, field b bị xóa, nhãn chip, mẫu design-system).
- Lượt kiểm 2 (2026-11-01, sau `/speckit.clarify`, 5 câu): đạt. Đã chốt nhóm kiểu (FR-003: số và chuỗi so chéo, ngày giờ
  cùng kiểu lưu), quyền field b (FR-006: 403 như filter key), input GraphQL `<field>_field` (FR-008, D-205), `_neq` với
  null (Edge Cases), nhãn chip và field b bị xóa (FR-012, FR-014). "Cần xác nhận" còn collation (mặc định vendor) và
  mẫu design-system (design owner).
- Lượt kiểm 3 (2026-11-01, sau `/speckit.plan`): đạt; câu chữ research R1, R2, R3, R5 đã áp vào FR-003, FR-008, Edge
  Cases, D-205 (ghi "sửa khi plan 2026-11-01"); "Cần xác nhận" còn collation và mẫu design-system.
- Lượt kiểm 4 (2026-11-01, sau `/speckit.checklist` api-compat, 26 mục): đạt; 5 phát hiện (CHK002, CHK012, CHK019,
  CHK022, CHK026) đã sửa vào FR-003, FR-004, FR-005, FR-011, FR-013, US4-5, Edge Cases, D-203.
- Lượt kiểm 5 (2026-11-01, sau `/speckit.analyze`): đạt; 6 phát hiện (I1 HIGH theo cách a: mọi `$FIELD(...)` là giá
  trị động, tên sai → 400; I2, C1, C2, I3, I4) đã sửa vào FR-001, Edge Cases, D-203, D-203.1, research R1/R2,
  contracts/api.md, data-model, tasks T002, T003, T007, T041.
- Sau implement lượt 1 (2026-11-01): FR-001..FR-007, FR-009..FR-011 có unit (`field-compare`, `operator`, `flatten-filter`,
  hai service permission) và parity ba vendor; D-203 cột Directus là số đo (T002), D-204 là `doc` ở bộ đối chiếu.
- Sau implement lượt 2 và 3 (2026-11-01): FR-008 có unit (`replace-funcs`, `schema/index`) và parity GraphQL (tập id bằng
  REST, introspection/SDL qua normalizer); FR-012..FR-015 có unit (`InputGroup`, `InputComponent`), browser (axe) và E2E
  ba cấu hình; SC-006 đo ở `benchmark-items` sau khi đóng feature (T041).
- Hành vi Directus với `$FIELD` (D-203, D-203.1) ghi [Unverified], đo ở lượt 1 implement như T002 của 023.
