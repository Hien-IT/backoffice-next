# Feature Specification: Nền tảng workspace và kết nối hệ thống

**Feature Branch**: `001-platform-foundation`
**Created**: 2026-10-08
**Status**: Draft
**Input**: User description: "Nền tảng cho app mới clone Directus 11.17.4. Cần có monorepo chứa app API, app web và các thư viện dùng chung. API đọc toàn bộ biến môi trường của Directus với cùng tên, cùng giá trị mặc định, cùng tiền tố ép kiểu (string:, number:, regex:, array:, json:, boolean:), hậu tố _FILE và CONFIG_PATH (file .env, .json, .yaml, .js), biến chưa hỗ trợ thì chỉ cảnh báo (tham chiếu directus/packages/env). Một file .env đang chạy được cho Directus phải chạy được ngay cho API mới. Kết nối được tới mọi loại DB mà Directus hỗ trợ (Postgres, MySQL/MariaDB, SQLite, MSSQL, Oracle, CockroachDB) và tới Redis. Khi khởi động, API đọc bảng directus_migrations và so với danh sách migration của Directus 11.17.4. Nếu thiếu hoặc thừa migration, API dừng và báo rõ migration nào lệch. API không bao giờ tạo hay sửa bảng directus_*. Có các endpoint /server/ping, /server/health, /server/info, /server/specs/oas trả về giống Directus. Lỗi trả về đúng format errors[] và mã lỗi của Directus (tham chiếu packages/errors). Log JSON giống Directus (LOG_LEVEL, LOG_STYLE, có request id) và endpoint /metrics Prometheus theo METRICS_*. Có bộ test đối chiếu: cùng request gửi tới Directus thật và app mới, rồi so sánh kết quả. Có pipeline GitHub Actions chạy lint, typecheck, unit test kèm ngưỡng coverage, test đối chiếu (Postgres đủ, MySQL và SQLite rút gọn), quét bảo mật và benchmark so với Directus. Tên hiển thị, log, header X-Powered-By và package nội bộ dùng tên Backoffice. Tiêu chí chấp nhận: chạy app mới bằng đúng file .env của Directus, cạnh Directus trên cùng DB và Redis; các endpoint /server/* trả về giống nhau, ngoại trừ các khác biệt do đổi thương hiệu đã liệt kê; DB không bị thay đổi."

**Tham chiếu Directus** (chỉ đọc):

- Biến môi trường: `directus/packages/env/src` (`constants/defaults.ts`, `constants/directus-variables.ts`, `constants/type-map.ts`, `lib/create-env.ts`, `lib/cast.ts`, `utils/*`).
- Khởi động và middleware: `directus/api/src/app.ts`, `directus/api/src/server.ts`, `directus/api/src/database/index.ts` (`validateDatabaseConnection`, `isInstalled`, `validateMigrations`, `validateDatabaseExtensions`).
- Danh sách migration 11.17.4: `directus/api/src/database/migrations/*` (101 version từ `20201028A` tới `20260211A`; thư mục có 103 file, gồm `run.ts` và `run.test.ts`).
- Endpoint: `directus/api/src/controllers/server.ts`, `directus/api/src/services/server.ts`, `directus/api/src/services/specifications.ts`, `directus/packages/specs`.
- Lỗi: `directus/packages/errors`, `directus/api/src/middleware/error-handler.ts`.
- Log và metrics: `directus/api/src/logger`, `directus/api/src/metrics`, `directus/api/src/controllers/metrics.ts`.
- Test đối chiếu: `directus/tests/blackbox`.

## Clarifications

### Session 2026-10-08

- Q: Request có token gọi `/server/*` làm ở feature nào? → A: 001 chỉ làm đúng phần public, gồm
  OAS cho public (đọc schema và quyền public, chỉ đọc). Request có token tạm được trả như public.
  Phần có token làm ở 003/004.
- Q: Storage location dùng driver ngoài `local`/`s3` thì sao? → A: Dừng khi khởi động, báo rõ
  location và driver không hỗ trợ. SC-001 chỉ áp dụng cho cấu hình trong phạm vi hỗ trợ.
- Q: Số phiên bản trả về ở `/server/info`, `/server/health`, OpenAPI? → A: `11.17.4` ở cả ba chỗ.
  Phiên bản riêng của Backoffice chỉ ghi trong log khởi động. (Bổ sung khi lập plan: `info.version`
  của OpenAPI là hash thời điểm request, không phải số phiên bản, nên quyết định chỉ áp dụng cho
  `/server/info` và `/server/health`.)
- Q: `directus_migrations` có version của migration tùy biến thì sao? → A: Coi là hợp lệ nếu có file
  cùng version trong thư mục migration tùy biến (chỉ đọc tên file, không chạy), ghi cảnh báo liệt kê
  chúng. Version lạ khác vẫn làm API dừng. App mới không chạy migration nào. (Chỉnh khi rà checklist:
  thư mục tùy biến là `MIGRATIONS_PATH`, mặc định `./migrations`, nơi Directus chạy migration tùy biến,
  và cả `EXTENSIONS_PATH/migrations`, nơi bước kiểm tra khởi động của Directus tìm. Xem FR-031.)
- Q: Request id trong log sinh thế nào? → A: Giống hệt Directus: số tăng dần trong từng process,
  không đọc header, không thêm header vào response.
- Q: Cấu hình không có Redis hoặc chọn store `memory` thì sao? → A: Theo đúng `*_STORE` và
  `REDIS*` như Directus, ghi cảnh báo khi khởi động rằng cấu hình chỉ an toàn khi chạy một instance.

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là đội vận hành (triển khai API mới cạnh Directus), lập trình viên
(làm việc trong monorepo) và client đang gọi Directus (SDK, app, hệ thống giám sát).

### User Story 1 - Chạy API mới bằng đúng cấu hình của Directus (Priority: P1)

Đội vận hành lấy nguyên file `.env` (hoặc file cấu hình qua `CONFIG_PATH`, hoặc biến môi trường
của container) đang chạy cho Directus 11.17.4, khởi động API mới với cấu hình đó, cạnh một
Directus đang chạy, trên cùng DB và Redis. API mới khởi động thành công, không cần khai báo thêm
biến nào, và không ghi gì vào DB.

**Why this priority**: Đây là điều kiện tiên quyết cho mọi feature sau. Nếu không chạy được bằng
cấu hình của Directus, đội vận hành phải duy trì hai bộ cấu hình, trái Nguyên tắc VIII.

**Independent Test**: Dùng `dev/directus-reference/.env`, khởi động API mới cạnh Directus tham
chiếu. Chụp toàn bộ schema và dữ liệu mọi bảng (`directus_*` và bảng người dùng) trước và sau khi API
mới khởi động, chạy và tắt. Hai bản chụp phải giống hệt nhau.

**Acceptance Scenarios**:

1. **Given** một file `.env` Directus đang dùng được, **When** khởi động API mới với file đó,
   **Then** API mới khởi động thành công và trả `pong` ở `/server/ping`.
2. **Given** cấu hình chỉ có biến bắt buộc, **When** khởi động, **Then** mọi biến còn lại nhận
   đúng giá trị mặc định của Directus 11.17.4 (ví dụ `PORT` = 8055, `LOG_LEVEL` = `info`).
3. **Given** biến có tiền tố ép kiểu (ví dụ `number:3000`, `array:a,b`, `json:{...}`,
   `regex:^a`, `boolean:true`, `string:123`), **When** khởi động, **Then** giá trị được đọc ra
   đúng kiểu như Directus đọc.
4. **Given** `SECRET_FILE=/run/secrets/secret`, **When** khởi động, **Then** `SECRET` nhận nội
   dung file đó, giống Directus.
5. **Given** `CONFIG_PATH` trỏ tới file `.env`, `.json`, `.yaml`/`.yml` hoặc `.js`, **When** khởi
   động, **Then** cấu hình được đọc từ file đó, và giá trị trong file ghi đè biến môi trường của
   process, giống Directus.
6. **Given** cấu hình có biến Directus mà API mới chưa hỗ trợ (ví dụ `AUTH_*`, `EMAIL_*` khi các
   feature đó chưa làm), **When** khởi động, **Then** API mới ghi cảnh báo nêu tên biến (không nêu
   giá trị) và vẫn chạy tiếp.
7. **Given** `DB_CLIENT` là một trong các loại DB Directus hỗ trợ (Postgres, MySQL/MariaDB, SQLite,
   MSSQL, Oracle, CockroachDB) và DB đã được Directus 11.17.4 cài đặt, **When** khởi động, **Then**
   API mới kết nối thành công.
8. **Given** cấu hình có `REDIS` hoặc `REDIS_*`, **When** khởi động, **Then** API mới kết nối tới
   Redis đó.
9. **Given** hai bản chụp DB trước và sau khi API mới khởi động, phục vụ request ở mọi endpoint
   của feature này và tắt, **When** so sánh, **Then** không có bảng, cột, index hay dòng dữ liệu nào
   (cả `directus_*` lẫn bảng dữ liệu người dùng) bị tạo, sửa hoặc xóa.
