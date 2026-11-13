# Feature Specification: Đồng bộ cấu hình từ môi trường khác (kéo qua URL và token)

**Feature Branch**: `032-environment-sync` (làm trên `main` như 012–031, không tạo branch; script `.specify` cần
`SPECIFY_FEATURE=032-environment-sync`)
**Created**: 2026-11-14
**Status**: Draft
**Input**: User description: "Feature 032: admin kéo cấu hình từ một môi trường Backoffice khác vào môi trường đang đứng
(ví dụ đứng ở uat kéo từ stg, đứng ở prod kéo từ uat) qua một trang trong Settings: nhập URL và static token admin của
môi trường nguồn, xem bảng so sánh hai bên, tick theo nhóm hoặc từng dòng, xác nhận và áp dụng. [...] Đây là tính năng
chỉ của Backoffice (như 022, 025, 029, 030, 031). Phạm vi đã chốt (chủ dự án 2026-11-14): 1. Chỉ kéo [...]. 2. Không lưu
gì [...]. 3. Static token admin của nguồn. 4. Mười nhóm đồng bộ [...]. 5. Một màn hình vừa so sánh vừa chọn [...]. 6. Tạo,
sửa, tick xóa [...]. 7. Flow giữ status [...]. 8. Lệch phiên bản hoặc migration: từ chối. 9. Lỗi: hoàn tác phần dòng
[...]. 10. So sánh cũ bị từ chối. 11. Phụ thuộc [...]. 12. Ba môi trường đều là Postgres. Khác biệt với Directus ghi từ
D-214 [...]" (bản đầy đủ: lệnh `/speckit.specify` của 032 trong `SPECKIT-GUIDE.md` mục 6)

**Điều kiện trước `/speckit.plan`** (Governance):

- Dự kiến không sửa constitution: không bảng mới, không cột mới, không migration (tính năng không lưu gì); khác biệt API
  và giao diện ghi theo Nguyên tắc X (bảng "Khác biệt so với Directus", tech lead duyệt).
- Dự kiến không dependency mới và không biến môi trường mới; plan xác nhận cả hai.
- Khác biệt D-214, D-214.1: chủ dự án kiêm tech lead duyệt 2026-11-14, sau `/speckit.plan`.
- Câu hỏi design-system Q-49 (bố cục màn hình so sánh và chọn, Nguyên tắc XII): design owner trả lời trước
  `/speckit.tasks`; spec không tự chọn.
- Năm mặc định ở FR-001, FR-024, FR-026, FR-027, FR-028 và câu hỏi Q-49 (bố cục đề xuất ở `contracts/web.md`): chủ dự
  án kiêm design owner duyệt 2026-11-14 cùng lượt D-214. Năm câu
  của `/speckit.clarify` đã được trả lời 2026-11-14 (mục Clarifications).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Kết nối môi trường nguồn và xem so sánh hai bên (Priority: P1) 🎯 MVP

Admin đang ở môi trường đích (ví dụ uat). Trong Settings, admin mở trang đồng bộ, nhập URL và static token admin của môi
trường nguồn (ví dụ stg) rồi bấm kết nối. Trang hiện bảng so sánh theo nhóm: mỗi dòng cấu hình có một trong bốn trạng
thái (giống nhau, khác nhau, chỉ có ở nguồn, chỉ có ở đích). Admin lọc theo trạng thái và mở một dòng để xem giá trị
nguồn cạnh giá trị đích theo từng field. Bước này không đổi gì ở cả hai môi trường.

**Why this priority**: Hôm nay không có cách nào biết hai môi trường lệch nhau ở đâu ngoài so tay từng màn hình. Riêng
việc thấy khác biệt đã có giá trị, và mọi story sau cần bước này.

**Independent Test**: Tạo một flow chỉ ở nguồn, sửa một policy ở nguồn, tạo một dashboard chỉ ở đích; kết nối từ đích
và thấy ba dòng đó với đúng trạng thái; kiểm rằng không dòng nào ở hai môi trường bị đổi.

**Acceptance Scenarios**:

1. **Given** admin ở trang đồng bộ của môi trường đích, **When** nhập URL và token admin hợp lệ của một môi trường
   Backoffice cùng phiên bản rồi kết nối, **Then** bảng so sánh hiện mười nhóm, mỗi nhóm có số dòng theo từng trạng
   thái.
2. **Given** bảng so sánh đang hiện, **When** chọn lọc "khác nhau", **Then** chỉ còn các dòng có ở cả hai bên với ít
   nhất một field khác giá trị.
3. **Given** một dòng "khác nhau", **When** mở dòng, **Then** thấy danh sách field khác nhau, mỗi field có giá trị
   nguồn và giá trị đích cạnh nhau.
4. **Given** một dòng "chỉ có ở nguồn" hoặc "chỉ có ở đích", **When** mở dòng, **Then** thấy giá trị của bên có dòng và
   ghi rõ bên kia không có.
5. **Given** nhóm Settings, **When** xem nhóm, **Then** mỗi field settings là một dòng riêng có trạng thái riêng.
6. **Given** admin chỉ muốn xem một vài nhóm, **When** chọn nhóm trước khi so sánh, **Then** chỉ các nhóm đó được đọc và
   hiện.
7. **Given** so sánh xong, **When** kiểm hai môi trường, **Then** không dòng nào bị tạo, sửa hay xóa.

---

### User Story 2 - Kéo các dòng đã chọn từ nguồn về đích (Priority: P1)

Từ bảng so sánh, admin tick từng dòng hoặc tick cả nhóm, bấm áp dụng và xác nhận. Dòng chỉ có ở nguồn được tạo ở đích,
dòng khác nhau được sửa theo nguồn. Dòng không tick giữ nguyên. Khi một dòng cần dòng khác (flow cần operations của nó,
permission cần policy), dòng cần được tick kèm hoặc dòng bị chặn với lý do. Sau khi áp dụng, trang báo kết quả theo
nhóm.

**Why this priority**: Đây là việc chủ dự án cần: đưa flow, policy, settings từ stg lên uat rồi prod mà không làm lại
bằng tay ở từng môi trường.

**Independent Test**: Ở nguồn có một flow hai operation, một policy với ba permission và một field settings khác đích.
Tick ba thứ đó, áp dụng; ở đích flow chạy được, policy có đủ ba permission, field settings có giá trị của nguồn; một
dòng khác không tick vẫn như cũ.

**Acceptance Scenarios**:

1. **Given** một flow chỉ có ở nguồn, **When** tick flow và áp dụng, **Then** flow cùng mọi operation của nó có ở đích
   với cùng nối tiếp giữa các operation, và flow có `status` như ở nguồn.
2. **Given** flow vừa kéo về đang bật, **When** sự kiện kích hoạt của nó xảy ra ở đích, **Then** flow chạy mà không cần
   khởi động lại máy chủ.
3. **Given** một policy khác nhau ở hai bên, **When** tick policy và các permission của nó rồi áp dụng, **Then** policy
   và các permission đã tick ở đích giống nguồn; permission không tick giữ nguyên.
4. **Given** một permission chỉ có ở nguồn mà policy của nó không có ở đích, **When** tick permission, **Then** policy
   được tick kèm, hoặc permission bị chặn với lý do nêu policy còn thiếu.
5. **Given** ba field settings khác nhau, **When** chỉ tick một field và áp dụng, **Then** chỉ field đó đổi ở đích.
6. **Given** admin tick ô của một nhóm, **When** xem nhóm, **Then** mọi dòng tick được trong nhóm đều được tick (trừ
   dòng xóa, xem User Story 4), và bỏ tick nhóm bỏ tick mọi dòng.
