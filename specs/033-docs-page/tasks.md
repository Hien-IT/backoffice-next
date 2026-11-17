---

description: "Danh sách task cho feature 033: trang tài liệu (docs) trong app Backoffice"
---

# Tasks: Trang tài liệu (docs) trong app Backoffice

**Input**: Tài liệu thiết kế trong `/specs/033-docs-page/`
**Prerequisites**: `plan.md`, `spec.md` (D-215, Q-50 phương án A, `highlight.js` 11.12.0, ba điểm Complexity Tracking,
tám sửa câu chữ của plan và hai mươi sáu sửa của checklist: duyệt 2026-11-17). Dùng thêm `research.md` (R1–R15),
`data-model.md`, `contracts/` (`web.md`, `tests.md`), `quickstart.md`, `checklists/` (requirements, content,
design-system, security, a11y).

**Điều kiện bắt đầu**: spec, plan, research, data-model, contracts, quickstart, checklists và tasks của 033 đã commit lên
`main` (`docs(033): ...`). Làm trên `main`, không branch; script `.specify` cần `SPECIFY_FEATURE=033-docs-page`.
Checkout dùng chung với các phiên khác: `git add` theo đường dẫn, không `git add -A`/`.`, không `stash`, `reset`,
`checkout --`; không stage `apps/api/project.json`, `apps/web/project.json`; chỉ push khi `main` không có run CI đang
chạy. Không sửa file dưới `directus/`, `apps/api/src`, `libs/specs`, `libs/env`. Máy local: chạy test từng file,
`--maxWorkers=1`; không dừng container của phiên khác.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Không endpoint nào được thêm hay đổi, nên không có ca đối chiếu mới với Directus. Bộ đối chiếu, blackbox và E2E hiện
  có phải xanh (SC-008).
- Một test chạy trong môi trường parity nhưng không so với Directus: `tests/parity/src/docs/graphql-examples.test.ts`.
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code.
- Mọi khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X).
- Nội dung: không từ "Directus" đứng riêng ở bất kỳ file nào dưới `apps/web/src/docs/` (FR-047).

**Organization**: Task nhóm theo user story, xếp theo ba lượt commit:
- **Lượt 1 (Khung và Cấu hình)** = Phase 1 (Setup), 2 (Foundational), 3 (US1 khung), 4 (US2 Cấu hình), 5 (US6, E2E,
  đóng lượt).
- **Lượt 2 (API reference)** = Phase 6 (US3), 7 (đóng lượt).
- **Lượt 3 (Hướng dẫn và ảnh)** = Phase 8 (US4, US5), 9 (Polish, đóng lượt).

Mỗi lượt kết thúc bằng task "đóng lượt": lint, typecheck, test, build, `check-bundle` xanh; commit; push khi CI của commit trước
xanh; theo dõi CI tới khi xanh.

## Quy ước

- `[P]`: file khác nhau, không phụ thuộc task chưa xong; chạy song song được.
- `[USn]`: user story của spec. US5 (tài liệu không lệch với sản phẩm) không có phase riêng: các test canh giữ của nó
  nằm trong phase của phần nội dung tương ứng và mang nhãn `[US5]`.
- Đường dẫn tính từ gốc repo. `docs/` nghĩa là `apps/web/src/docs/`; `modules/docs/` nghĩa là
  `apps/web/src/modules/docs/`.
- Comment trong `apps/web` viết "DR" (Nguyên tắc IX); file mới ghi đầu file `Backoffice (spec 033)`; chỗ sửa file port ghi
  `Backoffice (spec 033, D-215)`.

## Phase 1: Setup (chốt [Unverified] của research, dependency, recipe; lượt 1)

**Mục tiêu**: các điểm chưa kiểm của research có kết quả; dependency đã cài và audit; recipe Q-50 có trước khi code
giao diện.

- [X] T001 Kiểm ba mục [Unverified] của `specs/033-docs-page/research.md`: (3) đọc
  `apps/web/src/routes/login/SsoLinks.vue` và luồng `continue` để biết hash có sống qua đăng nhập SSO không; (5) đọc
  `apps/web/src/lang/translations/vi-VN.json` cho sáu khóa `documentation`, `previous`, `next`, `page_not_found`,
  `page_not_found_body`, `copy`; (7) đọc `apps/web/src/layout/MainContent.vue` và `PrivateView.vue` để biết phần tử nào
  cuộn. Ghi mục "Kết quả kiểm T001" vào research.md; nếu hash mất qua SSO thì đổi dòng [Unverified] ở Edge Cases của
  `spec.md` thành giới hạn đã xác nhận
- [X] T002 Thêm `highlight.js: 11.12.0` vào catalog của `pnpm-workspace.yaml` và `"highlight.js": "catalog:"` vào
  `dependencies` của `apps/web/package.json`; `pnpm install`; chạy `pnpm audit` và ghi kết quả vào research R6; xác nhận
  bằng một lệnh `node -e` rằng `highlight.js/lib/core` và `lib/languages/{bash,json,graphql}` import được dạng ESM và
  đầu ra dùng class `hljs-*`, rồi bỏ nhãn [Unverified] của các dòng đó trong bảng R6. Kiểm `git diff pnpm-lock.yaml`
  không đổi gói nào ngoài `highlight.js`
- [X] T003 Viết recipe "Documentation area (Q-50; spec 033, D-215, no Directus counterpart)" vào
  `design-system/docs/component-specs.md` và một mục "15. Documentation area (033)" vào
  `design-system/docs/layout-patterns.md` theo `contracts/web.md` §4 và §5 (phương án A, thân bài `text-base`, khối code
  nền `gray-900` ở cả hai giao diện, từ khóa `warning-300`, không dùng `brand-*` cho màu cú pháp, recipe `FOCUS`, trạng
  thái đang tải). Tính tỉ lệ tương phản của từng cặp màu khối code trên `gray-900` và thêm vào bảng tương phản của
  `design-system/docs/migration-guide.md`; cặp dưới 4,5:1 đổi sang bậc sáng hơn cùng họ và sửa `contracts/web.md` §4
