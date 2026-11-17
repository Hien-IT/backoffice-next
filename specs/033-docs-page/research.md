# Research: Trang tài liệu (docs) trong app Backoffice

**Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Đọc code ngày 2026-11-17, chưa chạy thử. Mục có nhãn [Verified] là đã mở file hoặc chạy lệnh; [Inference] là suy từ
code đã đọc; [Unverified] là chưa kiểm, có task kiểm ở lượt ghi kèm.

## R1. Trang nằm ở đâu trong app: module ẩn `docs`

- **Decision**: thêm một module nội bộ thứ bảy `docs` với `hidden: true` (`apps/web/src/modules/docs.ts`), route `''`
  và `:path(.*)*` cùng trỏ một component lazy `DocsRoute.vue`. Module ẩn không có ô trong lưới module nhưng vẫn đăng ký
  route `/docs` và có dòng tiêu đề ở sidebar.
- **Rationale**: [Verified] `registerModules` đăng ký `path: '/${module.id}'` cho mọi module qua `router.addRoute`
  (`apps/web/src/modules/index.ts:55`–`:67`); Activity đã là module `hidden` (`modules/activity.ts:10`) và
  `currentModule` tìm cả module không có ô trong lưới để đặt tên đầu sidebar
  (`layout/composables/use-module-bar.ts:73`–`:81`). Route của module là private theo mặc định (`meta.public !== true`,
  `router/guard.ts:56`). Không cần sửa router hay guard.
- **Alternatives considered**: route riêng trong `defaultRoutes` (phải tự dựng tiêu đề sidebar, lệch cách các trang
  private khác đăng ký); layout toàn màn hình không sidebar (thêm một bố cục mới, mất chỗ của menu người dùng và
  chuông).
- **Hệ quả**: `getInternalModules()` trả bảy module; chú thích "six internal modules" (D-41) và `modules/index.test.ts`
  sửa theo. Module `docs` không có `preRegisterCheck` nên mọi user có quyền vào app đều có (FR-012).

## R2. Đăng nhập rồi quay lại đúng trang và anchor

- **Decision**: không sửa guard. Thêm xử lý cuộn tới anchor trong `DocsRoute.vue` sau khi nội dung render.
- **Rationale**: [Verified] guard chuyển người chưa đăng nhập tới `'/login?redirect=' + encodeURIComponent(to.fullPath)`
  (`router/guard.ts:75`); `fullPath` của vue-router gồm cả hash. Form đăng nhập `router.push(redirectQuery || lastPage ||
  '/content')` (`routes/login/LoginForm.vue:73`–`:81`, `LdapForm.vue:78`, `ContinueAs.vue:59`). [Verified]
  `createRouter` không có `scrollBehavior` (`router/index.ts:98`), nên hash không tự cuộn; trang tự gọi
  `scrollIntoView` khi nội dung xong và khi hash đổi.
- **[Unverified]**: đăng nhập SSO dùng tham số `continue` (`routes/login/SsoLinks.vue:72`); hash có sống qua vòng SSO
  hay không chưa kiểm. E2E chỉ phủ đăng nhập local (FR-054). Task ở lượt 1 ghi kết quả đọc `SsoLinks.vue`; nếu mất hash
  thì ghi thành giới hạn trong spec, không sửa luồng SSO.
- **Ghi chú**: `onAfterEach` ghi `last_page` sau 500 ms cho mọi route private (`router/guard.ts:112`–`:129`). Bấm mục
  lục đổi hash nên mỗi lần bấm có một lần ghi (đã gộp bằng timeout). Giữ như các trang khác: sau đăng nhập app mở lại
  trang tài liệu đang đọc.

## R3. Bố cục trong shell (đề xuất cho Q-50)

- **Decision (design owner duyệt 2026-11-17)**: phương án A. Trang dùng `PrivateView`; menu trái của tài liệu đặt vào slot
  `navigation` của sidebar app; vùng nội dung có cột bài viết và cột "Trên trang này" dính bên phải từ `xl`.
