# Contract: đọc cấu hình (001)

Nguồn gốc: `directus/packages/env/src/lib/create-env.ts`, `lib/cast.ts`, `utils/*`,
`constants/{defaults,directus-variables,type-map}.ts`. Mọi kết quả ở mục 2 và 3 **đã được đo trên image
`directus/directus:11.17.4`** (nạp `@directus/env` 5.8.0 với các file thử nghiệm). Chúng là "golden
table" cho unit test `libs/env/src/lib/directus-compat.test.ts`: nếu bản port cho kết quả khác thì test fail.

## 1. Nguồn và thứ tự ưu tiên

| Bước | Nguồn | Ghi chú |
|------|-------|---------|
| 1 | Giá trị mặc định (`DEFAULTS`) | Ép kiểu theo tên biến (`TYPE_MAP`) nếu có |
| 2 | Biến của process (`process.env`) | |
| 3 | File `CONFIG_PATH` (mặc định `<cwd>/.env`) | Ghi đè biến process cùng tên (đo: process `PORT=2222`, file `PORT=1111` → `1111`) |
| 4 | Biến `X_FILE` (chỉ với `X` là biến Directus) | Thay bằng nội dung file, tên đổi thành `X` |

- `CONFIG_PATH` không tồn tại: bỏ qua file, dùng process (đo: `PORT=3333` giữ nguyên).
- Phần mở rộng quyết định cách đọc: `.js` `.mjs` `.cjs` (hàm nhận `process.env` hoặc object), `.json`,
  `.yaml`/`.yml`, còn lại (kể cả `.env`) đọc theo dotenv.
- Đường dẫn tương đối của `CONFIG_PATH`, của giá trị `X_FILE`, và của mọi biến đường dẫn
  (`STORAGE_LOCAL_ROOT`, `EXTENSIONS_PATH`, `MIGRATIONS_PATH`, `DB_FILENAME`, `TEMP_PATH`) được giải theo
  **thư mục làm việc của process** (đo: `CONFIG_PATH=p.env` với cwd=`/cfg` đọc được `/cfg/p.env`).
  Image API mới dùng thư mục làm việc `/directus`, như image Directus.

## 2. Hành vi `X` và `X_FILE` (đã đo)

| Tình huống | Kết quả | Mã hóa vào test |
|------------|---------|-----------------|
| File `.env` có `SECRET_FILE=...` rồi `SECRET=plain` | `SECRET` = `plain` | Key xuất hiện **sau** thắng |
| File `.env` có `SECRET=plain` rồi `SECRET_FILE=...` | `SECRET` = nội dung file | |
| Process env đặt `SECRET_FILE` trước `SECRET` | `plain` | Thứ tự do hệ điều hành và launcher quyết định, nên **khuyến nghị không đặt cả hai** |
| Process env đặt `SECRET` trước `SECRET_FILE` | nội dung file | |
| `X_FILE` mà `X` không phải biến Directus (ví dụ `X_FILE=/cfg/secret.txt`) | Giữ nguyên `X_FILE`, không tạo `X` | |
| Giá trị có tiền tố ép kiểu (`SECRET_FILE=string:/cfg/secret.txt`) | Tiền tố áp lên nội dung file | |
| File trong `X_FILE` không đọc được | Dừng với lỗi: `Failed to read value from file "<giá trị thô>", defined in environment variable "<X_FILE>".` (giá trị thô gồm cả tiền tố: `SECRET_FILE=string:/cfg/missing` cho `"string:/cfg/missing"`, theo `create-env.ts`) | |

## 3. Ép kiểu (đã đo)

| Giá trị | Kết quả | Ghi chú |
|---------|---------|---------|
| `number:abc` | `NaN` | Không báo lỗi |
| `boolean:xyz` | `false` | Chỉ `true`, `1` (và boolean/số tương ứng) là `true` |
| `json:{bad` | chuỗi `{bad` | JSON hỏng giữ nguyên chuỗi, không lỗi |
| `array:a,,b` | `["a","b"]` | Bỏ phần tử rỗng |
| `string:123` | `"123"` | |
| `0123` (không tiền tố) | chuỗi `0123` | Số bắt đầu bằng `0` không tự đoán là số |
| `true` / `12` / `a,b` (không tiền tố) | `true` / `12` / `["a","b"]` | Tự đoán kiểu |
| `regex:(` | **SyntaxError**: `Invalid regular expression: /(/: Unterminated group` | Làm API dừng khi khởi động |

## 4. Lỗi file cấu hình (đã đo)

