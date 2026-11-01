# Feature Specification: Đăng nhập bằng Passkey (WebAuthn) cho user local

**Feature Branch**: `029-passkey-login` (làm trên `main` như 012–028, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=029-passkey-login`)
**Created**: 2026-11-01
**Status**: Draft (spec và clarify 2026-11-01, 4 câu; plan 2026-11-01: research R1–R13; checklist security và api-compat
2026-11-01, phát hiện đã sửa; D-207..D-207.5, dependency, replica passkey và phương án E duyệt 2026-11-01; tasks 53 task;
analyze 2026-11-01, HIGH và MEDIUM đã sửa)
**Input**: User description: "Feature 029: đăng nhập app Backoffice bằng passkey (WebAuthn, FIDO2) cho user local. Bối
cảnh: Directus 11.17.4 và Backoffice chỉ có đăng nhập mật khẩu (+ OTP), LDAP, OAuth2, OpenID; Directus không có passkey,
nên đây là tính năng chỉ của Backoffice (như 022, 025, 027), Directus app vẫn đăng nhập bằng mật khẩu. Mục tiêu: user
đăng ký một hoặc nhiều passkey trên trang user của chính mình, rồi trên trang login bấm "Đăng nhập bằng Passkey" [...]
không cần gõ email, mật khẩu hay OTP; session tạo ra giống hệt login local [...]. Phạm vi đã chốt (chủ dự án
2026-11-01): 1. Passkey thay cả mật khẩu lẫn OTP [...]. 2. Chỉ user provider = default và status = active [...]. 3.
Đăng nhập passkey thất bại đếm vào auth_login_attempts [...]. 4. Quản lý passkey trên trang user của mình; admin xóa
được passkey của user khác [...]. 5. Không đăng ký passkey từ login, invite, setup, reset mật khẩu. 6. Xóa user thì
passkey bị xóa [...]. Dữ liệu: bảng hệ thống mới backoffice_passkeys qua migration riêng [...]. Khác biệt với Directus
ghi từ D-207 [...]" (bản đầy đủ: lệnh `/speckit.specify` của 029 trong `SPECKIT-GUIDE.md` mục 6)

**Điều kiện trước `/speckit.plan`** (Governance):

- Không sửa constitution: bảng `backoffice_passkeys` đi qua migration riêng của Backoffice (Nguyên tắc II từ 3.2.0: chỉ
  bảng tiền tố `backoffice_`, chỉ `up`, mọi vendor, chạy lại được, không FK tới bảng `directus_*`); khác biệt API và
  giao diện ghi theo Nguyên tắc X (bảng "Khác biệt so với Directus", tech lead duyệt).
- Hai dependency mới cho việc tạo và xác minh dữ liệu WebAuthn (API và web): chủ dự án duyệt 2026-11-01; plan ghi tên,
  phiên bản, giấy phép và kiểm chạy được trong bundle API và trong test.
- Không biến môi trường mới: domain của passkey (RP ID) lấy từ `PUBLIC_URL` đã có.
- Khác biệt D-207..D-207.4: chủ dự án kiêm tech lead duyệt sau `/speckit.plan`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đăng nhập app Backoffice bằng passkey (Priority: P1) 🎯 MVP

Một user local (provider mặc định, đang hoạt động) đã đăng ký passkey. Trên trang login của app Backoffice, user bấm
"Đăng nhập bằng Passkey". Trình duyệt mở hộp thoại passkey của hệ thống (Touch ID, Windows Hello, khóa FIDO, iCloud
Keychain, Google Password Manager), user chọn tài khoản và xác nhận bằng sinh trắc hoặc PIN. Không gõ email, mật khẩu hay
OTP. App đưa user vào trang đích như sau khi đăng nhập bằng mật khẩu. Session tạo ra giống hệt session của đăng nhập
local: cùng cookie, cùng dòng phiên, cùng dòng activity "login", cùng sự kiện `auth.login` cho flows và extensions; làm
mới và đăng xuất như mọi session khác; Directus app dùng chung DB chấp nhận session đó như một session do nó tạo.

**Why this priority**: lý do của feature: vào app nhanh và chống phishing hơn mật khẩu + OTP; không có kịch bản này thì
phần đăng ký (US2) vô nghĩa.

**Independent Test**: seed một passkey cho user test (qua US2 hoặc fixture), mở trang login với authenticator giả lập
của trình duyệt, bấm nút, kiểm tra vào app, cookie, dòng phiên, activity, sự kiện và việc Directus app cùng DB đọc được
session.

**Acceptance Scenarios**:

1. **Given** user local active có một passkey, **When** bấm "Đăng nhập bằng Passkey" và xác nhận trên hộp thoại của
   trình duyệt, **Then** user vào app, có cookie session, một dòng phiên mới, một dòng activity `login` của user, sự
   kiện `auth.login` trạng thái `success`, `last_access` cập nhật; không trường nào của các dòng đó khác so với đăng
   nhập bằng mật khẩu, trừ dữ liệu payload của sự kiện (ghi rõ đây là passkey).
2. **Given** user có TFA đang bật (có mã bí mật OTP), **When** đăng nhập bằng passkey, **Then** vào app mà không bị hỏi
   OTP.
3. **Given** user chưa bật TFA nhưng role có policy bắt buộc TFA, **When** đăng nhập bằng passkey, **Then** vào app
   Backoffice mà không bị đưa tới màn hình bắt cài TFA, cả sau khi tải lại trang hay làm mới session, kể cả khi user tự sửa
   bộ nhớ trình duyệt hay gọi `GET /policies/me/globals` bằng cookie đó (D-207.3, D-207.5); đăng nhập
   bằng mật khẩu của user đó vẫn bị bắt cài TFA như trước; Directus app mở bằng cùng session vẫn bắt cài TFA (sửa khi
   checklist 2026-11-01).
4. **Given** user có nhiều passkey trên nhiều thiết bị, **When** đăng nhập bằng một trong số đó, **Then** vào app và
   "lần dùng cuối" của đúng passkey đó được cập nhật.
5. **Given** session do passkey tạo, **When** làm mới session, đăng xuất, hoặc mở Directus app trên cùng DB với cookie
   đó (cùng domain cookie), **Then** hành vi giống session do mật khẩu tạo.
6. **Given** trình duyệt không hỗ trợ WebAuthn, **When** mở trang login, **Then** không có nút passkey; form login như
   cũ.
7. **Given** user bấm nút rồi hủy hộp thoại của trình duyệt, **When** quay lại trang, **Then** form login vẫn nguyên,
   không thông báo lỗi.
8. **Given** passkey không hợp lệ (đã bị xóa trên app, chữ ký sai, bộ đếm lùi), **When** xác nhận trên hộp thoại,
   **Then** thông báo lỗi chung như sai mật khẩu ("Invalid user credentials"), không nói passkey tồn tại hay không.

---

### User Story 2 - Đăng ký và quản lý passkey của chính mình (Priority: P1)

User local đã đăng nhập bằng mật khẩu mở trang user của chính mình. Trong phần "Passkeys" user thấy danh sách passkey
(tên tự đặt, ngày tạo, lần dùng cuối), bấm "Thêm passkey", nhập lại mật khẩu hiện tại, trình duyệt mở hộp thoại tạo
passkey, user xác nhận, đặt tên (mặc định theo trình duyệt/hệ điều hành) và passkey xuất hiện trong danh sách. User đổi
tên hoặc xóa từng passkey. Passkey tạo ra là loại trình duyệt tự tìm được theo domain (không cần gõ email khi đăng nhập)
và luôn yêu cầu xác minh người dùng (sinh trắc hoặc PIN).

**Why this priority**: không có passkey đã đăng ký thì không đăng nhập được; cùng mức P1 với US1, làm trước US1 trong
cùng lượt.

**Independent Test**: đăng nhập bằng mật khẩu, mở trang user của mình, thêm passkey với authenticator giả lập, kiểm tra
dòng mới trong danh sách và trong bảng; đổi tên, xóa; thử với mật khẩu sai, với user LDAP/SSO, với user khác.

**Acceptance Scenarios**:

1. **Given** user local active đăng nhập bằng mật khẩu, **When** mở trang user của mình, **Then** thấy phần "Passkeys"
   (trống: thông báo chưa có passkey và nút thêm).
2. **Given** phần "Passkeys", **When** bấm thêm, nhập đúng mật khẩu, xác nhận trên hộp thoại của trình duyệt, đặt tên,
   **Then** passkey hiện trong danh sách với tên, ngày tạo, "chưa dùng"; dòng được lưu gắn với user đó.
3. **Given** nhập sai mật khẩu, **When** xác nhận, **Then** lỗi như khi bật TFA sai mật khẩu, trình duyệt không mở hộp
   thoại passkey; sai mật khẩu ở đây không đếm vào giới hạn đăng nhập (như bật TFA hiện nay).
4. **Given** user hủy hộp thoại tạo passkey của trình duyệt, **When** quay lại, **Then** không có dòng mới, không lỗi đỏ.
5. **Given** một passkey trong danh sách, **When** đổi tên, **Then** tên mới hiện ngay và được lưu; **When** xóa và xác
   nhận, **Then** dòng biến mất và passkey đó không đăng nhập được nữa (US1 kịch bản 8).
6. **Given** user đã có số passkey tối đa (10, Assumptions), **When** bấm thêm, **Then** nút bị vô hiệu kèm lý do; API từ
   chối với lỗi rõ.
7. **Given** user provider LDAP, OAuth2 hay OpenID, **When** mở trang user của mình, **Then** không có phần "Passkeys";
   gọi thẳng API đăng ký trả lỗi quyền (403).
8. **Given** user thường mở trang user của người khác, **When** xem trang, **Then** không có phần "Passkeys"; API liệt
   kê, đổi tên hay xóa passkey của người khác trả lỗi quyền (403).
9. **Given** đã đăng ký một passkey ở trình duyệt này, **When** thêm passkey lần nữa trên cùng authenticator, **Then**
   trình duyệt báo đã có (danh sách loại trừ gửi kèm), không tạo dòng trùng.

---

### User Story 3 - Admin xóa passkey của user khác (Priority: P2)

Admin mở trang user của một người khác. Phần "Passkeys" hiện danh sách passkey của người đó (chỉ đọc) và mỗi dòng có nút
xóa. Admin xóa khi user mất thiết bị hoặc rời công ty, giống admin tắt TFA của user khác hiện nay, không cần mật khẩu.
Admin không thêm hộ và không đổi tên hộ.

**Why this priority**: vận hành cần thu hồi passkey thất lạc; không chặn MVP.

**Independent Test**: admin mở trang user khác có passkey, xóa, kiểm tra dòng biến mất và đăng nhập bằng passkey đó thất
bại; non-admin không thấy phần này.

**Acceptance Scenarios**:

1. **Given** admin mở trang user khác có hai passkey, **When** xem phần "Passkeys", **Then** thấy hai dòng với tên, ngày
   tạo, lần dùng cuối và nút xóa; không có nút thêm, không đổi tên được.
2. **Given** danh sách đó, **When** admin xóa một dòng và xác nhận, **Then** dòng biến mất, hoạt động không cần mật
   khẩu, passkey đó không đăng nhập được nữa.
3. **Given** user khác là LDAP/SSO, **When** admin mở trang, **Then** không có phần "Passkeys".
4. **Given** user có passkey bị xóa ở Backoffice (xóa user), **When** xóa xong, **Then** không còn dòng passkey nào của
   user đó (D-207.2); **Given** user bị xóa ở Directus app, **When** ai đó dùng passkey cũ của user đó, **Then** lỗi
   chung như US1 kịch bản 8 và dòng mồ côi không hiện ở đâu.

---

### User Story 4 - An toàn, giới hạn và nhiều instance (Priority: P1)

Người vận hành muốn đăng nhập passkey không mở thêm đường dò tài khoản so với mật khẩu, và chạy đúng khi Backoffice có
nhiều replica.

**Why this priority**: một đường đăng nhập mới mà yếu hơn đường cũ làm hỏng cả app; là điều kiện để duyệt D-207.

**Independent Test**: test đối chiếu và test tích hợp: lặp đăng nhập passkey sai tới giới hạn, kiểm tra trạng thái
`suspended` và thời gian phản hồi; dùng lại challenge; chạy hai replica và đăng ký trên replica A, xác minh trên B.

**Acceptance Scenarios**:

1. **Given** cài đặt `auth_login_attempts` = N, **When** một user bị thử đăng nhập passkey sai N lần (chữ ký sai, bộ
   đếm lùi), **Then** user chuyển `suspended` và activity ghi như khi dò mật khẩu; thành công trước đó đặt lại bộ đếm
   như login local; dò bằng mật khẩu và bằng passkey cộng chung một bộ đếm.
2. **Given** credential không gắn với user nào, **When** xác minh, **Then** lỗi chung như sai mật khẩu, thời gian phản
   hồi bằng thời gian chờ chống dò của login local, không đếm cho ai (không có user).
3. **Given** một challenge đăng nhập hoặc đăng ký đã dùng hoặc quá 5 phút, **When** gửi lại, **Then** bị từ chối với lỗi
   chung; mỗi challenge dùng được đúng một lần.
4. **Given** hai replica Backoffice sau một bộ cân bằng tải, **When** lấy challenge ở replica này và xác minh ở replica
   kia, **Then** thành công (challenge dùng chung giữa các instance, Nguyên tắc VII).
5. **Given** bộ đếm chữ ký của passkey lùi hoặc bằng giá trị đã lưu > 0 (dấu hiệu nhân bản), **When** xác minh,
   **Then** từ chối và đếm như một lần sai; passkey giữ nguyên trong danh sách, user hoặc admin xóa tay (clarify
   2026-11-01 câu 2).
6. **Given** `PUBLIC_URL` là `https://bo.example.com`, **When** đăng ký passkey, **Then** passkey gắn với
   `bo.example.com` và chỉ request từ origin `https://bo.example.com` được xác minh; đổi `PUBLIC_URL` sang domain khác
   thì passkey cũ không đăng nhập được (ghi ở deploy/README); trang không HTTPS (trừ localhost) thì trình duyệt không
   cho tạo hay dùng passkey và nút báo rõ.
7. **Given** trang web chạy ở hostname khác API (cấu hình `cors`: trang `localhost:8181`, `PUBLIC_URL`
   `http://127.0.0.1:8163`), **When** mở trang login và trang user, **Then** không có nút passkey và không có phần
   "Passkeys"; request xác minh từ origin đó bị từ chối (clarify 2026-11-01 câu 1).
8. **Given** user `suspended`, `invited`, `draft`, `archived` có passkey, **When** đăng nhập bằng passkey, **Then** lỗi
   chung như login local của user đó.

---

### User Story 5 - Chạy song song với Directus 11.17.4 (Priority: P2)

Backoffice chạy cạnh Directus trên cùng DB. Directus không có passkey; mọi thứ của Directus phải như cũ và dữ liệu
passkey không làm Directus hỏng.

**Why this priority**: điều kiện nền của dự án (Nguyên tắc II–V), không phải giá trị người dùng trực tiếp.

**Independent Test**: bộ đối chiếu `auth/passkey` ở profile parity; dump schema ở profile `bootstrap`; E2E ở cấu hình
`proxy-directus`.

**Acceptance Scenarios**:

1. **Given** DB có bảng `backoffice_passkeys`, **When** Directus khởi động, đọc schema, mở Data Model, **Then** Directus
   thấy một bảng chưa quản lý như `backoffice_permissions`, không lỗi; `GET /collections` của hai app chỉ khác ở các bảng
   `backoffice_*` (D-207.1).
2. **Given** các endpoint passkey của Backoffice, **When** gọi cùng đường dẫn trên Directus, **Then** Directus trả 404
   (D-207); mọi request login, refresh, logout, `/users/me`, `/auth` hiện có vẫn giống Directus.
3. **Given** app web trỏ tới Directus (cấu hình `proxy-directus`), **When** mở trang login và trang user, **Then** không
   có nút passkey và không có phần "Passkeys" (API không hỗ trợ), không lỗi console.
4. **Given** `bootstrap` ở chế độ standalone trên Postgres và SQLite, **When** chạy, **Then** bảng `backoffice_passkeys`
   được tạo và ghi vào `backoffice_migrations`; chạy lại không lỗi; `start` trên DB thiếu migration này dừng với lỗi rõ
   như 022.
5. **Given** bảng `backoffice_passkeys`, **When** gọi `/items/backoffice_passkeys` hay GraphQL, **Then** 403 và không có
   type GraphQL, như `backoffice_permissions`; bảng không hiện trong Data Model của Backoffice.

---

### Edge Cases

- Nhiều user cùng một authenticator (máy dùng chung): mỗi passkey gắn một user; hộp thoại của trình duyệt cho chọn tài
  khoản; app chỉ tra credential → user, không bao giờ hỏi email.
- Cùng user đăng ký lại trên cùng authenticator: danh sách loại trừ gồm mọi credential của user, trình duyệt báo đã có
  (US2 kịch bản 9).
- Passkey đã bị xóa trên app nhưng còn trong authenticator của người dùng: đăng nhập trả lỗi chung; hướng dẫn trong
  thông báo trống của phần "Passkeys" nói user tự xóa passkey cũ trong hệ điều hành.
- User đổi mật khẩu, bật hay tắt TFA, bị admin reset mật khẩu: passkey giữ nguyên (độc lập với mật khẩu). User bị
  `suspended` rồi mở lại: passkey dùng lại được.
- User đổi provider (admin sửa `provider` từ `default` sang LDAP): passkey cũ không đăng nhập được (US4 kịch bản 7 mở
  rộng: chỉ `default`), danh sách ẩn; dòng giữ nguyên cho tới khi xóa user.
- Xóa user ở Backoffice qua REST, GraphQL hay trang Users: passkey xóa theo (D-207.2); xóa hàng loạt cũng vậy.
- Đổi `PUBLIC_URL` (đổi domain): mọi passkey cũ vô dụng, không xóa tự động; deploy/README ghi rõ và khuyên thông báo
  người dùng đăng ký lại.
- `PUBLIC_URL` có cổng hoặc đường dẫn con (`http://localhost:8091`, `https://example.com/bo`): RP ID là hostname không
  cổng, không đường dẫn; origin chấp nhận gồm cổng.
- Trang web và API khác origin (cấu hình `cors` của profile web: trang ở `localhost:8181`, API ở `127.0.0.1:8163`):
  trình duyệt ký origin của trang và chỉ cho dùng RP ID là hostname của trang, nên passkey không hoạt động ở đó dù API
  có nhận origin khác. Chốt (clarify 2026-11-01 câu 1): chỉ `PUBLIC_URL`; app web ẩn nút và card khi hostname của trang
  khác RP ID; E2E ở `cors` kiểm hai thứ đó ẩn.
- Đồng hồ lệch giữa replica: challenge có hạn theo đồng hồ của kho dùng chung, không theo từng replica.
- Mất kết nối kho challenge dùng chung: đăng nhập passkey trả lỗi 503 như login local khi rate limiter không với tới
  được (giữ cách xử lý hiện có của `auth_login_attempts`), không mở cửa.
- Làm đầy kho challenge qua endpoint công khai lấy challenge đăng nhập: route chịu `RATE_LIMITER_*` toàn cục khi bật như
  mọi route công khai; kho local giữ tối đa 10.000 khóa (cũ nhất bị loại); mỗi khóa ở Redis hết hạn sau 5 phút (sửa khi
  checklist 2026-11-01).
- Hai request mang cùng một challenge tới cùng lúc (hai replica): đúng một request dùng được, request kia nhận lỗi chung
  (FR-025).
- User local không có mật khẩu (null, ví dụ tạo bởi admin chưa đặt): không thêm được passkey vì bước nhập lại mật khẩu
  thất bại, như bật TFA; admin đặt mật khẩu trước (sửa khi checklist 2026-11-01).
- User xóa passkey vì mất thiết bị: các session đang mở (kể cả session do passkey đó tạo) không bị kết thúc, vì session
  không lưu passkey nào tạo ra nó; muốn thu hồi phiên thì đổi mật khẩu hoặc trạng thái user (cơ chế có sẵn xóa session)
  (Assumptions; sửa khi checklist 2026-11-01).
- Đăng nhập passkey ở chế độ `json` hay `cookie` (client API, không phải app web): token không gắn với dòng phiên nên
  `GET /policies/me/globals` trả `enforce_tfa` như Directus; màn hình bắt cài TFA không tồn tại ở client đó (phương án E).
- Hook `authenticate` của extension thay `accountability` và bỏ `session`: `enforce_tfa` tính như Directus (nghiêng về
  an toàn).
- Phiên passkey được làm mới qua API Directus (cùng refresh token, ví dụ một client trỏ vào Directus): Directus tạo dòng
  phiên mới không có `bo_passkey`, nên từ đó app Backoffice bắt cài TFA với user thuộc role bắt buộc; nghiêng về an toàn,
  chấp nhận (sửa khi analyze 2026-11-01, M5).
- Payload đăng ký hoặc xác minh sai dạng: 400 với lỗi validate như các endpoint khác, không đếm attempt.
- Tên passkey: 1–100 ký tự, cắt khoảng trắng; trùng tên giữa các passkey của cùng user được phép.
- Người dùng gọi các endpoint quản lý bằng static token hay token JSON: được nhận như `/users/me/tfa/*` (chỉ cần
  `accountability.user`); thêm passkey vẫn cần mật khẩu và lễ của authenticator thật (sửa khi analyze 2026-11-01, H2).
- Response cache dùng chung với Directus: endpoint passkey là POST/PATCH/DELETE hoặc GET theo user, không vào cache như
  `/users/me`.

## Requirements *(mandatory)*

### Functional Requirements

**Đăng nhập**

- **FR-001**: Trang login của app Backoffice PHẢI có nút "Đăng nhập bằng Passkey" dưới form local, chỉ khi trình duyệt hỗ
  trợ WebAuthn, API đang dùng là Backoffice và hostname của trang bằng RP ID mà API báo (hostname của `PUBLIC_URL`);
  API là Directus hoặc hostname khác (trang web ở origin khác API) thì ẩn (US5 kịch bản 3; clarify 2026-11-01 câu 1).
- **FR-002**: Bấm nút PHẢI mở hộp thoại passkey của trình duyệt mà không hỏi email; passkey đăng ký bởi feature này PHẢI
  là loại trình duyệt tự tìm theo domain (discoverable). Xác minh người dùng (sinh trắc hoặc PIN) PHẢI có ở cả đăng ký lẫn
  đăng nhập: phản hồi đăng ký thiếu cờ xác minh bị từ chối (400), phản hồi đăng nhập thiếu cờ xác minh bị từ chối với lỗi
  chung và đếm attempt như chữ ký sai (sửa khi checklist 2026-11-01).
- **FR-003**: Xác minh thành công PHẢI tạo session giống hệt đăng nhập local: cùng loại cookie và thời hạn, một dòng
  phiên với cùng cột (trừ `bo_passkey = true`, D-207.5; sửa khi analyze 2026-11-01), activity `login`, `last_access`, sự kiện `auth.login` trạng thái `success` với `provider` =
  `default` (như `provider` của user, không có giá trị provider mới) và `payload.passkey = true` để flow phân biệt (cả
  khi `fail`); làm mới và đăng xuất không khác (clarify 2026-11-01 câu 3).
- **FR-004**: Đăng nhập passkey KHÔNG hỏi OTP dù user có TFA, và KHÔNG gắn cờ bắt cài TFA vào token dù role có policy
  bắt buộc TFA. Vì app quyết định màn hình bắt cài TFA từ `GET /policies/me/globals` (`enforce_tfa`) và `/users/me`
  (`tfa_secret` rỗng), không từ token, **API** PHẢI nhớ phiên nào do passkey tạo (dấu trên dòng phiên trong DB, giữ qua
  mỗi lần làm mới) và trả `enforce_tfa: false` ở `GET /policies/me/globals` và GraphQL `policies_me_globals` cho phiên
  đó (D-207.5); user không giả mạo được dấu này vì chỉ lễ passkey đạt mới tạo ra nó. Token không gắn với phiên (chế độ
  `json`, `cookie`) giữ `enforce_tfa` như Directus. Directus app dùng cùng session vẫn bắt cài TFA vì API Directus không
  đọc dấu (D-207.3). Đăng nhập bằng mật khẩu không đổi (sửa khi checklist 2026-11-01; phương án E chủ dự án chọn
  2026-11-01).
- **FR-005**: Chỉ user `provider = default` và `status = active` đăng nhập được bằng passkey; mọi trường hợp khác trả
  lỗi chung của login local ("Invalid user credentials"), cùng mã lỗi.
- **FR-006**: Đăng nhập passkey thất bại vì credential của một user `active` và `provider = default` (chữ ký sai, bộ đếm
  lùi, thiếu cờ xác minh người dùng) PHẢI đếm vào cùng bộ đếm `auth_login_attempts` của user đó, cùng ngưỡng, cùng chuyển
  `suspended`, cùng activity, cùng thời gian chờ chống dò; thành công PHẢI đặt lại bộ đếm như login local. User không
  `active` hay `provider` khác `default` bị từ chối **trước** bộ đếm, không đếm (như login local,
  `authentication.service.ts:131` chạy trước limiter ở `:143`), để passkey không chuyển user `invited`/`draft` sang
  `suspended`. Credential không thuộc user nào: lỗi chung, cùng thời gian chờ, không đếm (sửa khi analyze 2026-11-01, H1).
- **FR-007**: Mọi lỗi của đăng nhập passkey trả về client PHẢI là lỗi chung, không phân biệt "không có passkey", "user
  không active", "chữ ký sai"; log server ghi lý do nhưng KHÔNG ghi challenge, phản hồi của authenticator hay khóa công
  khai (sửa khi checklist 2026-11-01).
- **FR-008**: Hủy hộp thoại của trình duyệt PHẢI quay về form login không thông báo lỗi; lỗi xác minh hiện cùng thông
  báo với sai mật khẩu; trình duyệt không hỗ trợ: không nút.
- **FR-009**: Sau đăng nhập passkey, chuyển hướng như login local (trang đích đã lưu, hoặc trang đầu).

**Đăng ký và quản lý**

- **FR-010**: Trang user của chính mình PHẢI có phần "Passkeys" (một card theo mẫu card của trang user, D-150) với danh
  sách: tên, ngày tạo, lần dùng cuối ("chưa dùng" khi null); trạng thái trống có hướng dẫn và nút thêm; không thêm dòng
  field mới vào `directus_fields` (như D-182).
- **FR-011**: Thêm passkey PHẢI yêu cầu nhập lại mật khẩu hiện tại trước khi mở hộp thoại của trình duyệt, cùng cách xác
  nhận với bật TFA; sai mật khẩu: cùng lỗi, không đếm attempt đăng nhập.
- **FR-012**: Sau khi trình duyệt tạo xong, user PHẢI đặt được tên (mặc định gợi ý theo trình duyệt/hệ điều hành) và
  passkey PHẢI được lưu gắn với user, kèm ngày tạo.
- **FR-013**: User PHẢI đổi tên và xóa được từng passkey của mình; xóa có hộp xác nhận; đổi tên và xóa không cần mật
  khẩu, chỉ thêm mới cần (clarify 2026-11-01 câu 4).
- **FR-014**: Mỗi user có tối đa 10 passkey (clarify 2026-11-01 câu 4); vượt thì nút thêm vô hiệu kèm lý do và API trả
  lỗi rõ.
- **FR-015**: Danh sách loại trừ khi đăng ký PHẢI gồm mọi credential hiện có của user để không tạo trùng trên cùng
  authenticator.
- **FR-016**: Phần "Passkeys" KHÔNG hiện cho user `provider` khác `default`; các route `users/me/*` của passkey trả 403
  khi người gọi có `provider` khác `default`; route admin xem user khác trả danh sách rỗng khi user đích có `provider`
  khác `default` (sửa khi checklist 2026-11-01).
- **FR-017**: User thường KHÔNG xem, đổi tên, xóa được passkey của người khác (UI ẩn, API 403).
- **FR-018**: Admin mở trang user khác PHẢI thấy danh sách passkey của người đó và xóa được từng passkey không cần mật
  khẩu (như tắt TFA của user khác); admin KHÔNG thêm và KHÔNG đổi tên hộ.
- **FR-019**: Không có đăng ký passkey ở trang login, invite, setup, reset mật khẩu hay bất kỳ trang public nào.
- **FR-020**: Các endpoint đăng ký và quản lý PHẢI cần người gọi đã xác thực là chính user (bất kỳ loại token nào có
  `accountability.user`, như `/users/me/tfa/*`), hoặc admin với endpoint của người khác (sửa khi analyze 2026-11-01, H2: bỏ câu "không
  nhận static token" vì route TFA được dẫn làm mẫu nhận static token).

**Dữ liệu và vòng đời**

- **FR-021**: Passkey lưu trong bảng hệ thống mới `backoffice_passkeys`, tạo bởi một migration riêng của Backoffice
  (Nguyên tắc II: chỉ `up`, chạy trên 7 vendor, chạy lại được, `hasTable` trước khi tạo, không FK tới `directus_users`),
  chạy bởi `bootstrap`/`init` và kiểm ở `start` như 022; cùng migration thêm cột boolean nullable `bo_passkey` vào
  `directus_sessions` (D-207.5, không dòng `directus_fields`). Cột của bảng mới: khóa chính uuid (v4 như collection hệ
  thống, 027), user,
  định danh credential (duy nhất), khóa công khai, bộ đếm chữ ký, kênh truyền (transports), tên, ngày tạo, lần dùng
  cuối, cờ discoverable (lưu để sau này cho phép loại khác), loại thiết bị và cờ sao lưu do trình duyệt báo.
- **FR-022**: `backoffice_passkeys` là collection hệ thống ẩn của Backoffice như `backoffice_permissions`: 403 trên
  `/items`, không có trong GraphQL, ngoài Data Model, chỉ đọc ghi qua các endpoint passkey; Directus thấy bảng chưa quản
  lý.
- **FR-023**: Xóa user ở Backoffice (một hay nhiều, theo mọi đường qua dịch vụ users của Backoffice: REST, GraphQL, trang
  Users, flow, service của extension) PHẢI xóa passkey của user đó (D-207.2; sửa khi checklist 2026-11-01).
  Dòng mồ côi (user bị Directus xóa) PHẢI bị bỏ qua: không đăng nhập được, không hiện ở đâu.
- **FR-024**: Mỗi lần đăng nhập thành công PHẢI cập nhật bộ đếm chữ ký và lần dùng cuối của passkey đó; bộ đếm mới nhỏ
  hơn hoặc bằng bộ đếm đã lưu (chỉ kiểm khi bộ đếm đã lưu > 0, vì passkey đồng bộ luôn báo 0) PHẢI bị từ chối như chữ
  ký sai và đếm attempt; passkey không bị tự vô hiệu hay xóa (clarify 2026-11-01 câu 2).
- **FR-025**: Challenge đăng ký và đăng nhập PHẢI ngẫu nhiên, dùng một lần (kể cả khi hai request mang cùng challenge tới
  đồng thời), hết hạn sau 5 phút, lưu ở kho dùng chung giữa các replica; xác minh xong (thành công hay không) challenge bị
  hủy. Challenge gắn với mục đích (đăng nhập hay đăng ký) và challenge đăng ký gắn với user đã nhập lại mật khẩu; dùng
  challenge sai mục đích hay của user khác bị từ chối (sửa khi checklist 2026-11-01).

**Domain và origin**

- **FR-026**: RP ID PHẢI là hostname của `PUBLIC_URL` (không cổng, không đường dẫn); không có biến môi trường mới. Khi
  `PUBLIC_URL` không tuyệt đối hoặc hostname là địa chỉ IP, passkey tắt: mọi route passkey trả 404 như Directus, app web
  không hiện nút và card, log cảnh báo một lần lúc khởi động (sửa khi checklist 2026-11-01).
- **FR-027**: Origin chấp nhận khi xác minh là origin của `PUBLIC_URL` và chỉ origin đó; request từ origin khác bị từ
  chối với lỗi chung. Triển khai trang web ở hostname khác API không có passkey (clarify 2026-11-01 câu 1; 026 đặt FE và
  BE chung domain).
- **FR-028**: deploy/README (compose, Helm) PHẢI ghi: passkey gắn với hostname của `PUBLIC_URL`; đổi domain là đăng ký
  lại; cần HTTPS trừ localhost.

**Song song với Directus và kiểm thử**

- **FR-029**: Mọi endpoint mới nằm dưới tiền tố `/backoffice/` (D-189.6), chỉ REST: không query hay mutation GraphQL, không
  đường dẫn trong `/server/specs/oas`; Directus trả 404 ở đó (D-207). Không endpoint hiện có nào đổi hành vi (status, body,
  header, cookie), kể cả `GET /auth`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/users/me`, `/server/info`; ngoại lệ
  là tác động DB của xóa user (D-207.2, response không đổi) và `GET /policies/me/globals` + `policies_me_globals` với
  phiên do passkey tạo (D-207.5) (sửa khi checklist 2026-11-01; phương án E).
- **FR-030**: Bộ đối chiếu có suite `auth/passkey`: Directus 404 trên endpoint mới (D-207 là entry `doc`, test từng app
  bằng `appRequest` như D-189.6; sửa khi plan 2026-11-01), login/refresh/logout khác giống Directus, session do passkey
  tạo được Directus app cùng DB làm mới, dùng và đăng xuất; dump schema so với Directus của profile `bootstrap` không đổi
  (chỉ bảng `directus_*`), bảng `backoffice_passkeys` và dòng `backoffice_migrations` kiểm ở test bootstrap và deploy;
  bộ đối chiếu bỏ `backoffice_passkeys` ở mọi chỗ đang bỏ `backoffice_permissions` (`/collections`, `/fields`, OAS,
  introspection, SDL) (D-207.1; sửa khi checklist 2026-11-01).
- **FR-031**: E2E: luồng US1, US2, US3 với authenticator giả lập của trình duyệt, chỉ chromium (firefox, webkit bỏ qua
  các spec passkey), ở `proxy-api` mở trang tại `http://localhost:8162` (RP ID `localhost` của replica passkey trong
  profile `web`, plan R10; sửa khi plan 2026-11-01); ở `proxy-directus` (API là Directus) và `cors` (hostname khác RP ID)
  kiểm nút và phần "Passkeys" ẩn; test a11y của trang login và phần "Passkeys" (bàn phím, nhãn, thông báo lỗi liên kết).
- **FR-032**: Chuỗi mới en-US và vi-VN ở overlay của app web; không có chuỗi nào lấy từ Directus (Directus không có
  passkey).
- **FR-033**: Mọi khác biệt với Directus ghi ở bảng "Khác biệt so với Directus" (D-207..D-207.4) theo dạng
  `tests/parity/src/spec-differences.ts` đọc được (FR-101 của bộ đối chiếu).

### Key Entities

- **Passkey** (`backoffice_passkeys`): một credential WebAuthn của một user: định danh credential (duy nhất), khóa công
  khai, bộ đếm chữ ký, kênh truyền, tên do user đặt, ngày tạo, lần dùng cuối, cờ discoverable, loại thiết bị và cờ sao lưu
  do trình duyệt báo. Thuộc về một `directus_users` (không FK); nhiều passkey một user; chỉ Backoffice đọc ghi.
- **Challenge**: giá trị ngẫu nhiên một lần, gắn với mục đích (đăng ký của user X, hoặc đăng nhập) và hạn 5 phút; sống
  trong kho dùng chung của các replica, không lưu DB.
- **User** (`directus_users`, có sẵn): chỉ `provider = default`, `status = active` dùng được passkey; `auth_login_attempts`
  và `suspended` dùng chung với đăng nhập mật khẩu.
- **Session** (`directus_sessions`, có sẵn): dòng do passkey tạo không khác dòng do mật khẩu tạo.

### Đánh giá hiện trạng và chạy song song với Directus 11.17.4

Đọc code ngày 2026-11-01, chưa chạy thử. Mục ghi [Inference] là suy ra từ code, plan PHẢI có test xác nhận; mục
[Unverified] thử ở research của plan.

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Luồng login local | `getUserID` → đọc user → `status !== 'active' \|\| provider !== providerName` → lỗi chung → limiter `auth_login_attempts` (suspend khi hết) → `provider.login` (argon2) → OTP → token (`enforce_tfa` khi role bắt buộc và chưa có `tfa_secret`) → dòng `directus_sessions` → activity LOGIN → `last_access` → `auth.login` success → reset limiter → stall | `apps/api/src/services/authentication.service.ts:59`, `:131`, `:143`–`:194`, `:207`–`:223`, `:239`–`:255`, `:288`, `:300`; `auth/drivers/local.ts:36` |
| 2 | Chỗ passkey vào | Sau bước `provider.login` với user đã xác minh; phần tạo session tách thành hàm dùng chung, login mật khẩu không đổi hành vi [Inference] | cùng file |
| 3 | Directus có passkey không | Không: không có WebAuthn trong `directus/api/src`, `directus/app/src` | grep 2026-11-01 |
| 4 | Admin tắt TFA của user khác | `POST /users/:pk/tfa/disable`; web `adminDisableTFA`; mẫu cho admin xóa passkey | `apps/api/src/controllers/users.controller.ts:419`, `apps/web/src/composables/use-tfa-setup.ts:123` |
| 5 | Bật TFA cần mật khẩu | `requestTFASetup` + hộp thoại trong `SystemMfaSetup.vue`; dùng lại cho thêm passkey | `apps/web/src/composables/use-tfa-setup.ts`, `interfaces/_system/system-mfa-setup/SystemMfaSetup.vue` |
| 6 | Phần TFA trên trang user | Gắn vào field `tfa_secret` của system data; passkey không có field trong `directus_users` → card thêm ở web như D-182, `GET /fields/directus_users` không đổi | `libs/system-data/src/fields/users.yaml:94`, `apps/web/src/modules/users/routes/UserItemRoute.vue` |
| 7 | Kho dùng chung giữa replica | `createKv` của `@backoffice/memory` (Redis khi cấu hình, local khi không) đã dùng cho lock; challenge đặt ở đó | `apps/api/src/lock/lib/use-lock.ts:21` |
| 8 | `PUBLIC_URL` làm gốc URL | Đã dùng ở OpenID cho redirect; RP ID lấy hostname | `apps/api/src/auth/drivers/openid.ts:485`, `:515`, `:584` |
| 9 | Migration riêng và collection hệ thống ẩn | Mẫu `20261028A` (`hasTable`, try/catch cho race); khai báo ẩn ở `collections.yaml` | `apps/api/src/database/backoffice-migrations/20261028A-create-backoffice-permissions.ts`, `libs/system-data/src/collections/collections.yaml:129`–`:134` |
| 10 | E2E authenticator giả lập | `newCDPSession` đã dùng; CDP WebAuthn chỉ chromium/msedge; cấu hình `cors` trang ở `localhost:8181`, API `127.0.0.1:8163` → origin khác `PUBLIC_URL` | `apps/web-e2e/src/perf.spec.ts:13`, `apps/web-e2e/playwright.config.ts:5` |
| 11 | Bộ đối chiếu đọc mã D | Bảng "Khác biệt so với Directus" (cột `Mã` đầu, `Gỡ ở` cuối); D-203..D-206 đã dùng ở 028 | `tests/parity/src/spec-differences.ts` |
| 12 | Thư viện WebAuthn | [Unverified] chưa có trong repo; hai gói MIT cho API và web, Node >= 20; kiểm chạy trong bundle API và test ở research | `npm view` 2026-11-01 |

**Kết luận** [Inference]: Directus không phải làm gì; Redis, file, cấu hình Directus không đổi; DB thêm một bảng
`backoffice_*` Directus không đọc. Session do passkey tạo là session thường của Directus.

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021–028).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-207 | Endpoint passkey dưới `/backoffice/` (lấy challenge và xác minh đăng nhập; liệt kê, thêm, đổi tên, xóa passkey của mình; liệt kê, xóa của user khác cho admin) | 404 | Có; session tạo ra giống login local; sự kiện `auth.login` của đăng nhập passkey có `payload.passkey = true` (flow, extension thấy; sửa khi checklist 2026-11-01); bộ đối chiếu: entry `doc`, test từng app bằng `appRequest` (Directus 404; sửa khi plan 2026-11-01) | Yêu cầu chủ dự án 2026-11-01: đăng nhập không mật khẩu, không OTP | khác (duyệt 2026-11-01) | — |
| D-207.1 | Bảng `backoffice_passkeys` trong `GET /collections`, OAS, GraphQL introspection/SDL, Data Model | Bảng chưa quản lý | Collection hệ thống ẩn (403 `/items`, không GraphQL, ngoài Data Model); bộ đối chiếu bỏ như `backoffice_permissions`; `schema snapshot`/`diff` của hai app không đổi (Directus bỏ bảng chưa quản lý, Backoffice bỏ collection hệ thống; sửa khi checklist 2026-11-01) | Nguyên tắc II (migration riêng) | khác (duyệt 2026-11-01) | — |
| D-207.2 | Xóa user | Chỉ các bảng Directus | Xóa thêm dòng `backoffice_passkeys` của user; Directus xóa user để lại dòng mồ côi, Backoffice bỏ qua | Không FK (Nguyên tắc II) | khác (duyệt 2026-11-01) | — |
| D-207.3 | User chưa có TFA nhưng role bắt buộc TFA | Mọi đăng nhập bị bắt cài TFA | Đăng nhập bằng passkey không hỏi OTP; app Backoffice không đưa tới màn hình cài TFA khi phiên do passkey tạo (API trả `enforce_tfa: false`, D-207.5); Directus app dùng cùng session vẫn bắt cài TFA (API Directus không đọc dấu); đăng nhập bằng mật khẩu như Directus (sửa khi checklist 2026-11-01, phương án E) | Chủ dự án 2026-11-01: passkey thay cả mật khẩu lẫn OTP | khác (duyệt 2026-11-01) | — |
| D-207.4 | Giao diện: nút "Đăng nhập bằng Passkey" trên trang login, card "Passkeys" trên trang user (của mình: quản lý; của người khác: admin xóa) | Không có | Có, chỉ khi API là Backoffice; không có dòng `directus_fields` mới | Cùng D-207 | khác (duyệt 2026-11-01) | — |
| D-207.5 | `GET /policies/me/globals`, GraphQL `policies_me_globals` với phiên do passkey tạo; cột `bo_passkey` trên `directus_sessions` | `enforce_tfa: true` khi policy bắt buộc (không biết phiên passkey); không có cột | `enforce_tfa: false` khi dòng phiên của token có `bo_passkey = true`; cột boolean nullable `bo_passkey` thêm bằng migration riêng (Nguyên tắc II: cột `bo_*` trên `directus_*`, không dòng `directus_fields`), Directus ghi phiên để null; giữ qua làm mới; bộ đối chiếu: entry `doc`, kiểm từng app với cookie phiên passkey vì `when` của `AcceptedDifference` không có điều kiện theo request; `parity()` của mọi phiên khác giữ so sánh chặt (sửa khi analyze 2026-11-01, H3) | Phương án E chủ dự án chọn 2026-11-01: không có lỗ hổng ở trình duyệt | khác (duyệt 2026-11-01) | — |

