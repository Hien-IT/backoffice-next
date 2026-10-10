# Checklist chất lượng yêu cầu: Xác thực và phiên đăng nhập (003)

**Purpose**: Kiểm chất lượng của yêu cầu (đủ, rõ, nhất quán, đo được) trong spec, plan và contracts của 003, trước khi
chạy `/speckit.tasks`. Checklist này kiểm phần viết, không kiểm code.
**Created**: 2026-10-10
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [contracts/](../contracts/)
**Phạm vi**: bảo mật, tương thích Directus, dữ liệu DB, vận hành. Mức chuẩn. Người dùng: reviewer khi duyệt spec và plan.

## Bảo mật

- [x] CHK001 - FR-010 ghi "cùng thuật toán" mà không nêu tên thuật toán ký JWT. Spec có cần nêu thẳng (HS256), để
  reviewer kiểm được mà không phải đọc code Directus? [Clarity, Spec §FR-010]
- [x] CHK002 - FR-062 cho phép ghi email người nhận vào log. Spec có nêu rõ việc này chấp nhận được về dữ liệu cá nhân
  (email là PII), hay cần che một phần email? [Ambiguity, Spec §FR-062]
- [x] CHK003 - Việc che `authorization`, `cookie`, `set-cookie`, `access_token` trong log chỉ ghi ở
  contracts/startup-logs.md. Spec có cần một yêu cầu riêng, để token không bao giờ xuất hiện trong log của các luồng
  mới? [Gap, Spec §FR-062]
- [x] CHK004 - Rate limiter theo IP của 001 có áp dụng cho `/auth/login`, `/auth/refresh`, `/auth/password/*` không?
  Quan hệ giữa nó và bộ đếm theo user (FR-041) có được ghi rõ không? [Gap, Spec §FR-041]
- [x] CHK005 - Mọi nhánh phải chờ `LOGIN_STALL_TIME` và mọi nhánh không chờ đã được liệt kê đủ, ở cả `/auth/login` của
  LDAP (không chờ khi lỗi payload) lẫn `/auth/refresh`? [Completeness, Spec §FR-040, contracts/auth-api.md §2.1]
- [x] CHK006 - SC-003 đo "email không có" so với "sai mật khẩu". Có cần đo thêm cặp "user không `active`" và "OTP sai",
  vì cả hai cũng là cách dò tài khoản? [Coverage, Spec §SC-003]
- [x] CHK007 - Việc dùng lại cùng một mã OTP trong cửa sổ hợp lệ có được ghi là cố ý giống Directus (không chặn), hay
  đang bị bỏ sót? [Gap, Spec §FR-053]
- [x] CHK008 - Quy tắc kiểm `redirect` của SSO (URL tương đối, `//host`, giao thức khác `http(s)`, allow list) có được
  nêu đủ trong spec, hay chỉ dẫn tên hàm `resolveLoginRedirect`? [Clarity, Spec §FR-072]
- [x] CHK009 - Thuộc tính `Secure`, `SameSite`, `HttpOnly` mặc định của mọi cookie (refresh, session, `openid.<p>`,
  `oauth2.<p>`) có được ghi cùng giá trị ở spec và contracts? [Consistency, Spec §FR-004, contracts/auth-api.md §4]
- [x] CHK010 - Spec có nêu hành vi khi static token trùng giữa hai user, và nói rõ đó là cố ý giống Directus? [Edge
  Case, Spec §Edge Cases]
- [x] CHK011 - Việc access token đã cấp vẫn dùng được sau khi user bị khóa hoặc đổi mật khẩu (tới khi hết hạn) có được
  ghi là rủi ro đã chấp nhận, kèm thời hạn tối đa (`ACCESS_TOKEN_TTL`)? [Assumption, Spec §US3.7, §Edge Cases]
- [x] CHK012 - Yêu cầu escape giá trị khi tìm user trên LDAP (chống LDAP injection) có được nêu đủ để kiểm, hay chỉ
  ghi "có escape giá trị"? [Clarity, Spec §FR-077]

## Tương thích Directus

- [x] CHK013 - Header `Set-Cookie` khi xóa cookie (cookie rỗng còn `Max-Age`, như Express 4.21.2) chỉ có ở plan và
  contracts. Spec có cần một yêu cầu thẳng cho chi tiết này, vì SC-001 so thuộc tính `Set-Cookie`? [Gap, Spec §FR-022,
  §SC-001]
- [x] CHK014 - Hành vi `OPTIONS` và `HEAD` của các route mới (header `Allow`) chỉ có ở contracts/auth-api.md §6. Spec
  có cần yêu cầu tương ứng như FR-048 của 001? [Gap]
- [x] CHK015 - Việc so tên provider không phân biệt hoa thường trong `/auth/login/<provider>` có được nêu ở spec?
  [Gap, Spec §FR-001, §FR-072]
- [x] CHK016 - Body của `/auth/login` chế độ `session` khác nhau giữa driver `local` (chỉ `expires`) và `ldap` (có
  `access_token`). Spec có nêu khác biệt này, hay chỉ ghi "response giống `/auth/login`"? [Consistency, Spec §US7.4,
  contracts/auth-api.md §3]