7. **Given** các dòng đã tick thuộc nhóm Translations, Presets, Dashboards, Folders, Extensions, Indexes, **When** áp
   dụng, **Then** từng nhóm ở đích khớp nguồn cho đúng các dòng đã tick (preset chỉ loại global; extension chỉ đổi bật
   hoặc tắt; folder chỉ cây thư mục).
8. **Given** áp dụng xong, **When** xem kết quả, **Then** trang liệt kê theo nhóm số dòng đã tạo, đã sửa, đã xóa, và
   index nào đang được tạo nền.
9. **Given** áp dụng xong, **When** mở activity và revision của một dòng vừa đổi, **Then** thấy thay đổi dưới tên admin
   đang thao tác, như khi sửa tay.

---

### User Story 3 - Kéo data model: collection, field, relation (Priority: P1)

Admin tick một collection mới, một field mới của collection đã có, hoặc một relation, rồi áp dụng. Cấu trúc bảng ở đích
đổi theo nguồn cho đúng các dòng đã tick. Trước khi chạy, hộp xác nhận nêu rõ thay đổi nào đổi cấu trúc bảng.

**Why this priority**: Flow, permission và preset đều dựa vào collection; không kéo được data model thì các nhóm khác
thiếu chỗ dựa. Tiêu chí chấp nhận của chủ dự án có "một collection".

**Independent Test**: Ở nguồn tạo một collection có ba field và một relation tới collection đã có ở cả hai bên; tick
collection ở đích, áp dụng; ở đích tạo được item trong collection đó qua Content.

**Acceptance Scenarios**:

1. **Given** một collection chỉ có ở nguồn, **When** tick collection và áp dụng, **Then** collection cùng các field của
   nó có ở đích và dùng được ngay trong Content và API.
2. **Given** một field chỉ có ở nguồn trên collection có ở cả hai bên, **When** tick riêng field đó và áp dụng, **Then**
   chỉ field đó được thêm; các field khác nhau khác không đổi.
3. **Given** một field chỉ có ở nguồn mà collection của nó không có ở đích, **When** tick field, **Then** collection được
   tick kèm hoặc field bị chặn với lý do.
4. **Given** một field khác nhau (ví dụ interface, ghi chú, độ dài), **When** tick và áp dụng, **Then** field ở đích có
   cấu hình của nguồn.
5. **Given** ba cài đặt ẩn hiện tìm kiếm, import, export của collection (022) khác nhau, **When** tick collection và áp
   dụng, **Then** ba cài đặt ở đích giống nguồn.
6. **Given** đích có nhiều replica, **When** áp dụng thay đổi data model qua một replica, **Then** mọi replica thấy cấu
   trúc mới như sau một lần sửa Data Model bằng tay.

---

### User Story 4 - Xóa ở đích những dòng nguồn không có (Priority: P2)

Dòng chỉ có ở đích mặc định không tick. Admin có thể tick để xóa nó, từng dòng một hoặc theo lựa chọn rõ ràng của nhóm.
Trước khi chạy, hộp xác nhận liệt kê từng collection, field và dòng sẽ bị xóa và nêu hậu quả (mất dữ liệu của
collection, user mất role). Thao tác làm mất admin cuối cùng hoặc quyền của chính người đang thao tác bị chặn.

**Why this priority**: Giữ hai môi trường giống nhau cần cả xóa, nhưng xóa là thao tác rủi ro nhất và người dùng vẫn
được việc mà không có nó.

**Independent Test**: Ở đích tạo một flow và một collection có dữ liệu mà nguồn không có; tick xóa cả hai; hộp xác nhận
liệt kê đúng hai thứ và cảnh báo mất dữ liệu; sau khi xác nhận, cả hai biến mất ở đích.

**Acceptance Scenarios**:

1. **Given** bảng so sánh vừa hiện, **When** xem các dòng "chỉ có ở đích", **Then** không dòng nào được tick sẵn, kể cả
   khi admin tick ô của nhóm.
2. **Given** admin tick xóa một flow và một collection, **When** bấm áp dụng, **Then** hộp xác nhận liệt kê tên flow,
   tên collection, ghi rõ dữ liệu của collection sẽ mất và thao tác không hoàn tác được.
3. **Given** hộp xác nhận đang mở, **When** admin hủy, **Then** không gì đổi ở đích.
4. **Given** admin xác nhận, **When** áp dụng xong, **Then** đúng các dòng đã tick xóa biến mất; dòng "chỉ có ở đích"
   không tick vẫn còn.
5. **Given** một role chỉ có ở đích đang có user, **When** tick xóa, **Then** hộp xác nhận nêu số user sẽ bị đình chỉ
   và mất role (sửa khi plan 2026-11-14).
6. **Given** một role hoặc policy có quyền admin chỉ có ở đích, **When** xem dòng, **Then** dòng không tick xóa được và
   nêu lý do (clarify 2026-11-14).
7. **Given** một thay đổi đã tick (sửa policy làm mất quyền admin, xóa liên kết role với policy) làm hệ thống không còn
   admin, hoặc làm người đang thao tác mất quyền admin, **When** áp dụng, **Then** thao tác bị từ chối với lý do và
   không gì đổi.

---

### User Story 5 - Từ chối an toàn và không để lại dấu vết (Priority: P1)

Mọi trường hợp không an toàn bị từ chối trước khi đổi gì: phiên bản hai bên lệch, token sai, nguồn không tới được, địa
chỉ bị chặn, người dùng không phải admin, so sánh đã cũ, hai admin áp dụng cùng lúc. Lỗi giữa chừng khi áp dụng hoàn
tác toàn bộ phần dòng dữ liệu. URL và token không được lưu ở bất kỳ đâu.

**Why this priority**: Tính năng ghi vào cấu hình của prod bằng token admin của một môi trường khác. Sai một bước là
hỏng quyền, mất dữ liệu hoặc lộ token.

**Independent Test**: Thử lần lượt: nguồn khác phiên bản, token sai, URL không tới được, user thường, đổi một dòng ở
nguồn sau khi so sánh rồi áp dụng, làm một dòng lỗi giữa chừng. Mỗi lần đích không đổi và trang nêu lý do. Sau đó tìm
URL và token trong DB, log, activity, revision và bộ nhớ trình duyệt: không thấy.

**Acceptance Scenarios**:

1. **Given** nguồn chạy phiên bản Backoffice khác hoặc có danh sách migration khác đích, **When** kết nối, **Then** bị
   từ chối trước khi đọc dữ liệu cấu hình, thông báo nêu phiên bản của hai bên.
2. **Given** nguồn là Directus thuần hoặc một Backoffice chưa có tính năng này, **When** kết nối, **Then** bị từ chối
   với lý do nguồn không hỗ trợ đồng bộ.
3. **Given** token sai, hết hiệu lực hoặc không thuộc user admin ở nguồn, **When** kết nối, **Then** bị từ chối với lý
   do; thông báo không chứa token.
4. **Given** URL không tới được, không phải http/https, hoặc trỏ tới địa chỉ nằm trong danh sách chặn của hệ thống,
   **When** kết nối, **Then** bị từ chối với lý do tương ứng.
5. **Given** người dùng không phải admin ở đích, **When** mở trang hoặc gọi thao tác đồng bộ, **Then** không thấy mục
   menu và thao tác trả 403.
