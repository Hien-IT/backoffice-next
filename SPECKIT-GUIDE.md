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
| FE | **Viết mới** bằng Vue 3 + **Reka UI** (cùng thư viện Directus app dùng), giữ nguyên luồng màn hình của Directus. |
| Extensions | **Chưa làm** trong giai đoạn này. |
| Biến môi trường | **Kế thừa toàn bộ** biến của Directus: cùng tên, cùng mặc định, cùng cách ép kiểu. Dùng lại nguyên file `.env`, ConfigMap, Secret của Directus khi deploy. |
| Ngôn ngữ | spec, plan, tasks viết **tiếng Việt**. Tên biến, comment, commit message viết **tiếng Anh**. |
| Runtime | **Node 22 + pnpm 10**, giống Directus. |
| CI | **GitHub Actions**. Coverage tối thiểu **80% BE, 60% FE**. |
| DB chính | **PostgreSQL**: chạy đủ test ở mọi PR. MySQL, SQLite chạy bộ rút gọn. MSSQL, Oracle, CockroachDB chạy hằng đêm. |
| Hiệu năng | p95 latency và throughput **không tệ hơn Directus quá 10%**. |
| Ngôn ngữ giao diện | **vi-VN và en-US**. |
| Giám sát | **Log JSON** giống Directus và **metrics Prometheus** (`/metrics`). |
| SSO | Chỉ **OpenID Connect**. LDAP, OAuth2, SAML chưa làm. |
| Storage | **S3/MinIO** và **Local**. Azure, GCS, Cloudinary, Supabase chưa làm. |
| Email | **Không gửi email.** Luồng cần email vẫn chạy như Directus, phần gửi mail bị bỏ qua và ghi log cảnh báo. |
| Flow Run Script | **Có**, chạy trong sandbox isolated-vm giống Directus. |
| Layouts | Table, Cards, Calendar, Kanban, Map: đủ cả 5. |
| Quy mô | **Lớn**: 200–2.000 user đồng thời, collection lớn nhất khoảng 10 triệu bản ghi. |
| Thiết bị | **Desktop và tablet** (từ 768px), Chrome, Edge, Firefox, Safari bản mới. |
| Thương hiệu | Chữ "Directus" trong app mới đổi thành **"Backoffice"**, trừ những chỗ ảnh hưởng luồng hoặc tương thích (bảng `directus_*`, JWT issuer, cookie, namespace Redis, tên biến môi trường...). |
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
| `/speckit.plan` | Viết plan kỹ thuật: **làm thế nào** | Đây là chỗ ghi NestJS, Knex, Reka UI, file Directus cần tham chiếu. |
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
- PostgreSQL là DB chính: mọi PR chạy đủ test đối chiếu trên Postgres. MySQL và SQLite chạy bộ test rút gọn ở mọi PR. MSSQL, Oracle, CockroachDB chạy đủ test hằng đêm.

VI. Kiến trúc
- Node 22 và pnpm 10 (giống Directus). Nx monorepo: apps/api (NestJS), apps/web (Vue 3 + Reka UI + Pinia + Vue Router), libs dùng chung (types, filter, validation, utils).
- BE: mỗi service của Directus tương ứng một provider NestJS. Controller mỏng, logic nằm trong service. Truy cập DB bằng Knex, không dùng ORM.
- FE: viết mới bằng Composition API, giữ nguyên luồng màn hình, route và hành vi của Directus app. Được copy logic hoặc composable từ directus/app khi cần.
- FE hỗ trợ desktop và tablet (màn hình từ 768px) trên Chrome, Edge, Firefox, Safari bản mới.
- FE hỗ trợ hai ngôn ngữ giao diện vi-VN và en-US, copy từ directus/app/src/lang. Kiến trúc i18n vẫn cho phép thêm ngôn ngữ sau.
- TypeScript strict, ESLint, Prettier. Mỗi thay đổi có test.

