# Contract: Biến môi trường của feature 004

Tên, mặc định và cách ép kiểu giống Directus 11.17.4 (`libs/env`). Các biến dưới đây chuyển từ nhóm C ("chưa hỗ
trợ", có cảnh báo) sang nhóm A ("hỗ trợ") trong `apps/api/src/config/supported-variables.ts` (FR-095). Không thêm biến
`BACKOFFICE_*`.

## 1. Chuyển sang nhóm A

| Biến (mẫu regex) | Mặc định | Dùng ở |
|------------------|----------|--------|
| `USER_INVITE_TOKEN_TTL` | `7d` | hạn token mời |
| `USER_INVITE_URL_ALLOW_LIST` | không có | kiểm `invite_url` (`isUrlAllowed`) |
| `USER_REGISTER_URL_ALLOW_LIST` | không có | kiểm `verification_url` |
| `REGISTER_STALL_TIME` | `750` | thời gian chờ của `registerUser` |
| `EMAIL_VERIFICATION_TOKEN_TTL` | `7d` | hạn token xác minh |
| `RATE_LIMITER_REGISTRATION_ENABLED` | `true` | limiter đăng ký |
| `RATE_LIMITER_REGISTRATION_POINTS` | `5` | |
| `RATE_LIMITER_REGISTRATION_DURATION` | `60` | |
| `QUERY_LIMIT_DEFAULT` | `100` | `sanitizeQuery` (thêm khi lập plan; `sanitizeQuery` cần) |
| `QUERY_LIMIT_MAX` | không có | `sanitizeQuery` (thêm khi lập plan) |
| `MAX_RELATIONAL_DEPTH` | `10` | `validateQuery`. Không thuộc `DIRECTUS_VARIABLES` nên không có trong nhóm A, C và không bao giờ bị cảnh báo; vẫn được đọc như Directus |
| `RELATIONAL_BATCH_SIZE` | `25000` | `run-ast` (đọc o2m theo lô; thêm khi lập plan) |
| `MAX_JSON_QUERY_DEPTH` | `10` | `helpers/fn/json/parse-function` (hàm `json()` trong fields; thêm khi lập plan) |

Mẫu `RATE_LIMITER_(?!REGISTRATION_|EMAIL_).+` của 001 đổi thành `RATE_LIMITER_(?!EMAIL_).+`.

## 2. Vẫn ở nhóm C (cảnh báo khi khởi động)

| Biến | Lý do |
|------|-------|
| `RATE_LIMITER_EMAIL_*`, `RATE_LIMITER_EMAIL_FLOWS_*`, `EMAIL_*` | Không gửi email (Nguyên tắc X, D-27, D-28); ở Directus limiter email chỉ chặn bước gửi chạy nền, không đổi response |
| `CACHE_VALUE_MAX_SIZE`, `CACHE_SKIP_ALLOWED`, `CACHE_CONTROL_S_MAXAGE`, `CACHE_STATUS_HEADER` | Đọc response cache là 005 (D-11) |
| `AUTH_.+_IDP.+`, `AUTH_.+_SP.+` | SAML (D-24) |

## 3. Biến đã ở nhóm A mà feature này dùng thêm

`MAX_BATCH_MUTATION`, `CACHE_AUTO_PURGE`, `CACHE_AUTO_PURGE_IGNORE_LIST`, `CACHE_ENABLED`, `CACHE_TTL`,
`CACHE_NAMESPACE`, `CACHE_STORE`, `CACHE_SYSTEM_TTL`, `REDIS_PERMISSIONS_NAMESPACE`, `USERS_*_ACCESS_LIMIT`,
`HASH_*`, `SECRET`, `PUBLIC_URL`, `IP_TRUST_PROXY`, `IP_CUSTOM_HEADER`, `RATE_LIMITER_STORE`, `METRICS_TOKENS`.

## 4. Cảnh báo một instance

Không có lý do mới. `RATE_LIMITER_STORE=memory` (dòng của 001, mở rộng ở 003) nay gồm cả limiter đăng ký.