- [X] T004 [P] Thêm script `"sync-docs-config": "jiti scripts/sync-docs-config.mjs"` vào `scripts` của
  `apps/web/package.json` (không sửa `apps/web/project.json`). Script `sync-docs-api` thêm ở T058 cùng file của
  nó (lượt 1: không để script trỏ tới file chưa có)
- [X] T005 [P] Tạo `apps/web/src/docs/types.ts` với các kiểu của `data-model.md` §1–§4 (`DocsNav`, `DocsSection`,
  `DocsGroup`, `DocsPage`, `DocsHeading`, `DocsApiResource`, `DocsApiOperation`, `DocsApiParameter`,
  `SupportedGenerated`, `ConfigGroup`, `ConfigRow`)

- [X] T005a Cài trình duyệt Playwright một lần (`pnpm --filter @backoffice/web-e2e exec playwright install chromium`)
  để browser test và E2E của cả ba lượt chạy được ở máy local (analyze L9). Nếu không cài được: ghi vào
  `specs/033-docs-page/research.md`; browser test và E2E khi đó chỉ chạy ở CI, và T070 là điểm dừng

**Checkpoint**: research không còn mục [Unverified] số 3, 5, 7; `pnpm install` xanh; recipe Q-50 có trong design-system.

## Phase 2: Foundational (kiểm thương hiệu, bundle, renderer, tô màu, module; lượt 1)

**Mục tiêu**: mọi story sau dùng được renderer, bộ tô màu, mục lục và module `docs`.

**⚠️ CRITICAL**: không story nào bắt đầu trước khi phase này xong.

### Tests (MANDATORY) ⚠️

- [X] T006 [P] Sửa `apps/web/scripts/check-brand.test.ts`: file `.md` và `.yaml` có từ "Directus" đứng riêng bị báo; có
  `directus_files`, `@directus/sdk`, `directus_session_token` thì không; dòng có `//` trong `.md` vẫn được quét nguyên
  văn (research R9)
- [X] T007 [P] Sửa `apps/web/scripts/check-bundle.test.ts`: có `BUDGET_033 = BUDGET_020 + 2 * 1024`; marker của
  `highlight.js` nằm trong main bundle là lỗi (research R12)
- [X] T008 [P] Viết `apps/web/src/docs/render.test.ts` theo `contracts/tests.md` §1: anchor không dấu ("Đồng bộ môi
  trường" → `dong-bo-moi-truong`), tiêu đề trùng thêm `-2`, tiêu đề "Cookie" và "Location" vẫn có `id` (mục [Unverified]
  số 4), danh sách `DocsHeading` hai cấp, `> [!NOTE]` và `> [!WARNING]` thành ô ghi chú, ảnh đổi `src` theo bảng URL và
  ném lỗi khi thiếu alt hoặc alt là tên file, bảng có khung cuộn `role="region"` `tabindex="0"` và `th scope="col"`,
  khối code có và không có ngôn ngữ, `<script>` và `onerror` bị lọc, link ngoài có `target="_blank"` và
  `rel="noopener noreferrer"`, link nội bộ không có
- [X] T009 [P] Viết `apps/web/src/docs/highlight.test.ts`: `bash`, `json`, `graphql` cho ra `span` có class `hljs-*`;
  ngôn ngữ lạ và không ghi ngôn ngữ trả chữ đã escape, không ném lỗi
- [X] T010 [P] Sửa `apps/web/src/utils/markdown.test.ts`: `sanitize(html)` được export và lọc như phần lọc của `md()`;
  kết quả của `md()` với các ca hiện có không đổi
- [X] T011 [P] Viết `apps/web/src/docs/nav.test.ts`: `path` duy nhất; đúng ba phần theo thứ tự `guides`, `api`,
  `configuration`; mọi `source` tồn tại; thứ tự phẳng cho trang trước và trang sau; hàm tìm trang theo path trả
  `undefined` cho path lạ
- [X] T012 [P] Viết `apps/web/src/modules/docs.test.ts` và sửa `apps/web/src/modules/index.test.ts`: module `docs` có
  `hidden: true`, không `preRegisterCheck`, hai route `''` và `':path(.*)*'`; `getInternalModules()` trả bảy module

### Implementation

- [X] T013 Sửa `apps/web/scripts/check-brand.mjs`: quét thêm đuôi `md` và `yaml`; hai đuôi này quét nguyên văn, không qua
  `stripComments`; không thêm mục nào vào `PATH_EXCEPTIONS` (T006 xanh)
- [X] T014 Sửa `apps/web/scripts/check-bundle.mjs`: thêm `BUDGET_033`, dùng nó làm giới hạn; thêm marker của
  `highlight.js` vào danh sách thư viện chỉ được ở chunk lazy (T007 xanh)
- [X] T015 Sửa `apps/web/src/utils/markdown.ts`: tách và export `sanitize(html: string): string` dùng chính instance
  DOMPurify có hook link ngoài; `md()` gọi `sanitize` (T010 xanh)
- [X] T016 Viết `apps/web/src/docs/highlight.ts`: `highlight.js/lib/core` với ba ngôn ngữ `bash`, `json`, `graphql`;
  hàm `highlight(code, lang)` trả HTML, ngôn ngữ lạ thì escape (T009 xanh)
- [X] T017 Viết `apps/web/src/docs/render.ts`: một instance `Marked` riêng với renderer của research R5, gọi `sanitize`
  rồi xử lý DOM để gắn `id` (slug bằng `@sindresorhus/slugify`, hậu tố khi trùng) và trả `{ html, headings }` (T008
  xanh)
- [X] T018 Viết `apps/web/src/docs/nav.ts` (trang mở đầu và khung ba phần; phần `guides` và `api` để trống cho tới lượt
  3 và 2) và `apps/web/src/docs/docs.css` (kiểu bài viết, bảng, ô ghi chú, khối code và bảng màu cú pháp theo recipe
  của T003, chỉ dùng token) (T011 xanh)
