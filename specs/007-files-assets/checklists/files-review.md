# Formal Requirements Review Checklist: Files, folders, assets, TUS (vòng đời file, transform, TUS, import)

**Purpose**: Kiểm chất lượng yêu cầu (đầy đủ, rõ, nhất quán, đo được) của spec 007 ở bốn nhóm rủi ro trước khi chia
task. Không kiểm cài đặt. Mỗi mục là một câu hỏi về nội dung spec (và contracts, data-model của plan khi spec dẫn
chiếu); mục không đạt thì sửa spec rồi mới chạy `/speckit.tasks`.
**Created**: 2026-10-13
**Feature**: [spec.md](../spec.md)
**Depth**: Formal (cổng trước `/speckit.tasks`, người rà thứ hai). **Focus**: A vòng đời file trên storage dùng chung
(FR-010 đến FR-017, US1, US3, R-13), B asset và transform (FR-030 đến FR-041, US2, SC-004, SC-005), C TUS và đa instance
(FR-050 đến FR-054, US4), D import từ URL và an toàn mạng (FR-060, FR-061, US5, R-14).
**Ngoài phạm vi checklist này**: cấu hình storage, env, startup (FR-070 đến FR-073, US6); kiểm thử đối chiếu, blackbox,
CI, E2E, benchmark (FR-080 đến FR-084, US7); rà ở lượt sau nếu cần.
**Kết quả rà (2026-10-13)**: 44/44 đạt sau khi sửa spec. Chủ dự án quyết CHK017, CHK034; các mục còn lại giải bằng đọc
code Directus 11.17.4 (hai báo cáo có file:line), điểm nào code không đủ kết luận ghi "đo ở task" trong spec. Thêm rủi
ro R-15 đến R-18, mở rộng R-13, R-14.

**Ghi chú ưu tiên**: `[P1]` là mục dễ làm sai tiêu chí chấp nhận ("file tải lên ở app này xem và tải được ở app kia",
"URL asset có transform trả ảnh giống nhau") hoặc có rủi ro mất dữ liệu, lộ mạng nội bộ nếu để mơ hồ; nên giải quyết
trước. Mục `[Gap]`, `[Ambiguity]` đã đối chiếu với spec, contracts, data-model và báo cáo đọc code Directus 11.17.4 khi
viết checklist; chỗ nào checklist chưa chắc hành vi của Directus thì câu hỏi chỉ yêu cầu spec nêu rõ, không khẳng định
hành vi.

## A. Vòng đời file trên storage dùng chung (FR-010 đến FR-017, US1, US3, Edge Cases)

### A1. Tải lên và đặt tên object

- [x] CHK001 (đã giải có điều kiện, chờ đo T020: FR-011 ghi biểu thức đuôi của Directus; mime không ánh xạ cho `<id>.false`) [P1] Yêu
  cầu về `filename_disk` có nêu kết quả khi `filename_download` không có đuôi và mime không ánh xạ được đuôi (object tên
  `<id>` không đuôi), và cách đặt tên file phát sinh, xóa theo tiền tố áp lên file đó? [Gap, Spec §FR-011, §FR-035]
- [x] CHK002 (đã giải: FR-013 giữ thư mục con; FR-014, FR-016 nêu tiền tố từng đường; FR-035 file phát sinh ở gốc; Edge
  Cases và R-13 nêu object mồ côi) [P1] Spec có nêu hành vi khi `filename_disk` (đặt tay qua JSON hoặc `PATCH`) chứa thư
  mục con (`a/b.jpg`): object gốc nằm ở đâu, file phát sinh đặt ở đâu, xóa theo tiền tố có bắt được object gốc không?
  [Gap, Edge Case, Spec §FR-013, §FR-014, §FR-016]
- [x] CHK003 (đã giải: FR-010 nêu file trước còn, response là lỗi; stream bị chặn mime đo ở task) Với multipart nhiều
  file mà một file vượt `FILES_MAX_UPLOAD_SIZE` hoặc bị chặn mime, spec có nêu kết quả của các file đã lưu trước đó (giữ
  hay dọn) và response trả về? [Gap, Spec §FR-010, US1 ca 5]
- [x] CHK004 (đã giải: FR-010 ghi rõ chỉ multipart và import) `FILES_MIME_TYPE_ALLOW_LIST` có được nêu rõ là chỉ áp cho
  multipart và import, không áp cho `POST /files` JSON và ghi lồng qua `/items`? [Clarity, Spec §FR-010, §FR-013, §FR-017]
