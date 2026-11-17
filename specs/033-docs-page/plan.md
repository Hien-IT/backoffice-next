# Implementation Plan: Trang tài liệu (docs) trong app Backoffice

**Branch**: `033-docs-page` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=033-docs-page`) | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/033-docs-page/spec.md`

## Summary

User đã đăng nhập mở "Tài liệu" từ menu người dùng và tới `/admin/docs`: một module ẩn thứ bảy của app web, dùng shell
có sẵn (menu trái của tài liệu nằm trong slot `navigation` của sidebar, research R1, R3). Nội dung là file tĩnh trong
`apps/web/src/docs/`: 18 trang markdown (1 mở đầu, 17 hướng dẫn) render bằng `marked` và DOMPurify có sẵn (R5); phần
API sinh từ `libs/specs/dist/openapi.json` cộng file bổ sung viết tay cho bảy resource còn thiếu và `/backoffice/*`,
ghi thành mỗi resource một file JSON commit vào repo (R7); phần Cấu hình ghép mặc định sinh từ `SUPPORTED_VARIABLES` và
`DEFAULTS` với mô tả viết tay (R8). Khối code tô màu bằng `highlight.js` (dependency mới duy nhất, R6). Ảnh chụp bằng
một project Playwright chạy tay (R10). Không thay đổi nào ở `apps/api`, `libs/specs`, DB, Redis hay biến môi trường.

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict, Node.js 22 LTS, ESM, pnpm 10.27, Nx 23; Vite cho `apps/web`.

**Primary Dependencies**: một gói mới, chủ dự án duyệt 2026-11-17: `highlight.js` 11.12.0 (BSD-3-Clause; chỉ import
`lib/core` và ba ngôn ngữ `bash`, `json`, `graphql`; research R6). Có sẵn: Vue 3.5, Vue Router, vue-i18n 11.4.14, Reka
UI 2.8.2, Tailwind CSS 4.3, `marked` 16.4.1, `dompurify` 3.4.17, `@sindresorhus/slugify` 2.2.1, `js-yaml` và `jiti`
(devDependencies của web), `PrivateView`, `BoMenu`, `BoTabs`, `BoNotice`, `BoDetail`, `BoChip`, `notify`; test: Vitest
3.2.4 (unit happy-dom, browser chromium + axe-core), Playwright 1.64.0, gói `graphql` 16.12.0 của `tests/parity`.

**Storage**: không. Không bảng, cột, migration, khóa Redis, cache. Dữ liệu là file tĩnh trong bản build của web
([data-model.md](./data-model.md)).

**Testing**: unit và browser của `apps/web`; hai script sinh có test "chạy lại và so"; `check-brand` và `check-bundle`
mở rộng; E2E `docs.spec.ts` ba cấu hình và `a11y.spec.ts`; một test trong môi trường parity kiểm ví dụ GraphQL với
schema của API ([contracts/tests.md](./contracts/tests.md)).

**Target Platform**: trình duyệt desktop và tablet (web); image web nginx không đổi cấu hình.

**Project Type**: FE (`apps/web`, `apps/web-e2e`) + một file test ở `tests/parity` + tài liệu design-system.

**Performance Goals**: main bundle tăng không quá 2 KB nén (SC-007, `BUDGET_033`); trang tài liệu đầu tiên hiện dưới 2
giây ở E2E; mỗi trang chỉ tải chunk của nó. Dung lượng chunk khu tài liệu đo ở lượt 1 (research R12).

**Constraints**: không sửa `directus/` (I); không DDL, không ghi DB (II); không endpoint mới, `/server/specs/oas` không
đổi (III); không state trong process, không gì phía máy chủ (IV, VII); không bộ đối chiếu mới vì API không đổi, bộ có
sẵn phải xanh (V); không biến môi trường mới (VIII); không từ "Directus" trong tài liệu, comment viết "DR" (IX);
coverage FE ≥ 60 %, `pnpm audit` cho gói mới (X); bố cục là câu hỏi mở Q-50, không tự chọn (XII).

