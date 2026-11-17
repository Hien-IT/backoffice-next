# Feature Specification: Trang tài liệu (docs) trong app Backoffice

**Feature Branch**: `033-docs-page` (làm trên `main` như 012–032, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=033-docs-page`)
**Created**: 2026-11-17
**Status**: Done 2026-11-17. `/speckit.specify` chạy 2026-11-17 (thư mục tạo tay, không chạy `create-new-feature.sh`). Chín điểm phạm vi A–I chủ dự án chốt 2026-11-17 ("Chốt theo đề xuất"). `/speckit.clarify` chạy 2026-11-17 (5 câu: không nhắc tên Directus ở trang nào; phần bổ sung API riêng cho tài liệu; ảnh chụp tay rồi commit; đủ 17 trang hướng dẫn; khối code tô màu bằng thư viện mới). `/speckit.plan` chạy 2026-11-17 (research R1–R15 đọc code, chưa chạy thử; khu tài liệu là module ẩn `docs` trong shell có sẵn; đề xuất `highlight.js` 11.12.0 và bố cục phương án A cho Q-50; 8 sửa câu chữ spec). Chủ dự án kiêm tech lead và design owner duyệt 2026-11-17 sau plan ("Duyệt như đề xuất"): D-215, Q-50 phương án A (thân bài `text-base`, khối code nền tối ở cả hai giao diện, mục menu "Tài liệu" icon `menu_book`), `highlight.js` 11.12.0, ba điểm Complexity Tracking, 8 sửa câu chữ. `/speckit.checklist` chạy 2026-11-17 (content, design-system, security, a11y: 45 mục, 26 phát hiện sửa cùng lượt; chủ dự án duyệt 26 sửa cùng ngày; giấy phép của mô tả API tĩnh còn [Unverified], xác nhận ở đầu lượt 2). `/speckit.tasks` chạy 2026-11-17 (95 task, ba lượt: lượt 1 khung và Cấu hình T001–T048, lượt 2 API reference T049–T065, lượt 3 hướng dẫn và ảnh T066–T095; hai điểm dừng hỏi chủ dự án: T049 giấy phép BUSL-1.1 của gói mô tả API, T070 máy chụp ảnh). `/speckit.analyze` chạy 2026-11-17 (0 CRITICAL, 2 HIGH, 9 MEDIUM, 11 LOW; 57/58 FR có task; chủ dự án "Sửa tất cả", sửa cùng ngày; chủ dự án quyết định hiện nguyên văn mô tả lấy từ mô tả API tĩnh, T049 không còn là điểm dừng; 96 task sau khi thêm T005a). `/speckit.implement` lượt 1 (khung và Cấu hình, T001–T047) làm 2026-11-17: module ẩn `docs`, mục "Tài liệu" ở menu người dùng, route và 7 component, renderer markdown, `highlight.js`, 10 trang biến môi trường với 212 biến, trang mở đầu; main bundle tăng 0,2 KB; unit web 4.666 test, browser test và E2E `docs.spec.ts` xanh trên máy. Lượt 1 lên `main` 6f6b067b. `/speckit.implement` lượt 2 (API reference, T049–T064) làm 2026-11-17: script `sync-docs-api`, phần bổ sung OpenAPI cho 7 resource, quan hệ và 26 route `/backoffice/*`, 31 trang API với 210 operation, 6 operation sai của mô tả tĩnh loại có lý do, 170 ví dụ GraphQL hợp lệ với schema của API cục bộ; test parity `docs/graphql-examples.test.ts` chạy ở CI. Lượt 2 lên `main` 44749941. `/speckit.implement` lượt 3 (hướng dẫn và ảnh, T066–T095) làm 2026-11-17: 17 trang hướng dẫn với 24 ảnh (2,0 MB), `content.test.ts` kiểm link, anchor, ảnh; script chụp `docs:shots` so ảnh bằng `toHaveScreenshot` và chỉ ghi ảnh khác. SC-007: main bundle 280,9 KB nén (trước feature 280,5 KB, +0,4 KB). SC-010: hai lần chạy liền nhau trên cùng máy cho 0 ảnh đổi. Lượt 3 lên `main` `23232112`, cộng ba bản sửa CI: test axe trang API tách theo trang (`23232112`), hai test E2E cũ hỏng theo thời điểm (`a5c4222c` cross-use chờ dòng hiện, `ec0e8b61` presets bỏ `page: 1` mặc định của map); CI xanh 44112716532.
**Input**: User description: "Feature 033: trang tài liệu (docs) của Backoffice nằm ngay trong web app tại /admin/docs/...,
bố cục theo docs của Directus (tham chiếu https://directus.com/docs/api/files#list-files,
https://directus.com/docs/configuration/general, https://directus.com/docs/guides/files/upload): menu trái theo nhóm,
nội dung ở giữa có breadcrumb, tiêu đề, câu dẫn, mục lục "Trên trang này" bên phải, mỗi tiêu đề có anchor, link trang
trước và trang sau. [...] Đây là tính năng chỉ của Backoffice (như 022, 025, 029, 030, 031, 032). Phạm vi đã chốt (chủ
dự án 2026-11-17): 1. Ba phần nội dung: hướng dẫn sử dụng có ảnh, API reference, Configuration. 2. Nguồn: OAS tĩnh trong
repo cộng phần bổ sung chỉ cho docs; danh sách biến viết tay có test đối chiếu; markdown trong repo. 3. User đã đăng
nhập mới xem. 4. Lối vào ở menu người dùng. 5. Nội dung vi-VN ở v1. 6. Ảnh chụp bằng script. 7. Trang vẫn mở khi API là
Directus. 8. Theo design-system, bố cục là câu hỏi mở Q-50. 9. Không làm main bundle lớn thêm. [...] Khác biệt với
Directus ghi từ D-215 [...]" (bản đầy đủ: lệnh `/speckit.specify` của 033 trong `SPECKIT-GUIDE.md` mục 6)

**Điều kiện trước `/speckit.plan`** (Governance):

- Dự kiến không sửa constitution: không bảng, không cột, không migration, không endpoint, không biến môi trường mới;
  khác biệt giao diện ghi theo Nguyên tắc X (bảng "Khác biệt so với Directus", tech lead duyệt).
- Một dependency mới: thư viện tô màu cú pháp cho khối code (clarify 2026-11-17, FR-010a). Plan đề xuất thư viện kèm
  giấy phép, dung lượng và kết quả audit. Chủ dự án duyệt 2026-11-17: `highlight.js` 11.12.0 (BSD-3-Clause); dung lượng
  nén và `pnpm audit` đo ở lượt 1.
- Khác biệt D-215: chủ dự án kiêm tech lead duyệt 2026-11-17, sau `/speckit.plan`. Không có D-215.1 (clarify
  2026-11-17).
- Câu hỏi design-system Q-50 (bố cục trang tài liệu và bảng màu cú pháp, Nguyên tắc XII): design owner duyệt 2026-11-17 phương án A
  của `contracts/web.md` §4; spec không tự chọn.
- Năm câu của `/speckit.clarify` đã được trả lời 2026-11-17 (mục Clarifications).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mở tài liệu từ app và đi lại trong đó (Priority: P1) 🎯 MVP

Một user đã đăng nhập mở menu người dùng và chọn "Tài liệu". Trang tài liệu hiện ra với menu trái theo nhóm (Hướng dẫn,
API, Cấu hình), nội dung ở giữa có breadcrumb, tiêu đề và câu dẫn, mục lục "Trên trang này" bên phải. User bấm một mục
ở menu trái để sang trang khác, bấm một mục của mục lục để nhảy tới một tiêu đề, và dùng link trang trước, trang sau ở
cuối trang. User chép URL của một tiêu đề gửi cho đồng nghiệp; đồng nghiệp mở link, đăng nhập nếu cần, và tới đúng tiêu
đề đó.

**Why this priority**: Hôm nay app không có tài liệu nào cho người dùng. Khung trang là nền của mọi story sau, và chỉ
riêng khung cùng một trang mở đầu đã cho người dùng một nơi để tìm.

**Independent Test**: Đăng nhập, mở "Tài liệu" từ menu người dùng, đi qua ba trang bằng menu trái, nhảy tới một tiêu đề
bằng mục lục, chép URL có anchor, đăng xuất, mở URL đó, đăng nhập và thấy đúng tiêu đề.

**Acceptance Scenarios**:

1. **Given** user đã đăng nhập ở bất kỳ trang nào của app, **When** mở menu người dùng và chọn "Tài liệu", **Then**
   trang mở đầu của tài liệu hiện với menu trái, nội dung và mục lục.
2. **Given** đang ở một trang tài liệu, **When** bấm một mục khác ở menu trái, **Then** nội dung đổi sang trang đó, mục
   đang mở được đánh dấu trong menu và URL đổi theo.
3. **Given** một trang có nhiều tiêu đề, **When** bấm một mục của "Trên trang này", **Then** trang cuộn tới tiêu đề đó
   và URL có anchor của nó.
4. **Given** một URL tài liệu có anchor, **When** một user đã đăng nhập mở URL, **Then** đúng trang hiện và cuộn tới
   đúng tiêu đề.
5. **Given** một URL tài liệu có anchor, **When** một người chưa đăng nhập mở URL rồi đăng nhập, **Then** họ tới đúng
   trang và đúng tiêu đề đó.
6. **Given** một trang không phải trang đầu hay cuối, **When** xem cuối trang, **Then** có link tới trang trước và trang
   sau theo thứ tự của menu trái.
7. **Given** URL trỏ tới một trang tài liệu không tồn tại, **When** mở, **Then** thấy thông báo không tìm thấy trong
   khung tài liệu, kèm link về trang mở đầu.
8. **Given** màn hình hẹp hơn mốc `xl`, **When** mở tài liệu, **Then** menu trái mở bằng một nút và mục lục bên phải
   không hiện; nội dung vẫn đọc được và trang không cuộn ngang.
9. **Given** user chỉ dùng bàn phím, **When** đi qua menu trái, nội dung và mục lục, **Then** mọi link tới được bằng
   Tab và thấy rõ vị trí focus.

---

### User Story 2 - Tra biến môi trường (Priority: P1)

Người vận hành cần biết Backoffice đọc những biến môi trường nào, mỗi biến làm gì và mặc định là gì. Họ mở phần Cấu
hình, chọn một nhóm (ví dụ Chung, Cơ sở dữ liệu, Bảo mật, File) và đọc bảng Tên / Mô tả / Mặc định của nhóm đó.

**Why this priority**: Danh sách biến hiện chỉ có trong code. Người vận hành phải đọc tài liệu của Directus, vốn có cả
biến Backoffice không dùng và thiếu ghi chú riêng của Backoffice.

**Independent Test**: Mở phần Cấu hình, tìm biến `PUBLIC_URL` qua nhóm của nó, đọc mô tả và mặc định; đối chiếu mặc
định với giá trị app thực dùng.

**Acceptance Scenarios**:

1. **Given** phần Cấu hình, **When** mở một nhóm, **Then** thấy bảng với ba cột Tên, Mô tả, Mặc định cho mọi biến của
   nhóm.
2. **Given** một biến Backoffice đọc và dùng, **When** tìm trong phần Cấu hình, **Then** biến có đúng một dòng, ở đúng
   một nhóm.
3. **Given** một họ biến theo mẫu (ví dụ các biến bắt đầu bằng `DB_`), **When** xem nhóm của nó, **Then** họ biến có
   một dòng nêu mẫu tên và cách dùng.
4. **Given** một biến có mặc định, **When** xem dòng của nó, **Then** mặc định ghi trong tài liệu bằng mặc định app
   dùng.
5. **Given** một biến của Directus mà Backoffice không đọc, **When** tìm trong phần Cấu hình, **Then** biến không có
   dòng nào.
6. **Given** mỗi nhóm biến, **When** xem mục lục bên phải, **Then** mỗi bảng con của nhóm có một tiêu đề và anchor
   riêng.

---

### User Story 3 - Tra API reference (Priority: P1)

Lập trình viên tích hợp với Backoffice mở phần API, chọn một resource (ví dụ Files). Trang resource mở đầu bằng mô tả
và danh sách endpoint (method và đường dẫn). Mỗi endpoint có mô tả, bảng tham số query hoặc thân request (tên, kiểu, mô
tả), các trả lời theo mã trạng thái, ví dụ gọi bằng REST và GraphQL, và một trả lời mẫu. Các endpoint chỉ có ở
Backoffice (`/backoffice/*`) cũng có trang.

**Why this priority**: API là cách hệ thống khác dùng Backoffice. Tài liệu của Directus không có các endpoint riêng của
Backoffice và mô tả bản Directus mới hơn bản Backoffice tương thích.

**Independent Test**: Mở trang Files, bấm "List Files" trong danh sách endpoint, đọc tham số `fields` và ví dụ REST;
mở trang của nhóm endpoint riêng và thấy endpoint tạo index.

**Acceptance Scenarios**:

1. **Given** phần API, **When** xem menu trái, **Then** mỗi resource là một mục, xếp theo bảng chữ cái, và các endpoint
   riêng của Backoffice nằm trong một nhóm tách riêng.
2. **Given** trang một resource, **When** xem đầu trang, **Then** thấy mô tả resource và danh sách mọi endpoint của nó
   với method và đường dẫn; bấm một dòng thì tới mục của endpoint đó.
3. **Given** mục của một endpoint có tham số, **When** đọc, **Then** mỗi tham số có tên, kiểu và mô tả, tách nhóm query
   và thân request.
4. **Given** mục của một endpoint, **When** xem phần trả lời, **Then** thấy từng mã trạng thái với mô tả, và cấu trúc
   của trả lời thành công mở ra, thu lại được.
5. **Given** mục của một endpoint có cách gọi tương đương qua GraphQL, **When** xem ví dụ, **Then** chọn được giữa REST
   và GraphQL; endpoint không có tương đương GraphQL chỉ có ví dụ REST.
6. **Given** một khối ví dụ, **When** bấm nút chép, **Then** nội dung khối vào clipboard và có xác nhận.
7. **Given** một endpoint `/backoffice/*`, **When** tìm trong phần API, **Then** có mục của nó với cùng các phần như
   endpoint khác, kèm ghi chú rằng endpoint chỉ có khi máy chủ là Backoffice.
8. **Given** hai user có quyền khác nhau, **When** cùng mở một trang resource, **Then** họ thấy cùng nội dung.

---

### User Story 4 - Đọc hướng dẫn sử dụng có ảnh (Priority: P2)

Người dùng mới muốn biết cách làm một việc trong app. Họ mở phần Hướng dẫn, chọn trang của một module (ví dụ Files) hoặc
của một tính năng riêng (ví dụ Passkey) và đọc các bước, mỗi bước chính có ảnh chụp màn hình Backoffice.

**Why this priority**: Hướng dẫn có ảnh là phần người dùng cuối cần nhất, nhưng phụ thuộc khung (US1) và tốn công viết
nhất, nên đi sau hai phần tra cứu.

**Independent Test**: Mở trang hướng dẫn Files, làm theo các bước tải một file lên trong một tab khác của app và thấy
màn hình khớp ảnh.

**Acceptance Scenarios**:

1. **Given** phần Hướng dẫn, **When** xem menu trái, **Then** có một trang cho mỗi module: Content, Files, Users,
   Insights, Activity và Notifications, Data Model, Roles và Policies, Flows, Extensions.
2. **Given** phần Hướng dẫn, **When** xem menu trái, **Then** có một trang cho mỗi tính năng riêng của Backoffice: ẩn
   hiện tìm kiếm, import, export theo collection; filter theo path json; quyền import, export theo policy; filter so
   sánh hai field; passkey; index; tải extension lên; đồng bộ môi trường.
3. **Given** một trang hướng dẫn, **When** đọc, **Then** nội dung là các bước đánh số theo thứ tự làm, và có ít nhất
   một ảnh chụp màn hình Backoffice.
4. **Given** một ảnh trong trang, **When** dùng trình đọc màn hình, **Then** ảnh có mô tả thay thế nói ảnh cho thấy gì.
5. **Given** giao diện tối, **When** xem một trang có ảnh, **Then** ảnh tách rõ khỏi nền và chữ quanh ảnh vẫn đọc được.
6. **Given** một trang của tính năng riêng, **When** đọc đầu trang, **Then** có ghi chú rằng tính năng chỉ có khi máy
   chủ là Backoffice.
7. **Given** một trang hướng dẫn nhắc tới một endpoint hoặc một biến môi trường, **When** bấm link, **Then** tới đúng
   mục của nó ở phần API hoặc Cấu hình.

---

### User Story 5 - Tài liệu không lệch với sản phẩm (Priority: P2)

Người bảo trì đổi code: thêm một endpoint, thêm một biến môi trường, đổi một màn hình. Bộ kiểm tra tự động báo ngay khi
tài liệu thiếu mục cho endpoint hoặc biến đó, khi một link hay anchor gãy, khi một ảnh được nhắc tới không có. Khi giao
diện đổi, người bảo trì chạy một lệnh để chụp lại toàn bộ ảnh.

**Why this priority**: Tài liệu sai gây hại hơn không có tài liệu. Kiểm tự động là cách duy nhất giữ ba phần tra cứu
đúng mà không phải rà tay sau mỗi feature.

**Independent Test**: Thêm tạm một biến vào danh sách biến của app mà không thêm vào tài liệu và thấy kiểm tra đỏ; sửa
tạm một link nội bộ thành sai và thấy kiểm tra đỏ.

**Acceptance Scenarios**:

1. **Given** một biến app đọc và dùng chưa có dòng trong phần Cấu hình, **When** chạy kiểm tra, **Then** kiểm tra đỏ và
   nêu tên biến.
2. **Given** một dòng trong phần Cấu hình không ứng với biến nào app dùng, hoặc có mặc định khác mặc định của app,
   **When** chạy kiểm tra, **Then** kiểm tra đỏ và nêu dòng đó.
3. **Given** một endpoint trong mô tả API của repo hoặc một endpoint `/backoffice/*` chưa có mục, **When** chạy kiểm
   tra, **Then** kiểm tra đỏ và nêu endpoint.
4. **Given** một link nội bộ, một anchor hoặc một ảnh được nhắc tới mà không tồn tại, **When** chạy kiểm tra, **Then**
   kiểm tra đỏ và nêu trang cùng chỗ gãy.
5. **Given** giao diện app đã đổi, **When** người bảo trì chạy lệnh chụp ảnh, **Then** mọi ảnh của tài liệu được chụp
   lại trên cùng dữ liệu mẫu, cùng kích thước, và chỉ ảnh của màn hình đã đổi mới khác đi.
6. **Given** một ảnh trong trang không có mô tả thay thế, **When** chạy kiểm tra, **Then** kiểm tra đỏ.

---

### User Story 6 - Chạy song song với Directus 11.17.4 (Priority: P2)

Một tổ chức chạy Backoffice cạnh Directus trên cùng DB. Thêm trang tài liệu không đổi gì ở Directus và ở API: không
endpoint, bảng hay biến môi trường mới, tài liệu OpenAPI do máy chủ trả vẫn như cũ. Khi app Backoffice nói chuyện với
API của Directus, trang tài liệu vẫn mở.

**Why this priority**: Giữ tương thích là nguyên tắc của dự án; story này là hàng rào, không thêm giá trị mới.

**Independent Test**: Chạy bộ đối chiếu và E2E hiện có trước và sau feature; mở tài liệu ở cấu hình app nói chuyện với
API của Directus.

**Acceptance Scenarios**:

1. **Given** feature đã cài, **When** chạy bộ đối chiếu, blackbox và E2E hiện có, **Then** không test nào đổi kết quả.
2. **Given** feature đã cài, **When** gọi tài liệu OpenAPI của máy chủ, **Then** trả lời giống trước feature.
3. **Given** app Backoffice dùng API của Directus, **When** mở "Tài liệu" từ menu người dùng, **Then** trang mở và đọc
   được như khi API là Backoffice.
4. **Given** app của Directus, **When** mở cùng đường dẫn tài liệu, **Then** không có trang này (D-215).

---

### Edge Cases

- URL có anchor không tồn tại trong trang: trang mở ở đầu, không báo lỗi.
- User không có quyền vào app: thấy màn hình không có quyền như ở mọi trang riêng khác, không thấy tài liệu.
- Tải nội dung một trang thất bại (mất mạng): thấy thông báo lỗi và nút thử lại; menu trái vẫn dùng được.
- Ngôn ngữ của user là en-US: chuỗi của khung (menu người dùng, "Trên trang này", trước, sau, nút chép, thông báo) hiện
  tiếng Anh; nội dung vẫn tiếng Việt và vùng nội dung được đánh dấu là tiếng Việt cho trình đọc màn hình.
- Bảng rộng hoặc khối code dài trên màn hình hẹp: cuộn ngang trong khung của chính nó, cuộn được bằng bàn phím; cả
  trang không cuộn ngang.
- Trang resource có rất nhiều endpoint: mục lục bên phải cuộn riêng và đánh dấu mục đang đọc.
- Endpoint không có tham số, không có thân trả lời (204) hoặc không có trả lời mẫu: các phần đó không hiện, không để
  khung trống.
- Endpoint trả file hoặc nhận upload nhiều phần: ví dụ REST nêu đúng cách gửi; không có ví dụ GraphQL.
- Biến môi trường chứa bí mật (ví dụ `SECRET`): tài liệu mô tả biến, không bao giờ nêu một giá trị thật.
- Ảnh chụp có dữ liệu thay đổi theo lần chạy (ngày giờ, mã định danh): được cố định hoặc che khi chụp để ảnh không đổi
  khi giao diện không đổi.
- Hai tiêu đề trùng chữ trong một trang: mỗi tiêu đề vẫn có anchor riêng, ổn định giữa các lần build.
- Tiêu đề tiếng Việt có dấu: anchor chép vào thanh địa chỉ, chat hay email rồi mở lại vẫn tới đúng chỗ.
- User đổi ngôn ngữ hoặc giao diện sáng, tối khi đang đọc: khung đổi theo, vị trí đọc giữ nguyên.
- Tên kỹ thuật viết thường có chứa `directus` (tên bảng hệ thống, tên cookie mặc định, tên gói của extension): giữ
  nguyên trong tài liệu vì người đọc phải gõ đúng; từ "Directus" đứng riêng thì không xuất hiện (FR-047).
- Đăng nhập bằng SSO sau khi mở một URL có anchor: [Inference, đọc code ở lượt 1, chưa chạy] anchor nằm trong tham
  số `redirect` của trang đăng nhập nên đi qua vòng chuyển hướng của nhà cung cấp (research "Kết quả lượt 1"). Không
  có E2E cho trường hợp này.
- Một tính năng riêng bị tắt ở môi trường đang dùng (ví dụ passkey khi `PUBLIC_URL` không hợp lệ): trang hướng dẫn vẫn
  hiện và nêu điều kiện để tính năng có.

## Requirements *(mandatory)*

### Functional Requirements

**Khung và điều hướng**

- **FR-001**: App Backoffice PHẢI có một khu tài liệu dưới `/admin/docs`, mỗi trang tài liệu có một URL riêng và ổn
  định.
- **FR-002**: Khu tài liệu có ba phần: Hướng dẫn, API, Cấu hình; và một trang mở đầu giới thiệu ba phần cùng cách đi
  lại.
- **FR-003**: Mỗi trang có menu trái liệt kê các trang theo nhóm, đánh dấu trang đang mở; nhóm thu gọn, mở ra được.
- **FR-004**: Mỗi trang có breadcrumb (phần, nhóm, trang), một tiêu đề và một câu dẫn.
- **FR-005**: Mỗi trang có mục lục "Trên trang này" sinh từ các tiêu đề của trang, đánh dấu mục đang đọc khi cuộn.
- **FR-006**: Mỗi tiêu đề có một anchor ổn định giữa các lần build, duy nhất trong trang, và có cách chép link tới nó.
- **FR-007**: Mở một URL có anchor PHẢI đưa người đọc tới đúng tiêu đề; anchor không tồn tại thì mở đầu trang.
- **FR-008**: Cuối mỗi trang có link trang trước và trang sau theo thứ tự của menu trái.
- **FR-009**: URL tài liệu không ứng với trang nào hiện thông báo không tìm thấy trong khung tài liệu, kèm link về
  trang mở đầu.
- **FR-010**: Nội dung hỗ trợ: tiêu đề nhiều cấp, đoạn văn, danh sách, bảng, khối code có nút chép, ô ghi chú (thông
  tin, cảnh báo), ảnh, link nội bộ và link ngoài; link ngoài mở tab mới với `rel="noopener noreferrer"` (sửa khi checklist 2026-11-17).
- **FR-010a**: Khối code được tô màu cú pháp bằng một thư viện tô màu mới (clarify 2026-11-17), ít nhất cho lệnh shell
  (ví dụ curl), GraphQL và JSON. Màu lấy từ token của design-system, có ở giao diện sáng và tối, mỗi màu chữ đạt tương
  phản AA trên nền khối code. Khối không ghi ngôn ngữ hoặc ghi ngôn ngữ không được hỗ trợ hiện chữ đơn cách một màu.
  Nút chép lấy đúng chữ gốc, không kèm định dạng. Thư viện chỉ được tải cùng khu tài liệu (FR-044). Bảng màu cú pháp
  không dùng thang `brand-*` (thang này sinh từ màu dự án của settings, tương phản không bảo đảm được); mỗi cặp màu
  của khối code có trong bảng tương phản của design-system (sửa khi checklist 2026-11-17).
- **FR-011**: Tải nội dung thất bại hiện thông báo và nút thử lại. Trong lúc tải lần đầu, vùng nội dung hiện trạng
  thái đang tải theo mẫu của design-system và báo cho trình đọc màn hình; khi đổi trang, nội dung cũ giữ tới khi nội
  dung mới sẵn sàng (sửa khi checklist 2026-11-17).

**Quyền xem và lối vào**

- **FR-012**: Chỉ user đã đăng nhập và có quyền vào app mới xem được khu tài liệu qua giao diện; mọi user như vậy xem
  được toàn bộ, không phân theo role.
- **FR-013**: Người chưa đăng nhập mở một URL tài liệu được đưa tới trang đăng nhập, và sau khi đăng nhập tới đúng
  trang và anchor đã mở.
- **FR-014**: Menu người dùng có một mục "Tài liệu" (en-US: "Documentation") mở trang mở đầu; mục này có ở mọi trang
  của app sau đăng nhập. Khu tài liệu không có ô trong lưới module của sidebar; user share không có mục menu này (plan
  2026-11-17, duyệt cùng ngày).
- **FR-015**: Tài liệu KHÔNG chứa bí mật: không token, mật khẩu, khóa, URL nội bộ hay dữ liệu thật của một tổ chức,
  trong chữ lẫn trong ảnh. Lý do: file của app web là file tĩnh ai cũng tải được, FR-012 chỉ ẩn lối vào. Kiểm:
  phần chữ do bước quét bí mật có sẵn của CI quét; ảnh do người chụp rà trước khi commit (sửa khi checklist 2026-11-17).

**Phần Hướng dẫn**

- **FR-016**: Có một trang hướng dẫn cho mỗi module: Content, Files, Users, Insights, Activity và Notifications, Data
  Model, Roles và Policies, Flows, Extensions.
- **FR-017**: Có một trang hướng dẫn cho mỗi tính năng riêng của Backoffice: ẩn hiện tìm kiếm, import, export theo
  collection (022, 024); filter theo path json (023); quyền import, export theo policy (025); filter so sánh hai field
  (028); passkey (029); index (030); tải extension lên (031); đồng bộ môi trường (032).
- **FR-018**: Mỗi trang hướng dẫn viết theo bước theo thứ tự người dùng làm, có ít nhất một ảnh chụp màn hình
  Backoffice, và nêu quyền hoặc điều kiện cần để làm được. Các bước đọc hiểu được khi không xem ảnh: ảnh minh họa,
  không thay cho chữ (sửa khi checklist 2026-11-17).
- **FR-018a**: Phạm vi tối thiểu của mỗi trang (sửa khi checklist 2026-11-17). Trang module: module dùng để làm gì, cách
  mở, xem và tìm, tạo, sửa, xóa (các việc module có), và link tới trang của các tính năng riêng liên quan. Trang tính
  năng riêng: tính năng làm gì, ai dùng được, bật hoặc cấu hình ở đâu, các bước dùng, giới hạn đã biết.
- **FR-019**: Trang của tính năng riêng ghi ở đầu rằng tính năng chỉ có khi máy chủ là Backoffice.
- **FR-020**: Trang hướng dẫn link tới mục tương ứng ở phần API và Cấu hình khi nhắc tới một endpoint hoặc một biến.

**Phần API**

- **FR-021**: Mỗi resource của mô tả API tĩnh trong repo có một trang; mỗi endpoint của mô tả đó có một mục. Ngoại
  lệ duy nhất: endpoint Backoffice không phục vụ, nêu trong một danh sách loại trừ có lý do cho từng dòng (sửa khi checklist 2026-11-17).
- **FR-022**: Resource Backoffice phục vụ nhưng mô tả API tĩnh chưa có (policies, access, dashboards, panels,
  notifications, translations, shares) và mọi endpoint `/backoffice/*` PHẢI có trang và mục, lấy từ một phần bổ sung
  chỉ dùng cho tài liệu.
- **FR-023**: Phần bổ sung của FR-022 KHÔNG được đổi tài liệu OpenAPI do máy chủ trả.
- **FR-024**: Trang resource mở đầu bằng mô tả resource và danh sách endpoint (method và đường dẫn), mỗi dòng link tới
  mục của endpoint.
- **FR-025**: Mục của một endpoint gồm: tên, mô tả, tham số query và thân request (tên, kiểu, bắt buộc hay không, mô
  tả), các trả lời theo mã trạng thái, cấu trúc trả lời thành công mở ra và thu lại được, và một trả lời mẫu khi có.
- **FR-026**: Mỗi endpoint có ví dụ REST; endpoint có cách gọi tương đương qua GraphQL có thêm ví dụ GraphQL, người đọc
  chọn giữa hai ví dụ. Không có ví dụ SDK. "Tương đương" nghĩa là schema GraphQL của app có thao tác cho cùng
  collection và cùng hành động; mỗi endpoint được ghi rõ là có hoặc không, không để trống (sửa khi checklist 2026-11-17).
- **FR-027**: Mục của endpoint `/backoffice/*` ghi rằng endpoint chỉ có khi máy chủ là Backoffice, và ghi ai gọi
  được: chỉ admin, mọi user đã đăng nhập, hoặc không cần đăng nhập (sửa khi checklist 2026-11-17).
- **FR-028**: Nội dung phần API giống nhau với mọi user: không đọc từ máy chủ lúc xem, không gồm collection của user.
- **FR-029**: Ví dụ dùng tên máy chủ và token giả, rõ ràng là giả: máy chủ `https://backoffice.example.com`, token
  `<token>`, định danh lấy từ giá trị ví dụ của mô tả API (sửa khi checklist 2026-11-17).

**Phần Cấu hình**

- **FR-030**: Phần Cấu hình liệt kê mọi biến môi trường Backoffice đọc và dùng, chia theo nhóm, mỗi nhóm một trang với
  bảng Tên / Mô tả / Mặc định. Mỗi mô tả nêu biến làm gì và dạng giá trị nhận (ví dụ số giây, danh sách cách nhau
  bằng dấu phẩy, đúng hoặc sai) (sửa khi checklist 2026-11-17).
- **FR-031**: Biến của Directus mà Backoffice không đọc KHÔNG có trong phần Cấu hình.
- **FR-032**: Họ biến theo mẫu (app nhận mọi biến có cùng tiền tố) có một dòng nêu mẫu tên và cách dùng; các biến
  thường dùng trong họ có thể có dòng riêng.
- **FR-033**: Mặc định ghi trong tài liệu PHẢI bằng mặc định app dùng; biến không có mặc định để trống ô đó. Cột Mặc
  định được sinh từ danh sách mặc định của app, không viết tay (plan 2026-11-17, duyệt cùng ngày).

**Ảnh**

- **FR-034**: Ảnh trong tài liệu là ảnh chụp app Backoffice, chụp bằng một lệnh chạy lại được, trên dữ liệu mẫu cố
  định, cùng kích thước và cùng giao diện sáng.
- **FR-035**: Ảnh được lưu trong repo cùng nội dung. Người bảo trì chạy lệnh chụp bằng tay trên một máy có trình duyệt
  của công cụ E2E rồi commit ảnh; CI không chụp lại, chỉ kiểm rằng ảnh được nhắc tới có tồn tại và có mô tả thay thế
  (clarify 2026-11-17). Tài liệu cho người bảo trì ghi cách cài trình duyệt và cách chạy lệnh.
- **FR-036**: Mỗi ảnh có mô tả thay thế; thiếu mô tả là lỗi của kiểm tra. Mô tả nói ảnh cho thấy màn hình nào và ở
  trạng thái nào; mô tả rỗng hoặc chỉ là tên file là lỗi (sửa khi checklist 2026-11-17).
- **FR-037**: Dữ liệu đổi theo lần chạy (ngày giờ, mã định danh) được cố định hoặc che khi chụp. Giá trị nhạy cảm
  hiện trên màn hình (token, mã QR của xác thực hai bước, URL và token ở trang đồng bộ môi trường) là giá trị giả hoặc
  được che (sửa khi checklist 2026-11-17).

**Ngôn ngữ, giao diện, hiệu năng**

- **FR-038**: Nội dung tài liệu có hai bản, tiếng Việt và tiếng Anh, theo ngôn ngữ của user: vi-VN đọc bản tiếng Việt,
  mọi ngôn ngữ khác đọc bản tiếng Anh; đổi ngôn ngữ thì trang đang mở hiện lại bằng ngôn ngữ mới (sửa đổi 2026-11-18,
  trước đó chỉ có tiếng Việt). Bản tiếng Anh gồm hướng dẫn, trang mở đầu, tên và câu dẫn của menu, mô tả biến cấu hình,
  văn bản của phần bổ sung API và giá trị mẫu trong ví dụ; ảnh của bản tiếng Anh chụp app ở en-US với dữ liệu mẫu tiếng
  Anh. Trong bản tiếng Việt, mô tả endpoint, tham số và schema lấy từ mô tả API tĩnh hiện nguyên văn tiếng Anh (sửa khi
  checklist 2026-11-17). Chuỗi của khung (mục menu, "Trên trang này", trước, sau, chép, thông báo lỗi, không tìm thấy)
  theo ngôn ngữ của user, có en-US và vi-VN. Anchor theo tiêu đề của từng bản, nên link có anchor gửi giữa hai ngôn ngữ
  mở đúng trang nhưng ở đầu trang (FR-007, anchor không có thì giữ nguyên trang).
- **FR-039**: Vùng nội dung được đánh dấu ngôn ngữ của bản đang hiện (`vi` hoặc `en`) để trình đọc màn hình đọc đúng.
  Đoạn tiếng Anh của FR-038 trong bản tiếng Việt được đánh dấu là tiếng Anh (sửa khi checklist 2026-11-17).
- **FR-040**: Giao diện theo design-system: màu, chữ, bóng từ token; giao diện sáng và tối; branding của settings áp
  lên như các trang khác.
- **FR-041**: Dưới mốc `xl`, menu trái mở bằng một nút và mục lục bên phải ẩn; bảng và khối code cuộn ngang trong khung
  của chúng; trang không cuộn ngang. Bề rộng nhỏ nhất được hỗ trợ là 768 px như phần còn lại của app (layout-patterns
  §2); hẹp hơn không thuộc phạm vi (sửa khi checklist 2026-11-17).
- **FR-042**: Bố cục khu tài liệu (ba cột, khối endpoint, bảng biến, ô ghi chú, khối code, ảnh) chưa có mẫu trong
  design-system: là câu hỏi mở Q-50 cho design owner; spec và plan không tự chọn.
- **FR-043**: Mọi thao tác làm được bằng bàn phím; menu trái và mục lục là hai vùng điều hướng có tên; trang đang mở và
  mục đang đọc được báo cho trình đọc màn hình; tiêu đề đúng cấp; không vi phạm axe mức serious trở lên. Cuộn tới anchor và mọi chuyển động của khu tài liệu tôn
  trọng `prefers-reduced-motion` (sửa khi checklist 2026-11-17).
- **FR-044**: Khu tài liệu KHÔNG làm phần app tải lúc mở lần đầu lớn thêm quá mức của SC-007; nội dung của một trang
  chỉ được tải khi mở trang đó hoặc phần chứa nó.

**Nội dung**

- **FR-045**: Nội dung do dự án tự viết; không chép văn bản từ directus.com. Mô tả endpoint lấy từ mô tả API đã có
  trong repo. Kiểm bằng rà soát của chủ dự án ở cuối mỗi lượt; không có kiểm tự động (sửa khi checklist 2026-11-17).
- **FR-046**: Mọi HTML đưa vào trang đi qua bộ lọc HTML an toàn sẵn có của app: markdown đã chuyển, mô tả lấy từ mô tả
  API, mô tả biến và kết quả tô màu; mọi giá trị khác hiện dạng chữ thường. Không có cách sửa nội dung trong app
  (sửa khi checklist 2026-11-17).
- **FR-047**: Tài liệu KHÔNG nhắc tên Directus ở bất kỳ trang nào, trong chữ lẫn trong ảnh, kể cả phần Cấu hình và ghi
  chú vận hành (clarify 2026-11-17); quy tắc là quy tắc kiểm thương hiệu của 012 (FR-030, FR-082): từ "Directus" đứng
  riêng bị cấm, định danh kỹ thuật viết thường có chứa `directus` (tên bảng như `directus_files`, tên cookie mặc định,
  tên gói `@directus/...`) được giữ nguyên. Kiểm thương hiệu PHẢI quét cả nội dung tài liệu, gồm markdown, phần bổ
  sung API và dữ liệu phần Cấu hình. Chữ trong ảnh không quét tự động được: người chụp rà ảnh trước khi commit
  (sửa khi checklist 2026-11-17). Chỗ cần nói tới hệ thống chạy cùng DB thì viết theo vai trò (ví dụ "hệ thống dùng
  chung cơ sở dữ liệu"), không gọi tên. Mô tả API tĩnh có đúng một giá trị ví dụ chứa từ đó (tên dự án mẫu); giá trị
  này được thay khi sinh nội dung tài liệu, mô tả tĩnh không sửa (plan 2026-11-17, duyệt cùng ngày).

**Tương thích**

- **FR-048**: Không endpoint, bảng, cột, migration, biến môi trường mới; không sửa hành vi của endpoint nào.
- **FR-048a**: Khu tài liệu chạy được dưới chính sách bảo mật nội dung (CSP) mặc định của image web; không nới chỉ thị
  nào, nội dung không sinh style hay script nội tuyến (sửa khi checklist 2026-11-17).
- **FR-049**: Khi app dùng API của Directus, khu tài liệu vẫn mở và hiện cùng nội dung; mục menu không ẩn.
- **FR-050**: Ngoài phạm vi v1: tìm kiếm toàn văn, trợ lý AI, nút gọi thử API, ví dụ SDK, nhiều phiên bản tài liệu, tài
  liệu cho collection của user, sửa tài liệu trong app, nút chép cả trang, phản hồi "trang này có ích không".

**Kiểm thử**

- **FR-051**: Kiểm tra tự động cho phần Cấu hình: mọi biến app đọc và dùng có dòng; mọi dòng ứng với một biến app
  dùng; mặc định khớp.
- **FR-052**: Kiểm tra tự động cho phần API: mọi endpoint của mô tả API tĩnh và mọi endpoint `/backoffice/*` app phục
  vụ có mục.
- **FR-053**: Kiểm tra tự động cho nội dung: mọi link nội bộ, anchor và ảnh được nhắc tới đều tồn tại; mọi ảnh có mô tả
  thay thế; mọi trang của FR-016 và FR-017 tồn tại và có ít nhất một ảnh.
- **FR-054**: E2E `docs` ở ba cấu hình (`proxy-directus`, `proxy-api`, `cors`): mở từ menu người dùng, đi qua menu
  trái, mở link có anchor, người chưa đăng nhập về đúng trang sau khi đăng nhập; a11y axe như 016.
- **FR-055**: Không có bộ đối chiếu mới (API không đổi); bộ đối chiếu hiện có của tài liệu OpenAPI là bằng chứng cho
  FR-023. Một test trong môi trường parity kiểm mọi ví dụ GraphQL của tài liệu với schema của API; test này không so
  với Directus (plan 2026-11-17, duyệt cùng ngày).
- **FR-101**: Bảng "Khác biệt so với Directus" có cột `Mã` đầu, `Gỡ ở` cuối để `tests/parity/src/spec-differences.ts`
  đọc; D-215 là entry `doc` (trang chỉ có ở app Backoffice).

### Key Entities

Không thực thể nào được lưu ở DB; tất cả là nội dung tĩnh đi cùng bản build của app.

- **Trang tài liệu**: một đơn vị nội dung có URL, phần (Hướng dẫn, API, Cấu hình), nhóm, tiêu đề, câu dẫn, thứ tự trong
  menu và danh sách tiêu đề con có anchor.
- **Mục lục khu tài liệu**: danh sách có thứ tự các phần, nhóm và trang; sinh ra menu trái, breadcrumb, trang trước và
  trang sau.
- **Resource API**: một nhóm endpoint có tên và mô tả; nguồn là mô tả API tĩnh của repo hoặc phần bổ sung chỉ cho tài
  liệu.
- **Endpoint**: method, đường dẫn, tên, mô tả, tham số, thân request, các trả lời theo mã, ví dụ REST, ví dụ GraphQL khi
  có, trả lời mẫu, cờ "chỉ có ở Backoffice".
- **Biến môi trường**: tên hoặc mẫu tên, nhóm, mô tả, mặc định, ghi chú.
- **Ảnh chụp**: file ảnh, mô tả thay thế, màn hình và dữ liệu mẫu dùng để chụp lại.

### Đánh giá hiện trạng và chạy song song với Directus 11.17.4

Đọc code ngày 2026-11-17; mục có nhãn [Inference] chưa mở file kiểm, plan xác nhận.

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Trang tài liệu trong app | Không có: router chỉ có các trang công khai và `private-404`; sáu module tĩnh; menu người dùng chỉ có Profile và Sign out | `apps/web/src/router/index.ts:92`, `apps/web/src/modules/index.ts`, `apps/web/src/layout/UserMenu.vue:36` |
| 2 | Mô tả API tĩnh | Có: title đã là Backoffice; 23 thư mục `paths` (activity, assets, auth, collections, comments, extensions, fields, files, flows, folders, items, operations, permissions, presets, relations, revisions, roles, schema, server, settings, users, utils, versions) | `libs/specs/src/openapi.yaml:4`, `libs/specs/src/paths` |
| 3 | Resource thiếu trong mô tả tĩnh | Không có thư mục riêng cho policies, access, dashboards, panels, notifications, translations, shares; không có path `/backoffice/*` | `libs/specs/src/paths` |
| 4 | Tài liệu OpenAPI của máy chủ | Dựng từ chính mô tả tĩnh đó cộng collection của user; sửa mô tả tĩnh thì trả lời của máy chủ đổi và lệch Directus | `apps/api/src/controllers/server.controller.ts:23`, `apps/api/src/services/specifications.service.ts:4`, `:56` |
| 5 | Endpoint chỉ của Backoffice | Năm controller: passkey, index, tải extension lên, quyền import/export, đồng bộ môi trường | `apps/api/src/controllers/backoffice-*.controller.ts` |
| 6 | Danh sách biến app dùng | Là danh sách mẫu tên (ví dụ `LOGGER_.+`, `DB_.+`), không có mô tả hay mặc định; danh sách "không áp dụng" rỗng | `apps/api/src/config/supported-variables.ts:5`, `:224` |
| 7 | Mặc định và tên biến của Directus | Hai file hằng số | `libs/env/src/constants/defaults.ts`, `directus-variables.ts` |
| 8 | Hiển thị markdown an toàn | Có sẵn một hàm chuyển markdown thành HTML đã lọc | `apps/web/src/utils/markdown.ts:30` |
| 9 | Tô màu code | App không có thư viện tô màu code riêng; có trình soạn code của interface `input-code` | `apps/web/package.json` |
| 10 | Kiểm thương hiệu | Cấm chữ Directus trong chuỗi người dùng thấy (FR-030, FR-082 của 012); chỉ quét file `vue`, `ts`, `css`, `html`, `svg`, `json`, không quét markdown | `apps/web/scripts/check-brand.mjs:32` |
| 11 | Giới hạn bundle | Main bundle 350 KB gzip, mỗi feature có ngân sách riêng; phần tải sau không tính | `apps/web/scripts/check-bundle.mjs:1` |
| 12 | File của app web | File tĩnh công khai dưới `/admin/`; `public` chỉ có `config.json` và `favicon.ico` | `apps/web/nginx.conf:45`, `apps/web/public` |
| 13 | Chụp màn hình tự động | Đã dùng trong E2E; máy local của dự án không có trình duyệt của công cụ E2E (ghi ở 032) | `apps/web-e2e/src/branding.spec.ts:69` |
| 14 | Mô tả tĩnh trong trình duyệt | [Verified, plan R7] Gói mô tả API đọc file bằng API của Node nên app web không dùng trực tiếp được | `libs/specs/index.js:2`–`:8` |
| 16 | Kích thước mô tả tĩnh | 67 path, 133 operation, 23 tag, operation nào cũng có định danh; file đã gộp nặng 286 KB và không nằm trong git | `libs/specs/dist/openapi.json`, `.gitignore:5` |
| 17 | Đăng nhập rồi quay lại | Guard gửi người chưa đăng nhập tới trang đăng nhập kèm đường dẫn đầy đủ (gồm anchor); form đăng nhập local mở lại đường dẫn đó | `apps/web/src/router/guard.ts:75`, `apps/web/src/routes/login/LoginForm.vue:73`–`:81` |
| 18 | Module ẩn | Module có `hidden` vẫn đăng ký route và có tên ở đầu sidebar (Activity) | `apps/web/src/modules/index.ts:55`–`:67`, `apps/web/src/layout/composables/use-module-bar.ts:73`–`:81` |
| 15 | Bộ đối chiếu đọc mã D | Cột `Mã` đầu, `Gỡ ở` cuối; từ đầu của dòng `Status` | `tests/parity/src/spec-differences.ts:27`–`:36` |

**Kết luận** (suy từ thiết kế, plan xác nhận): Directus không phải làm gì; DB, Redis, cấu hình và API không đổi. Điều
kiện duy nhất là phần bổ sung API của tài liệu nằm ngoài mô tả tĩnh mà máy chủ dùng (dòng 4, FR-023).

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021–032).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-215 | Khu tài liệu `/admin/docs` và mục "Tài liệu" trong menu người dùng | Không có module tài liệu trong app (`directus/app/src/modules`); `directus/app/src/constants.ts` giữ URL của trang tài liệu ngoài | Có ở app Backoffice, cả khi API là Directus; nội dung tĩnh; entry `doc` | Yêu cầu chủ dự án 2026-11-17: người dùng và người vận hành cần tài liệu của chính Backoffice, gồm các tính năng riêng 022–032 | khác (duyệt 2026-11-17) | — |

**Đã xác nhận 2026-11-17** (chủ dự án kiêm tech lead và design owner, sau `/speckit.plan`: "Duyệt như đề xuất"):

- D-215.
- Q-50 (design-system): bố cục khu tài liệu. Các phần cần mẫu: khung ba cột và cách nó nằm trong shell của app (cạnh
  sidebar module hay thay sidebar); menu trái theo nhóm; mục lục dính; khối endpoint (method, đường dẫn, tham số, trả
  lời, ví dụ); bảng biến; ô ghi chú; khối code có nút chép và bảng màu cú pháp theo token cho sáng và tối (FR-010a);
  khung ảnh trên nền tối; dạng dưới `xl`. Chưa có mẫu trong `design-system/docs/layout-patterns.md`; plan đề xuất,
  design owner chọn.
- Nhãn mục menu en-US/vi-VN (đề xuất: "Documentation" / "Tài liệu") và icon của nó.
- Thư viện tô màu cú pháp do plan đề xuất (dependency mới duy nhất).

## Clarifications

### Session 2026-11-17 (chủ dự án, `/speckit.clarify`)

- Q: Tài liệu trong app có được nhắc tên Directus không? → A: Không nhắc ở đâu, kể cả trang vận hành; giữ đúng quy
  tắc thương hiệu của 012 cho mọi trang, không có D-215.1 (FR-047; kiểm thương hiệu quét cả nội dung tài liệu).
- Q: Mô tả của resource còn thiếu và của `/backoffice/*` đặt ở đâu? → A: Một phần bổ sung chỉ dùng cho tài liệu; mô tả
  API tĩnh mà máy chủ dùng không đổi, tài liệu OpenAPI của máy chủ vẫn giống trước (FR-022, FR-023 giữ nguyên).
- Q: Ảnh chụp màn hình được chụp ở đâu? → A: Người bảo trì chạy lệnh bằng tay trên máy có trình duyệt của công cụ E2E
  rồi commit; CI chỉ kiểm ảnh tồn tại và có mô tả thay thế, không chụp lại (FR-035; SC-010 đo trên cùng một máy).
- Q: Phần Hướng dẫn ở v1 gồm bao nhiêu trang? → A: Đủ 17 trang: 9 trang module và 8 trang tính năng riêng, mỗi trang
  ít nhất một ảnh (FR-016, FR-017, SC-003 giữ nguyên); các trang Settings còn lại (Project, Appearance, Presets,
  Translations, Marketplace) không thuộc v1.
- Q: Khối code hiển thị thế nào? → A: Tô màu cú pháp bằng một thư viện mới (FR-010a); đây là dependency mới duy nhất
  của feature, plan chọn thư viện (giấy phép, dung lượng, tải cùng khu tài liệu) và chủ dự án duyệt; bảng màu cú pháp
  theo token thêm vào Q-50.

Hệ quả của câu 1 và câu 5 so với đề xuất ban đầu: không có D-215.1; "không dependency mới" thành "một dependency mới".

### Sửa câu chữ khi `/speckit.plan` (2026-11-17, research R1–R15; duyệt 2026-11-17)

- FR-055: thêm test kiểm ví dụ GraphQL với schema của API trong môi trường parity, không so với Directus (R7).
- FR-033: cột Mặc định sinh từ danh sách mặc định của app (R8).
- FR-047: một giá trị ví dụ trong mô tả API tĩnh có từ bị cấm, được thay khi sinh nội dung (R7).
- FR-014: khu tài liệu không có ô trong lưới module; user share không có mục menu (R1, R11).
- Assumptions: endpoint ngoài mô tả tĩnh và ngoài FR-022 không có mục ở v1 (R7); giới hạn dung lượng ảnh (R10).
- Bảng "Đánh giá hiện trạng": dòng 14 thành [Verified]; thêm dòng 16–18 (R1, R2, R7).
- Edge Cases: anchor qua vòng đăng nhập SSO, [Unverified] (R2).
- Plan đề xuất `highlight.js` 11.12.0 (BSD-3-Clause) cho FR-010a và bố cục phương án A cho Q-50
  ([contracts/web.md](./contracts/web.md) §4); cả hai duyệt 2026-11-17.

### Duyệt 2026-11-17 (chủ dự án kiêm tech lead và design owner, sau `/speckit.plan`: "Duyệt như đề xuất")

- D-215: khu tài liệu `/admin/docs` và mục "Tài liệu" trong menu người dùng chỉ có ở app Backoffice.
- Q-50: bố cục phương án A (khu tài liệu trong shell có sẵn, menu trái ở sidebar, cột bài viết và cột "Trên trang
  này"). Bốn câu hỏi con: (a) phương án A; (b) thân bài `text-base` 16 px, bảng, code và menu `text-theme-sm` (chủ dự
  án chọn riêng điểm này, vì plan nêu hai cỡ mà không đề xuất một); (c) khối code nền tối ở cả hai giao diện, một
  bảng màu cú pháp; (d) nhãn "Documentation" / "Tài liệu", icon `menu_book`.
- Thư viện tô màu: `highlight.js` 11.12.0 (BSD-3-Clause), chỉ core và ba ngôn ngữ `bash`, `json`, `graphql`.
- Ba điểm Complexity Tracking của plan: dependency mới; module nội bộ thứ bảy `docs` (ẩn); một test trong môi trường
  parity kiểm ví dụ GraphQL, không so với Directus.
- Tám sửa câu chữ spec của mục trên.

### Sửa khi `/speckit.checklist` (2026-11-17: content 14, design-system 11, security 10, a11y 10 mục; 26 phát hiện)

- Nội dung (8): FR-018a phạm vi tối thiểu của mỗi trang; FR-021 và SC-004 có ngoại lệ là danh sách loại trừ; FR-026
  định nghĩa "tương đương"; FR-030 nội dung tối thiểu của mô tả biến; FR-045 cách kiểm và giả định [Unverified] về
  giấy phép của mô tả tĩnh; FR-047 và SC-011 phần ảnh kiểm bằng rà tay; FR-038, FR-039 đoạn tiếng Anh lấy từ mô tả
  tĩnh; FR-036 nội dung của mô tả thay thế.
- Design-system (6): FR-010a không dùng thang `brand-*` cho màu cú pháp (contracts đổi từ khóa sang `warning-300`) và
  các cặp màu vào bảng tương phản; FR-011 trạng thái đang tải; contracts thêm recipe `FOCUS` và hover; FR-041 bề rộng
  nhỏ nhất 768 px; contracts/tests.md thêm cổng handoff-checklist.
- Bảo mật (7): FR-015 cách kiểm; FR-037 che giá trị nhạy cảm trên màn hình; FR-029 giá trị giả cụ thể; FR-046 bốn
  nguồn HTML qua bộ lọc; FR-010 `rel` của link ngoài; FR-048a không nới CSP; FR-027 ghi ai gọi được.
- Trợ năng (5): contracts thêm thứ tự Tab và link bỏ qua, cấp tiêu đề của trang API và trang biến, ô tiêu đề của
  bảng; FR-043 `prefers-reduced-motion`; FR-018 các bước hiểu được khi không xem ảnh.
- Hai điểm nêu riêng cho chủ dự án: đổi màu từ khóa của bố cục Q-50 đã duyệt (CHK018); giấy phép của mô tả tĩnh
  (CHK010).

### Xem lại sửa của checklist (chủ dự án, 2026-11-17: "Duyệt, chạy tasks")

- 26 sửa của checklist: duyệt, gồm đổi màu từ khóa của khối code từ `brand-300` sang `warning-300` và cấm thang
  `brand-*` cho màu cú pháp (CHK018).
- Giấy phép của phần mô tả trong mô tả API tĩnh (CHK010): vẫn [Unverified]; là một task đầu lượt 2, chủ dự án xác
  nhận trước khi phần API được commit.

### Sửa khi `/speckit.analyze` (2026-11-17: 0 CRITICAL, 2 HIGH, 9 MEDIUM, 11 LOW; chủ dự án: "Sửa tất cả")

- U1: chủ dự án quyết định hiện nguyên văn phần mô tả lấy từ mô tả API tĩnh (gói nguồn ghi giấy phép BUSL-1.1);
  task T049 chỉ còn ghi nhận, không còn điểm dừng ở đầu lượt 2.
- I1: không ghi đè khóa dịch có sẵn ở overlay (test hiện có cấm); cần thì thêm khóa mới `docs_*`.
- I2: FR-044 tham chiếu SC-007 (trước ghi nhầm SC-006).
- C3: SC-002 kiểm ở E2E bằng đường đi không quá 4 lần bấm từ trang mở đầu.
- Sửa ở tasks, data-model, contracts (không đổi yêu cầu): kiểm CSP (FR-048a), kiểm lọc HTML cho ba nguồn còn lại
  (FR-046), breadcrumb và câu dẫn (FR-004), bằng chứng của SC-007, trường "ai gọi được" trong data-model, một cách
  duy nhất để có file mô tả đã gộp, môi trường nguồn cho ảnh của trang đồng bộ, typecheck ở cổng đóng lượt, cài
  trình duyệt ở Phase 1, và bảy ca test nhỏ.

### Sửa khi `/speckit.implement` lượt 1 (2026-11-17)

- FR-030, FR-051: "biến Backoffice đọc và dùng" là danh sách hỗ trợ của API cộng 20 biến có mặc định mà API đọc
  nhưng danh sách đó không nêu (`TUS_*`, `RETENTION_*`, `PRESSURE_LIMITER_*`...): 212 mục. Danh sách hỗ trợ một mình
  không đủ (bảng hiện trạng dòng 6 chỉ mô tả danh sách đó). Biến API đọc mà không có mặc định và không nằm trong danh
  sách nào thì không có nguồn để liệt kê tự động.
- Q-50: link trong bài viết luôn gạch chân (axe `link-in-text-block`), khác câu "gạch chân khi hover" của bố cục đã
  duyệt; recipe đã sửa.
- FR-007, FR-043: nhảy tới anchor sau một lần tải trang là tức thời; cuộn mượt chỉ cho bước nhảy trong trang đang mở.

### Sửa khi `/speckit.implement` lượt 2 (2026-11-17)

- FR-021, SC-004: danh sách loại trừ có 6 operation của mô tả tĩnh mà API không phục vụ như mô tả (`/auth/oauth`,
  `/auth/oauth/{provider}`, `/relations/{id}` ba thao tác, `/extensions/{bundle}/{name}`); phần bổ sung thêm 4 route
  quan hệ đúng (theo collection và field).
- FR-022: phần bổ sung dùng phần mở rộng `x-crud` để sinh bảy thao tác chuẩn của một collection hệ thống.
- FR-026: tạo collection không có ví dụ GraphQL (input GraphQL của collection không có trường tên).
- Q-50: trang API dùng hết bề rộng cột bài viết (không `max-w-3xl`).

### Sửa khi `/speckit.implement` lượt 3 (2026-11-17)

- FR-035, SC-010: mỗi ảnh là một so sánh `toHaveScreenshot` với file đã commit, ghi lại chỉ khi khác (ngưỡng mặc định
  của Playwright), vì `page.screenshot` cho ảnh khác từng byte do khử răng cưa dù màn hình không đổi.
- FR-016: trang Đồng bộ môi trường nằm ở nhóm tính năng riêng, không lặp ở nhóm module (17 trang).

### Sửa đổi 2026-11-18: bản tiếng Anh (chủ dự án)

- Chủ dự án chốt: sửa thẳng trong 033 (không mở feature mới); dịch toàn bộ; ngôn ngữ theo ngôn ngữ của app (vi-VN →
  tiếng Việt, ngôn ngữ khác → tiếng Anh), không thêm nút chuyển; chụp bộ ảnh tiếng Anh riêng.
- FR-038, FR-039 sửa như trên. Tệp: `content/en/` (trang mở đầu và 17 hướng dẫn), `content/images/en/` (24 ảnh cùng
  tên), `configuration/variables.en.ts` (cùng nhóm, bảng, dòng với `variables.ts`), `api/generated/en/` (sinh từ phần
  bổ sung qua bảng `api/supplement/en.json` và `noun-en` của `x-crud`; script dừng khi bản tiếng Anh còn chữ tiếng
  Việt), `nav.ts` dựng một menu cho mỗi ngôn ngữ với cùng đường dẫn.
- Ảnh tiếng Anh: `DOCS_LANG=en` cho `docs:shots`, trên một database riêng với dữ liệu mẫu tiếng Anh (`docs-shots/lang.ts`).
- FR-031 (chủ dự án 2026-11-18, "hiện chi tiết từng biến"): một dòng nhóm biến (`DB_*`, `SERVER_*`, `LOGGER_*`,
  `CONTENT_SECURITY_POLICY_*`, `HSTS_*`, `RATE_LIMITER_*`, `RATE_LIMITER_EMAIL_FLOWS_*`, `HASH_*`,
  `AUTH_<PROVIDER>_CLIENT_HTTP_*`, và `STORAGE_LOCAL_*` dưới hai dòng `STORAGE_<LOCATION>_*`) có thêm một dòng thụt vào
  cho mỗi biến, với mô tả và mặc định riêng; mặc định lấy từ `DEFAULTS` của API qua `members` của
  `supported.generated.json`; tên mỗi biến đã đối chiếu với code đọc nó; tùy chọn chuyển thẳng cho thư viện ghi dạng
  `<OPTION>`. Sửa luôn tên sai `HASH_LENGTH` thành `HASH_HASH_LENGTH` (tùy chọn `hashLength` của argon2).
- Lên `main`: bản tiếng Anh `00db302a` (CI xanh 44158240153 ở `864cbeb8`, sau hai bản sửa CI của D-216 `66652490`,
  `864cbeb8`); biến của từng nhóm `cf23ebf0` (CI xanh 44183639114).

## Assumptions

- Chín điểm phạm vi A–I do chủ dự án chốt 2026-11-17 (`SPECKIT-GUIDE.md` mục 6, 033): route trong app; user đã đăng
  nhập; mô tả API tĩnh cộng phần bổ sung; nội dung vi-VN; ảnh chụp bằng script; lối vào ở menu người dùng; ví dụ REST
  và GraphQL; trang vẫn mở khi API là Directus; danh sách không làm ở v1 (FR-050).
- "Cần đăng nhập" là ẩn lối vào, không phải bảo mật: nội dung đi cùng file tĩnh của app, tải được không cần đăng nhập.
  Vì vậy tài liệu không chứa bí mật (FR-015). Tổ chức cần giấu cả nội dung thì phải chặn ở tầng mạng, ngoài phạm vi.
- [Inference] Mọi endpoint trong mô tả API tĩnh đều đã được Backoffice phục vụ (feature 001–011, 020). Plan đối chiếu;
  endpoint Backoffice không phục vụ thì không đưa vào tài liệu.
- Người đọc phần Cấu hình và API đọc được tên biến, tên field và ví dụ bằng tiếng Anh; phần mô tả viết tiếng Việt, tên
  kỹ thuật giữ nguyên.
- Mô tả endpoint trong mô tả API tĩnh là tiếng Anh. v1 hiển thị nguyên văn mô tả đó; dịch sang tiếng Việt không thuộc
  v1 (plan nêu chi phí nếu chủ dự án muốn đổi).
- Hướng dẫn cho 021 (chạy độc lập), 026 (domain riêng), 027 (UUID v7) không có trang riêng ở v1: 021 và 026 là việc
  vận hành đã có ở `deploy/README`, 027 không có giao diện. Phần Cấu hình vẫn có đủ biến của chúng.
- Endpoint app phục vụ nhưng không có trong mô tả API tĩnh lẫn FR-022 (ví dụ health, ping, setup, upload TUS, metrics,
  GraphQL, đăng nhập theo provider) không có mục ở v1 (plan 2026-11-17, duyệt cùng ngày).
- Giới hạn ảnh: mỗi ảnh không quá 300 KB, tổng không quá 8 MB, kiểm tự động (plan 2026-11-17, duyệt cùng ngày).
- Giấy phép của phần mô tả trong mô tả API tĩnh (bản port của gói mô tả API của Directus): [Verified 2026-11-17]
  `directus/packages/specs/package.json` ghi `"license": "BUSL-1.1"` và gói có file `license` riêng. Chủ dự án
  quyết định 2026-11-17 (analyze U1): hiện nguyên văn phần mô tả có sẵn trong tài liệu. Spec này không chứa đánh giá
  pháp lý nào về quyết định đó. Phần mô tả này đã là một phần của sản phẩm: máy chủ trả nó qua tài liệu
  OpenAPI (sửa khi checklist 2026-11-17; quyết định ở analyze).
- GraphQL chỉ xuất hiện dưới dạng ví dụ cạnh endpoint REST; không có trang tham chiếu riêng cho schema GraphQL ở v1.
- Văn xuôi của hướng dẫn không có kiểm tra tự động nào bắt được khi hành vi đổi; các feature sau 033 phải cập nhật
  trang của mình như một việc trong tasks.
- Ảnh chụp ở giao diện sáng, một kích thước màn hình rộng, ngôn ngữ app là vi-VN.
- Số trang hướng dẫn ở v1 là 17 (9 module, 8 tính năng riêng) cộng một trang mở đầu.

- Phần Cấu hình không gọi tên hệ thống dùng chung DB (FR-047), nên ghi chú về biến dùng chung (ví dụ `SECRET`, biến
  Redis) viết theo vai trò: "phải trùng với hệ thống dùng chung cơ sở dữ liệu, nếu có".

Năm câu chờ `/speckit.clarify` đã được trả lời 2026-11-17 (mục Clarifications); không còn câu mở ở mức spec.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Từ bất kỳ trang nào của app, user mở được tài liệu trong 2 lần bấm; đạt trong 100% lần thử ở E2E ba cấu
  hình, bằng chuột và bằng bàn phím.
- **SC-002**: Không dùng tìm kiếm, một người chưa đọc tài liệu tìm được mô tả của một biến môi trường cho trước và mục
  của một endpoint cho trước trong dưới 1 phút mỗi thứ, chỉ bằng menu trái và mục lục. E2E kiểm bằng đường đi: từ trang mở đầu tới một biến và tới một endpoint
  trong không quá 4 lần bấm mỗi thứ (sửa khi analyze 2026-11-17).
- **SC-003**: 100% module của FR-016 (9) và tính năng riêng của FR-017 (8) có trang hướng dẫn với ít nhất một ảnh.
- **SC-004**: 100% endpoint của mô tả API tĩnh mà app phục vụ (mọi endpoint trừ danh sách loại trừ của FR-021) và 100%
  endpoint `/backoffice/*` app phục vụ có mục trong phần API.
- **SC-005**: 100% biến môi trường Backoffice đọc và dùng có dòng trong phần Cấu hình; 0 dòng có mặc định khác mặc
  định của app; 0 dòng cho biến Backoffice không đọc.
- **SC-006**: 0 link nội bộ, anchor hay ảnh gãy; 0 ảnh thiếu mô tả thay thế.
- **SC-007**: Phần app tải lúc mở lần đầu lớn thêm không quá 2 KB (nén) so với trước feature; trang tài liệu đầu tiên
  hiện trong dưới 2 giây ở môi trường E2E.
- **SC-008**: 0 test đối chiếu, blackbox và E2E hiện có đổi kết quả; tài liệu OpenAPI do máy chủ trả giống trước
  feature.
- **SC-009**: Khu tài liệu không có vi phạm axe mức serious trở lên ở giao diện sáng và tối; mọi thao tác làm được bằng
  bàn phím.
- **SC-010**: Người bảo trì chụp lại toàn bộ ảnh bằng một lệnh; chạy lại lệnh trên cùng một máy khi giao diện không
  đổi cho ra 0 ảnh khác.
- **SC-011**: 0 token, mật khẩu, khóa hay URL nội bộ thật trong chữ và ảnh của tài liệu; 0 lần từ "Directus" đứng
  riêng trong chữ và ảnh của tài liệu. Phần chữ kiểm tự động; phần ảnh kiểm bằng rà tay khi chụp.