6. **Given** so sánh đã hiện, **When** một dòng thuộc nhóm đã so đổi ở nguồn hoặc ở đích rồi admin áp dụng, **Then** áp
   dụng bị từ chối, đích không đổi, trang yêu cầu so sánh lại.
7. **Given** admin đang áp dụng, **When** một dòng dữ liệu lỗi giữa chừng, **Then** mọi dòng dữ liệu của lượt đó được
   hoàn tác, trang nêu dòng lỗi và lý do; thay đổi cấu trúc bảng đã chạy mà không hoàn tác được thì được liệt kê.
8. **Given** một admin đang áp dụng, **When** admin thứ hai áp dụng, **Then** người thứ hai nhận lỗi nêu đang có một
   lượt áp dụng khác; không có hai lượt chạy xen nhau.
9. **Given** admin vừa so sánh hoặc áp dụng xong, **When** tải lại trang hoặc rời trang, **Then** URL và token không
   còn; mở lại trang là form trống.
10. **Given** đã chạy vài lượt so sánh và áp dụng, **When** tìm URL nguồn và token trong DB, log máy chủ, activity,
    revision, thông báo lỗi và bộ nhớ trình duyệt, **Then** không thấy.

---

### User Story 6 - Chạy song song với Directus 11.17.4 (Priority: P2)

Khi Backoffice chạy cạnh Directus trên cùng DB, tính năng không đổi gì ở Directus: Directus không có thao tác và trang
này, mọi endpoint khác của Backoffice vẫn trả lời như Directus, và các dòng do đồng bộ ghi được Directus đọc như dòng do
admin sửa tay.

**Why this priority**: Nguyên tắc của dự án: Backoffice chạy song song với Directus trên cùng DB mà không làm Directus
hỏng. Feature không thêm bảng hay cột nên rủi ro thấp, nhưng vẫn phải kiểm.

**Independent Test**: Gọi thao tác đồng bộ ở Directus: 404. Áp dụng một flow và một collection qua Backoffice; mở app
Directus trên cùng DB: thấy flow và collection đó, sửa được như bình thường.

**Acceptance Scenarios**:

1. **Given** cùng đường dẫn của thao tác đồng bộ, **When** gọi ở Directus, **Then** 404.
2. **Given** app Backoffice trỏ vào API là Directus, **When** mở Settings, **Then** không có mục menu đồng bộ và đường
   dẫn trang không hiện nội dung của tính năng.
3. **Given** Backoffice vừa áp dụng một lượt đồng bộ, **When** Directus trên cùng DB đọc các dòng đó, **Then** Directus
   hiện và sửa được chúng như dòng do chính nó tạo.
4. **Given** bộ đối chiếu hiện có, **When** chạy lại sau khi có feature, **Then** không test nào đổi kết quả.

---

### Edge Cases

- URL nguồn có dấu `/` ở cuối hoặc có đường dẫn con (Backoffice sau reverse proxy): chấp nhận, chuẩn hóa trước khi gọi.
- URL nguồn trỏ về chính môi trường đích: qua địa chỉ công khai thì cho phép (mọi dòng "giống nhau", không có gì để áp
  dụng); qua `localhost` thì bị danh sách chặn mặc định từ chối (sửa khi plan 2026-11-14).
- Nguồn trả lời bằng một chuyển hướng (kể cả sang cùng host, ví dụ http sang https): không theo, báo lỗi; admin nhập
  URL cuối (sửa khi checklist 2026-11-14).
- Đích chưa có dòng settings (DB mới, settings chưa từng lưu): dòng được tạo với các field đã tick, field khác giữ mặc
  định (checklist 2026-11-14).
- Index tạo lỗi sau khi ghi: kết quả nêu lỗi; lần so sánh sau index đó hiện lại "chỉ ở nguồn", admin thử lại được
  (checklist 2026-11-14).
- Nguồn trả lời chậm hoặc đứt giữa chừng khi so sánh: báo lỗi rõ, không hiện bảng so sánh dở.
- Token của nguồn bị đổi hoặc thu hồi giữa lúc so sánh và lúc áp dụng: áp dụng bị từ chối, đích không đổi.
- Admin tải lại trang trong lúc đang áp dụng: lượt áp dụng chạy hết hoặc hoàn tác hết; trang mở lại là form trống.
- Hai admin so sánh cùng lúc: được, vì so sánh không ghi gì.
- Cùng một flow, role, policy, dashboard hoặc folder được tạo tay riêng ở hai bên (cùng tên, khác định danh): hiện thành
  một dòng chỉ có ở nguồn và một dòng chỉ có ở đích, vì các nhóm này so khớp theo định danh; không khớp theo tên (FR-009,
  clarify 2026-11-14). Permission, preset, translation, extension, index tạo tay ở hai bên vẫn khớp nhờ khóa tự nhiên.
- Role và policy Administrator có định danh khác nhau ở hai môi trường bootstrap riêng: so khớp theo định danh, nên
  chúng hiện thành một dòng chỉ có ở nguồn và một dòng chỉ có ở đích; dòng ở đích không tick xóa được (FR-018), dòng
  của nguồn kéo về được nếu admin tick; không bao giờ được làm mất admin cuối cùng (FR-027) (clarify 2026-11-14).
- Field settings trỏ tới file (logo, ảnh nền, favicon) mà file không có ở đích: hiện là khác nhau, không tick được,
  có lý do; giá trị ở đích giữ nguyên (FR-020, clarify 2026-11-14).
- Field settings có giá trị được mã hóa hoặc che khi đọc (các khóa API của AI): hiện trong bảng, không so, không tick
  được; giá trị che không bao giờ được ghi vào đích. `mapbox_key` là chuỗi thường, so như field khác (FR-013, clarify
  2026-11-14).
- Permission, preset, panel, index, liên kết role với policy mà thứ nó dựa vào không có ở đích và không được tick: dòng
  bị chặn với lý do (FR-020).
- Flow tham chiếu collection hoặc extension operation chưa có ở đích: không kiểm; flow được kéo như nguồn và có thể lỗi
  khi chạy (Assumptions).
- Extension chỉ có ở một bên: hiện để biết, không tick được; tính năng không cài hay gỡ extension.
- Index của một collection chưa có ở đích: phụ thuộc vào collection (FR-020); index được tạo nền sau khi các thay đổi
  khác xong, kết quả báo "đang tạo".
- Đổi kiểu một field mà dữ liệu ở đích không hợp kiểu mới: lỗi khi áp dụng, xử lý theo FR-025.
- Xóa collection có dữ liệu, xóa field có dữ liệu: hộp xác nhận nêu mất dữ liệu (FR-021).
- Xóa folder có file hoặc folder con: file của folder về gốc; folder con phải được tick cùng (xóa hoặc đổi cha), nếu
  không dòng bị chặn với lý do; hộp xác nhận nêu số file (sửa khi plan 2026-11-14).
- Nguồn có hàng nghìn dòng (ví dụ permission): bảng vẫn dùng được nhờ nhóm thu gọn và lọc theo trạng thái (SC-006).
- Đích có nhiều replica: thay đổi có hiệu lực trên mọi replica như sau khi sửa tay.
- Nguồn trả dữ liệu sai hình dạng hoặc có bảng, cột lạ: phần lạ bị bỏ, không bao giờ được ghi vào đích (FR-006).
- Token sai ở nguồn: đích báo lỗi yêu cầu (400), không báo lỗi xác thực (401), vì 401 ở đích nghĩa là phiên của chính
  admin hết hạn (plan 2026-11-14).