10. **Given** tài khoản DB chỉ có quyền đọc (không INSERT, UPDATE, DELETE, DDL), **When** khởi động và
    phục vụ request ở mọi endpoint của feature này, **Then** API mới chạy bình thường (FR-024).

---

### User Story 2 - Các endpoint `/server/*` trả về giống Directus (Priority: P1)

Client đang gọi Directus (SDK, Directus app, load balancer, Kubernetes probe) gọi
`/server/ping`, `/server/health`, `/server/info`, `/server/specs/oas` trên API mới và nhận về
cùng status, header và body như Directus, trừ các khác biệt đã liệt kê ở mục "Khác biệt so với
Directus".

**Why this priority**: Đây là tiêu chí chấp nhận chính của feature và là bằng chứng đầu tiên rằng
API mới thay được Directus sau load balancer.

**Independent Test**: Gửi cùng một bộ request tới Directus tham chiếu và API mới, so sánh status,
tập header ở FR-104 và body theo quy tắc ở FR-103.

**Acceptance Scenarios**:

1. **Given** API mới đang chạy, **When** gọi `GET /server/ping`, **Then** nhận `200`,
   `Content-Type: text/html; charset=utf-8`, body `pong`, giống Directus, kể cả khi request mang một
   token không hợp lệ (header Bearer hoặc `access_token`). Nếu request mang token ở cả query
   `access_token` lẫn header Bearer thì nhận `400 INVALID_PAYLOAD`, vì bước đọc token chạy trước
   `/server/ping` (giống Directus, đã đo).
2. **Given** DB, cache, rate limiter và storage đều ổn, **When** gọi `GET /server/health` không
   kèm token, **Then** nhận `200`, `Content-Type: application/health+json`, body
   `{"status":"ok"}`, `Cache-Control: no-cache`.
3. **Given** DB không kết nối được, **When** gọi `/server/health`, **Then** nhận `503` với
   `{"status":"error"}`, giống Directus.
4. **Given** một thành phần chậm hơn ngưỡng (`DB_HEALTHCHECK_THRESHOLD`,
   `CACHE_HEALTHCHECK_THRESHOLD`, `RATE_LIMITER_HEALTHCHECK_THRESHOLD`,
   `RATE_LIMITER_GLOBAL_HEALTHCHECK_THRESHOLD`, `STORAGE_<LOCATION>_HEALTHCHECK_THRESHOLD`),
   **When** gọi `/server/health`, **Then** nhận `200` với `{"status":"warn"}`.
5. **Given** request không kèm token, **When** gọi `GET /server/info`, **Then** body chứa
   `project` (đọc từ `directus_settings`, đúng danh sách field như Directus) và `setupCompleted`,
   và chỉ có `version` khi chưa có user nào, giống Directus.
6. **Given** request không kèm token và `OPENAPI_ENABLED` khác `false`, **When** gọi
   `GET /server/specs/oas`, **Then** nhận tài liệu OpenAPI giống Directus cho người dùng public.
7. **Given** `OPENAPI_ENABLED=false`, **When** gọi `/server/specs/oas`, **Then** nhận lỗi
   `ROUTE_NOT_FOUND` giống Directus.
8. **Given** request kèm token (hợp lệ hay không), **When** gọi `/server/info`, `/server/health`,
   `/server/specs/oas`, `/metrics`, **Then** ở feature này API mới trả như request public. Phần dành cho user
   đã đăng nhập và admin được làm ở feature 003/004 (khác biệt tạm thời, đã liệt kê).
9. **Given** bất kỳ response nào của API mới (trừ `503` của pressure limiter, FR-045), **When** đọc
   header, **Then** `X-Powered-By` là `Backoffice`.
10. **Given** request không phải `GET` tới một route `/server/*` (ví dụ `POST /server/ping`,
    `POST /server/health`), **When** gọi, **Then** nhận `404 ROUTE_NOT_FOUND`, không có `405`, giống
    Directus (đã đo; riêng `/server/setup` là D-14). Riêng `OPTIONS` tới route của router (`/server/info`, `/server/health`,
    `/server/specs/oas`, `/metrics` khi bật) nhận `200` với `Allow: GET,HEAD`; `OPTIONS /server/ping`
    nhận `404`.
11. **Given** request `HEAD` hoặc request `GET` kèm `If-None-Match` trùng `ETag` đã nhận, **When** gọi
    `/server/ping`, `/server/health`, `/server/info`, **Then** `HEAD` trả cùng header không có body, và
    request có điều kiện trả `304` kèm `ETag`, giống Directus (đã đo).
12. **Given** đường dẫn có dấu `/` cuối hoặc khác chữ hoa chữ thường (`/server/ping/`, `/SERVER/ping`),
    **When** gọi, **Then** được phục vụ như đường dẫn gốc, giống Directus (đã đo).
13. **Given** `GET /` và biến `ROOT_REDIRECT` ở mặc định (`./admin`), **When** gọi, **Then** nhận `302`
    với `Location: ./admin`, giống Directus (đã đo).

---

### User Story 3 - Dừng khởi động khi migration lệch (Priority: P1)

Đội vận hành khởi động API mới trên một DB mà Directus chưa migrate đủ, hoặc đã được migrate bởi
một bản Directus khác 11.17.4. API mới không chạy, và log chỉ rõ migration nào thiếu, migration
nào thừa, để đội vận hành biết phải nâng hay hạ Directus.

**Why this priority**: Chạy trên schema hệ thống khác phiên bản sẽ đọc ghi sai dữ liệu dùng chung
với Directus (Nguyên tắc II). Phải chặn ngay từ khi khởi động.

**Independent Test**: Chuẩn bị ba DB: đủ migration 11.17.4, thiếu một migration, thừa một
migration lạ. Khởi động API mới trên từng DB và kiểm tra kết quả và log.

**Acceptance Scenarios**:

1. **Given** `directus_migrations` có đúng danh sách migration của 11.17.4, **When** khởi động,
   **Then** API mới chạy bình thường.
2. **Given** `directus_migrations` thiếu một hoặc nhiều migration, **When** khởi động, **Then** API
   mới dừng với mã thoát khác 0, log lỗi liệt kê từng version thiếu (ví dụ `20260211A`).
3. **Given** `directus_migrations` có version không nằm trong danh sách 11.17.4 và không có file
   tương ứng trong thư mục migration tùy biến (`MIGRATIONS_PATH`, `EXTENSIONS_PATH/migrations`),
   **When** khởi động, **Then** API mới dừng với mã thoát khác 0, log lỗi liệt kê từng version thừa.
4. **Given** `directus_migrations` có version của migration tùy biến và file tương ứng nằm trong một
   trong hai thư mục trên, **When** khởi động, **Then** API mới chạy bình thường, ghi cảnh báo liệt kê
   version tùy biến, và không thực thi file nào.
5. **Given** vừa thiếu vừa thừa, **When** khởi động, **Then** log liệt kê cả hai nhóm trong cùng
   một lần chạy.
6. **Given** DB chưa có bảng `directus_collections` (Directus chưa cài), **When** khởi động,
   **Then** API mới dừng với lỗi báo DB chưa được cài đặt, giống Directus.
7. **Given** không kết nối được DB, **When** khởi động, **Then** API mới dừng với lỗi
   `Can't connect to the database.` giống Directus.
8. **Given** ba instance API mới khởi động cùng lúc trên cùng DB (cùng một DB lệch migration, rồi cùng
   một DB đủ migration), **When** cùng kiểm tra migration, **Then** mỗi instance có kết quả như khi chạy
   một mình (cùng mã thoát, cùng nội dung log lỗi), bản chụp DB không đổi, và không instance nào cần
   quyền ghi (FR-024).
9. **Given** Directus đang nâng cấp dở (đã chạy một phần migration) và API mới được orchestrator khởi
   động lại, **When** kiểm tra migration, **Then** API mới dừng ngay như ở kịch bản 2 (không chờ, không
   thử lại), log có thêm gợi ý chờ Directus migrate xong rồi khởi động lại (FR-036).

---

### User Story 4 - Bộ test đối chiếu với Directus thật (Priority: P2)

Lập trình viên chạy một lệnh để gửi cùng một bộ request tới Directus 11.17.4 thật và API mới, rồi
nhận báo cáo khác biệt về status, header, body và tác động lên DB. Khác biệt đã được chấp nhận
(đổi thương hiệu, giá trị thay đổi theo thời gian như `observedValue`) được bỏ qua theo một danh
sách khai báo rõ ràng.

**Why this priority**: Nguyên tắc V bắt buộc mọi endpoint có test đối chiếu. Bộ khung này được dùng
lại cho mọi feature sau.

**Independent Test**: Chạy bộ test với Directus tham chiếu và API mới. Cố ý đổi một chi tiết
response ở API mới và kiểm tra bộ test báo đúng chỗ khác.

**Acceptance Scenarios**:

1. **Given** Directus và API mới cùng chạy trên một DB, **When** chạy bộ test đối chiếu cho
   `/server/*`, **Then** mọi test đạt, chỉ bỏ qua khác biệt có trong danh sách chấp nhận.
