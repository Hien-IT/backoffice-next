# Checklist chất lượng yêu cầu: Tương thích, an toàn dữ liệu dùng chung, cấu hình

**Purpose**: Kiểm tra spec và plan của feature 001 viết đã đủ rõ, đủ và nhất quán chưa, trước khi chạy `/speckit.tasks`. Đây là "unit test cho yêu cầu", không kiểm tra code.
**Created**: 2026-10-08
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [research.md](../research.md) · [data-model.md](../data-model.md) · [contracts/](../contracts/)

**Phạm vi chọn**: (A) tương thích với Directus, (B) an toàn dữ liệu dùng chung (DB, Redis, storage), (C) cấu hình và biến môi trường, cộng các phần tạm thời chờ feature sau.
**Mức độ**: tiêu chuẩn. **Người dùng**: tác giả spec, rà trước khi chia task. Mục nào chưa đạt thì sửa spec hoặc plan, rồi tích.

## Tương thích với Directus: định nghĩa "giống"

- [x] CHK001 "Giống Directus" được định nghĩa thành quy tắc so sánh cụ thể (so status, header nào, body theo nghĩa nào: từng byte hay tương đương về cấu trúc), hay chỉ là cụm từ chung ở FR-040 đến FR-051? [Clarity, Spec §FR-041–FR-051, §US2]
  - Đã xử lý: FR-103 định nghĩa quy tắc so sánh (status, tập header, body JSON theo cấu trúc, văn bản từng ký tự, `/metrics` so tên).
- [x] CHK002 Tập header phải khớp có nhất quán giữa các nơi không? US2 chỉ kể 3 header (`Content-Type`, `Cache-Control`, `X-Powered-By`), FR-045 nói "header bảo mật" mà không liệt kê, còn research R17 liệt kê 9 header. [Consistency, Spec §US2, §FR-045, Research R17]
  - Đã xử lý: Một tập header duy nhất ở FR-104; US2 (Independent Test), FR-045 và research R17 đều trỏ về đó.
- [x] CHK003 Spec có nêu các giá trị không thể trùng giữa hai server (`info.version` của OpenAPI là hash theo từng request, ETag của OAS, `servers[0].url` phụ thuộc header Host, `observedValue` của health, thứ tự collection) và cách chúng được loại khỏi phép so sánh không? FR-043 chỉ nói "giống Directus". [Ambiguity, Spec §FR-043, §SC-002]
  - Đã xử lý: FR-105 liệt kê giá trị không thể trùng và cách xử lý; FR-043 trỏ tới FR-105. Cùng header Host được gửi tới cả hai server nên `servers[0].url` không cần loại.
- [x] CHK004 Hành vi request có điều kiện (`If-None-Match` trả `304`) và `HEAD`, `OPTIONS` trên `/server/*` đã được quy định chưa? [Gap, Coverage]
  - Đã xử lý: FR-048 và US2 kịch bản 11, đã đo: `HEAD` hoạt động, `If-None-Match` trùng ETag trả `304` (cả ping, health, info).
- [x] CHK005 Hành vi khi gọi sai phương thức trên `/server/*` (ví dụ `POST /server/ping`) đã được quy định chưa? Plan có nêu ca này ở bảng rủi ro, spec thì không. [Gap, Exception Flow, Plan §Complexity Tracking]
  - Đã xử lý: FR-048 và US2 kịch bản 10, đã đo: phương thức khác `GET` trả `404 ROUTE_NOT_FOUND`, không có `405`. Phát hiện thêm: `OPTIONS` khác nhau theo việc route gắn vào Router con hay vào app (research R4, middleware `router-options`).
- [x] CHK006 US2 kịch bản 1 ("ping vẫn trả `pong` kể cả khi token không hợp lệ") có khớp với việc Directus trả `INVALID_PAYLOAD` khi request gửi token cùng lúc ở query `access_token` và header Bearer, vì `extractToken` chạy trước `/server/ping`? Contract còn ghi `400` cho ping. [Conflict, Spec §US2.1, Contracts/server.openapi.yaml]
  - Đã xử lý: Sửa US2 kịch bản 1 và FR-040. Đã đo: Bearer sai vẫn `pong`; token ở cả query và header trả `400 INVALID_PAYLOAD`.
