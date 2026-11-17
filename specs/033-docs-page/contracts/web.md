# Contract: Web (khu tài liệu)

**Date**: 2026-11-17 | **Spec**: [../spec.md](../spec.md) | **Research**: [../research.md](../research.md)

Không có contract API: feature không thêm, không sửa endpoint nào (FR-048).

## 1. Route và URL

| URL (sau `/admin`) | Trang | Nguồn |
| --- | --- | --- |
| `/docs` | Trang mở đầu | `content/index.md` |
| `/docs/guides/<slug>` | Hướng dẫn (17 trang) | `content/guides/<slug>.md` |
| `/docs/api/<resource>` | Resource API | `api/generated/<resource>.json` |
| `/docs/configuration/<group>` | Nhóm biến | `configuration/variables.ts` + `supported.generated.json` |
| `/docs/<path khác>` | Không tìm thấy, trong khung tài liệu | — |

- Module `docs` (`modules/docs.ts`): `id: 'docs'`, `hidden: true`, `name: '$t:documentation'`, `icon: 'menu_book'`, không
  `preRegisterCheck`; routes `''` và `':path(.*)*'`, cùng `component: () => import('./docs/routes/DocsRoute.vue')`.
- Route private như các module khác; guard có sẵn lo đăng nhập và `redirect` (research R2).
- Anchor: `#<slug>`. Trang markdown: slug của tiêu đề cấp 2 và 3. Trang API: slug của `summary` (ví dụ `#list-files`).
  Trang Cấu hình: slug của tiêu đề bảng con.
- Anchor không có: ở đầu trang, không lỗi (FR-007).

## 2. Thành phần

| File | Việc |
| --- | --- |
| `modules/docs/routes/DocsRoute.vue` | `PrivateView` với `title` của trang, slot `navigation` chứa `DocsNavigation`; chọn loại trang theo `nav.ts`; nạp nội dung; cuộn tới anchor; trạng thái đang tải, lỗi, không tìm thấy |
| `modules/docs/components/DocsNavigation.vue` | Menu trái theo phần, nhóm, trang; nhóm thu gọn được; `aria-current="page"` |
| `modules/docs/components/DocsToc.vue` | "Trên trang này"; đánh dấu mục đang đọc (IntersectionObserver); cuộn riêng |
| `modules/docs/components/DocsArticle.vue` | Hiện HTML đã lọc của trang markdown; gắn nút chép vào khối code |
| `modules/docs/components/DocsApiResource.vue` | Mô tả resource, danh sách endpoint, từng khối endpoint |
| `modules/docs/components/DocsEndpoint.vue` | Một endpoint: method, path, mô tả, tham số, body, trả lời, ví dụ |
| `modules/docs/components/DocsConfigGroup.vue` | Bảng biến của một nhóm |
| `modules/docs/components/DocsCodeBlock.vue` | Khối code tô màu, nút chép, vùng `aria-live` |
| `modules/docs/components/DocsPager.vue` | Trang trước, trang sau |
| `docs/nav.ts`, `docs/types.ts` | Mục lục và kiểu (data-model §1) |
| `docs/render.ts` | Markdown → HTML đã lọc + danh sách tiêu đề (research R5) |
| `docs/highlight.ts` | `highlight.js` core + `bash`, `json`, `graphql` (research R6) |
| `docs/docs.css` | Kiểu của bài viết và bảng màu cú pháp theo token |

Sửa file có sẵn: `modules/index.ts` (thêm module), `layout/UserMenu.vue` (thêm mục), `utils/markdown.ts` (export
`sanitize`), `lang/overlay/en-US.ts`, `vi-VN.ts`, `scripts/check-brand.mjs`, `scripts/check-bundle.mjs`,
`package.json` (dependency, hai script; script `docs:shots` ở `apps/web-e2e/package.json`).

## 3. Hành vi

- **Đổi trang**: bấm menu trái đổi route; nội dung cũ giữ tới khi nội dung mới nạp xong (không nháy trắng), tiêu đề
  tab trình duyệt đổi theo trang; cuộn về đầu trừ khi có hash.
- **Mục lục**: bấm một mục đổi hash bằng `router.replace` rồi cuộn; khi cuộn tay, mục đang đọc đổi nhưng hash không đổi.
- **Chép link tiêu đề**: mỗi tiêu đề có một nút link (hiện khi hover hoặc focus) chép URL đầy đủ có anchor.
- **Chép code**: nút chép lấy chữ gốc của khối; báo "Đã chép" trong vùng `aria-live`; lỗi clipboard báo bằng `notify`.
- **Ví dụ REST / GraphQL**: `BoTabs`; lựa chọn giữ trong phiên của trang (không lưu); endpoint có `graphql: false` chỉ
  hiện REST, không có tab.