2. **Given** một khác biệt không có trong danh sách chấp nhận, **When** chạy test, **Then** test
   fail và báo rõ endpoint, trường và giá trị ở hai bên.
3. **Given** bộ test, **When** chạy xong, **Then** bộ test xác nhận bảng `directus_*` không bị API
   mới thay đổi.
4. **Given** bộ test cần chạy trên Postgres, MySQL, MariaDB, SQLite, MSSQL, Oracle và CockroachDB,
   **When** cấu hình loại DB, **Then** cùng bộ test chạy được trên từng loại DB.

---

### User Story 5 - Log và metrics giống Directus (Priority: P2)

Đội vận hành thu log của API mới vào cùng hệ thống log đang dùng cho Directus và scrape `/metrics`
vào cùng dashboard Prometheus, không phải đổi cấu hình thu thập.

**Why this priority**: Vận hành song song cần quan sát được cả hai app bằng cùng công cụ
(Nguyên tắc X).

**Independent Test**: Chạy API mới với `LOG_STYLE=raw`, gửi request, kiểm tra từng dòng log là JSON
có cùng các trường như Directus và có request id. Bật `METRICS_ENABLED=true`, scrape `/metrics` ở
hai app và so tên metric.

**Acceptance Scenarios**:

1. **Given** `LOG_STYLE=raw`, **When** API mới chạy và nhận request, **Then** mỗi dòng log là JSON
   với cấu trúc như Directus, log HTTP có request id, method, url, status và thời gian xử lý.
2. **Given** `LOG_STYLE` khác `raw` (mặc định `pretty`), **When** chạy, **Then** log hiển thị dạng
   dễ đọc như Directus.
3. **Given** `LOG_LEVEL=warn`, **When** chạy, **Then** không có log dưới mức `warn`.
4. **Given** request có header `Authorization` hoặc `Cookie`, **When** ghi log HTTP, **Then** giá
   trị các header đó bị che giống Directus.
5. **Given** `LOG_HTTP_IGNORE_PATHS=/server/health`, **When** gọi `/server/health`, **Then** không
   có log HTTP cho request đó.
6. **Given** `METRICS_ENABLED=true` và `METRICS_TOKENS` có token `abc`, **When** gọi `/metrics` với
   header `Authorization: Metrics abc`, **Then** nhận nội dung định dạng Prometheus, tên metric
   dùng tiền tố `METRICS_NAME_PREFIX` (mặc định `directus_`) và trùng tên với Directus cho các
   dịch vụ trong `METRICS_SERVICES`.
7. **Given** `METRICS_ENABLED=true`, **When** gọi `/metrics` không có token hợp lệ, **Then** nhận
   lỗi `FORBIDDEN` giống Directus.
8. **Given** `METRICS_ENABLED=false` (mặc định), **When** gọi `/metrics`, **Then** nhận
   `ROUTE_NOT_FOUND` giống Directus.

---

### User Story 6 - Pipeline CI chặn thay đổi không đạt chuẩn (Priority: P2)

Mỗi pull request và mỗi lần push `main` tự động chạy lint, typecheck, unit test kèm ngưỡng coverage, test đối
chiếu (Postgres đủ, MySQL và SQLite rút gọn), E2E khói cho app web, quét bảo mật, benchmark so với Directus và
build image. Bước nào không đạt thì CI báo fail ở job đó và được sửa ngay ở commit tiếp theo (SC-007).

**Why this priority**: Cổng chất lượng cần có từ feature đầu tiên để mọi feature sau được kiểm tra
cùng một cách (Nguyên tắc X).

**Independent Test**: Mở một PR thử có lỗi lint, một PR làm coverage tụt dưới ngưỡng, một PR có
secret giả, một PR làm response `/server/info` khác Directus. Cả bốn đều bị chặn.

**Acceptance Scenarios**:

1. **Given** một PR, **When** pipeline chạy, **Then** có các bước riêng: lint, typecheck, unit test
   kèm coverage, test đối chiếu Postgres (đủ), MySQL (rút gọn), SQLite (rút gọn), quét dependency,
   quét secret, phân tích mã, benchmark, E2E (app web), build image.
2. **Given** coverage của API hoặc libs BE dưới 80%, hoặc của app web dưới 60%, **When** pipeline
   chạy, **Then** bước unit test fail.
3. **Given** PR có thay đổi trong `directus/`, **When** pipeline chạy, **Then** pipeline fail.
4. **Given** benchmark các endpoint của feature này, **When** p95 latency hoặc throughput của API
   mới tệ hơn Directus quá 10%, **Then** bước benchmark fail.
5. **Given** lịch chạy hằng đêm, **When** tới giờ, **Then** test đối chiếu đủ chạy trên MariaDB, MSSQL,
   Oracle, CockroachDB, và trên các phiên bản cũ Directus kiểm thử (Postgres 10, MySQL 5).

---

### User Story 7 - Workspace monorepo cho lập trình viên (Priority: P3)

Lập trình viên clone repo, cài dependency bằng một lệnh, rồi build, lint, test và chạy từng phần
(app API, app web, các thư viện dùng chung) bằng lệnh thống nhất. Thư viện nội bộ mang tên
`@backoffice/*`.

**Why this priority**: Cần có để làm mọi việc khác, nhưng giá trị nhìn thấy được nằm ở US1–US6.

**Independent Test**: Trên máy sạch có đúng phiên bản runtime và trình quản lý package như Directus,
clone repo, cài dependency, chạy build, lint, test cho toàn workspace. Tất cả đạt.

**Acceptance Scenarios**:

1. **Given** repo mới clone, **When** cài dependency và chạy build toàn workspace, **Then** app API,
   app web và mọi thư viện build thành công.
2. **Given** app web ở feature này, **When** build và mở, **Then** app web chỉ là khung tối thiểu
   (chưa có màn hình nghiệp vụ), đọc cấu hình lúc chạy và hiển thị tên Backoffice.
3. **Given** một thư viện dùng chung (ví dụ lỗi, biến môi trường), **When** app API dùng nó,
   **Then** import theo tên `@backoffice/<tên>`.
4. **Given** một file được port từ `directus/`, **When** đọc đầu file, **Then** có comment ghi
   đường dẫn file gốc.

---

### Edge Cases

- Biến Directus có cả `X` và `X_FILE`: key xuất hiện sau trong cấu hình thắng, giống Directus (đã đo,
  xem FR-016 và `contracts/config.md`). Khuyến nghị không đặt cả hai.
- Giá trị ép kiểu không hợp lệ: `number:abc` thành `NaN`, `boolean:xyz` thành `false`, `json:` hỏng giữ
  chuỗi gốc, `regex:` sai cú pháp làm API dừng khi khởi động (đã đo, `contracts/config.md` §3).
- File trong `X_FILE` không đọc được: API mới dừng với lỗi nêu tên biến và giá trị thô của nó (đường dẫn, kể cả
  tiền tố ép kiểu nếu có), giống Directus.
- `CONFIG_PATH` trỏ tới file không tồn tại: bỏ qua file, chỉ dùng biến môi trường của process,
  giống Directus.
- File `.js` cấu hình export một hàm nhận `env` hoặc export object: đọc được cả hai dạng như
  Directus. Export kiểu khác, file `.json` hoặc `.yaml` sai cú pháp: API dừng với lỗi gốc (FR-013).
- Biến có tên dạng `LOGGER_*`, `DB_*` không có trong danh sách mặc định: vẫn được nhận là biến Directus (mẫu
  `LOGGER_.+`, `DB_.+` của `directus-variables.ts`). Với Redis chỉ các tên liệt kê (`REDIS`, `REDIS_ENABLED`,
  `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_*_NAMESPACE`) là biến Directus;
  `REDIS_FOO` thì không (không mở rộng `REDIS_FOO_FILE`, không cảnh báo), giống Directus.
- Biến không phải của Directus (ví dụ `PATH`, `HOME`): không cảnh báo.
- `SECRET` trống hoặc ngắn hơn 32 byte: ghi cảnh báo giống Directus (nguyên văn); khi trống, ghi thêm một dòng nói
  rõ token không dùng chéo được với Directus (FR-033, D-18).
- `PUBLIC_URL` không phải URL tuyệt đối: ghi cảnh báo giống Directus.
- Postgres chưa có PostGIS, SQLite chưa có Spatialite: ghi cảnh báo giống Directus, vẫn chạy.
- Không có `REDIS*` hoặc store là `memory`: vẫn chạy, ghi cảnh báo chỉ an toàn với một instance
  (FR-023).
- Redis không kết nối được: API vẫn khởi động (không kiểm tra Redis lúc khởi động), lỗi hiện qua health,
  metric và log (FR-025).
- Cổng `PORT` đã bị chiếm: API dừng với mã thoát khác 0 và log `Port <port> is already in use`, giống
  Directus.
- Bảng `directus_settings` chưa có dòng nào (chỉ xảy ra khi bị xóa tay, vì migration `20250613A` của
  Directus luôn tạo một dòng): `/server/info` trả các field có giá trị mặc định khác null của cột,
  giống Directus.