**Cần xác nhận**:

- Card "Passkeys" ghép từ card D-150, BoTable, BoMenu và BoDialog có sẵn; không component mới; icon `passkey` của
  Material Symbols; "lần dùng cuối" hiện dạng relative như display datetime của Directus (chủ dự án kiêm design owner,
  cùng lượt duyệt D-207; plan R8).

## Clarifications

### Session 2026-11-01 (chủ dự án, `/speckit.clarify`)

- Q: Trang web và API khác hostname (cấu hình `cors`): passkey gắn với domain nào, origin nào được chấp nhận? → A: Chỉ
  `PUBLIC_URL` (RP ID = hostname, origin = origin của `PUBLIC_URL`); cross-site không có passkey, app web ẩn nút và card
  khi hostname của trang khác RP ID; E2E `cors` kiểm ẩn (FR-001, FR-027, FR-031, US4 kịch bản 7, Edge Cases).
- Q: Bộ đếm chữ ký lùi hoặc không tăng? → A: Từ chối lần đó và đếm attempt; passkey giữ nguyên, user hoặc admin xóa
  tay; chỉ kiểm khi bộ đếm đã lưu > 0 (FR-024, US4 kịch bản 5).
- Q: Activity login và sự kiện `auth.login` của đăng nhập passkey ghi provider gì? → A: `provider = default` như user,
  `payload.passkey = true` để flow phân biệt; không có provider mới (FR-003).
