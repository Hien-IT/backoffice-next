# Contract: khởi động và tắt API (001)

Nguồn gốc: `directus/api/src/app.ts` (`createApp`), `directus/api/src/server.ts`,
`directus/api/src/database/index.ts`, `directus/api/src/utils/validate-storage.ts`,
`directus/api/src/middleware/rate-limiter-global.ts`. Message giữ nguyên tiếng Anh như Directus, chỉ đổi
"Directus" thành "Backoffice" khi câu nói về chính app (Nguyên tắc IX). Message **mới** (không có ở
Directus) đánh dấu `[mới]`.

Mọi bước khởi động **chỉ đọc**: không ghi DB, an toàn khi nhiều replica khởi động cùng lúc (FR-032).

## 1. Thứ tự kiểm tra

| # | Bước | Khi không đạt | Mức log | Message | Mã thoát |
|---|------|---------------|---------|---------|----------|
| 1 | Đọc cấu hình (`createEnv`) | File trong `X_FILE` không đọc được; file `CONFIG_PATH` sai cú pháp; `.js` export sai kiểu; `regex:` sai cú pháp | (lỗi chưa bắt, in ra stderr) | Lỗi gốc, ví dụ `Failed to read value from file "<path>", defined in environment variable "<X_FILE>".` Chi tiết và danh sách đã đo: [config.md](./config.md) §2–§4 | 1 |
| 2 | Ghi phiên bản `[mới]` | — | info | `Backoffice <version> (compatible with Directus 11.17.4)` | — |
| 3 | Biến chưa hỗ trợ `[mới]` (FR-014) | Có biến thuộc nhóm C của [config.md](./config.md) §5 | warn | `The following Directus environment variables are not supported by Backoffice yet and will be ignored: <A>, <B>` (A–Z, chỉ tên) | — |
| 4 | `SERVE_APP` `[mới]` | `SERVE_APP` có mặt trong cấu hình thô và bằng `true` (không đặt thì không cảnh báo) | warn | `"SERVE_APP" is ignored: the Backoffice web app is served by its own container.` | — |
| 5 | Redis/memory `[mới]` (FR-023) | Không có cấu hình Redis, hoặc `CACHE_STORE`/`RATE_LIMITER_STORE` = `memory` | warn | `<lý do>: this configuration is only safe when running a single instance.` (`<lý do>` là `No Redis configured`, `CACHE_STORE is "memory"`, `RATE_LIMITER_STORE is "memory"`, nối bằng `; `) | — |
| 6 | Cấu hình rate limiter toàn cục | `RATE_LIMITER_GLOBAL_ENABLED` mà không bật rate limiter IP | error | `The IP based rate limiter needs to be enabled when using the global rate limiter.` | 1 |
| 6b | | Global cho phép ít request/giây hơn IP | error | `The global rate limiter needs to allow more requests per second than the IP based rate limiter.` | 1 |
| 7 | Biến DB bắt buộc (`validateEnv`) | Thiếu biến theo `DB_CLIENT` | error | `"<KEY>" Environment Variable is missing.` | 1 |
| 8 | Kết nối DB | `SELECT 1` (Oracle: `select 1 from DUAL`) lỗi | error | `Can't connect to the database.` + lỗi gốc | 1 |
| 9 | Collation MySQL | Bảng/cột khác collation của DB | warn | `Some tables and columns do not match your database's default collation (<c>):` + danh sách | — |
| 10 | DB đã cài Directus | Không có bảng `directus_collections` | error | `Database doesn't have Directus tables installed.` | 1 |
| 11 | Migration `[mới]` (FR-031, FR-036) | Thiếu và/hoặc thừa | error | `Database migrations do not match Directus 11.17.4.` rồi `Missing migrations (not run yet): <v1>, <v2>` và/hoặc `Unknown migrations (not part of Directus 11.17.4): <v3>` rồi `If Directus is still migrating, restart Backoffice after it finishes.` | 1 |
| 11b | Migration tùy biến `[mới]` (FR-035) | Có file hợp lệ trong `MIGRATIONS_PATH` (có `-`, đuôi `.js`/`.cjs`/`.mjs`) hoặc `<EXTENSIONS_PATH>/migrations` (đuôi `.js`) | warn | `Custom migrations are accepted: <v1>, <v2>` (kèm thư mục chứa) | — |
| 11c | Không đọc được `directus_migrations` | Lỗi truy vấn | error | `Database migrations cannot be found` + lỗi gốc | 1 |
| 12 | `SECRET` | Thiếu | warn | `"SECRET" env variable is missing. Using a random value instead. Tokens will not persist between restarts and will not be accepted by Directus. This is not appropriate for production usage.` | — |
| 12b | | Ngắn hơn 32 byte | warn | `"SECRET" env variable is shorter than 32 bytes which is insecure. This is not appropriate for production usage.` | — |
| 13 | `PUBLIC_URL` | Không phải URL tuyệt đối | warn | `"PUBLIC_URL" should be a full URL` | — |
| 14 | Geometry | Postgres thiếu PostGIS / SQLite thiếu Spatialite | warn | `PostGIS isn't installed. Geometry type support will be limited.` / `Spatialite isn't installed. Geometry type support will be limited.` | — |
| 15 | Storage driver `[mới]` (FR-034) | Location trong `STORAGE_LOCATIONS` có driver khác `local`, `s3` | error | `Storage location "<location>" uses driver "<driver>", which is not supported by Backoffice. Supported drivers: local, s3.` | 1 |
| 16 | Thư mục (`validateStorage`) | Thư mục SQLite, `STORAGE_LOCAL_ROOT` không ghi được; thư mục extensions không đọc được | warn | Như Directus: `Directory for SQLite database file (<path>) is not read/writeable!`, `Upload directory (<path>) is not read/writeable!`, `Extensions directory (<path>) is not readable!` | — |
| 17 | Lắng nghe | — | info | `Server started at http://<host>:<port>` (hoặc đường dẫn socket) | — |
| 17b | Lắng nghe | Cổng đã bị chiếm (`EADDRINUSE`) | error | `Port <port> is already in use` (với socket: `<address> is already in use`) | 1 |