- [x] CHK005 (đã giải: FR-072 ghi chỉ `/server/info`, server không giới hạn) `FILES_MAX_UPLOAD_CONCURRENCY` được chuyển
  sang nhóm biến hỗ trợ (FR-072) nhưng không có FR nào nêu tác dụng của nó; spec có cần nêu rõ biến này chỉ ảnh hưởng
  `/server/info` (hay có tác dụng khác)? [Consistency, Gap, Spec §FR-072]
- [x] CHK006 (đã giải: FR-003 có bảng số dòng và event theo đường ghi) Số dòng `directus_activity`, `directus_revisions`
  mong đợi cho mỗi đường ghi (multipart, JSON, import, TUS, thay file) có được nêu để bộ đối chiếu so được, thay vì "như
  Directus"? [Measurability, Spec §FR-003]
- [x] CHK007 (đã giải: Edge Cases nêu cache áp mọi `GET`, `/assets` không lưu, `CACHE_AUTO_PURGE`) Spec có nêu `/files`
  và `/assets` có đi qua response cache dùng chung của 005 hay không, và `GET /files` sau khi app kia tải lên có bị `HIT`
  bản cũ không? [Gap, Consistency với 005, Spec §FR-001]

### A2. Thay file, đổi tên, xóa

- [x] CHK008 (đã giải: FR-012 nêu thứ tự; Edge Cases và R-15 nêu khoảng `403` và lỗi không rollback) [P1] Thứ tự các
  bước thay file (ghi tạm → sửa dòng → xóa theo tiền tố → chuyển tên) có được nêu đủ để xác định app kia đọc được gì ở
  từng khoảng (ví dụ `403` tạm thời khi object gốc đã bị xóa mà chưa chuyển xong)? [Clarity, Spec §FR-012]
- [x] CHK009 (đã giải: FR-012 gộp TUS `replace_id`; Edge Cases nêu khác biệt của đường TUS) [P1] Thay file bằng TUS
  (`replace_id`) có được gộp vào FR-012 (xóa file gốc cũ và file phát sinh theo tiền tố) hay chỉ nằm ở data-model §8?
  [Consistency, Spec §FR-012, §FR-052]
- [x] CHK010 (đã giải: FR-013 ghi `403 FORBIDDEN` ném sau kiểm quyền, `preMutationError`) Lỗi "trùng `filename_disk`" ở
  FR-013 ghi là `Forbidden` deferred; "deferred" có được giải thích thành status, mã lỗi và thời điểm trả về đo được
  không? [Clarity, Spec §FR-013]
- [x] CHK011 (đã giải: FR-016 nêu dòng trỏ sang object đích, gốc giữ trừ khi `FILES_DELETE_ORIGINAL_ON_MOVE`) Với `PATCH
  /files/:id` đổi `filename_disk` khi đích đã tồn tại, spec có nêu dòng `directus_files` trỏ sang object nào và object
  cũ còn hay mất theo từng giá trị `FILES_DELETE_ORIGINAL_ON_MOVE`? [Completeness, Spec §FR-016]
- [x] CHK012 (đã giải: FR-021 ghi `500` không dịch, status theo vendor đo ở task) Xóa thư mục còn thư mục con có được nêu
  kết quả (lỗi DB vì khóa ngoại không `on_delete`, status) như xóa thư mục có file ở US3 ca 2? [Gap, Edge Case, Spec
  §FR-021]
- [x] CHK013 (đã giải: FR-080 liệt kê tập so dòng DB, object, header) Tập thuộc tính so của "object trên storage" (key,
  kích thước, byte, `Content-Type` trên S3, không so thời gian) và tập cột `directus_files` được bỏ khi so (id, ngày giờ,
  `uploaded_by`?) có được liệt kê rõ? [Measurability, Spec §FR-080, US1 Independent Test]

## B. Asset và transform (FR-030 đến FR-041, US2, SC-004, SC-005)

### B1. Tên file phát sinh và trùng byte

- [x] CHK014 (đã giải: FR-035 nêu thứ tự mảng bước đã dựng, phụ thuộc `Accept`, kích thước, focal point) [P1] FR-035
  ghi `objectHash(chuỗi bước)`; spec có nêu rõ đầu vào hash là mảng bước đã dựng (`toFormat`, `resize`, `extract` tính
  từ focal point và kích thước ảnh) chứ không phải query thô, để tên trùng Directus với cùng query? [Clarity, Spec
  §FR-035]
