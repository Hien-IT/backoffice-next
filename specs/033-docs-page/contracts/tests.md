# Contract: Tests (khu tài liệu)

**Date**: 2026-11-17 | **Spec**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md)

## 1. Unit (`apps/web`, project `unit`, happy-dom)

| File | Kiểm | FR / SC |
| --- | --- | --- |
| `docs/nav.test.ts` | `path` duy nhất; ba phần; 17 trang hướng dẫn đúng danh sách; mọi `source` tồn tại; mọi file markdown, file sinh, nhóm biến có đúng một trang; thứ tự trước / sau | FR-002, FR-008, FR-016, FR-017 |
| `docs/render.test.ts` | Tiêu đề thành anchor không dấu, trùng thì thêm hậu tố, tiêu đề "Cookie" và "Location" vẫn có `id`; ô ghi chú; ảnh đổi `src`, thiếu alt thì ném lỗi; bảng có khung cuộn; khối code có và không có ngôn ngữ; `<script>` và `onerror` trong markdown bị lọc; link ngoài có `target` và `rel` | FR-006, FR-010, FR-010a, FR-036, FR-046 |
| `docs/highlight.test.ts` | `bash`, `json`, `graphql` cho ra class `hljs-*`; ngôn ngữ lạ trả chữ đã escape | FR-010a |
| `docs/content.test.ts` | Với mọi trang markdown: link `/docs/...` trỏ tới trang có trong `nav.ts`; anchor trong link có trong trang đích; ảnh được nhắc tới tồn tại và có alt; mọi ảnh trong thư mục được dùng; mỗi ảnh ≤ 300 KB, tổng ≤ 8 MB; mỗi trang hướng dẫn có ít nhất một ảnh và một danh sách đánh số; trang của FR-017 có `backofficeOnly` | FR-018, FR-019, FR-020, FR-034..FR-036, FR-053, SC-003, SC-006 |
| `docs/configuration/variables.test.ts` | Mỗi mục của `supported.generated.json` có đúng một dòng; mỗi dòng khớp đúng một mục; mục không có mặc định để trống | FR-030..FR-033, FR-051, SC-005 |
| `docs/api/generated.test.ts` | Mỗi operation có `rest`; `graphql` là chuỗi hoặc `false`; anchor duy nhất trong resource; mọi `$ref` trong file trỏ tới `schemas` của file; operation dưới `/backoffice/` có `backofficeOnly` | FR-021..FR-027, FR-052, SC-004 |
| `scripts/sync-docs-api.test.ts` | Chạy lại script vào thư mục tạm và so với file đã commit; mọi operation của `openapi.json` (trừ danh sách loại trừ có lý do) và của file bổ sung có trong đầu ra; mọi route `/backoffice/*` khai báo ở năm controller có trong file bổ sung | FR-021, FR-022, FR-052 |
| `scripts/sync-docs-config.test.ts` | Chạy lại script vào file tạm và so với file đã commit | FR-033, FR-051 |
| `scripts/check-brand.test.ts` (sửa) | File `.md` và `.yaml` có từ đứng riêng bị bắt; `directus_files`, `@directus/sdk` không bị bắt | FR-047, SC-011 |
| `scripts/check-bundle.test.ts` (sửa) | `BUDGET_033`; marker của `highlight.js` trong main bundle là lỗi | FR-044, SC-007 |
| `modules/docs.test.ts`, `modules/index.test.ts` (sửa) | Module `docs` ẩn, có ở mọi user có quyền vào app; bảy module nội bộ | FR-001, FR-012 |
| `layout/UserMenu.test.ts` (sửa) | Mục `documentation` trỏ `/docs`; user share không có | FR-014 |
| `modules/docs/routes/DocsRoute.test.ts` | Chọn loại trang theo path; không tìm thấy; lỗi tải và thử lại; cuộn tới anchor; anchor lạ không lỗi; tiêu đề tab | FR-007, FR-009, FR-011 |
| `modules/docs/components/*.test.ts` | Menu (thu gọn, `aria-current`), mục lục (mục đang đọc), pager, khối endpoint (không tham số, 204, không ví dụ GraphQL), bảng biến, nút chép | FR-003..FR-005, FR-024..FR-026 |

Script đọc `libs/specs/dist/openapi.json` và tự gọi `pnpm --filter @backoffice/specs build` khi file chưa có; `apps/web`
không thêm dependency workspace (analyze U2).

Coverage của `apps/web` giữ ngưỡng có sẵn (≥ 60 %).