- Q: Giới hạn và mật khẩu khi quản lý passkey của mình? → A: Tối đa 10 passkey; chỉ thêm mới cần nhập lại mật khẩu; đổi
  tên và xóa chỉ cần xác nhận (FR-013, FR-014).

### Sửa câu chữ khi `/speckit.plan` (2026-11-01, research R4, R8, R9, R10)

- FR-030, bảng D-207: entry `doc` thay vì `http`. FR-031: E2E `proxy-api` mở `http://localhost:8162`. "Cần xác nhận":
  icon và thời gian relative. Assumptions: khóa challenge, namespace Redis.

### Sửa khi `/speckit.checklist` (2026-11-01, checklists/security.md, checklists/api-compat.md)

- FR-002 (xác minh người dùng ở cả hai lễ), FR-004 và D-207.3 (bỏ chuyển hướng cài TFA; Directus app vẫn bắt), FR-007
  (log), FR-016 (403 theo người gọi), FR-023 (mọi đường xóa), FR-025 (gắn mục đích và
  user, một lần kể cả đồng thời), FR-026 (passkey tắt), FR-029 (chỉ REST, ngoại lệ D-207.2), FR-030 (đăng xuất, dump,
  normalizer), SC-002, SC-007, D-207, D-207.1, Edge Cases (làm đầy kho, đồng thời, user không mật khẩu, xóa passkey không
  kết thúc session), Assumptions (attestation, session, gỡ tay).

