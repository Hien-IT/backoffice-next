# Hướng dẫn Spec Kit: clone Directus sang Nx (NestJS + Vue)

Tài liệu này hướng dẫn dùng Spec Kit để xây app mới dựa trên code mẫu Directus 11.17.4 trong `directus/`.
Mỗi phần có prompt sẵn để dán vào Claude Code (mở ở thư mục `backoffice-next/`).

---

## 1. Các quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Code mẫu | `directus/` (Directus 11.17.4, api 35.2.0, app 15.10.0). **Chỉ đọc, không sửa.** Được copy code sang app mới. |
| Cấu trúc | Nx monorepo tại `backoffice-next/`: `apps/api` (NestJS), `apps/web` (Vue 3), `libs/*` dùng chung. |
| Database | Dùng **chung DB** với Directus. Hỗ trợ mọi DB Directus hỗ trợ (Postgres, MySQL/MariaDB, SQLite, MSSQL, Oracle, CockroachDB) qua **Knex**. |
| Migration | **Chỉ Directus** chạy migration cho bảng `directus_*`. App mới kiểm tra phiên bản migration khi khởi động. |
| API | REST **giống hệt** Directus: path, query, response, mã lỗi. `@directus/sdk` dùng được. |
| Auth | **Token dùng chéo**: chung `SECRET`, chung bảng `directus_sessions`, chung static token. |
| Cache | **Chung Redis**: cùng format cache key và kênh bus, sửa ở app này thì app kia xóa cache ngay. |
| Flows | Flow theo lịch: **lock qua Redis**, mỗi lượt chỉ một app chạy. Flow theo sự kiện: app nào nhận request thì app đó chạy. |
| FE | **Viết mới** bằng Vue 3 + **PrimeVue**, giữ nguyên luồng màn hình của Directus. |
| Extensions | **Chưa làm** trong giai đoạn này. |
| Phạm vi | Lõi dữ liệu, Files & assets, Flows & tự động hóa, Insights/dashboards, GraphQL, Translations, Versions, Shares. **Không làm Realtime WebSocket.** |

---

## 2. Quy trình Spec Kit cho mỗi feature

```
/speckit.constitution   (chạy 1 lần cho cả dự án)
        │
        ▼  lặp lại cho từng feature, theo thứ tự ở mục 5
/speckit.specify  →  /speckit.clarify  →  /speckit.plan  →  /speckit.checklist
        →  /speckit.tasks  →  /speckit.analyze  →  /speckit.implement
```

| Lệnh | Làm gì | Ghi chú |
|---|---|---|
| `/speckit.specify` | Viết spec: **làm gì và vì sao** | Không ghi tech stack ở đây. Mô tả hành vi, luồng, tiêu chí chấp nhận. |
| `/speckit.clarify` | Claude hỏi tối đa 5 câu để làm rõ spec | Nên chạy với feature lớn. |
| `/speckit.plan` | Viết plan kỹ thuật: **làm thế nào** | Đây là chỗ ghi NestJS, Knex, PrimeVue, file Directus cần tham chiếu. |
| `/speckit.checklist` | Tạo checklist kiểm tra chất lượng yêu cầu | Tùy chọn. |
| `/speckit.tasks` | Chia plan thành task có thứ tự | |
| `/speckit.analyze` | Kiểm tra spec, plan, tasks có khớp nhau không | Chạy trước khi implement. |
| `/speckit.implement` | Code theo tasks | |

**Ba nguyên tắc khi viết spec:**

1. **Mỗi spec một feature vừa phải.** Đừng gộp cả Directus vào một spec. Lộ trình ở mục 5 đã chia sẵn.
2. **Spec mô tả hành vi, plan mô tả công nghệ.** Ví dụ trong spec viết "người dùng lọc item theo `_eq`, `_in`... giống Directus". Trong plan mới viết "port `api/src/database/run-ast/lib/apply-query` sang NestJS".
3. **Luôn chỉ ra file tham chiếu trong `directus/`.** Claude sẽ đọc code gốc để giữ đúng luồng.

---

## 3. Chuẩn bị trước khi chạy Spec Kit (đã làm sẵn)

1. **Git ở thư mục gốc**, nhánh `main`. Spec Kit tạo một branch cho mỗi feature (`001-...`, `002-...`).
   `directus/` được đưa vào repo để Claude tìm kiếm được trong code mẫu. File bị `.gitignore` sẽ không hiện khi tìm kiếm.
