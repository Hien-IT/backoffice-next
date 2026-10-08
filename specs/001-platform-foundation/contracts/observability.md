# Contract: log và metrics (001)

Nguồn gốc: `directus/api/src/logger/index.ts`, `directus/api/src/logger/redact-query.ts`,
`directus/api/src/metrics/lib/create-metrics.ts`, `directus/api/src/schedules/metrics.ts`,
`directus/api/src/controllers/metrics.ts`. Cùng thư viện, cùng bản: `pino@9.7.0`, `pino-http@10.5.0`,
`pino-http-print@3.1.0`, `pino-pretty@13.1.2`, `prom-client@15.1.3`, `cron@4.3.4`.

## 1. Log

| Biến | Hành vi |
|------|---------|
| `LOG_LEVEL` | Mức log của logger chung và logger HTTP (mặc định `info`) |
| `LOG_STYLE` | `raw`: mỗi dòng một object JSON của pino ra stdout. Khác `raw` (mặc định): dạng dễ đọc (`pino-pretty` cho log chung, `pino-http-print` cho log HTTP, bỏ `hostname`, `pid`, giờ `HH:MM:ss`) |
| `LOG_HTTP_IGNORE_PATHS` | Danh sách path (so `pathname`) không ghi log HTTP |
| `LOGGER_*` | Ghép vào tùy chọn pino (ví dụ `LOGGER_LEVELS=info:INFO,warn:WARNING` đổi trường `severity`) |
| `LOGGER_HTTP_*` | Ghép vào tùy chọn pino-http |

Dòng log HTTP khi `LOG_STYLE=raw` (cấu trúc mặc định của pino-http):

```json
{"level":30,"time":1760000000000,"pid":1,"hostname":"api-1",
 "req":{"id":1,"method":"GET","url":"/server/info","query":{},"params":{},
        "headers":{"host":"...","authorization":"--redacted--","cookie":"--redacted--"},
        "remoteAddress":"...","remotePort":51234},
 "res":{"statusCode":200,"headers":{}},
 "responseTime":3,"msg":"request completed"}
```

- `req.id`: request id do pino-http sinh, số tăng dần trong từng process (quyết định Q5). Không đọc
  header `X-Request-Id`, không trả header nào thêm.
- Che giá trị: `req.headers.authorization`, `req.headers.cookie` (chuỗi `REDACTED_TEXT` của
  `@directus/utils`); `access_token` trong `req.url` bị thay bằng cùng chuỗi đó.
- Log không bao giờ chứa giá trị `SECRET`, `DB_PASSWORD`, `STORAGE_*_SECRET`, token (FR-062). Cảnh báo
  biến chưa hỗ trợ chỉ ghi tên biến.
- Không có log định tuyến của Nest ("Mapped {...} route"), vì Directus không có.
- `[mới]` Request mang thông tin xác thực (header Bearer, query `access_token`, cookie phiên): lần đầu
  mỗi process ghi `warn` `Request carried credentials, but authentication is not available in this
  version; treating the request as public.`; các lần sau ghi `debug` (FR-044).
- Khi Redis không truy cập được: log `warn` có tiền tố `[cache]` (từ Keyv), health và metric như FR-025.

Kiểm thử: chạy API với `LOG_STYLE=raw`, gửi request có `Authorization`, `Cookie`, `?access_token=`, so
tập key của dòng log với Directus (bỏ giá trị `time`, `pid`, `hostname`, `remotePort`, `responseTime`,
`req.id`), và kiểm tra giá trị nhạy cảm đã bị che.

## 2. Metrics

| Biến | Mặc định | Hành vi |
|------|----------|---------|
| `METRICS_ENABLED` | `false` | Bật route `/metrics` và job sinh metric. Tắt: `/metrics` trả `404 ROUTE_NOT_FOUND` |
| `METRICS_SCHEDULE` | `*/1 * * * *` | Cron sinh metric. Cron không hợp lệ thì không chạy job (như Directus) |
| `METRICS_SERVICES` | `database,cache,redis,storage` | Nhóm metric được tạo |
| `METRICS_NAME_PREFIX` | `directus_` | Tiền tố tên metric. Giữ nguyên mặc định để dashboard dùng chung (Nguyên tắc IX) |
| `METRICS_HEALTH_CHECK_PREFIX` | `directus-metric-` | Tiền tố key/file kiểm tra |
| `METRICS_TOKENS` | (trống) | Token chấp nhận ở header `Authorization: Metrics <token>` |

Tên metric và help text (giống hệt Directus):

| Metric | Loại | Help |
|--------|------|------|
| `<p>db_<DB_CLIENT>_connection_errors` | Counter | `<DB_CLIENT> Database connection error count` |
| `<p>db_<DB_CLIENT>_response_time_ms` | Histogram, bucket `1,10,20,40,60,80,100,200,500,750,1000` | `<DB_CLIENT> Database connection response time` |
| `<p>cache_<CACHE_STORE>_connection_errors` | Counter | `Cache connection error count` |
| `<p>redis_connection_errors` | Counter | `Redis connection error count` |
| `<p>storage_<location>_connection_errors` | Counter | `<location> storage connection error count` |

- Histogram thời gian truy vấn DB được ghi ở mọi câu truy vấn knex (sự kiện `query-response`).
- Không bật `collectDefaultMetrics` (Directus không bật).
- Mỗi container trả metric của chính process đó (không gộp kiểu PM2).

Response `/metrics`: `200`, `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-cache`, body
là `register.metrics()` của prom-client. Token sai hoặc thiếu: `403 FORBIDDEN`.

Kiểm thử: bật `METRICS_ENABLED=true` cùng `METRICS_TOKENS` ở cả hai app, chờ một lượt
`METRICS_SCHEDULE`, scrape cả hai, so tập tên metric và help text (giá trị đo không so).
