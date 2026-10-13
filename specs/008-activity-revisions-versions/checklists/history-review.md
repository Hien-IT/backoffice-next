# Formal Requirements Review Checklist: Lịch sử thay đổi, content versioning, comment (`/activity`, `/revisions`, `/versions`, `/comments`)

**Purpose**: Kiểm chất lượng yêu cầu (đầy đủ, rõ, nhất quán, đo được) của spec 008 (và contracts của plan khi spec dẫn
chiếu) trước khi chia task. Không kiểm cài đặt. Mỗi mục là một câu hỏi về nội dung spec; mục không đạt thì sửa spec rồi
mới chạy `/speckit.tasks`.
**Created**: 2026-10-13
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [contracts/](../contracts/)
**Depth**: Formal (cổng trước `/speckit.implement`, người rà thứ hai). **Focus**: A content versioning (hash, delta,
`?version=`, promote), B activity và revisions (dòng ghi, revert qua app Directus), C comment, mention, thông báo,
D-33, D retention, E quyền, event, kiểm thử đối chiếu, CI, benchmark.
**Ngoài phạm vi checklist này**: engine đọc ghi và kiểm quyền (đã rà ở 004), response cache (005), route `/utils` và
email (010).

**Ghi chú ưu tiên**: `[P1]` là mục dễ làm sai tiêu chí chấp nhận hoặc tạo khác biệt chưa ghi nếu để mơ hồ; nên giải
quyết trước. Mục `[Conflict]`, `[Gap]` đã đối chiếu với spec, plan, contracts và code Directus 11.17.4 khi viết.

## A. Content versioning (US2, FR-030 đến FR-039, contracts/versions.md)

- [x] CHK001 (đã giải: FR-004, data-model §8: scope theo tên collection) [P1] FR-004 và data-model §8 ghi event `items.create|update|delete` cho bốn collection hệ thống, nhưng
  `ItemsService` phát `versions.create`, `comments.create`, `activity.create`, `revisions.create` (eventScope của
  collection `directus_*`). Yêu cầu có nêu đúng tên event để test đối chiếu bus so đúng không? [Conflict, Spec
  §FR-004, data-model §8]
- [x] CHK002 (đã giải: FR-030) [P1] FR-030 ghi `hash` tính trên item chính "đọc theo quyền người gọi". Spec có nêu hệ quả khi người tạo
  version và người gọi `compare`/`promote` thấy tập field khác nhau (`outdated = true` dù item không đổi), và SC-003
  có giới hạn ở cùng user hay không? [Gap, Spec §FR-030, SC-003]
- [x] CHK003 (đã giải: FR-032) FR-032 áp `mapDelta` cho `readOne` và `getVersionSave`; `GET /versions` (danh sách, `readByQuery`,
  `readMany` sau `POST`) trả delta thô còn `_user`, `_date`. Spec có nói rõ khác biệt này giữa đọc một và đọc nhiều,
  để bộ đối chiếu không coi `_user` trong danh sách là lỗi? [Clarity, Spec §FR-032]
- [x] CHK004 (đã giải: FR-060) [P1] FR-060 chỉ nêu quy tắc so `hash` (tuyệt đối). Quy tắc so `_date` trong `delta` (giá trị `Date` từ
  `writeTimestamp`, serial hóa ISO, lệch múi giờ theo vendor) và `date_created`, `date_updated` của version có được
  ghi ở spec hay chỉ ở contracts/parity.md §2? [Gap, Spec §FR-037, FR-060]
- [x] CHK005 (đã giải: FR-036) Spec có nêu hành vi của `?version=main` (đọc item chính, không tra version) và của `?version=` trên
  danh sách (`GET /items/:collection`, bị bỏ qua, chỉ `readOne` và `readSingleton` xử lý)? [Gap, Spec §FR-036]
- [x] CHK006 (đã giải: FR-002) Yêu cầu có nêu quyền cần có trên `directus_versions` cho từng luồng (đọc version để dùng `?version=`,
  tạo, sửa, xóa, `save`, `promote`), và rằng quyền tối thiểu app access không gồm `directus_versions`, nên user thường
  cần policy riêng mới dùng được menu Version? [Gap, Spec §FR-002, FR-036]