2. **Chưa tạo Nx workspace.** Việc tạo workspace bằng `create-nx-workspace` nằm trong feature `001`, để Spec Kit ghi lại đầy đủ.
3. **Directus 11.17.4 tham chiếu** ở `dev/directus-reference/`, gồm Postgres (PostGIS), Redis và MinIO (S3), tắt WebSocket giống phạm vi app mới. App mới sẽ trỏ vào cùng DB, Redis và storage này.

   | Dịch vụ | Địa chỉ |
   |---|---|
   | Directus | http://localhost:8055 |
   | Postgres | localhost:5432 |
   | Redis | localhost:6379 |
   | MinIO | http://localhost:9000 (API), http://localhost:9001 (console) |

   Tài khoản admin, mật khẩu DB, `SECRET` và key MinIO nằm trong `dev/directus-reference/.env`. File này sinh ngẫu nhiên và không đưa vào git.

   ```bash
   cd dev/directus-reference
   docker compose up -d --wait   # bật
   docker compose down           # tắt, giữ dữ liệu
   docker compose down -v        # tắt và xóa toàn bộ dữ liệu
   ```

---

## 4. Bước 1: Constitution

Constitution là bộ nguyên tắc bắt buộc. Mọi spec, plan, tasks đều được đối chiếu với nó. Dán prompt sau:

```text
/speckit.constitution Dự án xây lại Directus 11.17.4 thành app mới tách FE/BE, dùng code mẫu trong thư mục directus/. Các nguyên tắc bắt buộc:

I. Directus là nguồn tham chiếu, chỉ đọc
- Tuyệt đối không sửa, xóa, hay tạo file trong thư mục directus/.
- Được copy code từ directus/ sang apps/ và libs/. File copy hoặc port phải ghi đường dẫn file gốc ở comment đầu file.
- Hành vi chuẩn là hành vi của Directus 11.17.4 (api 35.2.0, app 15.10.0). Khi spec không nói rõ, làm giống Directus.

II. Dùng chung database với Directus
- App mới dùng chung DB với một Directus đang chạy.
- Không tạo, sửa, xóa bảng hay cột hệ thống directus_*. Không chạy migration hệ thống. Chỉ Directus được migrate.
- Khi khởi động, app mới đối chiếu bảng directus_migrations với danh sách migration của 11.17.4. Lệch thì dừng và báo lỗi rõ ràng.
- Dữ liệu app mới ghi ra (users, sessions, activity, revisions, files, hash mật khẩu argon2, uuid, ngày giờ, JSON) phải có định dạng giống hệt Directus, để hai bên đọc ghi lẫn nhau được.
- Được tạo và sửa bảng dữ liệu người dùng qua API collections/fields/relations, giống Directus.

III. API giống hệt Directus
- REST API giữ nguyên path, query (fields, filter, search, sort, limit, offset, page, meta, aggregate, groupBy, deep, alias, export), response {data, meta}, lỗi {errors:[{message, extensions:{code}}]}, HTTP status, header và tên cookie.
- @directus/sdk và mọi client đang gọi Directus phải trỏ sang app mới được mà không cần sửa.
- GraphQL (/graphql, /graphql/system) cũng phải tương thích, trừ subscription.

IV. Chạy song song an toàn
- Dùng chung SECRET và cách ký JWT. Token cấp bởi app này dùng được ở app kia.
- Dùng chung Redis: cùng namespace, cache key, kênh bus, rate limiter. Thay đổi schema hay permission ở app nào thì cache ở app kia cũng bị xóa.
- Flow theo lịch dùng lock trên Redis, mỗi lượt chỉ một instance chạy. Flow theo sự kiện chạy ở instance nhận request.
- Không giả định là instance duy nhất. Không giữ state quan trọng trong bộ nhớ của một process.
- Đọc cùng tên biến môi trường như Directus (DB_*, SECRET, REDIS*, CACHE_*, STORAGE_*, PUBLIC_URL...).

V. Kiểm thử đối chiếu là bắt buộc
- Mỗi endpoint phải có test chạy với cả Directus thật và app mới, rồi so sánh status, body và tác động lên DB.
- Tái sử dụng bộ test trong directus/tests/blackbox (copy sang, cấu hình URL để chạy với cả hai app).
- Không coi feature là xong khi còn khác biệt chưa được ghi lại và chấp nhận trong spec.
- CI chạy tối thiểu Postgres, MySQL và SQLite. Các DB khác chạy theo lịch.

VI. Kiến trúc
- Nx monorepo: apps/api (NestJS), apps/web (Vue 3 + PrimeVue + Pinia + Vue Router), libs dùng chung (types, filter, validation, utils).
- BE: mỗi service của Directus tương ứng một provider NestJS. Controller mỏng, logic nằm trong service. Truy cập DB bằng Knex, không dùng ORM.
- FE: viết mới bằng Composition API, giữ nguyên luồng màn hình, route và hành vi của Directus app. Được copy logic hoặc composable từ directus/app khi cần.
- TypeScript strict, ESLint, Prettier. Mỗi thay đổi có test.

VII. Triển khai đa instance
- FE build ra file tĩnh, chạy trong một container nginx. URL API và cấu hình được đọc lúc chạy (runtime config), không ghi cứng lúc build, để một image dùng cho mọi môi trường.
- BE chạy được nhiều container cùng lúc sau load balancer, cùng với các instance Directus, tất cả ngang hàng trên cùng DB và Redis. Không cần sticky session.
- Khi chạy nhiều instance, Redis là bắt buộc cho cache, bus, rate limiter, lock flow theo lịch và lock upload TUS. Không dùng cache hay lock trong bộ nhớ process.
- File và ảnh đã transform lưu trên storage dùng chung (S3, GCS, Azure hoặc volume dùng chung). Không dùng storage local riêng từng container.
- Khởi động nhiều replica cùng lúc phải an toàn: chỉ đọc và kiểm tra migration, không ghi gì vào bảng hệ thống khi khởi động.
- Có /server/health cho readiness và liveness probe. Khi nhận SIGTERM, ngừng nhận request mới, chạy nốt request đang dở, đóng kết nối DB và Redis rồi mới thoát.
- FE và BE nên đặt chung một domain: /admin/* vào FE, các path API còn lại vào BE, giống bố cục của Directus.

VIII. Ngoài phạm vi giai đoạn này
- Realtime WebSocket: /websocket, GraphQL subscription, collaborative editing, system logs realtime. /server/info trả websocket: false, giống Directus khi WEBSOCKETS_ENABLED=false. App web ẩn các tính năng này như Directus app.
- Hệ thống extension, AI/MCP, module deployment của Directus (deploy lên Vercel, Netlify...), visual editing, telemetry.

Quy trình sửa constitution: mọi thay đổi phải ghi lý do, tăng phiên bản theo semver và cập nhật lại các template liên quan.
```