- [X] T019 Viết `apps/web/src/modules/docs.ts` (`id: 'docs'`, `hidden: true`, `name: '$t:documentation'`, `icon:
  'menu_book'`, hai route cùng `component: () => import('./docs/routes/DocsRoute.vue')`) và thêm vào
  `getInternalModules()` của `apps/web/src/modules/index.ts`, sửa chú thích "six internal modules" (T012 xanh)

**Checkpoint**: `nx run web:lint` xanh (gồm `check-brand`); unit của `docs/`, `scripts/`, `modules/` xanh.

## Phase 3: User Story 1 - Mở tài liệu từ app và đi lại trong đó (Priority: P1, lượt 1) 🎯 MVP

**Goal**: user mở "Tài liệu" từ menu người dùng, đi lại bằng menu trái, mục lục, trang trước và sau, mở được link có
anchor.

**Independent Test**: đăng nhập, mở "Tài liệu", đi ba trang, nhảy tới một tiêu đề, chép URL có anchor, đăng xuất, mở
URL, đăng nhập và thấy đúng tiêu đề.

### Tests for User Story 1 (MANDATORY) ⚠️

- [X] T020 [P] [US1] Viết `apps/web/src/modules/docs/routes/DocsRoute.test.ts`: chọn loại trang theo path; trang mở đầu
  ở `/docs`; path lạ hiện `page_not_found` và link về `/docs`; đang tải có `aria-busy`; lỗi tải hiện `BoNotice` và nút
  thử lại; đổi trang giữ nội dung cũ tới khi nội dung mới xong; cuộn tới anchor sau khi render và khi hash đổi; anchor
  lạ không lỗi; tiêu đề tab đổi theo trang; focus tới tiêu đề trang sau khi đổi trang; breadcrumb (phần, nhóm) và câu dẫn ở đầu cột
  bài viết (FR-004); trang có `backofficeOnly` hiện `BoNotice` `docs_backoffice_only` (FR-019); user không có quyền
  vào app thấy màn hình không có quyền của `PrivateView`, không thấy nội dung; cuộn tới anchor không dùng cuộn mượt
  khi `prefers-reduced-motion: reduce` (FR-043)
- [X] T021 [P] [US1] Viết `apps/web/src/modules/docs/components/DocsNavigation.test.ts`: ba phần, nhóm thu gọn và mở
  (`aria-expanded`), `aria-current="page"` ở trang đang mở, `nav` có `aria-label`
- [X] T022 [P] [US1] Viết `apps/web/src/modules/docs/components/DocsToc.test.ts`: danh sách từ `headings`, bấm đổi hash
  bằng `router.replace`, mục đang đọc có `aria-current="location"`, trang không có tiêu đề thì không hiện
- [X] T023 [P] [US1] Viết `apps/web/src/modules/docs/components/DocsArticle.test.ts`, `DocsCodeBlock.test.ts`,
  `DocsPager.test.ts`: bài viết có `lang="vi"`; mỗi tiêu đề có nút chép link; khối code có nút chép lấy chữ gốc, báo
  `docs_copied` trong vùng `aria-live`, lỗi clipboard gọi `notify`; trang đầu không có link trước, trang cuối không có
  link sau; kết quả tô màu đi qua `sanitize` trước khi vào `v-html` (khối code chứa `<img onerror>` hiện thành chữ,
  FR-046)
- [X] T024 [P] [US1] Sửa `apps/web/src/layout/UserMenu.test.ts`: mục `documentation` (icon `menu_book`) trỏ `/docs`,
  đứng trước `sign_out`; user share không có mục này
- [X] T025 [P] [US1] Thêm vào `apps/web/src/lang/overlay.test.ts` một ca: mọi khóa `docs_*` của `contracts/web.md` §6
  có ở cả hai overlay. Hai ca có sẵn (hai overlay cùng tập khóa; khóa overlay không trùng khóa của bản dịch gốc)
  không sửa

### Implementation for User Story 1

- [X] T026 [US1] Thêm các khóa `docs_*` của `contracts/web.md` §6 vào `apps/web/src/lang/overlay/en-US.ts` và
  `vi-VN.ts`. Không ghi đè khóa có sẵn của bản dịch gốc (`overlay.test.ts` cấm, analyze I1): nếu T001 thấy bản vi-VN
  của một khóa có sẵn thiếu hoặc không hợp thì thêm một khóa mới `docs_*` ở cả hai overlay (ví dụ `docs_title` cho
  mục menu) và dùng khóa đó thay khóa có sẵn (T025 xanh)
- [X] T027 [US1] Sửa `apps/web/src/layout/UserMenu.vue`: thêm mục "Tài liệu" cho user không phải share (T024 xanh)
- [X] T028 [P] [US1] Viết `apps/web/src/modules/docs/components/DocsCodeBlock.vue` (T023 xanh phần code)
- [X] T029 [P] [US1] Viết `apps/web/src/modules/docs/components/DocsPager.vue` (T023 xanh phần pager)
- [X] T030 [US1] Viết `apps/web/src/modules/docs/components/DocsArticle.vue`: hiện HTML của `render.ts`, gắn
  `DocsCodeBlock` và nút chép link tiêu đề (T023 xanh)
- [X] T031 [P] [US1] Viết `apps/web/src/modules/docs/components/DocsNavigation.vue` theo recipe menu trái của T003 (T021
  xanh)
- [X] T032 [P] [US1] Viết `apps/web/src/modules/docs/components/DocsToc.vue` với IntersectionObserver trên phần tử cuộn
  mà T001 xác định; tôn trọng `prefers-reduced-motion` (T022 xanh)
- [X] T033 [US1] Viết `apps/web/src/modules/docs/routes/DocsRoute.vue`: `PrivateView`, slot `navigation`, nạp markdown
  bằng `import.meta.glob` lazy và ảnh bằng glob `?url` (research R4), lưới bài viết và mục lục, breadcrumb và câu dẫn ở đầu cột bài viết (prop `breadcrumb` của `PrivateView` không
  hiển thị, D-101), ghi chú `docs_backoffice_only`, các trạng thái (T020
  xanh)