### Sửa khi `/speckit.analyze` (2026-11-01, chủ dự án: sửa HIGH và MEDIUM)

- H1: FR-006 user không `active`/sai provider bị từ chối trước bộ đếm, không đếm (như login local).
- H2: FR-020, Edge Cases, Assumptions bỏ "không nhận static token" (khớp `/users/me/tfa/*`).
- H3: D-207.5 là entry `doc`, kiểm từng app; `when` không có điều kiện theo request.
- H4: tasks T029 chạy `benchmark-auth` (Nguyên tắc X) vì `AuthenticationService.login` được tách.
- M1: research R4, plan bỏ `createCache` cho kho challenge (Redis `GETDEL`, `Map`).
- M2, M3: tasks T021 thêm `/items/backoffice_passkeys`, GraphQL và origin sai.
- M4: FR-003 ghi ngoại lệ `bo_passkey`. M5: Edge Cases làm mới phiên passkey qua Directus. CQ1: checklist CHK011.

### Duyệt 2026-11-01 (chủ dự án kiêm tech lead và design owner, sau `/speckit.plan` và `/speckit.checklist`)

1. D-207, D-207.1, D-207.2, D-207.3, D-207.4: duyệt.
2. Replica `backoffice-api-passkey` và hai `location` trong profile `web` của môi trường parity (plan R10): duyệt.
3. Directus app vẫn bắt cài TFA với session do passkey tạo (user thuộc role bắt buộc TFA chưa bật TFA): chấp nhận.
4. Xóa passkey không kết thúc session đang mở; thu hồi phiên bằng đổi mật khẩu hoặc trạng thái user: giữ mặc định.
5. Icon `passkey` của Material Symbols và "lần dùng cuối" dạng relative: duyệt.
6. Cách bỏ màn hình bắt cài TFA cho phiên passkey: chủ dự án không chấp nhận dấu trong trình duyệt (user tự đặt được);
   chọn **phương án E**: cột `bo_passkey` trên `directus_sessions`, API trả `enforce_tfa: false` cho phiên đó (D-207.5,
   FR-004). Các phương án khác đã xét: dấu trong Redis (mất khi xóa cache), claim JWT (vẫn cần nơi lưu qua làm mới),
   "có passkey là đạt TFA" (làm yếu đăng nhập mật khẩu), bắt cài TFA một lần rồi thôi (bỏ phần D-207.3).