- [x] CHK007 (đã giải: FR-035) FR-035 "lọc theo `fields` nếu có" có nói rõ đó là `pick` ở mức khóa cấp một của `rawDelta` (không lọc
  field lồng trong quan hệ), và `fields` không hợp lệ (không có trong delta) bị bỏ qua không lỗi? [Clarity, Spec
  §FR-035]
- [x] CHK008 (đã giải: Edge Cases) Spec có nêu kết quả của `compare`, `save`, `promote`, `?version=` khi item chính đã bị xóa (version còn
  vì không FK; `getMainItem` → `403`) và khi collection đã tắt `versioning` sau khi version tồn tại (vẫn `save`,
  `promote` được)? [Edge Case, Gap, Spec §US2]
- [x] CHK009 (đã giải: US2.6) US2.6 "xóa version thì app kia không thấy nữa": spec có nêu revision `version_save` gắn version bị xóa
  theo FK CASCADE (và activity của chúng còn lại), để kiểm tra dòng sau xóa đúng kỳ vọng? [Gap, Spec §US2.6,
  data-model §1]
- [x] CHK010 (đã giải: US2.7) US2.7 "không treo" có ngưỡng thời gian đo được (timeout của ca blackbox "version deadlocking") không?
  [Measurability, Spec §US2.7]
- [x] CHK011 (đã giải: FR-033) FR-033 ghi `_user`, `_date` gắn vào "object thay đổi" và không gắn vào mảng; spec có nói rõ điều kiện
  "chưa bằng delta cũ tại cùng đường dẫn" (`isEqual`) để `_date` không đổi khi `save` lại cùng nội dung? [Clarity,
  Spec §FR-033]
- [x] CHK012 (đã giải: bảng R-20, R-21: ca đo) R-20, R-21 ghi "cần đo" nhưng chưa nêu ca đo và bằng chứng tối thiểu (request, kết quả ở Directus thật,
  ngày). Spec có liệt kê ca đo cụ thể (user chỉ đọc gọi `save`; hai `promote` cùng `mainHash` đồng thời) như tiền lệ
  R-13 đến R-19? [Completeness, Spec §Khác biệt]

## B. Activity và revisions (US1, US3, FR-010 đến FR-021)

- [x] CHK013 (đã giải: FR-010, FR-020) [P1] FR-010 nêu `data` là "bản chụp không field quan hệ"; spec có nói rõ bản chụp là toàn bộ field không
  quan hệ của item sau ghi (không chỉ field trong payload), vì app Directus khôi phục bằng cách so `data` của revision
  được chọn với `data` của revision liền trước? [Clarity, Spec §FR-010, FR-020]
- [x] CHK014 (đã giải: US3 mô tả) US3.2 mô tả revert qua app Directus; spec có nêu app Directus lấy payload từ hiệu của `data` hai revision
  liên tiếp (sắp theo `id` giảm dần) và cho chọn field, nên thứ tự `id` và `data` của revision do app kia ghi quyết
  định kết quả? [Completeness, Spec §US3]
- [x] CHK015 (đã giải: US3.3 bỏ giả định) US3.3 nói app Directus "không có nút Revert cho dữ liệu rỗng" cho revision không có `data`. Nhận định này
  đã kiểm trong `directus/app` chưa, hay là suy luận? [Assumption, Spec §US3.3]
- [x] CHK016 (đã giải: FR-060) FR-060 ghi `ip` "so sau khi cùng đi qua proxy"; spec có quy định cách so `ip` khi bộ đối chiếu gửi thẳng
  tới cổng mỗi app (phần lớn ca), và yêu cầu bộ đối chiếu gửi cùng `User-Agent`, `Origin` cho cả hai app? [Clarity,
  Spec §FR-060]
- [x] CHK017 (đã giải: FR-010) FR-010 liệt kê "login, logout, version save, revert, promote" trong đường ghi; `revert` và `promote` không
  có `action` riêng (ghi `update`). Câu chữ có gây hiểu là có `action = revert`, mâu thuẫn với FR-021? [Consistency,
  Spec §FR-010, FR-021]