- [X] T034 [US1] Viết `apps/web/src/docs/content/index.md` (trang mở đầu: ba phần của tài liệu, cách dùng menu trái, mục
  lục và link tới tiêu đề); thêm vào `nav.ts`
- [X] T035 [US1] Viết `apps/web/src/modules/docs/routes/DocsRoute.browser.test.ts`: axe ở sáng và tối cho trang mở đầu;
  Tab đi theo thứ tự menu trái, nội dung, mục lục; ở 768 px trang không cuộn ngang và không có mục lục; đổi giao diện
  sáng, tối và đổi ngôn ngữ khi đang đọc thì vị trí cuộn giữ nguyên

**Checkpoint**: unit và browser test của khu tài liệu xanh; mở `/admin/docs` trên Vite dev thấy trang mở đầu.

## Phase 4: User Story 2 - Tra biến môi trường (Priority: P1, lượt 1)

**Goal**: phần Cấu hình có mọi biến Backoffice đọc và dùng, theo nhóm, mặc định sinh từ code.

**Independent Test**: mở phần Cấu hình, tìm `PUBLIC_URL`, đọc mô tả và mặc định `/`.

### Tests for User Story 2 (MANDATORY) ⚠️

- [X] T036 [P] [US2] Viết `apps/web/scripts/sync-docs-config.test.ts`: chạy script vào file tạm và so với
  `docs/configuration/supported.generated.json` đã commit; mỗi mục có `pattern`, `exact`; `CONFIG_PATH` có mặc định
  hiển thị `.env`, không phải đường dẫn của máy
- [X] T037 [P] [US2] [US5] Viết `apps/web/src/docs/configuration/variables.test.ts`: mỗi mục của file sinh có đúng một
  `ConfigRow`; mỗi `ConfigRow` khớp đúng một mục; mỗi biến ở đúng một nhóm; mỗi `description` không rỗng; thông báo lỗi
  nêu tên biến thiếu hoặc thừa
- [X] T038 [P] [US2] Viết `apps/web/src/modules/docs/components/DocsConfigGroup.test.ts`: ba cột `docs_variable`,
  `docs_description`, `docs_default`; mặc định lấy từ file sinh, không có thì ô trống; mỗi bảng con là `h2` có anchor;
  `th scope="col"`; tên biến `font-mono`; mô tả có `<script>` hiện thành chữ, không thành phần tử (FR-046)

### Implementation for User Story 2

- [X] T039 [US2] Viết `apps/web/scripts/sync-docs-config.mjs` (chạy bằng `jiti`): đọc `SUPPORTED_VARIABLES` của
  `apps/api/src/config/supported-variables.ts` và `DEFAULTS` của `libs/env/src/constants/defaults.ts`, ghi
  `apps/web/src/docs/configuration/supported.generated.json` với dòng `$source`; bảng nhỏ giá trị hiển thị thay cho
  mặc định phụ thuộc máy; chạy script và commit file sinh (T036 xanh)
- [X] T040 [US2] Viết `apps/web/src/docs/configuration/variables.ts`: các nhóm biến và một dòng cho mỗi mục của file
  sinh (khoảng 190 dòng); mỗi mô tả nêu biến làm gì và dạng giá trị (FR-030); biến dùng chung với hệ thống cùng DB ghi
  "phải trùng với hệ thống dùng chung cơ sở dữ liệu, nếu có"; không giá trị thật của bí mật (T037 xanh)
- [X] T041 [US2] Viết `apps/web/src/modules/docs/components/DocsConfigGroup.vue`; thêm mỗi nhóm thành một trang
  `configuration/<id>` trong `nav.ts`; `DocsRoute.vue` hiện trang loại `configuration` (T038 xanh)

**Checkpoint**: trang `/admin/docs/configuration/general` có `PUBLIC_URL` với mặc định `/`; `variables.test.ts` xanh.

## Phase 5: User Story 6 + E2E + đóng lượt 1 (Priority: P2)

**Goal**: không gì ở API đổi; khu tài liệu chạy ở cả ba cấu hình.

- [X] T042 [US6] Viết `apps/web-e2e/src/docs.spec.ts` với các ca lượt 1 của `contracts/tests.md` §3: mở từ menu người
  dùng trong hai lần bấm (ba cấu hình); đi ba trang bằng menu trái; URL có anchor khi đã đăng nhập; chưa đăng nhập mở
  URL có anchor rồi đăng nhập local; trang "Chung" có `PUBLIC_URL` mặc định `/`; URL không tồn tại; chỉ dùng bàn phím;
  trang đầu hiện dưới 2 giây; chromium-768: menu trái mở bằng nút, không có mục lục; không request API mới ngoài ghi
  `last_page` (helper `requests.ts`); ở `proxy-api` không có thông báo vi phạm CSP nào trong console khi mở một trang
  có khối code (FR-048a); từ trang mở đầu tới dòng của biến `PUBLIC_URL` chỉ bằng menu trái và mục lục trong không
  quá 4 lần bấm (SC-002)
- [X] T043 [US6] Sửa `apps/web-e2e/src/a11y.spec.ts`: thêm `/docs` và `/docs/configuration/general`; sửa
  `apps/web-e2e/src/helpers/allowed-paths.ts` nếu spec cần
- [X] T044 Đo và ghi vào research R6, R12: `nx run web:build`, `node apps/web/scripts/check-bundle.mjs` (main bundle trước
  và sau feature, SC-007), dung lượng nén của chunk khu tài liệu và phần `highlight.js` trong đó; bỏ nhãn [Unverified]
  số 1, 2, 4 trong bảng cuối research. Đây là bằng chứng của SC-007 (`BUDGET_033` chỉ là trần tuyệt đối): nếu main
  bundle tăng quá 2 KB nén so với trước feature thì chuyển phần thừa vào chunk lazy rồi đo lại
