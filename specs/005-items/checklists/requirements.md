# Specification Quality Checklist: Items (CRUD `/items`, response cache, export, event, bus `websocket.event`)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-11
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

- Tên endpoint, mã lỗi, message, header, tên file và hàm của Directus trong spec là hợp đồng tương thích (Nguyên tắc
  I, III), không phải chi tiết cài đặt của app mới; cách làm như spec 001 đến 004. Spec không chọn cấu trúc code hay
  cách lưu trữ của app mới; thư viện export và emitter được nêu vì nội dung file và hành vi listener phải trùng Directus
  (Assumptions).
- Marker duy nhất (FR-032, điều kiện đăng ký cầu nối `websocket.event`) đã giải ở Clarifications 2026-10-11: chủ dự án
  cho biết không có node Directus nào bật WebSocket; chọn cùng điều kiện `WEBSOCKETS_*` như Directus, không thêm D-32.
  Đã cập nhật FR-032, FR-050, bảng khác biệt (D-30) và Assumptions.
- `/speckit.clarify` 2026-10-11 (5 câu): MySQL, SQLite theo tiền lệ 004 (FR-041); cặp chính giữ cache bật với
  `CACHE_SKIP_ALLOWED=true` và bộ so sánh gửi `Cache-Control: no-store` (FR-043, SC-009); benchmark 10 triệu dòng
  (FR-048); R-07 tái tạo; chỉ so thông điệp bus, không dựng client WebSocket (FR-033, FR-045, SC-005). Còn để
  `/speckit.plan` chọn: cấu hình bốn biến thể cache và cặp bật WebSocket (FR-042, FR-045), cách nạp 10 triệu dòng.