- [x] CHK018 (đã giải: FR-013) Spec có nêu `activity.user` là quan hệ m2o tới `directus_users` (đọc `user.*` theo quyền trên
  `directus_users`), nên user thường có thể thấy `user` là id mà không mở rộng được? [Gap, Spec §FR-013]
- [x] CHK019 (đã giải: FR-012, Edge Cases, contracts) Spec có nêu kết quả `GET /activity/:pk`, `GET /revisions/:pk` khi dòng đã bị retention xóa giữa hai lần
  đọc (`{data: null}` vs `403`)? [Edge Case, Spec §FR-012]

## C. Comment, mention, thông báo, D-33 (US4, FR-040 đến FR-044)

- [x] CHK020 (đã giải: US4.2) [P1] US4.2 "uuid không tồn tại trả lỗi như Directus": spec có nêu lỗi xảy ra sau khi comment đã ghi
  (`super.createOne` trước vòng mention), nên dòng comment, activity, revision vẫn còn dù response `403`, và bộ đối
  chiếu phải so cả dòng còn lại? [Gap, Spec §US4.2, Edge Cases]
- [x] CHK021 (đã giải: FR-040) Spec có nêu thứ tự kiểm lỗi của `createOne` (user → `comment` → `collection` → `item` → quyền đọc item) để
  ca gửi payload thiếu nhiều field so đúng `reason`? [Clarity, Spec §FR-040, contracts/history-api.md §3.1]
- [x] CHK022 (đã giải: FR-041) FR-041 ghi "`@Unknown User`" khi uuid không hợp lệ, nhưng regex chỉ bắt uuid v4 hợp lệ nên nhánh này
  không xảy ra qua API. Spec có ghi rõ đó là nhánh phòng hờ của Directus, không cần ca đối chiếu? [Clarity, Spec
  §FR-041]
- [x] CHK023 (đã giải: FR-042) FR-042 và D-33: nội dung, mức (warn) và điều kiện của dòng log cảnh báo có được ghi ở spec (hiện chỉ ở
  contracts/history-api.md §3.2), và có nằm trong bộ so log khởi động/log request của 003 không? [Completeness, Spec
  §FR-042]
- [x] CHK024 (đã giải: FR-041) Spec có nêu thông báo được tạo bằng `NotificationsService` không accountability (bỏ qua quyền tạo
  `directus_notifications` của người viết comment), và `sender` là người viết dù người đó bị ẩn với người nhận?
  [Gap, Spec §FR-041]
- [x] CHK025 (đã giải: US4.3) US4.3 "user chỉ có quyền tối thiểu app access thấy ... comment của mình": spec có nêu sidebar Comments
  của app Directus khi đó chỉ liệt kê comment của chính user, và đó là hành vi Directus (không phải lỗi app mới)?
  [Consistency, Spec §US4.3, FR-043]
- [x] CHK026 (đã giải: FR-043) Spec có nêu `PATCH /comments/:pk` của user tối thiểu chỉ được sửa field `comment` (field khác bị
  `403`), và `updateOne`/`deleteOne` không kiểm lại mention? [Completeness, Spec §FR-043]

## D. Retention (US5, FR-050 đến FR-053)

- [x] CHK027 (đã giải: FR-051, Edge Cases) [P1] FR-051 nói "`ACTIVITY_RETENTION` tắt"; spec có định nghĩa "tắt" là giá trị không phải thời lượng
  (ví dụ `false`, rỗng) làm `getMilliseconds` trả `undefined`, vì mặc định `90d` không có cách tắt khác? [Ambiguity,
  Spec §FR-051, US5.1]
- [x] CHK028 (đã giải: FR-053 bỏ vế không đo được) FR-053 "không giữ kết nối DB ngoài từng lô" có đo được không, hay nên bỏ (Directus không có yêu cầu
  này) để tránh ràng buộc không kiểm? [Measurability, Spec §FR-053]