## Assumptions

- Tên passkey 1–100 ký tự.
- Challenge hết hạn sau 5 phút, dùng một lần, lưu ở kho dùng chung của các replica (Redis namespace cố định
  `backoffice:passkey` khi có Redis, bộ nhớ tiến trình khi chạy một instance không Redis); khóa là chính chuỗi challenge,
  không id riêng (plan R4).
- Sự kiện `auth.login` không có action activity mới (vẫn `login`).
- Endpoint đăng ký/quản lý nhận mọi token có `accountability.user` như `/users/me/tfa/*` (sửa khi analyze 2026-11-01).
- HTTPS do trình duyệt bắt buộc, app không kiểm thêm.
- Không kiểm attestation, không danh sách AAGUID: mọi authenticator đạt chuẩn WebAuthn được nhận (sửa khi checklist
  2026-11-01).
- Xóa passkey không kết thúc session đang mở (session không lưu passkey nào tạo ra nó); thu hồi phiên bằng đổi mật khẩu
  hoặc trạng thái user như hiện nay (sửa khi checklist 2026-11-01, chờ chủ dự án xác nhận ở analyze).
- Không `down`: gỡ tay bằng xóa bảng `backoffice_passkeys` và dòng `20261101A` trong `backoffice_migrations` (Nguyên tắc
  II); deploy/README ghi (sửa khi checklist 2026-11-01).