VII. Triển khai đa instance
- FE build ra file tĩnh, chạy trong một container nginx. URL API và cấu hình được đọc lúc chạy (runtime config), không ghi cứng lúc build, để một image dùng cho mọi môi trường.
- BE chạy được nhiều container cùng lúc sau load balancer, cùng với các instance Directus, tất cả ngang hàng trên cùng DB và Redis. Không cần sticky session.
- Khi chạy nhiều instance, Redis là bắt buộc cho cache, bus, rate limiter, lock flow theo lịch và lock upload TUS. Không dùng cache hay lock trong bộ nhớ process.
- File và ảnh đã transform lưu trên storage dùng chung (S3, GCS, Azure hoặc volume dùng chung). Không dùng storage local riêng từng container.
- Khởi động nhiều replica cùng lúc phải an toàn: chỉ đọc và kiểm tra migration, không ghi gì vào bảng hệ thống khi khởi động.
- Có /server/health cho readiness và liveness probe. Khi nhận SIGTERM, ngừng nhận request mới, chạy nốt request đang dở, đóng kết nối DB và Redis rồi mới thoát.
- FE và BE nên đặt chung một domain: /admin/* vào FE, các path API còn lại vào BE, giống bố cục của Directus.

VIII. Kế thừa toàn bộ biến môi trường của Directus
- BE đọc toàn bộ biến môi trường Directus 11.17.4 hỗ trợ (danh sách và giá trị mặc định trong directus/packages/env/src/constants/defaults.ts và directus-variables.ts), kể cả biến động như DB_*, STORAGE_<LOCATION>_*, AUTH_<PROVIDER>_*, EMAIL_*, CACHE_*, REDIS_*.
- Giữ nguyên tên biến, giá trị mặc định và cách đọc: tiền tố ép kiểu (string:, number:, regex:, array:, json:, boolean:), hậu tố _FILE để đọc secret từ file, CONFIG_PATH với file .env, .json, .yaml, .js.
- Không đổi tên biến khi đổi thương hiệu, không tạo biến mới thay thế biến đã có. Biến chỉ app mới cần thì dùng tiền tố BACKOFFICE_ và phải có giá trị mặc định an toàn.
- Biến Directus mà app mới chưa hỗ trợ: ghi cảnh báo khi khởi động, không dừng app.
- Khi deploy, cùng một file .env, ConfigMap, Secret đang dùng cho Directus phải chạy được ngay cho BE mới mà không cần khai báo lại. FE nhận cấu hình lúc chạy từ chính các biến này (ví dụ PUBLIC_URL).

IX. Đổi thương hiệu Directus thành Backoffice
- Trong app mới, chữ "Directus" mà người dùng hoặc lập trình viên nhìn thấy được đổi thành "Backoffice", miễn là không ảnh hưởng luồng hoạt động hay khả năng chạy song song.
- Được đổi: tên hiển thị, tiêu đề trang, logo, favicon, chuỗi dịch i18n, email template, tên mặc định khi project_name trống (ví dụ nhãn issuer TFA), header X-Powered-By, tiêu đề tài liệu OpenAPI, log message, tên package nội bộ (@directus/* copy sang thành @backoffice/*), tên class, biến, comment trong code mới, key localStorage của FE.
- Giữ nguyên vì ảnh hưởng luồng hoặc tương thích: tên bảng và cột directus_*, tên collection hệ thống trong API (directus_users...), JWT issuer 'directus', tên cookie mặc định (directus_refresh_token, directus_session_token), namespace Redis mặc định (directus:bus, directus:lock, system-cache), giá trị mặc định METRICS_NAME_PREFIX 'directus_' (để dashboard giám sát dùng chung cho cả hai app), tên biến môi trường, tên event, mã lỗi, tên type GraphQL, thư viện bên thứ ba (@directus/sdk), dữ liệu trong DB (không sửa project_name hay settings đang dùng chung).

- Khi không chắc một chỗ đổi tên có ảnh hưởng luồng hay không: giữ nguyên và ghi vào danh sách cần xác nhận.
- Test đối chiếu được bỏ qua các khác biệt do đổi thương hiệu, nhưng phải liệt kê rõ trong danh sách khác biệt được chấp nhận.

X. Chất lượng, quy trình và vận hành
- Ngôn ngữ: spec.md, plan.md, tasks.md và tài liệu viết tiếng Việt. Tên biến, comment, commit message và PR viết tiếng Anh. Commit theo Conventional Commits.
- CI trên GitHub Actions. Mỗi PR phải pass: lint, typecheck, unit test, test đối chiếu với Directus, E2E (với FE), build Docker image.
- Coverage tối thiểu: 80% cho apps/api và libs BE, 60% cho apps/web. Dưới ngưỡng thì không merge.
- Bảo mật trong CI: quét dependency (pnpm audit, Dependabot), quét secret (gitleaks), phân tích mã (CodeQL). Không commit secret.
- Hiệu năng: với cùng request và dữ liệu, p95 latency và throughput của BE mới không tệ hơn Directus quá 10%. Đo bằng benchmark tự động (autocannon, giống directus/tests/blackbox) cho các endpoint chính: items, auth, files, assets.
- Quy mô thiết kế: tới 2.000 user đồng thời, collection lớn nhất khoảng 10 triệu bản ghi. Benchmark và test hiệu năng dùng dữ liệu ở quy mô này.
- Giám sát: log JSON bằng pino, cùng biến LOG_LEVEL, LOG_STYLE như Directus, mỗi request có request id. Endpoint /metrics định dạng Prometheus, cùng biến METRICS_* và cùng tên metric như Directus.
- Không gửi email: mọi chỗ Directus gửi mail (quên mật khẩu, mời user, operation Send Email, email thông báo) vẫn chạy đúng luồng và trả về như Directus, chỉ bỏ qua bước gửi và ghi log cảnh báo.
- Mọi khác biệt so với Directus phải ghi trong spec, nêu lý do, và được tech lead duyệt trong PR.

XI. Ngoài phạm vi giai đoạn này
- SSO bằng LDAP, OAuth2, SAML (chỉ làm OpenID Connect). Storage Azure, GCS, Cloudinary, Supabase (chỉ làm Local và S3/tương thích S3). Gửi email.
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
/speckit.specify Nền tảng cho app mới clone Directus 11.17.4. Cần có monorepo chứa app API, app web và các thư viện dùng chung. API đọc toàn bộ biến môi trường của Directus với cùng tên, cùng giá trị mặc định, cùng tiền tố ép kiểu (string:, number:, regex:, array:, json:, boolean:), hậu tố _FILE và CONFIG_PATH (file .env, .json, .yaml, .js), biến chưa hỗ trợ thì chỉ cảnh báo (tham chiếu directus/packages/env). Một file .env đang chạy được cho Directus phải chạy được ngay cho API mới. kết nối được tới mọi loại DB mà Directus hỗ trợ (Postgres, MySQL/MariaDB, SQLite, MSSQL, Oracle, CockroachDB) và tới Redis. Khi khởi động, API đọc bảng directus_migrations và so với danh sách migration của Directus 11.17.4. Nếu thiếu hoặc thừa migration, API dừng và báo rõ migration nào lệch. API không bao giờ tạo hay sửa bảng directus_*. Có các endpoint /server/ping, /server/health, /server/info, /server/specs/oas trả về giống Directus. Lỗi trả về đúng format errors[] và mã lỗi của Directus (tham chiếu packages/errors). Log JSON giống Directus (LOG_LEVEL, LOG_STYLE, có request id) và endpoint /metrics Prometheus theo METRICS_*. Có bộ test đối chiếu: cùng request gửi tới Directus thật và app mới, rồi so sánh kết quả. Có pipeline GitHub Actions chạy lint, typecheck, unit test kèm ngưỡng coverage, test đối chiếu (Postgres đủ, MySQL và SQLite rút gọn), quét bảo mật và benchmark so với Directus. Tên hiển thị, log, header X-Powered-By và package nội bộ dùng tên Backoffice. Tiêu chí chấp nhận: chạy app mới bằng đúng file .env của Directus, cạnh Directus trên cùng DB và Redis; các endpoint /server/* trả về giống nhau, ngoại trừ các khác biệt do đổi thương hiệu đã liệt kê; DB không bị thay đổi.
```

### 002: Schema overview và cache dùng chung

```text
/speckit.specify API cần dựng được bức tranh schema (collections, fields, relations, kiểu dữ liệu, khóa chính, alias field) từ DB và các bảng directus_collections, directus_fields, directus_relations, giống hệt SchemaOverview của Directus (tham chiếu directus/api/src/utils/get-schema.ts và packages/schema). Schema được cache trong Redis với cùng cache key và namespace như Directus. Khi Directus hoặc app mới đổi schema, instance còn lại nhận tín hiệu qua cùng kênh bus của Directus và xóa cache. Hỗ trợ CACHE_SCHEMA, CACHE_NAMESPACE, CACHE_STORE và các biến cache khác giống Directus. Tiêu chí chấp nhận: thêm field ở Directus thì app mới thấy field đó ngay mà không cần khởi động lại, và ngược lại.
```

### 003: Xác thực và phiên đăng nhập

```text
/speckit.specify Người dùng đăng nhập vào app mới bằng email và mật khẩu đã có trong directus_users, nhận access token và refresh token giống hệt Directus (cùng SECRET, cùng payload JWT, cùng TTL ACCESS_TOKEN_TTL và REFRESH_TOKEN_TTL). Hỗ trợ ba chế độ json, cookie, session như Directus, với cùng tên cookie. Session lưu trong directus_sessions. Token cấp ở Directus dùng được ở app mới và ngược lại. Hỗ trợ: /auth/login, /auth/refresh, /auth/logout, /auth/password/request, /auth/password/reset, static token của user, xác thực hai lớp (TFA, /users/me/tfa/*), kiểm tra trạng thái user (active, suspended, invited), giới hạn đăng nhập sai (LOGIN_STALL_TIME, rate limiter dùng chung Redis). Đăng nhập SSO chỉ hỗ trợ OpenID Connect (Azure AD/Entra ID, Keycloak...) theo các biến AUTH_* giống Directus. Provider cấu hình driver ldap, oauth2 hoặc saml thì bị bỏ qua và ghi cảnh báo khi khởi động. /auth/password/request trả về giống Directus nhưng không gửi email, chỉ ghi log. Tham chiếu directus/api/src/auth, services/authentication.ts, controllers/auth.ts. Tiêu chí chấp nhận: bộ test blackbox auth của Directus chạy qua trên app mới, và token dùng chéo được giữa hai bên.
```

### 004: Phân quyền

```text
/speckit.specify App mới áp dụng đúng mô hình phân quyền của Directus 11: users, roles (có cây role lồng nhau), policies, access (gán policy cho role hoặc user), permissions theo collection và action (create, read, update, delete, share) với filter điều kiện, danh sách field, validation, preset, cùng các cờ admin_access, app_access, ip_access, enforce_tfa. Accountability của mỗi request được tính giống Directus, kể cả biến động $CURRENT_USER, $CURRENT_ROLE, $CURRENT_ROLES, $CURRENT_POLICIES, $NOW. Cung cấp các endpoint /users, /roles, /policies, /access, /permissions (gồm /permissions/me và /policies/me/globals), CRUD giống Directus. /users/invite tạo user trạng thái invited giống Directus nhưng không gửi email, chỉ ghi log. Kết quả phân quyền được cache dùng chung Redis với Directus. Tham chiếu directus/api/src/permissions và các service users, roles, policies, access, permissions. Tiêu chí chấp nhận: với cùng user và dữ liệu, mọi request đọc và ghi bị chặn hoặc cho phép giống hệt Directus.
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
/speckit.specify Người dùng tải file lên, quản lý file và thư mục qua /files, /folders, và lấy file qua /assets/:id giống hệt Directus. Hỗ trợ upload multipart, upload resumable qua TUS, import từ URL, metadata ảnh (EXIF, IPTC, kích thước), và các storage location cấu hình bằng STORAGE_* giống Directus. Chỉ hỗ trợ driver local và s3 (gồm dịch vụ tương thích S3 như MinIO). Nếu cấu hình driver khác (gcs, azure, cloudinary, supabase) thì dừng khi khởi động và báo rõ location nào không hỗ trợ. Asset hỗ trợ transform (width, height, fit, quality, format, withoutEnlargement, key preset, transforms) với cùng cách đặt tên file phát sinh như Directus, để hai app dùng chung file đã sinh. Áp dụng ASSETS_* (giới hạn transform, cache-control) và phân quyền file giống Directus. Tham chiếu directus/api/src/services/files.ts, assets.ts, tus, packages/storage*. Tiêu chí chấp nhận: file tải lên ở app này xem và tải được ở app kia, và URL asset có transform trả về ảnh giống nhau.
```

### 008: Activity, revisions, versions, comments

```text
/speckit.specify App mới ghi và cung cấp lịch sử thay đổi giống hệt Directus: /activity (ai làm gì, lúc nào, IP, user agent), /revisions (dữ liệu trước và sau, delta), khôi phục item về một revision, /versions (content versioning: tạo bản nháp, so sánh, promote về bản chính), /comments trên item. Áp dụng cấu hình ACTIVITY và REVISIONS giống Directus. Tham chiếu directus/api/src/services/activity.ts, revisions.ts, versions.ts, comments.ts. Tiêu chí chấp nhận: lịch sử do app mới ghi hiển thị đúng trong Directus, và version tạo ở bên này promote được ở bên kia.
```

### 009: Flows và tự động hóa

```text
/speckit.specify App mới chạy flows giống hệt Directus. Flow và operation lưu trong directus_flows và directus_operations. Hỗ trợ các trigger: event (hook action và filter trên items và các collection hệ thống, cùng tên event như Directus), schedule (cron), webhook (/flows/trigger/:id, GET/POST, đồng bộ hoặc bất đồng bộ), manual (nút bấm trên item) và another flow. Hỗ trợ mọi operation có sẵn: condition, exec, item-create/read/update/delete, json-web-token, log, mail, notification, request, sleep, transform, trigger flow, throw error. Operation exec (Run Script) chạy JavaScript trong sandbox isolated-vm với giới hạn FLOWS_RUN_SCRIPT_MAX_MEMORY và FLOWS_RUN_SCRIPT_TIMEOUT giống Directus. Operation mail không gửi email, chỉ ghi log và trả kết quả thành công như khi gửi xong. Hỗ trợ dữ liệu $trigger, $last, $accountability, $env và nhánh resolve/reject. Flow theo lịch dùng lock trên Redis, nên khi cả Directus và app mới cùng chạy thì mỗi lượt chỉ một bên thực thi. Khi flow thay đổi ở app này, app kia nạp lại flow qua bus. Log chạy flow ghi vào activity và revisions giống Directus. Tham chiếu directus/api/src/flows.ts, operations, services/flows.ts, operations.ts. Tiêu chí chấp nhận: cùng một flow cho kết quả giống nhau ở hai app, và flow theo lịch không bị chạy hai lần.
```

### 010: Collection hệ thống còn lại

```text
/speckit.specify App mới cung cấp các endpoint hệ thống còn lại giống hệt Directus: /settings (cài đặt dự án, theme, branding), /presets (preset và bookmark của layout), /notifications (lưu và hiển thị trong app, không gửi email), /shares (chia sẻ item bằng link, mật khẩu, thời hạn, số lần xem, đăng nhập bằng share), /translations (chuỗi dịch tùy chỉnh), /dashboards và /panels (insights), /extensions (chỉ trả danh sách rỗng hoặc tối thiểu, vì chưa hỗ trợ extension), /utils (hash/generate, hash/verify, random/string, sort, revert, cache/clear, import, export với CSV, JSON, XML, YAML), Không gửi email: mọi chỗ Directus gửi mail thì bỏ qua bước gửi và ghi log cảnh báo, phần còn lại của luồng chạy như cũ. Tham chiếu các service tương ứng trong directus/api/src/services. Tiêu chí chấp nhận: blackbox test của các endpoint này chạy qua trên app mới.
```

### 011: GraphQL

```text
/speckit.specify App mới cung cấp /graphql (dữ liệu người dùng) và /graphql/system (dữ liệu hệ thống), có schema sinh động từ data model và phân quyền của từng user, giống hệt Directus: query, mutation, aggregate, quan hệ lồng nhau, filter, đặt tên type và field giống nhau. Không làm subscription. Tham chiếu directus/api/src/services/graphql. Tiêu chí chấp nhận: introspection schema của app mới khớp với Directus cho cùng user, và các blackbox test GraphQL chạy qua.
```

### 012: Khung app web và đăng nhập

```text
/speckit.specify Xây app web quản trị mới mang tên Backoffice thay cho Directus app, giữ nguyên luồng sử dụng. Mọi chữ Directus mà người dùng thấy (tiêu đề, logo, favicon, trang đăng nhập, chuỗi dịch, tên mặc định khi project_name trống) đổi thành Backoffice. Nếu settings trong DB đã có tên dự án, logo hoặc màu riêng thì dùng các giá trị đó, giống Directus. Người dùng đăng nhập bằng email và mật khẩu, TFA hoặc SSO OpenID Connect, rồi được giữ phiên bằng refresh token. Đăng xuất, quên mật khẩu, nhận lời mời (giữ màn hình như Directus; vì hệ thống không gửi email nên hiện thêm hướng dẫn liên hệ admin), cập nhật hồ sơ, theme sáng/tối, ngôn ngữ vi-VN và en-US (dùng chuỗi dịch của Directus). Bố cục gồm thanh module bên trái, thanh điều hướng, vùng nội dung và sidebar bên phải như Directus. Các route giống Directus (/admin/content, /admin/files, /admin/users, /admin/insights, /admin/activity, /admin/settings). App chỉ gọi API theo đúng chuẩn Directus, nên chạy được với cả Directus thật lẫn API mới chỉ bằng cách đổi URL. Hỗ trợ desktop và tablet từ 768px trên Chrome, Edge, Firefox, Safari bản mới. Tham chiếu directus/app/src (router, auth, stores, views). Tiêu chí chấp nhận: đăng nhập vào Directus thật và vào API mới đều chạy, điều hướng giữa các module giống Directus.
```

### 013: Bộ interfaces và displays

```text
/speckit.specify App web cần bộ interface (ô nhập dữ liệu) và display (cách hiển thị giá trị) tương đương Directus, để form và bảng hiển thị đúng theo cấu hình field trong directus_fields (interface, options, display, display_options). Interfaces: input, textarea, code, rich text HTML, markdown, block editor, hash, boolean, datetime, slider, select (dropdown, radio, checkbox, multi, icon, color, tree), tags, file, image, files, map, list (repeater), quan hệ m2o, o2m, m2m, m2a, tree view, translations, nhóm field (accordion, detail, raw, tabs), presentation (divider, header, links, notice), autocomplete từ API. Displays tương ứng. Đọc đúng options đã lưu bởi Directus, để field cấu hình ở Directus hiển thị đúng ở app mới. Tham chiếu directus/app/src/interfaces và displays. Tiêu chí chấp nhận: mọi interface và display có sẵn trong Directus đều có bản tương ứng, và đọc được cấu hình hiện có.
```

### 014: Module Content

```text
/speckit.specify Người dùng duyệt và chỉnh sửa dữ liệu trong module Content giống Directus: danh sách collection theo nhóm và folder, xem item với các layout table, cards, calendar, kanban và map (nguồn tile bản đồ cấu hình được như Directus: Mapbox key hoặc tile server riêng), tìm kiếm, lọc, sắp xếp, chọn cột, lưu bookmark và preset, xuất và nhập dữ liệu, thao tác hàng loạt. Trang chi tiết item có form theo cấu hình field, điều kiện ẩn hiện field, validation, lưu và lưu tiếp, xóa, archive, sidebar revisions, comments, versions và chia sẻ. Hỗ trợ collection singleton. Chỉ hiện những gì user có quyền. Danh sách phải mượt với collection khoảng 10 triệu bản ghi (phân trang và đếm phía server). Tham chiếu directus/app/src/modules/content và layouts. Tiêu chí chấp nhận: các luồng chính của module Content trên Directus làm được tương tự trên app mới.
```

### 015: Module Files và Users

```text
/speckit.specify Module Files: thư viện file theo thư mục, tải lên (kéo thả, nhiều file, từ URL), xem trước, sửa metadata, chỉnh sửa ảnh (cắt, xoay), di chuyển và xóa, lọc và tìm kiếm. Module Users: danh sách user theo role, tạo user, mời user (không gửi email), sửa hồ sơ, đổi role và policy, khóa user, tạo static token, bật tắt TFA. Luồng và quyền giống Directus. Tham chiếu directus/app/src/modules/files và users. Tiêu chí chấp nhận: các luồng chính của hai module chạy giống Directus.
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
/speckit.specify Đóng gói app mới để triển khai: FE chạy 1 container, BE chạy nhiều container sau load balancer, cùng DB và Redis với Directus. FE: image nginx phục vụ file tĩnh ở /admin, đọc URL API và cấu hình từ biến môi trường lúc container khởi động, fallback về index.html cho route của SPA. BE: image chạy được với số replica tùy ý, không cần sticky session, có readiness và liveness probe qua /server/health, tắt máy an toàn khi nhận SIGTERM (ngừng nhận request, chạy nốt request đang dở, đóng kết nối DB và Redis). Định tuyến chung một domain: /admin/* vào FE, các path còn lại vào BE. Cung cấp docker-compose cho máy dev (Directus 11.17.4, BE 2 replica, FE, Postgres, Redis, MinIO làm S3) và manifest Kubernetes hoặc Helm chart cho môi trường thật (Deployment, Service, Ingress, HPA cho BE, dùng lại nguyên ConfigMap và Secret đang cấp cho Directus, không khai báo lại biến). Thay một instance Directus bằng BE mới chỉ cần đổi image, giữ nguyên toàn bộ biến môi trường. Tiêu chí chấp nhận: với BE 3 replica cộng 1 Directus, các bài test sau đều đạt: đăng nhập rồi gọi API lần lượt vào từng replica; sửa schema ở một replica thì replica khác thấy ngay; flow theo lịch chỉ chạy một lần mỗi lượt; upload TUS nhiều chunk qua các replica khác nhau vẫn thành công; tắt một replica khi đang tải không làm lỗi request.
```

---

## 7. Prompt `/speckit.plan`

Dùng phần chung dưới đây cho mọi feature, rồi thêm 1–2 câu riêng cho feature đó.

**BE (001–011):**
```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. <thêm phần riêng của feature>
```

**FE (012–018):**
```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style riêng của Backoffice; màu và theme qua CSS variable để áp project_color, theme sáng/tối trong settings), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. <thêm phần riêng của feature>
```

---

## 8. Chọn model cho từng bước

Đổi model trong Claude Code bằng `/model opus`, `/model sonnet`, `/model haiku`. Đổi mức suy nghĩ bằng `/effort`.

**Các model dùng trong dự án** (giá API theo 1 triệu token, tham khảo để so sánh chi phí):

| Model | Đặc điểm | Context | Giá vào / ra |
|---|---|---|---|
| **Opus 5.5** | Mạnh nhất trong các model dùng được, model mặc định. Tăng `/effort` khi việc khó. | 1M | $4 / $20 |
| **Sonnet 5.5** | Nhanh, đủ tốt cho code thường ngày. | 1M | $2 / $10 |
| **Haiku 4.5** | Rẻ và nhanh nhất, cho việc đơn giản. | 200K | $1 / $5 |

Fable 5.1 không dùng được với tài khoản hiện tại. Thay vào đó, dùng Opus 5.5 với effort cao (`xhigh` hoặc `max`) cho các bước khó.

**Nguyên tắc:** lỗi ở bước đầu (spec, plan) lan sang mọi bước sau, nên đầu tư effort cao ở đầu quy trình. Bước làm theo khuôn có sẵn thì dùng model rẻ hơn.

**Feature lõi** là những feature khó giữ tương thích với Directus nhất: **002, 003, 004, 005, 006, 009, 011** (BE) và **013, 014** (FE).

| Bước | Feature lõi | Feature còn lại | Lý do |
|---|---|---|---|
| `/speckit.constitution` | Opus 5.5, effort high | – | Chạy một lần. Prompt đã viết sẵn chi tiết, chỉ cần soạn lại cho đúng template. |
| `/speckit.specify` | Opus 5.5, effort high | Opus 5.5, effort high | Phải đọc code tham chiếu trong `directus/` để viết đúng hành vi. |
| `/speckit.clarify` | **Opus 5.5, effort xhigh** | Opus 5.5, effort high | Tìm chỗ mơ hồ cần suy luận sâu về luồng của Directus. |
| `/speckit.plan` | **Opus 5.5, effort max** | Opus 5.5, effort xhigh | Bước quan trọng nhất: quyết định cách port, giữ tương thích DB, cache, token. |
| `/speckit.checklist` | Sonnet 5.5 | Sonnet 5.5 | Làm theo khuôn có sẵn. |
| `/speckit.tasks` | Opus 5.5, effort high | Sonnet 5.5 | Feature lõi có nhiều phụ thuộc, cần sắp thứ tự cẩn thận. |
| `/speckit.analyze` | **Opus 5.5, effort xhigh** | Opus 5.5, effort high | Bắt chỗ spec, plan, tasks không khớp nhau trước khi code. |
| `/speckit.implement` | **Opus 5.5, effort xhigh**. Tăng lên max cho phần port logic phức tạp (apply-query, run-ast, payload, permissions, flows, GraphQL schema). | Opus 5.5, effort high. Sonnet 5.5 cho component FE, boilerplate, test lặp lại. | Đọc nhiều code gốc và phải giữ hành vi giống hệt. |
| Sửa lỗi test đối chiếu | Opus 5.5, effort xhigh, tăng lên max nếu sửa 2 lần chưa được | Opus 5.5, effort high | So khác biệt với Directus cần đọc kỹ cả hai bên. |
| `/speckit.status` | Haiku 4.5 | Haiku 4.5 | Chỉ đọc trạng thái. |

**Khi Opus 5.5 effort max vẫn chưa làm tốt** (thường gặp ở 005 và 009):
- Tách feature thành các phần nhỏ hơn. Ví dụ 005 tách thành "đọc và query" và "ghi và payload". 009 tách thành "trigger và engine" và "các operation".
- Trong prompt, chỉ thẳng file Directus cần đọc, thay vì để model tự tìm.
- Cho model chạy test đối chiếu sau mỗi task thay vì cuối feature, để lỗi được phát hiện sớm.

**Lưu ý:**
- **Không dùng `/speckit.quick` cho dự án này.** Lệnh này gộp nhiều bước, nên bỏ qua các điểm kiểm tra mà feature cần giữ tương thích phải có.
- **Không dùng Haiku 4.5 cho bước nào phải đọc code Directus.** Context 200K không đủ cho các module lớn.
- **Đổi model giữa các bước thì nên mở session mới,** hoặc ít nhất chạy `/clear`, để model mới đọc lại spec và plan từ file thay vì dựa vào hội thoại cũ.
- Effort càng cao thì mỗi lượt càng lâu và tốn token hơn. Dùng `max` cho các ô in đậm, không đặt mặc định cho mọi việc.

---

## 9. Mẹo khi chạy

- **Chạy `/speckit.clarify` cho feature 003, 004, 005, 009.** Đây là những phần dễ hiểu sai nhất.
- **Chạy `/speckit.analyze` trước `/speckit.implement`** để bắt lỗi spec, plan, tasks không khớp nhau.
- **Feature lớn (005, 013, 014) nên tách nhỏ hơn** nếu tasks.md quá dài (trên khoảng 60 task). Ví dụ 005 tách thành "đọc và query" và "ghi và payload".
- **Theo dõi tiến độ:** `/speckit.status` cho biết feature hiện tại đang ở bước nào.
- **Mỗi feature làm xong** thì chạy test đối chiếu, rồi merge branch trước khi sang feature sau.

---

## 10. Rủi ro cần lưu ý

| Rủi ro | Ghi chú |
|---|---|
||
| Lệch phiên bản | Khi nâng Directus lên bản mới, app mới phải cập nhật theo, vì DB dùng chung. Khóa Directus ở 11.17.4 cho đến khi app mới hỗ trợ bản tiếp theo. |
| Cache và bus | Sai một cache key hay tên kênh là hai app hiển thị dữ liệu cũ. Feature 002 phải test kỹ hai chiều. |
| Realtime trên Directus | App mới không có WebSocket. Nếu Directus vẫn bật `WEBSOCKETS_ENABLED=true`, người dùng Directus app vẫn có collaborative editing, nhưng không thấy người đang sửa cùng item bằng app mới. Muốn hai bên giống nhau thì tắt WebSocket trên Directus. |
| Storage local | Nếu một môi trường vẫn để `STORAGE_LOCAL_*` trỏ vào ổ riêng của container, file tải lên ở replica này sẽ không thấy ở replica khác. Kiểm tra cấu hình storage trước khi tăng số replica. |
| Khối lượng | Có khoảng 737 file TS ở BE và 551 file Vue ở FE. Ước lượng theo từng feature sau bước `/speckit.tasks`. |