- Request tới path chưa có ở API mới: trả `404` với lỗi `ROUTE_NOT_FOUND` đúng format Directus (kèm token sai
  hoặc query sai: xem D-10, D-12).
- Body JSON sai cú pháp hoặc vượt `MAX_PAYLOAD_SIZE`: trả `INVALID_PAYLOAD` hoặc lỗi kích thước
  giống Directus.
- Bật rate limiter (`RATE_LIMITER_ENABLED`, `RATE_LIMITER_GLOBAL_ENABLED`): vượt giới hạn trả
  `429` với mã lỗi Directus; khi `RATE_LIMITER_STORE=redis` thì đếm chung với Directus.
- Nhận SIGTERM khi đang có request: xem FR-080 (chạy nốt request đang dở tối đa
  `SERVER_SHUTDOWN_TIMEOUT`, hết hạn thì cắt kết nối còn lại, đóng DB và Redis, kết thúc bằng chính
  tín hiệu nhận được).
- `STORAGE_LOCATIONS` có location dùng driver `gcs`, `azure`, `cloudinary` hoặc `supabase`: dừng khi
  khởi động, báo rõ location nào (FR-034).
- `directus_migrations` có migration tùy biến: hợp lệ nếu file cùng version có trong `MIGRATIONS_PATH`
  hoặc `EXTENSIONS_PATH/migrations`, kèm cảnh báo (FR-031, FR-035). File có trong thư mục nhưng version
  chưa có trong DB (Directus chưa kịp chạy): tính là thiếu, API dừng.
- Thư mục migration tùy biến không tồn tại hoặc rỗng: không có version tùy biến nào. Ở `MIGRATIONS_PATH`, file
  không có dấu `-` hoặc sai phần mở rộng bị bỏ qua. Ở `EXTENSIONS_PATH/migrations`, mọi file `.js` đều được tính như
  Directus; file không có `-` (ví dụ `utils.js`) cho version là cả tên file, nên bị báo thiếu và API dừng (FR-031, D-05).

## Requirements *(mandatory)*

### Functional Requirements

**Workspace**

- **FR-001**: Repo PHẢI là một monorepo gồm app API, app web và các thư viện dùng chung, dùng cùng
  phiên bản runtime và trình quản lý package như Directus 11.17.4.
- **FR-002**: Thư viện nội bộ PHẢI mang tên `@backoffice/*`. Thư viện bên thứ ba của Directus (ví
  dụ `@directus/sdk`) giữ nguyên tên.
- **FR-003**: App web ở feature này PHẢI build được, đọc cấu hình lúc chạy (không ghi cứng lúc
  build) và hiển thị tên Backoffice. Màn hình nghiệp vụ thuộc feature 012 trở đi.
- **FR-004**: Workspace PHẢI có lệnh thống nhất để build, lint, typecheck, test cho từng phần và
  cho toàn bộ.

**Biến môi trường**

- **FR-010**: API PHẢI nhận đúng tập biến Directus 11.17.4 nhận (danh sách tên và mẫu tên trong
  `directus-variables.ts`), với cùng giá trị mặc định (`defaults.ts`) và cùng kiểu mặc định theo
  tên biến (`type-map.ts`).
- **FR-011**: API PHẢI ép kiểu giống Directus: tiền tố `string:`, `number:`, `regex:`, `array:`,
  `json:`, `boolean:`, và tự đoán kiểu khi không có tiền tố, kể cả với giá trị không hợp lệ. Kết quả
  chuẩn (đã đo trên Directus 11.17.4) nằm ở `contracts/config.md` §3.
- **FR-012**: API PHẢI đọc biến có hậu tố `_FILE` từ nội dung file, giữ tiền tố ép kiểu nếu có,
  giống Directus.
- **FR-013**: API PHẢI đọc file cấu hình theo `CONFIG_PATH` (mặc định `.env` ở thư mục làm việc),
  hỗ trợ `.env`, `.json`, `.yaml`, `.yml`, `.js`, và giá trị trong file ghi đè biến môi trường
  của process, giống Directus. `CONFIG_PATH` trỏ tới file không tồn tại thì bỏ qua file. File lỗi
  (JSON hoặc YAML sai cú pháp, `.js` export không phải hàm hoặc object) làm API dừng với mã thoát khác 0
  và lỗi gốc (`contracts/config.md` §4).
- **FR-014**: Biến "chưa hỗ trợ" là biến thuộc `DIRECTUS_VARIABLES` của Directus 11.17.4 có mặt trong
  cấu hình thô (biến của process hoặc file `CONFIG_PATH`; key `X_FILE` tính theo tên `X`) và không
  thuộc nhóm A (hỗ trợ) hoặc nhóm B (không áp dụng cho API) trong `contracts/config.md` §5. Khi có biến
  như vậy, API PHẢI ghi đúng một cảnh báo khi khởi động, liệt kê tên (sắp xếp A–Z, mỗi tên một lần,
  không bao giờ ghi giá trị), và tiếp tục chạy. Giá trị mặc định không tính là "đã đặt".
- **FR-015**: Biến chỉ API mới hoặc app web mới cần PHẢI có tiền tố `BACKOFFICE_` và giá trị mặc định an
  toàn. Feature này KHÔNG thêm biến nào thay thế biến Directus đã có. Container app web lấy URL API từ biến
  Directus `PUBLIC_URL` lúc khởi động (Nguyên tắc VIII), mặc định `/`.
- **FR-016**: Khi cùng đặt `X` và `X_FILE` (với `X` là biến Directus), giá trị cuối do thứ tự khai báo
  quyết định: key xuất hiện sau thắng. API mới PHẢI cho kết quả y hệt Directus bằng cách dùng cùng thuật
  toán (đã đo trên Directus 11.17.4: `SECRET_FILE` rồi `SECRET` cho `SECRET`; `SECRET` rồi
  `SECRET_FILE` cho nội dung file). `X_FILE` mà `X` không phải biến Directus thì không được mở rộng.
- **FR-017**: Mọi đường dẫn tương đối (`CONFIG_PATH`, giá trị `X_FILE`, `STORAGE_LOCAL_ROOT`,
  `EXTENSIONS_PATH`, `MIGRATIONS_PATH`, `DB_FILENAME`, `TEMP_PATH`) PHẢI được giải theo thư mục làm việc
  của process, giống Directus. Image của API mới PHẢI dùng thư mục làm việc `/directus` như image
  Directus để cùng một cấu hình trỏ cùng chỗ.

**Kết nối DB và Redis**

- **FR-020**: API PHẢI kết nối được tới mọi `DB_CLIENT` Directus 11.17.4 hỗ trợ (Postgres,
  MySQL/MariaDB, SQLite, MSSQL, Oracle, CockroachDB), dùng cùng các biến `DB_*` (gồm chuỗi kết nối,
  pool, SSL, tùy chọn riêng từng loại DB) như Directus. Phiên bản DB được hỗ trợ là đúng các phiên bản
  mà bộ blackbox của Directus 11.17.4 kiểm thử (xem Assumptions), không cam kết thêm.
- **FR-021**: API PHẢI kết nối được tới Redis bằng `REDIS` hoặc nhóm `REDIS_*` như Directus, và
  chọn nơi lưu cache, rate limiter theo `CACHE_STORE`, `RATE_LIMITER_STORE` (mặc định `memory`)
  giống Directus.
- **FR-022**: API KHÔNG ĐƯỢC tạo, sửa, xóa bảng, cột, index hoặc dữ liệu nào trong DB (cả `directus_*`
  lẫn bảng dữ liệu người dùng), và KHÔNG ĐƯỢC chạy migration, ở bất kỳ thời điểm nào. Các câu lệnh cấp
  phiên chạy khi mở kết nối (SQLite `PRAGMA foreign_keys`, CockroachDB `SET serial_normalization` và
  `SET default_int_size`, Oracle `ALTER SESSION SET NLS_*`) được phép, vì chỉ đổi trạng thái của chính
  kết nối đó, không đổi dữ liệu hay schema.
- **FR-023**: Khi không có cấu hình Redis, hoặc `CACHE_STORE` là `memory` (kể cả giá trị mặc định, và cả khi
  `CACHE_ENABLED=false`, vì Directus luôn dựng cache hệ thống và lock cache trên store này), hoặc
  `RATE_LIMITER_STORE` là `memory` khi `RATE_LIMITER_ENABLED` hoặc `RATE_LIMITER_GLOBAL_ENABLED` bật, API PHẢI
  vẫn khởi động và ghi cảnh báo nêu rõ cấu hình này chỉ an toàn khi chạy một instance (Nguyên tắc VII).
- **FR-024**: API ở feature này PHẢI chạy được khi tài khoản DB chỉ có quyền đọc (không cần INSERT,
  UPDATE, DELETE hay DDL). Đây là cách chứng minh FR-022 ở tầng DB, kiểm bằng một role chỉ có SELECT
  trên Postgres ở bộ `full`.
