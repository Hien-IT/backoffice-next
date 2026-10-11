# Formal Requirements Review Checklist: Phân quyền (users, roles, policies, access, permissions)

**Purpose**: Kiểm chất lượng yêu cầu (đầy đủ, rõ, nhất quán, đo được) của spec 004 trước khi chia task. Không kiểm cài
đặt. Mỗi mục là một câu hỏi về nội dung spec; mục không đạt thì sửa spec rồi mới chạy `/speckit.tasks`.
**Created**: 2026-10-11
**Feature**: [spec.md](../spec.md)
**Depth**: Formal (cổng trước `/speckit.implement`, người rà thứ hai). **Focus**: A bảo mật và kiểm quyền, B tương thích
và tiêu chí kiểm, C cache dùng chung, D hợp đồng API, E mời, đăng ký, TFA, `directus_users`.
**Ngoài phạm vi checklist này**: FR-106 (reverse proxy, Playwright), SC-006 và SC-008 (benchmark, E2E app Directus).

**Ghi chú ưu tiên**: `[P1]` là mục có rủi ro bảo mật hoặc dễ làm sai tiêu chí chấp nhận nếu để mơ hồ; nên giải quyết
trước. Mục `[Conflict]` và `[Gap]` đã đối chiếu với spec, plan và code Directus 11.17.4 khi viết checklist.

## A. Kiểm quyền và bảo mật (FR-001 đến FR-034, FR-052, FR-054)

- [x] CHK001 (đã giải: FR-002, US1.7) [P1] Spec có nêu rõ nguồn của từng trường accountability theo loại token (claim JWT `role` giữ nguyên tới
  khi refresh; `directus_users.role` với static token; `admin`, `app` tính lại mỗi request), và kết quả của user bị
  đổi role khi còn access token chưa hết hạn không? [Ambiguity, Spec §FR-002, US1.3]
- [x] CHK002 (đã giải: FR-016, R-02) [P1] Việc tái tạo chỗ Directus xử lý IP không nhất quán (bỏ policy có `ip_access` khi không có IP, nhưng cờ
  `admin`, `app` vẫn tính policy đó) đã được ghi kèm hệ quả bảo mật và người duyệt chưa? [Conflict, Spec §FR-010,
  FR-011, Edge Cases]
- [x] CHK003 (đã giải: FR-016, US2.7) [P1] Phạm vi lọc IP có được nêu nhất quán cho mọi nơi dùng (danh sách policy, cờ `admin`/`app`,
  `enforce_tfa` của `/policies/me/globals`, claim `enforce_tfa` của JWT), thay vì chỉ "policy bị bỏ qua khi tính
  quyền"? [Consistency, Spec §US2.7, FR-011, FR-046]
- [x] CHK004 (đã giải: FR-002 (`ip`)) Điều kiện để `ip` được coi là "không xác định" (proxy tin cậy, header tùy chỉnh, địa chỉ IPv4 nhúng IPv6) có
  được quy định hoặc dẫn chiếu tới yêu cầu của feature 001 không? [Gap, Spec §FR-002]
- [x] CHK005 (đã giải: R-01, đã kiểm `fetch-global-access.ts:14-18`; tái tạo theo Clarifications) [P1] Nhận định "Directus không đưa IP vào key `global-access`" (suy ra từ đọc code) đã được kiểm chứng chưa, và
  hệ quả với policy giới hạn IP có được ghi là yêu cầu hay rủi ro chấp nhận không? [Assumption, Spec §FR-080]
- [ ] CHK006 Các quy tắc gộp nhiều permission cùng collection và action (filter OR, field hợp, validation AND, preset gộp
  nông theo thứ tự policy) có được viết ở một chỗ trong spec, thay vì rải ở US2, FR-021, FR-022, FR-030? [Clarity,
  Spec §FR-021, FR-022, FR-030]
- [ ] CHK007 Yêu cầu có nêu kết quả khi sửa hoặc xóa khóa không tồn tại (admin và không phải admin) để không có khác biệt
  gây lộ sự tồn tại giữa đường đọc (`403`) và đường ghi không? [Coverage, Gap, Spec §FR-023, FR-031, FR-032]