- Hai dòng cùng khóa so khớp ở một bên (ví dụ hai preset global cùng collection và bookmark): dòng đầu được so, các dòng
  sau không tick được, có lý do (plan 2026-11-14).

## Requirements *(mandatory)*

### Functional Requirements

**Kết nối nguồn**

- **FR-001**: Backoffice PHẢI có một trang trong Settings và các thao tác đồng bộ dành riêng cho admin (`admin_access`)
  của môi trường đích; user khác 403 và không thấy mục menu (duyệt 2026-11-14). Directus trả 404 cho cùng đường dẫn (D-214).
- **FR-002**: Admin nhập đúng hai giá trị: URL của môi trường nguồn và static token của một user admin ở nguồn. Không có
  cách xác thực khác (không email và mật khẩu, không SSO).
- **FR-003**: Không lưu gì: URL, token, danh sách môi trường và lịch sử đồng bộ KHÔNG được ghi vào DB, file, log máy
  chủ, activity, revision, response cache, thông báo lỗi hay bộ nhớ trình duyệt. Tải lại trang hoặc rời trang là mất,
  phải nhập lại. URL và token chỉ được gửi trong thân request, không bao giờ trong địa chỉ request (query, đường dẫn),
  vì log truy cập và proxy ghi địa chỉ (sửa khi checklist 2026-11-14).
- **FR-004**: Trước khi đọc dữ liệu cấu hình, hệ thống PHẢI kiểm theo thứ tự và từ chối với lý do rõ khi: URL không
  phải http/https hoặc chứa tên người dùng, mật khẩu; địa chỉ nằm trong danh sách chặn gọi ra ngoài hiện có
  (`IMPORT_IP_DENY_LIST`), kiểm theo địa chỉ IP thật sau khi phân giải tên; nguồn không tới được hoặc không trả lời trong
  30 giây cho mỗi lần gọi; nguồn trả lời bằng một chuyển hướng (không theo mọi chuyển hướng); trả lời lớn hơn 100 MB;
  token không hợp lệ hoặc không thuộc user admin ở nguồn; nguồn không phải Backoffice có tính năng này (gồm Directus
  thuần). Thông báo lỗi do đích tự đặt, không chép nội dung trả lời của nguồn (sửa khi checklist 2026-11-14).
- **FR-005**: Phiên bản Backoffice hoặc danh sách migration (của Directus và của Backoffice) của hai bên khác nhau: từ
  chối cả so sánh và áp dụng, trước khi đọc dữ liệu cấu hình của nguồn (sửa khi checklist 2026-11-14); thông báo nêu
  phiên bản của nguồn và của đích. Hai bên khác vendor DB: không thêm chặn
  riêng; chỉ nhóm Data model bị từ chối với lý do, theo kiểm tra sẵn có của snapshot (clarify 2026-11-14).
- **FR-006**: Dữ liệu nhận từ nguồn là dữ liệu không tin cậy: hệ thống chỉ dùng các bảng và cột thuộc mười nhóm của
  FR-007; phần sai hình dạng hoặc lạ bị bỏ và không bao giờ được ghi vào đích.

**So sánh**

- **FR-007**: Mười nhóm đồng bộ, không hơn:
  1. Data model: collection, field, relation của collection người dùng, gồm ba cài đặt ẩn hiện của 022. Không gồm cờ
     index trên field hệ thống (sửa khi plan 2026-11-14).
  2. Flows: flow kèm operations.
  3. Roles, Policies, Permissions: role, policy, liên kết role với policy, permission, và quyền import/export của
     Backoffice (025). Không gồm liên kết user với policy.
  4. Settings: mỗi field là một dòng.
  5. Translations.
  6. Presets: chỉ preset global (không gắn user, không gắn role).
  7. Dashboards: dashboard kèm panels.
  8. Indexes: định nghĩa index của 030.
  9. Folders: chỉ cây thư mục của thư viện file, không chép file.
  10. Extensions: chỉ trạng thái bật hoặc tắt của extension có ở cả hai bên.
- **FR-008**: Admin chọn được nhóm nào đem so; mặc định là cả mười nhóm.
- **FR-009**: Mỗi dòng có đúng một trạng thái: giống nhau, khác nhau, chỉ có ở nguồn, chỉ có ở đích. Mỗi nhóm hiện số
  dòng theo từng trạng thái. Một dòng ở nguồn và một dòng ở đích là một khi khóa so khớp trùng (clarify 2026-11-14):
  permission theo (policy, collection, action); preset global theo (collection, bookmark); translation theo (language,
  key); extension theo tên gói và tên entry trong bundle; index theo tên; settings theo tên field; data model theo tên
  collection, field, relation; flow, operation, role, policy, liên kết role với policy, dashboard, panel, folder theo
  định danh.
- **FR-010**: Admin lọc được bảng theo trạng thái; nhóm thu gọn và mở được.
- **FR-011**: Mở một dòng hiện từng field khác nhau với giá trị nguồn cạnh giá trị đích; dòng chỉ có ở một bên hiện giá
  trị của bên đó.
- **FR-012**: So sánh bỏ qua các giá trị vốn khác nhau giữa hai môi trường mà không phải cấu hình: định danh tự tăng,
  thời điểm tạo và sửa, người tạo và người sửa.
- **FR-013**: Giá trị được mã hóa hoặc che khi đọc KHÔNG được so và KHÔNG được ghi vào đích; dòng hoặc field đó vẫn hiện
  trong bảng, không tick được, có lý do. Field khóa dạng chuỗi thường (ví dụ `mapbox_key`) được so và kéo như field
  khác (clarify 2026-11-14).
- **FR-014**: Extension chỉ có ở một bên hiện trong nhóm Extensions để admin biết, không tick được. Tính năng không cài,
  không gỡ, không chép file extension.
- **FR-015**: So sánh không ghi gì vào nguồn và vào đích.

**Chọn và áp dụng**

- **FR-016**: Admin tick từng dòng hoặc tick ô của nhóm. Ô nhóm tick mọi dòng tick được thuộc loại tạo và sửa, và có
  trạng thái "một phần" khi chỉ vài dòng được tick.
- **FR-017**: Áp dụng: dòng chỉ có ở nguồn và được tick thì tạo ở đích; dòng khác nhau và được tick thì sửa theo nguồn;
  dòng chỉ có ở đích và được tick thì xóa. Dòng không tick và dòng giống nhau KHÔNG đổi, trừ dòng bị xóa kèm theo
  FR-020. Dòng của nhóm so khớp theo định danh được tạo ở đích với định danh của nguồn; dòng so khớp theo khóa tự nhiên
  được tạo với định danh mới của đích. Sửa một flow theo nguồn gồm thêm operation chỉ có ở nguồn, sửa operation khác
  nhau và xóa operation chỉ có ở đích; dashboard và panel cũng vậy (sửa khi checklist 2026-11-14).
- **FR-018**: Dòng chỉ có ở đích mặc định không tick và không bị tick bởi ô nhóm; admin phải tick xóa một cách rõ ràng.
  Role và policy có quyền admin ở đích không tick xóa được, chỉ hiện để biết, kèm lý do (clarify 2026-11-14).