- **Rationale**: [Verified] sidebar đã có slot `navigation` cho từng module (`layout/AppSidebar.vue:115`–`:116`,
  `PrivateView.vue:85`), kéo rộng 240–480 px và thành drawer dưới `xl` (D-190, layout-patterns §2). FR-041 ("dưới `xl`
  menu trái mở bằng một nút") có sẵn mà không thêm code. Sub-menu Settings (layout-patterns §12) là mẫu cho dòng menu:
  link `menu-dropdown-item`, `aria-current="page"`, nhóm tách bằng divider.
- **Alternatives considered**: B. Layout riêng ba cột không có sidebar module: giống docs của Directus hơn, nhưng là
  một shell thứ hai phải tự làm drawer, header, menu người dùng. C. Menu trái nằm trong vùng nội dung, sidebar app để
  trống: hai cột điều hướng cạnh nhau ở 1280 px, cột bài viết còn dưới 500 px.
- **Chi tiết đề xuất** ở [contracts/web.md](./contracts/web.md) §4; recipe vào `design-system/docs/component-specs.md`
  sau khi duyệt.

## R4. Nạp nội dung và mục lục khu tài liệu

- **Decision**: nội dung ở `apps/web/src/docs/`. Một file mục lục tĩnh `nav.ts` (phần → nhóm → trang) sinh menu trái,
  breadcrumb, trang trước và sau. Trang markdown nạp bằng `import.meta.glob('./content/**/*.md', { query: '?raw',
  import: 'default' })` (mỗi trang một chunk lazy). Ảnh nạp bằng `import.meta.glob('./content/images/*.png', { eager:
  true, query: '?url', import: 'default' })` để đổi đường dẫn tương đối trong markdown thành URL có hash của Vite.
- **Rationale**: glob import là tính năng của Vite, không cần plugin. Chỉ chuỗi URL của ảnh nằm trong chunk của khu tài
  liệu; file ảnh là asset riêng, cache `immutable` theo `apps/web/nginx.conf:9`. [Verified] `apps/web/public` chỉ có
  `config.json` và `favicon.ico`, nên không đặt ảnh ở đó (file ở `public` không có hash).
- **Alternatives considered**: plugin Vite biến markdown thành component lúc build (thêm dependency và một bước build);
  front matter trong từng file thay cho `nav.ts` (phải nạp mọi trang để dựng menu).

## R5. Render markdown

- **Decision**: một instance `Marked` riêng của khu tài liệu (`docs/render.ts`) với renderer cho: tiêu đề (không gắn
  `id` ở bước này), khối code (gọi bộ tô màu, R6), blockquote dạng `> [!NOTE]` và `> [!WARNING]` thành ô ghi chú, ảnh
  (đổi `src` theo bảng URL của R4, bắt buộc có alt), bảng (bọc trong khung cuộn ngang có `tabindex="0"`). HTML ra đi
  qua cùng instance DOMPurify của app; sau khi lọc, một bước xử lý DOM gắn `id` cho tiêu đề và dựng danh sách mục lục.
- **Rationale**: [Verified] `md()` gọi `marked.parse` toàn cục không có renderer rồi `purify.sanitize`
  (`apps/web/src/utils/markdown.ts:30`–`:31`), và đã xử lý DOM sau khi lọc cho link (`:34`–`:40`). Tách một hàm
  `sanitize(html)` export từ `markdown.ts` để khu tài liệu dùng chung hook mở link ngoài ở tab mới (FR-010, FR-046).
  Renderer riêng nằm trên instance riêng nên không đổi kết quả của `md()` ở các chỗ đang dùng (comment, display,
  directive `v-md`).
- **Anchor**: slug bằng `@sindresorhus/slugify` 2.2.1 đã có trong `apps/web/package.json:52` (bỏ dấu tiếng Việt, ví dụ
  "Đồng bộ môi trường" → `dong-bo-moi-truong`); tiêu đề trùng thêm hậu tố `-2`, `-3` theo thứ tự trong trang (FR-006).
  Gắn `id` sau khi lọc vì [Inference] DOMPurify với `SANITIZE_DOM` mặc định bỏ `id` trùng tên thuộc tính của
  `document` (ví dụ `cookie`, `location`); test đơn vị có một trang với hai tiêu đề như vậy.
- **Alternatives considered**: `marked-gfm-heading-id`, `marked-alert`, `marked-highlight` (ba dependency cho ba đoạn
  renderer ngắn).

## R6. Thư viện tô màu cú pháp (dependency mới; chủ dự án duyệt 2026-11-17)

Số phiên bản, giấy phép và dung lượng gói: [Verified] `pnpm view` ngày 2026-11-17. [Unverified] Các dòng còn lại của
bảng (cách import, dạng kết quả, ngôn ngữ có sẵn, cách tô) lấy từ hiểu biết chung về ba thư viện, chưa cài và chưa chạy
thử; lượt 1 xác nhận cho thư viện được chọn. Dung lượng nén trong bundle: [Unverified], đo ở lượt 1.

| Tiêu chí | highlight.js 11.12.0 | prismjs 1.30.0 | shiki 4.6.0 |
| --- | --- | --- | --- |
| Giấy phép | BSD-3-Clause | MIT | MIT |
| Dung lượng gói (unpacked) | 5,5 MB (mọi ngôn ngữ; chỉ import core và ba ngôn ngữ) | 2,1 MB | 0,6 MB, cộng gói ngôn ngữ và theme riêng |
| shell, JSON, GraphQL | Có sẵn cả ba (`bash`, `json`, `graphql`) | Có cả ba, nạp từng file | Có cả ba (grammar TextMate) |
| Cách import | ESM: `highlight.js/lib/core` + từng ngôn ngữ, không tác dụng phụ toàn cục | Gắn biến toàn cục `Prism`, ngôn ngữ đăng ký bằng tác dụng phụ | ESM, bất đồng bộ, cần engine regex (WASM hoặc JS) |
| Kết quả | Chuỗi HTML với class `hljs-*` | Chuỗi HTML với class `token *` | HTML có style inline hoặc biến CSS |
| Màu theo token | Tự viết CSS cho khoảng mười class | Tự viết CSS cho khoảng mười class | Phải viết theme JSON hoặc dùng biến CSS |
| Tô lúc chạy trong chunk lazy | Được, đồng bộ | Được | Được nhưng nặng nhất; tô lúc build thì cần render markdown lúc build |

- **Decision (duyệt 2026-11-17)**: `highlight.js` 11.12.0, pin trong catalog của `pnpm-workspace.yaml`, import
  `highlight.js/lib/core` và ba ngôn ngữ `bash`, `json`, `graphql` trong `docs/highlight.ts`; tô lúc chạy; nằm trong
  chunk lazy của khu tài liệu.
- **Rationale**: đủ ba ngôn ngữ của FR-010a với một import ESM không có biến toàn cục; đầu ra là class nên bảng màu là
  một file CSS dùng token của theme cho sáng và tối, không có style inline (CSP của image web không cần nới); HTML ra
  đi qua DOMPurify như phần còn lại (R5).
- **Alternatives considered**: prismjs nhỏ hơn nhưng dùng biến toàn cục;
  shiki tô chính xác nhất nhưng cần engine regex và grammar lớn, hoặc một bước render lúc build mà R4, R5 không có.
- **Việc kèm theo**: `pnpm audit` sau khi thêm (kết quả ghi ở lượt 1); `check-bundle` thêm marker của thư viện vào
  danh sách "chỉ được ở chunk lazy". Bảng màu cú pháp thuộc Q-50.

## R7. Nguồn của phần API

- **Decision**: một script `apps/web/scripts/sync-docs-api.mjs` đọc `libs/specs/dist/openapi.json` cộng các file bổ
  sung viết tay `apps/web/src/docs/api/supplement/*.yaml`, ghi mỗi resource một file
  `apps/web/src/docs/api/generated/<resource>.json` (commit vào repo). Test chạy lại script vào thư mục tạm và so, như
  `sync-theme-presets.mjs`. Web nạp từng file bằng `import.meta.glob` lazy.
- **Rationale**: [Verified] `libs/specs/index.js:2`–`:8` đọc `dist/openapi.json` bằng `node:fs`, nên web không import
  gói này được. [Verified] `dist/` bị `.gitignore` (`.gitignore:5`), nên file web dùng phải là file sinh ra và commit.
  [Verified] mô tả tĩnh có 67 path, 133 operation, 23 tag, operation nào cũng có `operationId`; `openapi.json` nặng
  286 KB, chia theo resource để mỗi trang chỉ tải phần của nó. [Verified] file bổ sung nằm ngoài `libs/specs` nên
  `spec` mà `OASSpecsService` dùng (`apps/api/src/services/specifications.service.ts:4`) không đổi (FR-023).
- **Dạng file sinh**: tham số đã thay `$ref`; schema của trả lời giữ tham chiếu theo tên tới một bảng `schemas` trong
  chính file đó (không lặp schema). Chi tiết ở [data-model.md](./data-model.md) §3.
- **File bổ sung**: [Verified] controller có nhưng mô tả tĩnh không có tag: `access`, `dashboards`, `notifications`,
  `panels`, `policies`, `shares`, `translations` và năm `backoffice-*.controller.ts`. YAML đọc bằng `js-yaml` đã có
  trong `apps/web/package.json:112`.
- **Ví dụ REST**: sinh từ method, path, tham số bắt buộc và `example` của schema; tên máy chủ `https://backoffice.example.com`,
  token `<token>` (FR-029).
- **Ví dụ GraphQL**: sinh theo quy tắc cho operation CRUD của tag có `x-collection` (ví dụ `getFiles` → `query { files
  { id } }` ở `/graphql/system`; Items ở `/graphql`); operation khác lấy từ một bảng viết tay theo `operationId`;
  operation không có tương đương ghi `graphql: false`. Test: operation nào cũng có ví dụ hoặc `false`.
- **Kiểm ví dụ GraphQL**: một test trong môi trường parity đọc các file sinh, lấy SDL của API đang chạy
  (`/server/specs/graphql`) và chạy `validate` của gói `graphql` (đã có ở `tests/parity/package.json:26`) cho từng ví
  dụ. Không so với Directus. Đây là sửa câu chữ FR-055 (plan, mục cuối).
- **Thương hiệu**: [Verified] mô tả tĩnh có đúng một từ "Directus" đứng riêng: `example` của `project_name` trong schema
  Settings. Script thay giá trị ví dụ này bằng "Backoffice" trong file sinh; `libs/specs` không sửa.
- **Alternatives considered**: sửa `libs/specs` (làm `/server/specs/oas` lệch, cần D); import cả `openapi.json` vào web
  (286 KB cho mỗi lần mở phần API); gọi `/server/specs/oas` lúc chạy (đã loại ở điểm chốt C).
- **Phần chưa phủ**: endpoint app phục vụ nhưng không có trong mô tả tĩnh lẫn FR-022 (ví dụ `/server/health`,
  `/server/ping`, `/server/setup`, `/files/tus`, `/metrics`, `/graphql`, `/auth/login/:provider`) không có mục ở v1. Ghi
  thành giả định của spec (plan, mục cuối).
- **[Unverified]**: mọi operation của mô tả tĩnh đều được Backoffice phục vụ. Task đầu lượt 2 đối chiếu 133 operation
  với route của các controller; operation không được phục vụ thì loại khỏi file sinh bằng một danh sách có lý do.

## R8. Nguồn của phần Cấu hình

- **Decision**: script `apps/web/scripts/sync-docs-config.mjs` (chạy bằng `jiti` như `sync-theme-presets.mjs`) đọc
  `SUPPORTED_VARIABLES` và `DEFAULTS`, ghi `apps/web/src/docs/configuration/supported.generated.json` (commit): danh
  sách mẫu tên và mặc định. File viết tay `docs/configuration/variables.ts` chỉ có nhóm, mô tả và ghi chú cho từng tên
  hoặc mẫu. Cột Mặc định hiện từ file sinh.
- **Rationale**: [Verified] `SUPPORTED_VARIABLES` là `RegExp[]` với khoảng 192 mục, gồm tên cụ thể và mẫu (`LOGGER_.+`,
  `DB_.+`, `SERVER_.+`), không có mô tả (`apps/api/src/config/supported-variables.ts:5`); `NOT_APPLICABLE_VARIABLES`
  rỗng (`:224`). [Verified] `DEFAULTS` import `node:path`, `node:process` (`libs/env/src/constants/defaults.ts:2`–`:3`),
  nên không import vào web; đọc trong script Node rồi ghi JSON. Mặc định sinh từ code thì FR-033 đúng theo cách dựng,
  không cần so tay.
- **Test**: (a) chạy lại script và so file sinh; (b) mỗi mục của file sinh có đúng một dòng trong `variables.ts`, mẫu
  khớp mẫu, tên khớp tên; (c) không dòng nào của `variables.ts` thiếu trong file sinh (FR-031, FR-051).
- **Giá trị phụ thuộc máy**: `CONFIG_PATH` là `resolve(cwd(), '.env')` (`defaults.ts:8`); script có một bảng nhỏ giá trị
  hiển thị thay thế (ví dụ `.env`).
- **Alternatives considered**: test của web import thẳng file của `apps/api` (web phụ thuộc mã nguồn API lúc test,
  `DEFAULTS` kéo theo `@backoffice/constants`); viết tay cả mặc định (lệch khi code đổi).

## R9. Kiểm thương hiệu

- **Decision**: `check-brand.mjs` quét thêm `.md` và `.yaml`; hai đuôi này quét nguyên văn, không qua `stripComments`
  (dấu `//` trong ví dụ không phải comment). Không thêm ngoại lệ đường dẫn nào cho `docs/`.
- **Rationale**: [Verified] script chỉ lấy file `vue|ts|css|html|svg|json` (`apps/web/scripts/check-brand.mjs:32`) và
  bắt từ đứng riêng bằng `/(?<![A-Za-z])Directus(?![A-Za-z])/` (`:50`), nên `directus_files` hay `@directus/sdk` không
  bị bắt (FR-047). File sinh của R7 và R8 là `.json` nên đã được quét.
- **Ảnh**: chữ trong ảnh không quét được. Kịch bản chụp chỉ mở màn hình của app Backoffice trên dữ liệu mẫu không có
  từ đó; người chụp rà ảnh trước khi commit (quickstart).
- **Cách viết ghi chú vận hành**: "hệ thống dùng chung cơ sở dữ liệu", "ứng dụng gốc" không dùng; mẫu câu ở quickstart.

## R10. Ảnh chụp màn hình

- **Decision**: một project Playwright riêng `docs-shots` trong `apps/web-e2e` (file `src/docs-shots/*.shots.ts`), chỉ
  có khi đặt `DOCS_SHOTS=1`; lệnh `pnpm --filter @backoffice/web-e2e docs:shots` chạy trên cấu hình `proxy-api`,
  chromium 1280×800, `deviceScaleFactor: 1`, giao diện sáng, user có ngôn ngữ vi-VN. Ảnh ghi vào
  `apps/web/src/docs/content/images/<trang>-<n>.png`.
- **Rationale**: [Verified] `page.screenshot` đã dùng trong E2E (`apps/web-e2e/src/branding.spec.ts:69`); helper đăng
  nhập và dựng dữ liệu có sẵn (`src/helpers/login.ts:15`, `fixtures.ts:38`, `content.ts`, `files.ts`, `flows.ts`,
  `insights.ts`). Project riêng và đuôi `.shots.ts` nằm ngoài `testMatch` mặc định nên ba cấu hình E2E thường không
  chạy nó (FR-035).
- **Ổn định ảnh**: `page.clock.install` với giờ cố định, `animations: 'disabled'`, `caret: 'hide'`, tùy chọn `mask` cho
  vùng có id hoặc ngày giờ do máy chủ sinh; dữ liệu mẫu tạo bằng id cố định khi API cho phép (FR-037).
- **Giới hạn dung lượng**: test của web kiểm mỗi ảnh ≤ 300 KB và tổng ≤ 8 MB (đề xuất; ảnh vào cả repo lẫn image web).
- **Máy chụp**: [Verified] máy local của dự án chưa có trình duyệt Playwright (ghi ở 032). Cài một lần bằng `pnpm
  --filter @backoffice/web-e2e exec playwright install chromium`; môi trường `web` của parity phải đang chạy
  (quickstart).
- **Alternatives considered**: chụp trong lượt E2E thường (chậm, ảnh đổi làm bẩn working tree của CI); chụp bằng
  browser test của Vitest (không có API thật, màn hình thiếu dữ liệu).

## R11. Menu người dùng và chuỗi

- **Decision**: thêm một mục `{ text: t('documentation'), icon: 'menu_book', to: '/docs' }` trước Sign out trong
  `UserMenu.vue`, cho mọi user không phải share.
- **Rationale**: [Verified] `items` là mảng tĩnh hai mục (`apps/web/src/layout/UserMenu.vue:29`–`:37`). [Verified] khóa
  `documentation`, `previous`, `next`, `page_not_found`, `page_not_found_body`, `copy` đã có trong bản dịch sinh từ
  Directus (`directus/app/src/lang/translations/en-US.yaml:816`, `:101`, `:486`, `:531`, `:794`). Khóa mới vào overlay
  en-US và vi-VN: tên ba phần, "Trên trang này", "Đã chép", thông báo lỗi tải và nút thử lại, ghi chú "chỉ có khi máy
  chủ là Backoffice", nhãn cột của bảng biến và của khối endpoint. Danh sách ở [contracts/web.md](./contracts/web.md) §6.
- **[Unverified]**: bản vi-VN của các khóa có sẵn (`documentation`...) có nghĩa phù hợp hay không; lượt 1 đọc
  `translations/vi-VN.json`; khóa thiếu hoặc không hợp thì dùng một khóa mới `docs_*` ở cả hai overlay, không ghi đè
  khóa có sẵn (`lang/overlay.test.ts` cấm overlay trùng khóa của bản dịch gốc; analyze I1).

## R12. Hiệu năng và bundle

- **Decision**: main bundle chỉ thêm khai báo module `docs` (một import động) và một mục menu. `check-bundle.mjs` thêm
  `BUDGET_033 = BUDGET_020 + 2 KB` và marker của `highlight.js` vào danh sách thư viện chỉ được ở chunk lazy.
- **Rationale**: [Verified] giới hạn hiện hành là `Math.min(LIMIT, BUDGET_020)` với `LIMIT` 350 KB
  (`apps/web/scripts/check-bundle.mjs:155`); chunk lazy không tính (`:1`–`:2`). SC-007 đo bằng chính script này.
- **Chunk của khu tài liệu**: route, renderer, bộ tô màu và `nav.ts` trong một chunk; mỗi trang markdown, mỗi file API
  và file biến là chunk riêng. Dung lượng chunk khu tài liệu đo ở lượt 1 và ghi vào đây; không đặt ngưỡng trước khi đo.

## R13. Khi API là Directus

- **Decision**: không probe, không ẩn. Module `docs` đăng ký như nhau ở cả ba cấu hình.
- **Rationale**: nội dung tĩnh; lần gọi API duy nhất do trang gây ra là ghi `last_page` của guard, đã có ở mọi trang và
  chạy được với API của Directus. E2E `docs.spec.ts` chạy cả ở `proxy-directus` (FR-049, FR-054).

## R14. Trợ năng

- **Decision**: menu trái là `<nav aria-label>` trong sidebar (sidebar đã là vùng `navigation`, nhãn riêng cho menu tài
  liệu); mục lục là `<nav aria-label="Trên trang này">` thứ hai; trang đang mở `aria-current="page"`, mục đang đọc
  `aria-current="location"`; vùng bài viết có `lang="vi"`; bảng trong khung cuộn có `tabindex="0"` và `role="region"`
  kèm nhãn; khối code là `<pre tabindex="0">`; tab REST / GraphQL dùng `BoTabs`; nút chép báo kết quả qua vùng
  `aria-live="polite"`.
- **Rationale**: theo "Accessibility and keyboard requirements" của layout-patterns §7 và FR-043. Kiểm bằng browser
  test có axe (sáng và tối) và `a11y.spec.ts` của E2E.

## R15. Việc ngoài code của feature

- `apps/web/project.json` đang có thay đổi chưa commit của session khác. Lệnh mới (`sync-docs-api`, `sync-docs-config`,
  `docs:shots`) khai báo ở `scripts` của `package.json`, không thêm target vào `project.json`.
- Các feature sau 033 phải cập nhật trang hướng dẫn của mình; thêm một dòng vào mục 2 của `SPECKIT-GUIDE.md` khi đóng
  spec.

## Tổng hợp việc còn [Unverified]

| # | Việc | Kiểm ở |
| --- | --- | --- |
| 1 | Dung lượng nén của `highlight.js` (core + 3 ngôn ngữ) và của chunk khu tài liệu | Xong lượt 1 (mục "Kết quả lượt 1") |
| 2 | `pnpm audit` sau khi thêm `highlight.js` | Xong lượt 1 |
| 3 | Hash qua vòng đăng nhập SSO | Đọc code ở lượt 1: [Inference] anchor đi qua; chưa chạy |
| 4 | DOMPurify bỏ `id` kiểu `cookie`, `location` | Xong lượt 1 (`render.test.ts`) |
| 5 | Bản vi-VN của các khóa dịch có sẵn | Xong lượt 1 |
| 6 | 133 operation của mô tả tĩnh đều được phục vụ | Xong lượt 2: 127 khớp, 6 loại có lý do (mục "Kết quả lượt 2") |
| 7 | Phần tử nào của shell cuộn (để cuộn tới anchor và đánh dấu mục đang đọc) | Xong lượt 1 |

## Kết quả lượt 1 (2026-11-17)

**Kết quả kiểm T001, T002, T044** (các mục [Unverified] số 1–5 và 7 của bảng trên):

| # | Việc | Kết quả |
| --- | --- | --- |
| 1 | Dung lượng | [Verified, đo trên máy] Main bundle 280,5 KB nén trước feature (build commit `2c332f62` trong một worktree tạm), 280,7 KB sau: tăng 0,2 KB (SC-007 cho phép 2 KB). Chunk `DocsRoute` (route, 7 component, renderer, mục lục, `highlight.js` core và ba ngôn ngữ) 18,0 KB nén; CSS của khu tài liệu là file riêng; `variables` và `supported.generated` là hai chunk riêng, mỗi trang markdown một chunk. `highlight.js` chỉ nằm trong chunk `DocsRoute` |
| 2 | `pnpm audit` | [Verified] Không có advisory nào cho `highlight.js` 11.12.0 (`pnpm audit --prod --json` không có tên gói). Lockfile chỉ thêm đúng gói này (14 dòng) |
| 3 | Anchor qua SSO | [Inference, đọc code, chưa chạy] Link SSO lấy `window.location.href` của trang đăng nhập làm địa chỉ quay về (`SsoLinks.vue:72`); URL đó là `/admin/login?redirect=<đường dẫn và anchor đã mã hóa>`, nên anchor nằm trong query và đi qua vòng chuyển hướng; `ContinueAs.vue:59` mở lại `redirect`. Không có E2E cho SSO trong feature này |
| 4 | `id` của tiêu đề | [Verified] `id` gắn sau khi lọc nên tiêu đề "Cookie", "Location" vẫn có anchor (`render.test.ts`) |
| 5 | Khóa dịch có sẵn | [Verified] vi-VN có `documentation` ("Tài liệu"), `next`, `copy`, `page_not_found`, `page_not_found_body`; không có `previous`. Khu tài liệu dùng khóa mới `docs_previous`, `docs_next` (không ghi đè khóa gốc) |
| 7 | Phần tử cuộn | [Verified] Trang cuộn trên document (`PrivateView` không `fill`); header dính ở trên nên tiêu đề có `scroll-margin-top` 6rem và mục lục quan sát theo viewport |

**Phát hiện khi làm** (đã sửa trong lượt):

- `SUPPORTED_VARIABLES` không phải toàn bộ biến API đọc: nó chỉ tồn tại cho cảnh báo "biến không hỗ trợ" nên bỏ qua các
  biến mà danh sách của Directus không nêu. [Verified bằng grep trong `apps/api/src`] API đọc thêm 20 biến có mặc định:
  `TUS_*` (4), `RETENTION_*` (3), `ACTIVITY_RETENTION`, `REVISIONS_RETENTION`, `FLOW_LOGS_RETENTION`,
  `PRESSURE_LIMITER_*` (7), `MAX_RELATIONAL_DEPTH`, `FILES_MIME_TYPE_ALLOW_LIST`, `ACCEPT_TERMS`. Script lấy thêm mọi tên
  có trong `DEFAULTS` mà cả `SUPPORTED_VARIABLES` lẫn danh sách của Directus không khớp: 192 + 20 = 212 mục. Biến API
  đọc mà không có mặc định và không nằm trong hai danh sách thì script không thấy (không có nguồn nào liệt kê chúng).
- `FILES_CONTENT_TYPE_ALLOW_LIST` có trong danh sách hỗ trợ nhưng API không đọc (ghi chú ở `supported-variables.ts:162`);
  trang Cấu hình nói rõ điều đó.
- axe báo `link-in-text-block` (serious): link trong đoạn văn chỉ khác chữ thường bằng màu. Link trong bài viết giờ luôn
  gạch chân; recipe Q-50 và `contracts/web.md` §4 sửa theo.
- Cuộn mượt tới anchor ngay sau khi tải trang bị cắt giữa chừng (thấy trong trình duyệt: dừng ở 11 px). Sau một lần
  tải, nhảy tới anchor là tức thời; cuộn mượt chỉ dùng cho bước nhảy trong trang đang mở.
- Trang mở từ link có anchor không nạp lại khi URL mới chỉ khác phần hash (E2E): hành vi của trình duyệt, không sửa.
- Mặc định của vài biến là định danh dài (`directus_refresh_token`): ô Mặc định không ngắt giữa tên, chỉ ngắt sau dấu
  phẩy của một danh sách.
- Script `sync-docs-api` chưa thêm vào `package.json` ở lượt 1 (file của nó thuộc lượt 2).

**Handoff checklist** (`design-system/qa/handoff-checklist.md`, phần áp dụng cho khu tài liệu):

- Theme: chỉ token (`check-raw-colors` 0 lỗi); không font ngoài; branding không dùng trong bảng màu cú pháp.
- Layout: shell có sẵn; không cuộn ngang ở 768 px (browser test và E2E chromium-768).
- Components: `BoNotice`, `BoButton`, `BoIcon`, `BoTextOverflow`, `menu-dropdown-item` dùng nguyên; trạng thái mặc định,
  hover, focus-visible, đang tải, lỗi, không tìm thấy đã có; không có trạng thái disabled.
- Dark mode: xem trong trình duyệt ở sáng và tối; axe sạch ở cả hai.
- Accessibility: axe (wcag2a/aa, wcag21a/aa) không có vi phạm serious trở lên cho trang mở đầu, một trang biến và một
  bài có code ba ngôn ngữ, bảng, hai loại ô ghi chú; bảy cặp màu của khối code đã vào bảng tương phản; `FOCUS` ở mọi
  phần tử tương tác; hai vùng `nav` có tên; `aria-current`; giảm chuyển động.
- Câu hỏi mở: Q-50 duyệt 2026-11-17, không phần nào chọn ngầm. Một điểm lệch so với recipe đã duyệt: link trong bài luôn
  gạch chân (do axe), đã ghi vào recipe.

**Không đổi API** (T046): thay đổi của lượt không chạm `apps/api/src`, `libs/specs`, `libs/env`, `directus/`; bộ đối chiếu
của `/server/specs/oas` không cần sửa normalizer.

**Chạy trên máy** (2026-11-17): unit web 503 file, 4.666 test xanh, coverage 91,94 % dòng (file của khu tài liệu 100 %
dòng); browser test của khu tài liệu 9 test xanh (chromium); E2E `docs.spec.ts` 12 ca xanh, 4 ca bỏ qua theo bề rộng,
chạy với Vite dev và một API SQLite cục bộ (`E2E_CONFIG=proxy-api BASE_URL=http://127.0.0.1:4221`), chưa chạy với image
nginx (CSP thật chỉ có ở CI); `a11y.spec.ts` chỉ chạy ở CI.

## Kết quả lượt 2 (2026-11-17)

**Đối chiếu 133 operation với route của API** (T050; [Verified] bằng đọc decorator của các controller và gọi thử API
SQLite cục bộ):

| Operation | Trong mô tả tĩnh | Thực tế | Xử lý |
| --- | --- | --- | --- |
| `oauth` | `GET /auth/oauth` | 404 (`ROUTE_NOT_FOUND`); danh sách nhà cung cấp ở `GET /auth` | Loại, có lý do |
| `oauthProvider` | `GET /auth/oauth/{provider}` | 404; SSO bắt đầu ở `/auth/login/{provider}` | Loại, có lý do |
| `getRelation`, `updateRelation`, `deleteRelation` | `/relations/{id}` | Quan hệ được gọi theo collection và field (`:collection/:field`) | Loại; `relations.yaml` bổ sung 4 route đúng |
| `updateExtensionBundle` | `PATCH /extensions/{bundle}/{name}` | 404; extension sửa theo id | Loại, có lý do |

127 operation còn lại khớp route của controller (cùng method, cùng hình đường dẫn). `GET /server/ping` không nằm trong
controller mà ở `app-pipeline.ts:162`; trả `pong`.

Route API phục vụ mà tài liệu v1 không có mục (ngoài mô tả tĩnh và ngoài FR-022): `GET /auth`,
`/auth/login/{provider}` (và callback), `GET /server/health`, `GET /server/specs/oas`, `GET /server/specs/graphql`,
`POST /server/setup`, `/files/tus*`, `POST /files/import`, `/flows/trigger/{id}`, `/assets/folder/{id}`,
`POST /assets/files`, `GET /metrics`, `/graphql*`, `GET /roles/me`, `GET /permissions/me/{collection}`, `PATCH /fields/{collection}`,
`GET /extensions/registry*` và `install`/`reinstall`/`uninstall`, `DELETE /extensions/{id}`,
`GET /extensions/sources/{chunk}`, `POST /settings/owner`, `POST /users/me/tfa/generate`, `POST /users/{id}/tfa/disable`,
`POST /users/register`, `GET /users/register/verify-email`, `POST /utils/revert/{revision}`,
`POST /utils/translations/generate`, `POST /utils/resolve-redirect`, và phương thức `SEARCH` của mọi collection.

**Phần bổ sung** (`apps/web/src/docs/api/supplement/`): 7 resource (policies, access, dashboards, panels,
notifications, translations, shares) qua phần mở rộng `x-crud` (bảy thao tác chuẩn mỗi resource) cộng 4 route riêng
(`/policies/me/globals`, `/shares/auth`, `/shares/invite`, `/shares/info/{id}`); 4 route quan hệ; 26 route
`/backoffice/*` (7 qua `x-crud` của `/backoffice/permissions`, 19 viết tay), mỗi route ghi ai gọi được. Kết quả: 31
resource, 210 operation (127 từ mô tả tĩnh, 83 từ phần bổ sung). Bẫy gặp: YAML dạng `{ ... }` hiểu dấu phẩy trong giá
trị chưa đặt trong nháy là ranh giới (một mô tả bị cắt thành khóa mới); mọi mô tả trong dạng đó giờ đặt trong nháy đơn.

**Ví dụ GraphQL** (T054, T063): 170 ví dụ (163 scope system, 7 scope items); 40 operation không có tương đương GraphQL
(`false`): `/backoffice/*`, import/export, schema, asset, so sánh/lưu/đẩy version, share auth/invite/info,
`track/page`, và tạo collection (input GraphQL của collection không có trường tên). [Verified trên máy] Cả 170 hợp lệ
với SDL của API SQLite cục bộ (`/server/specs/graphql/system` và `/server/specs/graphql/` sau khi tạo collection
`articles`), bằng `validate` của gói `graphql` 16.12.0. Lỗi tìm ra và đã sửa: ví dụ sửa quan hệ gửi `schema` thiếu năm
trường bắt buộc của input (đổi sang `meta`); route một item của Items bị nhận nhầm vì `/items/{collection}` cũng kết thúc
bằng tham số (giờ chỉ `/{id}` là một item). Test parity `tests/parity/src/docs/graphql-examples.test.ts` (suite full,
Postgres) chỉ chạy ở CI.

**Giấy phép** (T049): chủ dự án quyết định 2026-11-17 hiện nguyên văn mô tả lấy từ mô tả tĩnh; dòng `$source` của mỗi
file sinh ghi `libs/specs/dist/openapi.json` và tên script, không có từ bị cấm.

**Dung lượng** (đo trên máy): main bundle 280,9 KB nén (trước feature 280,5 KB; lượt 2 thêm 0,2 KB do chuỗi i18n mới);
chunk `DocsRoute` 22,0 KB (có `index.json` của phần API); mỗi resource một chunk, ví dụ Files 3,0 KB, Backoffice 6,6 KB;
`apps/web/src/docs/api/generated` nặng 624 KB trên đĩa (32 file).

**Bố cục**: trang API không giới hạn `max-w-3xl` (card hai cột trong 768 px quá chật cho bảng tham số; thấy trong trình
duyệt ở 1600 px); recipe Q-50 đã sửa.

**Chạy trên máy**: unit web 507 file, 4.715 test xanh (coverage 91,98 % dòng; file khu tài liệu 100 % dòng); browser
test khu tài liệu 11 test xanh; E2E `docs.spec.ts` 15 ca xanh, 5 ca bỏ qua theo bề rộng (Vite dev, API SQLite cục bộ).

## Kết quả lượt 3 (2026-11-17)

**Hướng dẫn**: 17 trang (`apps/web/src/docs/content/guides/*.md`), 9 trang module và 8 trang tính năng riêng (nhóm
"Tính năng riêng", `backofficeOnly`), mỗi trang có bước đánh số, ít nhất một ảnh có mô tả, điều kiện hay quyền cần có
và link chéo tới mục API, trang cấu hình (FR-018, FR-018a, FR-020). Môi trường đồng bộ nằm ở nhóm tính năng riêng (một
trang, không lặp ở nhóm module). Văn bản tự viết theo màn hình của app (FR-045); không trang nào có từ bị cấm.

**Ảnh**: 24 ảnh PNG 1280×800 (chromium, dpr 1, sáng, vi-VN), 2,0 MB tổng, lớn nhất 240 KB (`files-2`, ảnh mẫu đổi sang
ảnh xám vì ảnh màu vượt 300 KB). Dữ liệu mẫu do `docs-shots/seed.ts` tạo một lần (collection `products`, vai trò, chính
sách, người dùng `@example.com`, thư mục, file từ `tests/parity/fixtures/assets`, flow, dashboard, thông báo, index,
extension `parity-panel-counter`, nguồn đồng bộ có collection `orders`); vùng thay đổi theo lần chạy (thời gian của
Hoạt động, URL nguồn của Đồng bộ) được che (FR-037). Môi trường chụp: hai API Backoffice SQLite cục bộ (đích và nguồn)
và Vite dev, thay cho môi trường `web` của parity ghi ở T070; quickstart ghi cả hai cách.

**SC-010** [Verified trên máy]: lần đầu chụp bằng `page.screenshot` cho 8 ảnh khác từng byte giữa hai lần chạy (2 đến
321 điểm ảnh, khử răng cưa của logo, ảnh thu nhỏ và viền; mắt thường không thấy khác). Đổi `shot()` sang
`toHaveScreenshot` với `snapshotPathTemplate` trỏ vào thư mục ảnh và `updateSnapshots: 'changed'` (ngưỡng mặc định
0,2, `maxDiffPixels: 0`): hai lần chạy tiếp theo cho 0 ảnh đổi; một ảnh bị thay bằng ảnh khác được ghi lại đúng như cũ;
một ảnh bị xóa được tạo lại giống từng byte.

**Test**: `content.test.ts` (37 test: link `/docs/...` và anchor của cả ba phần, ảnh được dùng, tồn tại, có mô tả,
≤ 300 KB, tổng ≤ 8 MB, mỗi hướng dẫn có bước, ảnh và mục); thử làm gãy một anchor thì test báo đúng link. Browser test
thêm hai trang hướng dẫn (ảnh tải xong, axe sáng và tối); E2E thêm ca hướng dẫn Files (ảnh tải xong, link sang mục API,
không vi phạm CSP) và trang `/admin/docs/guides/files` trong `a11y.spec.ts`.

**Chạy trên máy**: unit web 508 file, 4.752 test xanh; browser test khu tài liệu 13 test xanh; E2E `docs.spec.ts` 17
ca xanh, 5 ca bỏ qua theo bề rộng; a11y không báo lỗi nào ở các trang tài liệu (các lỗi còn lại của lượt chạy cục bộ là
fixture flow, dashboard của parity không có trên API cục bộ và màu chip trạng thái của dữ liệu mẫu ở `/admin/content`).
Main bundle 280,9 KB nén, không đổi so với lượt 2 (ảnh và Markdown là chunk lazy).

**Bẫy gặp**: script chụp đổi ngôn ngữ của admin rồi trả lại giá trị đọc lúc đầu; một lượt chạy bị dừng giữa chừng để
lại `vi-VN` và các lượt sau trả lại `vi-VN`, nên E2E (chờ chữ tiếng Anh) hỏng tới khi đặt lại `language = null`.