- [x] CHK008 (đã giải: FR-035) [P1] Quy tắc tự sửa trường đặc quyền (`role`, `status`, policy gắn vào chính mình qua `/users/me` hoặc ghi lồng)
  có được nêu là chỉ dựa vào permission, và có ca nghịch cho leo thang đặc quyền không? [Coverage, Gap, Spec §FR-043,
  FR-101]
- [ ] CHK009 Quyền cần có ở từng tầng của ghi lồng (tạo, sửa, gỡ liên kết theo `one_deselect_action`, xóa) có được viết theo
  collection và action, ví dụ `PATCH /roles/:id` với `policies` hoặc `users`? [Clarity, Spec §FR-040, FR-070]
- [x] CHK010 (đã giải: D-31) [P1] D-31 có giới hạn danh sách collection thực sự với tới được từ quan hệ của năm collection (kể cả quan hệ
  người dùng thêm vào `directus_users`) và đánh giá hệ quả khi bỏ kiểm tra riêng của service không? [Coverage,
  Spec §D-31, FR-101]
- [x] CHK011 (đã giải: FR-092) [P1] Có yêu cầu che thông tin nhạy cảm (hash mật khẩu, static token, `tfa_secret`, OTP, token mời và xác minh) trong
  activity, revision và log, và yêu cầu về dữ liệu cá nhân (email) trong dòng log thay email không? [Gap, Spec §FR-051,
  FR-061, FR-090]
- [ ] CHK012 Hành vi khi cây role có vòng (dữ liệu ghi thẳng DB) có nêu status, mã lỗi và ảnh hưởng tới mọi request của user
  liên quan, thay vì chỉ "báo lỗi giống Directus"? [Clarity, Spec §Edge Cases]
- [ ] CHK013 Giới hạn quy mô của quyền (độ sâu cây role, số policy mỗi user, số permission mỗi policy) có được nêu hoặc ghi
  rõ là không giới hạn như Directus? [Gap, NFR, Spec §FR-010, FR-012]
- [ ] CHK014 Khi ghi nhiều item (`createMany`, `PATCH`/`DELETE` theo lô), yêu cầu có nêu tính nguyên tử (tất cả hoặc không có
  gì) và hành vi khi một phần tử bị chặn không? [Completeness, Edge Case, Spec §FR-040, FR-041]
- [ ] CHK015 Mục "tính toàn vẹn số user" có nêu hành vi khi hai thao tác chạy đồng thời (hai admin cùng xóa nhau, hai request
  cùng tạo admin ở sát giới hạn) hay ghi rõ là ngoài phạm vi? [Gap, Edge Case, Spec §FR-054]

## B. Tương thích Directus và tiêu chí kiểm (FR-100 đến FR-105, SC-001 đến SC-005, Khác biệt)

- [x] CHK016 (đã giải: SC-001) [P1] "Giống Directus" trong SC-001 có được cụ thể hóa cho mọi phần của response (status, mã lỗi, message, body,
  header như `Allow`, `Cache-Control`, `Vary`, `Location`, `Retry-After`, `Set-Cookie`) và tác động DB, hay chỉ
  một số? [Measurability, Spec §SC-001]
- [ ] CHK017 Quy tắc coi hai kết quả là bằng nhau có được định nghĩa (giá trị ngẫu nhiên, dung sai thời điểm, thứ tự key
  JSON, thứ tự phần tử mảng khi truy vấn không có `sort`)? [Clarity, Spec §SC-001, SC-004, SC-005]
- [x] CHK018 (đã giải: FR-101, SC-001 (tích đầy đủ)) [P1] "Ô" của ma trận quyền (FR-101) có quy tắc phủ (tích đầy đủ, theo cặp, hay đại diện), và bộ rút gọn trên MySQL,
  SQLite có tiêu chí vượt "ít nhất một ô mỗi nhóm" không? [Measurability, Spec §FR-101, SC-001]
- [ ] CHK019 "Query đủ loại" ở FR-103 có được liệt kê hoặc gắn với danh sách tính năng query, endpoint và loại user đo được
  không? [Ambiguity, Spec §FR-103, FR-040]
- [ ] CHK020 Yêu cầu có nêu thứ tự mặc định của danh sách không `sort` (khóa chính, trường `sort`, và với người không phải
  admin là field đầu được phép), vì so body phụ thuộc thứ tự? [Gap, Spec §FR-040, FR-021]