- **FR-019**: Flow kéo về giữ `status` như nguồn. Flow đang bật có hiệu lực ngay ở đích, không cần khởi động lại.
- **FR-020**: Phụ thuộc. Không bao giờ ghi một dòng thiếu thứ nó dựa vào (tách thành bốn ý khi analyze 2026-11-14):
  - Chiều xuôi: khi một dòng được tick cần dòng khác chưa có ở đích (flow cần operations của nó; permission cần policy
    và collection; panel cần dashboard; liên kết role với policy cần cả hai; field và relation cần collection; index và
    preset cần collection; folder con cần folder cha), dòng cần được tick kèm, hoặc dòng bị chặn với lý do nêu thứ còn
    thiếu.
  - Field settings (clarify 2026-11-14): trỏ tới file chỉ tick được khi file đó có ở đích; nếu không, field hiện là
    khác nhau, không tick được, có lý do, và không bị đặt rỗng. Trỏ tới folder hoặc role chỉ tick được khi folder hoặc
    role đó có ở đích hoặc được tick kèm.
  - Chiều ngược (checklist 2026-11-14): dòng ở đích dựa vào một dòng bị tick xóa (permission, preset, quyền
    import/export và index của collection bị xóa; permission của policy bị xóa; liên kết và preset của role bị xóa;
    folder con của folder bị xóa) được tick xóa kèm, không bỏ tick được khi dòng kia còn tick, và có tên trong hộp xác
    nhận; không dòng nào bị xóa mà không hiện trong hộp xác nhận.
  - Máy chủ kiểm lại phụ thuộc cả hai chiều khi áp dụng, kể cả khi lựa chọn được gửi thẳng qua API; thiếu thì từ chối
    trước khi ghi (checklist 2026-11-14).
- **FR-021**: Trước khi áp dụng PHẢI có hộp xác nhận nêu: số dòng sẽ tạo, sửa, xóa theo nhóm; tên từng collection, field
  và dòng sẽ bị xóa; cảnh báo mất dữ liệu khi xóa collection hoặc field; số user bị đình chỉ và mất role khi xóa role, số permission xóa theo khi xóa policy, số file về gốc khi xóa folder (sửa
  khi plan 2026-11-14); các flow sẽ bật
  ngay ở đích; và rằng thao tác xóa không hoàn tác được. Hủy hộp xác nhận không đổi gì.
- **FR-022**: Kết quả so sánh chỉ dùng được khi hai bên chưa đổi: nếu một dòng thuộc nhóm đã so đổi ở nguồn hoặc ở đích
  sau lúc so sánh, áp dụng bị từ chối trước khi ghi và trang yêu cầu so sánh lại. Chỉ thay đổi ở các giá trị được so
  (không phải các giá trị bỏ qua của FR-012) mới làm so sánh cũ. Việc kiểm làm sau khi lượt áp dụng đã giữ khóa của
  FR-026, để không thay đổi nào lọt vào giữa lúc kiểm và lúc ghi (sửa khi checklist 2026-11-14). Vì không lưu gì
  (FR-003), bước áp dụng gửi lại URL và token.
- **FR-023**: Thứ tự ghi do hệ thống quyết định sao cho phụ thuộc có trước (ví dụ collection trước permission, policy
  trước permission, dashboard trước panel) và xóa theo chiều ngược lại.
- **FR-024**: Người tạo, người sửa, thời điểm tạo và sửa không được so và không được chép từ nguồn; đích tự ghi như khi
  tạo tay (người tạo là admin đang thao tác) (duyệt 2026-11-14; sửa khi plan, trước là "đặt rỗng").
- **FR-025**: Lỗi khi áp dụng: toàn bộ phần dòng dữ liệu của lượt đó được hoàn tác, trang nêu dòng lỗi và lý do. Trên
  Postgres thay đổi cấu trúc bảng nằm chung một transaction với phần dòng nên cũng được hoàn tác; trên vendor mà thay đổi
  cấu trúc không hoàn tác được (chưa đo) thì chúng PHẢI được liệt kê trong kết quả. Index được tạo và xóa sau cùng, ngoài
  phần hoàn tác, và được báo riêng (sửa khi plan 2026-11-14). Lỗi ở bước sau khi ghi (xóa cache, nạp lại flow và
  extension) không hoàn tác dữ liệu đã ghi; kết quả báo đã áp dụng kèm cảnh báo bước nào lỗi (sửa khi checklist
  2026-11-14).
- **FR-026**: Mỗi lúc chỉ một lượt áp dụng chạy trên một môi trường đích, kể cả khi có nhiều replica; không bao giờ có
  hai lượt ghi xen nhau (duyệt 2026-11-14; sửa khi plan). Lượt thứ hai chờ tối đa khoảng 5 giây: nếu lượt trước vẫn chạy
  thì nhận lỗi rõ và không ghi gì; nếu lượt trước xong trong lúc chờ thì lượt thứ hai chạy, đọc lại hai bên như FR-022 và
  bị từ chối nếu so sánh của nó đã cũ (sửa khi analyze 2026-11-14).
- **FR-027**: Hệ thống PHẢI từ chối thao tác làm môi trường đích không còn admin, hoặc làm người đang thao tác mất quyền
  admin (duyệt 2026-11-14).
- **FR-028**: Mỗi dòng ghi vào đích để lại activity và revision dưới tên admin đang thao tác, như khi sửa tay. Không có
  bản ghi riêng cho lượt đồng bộ (duyệt 2026-11-14; hệ quả của FR-003).
- **FR-029**: Sau khi áp dụng, môi trường đích hoạt động như sau các thao tác sửa tay tương ứng: flow nạp lại, cấu trúc
  mới và quyền mới có hiệu lực trên mọi replica và các instance Directus dùng chung DB và Redis, cache liên quan được xóa
  (sửa khi checklist 2026-11-14).
- **FR-030**: Kết quả áp dụng hiện theo nhóm: số dòng đã tạo, đã sửa, đã xóa, kèm tên các collection, field và dòng đã
  xóa; index đang tạo nền.

**Giao diện**

- **FR-031**: Trang nằm trong Settings, có mục menu riêng; mục menu và nội dung trang ẩn khi API là Directus (D-214.1).
- **FR-032**: Một màn hình cho cả so sánh và chọn (không tách trang so sánh riêng): form kết nối, bảng so sánh có ô
  tick, hộp xác nhận, kết quả.
- **FR-033**: Bố cục của màn hình này chưa có mẫu trong design-system: ghi thành câu hỏi mở Q-49 (Nguyên tắc XII), spec
  và plan không tự chọn; design owner chọn bố cục đề xuất ở `contracts/web.md` (2026-11-14). Thành phần dùng theo `design-system/docs/component-specs.md`; màu, chữ, khoảng cách theo theme.
- **FR-034**: Ô token che giá trị khi nhập, yêu cầu trình duyệt không lưu (trình duyệt vẫn có thể đề nghị, không kiểm
  soát hết được), không bao giờ được hiện lại sau khi gửi (sửa khi plan 2026-11-14).
- **FR-035**: Mọi thao tác làm được bằng bàn phím; nhãn và lỗi gắn với ô nhập; trạng thái của dòng không chỉ thể hiện
  bằng màu; không vi phạm axe mức serious trở lên.
- **FR-036**: Chuỗi giao diện có en-US và vi-VN.

**Song song với Directus và kiểm thử**

- **FR-037**: Mọi endpoint ngoài các thao tác đồng bộ trả lời như trước; không bảng, cột, migration hay kiểu dòng mới;
  dòng do đồng bộ ghi có cùng dạng với dòng do các thao tác hiện có ghi. Thao tác mới chỉ có ở REST: không có trong
  GraphQL, không có trong tài liệu OpenAPI; `/server/info` không đổi (sửa khi checklist 2026-11-14).