---

## 5. Lộ trình feature

Làm theo thứ tự. Mỗi dòng là một lần `/speckit.specify`.

| # | Feature | Phụ thuộc | Mảng |
|---|---|---|---|
| 001 | Nền tảng workspace và kết nối hệ thống | – | BE |
| 002 | Schema overview và cache dùng chung | 001 | BE |
| 003 | Xác thực và phiên đăng nhập | 002 | BE |
| 004 | Phân quyền (roles, policies, permissions, users) | 003 | BE |
| 005 | Engine truy vấn và CRUD items | 004 | BE |
| 006 | Quản lý data model (collections, fields, relations, schema) | 005 | BE |
| 007 | Files, folders, assets | 005 | BE |
| 008 | Activity, revisions, versions, comments | 005 | BE |
| 009 | Flows và tự động hóa | 005, 008 | BE |
| 010 | Collection hệ thống còn lại (settings, presets, notifications, shares, translations, dashboards, panels, utils) | 005 | BE |
| 011 | GraphQL | 005–010 | BE |
| 012 | Khung app web và đăng nhập | 003 | FE |
| 013 | Bộ interfaces và displays | 012 | FE |
| 014 | Module Content | 013 | FE |
| 015 | Module Files và Users | 013 | FE |
| 016 | Module Settings: data model, quyền, cài đặt | 013 | FE |
| 017 | Trình chỉnh sửa Flows | 016 | FE |
| 018 | Insights, Activity, Notifications | 013 | FE |
| 019 | Đóng gói và triển khai đa instance (Docker, K8s) | 001, 012 | DevOps |