- [X] T045 Chạy `design-system/qa/handoff-checklist.md` cho khu tài liệu (token, bố cục, trạng thái, giao diện tối, trợ
  năng) và ghi kết quả vào mục "Kết quả lượt 1" của `specs/033-docs-page/research.md`
- [X] T046 [US6] Kiểm `git diff --stat` của lượt không chạm `apps/api/src`, `libs/specs`, `libs/env`, `directus/`; ghi
  vào research rằng bộ đối chiếu của `/server/specs/oas` không cần sửa normalizer
- [X] T047 Chạy `graphify update .`; cập nhật dòng "Trạng thái" của mục 033 trong `SPECKIT-GUIDE.md` và `Status` của
  `specs/033-docs-page/spec.md` (lượt 1)
- [X] T048 Đóng lượt 1: `nx run web:lint`, `pnpm --filter @backoffice/web typecheck`, `nx run web:test`, `nx run web:build`, `check-bundle` xanh; `git add` theo
  đường dẫn; commit `feat(web): documentation area with the frame and the configuration reference (spec 033)`; push khi
  CI của commit trước xanh; theo dõi CI (unit, browser, E2E ba cấu hình) tới khi xanh

**Checkpoint**: lượt 1 trên `main`, CI xanh.

## Phase 6: User Story 3 - Tra API reference (Priority: P1, lượt 2)

**Goal**: mỗi resource có một trang, mỗi endpoint có một mục với tham số, trả lời, ví dụ REST và GraphQL; có cả
`/backoffice/*`.

**Independent Test**: mở trang Files, tới "List Files", đọc tham số `fields` và ví dụ REST; mở nhóm endpoint riêng và
thấy endpoint tạo index.

- [X] T049 [US3] Ghi vào research R7 quyết định của chủ dự án 2026-11-17 (analyze U1): phần mô tả lấy từ mô tả API
  tĩnh được hiện nguyên văn trong tài liệu (gói nguồn `directus/packages/specs` ghi `"license": "BUSL-1.1"`). Không
  có điểm dừng. Dòng `$source` của mỗi file sinh ghi đường dẫn `libs/specs/dist/openapi.json` và tên script, không
  chứa từ bị cấm của FR-047
- [X] T050 [US3] Đối chiếu 133 operation của `libs/specs/dist/openapi.json` với route của các controller trong
  `apps/api/src/controllers/` (mục [Unverified] số 6): ghi bảng kết quả vào research R7; operation Backoffice không
  phục vụ vào danh sách loại trừ có lý do; liệt kê mọi route của năm `backoffice-*.controller.ts` kèm ai gọi được
  (admin, user đã đăng nhập, không cần đăng nhập)

### Tests for User Story 3 (MANDATORY) ⚠️

- [X] T051 [P] [US3] Viết `apps/web/scripts/sync-docs-api.test.ts`: chạy script vào thư mục tạm và so với
  `docs/api/generated/` đã commit; mọi operation của `openapi.json` trừ danh sách loại trừ có trong đầu ra; mọi route
  của T050 có trong file bổ sung; `example` có từ "Directus" đứng riêng đã được thay; lệnh curl dùng
  `https://backoffice.example.com` và `<token>`
- [X] T052 [P] [US3] [US5] Viết `apps/web/src/docs/api/generated.test.ts`: mỗi operation có `rest`; `graphql` là chuỗi
  hoặc `false`, không thiếu; `anchor` duy nhất trong resource; mọi `$ref` trỏ tới `schemas` của chính file; operation
  dưới `/backoffice/` có `backofficeOnly` và trường ai gọi được
- [X] T053 [P] [US3] Viết `apps/web/src/modules/docs/components/DocsApiResource.test.ts` và `DocsEndpoint.test.ts`: danh
  sách endpoint link tới anchor; endpoint là `h2`, các phần là `h3`; tham số tách query, đường dẫn và thân request;
  trả lời theo mã, cấu trúc trong `BoDetail` đóng sẵn; tab REST / GraphQL bằng `BoTabs`, `graphql: false` thì không có
  tab; endpoint không tham số, trả 204 hoặc không có trả lời mẫu thì không hiện phần trống; chip method có chữ; ghi chú
  `docs_backoffice_only`; mô tả lấy từ mô tả tĩnh có `lang="en"`; mô tả có `<script>` hoặc `onerror` bị lọc (FR-046)
- [X] T054 [P] [US3] Viết `tests/parity/src/docs/graphql-examples.test.ts`: đọc mọi `apps/web/src/docs/api/generated/*.json`,
  lấy SDL hai scope từ `/server/specs/graphql` của Backoffice đang chạy, `parse` và `validate` từng ví dụ `graphql`
  khác `false`; 0 lỗi (`contracts/tests.md` §4)

### Implementation for User Story 3

- [X] T055 [US3] Bảo đảm `libs/specs/dist/openapi.json` có trước khi script và test của web chạy: `sync-docs-api.mjs`
  gọi `pnpm --filter @backoffice/specs build` khi file chưa có (không thêm dependency workspace vào
  `apps/web/package.json`, analyze U2); xác nhận bằng một lần chạy `sync-docs-api.test.ts` sau khi xóa
  `libs/specs/dist`
- [X] T056 [P] [US3] Viết bảy file bổ sung OpenAPI `apps/web/src/docs/api/supplement/{policies,access,dashboards,panels,
  notifications,translations,shares}.yaml` từ controller và service tương ứng trong `apps/api/src` (tag, path, tham
  số, trả lời, giá trị ví dụ)
- [X] T057 [P] [US3] Viết `apps/web/src/docs/api/supplement/backoffice.yaml` cho mọi route `/backoffice/*` của T050, mỗi
  operation ghi ai gọi được