- [x] CHK029 (đã giải: SC-005) SC-005 "0 lần xóa trùng trong 10 kỳ": spec có nêu cách quan sát "lần xóa" (log, Redis `MONITOR` khóa
  `schedule--data-retention`, số dòng) để tiêu chí đo được? [Measurability, Spec §SC-005]
- [x] CHK030 (đã giải: Edge Cases) US5.3 "lỗi xóa ghi log và dừng collection đó": spec có nêu khóa vẫn được xóa cuối job và task còn lại vẫn
  chạy, đúng như `break` trong vòng `do ... while` của Directus? [Clarity, Spec §US5.3]
- [x] CHK031 (đã giải: Assumptions) Spec có nêu hệ quả khi hai app có `RETENTION_SCHEDULE` khác nhau hoặc chỉ một app bật (ngoài phạm vi
  theo Assumptions) và khi `SYNCHRONIZATION_STORE=memory` (mỗi instance tự chạy cron, khóa Redis quyết định)?
  [Completeness, Spec §Assumptions, FR-050]
- [x] CHK032 (đã giải: Edge Cases: CASCADE, không mồ côi) Edge case "activity bị xóa trước, revision mồ côi" khi `ACTIVITY_RETENTION < REVISIONS_RETENTION`: FK
  `revisions.activity` là CASCADE nên revision bị xóa cùng activity, không mồ côi. Câu ở Edge Cases có đúng với
  schema không? [Conflict, Spec §Edge Cases, data-model §1]

## E. Quyền, kiểm thử đối chiếu, CI, benchmark (FR-002, FR-060 đến FR-063, SC)

- [x] CHK033 (đã giải: FR-061) FR-061 yêu cầu "Postgres, MySQL, SQLite mỗi lần push" cho bộ blackbox và unit; bộ đối chiếu mới
  (`history`) chia `reduced`/`full` chỉ ghi ở contracts/parity.md. Spec có nêu ca nào thuộc bộ rút gọn trên MySQL,
  SQLite? [Completeness, Spec §FR-061]
- [x] CHK034 (đã giải: FR-063) FR-063 nêu bốn kịch bản benchmark nhưng không nêu quy mô dữ liệu (constitution: 2.000 user, collection
  10 triệu bản ghi; contracts: 2.000 item × 20 revision). Spec có cần ghi quy mô seed và mức đồng thời? [Gap, Spec
  §FR-063, SC-006]
- [x] CHK035 (đã giải: FR-063) FR-063 E2E có "user được nhắc thấy thông báo" không? Màn chuông đọc `/notifications` đi tới Directus
  (D-09.8) nhưng dòng do app mới ghi; spec có liệt kê kịch bản này để chứng minh thông báo dùng chéo? [Coverage, Spec
  §FR-063]
- [x] CHK036 (đã giải: FR-001) SC-002 "kể cả `OPTIONS`, `HEAD`": spec có nêu `router-options` phải thêm mẫu cho bốn route (hiện chỉ ở
  contracts/history-api.md §5)? [Completeness, Spec §FR-001]
- [x] CHK037 (đã giải: Truy vết US6) Bảng "Truy vết" gắn US6 với SC-001, SC-006 nhưng SC-004 (thông báo) chỉ gắn US4; ca mention trong E2E
  (FR-063) có cần trỏ SC-004 không? [Traceability, Spec §Truy vết]
- [x] CHK038 (đã giải: Assumptions) Assumptions ghi "collection hệ thống chưa có route ghi activity, revision khi ghi lồng qua ItemsService
  chung"; spec có nêu `directus_notifications` nay qua `NotificationsService` (D-31 thu hẹp) nhưng `/notifications`
  vẫn tới Directus tới 010, để không hiểu nhầm là có route? [Consistency, Spec §FR-003, D-31, Assumptions]

## Notes

- Mục đạt đánh `[x]` kèm "(đã giải: ...)" như tiền lệ 004 đến 007; mục `[P1]` giải trước khi chạy `/speckit.tasks`.
- CHK001, CHK013, CHK020, CHK027, CHK032 là chỗ spec đang sai hoặc thiếu so với code Directus đã đọc; các mục khác là
  chỗ cần nói rõ để bộ đối chiếu so đúng.