**Mẹo:** API mới giống hệt Directus, nên FE (012–018) có thể bắt đầu ngay, trỏ vào Directus thật. Khi BE xong thì đổi URL sang NestJS. Hai mảng chạy song song được.

---

## 6. Prompt `/speckit.specify` cho từng feature

### 001: Nền tảng workspace và kết nối hệ thống

```text
/speckit.specify Nền tảng cho app mới clone Directus 11.17.4. Cần có monorepo chứa app API, app web và các thư viện dùng chung. API đọc cấu hình từ cùng các biến môi trường như Directus (tham chiếu directus/api/src/env và packages/env), kết nối được tới mọi loại DB mà Directus hỗ trợ (Postgres, MySQL/MariaDB, SQLite, MSSQL, Oracle, CockroachDB) và tới Redis. Khi khởi động, API đọc bảng directus_migrations và so với danh sách migration của Directus 11.17.4. Nếu thiếu hoặc thừa migration, API dừng và báo rõ migration nào lệch. API không bao giờ tạo hay sửa bảng directus_*. Có các endpoint /server/ping, /server/health, /server/info, /server/specs/oas trả về giống Directus. Lỗi trả về đúng format errors[] và mã lỗi của Directus (tham chiếu packages/errors). Có bộ test đối chiếu: cùng request gửi tới Directus thật và app mới, rồi so sánh kết quả. Tiêu chí chấp nhận: chạy app mới cạnh Directus trên cùng DB và Redis, các endpoint /server/* trả về giống nhau, và DB không bị thay đổi.
```

### 002: Schema overview và cache dùng chung

```text
/speckit.specify API cần dựng được bức tranh schema (collections, fields, relations, kiểu dữ liệu, khóa chính, alias field) từ DB và các bảng directus_collections, directus_fields, directus_relations, giống hệt SchemaOverview của Directus (tham chiếu directus/api/src/utils/get-schema.ts và packages/schema). Schema được cache trong Redis với cùng cache key và namespace như Directus. Khi Directus hoặc app mới đổi schema, instance còn lại nhận tín hiệu qua cùng kênh bus của Directus và xóa cache. Hỗ trợ CACHE_SCHEMA, CACHE_NAMESPACE, CACHE_STORE và các biến cache khác giống Directus. Tiêu chí chấp nhận: thêm field ở Directus thì app mới thấy field đó ngay mà không cần khởi động lại, và ngược lại.
```

### 003: Xác thực và phiên đăng nhập

```text
/speckit.specify Người dùng đăng nhập vào app mới bằng email và mật khẩu đã có trong directus_users, nhận access token và refresh token giống hệt Directus (cùng SECRET, cùng payload JWT, cùng TTL ACCESS_TOKEN_TTL và REFRESH_TOKEN_TTL). Hỗ trợ ba chế độ json, cookie, session như Directus, với cùng tên cookie. Session lưu trong directus_sessions. Token cấp ở Directus dùng được ở app mới và ngược lại. Hỗ trợ: /auth/login, /auth/refresh, /auth/logout, /auth/password/request, /auth/password/reset, static token của user, xác thực hai lớp (TFA, /users/me/tfa/*), kiểm tra trạng thái user (active, suspended, invited), giới hạn đăng nhập sai (LOGIN_STALL_TIME, rate limiter dùng chung Redis). Đăng nhập SSO (OAuth2, OpenID, LDAP, SAML) theo các biến AUTH_* giống Directus. Tham chiếu directus/api/src/auth, services/authentication.ts, controllers/auth.ts. Tiêu chí chấp nhận: bộ test blackbox auth của Directus chạy qua trên app mới, và token dùng chéo được giữa hai bên.
```

### 004: Phân quyền

```text
/speckit.specify App mới áp dụng đúng mô hình phân quyền của Directus 11: users, roles (có cây role lồng nhau), policies, access (gán policy cho role hoặc user), permissions theo collection và action (create, read, update, delete, share) với filter điều kiện, danh sách field, validation, preset, cùng các cờ admin_access, app_access, ip_access, enforce_tfa. Accountability của mỗi request được tính giống Directus, kể cả biến động $CURRENT_USER, $CURRENT_ROLE, $CURRENT_ROLES, $CURRENT_POLICIES, $NOW. Cung cấp các endpoint /users, /roles, /policies, /access, /permissions (gồm /permissions/me và /policies/me/globals), CRUD giống Directus. Kết quả phân quyền được cache dùng chung Redis với Directus. Tham chiếu directus/api/src/permissions và các service users, roles, policies, access, permissions. Tiêu chí chấp nhận: với cùng user và dữ liệu, mọi request đọc và ghi bị chặn hoặc cho phép giống hệt Directus.
```

