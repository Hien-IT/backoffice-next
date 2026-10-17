# Specification Quality Checklist: Trình chỉnh sửa Flows (017)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — ngoại lệ có chủ đích như 012–016: spec của dự án port
      Directus nêu tên route, request, body, hằng số lưới và file Directus làm chuẩn so sánh (Nguyên tắc III, VI);
      không nêu cách viết code mới (tên component `Bo*` chỉ để chỉ phần dùng lại của 013–016).
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders — người đọc là owner/tech lead quen Directus, như các spec trước.
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — ba điểm nhiều cách hiểu (canvas chỉ chuột, notice ở form `mail`, màu nhánh reject) owner đã chốt 2026-10-17
      có đề xuất mặc định và ghi ở Clarifications và "Cần xác nhận"; một [Unverified] còn lại (D-105: Directus treo khi
      dữ liệu có vòng) là việc kiểm T002 của plan, không chặn.
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details) — SC nêu endpoint và bảng Directus làm đối
      tượng so sánh, không nêu công nghệ của app mới.
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded — phạm vi và ngoài phạm vi (extension, AI, WebSocket, email thật, snackbar, người không
      admin) ghi ở đầu User Scenarios.
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria — bảng truy vết US ↔ FR ↔ SC.
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria — SC-002 là tiêu chí chấp nhận của mô tả feature
      (flow tạo ở app mới mở và sửa được trên Directus, và ngược lại); SC-003 là "xem log" và "nút chạy thủ công".
- [x] No implementation details leak into specification — như mục Content Quality.

## Notes

- Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
- Owner chọn B cho canvas (chỉ chuột như Directus, ngoại lệ a11y; D-104 bỏ trống); owner chọn B cho form `mail`
  (thêm notice, D-106); chờ tech lead duyệt D-105, D-106, R-43 đến R-46 (hành vi Directus tái tạo) và ngoại lệ a11y.
- Giả định cần plan kiểm (T002): API mới nhận `PATCH /flows/:id` với `operations: {create, update, delete}` lồng và
  cây operation lồng; `GET /revisions` nhận filter `activity.action` và `aggregate[count]`; `ExtensionOptions` tách
  được khỏi `useFieldDetailStore` cho `type operation`; `use-revisions` nhận `action`/`full`.
- Đã kiểm 2026-10-17 khi viết spec: `nanoid`, `@sindresorhus/slugify` có trong `apps/web`; `position_x/y` NOT NULL,
  `resolve`/`reject` unique, `key` không unique (migration `20220429A-add-flows.ts`); Directus không ánh xạ
  `directus_operations` trong `get-route.ts`; `trigger-detail.vue` không được import.
- Không tạo branch (làm trên `main` như 012–016); thư mục `specs/017-flows-editor` là feature hiện tại theo quy tắc
  "số cao nhất" của `common.sh`.