Redis **không** được kiểm tra khi khởi động và không làm API dừng (FR-025); client tự thử kết nối lại.
Khi DB không truy cập được, thời gian chờ là thời gian chờ lấy kết nối của pool knex (FR-036); API không
tự thử lại.

Không chạy (khác Directus, đều là việc ghi DB hoặc ngoài phạm vi): `bootstrap`, migration, schedule
`retention`, `telemetry`, `project`, `tus`, khởi tạo extension, flows, auth provider, deployment
webhook, WebSocket.

## 2. Tắt máy

| Sự kiện | Hành vi | Log |
|---------|---------|-----|
| Nhận `SIGINT`, `SIGTERM`, `SIGHUP` | `SERVER_ONLINE = false` → `/server/health` trả `503 {"status":"error"}`; ngừng nhận kết nối mới | info `Shutting down...` (khi `NODE_ENV` khác `development`) |
| Request đang dở | Chạy tiếp tối đa `SERVER_SHUTDOWN_TIMEOUT` ms (mặc định 1000) | — |
| Hết `SERVER_SHUTDOWN_TIMEOUT` | Kết nối còn lại bị đóng, rồi bị hủy (request dở bị cắt); các bước đóng tài nguyên vẫn chạy tiếp | — |
| Đóng tài nguyên | Dừng cron metrics, `knex.destroy()`, đóng các kết nối Redis (cache, rate limiter, Redis dùng chung) | info `Database connections destroyed` |
| Kết thúc | Process kết thúc bằng chính tín hiệu đã nhận (terminus gửi lại tín hiệu sau khi gỡ handler): mã 143 với SIGTERM, 130 với SIGINT, 129 với SIGHUP. Lỗi trong lúc tắt máy: log `error happened during shutdown`, thoát mã 1 | info `Backoffice shut down OK. Bye bye!` (khi `NODE_ENV` khác `development`) |

## 3. Kiểm thử contract

- Unit test cho từng bước (mock knex, fs, env).
- Kịch bản khởi động thật (bộ test đối chiếu, `PARITY_SUITE=full`): DB đủ migration; thiếu 1; thừa 1;
  vừa thiếu vừa thừa; có migration tùy biến hợp lệ; chưa cài Directus; không kết nối được DB; storage
  driver `gcs`. Kiểm tra mã thoát và dòng log.
- Kịch bản tắt máy: gửi request chậm rồi `SIGTERM`, kiểm tra request đó hoàn tất (khi chậm hơn
  `SERVER_SHUTDOWN_TIMEOUT` thì bị cắt), process kết thúc bằng tín hiệu (mã 143).
- Kịch bản khởi động bổ sung: cổng bị chiếm (17b); file cấu hình lỗi (dòng 1); Directus đang migrate dở
  (dòng 11 kèm gợi ý); tài khoản DB chỉ có SELECT (FR-024).