- [x] CHK017 - Danh sách mã lỗi và status của mọi endpoint mới có đủ ở một nơi, và spec với contracts/auth-api.md §2.1
  có khớp nhau? [Consistency, Spec §FR-031, §FR-060, §FR-061]
- [x] CHK018 - "Message giống Directus" có được định nghĩa là so từng chữ (đo được bằng test đối chiếu)? [Measurability,
  Spec §US1.7]
- [x] CHK019 - D-10 (giữ tới 004) và US3.8 có nêu cùng một danh sách route bỏ qua token? Danh sách route xác thực token
  ở FR-030 có khớp D-10 và D-09.10? [Consistency, Spec §FR-030, §FR-032, Khác biệt]
- [x] CHK020 - Mỗi khác biệt D-23 đến D-26 và D-09.10 có đủ cột "Gỡ khi" và lý do, theo cách test
  `accepted-differences` cần? [Completeness, Spec §Khác biệt]
- [x] CHK021 - D-24 lọc `saml` khỏi `GET /auth` nhưng giữ nguyên danh sách provider trong option của field
  `directus_users.provider`. Spec có ghi điều này để 006 không bị lệch? [Gap, Spec §FR-075, D-24]
- [x] CHK022 - Ma trận dùng chéo (FR-101) có liệt kê đủ loại token, gồm session của share và cookie trạng thái SSO
  dùng ở instance khác? [Coverage, Spec §FR-101, §SC-002]
- [x] CHK023 - Phần blackbox phải chạy lại ở 004 (ca gọi `/users/me`) có được ghi thành phụ thuộc rõ, để 004 không bỏ
  sót? [Dependency, Spec §FR-100]

## Dữ liệu DB

- [x] CHK024 - SC-005 không nêu vendor nào phải đạt, trong khi plan ghi Postgres, MySQL, SQLite. Spec có cần nêu thẳng
  danh sách vendor? [Clarity, Spec §SC-005]
- [x] CHK025 - Cách so `data` và `delta` của revision (parse JSON, không so thứ tự key) có được nêu ở spec, hay chỉ ở
  research R6? [Clarity, Spec §SC-005]
- [x] CHK026 - Việc SSO có `SYNC_USER_INFO` xóa mọi session của user ở mỗi lần đăng nhập (giống Directus) có được nêu ở
  spec? [Gap, Spec §FR-073, contracts/db-writes.md §7]
- [x] CHK027 - Việc SSO đổi `role` gọi xóa cache hệ thống ở mỗi lần đăng nhập có được nêu, kèm ảnh hưởng hiệu năng?
  [Gap, Spec §FR-073]
- [x] CHK028 - Spec có định nghĩa hành vi khi một bước ghi lỗi giữa chừng (ví dụ đã thêm session nhưng ghi activity
  lỗi), và nói rõ là giống Directus, không rollback? [Gap, Recovery]
- [x] CHK029 - Chi tiết "revision khi khóa user ghi `status: active` trong `data`" có được nêu là cố ý giống Directus, để
  reviewer không coi là lỗi? [Clarity, Spec §US4.4, contracts/db-writes.md §3]
- [x] CHK030 - Danh sách cột `directus_users` app mới được ghi ở FR-080 có khớp contracts/db-writes.md §1–§7? [Consistency,
  Spec §FR-080]
- [x] CHK031 - Refresh đồng thời ở chế độ `session` trên hai app (FR-021) có tiêu chí đo được, ví dụ cùng session mới
  trong 100% lần thử? [Measurability, Spec §US2.3]
- [x] CHK032 - Có yêu cầu nào giới hạn việc dọn session hết hạn ở mỗi lần đăng nhập, khi bảng `directus_sessions` lớn ở
  quy mô thiết kế? [Gap, Non-Functional]

## Vận hành

- [x] CHK033 - SC-006 ghi "đúng 1 dòng cảnh báo cho mỗi provider bị bỏ qua", trong khi biến `AUTH_<P>_IDP*`,
  `AUTH_<P>_SP*` còn nằm trong dòng "biến chưa hỗ trợ" chung. Hai yêu cầu này có mâu thuẫn không? [Conflict, Spec
  §SC-006, contracts/config.md §2]
- [x] CHK034 - Hướng dẫn vận hành cho hệ thống có user SAML (định tuyến `/auth/*` của họ về Directus) có được ghi thành
  yêu cầu tài liệu, hay chỉ nằm trong bảng D-24? [Gap, Spec §FR-078]
- [x] CHK035 - Hành vi khi IdP OpenID không truy cập được lúc khởi động ở nhiều replica cùng lúc (process thoát, có thể
  khởi động lại liên tục) có được ghi là rủi ro vận hành đã chấp nhận? [Edge Case, Spec §Edge Cases]
- [x] CHK036 - SC-007 nói "một request mang access token" nhưng spec không nêu endpoint nào (plan chọn
  `POST /users/me/tfa/generate`). Endpoint đo có cần ghi vào spec? [Clarity, Spec §SC-007]