- **FR-025**: Khởi động KHÔNG kiểm tra Redis và KHÔNG dừng khi Redis không truy cập được, giống Directus
  (client Redis tự thử kết nối lại). Lỗi Redis hiện qua: `/server/health` (khi `CACHE_ENABLED` và
  `CACHE_STORE=redis`, request health không trả lời trong 60 giây vì client Redis giữ lệnh trong hàng đợi chờ
  kết nối lại; Directus 11.17.4 cũng vậy, đã đo, test `server/health.test.ts`), metric
  `<prefix>redis_connection_errors`, và log `warn` có tiền tố `[cache]` khi `CACHE_ENABLED=true` (các dòng `[system-cache]`,
  `[deployment-cache]`, `[lock-cache]` của Directus chưa có, D-20). Khi
  `RATE_LIMITER_STORE=redis` mà Redis không truy cập được, mọi request đi qua rate limiter (kể cả
  `/server/ping`) nhận `500 INTERNAL_SERVER_ERROR`, giống Directus (suy từ code, test đối chiếu
  `server/errors.test.ts` với profile `ratelimit` xác nhận).

**Kiểm tra khi khởi động**

- **FR-030**: Khi khởi động, API PHẢI kiểm tra kết nối DB, kiểm tra DB đã cài Directus (có bảng
  `directus_collections`), và dừng với cùng thông báo như Directus nếu không đạt.
- **FR-031**: API PHẢI đọc `directus_migrations` và so với danh sách migration chuẩn: các version
  đóng gói trong Directus 11.17.4, cộng version của các file migration tùy biến. File tùy biến được tìm ở
  hai nơi, giống Directus: `MIGRATIONS_PATH` (mặc định `./migrations`; nơi Directus chạy migration tùy
  biến; chỉ tính file có dấu `-` và đuôi `.js`, `.cjs` hoặc `.mjs`) và `EXTENSIONS_PATH/migrations`
  (nơi bước kiểm tra khởi động của Directus tìm; chỉ tính file đuôi `.js`). Version là phần tên file
  trước dấu `-` đầu tiên (file `.js` không có `-` ở `EXTENSIONS_PATH/migrations` cho version là cả tên file, như
  `split('-')[0]` của Directus); thư mục không tồn tại hoặc rỗng thì không có version; version trùng chỉ tính
  một lần; so sánh phân biệt chữ hoa chữ thường. Nếu thiếu hoặc thừa, API PHẢI dừng với mã thoát khác 0
  và log liệt kê từng version thiếu và từng version thừa. API chỉ đọc tên file, KHÔNG thực thi file
  migration nào.
- **FR-032**: Các bước kiểm tra khi khởi động PHẢI chỉ đọc, an toàn khi nhiều instance khởi động
  cùng lúc.
- **FR-033**: API PHẢI ghi các cảnh báo khởi động như Directus, nguyên văn: thiếu hoặc `SECRET` ngắn,
  `PUBLIC_URL` không tuyệt đối, thiếu PostGIS hoặc Spatialite. Khi `SECRET` thiếu, API ghi thêm một dòng `[mới]`
  (D-18) nói token ký bằng `SECRET` ngẫu nhiên không được Directus chấp nhận.
- **FR-034**: Nếu `STORAGE_LOCATIONS` có location dùng driver khác `local` và `s3`, API PHẢI dừng
  khi khởi động với mã thoát khác 0, log nêu tên location và driver không hỗ trợ.
- **FR-035**: Khi danh sách chuẩn có version tùy biến, API PHẢI ghi một cảnh báo khi khởi động
  liệt kê các version đó.
- **FR-036**: Khi kết nối DB lỗi hoặc migration lệch, API PHẢI dừng ngay (mã thoát 1), không chờ và không
  tự thử lại, giống Directus; việc thử lại do orchestrator (restart policy, readiness) đảm nhiệm. Log
  migration lệch PHẢI có thêm gợi ý: nếu Directus đang migrate thì khởi động lại sau khi Directus xong.
  Khi DB không truy cập được, thời gian chờ là thời gian chờ lấy kết nối của pool DB (mặc định
  60 giây, chỉnh qua biến `DB_POOL__*`), giống Directus.

**Endpoint**

- **FR-040**: `GET /server/ping` PHẢI trả `pong` (`Content-Type: text/html; charset=utf-8`, không có
  `Cache-Control`), được phục vụ sau rate limiter và bước đọc token nhưng trước bước xác thực, giống
  Directus. Vì bước đọc token chạy trước, token ở cả query `access_token` lẫn header Bearer cho
  `400 INVALID_PAYLOAD`.
- **FR-041**: `GET /server/health` PHẢI kiểm tra cùng các thành phần như Directus (DB, cache khi
  bật, rate limiter khi bật, từng storage location trong `STORAGE_LOCATIONS`), cùng ngưỡng, cùng
  cách tính `ok`/`warn`/`error`, cùng status HTTP (`503` khi `error`), cùng header và cùng body cho
  request không có quyền admin.
- **FR-042**: `GET /server/info` PHẢI trả cùng cấu trúc như Directus cho request không kèm token:
  `project` đọc từ `directus_settings`, `setupCompleted`, và `version` chỉ khi chưa setup. `project` có
  đúng 17 key theo thứ tự: `project_name`, `project_descriptor`, `project_logo`, `project_color`,
  `default_appearance`, `default_theme_light`, `default_theme_dark`, `theme_light_overrides`,
  `theme_dark_overrides`, `default_language`, `public_foreground`, `public_favicon`, `public_note`,
  `custom_css`, `public_registration`, `public_registration_verify_email`, `public_background`
  (`public_background` là quan hệ m2o, luôn ở cuối, giá trị `{id, type}` hoặc `null`). Thứ tự key quan
  trọng vì `ETag` tính từ body.
- **FR-043**: `GET /server/specs/oas` PHẢI trả tài liệu OpenAPI giống Directus cho người dùng
  public (các phần không thể trùng giữa hai server được liệt kê ở FR-105), và không tồn tại khi
  `OPENAPI_ENABLED=false`. Để làm được, API mới chỉ đọc schema DB,
  `directus_collections`, `directus_fields`, `directus_relations` và quyền của policy public
  (`directus_access`, `directus_policies`, `directus_permissions`), không ghi gì.
- **FR-044**: Ở feature này, request kèm token tới `/server/info`, `/server/health`,
  `/server/specs/oas`, `/metrics` PHẢI được trả như request public (với `/metrics`: chỉ chấp nhận
  `METRICS_TOKENS`). Response cho user đã đăng nhập và admin thuộc feature 003/004. Lần đầu tiên mỗi
  process nhận request mang thông tin xác thực (header Bearer, query `access_token` hoặc cookie phiên
  `SESSION_COOKIE_NAME`), API PHẢI ghi một cảnh báo `warn` nói rõ xác thực chưa khả dụng và request được
  xử lý như public; các lần sau ghi mức `debug`.
- **FR-045**: Mọi response đi qua middleware `X-Powered-By` PHẢI có header `X-Powered-By: Backoffice`; riêng `503
  SERVICE_UNAVAILABLE` của pressure limiter (chạy trước mọi middleware khác) không có `X-Powered-By`, header bảo mật
  và log HTTP, giống Directus. Các header bảo mật
  (`CONTENT_SECURITY_POLICY_*`, `CROSS_ORIGIN_OPENER_POLICY*`, `HSTS_*`), CORS (`CORS_*`),
  `ROOT_REDIRECT` và `/robots.txt` (`ROBOTS_TXT`) PHẢI giống Directus; tập header được so sánh ở
  FR-104.
- **FR-046**: Rate limiter theo IP và toàn cục PHẢI áp dụng cho mọi route như Directus, dùng chung
  key và bộ đếm với Directus khi `RATE_LIMITER_STORE=redis`.
- **FR-047**: `version` trong `/server/info` và `releaseId` trong `/server/health` PHẢI là `11.17.4`,
  giống Directus. Phiên bản riêng của Backoffice chỉ được ghi trong log khởi động. `info.version` của
  OpenAPI sinh giống Directus (hash của thời điểm request và user), nên đổi theo từng request và test
  đối chiếu không so trường này.

- **FR-048**: Router PHẢI cho hành vi HTTP giống Directus (đã đo): đường dẫn không phân biệt chữ hoa
  chữ thường và bỏ qua dấu `/` cuối; `HEAD` được hỗ trợ; request có điều kiện (`If-None-Match` trùng
  `ETag`) trả `304`; phương thức khác `GET` tới `/server/*` trả `404 ROUTE_NOT_FOUND` (riêng
  `/server/setup`, `/server/specs/graphql` là khác biệt D-14, D-15); `OPTIONS` tới
  route của router (`/server/info`, `/server/health`, `/server/specs/oas`, và `/metrics` khi bật) trả
  `200` với `Allow: GET,HEAD` và body `GET,HEAD`, còn `OPTIONS` tới route gắn trực tiếp vào app
  (`/server/ping`, `/`, `/robots.txt`) trả `404`; `GET /` trả `302` tới `ROOT_REDIRECT`.