- [x] CHK015 (đã giải: FR-034 nêu query thắng khi khác rỗng và khác `0`, X Y riêng) [P1] Khi focal point có cả trên file
  và trong query, thứ tự ưu tiên có được nêu (ảnh hưởng bước `extract` và tên file phát sinh)? [Ambiguity, Spec US2 ca 8,
  §FR-034]
- [x] CHK016 (đã giải: FR-030 nêu gộp nông query đè preset) Trong chế độ `storage_asset_transform=all`, request có cả
  `key` hợp lệ lẫn tham số tự do: spec có nêu dùng preset hay tham số, hay cả hai? [Ambiguity, Spec §FR-030]
- [x] CHK017 (chủ dự án chọn: đủ các lớp, mỗi ảnh ≤ 200 KB; FR-082 liệt kê) Bộ ảnh mẫu của ma trận transform có được
  liệt kê đủ các lớp dễ lệch byte (ảnh CMYK, png 16-bit, có alpha, gif động, ảnh lớn hơn
  `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION`, ảnh hỏng theo `ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL`)? [Coverage, Spec
  §FR-082, SC-004]
- [x] CHK018 (đã giải: FR-037 nêu kiểm theo dòng DB `400`, pixel thật vượt `500`, đo ở task) Khi ảnh nguồn vượt giới hạn
  pixel (`limitInputPixels`), status mong đợi có được nêu riêng (US2 ca 5 gộp vào `400`; lỗi của thư viện ảnh có thể
  không thuộc nhóm "tham số sai")? [Ambiguity, Spec §FR-037, US2 ca 5]

### B2. Phục vụ, header, giới hạn

- [x] CHK019 (đã giải: Edge Cases và R-17 nêu stream file dở trên `local`, bản sau thắng trên S3) [P1] Đang có một app
  ghi dở file phát sinh (chưa xong) mà app kia nhận cùng URL: spec có nêu app kia trả gì (object dở, chờ, hay sinh lại)?
  Edge Cases chỉ nói "cả hai cùng ghi". [Gap, Edge Case, Spec §FR-036]
- [x] CHK020 (đã giải: FR-032 ghi `HEAD` vẫn sinh file phát sinh) `HEAD /assets/:id` với tham số transform có được nêu là
  có sinh file phát sinh hay không? [Clarity, Spec §FR-032]
- [x] CHK021 (đã giải: FR-080 ghi ca so `Cache-Control` không gửi `no-store`) Bộ đối chiếu mặc định gửi `Cache-Control:
  no-store` (quy tắc 005) làm header `Cache-Control` của asset thành `no-store`; spec có nêu ca so header cache của asset
  phải gửi request không kèm header đó? [Consistency với 005, Spec §FR-031, §FR-080]
- [x] CHK022 (đã giải: FR-080 ghi quy về `modified_on` từng app) `ETag`, `Last-Modified` suy từ `modified_on` của dòng mỗi
  app tự tạo; quy tắc chuẩn hóa khi so hai upload riêng (khác với dùng chéo một dòng) có được nêu? [Gap, Measurability,
  Spec §FR-080]
- [x] CHK023 (đã giải: FR-030 ghi `withoutEnlargement` mọi chuỗi không rỗng là bật, `download` kiểm có mặt) Cách đọc tham
  số boolean của query (`withoutEnlargement`, `download`: có mặt, rỗng, `false`) có được nêu rõ để `?download=false` và
  `?withoutEnlargement=0` có kết quả xác định? [Clarity, Spec §FR-030, §FR-031]
- [x] CHK024 (đã giải: FR-038 nêu N × giới hạn, ca `503` đo trên một instance) Giới hạn `ASSETS_TRANSFORM_MAX_CONCURRENT`
  đếm theo process (FR-038): spec có nêu hệ quả đo được trong cụm nhiều instance (tổng số transform đồng thời có thể gấp
  số instance) để benchmark và test không hiểu sai? [Clarity, Spec §FR-038, SC-007]
- [x] CHK025 (đã giải: FR-041 nêu định dạng thời điểm, chuẩn hóa, quy tắc khử trùng tên) Zip: thành phần biến thiên
  trong tên file (`<thời điểm>`) và trong byte zip có được nêu cách chuẩn hóa, và danh sách entry khi hai file cùng tên
  trong một thư mục có được nêu (khử trùng tên của `buildTree`)? [Measurability, Spec §FR-041, §FR-021]