- [ ] CHK021 Ca phụ thuộc thời gian (`$NOW`, ranh giới `-1 day`) có quy tắc để hai app được so "tại cùng thời điểm" (đồng hồ cố
  định, dung sai, hay dữ liệu cách xa ranh giới) không? [Gap, Spec §US2.3, FR-013]
- [x] CHK022 (đã giải: Assumptions, bảng Rủi ro chấp nhận) [P1] Spec có đường xử lý khi hành vi của Directus không an toàn hoặc là lỗi (tái tạo, hay lệch có duyệt), thay vì chỉ
  "khi spec không nói rõ thì làm như Directus"? [Gap, Spec §Assumptions, Khác biệt so với Directus]
- [x] CHK023 (đã giải: FR-100) [P1] FR-100 ("port `common/common.test.ts`") có mâu thuẫn với phạm vi vì file đó còn ca tạo collection, field,
  item, xóa field dùng `/collections`, `/fields` của feature 006 (D-09.4) không, và phần nào được port đã xác định
  chưa? [Conflict, Spec §FR-100, D-09.4]
- [x] CHK024 (đã giải: SC-005) SC-005 có liệt kê đủ luồng ghi (bật, tắt TFA, `track/page`, các bước xóa dây chuyền khi xóa role, xóa policy do
  khóa ngoại, ghi lồng) hay chỉ CRUD, mời, đăng ký, xác minh? [Coverage, Gap, Spec §SC-005, FR-048, FR-070]
- [ ] CHK025 Tiêu chí đạt của FR-105 (chạy lại bộ 003) có gắn với đường cơ sở, gồm các ca được phép bỏ qua theo vendor (ví dụ
  refresh đồng thời trên MySQL)? [Measurability, Spec §FR-105]
- [ ] CHK026 Các acceptance scenario của US1 đến US7 có truy được tới FR tương ứng (ví dụ US2.3 tới FR-013), để biết mỗi FR có
  ca chấp nhận chưa? [Traceability, Spec §User Scenarios, Requirements]
- [ ] CHK027 Các khác biệt D-09.2, D-10, D-09.10, D-11, D-12, D-27 đến D-31 có nêu "gỡ khi" khớp với bảng của spec 001 và 003
  đang bị sửa, và ai duyệt, trong chính spec 004 không? [Consistency, Spec §Khác biệt so với Directus]

## C. Cache dùng chung và chạy song song (FR-014, FR-071 đến FR-073, FR-080 đến FR-083, US7, SC-003, SC-004)

- [x] CHK028 (đã giải: Key Entities, "Các loại cache") [P1] Các loại cache (cache hệ thống, cache quyền, cache dữ liệu hay response cache, cache schema, lớp bộ nhớ process)
  có được định nghĩa một lần và dùng nhất quán ở FR-014, FR-071 đến FR-073, FR-081 đến FR-083 không? [Consistency,
  Terminology]
- [x] CHK029 (đã giải: FR-071 đến FR-073 dẫn về FR-082) [P1] FR-071 và FR-072 (chỉ nêu cache hệ thống và cache quyền) có mâu thuẫn với FR-073 và FR-083 (thêm cache dữ
  liệu) cho thao tác ghi policy, access không? [Conflict, Spec §FR-071, FR-072, FR-073, FR-083]
- [x] CHK030 (đã giải: FR-084) [P1] Yêu cầu có nêu khi `CACHE_STORE=memory` hoặc không có Redis: FR-080 đến FR-083 áp dụng thế nào, khi xóa cache dữ
  liệu của Directus qua Redis không thực hiện được? [Gap, Spec §FR-081, FR-083]
- [x] CHK031 (đã giải: FR-085, R-03) [P1] Khi Redis không dùng được lúc đọc, ghi hoặc xóa cache sau khi ghi quyền, kết quả yêu cầu là gì (request lỗi hay
  thành công kèm quyền cũ), và thời gian quyền cũ tồn tại có giới hạn không? [Exception Flow, Gap, Spec §FR-081,
  FR-082]
- [x] CHK032 (đã giải: SC-003) [P1] Tiêu chí "request đầu tiên sau response" ở SC-003 có phù hợp với việc Directus xóa bản trong bộ nhớ process qua
  bus bất đồng bộ, và đã được xác nhận giữa hai instance Directus chưa? [Measurability, Assumption, Spec §SC-003]