- **FR-038**: Bộ đối chiếu mới `tests/parity/src/sync` chạy với hai Backoffice trên hai DB Postgres (nguồn và đích;
  vendor khác ghi "chưa đo", clarify 2026-11-14), gồm: Directus
  404 ở thao tác mới; đúng bốn trạng thái cho từng nhóm; áp dụng tạo, sửa, xóa đúng dòng đã chọn và không chạm dòng
  không chọn; lệch phiên bản bị từ chối; token sai, URL không tới được, URL bị chặn trả lỗi rõ; lỗi giữa chừng không để
  lại dòng nào; so sánh cũ bị từ chối; hai lượt áp dụng cùng lúc; user thường 403; token và URL không xuất hiện trong
  log, activity, revision hay thông báo lỗi; mọi endpoint khác vẫn giống Directus.
- **FR-039**: E2E `settings-sync` ở ba cấu hình: `proxy-directus` không có mục menu; `proxy-api` và `cors` kết nối, so
  sánh, tick một flow và một collection, áp dụng, thấy chúng ở đích; tick xóa có hộp xác nhận; a11y axe như 016.
- **FR-040**: Tài liệu vận hành ghi: hai môi trường phải cùng phiên bản; đích phải gọi được tới URL của nguồn; token
  admin của nguồn đi qua trình duyệt và máy chủ đích ở mỗi lượt; flow nên dùng biến môi trường cho URL và token riêng
  từng môi trường để cùng một flow chạy đúng ở mọi nơi; flow đang bật chạy ngay sau khi kéo về; nên dùng URL https cho
  nguồn, http chỉ trong mạng nội bộ tin cậy vì token đi kèm mỗi lần gọi (sửa khi checklist 2026-11-14).
- **FR-101**: Bảng "Khác biệt so với Directus" có cột `Mã` đầu, `Gỡ ở` cuối để `tests/parity/src/spec-differences.ts`
  đọc; D-214 và D-214.1 là entry `doc` (thao tác và trang chỉ có ở Backoffice, test từng app).

### Key Entities

Không thực thể nào được lưu (FR-003); tất cả chỉ sống trong một lượt so sánh hoặc áp dụng.

- **Môi trường nguồn**: một Backoffice khác, xác định bằng URL và static token admin; chỉ được đọc.
- **Môi trường đích**: môi trường admin đang đăng nhập; là nơi duy nhất bị ghi.
- **Nhóm đồng bộ**: một trong mười nhóm của FR-007; có danh sách dòng, quy tắc so khớp dòng giữa hai bên, các giá trị bỏ
  qua khi so, và các nhóm nó phụ thuộc.
- **Dòng so sánh**: một cấu hình thuộc một nhóm; có khóa so khớp, nhãn hiển thị, trạng thái (giống nhau, khác nhau, chỉ
  có ở nguồn, chỉ có ở đích), danh sách field khác nhau với giá trị hai bên, danh sách dòng nó cần, danh sách dòng bị xóa kèm khi nó bị xóa, và cờ tick được hay
  không kèm lý do.
- **Lựa chọn**: tập dòng admin đã tick, gồm cả dòng tick xóa.
- **Kết quả áp dụng**: số dòng đã tạo, sửa, xóa theo nhóm; dòng lỗi và lý do nếu có; thay đổi cấu trúc không hoàn tác
  được; index đang tạo nền.

### Đánh giá hiện trạng và chạy song song với Directus 11.17.4

Đọc code ngày 2026-11-14, chưa chạy thử. Mục ghi [Inference] là suy ra từ code, plan PHẢI có bước xác nhận.

| # | Điểm kiểm tra | Kết quả | Nguồn |
|---|---------------|---------|-------|
| 1 | Chuyển cấu hình hiện nay | Chỉ có snapshot, diff, apply của schema và CLI `schema snapshot`, `schema apply`; snapshot gồm `collections`, `fields`, `systemFields`, `relations` của collection người dùng | `apps/api/src/controllers/schema.controller.ts:98`, `:106`, `:122`; `apps/api/src/cli/index.ts:106`, `:114`; `apps/api/src/utils/get-snapshot.ts` |
| 2 | Web | Chỉ có nút tải snapshot ở Data Model; không có màn hình diff hay apply | `apps/web/src/modules/settings/routes/data-model/components/SnapshotSidebarDetail.vue` |
| 3 | Biết phiên bản của nguồn | `/server/info` chỉ trả phiên bản Directus 11.17.4, không trả phiên bản Backoffice hay migration; FR-005 cần nguồn tự báo hai thứ đó, nên nguồn phải là Backoffice có feature này; plan R1: nguồn phục vụ hai thao tác chỉ đọc (thông tin instance và trạng thái cấu hình), đích không đọc qua các endpoint REST có sẵn | `apps/api/src/services/server.service.ts:121`, `apps/api/src/version.ts:3`, `apps/api/src/database/backoffice-migrations` (4 migration) |
| 4 | Gọi HTTP ra ngoài | Có sẵn hàm gọi ra ngoài kèm kiểm IP theo `IMPORT_IP_DENY_LIST`; mặc định chỉ chặn `0.0.0.0` và `169.254.169.254`, nên địa chỉ mạng nội bộ gọi được | `apps/api/src/request/index.ts:8`, `is-denied-ip.ts`, `libs/env/src/constants/defaults.ts:134` |
| 5 | Kiểm snapshot | Từ chối snapshot khác phiên bản Directus hoặc khác vendor trừ khi `force` | `apps/api/src/utils/validate-snapshot.ts:67`–`:89` |
| 6 | Áp dụng schema | Chạy trong một transaction riêng [Inference: gộp được với phần dòng trên Postgres hay không, plan đo] | `apps/api/src/utils/apply-diff.ts:57` |
| 7 | Snapshot và cài đặt 022 | Snapshot giữ nguyên `meta` của collection [Inference: ba cột `bo_show_*` đi theo nhóm Data model] | `apps/api/src/utils/sanitize-schema.ts:22` |
| 8 | Flow sau khi ghi | Service flow nạp lại bộ quản lý flow sau tạo, sửa, xóa | `apps/api/src/services/flows.service.ts:15`, `:24`, `:36` |
| 9 | Xóa role | User của role bị xóa được đặt `role: null` | `apps/api/src/services/roles.service.ts:47`, `:86` |
| 10 | Chặn mất admin cuối | Đã có kiểm tra số admin còn lại, dùng ở service policies và users | `apps/api/src/permissions/modules/validate-remaining-admin`, `apps/api/src/services/policies.service.ts` |
| 11 | Field settings đặc biệt | Trỏ tới file: `project_logo`, `public_foreground`, `public_background`, `public_favicon`; tới folder: `storage_default_folder`; tới role: `public_registration_role`; `ai_*_api_key` có special `encrypt`; `mapbox_key` là chuỗi thường | `libs/system-data/src/fields/settings.yaml:152`, `:206`, `:494`, `:631`–`:647`, `:762` |
| 12 | Bảng có khóa tự tăng | `directus_permissions`, `directus_presets`, `directus_settings`: định danh khác nhau giữa các môi trường, cần khóa so khớp khác | `apps/api/src/database/seeds/08-permissions.yaml`, `09-presets.yaml`, `13-settings.yaml` |
| 13 | Định danh role, policy mặc định | Policy public có định danh cố định trong migration [Inference: role và policy Administrator do bootstrap sinh nên có thể khác nhau giữa các môi trường; plan đọc] | `apps/api/src/database/migrations/20240806A-permissions-policies.ts` |
| 14 | Endpoint chỉ của Backoffice | Tiền tố `/backoffice/`, kiểm admin ở controller; web ẩn tính năng bằng probe 404 | `apps/api/src/controllers/backoffice-indexes.controller.ts:31`, `apps/web/src/composables/use-extension-upload.ts` |
| 15 | Bộ đối chiếu đọc mã D | Cột `Mã` đầu, `Gỡ ở` cuối; từ đầu của dòng `Status` | `tests/parity/src/spec-differences.ts:27`–`:36` |