## C. TUS và đa instance (FR-050 đến FR-054, US4)

- [x] CHK026 (đã giải: US4 ca 4 sửa theo FR-054, thêm "chạy nhiều lần không đổi kết quả") [P1] US4 ca 4 ghi "một instance
  trong cụm nhờ khóa đồng bộ" trong khi FR-054 (đã sửa) nói mặc định `SYNCHRONIZATION_STORE=memory` mỗi instance tự
  chạy; hai chỗ có mâu thuẫn và ca 4 có cần nêu điều kiện `redis`? [Conflict, Spec US4 ca 4, §FR-054]
- [x] CHK027 (đã giải: FR-052 nêu phần dư bị bỏ, offset từ DB, số part, chunk của ca xen kẽ; R-18) [P1] Với S3, part
  tối thiểu 5 MiB và `TUS_CHUNK_SIZE` mặc định 8 MB: spec có nêu kết quả khi một `PATCH` nhỏ hơn kích thước part (phần
  dở lưu ở đâu, app kia tiếp tục được không) và kích thước chunk bắt buộc của ca xen kẽ? [Gap, Spec §FR-052, US4
  Independent Test]
- [x] CHK028 (đã giải: Assumptions nêu tiền đề dùng chung `.env`: `STORAGE_*`, `PUBLIC_URL`, `TUS_*`, `FILES_*`,
  `ASSETS_*`) Điều kiện hai app cùng `PUBLIC_URL`, cùng `TUS_ENABLED`, cùng `STORAGE_LOCATIONS` (location đầu) để
  `Location`, ẩn file dở và nơi ghi chunk khớp nhau có được nêu thành tiền đề rõ ràng (Assumptions chỉ nói "cùng cấu hình
  storage")? [Assumption, Spec §FR-050, §FR-015, §FR-052]
- [x] CHK029 (đã giải: Edge Cases ghi `modified_on` cập nhật mỗi chunk, hết hạn tính từ chunk cuối) "Quá
  `TUS_UPLOAD_EXPIRATION`" tính từ lần ghi chunk cuối (`modified_on`) hay từ lúc tạo có được nêu? [Clarity, Spec US4 ca
  4, data-model §8]