- [x] CHK007 Danh sách field của `project` trong `/server/info` và thứ tự key (ảnh hưởng ETag) có được nêu trong spec, hay chỉ nằm trong contract? FR-042 chỉ viết "đúng danh sách field như Directus". [Completeness, Spec §FR-042]
  - Đã xử lý: FR-042 nêu đủ 17 key theo thứ tự, `public_background` ở cuối (khớp output thật của Directus).
- [x] CHK008 Phạm vi của "cùng message" ở FR-050 có rõ với message chứa phần thay đổi (đường dẫn, lý do, thời gian chờ tính từ thời điểm vượt giới hạn) không? [Clarity, Spec §FR-050]
  - Đã xử lý: FR-050: với `REQUESTS_EXCEEDED` chỉ so định dạng và `extensions.limit`; FR-105 gộp `Retry-After`, `reset`.
- [x] CHK009 Quy tắc đổi thương hiệu chữ "Directus" có đủ cụ thể để phân biệt chữ chỉ app (đổi) với tên bảng `directus_*`, `@directus/sdk`, dữ liệu trong DB (giữ) không? Dòng "Log message có chữ Directus" trong bảng khác biệt không liệt kê message nào được loại trừ. [Clarity, Spec §FR-090, §Khác biệt]
  - Đã xử lý: FR-090 thành quy tắc (đổi khi chỉ chính app, giữ khi là bảng, SDK, dữ liệu DB, biến, mã lỗi, hoặc Directus thật), D-03 trỏ tới `contracts/`; message ngoài hai contract giữ nguyên văn Directus.
- [x] CHK010 Mỗi dòng trong bảng "Khác biệt so với Directus" có mã định danh để khớp với `accepted-differences` của bộ test (FR-101) không? Bảng hiện không có cột mã, trong khi plan và research giả định có `id`. [Traceability, Spec §FR-101, Research R17]
  - Đã xử lý: Bảng khác biệt có cột "Mã" (D-01 đến D-20, D-09.1 đến D-09.9) và cột "Gỡ khi"; FR-101 và data-model §3.1 dùng mã này.

## Phạm vi DB và kiểm thử

- [x] CHK011 "Mọi loại DB Directus hỗ trợ" có kèm khoảng phiên bản được hỗ trợ cho từng loại (Postgres, MySQL, MariaDB, MSSQL, Oracle, CockroachDB) không? [Gap, Spec §FR-020]
  - Đã xử lý: FR-020 và mục Assumptions nêu phiên bản DB theo bộ blackbox của Directus; Oracle ghi rõ CI dùng bản 21 slim.
- [x] CHK012 SC-001 (chạy được trên cả 6 loại DB) có nêu rõ phải đúng ở cổng nào (mọi PR hay chỉ hằng đêm), khi MSSQL, Oracle, CockroachDB chỉ chạy hằng đêm theo FR-112? [Ambiguity, Spec §SC-001, §FR-110, §FR-112]
  - Đã xử lý: SC-001: đúng ở mọi PR cho Postgres, MySQL, SQLite, và ở lượt chạy hằng đêm gần nhất cho các DB còn lại.
- [x] CHK013 MariaDB có yêu cầu kiểm thử riêng không? FR-020 gồm MySQL/MariaDB, nhưng FR-102, FR-110, FR-112 chỉ nêu Postgres, MySQL, SQLite, MSSQL, Oracle, CockroachDB. [Coverage, Gap, Spec §FR-020 vs §FR-102]
  - Đã xử lý: FR-102 và FR-112 thêm MariaDB (hằng đêm). Ghi chú: Nguyên tắc V không liệt kê MariaDB; đã ghi vào Constitution Check.

## An toàn dữ liệu dùng chung

- [x] CHK014 "Chỉ đọc" (FR-022, FR-032) có định nghĩa rõ cho các câu lệnh cấp phiên chạy khi kết nối (SQLite `PRAGMA foreign_keys`, CockroachDB `SET`, Oracle `ALTER SESSION`) không, và snapshot của SC-003 có phủ chúng không? [Ambiguity, Spec §FR-022, §FR-032, §SC-003, Research R7]
  - Đã xử lý: FR-022 liệt kê các câu lệnh cấp phiên được phép; SC-003 loại trạng thái phiên khỏi bản chụp.
