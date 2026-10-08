# Data Model: Nền tảng workspace và kết nối hệ thống (001)

**Ngày**: 2026-10-08 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Feature này **không tạo, sửa hay xóa** bảng hay dòng nào trong DB (FR-022). Các bảng `directus_*` dưới
đây chỉ được đọc. Ngoài DB, API mới ghi vài key tạm vào Redis và file kiểm tra vào storage, giống
Directus (mục 4).

## 1. Bảng Directus được đọc

| Bảng | Cột đọc | Dùng ở | SQL (giống Directus) |
|------|---------|--------|----------------------|
| `directus_migrations` | `version` | Kiểm tra khi khởi động (FR-031) | `select version from directus_migrations` |
| `directus_collections` | tồn tại bảng; `collection`, `singleton`, `note`, `sort_field`, `accountability` | `isInstalled()` (FR-030); SchemaOverview (OAS; `/server/info` khi không có dòng settings) | `hasTable` của inspector; `select collection, singleton, note, sort_field, accountability from directus_collections` |
| `directus_fields` | `id`, `collection`, `field`, `special`, `note`, `validation`, `searchable` | SchemaOverview (OAS; `/server/info` khi không có dòng settings) | `select id, collection, field, special, note, validation, searchable from directus_fields` |
| `directus_relations` | mọi cột | SchemaOverview (OAS; `/server/info` khi không có dòng settings) | `select * from directus_relations` |
| `directus_users` | có dòng hay không | `setupCompleted` của `/server/info` | `select * from directus_users limit 1` |
| `directus_settings` | 16 field của `/server/info`, `public_background`, `id` | `/server/info` | `select ... from directus_settings order by id asc limit 1` |
| `directus_files` | `id`, `type` | `public_background` của `/server/info` | `select id, type from directus_files where id in (?)` |
| `directus_access` | `role`, `policy`, `id` | Quyền public (OAS) | `select role, policy, id from directus_access where role is null and "user" is null order by sort` |
| `directus_policies` | `id`, `ip_access` | Quyền public (OAS) | `select id, ip_access from directus_policies where id in (...)` |
| `directus_permissions` | mọi cột | Quyền public (OAS) | `select * from directus_permissions where policy in (...) [and action = 'read'] order by id` |
| File hệ thống (chỉ đọc tên) | Tên file trong `MIGRATIONS_PATH` và `<EXTENSIONS_PATH>/migrations` | Migration tùy biến (FR-031) | `readdir`, không mở, không `import` |
| Catalog của DB | bảng, cột, khóa ngoại | SchemaOverview (OAS; `/server/info` khi không có dòng settings); kiểm tra PostGIS/Spatialite; collation MySQL | Câu truy vấn của `@backoffice/schema` (port `@directus/schema`); `pg_proc`, `pragma_function_list`; `information_schema` |

Quy tắc chuyển đổi giá trị khi đọc (theo `special` của `@directus/system-data`):

- `cast-boolean`: `true`, `1`, `'1'` → `true`; `false`, `0`, `'0'` → `false`; `null`, `''` → `null`.
  Áp cho `directus_settings.public_registration`, `public_registration_verify_email`.
- `cast-json`: chuỗi → `parseJSON` (bỏ key `__proto__`); JSON lỗi thì giữ chuỗi; object giữ nguyên.
  Áp cho `theme_light_overrides`, `theme_dark_overrides`, `directus_permissions.permissions`,
  `validation`, `presets`.
- `cast-csv`: chuỗi `a,b` → `['a', 'b']`. Áp cho `directus_policies.ip_access`,
  `directus_permissions.fields`, `directus_relations.one_allowed_collections`.

## 2. Cấu trúc trong bộ nhớ

### 2.1 Cấu hình (`Env`)

- Nguồn, theo thứ tự ghi đè: giá trị mặc định (`DEFAULTS`) < biến của process < file `CONFIG_PATH`. Biến
  `X_FILE` (chỉ với biến Directus) được thay bằng nội dung file và đổi tên thành `X`; khi cùng có `X` và
  `X_FILE`, key xuất hiện sau thắng (FR-016).
- Mỗi giá trị được ép kiểu: tiền tố (`string:`, `number:`, `regex:`, `array:`, `json:`, `boolean:`) →
  kiểu mặc định theo tên (`TYPE_MAP`) → đoán kiểu.
