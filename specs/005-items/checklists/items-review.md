# Formal Requirements Review Checklist: Items (CRUD `/items`, response cache, export, event, bus `websocket.event`)

**Purpose**: Kiểm chất lượng yêu cầu (đầy đủ, rõ, nhất quán, đo được) của spec 005 trước khi chia task. Không kiểm cài
đặt. Mỗi mục là một câu hỏi về nội dung spec (và contracts của plan khi spec dẫn chiếu); mục không đạt thì sửa spec rồi
mới chạy `/speckit.tasks`.
**Created**: 2026-10-11
**Feature**: [spec.md](../spec.md)
**Depth**: Formal (cổng trước `/speckit.implement`, người rà thứ hai). **Focus**: A hợp đồng API `/items` và singleton,
B response cache dùng chung, C export, D event và bus `websocket.event`, E kiểm thử đối chiếu, CI, benchmark.
**Ngoài phạm vi checklist này**: engine đọc ghi và kiểm quyền (đã rà ở `permissions-review.md` của 004).

**Ghi chú ưu tiên**: `[P1]` là mục có rủi ro bảo mật hoặc dễ làm sai tiêu chí chấp nhận nếu để mơ hồ; nên giải quyết
trước. Mục `[Conflict]`, `[Gap]` đã đối chiếu với spec, plan, contracts và code Directus 11.17.4 khi viết checklist.

## A. Hợp đồng API `/items` và singleton (FR-001 đến FR-006, US1, Edge Cases)

- [x] CHK001 (đã giải: Edge Cases "Lô rỗng", đọc từ `services/items.ts`) Yêu cầu có nêu kết quả khi body là mảng rỗng (`POST []`, `PATCH []`, `DELETE []`) và khi `{keys: []}` hoặc
  `{query}` không khớp dòng nào (status, body `{data: []}` hay `204`), thay vì chỉ dẫn chiếu FR-041 của 004? [Gap,
  Spec §FR-001, US1.3]
- [x] CHK002 (đã giải: FR-003 (`validate-batch.ts:14`)) [P1] Hành vi của `validateBatch('update')` và `validateBatch('delete')` với collection singleton (body là object,
  không `keys`, không `query`) có được nêu rõ (bỏ qua kiểm hay `400 INVALID_PAYLOAD`), để không lệch khỏi Directus
  ở `PATCH /items/<singleton>`? [Ambiguity, Spec §FR-003, contracts/items-api.md §1]
- [x] CHK003 (đã giải: FR-005, contracts/items-api.md §3) Danh sách `Allow` của từng path `/items/*` có được chốt trong spec hoặc contract trước khi chia task (hiện FR-005
  ghi "ghi ở contracts khi lập plan"; contracts/items-api.md §3 đã có), và spec có dẫn tới contract đó không? [Completeness,
  Spec §FR-005]
- [x] CHK004 (đã giải: FR-004, Edge Cases; T010 khẳng định riêng, T015) Hành vi hiện tại của query `version`, `versionRaw` trên `/items` (status, mã lỗi khi `ItemsService` của 004 gặp
  `version`) có được nêu cụ thể để bộ đối chiếu có ca chấp nhận, thay vì "đo và ghi"? [Ambiguity, Spec §FR-004, Edge
  Cases, D-09.6]
- [x] CHK005 (đã giải: FR-006) Thứ tự lỗi FR-006 có nêu vị trí của lỗi `export` sai giá trị (`validateQuery`, bước 4) so với `collectionExists`
  (bước 5), nghĩa là `GET /items/nope?export=pdf` trả `400` chứ không `403`? [Clarity, Spec §FR-006, FR-020]
- [x] CHK006 (đã giải: Edge Cases "Tên collection trong path"; chuỗi `%` sai đo ở T010) Yêu cầu có nêu kết quả cho tên collection cần mã hóa URL (khoảng trắng, ký tự ngoài ASCII, chữ hoa) và tên
  collection trùng tên collection hệ thống khi so với schema (`directus_users` có trong schema nhưng bị chặn) đủ để
  một ca đối chiếu viết được? [Coverage, Edge Case, Spec §FR-002]
- [x] CHK007 (đã giải: bảng truy vết, dòng "Mọi story") Mục "Truy vết user story và requirement" có phủ FR-050 (biến môi trường) và FR-017, hay hai FR này không gắn với
  story nào? [Traceability, Spec §Truy vết]

## B. Response cache dùng chung (FR-010 đến FR-017, US3, SC-003)

- [x] CHK008 (đã giải: R-09, Edge Cases) [P1] Key cache không chứa `role`, `roles`, `share`, `session`: request bằng token share (`user: null`) và request
  public cùng `path`, `query` dùng chung một bản cache. Spec có ghi hệ quả này (public có thể nhận bản cache do share
  tạo và ngược lại) là rủi ro chấp nhận R-xx kèm bằng chứng (`utils/get-cache-key.ts` chỉ lấy `accountability.user`),
  như quy tắc của 004? [Gap, Security, Spec §FR-011, R-08]