- **FR-049**: Trước khi có cache schema (feature 002), mỗi request `/server/specs/oas` dựng schema mới,
  như Directus khi `CACHE_SCHEMA=false`. Endpoint này chịu rate limiter và pressure limiter như mọi route.
  Rủi ro tải do endpoint công khai này tốn truy vấn được chấp nhận cho tới feature 002; môi trường mở ra
  Internet nên bật `RATE_LIMITER_ENABLED`. Hiệu năng được đo theo SC-006.

**Lỗi**

- **FR-050**: Mọi lỗi PHẢI trả format `{"errors":[{"message": ..., "extensions": {"code": ...}}]}`
  với cùng mã lỗi, cùng message, cùng HTTP status như `directus/packages/errors`. Với message có phần
  phụ thuộc thời điểm (`REQUESTS_EXCEEDED`: `Too many requests, retry after <thời gian>.`,
  `extensions.reset`, header `Retry-After`), phép so sánh chỉ kiểm định dạng và `extensions.limit`.
- **FR-051**: Path không tồn tại PHẢI trả `ROUTE_NOT_FOUND` (`404`), giống Directus; khi request kèm token sai, query
  sai, hoặc DB mất kết nối với `CACHE_SCHEMA=false`, Directus trả lỗi khác trước khi tới 404 (khác biệt D-10, D-12, D-13).

**Log**

- **FR-060**: Log PHẢI theo `LOG_LEVEL`, `LOG_STYLE` (`raw` là JSON, còn lại dạng dễ đọc),
  `LOG_HTTP_IGNORE_PATHS`, `LOGGER_*` như Directus.
- **FR-061**: Mỗi log HTTP PHẢI có request id sinh giống Directus (số tăng dần trong từng process,
  không đọc header `X-Request-Id`, không thêm header vào response) và che giá trị `Authorization`,
  `Cookie`, giống Directus.
- **FR-062**: Log KHÔNG ĐƯỢC chứa giá trị secret (mật khẩu DB, `SECRET`, token, key storage).

**Metrics**

- **FR-070**: Khi `METRICS_ENABLED=true`, `/metrics` PHẢI trả định dạng Prometheus, cùng tên metric
  như Directus cho các dịch vụ trong `METRICS_SERVICES`, cùng tiền tố `METRICS_NAME_PREFIX`, cập
  nhật theo `METRICS_SCHEDULE`.
- **FR-071**: `/metrics` PHẢI chấp nhận header `Authorization: Metrics <token>` với token trong
  `METRICS_TOKENS`, và từ chối bằng `FORBIDDEN` khi không hợp lệ, giống Directus.

**Vận hành**

- **FR-080**: Khi nhận SIGINT, SIGTERM, SIGHUP, API PHẢI theo trình tự tắt máy của Directus (terminus): chuyển
  `/server/health` sang `error`; ngừng nhận kết nối mới và đóng kết nối rảnh; request đang chạy được
  tối đa `SERVER_SHUTDOWN_TIMEOUT` ms (mặc định 1000), hết hạn thì kết nối còn lại bị đóng (request dở
  bị cắt); đóng kết nối DB; rồi kết thúc bằng chính tín hiệu đã nhận (mã thoát 143 với SIGTERM). Thêm so
  với Directus (Nguyên tắc VII; Directus không làm): dừng cron metrics và đóng kết nối Redis trước khi kết
  thúc. Lỗi trong lúc tắt máy: thoát mã 1, không ghi log (giống Directus: terminus không được truyền `logger`).
- **FR-081**: API PHẢI lắng nghe theo `HOST`, `PORT` (hoặc `UNIX_SOCKET_PATH`) như Directus.

**Đổi thương hiệu**

- **FR-090**: Chữ "Directus" PHẢI đổi thành "Backoffice" khi nó chỉ chính ứng dụng này: tên hiển thị,
  header `X-Powered-By`, log message nói về app (ví dụ `Directus shut down OK. Bye bye!`), mô tả trong
  tài liệu OpenAPI, tên package nội bộ. PHẢI giữ nguyên khi nó là: tên bảng hoặc collection
  `directus_*`, `@directus/sdk`, giá trị lấy từ DB, tên biến môi trường, key, mã lỗi, hoặc chỉ Directus
  thật (ví dụ `Database doesn't have Directus tables installed.`). Danh sách message cụ thể nằm ở
  `contracts/startup.md` và `contracts/observability.md`; message không có trong hai file đó giữ nguyên
  văn bản của Directus.

**Test đối chiếu**

- **FR-100**: PHẢI có bộ test gửi cùng request tới Directus 11.17.4 thật và API mới, so sánh status,
  header, body (theo FR-103 đến FR-105) và trạng thái toàn bộ bảng trong DB trước và sau.
- **FR-101**: Bộ test PHẢI dùng một danh sách khác biệt được chấp nhận, khai báo tập trung. Mỗi mục có
  mã (cột "Mã" của bảng "Khác biệt so với Directus"), và với khác biệt tạm thời có thêm feature gỡ
  (cột "Gỡ khi"). Khác biệt ngoài danh sách làm test fail. Một kiểm tra tự động PHẢI fail khi: một mã
  trong danh sách không có trong bảng của spec; hoặc một mục tạm thời còn trong danh sách trong khi
  spec của feature "Gỡ khi" đã có `Status: Done`. Test đối chiếu của mục tạm thời được giữ nguyên và
  phải đạt khi mục bị gỡ.
- **FR-102**: Bộ test PHẢI chạy được trên Postgres, MySQL, MariaDB, SQLite, MSSQL, Oracle và
  CockroachDB, tái sử dụng cách tổ chức của `directus/tests/blackbox`. Bộ rút gọn (`PARITY_SUITE=reduced`)
  gồm ping, health, info, lỗi (404, payload) và các ca router của FR-048 (`methods`, `conditional`); bộ
  đầy đủ chạy mọi test đối chiếu.
- **FR-103**: "Giống Directus" nghĩa là: cùng status; mỗi header trong tập FR-104 giống (hoặc là khác
  biệt được chấp nhận); body JSON bằng nhau theo cấu trúc (không phụ thuộc thứ tự key của object, có
  phụ thuộc thứ tự phần tử của mảng, trừ mảng được chuẩn hóa ở FR-105); body không phải JSON (`pong`,
  `GET,HEAD`) bằng nhau từng ký tự. Riêng `/metrics` so tập tên metric và help text, không so giá trị;
  riêng `/server/info` kiểm thêm thứ tự key của `project` đúng như FR-042 (vì `ETag`).
- **FR-104**: Tập header được so sánh: `content-type`, `cache-control`, `vary`, `etag` (trừ
  `/server/specs/oas` và `/metrics`), `allow`, `location`, `retry-after` (chỉ định dạng),
  `content-security-policy`, `cross-origin-opener-policy`, `strict-transport-security`, `access-control-*`,
  `x-powered-by` (khác biệt được chấp nhận D-01). Không so: `date`, `connection`, `keep-alive`,
  `content-length` (suy ra từ body).
- **FR-105**: Các giá trị không thể trùng giữa hai server và cách xử lý: `info.version` và `ETag` của
  `/server/specs/oas` (hash theo thời điểm request) bị loại khỏi phép so sánh; thứ tự `tags` và `paths`
  của OpenAPI (theo thứ tự truy vấn catalog DB, không có ORDER BY) được chuẩn hóa bằng sắp xếp theo
  tên trước khi so; `servers[0].url` phụ thuộc header Host nên test gửi cùng header Host tới cả hai;
  `Retry-After`, `reset` (số, hoặc chuỗi ngày khi rate limiter dùng Redis), `observedValue` chỉ so định
  dạng hoặc kiểu; `ETag` của response có các giá trị này chỉ so phần độ dài.

**CI**

- **FR-110**: Pipeline (pull request và push `main`) PHẢI chạy: lint, typecheck, unit test với ngưỡng coverage (80% API và
  libs BE, 60% app web), test đối chiếu (Postgres đủ, MySQL và SQLite rút gọn), E2E (app web, Playwright,
  kịch bản khói), quét dependency, quét secret, phân tích mã, benchmark so với Directus, build image.
- **FR-111**: Pipeline PHẢI fail khi có file trong `directus/` bị đổi.
- **FR-112**: Pipeline hằng đêm PHẢI chạy đủ test đối chiếu trên MariaDB, MSSQL, Oracle, CockroachDB,
  và trên các phiên bản cũ mà Directus kiểm thử (Postgres 10, MySQL 5).
- **FR-113**: Bước benchmark PHẢI fail khi p95 latency hoặc throughput của API mới tệ hơn Directus
  quá 10% cho cùng request và dữ liệu.

### Key Entities

- **Cấu hình**: tập biến đã đọc và ép kiểu, gồm nguồn (process, file `CONFIG_PATH`, file `_FILE`,
  mặc định). Không lưu ra ngoài process.
- **Danh sách migration chuẩn**: các version migration của Directus 11.17.4 (101 version), đóng gói
  cùng API mới, cộng version lấy từ tên file trong `MIGRATIONS_PATH` và `EXTENSIONS_PATH/migrations`.
  Dùng để so với `directus_migrations`.