- Tạo một lần khi khởi động, chỉ đọc sau đó. Không ghi ra ngoài process, không log giá trị.
- **Danh sách biến chưa hỗ trợ**: key có trong process hoặc file (key `X_FILE` tính theo `X`), là biến
  Directus (`DIRECTUS_VARIABLES`), không thuộc nhóm A (hỗ trợ) hoặc B (không áp dụng cho API) của
  `contracts/config.md` §5 → log một dòng `warn` gồm tên A–Z, mỗi tên một lần. Giá trị mặc định không tính.
  Riêng `SERVE_APP`: không vào dòng này; chỉ cảnh báo ở dòng riêng khi có mặt và giá trị sau ép kiểu là
  `true` (`contracts/config.md` §5).

### 2.2 Danh sách migration và kết quả so sánh

```text
MigrationCheck {
  required: string[]   // 101 version của Directus 11.17.4 (hằng số) + version tùy biến
  custom: string[]     // phần trước dấu '-' của file trong MIGRATIONS_PATH (có '-', .js/.cjs/.mjs) và
                       // <EXTENSIONS_PATH>/migrations (mọi .js; không có '-' thì cả tên file); bỏ trùng; thư mục thiếu/rỗng → rỗng
  completed: string[]  // directus_migrations.version
  missing: string[]    // required - completed, sắp xếp tăng dần
  extra: string[]      // completed - required, sắp xếp tăng dần
}
```

- `missing` hoặc `extra` khác rỗng → log `error`, thoát mã 1.
- `custom` khác rỗng → log `warn` liệt kê.

### 2.3 Accountability của request (feature 001)

```text
{ role: null, user: null, roles: [], admin: false, app: false, ip: string | null,
  userAgent?: string (≤ 1024 ký tự), origin?: string }
```

Mọi request đều là public (FR-044). Feature 003 thay bằng accountability thật.

### 2.4 SchemaOverview (khi gọi `/server/specs/oas`; ở `/server/info` chỉ khi `directus_settings` không có dòng nào)

Cùng kiểu `SchemaOverview` của Directus (`@directus/types`):

```text
SchemaOverview {
  collections: Record<string, {
    collection, primary, singleton, note, sortField, accountability,
    fields: Record<string, { field, defaultValue, nullable, generated, type, dbType,
                             precision, scale, special[], note, validation, alias, searchable }>
  }>
  relations: Relation[]   // { collection, field, related_collection, schema, meta }
}
```

- Bỏ bảng trong `DB_EXCLUDE_TABLES`, bảng không có khóa chính, bảng có dấu cách (log `warn` như
  Directus).
- Dựng mới mỗi lần, không cache (cache thuộc feature 002).

### 2.5 Quyền public

```text
policies: string[]             // id policy gắn với public (role null, user null), đã lọc theo IP, theo thứ tự sort
permissions: Permission[]      // { collection, action, fields[], permissions, validation, presets, policy }
allowedFieldMap: Record<collection, field[]>   // từ permission action 'read'
```

### 2.6 Kết quả kiểm tra sức khỏe

```text
HealthData {
  status: 'ok' | 'warn' | 'error'
  releaseId: '11.17.4'
  serviceId: PUBLIC_URL
  checks: Record<'<client>:responseTime' | '<client>:connectionsAvailable' | '<client>:connectionsUsed'
                 | 'cache:responseTime' | 'rateLimiter:responseTime' | 'rateLimiterGlobal:responseTime'
                 | 'storage:<location>:responseTime' | 'email:connection',
                 HealthCheck[]>
}
HealthCheck { componentType, observedValue?, observedUnit?, status, output?, threshold? }
```

Chuyển trạng thái:

- Bắt đầu `ok`. Server đang tắt (`SERVER_ONLINE = false`) → `error`.
- Duyệt từng thành phần: `warn` khi đang `ok` → `warn` (log `warn`); `error` → `error` (log `error`),
  dừng duyệt.
- `email:connection` luôn `ok` (khác biệt đã ghi trong spec).
- Request không phải admin chỉ nhận `{status}`. HTTP `503` khi `error`, còn lại `200`.

### 2.7 Metric

| Tên (`<p>` = `METRICS_NAME_PREFIX`, mặc định `directus_`) | Loại | Bật khi `METRICS_SERVICES` có |
|---|---|---|
| `<p>db_<DB_CLIENT>_connection_errors` | Counter | `database` |
| `<p>db_<DB_CLIENT>_response_time_ms` (bucket 1, 10, 20, 40, 60, 80, 100, 200, 500, 750, 1000) | Histogram | `database` |
| `<p>cache_<CACHE_STORE>_connection_errors` | Counter | `cache` và `CACHE_ENABLED=true` (với `CACHE_STORE=redis` cần có cấu hình Redis) |
| `<p>redis_connection_errors` | Counter | `redis` (khi có cấu hình Redis) |
| `<p>storage_<location>_connection_errors` | Counter | `storage` |