**Kết luận** (chưa đo): Directus không phải làm gì; DB, Redis và cấu hình của Directus không đổi; không bảng, cột hay
kiểu dòng mới; các dòng do đồng bộ ghi đi qua cùng đường với sửa tay. Điểm mới duy nhất ở phía nguồn là thao tác báo
phiên bản (dòng 3).

## Khác biệt so với Directus *(mandatory)*

Bảng theo dạng `tests/parity/src/spec-differences.ts` đọc (cột `Mã` đứng đầu, cột `Gỡ ở` cuối, như spec 021–031).

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|-------|
| D-214 | Các thao tác đồng bộ dưới `/backoffice/sync` (báo phiên bản, đọc trạng thái cấu hình, so sánh, áp dụng), admin only | 404 | Có; so sánh và kéo cấu hình từ một Backoffice khác qua URL và static token; không lưu gì; entry `doc`, test từng app (Directus 404) | Yêu cầu chủ dự án 2026-11-14: đồng bộ cấu hình giữa stg, uat, prod | khác (duyệt 2026-11-14) | — |
| D-214.1 | Trang đồng bộ trong Settings và mục menu của nó | Không có | Có ở app Backoffice khi API là Backoffice; ẩn khi API là Directus; entry `doc` | Giao diện của D-214 | khác (duyệt 2026-11-14) | — |

**Đã xác nhận 2026-11-14** (chủ dự án kiêm tech lead và design owner, cùng lượt duyệt D-214; cả ba mục theo đề xuất
của plan):

- Q-49 (design-system): bố cục của màn hình so sánh và chọn (form kết nối, bảng theo nhóm có ô tick, chi tiết hai cột
  nguồn và đích, hộp xác nhận, kết quả). Chưa có mẫu trong `design-system/docs/layout-patterns.md`; plan đề xuất, design
  owner chọn.
- Tên trang và nhãn mục menu en-US/vi-VN (đề xuất: "Environment Sync" / "Đồng bộ môi trường"), icon của mục menu.
- Năm mặc định: FR-001 (chỉ admin), FR-024 (người tạo do đích tự ghi, không chép), FR-026 (mỗi lúc một lượt áp
  dụng), FR-027 (không tự khóa admin), FR-028 (activity và revision như sửa tay, không bản ghi lượt đồng bộ).

## Clarifications

### Session 2026-11-14 (chủ dự án, `/speckit.clarify`)

- Q: Role và policy có quyền admin (ví dụ Administrator) có thể có định danh khác nhau giữa các môi trường bootstrap
  riêng; so khớp và xử lý thế nào? → A: So khớp theo định danh; role và policy có quyền admin ở đích không tick xóa
  được, chỉ hiện để biết; role và policy admin của nguồn vẫn kéo về được nếu admin tick.
- Q: Field settings trỏ tới file (logo, ảnh nền, ảnh foreground, favicon) khác nhau mà file của nguồn không có ở đích
  thì xử lý thế nào? → A: Field hiện là khác nhau nhưng không tick được, có lý do "file không có ở đích"; không đặt
  rỗng. Field settings trỏ tới folder hoặc role chỉ tick được khi folder hoặc role đó có ở đích hoặc được tick kèm.
- Q: Field settings có giá trị mã hóa hoặc che khi đọc (các khóa API của AI) và `mapbox_key` (chuỗi thường) được so và
  kéo thế nào? → A: Field mã hóa hoặc che hiện trong bảng nhưng không so giá trị, không tick được, có lý do, không bao
  giờ được ghi vào đích; `mapbox_key` là chuỗi thường nên so và kéo như field khác.
- Q: Dùng khóa nào để biết một dòng ở nguồn và một dòng ở đích là một, với các bảng không có định danh chung? → A: Khóa
  tự nhiên: permission theo (policy, collection, action); preset global theo (collection, bookmark); translation theo
  (language, key); extension theo tên gói và tên entry trong bundle; index theo tên; settings theo tên field; data model
  theo tên collection, field, relation; các nhóm còn lại (flow, operation, role, policy, liên kết role với policy,
  dashboard, panel, folder) theo định danh.
- Q: Tính năng đối xử với vendor DB khác Postgres thế nào? → A: Không thêm chặn theo vendor; hai bên khác vendor thì chỉ
  nhóm Data model bị từ chối (kiểm tra sẵn có của snapshot); bộ đối chiếu chỉ chạy trên Postgres, vendor khác ghi "chưa
  đo".

### Duyệt 2026-11-14 (chủ dự án kiêm tech lead và design owner, sau `/speckit.plan`: "duyệt như đề xuất")

- D-214 và D-214.1.
- Q-49: bố cục đề xuất ở `contracts/web.md` (form kết nối, tab lọc trạng thái, mỗi nhóm một khối thu gọn chứa bảng có ô
  tick, hộp thoại chi tiết hai cột, hộp xác nhận, kết quả); tên trang "Environment Sync" / "Đồng bộ môi trường", mục
  menu ở cuối nhóm 1 của Settings.
- Năm mặc định: FR-001, FR-024 (theo câu đã sửa khi plan), FR-026, FR-027, FR-028.
- Ba điểm Complexity Tracking của plan: nguồn có `GET /backoffice/sync/state`; flow và operation ghi bằng `ItemsService`
  trực tiếp; bộ so sánh và áp dụng chỉ chạy trên Postgres.
- Mười sửa câu chữ dưới đây.

### Sửa câu chữ khi `/speckit.plan` (2026-11-14, research R1–R14; duyệt 2026-11-14)

- D-214, bảng "Đánh giá hiện trạng" dòng 3: nguồn phục vụ hai thao tác chỉ đọc (thông tin instance, trạng thái cấu
  hình); đích không đọc qua các endpoint REST có sẵn (R1).
- FR-024: người tạo và thời điểm tạo không được chép, đích tự ghi; trước là "đặt rỗng" (R10).
- FR-025: trên Postgres cấu trúc và dòng chung một transaction; index tạo và xóa sau commit (R4, R10).
- FR-021, US4 kịch bản 5, Edge Cases: hệ quả thật của xóa role, policy, folder (R8).
- FR-007 nhóm 1: không gồm cờ index trên field hệ thống (R3).
- FR-034: trình duyệt vẫn có thể đề nghị lưu token (R12).
- FR-026: lượt áp dụng thứ hai có thể chờ khoảng 5 giây trước khi nhận lỗi (R6).
- Edge Cases: URL trỏ về chính đích qua `localhost` bị chặn (R2); token sai ở nguồn là 400 ở đích (R11); trùng khóa so
  khớp ở một bên (data-model).

### Sửa khi `/speckit.checklist` (2026-11-14, api-compat 12, security 14, data-safety 14 mục; 19 phát hiện)