- [x] CHK015 Có quy định API phải chạy được (hoặc không đòi quyền ghi) với tài khoản DB chỉ đọc không? [Gap, Dependency]
  - Đã xử lý: FR-024 và US1 kịch bản 10: API phải chạy với tài khoản chỉ SELECT, kiểm bằng role Postgres ở bộ `full`. **Đã xác nhận ngày 2026-10-08.**
- [x] CHK016 US1 kịch bản 9 và SC-003 có nói rõ chỉ phủ bảng `directus_*`, hay cả bảng dữ liệu người dùng? [Clarity, Spec §US1.9, §SC-003]
  - Đã xử lý: FR-022, US1.9 và SC-003 phủ mọi bảng; snapshot (data-model §3.3) chụp mọi bảng.
- [x] CHK017 Yêu cầu phục hồi khi Directus đang nâng cấp dở (đã chạy một phần migration) và orchestrator khởi động lại API có được quy định không: thoát luôn hay chờ và thử lại? [Gap, Recovery, Spec §US3]
  - Đã xử lý: FR-036 và US3 kịch bản 9: thoát ngay, không chờ hay thử lại, log kèm gợi ý; orchestrator lo việc thử lại.
- [x] CHK018 Thời gian chờ kết nối DB và Redis khi khởi động (DB chưa sẵn sàng) có được quy định không? SC-004 ("dừng trong 10 giây") có tính cả thời gian chờ kết nối không, và đo từ lúc nào? [Ambiguity, Spec §SC-004, §FR-030, §US3.7]
  - Đã xử lý: FR-036 và SC-004: 10 giây áp dụng khi DB truy cập được; DB không truy cập được thì theo thời gian chờ của pool (mặc định 60 giây, đã xác minh trong knex 3.1.0).
- [x] CHK019 Hành vi khi Redis không kết nối được lúc khởi động có được viết cụ thể, thay vì "xử lý giống Directus" (không nêu Directus làm gì)? [Ambiguity, Spec §Edge Cases]
  - Đã xử lý: FR-025: không kiểm tra Redis lúc khởi động, không dừng, lỗi hiện qua health, metric, log. Phần "mọi request nhận 500 khi rate limiter Redis chết" suy từ code, có test `server/errors.test.ts` (profile `ratelimit`, T050) xác nhận.
- [x] CHK020 Quy tắc lấy version từ tên file migration tùy biến có xét các đầu vào biên không (file không có dấu `-`, trùng version, phần mở rộng khác `.js`, thư mục rỗng)? [Completeness, Spec §FR-031]
  - Đã xử lý: FR-031 quy định hai thư mục, bộ lọc tên file, cách lấy version, thư mục thiếu hoặc rỗng, trùng version, phân biệt hoa thường.
- [x] CHK021 "Không có xung đột" khi nhiều instance khởi động cùng lúc (US3 kịch bản 8) có đo được không, tức nêu xung đột nào và quan sát bằng cách nào? [Measurability, Spec §US3.8]
  - Đã xử lý: US3 kịch bản 8 viết lại đo được: ba instance, cùng kết quả như chạy một mình, DB không đổi, không cần quyền ghi.
- [x] CHK022 Yêu cầu khi hết `SERVER_SHUTDOWN_TIMEOUT` mà vẫn còn kết nối mở (đóng cưỡng bức, mã thoát, log) có được quy định không? [Gap, Exception Flow, Spec §FR-080]
  - Đã xử lý: FR-080 theo mã nguồn terminus và stoppable: hết hạn thì cắt kết nối còn lại, kết thúc bằng tín hiệu (143 với SIGTERM). Sửa cả `contracts/startup.md` (trước đó ghi mã 0, sai).
- [x] CHK023 Có yêu cầu cho việc nhiều replica và Directus cùng ghi một file kiểm tra trên storage (`directus-health-file`, `directus-metric-file`) cùng lúc không? [Gap, Dependency, Data-model §4]
  - Đã xử lý: Assumptions: không khóa, người ghi sau thắng, nội dung file không được đọc, lỗi ghi tính theo từng lần gọi.