Sinh theo `METRICS_SCHEDULE` (cron), mỗi process một lần chạy cùng lúc (khóa trong process 10 phút như
Directus, chỉ chống chạy chồng trong một process; ngoại lệ Nguyên tắc VII ghi ở Complexity Tracking của plan).

## 3. Dữ liệu của bộ test đối chiếu

### 3.1 Khác biệt được chấp nhận (`tests/parity/accepted-differences.ts`)

```text
AcceptedDifference {
  id: string                 // cột "Mã" trong bảng "Khác biệt so với Directus" của spec (D-01, D-09.3...)
  feature: string            // spec đã thêm mục, ví dụ '001'; mã chỉ duy nhất trong spec đó
  removeAt?: string          // số feature (cột "Gỡ khi"), chỉ với khác biệt tạm thời
  kind: 'http' | 'doc'       // 'doc': khác biệt ngoài response HTTP (log, package, migration, khởi động); bộ so sánh bỏ qua
  endpoints?: string[]       // chỉ với 'http', ví dụ ['*'] hoặc ['GET /server/specs/oas']
  location?: { status: true } | { header: string } | { jsonPointer: string }   // chỉ với 'http'; jsonPointer '' là cả body
  directus?: Matcher         // giá trị hoặc regex phía Directus
  backoffice?: Matcher       // giá trị hoặc regex phía API mới
  reason: string
}
```

Ràng buộc: mỗi `id` phải có trong bảng của `specs/<feature>-*/spec.md` ghi ở `feature` (mã trùng ở spec
khác không tính); `removeAt` phải khớp cột "Gỡ khi" của bảng đó;
mục còn lại sau khi spec của feature `removeAt` có `Status: Done` làm `accepted-differences.test.ts`
fail (FR-101). Khác biệt không khớp dòng nào làm test đối chiếu fail.

### 3.2 Bộ chuẩn hóa (không phải khác biệt)

- `/server/health` của admin: `observedValue` (thời gian đo) — chỉ so kiểu (dùng từ feature 003).
- `/server/specs/oas`: bỏ `info.version` và ETag; so object không phụ thuộc thứ tự key; sắp `tags` và
  `paths` theo tên (FR-105).
- `Retry-After`, `extensions.reset`, message `REQUESTS_EXCEEDED`: chỉ so định dạng và `extensions.limit`.

### 3.3 Snapshot DB

```text
DbSnapshot {
  vendor: string
  tables: { name: string; columns: { name, type, nullable, default }[]; rowCount: number;
            checksum: string /* SHA-256 các dòng, ORDER BY khóa chính; không có khóa chính thì ORDER BY mọi cột */ }[]   // mọi bảng, không chỉ directus_*
  indexes: { table: string; name: string; columns: string[]; unique: boolean }[]   // mọi index của mọi bảng
  foreignKeys: { table, column, foreignKeyTable, foreignKeyColumn, constraintName }[]   // qua inspector.foreignKeys()
}
```

Hai snapshot (trước và sau khi API mới chạy) phải bằng nhau tuyệt đối (SC-003).

## 4. Dữ liệu ghi ra ngoài DB (giống Directus)

| Nơi | Key hoặc file | Khi nào | Ghi chú |
|-----|---------------|---------|---------|
| Cache (`CACHE_STORE`) | key `directus-health-<nanoid5>` trong namespace `CACHE_NAMESPACE` (định dạng key do `keyv@5.5.3` và `@keyv/redis@3.0.1` sinh, cùng bản với Directus) | Gọi `/server/health` khi `CACHE_ENABLED` | Ghi rồi xóa ngay, TTL 5 ms theo tham số gốc `cache.set(key, true, 5)` |
| Rate limiter (`RATE_LIMITER_STORE`) | `rlflx:<ip>`, `rlflx:global-rate-limit` | Mỗi request khi bật rate limiter | Đếm chung với Directus |
| Rate limiter | `rlflx:directus-health-<nanoid5>` | Gọi `/server/health` khi bật rate limiter | Consume rồi delete |
| Redis | `directus-metric-<uuid>` (theo `METRICS_HEALTH_CHECK_PREFIX`) | Mỗi lượt sinh metric | Set rồi del |
| Cache (`CACHE_STORE`) | key `<METRICS_HEALTH_CHECK_PREFIX><uuid>` trong namespace `CACHE_NAMESPACE` | Mỗi lượt sinh metric khi metric cache bật | Set rồi xóa ngay, TTL 5 ms (`cache.set(key, '1', 5)`) |
| Storage (mỗi location) | `directus-health-file` | Gọi `/server/health` | Ghi đè cùng một file |
| Storage (mỗi location) | `directus-metric-file` | Mỗi lượt sinh metric | Ghi đè cùng một file |