- [x] CHK030 (đã giải: FR-015 nêu `GET /files/:pk` và `/assets/:pk` trả `403`, đích thay file trả object cũ) `GET
  /files/:pk` và `GET /assets/:pk` của file đang tải dở (có `tus_id`) có được nêu kết quả (FR-015 chỉ nói "đọc danh
  sách")? [Gap, Spec §FR-015]
- [x] CHK031 (đã giải: FR-051 nêu không có `user` thì không lọc, admin không ngoại lệ) Upload tạo bởi role public hoặc
  static token không gắn user: điều kiện tìm upload theo `uploaded_by` (FR-051) có được nêu cho trường hợp không có user?
  [Edge Case, Spec §FR-051]
- [x] CHK032 (đã giải: FR-050 liệt kê lỗi giao thức với status; `413` đo ở task) `Upload-Length` vượt
  `FILES_MAX_UPLOAD_SIZE` và `Upload-Metadata` thiếu `filename_download` có nằm trong danh sách lỗi của US4 ca 3 với
  status mong đợi? [Coverage, Spec §FR-050, US4 ca 3]
- [x] CHK033 (đã giải: FR-050 nêu ba trường hợp `OPTIONS`: CORS bật, `/:id` qua TUS, collection qua Express) `OPTIONS
  /files/tus` và `OPTIONS /files/tus/:id`: spec có nêu phản hồi do giao thức TUS trả (`Tus-Version`, `Tus-Extension`)
  khác với `OPTIONS` của các route thường (`Allow`), để test `OPTIONS` không áp nhầm quy tắc? [Clarity, Spec §FR-001,
  §FR-050]
- [x] CHK034 (chủ dự án chọn: ngoài phạm vi, ghi ở Assumptions) Khi `TUS_ENABLED` khác nhau giữa hai app (vi phạm tiền
  đề dùng chung `.env`), spec có cần nêu hệ quả quan sát được (`GET /files` lộ file dở ở app tắt TUS) hay khẳng định
  ngoài phạm vi? [Gap, Spec §FR-015, Assumptions]

## D. Import từ URL và an toàn mạng (FR-060, FR-061, US5, R-14)

- [x] CHK035 (đã giải: FR-060 ghi không giới hạn kích thước và thời gian; R-14 mở rộng) [P1] Giới hạn kích thước file
  import có được nêu (`FILES_MAX_UPLOAD_SIZE` có áp cho stream tải về không, hay không giới hạn như timeout ở R-14)?
  [Gap, Spec §FR-060]
- [x] CHK036 (đã giải: FR-061 nêu cách mở rộng `0.0.0.0`, IPv6, IPv4-mapped; NAT64, 6to4 không có test) [P1] Danh sách
  IP bị chặn có nêu cách xử lý IPv6 (`::1`, `::`, IPv4-mapped `::ffff:127.0.0.1`) và nghĩa của `0.0.0.0` với interface
  IPv6 không? [Coverage, Spec §FR-061, US5 ca 2]
- [x] CHK037 (đã giải có điều kiện, chờ đo T043: FR-060 nêu `ftp:`, `file:`, URL hỏng `503`; `data:` `500`; 21 lần chuyển hướng) URL không
  phải `http`/`https` (`file:`, `ftp:`, `data:`), URL không hợp lệ, và số lần chuyển hướng tối đa có được nêu kết quả
  (status, mã lỗi, không tạo dòng)? [Gap, Spec §FR-060]
- [x] CHK038 (đã giải: FR-061 nêu một mục lỗi chặn mọi request, danh sách rỗng không chặn gì) "Cấu hình
  `IMPORT_IP_DENY_LIST` lỗi thì chặn" có định nghĩa thế nào là lỗi (chuỗi rỗng, dải sai, CIDR sai) và chặn toàn bộ hay
  chỉ mục lỗi? [Clarity, Spec §FR-061]
- [x] CHK039 (đã giải có điều kiện, chờ đo T043: FR-060 nêu tên rỗng, `Content-Type` thiếu, encoding khác lưu nguyên; `%` hỏng `500`)
  Tên file khi URL cuối không có basename (kết thúc `/`), `Content-Type` thiếu, và `Content-Encoding` không thuộc gzip,
  deflate, br có được nêu kết quả (`filename_download`, đuôi, nội dung lưu)? [Edge Case, Spec §FR-060, US5 ca 1]
- [x] CHK040 (đã giải: FR-060 nêu khớp một mẫu, thứ tự, chỉ so header, `data.type` đè sau kiểm) Ngữ nghĩa
  `options.filterMimeType` (mảng glob, khớp một mục là đủ, so trước hay sau allow list toàn cục) có được nêu đủ để viết
  ca chấp nhận? [Clarity, Spec §FR-060, US5 ca 3]
- [x] CHK041 (đã giải: bảng FR-003 có dòng import: chỉ action `files.upload`) Event của import (`files.upload` có,
  `files.create` không) có được nêu ở FR-003 như multipart, hay còn bỏ ngỏ? [Consistency, Spec §FR-003, §FR-060]
- [x] CHK042 (đã giải: FR-060 nêu kiểm mức collection trước, field ở `createOne`, `update` sau khi tải) Quyền với các
  field trong `data` của import (kiểm `create` theo field như TUS `checkFileAccess` hay chỉ kiểm collection) có được nêu?
  [Gap, Spec §FR-002, §FR-060]

## Chung

- [x] CHK043 (đã giải: thống nhất "file phát sinh", Key Entities ghi là thuật ngữ duy nhất) Thuật ngữ "file phát sinh",
  "ảnh phát sinh", "derived asset" dùng lẫn trong spec; có cần thống nhất một thuật ngữ và ghi vào Key Entities?
  [Consistency, Spec US1 ca 4, §FR-035, Key Entities]
- [x] CHK044 (đã giải: mục Rủi ro nêu bằng chứng tối thiểu theo tiền lệ R-11, R-12) R-13, R-14 ghi "đo và ghi bằng chứng
  khi làm"; spec có nêu bằng chứng tối thiểu (ca test, request, kết quả trên Directus thật) như tiền lệ R-11, R-12 để
  tech lead duyệt được? [Measurability, Spec §Rủi ro]

## Notes

- Đánh `[x]` khi mục đạt hoặc đã sửa spec; ghi kết quả ngay sau mã mục.
- Mục `[P1]` chưa đạt thì chưa chạy `/speckit.tasks`. Hiện không còn mục chưa đạt.
- Mỗi lần chạy `/speckit.checklist` tạo file mới; file này rà bốn nhóm A, B, C, D.