**Scale/Scope**: Web mới: `modules/docs.ts`, 1 route, 8 component, `docs/{nav,types,render,highlight}.ts`, `docs.css`,
18 file markdown, khoảng 25–40 ảnh, file bổ sung OpenAPI cho 7 resource và 5 nhóm `/backoffice/*`, khoảng 31 file JSON
sinh (23 tag có sẵn + 7 + 1 nhóm riêng), `configuration/variables.ts` với khoảng 190 dòng, 2 script sinh. Sửa:
`modules/index.ts`, `layout/UserMenu.vue`, `utils/markdown.ts`, overlay ×2, `check-brand.mjs`, `check-bundle.mjs`,
`package.json`, `pnpm-workspace.yaml`. E2E: 1 spec, `a11y.spec.ts`, project `docs-shots` và khoảng 17 file `.shots.ts`.
Parity: 1 file test. Tài liệu: `design-system/docs/component-specs.md` và `layout-patterns.md` (Q-50 sau khi duyệt), `migration-guide.md`
(bảng tương phản, checklist CHK019), ghi
chú "(033: ...)" ở spec 012 (bảy module, mục menu), `CLAUDE.md`, `SPECKIT-GUIDE.md`. D-215.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.4.0). Mark PASS, or VIOLATION with a row in Complexity
Tracking.

- [x] I. PASS: không sửa `directus/`. Code mới không phải bản port, đầu file ghi "Backoffice (spec 033)". Hai file port
  bị sửa (`modules/index.ts`, `layout/UserMenu.vue`) ghi chỗ sửa bằng `Backoffice (spec 033, D-215)`.
- [x] II. PASS: không DDL, không ghi DB. Lần ghi duy nhất liên quan là `last_page` do guard có sẵn ghi cho mọi trang
  private.
- [x] III. PASS: không route, query, response hay mã lỗi nào đổi. File bổ sung OpenAPI nằm trong `apps/web`, ngoài
  `spec` mà `/server/specs/oas` dùng (research R7); bộ đối chiếu của hai endpoint specs là bằng chứng.
- [x] IV. PASS: không thay đổi phía máy chủ; Directus trên cùng DB không thấy gì mới.
- [x] V. PASS: API không đổi nên không có ca đối chiếu mới; toàn bộ bộ đối chiếu, blackbox và E2E hiện có phải xanh
  (SC-008). Thêm một test chạy trong môi trường parity nhưng chỉ kiểm tài liệu với API của Backoffice (Complexity
  Tracking).
- [x] VI. PASS: route, guard, shell, store giữ nguyên cấu trúc; trang mới theo mẫu module có sẵn. Không màn hình nào
  của Directus bị đổi luồng.
- [x] VII. PASS: không state, không job, không khóa; image web chỉ thêm file tĩnh.
- [x] VIII. PASS: không biến mới; phần Cấu hình chỉ mô tả biến đã có và test buộc nó khớp `SUPPORTED_VARIABLES`.
- [x] IX. PASS: không từ "Directus" đứng riêng trong chuỗi, markdown, YAML, JSON sinh (FR-047); `check-brand` quét thêm
  `.md`, `.yaml` (research R9); comment trong `apps/web` viết "DR".
- [x] X. PASS với D-215 (khu tài liệu và mục menu chỉ có ở app Backoffice), ghi trong bảng "Khác biệt so với Directus"
  của spec. Gói mới pin trong catalog, chạy `pnpm audit`. Coverage FE giữ ngưỡng.
- [x] XI. PASS: không thêm hạng mục nào thuộc danh sách ngoài phạm vi của mục XI.
- [x] XII. PASS (Q-50 duyệt 2026-11-17, phương án A): mọi màu, cỡ chữ, bóng lấy từ `design-system/tokens/theme.css`; bố cục khu tài liệu chưa
  có mẫu nên là câu hỏi mở Q-50, plan chỉ đề xuất ([contracts/web.md](./contracts/web.md) §4); không code giao diện
  trước khi design owner duyệt (đã duyệt).

Re-check sau Phase 1: không đổi. Ba điểm của Complexity Tracking chủ dự án duyệt 2026-11-17.

## Project Structure

### Documentation (this feature)