### 005: Engine truy vấn và CRUD items

```text
/speckit.specify Người dùng thao tác dữ liệu của mọi collection qua /items/:collection giống hệt Directus: đọc danh sách, đọc theo id, tạo, sửa, xóa từng cái hoặc hàng loạt, collection singleton. Hỗ trợ đầy đủ query: fields (gồm wildcard, field quan hệ lồng nhau, $thumbnail), filter (mọi toán tử _eq, _neq, _in, _between, _contains, _icontains, _null, _empty, _some, _none, toán tử geometry, _and, _or), search, sort, limit, offset, page, meta (total_count, filter_count), aggregate, groupBy, deep, alias, backlink, và các hàm ngày giờ (year(), month()...). Ghi dữ liệu xử lý payload giống Directus: special fields (uuid, hash, cast-json, date-created, date-updated, user-created, user-updated, conceal, m2o, o2m, m2m, m2a), validation theo field và permission, ghi lồng quan hệ trong một transaction, sort field. Mỗi thao tác ghi tạo activity và revision giống Directus, và phát cùng tên event như Directus (items.create, items.update...) để flow dùng được. Mỗi thao tác ghi cũng đẩy sự kiện lên kênh bus websocket.event của Directus (cùng format như directus/api/src/websocket/controllers/hooks.ts), để client realtime đang kết nối vào Directus vẫn nhận được thay đổi phát sinh từ app mới. Tham chiếu directus/api/src/services/items.ts, payload.ts, database/run-ast (gồm run-ast/lib/apply-query). Tiêu chí chấp nhận: bộ blackbox test items, query và relational của Directus chạy qua trên app mới với Postgres, MySQL và SQLite.
```

### 006: Quản lý data model

```text
/speckit.specify Admin tạo, sửa, xóa collection, field và relation qua /collections, /fields, /relations giống hệt Directus. App mới tạo và sửa bảng, cột thật trong DB (đúng kiểu dữ liệu từng loại DB), đồng thời ghi metadata vào directus_collections, directus_fields, directus_relations, giống cách Directus làm. Hỗ trợ collection folder, alias field (o2m, m2m, m2a, presentation, group), field geometry, translations, archive và sort field. Hỗ trợ /schema/snapshot, /schema/diff, /schema/apply cùng format với Directus. Sau mỗi thay đổi, cache schema được xóa trên cả hai app. Tham chiếu directus/api/src/services/collections.ts, fields.ts, relations.ts, schema.ts, database/helpers. Tiêu chí chấp nhận: data model tạo ở app mới mở được và dùng bình thường trên Directus, và ngược lại.
```

### 007: Files, folders, assets

```text
/speckit.specify Người dùng tải file lên, quản lý file và thư mục qua /files, /folders, và lấy file qua /assets/:id giống hệt Directus. Hỗ trợ upload multipart, upload resumable qua TUS, import từ URL, metadata ảnh (EXIF, IPTC, kích thước), và các storage location cấu hình bằng STORAGE_* giống Directus (local, S3, GCS, Azure, Cloudinary, Supabase). Asset hỗ trợ transform (width, height, fit, quality, format, withoutEnlargement, key preset, transforms) với cùng cách đặt tên file phát sinh như Directus, để hai app dùng chung file đã sinh. Áp dụng ASSETS_* (giới hạn transform, cache-control) và phân quyền file giống Directus. Tham chiếu directus/api/src/services/files.ts, assets.ts, tus, packages/storage*. Tiêu chí chấp nhận: file tải lên ở app này xem và tải được ở app kia, và URL asset có transform trả về ảnh giống nhau.
```

### 008: Activity, revisions, versions, comments