- [x] CHK024 FR-034 (dừng khi gặp storage driver ngoài phạm vi) có mâu thuẫn với Nguyên tắc VIII ("biến Directus chưa hỗ trợ chỉ cảnh báo, không dừng app") không, và ngoại lệ này đã được ghi lại, kể cả trong "Complexity Tracking" của plan, hay plan đang khẳng định "không có vi phạm"? [Conflict, Spec §FR-034, Constitution VIII/XI, Plan §Complexity Tracking]
  - Đã xử lý: D-16 và Complexity Tracking của plan ghi ngoại lệ, kèm lý do và phương án bị loại. **Còn chờ tech lead duyệt trong PR** (Nguyên tắc X); có thể sửa chữ của Nguyên tắc VIII theo Governance nếu muốn đồng bộ.

## Cấu hình và biến môi trường

- [x] CHK025 "Biến chưa hỗ trợ" (FR-014) có tiêu chí hoặc danh sách khách quan ở mức spec, để kiểm được? Hiện danh sách chỉ nằm trong plan (`SUPPORTED_VARIABLES`). [Clarity, Spec §FR-014, §Assumptions]
  - Đã xử lý: FR-014 định nghĩa bằng `contracts/config.md` §5 (nhóm A, B, C) và có điều kiện kiểm; `ADMIN_*` và `PROJECT_OWNER` thuộc nhóm B, không cảnh báo.
- [x] CHK026 Quy tắc cảnh báo có nêu nguồn nào được tính (biến của process, file `CONFIG_PATH`, tên có hậu tố `_FILE`, giá trị mặc định) và cách xử lý biến trùng không? [Completeness, Spec §FR-014]
  - Đã xử lý: FR-014 nêu nguồn (process, file `CONFIG_PATH`, `X_FILE` theo tên `X`), loại giá trị mặc định, mỗi tên một lần, sắp A–Z.
- [x] CHK027 Khi cùng đặt `X` và `X_FILE`, bên nào thắng có được xác định và kiểm chứng với thứ tự lặp trong `createEnv` của Directus (key xử lý sau ghi đè), hay chỉ giả định "giá trị đọc từ file ghi đè"? [Assumption, Spec §Edge Cases]
  - Đã xử lý: Giả định "file luôn thắng" là **sai**. Đã đo trên Directus: key xuất hiện sau thắng. Sửa Edge Cases, thêm FR-016, golden test.
- [x] CHK028 Giá trị ép kiểu không hợp lệ (`number:abc`, `boolean:xyz`, `regex:` sai cú pháp, `json:` hỏng) có được quy định kết quả không? [Gap, Edge Case, Spec §US1.3, §FR-011]
  - Đã xử lý: FR-011, Edge Cases và `contracts/config.md` §3 (đã đo): `number:abc` thành `NaN`, `boolean:xyz` thành `false`, `json:` hỏng giữ chuỗi, `regex:` sai làm API dừng.
- [x] CHK029 Điều kiện phát cảnh báo cho `SERVE_APP` có rõ không? Mặc định của Directus là `true`, nên cảnh báo xuất hiện ở mọi lần khởi động hay chỉ khi được đặt tường minh? [Ambiguity, Spec §Khác biệt "SERVE_APP"]
  - Đã xử lý: D-08 và `contracts/config.md` §5: chỉ cảnh báo khi `SERVE_APP=true` có trong cấu hình thô; `/admin` luôn trả 404.
- [x] CHK030 Gốc để giải đường dẫn tương đối của `CONFIG_PATH`, `STORAGE_LOCAL_ROOT`, `EXTENSIONS_PATH`, đường dẫn trong `_FILE` có được nêu thành yêu cầu không? SC-001 phụ thuộc điều này, hiện chỉ có một câu ở mục "Giữ nguyên". [Completeness, Spec §FR-013, §SC-001]
  - Đã xử lý: FR-017: đường dẫn tương đối giải theo thư mục làm việc (đã đo với `CONFIG_PATH`); image dùng `/directus`.