```text
specs/033-docs-page/
├── plan.md
├── research.md          # R1–R15
├── data-model.md        # mục lục, trang, resource API, biến, ảnh
├── quickstart.md        # thêm trang, endpoint, biến; chụp lại ảnh
├── contracts/
│   ├── web.md           # route, thành phần, hành vi, đề xuất Q-50, a11y, chuỗi
│   └── tests.md         # unit, browser, E2E, kiểm ví dụ GraphQL, lệnh chụp
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── package.json                         # + highlight.js, 2 script (sync-docs-api, sync-docs-config)
├── scripts/
│   ├── sync-docs-api.mjs (+ .test.ts)   # openapi.json + supplement → api/generated/*.json
│   ├── sync-docs-config.mjs (+ .test.ts)# SUPPORTED_VARIABLES + DEFAULTS → supported.generated.json
│   ├── check-brand.mjs                  # sửa: quét .md, .yaml
│   └── check-bundle.mjs                 # sửa: BUDGET_033, marker highlight.js
└── src/
    ├── modules/
    │   ├── docs.ts (+ .test.ts)         # module ẩn `docs`
    │   ├── index.ts                     # sửa: bảy module
    │   └── docs/
    │       ├── routes/DocsRoute.vue
    │       └── components/              # DocsNavigation, DocsToc, DocsArticle, DocsApiResource,
    │                                    # DocsEndpoint, DocsConfigGroup, DocsCodeBlock, DocsPager
    ├── docs/
    │   ├── nav.ts, types.ts, render.ts, highlight.ts, docs.css
    │   ├── content/index.md, content/guides/*.md (17), content/images/*.png
    │   ├── api/supplement/*.yaml, api/generated/*.json
    │   └── configuration/variables.ts, supported.generated.json
    ├── layout/UserMenu.vue              # sửa: mục "Tài liệu"
    ├── utils/markdown.ts                # sửa: export sanitize()
    └── lang/overlay/{en-US,vi-VN}.ts    # sửa: khóa docs_*

apps/web-e2e/
├── package.json                         # script docs:shots
├── playwright.config.ts                 # project docs-shots khi DOCS_SHOTS=1
└── src/
    ├── docs.spec.ts, a11y.spec.ts (sửa)
    └── docs-shots/*.shots.ts

tests/parity/src/docs/graphql-examples.test.ts
pnpm-workspace.yaml                      # catalog: highlight.js
design-system/docs/{component-specs,layout-patterns}.md   # recipe Q-50 sau khi duyệt
```

**Structure Decision**: mọi thứ của feature nằm trong `apps/web` (code và nội dung) và `apps/web-e2e` (E2E và kịch bản
chụp). `apps/api` và `libs/*` không sửa. Lệnh mới khai báo ở `scripts` của `package.json` vì `apps/web/project.json`
đang có thay đổi chưa commit của session khác (research R15).

## Ba lượt (cho `/speckit.tasks`)

| Lượt | Nội dung | Kết thúc khi |
| --- | --- | --- |
| 1. Khung và Cấu hình | Module `docs`, mục menu, route, menu trái, mục lục, anchor, trước/sau, renderer, tô màu, overlay, `check-brand`, `check-bundle`, trang mở đầu, script và trang Cấu hình, recipe Q-50 | US1, US2, US6 đạt; lint, unit, build xanh; E2E ba cấu hình xanh ở CI |
| 2. API reference | Script sinh, file bổ sung, component resource và endpoint, ví dụ REST và GraphQL, test parity kiểm ví dụ | US3 đạt; 133 operation đã đối chiếu với controller |
| 3. Hướng dẫn và ảnh | 17 trang, project `docs-shots`, ảnh, test nội dung, đóng spec | US4, US5 đạt; SC-010 đo một lần |

Việc đầu lượt 1: các mục [Unverified] số 1–5 và 7 của research; đầu lượt 2: mục 6.

## Rủi ro