- [ ] CHK033 Quy tắc tạo key (thứ tự tham số, `null` với `undefined`, thứ tự mảng, định dạng ngày) và quy tắc coi giá trị hai bên là
  bằng nhau có được nêu cho cả 8 namespace, gồm hai namespace mới? [Clarity, Spec §FR-080, SC-004]
- [x] CHK034 (đã giải: FR-082 (ghi lồng)) Yêu cầu xóa cache có áp dụng cho ghi đi gián tiếp tới access, permissions, policies, roles (ghi lồng từ payload của
  `/policies`, `/roles`, `/users`) hay chỉ ghi trực tiếp vào endpoint của chúng? [Coverage, Gap, Spec §FR-040, FR-082]
- [ ] CHK035 Có yêu cầu hoặc ghi chú về cuộc đua giữa lần xóa cache và một lần đọc cũ ghi lại vào cache (hai app đổi quyền cùng
  lúc, hoặc đọc chậm sau lần xóa)? [Gap, Edge Case, Spec §US7, FR-082]
- [ ] CHK036 Thời gian sống của dữ liệu cho biến động (`filter-context-*` theo `CACHE_TTL`, không bị xóa khi field user đổi
  nếu không bật auto-purge) có được nêu là hành vi cần giữ và có ca chấp nhận tương ứng? [Clarity, Spec §FR-014]

## D. Hợp đồng API và lỗi (FR-001, FR-004, FR-040 đến FR-048, Edge Cases)

- [x] CHK037 (đã giải: FR-005) [P1] Thứ tự ưu tiên giữa lỗi token (`401`, `403`), lỗi query (`400 INVALID_QUERY`), lỗi body (`400 INVALID_PAYLOAD`),
  lỗi quyền (`403`) khi một request có nhiều lỗi có được nêu ngoài FR-033 (chỉ cho đường ghi)? [Completeness, Spec §FR-033,
  FR-040, Edge Cases]
- [x] CHK038 (đã giải: FR-047) [P1] Kết quả của `GET /<x>/<pk kết thúc bằng me>` (ví dụ `GET /access/me`, `GET /users/some`) có được nêu bằng giá
  trị cụ thể (Directus trả `204` không body) thay vì "giống Directus"? [Ambiguity, Spec §FR-042, FR-047]
- [x] CHK039 (đã giải: FR-004) Các path trước `authenticate` ở Directus (`/server/ping`, `/`, `/robots.txt`) có được liệt kê như ngoại lệ của
  "mọi request đi qua `authenticate`"? [Clarity, Spec §FR-001, FR-004]
- [ ] CHK040 `OPTIONS`, `HEAD` và dấu `/` cuối path (`/me/tfa/generate/`) có được nêu trong spec, không chỉ trong contract của plan?
  [Gap, Spec §FR-041, FR-047]
- [ ] CHK041 Yêu cầu đọc lại sau ghi có nêu truy vấn dùng, thứ tự phần tử trả về của ghi nhiều, và trường hợp đọc lại không ra dòng nào
  (khác `403`)? [Clarity, Spec §FR-041]
- [ ] CHK042 Việc `/permissions` luôn dùng `limit: -1` có được nêu cho mọi đường đọc (`GET /`, `SEARCH /`, đọc lại sau ghi, `GET
  /:pk`)? [Ambiguity, Spec §FR-042, US3.7]
- [ ] CHK043 `SEARCH` có quy tắc kiểm body cụ thể (kiểu của `keys`, độ ưu tiên giữa `body.query` và query string, lỗi khi cả hai
  sai)? [Clarity, Spec §FR-041]
- [ ] CHK044 Khóa chính sai kiểu (`PATCH /policies/me`, id không phải uuid) có được nêu là `403` thay vì `400` hoặc `404`?
  [Gap, Spec §FR-041, FR-042]
- [ ] CHK045 Cách tính `meta` (`total_count`, `filter_count`) cho người không phải admin có được nêu (đếm theo filter quyền), thay
  vì chỉ "giống Directus"? [Ambiguity, Spec §FR-023]