- [x] CHK009 (đã giải: FR-010) Yêu cầu có nêu các header của response `HIT` ngoài `Cache-Control`, `Vary` và header trạng thái (ví dụ
  `Content-Type`, `ETag` do Express sinh khi `res.json`; không có header do route gốc đặt), để bộ so sánh biết header
  nào phải giống? [Completeness, Spec §FR-010, SC-002]
- [x] CHK010 (đã giải: FR-005, FR-010) Yêu cầu có nêu `HEAD` không đi qua cache (middleware chỉ xét method `GET`) và `HEAD` tới path đã có bản cache
  trả header gì? [Gap, Spec §FR-010, FR-005]
- [x] CHK011 (đã giải: FR-012) Giá trị không hợp lệ của `CACHE_VALUE_MAX_SIZE` (chuỗi không parse được → `parseBytes` trả `null` → không giới hạn)
  và `CACHE_CONTROL_S_MAXAGE` không phải số nguyên (bỏ `s-maxage`) có được nêu? [Gap, Spec §FR-012, FR-017]
- [x] CHK012 (đã giải: FR-016 theo quy tắc so FR-085 của 004 (status, mã lỗi, timeout 15/20 giây; không so thời gian)) "Cùng kết quả trong sai số của cấu hình ioredis" ở FR-016 có được lượng hóa (độ lệch thời gian trả về cho phép,
  status mong đợi theo từng thời điểm sau khi Redis dừng), như FR-085 của 004 đã đo? [Measurability, Spec §FR-016]
- [x] CHK013 (đã giải: Edge Cases "Key cache") Spec có nêu `path` trong key là pathname của `originalUrl` nên `/items/a` và `/items/a/` là hai key, và `query`
  là `sanitizedQuery` nên tham số lạ không đổi key (hai request khác query string có thể cùng `HIT`)? [Clarity, Spec
  §FR-011]
- [x] CHK014 (đã giải: FR-043) Yêu cầu FR-043 (cặp chính gửi `Cache-Control: no-store`) có nhất quán với các kỳ vọng header đã ghi ở contracts
  của 001 đến 004 (`Cache-Control: no-cache` cho `/server/info`, năm endpoint) và SC-002, SC-009, nghĩa là có nêu rõ
  header mong đợi của cặp chính nay là `no-store` ở cả hai app? [Consistency, Spec §FR-043, SC-009]
- [x] CHK015 (đã giải: Key Entities "Thuật ngữ") Thuật ngữ "cache dữ liệu", "response cache", "bản cache response" có được dùng nhất quán theo Key Entities (bản
  cache response nằm trong cache dữ liệu) ở FR-010 đến FR-016 và US3? [Consistency, Spec §Key Entities]
- [x] CHK016 (đã giải: FR-010) Spec có ghi rõ không có metric Prometheus hay log mức `info` cho `HIT`/`MISS` (Directus chỉ có bộ đếm telemetry,
  không port), để đội vận hành không mong đợi quan sát được tỷ lệ cache? [Gap, NFR, Spec §FR-010]

## C. Export (FR-020, FR-021, US4, SC-004)

- [x] CHK017 (đã giải: FR-044) Tên file có ký tự ngoài ASCII (collection tiếng Việt) và cách `Content-Disposition` biểu diễn (`filename*=`) có
  được nêu hoặc loại khỏi phạm vi so sánh? [Gap, Spec §FR-020]
- [x] CHK018 (đã giải: FR-044) Ma trận FR-044 có ca `export` với `aggregate`, `groupBy` (data là mảng object tổng hợp) và với `fields` có hàm
  (`year(date_created)`), hay cố ý bỏ? [Coverage, Spec §FR-044]
- [x] CHK019 (đã giải: FR-020) Giới hạn kích thước export (dùng `limit=-1`, `QUERY_LIMIT_MAX`, bộ nhớ) có được nêu hoặc ghi rõ là không giới hạn
  như Directus (giống CHK013 của 004)? [Gap, NFR, Spec §FR-020]
- [x] CHK020 (đã giải: FR-021 (body, header giữ lại, stack chỉ ở log); message `TypeError` đo ở T025) Trường hợp `500` của `csv` không có payload (FR-021) có nêu body lỗi mong đợi (`INTERNAL_SERVER_ERROR` message
  mặc định) và việc stack trace trong log không bị so sánh? [Clarity, Spec §FR-021]