- User `suspended` do dò passkey được mở lại đúng như sau khi dò mật khẩu (admin đổi status), passkey dùng lại được.
- Không có "conditional UI" (gợi ý passkey trong ô email), không passkey cho user LDAP/SSO, không bắt buộc passkey theo
  policy, không nhập xuất, không đăng nhập passkey trên Directus app (Ngoài phạm vi).
- Không ngưỡng benchmark riêng: đăng nhập passkey không nằm trong scenario benchmark; SC giữ các ngưỡng hiện có.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Người dùng có passkey vào được app từ trang login bằng một lần bấm nút và một lần xác nhận của hệ điều
  hành, không gõ ký tự nào, trong dưới 15 giây.
- **SC-002**: Người dùng thêm được passkey đầu tiên từ trang user của mình trong dưới 1 phút, bằng chuột và bằng bàn
  phím; 100% kịch bản US2 đúng ở E2E chromium trên `proxy-api` (`cors` không có passkey, clarify câu 1; sửa khi checklist
  2026-11-01).
- **SC-003**: 0 test đối chiếu, blackbox và E2E hiện có đổi kết quả; login, refresh, logout bằng mật khẩu giống Directus
  như trước (US5).
- **SC-004**: Dò passkey sai đúng `auth_login_attempts` lần dẫn tới `suspended` trong 100% lần thử; thời gian phản hồi
  của lần sai và của credential lạ chênh với sai mật khẩu không quá 10%.
- **SC-005**: Challenge dùng lại hoặc quá hạn bị từ chối 100%; đăng ký ở replica A xác minh ở replica B thành công 100%
  trong bộ kiểm thử triển khai 3 replica.
- **SC-006**: `bootstrap` trên Postgres và SQLite tạo bảng và chạy lại không lỗi; `start` trên 7 vendor của CI/nightly
  không báo thiếu migration sau khi bảng có.
- **SC-007**: Session do passkey tạo được Directus app cùng DB làm mới, dùng và đăng xuất trong 100% lần thử của bộ đối
  chiếu.
- **SC-008**: Trang login và card "Passkeys" không có vi phạm axe mức serious trở lên ở E2E a11y; mọi thao tác làm được
  bằng bàn phím.