```text
/speckit.specify App mới ghi và cung cấp lịch sử thay đổi giống hệt Directus: /activity (ai làm gì, lúc nào, IP, user agent), /revisions (dữ liệu trước và sau, delta), khôi phục item về một revision, /versions (content versioning: tạo bản nháp, so sánh, promote về bản chính), /comments trên item. Áp dụng cấu hình ACTIVITY và REVISIONS giống Directus. Tham chiếu directus/api/src/services/activity.ts, revisions.ts, versions.ts, comments.ts. Tiêu chí chấp nhận: lịch sử do app mới ghi hiển thị đúng trong Directus, và version tạo ở bên này promote được ở bên kia.
```

### 009: Flows và tự động hóa

```text
/speckit.specify App mới chạy flows giống hệt Directus. Flow và operation lưu trong directus_flows và directus_operations. Hỗ trợ các trigger: event (hook action và filter trên items và các collection hệ thống, cùng tên event như Directus), schedule (cron), webhook (/flows/trigger/:id, GET/POST, đồng bộ hoặc bất đồng bộ), manual (nút bấm trên item) và another flow. Hỗ trợ mọi operation có sẵn: condition, exec, item-create/read/update/delete, json-web-token, log, mail, notification, request, sleep, transform, trigger flow, throw error. Hỗ trợ dữ liệu $trigger, $last, $accountability, $env và nhánh resolve/reject. Flow theo lịch dùng lock trên Redis, nên khi cả Directus và app mới cùng chạy thì mỗi lượt chỉ một bên thực thi. Khi flow thay đổi ở app này, app kia nạp lại flow qua bus. Log chạy flow ghi vào activity và revisions giống Directus. Tham chiếu directus/api/src/flows.ts, operations, services/flows.ts, operations.ts. Tiêu chí chấp nhận: cùng một flow cho kết quả giống nhau ở hai app, và flow theo lịch không bị chạy hai lần.
```

### 010: Collection hệ thống còn lại

```text
/speckit.specify App mới cung cấp các endpoint hệ thống còn lại giống hệt Directus: /settings (cài đặt dự án, theme, branding), /presets (preset và bookmark của layout), /notifications (gồm gửi email thông báo), /shares (chia sẻ item bằng link, mật khẩu, thời hạn, số lần xem, đăng nhập bằng share), /translations (chuỗi dịch tùy chỉnh), /dashboards và /panels (insights), /extensions (chỉ trả danh sách rỗng hoặc tối thiểu, vì chưa hỗ trợ extension), /utils (hash/generate, hash/verify, random/string, sort, revert, cache/clear, import, export với CSV, JSON, XML, YAML), và gửi mail theo EMAIL_* giống Directus. Tham chiếu các service tương ứng trong directus/api/src/services. Tiêu chí chấp nhận: blackbox test của các endpoint này chạy qua trên app mới.
```

### 011: GraphQL

```text
/speckit.specify App mới cung cấp /graphql (dữ liệu người dùng) và /graphql/system (dữ liệu hệ thống), có schema sinh động từ data model và phân quyền của từng user, giống hệt Directus: query, mutation, aggregate, quan hệ lồng nhau, filter, đặt tên type và field giống nhau. Không làm subscription. Tham chiếu directus/api/src/services/graphql. Tiêu chí chấp nhận: introspection schema của app mới khớp với Directus cho cùng user, và các blackbox test GraphQL chạy qua.
```

### 012: Khung app web và đăng nhập

```text
/speckit.specify Xây app web quản trị mới thay cho Directus app, giữ nguyên luồng sử dụng. Người dùng đăng nhập bằng email và mật khẩu, TFA hoặc SSO, rồi được giữ phiên bằng refresh token. Đăng xuất, quên mật khẩu, nhận lời mời, cập nhật hồ sơ, theme sáng/tối và đa ngôn ngữ (dùng chuỗi dịch của Directus). Bố cục gồm thanh module bên trái, thanh điều hướng, vùng nội dung và sidebar bên phải như Directus. Các route giống Directus (/admin/content, /admin/files, /admin/users, /admin/insights, /admin/activity, /admin/settings). App chỉ gọi API theo đúng chuẩn Directus, nên chạy được với cả Directus thật lẫn API mới chỉ bằng cách đổi URL. Tham chiếu directus/app/src (router, auth, stores, views). Tiêu chí chấp nhận: đăng nhập vào Directus thật và vào API mới đều chạy, điều hướng giữa các module giống Directus.
```

### 013: Bộ interfaces và displays