| File | Kết quả |
|------|---------|
| `.json` sai cú pháp | Dừng, `SyntaxError: <path>: Expected property name or '}' in JSON...` |
| `.yaml`/`.yml` sai cú pháp | Dừng, `YAMLException` của `js-yaml` (lỗi gốc); theo mã nguồn, T028 đo lại trên image |
| `.yaml` rỗng hoặc top-level không phải object | Dừng, `Error: YAML configuration file does not contain an object` (theo `read-configuration-from-yaml.ts`) |
| `.json` top-level không phải object (ví dụ mảng) | Dừng, `Error: JSON configuration file does not contain an object` (theo `read-configuration-from-json.ts`) |
| `.js` export số (không phải hàm hoặc object) | Dừng, `Error: Invalid JS configuration file export type. Requires one of "function", "object", received: "undefined"` |
| `.js` export hàm | Gọi với `process.env`, dùng object trả về |
| `regex:` sai cú pháp | Như mục 3 |

"Dừng" nghĩa là API không khởi động, in lỗi gốc và thoát với mã khác 0 (Node thoát mã 1 với lỗi chưa bắt).

## 5. Biến "chưa hỗ trợ" (FR-014)

Nhóm biến được phân loại theo `DIRECTUS_VARIABLES` của Directus 11.17.4. API mới ghi **một dòng**
cảnh báo (mức `warn`) khi có biến thuộc nhóm C trong **cấu hình thô** (process hoặc file
`CONFIG_PATH`; key `X_FILE` tính theo tên `X`). Giá trị mặc định không tính là "đã đặt". Mỗi tên
xuất hiện một lần, sắp xếp A–Z, không bao giờ in giá trị.