## 2. Browser (`apps/web`, project `browser`, chromium, axe)

| File | Kiểm |
| --- | --- |
| `modules/docs/routes/DocsRoute.browser.test.ts` | axe ở sáng và tối cho một trang markdown có ảnh, bảng, code, ô ghi chú; một trang resource API; một trang nhóm biến. Không vi phạm mức serious trở lên. Tab qua menu, nội dung, mục lục; focus sau khi đổi trang và sau khi nhảy anchor; ở 768 px trang không cuộn ngang, mục lục ẩn |

## 3. E2E (`apps/web-e2e/src/docs.spec.ts`, ba cấu hình)

| Ca | `proxy-directus` | `proxy-api` | `cors` |
| --- | --- | --- | --- |
| Mở "Tài liệu" từ menu người dùng trong hai lần bấm | ✓ | ✓ | ✓ |
| Đi ba trang bằng menu trái; URL và mục đang mở đổi theo | ✓ | ✓ | ✓ |
| Mở URL có anchor khi đã đăng nhập: đúng tiêu đề trong vùng nhìn | ✓ | ✓ | ✓ |
| Chưa đăng nhập mở URL có anchor, đăng nhập local: về đúng trang và anchor | ✓ | ✓ | ✓ |
| Trang Files của phần API có "List Files"; trang riêng của Backoffice có endpoint index | ✓ | ✓ | — |
| Trang Cấu hình "Chung" có `PUBLIC_URL` với mặc định `/` | — | ✓ | — |
| URL tài liệu không tồn tại: thông báo trong khung và link về trang mở đầu | — | ✓ | — |
| Bàn phím: mở tài liệu và tới một trang chỉ bằng phím | — | ✓ | — |
| Trang tài liệu đầu tiên hiện trong dưới 2 giây (SC-007) | — | ✓ | — |

- Chạy trên chromium-1280 ở mọi cấu hình; chromium-768 thêm ca "menu trái mở bằng nút, không có mục lục".
- `a11y.spec.ts` thêm `/docs` và một trang của mỗi phần.
- `helpers/allowed-paths.ts`: trang tài liệu không gây request API mới ngoài ghi `last_page` đã có; spec kiểm điều này
  bằng helper `requests.ts`.

## 4. Kiểm ví dụ GraphQL (môi trường parity, không so với Directus)

`tests/parity/src/docs/graphql-examples.test.ts`: đọc mọi `apps/web/src/docs/api/generated/*.json`; lấy SDL của hai
scope từ `/server/specs/graphql` của Backoffice đang chạy (token admin); với mỗi ví dụ `graphql` khác `false`, `parse`
rồi `validate` với schema của scope tương ứng; 0 lỗi. Chạy trong lượt parity thường trên Postgres. Đây là kiểm tài liệu
với API thật, không phải đối chiếu hai app (sửa câu chữ FR-055 ở plan).

## 5. Bằng chứng không đổi API

- Bộ đối chiếu hiện có của `/server/specs/oas` và `/server/specs/graphql` (suite `server`, `graphql`) xanh mà không sửa
  normalizer nào (FR-023, SC-008).
- `git diff` của feature không chạm `apps/api/src`, `libs/specs`, `libs/env` (kiểm khi review từng lượt).

## 6. Lệnh chụp ảnh (không chạy trong CI)

`DOCS_SHOTS=1 E2E_CONFIG=proxy-api pnpm --filter @backoffice/web-e2e docs:shots`: project `docs-shots` chạy
`src/docs-shots/*.shots.ts`, ghi PNG vào `apps/web/src/docs/content/images/`. SC-010: chạy hai lần liên tiếp trên cùng
máy, `git status` không báo ảnh nào đổi sau lần hai. Đo một lần ở lượt 3 và ghi kết quả vào spec.

## 7. Cổng trước khi commit từng lượt

`nx run web:lint` (gồm `check-brand`, `check-raw-colors`), `nx run web:test`, `nx run web:build` + `check-bundle`; lượt
2 thêm test parity của §4 trên Postgres; E2E và browser test chạy ở CI (máy local chưa có trình duyệt Playwright cho
tới khi cài ở lượt 3).

Thêm khi checklist 2026-11-17: cuối lượt 1 và lượt 3 chạy `design-system/qa/handoff-checklist.md` cho khu tài liệu (token,
bố cục, trạng thái, giao diện tối, trợ năng) và thêm các cặp màu của khối code vào bảng tương phản của
`design-system/docs/migration-guide.md`.