```text
/speckit.specify App web cần bộ interface (ô nhập dữ liệu) và display (cách hiển thị giá trị) tương đương Directus, để form và bảng hiển thị đúng theo cấu hình field trong directus_fields (interface, options, display, display_options). Interfaces: input, textarea, code, rich text HTML, markdown, block editor, hash, boolean, datetime, slider, select (dropdown, radio, checkbox, multi, icon, color, tree), tags, file, image, files, map, list (repeater), quan hệ m2o, o2m, m2m, m2a, tree view, translations, nhóm field (accordion, detail, raw, tabs), presentation (divider, header, links, notice), autocomplete từ API. Displays tương ứng. Đọc đúng options đã lưu bởi Directus, để field cấu hình ở Directus hiển thị đúng ở app mới. Tham chiếu directus/app/src/interfaces và displays. Tiêu chí chấp nhận: mọi interface và display có sẵn trong Directus đều có bản tương ứng, và đọc được cấu hình hiện có.
```

### 014: Module Content

```text
/speckit.specify Người dùng duyệt và chỉnh sửa dữ liệu trong module Content giống Directus: danh sách collection theo nhóm và folder, xem item với các layout table, cards, calendar, map, kanban, tìm kiếm, lọc, sắp xếp, chọn cột, lưu bookmark và preset, xuất và nhập dữ liệu, thao tác hàng loạt. Trang chi tiết item có form theo cấu hình field, điều kiện ẩn hiện field, validation, lưu và lưu tiếp, xóa, archive, sidebar revisions, comments, versions và chia sẻ. Hỗ trợ collection singleton. Chỉ hiện những gì user có quyền. Tham chiếu directus/app/src/modules/content và layouts. Tiêu chí chấp nhận: các luồng chính của module Content trên Directus làm được tương tự trên app mới.
```

### 015: Module Files và Users

```text
/speckit.specify Module Files: thư viện file theo thư mục, tải lên (kéo thả, nhiều file, từ URL), xem trước, sửa metadata, chỉnh sửa ảnh (cắt, xoay), di chuyển và xóa, lọc và tìm kiếm. Module Users: danh sách user theo role, tạo và mời user, sửa hồ sơ, đổi role và policy, khóa user, tạo static token, bật tắt TFA. Luồng và quyền giống Directus. Tham chiếu directus/app/src/modules/files và users. Tiêu chí chấp nhận: các luồng chính của hai module chạy giống Directus.
```

### 016: Module Settings

```text
/speckit.specify Module Settings cho admin, giống Directus: data model (tạo và sửa collection, field, relation, sắp xếp và nhóm field, cấu hình interface và display, điều kiện, validation), roles và policies (gán quyền theo collection, action, field, điều kiện lọc), cài đặt dự án (tên, logo, màu, theme, ngôn ngữ, bản đồ, giới hạn file), presets và bookmarks, translations, thông tin hệ thống. Tham chiếu directus/app/src/modules/settings. Tiêu chí chấp nhận: data model và quyền tạo trên app mới dùng được ngay trên Directus.
```

### 017: Trình chỉnh sửa Flows

```text
/speckit.specify Admin tạo và chỉnh sửa flow bằng giao diện kéo thả như Directus: chọn trigger, thêm operation, nối nhánh resolve và reject, cấu hình từng operation, bật tắt flow, xem log các lần chạy. Nút chạy flow thủ công hiện trên trang item hoặc danh sách item. Tham chiếu directus/app/src/modules/settings/routes/flows và directus/app/src/operations. Tiêu chí chấp nhận: flow tạo ở app mới mở và sửa được trên Directus, và ngược lại.
```

### 018: Insights, Activity, Notifications

```text
/speckit.specify Module Insights: tạo dashboard, thêm và sắp xếp panel (metric, metric list, meter, time series, line chart, bar chart, pie chart, list, label, variable, relational variable), lọc theo biến dashboard. Module Activity: xem nhật ký hoạt động, lọc theo user, collection, hành động. Notifications: chuông thông báo, đánh dấu đã đọc, mở item liên quan. Luồng giống Directus. Tham chiếu directus/app/src/modules/insights, activity, directus/app/src/panels. Tiêu chí chấp nhận: dashboard tạo ở Directus hiển thị đúng trên app mới.
```

### 019: Đóng gói và triển khai đa instance