- FR-003: URL và token chỉ trong thân request. FR-004: từ chối URL có tên người dùng, mật khẩu; nêu
  `IMPORT_IP_DENY_LIST` và kiểm sau khi phân giải tên; không theo mọi chuyển hướng (trước là "sang host khác"); 30 giây,
  100 MB; thông báo lỗi do đích đặt. FR-005: kiểm trước khi đọc dữ liệu.
- FR-017: dòng khớp theo định danh giữ định danh của nguồn; operation và panel theo flow và dashboard; ngoại lệ xóa kèm.
  FR-020: chiều ngược (xóa kèm, có tên trong hộp xác nhận) và máy chủ kiểm lại. SC-002 theo đó.
- FR-022: chỉ giá trị được so làm so sánh cũ; kiểm sau khi giữ khóa. FR-025: lỗi ở bước sau khi ghi. FR-029: Directus
  dùng chung Redis. FR-037: chỉ REST. FR-040: khuyên https.
- Edge Cases: chuyển hướng, đích chưa có dòng settings, index lỗi. Assumptions: mô hình tin cậy.

### Xem lại sửa của checklist (chủ dự án, 2026-11-14)

- Bốn sửa có lựa chọn, chủ dự án chọn cả bốn theo đề xuất: xóa kèm tự tick, khóa và có tên trong hộp xác nhận (FR-020);
  không theo mọi chuyển hướng (FR-004); 30 giây và 100 MB là hằng số, không biến môi trường mới (FR-004); lỗi ở bước sau
  khi ghi trả thành công kèm cảnh báo (FR-025).
- Mười lăm sửa còn lại (câu chữ hoặc hệ quả bắt buộc) đã trình bày cùng lượt; chủ dự án không phản đối.

### Sửa khi `/speckit.analyze` (2026-11-14: 0 CRITICAL, 2 HIGH, 4 MEDIUM, 5 LOW; chủ dự án: "sửa tất cả")

- E1 (HIGH): node đích của profile `sync` dựng từ cấu hình của cặp chính (cùng extension, cùng `MIGRATIONS_PATH`), không
  từ profile `bootstrap` (tasks T002 và checkpoint Phase 1).
- C1 (HIGH): thêm T040a kiểm Directus trên cùng DB đọc, sửa được dòng do đồng bộ ghi và cache của Directus được xóa
  (FR-029, US6 kịch bản 3, SC-007).
- I1: FR-026 nói rõ lượt thứ hai chờ rồi lỗi, hoặc chạy và bị kiểm so sánh cũ; T039 tách cùng node và khác node.
- E2: T028 kiểm khóa giữ trước khi so hash; T008 kiểm cờ trong process. E3: T017 nguồn là chính đích, T039 thu hồi
  token. U1: target `test` đã chặn ngưỡng coverage (`vitest.shared.ts:26-32`), ghi vào T026, T042, T068.
- LOW: FR-020 tách bốn ý (A1); Key Entities thêm danh sách xóa kèm (I2); data-model bỏ dòng folder lặp (D1); T047 kiểm ô
  token (E4); T021 kiểm OAS (E5).

## Assumptions

- Chỉ kéo: môi trường nguồn không bao giờ bị ghi. Muốn đưa cấu hình theo chiều ngược lại thì đứng ở môi trường kia.
- Nguồn là một Backoffice có feature này và cùng phiên bản với đích; nguồn là Directus thuần bị từ chối.
- Mô hình tin cậy (checklist 2026-11-14): nguồn được tin như admin của đích. Một nguồn bị chiếm có thể đưa vào đích flow
  chạy script, quyền rộng hay thay đổi cấu trúc; chốt chặn là admin đọc bảng so sánh và hộp xác nhận trước khi áp dụng.
  Tính năng cho admin khiến máy chủ đích gọi tới một URL tùy ý, cùng mức với import file từ URL hiện có; biện pháp là
  danh sách chặn `IMPORT_IP_DENY_LIST` và việc chỉ admin dùng được.
- Máy chủ của đích gọi được tới URL của nguồn qua mạng; việc mở mạng giữa các môi trường là việc vận hành, ngoài phạm
  vi.
- Token admin của nguồn đi qua trình duyệt của admin và máy chủ đích ở mỗi lượt so sánh và áp dụng; admin chịu trách
  nhiệm về token đó. Không lưu nên không có việc xoay vòng hay thu hồi phía Backoffice.
- Ba môi trường của chủ dự án đều là Postgres. Feature chỉ được đo trên Postgres; trên vendor khác tính năng không bị
  chặn nhưng ghi "chưa đo" (clarify 2026-11-14).
- Không đồng bộ: users, liên kết user với policy, nội dung file, item của collection người dùng, activity, revisions,
  sessions, notifications, comments, shares, preset theo role hay user, file extension.
- Không có: chiều đẩy, lưu môi trường, lịch sử đồng bộ, chạy theo lịch, file gói cấu hình, lệnh CLI, đăng nhập nguồn
  bằng email và mật khẩu.
- Flow được kéo nguyên như nguồn, gồm mọi giá trị trong cấu hình operation (URL, token ghi cứng nếu có). Tính năng không
  kiểm flow có tham chiếu collection hay extension chưa có ở đích.
- Không có bản ghi riêng cho lượt đồng bộ; dấu vết duy nhất là activity và revision của từng dòng (FR-028).
- Mục tiêu thời gian của SC-006 là ước lượng ban đầu; plan đo và chỉnh nếu cần.
- Thao tác mới đi qua rate limiter, CORS và cookie session như các thao tác `/backoffice/` khác; không ngoại lệ.

**Câu chờ `/speckit.clarify`**: năm câu đã được trả lời 2026-11-14, xem Clarifications.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin ở môi trường đích kéo được một flow, một collection, một policy kèm permission và một field settings
  từ nguồn trong dưới 5 phút, không sửa tay ở đích, bằng chuột và bằng bàn phím; đạt trong 100% lần thử ở E2E
  `proxy-api` và `cors`; mục menu ẩn ở `proxy-directus`.
- **SC-002**: Sau mỗi lượt áp dụng, 100% dòng không được tick và dòng "giống nhau" ở đích không đổi (so trước và sau),
  trừ dòng bị xóa kèm đã có tên trong hộp xác nhận (FR-020).
- **SC-003**: 100% trường hợp bị từ chối (lệch phiên bản, nguồn là Directus thuần, token sai, URL không tới được, địa
  chỉ bị chặn, user thường, so sánh cũ, hai lượt cùng lúc) không đổi gì ở đích và hiện lý do.
- **SC-004**: Sau một lỗi giữa chừng khi áp dụng, 0 dòng dữ liệu của lượt đó còn lại ở đích.
- **SC-005**: Sau khi rời trang, URL và token của nguồn có ở 0 nơi: DB, log máy chủ, activity, revision, thông báo lỗi,
  bộ nhớ trình duyệt.
- **SC-006**: Với một nguồn có 200 collection, 100 flow và 2.000 permission, bảng so sánh hiện trong dưới 30 giây và
  admin tìm được một dòng theo trạng thái trong dưới 1 phút.
- **SC-007**: 0 test đối chiếu, blackbox và E2E hiện có đổi kết quả; Directus trên cùng DB đọc và sửa được các dòng do
  đồng bộ ghi.
- **SC-008**: Màn hình đồng bộ không có vi phạm axe mức serious trở lên; mọi thao tác làm được bằng bàn phím.