- [x] CHK031 Hành vi khi file cấu hình `.js` lỗi (export sai kiểu, ném lỗi lúc nạp) có được quy định không? Edge case mới nêu hai dạng export hợp lệ. [Gap, Exception Flow, Spec §FR-013, §Edge Cases]
  - Đã xử lý: FR-013 và `contracts/config.md` §4 (đã đo): JSON hỏng, `.js` export sai kiểu, `X_FILE` không đọc được đều dừng với lỗi gốc.

## Phần tạm thời chờ feature sau

- [x] CHK032 Mỗi dòng "ngoài phạm vi (tạm thời)" có nêu đích danh feature sẽ thay không? Dòng "Các route chưa làm ở feature này" chỉ ghi "002–011". [Clarity, Spec §Khác biệt]
  - Đã xử lý: D-09 kèm bản đồ D-09.1 đến D-09.9; D-10, D-11, D-12, D-14, D-15 đều có feature gỡ cụ thể.
- [x] CHK033 Có yêu cầu gỡ mục tương ứng khỏi `accepted-differences` và giữ nguyên test đối chiếu khi feature sở hữu hoàn thành không? Plan có nói "test giữ nguyên", spec thì không. [Gap, Traceability, Spec §FR-101, Plan §Phần port rút gọn tạm thời]
  - Đã xử lý: FR-101: `removeAt` và kiểm tra tự động `accepted-differences.test.ts`; test đối chiếu của mục tạm thời giữ nguyên. Quy ước `Status: Done` thêm vào Assumptions.
- [x] CHK034 Việc bỏ qua token (request có token admin nhận dữ liệu public) có chủ ý không quan sát được với người vận hành, hay cần một dòng log hoặc dấu hiệu? [Gap, Spec §FR-044]
  - Đã xử lý: FR-044: cảnh báo lần đầu mỗi process, sau đó `debug`; D-10 và D-18 ghi nhận.
- [x] CHK035 Có yêu cầu phi chức năng cho việc `/server/specs/oas` công khai dựng lại toàn bộ schema từ DB ở mỗi request (không cache), như giới hạn tải, rate limit hoặc thời gian phản hồi tối đa? [Gap, Non-Functional, Spec §Assumptions, §FR-043]
  - Đã xử lý: FR-049: chấp nhận rủi ro tới feature 002, rate limiter và pressure limiter áp dụng, khuyến nghị bật rate limiter khi mở Internet; plan ghi vào bảng rủi ro.
- [x] CHK036 SC-006 loại `/server/specs/oas` khỏi benchmark. Có yêu cầu hiệu năng thay thế cho giai đoạn này không? [Gap, Spec §SC-006]
  - Đã xử lý: SC-006 và Assumptions: OAS so với Directus `CACHE_SCHEMA=false` (container `directus-nocache`), cùng ngưỡng 10%.

## Cổng CI (Nguyên tắc X)

- [x] CHK037 Lint, typecheck, unit test kèm ngưỡng coverage (80% `apps/api` và libs BE, 60% `apps/web`) có là bước bắt buộc của mỗi PR không? [Coverage, Spec §FR-110, Constitution X]
  - Đã xử lý: FR-110, US6.2; job `quality` (T097); ngưỡng đặt ở T016, T096, T102.
- [x] CHK038 Test đối chiếu Postgres (đủ), MySQL và SQLite (rút gọn) có chạy ở mỗi PR, và bộ rút gọn có được định nghĩa ở một chỗ không? [Clarity, Spec §FR-102, §FR-110]
  - Đã xử lý: FR-102 định nghĩa bộ rút gọn; job `parity` (T097); T082 chọn file.
- [x] CHK039 E2E cho app web có là cổng PR không? [Coverage, Spec §FR-110, Constitution X]
  - Đã xử lý: FR-110, SC-007; job `e2e` (T097) chạy smoke test T101 trên image của job `docker`.
- [x] CHK040 Build Docker image (`apps/api`, `apps/web`) có là cổng PR không? [Coverage, Spec §FR-110]
  - Đã xử lý: job `docker` (T097).