| Nhóm | Hành vi | Biến (mẫu tên, đầy đủ ở feature 001) |
|------|---------|----------------------------------------|
| **A. Hỗ trợ** | Đọc và dùng | `CONFIG_PATH`, `HOST`, `PORT`, `PUBLIC_URL`, `LOG_LEVEL`, `LOG_STYLE`, `LOG_HTTP_IGNORE_PATHS`, `LOGGER_.+`, `MAX_PAYLOAD_SIZE`, `ROOT_REDIRECT`, `OPENAPI_ENABLED`, `QUERYSTRING_MAX_PARSE_DEPTH`, `QUERYSTRING_ARRAY_LIMIT`, `ROBOTS_TXT`, `TEMP_PATH`, `SERVER_.+`, `DB_.+`, `SECRET`, `SESSION_COOKIE_NAME`, `REDIS`, `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_DB`, `IP_TRUST_PROXY`, `IP_CUSTOM_HEADER`, `CONTENT_SECURITY_POLICY_.+`, `CROSS_ORIGIN_OPENER_POLICY_ENABLED`, `CROSS_ORIGIN_OPENER_POLICY`, `HSTS_.+`, `CORS_ENABLED`, `CORS_ORIGIN`, `CORS_METHODS`, `CORS_ALLOWED_HEADERS`, `CORS_EXPOSED_HEADERS`, `CORS_CREDENTIALS`, `CORS_MAX_AGE`, `RATE_LIMITER_.+` (trừ `RATE_LIMITER_EMAIL_.+`; `RATE_LIMITER_REGISTRATION_.+` vào nhóm A từ feature 004), `CACHE_ENABLED`, `CACHE_TTL`, `CACHE_NAMESPACE`, `CACHE_STORE`, `CACHE_HEALTHCHECK_THRESHOLD`, `STORAGE_LOCATIONS`, `STORAGE_.+_DRIVER`, `STORAGE_.+_ROOT`, `STORAGE_.+_KEY`, `STORAGE_.+_SECRET`, `STORAGE_.+_BUCKET`, `STORAGE_.+_REGION`, `STORAGE_.+_ENDPOINT`, `STORAGE_.+_ACL`, `STORAGE_.+_SERVER_SIDE_ENCRYPTION`, `STORAGE_.+_SERVER_SIDE_ENCRYPTION_KMS_KEY_ID`, `STORAGE_.+_HEALTHCHECK_THRESHOLD`, `METRICS_ENABLED`, `METRICS_SCHEDULE`, `METRICS_TOKENS`, `METRICS_SERVICES`, `METRICS_HEALTH_CHECK_PREFIX`, `METRICS_NAME_PREFIX`, `EXTENSIONS_PATH`, `EXTENSIONS_LOCATION`, `MIGRATIONS_PATH`, `CACHE_SCHEMA`, `CACHE_SCHEMA_MAX_ITERATIONS`, `CACHE_SCHEMA_SYNC_TIMEOUT`, `CACHE_SCHEMA_FREEZE_ENABLED`, `CACHE_SYSTEM_TTL`, `CACHE_DEPLOYMENT_TTL`, `CACHE_AUTO_PURGE`, `REDIS_BUS_NAMESPACE`, `REDIS_LOCK_NAMESPACE`, `REDIS_PERMISSIONS_NAMESPACE` (thêm ở feature 002), `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `REFRESH_TOKEN_COOKIE_NAME`, `REFRESH_TOKEN_COOKIE_DOMAIN`, `REFRESH_TOKEN_COOKIE_SECURE`, `REFRESH_TOKEN_COOKIE_SAME_SITE`, `SESSION_COOKIE_TTL`, `SESSION_COOKIE_DOMAIN`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAME_SITE`, `SESSION_REFRESH_GRACE_PERIOD`, `LOGIN_STALL_TIME`, `PASSWORD_RESET_URL_ALLOW_LIST`, `HASH_.+`, `USERS_ADMIN_ACCESS_LIMIT`, `USERS_APP_ACCESS_LIMIT`, `USERS_API_ACCESS_LIMIT`, `MAX_BATCH_MUTATION`, `CACHE_AUTO_PURGE_IGNORE_LIST`, `AUTH_PROVIDERS`, `AUTH_DISABLE_DEFAULT`, `AUTH_ALLOWED_PUBLIC_URLS`, `AUTH_.+_DRIVER`, `AUTH_.+_CLIENT_ID`, `AUTH_.+_CLIENT_SECRET`, `AUTH_.+_SCOPE`, `AUTH_.+_AUTHORIZE_URL`, `AUTH_.+_ACCESS_URL`, `AUTH_.+_PROFILE_URL`, `AUTH_.+_IDENTIFIER_KEY`, `AUTH_.+_EMAIL_KEY`, `AUTH_.+_FIRST_NAME_KEY`, `AUTH_.+_LAST_NAME_KEY`, `AUTH_.+_ALLOW_PUBLIC_REGISTRATION`, `AUTH_.+_DEFAULT_ROLE_ID`, `AUTH_.+_SYNC_USER_INFO`, `AUTH_.+_ICON`, `AUTH_.+_LABEL`, `AUTH_.+_PARAMS`, `AUTH_.+_ISSUER_URL`, `AUTH_.+_ISSUER_DISCOVERY_MUST_SUCCEED`, `AUTH_.+_CLIENT_HTTP_.+`, `AUTH_.+_AUTH_REQUIRE_VERIFIED_EMAIL`, `AUTH_.+_CLIENT_URL`, `AUTH_.+_BIND_DN`, `AUTH_.+_BIND_PASSWORD`, `AUTH_.+_USER_DN`, `AUTH_.+_USER_ATTRIBUTE`, `AUTH_.+_USER_SCOPE`, `AUTH_.+_MAIL_ATTRIBUTE`, `AUTH_.+_FIRST_NAME_ATTRIBUTE`, `AUTH_.+_LAST_NAME_ATTRIBUTE`, `AUTH_.+_GROUP_DN`, `AUTH_.+_GROUP_ATTRIBUTE`, `AUTH_.+_GROUP_SCOPE`, `AUTH_.+_REDIRECT_ALLOW_LIST`, `AUTH_.+_COOKIE_SECURE` (thêm ở feature 003), `USER_INVITE_TOKEN_TTL`, `USER_INVITE_URL_ALLOW_LIST`, `USER_REGISTER_URL_ALLOW_LIST`, `REGISTER_STALL_TIME`, `EMAIL_VERIFICATION_TOKEN_TTL`, `QUERY_LIMIT_DEFAULT`, `QUERY_LIMIT_MAX`, `RELATIONAL_BATCH_SIZE`, `MAX_JSON_QUERY_DEPTH` (thêm ở feature 004), `CACHE_STATUS_HEADER`, `CACHE_VALUE_MAX_SIZE`, `CACHE_SKIP_ALLOWED`, `CACHE_CONTROL_S_MAXAGE`, `WEBSOCKETS_ENABLED`, `WEBSOCKETS_REST_ENABLED`, `WEBSOCKETS_GRAPHQL_ENABLED` (thêm ở feature 005), `FILE_METADATA_ALLOW_LIST`, `FILES_MAX_UPLOAD_SIZE`, `FILES_MAX_UPLOAD_CONCURRENCY`, `FILES_CONTENT_TYPE_ALLOW_LIST`, `FILES_DELETE_ORIGINAL_ON_MOVE`, `ASSETS_CACHE_TTL`, `ASSETS_CACHE_REVALIDATE`, `ASSETS_TRANSFORM_MAX_CONCURRENT`, `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION`, `ASSETS_TRANSFORM_MAX_OPERATIONS`, `ASSETS_TRANSFORM_TIMEOUT`, `ASSETS_CONTENT_SECURITY_POLICY`, `ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL`, `IMPORT_IP_DENY_LIST`, `SYNCHRONIZATION_STORE`, `SYNCHRONIZATION_NAMESPACE` (thêm ở feature 007), `FLOWS_ENV_ALLOW_LIST`, `FLOWS_RUN_SCRIPT_MAX_MEMORY`, `FLOWS_RUN_SCRIPT_TIMEOUT`, `RATE_LIMITER_EMAIL_FLOWS_.+` (thêm ở feature 009), `IMPORT_TIMEOUT`, `IMPORT_MAX_CONCURRENCY`, `IMPORT_EXPORT_NAMESPACE`, `MAX_IMPORT_ERRORS`, `EXPORT_BATCH_SIZE`, `EXTENSIONS_CACHE_TTL`, `MARKETPLACE_REGISTRY`, `MARKETPLACE_TRUST`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_TOKEN` (thêm ở feature 010; ba biến ADMIN_* từ nhóm B vì POST /server/setup gọi createAdmin, hàm đọc chúng như Directus) |
| **B. Không áp dụng cho API** | Bỏ qua, **không** cảnh báo (chỉ lệnh `bootstrap` và CLI của Directus dùng, API mới không có CLI) | `PROJECT_OWNER` (feature 010 chuyển ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_TOKEN sang nhóm A) |
| **C. Chưa hỗ trợ** | Cảnh báo | Mọi biến còn lại của `DIRECTUS_VARIABLES`, ví dụ `AUTH_.+`, `EMAIL_.+`, `WEBSOCKETS_.+` (trừ ba biến của feature 005), `GRAPHQL_.+`, `FILES_.+`, `ASSETS_.+`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_.+`, `REDIS_COUNTERS_NAMESPACE`, `TELEMETRY*`, `MCP_ENABLED`, `AI_.+`, `SYNCHRONIZATION_.+`, `HASH_.+`, `RATE_LIMITER_EMAIL_.+` (trừ `RATE_LIMITER_EMAIL_FLOWS_.+`, nhóm A từ feature 009; không gửi email), `SERVE_APP` (không vào dòng cảnh báo nhóm C, xem dưới; từ feature 010 được đọc để quyết `GET /extensions/sources/index.js`, cảnh báo D-08 giữ nguyên) |