- [X] T058 [US3] Viết `apps/web/scripts/sync-docs-api.mjs`: gộp `openapi.json` và file bổ sung, một resource cho mỗi
  tag, thay `$ref` của tham số, giữ `$ref` schema theo tên trong file, sinh curl, sinh ví dụ GraphQL theo quy tắc CRUD
  cho tag có `x-collection` và theo bảng viết tay cho operation khác (`false` khi không tương đương), danh sách loại
  trừ của T050, thay giá trị ví dụ có từ bị cấm, ghi `docs/api/generated/<resource>.json` và một file chỉ mục
  `index.json` (id, tên, `backofficeOnly`); thêm script `"sync-docs-api": "node scripts/sync-docs-api.mjs"` vào
  `apps/web/package.json` (T051 xanh)
- [X] T059 [US3] Chạy `pnpm --filter @backoffice/web sync-docs-api`; commit `apps/web/src/docs/api/generated/` (T052
  xanh)
- [X] T060 [P] [US3] Viết `apps/web/src/modules/docs/components/DocsEndpoint.vue` theo recipe khối endpoint của T003
- [X] T061 [US3] Viết `apps/web/src/modules/docs/components/DocsApiResource.vue`; phần `api` của `nav.ts` lấy từ
  `index.json` (resource xếp theo bảng chữ cái, nhóm endpoint riêng ở cuối); `DocsRoute.vue` nạp lazy file của resource
  và hiện trang loại `api` (T053 xanh)
- [X] T062 [US3] Thêm vào `apps/web-e2e/src/docs.spec.ts` ca "trang Files có List Files; trang endpoint riêng có endpoint
  index" (`proxy-directus`, `proxy-api`) và ca "từ trang mở đầu tới mục List Files chỉ bằng menu trái và mục lục trong
  không quá 4 lần bấm" (SC-002); thêm một trang resource vào `DocsRoute.browser.test.ts` (axe sáng và tối) và
  `/docs/api/files` vào `apps/web-e2e/src/a11y.spec.ts`

**Checkpoint**: `/admin/docs/api/files#list-files` hiện đủ các phần; unit web xanh.

## Phase 7: Đóng lượt 2

- [X] T063 Chạy `TEST_DB=postgres` test `tests/parity/src/docs/graphql-examples.test.ts` trên môi trường parity local
  (T054 xanh); ví dụ sai thì sửa quy tắc hoặc bảng viết tay của `sync-docs-api.mjs`, chạy lại T059
- [X] T064 Kiểm `git diff --stat` của lượt không chạm `apps/api/src`, `libs/specs`, `libs/env`; `check-bundle` xanh (file
  API là chunk lazy); `graphify update .`; cập nhật "Trạng thái" trong `SPECKIT-GUIDE.md` và `Status` của `spec.md`
  (lượt 2)
- [X] T065 Đóng lượt 2: `nx run web:lint`, `pnpm --filter @backoffice/web typecheck`, `nx run web:test`, `nx run web:build` xanh; commit `feat(web): API reference
  in the documentation area (spec 033)`; push khi CI của commit trước xanh; theo dõi CI (gồm parity Postgres và E2E)
  tới khi xanh

**Checkpoint**: lượt 2 trên `main`, CI xanh.

## Phase 8: User Story 4 + User Story 5 - Hướng dẫn có ảnh, kiểm nội dung (Priority: P2, lượt 3)

**Goal**: 17 trang hướng dẫn có bước và ảnh; kiểm tự động giữ link, anchor và ảnh đúng; ảnh chụp lại được bằng một
lệnh.

**Independent Test**: mở trang hướng dẫn Files, làm theo các bước trong một tab khác và thấy màn hình khớp ảnh; sửa tạm
một link nội bộ thành sai và thấy test đỏ.

### Tests (MANDATORY) ⚠️

- [X] T066 [P] [US5] Viết `apps/web/src/docs/content.test.ts` theo `contracts/tests.md` §1: link `/docs/...` trỏ tới
  trang có trong `nav.ts`; anchor của link có trong trang đích; ảnh được nhắc tới tồn tại, có alt không rỗng và không
  là tên file; mọi ảnh trong thư mục được dùng; mỗi ảnh ≤ 300 KB, tổng ≤ 8 MB; mỗi trang hướng dẫn có ít nhất một ảnh
  và một danh sách đánh số; trang của FR-017 có `backofficeOnly`
- [X] T067 [P] [US4] Sửa `apps/web/src/docs/nav.test.ts`: phần `guides` có đúng 17 trang của FR-016 và FR-017, chia hai
  nhóm "Module" (9) và "Tính năng riêng" (8)

### Implementation: công cụ chụp

- [X] T068 [US4] Sửa `apps/web-e2e/playwright.config.ts`: khi `DOCS_SHOTS=1` chỉ có project `docs-shots` (chromium
  1280×800, `deviceScaleFactor: 1`, `colorScheme: 'light'`, `testMatch: 'docs-shots/*.shots.ts'`); khi không đặt thì
  các project hiện có không chạy file `.shots.ts`. Thêm script `"docs:shots": "playwright test --config
  playwright.config.ts"` vào `apps/web-e2e/package.json`
- [X] T069 [US4] Viết `apps/web-e2e/src/docs-shots/shot.ts`: helper `shot(page, name, { mask })` ghi
  `apps/web/src/docs/content/images/<name>.png` với `animations: 'disabled'`, `caret: 'hide'`; fixture đăng nhập bằng
  user có ngôn ngữ vi-VN, `page.clock.install` với giờ cố định; che token, mã QR, URL và token của trang đồng bộ
  (FR-037)
- [X] T070 [US4] Dựng ở máy local môi trường `web` của parity và profile `sync` (nguồn `backoffice-api-sync` cho ảnh
  của trang đồng bộ môi trường, như `apps/web-e2e/src/settings-sync.spec.ts`). **Nếu T005a không cài được trình
  duyệt hoặc môi trường không chạy được: dừng và báo chủ dự án** (clarify câu 3: ảnh chụp tay trên máy có trình
  duyệt)

### Implementation: 9 trang module (mỗi task: kịch bản chụp + trang markdown theo FR-018, FR-018a, FR-020)