- [x] CHK021 (đã giải: FR-044, Assumptions) Quy tắc chuẩn hóa khi so body export (id, ngày, phần thời gian trong tên file) có được nêu ở spec (Assumptions
  của 004 chỉ nói body JSON), hay chỉ ở contracts/export.md §4? [Completeness, Spec §FR-044, Assumptions]
- [x] CHK022 (đã giải: FR-020) `HEAD` tới request có `export` (header `Content-Disposition` có, body không) có được nêu? [Edge Case, Spec §FR-020]

## D. Event và bus `websocket.event` (FR-030 đến FR-033, US5, SC-005)

- [x] CHK023 (đã giải: FR-032, R-10, Edge Cases) [P1] Hành vi khi `publish` lên bus Redis thất bại (Redis dừng giữa chừng; Directus không `await` và không bắt lỗi
  trong `registerAction`) có được nêu: request vẫn thành công, lỗi đi đâu (log, unhandled rejection)? [Gap, Spec
  §FR-032, Edge Cases]
- [x] CHK024 (đã giải: FR-031) Danh sách scope ở FR-031 (`users`, `roles`, `policies`, `access`, `permissions`, `activity`, `revisions`) có khớp
  với các service đã port có `eventScope` (thêm `presets`, `settings` từ 001, 004) và với contracts/events-bus.md §2?
  [Consistency, Spec §FR-031]
- [x] CHK025 (đã giải: FR-045 (2 giây)) SC-005 có nêu cửa sổ thời gian thu thập thông điệp sau request (bao lâu sau response thì chốt chuỗi) và cách xử lý
  thông điệp đến muộn, để "cùng chuỗi, cùng thứ tự" đo được ổn định? [Measurability, Spec §FR-045, SC-005]
- [x] CHK026 (đã giải: chấp nhận, không đổi: FR-045 so thứ tự, data-model.md §4) Thứ tự giữa action event chính và `nestedActionEvents`, và giữa các event của `createMany` (gom rồi phát sau
  commit) có được nêu là một phần của hành vi phải giống Directus (so thứ tự) hay chỉ tập hợp? [Clarity, Spec §FR-031,
  US5.2]
- [x] CHK027 (đã giải: FR-032) Spec có nêu `WEBSOCKETS_*` được đọc một lần khi khởi động (đổi env cần khởi động lại) và giá trị mặc định
  `WEBSOCKETS_REST_ENABLED=true`, `WEBSOCKETS_GRAPHQL_ENABLED=true` (nên điều kiện thực tế là `WEBSOCKETS_ENABLED`)?
  [Clarity, Spec §FR-032, FR-050]
- [x] CHK028 (đã giải: R-07) R-07 có nêu đủ phạm vi: cả `activity`, `revisions` event mang payload (`revisions.create` chứa `data`, `delta` đã che
  theo FR-092 của 004) và thông điệp bus cho `directus_revisions`, `directus_activity` (không bị loại như `sessions`)?
  [Completeness, Security, Spec §R-07]
- [x] CHK029 (đã giải: chấp nhận, không đổi: nhất quán sau khi đọc lại) Cách thu hẹp D-26, D-29 ("flow có trigger event không chạy tới 009") có nhất quán với entry
  `accepted-differences.ts` (`kind: 'doc'`, `removeAt: '009'`) và với mô tả US5 "Flow (009) sẽ đăng ký vào emitter này"?
  [Consistency, Spec §Khác biệt, US5]

## E. Kiểm thử đối chiếu, CI, benchmark (FR-040 đến FR-048, SC-001, SC-006 đến SC-009)

- [x] CHK030 (đã giải: FR-040) [P1] FR-040 nói "giữ nguyên các khẳng định của Directus", nhưng bộ blackbox items xen khẳng định GraphQL (m2m 150
  lời gọi) và WebSocket trong cùng `it`. Spec có nêu rõ: khẳng định GraphQL chạy về Directus tới 011, khối WebSocket bỏ
  (Nguyên tắc XI), và tiêu chí chấp nhận "chạy qua trên app mới" áp cho phần REST? [Gap, Conflict, Spec §FR-040, US2,
  research R6]
- [x] CHK031 (đã giải: FR-041) Định nghĩa bộ rút gọn ở FR-041 ("một ca đọc, ghi, quan hệ mỗi file; mọi kiểu field một toán tử") có đo được bằng
  cách chọn ca cụ thể, hay nên viết theo cơ chế dự kiến (mọi file, chỉ kiểu khóa `integer`) để bộ rút gọn kiểm tra
  được? [Measurability, Spec §FR-041, contracts/parity-blackbox.md §3]
- [x] CHK032 (đã giải: FR-040 (file theo vendor)) Đường cơ sở "ca fail trên chính Directus ở một vendor" (SC-001) có nêu được lưu ở đâu (file danh sách trong repo,
  lần chạy nào) để "không quá số ca fail trên Directus" kiểm được? [Measurability, Spec §SC-001, Assumptions]