- [x] CHK046 (đã giải: FR-095) Các biến quy định giới hạn query (`QUERY_LIMIT_DEFAULT`, `QUERY_LIMIT_MAX`, `MAX_RELATIONAL_DEPTH`,
  `RELATIONAL_BATCH_SIZE`, `MAX_JSON_QUERY_DEPTH`, `QUERYSTRING_*`) có nằm trong yêu cầu về biến môi trường, hay FR-095 chỉ
  có nhóm mời, đăng ký? [Gap, Spec §FR-040, FR-095]
- [ ] CHK047 Cú pháp query chấp nhận (ký hiệu ngoặc vuông của `qs`, chuỗi JSON của SDK, giới hạn độ sâu và số phần tử mảng) có
  được nêu là một phần của yêu cầu cho `fields`, `filter`, `sort`, `deep`, `alias`? [Clarity, Spec §FR-040]

## E. Mời, đăng ký, TFA, `directus_users` (FR-048 đến FR-064, US4, US5)

- [x] CHK048 (đã giải: FR-053) [P1] "Session hiện tại" ở FR-053 có xác định được khi admin đổi mật khẩu hoặc email của người khác (session của ai
  được giữ)? [Ambiguity, Spec §FR-053, US4.5]
- [ ] CHK049 Quyền cần có để người không phải admin bật, tắt TFA (cần `update` field `tfa_secret`) có được nêu là yêu cầu và có
  trong ma trận quyền không? [Completeness, Spec §FR-048, FR-101]
- [ ] CHK050 Thứ tự kiểm của `POST /users/invite` (kiểm body, `invite_url`, quyền `create`, từng email) và kết quả khi một phần
  email trong mảng lỗi (đã tạo một phần hay không) có được nêu? [Clarity, Edge Case, Spec §FR-060, FR-033]
- [ ] CHK051 Giới hạn tạo hàng loạt qua mời (số email tối đa mỗi request, hạn mức tốc độ) có được nêu hay ghi là không giới hạn
  như Directus? [Gap, Spec §FR-060]
- [ ] CHK052 Các biến thể token mời và token xác minh sai (chữ ký, hết hạn, scope, user đã đổi trạng thái) có bảng kết quả (status,
  mã) trong spec, không chỉ rải ở US5? [Completeness, Spec §FR-062, FR-064, US5.4]
- [x] CHK053 (đã giải: SC-009) Yêu cầu thời gian chờ có nêu đo trên nhánh nào, dung sai bao nhiêu (so với `REGISTER_STALL_TIME`), và liệu hai app
  phải lệch nhau không quá bao nhiêu (như SC-003 của 003)? [Measurability, Spec §FR-063, US5.5, US5.6]
- [ ] CHK054 Quy tắc `status` hợp lệ và các chuyển trạng thái được phép của user (`draft`, `archived`, `unverified`, `invited`)
  có được nêu, hay chỉ dựa vào hành vi Directus mà không có ca chấp nhận? [Completeness, Spec §Key Entities, US4]
- [ ] CHK055 Chính sách mật khẩu (`auth_password_policy`) có nêu khi cài đặt rỗng hoặc regex sai, và áp dụng cho mọi đường đặt
  mật khẩu (tạo, sửa, nhận lời mời, đăng ký)? [Coverage, Spec §FR-051, FR-062, FR-063]
- [ ] CHK056 Việc xóa user có nêu hành vi với các khóa ngoại ngoài ba bảng được liệt kê (`directus_files.uploaded_by`,
  `directus_activity.user`, share, flow) hay dựa vào DB? [Completeness, Gap, Spec §FR-053]

## Notes

- Tick `[x]` khi mục được giải quyết bằng cách sửa spec (ghi mục nào của spec đã đổi) hoặc ghi rõ "chấp nhận, không
  đổi" kèm lý do. Mục `[Conflict]` nên được sửa, không chỉ chấp nhận.
- Mục chưa giải quyết xong thì không chạy `/speckit.implement`; có thể chạy `/speckit.tasks` song song nếu chỉ còn mục không
  gắn `[P1]`.
- 2026-10-11: đã giải mọi mục `[P1]` và CHK004, CHK034, CHK039 bằng cách sửa spec (Clarifications "rà checklist"). Các mục còn mở không chặn `/speckit.tasks`.
- Mỗi lần chạy `/speckit.checklist` tạo một file mới; checklist `requirements.md` (chất lượng spec chung) giữ nguyên.
