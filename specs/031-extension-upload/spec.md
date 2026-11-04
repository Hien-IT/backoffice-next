# Feature Specification: Cài extension bằng gói `.tgz` tải lên

**Feature Branch**: `031-extension-upload` (làm trên `main` như 012–030, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=031-extension-upload`)
**Created**: 2026-11-04
**Status**: Implemented 2026-11-04 in two waves on `main`. Lượt 1 (API) 6636043a (CI 41805541284 xanh: quality, parity Postgres/SQLite/MySQL, blackbox, cache, deploy, deploy-k8s, e2e ba cấu hình); lượt 2 (web) commit sau CI đó. Local: unit api 392 file / 4449 test, parity `extensions/*` 7 file / 32 test trên Postgres gồm đo D-212.1, deploy `extension-upload` 3 replica; web lint, typecheck, build, unit + browser (dialog với axe), E2E `settings-extensions-upload` ba cấu hình chromium. Spec, clarify 3 câu, plan, checklist api-compat/security/data-safety, tasks 56, analyze 2026-11-04; D-212..D-212.3, điểm Complexity Tracking và các sửa câu chữ của plan/checklist/analyze duyệt 2026-11-04 bởi chủ dự án kiêm tech lead.
**Input**: User description: "Feature 031: admin cài extension bằng cách tải lên một gói .tgz (kết quả của npm pack)
trong Backoffice, thay vì chỉ cài từ Marketplace registry hoặc chép thư mục tay vào EXTENSIONS_PATH. Bối cảnh: Directus
11.17.4 và Backoffice chỉ cài extension từ registry [...] hoặc đọc thư mục có sẵn trong EXTENSIONS_PATH (source local).
Không có endpoint hay nút nào nhận file. Đây là tính năng chỉ của Backoffice (như 022, 025, 029, 030). Phạm vi đã chốt
(chủ dự án 2026-11-04): 1. Chỉ nhận gói .tgz hoặc .tar.gz đúng cấu trúc npm pack [...]; không nhận .zip. 2. Chỉ admin;
endpoint multipart dưới tiền tố /backoffice/ [...]. 3. Gói được lưu ở EXTENSIONS_PATH/.upload/<id> [...], dòng
directus_extensions có source mới upload [...], trùng name → 409. 4. Cùng luật sandbox với registry [...]. 5. Kích thước
tối đa theo FILES_MAX_UPLOAD_SIZE [...]. 6. Web: Settings > Extensions có nút Upload [...]; nút ẩn khi API là Directus.
7. Nhiều replica [...]. Khác biệt với Directus ghi từ D-212 [...]" (bản đầy đủ: lệnh `/speckit.specify` của 031 trong
`SPECKIT-GUIDE.md` mục 6)

**Điều kiện trước `/speckit.plan`** (Governance):

- Không sửa constitution: không bảng mới, không migration, không biến môi trường mới; dòng `directus_extensions` có sẵn
  chỉ nhận thêm một giá trị `source`; khác biệt API và giao diện ghi theo Nguyên tắc X (bảng "Khác biệt so với
  Directus", tech lead duyệt).
- Không dependency mới: giải nén tar dùng thư viện đã có của luồng cài từ registry (020); `.zip` ngoài phạm vi vì cần
  thư viện mới.
- Khác biệt D-212..D-212.3: chủ dự án kiêm tech lead duyệt sau `/speckit.plan`, sau khi plan đo thật hành vi của Directus
  với dòng `source: upload` (mục "Đánh giá hiện trạng" dòng 4–6).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin tải một gói extension lên và dùng ngay (Priority: P1) 🎯 MVP

Admin có một gói extension đóng bằng `npm pack` (ví dụ do đội nội bộ build, hoặc tải từ một kho riêng không có trên
Marketplace). Trong Settings > Extensions, admin bấm Upload, chọn file `.tgz`, xác nhận. Gói được cài, hiện trong danh
sách với nguồn "Uploaded", bật sẵn, và phần API của nó (endpoint, hook, operation) hay phần app (interface, display,
module, panel, layout) hoạt động ngay, không khởi động lại máy chủ.

**Why this priority**: Đây là toàn bộ giá trị của feature: hôm nay chỉ cài được từ registry công khai hoặc chép thư mục
tay vào máy chủ (cần quyền vào hạ tầng); gói nội bộ không có đường cài qua giao diện.

**Independent Test**: Tải gói fixture endpoint lên ở Backoffice, gọi đường dẫn của endpoint đó và nhận trả lời; mở
danh sách Extensions thấy gói với nguồn Uploaded.

**Acceptance Scenarios**:

1. **Given** admin ở Settings > Extensions với API là Backoffice, **When** bấm Upload, chọn một gói `.tgz` hợp lệ và xác
   nhận, **Then** hộp thoại đóng, danh sách tải lại và có gói mới (tên và phiên bản từ `package.json` của gói, nguồn
   Uploaded, trạng thái bật).
2. **Given** gói vừa tải lên là một endpoint, **When** gọi đường dẫn của endpoint đó, **Then** endpoint trả lời như khi
   cài từ registry.
3. **Given** gói vừa tải lên có phần app (ví dụ interface), **When** tải lại app, **Then** interface xuất hiện trong danh
   sách chọn interface của Data Model như extension từ registry.
4. **Given** gói là bundle, **When** tải lên, **Then** dòng cha và từng entry hiện như bundle từ registry; bật/tắt từng
   entry được như hiện nay.
5. **Given** gói có khai báo sandbox, **When** tải lên và gọi, **Then** nó chạy trong sandbox với đúng scope đã khai
   báo như gói registry có sandbox.
6. **Given** gói đã cài, **When** tắt rồi bật lại trong danh sách, **Then** hành vi như gói registry (tắt: không chạy;
   bật: chạy lại).

---

### User Story 2 - Gói sai bị từ chối sạch (Priority: P1)

Admin chọn nhầm file, hoặc gói thiếu manifest, hoặc gói vượt kích thước, hoặc hệ thống đang bắt buộc sandbox mà gói
không bật sandbox. Backoffice từ chối với lý do rõ ngay trong hộp thoại, không để lại file dở hay dòng cấu hình nào;
admin sửa gói và tải lại.

**Why this priority**: Gói tải lên là mã chạy trong máy chủ. Mọi đường từ chối phải chắc và không để lại dấu vết, nếu
không máy chủ có thể nạp một thư mục hỏng ở lần khởi động sau.

**Independent Test**: Tải lần lượt từng loại gói hỏng; mỗi lần nhận lỗi đúng, danh sách không đổi, thư mục extension
không có thư mục mới.

**Acceptance Scenarios**:

1. **Given** file không phải tar nén (ví dụ `.zip`, ảnh, text), **When** tải lên, **Then** lỗi "gói không đúng định dạng
   `.tgz` của npm pack", danh sách không đổi, không có thư mục hay dòng mới.
2. **Given** gói tar hợp lệ nhưng không có `package/package.json` hoặc `package.json` không có khóa extension hợp lệ,
   **When** tải lên, **Then** lỗi nêu thiếu/sai manifest, không có thư mục hay dòng mới.
3. **Given** gói có `name` trùng với một extension đã có ở bất kỳ nguồn nào (local, registry, module, uploaded),
   **When** tải lên, **Then** 400 `INVALID_PAYLOAD` nêu tên và nguồn của extension đang có (không mã 409, sửa khi plan
   2026-11-04); gói đang có không đổi.
4. **Given** hệ thống đặt bắt buộc sandbox và gói có phần API không bật sandbox, **When** tải lên, **Then** lỗi nêu rõ
   gói phải bật sandbox vì cấu hình bắt buộc sandbox đang bật; không có thư mục hay dòng mới. Gói chỉ app được nhận.
5. **Given** gói lớn hơn giới hạn tải lên của hệ thống, **When** tải lên, **Then** lỗi "quá kích thước" như khi tải
   file quá lớn vào thư viện file; không có thư mục hay dòng mới.
6. **Given** user không phải admin, **When** gọi tải lên (giao diện không có nút), **Then** 403, không có gì thay đổi.
7. **Given** kết nối đứt giữa chừng khi tải lên, **When** máy chủ phát hiện, **Then** phần tạm bị xóa, không có dòng mới.

---

### User Story 3 - Gỡ gói đã tải lên (Priority: P2)

Admin gỡ gói tải lên từ menu của dòng extension như gỡ gói registry. File và mọi dòng cấu hình của gói (kể cả entry của
bundle) biến mất trên mọi replica; muốn cài bản mới admin tải lên lại (không có nâng cấp tại chỗ).

**Why this priority**: Không có gỡ thì trùng tên (US2 kịch bản 3) không bao giờ tháo được và gói lỗi ở lại mãi.

**Independent Test**: Tải gói fixture lên, gỡ, gọi endpoint của gói nhận 404, danh sách không còn dòng, thư mục đã xóa.

**Acceptance Scenarios**:

1. **Given** gói tải lên trong danh sách, **When** admin chọn Uninstall và xác nhận, **Then** dòng (và entry của bundle)
   biến mất, endpoint của gói trả 404, thư mục của gói không còn.
2. **Given** gói tải lên, **When** xem menu của dòng, **Then** có Uninstall, không có Reinstall, không có liên kết
   Marketplace.
3. **Given** gói tải lên, **When** gọi thao tác Reinstall trực tiếp qua API, **Then** 400 nêu gói tải lên không cài lại
   được, gói không đổi.
4. **Given** gói đã gỡ, **When** tải lại cùng gói, **Then** cài thành công như lần đầu (không còn trùng tên).

---

### User Story 4 - Nhiều replica cùng thấy gói (Priority: P2)

Hệ thống chạy nhiều replica Backoffice sau một bộ cân bằng tải và có kho extension dùng chung. Admin tải gói lên qua bộ
cân bằng tải (một replica bất kỳ nhận); mọi replica nạp gói và trả lời endpoint của nó.

**Why this priority**: Môi trường triển khai chuẩn của dự án là 3 replica (019); gói chỉ có ở một replica thì endpoint
lúc trả lời lúc 404.

**Independent Test**: Bộ kiểm thử triển khai 3 replica tải gói fixture lên qua lb rồi gọi endpoint của gói tới khi cả
ba replica đã trả lời; gỡ rồi gọi tới khi cả ba trả 404.

**Acceptance Scenarios**:

1. **Given** 3 replica với kho extension dùng chung, **When** admin tải gói lên qua lb, **Then** trong vòng vài giây cả
   ba replica trả lời endpoint của gói.
2. **Given** gói đã cài trên 3 replica, **When** gỡ qua lb, **Then** cả ba replica ngừng trả lời endpoint đó.
3. **Given** một replica khởi động lại sau khi gói đã cài, **When** nó lên, **Then** nó nạp gói từ kho dùng chung và
   trả lời endpoint.
4. **Given** không có kho extension dùng chung, **When** tải lên, **Then** chỉ replica nhận tải lên có gói (ghi
   Assumptions, giống gói registry hiện nay).

---

### User Story 5 - Chạy song song với Directus 11.17.4 (Priority: P2)

Backoffice và Directus dùng chung DB (và có thể cùng kho extension). Sau khi admin tải gói lên ở Backoffice, Directus
khởi động và chạy bình thường, không nạp gói đó, không tự tạo thêm cấu hình cho nó, và mọi yêu cầu khác về extension ở
hai app vẫn giống nhau.

**Why this priority**: Nguyên tắc I/III của dự án; một dòng cấu hình lạ không được làm Directus hỏng hay tự chạy mã mà
nó không cài.

**Independent Test**: Suite đối chiếu trên profile `extensions`: sau khi Backoffice tải gói lên, Directus khởi động lại,
đọc danh sách extension, log không có lỗi, không có dòng mới; gỡ ở Backoffice, hai app lại trả danh sách giống nhau.

**Acceptance Scenarios**:

1. **Given** dòng cấu hình của gói tải lên trong DB chung, **When** Directus khởi động, **Then** Directus không nạp gói
   (endpoint 404 ở Directus), không ghi thêm dòng, log không có lỗi.
2. **Given** cùng dòng, **When** Directus liệt kê extension, **Then** gói hiện là mục "Missing" (không có schema) ở app
   Directus; không bật/tắt hay gỡ được từ đó (D-212.1).
3. **Given** endpoint tải lên, **When** gọi ở Directus, **Then** 404 (D-212).
4. **Given** gói đã gỡ ở Backoffice, **When** so danh sách extension của hai app, **Then** giống nhau như trước feature.

---

### Edge Cases

- Gói `.tgz` hợp lệ nhưng thư mục trong tar không tên `package/` (không phải `npm pack`): từ chối như thiếu manifest,
  thông điệp nêu cấu trúc yêu cầu.
- Gói chứa đường dẫn thoát khỏi thư mục (`../`, đường dẫn tuyệt đối, symlink ra ngoài): giải nén phải bỏ hoặc từ chối;
  không bao giờ ghi ra ngoài thư mục đích (yêu cầu an toàn, FR-005).
- `name` trong `package.json` khác tên file: tên hiển thị và kiểm trùng lấy theo `package.json`; tên file không dùng.
- Gói khai báo `host` không khớp phiên bản Backoffice: không kiểm lúc tải lên (như registry và local hôm nay, hai app
  không kiểm `host` khi cài hay nạp); nạp như mọi gói, ghi một dòng log cảnh báo nêu `host` yêu cầu và phiên bản hiện
  tại (clarify 2026-11-04).
- Gói cùng `name` nhưng khác phiên bản: vẫn 400 trùng tên (không nâng cấp tại chỗ); admin gỡ rồi tải lên.
- Hai admin tải hai gói cùng `name` cùng lúc trên hai replica: đúng một thành công, request kia 400 trùng tên.
- Tải lên trong lúc một replica đang nạp lại extension: cùng khóa dùng chung với việc tạo dòng khi nạp
  (`extensions-settings`, sửa khi plan 2026-11-04) nên tuần tự; không bao giờ kết thúc với thư mục có mà không có dòng
  hay ngược lại.
- Gói là bundle có phần app: app bundle dùng chung được dựng lại sau tải lên và sau gỡ, như bundle từ registry.
- Gói có phần app nhưng app Backoffice đang mở ở tab khác: tab đó thấy phần app sau khi tải lại trang (như registry).
- Số extension đã đạt `EXTENSIONS_LIMIT`: tải lên bị từ chối như cài từ registry (`LIMIT_EXCEEDED`, bundle tính theo số
  entry; sửa khi plan 2026-11-04).
- Tắt rồi gỡ: gỡ gói đang tắt vẫn xóa file và dòng.
- Thư mục `.upload/<id>` còn trên đĩa nhưng dòng đã mất (DB khôi phục từ bản sao lưu cũ): khi khởi động Backoffice tạo
  lại dòng cho thư mục đó như cách nó xử lý thư mục local/registry không có dòng (bật, nguồn Uploaded), không gọi
  Marketplace; ghi Assumptions.
- Dòng còn mà thư mục mất (kho dùng chung bị dọn): dòng hiện "Missing" ở cả hai app; admin gỡ dòng từ menu.
- Gói tải lên khi `EXTENSIONS_PATH` không ghi được: lỗi 500 nêu rõ, không có dòng.
- Tải lên ở replica có kho dùng chung nhưng chép lên kho thất bại giữa chừng: dọn phần đã chép, không có dòng, lỗi 500.
- Directus có cùng kho extension dùng chung: thư mục `.upload` là thư mục ẩn, Directus không quét (đọc mã nguồn
  2026-11-04, đo ở plan); nếu một phiên bản Directus sau này quét nó thì D-212.1 phải xem lại (Assumptions).
- Hai route mới không vào response cache dùng chung (sửa khi checklist 2026-11-04). `GET /extensions`, `GET
  /extensions/:pk` và tài liệu GraphQL system có `extensions` dùng chung khóa cache với Directus: khi node Backoffice đã
  nạp một gói `upload`, các đọc đó bỏ qua cache dùng chung (không đọc, không ghi), nếu không Backoffice trả lại body
  `schema: null` Directus đã ghi và web hiện gói là Missing (phát hiện khi chạy parity, implement 2026-11-04; cùng cơ chế
  với D-188.4, D-207.5). Không có gói `upload` thì cache như Directus.
- Gói nhỏ nở ra rất lớn khi giải nén (gzip bomb): không giới hạn kích thước sau giải nén, như cài từ registry; chỉ admin
  tải được; đĩa của thư mục tạm là giới hạn; deploy/README ghi (FR-026; sửa khi checklist 2026-11-04).
- Chép lên kho: `package.json` được chép **cuối cùng**, sau mọi file khác, nên một replica sync dở hay lần khởi động chỉ
  thấy gói khi đủ file (thư mục không có `package.json` bị bỏ qua khi quét); process chết giữa chừng để lại thư mục
  thiếu `package.json` trên kho, không dòng, không nạp (sửa khi checklist 2026-11-04).
- Gỡ ngay sau khi tải lên trong lúc một replica khác còn đang sync thư mục đó: [Unverified] sync của Backoffice bỏ qua
  file đã mất (bài học 020: Directus thoát trên NoSuchKey); kiểm ở T001; parity và E2E đợi mọi node nạp xong trước khi
  gỡ như 020 (sửa khi checklist 2026-11-04).

## Requirements *(mandatory)*

### Functional Requirements

**Nhận và kiểm gói**

- **FR-001**: Backoffice PHẢI có một thao tác tải gói extension lên dành riêng cho admin (`admin_access`), nhận đúng một
  file multipart; user khác 403; Directus trả 404 cho cùng đường dẫn (D-212). Chỉ REST: không mutation/query GraphQL,
  không đường dẫn trong `/server/specs/oas`; `/server/info` không đổi (sửa khi checklist 2026-11-04).
- **FR-002**: Chỉ nhận gói tar nén gzip (`.tgz`, `.tar.gz`) có cấu trúc của `npm pack`: thư mục `package/` chứa
  `package.json` với khóa extension hợp lệ theo manifest hiện có (tên, phiên bản, kiểu, đường dẫn entry, `host`, khai
  báo sandbox nếu có). Mọi gói khác (kể cả `.zip`) → 400 `INVALID_PAYLOAD` với thông điệp nêu lý do (định dạng, thiếu
  manifest, manifest sai). `host` không khớp không phải lý do từ chối (clarify 2026-11-04, xem Edge Cases). Mọi kiểm
  tra (định dạng, manifest, sandbox, giới hạn số gói, trùng tên) xong trước khi gói được chép ra khỏi thư mục tạm (sửa
  khi checklist 2026-11-04).
- **FR-003**: Kích thước tối đa theo giới hạn tải file hiện có của hệ thống (`FILES_MAX_UPLOAD_SIZE`); vượt → cùng lỗi
  413 như thư viện file; biến không đặt = không giới hạn, như `/files` (clarify 2026-11-04). Không thêm biến môi trường.
- **FR-004**: Trùng `name` (từ `package.json`) với một extension cấp cao đã có ở bất kỳ nguồn nào (không so với entry
  của bundle; sửa khi checklist 2026-11-04) → 400 `INVALID_PAYLOAD` nêu
  tên và nguồn hiện có (không mã 409, sửa khi plan 2026-11-04); không ghi đè, không nâng cấp tại chỗ. `EXTENSIONS_LIMIT`
  áp như cài từ registry.
- **FR-005**: Giải nén PHẢI an toàn: bỏ hoặc từ chối mọi mục có đường dẫn thoát khỏi thư mục đích; thư mục đích là một
  định danh do máy chủ sinh (uuid v4), không lấy từ tên file hay `package.json`.
- **FR-006**: Luật sandbox như gói registry: gói khai báo sandbox chạy trong sandbox với scope đã khai báo; khi cấu hình
  bắt buộc sandbox (`MARKETPLACE_TRUST=sandbox`) gói **có phần API** (hook, endpoint, operation, bundle có entry api)
  không bật sandbox → 400 nêu rõ biến; gói chỉ app (interface, display, layout, module, panel, theme) không có khái niệm
  sandbox và được nhận (sửa khi checklist 2026-11-04). Backoffice tự kiểm manifest (với registry việc này do registry
  làm).
- **FR-007**: Mọi đường từ chối (FR-002..FR-006, lỗi chép, kết nối đứt, lỗi tạo dòng sau khi file đã ở đích) PHẢI không
  để lại file ngoài thư mục tạm đã dọn (gói đã chép lên kho/local bị xóa lại) và không để lại dòng cấu hình (sửa khi
  checklist 2026-11-04).

**Lưu và nạp**

- **FR-008**: Gói hợp lệ được lưu ở `EXTENSIONS_PATH/.upload/<id>` (thư mục ẩn, tách khỏi `.registry` và thư mục local)
  và, khi có kho dùng chung (`EXTENSIONS_LOCATION`), chép lên kho như gói registry; mọi replica nạp qua kênh nạp lại
  hiện có (chỉ thư mục của gói, như cài từ registry).
- **FR-009**: Dòng `directus_extensions` của gói có `source` mới `upload` (Directus chỉ có `local`, `registry`,
  `module`), `folder` = `<id>`, `enabled` = true; bundle ghi thêm dòng entry với cùng `source` và `bundle` = id cha như
  gói registry. Tạo dòng là bước cuối, sau khi file đã ở đích.
- **FR-010**: Thao tác trả về dòng vừa tạo với schema (id, tên, phiên bản, kiểu) để giao diện hiện ngay; danh sách
  extension của Backoffice trả gói với schema đầy đủ như gói registry (D-212.2). Một thao tác đọc cạnh đó trả giới hạn
  kích thước hiện hành (null khi không đặt) và là cách web biết API là Backoffice (FR-019; sửa khi plan 2026-11-04).
- **FR-011**: Khi khởi động hoặc nạp lại, Backoffice đọc `.upload` như `.registry`: thư mục có dòng → nạp theo
  `enabled`; thư mục không có dòng → tạo dòng (bật, nguồn `upload`, không gọi Marketplace); dòng không có thư mục →
  giữ dòng, hiện "Missing" (như local/registry hiện nay).
- **FR-012**: Bật/tắt gói tải lên và entry của bundle hoạt động như gói registry (cùng thao tác, cùng kênh nạp lại).
- **FR-013**: Hai tải lên đồng thời trên hai replica với cùng `name`: đúng một thành công, request kia 400 trùng tên;
  không bao giờ có hai dòng cùng `name` nguồn `upload` (khóa dùng chung có sẵn của việc tạo dòng extension, kiểm trùng
  lần hai trong khóa; sửa khi plan 2026-11-04).

**Gỡ**

- **FR-014**: Gỡ (thao tác uninstall hiện có) chấp nhận nguồn `upload` (D-212.3): xóa thư mục ở `EXTENSIONS_PATH` và
  kho dùng chung, xóa dòng và entry của bundle, báo mọi replica nạp lại; sau đó endpoint của gói 404 ở mọi replica.
- **FR-015**: Cài lại (reinstall) với nguồn `upload` → 400 nêu gói tải lên không cài lại được; gói không đổi.
- **FR-016**: Gỡ dòng "Missing" nguồn `upload` (thư mục đã mất) chỉ xóa dòng, không lỗi (thao tác "Remove" có sẵn của
  dòng Missing, không qua uninstall; sửa khi plan 2026-11-04).

**Giao diện**

- **FR-017**: Settings > Extensions có nút "Upload" ở vùng thao tác của page header (trang hiện chưa có nút nào khác ở
  đó; sửa khi analyze 2026-11-04) mở hộp thoại chọn đúng một
  file `.tgz`/`.tar.gz` (chọn hoặc kéo thả), nút xác nhận chỉ bật khi đã chọn file, trạng thái đang tải (không bấm hai
  lần), lỗi của API hiện trong hộp thoại với thông điệp của API, thành công thì đóng hộp thoại, tải lại danh sách và
  thông báo thành công.
- **FR-018**: Dòng extension nguồn `upload` hiện chip nguồn "Uploaded" (en-US) / "Đã tải lên" (vi-VN); menu dòng có
  Uninstall (với xác nhận như registry), không có Reinstall, không có liên kết Marketplace; entry của bundle tải lên hiện
  lồng dưới dòng cha như bundle registry.
- **FR-019**: Nút Upload ẩn khi API là Directus (cấu hình `proxy-directus`): thao tác đọc giới hạn của FR-010 trả 404 ở
  Directus (probe như 029, 030).
- **FR-020**: Hộp thoại và nút làm được bằng bàn phím, nhãn và lỗi gắn với control, không vi phạm axe mức serious; chuỗi
  en-US và vi-VN ở overlay như 012.
- **FR-021**: Marketplace không đổi; install, reinstall và các route duyệt registry không đổi; trong nhóm
  `/extensions/registry/*` chỉ uninstall nhận thêm nguồn `upload` (D-212.3), hành vi với dòng `registry` giữ nguyên (sửa
  khi checklist 2026-11-04).

**Kiểm thử và tài liệu**

- **FR-022**: Suite đối chiếu `extensions/upload` trên profile `extensions`: thao tác tải lên 404 ở Directus (D-212);
  tải gói fixture `.tgz` có sẵn của `tests/fixtures/extensions` (đã commit, fake registry phục vụ chúng; thêm fixture
  `parity-upload-endpoint` với `name` riêng vì các fixture hiện có đã nạp từ kho dưới nguồn local; sửa khi plan
  2026-11-04); endpoint của gói trả lời ở Backoffice; danh sách extension hai app khác đúng như
  D-212.1/D-212.2 khi gói còn; gỡ sạch file và dòng rồi hai app lại giống nhau; gói hỏng, trùng tên, không sandbox khi
  bắt buộc sandbox, user thường: bị từ chối không để lại gì; mọi request `/extensions` khác giống Directus như trước.
- **FR-023**: Plan có một bước đo thật trước khi duyệt D-212.1: Directus cùng DB (và cùng kho dùng chung) khởi động sau
  khi Backoffice tải gói lên: danh sách extension, log, số dòng `directus_extensions` không đổi, endpoint của gói 404 ở
  Directus.
- **FR-024**: E2E `settings-extensions-upload` ở ba cấu hình: `proxy-directus` nút ẩn; `proxy-api`, `cors` tải gói
  fixture lên, thấy dòng với chip nguồn, gỡ, dòng biến mất; a11y axe như 016.
- **FR-025**: Bộ kiểm thử triển khai 3 replica có một ca: tải gói fixture lên qua lb, gọi endpoint của gói tới khi cả ba
  replica trả lời (US4), gỡ rồi gọi tới khi cả ba 404.
- **FR-026**: deploy/README (phần extensions) ghi: gói tải lên là mã chạy trong tiến trình API khi không sandbox, chỉ
  admin tin cậy mới được tải; đặt `MARKETPLACE_TRUST=sandbox` để bắt buộc sandbox cho cả registry và tải lên; đặt
  `FILES_MAX_UPLOAD_SIZE` vì không đặt là không giới hạn (clarify 2026-11-04); gỡ tay
  (xóa thư mục `.upload/<id>` và dòng); thư mục `.upload` cần nằm trong kho dùng chung như `.registry`.
- **FR-101**: Bảng "Khác biệt so với Directus" có cột `Mã` đầu, `Gỡ ở` cuối để `tests/parity/src/spec-differences.ts`
  đọc; D-212, D-212.1, D-212.3 là entry `doc` (thao tác và nguồn chỉ Backoffice, test từng app), D-212.2 entry `http`
  (danh sách extension của hai app khác khi một gói tải lên còn; suite gỡ ở cuối để các suite khác không thấy).

### Key Entities

- **Gói tải lên**: một tar nén gzip theo cấu trúc `npm pack` với manifest extension; thuộc tính đọc từ manifest: tên
  (duy nhất giữa mọi extension đã cài), phiên bản, kiểu (app, API, hybrid, bundle), `host`, khai báo sandbox.
- **Extension đã cài** (`directus_extensions`, có sẵn): dòng cấu hình với id, `enabled`, `source` (có thêm `upload`),
  `folder` (với `upload` là định danh do máy chủ sinh), `bundle`; entry của bundle là dòng con. Thư mục của gói ở
  `EXTENSIONS_PATH/.upload/<folder>` và trong kho dùng chung.
- **Nguồn extension**: local (thư mục chép tay), registry (Marketplace), module (dependency của máy chủ), upload (mới):
  quyết định menu (Uninstall, Reinstall), cách nạp và cách Directus xử lý dòng.

### Đánh giá hiện trạng và chạy song song với Directus 11.17.4

Đọc code ngày 2026-11-04, chưa chạy thử. Mục ghi [Inference] là suy ra từ code, plan PHẢI có test xác nhận (FR-023).

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Cài từ registry hiện nay | Nhận `extension`, `version`; tải tarball từ registry, ghi vào thư mục tạm, giải nén `package/`, kiểm manifest, chép lên `EXTENSIONS_LOCATION` hoặc thư mục local `.registry/<version>`; dòng `source: 'registry'`; phần sau khi có stream không phụ thuộc registry | `apps/api/src/controllers/extensions.controller.ts:162`, `apps/api/src/extensions/lib/installation/manager.ts:39`–`:90`, `apps/api/src/services/extensions.service.ts:89`–`:96` |
| 2 | Nguồn extension và menu | `getExtension(source, folder)` chỉ biết `module`/`registry`/`local`, source khác → `undefined` → `schema: null`; menu web khóa Uninstall khi `source !== 'registry'` | `apps/api/src/extensions/manager.ts:181`, `apps/api/src/services/extensions.service.ts:171`, `apps/web/src/modules/settings/routes/extensions/components/ExtensionItemOptions.vue:25` |
| 3 | Quét thư mục | Hai app bỏ thư mục bắt đầu bằng `.` khi quét local và quét riêng `.registry`; `.upload` phải đọc tường minh ở Backoffice | `libs/utils/src/node/list-folders.ts:19`, `apps/api/src/extensions/lib/get-extensions.ts:11`, `directus/api/src/extensions/lib/get-extensions.ts:11` |
| 4 | Directus với thư mục lạ trong `.registry` | Thư mục `.registry/<x>` không có dòng `registry` → Directus gọi Marketplace `list({ search: name })`, tạo dòng `source: 'registry'`, `enabled: true` và chạy gói [Inference]; vì vậy gói tải lên không được nằm trong `.registry` | `directus/api/src/extensions/lib/get-extensions-settings.ts:78`–`:86`, `:160`–`:168` |
| 5 | Directus với dòng `source` lạ | Chỉ lọc ba nguồn, chỉ xóa dòng entry của bundle đã mất → dòng giữ nguyên; `GET /extensions` trả `schema: null`; app Directus xếp vào nhóm "Missing" (chip cảnh báo, Uninstall khóa, không Reinstall); không nạp vì chỉ duyệt ba map [Verified 2026-11-04: `extensions/upload-restart.test.ts`, Directus khởi động lại cạnh gói tải lên: dòng giữ nguyên, không dòng mới, log không nhắc gói, endpoint 404, `schema: null`] | `get-extensions-settings.ts:35`–`:37`, `:47`–`:53`; `directus/api/src/services/extensions.ts:161`; `directus/app/src/modules/settings/routes/extensions/components/ExtensionItem.vue:36`, `extension-item-options.vue:25`; `directus/api/src/extensions/manager.ts:677` |
| 6 | Entry của bundle `upload` ở Directus | `readAll` bỏ entry khi bundle cha `schema: null` → chỉ dòng cha hiện Missing [Verified 2026-11-04: `extensions/upload.test.ts`, bundle `parity-upload-bundle`] | `directus/api/src/services/extensions.ts:166`–`:173` |
| 7 | Sandbox bắt buộc | `MARKETPLACE_TRUST=sandbox` chỉ đổi URL tải của registry; Backoffice không kiểm manifest | `apps/api/src/extensions/registry/modules/download/download.ts:70`, `installation/manager.ts:40` |
| 8 | Nạp lại nhiều replica | `install`/`uninstall` báo bus với `partialSync: '.registry/<folder>'` rồi `reload`; sync từ kho dùng chung theo `partialSync` | `apps/api/src/extensions/manager.ts:255`–`:280`, `lib/sync/sync.ts:58` |
| 9 | Multipart có giới hạn | `/files` dùng Busboy với `limits.fileSize` từ `FILES_MAX_UPLOAD_SIZE` | `apps/api/src/controllers/files.controller.ts:42`–`:46` |
| 10 | Fixture | Fixtures dựng bằng extensions-sdk khi build; có endpoint, endpoint sandbox, bundle; fake registry có `/download` | `tests/fixtures/extensions/fixtures-build.test.ts`, `parity-endpoint-demo`, `parity-endpoint-sandbox`, `parity-bundle-tools` |
| 11 | Ẩn nút khi API là Directus | Probe 404 như passkey và card Indexes | `apps/web/src/composables/use-passkey-support.ts` |
| 12 | Bộ đối chiếu đọc mã D | Cột `Mã` đầu, `Gỡ ở` cuối; D-211 đã dùng ở spec 012 (2026-11-04) | `tests/parity/src/spec-differences.ts:29`–`:36` |

**Kết luận** (dòng 5–6 đã đo 2026-11-04 bằng parity; dòng 4 vẫn là đọc mã nguồn): Directus không phải làm gì; Redis, cấu hình Directus không đổi; DB chỉ có thêm dòng
`directus_extensions` với `source: 'upload'` mà Directus giữ nguyên và hiện "Missing"; kho dùng chung có thêm thư mục ẩn
`.upload` mà Directus không quét. FR-023 đo thật trước khi duyệt.

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021–030).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-212 | Thao tác tải gói extension lên dưới `/backoffice/` (D-189.6), admin only | 404 | Có; nhận một file `.tgz` của `npm pack`; bộ đối chiếu: entry `doc`, test từng app (Directus 404) | Yêu cầu chủ dự án 2026-11-04: cài gói nội bộ không qua Marketplace | khác (duyệt 2026-11-04) | — |
| D-212.1 | Dòng `directus_extensions` với `source: 'upload'` ở Directus cùng DB | Không có giá trị này; với dòng lạ: giữ dòng, `GET /extensions` trả `schema: null`, app xếp vào "Missing", không nạp, không gỡ được từ Directus (đọc mã nguồn 2026-11-04, FR-023 đo thật) | Nguồn `upload` được nạp, bật/tắt, gỡ; entry `doc` | Directus không có nguồn tương ứng; dùng `.registry` sẽ làm Directus tự tạo dòng và chạy gói | khác (duyệt 2026-11-04) | — |
| D-212.2 | `GET /extensions`, `GET /extensions/:pk`, GraphQL `extensions` khi một gói tải lên còn; app bundle `GET /extensions/sources/:chunk` | Dòng với `schema: null`; bundle không có phần app của gói | Dòng với schema đầy đủ như gói registry; bundle gồm phần app của gói; entry `http`; suite gỡ gói ở cuối (sửa khi checklist 2026-11-04); khi node đã nạp một gói `upload`, các đọc này không đọc không ghi response cache dùng chung với Directus (cùng khóa ở hai app; implement 2026-11-04) | Hệ quả của D-212.1 | khác (duyệt 2026-11-04) | — |
| D-212.3 | Gỡ extension (`DELETE /extensions/registry/uninstall/:pk`) với nguồn `upload`; cài lại | Gỡ chỉ nhận `registry` (lỗi với nguồn khác) | Gỡ nhận `registry` và `upload`; cài lại với `upload` → 400; entry `doc` | Gói tải lên phải gỡ được từ giao diện | khác (duyệt 2026-11-04) | — |

**Cần xác nhận** (chủ dự án kiêm tech lead và design owner, cùng lượt duyệt D-212):

- Nút Upload đặt ở đầu trang Settings > Extensions cạnh các thao tác hiện có; hộp thoại ghép từ BoDialog và thành phần
  chọn file của thư viện file (015); chip nguồn dùng kiểu chip hiện có của dòng extension; không component mới.
- Nhãn chip "Uploaded" / "Đã tải lên" và thông điệp lỗi en-US/vi-VN (design owner).

## Clarifications

### Session 2026-11-04 (chủ dự án, `/speckit.clarify`)

- Q: Gói có `host` không khớp phiên bản Backoffice: từ chối lúc tải lên, hay nạp như hôm nay? → A: B, không kiểm lúc tải
  lên (như registry và local); nạp như mọi gói, một dòng log cảnh báo khi `host` không khớp.
- Q: Cài từ registry hay chép thư mục local một gói cùng `name` với gói đã tải lên có bị chặn không? → A: A, chỉ chặn
  ở đường tải lên (FR-004); registry và local như hôm nay (không kiểm tên), ghi Assumptions.
- Q: `FILES_MAX_UPLOAD_SIZE` không đặt thì giới hạn tải gói là gì? → A: A, không đặt = không giới hạn như `/files`;
  deploy/README khuyên đặt biến khi mở tải lên.

### Sửa câu chữ khi `/speckit.plan` (2026-11-04, research R1–R9)

- 409 trùng tên → 400 `INVALID_PAYLOAD` (không mã 409 trong bộ lỗi, như 030): FR-004, FR-013, US2 kịch bản 3, Edge Cases.
- FR-022: fixture `.tgz` đã commit (fake registry phục vụ), thêm fixture `parity-upload-endpoint` có `name` riêng.
- FR-004: `EXTENSIONS_LIMIT` áp cho tải lên; FR-010/FR-019: thao tác đọc giới hạn kích thước là probe; FR-013: khóa
  `extensions-settings` có sẵn; FR-016: "Remove" có sẵn của dòng Missing; edge case nạp lại: cùng khóa.

### Sửa khi `/speckit.checklist` (2026-11-04, api-compat 13, security 13, data-safety 11 mục; 14 phát hiện)

- FR-001 chỉ REST, không GraphQL/OAS; FR-002 kiểm xong mới chép; FR-004 so extension cấp cao; FR-006 chỉ gói có phần API
  phải sandbox; FR-007 thêm lỗi tạo dòng; FR-021 uninstall là ngoại lệ (D-212.3); D-212.2 thêm `/extensions/:pk` và app
  bundle; Edge Cases: response cache, gzip bomb, `package.json` chép cuối, gỡ trong lúc replica khác sync; Assumptions:
  rate limiter/CORS, thư mục mồ côi trùng tên, rác `TEMP_PATH`; data-model: Directus sync chép `.upload` vô hại;
  contracts/web.md: chuỗi từ gói là text.

### Duyệt 2026-11-04 (chủ dự án kiêm tech lead và design owner, sau `/speckit.analyze`)

- D-212, D-212.1, D-212.2, D-212.3 duyệt; điểm Complexity Tracking của plan (kiểu `source` của `libs/types` và
  `generateExtensionsEntrypoint` nhận `upload`) duyệt; 7 sửa câu chữ của plan, 14 của checklist và các sửa của analyze
  duyệt. Mục "Cần xác nhận" (vị trí nút Upload ở page header, chữ chip "Uploaded"/"Đã tải lên") chốt theo đề xuất.

### Sửa khi `/speckit.analyze` (2026-11-04: 0 CRITICAL, 1 HIGH, 4 MEDIUM, 7 LOW)

- C1 (HIGH): thêm fixture `parity-upload-bundle` (chỉ app: interface + display; implement 2026-11-04: bundle không có
  tùy chọn sandbox nên bundle có entry API bị FR-006 từ chối dưới `MARKETPLACE_TRUST=sandbox`) để parity kiểm dòng entry, app bundle
  (D-212.2) và gỡ bundle; T002/T007/T013/T015/T026. C2: parity đua hai replica (FR-013). C3: parity bật/tắt dòng `upload`
  ở hai app (FR-012). I1/U1: cảnh báo `host` cho mọi gói tải lên, so major bằng chuỗi (không có `semver`). I2: plan IV
  "không dọn riêng". U3: unit `EACCES`/stream đứt. A2: FR-017 "vùng thao tác của page header". T1: gộp T012 vào T010.

## Assumptions

- Chỉ `.tgz`/`.tar.gz` của `npm pack`; `.zip` ngoài phạm vi (cần thư viện mới). Gói build bằng extensions-sdk rồi
  `npm pack` là cách đóng gói chuẩn của hệ sinh thái Directus, nên không cần hỗ trợ thêm.
- Không nâng cấp tại chỗ: đổi phiên bản = gỡ rồi tải lên (cấu hình bật/tắt của gói mất, như gỡ gói registry).
- Trùng `name` chỉ chặn ở đường tải lên (FR-004). Cài từ registry hay chép thư mục local một gói cùng `name` với gói
  đã tải lên không bị chặn (hai app không kiểm tên ở hai đường đó, đối chiếu giữ nguyên); khi đó cả hai được nạp và với
  phần app gói nạp sau thắng, như Directus hôm nay với hai thư mục local cùng tên (clarify 2026-11-04).
- Không có kho dùng chung (`EXTENSIONS_LOCATION`): chỉ replica nhận tải lên có gói, như gói registry hiện nay; deploy
  mặc định của dự án có kho dùng chung.
- Thư mục `.upload/<id>` không có dòng (DB khôi phục cũ) được tạo lại dòng khi khởi động, bật, không gọi Marketplace.
- Directus các phiên bản sau 11.17.4 có thể đổi cách xử lý dòng `source` lạ hay quét thư mục ẩn; D-212.1 kiểm lại khi
  nâng Directus.
- Gói tải lên không sandbox là mã tùy ý chạy trong tiến trình API với quyền của tiến trình; đây là cùng mức tin cậy với
  chép thư mục tay vào `EXTENSIONS_PATH` và với gói registry khi không bắt buộc sandbox; không ký, không quét mã; chỉ
  admin tải được; deploy/README ghi (FR-026).
- Hoạt động tải lên và gỡ ghi activity trên `directus_extensions` như cài từ registry hiện nay, không thêm.
- Phần app của gói tải lên được phục vụ bởi Backoffice như phần app của gói registry (020); app Directus không nạp
  phần app của gói tải lên (nó không thấy schema).
- Không giới hạn số gói tải lên; mỗi gói chịu giới hạn `FILES_MAX_UPLOAD_SIZE` (không đặt = không giới hạn).
- Thư mục tạm khi giải nén là thư mục tạm hiện có của luồng cài từ registry; lỗi giữa chừng dọn như luồng đó; process
  chết giữa chừng để lại rác trong `TEMP_PATH` (thư mục tạm của container, như `marketplace/<versionId>` của registry),
  không dọn riêng (checklist 2026-11-04).
- Route mới đi qua rate limiter, CORS và cookie session như `/files`; không ngoại lệ (checklist 2026-11-04).
- Thư mục `.upload/<id>` mồ côi được tạo lại dòng bật khi khởi động (FR-011) dù `name` trùng một extension khác; khi đó
  hai gói cùng nạp như hai thư mục local cùng tên ở Directus (cùng câu với clarify Q2; checklist 2026-11-04).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin tải một gói hợp lệ lên từ Settings > Extensions trong dưới 1 phút bằng chuột và bằng bàn phím; gói
  hiện trong danh sách và endpoint của nó trả lời ngay sau khi hộp thoại đóng trong 100% lần thử ở E2E `proxy-api` và
  `cors`; nút ẩn ở `proxy-directus`.
- **SC-002**: 100% gói hỏng (sai định dạng, thiếu/sai manifest, trùng tên, không sandbox khi bắt buộc, quá kích thước,
  user thường) bị từ chối với thông điệp nêu lý do và không để lại thư mục hay dòng nào.
- **SC-003**: Gỡ gói tải lên xóa thư mục và dòng trong 100% lần thử; tải lại cùng gói sau khi gỡ thành công.
- **SC-004**: Trong bộ kiểm thử triển khai 3 replica, sau khi tải lên qua lb cả ba replica trả lời endpoint của gói
  trong dưới 10 giây; sau khi gỡ cả ba trả 404 trong dưới 10 giây.
- **SC-005**: Directus cùng DB khởi động không lỗi sau khi Backoffice tải gói lên, không tạo dòng mới, không trả lời
  endpoint của gói; sau khi gỡ, danh sách extension của hai app giống nhau (US5).
- **SC-006**: 0 test đối chiếu, blackbox và E2E hiện có đổi kết quả; cài từ registry, Marketplace, bật/tắt gói registry
  không đổi.
- **SC-007**: Hộp thoại Upload và chip nguồn không có vi phạm axe mức serious trở lên; mọi thao tác làm được bằng bàn
  phím.