- **Trả lời**: mỗi mã trạng thái một dòng; cấu trúc trả lời thành công nằm trong `BoDetail` đóng sẵn.
- **Lỗi tải**: `BoNotice` loại danger và nút thử lại; menu trái vẫn dùng được.
- **Không tìm thấy**: tiêu đề `page_not_found`, thân `page_not_found_body`, link về `/docs`.
- **Ghi chú chỉ có ở Backoffice**: `BoNotice` loại info ở đầu trang (trang có `backofficeOnly`) hoặc đầu khối endpoint.

## 4. Bố cục cho Q-50 (design owner duyệt 2026-11-17)

Phương án A của research R3. Lượt 1 viết thành recipe trong `design-system/docs/component-specs.md` và một mục trong
`layout-patterns.md` trước khi code giao diện.

- **Shell**: `PrivateView` thường. Sidebar app hiện dòng tiêu đề module "Tài liệu" (icon `menu_book`) và menu tài liệu
  trong slot `navigation`. Dưới `xl` sidebar là drawer như mọi module (layout-patterns §2).
- **Menu trái**: tên phần là nhãn `text-theme-xs font-medium uppercase text-gray-500`; tiêu đề nhóm là nút thu gọn
  (`aria-expanded`, chevron ở cuối dòng như D-129); dòng trang là link `menu-dropdown-item` một cấp như sub-menu Settings
  (layout-patterns §12), trang đang mở dùng trạng thái active của mẫu đó.
- **Vùng nội dung**: lưới `xl:grid-cols-[minmax(0,1fr)_14rem] gap-8`. Cột bài viết `max-w-3xl`, căn trái như item page
  (D-150). Cột mục lục chỉ có từ `xl`: `sticky`, cao tối đa bằng vùng nhìn, cuộn riêng; tiêu đề `text-theme-xs
  font-medium uppercase text-gray-500`, mục `text-theme-sm text-gray-600 dark:text-gray-400`, mục đang đọc
  `text-brand-600 dark:text-brand-400` kèm viền đầu dòng `border-s-2 border-brand-500` (không chỉ dựa vào màu).
- **Đầu bài**: breadcrumb `text-theme-xs text-gray-500` (phần / nhóm), tiêu đề trang ở page header của `PrivateView`,
  câu dẫn `text-theme-xl text-gray-500 dark:text-gray-400` ở đầu cột bài viết.
- **Bài viết**: `h2` `text-title-sm` có `border-t border-gray-200 dark:border-gray-800 pt-8 mt-10`; `h3`
  `text-theme-xl font-medium`; đoạn văn và danh sách `text-base` (design owner chọn 2026-11-17), `leading-7`;
  link `text-brand-600 underline-offset-2 hover:underline`.
- **Ô ghi chú**: `BoNotice` có sẵn, loại info và warning.
- **Bảng** (biến, tham số): kiểu bảng tĩnh của design-system (`text-theme-sm`, hàng tiêu đề `bg-gray-50
  dark:bg-white/[0.03]`, viền `border-gray-200 dark:border-gray-800`), tên biến và tham số `font-mono`; bọc trong khung
  `overflow-x-auto rounded-xl border`.
- **Khối endpoint**: Card (`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]`).
  Đầu card: chip method và path `font-mono`. Chip method có chữ, màu theo token: GET `success`, POST `blue-light`, PATCH
  và PUT `warning`, DELETE `error`, HEAD và SEARCH `gray`. Từ `2xl`, thân card hai cột (mô tả, tham số, trả lời bên
  trái; ví dụ và trả lời mẫu bên phải, dính); dưới `2xl` một cột, ví dụ ở cuối.
- **Khối code**: `rounded-xl bg-gray-900 text-gray-100` ở cả hai giao diện (một bảng màu, dễ đạt AA), `font-mono
  text-theme-sm`, `overflow-x-auto`, nút chép `ICON_BTN` ở góc trên cuối. Bảng màu cú pháp trên nền `gray-900`: chuỗi
  `success-400`, số và hằng `orange-400`, từ khóa `warning-300`, thuộc tính và khóa JSON `blue-light-300`, chú thích
  `gray-400`, dấu `gray-300`. Mỗi cặp phải đạt 4,5:1; lượt 1 đo bằng axe và ghi tỉ lệ vào recipe; cặp nào
  không đạt thì đổi sang bậc sáng hơn của cùng họ màu và ghi lại. Một bảng màu cho cả hai giao diện (duyệt 2026-11-17).
- **Không dùng thang `brand-*` cho màu cú pháp** (sửa khi checklist 2026-11-17): thang này sinh từ màu dự án của
  settings (D-158) nên không bảo đảm tương phản. Mỗi cặp màu của khối code được thêm vào bảng tương phản của
  `design-system/docs/migration-guide.md`.