| Rủi ro | Cách giảm |
| --- | --- |
| Văn xuôi của hướng dẫn cũ đi khi hành vi đổi; không test nào bắt được | Test chỉ giữ ba phần tra cứu, link và ảnh đúng. Mỗi feature sau 033 có task cập nhật trang của mình (ghi vào `SPECKIT-GUIDE.md` mục 2 khi đóng spec) |
| Ví dụ GraphQL sinh theo quy tắc sai với schema thật | Test parity `docs/graphql-examples.test.ts` chạy `validate` với SDL của API |
| Operation trong mô tả tĩnh mà Backoffice không phục vụ | Đối chiếu đầu lượt 2; danh sách loại trừ có lý do trong script |
| Ảnh làm repo và image web lớn | Giới hạn 300 KB mỗi ảnh, 8 MB tổng, kiểm bằng test; 1280×800, `deviceScaleFactor: 1` |
| Ảnh có dữ liệu thật hoặc từ thương hiệu bị cấm | Chỉ chụp trên dữ liệu mẫu; người chụp rà ảnh trước khi commit (quickstart); chữ trong ảnh không quét tự động được |
| Nội dung tải được không cần đăng nhập (file tĩnh) | FR-015: không bí mật trong tài liệu; ghi rõ ở Assumptions của spec |
| Viết ghi chú vận hành mà không gọi tên hệ thống dùng chung DB làm câu khó hiểu | Mẫu câu ở quickstart; chủ dự án đọc trang Cấu hình ở lượt 1 |
| Mô tả endpoint tiếng Anh giữa trang tiếng Việt | Đã là giả định của spec; `lang="en"` cho đoạn mô tả lấy từ mô tả tĩnh |
| `apps/web/project.json` đang bị session khác sửa | Không thêm target; dùng `scripts` của `package.json` |
| Máy local chưa có trình duyệt Playwright | Cài một lần ở lượt 3 (quickstart); E2E và browser test vẫn chạy ở CI |

## Complexity Tracking

| Điểm | Vì sao cần | Phương án đơn giản hơn và lý do không chọn |
| --- | --- | --- |
| Dependency mới `highlight.js` 11.12.0 | Chủ dự án chọn tô màu bằng thư viện mới (clarify câu 5, FR-010a) | Không tô màu: đã loại ở clarify. prismjs, shiki: research R6 |
| Module nội bộ thứ bảy (`docs`, ẩn) thay vì giữ "sáu module tĩnh" của D-41 | Dùng lại đăng ký route, tiêu đề sidebar, slot `navigation` và drawer dưới `xl` có sẵn | Route riêng ngoài module: phải tự dựng các phần đó (research R1) |
| Một test trong môi trường parity không so với Directus (`docs/graphql-examples.test.ts`) | Ví dụ GraphQL sinh theo quy tắc cần được kiểm với schema thật; môi trường parity là nơi duy nhất có API chạy và gói `graphql` | Không kiểm: ví dụ sai lọt vào tài liệu. Kiểm ở unit của web: không có schema |

## Sửa câu chữ spec khi `/speckit.plan` (2026-11-17; chủ dự án duyệt cùng ngày)

1. FR-055: thêm "một test trong môi trường parity kiểm ví dụ GraphQL của tài liệu với schema của API; không so với
   Directus" (research R7).
2. FR-033: mặc định trong tài liệu được sinh từ danh sách mặc định của app, không viết tay (research R8).
3. FR-047: thêm "giá trị ví dụ trong mô tả API tĩnh có từ đó (một chỗ: tên dự án mẫu) được thay khi sinh nội dung tài
   liệu; mô tả tĩnh không sửa" (research R7).
4. FR-012, FR-014: khu tài liệu là một module ẩn của app (không có ô trong lưới module); user share không có mục menu.
5. Assumptions: endpoint app phục vụ nhưng không có trong mô tả tĩnh lẫn FR-022 (ví dụ health, ping, setup, TUS,
   metrics, GraphQL, đăng nhập theo provider) không có mục ở v1.
6. Assumptions: giới hạn ảnh 300 KB mỗi ảnh, 8 MB tổng.
7. Bảng "Đánh giá hiện trạng" dòng 14: [Inference] thành [Verified] (`libs/specs/index.js:2`–`:8`); thêm dòng 16 (mô tả
   tĩnh có 67 path, 133 operation; `dist/` không nằm trong git).
8. Edge Cases: hash có thể mất qua vòng đăng nhập SSO ([Unverified], research R2); nếu lượt 1 xác nhận thì ghi là giới
   hạn.

## Đã duyệt 2026-11-17 (chủ dự án kiêm tech lead và design owner: "Duyệt như đề xuất")

- D-215 (khu tài liệu và mục menu chỉ có ở app Backoffice).
- Q-50: bố cục phương án A; thân bài `text-base` (chủ dự án chọn riêng), khối code nền tối ở cả hai giao diện, mục menu
  "Tài liệu" với icon `menu_book` ([contracts/web.md](./contracts/web.md) §4).
- `highlight.js` 11.12.0 làm thư viện tô màu.
- Ba điểm của Complexity Tracking và tám sửa câu chữ spec ở trên.