- [x] CHK041 Quét bảo mật đủ ba loại (dependency: `pnpm audit`, Dependabot; secret: gitleaks; phân tích mã: CodeQL) chưa? [Coverage, Spec §FR-110]
  - Đã xử lý: job `security` (T097), `codeql.yml`, `dependabot.yml`, `.gitleaks.toml` (T098); repo private không có Code Security thì dùng Semgrep CE và ghi Complexity Tracking.
- [x] CHK042 Benchmark ngưỡng 10% có cổng tự động không, và chỗ lệch quy mô thiết kế (2.000 user, 10 triệu bản ghi) đã ghi chưa? [Measurability, Spec §FR-113, §SC-006, Constitution X]
  - Đã xử lý: FR-113; T093, T095, job `benchmark` (T097); ngoại lệ quy mô ghi ở Complexity Tracking của plan, tech lead duyệt (T112).
- [x] CHK043 Sửa `directus/` có bị chặn tự động không? [Coverage, Spec §FR-111, Constitution I]
  - Đã xử lý: FR-111; T092, T094, job `guard-directus` (T097).
- [x] CHK044 DB chỉ chạy hằng đêm (MariaDB, MSSQL, Oracle, CockroachDB, Postgres 10, MySQL 5) có lịch và cách báo lỗi không? [Coverage, Spec §FR-112, §SC-001]
  - Đã xử lý: FR-112; `nightly.yml` (T098), tải artifact log khi fail.

## Notes

- Rà lại ngày 2026-10-08, sau khi sửa spec, plan, research, data-model, quickstart và contracts. Cả 44 mục
  đạt (CHK037–CHK044 thêm khi rà cổng CI). Mỗi mục có dòng "Đã xử lý" trỏ tới chỗ trả lời.
- Việc rà lại có đo thực tế trên Directus 11.17.4 (cổng 8055 và image Docker), nên 4 điều trong bản nháp
  trước là **sai** và đã sửa:
  1. Khi cùng đặt `X` và `X_FILE`, key xuất hiện sau thắng, không phải "file luôn thắng" (CHK027).
  2. Migration tùy biến nằm ở `MIGRATIONS_PATH`, không chỉ `EXTENSIONS_PATH/migrations`. Bản nháp trước sẽ
     coi migration tùy biến đã chạy là "thừa" và chặn API khởi động (CHK020). Điều này chỉnh lại nội dung
     câu trả lời Q3 của bạn ở bước clarify; ý định (chấp nhận migration tùy biến, không chạy) giữ nguyên.
  3. Tắt máy kết thúc bằng tín hiệu (mã 143), không phải mã 0 (CHK022, `contracts/startup.md`).
  4. `/server/ping` kèm token ở cả query lẫn header trả `400`, trái với kịch bản cũ "luôn pong" (CHK006).
- Quyết định mặc định (**đã được người dùng xác nhận giữ nguyên ngày 2026-10-08**):
  - **CHK015, FR-024**: API phải chạy được với tài khoản DB chỉ có SELECT, kiểm trên Postgres.
  - **CHK013, FR-112**: thêm MariaDB vào chạy hằng đêm (Nguyên tắc V không liệt kê MariaDB).
  - **CHK034, FR-044**: ghi một cảnh báo (lần đầu mỗi process) khi request mang token nhưng bị bỏ qua.
  - **CHK035, FR-049**: chấp nhận rủi ro tải của `/server/specs/oas` chưa cache tới feature 002.
  - **CHK029**: không cảnh báo `SERVE_APP` khi để mặc định, chỉ khi đặt tường minh.
- Còn mở ngoài phạm vi spec (không chặn `/speckit.tasks`):
  - **CHK024**: ngoại lệ FR-034 so với Nguyên tắc VIII chờ tech lead duyệt trong PR, hoặc sửa chữ Nguyên tắc
    VIII qua quy trình Governance.
  - **CHK019**: kết luận "rate limiter Redis chết thì mọi request nhận 500" suy từ code, chưa chạy thử; T050 xác nhận.
- Không có mục nào kiểm tra hành vi của code. Khi tasks được tạo, mỗi mục "Đã xử lý" trở thành nguồn cho
  một test đối chiếu hoặc unit test.