- **Bản ghi `directus_migrations`**: version, tên, thời điểm chạy. API mới chỉ đọc.
- **Bản ghi `directus_settings`**: nguồn dữ liệu `project` của `/server/info`. API mới chỉ đọc.
- **Danh sách khác biệt được chấp nhận**: mỗi dòng gồm mã (khớp bảng ở spec), endpoint, đường dẫn
  trường hoặc header, giá trị Directus, giá trị app mới, lý do, và feature gỡ (nếu tạm thời). Dùng
  chung cho spec và bộ test đối chiếu.
- **Kết quả kiểm tra sức khỏe**: trạng thái tổng và trạng thái từng thành phần, theo chuẩn
  health check của Directus.

## Khác biệt so với Directus *(mandatory)*

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ khi |
|----|----------|------------------|---------|-------|-----------------------------------------------|--------|
| D-01 | Header `X-Powered-By` | `Directus` | `Backoffice` | Nguyên tắc IX | đổi thương hiệu | — |
| D-02 | Chữ "Directus" trong mô tả của tài liệu OpenAPI (`servers[].description`, `tags[].description`, mô tả path) | Ví dụ `Your current Directus instance.`, `Access to where Directus runs...` | `Backoffice` thay cho `Directus` | Nguyên tắc IX | đổi thương hiệu | — |
| D-03 | Log message nói về chính ứng dụng | Ví dụ `Directus shut down OK. Bye bye!` | `Backoffice shut down OK. Bye bye!` (danh sách ở `contracts/startup.md`, `contracts/observability.md`) | Nguyên tắc IX. Message nhắc tới bảng `directus_*` hoặc Directus thật giữ nguyên (FR-090) | đổi thương hiệu | — |
| D-04 | Tên package nội bộ | `@directus/*` | `@backoffice/*` | Nguyên tắc IX | đổi thương hiệu | — |
| D-05 | Migration lệch | Chỉ cảnh báo, vẫn chạy | Dừng, liệt kê version thiếu và thừa | Nguyên tắc II: không chạy trên schema hệ thống khác phiên bản | khác | — |
| D-06 | Phạm vi kiểm tra migration | Chỉ kiểm tra thiếu, và chỉ xét file ở `EXTENSIONS_PATH/migrations` | Kiểm tra cả thiếu và thừa; chấp nhận version tùy biến ở `MIGRATIONS_PATH` và `EXTENSIONS_PATH/migrations` | Nguyên tắc II | khác | — |
| D-07 | Thành phần `email:connection` trong `/server/health` | Kiểm tra kết nối mail transport | Luôn `ok`, không kết nối mail server | Nguyên tắc X: không gửi email. Tránh để cấu hình mail làm instance bị đánh dấu không sẵn sàng | ngoài phạm vi | — |
| D-08 | `SERVE_APP` và route `/admin` | Phục vụ app quản trị ở `/admin` | `/admin` và `/admin/*` trả `404 ROUTE_NOT_FOUND`; chỉ cảnh báo khi `SERVE_APP=true` được đặt tường minh. App web chạy container riêng | Nguyên tắc VII | khác | — |
| D-09 | Route chưa làm ở feature này (bản đồ ở dưới) | Có | `404 ROUTE_NOT_FOUND` | Mỗi route thuộc feature riêng | ngoài phạm vi (tạm thời) | theo bản đồ |
| D-10 | Request kèm token (Bearer, `access_token`, cookie phiên) tới mọi route sau bước `authenticate` của Directus: `/server/info`, `/server/health`, `/server/specs/oas`, `/metrics`, path lạ, route của D-09, phương thức khác `GET` tới `/server/*`, `/admin` | Token sai: `401 INVALID_CREDENTIALS` (kể cả ở path lạ). Token đúng: info đầy đủ, health chi tiết cho admin, OAS theo quyền user, `/metrics` cho admin | Bỏ qua token: route `/server/*` trả như request public, `/metrics` trả `403` khi thiếu `Metrics <token>`, path lạ trả `404`; ghi cảnh báo lần đầu mỗi process (FR-044) | Xác thực thuộc feature 003, phân quyền thuộc 004 (đã chốt Q1: A) | ngoài phạm vi (tạm thời) | 004 |
| D-11 | Cache response khi `CACHE_ENABLED=true` cho `/server/info`, `/server/specs/oas` | Lưu response vào cache; khi `CACHE_AUTO_PURGE=false` trả `Cache-Control: public, max-age=<CACHE_TTL>`; có header `CACHE_STATUS_HEADER`; OAS giữ nguyên `info.version` trong TTL | Không cache, `Cache-Control: no-cache` | Cache response làm ở feature 005 | ngoài phạm vi (tạm thời) | 005 |
| D-12 | Query string trên mọi route sau bước `sanitizeQuery` của Directus (`/server/*`, `/metrics`, path lạ, `/admin`): `fields`, `limit`, `filter`, `export`... | Kiểm tra query, có thể trả `400 INVALID_QUERY` (đã đo: `?limit=abc`, `?filter={bad`), kể cả trên path lạ và `/metrics`, hoặc file export | Bỏ qua query string | Kiểm tra query và export làm ở feature 005 | ngoài phạm vi (tạm thời) | 005 |
| D-13 | Route sau middleware `schema` của Directus (`/server/health`, `/metrics`, path lạ, `/admin`) khi DB mất kết nối và `CACHE_SCHEMA=false` | `500 INTERNAL_SERVER_ERROR` (bước dựng schema lỗi trước khi tới route) | `/server/health`: `503` với `{"status":"error"}`; `/metrics` trả như bình thường; path lạ `404` | Health dùng cho probe, không dựng schema; middleware `schema` chạy mọi request thuộc feature 002. Với `CACHE_SCHEMA=true` (mặc định) hai bên giống nhau | khác | — |
| D-14 | `/server/setup` (mọi phương thức) | `POST`: tạo admin khi chưa có user, `403 FORBIDDEN` khi đã có; `OPTIONS` → `200 Allow: POST` | `404 ROUTE_NOT_FOUND` | Ghi `directus_users` và `directus_settings` (feature 004 và 010) | ngoài phạm vi (tạm thời) | 010 |
| D-15 | `/server/specs/graphql[/:scope]` (`GET`, `HEAD`, `OPTIONS`) | Có khi `GRAPHQL_INTROSPECTION` khác `false` (mặc định bật); `OPTIONS` → `200 Allow: GET,HEAD` | `404 ROUTE_NOT_FOUND` | GraphQL thuộc feature 011 | ngoài phạm vi (tạm thời) | 011 |
| D-16 | Storage driver `gcs`, `azure`, `cloudinary`, `supabase` | Hỗ trợ | Dừng khi khởi động, báo rõ location | Nguyên tắc XI. Trái chữ Nguyên tắc VIII ("biến chưa hỗ trợ chỉ cảnh báo"), đã ghi ở Complexity Tracking của plan, cần tech lead duyệt trong PR (Nguyên tắc X) | ngoài phạm vi | — |
| D-17 | WebSocket, extension, AI/MCP, deployment | Khởi tạo khi khởi động; route `/mcp` và `/ai` (mặc định bật), `/deployments`, `/deployments/webhooks` tồn tại | Không khởi tạo, các route đó trả `404 ROUTE_NOT_FOUND`, biến liên quan chỉ cảnh báo | Nguyên tắc XI | ngoài phạm vi | — |
| D-18 | Dòng log thêm (khi khởi động và khi nhận request mang token) | Không có | Khi khởi động: phiên bản Backoffice, biến chưa hỗ trợ, `SERVE_APP` bị bỏ qua, cấu hình một instance, gợi ý khi migration lệch, migration tùy biến, `SECRET` ngẫu nhiên không dùng chéo với Directus (đánh dấu `[mới]` ở `contracts/startup.md`). Lần đầu mỗi process nhận request mang token: cảnh báo token bị bỏ qua (đánh dấu `[mới]` ở `contracts/observability.md`) | Giúp vận hành | khác | — |
| D-19 | Image Docker và cách trả metric | Image chạy `bootstrap` rồi `pm2-runtime` (`PM2_INSTANCES`); dưới PM2, `/metrics` trả bản gộp các process, chụp ở mỗi lượt `METRICS_SCHEDULE` | Image chạy `node main.js` một process, không `bootstrap`, không PM2; `/metrics` trả giá trị hiện tại của process đó | Nguyên tắc II (không bootstrap ghi DB), VII (scale bằng replica). FR-103 không so giá trị metric | khác | — |
| D-20 | Log khi Redis không truy cập được với `CACHE_STORE=redis` | Log `warn` tiền tố `[system-cache]`, `[deployment-cache]`, `[lock-cache]` (luôn có), thêm `[cache]` khi `CACHE_ENABLED=true` | Chỉ `[cache]` khi `CACHE_ENABLED=true` | Cache hệ thống, lock cache thuộc feature 002 | ngoài phạm vi (tạm thời) | 002 |
| D-21 | Lấy IP client qua proxy tin cậy khi địa chỉ ở dạng IPv4 ánh xạ IPv6 (`::ffff:a.b.c.d`) | `proxy-addr` 2.0.7: kiểm tra tin cậy có lỗi giả mạo IP (cảnh báo critical của `pnpm audit`) | `proxy-addr` 2.0.8 đã vá: IP dạng này được kiểm như IPv4 | Bản vá bảo mật (T107, Complexity Tracking của plan); chỉ khác khi `IP_TRUST_PROXY` tin một dải mạng và request đi qua địa chỉ dạng này. Test đối chiếu hiện có không gặp trường hợp này | khác (gỡ khi Directus tham chiếu dùng `proxy-addr` ≥ 2.0.8) | — |
| D-22 | Hiệu năng `/server/specs/oas` dưới tải (SC-006) | Đọc policy và permission từ permissions cache (bộ nhớ và Redis, luôn bật): 8 câu SQL mỗi request khi `CACHE_SCHEMA=false`, `CACHE_ENABLED=false` | Đọc lại từ DB mỗi request: 14 câu SQL; trên runner CI p95 cao hơn 11–21%, req/s ngang nhau. Benchmark vẫn đo và in kết quả nhưng không chặn CI | Permissions cache cần bus để xóa cache trên mọi instance, thuộc feature 002 (D-20) | ngoài phạm vi (tạm thời) | 002 |