- **Trạng thái tương tác** (sửa khi checklist 2026-11-17): mọi phần tử tương tác của khu tài liệu (dòng menu, mục của
  mục lục, nút chép, nút chép link tiêu đề, link trước và sau, tab ví dụ) dùng recipe `FOCUS` của design-system cho
  `focus-visible` và hover của mẫu `menu-dropdown-item` hoặc của nút tương ứng; không có trạng thái disabled.
- **Đang tải** (sửa khi checklist 2026-11-17): lần tải đầu hiện khung xương của bài viết (các dòng skeleton như
  layout-patterns §11) trong vùng có `aria-busy`; đổi trang thì giữ nội dung cũ tới khi nội dung mới sẵn sàng.
- **Ảnh**: `rounded-xl border border-gray-200 dark:border-gray-700`, rộng tối đa bằng cột; ở giao diện tối viền tách ảnh
  sáng khỏi nền.
- **Trước / sau**: hai link dạng card ở cuối bài, nhãn `previous` / `next` và tên trang.
- **Dưới `xl`**: không có cột mục lục; card endpoint một cột; bảng và code cuộn ngang trong khung của chúng.

Trả lời của design owner 2026-11-17: (a) phương án A; (b) thân bài `text-base` 16 px, bảng, code và menu
`text-theme-sm`; (c) khối code nền tối ở cả hai giao diện; (d) nhãn "Documentation" / "Tài liệu", icon `menu_book`.

## 5. Trợ năng

- Menu trái `<nav aria-label="{{ documentation }}">`; mục lục `<nav aria-label="{{ docs_on_this_page }}">`.
- `aria-current="page"` ở trang đang mở; `aria-current="location"` ở mục đang đọc.
- Vùng bài viết `lang="vi"` (FR-039).
- Bảng trong khung cuộn: `role="region"`, `aria-label` là tiêu đề bảng, `tabindex="0"`; khối code `<pre tabindex="0">`.
- Tiêu đề trang là `h1` của page header; bài viết bắt đầu từ `h2`.
- Sau khi đổi trang, focus chuyển tới tiêu đề trang; sau khi nhảy tới anchor, focus chuyển tới tiêu đề đó
  (`tabindex="-1"`).
- Không vi phạm axe mức serious trở lên ở sáng và tối (FR-043).

Thêm khi checklist 2026-11-17:

- Thứ tự Tab: menu trái, nội dung, mục lục. Hai link bỏ qua có sẵn của shell (tới nội dung, tới điều hướng) áp dụng
  cho khu tài liệu.
- Cấp tiêu đề: trang resource API có tên resource là `h1`, mỗi endpoint là `h2`, các phần của endpoint (tham số, thân
  request, trả lời, ví dụ) là `h3`; trang nhóm biến có mỗi bảng con là `h2`.
- Bảng: hàng tiêu đề là `th` với `scope="col"`; tên bảng là `caption` (ẩn bằng `sr-only` khi tiêu đề đã hiện ngay
  trên bảng).
- Đoạn mô tả lấy từ mô tả API tĩnh có `lang="en"` (FR-039).
- Cuộn tới anchor không dùng cuộn mượt khi `prefers-reduced-motion: reduce`; thu gọn nhóm không có hiệu ứng trong
  trường hợp đó.

## 6. Chuỗi

Có sẵn trong bản dịch sinh từ Directus: `documentation`, `previous`, `next`, `page_not_found`, `page_not_found_body`,
`copy`. Thêm vào overlay en-US và vi-VN:

| Khóa | en-US | vi-VN |
| --- | --- | --- |
| `docs_guides` | Guides | Hướng dẫn |
| `docs_api` | API | API |
| `docs_configuration` | Configuration | Cấu hình |
| `docs_on_this_page` | On this page | Trên trang này |
| `docs_copied` | Copied | Đã chép |
| `docs_copy_link` | Copy link to this section | Chép link tới mục này |
| `docs_load_error` | This page could not be loaded. | Không tải được trang này. |
| `docs_retry` | Try again | Thử lại |
| `docs_back_home` | Back to the documentation home | Về trang mở đầu của tài liệu |
| `docs_backoffice_only` | Available only when the server is Backoffice. | Chỉ có khi máy chủ là Backoffice. |
| `docs_endpoints` | Endpoints | Endpoint |
| `docs_query_parameters` | Query parameters | Tham số query |
| `docs_path_parameters` | Path parameters | Tham số đường dẫn |
| `docs_request_body` | Request body | Thân request |
| `docs_responses` | Responses | Trả lời |
| `docs_response_example` | Response example | Trả lời mẫu |
| `docs_required` | required | bắt buộc |
| `docs_variable` | Variable | Biến |
| `docs_description` | Description | Mô tả |
| `docs_default` | Default | Mặc định |

Lượt 1 đọc bản vi-VN của sáu khóa có sẵn; khóa nào chưa có hoặc không hợp thì thay bằng một khóa mới `docs_*` ở cả hai overlay, không ghi đè khóa có sẵn (research R11).