```text
/speckit.specify Đóng gói app mới để triển khai: FE chạy 1 container, BE chạy nhiều container sau load balancer, cùng DB và Redis với Directus. FE: image nginx phục vụ file tĩnh ở /admin, đọc URL API và cấu hình từ biến môi trường lúc container khởi động, fallback về index.html cho route của SPA. BE: image chạy được với số replica tùy ý, không cần sticky session, có readiness và liveness probe qua /server/health, tắt máy an toàn khi nhận SIGTERM (ngừng nhận request, chạy nốt request đang dở, đóng kết nối DB và Redis). Định tuyến chung một domain: /admin/* vào FE, các path còn lại vào BE. Cung cấp docker-compose cho máy dev (Directus 11.17.4, BE 2 replica, FE, Postgres, Redis, MinIO làm S3) và manifest Kubernetes hoặc Helm chart cho môi trường thật (Deployment, Service, Ingress, HPA cho BE, ConfigMap và Secret dùng cùng tên biến như Directus). Tiêu chí chấp nhận: với BE 3 replica cộng 1 Directus, các bài test sau đều đạt: đăng nhập rồi gọi API lần lượt vào từng replica; sửa schema ở một replica thì replica khác thấy ngay; flow theo lịch chỉ chạy một lần mỗi lượt; upload TUS nhiều chunk qua các replica khác nhau vẫn thành công; tắt một replica khi đang tải không làm lỗi request.
```

---

## 7. Prompt `/speckit.plan`

Dùng phần chung dưới đây cho mọi feature, rồi thêm 1–2 câu riêng cho feature đó.

**BE (001–011):**
```text
/speckit.plan Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. <thêm phần riêng của feature>
```

**FE (012–018):**
```text
/speckit.plan Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, PrimeVue (theme tùy chỉnh gần giao diện Directus), vue-i18n dùng file dịch copy từ directus/app/src/lang, gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng PrimeVue. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. <thêm phần riêng của feature>
```

---

## 8. Mẹo khi chạy

- **Chạy `/speckit.clarify` cho feature 003, 004, 005, 009.** Đây là những phần dễ hiểu sai nhất.
- **Chạy `/speckit.analyze` trước `/speckit.implement`** để bắt lỗi spec, plan, tasks không khớp nhau.
- **Feature lớn (005, 013, 014) nên tách nhỏ hơn** nếu tasks.md quá dài (trên khoảng 60 task). Ví dụ 005 tách thành "đọc và query" và "ghi và payload".
- **Theo dõi tiến độ:** `/speckit.status` cho biết feature hiện tại đang ở bước nào.
- **Mỗi feature làm xong** thì chạy test đối chiếu, rồi merge branch trước khi sang feature sau.

---

## 9. Rủi ro cần lưu ý

| Rủi ro | Ghi chú |
|---|---|
| **License BSL 1.1** | Directus chỉ được dùng production miễn phí khi tổng doanh thu, ngân sách hoặc vốn dưới 5 triệu USD/năm (tính cả công ty liên kết). Copy code sang app mới vẫn chịu license này. Cần pháp chế duyệt hoặc mua license trước khi chạy production. |
| Lệch phiên bản | Khi nâng Directus lên bản mới, app mới phải cập nhật theo, vì DB dùng chung. Khóa Directus ở 11.17.4 cho đến khi app mới hỗ trợ bản tiếp theo. |
| Cache và bus | Sai một cache key hay tên kênh là hai app hiển thị dữ liệu cũ. Feature 002 phải test kỹ hai chiều. |
| Realtime trên Directus | App mới không có WebSocket. Nếu Directus vẫn bật `WEBSOCKETS_ENABLED=true`, người dùng Directus app vẫn có collaborative editing, nhưng không thấy người đang sửa cùng item bằng app mới. Muốn hai bên giống nhau thì tắt WebSocket trên Directus. |
| Storage local | Nếu một môi trường vẫn để `STORAGE_LOCAL_*` trỏ vào ổ riêng của container, file tải lên ở replica này sẽ không thấy ở replica khác. Kiểm tra cấu hình storage trước khi tăng số replica. |
| Khối lượng | Có khoảng 737 file TS ở BE và 551 file Vue ở FE. Ước lượng theo từng feature sau bước `/speckit.tasks`. |