Bản đồ route của D-09 (mỗi mã là một mục trong danh sách khác biệt được chấp nhận):

| Mã | Route | Gỡ khi |
|----|-------|--------|
| D-09.1 | `/auth` | 003 |
| D-09.2 | `/users`, `/roles`, `/policies`, `/access`, `/permissions` | 004 |
| D-09.3 | `/items` | 005 |
| D-09.4 | `/collections`, `/fields`, `/relations`, `/schema` | 006 |
| D-09.5 | `/files` (gồm `/files/tus`), `/folders`, `/assets` | 007 |
| D-09.6 | `/activity`, `/revisions`, `/versions`, `/comments` | 008 |
| D-09.7 | `/flows`, `/operations` | 009 |
| D-09.8 | `/settings`, `/presets`, `/notifications`, `/shares`, `/translations`, `/dashboards`, `/panels`, `/extensions`, `/utils` | 010 |
| D-09.9 | `/graphql` | 011 |

Giữ nguyên (không đổi thương hiệu): tên bảng `directus_*`; `project_name` và mọi giá trị đọc từ
`directus_settings` (ví dụ `"Directus"` mặc định của cột); tên biến môi trường; mã lỗi; số phiên bản `11.17.4` báo cho client (FR-047);
`METRICS_NAME_PREFIX` mặc định `directus_`; `METRICS_HEALTH_CHECK_PREFIX` mặc định
`directus-metric-`; key tạm của health check trong cache và rate limiter (`directus-health-<id>`)
và file `directus-health-file` trong storage; namespace Redis mặc định; mã thoát của việc tắt máy theo
tín hiệu; thư mục làm việc `/directus` và
các biến mặc định của Docker image Directus (để đường dẫn tương đối như `./uploads`, `.env` trỏ cùng
chỗ).

**Cần xác nhận** (tên chưa chắc có ảnh hưởng luồng hay không, đang giữ nguyên):

- Không có.

## Assumptions

- Phiên bản chuẩn là Directus 11.17.4 (api 35.2.0). DB dùng chung đã được Directus 11.17.4 cài và
  migrate.
- "Biến chưa hỗ trợ" là biến Directus có mặt trong cấu hình mà phiên bản API mới hiện tại chưa có
  tính năng dùng tới. Danh sách này thu hẹp dần qua các feature sau.
- Storage location chỉ hỗ trợ driver `local` và `s3` (Nguyên tắc XI, FR-034). Ở feature này
  storage chỉ dùng cho kiểm tra sức khỏe. Nhiều replica và Directus cùng ghi đè một file kiểm tra
  (`directus-health-file`, `directus-metric-file`) mà không khóa, giống Directus; nội dung file không
  được đọc ở đâu, nên chấp nhận "người ghi sau thắng"; lỗi ghi tính theo từng lần gọi.
- Phiên bản DB được hỗ trợ là các phiên bản bộ blackbox của Directus 11.17.4 dùng
  (`directus/tests/blackbox/docker-compose.yml`): PostgreSQL 10 và 13 (PostGIS), MySQL 5 và 8, MariaDB
  11.4, MSSQL 2022, Oracle XE (blackbox dùng 18; CI của Backoffice dùng bản 21 slim vì image 18 không
  còn được bảo trì), CockroachDB 24.3, SQLite. Bản mới hơn chưa kiểm thử thì chưa cam kết.
- Cache ở feature này chỉ dùng cho kiểm tra sức khỏe và metrics. Cache response thuộc feature 005.
- Để sinh OpenAPI cho public (FR-043), feature này dựng bức tranh schema (schema DB,
  `directus_collections`, `directus_fields`, `directus_relations`) mỗi lần gọi `/server/specs/oas`,
  không cache. Cache schema và đồng bộ qua bus thuộc feature 002.
- Request id trong log theo cách sinh mặc định của Directus (FR-061), nên chỉ duy nhất trong một
  process. Truy request giữa các instance dựa vào thời điểm, instance và path, không dựa vào id.
- Benchmark của feature này đo `/server/ping`, `/server/health`, `/server/info` với Directus cấu hình
  mặc định, và `/server/specs/oas` với Directus chạy `CACHE_SCHEMA=false` và `CACHE_ENABLED=false` (cùng cách
  dựng schema và sinh OAS mỗi request; cache response là D-11). Benchmark items, auth, files, assets được thêm khi các feature đó xong.
- Dòng `Status` ở đầu spec chuyển từ `Draft` sang `Done` trong PR merge feature vào `main`; kiểm tra
  hết hạn của khác biệt tạm thời (FR-101) dựa vào giá trị này.
- Bộ test đối chiếu chạy trên môi trường riêng `tests/parity/docker-compose.yml` (Postgres 13 PostGIS và các DB
  của Assumptions, Redis, MinIO, Directus, API mới). `dev/directus-reference` (Directus, Postgres 16 PostGIS, Redis,
  MinIO) chỉ để thử bằng tay (`quickstart.md` §2–§4); Postgres 16 ngoài danh sách phiên bản cam kết ở trên nên
  kết quả ở đó không phải cổng kiểm tra.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Đội vận hành khởi động API mới bằng đúng file cấu hình đang dùng cho Directus mà
  không thêm, đổi hoặc xóa dòng nào, trên cả 6 loại DB Directus hỗ trợ, với mọi cấu hình nằm trong
  phạm vi hỗ trợ (storage chỉ `local` và `s3`, theo Nguyên tắc XI). Điều này đúng ở mọi PR cho Postgres,
  MySQL, SQLite và ở lượt chạy hằng đêm gần nhất cho MariaDB, MSSQL, Oracle, CockroachDB.
- **SC-002**: 100% test đối chiếu cho `/server/ping`, `/server/health`, `/server/info`,
  `/server/specs/oas`, các ca router (FR-048) và lỗi (FR-050, FR-051) đạt theo quy tắc FR-103 đến
  FR-105; mọi khác biệt còn lại đều có mã trong danh sách chấp nhận.
- **SC-003**: Sau toàn bộ bộ test (khởi động, phục vụ request, tắt), bản chụp schema và dữ liệu của
  mọi bảng (`directus_*` và bảng người dùng) trước và sau giống nhau 100%. Bản chụp không bao gồm trạng
  thái phiên kết nối (FR-022).
- **SC-004**: Với DB truy cập được nhưng lệch migration, API mới dừng trong vòng 10 giây kể từ lúc
  process bắt đầu và log nêu đúng 100% version thiếu và thừa. Với DB không truy cập được, thời gian dừng
  theo thời gian chờ kết nối của pool (FR-036).
- **SC-005**: Đội vận hành dùng nguyên cấu hình thu log và scrape metrics của Directus cho API mới;
  tên metric khớp 100% với Directus cho cùng `METRICS_SERVICES`.
- **SC-006**: p95 latency và throughput của API mới ở `/server/ping`, `/server/health`, `/server/info`
  không tệ hơn Directus quá 10% với cùng tải. `/server/specs/oas` được so với Directus chạy
  `CACHE_SCHEMA=false` và `CACHE_ENABLED=false` (FR-049, D-11) với cùng ngưỡng 10%, tạm không chặn CI tới feature 002
  (D-22); từ feature 002 được so với Directus cấu hình mặc
  định.
- **SC-007**: Một thay đổi vi phạm bất kỳ cổng nào (lint, typecheck, coverage, test đối chiếu, E2E (app web),
  bảo mật, benchmark, build image, sửa `directus/`) đều làm CI fail ở job tương ứng, trên PR và trên mỗi lần
  push `main`. Quy trình của dự án: merge thẳng vào `main`, CI chạy sau push, job đỏ được sửa ngay ở commit tiếp
  theo; repo không bật branch protection (Complexity Tracking của plan).
- **SC-008**: Lập trình viên mới clone repo, cài dependency và chạy được build, lint, test toàn
  workspace trong không quá 15 phút, đo trong container `node:22` sạch (không cache pnpm và Nx), 4 vCPU,
  8 GB RAM, hoặc trên runner `ubuntu-latest` của GitHub.