- [X] T071 [P] [US4] Content: `apps/web-e2e/src/docs-shots/content.shots.ts`, `apps/web/src/docs/content/guides/content.md`
- [X] T072 [P] [US4] Files: `apps/web-e2e/src/docs-shots/files.shots.ts`, `apps/web/src/docs/content/guides/files.md`
- [X] T073 [P] [US4] Users: `apps/web-e2e/src/docs-shots/users.shots.ts`, `apps/web/src/docs/content/guides/users.md`
- [X] T074 [P] [US4] Insights: `apps/web-e2e/src/docs-shots/insights.shots.ts`,
  `apps/web/src/docs/content/guides/insights.md`
- [X] T075 [P] [US4] Activity và Notifications: `apps/web-e2e/src/docs-shots/activity.shots.ts`,
  `apps/web/src/docs/content/guides/activity-notifications.md`
- [X] T076 [P] [US4] Data Model: `apps/web-e2e/src/docs-shots/data-model.shots.ts`,
  `apps/web/src/docs/content/guides/data-model.md`
- [X] T077 [P] [US4] Roles và Policies: `apps/web-e2e/src/docs-shots/roles-policies.shots.ts`,
  `apps/web/src/docs/content/guides/roles-policies.md`
- [X] T078 [P] [US4] Flows: `apps/web-e2e/src/docs-shots/flows.shots.ts`, `apps/web/src/docs/content/guides/flows.md`
- [X] T079 [P] [US4] Extensions: `apps/web-e2e/src/docs-shots/extensions.shots.ts`,
  `apps/web/src/docs/content/guides/extensions.md`

### Implementation: 8 trang tính năng riêng (nội dung lấy từ User Stories và quickstart của spec tương ứng, viết lại cho người dùng)

- [X] T080 [P] [US4] Ẩn hiện tìm kiếm, import, export theo collection (spec 022, 024):
  `apps/web-e2e/src/docs-shots/collection-toggles.shots.ts`, `apps/web/src/docs/content/guides/collection-toggles.md`
- [X] T081 [P] [US4] Filter theo path json (spec 023): `apps/web-e2e/src/docs-shots/json-path-filter.shots.ts`,
  `apps/web/src/docs/content/guides/json-path-filter.md`
- [X] T082 [P] [US4] Quyền import, export theo policy (spec 025):
  `apps/web-e2e/src/docs-shots/import-export-permissions.shots.ts`,
  `apps/web/src/docs/content/guides/import-export-permissions.md`
- [X] T083 [P] [US4] Filter so sánh hai field (spec 028): `apps/web-e2e/src/docs-shots/field-compare-filter.shots.ts`,
  `apps/web/src/docs/content/guides/field-compare-filter.md`
- [X] T084 [P] [US4] Passkey (spec 029; chụp trên replica `backoffice-api-passkey` với virtual authenticator, nêu điều
  kiện `PUBLIC_URL`): `apps/web-e2e/src/docs-shots/passkey.shots.ts`, `apps/web/src/docs/content/guides/passkey.md`
- [X] T085 [P] [US4] Index (spec 030): `apps/web-e2e/src/docs-shots/collection-indexes.shots.ts`,
  `apps/web/src/docs/content/guides/collection-indexes.md`
- [X] T086 [P] [US4] Tải extension lên (spec 031): `apps/web-e2e/src/docs-shots/extension-upload.shots.ts`,
  `apps/web/src/docs/content/guides/extension-upload.md`
- [X] T087 [P] [US4] Đồng bộ môi trường (spec 032; nguồn là `backoffice-api-sync` của profile `sync`; URL và token trong ảnh là giá trị giả hoặc được che):
  `apps/web-e2e/src/docs-shots/environment-sync.shots.ts`, `apps/web/src/docs/content/guides/environment-sync.md`

### Ghép và kiểm

- [X] T088 [US4] Thêm 17 trang vào phần `guides` của `apps/web/src/docs/nav.ts` (hai nhóm; 8 trang tính năng riêng có
  `backofficeOnly: true`) (T067 xanh)
- [X] T089 [US4] Chạy `DOCS_SHOTS=1 E2E_CONFIG=proxy-api pnpm --filter @backoffice/web-e2e docs:shots`; rà từng ảnh
  (không dữ liệu thật, không token, không từ "Directus" đứng riêng); chạy lần hai và kiểm `git status` không báo ảnh
  nào đổi (SC-010), ghi kết quả vào `spec.md`; commit `apps/web/src/docs/content/images/` (T066 xanh)
- [X] T090 [US4] Thêm vào `apps/web-e2e/src/docs.spec.ts` một ca mở trang hướng dẫn Files và thấy ảnh đã tải, không có vi phạm CSP trong console (`proxy-api`); thêm một
  trang hướng dẫn vào `DocsRoute.browser.test.ts` (ảnh, bảng, code, ô ghi chú; axe sáng và tối) và vào
  `apps/web-e2e/src/a11y.spec.ts`

**Checkpoint**: `content.test.ts` và `nav.test.ts` xanh; 17 trang mở được ở Vite dev, mỗi trang có ảnh.

## Phase 9: Polish + đóng lượt 3

- [X] T091 [P] Thêm entry `doc` cho D-215 vào `tests/parity/accepted-differences.ts` (feature `033`, không `removeAt`);
  `tests/parity/src/accepted-differences.test.ts` xanh
- [X] T092 [P] Rà link chéo FR-020 ở 17 trang (mỗi chỗ nhắc endpoint hoặc biến có link), rà phạm vi tối thiểu của
  từng trang theo FR-018a và rà nội dung theo FR-045 (tự viết); chạy `design-system/qa/handoff-checklist.md` cho khu tài liệu lần cuối; ghi kết quả vào research "Kết quả lượt
  3"
- [X] T093 [P] Sửa `specs/033-docs-page/quickstart.md` cho khớp tên lệnh và đường dẫn thật; thêm ghi chú "(033: ...)" vào
  `specs/012-backoffice-web-shell/spec.md` ở chỗ nói sáu module nội bộ và menu người dùng