- [x] CHK037 - SC-007 có nêu cách xử lý request còn dở hoặc timeout ở 2.000 kết nối (tính là lỗi hay không), để cổng
  benchmark đo được khách quan? [Measurability, Spec §SC-007]
- [x] CHK038 - Có yêu cầu về thời gian chạy tối đa của CI (parity với profile `sso`, test thời gian chờ, job benchmark
  mới) không? [Gap, Non-Functional]
- [x] CHK039 - Spec có nêu việc đóng kết nối LDAP và client của IdP khi SIGTERM, như yêu cầu tắt an toàn của Nguyên tắc
  VII? [Gap, Spec §FR-070]
- [x] CHK040 - Việc không thêm metric cho auth (Directus không có) có được ghi là cố ý? [Gap, Non-Functional]
- [x] CHK041 - Phụ thuộc vào việc tech lead duyệt constitution 1.3.0 (OAuth2, LDAP vào phạm vi) có được ghi là điều kiện
  trước khi merge? [Assumption, Spec §Clarifications]
- [x] CHK042 - Cảnh báo một instance khi `RATE_LIMITER_STORE=memory` (FR-041) có được ghi đúng cả ở spec, contracts và
  danh sách cảnh báo của 001, không mâu thuẫn với dòng 5 cũ? [Consistency, Spec §FR-041, contracts/config.md §3]

## Notes

- Đánh dấu `[x]` khi mục đạt. Mục không đạt thì sửa spec, plan hoặc contracts, rồi ghi ngắn lý do ở đây.
- Xử lý ngày 2026-10-10 (sửa spec):
  - CHK001: FR-010 nêu HS256.
  - CHK002: đã chốt ở Clarifications (Q log quên mật khẩu = A: ghi email, không ghi token).
  - CHK004: FR-041 nêu rate limiter IP và toàn cục áp dụng cho route auth.
  - CHK013: thêm FR-024. CHK014: thêm FR-034. CHK015: thêm FR-079.
  - CHK016: US7.4 nêu body chế độ `session` của LDAP.
  - CHK024, CHK025: SC-005 nêu vendor và cách so JSON.
  - CHK026, CHK027: FR-073 nêu việc xóa session và xóa cache hệ thống khi SSO. Chưa định lượng ảnh hưởng hiệu năng.
  - CHK033: SC-006 tách dòng cảnh báo provider khỏi dòng "biến chưa hỗ trợ".
  - CHK036, CHK037: SC-007 nêu endpoint đo và cách tính lỗi.
  - CHK021: FR-075 nêu chỉ `GET /auth` lọc `saml`. CHK028: Edge Cases nêu hành vi khi ghi DB lỗi giữa chừng
    (sau `/speckit.analyze`).
- Rà lần 2 ngày 2026-10-10 (trước `/speckit.implement`), sửa spec và tasks:
  - CHK003: thêm FR-063 (không log token, mật khẩu, OTP); T068 kiểm.
  - CHK005: FR-040 nêu nhánh không chờ (rate limiter `503`, lỗi payload của LDAP) và 500 ms của `password/request`.
  - CHK006: SC-003 nói rõ nhánh khác chỉ kiểm ngưỡng tối thiểu.
  - CHK007: Edge Cases nêu OTP dùng lại được chấp nhận như Directus.
  - CHK008, CHK009: FR-072 nêu quy tắc `redirect` và thuộc tính cookie trạng thái SSO.
  - CHK010: đạt sẵn (Edge Cases: static token trùng).
  - CHK011: Edge Cases nêu thời hạn tối đa `ACCESS_TOKEN_TTL`, rủi ro đã chấp nhận.
  - CHK012: FR-077 nêu cách escape (RFC 4515, `escapeFilterValue`, `validateLDAPAttribute`).
  - CHK017: đầu mục Functional Requirements chỉ contracts/auth-api.md §2.1 là danh sách lỗi đầy đủ.
  - CHK018: đạt sẵn (SC-001 so body 100%, gồm message).
  - CHK019: dòng D-10 liệt kê route giữ và route mới, khớp FR-030 và US3.8.
  - CHK020: thêm dòng D-09.10 (gỡ ở 005) vào bảng khác biệt mới.
  - CHK022: FR-101 và T039 thêm session của share.
  - CHK023: đạt sẵn (FR-100: chạy lại nguyên bản ở 004).
  - CHK029: US4.4 nêu `data` của revision còn `status: active`, giống Directus.
  - CHK030: FR-080 thêm `role`, `first_name`, `last_name`, `email`.
  - CHK031: US2.3 và T033: 100% của ít nhất 10 lần thử.
  - CHK032, CHK034, CHK039, CHK040, CHK041: thêm vào Assumptions.
  - CHK035: Edge Cases nêu rủi ro nhiều replica thoát khi IdP lỗi.
  - CHK038: cố ý không đặt yêu cầu thời gian CI (constitution không có); theo dõi ở bảng rủi ro của plan, T066.
  - CHK042: đạt sẵn (FR-041, contracts/config.md §3; T071 sửa dòng 5 của contract 001).
- Mỗi lần chạy `/speckit.checklist` tạo một file mới; file này không thay `requirements.md`.