- **`SERVE_APP`**: mặc định của Directus là `true`. API mới chỉ cảnh báo (dòng 4 của `contracts/startup.md`, không
  phải dòng 3) khi key `SERVE_APP` có mặt trong cấu hình thô và giá trị sau ép kiểu là `true`; `false` hoặc không đặt
  thì không cảnh báo. Dù đặt hay không, `/admin` và `/admin/*` trả `404 ROUTE_NOT_FOUND`.
- Biến không thuộc `DIRECTUS_VARIABLES` (ví dụ `PATH`, `HOME`, `STORAGE_S3_FORCE_PATH_STYLE`,
  `UNIX_SOCKET_PATH`) không bao giờ bị cảnh báo. `UNIX_SOCKET_PATH`, `STORAGE_S3_FORCE_PATH_STYLE`
  vẫn được đọc và dùng như Directus.
- Danh sách nhóm A và B trong mã (`apps/api/src/config/supported-variables.ts`) PHẢI trùng bảng trên.
  Một unit test kiểm: mọi mẫu ở nhóm A và B khớp ít nhất một mục trong `DIRECTUS_VARIABLES` (ngoại trừ
  các biến đọc nhưng không thuộc `DIRECTUS_VARIABLES`). Mỗi feature sau chuyển biến từ C sang A và sửa
  bảng này trong cùng PR.
- Điều kiện kiểm FR-014: với một cấu hình có ít nhất một biến nhóm C (ví dụ `AUTH_PROVIDERS`), một biến
  nhóm B (`ADMIN_EMAIL`) và một biến ngoài danh sách (`FOO`), dòng cảnh báo chỉ chứa nhóm C, đúng tên,
  A–Z, không có giá trị.

## 6. Kiểm thử contract

- `libs/env` mang theo toàn bộ unit test gốc của `@directus/env`, cộng `directus-compat.test.ts` mã hóa
  các bảng ở mục 2, 3, 4.
- `apps/api` có unit test cho cảnh báo FR-014 và cho `SERVE_APP`.
- Khi nâng phiên bản Directus tham chiếu, chạy lại các thử nghiệm đo trên image mới để cập nhật bảng.