- [X] T094 Cập nhật `CLAUDE.md` (dòng 033 của Active Technologies thành "implemented"; một mục Recent Changes),
  `SPECKIT-GUIDE.md` (dòng "Trạng thái" của 033; mục 2 thêm việc "feature sau 033 cập nhật trang tài liệu của mình"),
  `specs/033-docs-page/spec.md` (`Status: Done`, kết quả SC-007, SC-010); `graphify update .`
- [X] T095 Đóng lượt 3: `nx run web:lint`, `pnpm --filter @backoffice/web typecheck`, `nx run web:test`, `nx run web:build`, `check-bundle` xanh;
  `git diff --stat` của lượt không chạm `apps/api/src`, `libs/specs`, `libs/env`; commit
  `feat(web): guides with screenshots in the documentation area (spec 033)`; push khi CI của commit trước xanh; theo dõi
  CI tới khi xanh; ghi mã run vào `spec.md` và `SPECKIT-GUIDE.md`

**Checkpoint**: lượt 3 trên `main`, CI xanh, spec đóng.

## Phase 10: Sửa đổi 2026-11-18, bản tiếng Anh (FR-038, FR-039)

- [X] T096 `docs/types.ts` (`DocsLang`), `nav.ts` (`docsNavs`, `docsLangOf`, một menu mỗi ngôn ngữ, cùng đường dẫn),
  `configuration/groups.ts` (`en`), `modules/docs/use-docs-lang.ts`; `DocsRoute.vue` nạp nội dung, ảnh, API, bảng cấu
  hình theo ngôn ngữ và nạp lại khi ngôn ngữ đổi; các component dùng `:lang` của bản đang hiện
- [X] T097 [P] `content/en/index.md` và 17 `content/en/guides/*.md` (cùng cấu trúc, nhãn en-US của app, anchor tiếng Anh)
- [X] T098 [P] `configuration/variables.en.ts` (`configTablesEn`, cùng dòng); test cùng dạng trong `variables.test.ts`
- [X] T099 [P] `scripts/sync-docs-api.mjs` ghi `generated/en/` (CRUD từ `noun-en`, bảng `supplement/en.json`, `--missing`,
  dừng khi còn chữ tiếng Việt); test trong `sync-docs-api.test.ts`
- [X] T100 `docs-shots/lang.ts` (`DOCS_LANG`, `L()`), dữ liệu mẫu và nhãn theo ngôn ngữ, `snapshotPathTemplate` ra
  `images/en/`, `signedIn` tạo dữ liệu mẫu trước; chụp 24 ảnh tiếng Anh, hai lần chạy cho 0 ảnh đổi
- [X] T101 `content.test.ts` cho hai ngôn ngữ (link, anchor, ảnh, bản tiếng Anh đủ trang, cùng ảnh, không chữ tiếng
  Việt), `nav.test.ts`, test của component và route (ca en-US rồi vi-VN), E2E `docs.spec.ts` theo tiếng Anh và một ca
  admin vi-VN
- [X] T103 Biến của từng nhóm trong trang Cấu hình: `ConfigMember`, `members` của `supported.generated.json`,
  `DocsConfigDefault.vue`, dòng thụt vào trong `DocsConfigGroup.vue`, dữ liệu ở `variables.ts` và `variables.en.ts`,
  test trong `variables.test.ts` và `DocsConfigGroup.test.ts`
- [ ] T102 Commit `feat(web): English documentation content (spec 033 amendment)`; push khi CI trước xanh; theo dõi CI

## Dependencies & Execution Order

- **Phase 1** trước mọi thứ (T005a ngay sau T002): T003 (recipe) phải xong trước mọi task viết giao diện (T018 phần CSS, T028–T033, T041,
  T060, T061). T002 trước T009, T016.
- **Phase 2** chặn mọi story. T015 trước T017; T016 trước T017; T017 và T018 trước Phase 3.
- **US1 (Phase 3)** là MVP. **US2 (Phase 4)** cần T033 (route) và T018 (`nav.ts`). **Phase 5** sau 3 và 4.
- **Lượt 2** chỉ bắt đầu sau T048 (lượt 1 trên `main`, CI xanh). T050 (đối chiếu operation) trước T056–T058. T058 trước T059; T059 trước T061, T063.
- **Lượt 3** chỉ bắt đầu sau T065. T068, T069, T070 trước T071–T087; T071–T087 trước T088, T089; T089 trước T090.
- Trong mỗi story: test (`[P]`) viết trước và đỏ → implementation → browser test hoặc E2E.

## Parallel Example: Phase 2

```text
Song song: T006, T007, T008, T009, T010, T011, T012 (test đỏ) → T013 ∥ T014 ∥ T015 ∥ T016 → T017 → T018 ∥ T019
```

## Parallel Example: User Story 1

```text
Song song: T020, T021, T022, T023, T024, T025 (test đỏ) → T026 ∥ T027 ∥ T028 ∥ T029 ∥ T031 ∥ T032 → T030 → T033 → T034 → T035
```

## Parallel Example: User Story 3

```text
T049 → T050 → song song: T051, T052, T053, T054 (test đỏ) → T055 → T056 ∥ T057 ∥ T060 → T058 → T059 → T061 → T062
```

## Parallel Example: User Story 4

```text
Song song: T066, T067 (test đỏ) → T068 → T069 → T070 → song song: T071 … T087 (17 trang) → T088 → T089 → T090
```

## Implementation Strategy

- **MVP** = Phase 1–3: khu tài liệu mở được từ menu người dùng, có khung, trang mở đầu, link có anchor.
- Tăng dần: Phase 4 thêm phần Cấu hình (lượt 1 xong); lượt 2 thêm phần API; lượt 3 thêm 17 trang hướng dẫn và ảnh.
- Ba lượt commit; mỗi lượt kết thúc bằng CI xanh trước khi sang lượt sau.
- Một điểm dừng hỏi chủ dự án: T070 (máy chụp ảnh), khi T005a không cài được trình duyệt hoặc môi trường không chạy.
  Giấy phép của mô tả API tĩnh đã có quyết định 2026-11-17 (T049 chỉ ghi nhận).