- [x] CHK033 (đã giải: FR-042) Yêu cầu port `cache.test.ts` có nêu collection bị bỏ qua (`CACHE_AUTO_PURGE_IGNORE_LIST`) phải có tên cố định
  được đặt trong env của cặp trước khi seed, và cặp cache dùng request không header `no-store` (khác cặp chính)?
  [Clarity, Spec §FR-042, FR-043]
- [x] CHK034 (đã giải: FR-042) FR-042 có nêu cách đo `CACHE_VALUE_MAX_SIZE` (ngưỡng đặt ở cặp nào, response nào vượt) và `ip_access` khớp (policy
  nào, IP của request lấy từ đâu trong môi trường Docker) đủ để viết ca? [Completeness, Spec §FR-042]
- [x] CHK035 (đã giải: FR-043) FR-047 có nêu ca của 003, 004 từng né cache bằng "query khác nhau giữa các lần gọi" được giữ hay bỏ, và SC-009
  "không thêm khác biệt chấp nhận" có cho phép sửa kỳ vọng header `no-cache` → `no-store` trong test cũ? [Consistency,
  Spec §FR-047, SC-009]
- [x] CHK036 (đã giải: FR-048) FR-048 có nêu chế độ `HIT` đo gì ở app mới (chi phí middleware và Redis khi cả hai app đọc cùng bản cache) và
  ngưỡng 10% áp cho chế độ này thế nào khi bản cache do app kia ghi? [Measurability, Spec §FR-048, SC-006]
- [x] CHK037 (đã giải: FR-048) Kịch bản `DELETE` của benchmark (mỗi request một id mới) có nêu nguồn id và cách tránh `403`/`204` giả khi hết id,
  và `POST` có nêu dọn dữ liệu giữa các lượt? [Completeness, Spec §FR-048]
- [x] CHK038 (đã giải: Assumptions) Giả định "tạo collection, field có index qua API của Directus" (`is_indexed`, m2o, o2m) cho benchmark và blackbox
  có được ghi ở Assumptions, kèm điểm dừng nếu API Directus không tạo được index? [Assumption, Spec §FR-048]
- [x] CHK039 (đã giải: FR-046) FR-046 có nêu định dạng và cột của file CSV tải từ sidebar (fields chọn gì, có `id` không) để hai lượt so được,
  và cách so khi tên file chứa thời điểm? [Clarity, Spec §FR-046, US6.2]
- [x] CHK040 (đã giải: FR-041) Tiêu chí "mỗi job CI dưới 60 phút" (tiền lệ 004) có được nêu cho job blackbox và job cache mới, cùng điều kiện
  chặn merge của từng job (FR-041, FR-046)? [Completeness, NFR, Spec §FR-041, SC-001]
- [x] CHK041 (đã giải: FR-040) Spec có nêu các file test blackbox hoãn (`version`, `timezone`, `cache-revalidate`) được ghi ở đâu để feature 006,
  007, 008 nhận (bảng "Phần port rút gọn tạm thời" của plan hay bảng khác biệt)? [Traceability, Spec §FR-040]
- [x] CHK042 (đã giải: FR-047) Yêu cầu chạy lại toàn bộ 001 đến 004 (FR-047) có nêu phạm vi gồm cả `parity-matrix.yml` (ma trận quyền chạy qua
  `respond` mới) trước khi đóng feature? [Coverage, Spec §FR-047, SC-009]

## Notes

- Tick `[x]` khi mục được giải quyết bằng cách sửa spec (ghi mục nào của spec đã đổi) hoặc ghi rõ "chấp nhận, không
  đổi" kèm lý do. Mục `[Conflict]` nên được sửa, không chỉ chấp nhận.
- Mục chưa giải quyết xong thì không chạy `/speckit.implement`; có thể chạy `/speckit.tasks` song song nếu chỉ còn mục
  không gắn `[P1]`.
- 2026-10-11: đã giải mọi mục `[P1]` (CHK002, CHK008, CHK023, CHK030) và 31 mục khác bằng cách sửa spec (Clarifications
  "rà checklist").
- 2026-10-11 (trước `/speckit.implement`): giải nốt 7 mục còn mở (CHK001, CHK004, CHK006, CHK012, CHK013, CHK015,
  CHK020) bằng đọc code Directus và sửa spec (Edge Cases, FR-004, FR-016, FR-021, Key Entities). Chỗ còn ghi "dự kiến"
  (chuỗi `%` sai, message `TypeError`, export xml, yaml khi không có payload) được đo ở T010, T025. Mọi mục đã giải.
- Mỗi lần chạy `/speckit.checklist` tạo một file mới; checklist `requirements.md` (chất lượng spec chung) giữ nguyên.
