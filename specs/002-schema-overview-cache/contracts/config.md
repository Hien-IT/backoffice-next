# Contract: Biến môi trường của feature 002

Tên, mặc định và cách ép kiểu giống Directus 11.17.4. Nguồn mặc định: `libs/env/src/constants/defaults.ts` (port
nguyên `directus/packages/env`) và giá trị dự phòng trong code Directus. Các biến dưới đây chuyển từ "chưa hỗ
trợ" sang "hỗ trợ" trong `apps/api/src/config/supported-variables.ts`.

| Biến | Mặc định | Tác dụng ở app mới |
|------|----------|--------------------|
| `CACHE_SCHEMA` | `true` | `false`: dựng schema mới mỗi request, không khóa, không `schemaCache--done` |
| `CACHE_SCHEMA_MAX_ITERATIONS` | `100` | Lượt khóa đạt ngưỡng thì xóa khóa |
| `CACHE_SCHEMA_SYNC_TIMEOUT` | `10000` (ms) | Thời gian chờ `schemaCache--done` trước khi thử lại |
| `CACHE_SCHEMA_FREEZE_ENABLED` | `false` | `true`: trả schema đóng băng. `false`: trả `cloneDeep` mỗi lần |
| `CACHE_SYSTEM_TTL` | không có (không hết hạn) | TTL của `systemCache`, `localSchemaCache`, permissions cache trên Redis |
| `CACHE_DEPLOYMENT_TTL` | không có, code dùng 5000 ms | TTL của `deploymentCache` (chỉ tạo instance, deployment ngoài phạm vi) |
| `CACHE_AUTO_PURGE` | `false` | Khi nhận `schemaChanged` với `CACHE_STORE=memory`: xóa `cache` |
| `CACHE_NAMESPACE` | `system-cache` | Đã hỗ trợ từ 001. Nay áp dụng thêm cho `_system`, `_deployment`, `_schema`, `_lock` |
| `CACHE_STORE` | `memory` | Đã hỗ trợ từ 001. Nay áp dụng thêm cho `systemCache`, `deploymentCache`, `lockCache` |
| `REDIS_BUS_NAMESPACE` | không có, code dùng `directus:bus` | Namespace kênh bus |
| `REDIS_LOCK_NAMESPACE` | không có, code dùng `directus:lock` | Namespace khóa dựng schema |
| `REDIS_PERMISSIONS_NAMESPACE` | không có, code dùng `permissions` | Namespace permissions cache và kênh `multi-cache` |

Vẫn chưa hỗ trợ (cảnh báo khi khởi động; thuộc feature 005): `CACHE_AUTO_PURGE_IGNORE_LIST`,
`CACHE_CONTROL_S_MAXAGE`, `CACHE_STATUS_HEADER`, `CACHE_VALUE_MAX_SIZE`, `CACHE_SKIP_ALLOWED`.

Bus, khóa và permissions cache dùng Redis khi `redisConfigAvailable()`, tức có `REDIS` hoặc biến `REDIS_*`, hoặc
`REDIS_ENABLED=true`. Việc này không phụ thuộc `CACHE_STORE`, giống Directus.

Không thêm biến `BACKOFFICE_*` nào.
